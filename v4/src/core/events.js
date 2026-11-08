/**
 * V4 — Event bus.
 *
 * One bus for the whole engine: gameplay events, editor events and runtime
 * errors all travel through it, so the AI "explain this error" tool can read
 * the same history the developer saw in the console panel.
 */

export function createEventBus({ historyLimit = 200 } = {}) {
  const handlers = new Map();
  const history = [];

  const bus = {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => bus.off(type, fn);
    },

    off(type, fn) {
      handlers.get(type)?.delete(fn);
    },

    once(type, fn) {
      const off = bus.on(type, (payload) => { off(); fn(payload); });
      return off;
    },

    emit(type, payload) {
      history.push({ type, payload, at: Date.now() });
      if (history.length > historyLimit) history.shift();
      const set = handlers.get(type);
      if (!set) return 0;
      let delivered = 0;
      for (const fn of [...set]) {
        try {
          fn(payload);
          delivered += 1;
        } catch (err) {
          // A broken listener must never take the frame down with it.
          console.error(`[v4/events] listener for "${type}" threw:`, err);
          bus.emit('error', { source: 'event-listener', type, error: String(err) });
        }
      }
      return delivered;
    },

    /** Recent events, newest last. Used by the editor console and the AI tools. */
    history(type = null) {
      return type ? history.filter((h) => h.type === type) : [...history];
    },

    clearHistory() { history.length = 0; },

    get listenerCount() {
      let n = 0;
      for (const set of handlers.values()) n += set.size;
      return n;
    },
  };
  return bus;
}

/** Event names used across V4 — one place, so nobody invents a typo. */
export const Events = {
  WORLD_READY: 'world:ready',
  FRAME: 'frame',
  SCENE_LOADED: 'scene:loaded',
  SCENE_SAVED: 'scene:saved',
  ENTITY_ADDED: 'entity:added',
  ENTITY_REMOVED: 'entity:removed',
  COMPONENT_ADDED: 'component:added',
  COMPONENT_REMOVED: 'component:removed',
  TRANSFORM_CHANGED: 'transform:changed',
  SELECTION_CHANGED: 'selection:changed',
  MODE_CHANGED: 'mode:changed',
  UNDO: 'editor:undo',
  REDO: 'editor:redo',
  PLAY_STATE: 'play:state',
  PAUSED: 'play:paused',
  INTERACTION: 'gameplay:interaction',
  NPC_STATE: 'npc:state',
  ANIMATION_STATE: 'anim:state',
  ANIMATION_EVENT: 'anim:event',
  ERROR: 'error',
  WARNING: 'warning',
  PERF_SAMPLE: 'perf:sample',
  LEVEL_COMPLETE: 'level:complete',
};
