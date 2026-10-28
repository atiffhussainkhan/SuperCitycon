/**
 * world/water.js — water level, flood model and the water surface.
 *
 * OWNERSHIP: WLD (world domain).
 *
 * PURE / VIEW SPLIT
 *   - The flood model (`waterLevelFor`, `floodFill`, `computeWaterBodies`) is
 *     pure: it imports only `core/config.js` and `world/heightfield.js`, so
 *     it runs head-less (NFR-WLD-013). **No `three` import at module scope.**
 *   - `buildWaterMesh()` is the view half. It takes Three.js from the shared
 *     context (`ctx.config.THREE`) and falls back to a dynamic import, so the
 *     module never hard-depends on the renderer.
 *
 * MODEL
 *   Water is a static translucent volume with its own level (FR-WLD-058).
 *   A cell is submerged iff `elevation < waterLevel` (R3). Bodies are the
 *   4-connected components of the submerged cells (R5, FR-WLD-066).
 */

import { GRID, WORLD, PALETTE, TUNING } from '../core/config.js';
import { seaLevelFor, sizeOf, sampleHeight, MAX_WATER_DEPTH } from './heightfield.js';

/**
 * The sea level implied by a heightmap: the level at which exactly
 * `TUNING.waterFraction` of the map is flooded.
 * @param {Float32Array} hf
 * @param {number} [targetFraction]
 * @returns {number} world-space water surface height
 */
export function waterLevelFor(hf, targetFraction = TUNING.waterFraction) {
  return seaLevelFor(hf, targetFraction);
}

/**
 * 4-connected flood from a seed cell over everything below `level`.
 * Used for terraforming feedback ("which cells does this edit flood?").
 *
 * @param {Float32Array} hf
 * @param {number} size
 * @param {number} startCx
 * @param {number} startCz
 * @param {number} level
 * @returns {{cells:number[], mask:Uint8Array, count:number, level:number}}
 */
export function floodFill(hf, size = sizeOf(hf), startCx = 0, startCz = 0, level = null) {
  const lv = level === null ? waterLevelFor(hf) : level;
  const n = size * size;
  const mask = new Uint8Array(n);
  const cells = [];
  if (startCx < 0 || startCz < 0 || startCx >= size || startCz >= size) {
    return { cells, mask, count: 0, level: lv };
  }
  if (hf[startCz * size + startCx] >= lv) {
    return { cells, mask, count: 0, level: lv };
  }

  const queue = [startCz * size + startCx];
  mask[queue[0]] = 1;
  while (queue.length) {
    const i = queue.pop();
    cells.push(i);
    const cx = i % size;
    const cz = (i - cx) / size;
    const push = (nx, nz) => {
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) return;
      const j = nz * size + nx;
      if (mask[j]) return;
      if (hf[j] >= lv) return;
      mask[j] = 1;
      queue.push(j);
    };
    push(cx + 1, cz);
    push(cx - 1, cz);
    push(cx, cz + 1);
    push(cx, cz - 1);
  }
  return { cells, mask, count: cells.length, level: lv };
}

/**
 * The connected water bodies at a level (FR-WLD-065/066, R5).
 *
 * @param {Float32Array} hf
 * @param {number} size
 * @param {number} level
 * @returns {Array<{id:number, cells:number[], count:number, navigable:boolean}>}
 *          bodies sorted by cell count (biggest first), ids are stable for a
 *          given map state.
 */
export function computeWaterBodies(hf, size = sizeOf(hf), level = null) {
  const lv = level === null ? waterLevelFor(hf) : level;
  const n = size * size;
  const seen = new Uint8Array(n);
  const bodies = [];
  for (let start = 0; start < n; start += 1) {
    if (seen[start]) continue;
    if (hf[start] >= lv) continue;
    const cells = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      cells.push(i);
      const cx = i % size;
      const cz = (i - cx) / size;
      const push = (nx, nz) => {
        if (nx < 0 || nz < 0 || nx >= size || nz >= size) return;
        const j = nz * size + nx;
        if (seen[j]) return;
        if (hf[j] >= lv) return;
        seen[j] = 1;
        stack.push(j);
      };
      push(cx + 1, cz);
      push(cx - 1, cz);
      push(cx, cz + 1);
      push(cx, cz - 1);
    }
    bodies.push({ id: bodies.length, cells, count: cells.length, navigable: cells.length >= 4 });
  }
  bodies.sort((a, b) => b.count - a.count);
  bodies.forEach((b, i) => { b.id = i; });
  return bodies;
}

/**
 * The boat navigation graph: navigable cells grouped per body (FR-WLD-070).
 * MOB consumes this to route boats; a boat may never path across land.
 */
export function navigationCells(hf, size = sizeOf(hf), level = null) {
  const bodies = computeWaterBodies(hf, size, level);
  return {
    level: level === null ? waterLevelFor(hf) : level,
    bodies: bodies.map((b) => ({ id: b.id, cells: b.cells, navigable: b.navigable })),
  };
}

// --------------------------------------------------------------------------
// View: the translucent water surface
// --------------------------------------------------------------------------

/** Resolve Three.js from the shared context, falling back to a dynamic import. */
async function resolveThree(ctx) {
  const fromCtx = ctx?.config?.THREE;
  if (fromCtx) return fromCtx;
  return import('three');
}

function hexToLinear(hex) {
  const s = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => v / 255);
  return s.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
}

/**
 * Build the water surface: ONE translucent plane over the whole map with
 * per-vertex depth tinting (shallower green-teal -> deeper blue-green,
 * FR-WLD-061) and a slow ripple (FR-WLD-062).
 *
 * The mesh costs O(surface) geometry, not O(cells) (NFR-WLD-004).
 *
 * @param {object} ctx
 * @param {number} level world-space water surface height
 * @returns {Promise<import('three').Mesh>}
 */
export async function buildWaterMesh(ctx, level = 0) {
  const THREE = await resolveThree(ctx);
  const size = ctx?.config?.GRID?.size ?? GRID.size;
  const width = ctx?.config?.WORLD?.width ?? WORLD.width;
  const depth = ctx?.config?.WORLD?.depth ?? WORLD.depth;
  const originX = ctx?.config?.WORLD?.originX ?? WORLD.originX;
  const originZ = ctx?.config?.WORLD?.originZ ?? WORLD.originZ;
  const cell = ctx?.config?.CELL ?? 4;

  const geom = new THREE.PlaneGeometry(width, depth, size, size);
  geom.rotateX(-Math.PI / 2);

  const hf = ctx?.state?.world?.heightmap ?? null;
  const shallow = hexToLinear(PALETTE.water);
  const deep = hexToLinear(PALETTE.deepWater);

  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const wx = pos.getX(i);
    const wz = pos.getZ(i);
    let depthHere = 0;
    if (hf) {
      const cx = Math.min(size - 1, Math.max(0, Math.floor((wx - originX) / cell)));
      const cz = Math.min(size - 1, Math.max(0, Math.floor((wz - originZ) / cell)));
      depthHere = Math.max(0, level - hf[cz * size + cx]);
    }
    const t = Math.min(1, depthHere / Math.max(0.001, MAX_WATER_DEPTH));
    colors[i * 3 + 0] = shallow[0] + (deep[0] - shallow[0]) * t;
    colors[i * 3 + 1] = shallow[1] + (deep[1] - shallow[1]) * t;
    colors[i * 3 + 2] = shallow[2] + (deep[2] - shallow[2]) * t;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Ripple: a small travelling wave on the surface (FR-WLD-062).
  // A unique cache key keeps three from sharing this program with an
  // unmodified material of the same shape.
  material.customProgramCacheKey = () => 'wld-water-ripple';
  material.userData.uTime = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = material.userData.uTime;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       transformed.y += sin(position.x * 0.12 + uTime * 1.4) * 0.06
                     + sin(position.z * 0.17 - uTime * 1.1) * 0.05;`,
    );
  };

  const mesh = new THREE.Mesh(geom, material);
  mesh.name = 'water';
  mesh.position.y = level;
  mesh.renderOrder = 1;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  mesh.userData.isWater = true;

  ctx?.renderer?.world?.add(mesh);
  return mesh;
}

/** Advance the ripple animation. */
export function animateWaterMesh(mesh, elapsed) {
  const u = mesh?.material?.userData?.uTime;
  if (u) u.value = elapsed;
}

/** Depth of the water over a cell, using the world's current level. */
export function depthAt(ctx, cx, cz) {
  const hf = ctx?.state?.world?.heightmap;
  if (!hf) return 0;
  const level = ctx?.state?.world?.waterLevel ?? 0;
  return Math.max(0, level - sampleHeight(hf, cx, cz));
}
