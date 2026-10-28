/**
 * services/services.js — the SRV service catalogue, radii and facility rules.
 *
 * OWNER: SRV. Pure logic. This module MUST NOT import `three` so it can be
 * unit-tested in Node (see services.test.mjs).
 *
 * Implements the parts of the requirements dossier that SRV owns:
 *   FR-SRV-001  a service catalogue with at least six categories
 *   FR-SRV-003  every service building carries a coverage profile
 *   FR-SRV-004  the catalogue is data-driven
 *   FR-SRV-005  three coverage archetypes (radius / connection / production)
 *   FR-SRV-009  the service system is per map
 *
 * ---------------------------------------------------------------------------
 * HONESTY NOTES
 * ---------------------------------------------------------------------------
 * 1. The publisher published NO service radii, no coverage falloff shape and
 *    no capacity figures. The numbers used here come from `TUNING`
 *    (baseServiceRadius 32, serviceRadiusPerLevel 8, householdsPerService 24)
 *    and are marked TBD in core/config.js. They are read, never re-declared.
 * 2. The catalogue ids below are the ids `core/stage.js` already reads out of
 *    `state.services.cityCoverage` ('energy', 'water', 'waste', 'health'), so
 *    CORE and SRV agree on one set of ids without CORE changing.
 * 3. The BLD catalogue is reached through a LAZY accessor (`installCatalogue`)
 *    so this module still loads when `src/buildings/` is absent or mid-edit.
 *    Nothing is imported at module scope from a sibling domain.
 */

import { TUNING, CELL } from '../core/config.js';

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

/**
 * The service catalogue.
 *
 * `archetype` records the service's PRIMARY behaviour (FR-SRV-005):
 *   'radius'      - an area of effect (police, fire, health, education)
 *   'points'      - points instead of an area (parks: recreation points)
 *   'production'  - makes or removes a supply (energy, water, food, waste)
 *   'connection'  - grants a connection instead of an area (transit)
 *
 * `coverageCircle` says whether the service publishes a coverage CIRCLE:
 *   - the eight government categories do (energy supply, water supply, food
 *     supply, waste, health care, security, fire, school system - dossier
 *     1.1 S29/S39), and `core/stage.js` scores the water and waste
 *     milestones against `state.services.cityCoverage`;
 *   - parks do NOT (FR-SRV-076: "the service overlay set shall not include a
 *     parks coverage circle in the shipped government panel - the evidenced
 *     parks behaviour is points, not a coverage circle"). FR-SRV-077 allows a
 *     parks circle in a future build, using this same solver.
 *   - transit is a connection grant and has no area (FR-SRV-005(b)).
 */
const CATALOGUE = Object.freeze([
  Object.freeze({ id: 'police', label: 'Police & Security', category: 'police', archetype: 'radius', coverageCircle: true, order: 1 }),
  Object.freeze({ id: 'fire', label: 'Fire Protection', category: 'fire', archetype: 'radius', coverageCircle: true, order: 2 }),
  Object.freeze({ id: 'health', label: 'Health Care', category: 'health', archetype: 'radius', coverageCircle: true, order: 3 }),
  Object.freeze({ id: 'education', label: 'Education', category: 'education', archetype: 'radius', coverageCircle: true, order: 4 }),
  Object.freeze({ id: 'parks', label: 'Parks & Leisure', category: 'parks', archetype: 'points', coverageCircle: false, order: 5 }),
  Object.freeze({ id: 'waste', label: 'Waste Management', category: 'waste', archetype: 'production', coverageCircle: true, order: 6 }),
  Object.freeze({ id: 'energy', label: 'Energy Supply', category: 'energy', archetype: 'production', coverageCircle: true, order: 7 }),
  Object.freeze({ id: 'water', label: 'Water Supply', category: 'water', archetype: 'production', coverageCircle: true, order: 8 }),
  Object.freeze({ id: 'food', label: 'Food Supply', category: 'food', archetype: 'production', coverageCircle: true, order: 9 }),
  Object.freeze({ id: 'transit', label: 'Transit & Connection', category: 'transit', archetype: 'connection', coverageCircle: false, order: 10 }),
]);

/** The catalogue ids, in catalogue order. */
export const SERVICE_IDS = Object.freeze(CATALOGUE.map((s) => s.id));

/** The catalogue itself (frozen). */
export function serviceCatalogue() {
  return CATALOGUE;
}

/** One catalogue entry, or null. */
export function serviceById(id) {
  return CATALOGUE.find((s) => s.id === id) ?? null;
}

/** True when the service publishes a coverage circle. */
export function hasCoverageCircle(id) {
  const entry = serviceById(id);
  return !!entry && entry.coverageCircle === true;
}

// ---------------------------------------------------------------------------
// Building definition -> service
// ---------------------------------------------------------------------------

/** The catalogue category that provides each service. */
const SERVICE_BY_CATEGORY = Object.freeze({
  police: 'police',
  fire: 'fire',
  health: 'health',
  education: 'education',
  parks: 'parks',
  waste: 'waste',
  energy: 'energy',
  water: 'water',
  food: 'food',
  transit: 'transit',
});

/** The service each `serviceProvided` value belongs to. */
const SERVICE_BY_PROVIDED = Object.freeze({
  health: 'health',
  police: 'police',
  fire: 'fire',
  'education.elementary': 'education',
  'education.secondary': 'education',
  'education.university': 'education',
  'education.connection': 'education',
  'transit.connection': 'transit',
  'transit.station': 'transit',
  'transit.ferry': 'transit',
  'transit.harbour': 'transit',
  'transit.air': 'transit',
});

/**
 * `serviceProvided` values that GRANT a connection instead of an area.
 * A bus station "does not expand the school area" (dossier S19/S20), and the
 * transit entries are connection grants (FR-SRV-005(b)).
 */
const CONNECTION_ONLY = Object.freeze(new Set([
  'education.connection',
  'transit.connection',
  'transit.station',
  'transit.ferry',
  'transit.harbour',
  'transit.air',
]));

/**
 * The SRV service id a catalogue entry belongs to.
 *
 * @param {object} def a BLD catalogue entry (or anything with `category` and
 *                   `serviceProvided`)
 * @returns {string|null} the service id, or null when the entry provides none
 */
export function serviceIdFor(def) {
  if (!def) return null;
  const provided = def.serviceProvided;
  if (provided && SERVICE_BY_PROVIDED[provided]) return SERVICE_BY_PROVIDED[provided];
  const cat = def.category;
  if (cat && SERVICE_BY_CATEGORY[cat]) return SERVICE_BY_CATEGORY[cat];
  return null;
}

/** True when the entry's own service grant produces no coverage circle. */
export function providesCoverageCircle(def) {
  if (!def) return false;
  if (def.serviceProvided && CONNECTION_ONLY.has(def.serviceProvided)) return false;
  const id = serviceIdFor(def);
  return hasCoverageCircle(id);
}

// ---------------------------------------------------------------------------
// The lazy BLD catalogue accessor
// ---------------------------------------------------------------------------

/** @type {((id:string) => object|undefined)|null} */
let definitionLookup = null;
/** @type {Promise<any>|null} */
let cataloguePromise = null;

/**
 * Install a definition lookup by hand. The domain installs the real one; the
 * tests inject a stub.
 * @param {((id:string) => object|undefined)|null} fn
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
 * Lazily load BLD's PURE catalogue module.
 *
 * The import is dynamic so this file still loads when `src/buildings/` is
 * missing or half-written: the failure is swallowed and the lookup stays
 * null (the domain then simply registers no facilities).
 *
 * @returns {Promise<((id:string) => object|undefined)|null>}
 */
export async function installCatalogue() {
  if (definitionLookup) return definitionLookup;
  if (!cataloguePromise) {
    cataloguePromise = (async () => {
      try {
        const mod = await import('../buildings/catalogue.js');
        if (typeof mod?.getDefinition === 'function') {
          definitionLookup = (id) => mod.getDefinition(id);
        }
      } catch {
        definitionLookup = null;
      }
      return definitionLookup;
    })();
  }
  return cataloguePromise;
}

/** Resolve the catalogue entry of a building instance. */
export function definitionOf(instance, lookup = definitionLookup) {
  if (!instance) return null;
  if (instance.def && typeof instance.def === 'object') return instance.def;
  const id = instance.type ?? instance.defId ?? instance.buildingType;
  if (!id || typeof lookup !== 'function') return null;
  return lookup(id) ?? null;
}

// ---------------------------------------------------------------------------
// Radii
// ---------------------------------------------------------------------------

/**
 * The coverage radius of a service facility at a level, in WORLD UNITS.
 *
 * TUNING.baseServiceRadius (32) is the level-1 radius and
 * TUNING.serviceRadiusPerLevel (8) is the growth per level, so the ladder is
 * 32 / 40 / 48 world units (8 / 10 / 12 cells).
 *
 * @param {number} level the facility level (1-based)
 * @returns {number} radius in world units
 */
export function serviceRadiusFor(level = 1) {
  const lv = Math.max(1, Math.round(Number(level) || 1));
  return TUNING.baseServiceRadius + (lv - 1) * TUNING.serviceRadiusPerLevel;
}

/**
 * The coverage radius of a specific catalogue entry at a level.
 *
 * A catalogue entry that carries its own coverage profile (the service
 * entries do: `tierLadder[].coverage.radiusTiles`) wins; everything else
 * falls back to the SRV ladder. This keeps BLD's per-tier authored radii and
 * SRV's ladder in agreement without either side owning the other's number.
 *
 * @param {object} def catalogue entry
 * @param {number} level facility level
 * @returns {number} radius in world units
 */
export function radiusForDefinition(def, level = 1) {
  const lv = Math.max(1, Math.round(Number(level) || 1));
  const ladder = Array.isArray(def?.tierLadder) ? def.tierLadder : null;
  if (ladder && ladder.length) {
    const tier = ladder.find((t) => t.level === lv) ?? ladder[Math.min(lv, ladder.length) - 1];
    const tiles = tier?.coverage?.radiusTiles;
    if (typeof tiles === 'number' && tiles > 0) return Math.round(tiles * CELL);
  }
  return serviceRadiusFor(lv);
}

// ---------------------------------------------------------------------------
// Facilities
// ---------------------------------------------------------------------------

/**
 * Turn a placed building instance into a service facility.
 *
 * @param {object} buildingInstance a BLD instance `{id, type, x, z, level}`
 * @param {object} [options]
 * @param {Function} [options.lookup] definition lookup (defaults to the
 *        installed one)
 * @returns {object|null} `{id, type, service, x, z, level, radius, capacity,
 *          providesCoverage}` or null when the building provides no service
 */
export function facilityFor(buildingInstance, options = {}) {
  if (!buildingInstance) return null;
  const lookup = options.lookup ?? definitionLookup;
  const def = definitionOf(buildingInstance, lookup);
  if (!def) return null;
  const service = serviceIdFor(def);
  if (!service) return null;

  const level = Math.max(1, Math.round(Number(buildingInstance.level) || 1));
  const capacity = def.capacity?.served ?? def.tierLadder?.[0]?.capacity?.served ?? 0;

  // The coverage volume is anchored to the building's own FOOTPRINT, not to
  // the cell the player clicked on (FR-SRV-016): a 2x2 hospital covers the
  // ground under all four of its tiles. The anchor cell is the fallback when
  // the instance carries no footprint.
  const cells = Array.isArray(buildingInstance.cells) ? buildingInstance.cells.filter((c) => c) : [];
  let fx = Number(buildingInstance.x) || 0;
  let fz = Number(buildingInstance.z) || 0;
  if (cells.length) {
    fx = cells.reduce((sum, c) => sum + (Number(c.x) || 0), 0) / cells.length;
    fz = cells.reduce((sum, c) => sum + (Number(c.z) || 0), 0) / cells.length;
  }

  return {
    id: buildingInstance.id,
    type: def.id,
    service,
    x: fx,
    z: fz,
    level,
    radius: radiusForDefinition(def, level),
    capacity: Number(capacity) || 0,
    providesCoverage: providesCoverageCircle(def),
  };
}

/**
 * Normalise anything that looks like a facility list into an array.
 * @param {any} facilities
 * @returns {object[]}
 */
export function toFacilityArray(facilities) {
  if (!facilities) return [];
  if (Array.isArray(facilities)) return facilities;
  if (facilities instanceof Map) return Array.from(facilities.values());
  if (typeof facilities.values === 'function') return Array.from(facilities.values());
  if (typeof facilities[Symbol.iterator] === 'function') return Array.from(facilities);
  return [];
}

/**
 * The facilities of one service id.
 * @param {any} facilities
 * @param {string} serviceId
 * @returns {object[]}
 */
export function facilitiesForService(facilities, serviceId) {
  return toFacilityArray(facilities).filter((f) => f && f.service === serviceId);
}
