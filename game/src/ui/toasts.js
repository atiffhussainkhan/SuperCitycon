/**
 * ui/toasts.js — the notification queue (FR-UX-107 … FR-UX-110).
 *
 * OWNER: UX (BOT-09). PURE module — no DOM, no `three`. The HUD renders
 * whatever this queue says is current; the queue owns the ORDER.
 *
 * THE PUBLISHED RULES
 *   FR-UX-107  light, non-blocking toasts that never interrupt play;
 *   FR-UX-108  a queue that delivers one notification at a time, FIFO,
 *              with a visible indicator when more than one is pending;
 *   FR-UX-109  dismissible by tap, by timeout, or by opening the surface;
 *   FR-UX-110  BLOCKING alerts (usage at 100 %, insufficient slots, no
 *              funds) are a different KIND: higher priority, never
 *              auto-dismissed.
 */

import { PLACEHOLDER } from './panels.js';

/** The toast kinds the HUD knows how to present. */
export const TOAST_KINDS = Object.freeze(['info', 'success', 'warn', 'error', 'alert']);

/** The kind that is never auto-dismissed (FR-UX-110). */
export const BLOCKING_KIND = 'alert';

/**
 * Create a toast queue.
 *
 * @param {object} [options]
 * @param {number} [options.ttl=4.5]      seconds a toast stays on screen
 * @param {number} [options.alertTtl=0]   0 = blocking alerts never expire
 * @param {number} [options.max=6]        maximum queued (non-current) toasts
 * @param {number} [options.idle]         value returned by an empty queue
 * @returns {object} the queue service
 */
export function createToastQueue(options = {}) {
  const ttl = Number.isFinite(options.ttl) ? options.ttl : 4.5;
  const alertTtl = Number.isFinite(options.alertTtl) ? options.alertTtl : 0;
  const max = Number.isFinite(options.max) ? options.max : 6;

  /** @type {Array<object>} pending, FIFO */
  const pending = [];
  /** @type {object|null} the toast on screen right now */
  let current = null;
  /** Monotonic id, so the HUD can tell two identical messages apart. */
  let seq = 0;

  function make(message, kind, opts = {}) {
    const k = TOAST_KINDS.includes(kind) ? kind : 'info';
    const life = k === BLOCKING_KIND
      ? (Number.isFinite(opts.ttl) ? opts.ttl : alertTtl)
      : (Number.isFinite(opts.ttl) ? opts.ttl : ttl);
    seq += 1;
    return {
      id: seq,
      message: String(message ?? ''),
      kind: k,
      blocking: k === BLOCKING_KIND,
      life,
      remaining: life,
      // Optional deep-link: tapping the toast opens the related surface.
      action: opts.action ?? null,
      payload: opts.payload ?? null,
      createdAt: Number.isFinite(opts.now) ? opts.now : 0,
    };
  }

  /**
   * Enqueue a notification.
   *
   * A blocking alert preempts whatever is on screen (it is the highest
   * priority kind) and is never auto-dismissed.
   *
   * @param {string} message
   * @param {string} [kind='info']
   * @param {object} [opts] `{ttl, action, payload, now}`
   * @returns {object} the queued toast
   */
  function push(message, kind = 'info', opts = {}) {
    const toast = make(message, kind, opts);
    if (toast.blocking) {
      // Blocking alerts jump the queue; the displaced toast goes back to the
      // FRONT of the pending list so nothing is lost.
      if (current) pending.unshift(current);
      current = toast;
      return toast;
    }
    if (pending.length >= max) pending.shift();
    pending.push(toast);
    if (!current) promote();
    return toast;
  }

  /** Move the next pending toast onto the screen. */
  function promote() {
    if (current) return current;
    if (!pending.length) return null;
    current = pending.shift();
    return current;
  }

  /**
   * Advance the queue. `dt` is wall-clock seconds.
   * @param {number} dt
   */
  function tick(dt) {
    const d = Number.isFinite(dt) ? dt : 0;
    if (!current || d <= 0) return current;
    if (current.blocking && !(current.life > 0)) return current; // never expires
    current.remaining -= d;
    if (current.remaining <= 0) dismiss();
    return current;
  }

  /** Dismiss the current toast (tap / timeout / opening the surface). */
  function dismiss() {
    const gone = current;
    current = null;
    promote();
    return gone;
  }

  return {
    push,
    tick,
    dismiss,
    /** The toast on screen right now, or null. */
    current: () => current,
    /** How many notifications are waiting behind the current one. */
    pendingCount: () => pending.length,
    /** Everything the queue holds, current first. */
    list: () => (current ? [current, ...pending] : [...pending]),
    /** Drop everything (a reset). */
    clear() {
      current = null;
      pending.length = 0;
    },
    /** True when the queue has nothing to show. */
    isEmpty: () => !current && pending.length === 0,
    kinds: TOAST_KINDS,
    placeholder: PLACEHOLDER,
  };
}
