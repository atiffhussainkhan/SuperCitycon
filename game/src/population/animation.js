/**
 * population/animation.js — the POP animation STATE MACHINE (pure).
 *
 * OWNER: POP. This module holds the RULES of the citizen animation, so it
 * must NOT import `three` (core/CONTRACT.md §0.5): it is unit-tested in Node
 * with `node --test src/population/animation.test.mjs`.
 *
 * WHAT IT MODELS
 * --------------
 * A citizen is always in exactly one of five states:
 *
 *   idle   standing still
 *   walk   strolling
 *   run    moving fast
 *   cheer  celebrating a happy city
 *   flee   panicking (a hazard is active)
 *
 * Every state lists SEVERAL candidate clip names. A character only has SOME
 * of them (the KayKit crowd says "Walk", the adventurers say "Walking_A",
 * the city citizens say "Walk"), so the machine picks the FIRST candidate
 * the character actually has. A character with no walk clip at all falls
 * back to `idle` rather than playing a clip that does not exist.
 *
 * The clip names below are clip NAMES, never model paths: the art itself
 * comes from `src/data/manifest.json` (core/CONTRACT.md §0.1).
 *
 * CONDITIONS
 * ----------
 * A transition may require a named condition to be true. Conditions are
 * small boolean expressions:
 *
 *   'moving'                 a named flag
 *   '!moving'                the negated flag
 *   'moving && fast'         a conjunction
 *   'a || b'                 a disjunction
 *   '(!a || b) && c'         parentheses group
 *
 * `parseCondition()` compiles such an expression into a predicate, so the
 * table below stays readable and the whole thing stays testable in Node.
 *
 * THE TABLE
 * ---------
 * `TRANSITIONS` is ordered: the FIRST edge of the current state whose
 * condition holds wins. That is why "panic" is listed first everywhere — a
 * hazard overrides everything else.
 */

import { EVENTS } from '../core/events.js';

/**
 * The five animation states.
 * @type {ReadonlyArray<string>}
 */
export const ANIMATION_STATES = Object.freeze(['idle', 'walk', 'run', 'cheer', 'flee']);

/**
 * The candidate clip names of every state.
 *
 * The machine walks the list and takes the first clip the character really
 * has. The names cover all three rigged families of the library:
 *
 *   KayKit crowd      Idle, Walk, Run, Cheer, Wave, Defeat
 *   KayKit adventurers Idle, Walking_A/B, Running_A/B, Cheer, Hit_A, Death_A
 *   city citizens     Idle, Walk, Run, Victory, RecieveHit
 *
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
export const STATE_CLIP_CANDIDATES = Object.freeze({
  idle: Object.freeze(['Idle']),
  walk: Object.freeze(['Walk', 'Walking_A', 'Walking_B']),
  run: Object.freeze(['Run', 'Running_A', 'Running_B']),
  cheer: Object.freeze(['Cheer', 'Victory', 'Wave']),
  flee: Object.freeze(['Dodge_Backward', 'DashBack', 'Roll', 'RecieveHit', 'Hit_A', 'Defeat']),
});

/**
 * The crossfade used when no edge says otherwise.
 *
 * TBD: the publisher published no crossfade duration for the pedestrians.
 * Proposed TUNING key: `citizenCrossfadeSeconds` = 0.25.
 */
export const DEFAULT_FADE_SECONDS = 0.25;

/**
 * The transition table.
 *
 * Each edge: `{from, to, when, fadeSeconds}`. `when` is a condition
 * expression (see the module header); `fadeSeconds` is the crossfade the
 * view layer must run between the two clips.
 *
 * TBD: the per-edge fade durations are a design decision of this rebuild —
 * the dossier records no pedestrian animation timings. Proposed TUNING key:
 * `citizenCrossfadeSeconds` (the default) plus the per-edge values below.
 *
 * @type {ReadonlyArray<{from:string,to:string,when:string,fadeSeconds:number}>}
 */
export const TRANSITIONS = Object.freeze([
  { from: 'idle', to: 'flee', when: 'panicked', fadeSeconds: 0.12 },
  { from: 'idle', to: 'run', when: 'moving && fast', fadeSeconds: 0.2 },
  { from: 'idle', to: 'walk', when: 'moving', fadeSeconds: 0.25 },
  { from: 'idle', to: 'cheer', when: 'happy && cheering', fadeSeconds: 0.35 },

  { from: 'walk', to: 'flee', when: 'panicked', fadeSeconds: 0.12 },
  { from: 'walk', to: 'run', when: 'moving && fast', fadeSeconds: 0.2 },
  { from: 'walk', to: 'idle', when: '!moving', fadeSeconds: 0.3 },

  { from: 'run', to: 'flee', when: 'panicked', fadeSeconds: 0.12 },
  { from: 'run', to: 'walk', when: 'moving && !fast', fadeSeconds: 0.25 },
  { from: 'run', to: 'idle', when: '!moving', fadeSeconds: 0.3 },

  { from: 'cheer', to: 'flee', when: 'panicked', fadeSeconds: 0.12 },
  { from: 'cheer', to: 'walk', when: 'moving', fadeSeconds: 0.25 },
  // The cheer ends when the cheer is over OR when the city stops being happy.
  { from: 'cheer', to: 'idle', when: '!cheering || !happy', fadeSeconds: 0.35 },

  { from: 'flee', to: 'run', when: '!panicked && moving && fast', fadeSeconds: 0.2 },
  { from: 'flee', to: 'walk', when: '!panicked && moving', fadeSeconds: 0.25 },
  { from: 'flee', to: 'idle', when: '!panicked', fadeSeconds: 0.3 },
]);

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/**
 * Split a condition expression into its tokens.
 * @param {string} expr
 * @returns {Array<{t:string, v?:string}>}
 */
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i += 1; continue; }
    if (ch === '(' || ch === ')' || ch === '!') { tokens.push({ t: ch }); i += 1; continue; }
    if (ch === '&' && expr[i + 1] === '&') { tokens.push({ t: '&&' }); i += 2; continue; }
    if (ch === '|' && expr[i + 1] === '|') { tokens.push({ t: '||' }); i += 2; continue; }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(expr.slice(i));
    if (!m) throw new SyntaxError(`population/animation.js: bad condition "${expr}"`);
    tokens.push({ t: 'name', v: m[0] });
    i += m[0].length;
  }
  return tokens;
}

/**
 * Compile a token list into a predicate.
 * @param {Array<{t:string, v?:string}>} tokens
 * @returns {(conditions:object) => boolean}
 */
function compile(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (t) => {
    if (tokens[pos] && tokens[pos].t === t) { pos += 1; return true; }
    return false;
  };

  function parseOr() {
    let left = parseAnd();
    while (eat('||')) {
      const right = parseAnd();
      const l = left;
      left = (c) => l(c) || right(c);
    }
    return left;
  }

  function parseAnd() {
    let left = parseUnary();
    while (eat('&&')) {
      const right = parseUnary();
      const l = left;
      left = (c) => l(c) && right(c);
    }
    return left;
  }

  function parseUnary() {
    if (eat('!')) {
      const inner = parseUnary();
      return (c) => !inner(c);
    }
    if (eat('(')) {
      const inner = parseOr();
      eat(')');
      return inner;
    }
    const tok = peek();
    if (!tok || tok.t !== 'name') throw new SyntaxError('population/animation.js: bad condition');
    pos += 1;
    return (c) => !!c[tok.v];
  }

  const fn = parseOr();
  if (pos !== tokens.length) {
    throw new SyntaxError('population/animation.js: trailing tokens in condition');
  }
  return fn;
}

/** The compiled conditions, cached per expression. */
const conditionCache = new Map();

/**
 * Compile a condition expression into a predicate.
 *
 * An unknown flag is simply falsy — a condition never throws on a missing
 * flag, because the view layer builds the flag set from whatever the world
 * knows at that moment.
 *
 * @param {string} expr e.g. `'!panicked && moving'`
 * @returns {(conditions:object) => boolean}
 */
export function parseCondition(expr) {
  const text = String(expr ?? '').trim();
  if (!text) return () => true;
  let fn = conditionCache.get(text);
  if (!fn) {
    fn = compile(tokenize(text));
    conditionCache.set(text, fn);
  }
  return fn;
}

/**
 * Evaluate a condition expression against a set of flags.
 * @param {string} expr
 * @param {object} [conditions]
 * @returns {boolean}
 */
export function evaluateCondition(expr, conditions = {}) {
  return parseCondition(expr)(conditions ?? {});
}

// ---------------------------------------------------------------------------
// The machine
// ---------------------------------------------------------------------------

/**
 * The first edge of `state` whose condition holds.
 *
 * @param {string} state
 * @param {object} [conditions]
 * @param {object} [options] `{transitions}`
 * @returns {{from:string,to:string,when:string,fadeSeconds:number}|null}
 */
export function nextTransition(state, conditions = {}, options = {}) {
  const table = options.transitions ?? TRANSITIONS;
  for (const edge of table) {
    if (edge.from !== state) continue;
    if (!evaluateCondition(edge.when, conditions)) continue;
    return edge;
  }
  return null;
}

/**
 * The state a citizen should be in, given the current state and the flags.
 *
 * This is the PURE driver of the machine: it never mutates anything.
 *
 * @param {string} state the current state
 * @param {object} [conditions] `{moving, fast, happy, panicked, cheering}`
 * @param {object} [options] `{transitions}`
 * @returns {string|null} the next state, or null when nothing applies
 */
export function evaluate(state, conditions = {}, options = {}) {
  const edge = nextTransition(state, conditions, options);
  return edge ? edge.to : null;
}

/**
 * Normalise a clip name list (strings or `{name}` objects) to plain names.
 * @param {Array<string|{name?:string}>} clips
 * @returns {Array<string>}
 */
function clipNames(clips) {
  const out = [];
  for (const clip of clips ?? []) {
    const name = typeof clip === 'string' ? clip : clip?.name;
    if (typeof name === 'string' && name) out.push(name);
  }
  return out;
}

/**
 * Create an animation machine for ONE character.
 *
 * The machine knows the clips the character really has, so it can resolve a
 * state to a playable clip and refuse a state the character cannot play.
 *
 * @param {object} [options]
 * @param {Array<string|{name?:string}>} [options.clips] the character's clips
 * @param {string} [options.initial] the initial state (default `idle`)
 * @param {ReadonlyArray} [options.transitions] the transition table
 * @param {object} [options.conditions] the flags the machine starts with
 */
export function createAnimationMachine(options = {}) {
  const table = options.transitions ?? TRANSITIONS;
  const names = clipNames(options.clips);
  let state = options.initial && ANIMATION_STATES.includes(options.initial) ? options.initial : 'idle';
  let conditions = { ...(options.conditions ?? {}) };

  /**
   * The clip a state plays for this character, or null when the character
   * has no clip for it.
   * @param {string} target
   * @returns {string|null}
   */
  function clipFor(target) {
    const candidates = STATE_CLIP_CANDIDATES[target] ?? [];
    for (const candidate of candidates) {
      const hit = names.find((n) => n.toLowerCase() === candidate.toLowerCase());
      if (hit) return hit;
    }
    return null;
  }

  /**
   * The state that is actually PLAYABLE: a state without a clip falls back
   * to `idle` (and to the state itself when even `idle` is missing).
   * @param {string} target
   * @returns {string}
   */
  function resolveState(target) {
    if (clipFor(target)) return target;
    if (target !== 'idle' && clipFor('idle')) return 'idle';
    return target;
  }

  /**
   * Move to another state.
   *
   * A transition the table does not define is REFUSED: the machine stays
   * where it is. A transition whose condition does not hold is refused too,
   * unless `force` is set.
   *
   * The clip availability IS part of the state: a character without a `Walk`
   * clip falls back to `idle` instead of playing a clip that is not there.
   * The state the machine reports is therefore always PLAYABLE.
   *
   * @param {string} target the wanted state
   * @param {object} [opts]
   * @param {boolean} [opts.force] ignore the table and the conditions
   * @param {object} [opts.conditions] the flags to test against
   * @returns {{changed:boolean, from:string, to:string, fadeSeconds:number,
   *            reason:string}}
   */
  function transition(target, opts = {}) {
    const from = state;
    const flags = opts.conditions ? { ...conditions, ...opts.conditions } : conditions;
    const force = !!opts.force;

    const edge = table.find((e) => e.from === from && e.to === target);

    if (!edge) {
      if (!force) {
        return { changed: false, from, to: from, fadeSeconds: 0, reason: 'no-transition' };
      }
      const to = resolveState(target);
      state = to;
      return {
        changed: to !== from,
        from,
        to,
        fadeSeconds: DEFAULT_FADE_SECONDS,
        reason: 'forced',
      };
    }

    if (!force && !evaluateCondition(edge.when, flags)) {
      return { changed: false, from, to: from, fadeSeconds: 0, reason: 'condition' };
    }

    const to = resolveState(target);
    state = to;
    return {
      changed: to !== from,
      from,
      to,
      fadeSeconds: edge.fadeSeconds ?? DEFAULT_FADE_SECONDS,
      reason: to === target ? 'ok' : 'fallback',
    };
  }

  /**
   * Drive the machine with a fresh set of flags.
   *
   * The first edge of the current state whose condition holds is taken.
   *
   * @param {object} [flags]
   * @returns {{changed:boolean, from:string, to:string, fadeSeconds:number,
   *            reason:string}}
   */
  function drive(flags = {}) {
    conditions = { ...flags };
    const edge = nextTransition(state, conditions, { transitions: table });
    if (!edge) {
      return { changed: false, from: state, to: state, fadeSeconds: 0, reason: 'no-transition' };
    }
    return transition(edge.to, { conditions });
  }

  return {
    /** The current state. */
    get state() { return state; },

    /** The flags the machine last saw. */
    get conditions() { return { ...conditions }; },

    /** The clip names of the character. */
    get clips() { return [...names]; },

    /** The transition table the machine runs. */
    get transitions() { return table; },

    /**
     * The clip a state plays for this character.
     * @param {string} target
     * @returns {string|null}
     */
    clipFor,

    /**
     * The playable version of a state.
     * @param {string} target
     * @returns {string}
     */
    resolveState,

    /**
     * Move to another state.
     * @param {string} target
     * @param {object} [opts]
     * @returns {{changed:boolean, from:string, to:string, fadeSeconds:number,
     *            reason:string}}
     */
    transition,

    /**
     * Drive the machine with a fresh set of flags.
     * @param {object} [flags]
     * @returns {{changed:boolean, from:string, to:string, fadeSeconds:number,
     *            reason:string}}
     */
    evaluate: drive,

    /**
     * Put the machine back into a state.
     * @param {string} [target]
     */
    reset(target = 'idle') {
      state = ANIMATION_STATES.includes(target) ? target : 'idle';
      conditions = {};
    },
  };
}

// ---------------------------------------------------------------------------
// The hazards the machine reacts to
// ---------------------------------------------------------------------------

/**
 * The bus events that put the citizens into panic.
 *
 * The hazard system is not part of POP: it publishes on the shared bus and
 * every domain that cares subscribes. POP only needs to know WHETHER a
 * hazard is active, so it counts them.
 *
 * @type {Readonly<{started:string, resolved:string}>}
 */
export const HAZARD_EVENTS = Object.freeze({
  started: EVENTS.HAZARD_STARTED,
  resolved: EVENTS.HAZARD_RESOLVED,
});

/**
 * A tiny counter of the hazards that are currently active.
 *
 * It is deliberately independent of the event bus so it can be unit-tested
 * without a bus, and it degrades gracefully: with no bus at all, no hazard
 * is ever active and the citizens simply never panic.
 *
 * The hazards publish their cell position and their radius (in CELLS), so
 * the watch can answer "is THIS citizen in danger?" and not "is there danger
 * somewhere in the city?". A hazard without a usable position panics
 * everybody, because the safe thing to do is not to guess.
 *
 * @param {object} [options]
 * @param {{on?:Function, off?:Function}} [options.bus] the event bus
 */
export function createHazardWatch(options = {}) {
  const bus = options.bus ?? null;
  /** id -> {x, z, radius} in CELLS */
  const active = new Map();
  let anonymous = 0;

  function onStarted(payload) {
    const id = payload?.id;
    if (id === undefined || id === null) {
      anonymous += 1;
      return;
    }
    active.set(id, {
      x: Number.isFinite(payload?.x) ? payload.x : null,
      z: Number.isFinite(payload?.z) ? payload.z : null,
      radius: Number.isFinite(payload?.radius) ? Math.max(0, payload.radius) : 0,
    });
  }

  function onResolved(payload) {
    const id = payload?.id;
    if (id === undefined || id === null) {
      // The hazard system did not say WHICH hazard ended: drop them all
      // rather than keep the citizens in panic forever.
      anonymous = 0;
      active.clear();
      return;
    }
    active.delete(id);
  }

  const unsubscribes = [];
  if (bus && typeof bus.on === 'function') {
    try {
      unsubscribes.push(bus.on(HAZARD_EVENTS.started, onStarted));
      unsubscribes.push(bus.on(HAZARD_EVENTS.resolved, onResolved));
    } catch {
      /* a bus that cannot subscribe is a bus without hazards */
    }
  }

  return {
    /** Is a hazard active right now? */
    active() {
      return active.size > 0 || anonymous > 0;
    },
    /** The number of active hazards. */
    count() {
      return active.size + anonymous;
    },
    /**
     * Is a CELL inside a hazard?
     *
     * @param {number} cx the cell column
     * @param {number} cz the cell row
     * @returns {boolean}
     */
    near(cx, cz) {
      if (anonymous > 0) return true;
      for (const h of active.values()) {
        if (h.x === null || h.z === null) return true;
        const dx = Number(cx) - h.x;
        const dz = Number(cz) - h.z;
        if (Math.hypot(dx, dz) <= Math.max(1, h.radius)) return true;
      }
      return false;
    },
    /** Stop listening. */
    dispose() {
      for (const un of unsubscribes) {
        try { un?.(); } catch { /* ignore */ }
      }
      unsubscribes.length = 0;
      active.clear();
      anonymous = 0;
    },
  };
}
