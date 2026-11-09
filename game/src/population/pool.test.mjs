/**
 * population/pool.test.mjs — the PURE pool tests.
 *
 * Run with:  node --test src/population/pool.test.mjs
 *
 * The pool is deliberately ignorant of WHAT it pools, so these tests use
 * plain objects. What is proved here:
 *   1. acquire() reuses a free object (a hit) or builds a new one (a miss),
 *   2. the capacity is never exceeded,
 *   3. release() keeps the object alive - it is NOT destroyed,
 *   4. the numbers (hits, misses, live, peak) are right,
 *   5. only dispose() destroys anything.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createPool } from './pool.js';

/** A pool of numbered objects with a bookkeeping trail. */
function makePool(options = {}) {
  const trail = [];
  let created = 0;
  const pool = createPool({
    create() {
      created += 1;
      const item = { id: created, alive: true };
      trail.push(`create:${item.id}`);
      return item;
    },
    reset(item) {
      trail.push(`reset:${item.id}`);
    },
    destroy(item) {
      trail.push(`destroy:${item.id}`);
      item.alive = false;
    },
    onAcquire(item) {
      trail.push(`acquire:${item.id}`);
    },
    onRelease(item) {
      trail.push(`release:${item.id}`);
    },
    ...options,
  });
  return { pool, trail };
}

test('an empty pool builds a new object on the first acquire', () => {
  const { pool, trail } = makePool();
  const item = pool.acquire();
  assert.ok(item);
  assert.equal(pool.stats().misses, 1);
  assert.equal(pool.stats().hits, 0);
  assert.equal(pool.stats().live, 1);
  assert.deepEqual(trail, ['create:1', 'acquire:1']);
});

test('a released object is reused, not rebuilt', () => {
  const { pool, trail } = makePool();
  const first = pool.acquire();
  assert.equal(pool.release(first), true);
  const second = pool.acquire();
  assert.equal(second, first, 'the very same object comes back');
  assert.equal(pool.stats().hits, 1);
  assert.equal(pool.stats().misses, 1);
  assert.equal(pool.stats().total, 1, 'only one object was ever built');
  assert.deepEqual(trail, [
    'create:1', 'acquire:1', 'reset:1', 'release:1', 'acquire:1',
  ]);
});

test('the live count follows the check-outs and the peak remembers the top', () => {
  const { pool } = makePool();
  const a = pool.acquire();
  const b = pool.acquire();
  assert.equal(pool.stats().live, 2);
  assert.equal(pool.stats().peak, 2);
  pool.release(a);
  assert.equal(pool.stats().live, 1);
  assert.equal(pool.stats().free, 1);
  pool.acquire();
  assert.equal(pool.stats().live, 2);
  assert.equal(pool.stats().peak, 2, 'the peak does not go down');
  pool.release(b);
});

test('the capacity is never exceeded', () => {
  const { pool } = makePool({ capacity: 2 });
  assert.ok(pool.acquire());
  assert.ok(pool.acquire());
  assert.equal(pool.acquire(), null, 'the third one is refused');
  assert.equal(pool.stats().live, 2);
  assert.equal(pool.stats().misses, 2);
});

test('a free object is served even when the pool is full', () => {
  const { pool } = makePool({ capacity: 1 });
  const a = pool.acquire();
  assert.equal(pool.acquire(), null);
  pool.release(a);
  assert.equal(pool.acquire(), a, 'the free object is reused');
  assert.equal(pool.stats().live, 1);
});

test('releasing something the pool does not know is refused', () => {
  const { pool } = makePool();
  assert.equal(pool.release({ id: 99 }), false);
  const a = pool.acquire();
  assert.equal(pool.release(a), true);
  assert.equal(pool.release(a), false, 'a citizen cannot go back twice');
});

test('a released object stays alive: it is not destroyed', () => {
  const { pool, trail } = makePool();
  const a = pool.acquire();
  pool.release(a);
  assert.equal(a.alive, true, 'the object is kept for the next life');
  assert.ok(!trail.includes('destroy:1'), 'nothing was destroyed');
  assert.equal(pool.freeCount, 1);
  assert.equal(pool.liveCount, 0);
});

test('only dispose() destroys the objects', () => {
  const { pool, trail } = makePool();
  const a = pool.acquire();
  const b = pool.acquire();
  pool.release(b);
  pool.dispose();
  assert.equal(a.alive, false);
  assert.equal(b.alive, false);
  assert.ok(trail.includes('destroy:1'));
  assert.ok(trail.includes('destroy:2'));
  assert.equal(pool.disposed, true);
});

test('a disposed pool hands out nothing', () => {
  const { pool } = makePool();
  pool.acquire();
  pool.dispose();
  assert.equal(pool.acquire(), null);
  assert.equal(pool.release({ id: 1 }), false);
  assert.equal(pool.stats().live, 0);
});

test('dispose is idempotent', () => {
  const { pool, trail } = makePool();
  pool.acquire();
  pool.dispose();
  pool.dispose();
  assert.equal(trail.filter((t) => t.startsWith('destroy:')).length, 1);
});

test('a broken hook does not break the pool', () => {
  const pool = createPool({
    create: () => ({}),
    reset() { throw new Error('boom'); },
    onAcquire() { throw new Error('boom'); },
    onRelease() { throw new Error('boom'); },
  });
  const item = pool.acquire();
  assert.ok(item);
  assert.equal(pool.release(item), true);
});

test('a create() that returns nothing yields no object', () => {
  const pool = createPool({ create: () => null });
  assert.equal(pool.acquire(), null);
  assert.equal(pool.stats().live, 0);
});

test('the numbers of the pool are all there', () => {
  const { pool } = makePool({ capacity: 4 });
  const a = pool.acquire();
  pool.acquire();
  pool.release(a);
  assert.equal(pool.acquire(), a, 'the free object comes back');

  const stats = pool.stats();
  assert.deepEqual(Object.keys(stats).sort(), [
    'capacity', 'free', 'hits', 'live', 'misses', 'peak', 'total',
  ]);
  assert.equal(stats.capacity, 4);
  assert.equal(stats.live, 2);
  assert.equal(stats.free, 0);
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 2);
  assert.equal(stats.peak, 2);
  assert.equal(stats.total, 2, 'two objects were built and both still exist');
});
