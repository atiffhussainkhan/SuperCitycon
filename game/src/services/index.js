/**
 * services/index.js — the SRV domain service.
 *
 * OWNER: SRV. The integrator calls (see core/CONTRACT.md §7):
 *   createServices(ctx) -> {
 *     init, update, tick,
 *     coverageFor(serviceId, cx, cz) -> 0..1 at a cell,
 *     cityCoverage(serviceId)        -> 0..1 across the populated area,
 *     availability(serviceId)         -> {capacity, demand, served},
 *     unmetDemand(serviceId),
 *     registerFacility(f),            // {id, type, x, z, level, radius}
 *     dispose
 *   }
 *
 * This module holds NO rules of its own - the rules live in the two pure
 * modules next to it:
 *   services.js    the catalogue, the radii and the facility rules
 *   coverage.js    the falloff, the city-wide coverage and capacity vs demand
 *
 * It owns `state.services`:
 *   coverage      Map<serviceId, Map<cellKey, weight>>
 *   cityCoverage  {serviceId: 0..1}
 *   facilities    [{id, type, service, x, z, level, radius, capacity}]
 *
 * The domain NEVER imports a sibling domain: it learns about buildings from
 * the event bus and reconciles against the shared state.
 */

import { EVENTS } from '../core/events.js';
import { TUNING, MODES } from '../core/config.js';
import { cellKey } from '../core/state.js';
import {
  serviceCatalogue, serviceById, hasCoverageCircle, serviceRadiusFor,
  facilityFor, installCatalogue, setDefinitionLookup, getDefinitionLookup,
  serviceIdFor, facilitiesForService,
} from './services.js';
import {
  coverageAt, cityWideCoverage, capacityVsDemand, coverageMap,
} from './coverage.js';
import { liveStateProxy } from '../core/state.js';

/**
 * How much the city coverage may move before the change counts as material
 * and `EVENTS.COVERAGE_CHANGED` is emitted. Below this the HUD would flicker
 * on every rounding step.
 */
// TBD: the publisher published no emission threshold. Proposed TUNING key:
// `coverageChangeEpsilon`.
const COVERAGE_EPSILON = 0.005;

/**
 * How often (in game seconds) the coverage solver may run. The solver is
 * driven by building events, so this is only the safety net for a save/load
 * that replaced the map without emitting anything.
 */
// TBD: proposed TUNING key: `coverageSolveInterval`.
const SOLVE_INTERVAL = 0.25;

/**
 * Create the SRV service.
 * @param {object} ctx the shared context (core/CONTRACT.md §1)
 */
export function createServices(ctx) {
  /**
   * The live state tree.
   *
   * `ctx.state` is a GETTER in main.js (core/state.js `setState()` REPLACES
   * the state object when a save is loaded or the game is reset), so a
   * captured `ctx.state` would be an ORPHANED tree. Every access therefore
   * resolves through `ctx.state` again.
   */
  const state = liveStateProxy(ctx);
  const bus = ctx.bus;

  /** @type {Map<string, Map<number, number>>} serviceId -> cellKey -> weight */
  let coverageMaps = new Map();
  /** @type {Record<string, number>} serviceId -> 0..1 */
  let cityCoverage = {};
  /** the facilities derived from the buildings on the map */
  let derived = [];
  /** facilities registered through the public API that no building backs */
  const manual = new Map();
  /** ids that were explicitly removed and must not come back from a building */
  const suppressed = new Set();

  let solveTimer = 0;
  let dirty = true;
  let disposed = false;
  const unsubscribes = [];

  // -------------------------------------------------------------------------
  // State plumbing
  // -------------------------------------------------------------------------

  /** Make sure `state.services` has the shape this domain publishes. */
  function ensureState() {
    const s = state.services;
    if (!s || typeof s !== 'object') {
      state.services = { coverage: new Map(), cityCoverage: {}, facilities: [] };
      return;
    }
    // `coverage` is a Map<serviceId, Map<cellKey, weight>>; a plain object
    // (the shape core/state.js ships) is upgraded on the first init.
    if (!(s.coverage instanceof Map)) s.coverage = new Map();
    if (!s.cityCoverage || typeof s.cityCoverage !== 'object') s.cityCoverage = {};
    if (!Array.isArray(s.facilities)) s.facilities = [];
  }

  /** Push the domain's working copies into the state subtree. */
  function publish() {
    ensureState();
    state.services.coverage = coverageMaps;
    state.services.cityCoverage = cityCoverage;
    state.services.facilities = currentFacilities();
  }

  /**
   * Every facility the domain knows about.
   *
   * Two sources: the facilities DERIVED from the buildings on the map and the
   * facilities registered through `registerFacility()`. A derived facility
   * wins over a manual one with the same id (the building is the truth), and
   * a removed id stays removed even when a building with that id is still on
   * the map.
   */
  function currentFacilities() {
    const out = derived.slice();
    const seen = new Set(out.map((f) => f.id));
    for (const f of manual.values()) {
      if (seen.has(f.id)) continue;
      out.push(f);
      seen.add(f.id);
    }
    out.sort((a, b) => a.id - b.id);
    return out;
  }

  // -------------------------------------------------------------------------
  // Buildings -> facilities
  // -------------------------------------------------------------------------

  /** Every placed building instance, from the shared state. */
  function buildingInstances() {
    const bld = ctx.domains?.buildings;
    if (bld && typeof bld.instances === 'function') {
      try {
        const list = bld.instances();
        if (Array.isArray(list)) return list;
      } catch { /* fall through to the state */ }
    }
    const map = state.buildings?.instances;
    if (map instanceof Map) return Array.from(map.values());
    if (Array.isArray(map)) return map;
    return [];
  }

  /** The cells that hold residents: the footprint of every residential building. */
  function populatedCells() {
    const cells = [];
    for (const inst of buildingInstances()) {
      const def = definitionOfInstance(inst);
      if (!def || def.category !== 'residential') continue;
      if (Array.isArray(inst.cells) && inst.cells.length) {
        for (const c of inst.cells) cells.push({ x: c.x, z: c.z });
      } else {
        cells.push({ x: inst.x, z: inst.z });
      }
    }
    return cells;
  }

  /** Resolve a BLD catalogue entry for an instance (uses the lazy lookup). */
  function definitionOfInstance(instance) {
    const host = ctx.domains?.buildings;
    const lookup = typeof host?.getDefinition === 'function'
      ? host.getDefinition
      : getDefinitionLookup();
    if (typeof lookup !== 'function') return null;
    const id = instance?.type ?? instance?.defId;
    if (!id) return null;
    return lookup(id) ?? null;
  }

  /**
   * Rebuild the facility list from the buildings on the map.
   * This is the safety net; the event handlers below keep it up to date in
   * between.
   */
  function reconcile() {
    const next = [];
    for (const inst of buildingInstances()) {
      if (suppressed.has(inst.id)) continue;
      const facility = facilityFor(inst);
      if (facility) next.push(facility);
    }
    const changed = !sameFacilities(derived, next);
    derived = next;
    if (changed) dirty = true;
    return changed;
  }

  /** Cheap comparison: the same ids, types and levels in the same order. */
  function sameFacilities(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i].id !== b[i].id) return false;
      if (a[i].type !== b[i].type) return false;
      if (a[i].level !== b[i].level) return false;
      if (a[i].radius !== b[i].radius) return false;
      if (a[i].service !== b[i].service) return false;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // The coverage solver
  // -------------------------------------------------------------------------

  /**
   * True when the coverage solver must stay dormant.
   *
   * FR-SRV-010: the PC Early Access construction sandbox permits placing
   * every service building with no economy, no coverage simulation and no
   * construction timers.
   */
  function solverDormant() {
    const mode = state.meta?.mode;
    return mode === MODES.sandbox || mode === MODES.editor;
  }

  /**
   * Recompute the coverage maps and the city coverage.
   * @returns {boolean} true when the coverage moved materially
   */
  function solve() {
    const previous = cityCoverage;
    const nextMaps = new Map();
    const nextCity = {};

    if (solverDormant()) {
      coverageMaps = nextMaps;
      cityCoverage = nextCity;
      publish();
      return false;
    }

    const populated = populatedCells();
    const all = currentFacilities();

    for (const service of serviceCatalogue()) {
      const owned = facilitiesForService(all, service.id);
      if (!owned.length) {
        nextCity[service.id] = 0;
        continue;
      }
      if (!hasCoverageCircle(service.id)) {
        // A connection grant has no area of effect: it contributes capacity
        // only (FR-SRV-005(b)).
        nextCity[service.id] = 0;
        continue;
      }
      const map = coverageMap(owned, serviceRadiusFor(1));
      nextMaps.set(service.id, map);
      nextCity[service.id] = cityWideCoverage(owned, populated, serviceRadiusFor(1));
    }

    coverageMaps = nextMaps;
    cityCoverage = nextCity;

    let material = false;
    for (const id of Object.keys(nextCity)) {
      const before = Number(previous?.[id] ?? 0);
      if (Math.abs(nextCity[id] - before) > COVERAGE_EPSILON) material = true;
    }
    for (const id of Object.keys(previous ?? {})) {
      if (!(id in nextCity)) material = true;
    }
    publish();
    return material;
  }

  /** Solve and tell the world when the coverage moved. */
  function solveAndAnnounce() {
    const material = solve();
    dirty = false;
    if (material) {
      bus?.emit?.(EVENTS.COVERAGE_CHANGED, {
        cityCoverage: { ...cityCoverage },
        facilities: currentFacilities().length,
      });
    }
    return material;
  }

  // -------------------------------------------------------------------------
  // The service
  // -------------------------------------------------------------------------

  const service = {
    /** Prepare the state subtree and load the building catalogue. */
    async init() {
      ensureState();
      disposed = false;
      // The catalogue is BLD's pure data module; loading it lazily keeps this
      // domain loadable when BLD is not there yet.
      await installCatalogue();
      // Let a host that already owns a catalogue publish it to us.
      const hostLookup = ctx.domains?.buildings?.getDefinition;
      if (typeof hostLookup === 'function') setDefinitionLookup(hostLookup);
      reconcile();
      solveAndAnnounce();
      dirty = false;

      // Building events keep the facility list fresh without polling.
      unsubscribes.push(bus?.on?.(EVENTS.BUILDING_PLACED, () => { reconcile(); dirty = true; }));
      unsubscribes.push(bus?.on?.(EVENTS.BUILDING_UPGRADED, () => { reconcile(); dirty = true; }));
      unsubscribes.push(bus?.on?.(EVENTS.BUILDING_REMOVED, () => { reconcile(); dirty = true; }));
      unsubscribes.push(bus?.on?.(EVENTS.GAME_LOADED, () => { reconcile(); dirty = true; }));
    },

    /** Wall-clock update: SRV has nothing to animate. */
    update(dt) {
      void dt;
    },

    /** Game-time tick: keep the coverage honest. */
    tick(dt) {
      if (disposed) return;
      const step = Number(dt) || 0;
      solveTimer += step;
      // The building events set `dirty`, so a new or a demolished building is
      // solved on the very next tick; the timer is only the safety net.
      if (!dirty && solveTimer < SOLVE_INTERVAL) return;
      solveTimer = 0;
      reconcile();
      solveAndAnnounce();
    },

    /**
     * The coverage weight at a cell, 0..1.
     * @param {string} serviceId
     * @param {number} cx
     * @param {number} cz
     */
    coverageFor(serviceId, cx, cz) {
      const map = coverageMaps.get(serviceId);
      if (!map) return 0;
      const w = map.get(cellKey(Math.round(cx), Math.round(cz)));
      return w === undefined ? 0 : w;
    },

    /**
     * The city-wide coverage of a service across the POPULATED cells, 0..1.
     * @param {string} serviceId
     */
    cityCoverage(serviceId) {
      const v = cityCoverage?.[serviceId];
      return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    },

    /**
     * The capacity of a service against the demand it faces.
     * @param {string} serviceId
     * @returns {{capacity:number, demand:number, served:number}}
     */
    availability(serviceId) {
      const owned = facilitiesForService(currentFacilities(), serviceId);
      const demand = Math.max(0, Number(state.population?.households) || 0);
      const result = capacityVsDemand(owned, demand, TUNING.householdsPerService);
      return {
        capacity: result.capacity,
        demand: result.demand,
        served: result.served,
      };
    },

    /**
     * The demand a service cannot meet (households beyond its capacity).
     * @param {string} serviceId
     */
    unmetDemand(serviceId) {
      const owned = facilitiesForService(currentFacilities(), serviceId);
      const demand = Math.max(0, Number(state.population?.households) || 0);
      return capacityVsDemand(owned, demand, TUNING.householdsPerService).unmet;
    },

    /**
     * Register a service facility.
     *
     * @param {object} f `{id, type, x, z, level, radius}` - `service` and
     *        `capacity` are optional and are derived when they are missing.
     * @returns {object|null} the registered facility
     */
    registerFacility(f) {
      if (!f) return null;
      const level = Math.max(1, Math.round(Number(f.level) || 1));
      const service = f.service
        ?? serviceIdFor(definitionOfInstance({ type: f.type }))
        ?? null;
      if (!service) return null;

      const facility = {
        id: f.id,
        type: f.type,
        service,
        x: Number(f.x) || 0,
        z: Number(f.z) || 0,
        level,
        radius: Number.isFinite(Number(f.radius)) && Number(f.radius) > 0
          ? Number(f.radius)
          : serviceRadiusFor(level),
        capacity: Math.max(0, Number(f.capacity) || 0),
        providesCoverage: f.providesCoverage ?? hasCoverageCircle(service),
      };

      // A facility that a building backs is derived from that building; the
      // manual copy only fills the gap until the next reconcile.
      manual.set(facility.id, facility);
      suppressed.delete(facility.id);
      dirty = true;
      publish();
      return facility;
    },

    /**
     * Remove a facility by id.
     * @param {number|string} id
     * @returns {boolean} true when a facility was removed
     */
    removeFacility(id) {
      const hadManual = manual.delete(id);
      const wasDerived = derived.some((f) => f.id === id);
      // The id stays removed even when a building with that id is still up.
      suppressed.add(id);
      const removed = hadManual || wasDerived;
      if (removed) {
        dirty = true;
        publish();
      }
      return removed;
    },

    /** The registered facilities (a copy). */
    facilities() {
      return currentFacilities();
    },

    /** The service catalogue (data, not a simulation). */
    catalogue() {
      return serviceCatalogue();
    },

    /** Drop every facility and every coverage map. */
    clearFacilities() {
      derived = [];
      manual.clear();
      suppressed.clear();
      coverageMaps = new Map();
      cityCoverage = {};
      publish();
      dirty = true;
      return true;
    },

    /** Solve the coverage right now (used after a load or a reset). */
    refresh() {
      reconcile();
      return solveAndAnnounce();
    },

    /** Tear the domain down. */
    dispose() {
      disposed = true;
      for (const un of unsubscribes) { try { un?.(); } catch { /* ignore */ } }
      unsubscribes.length = 0;
      derived = [];
      manual.clear();
      suppressed.clear();
      coverageMaps = new Map();
      cityCoverage = {};
      publish();
    },
  };

  // Keep the published state in sync from the very first call.
  publish();
  return service;
}

export { serviceCatalogue, serviceById, serviceRadiusFor, facilityFor } from './services.js';
export { coverageAt, cityWideCoverage, capacityVsDemand } from './coverage.js';
