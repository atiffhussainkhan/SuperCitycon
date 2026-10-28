/**
 * buildings/index.js — the BLD domain service.
 *
 * OWNER: BLD. This is the ONLY module in the buildings folder that touches
 * Three.js: catalogue.js, properties.js and placement.js stay pure so they
 * can be unit-tested in Node.
 *
 * The integrator calls (see core/CONTRACT.md §7):
 *   createBuildings(ctx) -> {
 *     init, update, tick, catalogue, instances,
 *     place(typeId, cx, cz, rot) -> {ok, reason, id},
 *     remove(cx, cz)  -> {ok, reason},
 *     buildingAt(cx, cz), canPlace(typeId, cx, cz) -> {ok, reason},
 *     upgrade(cx, cz), occupancy(cx, cz), countByType(typeId), dispose,
 *     onClick(cell, button), setTool(tool)
 *   }
 *
 * Every placed building is a real library model: `ctx.assets.loadModel(key)`
 * is called for the entry's manifest key, the model is centred on the
 * instance's footprint using the manifest's centreXZ and added to
 * `ctx.renderer.world`.
 */

import { cellCenter } from '../render/renderer.js';
import { EVENTS } from '../core/events.js';
import { TOOLS } from '../core/config.js';
import { clearSceneryAt } from '../world/scatter.js';
import { disposeInstancedBatch, makeInstancedBatch } from '../render/performance.js';
import {
  BUILDING_DEFS, CATEGORIES, getDefinition, catalogueSize, availableCount,
} from './catalogue.js';
import {
  deriveCost, deriveCapacity, diversityPoints, diversityPenalty, wealthLevel,
  categoryPoints,
} from './properties.js';
import {
  ensureState, canPlace, placeInstance, removeInstance, upgradeInstance,
  occupancy, allInstances, countByType, footprintCentre, footprintHeight,
  normaliseRotation, paintZone, zoneAt,
} from './placement.js';
import { liveStateProxy } from '../core/state.js';

/** Rotate a local XZ offset by the instance's quarter turns (Three.js Y axis). */
function rotateOffset(offset, rot) {
  const [a, b] = offset ?? [0, 0];
  switch (normaliseRotation(rot)) {
    case 1: return [b, -a];
    case 2: return [-a, -b];
    case 3: return [-b, a];
    default: return [a, b];
  }
}

/**
 * Create the BLD service.
 * @param {object} ctx the shared context (core/CONTRACT.md §1)
 */
export function createBuildings(ctx) {
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
  const bus = ctx.bus;
  const renderer = ctx.renderer;
  const assets = ctx.assets;

  /**
   * modelKey -> the instanced batch that draws every copy of that model.
   *
   * A city puts many copies of the same library model on the map. Giving
   * every copy its own `Object3D` cost one draw call per copy, so a
   * mid-size city meant hundreds of draw calls. A batch draws every copy of
   * one model with ONE draw call per model part.
   *
   * Kept OUT of the state so saves stay plain.
   */
  const batches = new Map();
  /** modelKey -> Promise<batch|null>, so concurrent placements share a load. */
  const batchPromises = new Map();
  /** instanceId -> { key, slot } — which batch slot a building occupies. */
  const slots = new Map();
  /** instanceIds whose model is still loading. */
  const pending = new Set();

  let tool = null;
  let selectedTypeId = null;
  let selectedRotation = 0;
  let aggregates = null;
  let dirty = true;
  /** True once dispose() ran: no model may be added to the world any more. */
  let disposed = false;

  // -------------------------------------------------------------------------
  // 3D model handling
  // -------------------------------------------------------------------------

  /**
   * Load and place the 3D model for an instance.
   * The asset service already applies the manifest's scale and ground offset;
   * the footprint is centred by subtracting the (rotated) centreXZ.
   *
   * The load is asynchronous, so the instance may be demolished (or replaced)
   * while the model is in flight: the mesh is then dropped instead of being
   * left behind in the world as a ghost.
   */
  async function attachModel(instance, def) {
    if (!def || !def.model) return null;
    const key = def.model;
    const batch = await ensureBatch(key);
    if (!batch) return null;

    // The instance may have been demolished while the model was loading.
    const live = state.buildings.instances.get(instance.id);
    if (!live || live !== instance) return null;
    if (disposed) return null;

    // A re-init must not leave two models on the same instance.
    detachModel(live.id);
    writeInstance(live, def, batch);
    return batch;
  }

  /**
   * Load the model behind a batch key and create its batch.
   *
   * The load is asynchronous, so the PROMISES are cached: two buildings
   * placed in the same tick must not create two batches for one model.
   */
  function ensureBatch(key) {
    const existing = batchPromises.get(key);
    if (existing) return existing;
    const promise = (async () => {
      let model = null;
      try {
        model = await assets.loadModel(key);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[bld] could not load model "${key}":`, err?.message ?? err);
      }
      if (!model) model = assets.getModel?.(key) ?? null;
      if (!model) {
        // eslint-disable-next-line no-console
        console.warn(`[bld] model "${key}" is unavailable; the instance stays on the map`);
        return null;
      }
      if (disposed) return null;
      let batch = null;
      try {
        batch = makeInstancedBatch(model, 8);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[bld] model "${key}" cannot be instanced:`, err?.message ?? err);
        return null;
      }
      // The asset service put the model's base at its yOffset and scaled the
      // root by the family scale. The instance transform carries both, so
      // they are read off the loaded root rather than guessed.
      batch.modelYOffset = Number(model.position?.y) || 0;
      batch.modelScale = Number(model.scale?.x) || 1;
      batch.free = [];
      batch.nextSlot = 0;
      batch.group.userData.batchKey = key;
      batch.added = false;
      // The domain may have been disposed while the model was loading: the
      // batch must not be adopted (it would leak its GPU buffers).
      if (disposed) {
        // The BATCH object is passed, not its group: the helper frees the
        // parts and the geometry this batch cloned.
        disposeInstancedBatch(batch);
        return null;
      }
      batches.set(key, batch);
      return batch;
    })();
    batchPromises.set(key, promise);
    return promise;
  }

  /**
   * Write one building into its batch.
   *
   * The instance matrix carries the position, the yaw, the family scale and
   * the ground offset — everything the batched geometry does not.
   */
  function writeInstance(live, def, batch) {
    const key = def.model;
    const rec = assets.manifest?.models?.[key] ?? ctx.manifest?.models?.[key];
    const centre = footprintCentre(def, live.x, live.z, live.rot);
    const c = cellCenter(centre.x, centre.z);
    const off = rotateOffset(rec?.centerXZ ?? [0, 0], live.rot);

    // The ground height of the footprint is added on top of the model's own
    // ground offset so the building sits ON the terrain, not in it.
    const y = (batch.modelYOffset ?? 0) + footprintHeight(state, live.cells ?? []);

    let slot = slots.get(live.id)?.slot;
    if (slot === undefined) {
      slot = batch.free.length ? batch.free.pop() : batch.nextSlot++;
      if (slot >= batch.capacity) batch.grow(slot + 1);
      slots.set(live.id, { key, slot });
    }

    batch.setInstance(slot, {
      x: c.x - off[0],
      y,
      z: c.z - off[1],
      rotY: live.rot * (Math.PI / 2),
      scale: batch.modelScale ?? 1,
    });

    // The batch joins the scene with its FIRST building, so a model whose
    // instance was demolished while it was loading leaves nothing behind.
    if (!batch.added && !disposed) {
      renderer.world.add(batch.group);
      batch.added = true;
    }
    return slot;
  }

  function detachModel(instanceId) {
    const entry = slots.get(instanceId);
    if (!entry) return false;
    const batch = batches.get(entry.key);
    if (batch) {
      // The slot is hidden, not freed: a neighbouring building must not move.
      batch.clearInstance(entry.slot);
      batch.free.push(entry.slot);
    }
    slots.delete(instanceId);
    return true;
  }

  // -------------------------------------------------------------------------
  // Derived aggregates (NFR-BLD-004: they must never be stale)
  // -------------------------------------------------------------------------

  function computeAggregates() {
    const instances = allInstances(state);
    const agg = {
      instanceCount: instances.length,
      nextId: state.buildings?.nextId ?? 0,
      residents: 0,
      workspaces: 0,
      jobs: 0,
      energy: { production: 0, consumption: 0 },
      water: { production: 0, consumption: 0 },
      food: { plant: 0, animal: 0, processed: 0, consumption: 0 },
      waste: { production: 0, removal: 0 },
      pollution: 0,
      noise: 0,
      traffic: 0,
      pedestrians: 0,
      points: { culture: 0, entertainment: 0, recreation: 0 },
      wealth: 0,
      diversity: 0,
      diversityPenalty: 0,
      counts: new Map(),
    };

    for (const inst of instances) {
      const def = getDefinition(inst.type);
      if (!def) continue;
      const level = inst.level ?? 1;
      const cap = deriveCapacity(def, level);
      agg.residents += cap.residents;
      agg.workspaces += cap.workspaces;
      agg.jobs += cap.jobs;

      agg.energy.production += def.production?.energy ?? 0;
      agg.energy.consumption += def.consumption?.energy ?? 0;
      agg.water.production += def.production?.water ?? 0;
      agg.water.consumption += def.consumption?.water ?? 0;
      agg.food.plant += def.production?.food?.plant ?? 0;
      agg.food.animal += def.production?.food?.animal ?? 0;
      agg.food.processed += def.production?.food?.processed ?? 0;
      agg.food.consumption += def.consumption?.food ?? 0;
      agg.waste.removal += def.production?.wasteRemoval ?? 0;
      agg.waste.production += def.wasteProduction ?? def.consumption?.waste ?? 0;

      agg.pollution += def.pollution ?? 0;
      agg.noise += def.noise ?? 0;
      agg.traffic += def.trafficGeneration ?? 0;
      agg.pedestrians += def.pedestrianGeneration ?? 0;

      agg.counts.set(def.id, (agg.counts.get(def.id) ?? 0) + 1);
    }

    agg.points.culture = categoryPoints(instances, 'culture');
    agg.points.entertainment = categoryPoints(instances, 'entertainment');
    agg.points.recreation = categoryPoints(instances, 'recreation');
    agg.wealth = wealthLevel(instances);
    agg.diversity = diversityPoints(instances);
    agg.diversityPenalty = diversityPenalty(instances);

    return agg;
  }

  function refreshAggregates() {
    aggregates = computeAggregates();
    state.buildings.aggregates = aggregates;
    dirty = false;
    // Keep the `instances` shim's reported size in step with the map.
    Object.defineProperty(instances, 'length', { value: aggregates.instanceCount, configurable: true });
    return aggregates;
  }

  /**
   * True when the map changed behind our back (a save/load, a reset or a
   * domain that added an instance). The fingerprint is cheap: the instance
   * count and the id counter.
   */
  function aggregatesAreStale() {
    if (dirty || !aggregates) return true;
    const b = state.buildings;
    return aggregates.instanceCount !== (b.instances?.size ?? 0)
      || aggregates.nextId !== (b.nextId ?? 0);
  }

  // -------------------------------------------------------------------------
  // The service
  // -------------------------------------------------------------------------

  /** The catalogue. Callable AND reports its size via `.length`. */
  const catalogue = () => BUILDING_DEFS;
  Object.defineProperty(catalogue, 'length', { value: BUILDING_DEFS.length, configurable: true });

  /** The placed instances. Callable AND reports its size via `.length`. */
  const instances = () => {
    const list = allInstances(state);
    Object.defineProperty(instances, 'length', { value: list.length, configurable: true });
    return list;
  };
  Object.defineProperty(instances, 'length', { value: 0, configurable: true });

  const service = {
    /** Prepare the BLD subtree and publish the catalogue into the state. */
    async init() {
      ensureState(state);
      disposed = false;
      state.buildings.catalogue = new Map(BUILDING_DEFS.map((d) => [d.id, d]));
      state.buildings.catalogueSize = catalogueSize();
      state.buildings.availableCount = availableCount();
      state.buildings.categories = CATEGORIES;
      refreshAggregates();

      // Drop the models of instances that no longer exist (a reset replaced
      // the instances Map but the slot map still held the old buildings).
      for (const [id] of slots) {
        if (!state.buildings.instances.has(id)) detachModel(id);
      }

      // Rebuild the 3D models of anything already on the map (reload, reset).
      for (const inst of allInstances(state)) {
        const def = getDefinition(inst.type);
        if (def) attachModel(inst, def);
      }

      // Warm the model cache in the background - the shop needs the art, the
      // boot screen must not wait for it.
      const keys = [...new Set(BUILDING_DEFS.filter((d) => d.available && d.model).map((d) => d.model))];
      Promise.resolve(assets.preload?.(keys)).catch(() => { /* preloading is best effort */ });
    },

    /** Wall-clock update. Nothing to animate yet. */
    update(dt) {
      void dt;
    },

    /** Game-time tick: refresh the derived aggregates when they went stale. */
    tick(dt) {
      void dt;
      if (aggregatesAreStale()) refreshAggregates();
    },

    catalogue,
    instances,

    /**
     * Place a building.
     *
     * ROAD ENTRIES: a road tile is placed through MOB (`mobility.addRoad`),
     * which owns the road graph AND the road model - it picks the straight /
     * corner / junction / t-split variant from the network topology. Placing
     * a road model here as well would draw two roads on the same cell.
     *
     * SCENERY (D-01): decorative scatter never blocks construction. Building
     * on a cell clears the scenery on that cell: the 3D object leaves the
     * scene and the record leaves `state.world.scenery`.
     *
     * @returns {{ok:boolean, reason:string|null, id:number|null}}
     */
    place(typeId, cx, cz, rot = 0) {
      const def = getDefinition(typeId);
      if (!def) return { ok: false, reason: 'unknown-building', id: null };

      const cost = deriveCost(def, 1);
      const economy = ctx.domains?.economy;
      if (economy && typeof economy.canAfford === 'function') {
        try {
          if (!economy.canAfford(cost)) {
            return { ok: false, reason: 'insufficient-funds', id: null };
          }
        } catch {
          /* a broken economy must not block building */
        }
      }

      // --- a road tile goes through the domain that owns the road graph ---
      if (def.infrastructure === 'road') {
        const mobility = ctx.domains?.mobility;
        if (mobility && typeof mobility.addRoad === 'function') {
          const road = mobility.addRoad(cx, cz);
          if (!road?.ok) {
            return { ok: false, reason: road?.reason ?? 'road-failed', id: null };
          }
          // The road takes the cell: the scenery on it goes away.
          clearSceneryAt(ctx, [{ x: cx, z: cz }]);
          return { ok: true, reason: null, id: null };
        }
        // No mobility domain (head-less / studio): fall through and place
        // the road model ourselves so the catalogue entry still works.
      }

      const result = placeInstance(state, def, cx, cz, rot);
      if (!result.ok) return { ok: false, reason: result.reason, id: null };

      // D-01: building clears the scenery on the cells it takes.
      clearSceneryAt(ctx, result.instance.cells ?? [{ x: cx, z: cz }]);

      pending.add(result.instance.id);
      attachModel(result.instance, def).finally(() => pending.delete(result.instance.id));

      refreshAggregates();
      bus?.emit?.(EVENTS.BUILDING_PLACED, {
        id: result.instance.id,
        type: def.id,
        x: result.instance.x,
        z: result.instance.z,
        rot: result.instance.rot,
        level: result.instance.level,
        cost,
      });
      return { ok: true, reason: null, id: result.instance.id };
    },

    /**
     * Demolish the building on a cell.
     *
     * The bulldozer also clears the scenery on that cell (D-01): the tool
     * scrapes the ground, so a tree or a bush standing there goes too.
     *
     * @returns {{ok:boolean, reason:string|null}}
     */
    remove(cx, cz) {
      const instance = occupancy(state, cx, cz);
      if (!instance) {
        // Nothing built here - but the bulldozer still scrapes the ground.
        clearSceneryAt(ctx, [{ x: cx, z: cz }]);
        return { ok: false, reason: 'no-building' };
      }
      const result = removeInstance(state, cx, cz);
      if (!result.ok) return { ok: false, reason: result.reason };
      detachModel(instance.id);
      clearSceneryAt(ctx, [{ x: cx, z: cz }]);
      refreshAggregates();
      bus?.emit?.(EVENTS.BUILDING_REMOVED, {
        id: instance.id,
        type: instance.type,
        x: instance.x,
        z: instance.z,
        refund: result.refund,
      });
      return { ok: true, reason: null };
    },

    /** The instance standing on a cell, or null. */
    buildingAt(cx, cz) {
      return occupancy(state, cx, cz);
    },

    /** Can this catalogue entry be placed here? */
    canPlace(typeId, cx, cz, rot = 0) {
      const def = getDefinition(typeId);
      if (!def) return { ok: false, reason: 'unknown-building' };
      const check = canPlace(state, def, cx, cz, rot);
      return { ok: check.ok, reason: check.reason };
    },

    /** Upgrade the building on a cell, in place. */
    upgrade(cx, cz) {
      const instance = occupancy(state, cx, cz);
      if (!instance) return { ok: false, reason: 'no-building' };
      const def = getDefinition(instance.type);
      const cost = def ? deriveCost(def, (instance.level ?? 1) + 1) : 0;
      const economy = ctx.domains?.economy;
      if (economy && typeof economy.canAfford === 'function') {
        try {
          if (!economy.canAfford(cost)) {
            return { ok: false, reason: 'insufficient-funds' };
          }
        } catch {
          /* a broken economy must not block the upgrade */
        }
      }
      const result = upgradeInstance(state, cx, cz);
      if (result.ok) {
        refreshAggregates();
        bus?.emit?.(EVENTS.BUILDING_UPGRADED, {
          id: result.instance.id,
          type: result.instance.type,
          x: result.instance.x,
          z: result.instance.z,
          level: result.instance.level,
          cost,
        });
      }
      return { ok: result.ok, reason: result.reason };
    },

    /** The instance standing on a cell, or null. */
    occupancy(cx, cz) {
      return occupancy(state, cx, cz);
    },

    /** How many copies of a catalogue entry are on the map. */
    countByType(typeId) {
      return countByType(state, typeId);
    },

    /** Select the catalogue entry the build tool places. */
    setSelectedType(typeId) {
      selectedTypeId = typeId && getDefinition(typeId) ? typeId : null;
      return selectedTypeId;
    },

    /**
     * The catalogue entry the build tool will place. Falls back to the UX
     * domain's own selection so the build tool works without the UX code
     * having to know about setSelectedType().
     */
    selectedType() {
      if (selectedTypeId && getDefinition(selectedTypeId)) return selectedTypeId;
      const ui = state.ui ?? {};
      const fromUi = ui.selectedType ?? ui.selection?.type ?? ui.selection?.defId;
      return fromUi && getDefinition(fromUi) ? fromUi : null;
    },

    /** Rotate the ghost / the next placement by a quarter turn. */
    setRotation(rot) {
      selectedRotation = normaliseRotation(rot);
      return selectedRotation;
    },

    /**
     * Remember the active tool. Passing null hands the tool back to the UX
     * domain (state.ui.tool).
     */
    setTool(nextTool) {
      tool = nextTool ?? null;
      return tool;
    },

    /**
     * The active tool. A tool set through setTool() wins; otherwise the UX
     * domain's state.ui.tool is followed.
     */
    currentTool() {
      return tool ?? state.ui?.tool ?? TOOLS.inspect;
    },

    /** Place or demolish with the currently selected type. */
    onClick(cell, button) {
      if (!cell || typeof cell.x !== 'number' || typeof cell.z !== 'number') return;
      // Only the left mouse button acts. main.js suppresses the context menu,
      // so a right click would otherwise bulldoze or build.
      if (button === 2 || button === 1) return;
      const active = service.currentTool();
      if (active === TOOLS.bulldoze) {
        service.remove(cell.x, cell.z);
        return;
      }
      const typeId = service.selectedType();
      if (active === TOOLS.build && typeId) {
        service.place(typeId, cell.x, cell.z, selectedRotation);
      }
    },

    /** Paint a zone on a cell (used by the zone tool). */
    paintZone(cx, cz, zoneId) {
      const result = paintZone(state, cx, cz, zoneId);
      if (result.ok) bus?.emit?.(EVENTS.ZONE_CHANGED, { x: cx, z: cz, zoneId });
      return result;
    },

    /** The zone painted on a cell, or null. */
    zoneAt(cx, cz) {
      return zoneAt(state, cx, cz);
    },

    /** The live derived aggregates (recomputed on demand). */
    aggregates() {
      if (aggregatesAreStale()) refreshAggregates();
      return aggregates;
    },

    /** The catalogue size, derived from the loaded records. */
    catalogueSize() {
      return catalogueSize();
    },

    /**
     * How the building models are drawn.
     *
     * Every copy of a model shares ONE instanced batch, so `drawCalls` is the
     * number of draw calls the buildings cost — not the number of buildings.
     *
     * @returns {{batches:number, instances:number, drawCalls:number}}
     */
    renderStats() {
      let instances = 0;
      let drawCalls = 0;
      for (const [, batch] of batches) {
        instances += Math.max(0, batch.nextSlot - batch.free.length);
        drawCalls += batch.parts.length;
      }
      return { batches: batches.size, instances, drawCalls };
    },

    /** Tear the domain down: remove every model from the world. */
    dispose() {
      disposed = true;
      for (const [, batch] of batches) {
        // `disposeInstancedBatch` frees the InstancedMeshes AND the geometry
        // this batch cloned (marked `scBatchOwned`), and takes the group out
        // of the scene. A plain `im.dispose()` would leak the cloned geometry.
        disposeInstancedBatch(batch);
        batch.added = false;
      }
      batches.clear();
      batchPromises.clear();
      slots.clear();
      pending.clear();
      dirty = true;
    },
  };

  // Keep the `instances` shim's reported size in step with the map.
  return service;
}

export { BUILDING_DEFS } from './catalogue.js';
export { CATEGORIES, getDefinition, allDefinitions, definitionsByCategory, catalogueSize } from './catalogue.js';
