import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogger, installGlobalHandlers } from './log.js';

test('browser errors retain the exception, location and prior handler result', () => {
  const logger = createLogger({ console: false });
  const error = new TypeError('renderer failed');
  const args = ['Uncaught TypeError: renderer failed', 'main.js', 12, 4, error];
  const previous = (...received) => {
    assert.deepEqual(received, args);
    return true;
  };
  const target = { onerror: previous };
  const uninstall = installGlobalHandlers(logger, target);

  assert.equal(target.onerror(...args), true);
  const [entry] = logger.history();
  assert.equal(entry.message, error.message);
  assert.equal(entry.context.name, 'TypeError');
  assert.equal(entry.context.filename, 'main.js');
  assert.equal(entry.context.line, 12);
  assert.equal(entry.context.column, 4);
  assert.match(entry.context.stack, /renderer failed/);

  uninstall();
  assert.equal(target.onerror, previous);
  const removeAgain = installGlobalHandlers(logger, target);
  const newerHandler = () => false;
  target.onerror = newerHandler;
  removeAgain();
  assert.equal(target.onerror, newerHandler);
});
