/**
 * world/terrain.js — the voxel-ish terrain mesh (Three.js view).
 *
 * OWNERSHIP: WLD (world domain).
 *
 * SHAPE
 *   ONE merged `BufferGeometry` for the whole map (never 4096 meshes):
 *   per cell we emit a top quad plus the side skirts that are actually
 *   exposed, with per-vertex colours taken from the surface type and a
 *   height ramp over the retro palette (NFR-WLD-003, FR-WLD-042).
 *
 * LAYOUT
 *   The vertex layout is FIXED (20 vertices per cell) so a terraform can
 *   patch just the dirty cells in place instead of rebuilding the map
 *   (NFR-WLD-002).
 *
 *   vertex 0..3   top quad      (+Y)
 *   vertex 4..7   west skirt    (-X)
 *   vertex 8..11  east skirt    (+X)
 *   vertex 12..15 south skirt   (-Z)
 *   vertex 16..19 north skirt   (+Z)
 *
 *   The INDEX buffer is NOT fixed: a skirt is only indexed when the height
 *   difference to that neighbour exceeds the threshold, so the geometry
 *   contains no degenerate (zero-area) quads at all (D-02). The index buffer
 *   is rebuilt whenever the terrain changes; the vertex buffer is patched in
 *   place.
 *
 * LAYERS
 *   The terrain lives on integer layers (FR-WLD-019): two neighbouring cells
 *   either share a layer (no cliff, no crack, NO GRID) or differ by whole
 *   layers (one real cliff face). That is why the map reads as stacked voxel
 *   terraces rather than a cell-boundary grid.
 *
 * APRON
 *   A ring of ground extends past the grid edge (D-05) so the map never
 *   floats with bare sky under it.
 */

import * as THREE from 'three';
import { GRID, CELL, WORLD, PALETTE, TUNING } from '../core/config.js';
import {
  TERRAIN_TYPES,
  WLD_TUNING,
  LAYER_STEP,
  APRON_CELLS,
  generateTypeMap,
  terrainTypeIdAt,
  sampleHeight,
  sizeOf,
} from './heightfield.js';

export { APRON_CELLS };

const VERTS_PER_CELL = 20;
const QUADS_PER_CELL = 5;
const INDICES_PER_CELL = QUADS_PER_CELL * 6;

/**
 * TBD: the smallest height difference that earns a cliff face.
 *
 * Half a layer: with the terrain on the layer grid the difference is either
 * zero or a whole layer (1.5), so every real step gets a face and every flat
 * edge gets none.
 */
export const SKIRT_THRESHOLD = LAYER_STEP / 2;

/**
 * TBD: how far the ground apron reaches past the grid edge, in cells.
 * 12 cells = 48 world units, which the fog (180..460) swallows before the
 * far edge of the apron can come into frame.
 */
const APRON_QUADS = 8;
const APRON_VERTS = APRON_QUADS * 4;

/** Per-ctx mesh bookkeeping (WeakMap keeps multiple worlds independent). */
const meshes = new WeakMap();

/** Surface-type base colours (linear-space RGB). */
function hexToLinear(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
    .map((v) => v / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * D-03: rock must read as rock.
 *
 * `PALETTE.rock` on its own (0x7d8597) is a pale blue-grey that is almost
 * indistinguishable from the sky (0x4cc9f0) when a highland region is seen
 * against it, so the map edge read as a hole. The rock colour is therefore
 * a warm stone (the rock tone mixed into the soil tone) and the snow ramp
 * over rock is warmed up as well - a highland is brown-grey, never blue.
 */
const ROCK_BASE = mix(hexToLinear(PALETTE.soil), hexToLinear(PALETTE.rock), 0.35);
const SNOW = hexToLinear(PALETTE.snow);
const SNOW_ROCK = mix(SNOW, hexToLinear(PALETTE.soil), 0.3);
const ROCK = hexToLinear(PALETTE.rock);
const DEEP = hexToLinear(PALETTE.deepWater);

const TYPE_COLOURS = {
  water: hexToLinear(PALETTE.deepWater),
  sand: hexToLinear(PALETTE.sand),
  grass: hexToLinear(PALETTE.grass),
  forest: hexToLinear(PALETTE.moss),
  rock: ROCK_BASE,
  dirt: hexToLinear(PALETTE.soil),
};

/**
 * The colour of a cell's top face: the surface type colour, lightened
 * towards snow with altitude and tinted deep where it is submerged.
 */
function topColour(typeId, h, level) {
  const name = TERRAIN_TYPES[typeId] ?? 'grass';
  const base = TYPE_COLOURS[name] ?? TYPE_COLOURS.grass;
  const above = (h - level) / Math.max(0.001, TUNING.maxTerrainHeight);
  // Rock keeps a warm snow ramp and a lower ceiling: a cold blue-white
  // highlight is what made the highland read as sky.
  const snow = name === 'rock' ? SNOW_ROCK : SNOW;
  const cap = name === 'rock' ? 0.18 : 0.32;
  let c = mix(base, snow, Math.min(cap, Math.max(0, above) * cap));
  if (h < level) c = mix(c, DEEP, 0.45);
  return c;
}

/**
 * Build the terrain mesh for a heightmap and add it to `ctx.renderer.world`.
 * Replaces (and disposes) any previous terrain mesh for the same context.
 *
 * @param {object} ctx
 * @param {Float32Array} hf
 * @returns {import('three').Mesh}
 */
export function buildTerrainMesh(ctx, hf) {
  const size = ctx?.config?.GRID?.size ?? sizeOf(hf) ?? GRID.size;
  const cell = ctx?.config?.CELL ?? CELL;
  const originX = ctx?.config?.WORLD?.originX ?? WORLD.originX;
  const originZ = ctx?.config?.WORLD?.originZ ?? WORLD.originZ;

  disposeTerrainMesh(ctx);

  const level = ctx?.state?.world?.waterLevel ?? 0;
  const types = generateTypeMap(hf, size, level);

  let bottom = Infinity;
  for (let i = 0; i < hf.length; i += 1) if (hf[i] < bottom) bottom = hf[i];
  const bottomY = (bottom === Infinity ? 0 : bottom) - 1;

  const cellCount = size * size;
  const vertCount = cellCount * VERTS_PER_CELL + APRON_VERTS;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const indices = new Uint32Array(cellCount * INDICES_PER_CELL + APRON_QUADS * 6);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const indexAttr = new THREE.BufferAttribute(indices, 1);
  geom.setIndex(indexAttr);

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geom, material);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  const st = {
    mesh,
    geom,
    material,
    indexAttr,
    indices,
    hf,
    types,
    size,
    cell,
    originX,
    originZ,
    bottomY,
    dirty: new Set(),
    lastBuild: 0,
    walls: 0,
    quads: 0,
    typeLevel: level,
    apronDirty: true,
  };
  meshes.set(ctx, st);

  for (let cz = 0; cz < size; cz += 1) {
    for (let cx = 0; cx < size; cx += 1) writeCell(ctx, cx, cz);
  }
  st.walls = countWalls(st);
  writeApron(st);
  rebuildIndices(st);

  markGeometryDirty(st);

  ctx?.renderer?.world?.add(mesh);
  return mesh;
}

/**
 * Number of cliff faces in the current mesh: one per edge whose two cells
 * differ by more than the threshold (the taller side owns the face) plus the
 * map border.
 */
function countWalls(st) {
  const { hf, size, bottomY } = st;
  let n = 0;
  const neighbour = (x, z) => {
    if (x < 0 || z < 0 || x >= size || z >= size) return bottomY;
    return hf[z * size + x];
  };
  for (let cz = 0; cz < size; cz += 1) {
    for (let cx = 0; cx < size; cx += 1) {
      const h = hf[cz * size + cx];
      if (h - neighbour(cx - 1, cz) > SKIRT_THRESHOLD) n += 1;
      if (h - neighbour(cx + 1, cz) > SKIRT_THRESHOLD) n += 1;
      if (h - neighbour(cx, cz - 1) > SKIRT_THRESHOLD) n += 1;
      if (h - neighbour(cx, cz + 1) > SKIRT_THRESHOLD) n += 1;
    }
  }
  return n;
}

/** True when the cell's edge towards (dx, dz) exposes a cliff face. */
function hasSkirt(st, cx, cz, dx, dz) {
  const { hf, size } = st;
  return hf[cz * size + cx] - neighbourHeight(st, cx + dx, cz + dz) > SKIRT_THRESHOLD;
}

/** The height of a neighbour cell; the map border counts as the map's floor. */
function neighbourHeight(st, nx, nz) {
  const { hf, size, bottomY } = st;
  if (nx < 0 || nz < 0 || nx >= size || nz >= size) return bottomY;
  return hf[nz * size + nx];
}

/**
 * Write the 20 vertices of one cell (top quad + 4 skirt slots).
 *
 * A skirt slot that is not exposed collapses to a single point. It is still
 * written (so the buffer stays deterministic and a later terraform can
 * expose it without a rebuild) but it is NOT indexed, so it never reaches
 * the rasteriser: the geometry holds no degenerate quads (D-02).
 */
function writeCell(ctx, cx, cz) {
  const st = meshes.get(ctx);
  if (!st) return;
  const { hf, types, size, cell, originX, originZ } = st;
  const i = cz * size + cx;
  const h = hf[i];
  const x0 = originX + cx * cell;
  const x1 = x0 + cell;
  const z0 = originZ + cz * cell;
  const z1 = z0 + cell;

  const pos = st.geom.attributes.position.array;
  const nor = st.geom.attributes.normal.array;
  const col = st.geom.attributes.color.array;

  const level = ctx?.state?.world?.waterLevel ?? 0;
  const typeId = types[i];
  const base = topColour(typeId, h, level);
  const wallTop = mix(base, ROCK, 0.45);
  const wallBottom = mix(ROCK, DEEP, 0.45).map((c) => c * 0.55);

  const base3 = i * VERTS_PER_CELL * 3;
  const put = (slot, x, y, z, nx, ny, nz, c) => {
    const o = base3 + slot * 3;
    pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
    nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
    col[o] = c[0]; col[o + 1] = c[1]; col[o + 2] = c[2];
  };

  // --- top quad (+Y) ---
  put(0, x0, h, z0, 0, 1, 0, base);
  put(1, x0, h, z1, 0, 1, 0, base);
  put(2, x1, h, z1, 0, 1, 0, base);
  put(3, x1, h, z0, 0, 1, 0, base);

  const collapse = (slot, x, z) => {
    put(slot, x, h, z, 0, 1, 0, base);
    put(slot + 1, x, h, z, 0, 1, 0, base);
    put(slot + 2, x, h, z, 0, 1, 0, base);
    put(slot + 3, x, h, z, 0, 1, 0, base);
  };

  // west (-X): slot 4..7
  if (hasSkirt(st, cx, cz, -1, 0)) {
    const hn = neighbourHeight(st, cx - 1, cz);
    put(4, x0, hn, z1, -1, 0, 0, wallBottom);
    put(5, x0, h, z1, -1, 0, 0, wallTop);
    put(6, x0, h, z0, -1, 0, 0, wallTop);
    put(7, x0, hn, z0, -1, 0, 0, wallBottom);
  } else {
    collapse(4, x0, z0);
  }
  // east (+X): slot 8..11
  if (hasSkirt(st, cx, cz, 1, 0)) {
    const hn = neighbourHeight(st, cx + 1, cz);
    put(8, x1, hn, z0, 1, 0, 0, wallBottom);
    put(9, x1, h, z0, 1, 0, 0, wallTop);
    put(10, x1, h, z1, 1, 0, 0, wallTop);
    put(11, x1, hn, z1, 1, 0, 0, wallBottom);
  } else {
    collapse(8, x1, z0);
  }
  // south (-Z): slot 12..15
  if (hasSkirt(st, cx, cz, 0, -1)) {
    const hn = neighbourHeight(st, cx, cz - 1);
    put(12, x0, hn, z0, 0, 0, -1, wallBottom);
    put(13, x0, h, z0, 0, 0, -1, wallTop);
    put(14, x1, h, z0, 0, 0, -1, wallTop);
    put(15, x1, hn, z0, 0, 0, -1, wallBottom);
  } else {
    collapse(12, x0, z0);
  }
  // north (+Z): slot 16..19
  if (hasSkirt(st, cx, cz, 0, 1)) {
    const hn = neighbourHeight(st, cx, cz + 1);
    put(16, x1, hn, z1, 0, 0, 1, wallBottom);
    put(17, x1, h, z1, 0, 0, 1, wallTop);
    put(18, x0, h, z1, 0, 0, 1, wallTop);
    put(19, x0, hn, z1, 0, 0, 1, wallBottom);
  } else {
    collapse(16, x1, z1);
  }
}

/**
 * The ground apron: a flat ring that extends past the grid edge so the map
 * never floats with bare sky beneath it (D-05).
 *
 * The apron sits at the same depth as the bottom of the map's border walls,
 * so it meets the map exactly - no gap and no overlap.
 */
function writeApron(st) {
  const { size, cell, originX, originZ, bottomY } = st;
  const pos = st.geom.attributes.position.array;
  const nor = st.geom.attributes.normal.array;
  const col = st.geom.attributes.color.array;

  const x0 = originX;
  const x1 = originX + size * cell;
  const z0 = originZ;
  const z1 = originZ + size * cell;
  const a = APRON_CELLS * cell;
  const ox0 = x0 - a;
  const ox1 = x1 + a;
  const oz0 = z0 - a;
  const oz1 = z1 + a;

  // The apron is bare rock / soil, far below the playable surface.
  const ground = mix(ROCK_BASE, DEEP, 0.35);

  const base = st.size * st.size * VERTS_PER_CELL;
  const put = (slot, x, z) => {
    const o = (base + slot) * 3;
    pos[o] = x; pos[o + 1] = bottomY; pos[o + 2] = z;
    nor[o] = 0; nor[o + 1] = 1; nor[o + 2] = 0;
    col[o] = ground[0]; col[o + 1] = ground[1]; col[o + 2] = ground[2];
  };

  // 4 side strips + 4 corner pieces. Each strip keeps the map's edge length
  // on both ends, so the pieces never overlap.
  const quads = [
    // north strip (-Z): inner z0 -> outer oz0
    [[x0, z0], [x1, z0], [x1, oz0], [x0, oz0]],
    // south strip (+Z): inner z1 -> outer oz1
    [[x1, z1], [x0, z1], [x0, oz1], [x1, oz1]],
    // west strip (-X): inner x0 -> outer ox0
    [[x0, z1], [x0, z0], [ox0, z0], [ox0, z1]],
    // east strip (+X): inner x1 -> outer ox1
    [[x1, z0], [x1, z1], [ox1, z1], [ox1, z0]],
    // corners
    [[x0, z0], [ox0, z0], [ox0, oz0], [x0, oz0]],
    [[x0, z1], [ox0, z1], [ox0, oz1], [x0, oz1]],
    [[x1, z0], [ox1, z0], [ox1, oz0], [x1, oz0]],
    [[x1, z1], [ox1, z1], [ox1, oz1], [x1, oz1]],
  ];
  quads.forEach((quad, qi) => {
    quad.forEach(([x, z], vi) => put(qi * 4 + vi, x, z));
  });
  st.apronDirty = false;
}

/**
 * Rebuild the INDEX buffer: only the quads that actually exist are indexed.
 *
 * A skirt is indexed when the height difference to that neighbour exceeds
 * the threshold. No degenerate quad is ever indexed, so the rasteriser never
 * sees a zero-area triangle (D-02).
 */
function rebuildIndices(st) {
  const { size } = st;
  const indices = st.indices;
  const cellCount = size * size;
  let n = 0;

  const quad = (v0, v1, v2, v3) => {
    indices[n + 0] = v0; indices[n + 1] = v1; indices[n + 2] = v2;
    indices[n + 3] = v0; indices[n + 4] = v2; indices[n + 5] = v3;
    n += 6;
  };

  let skirts = 0;
  for (let cz = 0; cz < size; cz += 1) {
    for (let cx = 0; cx < size; cx += 1) {
      const c = cz * size + cx;
      const v = c * VERTS_PER_CELL;
      // top quad - always present
      quad(v + 0, v + 1, v + 2, v + 3);
      // west
      if (hasSkirt(st, cx, cz, -1, 0)) { quad(v + 4, v + 5, v + 6, v + 7); skirts += 1; }
      // east
      if (hasSkirt(st, cx, cz, 1, 0)) { quad(v + 8, v + 9, v + 10, v + 11); skirts += 1; }
      // south
      if (hasSkirt(st, cx, cz, 0, -1)) { quad(v + 12, v + 13, v + 14, v + 15); skirts += 1; }
      // north
      if (hasSkirt(st, cx, cz, 0, 1)) { quad(v + 16, v + 17, v + 18, v + 19); skirts += 1; }
    }
  }

  // the apron
  const apronBase = cellCount * VERTS_PER_CELL;
  for (let q = 0; q < APRON_QUADS; q += 1) {
    const v = apronBase + q * 4;
    quad(v + 0, v + 1, v + 2, v + 3);
  }

  st.indexAttr.count = n;
  st.indexAttr.needsUpdate = true;
  st.quads = (n / 6);
  st.skirts = skirts;
}

/**
 * Flag the buffers for upload.
 *
 * `full` recomputes the bounds (build time). A partial refresh only grows
 * the existing bounds by a safe margin: a single-cell edit can move a
 * vertex by at most `TUNING.maxTerrainHeight`, and recomputing the bounds
 * over 80k vertices would blow the 16 ms edit budget (NFR-WLD-002).
 */
function markGeometryDirty(st, full = true) {
  st.geom.attributes.position.needsUpdate = true;
  st.geom.attributes.normal.needsUpdate = true;
  st.geom.attributes.color.needsUpdate = true;
  if (full) {
    st.geom.computeBoundingSphere();
    st.geom.computeBoundingBox();
    return;
  }
  const margin = TUNING.maxTerrainHeight + 2;
  const box = st.geom.boundingBox;
  if (box) {
    box.min.x -= margin; box.min.y -= margin; box.min.z -= margin;
    box.max.x += margin; box.max.y += margin; box.max.z += margin;
  }
  const sphere = st.geom.boundingSphere;
  if (sphere) sphere.radius += margin;
}

/**
 * Flag a cell (and the neighbours whose skirt depends on it) for a rebuild.
 */
export function markTerrainDirty(ctx, cx, cz) {
  const st = meshes.get(ctx);
  if (!st) return;
  const { size } = st;
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      st.dirty.add(nz * size + nx);
    }
  }
  // A border cell can move the bottom of the map, which moves the apron.
  if (cx === 0 || cz === 0 || cx === size - 1 || cz === size - 1) st.apronDirty = true;
}

/**
 * Push the pending cell edits into the mesh.
 *
 * Throttled to `WLD_TUNING.terrainRebuildIntervalMs` (TBD) so a drag of the
 * terraform brush never rebuilds more than a few times a second.
 *
 * @param {object} ctx
 * @param {boolean} [force] ignore the throttle
 * @returns {boolean} true when the mesh was updated
 */
export function refreshTerrainMesh(ctx, force = false) {
  const st = meshes.get(ctx);
  if (!st || !st.dirty.size) return false;
  const now = nowMs();
  if (!force && now - st.lastBuild < WLD_TUNING.terrainRebuildIntervalMs) return false;

  // The water level can move, which re-skins submerged cells.
  const level = ctx?.state?.world?.waterLevel ?? 0;
  if (level !== st.typeLevel) {
    st.types = generateTypeMap(st.hf, st.size, level);
    st.typeLevel = level;
    for (let cz = 0; cz < st.size; cz += 1) {
      for (let cx = 0; cx < st.size; cx += 1) st.dirty.add(cz * st.size + cx);
    }
  } else {
    for (const i of st.dirty) {
      const cx = i % st.size;
      const cz = (i - cx) / st.size;
      st.types[i] = terrainTypeIdAt(st.hf, cx, cz, level);
    }
  }

  for (const i of st.dirty) {
    writeCell(ctx, i % st.size, (i - (i % st.size)) / st.size);
  }
  st.dirty.clear();
  st.lastBuild = now;
  st.walls = countWalls(st);
  if (st.apronDirty) {
    let bottom = Infinity;
    for (let i = 0; i < st.hf.length; i += 1) if (st.hf[i] < bottom) bottom = st.hf[i];
    st.bottomY = (bottom === Infinity ? 0 : bottom) - 1;
    writeApron(st);
  }
  // The index buffer is rebuilt: a skirt may have appeared or disappeared.
  rebuildIndices(st);
  markGeometryDirty(st, false);
  return true;
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * The world-space terrain height at a cell (bilinear between cell centres).
 */
export function heightAt(ctx, cx, cz) {
  const st = meshes.get(ctx);
  const hf = st?.hf ?? ctx?.state?.world?.heightmap;
  if (!hf) return 0;
  return sampleHeight(hf, cx, cz);
}

/** Geometry statistics of the current terrain mesh (for reporting/tests). */
export function terrainMeshStats(ctx) {
  const st = meshes.get(ctx);
  if (!st) return null;
  const pos = st.geom.attributes.position.array;
  const idx = st.geom.index.array;
  const used = st.geom.index.count;
  const vertices = st.geom.attributes.position.count;
  let degenerate = 0;
  for (let i = 0; i < used; i += 3) {
    const a = idx[i] * 3; const b = idx[i + 1] * 3; const c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a]; const uy = pos[b + 1] - pos[a + 1]; const uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a]; const vy = pos[c + 1] - pos[a + 1]; const vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-12) degenerate += 1;
  }
  return {
    cells: st.size * st.size,
    vertices,
    triangles: used / 3,
    degenerateTriangles: degenerate,
    cliffFaces: st.walls,
    skirtQuads: st.skirts ?? 0,
    quads: st.quads ?? (used / 6),
    drawCalls: 1,
  };
}

/** The terrain mesh currently owned by a context (or null). */
export function getTerrainMesh(ctx) {
  return meshes.get(ctx)?.mesh ?? null;
}

/** Remove and release the terrain mesh for a context. */
export function disposeTerrainMesh(ctx) {
  const st = meshes.get(ctx);
  if (!st) return;
  if (st.mesh?.parent) st.mesh.parent.remove(st.mesh);
  st.geom.dispose?.();
  st.material?.dispose?.();
  meshes.delete(ctx);
}
