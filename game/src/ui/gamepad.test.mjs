/**
 * ui/gamepad.test.mjs — the gamepad service.
 *
 * OWNER: UX. Run with:  node --test src/ui/gamepad.test.mjs
 *
 * WHAT IS COVERED
 *   - the routing: the D-pad reaches the menu, the pause button opens the
 *     pause overlay, the camera gets the analogue axes;
 *   - the four rules the service promises:
 *       a held button fires once, a resting stick moves nothing, the camera
 *       is released under a modal, and an unplugged pad releases everything;
 *   - the connect / disconnect transitions.
 *
 * THE PAD HERE IS SIMULATED
 *   No physical controller was available in the build environment, so the
 *   service is driven with a fake `navigator.getGamepads()`. That proves the
 *   LOGIC; it does not prove the feel of real hardware. See
 *   `docs/V6_RELEASE_NOTES.md` for the honest statement.
 *
 * The pure rules (the dead zone, the edges, the axis maths) are covered in
 * `core/gamepad.test.mjs`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createGamepadService } from './gamepad.js';
import { DEFAULT_PAD_BINDINGS } from '../core/input-map.js';
import { PAD_BUTTONS } from '../core/gamepad.js';

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

/** A fake menu that records what the pad asked it to do. */
function fakeMenu({ open = false, view = 'main' } = {}) {
  const calls = [];
  let isOpen = open;
  let current = view;
  return {
    calls,
    isOpen: () => isOpen,
    view: () => current,
    open(which) { isOpen = true; current = which; calls.push(['open', which]); return true; },
    openView(which) { current = which; calls.push(['openView', which]); return true; },
    close() { isOpen = false; calls.push(['close']); return true; },
    handlePadAction(action) { calls.push(['action', action]); return true; },
    setPadHint(text) { calls.push(['hint', text]); return true; },
  };
}

/** A fake camera that records the axes it was given. */
function fakeCamera() {
  const calls = [];
  return {
    calls,
    state: { distance: 100, x: 0, z: 0, yaw: 0, pitch: 45 },
    setPadAxes(axes) { calls.push(axes); return axes; },
    reset() { calls.push(['reset']); return true; },
    zoomTo(d) { calls.push(['zoom', d]); return d; },
  };
}

/**
 * Build a service over a controllable pad.
 * @param {object} [opts]
 */
function build({ pad = null, menu = fakeMenu(), camera = fakeCamera(), capturing = false, panel = null } = {}) {
  let current = pad;
  const service = createGamepadService({ logger: null }, {
    menu,
    camera,
    settingsPanel: { isCapturing: () => capturing },
    getPads: () => (current ? [current] : []),
  });
  return {
    service,
    menu,
    camera,
    setPad(next) { current = next; },
    setPanel(next) { panel = next; },
  };
}

// ---------------------------------------------------------------------------
// The routing
// ---------------------------------------------------------------------------

test('gamepad: a D-pad press reaches the menu', () => {
  const menu = fakeMenu({ open: true });
  const h = build({ pad: fakePad({ buttons: {} }), menu });
  h.service.update(0.016);
  h.setPad(fakePad({ buttons: { [PAD_BUTTONS.DPAD_DOWN]: true } }));
  h.service.update(0.016);
  h.setPad(fakePad({ buttons: {} }));
  h.service.update(0.016);

  const actions = h.menu.calls.filter((c) => c[0] === 'action').map((c) => c[1]);
  assert.deepEqual(actions, ['menu.down'], 'the D-pad moved the menu focus');
});

test('gamepad: the menu only gets the press while it has the focus', () => {
  const h = build({ pad: fakePad({ buttons: { [PAD_BUTTONS.DPAD_DOWN]: true } }) });
  h.service.update(0.016);
  assert.equal(h.menu.calls.filter((c) => c[0] === 'action').length, 0,
    'a closed menu is not navigated');
});

test('gamepad: the pause button opens the pause overlay', () => {
  const h = build({ pad: fakePad({ buttons: { [PAD_BUTTONS.START]: true } }) });
  h.service.update(0.016);
  const opened = h.menu.calls.find((c) => c[0] === 'open');
  assert.deepEqual(opened, ['open', 'pause'], 'START opens the pause overlay');
});

test('gamepad: the pause button closes the pause overlay again', () => {
  const menu = fakeMenu({ open: true, view: 'pause' });
  const h = build({ pad: fakePad({ buttons: { [PAD_BUTTONS.START]: true } }), menu });
  h.service.update(0.016);
  assert.ok(h.menu.calls.some((c) => c[0] === 'close'), 'START resumes');
});

test('gamepad: the press that opens the menu does not also act on it', () => {
  const h = build({ pad: fakePad({ buttons: { [PAD_BUTTONS.START]: true, [PAD_BUTTONS.A]: true } }) });
  h.service.update(0.016);
  assert.equal(h.menu.calls.filter((c) => c[0] === 'action').length, 0,
    'the opening press never reaches the menu it just opened');
});

test('gamepad: the camera reset button resets the camera', () => {
  const h = build({ pad: fakePad({ buttons: { [PAD_BUTTONS.LEFT_STICK]: true } }) });
  h.service.update(0.016);
  assert.ok(h.camera.calls.some((c) => c[0] === 'reset'), 'the camera was reset');
});

// ---------------------------------------------------------------------------
// Rule 1: a held button fires once
// ---------------------------------------------------------------------------

test('gamepad: holding the confirm button does not confirm twice', () => {
  const h = build({ pad: fakePad({ buttons: { [PAD_BUTTONS.A]: true } }) });
  h.service.update(0.016);
  h.service.update(0.016);
  h.service.update(0.016);
  const actions = h.menu.calls.filter((c) => c[0] === 'action').map((c) => c[1]);
  assert.equal(actions.length, 0, 'the menu was closed, so no action was routed');

  const menu = fakeMenu({ open: true });
  const h2 = build({ pad: fakePad({ buttons: { [PAD_BUTTONS.A]: true } }), menu });
  h2.service.update(0.016);
  h2.service.update(0.016);
  h2.service.update(0.016);
  const routed = menu.calls.filter((c) => c[0] === 'action').map((c) => c[1]);
  assert.deepEqual(routed, ['menu.confirm'], 'the held button confirmed exactly once');
});

// ---------------------------------------------------------------------------
// Rule 3: a resting stick moves nothing
// ---------------------------------------------------------------------------

test('gamepad: a resting stick moves the camera not at all', () => {
  const h = build({ pad: fakePad({ axes: [0.05, -0.04, 0.03, 0] }) });
  h.service.update(0.016);
  const last = h.camera.calls[h.camera.calls.length - 1];
  assert.deepEqual(last, { panX: 0, panY: 0, rotate: 0, zoom: 0 },
    'a stick inside the dead zone contributes nothing');
});

test('gamepad: a deflected stick reaches the camera', () => {
  const h = build({ pad: fakePad({ axes: [0.9, 0, 0, 0] }) });
  h.service.update(0.016);
  const last = h.camera.calls[h.camera.calls.length - 1];
  assert.ok(last.panX > 0.8, `panX=${last.panX}`);
});

// ---------------------------------------------------------------------------
// Rule 2: the camera is released under a modal
// ---------------------------------------------------------------------------

test('gamepad: the camera is released while the menu has the focus', () => {
  const menu = fakeMenu({ open: true });
  const h = build({ pad: fakePad({ axes: [0.9, 0.9, 0, 0] }), menu });
  h.service.update(0.016);
  const last = h.camera.calls[h.camera.calls.length - 1];
  assert.deepEqual(last, { panX: 0, panY: 0, rotate: 0, zoom: 0 },
    'the camera does not move under the menu');
});

test('gamepad: the camera is released while a key capture is running', () => {
  const h = build({ pad: fakePad({ axes: [0.9, 0.9, 0, 0] }), capturing: true });
  h.service.update(0.016);
  const last = h.camera.calls[h.camera.calls.length - 1];
  assert.deepEqual(last, { panX: 0, panY: 0, rotate: 0, zoom: 0 },
    'a rebind capture owns the input');
});

// ---------------------------------------------------------------------------
// Rule 4: an unplugged pad releases everything
// ---------------------------------------------------------------------------

test('gamepad: an unplugged pad releases the axes it was holding', () => {
  const h = build({ pad: fakePad({ axes: [0.9, 0, 0, 0] }) });
  h.service.update(0.016);
  assert.ok(h.camera.calls[h.camera.calls.length - 1].panX > 0, 'the camera was panning');

  h.setPad(null);
  h.service.update(0.016);
  const last = h.camera.calls[h.camera.calls.length - 1];
  assert.deepEqual(last, { panX: 0, panY: 0, rotate: 0, zoom: 0 },
    'the camera stopped when the pad went away');
});

test('gamepad: a pad that is plugged back in is reported as connected', () => {
  const h = build({ pad: null });
  h.service.update(0.016);
  assert.equal(h.service.isConnected(), false);

  h.setPad(fakePad({ buttons: {} }));
  h.service.update(0.016);
  assert.equal(h.service.isConnected(), true);
  assert.equal(h.service.padId(), 'Test Pad (STANDARD GAMEPAD)');
});

test('gamepad: the menu is told when the pad arrives and leaves', () => {
  const h = build({ pad: null });
  h.service.update(0.016);
  h.setPad(fakePad({ buttons: {} }));
  h.service.update(0.016);
  assert.ok(h.menu.calls.some((c) => c[0] === 'hint' && c[1]), 'the pad hint appeared');

  h.setPad(null);
  h.service.update(0.016);
  const hints = h.menu.calls.filter((c) => c[0] === 'hint');
  assert.equal(hints[hints.length - 1][1], null, 'the pad hint went away');
});

// ---------------------------------------------------------------------------
// The service is defensive
// ---------------------------------------------------------------------------

test('gamepad: a browser without the Gamepad API is not an error', () => {
  const service = createGamepadService({}, {
    menu: fakeMenu(),
    camera: fakeCamera(),
    getPads: () => null,
  });
  const state = service.update(0.016);
  assert.ok(state, 'the service still reports a state');
  assert.equal(state.connected, false);
});

test('gamepad: a pad list that throws is not an error', () => {
  const service = createGamepadService({}, {
    menu: fakeMenu(),
    camera: fakeCamera(),
    getPads: () => { throw new Error('no permission'); },
  });
  assert.doesNotThrow(() => service.update(0.016));
  assert.equal(service.isConnected(), false);
});

test('gamepad: the default bindings are used when the game published none', () => {
  const service = createGamepadService({}, {
    menu: fakeMenu(),
    camera: fakeCamera(),
    getPads: () => [fakePad({ buttons: { [PAD_BUTTONS.DPAD_DOWN]: true } })],
  });
  service.update(0.016);
  assert.equal(DEFAULT_PAD_BINDINGS['menu.down'][0], PAD_BUTTONS.DPAD_DOWN,
    'the default table maps the D-pad down');
});
