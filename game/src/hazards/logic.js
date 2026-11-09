/**
 * hazards/logic.js — HAZARD (pure rule module).
 *
 * OWNER: HAZARD. This module MUST NOT import `three` so it can be unit-tested
 * in plain Node (see hazards.test.mjs).
 *
 * WHAT THIS IS:
 *   The CITY-BUILDER idiom of the directive's "enemy intelligence / boss
 *   encounter". A hazard is a MULTI-PHASE CITY THREAT: it announces itself
 *   (the TELEGRAPH window), it then damages the city, it escalates through an
 *   ordered ladder of phases, and it either burns out or is contained.
 *
 *   The whole rule set is here, as pure functions:
 *
 *     createHazardState(def)          -> the JSON-safe record of a hazard
 *     phaseOf(state, def)             -> the phase the hazard is in
 *     isVulnerable(state, def)        -> can the city fight this phase?
 *     advanceHazard(state, dt, ctx)   -> { hazardState, events }  (the machine)
 *     resolveEarly(state, reason)     -> the "contained" path
 *     mitigationLevel(def, ctx)       -> 0..1 from the city's service coverage
 *     effectiveDps(...)               -> the damage rate of the current phase
 *     damageAt(...)                   -> the damage rate at one cell
 *     damageForDps(...)               -> the damage report for one slice
 *
 * HONESTY:
 *   The publisher published NO hazard cadence, NO damage rate, NO mitigation
 *   weight, NO repair cost and NO panic model. Every such number therefore
 *   lives in the ONE `HAZARD_TBD` table below and is marked `TBD:` with the
 *   `TUNING` key proposed for it in the final report. Nothing is inlined deep
 *   in the rules.
 *
 * DEFENSIVENESS:
 *   A missing domain, a malformed level definition, a NaN delta and a
 *   half-written save must never throw. Every function returns a sane value
 *   (usually zeros) instead of blowing up the frame loop.
 */

import { GRID, TUNING } from '../core/config.js';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** The four states a hazard can be in. */
export const HAZARD_STATUS = Object.freeze({
  IDLE: 'idle',
  TELEGRAPH: 'telegraph',
  ACTIVE: 'active',
  RESOLVED: 'resolved',
});

/** The ways a hazard can end. */
export const HAZARD_OUTCOME = Object.freeze({
  /** The ladder ran out — the city weathered the threat. */
  SURVIVED: 'survived',
  /** The city mitigated the threat and it was contained early. */
  CONTAINED: 'contained',
  /** The threat got the better of the city (a crisis panic-out). */
  FAILED: 'failed',
});

/** The kinds of damage a hazard deals. */
export const HAZARD_DAMAGE_KIND = Object.freeze({
  BUILDING: 'building',
  MORALE: 'morale',
  TREASURY: 'treasury',
  AGGREGATE: 'aggregate',
});

// ---------------------------------------------------------------------------
// TBD table — every unpublished number lives here and NOWHERE else
// ---------------------------------------------------------------------------

/**
 * TBD: every hazard number the publisher never published.
 *
 * Each entry names the `TUNING` key proposed for it (the integrator owns
 * `src/core/config.js`, so the values live here until they are moved there).
 *
 * V5: the integrator has promoted all of these into `TUNING`
 * (`src/core/config.js`) and marked every one of them in `TUNING_TBD`. This
 * table is now a **read-through alias** onto `TUNING`, so there is exactly one
 * place the numbers live and a future retune reaches both the game and the
 * tests at once. The `TBD:` markers are kept because the values remain
 * unpublished design decisions.
 */
export const HAZARD_TBD = Object.freeze({
  /**
   * TBD: the lull between two phases of an ORDINARY hazard, in seconds.
   * A crisis has no lull — its phases run back to back.
   * TUNING key: `hazardPhaseGapSeconds`.
   */
  phaseGapSeconds: TUNING.hazardPhaseGapSeconds,

  /**
   * TBD: how much of the damage a fully mitigated hazard cancels, 0..1.
   * TUNING key: `hazardMitigationDamageReduction`.
   */
  mitigationDamageReduction: TUNING.hazardMitigationDamageReduction,

  /**
   * TBD: how much of a phase's duration a fully mitigated hazard removes, 0..1.
   * The higher the mitigation, the faster the phase resolves.
   * TUNING key: `hazardMitigationResolveScale`.
   */
  mitigationResolveScale: TUNING.hazardMitigationResolveScale,

  /**
   * TBD: the mitigation level at which a vulnerable hazard can be contained.
   * TUNING key: `hazardEarlyResolveMitigation`.
   */
  earlyResolveMitigation: TUNING.hazardEarlyResolveMitigation,

  /**
   * TBD: how long a phase must have been active before containment can fire,
   * in seconds. The player must get a chance to see the phase begin.
   * TUNING key: `hazardEarlyResolveHoldSeconds`.
   */
  earlyResolveHoldSeconds: TUNING.hazardEarlyResolveHoldSeconds,

  /**
   * TBD: the extra damage every later phase carries, per phase index.
   * The ladder in the level content is authoritative, but this makes the
   * escalation felt even when a ladder tapers off (a "burnout" phase).
   * TUNING key: `hazardEscalationStep`.
   */
  escalationStep: TUNING.hazardEscalationStep,

  /**
   * TBD: how fast the city-wide panic builds during a crisis, per second of
   * game time. It only builds while a phase is LIVE.
   * TUNING key: `hazardCrisisPanicPerSecond`.
   */
  crisisPanicPerSecond: TUNING.hazardCrisisPanicPerSecond,

  /**
   * TBD: the panic added every time a crisis changes phase.
   * TUNING key: `hazardCrisisPanicPerPhase`.
   */
  crisisPanicPerPhase: TUNING.hazardCrisisPanicPerPhase,

  /**
   * TBD: how much of the panic build the city's mitigation cancels, 0..1.
   * TUNING key: `hazardCrisisPanicRelief`.
   */
  crisisPanicRelief: TUNING.hazardCrisisPanicRelief,

  /**
   * TBD: how much of the panic build a held checkpoint cancels, 0..1.
   * TUNING key: `hazardCrisisCheckpointRelief`.
   */
  crisisCheckpointRelief: TUNING.hazardCrisisCheckpointRelief,

  /**
   * TBD: the panic level at which the crisis is lost.
   * TUNING key: `hazardCrisisFailurePanic`.
   */
  crisisFailurePanic: TUNING.hazardCrisisFailurePanic,

  /**
   * TBD: the happiness points lost per damage point per second of exposure.
   * TUNING key: `hazardMoraleLossPerDps`.
   */
  moraleLossPerDps: TUNING.hazardMoraleLossPerDps,

  /**
   * TBD: the loyalty points lost per damage point per second of exposure.
   * TUNING key: `hazardLoyaltyLossPerDps`.
   */
  loyaltyLossPerDps: TUNING.hazardLoyaltyLossPerDps,

  /**
   * TBD: the treasury coins spent on repairs per damage point per second.
   * TUNING key: `hazardRepairCostPerDps`.
   */
  repairCostPerDps: TUNING.hazardRepairCostPerDps,

  /**
   * TBD: the damage a building takes before it is destroyed.
   * TUNING key: `hazardBuildingHealth`.
   */
  buildingHealth: TUNING.hazardBuildingHealth,

  /**
   * TBD: how much of the city's service coverage a hazard mitigation is
   * allowed to draw on when the hazard's own area is barely covered, 0..1.
   * TUNING key: `hazardCityCoverageWeight`.
   */
  cityCoverageWeight: TUNING.hazardCityCoverageWeight,

  /**
   * TBD: the number of cells sampled around a hazard when its mitigation is
   * measured. TUNING key: `hazardMitigationSamples`.
   */
  mitigationSamples: TUNING.hazardMitigationSamples,

  /**
   * TBD: the minimum number of game-time seconds between two aggregate
   * HAZARD_DAMAGE events for one hazard. The contract asks for events on
   * meaningful changes only, not one per frame.
   * TUNING key: `hazardDamageEventInterval`.
   */
  damageEventInterval: TUNING.hazardDamageEventInterval,

  /**
   * TBD: the seconds between two VFX pulses of a running hazard.
   * TUNING key: `hazardFxInterval`.
   */
  fxInterval: TUNING.hazardFxInterval,
});

// ---------------------------------------------------------------------------
// Hazard type -> the city services that fight it
// ---------------------------------------------------------------------------

/**
 * The services that mitigate each hazard type.
 *
 * The ids are the REAL `src/services/services.js` catalogue ids
 * (`SERVICE_IDS`: police, fire, health, education, parks, waste, energy,
 * water, food, transit). Nothing here is invented.
 *
 *   wildfire -> fire protection (the fire brigade reaches the cells)
 *   flood    -> nothing: the catalogue has no drainage service, so a flood
 *              can only be mitigated by a level that declares
 *              `mitigationServices` explicitly
 *   outage   -> energy supply (grid redundancy)
 *   blight   -> food supply (the crops and the greenhouses)
 *   earthquake -> police + health (the rescue and the triage)
 *   heatwave -> water + health (drinking water and the clinics)
 */
export const HAZARD_SERVICE_MAP = Object.freeze({
  flood: Object.freeze([]),
  wildfire: Object.freeze(['fire']),
  outage: Object.freeze(['energy']),
  blight: Object.freeze(['food']),
  earthquake: Object.freeze(['police', 'health']),
  heatwave: Object.freeze(['water', 'health']),
});

/**
 * TBD: the hazards that are CRISIS encounters even though the shipped level
 * content does not carry a `crisis: true` flag yet.
 *
 * `content/levels.js` owns the level definitions and has not been given the
 * flag, so the shipped crisis map's hazard is listed here instead. When the
 * content is updated, this table can be emptied.
 * Proposed TUNING key: none — this is content, not a tuning value.
 */
export const CRISIS_HAZARD_IDS = Object.freeze(new Set(['hz-fire']));

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function num(value, fallback = 0) {
  const v = Number(value);
  return Number.isFinite(v) ? v : fallback;
}

function clamp01(value) {
  const v = num(value, 0);
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function positive(value, fallback = 0) {
  const v = num(value, fallback);
  return v > 0 ? v : fallback;
}

/**
 * Is this definition a usable hazard?
 * @param {any} def
 * @returns {boolean}
 */
export function isHazardDef(def) {
  return !!def && typeof def === 'object' && Array.isArray(def.phases) && def.phases.length > 0;
}

/**
 * Is this hazard a crisis (a boss encounter)?
 *
 * A definition may declare `crisis: true`. The shipped crisis map's hazard
 * is recognised through `CRISIS_HAZARD_IDS` until the content carries the
 * flag.
 *
 * @param {object} def
 * @returns {boolean}
 */
export function isCrisisDef(def) {
  if (!def || typeof def !== 'object') return false;
  if (def.crisis === true) return true;
  const id = typeof def.id === 'string' ? def.id : '';
  return CRISIS_HAZARD_IDS.has(id);
}

/**
 * The services that mitigate this hazard.
 * @param {object} def
 * @returns {string[]}
 */
export function mitigationServicesFor(def) {
  if (!def || typeof def !== 'object') return [];
  if (Array.isArray(def.mitigationServices)) {
    return def.mitigationServices.filter((s) => typeof s === 'string' && s.length > 0);
  }
  const mapped = HAZARD_SERVICE_MAP[def.type];
  return Array.isArray(mapped) ? mapped.slice() : [];
}

/**
 * The distance between two cells, in cells.
 * @param {number} ax
 * @param {number} az
 * @param {number} bx
 * @param {number} bz
 * @returns {number}
 */
export function cellDistance(ax, az, bx, bz) {
  const dx = num(ax) - num(bx);
  const dz = num(az) - num(bz);
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * The exposure falloff of a hazard at a cell.
 *
 * 1 at the centre, 0 at the rim and beyond. LINEAR, like the service
 * coverage falloff in `services/coverage.js` — the publisher published no
 * hazard falloff shape.
 *
 * @param {number} distance distance in CELLS
 * @param {number} radius  the hazard radius in CELLS
 * @returns {number} 0..1
 */
export function falloff(distance, radius) {
  const r = num(radius, 0);
  if (r <= 0) return 0;
  const d = num(distance, 0);
  if (d >= r) return 0;
  if (d <= 0) return 1;
  return 1 - d / r;
}

// ---------------------------------------------------------------------------
// The hazard record
// ---------------------------------------------------------------------------

/**
 * Create the JSON-safe record of a hazard.
 *
 * The record is plain data only (no Map, no Set, no class instance), so
 * `core/save.js` snapshots and restores it without any help from this
 * module.
 *
 * @param {object} def the level's hazard definition
 * @param {object} [options]
 * @param {boolean} [options.crisis] override the crisis flag
 * @returns {object|null} null when the definition is unusable
 */
export function createHazardState(def, options = {}) {
  if (!isHazardDef(def)) return null;
  const id = typeof def.id === 'string' && def.id.length ? def.id : `hazard-${def.type ?? 'unknown'}`;
  return {
    id,
    /** The hazard kind: flood | wildfire | outage | blight | earthquake | heatwave. */
    type: typeof def.type === 'string' ? def.type : 'unknown',
    label: typeof def.label === 'string' ? def.label : id,
    /** The centre, in CELLS. */
    x: num(def.x, 0),
    z: num(def.z, 0),
    /** The affected radius, in CELLS. */
    radius: Math.max(0, num(def.radius, 0)),
    /** Is this the crisis (boss) encounter? */
    crisis: options.crisis === undefined ? isCrisisDef(def) : !!options.crisis,
    /** Which phase of the ladder the hazard is in. */
    phaseIndex: 0,
    /** Seconds spent in the current phase. */
    phaseElapsed: 0,
    /** Seconds spent ACTIVE in the current phase (the telegraph does not count). */
    phaseActiveElapsed: 0,
    /** idle | telegraph | active | resolved */
    status: HAZARD_STATUS.IDLE,
    /** The total damage points the hazard has dealt. */
    damageDealt: 0,
    /** Seconds since the hazard started. */
    elapsed: 0,
    /** The city-wide panic, 0..1 (a crisis only). */
    panic: 0,
    /** The mitigation level the last time it was measured, 0..1. */
    mitigation: 0,
    /** The severity of the current phase, 0..1. */
    severity: clamp01(1 / def.phases.length),
    /** survived | contained | failed — null while the hazard runs. */
    outcome: null,
    /** Why the hazard ended. */
    reason: null,
  };
}

/**
 * The phase the hazard is currently in.
 * @param {object} hazardState
 * @param {object} def
 * @returns {object|null}
 */
export function phaseOf(hazardState, def) {
  if (!hazardState || !isHazardDef(def)) return null;
  const index = Math.max(0, Math.floor(num(hazardState.phaseIndex, 0)));
  const phase = def.phases[index];
  return phase && typeof phase === 'object' ? phase : null;
}

/**
 * Can the city meaningfully fight this phase?
 *
 * A phase may declare `vulnerable: false` — a phase the city cannot fight
 * (a burnout, a storm surge). Mitigation then buys the city nothing.
 * The default is TRUE.
 *
 * @param {object} hazardState
 * @param {object} def
 * @returns {boolean}
 */
export function isVulnerable(hazardState, def) {
  const phase = phaseOf(hazardState, def);
  if (!phase) return false;
  return phase.vulnerable !== false;
}

/**
 * The severity of the current phase, 0..1.
 *
 * The severity climbs with every phase of the ladder — that is the
 * escalation the player feels.
 *
 * @param {object} hazardState
 * @param {object} def
 * @returns {number}
 */
export function severityOf(hazardState, def) {
  if (!hazardState || !isHazardDef(def)) return 0;
  const count = def.phases.length;
  const index = Math.max(0, Math.min(count - 1, Math.floor(num(hazardState.phaseIndex, 0))));
  return clamp01((index + 1) / count);
}

/**
 * The telegraph window of a phase, in seconds.
 *
 * An ordinary hazard pauses for `HAZARD_TBD.phaseGapSeconds` between two
 * phases — the lull is added to the warning. A crisis has no lull: its
 * phases run back to back.
 *
 * @param {object} phase
 * @param {number} index the phase index
 * @param {boolean} crisis
 * @returns {number}
 */
export function telegraphWindow(phase, index, crisis) {
  const base = Math.max(0, num(phase?.telegraphSeconds, 0));
  if (crisis) return base;
  const gap = index > 0 ? HAZARD_TBD.phaseGapSeconds : 0;
  return base + gap;
}

/**
 * The duration of a phase once the city's mitigation is taken into account.
 *
 * A fully mitigated phase resolves `HAZARD_TBD.mitigationResolveScale`
 * faster.
 *
 * @param {object} phase
 * @param {number} mitigation 0..1
 * @param {boolean} vulnerable
 * @returns {number} seconds
 */
export function effectiveDuration(phase, mitigation, vulnerable) {
  const base = Math.max(0, num(phase?.duration, 0));
  if (!vulnerable) return base;
  const speed = clamp01(mitigation) * HAZARD_TBD.mitigationResolveScale;
  return base * (1 - clamp01(speed));
}

/**
 * The damage rate of a phase, at the centre of the hazard.
 *
 * The escalation factor grows with every phase of the ladder — that is the
 * escalation the player feels, even when the ladder tapers off (a "burnout"
 * phase). The mitigation relief is only granted for a phase the city can
 * actually fight (`vulnerable !== false`).
 *
 * @param {object} phase
 * @param {number} index the phase index
 * @param {number} mitigation 0..1
 * @param {boolean} vulnerable
 * @returns {number} damage points per second
 */
export function effectiveDps(phase, index, mitigation, vulnerable) {
  const base = Math.max(0, num(phase?.damagePerSecond, 0));
  const escalation = 1 + HAZARD_TBD.escalationStep * Math.max(0, num(index, 0));
  const relief = vulnerable ? clamp01(mitigation) * HAZARD_TBD.mitigationDamageReduction : 0;
  return base * escalation * (1 - clamp01(relief));
}

/**
 * The damage rate at one cell, in damage points per second.
 *
 * @param {object} hazardState
 * @param {object} def
 * @param {{x:number,z:number}} cell the cell, in CELLS
 * @param {number} mitigation 0..1
 * @returns {number}
 */
export function damageAt(hazardState, def, cell, mitigation = 0) {
  if (!hazardState || !isHazardDef(def)) return 0;
  if (hazardState.status === HAZARD_STATUS.RESOLVED) return 0;
  if (hazardState.status !== HAZARD_STATUS.ACTIVE) return 0;
  const phase = phaseOf(hazardState, def);
  if (!phase) return 0;
  const index = Math.max(0, Math.floor(num(hazardState.phaseIndex, 0)));
  const dps = effectiveDps(phase, index, mitigation, isVulnerable(hazardState, def));
  const distance = cellDistance(cell?.x, cell?.z, hazardState.x, hazardState.z);
  return dps * falloff(distance, hazardState.radius);
}

// ---------------------------------------------------------------------------
// Mitigation
// ---------------------------------------------------------------------------

/**
 * The cells sampled around a hazard when its mitigation is measured.
 * @param {object} hazardState
 * @returns {Array<{x:number,z:number}>}
 */
export function mitigationSamples(hazardState) {
  const out = [];
  if (!hazardState) return out;
  const cx = num(hazardState.x, 0);
  const cz = num(hazardState.z, 0);
  const radius = Math.max(1, num(hazardState.radius, 1));
  const count = Math.max(1, Math.round(HAZARD_TBD.mitigationSamples));
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(angle) * radius * 0.6);
    const z = Math.round(cz + Math.sin(angle) * radius * 0.6);
    out.push({ x, z });
  }
  return out;
}

/**
 * How well the city can fight this hazard, 0..1.
 *
 * The mitigation is the average, over the services that fight this hazard,
 * of the service coverage inside the hazard's own area. The city-wide
 * coverage of the service contributes at `HAZARD_TBD.cityCoverageWeight`,
 * so a city with good coverage elsewhere is not helpless here.
 *
 * A missing services domain, a missing coverage function and a NaN coverage
 * all yield 0 — the hazard simply goes unmitigated.
 *
 * @param {object} def
 * @param {object} ctxLike `{ services: { coverageFor(id,cx,cz), cityCoverage(id) } }`
 * @returns {number} 0..1
 */
export function mitigationLevel(def, ctxLike = {}) {
  const services = ctxLike?.services ?? null;
  const ids = mitigationServicesFor(def);
  if (!services || ids.length === 0) return 0;

  const coverageFor = typeof services.coverageFor === 'function'
    ? services.coverageFor.bind(services)
    : null;
  const cityCoverage = typeof services.cityCoverage === 'function'
    ? services.cityCoverage.bind(services)
    : null;
  if (!coverageFor && !cityCoverage) return 0;

  const state = createHazardState(def);
  const samples = mitigationSamples(state);
  const weight = clamp01(HAZARD_TBD.cityCoverageWeight);

  let total = 0;
  for (const id of ids) {
    let local = 0;
    if (coverageFor) {
      let sum = 0;
      for (const cell of samples) {
        let w = 0;
        try {
          w = num(coverageFor(id, cell.x, cell.z), 0);
        } catch {
          w = 0;
        }
        sum += clamp01(w);
      }
      local = samples.length ? sum / samples.length : 0;
    }
    let city = 0;
    if (cityCoverage) {
      try {
        city = clamp01(cityCoverage(id));
      } catch {
        city = 0;
      }
    }
    const score = Math.max(local, city * weight);
    total += clamp01(score);
  }
  return clamp01(total / ids.length);
}

// ---------------------------------------------------------------------------
// The damage report
// ---------------------------------------------------------------------------

/**
 * The damage one slice of exposure does.
 *
 * The report is PURE: it reads the buildings it is given and returns the
 * numbers. The service layer applies them to the world.
 *
 * @param {number} dps the damage rate at the centre, in points per second
 * @param {object} hazardState
 * @param {object} def
 * @param {object} ctxLike `{ buildings: [{id,x,z}] }`
 * @param {number} seconds the length of the slice
 * @returns {{
 *   dps:number, seconds:number, points:number,
 *   buildings: Array<{id:any,x:number,z:number,amount:number,falloff:number}>,
 *   happinessLoss:number, loyaltyLoss:number, repairCost:number
 * }}
 */
export function damageForDps(dps, hazardState, def, ctxLike = {}, seconds = 0) {
  const empty = {
    dps: 0, seconds: 0, points: 0, buildings: [],
    happinessLoss: 0, loyaltyLoss: 0, repairCost: 0,
  };
  if (!hazardState || !isHazardDef(def)) return empty;
  const span = Math.max(0, num(seconds, 0));
  const rate = Math.max(0, num(dps, 0));
  if (span <= 0 || rate <= 0) return empty;

  const points = rate * span;
  const radius = Math.max(0, num(hazardState.radius, 0));
  const list = Array.isArray(ctxLike?.buildings) ? ctxLike.buildings : [];

  const buildings = [];
  for (const b of list) {
    if (!b || typeof b !== 'object') continue;
    const x = num(b.x, NaN);
    const z = num(b.z, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const f = falloff(cellDistance(x, z, hazardState.x, hazardState.z), radius);
    if (f <= 0) continue;
    buildings.push({ id: b.id, x, z, amount: points * f, falloff: f });
  }

  return {
    dps: rate,
    seconds: span,
    points,
    buildings,
    happinessLoss: points * HAZARD_TBD.moraleLossPerDps,
    loyaltyLoss: points * HAZARD_TBD.loyaltyLossPerDps,
    repairCost: points * HAZARD_TBD.repairCostPerDps,
  };
}

/**
 * The damage report for the CURRENT phase over `seconds`.
 *
 * @param {object} hazardState
 * @param {object} def
 * @param {object} ctxLike `{ buildings, services }`
 * @param {number} seconds
 * @returns {object} the report
 */
export function computeDamageReport(hazardState, def, ctxLike = {}, seconds = 0) {
  if (!hazardState || !isHazardDef(def)) {
    return {
      dps: 0, seconds: 0, points: 0, buildings: [],
      happinessLoss: 0, loyaltyLoss: 0, repairCost: 0,
    };
  }
  if (hazardState.status !== HAZARD_STATUS.ACTIVE) {
    return {
      dps: 0, seconds: 0, points: 0, buildings: [],
      happinessLoss: 0, loyaltyLoss: 0, repairCost: 0,
    };
  }
  const phase = phaseOf(hazardState, def);
  if (!phase) {
    return {
      dps: 0, seconds: 0, points: 0, buildings: [],
      happinessLoss: 0, loyaltyLoss: 0, repairCost: 0,
    };
  }
  const index = Math.max(0, Math.floor(num(hazardState.phaseIndex, 0)));
  const mitigation = ctxLike?.mitigation ?? hazardState.mitigation ?? 0;
  const dps = effectiveDps(phase, index, mitigation, isVulnerable(hazardState, def));
  return damageForDps(dps, hazardState, def, ctxLike, seconds);
}

// ---------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------

/**
 * Advance a hazard by `dt` seconds of GAME time.
 *
 * PURE: it never touches the world. It returns the next hazard state and the
 * list of things that happened, which the service layer turns into events.
 *
 * The event objects are:
 *   { type:'started',  id, hazardType, label, x, z, radius, crisis }
 *   { type:'phase',    id, phaseIndex, phaseId, name, telegraphing }
 *   { type:'damage',   id, dps, seconds, points }
 *   { type:'resolved', id, outcome, reason }
 *
 * @param {object} hazardState
 * @param {number} dt seconds of game time
 * @param {object} ctxLike
 * @param {object} ctxLike.def the hazard definition
 * @param {number} [ctxLike.mitigation] 0..1
 * @param {number|string[]} [ctxLike.heldCheckpoints] how many checkpoints the
 *        city holds (a list is accepted too)
 * @returns {{hazardState:object|null, events:Array<object>}}
 */
export function advanceHazard(hazardState, dt, ctxLike = {}) {
  const events = [];
  if (!hazardState || typeof hazardState !== 'object') {
    return { hazardState: hazardState ?? null, events };
  }
  const def = ctxLike?.def;
  if (!isHazardDef(def)) return { hazardState, events };
  if (hazardState.status === HAZARD_STATUS.RESOLVED) return { hazardState, events };

  let step = num(dt, 0);
  if (step < 0) step = 0;

  const s = { ...hazardState };
  const crisis = !!s.crisis;
  const mitigation = clamp01(ctxLike.mitigation ?? s.mitigation ?? 0);
  // The held checkpoints may be a COUNT or a list — both are accepted.
  const heldRaw = ctxLike.heldCheckpoints;
  const held = Array.isArray(heldRaw)
    ? heldRaw.length
    : Math.max(0, num(heldRaw, 0));
  s.mitigation = mitigation;
  s.elapsed = Math.max(0, num(s.elapsed, 0)) + step;

  // -- start ---------------------------------------------------------------
  if (s.status === HAZARD_STATUS.IDLE) {
    s.status = HAZARD_STATUS.TELEGRAPH;
    s.phaseIndex = 0;
    s.phaseElapsed = 0;
    s.phaseActiveElapsed = 0;
    events.push({
      type: 'started',
      id: s.id,
      hazardType: s.type,
      label: s.label,
      x: s.x,
      z: s.z,
      radius: s.radius,
      crisis,
    });
    const first = def.phases[0];
    events.push({
      type: 'phase',
      id: s.id,
      phaseIndex: 0,
      phaseId: typeof first?.id === 'string' ? first.id : '',
      name: typeof first?.name === 'string' ? first.name : '',
      telegraphing: true,
    });
  }

  let remaining = step;

  while (remaining > 0) {
    const index = Math.max(0, Math.floor(num(s.phaseIndex, 0)));
    const phase = def.phases[index];
    if (!phase) break;

    if (s.status === HAZARD_STATUS.TELEGRAPH) {
      const window = telegraphWindow(phase, index, crisis);
      const need = Math.max(0, window - num(s.phaseElapsed, 0));
      if (remaining < need) {
        s.phaseElapsed += remaining;
        remaining = 0;
        break;
      }
      remaining -= need;
      s.phaseElapsed = 0;
      s.phaseActiveElapsed = 0;
      s.status = HAZARD_STATUS.ACTIVE;
      events.push({
        type: 'phase',
        id: s.id,
        phaseIndex: index,
        phaseId: typeof phase.id === 'string' ? phase.id : '',
        name: typeof phase.name === 'string' ? phase.name : '',
        telegraphing: false,
      });
      continue;
    }

    // -- active ------------------------------------------------------------
    const vulnerable = phase.vulnerable !== false;
    const duration = effectiveDuration(phase, mitigation, vulnerable);
    const dps = effectiveDps(phase, index, mitigation, vulnerable);
    const need = Math.max(0, duration - num(s.phaseElapsed, 0));
    const use = Math.min(remaining, need);

    if (use > 0) {
      const points = dps * use;
      s.damageDealt = Math.max(0, num(s.damageDealt, 0)) + points;
      s.phaseElapsed = num(s.phaseElapsed, 0) + use;
      s.phaseActiveElapsed = num(s.phaseActiveElapsed, 0) + use;
      remaining -= use;
      events.push({ type: 'damage', id: s.id, dps, seconds: use, points });
      s.severity = severityOf(s, def);

      // The city-wide panic of a crisis.
      if (crisis) {
        const relief = clamp01(mitigation) * HAZARD_TBD.crisisPanicRelief;
        const checkpointRelief = held > 0 ? HAZARD_TBD.crisisCheckpointRelief : 0;
        const rate = HAZARD_TBD.crisisPanicPerSecond
          * (1 - clamp01(relief))
          * (1 - clamp01(checkpointRelief));
        s.panic = clamp01(num(s.panic, 0) + rate * use);
        if (s.panic >= HAZARD_TBD.crisisFailurePanic) {
          s.status = HAZARD_STATUS.RESOLVED;
          s.outcome = HAZARD_OUTCOME.FAILED;
          s.reason = 'the city panicked';
          events.push({
            type: 'resolved',
            id: s.id,
            outcome: HAZARD_OUTCOME.FAILED,
            reason: s.reason,
          });
          return { hazardState: s, events };
        }
      }

      // Containment: the city mitigated the phase away. This fires INSIDE
      // the phase, so a well-mitigated hazard never burns through its whole
      // ladder.
      if (
        vulnerable
        && mitigation >= HAZARD_TBD.earlyResolveMitigation
        && s.phaseActiveElapsed >= HAZARD_TBD.earlyResolveHoldSeconds
      ) {
        s.status = HAZARD_STATUS.RESOLVED;
        s.outcome = HAZARD_OUTCOME.CONTAINED;
        s.reason = 'the city contained the hazard';
        events.push({
          type: 'resolved',
          id: s.id,
          outcome: HAZARD_OUTCOME.CONTAINED,
          reason: s.reason,
        });
        return { hazardState: s, events };
      }
    }

    // The phase did not end inside this slice.
    if (use < need) break;

    // -- the phase ended ---------------------------------------------------
    if (index >= def.phases.length - 1) {
      s.status = HAZARD_STATUS.RESOLVED;
      s.outcome = HAZARD_OUTCOME.SURVIVED;
      s.reason = 'the hazard burned out';
      events.push({
        type: 'resolved',
        id: s.id,
        outcome: HAZARD_OUTCOME.SURVIVED,
        reason: s.reason,
      });
      return { hazardState: s, events };
    }

    // -- the next phase ----------------------------------------------------
    s.phaseIndex = index + 1;
    s.phaseElapsed = 0;
    s.phaseActiveElapsed = 0;
    s.status = HAZARD_STATUS.TELEGRAPH;
    s.severity = severityOf(s, def);
    if (crisis) {
      s.panic = clamp01(num(s.panic, 0) + HAZARD_TBD.crisisPanicPerPhase);
      if (s.panic >= HAZARD_TBD.crisisFailurePanic) {
        s.status = HAZARD_STATUS.RESOLVED;
        s.outcome = HAZARD_OUTCOME.FAILED;
        s.reason = 'the city panicked';
        events.push({
          type: 'resolved',
          id: s.id,
          outcome: HAZARD_OUTCOME.FAILED,
          reason: s.reason,
        });
        return { hazardState: s, events };
      }
    }
    const next = def.phases[s.phaseIndex];
    events.push({
      type: 'phase',
      id: s.id,
      phaseIndex: s.phaseIndex,
      phaseId: typeof next?.id === 'string' ? next.id : '',
      name: typeof next?.name === 'string' ? next.name : '',
      telegraphing: true,
    });
  }

  return { hazardState: s, events };
}

/**
 * Resolve a hazard early — the explicit "contained" path.
 *
 * @param {object} hazardState
 * @param {string} [reason]
 * @returns {object} the next hazard state
 */
export function resolveEarly(hazardState, reason = 'the city contained the hazard') {
  if (!hazardState || typeof hazardState !== 'object') return hazardState;
  if (hazardState.status === HAZARD_STATUS.RESOLVED) return hazardState;
  const failed = String(reason).toLowerCase().includes('fail');
  return {
    ...hazardState,
    status: HAZARD_STATUS.RESOLVED,
    outcome: failed ? HAZARD_OUTCOME.FAILED : HAZARD_OUTCOME.CONTAINED,
    reason: typeof reason === 'string' && reason.length ? reason : 'the city contained the hazard',
  };
}

/**
 * The default, empty hazard state subtree.
 * @returns {object}
 */
export function emptyHazardTree() {
  return {
    version: 1,
    /** The level's hazard definitions (plain JSON). */
    defs: [],
    /** The running hazards. */
    hazards: [],
    /** The resolved hazards: `{id, outcome, reason, at}`. */
    records: [],
    /** The accumulated damage per building: `{id: {amount, destroyed}}`. */
    buildingDamage: {},
    /** The checkpoint ids the city holds. */
    checkpoints: [],
    /** The cumulative morale loss the hazard dealt. */
    morale: { happiness: 0, loyalty: 0 },
    /**
     * The cumulative repair cost the hazard caused.
     * `coins` is what was paid, `unpaid` is what the city could not cover,
     * and `owed` is the fraction of a coin carried over to the next step.
     */
    repairs: { coins: 0, unpaid: 0, owed: 0 },
    /** The city-wide panic, 0..1. */
    panic: 0,
    /** The seconds of hazard time simulated. */
    elapsed: 0,
  };
}

/**
 * Repair a hazard subtree that came back from a save (or from a hand-edited
 * file). The result always has every key.
 *
 * @param {any} tree
 * @returns {object}
 */
export function normaliseHazardTree(tree) {
  const base = emptyHazardTree();
  if (!tree || typeof tree !== 'object' || Array.isArray(tree)) return base;
  if (Array.isArray(tree.defs)) base.defs = tree.defs.filter((d) => isHazardDef(d));
  if (Array.isArray(tree.hazards)) {
    base.hazards = tree.hazards.filter((h) => h && typeof h === 'object');
  }
  if (Array.isArray(tree.records)) {
    base.records = tree.records.filter((r) => r && typeof r === 'object');
  }
  if (tree.buildingDamage && typeof tree.buildingDamage === 'object' && !Array.isArray(tree.buildingDamage)) {
    base.buildingDamage = { ...tree.buildingDamage };
  }
  if (Array.isArray(tree.checkpoints)) {
    base.checkpoints = tree.checkpoints.filter((c) => typeof c === 'string' && c.length);
  }
  if (tree.morale && typeof tree.morale === 'object') {
    base.morale = {
      happiness: Math.max(0, num(tree.morale.happiness, 0)),
      loyalty: Math.max(0, num(tree.morale.loyalty, 0)),
    };
  }
  if (tree.repairs && typeof tree.repairs === 'object') {
    base.repairs = {
      coins: Math.max(0, num(tree.repairs.coins, 0)),
      unpaid: Math.max(0, num(tree.repairs.unpaid, 0)),
      owed: Math.max(0, num(tree.repairs.owed, 0)),
    };
  }
  base.panic = clamp01(tree.panic);
  base.elapsed = Math.max(0, num(tree.elapsed, 0));
  return base;
}

/**
 * Find a hazard definition by id.
 * @param {object[]} defs
 * @param {string} id
 * @returns {object|null}
 */
export function findDef(defs, id) {
  if (!Array.isArray(defs)) return null;
  for (const def of defs) {
    if (def && typeof def === 'object' && def.id === id) return def;
  }
  return null;
}

/**
 * The cells a hazard covers, clamped to the playfield.
 * @param {object} hazardState
 * @returns {Array<{x:number,z:number}>}
 */
export function affectedCells(hazardState) {
  const out = [];
  if (!hazardState) return out;
  const cx = Math.round(num(hazardState.x, 0));
  const cz = Math.round(num(hazardState.z, 0));
  const radius = Math.max(0, Math.round(num(hazardState.radius, 0)));
  for (let dz = -radius; dz <= radius; dz += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dz * dz > radius * radius) continue;
      const x = cx + dx;
      const z = cz + dz;
      if (x < 0 || z < 0 || x >= GRID.size || z >= GRID.size) continue;
      out.push({ x, z });
    }
  }
  return out;
}
