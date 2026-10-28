/**
 * ECO — the economy domain service.
 *
 * Owns `state.economy`: the shared wallet, the period ledger, the budget
 * sliders, the tax model, the construction-slot ledger and the monthly
 * budget cycle.
 *
 * Pure rules live in `logic.js` (no Three.js, no DOM). This file is the
 * only place that touches the state and the event bus.
 *
 * CROSS-DOMAIN RULES
 * ------------------
 * Sibling domains are reached LAZILY through `ctx.domains.<name>` (never a
 * top-level import), so the integrator may wire the domains in any order and
 * the buildings domain may not exist yet. The catalogue fallback uses a
 * dynamic import, so a missing `src/buildings/` never breaks the load.
 */

import { EVENTS } from '../core/events.js';
import { TUNING } from '../core/config.js';
import * as logic from './logic.js';
import { liveStateProxy, liveSubtree } from '../core/state.js';

/**
 * The services-domain ids behind each budget category (SRV owns the ids).
 * Used for the Government panel's coverage circles (FR-ECO-076/078).
 */
const SERVICE_ID_BY_BUDGET_CATEGORY = Object.freeze({
  health: 'health',
  security: 'police',
  fire: 'fire',
  education: 'education',
});

// ---------------------------------------------------------------------------
// The domain
// ---------------------------------------------------------------------------

/**
 * Create the economy domain.
 *
 * @param {object} ctx the shared game context (state, bus, domains, config)
 */
export function createEconomy(ctx) {
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

  /**
   * The live economy sub-tree.
   *
   * The sub-tree is REPLACED wholesale when a save is loaded (`core/save.js`
   * copies the restored tree over the live one), so the reference is
   * re-resolved whenever `state.economy` is not the object we last saw.
   */
  const eco = liveSubtree(ctx, 'economy', ensureState);

  const bus = ctx.bus;

  /**
   * The domain clock.
   *
   * FR-ECO-114 requires a build to finish while the browser is closed, so the
   * DEFAULT clock is the wall clock. It is injectable so the economy can be
   * replayed and tested deterministically: a bare `Date.now()` buried inside
   * a rule made the whole ledger unreproducible.
   *
   * @type {() => number} returns the current time in milliseconds
   */
  let clock = () => Date.now();

  // ---- lazy accessors for sibling data ------------------------------------

  // ---------------------------------------------------------------------------
  // Lazy accessors for sibling data
  // ---------------------------------------------------------------------------

  let cataloguePromise = null;

  /**
   * The building catalogue, loaded lazily.
   *
   * `ctx.domains.buildings.catalogue()` is preferred (the live domain); the
   * dynamic import is only the fallback for a headless/test run.
   */
  async function loadCatalogue() {
    const bld = ctx.domains?.buildings;
    const live = bld?.catalogue;
    if (typeof live === 'function') {
      const list = live();
      if (Array.isArray(list) && list.length) return list;
      if (list && typeof list === 'object') return [...list];
    } else if (Array.isArray(live) && live.length) {
      return live;
    }
    if (!cataloguePromise) {
      cataloguePromise = import('../buildings/catalogue.js')
        .then((m) => (Array.isArray(m.BUILDING_DEFS) ? m.BUILDING_DEFS : []))
        .catch(() => []);
    }
    return cataloguePromise;
  }

  let defsCache = null;

  /** `{ id: definition }` for every catalogue entry. */
  function defsMap() {
    if (defsCache) return defsCache;
    const map = new Map();
    const bld = ctx.domains?.buildings;
    const live = bld?.catalogue;
    let list = null;
    if (typeof live === 'function') list = live();
    else if (Array.isArray(live)) list = live;
    if (Array.isArray(list)) {
      for (const def of list) if (def?.id) map.set(def.id, def);
    } else if (list && typeof list === 'object') {
      for (const [id, def] of Object.entries(list)) if (def) map.set(id, def);
    }
    if (map.size === 0 && bld?.getDefinition) {
      // The domain exposes a lookup but no catalogue list.
      map.__lookup = bld.getDefinition;
    }
    defsCache = map;
    return map;
  }

  function defOf(typeId) {
    if (!typeId) return null;
    const map = defsMap();
    const direct = map.get?.(typeId);
    if (direct) return direct;
    if (typeof map.__lookup === 'function') {
      try { return map.__lookup(typeId) ?? null; } catch { return null; }
    }
    return null;
  }

  /** Every placed building instance, resolved to `{ def, level, x, z }`. */
  function collectInstances() {
    const bld = ctx.domains?.buildings;
    if (!bld) return [];
    let list = [];
    const raw = bld.instances;
    try {
      if (typeof raw === 'function') list = raw() ?? [];
      else if (raw instanceof Map) list = [...raw.values()];
      else if (Array.isArray(raw)) list = raw;
    } catch { list = []; }
    if (!Array.isArray(list)) return [];

    const out = [];
    for (const inst of list) {
      if (!inst) continue;
      const def = inst.def ?? defOf(inst.type);
      if (!def) continue;
      // A building is only excluded while its domain says it is still being
      // built. BLD publishes no such flag today, so ECO's own timer is
      // ADVISORY (it drives the construction tray and the slot ledger) and the
      // building counts for income as soon as it exists.
      if (inst.pending === true || inst.underConstruction === true) continue;
      out.push({
        id: inst.id ?? null,
        def,
        level: inst.level ?? 1,
        x: inst.x ?? 0,
        z: inst.z ?? 0,
      });
    }
    return out;
  }

  /** The population, read from POP if it is wired. */
  function readPopulation() {
    const pop = ctx.domains?.population;
    if (pop) {
      const fn = pop.population ?? pop.total ?? pop.stats;
      let value = null;
      if (typeof fn === 'function') { try { value = fn(); } catch { value = null; } }
      else if (fn && typeof fn === 'object') value = fn;
      if (value && typeof value === 'object' && Number.isFinite(value.residents)) {
        return { residents: value.residents };
      }
      if (Number.isFinite(value)) return { residents: value };
    }
    const st = ctx.state?.population;
    if (st && Number.isFinite(st.residents)) return { residents: st.residents };
    if (st && Number.isFinite(st.total)) return { residents: st.total };
    return null;
  }

  /** The per-sector demand pressure, read from POP if it is wired. */
  function readDemandPressures() {
    const out = { residential: 1, commercial: 1, industrial: 1 };
    const stored = eco?.demandPressures;
    if (stored && typeof stored === 'object') {
      for (const sector of logic.SECTORS) {
        const v = Number(stored[sector]);
        if (Number.isFinite(v) && v >= 0) out[sector] = v;
      }
      return out;
    }
    const pop = ctx.domains?.population;
    if (!pop) return out;
    const raw = pop.sectorDemand ?? pop.demand ?? pop.demandPressures;
    let value = null;
    if (typeof raw === 'function') { try { value = raw(); } catch { value = null; } }
    else if (raw && typeof raw === 'object') value = raw;
    if (!value || typeof value !== 'object') return out;
    for (const sector of logic.SECTORS) {
      const v = Number(value[sector]);
      if (Number.isFinite(v) && v >= 0) out[sector] = v;
    }
    return out;
  }

  /** The service upkeep, read from SRV if it is wired. */
  function serviceUpkeep() {
    const srv = ctx.domains?.services;
    if (!srv) return 0;
    const fn = srv.monthlyUpkeep ?? srv.upkeep;
    let value = null;
    if (typeof fn === 'function') { try { value = fn(); } catch { value = null; } }
    else value = fn;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }


  const unsubscribes = [];
  let disposed = false;
  let constructionCounter = 0;

  // ---- state ---------------------------------------------------------------

  function ensureState(st) {
    const e = st.economy ?? (st.economy = {});
    if (typeof e.treasury !== 'number') e.treasury = 0;
    if (!Array.isArray(e.ledger)) e.ledger = [];
    if (typeof e.revenue !== 'number') e.revenue = 0;
    if (typeof e.expenditure !== 'number') e.expenditure = 0;
    if (typeof e.month !== 'number') e.month = 1;
    if (!e.budget || typeof e.budget !== 'object') e.budget = {};
    if (!e.taxRates || typeof e.taxRates !== 'object') e.taxRates = { ...logic.DEFAULT_TAX_RATES };
    if (!e.bonuses || typeof e.bonuses !== 'object') e.bonuses = { global: 0, map: 0 };
    if (!e.constructions || typeof e.constructions.get !== 'function') e.constructions = new Map();
    if (!e.constructionSlots || typeof e.constructionSlots !== 'object') {
      e.constructionSlots = { total: 1, used: 0 };
    }
    if (!e.charged || typeof e.charged.add !== 'function') e.charged = new Set();
    if (typeof e.accrued !== 'number') e.accrued = 0;
    if (typeof e.debt !== 'number') e.debt = 0;
    if (typeof e.ledgerLimit !== 'number') e.ledgerLimit = logic.TBD_VALUES.ledgerLimit;
    return e;
  }

  // ---- tunables ------------------------------------------------------------

  /** A TUNING value when the integrator published one, else our TBD default. */
  function tuning(key, fallback) {
    const v = ctx.config?.TUNING?.[key] ?? TUNING[key];
    return Number.isFinite(v) ? v : fallback;
  }

  function monthSeconds() {
    return Math.max(1, tuning('economyMonthSeconds', logic.TBD_VALUES.monthSeconds));
  }

  function ledgerLimit() {
    return Math.max(1, Math.round(tuning('economyLedgerLimit', logic.TBD_VALUES.ledgerLimit)));
  }

  function upkeepEnabled() {
    return tuning('economyUpkeepEnabled', logic.TBD_VALUES.upkeepEnabled) !== false;
  }

  // ---- construction slots (FR-ECO-113 … FR-ECO-122) -----------------------

  function isUnderConstruction(instanceId) {
    if (instanceId === null || instanceId === undefined) return false;
    const c = eco.constructions.get(instanceId);
    return Boolean(c && !c.done);
  }

  function usedSlots() {
    let used = 0;
    for (const c of eco.constructions.values()) if (!c.done) used += c.slots;
    return used;
  }

  function refreshSlots() {
    eco.constructionSlots.used = usedSlots();
    if (!Number.isFinite(eco.constructionSlots.total) || eco.constructionSlots.total < 1) {
      eco.constructionSlots.total = 1;
    }
  }

  /**
   * Refresh the wall-clock progress of every construction (NFR-ECO-005).
   *
   * The progress comes from wall-clock timestamps so a build that finishes
   * while the browser is closed is finished on load (FR-ECO-114).
   * `constructionSpeed` is the speed-up factor (FR-ECO-115/116): 1 is
   * normal, 2 is the ad speed-up, and the speed-up package raises it
   * permanently.
   */
  function updateConstructions(now = clock()) {
    const speed = Math.max(0.01, Number(eco.constructionSpeed) || 1);
    let changed = false;
    for (const c of eco.constructions.values()) {
      if (c.done) continue;
      const remaining = Math.max(0, c.durationMs - (now - c.startedAt) * speed);
      if (remaining !== c.remainingMs) { c.remainingMs = remaining; changed = true; }
      if (remaining <= 0) { c.done = true; changed = true; }
    }
    if (changed) refreshSlots();
    return changed;
  }

  function startConstruction(instanceId, def) {
    const slots = logic.constructionSlotsFor(def);
    const minutes = logic.constructionMinutesFor(def);
    const id = instanceId ?? `eco-c${(constructionCounter += 1)}`;
    const now = clock();
    eco.constructions.set(id, {
      id,
      defId: def?.id ?? null,
      slots,
      startedAt: now,
      durationMs: minutes * 60000,
      remainingMs: minutes * 60000,
      done: false,
    });
    // FR-ECO-020: a Citycon Building grants one extra permanent slot.
    if (def?.grantsConstructionSlot) {
      eco.constructionSlots.total = (eco.constructionSlots.total ?? 1) + 1;
    }
    refreshSlots();
    return id;
  }

  // ---- ledger + money ------------------------------------------------------

  function setWarning(code) {
    if (eco.warning === code) return;
    eco.warning = code;
    bus?.emit?.(EVENTS.TOAST, { kind: 'warning', code, message: code });
  }

  function clearWarning() {
    if (eco.warning === null) return;
    eco.warning = null;
  }

  function pushLedger(entry) {
    eco.ledger = logic.applyLedger(eco.ledger, entry, ledgerLimit());
  }

  /**
   * Spend coins.
   *
   * @param {number} amount
   * @param {string} [reason]
   * @param {object} [opts] { allowNegative } — the monthly settlement may take
   *        the balance negative (FR-ECO-127); a player-initiated spend may not.
   * @returns {{ok:boolean, reason:string|null}}
   */
  function spend(amount, reason = 'unspecified', opts = {}) {
    const value = Math.round(Number(amount));
    if (!Number.isFinite(amount) || value < 0) return { ok: false, reason: 'invalid-amount' };
    if (value === 0) return { ok: true, reason: 'no-op' };
    if (!opts.allowNegative && eco.treasury < value) {
      setWarning('insufficient-funds');
      return { ok: false, reason: 'insufficient-funds' };
    }
    eco.treasury -= value;
    eco.expenditure += value;
    pushLedger({
      type: 'debit', amount: value, reason, month: eco.month, at: clock(), balance: eco.treasury,
    });
    bus?.emit?.(EVENTS.TRANSACTION, {
      type: 'debit', amount: value, reason, month: eco.month, balance: eco.treasury,
    });
    bus?.emit?.(EVENTS.MONEY_CHANGED, {
      coins: eco.treasury, superCash: eco.superCash ?? 0, delta: -value, reason,
    });
    if (eco.treasury < 0) setWarning('negative-balance');
    else if (eco.warning === 'negative-balance') clearWarning();
    return { ok: true, reason: null };
  }

  /**
   * Earn coins.
   *
   * @param {number} amount
   * @param {string} [reason]
   * @returns {{ok:boolean, reason:string|null}}
   */
  function earn(amount, reason = 'unspecified') {
    const value = Math.round(Number(amount));
    if (!Number.isFinite(amount) || value < 0) return { ok: false, reason: 'invalid-amount' };
    if (value === 0) return { ok: true, reason: 'no-op' };
    eco.treasury += value;
    eco.revenue += value;
    pushLedger({
      type: 'credit', amount: value, reason, month: eco.month, at: clock(), balance: eco.treasury,
    });
    bus?.emit?.(EVENTS.TRANSACTION, {
      type: 'credit', amount: value, reason, month: eco.month, balance: eco.treasury,
    });
    bus?.emit?.(EVENTS.MONEY_CHANGED, {
      coins: eco.treasury, superCash: eco.superCash ?? 0, delta: value, reason,
    });
    return { ok: true, reason: null };
  }

  // ---- budget cycle (FR-ECO-125) ------------------------------------------

  function incomeOptions() {
    return {
      defs: defsMap(),
      taxRates: eco.taxRates,
      globalBonus: eco.bonuses.global ?? 0,
      mapBonus: eco.bonuses.map ?? 0,
    };
  }

  /** The monthly income of the city (F4). */
  function monthlyIncome() {
    return logic.incomeFor(collectInstances(), readPopulation(), incomeOptions());
  }

  /**
   * The monthly upkeep the city actually pays.
   *
   * The budget sliders cut the service categories (FR-ECO-121), so this is
   * the GROSS upkeep minus the cut. Use `monthlyUpkeepBreakdown()` for the
   * unadjusted numbers.
   */
  function monthlyUpkeep() {
    if (!upkeepEnabled()) return 0;
    const breakdown = monthlyUpkeepBreakdown();
    const impact = logic.budgetImpact(eco.budget, breakdown.byCategory);
    return impact.totalEffective + breakdown.unbudgeted + breakdown.services;
  }

  /** The gross monthly upkeep split by budget category. */
  function monthlyUpkeepBreakdown() {
    const breakdown = logic.upkeepBreakdown(collectInstances(), { defs: defsMap() });
    breakdown.services = serviceUpkeep();
    breakdown.total += breakdown.services;
    return breakdown;
  }

  /**
   * Settle one month (FR-ECO-125).
   *
   * Accrue the sector income, pay the upkeep (reduced by the budget
   * sliders), roll the month over and publish the period report.
   */
  function settleMonth() {
    const sectorIncome = logic.incomeBreakdown(collectInstances(), readPopulation(), incomeOptions());
    const income = sectorIncome.total;
    const breakdown = monthlyUpkeepBreakdown();
    const impact = logic.budgetImpact(eco.budget, breakdown.byCategory);
    const charged = impact.totalEffective + breakdown.unbudgeted + breakdown.services;
    // `earn` and `spend` book the period totals themselves.
    if (income > 0) earn(income, 'monthly-income');
    // Outstanding debt is settled here — the monthly settlement is the
    // published moment when the balance MAY go negative (FR-ECO-127).
    const debt = Math.max(0, Number(eco.debt) || 0);
    if (debt > 0) {
      eco.debt = 0;
      spend(debt, 'debt-settlement', { allowNegative: true });
    }
    if (charged > 0) spend(charged, 'monthly-upkeep', { allowNegative: true });

    eco.lastIncome = income;
    eco.lastUpkeep = charged;

    eco.report = {
      month: eco.month,
      income,
      bySector: sectorIncome.bySector,
      bonuses: sectorIncome.bonuses,
      upkeep: charged,
      upkeepRequested: breakdown.total,
      upkeepByCategory: breakdown.byCategory,
      budgetCut: impact.totalCut,
      net: income - charged,
      ledgerSize: eco.ledger.length,
    };

    eco.month += 1;
    // `revenue` and `expenditure` are the spine's CUMULATIVE totals
    // ("total revenue ever collected"); the per-period figures live in the
    // report above.

    // The balance change is already published by `earn` and `spend`; a
    // listener that applies `delta` must not see it twice.
    bus?.emit?.(EVENTS.TRANSACTION, {
      type: 'settlement',
      month: eco.report.month,
      income,
      upkeep: charged,
      net: eco.report.net,
      balance: eco.treasury,
    });
    return eco.report;
  }

  // ---- bars (FR-ECO-058 … FR-ECO-074) -------------------------------------

  /** The three demand bars of the HUD demand block. */
  function demandBars(instances = null) {
    const list = instances ?? collectInstances();
    const pressure = readDemandPressures();
    const population = readPopulation();
    const residents = population ? population.residents : null;
    const capacity = { residential: 0, commercial: 0, industrial: 0 };
    for (const inst of list) {
      const sector = logic.sectorOf(inst.def);
      if (!sector) continue;
      const cap = logic.capacityOf(inst.def, inst.level);
      if (sector === 'residential') capacity.residential += cap.residents;
      else if (sector === 'commercial') capacity.commercial += cap.workspaces;
      else capacity.industrial += cap.jobs;
    }
    const bars = {};
    for (const sector of logic.SECTORS) {
      const cap = capacity[sector];
      // The demand of a sector is the number of residents it has to serve.
      // This is a DESIGN DECISION (the dossier publishes no demand model):
      // residents need housing, shops and jobs, so the resident count is the
      // demand proxy for all three sectors and the sector capacity is the
      // supply. A pressure published by POP (or set through
      // `setDemandPressures`) raises the demand above that proxy.
      let demand = Math.round(cap * (pressure[sector] ?? 1));
      if (residents !== null) demand = Math.max(demand, residents);
      bars[sector] = logic.demandBar(cap, demand);
    }
    return bars;
  }

  /**
   * The service coverage circles of the Government panel (FR-ECO-076/078).
   *
   * The numbers come from the services domain (SRV); ECO only maps them onto
   * the budget categories and never re-computes them.
   */
  function serviceCoverage() {
    const srv = ctx.domains?.services;
    const out = {};
    for (const [category, serviceId] of Object.entries(SERVICE_ID_BY_BUDGET_CATEGORY)) {
      const entry = {
        category, serviceId, coverage: 0, capacity: 0, demand: 0, served: 0, unmet: 0,
      };
      if (srv) {
        try {
          const coverage = typeof srv.cityCoverage === 'function' ? srv.cityCoverage(serviceId) : null;
          if (Number.isFinite(coverage)) entry.coverage = coverage;
          const availability = typeof srv.availability === 'function' ? srv.availability(serviceId) : null;
          if (availability && typeof availability === 'object') {
            entry.capacity = Number(availability.capacity) || 0;
            entry.demand = Number(availability.demand) || 0;
            entry.served = Number(availability.served) || 0;
            entry.unmet = Math.max(0, entry.demand - entry.served);
          }
        } catch { /* the services domain is optional */ }
      }
      out[category] = entry;
    }
    return out;
  }

  /** The four usage bars of the HUD usage block. */
  function usageBars(instances = null) {
    const list = instances ?? collectInstances();
    const chains = logic.resolveChains(list, { defs: defsMap() });
    return {
      energy: chains.energy.usage,
      water: chains.water.usage,
      food: chains.food.usage,
      waste: chains.waste.usage,
    };
  }

  /** Everything the HUD bar blocks and the Government panel need. */
  function overview() {
    // The instances are collected ONCE and shared by every section.
    const list = collectInstances();
    const chains = logic.resolveChains(list, { defs: defsMap() });
    return {
      demand: demandBars(list),
      usage: {
        energy: chains.energy.usage,
        water: chains.water.usage,
        food: chains.food.usage,
        waste: chains.waste.usage,
      },
      chains,
      services: serviceCoverage(),
      growthFactor: chains.growthFactor,
      pools: logic.poolMembership(list, { defs: defsMap() }),
    };
  }

  // ---- event handlers ------------------------------------------------------

  function onBuildingPlaced(payload) {
    if (!payload || disposed) return;
    const id = payload.id ?? null;
    if (id !== null && eco.charged.has(id)) return;
    if (id !== null) eco.charged.add(id);

    const def = defOf(payload.type);
    const cost = Number.isFinite(payload.cost)
      ? Math.round(payload.cost)
      : logic.constructionCost(def, payload.level ?? 1);

    const result = spend(cost, `build:${payload.type ?? 'unknown'}`);
    if (!result.ok) {
      // BLD already placed the building, so the cost is real — but a
      // player-initiated spend must NEVER push the balance negative. Only the
      // monthly settlement may do that (FR-ECO-127). The amount is booked as
      // outstanding debt and settled from the next income.
      const unpaid = Math.max(0, Math.round(cost));
      eco.debt = Math.max(0, Number(eco.debt) || 0) + unpaid;
      pushLedger({
        type: 'debt',
        amount: unpaid,
        reason: `build:${payload.type ?? 'unknown'}:unpaid`,
        month: eco.month,
        at: clock(),
        balance: eco.treasury,
      });
      setWarning('insufficient-funds');
    }

    // FR-ECO-120/121 — the slots are occupied for the whole build duration.
    const required = logic.constructionSlotsFor(def);
    if ((eco.constructionSlots.total ?? 1) - (eco.constructionSlots.used ?? 0) < required) {
      setWarning('not-enough-construction-slots');
    }
    if (def) startConstruction(id, def);
    refreshSlots();
  }

  function onBuildingRemoved(payload) {
    if (!payload || disposed) return;
    const id = payload.id ?? null;
    if (id !== null) {
      eco.charged.delete(id);
      eco.constructions.delete(id);
      refreshSlots();
    }
    // FR-ECO-056: demolition does NOT refund the construction cost.
  }

  function onBuildingUpgraded(payload) {
    if (!payload || disposed) return;
    const cost = Number(payload.cost);
    if (!Number.isFinite(cost) || cost <= 0) return;
    const result = spend(cost, `upgrade:${payload.type ?? 'unknown'}`);
    if (!result.ok) {
      // The same rule as a build: a player-initiated spend must never push
      // the balance negative, so the cost becomes outstanding debt instead.
      const unpaid = Math.max(0, Math.round(cost));
      eco.debt = Math.max(0, Number(eco.debt) || 0) + unpaid;
      pushLedger({
        type: 'debt',
        amount: unpaid,
        reason: `upgrade:${payload.type ?? 'unknown'}:unpaid`,
        month: eco.month,
        at: clock(),
        balance: eco.treasury,
      });
      setWarning('insufficient-funds');
    }
  }

  // ---- the public service --------------------------------------------------

  const service = {
    /** Prepare the ECO subtree and subscribe to the bus. */
    init() {
      disposed = false;
      for (const off of unsubscribes.splice(0)) { try { off(); } catch { /* ignore */ } }

      eco.superCash = Number.isFinite(eco.superCash) ? eco.superCash : 0;
      if (!Array.isArray(eco.ledger)) eco.ledger = [];
      if (!Number.isFinite(eco.month)) eco.month = 1;
      if (!Number.isFinite(eco.revenue)) eco.revenue = 0;
      if (!Number.isFinite(eco.expenditure)) eco.expenditure = 0;
      if (!eco.budget || !Object.keys(eco.budget).length) {
        eco.budget = logic.normaliseBudgetMap(eco.budget ?? {});
      }
      if (!eco.taxRates || !Object.keys(eco.taxRates).length) {
        eco.taxRates = { ...logic.DEFAULT_TAX_RATES };
      }
      if (!eco.bonuses) eco.bonuses = { global: 0, map: 0 };
      if (!eco.constructions || typeof eco.constructions.get !== 'function') eco.constructions = new Map();
      if (!eco.constructionSlots) eco.constructionSlots = { total: 1, used: 0 };
      if (!eco.charged || typeof eco.charged.add !== 'function') eco.charged = new Set();

      // FR-ECO-001/FR-ECO-002 — the wallet starts at the published treasury.
      // A loaded save keeps its balance, so the grant happens only once.
      if (!eco.initialized) {
        if (!Number.isFinite(eco.treasury)) eco.treasury = 0;
        // The starting treasury is granted to a FRESH city only: a loaded
        // save that happens to hold zero coins keeps its zero balance.
        const fresh = !eco.ledger?.length && (eco.month ?? 1) <= 1 && !eco.constructions?.size;
        if (fresh && eco.treasury === 0) eco.treasury = TUNING.startingTreasury;
        eco.initialized = true;
      }

      defsCache = null;
      cataloguePromise = null;
      updateConstructions();
      refreshSlots();

      if (bus?.on) {
        unsubscribes.push(bus.on(EVENTS.BUILDING_PLACED, onBuildingPlaced));
        unsubscribes.push(bus.on(EVENTS.BUILDING_REMOVED, onBuildingRemoved));
        unsubscribes.push(bus.on(EVENTS.BUILDING_UPGRADED, onBuildingUpgraded));
      }
      return service;
    },

    /** Wall-clock update: refresh the construction timers. */
    update(dt) {
      void dt;
      updateConstructions();
    },

    /** Game-time tick: run the monthly budget cycle. */
    tick(dt) {
      const delta = Number(dt);
      if (!Number.isFinite(delta) || delta <= 0) return;
      eco.accrued = (eco.accrued ?? 0) + delta;
      const period = monthSeconds();
      let guard = 0;
      while (eco.accrued >= period && guard < 64) {
        eco.accrued -= period;
        settleMonth();
        guard += 1;
      }
    },

    /** The current coin balance. */
    treasury() {
      return eco.treasury;
    },

    /**
     * The outstanding debt: money the player owes for builds they could not
     * afford at the time. It is settled at the next monthly settlement.
     */
    debt() {
      return Math.max(0, Number(eco.debt) || 0);
    },

    /**
     * Replace the domain clock.
     *
     * The default clock is the wall clock (FR-ECO-114: a build finishes while
     * the browser is closed). Injecting a clock makes the economy
     * deterministic and replayable.
     *
     * @param {() => number} fn returns the current time in milliseconds
     * @returns {{ok:boolean, reason:string|null}}
     */
    setClock(fn) {
      if (typeof fn !== 'function') return { ok: false, reason: 'invalid-clock' };
      clock = fn;
      updateConstructions();
      return { ok: true, reason: null };
    },

    /** The current Super Cash balance (FR-ECO-001). */
    superCash() {
      return eco.superCash ?? 0;
    },

    /** Can the city afford this cost right now? */
    canAfford(cost) {
      const value = Number(cost);
      if (!Number.isFinite(value)) return false;
      return eco.treasury >= value;
    },

    /** Spend coins. */
    spend(amount, reason = 'unspecified', opts = {}) {
      return spend(amount, reason, opts);
    },

    /** Earn coins. */
    earn(amount, reason = 'unspecified') {
      return earn(amount, reason);
    },

    /** The monthly income of the city. */
    monthlyIncome() {
      return monthlyIncome();
    },

    /** The monthly upkeep of the city. */
    monthlyUpkeep() {
      return monthlyUpkeep();
    },

    /** The monthly upkeep split by budget category. */
    monthlyUpkeepBreakdown() {
      return monthlyUpkeepBreakdown();
    },

    /**
     * Set the budget sliders (one rate per service category, 0..1).
     */
    applyBudget(map) {
      eco.budget = logic.normaliseBudgetMap(map ?? {});
      bus?.emit?.(EVENTS.BUDGET_CHANGED, { budget: { ...eco.budget } });
      return { ok: true, reason: null, budget: { ...eco.budget } };
    },

    /** The current budget map. */
    budget() {
      return { ...eco.budget };
    },

    /** The tax rates per sector (FR-ECO-123/124). */
    taxRates() {
      return { ...eco.taxRates };
    },

    /** Set the tax rates per sector. */
    setTaxRates(map) {
      eco.taxRates = { ...logic.DEFAULT_TAX_RATES, ...(map ?? {}) };
      return { ok: true, reason: null, taxRates: { ...eco.taxRates } };
    },

    /** The bonus state (global = region-wide, map = this map). */
    bonuses() {
      return { ...eco.bonuses };
    },

    /** Set the global / map income bonuses. */
    setBonuses(map) {
      eco.bonuses = {
        global: Number(map?.global ?? eco.bonuses.global ?? 0),
        map: Number(map?.map ?? eco.bonuses.map ?? 0),
      };
      return { ok: true, reason: null, bonuses: { ...eco.bonuses } };
    },

    /** The period ledger (newest last). */
    ledger() {
      return eco.ledger.slice();
    },

    /** The last settlement report (FR-ECO-126). */
    report() {
      return eco.report ?? null;
    },

    /** The HUD bar blocks and the Government panel data (FR-ECO-058/077). */
    overview() {
      return overview();
    },

    /** The three demand bars. */
    demandBars() {
      return demandBars();
    },

    /** The four usage bars. */
    usageBars() {
      return usageBars();
    },

    /** The service coverage circles of the Government panel (FR-ECO-076). */
    serviceCoverage() {
      return serviceCoverage();
    },

    /**
     * Set the per-sector demand pressure.
     *
     * POP does not publish one yet, so the demand bars stay empty until the
     * integrator feeds them (`{ residential, commercial, industrial }`, where
     * 1 means "the sector is exactly as demanded as it is provided").
     */
    setDemandPressures(map) {
      eco.demandPressures = { ...(eco.demandPressures ?? {}), ...(map ?? {}) };
      return { ok: true, reason: null, demandPressures: { ...eco.demandPressures } };
    },

    /** The connected-economy pools of the current map (FR-ECO-100 … 109). */
    pools() {
      return logic.poolMembership(collectInstances(), { defs: defsMap() });
    },

    /** The construction slots (FR-ECO-118 … FR-ECO-121). */
    constructionSlots() {
      refreshSlots();
      const total = eco.constructionSlots.total ?? 1;
      const used = eco.constructionSlots.used ?? 0;
      return { total, used, free: Math.max(0, total - used) };
    },

    /**
     * The full placement gate: money AND construction slots.
     *
     * The buildings domain calls `canAfford(cost)` before it places a
     * building but it does NOT know about the construction slots, so the
     * integrator has to call this (or `canStartConstruction`) BEFORE
     * `buildings.place(...)` — otherwise FR-ECO-121 (placement is refused
     * when there are not enough free slots, and the cost is not deducted)
     * cannot be enforced from the economy side alone.
     *
     * @param {object} def   the catalogue definition
     * @param {number} [level]
     * @returns {{ok:boolean, reason:string|null, cost:number, required:number, free:number}}
     */
    canPlace(def, level = 1) {
      const cost = logic.constructionCost(def, level);
      if (!service.canAfford(cost)) {
        return {
          ok: false, reason: 'insufficient-funds', cost, required: 0, free: 0,
        };
      }
      const slots = service.canStartConstruction(def);
      if (!slots.ok) {
        return {
          ok: false, reason: slots.reason, cost, required: slots.required, free: slots.free,
        };
      }
      return {
        ok: true, reason: null, cost, required: slots.required, free: slots.free,
      };
    },

    /**
     * May a building of this definition start building right now?
     * (FR-ECO-121 — the caller must check this BEFORE placing.)
     */
    canStartConstruction(def) {
      const required = logic.constructionSlotsFor(def);
      const { total, used } = service.constructionSlots();
      const free = total - used;
      if (free < required) {
        return { ok: false, reason: 'not-enough-slots', required, free };
      }
      return { ok: true, reason: null, required, free };
    },

    /** The construction progress (0..1) of one building. */
    constructionProgress(id) {
      const c = eco.constructions.get(id);
      if (!c) return null;
      if (c.done) return 1;
      const remaining = Math.max(0, c.durationMs - (clock() - c.startedAt));
      return Math.max(0, Math.min(1, 1 - remaining / c.durationMs));
    },

    /**
     * The construction speed-up factor (FR-ECO-115/116).
     * 1 = normal, 2 = the ad speed-up, > 1 = the speed-up package.
     */
    setConstructionSpeed(factor) {
      const value = Number(factor);
      if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: 'invalid-speed' };
      eco.constructionSpeed = value;
      updateConstructions();
      return { ok: true, reason: null, speed: value };
    },

    /** The construction speed-up factor. */
    constructionSpeed() {
      return Number(eco.constructionSpeed) || 1;
    },

    /** Is a building still inside its construction window? */
    isUnderConstruction(id) {
      return isUnderConstruction(id);
    },

    /** The construction cost of a definition (FR-ECO-048). */
    constructionCost(def, level = 1, opts = {}) {
      return logic.constructionCost(def, level, opts);
    },

    /** The current warning code, if any. */
    warning() {
      return eco.warning ?? null;
    },

    /** Tear the domain down. */
    dispose() {
      disposed = true;
      for (const off of unsubscribes.splice(0)) { try { off(); } catch { /* ignore */ } }
      eco.constructions?.clear?.();
    },
  };

  return service;
}

export { logic };
export * from './logic.js';
