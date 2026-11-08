/**
 * V4 — Error explainer.
 *
 * Pattern-matches the failures V4 actually produces and explains them in
 * plain words. It is deliberately rule-based and offline: the advice comes
 * from a table of known failure modes, not from a model that might guess.
 *
 * When nothing matches, it says so. A wrong confident answer is worse than an
 * honest "unknown".
 */

import { Events } from '../core/events.js';
import { toPlainData } from '../core/serialization.js';

/**
 * Turn an arbitrary value into searchable text.
 *
 * Error payloads come from a live runtime and can hold cycles (an animator's
 * mixer), so the value is copied with the cycle-safe helper first.
 */
function safeText(value) {
  try {
    const plain = toPlainData(value);
    if (plain === null || plain === undefined) return '';
    if (typeof plain === 'string') return plain;
    return JSON.stringify(plain) ?? '';
  } catch {
    return String(value ?? '');
  }
}

/**
 * Known failure modes. `test` receives the combined message + stack and
 * returns true when the pattern applies.
 */
export const FAILURE_PATTERNS = [
  {
    id: 'missing-model',
    title: 'A model file could not be loaded',
    cause: 'The engine asked the asset loader for a model whose file is not where the catalogue says it is — the file is missing, renamed, or served from the wrong path.',
    likelyFixes: [
      'Check the asset catalogue entry for this id and confirm the file exists at the recorded path.',
      'Run the asset audit (`node tools/audit-assets.mjs`) — it lists every entry whose file is missing on disk.',
      'Make sure the model directory is served alongside the app (the catalogue resolves against game/public/assets/models).',
    ],
    whereToLook: ['v4/src/render/asset-loader.js', 'v4/src/assets/catalogue.js', 'v4/src/assets/library.js'],
    confidence: 'high',
    test: (text) => /failed to load model|unable to load model|error loading model/i.test(text)
      || (/\.(glb|gltf)\b/.test(text) && /(404|not found|failed|unable|missing|enoent)/i.test(text)),
  },
  {
    id: 'unknown-scene',
    title: 'A scene name was not registered',
    cause: 'The scene manager was asked for a scene it has never been told about. Scenes must be defined (or saved and reloaded) before they can be loaded.',
    likelyFixes: [
      'Define the scene before loading it: `sceneManager.define(name, doc)`.',
      'If the scene should come from storage, await `loadFromStorage(name)` — the storage adapter must contain it.',
      'Check the spelling: scene names are matched exactly, including case.',
    ],
    whereToLook: ['v4/src/core/scene.js'],
    confidence: 'high',
    test: (text) => /unknown scene/i.test(text),
  },
  {
    id: 'duplicate-entity-id',
    title: 'Two entities claimed the same id',
    cause: 'An entity was created with an id that already exists, so the world holds two records with the same key and lookups become ambiguous.',
    likelyFixes: [
      'Let `createWorld()` allocate ids — pass no `id` when creating entities.',
      'When reloading a scene, clear the world first (`world.clear()`) before recreating entities.',
      'Check that a saved scene is not loaded twice into the same world.',
    ],
    whereToLook: ['v4/src/core/ecs.js', 'v4/src/core/serialization.js'],
    confidence: 'high',
    test: (text) => /duplicate entity|entity .* already exists|duplicate id/i.test(text),
  },
  {
    id: 'nan-transform',
    title: 'A transform contains NaN',
    cause: 'A position, rotation or scale became NaN. The usual causes are a division by zero, an undefined value reaching a multiplication, or a zero-length vector being normalised.',
    likelyFixes: [
      'Find the code that writes the transform and check for `undefined` / division by zero before the write.',
      'Guard direction maths: normalise only when the vector length is non-zero.',
      'Log the transform before it is applied — `world.getComponent(id, \'transform\')` shows the values that went bad.',
    ],
    whereToLook: ['v4/src/core/transform.js', 'v4/src/physics/physics.js', 'v4/src/input/input.js'],
    confidence: 'high',
    test: (text) => /\bnan\b/i.test(text),
  },
  {
    id: 'missing-physics-body',
    title: 'An entity has no physics body',
    cause: 'Physics code ran for an entity that was never given a body, so there is nothing to integrate or resolve against.',
    likelyFixes: [
      'Add a body for the entity: `physics.addBody({ entityId, shape, halfExtents, mass })`.',
      'Check that the entity actually has a `physics` component before the physics system touches it.',
      'Bodies are keyed by entity id — the id passed to `addBody` must be the entity\'s id.',
    ],
    whereToLook: ['v4/src/physics/physics.js', 'v4/src/core/ecs.js'],
    confidence: 'high',
    test: (text) => /no physics body|body .*not found|missing body|physics body/i.test(text),
  },
  {
    id: 'animation-clip-missing',
    title: 'An animation clip was not found on the model',
    cause: 'The animation controller asked for a clip name the model does not contain. The clip names come from the model file, so the requested name must match one of them.',
    likelyFixes: [
      'List the clips the model really has: `clipNames(model)` from the asset loader.',
      'Match the request case-insensitively, or add the real clip name to the state definition.',
      'Remember that not every model is animated — the environment models ship without clips.',
    ],
    whereToLook: ['v4/src/anim/animator.js', 'v4/src/render/asset-loader.js'],
    confidence: 'high',
    test: (text) => /clip .*not found|no animation clip|missing clip|unknown clip/i.test(text),
  },
  {
    id: 'localstorage-quota',
    title: 'Browser storage is full',
    cause: 'Saving a scene to localStorage exceeded the browser\'s storage quota. The scene save was rejected and the in-memory copy is unchanged.',
    likelyFixes: [
      'Save fewer, smaller scenes — or split large scenes into separate documents.',
      'Delete old scenes from storage before saving (`localStorage.removeItem`).',
      'Move long-lived saves to a server or to IndexedDB rather than localStorage.',
    ],
    whereToLook: ['v4/src/core/scene.js'],
    confidence: 'high',
    test: (text) => /quota|quotaexceedederror|exceeded the quota/i.test(text),
  },
  {
    id: 'missing-component',
    title: 'A required component is missing',
    cause: 'A system read a component that the entity does not have, so it got `null` and the caller used it as if it were data.',
    likelyFixes: [
      'Add the component when the entity is created, or check `world.hasComponent(id, type)` first.',
      'Give the component sensible defaults through the registry so a missing field is not a crash.',
    ],
    whereToLook: ['v4/src/core/ecs.js', 'v4/src/core/serialization.js'],
    confidence: 'medium',
    test: (text) => /cannot read propert(?:y|ies) of (?:null|undefined)|is not a function|has no component/i.test(text),
  },
];

/** Combine the message and the stack into one searchable blob. */
function combine({ message, stack }) {
  return [message ?? '', stack ?? ''].filter(Boolean).join('\n');
}

/**
 * Explain an error.
 *
 * @param {{message?:string, stack?:string, loggerRecords?:Array, events?:Array}} input
 * @returns {{title:string, cause:string, likelyFixes:string[], whereToLook:string[], confidence:string, matched:string|null, evidence:string[]}}
 */
export function explainError({ message = '', stack = '', loggerRecords = [], events = [] } = {}) {
  const text = combine({ message, stack });

  // Evidence: what the logger and the event bus saw around the failure.
  const evidence = [];
  for (const record of (loggerRecords ?? []).slice(-5)) {
    evidence.push(`log[${record.level}] ${record.message}`);
  }
  for (const event of (events ?? []).slice(-5)) {
    evidence.push(`event ${event.type}`);
  }

  if (!text.trim()) {
    return {
      title: 'Nothing to explain',
      cause: 'No error message was supplied, so there is nothing to match against the known V4 failure modes.',
      likelyFixes: ['Pass the error message and stack from the console panel.'],
      whereToLook: ['v4/src/core/log.js'],
      confidence: 'low',
      matched: null,
      evidence,
    };
  }

  for (const pattern of FAILURE_PATTERNS) {
    if (!pattern.test(text)) continue;
    return {
      title: pattern.title,
      cause: pattern.cause,
      likelyFixes: [...pattern.likelyFixes],
      whereToLook: [...pattern.whereToLook],
      confidence: pattern.confidence,
      matched: pattern.id,
      evidence,
    };
  }

  // The bus records errors as events — use that as a second chance.
  // The payload is arbitrary runtime data and can contain cycles (an error
  // raised while an animation mixer was live), so it is stringified with a
  // cycle-safe copy rather than `JSON.stringify`, which would throw.
  const eventList = events ?? [];
  let errorEvent = null;
  for (let i = eventList.length - 1; i >= 0; i -= 1) {
    if (eventList[i]?.type === Events.ERROR) { errorEvent = eventList[i]; break; }
  }
  const eventText = errorEvent ? safeText(errorEvent.payload ?? {}) : '';
  if (eventText) {
    for (const pattern of FAILURE_PATTERNS) {
      if (!pattern.test(eventText)) continue;
      return {
        title: pattern.title,
        cause: pattern.cause,
        likelyFixes: [...pattern.likelyFixes],
        whereToLook: [...pattern.whereToLook],
        confidence: pattern.confidence,
        matched: pattern.id,
        evidence,
      };
    }
  }

  return {
    title: 'Unrecognised error',
    cause: 'This message does not match any known V4 failure mode, so the cause cannot be named from the message alone. The stack trace and the surrounding log records are the next place to look.',
    likelyFixes: [
      'Read the top frame of the stack — that is where the failure happened, not where it was caught.',
      'Look for the nearest V4 log record before the failure in the console panel.',
      'If the failure only happens at runtime, reproduce it with a smaller scene to isolate it.',
    ],
    whereToLook: ['v4/src/core/log.js', 'v4/src/core/events.js'],
    confidence: 'low',
    matched: null,
    evidence,
  };
}
