/**
 * core/navigation.js — how a citizen finds its way across the city.
 *
 * OWNER: the integrator (core/).
 *
 * WHY THIS EXISTS
 *   V6 shipped citizens that walked in a straight line from A to B: the
 *   path was `from → midpoint + a random offset → to`, with no knowledge
 *   of the terrain, the water or the buildings. A citizen walked through a
 *   warehouse, and on `high-water` through the flood. The population is
 *   the part of the game the player looks at, and it was the part that
 *   looked least alive.
 *
 * WHAT THIS IS
 *   A grid A* search over the city's 64 x 64 cell grid, with:
 *
 *     - an OBSTACLE MODEL taken from the LIVE city, so a new building
 *       changes the routes with no extra bookkeeping;
 *     - a DETERMINISTIC search — the same start, goal and world always
 *       give the same path, byte for byte;
 *     - a NODE BUDGET, so a walled-off destination returns the best path
 *       found so far instead of stalling the frame;
 *     - PATH SMOOTHING, so a citizen walks a straight line where the city
 *       allows it instead of stepping cell by cell.
 *
 * PURE
 *   This module imports no `three` and touches no DOM. It is unit-tested in
 *   Node with no browser at all — which is the whole reason the search
 *   lives here and not in the population domain.
 *
 * THE ALGORITHM, PLAINLY
 *   A* over the 8-neighbourhood with the octile heuristic (the distance a
 *   straight-line king would take). The heuristic is admissible — it never
 *   overestimates — so the first complete path the search returns is the
 *   cheapest one for the cost model.
 */

import { CELL, GRID, TUNING } from './config.js';

/**
 * The default node budget for one search.
 *
 * TBD: the publisher never published a search budget, so this is a design
 * value. It is mirrored in `TUNING.citizenPathBudget`.
 */
export const NAV_BUDGET = 4096;

/** The neighbour order. FIXED, so the search is deterministic. */
const NEIGHBOURS = Object.freeze([
  { dx: 1, dz: 0, diagonal: false },
  { dx: -1, dz: 0, diagonal: false },
  { dx: 0, dz: 1, diagonal: false },
  { dx: 0, dz: -1, diagonal: false },
  { dx: 1, dz: 1, diagonal: true },
  { dx: 1, dz: -1, diagonal: true },
  { dx: -1, dz: 1, diagonal: true },
  { dx: -1, dz: -1, diagonal: true },
]);

/**
 * The octile distance between two cells.
 *
 * This is the distance a straight-line king would travel: the straight
 * part plus the diagonal part. It is admissible for 8-way movement, which
 * is what makes the A* optimal.
 *
 * @param {{x:number,z:number}} a
 * @param {{x:number,z:number}} b
 * @returns {number}
 */
export function octile(a, b) {
  const dx = Math.abs((a?.x ?? 0) - (b?.x ?? 0));
  const dz = Math.abs((a?.z ?? 0) - (b?.z ?? 0));
  return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
}

/**
 * A binary min-heap over the open set.
 *
 * The comparison is a TOTAL order — cost, then heuristic, then insertion
 * counter — so the search cannot depend on the heap's internal layout.
 *
 * @param {Array} items
 */
class OpenSet {
  constructor() { this.items = []; this.seq = 0; }

  get size() { return this.items.length; }

  /** @param {{x:number,z:number,g:number,f:number,h:number}} item */
  push(item) {
    const node = { ...item, seq: this.seq };
    this.seq += 1;
    const items = this.items;
    items.push(node);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (compare(items[i], items[parent]) < 0) {
        const swap = items[i]; items[i] = items[parent]; items[parent] = swap;
        i = parent;
      } else break;
    }
    return node;
  }

  pop() {
    const items = this.items;
    if (!items.length) return null;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = (i * 2) + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && compare(items[left], items[smallest]) < 0) smallest = left;
        if (right < items.length && compare(items[right], items[smallest]) < 0) smallest = right;
        if (smallest === i) break;
        const swap = items[i]; items[i] = items[smallest]; items[smallest] = swap;
        i = smallest;
      }
    }
    return top;
  }
}

/** The total order of the open set: cost, then closeness, then insertion. */
function compare(a, b) {
  if (a.f !== b.f) return a.f - b.f;
  if (a.h !== b.h) return a.h - b.h;
  return a.seq - b.seq;
}

/**
 * Create a grid — a VIEW over the world, not a copy of it.
 *
 * The grid holds no city data. It asks two callbacks, every time it needs
 * to know something, so it can never go stale.
 *
 * @param {object} [opts]
 * @param {number} [opts.size] the grid size in cells
 * @param {Function} [opts.isBlocked] (x, z) => boolean
 * @param {Function} [opts.cost] (x, z) => number, a multiplier >= 1
 * @returns {object} the grid
 */
export function createGrid({ size = GRID.size, isBlocked = null, cost = null } = {}) {
  const n = Number.isFinite(size) && size > 0 ? Math.floor(size) : GRID.size;
  return {
    size: n,
    /** Is this cell impossible to enter? */
    isBlocked(x, z) {
      if (x < 0 || z < 0 || x >= n || z >= n) return true;
      return typeof isBlocked === 'function' ? !!isBlocked(x, z) : false;
    },
    /** How expensive it is to enter this cell. Never below 1. */
    cost(x, z) {
      if (typeof cost !== 'function') return 1;
      const value = Number(cost(x, z));
      return Number.isFinite(value) && value >= 1 ? value : 1;
    },
    /** Is this cell inside the grid? */
    inBounds(x, z) {
      return x >= 0 && z >= 0 && x < n && z < n;
    },
  };
}

/**
 * Find a path from one cell to another.
 *
 * @param {object} grid a grid from `createGrid`
 * @param {{x:number,z:number}} from
 * @param {{x:number,z:number}} to
 * @param {object} [opts]
 * @param {number} [opts.budget] the maximum number of cells to visit
 * @param {boolean} [opts.allowDiagonal] allow the 8-way neighbourhood
 * @returns {{ok:boolean, path:Array<{x:number,z:number}>|null, cost:number, visited:number, reason:string}}
 */
export function findPath(grid, from, to, opts = {}) {
  const budget = Number.isFinite(opts.budget) && opts.budget > 0
    ? Math.floor(opts.budget)
    : NAV_BUDGET;
  const allowDiagonal = opts.allowDiagonal !== false;

  const fail = (reason, extra = {}) => ({
    ok: false, path: null, cost: 0, visited: 0, reason, ...extra,
  });

  if (!grid || typeof grid.inBounds !== 'function') return fail('no-grid');
  const sx = Math.trunc(Number(from?.x));
  const sz = Math.trunc(Number(from?.z));
  const gx = Math.trunc(Number(to?.x));
  const gz = Math.trunc(Number(to?.z));
  if (!Number.isFinite(sx) || !Number.isFinite(sz) || !Number.isFinite(gx) || !Number.isFinite(gz)) {
    return fail('invalid-endpoint');
  }
  if (!grid.inBounds(sx, sz) || !grid.inBounds(gx, gz)) return fail('out-of-bounds');
  if (sx === gx && sz === gz) {
    return { ok: true, path: [{ x: sx, z: sz }], cost: 0, visited: 1, reason: 'trivial' };
  }
  // A goal the citizen cannot stand on is unreachable, and saying so is
  // more useful than returning an empty path.
  if (grid.isBlocked(gx, gz)) return fail('blocked-goal');

  const size = grid.size;
  const key = (x, z) => (z * size) + x;

  const open = new OpenSet();
  const best = new Map();          // key -> the cheapest known cost to reach it
  const cameFrom = new Map();      // key -> the key it was reached from
  const closed = new Set();

  const startKey = key(sx, sz);
  const goalKey = key(gx, gz);
  const startH = octile({ x: sx, z: sz }, { x: gx, z: gz });
  best.set(startKey, 0);
  open.push({ x: sx, z: sz, g: 0, h: startH, f: startH });

  let visited = 0;
  /** The expanded node that got closest to the goal — the budget fallback. */
  let nearest = null;

  while (open.size > 0) {
    if (visited >= budget) {
      return {
        ok: false,
        path: nearest ? rebuild(cameFrom, key(nearest.x, nearest.z), size) : null,
        cost: nearest ? nearest.g : 0,
        visited,
        reason: 'budget',
      };
    }

    const current = open.pop();
    if (!current) break;
    const currentKey = key(current.x, current.z);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    visited += 1;

    if (currentKey === goalKey) {
      return {
        ok: true,
        path: rebuild(cameFrom, currentKey, size),
        cost: current.g,
        visited,
        reason: 'found',
      };
    }

    if (!nearest || current.h < nearest.h) nearest = current;

    for (const step of NEIGHBOURS) {
      if (step.diagonal && !allowDiagonal) continue;
      const nx = current.x + step.dx;
      const nz = current.z + step.dz;
      if (!grid.inBounds(nx, nz)) continue;
      const neighbourKey = key(nx, nz);
      if (closed.has(neighbourKey)) continue;
      if (grid.isBlocked(nx, nz)) continue;
      if (step.diagonal) {
        // No corner cutting: a citizen cannot slip between two blocked
        // cells, because that looks like it walks through a wall.
        if (grid.isBlocked(current.x + step.dx, current.z)) continue;
        if (grid.isBlocked(current.x, current.z + step.dz)) continue;
      }
      const stepCost = (step.diagonal ? Math.SQRT2 : 1) * grid.cost(nx, nz);
      const tentative = current.g + stepCost;
      const known = best.get(neighbourKey);
      if (known !== undefined && tentative >= known) continue;
      best.set(neighbourKey, tentative);
      cameFrom.set(neighbourKey, currentKey);
      const h = octile({ x: nx, z: nz }, { x: gx, z: gz });
      open.push({ x: nx, z: nz, g: tentative, h, f: tentative + h });
    }
  }

  // The open set ran dry: the goal is enclosed.
  return {
    ok: false,
    path: nearest ? rebuild(cameFrom, key(nearest.x, nearest.z), size) : null,
    cost: nearest ? nearest.g : 0,
    visited,
    reason: 'unreachable',
  };
}

/**
 * Rebuild a path from the `cameFrom` chain.
 *
 * @param {Map} cameFrom
 * @param {number} endKey
 * @param {number} size
 * @returns {Array<{x:number,z:number}>}
 */
function rebuild(cameFrom, endKey, size) {
  const out = [];
  let k = endKey;
  let guard = 0;
  while (k !== undefined && guard < 100000) {
    out.push({ x: k % size, z: Math.floor(k / size) });
    k = cameFrom.get(k);
    guard += 1;
  }
  return out.reverse();
}

/**
 * Is the straight line between two cells clear of obstacles?
 *
 * The walk is a supercover line: it visits every cell the line passes
 * through, not just the ones it lands on, so a wall is never missed.
 *
 * @param {{x:number,z:number}} a
 * @param {{x:number,z:number}} b
 * @param {Function} isBlocked
 * @returns {boolean}
 */
export function lineIsClear(a, b, isBlocked) {
  if (typeof isBlocked !== 'function') return true;
  let x0 = Math.trunc(a.x);
  let z0 = Math.trunc(a.z);
  const x1 = Math.trunc(b.x);
  const z1 = Math.trunc(b.z);
  const dx = Math.abs(x1 - x0);
  const dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1;
  const sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  let guard = 0;
  while (guard < 100000) {
    if (!(x0 === Math.trunc(a.x) && z0 === Math.trunc(a.z)) && isBlocked(x0, z0)) return false;
    if (x0 === x1 && z0 === z1) return true;
    const e2 = 2 * err;
    if (e2 > -dz) { err -= dz; x0 += sx; }
    if (e2 < dx) { err += dx; z0 += sz; }
    guard += 1;
  }
  return false;
}

/**
 * Smooth a cell path: drop the cells between two turns.
 *
 * A citizen walking a path that steps cell by cell up a straight street
 * looks like it is on a staircase. The smoothed path keeps only the cells
 * where the direction changes, so the walk is a straight line where the
 * city allows it.
 *
 * @param {Array<{x:number,z:number}>} path
 * @param {Function} [isBlocked]
 * @returns {Array<{x:number,z:number}>} the smoothed path
 */
export function smoothPath(path, isBlocked) {
  if (!Array.isArray(path) || path.length < 3) {
    return Array.isArray(path) ? path.slice() : [];
  }
  const out = [path[0]];
  let anchor = 0;
  for (let i = 2; i < path.length; i += 1) {
    if (!lineIsClear(path[anchor], path[i], isBlocked)) {
      out.push(path[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

/**
 * Build a grid from the LIVE city.
 *
 * This is the bridge between the pathfinder and the game:
 *
 *   - WATER blocks: a citizen cannot walk into the flood;
 *   - BUILDINGS block their footprint;
 *   - a SLOPE costs more: the step cost rises with the height difference,
 *     so a citizen prefers the flat way round a hill.
 *
 * The grid reads the state tree live, so a building placed a moment ago
 * changes the routes immediately.
 *
 * @param {object} ctx the shared context
 * @param {object} [opts]
 * @param {number} [opts.size]
 * @param {boolean} [opts.blockBuildings]
 * @param {boolean} [opts.blockWater]
 * @returns {object} the grid
 */
export function createCityGrid(ctx, opts = {}) {
  const size = opts.size ?? ctx?.config?.GRID?.size ?? GRID.size;
  const blockBuildings = opts.blockBuildings !== false;
  const blockWater = opts.blockWater !== false;
  const slopeCost = Number.isFinite(opts.slopeCost) ? opts.slopeCost : (TUNING.citizenSlopeCost ?? 0.35);

  const state = ctx?.state ?? null;

  /**
   * The cells covered by a building.
   *
   * The set is rebuilt only when the number of buildings changes, so a
   * city that is not being edited pays nothing for it.
   */
  let buildingCells = new Set();
  let buildingCount = -1;

  function currentBuildingCells() {
    const instances = state?.buildings?.instances;
    const count = instances?.size ?? 0;
    if (buildingCount === count) return buildingCells;
    const cells = new Set();
    if (instances && typeof instances.values === 'function') {
      for (const instance of instances.values()) {
        const x = Math.trunc(Number(instance?.x));
        const z = Math.trunc(Number(instance?.z));
        if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
        cells.add(`${x},${z}`);
      }
    }
    buildingCells = cells;
    buildingCount = count;
    return cells;
  }

  const cellSize = Number(ctx?.config?.GRID?.cell ?? CELL);
  const wadeDepth = Number.isFinite(opts.wadeDepth)
    ? opts.wadeDepth
    : (TUNING.citizenWadeDepth ?? 0.05);

  /**
   * The height of a cell, in world units.
   *
   * The heightmap is read LIVE: the world domain replaces the array when
   * the terrain changes, and a grid that held the old array would route
   * citizens over a hill that is no longer there.
   *
   * @param {number} x
   * @param {number} z
   */
  function heightAt(x, z) {
    const heightmap = state?.world?.heightmap;
    if (!heightmap || !heightmap.length) return 0;
    const index = (z * size) + x;
    const value = Number(heightmap[index]);
    return Number.isFinite(value) ? value : 0;
  }

  /**
   * Is this cell under water?
   *
   * The state's `world.water` holds the DEPTH per cell — zero is dry
   * ground. A citizen will not wade through more than a film of water, so
   * the flood boundary is a wall the citizens route around.
   *
   * @param {number} x
   * @param {number} z
   */
  function isWaterAt(x, z) {
    const water = state?.world?.water;
    if (!water || !water.length) return false;
    const index = (z * size) + x;
    const depth = Number(water[index]);
    return Number.isFinite(depth) && depth > wadeDepth;
  }

  return createGrid({
    size,
    isBlocked(x, z) {
      if (blockBuildings && currentBuildingCells().has(`${x},${z}`)) return true;
      if (blockWater && isWaterAt(x, z)) return true;
      return false;
    },
    cost(x, z) {
      // The cost of standing on a slope: the height difference to the
      // STEEPEST neighbour. The steepest side dominates, because that is
      // the side a citizen has to climb — and because it makes the ground
      // AROUND a hill expensive as well as the hill itself.
      const here = heightAt(x, z);
      let steepest = 0;
      for (const step of NEIGHBOURS) {
        const nx = x + step.dx;
        const nz = z + step.dz;
        if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
        const diff = Math.abs(heightAt(nx, nz) - here);
        if (diff > steepest) steepest = diff;
      }
      // `cellSize` is the width of a cell in world units, so the height
      // difference is converted into a slope (rise over run).
      const slope = steepest / Math.max(1, cellSize);
      return 1 + (slope * slopeCost);
    },
  });
}
