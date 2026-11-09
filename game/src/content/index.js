/**
 * content/index.js — CONTENT service layer.
 *
 * OWNER: the integrator (content/).
 *
 * This is the *service* layer of the content domain: it wires the pure level
 * definitions and the pure validator to the live game. Per core/CONTRACT.md
 * §5, the RULES live in the pure modules (`content/levels.js`,
 * `content/validate.js`) and this file is where they meet the world.
 *
 * Responsibilities:
 *   - expose the level library to the UI (level select, world map)
 *   - apply a level to the live state: terrain seed, roads, buildings,
 *     nature, citizens
 *   - register the level's checkpoints, collectibles and hazards with the
 *     domains that own them
 *   - track the level's objective state and emit completion
 *
 * Level identity and earned objectives travel with the city in `state.meta`.
 * Checkpoints and collectibles belong to CORE's progression record.
 */

import { EVENTS, emit } from '../core/events.js';
import { GRID, MODES, TOOLS } from '../core/config.js';
import { LEVELS, getLevel, listLevels, levelOrder, nextLevel, previousLevel, levelsForMode } from './levels.js';
import { validateLevel, validateLevels, footprintOf, spawnCells } from './validate.js';

export { LEVELS, getLevel, listLevels, levelOrder, nextLevel, previousLevel, levelsForMode };
export { validateLevel, validateLevels, footprintOf, spawnCells };

/**
 * The footprint of a building type, read from the live catalogue.
 *
 * @param {object} ctx
 * @param {string} key the catalogue id
 * @returns {[number, number]}
 */
function footprintOfKey(ctx, key) {
  const catalogue = ctx?.state?.buildings?.catalogue;
  let def = null;
  if (catalogue instanceof Map) def = catalogue.get(key);
  else if (Array.isArray(catalogue)) def = catalogue.find((d) => d?.id === key);
  const fp = def?.footprintCells;
  if (!Array.isArray(fp) || fp.length < 2) return [1, 1];
  const w = Number.isInteger(fp[0]) && fp[0] > 0 ? fp[0] : 1;
  const h = Number.isInteger(fp[1]) && fp[1] > 0 ? fp[1] : 1;
  return [w, h];
}

/**
 * The cells a spawn's block covers.
 *
 * @param {object} spawn
 * @param {[number, number]} footprint
 * @returns {Array<{x:number,z:number}>}
 */
function blockCellsFor(spawn, footprint) {
  return spawnCells(spawn, footprint);
}

/**
 * Create the content service.
 *
 * @param {object} ctx the shared context (core/CONTRACT.md §1)
 * @returns {object} the content service
 */
export function createContent(ctx) {
  let applying = false;
  let disposed = false;
  const unsubscribes = [];

  function activeLevel() {
    return applying || disposed ? null : getLevel(ctx?.state?.meta?.levelId);
  }

  function authoredCitizens(level, onSpawn = () => {}) {
    const population = ctx?.domains?.population;
    population?.clearAuthoredCitizens?.();
    for (const spawn of level?.spawns ?? []) {
      if (spawn.type === 'character') {
        const result = population?.spawnAuthoredCitizen?.(spawn.key, spawn.x, spawn.z);
        onSpawn(result, spawn.id, spawn.type);
      }
    }
  }

  /** The building catalogue ids, read lazily (the catalogue loads after us). */
  function buildingIds() {
    const catalogue = ctx?.state?.buildings?.catalogue;
    const out = new Set();
    if (catalogue instanceof Map) {
      for (const [id, def] of catalogue) {
        if (def && typeof def.id === 'string') out.add(def.id);
      }
      return out;
    }
    if (Array.isArray(catalogue)) {
      for (const def of catalogue) if (def?.id) out.add(def.id);
      return out;
    }
    return out;
  }

  /**
   * The resources a level may reference, resolved against the live game.
   * @returns {{buildings:Set<string>, characters:Set<string>, models:Set<string>, gridSize:number}}
   */
  function resources() {
    const manifest = ctx?.manifest ?? ctx?.assets?.manifest ?? {};
    const catalogue = ctx?.state?.buildings?.catalogue;
    const footprints = {};
    const collect = (def) => {
      if (!def?.id) return;
      const fp = def.footprintCells;
      if (Array.isArray(fp) && fp.length >= 2) footprints[def.id] = [fp[0], fp[1]];
    };
    if (catalogue instanceof Map) for (const def of catalogue.values()) collect(def);
    else if (Array.isArray(catalogue)) for (const def of catalogue) collect(def);
    return {
      buildings: buildingIds(),
      characters: new Set(Object.keys(manifest.characters ?? {})),
      models: new Set(Object.keys(manifest.models ?? {})),
      footprints,
      gridSize: ctx?.config?.GRID?.size ?? GRID.size,
    };
  }

  /**
   * Validate a level against the live game's resources.
   * @param {string} id
   * @returns {object} the report
   */
  function validate(id) {
    const level = getLevel(id);
    if (!level) {
      const report = { issues: [], errors: 1, warnings: 0, infos: 0, ok: false };
      report.issues.push({
        severity: 'error',
        code: 'level.unknown',
        message: `No level with id "${id}".`,
        path: 'id',
      });
      return report;
    }
    return validateLevel(level, resources());
  }

  /**
   * Validate the whole library.
   * @returns {object} the combined report
   */
  function validateAll() {
    return validateLevels(LEVELS, resources());
  }

  /**
   * Apply a level to the live city.
   *
   * The order matters: the terrain is generated first (everything else is
   * placed on that terrain), then the roads (so buildings can find a road
   * connection), then the buildings, then the nature, then the citizens.
   *
   * A spawn that cannot be applied (a building the rules refuse, a cell that
   * is underwater) is REPORTED, not silently dropped: the return value lists
   * every spawn that was skipped and why.
   *
   * @param {string} id
   * @returns {{ok:boolean, level:object|null, applied:number, skipped:Array}}
   */
  async function apply(id) {
    const level = getLevel(id);
    const skipped = [];
    let applied = 0;
    const failure = (reason) => ({ ok: false, level, applied, skipped, reason });
    if (!level) return failure('Unknown level');
    if (applying || disposed) return failure('Level loading is unavailable');

    const modes = ctx?.core?.modes;
    const { wld, world = wld, buildings, mobility, economy, hazards } = ctx?.domains ?? {};
    // CORE replaces the subtrees in place. Retain the previous ones until
    // generation succeeds so a failed load can restore the player's city.
    const previousState = { ...ctx?.state };
    const previous = previousState.meta;
    if (!previous || !modes?.startMode || !world?.generate) {
      return failure('The level services are unavailable');
    }
    const report = validate(id);
    if (!report.ok) return failure(report.issues.find((issue) => issue.severity === 'error')?.message);

    applying = true;
    let meta;
    let succeeded = false;
    const stillLoading = () => !disposed && ctx?.state?.meta === meta;
    try {
      const mode = previous.mode ?? MODES.play;
      const started = modes.startMode(mode, {
        fresh: true,
        seed: level.seed,
        entitlements: previous.entitlements,
        winConditions: previous.winConditions,
      });
      if (!started) return failure('The city could not be reset');
      meta = ctx.state.meta;
      meta.ready = previous.ready;
      modes.setPaused?.(true);

      // Clear the old city before allocating new instance ids and terrain.
      await buildings?.init?.();
      if (!stillLoading()) return failure('The city changed during level loading');
      economy?.init?.();
      const generated = await world.generate(level.seed);
      if (!stillLoading()) return failure('The city changed during level loading');
      if (generated === null || generated === false) return failure('The terrain could not be generated');
      mobility?.dispose?.();
      mobility?.init?.();

      function count(result, id, type) {
        if (!result || result.ok === false) {
          skipped.push({ id, type, reason: result?.reason ?? `The ${type} could not be placed` });
        } else {
          applied += 1;
        }
      }

      for (const road of level.spawns.filter((s) => s.type === 'road')) {
        count(mobility?.addRoad?.(road.x, road.z), road.id, road.type);
      }

      // Prebuilt structures bypass the player's funds and construction gates.
      const rawPlace = buildings?.place?.__scRawPlace ?? buildings?.place;
      for (const spawn of level.spawns.filter((s) => s.type === 'building')) {
        const cells = blockCellsFor(spawn, footprintOfKey(ctx, spawn.key));
        for (const cell of cells) {
          const result = rawPlace?.(spawn.key, cell.x, cell.z, spawn.rot ?? 0, { prebuilt: true });
          count(result, `${spawn.id}@${cell.x},${cell.z}`, spawn.type);
        }
      }

      for (const spawn of level.spawns.filter((s) => s.type === 'nature')) {
        const result = await world.placeNature?.(spawn.x, spawn.z, spawn.key);
        if (!stillLoading()) return failure('The city changed during level loading');
        count(result, spawn.id, spawn.type);
      }
      authoredCitizens(level, count);

      hazards?.load?.(level.hazards);
      meta.levelId = level.id;
      meta.difficulty = level.difficulty;
      meta.levelObjectives = [];
      meta.levelComplete = false;
      succeeded = true;
    } catch (error) {
      ctx?.logger?.exception?.(error, { where: 'loadLevel', level: level.id });
      return failure('The level could not be loaded');
    } finally {
      applying = false;
      if (meta && stillLoading()) {
        if (succeeded) {
          modes.setPaused?.(Boolean(previous.paused));
        } else {
          Object.assign(ctx.state, previousState);
          emit(EVENTS.GAME_LOADED, { source: 'level-rollback' });
        }
      }
    }
    emit(EVENTS.GAME_RESET, { levelId: level.id, applied, skipped: skipped.length });
    return { ok: true, level, applied, skipped };
  }

  /**
   * Evaluate the objectives of the active level against the live state.
   *
   * @returns {{complete:boolean, objectives:Array<object>}}
   */
  function evaluateObjectives() {
    const active = activeLevel();
    if (!active) return { complete: false, objectives: [] };
    const state = ctx.state;
    const saved = state.meta.levelObjectives;
    const met = new Set(Array.isArray(saved) ? saved : []);
    const rows = active.objectives.map((objective) => {
      const current = measureObjective(objective, state, ctx, active);
      if (current >= objective.target) met.add(objective.id);
      return {
        id: objective.id,
        label: objective.label,
        type: objective.type,
        current,
        target: objective.target,
        met: met.has(objective.id),
        progress: objective.target > 0 ? Math.min(1, current / objective.target) : 0,
      };
    });
    if (!Array.isArray(saved) || met.size !== saved.length) state.meta.levelObjectives = [...met];

    const complete = rows.length > 0 && rows.every((r) => r.met);
    if (complete && state.meta.levelComplete !== true) {
      state.meta.levelComplete = true;
      emit(EVENTS.STAGE_ADVANCED, { levelId: active.id, kind: 'level-complete' });
    }
    return { complete, objectives: rows };
  }

  /**
   * Record a checkpoint the player has reached.
   * @param {string} id
   */
  function reachCheckpoint(id) {
    const active = activeLevel();
    const checkpoint = active?.checkpoints.find((cp) => cp.id === id);
    if (!checkpoint) return false;
    const { objectives } = evaluateObjectives();
    const unlocked = (checkpoint.requires ?? []).every((required) =>
      objectives.some((objective) => objective.id === required && objective.met));
    if (!unlocked) return false;
    return ctx?.progress?.reachCheckpoint?.(id, { levelId: active.id }) ?? false;
  }

  /**
   * Record a collectible the player has found.
   * @param {string} id
   */
  function findCollectible(id) {
    const active = activeLevel();
    if (!active?.collectibles.some((c) => c.id === id)) return false;
    return ctx?.progress?.findCollectible?.(id, { levelId: active.id }) ?? false;
  }

  /**
   * The checkpoints of the active level and whether each was reached.
   * @returns {Array<{id:string,label:string,x:number,z:number,reached:boolean}>}
   */
  function checkpointStatus() {
    const active = activeLevel();
    if (!active) return [];
    const progress = ctx?.progress;
    return (active.checkpoints ?? []).map((cp) => ({
      id: cp.id,
      label: cp.label,
      x: cp.x,
      z: cp.z,
      reached: progress?.hasCheckpoint?.(cp.id) ?? false,
    }));
  }

  /**
   * The collectibles of the active level and whether each was found.
   * @returns {Array<{id:string,label:string,x:number,z:number,found:boolean}>}
   */
  function collectibleStatus() {
    const active = activeLevel();
    if (!active) return [];
    const progress = ctx?.progress;
    return (active.collectibles ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      x: c.x,
      z: c.z,
      found: progress?.hasCollectible?.(c.id) ?? false,
    }));
  }

  /** Inspecting an authored landmark is the in-game way to claim it. */
  function onClick(cell, button = 0) {
    if (!cell || cell.outOfBounds || button !== 0 || ctx?.state?.ui?.tool !== TOOLS.inspect) return false;
    const checkpoint = checkpointStatus().find((cp) => cp.x === cell.x && cp.z === cell.z);
    const collectible = collectibleStatus().find((c) => c.x === cell.x && c.z === cell.z);
    const ui = ctx?.ui;
    if (checkpoint && !checkpoint.reached) {
      if (reachCheckpoint(checkpoint.id)) {
        ui?.showToast?.(`${checkpoint.label} reached`, 'success');
      } else {
        ui?.showToast?.(`${checkpoint.label} is locked until its objectives are met`, 'warn');
      }
    }
    if (collectible && !collectible.found && findCollectible(collectible.id)) {
      ui?.showToast?.(`${collectible.label} found`, 'success');
    }
    return Boolean(checkpoint || collectible);
  }

  return {
    init() {
      if (!ctx?.bus?.on) return;
      unsubscribes.push(ctx.bus.on(EVENTS.GAME_LOADED, () => authoredCitizens(activeLevel())));
      unsubscribes.push(ctx.bus.on(EVENTS.GAME_RESET, ({ levelId } = {}) => {
        if (!levelId) authoredCitizens(null);
      }));
    },
    /** The active level, or null. */
    activeLevel,
    /** The level id currently loaded, or null. */
    activeLevelId() { return activeLevel()?.id ?? null; },
    /** The library. */
    levels() { return listLevels(); },
    /** The world-map chain. */
    order() { return levelOrder(); },
    /** Look a level up. */
    get(id) { return getLevel(id); },
    /** The next map in the chain. */
    next(id) { return nextLevel(id); },
    /** The previous map in the chain. */
    previous(id) { return previousLevel(id); },
    /** The maps a mode offers. */
    forMode(mode) { return levelsForMode(mode); },
    /** Validate one level against the live resources. */
    validate,
    /** Validate the whole library. */
    validateAll,
    /** Apply a level to the city. */
    apply,
    isLoading() { return applying; },
    /** Evaluate the objectives of the active level. */
    evaluateObjectives,
    /** Record a checkpoint. */
    reachCheckpoint,
    /** Record a collectible. */
    findCollectible,
    /** The checkpoint status of the active level. */
    checkpointStatus,
    /** The collectible status of the active level. */
    collectibleStatus,
    onClick,
    /** Whether the active level is complete. */
    isComplete() { return !!activeLevel() && ctx.state.meta.levelComplete === true; },
    /** Per-frame hook — evaluates the objectives. */
    update() {
      evaluateObjectives();
    },
    /** Teardown. */
    dispose() {
      disposed = true;
      for (const unsubscribe of unsubscribes.splice(0)) unsubscribe();
    },
  };
}

/**
 * Measure one objective against the live state.
 *
 * Pure: it only reads the state tree, so it is deterministic and testable.
 *
 * @param {object} objective
 * @param {object} state
 * @param {object} ctx
 * @param {object} [level] limits generic counts to this level's records
 * @returns {number}
 */
export function measureObjective(objective, state, ctx = {}, level = null) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const countRecords = (records, targetId, definitions) => {
    if (targetId) return Number(records.includes(targetId));
    if (!definitions) return records.length;
    return definitions.filter(({ id }) => records.includes(id)).length;
  };

  switch (objective?.type) {
    case 'population':
      return num(state?.population?.total);
    case 'treasury':
      return num(state?.economy?.treasury);
    case 'buildings': {
      const instances = state?.buildings?.instances;
      if (instances instanceof Map) return instances.size;
      if (Array.isArray(instances)) return instances.length;
      return 0;
    }
    case 'roads':
      return num(state?.mobility?.roads?.size);
    case 'happiness':
      return num(state?.population?.happiness);
    case 'coverage': {
      const coverage = state?.services?.cityCoverage;
      if (!coverage || typeof coverage !== 'object') return 0;
      const values = Object.values(coverage).filter((v) => typeof v === 'number' && Number.isFinite(v));
      if (!values.length) return 0;
      return values.reduce((a, b) => a + b, 0) / values.length;
    }
    case 'collectible': {
      const found = ctx?.progress?.collectibles?.() ?? [];
      return countRecords(found, objective.collectibleId, level?.collectibles);
    }
    case 'checkpoint': {
      const reached = ctx?.progress?.checkpoints?.() ?? [];
      return countRecords(reached, objective.checkpointId, level?.checkpoints);
    }
    case 'hazard': {
      const hazards = ctx?.domains?.hazards;
      if (!hazards) return 0;
      const resolved = hazards.resolved?.() ?? [];
      const survived = resolved.filter((record) => record?.outcome !== 'failed');
      return countRecords(survived.map((record) => record?.id ?? record), objective.hazardId, level?.hazards);
    }
    case 'custom':
      try {
        return num(objective.check?.(state, ctx));
      } catch {
        return 0;
      }
    default:
      return 0;
  }
}
