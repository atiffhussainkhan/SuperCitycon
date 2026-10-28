/**
 * ECO — pure economy logic.
 *
 * This module holds RULES only (dossier §7). It never imports Three.js, never
 * touches the DOM and never imports a sibling domain: everything arrives as
 * plain data, so the whole model is unit-testable in bare Node
 * (`node --test src/economy/economy.test.mjs`).
 *
 * HONESTY RULE
 * -------------
 * Every number the publisher never published lives in `TBD_VALUES` and is
 * marked `// TBD:`. None of them is presented as a publisher fact. The
 * proposed `TUNING` key for each one is written next to it so the integrator
 * can promote it into `core/config.js` without hunting.
 *
 * The only module-level import is `core/config.js`, which is itself pure.
 */

import { TUNING } from '../core/config.js';

// ---------------------------------------------------------------------------
// Published vs authored values
// ---------------------------------------------------------------------------

/**
 * Every value the publisher never published.
 *
 * Each entry names the `TUNING` key the integrator should add to
 * `core/config.js` (ECO may not edit that file). Until the key exists, the
 * value below is used and the UI may surface it as provisional.
 */
export const TBD_VALUES = Object.freeze({
  // FR-ECO-044 / OQ-ECO-08 — base income per building is unpublished.
  // Proposed TUNING keys: economy.commercialIncomePerWorkspace,
  // economy.industrialIncomePerJob.
  commercialIncomePerWorkspace: 9,
  industrialIncomePerJob: 11,

  // FR-ECO-039 / OQ-ECO-06 — the day length, the settlement day and the
  // month length are unpublished. A calendar-faithful month would be 30
  // in-game days (DAY_LENGTH = 60 s each => 30 real minutes); that is too
  // long to observe a loop, so the settlement period is compressed.
  // Proposed TUNING key: economy.monthSeconds (30).
  monthSeconds: 30,
  monthDays: 30,

  // FR-ECO-097 / F6 — the food conversion ratios are unpublished.
  // Proposed TUNING key: economy.processedPlantShare (0.5) — the share of a
  // food industry's plant-food demand (the rest is animal food).
  processedPlantShare: 0.5,

  // FR-ECO-045 / F5 — the bonus magnitudes are unpublished.
  // Proposed TUNING keys: economy.localIncomeBonus (0.1),
  // economy.localProductionBonus (0.25), economy.mapBonus (0.15),
  // economy.globalBonus (0.2).
  localIncomeBonus: 0.1,
  localProductionBonus: 0.25,
  mapBonus: 0.15,
  globalBonus: 0.2,

  // FR-ECO-113 / FR-ECO-122 — the construction time per building and the
  // slot cost are unpublished. `constructionSlots` itself IS authored by BLD
  // (e.g. `eng.coal` asks for 2); only the duration is missing.
  // Proposed TUNING key: economy.constructionMinutesByCategory.
  constructionMinutesByCategory: Object.freeze({
    residential: 1,
    commercial: 2,
    industrial: 3,
    service: 4,
    default: 2,
  }),

  // FR-ECO-055 / OQ-ECO-05 — upkeep is 0 by default and only charged when a
  // mode enables it. Proposed TUNING key: economy.upkeepEnabled (true).
  upkeepEnabled: true,

  // FR-ECO-050/051 / F10 / OQ-ECO-09 — the voxel auto-cost coefficients are
  // unpublished. Proposed TUNING key: economy.voxelCostModel.
  voxelCostModel: Object.freeze({
    baseCost: 8,
    perVoxel: 1,
    perFootprintTile: 2,
    perMaterial: 6,
  }),

  // FR-ECO-052 — the economic-impact weights of a studio voxel model are
  // unpublished too. Proposed TUNING key: economy.voxelImpactModel.
  voxelImpactModel: Object.freeze({
    scaleDivisor: 10,
    tileWeight: 4,
    materialWeight: 2,
    energyOutput: 5,
    waterOutput: 3,
    foodOutput: 1,
    energyInput: 2,
    waterInput: 1,
    wasteOutput: 1,
  }),

  // FR-ECO-125 — the period ledger needs a cap. Proposed TUNING key:
  // economy.ledgerLimit (200).
  ledgerLimit: 200,

  // OQ-ECO-10 — the growth-penalty curve shape between 90 % and 100 % usage
  // is a design decision. `jump` is the factor at exactly 90 %; it must be
  // strictly below 1 so the penalty applies *from* 90 % (FR-ECO-065).
  // Proposed TUNING key: economy.growthPenaltyJump (0.5).
  growthPenaltyJump: 0.5,
});

/** The three income sectors (FR-ECO-025). */
export const SECTORS = Object.freeze(['residential', 'commercial', 'industrial']);

/** The four usage-bar channels (FR-ECO-060). */
export const RESOURCE_CHANNELS = Object.freeze(['energy', 'water', 'food', 'waste']);

/** The budget-slider categories (FR-ECO-075 / FR-ECO-125). */
export const BUDGET_CATEGORIES = Object.freeze([
  'energy', 'water', 'food', 'waste', 'health', 'security', 'fire', 'education',
]);

/** Default tax rates per sector (F11, proposed default (b) = 1.0). */
export const DEFAULT_TAX_RATES = Object.freeze({ residential: 1, commercial: 1, industrial: 1 });

/**
 * The production / consumption chains, as DATA (FR-ECO-081 … FR-ECO-099).
 *
 * A chain says which channels exist, which tiers a channel has and how one
 * tier feeds another. No rule is hard-coded per building: a building joins a
 * tier because its authored `production.food` says so.
 */
export const CHAIN_DEFS = Object.freeze({
  energy: Object.freeze({
    id: 'energy',
    label: 'energy',
    channel: 'energy',
    tiers: Object.freeze([]),
    /** FR-ECO-083 — nuclear counts as non-green; `greenEnergy` is authored. */
    greenFlag: 'greenEnergy',
  }),
  water: Object.freeze({
    id: 'water',
    label: 'water',
    channel: 'water',
    tiers: Object.freeze([]),
  }),
  food: Object.freeze({
    id: 'food',
    label: 'food',
    channel: 'food',
    tiers: Object.freeze(['plant', 'animal', 'processed']),
    /** FR-ECO-086/087/089 — the two-stage and three-stage food chain. */
    links: Object.freeze([
      Object.freeze({ from: 'plant', to: 'animal', consumes: 'plant' }),
      Object.freeze({ from: 'plant', to: 'processed', consumes: 'plant' }),
      Object.freeze({ from: 'animal', to: 'processed', consumes: 'animal' }),
    ]),
    /**
     * FR-ECO-098 — only a pole barn GATES fields and animal enclosures; the
     * silo and the windmill only boost them (FR-ECO-092). BLD has not
     * authored a generic "gate" flag, so the gate emitters are named here as
     * DATA. When BLD ships `bonusArea.gates`, switch this to that flag.
     */
    gateEmitters: Object.freeze(['foo.pole_barn']),
    /** The def flag that marks a building as gated. */
    gateFlag: 'requiresPoleBarnCoverage',
  }),
  waste: Object.freeze({
    id: 'waste',
    label: 'waste',
    channel: 'waste',
    tiers: Object.freeze([]),
  }),
});

/**
 * The connected-economy pools (FR-ECO-100 … FR-ECO-109, F8).
 *
 * Membership is per MAP and the pool is region-wide. `emitters` are the
 * def ids that make the current map a member.
 *
 * `eng.cwire` and `wat.pipeline` are the dossier's names (FR-ECO-103/105);
 * BLD has not authored them yet, so those two pools stay empty until the
 * catalogue ships them (case 21 of the dossier: purely local accounting).
 */
export const POOL_DEFS = Object.freeze({
  foodWaste: Object.freeze({
    id: 'foodWaste',
    label: 'food+waste',
    channels: Object.freeze(['food', 'waste']),
    emitters: Object.freeze(['trn.harbour_terminal']),
  }),
  energy: Object.freeze({
    id: 'energy',
    label: 'energy',
    channels: Object.freeze(['energy']),
    emitters: Object.freeze(['eng.cwire']),
  }),
  water: Object.freeze({
    id: 'water',
    label: 'water',
    channels: Object.freeze(['water']),
    emitters: Object.freeze(['wat.pipeline']),
  }),
});

/** FR-ECO-031 — map bonuses come from map-specific buildings (the airport). */
export const MAP_BONUS_EMITTERS = Object.freeze(['trn.airport_terminal']);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, lo, hi) {
  const n = num(value, lo);
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function chebyshev(ax, az, bx, bz) {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

function lookupDef(defs, id) {
  if (!defs || id === undefined || id === null) return null;
  if (typeof defs === 'function') return defs(id) ?? null;
  if (defs instanceof Map) return defs.get(id) ?? null;
  if (typeof defs.get === 'function') return defs.get(id) ?? null;
  if (typeof defs === 'object') return defs[id] ?? null;
  return null;
}

/**
 * Normalise any instance-ish input into `[{ def, level, x, z, id }]`.
 *
 * Accepts an array, a Map of instances, a Set of instances or plain objects.
 * `opts.defs` may be a Map, a plain object or a lookup function; without it
 * only instances that already carry their `def` survive.
 */
export function resolveInstances(input, opts = {}) {
  const out = [];
  if (!input) return out;

  const push = (inst, def, fallbackId) => {
    if (!inst || !def) return;
    out.push({
      id: inst.id ?? fallbackId ?? null,
      def,
      level: Math.max(1, Math.round(num(inst.level, 1))),
      x: num(inst.x, 0),
      z: num(inst.z, 0),
    });
  };

  if (Array.isArray(input)) {
    // Fast path: the array is already resolved (this is what the domain
    // hands over), so it is used as it is instead of being copied.
    let resolved = input.length > 0;
    for (const inst of input) {
      if (!inst || !inst.def || typeof inst.def !== 'object') { resolved = false; break; }
    }
    if (resolved) return input;
    for (const inst of input) {
      const def = inst?.def ?? lookupDef(opts.defs, inst?.type ?? inst?.defId ?? inst?.id);
      push(inst, def, null);
    }
    return out;
  }
  if (input instanceof Map) {
    for (const [id, inst] of input) {
      const def = inst?.def ?? lookupDef(opts.defs, inst?.type ?? id);
      push(inst, def, id);
    }
    return out;
  }
  if (typeof input.forEach === 'function' && typeof input.get === 'function') {
    for (const [id, inst] of input) {
      const def = inst?.def ?? lookupDef(opts.defs, inst?.type ?? id);
      push(inst, def, id);
    }
    return out;
  }
  if (typeof input.forEach === 'function') {
    for (const inst of input) {
      const def = inst?.def ?? lookupDef(opts.defs, inst?.type);
      push(inst, def, null);
    }
    return out;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Construction cost (FR-ECO-046 … FR-ECO-054)
// ---------------------------------------------------------------------------

/**
 * The construction cost of a building (FR-ECO-048: the cost is a per-building
 * data field consumed from BLD; the FORMULA is ECO's).
 *
 * The formula mirrors `buildings/properties.js:deriveCost` exactly, so the
 * number BLD checks with `economy.canAfford()` and the number ECO charges
 * are the same number.
 *
 * @param {object} def   the catalogue definition
 * @param {number} level level 1..N
 * @param {object} [opts] { discount, free, voxel }
 * @returns {number} coins
 */
export function constructionCost(def, level = 1, opts = {}) {
  if (!def) return 0;
  const lv = Math.max(1, Math.round(num(level, 1)));

  // A studio-authored voxel model overrides the catalogue price (FR-ECO-050).
  if (opts.voxel) return voxelConstructionCost(opts.voxel);

  const inputs = def.costInputs ?? { base: 1, perCell: 0.35, perLevel: 0.5 };
  const [w, d] = def.footprintCells ?? [1, 1];
  const cells = Math.max(1, num(w, 1) * num(d, 1));
  const base = num(inputs.base, 1) * TUNING.baseBuildCost;
  const area = num(inputs.perCell, 0.35) * TUNING.baseBuildCost * (cells - 1);
  // FR-ECO-048: a service entry compounds per tier (TUNING.serviceCostMultiplier).
  const isService = def.serviceProvided != null || def.archetype === 'service';
  const tier = isService
    ? base * (Math.pow(TUNING.serviceCostMultiplier, lv - 1) - 1)
    : num(inputs.perLevel, 0.5) * base * (lv - 1);

  let cost = Math.max(0, Math.round(base + area + tier));

  if (opts.free) cost = 0;
  else if (opts.discount) cost = Math.round(cost * (1 - clamp(opts.discount, 0, 1)));
  return Math.max(0, cost);
}

/**
 * The single named auto-cost for a studio voxel model (FR-ECO-051, F10).
 *
 * `cost = base + a·voxelCount + b·footprintTiles + c·materialCount`
 * with `a, b, c >= 0`, so the result is monotonically non-decreasing in every
 * input (FR-ECO-053) and identical inputs always give an identical cost
 * (NFR-ECO-011).
 *
 * @param {{voxelCount?:number, footprintTiles?:number, materialCount?:number}} inputs
 * @returns {number} coins
 */
export function voxelConstructionCost(inputs = {}) {
  const m = TBD_VALUES.voxelCostModel;
  const voxels = Math.max(0, num(inputs.voxelCount, 0));
  const tiles = Math.max(0, num(inputs.footprintTiles, 0));
  const materials = Math.max(0, num(inputs.materialCount, 0));
  return Math.max(0, Math.round(
    m.baseCost + m.perVoxel * voxels + m.perFootprintTile * tiles + m.perMaterial * materials,
  ));
}

/**
 * The economic impact of a studio voxel model (FR-ECO-052).
 *
 * The impact is derived from the SAME authored production/consumption fields
 * the catalogue uses, so a voxel model behaves like any other building.
 *
 * @param {{voxelCount?:number, footprintTiles?:number, materialCount?:number}} inputs
 * @returns {{production:object, consumption:object}}
 */
export function voxelEconomicImpact(inputs = {}) {
  const m = TBD_VALUES.voxelImpactModel;
  const voxels = Math.max(0, num(inputs.voxelCount, 0));
  const tiles = Math.max(0, num(inputs.footprintTiles, 0));
  const materials = Math.max(0, num(inputs.materialCount, 0));
  const scale = (voxels + tiles * m.tileWeight + materials * m.materialWeight) / m.scaleDivisor;
  return {
    production: {
      energy: Math.round(scale * m.energyOutput),
      water: Math.round(scale * m.waterOutput),
      food: { plant: 0, animal: 0, processed: 0 },
      wasteRemoval: 0,
    },
    consumption: {
      energy: Math.round(scale * m.energyInput),
      water: Math.round(scale * m.waterInput),
      food: Math.round(scale * m.foodOutput),
      waste: Math.round(scale * m.wasteOutput),
    },
  };
}

/** How many construction slots a definition occupies (FR-ECO-120). */
export function constructionSlotsFor(def) {
  const n = Math.round(num(def?.constructionSlots, 1));
  return Math.max(1, n);
}

/**
 * The construction duration of a definition, in MINUTES (FR-ECO-113).
 *
 * FR-ECO-122: the exact time per building is unpublished, so it is authored
 * per category here and may be overridden per building by a
 * `constructionMinutes` field when BLD ships one.
 */
export function constructionMinutesFor(def) {
  const authored = num(def?.constructionMinutes, NaN);
  if (Number.isFinite(authored) && authored > 0) return authored;
  const table = TBD_VALUES.constructionMinutesByCategory;
  if (def?.serviceProvided != null || def?.archetype === 'service') return table.service;
  const cat = def?.category;
  if (cat === 'residential') return table.residential;
  if (cat === 'commercial') return table.commercial;
  if (cat === 'industrial') return table.industrial;
  return table.default;
}

// ---------------------------------------------------------------------------
// Capacity, sector, budget category
// ---------------------------------------------------------------------------

/** The capacity of a definition at a level. */
export function capacityOf(def, level = 1) {
  const empty = { residents: 0, workspaces: 0, jobs: 0, served: 0 };
  if (!def) return empty;
  const lv = Math.max(1, Math.round(num(level, 1)));
  const ladder = Array.isArray(def.tierLadder) ? def.tierLadder : [];
  const tier = ladder.find((t) => t.level === lv) ?? ladder[lv - 1];
  const base = def.capacity ?? {};
  return {
    residents: tier?.capacity?.residents ?? base.residents ?? 0,
    workspaces: tier?.capacity?.workspaces ?? base.workspaces ?? 0,
    jobs: tier?.capacity?.jobs ?? base.jobs ?? 0,
    served: tier?.capacity?.served ?? base.served ?? 0,
  };
}

/** The income sector of a definition (FR-ECO-025). */
export function sectorOf(def) {
  const cat = def?.category;
  if (cat === 'residential' || cat === 'commercial' || cat === 'industrial') return cat;
  return null;
}

/** The budget-slider category of a definition, or null when unbudgeted. */
export function budgetCategoryOf(def) {
  switch (def?.category) {
    case 'energy': return 'energy';
    case 'water': return 'water';
    case 'food': return 'food';
    case 'waste': return 'waste';
    case 'health': return 'health';
    case 'police': return 'security';
    case 'fire': return 'fire';
    case 'education': return 'education';
    default: return null;
  }
}

/** The waste-production breakdown category (FR-ECO-095). */
export function wasteCategoryOf(def) {
  switch (def?.category) {
    case 'residential': return 'residential';
    case 'commercial': return 'commercial';
    case 'industrial': return 'industrial';
    case 'food': return 'farms';
    case 'health':
    case 'police':
    case 'fire':
    case 'education':
    case 'transit': return 'government';
    default: return 'other';
  }
}

/** Which food tier a definition produces (FR-ECO-086). */
export function foodTierOf(def) {
  const f = def?.production?.food;
  if (!f) return null;
  if (num(f.processed, 0) > 0) return 'processed';
  if (num(f.animal, 0) > 0) return 'animal';
  if (num(f.plant, 0) > 0) return 'plant';
  return null;
}

/** The bonus-target key of a definition (F5 / FR-ECO-092). */
export function bonusTargetKeyOf(def) {
  const tier = foodTierOf(def);
  if (tier) return `food.${tier}`;
  return def?.category ?? null;
}

// ---------------------------------------------------------------------------
// Area bonuses (F5) and gates (FR-ECO-098)
// ---------------------------------------------------------------------------

/** True when the definition is an area-bonus emitter (FR-ECO-032). */
export function isBonusEmitter(def) {
  return Boolean(def?.bonusArea?.radiusTiles > 0);
}

/** True when the definition is a food gate (the pole barn). */
export function isGateEmitter(def) {
  const gateIds = CHAIN_DEFS.food.gateEmitters;
  return gateIds.includes(def?.id);
}

/**
 * Is the cell covered by the emitter's area?
 *
 * F5: the area is a RECTANGLE in tiles around the emitter. `radiusTiles` is
 * the half-extent, so the rectangle is `(2r+1) x (2r+1)` tiles — radius 6
 * gives the observed 13x13 food rectangle.
 */
export function coversArea(emitter, x, z) {
  const r = num(emitter?.def?.bonusArea?.radiusTiles, 0);
  if (r <= 0) return false;
  return chebyshev(num(emitter.x, 0), num(emitter.z, 0), num(x, 0), num(z, 0)) <= r;
}

/**
 * A coarse spatial index of the bonus emitters.
 *
 * The bonus search is O(buildings x emitters). With a 5,000-building city
 * and many parks or silos that would blow the 2 ms budget of NFR-ECO-006, so
 * the emitters are bucketed and only the buckets around a building are
 * searched.
 *
 * @param {object[]} emitters
 * @param {number} [bucketSize] the bucket edge in cells
 */
export function indexEmitters(emitters, bucketSize = 0) {
  const list = emitters ?? [];
  let maxRadius = 0;
  for (const emitter of list) {
    maxRadius = Math.max(maxRadius, num(emitter?.def?.bonusArea?.radiusTiles, 0));
  }
  // The bucket edge follows the widest area, so a lookup only ever touches
  // the few emitters that can actually reach the cell.
  const size = bucketSize > 0
    ? bucketSize
    : Math.max(2, Math.min(8, Math.ceil(maxRadius) || 2));
  const buckets = new Map();
  for (const emitter of list) {
    const radius = num(emitter?.def?.bonusArea?.radiusTiles, 0);
    const x = num(emitter?.x, 0);
    const z = num(emitter?.z, 0);
    const bx0 = Math.floor((x - radius) / size);
    const bx1 = Math.floor((x + radius) / size);
    const bz0 = Math.floor((z - radius) / size);
    const bz1 = Math.floor((z + radius) / size);
    for (let bx = bx0; bx <= bx1; bx += 1) {
      for (let bz = bz0; bz <= bz1; bz += 1) {
        const key = `${bx},${bz}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(emitter);
      }
    }
  }
  return { buckets, bucketSize: size, maxRadius };
}

/**
 * The emitters that could cover a cell.
 *
 * Every emitter is registered in every bucket its area touches, so the
 * bucket of the cell alone is enough — no range scan is needed.
 *
 * @returns {object[]} a READ-ONLY list; do not mutate it
 */
export function emittersNear(index, x, z) {
  if (!index?.buckets) return [];
  const bx = Math.floor(num(x, 0) / index.bucketSize);
  const bz = Math.floor(num(z, 0) / index.bucketSize);
  return index.buckets.get(`${bx},${bz}`) ?? [];
}

/**
 * The local bonus stack covering one building (F4 / F5).
 *
 * @param {object[]} emitters the emitters (or the nearby ones)
 * @param {object} def       the building definition
 * @param {number} x
 * @param {number} z
 * @param {object} [index] an {@link indexEmitters} index to narrow the search
 * @returns {{magnitude:number, sources:object[]}}
 */
export function localBonusesFor(emitters, def, x, z, index = null) {
  const sources = [];
  let magnitude = 0;
  const candidates = index ? emittersNear(index, x, z) : (emitters ?? []);
  for (const emitter of candidates) {
    const targets = emitter.def?.bonusArea?.targets ?? [];
    if (!targets.includes(def?.category)) continue;
    if (!coversArea(emitter, x, z)) continue;
    const mag = num(emitter.magnitude, TBD_VALUES.localIncomeBonus);
    magnitude += mag;
    sources.push({ id: emitter.id ?? null, defId: emitter.def?.id ?? null, magnitude: mag });
  }
  return { magnitude, sources };
}

/**
 * The production bonus stack covering one building (FR-ECO-092).
 *
 * Only the emitter's own targets match, so a silo/windmill never boosts an
 * industrial food plant (its target key is `food.processed`).
 */
export function localProductionBonusFor(emitters, def, x, z, index = null) {
  const key = bonusTargetKeyOf(def);
  if (!key) return 0;
  let magnitude = 0;
  const candidates = index ? emittersNear(index, x, z) : (emitters ?? []);
  for (const emitter of candidates) {
    const targets = emitter.def?.bonusArea?.targets ?? [];
    if (!targets.includes(key)) continue;
    if (!coversArea(emitter, x, z)) continue;
    magnitude += num(emitter.magnitude, TBD_VALUES.localProductionBonus);
  }
  return magnitude;
}

// ---------------------------------------------------------------------------
// Upkeep (FR-ECO-055)
// ---------------------------------------------------------------------------

/** The monthly upkeep of one definition at a level. */
export function upkeepOf(def, level = 1) {
  if (!def) return 0;
  const cap = capacityOf(def, level);
  const perUnit = def.upkeepPerUnit ? cap.residents * TUNING.monthlyUpkeepPerUnit : 0;
  return num(def.upkeep, 0) + perUnit;
}

/**
 * The total monthly upkeep of a set of instances (FR-ECO-055).
 *
 * @param {Array|Map} instances
 * @param {object} [opts] { defs }
 * @returns {number} coins per month
 */
export function upkeepFor(instances, opts = {}) {
  const list = resolveInstances(instances, opts);
  let total = 0;
  for (const inst of list) total += upkeepOf(inst.def, inst.level);
  return Math.round(total);
}

/**
 * The monthly upkeep split by budget category.
 *
 * @returns {{byCategory:object, unbudgeted:number, total:number}}
 */
export function upkeepBreakdown(instances, opts = {}) {
  const list = resolveInstances(instances, opts);
  const byCategory = {};
  let unbudgeted = 0;
  for (const inst of list) {
    const amount = upkeepOf(inst.def, inst.level);
    const cat = budgetCategoryOf(inst.def);
    if (!cat) { unbudgeted += amount; continue; }
    byCategory[cat] = num(byCategory[cat], 0) + amount;
  }
  const total = Object.values(byCategory).reduce((a, b) => a + b, 0) + unbudgeted;
  return { byCategory, unbudgeted: Math.round(unbudgeted), total: Math.round(total) };
}

// ---------------------------------------------------------------------------
// Income (F4 / FR-ECO-025 … FR-ECO-038, FR-ECO-123/124)
// ---------------------------------------------------------------------------

/**
 * The base monthly income of one definition (FR-ECO-044).
 *
 * BLD owns `incomeBase`; until it authors it, the base is derived from the
 * authored capacity and the authored tax yield per resident.
 */
export function baseIncomeOf(def, level = 1, residents = null) {
  if (!def) return 0;
  const authored = num(def.incomeBase, NaN);
  if (Number.isFinite(authored)) return authored;

  const cap = capacityOf(def, level);
  switch (sectorOf(def)) {
    case 'residential': {
      // Tax yield per resident per month (TUNING.monthlyTaxPerResident).
      // `residents` is the number of residents THIS building houses — the
      // caller distributes the city population over the housing stock, so a
      // city is never taxed for more residents than it has.
      const housed = residents === null || residents === undefined
        ? cap.residents
        : Math.min(cap.residents, Math.max(0, num(residents, 0)));
      return housed * TUNING.monthlyTaxPerResident;
    }
    case 'commercial':
      return cap.workspaces * TBD_VALUES.commercialIncomePerWorkspace;
    case 'industrial':
      return cap.jobs * TBD_VALUES.industrialIncomePerJob;
    default:
      return 0;
  }
}

/**
 * The income breakdown per sector (FR-ECO-025, F4).
 *
 * @param {Array|Map} instances
 * @param {number|object|null} population total residents, or `{ residents }`
 * @param {object} [opts] { defs, taxRates, globalBonus, mapBonus, emitters }
 * @returns {{total:number, bySector:object, taxRates:object, bonuses:object}}
 */
export function incomeBreakdown(instances, population, opts = {}) {
  const list = resolveInstances(instances, opts);
  const taxRates = { ...DEFAULT_TAX_RATES, ...(opts.taxRates ?? {}) };
  const globalBonus = num(opts.globalBonus, 0);
  const mapBonus = num(opts.mapBonus, 0);
  const emitters = opts.emitters ?? list.filter((i) => isBonusEmitter(i.def));
  const emitterIndex = indexEmitters(emitters);

  const cityResidents = population === null || population === undefined
    ? null
    : num(typeof population === 'object' ? population.residents : population, 0);

  // The city population is spread over the housing stock in proportion to
  // each building's capacity, so the residential sector is taxed for the
  // residents that actually live in it — never for more.
  let residentialCapacity = 0;
  for (const inst of list) {
    if (sectorOf(inst.def) !== 'residential') continue;
    residentialCapacity += capacityOf(inst.def, inst.level).residents;
  }
  const housedResidents = cityResidents === null
    ? null
    : Math.min(Math.max(0, cityResidents), residentialCapacity);
  const residentShare = (housedResidents !== null && residentialCapacity > 0)
    ? housedResidents / residentialCapacity
    : 1;

  const bySector = { residential: 0, commercial: 0, industrial: 0 };
  const contributions = { global: 0, map: 0, local: 0 };

  for (const inst of list) {
    const sector = sectorOf(inst.def);
    if (!sector) continue;
    const housed = sector === 'residential'
      ? capacityOf(inst.def, inst.level).residents * residentShare
      : null;
    const base = baseIncomeOf(inst.def, inst.level, housed);
    if (base <= 0) continue;

    const rate = num(taxRates[sector], 1);
    const local = localBonusesFor(emitters, inst.def, inst.x, inst.z, emitterIndex).magnitude;

    const afterTax = base * rate;
    const withGlobal = afterTax * (1 + globalBonus);
    const withMap = withGlobal * (1 + mapBonus);
    const withLocal = withMap * (1 + local);

    bySector[sector] += withLocal;
    contributions.global += (withGlobal - afterTax);
    contributions.map += (withMap - withGlobal);
    contributions.local += (withLocal - withMap);
  }

  for (const key of SECTORS) bySector[key] = Math.round(bySector[key]);
  const total = SECTORS.reduce((a, s) => a + bySector[s], 0);

  return {
    total: Math.round(total),
    bySector,
    taxRates,
    bonuses: {
      global: globalBonus,
      map: mapBonus,
      local: Math.round(contributions.local * 100) / 100,
      contributions,
    },
  };
}

/**
 * The total monthly income (F4).
 *
 * @param {Array|Map} instances
 * @param {number|object|null} population
 * @param {object} [opts] see {@link incomeBreakdown}
 * @returns {number} coins per month
 */
export function incomeFor(instances, population, opts = {}) {
  return incomeBreakdown(instances, population, opts).total;
}

// ---------------------------------------------------------------------------
// Budget (FR-ECO-125)
// ---------------------------------------------------------------------------

/** Normalise a budget map to `{ category: rate }` with rates in 0..1. */
export function normaliseBudgetMap(map) {
  const out = {};
  for (const cat of BUDGET_CATEGORIES) out[cat] = 1;
  if (map && typeof map === 'object') {
    for (const [key, value] of Object.entries(map)) {
      out[key] = clamp(value, 0, 1);
    }
  }
  return out;
}

/**
 * What a budget map does to a spend request (FR-ECO-121 / FR-ECO-125).
 *
 * A rate of 1 funds a category fully, 0 funds it not at all.
 *
 * @param {object} map    `{ category: rate }`
 * @param {object|number} spend requested spend per category (or one total)
 * @returns {{byCategory:object, totalRequested:number, totalEffective:number, totalCut:number}}
 */
export function budgetImpact(map, spend) {
  const rates = normaliseBudgetMap(map);
  const entries = typeof spend === 'number'
    ? [['default', spend]]
    : Object.entries(spend ?? {});

  const byCategory = {};
  let totalRequested = 0;
  let totalEffective = 0;

  for (const [cat, amount] of entries) {
    const requested = Math.max(0, num(amount, 0));
    const rate = rates[cat] ?? rates.default ?? 1;
    const effective = Math.round(requested * rate);
    byCategory[cat] = { requested, rate, effective, cut: requested - effective };
    totalRequested += requested;
    totalEffective += effective;
  }

  return {
    byCategory,
    totalRequested: Math.round(totalRequested),
    totalEffective: Math.round(totalEffective),
    totalCut: Math.round(totalRequested - totalEffective),
  };
}

// ---------------------------------------------------------------------------
// Bars (FR-ECO-058 … FR-ECO-074, F1/F2/F3)
// ---------------------------------------------------------------------------

/**
 * The DEMAND bar of one sector (FR-ECO-061/062, F3).
 *
 * The dossier's formula is `demandFill = unmetDemand / capacity`, clamped to
 * 0..1, so the bar is empty exactly when the sector is covered (FR-ECO-062)
 * and full when the shortfall reaches a whole capacity (FR-ECO-061).
 *
 * `demand` is the sector's TOTAL wanted demand; the shortfall is derived
 * here, so the bar has exactly one definition (FR-ECO-071).
 *
 * @param {number} capacity what the city provides
 * @param {number} demand   what the city wants
 * @returns {{capacity:number,demand:number,unmet:number,fill:number,saturated:boolean,covered:boolean}}
 */
export function demandBar(capacity, demand) {
  const cap = Math.max(0, num(capacity, 0));
  const dem = Math.max(0, num(demand, 0));
  const unmet = Math.max(0, dem - cap);
  const fill = cap > 0 ? clamp(unmet / cap, 0, 1) : (dem > 0 ? 1 : 0);
  return {
    capacity: cap,
    demand: dem,
    unmet,
    fill,
    saturated: fill >= 1,
    covered: unmet === 0,
  };
}

/**
 * The DEMAND bar when the caller already holds the UNMET demand.
 *
 * @param {number} capacity
 * @param {number} unmet
 */
export function demandBarFromUnmet(capacity, unmet) {
  const cap = Math.max(0, num(capacity, 0));
  const short = Math.max(0, num(unmet, 0));
  const fill = cap > 0 ? clamp(short / cap, 0, 1) : (short > 0 ? 1 : 0);
  return {
    capacity: cap,
    demand: cap + short,
    unmet: short,
    fill,
    saturated: fill >= 1,
    covered: short === 0,
  };
}

/**
 * The growth factor of one usage percentage (F2).
 *
 * The published constraints are:
 *   g(u) = 1.0            for u < 90
 *   0 < g(u) < 1.0        for 90 <= u < 100
 *   g(100) = 0
 * The shape BETWEEN the thresholds is a design decision (OQ-ECO-10); this
 * implementation is a smoothstep below a jump at exactly 90 %, which honours
 * every published constraint (a plain `(100-u)/10` is excluded because it
 * would give g(90) = 1.0).
 */
export function growthFactor(usagePct) {
  const u = num(usagePct, 0);
  if (!Number.isFinite(u) || u < 90) return 1;
  if (u >= 100) return 0;
  const t = (u - 90) / 10;
  const smooth = t * t * (3 - 2 * t);
  const jump = TBD_VALUES.growthPenaltyJump;
  return Math.max(0, Math.min(1, jump * (1 - smooth)));
}

/**
 * The USAGE bar of one channel (FR-ECO-063, F1).
 *
 * `usagePct = consumption / production * 100`, with the published edge cases:
 * no supply but consumption -> 100 % (not a division by zero), no
 * consumption -> 0 %.
 *
 * @param {number} production the available supply
 * @param {number} consumption what is used
 */
export function usageBar(production, consumption) {
  const p = Math.max(0, num(production, 0));
  const c = Math.max(0, num(consumption, 0));
  let pct;
  if (p <= 0) pct = c > 0 ? 100 : 0;
  else pct = (c / p) * 100;
  return {
    production: p,
    consumption: c,
    pct: Math.round(pct * 1000) / 1000,
    fill: clamp(pct / 100, 0, 1),
    growthFactor: growthFactor(pct),
    saturated: pct >= 100,
    shortfall: p > 0 ? Math.max(0, c - p) : c,
  };
}

// ---------------------------------------------------------------------------
// Ledger (FR-ECO-125)
// ---------------------------------------------------------------------------

/**
 * Append one entry to the period ledger, keeping the newest `limit` entries.
 *
 * Pure: the input array is never mutated, a new array is returned.
 *
 * @param {Array} ledger
 * @param {object} entry
 * @param {number} [limit]
 * @returns {Array} the new ledger
 */
export function applyLedger(ledger, entry, limit = TBD_VALUES.ledgerLimit) {
  const cap = Math.max(1, Math.floor(num(limit, TBD_VALUES.ledgerLimit)));
  const list = Array.isArray(ledger) ? ledger.slice() : [];
  list.push(entry);
  while (list.length > cap) list.shift();
  return list;
}

// ---------------------------------------------------------------------------
// Chains (FR-ECO-081 … FR-ECO-099, F6 / F7)
// ---------------------------------------------------------------------------

/**
 * Resolve the production and consumption chains (FR-ECO-081 … FR-ECO-099).
 *
 * The food chain is resolved as DATA (F6):
 *   fields            -> plant food
 *   animal enclosures : consume plant food, produce animal food
 *   food industry     : consumes plant AND animal food, produces processed food
 * The pole barn gates fields and enclosures (FR-ECO-098) and the food area
 * bonuses never touch an industrial food plant (FR-ECO-092).
 *
 * @param {Array|Map} instances
 * @param {object} [opts] { defs, emitters, gates }
 */
export function resolveChains(instances, opts = {}) {
  const list = resolveInstances(instances, opts);
  const emitters = opts.emitters ?? list.filter((i) => isBonusEmitter(i.def));
  const emitterIndex = indexEmitters(emitters);
  const gates = opts.gates ?? list.filter((i) => isGateEmitter(i.def));

  const energy = { production: 0, green: 0, nonGreen: 0, consumption: 0 };
  const water = { production: 0, consumption: 0 };
  const waste = {
    produced: 0,
    removed: 0,
    byCategory: { residential: 0, commercial: 0, industrial: 0, government: 0, farms: 0, other: 0 },
  };

  let plantCapacity = 0;
  let animalCapacity = 0;
  let processedCapacity = 0;
  let animalPlantDemand = 0;
  let processedFoodDemand = 0;
  let residentFoodDemand = 0;
  let gatedPlant = 0;
  let gatedAnimal = 0;

  for (const inst of list) {
    const def = inst.def;
    const bonus = 1 + localProductionBonusFor(emitters, def, inst.x, inst.z, emitterIndex);
    // The pole-barn gate is a FOOD rule (FR-ECO-098): it never silences an
    // energy or a water producer.
    const gated = def?.[CHAIN_DEFS.food.gateFlag]
      ? !gates.some((g) => coversArea(g, inst.x, inst.z)
        && (g.def?.bonusArea?.targets ?? []).includes(bonusTargetKeyOf(def)))
      : false;

    // --- energy (FR-ECO-082/083) ---
    const e = num(def?.production?.energy, 0);
    if (e > 0) {
      const value = e * bonus;
      energy.production += value;
      if (def?.greenEnergy) energy.green += value;
      else energy.nonGreen += value;
    }
    energy.consumption += num(def?.consumption?.energy, 0);

    // --- water (FR-ECO-084/085) ---
    const w = num(def?.production?.water, 0);
    water.production += w * bonus;
    water.consumption += num(def?.consumption?.water, 0);

    // --- waste (FR-ECO-093/095, F7) ---
    const produced = num(def?.wasteProduction, num(def?.consumption?.waste, 0));
    waste.produced += produced;
    const wc = wasteCategoryOf(def);
    waste.byCategory[wc] = num(waste.byCategory[wc], 0) + produced;
    waste.removed += num(def?.production?.wasteRemoval, 0);

    // --- food (FR-ECO-086 … FR-ECO-092, F6) ---
    const tier = foodTierOf(def);
    const prod = def?.production?.food ?? {};
    if (tier === 'plant') {
      if (gated) gatedPlant += 1;
      else plantCapacity += num(prod.plant, 0) * bonus;
    } else if (tier === 'animal') {
      if (gated) gatedAnimal += 1;
      else animalCapacity += num(prod.animal, 0) * bonus;
    } else if (tier === 'processed') {
      // FR-ECO-092: no food area bonus reaches an industrial food plant.
      processedCapacity += num(prod.processed, 0) * bonus;
    }

    const foodConsumption = num(def?.consumption?.food, 0);
    if (tier === 'animal') animalPlantDemand += foodConsumption;
    else if (tier === 'processed') processedFoodDemand += foodConsumption;
    else residentFoodDemand += foodConsumption;
  }

  // --- the food chain (F6) ---
  const plantToAnimals = Math.min(plantCapacity, animalPlantDemand);
  const animalFactor = animalPlantDemand > 0 ? plantToAnimals / animalPlantDemand : 1;
  const animalProduction = animalCapacity * animalFactor;

  const plantShare = clamp(TBD_VALUES.processedPlantShare, 0, 1);
  const processedPlantNeed = processedFoodDemand * plantShare;
  const processedAnimalNeed = processedFoodDemand * (1 - plantShare);

  const plantLeft = Math.max(0, plantCapacity - plantToAnimals);
  const animalLeft = animalProduction;

  const plantServedToProcessed = Math.min(plantLeft, processedPlantNeed);
  const animalServedToProcessed = Math.min(animalLeft, processedAnimalNeed);

  const processedFactor = processedFoodDemand > 0
    ? Math.min(
      processedPlantNeed > 0 ? plantServedToProcessed / processedPlantNeed : 1,
      processedAnimalNeed > 0 ? animalServedToProcessed / processedAnimalNeed : 1,
    )
    : 1;
  const processedProduction = processedCapacity * processedFactor;

  const foodProduction = {
    plant: plantCapacity,
    animal: animalProduction,
    processed: processedProduction,
  };
  const foodProductionTotal = foodProduction.plant + foodProduction.animal + foodProduction.processed;

  // What is left for the residents, and what they actually eat.
  const available = {
    plant: Math.max(0, plantLeft - plantServedToProcessed),
    animal: Math.max(0, animalLeft - animalServedToProcessed),
    processed: processedProduction,
  };
  const availableTotal = available.plant + available.animal + available.processed;
  const eaten = Math.min(residentFoodDemand, availableTotal);

  const quota = { plant: 0, animal: 0, processed: 0 };
  if (eaten > 0 && availableTotal > 0) {
    quota.plant = (available.plant / availableTotal) * eaten;
    quota.animal = (available.animal / availableTotal) * eaten;
    quota.processed = (available.processed / availableTotal) * eaten;
  }

  const chainConsumption = {
    plant: plantToAnimals + plantServedToProcessed,
    animal: animalServedToProcessed,
    processed: 0,
  };
  const residentConsumption = quota;
  const foodConsumptionTotal = chainConsumption.plant + chainConsumption.animal
    + residentConsumption.plant + residentConsumption.animal + residentConsumption.processed;

  const quotaType = eaten <= 0 ? 'none'
    : (residentConsumption.processed >= residentConsumption.plant
      && residentConsumption.processed >= residentConsumption.animal ? 'processed'
      : (residentConsumption.animal >= residentConsumption.plant ? 'animal' : 'plant'));

  const foodUsage = usageBar(foodProductionTotal, foodConsumptionTotal);
  const energyUsage = usageBar(energy.production, energy.consumption);
  const waterUsage = usageBar(water.production, water.consumption);
  // OQ-ECO-12: the waste bar is the REMOVAL utilisation — 100 % means the
  // waste is exactly balanced, above 100 % means a shortage.
  const wasteUsage = usageBar(waste.removed, waste.produced);

  return {
    energy: {
      production: energy.production,
      green: energy.green,
      nonGreen: energy.nonGreen,
      consumption: energy.consumption,
      usage: energyUsage,
    },
    water: {
      production: water.production,
      consumption: water.consumption,
      usage: waterUsage,
    },
    food: {
      production: foodProduction,
      productionTotal: foodProductionTotal,
      consumption: {
        chain: chainConsumption,
        residents: residentConsumption,
        total: foodConsumptionTotal,
      },
      quota,
      quotaType,
      shortfall: Math.max(0, residentFoodDemand - eaten),
      gated: { plant: gatedPlant, animal: gatedAnimal },
      usage: foodUsage,
    },
    waste: {
      produced: waste.produced,
      removed: waste.removed,
      byCategory: waste.byCategory,
      usage: wasteUsage,
    },
    /** The city-wide growth factor: the worst of the four channels. */
    growthFactor: Math.min(
      energyUsage.growthFactor,
      waterUsage.growthFactor,
      foodUsage.growthFactor,
      wasteUsage.growthFactor,
    ),
  };
}

/**
 * Which connected-economy pools the current map belongs to (F8).
 *
 * Membership is per map and the pool is region-wide; a map without the
 * connector keeps its own local figures (FR-ECO-108).
 *
 * @param {Array|Map} instances
 * @param {object} [opts] { defs, mapId }
 */
export function poolMembership(instances, opts = {}) {
  const list = resolveInstances(instances, opts);
  const mapId = opts.mapId ?? 'current';
  const pools = {};
  for (const [id, def] of Object.entries(POOL_DEFS)) {
    const members = list
      .filter((i) => def.emitters.includes(i.def?.id))
      .map((i) => i.id ?? i.def?.id);
    pools[id] = {
      id,
      label: def.label,
      channels: def.channels,
      member: members.length > 0,
      members,
      mapId,
      /** The globe icon (FR-ECO-106) is shown only for a member map. */
      globe: members.length > 0,
    };
  }
  return pools;
}
