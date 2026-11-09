/**
 * render/fx-plan.test.mjs — unit tests for the PURE effect plan.
 *
 * OWNERSHIP: TEC. Run with:
 *   node --test src/render/fx-plan.test.mjs
 *
 * These tests are PURE: no DOM, no WebGL context, and — importantly — this
 * file does not import `three` at all, because `render/fx-plan.js` must not
 * import it either (core/CONTRACT.md §5 rule 5).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  EFFECT_KINDS, EFFECT_KIND_NAMES, PARTICLE_SHAPES,
  planEffect, stepParticles, advanceParticle, aliveCount,
  effectCount, effectLifetime, sizeFactor, hashSeed,
  REDUCED_LIFETIME_SCALE, REDUCED_SIZE_SCALE,
} from './fx-plan.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// 1. The plan module is pure
// ---------------------------------------------------------------------------

test('the effect plan module does not import three', () => {
  const src = readFileSync(join(HERE, 'fx-plan.js'), 'utf8');
  assert.ok(!/from\s+['"]three['"]/.test(src),
    'render/fx-plan.js must not import three — its rules must be unit-testable in Node');
});

// ---------------------------------------------------------------------------
// 2. The recipe table
// ---------------------------------------------------------------------------

test('the recipe table covers every effect kind the game needs', () => {
  const required = [
    'place', 'bulldoze', 'level-up', 'checkpoint', 'achievement',
    'hazard-smoke', 'hazard-fire', 'hazard-water', 'warning',
  ];
  for (const kind of required) {
    assert.ok(Object.prototype.hasOwnProperty.call(EFFECT_KINDS, kind),
      `the effect kind "${kind}" exists`);
  }
  assert.deepEqual([...EFFECT_KIND_NAMES].sort(), [...required].sort(),
    'the table holds exactly the required kinds');

  for (const kind of EFFECT_KIND_NAMES) {
    const recipe = EFFECT_KINDS[kind];
    assert.ok(recipe.particles.length > 0, `${kind} has at least one particle template`);
    for (const t of recipe.particles) {
      assert.ok(PARTICLE_SHAPES.includes(t.shape), `${kind} uses a known shape hint`);
      assert.ok(Number.isFinite(t.color), `${kind} has a numeric colour`);
      assert.ok(t.count >= 1, `${kind} spawns at least one particle`);
      assert.ok(t.life > 0, `${kind} particles live for a positive time`);
      assert.ok(t.size > 0, `${kind} particles have a positive size`);
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Unknown kinds are refused
// ---------------------------------------------------------------------------

test('an unknown effect kind is refused, not thrown', () => {
  assert.equal(planEffect('not-a-kind'), null);
  assert.equal(planEffect('not-a-kind', { seed: 1 }), null);
  assert.equal(planEffect(''), null);
  assert.equal(planEffect(undefined), null);
  assert.equal(effectCount('not-a-kind'), 0);
  assert.equal(effectLifetime('not-a-kind'), 0);

  // A prototype key must not be mistaken for a recipe.
  assert.equal(planEffect('toString'), null);
  assert.equal(planEffect('constructor'), null);
});

// ---------------------------------------------------------------------------
// 4. The particle count matches the recipe
// ---------------------------------------------------------------------------

test('the planned particle count matches the recipe', () => {
  for (const kind of EFFECT_KIND_NAMES) {
    const plan = planEffect(kind, { seed: 1234 });
    assert.ok(plan, `${kind} can be planned`);
    assert.equal(plan.particles.length, effectCount(kind), `${kind} expands to its recipe count`);
    assert.equal(plan.count, effectCount(kind), `${kind} reports its count`);
    assert.equal(plan.kind, kind, `${kind} reports its kind`);
    assert.equal(plan.reduced, false, `${kind} is not the reduced plan`);
  }
  assert.ok(effectCount('place') > 1, 'the place effect is more than one particle');
});

// ---------------------------------------------------------------------------
// 5. A particle dies after its lifetime
// ---------------------------------------------------------------------------

test('a particle dies once its lifetime is over', () => {
  const plan = planEffect('place', { seed: 9 });
  const p = plan.particles[0];
  const life = p.life;

  let list = [{ ...p }];
  list = stepParticles(list, life * 0.5);
  assert.equal(list.length, 1, 'the particle is alive half way through its life');
  assert.equal(aliveCount(list), 1, 'aliveCount sees it');

  list = stepParticles(list, life * 0.6);
  assert.equal(list.length, 0, 'the particle is gone once its life is over');
  assert.equal(aliveCount(list), 0, 'aliveCount agrees');

  // A step that runs past the end of the life also removes it.
  const long = stepParticles([{ ...p }], life + 1);
  assert.equal(long.length, 0, 'one long step past the lifetime kills it');
});

test('stepping never mutates the list it was given', () => {
  const plan = planEffect('level-up', { seed: 3 });
  const before = plan.particles.map((p) => ({ ...p }));
  const after = stepParticles(plan.particles, 0.1);
  assert.equal(plan.particles.length, before.length, 'the input list is untouched');
  for (let i = 0; i < before.length; i += 1) {
    assert.equal(plan.particles[i].age, before[i].age, 'the input particles are untouched');
    assert.equal(plan.particles[i].x, before[i].x, 'the input positions are untouched');
  }
  assert.ok(after.length > 0, 'the returned list holds the survivors');
});

// ---------------------------------------------------------------------------
// 6. The update is frame-rate independent
// ---------------------------------------------------------------------------

/** Step one particle `steps` times with `dt`; null when it dies. */
function stepTimes(particle, steps, dt) {
  const copy = { ...particle };
  for (let i = 0; i < steps; i += 1) {
    if (!advanceParticle(copy, dt)) return null;
  }
  return copy;
}

test('the update is frame-rate independent', () => {
  // A long-lived particle so both runs survive the whole second.
  const plan = planEffect('level-up', { seed: 21 });
  const longLived = plan.particles.filter((p) => p.life > 1.05);
  assert.ok(longLived.length > 0, 'the level-up plan has particles that live past a second');

  for (const p of longLived) {
    const many = stepTimes(p, 60, 1 / 60);
    const one = stepTimes(p, 1, 1.0);
    assert.ok(many && one, 'the particle survives both runs');
    assert.ok(Math.abs(many.x - one.x) < 1e-9, 'x lands in the same place');
    assert.ok(Math.abs(many.y - one.y) < 1e-9, 'y lands in the same place');
    assert.ok(Math.abs(many.z - one.z) < 1e-9, 'z lands in the same place');
    assert.ok(Math.abs(many.vx - one.vx) < 1e-9, 'the x velocity matches');
    assert.ok(Math.abs(many.vy - one.vy) < 1e-9, 'the y velocity matches');
    assert.ok(Math.abs(many.vz - one.vz) < 1e-9, 'the z velocity matches');
    assert.ok(Math.abs(many.age - one.age) < 1e-9, 'the age matches');
  }
});

test('a particle with drag and gravity moves the way the maths says', () => {
  // dv/dt = -k v - g, integrated in closed form.
  const p = { x: 0, y: 0, z: 0, vx: 0, vy: 10, vz: 0, life: 100, age: 0, gravity: 20, drag: 1 };
  const after = advanceParticle({ ...p }, 1);
  const k = 1;
  const gk = 20 / k;
  const e = Math.exp(-k);
  assert.ok(Math.abs(after.vy - ((10 + gk) * e - gk)) < 1e-9, 'the velocity matches the closed form');
  assert.ok(Math.abs(after.y - (((10 + gk) * (1 - e)) / k - gk)) < 1e-9,
    'the position matches the closed form');
});

// ---------------------------------------------------------------------------
// 7. The reduced-motion plan
// ---------------------------------------------------------------------------

test('the reduced-motion plan is smaller and shorter than the normal one', () => {
  for (const kind of EFFECT_KIND_NAMES) {
    const normal = planEffect(kind, { seed: 5 });
    const reduced = planEffect(kind, { seed: 5, reduced: true });

    assert.ok(reduced, `${kind} has a reduced plan`);
    assert.equal(reduced.reduced, true, `${kind} reduced plan is flagged`);
    assert.ok(reduced.particles.length < normal.particles.length,
      `${kind} reduced plan has fewer particles`);
    assert.ok(reduced.lifetime < normal.lifetime, `${kind} reduced plan is shorter`);
    assert.ok(Math.abs(reduced.lifetime - normal.lifetime * REDUCED_LIFETIME_SCALE) < 1e-9,
      `${kind} reduced lifetime uses the documented scale`);

    const mass = (list) => list.reduce((n, p) => n + p.size, 0);
    assert.ok(mass(reduced.particles) < mass(normal.particles),
      `${kind} reduced plan is smaller in total`);

    for (const p of reduced.particles) {
      assert.equal(p.vx, 0, `${kind} reduced particle does not move on x`);
      assert.equal(p.vy, 0, `${kind} reduced particle does not move on y`);
      assert.equal(p.vz, 0, `${kind} reduced particle does not move on z`);
      assert.equal(p.gravity, 0, `${kind} reduced particle is not pulled by gravity`);
      assert.equal(p.spin, 0, `${kind} reduced particle does not spin`);
      assert.equal(p.curve, null, `${kind} reduced particle keeps a constant size`);
    }
  }
});

test('the reduced marker still dies on time', () => {
  const reduced = planEffect('warning', { seed: 2, reduced: true });
  const list = stepParticles(reduced.particles, reduced.lifetime + 0.01);
  assert.equal(list.length, 0, 'the reduced marker is short-lived');
});

// ---------------------------------------------------------------------------
// 8. Determinism
// ---------------------------------------------------------------------------

test('a plan is deterministic for a given seed', () => {
  const a = planEffect('achievement', { seed: 4242 });
  const b = planEffect('achievement', { seed: 4242 });
  assert.equal(a.particles.length, b.particles.length, 'the same count');
  for (let i = 0; i < a.particles.length; i += 1) {
    assert.equal(a.particles[i].x, b.particles[i].x, 'the same x');
    assert.equal(a.particles[i].y, b.particles[i].y, 'the same y');
    assert.equal(a.particles[i].z, b.particles[i].z, 'the same z');
    assert.equal(a.particles[i].life, b.particles[i].life, 'the same lifetime');
  }

  const c = planEffect('achievement', { seed: 4243 });
  const differs = c.particles.some((p, i) => p.x !== a.particles[i].x);
  assert.ok(differs, 'a different seed gives a different spread');
});

test('a plan without a seed is still deterministic', () => {
  const a = planEffect('place');
  const b = planEffect('place');
  assert.equal(a.particles.length, b.particles.length, 'the same count');
  assert.equal(a.particles[0].x, b.particles[0].x, 'the same first x');
  assert.equal(hashSeed('place'), hashSeed('place'), 'the seed hash is stable');
});

// ---------------------------------------------------------------------------
// 9. The plan honours its options
// ---------------------------------------------------------------------------

test('the plan honours the position, the colour and the scale', () => {
  const plan = planEffect('place', {
    seed: 1,
    position: { x: 10, y: 2, z: -5 },
    color: 0x123456,
    scale: 2,
  });
  for (const p of plan.particles) {
    assert.equal(p.color, 0x123456, 'the colour override is applied');
    const distance = Math.hypot(p.x - 10, p.y - 2, p.z + 5);
    assert.ok(distance < 8, 'the particles start near the spawn point');
  }
  const small = planEffect('place', { seed: 1, position: { x: 0, y: 0, z: 0 } });
  assert.ok(plan.particles[0].size > small.particles[0].size, 'the scale grows the particles');
});

test('the size curve is applied over the life of a particle', () => {
  assert.equal(sizeFactor(0, { from: 0.5, peak: 1, to: 0 }), 0.5, 'the curve starts at `from`');
  assert.equal(sizeFactor(0.5, { from: 0.5, peak: 1, to: 0 }), 1, 'the curve peaks in the middle');
  assert.equal(sizeFactor(1, { from: 0.5, peak: 1, to: 0 }), 0, 'the curve ends at `to`');
  assert.equal(sizeFactor(0, { from: 0.5, to: 1 }), 0.5, 'a curve without a peak is linear');
  assert.equal(sizeFactor(0.5, null), 1, 'no curve means no change');
});
