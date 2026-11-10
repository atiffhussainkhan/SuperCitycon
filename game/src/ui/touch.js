/**
 * ui/touch.js — the touch input service (V7).
 *
 * OWNER: UX.
 *
 * WHAT THIS IS
 *   The browser half of the touch support. V6 had none: the canvas listened
 *   to pointer events, so a finger produced a mouse click and nothing else.
 *   On a phone the game could not be moved, zoomed or navigated.
 *
 *   The RULES live in `core/touch.js` (pure, Node-testable): the gesture
 *   recogniser. This file binds the gestures to what the game already has:
 *
 *     one-finger drag   → pan the camera
 *     two-finger pinch  → zoom the camera
 *     two-finger drag   → rotate the camera
 *     tap               → select the cell under the finger
 *     double-tap        → zoom in one step
 *     long press        → the game does not act on it (it is reserved)
 *
 * THE MOUSE IS NOT AFFECTED
 *   Only pointers whose type is `touch` or `pen` are fed to the recogniser.
 *   The mouse keeps its own path, unchanged.
 *
 * THE BROWSER MUST NOT STEAL THE GESTURE
 *   The canvas carries `touch-action: none`, so a drag on the city pans the
 *   city instead of scrolling the page, and a double-tap does not zoom the
 *   browser.
 */

import { createGestureRecogniser, isTouchPointer } from '../core/touch.js';
import { RIG_RATES } from './camera.js';
import { worldToCellInt, inBounds } from '../core/config.js';

/**
 * The touch service.
 *
 * @param {object} ctx the shared context
 * @param {object} [deps]
 * @param {object} [deps.camera] the camera rig
 * @param {Function} [deps.onToast] (message, kind)
 * @returns {object} the service
 */
export function createTouchService(ctx, deps = {}) {
  const camera = deps.camera ?? null;
  const logger = deps.logger ?? ctx?.logger ?? null;
  const renderer = ctx?.renderer ?? null;

  /**
   * How many world units one screen pixel of drag is worth.
   *
   * The mouse drag and the touch drag use the same scale, so the city
   * moves the same distance under the finger as it does under the cursor.
   */
  function panScale() {
    const distance = Number(camera?.state?.distance ?? 0);
    const base = Number(ctx?.config?.TUNING?.cameraDistance ?? 66);
    return RIG_RATES.dragPan * (distance / Math.max(1, base));
  }

  /**
   * The cell under a screen point.
   *
   * @param {number} x
   * @param {number} y
   * @returns {{x:number,z:number}|null}
   */
  function cellAt(x, y) {
    const hit = renderer?.screenToGround?.(x, y);
    if (!hit) return null;
    const cell = worldToCellInt(hit.x, hit.z);
    if (!inBounds(cell.x, cell.z)) return null;
    return cell;
  }

  /**
   * The reference of the current pinch.
   *
   * The recogniser reports the scale and the rotation of a pinch as
   * ABSOLUTE values, measured from the start of the gesture. The camera
   * must move by the CHANGE since the last event, or a pinch reported
   * ten times would zoom ten times over.
   */
  const pinchReference = { scale: null, rotation: null };

  /**
   * Handle one gesture.
   * @param {object} gesture
   */
  function handle(gesture) {
    if (!gesture) return;
    switch (gesture.type) {
      case 'drag': {
        // One finger pans the city. The camera clamps the focus to the
        // world rectangle, so a drag off the edge simply stops.
        const scale = panScale();
        camera?.panBy?.(-gesture.dx * scale, -gesture.dy * scale);
        return;
      }
      case 'pinch': {
        // The pinch's scale and rotation are ABSOLUTE values measured from
        // the start of the gesture. They are applied as DELTAS — the change
        // since the last event — so a pinch that is reported ten times
        // zooms once, not ten times over.
        if (gesture.phase === 'end') {
          pinchReference.scale = null;
          pinchReference.rotation = null;
          return;
        }
        if (gesture.phase === 'start') {
          pinchReference.scale = gesture.scale;
          pinchReference.rotation = gesture.rotation;
          return;
        }
        const scale = Number(gesture.scale);
        if (Number.isFinite(scale) && scale > 0 && pinchReference.scale) {
          const change = pinchReference.scale / scale;
          // The zoom compounds against the camera's TARGET, not against the
          // damped value the camera is showing: the damped value has not
          // caught up yet, so using it would lose every step but the last.
          const distance = Number(camera?.target?.distance ?? camera?.state?.distance ?? 0);
          if (Number.isFinite(distance) && distance > 0) {
            camera?.zoomTo?.(distance * change);
          }
          pinchReference.scale = scale;
        }
        const rotation = Number(gesture.rotation);
        if (Number.isFinite(rotation) && pinchReference.rotation !== null) {
          const change = rotation - pinchReference.rotation;
          if (Math.abs(change) > 0.0001) camera?.rotate?.(change);
          pinchReference.rotation = rotation;
        }
        if (gesture.dx || gesture.dy) {
          const scale2 = panScale();
          camera?.panBy?.(-gesture.dx * scale2, -gesture.dy * scale2);
        }
        return;
      }
      case 'tap': {
        // A tap selects the cell, exactly as a click does.
        const cell = cellAt(gesture.x, gesture.y);
        if (!cell) return;
        ctx?.dispatchWorldClick?.(cell, 0);
        return;
      }
      case 'double-tap': {
        // A double-tap zooms in one step, the way a map does.
        const distance = Number(camera?.state?.distance ?? 0);
        if (Number.isFinite(distance) && distance > 0) {
          camera?.zoomTo?.(distance * 0.72);
        }
        return;
      }
      case 'long-press': {
        // Reserved. The game does not act on a long press yet, and doing
        // nothing is better than doing something surprising.
        return;
      }
      default:
    }
  }

  const recogniser = createGestureRecogniser({ onGesture: handle });

  /** The element the listeners are installed on. */
  let element = null;
  let disposed = false;

  /**
   * The clock the recogniser reads. It is a function so a test can drive
   * it without a browser.
   */
  const now = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()
  );

  /**
   * A pointer event, in the shape the recogniser wants.
   * @param {object} e
   */
  function pointOf(e) {
    return { id: e?.pointerId ?? 0, x: Number(e?.clientX ?? 0), y: Number(e?.clientY ?? 0), t: now() };
  }

  const onPointerDown = (e) => {
    if (!isTouchPointer(e)) return;
    // The browser must not scroll the page or zoom it under the finger.
    e.preventDefault?.();
    try { element?.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
    recogniser.down(pointOf(e));
  };

  const onPointerMove = (e) => {
    if (!isTouchPointer(e)) return;
    if (recogniser.pointerCount() === 0) return;
    e.preventDefault?.();
    recogniser.move(pointOf(e));
  };

  const onPointerUp = (e) => {
    if (!isTouchPointer(e)) return;
    if (recogniser.pointerCount() === 0) return;
    e.preventDefault?.();
    recogniser.up(pointOf(e));
    try { element?.releasePointerCapture?.(e.pointerId); } catch { /* not captured */ }
  };

  const onPointerCancel = (e) => {
    if (!isTouchPointer(e)) return;
    recogniser.cancel(pointOf(e));
  };

  return {
    /**
     * Install the listeners on the canvas.
     *
     * @param {Element} el the canvas
     * @returns {boolean}
     */
    install(el) {
      if (disposed || !el || typeof el.addEventListener !== 'function') return false;
      element = el;
      el.addEventListener('pointerdown', onPointerDown, { passive: false });
      el.addEventListener('pointermove', onPointerMove, { passive: false });
      el.addEventListener('pointerup', onPointerUp, { passive: false });
      el.addEventListener('pointercancel', onPointerCancel, { passive: false });
      return true;
    },

    /** Per-frame update: the long press needs a clock. */
    update() {
      if (disposed) return;
      recogniser.tick(now());
    },

    /** The recogniser, for tests and for the debug read-out. */
    recogniser,

    /** How many fingers are down. */
    pointerCount() { return recogniser.pointerCount(); },

    /** True while a touch gesture is in progress. */
    isActive() { return recogniser.pointerCount() > 0; },

    dispose() {
      disposed = true;
      recogniser.reset();
      if (element && typeof element.removeEventListener === 'function') {
        element.removeEventListener('pointerdown', onPointerDown);
        element.removeEventListener('pointermove', onPointerMove);
        element.removeEventListener('pointerup', onPointerUp);
        element.removeEventListener('pointercancel', onPointerCancel);
      }
      element = null;
    },
  };
}
