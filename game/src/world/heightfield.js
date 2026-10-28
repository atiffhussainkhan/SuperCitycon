/**
 * world/heightfield.js — SuperCitycon terrain heightfield (pure logic).
 *
 * OWNERSHIP: WLD (world domain). Pure module — **must not import `three`**
 * so the whole terrain model can be exercised head-less (NFR-WLD-013).
 *
 * WHAT THIS MODEL IS
 * ------------------
 * The shipped game models terrain as *integer layers* + modular voxel cliff
 * pieces (requirements §3.2 / §4.1). This module keeps the continuous
 * float heightmap the integration contract asks for (`state.world.heightmap`
 * is a Float32Array of world-unit heights, 0 = sea level) and derives the
 * layer/cliff information the rest of the game needs from it:
 *
 *   - `slopeAt()`   -> the per-edge cliff height class (R6).
 *   - `terrainTypeAt()` -> the per-cell surface type id (FR-WLD-042).
 *   - `waterLevelFor()`  -> the flood line (R3).
 *
 * Heights are in world units. One "layer" is `TUNING.heightStep` world units
 * (1.5), so a coastal plateau 4-6 voxels above the water (FR-WLD-036) is
 * 6..9 world units and `TUNING.maxTerrainHeight` (12) is 8 layers.
 *
 * HONESTY: every value the publisher never published is marked `// TBD:` and
 * collected in `WLD_TUNING` (see the final report for the proposed
 * `TUNING` additions in `core/config.js`).
 */

import { GRID, TUNING, makeRng } from '../core/config.js';

// --------------------------------------------------------------------------
// Tuning proposed by WLD — not yet published, not yet in core/config.js
// --------------------------------------------------------------------------

/**
 * TBD (proposed `TUNING` keys for `core/config.js`):
 *   - `rockLineHeight`            7.5  — land above this reads as bare rock.
 *   - `maxBuildSlope`             1.5  — max neighbour height delta a cell may
 *                                          have and still be buildable.
 *   - `treeSpacing`               2    — min cell distance between two trees.
 *   - `terrainRebuildIntervalMs`  250  — throttle for terrain mesh rebuilds.
 *   - `startDistrictRadius`       6    — radius in cells of the buildable
 *                                          starting district near the centre.
 *   - `startDistrictSceneryKeep`  0.25 — share of the scattered props that
 *                                          survive inside that district.
 */
export const WLD_TUNING = Object.freeze({
  /** TBD: elevation above the water line at which land reads as bare rock. */
  rockLineHeight: 9,
  /** TBD: max neighbour height difference that still counts as buildable. */
  maxBuildSlope: 1.5,
  /** TBD: minimum cell distance between two scattered trees. */
  treeSpacing: 2,
  /** TBD: minimum milliseconds between two terrain mesh rebuilds. */
  terrainRebuildIntervalMs: 250,
  /** TBD: radius (in cells) of the flat, buildable starting district. */
  startDistrictRadius: 6,
  /** TBD: share of the scattered props kept inside the starting district. */
  startDistrictSceneryKeep: 0.25,
  /** TBD: how far the biome boundary may be jittered (moisture units). */
  typeBoundaryJitter: 0.12,
});

/** Deepest water the generator produces (derived, not a magic number). */
export const MAX_WATER_DEPTH = TUNING.maxTerrainHeight * 0.75;

/**
 * One terrain LAYER, in world units (dossier §3.2 / FR-WLD-019).
 *
 * The terrain is not a continuous float heightmap: it is a per-cell INTEGER
 * elevation plus a per-cell surface piece plus per-edge cliff pieces. The
 * layer step is `TUNING.heightStep` (1.5 world units), so the published
 * maximum height of 12 is eight layers.
 */
export const LAYER_STEP = TUNING.heightStep;

/**
 * TBD: how far the ground apron reaches past the grid edge, in cells.
 *
 * 12 cells = 48 world units. The apron stops the map from floating with
 * bare sky under it (D-05) and the fog (180..460) swallows its far edge
 * before it can come into frame.
 */
export const APRON_CELLS = 12;

/**
 * Snap a world height onto the layer grid (dossier FR-WLD-019/020).
 *
 * Land lives on layers 1 and up (layer 0 is the flood line itself), the sea
 * on layer -1 and down. Snapping is what makes the terrain read as stacked
 * voxel terraces instead of a smooth field - and it is what keeps a
 * cell-boundary grid off the map: two neighbouring cells either share a
 * layer (no cliff, no crack) or differ by whole layers (one real cliff).
 *
 * @param {number} h a world height
 * @returns {number} the height of the layer that contains `h`
 */
export function quantiseHeight(h) {
  if (!Number.isFinite(h)) return 0;
  if (h >= 0) {
    // Land lives on layer 1 and up: layer 0 is the flood line itself.
    const layer = Math.max(1, Math.round(h / LAYER_STEP));
    return layer * LAYER_STEP;
  }
  return Math.floor(h / LAYER_STEP) * LAYER_STEP;
}

/** The layer INDEX of a world height (the integer elevation of FR-WLD-019). */
export function layerAt(h) {
  return Math.round(quantiseHeight(h) / LAYER_STEP);
}

// --------------------------------------------------------------------------
// Terrain type registry (FR-WLD-042)
// --------------------------------------------------------------------------

/** id -> surface type name. Stored in `state.world.types` as a Uint8Array. */
export const TERRAIN_TYPES = Object.freeze({
  0: 'water',
  1: 'sand',
  2: 'grass',
  3: 'forest',
  4: 'rock',
  5: 'dirt',
});

/** name -> id (inverse of TERRAIN_TYPES). */
export const TERRAIN_TYPE_IDS = Object.freeze({
  water: 0,
  sand: 1,
  grass: 2,
  forest: 3,
  rock: 4,
  dirt: 5,
});

/** Human labels for the surface-type tray (UX reads these). */
export const TERRAIN_TYPE_LABELS = Object.freeze({
  water: 'Water',
  sand: 'Sand',
  grass: 'Grass',
  forest: 'Forest',
  rock: 'Rock',
  dirt: 'Dirt',
});

// --------------------------------------------------------------------------
// Deterministic value noise
// --------------------------------------------------------------------------

/** 32-bit integer hash of a 2D lattice point. */
function hash2(x, y, seed) {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ Math.imul(x | 0, 0x27d4eb2f), 0x165667b1);
  h = Math.imul(h ^ Math.imul(y | 0, 0x85ebca6b), 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0,1] at a continuous position. */
export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const top = a + (b - a) * u;
  const bot = c + (d - c) * u;
  return top + (bot - top) * v;
}

/** Fractal brownian motion in [0,1]. */
export function fbm(x, y, seed = 0, octaves = 5, lacunarity = 2.03, gain = 0.5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * valueNoise(x * freq, y * freq, seed + o * 1013);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

// --------------------------------------------------------------------------
// Generation
// --------------------------------------------------------------------------

/**
 * Generate a seeded landmass: a noisy coastline, a plain, hills and at least
 * one open water body (FR-WLD-038/039/040).
 *
 * The generator works on a "field" in [0,1] (high = high land):
 *   field = 0.62 * large-scale coast gradient + 0.38 * domain-warped fBm
 * The flood line is the quantile of that field, so the water fraction is
 * exactly `TUNING.waterFraction` (measured and reported in the test suite).
 *
 * @param {number} seed
 * @param {number} [size] grid size in cells (square)
 * @returns {Float32Array} heights in world units, 0 = sea level
 */
export function generateHeightmap(seed = 0, size = GRID.size) {
  const n = size * size;
  const hf = new Float32Array(n);
  if (n === 0) return hf;

  const rng = makeRng(seed >>> 0);
  const field = new Float32Array(n);

  // Direction of the coast: the sea lies on the low side of this gradient.
  const ang = rng() * Math.PI * 2;
  const gx = Math.cos(ang);
  const gz = Math.sin(ang);

  // Domain-warp offsets for the fBm (breaks up the grid signature).
  const warpX = 14 + rng() * 12;
  const warpZ = 14 + rng() * 12;
  const noiseSeed = (seed >>> 0) ^ 0x5eed;

  for (let cz = 0; cz < size; cz += 1) {
    for (let cx = 0; cx < size; cx += 1) {
      const fx = cx + 0.5;
      const fz = cz + 0.5;

      // Domain warp.
      const wx = fx + warpX * (valueNoise(fx * 0.031 + 17.3, fz * 0.031 - 4.1, noiseSeed + 7) - 0.5);
      const wz = fz + warpZ * (valueNoise(fx * 0.031 - 9.7, fz * 0.031 + 21.9, noiseSeed + 13) - 0.5);

      // fBm in cell units (2.6 features across the map).
      const f = fbm(wx * (2.6 / size), wz * (2.6 / size), noiseSeed, 5);

      // Large-scale coast gradient across the map.
      const u = (cx + 0.5) / size - 0.5;
      const v = (cz + 0.5) / size - 0.5;
      const g = u * gx + v * gz;
      const grad = smooth(Math.min(1, Math.max(0, (g + 0.42) / 0.84)));

      field[cz * size + cx] = 0.62 * grad + 0.38 * f;
    }
  }

  // ---- flood line: the quantile that yields TUNING.waterFraction --------
  const sorted = Float32Array.from(field);
  sorted.sort();
  const m = Math.floor(TUNING.waterFraction * n);       // cells that flood
  const lo = sorted[Math.max(0, m - 1)];
  const hi = sorted[Math.min(n - 1, m)];
  const sea = (lo + hi) * 0.5;                          // mid-way -> no ties

  // ---- shape the elevation profile -------------------------------------
  // Land: a plateau that climbs into hills (FR-WLD-036, FR-WLD-038).
  // Water: shallow at the shore, deep offshore.
  let eMax = 0;
  let eMinAbs = 0;
  for (let i = 0; i < n; i += 1) {
    const e = field[i] - sea;
    if (e > 0) { if (e > eMax) eMax = e; }
    else if (-e > eMinAbs) eMinAbs = -e;
  }
  eMax = eMax || 1;
  eMinAbs = eMinAbs || 1;

  for (let i = 0; i < n; i += 1) {
    const e = field[i] - sea;
    if (e > 0) {
      const r = e / eMax;
      hf[i] = TUNING.maxTerrainHeight * (0.45 * r + 0.55 * r * r);
    } else {
      const d = -e / eMinAbs;
      hf[i] = -MAX_WATER_DEPTH * (0.35 * d + 0.65 * d * d);
    }
  }

  // ---- put the datum exactly on the flood line --------------------------
  // After this the lowest dry land cell sits at exactly 0 and every flooded
  // cell is < 0, so `waterLevelFor()` returns 0 and the water fraction is
  // exactly m/n.
  let hMinPos = Infinity;
  let hMaxPos = -Infinity;
  for (let i = 0; i < n; i += 1) {
    if (hf[i] > 0) {
      if (hf[i] < hMinPos) hMinPos = hf[i];
      if (hf[i] > hMaxPos) hMaxPos = hf[i];
    }
  }
  if (!Number.isFinite(hMinPos)) { hMinPos = 0; hMaxPos = 1; }
  const k = TUNING.maxTerrainHeight / Math.max(1e-6, hMaxPos - hMinPos);
  for (let i = 0; i < n; i += 1) {
    let h = (hf[i] - hMinPos) * k;
    if (h < -MAX_WATER_DEPTH) h = -MAX_WATER_DEPTH;
    hf[i] = h;
  }

  // ---- snap the map onto the layer grid ---------------------------------
  // D-02: the terrain is a stack of integer layers (FR-WLD-019). Cells that
  // share a layer have exactly the same height, so no cliff face is drawn
  // between them and the map shows terraces instead of a cell-boundary grid.
  //
  // The water fraction is NOT changed: a dry cell (h >= 0) snaps to at least
  // layer 1 and a flooded cell (h < 0) snaps to at most layer -1, so exactly
  // the same cells stay dry and flooded.
  for (let i = 0; i < n; i += 1) hf[i] = quantiseHeight(hf[i]);

  // ---- carve the starting district -------------------------------------
  // The first minutes of play must not be a hunt for a free, level, dry cell.
  // The district is a pure function of the map, so the same seed always
  // produces the same one.
  flattenStartingDistrict(hf, size);

  return hf;
}

// --------------------------------------------------------------------------
// The starting district
// --------------------------------------------------------------------------

/**
 * Find the buildable starting district: a square of level, dry land as close
 * to the middle of the map as possible.
 *
 * The search is a PURE function of the heightmap, so the same seed always
 * yields the same district (determinism).
 *
 * A candidate centre scores on
 *   - dryness     — every cell of the square must be above the flood line
 *                   (a hard requirement; a district in the sea is useless)
 *   - flatness    — the height spread across the square, in world units
 *   - centrality  — the distance from the middle of the map
 *
 * Flatness dominates the score, so the flattest dry square wins; ties are
 * broken by distance to the middle and then by scan order, which keeps the
 * result deterministic.
 *
 * @param {Float32Array} hf
 * @param {number} [size]
 * @param {{radius?:number, level?:number}} [opts]
 * @returns {{cx:number, cz:number, radius:number, size:number, level:number,
 *            flat:number, distance:number}|null}
 */
export function startingDistrict(hf, size = sizeOf(hf), opts = {}) {
  if (!hf || !hf.length) return null;
  const radius = Math.max(1, Math.floor(opts.radius ?? WLD_TUNING.startDistrictRadius));
  const level = opts.level ?? 0;
  const mid = (size - 1) / 2;
  const span = radius * 2 + 1;

  let best = null;
  for (let cz = radius; cz < size - radius; cz += 1) {
    for (let cx = radius; cx < size - radius; cx += 1) {
      let min = Infinity;
      let max = -Infinity;
      let dry = true;
      for (let j = -radius; j <= radius && dry; j += 1) {
        for (let i = -radius; i <= radius; i += 1) {
          const h = hf[(cz + j) * size + (cx + i)];
          if (!(h > level)) { dry = false; break; }
          if (h < min) min = h;
          if (h > max) max = h;
        }
      }
      if (!dry) continue;
      const flat = max - min;
      const distance = Math.hypot(cx - mid, cz - mid);
      const score = flat * 1000 + distance;
      if (!best || score < best.score) {
        best = { cx, cz, radius, size: span, level, flat, distance, score };
      }
    }
  }
  return best;
}

/**
 * Level the starting district so the player starts on flat, dry ground.
 *
 * The core of the district is flattened to one height; a two-cell ring around
 * it is blended back into the original terrain so the district does not sit on
 * a cliff edge.
 *
 * IMPORTANT: the water fraction is NOT changed. Only cells that are already
 * above the flood line are rewritten, and every new value is a convex
 * combination of two values above the flood line - so no cell can drown.
 *
 * @param {Float32Array} hf
 * @param {number} [size]
 * @param {{radius?:number, level?:number}} [opts]
 * @returns {object|null} the district that was flattened
 */
export function flattenStartingDistrict(hf, size = sizeOf(hf), opts = {}) {
  const d = startingDistrict(hf, size, opts);
  if (!d) return null;
  const { cx, cz, radius, level } = d;

  // The target height: the layer of the centre cell, so the district is a
  // flat terrace that sits on the layer grid like the rest of the map.
  const centreH = hf[cz * size + cx];
  let target = quantiseHeight(centreH);
  if (!(target > level)) target = quantiseHeight(level + LAYER_STEP);

  // --- the core: dead level ---------------------------------------------
  for (let j = -radius; j <= radius; j += 1) {
    for (let i = -radius; i <= radius; i += 1) {
      hf[(cz + j) * size + (cx + i)] = target;
    }
  }

  // --- the blend ring ----------------------------------------------------
  // Two rings of cells step back towards the original terrain. Cells that
  // are under water are left alone: rewriting them would change the water
  // fraction.
  for (let ring = 1; ring <= 2; ring += 1) {
    const w = ring === 1 ? 0.65 : 0.3;
    for (let j = -radius - ring; j <= radius + ring; j += 1) {
      for (let i = -radius - ring; i <= radius + ring; i += 1) {
        if (Math.abs(i) <= radius && Math.abs(j) <= radius) continue;
        const nx = cx + i;
        const nz = cz + j;
        if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
        const idx = nz * size + nx;
        const original = hf[idx];
        if (!(original > level)) continue;   // never drown a cell
        // The ring is snapped back onto the layer grid, so the transition
        // around the district is a stepped terrace, not a smooth ramp.
        hf[idx] = quantiseHeight(original + (target - original) * w);
      }
    }
  }

  return { ...d, target };
}

// --------------------------------------------------------------------------
// Sampling & queries
// --------------------------------------------------------------------------

/** Size (cells per side) implied by a heightmap length. */
export function sizeOf(hf) {
  return Math.round(Math.sqrt(hf.length));
}

/**
 * Bilinearly interpolated height at a (possibly fractional) cell coordinate.
 * At integer coordinates this returns the exact cell height.
 */
export function sampleHeight(hf, cx, cz) {
  const size = sizeOf(hf);
  if (!size) return 0;
  const x = Math.min(size - 1, Math.max(0, cx));
  const z = Math.min(size - 1, Math.max(0, cz));
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = Math.min(size - 1, x0 + 1);
  const z1 = Math.min(size - 1, z0 + 1);
  const fx = x - x0;
  const fz = z - z0;
  const h00 = hf[z0 * size + x0];
  const h10 = hf[z0 * size + x1];
  const h01 = hf[z1 * size + x0];
  const h11 = hf[z1 * size + x1];
  const top = h00 + (h10 - h00) * fx;
  const bot = h01 + (h11 - h01) * fx;
  return top + (bot - top) * fz;
}

/**
 * The sea level implied by a heightmap: the level at which exactly
 * `TUNING.waterFraction` of the map is flooded (the flood line, R3).
 *
 * The terrain lives on LAYER boundaries, so the flood line is a layer
 * boundary too: it is the boundary that separates the flooded block from
 * the dry block. For a generated map that is the datum (0): dry land sits on
 * layer 1 or higher, the seabed on layer -1 or lower.
 */
export function seaLevelFor(hf, targetFraction = TUNING.waterFraction) {
  const n = hf.length;
  if (!n) return 0;
  const sorted = Float32Array.from(hf);
  sorted.sort();
  const idx = Math.min(n - 1, Math.max(0, Math.floor(targetFraction * n)));
  const above = sorted[idx];
  const below = idx > 0 ? sorted[idx - 1] : above;
  // The gap between the two blocks, snapped to the layer grid towards the
  // dry side. For a generated map this is exactly 0.
  const mid = (below + above) / 2;
  const level = Math.ceil(mid / LAYER_STEP - 1e-9) * LAYER_STEP;
  return level === 0 ? 0 : level;   // never -0
}

/** Lowest height in the map. */
export function minHeight(hf) {
  let m = Infinity;
  for (let i = 0; i < hf.length; i += 1) if (hf[i] < m) m = hf[i];
  return m === Infinity ? 0 : m;
}

/** Highest height in the map. */
export function maxHeight(hf) {
  let m = -Infinity;
  for (let i = 0; i < hf.length; i += 1) if (hf[i] > m) m = hf[i];
  return m === -Infinity ? 0 : m;
}

/**
 * The largest height difference between a cell and its neighbours — the
 * cliff height class of the exposed edges (R6). Uses the 8 surrounding
 * cells; out-of-bounds neighbours are ignored.
 */
export function slopeAt(hf, cx, cz) {
  const size = sizeOf(hf);
  if (!size) return 0;
  const x = Math.min(size - 1, Math.max(0, Math.round(cx)));
  const z = Math.min(size - 1, Math.max(0, Math.round(cz)));
  const h = hf[z * size + x];
  let max = 0;
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dz === 0) continue;
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const d = Math.abs(hf[nz * size + nx] - h);
      if (d > max) max = d;
    }
  }
  return max;
}

/**
 * True when the cell is below the flood line.
 *
 * The default level is 0 because the generator puts the map datum ON the
 * flood line (sea level == 0 world units). Deriving the level per call
 * would cost a full sort of the heightmap, so hot paths pass the level in.
 */
export function isWater(hf, cx, cz, level = 0) {
  return sampleHeight(hf, cx, cz) < level;
}

/** Water depth over a cell (0 on dry land). */
export function waterDepth(hf, cx, cz, level = 0) {
  const d = level - sampleHeight(hf, cx, cz);
  return d > 0 ? d : 0;
}

// --------------------------------------------------------------------------
// Surface types
// --------------------------------------------------------------------------

/**
 * Deterministic "moisture" noise in [0,1] for a cell position.
 */
export function moistureAt(cx, cz) {
  const x = cx * 0.08;
  const z = cz * 0.08;
  const a = fbm(x, z, 0x5e7d, 3);
  const b = valueNoise(x * 2.7 + 11.2, z * 2.7 - 4.4, 0x1eaf);
  return Math.min(1, Math.max(0, a * 0.78 + b * 0.22));
}

/**
 * D-04: the high-frequency term that breaks the straight iso-lines of the
 * large-scale moisture gradient.
 *
 * It is deliberately NOT folded into `moistureAt()`: folding it in would move
 * the whole moisture distribution and shift the type histogram. Applied as a
 * zero-mean JITTER on the biome thresholds instead, cells cross a boundary in
 * both directions and the histogram stays where it was.
 *
 * @returns {number} a deterministic value in [-1, 1]
 */
export function typeJitterAt(cx, cz) {
  const a = valueNoise(cx * 0.31 + 5.7, cz * 0.31 - 2.3, 0x3b17);
  const b = valueNoise(cx * 0.77 - 8.1, cz * 0.77 + 4.9, 0x77c3);
  return (a * 0.7 + b * 0.3) * 2 - 1;
}

/**
 * The surface type of a cell: `'water' | 'sand' | 'grass' | 'forest' |
 * 'rock' | 'dirt'` (FR-WLD-042).
 *
 * The default level is 0 (the map datum is the flood line — see
 * `seaLevelFor` for the explicit derivation).
 *
 * Rules (deterministic, derived from height + slope + moisture):
 *   - below the flood line                       -> water
 *   - within one layer of the flood line         -> sand  (beach, FR-WLD-064)
 *   - above the rock line or too steep to build  -> rock
 *   - otherwise by moisture: forest / dirt / grass
 */
export function terrainTypeAt(hf, cx, cz, level = 0) {
  const lv = level;
  const h = sampleHeight(hf, cx, cz);
  if (h < lv) return 'water';

  const above = h - lv;
  if (above <= TUNING.heightStep) return 'sand';

  const slope = slopeAt(hf, cx, cz);
  if (above >= WLD_TUNING.rockLineHeight || slope > WLD_TUNING.maxBuildSlope * 2) return 'rock';

  const m = moistureAt(Math.round(cx), Math.round(cz));
  // D-04: the biome boundary is jittered by a high-frequency, zero-mean term
  // so it stops following the straight iso-lines of the moisture gradient.
  // The jitter is symmetric, so the type histogram does not shift.
  const jitter = typeJitterAt(Math.round(cx), Math.round(cz)) * WLD_TUNING.typeBoundaryJitter;
  if (m + jitter >= 0.52) return 'forest';
  if (m + jitter <= 0.35) return 'dirt';
  return 'grass';
}

/** The surface type id of a cell (index into TERRAIN_TYPES). */
export function terrainTypeIdAt(hf, cx, cz, level = 0) {
  const name = terrainTypeAt(hf, cx, cz, level);
  return TERRAIN_TYPE_IDS[name] ?? TERRAIN_TYPE_IDS.grass;
}

// --------------------------------------------------------------------------
// Derived maps
// --------------------------------------------------------------------------

/**
 * Water depth per cell: `max(0, waterLevel - height)`.
 * @returns {Float32Array}
 */
export function generateWaterMap(hf, size = sizeOf(hf), level = null) {
  const n = size * size;
  const lv = level === null ? seaLevelFor(hf) : level;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const d = lv - hf[i];
    out[i] = d > 0 ? d : 0;
  }
  return out;
}

/**
 * Surface type ids per cell.
 * @returns {Uint8Array}
 */
export function generateTypeMap(hf, size = sizeOf(hf), level = null) {
  const n = size * size;
  const lv = level === null ? seaLevelFor(hf) : level;
  const out = new Uint8Array(n);
  for (let cz = 0; cz < size; cz += 1) {
    for (let cx = 0; cx < size; cx += 1) {
      out[cz * size + cx] = terrainTypeIdAt(hf, cx, cz, lv);
    }
  }
  return out;
}

/** Histogram of surface types: `{ water: 123, grass: 456, ... }`. */
export function typeHistogram(types) {
  const out = {};
  for (let i = 0; i < types.length; i += 1) {
    const name = TERRAIN_TYPES[types[i]] ?? 'grass';
    out[name] = (out[name] || 0) + 1;
  }
  return out;
}

// --------------------------------------------------------------------------
// Editing
// --------------------------------------------------------------------------

/**
 * Set the height of a cell. Out-of-bounds cells are never written (E1).
 *
 * The height is snapped onto the layer grid (FR-WLD-019): the terrain is
 * made of integer layers, so the terraform tools always move whole layers.
 *
 * @returns {number|null} the new height, or null when rejected
 */
export function setHeight(hf, cx, cz, h) {
  const size = sizeOf(hf);
  if (cx < 0 || cz < 0 || cx >= size || cz >= size) return null;
  let v = quantiseHeight(h);
  if (v > TUNING.maxTerrainHeight) v = TUNING.maxTerrainHeight;
  if (v < -MAX_WATER_DEPTH) v = -MAX_WATER_DEPTH;
  hf[cz * size + cx] = v;
  return v;
}

/**
 * Raise (or lower) a cell by `delta`. Clamped to the terrain range; the
 * operation is idempotent for a zero delta (FR-WLD-035).
 *
 * The result is snapped onto the layer grid, so a raise of one layer step
 * (TUNING.heightStep) lifts the cell onto the next layer exactly.
 *
 * @returns {number|null} the new height, or null when rejected
 */
export function raiseTerrain(hf, cx, cz, delta) {
  const size = sizeOf(hf);
  if (cx < 0 || cz < 0 || cx >= size || cz >= size) return null;
  const i = cz * size + cx;
  let v = quantiseHeight(hf[i] + delta);
  if (v > TUNING.maxTerrainHeight) v = TUNING.maxTerrainHeight;
  if (v < -MAX_WATER_DEPTH) v = -MAX_WATER_DEPTH;
  hf[i] = v;
  return v;
}

/**
 * Smooth the heightmap: each pass replaces every cell with the mean of its
 * 3x3 neighbourhood (R9). Mutates in place and returns the map.
 */
export function smoothHeightmap(hf, size = sizeOf(hf), passes = 1) {
  if (passes <= 0) return hf;
  let src = hf;
  let dst = new Float32Array(hf.length);
  for (let p = 0; p < passes; p += 1) {
    for (let cz = 0; cz < size; cz += 1) {
      for (let cx = 0; cx < size; cx += 1) {
        let sum = 0;
        let count = 0;
        for (let dz = -1; dz <= 1; dz += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
            sum += src[nz * size + nx];
            count += 1;
          }
        }
        dst[cz * size + cx] = count ? sum / count : src[cz * size + cx];
      }
    }
    const t = src === hf ? new Float32Array(hf.length) : src;
    src = dst;
    dst = t;
  }
  if (src !== hf) hf.set(src);
  return hf;
}
