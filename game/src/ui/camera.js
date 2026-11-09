/**
 * ui/camera.js — the city camera rig (FR-UX-061 … FR-UX-078).
 *
 * OWNER: UX (BOT-09).
 *
 * THE RIG DOES NOT RE-IMPLEMENT THE CAMERA. Every write goes through the
 * renderer service's own methods (`focusOn`, `setDistance`, `setYaw`,
 * `setPitch`), exactly as the contract in `core/CONTRACT.md` §4 requires.
 * The rig adds three things the renderer does not have:
 *
 *   1. FRAME-RATE-INDEPENDENT DAMPING. `alpha = 1 - exp(-k * dt)`, never a
 *      fixed `lerp(a, b, 0.1)` — a fixed lerp makes the camera move faster
 *      on a 144 Hz display than on a 30 Hz one.
 *   2. A KEYBOARD / EDGE-SCROLL CONTROL SCHEME (the task brief: pan by drag
 *      or WASD, rotate with Q/E or right-drag, zoom with the wheel).
 *   3. ADOPTION OF EXTERNAL CHANGES. The integrator's own input handler in
 *      `src/main.js` also writes to the renderer. The rig detects a write it
 *      did not make and adopts it as the new target, so the two never fight.
 *
 * This module does NOT import `three`; it only uses the renderer's public
 * API. `damp()` and friends are pure and are unit-tested in Node.
 */

import { TUNING, GRID, CELL, WORLD } from '../core/config.js';
import { EVENTS } from '../core/events.js';

/**
 * Frame-rate-independent exponential damping.
 *
 * @param {number} current
 * @param {number} target
 * @param {number} rate   the approach rate, in "e-folds per second"
 * @param {number} dt     seconds since the last frame
 * @returns {number}
 */
export function damp(current, target, rate, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return current;
  if (!Number.isFinite(rate) || rate <= 0) return target;
  const alpha = 1 - Math.exp(-rate * dt);
  return current + (target - current) * alpha;
}

/**
 * The same damping, but for an angle: it always takes the SHORT way round.
 * @param {number} current radians
 * @param {number} target  radians
 * @param {number} rate
 * @param {number} dt
 */
export function dampAngle(current, target, rate, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return current;
  if (!Number.isFinite(rate) || rate <= 0) return target;
  let delta = target - current;
  const TAU = Math.PI * 2;
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  const alpha = 1 - Math.exp(-rate * dt);
  return current + delta * alpha;
}

/** Clamp a pitch in DEGREES into the documented range (FR-UX-067). */
export function clampPitch(deg, min = 15, max = 85) {
  const d = Number(deg);
  if (!Number.isFinite(d)) return min;
  return Math.min(max, Math.max(min, d));
}

/** Clamp a camera distance into the documented zoom limits (FR-UX-061). */
export function clampDistance(d, min = TUNING.cameraMinDistance, max = TUNING.cameraMaxDistance) {
  const n = Number(d);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** The rig's tunable rates. Exposed so the UI can show them honestly. */
export const RIG_RATES = Object.freeze({
  /** Focus point follow (units / s smoothing). */
  focus: 9,
  /** Zoom follow. */
  distance: 8,
  /** Yaw follow. */
  yaw: 10,
  /** Pitch follow. */
  pitch: 10,
  /** Key pan speed, world units / second. */
  panSpeed: 34,
  /** Key pan speed while Shift is held. */
  panFast: 78,
  /** How fast the mouse-drag pan moves the focus, world units / pixel. */
  dragPan: 0.11,
  /** Yaw change per pixel of right-drag. */
  dragYaw: 0.006,
  /** Pitch change per pixel of right-drag, degrees. */
  dragPitch: 0.22,
  /** Wheel zoom step (a multiplier per notch). */
  wheelStep: 0.12,
  /** Edge-scroll band, in pixels from the viewport edge. */
  edgeBand: 24,
  /** Edge-scroll speed, world units / second. */
  edgeSpeed: 26,
  /**
   * Look-ahead: how far AHEAD of the pan direction the view leads, in world
   * units. The player sees where they are going instead of where they were.
   *
   * TBD: the publisher never published a look-ahead distance, so these are
   * design values. Proposed TUNING additions: `cameraLookAhead` and
   * `cameraLookAheadRate`.
   */
  /** TBD: the look-ahead distance, in world units. */
  lookAhead: 14,
  /** TBD: how fast the look-ahead offset catches up (e-folds / second). */
  lookAheadRate: 4.5,
});

/**
 * The camera shake.
 *
 * TBD: the publisher never published a shake amplitude or a decay rate, so
 * these are design values (the same class of number as `core/config.js`'s
 * TUNING table). They are marked here and proposed as TUNING additions in
 * the UI final report:
 *
 *   - `cameraShakeAmplitude` — the impulse of one shake, in world units.
 *   - `cameraShakeDecay`     — how fast a shake dies, in e-folds / second.
 *   - `cameraShakeFrequency` — how fast the shake oscillates, in rad/s.
 */
export const SHAKE = Object.freeze({
  /** TBD: the impulse of one shake, in world units. */
  amplitude: 0.9,
  /** TBD: how fast a shake dies, in e-folds per second. */
  decay: 4.2,
  /** TBD: how fast the shake oscillates, in radians per second. */
  frequency: 34,
  /** TBD: the ceiling of a stacked shake, in world units. */
  maxAmplitude: 2,
  /** TBD: the impulse of each event that shakes the camera, as a multiple. */
  byEvent: Object.freeze({
    [EVENTS.BUILDING_PLACED]: 0.5,
    [EVENTS.BUILDING_REMOVED]: 0.9,
    [EVENTS.BUILDING_UPGRADED]: 0.7,
    [EVENTS.HAZARD_DAMAGE]: 1.1,
    [EVENTS.STAGE_ADVANCED]: 1.3,
  }),
});

/**
 * The rectangle the focus point is clamped to: the playfield itself.
 *
 * The grid is 64 x 64 cells of 4 world units, so the world is 256 x 256
 * units centred on the origin — the focus can never leave it.
 */
export const WORLD_BOUNDS = Object.freeze({
  minX: WORLD.originX,
  maxX: WORLD.originX + GRID.size * CELL,
  minZ: WORLD.originZ,
  maxZ: WORLD.originZ + GRID.size * CELL,
});

/**
 * Clamp a point into the world rectangle.
 *
 * @param {number} x
 * @param {number} z
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} [bounds]
 * @returns {{x:number,z:number}}
 */
export function clampToWorld(x, z, bounds = WORLD_BOUNDS) {
  const nx = Number.isFinite(Number(x)) ? Number(x) : 0;
  const nz = Number.isFinite(Number(z)) ? Number(z) : 0;
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, nx)),
    z: Math.min(bounds.maxZ, Math.max(bounds.minZ, nz)),
  };
}

const KEY_PAN = {
  KeyW: 'north', ArrowUp: 'north',
  KeyS: 'south', ArrowDown: 'south',
  KeyA: 'west', ArrowLeft: 'west',
  KeyD: 'east', ArrowRight: 'east',
};

/** Which camera action moves the focus in which direction. */
const PAN_ACTIONS = Object.freeze({
  'camera.panUp': 'north',
  'camera.panDown': 'south',
  'camera.panLeft': 'west',
  'camera.panRight': 'east',
});

/**
 * Create the camera rig.
 *
 * @param {object} ctx the shared context (needs `ctx.renderer`)
 * @param {object} [options]
 * @param {boolean} [options.listen=true] install the DOM listeners
 * @returns {object} the rig
 */
export function createCameraRig(ctx, options = {}) {
  const renderer = ctx?.renderer;
  const state = ctx?.state;
  const inputMap = ctx?.inputMap ?? null;
  const listen = options.listen !== false;

  const cfg = ctx?.config ?? {};
  const tuning = cfg.TUNING ?? TUNING;

  // --- the values we WANT -------------------------------------------------
  const target = {
    x: 0,
    z: 0,
    distance: tuning.cameraDistance ?? 66,
    yaw: Math.PI / 4,
    pitch: tuning.cameraPitch ?? 55,
  };

  // --- the values we SHOW -------------------------------------------------
  const current = { ...target };

  // --- what we last pushed into the renderer ------------------------------
  const pushed = { x: NaN, z: NaN, distance: NaN, yaw: NaN, pitch: NaN };

  const keys = new Set();
  let edgePointer = null;
  let dragging = null;
  let disposed = false;

  // --- the look-ahead offset (the view leads the pan direction) ----------
  const lead = { x: 0, z: 0 };

  // --- the shake ----------------------------------------------------------
  let shakeAmplitude = 0;
  let shakePhase = 0;
  let shakeOffsetX = 0;
  let shakeOffsetZ = 0;

  const DEG = 180 / Math.PI;

  // ---- helpers ------------------------------------------------------------

  /**
   * The pan direction a key code is bound to, read from the input map.
   *
   * It is read on every key event, so a REBIND takes effect immediately —
   * the map is the single source of truth.
   */
  function panDirection(code) {
    if (!inputMap || typeof inputMap.get !== 'function' || !code) return null;
    for (const [action, dir] of Object.entries(PAN_ACTIONS)) {
      const codes = inputMap.get(action) ?? [];
      if (codes.includes(code)) return dir;
    }
    return null;
  }

  /** True when the player asked for a shake-free camera. */
  function shakeReduced() {
    try {
      return !!ctx?.settings?.get?.('accessibility.reducedShake');
    } catch {
      return false;
    }
  }

  /** Add a shake impulse — unless the player asked for no shake at all. */
  function addShake(amount) {
    if (shakeReduced()) return;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    shakeAmplitude = Math.min(SHAKE.maxAmplitude, shakeAmplitude + n * SHAKE.amplitude);
  }

  /** The renderer reports pitch in radians; the rig works in degrees. */
  function rendererPitchDeg() {    if (!renderer || typeof renderer.getPitch !== 'function') return current.pitch;
    const rad = Number(renderer.getPitch());
    return Number.isFinite(rad) ? rad * DEG : current.pitch;
  }

  function rendererYaw() {
    if (!renderer || typeof renderer.getYaw !== 'function') return current.yaw;
    const y = Number(renderer.getYaw());
    return Number.isFinite(y) ? y : current.yaw;
  }

  function rendererDistance() {
    if (!renderer || typeof renderer.getDistance !== 'function') return current.distance;
    const d = Number(renderer.getDistance());
    return Number.isFinite(d) ? d : current.distance;
  }

  /**
   * Adopt a FOCUS change made behind our back.
   *
   * The rig owns yaw, distance and pitch OUTRIGHT. The integrator's own
   * input handler in `src/main.js` also writes those three values on the
   * same canvas (a drag rotates and tilts, the wheel zooms), so adopting
   * them would either fight that handler or throw away the damping. The
   * rig's smoothed values are pushed to the renderer on every frame, and
   * the frame loop renders right after that push — so the rig's targets are
   * the single authority and every gesture (including the integrator's)
   * is damped. This domain owns the camera rig (contract §7), and the
   * integrator's handler is a navigation fallback, not a second camera.
   *
   * The focus POINT is different: another system may legitimately move it
   * (a scripted camera move, a "jump to this building" action). It is
   * adopted — but only when it is not the rig's own write.
   */
  function adoptExternalFocus() {
    if (!renderer || !renderer.focus) return;
    const fx = Number(renderer.focus.x);
    const fz = Number(renderer.focus.z);
    if (!Number.isFinite(fx) || !Number.isFinite(fz)) return;
    if (!Number.isFinite(pushed.x) || !Number.isFinite(pushed.z)) return;
    if (Math.abs(fx - pushed.x) > 1e-6 || Math.abs(fz - pushed.z) > 1e-6) {
      const c = clampToWorld(fx, fz);
      target.x = c.x;
      target.z = c.z;
      current.x = c.x;
      current.z = c.z;
    }
  }

  // ---- the public rig ----------------------------------------------------

  /** Move the focus point (clamped to the world rectangle). */
  function focus(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return current;
    const c = clampToWorld(x, z);
    target.x = c.x;
    target.z = c.z;
    return current;
  }

  /** Zoom to a distance (clamped to the published limits). */
  function zoomTo(d) {
    const n = Number(d);
    if (!Number.isFinite(n)) return current.distance;
    target.distance = clampDistance(n, tuning.cameraMinDistance, tuning.cameraMaxDistance);
    return target.distance;
  }

  /** Rotate by a delta in radians. */
  function rotate(delta) {
    const n = Number(delta);
    if (!Number.isFinite(n)) return current.yaw;
    target.yaw += n;
    return target.yaw;
  }

  /** Tilt by a delta in degrees. */
  function tilt(delta) {
    const n = Number(delta);
    if (!Number.isFinite(n)) return current.pitch;
    target.pitch = clampPitch(target.pitch + n);
    return target.pitch;
  }

  /** Return to the default view (TUNING camera distance / pitch / yaw). */
  function reset() {
    target.x = 0;
    target.z = 0;
    target.distance = tuning.cameraDistance ?? 66;
    target.yaw = Math.PI / 4;
    target.pitch = tuning.cameraPitch ?? 55;
    return target;
  }

  /** Snap straight to the target (used when a game load moves the camera). */
  function snap() {
    current.x = target.x;
    current.z = target.z;
    current.distance = target.distance;
    current.yaw = target.yaw;
    current.pitch = target.pitch;
    applyToRenderer();
  }

  /**
   * Apply the smoothed values to the renderer.
   *
   * The focus that is pushed carries the LOOK-AHEAD offset and the SHAKE
   * offset: both are presentation, not the focus itself, so the target and
   * the state mirror stay honest.
   */
  function applyToRenderer() {
    if (!renderer) return;
    const ox = lead.x + shakeOffsetX;
    const oz = lead.z + shakeOffsetZ;
    if (typeof renderer.focusOn === 'function') renderer.focusOn(current.x + ox, current.z + oz);
    if (typeof renderer.setDistance === 'function') renderer.setDistance(current.distance);
    if (typeof renderer.setYaw === 'function') renderer.setYaw(current.yaw);
    if (typeof renderer.setPitch === 'function') renderer.setPitch(current.pitch);
    pushed.x = current.x + ox;
    pushed.z = current.z + oz;
    pushed.distance = current.distance;
    pushed.yaw = current.yaw;
    pushed.pitch = current.pitch;
  }

  /**
   * Pan the focus in camera-relative space (used by WASD and edge-scroll).
   *
   * The focus is clamped to the world rectangle, and the world-space
   * movement is returned so the caller can work out the look-ahead.
   */
  function panRelative(dx, dz) {
    const sin = Math.sin(current.yaw);
    const cos = Math.cos(current.yaw);
    const wx = dx * cos - dz * sin;
    const wz = dx * sin + dz * cos;
    const c = clampToWorld(target.x + wx, target.z + wz);
    target.x = c.x;
    target.z = c.z;
    return { x: wx, z: wz };
  }

  // ---- per-frame ---------------------------------------------------------

  /**
   * @param {number} dt wall-clock seconds
   */
  function update(dt) {
    if (disposed) return current;
    const d = Number.isFinite(dt) ? dt : 0;

    adoptExternalFocus();

    // The world-space movement of this frame (used for the look-ahead).
    let movedX = 0;
    let movedZ = 0;

    // --- keyboard pan (WASD / arrows) ------------------------------------
    let px = 0;
    let pz = 0;
    if (keys.has('north')) pz -= 1;
    if (keys.has('south')) pz += 1;
    if (keys.has('west')) px -= 1;
    if (keys.has('east')) px += 1;
    if (px || pz) {
      const speed = keys.has('shift') ? RIG_RATES.panFast : RIG_RATES.panSpeed;
      const len = Math.hypot(px, pz) || 1;
      const moved = panRelative((px / len) * speed * d, (pz / len) * speed * d);
      movedX += moved.x;
      movedZ += moved.z;
    }

    // --- edge scroll ------------------------------------------------------
    if (edgePointer) {
      const { x, y, width, height } = edgePointer;
      const band = RIG_RATES.edgeBand;
      let ex = 0;
      let ez = 0;
      if (x < band) ex -= 1;
      else if (x > width - band) ex += 1;
      if (y < band) ez -= 1;
      else if (y > height - band) ez += 1;
      if (ex || ez) {
        const len = Math.hypot(ex, ez) || 1;
        const moved = panRelative((ex / len) * RIG_RATES.edgeSpeed * d, (ez / len) * RIG_RATES.edgeSpeed * d);
        movedX += moved.x;
        movedZ += moved.z;
      }
    }

    // --- the look-ahead ----------------------------------------------------
    // The view leads the pan direction: the player sees where they are
    // going, not where they were. The offset decays when the pan stops.
    const movedLen = Math.hypot(movedX, movedZ);
    const leadX = movedLen > 1e-6 ? (movedX / movedLen) * RIG_RATES.lookAhead : 0;
    const leadZ = movedLen > 1e-6 ? (movedZ / movedLen) * RIG_RATES.lookAhead : 0;
    lead.x = damp(lead.x, leadX, RIG_RATES.lookAheadRate, d);
    lead.z = damp(lead.z, leadZ, RIG_RATES.lookAheadRate, d);

    // --- the shake ---------------------------------------------------------
    // The decay is exponential, so it is frame-rate independent: the same
    // shake lasts the same wall-clock time at 30 Hz and at 144 Hz.
    if (shakeReduced()) shakeAmplitude = 0;
    shakePhase += SHAKE.frequency * d;
    shakeAmplitude *= Math.exp(-SHAKE.decay * d);
    if (shakeAmplitude < 1e-4) shakeAmplitude = 0;
    shakeOffsetX = Math.sin(shakePhase) * shakeAmplitude;
    shakeOffsetZ = Math.cos(shakePhase * 0.83) * shakeAmplitude * 0.7;

    // --- smooth everything (frame-rate independent) -----------------------
    current.x = damp(current.x, target.x, RIG_RATES.focus, d);
    current.z = damp(current.z, target.z, RIG_RATES.focus, d);
    current.distance = damp(current.distance, target.distance, RIG_RATES.distance, d);
    current.yaw = dampAngle(current.yaw, target.yaw, RIG_RATES.yaw, d);
    current.pitch = damp(current.pitch, target.pitch, RIG_RATES.pitch, d);

    applyToRenderer();

    // Keep the UI's mirror of the camera in state.ui.camera honest.
    if (state?.ui?.camera) {
      state.ui.camera.x = current.x;
      state.ui.camera.z = current.z;
      state.ui.camera.distance = current.distance;
      state.ui.camera.yaw = current.yaw;
      state.ui.camera.pitch = current.pitch;
    }
  }

  // ---- DOM listeners -------------------------------------------------------

  const canvas = renderer?.renderer?.domElement ?? null;

  function onPointerDown(e) {
    if (!e || disposed) return;
    // Left button drags the city, right button rotates it.
    if (e.button === 0) {
      dragging = { mode: 'pan', x: e.clientX, y: e.clientY, moved: 0 };
    } else if (e.button === 2) {
      dragging = { mode: 'rotate', x: e.clientX, y: e.clientY, moved: 0 };
    } else if (e.button === 1) {
      dragging = { mode: 'pan', x: e.clientX, y: e.clientY, moved: 0 };
      e.preventDefault?.();
    }
  }

  function onPointerMove(e) {
    if (!e || disposed) return;
    if (canvas) {
      const rect = canvas.getBoundingClientRect?.();
      edgePointer = rect
        ? { x: e.clientX - rect.left, y: e.clientY - rect.top, width: rect.width, height: rect.height }
        : null;
    }
    if (!dragging) return;
    const dx = e.clientX - dragging.x;
    const dy = e.clientY - dragging.y;
    dragging.x = e.clientX;
    dragging.y = e.clientY;
    dragging.moved += Math.abs(dx) + Math.abs(dy);
    if (dragging.mode === 'pan') {
      // Pan in camera-relative space: dragging right moves the city right.
      const scale = RIG_RATES.dragPan * (current.distance / Math.max(1, tuning.cameraDistance ?? 66));
      panRelative(-dx * scale, -dy * scale);
    } else {
      target.yaw -= dx * RIG_RATES.dragYaw;
      target.pitch = clampPitch(target.pitch + dy * RIG_RATES.dragPitch);
    }
  }

  function onPointerUp(e) {
    if (e && e.pointerId !== undefined && canvas?.releasePointerCapture) {
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    }
    dragging = null;
  }

  function onPointerLeave() {
    edgePointer = null;
  }

  function onWheel(e) {
    if (!e || disposed) return;
    e.preventDefault?.();
    const step = Math.sign(e.deltaY || 0) * RIG_RATES.wheelStep;
    zoomTo(current.distance * (1 + step));
  }

  function onContextMenu(e) {
    e.preventDefault?.();
  }

  /**
   * The camera's own key handling.
   *
   * The bindings come from `core/input-map.js` when the game published one,
   * so the camera and the on-screen hints can never disagree. Without an
   * input map the rig falls back to the historical WASD / arrows / Q / E /
   * R scheme.
   */
  function onKeyDown(e) {
    if (!e || disposed) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) return;
    // While the menu is open the menu owns the keyboard.
    if (ctx?.ui?.menu?.isOpen?.()) return;

    if (inputMap && typeof inputMap.matches === 'function') {
      if (inputMap.matches('camera.rotateLeft', e)) { rotate(-RIG_RATES.dragYaw * 6); return; }
      if (inputMap.matches('camera.rotateRight', e)) { rotate(RIG_RATES.dragYaw * 6); return; }
      if (inputMap.matches('camera.reset', e)) { reset(); return; }
      if (inputMap.matches('camera.zoomIn', e)) { zoomTo(current.distance * 0.82); return; }
      if (inputMap.matches('camera.zoomOut', e)) { zoomTo(current.distance * 1.22); return; }
      const dir = panDirection(e.code);
      if (dir) { keys.add(dir); e.preventDefault?.(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.add('shift');
      return;
    }

    if (e.code === 'KeyQ') { rotate(-RIG_RATES.dragYaw * 6); return; }
    if (e.code === 'KeyE') { rotate(RIG_RATES.dragYaw * 6); return; }
    // R resets the camera. (H was the label on the reset button for a while,
    // but H opens the help panel — the label was a lie, so the key moved.)
    if (e.code === 'KeyR') { reset(); return; }
    const dir = KEY_PAN[e.code];
    if (dir) { keys.add(dir); e.preventDefault?.(); return; }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.add('shift');
  }

  function onKeyUp(e) {
    if (!e || disposed) return;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.delete('shift');
    const dir = panDirection(e.code) ?? KEY_PAN[e.code];
    if (dir) keys.delete(dir);
  }
  function onBlur() {
    keys.clear();
    dragging = null;
  }

  if (listen && canvas && typeof canvas.addEventListener === 'function') {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
  }
  if (listen && typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
  }

  // --- the shake triggers --------------------------------------------------
  //
  // The renderer has no shake of its own, so the rig owns it. The events
  // that shake the camera are the ones that describe something happening in
  // the city — the rig never invents a shake of its own.
  const busUnsubscribes = [];
  const bus = ctx?.bus;
  if (bus && typeof bus.on === 'function') {
    for (const [evt, amount] of Object.entries(SHAKE.byEvent)) {
      let un = null;
      try {
        un = bus.on(evt, () => addShake(amount));
      } catch {
        un = null;
      }
      if (typeof un === 'function') busUnsubscribes.push(un);
    }
  }

  // Seed the smoothed values from the renderer so the first frame does not
  // snap the camera from the default to wherever the renderer already was.
  if (renderer) {
    const yaw = rendererYaw();
    const dist = rendererDistance();
    const pitch = rendererPitchDeg();
    if (Number.isFinite(yaw)) { target.yaw = yaw; current.yaw = yaw; }
    if (Number.isFinite(dist)) { target.distance = dist; current.distance = dist; }
    if (Number.isFinite(pitch)) { target.pitch = pitch; current.pitch = pitch; }
    if (renderer.focus && Number.isFinite(renderer.focus.x)) {
      target.x = renderer.focus.x;
      target.z = renderer.focus.z;
      current.x = target.x;
      current.z = target.z;
    }
  }
  applyToRenderer();

  return {
    focus,
    zoomTo,
    rotate,
    tilt,
    reset,
    snap,
    update,
    /** The smoothed camera state (read-only snapshot). */
    get state() {
      return { x: current.x, z: current.z, distance: current.distance, yaw: current.yaw, pitch: current.pitch };
    },
    /** The values the rig is moving toward. */
    get target() {
      return { ...target };
    },
    /** True while a mouse drag is in progress. */
    isDragging: () => !!dragging,
    dispose() {
      disposed = true;
      keys.clear();
      for (const un of busUnsubscribes) { try { un(); } catch { /* ignore */ } }
      busUnsubscribes.length = 0;
      if (canvas && typeof canvas.removeEventListener === 'function') {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointerleave', onPointerLeave);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('contextmenu', onContextMenu);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
      }
    },
  };
}
