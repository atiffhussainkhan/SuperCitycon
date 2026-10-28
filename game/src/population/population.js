/**
 * population/population.js — the POP capacity and bonus maths.
 *
 * OWNER: POP. Pure logic. This module MUST NOT import `three` so it can be
 * unit-tested in Node (see population.test.mjs).
 *
 * It implements the DERIVATION half of the requirements dossier:
 *   FR-POP-005  the resident count is a non-negative integer
 *   FR-POP-006  residents are DERIVED, never authored
 *   FR-POP-007  the residence bonus multiplies the residential capacity
 *   FR-POP-013  a full demand bar means the capacity is exhausted
 *   FR-POP-056  the wealth average is taken over the buildings that CARRY a
 *               wealth value - wealth-neutral buildings are excluded
 *   FR-POP-061  wealth-neutral buildings do not dilute the average
 *   FR-POP-065  more than eight copies of one type costs diversity points
 *   FR-POP-077  the six bonuses sum up to the residence bonus
 *
 * The import direction is ONE WAY: this module uses happiness.js, never the
 * other way round. That keeps the dependency graph acyclic and every module
 * testable on its own.
 */

import { TUNING } from '../core/config.js';
import {
  bonusMultiplier, pointsBonusPct, wealthBonusPct, diversityBonusPct,
  loyaltyBonusPct, BONUS_CATEGORIES,
} from './happiness.js';

/**
 * TBD: how many residents share one household.
 *
 * The dossier records households as a [TBD - design decision] (FR-POP-106).
 * Four is the published-average household size used as the rebuild's default.
 * Proposed TUNING key: `householdSize` = 4.
 */
export const HOUSEHOLD_SIZE = 4;

/**
 * TBD: how many iterations the resident fixed point may run.
 *
 * The residence bonus needs "one point per 1 000 residents" while the bonus
 * multiplies the resident count - the two chase each other (FR-POP-054). The
 * solver iterates until it settles or starts to oscillate.
 * Proposed TUNING key: `residentSolverIterations` = 16.
 */
export const RESIDENT_SOLVER_ITERATIONS = 16;

// ---------------------------------------------------------------------------
// The lazy BLD catalogue accessor
// ---------------------------------------------------------------------------

/**
 * BLD's PURE data modules, loaded lazily.
 *
 * The import is dynamic so this file still loads when `src/buildings/` is
 * missing or half-written: the failure is swallowed and the local fallbacks
 * below take over. Nothing is imported at module scope from a sibling domain.
 *
 * @type {{getDefinition:Function, categoryPoints:Function, wealthLevel:Function,
 *         diversityScore:Function, deriveCapacity:Function}|null}
 */
let bld = null;
/** @type {Promise<any>|null} */
let cataloguePromise = null;
/** @type {((id:string) => object|undefined)|null} */
let definitionLookup = null;

/**
 * Install a definition lookup by hand (the domain installs the real one; the
 * tests inject a stub).
 */
export function setDefinitionLookup(fn) {
  definitionLookup = typeof fn === 'function' ? fn : null;
  return definitionLookup;
}

/** The current definition lookup (may be null before the catalogue loads). */
export function getDefinitionLookup() {
  return definitionLookup;
}

/**
 * Lazily load BLD's pure catalogue + property modules.
 * @returns {Promise<object|null>}
 */
export async function installCatalogue() {
  if (bld) return bld;
  if (!cataloguePromise) {
    cataloguePromise = (async () => {
      try {
        const cat = await import('../buildings/catalogue.js');
        let props = null;
        try {
          props = await import('../buildings/properties.js');
        } catch { /* the property rules are optional */ }
        bld = {
          getDefinition: typeof cat?.getDefinition === 'function' ? cat.getDefinition : null,
          categoryPoints: typeof props?.categoryPoints === 'function' ? props.categoryPoints : null,
          wealthLevel: typeof props?.wealthLevel === 'function' ? props.wealthLevel : null,
          diversityScore: typeof props?.diversityScore === 'function' ? props.diversityScore : null,
          deriveCapacity: typeof props?.deriveCapacity === 'function' ? props.deriveCapacity : null,
        };
        if (bld.getDefinition) definitionLookup = (id) => bld.getDefinition(id);
      } catch {
        bld = null;
      }
      return bld;
    })();
  }
  return cataloguePromise;
}

// ---------------------------------------------------------------------------
// Instance helpers
// ---------------------------------------------------------------------------

/** Normalise anything instance-shaped into a list. */
export function toInstanceList(instances) {
  if (!instances) return [];
  if (Array.isArray(instances)) return instances;
  if (instances instanceof Map) return Array.from(instances.values());
  if (typeof instances.values === 'function') return Array.from(instances.values());
  if (typeof instances[Symbol.iterator] === 'function') return Array.from(instances);
  return [];
}

/** The catalogue entry of an instance. */
export function definitionOf(instance, lookup = definitionLookup) {
  if (!instance) return null;
  if (instance.def && typeof instance.def === 'object') return instance.def;
  const id = instance.type ?? instance.defId ?? instance.buildingType;
  if (!id || typeof lookup !== 'function') return null;
  return lookup(id) ?? null;
}

/** The level of an instance (1-based). */
export function levelOf(instance) {
  return Math.max(1, Math.round(Number(instance?.level) || 1));
}

/**
 * The residents a residential instance houses at its level.
 *
 * The catalogue owns the tier ladder (FR-BLD-050), so the number comes from
 * the entry's own tier record - POP never re-authors it.
 */
export function residentsOf(instance, def = definitionOf(instance)) {
  if (!def) return 0;
  const level = levelOf(instance);
  if (bld?.deriveCapacity) {
    const cap = bld.deriveCapacity(def, level);
    return Math.max(0, Number(cap?.residents) || 0);
  }
  const ladder = Array.isArray(def.tierLadder) ? def.tierLadder : [];
  const tier = ladder.find((t) => t.level === level) ?? ladder[Math.min(level, ladder.length) - 1];
  return Math.max(0, Number(tier?.capacity?.residents ?? def.capacity?.residents) || 0);
}

/**
 * The jobs an instance offers at its level (commercial and industrial only).
 */
export function jobsOf(instance, def = definitionOf(instance)) {
  if (!def) return 0;
  const level = levelOf(instance);
  const ladder = Array.isArray(def.tierLadder) ? def.tierLadder : [];
  const tier = ladder.find((t) => t.level === level) ?? ladder[Math.min(level, ladder.length) - 1];
  return Math.max(0, Number(tier?.capacity?.jobs ?? def.capacity?.jobs) || 0);
}

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

/**
 * The residential capacity of the placed buildings, in residents.
 *
 * This is the BASE capacity, before the residence bonus multiplies it
 * (FR-POP-007).
 *
 * @param {any} instances the placed building instances
 * @returns {number} residents the housing can hold
 */
export function capacityFor(instances) {
  let total = 0;
  for (const inst of toInstanceList(instances)) {
    const def = definitionOf(inst);
    if (!def || def.category !== 'residential') continue;
    total += residentsOf(inst, def);
  }
  return Math.max(0, Math.round(total));
}

/**
 * The number of households the placed residential buildings form.
 *
 * A household is the unit a service has to serve (TUNING.householdsPerService
 * is "households one level-1 service building can serve"), so this is the
 * capacity expressed in households.
 *
 * @param {any} instances the placed building instances
 * @returns {number} the household count
 */
export function householdsFor(instances, options = {}) {
  const tuning = options.tuning ?? TUNING;
  const size = Math.max(1, Math.round(Number(tuning.householdSize) || HOUSEHOLD_SIZE));
  const capacity = capacityFor(instances);
  return Math.max(0, Math.ceil(capacity / size));
}

/**
 * The employment pool of the placed buildings, in jobs.
 */
export function jobsFor(instances) {
  let total = 0;
  for (const inst of toInstanceList(instances)) {
    const def = definitionOf(inst);
    if (!def) continue;
    if (def.category !== 'commercial' && def.category !== 'industrial') continue;
    total += jobsOf(inst, def);
  }
  return Math.max(0, Math.round(total));
}

// ---------------------------------------------------------------------------
// The six bonus categories
// ---------------------------------------------------------------------------

/**
 * The raw points of the three stackable/unique point categories.
 *
 * BLD owns the property values and the unique rule; when BLD's pure module is
 * not loaded the same rule is applied locally (a `unique` entry counts once
 * per map, a stackable entry once per copy - FR-POP-103).
 */
function localCategoryPoints(instances, category) {
  const counted = new Set();
  let total = 0;
  for (const inst of toInstanceList(instances)) {
    const def = definitionOf(inst);
    if (!def) continue;
    if (def.unique) {
      if (counted.has(def.id)) continue;
      counted.add(def.id);
    }
    total += Number(def.points?.[category]) || 0;
  }
  return total;
}

/**
 * The average wealth level of the map.
 *
 * Only the buildings that CARRY a wealth value count - a wealth-neutral
 * building neither raises nor lowers the average (FR-POP-056/061).
 */
function localWealthLevel(instances) {
  let sum = 0;
  let count = 0;
  for (const inst of toInstanceList(instances)) {
    const def = definitionOf(inst);
    const w = Number(def?.wealthLevel);
    if (Number.isFinite(w) && w >= 1) {
      sum += w;
      count += 1;
    }
  }
  return count ? sum / count : 0;
}

/**
 * The diversity points of the map.
 *
 * One point per DISTINCT building type (FR-POP-065). The deduction for more
 * than eight copies of one type is BLD's rule and its magnitude is BLD's
 * [TBD] constant, so it is only applied when BLD's property module is
 * loaded; without BLD the raw distinct count is used.
 */
function localDiversity(instances) {
  const distinct = new Set();
  for (const inst of toInstanceList(instances)) {
    const def = definitionOf(inst);
    if (def?.id) distinct.add(def.id);
  }
  return distinct.size;
}

/**
 * The six residence bonus components, each a percentage.
 *
 * @param {any} instances the placed building instances
 * @param {number} residents the residents the point categories must serve
 * @param {object} [options] `{loyalty, tuning}`
 * @returns {{culture:number, entertainment:number, recreation:number,
 *            wealth:number, diversity:number, loyalty:number}}
 */
export function bonusComponents(instances, residents = 0, options = {}) {
  const list = toInstanceList(instances);
  const points = (category) => (bld?.categoryPoints
    ? bld.categoryPoints(list, category)
    : localCategoryPoints(list, category));

  const wealthLevel = bld?.wealthLevel
    ? bld.wealthLevel(list)
    : localWealthLevel(list);
  const diversity = bld?.diversityScore
    ? bld.diversityScore(list)
    : localDiversity(list);

  return {
    culture: pointsBonusPct(points('culture'), residents),
    entertainment: pointsBonusPct(points('entertainment'), residents),
    recreation: pointsBonusPct(points('recreation'), residents),
    wealth: wealthBonusPct(wealthLevel, options),
    diversity: diversityBonusPct(diversity),
    loyalty: loyaltyBonusPct(options.loyalty ?? 0, options),
  };
}

/**
 * The six components as an object with every category present, even when a
 * caller only knows some of them.
 */
export function emptyComponents() {
  const out = {};
  for (const cat of BONUS_CATEGORIES) out[cat] = 0;
  return out;
}

// ---------------------------------------------------------------------------
// The resident fixed point
// ---------------------------------------------------------------------------

/**
 * Solve for the resident count.
 *
 * The residence bonus needs "one point per 1 000 residents" while the bonus
 * multiplies the resident count, so the two chase each other (FR-POP-054).
 * The solver iterates until it settles; when the iteration starts to
 * oscillate it keeps the value it has, which makes it deterministic.
 *
 * @param {object} o `{capacity, instances, start, happiness, maxIterations}`
 * @returns {{residents:number, components:object, multiplier:number}}
 */
export function resolveResidents(o = {}) {
  const capacity = Math.max(0, Number(o.capacity) || 0);
  const instances = o.instances;
  const happiness = o.happiness ?? null;
  const maxIterations = Math.max(1, Math.round(Number(o.maxIterations) || RESIDENT_SOLVER_ITERATIONS));

  let residents = Math.max(0, Math.floor(Number(o.start) || 0));
  let components = emptyComponents();
  let multiplier = 1;
  const seen = new Set();

  for (let i = 0; i < maxIterations; i += 1) {
    components = bonusComponents(instances, residents, o);
    multiplier = bonusMultiplier(components, { happiness, tuning: o.tuning });
    // `round`, not `floor`: the derived population is
    // round(capacity x M). The dossier writes `floor` (a difference of at
    // most one resident); the integration contract asks for `round`.
    const target = Math.max(0, Math.round(capacity * multiplier));
    if (target === residents) break;
    if (seen.has(target)) break; // oscillating: keep the current value
    seen.add(residents);
    residents = target;
  }

  return { residents, components, multiplier };
}
