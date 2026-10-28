/**
 * render/performance.js — frame-time instrumentation, adaptive quality and
 * the instancing / batching helpers that keep the draw-call count sane.
 *
 * OWNERSHIP: TEC. Imports only `three` and `three/examples/jsm/utils/*`.
 *
 * WHY THIS EXISTS (the numbers in the dossier are design decisions, not
 * published figures — see the requirements §4.1 and §7.1):
 *   - 4096 terrain cells plus hundreds of buildings must NOT become
 *     thousands of draw calls (FR-TEC-018/027/028, NFR-TEC-005);
 *   - on the published minimum hardware (GTX 1050 / M1, T13) the build has to
 *     degrade to 30 fps rather than fall below it (NFR-TEC-001/002);
 *   - the simulation tick rate must never change when the renderer slows
 *     down (E16) — so the renderer degrades, the sim does not.
 *
 * Every threshold below is marked `TBD:` because the publisher never
 * published it. They are collected in the final report as proposed
 * `TUNING` additions.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Adaptive-quality thresholds.
 *
 * TBD: none of these are published. They are proposals for `config.TUNING`
 * (see the final report). The two FPS numbers bracket the 60 fps target of
 * NFR-TEC-001 with a dead band, so a frame-rate wobble around the threshold
 * cannot flap the quality level (hysteresis, per §7.1 rule 8).
 */
export const ADAPTIVE_DEFAULTS = Object.freeze({
  /** TBD: below this measured fps the renderer starts shedding quality. */
  fpsLow: 45,
  /** TBD: above this measured fps the renderer may restore quality. */
  fpsHigh: 55,
  /** TBD: seconds below fpsLow before a quality step is dropped. */
  degradeAfter: 3,
  /** TBD: seconds above fpsHigh before a quality step is restored. */
  recoverAfter: 8,
});

/**
 * Quality levels, cheapest last. 0 = full, 2 = the Low tier behaviour.
 * TBD: the render-scale percentages are proposals for `config.TUNING`.
 */
export const QUALITY_LEVELS = Object.freeze([
  Object.freeze({ id: 'high', index: 0, pixelRatioScale: 1.00, shadows: true, postFX: true }),
  Object.freeze({ id: 'medium', index: 1, pixelRatioScale: 0.85, shadows: true, postFX: true }),
  Object.freeze({ id: 'low', index: 2, pixelRatioScale: 0.70, shadows: false, postFX: false }),
]);

// --------------------------------------------------------------------------
// Pure adaptive-quality logic (unit-testable)
// --------------------------------------------------------------------------

/**
 * Decide the next adaptive-quality state. PURE: the previous state is not
 * mutated and the result is a new object.
 *
 * @param {{level:number, belowFor:number, aboveFor:number}} prev
 * @param {{fps:number, dt:number}} sample  `dt` in seconds
 * @param {typeof ADAPTIVE_DEFAULTS} [opts]
 * @returns {{level:number, belowFor:number, aboveFor:number, action:'none'|'degrade'|'upgrade', reason:string}}
 */
export function evaluateAdaptiveQuality(prev, sample, opts = ADAPTIVE_DEFAULTS) {
  const o = { ...ADAPTIVE_DEFAULTS, ...opts };
  const dt = Number.isFinite(sample?.dt) ? Math.max(0, sample.dt) : 0;
  const fps = Number.isFinite(sample?.fps) ? sample.fps : 60;

  const level = clampLevel(prev?.level ?? 0);
  let belowFor = Math.max(0, prev?.belowFor ?? 0);
  let aboveFor = Math.max(0, prev?.aboveFor ?? 0);

  if (fps < o.fpsLow) {
    belowFor += dt;
    aboveFor = 0;
  } else if (fps > o.fpsHigh) {
    aboveFor += dt;
    belowFor = 0;
  } else {
    // Dead band: bleed both timers down so the hysteresis window has to be
    // earned again, but never oscillate on a single slow frame.
    belowFor = Math.max(0, belowFor - dt);
    aboveFor = Math.max(0, aboveFor - dt);
  }

  let action = 'none';
  let reason = '';
  const maxLevel = QUALITY_LEVELS.length - 1;

  if (belowFor >= o.degradeAfter && level < maxLevel) {
    belowFor = 0;
    return { level: level + 1, belowFor, aboveFor, action: 'degrade', reason: `fps ${fps.toFixed(1)} below ${o.fpsLow} for ${o.degradeAfter}s` };
  }
  if (aboveFor >= o.recoverAfter && level > 0) {
    aboveFor = 0;
    return { level: level - 1, belowFor, aboveFor, action: 'upgrade', reason: `fps ${fps.toFixed(1)} above ${o.fpsHigh} for ${o.recoverAfter}s` };
  }
  return { level, belowFor, aboveFor, action, reason };
}

/** @param {number} level */
export function clampLevel(level) {
  const n = Math.floor(Number(level) || 0);
  return Math.min(QUALITY_LEVELS.length - 1, Math.max(0, n));
}

// --------------------------------------------------------------------------
// Performance monitor
// --------------------------------------------------------------------------

/**
 * Sample frame time, draw calls and triangle counts.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {{windowSeconds?:number, history?:number}} [opts]
 */
export function createPerformanceMonitor(renderer, opts = {}) {
  const windowSeconds = opts.windowSeconds ?? 0.5;
  const historyLimit = opts.history ?? 120;

  let acc = 0;
  let frames = 0;
  let fps = 0;
  let frameMs = 0;
  let peakDrawCalls = 0;
  let peakTriangles = 0;
  const history = [];

  function update(dt) {
    const d = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    acc += d;
    frames += 1;
    frameMs = d * 1000;
    if (acc < windowSeconds) return;

    fps = frames / acc;
    acc = 0;
    frames = 0;

    const info = renderer?.info;
    if (info?.render) {
      peakDrawCalls = Math.max(peakDrawCalls, info.render.calls || 0);
      peakTriangles = Math.max(peakTriangles, info.render.triangles || 0);
    }
    history.push(fps);
    if (history.length > historyLimit) history.shift();
  }

  function snapshot() {
    const info = renderer?.info;
    const r = info?.render || {};
    const m = info?.memory || {};
    return {
      fps: Math.round(fps * 10) / 10,
      frameMs: Math.round(frameMs * 100) / 100,
      drawCalls: r.calls || 0,
      triangles: r.triangles || 0,
      points: r.points || 0,
      lines: r.lines || 0,
      geometries: m.geometries || 0,
      textures: m.textures || 0,
      programs: info?.programs?.length || 0,
      peakDrawCalls,
      peakTriangles,
      samples: history.length,
      quality: QUALITY_LEVELS[0].id,
    };
  }

  function reset() {
    acc = 0; frames = 0; fps = 0; frameMs = 0;
    peakDrawCalls = 0; peakTriangles = 0;
    history.length = 0;
  }

  return {
    update,
    snapshot,
    reset,
    get fps() { return fps; },
    history,
  };
}

// --------------------------------------------------------------------------
// Shadows
// --------------------------------------------------------------------------

/**
 * Toggle shadow casting and force the affected materials to recompile.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene|null} scene
 * @param {boolean} enabled
 */
export function setShadowsEnabled(renderer, scene, enabled) {
  if (!renderer) return;
  const on = !!enabled;
  if (renderer.shadowMap.enabled === on) return;
  renderer.shadowMap.enabled = on;
  renderer.shadowMap.needsUpdate = true;
  scene?.traverse((o) => {
    if (!o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) m.needsUpdate = true;
  });
}

// --------------------------------------------------------------------------
// Instancing
// --------------------------------------------------------------------------

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Compose an instance matrix from a position / Y rotation / uniform scale.
 * Exported separately so the maths can be unit-tested without a GL context.
 *
 * @param {THREE.Matrix4} out
 * @param {{x?:number,y?:number,z?:number,rotY?:number,scale?:number}} t
 * @returns {THREE.Matrix4} `out`
 */
export function composeInstanceMatrix(out, t = {}) {
  const s = t.scale === undefined ? 1 : t.scale;
  _p.set(t.x || 0, t.y || 0, t.z || 0);
  _q.setFromAxisAngle(_up, t.rotY || 0);
  _s.set(s, s, s);
  return out.compose(_p, _q, _s);
}

/**
 * Build a real `THREE.InstancedMesh` (or a group of them) from a source model.
 *
 * A library model is often made of SEVERAL meshes — every `citybits` car, most
 * `props` buildings, the `citizens` and `creatures` families. The old
 * implementation took the FIRST mesh it found and threw the rest away, so
 * every multi-part prop lost its body, wheels, windows and roof.
 *
 * This builds one `InstancedMesh` per source mesh and returns them together:
 *   - a single-mesh model returns the `InstancedMesh` itself (unchanged API),
 *   - a multi-mesh model returns a `THREE.Group` of them.
 *
 * Each part's transform WITHIN the model is baked into its geometry, so the
 * parts keep their relative offsets. The model's own root transform (the
 * per-family scale and the ground offset applied by `render/assets.js`) is
 * deliberately NOT baked — the per-instance transform carries that.
 *
 * The result carries `setInstance(index, transform)` and `setInstances(list)`
 * helpers. Both write the SAME transform to every part, and both flag the
 * instance matrices for upload.
 *
 * @param {THREE.Object3D} model source object (a mesh or a group containing one)
 * @param {number} count number of instances
 * @returns {THREE.InstancedMesh|THREE.Group}
 */
export function makeInstanced(model, count) {
  const n = Math.max(1, Math.floor(count) || 1);
  const parts = modelInstanceParts(model);
  if (!parts.length) throw new Error('makeInstanced: the model contains no mesh');

  const meshes = parts.map((part) => {
    const im = new THREE.InstancedMesh(part.geometry, part.material, n);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    im.name = `${model?.name || 'model'}-instanced`;
    return im;
  });

  /**
   * Write one instance transform to EVERY part.
   * @param {number} i @param {object} t
   */
  const setInstance = (i, t = {}) => {
    if (i < 0 || i >= n) return false;
    composeInstanceMatrix(_m4, t);
    for (const im of meshes) {
      im.setMatrixAt(i, _m4);
      im.instanceMatrix.needsUpdate = true;
    }
    return true;
  };

  /** @param {Array<object>} list */
  const setInstances = (list = []) => {
    list.forEach((t, i) => { if (i < n) setInstance(i, t); });
    for (const im of meshes) im.instanceMatrix.needsUpdate = true;
    return result;
  };

  // A single-mesh model keeps the old bare-`InstancedMesh` API; a multi-mesh
  // model becomes a group of parts that shares ONE instance transform.
  let result;
  if (meshes.length === 1) {
    result = meshes[0];
  } else {
    const group = new THREE.Group();
    group.name = `${model?.name || 'model'}-instanced`;
    for (const im of meshes) group.add(im);
    /** The parts, for callers that need to reach the raw InstancedMeshes. */
    group.parts = meshes;
    result = group;
  }

  result.setInstance = setInstance;
  result.setInstances = setInstances;
  return result;
}

/**
 * Collect the instanced parts of a source model.
 *
 * A part is one (geometry, material) pair. Each mesh's transform within the
 * model is baked into a CLONE of its geometry — the clone matters, because
 * baking into the cached model's geometry would corrupt it for every later
 * user of that model.
 *
 * @param {THREE.Object3D} model
 * @returns {Array<{geometry:THREE.BufferGeometry, material:THREE.Material}>}
 */
export function modelInstanceParts(model) {
  const parts = [];
  if (!model) return parts;

  model.updateMatrixWorld?.(true);
  // The mesh's transform within the MODEL, i.e. with the root's own scale
  // and ground offset removed: inverse(root world) * (mesh world).
  const invRoot = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const local = new THREE.Matrix4();

  model.traverse?.((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (!o.geometry || !o.material) return;
    if (o.userData?.noInstance) return;

    local.multiplyMatrices(invRoot, o.matrixWorld);
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    for (const material of materials) {
      const geometry = o.geometry.clone();
      geometry.applyMatrix4(local);
      // The clone belongs to this batch: `InstancedMesh.dispose()` frees the
      // instance buffers but NOT the geometry, so the batch has to free its
      // own copy or it leaks. The marker is what makes that safe — the
      // CACHED model's geometry is shared and must never be disposed here.
      geometry.userData.scBatchOwned = true;
      parts.push({ geometry, material });
    }
  });
  return parts;
}

/**
 * The `InstancedMesh`es behind an instanced batch.
 *
 * A batch is EITHER a bare `THREE.InstancedMesh` (a single-mesh model) or a
 * `THREE.Group` of them (a multi-mesh model). Callers that need to touch the
 * buffers must not assume which one they have.
 *
 * @param {THREE.InstancedMesh|THREE.Group} batch
 * @returns {THREE.InstancedMesh[]}
 */
export function instancedParts(batch) {
  if (!batch) return [];
  if (Array.isArray(batch.parts) && batch.parts.length) return batch.parts;
  if (batch.isInstancedMesh) return [batch];
  return [];
}

/**
 * Set how many instances of a batch are LIVE.
 *
 * The instances past `n` keep their matrices but are not drawn, so a removal
 * never disturbs the instances around it.
 *
 * @param {THREE.InstancedMesh|THREE.Group} batch
 * @param {number} n the number of live instances
 * @returns {number} `n`
 */
export function setInstanceCount(batch, n) {
  const count = Math.max(0, Math.floor(n) || 0);
  for (const im of instancedParts(batch)) {
    im.count = count;
    im.instanceMatrix.needsUpdate = true;
  }
  return count;
}

/**
 * Remove a batch from the scene and release its GPU buffers.
 *
 * @param {THREE.InstancedMesh|THREE.Group} batch
 */
export function disposeInstancedBatch(batch) {
  if (!batch) return;
  // Three shapes reach this helper:
  //   1. a building batch API object — `{ group, parts }` (the group's own
  //      `parts` getter is what the scene holds);
  //   2. a bare `InstancedMesh` (a single-mesh scatter group);
  //   3. a `Group` of parts (a multi-mesh scatter group).
  const group = batch.group ?? null;
  const parts = group
    ? (Array.isArray(batch.parts) ? batch.parts : [])
    : instancedParts(batch);
  for (const im of parts) {
    im.parent?.remove(im);
    im.dispose();
    // Only the geometry this batch cloned is freed here.
    if (im.geometry?.userData?.scBatchOwned) im.geometry.dispose();
  }
  if (group) {
    // The building batch's GROUP is what was added to the scene.
    group.parent?.remove(group);
    return;
  }
  // A multi-mesh group is a Group: taking the parts out is not enough, the
  // empty group itself must leave the scene too.
  if (!batch.isInstancedMesh) batch.parent?.remove(batch);
}

/**
 * A growable instanced batch for ONE source model.
 *
 * A city puts many copies of the same library model on the map. Every copy
 * used to be its own `Object3D`, so N copies cost N draw calls. A batch draws
 * N copies with one draw call per model PART.
 *
 * The batch only ever GROWS: a bigger set of `InstancedMesh`es is allocated
 * and the matrices are copied across, so the slot index of a building that is
 * already on the map never changes.
 *
 * @param {THREE.Object3D} model the source model
 * @param {number} [capacity] the initial number of slots
 * @returns {object} the batch API
 */
export function makeInstancedBatch(model, capacity = 8) {
  const parts = modelInstanceParts(model);
  if (!parts.length) throw new Error('makeInstancedBatch: the model contains no mesh');

  let cap = Math.max(1, Math.floor(capacity) || 1);
  let meshes = [];
  const group = new THREE.Group();
  group.name = `${model?.name || 'model'}-batch`;
  /** The `InstancedMesh`es — one per model part. */
  Object.defineProperty(group, 'parts', { get: () => meshes });
  const _copy = new THREE.Matrix4();

  function build(nextCap) {
    const next = parts.map((part, idx) => {
      const im = new THREE.InstancedMesh(part.geometry, part.material, nextCap);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.name = `${model?.name || 'model'}-instanced`;
      const old = meshes[idx];
      if (old) {
        for (let i = 0; i < old.count; i += 1) {
          old.getMatrixAt(i, _copy);
          im.setMatrixAt(i, _copy);
        }
      }
      im.instanceMatrix.needsUpdate = true;
      return im;
    });
    for (const im of meshes) {
      im.parent?.remove(im);
      im.dispose();
    }
    meshes = next;
    cap = nextCap;
    for (const im of meshes) group.add(im);
  }

  build(cap);

  const api = {
    /** The group to add to the scene. */
    group,
    /** The `InstancedMesh`es — one per model part. */
    get parts() { return meshes; },
    /** How many slots the batch can hold. */
    get capacity() { return cap; },

    /**
     * Write one instance transform to every part.
     * @param {number} i the slot
     * @param {object} t {x, y, z, rotY, scale}
     */
    setInstance(i, t = {}) {
      if (i < 0) return false;
      if (i >= cap) api.grow(i + 1);
      composeInstanceMatrix(_m4, t);
      for (const im of meshes) {
        im.setMatrixAt(i, _m4);
        im.instanceMatrix.needsUpdate = true;
      }
      return true;
    },

    /**
     * Hide a slot, so a removed building disappears without disturbing the
     * slots around it.
     * @param {number} i the slot
     */
    clearInstance(i) {
      if (i < 0 || i >= cap) return false;
      _m4.makeScale(0, 0, 0);
      for (const im of meshes) {
        im.setMatrixAt(i, _m4);
        im.instanceMatrix.needsUpdate = true;
      }
      return true;
    },

    /**
     * Make room for at least `needed` slots.
     * @param {number} needed
     * @returns {number} the new capacity
     */
    grow(needed) {
      let next = cap;
      while (next < needed) next *= 2;
      if (next > cap) build(next);
      return cap;
    },
  };
  return api;
}


/**
 * Walk a scene and collapse groups of identical meshes into InstancedMeshes.
 *
 * Two meshes are "identical" when they share a parent, a geometry and a
 * material. Skinned meshes and existing instanced meshes are never touched.
 *
 * @param {THREE.Scene|THREE.Object3D} scene
 * @param {{minGroupSize?:number}} [opts]
 * @returns {{groups:number, converted:number, instances:number, savedDrawCalls:number}}
 */
export function enableInstancing(scene, opts = {}) {
  const minGroupSize = Math.max(2, opts.minGroupSize ?? 3);
  const groups = new Map();

  scene?.traverse?.((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) return;
    if (o.userData?.noInstance || o.userData?.merged) return;
    if (!o.geometry || !o.material) return;
    const matKey = Array.isArray(o.material)
      ? o.material.map((m) => m.uuid).join(',')
      : o.material.uuid;
    const key = `${o.parent?.uuid ?? 'root'}|${o.geometry.uuid}|${matKey}`;
    if (!groups.has(key)) {
      groups.set(key, { parent: o.parent, geometry: o.geometry, material: o.material, meshes: [] });
    }
    groups.get(key).meshes.push(o);
  });

  let converted = 0;
  let instances = 0;
  const inv = new THREE.Matrix4();

  for (const g of groups.values()) {
    if (g.meshes.length < minGroupSize) continue;
    if (!g.parent) continue;   // an orphan mesh has nowhere to live
    const im = new THREE.InstancedMesh(g.geometry, g.material, g.meshes.length);
    im.name = `${g.meshes[0].name || 'mesh'}-instanced`;
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;

    if (g.parent) g.parent.updateWorldMatrix(true, false);
    inv.copy(g.parent?.matrixWorld ?? _m4.identity()).invert();

    g.meshes.forEach((mesh, i) => {
      mesh.updateWorldMatrix(true, false);
      composeInstanceMatrix(_m4, {});
      _m4.copy(mesh.matrixWorld).premultiply(inv);
      im.setMatrixAt(i, _m4);
    });
    im.instanceMatrix.needsUpdate = true;

    g.parent?.add(im);
    for (const mesh of g.meshes) mesh.parent?.remove(mesh);
    converted += 1;
    instances += g.meshes.length;
  }

  return {
    groups: groups.size,
    converted,
    instances,
    savedDrawCalls: Math.max(0, instances - converted),
  };
}

/**
 * Merge the static meshes of a group into one mesh per material.
 *
 * Only position / normal / uv are carried over, because `mergeGeometries`
 * refuses geometries whose attribute sets differ.
 *
 * @param {THREE.Object3D} group
 * @returns {{merged:number, removed:number, drawCallsBefore:number, drawCallsAfter:number}}
 */
export function mergeStaticMeshes(group) {
  const empty = { merged: 0, removed: 0, drawCallsBefore: 0, drawCallsAfter: 0 };
  if (!group) return empty;

  const originals = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    if (o.userData?.merged) return;
    if (!o.geometry?.attributes?.position) return;
    originals.push(o);
  });
  if (!originals.length) return empty;

  group.updateWorldMatrix(true, true);
  const toLocal = new THREE.Matrix4().copy(group.matrixWorld).invert();

  const buckets = new Map();
  for (const mesh of originals) {
    const matKey = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.uuid).join(',')
      : mesh.material.uuid;
    if (!buckets.has(matKey)) buckets.set(matKey, { material: mesh.material, geos: [] });

    const g = mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const count = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    mesh.updateWorldMatrix(true, false);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld));
    buckets.get(matKey).geos.push(g);
  }

  let merged = 0;
  for (const bucket of buckets.values()) {
    let geo = null;
    try {
      geo = mergeGeometries(bucket.geos, false);
    } catch {
      geo = null;
    }
    for (const g of bucket.geos) g.dispose();
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, bucket.material);
    mesh.name = `${group.name || 'group'}-merged`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.merged = true;
    group.add(mesh);
    merged += 1;
  }

  for (const mesh of originals) mesh.parent?.remove(mesh);

  return {
    merged,
    removed: originals.length,
    drawCallsBefore: originals.length,
    drawCallsAfter: merged,
  };
}

// --------------------------------------------------------------------------
// Adaptive quality driver
// --------------------------------------------------------------------------

/**
 * Watch the measured frame rate and shed / restore quality.
 *
 * The driver never touches the simulation: it only changes the render
 * resolution, the shadow map and the post chain (E16, FR-TEC-103).
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {{
 *   monitor?: ReturnType<typeof createPerformanceMonitor>,
 *   onApply?: (q:object, level:number)=>void,
 *   enabled?: boolean,
 *   fpsLow?:number, fpsHigh?:number, degradeAfter?:number, recoverAfter?:number,
 * }} [opts]
 */
export function createAdaptiveQuality(renderer, scene, camera, opts = {}) {
  const thresholds = {
    fpsLow: opts.fpsLow ?? ADAPTIVE_DEFAULTS.fpsLow,
    fpsHigh: opts.fpsHigh ?? ADAPTIVE_DEFAULTS.fpsHigh,
    degradeAfter: opts.degradeAfter ?? ADAPTIVE_DEFAULTS.degradeAfter,
    recoverAfter: opts.recoverAfter ?? ADAPTIVE_DEFAULTS.recoverAfter,
  };
  const monitor = opts.monitor || createPerformanceMonitor(renderer);
  // When the caller supplies a monitor it owns the sampling; updating it
  // here as well would double-count every frame.
  const ownsMonitor = !opts.monitor;
  const basePixelRatio = renderer?.getPixelRatio?.() ?? 1;

  let state = { level: clampLevel(opts.startLevel ?? 0), belowFor: 0, aboveFor: 0 };
  let enabled = opts.enabled !== false;
  let lastAction = 'none';

  function apply(level) {
    const q = QUALITY_LEVELS[clampLevel(level)];
    if (renderer) {
      const target = Math.max(0.5, basePixelRatio * q.pixelRatioScale);
      if (Math.abs((renderer.getPixelRatio?.() ?? 1) - target) > 0.001) {
        renderer.setPixelRatio(target);
        renderer.setSize?.(
          renderer.domElement?.clientWidth || globalThis.window?.innerWidth || 960,
          renderer.domElement?.clientHeight || globalThis.window?.innerHeight || 600,
          false,
        );
      }
      setShadowsEnabled(renderer, scene, q.shadows);
    }
    opts.onApply?.(q, q.index);
  }

  function update(dt) {
    if (ownsMonitor) monitor.update(dt);
    if (!enabled) return;
    const next = evaluateAdaptiveQuality(state, { fps: monitor.fps, dt }, thresholds);
    state = { level: next.level, belowFor: next.belowFor, aboveFor: next.aboveFor };
    if (next.action !== 'none') {
      lastAction = next.action;
      apply(next.level);
    }
  }

  apply(state.level);

  return {
    update,
    monitor,
    setEnabled(b) { enabled = !!b; },
    isEnabled() { return enabled; },
    setLevel(level) { state.level = clampLevel(level); apply(state.level); },
    state() {
      return {
        ...state,
        action: lastAction,
        quality: QUALITY_LEVELS[state.level],
        fps: monitor.fps,
        snapshot: monitor.snapshot(),
      };
    },
    dispose() {
      enabled = false;
    },
  };
}
