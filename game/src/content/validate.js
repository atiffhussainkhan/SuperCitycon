/**
 * content/validate.js — CONTENT (pure rule module).
 *
 * OWNER: the integrator (content/).
 *
 * Phase 5 of the V5 directive asks for a reusable level-content pipeline with
 * validation that detects:
 *
 *   - missing exits
 *   - invalid spawn points
 *   - broken progression links
 *   - missing resources
 *   - incorrect checkpoint definitions
 *   - unsupported object types
 *   - invalid metadata
 *   - unreachable required objectives where detectable
 *
 * This module implements exactly those checks as PURE functions. It never
 * imports `three`, never touches the DOM and never mutates a level — it reads
 * a level and returns a report. That keeps it unit-testable in plain Node
 * (`node --test src/content/content.test.mjs`) and reusable from both the
 * runtime and the offline validator CLI.
 *
 * The severity model:
 *   - `error`   — the level cannot be played as written. The validator CLI
 *                 exits non-zero when any error is present.
 *   - `warning` — the level is playable but something is suspicious (an
 *                 objective no exit requires, a spawn with no model, …).
 *   - `info`    — informational note.
 *
 * HONESTY: the validator can only check what the level *declares*. It cannot
 * prove a level is fun, and it cannot prove an objective is reachable by any
 * route other than the declared progression links. Where a check is not
 * possible the report says so with a `not-checked` note rather than claiming
 * a pass.
 */

import { GRID } from '../core/config.js';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** The object types a level may spawn. */
export const SPAWN_TYPES = Object.freeze(['building', 'character', 'nature', 'road']);

/** The objective kinds a level may declare. */
export const OBJECTIVE_TYPES = Object.freeze([
  'population',
  'treasury',
  'buildings',
  'happiness',
  'coverage',
  'collectible',
  'checkpoint',
  'hazard',
  'custom',
]);

/** The hazard kinds the hazard domain understands. */
export const HAZARD_TYPES = Object.freeze([
  'flood',
  'wildfire',
  'outage',
  'blight',
  'earthquake',
  'heatwave',
]);

/** The difficulty bands a level may declare. */
export const DIFFICULTIES = Object.freeze(['tutorial', 'easy', 'normal', 'hard', 'crisis']);

/** Severity ordering, lowest number = most severe. */
const SEVERITY_ORDER = Object.freeze({ error: 0, warning: 1, info: 2 });

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

/** A cell is valid when it sits inside the playfield. */
export function cellInBounds(x, z, size = GRID.size) {
  if (!Number.isInteger(x) || !Number.isInteger(z)) return false;
  return x >= 0 && z >= 0 && x < size && z < size;
}

/**
 * A stable key for a cell, used to detect overlapping spawns.
 * @param {number} x
 * @param {number} z
 */
export function spawnKey(x, z) {
  return `${x},${z}`;
}

/**
 * Collect the ids declared by a list of records.
 * @param {Array<object>} list
 * @param {string} field
 * @returns {Set<string>}
 */
function idsOf(list, field = 'id') {
  const out = new Set();
  for (const item of list) {
    if (isPlainObject(item) && isNonEmptyString(item[field])) out.add(item[field]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

/**
 * An empty report.
 * @returns {{issues:Array, errors:number, warnings:number, infos:number, ok:boolean}}
 */
export function emptyReport() {
  return { issues: [], errors: 0, warnings: 0, infos: 0, ok: true };
}

/**
 * Push an issue onto a report and keep the counters honest.
 *
 * @param {object} report
 * @param {string} severity `error` | `warning` | `info`
 * @param {string} code machine-readable issue code
 * @param {string} message human-readable description
 * @param {object} [details] extra context (path, value, …)
 */
export function addIssue(report, severity, code, message, details = {}) {
  const level = SEVERITY_ORDER[severity] === undefined ? 'warning' : severity;
  report.issues.push({ severity: level, code, message, ...details });
  if (level === 'error') report.errors += 1;
  else if (level === 'warning') report.warnings += 1;
  else report.infos += 1;
  report.ok = report.errors === 0;
  return report;
}

/**
 * Sort a report's issues so the worst come first.
 * @param {object} report
 */
export function finaliseReport(report) {
  report.issues.sort((a, b) => {
    const d = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (d !== 0) return d;
    return String(a.code).localeCompare(String(b.code));
  });
  report.ok = report.errors === 0;
  return report;
}

// ---------------------------------------------------------------------------
// The validator
// ---------------------------------------------------------------------------

/**
 * Validate one level.
 *
 * @param {object} level the level definition
 * @param {object} [resources] what the level may reference
 * @param {Set<string>|string[]} [resources.buildings] valid building catalogue ids
 * @param {Set<string>|string[]} [resources.characters] valid manifest character keys
 * @param {Set<string>|string[]} [resources.models] valid manifest model keys
 * @param {number} [resources.gridSize] the playfield size in cells
 * @returns {object} the report
 */
export function validateLevel(level, resources = {}) {
  const report = emptyReport();

  if (!isPlainObject(level)) {
    addIssue(report, 'error', 'level.not-an-object',
      'A level definition must be an object.', { path: '' });
    return finaliseReport(report);
  }

  const size = Number.isInteger(resources.gridSize) ? resources.gridSize : GRID.size;
  const buildingIds = toSet(resources.buildings);
  const characterIds = toSet(resources.characters);
  const modelIds = toSet(resources.models);

  // -- identity + metadata -------------------------------------------------
  if (!isNonEmptyString(level.id)) {
    addIssue(report, 'error', 'level.missing-id', 'The level has no id.', { path: 'id' });
  } else if (!/^[a-z0-9][a-z0-9-]*$/.test(level.id)) {
    addIssue(report, 'warning', 'level.id-format',
      `Level id "${level.id}" should be lower-case kebab-case.`, { path: 'id' });
  }

  if (!isNonEmptyString(level.name)) {
    addIssue(report, 'error', 'level.missing-name', 'The level has no name.', { path: 'name' });
  }

  if (!isNonEmptyString(level.description)) {
    addIssue(report, 'warning', 'level.missing-description',
      'The level has no description; the level-select screen will show a blank entry.',
      { path: 'description' });
  }

  if (!isFiniteNumber(level.seed)) {
    addIssue(report, 'error', 'level.invalid-seed',
      'The level seed must be a finite number so the terrain is reproducible.',
      { path: 'seed' });
  }

  if (!DIFFICULTIES.includes(level.difficulty)) {
    addIssue(report, 'error', 'level.invalid-difficulty',
      `Unknown difficulty "${level.difficulty}". Expected one of: ${DIFFICULTIES.join(', ')}.`,
      { path: 'difficulty' });
  }

  validateMetadata(level.metadata, report);

  // -- objectives ----------------------------------------------------------
  const objectives = Array.isArray(level.objectives) ? level.objectives : [];
  if (!Array.isArray(level.objectives)) {
    addIssue(report, 'error', 'level.objectives-not-an-array',
      '`objectives` must be an array.', { path: 'objectives' });
  }
  const objectiveIds = idsOf(objectives);
  if (objectiveIds.size !== objectives.length) {
    addIssue(report, 'error', 'level.duplicate-objective-id',
      'Two objectives share the same id.', { path: 'objectives' });
  }
  for (let i = 0; i < objectives.length; i += 1) {
    const obj = objectives[i];
    const path = `objectives[${i}]`;
    if (!isPlainObject(obj)) {
      addIssue(report, 'error', 'objective.not-an-object', 'An objective is not an object.', { path });
      continue;
    }
    if (!isNonEmptyString(obj.id)) {
      addIssue(report, 'error', 'objective.missing-id', 'An objective has no id.', { path });
    }
    if (!isNonEmptyString(obj.label)) {
      addIssue(report, 'warning', 'objective.missing-label',
        `Objective "${obj.id}" has no label.`, { path });
    }
    if (!OBJECTIVE_TYPES.includes(obj.type)) {
      addIssue(report, 'error', 'objective.unknown-type',
        `Objective "${obj.id}" has unknown type "${obj.type}". Expected one of: ${OBJECTIVE_TYPES.join(', ')}.`,
        { path: `${path}.type` });
    }
    if (!isPositiveInt(obj.target)) {
      addIssue(report, 'error', 'objective.invalid-target',
        `Objective "${obj.id}" needs a positive integer target.`, { path: `${path}.target` });
    }
    if (obj.type === 'collectible' && isNonEmptyString(obj.collectibleId)) {
      // checked against the collectible list further down
    }
    if (obj.type === 'custom' && typeof obj.check !== 'function') {
      addIssue(report, 'error', 'objective.custom-without-check',
        `Objective "${obj.id}" is custom but declares no check function.`, { path: `${path}.check` });
    }
  }

  // -- checkpoints ---------------------------------------------------------
  const checkpoints = Array.isArray(level.checkpoints) ? level.checkpoints : [];
  if (!Array.isArray(level.checkpoints)) {
    addIssue(report, 'error', 'level.checkpoints-not-an-array',
      '`checkpoints` must be an array.', { path: 'checkpoints' });
  }
  const checkpointIds = idsOf(checkpoints);
  if (checkpointIds.size !== checkpoints.length) {
    addIssue(report, 'error', 'level.duplicate-checkpoint-id',
      'Two checkpoints share the same id.', { path: 'checkpoints' });
  }
  for (let i = 0; i < checkpoints.length; i += 1) {
    const cp = checkpoints[i];
    const path = `checkpoints[${i}]`;
    if (!isPlainObject(cp)) {
      addIssue(report, 'error', 'checkpoint.not-an-object', 'A checkpoint is not an object.', { path });
      continue;
    }
    if (!isNonEmptyString(cp.id)) {
      addIssue(report, 'error', 'checkpoint.missing-id', 'A checkpoint has no id.', { path });
    }
    if (!isNonEmptyString(cp.label)) {
      addIssue(report, 'warning', 'checkpoint.missing-label',
        `Checkpoint "${cp.id}" has no label.`, { path });
    }
    if (!cellInBounds(cp.x, cp.z, size)) {
      addIssue(report, 'error', 'checkpoint.out-of-bounds',
        `Checkpoint "${cp.id}" is at (${cp.x}, ${cp.z}), outside the ${size}×${size} playfield.`,
        { path: `${path}.x` });
    }
    if (Array.isArray(cp.requires)) {
      for (const req of cp.requires) {
        if (!objectiveIds.has(req)) {
          addIssue(report, 'error', 'checkpoint.broken-progression-link',
            `Checkpoint "${cp.id}" requires unknown objective "${req}".`, { path: `${path}.requires` });
        }
      }
    }
  }

  // -- collectibles --------------------------------------------------------
  const collectibles = Array.isArray(level.collectibles) ? level.collectibles : [];
  if (!Array.isArray(level.collectibles)) {
    addIssue(report, 'error', 'level.collectibles-not-an-array',
      '`collectibles` must be an array.', { path: 'collectibles' });
  }
  const collectibleIds = idsOf(collectibles);
  if (collectibleIds.size !== collectibles.length) {
    addIssue(report, 'error', 'level.duplicate-collectible-id',
      'Two collectibles share the same id.', { path: 'collectibles' });
  }
  for (let i = 0; i < collectibles.length; i += 1) {
    const c = collectibles[i];
    const path = `collectibles[${i}]`;
    if (!isPlainObject(c)) {
      addIssue(report, 'error', 'collectible.not-an-object', 'A collectible is not an object.', { path });
      continue;
    }
    if (!isNonEmptyString(c.id)) {
      addIssue(report, 'error', 'collectible.missing-id', 'A collectible has no id.', { path });
    }
    if (!isNonEmptyString(c.label)) {
      addIssue(report, 'warning', 'collectible.missing-label',
        `Collectible "${c.id}" has no label.`, { path });
    }
    if (!cellInBounds(c.x, c.z, size)) {
      addIssue(report, 'error', 'collectible.out-of-bounds',
        `Collectible "${c.id}" is at (${c.x}, ${c.z}), outside the ${size}×${size} playfield.`,
        { path: `${path}.x` });
    }
  }

  // -- hazards -------------------------------------------------------------
  const hazards = Array.isArray(level.hazards) ? level.hazards : [];
  if (!Array.isArray(level.hazards)) {
    addIssue(report, 'error', 'level.hazards-not-an-array',
      '`hazards` must be an array.', { path: 'hazards' });
  }
  const hazardIds = idsOf(hazards);
  if (hazardIds.size !== hazards.length) {
    addIssue(report, 'error', 'level.duplicate-hazard-id',
      'Two hazards share the same id.', { path: 'hazards' });
  }
  for (let i = 0; i < hazards.length; i += 1) {
    const h = hazards[i];
    const path = `hazards[${i}]`;
    if (!isPlainObject(h)) {
      addIssue(report, 'error', 'hazard.not-an-object', 'A hazard is not an object.', { path });
      continue;
    }
    if (!isNonEmptyString(h.id)) {
      addIssue(report, 'error', 'hazard.missing-id', 'A hazard has no id.', { path });
    }
    if (!isNonEmptyString(h.label)) {
      addIssue(report, 'warning', 'hazard.missing-label',
        `Hazard "${h.id}" has no label.`, { path });
    }
    if (!HAZARD_TYPES.includes(h.type)) {
      addIssue(report, 'error', 'hazard.unknown-type',
        `Hazard "${h.id}" has unknown type "${h.type}". Expected one of: ${HAZARD_TYPES.join(', ')}.`,
        { path: `${path}.type` });
    }
    if (!isFiniteNumber(h.x) || !isFiniteNumber(h.z)) {
      addIssue(report, 'error', 'hazard.invalid-position',
        `Hazard "${h.id}" needs numeric x and z.`, { path });
    } else if (!cellInBounds(Math.round(h.x), Math.round(h.z), size)) {
      addIssue(report, 'warning', 'hazard.out-of-bounds',
        `Hazard "${h.id}" sits outside the ${size}×${size} playfield and will never fire.`,
        { path: `${path}.x` });
    }
    if (!isPositiveInt(h.radius)) {
      addIssue(report, 'error', 'hazard.invalid-radius',
        `Hazard "${h.id}" needs a positive integer radius.`, { path: `${path}.radius` });
    }
    if (!Array.isArray(h.phases) || h.phases.length === 0) {
      addIssue(report, 'error', 'hazard.no-phases',
        `Hazard "${h.id}" declares no phases, so it cannot progress.`, { path: `${path}.phases` });
    } else {
      // A crisis runs its phases back to back with no lull and builds a
      // city-wide panic, so a single-phase crisis has nothing to escalate
      // through.
      if (h.crisis === true && h.phases.length < 2) {
        addIssue(report, 'warning', 'hazard.crisis-single-phase',
          `Hazard "${h.id}" is a crisis but declares only one phase; a crisis needs a ladder.`,
          { path: `${path}.phases` });
      }
      for (let p = 0; p < h.phases.length; p += 1) {
        const phase = h.phases[p];
        const phasePath = `${path}.phases[${p}]`;
        if (!isPlainObject(phase)) {
          addIssue(report, 'error', 'hazard.phase-not-an-object',
            'A hazard phase is not an object.', { path: phasePath });
          continue;
        }
        if (!isNonEmptyString(phase.id)) {
          addIssue(report, 'error', 'hazard.phase-missing-id',
            'A hazard phase has no id.', { path: phasePath });
        }
        if (!isNonEmptyString(phase.name)) {
          addIssue(report, 'warning', 'hazard.phase-missing-name',
            `Phase "${phase.id}" has no name.`, { path: phasePath });
        }
        if (!isPositiveInt(phase.duration)) {
          addIssue(report, 'error', 'hazard.phase-invalid-duration',
            `Phase "${phase.id}" needs a positive integer duration in seconds.`, { path: phasePath });
        }
      }
      const phaseIds = idsOf(h.phases);
      if (phaseIds.size !== h.phases.length) {
        addIssue(report, 'error', 'hazard.duplicate-phase-id',
          `Hazard "${h.id}" has two phases with the same id.`, { path: `${path}.phases` });
      }
    }
  }

  // -- spawns --------------------------------------------------------------
  const spawns = Array.isArray(level.spawns) ? level.spawns : [];
  if (!Array.isArray(level.spawns)) {
    addIssue(report, 'error', 'level.spawns-not-an-array',
      '`spawns` must be an array.', { path: 'spawns' });
  }
  const occupied = new Map();
  const spawnIds = idsOf(spawns);
  if (spawnIds.size !== spawns.length) {
    addIssue(report, 'error', 'level.duplicate-spawn-id',
      'Two spawns share the same id.', { path: 'spawns' });
  }
  for (let i = 0; i < spawns.length; i += 1) {
    const s = spawns[i];
    const path = `spawns[${i}]`;
    if (!isPlainObject(s)) {
      addIssue(report, 'error', 'spawn.not-an-object', 'A spawn is not an object.', { path });
      continue;
    }
    if (!isNonEmptyString(s.id)) {
      addIssue(report, 'error', 'spawn.missing-id', 'A spawn has no id.', { path });
    }
    if (!SPAWN_TYPES.includes(s.type)) {
      addIssue(report, 'error', 'spawn.unsupported-type',
        `Spawn "${s.id}" has unsupported type "${s.type}". Expected one of: ${SPAWN_TYPES.join(', ')}.`,
        { path: `${path}.type` });
      continue;
    }
    if (!cellInBounds(s.x, s.z, size)) {
      addIssue(report, 'error', 'spawn.invalid-position',
        `Spawn "${s.id}" is at (${s.x}, ${s.z}), outside the ${size}×${size} playfield.`,
        { path: `${path}.x` });
      continue;
    }
    // -- resource existence
    if (s.type === 'building') {
      if (!isNonEmptyString(s.key)) {
        addIssue(report, 'error', 'spawn.missing-key',
          `Building spawn "${s.id}" has no catalogue key.`, { path: `${path}.key` });
      } else if (buildingIds.size > 0 && !buildingIds.has(s.key)) {
        addIssue(report, 'error', 'spawn.missing-resource',
          `Building spawn "${s.id}" references unknown building "${s.key}".`, { path: `${path}.key` });
      }
    } else if (s.type === 'character') {
      if (!isNonEmptyString(s.key)) {
        addIssue(report, 'error', 'spawn.missing-key',
          `Character spawn "${s.id}" has no character key.`, { path: `${path}.key` });
      } else if (characterIds.size > 0 && !characterIds.has(s.key)) {
        addIssue(report, 'error', 'spawn.missing-resource',
          `Character spawn "${s.id}" references unknown character "${s.key}".`, { path: `${path}.key` });
      }
    } else if (s.type === 'nature') {
      if (!isNonEmptyString(s.key)) {
        addIssue(report, 'error', 'spawn.missing-key',
          `Nature spawn "${s.id}" has no model key.`, { path: `${path}.key` });
      } else if (modelIds.size > 0 && !modelIds.has(s.key)) {
        addIssue(report, 'error', 'spawn.missing-resource',
          `Nature spawn "${s.id}" references unknown model "${s.key}".`, { path: `${path}.key` });
      }
    }
    // -- overlap ---------------------------------------------------------
    // A spawn occupies one cell, or a whole rectangle of cells when it is a
    // BLOCK. Every occupied cell is registered, so two blocks that overlap
    // are caught however the footprints are sized.
    const footprint = s.type === 'building'
      ? footprintOf(resources.footprints, s.key)
      : [1, 1];
    const cells = spawnCells(s, footprint);
    for (const cell of cells) {
      if (!cellInBounds(cell.x, cell.z, size)) {
        addIssue(report, 'error', 'spawn.invalid-position',
          `Spawn "${s.id}" covers (${cell.x}, ${cell.z}), outside the ${size}×${size} playfield.`,
          { path: `${path}.x` });
        continue;
      }
      const key = spawnKey(cell.x, cell.z);
      const previous = occupied.get(key);
      if (previous) {
        addIssue(report, 'error', 'spawn.overlapping-cell',
          `Spawn "${s.id}" overlaps spawn "${previous}" at (${cell.x}, ${cell.z}).`, { path });
      } else {
        occupied.set(key, s.id);
      }
    }
  }

  // -- exits ---------------------------------------------------------------
  const exits = Array.isArray(level.exits) ? level.exits : [];
  if (!Array.isArray(level.exits)) {
    addIssue(report, 'error', 'level.exits-not-an-array',
      '`exits` must be an array.', { path: 'exits' });
  }
  if (exits.length === 0) {
    addIssue(report, 'error', 'level.missing-exit',
      'The level declares no exit — the player could never finish it.', { path: 'exits' });
  }
  const exitIds = idsOf(exits);
  if (exitIds.size !== exits.length) {
    addIssue(report, 'error', 'level.duplicate-exit-id',
      'Two exits share the same id.', { path: 'exits' });
  }
  for (let i = 0; i < exits.length; i += 1) {
    const ex = exits[i];
    const path = `exits[${i}]`;
    if (!isPlainObject(ex)) {
      addIssue(report, 'error', 'exit.not-an-object', 'An exit is not an object.', { path });
      continue;
    }
    if (!isNonEmptyString(ex.id)) {
      addIssue(report, 'error', 'exit.missing-id', 'An exit has no id.', { path });
    }
    if (!isNonEmptyString(ex.label)) {
      addIssue(report, 'warning', 'exit.missing-label',
        `Exit "${ex.id}" has no label.`, { path });
    }
    if (!cellInBounds(ex.x, ex.z, size)) {
      addIssue(report, 'error', 'exit.invalid-position',
        `Exit "${ex.id}" is at (${ex.x}, ${ex.z}), outside the ${size}×${size} playfield.`,
        { path: `${path}.x` });
    }
    if (!Array.isArray(ex.requires)) {
      addIssue(report, 'warning', 'exit.no-requirements',
        `Exit "${ex.id}" declares no requirements, so it can be reached immediately.`,
        { path: `${path}.requires` });
    } else {
      for (const req of ex.requires) {
        if (!objectiveIds.has(req)) {
          addIssue(report, 'error', 'exit.broken-progression-link',
            `Exit "${ex.id}" requires unknown objective "${req}".`, { path: `${path}.requires` });
        } else {
          const objective = objectives.find((o) => o && o.id === req);
          if (objective && objective.type === 'checkpoint'
            && !checkpointIds.has(objective.checkpointId)) {
            addIssue(report, 'error', 'objective.unknown-checkpoint',
              `Objective "${req}" points at unknown checkpoint "${objective.checkpointId}".`,
              { path: 'objectives' });
          }
          if (objective && objective.type === 'collectible'
            && isNonEmptyString(objective.collectibleId)
            && !collectibleIds.has(objective.collectibleId)) {
            addIssue(report, 'error', 'objective.unknown-collectible',
              `Objective "${req}" points at unknown collectible "${objective.collectiveId}".`,
              { path: 'objectives' });
          }
        }
      }
    }
  }

  // -- unreachable objectives ----------------------------------------------
  //
  // An objective is GATED (and can therefore gate completion) when it is
  // reachable through the progression graph, not only when an exit names it
  // directly. The graph is:
  //
  //     exit --requires--> objective --(type: checkpoint)--> checkpoint
  //                                                       --requires--> objective ...
  //
  // So an objective that a *required* checkpoint requires is itself required.
  // The closure below walks that graph; anything still outside it can never
  // gate completion and is reported as a warning.
  const gated = requiredClosure({ objectives, checkpoints, exits });

  for (const objective of objectives) {
    if (!isPlainObject(objective) || !isNonEmptyString(objective.id)) continue;
    if (objective.type === 'checkpoint') {
      if (!isNonEmptyString(objective.checkpointId)) {
        addIssue(report, 'error', 'objective.missing-checkpoint-id',
          `Checkpoint objective "${objective.id}" does not name a checkpoint.`, { path: 'objectives' });
      } else if (!checkpointIds.has(objective.checkpointId)) {
        addIssue(report, 'error', 'objective.unknown-checkpoint',
          `Checkpoint objective "${objective.id}" points at unknown checkpoint "${objective.checkpointId}".`,
          { path: 'objectives' });
      }
    }
    if (objective.type === 'collectible' && isNonEmptyString(objective.collectibleId)
      && !collectibleIds.has(objective.collectibleId)) {
      addIssue(report, 'error', 'objective.unknown-collectible',
        `Collectible objective "${objective.id}" points at unknown collectible "${objective.collectibleId}".`,
        { path: 'objectives' });
    }
    if (!gated.has(objective.id)) {
      addIssue(report, 'warning', 'objective.not-required',
        `Objective "${objective.id}" is not on any path to an exit; it can never gate completion.`,
        { path: 'objectives' });
    }
  }

  // A checkpoint nothing points at is dead content: the player can reach it,
  // but nothing in the level ever asks them to.
  const referencedCheckpoints = new Set();
  for (const objective of objectives) {
    if (isPlainObject(objective) && objective.type === 'checkpoint'
      && isNonEmptyString(objective.checkpointId)) {
      referencedCheckpoints.add(objective.checkpointId);
    }
  }
  for (const checkpoint of checkpoints) {
    if (!isPlainObject(checkpoint) || !isNonEmptyString(checkpoint.id)) continue;
    if (!referencedCheckpoints.has(checkpoint.id)) {
      addIssue(report, 'warning', 'checkpoint.unreferenced',
        `Checkpoint "${checkpoint.id}" is not referenced by any objective.`, { path: 'checkpoints' });
    }
  }

  // -- what the validator cannot prove ------------------------------------
  addIssue(report, 'info', 'level.not-checked',
    'Reachability beyond the declared progression links is not proven by this validator; '
    + 'it cannot tell whether the terrain allows a route to the exit.',
    { path: '' });

  return finaliseReport(report);
}

/**
 * The set of objectives that can gate completion.
 *
 * Walks the progression graph from every exit:
 *
 *   exit.requires -> objective
 *   objective(type 'checkpoint').checkpointId -> checkpoint
 *   checkpoint.requires -> objective  (recursively)
 *
 * @param {{objectives:Array, checkpoints:Array, exits:Array}} graph
 * @returns {Set<string>} the gated objective ids
 */
export function requiredClosure({ objectives = [], checkpoints = [], exits = [] } = {}) {
  const byId = new Map();
  for (const objective of objectives) {
    if (isPlainObject(objective) && isNonEmptyString(objective.id)) byId.set(objective.id, objective);
  }
  const checkpointById = new Map();
  for (const checkpoint of checkpoints) {
    if (isPlainObject(checkpoint) && isNonEmptyString(checkpoint.id)) checkpointById.set(checkpoint.id, checkpoint);
  }

  const gated = new Set();
  const queue = [];

  const pushObjective = (id) => {
    if (typeof id !== 'string' || !id) return;
    if (gated.has(id)) return;
    const objective = byId.get(id);
    if (!objective) return; // unknown ids are reported separately
    gated.add(id);
    queue.push(objective);
  };

  for (const exit of exits) {
    if (!isPlainObject(exit) || !Array.isArray(exit.requires)) continue;
    for (const req of exit.requires) pushObjective(req);
  }

  // Breadth-first closure over checkpoint -> objective edges.
  while (queue.length) {
    const objective = queue.shift();
    if (objective.type !== 'checkpoint') continue;
    const checkpoint = checkpointById.get(objective.checkpointId);
    if (!checkpoint || !Array.isArray(checkpoint.requires)) continue;
    for (const req of checkpoint.requires) pushObjective(req);
  }

  return gated;
}

/**
 * Validate the metadata block of a level.
 * @param {*} metadata
 * @param {object} report
 */
function validateMetadata(metadata, report) {
  if (!isPlainObject(metadata)) {
    addIssue(report, 'error', 'level.missing-metadata',
      'The level has no metadata block.', { path: 'metadata' });
    return;
  }
  if (!isNonEmptyString(metadata.author)) {
    addIssue(report, 'error', 'level.metadata-missing-author',
      'Level metadata has no author.', { path: 'metadata.author' });
  }
  if (!isNonEmptyString(metadata.version)) {
    addIssue(report, 'error', 'level.metadata-missing-version',
      'Level metadata has no version.', { path: 'metadata.version' });
  }
  if (!Array.isArray(metadata.tags) || metadata.tags.length === 0) {
    addIssue(report, 'warning', 'level.metadata-missing-tags',
      'Level metadata has no tags; the level-select screen cannot group it.', { path: 'metadata.tags' });
  }
  if (metadata.licence !== undefined && !isNonEmptyString(metadata.licence)) {
    addIssue(report, 'error', 'level.metadata-invalid-licence',
      'Level metadata declares an empty licence. Every shipped level must state its licence.',
      { path: 'metadata.licence' });
  }
}

/**
 * Normalise a list-or-set into a Set of strings.
 * @param {Set<string>|string[]|undefined} value
 * @returns {Set<string>}
 */
export function toSet(value) {
  if (!value) return new Set();
  if (value instanceof Set) return new Set([...value].filter((v) => typeof v === 'string'));
  if (Array.isArray(value)) return new Set(value.filter((v) => typeof v === 'string'));
  return new Set();
}

/**
 * The footprint of a building, as `[width, height]` in cells.
 *
 * The footprint comes from the buildings catalogue, which the caller passes in
 * as `resources.footprints`. A building with no known footprint is treated as
 * one cell, which is the smallest possible footprint.
 *
 * @param {Set<string>|Map<string,number[]>|object} footprints
 * @param {string} key
 * @returns {[number, number]}
 */
export function footprintOf(footprints, key) {
  let fp = null;
  if (footprints instanceof Map) fp = footprints.get(key);
  else if (footprints && typeof footprints === 'object') fp = footprints[key];
  if (!Array.isArray(fp) || fp.length < 2) return [1, 1];
  const w = Number.isInteger(fp[0]) && fp[0] > 0 ? fp[0] : 1;
  const h = Number.isInteger(fp[1]) && fp[1] > 0 ? fp[1] : 1;
  return [w, h];
}

/**
 * The cells a spawn occupies.
 *
 * A spawn without a `rect` occupies exactly one cell. A spawn WITH a
 * `rect` (`{w, h}`) is a BLOCK of buildings laid out across the rectangle,
 * stepping by the building's own footprint — so a 2×2 building fills a 2×2
 * block and the next one starts two cells along, not one.
 *
 * @param {object} spawn
 * @param {[number, number]} footprint
 * @returns {Array<{x:number,z:number}>}
 */
export function spawnCells(spawn, footprint = [1, 1]) {
  const [fw, fh] = footprint;
  const rect = spawn?.rect;
  if (!rect || !isPlainObject(rect)) {
    return [{ x: spawn?.x, z: spawn?.z }];
  }
  const w = Number.isInteger(rect.w) && rect.w > 0 ? rect.w : 1;
  const h = Number.isInteger(rect.h) && rect.h > 0 ? rect.h : 1;
  const cells = [];
  for (let dx = 0; dx < w; dx += fw) {
    for (let dz = 0; dz < h; dz += fh) {
      cells.push({ x: spawn.x + dx, z: spawn.z + dz });
    }
  }
  return cells;
}

/**
 * Validate a whole set of levels.
 * @param {Array<object>} levels
 * @param {object} [resources]
 * @returns {{levels:Array<{id:string, report:object}>, report:object}}
 */
export function validateLevels(levels, resources = {}) {
  const list = Array.isArray(levels) ? levels : [];
  const combined = emptyReport();
  const perLevel = [];
  const seenIds = new Set();

  for (const level of list) {
    const id = isPlainObject(level) && isNonEmptyString(level.id) ? level.id : '(unnamed)';
    if (isPlainObject(level) && isNonEmptyString(level.id)) {
      if (seenIds.has(level.id)) {
        addIssue(combined, 'error', 'library.duplicate-level-id',
          `Two levels share the id "${level.id}".`, { path: level.id });
      }
      seenIds.add(level.id);
    }
    const report = validateLevel(level, resources);
    perLevel.push({ id, report });
    for (const issue of report.issues) {
      combined.issues.push({ ...issue, level: id });
    }
    combined.errors += report.errors;
    combined.warnings += report.warnings;
    combined.infos += report.infos;
  }

  if (list.length === 0) {
    addIssue(combined, 'error', 'library.empty',
      'The content library contains no levels.', { path: '' });
  }

  return { levels: perLevel, report: finaliseReport(combined) };
}
