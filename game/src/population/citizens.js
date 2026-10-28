/**
 * population/citizens.js — the POP citizen VIEW layer.
 *
 * OWNER: POP. This is the only POP file that imports `three` (the rule from
 * core/CONTRACT.md §0.5). Everything it draws is a REAL library character
 * from `src/data/manifest.json` - never generated geometry.
 *
 * The six rigged characters (CC0-1.0, KayKit):
 *   Knight, Mage, Rogue, Rogue_Hooded, Barbarian,
 *   KayKit_AnimatedCharacter_v1.2
 *
 * ---------------------------------------------------------------------------
 * CLONING A RIGGED CHARACTER
 * ---------------------------------------------------------------------------
 * `Object3D.clone(true)` SHARES the source skeleton: in three r169
 * `SkinnedMesh.copy()` ends with `this.skeleton = source.skeleton`, so every
 * clone of a character is welded to one shared rig and its own mixer animates
 * bones the skin never reads. `SkeletonUtils.clone()` rebuilds the skeleton
 * against the clone's OWN bones and rebinds it.
 *
 * The asset service already clones rigged characters through the safe path,
 * but a city needs MANY citizens from ONE loaded character, so this module
 * clones again - always through `SkeletonUtils.clone()`, never
 * `Object3D.clone()`. `skinBindingReport()` checks the result at runtime and
 * `citizens.test.mjs` proves the deformation numerically.
 */

import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { cellToWorld } from '../core/config.js';

/** The six rigged characters of the library. */
export const CHARACTER_KEYS = Object.freeze([
  'Knight', 'Mage', 'Rogue', 'Rogue_Hooded', 'Barbarian',
  'KayKit_AnimatedCharacter_v1.2',
]);

/**
 * The walk clip of each character.
 *
 * The KayKit 1.2 character names it "Walk"; the adventurers name theirs
 * "Walking_A"/"Walking_B". Both are real clips of the real files.
 */
const WALK_CLIPS = Object.freeze({
  'KayKit_AnimatedCharacter_v1.2': 'Walk',
  Knight: 'Walking_A',
  Mage: 'Walking_A',
  Rogue: 'Walking_A',
  Rogue_Hooded: 'Walking_A',
  Barbarian: 'Walking_A',
});

/** The idle clip of every character. */
const IDLE_CLIP = 'Idle';

/**
 * TBD: how many citizens are DRAWN at once.
 *
 * The simulated population runs into the thousands; the rendered sample is
 * capped so the frame budget survives a metropolis.
 * Proposed TUNING key: `maxRenderedCitizens` = 40.
 */
export const MAX_RENDERED_CITIZENS = 40;

/**
 * TBD: how fast a citizen walks, in world units per second.
 *
 * The city is 4 world units per cell; 2.2 units/s is a stroll of about one
 * cell every two seconds.
 * Proposed TUNING key: `citizenWalkSpeed` = 2.2.
 */
export const CITIZEN_WALK_SPEED = 2.2;

// ---------------------------------------------------------------------------
// Skin binding
// ---------------------------------------------------------------------------

/**
 * Inspect the skin binding of a (possibly cloned) character.
 *
 * A correctly bound clone reads its OWN bones: every bone of the skeleton is
 * a descendant of the model. A character that shares the source's skeleton
 * reads bones that live outside it - that is the welded-rig bug.
 *
 * @param {THREE.Object3D} root
 * @returns {{skinned:boolean, meshes:number, ownBones:boolean, shared:boolean}}
 */
export function skinBindingReport(root) {
  const report = { skinned: false, meshes: 0, ownBones: true, shared: false };
  if (!root) return report;
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    report.skinned = true;
    report.meshes += 1;
    const bones = o.skeleton?.bones ?? [];
    if (!bones.length) {
      report.ownBones = false;
      report.shared = true;
      return;
    }
    for (const bone of bones) {
      let node = bone;
      let inside = false;
      while (node) {
        if (node === root) { inside = true; break; }
        node = node.parent;
      }
      if (!inside) {
        report.ownBones = false;
        report.shared = true;
        return;
      }
    }
  });
  return report;
}

// ---------------------------------------------------------------------------
// The citizen manager
// ---------------------------------------------------------------------------

/**
 * Create the citizen renderer.
 *
 * @param {object} ctx the shared context (core/CONTRACT.md §1)
 */
export function createCitizens(ctx) {
  const renderer = ctx.renderer;
  const assets = ctx.assets;
  const rng = typeof ctx.rng === 'function' ? ctx.rng : Math.random;

  /** key -> {model, clips} loaded once through ctx.assets.loadCharacter() */
  const library = new Map();
  /** the citizens currently in the scene */
  const citizens = [];
  /** the free-list of reusable slots */
  let disposed = false;

  function actors() {
    return renderer?.actors ?? null;
  }

  /**
   * Load the characters. Called from the domain's init() so the first
   * citizen does not wait for a download.
   */
  async function preload() {
    if (!assets?.loadCharacter) return { loaded: 0, failures: [] };
    const failures = [];
    let loaded = 0;
    for (const key of CHARACTER_KEYS) {
      try {
        const entry = await assets.loadCharacter(key);
        if (!entry?.model) {
          failures.push(key);
          continue;
        }
        library.set(key, entry);
        loaded += 1;
      } catch (err) {
        failures.push(key);
        // eslint-disable-next-line no-console
        console.warn(`[pop] character "${key}" could not be loaded:`, err?.message ?? err);
      }
    }
    return { loaded, failures };
  }

  /** The character keys that actually loaded. */
  function availableCharacters() {
    return [...library.keys()];
  }

  /** Pick a character key deterministically. */
  function pickCharacter() {
    const keys = availableCharacters();
    if (!keys.length) return null;
    return keys[Math.floor(rng() * keys.length) % keys.length];
  }

  /** Find a clip by name (case-insensitive). */
  function findClip(clips, name) {
    if (!Array.isArray(clips) || !name) return null;
    const exact = clips.find((c) => c.name === name);
    if (exact) return exact;
    const lower = name.toLowerCase();
    return clips.find((c) => c.name?.toLowerCase() === lower) ?? null;
  }

  /** The walk clip of a character, with a graceful fallback. */
  function walkClipFor(key, clips) {
    const named = findClip(clips, WALK_CLIPS[key] ?? 'Walk');
    if (named) return named;
    return clips?.find((c) => /walk/i.test(c.name ?? '')) ?? null;
  }

  /**
   * Build a fresh, independently rigged instance of a character.
   *
   * The clone goes through `SkeletonUtils.clone()` so the clone owns its
   * skeleton. A plain `Object3D.clone()` would share the source's skeleton
   * and weld every citizen to one rig.
   */
  function makeModel(key) {
    const entry = library.get(key);
    if (!entry?.model) return null;
    let model;
    try {
      model = cloneSkeleton(entry.model);
    } catch {
      model = entry.model.clone(true);
    }
    const report = skinBindingReport(model);
    if (report.skinned && !report.ownBones) {
      // eslint-disable-next-line no-console
      console.warn(`[pop] the clone of "${key}" shares its skeleton; the citizen is dropped`);
      return null;
    }
    return model;
  }

  /** The world position of a cell centre. */
  function worldOf(cx, cz) {
    const w = cellToWorld(cx, cz, 0);
    return { x: w.x, z: w.z };
  }

  /**
   * Build a walking path between two cells.
   *
   * The path has three points so the citizens cut across the block instead
   * of walking in a dead straight line.
   */
  function buildPath(from, to) {
    const a = worldOf(from.x, from.z);
    const b = worldOf(to.x, to.z);
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    // A lateral offset at the midpoint: deterministic, driven by the seeded rng.
    const offset = (rng() - 0.5) * 8;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    return [
      { x: a.x, z: a.z },
      { x: mx + nx * offset, z: mz + nz * offset },
      { x: b.x, z: b.z },
    ];
  }

  /**
   * Spawn one citizen.
   *
   * @param {object} [options] `{from, to}` - the cells the citizen walks
   *        between. Without them the citizen walks around its origin.
   * @returns {object|null} the spawned citizen record
   */
  function spawn(options = {}) {
    if (disposed) return null;
    if (citizens.length >= MAX_RENDERED_CITIZENS) return null;
    const key = options.key ?? pickCharacter();
    if (!key) return null;

    const model = makeModel(key);
    if (!model) return null;

    const entry = library.get(key);
    const mixer = new THREE.AnimationMixer(model);
    const walkClip = walkClipFor(key, entry?.clips);
    const idleClip = findClip(entry?.clips, IDLE_CLIP);

    const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
    const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
    if (walkAction) {
      walkAction.enabled = true;
      walkAction.setEffectiveWeight(1);
      walkAction.play();
    } else if (idleAction) {
      idleAction.enabled = true;
      idleAction.setEffectiveWeight(1);
      idleAction.play();
    }

    const from = options.from ?? { x: 0, z: 0 };
    const to = options.to ?? from;
    const path = buildPath(from, to);

    const citizen = {
      key,
      model,
      mixer,
      walkAction,
      idleAction,
      path,
      segment: 0,
      t: 0,
      speed: CITIZEN_WALK_SPEED,
      walking: !!walkAction,
      origin: from,
      destination: to,
    };

    const first = path[0];
    model.position.set(first.x, model.position.y, first.z);
    model.rotation.y = 0;

    actors()?.add(model);
    citizens.push(citizen);
    return citizen;
  }

  /**
   * Remove the most recent citizen.
   * @returns {boolean} true when a citizen was removed
   */
  function despawn() {
    const citizen = citizens.pop();
    if (!citizen) return false;
    actors()?.remove(citizen.model);
    citizen.mixer?.stopAllAction?.();
    citizen.mixer?.uncacheRoot?.(citizen.model);
    return true;
  }

  /** Move one citizen along its path. */
  function stepCitizen(citizen, dt) {
    const path = citizen.path;
    if (!path || path.length < 2) return;

    const a = path[citizen.segment];
    const b = path[Math.min(citizen.segment + 1, path.length - 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len <= 0.0001) {
      citizen.segment = Math.min(citizen.segment + 1, path.length - 1);
      citizen.t = 0;
      return;
    }

    citizen.t += (citizen.speed * dt) / len;
    if (citizen.t >= 1) {
      // Arrived at the end of the path: turn around.
      citizen.t = 0;
      if (citizen.segment >= path.length - 2) {
        citizen.path = [...path].reverse();
        citizen.segment = 0;
        citizen.origin = citizen.destination;
        citizen.destination = path[0];
      } else {
        citizen.segment += 1;
      }
      return;
    }

    const x = a.x + dx * citizen.t;
    const z = a.z + dz * citizen.t;
    citizen.model.position.x = x;
    citizen.model.position.z = z;
    citizen.model.rotation.y = Math.atan2(dx, dz);
  }

  /**
   * Advance the citizens.
   * @param {number} dt wall-clock seconds
   */
  function update(dt) {
    if (disposed) return;
    const step = Number(dt) || 0;
    if (step <= 0) return;
    for (const citizen of citizens) {
      stepCitizen(citizen, step);
      citizen.mixer?.update(step);
    }
  }

  /** The number of rendered citizens. */
  function count() {
    return citizens.length;
  }

  /** Remove every citizen and release the mixers. */
  function dispose() {
    disposed = true;
    for (const citizen of citizens) {
      actors()?.remove(citizen.model);
      citizen.mixer?.stopAllAction?.();
      citizen.mixer?.uncacheRoot?.(citizen.model);
    }
    citizens.length = 0;
    library.clear();
  }

  return {
    preload,
    spawn,
    despawn,
    update,
    count,
    dispose,
    availableCharacters,
    skinBindingReport,
    citizens,
  };
}
