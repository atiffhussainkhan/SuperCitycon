/**
 * V4 — Rendering abstraction.
 *
 * The engine does not talk to WebGL directly: it talks to this facade, which
 * owns the Three.js renderer, the camera rig, the quality preset and the
 * measured counters. A different backend could be dropped in behind the same
 * interface; today it is Three.js, because the project already ships with it
 * and it is a mature, well-understood engine (no custom renderer is written
 * here).
 */

import * as THREE from 'three';

export const QUALITY_PRESETS = {
  low: { pixelRatio: 0.75, shadows: false, shadowMapSize: 512, antialias: false, maxDrawDistance: 120 },
  medium: { pixelRatio: 1, shadows: true, shadowMapSize: 1024, antialias: true, maxDrawDistance: 250 },
  high: { pixelRatio: 1.5, shadows: true, shadowMapSize: 2048, antialias: true, maxDrawDistance: 400 },
};

export function createRenderer({ canvas, quality = 'medium', width = 1280, height = 720 } = {}) {
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: preset.antialias,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, preset.pixelRatio));
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = preset.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b1220');

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, preset.maxDrawDistance);
  camera.position.set(12, 9, 16);
  camera.lookAt(0, 1, 0);

  let qualityName = quality;

  const api = {
    three: THREE,
    scene,
    camera,
    renderer,
    get quality() { return qualityName; },

    setQuality(name) {
      const next = QUALITY_PRESETS[name];
      if (!next) return false;
      qualityName = name;
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, next.pixelRatio));
      renderer.shadowMap.enabled = next.shadows;
      camera.far = next.maxDrawDistance;
      camera.updateProjectionMatrix();
      // The shadow map size lives on each light, so it is applied by the caller.
      api.qualityChanged = next;
      return true;
    },

    /** Render one frame and return the measured counters. */
    render() {
      renderer.info.reset();
      renderer.render(scene, camera);
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
        memoryMb: 0,
      };
    },

    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    },

    /** The identity of the GPU actually in use — never a guess. */
    gpuInfo() {
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const info = {
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        isSoftware: false,
      };
      const r = String(info.renderer ?? '').toLowerCase();
      info.isSoftware = r.includes('swiftshader') || r.includes('llvmpipe') || r.includes('software');
      return info;
    },

    dispose() {
      renderer.dispose();
    },
  };
  return api;
}

/**
 * A camera rig with a third-person follow mode and an editor orbit mode.
 * The editor uses the orbit controls; the runtime uses the follow rig.
 */
export function createCameraRig({ camera, domElement, target = new THREE.Vector3() } = {}) {
  const follow = {
    distance: 6,
    height: 2.4,
    yaw: 0,
    pitch: 0.35,
    smoothing: 8,
  };
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  let mode = 'orbit';

  return {
    get mode() { return mode; },
    set mode(v) { mode = v; },
    follow,

    /** Third-person follow: orbit behind the target by yaw/pitch at a distance. */
    updateFollow(targetPos, dt) {
      const cp = Math.cos(follow.pitch);
      desired.set(
        targetPos.x - Math.sin(follow.yaw) * follow.distance * cp,
        targetPos.y + follow.height + Math.sin(follow.pitch) * follow.distance,
        targetPos.z - Math.cos(follow.yaw) * follow.distance * cp,
      );
      const k = 1 - Math.exp(-follow.smoothing * dt);
      camera.position.lerp(desired, k);
      look.set(targetPos.x, targetPos.y + 1.4, targetPos.z);
      camera.lookAt(look);
    },

    /** Editor orbit: yaw/pitch around a focus point at a fixed distance. */
    updateOrbit(focus, dt, { distance = 14, yaw = 0.6, pitch = 0.5 } = {}) {
      // The focus may arrive as a plain `{x,y,z}` object, and `lookAt()` with
      // anything that is not a Vector3, an array or a number produces a NaN
      // matrix — which silently renders nothing at all.
      const fx = focus?.x ?? 0;
      const fy = focus?.y ?? 0;
      const fz = focus?.z ?? 0;
      const cp = Math.cos(pitch);
      desired.set(
        fx + Math.sin(yaw) * distance * cp,
        fy + Math.sin(pitch) * distance,
        fz + Math.cos(yaw) * distance * cp,
      );
      const k = 1 - Math.exp(-12 * dt);
      camera.position.lerp(desired, k);
      look.set(fx, fy, fz);
      camera.lookAt(look);
    },

    setFocus(v) { target.copy(v); },
    focusPoint() { return target; },
  };
}
