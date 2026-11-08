/**
 * Scene manager unit tests — save and load through the memory adapter.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createEventBus, Events } from '../src/core/events.js';
import { createWorld } from '../src/core/ecs.js';
import {
  createMemoryAdapter,
  createSceneManager,
} from '../src/core/scene.js';
import { createRegistry } from '../src/core/serialization.js';

function makeManager() {
  const world = createWorld();
  const registry = createRegistry();
  registry.registerBuiltins();
  const bus = createEventBus();
  const storage = createMemoryAdapter();
  const manager = createSceneManager({ world, registry, bus, storage });
  return { world, registry, bus, storage, manager };
}

test('a scene is captured with the live world', () => {
  const { world, registry, manager } = makeManager();
  const entity = world.createEntity({ name: 'Crate', tags: ['static'] });
  world.addComponent(entity.id, 'mesh', { kind: 'box' });

  const doc = manager.capture('storage-yard');
  assert.equal(doc.format, 'v4-scene');
  assert.equal(doc.name, 'storage-yard');
  assert.equal(doc.entities.length, 1);
  assert.equal(manager.names.includes('storage-yard'), true);
  assert.equal(manager.current, null);
});

test('saving and loading through the memory adapter restores the scene', async () => {
  const { world, registry, manager, bus } = makeManager();
  const entity = world.createEntity({ name: 'Player', tags: ['player'] });
  const transform = registry.defaults('transform');
  transform.position = [0, 1, 0];
  world.addComponent(entity.id, 'transform', transform);
  world.addComponent(entity.id, 'player', { speed: 5 });

  await manager.save('level1');
  world.clear();
  assert.equal(world.entityCount, 0);

  const loaded = await manager.loadFromStorage('level1');
  assert.equal(loaded, 1);
  assert.equal(world.entityCount, 1);
  assert.equal(world.get(entity.id).name, 'Player');
  assert.equal(world.getComponent(entity.id, 'player').speed, 5);
  assert.equal(manager.current.name, 'level1');

  const saved = bus.history(Events.SCENE_SAVED);
  const loadedEvents = bus.history(Events.SCENE_LOADED);
  assert.equal(saved.length, 1);
  assert.equal(loadedEvents.length, 1);
  assert.equal(loadedEvents[0].payload.entities, 1);
});

test('the memory adapter lists what it holds', async () => {
  const { world, manager, storage } = makeManager();
  world.createEntity({ name: 'A' });
  await manager.save('one');
  world.clear();
  await manager.save('two');

  const names = await storage.list();
  assert.deepEqual(names.sort(), ['one', 'two']);
});

test('loading an unknown scene throws', () => {
  const { manager } = makeManager();
  assert.throws(() => manager.load('does-not-exist'), /unknown scene/);
});

test('loading a scene that is not in storage throws', async () => {
  const { manager } = makeManager();
  await assert.rejects(() => manager.loadFromStorage('missing'), /not found in storage/);
});

test('a scene manager without storage refuses to load from storage', async () => {
  const world = createWorld();
  const registry = createRegistry();
  const bus = createEventBus();
  const manager = createSceneManager({ world, registry, bus });
  await assert.rejects(() => manager.loadFromStorage('anything'), /no storage adapter/);
});

test('a faded load is applied by update, not immediately', () => {
  const { world, manager } = makeManager();
  world.createEntity({ name: 'Fade', tags: ['static'] });
  manager.capture('faded');

  const result = manager.load('faded', { fade: true, duration: 0.25 });
  assert.equal(result, null);
  assert.equal(manager.transitioning, true);

  const at = performance.now();
  assert.equal(manager.update(at), false);
  assert.equal(manager.update(at + 1000), true);
  assert.equal(manager.transitioning, false);
  assert.equal(world.entityCount, 1);
});
