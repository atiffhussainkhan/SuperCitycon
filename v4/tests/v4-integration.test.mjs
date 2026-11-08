/**
 * Integration regression tests.
 *
 * Every test here covers a defect that was found by review and then fixed.
 * They are the executable form of the findings: if one of these breaks again,
 * the corresponding bug is back.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { createWorld, Tags } from '../src/core/ecs.js';
import { createRegistry, deserializeScene, serializeScene, toPlainData } from '../src/core/serialization.js';
import { createTransform, setPosition, updateWorldMatrices } from '../src/core/transform.js';
import { createPhysicsWorld } from '../src/physics/physics.js';
import { createAnimator } from '../src/anim/animator.js';

/* -------------------------------------------------- physics: static blocks */

test('a kinematic body is pushed out of a static collider', () => {
  const physics = createPhysicsWorld({ gravity: -24, groundY: 0 });
  physics.addBody({
    entityId: 1, shape: 'box', halfExtents: [0.4, 0.9, 0.4],
    position: { x: 0, y: 0.9, z: 0 }, kinematic: true,
  });
  // A wall from x = 10.8 to x = 17.2, tall enough that it cannot be stepped on.
  physics.addCollider({ min: { x: 10.8, y: 0, z: -3.4 }, max: { x: 17.2, y: 3, z: 3.4 }, name: 'cafe' });

  // Walk into it, the way a player does.
  for (let i = 0; i < 40; i += 1) physics.moveBody(1, { x: 0.5, y: 0, z: 0 });

  const body = physics.getBody(1);
  assert.ok(body.position.x + 0.4 <= 10.8 + 1e-6, `the body must not pass through the wall, x=${body.position.x}`);
  assert.ok(body.position.x > 9, `the body must be stopped at the wall, x=${body.position.x}`);
});

test('a body can still step onto a low collider', () => {
  const physics = createPhysicsWorld({ gravity: -24, groundY: 0 });
  physics.addBody({
    entityId: 1, shape: 'box', halfExtents: [0.4, 0.9, 0.4],
    position: { x: 0, y: 0.9, z: 0 }, kinematic: true,
  });
  // A 0.3 m kerb: low enough to walk onto.
  physics.addCollider({ min: { x: 1, y: 0, z: -1 }, max: { x: 2, y: 0.3, z: 1 }, name: 'kerb' });

  physics.moveBody(1, { x: 1.5, y: 0, z: 0 });
  const body = physics.getBody(1);
  assert.ok(body.position.y > 0.9, `the body should have stepped up, y=${body.position.y}`);
  assert.ok(body.onGround);
});

test('a box uses its own extents per axis, not the vertical one', () => {
  const physics = createPhysicsWorld({ gravity: 0, groundY: -100 });
  physics.addBody({
    entityId: 1, shape: 'box', halfExtents: [2, 0.1, 2],
    position: { x: 0, y: 0, z: 0 }, kinematic: true,
  });
  physics.addCollider({ min: { x: 5, y: -5, z: -5 }, max: { x: 6, y: 5, z: 5 }, name: 'wall' });

  // The body is 4 m wide, so it is still overlapping the wall at x = 4.5
  // even though its *vertical* half-extent is only 0.1.
  physics.moveBody(1, { x: 4.5, y: 0, z: 0 });
  const body = physics.getBody(1);
  assert.ok(body.position.x + 2 <= 5.0001, `the wide body should have been blocked, x=${body.position.x}`);
});

/* --------------------------------------- serialization: the format is JSON-safe */

test('a scene document with a parented child is JSON-safe', () => {
  const world = createWorld();
  const registry = createRegistry().registerBuiltins();

  const parent = world.createEntity({ name: 'Parent', tags: [Tags.STATIC] });
  const parentTransform = createTransform({ position: [0, 0, 0] });
  world.addComponent(parent.id, 'transform', parentTransform);

  const child = world.createEntity({ name: 'Child', tags: [Tags.STATIC] });
  const childTransform = createTransform({ position: [1, 0, 0] });
  world.addComponent(child.id, 'transform', childTransform);

  // The live links the editor builds.
  parentTransform.children = [childTransform];
  childTransform.parent = parentTransform;

  const doc = serializeScene(world, registry, 'Hierarchy');
  assert.doesNotThrow(() => JSON.stringify(doc), 'the scene document must be JSON-safe');

  const parentRaw = doc.entities.find((e) => e.name === 'Parent').components.transform;
  const childRaw = doc.entities.find((e) => e.name === 'Child').components.transform;
  assert.deepEqual(parentRaw.children, [child.id], 'children are stored as entity ids');
  assert.equal(childRaw.parent, parent.id, 'the parent is stored as an entity id');
});

test('a loaded scene rebuilds the hierarchy as object links', () => {
  const world = createWorld();
  const registry = createRegistry().registerBuiltins();
  const parent = world.createEntity({ name: 'Parent' });
  world.addComponent(parent.id, 'transform', createTransform());
  const child = world.createEntity({ name: 'Child' });
  world.addComponent(child.id, 'transform', createTransform({ position: [2, 0, 0] }));

  const doc = serializeScene(world, registry, 'Hierarchy');
  // Re-create the hierarchy links the way the editor does before saving.
  const parentTransform = world.getComponent(parent.id, 'transform');
  const childTransform = world.getComponent(child.id, 'transform');
  parentTransform.children = [childTransform];
  childTransform.parent = parentTransform;
  const linked = serializeScene(world, registry, 'Hierarchy');

  const target = createWorld();
  const loaded = deserializeScene(target, registry, linked);
  assert.equal(loaded, 2);

  const newParent = target.get(parent.id);
  const newChild = target.get(child.id);
  const newParentTransform = target.getComponent(parent.id, 'transform');
  const newChildTransform = target.getComponent(child.id, 'transform');
  assert.equal(newParentTransform.children.length, 1);
  assert.equal(newParentTransform.children[0], newChildTransform, 'the child link is the live object');
  assert.equal(newChildTransform.parent, newParentTransform, 'the parent link is the live object');
  assert.equal(doc.entities.length, 2);
});

test('toPlainData copies a shared value twice and marks only a real cycle', () => {
  const shared = { a: 1 };
  const copied = toPlainData({ x: shared, y: shared });
  assert.deepEqual(copied, { x: { a: 1 }, y: { a: 1 } }, 'a shared value is not a cycle');

  const cyclic = { name: 'loop' };
  cyclic.self = cyclic;
  const flat = toPlainData(cyclic);
  assert.equal(flat.name, 'loop');
  assert.equal(flat.self, '[circular]');
});

test('the animation component never carries a live animator into the document', () => {
  const world = createWorld();
  const registry = createRegistry().registerBuiltins();
  const entity = world.createEntity({ name: 'Player' });
  world.addComponent(entity.id, 'animation', {
    clip: 'Idle', speed: 1, loop: true, state: 'idle',
    controller: { mixer: { _actions: [] }, update() {} },
  });

  const doc = serializeScene(world, registry, 'Animated');
  assert.doesNotThrow(() => JSON.stringify(doc));
  const raw = doc.entities[0].components.animation;
  assert.equal(raw.controller, undefined, 'the runtime handle is not saved');
  assert.equal(raw.clip, 'Idle');
});

/* --------------------------------------------------- animator: the conditions */

test('a compound transition condition can fire', () => {
  const root = new THREE.Object3D();
  const clip = new THREE.AnimationClip('Walk', 1, []);
  const animator = createAnimator({
    root,
    clips: [clip, new THREE.AnimationClip('Idle', 1, []), new THREE.AnimationClip('Run', 1, [])],
    states: {
      idle: { clips: ['Idle'], loop: true },
      walk: { clips: ['Walk'], loop: true },
      run: { clips: ['Run'], loop: true },
    },
    transitions: [
      { from: 'idle', to: 'walk', when: 'moving' },
      { from: 'walk', to: 'run', when: 'sprinting' },
      { from: 'run', to: 'walk', when: '!sprinting && moving' },
    ],
  });

  animator.setCondition('moving', true);
  animator.update(0.016);
  assert.equal(animator.state, 'walk');

  animator.setCondition('sprinting', true);
  animator.update(0.016);
  assert.equal(animator.state, 'run');

  // Stop sprinting while still moving: the compound condition must fire.
  animator.setCondition('sprinting', false);
  animator.update(0.016);
  assert.equal(animator.state, 'walk', 'the compound condition must be evaluated, not looked up as a key');
});

test('a negated condition returns the character to idle', () => {
  const root = new THREE.Object3D();
  const animator = createAnimator({
    root,
    clips: [new THREE.AnimationClip('Walk', 1, []), new THREE.AnimationClip('Idle', 1, [])],
    states: {
      idle: { clips: ['Idle'], loop: true },
      walk: { clips: ['Walk'], loop: true },
    },
    transitions: [
      { from: 'idle', to: 'walk', when: 'moving' },
      { from: 'walk', to: 'idle', when: '!moving' },
    ],
  });

  animator.setCondition('moving', true);
  animator.update(0.016);
  assert.equal(animator.state, 'walk');

  animator.setCondition('moving', false);
  animator.update(0.016);
  assert.equal(animator.state, 'idle', 'a negated condition must be evaluated');
});

/* --------------------------------------------------- transforms: float hygiene */

test('a quarter turn produces an exact zero instead of float dust', () => {
  const t = createTransform();
  setPosition(t, 0, 0, 0);
  t.rotation = [0, Math.PI / 2, 0];
  t.scale = [2, 2, 2];
  t.dirty = true;
  updateWorldMatrices(t);
  assert.equal(t.local[0], 0, 'cos(PI/2) must not leak a 1e-16 into the matrix');
});
