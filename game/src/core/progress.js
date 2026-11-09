/**
 * core/progress.js — the player's progression record.
 *
 * OWNER: the integrator (core/).
 *
 * V4 tracked progress as a single stage index: a number that went up when
 * the city met a milestone. There was no way to say "this part of the city
 * is safe", nothing to collect, and nothing that survived a save except the
 * stage number itself.
 *
 * V5 adds three records, all persisted in `state.meta.progress` and all
 * carried by the save format:
 *
 *   - CHECKPOINTS   — named milestones the city has reached. A checkpoint is
 *                     a place the player can return to; reaching one is a
 *                     permanent record.
 *   - COLLECTIBLES  — one-off discoveries. Collecting the same one twice
 *                     does nothing, so the record is a set.
 *   - ACHIEVEMENTS  — one-off rewards that unlock when their condition is
 *                     met. Like collectibles, they are a set.
 *
 * The rules are pure functions so they can be tested in Node without a DOM,
 * a renderer or a world.
 */

import { EVENTS, emit } from './events.js';

/** The three kinds of record the progression holds. */
export const RECORD_KINDS = Object.freeze(['checkpoints', 'collectibles', 'achievements']);

/**
 * The empty progression record.
 * @returns {{checkpoints:string[], collectibles:string[], achievements:string[]}}
 */
export function emptyProgress() {
  return { checkpoints: [], collectibles: [], achievements: [] };
}

/**
 * Normalise anything that claims to be a progression record.
 *
 * A save from an older build, a corrupt record and a hand-edited one all
 * arrive here. The result always has the three arrays, and they only ever
 * hold non-empty strings.
 *
 * @param {*} value
 * @returns {{checkpoints:string[], collectibles:string[], achievements:string[]}}
 */
export function normaliseProgress(value) {
  const out = emptyProgress();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const kind of RECORD_KINDS) {
    const list = value[kind];
    if (!Array.isArray(list)) continue;
    const seen = new Set();
    for (const item of list) {
      if (typeof item !== 'string') continue;
      const id = item.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out[kind].push(id);
    }
  }
  return out;
}

/**
 * Has the record already got this id?
 *
 * @param {{checkpoints:string[],collectibles:string[],achievements:string[]}} progress
 * @param {string} kind
 * @param {string} id
 * @returns {boolean}
 */
export function hasRecord(progress, kind, id) {
  if (!RECORD_KINDS.includes(kind)) return false;
  const list = progress?.[kind];
  if (!Array.isArray(list)) return false;
  return list.includes(id);
}

/**
 * Add a record, if it is new.
 *
 * @param {object} progress the record (mutated in place)
 * @param {string} kind
 * @param {string} id
 * @returns {boolean} true when the record was new
 */
export function addRecord(progress, kind, id) {
  if (!RECORD_KINDS.includes(kind)) return false;
  if (typeof id !== 'string') return false;
  const clean = id.trim();
  if (!clean) return false;
  if (!Array.isArray(progress[kind])) progress[kind] = [];
  if (progress[kind].includes(clean)) return false;
  progress[kind].push(clean);
  return true;
}

/**
 * How much of a checklist has been collected?
 *
 * @param {string[]} collected
 * @param {string[]} required
 * @returns {{count:number, total:number, ratio:number, complete:boolean}}
 */
export function progressRatio(collected, required) {
  const total = Array.isArray(required) ? required.length : 0;
  if (!total) return { count: 0, total: 0, ratio: 1, complete: true };
  const have = new Set(Array.isArray(collected) ? collected : []);
  let count = 0;
  for (const id of required) if (have.has(id)) count += 1;
  return { count, total, ratio: count / total, complete: count >= total };
}

/**
 * The progression service.
 *
 * The record lives in `state.meta.progress`, so it is part of the snapshot
 * and therefore travels with the save. The service reads and writes that one
 * place, so there is never a second copy to fall out of step.
 *
 * @param {object} ctx the shared context
 * @returns {object} the progression service
 */
export function createProgress(ctx = {}) {
  const state = () => ctx?.state ?? null;

  /** The live record, created on first use. */
  function record() {
    const s = state();
    if (!s?.meta) return emptyProgress();
    if (!s.meta.progress || typeof s.meta.progress !== 'object') {
      s.meta.progress = emptyProgress();
    } else {
      s.meta.progress = normaliseProgress(s.meta.progress);
    }
    return s.meta.progress;
  }

  /**
   * Reach a checkpoint.
   *
   * @param {string} id
   * @param {object} [details] extra information for the event
   * @returns {boolean} true when it was new
   */
  function reachCheckpoint(id, details = {}) {
    const fresh = addRecord(record(), 'checkpoints', id);
    if (fresh) emit(EVENTS.CHECKPOINT_REACHED, { id, ...details });
    return fresh;
  }

  /**
   * Find a collectible.
   *
   * @param {string} id
   * @param {object} [details]
   * @returns {boolean} true when it was new
   */
  function findCollectible(id, details = {}) {
    const fresh = addRecord(record(), 'collectibles', id);
    if (fresh) emit(EVENTS.COLLECTIBLE_FOUND, { id, ...details });
    return fresh;
  }

  /**
   * Unlock an achievement.
   *
   * @param {string} id
   * @param {object} [details]
   * @returns {boolean} true when it was new
   */
  function unlockAchievement(id, details = {}) {
    const fresh = addRecord(record(), 'achievements', id);
    if (fresh) emit(EVENTS.ACHIEVEMENT_UNLOCKED, { id, ...details });
    return fresh;
  }

  return {
    /** The live record. */
    record,
    /** Replace the record wholesale (used when a save is restored). */
    set(value) {
      const s = state();
      if (!s?.meta) return emptyProgress();
      s.meta.progress = normaliseProgress(value);
      return s.meta.progress;
    },
    reachCheckpoint,
    findCollectible,
    unlockAchievement,
    /** Has this checkpoint been reached? */
    hasCheckpoint(id) { return hasRecord(record(), 'checkpoints', id); },
    /** Has this collectible been found? */
    hasCollectible(id) { return hasRecord(record(), 'collectibles', id); },
    /** Has this achievement been unlocked? */
    hasAchievement(id) { return hasRecord(record(), 'achievements', id); },
    /** The reached checkpoints. */
    checkpoints() { return record().checkpoints.slice(); },
    /** The found collectibles. */
    collectibles() { return record().collectibles.slice(); },
    /** The unlocked achievements. */
    achievements() { return record().achievements.slice(); },
    /** A summary for the HUD or a diagnostics panel. */
    summary() {
      const p = record();
      return {
        checkpoints: p.checkpoints.length,
        collectibles: p.collectibles.length,
        achievements: p.achievements.length,
      };
    },
    /**
     * How far through a checklist the player is.
     * @param {string[]} required
     */
    ratio(required) { return progressRatio(record().collectibles, required); },
    /** Forget everything (used by a reset). */
    clear() {
      const s = state();
      if (s?.meta) s.meta.progress = emptyProgress();
      return true;
    },
  };
}
