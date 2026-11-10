/**
 * core/touch.js — what a finger MEANS.
 *
 * OWNER: the integrator (core/).
 *
 * WHY THIS EXISTS
 *   SuperCitycon is a web game and the deployment target is the open web.
 *   V6 had no touch support at all: the canvas listened to pointer events,
 *   so a finger produced a mouse click and nothing else. On a phone the
 *   game was a picture of a city that could not be moved, zoomed or
 *   navigated.
 *
 * WHAT THIS IS
 *   A gesture recogniser. It turns a stream of touch points into the
 *   gestures a player makes:
 *
 *     TAP          — a quick touch that did not move
 *     DOUBLE-TAP   — two taps in quick succession
 *     LONG-PRESS   — a touch held still
 *     DRAG         — a touch that moved, with a velocity
 *     PINCH        — two fingers, with a scale and a rotation
 *
 * PURE
 *   This module imports nothing and touches no DOM. The caller feeds it
 *   plain points ({ id, x, y, t }) and it calls back with gestures. That
 *   makes every gesture rule unit-testable in Node with no browser, and it
 *   makes the module reusable for a mouse, a pen or a trackpad.
 *
 * FRAME-RATE INDEPENDENT
 *   Every threshold is in MILLISECONDS or PIXELS, never in frames. The same
 *   physical gesture produces the same gesture at 30 Hz and at 144 Hz — a
 *   rule that matters, because a slow frame must not turn a tap into a
 *   long press.
 *
 * THE TIMES COME FROM THE CALLER
 *   `t` is a timestamp in milliseconds. The module never reads the clock
 *   itself, so a test can drive it with any timeline it likes.
 */

/**
 * The default thresholds.
 *
 * TBD: the publisher never published touch thresholds, so these are design
 * values chosen to match the platform conventions (a tap is under a
 * quarter of a second, a long press is half a second).
 */
export const TOUCH_DEFAULTS = Object.freeze({
  /** The longest a tap may last. */
  tapMs: 250,
  /** The window in which a second tap makes a double-tap. */
  doubleTapMs: 300,
  /** How long a touch must be held to be a long press. */
  longPressMs: 500,
  /** How far a touch may drift and still count as a tap. */
  movePx: 10,
  /** The two taps of a double-tap may be this far apart. */
  doubleTapPx: 40,
});

/**
 * Normalise a point record.
 * @param {object} point
 * @returns {{id:number|string,x:number,y:number,t:number}|null}
 */
function normalise(point) {
  if (!point || typeof point !== 'object') return null;
  const x = Number(point.x);
  const y = Number(point.y);
  const t = Number(point.t);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(t)) return null;
  const id = point.id ?? 0;
  return { id, x, y, t };
}

/**
 * The distance between two pointers.
 */
function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * The angle between two pointers, in radians.
 */
function angle(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * Create a gesture recogniser.
 *
 * @param {object} [options]
 * @param {Function} [options.onGesture] (gesture) => void
 * @param {number} [options.tapMs]
 * @param {number} [options.doubleTapMs]
 * @param {number} [options.longPressMs]
 * @param {number} [options.movePx]
 * @param {number} [options.doubleTapPx]
 * @returns {object} the recogniser
 */
export function createGestureRecogniser(options = {}) {
  const onGesture = typeof options.onGesture === 'function' ? options.onGesture : () => {};
  const pick = (value, fallback) => (
    Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback
  );
  const tapMs = pick(options.tapMs, TOUCH_DEFAULTS.tapMs);
  const doubleTapMs = pick(options.doubleTapMs, TOUCH_DEFAULTS.doubleTapMs);
  const longPressMs = pick(options.longPressMs, TOUCH_DEFAULTS.longPressMs);
  const movePx = pick(options.movePx, TOUCH_DEFAULTS.movePx);
  const doubleTapPx = pick(options.doubleTapPx, TOUCH_DEFAULTS.doubleTapPx);

  /** The live pointers, by id. */
  const pointers = new Map();
  /** The last tap, so a second one can be recognised as a double-tap. */
  let lastTap = null;
  /** The pinch state, while two fingers are down. */
  let pinch = null;
  /**
   * True once this gesture has used more than one finger.
   *
   * A gesture that used two fingers is a MULTI-TOUCH gesture, whatever it
   * ends with: the finger that lifts first is usually the one that never
   * moved, so it looks exactly like a tap. Without this flag a pinch to
   * zoom would also select a cell — and place a building by accident at
   * the end of every zoom.
   */
  let multiTouch = false;

  /**
   * Emit a gesture.
   * @param {object} gesture
   */
  function emit(gesture) {
    try {
      onGesture(gesture);
    } catch {
      /* a broken listener must not break the input */
    }
  }

  /**
   * The two pointers of the current pinch.
   * @returns {Array<object>}
   */
  function pinchPointers() {
    if (!pinch) return [];
    const a = pointers.get(pinch.ids[0]);
    const b = pointers.get(pinch.ids[1]);
    return (a && b) ? [a, b] : [];
  }

  /**
   * A finger went down.
   * @param {object} point { id, x, y, t }
   */
  function down(point) {
    const p = normalise(point);
    if (!p) return;
    pointers.set(p.id, {
      id: p.id,
      x: p.x,
      y: p.y,
      startX: p.x,
      startY: p.y,
      startTime: p.t,
      prevX: p.x,
      prevY: p.y,
      prevTime: p.t,
      vx: 0,
      vy: 0,
      moved: false,
      longFired: false,
    });

    if (pointers.size === 2) {
      multiTouch = true;
      const [a, b] = [...pointers.values()];
      pinch = {
        ids: [a.id, b.id],
        startDistance: distance(a, b) || 1,
        startAngle: angle(a, b),
        lastCx: (a.x + b.x) / 2,
        lastCy: (a.y + b.y) / 2,
        phase: 'move',
      };
      // The pinch STARTS here, with the reference scale of 1 and no
      // rotation. The consumer records that reference and then applies the
      // CHANGE on every move, so the gesture is applied once in total.
      emit({
        type: 'pinch',
        phase: 'start',
        scale: 1,
        rotation: 0,
        cx: pinch.lastCx,
        cy: pinch.lastCy,
        dx: 0,
        dy: 0,
        time: p.t,
      });
    } else if (pointers.size > 2) {
      // Three fingers is not a gesture this game acts on.
      pinch = null;
    }
  }

  /**
   * A finger moved.
   * @param {object} point { id, x, y, t }
   */
  function move(point) {
    const p = normalise(point);
    if (!p) return;
    const held = pointers.get(p.id);
    if (!held) return;

    const dt = Math.max(1, p.t - held.prevTime);
    const dx = p.x - held.x;
    const dy = p.y - held.y;
    held.prevX = held.x;
    held.prevY = held.y;
    held.prevTime = p.t;
    held.x = p.x;
    held.y = p.y;

    const totalDx = p.x - held.startX;
    const totalDy = p.y - held.startY;
    if (!held.moved && Math.hypot(totalDx, totalDy) >= movePx) {
      held.moved = true;
      // A finger that has moved is not going to long-press.
      held.longFired = false;
    }

    // A two-finger gesture is a pinch, not a drag.
    if (pinch && pointers.size >= 2) {
      const [a, b] = pinchPointers();
      if (a && b) {
        const scale = distance(a, b) / pinch.startDistance;
        const rotation = angle(a, b) - pinch.startAngle;
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        // The PHASE matters: the scale and the rotation are ABSOLUTE values
        // measured from the start of the pinch. A consumer that applies them
        // as they are would zoom by the scale once per move event, which
        // compounds. The 'start' event carries the reference; every 'move'
        // carries the change since the last one.
        emit({
          type: 'pinch',
          phase: 'move',
          scale: Number.isFinite(scale) ? scale : 1,
          rotation: Number.isFinite(rotation) ? rotation : 0,
          cx,
          cy,
          dx: cx - pinch.lastCx,
          dy: cy - pinch.lastCy,
          time: p.t,
        });
        pinch.lastCx = cx;
        pinch.lastCy = cy;
      }
      return;
    }

    if (pointers.size === 1 && held.moved) {
      // The velocity is smoothed, so a single jittery frame does not throw
      // the camera across the map.
      const instantVx = dx / dt;
      const instantVy = dy / dt;
      held.vx = (held.vx * 0.7) + (instantVx * 0.3);
      held.vy = (held.vy * 0.7) + (instantVy * 0.3);
      emit({
        type: 'drag',
        id: held.id,
        x: p.x,
        y: p.y,
        dx,
        dy,
        vx: held.vx,
        vy: held.vy,
        time: p.t,
      });
    }
  }

  /**
   * A finger came up.
   * @param {object} point { id, x, y, t }
   */
  function up(point) {
    const p = normalise(point);
    if (!p) return;
    const held = pointers.get(p.id);
    if (!held) return;
    // The gesture is OVER when the last finger lifts, so the multi-touch
    // flag is cleared here — otherwise a pinch would kill every tap for
    // the rest of the session.
    const wasMultiTouch = multiTouch;
    pointers.delete(p.id);
    if (pointers.size === 0) multiTouch = false;
    if (pointers.size < 2) {
      // The pinch is over: say so, so a consumer can drop its reference.
      if (pinch) {
        emit({ type: 'pinch', phase: 'end', scale: 1, rotation: 0, cx: p.x, cy: p.y, dx: 0, dy: 0, time: p.t });
      }
      pinch = null;
    }

    const duration = p.t - held.startTime;
    const drift = Math.hypot(p.x - held.startX, p.y - held.startY);

    if (held.longFired) return;             // the long press already fired
    // A finger that was part of a MULTI-TOUCH gesture never taps.
    //
    // When two fingers are down, the gesture is a pinch — and the finger
    // that lifts first is usually the one that never moved, so it looks
    // exactly like a tap. Without this guard a zoom would also select a
    // cell, and the player would place a building by accident at the end
    // of every pinch.
    if (wasMultiTouch) return;
    if (held.moved || drift >= movePx) return;   // it was a drag

    if (duration >= longPressMs) {
      emit({ type: 'long-press', x: p.x, y: p.y, time: p.t });
      return;
    }
    if (duration > tapMs) return;           // too slow to be a tap

    const previous = lastTap;
    if (previous
      && (p.t - previous.time) <= doubleTapMs
      && Math.hypot(p.x - previous.x, p.y - previous.y) <= doubleTapPx) {
      emit({ type: 'double-tap', x: p.x, y: p.y, time: p.t });
      lastTap = null;
      return;
    }
    emit({ type: 'tap', x: p.x, y: p.y, time: p.t });
    lastTap = { x: p.x, y: p.y, time: p.t };
  }

  /**
   * A finger was cancelled (a call came in, the browser took over).
   * @param {object} point { id, x, y, t }
   */
  function cancel(point) {
    const p = normalise(point);
    if (!p) return;
    pointers.delete(p.id);
    if (pointers.size < 2) {
      if (pinch) {
        emit({ type: 'pinch', phase: 'end', scale: 1, rotation: 0, cx: p.x, cy: p.y, dx: 0, dy: 0, time: p.t });
      }
      pinch = null;
    }
  }

  /**
   * Advance the clock.
   *
   * The long press is fired here rather than by a timer, so the module
   * stays pure and the caller decides when "now" is.
   *
   * @param {number} now the current time in milliseconds
   */
  function tick(now) {
    const t = Number(now);
    if (!Number.isFinite(t)) return;
    for (const held of pointers.values()) {
      if (held.moved || held.longFired) continue;
      if (t - held.startTime < longPressMs) continue;
      held.longFired = true;
      emit({ type: 'long-press', x: held.x, y: held.y, time: t });
    }
  }

  /**
   * Forget everything. A cancelled gesture must not leak into the next one.
   */
  function reset() {
    pointers.clear();
    lastTap = null;
    pinch = null;
    multiTouch = false;
  }

  return {
    down,
    move,
    up,
    cancel,
    tick,
    reset,
    /** How many fingers are down. */
    pointerCount() { return pointers.size; },
    /** The live pointers, for the debug read-out. */
    pointers() {
      return [...pointers.values()].map((p) => ({
        id: p.id, x: p.x, y: p.y, moved: p.moved,
      }));
    },
    /** The thresholds in force, for the debug read-out. */
    thresholds() {
      return { tapMs, doubleTapMs, longPressMs, movePx, doubleTapPx };
    },
  };
}

/**
 * Is this event a touch (or a pen) rather than a mouse?
 *
 * A mouse must never drive the touch gestures: on a laptop the mouse is
 * the mouse, and the game's own pointer handling owns it.
 *
 * @param {object} event a pointer event
 * @returns {boolean}
 */
export function isTouchPointer(event) {
  const type = event?.pointerType;
  if (type === 'touch' || type === 'pen') return true;
  // A browser that does not report the pointer type still reports touches
  // through the `touches` list.
  if (typeof event?.touches !== 'undefined') return true;
  return false;
}
