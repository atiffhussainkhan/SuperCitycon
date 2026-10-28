/**
 * ECO — economy domain tests.
 *
 *   node --test src/economy/economy.test.mjs
 *
 * The tests run head-less (NFR-ECO-010): no renderer, no DOM, no sibling
 * domain is imported. Every definition used here is hand-made so the suite
 * does not depend on the buildings catalogue.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createEconomy } from './index.js';
import * as logic from './logic.js';
import { TUNING } from '../core/config.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

function makeBus() {
  const listeners = new Map();
  return {
    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
      return () => listeners.get(evt)?.delete(fn);
    },
    off(evt, fn) {
      listeners.get(evt)?.delete(fn);
      return true;
    },
    once(evt, fn) {
      const off = this.on(evt, (payload) => { off(); fn(payload); });
      return off;
    },
    emit(evt, payload) {
      const set = listeners.get(evt);
      if (!set) return 0;
      let delivered = 0;
      for (const fn of [...set]) {
        fn(payload);
        delivered += 1;
      }
      return delivered;
    },
    count(evt) {
      return listeners.get(evt)?.size ?? 0;
    },
  };
}

/** A catalogue entry in the normalised shape the buildings domain publishes. */
function def(overrides) {
  const base = {
    id: 'test.def',
    displayName: 'Test',
    category: 'residential',
    archetype: 'consumer',
    available: true,
    model: null,
    footprintCells: [1, 1],
    maxLevels: 3,
    tierLadder: null,
    costInputs: { base: 1, perCell: 0.35, perLevel: 0.5 },
    upkeep: 0,
    upkeepPerUnit: false,
    capacity: { residents: 0, workspaces: 0, jobs: 0, served: 0 },
    production: {
      energy: 0, water: 0, food: { plant: 0, animal: 0, processed: 0 }, wasteRemoval: 0,
    },
    consumption: { energy: 0, water: 0, food: 0, waste: 0 },
    wasteProduction: 0,
    serviceProvided: null,
    bonusArea: null,
    requiresPoleBarnCoverage: false,
    greenEnergy: false,
    constructionSlots: 1,
    grantsConstructionSlot: false,
  };
  const merged = { ...base, ...overrides };
  merged.capacity = { ...base.capacity, ...(overrides.capacity ?? {}) };
  merged.production = {
    ...base.production,
    ...(overrides.production ?? {}),
    food: { ...base.production.food, ...(overrides.production?.food ?? {}) },
  };
  merged.consumption = { ...base.consumption, ...(overrides.consumption ?? {}) };
  if (!merged.tierLadder) {
    merged.tierLadder = [{
      level: 1,
      capacity: { ...merged.capacity },
      coverage: null,
    }];
  }
  return merged;
}

const DEFS = [
  def({
    id: 'res.house',
    category: 'residential',
    capacity: { residents: 8 },
    upkeepPerUnit: true,
    consumption: { energy: 1, water: 1, food: 1, waste: 1 },
    wasteProduction: 1,
  }),
  def({
    id: 'com.grocery',
    category: 'commercial',
    archetype: 'consumer',
    footprintCells: [2, 1],
    capacity: { workspaces: 6 },
    consumption: { energy: 3, water: 2, food: 1, waste: 2 },
    wasteProduction: 2,
  }),
  def({
    id: 'ind.warehouse',
    category: 'industrial',
    footprintCells: [1, 1],
    capacity: { jobs: 12 },
    consumption: { energy: 5, water: 1, food: 1, waste: 2 },
    wasteProduction: 2,
  }),
  def({
    id: 'hea.hospital',
    category: 'health',
    archetype: 'service',
    serviceProvided: { radius: 10 },
    upkeep: 100,
    constructionSlots: 2,
  }),
  def({
    id: 'eng.coal',
    category: 'energy',
    archetype: 'producer',
    production: { energy: 90 },
    greenEnergy: false,
    pollution: 12,
    constructionSlots: 2,
  }),
  def({
    id: 'foo.field',
    category: 'food',
    archetype: 'producer',
    production: { food: { plant: 30 } },
    requiresPoleBarnCoverage: true,
  }),
  def({
    id: 'foo.animal_enclosure',
    category: 'food',
    archetype: 'producer',
    production: { food: { animal: 25 } },
    consumption: { food: 5 },
    requiresPoleBarnCoverage: true,
  }),
  def({
    id: 'foo.factory',
    category: 'food',
    archetype: 'consumer',
    production: { food: { processed: 45 } },
    consumption: { food: 10 },
  }),
  def({
    id: 'foo.pole_barn',
    category: 'food',
    archetype: 'bonus',
    bonusArea: { radiusTiles: 6, targets: ['food.plant', 'food.animal'] },
  }),
  def({
    id: 'foo.silo',
    category: 'food',
    archetype: 'bonus',
    bonusArea: { radiusTiles: 6, targets: ['food.plant', 'food.animal'] },
  }),
  def({
    id: 'prk.park',
    category: 'parks',
    archetype: 'bonus',
    bonusArea: { radiusTiles: 3, targets: ['residential'] },
  }),
  def({
    id: 'trn.harbour_terminal',
    category: 'transit',
    archetype: 'connector',
  }),
  def({
    id: 'spl.citycon_building',
    category: 'special',
    grantsConstructionSlot: true,
  }),
];

function makeCtx(seed = 7) {
  const bus = makeBus();
  const state = {
    economy: {},
    population: { residents: 0 },
    buildings: { instances: new Map() },
    mobility: {},
    meta: { seed },
  };
  const ctx = {
    state,
    bus,
    config: { TUNING, GRID: { size: 64 } },
    domains: {},
  };
  return ctx;
}

/** Wire a fake buildings domain with a given set of placed instances. */
function wireBuildings(ctx, instances) {
  const map = new Map();
  for (const inst of instances) {
    map.set(inst.id, {
      id: inst.id,
      type: inst.type,
      x: inst.x ?? 0,
      z: inst.z ?? 0,
      level: inst.level ?? 1,
    });
  }
  ctx.domains.buildings = {
    catalogue: () => DEFS,
    instances: () => [...map.values()],
    occupancy: (x, z) => [...map.values()].find((i) => i.x === x && i.z === z) ?? null,
  };
  return map;
}

/** The placed instances in the `{ def, level, x, z }` shape the logic wants. */
function collectAsInstances(placed) {
  const byId = new Map(DEFS.map((d) => [d.id, d]));
  return placed.map((inst) => ({
    id: inst.id,
    def: byId.get(inst.type),
    level: inst.level ?? 1,
    x: inst.x ?? 0,
    z: inst.z ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Pure logic — construction cost
// ---------------------------------------------------------------------------

test('construction cost follows the catalogue cost inputs', () => {
  const house = DEFS.find((d) => d.id === 'res.house');
  // base 1 x TUNING.baseBuildCost + perCell x base x (cells - 1) + perLevel tier
  assert.equal(logic.constructionCost(house, 1), Math.round(1 * TUNING.baseBuildCost));
  assert.equal(logic.constructionCost(house, 2), Math.round(
    TUNING.baseBuildCost + 0.5 * TUNING.baseBuildCost * 1,
  ));

  const grocery = DEFS.find((d) => d.id === 'com.grocery');
  // two footprint cells -> the area term kicks in
  assert.equal(logic.constructionCost(grocery, 1), Math.round(
    TUNING.baseBuildCost + 0.35 * TUNING.baseBuildCost * 1,
  ));

  const hospital = DEFS.find((d) => d.id === 'hea.hospital');
  // a service compounds per tier
  assert.equal(logic.constructionCost(hospital, 2), Math.round(
    TUNING.baseBuildCost * (1 + (TUNING.serviceCostMultiplier - 1)),
  ));

  assert.equal(logic.constructionCost(null), 0);
});

test('the voxel auto-cost is monotonic and deterministic (FR-ECO-051/053)', () => {
  const small = logic.voxelConstructionCost({ voxelCount: 10, footprintTiles: 1, materialCount: 1 });
  const big = logic.voxelConstructionCost({ voxelCount: 200, footprintTiles: 4, materialCount: 3 });
  assert.ok(big > small, 'a larger model never costs less');
  assert.equal(
    logic.voxelConstructionCost({ voxelCount: 10, footprintTiles: 1, materialCount: 1 }),
    small,
    'identical inputs give an identical cost',
  );
  assert.ok(logic.voxelConstructionCost({ voxelCount: 0 }) >= 0);
});

test('upkeep is derived from the catalogue upkeep and the resident count', () => {
  const house = DEFS.find((d) => d.id === 'res.house');
  const hospital = DEFS.find((d) => d.id === 'hea.hospital');
  assert.equal(logic.upkeepOf(house, 1), 8 * TUNING.monthlyUpkeepPerUnit);
  assert.equal(logic.upkeepOf(hospital, 1), 100);
  assert.equal(
    logic.upkeepFor([{ def: house, level: 1 }, { def: hospital, level: 1 }]),
    8 * TUNING.monthlyUpkeepPerUnit + 100,
  );
});

// ---------------------------------------------------------------------------
// Pure logic — income
// ---------------------------------------------------------------------------

test('monthly income is the sum of the three sectors (FR-ECO-025)', () => {
  const house = DEFS.find((d) => d.id === 'res.house');
  const grocery = DEFS.find((d) => d.id === 'com.grocery');
  const warehouse = DEFS.find((d) => d.id === 'ind.warehouse');

  const breakdown = logic.incomeBreakdown(
    [{ def: house, level: 1 }, { def: grocery, level: 1 }, { def: warehouse, level: 1 }],
    { residents: 8 },
  );

  assert.equal(breakdown.bySector.residential, 8 * TUNING.monthlyTaxPerResident);
  assert.equal(breakdown.bySector.commercial, 6 * logic.TBD_VALUES.commercialIncomePerWorkspace);
  assert.equal(breakdown.bySector.industrial, 12 * logic.TBD_VALUES.industrialIncomePerJob);
  assert.equal(
    breakdown.total,
    breakdown.bySector.residential + breakdown.bySector.commercial + breakdown.bySector.industrial,
  );
});

test('a tax rate scales a sector and a local bonus stacks on top (F4/F11)', () => {
  const house = DEFS.find((d) => d.id === 'res.house');
  const park = DEFS.find((d) => d.id === 'prk.park');
  const base = logic.incomeFor([{ def: house, level: 1 }], { residents: 8 });
  const taxed = logic.incomeFor([{ def: house, level: 1 }], { residents: 8 }, {
    taxRates: { residential: 2 },
  });
  assert.equal(taxed, base * 2, 'the tax rate multiplies the base income');

  const withPark = logic.incomeFor(
    [{ def: house, level: 1, x: 1, z: 1 }],
    { residents: 8 },
    { emitters: [{ id: 'park', def: park, x: 0, z: 0, magnitude: 0.5 }] },
  );
  assert.equal(withPark, base * 1.5, 'a covering bonus multiplies the income');

  const withoutPark = logic.incomeFor(
    [{ def: house, level: 1, x: 40, z: 40 }],
    { residents: 8 },
    { emitters: [{ id: 'park', def: park, x: 0, z: 0, magnitude: 0.5 }] },
  );
  assert.equal(withoutPark, base, 'a bonus outside its area does not apply');
});

// ---------------------------------------------------------------------------
// Pure logic — bars
// ---------------------------------------------------------------------------

test('the demand bar is empty when covered and full when exhausted (F3)', () => {
  const covered = logic.demandBar(100, 80);
  assert.equal(covered.fill, 0);
  assert.equal(covered.unmet, 0);
  assert.equal(covered.covered, true);

  const short = logic.demandBar(100, 150);
  assert.equal(short.unmet, 50);
  assert.equal(short.fill, 0.5);

  const exhausted = logic.demandBar(100, 200);
  assert.equal(exhausted.fill, 1);
  assert.equal(exhausted.saturated, true);

  const noCapacity = logic.demandBar(0, 10);
  assert.equal(noCapacity.fill, 1);
  assert.ok(noCapacity.fill >= 0, 'a demand bar is never negative');
});

test('the usage bar handles the published edge cases (F1)', () => {
  const noSupply = logic.usageBar(0, 10);
  assert.equal(noSupply.pct, 100, 'no supply with consumption is 100 %, not a division by zero');

  const noDemand = logic.usageBar(50, 0);
  assert.equal(noDemand.pct, 0);
  assert.equal(noDemand.fill, 0);

  const nothing = logic.usageBar(0, 0);
  assert.equal(nothing.pct, 0);
  assert.ok(Number.isFinite(nothing.pct), 'zero over zero is not NaN');

  const half = logic.usageBar(100, 50);
  assert.equal(half.pct, 50);
  assert.equal(half.growthFactor, 1, 'below 90 % nothing is penalised');
});

test('the growth factor honours the published thresholds (F2)', () => {
  assert.equal(logic.growthFactor(0), 1);
  assert.equal(logic.growthFactor(89.999), 1);
  assert.ok(logic.growthFactor(90) < 1, 'the penalty applies FROM 90 %');
  assert.ok(logic.growthFactor(95) > 0, 'the city still grows between 90 and 100 %');
  assert.ok(logic.growthFactor(95) < logic.growthFactor(90), 'the curve is monotonic');
  assert.equal(logic.growthFactor(100), 0, 'at 100 % the city stops growing');
  assert.equal(logic.growthFactor(120), 0);
});

// ---------------------------------------------------------------------------
// Pure logic — chains
// ---------------------------------------------------------------------------

test('the food chain resolves plant -> animal -> processed (F6)', () => {
  const field = DEFS.find((d) => d.id === 'foo.field');
  const enclosure = DEFS.find((d) => d.id === 'foo.animal_enclosure');
  const factory = DEFS.find((d) => d.id === 'foo.factory');
  const barn = DEFS.find((d) => d.id === 'foo.pole_barn');

  const chains = logic.resolveChains([
    { def: field, x: 0, z: 0 },
    { def: enclosure, x: 1, z: 0 },
    { def: factory, x: 2, z: 0 },
    { def: barn, x: 0, z: 0 },
  ]);

  // The catalogue gives the pole barn a bonus area of its own, so the field
  // and the enclosure inside it are boosted as well as being gated.
  const boost = 1 + logic.TBD_VALUES.localProductionBonus;
  assert.equal(chains.food.production.plant, 30 * boost, 'the field produces plant food');
  assert.equal(chains.food.production.animal, 25 * boost, 'the enclosure is fed, so it produces');
  assert.equal(chains.food.production.processed, 45, 'the factory is fed, so it produces');
  assert.equal(chains.food.gated.plant, 0, 'the field is inside the pole barn');
  // 5 plant food for the enclosure + 5 plant food for the food industry
  assert.equal(chains.food.consumption.chain.plant, 10, 'the chain eats plant food');
  assert.equal(chains.food.consumption.chain.animal, 5, 'the food industry eats animal food');
});

test('a field outside every pole barn does not operate (FR-ECO-098)', () => {
  const field = DEFS.find((d) => d.id === 'foo.field');
  const barn = DEFS.find((d) => d.id === 'foo.pole_barn');

  const chains = logic.resolveChains([
    { def: field, x: 40, z: 40 },
    { def: barn, x: 0, z: 0 },
  ]);

  assert.equal(chains.food.production.plant, 0, 'no plant food without a pole barn');
  assert.equal(chains.food.gated.plant, 1, 'the field is reported as gated');
});

test('animals starve without fields and processed food needs both tiers', () => {
  const field = DEFS.find((d) => d.id === 'foo.field');
  const enclosure = DEFS.find((d) => d.id === 'foo.animal_enclosure');
  const factory = DEFS.find((d) => d.id === 'foo.factory');
  const barn = DEFS.find((d) => d.id === 'foo.pole_barn');

  const noFields = logic.resolveChains([
    { def: enclosure, x: 0, z: 0 },
    { def: factory, x: 1, z: 0 },
    { def: barn, x: 0, z: 0 },
  ]);
  assert.equal(noFields.food.production.animal, 0, 'no fields, no animal food');
  assert.equal(noFields.food.production.processed, 0, 'no animals, no processed food');

  const both = logic.resolveChains([
    { def: field, x: 0, z: 0 },
    { def: enclosure, x: 1, z: 0 },
    { def: factory, x: 2, z: 0 },
    { def: barn, x: 0, z: 0 },
  ]);
  assert.ok(both.food.production.processed > 0, 'with both tiers the factory runs');
  assert.ok(
    both.food.production.animal > both.food.consumption.chain.plant,
    'the animal chain is value-adding',
  );
});

test('a food area bonus never reaches an industrial food plant (FR-ECO-092)', () => {
  const field = DEFS.find((d) => d.id === 'foo.field');
  const enclosure = DEFS.find((d) => d.id === 'foo.animal_enclosure');
  const factory = DEFS.find((d) => d.id === 'foo.factory');
  const silo = DEFS.find((d) => d.id === 'foo.silo');
  const barn = DEFS.find((d) => d.id === 'foo.pole_barn');

  const chains = logic.resolveChains([
    { def: field, x: 0, z: 0 },
    { def: enclosure, x: 1, z: 0 },
    { def: factory, x: 12, z: 0 },
    { def: barn, x: 0, z: 0 },
    { def: silo, x: 10, z: 0 },
  ]);

  const boost = 1 + logic.TBD_VALUES.localProductionBonus;
  assert.equal(
    chains.food.production.plant, 30 * boost,
    'the silo boosts the field inside its area',
  );
  assert.equal(
    chains.food.production.processed, 45,
    'the silo covers the factory but does NOT boost industrial food production',
  );
});

test('the energy chain reports green and non-green separately (FR-ECO-083)', () => {
  const wind = def({ id: 'eng.wind', category: 'energy', production: { energy: 30 }, greenEnergy: true });
  const coal = DEFS.find((d) => d.id === 'eng.coal');
  const chains = logic.resolveChains([{ def: wind }, { def: coal }]);
  assert.equal(chains.energy.green, 30);
  assert.equal(chains.energy.nonGreen, 90);
  assert.equal(chains.energy.production, 120);
});

test('a harbour makes the map a member of the food and waste pool (FR-ECO-101)', () => {
  const harbour = DEFS.find((d) => d.id === 'trn.harbour_terminal');
  const pools = logic.poolMembership([{ def: harbour }]);
  assert.equal(pools.foodWaste.member, true);
  assert.equal(pools.foodWaste.globe, true);
  assert.equal(pools.energy.member, false, 'a harbour does not join the energy net');
  assert.equal(pools.water.member, false);
});

// ---------------------------------------------------------------------------
// Pure logic — ledger and budget
// ---------------------------------------------------------------------------

test('the ledger keeps only the newest entries', () => {
  let ledger = [];
  for (let i = 0; i < 10; i += 1) {
    ledger = logic.applyLedger(ledger, { amount: i }, 3);
  }
  assert.equal(ledger.length, 3);
  assert.equal(ledger[0].amount, 7);
  assert.equal(ledger[2].amount, 9);
  const untouched = logic.applyLedger([], { amount: 1 }, 3);
  assert.equal(untouched.length, 1);
});

test('a budget cut reduces the effective spend', () => {
  const impact = logic.budgetImpact({ health: 0.5 }, { health: 100, energy: 40 });
  assert.equal(impact.totalRequested, 140);
  assert.equal(impact.totalEffective, 90);
  assert.equal(impact.totalCut, 50);
  assert.equal(impact.byCategory.health.effective, 50);
  assert.equal(impact.byCategory.energy.effective, 40, 'an unlisted category stays fully funded');
});

// ---------------------------------------------------------------------------
// The domain service
// ---------------------------------------------------------------------------

test('the domain starts at the published treasury and spends what it earns', () => {
  const ctx = makeCtx();
  const eco = createEconomy(ctx);
  eco.init();

  assert.equal(eco.treasury(), TUNING.startingTreasury);
  assert.equal(eco.canAfford(100), true);
  assert.equal(eco.canAfford(TUNING.startingTreasury + 1), false);

  const spent = eco.spend(100, 'test');
  assert.equal(spent.ok, true);
  assert.equal(eco.treasury(), TUNING.startingTreasury - 100);

  const earned = eco.earn(50, 'test');
  assert.equal(earned.ok, true);
  assert.equal(eco.treasury(), TUNING.startingTreasury - 50);

  const ledger = eco.ledger();
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0].type, 'debit');
  assert.equal(ledger[1].type, 'credit');

  eco.dispose();
});

test('an unaffordable spend is refused and changes nothing (edge case 10)', () => {
  const ctx = makeCtx();
  const eco = createEconomy(ctx);
  eco.init();

  const before = eco.treasury();
  const result = eco.spend(before + 1, 'too-much');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'insufficient-funds');
  assert.equal(eco.treasury(), before, 'no partial charge');
  assert.equal(eco.ledger().length, 0, 'nothing is written to the ledger');

  const invalid = eco.spend(-5, 'negative');
  assert.equal(invalid.ok, false);
  assert.equal(invalid.reason, 'invalid-amount');

  eco.dispose();
});

test('the budget sliders publish a change event', () => {
  const ctx = makeCtx();
  const eco = createEconomy(ctx);
  eco.init();

  let seen = null;
  ctx.bus.on('economy:budget', (payload) => { seen = payload; });
  eco.applyBudget({ health: 0.25 });

  assert.equal(eco.budget().health, 0.25);
  assert.equal(eco.budget().energy, 1, 'the untouched categories stay fully funded');
  assert.ok(seen, 'BUDGET_CHANGED was emitted');
  assert.equal(seen.budget.health, 0.25);

  eco.dispose();
});

test('the monthly cycle settles the income and the upkeep', () => {
  const ctx = makeCtx();
  wireBuildings(ctx, [
    { id: 1, type: 'res.house', x: 0, z: 0 },
    { id: 2, type: 'com.grocery', x: 2, z: 0 },
    { id: 3, type: 'ind.warehouse', x: 4, z: 0 },
  ]);
  ctx.state.population.residents = 8;
  const eco = createEconomy(ctx);
  eco.init();

  const income = eco.monthlyIncome();
  const upkeep = eco.monthlyUpkeep();
  assert.equal(
    income,
    8 * TUNING.monthlyTaxPerResident
      + 6 * logic.TBD_VALUES.commercialIncomePerWorkspace
      + 12 * logic.TBD_VALUES.industrialIncomePerJob,
  );
  assert.equal(upkeep, 8 * TUNING.monthlyUpkeepPerUnit);

  const before = eco.treasury();
  eco.tick(logic.TBD_VALUES.monthSeconds);
  assert.equal(eco.treasury(), before + income - upkeep, 'the month settled');
  assert.equal(ctx.state.economy.month, 2, 'the month counter advanced');
  assert.ok(eco.report(), 'a period report was produced');
  assert.equal(eco.report().net, income - upkeep);

  eco.dispose();
});

test('a budget cut reduces the upkeep that is actually charged', () => {
  const ctx = makeCtx();
  wireBuildings(ctx, [
    { id: 1, type: 'res.house', x: 0, z: 0 },
    { id: 2, type: 'hea.hospital', x: 2, z: 0 },
  ]);
  const eco = createEconomy(ctx);
  eco.init();

  const full = eco.monthlyUpkeep();
  eco.applyBudget({ health: 0.5 });
  const cut = eco.monthlyUpkeep();
  assert.ok(cut < full, 'a cut lowers the upkeep that is charged');
  assert.equal(cut, full - 50, 'the health service is halved');

  eco.dispose();
});

test('placing a building charges the construction cost once (FR-ECO-046)', () => {
  const ctx = makeCtx();
  const map = wireBuildings(ctx, []);
  const eco = createEconomy(ctx);
  eco.init();

  const before = eco.treasury();
  ctx.bus.emit('build:placed', { id: 1, type: 'res.house', x: 0, z: 0, level: 1, cost: 120 });
  assert.equal(eco.treasury(), before - 120);

  // a duplicated event must not charge twice
  ctx.bus.emit('build:placed', { id: 1, type: 'res.house', x: 0, z: 0, level: 1, cost: 120 });
  assert.equal(eco.treasury(), before - 120);

  map.set(1, { id: 1, type: 'res.house', x: 0, z: 0, level: 1 });
  eco.dispose();
});

test('the construction slots are accounted for (FR-ECO-118/120)', () => {
  const ctx = makeCtx();
  wireBuildings(ctx, []);
  const eco = createEconomy(ctx);
  eco.init();

  assert.equal(eco.constructionSlots().total, 1, 'the player starts with one slot');
  assert.equal(eco.constructionSlots().used, 0);

  const coal = DEFS.find((d) => d.id === 'eng.coal');
  assert.equal(logic.constructionSlotsFor(coal), 2, 'a coal plant needs two slots');

  const check = eco.canStartConstruction(coal);
  assert.equal(check.ok, false);
  assert.equal(check.reason, 'not-enough-slots');
  assert.equal(check.required, 2);

  ctx.bus.emit('build:placed', { id: 7, type: 'eng.coal', x: 0, z: 0, level: 1, cost: 120 });
  assert.equal(eco.constructionSlots().used, 2, 'the two slots are occupied');
  assert.equal(eco.constructionSlots().free, 0);

  const progress = eco.constructionProgress(7);
  assert.ok(progress !== null && progress >= 0 && progress < 1, 'a construction is running');

  // a Citycon Building grants one more permanent slot (FR-ECO-020)
  ctx.bus.emit('build:placed', { id: 8, type: 'spl.citycon_building', x: 2, z: 0, level: 1, cost: 0 });
  assert.equal(eco.constructionSlots().total, 2);

  eco.dispose();
});

test('the demand and usage bars come from the same numbers as the report', () => {
  const ctx = makeCtx();
  wireBuildings(ctx, [{ id: 1, type: 'res.house', x: 0, z: 0 }]);
  ctx.state.population.residents = 8;
  const eco = createEconomy(ctx);
  eco.init();

  const overview = eco.overview();
  assert.equal(Object.keys(overview.demand).length, 3, 'three demand bars');
  assert.equal(Object.keys(overview.usage).length, 4, 'four usage bars');
  assert.equal(overview.usage.energy.production, 0);
  assert.equal(overview.usage.energy.consumption, 1);
  assert.equal(overview.usage.energy.pct, 100, 'no supply with consumption is saturated');
  assert.equal(overview.growthFactor, 0, 'the city stops growing without energy');

  eco.dispose();
});

test('the same state and the same actions give the same numbers (determinism)', () => {
  const run = () => {
    const ctx = makeCtx(99);
    wireBuildings(ctx, [
      { id: 1, type: 'res.house', x: 0, z: 0 },
      { id: 2, type: 'eng.coal', x: 3, z: 0 },
      { id: 3, type: 'foo.field', x: 6, z: 0 },
    ]);
    const eco = createEconomy(ctx);
    eco.init();
    eco.tick(logic.TBD_VALUES.monthSeconds);
    eco.applyBudget({ energy: 0.5 });
    eco.spend(250, 'same');
    return {
      treasury: eco.treasury(),
      income: eco.monthlyIncome(),
      upkeep: eco.monthlyUpkeep(),
      bars: eco.overview().usage,
    };
  };
  const a = run();
  const b = run();
  assert.deepEqual(a, b);
});

test('the city is never taxed for more residents than it has', () => {
  // Ten houses of eight residents each: eighty places. Fifty residents live
  // in them, so only fifty are taxed (a per-building cap would tax eighty).
  const ctx = makeCtx();
  const houses = [];
  for (let i = 0; i < 10; i += 1) houses.push({ id: i + 1, type: 'res.house', x: i, z: 0 });
  wireBuildings(ctx, houses);
  ctx.state.population.residents = 50;
  const eco = createEconomy(ctx);
  eco.init();

  const breakdown = logic.incomeBreakdown(
    collectAsInstances(houses),
    { residents: 50 },
  );
  assert.equal(
    breakdown.bySector.residential,
    50 * TUNING.monthlyTaxPerResident,
    'exactly the residents that live in the city are taxed',
  );
  assert.equal(eco.monthlyIncome(), 50 * TUNING.monthlyTaxPerResident);

  eco.dispose();
});

test('a settlement publishes the balance change exactly once', () => {
  const ctx = makeCtx();
  wireBuildings(ctx, [
    { id: 1, type: 'res.house', x: 0, z: 0 },
    { id: 2, type: 'hea.hospital', x: 2, z: 0 },
  ]);
  ctx.state.population.residents = 8;
  const eco = createEconomy(ctx);
  eco.init();

  const deltas = [];
  ctx.bus.on('economy:money', (payload) => deltas.push(payload.delta));
  eco.tick(logic.TBD_VALUES.monthSeconds);

  const income = eco.report().income;
  const upkeep = eco.report().upkeep;
  assert.equal(deltas.length, 2, 'one event for the income and one for the upkeep');
  assert.equal(deltas.reduce((a, b) => a + b, 0), income - upkeep, 'the deltas sum to the net');
  assert.equal(eco.treasury(), TUNING.startingTreasury + income - upkeep);

  eco.dispose();
});

test('the demand bar shows unmet demand when the city has residents', () => {
  const ctx = makeCtx();
  wireBuildings(ctx, [
    { id: 1, type: 'res.house', x: 0, z: 0 },
    { id: 2, type: 'com.grocery', x: 2, z: 0 },
  ]);
  ctx.state.population.residents = 40;
  const eco = createEconomy(ctx);
  eco.init();

  const bars = eco.demandBars();
  assert.ok(bars.commercial.fill > 0, 'forty residents and six shops leave a commercial gap');
  assert.ok(bars.commercial.unmet > 0);
  assert.equal(bars.residential.fill, 1, 'eight homes cannot house forty residents');

  eco.dispose();
});

test('the placement gate refuses when there are not enough construction slots', () => {
  const ctx = makeCtx();
  wireBuildings(ctx, []);
  const eco = createEconomy(ctx);
  eco.init();

  const coal = DEFS.find((d) => d.id === 'eng.coal');
  const house = DEFS.find((d) => d.id === 'res.house');

  const first = eco.canPlace(house);
  assert.equal(first.ok, true, 'one slot is free at the start');
  assert.equal(first.required, 1);

  ctx.bus.emit('build:placed', { id: 1, type: 'eng.coal', x: 0, z: 0, level: 1, cost: 120 });
  const blocked = eco.canPlace(coal);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'not-enough-slots');
  assert.equal(blocked.required, 2, 'the UI is told how many slots are needed');

  eco.dispose();
});

test('the bonus index never misses an emitter that covers a cell', () => {
  const park = DEFS.find((d) => d.id === 'prk.park');
  const emitters = [
    { id: 'a', def: park, x: 20, z: 20, magnitude: 0.1 },
    { id: 'b', def: park, x: 45, z: 45, magnitude: 0.1 },
    { id: 'c', def: park, x: 0, z: 0, magnitude: 0.1 },
  ];
  const index = logic.indexEmitters(emitters);
  const radius = park.bonusArea.radiusTiles;

  // Every cell inside an emitter's area must find that emitter.
  for (const emitter of emitters) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        const near = logic.emittersNear(index, emitter.x + dx, emitter.z + dz);
        assert.ok(
          near.includes(emitter),
          `the emitter at ${emitter.x},${emitter.z} covers ${emitter.x + dx},${emitter.z + dz}`,
        );
      }
    }
  }
  // A far-away cell finds nothing.
  assert.equal(logic.emittersNear(index, 63, 63).length, 0);
});

test('the pole barn gate never silences an energy producer', () => {
  const wind = def({ id: 'eng.wind', category: 'energy', production: { energy: 30 }, greenEnergy: true });
  const barn = DEFS.find((d) => d.id === 'foo.pole_barn');

  const chains = logic.resolveChains([
    { def: wind, x: 1, z: 1 },
    { def: barn, x: 0, z: 0 },
  ]);

  assert.equal(chains.energy.production, 30, 'the wind turbine next to a barn still produces');
  assert.equal(chains.energy.green, 30);
});

// ---------------------------------------------------------------------------
// The clock, the debt, and determinism
// ---------------------------------------------------------------------------

test('a build the player cannot afford books a debt instead of a negative balance', () => {
  const ctx = makeCtx();
  wireBuildings(ctx, []);
  const eco = createEconomy(ctx);
  eco.init();

  // Leave the player with less than a house costs.
  eco.spend(eco.treasury() - 10, 'drain');
  const before = eco.treasury();
  assert.equal(before, 10);

  ctx.bus.emit('build:placed', { id: 1, type: 'res.house', x: 0, z: 0, level: 1, cost: 120 });

  assert.equal(eco.treasury(), before, 'a failed charge must not change the balance');
  assert.ok(eco.treasury() >= 0, 'a player-initiated spend must never go negative');
  const houseDebits = eco.ledger().filter((e) => e.type === 'debit' && String(e.reason).includes('res.house'));
  assert.equal(houseDebits.length, 0, 'a failed charge must not write a debit');
  assert.equal(eco.debt(), 120, 'the real cost is booked as outstanding debt');
  assert.ok(eco.ledger().some((e) => e.type === 'debt'), 'the debt is on the ledger');

  eco.dispose();
});

test('outstanding debt is settled at the next monthly settlement', () => {
  const ctx = makeCtx();
  wireBuildings(ctx, []);
  const eco = createEconomy(ctx);
  eco.init();

  eco.spend(eco.treasury() - 10, 'drain');
  ctx.bus.emit('build:placed', { id: 1, type: 'res.house', x: 0, z: 0, level: 1, cost: 120 });
  assert.equal(eco.debt(), 120);

  // A month is `TBD_VALUES.monthSeconds` seconds of game time.
  eco.tick(logic.TBD_VALUES.monthSeconds + 1);

  assert.equal(eco.debt(), 0, 'the debt is settled at the settlement');
  assert.ok(eco.ledger().some((e) => e.reason === 'debt-settlement'), 'the settlement is on the ledger');

  eco.dispose();
});

test('an injected clock makes the economy reproducible', () => {
  const run = () => {
    const ctx = makeCtx();
    wireBuildings(ctx, []);
    const eco = createEconomy(ctx);
    eco.init();
    let t = 1_000_000;
    eco.setClock(() => t);
    t += 5_000;
    ctx.bus.emit('build:placed', { id: 1, type: 'res.house', x: 0, z: 0, level: 1, cost: 120 });
    t += 5_000;
    eco.tick(logic.TBD_VALUES.monthSeconds + 1);
    t += 1_000;
    const out = {
      treasury: eco.treasury(),
      debt: eco.debt(),
      ledger: eco.ledger().map((e) => ({ ...e })),
    };
    eco.dispose();
    return out;
  };

  const a = run();
  const b = run();
  assert.deepEqual(a, b, 'two identical runs must produce identical books');
  assert.ok(a.ledger.length > 0, 'the ledger must not be empty');
  assert.ok(a.ledger.every((e) => Number.isFinite(e.at)), 'every ledger stamp is a finite time');
  assert.equal(a.ledger[0].at, 1_005_000, 'the stamp comes from the injected clock');
});

test('a clock that is not a function is refused', () => {
  const ctx = makeCtx();
  const eco = createEconomy(ctx);
  eco.init();
  assert.equal(eco.setClock(42).ok, false);
  assert.equal(eco.setClock(null).reason, 'invalid-clock');
  eco.dispose();
});

test('an upgrade the player cannot afford books a debt, not a free upgrade', () => {
  const ctx = makeCtx();
  wireBuildings(ctx, []);
  const eco = createEconomy(ctx);
  eco.init();

  // Leave the player with less than an upgrade costs.
  eco.spend(eco.treasury() - 10, 'drain');
  const before = eco.treasury();
  assert.equal(before, 10);

  ctx.bus.emit('build:upgraded', { id: 1, type: 'res.house', x: 0, z: 0, level: 2, cost: 120 });

  assert.equal(eco.treasury(), before, 'a failed upgrade charge must not change the balance');
  assert.ok(eco.treasury() >= 0, 'the balance must never go negative');
  const debits = eco.ledger().filter((e) => e.type === 'debit' && String(e.reason).includes('upgrade'));
  assert.equal(debits.length, 0, 'a failed charge must not write a debit');
  assert.equal(eco.debt(), 120, 'the cost is booked as outstanding debt');

  eco.dispose();
});
