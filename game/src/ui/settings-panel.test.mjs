/**
 * ui/settings-panel.test.mjs — the settings, accessibility and controls.
 *
 * OWNER: UX (BOT-09). Run with:  node --test src/ui/settings-panel.test.mjs
 *
 * WHAT IS COVERED
 *   - the rows come from the settings SCHEMA (never from a hard-coded list);
 *   - the key rows come from the input map;
 *   - an audio change reaches the mixer LIVE;
 *   - the accessibility settings have REAL effects (the stylesheet, the
 *     renderer, the camera's shake switch);
 *   - a rebind is persisted through the settings store;
 *   - the bindings can be reset to the defaults.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createSettings, SCHEMA } from '../core/settings.js';
import { createInputMap, DEFAULT_BINDINGS, keyLabel } from '../core/input-map.js';
import { buildSettingsModel, buildControlsModel } from './panels.js';
import { createSettingsPanel, applyUiEffects, formatSettingValue } from './settings-panel.js';

// ===========================================================================
// A minimal DOM shim
// ===========================================================================

class FakeElement {
  constructor(tag, doc) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = {
      props: {},
      setProperty(name, value) { this.props[name] = String(value); },
      removeProperty(name) { delete this.props[name]; },
      getPropertyValue(name) { return this.props[name] ?? ''; },
    };
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this._classes = new Set();
    this._text = '';
    this.listeners = new Map();
    const el = this;
    this.classList = {
      add: (...n) => { for (const x of n) el._classes.add(x); },
      remove: (...n) => { for (const x of n) el._classes.delete(x); },
      contains: (n) => el._classes.has(n),
      toggle: (n, force) => {
        const want = force === undefined ? !el._classes.has(n) : !!force;
        if (want) el._classes.add(n); else el._classes.delete(n);
        return want;
      },
    };
    const kebab = (name) => String(name).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
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
  set textContent(v) { this._text = String(v ?? ''); this.children = []; }
  append(...nodes) { for (const n of nodes) this.appendChild(n); }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = []; this._text = ''; this.append(...nodes); }
  remove() {
    const parent = this.parentNode;
    if (!parent) return;
    const i = parent.children.indexOf(this);
    if (i >= 0) parent.children.splice(i, 1);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatchEvent(event) {
    event.target = event.target ?? this;
    let node = this;
    while (node) {
      const set = node.listeners.get(event.type);
      if (set) for (const fn of Array.from(set)) fn(event);
      node = node.parentNode;
    }
    return true;
  }
  click() { this.dispatchEvent({ type: 'click', button: 0, target: this, preventDefault() { } }); }
  matches(sel) {
    const attr = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(String(sel).trim());
    if (attr) {
      if (!(attr[1] in this.attributes)) return false;
      return attr[2] === undefined || this.attributes[attr[1]] === attr[2];
    }
    if (String(sel).startsWith('.')) return this.classList.contains(String(sel).slice(1));
    return this.tagName === String(sel).toUpperCase();
  }
  closest(sel) {
    let node = this;
    while (node) {
      if (node.matches && node.matches(sel)) return node;
      node = node.parentNode;
    }
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (node) => {
      for (const child of node.children ?? []) {
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
    createElement(tag) { return new FakeElement(tag, doc); },
    createTextNode(text) { return { nodeType: 3, textContent: String(text), parentNode: null }; },
    getElementById() { return null; },
  };
  doc.head = new FakeElement('head', doc);
  doc.body = new FakeElement('body', doc);
  doc.documentElement = new FakeElement('html', doc);
  const win = {
    listeners: new Map(),
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

const { doc: fakeDocument, win: fakeWindow } = installDom();

/** A context with a real settings store and a real input map. */
function makeCtx(overrides = {}) {
  const settings = createSettings({ storage: null });
  const inputMap = createInputMap();
  const audio = {
    calls: [],
    setBusVolume(bus, v) { this.calls.push(['bus', bus, v]); return true; },
    setMuted(b) { this.calls.push(['muted', b]); return true; },
  };
  const renderer = {
    calls: [],
    setPostFX(on) { this.calls.push(['postfx', on]); return on; },
    setShadowsEnabled(on) { this.calls.push(['shadows', on]); return on; },
    setPixelSize(n) { this.calls.push(['pixel', n]); return n; },
  };
  return {
    settings,
    inputMap,
    audio,
    renderer,
    bus: { emit() { return 0; }, on() { return () => {}; } },
    ...overrides,
  };
}

// ===========================================================================
// 1. The models are data-driven
// ===========================================================================

test('the settings rows come from the SCHEMA, not from a hard-coded list', () => {
  const model = buildSettingsModel({ schema: SCHEMA, values: {} });
  const keys = model.rows.map((r) => r.key);
  for (const key of Object.keys(SCHEMA)) {
    if (key === 'input.bindings') continue;   // the bindings are the controls view
    assert.ok(keys.includes(key), `${key} is missing from the settings model`);
  }
  assert.deepEqual(model.groups.map((g) => g.id), ['audio', 'display', 'accessibility', 'input']);
});

test('the controls rows come from the input map, with readable key labels', () => {
  const inputMap = createInputMap();
  const model = buildControlsModel({ inputMap });
  assert.equal(model.rows.length, Object.keys(DEFAULT_BINDINGS).length);
  const save = model.rows.find((r) => r.action === 'game.save');
  assert.equal(save.keyText, 'CTRL + S');
  const pan = model.rows.find((r) => r.action === 'camera.panUp');
  assert.equal(pan.keyText, `W / ${keyLabel('ArrowUp')}`);
});

// ===========================================================================
// 2. The panel renders the rows and applies the changes
// ===========================================================================

test('the panel renders one row per setting', () => {
  const ctx = makeCtx();
  const panel = createSettingsPanel(ctx, {});
  const container = fakeDocument.createElement('div');
  panel.render(container, 'settings');

  const rows = container.querySelectorAll('[data-sc-setting]');
  const expected = Object.keys(SCHEMA).filter((k) => k !== 'input.bindings').length;
  assert.equal(rows.length, expected, 'every setting has a row');

  // The accessibility view carries only the accessibility rows.
  const acc = fakeDocument.createElement('div');
  panel.render(acc, 'accessibility');
  const accRows = acc.querySelectorAll('[data-sc-setting]');
  assert.deepEqual(accRows.map((r) => r.dataset.scSetting), [
    'accessibility.reducedEffects',
    'accessibility.reducedShake',
    'accessibility.textScale',
    'accessibility.colourBlind',
    'accessibility.highContrast',
  ]);
  panel.dispose();
});

test('an audio change reaches the mixer live', () => {
  const ctx = makeCtx();
  const panel = createSettingsPanel(ctx, {});
  const container = fakeDocument.createElement('div');
  panel.render(container, 'settings');

  const row = container.querySelectorAll('[data-sc-setting="audio.music"]')[0];
  const plus = row.querySelectorAll('[data-sc-set-step]')[1];
  plus.click();

  const busCall = ctx.audio.calls.find((c) => c[0] === 'bus' && c[1] === 'music');
  assert.ok(busCall, 'the music bus was pushed');
  assert.equal(busCall[2], 0.75, 'the volume moved up by one step (0.70 -> 0.75)');
  assert.equal(ctx.settings.get('audio.music'), 0.75);
  panel.dispose();
});

test('the mute switch reaches the mixer live', () => {
  const ctx = makeCtx();
  const panel = createSettingsPanel(ctx, {});
  const container = fakeDocument.createElement('div');
  panel.render(container, 'settings');

  const row = container.querySelectorAll('[data-sc-setting="audio.muted"]')[0];
  row.querySelectorAll('[data-sc-set-toggle]')[0].click();

  assert.equal(ctx.settings.get('audio.muted'), true);
  assert.ok(ctx.audio.calls.some((c) => c[0] === 'muted' && c[1] === true));
  panel.dispose();
});

test('the resolution scale reaches the renderer', () => {
  const ctx = makeCtx();
  const panel = createSettingsPanel(ctx, {});
  const container = fakeDocument.createElement('div');
  panel.render(container, 'settings');

  const row = container.querySelectorAll('[data-sc-setting="display.resolutionScale"]')[0];
  const minus = row.querySelectorAll('[data-sc-set-step]')[0];
  minus.click();

  assert.equal(ctx.settings.get('display.resolutionScale'), 0.75);
  // 1 / 0.75 = 1.33 -> the renderer works in whole pixel sizes.
  assert.ok(ctx.renderer.calls.some((c) => c[0] === 'pixel' && c[1] === 1));
  panel.dispose();
});

test('the accessibility settings have real effects', () => {
  const ctx = makeCtx();
  const panel = createSettingsPanel(ctx, {});
  const container = fakeDocument.createElement('div');
  panel.render(container, 'accessibility');

  // Reduced effects: the post chain and the shadows go off.
  const effects = container.querySelectorAll('[data-sc-setting="accessibility.reducedEffects"]')[0];
  effects.querySelectorAll('[data-sc-set-toggle]')[0].click();
  assert.ok(ctx.renderer.calls.some((c) => c[0] === 'postfx' && c[1] === false),
    'the post chain is switched off');
  assert.ok(ctx.renderer.calls.some((c) => c[0] === 'shadows' && c[1] === false),
    'the shadows are switched off');

  // Text scale: the stylesheet variable.
  ctx.settings.set('accessibility.textScale', 1.25);
  applyUiEffects(ctx);
  assert.equal(fakeDocument.documentElement.style.getPropertyValue('--sc-text-scale'), '1.25',
    'the text scale reaches the stylesheet');

  // High contrast and the colour-blind channel are attributes on the root.
  ctx.settings.set('accessibility.highContrast', true);
  ctx.settings.set('accessibility.colourBlind', true);
  applyUiEffects(ctx);
  assert.equal(fakeDocument.documentElement.getAttribute('data-sc-contrast'), 'high');
  assert.equal(fakeDocument.documentElement.getAttribute('data-sc-colourblind'), '1');

  panel.dispose();
});

test('the reduced-shake setting is the camera\'s to read', () => {
  const ctx = makeCtx();
  ctx.settings.set('accessibility.reducedShake', true);
  assert.equal(ctx.settings.get('accessibility.reducedShake'), true,
    'the camera rig reads this setting itself');
  const panel = createSettingsPanel(ctx, {});
  const container = fakeDocument.createElement('div');
  panel.render(container, 'accessibility');
  const row = container.querySelectorAll('[data-sc-setting="accessibility.reducedShake"]')[0];
  assert.ok(row, 'the reduced-shake row exists');
  panel.dispose();
});

// ===========================================================================
// 3. The controls: rebinding and resetting
// ===========================================================================

test('the controls view lists every action and can rebind it', () => {
  const ctx = makeCtx();
  const panel = createSettingsPanel(ctx, {});
  const container = fakeDocument.createElement('div');
  panel.render(container, 'controls');

  const rows = container.querySelectorAll('[data-sc-control]');
  assert.equal(rows.length, Object.keys(DEFAULT_BINDINGS).length);
  assert.ok(rows.find((r) => r.dataset.scControl === 'camera.panUp'));

  // Start a rebind and press a key.
  const rebind = container.querySelectorAll('[data-sc-rebind="camera.panUp"]')[0];
  rebind.click();
  assert.equal(panel.isCapturing(), true);

  fakeWindow.dispatchEvent({
    type: 'keydown',
    code: 'KeyI',
    key: 'i',
    preventDefault() { },
    stopImmediatePropagation() { },
  });

  assert.equal(panel.isCapturing(), false, 'the capture is over');
  assert.equal(ctx.inputMap.primary('camera.panUp'), 'KeyI', 'the action is bound to the new key');
  assert.deepEqual(ctx.settings.get('input.bindings')['camera.panUp'], ['KeyI', 'KeyW', 'ArrowUp'],
    'the binding was persisted through the settings store');

  panel.dispose();
});

test('the bindings can be reset to the defaults', () => {
  const ctx = makeCtx();
  const panel = createSettingsPanel(ctx, {});
  const container = fakeDocument.createElement('div');
  panel.render(container, 'controls');

  ctx.inputMap.rebind('camera.panUp', 'KeyI');
  panel.persistBindings();
  assert.equal(ctx.inputMap.primary('camera.panUp'), 'KeyI');

  container.querySelectorAll('[data-sc-reset-all]')[0].click();
  assert.deepEqual(ctx.inputMap.get('camera.panUp'), DEFAULT_BINDINGS['camera.panUp'],
    'the default binding is back');
  assert.deepEqual(ctx.settings.get('input.bindings')['camera.panUp'], DEFAULT_BINDINGS['camera.panUp'],
    'and it was persisted');

  panel.dispose();
});

test('a single action can be reset', () => {
  const ctx = makeCtx();
  const panel = createSettingsPanel(ctx, {});
  const container = fakeDocument.createElement('div');
  panel.render(container, 'controls');

  ctx.inputMap.rebind('game.help', 'KeyJ');
  panel.persistBindings();

  container.querySelectorAll('[data-sc-reset-action="game.help"]')[0].click();
  assert.deepEqual(ctx.inputMap.get('game.help'), DEFAULT_BINDINGS['game.help']);
  panel.dispose();
});

test('the value formatting is honest about ratios and flags', () => {
  assert.equal(formatSettingValue('audio.master', SCHEMA['audio.master'], 0.7), '70%');
  assert.equal(formatSettingValue('audio.muted', SCHEMA['audio.muted'], true), 'ON');
  assert.equal(formatSettingValue('audio.muted', SCHEMA['audio.muted'], false), 'OFF');
  assert.equal(formatSettingValue('accessibility.textScale', SCHEMA['accessibility.textScale'], 1.25), '1.25');
});
