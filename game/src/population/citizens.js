/**
 * population/citizens.js — the POP citizen VIEW layer.
 *
 * OWNER: POP. This is the only POP file that imports `three` (the rule from
 * core/CONTRACT.md §0.5). Everything it draws is a REAL library character
 * from `src/data/manifest.json` - never generated geometry.
 *
 * The rigged characters of the library (all CC0-1.0, KayKit / Quaternius
 * style):
 *   the city crowd  Casual_*, Casual2_*, Casual3_*, Suit_*, Worker_*,
 *                   Chef_Male, Cowboy_Male, Doctor_*_Young
 *   the adventurers Knight, Mage, Rogue, Rogue_Hooded, Barbarian,
 *                   KayKit_AnimatedCharacter_v1.2
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
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS MODULE DOES NOW (V5)
 * ---------------------------------------------------------------------------
 *  1. ANIMATION STATE MACHINE - `animation.js` (pure) owns the rules; this
 *     module binds them to the mixer: one action per state, crossfaded with
 *     `action.crossFadeTo(other, fadeSeconds, true)`, and only ONE action
 *     effectively playing at a time.
 *  2. TERRAIN HEIGHT - a citizen stands ON the terraced terrain: its y is
 *     re-sampled from the WORLD domain every frame.
 *  3. POOLING - `pool.js` (pure) keeps the rigged citizens alive between
 *     lives, so a despawn re-parents and re-positions a citizen instead of
 *     disposing its mesh and its mixer.
 */

import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { cellToWorld, worldToCellInt } from '../core/config.js';
import {
  createAnimationMachine,
  createHazardWatch,
  DEFAULT_FADE_SECONDS,
  STATE_CLIP_CANDIDATES,
} from './animation.js';
import { createPool } from './pool.js';

/**
 * The CITY crowd of the library: the characters that belong in a modern
 * city. Every one of them has an `Idle`, a `Walk`, a `Run` and a `Victory`
 * clip, so all five animation states are playable with them.
 */
export const CITY_CHARACTER_KEYS = Object.freeze([
  'Casual_Male', 'Casual_Female',
  'Casual2_Male', 'Casual2_Female',
  'Casual3_Male', 'Casual3_Female',
  'Suit_Male', 'Suit_Female',
  'Worker_Male', 'Worker_Female',
  'Chef_Male', 'Cowboy_Male',
  'Doctor_Male_Young', 'Doctor_Female_Young',
]);

/**
 * The adventurers of the library: the characters the game already used.
 */
export const CLASSIC_CHARACTER_KEYS = Object.freeze([
  'Knight', 'Mage', 'Rogue', 'Rogue_Hooded', 'Barbarian',
  'KayKit_AnimatedCharacter_v1.2',
]);

/**
 * Every rigged character the citizens may use.
 *
 * The list is verified against `src/data/manifest.json` by
 * `citizens.test.mjs` - a key that is not in the manifest fails the build.
 */
export const CHARACTER_KEYS = Object.freeze([
  ...CITY_CHARACTER_KEYS,
  ...CLASSIC_CHARACTER_KEYS,
]);

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

/**
 * TBD: how fast a citizen RUNS, in world units per second.
 *
 * A citizen at or above this speed plays the run clip.
 * Proposed TUNING key: `citizenRunSpeed` = 4.0.
 */
export const CITIZEN_RUN_SPEED = 4.0;

/**
 * TBD: the share of citizens that walk at the run speed.
 *
 * The rest stroll. A city with a few runners among the strollers reads far
 * better than a city where everybody moves identically.
 * Proposed TUNING key: `citizenRunShare` = 0.25.
 */
export const CITIZEN_RUN_SHARE = 0.25;

/**
 * TBD: how long a citizen pauses at the end of its walk, in seconds.
 *
 * The pause is what gives the citizens their idle moments: without it they
 * would never stop and the idle state would never be reached.
 * Proposed TUNING key: `citizenDwellSeconds` = 2.4.
 */
export const CITIZEN_DWELL_SECONDS = 2.4;

/**
 * TBD: the happiness at which the citizens start cheering, in 0..100.
 *
 * Proposed TUNING key: `citizenCheerHappiness` = 75.
 */
export const CHEER_HAPPINESS_THRESHOLD = 75;

/**
 * TBD: how long a cheer lasts, in seconds.
 *
 * Proposed TUNING key: `citizenCheerSeconds` = 2.0.
 */
export const CHEER_SECONDS = 2.0;

/**
 * TBD: how long a citizen waits before it cheers again, in seconds.
 *
 * Proposed TUNING key: `citizenCheerCooldown` = 9.0.
 */
export const CHEER_COOLDOWN = 9.0;

/**
 * TBD: the share of the citizens that are drawn as city folk.
 *
 * The rest are adventurers. The share keeps the city reading as a modern
 * city while the adventurers keep the silhouettes varied (FR-POP-026).
 * Proposed TUNING key: `citizenCityShare` = 0.8.
 */
export const CITY_CHARACTER_SHARE = 0.8;

// ---------------------------------------------------------------------------
// Skin binding
// ---------------------------------------------------------------------------

/**
 * Inspect the skin binding of a (possibly cloned) character.
 *
 * A correctly bound clone reads its OWN bones: every bone of the skeleton
 * is a descendant of the model. A character that shares the source's
 * skeleton reads bones that live outside it - that is the welded-rig bug.
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
  let disposed = false;

  /**
   * The hazards that are active right now.
   *
   * The hazard system publishes on the shared bus; POP only counts them.
   * Without a bus (a headless run) no hazard is ever active.
   */
  const hazards = createHazardWatch({ bus: ctx.bus });

  function actors() {
    return renderer?.actors ?? null;
  }

  /**
   * The world-space height of the terrain under a CELL.
   *
   * The WORLD domain owns the terrain and publishes `heightAt(cx, cz)` on
   * its service. The raw height map is the fallback for a headless run.
   * Without a correct height a citizen is placed at y = 0 and ends up buried
   * in (or floating over) the terraced voxel terrain.
   *
   * @param {number} cx the cell column
   * @param {number} cz the cell row
   * @returns {number|null} the height, or null when it is unknown
   */
  function groundHeight(cx, cz) {
    const wld = ctx?.domains?.wld;
    if (typeof wld?.heightAt === 'function') {
      try {
        const value = wld.heightAt(cx, cz);
        if (Number.isFinite(value)) return value;
      } catch { /* fall through */ }
    }
    const map = ctx?.state?.world?.heightmap;
    if (map && typeof map.length === 'number') {
      const size = ctx?.config?.GRID?.size ?? 64;
      const x = Math.max(0, Math.min(size - 1, Math.round(Number(cx) || 0)));
      const z = Math.max(0, Math.min(size - 1, Math.round(Number(cz) || 0)));
      const value = map[z * size + x];
      if (Number.isFinite(value)) return value;
    }
    return null;
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

  /** The loaded city characters. */
  function availableCityCharacters() {
    return availableCharacters().filter((key) => CITY_CHARACTER_KEYS.includes(key));
  }

  /** The loaded adventurers. */
  function availableClassicCharacters() {
    return availableCharacters().filter((key) => CLASSIC_CHARACTER_KEYS.includes(key));
  }

  /**
   * Pick a character key deterministically.
   *
   * The city crowd is drawn with the CITY_CHARACTER_SHARE probability, the
   * adventurers with the rest.
   */
  function pickCharacter() {
    const city = availableCityCharacters();
    const classic = availableClassicCharacters();
    const all = [...city, ...classic];
    if (!all.length) return null;
    const useCity = city.length > 0 && (classic.length === 0 || rng() < CITY_CHARACTER_SHARE);
    const pool = useCity ? city : (classic.length ? classic : all);
    return pool[Math.floor(rng() * pool.length) % pool.length];
  }

  /** Find a clip by name (case-insensitive). */
  function findClip(clips, name) {
    if (!Array.isArray(clips) || !name) return null;
    const exact = clips.find((c) => c.name === name);
    if (exact) return exact;
    const lower = name.toLowerCase();
    return clips.find((c) => c.name?.toLowerCase() === lower) ?? null;
  }

  /**
   * The clip a state plays for a character, or null when the character has
   * no such clip.
   *
   * The candidate list is the pure module's; the machine resolves it against
   * the clips the character REALLY has, so a character without a `Walk` clip
   * falls back to its idle clip instead of playing a clip that is not there.
   *
   * @param {object} rig the citizen rig
   * @param {string} state the wanted state
   * @returns {THREE.AnimationClip|null}
   */
  function clipForState(rig, state) {
    const name = rig.machine.clipFor(state);
    if (!name) return null;
    return findClip(rig.clips, name) ?? null;
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

  /**
   * Build a citizen rig: a rigged model, its mixer and its animation state
   * machine, bound together.
   *
   * @param {string} key the manifest character key
   * @returns {object|null}
   */
  function makeRig(key) {
    const entry = library.get(key);
    if (!entry?.model) return null;
    const model = makeModel(key);
    if (!model) return null;

    const mixer = new THREE.AnimationMixer(model);
    const machine = createAnimationMachine({ clips: entry.clips ?? [], initial: 'idle' });

    const runner = rng() < CITIZEN_RUN_SHARE;
    return {
      key,
      model,
      mixer,
      machine,
      clips: entry.clips ?? [],
      /** The height of the model above its own origin (the asset offset). */
      baseY: model.position.y,
      /** The action that is currently playing. */
      action: null,
      /** The actions that have been faded out and still have to be stopped. */
      fading: [],
      speed: runner ? CITIZEN_RUN_SPEED : CITIZEN_WALK_SPEED,
      running: runner,
      path: [],
      segment: 0,
      t: 0,
      origin: { x: 0, z: 0 },
      destination: { x: 0, z: 0 },
      /** The cell the citizen stands on (the terrain sample and the hazards). */
      cell: { x: 0, z: 0 },
      /** The seconds of the current pause at the end of the walk. */
      dwell: 0,
      /** The seconds of the current cheer. */
      cheer: 0,
      /** The seconds until this citizen may cheer again. */
      cheerCooldown: 0,
    };
  }

  /**
   * The world position of a cell centre.
   */
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
    let offset = (rng() - 0.5) * 8;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001 && Math.abs(offset) < 0.001) {
      // The citizen walks onto itself: the path still needs a length.
      offset = 2;
    }
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
   * Put a citizen on the ground.
   *
   * The terrain is terraced, so the height changes from cell to cell: the
   * citizen's y is re-sampled every time it moves, and the cell it stands on
   * is remembered (the hazard watch needs it).
   *
   * @param {object} rig the citizen rig
   * @param {number} x the world x
   * @param {number} z the world z
   */
  function ground(rig, x, z) {
    const cell = worldToCellInt(x, z);
    rig.cell = cell;
    const height = groundHeight(cell.x, cell.z);
    rig.model.position.y = height === null ? rig.baseY : rig.baseY + height;
  }

  /**
   * Start the action of a state and fade the previous one out.
   *
   * Only ONE action is effectively playing: the outgoing action is faded
   * out and stopped when the crossfade is over.
   *
   * @param {object} rig the citizen rig
   * @param {string} state the wanted state
   * @param {number} fadeSeconds the crossfade duration
   */
  function playState(rig, state, fadeSeconds) {
    const clip = clipForState(rig, state);
    if (!clip) return false;
    const fade = Number.isFinite(fadeSeconds) && fadeSeconds >= 0
      ? fadeSeconds
      : DEFAULT_FADE_SECONDS;

    const next = rig.mixer.clipAction(clip);

    if (rig.action && rig.action !== next) {
      next.enabled = true;
      next.reset();
      next.setEffectiveWeight(1);
      next.play();
      // `crossFadeTo` fades the OUTGOING action out and the incoming one in.
      rig.action.crossFadeTo(next, fade, true);
      rig.fading.push({ action: rig.action, remaining: fade });
      rig.action = next;
      return true;
    }

    if (rig.action === next) {
      // The very same clip for the new state: keep playing it.
      return false;
    }

    next.enabled = true;
    next.reset();
    next.setEffectiveWeight(1);
    next.play();
    rig.action = next;
    return true;
  }

  /** Stop the actions whose crossfade is over. */
  function retireFadedActions(rig, dt) {
    if (!rig.fading.length) return;
    const still = [];
    for (const entry of rig.fading) {
      entry.remaining -= dt;
      if (entry.remaining <= 0) {
        // The action may have become the current one again in the meantime.
        if (entry.action !== rig.action) entry.action.stop();
      } else {
        still.push(entry);
      }
    }
    rig.fading = still;
  }

  /** The conditions of the animation machine, right now. */
  function conditionsOf(rig) {
    const happiness = Number(ctx?.state?.population?.happiness) || 0;
    return {
      moving: rig.moving === true,
      fast: rig.moving === true && rig.speed >= CITIZEN_RUN_SPEED,
      happy: happiness >= CHEER_HAPPINESS_THRESHOLD,
      panicked: hazards.near(rig.cell.x, rig.cell.z),
      cheering: rig.cheer > 0,
    };
  }

  /**
   * The pool of citizens.
   *
   * A released citizen keeps its mixer and its model: the next spawn
   * re-parents the model into the scene and puts it somewhere else, instead
   * of building a new rig and throwing the old one away.
   */
  const pool = createPool({
    capacity: MAX_RENDERED_CITIZENS,
    create: () => {
      const key = pickCharacter();
      if (!key) return null;
      return makeRig(key);
    },
    reset: (rig) => {
      rig.mixer.stopAllAction();
      rig.action = null;
      rig.fading = [];
      rig.machine.reset('idle');
      rig.cheer = 0;
      rig.cheerCooldown = 0;
      rig.dwell = 0;
      rig.moving = false;
    },
    destroy: (rig) => {
      rig.mixer.stopAllAction();
      rig.mixer.uncacheRoot?.(rig.model);
      actors()?.remove(rig.model);
    },
    onAcquire: (rig) => {
      actors()?.add(rig.model);
    },
    onRelease: (rig) => {
      actors()?.remove(rig.model);
    },
  });

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

    const rig = pool.acquire();
    if (!rig) return null;

    const from = options.from ?? { x: 0, z: 0 };
    const to = options.to ?? from;
    rig.path = buildPath(from, to);
    rig.segment = 0;
    rig.t = 0;
    rig.origin = from;
    rig.destination = to;
    rig.dwell = 0;
    rig.cheer = 0;
    rig.cheerCooldown = 0;
    rig.moving = true;

    const first = rig.path[0];
    rig.model.position.set(first.x, rig.baseY, first.z);
    rig.model.rotation.y = 0;
    ground(rig, first.x, first.z);

    const citizen = {
      key: rig.key,
      rig,
      get model() { return rig.model; },
      get mixer() { return rig.mixer; },
      get machine() { return rig.machine; },
      get state() { return rig.machine.state; },
      path: rig.path,
      origin: from,
      destination: to,
    };

    citizens.push(citizen);
    return citizen;
  }

  /**
   * Remove the most recent citizen.
   *
   * The citizen is NOT disposed: it goes back to the pool with its mixer and
   * its model intact and is reused by the next spawn.
   *
   * @returns {boolean} true when a citizen was removed
   */
  function despawn() {
    const citizen = citizens.pop();
    if (!citizen) return false;
    pool.release(citizen.rig);
    return true;
  }

  /** Move one citizen along its path. */
  function stepCitizen(rig, dt) {
    // --- the pause at the end of the walk -------------------------------
    if (rig.dwell > 0) {
      rig.dwell -= dt;
      rig.moving = false;
      return;
    }

    const path = rig.path;
    if (!path || path.length < 2) {
      rig.moving = false;
      return;
    }

    /** Turn the citizen around and let it rest for a moment. */
    function turnAround() {
      rig.path = [...path].reverse();
      rig.segment = 0;
      rig.origin = rig.destination;
      rig.destination = path[0];
      rig.dwell = CITIZEN_DWELL_SECONDS;
      rig.t = 0;
      rig.moving = false;
    }

    const a = path[rig.segment];
    const b = path[Math.min(rig.segment + 1, path.length - 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len <= 0.0001) {
      // A degenerate segment: skip it (or turn around at the end).
      if (rig.segment < path.length - 2) {
        rig.segment += 1;
        rig.t = 0;
        rig.moving = true;
      } else {
        turnAround();
      }
      return;
    }

    rig.t += (rig.speed * dt) / len;
    if (rig.t >= 1) {
      // Arrived at the end of the segment.
      rig.model.position.x = b.x;
      rig.model.position.z = b.z;
      ground(rig, b.x, b.z);
      rig.t = 0;
      if (rig.segment >= path.length - 2) {
        // The end of the walk: turn around, but pause first.
        turnAround();
      } else {
        // Only the segment changed - the citizen keeps walking.
        rig.segment += 1;
        rig.moving = true;
      }
      return;
    }

    const x = a.x + dx * rig.t;
    const z = a.z + dz * rig.t;
    rig.model.position.x = x;
    rig.model.position.z = z;
    rig.model.rotation.y = Math.atan2(dx, dz);
    // The terrain is terraced: the citizen follows the ground it walks on.
    ground(rig, x, z);
    rig.moving = true;
  }

  /**
   * The cheer bookkeeping of one citizen.
   *
   * A citizen only cheers while it stands still: a cheering crowd that keeps
   * walking looks like a glitch, not like a celebration.
   */
  function updateCheer(rig, dt) {
    if (rig.cheerCooldown > 0) rig.cheerCooldown -= dt;
    if (rig.cheer > 0) {
      rig.cheer -= dt;
      return;
    }
    const happiness = Number(ctx?.state?.population?.happiness) || 0;
    if (happiness < CHEER_HAPPINESS_THRESHOLD) return;
    if (rig.moving) return;
    if (rig.cheerCooldown > 0) return;
    rig.cheer = CHEER_SECONDS;
    rig.cheerCooldown = CHEER_COOLDOWN;
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
      const rig = citizen.rig;
      stepCitizen(rig, step);
      updateCheer(rig, step);

      // The state machine decides the state; the mixer follows.
      const result = rig.machine.evaluate(conditionsOf(rig));
      if (result.changed) {
        playState(rig, result.to, result.fadeSeconds);
      } else if (!rig.action) {
        // The first state of a fresh citizen.
        playState(rig, rig.machine.state, DEFAULT_FADE_SECONDS);
      }

      retireFadedActions(rig, step);
      rig.mixer.update(step);
    }
  }

  /** The number of rendered citizens. */
  function count() {
    return citizens.length;
  }

  /** The pool's numbers. */
  function poolStats() {
    return pool.stats();
  }

  /** Remove every citizen and release the pool. */
  function dispose() {
    disposed = true;
    for (const citizen of citizens) {
      pool.release(citizen.rig);
    }
    citizens.length = 0;
    pool.dispose();
    hazards.dispose();
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
    poolStats,
    skinBindingReport,
    citizens,
  };
}

/**
 * The clip candidates of every animation state (re-exported so a caller
 * does not have to reach into the pure module).
 */
export { STATE_CLIP_CANDIDATES };
