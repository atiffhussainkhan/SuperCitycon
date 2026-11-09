/**
 * render/fx.js — the effect service: the VIEW half of the VFX system.
 *
 * OWNERSHIP: TEC. Imports `three`, `core/config.js`, `./fx-plan.js` (pure)
 * and the instancing helpers from `./performance.js`.
 *
 * WHAT THIS IS:
 *   The project had NO particle / VFX system at all and no hook point — the
 *   renderer exposed no `fx` group and no `spawnEffect()` API. This module
 *   provides both, WITHOUT touching any file outside `src/render/`.
 *
 * ART-SOURCE HONESTY:
 *   Every effect is built from procedural geometry (a cube, a slab, a shard,
 *   a ring, a column) and from colours that already exist in
 *   `config.PALETTE`. There is no texture file, no particle sheet and no
 *   reference to an art path anywhere in this file — the project ships no
 *   effect art and the asset library has none either.
 *
 * THE POOL:
 *   One `InstancedMesh` batch per shape, grown on demand by the existing
 *   `performance.js` helper. A spawn NEVER allocates a mesh, a geometry, a
 *   material or a draw call: it only writes instance matrices and colours
 *   into the batches that already exist. The particle records themselves are
 *   recycled through a free list.
 *
 * SAFETY:
 *   Nothing here may throw into the frame loop. Every public method catches
 *   its own errors and reports them through the logger.
 */

import * as THREE from 'three';
import { PALETTE } from '../core/config.js';
import {
  EFFECT_KINDS, EFFECT_KIND_NAMES, planEffect, advanceParticle, sizeFactor,
} from './fx-plan.js';
import { makeInstancedBatch, setInstanceCount, disposeInstancedBatch } from './performance.js';
import { voxelMaterial } from './materials.js';

/** How many instance slots a shape batch starts with. */
const INITIAL_CAPACITY = 24; // TBD: the publisher never published a particle budget; 24 per shape is a guess.

/**
 * The geometry of each shape hint. `lit` shapes take the project's toon
 * material (so they read as solid voxels); the others take a flat unlit
 * material (so a sparkle or a ring reads as a marker).
 */
const SHAPE_DEFS = Object.freeze({
  cube: { lit: true, geometry: () => new THREE.BoxGeometry(1, 1, 1) },
  flat: { lit: false, geometry: () => new THREE.BoxGeometry(1.6, 0.16, 1.6) },
  spark: { lit: false, geometry: () => new THREE.BoxGeometry(0.34, 0.34, 1.5) },
  ring: {
    lit: false,
    geometry: () => {
      const g = new THREE.TorusGeometry(0.6, 0.14, 4, 14);
      g.rotateX(-Math.PI / 2);
      return g;
    },
  },
  column: { lit: true, geometry: () => new THREE.CylinderGeometry(0.45, 0.6, 2.0, 6) },
});

const _white = new THREE.Color(0xffffff);

/**
 * Resolve a colour override. A number is a palette hex; a string is a
 * PALETTE key. Anything else is refused.
 * @param {number|string|null|undefined} value
 * @param {Record<string, number>} palette
 * @returns {number|null}
 */
function resolveColour(value, palette) {
  if (Number.isFinite(value)) return value;
  if (typeof value === 'string' && palette) {
    const named = palette[value];
    if (Number.isFinite(named)) return named;
  }
  return null;
}

/**
 * Create the effect service.
 *
 * @param {object} [opts]
 * @param {THREE.Scene} [opts.scene]    the scene the effects live in
 * @param {THREE.WebGLRenderer} [opts.renderer] unused today, kept for the API
 * @param {{PALETTE?:Record<string,number>}} [opts.config] the game config
 * @param {() => number} [opts.rng]       a seeded RNG for the spawn seeds
 * @param {{warn?:Function,error?:Function,info?:Function}} [opts.logger]
 * @returns {{
 *   spawn: (kind:string, opts?:object) => boolean,
 *   update: (dt:number) => number,
 *   clear: () => void,
 *   stats: () => object,
 *   setReducedMotion: (on:boolean) => boolean,
 *   dispose: () => void,
 *   group: THREE.Group,
 *   kinds: string[],
 * }}
 */
export function createEffects({ scene = null, renderer = null, config = null, rng = null, logger = null } = {}) {
  const palette = (config && config.PALETTE) || PALETTE;

  /** The dedicated group: effects are cleared without touching the world. */
  const group = new THREE.Group();
  group.name = 'fx';
  if (scene && typeof scene.add === 'function') scene.add(group);

  /** @type {Map<string, object>} shape -> instanced batch */
  const batches = new Map();
  /** The materials this service created itself (the cached toon material is NOT ours). */
  const ownMaterials = [];

  /** The live particles. */
  const live = [];
  /** Recycled particle records — a spawn never allocates one. */
  const spare = [];

  let reducedMotion = false;
  let spawned = 0;
  let skipped = 0;
  let reducedSpawns = 0;
  let spawnCounter = 0;
  let disposed = false;
  /** @type {Record<string, number>} */
  const byKind = Object.create(null);

  function warn(message, context) {
    try {
      if (logger && typeof logger.warn === 'function') logger.warn(message, context);
      else if (typeof console !== 'undefined' && console.warn) console.warn(`[fx] ${message}`, context || '');
    } catch {
      /* a broken logger must never break the game */
    }
  }

  /** The batch for a shape, created on first use. */
  function ensureBatch(shape) {
    const existing = batches.get(shape);
    if (existing) return existing;
    const def = SHAPE_DEFS[shape];
    if (!def) return null;
    try {
      const material = def.lit
        ? voxelMaterial(0xffffff)
        : new THREE.MeshBasicMaterial({ color: 0xffffff });
      if (!def.lit) ownMaterials.push(material);
      const source = new THREE.Mesh(def.geometry(), material);
      source.name = `fx-${shape}`;
      const batch = makeInstancedBatch(source, INITIAL_CAPACITY);
      // The batch cloned the geometry, so the source copy is ours to free.
      source.geometry.dispose();
      for (const im of batch.parts) {
        im.castShadow = false;
        im.receiveShadow = false;
        // Pre-create the instance colour buffer so the shader never has to
        // be recompiled mid-frame.
        im.setColorAt(0, _white);
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
      setInstanceCount(batch, 0);
      group.add(batch.group);
      batches.set(shape, batch);
      return batch;
    } catch (err) {
      warn('a shape batch could not be built', { shape, error: String(err?.message ?? err) });
      return null;
    }
  }

  /** Write the live particles into the instance batches. */
  function writeInstances() {
    const counters = new Map();
    // Pass 1 — the transforms. This is where a batch may GROW, which
    // replaces its meshes, so the colours are written afterwards.
    for (const p of live) {
      const batch = batches.get(p.shape);
      if (!batch) continue;
      const i = counters.get(p.shape) || 0;
      counters.set(p.shape, i + 1);
      const scale = p.size * sizeFactor(p.u, p.curve);
      batch.setInstance(i, { x: p.x, y: p.y, z: p.z, rotY: p.rotY, scale });
    }
    // Pass 2 — the palette colours.
    const colourIndex = new Map();
    for (const p of live) {
      const batch = batches.get(p.shape);
      if (!batch) continue;
      const i = colourIndex.get(p.shape) || 0;
      colourIndex.set(p.shape, i + 1);
      _white.set(p.color);
      for (const im of batch.parts) {
        im.setColorAt(i, _white);
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    }
    // Pass 3 — how many slots of each batch are live.
    for (const [shape, batch] of batches) {
      setInstanceCount(batch, counters.get(shape) || 0);
    }
  }

  /**
   * Spawn one effect.
   *
   * @param {string} kind one of `EFFECT_KINDS`
   * @param {object} [opts]
   * @param {{x:number,y:number,z:number}} [opts.position] the spawn point
   * @param {number|string} [opts.color] a palette hex or a PALETTE key
   * @param {number} [opts.seed]  a deterministic seed for the spawn
   * @param {number} [opts.scale] a multiplier on the whole effect
   * @returns {boolean} false when the kind was refused or nothing could be spawned
   */
  function spawn(kind, opts = {}) {
    if (disposed) return false;
    if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(EFFECT_KINDS, kind)) {
      skipped += 1;
      warn('an unknown effect kind was refused', { kind: String(kind) });
      return false;
    }
    if (!scene) {
      skipped += 1;
      warn('an effect was refused because there is no scene yet', { kind });
      return false;
    }
    try {
      const seed = Number.isFinite(opts.seed)
        ? (opts.seed >>> 0)
        : (typeof rng === 'function'
          ? (Math.floor(rng() * 0xffffffff) >>> 0)
          : (((spawnCounter += 1) * 2654435761) >>> 0));
      const colour = resolveColour(opts.color, palette);
      const plan = planEffect(kind, {
        seed,
        reduced: reducedMotion,
        scale: opts.scale,
        color: colour === null ? undefined : colour,
        position: opts.position
          ? opts.position
          : { x: opts.x, y: opts.y, z: opts.z },
      });
      if (!plan || !plan.particles.length) {
        skipped += 1;
        warn('an effect could not be planned', { kind });
        return false;
      }
      for (const planned of plan.particles) {
        if (!ensureBatch(planned.shape)) {
          skipped += 1;
          return false;
        }
        const state = spare.pop() || {};
        for (const key of Object.keys(planned)) state[key] = planned[key];
        live.push(state);
      }
      spawned += 1;
      byKind[kind] = (byKind[kind] || 0) + 1;
      if (reducedMotion) reducedSpawns += 1;
      writeInstances();
      return true;
    } catch (err) {
      skipped += 1;
      warn('an effect could not be spawned', { kind, error: String(err?.message ?? err) });
      return false;
    }
  }

  /**
   * Advance the effects.
   * @param {number} dt seconds
   * @returns {number} how many particles are alive
   */
  function update(dt) {
    if (disposed) return 0;
    try {
      const d = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      if (d > 0 && live.length) {
        for (let i = live.length - 1; i >= 0; i -= 1) {
          const p = live[i];
          if (!advanceParticle(p, d)) {
            live.splice(i, 1);
            spare.push(p);
          }
        }
      }
      if (live.length) writeInstances();
      return live.length;
    } catch (err) {
      warn('the effect update failed', { error: String(err?.message ?? err) });
      return live.length;
    }
  }

  /** Remove every live effect (the pooled meshes stay). */
  function clear() {
    try {
      while (live.length) spare.push(live.pop());
      for (const batch of batches.values()) setInstanceCount(batch, 0);
    } catch (err) {
      warn('the effects could not be cleared', { error: String(err?.message ?? err) });
    }
  }

  /**
   * A snapshot of the service.
   * @returns {{live:number,spawned:number,pooled:number,skipped:number,byKind:object,reduced:number,capacity:number,reducedMotion:boolean}}
   */
  function stats() {
    let capacity = 0;
    for (const batch of batches.values()) capacity += batch.capacity;
    return {
      live: live.length,
      spawned,
      pooled: Math.max(0, capacity - live.length),
      skipped,
      byKind: { ...byKind },
      reduced: reducedSpawns,
      capacity,
      reducedMotion,
    };
  }

  /**
   * Turn the reduced-motion preset on or off. While it is on, every spawn
   * produces a much smaller, shorter, STATIC marker instead of the effect.
   * @param {boolean} on
   * @returns {boolean} the new state
   */
  function setReducedMotion(on) {
    reducedMotion = !!on;
    return reducedMotion;
  }

  /** Tear the service down. Safe to call twice. */
  function dispose() {
    if (disposed) return;
    disposed = true;
    try {
      clear();
      for (const batch of batches.values()) disposeInstancedBatch(batch);
      batches.clear();
      for (const m of ownMaterials) m.dispose?.();
      ownMaterials.length = 0;
      spare.length = 0;
      if (group.parent) group.parent.remove(group);
      group.clear();
    } catch (err) {
      warn('the effects could not be disposed', { error: String(err?.message ?? err) });
    }
  }

  return {
    spawn,
    update,
    clear,
    stats,
    setReducedMotion,
    dispose,
    group,
    kinds: EFFECT_KIND_NAMES,
    get reducedMotion() { return reducedMotion; },
  };
}
