/**
 * MOB — mobility domain tests.
 *
 *   node --test src/mobility/mobility.test.mjs
 *
 * The tests run head-less: the renderer and the asset service are replaced
 * by tiny stubs, so no Three.js scene is created and no art is loaded.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createMobility } from './index.js';
import {
  buildNetwork, routeBetween, connectivityScore, networkReport, cellKey, parseCellKey,
} from './network.js';
import { spawnVehicles, stepVehicles, simulateTraffic, trafficStats, VEHICLE_MODEL_KEYS } from './traffic.js';
import { TUNING, makeRng } from '../core/config.js';
import { readFileSync } from 'node:fs';

/** The real manifest — every model key MOB uses has to exist in it. */
const MANIFEST = JSON.parse(
  readFileSync(new URL('../data/manifest.json', import.meta.url), 'utf8'),
);

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

function makeBus() {
  const listeners = new Map();
  return {
    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
      return () => listeners.get(evt)?.delete(fn);
    },
    off(evt, fn) { listeners.get(evt)?.delete(fn); return true; },
    once(evt, fn) { const off = this.on(evt, (p) => { off(); fn(p); }); return off; },
    emit(evt, payload) {
      const set = listeners.get(evt);
      if (!set) return 0;
      let delivered = 0;
      for (const fn of [...set]) { fn(payload); delivered += 1; }
      return delivered;
    },
  };
}

function fakeModel() {
  return {
    position: {
      x: 0, y: 0, z: 0,
      set(x, y, z) { this.x = x; this.y = y; this.z = z; },
    },
    rotation: { y: 0 },
    userData: {},
    parent: null,
    clone() { return fakeModel(); },
    dispose() {},
  };
}

function fakeGroup() {
  return {
    children: [],
    add(obj) { obj.parent = this; this.children.push(obj); },
    remove(obj) {
      const i = this.children.indexOf(obj);
      if (i >= 0) this.children.splice(i, 1);
      obj.parent = null;
    },
  };
}

function makeCtx(seed = 5) {
  const bus = makeBus();
  const state = { mobility: {}, buildings: { instances: new Map() }, meta: { seed, elapsed: 0 } };
  const loaded = [];
  return {
    state,
    bus,
    loaded,
    config: { TUNING, GRID: { size: 64 } },
    domains: {},
    renderer: {
      // Static content (the roads) lives in `world`, moving entities (the
      // cars) live in `actors` — exactly like the buildings domain does it.
      world: fakeGroup(),
      actors: fakeGroup(),
      cellCenter: (x, z) => ({ x: x * 4, y: 0, z: z * 4 }),
      cellCenterF: (x, z) => ({ x: x * 4, y: 0, z: z * 4 }),
    },
    assets: {
      manifest: MANIFEST,
      loadModel: (key) => {
        loaded.push(key);
        return Promise.resolve(fakeModel());
      },
    },
  };
}

/** Let the model-loading promises settle. */
const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

/** A straight line of road cells. */
function line(length, offsetX = 0, offsetZ = 0) {
  const cells = [];
  for (let i = 0; i < length; i += 1) cells.push({ x: offsetX + i, z: offsetZ });
  return cells;
}

/** A filled rectangle of road cells. */
function block(width, depth, offsetX = 0, offsetZ = 0) {
  const cells = [];
  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) cells.push({ x: offsetX + x, z: offsetZ + z });
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Network topology
// ---------------------------------------------------------------------------

test('the network records the adjacency of every road cell', () => {
  const net = buildNetwork(line(3));
  assert.equal(net.roadCount, 3);
  assert.equal(net.edges, 2, 'three cells in a row make two segments');
  assert.equal(net.nodes.get(cellKey(1, 0)).degree, 2);
  assert.deepEqual(
    net.nodes.get(cellKey(1, 0)).neighbors.sort(),
    [cellKey(0, 0), cellKey(2, 0)],
  );
  assert.equal(net.nodes.get(cellKey(0, 0)).degree, 1);
  assert.equal(net.nodes.get(cellKey(0, 0)).kind, 'end', 'a terminating segment is an end node');
  assert.equal(net.nodes.get(cellKey(1, 0)).kind, 'straight');
});

test('the network splits into connected components', () => {
  const net = buildNetwork([...line(3), ...line(2, 10, 10)]);
  assert.equal(net.components.length, 2);
  const sizes = net.components.map((c) => c.size).sort((a, b) => a - b);
  assert.deepEqual(sizes, [2, 3]);
  assert.equal(net.componentOf.get(cellKey(0, 0)), net.componentOf.get(cellKey(2, 0)));
  assert.notEqual(net.componentOf.get(cellKey(0, 0)), net.componentOf.get(cellKey(10, 10)));
});

test('an isolated road cell is detected', () => {
  const net = buildNetwork([...line(2), { x: 9, z: 9 }]);
  assert.deepEqual(net.isolated, [cellKey(9, 9)]);
  assert.equal(net.nodes.get(cellKey(9, 9)).kind, 'isolated');
  assert.equal(net.nodes.get(cellKey(9, 9)).degree, 0);
});

test('the connectivity score is the share of the largest component', () => {
  const net = buildNetwork([...line(3), { x: 9, z: 9 }]);
  assert.equal(connectivityScore(net), 0.75);
  assert.equal(connectivityScore(buildNetwork([])), 0);
  const report = networkReport(net);
  assert.equal(report.roadCount, 4);
  assert.equal(report.isolatedCount, 1);
});

test('the shortest path is the shortest one (BFS)', () => {
  const net = buildNetwork([...line(5), { x: 2, z: 1 }, { x: 2, z: 2 }]);
  const path = routeBetween(net, cellKey(0, 0), cellKey(4, 0));
  assert.deepEqual(path, [0, 1, 2, 3, 4].map((i) => cellKey(i, 0)));
  assert.deepEqual(routeBetween(net, { x: 0, z: 0 }, { x: 4, z: 0 }), path);
  assert.deepEqual(routeBetween(net, cellKey(0, 0), cellKey(0, 0)), [cellKey(0, 0)]);
  assert.equal(routeBetween(net, cellKey(0, 0), cellKey(20, 20)), null, 'no path across components');
  assert.equal(routeBetween(net, cellKey(0, 0), cellKey(99, 99)), null, 'an unknown cell has no path');
});

test('a corner cell is detected as a corner node', () => {
  const net = buildNetwork([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }]);
  assert.equal(net.nodes.get(cellKey(1, 0)).kind, 'corner');
  assert.equal(net.nodes.get(cellKey(0, 0)).kind, 'end');
});

test('cell keys round-trip', () => {
  assert.equal(cellKey(3, 7), 3 * 64 + 7, 'the shared numeric cell key');
  assert.deepEqual(parseCellKey(cellKey(3, 7)), { x: 3, z: 7 });
  assert.equal(parseCellKey('nonsense'), null);
});

// ---------------------------------------------------------------------------
// Traffic simulation
// ---------------------------------------------------------------------------

test('the same seed and the same layout give the same traffic (determinism)', () => {
  const net = buildNetwork(block(6, 6));
  const a = simulateTraffic(net, { count: 12, seed: 4242, seconds: 6, dt: 0.1 });
  const b = simulateTraffic(net, { count: 12, seed: 4242, seconds: 6, dt: 0.1 });
  assert.equal(a.vehicles.length, b.vehicles.length);
  assert.deepEqual(
    a.vehicles.map((v) => [v.id, v.model, v.cell, v.x, v.z]),
    b.vehicles.map((v) => [v.id, v.model, v.cell, v.x, v.z]),
  );
  assert.equal(a.congestion, b.congestion);
  assert.equal(a.averageCommute, b.averageCommute);
});

test('vehicles use the library car models only', () => {
  const net = buildNetwork(block(6, 6));
  const vehicles = spawnVehicles(net, 20, makeRng(1));
  assert.ok(vehicles.length > 0);
  for (const vehicle of vehicles) {
    assert.ok(VEHICLE_MODEL_KEYS.includes(vehicle.model), `${vehicle.model} is a library model`);
  }
});

test('congestion rises with the vehicles per cell', () => {
  const small = buildNetwork(block(3, 4));
  const large = buildNetwork(block(10, 12));
  const busy = simulateTraffic(small, { count: 60, seed: 11, seconds: 2, dt: 0.1 });
  const calm = simulateTraffic(large, { count: 60, seed: 11, seconds: 2, dt: 0.1 });

  assert.ok(busy.congestion > 0.5, `a crowded network is congested (${busy.congestion})`);
  assert.ok(
    busy.congestion > calm.congestion,
    'the same traffic on a bigger network is less congested',
  );
  assert.ok(busy.congestion <= 1, 'congestion never exceeds 1');
  assert.ok(busy.jam >= busy.congestion, 'the worst cell is at least as busy as the average');
});

test('the average commute is the traversed path length divided by the speed', () => {
  const net = buildNetwork(line(10));
  const stats = trafficStats(net, [
    { tripCells: 10, elapsed: 0, covered: 0, cell: cellKey(0, 0), path: [] },
    { tripCells: 20, elapsed: 0, covered: 0, cell: cellKey(0, 0), path: [] },
  ]);
  // baseSpeed = 1 / TUNING.secondsPerCell, so a cell costs secondsPerCell
  assert.equal(stats.averageCommute, 15 * TUNING.secondsPerCell);
  assert.equal(stats.averageTripCells, 15);

  // The travelled length wins over the remaining one: a vehicle that has
  // already covered half of its trip still reports the whole commute.
  const midway = trafficStats(net, [{
    tripCells: 4,
    tripLength: 10,
    elapsed: 0,
    covered: 6,
    progress: 0,
    cell: cellKey(0, 0),
    path: [],
  }]);
  assert.equal(midway.averageCommute, 10 * TUNING.secondsPerCell);
  assert.equal(midway.averageTripCells, 10);
});

test('a longer road network means a longer commute', () => {
  const shortNet = buildNetwork(line(6));
  const longNet = buildNetwork(line(40));
  const shortRun = simulateTraffic(shortNet, { count: 20, seed: 77, seconds: 1, dt: 0.1 });
  const longRun = simulateTraffic(longNet, { count: 20, seed: 77, seconds: 1, dt: 0.1 });

  assert.ok(
    longRun.averageTripCells > shortRun.averageTripCells,
    `the long network has the longer trips (${longRun.averageTripCells} > ${shortRun.averageTripCells})`,
  );
  assert.ok(longRun.averageCommute > shortRun.averageCommute);
});

test('vehicles stay within the spawn bounds', () => {
  const net = buildNetwork(block(6, 6));
  const run = simulateTraffic(net, { count: 15, seed: 3, seconds: 30, dt: 0.1 });
  assert.ok(run.vehicles.length <= 15, 'the vehicle count never exceeds the target');
  assert.ok(run.vehicles.length >= 0);
  for (const vehicle of run.vehicles) {
    assert.equal(vehicle.arrived, false, 'a finished vehicle is removed from the world');
    assert.ok(net.nodes.has(vehicle.cell), 'a vehicle is always on a road');
  }
});

test('a vehicle drives along the road, never off it', () => {
  const net = buildNetwork(line(12));
  const rng = makeRng(9);
  let vehicles = spawnVehicles(net, 1, rng);
  assert.ok(vehicles.length > 0, 'a vehicle was spawned');
  const start = vehicles[0].cell;
  vehicles = stepVehicles(vehicles, net, 0.5);
  const vehicle = vehicles[0];
  assert.ok(net.nodes.has(vehicle.cell), 'the vehicle is still on a road');
  assert.ok(vehicle.progress >= 0 && vehicle.progress < 1);
  assert.ok(Number.isFinite(vehicle.x) && Number.isFinite(vehicle.z));
  assert.ok(vehicle.covered + (vehicle.path.length ? 1 : 0) >= 0);
  assert.ok(start !== null);
});

test('stepping does not mutate the vehicles it is given', () => {
  const net = buildNetwork(line(8));
  const vehicles = spawnVehicles(net, 3, makeRng(21));
  const before = JSON.stringify(vehicles);
  stepVehicles(vehicles, net, 0.5);
  assert.equal(JSON.stringify(vehicles), before, 'the input array is untouched');
});

// ---------------------------------------------------------------------------
// The domain service
// ---------------------------------------------------------------------------

test('a placed road joins the network and publishes a change', () => {
  const ctx = makeCtx();
  const mob = createMobility(ctx);
  mob.init();

  let changes = 0;
  ctx.bus.on('mobility:network', () => { changes += 1; });

  const added = mob.addRoad(4, 4);
  assert.equal(added.ok, true);
  assert.equal(mob.network().roadCount, 1);
  assert.ok(changes > 0, 'ROAD_NETWORK_CHANGED was published');

  const road = mob.roadAt(4, 4);
  assert.ok(road, 'the road is at the cell');
  assert.equal(road.x, 4);
  assert.equal(mob.roadAt(5, 5), null, 'there is no road on an empty cell');

  const again = mob.addRoad(4, 4);
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'already-a-road');

  const outside = mob.addRoad(999, 999);
  assert.equal(outside.ok, false);
  assert.equal(outside.reason, 'out-of-bounds');

  const removed = mob.removeRoad(4, 4);
  assert.equal(removed.ok, true);
  assert.equal(mob.network().roadCount, 0);
  assert.equal(mob.roadAt(4, 4), null);

  mob.dispose();
});

test('the domain traffic count follows the density setting', () => {
  const ctx = makeCtx();
  const mob = createMobility(ctx);
  mob.init();

  for (let i = 0; i < 8; i += 1) mob.addRoad(i, 0);
  mob.setDensity(6);
  assert.equal(mob.targetVehicleCount(), 6);
  assert.equal(mob.vehicleCount(), 6);

  mob.setDensity(2);
  assert.equal(mob.vehicleCount(), 2, 'the extra vehicles are retired');

  const bad = mob.setDensity(-3);
  assert.equal(bad.ok, false);

  mob.dispose();
});

test('ticking the domain advances the traffic and publishes the statistics', () => {
  const ctx = makeCtx();
  const mob = createMobility(ctx);
  mob.init();

  for (let i = 0; i < 8; i += 1) mob.addRoad(i, 0);

  let published = null;
  ctx.bus.on('mobility:traffic', (payload) => { published = payload; });

  const before = mob.vehicles().map((v) => `${v.x},${v.z}`).join('|');
  mob.tick(1.5);
  const after = mob.vehicles().map((v) => `${v.x},${v.z}`).join('|');

  assert.notEqual(before, after, 'the vehicles moved');
  assert.ok(published, 'TRAFFIC_CHANGED was published');
  assert.equal(published.vehicleCount, mob.vehicleCount());
  assert.ok(published.congestion >= 0 && published.congestion <= 1);
  assert.ok(mob.averageCommute() >= 0);

  mob.dispose();
});

test('the domain reports the transport statistics', () => {
  const ctx = makeCtx();
  const mob = createMobility(ctx);
  mob.init();
  for (let i = 0; i < 6; i += 1) mob.addRoad(i, 0);
  mob.addRoad(3, 1);

  const report = mob.report();
  assert.equal(report.roadCount, 7);
  assert.equal(report.edges, 6);
  assert.equal(report.componentCount, 1);
  assert.equal(report.connectivity, 1);
  assert.equal(report.commuteTolerance, TUNING.commuteTolerance);
  assert.ok(Array.isArray(report.models));
  assert.equal(report.models.length, VEHICLE_MODEL_KEYS.length);

  mob.dispose();
});

test('the buildings domain finds the roads MOB published', async () => {
  // The buildings domain reads the network with the shared numeric cell key
  // (`core/state.js:cellKey`). If MOB published a different key format the
  // building-road-connection rule (FR-MOB-032) would silently never fire.
  const { roadAt } = await import('../buildings/placement.js');
  const ctx = makeCtx();
  const mob = createMobility(ctx);
  mob.init();
  mob.addRoad(4, 4);

  assert.equal(roadAt(ctx.state, 4, 4), true, 'the buildings domain sees the road');
  assert.equal(roadAt(ctx.state, 5, 5), false, 'and only the road');

  mob.dispose();
});

test('the commute is the length of the trip, not of the road left', () => {
  const net = buildNetwork(line(20));
  const rng = makeRng(31);
  let vehicles = spawnVehicles(net, 1, rng);
  assert.ok(vehicles.length > 0);
  const planned = vehicles[0].tripLength;
  assert.ok(planned > 0);

  vehicles = stepVehicles(vehicles, net, 2.0);
  const vehicle = vehicles[0];
  assert.equal(vehicle.tripLength, planned, 'the planned trip never shrinks');
  assert.ok(vehicle.tripCells <= planned, 'the remaining cells shrink');

  const stats = trafficStats(net, vehicles);
  assert.equal(
    stats.averageCommute,
    planned * TUNING.secondsPerCell,
    'the commute is the free-flow time of the whole trip',
  );
});

test('a large tick still walks the whole distance', () => {
  const net = buildNetwork(line(40));
  const rng = makeRng(17);
  let vehicles = spawnVehicles(net, 1, rng);
  const start = vehicles[0].cell;

  // 10 s at 1 cell per 2.2 s is about four cells.
  vehicles = stepVehicles(vehicles, net, 10);
  const moved = vehicles[0].covered;
  assert.ok(moved >= 3, `the vehicle covered several cells (${moved})`);
  assert.notEqual(vehicles[0].cell, start);
  assert.ok(net.nodes.has(vehicles[0].cell));
});

test('a placed road puts a real library model into the world group', async () => {
  const ctx = makeCtx();
  const mob = createMobility(ctx);
  mob.init();

  assert.equal(ctx.renderer.world.children.length, 0, 'nothing is in the world yet');

  mob.addRoad(4, 4);
  await flush();

  assert.equal(ctx.renderer.world.children.length, 1, 'the road model is in the world group');
  assert.equal(ctx.renderer.actors.children.length, 0, 'a road is not a moving entity');

  const model = ctx.renderer.world.children[0];
  assert.equal(model.userData.mobilityStatic, 'road_straight');
  assert.ok(MANIFEST.models[model.userData.mobilityStatic], 'the model key exists in the manifest');
  assert.ok(ctx.loaded.includes('road_straight'), 'the key was loaded from the asset service');

  // 100 road cells must not become 100 loads: the model is cached and
  // cloned for every tile.
  for (let i = 5; i < 15; i += 1) mob.addRoad(i, 4);
  await flush();
  const roadTiles = ctx.renderer.world.children.filter((m) => m.userData.mobilityStatic.startsWith('road_'));
  assert.equal(roadTiles.length, 11, 'eleven road tiles are in the world');
  assert.equal(
    ctx.loaded.filter((key) => key === 'road_straight').length,
    1,
    'the road model is loaded once and cloned',
  );

  mob.dispose();
});

test('a demolished road removes its model again', async () => {
  const ctx = makeCtx();
  const mob = createMobility(ctx);
  mob.init();

  mob.addRoad(4, 4);
  await flush();
  assert.equal(ctx.renderer.world.children.length, 1);

  mob.removeRoad(4, 4);
  await flush();
  assert.equal(ctx.renderer.world.children.length, 0, 'the model is gone from the world');

  mob.dispose();
});

test('the road model follows the shape of the junction', async () => {
  const ctx = makeCtx();
  const mob = createMobility(ctx);
  mob.init();

  mob.addRoad(4, 4);
  mob.addRoad(5, 4);
  await flush();
  const straight = ctx.renderer.world.children.map((m) => m.userData.mobilityStatic);
  assert.ok(straight.includes('road_straight'));

  // A third arm turns the corner into a T-split and the art is replaced.
  mob.addRoad(5, 5);
  mob.addRoad(6, 4);
  await flush();
  const models = ctx.renderer.world.children.map((m) => m.userData.mobilityStatic);
  assert.ok(models.includes('road_tsplit'), 'the T-split tile is used');
  const roadModels = ctx.renderer.world.children.filter((m) => m.userData.mobilityStatic.startsWith('road_'));
  assert.equal(roadModels.length, 4, 'one road tile per road cell — no stale tile');
  const junction = ctx.renderer.world.children.find((m) => m.userData.mobilityTag === `road:${cellKey(5, 4)}`);
  assert.equal(junction.userData.mobilityStatic, 'road_tsplit');
  for (const key of models) assert.ok(MANIFEST.models[key], `${key} is a manifest key`);

  mob.dispose();
});

test('a road and a car sit on the terrain, not at sea level', async () => {
  const ctx = makeCtx();
  // The WORLD domain owns the terrain and publishes `heightAt` on its service.
  ctx.domains.wld = { heightAt: (x, z) => 4.5 + (x + z) * 0.5 };
  const mob = createMobility(ctx);
  mob.init();

  mob.addRoad(4, 4);
  for (let i = 0; i < 6; i += 1) mob.addRoad(i, 0);
  mob.setDensity(2);
  await flush();

  const road = ctx.renderer.world.children.find((m) => m.userData.mobilityTag === `road:${cellKey(4, 4)}`);
  assert.ok(road, 'the road model exists');
  assert.equal(road.position.y, 4.5 + (4 + 4) * 0.5, 'the road sits on the terrain');

  for (const car of ctx.renderer.actors.children) {
    assert.ok(car.position.y > 0, 'a car is not buried under the terrain');
  }

  mob.dispose();
});

test('the vehicles are real library models in the actors group', async () => {
  const ctx = makeCtx();
  const mob = createMobility(ctx);
  mob.init();
  for (let i = 0; i < 8; i += 1) mob.addRoad(i, 0);
  mob.setDensity(4);
  await flush();

  assert.equal(ctx.renderer.actors.children.length, 4, 'four cars are in the actors group');
  const keys = ctx.renderer.actors.children.map((m) => m.userData.vehicleModel);
  for (const key of keys) {
    assert.ok(VEHICLE_MODEL_KEYS.includes(key), `${key} is a car model`);
    assert.ok(MANIFEST.models[key], `${key} exists in the manifest`);
  }
  // The cars sit on the road, on the ground.
  const car = ctx.renderer.actors.children[0];
  assert.ok(Number.isFinite(car.position.x) && Number.isFinite(car.position.z));
  assert.ok(Number.isFinite(car.position.y));

  mob.dispose();
});

test('a car follows the road graph in the scene', async () => {
  const ctx = makeCtx();
  const mob = createMobility(ctx);
  mob.init();
  for (let i = 0; i < 10; i += 1) mob.addRoad(i, 0);
  mob.setDensity(2);
  await flush();

  const before = ctx.renderer.actors.children.map((m) => ({ x: m.position.x, z: m.position.z }));
  mob.tick(2);
  await flush();
  const after = ctx.renderer.actors.children.map((m) => ({ x: m.position.x, z: m.position.z }));

  assert.notDeepEqual(before, after, 'the cars moved in the scene');
  for (const car of ctx.renderer.actors.children) {
    assert.ok(Number.isFinite(car.rotation.y), 'a car that moves has a heading');
  }

  mob.dispose();
});

test('a stale model load never overwrites a newer road shape', async () => {
  const ctx = makeCtx();
  // The first load resolves late, after the cell already became a T-split.
  let release = null;
  const pending = new Promise((resolve) => { release = resolve; });
  let call = 0;
  ctx.assets.loadModel = (key) => {
    call += 1;
    if (call === 1) return pending.then(() => fakeModel());
    return Promise.resolve(fakeModel());
  };
  const mob = createMobility(ctx);
  mob.init();

  mob.addRoad(4, 4);        // a straight tile, its model is still loading
  mob.addRoad(5, 4);
  mob.addRoad(5, 5);
  mob.addRoad(6, 4);        // the cell becomes a T-split in the meantime
  release();
  await flush();
  await flush();

  const junction = ctx.renderer.world.children.find((m) => m.userData.mobilityTag === `road:${cellKey(5, 4)}`);
  assert.ok(junction, 'the junction has a model');
  assert.equal(junction.userData.mobilityStatic, 'road_tsplit', 'the NEW shape owns the cell');

  mob.dispose();
});

test('the road art follows the shape of the junction', () => {
  const ctx = makeCtx();
  const mob = createMobility(ctx);
  mob.init();

  mob.addRoad(0, 0);
  mob.addRoad(1, 0);
  let props = mob.props();
  assert.equal(props[`road:${cellKey(1, 0)}`].key, 'road_straight', 'two cells in a row are straight');

  mob.addRoad(1, 1);
  props = mob.props();
  assert.equal(
    props[`road:${cellKey(1, 0)}`].key, 'road_corner_curved',
    'a corner replaces the straight',
  );
  assert.ok(MANIFEST.models.road_corner_curved, 'the rounded corner tile is a manifest key');

  mob.addRoad(0, 1);
  mob.addRoad(1, 2);
  props = mob.props();
  assert.equal(props[`road:${cellKey(1, 1)}`].key, 'road_tsplit', 'three arms make a T-split');

  mob.dispose();
});
