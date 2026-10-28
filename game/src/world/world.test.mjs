/**
 * world/world.test.mjs — WLD domain unit tests.
 *
 * Run:  node --test src/world/world.test.mjs
 *
 * Covers: heightmap determinism, water fraction, surface-type classification,
 * slope, terraforming, water depth, flood fill, water bodies, scattering
 * (manifest validity + spacing) and the terrain mesh geometry.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import * as THREE from 'three';

import { GRID, CELL, WORLD, PALETTE, TUNING, TOOLS } from '../core/config.js';
import {
  generateHeightmap,
  generateTypeMap,
  generateWaterMap,
  isWater,
  maxHeight,
  minHeight,
  raiseTerrain,
  sampleHeight,
  seaLevelFor,
  setHeight,
  slopeAt,
  smoothHeightmap,
  terrainTypeAt,
  TERRAIN_TYPES,
  TERRAIN_TYPE_IDS,
  waterDepth,
  WLD_TUNING,
} from './heightfield.js';
import { computeWaterBodies, floodFill, waterLevelFor } from './water.js';
import { planScatter, NATURE_KEYS, isPlaceableNatureKey } from './scatter.js';
import { APRON_CELLS } from './terrain.js';
import {
  buildTerrainMesh,
  disposeTerrainMesh,
  markTerrainDirty,
  refreshTerrainMesh,
  terrainMeshStats,
} from './terrain.js';
import { createWorld, worldDiagnostics } from './index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(resolve(HERE, '../data/manifest.json'), 'utf8'),
);

const SEED = 20261023;
const SIZE = GRID.size;

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------

/** A minimal context that satisfies the world domain without a browser. */
function mockCtx(overrides = {}) {
  const group = {
    children: [],
    add(o) { this.children.push(o); o.parent = this; },
    remove(o) { this.children = this.children.filter((c) => c !== o); o.parent = null; },
  };
  return {
    state: {
      meta: { seed: SEED },
      ui: { tool: TOOLS.inspect },
      world: {
        heightmap: null, water: null, types: null, waterLevel: 0,
        scenery: [], modified: 0, seed: SEED,
      },
    },
    config: { GRID, CELL, WORLD, PALETTE, TUNING, TOOLS },
    manifest,
    bus: { emit() {}, on() {}, off() {}, once() {} },
    renderer: { world: group },
    assets: { loadModel: async () => null },
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// heightfield
// --------------------------------------------------------------------------

test('generateHeightmap is deterministic for a seed and differs across seeds', () => {
  const a = generateHeightmap(SEED, SIZE);
  const b = generateHeightmap(SEED, SIZE);
  const c = generateHeightmap(SEED + 1, SIZE);
  assert.ok(a instanceof Float32Array);
  assert.equal(a.length, SIZE * SIZE);
  assert.deepEqual(Array.from(a), Array.from(b), 'same seed must give the same map');
  assert.notDeepEqual(Array.from(a), Array.from(c), 'different seeds must differ');
});

test('the generated map covers roughly TUNING.waterFraction with water', () => {
  const hf = generateHeightmap(SEED, SIZE);
  const level = waterLevelFor(hf);
  let flooded = 0;
  for (let i = 0; i < hf.length; i += 1) if (hf[i] < level) flooded += 1;
  const fraction = flooded / hf.length;
  assert.ok(Math.abs(fraction - TUNING.waterFraction) < 0.02,
    `water fraction ${fraction.toFixed(4)} must be within 0.02 of ${TUNING.waterFraction}`);
  assert.equal(level, 0, 'the generator puts the datum on the flood line');
});

test('terrain stays inside the published height range', () => {
  const hf = generateHeightmap(SEED, SIZE);
  assert.ok(maxHeight(hf) <= TUNING.maxTerrainHeight + 1e-4,
    `max height ${maxHeight(hf)} must not exceed maxTerrainHeight`);
  assert.ok(minHeight(hf) < 0, 'the map must contain a seabed');
  assert.ok(minHeight(hf) >= -TUNING.maxTerrainHeight,
    'the seabed must not be deeper than maxTerrainHeight');
});

test('sampleHeight interpolates between cell centres', () => {
  const hf = generateHeightmap(SEED, SIZE);
  const raw = hf[10 * SIZE + 20];
  assert.equal(sampleHeight(hf, 20, 10), raw, 'integer cells return the exact height');
  const mid = sampleHeight(hf, 20.5, 10);
  const a = hf[10 * SIZE + 20];
  const b = hf[10 * SIZE + 21];
  assert.ok(mid >= Math.min(a, b) - 1e-6 && mid <= Math.max(a, b) + 1e-6,
    'a fractional sample must stay between its neighbours');
});

test('surface types are classified from height, slope and moisture', () => {
  const hf = generateHeightmap(SEED, SIZE);
  const level = waterLevelFor(hf);
  const types = generateTypeMap(hf, SIZE, level);

  // every id maps back to a known name
  for (let i = 0; i < types.length; i += 1) {
    assert.ok(TERRAIN_TYPES[types[i]], `type id ${types[i]} must be known`);
  }

  // submerged cells are water, dry cells are not
  let checked = 0;
  for (let i = 0; i < hf.length; i += 1) {
    const cx = i % SIZE;
    const cz = (i - cx) / SIZE;
    const name = terrainTypeAt(hf, cx, cz, level);
    if (hf[i] < level) {
      assert.equal(name, 'water', 'submerged cells are water');
      assert.equal(types[i], TERRAIN_TYPE_IDS.water);
      checked += 1;
    }
    if (checked > 40) break;
  }
  assert.ok(checked > 0, 'the map must contain water cells');

  // the type of a cell matches the id map
  const cx = 32;
  const cz = 32;
  assert.equal(types[cz * SIZE + cx], TERRAIN_TYPE_IDS[terrainTypeAt(hf, cx, cz, level)]);
});

test('slopeAt reports the largest neighbour height difference', () => {
  const flat = new Float32Array(9).fill(4);
  assert.equal(slopeAt(flat, 1, 1), 0, 'a flat map has no slope');

  const step = new Float32Array(9).fill(4);
  step[4] = 10;              // centre, 6 above every neighbour
  assert.equal(slopeAt(step, 1, 1), 6, 'the centre is 6 above its neighbours');
  assert.equal(slopeAt(step, 0, 0), 6, 'a neighbour sees the same step');
});

test('terraform raises and lowers a cell, and clamps at the range limits', () => {
  const hf = generateHeightmap(SEED, SIZE);
  const before = sampleHeight(hf, 30, 30);
  const raised = raiseTerrain(hf, 30, 30, TUNING.heightStep);
  assert.ok(raised > before, 'raise must increase the height');
  assert.ok(Math.abs((raised - before) - TUNING.heightStep) < 1e-5,
    'raise must move by exactly one layer step');
  const lowered = raiseTerrain(hf, 30, 30, -TUNING.heightStep);
  assert.ok(Math.abs(lowered - before) < 1e-5, 'lower must undo the raise');

  // clamping
  for (let i = 0; i < 40; i += 1) raiseTerrain(hf, 30, 30, TUNING.heightStep);
  assert.equal(sampleHeight(hf, 30, 30), TUNING.maxTerrainHeight, 'height is clamped at the top');
  for (let i = 0; i < 80; i += 1) raiseTerrain(hf, 30, 30, -TUNING.heightStep);
  assert.ok(sampleHeight(hf, 30, 30) >= -TUNING.maxTerrainHeight, 'height is clamped at the bottom');

  // out of bounds writes are refused (edge case E1)
  assert.equal(raiseTerrain(hf, -1, 0, 1), null);
  assert.equal(raiseTerrain(hf, 0, SIZE, 1), null);
  assert.equal(setHeight(hf, -1, 0, 3), null);
});

test('water depth and the water map agree with the flood line', () => {
  const hf = generateHeightmap(SEED, SIZE);
  const level = waterLevelFor(hf);
  const water = generateWaterMap(hf, SIZE, level);
  let wet = 0;
  for (let cz = 0; cz < SIZE; cz += 1) {
    for (let cx = 0; cx < SIZE; cx += 1) {
      const i = cz * SIZE + cx;
      const expected = level > hf[i] ? level - hf[i] : 0;
      assert.equal(water[i], expected);
      if (water[i] > 0) {
        wet += 1;
        assert.ok(isWater(hf, cx, cz, level));
        assert.equal(waterDepth(hf, cx, cz, level), expected);
      }
    }
  }
  assert.ok(wet > 0, 'the map must contain water');
});

test('floodFill returns the connected low region around the seed', () => {
  const hf = generateHeightmap(SEED, SIZE);
  const level = waterLevelFor(hf);
  let seedIndex = -1;
  for (let i = 0; i < hf.length; i += 1) {
    if (hf[i] < level) { seedIndex = i; break; }
  }
  assert.ok(seedIndex >= 0, 'the map must contain a flooded cell');
  const sx = seedIndex % SIZE;
  const sz = (seedIndex - sx) / SIZE;

  const res = floodFill(hf, SIZE, sx, sz, level);
  assert.ok(res.count > 0, 'flooding must reach at least the seed cell');
  assert.ok(res.count <= SIZE * SIZE);
  assert.equal(res.mask[seedIndex], 1, 'the seed is part of the flood');
  for (const i of res.cells) {
    assert.ok(hf[i] < level, 'only submerged cells flood');
  }
  // 4-connectivity: every flooded cell touches another flooded cell.
  const set = new Set(res.cells);
  for (const i of res.cells) {
    const cx = i % SIZE;
    const cz = (i - cx) / SIZE;
    const touches = set.has(i - 1) || set.has(i + 1) || set.has(i - SIZE) || set.has(i + SIZE);
    assert.ok(touches, 'flooded cells form a connected region');
  }

  // a dry seed floods nothing
  let dryIndex = -1;
  for (let i = 0; i < hf.length; i += 1) if (hf[i] >= level) { dryIndex = i; break; }
  const dx = dryIndex % SIZE;
  const dz = (dryIndex - dx) / SIZE;
  assert.equal(floodFill(hf, SIZE, dx, dz, level).count, 0);
});

test('water bodies are 4-connected components of the submerged cells', () => {
  const hf = generateHeightmap(SEED, SIZE);
  const level = waterLevelFor(hf);
  const bodies = computeWaterBodies(hf, SIZE, level);
  assert.ok(bodies.length >= 1, 'the generator must produce at least one water body');
  const total = bodies.reduce((n, b) => n + b.count, 0);
  let submerged = 0;
  for (let i = 0; i < hf.length; i += 1) if (hf[i] < level) submerged += 1;
  assert.equal(total, submerged, 'every submerged cell belongs to exactly one body');
  assert.ok(bodies[0].count > 100, 'the sea must be a substantial body');
  assert.ok(bodies[0].navigable, 'a big body is navigable');
});

test('smoothHeightmap averages the neighbourhood', () => {
  const noisy = new Float32Array(9);
  noisy[0] = 0; noisy[1] = 0; noisy[2] = 0;
  noisy[3] = 0; noisy[4] = 10; noisy[5] = 0;
  noisy[6] = 0; noisy[7] = 0; noisy[8] = 0;
  const before = noisy[4];
  smoothHeightmap(noisy, 3, 1);
  assert.ok(noisy[4] < before, 'smoothing must pull the spike down');
  assert.ok(noisy[4] > 0, 'smoothing must not flatten the spike entirely');
});

// --------------------------------------------------------------------------
// scatter
// --------------------------------------------------------------------------

test('scatter only places real manifest models and is deterministic', () => {
  const hf = generateHeightmap(SEED, SIZE);
  const plan = planScatter(hf, SEED, { size: SIZE });
  assert.ok(plan.length > 50, `expected a populated map, got ${plan.length} placements`);
  assert.ok(plan.length < 3000, 'the scatter must stay within a sane budget');

  for (const p of plan) {
    assert.ok(manifest.models[p.model], `${p.model} must exist in the manifest`);
    assert.ok(isPlaceableNatureKey(p.model, manifest), `${p.model} must be a nature model`);
    assert.ok(Number.isInteger(p.cx) && Number.isInteger(p.cz));
    assert.ok(p.cx >= 0 && p.cx < SIZE && p.cz >= 0 && p.cz < SIZE);
    assert.ok(Number.isFinite(p.rot) && Number.isFinite(p.scale));
    assert.ok(p.scale > 0.5 && p.scale < 1.6, 'the scale jitter stays sane');
  }

  const again = planScatter(hf, SEED, { size: SIZE });
  assert.deepEqual(again, plan, 'the same seed must give the same scatter');

  const other = planScatter(hf, SEED + 1, { size: SIZE });
  assert.notDeepEqual(other, plan, 'a different seed must give a different scatter');
});

test('scattered trees respect the minimum spacing and no cell is used twice', () => {
  const hf = generateHeightmap(SEED, SIZE);
  const plan = planScatter(hf, SEED, { size: SIZE });

  const trees = plan.filter((p) => p.model.includes('_oak_01')
    || p.model.includes('_pine_01')
    || p.model.includes('_birch_01'));
  assert.ok(trees.length > 10, 'the map must actually contain trees');

  const spacing = WLD_TUNING.treeSpacing;
  for (let i = 0; i < trees.length; i += 1) {
    for (let j = i + 1; j < trees.length; j += 1) {
      const dx = Math.abs(trees[i].cx - trees[j].cx);
      const dz = Math.abs(trees[i].cz - trees[j].cz);
      assert.ok(Math.max(dx, dz) >= spacing,
        `trees at ${trees[i].cx},${trees[i].cz} and ${trees[j].cx},${trees[j].cz} are too close`);
    }
  }

  const cells = new Set(plan.map((p) => p.cz * SIZE + p.cx));
  assert.equal(cells.size, plan.length, 'no two props share a cell');
});

test('every nature key the scatter can use exists in the manifest', () => {
  for (const key of NATURE_KEYS) {
    assert.ok(manifest.models[key], `${key} must exist in the manifest`);
    assert.equal(manifest.models[key].family, 'nature');
  }
});

// --------------------------------------------------------------------------
// terrain mesh
// --------------------------------------------------------------------------

test('the terrain mesh is one merged geometry with a fixed vertex layout', () => {
  const ctx = mockCtx();
  const hf = generateHeightmap(SEED, SIZE);
  ctx.state.world.heightmap = hf;
  ctx.state.world.waterLevel = waterLevelFor(hf);

  const mesh = buildTerrainMesh(ctx, hf);
  const stats = terrainMeshStats(ctx);

  assert.ok(mesh, 'a mesh must be produced');
  // The vertex buffer is fixed per cell (20 slots: 1 top quad + 4 skirt
  // slots) so a terraform can expose a cliff without a rebuild, plus the
  // 8 apron quads past the grid edge. The INDEX buffer is deliberately
  // variable: a skirt is only indexed where the height really steps.
  assert.equal(stats.cells, SIZE * SIZE, 'one cell per grid position');
  assert.equal(stats.vertices, stats.cells * 20 + 32, '20 slots per cell + 8 apron quads');
  assert.equal(stats.triangles, stats.cells * 2 + stats.skirtQuads * 2 + 16,
    'a top quad per cell, a quad per exposed cliff, and the apron');
  assert.equal(mesh.geometry.index.count, stats.triangles * 3, 'the index buffer matches');
  assert.ok(stats.cliffFaces > 100, 'the map must expose cliff faces');
  assert.equal(stats.cliffFaces, stats.skirtQuads, 'every cliff face is a real quad');
  assert.equal(stats.degenerateTriangles, 0, 'no degenerate (zero-area) skirt may be emitted');
  assert.ok(stats.skirtQuads < stats.cells * 4,
    'a cliff must only be emitted where the height actually steps');

  // geometry sits inside the world bounds
  const pos = mesh.geometry.attributes.position.array;
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    minX = Math.min(minX, pos[i]); maxX = Math.max(maxX, pos[i]);
    minZ = Math.min(minZ, pos[i + 2]); maxZ = Math.max(maxZ, pos[i + 2]);
  }
  // The apron (D-05) reaches past the grid so the map never floats with bare
  // sky under it, so the mesh is WIDER than the playable grid — it must
  // cover the grid and extend beyond it, not start at the grid edge.
  const apron = APRON_CELLS * CELL;
  assert.ok(minX < WORLD.originX - 1e-3, 'the apron reaches past the west edge');
  assert.ok(maxX > WORLD.originX + WORLD.width + 1e-3, 'the apron reaches past the east edge');
  assert.ok(minZ < WORLD.originZ - 1e-3, 'the apron reaches past the north edge');
  assert.ok(maxZ > WORLD.originZ + WORLD.depth + 1e-3, 'the apron reaches past the south edge');
  assert.ok(minX >= WORLD.originX - apron - 1e-3, 'the apron is not wider than it claims');
  assert.ok(maxX <= WORLD.originX + WORLD.width + apron + 1e-3);

  // colours are present and in range
  const col = mesh.geometry.attributes.color.array;
  for (let i = 0; i < col.length; i += 1) {
    assert.ok(col[i] >= 0 && col[i] <= 1, 'vertex colours stay in range');
  }

  disposeTerrainMesh(ctx);
});

test('a terraform patches the mesh in place instead of rebuilding it', () => {
  const ctx = mockCtx();
  const hf = generateHeightmap(SEED, SIZE);
  ctx.state.world.heightmap = hf;
  ctx.state.world.waterLevel = waterLevelFor(hf);
  const mesh = buildTerrainMesh(ctx, hf);

  const pos = mesh.geometry.attributes.position.array;
  const before = pos.slice();
  const vertexCount = mesh.geometry.attributes.position.count;

  const cx = 32;
  const cz = 32;
  raiseTerrain(hf, cx, cz, TUNING.heightStep);
  markTerrainDirty(ctx, cx, cz);
  const refreshed = refreshTerrainMesh(ctx, true);

  assert.ok(refreshed, 'the refresh must apply the pending edit');
  assert.equal(mesh.geometry.attributes.position.count, vertexCount,
    'a partial refresh keeps the vertex layout');
  assert.notDeepEqual(Array.from(pos), Array.from(before), 'the geometry must change');

  // the edited cell's top quad moved up by exactly one step
  const base = (cz * SIZE + cx) * 20 * 3;
  const beforeY = before[base + 1];
  const afterY = pos[base + 1];
  assert.ok(Math.abs((afterY - beforeY) - TUNING.heightStep) < 1e-4,
    'the top face moved by one layer step');

  disposeTerrainMesh(ctx);
});

// --------------------------------------------------------------------------
// the WLD service (integration, head-less)
// --------------------------------------------------------------------------

test('createWorld boots, terraforms and disposes', async () => {
  const ctx = mockCtx({
    config: { GRID, CELL, WORLD, PALETTE, TUNING, TOOLS, THREE },
    assets: {
      loadModel: async (key) => {
        const o = new THREE.Object3D();
        o.name = key;
        return o;
      },
    },
  });
  const events = [];
  ctx.bus = { emit: (name, payload) => events.push({ name, payload }) };

  const world = createWorld(ctx);
  await world.init();

  // --- state is filled -----------------------------------------------------
  assert.ok(ctx.state.world.heightmap instanceof Float32Array);
  assert.equal(ctx.state.world.heightmap.length, SIZE * SIZE);
  assert.ok(ctx.state.world.water instanceof Float32Array);
  assert.ok(ctx.state.world.types instanceof Uint8Array);
  assert.equal(ctx.state.world.waterLevel, 0);
  assert.equal(ctx.state.world.modified, 0);
  assert.ok(ctx.state.world.scenery.length > 50, 'nature was scattered');

  // --- meshes are in the world group --------------------------------------
  const names = ctx.renderer.world.children.map((c) => c.name);
  assert.ok(names.includes('terrain'), 'the terrain mesh was added');
  assert.ok(names.includes('water'), 'the water mesh was added');
  const diag = worldDiagnostics(ctx);
  assert.equal(diag.terrain.cells, SIZE * SIZE);
  assert.ok(diag.bodies >= 1, 'the map has at least one water body');

  // --- the binding public surface ----------------------------------------
  for (const method of ['init', 'update', 'tick', 'generate', 'heightAt', 'setHeight',
    'typeAt', 'waterLevel', 'isWater', 'buildMesh', 'scatter', 'placeNature',
    'terraform', 'dispose', 'onClick', 'onHover']) {
    assert.equal(typeof world[method], 'function', `${method} must exist`);
  }

  // --- terraforming --------------------------------------------------------
  const cx = 20;
  const cz = 44;
  const before = world.heightAt(cx, cz);
  const res = world.terraform(cx, cz, TUNING.heightStep);
  assert.equal(res.ok, true);
  assert.ok(Math.abs((world.heightAt(cx, cz) - before) - TUNING.heightStep) < 1e-5);
  assert.equal(ctx.state.world.modified, 1, 'the world is marked as modified');
  assert.ok(events.some((e) => e.name === 'world:terrain'), 'TERRAIN_CHANGED was emitted');
  assert.equal(world.typeAt(cx, cz), 'grass');
  assert.equal(world.isWater(cx, cz), false);

  // the terraform tool raises on a left click and lowers on a right click
  ctx.state.ui.tool = TOOLS.terraform;
  const h0 = world.heightAt(cx, cz);
  world.onClick({ x: cx, z: cz }, 0);
  assert.ok(world.heightAt(cx, cz) > h0, 'a left click raises the terrain');
  world.onClick({ x: cx, z: cz }, 2);
  assert.ok(Math.abs(world.heightAt(cx, cz) - h0) < 1e-5, 'a right click lowers it back');

  // other tools do nothing
  ctx.state.ui.tool = TOOLS.build;
  const h1 = world.heightAt(cx, cz);
  world.onClick({ x: cx, z: cz }, 0);
  assert.equal(world.heightAt(cx, cz), h1, 'only the terraform tool edits terrain');

  // an unknown model key is refused
  const bad = await world.placeNature(cx, cz, 'not_a_real_model');
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /unknown model/);

  // --- disposal ------------------------------------------------------------
  world.dispose();
  assert.equal(ctx.renderer.world.children.length, 0, 'every mesh was removed');
});
