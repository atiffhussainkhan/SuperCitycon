/**
 * ui/navigation-debug.test.mjs — the navigation debug panel, tested.
 *
 * WHAT IS COVERED
 *   The PURE model (`describeRoute`): a successful route, EVERY reason the
 *   pathfinder can return, an unknown reason, and garbage input.
 *
 *   The PROJECTION (`projectWorldToScreen`): a world point lands exactly
 *   where the camera matrices say it should, and a point behind the camera
 *   is refused rather than drawn mirrored.
 *
 *   The SERVICE (`createNavigationDebug`): off by default, `show` records,
 *   `clear` forgets, `state()` is a snapshot. The DOM parts run against a
 *   TINY SHIM — there is no jsdom in this project, and adding a dependency
 *   is not this domain's call. The model needs no DOM at all.
 *
 * WHAT IS NOT COVERED
 *   How the panel LOOKS. A test can prove the panel says the right thing;
 *   it cannot prove the panel is readable on a real screen.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CELL, cellToWorld } from '../core/config.js';
import {
  REASON_TEXT,
  createNavigationDebug,
  describeRoute,
  projectWorldToScreen,
  reasonTextFor,
} from './navigation-debug.js';

// --------------------------------------------------------------------------
// A tiny DOM shim — enough for the panel, not a browser
// --------------------------------------------------------------------------

/**
 * A minimal element.
 *
 * @param {string} tag
 * @returns {object} the element
 */
function makeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    style: {},
    children: [],
    className: '',
    attributes: {},
    parentElement: null,
    appendChild(child) {
      child.parentElement = el;
      el.children.push(child);
      return child;
    },
    removeChild(child) {
      const i = el.children.indexOf(child);
      if (i >= 0) el.children.splice(i, 1);
      child.parentElement = null;
      return child;
    },
    setAttribute(name, value) { el.attributes[name] = String(value); },
    getAttribute(name) { return el.attributes[name]; },
  };
  let text = '';
  Object.defineProperty(el, 'textContent', {
    get() { return text; },
    set(value) {
      text = String(value);
      // Setting the text of a container empties it, like the real DOM.
      if (text === '') el.children.length = 0;
    },
  });
  return el;
}

/** A document with just enough of the API for the panel. */
function makeDocument() {
  return {
    body: makeElement('body'),
    createElement: (tag) => makeElement(tag),
    createElementNS: (_ns, tag) => makeElement(tag),
  };
}

/** A canvas stand-in with a rectangle. */
function makeCanvas(rect = { left: 0, top: 0, width: 800, height: 600 }) {
  return { getBoundingClientRect: () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height }) };
}

/** Every text in an element and its children, joined. */
function allText(el) {
  if (!el) return '';
  const own = typeof el.textContent === 'string' ? el.textContent : '';
  return [own, ...el.children.map(allText)].join(' ');
}

// --------------------------------------------------------------------------
// The model
// --------------------------------------------------------------------------

test('describeRoute: a successful route reports its cells, points, length and reason', () => {
  const result = {
    ok: true,
    path: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }],
    cost: 2,
    visited: 3,
    reason: 'found',
  };
  const model = describeRoute(result);

  assert.equal(model.ok, true);
  assert.equal(model.reason, 'found');
  assert.equal(model.cells.length, 3);
  assert.deepEqual(model.cells[1], { x: 1, z: 0 });
  assert.equal(model.cost, 2);
  assert.equal(model.visited, 3);

  // The world points come from `cellToWorld` — never from an invented
  // constant — so the panel cannot drift from the city's own geometry.
  assert.deepEqual(model.points[0], cellToWorld(0, 0));
  assert.deepEqual(model.points[2], cellToWorld(2, 0));
  assert.equal(model.points[0].x, -126);
  assert.equal(model.points[0].z, -126);

  // Three cells in a line is two steps of one cell each.
  assert.equal(model.length, 2 * CELL);
  assert.equal(model.length, 8);

  assert.match(model.reasonText, /Route found/);
});

test('describeRoute: a diagonal step is longer than a straight one', () => {
  const model = describeRoute({
    ok: true,
    path: [{ x: 0, z: 0 }, { x: 1, z: 1 }],
    cost: Math.SQRT2,
    visited: 2,
    reason: 'found',
  });
  assert.equal(model.cells.length, 2);
  assert.equal(model.length, Math.hypot(CELL, CELL));
});

test('describeRoute: every failure reason gets its own explanation', () => {
  const cases = [
    ['trivial', /already there/],
    ['blocked-goal', /blocked/],
    ['unreachable', /walled off/],
    ['budget', /budget/],
    ['out-of-bounds', /outside the city grid/],
    ['invalid-endpoint', /not a usable cell/],
    ['no-grid', /No navigation grid/],
  ];
  for (const [reason, pattern] of cases) {
    const model = describeRoute({ ok: false, path: null, cost: 0, visited: 0, reason });
    assert.equal(model.ok, false, `${reason}: should not be ok`);
    assert.equal(model.reason, reason);
    assert.match(model.reasonText, pattern, `${reason}: "${model.reasonText}"`);
    assert.equal(model.cells.length, 0);
    assert.equal(model.points.length, 0);
    assert.equal(model.length, 0);
  }

  // Every reason `findPath()` can return has a sentence of its own.
  for (const reason of Object.keys(REASON_TEXT)) {
    assert.equal(typeof REASON_TEXT[reason], 'string');
    assert.ok(REASON_TEXT[reason].length > 0);
  }
});

test('describeRoute: an unknown reason is said out loud, not hidden', () => {
  const model = describeRoute({ ok: false, path: null, cost: 0, visited: 0, reason: 'wibble' });
  assert.equal(model.reason, 'wibble');
  assert.match(model.reasonText, /Unknown search reason "wibble"/);
});

test('describeRoute: garbage input returns the empty model instead of throwing', () => {
  const garbage = [
    null,
    undefined,
    {},
    'nope',
    42,
    { ok: true },
    { ok: true, path: 'not an array' },
    { ok: true, path: [{ x: 'a', z: 1 }, { x: null, z: null }] },
    { ok: true, path: [{ x: NaN, z: 0 }] },
    { ok: 'yes', cost: 'lots', visited: -5, reason: 7 },
  ];
  for (const input of garbage) {
    const model = describeRoute(input);
    assert.ok(model, `no model for ${JSON.stringify(input)}`);
    assert.equal(typeof model.reasonText, 'string');
    assert.ok(model.reasonText.length > 0);
    assert.equal(typeof model.length, 'number');
    assert.equal(typeof model.cost, 'number');
    assert.equal(typeof model.visited, 'number');
    assert.ok(Array.isArray(model.cells));
    assert.ok(Array.isArray(model.points));
    assert.equal(model.cells.length, model.points.length);
    assert.ok(model.visited >= 0);
  }

  // A path with a bad cell keeps the GOOD cells and drops the bad one.
  const partial = describeRoute({
    ok: true,
    path: [{ x: 0, z: 0 }, { x: 'a', z: 1 }, { x: 2, z: 2 }],
    cost: 1,
    visited: 3,
    reason: 'found',
  });
  assert.equal(partial.cells.length, 2);
  assert.deepEqual(partial.cells, [{ x: 0, z: 0 }, { x: 2, z: 2 }]);
});

test('reasonTextFor: a reason can be overridden without touching the table', () => {
  assert.match(reasonTextFor('found'), /Route found/);
  assert.equal(reasonTextFor('found', { found: 'Reussi.' }), 'Reussi.');
});

test('describeRoute: a null options bag is not a reason to give up', () => {
  const model = describeRoute(
    { ok: true, path: [{ x: 0, z: 0 }, { x: 1, z: 0 }], cost: 1, visited: 2, reason: 'found' },
    null,
  );
  assert.equal(model.cells.length, 2);
  assert.match(model.reasonText, /Route found/);
});

// --------------------------------------------------------------------------
// The projection
// --------------------------------------------------------------------------

test('projectWorldToScreen: a world point lands where the matrices say', () => {
  // An orthographic projection over [-1, 1] on x and y, and an identity
  // view: the world point (0.5, 0.25, 0) is therefore NDC (0.5, 0.25).
  const camera = {
    projectionMatrix: {
      elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1],
    },
    matrixWorldInverse: {
      elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    },
  };
  const rect = { left: 0, top: 0, width: 800, height: 600 };
  const p = projectWorldToScreen({ x: 0.5, y: 0.25, z: 0 }, camera, rect);
  assert.ok(p);
  assert.equal(p.x, 600);    // (0.5 * 0.5 + 0.5) * 800
  assert.equal(p.y, 225);    // (-0.25 * 0.5 + 0.5) * 600
});

test('projectWorldToScreen: a point behind the camera is refused', () => {
  // A standard perspective projection: w = -z, so a point with z > 0 in
  // camera space is behind the eye.
  const camera = {
    projectionMatrix: {
      elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.01, -1, 0, 0, -2.02, 0],
    },
    matrixWorldInverse: {
      elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    },
  };
  const rect = { left: 0, top: 0, width: 800, height: 600 };
  // The camera looks down -z, so z = -10 is IN FRONT of it and z = +10 is
  // behind the eye.
  assert.ok(projectWorldToScreen({ x: 0, y: 0, z: -10 }, camera, rect));
  assert.equal(projectWorldToScreen({ x: 0, y: 0, z: 10 }, camera, rect), null);
  assert.equal(projectWorldToScreen({ x: 0, y: 0, z: 'a' }, camera, rect), null);
  assert.equal(projectWorldToScreen({ x: 0, y: 0, z: 0 }, null, rect), null);
});

// --------------------------------------------------------------------------
// The service
// --------------------------------------------------------------------------

/** A service with a DOM shim and a canvas, but no camera. */
function makeService(extra = {}) {
  const doc = makeDocument();
  const mount = makeElement('div');
  const canvas = makeCanvas();
  const ctx = { renderer: { renderer: { domElement: canvas } } };
  const service = createNavigationDebug(ctx, { document: doc, mount, ...extra });
  return { service, doc, mount, canvas };
}

test('the service: the overlay is off by default', () => {
  const { service } = makeService();
  assert.equal(service.enabled(), false);

  service.setEnabled(true);
  assert.equal(service.enabled(), true);

  service.setEnabled(false);
  assert.equal(service.enabled(), false);
});

test('the service: a reason text override reaches the panel', () => {
  const { service } = makeService({ reasonText: { found: 'Route trouve.' } });
  service.setEnabled(true);
  service.show({ ok: true, path: [{ x: 0, z: 0 }], cost: 0, visited: 1, reason: 'found' });
  assert.match(allText(service.element), /Route trouve\./);
});

test('the service: show records the route and clear forgets it', () => {
  const { service } = makeService();
  const result = {
    ok: true,
    path: [{ x: 3, z: 4 }, { x: 4, z: 4 }],
    cost: 1.5,
    visited: 9,
    reason: 'found',
  };

  const shown = service.show(result);
  assert.equal(shown.ok, true);
  assert.equal(shown.cells.length, 2);

  const state = service.state();
  assert.equal(state.enabled, false);
  assert.equal(state.route.cells.length, 2);
  assert.equal(state.route.visited, 9);
  assert.equal(state.route.cost, 1.5);

  service.clear();
  assert.equal(service.state().route, null);
});

test('the service: state() is a snapshot, not the live model', () => {
  const { service } = makeService();
  service.show({ ok: true, path: [{ x: 1, z: 1 }], cost: 0, visited: 1, reason: 'found' });

  const first = service.state();
  const second = service.state();
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.route, second.route);
  assert.notStrictEqual(first.route.cells, second.route.cells);

  // Editing the snapshot must not reach into the service.
  first.route.cells[0].x = 99;
  first.route.cells.push({ x: 9, z: 9 });
  assert.equal(service.state().route.cells.length, 1);
  assert.equal(service.state().route.cells[0].x, 1);
});

test('the service: the panel shows the reason, the numbers and the route cells', () => {
  const { service } = makeService();
  service.setEnabled(true);
  service.show({
    ok: false,
    path: [{ x: 2, z: 2 }, { x: 3, z: 2 }],
    cost: 4,
    visited: 17,
    reason: 'blocked-goal',
  });

  const panel = service.element;
  assert.ok(panel, 'the panel was built');
  assert.equal(panel.style.display, 'block');

  const text = allText(panel);
  assert.match(text, /blocked/i);
  assert.match(text, /17/);          // visited cells
  assert.match(text, /\(2,2\)/);      // the route cells
  assert.match(text, /\(3,2\)/);
});

test('the service: the route is drawn on the overlay when a projection exists', () => {
  const camera = {
    projectionMatrix: {
      elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1],
    },
    matrixWorldInverse: {
      elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    },
  };
  const { service } = makeService({ camera });
  // The service reads the camera off `ctx.renderer`, so it is injected the
  // same way the renderer exposes it.
  const withCamera = createNavigationDebug(
    { renderer: { renderer: { domElement: makeCanvas() }, camera } },
    { document: makeDocument(), mount: makeElement('div') },
  );
  withCamera.setEnabled(true);
  withCamera.show({
    ok: true,
    path: [{ x: 0, z: 0 }, { x: 1, z: 0 }],
    cost: 1,
    visited: 2,
    reason: 'found',
  });

  const polyline = withCamera.overlay?.children?.[0];
  assert.ok(polyline, 'the overlay has a polyline');
  const points = polyline.getAttribute('points');
  assert.ok(points && points.length > 0, 'the polyline has points');
  assert.equal(points.trim().split(/\s+/).length, 2);

  service.dispose();
  withCamera.dispose();
});

test('the service: without a projection the panel says so instead of drawing a broken line', () => {  const { service } = makeService();
  service.setEnabled(true);
  service.show({ ok: true, path: [{ x: 0, z: 0 }, { x: 1, z: 0 }], cost: 1, visited: 2, reason: 'found' });

  const text = allText(service.element);
  assert.match(text, /No world-to-screen projection/);
  // The overlay stays hidden rather than showing a line that is wrong.
  assert.equal(service.overlay.style.display, 'none');
});

test('the service: it survives without a DOM at all', () => {
  const service = createNavigationDebug({}, {});
  assert.equal(service.enabled(), false);
  service.setEnabled(true);
  const model = service.show({ ok: true, path: [{ x: 0, z: 0 }], cost: 0, visited: 1, reason: 'found' });
  assert.equal(model.cells.length, 1);
  assert.equal(service.state().route.cells.length, 1);
  service.clear();
  assert.equal(service.state().route, null);
});

// --------------------------------------------------------------------------
// The house rules
// --------------------------------------------------------------------------

test('the module never imports three', () => {
  const source = readFileSync(new URL('./navigation-debug.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]three['"]/);
  assert.doesNotMatch(source, /require\(['"]three['"]\)/);
});
