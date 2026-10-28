/**
 * buildings/properties.js — the property-schema rules of the catalogue.
 *
 * OWNER: BLD. Pure logic. MUST NOT import `three` (unit-testable in Node).
 *
 * Implements the behavioural rules of the requirements dossier:
 *   §3.3  the property schema every entry carries
 *   §3.4  tier / level ladders (each tier owns its capacity and coverage)
 *   §3.11 diversity, wealth and growth-bonus point semantics
 *   §7    the rules / formulas / tuning table
 *
 * ---------------------------------------------------------------------------
 * TUNING VALUES (proposed - see the final report)
 * ---------------------------------------------------------------------------
 *   TUNING.baseBuildCost           price of a base 1x1 plot
 *   TUNING.demolishRefundRate      share refunded on demolish
 *   TUNING.maxLevels               residential levels
 *   TUNING.maxServiceLevels        service levels
 *   TUNING.residentsPerUpgrade     residents added per residential level
 *   TUNING.baseServiceRadius       level-1 service coverage radius (world u)
 *   TUNING.serviceRadiusPerLevel   coverage growth per level (world u)
 *
 * Locally declared constants that the publisher never published are marked
 * `// TBD:` and are proposed for TUNING in the final report:
 *   DIVERSITY_PENALTY_THRESHOLD    published: 8 instances of one entry type
 *   DIVERSITY_PENALTY_PER_EXCESS   TBD: 1 diversity point per excess copy
 *   BONUS_AREA_RADIUS_TILES        published: 13 x 13 for silo / windmill
 *   MAX_BUILD_SLOPE_STEP           TBD: max height step across a footprint
 */

import { TUNING, CELL, GRID } from '../core/config.js';
import { BUILDING_DEFS, CATEGORIES, ARCHETYPES, MODEL_KEYS, getDefinition } from './catalogue.js';
// The canonical bonus maths lives in POP (the dossier's cross-domain
// ownership map). `happiness.js` is a pure leaf module — it imports nothing
// but `core/config.js` — so this adds no import cycle.
import { diversityBonusPct, wealthBonusPct } from '../population/happiness.js';

/** Published: more than 8 instances of the same entry type is penalised. */
export const DIVERSITY_PENALTY_THRESHOLD = 8;

/**
 * TBD: the magnitude of the diversity penalty (OQ-BLD-11). The dossier's
 * proposed default is -1 diversity point per excess instance beyond 8.
 * Proposed TUNING key: `diversityPenaltyPerExcess`.
 */
export const DIVERSITY_PENALTY_PER_EXCESS = 1;

/** Published: the silo / windmill bonus area is 13 x 13 tiles. */
export const BONUS_AREA_RADIUS_TILES = 6;

/**
 * TBD: the biggest height difference (world units) allowed across a single
 * footprint before the ground is considered too steep to build on.
 * Set to 1.5 to agree with WLD's own `WLD_TUNING.maxBuildSlope`, so BLD and
 * WLD agree on which terrain is buildable.
 * Proposed TUNING key: `maxBuildSlopeStep`.
 */
export const MAX_BUILD_SLOPE_STEP = 1.5;

/** The three growth-bonus point categories of dossier §3.11. */
export const POINT_CATEGORIES = Object.freeze(['culture', 'entertainment', 'recreation']);

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

/** Every key a catalogue entry must carry (QA-BLD-003). */
export const REQUIRED_KEYS = Object.freeze([
  'id', 'displayName', 'description', 'category', 'archetype', 'available',
  'model', 'modelFamily', 'appearance', 'variants', 'footprintCells',
  'rotationStates', 'maxLevels', 'tierLadder', 'costInputs', 'upkeep',
  'upkeepPerUnit', 'capacity', 'production', 'consumption', 'serviceProvided',
  'coverage', 'coverageRadius', 'points', 'unique', 'stackable', 'wealthLevel',
  'pollution', 'noise', 'greenEnergy', 'trafficGeneration',
  'pedestrianGeneration', 'constructionSlots', 'requiresRoadConnection',
  'bonusArea', 'requiresPoleBarnCoverage', 'zoned', 'zoneId',
  'grantsConstructionSlot', 'unlock', 'unlockStage', 'contentPack',
  'schemaVersion', 'wasteProduction', 'infrastructure',
]);

const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));
const ARCHETYPE_IDS = new Set(ARCHETYPES);
const MODEL_KEY_SET = new Set(MODEL_KEYS);

function isNonNegNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/**
 * Check one definition against the property schema of dossier §3.3.
 * @returns {string[]} a list of problems; an empty array means the entry is valid.
 */
export function validateDefinition(def) {
  const problems = [];
  if (!def || typeof def !== 'object') return ['definition is not an object'];

  for (const key of REQUIRED_KEYS) {
    if (!(key in def)) problems.push(`missing required key "${key}"`);
  }

  if (typeof def.id !== 'string' || !def.id.length) problems.push('id must be a non-empty string');
  if (typeof def.displayName !== 'string' || !def.displayName.length) {
    problems.push('displayName must be a non-empty string');
  }
  if (typeof def.description !== 'string') problems.push('description must be a string');
  if (!CATEGORY_IDS.has(def.category)) problems.push(`unknown category "${def.category}"`);
  if (!ARCHETYPE_IDS.has(def.archetype)) problems.push(`unknown archetype "${def.archetype}"`);

  if (typeof def.available !== 'boolean') problems.push('available must be a boolean');
  if (def.available) {
    if (!def.model) problems.push('an available entry must reference a model');
    else if (!MODEL_KEY_SET.has(def.model)) problems.push(`model "${def.model}" is not in the manifest`);
  } else if (def.model !== null) {
    problems.push('an unavailable entry must have model === null');
  }

  const cells = def.footprintCells;
  if (!Array.isArray(cells) || cells.length !== 2) problems.push('footprintCells must be [w, d]');
  else {
    for (const n of cells) {
      if (!Number.isInteger(n) || n < 1) problems.push('footprint tile counts must be integers >= 1');
    }
  }

  if (!Number.isInteger(def.maxLevels) || def.maxLevels < 1) {
    problems.push('maxLevels must be an integer >= 1');
  }
  if (!Array.isArray(def.tierLadder) || !def.tierLadder.length) {
    problems.push('tierLadder must be a non-empty array');
  } else {
    if (def.tierLadder.length > def.maxLevels) problems.push('tierLadder is longer than maxLevels');
    def.tierLadder.forEach((tier, i) => {
      if (tier.level !== i + 1) problems.push(`tierLadder[${i}].level must be ${i + 1}`);
      if (!tier.capacity) problems.push(`tierLadder[${i}].capacity is missing`);
    });
  }

  for (const k of ['base', 'perCell', 'perLevel']) {
    if (!isNonNegNumber(def.costInputs?.[k])) problems.push(`costInputs.${k} must be a number >= 0`);
  }
  if (!isNonNegNumber(def.upkeep)) problems.push('upkeep must be a number >= 0');

  for (const k of ['residents', 'workspaces', 'jobs', 'served']) {
    if (!isNonNegNumber(def.capacity?.[k])) problems.push(`capacity.${k} must be a number >= 0`);
  }

  for (const k of POINT_CATEGORIES) {
    if (!isNonNegNumber(def.points?.[k])) problems.push(`points.${k} must be a number >= 0`);
  }

  if (def.wealthLevel !== null && ![1, 2, 3].includes(def.wealthLevel)) {
    problems.push('wealthLevel must be null or 1..3');
  }
  if (typeof def.unique !== 'boolean') problems.push('unique must be a boolean');
  if (typeof def.stackable !== 'boolean') problems.push('stackable must be a boolean');
  if (def.unique && def.stackable) {
    problems.push('an entry cannot be both unique and stackable (unique counts once per map)');
  }
  if (!Number.isInteger(def.constructionSlots) || def.constructionSlots < 1) {
    problems.push('constructionSlots must be an integer >= 1');
  }
  if (def.infrastructure !== null && !['road'].includes(def.infrastructure)) {
    problems.push('infrastructure must be null or "road"');
  }
  if (!isNonNegNumber(def.coverageRadius)) problems.push('coverageRadius must be a number >= 0');
  if (def.coverage && !isNonNegNumber(def.coverage.capacity)) {
    problems.push('coverage.capacity must be a number >= 0');
  }
  if (def.bonusArea) {
    if (!Number.isInteger(def.bonusArea.radiusTiles) || def.bonusArea.radiusTiles < 0) {
      problems.push('bonusArea.radiusTiles must be an integer >= 0');
    }
    if (!Array.isArray(def.bonusArea.targets)) problems.push('bonusArea.targets must be an array');
  }
  if (!['level', 'pack', 'event'].includes(def.unlock?.kind)) {
    problems.push('unlock.kind must be "level", "pack" or "event"');
  }
  if (typeof def.unlockStage !== 'string' || !def.unlockStage.length) {
    problems.push('unlockStage must be a non-empty string');
  }
  if (typeof def.contentPack?.packId !== 'string' || !def.contentPack.packId.length) {
    problems.push('contentPack.packId must be a non-empty string');
  }
  if (!Number.isInteger(def.contentPack?.packVersion) || def.contentPack.packVersion < 1) {
    problems.push('contentPack.packVersion must be an integer >= 1');
  }
  if (def.appearance?.modelId !== def.model) {
    problems.push('appearance.modelId must match the entry model');
  }

  return problems;
}

/**
 * Validate the whole catalogue: every entry individually, plus the
 * cross-entry rules (unique ids, unique model usage is NOT required).
 * @returns {string[]} problems; empty means the catalogue is sound.
 */
export function validateCatalogue(defs = BUILDING_DEFS) {
  const problems = [];
  const seenIds = new Set();
  for (const def of defs) {
    for (const p of validateDefinition(def)) problems.push(`${def?.id ?? '<no id>'}: ${p}`);
    if (seenIds.has(def.id)) problems.push(`${def.id}: duplicate id`);
    seenIds.add(def.id);
  }
  for (const cat of CATEGORIES) {
    if (!defs.some((d) => d.category === cat.id)) problems.push(`category "${cat.id}" has no entries`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Tier / level rules
// ---------------------------------------------------------------------------

/**
 * The tier record for a level. Levels outside the ladder clamp to the
 * nearest real tier (FR-BLD-051: the values live in data, not in code).
 */
export function tierFor(def, level = 1) {
  if (!def || !Array.isArray(def.tierLadder) || !def.tierLadder.length) return null;
  const wanted = Math.max(1, Math.min(def.maxLevels ?? def.tierLadder.length, Math.round(level)));
  return def.tierLadder.find((t) => t.level === wanted) ?? def.tierLadder[def.tierLadder.length - 1];
}

/**
 * Capacity of an entry at a level: the entry-level capacity with the tier's
 * own overrides applied (FR-BLD-050: each tier defines its own capacity).
 */
export function deriveCapacity(def, level = 1) {
  if (!def) return { residents: 0, workspaces: 0, jobs: 0, served: 0 };
  const tier = tierFor(def, level);
  const base = def.capacity ?? { residents: 0, workspaces: 0, jobs: 0, served: 0 };
  const over = tier?.capacity ?? {};
  return {
    residents: over.residents ?? base.residents ?? 0,
    workspaces: over.workspaces ?? base.workspaces ?? 0,
    jobs: over.jobs ?? base.jobs ?? 0,
    served: over.served ?? base.served ?? 0,
  };
}

/**
 * The price of an entry at a level.
 *
 * The cost FORMULA belongs to ECO (dossier §0); BLD supplies the inputs
 * (FR-BLD-025). This is a workable price estimate built from
 * TUNING.baseBuildCost and the entry's costInputs multipliers.
 *
 * Service entries compound with TUNING.serviceCostMultiplier per tier, as
 * that key intends ("construction cost multiplier per service tier").
 *
 * TBD: the multipliers per category are authored (the publisher published no
 * prices). Proposed TUNING key: `costAreaGrowth`.
 */
export function deriveCost(def, level = 1) {
  if (!def) return 0;
  const inputs = def.costInputs ?? { base: 1, perCell: 0.35, perLevel: 0.5 };
  const [w, d] = def.footprintCells ?? [1, 1];
  const cells = Math.max(1, w * d);
  const lv = Math.max(1, Math.round(level));
  const base = inputs.base * TUNING.baseBuildCost;
  const area = inputs.perCell * TUNING.baseBuildCost * (cells - 1);
  const isService = def.serviceProvided !== null || def.archetype === 'service';
  const tier = isService
    ? base * (Math.pow(TUNING.serviceCostMultiplier, lv - 1) - 1)
    : (inputs.perLevel ?? 0.5) * base * (lv - 1);
  return Math.max(0, Math.round(base + area + tier));
}

/**
 * Monthly upkeep of an entry at a level.
 *
 * TBD: upkeep is a design decision (OQ-BLD-05). Entries carry `upkeep: 0`
 * and residential entries flag `upkeepPerUnit`, so their upkeep is derived
 * from TUNING.monthlyUpkeepPerUnit. The caller decides whether to pay it.
 */
export function deriveUpkeep(def, level = 1) {
  if (!def) return 0;
  const capacity = deriveCapacity(def, level);
  const perUnit = def.upkeepPerUnit ? capacity.residents * TUNING.monthlyUpkeepPerUnit : 0;
  return (def.upkeep ?? 0) + perUnit;
}

/**
 * Coverage radius in WORLD UNITS at a level. Each tier owns its own coverage
 * and the radius grows with the level (FR-BLD-050).
 */
export function coverageRadiusFor(def, level = 1) {
  if (!def) return 0;
  const tier = tierFor(def, level);
  const tiles = tier?.coverage?.radiusTiles ?? def.coverage?.radiusTiles ?? 0;
  return Math.round(tiles * CELL);
}

/** Coverage radius expressed in TILES at a level. */
export function coverageRadiusTilesFor(def, level = 1) {
  if (!def) return 0;
  const tier = tierFor(def, level);
  return tier?.coverage?.radiusTiles ?? def.coverage?.radiusTiles ?? 0;
}

/** The stage an entry unlocks in. */
export function unlockStageFor(def) {
  if (!def) return null;
  return def.unlockStage ?? 'stage-1';
}

/**
 * True when the entry may be built on a map whose resident level is `level`.
 * FR-BLD-096: the unlock condition may be a level, a pack or an event window.
 */
export function isUnlocked(def, { level = 1, ownedPacks = [], currentEvent = null } = {}) {
  if (!def) return false;
  const u = def.unlock ?? { kind: 'level', level: 1 };
  if (u.kind === 'level') return level >= (u.level ?? 1);
  if (u.kind === 'pack') return ownedPacks.includes(u.packId);
  if (u.kind === 'event') return currentEvent === u.eventId;
  return false;
}

// ---------------------------------------------------------------------------
// Growth-bonus points (dossier §3.11 / §7)
// ---------------------------------------------------------------------------

/** Normalise the many shapes an instance collection can arrive in. */
function toInstanceArray(instances) {
  if (!instances) return [];
  if (Array.isArray(instances)) return instances;
  if (instances instanceof Map) return Array.from(instances.values());
  if (typeof instances.values === 'function') return Array.from(instances.values());
  return [];
}

function definitionOf(instance, lookup) {
  if (!instance) return null;
  if (instance.def && typeof instance.def === 'object') return instance.def;
  const id = instance.type ?? instance.defId ?? instance.buildingType;
  if (!id) return null;
  return lookup ? lookup(id) : getDefinition(id);
}

/**
 * Diversity points: exactly 1 per DISTINCT catalogue entry present on the
 * map (FR-BLD-035 / FR-BLD-098). Present count, not weighted.
 *
 * @param {Iterable} instances placed building instances
 * @returns {number}
 */
export function diversityPoints(instances) {
  const distinct = new Set();
  for (const inst of toInstanceArray(instances)) {
    const id = inst?.type ?? inst?.defId ?? inst?.buildingType;
    if (id) distinct.add(id);
  }
  return distinct.size;
}

/**
 * How many diversity points are DEDUCTED because too many copies of the same
 * entry type are on the map (FR-BLD-099). The rule (> 8 of a type) is
 * published; the magnitude is not (OQ-BLD-11) and is TUNED HERE:
 * one point per excess instance beyond the threshold.
 *
 * The return value is the MAGNITUDE of the deduction (>= 0). Use
 * `diversityScore()` for the net figure.
 */
export function diversityPenalty(instances, { lookup = getDefinition } = {}) {
  const counts = new Map();
  for (const inst of toInstanceArray(instances)) {
    const id = inst?.type ?? inst?.defId ?? inst?.buildingType;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let penalty = 0;
  for (const count of counts.values()) {
    if (count > DIVERSITY_PENALTY_THRESHOLD) {
      penalty += (count - DIVERSITY_PENALTY_THRESHOLD) * DIVERSITY_PENALTY_PER_EXCESS;
    }
  }
  return penalty;
}

/**
 * The map's diversity SCORE: raw distinct-entry points minus the penalty,
 * floored at zero (OQ-BLD-18).
 */
export function diversityScore(instances, opts = {}) {
  return Math.max(0, diversityPoints(instances) - diversityPenalty(instances, opts));
}

/**
 * The map's WEALTH level: the average of the wealth values of the entries
 * that carry one. Entries without a wealth value are EXCLUDED - they neither
 * raise nor lower the average (FR-BLD-100 / E10).
 *
 * @returns {number} 0 when nothing on the map carries a wealth value.
 */
export function wealthLevel(instances, { lookup = getDefinition } = {}) {
  let sum = 0;
  let count = 0;
  for (const inst of toInstanceArray(instances)) {
    const def = definitionOf(inst, lookup);
    const w = def?.wealthLevel;
    if (typeof w === 'number' && w >= 1) {
      sum += w;
      count += 1;
    }
  }
  if (!count) return 0;
  return sum / count;
}

/**
 * Growth-bonus points for one category ('culture' | 'entertainment' |
 * 'recreation') across the instances on the map.
 *
 * A `unique` entry contributes ONCE per map however many copies are placed;
 * a stackable entry contributes once per copy (FR-BLD-103 / E9).
 *
 * @returns {number} raw point total
 */
export function categoryPoints(instances, category, { lookup = getDefinition } = {}) {
  if (!POINT_CATEGORIES.includes(category)) return 0;
  const counted = new Set();
  let total = 0;
  for (const inst of toInstanceArray(instances)) {
    const def = definitionOf(inst, lookup);
    if (!def) continue;
    const id = def.id;
    if (def.unique) {
      if (counted.has(id)) continue;
      counted.add(id);
    }
    total += def.points?.[category] ?? 0;
  }
  return total;
}

/**
 * The bonus percentage for one point category.
 *
 * Published rule: one point per 1 000 residents is required for the full
 * 250 % cap of that category (FR-BLD-102).
 */
export function pointsBonus(points, residents) {
  const required = Math.max(0, (residents ?? 0) / 1000);
  if (required <= 0) return points > 0 ? 250 : 0;
  return Math.min(250, (points / required) * 250);
}

/**
 * The wealth bonus percentage for a wealth level.
 *
 * POP owns the canonical bonus maths — the dossier's cross-domain ownership
 * map gives the happiness and the bonus ceiling to POP, and the building
 * property schema to BLD. This is therefore a thin DELEGATE, not a second
 * implementation: there is exactly one curve, so the two domains cannot
 * drift apart.
 *
 * The publisher published TWO anchors: wealth level 1.65 -> 129 % and
 * wealth level 3 -> 250 % (FR-BLD-101). The interpolation between them is
 * unpublished (OQ-BLD-12), so `population/happiness.js` derives the base
 * level L0 from the published anchor instead of guessing it:
 *
 *   250 * (level - L0) / (3 - L0)   with L0 = 0.2
 *
 * which gives 129 % at 1.65 and 250 % at 3 — the published anchors, exactly.
 *
 * @param {number} wealth the wealth level
 * @param {object} [options] passed through to the canonical implementation
 * @returns {number} the bonus percentage, 0..250
 */
export function wealthBonus(wealth, options = {}) {
  return wealthBonusPct(wealth, options);
}

/**
 * The diversity bonus percentage: one point per distinct entry, capped.
 *
 * A delegate for the same reason as `wealthBonus` above.
 *
 * @param {number} points the diversity points
 * @returns {number} the bonus percentage, 0..250
 */
export function diversityBonus(points) {
  return diversityBonusPct(points);
}

// ---------------------------------------------------------------------------
// Bonus areas (dossier §7.7 - the published 13 x 13 example)
// ---------------------------------------------------------------------------

/**
 * The cells a bonus entry affects.
 *
 * The published example is a 13 x 13 square for the silo and the windmill,
 * i.e. a radius of 6 tiles around the building's anchor cell.
 *
 * @param {object} def     catalogue definition
 * @param {number} x       anchor cell x
 * @param {number} z       anchor cell z
 * @param {number} [gridSize] grid edge (defaults to GRID.size)
 * @returns {{x:number,z:number}[]} the cells inside the effect area, clipped
 *          to the grid. Empty when the entry is not a bonus entry.
 */
export function bonusAreaCells(def, x, z, gridSize = GRID.size) {
  if (!def || !def.bonusArea) return [];
  const radius = Number.isInteger(def.bonusArea.radiusTiles)
    ? def.bonusArea.radiusTiles
    : BONUS_AREA_RADIUS_TILES;
  const out = [];
  for (let dz = -radius; dz <= radius; dz += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const cx = x + dx;
      const cz = z + dz;
      if (cx < 0 || cz < 0 || cx >= gridSize || cz >= gridSize) continue;
      out.push({ x: cx, z: cz });
    }
  }
  return out;
}

/** The cell count of a bonus area (13 x 13 = 169 for the published example). */
export function bonusAreaSize(def, gridSize = GRID.size) {
  return bonusAreaCells(def, Math.floor(gridSize / 2), Math.floor(gridSize / 2), gridSize).length;
}
