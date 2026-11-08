/**
 * Serialisation unit tests — the scene round-trip and unknown component
 * types.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorld } from '../src/core/ecs.js';
import {
  createRegistry,
  deserializeScene,
  serializeScene,
} from '../src/core/serialization.js';

function makeRegistry() {
  const registry = createRegistry();
  registry.registerBuiltins();
  return registry;
}

function makeWorld() {
  const world = createWorld();
  const registry = makeRegistry();

  const player = world.createEntity({ name: 'Player', tags: ['player'] });
  world.addComponent(player.id, 'transform', { position: [1, 2, 3], rotation: [0, 0, 0], scale: [1, 1, 1] });
  world.addComponent(player.id, 'mesh', { kind: 'capsule', size: [0.6, 1.8, 0.6] });
  world.addComponent(player.id, 'health', { current: 80, max: 100 });

  const lamp = world.createEntity({ name: 'Lamp', tags: ['light', 'static'] });
  world.addComponent(lamp.id, 'light', { type: 'point', intensity: 0.8 });

  return { world, registry, player, lamp };
}

test('serializeScene produces a v4-scene document', () => {
  const { world, registry, player } = makeWorld();
  const doc = serializeScene(world, registry, 'Level 1');

  assert.equal(doc.format, 'v4-scene');
  assert.equal(doc.version, 1);
  assert.equal(doc.name, 'Level 1');
  assert.equal(doc.entities.length, 2);
  assert.equal(typeof doc.createdAt, 'string');
  assert.equal(doc.entities[0].id, player.id);
  assert.deepEqual(doc.entities[0].tags, ['player']);
});

test('a scene round-trips through serialize and deserialize', () => {
  const { world, registry, player } = makeWorld();
  const doc = serializeScene(world, registry, 'RoundTrip');

  const target = createWorld();
  const loaded = deserializeScene(target, registry, doc);

  assert.equal(loaded, 2);
  assert.equal(target.entityCount, 2);

  const loadedPlayer = target.get(player.id);
  assert.equal(loadedPlayer.name, 'Player');
  assert.deepEqual([...player.tags], ['player']);
  assert.equal(player.components.has('mesh'), true);
  assert.equal(player.components.has('health'), true);
  assert.equal(player.components.has('light'), false);

  assert.deepEqual(target.getComponent(player.id, 'mesh'), { kind: 'capsule', size: [0.6, 1.8, 0.6] });
  assert.deepEqual(target.getComponent(player.id, 'health'), { current: 80, max: 100 });

  const transform = target.getComponent(player.id, 'transform');
  assert.deepEqual(transform.position, [1, 2, 3]);
  assert.deepEqual(transform.rotation, [0, 0, 0]);
  assert.deepEqual(transform.scale, [1, 1, 1]);
  assert.equal(transform.dirty, true);
});

test('deserializing twice into the same world replaces the contents', () => {
  const { world, registry } = makeWorld();
  const doc = serializeScene(world, registry, 'Twice');

  const target = createWorld();
  deserializeScene(target, registry, doc);
  deserializeScene(target, registry, doc);
  assert.equal(target.entityCount, 2);
});

test('unknown component types are skipped, not fatal', () => {
  const { world, registry, player } = makeWorld();
  const doc = serializeScene(world, registry, 'WithUnknown');
  doc.entities[0].components.quantumFlux = { value: 42 };
  doc.entities[0].components.legacyThing = { legacy: true };

  const target = createWorld();
  const loaded = deserializeScene(target, registry, doc);

  assert.equal(loaded, 2);
  const loadedPlayer = target.get(player.id);
  assert.equal(loadedPlayer.components.has('quantumFlux'), false);
  assert.equal(loadedPlayer.components.has('legacyThing'), false);
  assert.equal(loadedPlayer.components.size, 3);
});

test('a document that is not a v4 scene is rejected', () => {
  const registry = makeRegistry();
  const world = createWorld();
  assert.throws(() => deserializeScene(world, registry, { format: 'something-else' }), /not a V4 scene document/);
  assert.throws(() => deserializeScene(world, registry, null), /not a V4 scene document/);
});

test('the registry falls back to a plain JSON round-trip for plain data', () => {
  const registry = makeRegistry();
  const data = { a: 1, b: [1, 2, 3], c: { d: 'e' } };
  const raw = registry.serializeComponent('health', data);
  assert.deepEqual(raw, data);
  assert.deepEqual(registry.deserializeComponent('health', raw), data);
});

test('registry defaults give a fresh copy each time', () => {
  const registry = makeRegistry();
  const first = registry.defaults('inventory');
  first.slots.push('sword');
  const second = registry.defaults('inventory');
  assert.deepEqual(second.slots, []);
});

test('an unregistered type has no defaults and is not serialised', () => {
  const registry = makeRegistry();
  assert.equal(registry.has('nope'), false);
  assert.deepEqual(registry.defaults('nope'), {});
  assert.equal(registry.serializeComponent('nope', { a: 1 }), null);
});
