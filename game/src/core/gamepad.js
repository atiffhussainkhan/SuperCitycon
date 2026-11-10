/**
 * core/gamepad.js — what a gamepad MEANS.
 *
 * The browser's Gamepad API is read by the UX layer; this module decides
 * what a pad snapshot means. It imports nothing and touches no DOM or
 * `three`, so every rule here is unit-testable in Node.
 *
 * WHAT THIS IS FOR
 * V5 shipped with no gamepad code at all (V5 issue KI-05 claimed otherwise —
 * see docs/V5_KNOWN_ISSUES.md for the corrected record). V6 adds a real pad
 * path:
 *
 *   - the DEAD ZONE, so a resting stick reports exactly zero and the camera
 *     does not drift on its own;
 *   - BUTTON EDGES, so a held button fires ONCE and cannot double-confirm a
 *     menu action;
 *   - AXIS RESOLUTION, so the left stick pans, the right stick rotates and
 *     the triggers zoom, through the same actions the keyboard uses;
 *   - CONNECT / DISCONNECT, so a pad that is unplugged mid-session is
 *     released cleanly and reconnected cleanly.
 *
 * The bindings live beside the keyboard bindings in `core/input-map.js`, so
 * one table describes the player's controls and one place rebinds them.
 */

/**
 * The standard gamepad button indices (the W3C "standard" mapping, which is
 * what every modern browser reports).
 */
export const PAD_BUTTONS = Object.freeze({
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LEFT_BUMPER: 4,
  RIGHT_BUMPER: 5,
  LEFT_TRIGGER: 6,
  RIGHT_TRIGGER: 7,
  SELECT: 8,
  START: 9,
  LEFT_STICK: 10,
  RIGHT_STICK: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  GUIDE: 16,
});

/** The standard gamepad axis indices. */
export const PAD_AXES = Object.freeze({
  LEFT_X: 0,
  LEFT_Y: 1,
  RIGHT_X: 2,
  RIGHT_Y: 3,
  // The standard mapping reports the triggers as BUTTONS (6 and 7), but many
  // pads also expose them as axes 4 and 5. Both are read; see `readAxes`.
  LEFT_TRIGGER: 4,
  RIGHT_TRIGGER: 5,
});

/**
 * The axis indices that are STICKS, and therefore the only ones a dead zone
 * applies to.
 *
 * A dead zone exists because a stick rests at a small non-zero value and
 * drifts. A trigger is different: it rests at zero, and pressing it part-way
 * is a deliberate half-press the player can see on screen. Dead-zoning a
 * trigger would eat the first 18% of every pull and make a light press read
 * as nothing, so the trigger axes are left raw and normalised in `readAxes`.
 */
export const STICK_AXIS_INDICES = Object.freeze([
  PAD_AXES.LEFT_X,
  PAD_AXES.LEFT_Y,
  PAD_AXES.RIGHT_X,
  PAD_AXES.RIGHT_Y,
]);

/**
 * The default dead zone.
 *
 * A resting stick reports a small non-zero value on real hardware — a worn
 * stick can sit at 0.05 or 0.1 — and the camera would drift while the player
 * did nothing. 0.18 is the usual starting point for a modern stick.
 */
export const DEFAULT_DEAD_ZONE = 0.18;

/**
 * Apply a dead zone, rescaling the usable range so the response still reaches
 * 1.0 at full deflection.
 *
 * A value inside the dead zone reads as exactly zero — that is the whole
 * point of it: a resting stick must not move anything.
 *
 * @param {number} value the raw axis value, usually -1 .. 1
 * @param {number} [deadZone] the radius of the dead zone, 0 .. 0.95
 * @returns {number} -1 .. 1, or 0 inside the dead zone
 */
export function applyDeadZone(value, deadZone = DEFAULT_DEAD_ZONE) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return 0;
  const zone = Math.min(0.95, Math.max(0, Number(deadZone) || 0));
  const magnitude = Math.abs(raw);
  if (magnitude <= zone) return 0;
  // Rescale the band above the dead zone back onto 0 .. 1, so the stick still
  // reaches full speed at full deflection.
  const scaled = (magnitude - zone) / (1 - zone);
  return Math.sign(raw) * Math.min(1, scaled);
}

/**
 * Read one pad into a plain snapshot.
 *
 * The browser's pad object is not a plain object and changes under you; this
 * copies out exactly what the rules need, in a shape that is easy to compare
 * frame to frame and easy to fake in a test.
 *
 * @param {object|null} pad a `Gamepad` from `navigator.getGamepads()`
 * @param {object} [opts]
 * @param {number} [opts.deadZone]
 * @returns {{connected:boolean,id:string|null,index:number|null,mapping:string,buttons:boolean[],axes:number[]}}
 */
export function readPad(pad, { deadZone = DEFAULT_DEAD_ZONE } = {}) {
  if (!pad || !pad.connected) {
    return { connected: false, id: null, index: null, mapping: '', buttons: [], axes: [] };
  }
  const rawButtons = Array.isArray(pad.buttons) ? pad.buttons : [];
  const buttons = rawButtons.map((b) => {
    if (b && typeof b === 'object') return !!(b.pressed || (b.value ?? 0) > 0.5);
    return !!b;
  });
  const rawAxes = Array.isArray(pad.axes) ? pad.axes : [];
  const axes = rawAxes.map((a, i) => (
    STICK_AXIS_INDICES.includes(i) ? applyDeadZone(a, deadZone) : (Number.isFinite(Number(a)) ? Number(a) : 0)
  ));
  return {
    connected: true,
    id: typeof pad.id === 'string' ? pad.id : null,
    index: Number.isFinite(pad.index) ? pad.index : null,
    // The mapping is the browser's name for the pad's button layout.
    // It is copied so that a consumer can TELL a standard pad from a
    // non-standard one: the button indices of a non-standard pad do not
    // mean what they mean on a standard one, and silently reading them as
    // standard is how a player ends up with the wrong control bound.
    mapping: typeof pad.mapping === 'string' ? pad.mapping : '',
    buttons,
    axes,
  };
}

/**
 * Compare two snapshots and report the transitions.
 *
 * The EDGE is what stops a held button from firing twice: a button is
 * `pressed` only on the frame it goes down, and `released` only on the frame
 * it comes up.
 *
 * @param {object} prev the previous snapshot
 * @param {object} next the current snapshot
 * @returns {{pressed:number[],released:number[],held:number[],connected:boolean,wasConnected:boolean}}
 */
export function diffPad(prev, next) {
  const before = prev && prev.connected ? prev : { buttons: [], axes: [] };
  const after = next && next.connected ? next : { buttons: [], axes: [] };
  const pressed = [];
  const released = [];
  const held = [];
  const count = Math.max(before.buttons.length, after.buttons.length);
  for (let i = 0; i < count; i += 1) {
    const wasDown = !!before.buttons[i];
    const isDown = !!after.buttons[i];
    if (isDown) {
      held.push(i);
      if (!wasDown) pressed.push(i);
    } else if (wasDown) {
      released.push(i);
    }
  }
  return {
    pressed,
    released,
    held,
    connected: !!(next && next.connected),
    wasConnected: !!(prev && prev.connected),
  };
}

/**
 * The action a pad button triggers.
 *
 * @param {object} bindings action -> button indices
 * @param {number} buttonIndex
 * @returns {string|null}
 */
export function actionForButton(bindings, buttonIndex) {
  if (!bindings || typeof bindings !== 'object') return null;
  for (const [action, indices] of Object.entries(bindings)) {
    if (Array.isArray(indices) && indices.includes(buttonIndex)) return action;
  }
  return null;
}

/**
 * The analogue axes the game reads.
 *
 * The left stick pans the camera, the right stick rotates it, and the
 * triggers zoom. The values are the DEAD-ZONED axis values, so a resting
 * stick contributes nothing.
 *
 * @param {object} snapshot a snapshot from `readPad`
 * @param {object} [opts]
 * @param {number} [opts.leftStick] 0 = left, 1 = right (which stick pans)
 * @returns {{panX:number,panY:number,rotate:number,zoom:number}}
 */
export function readAxes(snapshot, { leftStick = 0 } = {}) {
  const empty = { panX: 0, panY: 0, rotate: 0, zoom: 0 };
  if (!snapshot || !snapshot.connected) return empty;
  const axes = snapshot.axes || [];
  const panXIndex = leftStick === 0 ? PAD_AXES.LEFT_X : PAD_AXES.RIGHT_X;
  const panYIndex = leftStick === 0 ? PAD_AXES.LEFT_Y : PAD_AXES.RIGHT_Y;
  const rotateIndex = leftStick === 0 ? PAD_AXES.RIGHT_X : PAD_AXES.LEFT_X;
  // The triggers are reported as BUTTONS on the standard mapping, and as
  // axes on some pads; both are accepted. The right trigger zooms in and the
  // left trigger zooms out, so pulling both is neutral.
  const zoomIn = axisOrTrigger(snapshot, PAD_AXES.RIGHT_TRIGGER, PAD_BUTTONS.RIGHT_TRIGGER);
  const zoomOut = axisOrTrigger(snapshot, PAD_AXES.LEFT_TRIGGER, PAD_BUTTONS.LEFT_TRIGGER);
  return {
    panX: axes[panXIndex] ?? 0,
    panY: axes[panYIndex] ?? 0,
    rotate: axes[rotateIndex] ?? 0,
    zoom: Math.max(0, zoomIn - zoomOut),
  };
}

/**
 * Read a trigger that may be an axis or a button.
 *
 * @param {object} snapshot
 * @param {number} axisIndex
 * @param {number} buttonIndex
 * @returns {number} 0 .. 1
 */
function axisOrTrigger(snapshot, axisIndex, buttonIndex) {
  const axes = snapshot.axes || [];
  if (Number.isFinite(axes[axisIndex]) && axes[axisIndex] !== 0) {
    // A trigger axis reads -1 (released) .. 1 (pressed) on some pads.
    const value = axes[axisIndex];
    return Math.max(0, value < 0 ? (value + 1) / 2 : value);
  }
  const buttons = snapshot.buttons || [];
  return buttons[buttonIndex] ? 1 : 0;
}

/**
 * The full per-frame gamepad state, compared against the previous frame.
 *
 * This is the object the UX layer acts on:
 *
 *   const state = updateGamepadState(previous, snapshot, bindings);
 *   if (state.pressedActions.includes('menu.confirm')) activate();
 *   camera.applyPad(state.axes, dt);
 *
 * @param {object|null} previous the previous state, or null on the first frame
 * @param {object} snapshot the current snapshot from `readPad`
 * @param {object} [bindings] action -> button indices
 * @returns {object} the new state
 */
export function updateGamepadState(previous, snapshot, bindings = null) {
  const prevSnapshot = previous?.snapshot ?? null;
  const diff = diffPad(prevSnapshot, snapshot);
  const pressedActions = [];
  const releasedActions = [];
  const heldActions = [];
  if (bindings) {
    for (const index of diff.pressed) {
      const action = actionForButton(bindings, index);
      if (action && !pressedActions.includes(action)) pressedActions.push(action);
    }
    for (const index of diff.released) {
      const action = actionForButton(bindings, index);
      if (action && !releasedActions.includes(action)) releasedActions.push(action);
    }
    for (const index of diff.held) {
      const action = actionForButton(bindings, index);
      if (action && !heldActions.includes(action)) heldActions.push(action);
    }
  }
  return {
    snapshot: snapshot ?? null,
    connected: diff.connected,
    wasConnected: diff.wasConnected,
    /** True on the frame the pad appears. */
    connectedNow: diff.connected && !diff.wasConnected,
    /** True on the frame the pad goes away. */
    disconnectedNow: !diff.connected && diff.wasConnected,
    pressedButtons: diff.pressed,
    releasedButtons: diff.released,
    heldButtons: diff.held,
    pressedActions,
    releasedActions,
    heldActions,
    axes: readAxes(snapshot),
  };
}
