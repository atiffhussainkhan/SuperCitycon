/**
 * core/log.js — structured logging with severity categories.
 *
 * OWNER: the integrator (core/).
 *
 * The project already logs, but it logs with bare `console.log`/`console.error`
 * and no consistent shape. A log line that cannot be filtered or grouped is
 * nearly useless when a player reports "it broke at night" and the only
 * evidence is a wall of mixed messages.
 *
 * This module gives every log line:
 *
 *   - a SEVERITY (debug / info / warn / error),
 *   - a CATEGORY (which subsystem it came from),
 *   - a CONTEXT object (structured, machine-readable),
 *   - a TIMESTAMP and the build identity.
 *
 * It is deliberately tiny and dependency-free, and it NEVER throws: a broken
 * logger must not be the reason the game stops.
 *
 * The log keeps a bounded ring buffer so the diagnostics panel can show the
 * recent history, and it can install itself as the global error handler so an
 * uncaught error is recorded with the same shape as everything else.
 *
 * Pure: this module imports nothing and touches no DOM until `install()` is
 * called, so it is unit-testable in Node.
 */

/** The severities, from least to most serious. */
export const SEVERITIES = Object.freeze(['debug', 'info', 'warn', 'error']);

/** The numeric rank of each severity — used to filter by threshold. */
const RANK = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });

/** How many lines the ring buffer keeps. */
const DEFAULT_LIMIT = 500;

/**
 * Build a logger.
 *
 * @param {object} [opts]
 * @param {string} [opts.category]   the default category for this logger
 * @param {number} [opts.limit]       ring-buffer size
 * @param {string} [opts.level]       the minimum severity that is recorded
 * @param {boolean} [opts.console]    whether to also write to the console
 * @param {object} [opts.build]       build identity to stamp on every line
 * @returns {object} the logger
 */
export function createLogger({
  category = 'app',
  limit = DEFAULT_LIMIT,
  level = 'info',
  console: toConsole = true,
  build = null,
} = {}) {
  let threshold = RANK[level] ?? RANK.info;
  let consoleEnabled = !!toConsole;
  const lines = [];
  const listeners = new Set();
  let dropped = 0;

  /** The build identity stamped on every line. */
  const identity = {
    version: build?.version ?? 'unknown',
    revision: build?.revision ?? 'unknown',
    engine: build?.engine ?? 'three.js',
    ...(build ?? {}),
  };

  function record(severity, message, context) {
    if ((RANK[severity] ?? 0) < threshold) return null;
    const line = {
      at: Date.now(),
      severity,
      category,
      message: String(message ?? ''),
      context: context && typeof context === 'object' ? { ...context } : undefined,
      build: identity,
    };
    lines.push(line);
    if (lines.length > limit) {
      lines.shift();
      dropped += 1;
    }
    if (consoleEnabled) {
      const tag = `[${severity}] ${category}`;
      const fn = severity === 'error' ? console.error
        : severity === 'warn' ? console.warn
          : console.log;
      try {
        if (line.context) fn(tag, line.message, line.context);
        else fn(tag, line.message);
      } catch {
        /* a broken console must never break the game */
      }
    }
    for (const fn of listeners) {
      try { fn(line); } catch { /* a broken listener must never break the game */ }
    }
    return line;
  }

  return {
    /** The category this logger stamps on its lines. */
    category,
    /** The build identity stamped on every line. */
    build: identity,

    debug(message, context) { return record('debug', message, context); },
    info(message, context) { return record('info', message, context); },
    warn(message, context) { return record('warn', message, context); },
    error(message, context) { return record('error', message, context); },

    /** Record an exception, with its category and the subsystem it came from. */
    exception(err, context = {}) {
      const message = err?.message ?? String(err ?? 'unknown error');
      const ctx = {
        ...context,
        name: err?.name ?? 'Error',
        stack: typeof err?.stack === 'string' ? err.stack.split('\n').slice(0, 6).join('\n') : undefined,
      };
      return record('error', message, ctx);
    },

    /** A child logger for another category, sharing the ring buffer. */
    child(subCategory) {
      return createLogger({
        category: `${category}/${subCategory}`,
        limit,
        level: Object.keys(RANK).find((k) => RANK[k] === threshold) ?? 'info',
        console: consoleEnabled,
        build: identity,
      });
    },

    /** The recent history, newest last. */
    history() { return lines.slice(); },
    /** How many lines were evicted from the ring buffer. */
    dropped() { return dropped; },
    /** Subscribe to new lines. Returns an unsubscribe function. */
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Change the minimum severity that is recorded. */
    setLevel(next) {
      if (!RANK[next]) return false;
      threshold = RANK[next];
      return true;
    },
    /** The current minimum severity. */
    level() {
      return Object.keys(RANK).find((k) => RANK[k] === threshold) ?? 'info';
    },
    /** Turn console output on or off. */
    setConsole(on) { consoleEnabled = !!on; },
    /** Clear the ring buffer. */
    clear() { lines.length = 0; dropped = 0; },
    /** A summary suitable for a diagnostics panel. */
    summary() {
      const counts = { debug: 0, info: 0, warn: 0, error: 0 };
      for (const l of lines) counts[l.severity] += 1;
      return { total: lines.length, dropped, counts, build: identity };
    },
    dispose() { listeners.clear(); lines.length = 0; },
  };
}

/**
 * Install the logger as the global error handler, so an uncaught error is
 * recorded with the same shape as everything else instead of disappearing
 * into the console.
 *
 * @param {object} logger
 * @param {object} [target] the global object (defaults to globalThis)
 * @returns {Function} a function that restores the previous handler
 */
export function installGlobalHandlers(logger, target = globalThis) {
  const previousError = target?.onerror ?? null;
  const previousRejection = target?.onunhandledrejection ?? null;

  const onError = (...args) => {
    const [message, source, line, column, error] = args;
    const event = message && typeof message === 'object' ? message : null;
    try {
      logger.exception(error ?? event?.error ?? event?.message ?? message, {
        source: 'window.onerror',
        filename: event?.filename ?? source,
        line: event?.lineno ?? line,
        column: event?.colno ?? column,
      });
    } catch { /* never throw from the error handler */ }
    if (typeof previousError === 'function') return previousError.apply(target, args);
  };

  const onRejection = (event) => {
    try {
      logger.exception(event?.reason, { source: 'unhandledrejection' });
    } catch { /* never throw from the error handler */ }
    if (typeof previousRejection === 'function') return previousRejection.call(target, event);
  };

  if (target) {
    target.onerror = onError;
    target.onunhandledrejection = onRejection;
  }

  return function uninstall() {
    if (!target) return;
    if (target.onerror === onError) target.onerror = previousError;
    if (target.onunhandledrejection === onRejection) target.onunhandledrejection = previousRejection;
  };
}

/**
 * The build identity this bundle was produced from.
 *
 * The values are injected at build time by `vite.config.js` through
 * `import.meta.env`, so a log line names the exact build it came from. When
 * the module is loaded outside a bundler (Node tests) the fallbacks apply.
 *
 * @returns {{version:string, revision:string, engine:string, builtAt:string}}
 */
export function buildIdentity() {
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  return {
    version: env.VITE_BUILD_VERSION || '6.0.0-dev',
    revision: env.VITE_BUILD_REVISION || 'unknown',
    engine: env.VITE_ENGINE_VERSION || 'three.js',
    builtAt: env.VITE_BUILD_TIME || '',
  };
}
