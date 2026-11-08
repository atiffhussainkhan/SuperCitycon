/**
 * V4 — Settings store.
 *
 * Quality, mouse sensitivity and volume, persisted to localStorage when it
 * is available. The module never touches `localStorage` at import time and
 * works fine in Node (the storage is simply absent).
 */

const DEFAULTS = {
  quality: 'medium',
  sensitivity: 0.0022,
  volume: 0.8,
};

const CLAMPS = {
  sensitivity: [0.0005, 0.01],
  volume: [0, 1],
};

/**
 * @param {object} [opts]
 * @param {object} [opts.storage]  defaults to globalThis.localStorage
 * @param {string} [opts.key]
 * @param {object} [opts.defaults]
 */
export function createSettings({ storage = null, key = 'v4.settings', defaults = {} } = {}) {
  const store = storage ?? globalThis.localStorage ?? null;
  const base = { ...DEFAULTS, ...defaults };
  let values = { ...base };
  const listeners = new Set();

  function clamp(name, value) {
    const range = CLAMPS[name];
    if (!range) return value;
    return Math.min(range[1], Math.max(range[0], value));
  }

  function persist() {
    if (!store) return false;
    try {
      store.setItem(key, JSON.stringify(values));
      return true;
    } catch {
      return false;   // private mode / quota — the values stay in memory
    }
  }

  function notify(name) {
    for (const fn of listeners) {
      try { fn(values[name], values, name); } catch (err) { console.error('[v4/settings] listener threw:', err); }
    }
  }

  // Load the persisted values, if any.
  if (store) {
    try {
      const raw = store.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const name of Object.keys(base)) {
            if (parsed[name] !== undefined) values[name] = parsed[name];
          }
        }
      }
    } catch { /* unreadable storage — keep the defaults */ }
  }
  for (const name of Object.keys(base)) values[name] = clamp(name, values[name]);

  /**
   * Set one value.
   * @param {string} name
   * @param {any} value
   */
  function set(name, value) {
    if (!(name in values)) return false;
    const next = typeof value === 'number' ? clamp(name, value) : value;
    if (values[name] === next) return true;
    values[name] = next;
    persist();
    notify(name);
    return true;
  }

  return {
    /** The current values. */
    get values() { return { ...values }; },
    /** One value. */
    get(name) { return values[name]; },
    /** The quality preset name. */
    get quality() { return values.quality; },
    /** The mouse sensitivity. */
    get sensitivity() { return values.sensitivity; },
    /** The master volume. */
    get volume() { return values.volume; },
    /** The defaults this store started from. */
    get defaults() { return { ...base }; },

    set,
    /** Write several values at once. */
    setAll(next) {
      for (const [name, value] of Object.entries(next ?? {})) set(name, value);
      return { ...values };
    },
    /** Restore the defaults. */
    reset() {
      values = { ...base };
      persist();
      notify('*');
      return { ...values };
    },
    /** Subscribe to changes. Returns an unsubscribe function. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Re-read the values from storage. */
    reload() {
      if (!store) return { ...values };
      try {
        const raw = store.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed) for (const name of Object.keys(base)) {
          if (parsed[name] !== undefined) values[name] = parsed[name];
        }
      } catch { /* keep what we have */ }
      return { ...values };
    },
  };
}
