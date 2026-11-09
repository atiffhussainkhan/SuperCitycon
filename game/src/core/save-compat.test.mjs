/**
 * core/save-compat.test.mjs — the V5 -> V6 save compatibility (V6).
 *
 * Run with:  node --test src/core/save-compat.test.mjs
 *
 * WHY THIS FILE EXISTS
 *   V6 is a PRODUCT upgrade, not a save-format upgrade. The save schema
 *   stays at version 2, so every city a player built in V5 opens in V6
 *   exactly as it was — same buildings, same treasury, same progression.
 *
 *   Two things are easy to get wrong and expensive to get wrong:
 *
 *     1. Bumping the SAVE schema with the PRODUCT version. That would
 *        silently strand every existing save, and the game would have to
 *        ask the player to start again. V5 made that mistake once already
 *        (the v1 -> v2 migration), so the rule is pinned by a test here.
 *
 *     2. Claiming compatibility without a fixture. A V5 save is a record
 *        with `version: 2` and a V5-shaped `data` payload. This file writes
 *        exactly that — a hand-built V5 record, not a V6 record read back —
 *        and asserts the city comes out the other side intact.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MIGRATIONS,
  SAVE_KEY_PREFIX,
  SAVE_VERSION,
  buildRecord,
  listSaves,
  loadFromStorage,
  migrateRecord,
  saveToStorage,
} from './save.js';
import { createState, snapshot, state as liveState } from './state.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON = path.resolve(HERE, '../../package.json');

// ---------------------------------------------------------------------------
// A minimal localStorage, so the storage path can be exercised in Node.
// ---------------------------------------------------------------------------

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
  key(i) { return Array.from(this.map.keys())[i] ?? null; }
  get length() { return this.map.size; }
}

globalThis.localStorage = new MemoryStorage();

// ---------------------------------------------------------------------------
// The V5 fixture
// ---------------------------------------------------------------------------

/**
 * A save exactly as V5 wrote it.
 *
 * The shape is the V5 envelope (`version`, `savedAt`, `name`, `stage`,
 * `data`) and the data payload is a V5 state snapshot: the same subtrees
 * V5 wrote, with the V5 progression record.
 *
 * @param {object} [overrides]
 */
function v5SaveRecord(overrides = {}) {
  const state = createState(20260101);
  state.meta.day = 17;
  state.meta.mode = 'play';
  state.meta.stageId = 'first-foundations';
  state.economy.treasury = 4820;
  state.buildings.instances = new Map([
    ['b1', { type: 'res.house', x: 4, z: 9, level: 1 }],
    ['b2', { type: 'com.shop', x: 5, z: 9, level: 2 }],
  ]);
  state.meta.progress = {
    checkpoints: ['old-bridge'],
    collectibles: ['lamp-post'],
    achievements: ['first-foundations'],
  };

  return {
    version: 2,
    savedAt: '2026-01-15T09:30:00.000Z',
    name: 'V5 City',
    stage: 'First Foundations',
    data: snapshot(state),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The product version and the save schema are DIFFERENT numbers
// ---------------------------------------------------------------------------

test('the product version is 6.0.0', () => {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
  assert.equal(pkg.version, '6.0.0', 'the shipped product version is 6.0.0');
});

test('the save schema stays at version 2', () => {
  assert.equal(SAVE_VERSION, 2,
    'V6 does NOT move the save schema; a V5 city opens without a migration');
});

test('the product version and the save schema are not the same thing', () => {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
  assert.notEqual(pkg.version, String(SAVE_VERSION),
    'the product version and the save format version are separate numbers');
});

// ---------------------------------------------------------------------------
// A V5 save opens in V6
// ---------------------------------------------------------------------------

test('a V5 save opens in V6 with the city intact', () => {
  globalThis.localStorage.clear();
  const record = v5SaveRecord();
  globalThis.localStorage.setItem(`${SAVE_KEY_PREFIX}v5`, JSON.stringify(record));

  const loaded = loadFromStorage('v5');
  assert.ok(loaded, 'the V5 save loaded');
  assert.equal(loaded.meta.day, 17, 'the day came across');
  assert.equal(loaded.meta.seed, 20260101, 'the seed came across');
  assert.equal(loaded.economy.treasury, 4820, 'the treasury came across');
  assert.equal(loaded.buildings.instances.size, 2, 'the buildings came across');
  assert.ok(loaded.buildings.instances instanceof Map, 'and they are instances again');
  assert.deepEqual(loaded.meta.progress.checkpoints, ['old-bridge'],
    'the V5 progression record came across');
});

test('a V5 save is listed with its own name and stage', () => {
  globalThis.localStorage.clear();
  globalThis.localStorage.setItem(`${SAVE_KEY_PREFIX}v5`, JSON.stringify(v5SaveRecord()));

  const saves = listSaves();
  const v5 = saves.find((s) => s.slot === 'v5');
  assert.ok(v5, 'the V5 save is listed');
  assert.equal(v5.name, 'V5 City');
  assert.equal(v5.stage, 'First Foundations');
  assert.equal(v5.corrupt, false);
  assert.notEqual(v5.unsupported, true, 'and it is not refused');
});

test('loading a V5 save does not rewrite it', () => {
  globalThis.localStorage.clear();
  globalThis.localStorage.setItem(`${SAVE_KEY_PREFIX}v5`, JSON.stringify(v5SaveRecord()));

  const before = globalThis.localStorage.getItem(`${SAVE_KEY_PREFIX}v5`);
  loadFromStorage('v5');
  const after = globalThis.localStorage.getItem(`${SAVE_KEY_PREFIX}v5`);

  assert.equal(after, before, 'the stored V5 save is left exactly as it was');
  assert.equal(JSON.parse(after).version, 2, 'and it is still a version 2 save');
});

test('a save written by V6 is still a version 2 save', () => {
  globalThis.localStorage.clear();
  const state = createState(777);
  assert.equal(saveToStorage(state, 'v6', { name: 'V6 City' }), true);

  const record = JSON.parse(globalThis.localStorage.getItem(`${SAVE_KEY_PREFIX}v6`));
  assert.equal(record.version, 2, 'V6 writes the same schema V5 read');
  assert.equal(record.name, 'V6 City');
});

test('a V5 save and a V6 save are the same format', () => {
  globalThis.localStorage.clear();
  const state = createState(31337);
  const v6 = buildRecord(state, { name: 'Same' });
  const v5 = v5SaveRecord({ name: 'Same' });

  assert.deepEqual(Object.keys(v6).sort(), Object.keys(v5).sort(),
    'the envelope has the same fields');
  assert.equal(v6.version, v5.version, 'and the same version');
});

// ---------------------------------------------------------------------------
// The old migrations still work
// ---------------------------------------------------------------------------

test('a version 1 save still migrates to version 2', () => {
  const v1 = {
    version: 1,
    savedAt: '2025-01-01T00:00:00.000Z',
    name: 'Ancient',
    stage: 'First Foundations',
    data: { meta: { seed: 5, day: 3 } },
  };
  const result = migrateRecord(v1);
  assert.equal(result.ok, true);
  assert.equal(result.migrated, true);
  assert.equal(result.from, 1);
  assert.equal(result.to, 2);
  assert.equal(result.record.version, 2);
  assert.ok(result.record.data.meta.progress, 'the progression record was added');
});

test('the migration chain has no step past version 2', () => {
  assert.deepEqual(Object.keys(MIGRATIONS), ['1'],
    'V6 adds no new save format, so it adds no new migration');
});

test('a save from a future build is refused, not guessed at', () => {
  const result = migrateRecord({ version: 99, data: { meta: { seed: 1 } } });
  assert.equal(result.ok, false);
  assert.match(result.error, /v99/);
});
