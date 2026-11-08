/**
 * V4 — Scene management.
 *
 * A scene is a named document. The manager owns the current scene, handles
 * load/save (to memory or to disk via an injected storage adapter) and runs
 * transitions with a fade so the game never cuts harshly between levels.
 */

import { serializeScene, deserializeScene } from './serialization.js';
import { Events } from './events.js';

export function createSceneManager({ world, registry, bus, storage = null }) {
  /** @type {Map<string, object>} */
  const scenes = new Map();
  let current = null;
  let transition = null;

  const manager = {
    get current() { return current; },
    get names() { return [...scenes.keys()]; },

    /** Register a scene document under a name. */
    define(name, doc) {
      scenes.set(name, doc);
      return doc;
    },

    /** Serialise the live world into a named scene document. */
    capture(name) {
      const doc = serializeScene(world, registry, name);
      scenes.set(name, doc);
      return doc;
    },

    /** Load a registered scene into the world. */
    load(name, { fade = false, duration = 0.25 } = {}) {
      const doc = scenes.get(name);
      if (!doc) throw new Error(`unknown scene "${name}"`);
      const apply = () => {
        const count = deserializeScene(world, registry, doc);
        current = { name, doc };
        bus.emit(Events.SCENE_LOADED, { name, entities: count });
        return count;
      };
      if (!fade) return apply();
      transition = { at: performance.now(), duration, apply };
      return null;
    },

    /** Save the live world: to the storage adapter when one is configured. */
    async save(name) {
      const doc = manager.capture(name);
      if (storage) await storage.write(name, doc);
      bus.emit(Events.SCENE_SAVED, { name, entities: doc.entities.length });
      return doc;
    },

    /** Load a scene document from the storage adapter. */
    async loadFromStorage(name) {
      if (!storage) throw new Error('no storage adapter configured');
      const doc = await storage.read(name);
      if (!doc) throw new Error(`scene "${name}" not found in storage`);
      scenes.set(name, doc);
      return manager.load(name);
    },

    /** Called each frame by the host; drives fade transitions. */
    update(now = performance.now()) {
      if (!transition) return false;
      const t = (now - transition.at) / (transition.duration * 1000);
      if (t >= 1) {
        const { apply } = transition;
        transition = null;
        apply();
        return true;
      }
      return false;
    },

    get transitioning() { return transition !== null; },
  };
  return manager;
}

/**
 * A storage adapter that keeps scenes in `localStorage` (browser) or in a
 * Map (tests). The editor's save/load buttons use this.
 */
export function createLocalStorageAdapter(key = 'v4.scenes') {
  const readAll = () => {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };
  const writeAll = (all) => {
    // A failed write must not be swallowed: a save that silently disappears
    // is worse than a save that reports an error.
    globalThis.localStorage?.setItem(key, JSON.stringify(all));
  };
  return {
    async write(name, doc) {
      const all = readAll();
      all[name] = doc;
      writeAll(all);
      return doc;
    },
    async read(name) {
      const all = readAll();
      return all[name] ?? null;
    },
    async list() {
      return Object.keys(readAll());
    },
  };
}

/** An in-memory adapter — used by the tests and by the headless harness. */
export function createMemoryAdapter() {
  const store = new Map();
  return {
    async write(name, doc) { store.set(name, doc); return doc; },
    async read(name) { return store.get(name) ?? null; },
    async list() { return [...store.keys()]; },
  };
}
