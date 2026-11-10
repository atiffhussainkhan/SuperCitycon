/**
 * core/touch.test.mjs — the gesture recogniser.
 *
 * OWNER: the integrator (core/). Run with:  node --test src/core/touch.test.mjs
 *
 * WHAT IS COVERED
 *   - the tap, the double-tap and the long press;
 *   - the drag, with a velocity;
 *   - the pinch, with a scale and a rotation;
 *   - FRAME-RATE INDEPENDENCE — the same gesture at 30 Hz and at 144 Hz;
 *   - the malformed input (a NaN coordinate must not throw and must not
 *     produce a gesture).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { TOUCH_DEFAULTS, createGestureRecogniser, isTouchPointer } from './touch.js';

/**
 * A recogniser that records the gestures it emits.
 */
function recorder(options = {}) {
  const gestures = [];
  const recogniser = createGestureRecogniser({
    ...options,
    onGesture: (gesture) => gestures.push(gesture),
  });
  return { gestures, recogniser };
}

/** The types of the recorded gestures. */
function types(gestures) {
  return gestures.map((g) => g.type);
}

test('touch: a quick touch that did not move is a tap', () => {
  const { gestures, recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.up({ id: 1, x: 101, y: 201, t: 80 });
  assert.deepEqual(types(gestures), ['tap']);
  assert.equal(gestures[0].x, 101);
});

test('touch: a touch that moved is a drag, not a tap', () => {
  const { gestures, recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.move({ id: 1, x: 140, y: 200, t: 50 });
  recogniser.up({ id: 1, x: 160, y: 200, t: 100 });
  assert.deepEqual(types(gestures), ['drag']);
  assert.ok(!types(gestures).includes('tap'), 'a drag never also taps');
});

test('touch: two taps in quick succession are a double-tap', () => {
  const { gestures, recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.up({ id: 1, x: 100, y: 200, t: 60 });
  recogniser.down({ id: 1, x: 102, y: 202, t: 120 });
  recogniser.up({ id: 1, x: 102, y: 202, t: 180 });
  assert.deepEqual(types(gestures), ['tap', 'double-tap']);
});

test('touch: two slow taps are two taps, not a double-tap', () => {
  const { gestures, recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.up({ id: 1, x: 100, y: 200, t: 60 });
  recogniser.down({ id: 1, x: 100, y: 200, t: 900 });
  recogniser.up({ id: 1, x: 100, y: 200, t: 960 });
  assert.deepEqual(types(gestures), ['tap', 'tap']);
});

test('touch: a touch held still is a long press', () => {
  const { gestures, recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.tick(600);
  assert.deepEqual(types(gestures), ['long-press']);
  recogniser.up({ id: 1, x: 100, y: 200, t: 700 });
  assert.deepEqual(types(gestures), ['long-press'], 'and it does not also tap');
});

test('touch: a finger that moves does not long-press', () => {
  const { gestures, recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.move({ id: 1, x: 140, y: 200, t: 100 });
  recogniser.tick(600);
  assert.deepEqual(types(gestures), ['drag'], 'the long press never fired');
});

test('touch: a long press is recognised on the release too', () => {
  const { gestures, recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.up({ id: 1, x: 100, y: 200, t: 900 });
  assert.deepEqual(types(gestures), ['long-press']);
});

test('touch: a drag reports a velocity', () => {
  const { gestures, recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.move({ id: 1, x: 120, y: 200, t: 100 });
  const drag = gestures[gestures.length - 1];
  assert.equal(drag.type, 'drag');
  assert.equal(drag.dx, 20);
  assert.equal(drag.dy, 0);
  assert.ok(drag.vx > 0, `the velocity is positive (${drag.vx})`);
});

test('touch: two fingers are a pinch with a scale', () => {
  const { gestures, recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.down({ id: 2, x: 200, y: 200, t: 10 });
  recogniser.move({ id: 1, x: 50, y: 200, t: 60 });
  recogniser.move({ id: 2, x: 250, y: 200, t: 60 });

  const pinch = gestures.filter((g) => g.type === 'pinch');
  assert.ok(pinch.length >= 1, 'a pinch was recognised');
  const last = pinch[pinch.length - 1];
  assert.ok(last.scale > 1, `the fingers spread, so the scale grew (${last.scale})`);
});

test('touch: two fingers turning are a pinch with a rotation', () => {
  const { gestures, recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.down({ id: 2, x: 200, y: 200, t: 10 });
  // Rotate the pair by a quarter turn.
  recogniser.move({ id: 1, x: 100, y: 150, t: 60 });
  recogniser.move({ id: 2, x: 150, y: 100, t: 60 });

  const pinch = gestures.filter((g) => g.type === 'pinch');
  const last = pinch[pinch.length - 1];
  assert.ok(Math.abs(last.rotation) > 0.1, `the rotation was reported (${last.rotation})`);
});

test('touch: two fingers do not also drag', () => {
  const { gestures, recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.down({ id: 2, x: 200, y: 200, t: 10 });
  recogniser.move({ id: 1, x: 60, y: 200, t: 60 });
  assert.equal(types(gestures).includes('drag'), false, 'a pinch is not a drag');
});

test('touch: the gesture is the SAME at 30 Hz and at 144 Hz', () => {
  // The same physical gesture — a touch held for 600 ms — sampled at two
  // different frame rates.
  const slow = recorder();
  slow.recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  for (let t = 33; t <= 600; t += 33) slow.recogniser.tick(t);
  slow.recogniser.up({ id: 1, x: 100, y: 200, t: 600 });

  const fast = recorder();
  fast.recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  for (let t = 7; t <= 600; t += 7) fast.recogniser.tick(t);
  fast.recogniser.up({ id: 1, x: 100, y: 200, t: 600 });

  assert.deepEqual(types(slow.gestures), types(fast.gestures),
    'the frame rate changed the gesture');
  assert.deepEqual(types(slow.gestures), ['long-press']);
});

test('touch: the thresholds are published and sane', () => {
  assert.ok(TOUCH_DEFAULTS.tapMs > 0);
  assert.ok(TOUCH_DEFAULTS.longPressMs > TOUCH_DEFAULTS.tapMs,
    'a long press is longer than a tap');
  assert.ok(TOUCH_DEFAULTS.movePx > 0);
});

test('touch: malformed input does not throw and produces nothing', () => {
  const { gestures, recogniser } = recorder();
  assert.doesNotThrow(() => {
    recogniser.down({ id: 1, x: NaN, y: 0, t: 0 });
    recogniser.move({ id: 1, x: 0, y: Infinity, t: 0 });
    recogniser.up({ id: 1, x: 0, y: 0, t: undefined });
    recogniser.tick(NaN);
    recogniser.cancel({ id: 9 });
    recogniser.down(null);
  });
  assert.deepEqual(gestures, [], 'no gesture was produced');
});

test('touch: a move for a finger that is not down is ignored', () => {
  const { gestures, recogniser } = recorder();
  recogniser.move({ id: 7, x: 10, y: 10, t: 0 });
  recogniser.up({ id: 7, x: 10, y: 10, t: 10 });
  assert.deepEqual(gestures, []);
});

test('touch: a cancelled finger leaves nothing behind', () => {
  const { gestures, recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.cancel({ id: 1, x: 100, y: 200, t: 50 });
  assert.equal(recogniser.pointerCount(), 0);
  recogniser.up({ id: 1, x: 100, y: 200, t: 60 });
  assert.deepEqual(gestures, [], 'the cancelled touch produced nothing');
});

test('touch: a reset forgets every pointer', () => {
  const { recogniser } = recorder();
  recogniser.down({ id: 1, x: 100, y: 200, t: 0 });
  recogniser.down({ id: 2, x: 300, y: 200, t: 0 });
  recogniser.reset();
  assert.equal(recogniser.pointerCount(), 0);
});

test('touch: a mouse is not a touch', () => {
  assert.equal(isTouchPointer({ pointerType: 'touch' }), true);
  assert.equal(isTouchPointer({ pointerType: 'pen' }), true);
  assert.equal(isTouchPointer({ pointerType: 'mouse' }), false);
  assert.equal(isTouchPointer({}), false);
});
