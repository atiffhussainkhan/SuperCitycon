/**
 * core/gamepad.test.mjs — the gamepad rules.
 *
 * Run with:  node --test src/core/gamepad.test.mjs
 *
 * These are the rules that decide what a pad MEANS: the dead zone, the
 * button edge, the analogue axes, and connect / disconnect. Every one of
 * them is a rule that has bitten a real controller or will: a resting stick
 * that drifts, a held button that fires twice, a pad that is unplugged
 * mid-session.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DEAD_ZONE,
  PAD_AXES,
  PAD_BUTTONS,
  actionForButton,
  applyDeadZone,
  diffPad,
  readAxes,
  readPad,
  updateGamepadState,
} from './gamepad.js';
import { createInputMap, DEFAULT_PAD_BINDINGS, PAD_ACTIONS } from './input-map.js';

/**
 * A fake pad, shaped like the browser's Gamepad.
 * @param {object} [opts]
 */
function fakePad({
  connected = true,
  buttons = {},
  axes = [],
  id = 'Test Pad (STANDARD GAMEPAD)',
  index = 0,
} = {}) {
  const list = [];
  const highest = Math.max(0, ...Object.keys(buttons).map(Number));
  for (let i = 0; i <= highest; i += 1) {
    list.push({ pressed: !!buttons[i], value: buttons[i] ? 1 : 0, touched: false });
  }
  return { connected, buttons: list, axes, id, index, mapping: 'standard', timestamp: 0 };
}

// ---------------------------------------------------------------------------
// The dead zone
// ---------------------------------------------------------------------------

test('gamepad: a resting stick reads as exactly zero', () => {
  // A worn stick can sit at 0.05. Inside the dead zone that is zero.
  assert.equal(applyDeadZone(0.05), 0);
  assert.equal(applyDeadZone(-0.07), 0);
  assert.equal(applyDeadZone(0), 0);
});

test('gamepad: a stick outside the dead zone still reaches full speed', () => {
  assert.equal(applyDeadZone(1), 1);
  assert.equal(applyDeadZone(-1), -1);
  assert.ok(Math.abs(applyDeadZone(0.5) - (0.5 - DEFAULT_DEAD_ZONE) / (1 - DEFAULT_DEAD_ZONE)) < 1e-9);
});

test('gamepad: the dead zone preserves the direction of the stick', () => {
  assert.ok(applyDeadZone(-0.9) < 0, 'a left push stays negative');
  assert.ok(applyDeadZone(0.9) > 0, 'a right push stays positive');
});

test('gamepad: a dead zone of zero passes the raw value through', () => {
  assert.equal(applyDeadZone(0.25, 0), 0.25);
  assert.equal(applyDeadZone(-0.25, 0), -0.25);
});

test('gamepad: a broken axis value reads as zero rather than NaN', () => {
  assert.equal(applyDeadZone(undefined), 0);
  assert.equal(applyDeadZone(null), 0);
  assert.equal(applyDeadZone('nonsense'), 0);
  assert.equal(applyDeadZone(Number.NaN), 0);
});

// ---------------------------------------------------------------------------
// Reading the pad
// ---------------------------------------------------------------------------

test('gamepad: reading a pad copies its buttons and axes', () => {
  const snap = readPad(fakePad({ buttons: { 0: true, 3: true }, axes: [0.5, -0.5, 0, 0] }));
  assert.equal(snap.connected, true);
  assert.equal(snap.buttons.length, 4);
  assert.equal(snap.buttons[0], true);
  assert.equal(snap.buttons[1], false);
  assert.equal(snap.buttons[3], true);
  assert.ok(Math.abs(snap.axes[0] - 0.5) > 0, 'the axis is rescaled by the dead zone');
});

test('gamepad: a disconnected pad reads as disconnected with nothing in it', () => {
  const snap = readPad(null);
  assert.equal(snap.connected, false);
  assert.deepEqual(snap.buttons, []);
  assert.deepEqual(snap.axes, []);
});

test('gamepad: a pad that reports connected=false is treated as disconnected', () => {
  const snap = readPad(fakePad({ connected: false }));
  assert.equal(snap.connected, false);
});

test('gamepad: a button with a value but no pressed flag still reads as down', () => {
  const pad = fakePad();
  pad.buttons[0] = { pressed: false, value: 0.9 };
  const snap = readPad(pad);
  assert.equal(snap.buttons[0], true, 'an analogue trigger counts as down');
});

// ---------------------------------------------------------------------------
// The button edge
// ---------------------------------------------------------------------------

test('gamepad: a button fires on the edge, not while it is held', () => {
  const down = readPad(fakePad({ buttons: { 0: true } }));
  const up = readPad(fakePad({ buttons: {} }));

  const first = diffPad(up, down);
  assert.deepEqual(first.pressed, [0], 'the first frame is a press');
  assert.deepEqual(first.held, [0], 'and it is held');

  const second = diffPad(down, down);
  assert.deepEqual(second.pressed, [], 'a held button does NOT press again');
  assert.deepEqual(second.held, [0], 'it is still held');
  assert.deepEqual(second.released, []);
});

test('gamepad: a button releases when it comes up', () => {
  const down = readPad(fakePad({ buttons: { 0: true } }));
  const up = readPad(fakePad({ buttons: {} }));
  const diff = diffPad(down, up);
  assert.deepEqual(diff.released, [0]);
  assert.deepEqual(diff.pressed, []);
});

test('gamepad: a disconnected pad releases every button it was holding', () => {
  const down = readPad(fakePad({ buttons: { 0: true, 1: true } }));
  const gone = readPad(null);
  const diff = diffPad(down, gone);
  assert.deepEqual(diff.released, [0, 1], 'the held buttons are released, not stuck');
  assert.equal(diff.connected, false);
  assert.equal(diff.wasConnected, true);
});

// ---------------------------------------------------------------------------
// The analogue axes
// ---------------------------------------------------------------------------

test('gamepad: the left stick pans and the right stick rotates', () => {
  const snap = readPad(fakePad({ axes: [0.9, -0.9, 0.5, 0] }));
  const axes = readAxes(snap);
  // The dead zone RESCALES, so 0.9 of stick travel reads as 0.878 of camera
  // travel. The response is still linear and still reaches 1.0 at full travel.
  assert.equal(axes.panX, applyDeadZone(0.9), 'panX is the dead-zoned stick');
  assert.equal(axes.panY, applyDeadZone(-0.9), 'panY keeps its sign');
  assert.equal(axes.rotate, applyDeadZone(0.5), 'the right stick rotates');
  assert.equal(axes.zoom, 0);
});

test('gamepad: a neutral stick reports no movement at all', () => {
  const snap = readPad(fakePad({ axes: [0.02, -0.03, 0.01, 0] }));
  const axes = readAxes(snap);
  assert.deepEqual(axes, { panX: 0, panY: 0, rotate: 0, zoom: 0 });
});

test('gamepad: a disconnected pad reports no movement', () => {
  const axes = readAxes(readPad(null));
  assert.deepEqual(axes, { panX: 0, panY: 0, rotate: 0, zoom: 0 });
});

test('gamepad: a trigger reads as zoom from a button or from an axis', () => {
  const asButton = readAxes(readPad(fakePad({ buttons: { [PAD_BUTTONS.RIGHT_TRIGGER]: true } })));
  assert.equal(asButton.zoom, 1);
  const asAxis = readAxes(readPad(fakePad({ axes: [0, 0, 0, 0, 0, 0.8] })));
  assert.ok(Math.abs(asAxis.zoom - 0.8) < 1e-9, `zoom=${asAxis.zoom}`);
});

// ---------------------------------------------------------------------------
// The per-frame state
// ---------------------------------------------------------------------------

test('gamepad: the state reports the action a pressed button triggers', () => {
  const bindings = DEFAULT_PAD_BINDINGS;
  const up = readPad(fakePad({ buttons: {} }));
  const down = readPad(fakePad({ buttons: { [PAD_BUTTONS.A]: true } }));
  const state = updateGamepadState(null, down, bindings);
  assert.ok(state.pressedActions.includes('menu.confirm'));
  assert.ok(state.heldActions.includes('menu.confirm'));
  assert.equal(state.connectedNow, true, 'the first frame is the connect');
});

test('gamepad: holding the confirm button cannot confirm twice', () => {
  const bindings = DEFAULT_PAD_BINDINGS;
  const down = readPad(fakePad({ buttons: { [PAD_BUTTONS.A]: true } }));
  const first = updateGamepadState(null, down, bindings);
  const second = updateGamepadState(first, down, bindings);
  assert.equal(first.pressedActions.includes('menu.confirm'), true);
  assert.equal(second.pressedActions.includes('menu.confirm'), false,
    'the held button must not press again');
  assert.equal(second.heldActions.includes('menu.confirm'), true,
    'it is still held, so the UI can show it');
});

test('gamepad: a pad that is unplugged is reported as disconnected', () => {
  const down = readPad(fakePad({ buttons: { 0: true } }));
  const state = updateGamepadState(
    { snapshot: down },
    readPad(null),
    DEFAULT_PAD_BINDINGS,
  );
  assert.equal(state.disconnectedNow, true);
  assert.equal(state.connected, false);
});

test('gamepad: a pad that is plugged back in is reported as connected', () => {
  const state = updateGamepadState(
    { snapshot: readPad(null) },
    readPad(fakePad({ buttons: {} })),
    DEFAULT_PAD_BINDINGS,
  );
  assert.equal(state.connectedNow, true);
  assert.equal(state.connected, true);
});

test('gamepad: the state carries the analogue axes for the camera', () => {
  const state = updateGamepadState(null, readPad(fakePad({ axes: [0.9, 0, 0, 0] })), DEFAULT_PAD_BINDINGS);
  assert.equal(state.axes.panX, applyDeadZone(0.9));
  assert.ok(state.axes.panX > 0.8, 'a hard push still pans nearly fully');
});

// ---------------------------------------------------------------------------
// The binding table
// ---------------------------------------------------------------------------

test('gamepad: every pad action has a default binding', () => {
  for (const action of PAD_ACTIONS) {
    assert.ok(Array.isArray(DEFAULT_PAD_BINDINGS[action]), `${action} has no default binding`);
    assert.ok(DEFAULT_PAD_BINDINGS[action].length > 0, `${action} has an empty binding`);
  }
});

test('gamepad: the binding table finds the action for a button', () => {
  assert.equal(actionForButton(DEFAULT_PAD_BINDINGS, PAD_BUTTONS.A), 'menu.confirm');
  assert.equal(actionForButton(DEFAULT_PAD_BINDINGS, PAD_BUTTONS.B), 'menu.back');
  assert.equal(actionForButton(DEFAULT_PAD_BINDINGS, 99), null);
});

test('gamepad: the input map carries the pad bindings beside the key bindings', () => {
  const map = createInputMap();
  assert.deepEqual(map.padFor('menu.confirm'), [PAD_BUTTONS.A]);
  assert.equal(map.padActionFor(PAD_BUTTONS.DPAD_UP), 'menu.up');
  assert.equal(map.padActionFor(99), null);
  // The keyboard table is untouched.
  assert.deepEqual(map.get('camera.panUp'), ['KeyW', 'ArrowUp']);
});

test('gamepad: the input map can rebind and reset a pad action', () => {
  const map = createInputMap();
  assert.equal(map.applyPadOverrides({ 'menu.confirm': [7] }), true);
  assert.deepEqual(map.padFor('menu.confirm'), [7]);
  map.resetAll();
  assert.deepEqual(map.padFor('menu.confirm'), [PAD_BUTTONS.A]);
});

test('gamepad: a pad override for an unknown action is refused', () => {
  const map = createInputMap();
  assert.equal(map.applyPadOverrides({ 'menu.nonsense': [1] }), false);
});

test('gamepad: the standard axis indices are the ones the browser reports', () => {
  assert.equal(PAD_AXES.LEFT_X, 0);
  assert.equal(PAD_AXES.LEFT_Y, 1);
  assert.equal(PAD_AXES.RIGHT_X, 2);
  assert.equal(PAD_AXES.RIGHT_Y, 3);
});
