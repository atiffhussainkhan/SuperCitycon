/**
 * core/save.js — CORE persistence.
 *
 * Save / load for a city session:
 *  - `serialize` / `deserialize` — a JSON round trip that survives Maps,
 *    Sets and typed arrays (the snapshot()/restore() helpers in core/state.js
 *    do the conversion; they are reused, never re-implemented).
 *  - `saveToStorage` / `loadFromStorage` / `listSaves` / `deleteSave` —
 *    localStorage slots (`supercitycon:save:<slot>`).
 *  - `exportSave` / `importSave` — a `.json` file in and out of the browser,
 *    Blob + anchor, no network access at all.
 *
 * Dossier: docs/requirements/01-core-loop-modes-progression.md
 *  - FR-CORE-001 (a save write is scoped to one session root),
 *  - FR-CORE-027 (a mode shall be re-enterable with an existing save),
 *  - NFR-CORE-008 (timed content must survive an application restart — the
 *    clock is restored with the state).
 *
 * The **save-file format** itself is owned by TEC; this module owns the
 * CORE-side slot bookkeeping and the state round trip.
 *
 * Failure discipline: a quota error, a missing `localStorage`, a corrupt
 * record or a half-written file never throws into the game loop — the
 * functions return `false` / `null`. Only `importSave` throws, and it
 * throws a *clear* Error because the caller asked for an explicit import.
 *
 * Pure logic: this module never imports `three`.
 */

import { snapshot, restore, setState, state as liveState } from './state.js';
import { EVENTS, emit } from './events.js';
import { currentStage } from './stage.js';

/** Current save-file format version. */
export const SAVE_VERSION = 1;

/** localStorage key prefix: `supercitycon:save:<slot>`. */
export const SAVE_KEY_PREFIX = 'supercitycon:save:';

/** Default slot used when the caller does not name one. */
export const DEFAULT_SLOT = '1';

/** localStorage key for a slot. */
export function saveKey(slot = DEFAULT_SLOT) {
  return `${SAVE_KEY_PREFIX}${slot}`;
}

/** The storage object, or null when the environment has none (e.g. Node). */
function getStorage() {
  try {
    const storage = globalThis.localStorage;
    return storage || null;
  } catch {
    return null;
  }
}

/** Typed-array constructors the snapshot format can carry. */
const TYPED_CTORS = Object.freeze({
  Float32Array,
  Float64Array,
  Uint8Array,
  Uint8ClampedArray,
  Uint16Array,
  Uint32Array,
  Int8Array,
  Int16Array,
  Int32Array,
});

/**
 * Repair the typed arrays that `restore()` leaves behind.
 *
 * `core/state.js` snapshots a typed array as `{ __typed: 'Float32Array', data: [...] }`
 * but its `reviveValue()` tests `Array.isArray(v.__typed)` — and `__typed` is a
 * *string*, so the marker is never recognised and the typed array comes back
 * as a plain object. `core/state.js` is integrator-owned, so this module
 * repairs the result instead of patching it there.
 *
 * See the CORE final report: `state.js` (~line 222) should read
 * `typeof v.__typed === 'string'` rather than `Array.isArray(v.__typed)`.
 */
function repairTypedArrays(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (ArrayBuffer.isView(value)) return value;
  if (value instanceof Map) {
    for (const [k, v] of Array.from(value.entries())) value.set(k, repairTypedArrays(v, seen));
    return value;
  }
  if (value instanceof Set) {
    for (const v of Array.from(value)) {
      value.delete(v);
      value.add(repairTypedArrays(v, seen));
    }
    return value;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) value[i] = repairTypedArrays(value[i], seen);
    return value;
  }
  if (typeof value.__typed === 'string' && Array.isArray(value.data)) {
    const Ctor = TYPED_CTORS[value.__typed] || Float32Array;
    return Ctor.from(value.data);
  }
  for (const key of Object.keys(value)) {
    value[key] = repairTypedArrays(value[key], seen);
  }
  return value;
}

/**
 * `restore()` plus the typed-array repair, in one place.
 *
 * `restore()` rebinds the module-level state to a **new** object. Everything
 * that captured the live state earlier (`ctx.state` in main.js, the domains'
 * references) would then keep pointing at the stale object, so the restored
 * city is copied back into the original object and the binding is re-pointed
 * at it — the identity of the live state survives a load.
 */
function restoreState(snapshotData) {
  const live = liveState;
  const restored = repairTypedArrays(restore(snapshotData));
  if (restored !== live) {
    for (const key of Object.keys(live)) delete live[key];
    Object.assign(live, restored);
    setState(live);
  }
  return live;
}

/**
 * Restore a snapshot **into** a given state object, in place.
 *
 * Used by `modes.js` when it puts a parked city back: the same typed-array
 * repair and the same identity guarantee as `restoreState`.
 *
 * @param {object} live the object to restore into
 * @param {object} snapshotData a snapshot produced by `snapshot()`
 * @returns {object} `live`
 */
export function restoreInto(live, snapshotData) {
  const restored = repairTypedArrays(restore(snapshotData));
  if (restored !== live) {
    for (const key of Object.keys(live)) delete live[key];
    Object.assign(live, restored);
    setState(live);
  }
  return live;
}

/**
 * Is this object a plausible state snapshot?
 *
 * A save must carry a `meta` object with a finite `seed`, and every known
 * subtree that is present must be a plain object. Without this guard a
 * half-written or hand-edited file (`{}`, `{"meta":"x"}`) would replace the
 * live city with nonsense.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const meta = value.meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  if (!Number.isFinite(meta.seed)) return false;

  for (const key of Object.keys(value)) {
    if (key === 'meta') continue;
    const subtree = value[key];
    if (subtree === null || subtree === undefined) continue;
    if (typeof subtree !== 'object' || Array.isArray(subtree)) return false;
  }
  return true;
}

function defaultName(state) {
  const explicit = state?.meta?.cityName;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  const seed = state?.meta?.seed;
  return `City ${seed ?? 0}`;
}

function stageLabel(state) {
  const stage = currentStage(state);
  if (!stage) return state?.meta?.stageId ?? null;
  return stage.name;
}

/**
 * Serialize the live state (or any state-shaped object) to JSON.
 * Maps, Sets and typed arrays survive the round trip.
 *
 * @param {object} [state]
 * @returns {string} JSON text
 */
export function serialize(state = liveState) {
  return JSON.stringify(snapshot(state));
}

/**
 * Rebuild a live state from JSON produced by `serialize`.
 *
 * The live state is restored as a side effect (via `restore()`), and the
 * restored object is returned. Corrupt input returns `null` and leaves the
 * live state untouched — it never throws.
 *
 * @param {string} json
 * @returns {object|null}
 */
export function deserialize(json) {
  if (typeof json !== 'string' || !json.trim()) return null;
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (!isSnapshot(parsed)) return null;
  try {
    return restoreState(parsed);
  } catch {
    return null;
  }
}

/**
 * Write a slot to localStorage.
 *
 * Stored record: `{ version: 1, savedAt: ISO string, name, stage, data }`.
 *
 * @param {object} [state]
 * @param {string} [slot]
 * @param {{name?: string}} [opts]
 * @returns {boolean} false on a quota error or when storage is unavailable
 */
export function saveToStorage(state = liveState, slot = DEFAULT_SLOT, opts = {}) {
  const storage = getStorage();
  if (!storage) return false;

  let record = null;
  try {
    record = buildRecord(state, opts);
    storage.setItem(saveKey(slot), JSON.stringify(record));
  } catch (err) {
    // Quota exceeded, storage disabled, private-mode restrictions, cyclic
    // data — none of them may reach the game loop.
    // eslint-disable-next-line no-console
    console.warn('[save] could not write slot', slot, '-', err && err.message);
    return false;
  }

  const stage = currentStage(state);
  emit(EVENTS.GAME_SAVED, {
    slot,
    name: record.name,
    stage: record.stage,
    stageId: stage ? stage.id : null,
    savedAt: record.savedAt,
  });
  return true;
}

/**
 * Read a slot back. The live state is restored as a side effect.
 *
 * @param {string} [slot]
 * @returns {object|null} the restored state, or null when the slot is empty,
 *   unreadable or corrupt.
 */
export function loadFromStorage(slot = DEFAULT_SLOT) {
  const storage = getStorage();
  if (!storage) return null;

  let raw = null;
  try {
    raw = storage.getItem(saveKey(slot));
  } catch {
    return null;
  }
  if (!raw) return null;

  let record = null;
  try {
    record = JSON.parse(raw);
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[save] slot', slot, 'holds corrupt JSON and was ignored');
    return null;
  }
  if (!record || typeof record !== 'object') return null;
  if (record.version !== SAVE_VERSION || !record.data || typeof record.data !== 'object') {
    // eslint-disable-next-line no-console
    console.warn('[save] slot', slot, 'has an unsupported format and was ignored');
    return null;
  }
  if (!isSnapshot(record.data)) {
    // eslint-disable-next-line no-console
    console.warn('[save] slot', slot, 'does not hold a valid city and was ignored');
    return null;
  }

  let restored = null;
  try {
    restored = restoreState(record.data);
  } catch {
    return null;
  }

  emit(EVENTS.GAME_LOADED, {
    slot,
    name: record.name ?? null,
    stage: record.stage ?? null,
    savedAt: record.savedAt ?? null,
  });
  return restored;
}

/**
 * Every stored slot, newest first.
 *
 * @returns {Array<{slot:string,name:string,date:string,stage:*,meta:object}>}
 */
export function listSaves() {
  const storage = getStorage();
  if (!storage) return [];

  const saves = [];
  let count = 0;
  try {
    count = storage.length;
  } catch {
    return [];
  }

  for (let i = 0; i < count; i += 1) {
    let key = null;
    try {
      key = storage.key(i);
    } catch {
      continue;
    }
    if (!key || !key.startsWith(SAVE_KEY_PREFIX)) continue;

    const slot = key.slice(SAVE_KEY_PREFIX.length);
    let raw = null;
    try {
      raw = storage.getItem(key);
    } catch {
      continue;
    }
    if (!raw) continue;

    let record = null;
    try {
      record = JSON.parse(raw);
    } catch {
      // A corrupt slot is listed as unreadable rather than thrown away.
      saves.push({ slot, name: '(corrupt save)', date: '', stage: null, meta: {}, corrupt: true });
      continue;
    }
    if (!record || typeof record !== 'object') continue;

    const data = record.data && typeof record.data === 'object' ? record.data : {};
    saves.push({
      slot,
      name: record.name ?? defaultName(data),
      date: record.savedAt ?? '',
      stage: record.stage ?? data?.meta?.stageId ?? null,
      meta: {
        day: data?.meta?.day ?? null,
        mode: data?.meta?.mode ?? null,
        seed: data?.meta?.seed ?? null,
        score: data?.meta?.score ?? null,
        speed: data?.meta?.speed ?? null,
        paused: data?.meta?.paused ?? null,
        stageIndex: data?.meta?.stageIndex ?? null,
        residents: data?.population?.total ?? null,
      },
      corrupt: false,
      // A save written by another build version cannot be loaded.
      unsupported: record.version !== SAVE_VERSION,
    });
  }

  saves.sort((a, b) => {
    const at = Date.parse(a.date || '') || 0;
    const bt = Date.parse(b.date || '') || 0;
    return bt - at;
  });
  return saves;
}

/**
 * Delete a slot.
 * @param {string} [slot]
 * @returns {boolean} true when a slot was removed
 */
export function deleteSave(slot = DEFAULT_SLOT) {
  const storage = getStorage();
  if (!storage) return false;
  const key = saveKey(slot);
  try {
    if (storage.getItem(key) === null) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build the save record for a state — the exact shape `exportSave` writes
 * and `importSave` reads back.
 */
export function buildRecord(state = liveState, opts = {}) {
  const stage = currentStage(state);
  return {
    version: SAVE_VERSION,
    savedAt: opts.savedAt || new Date().toISOString(),
    name: opts.name || defaultName(state),
    stage: stage ? stage.name : (state?.meta?.stageId ?? null),
    data: snapshot(state),
  };
}

/**
 * Download the city as a `.json` file. Blob + anchor, no network.
 *
 * The file holds the same record the storage slots use, so a file can be
 * dropped straight back in through `importSave`.
 *
 * @returns {boolean} false when there is no DOM (e.g. Node)
 */
export function exportSave(state = liveState, opts = {}) {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') return false;
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;

  let json;
  try {
    json = JSON.stringify(buildRecord(state, opts));
  } catch {
    return false;
  }

  const seed = state?.meta?.seed ?? 'city';
  const filename = opts.filename || `supercitycon-${seed}-${Date.now()}.json`;

  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoking straight away can cancel the download in Safari and Firefox.
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch { /* already revoked */ }
    }, 10000);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[save] export failed -', err && err.message);
    return false;
  }
}

/**
 * Read a `.json` file back. The live state is restored as a side effect.
 *
 * Accepts both the record envelope written by `exportSave` /
 * `saveToStorage` (`{ version, savedAt, name, stage, data }`) and a raw
 * snapshot.
 *
 * @param {string} text
 * @returns {object} the restored state
 * @throws {Error} with a clear message when the text is not a valid save
 */
export function importSave(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('save: import failed — no file content was provided');
  }
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`save: import failed — the file is not valid JSON (${err && err.message})`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('save: import failed — the file does not contain a SuperCitycon save');
  }

  // A record envelope …
  let data = parsed;
  if (parsed.version !== undefined && parsed.data && typeof parsed.data === 'object') {
    if (parsed.version !== SAVE_VERSION) {
      throw new Error(`save: import failed — the file uses save format v${parsed.version}, this build reads v${SAVE_VERSION}`);
    }
    data = parsed.data;
  }
  // … or a raw snapshot.
  if (!isSnapshot(data)) {
    throw new Error('save: import failed — the file does not contain a SuperCitycon save');
  }

  let restored = null;
  try {
    restored = restoreState(data);
  } catch (err) {
    throw new Error(`save: import failed — the save could not be restored (${err && err.message})`);
  }

  emit(EVENTS.GAME_LOADED, {
    slot: null,
    name: parsed.name || defaultName(restored),
    stage: stageLabel(restored),
    savedAt: parsed.savedAt ?? null,
  });
  return restored;
}

/**
 * Replace the live state with another state tree **in place**, so every
 * holder of the live state object (ctx.state, the domains) sees the change.
 *
 * @param {object} next
 * @returns {object} the live state
 */
export function applyState(next) {
  if (!next || typeof next !== 'object') return liveState;
  const live = liveState;
  if (next !== live) {
    for (const key of Object.keys(live)) delete live[key];
    Object.assign(live, next);
    setState(live);
  }
  return live;
}
