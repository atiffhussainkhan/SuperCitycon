/**
 * world/index.js — the WLD domain service.
 *
 * OWNERSHIP: WLD (world domain). Owns `state.world`:
 *   heightmap, water, types, waterLevel, scenery, modified.
 *
 * Public surface (binding — see core/CONTRACT.md §7):
 *   init, update, tick, generate(seed), heightAt(cx,cz), setHeight(cx,cz,h),
 *   typeAt(cx,cz), waterLevel(), isWater(cx,cz), buildMesh(), scatter(seed),
 *   placeNature(cx,cz,modelKey), terraform(cx,cz,delta), dispose
 *   + onClick(cell, button) and onHover(cell).
 */

import { GRID, TUNING, TOOLS, inBounds } from '../core/config.js';
import { EVENTS } from '../core/events.js';
import { cellKey, liveStateProxy } from '../core/state.js';
import {
  generateHeightmap,
  generateTypeMap,
  generateWaterMap,
  raiseTerrain,
  sampleHeight,
  setHeight as setHeightAt,
  terrainTypeAt,
} from './heightfield.js';
import {
  animateWaterMesh,
  buildWaterMesh,
  computeWaterBodies,
  floodFill,
  waterLevelFor,
} from './water.js';
import {
  buildTerrainMesh,
  disposeTerrainMesh,
  markTerrainDirty,
  refreshTerrainMesh,
  terrainMeshStats,
} from './terrain.js';
import { clearScenery, clearSceneryAt, placeNature as placeNatureModel, scatterNature } from './scatter.js';

export { generateHeightmap, terrainTypeAt } from './heightfield.js';

/** Per-context bookkeeping that is not part of the binding service surface. */
const meta = new WeakMap();

function metaOf(ctx) {
  let m = meta.get(ctx);
  if (!m) {
    m = { hover: null, ready: false };
    meta.set(ctx, m);
  }
  return m;
}

export function createWorld(ctx) {
  /**
   * The live state tree.
   *
   * `ctx.state` is a GETTER in main.js (core/state.js `setState()` REPLACES
   * the state object when a save is loaded or the game is reset), so a
   * captured `ctx.state` would be an ORPHANED tree: the domain would keep
   * writing into an object nobody reads while the live tree stayed at zero.
   * Every access therefore resolves through `ctx.state` again.
   */
  const state = liveStateProxy(ctx);
  const m = metaOf(ctx);

  let waterMesh = null;
  let elapsed = 0;
  /** Signature of the last scenery reconciliation (roads + buildings). */
  let lastCitySignature = '';

  const size = () => ctx.config?.GRID?.size ?? GRID.size;

  /**
   * D-01: decorative scenery never blocks construction, and whatever takes a
   * cell takes the scenery on it with it.
   *
   * The buildings domain clears the scenery explicitly when it places a
   * building. The ROAD TOOL, however, is driven by the UX layer straight
   * into `mobility.addRoad()` and never passes through the buildings domain,
   * so this reconciliation is what makes a road clear its scenery too.
   *
   * It is cheap: the signature is two counters, and the scan only runs when
   * the city actually changed.
   */
  function reconcileScenery() {
    const list = state.world?.scenery;
    if (!Array.isArray(list) || !list.length) return 0;
    const roads = state.mobility?.roads;
    const occupied = state.buildings?.occupancy;
    const hasRoads = roads instanceof Map || roads instanceof Set;
    const hasOccupancy = occupied instanceof Map;
    if (!hasRoads && !hasOccupancy) return 0;
    const doomed = [];
    for (const rec of list) {
      if (!rec) continue;
      const key = cellKey(rec.cx, rec.cz);
      if (hasRoads && roads.has(key)) { doomed.push(rec); continue; }
      if (hasOccupancy && occupied.has(key)) doomed.push(rec);
    }
    if (!doomed.length) return 0;
    return clearSceneryAt(ctx, doomed.map((r) => ({ x: r.cx, z: r.cz })));
  }

  /** Drop every mesh this domain owns (regeneration must not leak them). */
  function disposeMeshes() {
    if (waterMesh) {
      if (waterMesh.parent) waterMesh.parent.remove(waterMesh);
      waterMesh.geometry?.dispose?.();
      waterMesh.material?.dispose?.();
      waterMesh = null;
    }
    disposeTerrainMesh(ctx);
    clearScenery(ctx);
  }

  /** Recompute the derived per-cell data of one cell after a terrain edit. */
  function refreshCellData(cx, cz) {
    const world = state.world;
    if (!world.heightmap || !world.water || !world.types) return;
    const s = size();
    const i = cz * s + cx;
    const level = world.waterLevel;
    const h = world.heightmap[i];
    world.water[i] = level > h ? level - h : 0;
    world.types[i] = terrainTypeAt(world.heightmap, cx, cz, level);
  }

  /**
   * Recompute the derived data of a cell AND its neighbours: an edit changes
   * the neighbours' slope, which can change their surface type.
   */
  function refreshCellNeighbourhood(cx, cz) {
    const s = size();
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= s || nz >= s) continue;
        refreshCellData(nx, nz);
      }
    }
  }

  const service = {
    /** Boot: generate the world for `state.meta.seed` and build the scene. */
    async init() {
      await service.generate(state.meta.seed ?? 0);
      m.ready = true;
      return service;
    },

    /**
     * Regenerate the world from a seed. Disposes the old meshes first.
     * The heightmap / water / type maps are filled synchronously before the
     * first await, so a caller that does not await still sees valid data.
     */
    async generate(seed = state.meta.seed ?? 0) {
      disposeMeshes();

      const s = size();
      const hf = generateHeightmap(seed, s);
      const level = waterLevelFor(hf);

      state.world.heightmap = hf;
      state.world.water = generateWaterMap(hf, s, level);
      state.world.types = generateTypeMap(hf, s, level);
      state.world.waterLevel = level;
      state.world.modified = 0;
      state.world.seed = seed;
      state.world.scenery = [];
      state.world.sceneryCount = 0;

      buildTerrainMesh(ctx, hf);
      waterMesh = await buildWaterMesh(ctx, level);
      await service.scatter(seed);

      ctx.bus?.emit?.(EVENTS.TERRAIN_CHANGED, { reason: 'generated', seed });
      return { seed, waterLevel: level, cells: s * s };
    },

    /** Per-frame (wall clock). */
    update(dt = 0) {
      elapsed += dt;
      refreshTerrainMesh(ctx);
      if (waterMesh) animateWaterMesh(waterMesh, elapsed);
      // D-01: a road or a building takes the scenery under it with it.
      const signature = `${state.mobility?.roads?.size ?? 0}:${state.buildings?.instances?.size ?? 0}`;
      if (signature !== lastCitySignature) {
        lastCitySignature = signature;
        reconcileScenery();
      }
    },

    /** Per-simulation-step (game time). The world has no simulation of its own. */
    tick(dt = 0) {
      void dt;
    },

    /** The world-space terrain height at a cell. */
    heightAt(cx, cz) {
      const hf = state.world.heightmap;
      if (!hf) return 0;
      return sampleHeight(hf, cx, cz);
    },

    /** Set the height of a cell (absolute). */
    setHeight(cx, cz, h) {
      const hf = state.world.heightmap;
      if (!hf) return { ok: false, reason: 'no heightmap' };
      if (!inBounds(cx, cz)) return { ok: false, reason: 'cell out of bounds' };
      const before = sampleHeight(hf, cx, cz);
      const after = setHeightAt(hf, cx, cz, h);
      if (after === null) return { ok: false, reason: 'cell out of bounds' };
      if (after === before) return { ok: false, reason: 'height unchanged' };
      refreshCellNeighbourhood(cx, cz);
      markTerrainDirty(ctx, cx, cz);
      state.world.modified = (state.world.modified || 0) + 1;
      ctx.bus?.emit?.(EVENTS.TERRAIN_CHANGED, { cx, cz, height: after, reason: 'setHeight' });
      return { ok: true, height: after };
    },

    /** The surface type name of a cell. */
    typeAt(cx, cz) {
      const hf = state.world.heightmap;
      if (!hf) return 'grass';
      return terrainTypeAt(hf, cx, cz, state.world.waterLevel);
    },

    /** The world-space water surface height. */
    waterLevel() {
      return state.world.waterLevel ?? 0;
    },

    /** True when a cell is below the water line. */
    isWater(cx, cz) {
      const hf = state.world.heightmap;
      if (!hf) return false;
      return sampleHeight(hf, cx, cz) < (state.world.waterLevel ?? 0);
    },

    /** Rebuild the terrain mesh from the current heightmap. */
    buildMesh() {
      if (!state.world.heightmap) return null;
      return buildTerrainMesh(ctx, state.world.heightmap);
    },

    /** Re-scatter the nature models. */
    async scatter(seed = state.world.seed ?? 0) {
      const hf = state.world.heightmap;
      if (!hf) return [];
      clearScenery(ctx);
      const plan = await scatterNature(ctx, hf, seed);
      return plan;
    },

    /** Place one specific library model on a cell. */
    async placeNature(cx, cz, modelKey) {
      return placeNatureModel(ctx, cx, cz, modelKey);
    },

    /**
     * Raise (or lower) a cell by `delta` world units.
     * Updates the heightmap, the derived water/type data and the mesh, marks
     * the world as modified and announces the change on the bus.
     */
    terraform(cx, cz, delta) {
      const hf = state.world.heightmap;
      if (!hf) return { ok: false, reason: 'no heightmap' };
      if (!inBounds(cx, cz)) return { ok: false, reason: 'cell out of bounds' };
      const before = sampleHeight(hf, cx, cz);
      const after = raiseTerrain(hf, cx, cz, delta);
      if (after === null) return { ok: false, reason: 'cell out of bounds' };
      if (after === before) return { ok: false, reason: 'height unchanged' };

      refreshCellNeighbourhood(cx, cz);
      markTerrainDirty(ctx, cx, cz);
      state.world.modified = (state.world.modified || 0) + 1;
      ctx.bus?.emit?.(EVENTS.TERRAIN_CHANGED, { cx, cz, delta, height: after });
      return { ok: true, height: after, delta };
    },

    /** Tool dispatch: the terraform tool raises on left click, lowers on right. */
    onClick(cell, button = 0) {
      const tool = state.ui?.tool ?? TOOLS.inspect;
      if (tool !== TOOLS.terraform) return;
      if (!cell) return;
      const cx = cell.x ?? cell.cx;
      const cz = cell.z ?? cell.cz;
      if (!inBounds(cx, cz)) return;
      const step = button === 2 ? -TUNING.heightStep : TUNING.heightStep;
      service.terraform(cx, cz, step);
    },

    /** Hover feedback (the UX layer owns the visible cursor). */
    onHover(cell) {
      m.hover = cell ?? null;
    },

    /** Release every resource this domain owns. */
    dispose() {
      disposeMeshes();
      m.ready = false;
    },
  };

  return service;
}

/**
 * Diagnostics for tooling and tests (kept off the service so the binding
 * public surface stays exactly as specified in core/CONTRACT.md §7).
 */
export function worldDiagnostics(ctx) {
  const world = ctx?.state?.world ?? {};
  const hf = world.heightmap;
  const size = ctx?.config?.GRID?.size ?? GRID.size;
  const m = metaOf(ctx);
  return {
    ready: m.ready,
    hover: m.hover,
    seed: world.seed,
    waterLevel: world.waterLevel,
    modified: world.modified ?? 0,
    scenery: world.scenery?.length ?? 0,
    terrain: terrainMeshStats(ctx),
    bodies: hf ? computeWaterBodies(hf, size, world.waterLevel).length : 0,
  };
}

/**
 * Which cells flood when the terrain around `(cx, cz)` is lowered to
 * `level` (terraforming feedback).
 */
export function floodAt(ctx, cx, cz, level = ctx?.state?.world?.waterLevel ?? 0) {
  const hf = ctx?.state?.world?.heightmap;
  const size = ctx?.config?.GRID?.size ?? GRID.size;
  if (!hf) return { cells: [], mask: new Uint8Array(0), count: 0, level };
  return floodFill(hf, size, cx, cz, level);
}
