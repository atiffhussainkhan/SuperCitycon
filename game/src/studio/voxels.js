/**
 * studio/voxels.js — the voxel data model (FR-STD-014 … FR-STD-143).
 *
 * OWNER: STD (BOT-08). PURE module — MUST NOT import `three`, so the whole
 * data model, the OBJ export/import and the workshop serialisation can be
 * unit-tested in Node.
 *
 * THE DOCUMENTED SHAPE (dossier §6.1/§6.2/§6.3)
 *   VoxelModel  { id, kind, parentAssetId, dims, pivot, voxels, paletteId,
 *                 formatVersion, contentHash }
 *   Voxel       { x, y, z, materialIndex }
 *   MaterialSet { id, name, entries[] }   — index-addressed (FR-STD-035)
 *
 * HONESTY NOTES
 *   - Materials are addressed by INDEX into a palette, never by raw RGB
 *     (FR-STD-035/FR-STD-099 — the developer's own workflow shows indexed
 *     colours). The palette here is the game's 16-colour `config.PALETTE`;
 *     index 0 is reserved for "empty", so the palette entries run 1..16.
 *   - The authoring volume's resolution is NOT published (OQ-STD-02). The
 *     default below is a PROPOSED value, flagged as assumed.
 *   - The construction-cost derivation is NOT published (OQ-STD-33); ECO owns
 *     the formula. What this module emits is the derivation INPUTS plus a
 *     clearly-marked proposed value the caller may override.
 */

import { PALETTE, PALETTE_NAMES } from '../core/config.js';

/** The asset kinds the editor can author (FR-STD-001…FR-STD-010). */
export const ASSET_KINDS = Object.freeze([
  'building', 'vehicle', 'citizen', 'prop', 'terrain_set', 'character', 'map',
]);

/**
 * The authoring volume's default size, in VOXELS.
 *
 * TBD — design decision (OQ-STD-02): the dossier publishes only the
 * 32-voxel cell (a one-cell model is 32x32x32). 32 is used here because it
 * is the published cell size; the value is reported as "assumed".
 */
export const DEFAULT_DIMS = Object.freeze({ x: 32, y: 32, z: 32 });

/**
 * The voxel-to-world-cell mapping: 32 voxels = 1 world cell (FR-STD-043,
 * evidenced by the developer's MagicaVoxel tutorial).
 */
export const VOXELS_PER_CELL = 32;

/** The serialised format's version (FR-STD-101 — a hard contract). */
export const FORMAT_VERSION = 1;

/** The current asset format version string. */
export const ASSET_FORMAT = 'sccasset/1';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

/**
 * The number of colours in the studio's material set.
 *
 * `config.PALETTE` is the game's retro 16-bit palette; it carries MORE than
 * sixteen named entries (the terrain colours live in the same object). The
 * studio's material set is the documented SIXTEEN-colour set — the first
 * sixteen entries of `config.PALETTE`, in the palette's own order — and the
 * material indices run 1..16 so that index 0 stays "empty" (FR-STD-035).
 */
export const PALETTE_SIZE = 16;

/**
 * Build the material set from the game's 16-bit palette.
 * Index 0 is reserved for "empty"; entries run 1..16.
 *
 * @param {object} [palette] the raw PALETTE object (injectable for tests)
 * @param {number} [limit=16] how many palette entries to take
 * @returns {Array<{index:number,name:string,color:number,css:string}>}
 */
export function buildPalette(palette = PALETTE, limit = PALETTE_SIZE) {
  const names = Object.keys(palette).slice(0, Math.max(0, limit));
  return names.map((name, i) => ({
    index: i + 1,
    name,
    color: palette[name],
    css: `#${palette[name].toString(16).padStart(6, '0')}`,
  }));
}

/** The default material set (the game's 16-bit palette). */
export function defaultPalette() {
  return buildPalette(PALETTE);
}

/** Look a palette entry up by its material index. */
export function paletteEntry(palette, index) {
  if (!Array.isArray(palette)) return null;
  return palette.find((p) => p.index === index) ?? null;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** The voxel map key format: "x,y,z". */
export function voxelKey(x, y, z) {
  return `${x},${y},${z}`;
}

/** Parse a voxel map key back into coordinates. */
export function parseVoxelKey(key) {
  const parts = String(key).split(',');
  if (parts.length !== 3) return null;
  const [x, y, z] = parts.map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

/** Clamp a coordinate into the authoring volume. */
export function clampVoxel(x, y, z, dims = DEFAULT_DIMS) {
  return {
    x: Math.min(dims.x - 1, Math.max(0, Math.round(x))),
    y: Math.min(dims.y - 1, Math.max(0, Math.round(y))),
    z: Math.min(dims.z - 1, Math.max(0, Math.round(z))),
  };
}

/** True when the coordinate lies inside the authoring volume. */
export function inVoxelBounds(x, y, z, dims = DEFAULT_DIMS) {
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z)
    && x >= 0 && y >= 0 && z >= 0
    && x < dims.x && y < dims.y && z < dims.z;
}

/**
 * The bounding box of the occupied voxels.
 * @returns {{min:{x,y,z},max:{x,y,z},size:{x,y,z},empty:boolean}}
 */
export function voxelBounds(voxels) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  let count = 0;
  for (const key of voxels.keys()) {
    const c = parseVoxelKey(key);
    if (!c) continue;
    count += 1;
    min.x = Math.min(min.x, c.x); min.y = Math.min(min.y, c.y); min.z = Math.min(min.z, c.z);
    max.x = Math.max(max.x, c.x); max.y = Math.max(max.y, c.y); max.z = Math.max(max.z, c.z);
  }
  if (!count) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: -1, y: -1, z: -1 }, size: { x: 0, y: 0, z: 0 }, empty: true, count: 0 };
  }
  return {
    min,
    max,
    size: { x: max.x - min.x + 1, y: max.y - min.y + 1, z: max.z - min.z + 1 },
    empty: false,
    count,
  };
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/**
 * Write a voxel into the map.
 *
 * The stored record is the contract's `{ color, id }`:
 *   - `id`   — the MATERIAL INDEX into the palette (FR-STD-035: materials
 *              are addressed by index, so a palette change restyles the model
 *              without rewriting a single voxel);
 *   - `color`— the palette entry's colour at the time of the edit, kept so
 *              the record still carries a colour for consumers that want one.
 *              The renderer and the OBJ writer always resolve through `id`.
 *
 * @param {Map<string,object>} voxels
 * @param {number} x @param {number} y @param {number} z
 * @param {number} materialIndex index into the palette (0 = empty -> erase)
 * @param {object} [options] `{palette, dims}`
 * @returns {{ok:boolean, reason:string|null, key:string|null}}
 */
export function paintVoxel(voxels, x, y, z, materialIndex, options = {}) {
  const dims = options.dims ?? DEFAULT_DIMS;
  const palette = options.palette ?? defaultPalette();
  if (!voxels || typeof voxels.set !== 'function') return { ok: false, reason: 'no-map', key: null };
  if (!inVoxelBounds(x, y, z, dims)) return { ok: false, reason: 'out-of-bounds', key: null };
  const index = Number(materialIndex);
  if (!Number.isInteger(index) || index < 1) return { ok: false, reason: 'bad-material', key: null };
  const entry = paletteEntry(palette, index);
  if (!entry) return { ok: false, reason: 'unknown-material', key: null };
  const key = voxelKey(x, y, z);
  voxels.set(key, { color: entry.color, id: index });
  return { ok: true, reason: null, key };
}

/**
 * Clear a voxel.
 * @returns {{ok:boolean, reason:string|null, key:string|null}}
 */
export function eraseVoxel(voxels, x, y, z, options = {}) {
  const dims = options.dims ?? DEFAULT_DIMS;
  if (!voxels || typeof voxels.delete !== 'function') return { ok: false, reason: 'no-map', key: null };
  if (!inVoxelBounds(x, y, z, dims)) return { ok: false, reason: 'out-of-bounds', key: null };
  const key = voxelKey(x, y, z);
  const existed = voxels.delete(key);
  return { ok: true, reason: null, key, existed };
}

/**
 * Recolour an occupied voxel without changing its occupancy (FR-STD-019).
 * @returns {{ok:boolean, reason:string|null, key:string|null}}
 */
export function paintMaterial(voxels, x, y, z, materialIndex, options = {}) {
  const dims = options.dims ?? DEFAULT_DIMS;
  const palette = options.palette ?? defaultPalette();
  if (!inVoxelBounds(x, y, z, dims)) return { ok: false, reason: 'out-of-bounds', key: null };
  const key = voxelKey(x, y, z);
  if (!voxels.has(key)) return { ok: false, reason: 'empty-cell', key };
  const entry = paletteEntry(palette, Number(materialIndex));
  if (!entry) return { ok: false, reason: 'unknown-material', key };
  voxels.set(key, { color: entry.color, id: entry.index });
  return { ok: true, reason: null, key };
}

/**
 * Paint a square brush of the given size centred on (x, y, z).
 * A brush of 1 paints exactly one voxel; a brush of 3 paints a 3x3 column
 * slice in X/Z at the same Y (the height is never smeared — that would be
 * an unevidenced behaviour).
 *
 * @returns {{ok:boolean, painted:number, keys:string[]}}
 */
export function paintBrush(voxels, x, y, z, materialIndex, size = 1, options = {}) {
  const dims = options.dims ?? DEFAULT_DIMS;
  const n = Math.max(1, Math.round(Number(size) || 1));
  const half = Math.floor((n - 1) / 2);
  const keys = [];
  let painted = 0;
  for (let dz = -half; dz <= half; dz += 1) {
    for (let dx = -half; dx <= half; dx += 1) {
      const r = paintVoxel(voxels, x + dx, y, z + dz, materialIndex, options);
      if (r.ok) { painted += 1; keys.push(r.key); }
    }
  }
  return { ok: painted > 0, painted, keys };
}

/** Erase a square brush. */
export function eraseBrush(voxels, x, y, z, size = 1, options = {}) {
  const dims = options.dims ?? DEFAULT_DIMS;
  const n = Math.max(1, Math.round(Number(size) || 1));
  const half = Math.floor((n - 1) / 2);
  const keys = [];
  let erased = 0;
  for (let dz = -half; dz <= half; dz += 1) {
    for (let dx = -half; dx <= half; dx += 1) {
      const r = eraseVoxel(voxels, x + dx, y, z + dz, options);
      if (r.ok && r.existed) { erased += 1; keys.push(r.key); }
    }
  }
  return { ok: erased > 0, erased, keys };
}

// ---------------------------------------------------------------------------
// Footprint + derivation inputs
// ---------------------------------------------------------------------------

/**
 * The world-cell footprint of the model (FR-STD-043): the set of (x, z) cells
 * under the occupied voxels, at 32 voxels per world cell.
 *
 * @returns {Array<{x:number,z:number}>}
 */
export function footprintCells(voxels, voxelsPerCell = VOXELS_PER_CELL) {
  const cells = new Set();
  for (const key of voxels.keys()) {
    const c = parseVoxelKey(key);
    if (!c) continue;
    cells.add(`${Math.floor(c.x / voxelsPerCell)},${Math.floor(c.z / voxelsPerCell)}`);
  }
  return Array.from(cells).sort().map((k) => {
    const [x, z] = k.split(',').map(Number);
    return { x, z };
  });
}

/**
 * The derivation INPUT snapshot (dossier §6.6). The published record names
 * no inputs, so this list is a rebuild decision and is reported as such.
 */
export function derivationInputs(voxels, dims = DEFAULT_DIMS) {
  const bounds = voxelBounds(voxels);
  const histogram = new Map();
  for (const rec of voxels.values()) {
    const id = rec?.id ?? 0;
    histogram.set(id, (histogram.get(id) ?? 0) + 1);
  }
  const materials = {};
  for (const [id, count] of histogram) materials[id] = count;
  return {
    occupiedVoxelCount: voxels.size,
    dims: { ...dims },
    footprintCells: footprintCells(voxels).length,
    occupiedVolume: voxels.size,
    exposedSurfaceArea: estimateSurfaceArea(voxels),
    materialHistogram: materials,
    assetKind: 'building',
    ruleSetVersion: 'studio-derivation/1',
  };
}

/** A rough exposed-surface count (6 faces per voxel, minus shared faces). */
export function estimateSurfaceArea(voxels) {
  let area = 0;
  for (const key of voxels.keys()) {
    const c = parseVoxelKey(key);
    if (!c) continue;
    area += 6;
    if (voxels.has(voxelKey(c.x + 1, c.y, c.z))) area -= 2;
    if (voxels.has(voxelKey(c.x - 1, c.y, c.z))) area -= 2;
    if (voxels.has(voxelKey(c.x, c.y + 1, c.z))) area -= 2;
    if (voxels.has(voxelKey(c.x, c.y - 1, c.z))) area -= 2;
    if (voxels.has(voxelKey(c.x, c.y, c.z + 1))) area -= 2;
    if (voxels.has(voxelKey(c.x, c.y, c.z - 1))) area -= 2;
  }
  return Math.max(0, area);
}

/**
 * The proposed construction cost.
 *
 * HONESTY: the formula is NOT published (OQ-STD-33) and the money maths is
 * owned by ECO. This is a PROPOSED linear rule over the occupied voxel
 * count, flagged `assumed: true`, and the caller (ECO) may replace it.
 */
export function deriveBuildCost(voxels, options = {}) {
  const perVoxel = Number.isFinite(options.perVoxelCost) ? options.perVoxelCost : 2;
  const base = Number.isFinite(options.baseCost) ? options.baseCost : 0;
  const cost = Math.round(base + voxels.size * perVoxel);
  return {
    buildCost: cost,
    assumed: true,
    rule: 'proposed: base + perVoxelCost * occupiedVoxelCount',
    perVoxelCost: perVoxel,
    baseCost: base,
    note: 'The derivation formula is not published (OQ-STD-33); ECO owns the money maths.',
  };
}

// ---------------------------------------------------------------------------
// OBJ export / import
// ---------------------------------------------------------------------------

/**
 * Export the model as a Wavefront OBJ string.
 *
 * Each voxel becomes an axis-aligned unit cube (8 vertices, 6 quad faces) at
 * its own lattice position, grouped per voxel and given a material name
 * `m<materialIndex>`. The material index is therefore preserved in the file
 * (FR-STD-099: materials are indices, not raw colours) and the colours
 * themselves travel in the `usemtl` comment block.
 *
 * @param {Map<string,object>} voxels
 * @param {object} [options] `{palette, name}`
 * @returns {string} the OBJ text
 */
export function exportOBJ(voxels, options = {}) {
  const palette = options.palette ?? defaultPalette();
  const name = options.name ?? 'scc-studio-model';
  const lines = [];
  lines.push(`# SuperCitycon SCC Studio export`);
  lines.push(`# format ${ASSET_FORMAT} (voxel material indices)`);
  lines.push(`# voxels ${voxels.size}`);
  lines.push(`o ${name}`);

  // The colour table, so the file is usable without the palette.
  lines.push('# material table (index = colour)');
  for (const entry of palette) {
    lines.push(`# m${entry.index} ${entry.name} ${hexOf(entry.color)}`);
  }

  let vertexOffset = 0;
  const sorted = Array.from(voxels.keys()).sort();
  for (const key of sorted) {
    const rec = voxels.get(key);
    const c = parseVoxelKey(key);
    if (!c || !rec) continue;
    const index = rec.id ?? 0;
    lines.push(`g voxel_${c.x}_${c.y}_${c.z}`);
    lines.push(`usemtl m${index}`);
    // 8 corners of the unit cube at (x, y, z).
    const x0 = c.x; const y0 = c.y; const z0 = c.z;
    const x1 = c.x + 1; const y1 = c.y + 1; const z1 = c.z + 1;
    lines.push(`v ${x0} ${y0} ${z0}`);
    lines.push(`v ${x1} ${y0} ${z0}`);
    lines.push(`v ${x1} ${y1} ${z0}`);
    lines.push(`v ${x0} ${y1} ${z0}`);
    lines.push(`v ${x0} ${y0} ${z1}`);
    lines.push(`v ${x1} ${y0} ${z1}`);
    lines.push(`v ${x1} ${y1} ${z1}`);
    lines.push(`v ${x0} ${y1} ${z1}`);
    const b = vertexOffset + 1;
    // -Z, +Z, -Y, +Y, -X, +X
    lines.push(`f ${b + 0} ${b + 3} ${b + 2} ${b + 1}`);
    lines.push(`f ${b + 4} ${b + 5} ${b + 6} ${b + 7}`);
    lines.push(`f ${b + 0} ${b + 1} ${b + 5} ${b + 4}`);
    lines.push(`f ${b + 3} ${b + 7} ${b + 6} ${b + 2}`);
    lines.push(`f ${b + 0} ${b + 4} ${b + 7} ${b + 3}`);
    lines.push(`f ${b + 1} ${b + 2} ${b + 6} ${b + 5}`);
    vertexOffset += 8;
  }
  lines.push('');
  return lines.join('\n');
}

function hexOf(color) {
  return `#${(color >>> 0).toString(16).padStart(8, '0').slice(-6)}`;
}

/**
 * Parse an OBJ string.
 *
 * Returns the vertices, the faces (with their material), the axis-aligned
 * CUBES the file describes and the number of those cubes.
 *
 * A cube is recovered from each face: an axis-aligned face has one axis with
 * zero extent, and the face's winding says which end of the cube it is, so
 * the cube's minimum corner (its lattice position) can be computed.
 *
 * @param {string} text
 * @returns {{vertices:number[][],faces:Array<{indices:number[],material:number}>,
 *            cubes:Map<string,number>, voxelCount:number,materials:Map<number,number>}}
 */
export function parseOBJ(text) {
  const vertices = [];
  const faces = [];
  const materials = new Map();
  let material = 0;

  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const tag = parts[0];
    if (tag === 'v') {
      vertices.push([Number(parts[1]) || 0, Number(parts[2]) || 0, Number(parts[3]) || 0]);
    } else if (tag === 'f') {
      const idx = [];
      for (let i = 1; i < parts.length; i += 1) {
        const first = parts[i].split('/')[0];
        const n = Number.parseInt(first, 10);
        if (!Number.isFinite(n)) continue;
        idx.push(n < 0 ? vertices.length + n : n - 1);
      }
      faces.push({ indices: idx, material });
    } else if (tag === 'usemtl') {
      const name = parts[1] ?? '';
      const m = /^m(\d+)$/.exec(name);
      material = m ? Number.parseInt(m[1], 10) : 0;
    }
    // `g` / `o` names carry the lattice position as a human hint; the
    // geometry is what the import trusts.
  }

  const cubes = new Map();
  for (const face of faces) {
    const cube = cubeOfFace(vertices, face.indices);
    if (!cube) continue;
    const key = voxelKey(cube.x, cube.y, cube.z);
    if (!cubes.has(key)) cubes.set(key, face.material);
    materials.set(face.material, (materials.get(face.material) ?? 0) + 1);
  }

  return { vertices, faces, cubes, voxelCount: cubes.size, materials };
}

/**
 * The lattice position of the cube an axis-aligned face belongs to.
 * @returns {{x:number,y:number,z:number}|null}
 */
function cubeOfFace(vertices, indices) {
  if (!indices || indices.length < 3) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const pts = [];
  for (const i of indices) {
    const v = vertices[i];
    if (!v) return null;
    pts.push(v);
    for (let a = 0; a < 3; a += 1) {
      min[a] = Math.min(min[a], v[a]);
      max[a] = Math.max(max[a], v[a]);
    }
  }
  // The face must be axis-aligned: exactly one axis has no extent.
  let axis = -1;
  for (let a = 0; a < 3; a += 1) {
    if (Math.abs(max[a] - min[a]) < 1e-9) {
      if (axis !== -1) return null;   // degenerate or rotated — not ours
      axis = a;
    }
  }
  if (axis === -1) return null;

  // The winding gives the outward normal; it says which end of the cube
  // this face is, and therefore where the cube's minimum corner is.
  const a = pts[0]; const b = pts[1]; const c = pts[2];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  let dom = 0;
  for (let i = 1; i < 3; i += 1) if (Math.abs(n[i]) > Math.abs(n[dom])) dom = i;
  const sign = Math.sign(n[dom]) || 1;

  const corner = [min[0], min[1], min[2]];
  corner[axis] = sign > 0 ? min[axis] - 1 : min[axis];
  return { x: Math.round(corner[0]), y: Math.round(corner[1]), z: Math.round(corner[2]) };
}

/**
 * Import an OBJ string back into a voxel map.
 *
 * Cubes are recovered from their faces (see `parseOBJ`); the material index
 * comes from the `usemtl m<n>` directive that was in force for the cube.
 *
 * @param {string} text
 * @param {object} [options] `{palette, dims}`
 * @returns {Map<string,{color:number,id:number}>}
 */
export function importOBJ(text, options = {}) {
  const palette = options.palette ?? defaultPalette();
  const dims = options.dims ?? DEFAULT_DIMS;
  const parsed = parseOBJ(text);
  const voxels = new Map();

  for (const [key, materialIndex] of parsed.cubes) {
    const c = parseVoxelKey(key);
    if (!c || !inVoxelBounds(c.x, c.y, c.z, dims)) continue;
    const entry = paletteEntry(palette, materialIndex) ?? paletteEntry(palette, 1);
    if (!entry) continue;
    voxels.set(key, { color: entry.color, id: entry.index });
  }

  return voxels;
}

// ---------------------------------------------------------------------------
// Workshop save / load (FR-STD-098 … FR-STD-106, FR-STD-109)
// ---------------------------------------------------------------------------

/**
 * Serialise the document (the "unique format", FR-STD-098).
 *
 * The payload stores MATERIAL INDICES, not colours (FR-STD-099), declares a
 * FORMAT VERSION (FR-STD-101), and records the dimensions in voxels
 * (FR-STD-040).
 *
 * @param {object} doc `{voxels, dims, palette, kind, id, name}`
 * @returns {string} the JSON document
 */
export function serializeWorkshop(doc) {
  const voxels = doc?.voxels ?? new Map();
  const dims = doc?.dims ?? DEFAULT_DIMS;
  const palette = doc?.palette ?? defaultPalette();
  const cells = [];
  for (const key of Array.from(voxels.keys()).sort()) {
    const rec = voxels.get(key);
    const c = parseVoxelKey(key);
    if (!c || !rec) continue;
    cells.push([c.x, c.y, c.z, rec.id ?? 0]);
  }
  return JSON.stringify({
    format: ASSET_FORMAT,
    formatVersion: FORMAT_VERSION,
    id: doc?.id ?? 'workshop-model',
    name: doc?.name ?? 'Untitled model',
    kind: doc?.kind ?? 'building',
    parentAssetId: doc?.parentAssetId ?? null,
    dims: { x: dims.x, y: dims.y, z: dims.z },
    pivot: doc?.pivot ?? { x: 0, y: 0, z: 0 },
    paletteId: doc?.paletteId ?? 'palette/game-16',
    palette: palette.map((p) => ({ index: p.index, name: p.name, color: p.color })),
    cells,
    contentHash: hashCells(cells),
  });
}

/**
 * Parse a serialised document.
 * @param {string} json
 * @returns {{ok:boolean, reason:string|null, doc:object|null}}
 */
export function deserializeWorkshop(json) {
  let raw;
  try {
    raw = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    return { ok: false, reason: 'malformed-json', doc: null };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not-an-object', doc: null };
  const version = Number(raw.formatVersion);
  if (!Number.isFinite(version)) return { ok: false, reason: 'missing-format-version', doc: null };
  if (version > FORMAT_VERSION) return { ok: false, reason: 'unsupported-format-version', doc: null };
  if (!Array.isArray(raw.cells)) return { ok: false, reason: 'malformed-payload', doc: null };

  const dims = raw.dims ?? DEFAULT_DIMS;
  const palette = Array.isArray(raw.palette) && raw.palette.length
    ? raw.palette.map((p) => ({ index: Number(p.index), name: String(p.name ?? ''), color: Number(p.color ?? 0) }))
    : defaultPalette();

  const voxels = new Map();
  for (const cell of raw.cells) {
    if (!Array.isArray(cell) || cell.length < 4) return { ok: false, reason: 'malformed-payload', doc: null };
    const [x, y, z, id] = cell.map(Number);
    if (![x, y, z].every((n) => Number.isInteger(n))) return { ok: false, reason: 'malformed-payload', doc: null };
    if (!inVoxelBounds(x, y, z, dims)) return { ok: false, reason: 'voxel-out-of-range', doc: null };
    if (!Number.isInteger(id) || id < 1) return { ok: false, reason: 'material-index-out-of-range', doc: null };
    const entry = paletteEntry(palette, id);
    if (!entry) return { ok: false, reason: 'material-index-out-of-range', doc: null };
    voxels.set(voxelKey(x, y, z), { color: entry.color, id: entry.index });
  }

  return {
    ok: true,
    reason: null,
    doc: {
      id: raw.id ?? 'workshop-model',
      name: raw.name ?? 'Untitled model',
      kind: raw.kind ?? 'building',
      parentAssetId: raw.parentAssetId ?? null,
      dims: { x: dims.x, y: dims.y, z: dims.z },
      pivot: raw.pivot ?? { x: 0, y: 0, z: 0 },
      paletteId: raw.paletteId ?? 'palette/game-16',
      palette,
      voxels,
      formatVersion: version,
      contentHash: raw.contentHash ?? hashCells(raw.cells),
    },
  };
}

/** A stable content hash (FNV-1a over the sorted cell list). */
export function hashCells(cells) {
  let hash = 0x811c9dc5;
  const text = cells.map((c) => c.join(',')).join(';');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Undo history (FR-STD-026/027 — Could priority, but cheap and useful)
// ---------------------------------------------------------------------------

/**
 * A bounded undo/redo history over voxel edits.
 * @param {number} [depth=64]
 */
export function createHistory(depth = 64) {
  const undoStack = [];
  const redoStack = [];
  const limit = Math.max(1, depth);

  return {
    /** Record an edit: `{before, after}` records of "key -> voxel|null". */
    push(change) {
      if (!change || !change.before) return;
      undoStack.push(change);
      if (undoStack.length > limit) undoStack.shift();
      redoStack.length = 0;
    },
    /** The most recent change, or null. */
    peek() {
      return undoStack.length ? undoStack[undoStack.length - 1] : null;
    },
    /** Take the most recent change (the caller applies it). */
    take() {
      const change = undoStack.pop() ?? null;
      if (change) redoStack.push(change);
      return change;
    },
    /** Put a change back (the caller re-applies it). */
    redo() {
      const change = redoStack.pop() ?? null;
      if (change) undoStack.push(change);
      return change;
    },
    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },
    clear() { undoStack.length = 0; redoStack.length = 0; },
    get depth() { return undoStack.length; },
  };
}

/** Apply an undo/redo change record to a voxel map. */
export function applyChange(voxels, change) {
  if (!change) return false;
  const map = change.after ?? change.before ?? {};
  for (const [key, rec] of Object.entries(map)) {
    if (rec === null || rec === undefined) voxels.delete(key);
    else voxels.set(key, { color: rec.color, id: rec.id });
  }
  return true;
}

export { PALETTE_NAMES };
