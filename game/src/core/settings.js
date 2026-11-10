/**
 * core/settings.js — the user's settings.
 *
 * OWNER: the integrator (core/).
 *
 * Settings are a USER preference, not part of the world: they belong to the
 * person playing, not to the city they are building. They are therefore kept
 * OUT of the save format and stored separately, so changing a volume never
 * rewrites a save and a save never carries a machine's audio setup to another
 * machine.
 *
 * Every setting is declared in `SCHEMA` with its type, default and range.
 * The store validates on write, so a corrupted localStorage record can never
 * put the game into an impossible state (a volume of 900, a text scale of
 * -3). A value that fails validation falls back to its default and is
 * reported, not silently accepted.
 *
 * Pure: this module imports nothing. `localStorage` is injected, so it is
 * unit-testable in Node.
 */

/** How a setting is presented and validated. */
export const SETTING_TYPES = Object.freeze({
  number: 'number',
  boolean: 'boolean',
  string: 'string',
  bindings: 'bindings',
  padBindings: 'padBindings',
});

/**
 * The settings the game understands.
 *
 * `key` is the flat path used everywhere else (`'audio.music'`). `section` is
 * only for grouping in the settings panel.
 */
export const SCHEMA = Object.freeze({
  // --- audio ------------------------------------------------------------
  'audio.master': { type: 'number', section: 'audio', default: 1, min: 0, max: 1, step: 0.05, label: 'Master volume' },
  'audio.music': { type: 'number', section: 'audio', default: 0.7, min: 0, max: 1, step: 0.05, label: 'Music volume' },
  'audio.sfx': { type: 'number', section: 'audio', default: 1, min: 0, max: 1, step: 0.05, label: 'Effects volume' },
  'audio.ambience': { type: 'number', section: 'audio', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Ambience volume' },
  'audio.ui': { type: 'number', section: 'audio', default: 0.8, min: 0, max: 1, step: 0.05, label: 'Interface volume' },
  'audio.muted': { type: 'boolean', section: 'audio', default: false, label: 'Mute all audio' },

  // --- display ----------------------------------------------------------
  'display.fullscreen': { type: 'boolean', section: 'display', default: false, label: 'Fullscreen' },
  'display.resolutionScale': { type: 'number', section: 'display', default: 1, min: 0.5, max: 2, step: 0.25, label: 'Resolution scale' },

  // --- accessibility ----------------------------------------------------
  'accessibility.reducedEffects': { type: 'boolean', section: 'accessibility', default: false, label: 'Reduced visual effects' },
  'accessibility.reducedShake': { type: 'boolean', section: 'accessibility', default: false, label: 'Reduced screen shake' },
  'accessibility.textScale': { type: 'number', section: 'accessibility', default: 1, min: 0.85, max: 1.6, step: 0.05, label: 'Text size' },
  'accessibility.colourBlind': { type: 'boolean', section: 'accessibility', default: false, label: 'Colour-blind safe indicators' },
  'accessibility.highContrast': { type: 'boolean', section: 'accessibility', default: false, label: 'High contrast' },

  // --- input ------------------------------------------------------------
  'input.bindings': { type: 'bindings', section: 'input', default: null, label: 'Key bindings' },
  'input.padBindings': { type: 'padBindings', section: 'input', default: null, label: 'Gamepad bindings' },
});

/** The storage key the settings live under. */
export const STORAGE_KEY = 'supercitycon:settings:v1';

/**
 * Validate one value against its schema entry.
 *
 * @param {string} key
 * @param {*} value
 * @returns {{ok:boolean, value:*}}
 */
export function validateSetting(key, value) {
  const def = SCHEMA[key];
  if (!def) return { ok: false, value: undefined };
  if (def.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, value: def.default };
    const clamped = Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, n));
    return { ok: clamped === n, value: clamped };
  }
  if (def.type === 'boolean') {
    const b = !!value;
    return { ok: b === value, value: b };
  }
  if (def.type === 'string') {
    const s = String(value ?? '');
    return { ok: s === value, value: s };
  }
  if (def.type === 'bindings') {
    // A bindings record is an object of action -> array of key codes.
    if (value === null || value === undefined) return { ok: true, value: null };
    if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, value: null };
    const out = {};
    for (const [action, codes] of Object.entries(value)) {
      if (!Array.isArray(codes)) continue;
      out[action] = codes.filter((c) => typeof c === 'string' && c.length > 0);
    }
    return { ok: true, value: out };
  }
  if (def.type === 'padBindings') {
    // A pad bindings record is an object of action -> array of BUTTON
    // INDICES. The indices are the standard gamepad mapping, so a stored
    // record works on any browser that reports a standard pad — the same
    // promise the key bindings make with `KeyboardEvent.code`.
    if (value === null || value === undefined) return { ok: true, value: null };
    if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, value: null };
    const out = {};
    for (const [action, indices] of Object.entries(value)) {
      if (!Array.isArray(indices)) continue;
      out[action] = indices.filter((i) => Number.isInteger(i) && i >= 0);
    }
    return { ok: true, value: out };
  }
  return { ok: false, value: def.default };
}

/**
 * Create the settings store.
 *
 * @param {object} [opts]
 * @param {object} [opts.storage] a `localStorage`-like object
 * @param {object} [opts.logger]   a logger for rejected values
 * @returns {object} the settings service
 */
export function createSettings({ storage = null, logger = null } = {}) {
  const values = {};
  for (const [key, def] of Object.entries(SCHEMA)) values[key] = def.default;

  const listeners = new Set();
  let rejected = 0;

  function readStored() {
    if (!storage) return null;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      logger?.warn?.('the settings record could not be read; the defaults are used', {
        error: String(err?.message ?? err),
      });
      return null;
    }
  }

  function apply(stored) {
    if (!stored) return;
    for (const [key, raw] of Object.entries(stored)) {
      if (!(key in SCHEMA)) continue;
      const { ok, value } = validateSetting(key, raw);
      if (!ok) {
        rejected += 1;
        logger?.warn?.('a stored setting was out of range and fell back to its default', {
          key, value: raw, fallback: value,
        });
      }
      values[key] = value;
    }
  }

  function persist() {
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(values));
      return true;
    } catch (err) {
      logger?.warn?.('the settings could not be saved', { error: String(err?.message ?? err) });
      return false;
    }
  }

  function notify(key, value) {
    for (const fn of listeners) {
      try { fn(key, value, values[key]); } catch { /* a broken listener must not break the game */ }
    }
  }

  /** Load the stored settings, applying the defaults for anything missing. */
  function load() {
    apply(readStored());
    return { ...values };
  }

  return {
    /** Every setting and its current value. */
    all() { return { ...values }; },
    /** One setting's value, or undefined for an unknown key. */
    get(key) { return values[key]; },
    /** The schema, for a settings panel to render from. */
    schema() { return SCHEMA; },

    /**
     * Write one setting.
     *
     * @returns {boolean} true when the value was accepted
     */
    set(key, value) {
      if (!(key in SCHEMA)) {
        logger?.warn?.('an unknown setting was ignored', { key });
        return false;
      }
      const { ok, value: safe } = validateSetting(key, value);
      if (!ok) rejected += 1;
      if (values[key] === safe) return true;
      values[key] = safe;
      persist();
      notify(key, safe);
      return true;
    },

    /** Write several settings at once, notifying once per changed key. */
    setMany(patch) {
      if (!patch || typeof patch !== 'object') return 0;
      let changed = 0;
      for (const [key, value] of Object.entries(patch)) {
        if (this.set(key, value)) changed += 1;
      }
      return changed;
    },

    /** Restore every setting to its default. */
    reset() {
      for (const [key, def] of Object.entries(SCHEMA)) values[key] = def.default;
      persist();
      for (const key of Object.keys(SCHEMA)) notify(key, values[key]);
      return { ...values };
    },

    /** Subscribe to changes. Returns an unsubscribe function. */
    onChange(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** How many stored values were rejected as out of range. */
    rejectedCount() { return rejected; },
    /** Persist the current values. */
    save() { return persist(); },
    /** Re-read from storage. */
    load,
    dispose() { listeners.clear(); },
  };
}
