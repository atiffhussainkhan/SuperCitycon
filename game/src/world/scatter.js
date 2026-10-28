/**
 * world/scatter.js — deterministic placement of library nature models.
 *
 * OWNERSHIP: WLD (world domain).
 *
 * ART RULE: every decorative object is a REAL key from `data/manifest.json`
 * (family `nature`, plus the `citybits` props `bush`, `bench`, `watertower`).
 * Nothing here invents a model key; `placeNature` validates against the
 * manifest and refuses unknown keys (FR-WLD-098).
 *
 * DRAW CALLS (D-06): the scattered props are BATCHED. All props that share a
 * model key are drawn by ONE `THREE.InstancedMesh`, so the whole scatter
 * layer costs one draw call per distinct model instead of one per prop.
 * The helper that builds the instanced mesh lives in `render/performance.js`
 * (read-only for this domain).
 *
 * CLEARING (D-01): decorative scatter NEVER blocks construction. Building on
 * a cell clears the scenery on that cell - the 3D object goes away AND the
 * entry leaves `state.world.scenery`. `clearSceneryAt()` is that primitive;
 * the buildings domain calls it (no circular import: this module knows
 * nothing about buildings).
 */

import { GRID, makeRng } from '../core/config.js';
import {
  disposeInstancedBatch, instancedParts, makeInstanced, setInstanceCount,
} from '../render/performance.js';
import {
  TERRAIN_TYPES,
  WLD_TUNING,
  generateTypeMap,
  seaLevelFor,
  sizeOf,
  slopeAt,
  startingDistrict,
} from './heightfield.js';

/**
 * The nature models this domain is allowed to place, by role.
 * Every key below exists in `data/manifest.json` (family `nature`).
 */
export const NATURE_ROLES = Object.freeze({
  trees: ['mdvl_nature_oak_01', 'mdvl_nature_pine_01', 'mdvl_nature_birch_01'],
  deadTrees: ['mdvl_nature_deadtree_01'],
  saplings: ['mdvl_nature_oak_sapling_01', 'mdvl_nature_pine_sapling_01'],
  stump: ['mdvl_nature_stump_01'],
  bushes: ['mdvl_nature_bush_01'],
  grass: ['mdvl_nature_grass_01'],
  flowers: ['mdvl_nature_flowers_01'],
  mushrooms: ['mdvl_nature_mushrooms_01'],
  ferns: ['mdvl_nature_fern_01'],
  ivy: ['mdvl_nature_ivy_01'],
  rocks: ['mdvl_nature_rocks_01'],
  boulders: ['mdvl_nature_boulder_01'],
  mossyRocks: ['mdvl_nature_rock_mossy_01'],
  pebbles: ['mdvl_nature_pebbles_01'],
  cliffs: ['mdvl_nature_cliff_01', 'mdvl_nature_cliff_02', 'mdvl_nature_cliff_03'],
  cliffCorner: ['mdvl_nature_cliff_corner_01'],
  riverbed: ['mdvl_nature_riverbed_01'],
  streamrock: ['mdvl_nature_streamrock_01'],
  bank: ['mdvl_nature_bank_01'],
  lilypad: ['mdvl_nature_lilypad_01'],
  kerb: ['mdvl_nature_kerb_01'],
  bridgePlank: ['mdvl_nature_bridge_plank_01'],
  paths: ['mdvl_nature_path_dirt_01', 'mdvl_nature_path_corner_01', 'mdvl_nature_path_end_01'],
  paving: ['mdvl_nature_paving_01'],
  cobble: ['mdvl_nature_cobble_01'],
  slab: ['mdvl_nature_slab_01'],
  steps: ['mdvl_nature_steps_dirt_01'],
  steppingstones: ['mdvl_nature_steppingstones_01'],
  mound: ['mdvl_nature_mound_01'],
  walkway: ['mdvl_nature_walkway_01'],
  worn: ['mdvl_nature_worn_01'],
  log: ['mdvl_nature_log_01'],
  ruts: ['mdvl_nature_ruts_01'],
  cave: ['mdvl_nature_cave_01'],
});

/** Flat list of every key this module may place. */
export const NATURE_KEYS = Object.freeze(
  [...new Set(Object.values(NATURE_ROLES).flat())].sort(),
);

/** `citybits` props that may stand in for nature pieces. */
export const CITYBIT_NATURE_KEYS = Object.freeze(['bush', 'bench', 'watertower']);

/** True when a manifest key is one this domain may place. */
export function isPlaceableNatureKey(key, manifest = null) {
  if (NATURE_KEYS.includes(key)) return true;
  if (CITYBIT_NATURE_KEYS.includes(key)) return true;
  if (manifest?.models?.[key]) {
    const fam = manifest.models[key].family;
    return fam === 'nature' || (fam === 'citybits' && CITYBIT_NATURE_KEYS.includes(key));
  }
  return false;
}

/** True when the key exists in the manifest at all. */
export function manifestHas(manifest, key) {
  return Boolean(manifest?.models?.[key]);
}

// --------------------------------------------------------------------------
// Pure placement plan
// --------------------------------------------------------------------------

/**
 * Decide what goes where, without touching the renderer.
 *
 * The props inside the starting district are THINNED, not removed: the
 * player still finds trees and bushes there, but the first minutes of play
 * are not a hunt for a free cell (see `world/index.js`).
 *
 * @param {Float32Array} hf
 * @param {number} seed
 * @param {{size?:number}} [opts]
 * @returns {Array<{model:string, cx:number, cz:number, rot:number, scale:number}>}
 */
export function planScatter(hf, seed = 0, opts = {}) {
  const size = opts.size ?? sizeOf(hf) ?? GRID.size;
  const rng = makeRng((seed >>> 0) ^ 0x5ca77e);
  const level = seaLevelFor(hf);
  const types = generateTypeMap(hf, size, level);

  // The starting district: its scenery is thinned so the player can build.
  const district = startingDistrict(hf, size);
  const keep = WLD_TUNING.startDistrictSceneryKeep;
  const inDistrict = (cx, cz) => Boolean(district)
    && Math.abs(cx - district.cx) <= district.radius
    && Math.abs(cz - district.cz) <= district.radius;

  const out = [];
  /** cells that already hold a tree (spacing enforced) */
  const trees = new Set();
  /** cells that already hold any prop */
  const used = new Set();

  const treeSpacing = WLD_TUNING.treeSpacing;
  const hasTreeNeighbour = (cx, cz) => {
    for (let dz = -(treeSpacing - 1); dz <= treeSpacing - 1; dz += 1) {
      for (let dx = -(treeSpacing - 1); dx <= treeSpacing - 1; dx += 1) {
        if (trees.has((cz + dz) * size + (cx + dx))) return true;
      }
    }
    return false;
  };
  const isFree = (cx, cz) => !used.has(cz * size + cx);
  const claim = (cx, cz) => used.add(cz * size + cx);

  const quarter = () => Math.floor(rng() * 4) * (Math.PI / 2);
  const jitter = () => 0.92 + rng() * 0.22;

  const push = (model, cx, cz, rot, scale) => {
    out.push({ model, cx, cz, rot, scale });
    claim(cx, cz);
  };

  for (let cz = 0; cz < size; cz += 1) {
    for (let cx = 0; cx < size; cx += 1) {
      const idx = cz * size + cx;
      const h = hf[idx];
      const type = TERRAIN_TYPES[types[idx]] ?? 'grass';
      const r = rng();
      // Inside the starting district every prop threshold is scaled down, so
      // only a fraction of the props survive there.
      const t = inDistrict(cx, cz) ? r * keep : r;

      // --- water -------------------------------------------------------
      if (type === 'water') {
        const depth = level - h;
        if (depth > 0 && depth < 0.6 && r < 0.08) {
          push('mdvl_nature_lilypad_01', cx, cz, quarter(), jitter());
        } else if (depth > 0 && depth < 0.9 && r < 0.10) {
          push('mdvl_nature_streamrock_01', cx, cz, quarter(), jitter());
        }
        continue;
      }

      // --- shoreline props (land cell next to water) --------------------
      const touchesWater =
        (cx > 0 && types[idx - 1] === 0) ||
        (cx < size - 1 && types[idx + 1] === 0) ||
        (cz > 0 && types[idx - size] === 0) ||
        (cz < size - 1 && types[idx + size] === 0);

      if (touchesWater && r < 0.14) {
        push('mdvl_nature_bank_01', cx, cz, quarter(), jitter());
        continue;
      }
      if (touchesWater && r < 0.19) {
        push('mdvl_nature_kerb_01', cx, cz, quarter(), jitter());
        continue;
      }

      const slope = slopeAt(hf, cx, cz);

      switch (type) {
        case 'sand': {
          if (t < 0.05) push('mdvl_nature_pebbles_01', cx, cz, quarter(), jitter());
          else if (t < 0.08) push('mdvl_nature_streamrock_01', cx, cz, quarter(), jitter());
          else if (t < 0.07) push('mdvl_nature_grass_01', cx, cz, quarter(), jitter());
          else if (t < 0.09) push('mdvl_nature_cobble_01', cx, cz, quarter(), jitter());
          break;
        }
        case 'grass': {
          if (t < 0.10) push('mdvl_nature_grass_01', cx, cz, quarter(), jitter());
          else if (t < 0.10) push('mdvl_nature_flowers_01', cx, cz, quarter(), jitter());
          else if (t < 0.12) push('mdvl_nature_fern_01', cx, cz, quarter(), jitter());
          else if (t < 0.14) push('mdvl_nature_bush_01', cx, cz, quarter(), jitter());
          else if (t < 0.16) push('mdvl_nature_mushrooms_01', cx, cz, quarter(), jitter());
          else if (t < 0.32 && !hasTreeNeighbour(cx, cz)) {
            const model = NATURE_ROLES.trees[Math.floor(rng() * NATURE_ROLES.trees.length)];
            trees.add(idx);
            push(model, cx, cz, quarter(), jitter());
          } else if (t < 0.28) push('mdvl_nature_oak_sapling_01', cx, cz, quarter(), jitter());
          else if (t < 0.37) push('mdvl_nature_stump_01', cx, cz, quarter(), jitter());
          else if (t < 0.32) push('mdvl_nature_worn_01', cx, cz, quarter(), jitter());
          break;
        }
        case 'forest': {
          if (t < 0.34 && !hasTreeNeighbour(cx, cz)) {
            const model = NATURE_ROLES.trees[Math.floor(rng() * NATURE_ROLES.trees.length)];
            trees.add(idx);
            push(model, cx, cz, quarter(), jitter());
          } else if (t < 0.32) push('mdvl_nature_fern_01', cx, cz, quarter(), jitter());
          else if (t < 0.35) push('mdvl_nature_bush_01', cx, cz, quarter(), jitter());
          else if (t < 0.37) push('mdvl_nature_flowers_01', cx, cz, quarter(), jitter());
          else if (t < 0.39) push('mdvl_nature_mushrooms_01', cx, cz, quarter(), jitter());
          else if (t < 0.41) push('mdvl_nature_log_01', cx, cz, quarter(), jitter());
          else if (t < 0.43) push('mdvl_nature_ivy_01', cx, cz, quarter(), jitter());
          break;
        }
        case 'rock': {
          if (slope > WLD_TUNING.maxBuildSlope && r < 0.45) {
            const model = NATURE_ROLES.cliffs[Math.floor(rng() * NATURE_ROLES.cliffs.length)];
            if (isFree(cx, cz)) {
              push(model, cx, cz, quarter(), jitter());
            }
          } else if (t < 0.09) push('mdvl_nature_rocks_01', cx, cz, quarter(), jitter());
          else if (t < 0.13) push('mdvl_nature_boulder_01', cx, cz, quarter(), jitter());
          else if (t < 0.16) push('mdvl_nature_rock_mossy_01', cx, cz, quarter(), jitter());
          else if (t < 0.14) push('mdvl_nature_pebbles_01', cx, cz, quarter(), jitter());
          else if (t < 0.16) push('mdvl_nature_slab_01', cx, cz, quarter(), jitter());
          else if (t < 0.18) push('mdvl_nature_cave_01', cx, cz, quarter(), jitter());
          break;
        }
        case 'dirt': {
          if (t < 0.07) push('mdvl_nature_worn_01', cx, cz, quarter(), jitter());
          else if (t < 0.10) push('mdvl_nature_path_dirt_01', cx, cz, quarter(), jitter());
          else if (t < 0.09) push('mdvl_nature_mushrooms_01', cx, cz, quarter(), jitter());
          else if (t < 0.11) push('mdvl_nature_steps_dirt_01', cx, cz, quarter(), jitter());
          else if (t < 0.13) push('mdvl_nature_log_01', cx, cz, quarter(), jitter());
          else if (t < 0.14) push('mdvl_nature_ruts_01', cx, cz, quarter(), jitter());
          break;
        }
        default:
          break;
      }

      // Steep grass/forest edges also get a cliff face.
      if ((type === 'grass' || type === 'forest') && slope > WLD_TUNING.maxBuildSlope * 1.5
        && rng() < 0.25 && isFree(cx, cz)) {
        const model = NATURE_ROLES.cliffs[Math.floor(rng() * NATURE_ROLES.cliffs.length)];
        push(model, cx, cz, quarter(), jitter());
      }
    }
  }

  // A few man-made nature pieces on flat land (paths, paving, walkways).
  const manMade = ['mdvl_nature_paving_01', 'mdvl_nature_cobble_01', 'mdvl_nature_walkway_01',
    'mdvl_nature_steppingstones_01', 'mdvl_nature_mound_01', 'mdvl_nature_bridge_plank_01'];
  const attempts = Math.floor(size * 2.5);
  for (let i = 0; i < attempts; i += 1) {
    const cx = Math.floor(rng() * size);
    const cz = Math.floor(rng() * size);
    const idx = cz * size + cx;
    const type = TERRAIN_TYPES[types[idx]] ?? 'grass';
    if (type === 'water' || type === 'rock') continue;
    if (!isFree(cx, cz)) continue;
    if (slopeAt(hf, cx, cz) > WLD_TUNING.maxBuildSlope) continue;
    if (rng() > (inDistrict(cx, cz) ? 0.12 * keep : 0.12)) continue;
    const model = manMade[Math.floor(rng() * manMade.length)];
    push(model, cx, cz, quarter(), jitter());
  }

  return out;
}

// --------------------------------------------------------------------------
// Scene integration
// --------------------------------------------------------------------------

/** Live scenery bookkeeping per context (for disposal / removal). */
const scenery = new WeakMap();

function sceneryState(ctx) {
  let s = scenery.get(ctx);
  if (!s) {
    s = { groups: new Map(), singles: [] };
    scenery.set(ctx, s);
  }
  return s;
}

/** The world-space centre of a cell (from core/config.js). */
function cellCenterWorld(ctx, cx, cz) {
  const CELL = ctx?.config?.CELL ?? 4;
  const WORLD = ctx?.config?.WORLD ?? { originX: -128, originZ: -128 };
  return {
    x: WORLD.originX + (cx + 0.5) * CELL,
    z: WORLD.originZ + (cz + 0.5) * CELL,
  };
}

/** The terrain height under a cell (used to sit models on the ground). */
function groundHeight(ctx, cx, cz) {
  const hf = ctx?.state?.world?.heightmap;
  if (!hf) return 0;
  const size = Math.round(Math.sqrt(hf.length));
  const x = Math.min(size - 1, Math.max(0, cx));
  const z = Math.min(size - 1, Math.max(0, cz));
  return hf[z * size + x];
}

/** The transform of one scattered prop, in world space. */
function transformFor(ctx, rec, proto) {
  const manifestRec = ctx?.manifest?.models?.[rec.model];
  const c = cellCenterWorld(ctx, rec.cx, rec.cz);
  const cx = manifestRec?.centerXZ?.[0] ?? 0;
  const cz = manifestRec?.centerXZ?.[1] ?? 0;
  // The asset service already lifted the model by its ground y-offset so
  // that its lowest point sits on y = 0; keep that offset when we put the
  // model on the terrain.
  const yOffset = Number.isFinite(proto?.position?.y) ? proto.position.y : 0;
  return {
    x: c.x - cx,
    y: groundHeight(ctx, rec.cx, rec.cz) + yOffset,
    z: c.z - cz,
    rotY: rec.rot,
    scale: (manifestRec?.scale ?? 1) * rec.scale,
  };
}

/** Load a model prototype, or null when it cannot be loaded. */
async function loadPrototype(ctx, key) {
  const assets = ctx?.assets;
  if (!assets?.loadModel) return null;
  try {
    return await assets.loadModel(key);
  } catch {
    return null;
  }
}

/**
 * Scatter nature models over a heightmap.
 *
 * The props are BATCHED by model key: each key becomes ONE InstancedMesh,
 * so the scatter layer costs one draw call per distinct model (D-06).
 *
 * The result is written into `state.world.scenery` (and the objects are
 * added to `ctx.renderer.world`).
 *
 * @param {object} ctx
 * @param {Float32Array} hf
 * @param {number} seed
 * @returns {Promise<Array<{model:string, cx:number, cz:number, rot:number, scale:number}>>}
 */
export async function scatterNature(ctx, hf, seed = 0, opts = {}) {
  const plan = planScatter(hf, seed, opts);
  const s = sceneryState(ctx);
  const records = [];

  // --- group the plan by model key ---------------------------------------
  const byModel = new Map();
  for (const rec of plan) {
    let g = byModel.get(rec.model);
    if (!g) {
      g = { key: rec.model, recs: [] };
      byModel.set(rec.model, g);
    }
    g.recs.push(rec);
  }

  for (const g of byModel.values()) {
    const proto = await loadPrototype(ctx, g.key);
    let mesh = null;
    if (proto) {
      try {
        mesh = makeInstanced(proto, g.recs.length);
      } catch {
        mesh = null;
      }
    }
    // The group's records ARE the state records, so a removal can find the
    // instance it has to drop.
    const groupRecords = g.recs.map((rec) => {
      const c = cellCenterWorld(ctx, rec.cx, rec.cz);
      return {
        model: rec.model,
        cx: rec.cx,
        cz: rec.cz,
        rot: rec.rot,
        scale: rec.scale,
        x: c.x,
        z: c.z,
        y: groundHeight(ctx, rec.cx, rec.cz),
        placed: Boolean(mesh),
        /** The instanced group this prop belongs to. */
        group: g.key,
        kind: 'instanced',
        /** The world transform of this instance (kept for re-batching). */
        transform: proto ? transformFor(ctx, rec, proto) : null,
      };
    });
    if (mesh) {
      // `setInstances` writes every part of a multi-mesh model and flags the
      // instance matrices for upload. The old code touched
      // `mesh.instanceMatrix` directly, which a multi-part group does not have.
      mesh.setInstances(groupRecords.map((rec) => rec.transform));
      mesh.name = `scatter:${g.key}`;
      mesh.userData.scatterGroup = g.key;
      ctx?.renderer?.world?.add(mesh);
    }
    s.groups.set(g.key, { key: g.key, mesh, records: groupRecords });
    for (const rec of groupRecords) records.push(rec);
  }

  const world = ctx?.state?.world;
  if (world) {
    world.scenery = records;
    world.sceneryCount = records.length;
  }
  return plan;
}

/**
 * Place one specific model on a cell (used by the terraform / nature tools).
 * The key is validated against the manifest — unknown keys are rejected.
 *
 * @returns {Promise<{ok:boolean, reason:string, rec?:object}>}
 */
export async function placeNature(ctx, cx, cz, modelKey) {
  const manifest = ctx?.manifest;
  if (!modelKey || typeof modelKey !== 'string') {
    return { ok: false, reason: 'no model key given' };
  }
  if (!manifestHas(manifest, modelKey)) {
    return { ok: false, reason: `unknown model "${modelKey}"` };
  }
  if (!isPlaceableNatureKey(modelKey, manifest)) {
    return { ok: false, reason: `"${modelKey}" is not a placeable nature model` };
  }
  const size = ctx?.config?.GRID?.size ?? GRID.size;
  if (!Number.isInteger(cx) || !Number.isInteger(cz) || cx < 0 || cz < 0 || cx >= size || cz >= size) {
    return { ok: false, reason: 'cell out of bounds' };
  }
  const hf = ctx?.state?.world?.heightmap;
  if (hf) {
    const level = ctx?.state?.world?.waterLevel ?? 0;
    if (hf[cz * size + cx] < level) {
      return { ok: false, reason: 'cannot place on water' };
    }
  }

  const rec = { model: modelKey, cx, cz, rot: 0, scale: 1 };
  const proto = await loadPrototype(ctx, modelKey);
  if (!proto) return { ok: false, reason: `model "${modelKey}" could not be loaded` };

  const t = transformFor(ctx, rec, proto);
  const obj = proto.clone ? proto.clone(true) : proto;
  obj.position.set(t.x, t.y, t.z);
  obj.rotation.y = rec.rot;
  obj.scale.setScalar(t.scale);
  ctx?.renderer?.world?.add(obj);

  const s = sceneryState(ctx);
  const c = cellCenterWorld(ctx, cx, cz);
  const record = {
    model: modelKey,
    cx,
    cz,
    rot: 0,
    scale: 1,
    x: c.x,
    z: c.z,
    y: groundHeight(ctx, cx, cz),
    placed: true,
    group: null,
    kind: 'single',
  };
  s.singles.push({ record, obj });
  ctx?.state?.world?.scenery?.push(record);
  if (ctx?.state?.world) ctx.state.world.sceneryCount = ctx.state.world.scenery.length;
  return { ok: true, reason: 'placed', rec: record };
}

/**
 * D-01: clear the scenery on a set of cells.
 *
 * Decorative scatter never blocks construction, so building on a cell has to
 * take the scenery away: the 3D object leaves the scene AND the record
 * leaves `state.world.scenery`.
 *
 * @param {object} ctx
 * @param {Array<{x:number,z:number}>} cells
 * @returns {number} how many scenery records were cleared
 */
export function clearSceneryAt(ctx, cells) {
  const list = ctx?.state?.world?.scenery;
  if (!Array.isArray(list) || !list.length) return 0;
  const keys = new Set();
  for (const c of cells ?? []) {
    if (!c || typeof c.x !== 'number' || typeof c.z !== 'number') continue;
    keys.add(`${c.x},${c.z}`);
  }
  if (!keys.size) return 0;

  const doomed = list.filter((rec) => rec && keys.has(`${rec.cx},${rec.cz}`));
  if (!doomed.length) return 0;

  const s = scenery.get(ctx);
  const doomedSet = new Set(doomed);

  // --- the records leave the state --------------------------------------
  const kept = list.filter((rec) => !doomedSet.has(rec));
  ctx.state.world.scenery = kept;
  ctx.state.world.sceneryCount = kept.length;

  // --- the instanced groups are rebuilt without the removed props -------
  const touched = new Set();
  for (const rec of doomed) {
    const g = rec.group ? s?.groups.get(rec.group) : null;
    if (g) touched.add(g);
  }
  for (const g of touched) {
    g.records = g.records.filter((rec) => !doomedSet.has(rec));
    rebuildGroup(g);
  }

  // --- standalone props leave the scene ---------------------------------
  if (s) {
    const gone = new Set(doomed);
    s.singles = s.singles.filter((single) => {
      if (!gone.has(single.record)) return true;
      if (single.obj?.parent) single.obj.parent.remove(single.obj);
      return false;
    });
  }

  return doomed.length;
}

/**
 * Rewrite the instance matrices of one instanced group.
 *
 * The group may hold a bare `InstancedMesh` (a single-mesh model) or a
 * `THREE.Group` of them (a multi-mesh model), so the live count is set
 * through `setInstanceCount`, which handles both.
 */
function rebuildGroup(g) {
  if (!g?.mesh) return;
  const n = g.records.length;
  g.records.forEach((rec, i) => {
    // The prototype transform is baked into the matrix by transformFor(); the
    // group keeps the transform it was created with.
    g.mesh.setInstance(i, rec.transform);
  });
  setInstanceCount(g.mesh, n);
}

/** Remove every scattered object from the scene (used on regeneration). */
export function clearScenery(ctx) {
  const s = scenery.get(ctx);
  if (!s) return;
  for (const g of s.groups.values()) {
    disposeInstancedBatch(g.mesh);
  }
  s.groups.clear();
  for (const single of s.singles) {
    if (single.obj?.parent) single.obj.parent.remove(single.obj);
  }
  s.singles.length = 0;
  const world = ctx?.state?.world;
  if (world) {
    world.scenery = [];
    world.sceneryCount = 0;
  }
}

/**
 * How the scatter layer is batched (for reporting / tests).
 *
 * @returns {{props:number, groups:number, drawCalls:number, meshes:number}}
 */
export function scatterStats(ctx) {
  const s = scenery.get(ctx);
  if (!s) return { props: 0, groups: 0, drawCalls: 0, meshes: 0 };
  const groups = s.groups.size;
  // A multi-mesh model is a GROUP of InstancedMeshes, so the draw calls are
  // the PARTS, not the groups.
  let parts = 0;
  for (const g of s.groups.values()) parts += instancedParts(g.mesh).length;
  return {
    props: ctx?.state?.world?.scenery?.length ?? 0,
    groups,
    meshes: parts,
    /** One draw call per instanced mesh. */
    drawCalls: parts + s.singles.length,
  };
}
