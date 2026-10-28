/**
 * services/coverage.js — the SRV coverage maths.
 *
 * OWNER: SRV. Pure logic. This module MUST NOT import `three` so it can be
 * unit-tested in Node (see services.test.mjs).
 *
 * Implements the spatial half of the requirements dossier:
 *   FR-SRV-003  every service building carries a coverage profile
 *   FR-SRV-007  supply chains whose producers also own a spatial role
 *   FR-SRV-009  coverage is computed per map
 *   S28         "if one tile of a building is affected by an influence, all
 *               of the building counts as affected" - the coverage field is
 *               continuous and the *building* test is a threshold on it
 *   S6/S11      local coverage per building category is the metric the
 *               government panel reports
 *
 * ---------------------------------------------------------------------------
 * THE FALLOFF
 * ---------------------------------------------------------------------------
 * The publisher published NO falloff shape. This module uses a LINEAR
 * falloff in distance, which is the only shape that satisfies the two
 * published anchors of the coverage concept at once:
 *
 *   weight(d) = 1 - d / radius      for d <  radius
 *   weight(d) = 0                   for d >= radius
 *
 *   - at the facility itself the weight is 1 (full cover)
 *   - it decreases smoothly to 0
 *   - at exactly the radius the weight is 0: the radius is the OUTER edge of
 *     the field, and nothing beyond it is covered at all
 *
 * Overlapping facilities do not ADD their coverage: a cell takes the BEST
 * (maximum) weight any single facility gives it, so the result is always a
 * 0..1 ratio. A cell covered by two clinics is as covered as a cell covered
 * by one - the extra clinic buys CAPACITY (see `capacityVsDemand`), not a
 * second layer of coverage.
 */

import { CELL, GRID } from '../core/config.js';
import { cellKey, parseCellKey } from '../core/state.js';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * The coverage weight at a distance from a facility.
 *
 * @param {number} distance distance in WORLD UNITS
 * @param {number} radius   the facility radius in world units
 * @returns {number} 1 at the centre, 0 at and beyond the radius
 */
export function falloff(distance, radius) {
  const r = Number(radius);
  if (!Number.isFinite(r) || r <= 0) return 0;
  const d = Number(distance);
  if (!Number.isFinite(d) || d >= r) return 0;
  if (d <= 0) return 1;
  return 1 - d / r;
}

/** The distance between two cells, in world units. */
export function cellDistance(ax, az, bx, bz) {
  const dx = (Number(ax) - Number(bx)) * CELL;
  const dz = (Number(az) - Number(bz)) * CELL;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Normalise anything array-like into a list of facilities. */
function toFacilityList(facilities) {
  if (!facilities) return [];
  if (Array.isArray(facilities)) return facilities;
  if (facilities instanceof Map) return Array.from(facilities.values());
  if (typeof facilities.values === 'function') return Array.from(facilities.values());
  if (typeof facilities[Symbol.iterator] === 'function') return Array.from(facilities);
  return [];
}

/**
 * Normalise the many shapes an "occupied cells" argument can arrive in:
 *   - [{x, z}, ...]
 *   - [[x, z], ...]
 *   - [cellKey, ...]     (integers, decoded with the shared cellKey layout)
 *   - a Map<cellKey, weight>
 *
 * @param {any} cells
 * @returns {{x:number, z:number}[]}
 */
export function toCellList(cells) {
  if (!cells) return [];
  const out = [];
  const push = (x, z) => {
    const cx = Math.round(Number(x));
    const cz = Math.round(Number(z));
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) return;
    if (cx < 0 || cz < 0 || cx >= GRID.size || cz >= GRID.size) return;
    out.push({ x: cx, z: cz });
  };

  if (cells instanceof Map) {
    for (const key of cells.keys()) {
      const { x, z } = parseCellKey(key);
      push(x, z);
    }
    return out;
  }
  if (!Array.isArray(cells) && typeof cells[Symbol.iterator] === 'function') {
    cells = Array.from(cells);
  }
  if (!Array.isArray(cells)) return out;

  for (const c of cells) {
    if (c === null || c === undefined) continue;
    if (typeof c === 'number') {
      const { x, z } = parseCellKey(c);
      push(x, z);
      continue;
    }
    if (Array.isArray(c)) { push(c[0], c[1]); continue; }
    if (typeof c === 'object') { push(c.x, c.z); }
  }
  return out;
}

/** The effective radius of a facility (its own radius wins). */
export function facilityRadius(facility, fallbackRadius) {
  const own = Number(facility?.radius);
  if (Number.isFinite(own) && own > 0) return own;
  const fb = Number(fallbackRadius);
  return Number.isFinite(fb) && fb > 0 ? fb : 0;
}

// ---------------------------------------------------------------------------
// The public coverage maths
// ---------------------------------------------------------------------------

/**
 * The coverage weight at a cell.
 *
 * @param {object[]} facilities the facilities of ONE service
 * @param {number} cx cell x
 * @param {number} cz cell z
 * @param {number} radius fallback radius (world units) for facilities that do
 *        not carry their own
 * @returns {number} 0..1
 */
export function coverageAt(facilities, cx, cz, radius) {
  const list = toFacilityList(facilities);
  let best = 0;
  for (const f of list) {
    if (!f) continue;
    const r = facilityRadius(f, radius);
    if (r <= 0) continue;
    const w = falloff(cellDistance(cx, cz, f.x, f.z), r);
    if (w > best) best = w;
  }
  return best;
}

/**
 * The city-wide coverage of a service, weighted by the POPULATED cells only.
 *
 * The populated area is the set of cells that actually hold residents (the
 * footprint cells of the residential buildings). An empty grid is covered by
 * nothing meaningful, so the result is 0 when no cell is populated - it is
 * never "100 % covered" just because the map is big.
 *
 * @param {object[]} facilities the facilities of ONE service
 * @param {any} occupiedCells the populated cells (see `toCellList`)
 * @param {number} radius fallback radius (world units)
 * @returns {number} 0..1
 */
export function cityWideCoverage(facilities, occupiedCells, radius) {
  const cells = toCellList(occupiedCells);
  if (!cells.length) return 0;
  const list = toFacilityList(facilities);
  if (!list.length) return 0;
  let sum = 0;
  for (const c of cells) sum += coverageAt(list, c.x, c.z, radius);
  return sum / cells.length;
}

/**
 * The capacity of a set of facilities against the demand they face.
 *
 * Capacity per facility:
 *   - the facility's own `capacity` when it has one (the catalogue entry's
 *     authored `capacity.served`), otherwise
 *   - `perLevel` (TUNING.householdsPerService = 24 households per level-1
 *     service building) multiplied by the facility level.
 *
 * @param {object[]} facilities
 * @param {number} demand households that need the service
 * @param {number} perLevel households one level-1 service building serves
 * @returns {{capacity:number, demand:number, served:number, unmet:number}}
 */
export function capacityVsDemand(facilities, demand, perLevel) {
  const list = toFacilityList(facilities);
  const base = Math.max(0, Number(perLevel) || 0);
  let capacity = 0;
  for (const f of list) {
    if (!f) continue;
    const own = Number(f.capacity);
    if (Number.isFinite(own) && own > 0) {
      capacity += own;
    } else {
      const lv = Math.max(1, Math.round(Number(f.level) || 1));
      capacity += base * lv;
    }
  }
  const d = Math.max(0, Number(demand) || 0);
  const served = Math.min(capacity, d);
  return {
    capacity,
    demand: d,
    served,
    unmet: Math.max(0, d - capacity),
  };
}

/**
 * Rasterise one facility's coverage circle into a `Map<cellKey, weight>`.
 * The map only holds cells that are actually covered (weight > 0).
 *
 * @param {object} facility `{x, z, radius}`
 * @param {Map<number, number>} into the map to write into
 * @param {number} [gridSize] the grid edge (defaults to GRID.size)
 * @returns {Map<number, number>} the map that was written into
 */
export function rasteriseFacility(facility, into = new Map(), gridSize = GRID.size) {
  if (!facility) return into;
  const radius = facilityRadius(facility, 0);
  if (radius <= 0) return into;
  // The anchor may sit between cells (a multi-tile footprint is centred on
  // its middle), so the raster walks the INTEGER cells around it while the
  // distance is measured from the true anchor.
  const ax = Number(facility.x) || 0;
  const az = Number(facility.z) || 0;
  const baseX = Math.round(ax);
  const baseZ = Math.round(az);
  const tiles = Math.ceil(radius / CELL);
  for (let dz = -tiles; dz <= tiles; dz += 1) {
    for (let dx = -tiles; dx <= tiles; dx += 1) {
      const cx = baseX + dx;
      const cz = baseZ + dz;
      if (cx < 0 || cz < 0 || cx >= gridSize || cz >= gridSize) continue;
      const w = falloff(cellDistance(cx, cz, ax, az), radius);
      if (w <= 0) continue;
      const key = cellKey(cx, cz);
      const prev = into.get(key);
      if (prev === undefined || w > prev) into.set(key, w);
    }
  }
  return into;
}

/**
 * The cells a set of facilities covers, as a `Map<cellKey, weight>`.
 *
 * @param {object[]} facilities
 * @param {number} [radius] fallback radius
 * @returns {Map<number, number>}
 */
export function coverageMap(facilities, radius) {
  const out = new Map();
  for (const f of toFacilityList(facilities)) {
    if (!f || f.providesCoverage === false) continue;
    const r = facilityRadius(f, radius);
    if (r <= 0) continue;
    rasteriseFacility({ x: f.x, z: f.z, radius: r }, out);
  }
  return out;
}
