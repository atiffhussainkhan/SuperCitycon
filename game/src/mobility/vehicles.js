/**
 * MOB — the view helper for roads and vehicles.
 *
 * This is the ONLY mobility file that may touch Three.js objects, and it
 * does so through the objects the asset service hands out: it never imports
 * `three` itself, so the module stays importable in a headless Node run.
 *
 * Every model key used here exists in `data/manifest.json`:
 *   citybits/road_straight, road_corner, road_junction, road_tsplit,
 *   road_straight_crossing, trafficlight_A, trafficlight_B, trafficlight_C,
 *   streetlight, car_sedan, car_hatchback, car_taxi, car_police,
 *   car_stationwagon.
 */

import { parseCellKey, roadShapeFor, ROAD_MODELS, ROAD_TYPES } from './network.js';

/** The road models, keyed by the junction shape. */
export const ROAD_MODEL_KEYS = ROAD_MODELS;

/** The traffic-light models, cycled over the junctions. */
export const TRAFFIC_LIGHT_MODEL_KEYS = Object.freeze([
  'trafficlight_A',
  'trafficlight_B',
  'trafficlight_C',
]);

/** The street-light model. */
export const STREET_LIGHT_MODEL_KEY = 'streetlight';

/** The yaw that points a model along a cell direction. */
export function yawFor(dx, dz) {
  if (!dx && !dz) return 0;
  return Math.atan2(dx, dz);
}

/**
 * The road model and rotation for one network cell.
 *
 * TBD: the canonical orientation of the library road models is not published,
 * so the rotation is derived from the geometry — a straight segment faces its
 * neighbour, a corner faces the bisector of its two arms. Proposed TUNING key:
 * `mobility.roadModelRotationOffset` (0) if the art needs a global offset.
 */
export function roadModelFor(network, key, type = ROAD_TYPES.street) {
  const shape = roadShapeFor(network, key, type);
  return {
    model: shape.model,
    rotation: shape.rotation,
    kind: shape.kind,
    shape: shape.shape,
  };
}

/**
 * Create the vehicle fleet.
 *
 * The fleet owns one THREE object per live vehicle; the objects live in
 * `ctx.renderer.actors` so the renderer moves them with the camera.
 *
 * @param {object} ctx the shared game context
 */
export function createFleet(ctx) {
  return {
    ctx,
    /** Static content (the roads) belongs to the world group. */
    staticGroup: ctx?.renderer?.world ?? null,
    /** Moving entities (the cars) belong to the actors group. */
    actorGroup: ctx?.renderer?.actors ?? null,
    prototypes: new Map(),
    actors: new Map(),
    staticActors: new Map(),
    pending: new Map(),
    /**
     * The props the current network wants: tag -> `{ key, rotation }`.
     * A model that finishes loading after its shape changed is dropped
     * instead of replacing the newer one.
     */
    desired: new Map(),
    /** The vehicle ids that are alive right now. */
    alive: new Set(),
    disposed: false,
  };
}

/**
 * Get a fresh clone of a model, loading it the first time it is needed.
 *
 * @returns {Promise<object|null>} a THREE object or null
 */
export async function acquireModel(fleet, key) {
  if (!fleet || !key || fleet.disposed) return null;
  const cached = fleet.prototypes.get(key);
  if (cached) return cached.clone(true);
  const assets = fleet.ctx?.assets;
  if (!assets?.loadModel) return null;
  try {
    const model = await assets.loadModel(key);
    if (!model) return null;
    fleet.prototypes.set(key, model);
    return model.clone(true);
  } catch {
    return null;
  }
}

/**
 * The world-space terrain height of a cell.
 *
 * The WORLD domain owns the terrain and publishes `heightAt(cx, cz)` on its
 * SERVICE (`ctx.domains.wld.heightAt`). The raw height map is the fallback
 * for a headless run. Without a correct height a road or a car is placed at
 * y = 0 and ends up buried under the terrain.
 */
export function groundHeight(ctx, cx, cz) {
  const wld = ctx?.domains?.wld;
  if (typeof wld?.heightAt === 'function') {
    try {
      const value = wld.heightAt(cx, cz);
      if (Number.isFinite(value)) return value;
    } catch { /* fall through */ }
  }
  const map = ctx?.state?.world?.heightmap;
  if (map && typeof map.length === 'number') {
    const size = ctx?.config?.GRID?.size ?? 64;
    const x = Math.max(0, Math.min(size - 1, Math.round(num(cx, 0))));
    const z = Math.max(0, Math.min(size - 1, Math.round(num(cz, 0))));
    const value = map[z * size + x];
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** The manifest record of a model key. */
function manifestRecord(ctx, key) {
  return ctx?.assets?.manifest?.models?.[key] ?? ctx?.manifest?.models?.[key] ?? null;
}

/** Rotate a centre offset by the model's yaw (radians). */
export function rotateOffset(offset, yaw) {
  const [a, b] = offset ?? [0, 0];
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [a * cos + b * sin, -a * sin + b * cos];
}

/**
 * Place a static model (a road, a traffic light, a street light).
 *
 * The model is tracked under `tag` so it can be retired again when the road
 * it belongs to is demolished.
 *
 * @returns {null} the placement is asynchronous; the model arrives later
 */
export function placeStaticModel(fleet, tag, key, cx, cz, rotation = 0, y = 0) {
  if (!fleet?.staticGroup) return null;
  acquireModel(fleet, key).then((model) => {
    if (!model || fleet.disposed || !fleet.staticGroup) return;
    // The road may have been demolished while the model was loading.
    const wanted = fleet.desired?.get(tag);
    if (fleet.desired && !wanted) return;
    // The shape may have changed while the model was loading: the newer
    // model owns the cell, this one is stale.
    if (wanted && wanted.key !== key) return;
    const existing = fleet.staticActors.get(tag);
    if (existing) {
      if (existing.parent) existing.parent.remove(existing);
      if (existing.dispose) existing.dispose();
    }
    const renderer = fleet.ctx?.renderer;
    const center = renderer?.cellCenter?.(cx, cz) ?? { x: cx, z: cz };
    // The manifest centre offset is subtracted so the model sits on the cell
    // it belongs to, exactly like the buildings domain does it.
    const record = manifestRecord(fleet.ctx, key);
    const offset = rotateOffset(record?.centerXZ ?? [0, 0], rotation);
    const baseY = Number.isFinite(model.position.y) ? model.position.y : 0;
    model.position.set(center.x - offset[0], baseY + y, center.z - offset[1]);
    model.rotation.y = rotation;
    model.userData.mobilityStatic = key;
    model.userData.mobilityTag = tag;
    fleet.staticGroup.add(model);
    fleet.staticActors.set(tag, model);
  }).catch(() => { /* the art is optional — the city still works */ });
  return null;
}

/** Retire one static model. */
export function removeStaticModel(fleet, tag) {
  const model = fleet?.staticActors?.get(tag);
  if (!model) return false;
  fleet.staticActors.delete(tag);
  if (model.parent) model.parent.remove(model);
  if (model.dispose) model.dispose();
  return true;
}

/**
 * Sync the vehicle meshes with the simulation state.
 *
 * @param {object} fleet from {@link createFleet}
 * @param {object[]} vehicles the simulated vehicles
 * @param {object} network the road graph
 */
export function syncFleet(fleet, vehicles, network) {
  if (!fleet || fleet.disposed) return;
  const list = Array.isArray(vehicles) ? vehicles : [];
  const renderer = fleet.ctx?.renderer;
  const alive = new Set();
  fleet.alive = alive;

  for (const vehicle of list) {
    alive.add(vehicle.id);
    let actor = fleet.actors.get(vehicle.id);

    if (!actor) {
      if (fleet.pending.has(vehicle.id)) continue;
      fleet.pending.set(vehicle.id, true);
      acquireModel(fleet, vehicle.model).then((model) => {
        fleet.pending.delete(vehicle.id);
        if (!model || fleet.disposed || !fleet.actorGroup) return;
        // The vehicle may have reached its destination while the model loaded.
        if (fleet.alive && !fleet.alive.has(vehicle.id)) return;
        model.userData.vehicleId = vehicle.id;
        model.userData.vehicleModel = vehicle.model;
        // The asset service leaves the model's base at its own y offset; the
        // terrain height is added on top so the car sits ON the ground.
        model.userData.baseY = model.position.y;
        fleet.actorGroup.add(model);
        fleet.actors.set(vehicle.id, model);
        positionActor(fleet, model, vehicle);
      }).catch(() => { fleet.pending.delete(vehicle.id); });
      continue;
    }

    positionActor(fleet, actor, vehicle);
  }

  // Retire the vehicles that are gone.
  for (const [id, actor] of fleet.actors) {
    if (alive.has(id)) continue;
    fleet.actors.delete(id);
    if (actor?.parent) actor.parent.remove(actor);
    if (actor?.dispose) actor.dispose();
  }
}

function positionActor(fleet, actor, vehicle) {
  if (!actor) return;
  const renderer = fleet.ctx?.renderer;
  const center = renderer?.cellCenterF?.(vehicle.x, vehicle.z)
    ?? renderer?.cellCenter?.(vehicle.x, vehicle.z)
    ?? { x: vehicle.x, z: vehicle.z };
  actor.position.x = center.x;
  actor.position.z = center.z;
  const baseY = Number.isFinite(actor.userData?.baseY) ? actor.userData.baseY : actor.position.y;
  actor.position.y = baseY + groundHeight(fleet.ctx, Math.round(vehicle.x), Math.round(vehicle.z));

  const from = parseCellKey(vehicle.cell);
  const to = vehicle.path?.length ? parseCellKey(vehicle.path[0]) : null;
  if (from && to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if (dx || dz) {
      actor.rotation.y = yawFor(dx, dz);
      // The manifest centre offset is subtracted, so the car sits on the
      // lane it drives in.
      const record = manifestRecord(fleet.ctx, vehicle.model);
      const offset = rotateOffset(record?.centerXZ ?? [0, 0], actor.rotation.y);
      actor.position.x = center.x - offset[0];
      actor.position.z = center.z - offset[1];
    }
  }
}

/** Release every mesh the fleet owns. */
export function disposeFleet(fleet) {
  if (!fleet) return;
  fleet.disposed = true;
  for (const actor of fleet.actors.values()) {
    if (actor?.parent) actor.parent.remove(actor);
    if (actor?.dispose) actor.dispose();
  }
  for (const model of fleet.staticActors.values()) {
    if (model?.parent) model.parent.remove(model);
    if (model?.dispose) model.dispose();
  }
  fleet.actors.clear();
  fleet.staticActors.clear();
  fleet.prototypes.clear();
  fleet.pending.clear();
}
