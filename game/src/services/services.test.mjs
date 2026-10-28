/**
 * services/services.test.mjs — the SRV unit tests.
 *
 * Run with:  node --test src/services/services.test.mjs
 *
 * These tests cover the pure coverage maths AND the SRV domain service:
 *   - the coverage falloff with distance
 *   - the coverage at the exact radius boundary
 *   - the city coverage weighted by the POPULATED cells only
 *   - capacity vs demand and the unmet demand
 *   - the radius growth per level
 *   - facility registration and removal
 *   - determinism
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GRID, CELL, TUNING, makeRng } from '../core/config.js';
import { createState, setState, state as liveState } from '../core/state.js';
import { EVENTS, on, off, once, emit } from '../core/events.js';

import {
  coverageAt, cityWideCoverage, capacityVsDemand, falloff, cellDistance,
  coverageMap, toCellList,
} from './coverage.js';
import {
  serviceCatalogue, serviceRadiusFor, facilityFor, serviceIdFor,
  installCatalogue, SERVICE_IDS,
} from './services.js';
import { createServices } from './index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A tiny bus that is the real event bus, so the events are the real ones. */
const bus = { on, off, once, emit };

/** A context with no renderer and no assets - the domain must survive that. */
function makeCtx(seed = 20261023) {
  const state = createState(seed);
  return {
    state,
    bus,
    config: { GRID, CELL, TUNING },
    rng: makeRng(seed),
    domains: {},
    assets: undefined,
    renderer: undefined,
    manifest: undefined,
  };
}

/** A placed building instance of a real catalogue entry. */
function instance(type, x, z, level = 1, id = 1) {
  return { id, type, defId: type, x, z, rot: 0, level, tier: level, cells: [{ x, z }] };
}

await installCatalogue();

// ---------------------------------------------------------------------------
// 1. The catalogue
// ---------------------------------------------------------------------------

test('the service catalogue covers the six dossier categories', () => {
  const ids = SERVICE_IDS;
  for (const required of ['police', 'fire', 'health', 'education', 'parks', 'waste']) {
    assert.ok(ids.includes(required), `the catalogue has a "${required}" service`);
  }
  assert.ok(serviceCatalogue().length >= 6, 'the catalogue has at least six entries');
});

test('a catalogue entry maps a building to its service', () => {
  assert.equal(serviceIdFor({ category: 'health' }), 'health');
  assert.equal(serviceIdFor({ category: 'health', serviceProvided: 'health' }), 'health');
  assert.equal(serviceIdFor({ category: 'education', serviceProvided: 'education.elementary' }), 'education');
  assert.equal(serviceIdFor({ category: 'commercial' }), null, 'a shop provides no service');
  assert.equal(serviceIdFor(null), null);
});

// ---------------------------------------------------------------------------
// 2. The radius ladder
// ---------------------------------------------------------------------------

test('the service radius grows by serviceRadiusPerLevel per level', () => {
  assert.equal(serviceRadiusFor(1), TUNING.baseServiceRadius);
  assert.equal(serviceRadiusFor(2), TUNING.baseServiceRadius + TUNING.serviceRadiusPerLevel);
  assert.equal(serviceRadiusFor(3), TUNING.baseServiceRadius + 2 * TUNING.serviceRadiusPerLevel);
  assert.equal(serviceRadiusFor(0), TUNING.baseServiceRadius, 'level 0 clamps to level 1');
  assert.equal(serviceRadiusFor(1), 32);
  assert.equal(serviceRadiusFor(3), 48);
});

test('a catalogue entry without its own profile uses the SRV ladder', () => {
  const facility = facilityFor(instance('eng.solar', 5, 5, 2));
  assert.ok(facility, 'a power plant is a facility');
  assert.equal(facility.service, 'energy');
  assert.equal(facility.radius, serviceRadiusFor(2));
});

// ---------------------------------------------------------------------------
// 3. The falloff
// ---------------------------------------------------------------------------

test('the coverage falls off with the distance from the facility', () => {
  const facilities = [{ id: 1, service: 'health', x: 10, z: 10, level: 1, radius: 32 }];
  assert.equal(coverageAt(facilities, 10, 10, 32), 1, 'the facility cell is fully covered');
  assert.equal(coverageAt(facilities, 11, 10, 32), 1 - CELL / 32, 'one cell away is nearly covered');
  assert.equal(coverageAt(facilities, 12, 10, 32), 1 - (2 * CELL) / 32);
  assert.ok(
    coverageAt(facilities, 11, 10, 32) > coverageAt(facilities, 14, 10, 32),
    'the coverage decreases with the distance',
  );
});

test('the coverage is zero at the exact radius boundary and beyond', () => {
  const radius = 32;
  const facilities = [{ id: 1, service: 'health', x: 10, z: 10, level: 1, radius }];
  const atBoundary = 10 + radius / CELL; // 8 cells = 32 world units
  assert.equal(coverageAt(facilities, atBoundary, 10, radius), 0, 'the boundary cell is not covered');
  assert.equal(coverageAt(facilities, atBoundary + 1, 10, radius), 0, 'nothing beyond the radius is covered');
  assert.ok(coverageAt(facilities, atBoundary - 1, 10, radius) > 0, 'the cell inside the radius is covered');
  assert.equal(falloff(radius, radius), 0);
  assert.equal(falloff(radius - 0.001, radius) > 0, true);
});

test('the distance between two cells is measured in world units', () => {
  assert.equal(cellDistance(10, 10, 10, 10), 0);
  assert.equal(cellDistance(10, 10, 11, 10), CELL);
  assert.equal(Math.round(cellDistance(10, 10, 13, 14)), Math.round(Math.hypot(3 * CELL, 4 * CELL)));
});

test('overlapping facilities do not add up past one', () => {
  const facilities = [
    { id: 1, service: 'health', x: 10, z: 10, level: 1, radius: 32 },
    { id: 2, service: 'health', x: 11, z: 10, level: 1, radius: 32 },
  ];
  const w = coverageAt(facilities, 10, 10, 32);
  assert.ok(w <= 1, 'the coverage never exceeds 1');
  assert.equal(w, 1, 'the best provider wins');
});

// ---------------------------------------------------------------------------
// 4. The city-wide coverage
// ---------------------------------------------------------------------------

test('the city coverage is weighted by the populated cells only', () => {
  const facilities = [{ id: 1, service: 'health', x: 10, z: 10, level: 1, radius: 32 }];
  const covered = [{ x: 10, z: 10 }];
  const uncovered = [{ x: 40, z: 40 }];
  assert.equal(cityWideCoverage(facilities, covered, 32), 1, 'the populated cell is covered');
  assert.equal(cityWideCoverage(facilities, uncovered, 32), 0, 'the populated cell is not covered');
  assert.equal(
    cityWideCoverage(facilities, [...covered, ...uncovered], 32),
    0.5,
    'one covered and one uncovered populated cell averages to one half',
  );
});

test('an empty grid is covered by nothing meaningful', () => {
  const facilities = [{ id: 1, service: 'health', x: 10, z: 10, level: 1, radius: 32 }];
  assert.equal(cityWideCoverage(facilities, [], 32), 0, 'no populated cells means no coverage');
  assert.equal(cityWideCoverage(facilities, undefined, 32), 0);
  assert.equal(cityWideCoverage([], [{ x: 10, z: 10 }], 32), 0, 'no facilities means no coverage');
});

test('the populated cell list accepts cells, pairs and cell keys', () => {
  const cells = toCellList([{ x: 3, z: 4 }, [5, 6], 7 * GRID.size + 8]);
  assert.equal(cells.length, 3);
  assert.deepEqual(cells[0], { x: 3, z: 4 });
  assert.deepEqual(cells[1], { x: 5, z: 6 });
  assert.deepEqual(cells[2], { x: 7, z: 8 });
});

// ---------------------------------------------------------------------------
// 5. Capacity vs demand
// ---------------------------------------------------------------------------

test('the capacity of a facility is householdsPerService per level', () => {
  const facilities = [
    { id: 1, service: 'health', x: 1, z: 1, level: 1 },
    { id: 2, service: 'health', x: 2, z: 1, level: 2 },
  ];
  const result = capacityVsDemand(facilities, 100, TUNING.householdsPerService);
  assert.equal(result.capacity, TUNING.householdsPerService * 3);
  assert.equal(result.demand, 100);
  assert.equal(result.served, TUNING.householdsPerService * 3, 'the capacity is all that can be served');
  assert.equal(result.unmet, 100 - TUNING.householdsPerService * 3);
});

test('the unmet demand is the demand beyond the capacity', () => {
  const facilities = [{ id: 1, service: 'health', x: 1, z: 1, level: 1 }];
  const result = capacityVsDemand(facilities, 100, TUNING.householdsPerService);
  assert.equal(result.capacity, 24);
  assert.equal(result.served, 24, 'only the capacity is served');
  assert.equal(result.unmet, 76);
  assert.equal(capacityVsDemand(facilities, 0, TUNING.householdsPerService).unmet, 0);
});

test("a facility's own capacity wins over the generic ladder", () => {
  const facilities = [{ id: 1, service: 'health', x: 1, z: 1, level: 1, capacity: 400 }];
  assert.equal(capacityVsDemand(facilities, 100, TUNING.householdsPerService).capacity, 400);
});

// ---------------------------------------------------------------------------
// 6. The facility rules
// ---------------------------------------------------------------------------

test('a facility is derived from a service building', () => {
  const facility = facilityFor(instance('hea.hospital', 12, 14, 2, 7));
  assert.ok(facility, 'a hospital is a facility');
  assert.equal(facility.id, 7);
  assert.equal(facility.type, 'hea.hospital');
  assert.equal(facility.service, 'health');
  assert.equal(facility.x, 12);
  assert.equal(facility.z, 14);
  assert.equal(facility.level, 2);
  assert.ok(facility.radius > 0, 'a facility carries a radius');
});

test('a building that provides no service is not a facility', () => {
  assert.equal(facilityFor(instance('res.house', 1, 1)), null);
  assert.equal(facilityFor(null), null);
});

// ---------------------------------------------------------------------------
// 7. The domain service
// ---------------------------------------------------------------------------

test('the domain registers a facility and covers its cell', async () => {
  const ctx = makeCtx();
  // One resident, so that the city has a populated cell to weigh.
  ctx.state.buildings.instances.set(1, instance('res.house', 20, 20, 1, 1));
  const srv = createServices(ctx);
  await srv.init();

  srv.registerFacility({ id: 1, type: 'hea.hospital', x: 20, z: 20, level: 1 });
  srv.refresh();

  assert.equal(srv.coverageFor('health', 20, 20), 1, 'the facility cell is covered');
  assert.ok(srv.coverageFor('health', 21, 20) > 0, 'the neighbour cell is partly covered');
  assert.equal(srv.coverageFor('health', 40, 40), 0, 'a far cell is not covered');
  assert.ok(srv.cityCoverage('health') > 0, 'the city coverage rose');
  srv.dispose();
});

test('the city coverage only counts the populated cells', async () => {
  const ctx = makeCtx();
  // A residential building makes one populated cell, right next to the clinic.
  ctx.state.buildings.instances.set(1, instance('res.house', 20, 20, 1, 1));
  ctx.state.buildings.instances.set(2, instance('hea.hospital', 20, 21, 1, 2));

  const srv = createServices(ctx);
  await srv.init();
  srv.refresh();

  assert.ok(srv.cityCoverage('health') > 0, 'the populated cell next to the clinic is covered');
  const withHouse = srv.cityCoverage('health');

  // Move the residents far away from the clinic: the coverage must fall.
  ctx.state.buildings.instances.set(1, instance('res.house', 50, 50, 1, 1));
  srv.refresh();
  const withoutHouse = srv.cityCoverage('health');
  assert.ok(withoutHouse < withHouse, 'the coverage drops when the residents move away');
  srv.dispose();
});

test('removing a facility removes its coverage', async () => {
  const ctx = makeCtx();
  ctx.state.buildings.instances.set(1, instance('res.house', 20, 20, 1, 1));
  const srv = createServices(ctx);
  await srv.init();

  srv.registerFacility({ id: 1, type: 'hea.hospital', x: 20, z: 20, level: 1 });
  srv.refresh();
  assert.ok(srv.cityCoverage('health') > 0);

  assert.equal(srv.removeFacility(1), true, 'the facility was removed');
  srv.refresh();
  assert.equal(srv.cityCoverage('health'), 0, 'the coverage is gone');
  assert.equal(srv.coverageFor('health', 20, 20), 0);
  assert.equal(srv.removeFacility(1), false, 'removing it twice does nothing');
  srv.dispose();
});

test('the availability reports the capacity, the demand and what is served', async () => {
  const ctx = makeCtx();
  ctx.state.population.households = 100;
  const srv = createServices(ctx);
  await srv.init();

  srv.registerFacility({ id: 1, type: 'hea.hospital', x: 20, z: 20, level: 1 });
  const availability = srv.availability('health');
  assert.equal(availability.demand, 100, 'every household needs the service');
  assert.ok(availability.capacity >= 24, 'the facility has capacity');
  assert.equal(availability.served, Math.min(availability.capacity, 100));
  assert.equal(srv.unmetDemand('health'), Math.max(0, 100 - availability.capacity));
  srv.dispose();
});

test('the coverage map is a map of maps and the city coverage is a plain object', async () => {
  const ctx = makeCtx();
  const srv = createServices(ctx);
  await srv.init();
  srv.registerFacility({ id: 1, type: 'hea.hospital', x: 20, z: 20, level: 1 });
  srv.refresh();

  assert.ok(ctx.state.services.coverage instanceof Map, 'the coverage is a Map');
  const health = ctx.state.services.coverage.get('health');
  assert.ok(health instanceof Map, 'each service holds a map of cells');
  assert.ok(health.get(20 * GRID.size + 20) > 0, 'the cell weight is published');
  assert.equal(typeof ctx.state.services.cityCoverage, 'object');
  assert.equal(typeof ctx.state.services.cityCoverage.health, 'number');
  assert.ok(Array.isArray(ctx.state.services.facilities), 'the facilities are published');
  srv.dispose();
});

test('the coverage change is announced when it moves materially', async () => {
  const ctx = makeCtx();
  ctx.state.buildings.instances.set(1, instance('res.house', 20, 20, 1, 1));
  const srv = createServices(ctx);
  await srv.init();

  let announced = 0;
  const un = on(EVENTS.COVERAGE_CHANGED, () => { announced += 1; });
  srv.registerFacility({ id: 1, type: 'hea.hospital', x: 20, z: 20, level: 1 });
  srv.refresh();
  un();
  assert.ok(announced >= 1, 'the coverage change was announced');

  // A tick that changes nothing must not announce anything.
  let quiet = 0;
  const un2 = on(EVENTS.COVERAGE_CHANGED, () => { quiet += 1; });
  srv.tick(0.1);
  srv.tick(0.1);
  un2();
  assert.equal(quiet, 0, 'an unchanged coverage is not announced again');
  srv.dispose();
});

// ---------------------------------------------------------------------------
// 8. Determinism
// ---------------------------------------------------------------------------

test('the same seed and the same actions produce the same coverage', async () => {
  const run = async () => {
    const ctx = makeCtx(4242);
    ctx.state.buildings.instances.set(1, instance('res.house', 20, 20, 1, 1));
    ctx.state.buildings.instances.set(2, instance('hea.hospital', 22, 20, 1, 2));
    ctx.state.buildings.instances.set(3, instance('pol.station', 24, 20, 2, 3));
    ctx.state.population.households = 40;
    const srv = createServices(ctx);
    await srv.init();
    srv.refresh();
    const snapshot = JSON.stringify({
      city: ctx.state.services.cityCoverage,
      health: srv.coverageFor('health', 21, 20),
      police: srv.coverageFor('police', 24, 20),
      availability: srv.availability('health'),
    });
    srv.dispose();
    return snapshot;
  };

  const a = await run();
  const b = await run();
  assert.equal(a, b, 'two identical runs agree exactly');
});

test('the coverage map of a facility matches the coverage function', () => {
  const facilities = [{ id: 1, service: 'health', x: 20, z: 20, level: 1, radius: 32 }];
  const map = coverageMap(facilities, 32);
  assert.equal(map.get(20 * GRID.size + 20), 1, 'the facility cell weighs one');
  assert.equal(map.get(28 * GRID.size + 20), undefined, 'the boundary cell is not in the map');
  assert.equal(coverageAt(facilities, 21, 20, 32), map.get(21 * GRID.size + 20), 'both agree');
});

// ---------------------------------------------------------------------------
// 9. The dossier's special cases
// ---------------------------------------------------------------------------

test('the coverage is anchored to the footprint, not to the clicked cell', async () => {
  const ctx = makeCtx();
  const srv = createServices(ctx);
  await srv.init();

  // A 2x2 hospital: the coverage volume is centred on the whole footprint.
  const facility = facilityFor({
    id: 1, type: 'hea.hospital', x: 20, z: 20, level: 1,
    cells: [{ x: 20, z: 20 }, { x: 21, z: 20 }, { x: 20, z: 21 }, { x: 21, z: 21 }],
  });
  assert.equal(facility.x, 20.5, 'the anchor is the centre of the footprint');
  assert.equal(facility.z, 20.5);

  srv.registerFacility(facility);
  srv.refresh();
  assert.ok(srv.coverageFor('health', 20, 20) < 1, 'the clicked cell is not the centre');
  assert.ok(srv.coverageFor('health', 20, 20) > 0.9, 'but it is still well covered');
  srv.dispose();
});

test('parks are points, not a coverage circle', async () => {
  const ctx = makeCtx();
  ctx.state.buildings.instances.set(1, instance('res.house', 20, 20, 1, 1));
  const srv = createServices(ctx);
  await srv.init();

  srv.registerFacility({ id: 2, type: 'prk.park', x: 20, z: 20, level: 1 });
  srv.refresh();

  assert.equal(srv.cityCoverage('parks'), 0, 'no parks coverage circle');
  assert.equal(srv.coverageFor('parks', 20, 20), 0);
  assert.equal(srv.facilities().filter((f) => f.service === 'parks').length, 1, 'the park is still a facility');
  srv.dispose();
});

test('the coverage solver is dormant in the construction sandbox', async () => {
  const ctx = makeCtx();
  ctx.state.meta.mode = 'sandbox';
  ctx.state.buildings.instances.set(1, instance('res.house', 20, 20, 1, 1));
  const srv = createServices(ctx);
  await srv.init();

  srv.registerFacility({ id: 2, type: 'hea.hospital', x: 20, z: 20, level: 1 });
  srv.refresh();
  assert.equal(srv.coverageFor('health', 20, 20), 0, 'no coverage simulation in the sandbox');
  assert.equal(srv.cityCoverage('health'), 0);

  ctx.state.meta.mode = 'play';
  srv.refresh();
  assert.equal(srv.coverageFor('health', 20, 20), 1, 'the solver wakes up again');
  srv.dispose();
});


test('the domain survives the state tree being replaced (the load path)', async () => {
  // main.js builds ctx.state as a GETTER and core/state.js `setState()`
  // REPLACES the tree: a domain that captured ctx.state would keep writing
  // its coverage into an orphaned object.
  const ctx = {
    get state() { return liveState; },
    bus,
    config: { GRID, CELL, TUNING },
    rng: makeRng(7),
    domains: {},
    assets: undefined,
    renderer: undefined,
  };
  const srv = createServices(ctx);
  await srv.init();

  setState(createState(7));
  const fresh = liveState;
  fresh.buildings.instances.set(1, instance('res.house', 20, 20, 1, 1));
  fresh.buildings.instances.set(2, instance('hea.hospital', 20, 21, 1, 2));
  srv.refresh();

  assert.ok(fresh.services.cityCoverage.health > 0, 'the LIVE tree carries the coverage');
  assert.ok(srv.coverageFor('health', 20, 21) > 0, 'the domain reads the live tree');
  assert.ok(Array.isArray(fresh.services.facilities), 'the facilities are live too');
  srv.dispose();
});
