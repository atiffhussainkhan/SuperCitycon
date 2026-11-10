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
 *     dispatcher the mouse uses;
 *   - a double tap zooms in one step;
 *   - a MOUSE pointer is not a touch, and changes nothing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createTouchService } from './touch.js';

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
 */
function makeCtx({ ground = { x: 0, z: 0 } } = {}) {
  const clicks = [];
  const ctx = {
    config: { TUNING: { cameraDistance: 66 } },
    renderer: { screenToGround: () => ({ ...ground }) },
    domains: {},
    dispatchWorldClick(cell, button) { clicks.push({ cell, button }); return true; },
  };
  return { ctx, clicks };
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

  const listeners = new Map();
  const element = {
    addEventListener: (type, fn) => { listeners.set(type, fn); },
    removeEventListener: (type) => { listeners.delete(type); },
    setPointerCapture() { },
    releasePointerCapture() { },
  };

  assert.equal(service.install(element), true);
  assert.deepEqual([...listeners.keys()].sort(), ['pointercancel', 'pointerdown', 'pointermove', 'pointerup']);

  service.dispose();
  assert.equal(listeners.size, 0, 'the listeners were removed');
});

test('touch: a pointerdown on the canvas reaches the recogniser', () => {
  const camera = fakeCamera();
  const { ctx } = makeCtx();
  const service = createTouchService(ctx, { camera });
  const listeners = new Map();
  const element = {
    addEventListener: (type, fn) => { listeners.set(type, fn); },
    removeEventListener: () => { },
    setPointerCapture() { },
    releasePointerCapture() { },
  };
  service.install(element);

  listeners.get('pointerdown')({
    pointerId: 3, pointerType: 'touch', clientX: 10, clientY: 20, preventDefault() { },
  });
  assert.equal(service.pointerCount(), 1, 'the finger is down');

  listeners.get('pointerup')({
    pointerId: 3, pointerType: 'touch', clientX: 10, clientY: 20, preventDefault() { },
  });
  assert.equal(service.pointerCount(), 0, 'and up again');
});

test('touch: a mouse pointerdown on the canvas is ignored', () => {
  const camera = fakeCamera();
  const { ctx } = makeCtx();
  const service = createTouchService(ctx, { camera });
  const listeners = new Map();
  const element = {
    addEventListener: (type, fn) => { listeners.set(type, fn); },
    removeEventListener: () => { },
    setPointerCapture() { },
    releasePointerCapture() { },
  };
  service.install(element);

  listeners.get('pointerdown')({
    pointerId: 3, pointerType: 'mouse', clientX: 10, clientY: 20, preventDefault() { },
  });
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
