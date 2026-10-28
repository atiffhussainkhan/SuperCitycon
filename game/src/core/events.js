/**
 * core/events.js — the game's single event bus.
 *
 * Domains never import each other directly for side effects; they emit and
 * subscribe here. This keeps the ten domain modules decoupled and lets the
 * integrator re-wire them freely.
 */

const listeners = new Map();

/** Canonical event names. Use these constants, not string literals. */
export const EVENTS = Object.freeze({
  // lifecycle
  GAME_READY: 'game:ready',
  GAME_RESET: 'game:reset',
  GAME_SAVED: 'game:saved',
  GAME_LOADED: 'game:loaded',
  MODE_CHANGED: 'mode:changed',
  STAGE_ADVANCED: 'stage:advanced',

  // time
  TICK: 'tick',
  DAY_CHANGED: 'time:day',
  SPEED_CHANGED: 'time:speed',
  PAUSE_CHANGED: 'time:pause',

  // economy
  MONEY_CHANGED: 'economy:money',
  BUDGET_CHANGED: 'economy:budget',
  TRANSACTION: 'economy:transaction',

  // population
  POPULATION_CHANGED: 'population:changed',
  HAPPINESS_CHANGED: 'population:happiness',
  LOYALTY_CHANGED: 'population:loyalty',

  // world / build
  TERRAIN_CHANGED: 'world:terrain',
  BUILDING_PLACED: 'build:placed',
  BUILDING_REMOVED: 'build:removed',
  BUILDING_UPGRADED: 'build:upgraded',
  ZONE_CHANGED: 'build:zone',

  // mobility
  ROAD_NETWORK_CHANGED: 'mobility:network',
  TRAFFIC_CHANGED: 'mobility:traffic',

  // services
  COVERAGE_CHANGED: 'services:coverage',

  // ui
  TOAST: 'ui:toast',
  TOOL_CHANGED: 'ui:tool',
  SELECTION_CHANGED: 'ui:selection',
  HOVER_CHANGED: 'ui:hover',
  OPEN_PANEL: 'ui:panel',
  CLOSE_PANEL: 'ui:panel:close',

  // studio
  STUDIO_OPEN: 'studio:open',
  STUDIO_CLOSE: 'studio:close',
  STUDIO_DIRTY: 'studio:dirty',
});

/** Subscribe to an event. Returns an unsubscribe function. */
export function on(evt, fn) {
  if (typeof evt !== 'string' || typeof fn !== 'function') {
    throw new TypeError('on(evt: string, fn: Function)');
  }
  let set = listeners.get(evt);
  if (!set) { set = new Set(); listeners.set(evt, set); }
  set.add(fn);
  return () => off(evt, fn);
}

/** Subscribe for a single delivery. */
export function once(evt, fn) {
  const un = on(evt, (payload) => { un(); fn(payload); });
  return un;
}

/** Unsubscribe a specific handler. */
export function off(evt, fn) {
  const set = listeners.get(evt);
  if (!set) return false;
  const removed = set.delete(fn);
  if (set.size === 0) listeners.delete(evt);
  return removed;
}

/**
 * Emit an event. Handlers are copied before iteration so a handler may
 * safely subscribe/unsubscribe during dispatch. A throwing handler is logged
 * and does not abort the remaining handlers.
 */
export function emit(evt, payload) {
  const set = listeners.get(evt);
  if (!set || set.size === 0) return 0;
  let delivered = 0;
  for (const fn of Array.from(set)) {
    try {
      fn(payload);
      delivered += 1;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[events] handler for "${evt}" threw:`, err);
    }
  }
  return delivered;
}

/** Remove every listener (used on reset). */
export function clearAll() {
  listeners.clear();
}

/** Diagnostic: number of listeners for an event. */
export function listenerCount(evt) {
  const set = listeners.get(evt);
  return set ? set.size : 0;
}
