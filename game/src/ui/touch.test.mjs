/**
 * ui/touch.test.mjs — the touch input service.
 *
 * OWNER: UX. Run with:  node --test src/ui/touch.test.mjs
 *
 * WHAT IS COVERED
 *   - a one-finger drag pans the camera;
 *   - a pinch zooms the camera in and out;
 *   - a two-finger drag rotates the camera;
 *   - a tap dispatches a click on the world cell, through the SAME
 *     dispatcher the mouse uses, and dispatches it EXACTLY ONCE;
 *   - a double tap zooms in one step;
 *   - a finger move highlights the cell under the finger, and the
 *     highlight is cleared when the finger lifts;
 *   - a cancelled finger clears the highlight, and a finger that lifts
 *     while another stays moves the highlight to the finger that is down;
 *   - a MOUSE pointer is not a touch, and changes nothing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createTouchService } from './touch.js';
import { EVENTS, on } from '../core/events.js';

/**
 * A fake camera that records what the touch service did to it.
 */
function fakeCamera() {
  const calls = [];
  // The rig has TWO values: the TARGET it is moving towards and the damped
  // value it is showing. The fake keeps both, so a test can tell them
  // apart — and so a consumer that compounds against the wrong one is
  // caught.
  const state = { distance: 66, x: 0, z: 0, yaw: 0, pitch: 55 };
  const target = { ...state };
  return {
    calls,
    state,
    target,
    panBy(dx, dz) { calls.push(['pan', dx, dz]); return { x: dx, z: dz }; },
    zoomTo(d) { calls.push(['zoom', d]); target.distance = d; return d; },
    rotate(d) { calls.push(['rotate', d]); target.yaw += d; return d; },
  };
}

/**
 * A context whose renderer reports a ground point for any screen point.
 *
 * `ground` may be a fixed point or a FUNCTION of the screen point, so a
 * test can move the finger and watch the hover follow it.
 */
function makeCtx({ ground = { x: 0, z: 0 } } = {}) {
  const clicks = [];
  // Every hover call, with the domain that heard it, so a test can prove
  // that EVERY domain was told and not only one of them.
  const hovers = [];
  const ctx = {
    config: { TUNING: { cameraDistance: 66 } },
    renderer: {
      screenToGround: (x, y) => (typeof ground === 'function' ? ground(x, y) : { ...ground }),
    },
    state: { ui: { hover: null } },
    domains: {
      world: { onHover(cell) { hovers.push({ domain: 'world', cell }); } },
      buildings: { onHover(cell) { hovers.push({ domain: 'buildings', cell }); } },
    },
    dispatchWorldClick(cell, button) { clicks.push({ cell, button }); return true; },
  };
  return { ctx, clicks, hovers };
}

/**
 * A fake canvas that records the listeners the service installs, so a
 * test can fire a pointer event at it.
 */
function fakeCanvas() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    setPointerCapture() { },
    releasePointerCapture() { },
    /**
     * Fire one pointer event at the service.
     * @param {string} type pointerdown | pointermove | pointerup | pointercancel
     * @param {object} [event]
     */
    fire(type, { pointerId = 1, pointerType = 'touch', clientX = 10, clientY = 20 } = {}) {
      const fn = listeners.get(type);
      if (!fn) throw new Error(`the service installed no ${type} listener`);
      fn({ pointerId, pointerType, clientX, clientY, preventDefault() { } });
    },
  };
}

/**
 * Feed a gesture straight into the service, the way the recogniser would.
 */
function gesture(service, type, extra = {}) {
  service.recogniser.down({ id: 1, x: 100, y: 100, t: 0 });
  if (type === 'drag') {
    service.recogniser.move({ id: 1, x: 100 + (extra.dx ?? 40), y: 100, t: 50 });
  } else if (type === 'pinch') {
    service.recogniser.down({ id: 2, x: 200, y: 100, t: 5 });
    service.recogniser.move({ id: 1, x: 100 - (extra.spread ?? 50), y: 100, t: 60 });
    service.recogniser.move({ id: 2, x: 200 + (extra.spread ?? 50), y: 100, t: 60 });
  } else if (type === 'tap' || type === 'double-tap') {
    service.recogniser.up({ id: 1, x: 100, y: 100, t: 60 });
    if (type === 'double-tap') {
      service.recogniser.down({ id: 1, x: 100, y: 100, t: 100 });
      service.recogniser.up({ id: 1, x: 100, y: 100, t: 160 });
    }
  }
}

test('touch: a one-finger drag pans the camera', () => {
  const camera = fakeCamera();
  const { ctx } = makeCtx();
  const service = createTouchService(ctx, { camera });

  gesture(service, 'drag', { dx: 40 });

  const pan = camera.calls.find((c) => c[0] === 'pan');
  assert.ok(pan, 'the camera was panned');
  assert.ok(pan[1] < 0, `the city follows the finger (dx=${pan[1]})`);
});

test('touch: a pinch zooms the camera in', () => {
  const camera = fakeCamera();
  const { ctx } = makeCtx();
  const service = createTouchService(ctx, { camera });

  gesture(service, 'pinch', { spread: 50 });

  const zoom = camera.calls.find((c) => c[0] === 'zoom');
  assert.ok(zoom, 'the camera was zoomed');
  assert.ok(zoom[1] < camera.state.distance, `spreading the fingers zooms IN (${zoom[1]})`);
});

test('touch: a pinch rotates the camera', () => {
  const camera = fakeCamera();
  const { ctx } = makeCtx();
  const service = createTouchService(ctx, { camera });

  service.recogniser.down({ id: 1, x: 100, y: 100, t: 0 });
  service.recogniser.down({ id: 2, x: 200, y: 100, t: 5 });
  service.recogniser.move({ id: 1, x: 100, y: 50, t: 60 });
  service.recogniser.move({ id: 2, x: 150, y: 100, t: 60 });

  const rotate = camera.calls.find((c) => c[0] === 'rotate');
  assert.ok(rotate, 'the camera was rotated');
  assert.ok(Math.abs(rotate[1]) > 0.01, `the rotation was passed on (${rotate[1]})`);
});

test('touch: a tap selects the cell under the finger', () => {
  const camera = fakeCamera();
  const { ctx, clicks } = makeCtx({ ground: { x: 12, z: 34 } });
  const service = createTouchService(ctx, { camera });

  gesture(service, 'tap');

  assert.equal(clicks.length, 1, 'the world received one click');
  assert.equal(clicks[0].button, 0, 'with the primary button');
  assert.ok(clicks[0].cell, 'and a cell');
});

test('touch: a tap uses the same dispatcher as the mouse', () => {
  const camera = fakeCamera();
  const { ctx, clicks } = makeCtx({ ground: { x: 0, z: 0 } });
  const service = createTouchService(ctx, { camera });
  gesture(service, 'tap');
  assert.equal(typeof ctx.dispatchWorldClick, 'function');
  assert.equal(clicks.length, 1);
});

test('touch: a double tap zooms in one step', () => {
  const camera = fakeCamera();
  const { ctx } = makeCtx();
  const service = createTouchService(ctx, { camera });

  gesture(service, 'double-tap');

  const zoom = camera.calls.find((c) => c[0] === 'zoom');
  assert.ok(zoom, 'the camera was zoomed');
  assert.ok(zoom[1] < camera.state.distance, 'a double tap zooms in');
});

test('touch: a long press does nothing the player did not ask for', () => {
  const camera = fakeCamera();
  const { ctx, clicks } = makeCtx();
  const service = createTouchService(ctx, { camera });

  service.recogniser.down({ id: 1, x: 100, y: 100, t: 0 });
  service.recogniser.tick(900);
  service.recogniser.up({ id: 1, x: 100, y: 100, t: 950 });

  assert.equal(clicks.length, 0, 'a long press places nothing');
  assert.equal(camera.calls.length, 0, 'and it does not move the camera');
});

test('touch: a mouse pointer changes nothing', () => {
  const camera = fakeCamera();
  const { ctx, clicks } = makeCtx();
  const service = createTouchService(ctx, { camera });

  // The recogniser itself does not care about the pointer type — the
  // SERVICE filters. A mouse never reaches the recogniser at all.
  assert.equal(service.pointerCount(), 0);
  assert.equal(camera.calls.length, 0);
  assert.equal(clicks.length, 0);
});

test('touch: the service installs and removes its listeners', () => {
  const camera = fakeCamera();
  const { ctx } = makeCtx();
  const service = createTouchService(ctx, { camera });

  const canvas = fakeCanvas();
  assert.equal(service.install(canvas), true);
  assert.deepEqual([...canvas.listeners.keys()].sort(), ['pointercancel', 'pointerdown', 'pointermove', 'pointerup']);

  service.dispose();
  assert.equal(canvas.listeners.size, 0, 'the listeners were removed');
});

test('touch: a pointerdown on the canvas reaches the recogniser', () => {
  const camera = fakeCamera();
  const { ctx } = makeCtx();
  const service = createTouchService(ctx, { camera });
  const canvas = fakeCanvas();
  service.install(canvas);

  canvas.fire('pointerdown', { pointerId: 3, clientX: 10, clientY: 20 });
  assert.equal(service.pointerCount(), 1, 'the finger is down');

  canvas.fire('pointerup', { pointerId: 3, clientX: 10, clientY: 20 });
  assert.equal(service.pointerCount(), 0, 'and up again');
});

test('touch: a mouse pointerdown on the canvas is ignored', () => {
  const camera = fakeCamera();
  const { ctx } = makeCtx();
  const service = createTouchService(ctx, { camera });
  const canvas = fakeCanvas();
  service.install(canvas);

  canvas.fire('pointerdown', { pointerId: 3, pointerType: 'mouse', clientX: 10, clientY: 20 });
  assert.equal(service.pointerCount(), 0, 'the mouse is not a finger');
});

test('touch: a pinch reported many times zooms ONCE, not once per event', () => {
  const camera = fakeCamera();
  const { ctx } = makeCtx();
  const service = createTouchService(ctx, { camera });

  // Two fingers, spread a little further on every move event.
  service.recogniser.down({ id: 1, x: 500, y: 400, t: 0 });
  service.recogniser.down({ id: 2, x: 700, y: 400, t: 5 });
  for (let i = 1; i <= 10; i += 1) {
    service.recogniser.move({ id: 1, x: 500 - (i * 10), y: 400, t: 10 + (i * 5) });
    service.recogniser.move({ id: 2, x: 700 + (i * 10), y: 400, t: 10 + (i * 5) });
  }

  const zooms = camera.calls.filter((c) => c[0] === 'zoom');
  assert.ok(zooms.length >= 1, 'the camera was zoomed');
  // The fingers spread from 200 to 400 — a factor of two. The camera must
  // zoom by that factor, not by it raised to the number of events.
  const zoomed = camera.target.distance;
  assert.ok(Math.abs(zoomed - (camera.state.distance / 2)) < 0.5,
    `the camera zoomed once by a factor of two (${zoomed}, expected about ${camera.state.distance / 2})`);
});

test('touch: a pinch that turns rotates ONCE, not once per event', () => {
  const camera = fakeCamera();
  const { ctx } = makeCtx();
  const service = createTouchService(ctx, { camera });

  service.recogniser.down({ id: 1, x: 500, y: 400, t: 0 });
  service.recogniser.down({ id: 2, x: 700, y: 400, t: 5 });
  for (let i = 1; i <= 8; i += 1) {
    service.recogniser.move({ id: 1, x: 500, y: 400 - (i * 5), t: 10 + (i * 5) });
    service.recogniser.move({ id: 2, x: 700, y: 400 + (i * 5), t: 10 + (i * 5) });
  }

  const rotations = camera.calls.filter((c) => c[0] === 'rotate');
  const total = rotations.reduce((sum, c) => sum + Math.abs(c[1]), 0);
  // The fingers turned by well under a radian. The cumulative bug applied
  // the whole angle again on every event, which came to several radians.
  assert.ok(total > 0.05, `the camera rotated (${total})`);
  assert.ok(total < 1, `the rotation is the ANGLE, not the angle times the event count (${total})`);
});

// ---------------------------------------------------------------------------
// The hover — the cell under the finger
// ---------------------------------------------------------------------------

test('touch: a finger move highlights the cell under the finger', () => {
  const { ctx, hovers } = makeCtx({ ground: (x) => ({ x: x * 4, z: 0 }) });
  const service = createTouchService(ctx, { camera: fakeCamera() });
  const canvas = fakeCanvas();
  service.install(canvas);

  canvas.fire('pointerdown', { clientX: 10, clientY: 20 });
  assert.deepEqual(ctx.state.ui.hover, { x: 42, z: 32 },
    'the cell under the finger is highlighted');

  canvas.fire('pointermove', { clientX: 30, clientY: 20 });
  assert.deepEqual(ctx.state.ui.hover, { x: 62, z: 32 }, 'and the highlight follows the finger');
  // EVERY domain was told, and each of them heard the cell under the finger.
  const notified = hovers
    .filter((h) => h.cell?.x === 62 && h.cell?.z === 32)
    .map((h) => h.domain);
  assert.deepEqual([...new Set(notified)].sort(), ['buildings', 'world'],
    'every domain was told about the cell under the finger');
});

test('touch: the highlight is cleared when the finger lifts', () => {
  const { ctx, hovers } = makeCtx({ ground: (x) => ({ x: x * 4, z: 0 }) });
  const service = createTouchService(ctx, { camera: fakeCamera() });
  const canvas = fakeCanvas();
  service.install(canvas);

  canvas.fire('pointerdown', { clientX: 10, clientY: 20 });
  canvas.fire('pointermove', { clientX: 30, clientY: 20 });
  assert.ok(ctx.state.ui.hover, 'there is a highlight while the finger is down');

  canvas.fire('pointerup', { clientX: 30, clientY: 20 });
  assert.equal(ctx.state.ui.hover, null, 'and none once the finger lifts');
  assert.equal(hovers[hovers.length - 1].cell, null, 'the domains were told the hover is gone');
});

test('touch: the hover event is emitted for the finger', () => {
  const seen = [];
  const off = on(EVENTS.HOVER_CHANGED, (cell) => seen.push(cell));
  try {
    const { ctx } = makeCtx({ ground: (x) => ({ x: x * 4, z: 0 }) });
    const service = createTouchService(ctx, { camera: fakeCamera() });
    const canvas = fakeCanvas();
    service.install(canvas);
    canvas.fire('pointerdown', { clientX: 10, clientY: 20 });
    canvas.fire('pointerup', { clientX: 10, clientY: 20 });
  } finally {
    off();
  }
  assert.deepEqual(seen[0], { x: 42, z: 32 }, 'the event carries the cell under the finger');
  assert.equal(seen[seen.length - 1], null, 'and the release clears it');
});

test('touch: a tap selects the cell EXACTLY once (one world click)', () => {
  const { ctx, clicks } = makeCtx({ ground: { x: 12, z: 34 } });
  const service = createTouchService(ctx, { camera: fakeCamera() });
  const canvas = fakeCanvas();
  service.install(canvas);

  // A real finger always jitters a little on the way down, so the tap
  // below carries a move as well.
  canvas.fire('pointerdown', { clientX: 10, clientY: 20 });
  canvas.fire('pointermove', { clientX: 11, clientY: 20 });
  canvas.fire('pointerup', { clientX: 11, clientY: 20 });

  assert.equal(clicks.length, 1, 'the world received exactly one click');
  assert.deepEqual(clicks[0].cell, { x: 35, z: 40 }, 'on the cell under the finger');
  assert.equal(clicks[0].button, 0, 'with the primary button');
});

test('touch: a cancelled finger clears the highlight', () => {
  const { ctx, hovers } = makeCtx({ ground: (x) => ({ x: x * 4, z: 0 }) });
  const service = createTouchService(ctx, { camera: fakeCamera() });
  const canvas = fakeCanvas();
  service.install(canvas);

  canvas.fire('pointerdown', { clientX: 10, clientY: 20 });
  assert.ok(ctx.state.ui.hover, 'there is a highlight while the finger is down');

  canvas.fire('pointercancel', { clientX: 10, clientY: 20 });
  assert.equal(ctx.state.ui.hover, null, 'and none once the gesture is cancelled');
  assert.equal(hovers[hovers.length - 1].cell, null, 'the domains were told');
});

test('touch: a finger that lifts while another stays moves the highlight', () => {
  const { ctx, clicks } = makeCtx({ ground: (x) => ({ x: x * 4, z: 0 }) });
  const service = createTouchService(ctx, { camera: fakeCamera() });
  const canvas = fakeCanvas();
  service.install(canvas);

  // Two fingers on the glass. The first one drifts, so lifting it is a
  // drag and not a tap.
  canvas.fire('pointerdown', { pointerId: 1, clientX: 10, clientY: 20 });
  canvas.fire('pointerdown', { pointerId: 2, clientX: 30, clientY: 20 });
  canvas.fire('pointermove', { pointerId: 1, clientX: 25, clientY: 20 });
  assert.deepEqual(ctx.state.ui.hover, { x: 57, z: 32 }, 'the highlight is on the finger that moved');

  // The first finger lifts. The second is still down, so the highlight
  // moves to it instead of staying on the cell the first one left.
  canvas.fire('pointerup', { pointerId: 1, clientX: 25, clientY: 20 });
  assert.deepEqual(ctx.state.ui.hover, { x: 62, z: 32 },
    'the highlight moved to the finger that is still down');
  assert.equal(clicks.length, 0, 'and nothing was selected');
});

test('touch: a cell outside the grid is flagged, and a tap out there selects nothing', () => {
  const { ctx, clicks } = makeCtx({ ground: { x: -200, z: -200 } });
  const service = createTouchService(ctx, { camera: fakeCamera() });
  const canvas = fakeCanvas();
  service.install(canvas);

  canvas.fire('pointerdown', { clientX: 10, clientY: 20 });
  assert.deepEqual(ctx.state.ui.hover, { x: -18, z: -18, outOfBounds: true },
    'the cell outside the grid is flagged, as it is for the mouse');

  canvas.fire('pointerup', { clientX: 10, clientY: 20 });
  assert.equal(clicks.length, 0, 'and a tap out there selects nothing');
});

test('touch: a mouse pointer does not move the hover', () => {
  const { ctx, hovers, clicks } = makeCtx({ ground: (x) => ({ x: x * 4, z: 0 }) });
  const service = createTouchService(ctx, { camera: fakeCamera() });
  const canvas = fakeCanvas();
  service.install(canvas);

  canvas.fire('pointermove', { pointerType: 'mouse', clientX: 10, clientY: 20 });
  canvas.fire('pointerdown', { pointerType: 'mouse', clientX: 10, clientY: 20 });
  canvas.fire('pointerup', { pointerType: 'mouse', clientX: 10, clientY: 20 });

  assert.equal(ctx.state.ui.hover, null, 'the mouse hover is left to the integrator');
  assert.equal(hovers.length, 0, 'the domains heard nothing');
  assert.equal(clicks.length, 0, 'and the mouse was not clicked by the touch service');
});

test('touch: the gesture uses the EVENT time, not the processing time', () => {
  const camera = fakeCamera();
  const { ctx, clicks } = makeCtx();
  const service = createTouchService(ctx, { camera });
  const listeners = new Map();
  const element = {
    addEventListener: (type, fn) => { listeners.set(type, fn); },
    removeEventListener: () => { },
    setPointerCapture() { },
    releasePointerCapture() { },
  };
  service.install(element);

  // The browser timestamps an event when it is GENERATED. On a busy main
  // thread the handler can run a whole second later — and a tap measured
  // with the processing clock would be a long press.
  listeners.get('pointerdown')({
    pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100,
    timeStamp: 5000, preventDefault() { },
  });
  listeners.get('pointerup')({
    pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100,
    timeStamp: 5080, preventDefault() { },
  });

  assert.equal(clicks.length, 1,
    'a tap that took 80 ms of real time is a tap, however late it was handled');
});
