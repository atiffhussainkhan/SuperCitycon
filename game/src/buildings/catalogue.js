/**
 * buildings/catalogue.js — the building catalogue DATA TABLE.
 *
 * OWNER: BLD. Pure data + pure lookups. This module MUST NOT import `three`
 * so it can be unit-tested in Node (see buildings.test.mjs).
 *
 * ---------------------------------------------------------------------------
 * HONESTY RULES ENFORCED HERE
 * ---------------------------------------------------------------------------
 * 1. Every entry that points at art points at a key that REALLY EXISTS in
 *    src/data/manifest.json. `MODEL_KEYS` below is the authoritative list of
 *    the 128 manifest model keys; `buildings.test.mjs` asserts that
 *    MODEL_KEYS is exactly `Object.keys(manifest.models)`.
 * 2. Entries whose art does not exist in the library are shipped with
 *    `available: false` and `model: null`. They still appear in the shop UI
 *    as locked / coming-soon entries (FR-BLD-057), they are never pointed at
 *    a non-existent model.
 * 3. The catalogue size is DERIVED at runtime (`catalogueSize()`), never a
 *    hard-coded marketing string (FR-BLD-002 / FR-BLD-008).
 *
 * The publisher ships "300+ unique structures"; this build has exactly 128
 * models, so the catalogue is the honest intersection of the published
 * taxonomy and the art that actually exists. FR-BLD-003 (>= 300 entries) is
 * therefore NOT met by this build - see the final report.
 *
 * ---------------------------------------------------------------------------
 * TUNING / PROPOSED VALUES
 * ---------------------------------------------------------------------------
 * The shared knobs live in core/config.js `TUNING`:
 *   TUNING.baseBuildCost          base price of a 1x1 residential plot
 *   TUNING.demolishRefundRate     share of the build cost refunded on bulldoze
 *   TUNING.maxLevels              residential levels per building
 *   TUNING.maxServiceLevels       service levels per building
 *   TUNING.residentsPerLevel1     residents in a level-1 house
 *   TUNING.residentsPerUpgrade    residents added per residential level
 *   TUNING.serviceCostMultiplier  construction cost multiplier per service tier
 *   TUNING.baseServiceRadius      service coverage radius, level 1 (world u)
 *   TUNING.serviceRadiusPerLevel  service radius growth per level (world u)
 *
 * EVERY per-entry numeric value in this file (capacities, production,
 * consumption, points, wealth, pollution, noise, traffic, unlock levels,
 * cost multipliers) is AUTHORED DATA: the publisher published none of them.
 * They are listed in `TBD_VALUES` below, which is surfaced the same way
 * core/config.js surfaces its own unresolved numbers.
 *
 * The values that would change whole subsystems if they are wrong are
 * marked `// TBD:` inline, at the point of use.
 */

import { TUNING, CELL } from '../core/config.js';

// ---------------------------------------------------------------------------
// Manifest model keys — the ONLY art this game may place.
// Mirrors src/data/manifest.json `models` (128 keys, 3 families).
// Verified by buildings.test.mjs against the real manifest.
// ---------------------------------------------------------------------------
export const MODEL_KEYS = Object.freeze([
  'Bridge',
  'Cafe',
  'Clinic',
  'Depot',
  'Factory',
  'Farm',
  'Ferry',
  'Fire',
  'Garage',
  'General-Store',
  'Hall',
  'Lighthouse',
  'Market',
  'Pier',
  'Pump',
  'Restaurant',
  'Shop',
  'Station',
  'Storage',
  'Tank',
  'Tower',
  'Warehouse',
  'Water-Tower',
  'base',
  'bench',
  'box_A',
  'box_B',
  'building_A',
  'building_A_withoutBase',
  'building_B',
  'building_B_withoutBase',
  'building_C',
  'building_C_withoutBase',
  'building_D',
  'building_D_withoutBase',
  'building_E',
  'building_E_withoutBase',
  'building_F',
  'building_F_withoutBase',
  'building_G',
  'building_G_withoutBase',
  'building_H',
  'building_H_withoutBase',
  'bush',
  'car_hatchback',
  'car_police',
  'car_sedan',
  'car_stationwagon',
  'car_taxi',
  'cargo',
  'dumpster',
  'firehydrant',
  'mdvl_nature_bank_01',
  'mdvl_nature_birch_01',
  'mdvl_nature_boulder_01',
  'mdvl_nature_bridge_plank_01',
  'mdvl_nature_bush_01',
  'mdvl_nature_cave_01',
  'mdvl_nature_cliff_01',
  'mdvl_nature_cliff_02',
  'mdvl_nature_cliff_03',
  'mdvl_nature_cliff_corner_01',
  'mdvl_nature_cobble_01',
  'mdvl_nature_deadtree_01',
  'mdvl_nature_fern_01',
  'mdvl_nature_flowers_01',
  'mdvl_nature_grass_01',
  'mdvl_nature_ivy_01',
  'mdvl_nature_kerb_01',
  'mdvl_nature_lilypad_01',
  'mdvl_nature_log_01',
  'mdvl_nature_mound_01',
  'mdvl_nature_mushrooms_01',
  'mdvl_nature_oak_01',
  'mdvl_nature_oak_sapling_01',
  'mdvl_nature_path_corner_01',
  'mdvl_nature_path_dirt_01',
  'mdvl_nature_path_end_01',
  'mdvl_nature_paving_01',
  'mdvl_nature_pebbles_01',
  'mdvl_nature_pine_01',
  'mdvl_nature_pine_sapling_01',
  'mdvl_nature_riverbed_01',
  'mdvl_nature_rock_mossy_01',
  'mdvl_nature_rocks_01',
  'mdvl_nature_ruts_01',
  'mdvl_nature_slab_01',
  'mdvl_nature_steppingstones_01',
  'mdvl_nature_steps_dirt_01',
  'mdvl_nature_streamrock_01',
  'mdvl_nature_stump_01',
  'mdvl_nature_walkway_01',
  'mdvl_nature_worn_01',
  'office',
  'power_coal',
  'power_nuclear',
  'power_solar',
  'power_wind',
  'residential_large',
  'residential_medium',
  'residential_small',
  'road_corner',
  'road_corner_curved',
  'road_junction',
  'road_straight',
  'road_straight_crossing',
  'road_tsplit',
  'service_clinic',
  'service_fire',
  'service_museum',
  'service_park',
  'service_utility',
  'service_waste',
  'service_water',
  'shop_cloth',
  'shop_food',
  'shop_grocery',
  'streetlight',
  'trafficlight_A',
  'trafficlight_B',
  'trafficlight_C',
  'transit_air',
  'transit_harbor',
  'transit_train',
  'trash_A',
  'trash_B',
  'water_supply',
  'watertower',
]);

// ---------------------------------------------------------------------------
// Shop categories — dossier §3.2 (15 categories).
// The waste tab sits at the LOWER end of the list, matching the game's own
// shop order (QA-BLD-004: "the waste category sits at the lower end").
// ---------------------------------------------------------------------------
export const CATEGORIES = Object.freeze([
  Object.freeze({ id: 'residential', label: 'Residential', order: 1 }),
  Object.freeze({ id: 'commercial', label: 'Commercial', order: 2 }),
  Object.freeze({ id: 'industrial', label: 'Industrial', order: 3 }),
  Object.freeze({ id: 'energy', label: 'Energy', order: 4 }),
  Object.freeze({ id: 'water', label: 'Water', order: 5 }),
  Object.freeze({ id: 'food', label: 'Food & Agriculture', order: 6 }),
  Object.freeze({ id: 'health', label: 'Health Care', order: 7 }),
  Object.freeze({ id: 'police', label: 'Police & Security', order: 8 }),
  Object.freeze({ id: 'fire', label: 'Fire', order: 9 }),
  Object.freeze({ id: 'education', label: 'Education', order: 10 }),
  Object.freeze({ id: 'transit', label: 'Transit', order: 11 }),
  Object.freeze({ id: 'parks', label: 'Parks & Leisure', order: 12 }),
  Object.freeze({ id: 'decoration', label: 'Decoration', order: 13 }),
  Object.freeze({ id: 'infrastructure', label: 'Infrastructure', order: 14 }),
  Object.freeze({ id: 'waste', label: 'Waste', order: 15 }),
  Object.freeze({ id: 'special', label: 'Special / City Upgrades', order: 16 }),
]);

const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

/** Archetype vocabulary — dossier §4.2. Selects which property groups matter. */
export const ARCHETYPES = Object.freeze([
  'consumer', 'producer', 'service', 'bonus', 'connector', 'decoration', 'special',
]);

// ---------------------------------------------------------------------------
// Authoring helpers
// ---------------------------------------------------------------------------

/**
 * A service tier ladder: capacity grows 25 % per level, coverage radius grows
 * by TUNING.serviceRadiusPerLevel (2 world tiles) per level.
 * TBD: the per-tier numbers are unpublished (OQ-BLD-13). The shape follows
 * the dossier's stated growth rules; the absolute values are proposed.
 */
function serviceTiers(count, capacity, radiusTiles) {
  const out = [];
  for (let level = 1; level <= count; level += 1) {
    out.push({
      level,
      capacity: {
        residents: 0,
        workspaces: 0,
        jobs: 0,
        served: Math.round(capacity * Math.pow(1.25, level - 1)),
      },
      coverage: {
        radiusTiles: radiusTiles + (level - 1) * (TUNING.serviceRadiusPerLevel / CELL),
        capacity: Math.round(capacity * Math.pow(1.25, level - 1)),
        shape: 'circle',
      },
    });
  }
  return out;
}

/**
 * A residential tier ladder: +TUNING.residentsPerUpgrade residents per level.
 * TBD: the base numbers are unpublished (OQ-BLD-04).
 */
function residentialTiers(count, baseResidents) {
  const out = [];
  for (let level = 1; level <= count; level += 1) {
    out.push({
      level,
      capacity: {
        residents: baseResidents + (level - 1) * TUNING.residentsPerUpgrade,
        workspaces: 0,
        jobs: 0,
      },
      coverage: null,
    });
  }
  return out;
}

/** Default single-tier ladder for everything that is not upgradeable. */
function singleTier(o) {
  return [{
    level: 1,
    capacity: {
      residents: o.residentialCapacity ?? 0,
      workspaces: o.workspaceCapacity ?? 0,
      jobs: o.jobCapacity ?? 0,
      served: o.coverageCapacity ?? 0,
    },
    coverage: o.coverageRadiusTiles
      ? {
        radiusTiles: o.coverageRadiusTiles,
        capacity: o.coverageCapacity ?? 0,
        shape: o.coverageShape ?? 'circle',
      }
      : null,
  }];
}

/**
 * Normalise one authored record into the full property schema of dossier
 * §3.3 / §6. Every key is present on every entry (QA-BLD-003), so the shop
 * card, the placement code and the simulation can read any field blindly.
 */
function def(o) {
  const available = o.available !== false;
  const model = available ? (o.model ?? null) : null;
  const footprintCells = o.footprintCells ?? [1, 1];
  const maxLevels = o.maxLevels ?? 1;
  const tiers = o.tiers ?? singleTier(o);

  const points = {
    culture: o.points?.culture ?? 0,
    entertainment: o.points?.entertainment ?? 0,
    recreation: o.points?.recreation ?? 0,
  };

  const production = {
    energy: o.production?.energy ?? 0,
    water: o.production?.water ?? 0,
    food: {
      plant: o.production?.food?.plant ?? 0,
      animal: o.production?.food?.animal ?? 0,
      processed: o.production?.food?.processed ?? 0,
    },
    wasteRemoval: o.production?.wasteRemoval ?? 0,
  };

  const consumption = {
    energy: o.consumption?.energy ?? 0,
    water: o.consumption?.water ?? 0,
    food: o.consumption?.food ?? 0,
    waste: o.consumption?.waste ?? 0,
  };

  const tier1 = tiers[0];
  const capacity = {
    residents: tier1?.capacity?.residents ?? 0,
    workspaces: tier1?.capacity?.workspaces ?? 0,
    jobs: tier1?.capacity?.jobs ?? 0,
    served: tier1?.capacity?.served ?? 0,
  };

  const coverage = tier1?.coverage ?? null;

  const costInputs = {
    base: o.costInputs?.base ?? 1,
    perCell: o.costInputs?.perCell ?? 0.35,
    perLevel: o.costInputs?.perLevel ?? 0.5,
  };

  const unlock = {
    kind: o.unlock?.kind ?? 'level',
    level: o.unlock?.level ?? 1,
    packId: o.unlock?.packId ?? null,
    eventId: o.unlock?.eventId ?? null,
    window: o.unlock?.window ?? null,
  };

  const contentPack = {
    packId: o.contentPack?.packId ?? 'base',
    packVersion: o.contentPack?.packVersion ?? 1,
    packKind: o.contentPack?.packKind ?? 'base',
  };

  return Object.freeze({
    // --- identity -------------------------------------------------------
    id: o.id,
    displayName: o.displayName,
    description: o.description ?? '',
    category: o.category,
    archetype: o.archetype ?? 'consumer',
    available,
    // --- art ------------------------------------------------------------
    model,
    modelFamily: o.modelFamily ?? null,
    appearance: Object.freeze({
      modelId: model,
      styleId: o.appearance?.styleId ?? (o.modelFamily ?? 'library'),
      paletteId: o.appearance?.paletteId ?? 'retro16',
    }),
    variants: Object.freeze([...(o.variants ?? [])]),
    // --- footprint / rotation ------------------------------------------
    footprintCells: Object.freeze([footprintCells[0], footprintCells[1]]),
    rotationStates: 4,
    // --- levels ---------------------------------------------------------
    maxLevels,
    tierLadder: Object.freeze(tiers.map((t) => Object.freeze({
      level: t.level,
      capacity: Object.freeze({ ...t.capacity }),
      coverage: t.coverage ? Object.freeze({ ...t.coverage }) : null,
    }))),
    // --- economy --------------------------------------------------------
    costInputs: Object.freeze({ ...costInputs }),
    upkeep: o.upkeep ?? 0,
    upkeepPerUnit: o.upkeepPerUnit ?? false,
    // --- capacity -------------------------------------------------------
    capacity: Object.freeze({ ...capacity }),
    // --- production / consumption ---------------------------------------
    production: Object.freeze({
      energy: production.energy,
      water: production.water,
      food: Object.freeze({ ...production.food }),
      wasteRemoval: production.wasteRemoval,
    }),
    consumption: Object.freeze({ ...consumption }),
    /**
     * Waste this entry CREATES (dossier §6: "wasteProduction / wasteRemoval").
     * Authored as `consumption.waste`; exposed as its own field so the
     * waste channel can be read the way the dossier names it.
     */
    wasteProduction: consumption.waste,
    // --- service --------------------------------------------------------
    serviceProvided: o.serviceProvided ?? null,
    coverage: coverage ? Object.freeze({ ...coverage }) : null,
    coverageRadius: coverage ? coverage.radiusTiles * CELL : 0,
    // --- growth bonus points --------------------------------------------
    points: Object.freeze({ ...points }),
    /**
     * A `unique` entry contributes its points ONCE per map however many
     * copies are placed; a stackable entry contributes once per copy
     * (FR-BLD-033 / FR-BLD-103). The two flags are therefore exclusive.
     */
    unique: o.unique ?? false,
    stackable: o.unique ? false : (o.stackable ?? true),
    wealthLevel: o.wealthLevel ?? null,
    // --- environment ----------------------------------------------------
    pollution: o.pollution ?? 0,
    noise: o.noise ?? 0,
    greenEnergy: o.greenEnergy ?? false,
    trafficGeneration: o.trafficGeneration ?? 0,
    pedestrianGeneration: o.pedestrianGeneration ?? 0,
    // --- placement ------------------------------------------------------
    constructionSlots: o.constructionSlots ?? 1,
    requiresRoadConnection: o.requiresRoadConnection ?? false,
    /**
     * `null` for an ordinary building, `'road'` for a road tile.
     *
     * A road tile is NOT an ordinary building: MOB owns the road graph and
     * places the road model (it picks the straight / corner / junction
     * variant from the network topology). The buildings domain therefore
     * routes a road entry through `mobility.addRoad()` instead of placing a
     * model of its own - that is what keeps the two domains from drawing two
     * road models on the same cell.
     */
    infrastructure: o.infrastructure ?? null,
    bonusArea: o.bonusArea
      ? Object.freeze({
        radiusTiles: o.bonusArea.radiusTiles,
        /**
         * What the bonus affects: a category ('residential', 'education') or
         * a production channel ('food.plant', 'food.animal'). Processed and
         * industrial food production is deliberately NOT targeted - dossier
         * §7.7: bonus buildings do not affect industrial food production.
         */
        targets: Object.freeze([...(o.bonusArea.targets ?? [])]),
      })
      : null,
    requiresPoleBarnCoverage: o.requiresPoleBarnCoverage ?? false,
    zoned: o.zoned ?? false,
    zoneId: o.zoneId ?? null,
    /** Special entries that grant a permanent construction slot when placed. */
    grantsConstructionSlot: o.grantsConstructionSlot ?? false,
    // --- progression ----------------------------------------------------
    unlock: Object.freeze({ ...unlock }),
    unlockStage: o.unlockStage ?? 'stage-1',
    contentPack: Object.freeze({ ...contentPack }),
    schemaVersion: 1,
  });
}

// ---------------------------------------------------------------------------
// THE CATALOGUE
// ---------------------------------------------------------------------------

export const BUILDING_DEFS = Object.freeze([

  // =========================================================================
  // RESIDENTIAL — dossier §4.1: house -> apartment -> luxury apartment ->
  // skyscraper (FR-BLD-011). The eight KayKit city buildings fill out the
  // ladder with further residential archetypes.
  // =========================================================================
  def({
    id: 'res.house',
    displayName: 'House',
    description: 'A small starter home. Cheap, cheerful, and the first roof on the block.',
    category: 'residential',
    archetype: 'consumer',
    model: 'residential_small',
    modelFamily: 'props',
    footprintCells: [1, 1],
    maxLevels: TUNING.maxLevels,
    tiers: residentialTiers(TUNING.maxLevels, TUNING.residentsPerLevel1),
    residentialCapacity: TUNING.residentsPerLevel1,
    consumption: { energy: 1, water: 1, food: 1, waste: 1 },
    points: { culture: 1 },
    wealthLevel: 1,
    trafficGeneration: 1,
    pedestrianGeneration: 1,
    requiresRoadConnection: true,
    upkeepPerUnit: true,
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'res.apartment',
    displayName: 'Apartment',
    description: 'A mid-rise block that houses far more residents than a house.',
    category: 'residential',
    archetype: 'consumer',
    model: 'residential_medium',
    modelFamily: 'props',
    footprintCells: [2, 2],
    maxLevels: TUNING.maxLevels,
    tiers: residentialTiers(TUNING.maxLevels, 16), // TBD: base residents (OQ-BLD-04)
    residentialCapacity: 16,
    consumption: { energy: 4, water: 3, food: 3, waste: 3 },
    points: { culture: 2 },
    wealthLevel: 1,
    trafficGeneration: 2,
    pedestrianGeneration: 3,
    requiresRoadConnection: true,
    upkeepPerUnit: true,
    unlock: { kind: 'level', level: 2 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'res.luxury_apartment',
    displayName: 'Luxury Apartment',
    description: 'A premium tower block for residents who like their view.',
    category: 'residential',
    archetype: 'consumer',
    model: 'residential_large',
    modelFamily: 'props',
    footprintCells: [1, 1],
    maxLevels: TUNING.maxLevels,
    tiers: residentialTiers(TUNING.maxLevels, 40), // TBD: base residents (OQ-BLD-04)
    residentialCapacity: 40,
    consumption: { energy: 8, water: 6, food: 5, waste: 5 },
    points: { culture: 3, recreation: 1 },
    wealthLevel: 2,
    trafficGeneration: 3,
    pedestrianGeneration: 3,
    requiresRoadConnection: true,
    upkeepPerUnit: true,
    unlock: { kind: 'level', level: 4 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'res.terrace_house',
    displayName: 'Terrace House',
    description: 'A narrow row house. Dense housing on a single tile.',
    category: 'residential',
    archetype: 'consumer',
    model: 'building_A',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    maxLevels: TUNING.maxLevels,
    tiers: residentialTiers(TUNING.maxLevels, 6),
    residentialCapacity: 6,
    consumption: { energy: 1, water: 1, food: 1, waste: 1 },
    points: { culture: 1 },
    wealthLevel: 1,
    trafficGeneration: 1,
    pedestrianGeneration: 2,
    requiresRoadConnection: true,
    upkeepPerUnit: true,
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'res.semi_detached',
    displayName: 'Semi-Detached House',
    description: 'Two homes sharing one wall. Twice the neighbours.',
    category: 'residential',
    archetype: 'consumer',
    model: 'building_B',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    maxLevels: TUNING.maxLevels,
    tiers: residentialTiers(TUNING.maxLevels, 8),
    residentialCapacity: 8,
    consumption: { energy: 2, water: 1, food: 1, waste: 1 },
    points: { culture: 1 },
    wealthLevel: 1,
    trafficGeneration: 1,
    pedestrianGeneration: 2,
    requiresRoadConnection: true,
    upkeepPerUnit: true,
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'res.low_rise_flats',
    displayName: 'Low-Rise Flats',
    description: 'A friendly three-storey walk-up.',
    category: 'residential',
    archetype: 'consumer',
    model: 'building_E',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    maxLevels: TUNING.maxLevels,
    tiers: residentialTiers(TUNING.maxLevels, 12),
    residentialCapacity: 12,
    consumption: { energy: 3, water: 2, food: 2, waste: 2 },
    points: { culture: 1 },
    wealthLevel: 1,
    trafficGeneration: 2,
    pedestrianGeneration: 2,
    requiresRoadConnection: true,
    upkeepPerUnit: true,
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'res.mid_rise_flats',
    displayName: 'Mid-Rise Flats',
    description: 'The workhorse apartment block of a growing district.',
    category: 'residential',
    archetype: 'consumer',
    model: 'building_F',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    maxLevels: TUNING.maxLevels,
    tiers: residentialTiers(TUNING.maxLevels, 18),
    residentialCapacity: 18,
    consumption: { energy: 4, water: 3, food: 3, waste: 3 },
    points: { culture: 2 },
    wealthLevel: 2,
    trafficGeneration: 2,
    pedestrianGeneration: 3,
    requiresRoadConnection: true,
    upkeepPerUnit: true,
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'res.city_block',
    displayName: 'City Block Apartments',
    description: 'A full block of flats with a shared courtyard.',
    category: 'residential',
    archetype: 'consumer',
    model: 'building_D',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    maxLevels: TUNING.maxLevels,
    tiers: residentialTiers(TUNING.maxLevels, 24),
    residentialCapacity: 24,
    consumption: { energy: 5, water: 4, food: 4, waste: 4 },
    points: { culture: 2 },
    wealthLevel: 2,
    trafficGeneration: 3,
    pedestrianGeneration: 3,
    requiresRoadConnection: true,
    upkeepPerUnit: true,
    unlock: { kind: 'level', level: 5 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'res.tower_block',
    displayName: 'Tower Block',
    description: 'A residential tower. Many floors, many neighbours.',
    category: 'residential',
    archetype: 'consumer',
    model: 'building_C',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    maxLevels: TUNING.maxLevels,
    tiers: residentialTiers(TUNING.maxLevels, 36),
    residentialCapacity: 36,
    consumption: { energy: 7, water: 6, food: 5, waste: 5 },
    points: { culture: 3 },
    wealthLevel: 2,
    trafficGeneration: 3,
    pedestrianGeneration: 4,
    requiresRoadConnection: true,
    upkeepPerUnit: true,
    unlock: { kind: 'level', level: 6 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'res.high_rise_tower',
    displayName: 'High-Rise Tower',
    description: 'Glass and steel. The skyline starts here.',
    category: 'residential',
    archetype: 'consumer',
    model: 'building_G',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    maxLevels: TUNING.maxLevels,
    tiers: residentialTiers(TUNING.maxLevels, 60),
    residentialCapacity: 60,
    consumption: { energy: 10, water: 8, food: 7, waste: 7 },
    points: { culture: 4 },
    wealthLevel: 3,
    trafficGeneration: 4,
    pedestrianGeneration: 4,
    requiresRoadConnection: true,
    upkeepPerUnit: true,
    unlock: { kind: 'level', level: 8 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'res.skyscraper',
    displayName: 'Skyscraper',
    description: 'The tallest thing you can put on a plot. Mind the diversity penalty past eight.',
    category: 'residential',
    archetype: 'consumer',
    model: 'building_H',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    maxLevels: TUNING.maxLevels,
    tiers: residentialTiers(TUNING.maxLevels, 120), // TBD: base residents (OQ-BLD-04)
    residentialCapacity: 120,
    consumption: { energy: 16, water: 12, food: 10, waste: 10 },
    points: { culture: 5 },
    wealthLevel: 3,
    trafficGeneration: 5,
    pedestrianGeneration: 5,
    requiresRoadConnection: true,
    upkeepPerUnit: true,
    unlock: { kind: 'level', level: 10 },
    unlockStage: 'stage-4',
  }),

  // =========================================================================
  // COMMERCIAL — the game's commercial entries are named only at category
  // level in every verified source (FR-BLD-012); the names below are authored.
  // =========================================================================
  def({
    id: 'com.grocery',
    displayName: 'Grocery Store',
    description: 'Everyday food and sundries for the neighbourhood.',
    category: 'commercial',
    archetype: 'consumer',
    model: 'shop_grocery',
    modelFamily: 'props',
    footprintCells: [2, 1],
    workspaceCapacity: 6, // TBD: workspaces per entry (OQ-BLD-04)
    consumption: { energy: 3, water: 2, food: 1, waste: 2 },
    points: { entertainment: 1 },
    wealthLevel: 1,
    trafficGeneration: 2,
    pedestrianGeneration: 4,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'com.general_store',
    displayName: 'General Store',
    description: 'A bit of everything. A safe first shop for a new town.',
    category: 'commercial',
    archetype: 'consumer',
    model: 'General-Store',
    modelFamily: 'props',
    footprintCells: [2, 1],
    workspaceCapacity: 6,
    consumption: { energy: 3, water: 2, food: 1, waste: 2 },
    points: { entertainment: 1 },
    wealthLevel: 1,
    trafficGeneration: 2,
    pedestrianGeneration: 4,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'com.food_shop',
    displayName: 'Food Shop',
    description: 'Hot food, cold drinks, and a queue at lunchtime.',
    category: 'commercial',
    archetype: 'consumer',
    model: 'shop_food',
    modelFamily: 'props',
    footprintCells: [2, 2],
    workspaceCapacity: 10,
    consumption: { energy: 4, water: 3, food: 2, waste: 3 },
    points: { entertainment: 2 },
    wealthLevel: 1,
    trafficGeneration: 3,
    pedestrianGeneration: 5,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 2 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'com.clothing_boutique',
    displayName: 'Clothing Boutique',
    description: 'Tailored, charming, and the reason the wealthy move in.',
    category: 'commercial',
    archetype: 'consumer',
    model: 'shop_cloth',
    modelFamily: 'props',
    footprintCells: [2, 1],
    workspaceCapacity: 8,
    consumption: { energy: 3, water: 1, food: 1, waste: 2 },
    points: { culture: 2 },
    wealthLevel: 2,
    trafficGeneration: 2,
    pedestrianGeneration: 4,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'com.shopping_arcade',
    displayName: 'Shopping Arcade',
    description: 'A covered row of shops under one roof.',
    category: 'commercial',
    archetype: 'consumer',
    model: 'Shop',
    modelFamily: 'props',
    footprintCells: [2, 2],
    workspaceCapacity: 16,
    consumption: { energy: 6, water: 3, food: 2, waste: 4 },
    points: { culture: 2, entertainment: 3 },
    wealthLevel: 2,
    trafficGeneration: 4,
    pedestrianGeneration: 8,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 4 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'com.cafe',
    displayName: 'Cafe',
    description: 'Small, warm and always busy. Good for recreation points.',
    category: 'commercial',
    archetype: 'consumer',
    model: 'Cafe',
    modelFamily: 'props',
    footprintCells: [2, 2],
    workspaceCapacity: 8,
    consumption: { energy: 4, water: 3, food: 2, waste: 3 },
    points: { culture: 1, entertainment: 3, recreation: 1 },
    wealthLevel: 1,
    trafficGeneration: 2,
    pedestrianGeneration: 6,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'com.restaurant',
    displayName: 'Restaurant',
    description: 'Sit-down dining. The biggest entertainment draw in the district.',
    category: 'commercial',
    archetype: 'consumer',
    model: 'Restaurant',
    modelFamily: 'props',
    footprintCells: [2, 2],
    workspaceCapacity: 12,
    consumption: { energy: 5, water: 5, food: 3, waste: 4 },
    points: { culture: 2, entertainment: 4 },
    wealthLevel: 2,
    trafficGeneration: 3,
    pedestrianGeneration: 8,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 5 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'com.market_hall',
    displayName: 'Market Hall',
    description: 'Stalls under a big roof. Where the town does its trading.',
    category: 'commercial',
    archetype: 'consumer',
    model: 'Market',
    modelFamily: 'props',
    footprintCells: [2, 2],
    workspaceCapacity: 20,
    consumption: { energy: 7, water: 4, food: 2, waste: 6 },
    points: { culture: 2, entertainment: 3 },
    wealthLevel: 1,
    trafficGeneration: 5,
    pedestrianGeneration: 10,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 6 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'com.office_block',
    displayName: 'Office Block',
    description: 'Desks, meetings, and a great many jobs.',
    category: 'commercial',
    archetype: 'consumer',
    model: 'office',
    modelFamily: 'props',
    footprintCells: [2, 2],
    workspaceCapacity: 30,
    consumption: { energy: 8, water: 4, food: 3, waste: 4 },
    points: { culture: 1 },
    wealthLevel: 2,
    trafficGeneration: 4,
    pedestrianGeneration: 5,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 4 },
    unlockStage: 'stage-2',
  }),

  // =========================================================================
  // INDUSTRIAL — "industrial areas" plus the freight chain.
  // The food factory lives in the FOOD tab (one entry, one tab — FR-BLD-019).
  // =========================================================================
  def({
    id: 'ind.warehouse',
    displayName: 'Warehouse',
    description: 'Racks, forklifts and a great deal of cardboard.',
    category: 'industrial',
    archetype: 'consumer',
    model: 'Warehouse',
    modelFamily: 'props',
    footprintCells: [1, 1],
    jobCapacity: 12,
    consumption: { energy: 5, water: 1, food: 1, waste: 2 },
    pollution: 1,
    noise: 1,
    trafficGeneration: 3,
    pedestrianGeneration: 1,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 2 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'ind.freight_depot',
    displayName: 'Freight Depot',
    description: 'Where goods change hands between the harbour and the factory.',
    category: 'industrial',
    archetype: 'consumer',
    model: 'Depot',
    modelFamily: 'props',
    footprintCells: [2, 2],
    jobCapacity: 24,
    consumption: { energy: 9, water: 2, food: 2, waste: 4 },
    pollution: 2,
    noise: 2,
    trafficGeneration: 6,
    pedestrianGeneration: 2,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 4 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'ind.vehicle_garage',
    displayName: 'Vehicle Garage',
    description: 'Where the city keeps its lorries and mends its own.',
    category: 'industrial',
    archetype: 'consumer',
    model: 'Garage',
    modelFamily: 'props',
    footprintCells: [2, 2],
    jobCapacity: 16,
    consumption: { energy: 6, water: 2, food: 1, waste: 3 },
    pollution: 2,
    trafficGeneration: 3,
    pedestrianGeneration: 2,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'ind.cargo_yard',
    displayName: 'Cargo Yard',
    description: 'Containers stacked in the open. Efficient, noisy, grimy.',
    category: 'industrial',
    archetype: 'consumer',
    model: 'cargo',
    modelFamily: 'props',
    footprintCells: [2, 2],
    jobCapacity: 20,
    consumption: { energy: 7, water: 1, food: 1, waste: 3 },
    pollution: 3,
    noise: 3,
    trafficGeneration: 7,
    pedestrianGeneration: 1,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 5 },
    unlockStage: 'stage-3',
  }),

  // =========================================================================
  // ENERGY — wind (land), wind (offshore), coal, solar, nuclear, plus the
  // dual energy/waste incinerator (FR-BLD-013).
  // =========================================================================
  def({
    id: 'eng.wind',
    displayName: 'Wind Power Plant',
    description: 'Clean green power. One turbine, one very tall silhouette.',
    category: 'energy',
    archetype: 'producer',
    model: 'power_wind',
    modelFamily: 'props',
    footprintCells: [1, 1],
    production: { energy: 30 }, // TBD: units per minute (unpublished)
    pollution: 0,
    greenEnergy: true,
    noise: 2,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 2 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'eng.offshore_wind',
    displayName: 'Offshore Wind Farm',
    description: 'Turbines out at sea. No library art exists for this yet.',
    category: 'energy',
    archetype: 'producer',
    available: false,
    model: null,
    footprintCells: [2, 2],
    production: { energy: 60 },
    pollution: 0,
    greenEnergy: true,
    noise: 2,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 9 },
    unlockStage: 'stage-4',
  }),
  def({
    id: 'eng.coal',
    displayName: 'Coal Power Plant',
    description: 'Heavy, reliable and filthy. The city will pay for it.',
    category: 'energy',
    archetype: 'producer',
    model: 'power_coal',
    modelFamily: 'props',
    footprintCells: [2, 2],
    production: { energy: 90 },
    pollution: 12,
    noise: 5,
    constructionSlots: 2,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'eng.solar',
    displayName: 'Solar Power Plant',
    description: 'Panels on the roof. Quiet, green and small.',
    category: 'energy',
    archetype: 'producer',
    model: 'power_solar',
    modelFamily: 'props',
    footprintCells: [1, 1],
    production: { energy: 20 },
    pollution: 0,
    greenEnergy: true,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'eng.nuclear',
    displayName: 'Nuclear Power Plant',
    description: 'Enormous output, enormous footprint. Unlocks when the city is big enough.',
    category: 'energy',
    archetype: 'producer',
    model: 'power_nuclear',
    modelFamily: 'props',
    footprintCells: [2, 2],
    production: { energy: 180 },
    pollution: 3,
    noise: 4,
    constructionSlots: 2,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 12 },
    unlockStage: 'stage-5',
  }),

  // =========================================================================
  // WATER — water tower, small pump, big pump (FR-BLD-014).
  // =========================================================================
  def({
    id: 'wat.tower',
    displayName: 'Water Tower',
    description: 'Stores clean water above the rooftops.',
    category: 'water',
    archetype: 'producer',
    model: 'Water-Tower',
    modelFamily: 'props',
    footprintCells: [1, 1],
    production: { water: 40 },
    pollution: 0,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'wat.treatment',
    displayName: 'Water Treatment Plant',
    description: 'Turns river water into something a resident will drink.',
    category: 'water',
    archetype: 'producer',
    model: 'service_water',
    modelFamily: 'props',
    footprintCells: [1, 1],
    production: { water: 70 },
    pollution: 1,
    noise: 2,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'wat.small_pump',
    displayName: 'Small Water Pump',
    description: 'A modest pump for a modest district.',
    category: 'water',
    archetype: 'producer',
    model: 'water_supply',
    modelFamily: 'props',
    footprintCells: [1, 1],
    production: { water: 15 },
    pollution: 0,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'wat.large_pump',
    displayName: 'Large Water Pump',
    description: 'Moves a river into the pipes all by itself.',
    category: 'water',
    archetype: 'producer',
    model: 'Pump',
    modelFamily: 'props',
    footprintCells: [1, 1],
    production: { water: 90 },
    pollution: 1,
    noise: 3,
    constructionSlots: 2,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 6 },
    unlockStage: 'stage-3',
  }),

  // =========================================================================
  // FOOD / AGRICULTURE — field, animal enclosure, food factory, and the
  // bonus set pole barn / windmill / silo (FR-BLD-015).
  // =========================================================================
  def({
    id: 'foo.field',
    displayName: 'Field',
    description: 'Plant-source food. Only works inside a pole-barn area.',
    category: 'food',
    archetype: 'producer',
    model: 'Farm',
    modelFamily: 'props',
    footprintCells: [2, 1],
    production: { food: { plant: 30 } },
    consumption: { energy: 2, water: 3 },
    pollution: 1,
    requiresPoleBarnCoverage: true,
    zoned: true,
    zoneId: 'farmland',
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'foo.animal_enclosure',
    displayName: 'Farm Animal Enclosure',
    description: 'Animal-source food. Only works inside a pole-barn area.',
    category: 'food',
    archetype: 'producer',
    available: false,
    model: null,
    footprintCells: [2, 2],
    production: { food: { animal: 25 } },
    consumption: { energy: 2, water: 3, food: 5 },
    pollution: 2,
    requiresPoleBarnCoverage: true,
    zoned: true,
    zoneId: 'farmland',
    unlock: { kind: 'level', level: 4 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'foo.factory',
    displayName: 'Food Factory',
    description: 'Processed food out of plant and animal inputs. No pole barn needed.',
    category: 'food',
    archetype: 'producer',
    model: 'Factory',
    modelFamily: 'props',
    footprintCells: [2, 1],
    production: { food: { processed: 45 } },
    consumption: { energy: 12, water: 6, food: 10 },
    pollution: 5,
    noise: 4,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 5 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'foo.pole_barn',
    displayName: 'Pole Barn',
    description: 'The enabling structure: fields and enclosures only work inside its area.',
    category: 'food',
    archetype: 'bonus',
    // The library has no pole barn. The props "Hall" is its closest genuine
    // structure and is shared with the Citycon Building.
    model: 'Hall',
    modelFamily: 'props',
    footprintCells: [2, 2],
    bonusArea: { radiusTiles: 6, targets: ['food.plant', 'food.animal'] },
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'foo.windmill',
    displayName: 'Windmill',
    description: 'Boosts nearby food production inside a 13 x 13 area.',
    category: 'food',
    archetype: 'bonus',
    // The library has exactly one wind machine (power_wind). The windmill
    // reuses it; there is no separate windmill model.
    model: 'power_wind',
    modelFamily: 'props',
    footprintCells: [1, 1],
    bonusArea: { radiusTiles: 6, targets: ['food.plant', 'food.animal'] },
    unlock: { kind: 'level', level: 6 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'foo.silo',
    displayName: 'Silo',
    description: 'Stores and boosts food production within 13 x 13.',
    category: 'food',
    archetype: 'bonus',
    model: 'Tank',
    modelFamily: 'props',
    footprintCells: [1, 1],
    bonusArea: { radiusTiles: 6, targets: ['food.plant', 'food.animal'] },
    unlock: { kind: 'level', level: 4 },
    unlockStage: 'stage-2',
  }),

  // =========================================================================
  // WASTE — landfill, recycling station, waste incineration (FR-BLD-016).
  // The incinerator also produces energy (dual energy/waste entry, §4.1).
  // =========================================================================
  def({
    id: 'wst.landfill',
    displayName: 'Landfill',
    description: 'Cheap and straightforward. Nobody likes the view.',
    category: 'waste',
    archetype: 'producer',
    model: 'service_utility',
    modelFamily: 'props',
    footprintCells: [1, 2],
    production: { wasteRemoval: 40 },
    pollution: 6,
    noise: 3,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 2 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'wst.recycling',
    displayName: 'Recycling Station',
    description: 'A little more expensive, but it removes more waste and it upgrades.',
    category: 'waste',
    archetype: 'producer',
    model: 'service_waste',
    modelFamily: 'props',
    footprintCells: [1, 1],
    production: { wasteRemoval: 30 },
    pollution: 1,
    maxLevels: TUNING.maxServiceLevels,
    tiers: serviceTiers(TUNING.maxServiceLevels, 30, TUNING.baseServiceRadius / CELL),
    unlock: { kind: 'level', level: 4 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'wst.incineration',
    displayName: 'Waste Incineration Plant',
    description: 'Burns waste for energy. Powerful, and very polluting. Keep it industrial.',
    category: 'waste',
    archetype: 'producer',
    model: 'Storage',
    modelFamily: 'props',
    footprintCells: [2, 2],
    production: { wasteRemoval: 90, energy: 25 },
    pollution: 20,
    noise: 6,
    constructionSlots: 2,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 7 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'wst.container',
    displayName: 'Waste Container',
    description: 'A skip on the street. The smallest waste helper there is.',
    category: 'waste',
    archetype: 'producer',
    model: 'dumpster',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    production: { wasteRemoval: 5 },
    pollution: 1,
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),

  // =========================================================================
  // HEALTH CARE — medical centre + upgradeable hospital (FR-BLD-017).
  // =========================================================================
  def({
    id: 'hea.medical_center',
    displayName: 'Medical Center',
    description: 'Cheap, quick to unlock, and it covers a smaller area than the hospital.',
    category: 'health',
    archetype: 'service',
    model: 'Clinic',
    modelFamily: 'props',
    footprintCells: [2, 1],
    serviceProvided: 'health',
    coverageCapacity: 200,
    maxLevels: TUNING.maxServiceLevels,
    tiers: serviceTiers(TUNING.maxServiceLevels, 200, TUNING.baseServiceRadius / CELL),
    consumption: { energy: 6, water: 4, waste: 3 },
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'hea.hospital',
    displayName: 'Hospital',
    description: 'Big, expensive, and upgradeable in place. Needs two slots while it is built.',
    category: 'health',
    archetype: 'service',
    model: 'service_clinic',
    modelFamily: 'props',
    footprintCells: [2, 1],
    serviceProvided: 'health',
    coverageCapacity: 400,
    maxLevels: TUNING.maxServiceLevels,
    tiers: serviceTiers(TUNING.maxServiceLevels, 400, TUNING.baseServiceRadius / CELL),
    consumption: { energy: 12, water: 8, waste: 5 },
    constructionSlots: 2,
    unlock: { kind: 'level', level: 8 },
    unlockStage: 'stage-4',
  }),

  // =========================================================================
  // POLICE / SECURITY — police station + police department (FR-BLD-017).
  // The library has no police building; both entries reuse the office model.
  // `citybits/car_police` is a CAR, not a building, and is never placed.
  // =========================================================================
  def({
    id: 'pol.station',
    displayName: 'Police Station',
    description: 'A small station for a small town. Decoration and a bonus, mostly.',
    category: 'police',
    archetype: 'service',
    model: 'office',
    modelFamily: 'props',
    footprintCells: [2, 2],
    serviceProvided: 'police',
    coverageCapacity: 150,
    maxLevels: TUNING.maxServiceLevels,
    tiers: serviceTiers(TUNING.maxServiceLevels, 150, TUNING.baseServiceRadius / CELL),
    consumption: { energy: 5, water: 2, waste: 2 },
    unlock: { kind: 'level', level: 5 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'pol.department',
    displayName: 'Police Department',
    description: 'The big one. Cover the whole city to earn the bonus.',
    category: 'police',
    archetype: 'service',
    model: 'office',
    modelFamily: 'props',
    footprintCells: [2, 2],
    serviceProvided: 'police',
    coverageCapacity: 350,
    maxLevels: TUNING.maxServiceLevels,
    tiers: serviceTiers(TUNING.maxServiceLevels, 350, TUNING.baseServiceRadius / CELL),
    consumption: { energy: 9, water: 4, waste: 3 },
    constructionSlots: 2,
    unlock: { kind: 'level', level: 10 },
    unlockStage: 'stage-4',
  }),

  // =========================================================================
  // FIRE — fire department + fire station (FR-BLD-017).
  // =========================================================================
  def({
    id: 'fir.station',
    displayName: 'Fire Station',
    description: 'A small fire station. Covered buildings earn a bonus.',
    category: 'fire',
    archetype: 'service',
    model: 'service_fire',
    modelFamily: 'props',
    footprintCells: [1, 1],
    serviceProvided: 'fire',
    coverageCapacity: 150,
    maxLevels: TUNING.maxServiceLevels,
    tiers: serviceTiers(TUNING.maxServiceLevels, 150, TUNING.baseServiceRadius / CELL),
    consumption: { energy: 5, water: 2, waste: 2 },
    unlock: { kind: 'level', level: 5 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'fir.department',
    displayName: 'Fire Department',
    description: 'The full station: engines, hoses and a much wider coverage.',
    category: 'fire',
    archetype: 'service',
    model: 'Fire',
    modelFamily: 'props',
    footprintCells: [3, 2],
    serviceProvided: 'fire',
    coverageCapacity: 400,
    maxLevels: TUNING.maxServiceLevels,
    tiers: serviceTiers(TUNING.maxServiceLevels, 400, TUNING.baseServiceRadius / CELL),
    consumption: { energy: 10, water: 5, waste: 3 },
    constructionSlots: 2,
    unlock: { kind: 'level', level: 9 },
    unlockStage: 'stage-4',
  }),

  // =========================================================================
  // EDUCATION — three school levels, a bus station and two bonus entries
  // (FR-BLD-017). The library has no school or library art.
  // =========================================================================
  def({
    id: 'edu.elementary',
    displayName: 'Elementary School',
    description: 'The first level of the school system. Small area, small capacity.',
    category: 'education',
    archetype: 'service',
    available: false,
    model: null,
    footprintCells: [2, 2],
    serviceProvided: 'education.elementary',
    coverageCapacity: 120,
    maxLevels: TUNING.maxServiceLevels,
    tiers: serviceTiers(TUNING.maxServiceLevels, 120, TUNING.baseServiceRadius / CELL),
    consumption: { energy: 6, water: 3, waste: 2 },
    unlock: { kind: 'level', level: 4 },
    unlockStage: 'stage-2',
  }),
  def({
    id: 'edu.secondary',
    displayName: 'Secondary School',
    description: 'Bigger radius and more capacity than the elementary school.',
    category: 'education',
    archetype: 'service',
    available: false,
    model: null,
    footprintCells: [2, 2],
    serviceProvided: 'education.secondary',
    coverageCapacity: 250,
    maxLevels: TUNING.maxServiceLevels,
    tiers: serviceTiers(TUNING.maxServiceLevels, 250, TUNING.baseServiceRadius / CELL),
    consumption: { energy: 9, water: 4, waste: 3 },
    unlock: { kind: 'level', level: 7 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'edu.university',
    displayName: 'University',
    description: 'The top of the school system. The widest reach and the most capacity.',
    category: 'education',
    archetype: 'service',
    available: false,
    model: null,
    footprintCells: [3, 3],
    serviceProvided: 'education.university',
    coverageCapacity: 500,
    maxLevels: TUNING.maxServiceLevels,
    tiers: serviceTiers(TUNING.maxServiceLevels, 500, TUNING.baseServiceRadius / CELL),
    consumption: { energy: 16, water: 8, waste: 4 },
    constructionSlots: 2,
    unlock: { kind: 'level', level: 12 },
    unlockStage: 'stage-5',
  }),
  def({
    id: 'edu.bus_station',
    displayName: 'Bus Station',
    description: 'Grants school connection to the buildings around it, wherever it stands.',
    category: 'education',
    archetype: 'connector',
    // The library's only platform-like structure; reused for the bus station.
    model: 'Pier',
    modelFamily: 'props',
    footprintCells: [1, 2],
    serviceProvided: 'education.connection',
    coverageCapacity: 80,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 6 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'edu.library',
    displayName: 'Library',
    description: 'Improves the quality of the schools it covers.',
    category: 'education',
    archetype: 'bonus',
    available: false,
    model: null,
    footprintCells: [2, 2],
    bonusArea: { radiusTiles: 6, targets: ['education'] },
    points: { culture: 5 },
    unlock: { kind: 'level', level: 8 },
    unlockStage: 'stage-4',
  }),
  def({
    id: 'edu.art_museum',
    displayName: 'Art Museum',
    description: 'Improves the quality of the schools it covers, and feeds culture points.',
    category: 'education',
    archetype: 'bonus',
    model: 'service_museum',
    modelFamily: 'props',
    footprintCells: [1, 1],
    bonusArea: { radiusTiles: 6, targets: ['education'] },
    points: { culture: 10 },
    unique: true,
    unlock: { kind: 'level', level: 9 },
    unlockStage: 'stage-4',
  }),

  // =========================================================================
  // TRANSIT — monorail and monorail station (FR-BLD-018), plus the other
  // transport terminals the library can render.
  // =========================================================================
  def({
    id: 'trn.monorail',
    displayName: 'Monorail',
    description: 'Grants street connection to RESIDENTIAL buildings nearby, even with no road.',
    category: 'transit',
    archetype: 'connector',
    model: 'transit_train',
    modelFamily: 'props',
    footprintCells: [1, 2],
    serviceProvided: 'transit.connection',
    coverageCapacity: 120,
    requiresRoadConnection: false,
    unlock: { kind: 'level', level: 7 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'trn.monorail_station',
    displayName: 'Monorail Station',
    description: 'Where riders get on and off the monorail.',
    category: 'transit',
    archetype: 'connector',
    model: 'Station',
    modelFamily: 'props',
    footprintCells: [2, 2],
    serviceProvided: 'transit.station',
    coverageCapacity: 100,
    requiresRoadConnection: true,
    constructionSlots: 2,
    unlock: { kind: 'level', level: 7 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'trn.ferry_terminal',
    displayName: 'Ferry Terminal',
    description: 'A quay, a boat and a timetable.',
    category: 'transit',
    archetype: 'connector',
    model: 'Ferry',
    modelFamily: 'props',
    footprintCells: [2, 2],
    serviceProvided: 'transit.ferry',
    coverageCapacity: 80,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 8 },
    unlockStage: 'stage-4',
  }),
  def({
    id: 'trn.harbour_terminal',
    displayName: 'Harbour Terminal',
    description: 'Cargo, cranes and a great deal of noise.',
    category: 'transit',
    archetype: 'connector',
    model: 'transit_harbor',
    modelFamily: 'props',
    footprintCells: [2, 2],
    serviceProvided: 'transit.harbour',
    coverageCapacity: 120,
    pollution: 3,
    noise: 4,
    constructionSlots: 2,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 9 },
    unlockStage: 'stage-4',
  }),
  def({
    id: 'trn.airport_terminal',
    displayName: 'Airport Terminal',
    description: 'Small airport, small runway, big ambitions.',
    category: 'transit',
    archetype: 'connector',
    model: 'transit_air',
    modelFamily: 'props',
    footprintCells: [1, 1],
    serviceProvided: 'transit.air',
    coverageCapacity: 60,
    noise: 4,
    requiresRoadConnection: true,
    unlock: { kind: 'level', level: 11 },
    unlockStage: 'stage-5',
  }),

  // =========================================================================
  // PARKS & LEISURE — the park tab of the shop (S7) plus greenery.
  // =========================================================================
  def({
    id: 'prk.park',
    displayName: 'Park',
    description: 'Grass, trees and somewhere for the town to sit down.',
    category: 'parks',
    archetype: 'bonus',
    model: 'service_park',
    modelFamily: 'props',
    footprintCells: [1, 1],
    points: { recreation: 5 },
    bonusArea: { radiusTiles: 3, targets: ['residential'] },
    unlock: { kind: 'level', level: 2 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'prk.bush',
    displayName: 'Bush',
    description: 'A round green bush. Cheap greenery for a whole neighbourhood.',
    category: 'parks',
    archetype: 'decoration',
    model: 'bush',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    points: { recreation: 1 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),

  // =========================================================================
  // DECORATION — non-functional, occupies space, no production or coverage.
  // =========================================================================
  def({
    id: 'dec.oak_tree',
    displayName: 'Oak Tree',
    description: 'A broad old oak. Good for a square.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_oak_01',
    modelFamily: 'nature',
    footprintCells: [1, 2],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.pine_tree',
    displayName: 'Pine Tree',
    description: 'Tall, dark and evergreen.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_pine_01',
    modelFamily: 'nature',
    footprintCells: [2, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.birch_tree',
    displayName: 'Birch Tree',
    description: 'White bark, small leaves.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_birch_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.dead_tree',
    displayName: 'Dead Tree',
    description: 'Bare branches. Adds character to a marshy corner.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_deadtree_01',
    modelFamily: 'nature',
    footprintCells: [1, 2],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.oak_sapling',
    displayName: 'Oak Sapling',
    description: 'An oak that has not grown up yet.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_oak_sapling_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.pine_sapling',
    displayName: 'Pine Sapling',
    description: 'A young pine, one day a big pine.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_pine_sapling_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.boulder',
    displayName: 'Boulder',
    description: 'A large rock. Looks like it was always there.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_boulder_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.rock_pile',
    displayName: 'Rock Pile',
    description: 'A scatter of stones.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_rocks_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.mossy_rock',
    displayName: 'Mossy Rock',
    description: 'A stone with a green coat.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_rock_mossy_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.shrub',
    displayName: 'Shrub',
    description: 'A low green shrub.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_bush_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.ferns',
    displayName: 'Ferns',
    description: 'A clump of ferns at the edge of the woods.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_fern_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.grass_patch',
    displayName: 'Grass Patch',
    description: 'A tuft of meadow grass.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_grass_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.flower_patch',
    displayName: 'Flower Patch',
    description: 'A small bed of flowers.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_flowers_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    points: { recreation: 1 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.mushrooms',
    displayName: 'Mushrooms',
    description: 'A few mushrooms under a damp log.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_mushrooms_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.fallen_log',
    displayName: 'Fallen Log',
    description: 'A tree that did not get up.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_log_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.tree_stump',
    displayName: 'Tree Stump',
    description: 'What is left behind.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'mdvl_nature_stump_01',
    modelFamily: 'nature',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.watch_tower',
    displayName: 'Watch Tower',
    description: 'A tall stone tower for looking out over the city.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'Tower',
    modelFamily: 'props',
    footprintCells: [1, 1],
    points: { culture: 2 },
    unlock: { kind: 'level', level: 5 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'dec.lighthouse',
    displayName: 'Lighthouse',
    description: 'A beam that sweeps the whole bay.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'Lighthouse',
    modelFamily: 'props',
    footprintCells: [1, 1],
    points: { culture: 3 },
    unique: true,
    unlock: { kind: 'level', level: 6 },
    unlockStage: 'stage-3',
  }),
  def({
    id: 'dec.bridge',
    displayName: 'Bridge',
    description: 'Spans the water and makes the far bank reachable.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'Bridge',
    modelFamily: 'props',
    footprintCells: [2, 1],
    unlock: { kind: 'level', level: 7 },
    unlockStage: 'stage-3',
  }),

  // =========================================================================
  // INFRASTRUCTURE — the man-made city kit: roads, street furniture and the
  // `citybits` props. This tab exists because the library holds the art and
  // the shop derives its tabs from the catalogue (FR-BLD-009 / FR-BLD-019).
  //
  // ROAD OWNERSHIP: MOB owns the road GRAPH and places the road MODEL (it
  // picks the straight / corner / junction / t-split variant from the
  // network topology, which is the only correct way to choose it). These
  // entries therefore route their placement through `mobility.addRoad()`;
  // the model key names the art family for the shop card, not a fixed shape.
  // =========================================================================
  def({
    id: 'inf.road_straight',
    displayName: 'Road',
    description: 'A stretch of tarmac. The backbone of every street.',
    category: 'infrastructure',
    archetype: 'connector',
    model: 'road_straight',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    infrastructure: 'road',
    costInputs: { base: 0, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.road_corner',
    displayName: 'Road Corner',
    description: 'A road that turns. The shape follows the streets around it.',
    category: 'infrastructure',
    archetype: 'connector',
    model: 'road_corner',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    infrastructure: 'road',
    costInputs: { base: 0, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.road_corner_curved',
    displayName: 'Curved Road Corner',
    description: 'A road that bends rather than turns.',
    category: 'infrastructure',
    archetype: 'connector',
    model: 'road_corner_curved',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    infrastructure: 'road',
    costInputs: { base: 0, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.road_junction',
    displayName: 'Road Junction',
    description: 'Where four streets meet.',
    category: 'infrastructure',
    archetype: 'connector',
    model: 'road_junction',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    infrastructure: 'road',
    costInputs: { base: 0, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.road_straight_crossing',
    displayName: 'Crossing Road',
    description: 'A road that crosses another one.',
    category: 'infrastructure',
    archetype: 'connector',
    model: 'road_straight_crossing',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    infrastructure: 'road',
    costInputs: { base: 0, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.road_tsplit',
    displayName: 'T-Split Road',
    description: 'A road that forks into a T.',
    category: 'infrastructure',
    archetype: 'connector',
    model: 'road_tsplit',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    infrastructure: 'road',
    costInputs: { base: 0, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.street_lamp',
    displayName: 'Street Lamp',
    description: 'Light for the evening.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'streetlight',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.15, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.traffic_light',
    displayName: 'Traffic Light',
    description: 'Red, amber, green - and nobody ever stops at red.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'trafficlight_A',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.15, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.traffic_light_b',
    displayName: 'Traffic Light (B)',
    description: 'The second traffic light in the kit.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'trafficlight_B',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.15, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.traffic_light_c',
    displayName: 'Traffic Light (C)',
    description: 'The third traffic light in the kit.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'trafficlight_C',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.15, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 3 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.water_tower',
    displayName: 'Water Tower',
    description: 'Gravity does the work.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'watertower',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.3, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 2 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.bench',
    displayName: 'Bench',
    description: 'Somewhere to rest your feet and watch the town go by.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'bench',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.15, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.fire_hydrant',
    displayName: 'Fire Hydrant',
    description: 'Red, small, and everybody knows where it is.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'firehydrant',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.15, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.dumpster',
    displayName: 'Dumpster',
    description: 'A big metal box for the things the town throws away.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'dumpster',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.2, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 2 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.trash_can',
    displayName: 'Trash Can',
    description: 'For the small stuff.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'trash_A',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.1, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.trash_pile',
    displayName: 'Trash Pile',
    description: 'The bag that did not survive the night.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'trash_B',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.1, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.supply_crate',
    displayName: 'Supply Crate',
    description: 'A crate that never got opened.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'box_A',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.1, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.tool_crate',
    displayName: 'Tool Crate',
    description: 'A smaller crate of tools.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'box_B',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.1, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'inf.base_plate',
    displayName: 'Base Plate',
    description: 'A plain ground plate. Handy for paving and courtyards.',
    category: 'infrastructure',
    archetype: 'decoration',
    model: 'base',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    costInputs: { base: 0.05, perCell: 0, perLevel: 0 },
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),

  // =========================================================================
  // BUILDING SHELLS — the `citybits` city buildings WITHOUT their ground
  // plate. They are the same eight houses the residential ladder uses, so
  // they are sold as shells: the same silhouette, no base slab, ready to be
  // dropped onto a terrace or a bridge.
  // =========================================================================
  def({
    id: 'dec.terrace_house_shell',
    displayName: 'Terrace House Shell',
    description: 'A terrace house without its ground plate.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'building_A_withoutBase',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.semi_detached_shell',
    displayName: 'Semi-Detached Shell',
    description: 'A semi-detached house without its ground plate.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'building_B_withoutBase',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.low_rise_shell',
    displayName: 'Low-Rise Flats Shell',
    description: 'Low-rise flats without their ground plate.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'building_E_withoutBase',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.mid_rise_shell',
    displayName: 'Mid-Rise Flats Shell',
    description: 'Mid-rise flats without their ground plate.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'building_F_withoutBase',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.city_block_shell',
    displayName: 'City Block Shell',
    description: 'A city block without its ground plate.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'building_D_withoutBase',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.tower_block_shell',
    displayName: 'Tower Block Shell',
    description: 'A tower block without its ground plate.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'building_C_withoutBase',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.high_rise_shell',
    displayName: 'High-Rise Tower Shell',
    description: 'A high-rise tower without its ground plate.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'building_G_withoutBase',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),
  def({
    id: 'dec.skyscraper_shell',
    displayName: 'Skyscraper Shell',
    description: 'A skyscraper without its ground plate.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'building_H_withoutBase',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 1 },
    unlockStage: 'stage-1',
  }),

  // =========================================================================
  // SPECIAL / CITY UPGRADES — not ordinary placeable buildings (FR-BLD-020).
  // The Citycon Building is placeable and grants a permanent slot (OQ-BLD-16).
  // =========================================================================
  def({
    id: 'spl.citycon_building',
    displayName: 'Citycon Building',
    description: 'The landmark of the city. Placing it grants one permanent construction slot.',
    category: 'special',
    archetype: 'special',
    model: 'Hall',
    modelFamily: 'props',
    footprintCells: [2, 2],
    constructionSlots: 1,
    grantsConstructionSlot: true,
    points: { culture: 5 },
    unique: true,
    unlock: { kind: 'level', level: 8 },
    unlockStage: 'stage-4',
  }),
  def({
    id: 'spl.upgrade_green_grid',
    displayName: 'City Upgrade: Green Grid',
    description: 'A city-wide modifier that makes the grid greener. No art exists yet.',
    category: 'special',
    archetype: 'special',
    available: false,
    model: null,
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 10 },
    unlockStage: 'stage-4',
  }),
  def({
    id: 'spl.upgrade_recycling',
    displayName: 'City Upgrade: Recycling Programme',
    description: 'A city-wide modifier that cuts the waste the city produces.',
    category: 'special',
    archetype: 'special',
    available: false,
    model: null,
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 11 },
    unlockStage: 'stage-5',
  }),
  def({
    id: 'spl.upgrade_coin_value',
    displayName: 'City Upgrade: Coin Value',
    description: 'A city-wide modifier that raises what each coin is worth.',
    category: 'special',
    archetype: 'special',
    available: false,
    model: null,
    footprintCells: [1, 1],
    unlock: { kind: 'level', level: 13 },
    unlockStage: 'stage-5',
  }),

  // =========================================================================
  // CONTENT PACKS — add-ons and the rotating weekly entry. These are real
  // catalogue entries so the pack system is exercised by data, not code.
  // =========================================================================
  def({
    id: 'addon.amsterdam_canal_house',
    displayName: 'Amsterdam Canal House',
    description: 'From the Amsterdam add-on. Narrow, tall and very Dutch.',
    category: 'residential',
    archetype: 'consumer',
    model: 'building_B',
    modelFamily: 'citybits',
    footprintCells: [1, 1],
    maxLevels: TUNING.maxLevels,
    tiers: residentialTiers(TUNING.maxLevels, 9),
    residentialCapacity: 9,
    consumption: { energy: 2, water: 1, food: 1, waste: 1 },
    points: { culture: 2 },
    wealthLevel: 2,
    requiresRoadConnection: true,
    upkeepPerUnit: true,
    unlock: { kind: 'pack', level: 1, packId: 'addon-amsterdam' },
    unlockStage: 'stage-2',
    contentPack: { packId: 'addon-amsterdam', packVersion: 1, packKind: 'add-on' },
  }),
  def({
    id: 'addon.ancient_china_pagoda',
    displayName: 'Ancient China Pagoda',
    description: 'From the Ancient China add-on. Tiered, curved and unmistakably eastern.',
    category: 'decoration',
    archetype: 'decoration',
    model: 'Tower',
    modelFamily: 'props',
    footprintCells: [1, 1],
    points: { culture: 6 },
    unique: true,
    unlock: { kind: 'pack', level: 1, packId: 'addon-ancient-china' },
    unlockStage: 'stage-3',
    contentPack: { packId: 'addon-ancient-china', packVersion: 1, packKind: 'add-on' },
  }),
  def({
    id: 'botw.weekly_pavilion',
    displayName: 'Weekly Market Pavilion',
    description: 'The Building of the Week. Unique, and gone when the week ends.',
    category: 'commercial',
    archetype: 'consumer',
    model: 'Market',
    modelFamily: 'props',
    footprintCells: [2, 2],
    workspaceCapacity: 14,
    consumption: { energy: 6, water: 3, food: 1, waste: 4 },
    points: { entertainment: 4 },
    unique: true,
    requiresRoadConnection: true,
    unlock: { kind: 'event', level: 1, eventId: 'building-of-the-week' },
    unlockStage: 'stage-3',
    contentPack: { packId: 'building-of-the-week', packVersion: 1, packKind: 'building-of-the-week' },
  }),
]);

/**
 * Every per-entry numeric value in this catalogue is AUTHORED: the publisher
 * published none of them. The list below is surfaced the same way
 * core/config.js surfaces its own unresolved numbers (`tuningTbd()`), so the
 * UI can tell the player which numbers are assumed rather than published.
 */
export const TBD_VALUES = Object.freeze([
  Object.freeze({ key: 'residentialCapacity', note: 'residents per entry and per tier (OQ-BLD-04)' }),
  Object.freeze({ key: 'jobCapacity', note: 'jobs per commercial / industrial entry (OQ-BLD-04)' }),
  Object.freeze({ key: 'workspaceCapacity', note: 'commercial workspaces per entry (OQ-BLD-04)' }),
  Object.freeze({ key: 'costInputs', note: 'price multipliers per category (no published prices)' }),
  Object.freeze({ key: 'upkeep', note: 'recurring cost per entry (OQ-BLD-05)' }),
  Object.freeze({ key: 'production', note: 'energy / water / food output per minute (unpublished)' }),
  Object.freeze({ key: 'consumption', note: 'energy / water / food / waste draw per minute (unpublished)' }),
  Object.freeze({ key: 'coverage.capacity', note: 'service capacity per tier (OQ-BLD-13)' }),
  Object.freeze({ key: 'points', note: 'culture / entertainment / recreation points (unpublished)' }),
  Object.freeze({ key: 'pollution', note: 'pollution per entry (unpublished)' }),
  Object.freeze({ key: 'noise', note: 'noise per entry (OQ-BLD-06)' }),
  Object.freeze({ key: 'trafficGeneration', note: 'cars generated per entry (OQ-BLD-07)' }),
  Object.freeze({ key: 'pedestrianGeneration', note: 'pedestrians generated per entry (OQ-BLD-07)' }),
  Object.freeze({ key: 'unlock.level', note: 'resident-count threshold per entry (unpublished)' }),
]);

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

const BY_ID = new Map(BUILDING_DEFS.map((d) => [d.id, d]));
const BY_CATEGORY = new Map();
for (const d of BUILDING_DEFS) {
  if (!BY_CATEGORY.has(d.category)) BY_CATEGORY.set(d.category, []);
  BY_CATEGORY.get(d.category).push(d);
}

/** Every definition, in catalogue order. */
export function allDefinitions() {
  return BUILDING_DEFS;
}

/** Look up one definition by its stable id. Returns undefined if unknown. */
export function getDefinition(id) {
  return BY_ID.get(id);
}

/** Definitions in one shop tab, in catalogue order. */
export function definitionsByCategory(category) {
  return BY_CATEGORY.get(category) ?? [];
}

/**
 * The live catalogue size — DERIVED from the loaded records (FR-BLD-002).
 * The shop must show this number, never a hard-coded "300+".
 */
export function catalogueSize() {
  return BUILDING_DEFS.length;
}

/** How many entries are placeable right now (i.e. have real art). */
export function availableCount() {
  return BUILDING_DEFS.reduce((n, d) => n + (d.available ? 1 : 0), 0);
}

/** True when the id names a known catalogue entry. */
export function hasDefinition(id) {
  return BY_ID.has(id);
}

/** Category ids, in shop order. */
export function categoryIds() {
  return CATEGORIES.map((c) => c.id);
}

/** True when the string is a known category id. */
export function isCategory(id) {
  return CATEGORY_IDS.has(id);
}
