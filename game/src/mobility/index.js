/**
 * MOB — the mobility domain service.
 *
 * Owns `state.mobility`: the road cells the player placed, the road graph
 * derived from them, the simulated vehicles and the traffic statistics.
 *
 * The simulation maths lives in `traffic.js` and the topology in
 * `network.js`; both are pure (no Three.js). This file wires them to the
 * state, the event bus and the renderer.
 */

import { EVENTS } from '../core/events.js';
import { TUNING, makeRng } from '../core/config.js';
import { buildNetwork, cellKey, connectivityScore, networkReport } from './network.js';
import {
  spawnVehicles, stepVehicles, trafficStats, VEHICLE_MODEL_KEYS, TRAFFIC_TBD,
} from './traffic.js';
import {
  createFleet, syncFleet, disposeFleet, roadModelFor, placeStaticModel, removeStaticModel,
  groundHeight, TRAFFIC_LIGHT_MODEL_KEYS, STREET_LIGHT_MODEL_KEY,
} from './vehicles.js';
import { liveStateProxy, liveSubtree } from '../core/state.js';

export * from './network.js';
export * from './traffic.js';

/**
 * The minimum game-time between two TRAFFIC_CHANGED events (contract
 * section 2: publish on meaningful changes only).
 *
 * TBD: the publisher never specified a publish rate. Proposed TUNING key:
 * `mobility.trafficEventInterval` (0.5 s).
 */
const TRAFFIC_EVENT_INTERVAL = TRAFFIC_TBD.trafficEventInterval;

/**
 * Create the mobility domain.
 *
 * @param {object} ctx the shared game context
 */
export function createMobility(ctx) {
  /**
   * The live state tree.
   *
   * `ctx.state` is a GETTER in main.js (core/state.js `setState()` REPLACES
   * the state object when a save is loaded or the game is reset), so a
   * captured `ctx.state` would be an ORPHANED tree: the domain would keep
   * writing into an object nobody reads while the live tree stayed at zero.
   * Every access therefore resolves through `ctx.state` again.
   */
  const state = liveStateProxy(ctx);

  /**
   * The live mobility sub-tree.
   *
   * The sub-tree is REPLACED wholesale when a save is loaded (`core/save.js`
   * copies the restored tree over the live one), so the reference is
   * re-resolved whenever `state.mobility` is not the object we last saw.
   */
  const mob = liveSubtree(ctx, 'mobility', ensureState);

  const bus = ctx.bus;

  let network = buildNetwork([]);
  let vehicles = [];
  let fleet = null;
  let disposed = false;
  let targetCount = TUNING.targetVehicleCount;
  let seed = Number(state?.meta?.seed ?? 1337);
  let rng = makeRng(seed);
  let nextVehicleId = 0;
  let paused = false;
  let staticTags = new Map();
  let trafficEventClock = 0;
  let lastPublishedCount = -1;

  function ensureState(st) {
    const m = st.mobility ?? (st.mobility = {});
    if (!m.roads || typeof m.roads.get !== 'function') m.roads = new Map();
    if (!m.network || typeof m.network !== 'object') m.network = { nodes: new Map(), edges: 0 };
    return m;
  }

  // ---- network -------------------------------------------------------------

  /** Recompute the road graph from the placed road cells. */
  function rebuildNetwork() {
    network = buildNetwork(mob.roads);
    mob.network = network;
    syncStaticProps();
    bus?.emit?.(EVENTS.ROAD_NETWORK_CHANGED, {
      roadCount: network.roadCount,
      edges: network.edges,
      components: network.components.length,
      connectivity: connectivityScore(network),
    });
    return network;
  }

  /**
   * The road at a cell.
   *
   * @returns {object|null} the road record, or null when there is no road
   */
  function roadAt(cx, cz) {
    const record = mob.roads.get(cellKey(cx, cz));
    return record ?? null;
  }

  /**
   * The game clock, in seconds since the city was founded.
   *
   * It is deterministic (it is derived from the simulation, not from the
   * wall clock), so the state can be replayed and reloaded unchanged.
   */
  function gameClock() {
    const meta = state?.meta;
    const elapsed = Number(meta?.elapsed);
    if (Number.isFinite(elapsed)) return elapsed;
    const tick = Number(meta?.tick);
    if (Number.isFinite(tick)) return tick;
    return 0;
  }

  function isOccupied(cx, cz) {
    const bld = ctx.domains?.buildings;
    const fn = bld?.occupancy;
    if (typeof fn !== 'function') return false;
    try { return Boolean(fn(cx, cz)); } catch { return false; }
  }

  /**
   * Place a road cell.
   *
   * @returns {{ok:boolean, reason:string|null}}
   */
  function addRoad(cx, cz) {
    const x = Math.round(Number(cx));
    const z = Math.round(Number(cz));
    if (!Number.isFinite(x) || !Number.isFinite(z)) return { ok: false, reason: 'invalid-cell' };
    const size = ctx.config?.GRID?.size ?? 64;
    if (x < 0 || z < 0 || x >= size || z >= size) return { ok: false, reason: 'out-of-bounds' };
    if (mob.roads.has(cellKey(x, z))) return { ok: false, reason: 'already-a-road' };
    if (isOccupied(x, z)) return { ok: false, reason: 'occupied' };

    // The placement stamp comes from the GAME CLOCK, never from the wall
    // clock: a wall-clock stamp would make the simulation non-replayable and
    // would break save/reload equivalence.
    mob.roads.set(cellKey(x, z), {
      x, z, type: 'street', tier: 1, placedAt: gameClock(),
    });
    // `rebuildNetwork` publishes ROAD_NETWORK_CHANGED — one event, not two.
    rebuildNetwork();
    return { ok: true, reason: null };
  }

  /**
   * Demolish a road cell.
   *
   * @returns {{ok:boolean, reason:string|null}}
   */
  function removeRoad(cx, cz) {
    const x = Math.round(Number(cx));
    const z = Math.round(Number(cz));
    if (!Number.isFinite(x) || !Number.isFinite(z)) return { ok: false, reason: 'invalid-cell' };
    const key = cellKey(x, z);
    if (!mob.roads.has(key)) return { ok: false, reason: 'no-road' };
    mob.roads.delete(key);
    // `rebuildNetwork` publishes ROAD_NETWORK_CHANGED — one event, not two.
    rebuildNetwork();
    return { ok: true, reason: null };
  }

  // ---- static props (roads, traffic lights, street lights) -----------------

  /**
   * The static models that belong to the current network.
   *
   * TBD: the canonical orientation of the library road models is not
   * published; the rotation is derived from the geometry (see
   * `vehicles.roadModelFor`).
   */
  function desiredProps() {
    const props = new Map();
    let junctionIndex = 0;
    for (const node of network.nodes.values()) {
      const { model, rotation } = roadModelFor(network, node.key);
      props.set(`road:${node.key}`, {
        key: model, cx: node.x, cz: node.z, rotation, y: 0,
      });
      if (node.degree >= 3) {
        const light = TRAFFIC_LIGHT_MODEL_KEYS[junctionIndex % TRAFFIC_LIGHT_MODEL_KEYS.length];
        junctionIndex += 1;
        props.set(`light:${node.key}`, {
          key: light, cx: node.x, cz: node.z, rotation: rotation + Math.PI / 4, y: 0,
        });
      } else if (node.kind === 'straight' && (node.x + node.z) % 5 === 0) {
        props.set(`lamp:${node.key}`, {
          key: STREET_LIGHT_MODEL_KEY, cx: node.x, cz: node.z, rotation: rotation + Math.PI / 2, y: 0,
        });
      }
    }
    return props;
  }

  function syncStaticProps() {
    if (!fleet) return;
    const desired = desiredProps();
    fleet.desired = new Map(
      [...desired].map(([tag, prop]) => [tag, { key: prop.key, rotation: prop.rotation }]),
    );
    for (const tag of [...staticTags.keys()]) {
      if (!desired.has(tag)) {
        removeStaticModel(fleet, tag);
        staticTags.delete(tag);
      }
    }
    for (const [tag, prop] of desired) {
      const placed = staticTags.get(tag);
      // A neighbouring road turns a straight into a corner or a T-split, so
      // the art has to be replaced when the shape changes.
      if (placed && placed.key === prop.key && placed.rotation === prop.rotation) continue;
      if (placed) removeStaticModel(fleet, tag);
      staticTags.set(tag, prop);
      placeStaticModel(
        fleet, tag, prop.key, prop.cx, prop.cz, prop.rotation,
        groundHeight(ctx, prop.cx, prop.cz),
      );
    }
  }

  // ---- traffic -------------------------------------------------------------

  function ensureVehicles() {
    if (vehicles.length >= targetCount) return;
    const fresh = spawnVehicles(network, targetCount - vehicles.length, rng, { startId: nextVehicleId });
    nextVehicleId += fresh.length;
    vehicles = vehicles.concat(fresh);
  }

  function retireArrived() {
    const alive = vehicles.filter((vehicle) => !vehicle.arrived);
    if (alive.length === vehicles.length) return;
    vehicles = alive;
  }

  // ---- the public service --------------------------------------------------

  const service = {
    /** Prepare the MOB subtree, build the network and spawn the traffic. */
    init() {
      disposed = false;
      seed = Number(state?.meta?.seed ?? 1337);
      rng = makeRng(seed);
      nextVehicleId = 0;
      vehicles = [];
      targetCount = Number.isFinite(mob.targetVehicleCount)
        ? mob.targetVehicleCount
        : TUNING.targetVehicleCount;
      if (!fleet) fleet = createFleet(ctx);
      rebuildNetwork();
      ensureVehicles();
      // Put the cars in the scene straight away, not only after the first
      // frame, so the world is complete as soon as the domain is up.
      if (fleet) syncFleet(fleet, vehicles, network);
      return service;
    },

    /** Wall-clock update: keep the meshes in step with the simulation. */
    update(dt) {
      void dt;
      if (!fleet) return;
      syncFleet(fleet, vehicles, network);
    },

    /** Game-time tick: advance the traffic (FR-MOB-075). */
    tick(dt) {
      if (paused || disposed) return;
      const delta = Number(dt);
      if (!Number.isFinite(delta) || delta <= 0) return;

      const before = new Map();
      for (const vehicle of vehicles) before.set(vehicle.id, `${vehicle.cell}:${vehicle.progress}`);

      vehicles = stepVehicles(vehicles, network, delta);
      retireArrived();
      ensureVehicles();
      if (fleet) syncFleet(fleet, vehicles, network);

      let active = 0;
      for (const vehicle of vehicles) {
        if (before.get(vehicle.id) !== `${vehicle.cell}:${vehicle.progress}`) active += 1;
      }

      const stats = trafficStats(network, vehicles);
      mob.vehicles = vehicles;
      mob.activeVehicles = active;
      mob.congestion = stats.congestion;
      mob.jam = stats.jam;
      mob.averageCommute = stats.averageCommute;
      mob.vehicleCount = stats.vehicleCount;

      // CONTRACT section 2: publish on meaningful changes only, never every
      // frame. The event fires when the traffic changes shape (the vehicle
      // count moved) or at most twice a second of game time.
      trafficEventClock += delta;
      const countChanged = stats.vehicleCount !== lastPublishedCount;
      if (countChanged || trafficEventClock >= TRAFFIC_EVENT_INTERVAL) {
        trafficEventClock = 0;
        lastPublishedCount = stats.vehicleCount;
        bus?.emit?.(EVENTS.TRAFFIC_CHANGED, {
          vehicleCount: stats.vehicleCount,
          activeVehicles: active,
          congestion: stats.congestion,
          jam: stats.jam,
          averageCommute: stats.averageCommute,
        });
      }
    },

    /** Recompute the road graph from the placed roads. */
    rebuildNetwork() {
      return rebuildNetwork();
    },

    /** The road record at a cell, or null. */
    roadAt(cx, cz) {
      return roadAt(cx, cz);
    },

    /** Place a road cell. */
    addRoad(cx, cz) {
      return addRoad(cx, cz);
    },

    /** Demolish a road cell. */
    removeRoad(cx, cz) {
      return removeRoad(cx, cz);
    },

    /** How many vehicles are on the road right now. */
    vehicleCount() {
      return vehicles.length;
    },

    /** The network congestion, 0..1. */
    congestion() {
      return trafficStats(network, vehicles).congestion;
    },

    /** The worst single-cell congestion, 0..1. */
    jam() {
      return trafficStats(network, vehicles).jam;
    },

    /** The average commute time in seconds. */
    averageCommute() {
      return trafficStats(network, vehicles).averageCommute;
    },

    /** Set how many vehicles should be on the road. */
    setDensity(n) {
      const value = Math.round(Number(n));
      if (!Number.isFinite(value) || value < 0) return { ok: false, reason: 'invalid-density' };
      targetCount = value;
      mob.targetVehicleCount = value;
      if (vehicles.length > targetCount) vehicles = vehicles.slice(0, targetCount);
      else ensureVehicles();
      if (fleet) syncFleet(fleet, vehicles, network);
      return { ok: true, reason: null, targetVehicleCount: targetCount };
    },

    /** The target vehicle count. */
    targetVehicleCount() {
      return targetCount;
    },

    /** The live vehicles (read-only view). */
    vehicles() {
      return vehicles.slice();
    },

    /** The road graph. */
    network() {
      return network;
    },

    /**
     * The static props the network wants: one road model per road cell plus
     * the junction traffic lights and the street lights.
     *
     * @returns {object} `{ tag: { key, cx, cz, rotation } }`
     */
    props() {
      const out = {};
      for (const [tag, prop] of desiredProps()) out[tag] = { ...prop };
      return out;
    },

    /** The transport statistics panel data. */
    report() {
      const stats = trafficStats(network, vehicles);
      return {
        ...networkReport(network),
        vehicleCount: stats.vehicleCount,
        congestion: stats.congestion,
        jam: stats.jam,
        averageCommute: stats.averageCommute,
        averageTripCells: stats.averageTripCells,
        commuteTolerance: TUNING.commuteTolerance,
        models: VEHICLE_MODEL_KEYS,
      };
    },

    /** Pause or resume the simulation without corrupting the vehicles. */
    setPaused(value) {
      paused = Boolean(value);
      return { ok: true, reason: null, paused };
    },

    /** Tear the domain down. */
    dispose() {
      disposed = true;
      vehicles = [];
      disposeFleet(fleet);
      fleet = null;
      staticTags = new Map();
    },
  };

  return service;
}
