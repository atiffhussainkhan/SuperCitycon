/**
 * ui/menu.test.mjs — the main menu, the pause overlay and the credits.
 *
 * OWNER: UX (BOT-09). Run with:  node --test src/ui/menu.test.mjs
 *
 * These tests are REAL: they open the menu, drive the keyboard, click the
 * buttons and assert what reaches CORE. A tiny DOM shim stands in for the
 * browser (there is no jsdom in this project).
 *
 * WHAT IS COVERED
 *   - the pure models (the menu, the saves, the level select, the credits);
 *   - the credits against the REAL manifest and the REAL licence files;
 *   - the keyboard scheme (arrows / Enter / Escape) and the visible focus;
 *   - New Game and Continue actually calling CORE;
 *   - the exit page being honest about a browser tab.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createMenu, buildMenuModel, buildSavesModel, buildLevelSelectModel,
  MENU_ITEMS, PAUSE_ITEMS, buildCreditsModel,
} from './menu.js';
import { CREDIT_PACKS } from './panels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ===========================================================================
// A minimal DOM shim — enough to open the menu and drive it.
// ===========================================================================

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

class FakeElement {
  constructor(tag, doc) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.focused = false;
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
  click() {
    this.dispatchEvent({ type: 'click', button: 0, target: this, preventDefault() { } });
  }
  focus() { this.focused = true; }
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

/** A context with a fake CORE behind it. */
function makeCtx(overrides = {}) {
  return {
    state: { meta: { mode: 'play', day: 1 } },
    bus: { emit() { return 0; }, on() { return () => {}; } },
    domains: {},
    ...overrides,
  };
}

/** A fake CORE: the mode registry and the save store. */
function makeCore({ saves = [], modes = ['play', 'sandbox'] } = {}) {
  const calls = { startMode: [], loadFromStorage: [], listSaves: 0 };
  return {
    calls,
    core: {
      modes: {
        availableModes() { return modes.slice(); },
        startMode(mode, opts) { calls.startMode.push({ mode, opts }); return true; },
      },
      save: {
        listSaves() { calls.listSaves += 1; return saves.map((s) => ({ ...s })); },
        loadFromStorage(slot) { calls.loadFromStorage.push(slot); return { slot }; },
      },
    },
  };
}

/** The buttons of the open menu, in the order they are shown. */
function menuItems(menu) {
  return menu.el.querySelectorAll('[data-sc-menu-item]');
}

function press(target, key) {
  target.dispatchEvent({
    type: 'keydown',
    key,
    target,
    preventDefault() { },
    stopImmediatePropagation() { },
  });
}

// ===========================================================================
// 1. The pure models
// ===========================================================================

test('the main menu carries the eight items, in order', () => {
  assert.equal(MENU_ITEMS.length, 8);
  assert.deepEqual(MENU_ITEMS.map((i) => i.id), [
    'new-game', 'continue', 'level-select', 'settings',
    'controls', 'accessibility', 'credits', 'exit',
  ]);
});

test('the pause overlay carries Resume, Restart, Settings and Return to Menu', () => {
  assert.deepEqual(PAUSE_ITEMS.map((i) => i.id), ['resume', 'restart', 'settings', 'return-to-menu']);
});

test('the menu model enables Continue only when there is a save to continue', () => {
  const empty = buildMenuModel({ saves: [], modes: ['play'] });
  const continueItem = empty.items.find((i) => i.id === 'continue');
  assert.equal(continueItem.enabled, false, 'Continue is dead without a save');
  assert.match(continueItem.hint, /no saves/i);

  const withSave = buildMenuModel({ saves: [{ slot: '1' }], modes: ['play'] });
  assert.equal(withSave.items.find((i) => i.id === 'continue').enabled, true);
  assert.equal(withSave.saveCount, 1);
});

test('the save model drops the rubbish and keeps the slot', () => {
  const model = buildSavesModel([
    { slot: '1', name: 'City', date: '2026-01-01', stage: 'stage-1' },
    null,
    'nonsense',
    { name: 'no slot' },
  ]);
  assert.equal(model.length, 1);
  assert.equal(model[0].slot, '1');
  assert.equal(model[0].name, 'City');
  assert.equal(model[0].stage, 'stage-1');
});

test('the level select lists the modes CORE offers and the published stages', () => {
  const model = buildLevelSelectModel({
    modes: ['play', 'sandbox'],
    stages: [{ id: 'stage-1', name: 'First Foundations', description: 'x', order: 1, goals: [{ label: 'roads', target: 4, unit: 'cells' }] }],
  });
  assert.deepEqual(model.modes.map((m) => m.id), ['play', 'sandbox']);
  assert.equal(model.modes[0].label, 'City Life');
  assert.equal(model.stages.length, 1);
  assert.equal(model.stages[0].name, 'First Foundations');
  assert.equal(model.stages[0].goals[0].label, 'roads');
  // CORE publishes no "start at stage N" entry point, so a stage must not
  // pretend to be a button that works.
  assert.equal(model.stages[0].selectable, false);
});

// ===========================================================================
// 2. The credits — the REAL packs and the REAL licences
// ===========================================================================

test('the credits list the packs that actually ship, with their real licences', () => {
  const manifest = JSON.parse(readFileSync(path.join(HERE, '../data/manifest.json'), 'utf8'));
  const model = buildCreditsModel();

  assert.equal(model.packs.length, Object.keys(manifest.packs).length,
    'every shipped pack is credited');

  for (const pack of model.packs) {
    const real = manifest.packs[pack.id];
    assert.ok(real, `${pack.id} is not a pack in the manifest`);
    assert.equal(pack.display, real.display, `${pack.id} name`);
    assert.equal(pack.author, real.author, `${pack.id} author`);
    assert.equal(pack.licence, real.licence, `${pack.id} licence`);
    assert.ok(pack.licenceFiles.length > 0, `${pack.id} names its licence file`);
  }
});

test('every licence file the credits name exists in public/assets/LICENSES', () => {
  const dir = path.join(HERE, '../../public/assets/LICENSES');
  const onDisk = new Set(readdirSync(dir));
  const named = new Set();

  for (const pack of CREDIT_PACKS) {
    for (const file of pack.licenceFiles) {
      const base = path.basename(file);
      named.add(base);
      assert.ok(onDisk.has(base), `${base} is named by the credits but is not in the folder`);
      assert.ok(existsSync(path.join(dir, base)), `${base} does not exist`);
    }
  }

  // And no licence file is left uncredited.
  for (const file of onDisk) {
    assert.ok(named.has(file), `${file} ships but the credits do not name it`);
  }
});

test('the credits are honest about the 2D art', () => {
  const model = buildCreditsModel();
  const notes = model.notes.join(' ');
  assert.match(notes, /2D/i);
  assert.match(notes, /does NOT ship/i);
  // The 2D art is not a shipped pack, so it must not be credited as one.
  assert.equal(model.packs.find((p) => /ui|2d/i.test(p.id)), undefined);
});

// ===========================================================================
// 3. The overlay: keyboard, focus and the CORE-backed actions
// ===========================================================================

test('the menu opens with the eight items and a visible focus', () => {
  const ctx = makeCtx();
  const menu = createMenu(ctx, {});
  assert.equal(menu.open('main'), true);
  assert.equal(menu.isOpen(), true);
  assert.equal(menu.view(), 'main');

  const items = menuItems(menu);
  assert.equal(items.length, 8);
  assert.ok(items[0].classList.contains('is-focused'), 'the first item carries the focus');
  assert.equal(items[0].focused, true, 'the focused item is really focused');

  menu.close();
  assert.equal(menu.isOpen(), false);
  menu.dispose();
});

test('the arrow keys move the focus and Enter activates the item', () => {
  const ctx = makeCtx();
  const menu = createMenu(ctx, {});
  menu.open('main');

  const items = menuItems(menu);
  press(items[0], 'ArrowDown');
  assert.ok(items[1].classList.contains('is-focused'), 'the focus moved down');
  assert.equal(items[0].classList.contains('is-focused'), false);

  // Enter on "Continue" opens the continue view.
  press(items[1], 'Enter');
  assert.equal(menu.view(), 'continue');

  menu.dispose();
});

test('a key press that lands on the window does not throw', () => {
  const ctx = makeCtx();
  const menu = createMenu(ctx, {});
  menu.open('main');

  // When nothing is focused the target is the WINDOW, which is not a Node:
  // `contains()` throws on it, and that would silence every shortcut.
  const event = { type: 'keydown', key: 'ArrowDown', target: fakeWindow, preventDefault() { } };
  assert.doesNotThrow(() => fakeWindow.dispatchEvent(event),
    'the window-target shortcut must not throw');

  const items = menuItems(menu);
  assert.ok(items[1].classList.contains('is-focused'), 'and it still moves the focus');

  menu.dispose();
});

test('Escape walks back out of the menu', () => {
  const ctx = makeCtx();
  const menu = createMenu(ctx, {});
  menu.open('main');
  press(menuItems(menu)[6], 'Enter');       // Credits
  assert.equal(menu.view(), 'credits');
  press(menu.el, 'Escape');
  assert.equal(menu.view(), 'main', 'Escape goes back to the main menu');
  press(menu.el, 'Escape');
  assert.equal(menu.isOpen(), false, 'Escape closes the main menu');

  menu.dispose();
});

test('New Game starts a fresh city through CORE', () => {
  const { core, calls } = makeCore();
  const ctx = makeCtx({ core });
  const menu = createMenu(ctx, {});
  menu.open('main');

  menuItems(menu)[0].click();      // New Game

  assert.equal(calls.startMode.length, 1);
  assert.equal(calls.startMode[0].mode, 'play');
  assert.equal(calls.startMode[0].opts.fresh, true, 'a new game starts a FRESH city');
  assert.equal(menu.isOpen(), false, 'the menu closes after a new game');

  menu.dispose();
});

test('Continue lists the real saves and loads the one that is clicked', () => {
  const { core, calls } = makeCore({
    saves: [
      { slot: '1', name: 'First city', date: '2026-01-01', stage: 'stage-1' },
      { slot: '2', name: 'Second city', date: '2026-02-02', stage: 'stage-2' },
    ],
  });
  const ctx = makeCtx({ core });
  const menu = createMenu(ctx, {});
  menu.open('main');

  menuItems(menu)[1].click();      // Continue
  assert.equal(menu.view(), 'continue');

  const saveButtons = menu.el.querySelectorAll('[data-sc-menu-save]');
  assert.equal(saveButtons.length, 2, 'both saves are listed');
  saveButtons[1].click();

  assert.deepEqual(calls.loadFromStorage, ['2'], 'the clicked slot is loaded');
  assert.equal(menu.isOpen(), false);

  menu.dispose();
});

test('the level select starts a mode through CORE', () => {
  const { core, calls } = makeCore();
  const ctx = makeCtx({ core });
  const menu = createMenu(ctx, {});
  menu.open('main');
  menuItems(menu)[2].click();      // Level Select
  assert.equal(menu.view(), 'levels');

  const modeButtons = menu.el.querySelectorAll('[data-sc-menu-mode]');
  assert.equal(modeButtons.length, 2);
  modeButtons[1].click();
  assert.equal(calls.startMode[0].mode, 'sandbox');

  menu.dispose();
});

test('the key press that opens the menu does not act on it', () => {
  const ctx = makeCtx();
  const menu = createMenu(ctx, {});

  // This is what the browser does: the HUD opens the pause overlay from
  // its own key handler, and the SAME key event then reaches the menu.
  // Without a guard, Space would press "Resume" in the overlay it just
  // opened and the pause menu would flash and vanish.
  const event = { type: 'keydown', key: ' ', target: fakeWindow, preventDefault() { } };
  menu.open('pause', { event });
  fakeWindow.dispatchEvent(event);

  assert.equal(menu.isOpen(), true, 'the menu is still open');
  assert.equal(menu.view(), 'pause');
  menu.dispose();
});

test('the BACK control returns to the view it came from', () => {
  const ctx = makeCtx();
  const menu = createMenu(ctx, {});
  menu.open('main');
  menuItems(menu)[3].click();          // Settings
  assert.equal(menu.view(), 'settings');

  const back = menu.el.querySelectorAll('[data-sc-menu-back]')[0];
  back.click();
  assert.equal(menu.view(), 'main', 'BACK goes back to the main menu');
  menu.dispose();
});

test('the pause overlay pauses the session and offers the four actions', () => {
  const paused = [];
  const ctx = makeCtx();
  const menu = createMenu(ctx, { onPause: (p) => paused.push(p) });
  menu.open('pause');

  const items = menuItems(menu);
  assert.deepEqual(items.map((i) => i.dataset.scMenuItem), ['resume', 'restart', 'settings', 'return-to-menu']);
  assert.deepEqual(paused, [true], 'opening the overlay pauses the session');

  items[0].click();               // Resume
  assert.deepEqual(paused, [true, false], 'resuming unpauses the session');
  assert.equal(menu.isOpen(), false);

  menu.dispose();
});

test('the exit page is honest: a page cannot close its own tab', () => {
  const ctx = makeCtx();
  const menu = createMenu(ctx, {});
  menu.open('main');
  menuItems(menu)[7].click();     // Exit
  assert.equal(menu.view(), 'exit');

  const text = menu.el.textContent;
  assert.match(text, /cannot close its own tab/i);

  const buttons = menu.el.querySelectorAll('[data-sc-menu-item]');
  assert.deepEqual(buttons.map((b) => b.dataset.scMenuItem), ['copy-link', 'back-to-city']);

  // "Back to the city" closes the overlay and returns to the game.
  buttons[1].click();
  assert.equal(menu.isOpen(), false);

  menu.dispose();
});

test('the menu survives a build without CORE', () => {
  const ctx = makeCtx();          // NO ctx.core at all
  const menu = createMenu(ctx, {});
  menu.open('main');
  assert.doesNotThrow(() => menuItems(menu)[0].click());
  assert.equal(menu.isOpen(), true, 'the menu stays open when CORE is missing');
  menu.dispose();
});

test('the menu overlay is mounted into the container', () => {
  const ctx = makeCtx();
  const menu = createMenu(ctx, {});
  const container = fakeDocument.createElement('div');
  menu.mount(container);
  assert.equal(container.children.length, 0, 'mounting does not touch the DOM yet');
  menu.open('main');
  assert.equal(container.children.length, 1, 'the overlay joins the container');
  menu.close();
  menu.dispose();
});
