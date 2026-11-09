/**
 * population/pool.js — a PURE, generic object pool.
 *
 * OWNER: POP. This module holds no game rules of its own and imports
 * NOTHING (not even `three`), so it is unit-testable in Node with
 * `node --test src/population/pool.test.mjs`.
 *
 * WHAT IT IS
 * ----------
 * A pool keeps a bounded set of reusable objects alive so the game does not
 * build and throw them away every time an entity appears and disappears.
 *
 *   acquire()  take an object out of the pool (reusing a free one, or
 *              building a new one) and mark it as LIVE
 *   release()  give an object back; it stays alive and is reused next time
 *   stats()    hits (served from the free list), misses (had to build a new
 *              one), live (checked out right now), peak (the most ever live)
 *
 * The pool never disposes anything by itself: `destroy()` is only called by
 * `dispose()` (or when an object is released and the pool is already full
 * of free objects). The owner of the pool decides when the whole thing goes
 * away.
 *
 * The pool is deliberately ignorant of WHAT it pools: the citizen renderer
 * uses it for rigged citizens, but nothing in here mentions citizens.
 */

/**
 * Create a pool.
 *
 * @param {object} [options]
 * @param {number} [options.capacity] the most objects that may be LIVE at
 *        once. `Infinity` (the default) means "no live limit".
 * @param {() => any} [options.create] builds a NEW object. It is called only
 *        when the free list is empty.
 * @param {(item:any) => void} [options.reset] prepares a REUSED object for
 *        its next life (called on release).
 * @param {(item:any) => void} [options.destroy] disposes an object for good.
 * @param {(item:any) => void} [options.onAcquire] called after an object
 *        leaves the pool (a hook for re-parenting it).
 * @param {(item:any) => void} [options.onRelease] called after an object
 *        goes back to the pool.
 */
export function createPool(options = {}) {
  const {
    capacity = Infinity,
    create = () => ({}),
    reset = null,
    destroy = null,
    onAcquire = null,
    onRelease = null,
  } = options ?? {};

  /** The objects that are free to be reused. */
  const free = [];
  /** The objects that are currently checked out. */
  const live = new Set();

  let hits = 0;
  let misses = 0;
  let peak = 0;
  let disposed = false;

  /**
   * Take an object out of the pool.
   *
   * A free object is reused (a HIT); otherwise a new one is built (a MISS).
   * When the pool is at its live capacity and nothing is free, `null` is
   * returned: the caller must not exceed the cap.
   *
   * @returns {any|null} the object, or null when the pool is exhausted
   */
  function acquire(matches = null, createItem = create) {
    if (disposed || live.size >= capacity) return null;

    const index = matches ? free.findLastIndex(matches) : free.length - 1;
    const hit = index >= 0;
    const item = hit ? free.splice(index, 1)[0] : createItem();
    if (item === null || item === undefined) return null;

    if (!hit && free.length + live.size >= capacity) {
      const evicted = free.shift();
      if (destroy) {
        try { destroy(evicted); } catch { /* ignore */ }
      }
    }
    if (hit) hits += 1;
    else misses += 1;

    live.add(item);
    if (live.size > peak) peak = live.size;
    if (onAcquire) {
      try { onAcquire(item); } catch { /* a broken hook must not break the pool */ }
    }
    return item;
  }

  /**
   * Give an object back.
   *
   * The object stays ALIVE: it is reset and kept for the next acquire.
   * Releasing something the pool does not know about is refused.
   *
   * @param {any} item
   * @returns {boolean} true when the object was accepted back
   */
  function release(item) {
    if (disposed) return false;
    if (!live.has(item)) return false;

    live.delete(item);
    if (reset) {
      try { reset(item); } catch { /* a broken hook must not break the pool */ }
    }
    if (onRelease) {
      try { onRelease(item); } catch { /* ignore */ }
    }
    free.push(item);
    return true;
  }

  /**
   * The pool's numbers.
   *
   * @returns {{hits:number, misses:number, live:number, peak:number,
   *            free:number, capacity:number, total:number}}
   */
  function stats() {
    return {
      hits,
      misses,
      live: live.size,
      peak,
      free: free.length,
      capacity,
      total: live.size + free.length,
    };
  }

  /**
   * Throw the pool away: every object, live or free, is destroyed.
   */
  function dispose() {
    if (disposed) return;
    disposed = true;
    const all = [...live, ...free];
    live.clear();
    free.length = 0;
    if (destroy) {
      for (const item of all) {
        try { destroy(item); } catch { /* ignore */ }
      }
    }
  }

  return {
    acquire,
    release,
    stats,
    dispose,
    /** True once the pool has been disposed. */
    get disposed() { return disposed; },
    /** The number of objects currently checked out. */
    get liveCount() { return live.size; },
    /** The number of objects waiting to be reused. */
    get freeCount() { return free.length; },
  };
}
