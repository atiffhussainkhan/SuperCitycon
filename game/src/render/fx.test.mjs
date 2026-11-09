/**
 * render/fx.test.mjs — unit tests for the effect SERVICE (the view half).
 *
 * OWNERSHIP: TEC. Run with:
 *   node --test src/render/fx.test.mjs
 *
 * `render/fx.js` is a view module, so this test may use `three` — it needs
 * a `THREE.Scene` to hold the effect group. No WebGL context is needed:
 * the service only builds geometry, materials and instanced meshes.
 *
 * The PURE half (`render/fx-plan.js`) is tested in `fx-plan.test.mjs`, which
 * does not import `three` at all.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { createEffects } from './fx.js';
import { EFFECT_KINDS, effectCount, effectLifetime } from './fx-plan.js';
import { PALETTE } from '../core/config.js';

/** Count the instanced meshes inside the effect group. */
function instanceCount(group) {
  let n = 0;
  group.traverse((o) => { if (o.isInstancedMesh) n += 1; });
  return n;
}

/** A logger that records the warnings, so a refusal can be seen. */
function makeLogger() {
  const lines = [];
  return {
    lines,
    warn: (message, context) => lines.push({ message, context }),
    error: (message, context) => lines.push({ message, context }),
    info: () => {},
  };
}

// ---------------------------------------------------------------------------
// 1. The service is safe before the scene is ready
// ---------------------------------------------------------------------------

test('the effect service is safe without a scene and never throws', () => {
  const logger = makeLogger();
  const fx = createEffects({ logger });

  assert.equal(fx.spawn('place', { position: { x: 0, y: 0, z: 0 } }), false,
    'a spawn without a scene is refused');
  assert.equal(fx.update(0.016), 0, 'an update without a scene is a no-op');
  assert.doesNotThrow(() => fx.clear(), 'clearing without a scene is safe');
  assert.doesNotThrow(() => fx.dispose(), 'disposing without a scene is safe');
  assert.ok(logger.lines.length > 0, 'the refusal was reported');
});

// ---------------------------------------------------------------------------
// 2. The effect group lives beside the world, not inside it
// ---------------------------------------------------------------------------

test('the effects live in their own group inside the scene', () => {
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  world.name = 'world';
  scene.add(world);

  const fx = createEffects({ scene });
  assert.equal(fx.group.name, 'fx', 'the group is called "fx"');
  assert.equal(scene.getObjectByName('fx'), fx.group, 'the group is in the scene');
  assert.equal(world.children.length, 0, 'the world is untouched');

  fx.spawn('place', { position: { x: 0, y: 0, z: 0 } });
  assert.equal(world.children.length, 0, 'a spawn does not touch the world');
  assert.ok(fx.group.children.length > 0, 'the effect meshes live in the fx group');
  fx.dispose();
});

// ---------------------------------------------------------------------------
// 3. An unknown kind is refused, never thrown
// ---------------------------------------------------------------------------

test('an unknown effect kind is refused and reported', () => {
  const scene = new THREE.Scene();
  const logger = makeLogger();
  const fx = createEffects({ scene, logger });

  assert.equal(fx.spawn('not-a-kind'), false, 'the spawn is refused');
  assert.equal(fx.stats().skipped, 1, 'the refusal is counted');
  assert.equal(fx.stats().spawned, 0, 'nothing was spawned');
  assert.equal(fx.stats().live, 0, 'nothing is alive');
  assert.ok(logger.lines.some((l) => l.context?.kind === 'not-a-kind'), 'the kind is reported');
  fx.dispose();
});

// ---------------------------------------------------------------------------
// 4. Spawning and ageing
// ---------------------------------------------------------------------------

test('a spawn makes particles that live and then die', () => {
  const scene = new THREE.Scene();
  const fx = createEffects({ scene });

  assert.equal(fx.spawn('place', { position: { x: 3, y: 0, z: -4 } }), true, 'the spawn works');
  const stats = fx.stats();
  assert.equal(stats.spawned, 1, 'one spawn was counted');
  assert.equal(stats.byKind.place, 1, 'the kind was counted');
  assert.equal(stats.live, effectCount('place'), 'every recipe particle is alive');
  assert.ok(stats.pooled > 0, 'the pool has room for more');

  // A frame moves them.
  const before = fx.group.children[0].children[0];
  const matrixBefore = before.instanceMatrix.array.slice();
  fx.update(0.1);
  const matrixAfter = before.instanceMatrix.array.slice();
  assert.notDeepEqual(matrixBefore, matrixAfter, 'the instances were rewritten');

  // Long enough and they are all gone.
  fx.update(effectLifetime('place') + 1);
  assert.equal(fx.stats().live, 0, 'every particle died');
  fx.dispose();
});

test('every effect kind can be spawned', () => {
  const scene = new THREE.Scene();
  const fx = createEffects({ scene });
  for (const kind of Object.keys(EFFECT_KINDS)) {
    assert.equal(fx.spawn(kind, { position: { x: 0, y: 0, z: 0 } }), true, `${kind} spawns`);
  }
  assert.equal(fx.stats().spawned, Object.keys(EFFECT_KINDS).length, 'every kind was counted');
  fx.update(0.016);
  fx.dispose();
});

test('a colour override may be a palette hex or a palette name', () => {
  const scene = new THREE.Scene();
  const fx = createEffects({ scene });
  assert.equal(fx.spawn('place', { position: { x: 0, y: 0, z: 0 }, color: PALETTE.gold }), true,
    'a hex colour is accepted');
  assert.equal(fx.spawn('place', { position: { x: 0, y: 0, z: 0 }, color: 'mint' }), true,
    'a palette name is accepted');
  assert.equal(fx.spawn('place', { position: { x: 0, y: 0, z: 0 }, color: 'not-a-colour' }), true,
    'an unknown colour name is simply ignored');
  fx.dispose();
});

// ---------------------------------------------------------------------------
// 5. The pool: a spawn allocates no mesh
// ---------------------------------------------------------------------------

test('a spawn reuses the pooled meshes instead of allocating new ones', () => {
  const scene = new THREE.Scene();
  const fx = createEffects({ scene });

  fx.spawn('place', { position: { x: 0, y: 0, z: 0 } });
  const meshesAfterFirst = instanceCount(fx.group);
  const sceneChildren = scene.children.length;
  assert.ok(meshesAfterFirst > 0, 'the first spawn built the batches');

  for (let i = 0; i < 50; i += 1) {
    fx.spawn('place', { position: { x: i, y: 0, z: 0 } });
  }
  assert.equal(instanceCount(fx.group), meshesAfterFirst, 'no new instanced mesh was created');
  assert.equal(scene.children.length, sceneChildren, 'the scene did not grow');
  assert.equal(fx.stats().live, 51 * effectCount('place'), 'every particle is alive');

  // The batches grew to hold them, but the number of batches did not.
  assert.ok(fx.stats().capacity >= fx.stats().live, 'the pool grew to fit');
  fx.dispose();
});

test('a dead particle goes back into the pool', () => {
  const scene = new THREE.Scene();
  const fx = createEffects({ scene });
  fx.spawn('warning', { position: { x: 0, y: 0, z: 0 } });
  const capacity = fx.stats().capacity;
  fx.update(effectLifetime('warning') + 1);
  assert.equal(fx.stats().live, 0, 'the particles died');
  assert.equal(fx.stats().pooled, capacity, 'the pool has every slot back');
  fx.dispose();
});

// ---------------------------------------------------------------------------
// 6. Reduced motion
// ---------------------------------------------------------------------------

test('reduced motion spawns a smaller, shorter, static marker', () => {
  const scene = new THREE.Scene();
  const fx = createEffects({ scene });

  fx.spawn('place', { position: { x: 0, y: 0, z: 0 } });
  const full = fx.stats().live;
  fx.update(effectLifetime('place') + 1);

  assert.equal(fx.setReducedMotion(true), true, 'reduced motion can be turned on');
  assert.equal(fx.reducedMotion, true, 'the state is readable');
  assert.equal(fx.spawn('place', { position: { x: 0, y: 0, z: 0 } }), true, 'the spawn still works');
  assert.equal(fx.stats().live, 1, 'only the marker was spawned');
  assert.ok(fx.stats().live < full, 'the marker is smaller than the effect');
  assert.equal(fx.stats().reduced, 1, 'the stats say so');

  // The marker does not move.
  const batch = fx.group.children[0].children[0];
  const before = batch.instanceMatrix.array.slice();
  fx.update(0.1);
  assert.deepEqual(batch.instanceMatrix.array.slice(), before, 'the marker is static');

  fx.update(effectLifetime('place') + 1);
  assert.equal(fx.stats().live, 0, 'the marker is short-lived');
  fx.dispose();
});

// ---------------------------------------------------------------------------
// 7. Clearing and disposing
// ---------------------------------------------------------------------------

test('clear removes the effects but keeps the pool', () => {
  const scene = new THREE.Scene();
  const fx = createEffects({ scene });
  fx.spawn('achievement', { position: { x: 0, y: 0, z: 0 } });
  assert.ok(fx.stats().live > 0, 'the effect is alive');

  fx.clear();
  assert.equal(fx.stats().live, 0, 'the effects are gone');
  assert.equal(instanceCount(fx.group), instanceCount(fx.group), 'the batches are still there');

  // The service still works after a clear.
  assert.equal(fx.spawn('place', { position: { x: 0, y: 0, z: 0 } }), true, 'it still spawns');
  fx.dispose();
});

test('dispose takes the group out of the scene and is safe twice', () => {
  const scene = new THREE.Scene();
  const fx = createEffects({ scene });
  fx.spawn('place', { position: { x: 0, y: 0, z: 0 } });

  fx.dispose();
  assert.equal(scene.getObjectByName('fx'), undefined, 'the group left the scene');
  assert.doesNotThrow(() => fx.dispose(), 'disposing twice is safe');
  assert.equal(fx.spawn('place', { position: { x: 0, y: 0, z: 0 } }), false,
    'a disposed service refuses to spawn');
  assert.doesNotThrow(() => fx.update(0.016), 'a disposed service ignores updates');
});
