/**
 * hazards/index.js — the HAZARD domain service.
 *
 * OWNER: HAZARD. The service layer: it wires the pure rules in `logic.js` to
 * the live state, the event bus and the renderer.
 *
 * Per core/CONTRACT.md §5 the RULES live in the pure module next to this
 * file (`logic.js`, which never imports `three`); this file is where they meet
 * the world.
 *
 * THE PUBLIC API (what `main.js` calls):
 *
 *   createHazards(ctx) -> {
 *     init(),                    // prepare the state subtree
 *     update(dt),               // wall-clock seconds (visuals)
 *     tick(dt),                 // GAME seconds (the simulation)
 *     load(defs),               // install the level's hazard definitions
 *     reset(),                  // forget every hazard and every record
 *     active(),                 // the hazards that are running right now
 *     state(),                  // the live `state.hazards` subtree
 *     resolved(),               // the resolved hazard records
 *     damage(id?),              // the damage report of one (or every) hazard
 *     resolveEarly(id, reason), // contain a hazard before it burns out
 *     holdCheckpoint(id),       // hold a checkpoint during a crisis
 *     checkpoints(),            // the checkpoints the city holds
 *     mitigationFor(id),        // the mitigation level of a hazard, 0..1
 *     phaseOf(id),              // the phase a hazard is in
 *     crisis(),                 // the crisis state (panic, victory, failure)
 *     dispose(),                // tear down (safe to call twice)
 *   }
 *
 * EVENTS (core/events.js, the V5 hazard events):
 *   HAZARD_STARTED  {id, type, label, x, z, radius}
 *   HAZARD_PHASE    {id, phaseIndex, phaseId, name, telegraphing}
 *   HAZARD_DAMAGE   {id, amount, target, kind}
 *   HAZARD_RESOLVED {id, outcome, reason}
 *
 * VISUALS: the hazard domain NEVER writes a particle system of its own. It
 * asks the renderer's effect service (`renderer.fx.spawn`) for the effects
 * the contract already defines: 'hazard-fire', 'hazard-water', 'hazard-smoke'
 * and 'warning'.
 */

import { EVENTS } from '../core/events.js';
import { cellToWorld } from '../core/config.js';
import { liveSubtree } from '../core/state.js';
import {
  HAZARD_STATUS,
  HAZARD_OUTCOME,
  HAZARD_TBD,
  createHazardState,
  advanceHazard,
  resolveEarly as resolveHazardEarly,
  mitigationLevel,
  damageForDps,
  phaseOf as phaseOfState,
  isCrisisDef,
  findDef,
  normaliseHazardTree,
  emptyHazardTree,
} from './logic.js';

export * from './logic.js';

/** The VFX kind each hazard type uses. */
const FX_BY_TYPE = Object.freeze({
  flood: 'hazard-water',
  wildfire: 'hazard-fire',
  outage: 'hazard-smoke',
  blight: 'hazard-smoke',
  earthquake: 'hazard-smoke',
  heatwave: 'hazard-smoke',
});

/**
 * Create the hazard domain.
 *
 * @param {object} ctx the shared context (core/CONTRACT.md §1)
 * @returns {object} the hazard service
 */
export function createHazards(ctx) {
  const bus = ctx?.bus;

  /**
   * The live `state.hazards` subtree.
   *
   * `core/state.js` does not create this subtree (the spine owns the list of
   * subtrees and this domain was added after it), so the `ensure` function
   * creates it on first use and repairs it when a save brings back a
   * half-written one.
   */
  const haz = liveSubtree(ctx, 'hazards', ensureState);

  // The subtree is created EAGERLY, so `state.hazards` exists from the
  // moment the domain is constructed — not only after the first access.
  ensureState(ctx?.state);

  /** Whether the domain has been torn down. */
  let disposed = false;
  /** The wall-clock clock used for the VFX pulses. */
  let fxClock = 0;
  /** The game clock used for the damage-event throttle. */
  let damageClock = 0;
  /** The damage that has not been announced yet, per hazard id. */
  const pending = new Map();
  /** The unsubscribe function of the bus subscription. */
  let unsubscribe = null;

  /**
   * Create or repair the subtree.
   *
   * The subtree object keeps its IDENTITY when it is repaired: `liveSubtree`
   * re-resolves its reference whenever the object in the tree changes, and a
   * replaced object would silently orphan every reference the domain holds.
   *
   * @param {object} tree the live state tree
   * @returns {object} the hazard subtree
   */
  function ensureState(tree) {
    if (!tree || typeof tree !== 'object') return emptyHazardTree();
    const existing = tree.hazards;
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      tree.hazards = emptyHazardTree();
      return tree.hazards;
    }
    const repaired = normaliseHazardTree(existing);
    for (const key of Object.keys(existing)) {
      if (!(key in repaired)) delete existing[key];
    }
    Object.assign(existing, repaired);
    return existing;
  }

  // -------------------------------------------------------------------------
  // The definitions
  // -------------------------------------------------------------------------

  /** The hazard definitions of the loaded level. */
  function defs() {
    const list = haz.defs;
    return Array.isArray(list) ? list : [];
  }

  /** The definition of one hazard. */
  function defFor(id) {
    return findDef(defs(), id);
  }

  /** The running hazard states. */
  function running() {
    const list = haz.hazards;
    return Array.isArray(list) ? list : [];
  }

  /** The checkpoints the city holds. */
  function heldCheckpoints() {
    const list = Array.isArray(haz.checkpoints) ? haz.checkpoints : [];
    return list.slice();
  }

  /** The hazard state of one id. */
  function stateFor(id) {
    for (const h of running()) {
      if (h && h.id === id) return h;
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // The world the hazard touches
  // -------------------------------------------------------------------------

  /** The services domain, when it is there. */
  function services() {
    const s = ctx?.domains?.services;
    if (!s) return null;
    if (typeof s.coverageFor !== 'function' && typeof s.cityCoverage !== 'function') return null;
    return s;
  }

  /** The placed buildings, as `{id, x, z}` records. */
  function buildings() {
    const bld = ctx?.domains?.buildings;
    if (!bld || typeof bld.instances !== 'function') return [];
    try {
      const list = bld.instances();
      if (!Array.isArray(list)) return [];
      return list
        .filter((b) => b && typeof b === 'object')
        .map((b) => ({ id: b.id, x: b.x, z: b.z }));
    } catch {
      return [];
    }
  }

  /**
   * Apply morale damage to the population.
   *
   * POP owns the happiness and the loyalty, and it recomputes both from its
   * own needs model every tick — so a hazard cannot simply write to
   * `state.population`. The population domain therefore has to expose a way
   * to take a hit. Until it does, the loss is recorded here (it survives the
   * save) and announced with a HAZARD_DAMAGE event.
   *
   * @param {number} happiness the happiness points lost
   * @param {number} loyalty the loyalty points lost
   * @returns {boolean} true when the population actually took the hit
   */
  function applyMorale(happiness, loyalty) {
    const pop = ctx?.domains?.population;
    const loss = {
      happiness: Math.max(0, Number(happiness) || 0),
      loyalty: Math.max(0, Number(loyalty) || 0),
    };
    if (!loss.happiness && !loss.loyalty) return false;
    if (pop && typeof pop.applyMorale === 'function') {
      try {
        pop.applyMorale(loss);
        return true;
      } catch {
        /* fall through to the recorded loss */
      }
    }
    const morale = haz.morale && typeof haz.morale === 'object' ? haz.morale : { happiness: 0, loyalty: 0 };
    haz.morale = {
      happiness: (Number(morale.happiness) || 0) + loss.happiness,
      loyalty: (Number(morale.loyalty) || 0) + loss.loyalty,
    };
    return false;
  }

  /**
   * Pay for the repairs.
   *
   * The repair cost of a single simulation step is a FRACTION of a coin, so
   * the cost is ACCUMULATED and paid in whole coins: the fraction is kept in
   * the subtree and carried over to the next step.
   *
   * The economy refuses a spend that would overdraw the balance
   * (FR-ECO-127: only the monthly settlement may push it negative), so the
   * bill is paid up to what the city has and the REST becomes an unpaid
   * debt.
   *
   * The bill is recorded in the hazard subtree as well, so it travels with
   * the save even when the economy has no ledger to hold it.
   *
   * @param {number} cost the repair cost of this step, in coins
   * @returns {number} the coins actually paid
   */
  function payRepairs(cost) {
    const fraction = Number(cost);
    if (!Number.isFinite(fraction) || fraction <= 0) return 0;
    const repairs = haz.repairs && typeof haz.repairs === 'object'
      ? haz.repairs
      : { coins: 0, unpaid: 0, owed: 0 };
    const owed = (Number(repairs.owed) || 0) + fraction;
    const coins = Math.floor(owed);
    const remainder = owed - coins;
    if (coins <= 0) {
      haz.repairs = { coins: Number(repairs.coins) || 0, unpaid: Number(repairs.unpaid) || 0, owed: remainder };
      return 0;
    }

    let paid = 0;
    const eco = ctx?.domains?.economy;
    if (eco && typeof eco.spend === 'function') {
      const affordable = typeof eco.treasury === 'function'
        ? Math.max(0, Math.floor(Number(eco.treasury()) || 0))
        : coins;
      const attempt = Math.min(coins, affordable);
      if (attempt > 0) {
        try {
          const result = eco.spend(attempt, 'hazard-repair');
          if (result && result.ok) paid = attempt;
        } catch {
          paid = 0;
        }
      }
    }
    const unpaid = Math.max(0, coins - paid);
    haz.repairs = {
      coins: (Number(repairs.coins) || 0) + paid,
      unpaid: (Number(repairs.unpaid) || 0) + unpaid,
      owed: remainder,
    };
    return paid;
  }

  /**
   * Destroy a building whose damage exceeded its health.
   * @param {{id:any,x:number,z:number}} record
   * @returns {boolean} true when the building was demolished
   */
  function destroyBuilding(record) {
    const bld = ctx?.domains?.buildings;
    if (!bld || typeof bld.remove !== 'function') return false;
    try {
      const result = bld.remove(record.x, record.z);
      return !!(result && result.ok);
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  function emit(name, payload) {
    try {
      bus?.emit?.(name, payload);
    } catch {
      /* a broken bus must never break the simulation */
    }
  }

  /** The pending damage accumulator of one hazard. */
  function pendingFor(id) {
    let entry = pending.get(id);
    if (!entry) {
      entry = { building: 0, morale: 0, treasury: 0, count: 0 };
      pending.set(id, entry);
    }
    return entry;
  }

  // -------------------------------------------------------------------------
  // The simulation
  // -------------------------------------------------------------------------

  /**
   * Apply one slice of damage to the city.
   *
   * The `dps` already carries the mitigation relief (the pure rules applied
   * it when they computed the phase's damage rate), so it is NOT applied
   * again here.
   *
   * @param {object} hazardState
   * @param {object} def
   * @param {number} dps
   * @param {number} seconds
   */
  function applyDamage(hazardState, def, dps, seconds) {
    const report = damageForDps(dps, hazardState, def, { buildings: buildings() }, seconds);
    if (!report.points) return;

    const accumulator = pendingFor(hazardState.id);
    accumulator.count += 1;

    // -- buildings ---------------------------------------------------------
    const damage = haz.buildingDamage && typeof haz.buildingDamage === 'object'
      ? haz.buildingDamage
      : {};
    const nextDamage = { ...damage };
    for (const b of report.buildings) {
      const key = String(b.id);
      const before = nextDamage[key] && typeof nextDamage[key] === 'object'
        ? nextDamage[key]
        : { amount: 0, destroyed: false };
      if (before.destroyed) continue;
      const amount = (Number(before.amount) || 0) + b.amount;
      const entry = { amount, destroyed: amount >= HAZARD_TBD.buildingHealth };
      nextDamage[key] = entry;
      accumulator.building += b.amount;
      if (entry.destroyed) {
        const removed = destroyBuilding(b);
        entry.destroyed = true;
        entry.removed = removed;
        emit(EVENTS.HAZARD_DAMAGE, {
          id: hazardState.id,
          amount: b.amount,
          target: String(b.id),
          kind: 'building',
        });
      }
    }
    haz.buildingDamage = nextDamage;

    // -- morale ------------------------------------------------------------
    if (report.happinessLoss || report.loyaltyLoss) {
      accumulator.morale += report.happinessLoss + report.loyaltyLoss;
      applyMorale(report.happinessLoss, report.loyaltyLoss);
    }

    // -- treasury ----------------------------------------------------------
    if (report.repairCost > 0) {
      const spent = payRepairs(report.repairCost);
      accumulator.treasury += spent;
    }
  }

  /**
   * Flush the pending damage of every hazard, at most once per
   * `HAZARD_TBD.damageEventInterval` seconds of game time.
   */
  function flushDamage() {
    if (damageClock < HAZARD_TBD.damageEventInterval) return;
    damageClock = 0;
    for (const [id, entry] of pending) {
      if (entry.morale > 0) {
        emit(EVENTS.HAZARD_DAMAGE, { id, amount: entry.morale, target: 'city', kind: 'morale' });
      }
      if (entry.treasury > 0) {
        emit(EVENTS.HAZARD_DAMAGE, { id, amount: entry.treasury, target: 'treasury', kind: 'treasury' });
      }
      if (entry.building > 0) {
        emit(EVENTS.HAZARD_DAMAGE, { id, amount: entry.building, target: 'city', kind: 'aggregate' });
      }
      entry.morale = 0;
      entry.treasury = 0;
      entry.building = 0;
      entry.count = 0;
    }
  }

  /**
   * The ground height under a cell, in world-space units.
   *
   * The terrain has real elevation, so an effect placed at world y = 0 is
   * buried inside any raised ground — a wildfire on a hill would burn
   * underground where nobody could see it. The WORLD domain publishes
   * `heightAt(cx, cz)`; the hazard asks it for the ground it sits on.
   *
   * @param {number} cx
   * @param {number} cz
   * @returns {number}
   */
  function groundY(cx, cz) {
    const wld = ctx?.domains?.wld;
    const h = wld && typeof wld.heightAt === 'function' ? wld.heightAt(cx, cz) : null;
    return Number.isFinite(h) ? h : 0;
  }

  /**
   * The pulse of the hazard's VFX, in world space.
   * @param {object} hazardState
   * @param {object} def
   */
  function pulse(hazardState, def) {
    const fx = ctx?.renderer?.fx;
    if (!fx || typeof fx.spawn !== 'function') return;
    if (fx.reducedMotion) return;
    const world = cellToWorld(hazardState.x, hazardState.z, groundY(hazardState.x, hazardState.z) + 0.2);
    const kind = FX_BY_TYPE[def?.type] ?? 'hazard-smoke';
    try {
      fx.spawn(kind, {
        position: { x: world.x, y: world.y, z: world.z },
        seed: (hazardState.id ?? '').length * 31 + (hazardState.phaseIndex ?? 0) * 7,
        scale: 1 + (hazardState.phaseIndex ?? 0) * 0.15,
      });
    } catch {
      /* a broken effect service must never break the simulation */
    }
  }

  /** The warning pulse of a telegraphing hazard. */
  function telegraphPulse(hazardState) {
    const fx = ctx?.renderer?.fx;
    if (!fx || typeof fx.spawn !== 'function') return;
    if (fx.reducedMotion) return;
    const world = cellToWorld(hazardState.x, hazardState.z, groundY(hazardState.x, hazardState.z) + 0.2);
    try {
      fx.spawn('warning', {
        position: { x: world.x, y: world.y, z: world.z },
        seed: (hazardState.id ?? '').length * 13 + (hazardState.phaseIndex ?? 0),
      });
    } catch {
      /* ignore */
    }
  }

  /**
   * Hold a checkpoint during a crisis.
   *
   * The checkpoint is recorded in the hazard subtree (so it survives a
   * save/load) and in the progression record (so the HUD and the level
   * objectives see it).
   *
   * @param {string} checkpointId
   * @returns {boolean} true when the checkpoint was new
   */
  function holdCheckpoint(checkpointId) {
    if (typeof checkpointId !== 'string' || !checkpointId.length) return false;
    const list = Array.isArray(haz.checkpoints) ? haz.checkpoints.slice() : [];
    if (list.includes(checkpointId)) return false;
    list.push(checkpointId);
    haz.checkpoints = list;
    try {
      ctx?.progress?.reachCheckpoint?.(checkpointId, { source: 'hazard-crisis' });
    } catch {
      /* the progression record is optional */
    }
    return true;
  }

  /**
   * The crisis state: the panic, the victory and the failure conditions.
   *
   * - VICTORY: the crisis hazard ran out its LAST phase.
   * - FAILURE: the panic reached its ceiling — the city lost.
   *
   * @returns {{active:boolean, panic:number, failure:boolean, victory:boolean,
   *            checkpoints:number, resolved:boolean}}
   */
  function crisisState() {
    const list = running();
    const crisisHazard = list.find((h) => h && h.crisis) ?? null;
    if (!crisisHazard) {
      return {
        active: false,
        panic: Number(haz.panic) || 0,
        failure: false,
        victory: false,
        checkpoints: heldCheckpoints().length,
        resolved: false,
      };
    }
    const def = defFor(crisisHazard.id);
    const lastIndex = def ? def.phases.length - 1 : 0;
    const lastPhase = def && def.phases.length ? def.phases[lastIndex] : null;
    const finished = crisisHazard.status === HAZARD_STATUS.RESOLVED;
    const reachedEnd = crisisHazard.phaseIndex >= lastIndex;
    return {
      active: !finished,
      panic: Number(crisisHazard.panic) || 0,
      failure: crisisHazard.outcome === HAZARD_OUTCOME.FAILED,
      victory: finished && crisisHazard.outcome === HAZARD_OUTCOME.SURVIVED
        && reachedEnd && !!lastPhase,
      checkpoints: heldCheckpoints().length,
      resolved: finished,
    };
  }

  /**
   * Advance the whole hazard simulation.
   * @param {number} dt seconds of GAME time (zero while the game is paused)
   */
  function tick(dt) {
    if (disposed) return;
    const step = Number(dt);
    if (!Number.isFinite(step) || step <= 0) return;

    const list = running();
    if (!list.length) return;

    damageClock += step;

    const held = heldCheckpoints().length;
    const next = [];

    for (const hazardState of list) {
      if (!hazardState || typeof hazardState !== 'object') continue;
      const def = defFor(hazardState.id);
      if (!def) {
        // The definition vanished (a level change under our feet). The hazard
        // is retired rather than left running blind — and the retirement is
        // announced, so nothing waits for a resolution that never comes.
        const retired = {
          ...hazardState,
          status: HAZARD_STATUS.RESOLVED,
          outcome: HAZARD_OUTCOME.FAILED,
          reason: 'the hazard definition was lost',
        };
        next.push(retired);
        recordResolution(
          { id: retired.id, outcome: retired.outcome, reason: retired.reason },
          retired,
        );
        continue;
      }

      const mitigation = mitigationLevel(def, { services: services() });
      const result = advanceHazard(hazardState, step, { def, mitigation, heldCheckpoints: held });

      for (const event of result.events) {
        handleEvent(event, result.hazardState, def);
      }

      if (result.events.some((e) => e.type === 'damage')) {
        const slice = result.events.filter((e) => e.type === 'damage');
        for (const damageEvent of slice) {
          applyDamage(result.hazardState, def, damageEvent.dps, damageEvent.seconds);
        }
      }

      next.push(result.hazardState);
    }

    haz.hazards = next;
    haz.elapsed = (Number(haz.elapsed) || 0) + step;
    haz.panic = crisisState().panic;

    flushDamage();
  }

  /**
   * Turn a pure event into a bus event.
   * @param {object} event
   * @param {object} hazardState
   * @param {object} def
   */
  function handleEvent(event, hazardState, def) {
    if (!event || typeof event !== 'object') return;
    switch (event.type) {
      case 'started':
        emit(EVENTS.HAZARD_STARTED, {
          id: event.id,
          type: event.hazardType,
          label: event.label,
          x: event.x,
          z: event.z,
          radius: event.radius,
        });
        break;
      case 'phase':
        emit(EVENTS.HAZARD_PHASE, {
          id: event.id,
          phaseIndex: event.phaseIndex,
          phaseId: event.phaseId,
          name: event.name,
          telegraphing: !!event.telegraphing,
        });
        break;
      case 'resolved':
        recordResolution(event, hazardState);
        break;
      default:
        break;
    }
  }

  /**
   * Record a resolution and announce it.
   * @param {object} event
   * @param {object} hazardState
   */
  function recordResolution(event, hazardState) {
    const records = Array.isArray(haz.records) ? haz.records.slice() : [];
    if (!records.some((r) => r && r.id === event.id)) {
      records.push({
        id: event.id,
        outcome: event.outcome,
        reason: event.reason,
        type: hazardState?.type ?? null,
        at: Number(haz.elapsed) || 0,
      });
    }
    haz.records = records;
    emit(EVENTS.HAZARD_RESOLVED, {
      id: event.id,
      outcome: event.outcome,
      reason: event.reason,
    });
  }

  // -------------------------------------------------------------------------
  // The service
  // -------------------------------------------------------------------------

  const service = {
    /** Prepare the state subtree. */
    async init() {
      disposed = false;
      ensureState(ctx?.state);
      // A save that carries the subtree back must be picked up: the subtree
      // object is REPLACED wholesale by `core/save.js`, so the running hazards
      // are read back from the tree on every tick.
      if (!Array.isArray(haz.hazards)) haz.hazards = [];
      if (!Array.isArray(haz.records)) haz.records = [];
      if (!Array.isArray(haz.checkpoints)) haz.checkpoints = [];
      // A checkpoint the player reaches during a crisis is a checkpoint the
      // city HOLDS: it slows the panic. The progression domain announces
      // every checkpoint, so the hazard domain listens for them.
      if (typeof bus?.on === 'function') {
        unsubscribe = bus.on(EVENTS.CHECKPOINT_REACHED, (payload) => {
          if (disposed) return;
          const id = payload?.id;
          if (typeof id !== 'string' || !id.length) return;
          if (!crisisState().active) return;
          holdCheckpoint(id);
        }) || null;
      }
    },

    /**
     * Wall-clock update: the VFX pulses and the telegraph warning.
     * @param {number} dt seconds
     */
    update(dt) {
      if (disposed) return;
      const step = Number(dt);
      if (!Number.isFinite(step) || step <= 0) return;
      fxClock += step;
      if (fxClock < HAZARD_TBD.fxInterval) return;
      fxClock = 0;
      for (const hazardState of running()) {
        if (!hazardState) continue;
        if (hazardState.status === HAZARD_STATUS.TELEGRAPH) telegraphPulse(hazardState);
        else if (hazardState.status === HAZARD_STATUS.ACTIVE) {
          const def = defFor(hazardState.id);
          if (def) pulse(hazardState, def);
        }
      }
    },

    /**
     * Game-time tick: the hazard simulation.
     * @param {number} dt seconds of GAME time
     */
    tick(dt) {
      tick(dt);
    },

    /**
     * Install the level's hazard definitions and reset the running state.
     * @param {object[]} hazardDefs
     */
    load(hazardDefs) {
      const list = Array.isArray(hazardDefs) ? hazardDefs.filter(Boolean) : [];
      const states = [];
      for (const def of list) {
        const created = createHazardState(def);
        if (!created) continue;
        states.push(created);
      }
      haz.defs = list.map((def) => JSON.parse(JSON.stringify(def)));
      haz.hazards = states;
      haz.records = [];
      haz.buildingDamage = {};
      haz.morale = { happiness: 0, loyalty: 0 };
      haz.repairs = { coins: 0, unpaid: 0, owed: 0 };
      haz.panic = 0;
      haz.elapsed = 0;
      pending.clear();
      damageClock = 0;
      fxClock = 0;
      return states.slice();
    },

    /** Forget every hazard and every record. */
    reset() {
      haz.defs = [];
      haz.hazards = [];
      haz.records = [];
      haz.buildingDamage = {};
      haz.checkpoints = [];
      haz.morale = { happiness: 0, loyalty: 0 };
      haz.repairs = { coins: 0, unpaid: 0, owed: 0 };
      haz.panic = 0;
      haz.elapsed = 0;
      pending.clear();
      damageClock = 0;
      fxClock = 0;
      return true;
    },

    /** The hazards that are running right now. */
    active() {
      return running().filter((h) => h && h.status !== HAZARD_STATUS.RESOLVED);
    },

    /** The live `state.hazards` subtree. */
    state() {
      return haz;
    },

    /** The resolved hazard records. */
    resolved() {
      const records = Array.isArray(haz.records) ? haz.records : [];
      return records.slice();
    },

    /**
     * The damage report of one hazard (or of every hazard).
     *
     * The report is what the hazard has DONE so far: the damage points it
     * dealt, the buildings it has damaged and the mitigation that was
     * working against it.
     *
     * @param {string} [id]
     */
    damage(id) {
      const list = id ? running().filter((h) => h && h.id === id) : running();
      const damageMap = haz.buildingDamage && typeof haz.buildingDamage === 'object'
        ? haz.buildingDamage
        : {};
      const reports = [];
      for (const hazardState of list) {
        const def = defFor(hazardState?.id);
        if (!def || !hazardState) continue;
        const damagedBuildings = [];
        for (const b of buildings()) {
          const entry = damageMap[String(b.id)];
          if (!entry || !(Number(entry.amount) > 0)) continue;
          damagedBuildings.push({ id: b.id, x: b.x, z: b.z, amount: entry.amount, destroyed: !!entry.destroyed });
        }
        reports.push({
          id: hazardState.id,
          phaseIndex: hazardState.phaseIndex,
          status: hazardState.status,
          damageDealt: Number(hazardState.damageDealt) || 0,
          mitigation: Number(hazardState.mitigation) || 0,
          panic: Number(hazardState.panic) || 0,
          buildings: damagedBuildings,
        });
      }
      return id ? (reports[0] ?? null) : reports;
    },

    /**
     * Contain a hazard before it burns out.
     * @param {string} id
     * @param {string} [reason]
     * @returns {boolean} true when a running hazard was resolved
     */
    resolveEarly(id, reason = 'the city contained the hazard') {
      const hazardState = stateFor(id);
      if (!hazardState || hazardState.status === HAZARD_STATUS.RESOLVED) return false;
      const resolvedState = resolveHazardEarly(hazardState, reason);
      const next = running().map((h) => (h && h.id === id ? resolvedState : h));
      haz.hazards = next;
      recordResolution(
        { id, outcome: resolvedState.outcome, reason: resolvedState.reason },
        resolvedState,
      );
      return true;
    },

    /**
     * Hold a checkpoint during a crisis.
     *
     * The checkpoint is recorded in the hazard subtree (so it survives a
     * save/load) and in the progression record (so the HUD and the level
     * objectives see it).
     *
     * @param {string} checkpointId
     * @returns {boolean} true when the checkpoint was new
     */
    holdCheckpoint(checkpointId) {
      return holdCheckpoint(checkpointId);
    },

    /** The checkpoints the city holds. */
    checkpoints() {
      return heldCheckpoints();
    },

    /**
     * The mitigation level of a hazard, 0..1.
     * @param {string} id
     */
    mitigationFor(id) {
      const def = defFor(id);
      if (!def) return 0;
      return mitigationLevel(def, { services: services() });
    },

    /**
     * The phase a hazard is in.
     * @param {string} id
     */
    phaseOf(id) {
      const def = defFor(id);
      const hazardState = stateFor(id);
      if (!def || !hazardState) return null;
      return phaseOfState(hazardState, def);
    },

    /**
     * The crisis state: the panic, the victory and the failure conditions.
     * @returns {{active:boolean, panic:number, failure:boolean, victory:boolean,
     *            checkpoints:number, resolved:boolean}}
     */
    crisis() {
      return crisisState();
    },

    /** The definitions of the loaded level. */
    defs() {
      return defs().slice();
    },

    /** Tear the domain down. Safe to call twice. */
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        unsubscribe?.();
      } catch {
        /* ignore */
      }
      unsubscribe = null;
      pending.clear();
      damageClock = 0;
      fxClock = 0;
    },
  };

  return service;
}
