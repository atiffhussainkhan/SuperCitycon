/**
 * core/input-map.test.mjs — the one table of bindings.
 *
 * Run with:  node --test src/core/input-map.test.mjs
 *
 * The keyboard half of the table was tested through the settings panel; this
 * file covers the GAMEPAD half, which is the half the rebind screen writes
 * to: `padRebind` owns the rule that a button belongs to one action, and
 * `padLabel` is what the screen shows the player.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIONS,
  DEFAULT_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  PAD_ACTIONS,
  createInputMap,
  keyLabel,
  padLabel,
} from './input-map.js';
import { PAD_BUTTONS } from './gamepad.js';

// ---------------------------------------------------------------------------
// The two tables are separate
// ---------------------------------------------------------------------------

test('input-map: the keyboard and the gamepad are two tables', () => {
  const map = createInputMap();
  // A key binding never leaks into the pad table, and the other way round.
  assert.deepEqual(map.get('camera.panUp'), DEFAULT_BINDINGS['camera.panUp']);
  assert.deepEqual(map.padFor('camera.panUp'), [], 'the pad has no pan action');
  assert.deepEqual(map.padFor('menu.up'), DEFAULT_PAD_BINDINGS['menu.up']);
  assert.deepEqual(map.get('menu.up'), [], 'the keyboard has no menu.up binding');
});

test('input-map: the pad table holds an entry for every pad action', () => {
  const map = createInputMap();
  for (const action of PAD_ACTIONS) {
    assert.ok(action in DEFAULT_PAD_BINDINGS, `${action} has no default pad binding`);
    assert.ok(map.padFor(action).length > 0, `${action} is bound to no button`);
  }
});

// ---------------------------------------------------------------------------
// The labels
// ---------------------------------------------------------------------------

test('input-map: padLabel names the standard buttons', () => {
  assert.equal(padLabel(PAD_BUTTONS.A), 'A');
  assert.equal(padLabel(PAD_BUTTONS.B), 'B');
  assert.equal(padLabel(PAD_BUTTONS.RIGHT_BUMPER), 'right bumper');
  assert.equal(padLabel(PAD_BUTTONS.DPAD_UP), 'D-pad up');
});

test('input-map: padLabel never leaves the player without a name', () => {
  // A button the standard mapping does not cover still has to be NAMED:
  // the player pressed it, so the screen has to say what it was.
  assert.equal(padLabel(17), 'Button 17');
  assert.equal(padLabel(-1), '');
  assert.equal(padLabel('nope'), '');
});

test('input-map: keyLabel still names the keys', () => {
  assert.equal(keyLabel('KeyW'), 'W');
  assert.equal(keyLabel('ArrowUp'), '↑');
});

// ---------------------------------------------------------------------------
// Binding a pad button
// ---------------------------------------------------------------------------

test('input-map: a pad button can be bound to an action', () => {
  const map = createInputMap();
  assert.equal(map.padRebind('camera.reset', PAD_BUTTONS.RIGHT_BUMPER), true);
  assert.deepEqual(map.padFor('camera.reset'), [PAD_BUTTONS.RIGHT_BUMPER]);
});

test('input-map: binding a pad button takes it from the action that had it', () => {
  const map = createInputMap();
  // The right bumper zooms in by default. Binding it to zoom out must take
  // it away from zoom in, because the table is read first-match: a button
  // on two actions would leave the second one unreachable.
  assert.deepEqual(map.padFor('camera.zoomIn'), [PAD_BUTTONS.RIGHT_BUMPER]);
  map.padRebind('camera.zoomOut', PAD_BUTTONS.RIGHT_BUMPER);
  assert.deepEqual(map.padFor('camera.zoomOut'), [PAD_BUTTONS.RIGHT_BUMPER]);
  assert.deepEqual(map.padFor('camera.zoomIn'), [], 'the button has one owner');
});

test('input-map: a pad rebind refuses an action the pad does not have', () => {
  const map = createInputMap();
  assert.equal(map.padRebind('camera.panUp', PAD_BUTTONS.A), false);
  assert.equal(map.padRebind('not.an.action', PAD_BUTTONS.A), false);
  assert.deepEqual(map.padFor('camera.panUp'), []);
});

test('input-map: a pad rebind refuses an index that is not a button', () => {
  const map = createInputMap();
  assert.equal(map.padRebind('camera.reset', -1), false);
  assert.equal(map.padRebind('camera.reset', 1.5), false);
  assert.equal(map.padRebind('camera.reset', '5'), false);
  assert.deepEqual(map.padFor('camera.reset'), DEFAULT_PAD_BINDINGS['camera.reset']);
});

// ---------------------------------------------------------------------------
// Resetting
// ---------------------------------------------------------------------------

test('input-map: resetAll restores the default pad bindings too', () => {
  const map = createInputMap();
  map.padRebind('camera.reset', PAD_BUTTONS.Y);
  map.padRebind('game.pause', PAD_BUTTONS.X);
  assert.deepEqual(map.padFor('camera.reset'), [PAD_BUTTONS.Y]);

  map.resetAll();
  assert.deepEqual(map.padFor('camera.reset'), DEFAULT_PAD_BINDINGS['camera.reset']);
  assert.deepEqual(map.padFor('game.pause'), DEFAULT_PAD_BINDINGS['game.pause']);
  assert.deepEqual(map.get('camera.panUp'), DEFAULT_BINDINGS['camera.panUp']);
});

test('input-map: resetPadAction restores one pad action', () => {
  const map = createInputMap();
  map.padRebind('camera.reset', PAD_BUTTONS.Y);
  assert.equal(map.resetPadAction('camera.reset'), true);
  assert.deepEqual(map.padFor('camera.reset'), DEFAULT_PAD_BINDINGS['camera.reset']);
  assert.equal(map.resetPadAction('camera.panUp'), false);
});

// ---------------------------------------------------------------------------
// The stored override
// ---------------------------------------------------------------------------

test('input-map: a stored pad override is applied to the table', () => {
  const map = createInputMap({ padBindings: { 'camera.reset': [PAD_BUTTONS.Y] } });
  assert.deepEqual(map.padFor('camera.reset'), [PAD_BUTTONS.Y]);
  assert.deepEqual(map.padAll()['camera.reset'], [PAD_BUTTONS.Y]);
});

test('input-map: a stored pad override is applied to a live table', () => {
  const map = createInputMap();
  const changed = map.applyPadOverrides({ 'game.pause': [PAD_BUTTONS.X] });
  assert.equal(changed, true);
  assert.deepEqual(map.padFor('game.pause'), [PAD_BUTTONS.X]);
});

test('input-map: a stored pad override that is nonsense is ignored', () => {
  const map = createInputMap();
  const changed = map.applyPadOverrides({
    'camera.panUp': [PAD_BUTTONS.A],       // not a pad action
    'camera.reset': 'not an array',       // not a table
  });
  assert.equal(changed, false);
  assert.deepEqual(map.padFor('camera.reset'), DEFAULT_PAD_BINDINGS['camera.reset']);
});

test('input-map: the pad table never hands out its own arrays', () => {
  const map = createInputMap();
  const first = map.padFor('menu.confirm');
  first.push(99);
  assert.deepEqual(map.padFor('menu.confirm'), DEFAULT_PAD_BINDINGS['menu.confirm'],
    'the caller cannot edit the table through a copy');
});

test('input-map: the action list covers the actions the panel offers', () => {
  for (const action of ACTIONS) {
    assert.ok(action in DEFAULT_BINDINGS, `${action} has no default key binding`);
  }
});
