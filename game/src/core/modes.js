/**
 * core/modes.js — CORE mode registry, mode switching and the clock.
 *
 * Modes are a **data-driven registry** (FR-CORE-014): every subsystem reads
 * the active mode's *flags* instead of testing a mode name, so new modes are
 * added as data and the registry can grow without an engine change
 * (FR-CORE-025).
 *
 * Dossier: docs/requirements/01-core-loop-modes-progression.md
 *  - FR-CORE-013 (features unavailable at the start are a per-mode starting
 *    capability set),
 *  - FR-CORE-014 … FR-CORE-019 (registry, status, the two evidenced sandbox
 *    modes and their rulesets),
 *  - FR-CORE-020 / FR-CORE-021 (the sandbox offer and the Sandbox
 *    Constructions entitlement *modify* a ruleset rather than forking it),
 *  - FR-CORE-022 (the top-bar blocks a mode shows),
 *  - FR-CORE-023 / FR-CORE-030 (the announced PC modes are listed, and are
 *    display-only),
 *  - FR-CORE-026 / FR-CORE-027 (switching never silently destroys a city and
 *    a mode stays re-enterable),
 *  - FR-CORE-028 (no persistent mode picker; the save reopens on the last
 *    mode played),
 *  - FR-CORE-003 / FR-CORE-004 (one authoritative clock), FR-CORE-005
 *    (pause and speed).
 *
 * HONESTY: the mode ids come from `config.MODES` (integrator-owned). The
 * ruleset flags below are derived from the published behaviour of each mode;
 * every threshold that is not published carries a `TBD:` marker and is
 * listed in `TBD_VALUES` (and in the CORE final report).
 *
 * Pure logic: this module never imports `three`.
 */

import { MODES, MODE_LABELS, SPEED, SPEED_ORDER, TUNING, DAY_LENGTH } from './config.js';
import { EVENTS, emit } from './events.js';
import { createState, setState, snapshot, state as liveState, DEFAULT_SEED } from './state.js';
import { restoreInto } from './save.js';
import { STAGES } from './stage.js';

// ---------------------------------------------------------------------------
// TBD constants — proposed additions to TUNING (see CORE final report)
// ---------------------------------------------------------------------------

/**
 * TBD: OQ-CORE-09 — the length of an in-game year is not published.
 * Proposed TUNING addition: `daysPerYear`.
 */
export const DAYS_PER_YEAR = 365;

/** Unresolved numbers in this module, for developer tooling (NFR-CORE-004). */
export const TBD_VALUES = Object.freeze([
  Object.freeze({
    key: 'daysPerYear',
    value: DAYS_PER_YEAR,
    reason: 'OQ-CORE-09 — secondsPerDay / daysPerYear are not published.',
  }),
]);

// ---------------------------------------------------------------------------
// The mode registry
// ---------------------------------------------------------------------------

/**
 * Flags shared by the full-simulation modes (mobile default city play).
 * Every flag is a boolean (dossier §6.2).
 */
const FULL_SIMULATION_FLAGS = Object.freeze({
  economy: true,
  progression: true,
  residents: true,
  traffic: true,
  zoning: true,
  score: true,
  leaderboard: true,
  constructionTimers: true,
  camera: true,
  region: true,
  premiumEconomy: true,
  deepCitizens: false,
});

/**
 * Flags of the **announced** PC modes (dossier §4.1). Only the columns the
 * dossier actually states are set: economy, progression, construction timers
 * and score are "on"; the region / camera column is "—" and the rest is
 * unevidenced, so they stay off.
 */
const ANNOUNCED_FLAGS = Object.freeze({
  economy: true,
  progression: true,
  residents: true,
  traffic: false,
  zoning: false,
  score: true,
  leaderboard: true,
  constructionTimers: true,
  camera: false,
  region: false,
  premiumEconomy: false,
  deepCitizens: false,
});

/**
 * The mode registry.
 *
 * `status` follows FR-CORE-015: only `shipped` modes are selectable;
 * `announced` modes are listed for the roadmap and cannot be entered (E12).
 *
 * The four `config.MODES` keys are the selectable entry points. The extra
 * entries document the modes the dossier requires the registry to *ship*
 * (FR-CORE-016) or to *list* (FR-CORE-023 / FR-CORE-030); they are marked
 * `selectable: false` because `config.MODES` has no key for them — see the
 * CORE final report for the proposed config addition.
 */
export const MODE_REGISTRY = Object.freeze({
  [MODES.play]: Object.freeze({
    id: MODES.play,
    displayName: MODE_LABELS[MODES.play],
    status: 'shipped',
    selectable: true,
    evidence: 'The Basics flow + economy tutorial (mobile): the mode the game opens into.',
    notes: 'Default city play: economy, progression, residents, score and leaderboard all on.',
    flags: FULL_SIMULATION_FLAGS,
    topBarBlocks: Object.freeze(['demand', 'usage', 'money', 'level', 'residents', 'date', 'score']),
    startingCapabilities: Object.freeze(['build', 'road', 'zone', 'services', 'budget', 'level']),
    startingGrant: Object.freeze({ coins: TUNING.startingTreasury, superCash: 0, unlockSet: Object.freeze([]) }),
    winConditions: null,
  }),

  [MODES.sandbox]: Object.freeze({
    id: MODES.sandbox,
    displayName: MODE_LABELS[MODES.sandbox],
    status: 'shipped',
    selectable: true,
    evidence: 'Steam store + EA Q&A: "Early Access begins with a construction sandbox … Economy and progression systems are not yet included."',
    notes: 'Construction Sandbox (PC-EA): world shaping, placement, assets and exploration; economy, progression, residents and score are off (FR-CORE-017 / FR-CORE-018).',
    flags: Object.freeze({
      economy: false,
      progression: false,
      residents: false,
      traffic: true,
      zoning: false,
      score: false,
      leaderboard: false,
      constructionTimers: false,
      camera: true,
      region: true,
      premiumEconomy: false,
      deepCitizens: false,
    }),
    topBarBlocks: Object.freeze(['date']),
    startingCapabilities: Object.freeze(['build', 'road', 'terraform', 'studio', 'camera']),
    startingGrant: Object.freeze({ coins: 0, superCash: 0, unlockSet: Object.freeze([]) }),
    winConditions: null,
  }),

  [MODES.editor]: Object.freeze({
    id: MODES.editor,
    displayName: MODE_LABELS[MODES.editor],
    status: 'shipped',
    selectable: true,
    evidence: 'Steam store feature list: "SCC Studio & Steam Workshop"; EA Q&A: "SCC Studio lets you customize models or create your own assets and use them in your city."',
    notes: 'SCC Studio: asset authoring only — no simulation, no score, no progression.',
    flags: Object.freeze({
      economy: false,
      progression: false,
      residents: false,
      traffic: false,
      zoning: false,
      score: false,
      leaderboard: false,
      constructionTimers: false,
      camera: true,
      region: false,
      premiumEconomy: false,
      deepCitizens: false,
    }),
    topBarBlocks: Object.freeze([]),
    startingCapabilities: Object.freeze(['studio', 'voxel', 'palette', 'camera']),
    startingGrant: Object.freeze({ coins: 0, superCash: 0, unlockSet: Object.freeze([]) }),
    winConditions: null,
  }),

  [MODES.scenario]: Object.freeze({
    id: MODES.scenario,
    displayName: MODE_LABELS[MODES.scenario],
    status: 'in-development',
    selectable: false,
    evidence: 'none — store listing mentions "creative puzzle-solving" as a genre, not a mode.',
    notes: 'FR-CORE-077 / OQ-CORE-07: expressed as a ruleset with a win-condition list and a starting grant. It is not selectable until objectives are supplied; startMode("scenario", { winConditions }) launches it.',
    flags: Object.freeze({
      economy: true,
      progression: true,
      residents: true,
      traffic: true,
      zoning: true,
      score: true,
      leaderboard: false,
      constructionTimers: true,
      camera: true,
      region: false,
      premiumEconomy: false,
      deepCitizens: false,
    }),
    topBarBlocks: Object.freeze(['demand', 'usage', 'money', 'level', 'residents', 'date']),
    startingCapabilities: Object.freeze(['build', 'road', 'zone', 'services', 'budget', 'level']),
    // TBD: the starting grant of a scenario is unresolved (OQ-CORE-07).
    startingGrant: Object.freeze({ coins: TUNING.startingTreasury, superCash: 0, unlockSet: Object.freeze([]) }),
    winConditions: Object.freeze([]),
  }),

  // ---- registry-only entries -------------------------------------------
  'sandbox-construction': Object.freeze({
    id: 'sandbox-construction',
    displayName: 'Sandbox Construction Mode',
    status: 'shipped',
    selectable: false,
    evidence: 'App Store + Google Play feature bullets: "SANDBOX CONSTRUCTION MODE: Build instantly without delays."',
    notes: 'Mobile Sandbox Construction Mode: instant placement, no pay-to-skip, economy still tracks the cost (FR-CORE-019). Modelled as `play` + the "sandbox-constructions" entitlement (FR-CORE-020 / FR-CORE-021) rather than a separate mode.',
    flags: Object.freeze({ ...FULL_SIMULATION_FLAGS, constructionTimers: false }),
    topBarBlocks: Object.freeze(['demand', 'usage', 'money', 'level', 'residents', 'date', 'score']),
    startingCapabilities: Object.freeze(['build', 'road', 'zone', 'services', 'budget', 'level']),
    startingGrant: Object.freeze({ coins: TUNING.startingTreasury, superCash: 0, unlockSet: Object.freeze([]) }),
    winConditions: null,
  }),

  'classical-rci': Object.freeze({
    id: 'classical-rci',
    displayName: 'Classical RCI',
    status: 'announced',
    selectable: false,
    evidence: 'Developer, Steam discussion "People Simulation": "there will be different game modes. I\'m thinking a classical RCI mode …"',
    notes: 'Announced — listed for the roadmap, cannot be entered (FR-CORE-015, E12).',
    flags: ANNOUNCED_FLAGS,
    topBarBlocks: Object.freeze(['demand', 'usage', 'money', 'level', 'residents', 'date', 'score']),
    startingCapabilities: Object.freeze([]),
    startingGrant: Object.freeze({ coins: 0, superCash: 0, unlockSet: Object.freeze([]) }),
    winConditions: null,
  }),

  'resource-management': Object.freeze({
    id: 'resource-management',
    displayName: 'Resource Management',
    status: 'announced',
    selectable: false,
    evidence: 'Developer, Steam discussion "People Simulation": "one that is more focused on resource management".',
    notes: 'Announced — listed for the roadmap, cannot be entered (FR-CORE-015, E12).',
    flags: ANNOUNCED_FLAGS,
    topBarBlocks: Object.freeze(['demand', 'usage', 'money', 'level', 'residents', 'date', 'score']),
    startingCapabilities: Object.freeze([]),
    startingGrant: Object.freeze({ coins: 0, superCash: 0, unlockSet: Object.freeze([]) }),
    winConditions: null,
  }),

  'casual-tycoon': Object.freeze({
    id: 'casual-tycoon',
    displayName: 'Casual Tycoon',
    status: 'announced',
    selectable: false,
    evidence: 'Developer, Steam discussion "People Simulation": "a very casual tycoon mode".',
    notes: 'Announced — listed for the roadmap, cannot be entered (FR-CORE-015, E12).',
    flags: Object.freeze({ ...ANNOUNCED_FLAGS, economy: true, economyProfile: 'relaxed' }),
    topBarBlocks: Object.freeze(['demand', 'usage', 'money', 'level', 'residents', 'date', 'score']),
    startingCapabilities: Object.freeze([]),
    startingGrant: Object.freeze({ coins: 0, superCash: 0, unlockSet: Object.freeze([]) }),
    winConditions: null,
  }),

  'deep-citizen': Object.freeze({
    id: 'deep-citizen',
    displayName: 'Deep Citizen Simulation',
    status: 'announced',
    selectable: false,
    evidence: 'Developer, Steam discussion "People Simulation": "one of them could definitely go much deeper into the individual people, their life cycle, relationships, routines".',
    notes: 'Announced and opt-in — the dev names scaling as the hard part (FR-CORE-024, FR-CORE-078).',
    flags: Object.freeze({ ...ANNOUNCED_FLAGS, deepCitizens: true }),
    topBarBlocks: Object.freeze(['demand', 'usage', 'money', 'level', 'residents', 'date', 'score']),
    startingCapabilities: Object.freeze([]),
    startingGrant: Object.freeze({ coins: 0, superCash: 0, unlockSet: Object.freeze([]) }),
    winConditions: null,
  }),
});

/**
 * Entitlements — they *modify* a mode's ruleset, they do not fork it
 * (FR-CORE-020 / FR-CORE-021, §4.2).
 */
export const ENTITLEMENTS = Object.freeze({
  'sandbox-constructions': Object.freeze({
    id: 'sandbox-constructions',
    displayName: 'Sandbox Constructions',
    overrides: Object.freeze({ constructionTimers: false, instantConfirmMove: true }),
  }),
  'premium-sandbox': Object.freeze({
    id: 'premium-sandbox',
    displayName: 'Premium Sandbox',
    overrides: Object.freeze({ premiumEconomy: true, unlimitedBuilds: true }),
  }),
  'citycon-building': Object.freeze({
    id: 'citycon-building',
    displayName: 'Citycon Building',
    overrides: Object.freeze({ constructionSlots: 1 }),
  }),
  'speed-up-package': Object.freeze({
    id: 'speed-up-package',
    displayName: 'Speed-up Package',
    overrides: Object.freeze({ adSpeedUp: false }),
  }),
  'piggy-bank': Object.freeze({
    id: 'piggy-bank',
    displayName: 'Piggy Bank',
    overrides: Object.freeze({ piggyBank: true }),
  }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The mode definition for an id, or null. */
export function modeDefinition(mode) {
  if (!mode) return null;
  return MODE_REGISTRY[mode] || null;
}

/** The mode the session currently runs. */
export function currentMode(state = liveState) {
  return modeDefinition(state?.meta?.mode);
}

/** True when the session owns an entitlement. */
export function hasEntitlement(state = liveState, id) {
  const owned = state?.meta?.entitlements;
  return Array.isArray(owned) && owned.includes(id);
}

/**
 * The effective ruleset of the session: the mode's flags overridden by the
 * entitlements the player owns (FR-CORE-021). Subsystems read this instead
 * of testing a mode name (FR-CORE-014).
 */
export function effectiveRuleset(state = liveState) {
  const def = currentMode(state);
  const flags = { ...(def?.flags || {}) };
  const owned = Array.isArray(state?.meta?.entitlements) ? state.meta.entitlements : [];
  for (const id of owned) {
    const ent = ENTITLEMENTS[id];
    if (ent?.overrides) Object.assign(flags, ent.overrides);
  }
  return flags;
}

/** One flag of the effective ruleset. */
export function modeFlag(state = liveState, key) {
  return effectiveRuleset(state)[key];
}

/** The top-bar blocks the active mode shows (§4.4). */
export function topBarBlocks(state = liveState) {
  const def = currentMode(state);
  return def ? [...def.topBarBlocks] : [];
}

/**
 * Is the SCC Studio reachable?
 *
 * Always: the studio is a **mode**, not content behind a stage. FR-CORE-046
 * forbids gating content on a named city stage, §4.1 lists SCC Studio as a
 * feature of the shipped PC Early Access Construction Sandbox, and no
 * published rule gates it. (An earlier draft gated it behind the first
 * milestone; that gate was removed — see the CORE final report.)
 */
export function editorUnlocked(state = liveState) {
  return true;
}

/**
 * May the session switch into `mode`?
 *
 * Rules:
 *  - the mode must exist in the registry (FR-CORE-014),
 *  - only `shipped` modes are selectable (FR-CORE-015, E12),
 *  - a registry entry that is not selectable (an announced mode, or a mode
 *    outside `config.MODES`) cannot be entered.
 *
 * @param {string} mode
 * @param {object} [state]
 * @returns {boolean}
 */
export function canSwitchMode(mode, state = liveState) {
  const def = modeDefinition(mode);
  if (!def) return false;
  if (def.status !== 'shipped') return false;
  if (!def.selectable) return false;
  return true;
}

/**
 * The modes that can be selected right now.
 * @param {object} [state]
 * @returns {string[]}
 */
export function availableModes(state = liveState) {
  return Object.values(MODES).filter((mode) => canSwitchMode(mode, state));
}

// ---------------------------------------------------------------------------
// Mode switching
// ---------------------------------------------------------------------------

/**
 * Cities parked per mode, so switching never destroys a city and a mode
 * stays re-enterable with its own save (FR-CORE-026 / FR-CORE-027).
 * @type {Map<string, object>}
 */
const modeCities = new Map();

/** Copy a state tree into the live object, preserving its identity. */
function swapInto(live, next) {
  for (const key of Object.keys(live)) delete live[key];
  Object.assign(live, next);
  setState(live);
  return live;
}

function defaultSession(state, mode) {
  const seed = state?.meta?.seed ?? DEFAULT_SEED;
  const previous = state?.meta?.session || {};
  return {
    // TBD: no published account / region / map identifiers — local defaults
    // derived from the seed. See the CORE final report.
    accountId: previous.accountId ?? `local-${seed}`,
    product: previous.product ?? 'pc',
    modeId: mode,
    regionId: previous.regionId ?? 'region-1',
    activeMapId: previous.activeMapId ?? 'map-1',
  };
}

/**
 * Start (or switch into) a mode.
 *
 * - An unknown mode, an `announced` mode, or a mode the session may not
 *   enter returns `false` and changes nothing (FR-CORE-015, E12).
 * - An `in-development` mode (scenario) is started only when the caller
 *   supplies its objectives: `startMode('scenario', { winConditions: [...] })`
 *   (FR-CORE-077, OQ-CORE-07).
 * - The city of the mode being left is parked, so returning to it restores
 *   that city instead of losing it (FR-CORE-027).
 * - `opts.state` adopts an existing state object, `opts.fresh` forces a new
 *   city, `opts.seed` chooses the new seed, `opts.entitlements` sets the
 *   owned entitlements.
 *
 * @param {string} mode
 * @param {{seed?: number, state?: object, fresh?: boolean, discardCity?: boolean, entitlements?: string[], winConditions?: Array}} [opts]
 * @returns {boolean} true when the session is now in `mode`
 */
export function startMode(mode, opts = {}) {
  const def = modeDefinition(mode);
  if (!def) return false;
  if (def.status === 'announced') return false;

  const objectives = Array.isArray(opts.winConditions) && opts.winConditions.length > 0
    ? [...opts.winConditions]
    : null;
  if (def.status !== 'shipped' && !objectives) return false;
  // A registry entry outside `config.MODES` is never entered; an
  // in-development mode is entered only with its objectives.
  if (!def.selectable && !(def.status === 'in-development' && objectives)) return false;

  const live = liveState;
  const previousMode = live?.meta?.mode ?? null;

  // Park the city we are leaving so it is never silently destroyed.
  if (previousMode && previousMode !== mode && !opts.discardCity) {
    modeCities.set(previousMode, snapshot(live));
  }

  let next;
  let fresh = false;
  let adopted = false;
  if (opts.state && typeof opts.state === 'object') {
    next = opts.state;
    adopted = true;
  } else if (opts.fresh) {
    next = createState(Number.isFinite(opts.seed) ? opts.seed : (live?.meta?.seed ?? DEFAULT_SEED));
    fresh = true;
  } else if (previousMode === mode) {
    // Same mode: keep the city as it is — a switch must never wipe a city.
    // Pass `{ fresh: true }` to start a brand-new city in this mode.
    next = live;
  } else if (modeCities.has(mode)) {
    // `restoreInto` keeps the identity of the live state object and repairs
    // the typed arrays that `restore()` alone would leave as plain objects.
    next = restoreInto(live, modeCities.get(mode));
  } else {
    next = createState(Number.isFinite(opts.seed) ? opts.seed : (live?.meta?.seed ?? DEFAULT_SEED));
    fresh = true;
  }

  if (next !== live) swapInto(live, next);

  // ---- mode metadata ---------------------------------------------------
  live.meta.mode = mode;
  live.meta.progression = def.flags.progression !== false;
  live.meta.topBarBlocks = [...def.topBarBlocks];
  live.meta.entitlements = Array.isArray(opts.entitlements)
    ? [...opts.entitlements]
    : (Array.isArray(live.meta.entitlements) ? live.meta.entitlements : []);
  live.meta.session = defaultSession(live, mode);
  // The objectives of a scenario mode, so the UI and the scoring domain can
  // read them (FR-CORE-077).
  live.meta.winConditions = objectives ?? (def.winConditions ? [...def.winConditions] : null);

  if (fresh) {
    live.meta.stageIndex = 0;
    live.meta.stageId = STAGES[0]?.id ?? null;
    live.meta.day = 1;
    live.meta.speed = SPEED.normal;
    live.meta.paused = false;
    live.meta.score = 0;
  }
  // The effective ruleset is what subsystems read (FR-CORE-021).
  live.meta.modeFlags = effectiveRuleset(live);

  emit(EVENTS.MODE_CHANGED, {
    mode,
    previousMode,
    definition: def,
    fresh,
    /** The mode whose city was parked for a later return (FR-CORE-027). */
    parked: previousMode && previousMode !== mode && !opts.discardCity ? previousMode : null,
    startingGrant: def.startingGrant ? { ...def.startingGrant } : null,
    winConditions: live.meta.winConditions ? [...live.meta.winConditions] : null,
    flags: live.meta.modeFlags,
    topBarBlocks: live.meta.topBarBlocks,
    session: live.meta.session,
  });
  if (fresh) {
    emit(EVENTS.GAME_RESET, { mode, startingGrant: def.startingGrant ? { ...def.startingGrant } : null });
  } else if (adopted || previousMode !== mode) {
    // A city was put back — the domains that rebuild their meshes on a load
    // need to know (FR-CORE-027).
    emit(EVENTS.GAME_LOADED, { source: 'mode', mode, previousMode, slot: null });
  }
  return true;
}

/** The city parked for a mode (debug / UI helper). */
export function parkedCity(mode) {
  return modeCities.get(mode) || null;
}

/** Forget every parked city (used when the profile is wiped). */
export function clearParkedCities() {
  modeCities.clear();
}

// ---------------------------------------------------------------------------
// The clock
// ---------------------------------------------------------------------------

/** Resolve a speed name or number against `SPEED`. */
export function resolveSpeed(speed) {
  if (typeof speed === 'string') {
    const name = speed.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(SPEED, name)) {
      return { name, value: SPEED[name] };
    }
    const asNumber = Number(name);
    if (Number.isFinite(asNumber)) return resolveSpeed(asNumber);
    return null;
  }
  if (typeof speed === 'number' && Number.isFinite(speed)) {
    for (const name of SPEED_ORDER) {
      if (SPEED[name] === speed) return { name, value: speed };
    }
    return null;
  }
  return null;
}

/**
 * Set the simulation speed.
 *
 * Choosing a speed while paused resumes the session at that speed;
 * choosing "paused" remembers the previous speed so that unpausing can
 * restore it. Nothing is emitted when nothing changed (CONTRACT §2).
 *
 * @param {string|number} speed a `SPEED` name ("slow", "normal", …) or value
 * @param {object} [state]
 * @returns {boolean} false for an unknown speed
 */
export function setSpeed(speed, state = liveState) {
  const resolved = resolveSpeed(speed);
  if (!resolved) return false;

  const previousSpeed = state.meta.speed;
  const previousPaused = state.meta.paused;
  const wantsPaused = resolved.value === SPEED.paused;

  if (wantsPaused) {
    if (previousSpeed !== SPEED.paused) state.meta.speedBeforePause = previousSpeed;
    state.meta.speed = resolved.value;
    state.meta.paused = true;
  } else {
    state.meta.speed = resolved.value;
    // Picking a speed is an instruction to run at that speed.
    state.meta.paused = false;
  }

  const speedChanged = state.meta.speed !== previousSpeed;
  const pausedChanged = state.meta.paused !== previousPaused;
  if (!speedChanged && !pausedChanged) return true;

  if (speedChanged) {
    emit(EVENTS.SPEED_CHANGED, { speed: resolved.value, name: resolved.name, previous: previousSpeed });
  }
  if (pausedChanged) {
    emit(EVENTS.PAUSE_CHANGED, { paused: state.meta.paused, previous: previousPaused });
  }
  return true;
}

/**
 * Pause / resume the simulation.
 * @param {boolean} paused
 * @param {object} [state]
 * @returns {boolean}
 */
export function setPaused(paused, state = liveState) {
  const next = Boolean(paused);
  const previous = state.meta.paused;
  if (previous === next) return true;

  state.meta.paused = next;
  if (!next && state.meta.speed === SPEED.paused) {
    const restore = Number.isFinite(state.meta.speedBeforePause) && state.meta.speedBeforePause > 0
      ? state.meta.speedBeforePause
      : SPEED.normal;
    state.meta.speed = restore;
    emit(EVENTS.SPEED_CHANGED, { speed: restore, name: currentSpeedName(state), previous: SPEED.paused });
  }

  emit(EVENTS.PAUSE_CHANGED, { paused: next, previous });
  return true;
}

/** The name of the current speed ("paused", "slow", "normal", "fast", "ultra"). */
export function currentSpeedName(state = liveState) {
  if (state?.meta?.paused) return 'paused';
  const value = state?.meta?.speed;
  for (const name of SPEED_ORDER) {
    if (SPEED[name] === value) return name;
  }
  return 'normal';
}

/** The in-game year for a day counter (day 1 is Day Zero → year 0). */
export function yearForDay(day) {
  const d = typeof day === 'number' && Number.isFinite(day) ? day : 1;
  return Math.max(0, Math.floor((d - 1) / DAYS_PER_YEAR));
}

/**
 * The day index — the game starts at **Day Zero** (FR-CORE-003).
 * `state.meta.day` counts days (1 = the first day); the index is zero-based.
 */
export function dayIndex(state = liveState) {
  const day = state?.meta?.day;
  return Math.max(0, (typeof day === 'number' && Number.isFinite(day) ? day : 1) - 1);
}

/**
 * Advance the authoritative clock (FR-CORE-003 / FR-CORE-004).
 *
 * `gameDt` is **game** time in seconds (already multiplied by the speed, and
 * zero while paused). The elapsed time accumulates in `state.meta.elapsed`,
 * and every `DAY_LENGTH`-second boundary advances the day counter.
 *
 * One day lasts `config.DAY_LENGTH` real seconds at `normal` speed; the
 * length of a year is unpublished (OQ-CORE-09) — see `DAYS_PER_YEAR`.
 *
 * The integrator calls this from the frame loop; CORE owns the clock, every
 * other domain reads `state.meta.day` / `state.meta.elapsed`.
 *
 * @param {object} [state]
 * @param {number} gameDt game seconds elapsed since the last call
 * @returns {{day: number, dayIndex: number, year: number, elapsed: number, daysAdvanced: number}}
 */
export function advanceClock(state = liveState, gameDt = 0) {
  const dt = Number.isFinite(gameDt) && gameDt > 0 ? gameDt : 0;
  const secondsPerDay = Number.isFinite(DAY_LENGTH) && DAY_LENGTH > 0 ? DAY_LENGTH : 60;

  state.meta.elapsed = (Number.isFinite(state.meta.elapsed) ? state.meta.elapsed : 0) + dt;
  state.meta.tick = (Number.isFinite(state.meta.tick) ? state.meta.tick : 0) + 1;

  // Time already spent inside the current day.
  let remaining = (Number.isFinite(state.meta.dayProgress) ? state.meta.dayProgress : 0) + dt;
  let daysAdvanced = 0;
  while (remaining >= secondsPerDay && daysAdvanced < 1000) {
    remaining -= secondsPerDay;
    advanceDay(state); // increments meta.day and emits DAY_CHANGED
    daysAdvanced += 1;
  }
  state.meta.dayProgress = remaining;

  return {
    day: state.meta.day,
    dayIndex: dayIndex(state),
    year: state.meta.year ?? yearForDay(state.meta.day),
    elapsed: state.meta.elapsed,
    daysAdvanced,
  };
}

/**
 * Advance the clock by one in-game day.
 *
 * @param {object} [state]
 * @returns {number} the new day counter
 */
export function advanceDay(state = liveState) {
  const day = (typeof state.meta.day === 'number' && Number.isFinite(state.meta.day) ? state.meta.day : 0) + 1;
  state.meta.day = day;
  state.meta.year = yearForDay(day);
  emit(EVENTS.DAY_CHANGED, { day, year: state.meta.year });
  return day;
}
