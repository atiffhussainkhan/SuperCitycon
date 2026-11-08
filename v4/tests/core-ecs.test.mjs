/**
 * ECS unit tests — entity and component lifecycle, queries and removal.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Tags, createWorld } from '../src/core/ecs.js';

test('createWorld starts empty and allocates ids', () => {
  const world = createWorld();
  assert.equal(world.entityCount, 0);

  const a = world.createEntity({ name: 'A' });
  const b = world.createEntity({ name: 'B' });
  assert.equal(world.entityCount, 2);
  assert.notEqual(a.id, b.id);
  assert.equal(a.enabled, true);
});

test('an entity can be created with an explicit id and with tags', () => {
  const world = createWorld();
  const entity = world.createEntity({ name: 'Player', tags: ['player', Tags.INTERACTIVE], id: 42 });
  assert.equal(entity.id, 42);
  assert.equal(entity.tags.has('player'), true);
  assert.equal(entity.tags.has(Tags.INTERACTIVE), true);
  assert.equal(world.get(42).name, 'Player');
});

test('components can be added, read, replaced and removed', () => {
  const world = createWorld();
  const entity = world.createEntity({ name: 'Box' });

  assert.equal(world.addComponent(entity.id, 'mesh', { kind: 'box' }).kind, 'box');
  assert.equal(world.hasComponent(entity.id, 'mesh'), true);
  assert.equal(world.getComponent(entity.id, 'mesh').kind, 'box');

  world.addComponent(entity.id, 'mesh', { kind: 'sphere' });
  assert.equal(world.getComponent(entity.id, 'mesh').kind, 'sphere');

  assert.equal(world.removeComponent(entity.id, 'mesh'), true);
  assert.equal(world.removeComponent(entity.id, 'mesh'), false);
  assert.equal(world.hasComponent(entity.id, 'mesh'), false);
  assert.equal(world.getComponent(entity.id, 'mesh'), null);
});

test('components on a missing entity are refused, not crashed on', () => {
  const world = createWorld();
  assert.equal(world.addComponent(999, 'mesh', {}), null);
  assert.equal(world.getComponent(999, 'mesh'), null);
  assert.equal(world.hasComponent(999, 'mesh'), false);
  assert.equal(world.removeComponent(999, 'mesh'), false);
});

test('query filters by tag, by component type and by both', () => {
  const world = createWorld();
  const player = world.createEntity({ name: 'Player', tags: ['player'] });
  world.addComponent(player.id, 'transform', { position: [0, 0, 0] });
  const npc = world.createEntity({ name: 'Npc', tags: ['npc'] });
  world.addComponent(npc.id, 'transform', { position: [1, 0, 0] });
  world.addComponent(npc.id, 'npc', { behaviour: 'patrol' });

  // By tag.
  assert.equal(world.query('player').length, 1);
  assert.equal(world.query('player')[0].id, player.id);

  // By component type.
  assert.equal(world.query('transform').length, 2);
  assert.equal(world.query('npc').length, 1);

  // Both filters must match.
  assert.equal(world.query('npc', 'transform').length, 1);
  assert.equal(world.query('npc', 'physics').length, 0);
  assert.equal(world.query().length, 2);
});

test('components are found by type through hasComponent and getComponent', () => {
  const world = createWorld();
  const npc = world.createEntity({ name: 'Npc', tags: ['npc'] });
  world.addComponent(npc.id, 'npc', { behaviour: 'patrol', speed: 2.2 });

  assert.equal(world.hasComponent(npc.id, 'npc'), true);
  assert.equal(world.hasComponent(npc.id, 'physics'), false);
  assert.equal(world.getComponent(npc.id, 'npc').behaviour, 'patrol');
  assert.equal(world.getComponent(npc.id, 'physics'), null);
});

test('a disabled entity is left out of queries', () => {
  const world = createWorld();
  const entity = world.createEntity({ name: 'Hidden', tags: ['npc'] });
  entity.enabled = false;
  assert.equal(world.query('npc').length, 0);
  assert.equal(world.entityCount, 1);
});

test('removing an entity reports whether it existed', () => {
  const world = createWorld();
  const entity = world.createEntity({ name: 'Doomed' });
  assert.equal(world.removeEntity(entity.id), true);
  assert.equal(world.removeEntity(entity.id), false);
  assert.equal(world.get(entity.id), null);
  assert.equal(world.entityCount, 0);
});

test('add and remove listeners fire with the entity and the type', () => {
  const world = createWorld();
  const added = [];
  const removed = [];
  const offAdd = world.onAdd((entity, type) => added.push([entity.name, type]));
  const offRemove = world.onRemove((entity, type) => removed.push([entity.name, type]));

  const entity = world.createEntity({ name: 'Tree' });
  world.addComponent(entity.id, 'mesh', {});
  world.removeComponent(entity.id, 'mesh');
  world.removeEntity(entity.id);

  assert.deepEqual(added, [['Tree', null], ['Tree', 'mesh']]);
  assert.deepEqual(removed, [['Tree', 'mesh'], ['Tree', null]]);

  offAdd();
  offRemove();
  world.createEntity({ name: 'Quiet' });
  assert.equal(added.length, 2);
});

test('a throwing add-listener does not break entity creation', () => {
  const world = createWorld();
  const original = console.error;
  console.error = () => {};
  try {
    world.onAdd(() => { throw new Error('listener blew up'); });
    const entity = world.createEntity({ name: 'Survivor' });
    assert.equal(world.entityCount, 1);
    assert.equal(world.get(entity.id).name, 'Survivor');
  } finally {
    console.error = original;
  }
});

test('clear removes every entity', () => {
  const world = createWorld();
  world.createEntity({ name: 'A' });
  world.createEntity({ name: 'B' });
  world.clear();
  assert.equal(world.entityCount, 0);
});
