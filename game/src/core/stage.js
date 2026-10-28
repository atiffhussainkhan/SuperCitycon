/**
 * core/stage.js — CORE progression.
 *
 * Two progression surfaces live here:
 *
 *  1. **The milestone track** (`STAGES`) — the onboarding / chapter track the
 *     player walks through. It drives the HUD, the tutorial handoff and the
 *     `STAGE_ADVANCED` event.
 *  2. **The resident → level table** (`LEVEL_TABLE`) — the *only* evidenced
 *     progression gate in the shipped game ("your level straight forward
 *     depends on your residence amount … higher levels unlock more
 *     buildings"). It gates the building catalogue.
 *
 * Dossier: docs/requirements/01-core-loop-modes-progression.md
 *  - FR-CORE-031 … FR-CORE-038 (level is a monotone function of residents,
 *    there is no XP, the unlock check consults the level only).
 *  - FR-CORE-046 (no content is gated on a named city stage) — see the note
 *    on `STAGES` below.
 *  - OQ-CORE-01 (level thresholds unpublished), OQ-CORE-02 (level scope).
 *
 * HONESTY: the publisher published no milestone thresholds and no level
 * thresholds. Every number below that is not read from `TUNING` carries a
 * `TBD:` marker, is collected in `TBD_VALUES` (developer tooling,
 * NFR-CORE-004) and is listed as a proposed `TUNING` addition in the CORE
 * final report. Nothing is silently defaulted to zero.
 *
 * Pure logic: this module never imports `three` and is unit-testable in
 * plain Node (`node --test src/core/core.test.mjs`).
 */

import { TUNING } from './config.js';
import { EVENTS, emit } from './events.js';

// ---------------------------------------------------------------------------
// TBD constants — proposed additions to TUNING (see CORE final report)
// ---------------------------------------------------------------------------

/**
 * TBD: no published milestone thresholds (OQ-CORE-01 covers the level curve;
 * the milestone thresholds are the same class of unpublished number).
 * Proposed TUNING addition: `milestoneTargets`.
 */
export const MILESTONE_TARGETS = Object.freeze({
  /** Roads laid for the first milestone. */
  firstRoads: 4,
  /** Residents housed by the first milestone. */
  firstResidents: 8,
  /** Service coverage considered "served" by a milestone (0..1). */
  coverage: 0.5,
  /** Residents of the early-city milestone. */
  earlyCityResidents: 60,
  /** Buildings standing in the early-city milestone. */
  earlyCityBuildings: 12,
  /**
   * TBD: no published treasury milestone. The starting treasury is the only
   * published money figure, so it is reused as a floor — declared here
   * rather than borrowed from `TUNING.startingTreasury`, whose meaning is
   * "the money a new city starts with".
   */
  treasuryTarget: 25000,
  /** Service facilities required by the services milestone. */
  serviceFacilities: 3,
  /** Employed citizens required by the industry milestone. */
  industryJobs: 20,
  /** Commercial / industrial buildings required by the industry milestone. */
  industryBuildings: 4,
  /** Maximum congestion tolerated by the industry milestone (0..1). */
  congestionMax: 0.5,
  /** Residents of the metropolis milestone. */
  metropolisResidents: 500,
  /** Buildings standing in the metropolis milestone. */
  metropolisBuildings: 60,
  /** Mayor score required by the metropolis milestone. */
  metropolisScore: 1000,
});

/**
 * TBD: OQ-CORE-01 — the resident thresholds per level are **not published**.
 * The dossier's own proposed default is a geometric progression of ~1.6×
 * residents per level; that is used here as an explicitly marked design
 * placeholder, retunable without a code change.
 * Proposed TUNING addition: `levelMinResidents`.
 */
export const LEVEL_TABLE = Object.freeze([
  Object.freeze({ level: 1, minResidents: 0 }),
  Object.freeze({ level: 2, minResidents: 12 }),
  Object.freeze({ level: 3, minResidents: 20 }),
  Object.freeze({ level: 4, minResidents: 32 }),
  Object.freeze({ level: 5, minResidents: 51 }),
  Object.freeze({ level: 6, minResidents: 82 }),
  Object.freeze({ level: 7, minResidents: 131 }),
  Object.freeze({ level: 8, minResidents: 210 }),
  Object.freeze({ level: 9, minResidents: 336 }),
  Object.freeze({ level: 10, minResidents: 538 }),
  Object.freeze({ level: 11, minResidents: 861 }),
  Object.freeze({ level: 12, minResidents: 1378 }),
  Object.freeze({ level: 13, minResidents: 2205 }),
  Object.freeze({ level: 14, minResidents: 3528 }),
  Object.freeze({ level: 15, minResidents: 5645 }),
]);

/** Every unresolved number in this module, for developer tooling (NFR-CORE-004). */
export const TBD_VALUES = Object.freeze([
  Object.freeze({
    key: 'milestoneTargets',
    value: MILESTONE_TARGETS,
    reason: 'No milestone thresholds are published; the milestone track is a design placeholder.',
  }),
  Object.freeze({
    key: 'levelMinResidents',
    value: LEVEL_TABLE.map((row) => row.minResidents),
    reason: 'OQ-CORE-01 — resident thresholds per level are not published; geometric progression (~1.6x) is the dossier\'s proposed default.',
  }),
  Object.freeze({
    key: 'levelScope',
    value: 'per-map',
    reason: 'OQ-CORE-02 — per-map vs per-account level scope is unresolved; this build evaluates the active map.',
  }),
]);

// ---------------------------------------------------------------------------
// State readers — defensive, so a goal check never throws on a partial state
// ---------------------------------------------------------------------------

function num(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function buildingInstances(state) {
  const instances = state?.buildings?.instances;
  return instances instanceof Map ? instances : null;
}

/** Number of buildings standing in the city. */
export function buildingCount(state) {
  const instances = buildingInstances(state);
  if (instances) return instances.size;
  return Array.isArray(state?.buildings?.instances) ? state.buildings.instances.length : 0;
}

/**
 * Number of buildings whose catalogue type matches `pattern`.
 *
 * BLD records an instance as `{ id, type, defId, x, z, ... }` and its
 * catalogue ids are namespaced (`res.*`, `com.*`, `ind.*`, `eng.*`, …), so
 * the pattern is matched against both `type` and `defId`.
 */
export function buildingCountByType(state, pattern) {
  const instances = buildingInstances(state);
  if (!instances) return 0;
  const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
  let n = 0;
  for (const inst of instances.values()) {
    if (!inst) continue;
    const type = typeof inst.type === 'string' ? inst.type : '';
    const defId = typeof inst.defId === 'string' ? inst.defId : type;
    if (re.test(type) || re.test(defId)) n += 1;
  }
  return n;
}

/** BLD catalogue id prefix -> category, used when the catalogue is not loaded. */
const PREFIX_CATEGORY = Object.freeze({
  res: 'residential',
  com: 'commercial',
  ind: 'industrial',
  eng: 'energy',
  wat: 'water',
  wst: 'waste',
  hea: 'health',
  edu: 'education',
  pol: 'police',
  fir: 'fire',
  foo: 'food',
  trn: 'transit',
  prk: 'park',
  dec: 'decoration',
  spl: 'special',
});

/**
 * Number of buildings in the given categories.
 *
 * The category comes from BLD's catalogue (`state.buildings.catalogue`) when
 * it is loaded, and from the catalogue id prefix otherwise.
 *
 * @param {object} state
 * @param {string[]} categories e.g. `['commercial', 'industrial']`
 */
export function buildingCountByCategory(state, categories) {
  const instances = buildingInstances(state);
  if (!instances) return 0;
  const wanted = new Set((categories || []).map((c) => String(c).toLowerCase()));
  const catalogue = state?.buildings?.catalogue;

  let n = 0;
  for (const inst of instances.values()) {
    if (!inst) continue;
    const defId = inst.defId || inst.type;
    let category = null;
    if (catalogue instanceof Map && defId) {
      category = catalogue.get(defId)?.category ?? null;
    }
    if (!category && typeof defId === 'string') {
      const prefix = /^([a-z]+)\./.exec(defId);
      if (prefix) category = PREFIX_CATEGORY[prefix[1]] ?? prefix[1];
    }
    if (category && wanted.has(String(category).toLowerCase())) n += 1;
  }
  return n;
}

/** Residents on the active map (POP owns the maths; CORE only reads it). */
export function residentCount(state) {
  return num(state?.population?.total);
}

/** Service coverage for the first matching service id, 0..1. */
export function serviceCoverage(state, ...ids) {
  const coverage = state?.services?.cityCoverage;
  if (!coverage || typeof coverage !== 'object') return 0;
  for (const id of ids) {
    const v = coverage[id];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return 0;
}

/** Number of registered service facilities. */
export function facilityCount(state) {
  const facilities = state?.services?.facilities;
  return Array.isArray(facilities) ? facilities.length : 0;
}

/** Road cells in the mobility network. */
export function roadCellCount(state) {
  const nodes = state?.mobility?.network?.nodes;
  if (nodes instanceof Map) return nodes.size;
  if (nodes && typeof nodes === 'object') return Object.keys(nodes).length;
  return 0;
}

function treasury(state) {
  return num(state?.economy?.treasury);
}

function happiness(state) {
  return num(state?.population?.happiness);
}

function employed(state) {
  return num(state?.population?.employed);
}

function congestion(state) {
  return num(state?.mobility?.congestion);
}

// ---------------------------------------------------------------------------
// The milestone track
// ---------------------------------------------------------------------------
//
// FR-CORE-046: *no content is gated on a named city stage*. The stage names
// below are the build's internal onboarding chapters. They drive the HUD and
// the tutorial handoff only — the building catalogue is gated by the
// resident → level table alone (FR-CORE-035), never by a stage name.
//
// `unlocks` lists **capability ids** the chapter introduces (informational,
// for the HUD). It is deliberately *not* a catalogue gate.

/** @type {ReadonlyArray<Object>} */
const RAW_STAGES = [
  Object.freeze({
    id: 'stage-1',
    name: 'First Foundations',
    description: 'Lay the first street, house the first citizens and keep the lights on.',
    order: 1,
    unlocks: Object.freeze(['build.road', 'build.residential']),
    goals: Object.freeze([
      Object.freeze({
        id: 'first-roads',
        label: 'Lay the first streets',
        target: MILESTONE_TARGETS.firstRoads,
        unit: 'road cells',
        check: (state) => roadCellCount(state),
      }),
      Object.freeze({
        id: 'first-residents',
        label: 'House your first citizens',
        target: MILESTONE_TARGETS.firstResidents,
        unit: 'residents',
        check: (state) => residentCount(state),
      }),
      Object.freeze({
        id: 'first-power',
        label: 'Keep the lights on',
        target: MILESTONE_TARGETS.coverage,
        unit: 'coverage',
        check: (state) => serviceCoverage(state, 'electricity', 'energy', 'power'),
      }),
    ]),
  }),
  Object.freeze({
    id: 'stage-2',
    name: 'Early City',
    description: 'Grow a working town: more homes, more streets and balanced books.',
    order: 2,
    unlocks: Object.freeze(['build.commercial', 'studio']),
    goals: Object.freeze([
      Object.freeze({
        id: 'city-residents',
        label: 'Reach a town of residents',
        target: MILESTONE_TARGETS.earlyCityResidents,
        unit: 'residents',
        check: (state) => residentCount(state),
      }),
      Object.freeze({
        id: 'city-buildings',
        label: 'Stand a skyline of buildings',
        target: MILESTONE_TARGETS.earlyCityBuildings,
        unit: 'buildings',
        check: (state) => buildingCount(state),
      }),
      Object.freeze({
        id: 'city-books',
        label: 'Keep the books balanced',
        target: MILESTONE_TARGETS.treasuryTarget,
        unit: 'coins',
        check: (state) => treasury(state),
      }),
    ]),
  }),
  Object.freeze({
    id: 'stage-3',
    name: 'City Services',
    description: 'Water, waste and healthcare reach every corner of the city.',
    order: 3,
    unlocks: Object.freeze(['service.water', 'service.waste', 'service.health']),
    goals: Object.freeze([
      Object.freeze({
        id: 'service-water',
        label: 'Supply the city with water',
        target: MILESTONE_TARGETS.coverage,
        unit: 'coverage',
        check: (state) => serviceCoverage(state, 'water'),
      }),
      Object.freeze({
        id: 'service-waste',
        label: 'Collect the city\'s waste',
        target: MILESTONE_TARGETS.coverage,
        unit: 'coverage',
        check: (state) => serviceCoverage(state, 'waste'),
      }),
      Object.freeze({
        id: 'service-health',
        label: 'Provide healthcare',
        target: MILESTONE_TARGETS.coverage,
        unit: 'coverage',
        check: (state) => serviceCoverage(state, 'health', 'healthcare', 'medical'),
      }),
      Object.freeze({
        id: 'service-facilities',
        label: 'Run city facilities',
        target: MILESTONE_TARGETS.serviceFacilities,
        unit: 'facilities',
        check: (state) => facilityCount(state),
      }),
    ]),
  }),
  Object.freeze({
    id: 'stage-4',
    name: 'Industry',
    description: 'Employ the citizens, run the works and keep the traffic moving.',
    order: 4,
    unlocks: Object.freeze(['build.industrial', 'transit']),
    goals: Object.freeze([
      Object.freeze({
        id: 'industry-jobs',
        label: 'Put citizens to work',
        target: MILESTONE_TARGETS.industryJobs,
        unit: 'jobs',
        check: (state) => employed(state),
      }),
      Object.freeze({
        id: 'industry-buildings',
        label: 'Run commercial and industrial buildings',
        target: MILESTONE_TARGETS.industryBuildings,
        unit: 'buildings',
        // The category comes from BLD's catalogue when it is loaded.
        check: (state) => buildingCountByCategory(state, ['commercial', 'industrial']),
      }),
      Object.freeze({
        id: 'industry-traffic',
        label: 'Keep the streets flowing',
        target: MILESTONE_TARGETS.congestionMax,
        unit: 'congestion',
        compare: 'lte',
        check: (state) => congestion(state),
      }),
    ]),
  }),
  Object.freeze({
    id: 'stage-5',
    name: 'Metropolis',
    description: 'A city that rivals the region: dense, happy and highly rated.',
    order: 5,
    unlocks: Object.freeze(['build.skyscraper', 'mayor-score']),
    goals: Object.freeze([
      Object.freeze({
        id: 'metro-residents',
        label: 'Grow a metropolis of residents',
        target: MILESTONE_TARGETS.metropolisResidents,
        unit: 'residents',
        check: (state) => residentCount(state),
      }),
      Object.freeze({
        id: 'metro-buildings',
        label: 'Build a dense downtown',
        target: MILESTONE_TARGETS.metropolisBuildings,
        unit: 'buildings',
        check: (state) => buildingCount(state),
      }),
      Object.freeze({
        id: 'metro-happy',
        label: 'Keep citizens above the migration threshold',
        target: TUNING.migrationThreshold,
        unit: 'happiness',
        check: (state) => happiness(state),
      }),
      Object.freeze({
        id: 'metro-score',
        label: 'Earn a high score',
        target: MILESTONE_TARGETS.metropolisScore,
        unit: 'score',
        // The score formula itself is owned by POP; CORE only reads the value.
        check: (state) => num(state?.meta?.score),
      }),
    ]),
  }),
];

/**
 * The milestone track.
 *
 * `desc` is an alias of `description` (CONTRACT §7 names the field `desc`).
 * `cosmeticLabel` marks the whole track as **descriptive framing**: the HUD
 * must present it as such, because FR-CORE-046 / QA-CORE-027 allow the words
 * "city" and "metropolis" only in marketing copy or in a clearly labelled
 * cosmetic label. Nothing is gated on a stage name — the catalogue is gated
 * by the level table alone.
 */
export const STAGES = Object.freeze(RAW_STAGES.map((stage) => Object.freeze({
  ...stage,
  desc: stage.description,
  cosmeticLabel: true,
})));

/** Look a stage up by id. Returns `null` when unknown. */
export function getStage(id) {
  if (!id) return null;
  return STAGES.find((s) => s.id === id) || null;
}

/** The stage the session is currently on (`state.meta.stageIndex`). */
export function currentStage(state) {
  const index = state?.meta?.stageIndex ?? 0;
  const stage = STAGES[index];
  return stage || null;
}

/** True when the mode the session runs in has progression switched on. */
export function progressionEnabled(state) {
  return state?.meta?.progression !== false;
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Progress of a single goal, 0..1. */
export function goalProgress(current, goal) {
  const target = num(goal?.target);
  if (goal?.compare === 'lte') {
    if (current <= target) return 1;
    if (current <= 0) return 0;
    return clamp01(target / current);
  }
  if (target <= 0) return current >= 0 ? 1 : 0;
  return clamp01(current / target);
}

function evaluateGoal(goal, state) {
  let current = 0;
  try {
    current = num(goal.check(state));
  } catch {
    current = 0;
  }
  const met = goal.compare === 'lte' ? current <= goal.target : current >= goal.target;
  return {
    id: goal.id,
    label: goal.label,
    current,
    target: goal.target,
    unit: goal.unit || '',
    met,
    progress: goalProgress(current, goal),
  };
}

function mean(values) {
  if (!values.length) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * Evaluate the current stage's goals.
 * @returns {{stageId: string|null, name: string|null, goals: Array, allMet: boolean, progress: number}}
 */
export function evaluateStage(state) {
  const stage = currentStage(state);
  if (!stage) {
    return { stageId: null, name: null, stageIndex: -1, goals: [], allMet: false, progress: 0, progressionEnabled: progressionEnabled(state) };
  }
  // A progression-free mode has no milestone goals at all (FR-CORE-018).
  if (!progressionEnabled(state)) {
    return {
      stageId: stage.id,
      name: stage.name,
      stageIndex: state?.meta?.stageIndex ?? 0,
      goals: [],
      allMet: true,
      progress: 1,
      progressionEnabled: false,
    };
  }
  const goals = stage.goals.map((g) => evaluateGoal(g, state));
  const allMet = goals.length > 0 && goals.every((g) => g.met);
  return {
    stageId: stage.id,
    name: stage.name,
    stageIndex: state?.meta?.stageIndex ?? 0,
    goals,
    allMet,
    progress: mean(goals.map((g) => g.progress)),
    progressionEnabled: true,
  };
}

/**
 * Advance to the next stage — only when every goal of the current stage is
 * met. Updates `state.meta.stageIndex` / `state.meta.stageId` and emits
 * `EVENTS.STAGE_ADVANCED`.
 *
 * @returns {boolean} true when the session moved on.
 */
export function advanceStage(state) {
  if (!state?.meta) return false;
  if (!progressionEnabled(state)) return false;
  const evaluation = evaluateStage(state);
  if (!evaluation.allMet) return false;

  const currentIndex = state.meta.stageIndex ?? 0;
  const next = STAGES[currentIndex + 1];
  if (!next) return false;

  state.meta.stageIndex = currentIndex + 1;
  state.meta.stageId = next.id;
  emit(EVENTS.STAGE_ADVANCED, {
    from: evaluation.stageId,
    to: next.id,
    stage: next,
    stageIndex: state.meta.stageIndex,
  });
  return true;
}

/** Overall progress of the current stage, 0..1 (mean of the goal progresses). */
export function stageProgress(state) {
  if (!progressionEnabled(state)) return 1;
  const evaluation = evaluateStage(state);
  return clamp01(evaluation.progress);
}

/**
 * Every stage with its live goal evaluation — the HUD view.
 * @returns {Array<{id,name,description,order,unlocks,goals,met,progress,current,reached}>}
 */
export function allStages(state) {
  const currentIndex = state?.meta?.stageIndex ?? 0;
  return STAGES.map((stage, index) => {
    const goals = stage.goals.map((g) => evaluateGoal(g, state));
    const met = goals.length > 0 && goals.every((g) => g.met);
    return {
      id: stage.id,
      name: stage.name,
      description: stage.description,
      desc: stage.desc,
      order: stage.order,
      cosmeticLabel: true,
      // `introduces` is the HUD-facing name: these capabilities are part of
      // the chapter, they are NOT unlocked by it (FR-CORE-046).
      introduces: [...stage.unlocks],
      goals,
      met,
      progress: mean(goals.map((g) => g.progress)),
      current: index === currentIndex,
      reached: index <= currentIndex,
    };
  });
}

// ---------------------------------------------------------------------------
// The progression gate: level = f(residents), and the level-only unlock check
// ---------------------------------------------------------------------------

/**
 * Level for a resident count.
 *
 * ```
 * level = max { L : levelTable[L].minResidents <= residents }
 * ```
 *
 * Monotone by construction: more residents can never lower the level
 * (FR-CORE-032). There is no XP and no second accumulator (FR-CORE-031).
 *
 * @param {number} residents
 * @param {ReadonlyArray<{level:number,minResidents:number}>} [table]
 * @returns {number} the level, 1-based (0 when the table is empty)
 */
export function levelForResidents(residents, table = LEVEL_TABLE) {
  const r = num(residents);
  let level = 0;
  for (const row of table) {
    if (r >= row.minResidents) level = Math.max(level, row.level);
  }
  return level;
}

/** The level of the session's active map. */
export function currentLevel(state, table = LEVEL_TABLE) {
  return levelForResidents(residentCount(state), table);
}

/**
 * The level gate of one catalogue entry.
 *
 * Two shapes are accepted:
 *  - `{ requiredLevel: 5 }` — the plain form,
 *  - `{ unlock: { kind: 'level', level: 5 } }` — the form BLD's catalogue
 *    uses.
 *
 * A non-level gate (a content pack, an event window) is **not** a level
 * gate: its required level is 0 and the other source decides availability
 * (§7.2 — availability is the union of the sources).
 *
 * @param {{requiredLevel?: number, unlock?: {kind?: string, level?: number}}} entry
 * @returns {number}
 */
export function requiredLevelOf(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  if (Number.isFinite(entry.requiredLevel)) return entry.requiredLevel;
  const unlock = entry.unlock;
  if (unlock && unlock.kind === 'level' && Number.isFinite(unlock.level)) return unlock.level;
  return 0;
}

/**
 * The unlock check — the **level is the only gate** (FR-CORE-035).
 * A catalogue entry with `requiredLevel = 0` is available from the start
 * (NFR-CORE-011).
 *
 * @param {{requiredLevel?: number, unlock?: object}} entry
 * @param {number} level
 */
export function isUnlocked(entry, level) {
  return requiredLevelOf(entry) <= num(level, 1);
}

/**
 * Unlock evaluation for one catalogue entry against the live session.
 *
 * In a mode with `flags.progression = false` nothing is level-locked at all
 * (NFR-CORE-003): every entry reports as unlocked.
 *
 * @returns {{unlocked: boolean, requiredLevel: number, level: number, gated: boolean}}
 */
export function unlockState(entry, state, table = LEVEL_TABLE) {
  const level = currentLevel(state, table);
  const requiredLevel = requiredLevelOf(entry);
  if (!progressionEnabled(state)) {
    return { unlocked: true, requiredLevel, level, gated: false };
  }
  return { unlocked: requiredLevel <= level, requiredLevel, level, gated: true };
}
