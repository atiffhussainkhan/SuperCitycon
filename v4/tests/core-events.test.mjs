/**
 * Event bus unit tests — emit, once, off, and a listener that throws.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Events, createEventBus } from '../src/core/events.js';

test('a listener receives the payload', () => {
  const bus = createEventBus();
  const seen = [];
  bus.on('tick', (payload) => seen.push(payload));

  const delivered = bus.emit('tick', { frame: 1 });
  assert.equal(delivered, 1);
  assert.deepEqual(seen, [{ frame: 1 }]);
});

test('on returns an unsubscribe function', () => {
  const bus = createEventBus();
  let calls = 0;
  const off = bus.on('tick', () => { calls += 1; });

  bus.emit('tick', null);
  off();
  bus.emit('tick', null);

  assert.equal(calls, 1);
});

test('off removes a listener by reference', () => {
  const bus = createEventBus();
  let calls = 0;
  const handler = () => { calls += 1; };
  bus.on('tick', handler);
  bus.off('tick', handler);
  bus.emit('tick', null);
  assert.equal(calls, 0);
});

test('once fires exactly once', () => {
  const bus = createEventBus();
  let calls = 0;
  bus.once('tick', () => { calls += 1; });

  bus.emit('tick', null);
  bus.emit('tick', null);
  bus.emit('tick', null);

  assert.equal(calls, 1);
});

test('once returns an unsubscribe function too', () => {
  const bus = createEventBus();
  let calls = 0;
  const off = bus.once('tick', () => { calls += 1; });
  off();
  bus.emit('tick', null);
  assert.equal(calls, 0);
});

test('a throwing listener does not break the emit', () => {
  const bus = createEventBus();
  const original = console.error;
  console.error = () => {};
  try {
    let reached = false;
    bus.on('tick', () => { throw new Error('listener exploded'); });
    bus.on('tick', () => { reached = true; });

    const delivered = bus.emit('tick', null);

    assert.equal(reached, true, 'the later listener still ran');
    assert.equal(delivered, 1, 'only the listener that survived counts as delivered');
    const errors = bus.history(Events.ERROR);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].payload.source, 'event-listener');
  } finally {
    console.error = original;
  }
});

test('emitting an event nobody listens to is harmless', () => {
  const bus = createEventBus();
  assert.equal(bus.emit('nobody-home', { a: 1 }), 0);
});

test('the history records what was emitted and can be filtered', () => {
  const bus = createEventBus();
  bus.emit('a', 1);
  bus.emit('b', 2);
  bus.emit('a', 3);

  assert.equal(bus.history().length, 3);
  assert.equal(bus.history('a').length, 2);
  assert.equal(bus.history('a')[1].payload, 3);
  assert.equal(typeof bus.history()[0].at, 'number');
});

test('the history is bounded', () => {
  const bus = createEventBus({ historyLimit: 3 });
  for (let i = 0; i < 10; i += 1) bus.emit('tick', i);
  assert.equal(bus.history().length, 3);
  assert.equal(bus.history()[0].payload, 7);
});

test('clearHistory empties the record but keeps the listeners', () => {
  const bus = createEventBus();
  let calls = 0;
  bus.on('tick', () => { calls += 1; });
  bus.emit('tick', null);
  bus.clearHistory();
  bus.emit('tick', null);

  assert.equal(bus.history().length, 1);
  assert.equal(calls, 2);
});

test('the listener count is reported', () => {
  const bus = createEventBus();
  bus.on('a', () => {});
  bus.on('a', () => {});
  bus.on('b', () => {});
  assert.equal(bus.listenerCount, 3);
});
