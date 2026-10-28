/**
 * MOB — pure traffic simulation.
 *
 * No Three.js, no DOM, no sibling-domain imports: the whole simulation is
 * plain data, so it is unit-testable in bare Node.
 *
 * WHAT THE PUBLISHER NEVER PUBLISHED
 * -----------------------------------
 * The shipped game's traffic model is undocumented (OQ-MOB-16, OQ-MOB-17,
 * OQ-MOB-25). Only four behaviours are evidenced: traffic moves along the
 * streets, cars are drivable, traffic advances on the simulation tick, and
 * there are four vehicle classes (cars, trains, ships, helicopters).
 *
 * The model below is therefore a DOCUMENTED REBUILD DECISION, not a
 * description of the shipped game:
 *
 *   1. A vehicle owns a route (a shortest path over the road graph) and
 *      walks it cell by cell. There is no lane layer and no junction
 *      movement set — both stay `Design`-stage in the dossier (OQ-MOB-11,
 *      OQ-MOB-13) and are NOT implemented here.
 *   2. A vehicle's speed falls as the cell ahead fills up:
 *      `speed = baseSpeed x max(minSpeedFactor, 1 - occupancy/vehiclesPerCell)`.
 *      `baseSpeed = 1 / TUNING.secondsPerCell`.
 *   3. Congestion is the network's vehicle load relative to the per-cell
 *      capacity: `congestion = (vehicles / roadCells) / TUNING.vehiclesPerCell`.
 *      The worst single cell is reported separately as `jam`.
 *   4. A vehicle that cannot enter its next cell HOLDS (it is never silently
 *      despawned, FR-MOB-081/082) and is re-routed after `stuckTimeout`.
 *   5. A vehicle that reaches its destination is removed and its slot is
 *      reused (FR-MOB-078, a design decision).
 *
 * Every constant that the publisher did not publish lives in `TRAFFIC_TBD`
 * below and is marked `// TBD:` with its proposed `TUNING` key.
 */

import { TUNING, makeRng } from '../core/config.js';
import { routeBetween, parseCellKey } from './network.js';

/**
 * The car models used for road traffic. Every key exists in
 * `data/manifest.json` (family `citybits`).
 */
export const VEHICLE_MODEL_KEYS = Object.freeze([
  'car_sedan',
  'car_hatchback',
  'car_taxi',
  'car_police',
  'car_stationwagon',
]);

/**
 * Constants the publisher never published.
 *
 * Proposed `TUNING` keys:
 *   mobility.minSpeedFactor   -> 0.15
 *   mobility.stuckTimeout     -> 8     (seconds)
 *   mobility.maxTripCells     -> 12    (the widest trip that is generated)
 */
export const TRAFFIC_TBD = Object.freeze({
  // TBD: the slowest a vehicle may crawl before it is considered blocked.
  minSpeedFactor: 0.15,
  // TBD: the congestion policy timeout (OQ-MOB-16).
  stuckTimeout: 8,
  // TBD: how far a generated trip may reach.
  maxTripCells: 12,
  // TBD: the publisher never specified how often the traffic statistics are
  // published. Proposed TUNING key: mobility.trafficEventInterval (0.5 s of
  // game time between two TRAFFIC_CHANGED events).
  trafficEventInterval: 0.5,
});

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** A deterministic 0..1 hash — used instead of Math.random so runs repeat. */
function hash32(n) {
  let x = n >>> 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function baseSpeed() {
  return 1 / Math.max(0.05, TUNING.secondsPerCell);
}

function perCellCapacity() {
  return Math.max(1, TUNING.vehiclesPerCell);
}

/**
 * Spawn vehicles on the network.
 *
 * Deterministic: the same network and the same RNG sequence always produce
 * the same vehicles, in the same places, with the same routes.
 *
 * @param {object} network the graph from `buildNetwork`
 * @param {number} count how many vehicles to create
 * @param {Function} rng a `makeRng` style generator
 * @param {object} [opts] { startId }
 * @returns {object[]} the vehicles
 */
export function spawnVehicles(network, count, rng, opts = {}) {
  const total = Math.max(0, Math.round(Number(count) || 0));
  if (!network?.nodes?.size || total === 0) return [];
  const random = typeof rng === 'function' ? rng : makeRng(1337);

  // Only cells with at least one neighbour can carry traffic.
  const candidates = [];
  for (const node of network.nodes.values()) {
    if (node.degree > 0) candidates.push(node.key);
  }
  if (!candidates.length) return [];

  // Keep a vehicle inside one connected component.
  const groups = new Map();
  for (const key of candidates) {
    const component = network.componentOf?.get(key) ?? 0;
    if (!groups.has(component)) groups.set(component, []);
    groups.get(component).push(key);
  }
  const pools = [...groups.values()];
  if (!pools.length) return [];

  const out = [];
  let nextId = Number.isFinite(opts.startId) ? opts.startId : 0;

  for (let i = 0; i < total; i += 1) {
    const pool = pools[i % pools.length];
    const originIndex = Math.floor(random() * pool.length) % pool.length;
    const origin = pool[originIndex];
    // The destination is a bounded number of steps along the component, so a
    // trip has a plausible length and never starts where it ends.
    const reach = 2 + Math.floor(random() * Math.max(1, TRAFFIC_TBD.maxTripCells - 1));
    const destination = pool[(originIndex + reach) % pool.length];

    const path = routeBetween(network, origin, destination);
    if (!path || path.length < 2) continue;

    const modelIndex = Math.floor(random() * VEHICLE_MODEL_KEYS.length) % VEHICLE_MODEL_KEYS.length;
    const originCell = parseCellKey(origin) ?? { x: 0, z: 0 };

    out.push({
      id: nextId,
      model: VEHICLE_MODEL_KEYS[modelIndex],
      cell: path[0],
      path: path.slice(1),
      progress: 0,
      previous: null,
      turn: 0,
      speed: 0,
      elapsed: 0,
      covered: 0,
      tripCells: path.length - 1,
      /** The planned length of the whole trip — never shrinks. */
      tripLength: path.length - 1,
      stuckFor: 0,
      blocked: false,
      arrived: false,
      reroutes: 0,
      diagnostics: [],
      x: originCell.x,
      z: originCell.z,
    });
    nextId += 1;
  }
  return out;
}

/** Pick the cell a vehicle should head for, avoiding an immediate U-turn. */
function chooseNext(network, vehicle, node, occupancy, capacity) {
  const neighbours = node.neighbors ?? [];
  if (!neighbours.length) return null;
  const withoutPrevious = neighbours.filter((key) => key !== vehicle.previous);
  const pool = withoutPrevious.length ? withoutPrevious : neighbours;
  const start = Math.abs(vehicle.turn) % pool.length;
  for (let i = 0; i < pool.length; i += 1) {
    const key = pool[(start + i) % pool.length];
    if ((occupancy.get(key) ?? 0) < capacity) {
      vehicle.turn += 1;
      return key;
    }
  }
  // Every neighbour is full: hold the vehicle where it is.
  vehicle.turn += 1;
  return null;
}

/** Give a blocked vehicle a fresh route. */
function reroute(network, vehicle) {
  const keys = [...network.nodes.keys()];
  if (!keys.length) return false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const r = hash32(vehicle.id * 2654435761 + vehicle.reroutes * 40503 + attempt);
    const destination = keys[Math.floor(r * keys.length)];
    const path = routeBetween(network, vehicle.cell, destination);
    if (path && path.length > 1) {
      vehicle.path = path.slice(1);
      vehicle.tripCells = vehicle.path.length;
      vehicle.tripLength = vehicle.path.length;
      vehicle.progress = 0;
      // A new plan means a new trip: the clock and the covered distance
      // restart, so the commute never mixes two journeys.
      vehicle.covered = 0;
      vehicle.elapsed = 0;
      vehicle.reroutes += 1;
      vehicle.diagnostics.push('rerouted');
      return true;
    }
  }
  return false;
}

function updatePosition(vehicle) {
  const from = parseCellKey(vehicle.cell);
  if (!from) { vehicle.x = 0; vehicle.z = 0; return; }
  const to = vehicle.path.length ? parseCellKey(vehicle.path[0]) : null;
  if (!to) { vehicle.x = from.x; vehicle.z = from.z; return; }
  const t = vehicle.progress;
  vehicle.x = from.x + (to.x - from.x) * t;
  vehicle.z = from.z + (to.z - from.z) * t;
}

/**
 * Advance every vehicle by `dt` seconds.
 *
 * Pure: the input vehicles are never mutated, a new array is returned.
 *
 * @param {object[]} vehicles
 * @param {object} network
 * @param {number} dt seconds
 * @returns {object[]} the new vehicles
 */
export function stepVehicles(vehicles, network, dt) {
  const list = Array.isArray(vehicles) ? vehicles : [];
  const delta = Number(dt);
  if (!Number.isFinite(delta) || delta <= 0) return list.slice();
  if (!network?.nodes?.size) return list.slice();

  const capacity = perCellCapacity();
  const speed = baseSpeed();

  const occupancy = new Map();
  for (const vehicle of list) {
    occupancy.set(vehicle.cell, (occupancy.get(vehicle.cell) ?? 0) + 1);
  }

  const out = [];
  for (const source of list) {
    const vehicle = { ...source, diagnostics: [...(source.diagnostics ?? [])] };
    const node = network.nodes.get(vehicle.cell);

    if (!node) {
      // The road under the vehicle was removed: the trip cannot continue.
      vehicle.arrived = true;
      vehicle.blocked = false;
      out.push(vehicle);
      continue;
    }

    // 1. make sure the route has a next cell
    if (!vehicle.path.length) {
      const next = chooseNext(network, vehicle, node, occupancy, capacity);
      if (next) vehicle.path = [next];
    }

    const next = vehicle.path[0];
    if (!next) {
      // A dead end with no neighbours at all: hold the vehicle.
      vehicle.stuckFor += delta;
      vehicle.blocked = true;
      if (vehicle.stuckFor > TRAFFIC_TBD.stuckTimeout) {
        if (!reroute(network, vehicle)) vehicle.stuckFor = 0;
      }
      updatePosition(vehicle);
      out.push(vehicle);
      continue;
    }

    // 2. drive. A large dt may cover several cells, so the vehicle walks
    //    its route until the elapsed time is used up: the result does not
    //    depend on how the ticks were batched.
    vehicle.blocked = false;
    vehicle.stuckFor = 0;
    let remaining = delta;
    // The guard only stops a pathological dt from looping forever; a
    // vehicle can cross at most one cell per `TUNING.secondsPerCell`, so
    // 1024 steps is far beyond any real frame.
    let guard = 0;

    while (guard < 1024) {
      guard += 1;
      const target = vehicle.path[0];
      if (!target) break;

      const targetOccupancy = occupancy.get(target) ?? 0;
      if (targetOccupancy >= capacity) {
        // The cell is full: the vehicle waits at the edge of it. The
        // progress stays inside [0,1) and only the time it really waited
        // counts as stuck.
        vehicle.blocked = true;
        vehicle.stuckFor += Math.max(0, remaining);
        vehicle.progress = 0.999;
        if (vehicle.stuckFor > TRAFFIC_TBD.stuckTimeout) {
          // FR-MOB-081: re-route first, never silently despawn.
          if (!reroute(network, vehicle)) vehicle.stuckFor = 0;
        }
        break;
      }

      const density = targetOccupancy / capacity;
      const speedFactor = Math.max(TRAFFIC_TBD.minSpeedFactor, 1 - density);
      vehicle.speed = speed * speedFactor;
      const timeToCell = (1 - vehicle.progress) / vehicle.speed;

      if (remaining < timeToCell) {
        vehicle.progress += vehicle.speed * remaining;
        remaining = 0;
        break;
      }

      remaining -= timeToCell;
      vehicle.progress = 0;
      const previous = vehicle.cell;
      vehicle.cell = target;
      vehicle.path.shift();
      vehicle.previous = previous;
      vehicle.covered += 1;
      occupancy.set(target, targetOccupancy + 1);
      occupancy.set(previous, Math.max(0, (occupancy.get(previous) ?? 1) - 1));
      vehicle.tripCells = vehicle.path.length;
      if (!vehicle.path.length) { vehicle.arrived = true; break; }
    }

    vehicle.elapsed += delta;
    updatePosition(vehicle);
    out.push(vehicle);
  }
  return out;
}

/**
 * The statistics of the current traffic state.
 *
 * @param {object} network
 * @param {object[]} vehicles
 */
export function trafficStats(network, vehicles) {
  const list = Array.isArray(vehicles) ? vehicles : [];
  const roadCells = network?.nodes?.size ?? 0;
  const capacity = perCellCapacity();
  const speed = baseSpeed();

  const occupancy = new Map();
  for (const vehicle of list) {
    occupancy.set(vehicle.cell, (occupancy.get(vehicle.cell) ?? 0) + 1);
  }
  let maxCellOccupancy = 0;
  for (const value of occupancy.values()) if (value > maxCellOccupancy) maxCellOccupancy = value;

  const vehiclesPerCell = roadCells > 0 ? list.length / roadCells : 0;
  const congestion = roadCells > 0 ? clamp01(vehiclesPerCell / capacity) : 0;
  const jam = clamp01(maxCellOccupancy / capacity);

  let commuteSum = 0;
  let tripSum = 0;
  let stuckCount = 0;
  for (const vehicle of list) {
    // The commute is a function of the TRAVERSED trip length, not of the
    // cells that are still to go.
    const freeFlow = (vehicle.tripLength ?? vehicle.tripCells ?? 0) / speed;
    // The delay is the time lost to congestion: the elapsed time minus the
    // free-flow time of the distance actually covered (including the part
    // of the current cell the vehicle is on).
    const freeFlowElapsed = ((vehicle.covered ?? 0) + (vehicle.progress ?? 0)) / speed;
    const delay = Math.max(0, (vehicle.elapsed ?? 0) - freeFlowElapsed);
    commuteSum += freeFlow + delay;
    tripSum += vehicle.tripLength ?? vehicle.tripCells ?? 0;
    if ((vehicle.stuckFor ?? 0) > 0) stuckCount += 1;
  }
  const divisor = list.length || 1;

  return {
    vehicleCount: list.length,
    congestion,
    jam,
    vehiclesPerCell,
    maxCellOccupancy,
    averageCommute: list.length ? commuteSum / divisor : 0,
    averageTripCells: list.length ? tripSum / divisor : 0,
    stuckCount,
    occupancy,
  };
}

/**
 * Run the traffic simulation.
 *
 * @param {object} network
 * @param {object} [opts] { count, rng, seed, dt, seconds }
 * @returns {{vehicles:object[], congestion:number, averageCommute:number}}
 */
export function simulateTraffic(network, opts = {}) {
  const count = Math.max(0, Math.round(Number(opts.count ?? TUNING.targetVehicleCount)));
  const rng = typeof opts.rng === 'function' ? opts.rng : makeRng(opts.seed ?? 1337);
  const dt = Math.max(0.001, Number(opts.dt ?? 0.1));
  const seconds = Math.max(0, Number(opts.seconds ?? 0));

  let vehicles = spawnVehicles(network, count, rng);
  const steps = Math.round(seconds / dt);

  for (let step = 0; step < steps; step += 1) {
    vehicles = stepVehicles(vehicles, network, dt);
    const alive = vehicles.filter((vehicle) => !vehicle.arrived);
    if (alive.length < count) {
      let highest = -1;
      for (const vehicle of alive) if (vehicle.id > highest) highest = vehicle.id;
      const fresh = spawnVehicles(network, count - alive.length, rng, { startId: highest + 1 });
      vehicles = alive.concat(fresh);
    } else {
      vehicles = alive;
    }
  }

  const stats = trafficStats(network, vehicles);
  return {
    vehicles,
    congestion: stats.congestion,
    averageCommute: stats.averageCommute,
    ...stats,
  };
}
