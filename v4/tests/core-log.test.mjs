/**
 * Logger unit tests — the record buffer, error capture and the global
 * handlers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createLogger } from '../src/core/log.js';

/** A logger that only prints errors, so the test output stays readable. */
function quietLogger(options = {}) {
  return createLogger({ level: 'error', ...options });
}

test('every call is recorded with a level and a timestamp', () => {
  const logger = quietLogger();
  logger.debug('d');
  logger.info('i');
  logger.warn('w');
  logger.error('e');

  const records = logger.records();
  assert.equal(records.length, 4);
  assert.deepEqual(records.map((r) => r.level), ['debug', 'info', 'warn', 'error']);
  assert.equal(records[0].message, 'd');
  assert.equal(typeof records[0].at, 'number');
});

test('records can be filtered by level', () => {
  const logger = quietLogger();
  logger.info('one');
  logger.error('two');

  assert.equal(logger.records('error').length, 1);
  assert.equal(logger.records('error')[0].message, 'two');
  assert.equal(logger.errors().length, 1);
});

test('error data is kept with the record', () => {
  const logger = quietLogger();
  logger.error('boom', { code: 7 });
  assert.deepEqual(logger.errors()[0].data, { code: 7 });
});

test('the record buffer is bounded', () => {
  const logger = quietLogger({ limit: 3 });
  logger.info('a');
  logger.info('b');
  logger.info('c');
  logger.info('d');

  const records = logger.records();
  assert.equal(records.length, 3);
  assert.equal(records[0].message, 'b');
});

test('the log level can be changed', () => {
  const logger = quietLogger();
  assert.equal(logger.level, 'error');
  logger.level = 'debug';
  assert.equal(logger.level, 'debug');
});

test('records are returned as a copy so the buffer cannot be edited from outside', () => {
  const logger = quietLogger();
  logger.info('one');
  const records = logger.records();
  records.push({ level: 'info', message: 'fake' });
  assert.equal(logger.records().length, 1);
});

test('clear empties the buffer', () => {
  const logger = quietLogger();
  logger.info('one');
  logger.clear();
  assert.equal(logger.records().length, 0);
});

test('the global handlers install and uninstall without throwing', () => {
  const logger = quietLogger();
  const uninstall = logger.installGlobalHandlers();
  assert.equal(typeof uninstall, 'function');
  assert.doesNotThrow(() => uninstall());

  // The browser path (globalThis.addEventListener) does not exist in Node,
  // so the handlers are optional there — the error capture still works
  // through the logger itself.
  logger.error('captured through the logger', { stack: 'stack' });
  assert.equal(logger.errors().length, 1);
  assert.equal(logger.errors()[0].data.stack, 'stack');
});

test('the logger publishes errors on the bus when one is given', () => {
  const bus = { emitted: [], emit(type, payload) { this.emitted.push([type, payload]); } };
  const logger = createLogger({ level: 'error', bus });
  logger.error('bus error');

  assert.equal(bus.emitted.length, 1);
  assert.equal(bus.emitted[0][0], 'error');
  assert.equal(bus.emitted[0][1].message, 'bus error');
});
