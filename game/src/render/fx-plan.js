/**
 * render/fx-plan.js — the PURE effect plan: what an effect IS.
 *
 * OWNERSHIP: TEC. Imports only `core/config.js` (which is itself pure).
 * **This module must never import `three`** — it carries the effect rules
 * and has to be unit-testable in plain Node (core/CONTRACT.md §5 rule 5).
 *
 * ART-SOURCE HONESTY:
 *   The build ships NO texture assets and the asset library has no particle
 *   sheets, so an effect here is described only by GEOMETRY and by colours
 *   that already exist in `config.PALETTE`. Nothing in this file points at a
 *   file on disk, and nothing fabricates a "texture" (same rule as
 *   `render/sky.js`, which builds the sky out of vertex-coloured geometry).
 *
 * AN EFFECT IS A RECIPE:
 *   `EFFECT_KINDS` maps a kind id to a list of particle TEMPLATES. A template
 *   says what ONE particle looks like and how it behaves; `planEffect()`
 *   expands the templates into a concrete, deterministic particle list for
 *   one spawn.
 *
 * THE MATHS IS FRAME-RATE INDEPENDENT ON PURPOSE:
 *   A particle obeys `dv/dt = -k*v - g` (drag `k`, gravity `g`) and
 *   `dp/dt = v`. `advanceParticle()` integrates that ODE in CLOSED FORM, so
 *   stepping 60 times with dt = 1/60 lands on exactly the same position as
 *   stepping once with dt = 1.0. A per-frame constant would not.
 */

import { PALETTE } from '../core/config.js';

// --------------------------------------------------------------------------
// Tunables the publisher never published
// --------------------------------------------------------------------------

/** TBD: the reduced-motion marker lasts this fraction of the full effect. */
export const REDUCED_LIFETIME_SCALE = 0.4;

/** TBD: the reduced-motion marker is this fraction of the full effect's size. */
export const REDUCED_SIZE_SCALE = 0.55;

/** TBD: how many particles the reduced-motion marker is made of. */
export const REDUCED_PARTICLE_COUNT = 1;

/**
 * The shape hints a particle may carry. `render/fx.js` maps each hint to one
 * piece of geometry and one material, so an effect never invents art.
 */
export const PARTICLE_SHAPES = Object.freeze(['cube', 'flat', 'spark', 'ring', 'column']);

// --------------------------------------------------------------------------
// The recipe table
// --------------------------------------------------------------------------
//
// A template:
//   shape            one of PARTICLE_SHAPES
//   color            a `config.PALETTE` entry
//   count            how many particles this template expands into
//   offset           [x, y, z] start offset from the spawn point
//   spread           radius of the random start disc (XZ) around the offset
//   velocity         [x, y, z] start velocity (world units / second)
//   velocitySpread   per-axis random addition to the velocity
//   radialSpeed      horizontal speed in a random direction (0 = none)
//   life             particle lifetime in seconds
//   lifeSpread       random +/- addition to the lifetime
//   gravity          + = downward, in world units / second squared
//   drag             velocity damping coefficient (1/second)
//   size             base size of the particle in world units
//   curve            size multipliers: { from, peak?, to }
//   spin             yaw spin in radians / second
//
// TBD: EVERY number in this table is a design decision — the publisher never
// published a particle count, a lifetime, a speed or a size for any effect.
// They are collected here (rather than in `core/config.js`, which this slice
// does not own) and the proposed `TUNING` keys are listed in the final
// report. They are deliberately grouped into ONE table so a designer can
// retune the whole VFX feel in a single place.

export const EFFECT_KINDS = Object.freeze({
  place: Object.freeze({
    id: 'place',
    label: 'building placed',
    particles: Object.freeze([
      Object.freeze({
        shape: 'cube', color: PALETTE.sand, count: 12, offset: [0, 0.25, 0], spread: 2.0,
        velocity: [0, 3.2, 0], velocitySpread: 1.6, life: 0.7, lifeSpread: 0.2,
        gravity: 11, drag: 1.4, size: 0.5, curve: { from: 0.5, peak: 1.0, to: 0 }, spin: 1.6,
      }),
      Object.freeze({
        shape: 'spark', color: PALETTE.gold, count: 5, offset: [0, 0.8, 0], spread: 1.2,
        velocity: [0, 5.4, 0], velocitySpread: 1.1, life: 0.55, lifeSpread: 0.1,
        gravity: 4, drag: 1.8, size: 0.32, curve: { from: 0.2, peak: 1.0, to: 0 }, spin: 5,
      }),
    ]),
    marker: Object.freeze({ shape: 'flat', color: PALETTE.mist, size: 1.1 }),
  }),

  bulldoze: Object.freeze({
    id: 'bulldoze',
    label: 'building demolished',
    particles: Object.freeze([
      Object.freeze({
        shape: 'cube', color: PALETTE.rock, count: 14, offset: [0, 0.4, 0], spread: 1.3,
        velocity: [0, 5.4, 0], velocitySpread: 1.2, radialSpeed: 3.4, life: 0.9, lifeSpread: 0.25,
        gravity: 16, drag: 0.8, size: 0.5, curve: { from: 0.7, peak: 1.0, to: 0.25 }, spin: 5,
      }),
      Object.freeze({
        shape: 'flat', color: PALETTE.mist, count: 8, offset: [0, 0.6, 0], spread: 2.0,
        velocity: [0, 1.5, 0], velocitySpread: 0.8, life: 1.1, lifeSpread: 0.2,
        gravity: 2, drag: 2.4, size: 0.9, curve: { from: 0.5, peak: 1.2, to: 0.1 }, spin: 0.8,
      }),
    ]),
    marker: Object.freeze({ shape: 'flat', color: PALETTE.rock, size: 1.1 }),
  }),

  'level-up': Object.freeze({
    id: 'level-up',
    label: 'building levelled up',
    particles: Object.freeze([
      Object.freeze({
        shape: 'ring', color: PALETTE.gold, count: 1, offset: [0, 0.15, 0], spread: 0,
        velocity: [0, 0.8, 0], velocitySpread: 0, life: 0.75, lifeSpread: 0,
        gravity: 0, drag: 0, size: 1.2, curve: { from: 0.3, peak: 1.5, to: 0.2 }, spin: 2.2,
      }),
      Object.freeze({
        shape: 'spark', color: PALETTE.gold, count: 10, offset: [0, 0.5, 0], spread: 1.5,
        velocity: [0, 6.4, 0], velocitySpread: 1.4, life: 1.0, lifeSpread: 0.2,
        gravity: 3.5, drag: 1.2, size: 0.4, curve: { from: 0.2, peak: 1.0, to: 0 }, spin: 6,
      }),
      Object.freeze({
        shape: 'spark', color: PALETTE.snow, count: 5, offset: [0, 0.9, 0], spread: 0.9,
        velocity: [0, 8.0, 0], velocitySpread: 0.8, life: 0.8, lifeSpread: 0.1,
        gravity: 3, drag: 1.6, size: 0.26, curve: { from: 0.2, peak: 1.0, to: 0 }, spin: 7,
      }),
    ]),
    marker: Object.freeze({ shape: 'ring', color: PALETTE.gold, size: 1.0 }),
  }),

  checkpoint: Object.freeze({
    id: 'checkpoint',
    label: 'stage checkpoint reached',
    particles: Object.freeze([
      Object.freeze({
        shape: 'column', color: PALETTE.azure, count: 1, offset: [0, 0.1, 0], spread: 0,
        velocity: [0, 0, 0], velocitySpread: 0, life: 0.9, lifeSpread: 0,
        gravity: 0, drag: 0, size: 0.9, curve: { from: 0.2, peak: 1.0, to: 0.5 }, spin: 1.2,
      }),
      Object.freeze({
        shape: 'ring', color: PALETTE.sky, count: 2, offset: [0, 0.12, 0], spread: 0.6,
        velocity: [0, 0.4, 0], velocitySpread: 0.2, life: 0.85, lifeSpread: 0.1,
        gravity: 0, drag: 0.4, size: 1.1, curve: { from: 0.2, peak: 1.4, to: 0.2 }, spin: 2.6,
      }),
      Object.freeze({
        shape: 'spark', color: PALETTE.snow, count: 6, offset: [0, 1.2, 0], spread: 1.1,
        velocity: [0, 3.4, 0], velocitySpread: 1.0, life: 0.7, lifeSpread: 0.15,
        gravity: 1.5, drag: 1.5, size: 0.3, curve: { from: 0.2, peak: 1.0, to: 0 }, spin: 4,
      }),
    ]),
    marker: Object.freeze({ shape: 'column', color: PALETTE.azure, size: 0.9 }),
  }),

  achievement: Object.freeze({
    id: 'achievement',
    label: 'achievement unlocked',
    particles: Object.freeze([
      Object.freeze({
        shape: 'spark', color: PALETTE.gold, count: 12, offset: [0, 1.4, 0], spread: 0.5,
        velocity: [0, 4.2, 0], velocitySpread: 0.8, radialSpeed: 6.4, life: 1.25, lifeSpread: 0.25,
        gravity: 6, drag: 1.1, size: 0.42, curve: { from: 0.2, peak: 1.0, to: 0 }, spin: 6,
      }),
      Object.freeze({
        shape: 'spark', color: PALETTE.mint, count: 8, offset: [0, 1.2, 0], spread: 0.5,
        velocity: [0, 3.6, 0], velocitySpread: 0.7, radialSpeed: 5.2, life: 1.15, lifeSpread: 0.2,
        gravity: 6, drag: 1.2, size: 0.36, curve: { from: 0.2, peak: 1.0, to: 0 }, spin: 5,
      }),
      Object.freeze({
        shape: 'spark', color: PALETTE.rose, count: 8, offset: [0, 1.0, 0], spread: 0.5,
        velocity: [0, 3.0, 0], velocitySpread: 0.7, radialSpeed: 5.8, life: 1.05, lifeSpread: 0.2,
        gravity: 6, drag: 1.2, size: 0.34, curve: { from: 0.2, peak: 1.0, to: 0 }, spin: 5,
      }),
      Object.freeze({
        shape: 'ring', color: PALETTE.gold, count: 1, offset: [0, 0.2, 0], spread: 0,
        velocity: [0, 0.6, 0], velocitySpread: 0, life: 1.0, lifeSpread: 0,
        gravity: 0, drag: 0, size: 1.4, curve: { from: 0.2, peak: 1.4, to: 0.2 }, spin: 2,
      }),
    ]),
    marker: Object.freeze({ shape: 'spark', color: PALETTE.gold, size: 0.6 }),
  }),

  'hazard-smoke': Object.freeze({
    id: 'hazard-smoke',
    label: 'smoke plume',
    particles: Object.freeze([
      Object.freeze({
        shape: 'flat', color: PALETTE.slate, count: 6, offset: [0, 0.5, 0], spread: 1.1,
        velocity: [0, 1.5, 0], velocitySpread: 0.5, life: 2.6, lifeSpread: 0.6,
        gravity: -0.6, drag: 0.8, size: 1.1, curve: { from: 0.35, peak: 1.3, to: 0.3 }, spin: 0.6,
      }),
      Object.freeze({
        shape: 'cube', color: PALETTE.steel, count: 4, offset: [0, 0.4, 0], spread: 0.8,
        velocity: [0, 1.9, 0], velocitySpread: 0.4, life: 2.0, lifeSpread: 0.4,
        gravity: -0.9, drag: 0.9, size: 0.55, curve: { from: 0.3, peak: 1.0, to: 0.25 }, spin: 1.4,
      }),
    ]),
    marker: Object.freeze({ shape: 'flat', color: PALETTE.slate, size: 1.0 }),
  }),

  'hazard-fire': Object.freeze({
    id: 'hazard-fire',
    label: 'fire',
    particles: Object.freeze([
      Object.freeze({
        shape: 'cube', color: PALETTE.ember, count: 8, offset: [0, 0.4, 0], spread: 0.85,
        velocity: [0, 6.8, 0], velocitySpread: 1.6, life: 0.55, lifeSpread: 0.15,
        gravity: -2.2, drag: 1.5, size: 0.52, curve: { from: 0.35, peak: 1.1, to: 0 }, spin: 3,
      }),
      Object.freeze({
        shape: 'cube', color: PALETTE.amber, count: 6, offset: [0, 0.3, 0], spread: 0.6,
        velocity: [0, 8.2, 0], velocitySpread: 1.1, life: 0.45, lifeSpread: 0.1,
        gravity: -2.6, drag: 1.8, size: 0.4, curve: { from: 0.3, peak: 1.0, to: 0 }, spin: 3.5,
      }),
      Object.freeze({
        shape: 'cube', color: PALETTE.gold, count: 4, offset: [0, 0.2, 0], spread: 0.35,
        velocity: [0, 9.6, 0], velocitySpread: 0.7, life: 0.35, lifeSpread: 0.08,
        gravity: -3.0, drag: 2.0, size: 0.3, curve: { from: 0.3, peak: 1.0, to: 0 }, spin: 4,
      }),
      Object.freeze({
        shape: 'flat', color: PALETTE.slate, count: 3, offset: [0, 1.6, 0], spread: 0.6,
        velocity: [0, 2.4, 0], velocitySpread: 0.4, life: 1.6, lifeSpread: 0.3,
        gravity: -0.4, drag: 1.0, size: 0.8, curve: { from: 0.3, peak: 1.1, to: 0.3 }, spin: 0.8,
      }),
    ]),
    marker: Object.freeze({ shape: 'cube', color: PALETTE.ember, size: 0.6 }),
  }),

  'hazard-water': Object.freeze({
    id: 'hazard-water',
    label: 'water splash',
    particles: Object.freeze([
      Object.freeze({
        shape: 'cube', color: PALETTE.sky, count: 12, offset: [0, 0.3, 0], spread: 0.9,
        velocity: [0, 6.0, 0], velocitySpread: 0.9, radialSpeed: 4.6, life: 0.7, lifeSpread: 0.15,
        gravity: 14, drag: 0.7, size: 0.4, curve: { from: 0.45, peak: 1.0, to: 0.15 }, spin: 2,
      }),
      Object.freeze({
        shape: 'cube', color: PALETTE.water, count: 8, offset: [0, 0.25, 0], spread: 0.7,
        velocity: [0, 4.6, 0], velocitySpread: 0.7, radialSpeed: 3.4, life: 0.8, lifeSpread: 0.15,
        gravity: 14, drag: 0.8, size: 0.32, curve: { from: 0.4, peak: 1.0, to: 0.1 }, spin: 2,
      }),
      Object.freeze({
        shape: 'ring', color: PALETTE.deepWater, count: 2, offset: [0, 0.1, 0], spread: 0.5,
        velocity: [0, 0.2, 0], velocitySpread: 0.1, life: 0.9, lifeSpread: 0.1,
        gravity: 0, drag: 0.3, size: 1.0, curve: { from: 0.3, peak: 1.3, to: 0.2 }, spin: 1.8,
      }),
    ]),
    marker: Object.freeze({ shape: 'flat', color: PALETTE.sky, size: 1.0 }),
  }),

  warning: Object.freeze({
    id: 'warning',
    label: 'warning',
    particles: Object.freeze([
      Object.freeze({
        shape: 'column', color: PALETTE.ember, count: 1, offset: [0, 0.05, 0], spread: 0,
        velocity: [0, 0, 0], velocitySpread: 0, life: 0.55, lifeSpread: 0,
        gravity: 0, drag: 0, size: 0.7, curve: { from: 0.2, peak: 1.0, to: 0 }, spin: 1.6,
      }),
      Object.freeze({
        shape: 'flat', color: PALETTE.amber, count: 3, offset: [0, 0.2, 0], spread: 0.6,
        velocity: [0, 0.9, 0], velocitySpread: 0.4, life: 0.45, lifeSpread: 0.08,
        gravity: 0, drag: 1.0, size: 0.6, curve: { from: 0.35, peak: 1.0, to: 0 }, spin: 2,
      }),
    ]),
    marker: Object.freeze({ shape: 'column', color: PALETTE.ember, size: 0.6 }),
  }),
});

/** Every effect kind id, in table order. */
export const EFFECT_KIND_NAMES = Object.freeze(Object.keys(EFFECT_KINDS));

// --------------------------------------------------------------------------
// Pure helpers
// --------------------------------------------------------------------------

/** @param {number} x */
function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * A small deterministic PRNG (mulberry32). The plan must be reproducible from
 * its seed alone, so it does NOT use `config.makeRng` (which is fine too, but
 * this keeps the module standalone).
 * @param {number} seed
 * @returns {() => number} values in 0..1
 */
function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A stable hash of a string — used so an effect with no explicit seed still
 * spawns deterministically.
 * @param {string} s
 * @returns {number}
 */
export function hashSeed(s) {
  let h = 2166136261 >>> 0;
  const str = String(s ?? '');
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * The size multiplier of a particle at a point in its life.
 * @param {number} u 0..1 (age / lifetime)
 * @param {{from:number,peak?:number,to:number}|null} [curve]
 * @returns {number} the multiplier
 */
export function sizeFactor(u, curve) {
  const t = clamp01(Number.isFinite(u) ? u : 0);
  if (!curve) return 1;
  const from = Number.isFinite(curve.from) ? curve.from : 0;
  const to = Number.isFinite(curve.to) ? curve.to : from;
  if (!Number.isFinite(curve.peak)) return from + (to - from) * t;
  const peak = curve.peak;
  if (t < 0.5) return from + (peak - from) * (t * 2);
  return peak + (to - peak) * ((t - 0.5) * 2);
}

/**
 * How many particles the recipe for `kind` expands into.
 * @param {string} kind
 * @returns {number} 0 for an unknown kind
 */
export function effectCount(kind) {
  const recipe = EFFECT_KINDS[kind];
  if (!recipe) return 0;
  return recipe.particles.reduce((n, t) => n + t.count, 0);
}

/**
 * How long the effect for `kind` lasts, in seconds (the longest particle).
 * @param {string} kind
 * @param {{reduced?:boolean}} [opts]
 * @returns {number} 0 for an unknown kind
 */
export function effectLifetime(kind, opts = {}) {
  const recipe = EFFECT_KINDS[kind];
  if (!recipe) return 0;
  let max = 0;
  for (const t of recipe.particles) {
    const life = t.life + (t.lifeSpread || 0);
    if (life > max) max = life;
  }
  return opts.reduced ? max * REDUCED_LIFETIME_SCALE : max;
}

/**
 * Build the concrete particle list for ONE spawn of `kind`.
 *
 * Deterministic: the same `kind` and the same `opts.seed` always produce the
 * same list. An unknown kind is REFUSED — the function returns `null` and
 * never throws.
 *
 * @param {string} kind
 * @param {object} [opts]
 * @param {number} [opts.seed]        the seed; defaults to a hash of the kind
 * @param {boolean} [opts.reduced]    build the reduced-motion marker instead
 * @param {number} [opts.scale]       a multiplier on the whole effect
 * @param {number|null} [opts.color]  overrides every particle colour
 * @param {{x:number,y:number,z:number}} [opts.position] the spawn point
 * @returns {{kind:string,reduced:boolean,count:number,lifetime:number,particles:object[]}|null}
 */
export function planEffect(kind, opts = {}) {
  if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(EFFECT_KINDS, kind)) {
    return null;
  }
  const recipe = EFFECT_KINDS[kind];
  const reduced = !!opts.reduced;
  const seed = Number.isFinite(opts.seed) ? (opts.seed >>> 0) : hashSeed(kind);
  const rng = mulberry32(seed);
  const pos = normalisePosition(opts);
  const colour = Number.isFinite(opts.color) ? opts.color : null;
  const userScale = Number.isFinite(opts.scale) && opts.scale > 0 ? opts.scale : 1;
  const scale = userScale * (reduced ? REDUCED_SIZE_SCALE : 1);

  if (reduced) {
    const marker = recipe.marker || { shape: recipe.particles[0].shape, color: recipe.particles[0].color };
    const life = effectLifetime(kind, { reduced: true });
    const particles = [];
    for (let i = 0; i < REDUCED_PARTICLE_COUNT; i += 1) {
      particles.push({
        shape: marker.shape,
        color: colour === null ? marker.color : colour,
        x: pos.x,
        y: pos.y + 0.15,
        z: pos.z,
        vx: 0, vy: 0, vz: 0,
        life,
        age: 0,
        gravity: 0,
        drag: 0,
        size: (Number.isFinite(marker.size) ? marker.size : 0.6) * scale,
        curve: null,
        rotY: 0,
        spin: 0,
        u: 0,
      });
    }
    return { kind, reduced: true, count: particles.length, lifetime: life, particles };
  }

  const particles = [];
  for (const t of recipe.particles) {
    for (let i = 0; i < t.count; i += 1) {
      const off = jitterOffset(t, rng);
      const vel = jitterVelocity(t, rng);
      const spreadLife = t.lifeSpread ? (rng() * 2 - 1) * t.lifeSpread : 0;
      particles.push({
        shape: t.shape,
        color: colour === null ? t.color : colour,
        x: pos.x + off[0] * scale,
        y: pos.y + off[1] * scale,
        z: pos.z + off[2] * scale,
        vx: vel[0] * scale,
        vy: vel[1] * scale,
        vz: vel[2] * scale,
        life: Math.max(0.05, t.life + spreadLife),
        age: 0,
        gravity: t.gravity,
        drag: t.drag,
        size: t.size * scale,
        curve: t.curve || null,
        rotY: rng() * Math.PI * 2,
        spin: t.spin || 0,
        u: 0,
      });
    }
  }
  return {
    kind,
    reduced: false,
    count: particles.length,
    lifetime: effectLifetime(kind),
    particles,
  };
}

/**
 * @param {object} opts
 * @returns {{x:number,y:number,z:number}}
 */
function normalisePosition(opts) {
  const p = opts && opts.position && typeof opts.position === 'object' ? opts.position : null;
  const src = p || opts || {};
  return {
    x: Number.isFinite(src.x) ? src.x : 0,
    y: Number.isFinite(src.y) ? src.y : 0,
    z: Number.isFinite(src.z) ? src.z : 0,
  };
}

/**
 * The random start offset of one particle from its template.
 * @param {object} t
 * @param {() => number} rng
 * @returns {[number,number,number]}
 */
function jitterOffset(t, rng) {
  const base = t.offset || [0, 0, 0];
  const spread = Number.isFinite(t.spread) ? t.spread : 0;
  if (spread <= 0) return [base[0], base[1], base[2]];
  const angle = rng() * Math.PI * 2;
  const radius = Math.sqrt(rng()) * spread;
  return [
    base[0] + Math.cos(angle) * radius,
    base[1] + (rng() * 2 - 1) * spread * 0.25,
    base[2] + Math.sin(angle) * radius,
  ];
}

/**
 * The random start velocity of one particle from its template.
 * @param {object} t
 * @param {() => number} rng
 * @returns {[number,number,number]}
 */
function jitterVelocity(t, rng) {
  const base = t.velocity || [0, 0, 0];
  const jitter = Number.isFinite(t.velocitySpread) ? t.velocitySpread : 0;
  let vx = base[0] + (rng() * 2 - 1) * jitter;
  let vz = base[2] + (rng() * 2 - 1) * jitter;
  const radial = Number.isFinite(t.radialSpeed) ? t.radialSpeed : 0;
  if (radial > 0) {
    const angle = rng() * Math.PI * 2;
    const speed = radial * (0.55 + rng() * 0.75);
    vx = Math.cos(angle) * speed;
    vz = Math.sin(angle) * speed;
  }
  return [vx, base[1] + (rng() * 2 - 1) * jitter, vz];
}

// --------------------------------------------------------------------------
// The simulation
// --------------------------------------------------------------------------

/**
 * Advance ONE particle by `dt` seconds, IN PLACE.
 *
 * The motion obeys `dv/dt = -k*v - g` (drag `k`, gravity `g`; gravity is
 * positive downwards). It is integrated in CLOSED FORM, so the result does
 * not depend on how the frame was chopped up: 60 steps of 1/60 land on the
 * same place as one step of 1.0.
 *
 * @param {object} p a particle from `planEffect()`
 * @param {number} dt seconds
 * @returns {object|null} the particle, or `null` when it has died
 */
export function advanceParticle(p, dt) {
  if (!p) return null;
  const d = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  const life = Number.isFinite(p.life) ? p.life : 0;
  if (life <= 0) return null;
  p.age = (Number.isFinite(p.age) ? p.age : 0) + d;
  if (p.age >= life) return null;

  const k = Math.max(0, Number.isFinite(p.drag) ? p.drag : 0);
  const g = Number.isFinite(p.gravity) ? p.gravity : 0;

  if (k > 1e-6) {
    const e = Math.exp(-k * d);
    const oneMinusE = 1 - e;
    // Horizontal: pure drag.
    p.x += (p.vx * oneMinusE) / k;
    p.z += (p.vz * oneMinusE) / k;
    p.vx *= e;
    p.vz *= e;
    // Vertical: drag plus a constant gravity.
    const gk = g / k;
    const vy0 = p.vy;
    p.y += ((vy0 + gk) * oneMinusE) / k - gk * d;
    p.vy = (vy0 + gk) * e - gk;
  } else {
    const vy0 = p.vy;
    p.x += p.vx * d;
    p.z += p.vz * d;
    p.y += vy0 * d - 0.5 * g * d * d;
    p.vy = vy0 - g * d;
  }

  p.rotY = (Number.isFinite(p.rotY) ? p.rotY : 0) + (Number.isFinite(p.spin) ? p.spin : 0) * d;
  p.u = p.age / life;
  return p;
}

/**
 * Advance a WHOLE list of particles. PURE: the input list is not mutated and
 * a NEW list of NEW particle objects is returned. Dead particles are dropped.
 *
 * @param {object[]} particles
 * @param {number} dt seconds
 * @returns {object[]} the surviving particles
 */
export function stepParticles(particles, dt) {
  const d = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  const out = [];
  for (const p of particles || []) {
    if (!p) continue;
    const copy = { ...p };
    if (advanceParticle(copy, d)) out.push(copy);
  }
  return out;
}

/**
 * How many particles in the list are still alive.
 * @param {object[]} particles
 * @returns {number}
 */
export function aliveCount(particles) {
  let n = 0;
  for (const p of particles || []) {
    if (!p) continue;
    const life = Number.isFinite(p.life) ? p.life : 0;
    const age = Number.isFinite(p.age) ? p.age : 0;
    if (life > 0 && age < life) n += 1;
  }
  return n;
}
