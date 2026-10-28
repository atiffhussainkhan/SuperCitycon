/**
 * buildings/placement.js — grid maths for placing, removing and upgrading
 * building instances.
 *
 * OWNER: BLD. Pure logic: MUST NOT import `three`, so it can be unit-tested
 * in Node (see buildings.test.mjs).
 *
 * The state subtree this module owns (core/state.js `state.buildings`):
 *   instances        Map<instanceId, instance>
 *   nextId           monotonic instance id counter
 *   zones            Map<cellKey, zoneId>
 *   occupancy        Map<cellKey, instanceId>   (index built here)
 *   builtCounts      Map<typeId, count>         (copies on the map)
 *   constructionSlots  how many slots the player owns (default 1)
 *   slotsUsed        slots currently consumed by constructions
 *
 * ---------------------------------------------------------------------------
 * RULE DECISIONS (and why)
 * ---------------------------------------------------------------------------
 * - ROAD CONNECTION DOES NOT BLOCK PLACEMENT. Dossier FR-BLD-079 / E1: a
 *   building placed without a usable road connection "shall still be
 *   placeable, shall be visibly unconnected, and shall not receive the
 *   bonuses its connection would grant". `canPlace` therefore REPORTS the
 *   connection state instead of refusing.
 * - TERRAIN refuses a footprint that touches water or that is too steep.
 * - CONSTRUCTION SLOTS refuse the placement with the "N slots needed" warning
 *   required by FR-BLD-044 / E2.
 * - The demolish REFUND is computed and returned; nothing is paid here. The
 *   treasury belongs to ECO (FR-BLD-025) and the dossier's own design
 *   decision OQ-BLD-10 says a bulldozed building yields no coins at all, so
 *   the caller decides whether to pay the refund.
 */

import { GRID, TUNING, inBounds } from '../core/config.js';
import { cellKey } from '../core/state.js';
import { getDefinition } from './catalogue.js';
import { deriveCost, MAX_BUILD_SLOPE_STEP } from './properties.js';

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

/**
 * Make sure the BLD-owned part of the state exists. The integrator creates
 * `instances`, `nextId`, `zones` and `catalogue`; the rest is BLD's own.
 */
export function ensureState(state) {
  const b = state.buildings;
  if (!b.instances || typeof b.instances.set !== 'function') b.instances = new Map();
  if (typeof b.nextId !== 'number') b.nextId = 1;
  if (!b.zones || typeof b.zones.set !== 'function') b.zones = new Map();
  if (!b.occupancy || typeof b.occupancy.set !== 'function') b.occupancy = new Map();
  if (!b.builtCounts || typeof b.builtCounts.set !== 'function') b.builtCounts = new Map();
  if (typeof b.constructionSlots !== 'number') b.constructionSlots = 1;
  if (typeof b.slotsUsed !== 'number') b.slotsUsed = 0;
  if (!b.catalogue || typeof b.catalogue.set !== 'function') b.catalogue = new Map();
  return b;
}

// ---------------------------------------------------------------------------
// Footprint maths
// ---------------------------------------------------------------------------

/** Normalise a rotation into 0..3 (0/90/180/270). NOT radians. */
export function normaliseRotation(rot) {
  const r = Math.round(Number(rot) || 0);
  return ((r % 4) + 4) % 4;
}

/**
 * The footprint size in TILES at a rotation. A quarter turn swaps width and
 * depth (QA-BLD-009: the four declared orientations).
 */
export function footprintSize(def, rot = 0) {
  const [w, d] = def?.footprintCells ?? [1, 1];
  const r = normaliseRotation(rot);
  return r % 2 === 0 ? [w, d] : [d, w];
}

/**
 * The cells an instance at anchor (cx, cz) occupies.
 *
 * The anchor is the CENTRE cell of the footprint for odd sizes and the
 * lower-left cell for even sizes, so a 1x1 sits exactly on its cell and a
 * 2x2 is centred on the corner between its four cells.
 *
 * @returns {{x:number,z:number}[]}
 */
export function footprintCells(def, cx, cz, rot = 0) {
  const [w, d] = footprintSize(def, rot);
  const x0 = cx - Math.floor((w - 1) / 2);
  const z0 = cz - Math.floor((d - 1) / 2);
  const cells = [];
  for (let j = 0; j < d; j += 1) {
    for (let i = 0; i < w; i += 1) cells.push({ x: x0 + i, z: z0 + j });
  }
  return cells;
}

/**
 * The centre of the footprint in FRACTIONAL cell coordinates - the point the
 * 3D model is anchored to (the renderer subtracts the manifest's centreXZ).
 */
export function footprintCentre(def, cx, cz, rot = 0) {
  const [w, d] = footprintSize(def, rot);
  const x0 = cx - Math.floor((w - 1) / 2);
  const z0 = cz - Math.floor((d - 1) / 2);
  return { x: x0 + (w - 1) / 2, z: z0 + (d - 1) / 2 };
}

// ---------------------------------------------------------------------------
// World queries (terrain, roads) - read from the state, never from a domain
// ---------------------------------------------------------------------------

function heightAt(state, cx, cz) {
  const h = state.world?.heightmap;
  if (!h || !h.length) return null;
  const v = h[cz * GRID.size + cx];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * True when the cell holds water.
 *
 * WLD publishes the water DEPTH per cell in `state.world.water` (0 = dry);
 * that map is authoritative and is used on its own. Only when it is absent
 * does the terrain type map (WLD: type id 0 === 'water') or the heightmap
 * against the water level decide.
 */
export function isWater(state, cx, cz) {
  const idx = cz * GRID.size + cx;
  const w = state.world?.water;
  if (w && w.length) {
    return (w[idx] ?? 0) > 0;
  }
  const types = state.world?.types;
  if (types && types.length && types[idx] === 0) return true;
  const level = state.world?.waterLevel;
  const h = heightAt(state, cx, cz);
  if (typeof level === 'number' && level > 0 && h !== null && h < level) return true;
  return false;
}

/** The terrain height of a cell, or null when the world has no heightmap. */
export function terrainHeight(state, cx, cz) {
  return heightAt(state, cx, cz);
}

/**
 * The ground height a model standing on this footprint should sit at: the
 * HIGHEST cell of the footprint, so the model never sinks into a rise.
 */
export function footprintHeight(state, cells) {
  let max = 0;
  for (const c of cells) {
    const v = heightAt(state, c.x, c.z);
    if (v === null) continue;
    if (v > max) max = v;
  }
  return max;
}

/**
 * True when the cell holds a nature/scenery object.
 * WLD publishes `state.world.scenery` as {model, cx, cz, ...}.
 *
 * D-01: this is INFORMATION, not a rule. Scenery never blocks a placement;
 * building on a cell clears the scenery on it (see `buildings/index.js`).
 */
export function sceneryAt(state, cx, cz) {
  const list = state.world?.scenery;
  if (!Array.isArray(list) || !list.length) return false;
  for (const rec of list) {
    if (!rec) continue;
    const sx = rec.cx ?? rec.x;
    const sz = rec.cz ?? rec.z;
    if (sx === undefined || sz === undefined) continue;
    if (Math.round(sx) === cx && Math.round(sz) === cz) return true;
  }
  return false;
}

/** The height difference between the highest and lowest cell of a footprint. */
export function slopeAcross(state, cells) {
  let min = Infinity;
  let max = -Infinity;
  for (const c of cells) {
    const v = heightAt(state, c.x, c.z);
    if (v === null) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max === -Infinity) return 0;
  return max - min;
}

/**
 * True when the cell is part of the road network. MOB owns the network; the
 * shapes it may publish are supported without importing MOB.
 */
export function roadAt(state, cx, cz) {
  const mob = state.mobility;
  if (!mob) return false;
  const key = cellKey(cx, cz);
  const nodes = mob.network?.nodes;
  if (nodes instanceof Map) return nodes.has(key);
  if (nodes instanceof Set) return nodes.has(key);
  if (mob.roads instanceof Map) return mob.roads.has(key);
  if (mob.roads instanceof Set) return mob.roads.has(key);
  if (Array.isArray(mob.roadCells)) {
    return mob.roadCells.some((c) => c && c.x === cx && c.z === cz);
  }
  return false;
}

/**
 * True when the footprint touches at least one road cell.
 * A building with no road connection is still placed (FR-BLD-079) but gains
 * no connection-dependent bonuses.
 */
export function hasRoadConnection(state, cells) {
  for (const c of cells) {
    const neighbours = [
      { x: c.x + 1, z: c.z }, { x: c.x - 1, z: c.z },
      { x: c.x, z: c.z + 1 }, { x: c.x, z: c.z - 1 },
    ];
    for (const n of neighbours) {
      if (!inBounds(n.x, n.z)) continue;
      if (roadAt(state, n.x, n.z)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Placement checks
// ---------------------------------------------------------------------------

/**
 * Can this definition be placed here?
 *
 * @param {object} state live game state
 * @param {object} def   catalogue definition
 * @param {number} cx    anchor cell x
 * @param {number} cz    anchor cell z
 * @param {number} [rot] rotation in 90 degree steps
 * @returns {{ok:boolean, reason:string|null, cells:{x:number,z:number}[],
 *            connected:boolean, rot:number}}
 */
export function canPlace(state, def, cx, cz, rot = 0) {
  const r = normaliseRotation(rot);
  if (!def || typeof def !== 'object') {
    return { ok: false, reason: 'unknown-building', cells: [], connected: false, rot: r };
  }
  if (def.available === false) {
    return { ok: false, reason: 'unavailable', cells: [], connected: false, rot: r };
  }

  // --- the anchor and the rotation must be whole cells / quarter turns ---
  if (!Number.isInteger(cx) || !Number.isInteger(cz)) {
    return { ok: false, reason: 'invalid-cell', cells: [], connected: false, rot: r };
  }
  if (!Number.isFinite(Number(rot)) || !Number.isInteger(Number(rot))) {
    return { ok: false, reason: 'invalid-rotation', cells: [], connected: false, rot: r };
  }

  const cells = footprintCells(def, cx, cz, r);

  // --- grid bounds -------------------------------------------------------
  for (const c of cells) {
    if (!inBounds(c.x, c.z)) {
      return { ok: false, reason: 'out-of-bounds', cells, connected: false, rot: r };
    }
  }

  // --- occupancy ----------------------------------------------------------
  for (const c of cells) {
    if (occupancy(state, c.x, c.z)) {
      return { ok: false, reason: 'occupied', cells, connected: false, rot: r };
    }
  }

  // --- roads must not be paved over, scenery NEVER blocks ---------------
  // D-01: decorative scatter (trees, bushes, rocks) does NOT block
  // construction. Placing a building CLEARS the scenery on the cells it
  // takes: the object leaves the scene and the record leaves
  // `state.world.scenery`. A map that is 80 % trees would otherwise be
  // unbuildable.
  for (const c of cells) {
    if (roadAt(state, c.x, c.z)) {
      return { ok: false, reason: 'road', cells, connected: false, rot: r };
    }
  }

  // --- terrain -----------------------------------------------------------
  for (const c of cells) {
    if (isWater(state, c.x, c.z)) {
      return { ok: false, reason: 'water', cells, connected: false, rot: r };
    }
  }
  if (slopeAcross(state, cells) > MAX_BUILD_SLOPE_STEP) {
    return { ok: false, reason: 'slope', cells, connected: false, rot: r };
  }

  // --- construction slots -------------------------------------------------
  const b = state.buildings ?? {};
  const slotsOwned = typeof b.constructionSlots === 'number' ? b.constructionSlots : 1;
  const slotsUsed = typeof b.slotsUsed === 'number' ? b.slotsUsed : 0;
  const needed = def.constructionSlots ?? 1;
  if (slotsUsed + needed > slotsOwned) {
    return {
      ok: false,
      reason: `needs ${needed} slot${needed === 1 ? '' : 's'}`,
      cells,
      connected: false,
      rot: r,
    };
  }

  // --- road connection is reported, never a refusal (FR-BLD-079) ---------
  const connected = def.requiresRoadConnection ? hasRoadConnection(state, cells) : true;
  return { ok: true, reason: null, cells, connected, rot: r };
}

// ---------------------------------------------------------------------------
// Instance lifecycle
// ---------------------------------------------------------------------------

/**
 * Place a building. Writes the instance into `state.buildings.instances`,
 * takes an id from `state.buildings.nextId`, indexes its cells and paints the
 * zone when the entry is a zoned one.
 *
 * Construction slots are only HELD while a building is being built; this
 * build places instantly, so the slot is free again as soon as the instance
 * lands. `canPlace` still refuses an entry whose slot requirement exceeds
 * what the player owns (FR-BLD-044 / E2).
 *
 * @returns {{ok:boolean, reason:string|null, instance:object|null}}
 */
export function placeInstance(state, def, cx, cz, rot = 0) {
  const b = ensureState(state);
  const check = canPlace(state, def, cx, cz, rot);
  if (!check.ok) return { ok: false, reason: check.reason, instance: null };

  const id = b.nextId;
  b.nextId += 1;

  const builtCount = (b.builtCounts.get(def.id) ?? 0) + 1;
  b.builtCounts.set(def.id, builtCount);

  const instance = {
    id,
    type: def.id,
    defId: def.id,
    x: cx,
    z: cz,
    /** Quarter-turn index, 0..3 (dossier §6: rotation is an integer 0-3). */
    rot: check.rot,
    rotation: check.rot,
    /** The same rotation in radians, for the renderer only. */
    rotationY: check.rot * (Math.PI / 2),
    level: 1,
    tier: 1,
    cells: check.cells,
    connected: check.connected,
    constructionState: 'done',
    constructionSlotsHeld: def.constructionSlots ?? 1,
    /** Snapshot of the entry's copy count on the map at placement time. */
    builtCount,
    /** A placed instance is neither in the inventory nor in the warehouse. */
    storageState: 'onMap',
    bonusArea: def.bonusArea
      ? { radiusTiles: def.bonusArea.radiusTiles, targets: [...(def.bonusArea.targets ?? [])] }
      : null,
    placedOnDay: state.meta?.day ?? null,
  };

  b.instances.set(id, instance);
  for (const c of check.cells) b.occupancy.set(cellKey(c.x, c.z), id);

  // Construction slots are held only WHILE a building is being built. This
  // build places instantly (FR-BLD-064), so the instance is 'done' the moment
  // it lands and no slot stays occupied. `slotsUsed` is what a timed
  // construction mode would consume.
  if (def.grantsConstructionSlot) b.constructionSlots += 1;

  if (def.zoned) {
    const zoneId = def.zoneId ?? def.id;
    for (const c of check.cells) b.zones.set(cellKey(c.x, c.z), zoneId);
  }

  return { ok: true, reason: null, instance };
}

/**
 * Demolish whatever stands on a cell.
 *
 * The refund is the build cost multiplied by TUNING.demolishRefundRate.
 * NOTHING is paid here: the treasury belongs to ECO, and the dossier's own
 * design decision (OQ-BLD-10) says a bulldozed building yields no coins at
 * all, so the caller decides what to do with the refund.
 *
 * @returns {{ok:boolean, reason:string|null, refund:number, instance:object|null}}
 */
export function removeInstance(state, cx, cz) {
  const b = ensureState(state);
  const instance = occupancy(state, cx, cz);
  if (!instance) return { ok: false, reason: 'no-building', refund: 0, instance: null };

  const def = getDefinition(instance.type);
  const refund = Math.round(deriveCost(def, instance.level) * TUNING.demolishRefundRate);

  b.instances.delete(instance.id);
  for (const c of instance.cells ?? []) {
    b.occupancy.delete(cellKey(c.x, c.z));
    if (def?.zoned) b.zones.delete(cellKey(c.x, c.z));
  }

  // A Citycon Building grants a permanent slot; demolishing it gives the
  // slot back, so place/remove cycles cannot farm extra slots.
  if (def?.grantsConstructionSlot) {
    b.constructionSlots = Math.max(1, (b.constructionSlots ?? 1) - 1);
  }

  const remaining = (b.builtCounts.get(instance.type) ?? 1) - 1;
  if (remaining > 0) b.builtCounts.set(instance.type, remaining);
  else b.builtCounts.delete(instance.type);

  return { ok: true, reason: null, refund, instance };
}

/**
 * The highest level an entry may reach, clamped by TUNING.
 * Services are capped by TUNING.maxServiceLevels, everything else by
 * TUNING.maxLevels.
 */
export function maxLevelFor(def) {
  if (!def) return 1;
  const isService = def.serviceProvided !== null || def.archetype === 'service';
  const cap = isService ? TUNING.maxServiceLevels : TUNING.maxLevels;
  return Math.max(1, Math.min(def.maxLevels ?? 1, cap));
}

/**
 * Upgrade a building IN PLACE: the cells and the rotation do not change, only
 * the tier/level (FR-BLD-049). An upgrade neither creates nor removes a
 * diversity point (OQ-BLD-20) and consumes no construction slot (OQ-BLD-21).
 *
 * @returns {{ok:boolean, reason:string|null, instance:object|null}}
 */
export function upgradeInstance(state, cx, cz) {
  const instance = occupancy(state, cx, cz);
  if (!instance) return { ok: false, reason: 'no-building', instance: null };
  const def = getDefinition(instance.type);
  if (!def) return { ok: false, reason: 'unknown-building', instance: null };

  const max = maxLevelFor(def);
  if ((instance.level ?? 1) >= max) {
    return { ok: false, reason: 'max-level', instance };
  }
  instance.level = (instance.level ?? 1) + 1;
  instance.tier = instance.level;
  return { ok: true, reason: null, instance };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * The instance standing on a cell, or null.
 * Uses the occupancy index when it exists, and falls back to a scan.
 */
export function occupancy(state, cx, cz) {
  const b = state?.buildings;
  if (!b) return null;
  const key = cellKey(cx, cz);
  if (b.occupancy instanceof Map) {
    // The index is authoritative when it exists: a miss is a miss.
    if (!b.occupancy.has(key)) return null;
    const id = b.occupancy.get(key);
    return b.instances?.get(id) ?? null;
  }
  for (const inst of b.instances?.values?.() ?? []) {
    for (const c of inst.cells ?? []) {
      if (c.x === cx && c.z === cz) return inst;
    }
  }
  return null;
}

/** Every placed instance of one catalogue entry. */
export function instancesByType(state, typeId) {
  const b = state?.buildings;
  if (!b?.instances) return [];
  const out = [];
  for (const inst of b.instances.values()) {
    if (inst.type === typeId || inst.defId === typeId) out.push(inst);
  }
  return out;
}

/** Every placed instance, as an array. */
export function allInstances(state) {
  const b = state?.buildings;
  if (!b?.instances) return [];
  return Array.from(b.instances.values());
}

/** How many copies of one catalogue entry are on the map. */
export function countByType(state, typeId) {
  return instancesByType(state, typeId).length;
}

/**
 * Paint a zone over a cell. The zone map is `Map<cellKey, zoneId>` and is
 * owned by BLD (see core/state.js).
 */
export function paintZone(state, cx, cz, zoneId) {
  const b = ensureState(state);
  if (!inBounds(cx, cz)) return { ok: false, reason: 'out-of-bounds' };
  if (!zoneId) return { ok: false, reason: 'no-zone' };
  b.zones.set(cellKey(cx, cz), zoneId);
  return { ok: true, reason: null, cell: { x: cx, z: cz }, zoneId };
}

/** Clear a painted zone. */
export function clearZone(state, cx, cz) {
  const b = ensureState(state);
  const key = cellKey(cx, cz);
  const had = b.zones.delete(key);
  return { ok: had, reason: had ? null : 'no-zone' };
}

/** The zone painted on a cell, or null. */
export function zoneAt(state, cx, cz) {
  const b = state?.buildings;
  if (!b?.zones) return null;
  return b.zones.get(cellKey(cx, cz)) ?? null;
}
