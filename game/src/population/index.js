/**
 * population/index.js — the POP domain service.
 *
 * OWNER: POP. The integrator calls (see core/CONTRACT.md §7):
 *   createPopulation(ctx) -> {
 *     init, update, tick,
 *     population(),          // resident count
 *     happiness(),          // 0..100
 *     loyalty(),            // 0..100
 *     households(),
 *     addCitizens(n), removeCitizens(n),
 *     happinessBreakdown(), // { needs: {name: contribution}, total, average }
 *     spawnCitizen(), despawnCitizen(),
 *     citizenCount(),       // number of rendered citizen entities
 *     dispose
 *   }
 *
 * The rules live in the two pure modules next to this file:
 *   happiness.js   the score maths (the six bonuses, happiness, migration)
 *   population.js  the capacity maths (households, capacity, the fixed point)
 *
 * The citizens are drawn by citizens.js, which is the only POP file that
 * imports `three`.
 *
 * POP never imports a sibling domain: it reads the shared state and listens
 * on the event bus.
 */

import { EVENTS } from '../core/events.js';
import { TUNING } from '../core/config.js';
import { liveStateProxy } from '../core/state.js';
import {
  needsBreakdown, migrationPressure, loyaltyFor, residentBonus, bonusMultiplier,
} from './happiness.js';
import {
  capacityFor, householdsFor, jobsFor, resolveResidents,
  installCatalogue, setDefinitionLookup, getDefinitionLookup,
} from './population.js';
import { createCitizens, MAX_RENDERED_CITIZENS } from './citizens.js';

/**
 * TBD: how much of the population leaves in one migration wave.
 *
 * The publisher published no emigration rule at all - the dossier records
 * emigration as a [TBD - design decision] (FR-POP-091/107, OQ-POP-11). This
 * is the rebuild's default: 5 % of the residents leave per wave.
 * Proposed TUNING key: `migrationWaveRate` = 0.05.
 */
export const MIGRATION_WAVE_RATE = 0.05;

/**
 * TBD: how fast a migration wave's effect heals, per second of game time.
 *
 * A migration wave takes a share of the residents; when the city is happy
 * again that share fades back, so the population recovers (FR-POP-107/108).
 * The healing is exponential: `deficit *= (1 - rate * dt)`.
 * Proposed TUNING key: `migrationRecoveryRate` = 0.1.
 */
export const MIGRATION_RECOVERY_RATE = 0.1;

/**
 * How much the happiness may move before the change is worth announcing.
 */
// TBD: proposed TUNING key: `happinessChangeEpsilon`.
const HAPPINESS_EPSILON = 0.5;

/**
 * Create the POP service.
 * @param {object} ctx the shared context (core/CONTRACT.md §1)
 */
export function createPopulation(ctx) {
  /**
   * The live state tree.
   *
   * `ctx.state` is a GETTER in main.js (core/state.js `setState()` REPLACES
   * the state object when a save is loaded or the game is reset), so a
   * captured `ctx.state` would be an ORPHANED tree: the domain would keep
   * writing into an object nobody reads while the live tree stayed at zero.
   * Every access therefore resolves through `ctx.state` again.
   */
  const state = liveStateProxy(ctx);
  const bus = ctx.bus;
  const citizens = createCitizens(ctx);

  let breakdown = { needs: {}, total: 0, average: 0 };
  let components = null;
  let multiplier = 1;
  /** The population the housing supports: round(capacity x multiplier). */
  let derived = 0;
  let capacity = 0;
  let households = 0;
  let jobs = 0;
  let employed = 0;
  let lastDay = null;
  let lastHappiness = null;
  let lastLoyalty = null;
  let lastPopulation = null;
  let disposed = false;
  const unsubscribes = [];

  // -------------------------------------------------------------------------
  // State plumbing
  // -------------------------------------------------------------------------

  function ensureState() {
    const p = state.population;
    if (!p || typeof p !== 'object') {
      state.population = {
        total: 0, happiness: 60, loyalty: 50, households: 0, needs: {},
        citizens: [], migration: 0, employed: 0, unemployed: 0,
      };
      return;
    }
    if (typeof p.total !== 'number') p.total = 0;
    if (typeof p.happiness !== 'number') p.happiness = 60;
    if (typeof p.loyalty !== 'number') p.loyalty = 50;
    if (typeof p.households !== 'number') p.households = 0;
    if (!p.needs || typeof p.needs !== 'object') p.needs = {};
    if (!Array.isArray(p.citizens)) p.citizens = [];
    if (typeof p.migration !== 'number') p.migration = 0;
    if (typeof p.employed !== 'number') p.employed = 0;
    if (typeof p.unemployed !== 'number') p.unemployed = 0;
    // The fields POP publishes for the other domains.
    if (typeof p.housingCapacity !== 'number') p.housingCapacity = 0;
    if (typeof p.jobs !== 'number') p.jobs = 0;
    if (typeof p.loyaltyStreak !== 'number') p.loyaltyStreak = 0;
    /**
     * The share of the population a migration wave took (0..1). It heals
     * when the city is happy again.
     */
    if (typeof p.migrationDeficit !== 'number') p.migrationDeficit = 0;
    /**
     * The explicit adjustment `addCitizens()` / `removeCitizens()` made on
     * top of the derived figure. It is RECONCILED, never reset by a tick.
     */
    if (typeof p.manualOffset !== 'number') p.manualOffset = 0;
    /** The growth throttle ECO publishes (published for the UI). */
    if (typeof p.growthFactor !== 'number') p.growthFactor = 1;
    if (!p.bonus || typeof p.bonus !== 'object') p.bonus = {};
  }

  // -------------------------------------------------------------------------
  // Buildings
  // -------------------------------------------------------------------------

  /** Every placed building instance. */
  function buildingInstances() {
    const bld = ctx.domains?.buildings;
    if (bld && typeof bld.instances === 'function') {
      try {
        const list = bld.instances();
        if (Array.isArray(list)) return list;
      } catch { /* fall through to the state */ }
    }
    const map = state.buildings?.instances;
    if (map instanceof Map) return Array.from(map.values());
    if (Array.isArray(map)) return map;
    return [];
  }

  /** The catalogue entry of an instance. */
  function definitionOf(instance) {
    const host = ctx.domains?.buildings;
    const lookup = typeof host?.getDefinition === 'function' ? host.getDefinition : getDefinitionLookup();
    if (typeof lookup !== 'function') return null;
    const id = instance?.type ?? instance?.defId;
    if (!id) return null;
    return lookup(id) ?? null;
  }

  // -------------------------------------------------------------------------
  // Cross-domain reads (ECO owns the usage curve)
  // -------------------------------------------------------------------------

  /**
   * The growth factor ECO publishes for the city's usage.
   *
   * The 90 %/100 % growth rule is ECO's (FR-ECO-064..067) and its curve is
   * ECO's [TBD] curve (OQ-ECO-10). POP does NOT define one: it reads the
   * factor ECO publishes. When ECO publishes only a usage percentage, POP
   * applies the two PUBLISHED fixed points (below 90 %: no penalty; at
   * 100 %: no growth) and leaves the band between them to ECO.
   */
  function ecoGrowthFactor() {
    const eco = ctx.domains?.economy;
    const ecoState = state.economy ?? {};
    for (const source of [eco, ecoState]) {
      if (!source) continue;
      for (const key of ['growthFactor', 'supplyAdequacy', 'usagePressure']) {
        const fn = source[key];
        if (typeof fn === 'function') {
          try {
            const v = Number(fn.call(source));
            if (Number.isFinite(v)) return Math.max(0, Math.min(1, v));
          } catch { /* ignore */ }
        }
        const direct = Number(source[key]);
        if (Number.isFinite(direct)) return Math.max(0, Math.min(1, direct));
      }
    }
    // No published factor: apply the two published fixed points to the usage.
    const usage = Number(ecoState.usagePct ?? ecoState.maxUsage ?? ecoState.usage);
    if (!Number.isFinite(usage)) return 1;
    const pct = usage > 1 ? usage : usage * 100;
    if (pct >= 100) return 0;
    if (pct < 90) return 1;
    // 90 %..100 % is ECO's curve; without it POP does not penalise.
    return 1;
  }

  /** The supply adequacy factor ECO publishes (the happiness input). */
  function ecoSupplyAdequacy() {
    const ecoState = state.economy ?? {};
    for (const key of ['supplyAdequacy', 'growthFactor', 'usageAdequacy']) {
      const v = Number(ecoState[key]);
      if (Number.isFinite(v)) return Math.max(0, Math.min(1, v));
    }
    const eco = ctx.domains?.economy;
    for (const key of ['supplyAdequacy', 'growthFactor']) {
      const fn = eco?.[key];
      if (typeof fn === 'function') {
        try {
          const v = Number(fn.call(eco));
          if (Number.isFinite(v)) return Math.max(0, Math.min(1, v));
        } catch { /* ignore */ }
      }
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // The simulation
  // -------------------------------------------------------------------------

  /**
   * Write the DERIVED population into the state.
   *
   *   total = max(0, round(derived * (1 - migrationDeficit)) + manualOffset)
   *
   * - `derived` is the population the HOUSING supports: round(capacity x M),
   *   where M is the six-category residence bonus multiplier (FR-POP-006/007).
   * - `migrationDeficit` is the share a migration wave took; it heals when
   *   the city is happy again (FR-POP-107/108).
   * - `manualOffset` is the explicit adjustment `addCitizens()` /
   *   `removeCitizens()` made on top of the derived figure.
   */
  function publishPopulation() {
    const p = state.population;
    const deficit = Math.max(0, Math.min(1, Number(p.migrationDeficit) || 0));
    const offset = Number(p.manualOffset) || 0;
    p.total = Math.max(0, Math.round(derived * (1 - deficit)) + offset);
    return p.total;
  }

  /** Recompute the derived values and publish them into the state. */
  function recompute() {
    const instances = buildingInstances();

    capacity = capacityFor(instances);
    households = householdsFor(instances);
    jobs = jobsFor(instances);

    const solved = resolveResidents({
      capacity,
      instances,
      start: state.population.total,
      happiness: state.population.happiness,
    });
    components = solved.components;
    multiplier = solved.multiplier;
    derived = Math.max(0, Math.round(solved.residents));

    // THE POPULATION IS DERIVED FROM THE HOUSING. It is written here, next
    // to the housing capacity it comes from, so the HUD, the economy and the
    // services all read the same figure.
    publishPopulation();

    employed = Math.min(jobs, state.population.total);
    const unemployment = Math.max(0, state.population.total - employed);

    breakdown = needsBreakdown(state, instances, {
      housingCapacity: capacity,
      employed,
      supplyAdequacy: ecoSupplyAdequacy(),
    });

    state.population.housingCapacity = capacity;
    state.population.jobs = jobs;
    state.population.employed = employed;
    state.population.unemployed = unemployment;
    state.population.households = households;
    state.population.needs = { ...breakdown.needs };
    state.population.bonus = { ...components };
    state.population.bonusTotal = residentBonus(components);
    state.population.multiplier = multiplier;

    return solved;
  }

  /** Publish a happiness value and announce a material change. */
  function setHappiness(value) {
    const next = Math.max(TUNING.happinessMin ?? 0, Math.min(TUNING.happinessMax ?? 100, value));
    const before = state.population.happiness;
    state.population.happiness = next;
    if (lastHappiness === null || Math.abs(next - lastHappiness) > HAPPINESS_EPSILON) {
      lastHappiness = next;
      bus?.emit?.(EVENTS.HAPPINESS_CHANGED, {
        happiness: next,
        breakdown: breakdown.needs,
        total: breakdown.total,
      });
    }
    return before !== next;
  }

  /** Publish the loyalty and announce a change. */
  function setLoyalty(value) {
    const next = Math.max(0, Math.min(100, value));
    state.population.loyalty = next;
    if (lastLoyalty === null || next !== lastLoyalty) {
      lastLoyalty = next;
      bus?.emit?.(EVENTS.LOYALTY_CHANGED, { loyalty: next });
    }
    return next;
  }

  /** Announce a population change. */
  function announcePopulation() {
    const total = state.population.total;
    if (lastPopulation === null || total !== lastPopulation) {
      lastPopulation = total;
      bus?.emit?.(EVENTS.POPULATION_CHANGED, {
        total,
        population: total,
        households,
        employed,
        unemployed: state.population.unemployed,
      });
    }
  }

  /**
   * Add residents.
   *
   * FR-POP-006 says residents are DERIVED and never authored; this function
   * exists for the contract and for the simulation internals (a migration
   * wave). The next tick pulls the population back towards the derived
   * target.
   */
  function addCitizens(n) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    if (!count) return state.population.total;
    const p = state.population;
    p.manualOffset = (Number(p.manualOffset) || 0) + count;
    publishPopulation();
    announcePopulation();
    return p.total;
  }

  /**
   * Remove residents.
   * @see addCitizens
   */
  function removeCitizens(n) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    if (!count) return state.population.total;
    const p = state.population;
    p.manualOffset = (Number(p.manualOffset) || 0) - count;
    publishPopulation();
    announcePopulation();
    return p.total;
  }

  // -------------------------------------------------------------------------
  // The daily routine
  // -------------------------------------------------------------------------

  /**
   * What happens when an in-game day passes.
   *
   * The published loyalty rule (dossier 1.1 #17/#18): a cared-for city earns
   * a loyalty point, a city that was left alone loses one per complete day.
   * The published migration rule: below the migration threshold the city
   * bleeds residents.
   */
  function runDaily() {
    const happiness = state.population.happiness;
    const threshold = TUNING.migrationThreshold ?? 35;
    const streak = state.population.loyaltyStreak ?? 0;

    if (happiness >= threshold) {
      // The city was cared for: one loyalty point.
      state.population.loyaltyStreak = streak + 1;
      setLoyalty(loyaltyFor(1, state.population.loyalty));
    } else {
      // The city was ignored: one loyalty point lost.
      state.population.loyaltyStreak = Math.min(0, streak - 1);
      setLoyalty(loyaltyFor(-1, state.population.loyalty));
      // A MIGRATION WAVE: a share of the residents leaves. The share is a
      // DEFICIT, not a manual adjustment, so it heals again once the city
      // is happy (FR-POP-107/108).
      state.population.migrationDeficit = Math.min(
        1,
        (Number(state.population.migrationDeficit) || 0) + MIGRATION_WAVE_RATE,
      );
    }
  }

  /**
   * Heal the migration deficit: the residents a wave took come back while
   * the city is happy again.
   *
   * The healing is exponential (`deficit *= 1 - rate * dt`), so the wave's
   * effect fades smoothly instead of snapping back.
   *
   * @param {number} step seconds of game time
   * @returns {number} the remaining deficit
   */
  function healMigrationDeficit(step) {
    const p = state.population;
    const deficit = Number(p.migrationDeficit) || 0;
    if (deficit <= 0) return 0;
    const healed = Math.max(0, deficit * Math.max(0, 1 - MIGRATION_RECOVERY_RATE * step));
    p.migrationDeficit = healed;
    publishPopulation();
    return healed;
  }

  // -------------------------------------------------------------------------
  // The citizens
  // -------------------------------------------------------------------------

  /** A residential building the citizens can start from. */
  function residentialCell() {
    for (const inst of buildingInstances()) {
      const def = definitionOf(inst);
      if (def?.category === 'residential') return { x: inst.x, z: inst.z };
    }
    return null;
  }

  /** A serviced building the citizens can walk to. */
  function servicedCell() {
    const categories = new Set(['health', 'police', 'fire', 'education', 'parks', 'waste', 'energy', 'water', 'food']);
    for (const inst of buildingInstances()) {
      const def = definitionOf(inst);
      if (def && categories.has(def.category)) return { x: inst.x, z: inst.z };
    }
    return null;
  }

  /** Keep the rendered sample in step with the population. */
  function syncRenderedCitizens() {
    const target = Math.min(
      MAX_RENDERED_CITIZENS,
      Math.max(0, Math.ceil(state.population.total / 25)),
    );
    let guard = MAX_RENDERED_CITIZENS + 1;
    while (citizens.count() > target && guard-- > 0) citizens.despawn();
    guard = MAX_RENDERED_CITIZENS + 1;
    const from = residentialCell();
    while (citizens.count() < target && guard-- > 0) {
      const to = servicedCell() ?? from;
      if (!from && !to) break;
      citizens.spawn({ from: from ?? to, to: to ?? from });
    }
  }

  // -------------------------------------------------------------------------
  // The service
  // -------------------------------------------------------------------------

  const service = {
    /** Prepare the state subtree and warm the citizen library. */
    async init() {
      ensureState();
      disposed = false;
      lastDay = Number(state.meta?.day) || 1;
      await installCatalogue();
      const hostLookup = ctx.domains?.buildings?.getDefinition;
      if (typeof hostLookup === 'function') setDefinitionLookup(hostLookup);

      const solved = recompute();
      setHappiness(breakdown.total);
      setLoyalty(state.population.loyalty);
      announcePopulation();

      // Warm the character library in the background: the first citizen must
      // not wait for a download.
      citizens.preload().then((r) => {
        if (r?.failed?.length) {
          // eslint-disable-next-line no-console
          console.warn('[pop] characters that could not be loaded:', r.failed.join(', '));
        }
      }).catch(() => { /* preloading is best effort */ });

      unsubscribes.push(bus?.on?.(EVENTS.BUILDING_PLACED, () => { recompute(); }));
      unsubscribes.push(bus?.on?.(EVENTS.BUILDING_REMOVED, () => { recompute(); }));
      unsubscribes.push(bus?.on?.(EVENTS.BUILDING_UPGRADED, () => { recompute(); }));
      unsubscribes.push(bus?.on?.(EVENTS.GAME_LOADED, () => { recompute(); }));
    },

    /** Wall-clock update: the citizens animate. */
    update(dt) {
      if (disposed) return;
      citizens.update(dt);
    },

    /** Game-time tick: the population simulation. */
    tick(dt) {
      if (disposed) return;
      const step = Number(dt) || 0;

      recompute();
      setHappiness(breakdown.total);

      // The migration pressure is published every tick: it is the sign of the
      // population's mood (FR-POP-091/107).
      state.population.migration = migrationPressure(
        state.population.happiness,
        state.population.loyalty,
      );
      // The usage throttle ECO publishes. The population itself is DERIVED
      // from the housing, so the throttle no longer decides whether the
      // residents exist - it only tells the UI whether the city may grow
      // further (FR-POP-010/011).
      state.population.growthFactor = ecoGrowthFactor();

      // A happy city heals the migration deficit: the residents come back.
      if (state.population.happiness >= (TUNING.migrationThreshold ?? 35)) {
        healMigrationDeficit(step);
      }

      // The daily routine runs when the integrator advances the day.
      const day = Number(state.meta?.day) || 0;
      if (day !== lastDay) {
        lastDay = day;
        runDaily();
        recompute();
        setHappiness(breakdown.total);
      }

      syncRenderedCitizens();
      announcePopulation();
    },

    /** The resident count. */
    population() {
      return state.population.total;
    },

    /** The happiness, 0..happinessMax. */
    happiness() {
      return state.population.happiness;
    },

    /** The loyalty, 0..100. */
    loyalty() {
      return state.population.loyalty;
    },

    /** The number of households the residential buildings form. */
    households() {
      return state.population.households;
    },

    /** Add residents (see the note on addCitizens). */
    addCitizens,

    /** Remove residents (see the note on removeCitizens). */
    removeCitizens,

    /** The happiness breakdown. */
    happinessBreakdown() {
      return breakdown;
    },

    /**
     * The six residence bonus components.
     * @returns {{culture:number, entertainment:number, recreation:number,
     *            wealth:number, diversity:number, loyalty:number}}
     */
    bonusBreakdown() {
      return components ? { ...components } : {};
    },

    /** The residence bonus sum, in percent. */
    bonusTotal() {
      return residentBonus(components);
    },

    /** The residence multiplier M. */
    bonusMultiplier() {
      return multiplier;
    },

    /** Spawn one rendered citizen. */
    spawnCitizen() {
      const from = residentialCell();
      const to = servicedCell() ?? from;
      if (!from && !to) return null;
      return citizens.spawn({ from: from ?? to, to: to ?? from });
    },

    /** Remove one rendered citizen. */
    despawnCitizen() {
      return citizens.despawn();
    },

    /** The number of RENDERED citizens (not the simulated population). */
    citizenCount() {
      return citizens.count();
    },

    /** The character keys that actually loaded. */
    availableCharacters() {
      return citizens.availableCharacters();
    },

    /** Tear the domain down. */
    dispose() {
      disposed = true;
      for (const un of unsubscribes) { try { un?.(); } catch { /* ignore */ } }
      unsubscribes.length = 0;
      citizens.dispose();
    },
  };

  ensureState();
  return service;
}

export {
  needsBreakdown, residentBonus, bonusMultiplier, migrationPressure, loyaltyFor,
} from './happiness.js';
export { householdsFor, capacityFor } from './population.js';
export { createCitizens, CHARACTER_KEYS, MAX_RENDERED_CITIZENS } from './citizens.js';
