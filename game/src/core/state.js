/**
 * core/state.js — the single mutable game state.
 *
 * The spine owns the shape of `state` and creates it. Each domain owns ONE
 * subtree and may extend it during its own `create(ctx)` call; no domain may
 * write another domain's subtree. Cross-domain changes travel over the
 * event bus (core/events.js).
 *
 * Subtree ownership:
 *   state.meta        integrator / CORE
 *   state.world       WLD
 *   state.economy     ECO
 *   state.population  POP
 *   state.services    SRV
 *   state.mobility    MOB
 *   state.buildings   BLD
 *   state.studio      STD
 *   state.ui          UX
 */

import { GRID, MODES, SPEED, makeRng } from './config.js';

export const DEFAULT_SEED = 20261023;

/** Build a fresh state tree. */
export function createState(seed = DEFAULT_SEED) {
  const rng = makeRng(seed);

  return {
    // ---- integrator / CORE -------------------------------------------
    meta: {
      seed,
      mode: MODES.play,
      stageId: 'stage-1',
      stageIndex: 0,
      day: 1,
      tick: 0,
      elapsed: 0,
      speed: SPEED.normal,
      paused: false,
      /** Score accumulated this session. */
      score: 0,
      /** True once the vertical slice has booted. */
      ready: false,
    },

    // ---- WLD ----------------------------------------------------------
    world: {
      /** Float32Array of GRID.size*GRID.size terrain heights (world units). */
      heightmap: null,
      /** Float32Array of water depth per cell (0 = dry). */
      water: null,
      /** Uint8Array of terrain type ids per cell. */
      types: null,
      /** World-space water surface height. */
      waterLevel: 0,
      /** Placed decorative nature objects: {model, x, z, rot, scale}. */
      scenery: [],
      /** Cells that have been terraformed by the player. */
      modified: 0,
      seed,
    },

    // ---- ECO ----------------------------------------------------------
    economy: {
      treasury: 0,
      /** Monthly budget sliders, keyed by service category. */
      budget: {},
      /** Rolling transaction log, newest last. */
      ledger: [],
      /** income/upkeep accrued this month. */
      lastIncome: 0,
      lastUpkeep: 0,
      month: 1,
      /** Total revenue ever collected. */
      revenue: 0,
      /** Total expenditure ever paid. */
      expenditure: 0,
    },

    // ---- POP ----------------------------------------------------------
    population: {
      total: 0,
      /** 0..100 */
      happiness: 60,
      /** 0..100 */
      loyalty: 50,
      households: 0,
      /** Per-need contribution to happiness. */
      needs: {},
      /** Citizen entities (owned by POP). */
      citizens: [],
      /** Migration pressure, -1..1 */
      migration: 0,
      employed: 0,
      unemployed: 0,
    },

    // ---- SRV ----------------------------------------------------------
    services: {
      /** Per service id: {coverage: Map<cellKey, weight>, capacity, demand}. */
      coverage: {},
      /** Aggregated city coverage per service id, 0..1. */
      cityCoverage: {},
      /** Registered service buildings: {id, x, z, level, radius}. */
      facilities: [],
    },

    // ---- MOB ----------------------------------------------------------
    mobility: {
      /** Adjacency over road cells. */
      network: { nodes: new Map(), edges: 0 },
      vehicles: [],
      /** Number of vehicles that moved last simulation tick. */
      activeVehicles: 0,
      /** 0..1 congestion measure. */
      congestion: 0,
      averageCommute: 0,
      /** Transit routes the player has laid out. */
      routes: [],
    },

    // ---- BLD ----------------------------------------------------------
    buildings: {
      /** Map of instanceId -> {id, type, x, z, rot, level, ...}. */
      instances: new Map(),
      /** Monotonic counter for instance ids. */
      nextId: 1,
      /** Zones painted by the player: Map<cellKey, zoneId>. */
      zones: new Map(),
      /** Categorised building definitions. */
      catalogue: new Map(),
    },

    // ---- STD ----------------------------------------------------------
    studio: {
      open: false,
      /** Map of "x,y,z" -> {color, id}. */
      voxels: new Map(),
      /** Workshop document metadata. */
      doc: null,
      dirty: false,
      palette: [],
      brush: 1,
    },

    // ---- UX -----------------------------------------------------------
    ui: {
      tool: 'inspect',
      /** Currently hovered cell. */
      hover: null,
      /** Current selection. */
      selection: null,
      /** Open panel id, or null. */
      panel: null,
      /** Camera state mirror. */
      camera: { x: 0, z: 0, distance: 90, yaw: 45, pitch: 55 },
      toasts: [],
      speed: SPEED.normal,
      muted: false,
    },
  };
}

/** The live state singleton. */
export let state = createState();

/**
 * A STABLE view of the live state tree.
 *
 * `ctx.state` is a getter in main.js and `setState()` REPLACES the tree when
 * a save is loaded or the game is reset. A domain that captured
 * `const state = ctx.state` at construction time therefore kept writing into
 * an ORPHANED object while the live tree stayed at zero.
 *
 * This proxy has a fixed identity but resolves every access through
 * `ctx.state`, so holding a reference to it can never go stale.
 *
 * @param {object} ctx the shared context (core/CONTRACT.md §1)
 * @returns {object} a stable proxy over the live tree
 */
export function liveStateProxy(ctx) {
  return new Proxy({}, {
    get: (_t, prop) => ctx.state?.[prop],
    set: (_t, prop, value) => { ctx.state[prop] = value; return true; },
    has: (_t, prop) => prop in (ctx.state ?? {}),
    ownKeys: () => Reflect.ownKeys(ctx.state ?? {}),
    getOwnPropertyDescriptor: (_t, prop) => {
      const d = Object.getOwnPropertyDescriptor(ctx.state ?? {}, prop);
      // The proxy target is empty, so every reported property must be
      // reported as configurable or the Proxy invariants are violated.
      return d ? { ...d, configurable: true } : undefined;
    },
    deleteProperty: (_t, prop) => { delete ctx.state[prop]; return true; },
  });
}

/**
 * A STABLE view of one SUB-TREE of the live state.
 *
 * The tree object itself keeps its identity across a load, but its sub-trees
 * are REPLACED wholesale (`core/save.js` copies the restored tree over the
 * live one). A domain that captured `const eco = ensureState(state)` at
 * construction time therefore kept writing into an orphaned sub-tree.
 *
 * @param {object} ctx the shared context
 * @param {string} key the sub-tree key, e.g. `'economy'`
 * @param {(tree:object)=>object} ensure returns the live sub-tree, creating
 *        or repairing it when needed
 * @returns {object} a stable proxy over the live sub-tree
 */
export function liveSubtree(ctx, key, ensure) {
  let ref = null;
  const resolve = () => {
    const tree = ctx.state;
    if (tree?.[key] !== ref) ref = ensure(tree);
    return ref;
  };
  return new Proxy({}, {
    get: (_t, prop) => resolve()[prop],
    set: (_t, prop, value) => { resolve()[prop] = value; return true; },
    has: (_t, prop) => prop in resolve(),
    ownKeys: () => Reflect.ownKeys(resolve()),
    getOwnPropertyDescriptor: (_t, prop) => {
      const d = Object.getOwnPropertyDescriptor(resolve(), prop);
      return d ? { ...d, configurable: true } : undefined;
    },
    deleteProperty: (_t, prop) => { delete resolve()[prop]; return true; },
  });
}

/** Replace the live state (reset / load). */
export function setState(next) {
  state = next;
  return state;
}

/** Reset the live state in place, preserving object identity for held refs. */
export function resetState(seed = DEFAULT_SEED) {
  const fresh = createState(seed);
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, fresh);
  return state;
}

/**
 * Deep-ish snapshot for save/load. Maps and typed arrays need special
 * handling; plain objects are cloned recursively.
 */
export function snapshot(src = state) {
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = cloneValue(v);
  }
  return out;
}

function cloneValue(v) {
  if (v instanceof Map) return { __map: Array.from(v.entries()).map(([kk, vv]) => [kk, cloneValue(vv)]) };
  if (v instanceof Set) return { __set: Array.from(v) };
  if (ArrayBuffer.isView(v)) return { __typed: v.constructor.name, data: Array.from(v) };
  if (Array.isArray(v)) return v.map(cloneValue);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [kk, vv] of Object.entries(v)) o[kk] = cloneValue(vv);
    return o;
  }
  return v;
}

/** Rebuild a live state from a snapshot produced by `snapshot()`. */
export function restore(snap) {
  const fresh = createState(snap?.meta?.seed ?? DEFAULT_SEED);
  for (const [k, v] of Object.entries(snap || {})) {
    fresh[k] = reviveValue(v);
  }
  setState(fresh);
  return state;
}

function reviveValue(v) {
  if (v && typeof v === 'object') {
    if (Array.isArray(v.__map)) return new Map(v.__map.map(([kk, vv]) => [kk, reviveValue(vv)]));
    if (Array.isArray(v.__set)) return new Set(v.__set);
    // `__typed` is the CONSTRUCTOR NAME as a string ('Float32Array'), not an
    // array. Testing `Array.isArray` here meant the marker was never
    // recognised and every typed array came back as a plain object.
    if (typeof v.__typed === 'string') {
      const Ctor = { Float32Array, Uint8Array, Uint16Array, Int32Array }[v.__typed] || Float32Array;
      return Ctor.from(v.data);
    }
    if (Array.isArray(v)) return v.map(reviveValue);
    const o = {};
    for (const [kk, vv] of Object.entries(v)) o[kk] = reviveValue(vv);
    return o;
  }
  return v;
}

/** Cell key helper shared by every domain that maps cells. */
export function cellKey(cx, cz) {
  return cx * GRID.size + cz;
}

/** Inverse of `cellKey`. */
export function parseCellKey(key) {
  return { x: Math.floor(key / GRID.size), z: key % GRID.size };
}
