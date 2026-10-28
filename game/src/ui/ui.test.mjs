/**
 * ui/ui.test.mjs — the UX domain's unit tests.
 *
 * OWNER: UX (BOT-09). Run with:  node --test src/ui/ui.test.mjs
 *
 * These tests are REAL: they build the actual HUD markup, click the actual
 * buttons and assert the actual events that reach the bus. A tiny DOM shim
 * stands in for the browser (there is no jsdom in this project, and adding a
 * dependency is not this domain's call).
 *
 * WHAT IS COVERED
 *   - HUD markup generation: the counts of every element the dossier asks
 *     for (tool stack, speed control, top bar, demand/usage bars, the eight
 *     government blocks, the shop strip);
 *   - the seven tools and their keyboard binding;
 *   - speed / pause toggles emitting the right events;
 *   - the shop tabs being DERIVED from a supplied catalogue (the tab count
 *     must equal the category count);
 *   - the toast queue (FIFO, pending counter, blocking alerts);
 *   - frame-rate-independent damping maths;
 *   - graceful degradation when a domain is missing (no throw, placeholder).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENTS, on, off, emit } from '../core/events.js';
import { createState } from '../core/state.js';
import { TUNING, TOOLS, SPEED } from '../core/config.js';

import { createUI } from './index.js';
import { createHUD, findAssetBySlot, UI_ASSET_CANDIDATES } from './hud.js';
import {
  deriveShopTabs, buildTopBarModel, buildSpeedModel, buildDemandModel, PLACEHOLDER, TOOL_ORDER,
} from './panels.js';
import { createToastQueue } from './toasts.js';
import { damp, dampAngle, clampPitch, clampDistance, createCameraRig } from './camera.js';
import { HUD_STYLES } from './styles.js';

// ===========================================================================
// A minimal DOM shim — enough to build and drive the HUD in Node.
// ===========================================================================

function kebab(name) {
  return String(name).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function matchesSelector(el, selector) {
  const sel = String(selector).trim();
  const attr = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(sel);
  if (attr) {
    const name = attr[1];
    const value = attr[2];
    if (!(name in el.attributes)) return false;
    if (value === undefined) return true;
    return el.attributes[name] === value;
  }
  if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
  return el.tagName === sel.toUpperCase();
}

class FakeClassList {
  constructor(el) { this.el = el; }
  get set() { return this.el._classes; }
  add(...names) { for (const n of names) this.set.add(n); this.sync(); }
  remove(...names) { for (const n of names) this.set.delete(n); this.sync(); }
  contains(name) { return this.set.has(name); }
  toggle(name, force) {
    const has = this.set.has(name);
    const want = force === undefined ? !has : !!force;
    if (want) this.set.add(name); else this.set.delete(name);
    this.sync();
    return want;
  }
  sync() { this.el.className = Array.from(this.set).join(' '); }
}

class FakeElement {
  constructor(tag, doc) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = { cssText: '' };
    this._classes = new Set();
    this._text = '';
    this._html = '';
    this.listeners = new Map();
    this.classList = new FakeClassList(this);
    const el = this;
    this.dataset = new Proxy({}, {
      get: (t, p) => (typeof p === 'string' ? t[p] : undefined),
      set: (t, p, v) => { t[p] = v; el.attributes[`data-${kebab(p)}`] = String(v); return true; },
      has: (t, p) => p in t,
      deleteProperty: (t, p) => { delete t[p]; delete el.attributes[`data-${kebab(p)}`]; return true; },
      ownKeys: (t) => Reflect.ownKeys(t),
      getOwnPropertyDescriptor: (t, p) => Reflect.getOwnPropertyDescriptor(t, p),
    });
  }
  get className() { return Array.from(this._classes).join(' '); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() {
    if (this.children.length) return this.children.map((c) => c.textContent ?? '').join('');
    return this._text;
  }
  set textContent(v) { this._text = String(v ?? ''); this.children = []; this._html = ''; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v ?? ''); if (v === '') { this.children = []; this._text = ''; } }
  append(...nodes) {
    for (const n of nodes) {
      this.appendChild(typeof n === 'string' ? this.ownerDocument.createTextNode(n) : n);
    }
  }
  prepend(...nodes) {
    for (const n of nodes) {
      const node = typeof n === 'string' ? this.ownerDocument.createTextNode(n) : n;
      node.parentNode = this;
      this.children.unshift(node);
    }
  }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = []; this._text = ''; this.append(...nodes); }
  removeChild(node) {
    const i = this.children.indexOf(node);
    if (i >= 0) this.children.splice(i, 1);
    node.parentNode = null;
    return node;
  }
  remove() { this.parentNode?.removeChild(this); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatchEvent(event) {
    event.target = event.target ?? this;
    // Bubble up the tree, the way a real DOM event does.
    let node = this;
    while (node) {
      const set = node.listeners.get(event.type);
      if (set) for (const fn of Array.from(set)) fn(event);
      node = node.parentNode;
    }
    return true;
  }
  click() {
    this.dispatchEvent({ type: 'click', button: 0, target: this, preventDefault() { } });
  }
  matches(sel) { return matchesSelector(this, sel); }
  closest(sel) {
    let node = this;
    while (node) {
      if (node.matches && node.matches(sel)) return node;
      node = node.parentNode;
    }
    return null;
  }
  contains(node) {
    let n = node;
    while (n) { if (n === this) return true; n = n.parentNode; }
    return false;
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (node) => {
      if (!node.children) return;
      for (const child of node.children) {
        if (child.matches && child.matches(sel)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}

function installDom() {
  const doc = {
    head: new FakeElement('head', null),
    body: new FakeElement('body', null),
    createElement(tag) { return new FakeElement(tag, doc); },
    createTextNode(text) { return { nodeType: 3, textContent: String(text), parentNode: null }; },
    getElementById() { return null; },
  };
  const win = {
    listeners: new Map(),
    devicePixelRatio: 1,
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); },
    dispatchEvent(event) {
      const set = this.listeners.get(event.type);
      if (set) for (const fn of Array.from(set)) fn(event);
      return true;
    },
  };
  globalThis.document = doc;
  globalThis.window = win;
  globalThis.Element = FakeElement;
  return { doc, win };
}

const { doc: fakeDocument } = installDom();

/** A fresh context with NO sibling domains — the "degraded" case. */
function makeCtx(overrides = {}) {
  const state = createState(4242);
  const bus = {
    on: (evt, fn) => on(evt, fn),
    off: (evt, fn) => off(evt, fn),
    once: (evt, fn) => on(evt, fn),
    emit: (evt, payload) => emit(evt, payload),
  };
  return {
    state,
    bus,
    config: {
      TUNING,
      TOOLS,
      SPEED,
      GRID: { size: 64, cell: 4 },
      CELL: 4,
      worldToCellInt: (x, z) => ({
        x: Math.floor((x + 128) / 4),
        z: Math.floor((z + 128) / 4),
      }),
    },
    domains: {},
    ...overrides,
  };
}

// ===========================================================================
// 1. HUD markup generation
// ===========================================================================

test('HUD markup carries every element the dossier asks for', () => {
  const ctx = makeCtx();
  const hud = createHUD(ctx, {});
  const root = hud.el;

  // The seven tools (FR-UX-011).
  const tools = root.querySelectorAll('[data-sc-tool]');
  assert.equal(tools.length, 7, 'the tool stack must carry the seven tools');
  assert.deepEqual(tools.map((t) => t.dataset.scTool), [
    TOOLS.inspect, TOOLS.build, TOOLS.bulldoze, TOOLS.road,
    TOOLS.terraform, TOOLS.paint, TOOLS.voxel,
  ]);

  // The pause + speed control (FR-UX-099).
  const speeds = root.querySelectorAll('[data-sc-speed]');
  assert.equal(speeds.length, 5, 'pause + four speeds');
  assert.deepEqual(speeds.map((s) => s.dataset.scSpeed),
    ['paused', 'slow', 'normal', 'fast', 'ultra']);

  // The top bar: treasury, population, happiness, loyalty, day.
  const stats = root.querySelectorAll('[data-sc-stat]');
  assert.equal(stats.length, 5, 'five top-bar stat blocks');
  assert.deepEqual(stats.map((s) => s.dataset.scStat),
    ['treasury', 'population', 'happiness', 'loyalty', 'day']);

  // The demand block (3 bars) and the usage block (4 bars).
  assert.equal(root.querySelectorAll('[data-sc-demand]').length, 3);
  assert.equal(root.querySelectorAll('[data-sc-usage]').length, 4);

  // The shop strip, the camera cluster, the toast area, the panel.
  assert.equal(root.querySelectorAll('[data-sc-shop-tabs]').length, 1);
  assert.equal(root.querySelectorAll('[data-sc-shop-cards]').length, 1);
  assert.equal(root.querySelectorAll('[data-sc-cam]').length, 5);
  assert.equal(root.querySelectorAll('[data-sc-toasts]').length, 1);
  assert.equal(root.querySelectorAll('[data-sc-panel]').length, 1);
  assert.equal(root.querySelectorAll('[data-sc-licence]').length, 1);

  hud.dispose();
});

test('the government panel renders the eight service blocks (FR-UX-035)', () => {
  const ctx = makeCtx();
  const hud = createHUD(ctx, {});
  hud.openPanel('government');
  const blocks = hud.el.querySelectorAll('.sc-svcblock');
  assert.equal(blocks.length, 8, 'eight service blocks: energy, water, food, waste, health, security, fire, education');
  assert.equal(hud.panel(), 'government');
  hud.closePanel();
  assert.equal(hud.panel(), null);
  hud.dispose();
});

test('the stylesheet is the 16-bit look: no rounded corners, no blur', () => {
  assert.ok(HUD_STYLES.includes('--sc-panel'), 'the HUD uses the shell palette');
  assert.ok(!/border-radius:\s*(?!0)/.test(HUD_STYLES.replace(/border-radius: 0;/g, '')),
    'no rounded corners anywhere in the HUD chrome');
  assert.ok(!/blur\(/.test(HUD_STYLES), 'no blurred shadows or filters');
  assert.ok(/min-width:\s*44px/.test(HUD_STYLES), '44x44 touch targets (FR-UX-017)');
  assert.ok(/safe-area-inset/.test(HUD_STYLES), 'safe-area aware (FR-UX-018)');
});

// ===========================================================================
// 2. Tools
// ===========================================================================

test('the tool stack selects a tool and announces it on the bus', () => {
  const ctx = makeCtx();
  const seen = [];
  const un = on(EVENTS.TOOL_CHANGED, (p) => seen.push(p.tool));
  const ui = createUI(ctx);
  const hud = ui.hud;

  const build = hud.el.querySelectorAll('[data-sc-tool]')[1];
  build.click();

  assert.equal(ctx.state.ui.tool, TOOLS.build);
  assert.deepEqual(seen, [TOOLS.build]);
  assert.ok(hud.el.querySelectorAll('[data-sc-tool]')[1].classList.contains('is-active'),
    'the active tool is visibly indicated (FR-UX-057)');

  // The sibling domains are told too.
  const told = [];
  ctx.domains.buildings = { setTool: (t) => told.push(t) };
  hud.el.querySelectorAll('[data-sc-tool]')[2].click();
  assert.deepEqual(told, [TOOLS.bulldoze]);

  un();
  ui.dispose();
});

test('the tool keyboard binding maps 1..7 onto the seven tools', () => {
  assert.equal(TOOL_ORDER.length, 7);
  const hud = createHUD(makeCtx(), {});
  const labels = hud.el.querySelectorAll('[data-sc-tool]').map((b) => b.querySelector('kbd').textContent);
  assert.deepEqual(labels, ['1', '2', '3', '4', '5', '6', '7']);
  hud.dispose();
});

// ===========================================================================
// 3. Speed / pause
// ===========================================================================

test('the pause and speed controls drive the state and emit the events', () => {
  const ctx = makeCtx();
  const speedEvents = [];
  const pauseEvents = [];
  const unSpeed = on(EVENTS.SPEED_CHANGED, (p) => speedEvents.push(p));
  const unPause = on(EVENTS.PAUSE_CHANGED, (p) => pauseEvents.push(p));

  const ui = createUI(ctx);
  const hud = ui.hud;

  hud.el.querySelectorAll('[data-sc-speed]')[0].click();      // pause
  assert.equal(ctx.state.meta.paused, true);
  assert.equal(pauseEvents.at(-1).paused, true);

  hud.el.querySelectorAll('[data-sc-speed]')[3].click();      // fast
  assert.equal(ctx.state.meta.paused, false);
  assert.equal(ctx.state.meta.speed, SPEED.fast);
  assert.equal(speedEvents.at(-1).speed, SPEED.fast);

  assert.equal(ctx.state.ui.speed, SPEED.fast, 'the UI subtree mirrors the speed');

  unSpeed();
  unPause();
  ui.dispose();
});

// ===========================================================================
// 4. The shop tabs are derived from the catalogue
// ===========================================================================

const FAKE_CATEGORIES = [
  { id: 'residential', label: 'Residential', order: 1 },
  { id: 'commercial', label: 'Commercial', order: 2 },
  { id: 'industrial', label: 'Industrial', order: 3 },
  { id: 'parks', label: 'Parks & Leisure', order: 4 },
];

const FAKE_DEFS = [
  { id: 'res.house', displayName: 'House', category: 'residential', model: 'a', available: true },
  { id: 'res.flat', displayName: 'Flat', category: 'residential', model: 'b', available: true },
  { id: 'com.shop', displayName: 'Shop', category: 'commercial', model: 'c', available: true },
  { id: 'ind.farm', displayName: 'Farm', category: 'industrial', model: 'd', available: true },
  { id: 'par.tree', displayName: 'Tree', category: 'parks', model: 'e', available: false },
];

test('the shop tabs are derived from the catalogue, never hard-coded', () => {
  const ctx = makeCtx();
  ctx.domains.buildings = { catalogue: () => FAKE_DEFS };
  ctx.state.buildings.categories = FAKE_CATEGORIES;

  const tabs = deriveShopTabs(FAKE_DEFS, FAKE_CATEGORIES);
  assert.equal(tabs.length, FAKE_CATEGORIES.length, 'one tab per category');
  assert.deepEqual(tabs.map((t) => t.id), ['residential', 'commercial', 'industrial', 'parks']);
  assert.deepEqual(tabs.map((t) => t.label),
    ['Residential', 'Commercial', 'Industrial', 'Parks & Leisure']);
  assert.equal(tabs[0].count, 2, 'the tab counts the catalogue entries');

  // And the HUD renders exactly that many tabs.
  const hud = createHUD(ctx, {});
  hud.update(0.016);
  const tabButtons = hud.el.querySelectorAll('[data-sc-tab]');
  assert.equal(tabButtons.length, FAKE_CATEGORIES.length);
  assert.deepEqual(tabButtons.map((b) => b.dataset.scTab),
    ['residential', 'commercial', 'industrial', 'parks']);

  // The cards follow the active tab.
  const cards = hud.el.querySelectorAll('[data-sc-card]');
  assert.equal(cards.length, 2, 'the residential tab shows the two houses');
  assert.deepEqual(cards.map((c) => c.dataset.scCard), ['res.house', 'res.flat']);

  hud.dispose();
});

test('the shop tabs survive a catalogue that arrives as a Map or a callable', () => {
  const asMap = new Map(FAKE_DEFS.map((d) => [d.id, d]));
  const asFn = () => FAKE_DEFS;
  assert.equal(deriveShopTabs(asMap, FAKE_CATEGORIES).length, FAKE_CATEGORIES.length);
  assert.equal(deriveShopTabs(asFn, FAKE_CATEGORIES).length, FAKE_CATEGORIES.length);
  assert.equal(deriveShopTabs(null, FAKE_CATEGORIES).length, 0, 'a missing catalogue yields no tabs');
});

test('the modal shop is pickable: it uses the same card contract as the strip', () => {
  const ctx = makeCtx();
  ctx.domains.buildings = { catalogue: () => FAKE_DEFS };
  ctx.state.buildings.categories = FAKE_CATEGORIES;

  const ui = createUI(ctx);
  const hud = ui.hud;
  hud.update(0.016);

  // The `B` shortcut opens the modal shop.
  hud.openPanel('shop');
  assert.equal(hud.panel(), 'shop');

  // Its entries must be REAL cards, not static cells: the same
  // `data-sc-card` contract the persistent strip uses.
  const panel = hud.el.querySelectorAll('[data-sc-panel]')[0];
  const modalCards = panel.querySelectorAll('[data-sc-card]');
  assert.equal(modalCards.length, 2, 'the modal shop must offer the residential cards');
  assert.deepEqual(modalCards.map((c) => c.dataset.scCard), ['res.house', 'res.flat']);

  // And clicking one selects it (the delegated handler serves both surfaces).
  modalCards[1].click();
  assert.equal(ctx.state.ui.selectedType, 'res.flat');
  assert.equal(ctx.state.ui.tool, TOOLS.build, 'the build tool is armed');
  assert.equal(hud.panel(), null, 'the modal must not stay over the map');

  ui.dispose();
});

test('a shop card click arms the build tool and leaves the map clear', () => {
  const ctx = makeCtx();
  ctx.domains.buildings = { catalogue: () => FAKE_DEFS };
  ctx.state.buildings.categories = FAKE_CATEGORIES;

  const ui = createUI(ctx);
  const hud = ui.hud;
  hud.update(0.016);

  // The panel is a FULL-SCREEN modal (`inset: 0`). Leaving it open after a
  // card click swallows the next canvas click, so the building the player
  // had just chosen could not be placed — a dead end in the build loop.
  hud.openPanel('building');
  assert.equal(hud.panel(), 'building', 'a panel is open before the card click');

  const card = hud.el.querySelectorAll('[data-sc-card]')[0];
  assert.equal(card.dataset.scCard, 'res.house');
  card.click();

  // The selection was made...
  assert.equal(ctx.state.ui.selectedType, 'res.house');
  assert.equal(ctx.state.ui.selection?.type, 'res.house');
  // ...the build tool is armed, so the next map click places it...
  assert.equal(ctx.state.ui.tool, TOOLS.build, 'the build tool must be armed by the card click');
  // ...and no modal is left over the map.
  assert.equal(hud.panel(), null, 'no panel may block the map after a card click');
  assert.equal(ctx.state.ui.panel, null, 'the panel id must be cleared from the state too');
  assert.equal(hud.el.querySelectorAll('[data-sc-panel]')[0].hidden, true, 'the panel overlay must be hidden');

  ui.dispose();
});

// ===========================================================================
// 5. The toast queue
// ===========================================================================

test('the toast queue delivers one at a time, in FIFO order', () => {
  const q = createToastQueue({ ttl: 4 });
  q.push('first', 'info');
  q.push('second', 'success');
  q.push('third', 'warn');

  assert.equal(q.current().message, 'first');
  assert.equal(q.pendingCount(), 2, 'two notifications are pending behind it');

  q.tick(1);
  assert.equal(q.current().message, 'first', 'a toast stays until its timeout');
  q.tick(4);
  assert.equal(q.current().message, 'second', 'the next toast follows');
  assert.equal(q.pendingCount(), 1);
});

test('a blocking alert preempts the queue and never auto-dismisses', () => {
  const q = createToastQueue({ ttl: 2 });
  q.push('info message', 'info');
  q.push('usage at 100%', 'alert');
  assert.equal(q.current().message, 'usage at 100%', 'the alert takes the screen');
  q.tick(100);
  assert.equal(q.current().message, 'usage at 100%', 'a blocking alert is never auto-dismissed');
  assert.equal(q.current().blocking, true);

  q.dismiss();
  assert.equal(q.current().message, 'info message', 'the displaced toast returns');
});

test('the toast queue is bounded', () => {
  const q = createToastQueue({ ttl: 10, max: 3 });
  for (let i = 0; i < 10; i += 1) q.push(`m${i}`, 'info');
  assert.equal(q.pendingCount(), 3);
});

test('the HUD renders the toast and its pending counter', () => {
  const ctx = makeCtx();
  const ui = createUI(ctx);
  ui.showToast('build placed', 'success');
  ui.showToast('and another', 'info');
  ui.update(0.016);
  const toasts = ui.hud.el.querySelectorAll('[data-sc-toast]');
  assert.equal(toasts.length, 1, 'one toast on screen at a time');
  assert.equal(toasts[0].dataset.kind, 'success');
  assert.equal(ui.hud.el.querySelectorAll('.sc-toast-count').length, 1, 'the pending counter is visible');
  ui.dispose();
});

// ===========================================================================
// 6. Frame-rate-independent damping
// ===========================================================================

test('the damping is frame-rate independent', () => {
  const oneBigStep = damp(0, 100, 5, 1);
  let many = 0;
  for (let i = 0; i < 1000; i += 1) many = damp(many, 100, 5, 0.001);
  assert.ok(Math.abs(oneBigStep - many) < 1e-9,
    `one 1s step (${oneBigStep}) must equal 1000 x 1ms steps (${many})`);

  // And it is NOT the naive fixed lerp, which would make the camera move
  // faster on a high-refresh display.
  const naive = 0 + (100 - 0) * 0.1;
  assert.ok(oneBigStep > 90, 'the exponential damping converges in one second');
  assert.ok(Math.abs(oneBigStep - naive) > 50, 'it is not a fixed per-frame lerp');

  // The analytic value: 1 - exp(-5).
  assert.ok(Math.abs(oneBigStep - 100 * (1 - Math.exp(-5))) < 1e-12);
});

test('the angular damping takes the short way round', () => {
  const near = dampAngle(0.1, Math.PI * 2 - 0.1, 8, 0.5);
  assert.ok(near < 0.5, 'it wrapped backwards instead of all the way round');
  const wrapped = dampAngle(Math.PI * 2 - 0.1, 0.1, 8, 0.5);
  assert.ok(Math.abs(wrapped - Math.PI * 2) < 0.2);
});

test('the camera clamps its pitch and distance to the published limits', () => {
  assert.equal(clampPitch(5), 15);
  assert.equal(clampPitch(95), 85);
  assert.equal(clampDistance(1), TUNING.cameraMinDistance);
  assert.equal(clampDistance(9999), TUNING.cameraMaxDistance);
  assert.equal(clampDistance(TUNING.cameraDistance), TUNING.cameraDistance);
});

test('the camera rig exposes focus / zoom / rotate and survives a missing renderer', () => {
  const ctx = makeCtx();
  const rig = createCameraRig(ctx, { listen: false });
  rig.focus(10, -20);
  rig.zoomTo(1e6);
  rig.rotate(Math.PI / 4);
  assert.equal(rig.target.x, 10);
  assert.equal(rig.target.z, -20);
  assert.equal(rig.target.distance, TUNING.cameraMaxDistance);
  assert.ok(Math.abs(rig.target.yaw - (Math.PI / 4 + Math.PI / 4)) < 1e-9);
  rig.update(0.016);           // must not throw without a renderer
  rig.reset();
  assert.equal(rig.target.distance, TUNING.cameraDistance);
  rig.dispose();
});

// ===========================================================================
// 7. Graceful degradation
// ===========================================================================

test('the HUD shows a placeholder, never a fabricated number, when a domain is missing', () => {
  const ctx = makeCtx();          // NO sibling domains at all
  const hud = createHUD(ctx, {});
  assert.doesNotThrow(() => hud.update(0.016));

  const treasury = hud.el.querySelectorAll('[data-sc-stat]')[0];
  assert.equal(treasury.querySelector('b').textContent, PLACEHOLDER);
  const population = hud.el.querySelectorAll('[data-sc-stat]')[1];
  assert.equal(population.querySelector('b').textContent, PLACEHOLDER);
  const happiness = hud.el.querySelectorAll('[data-sc-stat]')[2];
  assert.equal(happiness.querySelector('b').textContent, PLACEHOLDER);

  // The day comes from the integrator-owned meta state, so it IS a number.
  const day = hud.el.querySelectorAll('[data-sc-stat]')[4];
  assert.equal(day.querySelector('b').textContent, String(ctx.state.meta.day));

  hud.dispose();
});

test('the top-bar model reports every block as unavailable without its domain', () => {
  const ctx = makeCtx();
  const model = buildTopBarModel({ state: ctx.state, domains: {} });
  assert.equal(model.length, 5);
  for (const block of model.filter((b) => b.id !== 'day')) {
    assert.equal(block.value, PLACEHOLDER);
    assert.equal(block.available, false);
  }
  assert.equal(model.find((b) => b.id === 'day').available, true);
});

test('the top-bar model reads the domains when they ARE present', () => {
  const ctx = makeCtx();
  ctx.domains.economy = { treasury: () => 1234 };
  ctx.domains.population = { population: () => 42, happiness: () => 88, loyalty: () => 51 };
  const model = buildTopBarModel({ state: ctx.state, domains: ctx.domains });
  const byId = Object.fromEntries(model.map((b) => [b.id, b]));
  assert.equal(byId.treasury.value, '$1,234');
  assert.equal(byId.population.value, '42');
  assert.equal(byId.happiness.value, '88%');
  assert.equal(byId.loyalty.value, '51%');
  assert.equal(byId.treasury.available, true);
});

test('a broken domain must not break the HUD', () => {
  const ctx = makeCtx();
  ctx.domains.economy = {
    treasury() { throw new Error('boom'); },
  };
  const hud = createHUD(ctx, {});
  assert.doesNotThrow(() => hud.update(0.016));
  assert.equal(hud.el.querySelectorAll('[data-sc-stat]')[0].querySelector('b').textContent, PLACEHOLDER);
  hud.dispose();
});

test('the speed model lists five buttons and marks the active one', () => {
  const ctx = makeCtx();
  ctx.state.meta.speed = SPEED.fast;
  ctx.state.meta.paused = false;
  const model = buildSpeedModel({ state: ctx.state, domains: {} });
  assert.equal(model.buttons.length, 5);
  const active = model.buttons.filter((b) => b.active);
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'fast');
});

// ===========================================================================
// 8. The curated 2D art is optional
// ===========================================================================

test('the HUD is complete and correct with ZERO 2D images', () => {
  const ctx = makeCtx();
  const hud = createHUD(ctx, {});
  hud.update(0.016);
  assert.equal(hud.el.querySelectorAll('.sc-icon').length, 0, 'no icons are required');
  assert.equal(hud.el.querySelectorAll('[data-sc-licence]')[0].hidden, true,
    'the licence note stays hidden when no art is in use');
  assert.ok(hud.el.querySelectorAll('[data-sc-tool]').length === 7);
  hud.dispose();
});

test('the manifest is looked up by slot, tolerantly', () => {
  const manifest = {
    images: {
      build: { file: '/assets/ui/build.png', slot: 'tool.build' },
      prefixed: { file: '/assets/ui/coin.png', slot: 'icon.hud.treasury' },
    },
  };
  assert.equal(findAssetBySlot(manifest, 'tool.build')?.file, '/assets/ui/build.png');
  assert.equal(findAssetBySlot(manifest, 'hud.treasury')?.file, '/assets/ui/coin.png',
    'a prefixed slot still matches the plain one');
  assert.equal(findAssetBySlot(manifest, 'hud.nothing'), null);
  assert.equal(findAssetBySlot(null, 'tool.build'), null);
  assert.ok(UI_ASSET_CANDIDATES.length > 0, 'there is at least one place to look for the manifest');
});

// ===========================================================================
// 9. The public API
// ===========================================================================

test('createUI exports exactly the contracted surface', async () => {
  const ctx = makeCtx();
  const ui = createUI(ctx);
  for (const name of ['init', 'update', 'mount', 'unmount', 'setTool', 'setSelection',
    'showToast', 'openPanel', 'closePanel', 'panel', 'dispose']) {
    assert.equal(typeof ui[name], 'function', `${name} must be a function`);
  }
  assert.equal(typeof ui.camera, 'object');
  for (const name of ['focus', 'zoomTo', 'rotate', 'reset']) {
    assert.equal(typeof ui.camera[name], 'function', `camera.${name} must be a function`);
  }
  assert.equal(ui.hoverCell, null, 'hoverCell is a getter that starts empty');

  // mount / unmount
  const container = fakeDocument.createElement('div');
  assert.equal(ui.mount(container), true);
  assert.equal(container.children.length, 1);
  assert.equal(ui.unmount(), true);

  await ui.init();
  ui.dispose();
});

test('setSelection records the selection where the buildings domain looks for it', () => {
  const ctx = makeCtx();
  const ui = createUI(ctx);
  ui.setSelection({ kind: 'building', type: 'res.house' });
  assert.equal(ctx.state.ui.selection.type, 'res.house');
  assert.equal(ctx.state.ui.selectedType, 'res.house');
  ui.dispose();
});

test('tapping the active tool cancels it (FR-UX-058)', () => {
  const ctx = makeCtx();
  const ui = createUI(ctx);
  const tools = ui.hud.el.querySelectorAll('[data-sc-tool]');
  tools[1].click();                       // select build
  assert.equal(ctx.state.ui.tool, TOOLS.build);
  tools[1].click();                       // tap it again -> cancel
  assert.equal(ctx.state.ui.tool, TOOLS.inspect, 'tapping the active tool returns to select');
  ui.dispose();
});

test('the clock opens the time control with the speed buttons (FR-UX-098/099)', () => {
  const ctx = makeCtx();
  const ui = createUI(ctx);
  ui.hud.el.querySelector('[data-sc-action="clock"]').click();
  assert.equal(ui.panel(), 'time');
  const speeds = ui.hud.el.querySelectorAll('[data-sc-panel-speed]');
  assert.equal(speeds.length, 5, 'the time control carries the pause + speed control');
  const presets = ui.hud.el.querySelectorAll('[data-sc-time-preset]');
  assert.equal(presets.length, 4, 'dawn / day / dusk / night');
  ui.dispose();
});

test('the keyboard scheme works when nothing in the page is focused', () => {
  const ctx = makeCtx();
  const ui = createUI(ctx);

  // When no element has focus the event target is `window`, which is NOT a
  // Node. The handler must not throw on it (that would silence every
  // shortcut in the real game).
  const event = { type: 'keydown', key: 'g', target: globalThis.window, preventDefault() { } };
  assert.doesNotThrow(() => globalThis.window.dispatchEvent(event), 'the window-target shortcut must not throw');
  assert.equal(ui.panel(), 'government', 'the G shortcut opened the government panel');

  ui.closePanel();
  const toolEvent = { type: 'keydown', key: '3', target: globalThis.window, preventDefault() { } };
  assert.doesNotThrow(() => globalThis.window.dispatchEvent(toolEvent));
  assert.equal(ctx.state.ui.tool, TOOLS.bulldoze, 'the 3 shortcut selected the bulldoze');

  const escEvent = { type: 'keydown', key: 'Escape', target: globalThis.window, preventDefault() { } };
  globalThis.window.dispatchEvent(escEvent);
  assert.equal(ctx.state.ui.tool, TOOLS.inspect, 'Escape cancelled the tool');

  ui.dispose();
});

// ===========================================================================
// The demand bars and the "assumed" marks (M5 / m3)
// ===========================================================================

test('the top bar marks the values that rest on unpublished numbers', () => {
  const ctx = makeCtx();
  ctx.domains.economy = { treasury: () => 1234 };
  ctx.domains.population = { population: () => 42, happiness: () => 88, loyalty: () => 51 };
  const model = buildTopBarModel({ state: ctx.state, domains: ctx.domains });
  const byId = Object.fromEntries(model.map((b) => [b.id, b]));

  // Happiness and loyalty rest on weights the publisher never published.
  assert.equal(byId.happiness.assumed, true, 'happiness must be marked as provisional');
  assert.equal(byId.loyalty.assumed, true, 'loyalty must be marked as provisional');
  // These are published quantities.
  assert.equal(byId.treasury.assumed, false, 'the treasury is not an assumed value');
  assert.equal(byId.population.assumed, false, 'the population is not an assumed value');
  assert.equal(byId.day.assumed, false, 'the day counter is not an assumed value');
});

test('the demand bars come from the economy domain, not from a local invention', () => {
  const ctx = makeCtx();
  // The economy owns the demand model. The HUD must read ITS bars.
  ctx.domains.economy = {
    demandBars: () => ({
      residential: { capacity: 100, demand: 140, unmet: 40, fill: 0.4, saturated: false, covered: false },
      commercial: { capacity: 50, demand: 50, unmet: 0, fill: 0, saturated: false, covered: true },
      industrial: { capacity: 20, demand: 60, unmet: 40, fill: 1, saturated: true, covered: false },
    }),
  };
  const model = buildDemandModel({ state: ctx.state, domains: ctx.domains });
  assert.equal(model.length, 3);

  const byId = Object.fromEntries(model.map((b) => [b.id, b]));
  assert.equal(byId.residential.ratio, 0.4, 'the bar shows the unmet demand as a fraction of capacity');
  assert.equal(byId.residential.unmet, 40);
  assert.equal(byId.commercial.ratio, 0, 'a covered sector has an empty bar');
  assert.equal(byId.industrial.ratio, 1, 'an exhausted sector has a full bar');
  assert.equal(byId.industrial.saturated, true);
});

test('the demand bars are marked as assumed: their inputs are unpublished', () => {
  const ctx = makeCtx();
  ctx.domains.economy = {
    demandBars: () => ({
      residential: { capacity: 100, demand: 100, unmet: 0, fill: 0 },
      commercial: { capacity: 50, demand: 50, unmet: 0, fill: 0 },
      industrial: { capacity: 20, demand: 20, unmet: 0, fill: 0 },
    }),
  };
  const model = buildDemandModel({ state: ctx.state, domains: ctx.domains });
  for (const bar of model) {
    assert.equal(bar.assumed, true,
      `${bar.id}: the demand MODEL is unpublished, so the bar must say so`);
  }
});

test('the demand bars never present an unpublished mapping as fact', () => {
  const ctx = makeCtx();
  // A city with plenty of homes and a big workforce: the OLD implementation
  // showed `employed` as commercial demand and `unemployed` as industrial
  // demand, which is not a published rule.
  ctx.state.population = { total: 500, employed: 300, unemployed: 200 };
  ctx.state.buildings = { aggregates: { residents: 1000, workspaces: 400, jobs: 300 } };
  ctx.domains.economy = {
    demandBars: () => ({
      residential: { capacity: 1000, demand: 500, unmet: 0, fill: 0 },
      commercial: { capacity: 400, demand: 500, unmet: 100, fill: 0.25 },
      industrial: { capacity: 300, demand: 500, unmet: 200, fill: 0.6667 },
    }),
  };
  const model = buildDemandModel({ state: ctx.state, domains: ctx.domains });
  const byId = Object.fromEntries(model.map((b) => [b.id, b]));

  assert.equal(byId.commercial.demand, 500, 'the bar uses the economy model, not `employed`');
  assert.equal(byId.industrial.demand, 500, 'the bar uses the economy model, not `unemployed`');
  assert.notEqual(byId.industrial.demand, 200, '`unemployed` must never be industrial demand');
});

test('the demand bars degrade to a placeholder without the economy domain', () => {
  const ctx = makeCtx();
  const model = buildDemandModel({ state: ctx.state, domains: {} });
  assert.equal(model.length, 3);
  for (const bar of model) {
    assert.equal(bar.ratio, null);
    assert.equal(bar.text, PLACEHOLDER);
    assert.equal(bar.assumed, true);
  }
});
