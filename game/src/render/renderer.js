/**
 * render/renderer.js — the Three.js view layer.
 *
 * SPINE VERSION — the integrator wrote this so the project boots and can be
 * verified in a browser before the ten domain agents land.
 *
 * OWNERSHIP: the TEC (presentation / technical) agent owns this file from
 * now on. It MAY extend or reimplement the internals, but MUST keep the
 * exported API and its behaviour exactly as documented in
 * src/core/CONTRACT.md, because UX, WLD, MOB, POP and BLD all bind to it.
 *
 * WHAT TEC ADDED (everything below is additive; the spine's API is intact):
 *   - a palette sky dome + procedural voxel clouds (render/sky.js);
 *   - a day/night cycle driven by ONE clock function (FR-TEC-041/042/043);
 *   - an optional retro post chain (render/postfx.js), loaded with a dynamic
 *     import so a broken post-processing module can never break the game;
 *   - an FPS / draw-call monitor and an adaptive-quality driver
 *     (render/performance.js);
 *   - `pickCell()` for grid picking, and a ResizeObserver-backed `resize()`.
 */

import * as THREE from 'three';
import { CELL, GRID, WORLD, TUNING, worldToCellInt, inBounds } from '../core/config.js';
import { createSky, setTimeOfDay as setSkyTimeOfDay } from './sky.js';
import {
  createPerformanceMonitor, createAdaptiveQuality, setShadowsEnabled as applyShadows,
} from './performance.js';
import { disposeMaterials } from './materials.js';

/**
 * @typedef {Object} RendererService
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {THREE.WebGLRenderer} renderer
 * @property {THREE.Clock} clock
 * @property {THREE.Group} world      — root for world content
 * @property {THREE.Group} actors     — root for moving entities
 * @property {THREE.Group} overlay    — root for ghosts / highlights
 * @property {THREE.Raycaster} raycaster
 * @property {THREE.Plane} groundPlane
 * @property {THREE.DirectionalLight} sun
 * @property {(o:THREE.Object3D)=>void} add
 * @property {(o:THREE.Object3D)=>void} remove
 * @property {()=>void} clearWorld
 * @property {()=>void} resize
 * @property {()=>void} start
 * @property {()=>void} stop
 * @property {(clientX:number,clientY:number)=>{x:number,z:number}|null} screenToGround
 * @property {(clientX:number,clientY:number,objects:THREE.Object3D[])=>object|null} screenToObjects
 * @property {(x:number,z:number)=>void} focusOn
 * @property {(d:number)=>void} setDistance
 * @property {()=>number} getDistance
 * @property {(yaw:number)=>void} setYaw
 * @property {(yaw:number)=>void} rotateYaw
 * @property {()=>number} getYaw
 * @property {(deg:number)=>void} setPitch
 * @property {()=>number} getPitch
 * @property {(dt:number)=>void} update
 * @property {(w:number,h:number)=>void} setViewport
 * @property {(t:number)=>void} setTimeOfDay
 * @property {()=>number} getTimeOfDay
 * @property {(b:boolean)=>void} setShadowsEnabled
 * @property {(b:boolean)=>boolean} setPostFX
 * @property {(clientX:number,clientY:number)=>{x:number,z:number}|null} pickCell
 */

/** The most recently created renderer, for the module-level helpers. */
let activeRenderer = null;

/**
 * Create the renderer service bound to a DOM container.
 * @param {HTMLElement} container
 * @returns {RendererService}
 */
export function createRenderer(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4cc9f0);
  scene.fog = new THREE.Fog(0x4cc9f0, 180, 460);

  const camera = new THREE.PerspectiveCamera(
    42,
    (container.clientWidth || 960) / (container.clientHeight || 600),
    0.5,
    1400,
  );

  // `preserveDrawingBuffer` lets an automated harness read the framebuffer
  // back with `canvas.toDataURL()` / `drawImage`. It costs a little
  // performance, so it is opt-in via `?capture=1` rather than always on.
  const CAPTURE = typeof location !== 'undefined'
    && new URLSearchParams(location.search).has('capture');
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: CAPTURE,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth || 960, container.clientHeight || 600);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const clock = new THREE.Clock();

  // Roots — content is separated so the UI can toggle layers independently.
  const world = new THREE.Group();
  world.name = 'world';
  const actors = new THREE.Group();
  actors.name = 'actors';
  const overlay = new THREE.Group();
  overlay.name = 'overlay';
  scene.add(world, actors, overlay);

  // Lighting
  const hemi = new THREE.HemisphereLight(0xbfe9ff, 0x3f8f4d, 1.05);
  hemi.name = 'hemi';
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.9);
  sun.name = 'sun';
  sun.position.set(80, 120, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 420;
  sun.shadow.camera.left = -140;
  sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140;
  sun.shadow.camera.bottom = -140;
  scene.add(sun, sun.target);

  // The retro sky: a palette gradient dome plus chunky voxel clouds.
  const sky = createSky(scene);

  // Camera rig — orbit around a focus point on the ground plane.
  const focus = new THREE.Vector3(0, 0, 0);
  let distance = TUNING.cameraDistance;
  let yaw = Math.PI / 4;
  let pitch = (TUNING.cameraPitch * Math.PI) / 180;

  function applyCamera() {
    const cp = Math.cos(pitch);
    const x = focus.x + distance * cp * Math.sin(yaw);
    const y = focus.y + distance * Math.sin(pitch);
    const z = focus.z + distance * cp * Math.cos(yaw);
    camera.position.set(x, y, z);
    camera.lookAt(focus);
    // The sun's TARGET follows the focus; its POSITION is owned by the sky
    // (it depends on the time of day).
    sun.target.position.copy(focus);
    sun.target.updateMatrixWorld();
    sky.syncSun(focus);
  }
  applyCamera();

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  // ---- day/night -------------------------------------------------------
  let timeOfDay = 0.5;

  // ---- post processing -------------------------------------------------
  // Loaded with a DYNAMIC import: if `three/examples/jsm/postprocessing/*`
  // or the module itself is broken, the renderer must still work.
  let postfx = null;
  let postfxError = null;
  let postfxPromise = null;
  let postFXEnabled = false;
  let pixelSize = 1;

  function ensurePostFX() {
    if (!postfxPromise) {
      postfxPromise = import('./postfx.js')
        .then((mod) => {
          postfx = mod.createPostFX(renderer, scene, camera);
          postfx.setPixelSize(pixelSize);
          postfx.setEnabled(postFXEnabled);
          return postfx;
        })
        .catch((err) => {
          postfxError = err instanceof Error ? err : new Error(String(err));
          postfx = null;
          return null;
        });
    }
    return postfxPromise;
  }
  ensurePostFX();

  // ---- performance -----------------------------------------------------
  const monitor = createPerformanceMonitor(renderer);
  const adaptive = createAdaptiveQuality(renderer, scene, camera, {
    monitor,
    onApply: (q) => {
      if (postfx) {
        postfx.setEnabled(postFXEnabled && q.postFX);
        // The render scale may have changed: re-fit the chain to the canvas.
        postfx.resize();
      }
    },
  });

  const service = {
    scene,
    camera,
    renderer,
    clock,
    world,
    actors,
    overlay,
    raycaster,
    groundPlane,
    sun,
    focus,
    sky,
    monitor,
    adaptive,

    add(obj) { if (obj) world.add(obj); },
    remove(obj) { if (obj) obj.parent?.remove(obj); },
    clearWorld() {
      for (const child of [...world.children]) world.remove(child);
    },
    resize() {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      postfx?.resize();
    },
    start() {
      if (service._running) return;
      service._running = true;
      const loop = () => {
        if (!service._running) return;
        service.update(clock.getDelta());
      };
      if (typeof renderer.setAnimationLoop === 'function') {
        renderer.setAnimationLoop(loop);
      } else {
        const raf = () => {
          if (!service._running) return;
          service._raf = requestAnimationFrame(raf);
          loop();
        };
        service._raf = requestAnimationFrame(raf);
      }
    },
    stop() {
      service._running = false;
      if (typeof renderer.setAnimationLoop === 'function') renderer.setAnimationLoop(null);
      if (service._raf) cancelAnimationFrame(service._raf);
    },
    /** Screen pixel -> point on the y=0 ground plane (world space). */
    screenToGround(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
      return { x: hit.x, z: hit.z };
    },
    /** Screen pixel -> raycast against arbitrary objects (for picking). */
    screenToObjects(clientX, clientY, objects) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(objects, true);
      return hits.length ? hits[0] : null;
    },
    /**
     * Screen pixel -> the grid cell under the cursor.
     * @returns {{x:number,z:number}|null} null when off the playfield
     */
    pickCell(clientX, clientY) {
      const hit = service.screenToGround(clientX, clientY);
      if (!hit) return null;
      const c = worldToCellInt(hit.x, hit.z);
      if (!inBounds(c.x, c.z)) return null;
      return { x: c.x, z: c.z };
    },
    focusOn(x, z) {
      focus.set(x, 0, z);
      applyCamera();
    },
    setDistance(d) {
      distance = Math.min(TUNING.cameraMaxDistance, Math.max(TUNING.cameraMinDistance, d));
      applyCamera();
    },
    getDistance() { return distance; },
    setYaw(r) { yaw = r; applyCamera(); },
    rotateYaw(delta) { yaw += delta; applyCamera(); },
    getYaw() { return yaw; },
    setPitch(deg) {
      pitch = Math.min(85, Math.max(15, (deg * Math.PI) / 180));
      applyCamera();
    },
    getPitch() { return pitch; },
    /**
     * Set the time of day. `t` is the fraction of the in-game day:
     * 0 = midnight, 0.25 = 06:00, 0.5 = noon, 0.75 = 18:00.
     * One clock function drives the sun, the sky gradient, the ambient term
     * and the fog colour (FR-TEC-042).
     */
    setTimeOfDay(t) {
      timeOfDay = ((Number(t) % 1) + 1) % 1;
      setSkyTimeOfDay(scene, timeOfDay);
      sky.syncSun(focus);
      return timeOfDay;
    },
    getTimeOfDay() { return timeOfDay; },
    /** Toggle shadow casting. */
    setShadowsEnabled(b) {
      applyShadows(renderer, scene, !!b);
      return renderer.shadowMap.enabled;
    },
    getShadowsEnabled() { return !!renderer.shadowMap.enabled; },
    /**
     * Toggle the retro post chain. Safe to call before the chain has loaded:
     * the request is remembered and applied when it arrives.
     */
    setPostFX(enabled) {
      postFXEnabled = !!enabled;
      if (!postfx) ensurePostFX();
      if (postfx) {
        postfx.setPixelSize(pixelSize);
        postfx.setEnabled(postFXEnabled);
      }
      return postFXEnabled;
    },
    getPostFXEnabled() { return postFXEnabled; },
    isPostFXAvailable() { return !!postfx && postfx.available; },
    getPostFXError() { return postfxError; },
    /** Pixel chunk size for the post chain (1 = no downscale). */
    setPixelSize(n) {
      const v = Number(n);
      pixelSize = Number.isFinite(v) ? Math.max(1, Math.floor(v)) : 1;
      postfx?.setPixelSize(pixelSize);
      return pixelSize;
    },
    getPixelSize() { return pixelSize; },
    /** Frame-time / draw-call snapshot for the HUD or the settings panel. */
    getPerformance() { return monitor.snapshot(); },
    update(dt) {
      sky.update(dt, camera);
      monitor.update(dt);
      adaptive.update(dt);
      if (postfx && postfx.enabled) {
        postfx.render(dt);
      } else {
        renderer.render(scene, camera);
      }
    },
    setViewport(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    dispose() {
      service.stop();
      resizeObserver?.disconnect?.();
      window.removeEventListener('resize', onWindowResize);
      postfx?.dispose?.();
      sky.dispose?.();
      disposeMaterials();
      adaptive.dispose?.();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      if (activeRenderer === service) activeRenderer = null;
    },
    _running: false,
    _raf: 0,
  };

  // Observe the container so a resized panel (or a collapsed HUD) reflows the
  // canvas; fall back to the window resize event where ResizeObserver is absent.
  let resizeObserver = null;
  const onWindowResize = () => service.resize();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => service.resize());
    resizeObserver.observe(container);
  } else if (typeof window !== 'undefined') {
    window.addEventListener('resize', onWindowResize);
  }

  service.resize();
  activeRenderer = service;
  return service;
}

/**
 * Toggle the retro post chain on the most recently created renderer.
 * @param {boolean} enabled
 * @returns {boolean} the requested state
 */
export function setPostFX(enabled) {
  if (!activeRenderer) return false;
  return activeRenderer.setPostFX(enabled);
}

/**
 * Set the pixel chunk size on the most recently created renderer.
 * @param {number} n
 */
export function setPixelSize(n) {
  if (!activeRenderer) return 1;
  return activeRenderer.setPixelSize(n);
}

/** Convenience: world-space position of a cell centre, at an optional height. */
export function cellCenter(cx, cz, y = 0) {
  return new THREE.Vector3(
    WORLD.originX + (cx + 0.5) * CELL,
    y,
    WORLD.originZ + (cz + 0.5) * CELL,
  );
}

/** Convenience: world-space position for a fractional cell coordinate. */
export function cellCenterF(cx, cz, y = 0) {
  return new THREE.Vector3(
    WORLD.originX + (cx + 0.5) * CELL,
    y,
    WORLD.originZ + (cz + 0.5) * CELL,
  );
}

export { GRID, CELL, WORLD };
