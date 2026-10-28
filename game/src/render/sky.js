/**
 * render/sky.js — the retro sky: a palette gradient dome and chunky voxel
 * clouds, both built as geometry.
 *
 * OWNERSHIP: TEC. Imports only `three` and `core/config.js`.
 *
 * ART-SOURCE HONESTY (read before changing anything here):
 *   The library packs used by this build (KayKit City Builder Bits, Holokat
 *   Game Assets, Avramania Nature & Terrain, KayKit Adventurers) contain NO
 *   sky or cloud art. We grepped the manifest: of the 128 model keys and 6
 *   character keys the only match for /sky|cloud|audio|sound|ambient|music/
 *   is `transit_train` (a train). The 3D packs contain no image files at all.
 *   The library's 2D catalogue does list a separate CC0 "FPS Buildings &
 *   Environment Kit" tagged with a `skyboxes` category, but that pack is not
 *   in `src/data/manifest.json` and the manifest is the only permitted art
 *   source for this build, so the sky and clouds are GENERATED GEOMETRY built
 *   from `config.PALETTE`. Nothing here references a downloadable file.
 *
 * Day/night (FR-TEC-041/042/043/044): one clock function produces the sun
 * direction, the sun colour, the ambient term, the sky gradient and the fog
 * colour, so the whole frame can never disagree about the time of day.
 */

import * as THREE from 'three';
import { PALETTE } from '../core/config.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Radius of the sky dome. The camera never leaves the middle 1/5 of it. */
export const SKY_DOME_RADIUS = 900;

/** Distance of the sun light from the camera focus. */
export const SUN_DISTANCE = 160;

/** Height of the lowest cloud slab, in world units. */
export const CLOUD_BASE_Y = 70;

/**
 * Four keyframes — dawn, day, dusk, night — as required by FR-TEC-043.
 * `t` is the fraction of the in-game day: 0 = midnight, 0.25 = 06:00,
 * 0.5 = noon, 0.75 = 18:00.
 *
 * Every colour is a `config.PALETTE` entry, so the sky can never introduce an
 * off-palette colour (FR-TEC-014).
 */
export const SKY_KEYFRAMES = Object.freeze([
  {
    id: 'night', t: 0.0,
    zenith: PALETTE.void, horizon: PALETTE.night, nadir: PALETTE.void,
    sun: PALETTE.slate, ambient: PALETTE.night, fog: PALETTE.night,
    cloud: PALETTE.slate,
    sunIntensity: 0.18, ambientIntensity: 0.30,
  },
  {
    id: 'dawn', t: 0.25,
    zenith: PALETTE.azure, horizon: PALETTE.amber, nadir: PALETTE.void,
    sun: PALETTE.gold, ambient: PALETTE.slate, fog: PALETTE.amber,
    cloud: PALETTE.rose,
    sunIntensity: 1.25, ambientIntensity: 0.55,
  },
  {
    id: 'day', t: 0.5,
    zenith: PALETTE.sky, horizon: PALETTE.mist, nadir: PALETTE.void,
    sun: PALETTE.snow, ambient: PALETTE.sky, fog: PALETTE.mist,
    cloud: PALETTE.snow,
    sunIntensity: 1.90, ambientIntensity: 0.75,
  },
  {
    id: 'dusk', t: 0.75,
    zenith: PALETTE.violet, horizon: PALETTE.ember, nadir: PALETTE.void,
    sun: PALETTE.amber, ambient: PALETTE.slate, fog: PALETTE.ember,
    cloud: PALETTE.violet,
    sunIntensity: 0.95, ambientIntensity: 0.50,
  },
]);

// --------------------------------------------------------------------------
// Pure clock / colour maths (unit-testable)
// --------------------------------------------------------------------------

/** @param {number} a @param {number} b @param {number} t */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Linear RGB interpolation between two 0xRRGGBB colours, per channel.
 * @param {number} a @param {number} b @param {number} t
 * @returns {number} 0xRRGGBB
 */
export function lerpHex(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return (r << 16) | (g << 8) | bl;
}

/** @param {number} x in 0..1 */
export function smoothstep(x) {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
}

/** @param {number} t fraction of the day, wrapped into 0..1 */
export function wrap01(t) {
  if (!Number.isFinite(t)) return 0;
  return ((t % 1) + 1) % 1;
}

/**
 * The single source of truth for "where is the sun".
 *
 * t = 0.25 -> due east on the horizon, 0.5 -> overhead, 0.75 -> due west,
 * t = 0 -> below the horizon (midnight).
 *
 * @param {number} t fraction of the day 0..1
 * @returns {{x:number,y:number,z:number}} unit-ish direction
 */
export function sunDirection(t) {
  const a = (wrap01(t) - 0.25) * Math.PI * 2;
  const x = Math.cos(a);
  const y = Math.sin(a);
  const z = -0.35;
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

/**
 * Interpolate the sky keyframes at time `t`.
 *
 * @param {number} t fraction of the day 0..1
 * @returns {{
 *   id:string, t:number,
 *   zenith:number, horizon:number, nadir:number,
 *   sun:number, ambient:number, fog:number, cloud:number,
 *   sunIntensity:number, ambientIntensity:number,
 *   sunDirection:{x:number,y:number,z:number},
 * }}
 */
export function skyColorsAt(t) {
  const tt = wrap01(t);
  const frames = SKY_KEYFRAMES;
  let i = 0;
  for (let k = 0; k < frames.length; k++) {
    if (frames[k].t <= tt) i = k;
  }
  const a = frames[i];
  const b = frames[(i + 1) % frames.length];
  // Interpolate across the wrap (night -> dawn) without a discontinuity.
  const span = (b.t > a.t ? b.t : b.t + 1) - a.t;
  const local = span <= 0 ? 0 : (((tt - a.t) + 1) % 1) / span;
  const k = smoothstep(Math.min(1, Math.max(0, local)));

  return {
    id: k < 0.5 ? a.id : b.id,
    t: tt,
    zenith: lerpHex(a.zenith, b.zenith, k),
    horizon: lerpHex(a.horizon, b.horizon, k),
    nadir: lerpHex(a.nadir, b.nadir, k),
    sun: lerpHex(a.sun, b.sun, k),
    ambient: lerpHex(a.ambient, b.ambient, k),
    fog: lerpHex(a.fog, b.fog, k),
    cloud: lerpHex(a.cloud, b.cloud, k),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, k),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, k),
    sunDirection: sunDirection(tt),
  };
}

// --------------------------------------------------------------------------
// Geometry
// --------------------------------------------------------------------------

/**
 * Build the cloud geometry: chunky voxel slabs, merged into ONE mesh so the
 * whole sky costs a single draw call.
 *
 * The cloud layout is deterministic (no Math.random) so two runs of the game
 * show the same sky.
 */
function buildCloudGeometry() {
  const boxes = [];
  // A tiny LCG so the layout is stable without pulling in a seeded RNG.
  let seed = 0x5eed;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let c = 0; c < 9; c++) {
    const angle = (c / 9) * Math.PI * 2 + rnd() * 0.4;
    const radius = 220 + rnd() * 300;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    const cy = CLOUD_BASE_Y + rnd() * 90;
    const puffs = 3 + Math.floor(rnd() * 4);

    for (let p = 0; p < puffs; p++) {
      const w = 26 + rnd() * 46;
      const h = 8 + rnd() * 12;
      const d = 20 + rnd() * 38;
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(
        cx + (rnd() - 0.5) * 70,
        cy + (rnd() - 0.5) * 14,
        cz + (rnd() - 0.5) * 70,
      );
      boxes.push(geo);
    }
  }
  const merged = mergeGeometries(boxes, false);
  for (const b of boxes) b.dispose();
  return merged;
}

/**
 * Create the sky: a vertex-coloured gradient dome plus chunky voxel clouds.
 *
 * @param {THREE.Scene} scene
 * @returns {{
 *   group: THREE.Group, dome: THREE.Mesh, clouds: THREE.Mesh,
 *   setTimeOfDay: (t:number)=>void, update: (dt:number, camera?:THREE.Camera)=>void,
 *   syncSun: (focus?:THREE.Vector3)=>void, colors: ()=>object, dispose: ()=>void,
 * }}
 */
export function createSky(scene) {
  const group = new THREE.Group();
  group.name = 'sky';

  // ---- gradient dome -----------------------------------------------------
  const domeGeo = new THREE.SphereGeometry(SKY_DOME_RADIUS, 24, 16);
  const domeColors = new Float32Array(domeGeo.attributes.position.count * 3);
  domeGeo.setAttribute('color', new THREE.BufferAttribute(domeColors, 3));
  const domeMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.name = 'sky-dome';
  dome.renderOrder = -1000;
  dome.frustumCulled = false;
  group.add(dome);

  // Per-vertex normalised height, so recolouring is a pure function of it.
  const pos = domeGeo.attributes.position;
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    heights[i] = pos.getY(i) / SKY_DOME_RADIUS;
  }

  // ---- clouds ------------------------------------------------------------
  const cloudGeo = buildCloudGeometry();
  const cloudMat = new THREE.MeshBasicMaterial({ color: PALETTE.snow, fog: false });
  const clouds = new THREE.Mesh(cloudGeo, cloudMat);
  clouds.name = 'sky-clouds';
  clouds.frustumCulled = false;
  group.add(clouds);

  scene.add(group);

  const state = { t: 0.5, colors: skyColorsAt(0.5), drift: 0 };

  function paintDome(c) {
    const zenith = new THREE.Color(c.zenith);
    const horizon = new THREE.Color(c.horizon);
    const nadir = new THREE.Color(c.nadir);
    const tmp = new THREE.Color();
    for (let i = 0; i < heights.length; i++) {
      const h = heights[i];
      if (h >= 0) tmp.copy(horizon).lerp(zenith, smoothstep(h));
      else tmp.copy(horizon).lerp(nadir, smoothstep(-h));
      domeColors[i * 3] = tmp.r;
      domeColors[i * 3 + 1] = tmp.g;
      domeColors[i * 3 + 2] = tmp.b;
    }
    domeGeo.attributes.color.needsUpdate = true;
  }

  /** Reposition the directional light along the current sun direction. */
  function syncSun(focus) {
    const light = scene.getObjectByName('sun');
    if (!light || !light.isDirectionalLight) return;
    const anchor = focus || light.target?.position;
    if (!anchor) return;
    const d = state.colors.sunDirection;
    light.position.set(
      anchor.x + d.x * SUN_DISTANCE,
      anchor.y + Math.max(0.05, d.y) * SUN_DISTANCE,
      anchor.z + d.z * SUN_DISTANCE,
    );
    light.target?.updateMatrixWorld?.();
  }

  function setTimeOfDay(t) {
    state.t = wrap01(t);
    const c = skyColorsAt(state.t);
    state.colors = c;

    paintDome(c);
    cloudMat.color.set(c.cloud);

    if (scene.background && scene.background.isColor) scene.background.set(c.horizon);
    if (scene.fog && scene.fog.color) scene.fog.color.set(c.fog);

    const sun = scene.getObjectByName('sun');
    if (sun && sun.isDirectionalLight) {
      sun.color.set(c.sun);
      sun.intensity = c.sunIntensity;
    }
    const hemi = scene.getObjectByName('hemi');
    if (hemi && hemi.isHemisphereLight) {
      hemi.color.set(c.ambient);
      hemi.intensity = c.ambientIntensity;
    }
    syncSun();
  }

  function update(dt, camera) {
    state.drift += dt * 1.6;
    clouds.position.x = (state.drift % 600) - 300;
    clouds.position.z = ((state.drift * 0.4) % 600) - 300;
    if (camera) {
      dome.position.set(camera.position.x, 0, camera.position.z);
    }
  }

  function dispose() {
    scene.remove(group);
    domeGeo.dispose();
    domeMat.dispose();
    cloudGeo.dispose();
    cloudMat.dispose();
    if (scene.userData) delete scene.userData.tecSky;
  }

  const service = {
    group, dome, clouds,
    setTimeOfDay, update, syncSun,
    colors: () => state.colors,
    dispose,
  };

  if (scene.userData) scene.userData.tecSky = service;
  setTimeOfDay(state.t);
  return service;
}

/**
 * Module-level entry point: shift the sky (and the sun) of `scene` to time
 * `t` (0..1). Works with or without a sky service registered on the scene.
 *
 * @param {THREE.Scene} scene
 * @param {number} t fraction of the day 0..1
 */
export function setTimeOfDay(scene, t) {
  if (!scene) return;
  const svc = scene.userData?.tecSky;
  if (svc) {
    svc.setTimeOfDay(t);
    return;
  }
  // No sky service: still drive the scene-level colour and the sun light so
  // a caller that only has a scene still gets a coherent time of day.
  const c = skyColorsAt(t);
  if (scene.background && scene.background.isColor) scene.background.set(c.horizon);
  if (scene.fog && scene.fog.color) scene.fog.color.set(c.fog);
  const sun = scene.getObjectByName('sun');
  if (sun && sun.isDirectionalLight) {
    sun.color.set(c.sun);
    sun.intensity = c.sunIntensity;
    const d = c.sunDirection;
    const anchor = sun.target?.position;
    if (anchor) {
      sun.position.set(
        anchor.x + d.x * SUN_DISTANCE,
        anchor.y + Math.max(0.05, d.y) * SUN_DISTANCE,
        anchor.z + d.z * SUN_DISTANCE,
      );
    }
  }
  const hemi = scene.getObjectByName('hemi');
  if (hemi && hemi.isHemisphereLight) {
    hemi.color.set(c.ambient);
    hemi.intensity = c.ambientIntensity;
  }
}
