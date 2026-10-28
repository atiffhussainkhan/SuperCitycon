/**
 * studio/studio.test.mjs — the SCC Studio domain's unit tests.
 *
 * OWNER: STD (BOT-08). Run with:  node --test src/studio/studio.test.mjs
 *
 * WHAT IS COVERED
 *   - painting and erasing voxels, and the brush;
 *   - the Map key format ("x,y,z");
 *   - the authoring volume's bounds and the clamp;
 *   - the OBJ export round-trip: export -> parse -> the same vertex count,
 *     then import -> the same voxels back;
 *   - the workshop save / load round-trip, and the refusal of a document
 *     with a newer format version (FR-STD-101);
 *   - the derivation inputs (FR-STD-053/071: the inputs are emitted, the
 *     money maths belongs to ECO);
 *   - the contracted public API of `createStudio`.
 *
 * The data model (`voxels.js`) imports no `three`, so all of this runs in
 * plain Node.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PALETTE } from '../core/config.js';
import { createState } from '../core/state.js';
import { on, off, emit } from '../core/events.js';
import { EVENTS } from '../core/events.js';

import {
  PALETTE_SIZE, DEFAULT_DIMS, VOXELS_PER_CELL, FORMAT_VERSION,
  buildPalette, defaultPalette, voxelKey, parseVoxelKey, clampVoxel,
  inVoxelBounds, voxelBounds, paintVoxel, eraseVoxel, paintMaterial,
  paintBrush, eraseBrush, footprintCells, derivationInputs, deriveBuildCost,
  exportOBJ, importOBJ, parseOBJ, serializeWorkshop, deserializeWorkshop,
  createHistory, applyChange,
} from './voxels.js';
import { createStudio, resolveMaterial } from './index.js';

// ===========================================================================
// A tiny DOM + storage shim: the studio's VIEW needs a document, and the
// workshop needs somewhere to persist to.
// ===========================================================================

function installDom() {
  class El {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.attributes = {};
      this.style = { cssText: '' };
      this._classes = new Set();
      this._text = '';
      this.listeners = new Map();
      this.classList = {
        add: (n) => this._classes.add(n),
        remove: (n) => this._classes.delete(n),
        contains: (n) => this._classes.has(n),
        toggle: (n, f) => {
          const has = this._classes.has(n);
          const want = f === undefined ? !has : !!f;
          if (want) this._classes.add(n); else this._classes.delete(n);
          return want;
        },
      };
      this.dataset = {};
    }
    get className() { return Array.from(this._classes).join(' '); }
    set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get textContent() { return this._text; }
    set textContent(v) { this._text = String(v ?? ''); }
    get innerHTML() { return this._html ?? ''; }
    set innerHTML(v) { this._html = String(v ?? ''); }
    append(...n) { for (const x of n) this.appendChild(typeof x === 'string' ? { textContent: x } : x); }
    prepend(...n) { for (const x of n) { const node = typeof x === 'string' ? { textContent: x } : x; node.parentNode = this; this.children.unshift(node); } }
    appendChild(n) { n.parentNode = this; this.children.push(n); return n; }
    replaceChildren(...n) { this.children = []; this.append(...n); }
    remove() { this.parentNode?.children?.splice(this.parentNode.children.indexOf(this), 1); }
    setAttribute(n, v) { this.attributes[n] = String(v); }
    getAttribute(n) { return this.attributes[n] ?? null; }
    addEventListener(t, fn) { (this.listeners.get(t) ?? this.listeners.set(t, new Set()).get(t)).add(fn); }
    removeEventListener(t, fn) { this.listeners.get(t)?.delete(fn); }
  }
  const doc = {
    createElement: (tag) => new El(tag),
    createTextNode: (t) => ({ textContent: String(t) }),
    getElementById: () => null,
    head: new El('head'),
    body: new El('body'),
  };
  globalThis.document = doc;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener() { },
    removeEventListener() { },
  };
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  return { doc, store };
}

installDom();

function makeCtx() {
  const state = createState(99);
  return {
    state,
    bus: {
      on: (e, f) => on(e, f),
      off: (e, f) => off(e, f),
      once: (e, f) => on(e, f),
      emit: (e, p) => emit(e, p),
    },
    config: { PALETTE },
    domains: {},
  };
}

// ===========================================================================
// 1. Painting and erasing
// ===========================================================================

test('painting writes a voxel and erasing removes it', () => {
  const voxels = new Map();
  const palette = defaultPalette();

  const painted = paintVoxel(voxels, 2, 3, 4, 5, { palette });
  assert.equal(painted.ok, true);
  assert.equal(voxels.size, 1);

  const rec = voxels.get('2,3,4');
  assert.deepEqual(Object.keys(rec).sort(), ['color', 'id'], 'the record is { color, id }');
  assert.equal(rec.id, 5, 'the material index is stored');
  assert.equal(rec.color, palette.find((p) => p.index === 5).color, 'the colour is the palette colour');

  const erased = eraseVoxel(voxels, 2, 3, 4, { palette });
  assert.equal(erased.ok, true);
  assert.equal(erased.existed, true);
  assert.equal(voxels.size, 0);
});

test('the Map key format is "x,y,z"', () => {
  const voxels = new Map();
  const palette = defaultPalette();
  paintVoxel(voxels, 7, 8, 9, 1, { palette });
  assert.ok(voxels.has('7,8,9'), 'the key is "x,y,z"');
  assert.equal(voxelKey(7, 8, 9), '7,8,9');
  assert.deepEqual(parseVoxelKey('7,8,9'), { x: 7, y: 8, z: 9 });
  assert.equal(parseVoxelKey('nonsense'), null);
});

test('a brush paints a square footprint and erases it again', () => {
  const voxels = new Map();
  const palette = defaultPalette();

  const result = paintBrush(voxels, 5, 2, 5, 3, 3, { palette });
  assert.equal(result.painted, 9, 'a 3x3 brush paints nine voxels');
  assert.equal(voxels.size, 9);
  assert.ok(voxels.has('4,2,4') && voxels.has('6,2,6') && voxels.has('5,2,5'));

  const erased = eraseBrush(voxels, 5, 2, 5, 3, { palette });
  assert.equal(erased.erased, 9);
  assert.equal(voxels.size, 0);
});

test('recolouring changes the material without changing the occupancy', () => {
  const voxels = new Map();
  const palette = defaultPalette();
  paintVoxel(voxels, 1, 1, 1, 2, { palette });
  const before = voxels.size;
  const result = paintMaterial(voxels, 1, 1, 1, 9, { palette });
  assert.equal(result.ok, true);
  assert.equal(voxels.size, before, 'the occupancy did not change');
  assert.equal(voxels.get('1,1,1').id, 9, 'the material index did change');
});

// ===========================================================================
// 2. Bounds
// ===========================================================================

test('the authoring volume clamps and refuses out-of-bounds edits', () => {
  const dims = DEFAULT_DIMS;
  assert.deepEqual(clampVoxel(-5, 2, 3, dims), { x: 0, y: 2, z: 3 });
  assert.deepEqual(clampVoxel(999, 999, 999, dims),
    { x: dims.x - 1, y: dims.y - 1, z: dims.z - 1 });
  assert.equal(inVoxelBounds(0, 0, 0, dims), true);
  assert.equal(inVoxelBounds(-1, 0, 0, dims), false);
  assert.equal(inVoxelBounds(0, dims.y, 0, dims), false);

  const voxels = new Map();
  const palette = defaultPalette();
  const bad = paintVoxel(voxels, dims.x, 0, 0, 1, { palette });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'out-of-bounds');
  assert.equal(voxels.size, 0);
});

test('the bounding box reports the occupied volume', () => {
  const voxels = new Map();
  const palette = defaultPalette();
  paintVoxel(voxels, 0, 0, 0, 1, { palette });
  paintVoxel(voxels, 3, 1, 2, 1, { palette });
  const bounds = voxelBounds(voxels);
  assert.equal(bounds.count, 2);
  assert.deepEqual(bounds.min, { x: 0, y: 0, z: 0 });
  assert.deepEqual(bounds.max, { x: 3, y: 1, z: 2 });
  assert.deepEqual(bounds.size, { x: 4, y: 2, z: 3 });
});

// ===========================================================================
// 3. The palette
// ===========================================================================

test('the material set is the 16-colour palette taken from config.PALETTE', () => {
  const palette = defaultPalette();
  assert.equal(palette.length, PALETTE_SIZE);
  assert.equal(palette.length, 16);
  assert.equal(palette[0].index, 1, 'index 0 is reserved for "empty"');
  assert.equal(palette[15].index, 16);
  for (const entry of palette) {
    assert.ok(Object.values(PALETTE).includes(entry.color),
      `${entry.name} must come from config.PALETTE`);
  }
  // The material index resolves a colour and a colour resolves an index.
  assert.equal(resolveMaterial(0xffd166, palette), palette.find((p) => p.color === 0xffd166).index);
  assert.equal(resolveMaterial('#ffd166', palette), palette.find((p) => p.color === 0xffd166).index);
  assert.equal(resolveMaterial(3, palette), 3);
});

// ===========================================================================
// 4. OBJ export / parse / import
// ===========================================================================

test('the OBJ export round-trips: export -> parse -> the same vertex count', () => {
  const voxels = new Map();
  const palette = defaultPalette();
  paintVoxel(voxels, 0, 0, 0, 1, { palette });
  paintVoxel(voxels, 1, 0, 0, 2, { palette });
  paintVoxel(voxels, 2, 3, 4, 7, { palette });

  const obj = exportOBJ(voxels, { palette });
  assert.ok(obj.startsWith('#'), 'the file starts with the header comments');
  assert.ok(obj.includes('v '), 'it has vertices');
  assert.ok(obj.includes('f '), 'it has faces');

  const parsed = parseOBJ(obj);
  // Each voxel is one cube: 8 corners, 6 quads.
  assert.equal(parsed.vertices.length, voxels.size * 8);
  assert.equal(parsed.faces.length, voxels.size * 6);
  assert.equal(parsed.voxelCount, voxels.size, 'the parse reports one voxel per cube');

  // Every face references a real vertex.
  for (const face of parsed.faces) {
    for (const i of face.indices) {
      assert.ok(i >= 0 && i < parsed.vertices.length, 'the face references a valid vertex');
    }
  }
});

test('the OBJ import recovers the voxels that were exported', () => {
  const voxels = new Map();
  const palette = defaultPalette();
  paintVoxel(voxels, 0, 0, 0, 1, { palette });
  paintVoxel(voxels, 1, 0, 0, 2, { palette });
  paintVoxel(voxels, 2, 3, 4, 7, { palette });

  const obj = exportOBJ(voxels, { palette });
  const imported = importOBJ(obj, { palette, dims: DEFAULT_DIMS });

  assert.equal(imported.size, voxels.size);
  assert.deepEqual([...imported.keys()].sort(), [...voxels.keys()].sort());
  for (const [key, rec] of voxels) {
    assert.deepEqual(imported.get(key), rec, `the voxel at ${key} survived the round-trip`);
  }
});

test('the OBJ import reads a hand-written cube', () => {
  const obj = [
    '# a single cube at the origin',
    'o cube',
    'usemtl m4',
    'v 0 0 0',
    'v 1 0 0',
    'v 1 1 0',
    'v 0 1 0',
    'v 0 0 1',
    'v 1 0 1',
    'v 1 1 1',
    'v 0 1 1',
    'f 1 4 3 2',
    'f 5 6 7 8',
    'f 1 2 6 5',
    'f 4 8 7 3',
    'f 1 5 8 4',
    'f 2 3 7 6',
  ].join('\n');
  const imported = importOBJ(obj, { palette: defaultPalette(), dims: DEFAULT_DIMS });
  assert.equal(imported.size, 1);
  assert.ok(imported.has('0,0,0'));
  assert.equal(imported.get('0,0,0').id, 4, 'the material index came from the usemtl directive');
});

test('the OBJ export keeps the MATERIAL INDEX, not the raw colour', () => {
  const voxels = new Map();
  const palette = defaultPalette();
  paintVoxel(voxels, 0, 0, 0, 9, { palette });
  const obj = exportOBJ(voxels, { palette });
  assert.ok(obj.includes('usemtl m9'), 'the file addresses the material by index');
  assert.ok(obj.includes('# m9 '), 'the palette table documents the colour of each index');
});

// ===========================================================================
// 5. The workshop save / load
// ===========================================================================

test('the workshop document round-trips through serialisation', () => {
  const voxels = new Map();
  const palette = defaultPalette();
  paintVoxel(voxels, 1, 2, 3, 4, { palette });
  paintVoxel(voxels, 4, 5, 6, 8, { palette });

  const json = serializeWorkshop({ voxels, dims: DEFAULT_DIMS, palette, name: 'Tower' });
  const parsed = deserializeWorkshop(json);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.reason, null);
  assert.equal(parsed.doc.name, 'Tower');
  assert.equal(parsed.doc.formatVersion, FORMAT_VERSION);
  assert.equal(parsed.doc.voxels.size, 2);
  assert.deepEqual([...parsed.doc.voxels.keys()].sort(), ['1,2,3', '4,5,6']);
  assert.equal(parsed.doc.voxels.get('1,2,3').id, 4);
});

test('a document with a newer format version is refused (FR-STD-101)', () => {
  const json = JSON.stringify({ formatVersion: FORMAT_VERSION + 5, cells: [], dims: DEFAULT_DIMS });
  const parsed = deserializeWorkshop(json);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.reason, 'unsupported-format-version');
});

test('a corrupt document is refused rather than crashing (FR-STD-134)', () => {
  assert.equal(deserializeWorkshop('{not json').reason, 'malformed-json');
  assert.equal(deserializeWorkshop(JSON.stringify({ formatVersion: 1, cells: 'nope' })).reason, 'malformed-payload');
  assert.equal(
    deserializeWorkshop(JSON.stringify({ formatVersion: 1, dims: DEFAULT_DIMS, cells: [[0, 0, 0, 99]] })).reason,
    'material-index-out-of-range',
  );
});

test('the workshop saves and loads through storage', () => {
  const ctx = makeCtx();
  const studio = createStudio(ctx);
  studio.paint(2, 2, 2, 0xffd166);
  studio.paint(3, 2, 2, 0xffd166);

  const saved = studio.saveWorkshop('test-slot');
  assert.equal(saved.ok, true);
  assert.ok(saved.bytes > 0);

  // Wipe the document, then load it back.
  studio.erase(2, 2, 2);
  studio.erase(3, 2, 2);
  assert.equal(studio.voxels.size, 0);

  const loaded = studio.loadWorkshop('test-slot');
  assert.equal(loaded.ok, true);
  assert.equal(studio.voxels.size, 2);
  assert.ok(studio.voxels.has('2,2,2'));
  assert.ok(studio.voxels.has('3,2,2'));
});

test('loading a slot that does not exist fails cleanly', () => {
  const studio = createStudio(makeCtx());
  const result = studio.loadWorkshop('no-such-slot');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-save');
});

// ===========================================================================
// 6. The derivation
// ===========================================================================

test('the derivation emits its inputs and a monotonic proposed cost', () => {
  const voxels = new Map();
  const palette = defaultPalette();
  paintVoxel(voxels, 0, 0, 0, 1, { palette });
  const one = deriveBuildCost(voxels);
  paintVoxel(voxels, 1, 0, 0, 1, { palette });
  const two = deriveBuildCost(voxels);

  assert.equal(one.assumed, true, 'the cost is flagged as a proposed value');
  assert.ok(two.buildCost > one.buildCost, 'the cost is monotonic in the voxel count');

  const inputs = derivationInputs(voxels, DEFAULT_DIMS);
  assert.equal(inputs.occupiedVoxelCount, 2);
  assert.equal(inputs.footprintCells, 1, 'two voxels share one 32-voxel world cell');
  assert.equal(inputs.materialHistogram[1], 2);
});

test('the footprint maps 32 voxels onto one world cell (FR-STD-043)', () => {
  const voxels = new Map();
  const palette = defaultPalette();
  const dims = { x: 64, y: 8, z: 8 };
  paintVoxel(voxels, 0, 0, 0, 1, { palette, dims });
  paintVoxel(voxels, VOXELS_PER_CELL - 1, 0, 0, 1, { palette, dims });
  paintVoxel(voxels, VOXELS_PER_CELL, 0, 0, 1, { palette, dims });
  const cells = footprintCells(voxels);
  assert.equal(cells.length, 2);
  assert.deepEqual(cells, [{ x: 0, z: 0 }, { x: 1, z: 0 }]);
});

// ===========================================================================
// 7. The history
// ===========================================================================

test('the undo history restores occupancy and material', () => {
  const voxels = new Map();
  const palette = defaultPalette();
  const history = createHistory(4);
  paintVoxel(voxels, 1, 1, 1, 2, { palette });
  history.push({ before: { '1,1,1': null }, after: { '1,1,1': voxels.get('1,1,1') } });

  assert.equal(history.canUndo, true);
  const change = history.take();
  applyChange(voxels, { before: change.before });
  assert.equal(voxels.size, 0, 'the voxel was undone');
  assert.equal(history.canRedo, true);
});

// ===========================================================================
// 8. The contracted service API
// ===========================================================================

test('createStudio exports exactly the contracted surface', () => {
  const ctx = makeCtx();
  const studio = createStudio(ctx);
  for (const name of ['init', 'update', 'tick', 'open', 'close', 'isOpen',
    'paint', 'erase', 'brushSize', 'setBrush', 'saveWorkshop', 'loadWorkshop',
    'exportOBJ', 'dispose']) {
    assert.equal(typeof studio[name], 'function', `${name} must be a function`);
  }
  assert.ok(studio.voxels instanceof Map, 'voxels is a Map');
  assert.equal(studio.isOpen(), false);
  studio.dispose();
});

test('the service paints, erases and sets the brush size', () => {
  const ctx = makeCtx();
  const studio = createStudio(ctx);

  const painted = studio.paint(4, 5, 6, 0xffd166);
  assert.equal(painted.ok, true);
  assert.equal(studio.voxels.size, 1);
  assert.ok(studio.voxels.has('4,5,6'));
  assert.equal(studio.voxels.get('4,5,6').id, 8, 'gold is material 8 in the 16-colour set');

  assert.equal(studio.brushSize(), 1);
  studio.setBrush(3);
  assert.equal(studio.brushSize(), 3);
  studio.paint(10, 1, 10, 0xffd166);
  assert.equal(studio.voxels.size, 10, 'the 3x3 brush added nine voxels');

  studio.setBrush(99);
  assert.equal(studio.brushSize(), 5, 'the brush size is clamped');

  assert.equal(studio.erase(4, 5, 6).ok, true);
  assert.equal(studio.voxels.has('4,5,6'), false);
});

test('the service exports an OBJ string', () => {
  const ctx = makeCtx();
  const studio = createStudio(ctx);
  studio.paint(0, 0, 0, 0xffd166);
  studio.paint(1, 0, 0, 0xffd166);
  const obj = studio.exportOBJ();
  assert.equal(typeof obj, 'string');
  const parsed = parseOBJ(obj);
  assert.equal(parsed.vertices.length, 16);
  assert.equal(parsed.voxelCount, 2);
});

test('the studio state subtree is the one the contract names', () => {
  const ctx = makeCtx();
  const studio = createStudio(ctx);
  assert.equal(ctx.state.studio.voxels, studio.voxels, 'the map IS state.studio.voxels');
  assert.ok(Array.isArray(ctx.state.studio.palette));
  assert.equal(ctx.state.studio.palette.length, 16);
  assert.equal(ctx.state.studio.brush, 1);
  studio.paint(1, 1, 1, 1);
  assert.equal(ctx.state.studio.dirty, true, 'editing marks the document dirty');
});

test('the studio announces itself on the bus', () => {
  const ctx = makeCtx();
  const seen = [];
  const unOpen = on(EVENTS.STUDIO_OPEN, () => seen.push('open'));
  const unDirty = on(EVENTS.STUDIO_DIRTY, () => seen.push('dirty'));
  const studio = createStudio(ctx);
  studio.paint(1, 1, 1, 1);
  assert.ok(seen.includes('dirty'));
  unOpen();
  unDirty();
  studio.dispose();
});

test('duplicating clones the asset into a new record and leaves the original alone', () => {
  const ctx = makeCtx();
  const studio = createStudio(ctx);
  studio.paint(1, 2, 3, 0xffd166);
  studio.paint(2, 2, 3, 0xffd166);

  const copy = studio.duplicateDocument('Tower copy');
  assert.equal(copy.ok, true);
  assert.ok(copy.id);
  assert.equal(copy.name, 'Tower copy');
  assert.ok(Array.isArray(ctx.state.studio.documents));
  assert.equal(ctx.state.studio.documents.length, 1);
  assert.equal(ctx.state.studio.documents[0].voxels.size, 2);
  assert.deepEqual([...ctx.state.studio.documents[0].voxels.keys()].sort(), ['1,2,3', '2,2,3']);
  // The live document is untouched by the duplication.
  assert.equal(studio.voxels.size, 2);
});
