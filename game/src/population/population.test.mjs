/**
 * population/population.test.mjs — the POP unit tests.
 *
 * Run with:  node --test src/population/population.test.mjs
 *
 * These tests cover the pure score maths AND the POP domain service:
 *   - the published 1.65 -> 129 % wealth example
 *   - the 250 % per-category cap
 *   - the six-category sum
 *   - the happiness breakdown summing to the total
 *   - the migration pressure sign
 *   - the loyalty growth and decay
 *   - the household derivation from placed residential buildings
 *   - determinism (the same seed -> the same result)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { TUNING, makeRng } from '../core/config.js';
import { createState, setState, state as liveState } from '../core/state.js';
import { EVENTS, on, off, once, emit } from '../core/events.js';

import {
  needsBreakdown, residentBonus, bonusMultiplier, migrationPressure, loyaltyFor,
  wealthBonusPct, pointsBonusPct, diversityBonusPct, loyaltyBonusPct,
  BONUS_CATEGORIES, CATEGORY_CAP,
} from './happiness.js';
import {
  householdsFor, capacityFor, bonusComponents, resolveResidents, installCatalogue,
  setDefinitionLookup, HOUSEHOLD_SIZE,
} from './population.js';
import { createPopulation } from './index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const bus = { on, off, once, emit };

function makeCtx(seed = 20261023) {
  const state = createState(seed);
  return {
    state,
    bus,
    config: { TUNING },
    rng: makeRng(seed),
    domains: {},
    assets: undefined,
    renderer: undefined,
    manifest: undefined,
  };
}

/** A placed building instance of a real catalogue entry. */
function instance(type, x, z, level = 1, id = 1) {
  return { id, type, defId: type, x, z, rot: 0, level, tier: level, cells: [{ x, z }] };
}

await installCatalogue();

// ---------------------------------------------------------------------------
// 1. The published wealth example
// ---------------------------------------------------------------------------

test('the published wealth example: level 1.65 earns 129 %', () => {
  assert.equal(wealthBonusPct(1.65), 129, 'the published 1.65 -> 129 % anchor');
  assert.equal(wealthBonusPct(3), 250, 'wealth level 3 earns the full cap');
  assert.equal(wealthBonusPct(1.65), CATEGORY_CAP - 121);
});

test('a map whose average wealth level is 1.65 earns 129 %', () => {
  // 13 houses (wealth 1) + 1 luxury apartment (wealth 2) + 6 skyscrapers
  // (wealth 3) = 33 wealth points over 20 wealth-carrying buildings.
  const instances = [];
  let id = 1;
  for (let i = 0; i < 13; i += 1) instances.push(instance('res.house', i, 0, 1, id++));
  instances.push(instance('res.luxury_apartment', 20, 0, 1, id++));
  for (let i = 0; i < 6; i += 1) instances.push(instance('res.skyscraper', 30 + i, 0, 1, id++));

  const components = bonusComponents(instances, 1000);
  assert.equal(components.wealth, 129, 'the map earns the published 129 % wealth bonus');
});

test('the wealth average only counts the buildings that carry a wealth value', () => {
  // A park carries no wealth value, so it must not dilute the average.
  const withNeutral = bonusComponents([
    instance('res.luxury_apartment', 0, 0, 1, 1), // wealth 2
    instance('com.grocery', 1, 0, 1, 2), // wealth 1
    instance('prk.park', 2, 0, 1, 3), // no wealth value at all
  ], 1000);
  const withoutNeutral = bonusComponents([
    instance('res.luxury_apartment', 0, 0, 1, 1), // wealth 2
    instance('com.grocery', 1, 0, 1, 2), // wealth 1
  ], 1000);
  assert.equal(withNeutral.wealth, withoutNeutral.wealth, 'a wealth-neutral building changes nothing');
  assert.equal(withoutNeutral.wealth, wealthBonusPct(1.5), 'the average is over the two wealth values');
});

// ---------------------------------------------------------------------------
// 2. The 250 % cap and the six-category sum
// ---------------------------------------------------------------------------

test('no category ever exceeds the 250 % cap', () => {
  assert.equal(CATEGORY_CAP, 250);
  assert.equal(pointsBonusPct(10, 10000), 250, 'ten points for ten thousand residents');
  assert.equal(pointsBonusPct(99999, 1000), 250, 'the cap holds');
  assert.equal(pointsBonusPct(3, 10000), 75, 'three of ten required points earns 75 %');
  assert.equal(pointsBonusPct(0, 10000), 0, 'no points earns nothing');
  assert.equal(diversityBonusPct(9999), 250, 'the diversity cap holds');
  assert.equal(loyaltyBonusPct(1000), 250, 'the loyalty cap holds');
  assert.equal(wealthBonusPct(99), 250, 'the wealth cap holds');
  assert.equal(wealthBonusPct(0), 0, 'a map with no wealth earns nothing');
  assert.equal(wealthBonusPct(0.1), 0, 'below the base level there is nothing');
});

test('the six bonuses sum up to the residence bonus', () => {
  const components = {
    culture: 100, entertainment: 50, recreation: 25, wealth: 129, diversity: 40, loyalty: 10,
  };
  assert.equal(residentBonus(components), 354);
  assert.equal(Object.keys(components).length, 6);
  assert.deepEqual([...BONUS_CATEGORIES], [
    'culture', 'entertainment', 'recreation', 'wealth', 'diversity', 'loyalty',
  ]);
  assert.equal(residentBonus({}), 0);
  assert.equal(residentBonus(null), 0);
});

test('the bonus components always carry all six categories', () => {
  const components = bonusComponents([instance('res.house', 0, 0, 1, 1)], 1000);
  assert.deepEqual(Object.keys(components).sort(), [...BONUS_CATEGORIES].sort());
});

// ---------------------------------------------------------------------------
// 3. The multiplier and the x15 / x16 ceiling
// ---------------------------------------------------------------------------

test('the multiplier honours the published ceiling', () => {
  const sixAtTheCap = {
    culture: 250, entertainment: 250, recreation: 250, wealth: 250, diversity: 250, loyalty: 250,
  };
  assert.equal(residentBonus(sixAtTheCap), 1500);
  // The additive reading of the dossier's formula would be x16 ...
  assert.equal(1 + residentBonus(sixAtTheCap) / 100, 16);
  // ... but the published x15 headline is the ceiling that wins.
  assert.equal(bonusMultiplier(sixAtTheCap), TUNING.bonusCeiling);
  assert.equal(bonusMultiplier(sixAtTheCap), 15);
});

test('the multiplier is one when there is no bonus', () => {
  assert.equal(bonusMultiplier({}), 1);
  assert.equal(bonusMultiplier({ culture: 250 }), 3.5, 'one full category is x3.5');
});

test('the bonus is gated by the happiness and the base capacity is untouched', () => {
  const components = { culture: 250 };
  assert.equal(bonusMultiplier(components, { happiness: 100 }), 3.5, 'a happy city earns the full bonus');
  // The saturation point is TUNING.bonusSaturation of the happiness scale.
  const half = bonusMultiplier(components, { happiness: TUNING.happinessMax * TUNING.bonusSaturation / 2 });
  assert.ok(half > 1 && half < 3.5, 'a half happy city earns part of the bonus');
  assert.equal(bonusMultiplier(components, { happiness: 0 }), 1, 'a miserable city earns no bonus');
});

// ---------------------------------------------------------------------------
// 4. The happiness breakdown
// ---------------------------------------------------------------------------

test('the happiness breakdown sums to the total', () => {
  const state = createState(1);
  state.population.total = 40;
  state.population.employed = 20;
  state.population.housingCapacity = 50;
  state.services.cityCoverage = { health: 1, police: 1, fire: 1, education: 1, water: 0, waste: 0, energy: 0, food: 0 };

  const breakdown = needsBreakdown(state, [], { housingCapacity: 50, employed: 20 });
  const sum = Object.values(breakdown.needs).reduce((a, b) => a + b, 0);
  assert.equal(Math.round(sum * 1e6) / 1e6, Math.round(breakdown.total * 1e6) / 1e6, 'the needs sum to the total');
  assert.equal(breakdown.average, breakdown.total / Object.keys(breakdown.needs).length);
  assert.ok(breakdown.total >= TUNING.happinessMin && breakdown.total <= TUNING.happinessMax);
});

test('a perfect city is perfectly happy and an unserved city is not', () => {
  const state = createState(1);
  state.population.total = 100;
  state.population.employed = 100;
  state.services.cityCoverage = {
    health: 1, police: 1, fire: 1, education: 1, water: 1, waste: 1, energy: 1, food: 1,
  };
  const perfect = needsBreakdown(state, [], { housingCapacity: 100, employed: 100 });
  assert.equal(perfect.total, TUNING.happinessMax, 'everything perfect is the maximum happiness');

  const unserved = needsBreakdown(state, [], { housingCapacity: 100, employed: 0 });
  assert.ok(unserved.total < perfect.total, 'no jobs and no coverage is worse');
  assert.ok(unserved.total > TUNING.happinessMin);
});

// ---------------------------------------------------------------------------
// 5. The migration pressure
// ---------------------------------------------------------------------------

test('the migration pressure is negative below the migration threshold', () => {
  assert.ok(migrationPressure(0, 0) < 0, 'a miserable city pushes people away');
  assert.ok(migrationPressure(TUNING.migrationThreshold - 1, 0) < 0, 'below the threshold it is negative');
  assert.equal(Math.sign(migrationPressure(TUNING.migrationThreshold, 50)), 0, 'at the threshold it is neutral');
});

test('the migration pressure is positive above the migration threshold', () => {
  assert.ok(migrationPressure(TUNING.happinessMax, 100) > 0, 'a happy city attracts people');
  assert.ok(migrationPressure(60, 50) > 0);
  assert.ok(migrationPressure(50, 0) < 0, 'a happy but disloyal city still loses people');
  assert.ok(migrationPressure(100, 100) <= 1 && migrationPressure(0, 0) >= -1, 'the pressure is bounded');
});

// ---------------------------------------------------------------------------
// 6. The loyalty
// ---------------------------------------------------------------------------

test('the loyalty grows with a care streak and decays without one', () => {
  assert.equal(loyaltyFor(1, 50), 51, 'a cared-for day adds a point');
  assert.equal(loyaltyFor(10, 50), 60);
  assert.equal(loyaltyFor(-1, 50), 49, 'a missed day takes a point');
  assert.equal(loyaltyFor(-10, 50), 40);
  assert.equal(loyaltyFor(-100, 50), 0, 'the loyalty never goes below zero');
  assert.equal(loyaltyFor(100, 50), 100, 'the loyalty never goes above the maximum');
});

// ---------------------------------------------------------------------------
// 7. The capacity and the households
// ---------------------------------------------------------------------------

test('the households are derived from the placed residential buildings', () => {
  const one = [instance('res.house', 0, 0, 1, 1)];
  assert.equal(capacityFor(one), TUNING.residentsPerLevel1);
  assert.equal(householdsFor(one), Math.ceil(TUNING.residentsPerLevel1 / HOUSEHOLD_SIZE));

  const three = [
    instance('res.house', 0, 0, 1, 1),
    instance('res.apartment', 2, 0, 1, 2),
    instance('res.luxury_apartment', 4, 0, 1, 3),
  ];
  const capacity = capacityFor(three);
  assert.equal(capacity, TUNING.residentsPerLevel1 + 16 + 40);
  assert.equal(householdsFor(three), Math.ceil(capacity / HOUSEHOLD_SIZE));
  assert.equal(capacityFor([]), 0, 'an empty map has no capacity');
  assert.equal(householdsFor([]), 0);
});

test('a non-residential building adds no housing', () => {
  assert.equal(capacityFor([instance('com.grocery', 0, 0, 1, 1)]), 0);
  assert.equal(householdsFor([instance('com.grocery', 0, 0, 1, 1)]), 0);
});

test('a level-2 house houses more residents than a level-1 house', () => {
  const level1 = capacityFor([instance('res.house', 0, 0, 1, 1)]);
  const level2 = capacityFor([instance('res.house', 0, 0, 2, 1)]);
  assert.ok(level2 > level1, 'upgrading adds residents');
  assert.equal(level2, TUNING.residentsPerLevel1 + TUNING.residentsPerUpgrade);
});

// ---------------------------------------------------------------------------
// 8. The resident fixed point
// ---------------------------------------------------------------------------

test('the resident fixed point settles on a derived number', () => {
  const instances = [instance('res.house', 0, 0, 1, 1)];
  const capacity = capacityFor(instances);
  const solved = resolveResidents({ capacity, instances, start: 0, happiness: 100 });
  assert.ok(Number.isInteger(solved.residents), 'the resident count is an integer');
  assert.ok(solved.residents >= capacity, 'the bonus scales the capacity up');
  assert.equal(solved.residents, Math.round(capacity * solved.multiplier));
  // Solving again from the settled value must not move it.
  const again = resolveResidents({ capacity, instances, start: solved.residents, happiness: 100 });
  assert.equal(again.residents, solved.residents, 'the fixed point is stable');
});

// ---------------------------------------------------------------------------
// 9. The domain service
// ---------------------------------------------------------------------------

test('the domain derives the population from the housing', async () => {
  const ctx = makeCtx();
  ctx.state.buildings.instances.set(1, instance('res.house', 4, 4, 1, 1));
  const pop = createPopulation(ctx);
  await pop.init();

  assert.equal(pop.households(), Math.ceil(TUNING.residentsPerLevel1 / HOUSEHOLD_SIZE));

  // The population is DERIVED: it is written into the state as soon as the
  // housing is known, not only after a migration wave.
  assert.ok(pop.population() > 0, 'the residents are already housed');
  assert.equal(pop.population(), ctx.state.population.total, 'the domain and the state agree');
  assert.equal(
    pop.population(),
    Math.round(ctx.state.population.housingCapacity * ctx.state.population.multiplier),
    'total = round(housingCapacity x multiplier)',
  );

  pop.tick(1);
  assert.ok(pop.population() > 0, 'the residents stayed');
  assert.equal(pop.population(), ctx.state.population.total, 'the domain and the state still agree');
  assert.ok(pop.happiness() >= TUNING.happinessMin && pop.happiness() <= TUNING.happinessMax);
  assert.ok(pop.loyalty() >= 0 && pop.loyalty() <= 100);
  pop.dispose();
});

test('the happiness breakdown is published by the domain', async () => {
  const ctx = makeCtx();
  ctx.state.buildings.instances.set(1, instance('res.house', 4, 4, 1, 1));
  const pop = createPopulation(ctx);
  await pop.init();
  pop.tick(1);

  const breakdown = pop.happinessBreakdown();
  assert.ok(breakdown.needs && typeof breakdown.needs === 'object');
  assert.ok(Object.keys(breakdown.needs).length >= 5, 'every need has a contribution');
  const sum = Object.values(breakdown.needs).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - breakdown.total) < 0.001, 'the needs sum to the total');
  pop.dispose();
});

test('residents can be added and removed', async () => {
  const ctx = makeCtx();
  const pop = createPopulation(ctx);
  await pop.init();

  pop.addCitizens(25);
  assert.equal(pop.population(), 25);
  pop.removeCitizens(10);
  assert.equal(pop.population(), 15);
  pop.removeCitizens(1000);
  assert.equal(pop.population(), 0, 'the population never goes negative');
  pop.addCitizens(-5);
  assert.equal(pop.population(), 0, 'a negative addition is ignored');
  pop.dispose();
});

test('the population, happiness and loyalty are announced on the bus', async () => {
  const ctx = makeCtx();
  ctx.state.buildings.instances.set(1, instance('res.house', 4, 4, 1, 1));

  let populationEvents = 0;
  let happinessEvents = 0;
  let loyaltyEvents = 0;
  const un1 = on(EVENTS.POPULATION_CHANGED, (p) => {
    populationEvents += 1;
    assert.equal(typeof p.total, 'number', 'the payload carries the total the HUD reads');
  });
  const un2 = on(EVENTS.HAPPINESS_CHANGED, () => { happinessEvents += 1; });
  const un3 = on(EVENTS.LOYALTY_CHANGED, () => { loyaltyEvents += 1; });

  const pop = createPopulation(ctx);
  await pop.init();
  assert.ok(populationEvents > 0, 'the first residents were announced');

  // A second house: more housing, more residents, another announcement.
  const before = populationEvents;
  ctx.state.buildings.instances.set(2, instance('res.house', 6, 4, 1, 2));
  pop.tick(1);
  assert.ok(populationEvents > before, 'the population change was announced again');

  pop.tick(1);
  un1(); un2(); un3();
  assert.ok(happinessEvents > 0, 'the happiness change was announced');
  pop.dispose();
});

test('an unhappy city runs a migration wave', async () => {
  /** Build a city, then starve it and count who leaves. */
  const run = async (advanceDay) => {
    const ctx = makeCtx();
    ctx.state.buildings.instances.set(1, instance('res.house', 4, 4, 1, 1));
    const pop = createPopulation(ctx);
    await pop.init();
    pop.tick(1);
    pop.tick(1);
    pop.tick(1);
    const grown = pop.population();
    assert.ok(grown > 0, 'there are residents to lose');

    // The supply collapses: no supply adequacy (the happiness input) and no
    // growth (the throttle). ECO publishes both.
    ctx.state.economy.supplyAdequacy = 0;
    ctx.state.economy.growthFactor = 0;
    pop.tick(1);
    assert.ok(pop.happiness() < TUNING.migrationThreshold, `the city is unhappy (${pop.happiness()})`);

    const before = pop.population();
    if (advanceDay) ctx.state.meta.day += 1;
    pop.tick(1);
    const after = pop.population();
    pop.dispose();
    return { before, after, migration: ctx.state.population.migration };
  };

  const ordinary = await run(false);
  const wave = await run(true);

  assert.ok(wave.after < wave.before, 'the citizens left');
  assert.ok(wave.migration < 0, 'the migration pressure is negative');
  assert.ok(
    wave.before - wave.after > ordinary.before - ordinary.after,
    'a wave day empties the city faster than an ordinary day',
  );
});

test('the domain survives without a renderer or an asset service', async () => {
  const ctx = makeCtx();
  const pop = createPopulation(ctx);
  await pop.init();
  pop.tick(1);
  assert.equal(pop.citizenCount(), 0, 'no characters can be drawn without an asset service');
  assert.equal(pop.spawnCitizen(), null, 'spawning without characters is a no-op');
  assert.equal(pop.despawnCitizen(), false);
  pop.update(0.016);
  pop.dispose();
});

// ---------------------------------------------------------------------------
// 10. Determinism
// ---------------------------------------------------------------------------

test('the same seed and the same actions produce the same population', async () => {
  const run = async () => {
    const ctx = makeCtx(987654);
    ctx.state.economy.supplyAdequacy = 0.8;
    ctx.state.buildings.instances.set(1, instance('res.house', 4, 4, 1, 1));
    ctx.state.buildings.instances.set(2, instance('res.apartment', 8, 4, 1, 2));
    ctx.state.buildings.instances.set(3, instance('com.office_block', 12, 4, 1, 3));
    ctx.state.buildings.instances.set(4, instance('hea.hospital', 16, 4, 1, 4));
    ctx.state.services.cityCoverage = { health: 0.8, police: 0, fire: 0, education: 0, water: 0, waste: 0, energy: 0, food: 0 };

    const pop = createPopulation(ctx);
    await pop.init();
    for (let i = 0; i < 5; i += 1) pop.tick(1);
    const snapshot = JSON.stringify({
      population: pop.population(),
      happiness: pop.happiness(),
      loyalty: pop.loyalty(),
      households: pop.households(),
      breakdown: pop.happinessBreakdown(),
      bonus: pop.bonusBreakdown(),
      migration: ctx.state.population.migration,
    });
    pop.dispose();
    return snapshot;
  };

  const a = await run();
  const b = await run();
  assert.equal(a, b, 'two identical runs agree exactly');
});


// ---------------------------------------------------------------------------
// 11. The integration acceptance tests
// ---------------------------------------------------------------------------

test('ACCEPTANCE: a house produces residents, and a wave takes them away', async () => {
  const ctx = makeCtx();
  ctx.state.buildings.instances.set(1, instance('res.house', 4, 4, 1, 1));
  const pop = createPopulation(ctx);
  await pop.init();

  // One level-1 residential building.
  pop.tick(1);

  assert.ok(ctx.state.population.total > 0, 'the house houses residents');
  assert.equal(pop.population(), ctx.state.population.total, 'the domain and the state agree');
  assert.equal(
    pop.population(),
    Math.round(ctx.state.population.housingCapacity * ctx.state.population.multiplier),
    'the population is derived from the housing',
  );

  // The migration wave takes them away.
  ctx.state.economy.supplyAdequacy = 0;
  ctx.state.economy.growthFactor = 0;
  pop.tick(1);
  assert.ok(pop.happiness() < TUNING.migrationThreshold, 'the city is unhappy');

  const before = ctx.state.population.total;
  ctx.state.meta.day += 1;
  pop.tick(1);
  assert.ok(ctx.state.population.total < before, 'the wave reduced the population');
  assert.ok(ctx.state.population.migration < 0, 'the migration pressure is negative');
  assert.equal(pop.population(), ctx.state.population.total, 'the domain and the state still agree');
  pop.dispose();
});

test('the population recovers when the city is happy again', async () => {
  const ctx = makeCtx();
  ctx.state.buildings.instances.set(1, instance('res.house', 4, 4, 1, 1));
  const pop = createPopulation(ctx);
  await pop.init();
  pop.tick(1);

  // Starve the city, then wave.
  ctx.state.economy.supplyAdequacy = 0;
  ctx.state.economy.growthFactor = 0;
  pop.tick(1);
  ctx.state.meta.day += 1;
  pop.tick(1);
  const afterWave = ctx.state.population.total;
  assert.ok(ctx.state.population.migrationDeficit > 0, 'the wave left a deficit');

  // The city is cared for again: the deficit heals and the residents return.
  ctx.state.economy.supplyAdequacy = 1;
  ctx.state.economy.growthFactor = 1;
  for (let i = 0; i < 20; i += 1) pop.tick(1);
  assert.ok(ctx.state.population.migrationDeficit < 0.01, 'the deficit healed');
  assert.ok(ctx.state.population.total > afterWave, 'the residents came back');
  pop.dispose();
});

test('an explicit adjustment survives the next tick', async () => {
  const ctx = makeCtx();
  ctx.state.buildings.instances.set(1, instance('res.house', 4, 4, 1, 1));
  const pop = createPopulation(ctx);
  await pop.init();
  pop.tick(1);

  const derived = ctx.state.population.total;
  pop.addCitizens(25);
  assert.equal(ctx.state.population.total, derived + 25, 'the adjustment is applied');
  pop.tick(1);
  assert.ok(
    ctx.state.population.total >= derived + 24,
    'the next tick reconciles, it does not reset the adjustment',
  );

  pop.removeCitizens(10);
  assert.ok(ctx.state.population.total < derived + 25, 'the removal is applied');
  pop.tick(1);
  assert.ok(ctx.state.population.total >= derived + 14, 'the removal survived the tick too');
  pop.dispose();
});

test('the domain survives the state tree being replaced (the load path)', async () => {
  // main.js builds ctx.state as a GETTER, and core/state.js `setState()`
  // REPLACES the tree. A domain that captured ctx.state would go on writing
  // into the orphaned object while the live tree stayed empty.
  const ctx = {
    get state() { return liveState; },
    bus,
    config: { TUNING },
    rng: makeRng(7),
    domains: {},
    assets: undefined,
    renderer: undefined,
  };
  const pop = createPopulation(ctx);
  await pop.init();

  setState(createState(7));
  const fresh = liveState;
  fresh.buildings.instances.set(1, instance('res.house', 4, 4, 1, 1));
  pop.tick(1);

  assert.ok(fresh.population.total > 0, 'the LIVE tree carries the residents');
  assert.equal(pop.population(), fresh.population.total, 'the domain and the live tree agree');
  assert.equal(fresh.population.housingCapacity, TUNING.residentsPerLevel1, 'the capacity is live too');
  pop.dispose();
});
