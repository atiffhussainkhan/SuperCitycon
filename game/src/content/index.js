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
 * It does NOT own a state subtree of its own: the progression record lives in
 * `state.meta.progress` (core/progress.js owns the rules), the hazard state
 * lives in the hazard domain, and the world/building state lives in WLD/BLD.
 */

import { EVENTS, emit } from '../core/events.js';
import { GRID } from '../core/config.js';
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
 * The objective state of a level.
 *
 * `met` records whether the objective's condition was satisfied at least once
 * during the run — objectives are cumulative, not instantaneous, because a
 * city's population can fall again after a hazard and the player must not
 * lose progress they already earned.
 */
function emptyObjectiveState(level) {
  const out = new Map();
  for (const objective of level?.objectives ?? []) {
    out.set(objective.id, { met: false, current: 0, target: objective.target });
  }
  return out;
}

/**
 * Create the content service.
 *
 * @param {object} ctx the shared context (core/CONTRACT.md §1)
 * @returns {object} the content service
 */
export function createContent(ctx) {
  /** The level currently loaded, or null. */
  let active = null;
  /** id -> objective state. */
  let objectives = new Map();
  /** Whether the level has been completed. */
  let completed = false;

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
  function apply(id) {
    const level = getLevel(id);
    if (!level) {
      return { ok: false, level: null, applied: 0, skipped: [] };
    }

    const state = ctx?.state;
    const world = ctx?.domains?.world;
    const buildings = ctx?.domains?.buildings;
    const mobility = ctx?.domains?.mobility;

    if (!state) {
      return { ok: false, level, applied: 0, skipped: [] };
    }

    // The level owns the seed and the mode.
    state.meta.seed = level.seed;
    state.meta.levelId = level.id;
    state.meta.difficulty = level.difficulty;

    // --- terrain ---------------------------------------------------------
    if (world?.generate) {
      world.generate(level.seed);
    }

    const skipped = [];
    let applied = 0;

    // --- roads -----------------------------------------------------------
    const roads = (level.spawns ?? []).filter((s) => s.type === 'road');
    for (const road of roads) {
      const result = mobility?.addRoad?.(road.x, road.z);
      if (result === false) {
        skipped.push({ id: road.id, type: 'road', reason: 'the road could not be laid' });
      } else {
        applied += 1;
      }
    }

    // --- buildings -------------------------------------------------------
    // The starting city of a level ALREADY EXISTED when the player arrived:
    // it is not player construction. It therefore goes in as `prebuilt`, so
    // it is neither charged to the treasury nor counted against the
    // player's construction slots — and it bypasses the placement gate,
    // whose slot and funds checks exist to gate the PLAYER's placements.
    const rawPlace = typeof buildings?.place === 'function'
      ? (buildings.place.__scRawPlace ?? buildings.place)
      : null;
    const buildingSpawns = (level.spawns ?? []).filter((s) => s.type === 'building');
    for (const spawn of buildingSpawns) {
      // A spawn with a `rect` is a BLOCK: the building type is laid across
      // the rectangle, stepping by the building's own footprint, so a 2×2
      // building fills a 2×2 block and the next one starts two cells along.
      const cells = blockCellsFor(spawn, footprintOfKey(ctx, spawn.key));
      for (const cell of cells) {
        const result = rawPlace
          ? rawPlace(spawn.key, cell.x, cell.z, spawn.rot ?? 0, { prebuilt: true })
          : { ok: false, reason: 'the buildings domain is unavailable' };
        if (!result || result.ok === false) {
          skipped.push({
            id: `${spawn.id}@${cell.x},${cell.z}`,
            type: 'building',
            reason: result?.reason ?? 'the buildings domain refused the placement',
          });
        } else {
          applied += 1;
        }
      }
    }

    // --- nature ----------------------------------------------------------
    const natureSpawns = (level.spawns ?? []).filter((s) => s.type === 'nature');
    for (const spawn of natureSpawns) {
      const result = world?.placeNature?.(spawn.x, spawn.z, spawn.key);
      if (result === false) {
        skipped.push({ id: spawn.id, type: 'nature', reason: 'the model could not be placed' });
      } else {
        applied += 1;
      }
    }

    // --- citizens --------------------------------------------------------
    const citizenSpawns = (level.spawns ?? []).filter((s) => s.type === 'character');
    for (const spawn of citizenSpawns) {
      const result = ctx?.domains?.population?.spawnCitizen?.({
        character: spawn.key,
        x: spawn.x,
        z: spawn.z,
      });
      if (result === false) {
        skipped.push({ id: spawn.id, type: 'character', reason: 'the citizen could not be spawned' });
      } else {
        applied += 1;
      }
    }

    // --- progression -----------------------------------------------------
    objectives = emptyObjectiveState(level);
    completed = false;

    // The checkpoint and collectible records travel with the save; a level
    // starts with a clean slate for the checkpoints it defines, because the
    // checkpoint ids are level-scoped.
    const progress = ctx?.progress;
    if (progress && typeof progress.set === 'function') {
      const current = progress.record?.() ?? { checkpoints: [], collectibles: [], achievements: [] };
      const keepCheckpoints = current.checkpoints.filter(
        (cpId) => !(level.checkpoints ?? []).some((cp) => cp.id === cpId),
      );
      const keepCollectibles = current.collectibles.filter(
        (cId) => !(level.collectibles ?? []).some((c) => c.id === cId),
      );
      progress.set({
        checkpoints: keepCheckpoints,
        collectibles: keepCollectibles,
        achievements: current.achievements ?? [],
      });
    }

    // --- hazards ---------------------------------------------------------
    const hazards = ctx?.domains?.hazards;
    if (hazards?.load) {
      hazards.load(level.hazards ?? []);
    } else if (hazards?.reset) {
      hazards.reset();
    }

    active = level;
    emit(EVENTS.GAME_RESET, { levelId: level.id, applied, skipped: skipped.length });
    return { ok: true, level, applied, skipped };
  }

  /**
   * Evaluate the objectives of the active level against the live state.
   *
   * @returns {{complete:boolean, objectives:Array<object>}}
   */
  function evaluateObjectives() {
    if (!active) return { complete: false, objectives: [] };
    const state = ctx?.state ?? {};
    const rows = [];

    for (const objective of active.objectives ?? []) {
      const record = objectives.get(objective.id) ?? { met: false, current: 0, target: objective.target };
      const current = measureObjective(objective, state, ctx);
      if (!record.met && current >= objective.target) {
        record.met = true;
      }
      record.current = current;
      objectives.set(objective.id, record);
      rows.push({
        id: objective.id,
        label: objective.label,
        type: objective.type,
        current,
        target: objective.target,
        met: record.met,
        progress: objective.target > 0 ? Math.min(1, current / objective.target) : 0,
      });
    }

    const complete = rows.length > 0 && rows.every((r) => r.met);
    if (complete && !completed) {
      completed = true;
      emit(EVENTS.STAGE_ADVANCED, { levelId: active.id, kind: 'level-complete' });
    }
    return { complete, objectives: rows };
  }

  /**
   * Record a checkpoint the player has reached.
   * @param {string} id
   */
  function reachCheckpoint(id) {
    if (!active) return false;
    const known = (active.checkpoints ?? []).some((cp) => cp.id === id);
    if (!known) return false;
    return ctx?.progress?.reachCheckpoint?.(id, { levelId: active.id }) ?? false;
  }

  /**
   * Record a collectible the player has found.
   * @param {string} id
   */
  function findCollectible(id) {
    if (!active) return false;
    const known = (active.collectibles ?? []).some((c) => c.id === id);
    if (!known) return false;
    return ctx?.progress?.findCollectible?.(id, { levelId: active.id }) ?? false;
  }

  /**
   * The checkpoints of the active level and whether each was reached.
   * @returns {Array<{id:string,label:string,x:number,z:number,reached:boolean}>}
   */
  function checkpointStatus() {
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

  return {
    /** The active level, or null. */
    activeLevel() { return active; },
    /** The level id currently loaded, or null. */
    activeLevelId() { return active?.id ?? null; },
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
    /** Whether the active level is complete. */
    isComplete() { return completed; },
    /** Per-frame hook — evaluates the objectives. */
    update() {
      if (!active) return;
      evaluateObjectives();
    },
    /** Teardown. */
    dispose() {
      active = null;
      objectives = new Map();
      completed = false;
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
 * @returns {number}
 */
export function measureObjective(objective, state, ctx = {}) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

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
      return found.length;
    }
    case 'checkpoint': {
      const reached = ctx?.progress?.checkpoints?.() ?? [];
      return reached.length;
    }
    case 'hazard': {
      const hazards = ctx?.domains?.hazards;
      if (!hazards) return 0;
      const resolved = hazards.resolved?.() ?? [];
      return resolved.length;
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
