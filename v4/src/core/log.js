/**
 * V4 — logging and error capture.
 *
 * Errors are captured, not merely printed: the editor's console panel shows
 * them, and the AI "explain this error" tool reads the same records so its
 * advice is grounded in what actually happened.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger({ level = 'info', limit = 300, bus = null } = {}) {
  const records = [];

  function push(rec) {
    records.push(rec);
    if (records.length > limit) records.shift();
    if (bus) {
      if (rec.level === 'error') bus.emit('error', rec);
      else if (rec.level === 'warn') bus.emit('warning', rec);
    }
    return rec;
  }

  const logger = {
    get level() { return level; },
    set level(v) { level = v; },

    debug(message, data) {
      const rec = push({ level: 'debug', message: String(message), data, at: Date.now() });
      if (LEVELS.debug >= LEVELS[level]) console.debug('[v4]', message, data ?? '');
      return rec;
    },
    info(message, data) {
      const rec = push({ level: 'info', message: String(message), data, at: Date.now() });
      if (LEVELS.info >= LEVELS[level]) console.info('[v4]', message, data ?? '');
      return rec;
    },
    warn(message, data) {
      const rec = push({ level: 'warn', message: String(message), data, at: Date.now() });
      if (LEVELS.warn >= LEVELS[level]) console.warn('[v4]', message, data ?? '');
      return rec;
    },
    error(message, data) {
      const rec = push({ level: 'error', message: String(message), data, at: Date.now() });
      if (LEVELS.error >= LEVELS[level]) console.error('[v4]', message, data ?? '');
      return rec;
    },

    records(filter = null) {
      return filter ? records.filter((r) => r.level === filter) : [...records];
    },
    errors() { return logger.records('error'); },
    clear() { records.length = 0; },

    /**
     * Install global handlers so an uncaught exception is captured rather
     * than lost. Returns a function that removes the handlers.
     *
     * `target` defaults to `globalThis`. It is injectable because Node's
     * global object is not an EventTarget, so a test (or an embedded runtime)
     * needs to supply its own dispatcher.
     */
    installGlobalHandlers(target = globalThis) {
      const onError = (event) => {
        logger.error(event.message ?? 'uncaught error', {
          stack: event.error?.stack ?? null,
          source: event.filename ?? null,
          line: event.lineno ?? null,
        });
      };
      const onRejection = (event) => {
        logger.error(`unhandled rejection: ${event.reason?.message ?? event.reason}`, {
          stack: event.reason?.stack ?? null,
        });
      };
      const canListen = typeof target?.addEventListener === 'function';
      if (canListen) {
        target.addEventListener('error', onError);
        target.addEventListener('unhandledrejection', onRejection);
      }
      return () => {
        if (!canListen) return;
        target.removeEventListener?.('error', onError);
        target.removeEventListener?.('unhandledrejection', onRejection);
      };
    },
  };
  return logger;
}
