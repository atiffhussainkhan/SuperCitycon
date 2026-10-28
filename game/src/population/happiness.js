/**
 * population/happiness.js — the POP score maths.
 *
 * OWNER: POP. Pure logic. This module MUST NOT import `three` so it can be
 * unit-tested in Node (see population.test.mjs).
 *
 * It implements the scoring half of the requirements dossier:
 *   FR-POP-006/007  residents are DERIVED from capacity x the residence bonus
 *   FR-POP-077      the six bonuses sum up to the residence bonus
 *   FR-POP-078/079  how the sum becomes the multiplier is a [TBD] decision
 *   FR-POP-085      the happiness scale is [TBD] - never a hard-coded 100
 *   FR-POP-091/107  a migration wave below the happiness threshold
 *   FR-POP-108      happiness is the immigration gate
 *   FR-POP-075      loyalty grows with care and decays with absence
 *
 * ---------------------------------------------------------------------------
 * THE PUBLISHED WEALTH EXAMPLE
 * ---------------------------------------------------------------------------
 * The publisher published exactly two wealth anchors:
 *   wealth level 1.65  ->  129 %          (dossier 1.1 #13)
 *   wealth level 3     ->  the full 250 % (dossier 1.1 #13)
 *
 * The dossier states that the published point is "consistent with flooring a
 * linear interpolation of ~129.46 %". The linear form it publishes is
 *
 *   wealthBonusPct = clamp(floor(250 * (level - L0) / (3 - L0)), 0, 250)
 *
 * and the ONLY L0 that produces 129.46 % at level 1.65 is L0 = 0.2:
 *
 *   250 * (1.65 - 0.2) / (3 - 0.2) = 362.5 / 2.8 = 129.464...  -> floor 129
 *
 * So L0 = 0.2 is DERIVED from the published anchor, not invented. It is still
 * marked TBD because the publisher never published it: the dossier records
 * L0 as open (OQ-POP-05). Proposed TUNING key: `wealthBaseLevel` = 0.2.
 *
 * ---------------------------------------------------------------------------
 * THE x15 / x16 CEILING (the one genuinely unresolved number)
 * ---------------------------------------------------------------------------
 * The recovered dev-blog text says the six bonuses "together can scale up to
 * x15". Six independently capped 250 % bonuses sum to 1500 %, which under an
 * ADDITIVE reading of the dossier's formula is 1 + 15 = x16. The dossier
 * leaves that tension open (OQ-POP-09) and says explicitly that neither x15
 * nor x16 may be hard-coded.
 *
 * This module therefore reads TUNING.bonusCeiling (15) and applies it as a
 * CEILING on the additive reading. The result is the x15 headline, and the
 * x16 arithmetic is visible in the code rather than hidden. See the final
 * report for the proposed resolution.
 */

import { TUNING } from '../core/config.js';

// ---------------------------------------------------------------------------
// The six residence bonus categories
// ---------------------------------------------------------------------------

/** The six categories, in the order the government panel lists them. */
export const BONUS_CATEGORIES = Object.freeze([
  'culture', 'entertainment', 'recreation', 'wealth', 'diversity', 'loyalty',
]);

/** The published per-category cap: "the maximum bonus of 250% for each category". */
export const CATEGORY_CAP = 250;

/** The published highest wealth level (three dollar signs). */
export const WEALTH_MAX_LEVEL = 3;

/**
 * TBD: the wealth level that earns 0 % (the dossier's L0, OQ-POP-05).
 *
 * DERIVED from the published anchor, not invented: 0.2 is the only value for
 * which the dossier's own published formula reproduces 1.65 -> 129 %.
 * Proposed TUNING key: `wealthBaseLevel` = 0.2.
 */
export const WEALTH_BASE_LEVEL = 0.2;

/**
 * TBD: how much of the 250 % loyalty cap a loyalty point is worth.
 *
 * The loyalty SCORE runs 0..100 (state.population.loyalty) while the loyalty
 * BONUS is capped at 250 %, so the two need a factor. 2.5 maps a perfect
 * 100-point loyalty onto the full 250 % cap.
 * Proposed TUNING key: `loyaltyBonusPerPoint` = 2.5.
 */
export const LOYALTY_BONUS_PER_POINT = 2.5;

/**
 * TBD: the pollution load at which the pollution index reaches 0.
 *
 * The catalogue's authored pollution values run 0..20 per building, so 100
 * points of city-wide pollution is a heavily industrialised city.
 * Proposed TUNING key: `pollutionFullLoad` = 100.
 */
export const POLLUTION_FULL_LOAD = 100;

/**
 * The happiness weights - the dossier's PROPOSED default (OQ-POP-10).
 *
 * The publisher confirmed that the weights are unequal and unpublished
 * ("I won't give too much details about the weight of each"). These are the
 * dossier's own proposed values, used unchanged.
 */
export const HAPPINESS_WEIGHTS = Object.freeze({
  supplyAdequacy: 0.30,
  serviceCoverage: 0.30,
  housingAdequacy: 0.15,
  employmentRate: 0.10,
  pollutionIndex: 0.15,
});

/**
 * The eight service categories the government panel shows a coverage circle
 * for (dossier 1.1 S29 / S39): energy supply, water supply, food supply,
 * waste, health care, security, fire, school system.
 */
export const COVERAGE_SERVICES = Object.freeze([
  'energy', 'water', 'food', 'waste', 'health', 'police', 'fire', 'education',
]);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clamp(value, lo, hi) {
  const v = Number(value);
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : (v > hi ? hi : v);
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

/** The tuning table a caller may override (tests inject their own). */
function tuningOf(options) {
  return options?.tuning ?? TUNING;
}

// ---------------------------------------------------------------------------
// The six bonus categories
// ---------------------------------------------------------------------------

/**
 * The bonus percentage of a point category.
 *
 * Published rule: one point per 1 000 residents earns the full 250 % cap, and
 * partial credit is proportional (3 of 10 points earns 75 %).
 *
 * @param {number} points    the raw points of the category
 * @param {number} residents the residents the points must serve
 * @returns {number} 0..250
 */
export function pointsBonusPct(points, residents) {
  const required = Math.max(1, Math.ceil(Math.max(0, Number(residents) || 0) / 1000));
  const p = Math.max(0, Number(points) || 0);
  if (p <= 0) return 0;
  return Math.min(CATEGORY_CAP, Math.floor((CATEGORY_CAP * p) / required));
}

/**
 * The bonus percentage of a wealth level.
 *
 * @param {number} level the map's average wealth level (0..3)
 * @returns {number} 0..250 - 129 for the published level 1.65
 */
export function wealthBonusPct(level, options = {}) {
  const tuning = tuningOf(options);
  const base = Number.isFinite(Number(tuning.wealthBaseLevel))
    ? Number(tuning.wealthBaseLevel)
    : WEALTH_BASE_LEVEL;
  const max = WEALTH_MAX_LEVEL;
  const l = Number(level) || 0;
  if (l <= base) return 0;
  if (l >= max) return CATEGORY_CAP;
  const pct = Math.floor((CATEGORY_CAP * (l - base)) / (max - base));
  return Math.max(0, Math.min(CATEGORY_CAP, pct));
}

/**
 * The bonus percentage of a diversity point total.
 *
 * Published rule: one point per distinct building type, one point = one per
 * cent, capped at 250 % (FR-POP-065/066).
 */
export function diversityBonusPct(points) {
  const p = Math.floor(Math.max(0, Number(points) || 0));
  return Math.max(0, Math.min(CATEGORY_CAP, p));
}

/**
 * The bonus percentage of the loyalty score.
 *
 * @param {number} loyalty the loyalty score, 0..100
 */
export function loyaltyBonusPct(loyalty, options = {}) {
  const tuning = tuningOf(options);
  const perPoint = Number.isFinite(Number(tuning.loyaltyBonusPerPoint))
    ? Number(tuning.loyaltyBonusPerPoint)
    : LOYALTY_BONUS_PER_POINT;
  const p = Math.max(0, Number(loyalty) || 0);
  return Math.max(0, Math.min(CATEGORY_CAP, Math.floor(p * perPoint)));
}

/**
 * The residence bonus: the sum of the six category bonuses.
 *
 * Published: "all those bonuses sum up to your residence bonus and increase
 * your residence amount" (dossier 1.1 #8).
 *
 * @param {object} components `{culture, entertainment, recreation, wealth,
 *        diversity, loyalty}` - each a percentage
 * @returns {number} the sum, in percent
 */
export function residentBonus(components) {
  if (!components) return 0;
  let sum = 0;
  for (const cat of BONUS_CATEGORIES) {
    sum += Math.max(0, Number(components[cat]) || 0);
  }
  return sum;
}

/**
 * The residence multiplier M: how the six bonuses scale capacity.
 *
 * The published formula is:
 *   residents = floor(residentialCapacityBase * M)
 *
 * HOW the sum becomes M is the unresolved [TBD] parameter (FR-POP-078/079,
 * OQ-POP-09). This implementation is the ADDITIVE reading with the published
 * x15 headline applied as a CEILING:
 *
 *   additive = 1 + sum / 100          (six 250 % bonuses -> x16)
 *   M        = min(additive, bonusCeiling)   (the published x15 wins)
 *
 * With `happiness` the bonus is additionally gated: the bonus curve
 * saturates at TUNING.bonusSaturation of the happiness scale, so an unhappy
 * city earns less of its bonus while the base capacity is never touched.
 *
 * @param {object} components the six category bonuses
 * @param {object} [options] `{happiness, tuning}`
 * @returns {number} the multiplier, >= 1
 */
export function bonusMultiplier(components, options = {}) {
  const tuning = tuningOf(options);
  const ceiling = Math.max(1, Number(tuning.bonusCeiling) || 15);
  const sum = residentBonus(components);
  const additive = 1 + sum / 100;
  const capped = Math.min(additive, ceiling);

  const h = options.happiness;
  if (h === undefined || h === null) return capped;

  const scale = Math.max(1, Number(tuning.happinessMax) || 100);
  const saturation = Number(tuning.bonusSaturation);
  const sat = Number.isFinite(saturation) && saturation > 0 ? saturation : 1;
  const gate = clamp01((Number(h) || 0) / (scale * sat));
  return 1 + (capped - 1) * gate;
}

// ---------------------------------------------------------------------------
// Migration and loyalty
// ---------------------------------------------------------------------------

/**
 * The migration pressure of a city, -1..1.
 *
 * Negative means people are LEAVING, positive means people are arriving.
 * Below TUNING.migrationThreshold the pressure is negative, which is what
 * triggers a migration wave (FR-POP-091/107).
 *
 * @param {number} happiness 0..happinessMax
 * @param {number} loyalty   0..100
 * @returns {number} -1..1
 */
export function migrationPressure(happiness, loyalty = 0, options = {}) {
  const tuning = tuningOf(options);
  const max = Math.max(1, Number(tuning.happinessMax) || 100);
  const threshold = Number(tuning.migrationThreshold);
  const h = clamp(happiness, 0, max);
  const l = clamp(loyalty, 0, 100);

  // How far the happiness sits above (or below) the migration threshold.
  const hTerm = (h - threshold) / Math.max(1e-6, max - threshold);
  // Loyal citizens resist leaving and slow the arrivals.
  const lTerm = (l - 50) / 50;

  return clamp(0.75 * hTerm + 0.25 * lTerm, -1, 1);
}

/**
 * The loyalty after a care streak.
 *
 * The published rule (dossier 1.1 #17/#18): a cared-for session earns one
 * loyalty point and every COMPLETE day away costs one point. The streak is
 * the net number of those days.
 *
 * @param {number} streak cared-for days (negative when days were missed)
 * @param {number} base   the loyalty the streak starts from
 * @returns {number} 0..100
 */
export function loyaltyFor(streak, base = 0, options = {}) {
  const tuning = tuningOf(options);
  const max = Number.isFinite(Number(tuning.loyaltyMax)) ? Number(tuning.loyaltyMax) : 100;
  const b = clamp(base, 0, max);
  const s = Number(streak) || 0;
  return clamp(b + s, 0, max);
}

// ---------------------------------------------------------------------------
// The happiness composite
// ---------------------------------------------------------------------------

/**
 * Read BLD's published aggregates from whatever the caller passed in.
 *
 * @param {any} buildings an aggregates object or an array of instances
 * @param {object} state
 * @returns {object} `{pollution, residents, jobs, employed}`
 */
function readAggregates(buildings, state) {
  const out = { pollution: 0, residents: 0, jobs: 0, employed: 0 };
  const published = state?.buildings?.aggregates;
  const src = (published && typeof published === 'object')
    ? published
    : (buildings && !Array.isArray(buildings) && typeof buildings === 'object' ? buildings : null);

  if (src) {
    out.pollution = Number(src.pollution) || 0;
    out.residents = Number(src.residents) || 0;
    out.jobs = Number(src.jobs) || 0;
    out.employees = Number(src.employees) || 0;
    out.employed = Number(src.employed) || 0;
  }
  return out;
}

/**
 * The supply adequacy input.
 *
 * The usage -> happiness curve `g` is ECO's [TBD] curve (OQ-ECO-10) and the
 * dossier forbids POP from defining its own. POP therefore READS the factor
 * ECO publishes; when ECO publishes nothing, POP assumes no usage pressure
 * (supplyAdequacy = 1) rather than inventing a curve.
 */
function readSupplyAdequacy(state, options) {
  const explicit = options?.supplyAdequacy;
  if (Number.isFinite(Number(explicit))) return clamp01(explicit);
  const eco = state?.economy ?? {};
  for (const key of ['supplyAdequacy', 'growthFactor', 'usageAdequacy']) {
    if (Number.isFinite(Number(eco[key]))) return clamp01(eco[key]);
  }
  return 1;
}

/**
 * The service coverage input: the mean of the government coverage circles.
 *
 * The weights between the circles are unpublished, so this is an unweighted
 * mean over the eight categories the government panel shows.
 */
function readServiceCoverage(state, options) {
  const explicit = options?.serviceCoverage;
  if (Number.isFinite(Number(explicit))) return clamp01(explicit);
  const city = state?.services?.cityCoverage;
  if (!city || typeof city !== 'object') return 0;
  let sum = 0;
  let count = 0;
  for (const id of COVERAGE_SERVICES) {
    const v = Number(city[id]);
    if (!Number.isFinite(v)) continue;
    sum += clamp01(v);
    count += 1;
  }
  return count ? sum / count : 0;
}

/**
 * The happiness breakdown.
 *
 * The composite is the dossier's proposed default (dossier 7.3): five
 * normalised inputs, unequal weights that sum to 1, scaled by the happiness
 * scale S.
 *
 * @param {object} state    the live state (POP reads its own subtree)
 * @param {any}    buildings BLD's aggregates, or the building instances
 * @param {object} [options] `{housingCapacity, employmentRate, supplyAdequacy,
 *        serviceCoverage, pollution, tuning}`
 * @returns {{needs: Record<string, number>, total: number, average: number}}
 *          `needs` holds each input's contribution in happiness points,
 *          `total` their sum (the happiness value) and `average` the mean
 *          contribution per need.
 */
export function needsBreakdown(state, buildings, options = {}) {
  const tuning = tuningOf(options);
  const scale = Math.max(1, Number(tuning.happinessMax) || 100);
  const floorValue = Number(tuning.happinessMin) || 0;
  const pop = state?.population ?? {};
  const agg = readAggregates(buildings, state);

  const residents = Math.max(0, Number(pop.total) || 0);
  const housingCapacity = Math.max(0, Number(
    options.housingCapacity ?? pop.housingCapacity ?? agg.residents,
  ) || 0);
  const employed = Math.max(0, Number(options.employed ?? pop.employed ?? agg.employed) || 0);

  const supplyAdequacy = readSupplyAdequacy(state, options);
  const serviceCoverage = readServiceCoverage(state, options);
  const housingAdequacy = housingCapacity > 0
    ? Math.min(1, residents / housingCapacity)
    : 1;
  const employmentRate = options.employmentRate !== undefined
    ? clamp01(options.employmentRate)
    : (residents > 0 ? Math.min(1, employed / residents) : 1);
  const pollution = Math.max(0, Number(options.pollution ?? agg.pollution) || 0);
  const pollutionIndex = 1 - Math.min(1, pollution / POLLUTION_FULL_LOAD);

  const needs = {
    supplyAdequacy: scale * HAPPINESS_WEIGHTS.supplyAdequacy * supplyAdequacy,
    serviceCoverage: scale * HAPPINESS_WEIGHTS.serviceCoverage * serviceCoverage,
    housingAdequacy: scale * HAPPINESS_WEIGHTS.housingAdequacy * housingAdequacy,
    employmentRate: scale * HAPPINESS_WEIGHTS.employmentRate * employmentRate,
    pollutionIndex: scale * HAPPINESS_WEIGHTS.pollutionIndex * pollutionIndex,
  };

  let total = 0;
  for (const value of Object.values(needs)) total += value;
  total = clamp(total, floorValue, scale);

  const names = Object.keys(needs);
  const average = names.length ? total / names.length : 0;

  return { needs, total, average };
}
