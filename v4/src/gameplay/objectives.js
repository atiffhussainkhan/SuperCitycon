/**
 * V4 — Objectives.
 *
 * An ordered list of objectives, each with a state: pending → active →
 * complete. Completing the last outstanding objective emits
 * Events.LEVEL_COMPLETE.
 */

import { Events } from '../core/events.js';

export const OBJECTIVE_STATES = Object.freeze(['pending', 'active', 'complete']);

/**
 * @param {object} [opts]
 * @param {Array}  [opts.objectives]  [{ id, text, state }]
 * @param {object} [opts.bus]
 * @param {boolean} [opts.autoStart]   activate the first objective immediately
 */
export function createObjectives({ objectives = [], bus = null, autoStart = true } = {}) {
  /** @type {{id:string,text:string,state:string}[]} */
  const list = objectives.map((raw, index) => ({
    id: String(raw.id ?? `objective-${index + 1}`),
    text: String(raw.text ?? raw.title ?? ''),
    state: OBJECTIVE_STATES.includes(raw.state) ? raw.state : 'pending',
  }));

  function publish(reason, objective) {
    bus?.emit?.('gameplay:objective', {
      id: objective?.id ?? null,
      text: objective?.text ?? null,
      state: objective?.state ?? null,
      reason,
      list: snapshot(),
    });
  }

  function find(id) {
    return list.find((o) => o.id === String(id)) ?? null;
  }

  /** The text of the objective the player should be doing right now. */
  function current() {
    return list.find((o) => o.state === 'active') ?? null;
  }

  /** The objective text for the HUD (the active one, else the next pending). */
  function currentText() {
    const active = current();
    if (active) return active.text;
    const next = list.find((o) => o.state === 'pending');
    return next ? next.text : '';
  }

  function isComplete() {
    return list.length > 0 && list.every((o) => o.state === 'complete');
  }

  /**
   * Activate an objective.
   * @param {string} id
   * @returns {object|null}
   */
  function start(id) {
    const objective = find(id);
    if (!objective) return null;
    if (objective.state === 'complete') return objective;
    objective.state = 'active';
    publish('start', objective);
    return objective;
  }

  /**
   * Complete an objective.
   * @param {string} id
   * @returns {object|null}
   */
  function complete(id) {
    const objective = find(id);
    if (!objective) return null;
    if (objective.state === 'complete') return objective;
    objective.state = 'complete';
    publish('complete', objective);

    // The next pending objective becomes the active one.
    const next = list.find((o) => o.state === 'pending');
    if (next) {
      next.state = 'active';
      publish('start', next);
    }

    if (isComplete()) {
      bus?.emit?.(Events.LEVEL_COMPLETE, { objectives: snapshot() });
    }
    return objective;
  }

  /** Reset every objective to pending. */
  function reset() {
    for (const objective of list) objective.state = 'pending';
    publish('reset', null);
  }

  function snapshot() {
    return list.map((o) => ({ ...o }));
  }

  if (autoStart && list.length > 0 && list[0].state === 'pending') {
    list[0].state = 'active';
  }

  return {
    /** The objective objects (live references). */
    get objectives() { return list; },
    /** How many objectives there are. */
    get count() { return list.length; },
    /** Are all objectives complete? (`complete` is the method that completes one.) */
    get allComplete() { return isComplete(); },
    /** The active objective, or null. */
    current,
    /** The text for the HUD. */
    currentText,
    /** A copy of every objective. */
    list: snapshot,
    /** Look one up by id. */
    get: find,
    start,
    complete,
    reset,
    /** Is every objective complete? */
    isComplete,
    /** How many objectives are complete. */
    get completedCount() { return list.filter((o) => o.state === 'complete').length; },
  };
}
