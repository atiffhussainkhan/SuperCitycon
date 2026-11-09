/**
 * content/content.test.mjs — unit tests for the content domain.
 *
 * Pure-logic tests: the content modules never import `three`, so they run in
 * plain Node with no DOM and no renderer.
 *
 * Run with:  node --test src/content/content.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateLevel,
  validateLevels,
  requiredClosure,
  emptyReport,
  addIssue,
  finaliseReport,
  cellInBounds,
  toSet,
  footprintOf,
  spawnCells,
  SPAWN_TYPES,
  OBJECTIVE_TYPES,
  HAZARD_TYPES,
  DIFFICULTIES,
} from './validate.js';

import {
  LEVELS,
  LEVEL_INDEX,
  getLevel,
  listLevels,
  levelOrder,
  nextLevel,
  previousLevel,
  levelsForMode,
  levelGridSize,
  ringCells,
  blockCells,
} from './levels.js';

import { measureObjective } from './index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal, valid level used as the base for the mutation tests. */
function validLevel(overrides = {}) {
  return {
    id: 'test-level',
    name: 'Test Level',
    description: 'A level used by the tests.',
    seed: 1234,
    difficulty: 'normal',
    metadata: {
      author: 'tests',
      version: '1.0.0',
      tags: ['test'],
      licence: 'Original content.',
    },
    objectives: [
      { id: 'obj-a', label: 'Do A', type: 'buildings', target: 10 },
      { id: 'obj-cp', label: 'Reach the cp', type: 'checkpoint', target: 1, checkpointId: 'cp-1' },
    ],
    checkpoints: [
      { id: 'cp-1', label: 'Checkpoint 1', x: 10, z: 10, requires: ['obj-a'] },
    ],
    collectibles: [
      { id: 'col-1', label: 'A thing', x: 12, z: 12 },
    ],
    hazards: [
      {
        id: 'hz-1',
        label: 'A hazard',
        type: 'flood',
        x: 20,
        z: 20,
        radius: 5,
        phases: [
          { id: 'p1', name: 'Phase one', duration: 10, damagePerSecond: 1, telegraphSeconds: 3 },
          { id: 'p2', name: 'Phase two', duration: 20, damagePerSecond: 2, telegraphSeconds: 2 },
        ],
      },
    ],
    spawns: [
      { id: 'sp-1', type: 'road', x: 5, z: 5 },
      { id: 'sp-2', type: 'building', key: 'res.house', x: 6, z: 5 },
    ],
    exits: [
      { id: 'exit-1', label: 'Leave', x: 30, z: 30, requires: ['obj-cp'] },
    ],
    ...overrides,
  };
}

/** The resource sets the shipped levels are validated against. */
const RESOURCES = {
  buildings: new Set(['res.house', 'com.grocery', 'prk.park']),
  characters: new Set(['Knight', 'Mage']),
  models: new Set(['mdvl_nature_oak_01']),
  gridSize: 64,
};

/** Every error code in a report. */
function errorCodes(report) {
  return report.issues.filter((i) => i.severity === 'error').map((i) => i.code);
}

/** Every warning code in a report. */
function warningCodes(report) {
  return report.issues.filter((i) => i.severity === 'warning').map((i) => i.code);
}

// ---------------------------------------------------------------------------
// The report primitives
// ---------------------------------------------------------------------------

test('emptyReport starts clean', () => {
  const report = emptyReport();
  assert.equal(report.errors, 0);
  assert.equal(report.warnings, 0);
  assert.equal(report.infos, 0);
  assert.equal(report.ok, true);
  assert.deepEqual(report.issues, []);
});

test('addIssue counts by severity and flips ok', () => {
  const report = emptyReport();
  addIssue(report, 'warning', 'w', 'a warning');
  assert.equal(report.warnings, 1);
  assert.equal(report.ok, true);
  addIssue(report, 'error', 'e', 'an error');
  assert.equal(report.errors, 1);
  assert.equal(report.ok, false);
  addIssue(report, 'info', 'i', 'a note');
  assert.equal(report.infos, 1);
});

test('addIssue defaults an unknown severity to warning', () => {
  const report = emptyReport();
  addIssue(report, 'nonsense', 'x', 'msg');
  assert.equal(report.warnings, 1);
  assert.equal(report.errors, 0);
});

test('finaliseReport sorts the worst issues first', () => {
  const report = emptyReport();
  addIssue(report, 'info', 'z-info', 'info');
  addIssue(report, 'error', 'a-error', 'error');
  addIssue(report, 'warning', 'm-warning', 'warning');
  finaliseReport(report);
  assert.deepEqual(report.issues.map((i) => i.severity), ['error', 'warning', 'info']);
});

test('toSet normalises lists and sets', () => {
  assert.deepEqual([...toSet(['a', 'b'])], ['a', 'b']);
  assert.deepEqual([...toSet(new Set(['c']))], ['c']);
  assert.deepEqual([...toSet(undefined)], []);
  assert.deepEqual([...toSet([1, 'd', null])], ['d']);
});

test('cellInBounds accepts only integral in-range cells', () => {
  assert.equal(cellInBounds(0, 0, 64), true);
  assert.equal(cellInBounds(63, 63, 64), true);
  assert.equal(cellInBounds(64, 0, 64), false);
  assert.equal(cellInBounds(-1, 0, 64), false);
  assert.equal(cellInBounds(1.5, 2, 64), false);
});

// ---------------------------------------------------------------------------
// The vocabulary
// ---------------------------------------------------------------------------

test('the vocabulary constants are non-empty and frozen', () => {
  assert.ok(SPAWN_TYPES.length > 0);
  assert.ok(OBJECTIVE_TYPES.length > 0);
  assert.ok(HAZARD_TYPES.length > 0);
  assert.ok(DIFFICULTIES.length > 0);
  assert.equal(Object.isFrozen(SPAWN_TYPES), true);
  assert.equal(Object.isFrozen(HAZARD_TYPES), true);
});

// ---------------------------------------------------------------------------
// The shipped library
// ---------------------------------------------------------------------------

test('the library is non-empty and every id is unique', () => {
  assert.ok(LEVELS.length >= 1);
  const ids = LEVELS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('the shipped library passes validation with zero errors and zero warnings', () => {
  const { report } = validateLevels(LEVELS, {
    buildings: new Set([
      'res.house', 'res.low_rise_flats', 'res.mid_rise_flats',
      'com.grocery', 'com.market_hall', 'com.office_block',
      'prk.park', 'hea.medical_center', 'ind.freight_depot',
    ]),
    characters: new Set(['Knight', 'Mage', 'Rogue', 'Barbarian']),
    models: new Set([
      'mdvl_nature_oak_01', 'mdvl_nature_pine_01',
      'mdvl_nature_boulder_01', 'mdvl_nature_deadtree_01',
    ]),
    footprints: {
      'res.house': [1, 1],
      'res.low_rise_flats': [1, 1],
      'res.mid_rise_flats': [1, 1],
      'com.grocery': [2, 1],
      'com.market_hall': [2, 2],
      'com.office_block': [2, 2],
      'prk.park': [1, 1],
      'hea.medical_center': [2, 1],
      'ind.freight_depot': [2, 2],
    },
    gridSize: 64,
  });
  assert.equal(report.errors, 0, `errors: ${JSON.stringify(report.issues.filter((i) => i.severity === 'error'), null, 2)}`);
  assert.equal(report.warnings, 0, `warnings: ${JSON.stringify(report.issues.filter((i) => i.severity === 'warning'), null, 2)}`);
});

test('getLevel finds a level and returns null for an unknown id', () => {
  assert.equal(getLevel('first-light').id, 'first-light');
  assert.equal(getLevel('does-not-exist'), null);
  assert.equal(getLevel(''), null);
  assert.equal(getLevel(null), null);
});

test('LEVEL_INDEX mirrors the library', () => {
  assert.equal(Object.keys(LEVEL_INDEX).length, LEVELS.length);
  for (const level of LEVELS) assert.equal(LEVEL_INDEX[level.id], level);
});

test('listLevels returns a copy, not the live array', () => {
  const list = listLevels();
  assert.equal(list.length, LEVELS.length);
  list.push({ id: 'injected' });
  assert.equal(LEVELS.length, list.length - 1);
});

test('the level chain walks forward and backward', () => {
  const order = levelOrder();
  assert.equal(order[0], LEVELS[0].id);
  assert.equal(previousLevel(order[0]), null);
  assert.equal(nextLevel(order[order.length - 1]), null);
  for (let i = 0; i < order.length - 1; i += 1) {
    assert.equal(nextLevel(order[i]).id, order[i + 1]);
    assert.equal(previousLevel(order[i + 1]).id, order[i]);
  }
});

test('levelsForMode offers the whole library in every mode', () => {
  for (const mode of ['play', 'scenario', 'sandbox', 'editor']) {
    assert.equal(levelsForMode(mode).length, LEVELS.length);
  }
});

test('levelGridSize matches the playfield', () => {
  assert.equal(levelGridSize(), 64);
});

test('every shipped level declares a seed, a difficulty and metadata', () => {
  for (const level of LEVELS) {
    assert.equal(typeof level.seed, 'number');
    assert.ok(DIFFICULTIES.includes(level.difficulty));
    assert.equal(typeof level.metadata.author, 'string');
    assert.equal(typeof level.metadata.version, 'string');
    assert.ok(Array.isArray(level.metadata.tags));
  }
});

test('every shipped level has at least one exit and one objective', () => {
  for (const level of LEVELS) {
    assert.ok(level.exits.length >= 1, `${level.id} has no exit`);
    assert.ok(level.objectives.length >= 1, `${level.id} has no objective`);
  }
});

test('every shipped level that declares a hazard gives it a phase ladder', () => {
  for (const level of LEVELS) {
    for (const hazard of level.hazards) {
      assert.ok(hazard.phases.length >= 1, `${hazard.id} has no phases`);
      assert.ok(HAZARD_TYPES.includes(hazard.type));
      for (const phase of hazard.phases) {
        assert.ok(phase.duration > 0);
        assert.equal(typeof phase.id, 'string');
      }
    }
  }
});

test('the crisis level has the deepest phase ladder', () => {
  const crisis = LEVELS.find((l) => l.difficulty === 'crisis');
  assert.ok(crisis, 'no crisis level');
  const deepest = Math.max(...LEVELS.map((l) => (l.hazards[0]?.phases.length ?? 0)));
  assert.equal(crisis.hazards[0].phases.length, deepest);
  assert.ok(deepest >= 3);
});

test('every spawn cell in the shipped library is inside the playfield', () => {
  for (const level of LEVELS) {
    for (const spawn of level.spawns) {
      assert.ok(cellInBounds(spawn.x, spawn.z, 64), `${level.id}/${spawn.id} out of bounds`);
    }
  }
});

test('the road ring helper produces a closed rectangle', () => {
  const ring = ringCells(10, 10, 2);
  const keys = new Set(ring.map((c) => `${c.x},${c.z}`));
  assert.equal(keys.size, ring.length, 'the ring repeats a cell');
  assert.equal(ring.length, 16); // 2 * (2r+1) * 2 - 4
  for (const c of ring) {
    const onEdge = c.x === 8 || c.x === 12 || c.z === 8 || c.z === 12;
    assert.ok(onEdge, `${c.x},${c.z} is not on the ring edge`);
  }
});

test('the block helper produces every cell in the rectangle', () => {
  const block = blockCells(2, 3, 4, 6);
  assert.equal(block.length, 12); // 3 columns x 4 rows, inclusive
  assert.deepEqual(block.map((c) => `${c.x},${c.z}`).sort(), [
    '2,3', '2,4', '2,5', '2,6',
    '3,3', '3,4', '3,5', '3,6',
    '4,3', '4,4', '4,5', '4,6',
  ]);
});

// ---------------------------------------------------------------------------
// Footprint-aware blocks
// ---------------------------------------------------------------------------

test('footprintOf reads a Map, an object and falls back to 1x1', () => {
  assert.deepEqual(footprintOf(new Map([['a', [2, 3]]]), 'a'), [2, 3]);
  assert.deepEqual(footprintOf({ a: [4, 5] }, 'a'), [4, 5]);
  assert.deepEqual(footprintOf(new Map(), 'a'), [1, 1]);
  assert.deepEqual(footprintOf(undefined, 'a'), [1, 1]);
  assert.deepEqual(footprintOf({ a: [0, -1] }, 'a'), [1, 1]);
});

test('spawnCells returns one cell for a plain spawn', () => {
  assert.deepEqual(spawnCells({ x: 4, z: 5 }, [2, 2]), [{ x: 4, z: 5 }]);
});

test('spawnCells tiles a block by the building footprint', () => {
  // A 2x2 building in a 4x4 rectangle fills the whole thing.
  const cells = spawnCells({ x: 0, z: 0, rect: { w: 4, h: 4 } }, [2, 2]);
  assert.equal(cells.length, 4);
  assert.deepEqual(cells.map((c) => `${c.x},${c.z}`).sort(), ['0,0', '0,2', '2,0', '2,2']);
});

test('spawnCells tiles a 1x1 building across the whole rectangle', () => {
  const cells = spawnCells({ x: 0, z: 0, rect: { w: 3, h: 2 } }, [1, 1]);
  assert.equal(cells.length, 6);
});

test('a block that runs off the playfield is an error', () => {
  const report = validateLevel(validLevel({
    spawns: [{ id: 'sp', type: 'building', key: 'res.house', x: 60, z: 60, rect: { w: 8, h: 8 } }],
  }), { ...RESOURCES, footprints: { 'res.house': [1, 1] } });
  assert.ok(errorCodes(report).includes('spawn.invalid-position'));
});

test('two blocks that overlap are an error', () => {
  const report = validateLevel(validLevel({
    spawns: [
      { id: 'sp-a', type: 'building', key: 'res.house', x: 10, z: 10, rect: { w: 4, h: 4 } },
      { id: 'sp-b', type: 'building', key: 'res.house', x: 12, z: 12, rect: { w: 4, h: 4 } },
    ],
  }), { ...RESOURCES, footprints: { 'res.house': [1, 1] } });
  assert.ok(errorCodes(report).includes('spawn.overlapping-cell'));
});

test('two blocks that sit side by side do not overlap', () => {
  const report = validateLevel(validLevel({
    spawns: [
      { id: 'sp-a', type: 'building', key: 'res.house', x: 10, z: 10, rect: { w: 4, h: 4 } },
      { id: 'sp-b', type: 'building', key: 'res.house', x: 14, z: 10, rect: { w: 4, h: 4 } },
    ],
  }), { ...RESOURCES, footprints: { 'res.house': [1, 1] } });
  assert.equal(report.errors, 0, JSON.stringify(report.issues, null, 2));
});

test('the shipped library declares no overlapping spawns', () => {
  // Every shipped level is validated WITH footprints in the shipped-library
  // test above; this one asserts the blocks are actually used.
  const hasBlock = LEVELS.some((l) => (l.spawns ?? []).some((s) => s.rect));
  assert.ok(hasBlock, 'no level uses a footprint-aware block');
});

// ---------------------------------------------------------------------------
// The validator — the happy path
// ---------------------------------------------------------------------------

test('a valid level produces no errors', () => {
  const report = validateLevel(validLevel(), RESOURCES);
  assert.equal(report.errors, 0, JSON.stringify(report.issues, null, 2));
  assert.equal(report.ok, true);
});

test('the validator always states what it cannot prove', () => {
  const report = validateLevel(validLevel(), RESOURCES);
  assert.ok(report.issues.some((i) => i.code === 'level.not-checked'));
});

// ---------------------------------------------------------------------------
// The validator — missing exits
// ---------------------------------------------------------------------------

test('a level with no exits is an error', () => {
  const report = validateLevel(validLevel({ exits: [] }), RESOURCES);
  assert.ok(errorCodes(report).includes('level.missing-exit'));
});

test('exits that are not an array is an error', () => {
  const report = validateLevel(validLevel({ exits: 'nope' }), RESOURCES);
  assert.ok(errorCodes(report).includes('level.exits-not-an-array'));
});

test('an exit outside the playfield is an error', () => {
  const report = validateLevel(validLevel({
    exits: [{ id: 'e', label: 'E', x: 999, z: 0, requires: [] }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('exit.invalid-position'));
});

// ---------------------------------------------------------------------------
// The validator — invalid spawn points
// ---------------------------------------------------------------------------

test('a spawn outside the playfield is an error', () => {
  const report = validateLevel(validLevel({
    spawns: [{ id: 'sp', type: 'road', x: 200, z: 5 }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('spawn.invalid-position'));
});

test('two spawns on the same cell is an error', () => {
  const report = validateLevel(validLevel({
    spawns: [
      { id: 'sp-1', type: 'road', x: 5, z: 5 },
      { id: 'sp-2', type: 'building', key: 'res.house', x: 5, z: 5 },
    ],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('spawn.overlapping-cell'));
});

test('an unsupported spawn type is an error', () => {
  const report = validateLevel(validLevel({
    spawns: [{ id: 'sp', type: 'spaceship', x: 5, z: 5 }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('spawn.unsupported-type'));
});

test('a spawn with no key is an error', () => {
  const report = validateLevel(validLevel({
    spawns: [{ id: 'sp', type: 'building', x: 5, z: 5 }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('spawn.missing-key'));
});

// ---------------------------------------------------------------------------
// The validator — missing resources
// ---------------------------------------------------------------------------

test('a building spawn referencing an unknown catalogue id is an error', () => {
  const report = validateLevel(validLevel({
    spawns: [{ id: 'sp', type: 'building', key: 'res.does_not_exist', x: 5, z: 5 }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('spawn.missing-resource'));
});

test('a character spawn referencing an unknown character is an error', () => {
  const report = validateLevel(validLevel({
    spawns: [{ id: 'sp', type: 'character', key: 'Nobody', x: 5, z: 5 }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('spawn.missing-resource'));
});

test('a nature spawn referencing an unknown model is an error', () => {
  const report = validateLevel(validLevel({
    spawns: [{ id: 'sp', type: 'nature', key: 'not_a_model', x: 5, z: 5 }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('spawn.missing-resource'));
});

test('resource checks are skipped when no resource set is supplied', () => {
  const report = validateLevel(validLevel({
    spawns: [{ id: 'sp', type: 'building', key: 'anything_goes', x: 5, z: 5 }],
  }), { gridSize: 64 });
  assert.equal(report.errors, 0);
});

// ---------------------------------------------------------------------------
// The validator — broken progression links
// ---------------------------------------------------------------------------

test('an exit requiring an unknown objective is an error', () => {
  const report = validateLevel(validLevel({
    exits: [{ id: 'e', label: 'E', x: 5, z: 5, requires: ['obj-nope'] }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('exit.broken-progression-link'));
});

test('a checkpoint requiring an unknown objective is an error', () => {
  const report = validateLevel(validLevel({
    checkpoints: [{ id: 'cp-1', label: 'C', x: 1, z: 1, requires: ['obj-nope'] }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('checkpoint.broken-progression-link'));
});

test('a checkpoint objective pointing at an unknown checkpoint is an error', () => {
  const report = validateLevel(validLevel({
    objectives: [
      { id: 'obj-a', label: 'A', type: 'buildings', target: 1 },
      { id: 'obj-cp', label: 'C', type: 'checkpoint', target: 1, checkpointId: 'cp-ghost' },
    ],
    checkpoints: [],
    exits: [{ id: 'e', label: 'E', x: 5, z: 5, requires: ['obj-cp'] }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('objective.unknown-checkpoint'));
});

test('a collectible objective pointing at an unknown collectible is an error', () => {
  const report = validateLevel(validLevel({
    objectives: [
      { id: 'obj-a', label: 'A', type: 'collectible', target: 1, collectibleId: 'col-ghost' },
    ],
    collectibles: [],
    exits: [{ id: 'e', label: 'E', x: 5, z: 5, requires: ['obj-a'] }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('objective.unknown-collectible'));
});

// ---------------------------------------------------------------------------
// The validator — checkpoint definitions
// ---------------------------------------------------------------------------

test('a checkpoint outside the playfield is an error', () => {
  const report = validateLevel(validLevel({
    checkpoints: [{ id: 'cp-1', label: 'C', x: -1, z: 3, requires: [] }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('checkpoint.out-of-bounds'));
});

test('two checkpoints with the same id is an error', () => {
  const report = validateLevel(validLevel({
    checkpoints: [
      { id: 'cp-1', label: 'A', x: 1, z: 1, requires: [] },
      { id: 'cp-1', label: 'B', x: 2, z: 2, requires: [] },
    ],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('level.duplicate-checkpoint-id'));
});

test('a checkpoint nobody references is a warning', () => {
  const report = validateLevel(validLevel({
    checkpoints: [
      { id: 'cp-1', label: 'A', x: 1, z: 1, requires: [] },
      { id: 'cp-orphan', label: 'B', x: 2, z: 2, requires: [] },
    ],
  }), RESOURCES);
  assert.ok(warningCodes(report).includes('checkpoint.unreferenced'));
});

// ---------------------------------------------------------------------------
// The validator — unreachable objectives
// ---------------------------------------------------------------------------

test('an objective on no path to an exit is a warning', () => {
  const report = validateLevel(validLevel({
    objectives: [
      { id: 'obj-a', label: 'A', type: 'buildings', target: 1 },
      { id: 'obj-cp', label: 'C', type: 'checkpoint', target: 1, checkpointId: 'cp-1' },
      { id: 'obj-orphan', label: 'O', type: 'population', target: 1 },
    ],
  }), RESOURCES);
  assert.ok(warningCodes(report).includes('objective.not-required'));
});

test('an objective required only through a checkpoint is still gated', () => {
  // obj-a is required by cp-1, and cp-1 is reached through obj-cp, which the
  // exit requires. obj-a therefore gates completion and must NOT warn.
  const report = validateLevel(validLevel(), RESOURCES);
  assert.ok(!warningCodes(report).includes('objective.not-required'));
});

test('requiredClosure walks exit -> objective -> checkpoint -> objective', () => {
  const gated = requiredClosure({
    objectives: [
      { id: 'obj-a', type: 'buildings' },
      { id: 'obj-cp', type: 'checkpoint', checkpointId: 'cp-1' },
    ],
    checkpoints: [{ id: 'cp-1', requires: ['obj-a'] }],
    exits: [{ id: 'e', requires: ['obj-cp'] }],
  });
  assert.ok(gated.has('obj-cp'));
  assert.ok(gated.has('obj-a'));
});

test('requiredClosure ignores unknown ids without throwing', () => {
  const gated = requiredClosure({
    objectives: [{ id: 'obj-a', type: 'buildings' }],
    checkpoints: [],
    exits: [{ id: 'e', requires: ['obj-ghost'] }],
  });
  assert.equal(gated.size, 0);
});

test('requiredClosure survives a malformed graph', () => {
  const gated = requiredClosure({});
  assert.equal(gated.size, 0);
  const gated2 = requiredClosure({
    objectives: [null, { id: 'obj-a' }],
    checkpoints: [null],
    exits: [null, { id: 'e' }],
  });
  assert.equal(gated2.size, 0);
});

// ---------------------------------------------------------------------------
// The validator — hazards
// ---------------------------------------------------------------------------

test('a hazard with no phases is an error', () => {
  const report = validateLevel(validLevel({
    hazards: [{ id: 'hz', label: 'H', type: 'flood', x: 5, z: 5, radius: 3, phases: [] }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('hazard.no-phases'));
});

test('a hazard with an unknown type is an error', () => {
  const report = validateLevel(validLevel({
    hazards: [{ id: 'hz', label: 'H', type: 'meteor', x: 5, z: 5, radius: 3, phases: [{ id: 'p', name: 'P', duration: 5 }] }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('hazard.unknown-type'));
});

test('a hazard with a non-positive radius is an error', () => {
  const report = validateLevel(validLevel({
    hazards: [{ id: 'hz', label: 'H', type: 'flood', x: 5, z: 5, radius: 0, phases: [{ id: 'p', name: 'P', duration: 5 }] }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('hazard.invalid-radius'));
});

test('a hazard phase with a non-positive duration is an error', () => {
  const report = validateLevel(validLevel({
    hazards: [{ id: 'hz', label: 'H', type: 'flood', x: 5, z: 5, radius: 3, phases: [{ id: 'p', name: 'P', duration: 0 }] }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('hazard.phase-invalid-duration'));
});

test('a hazard outside the playfield is a warning, not an error', () => {
  const report = validateLevel(validLevel({
    hazards: [{ id: 'hz', label: 'H', type: 'flood', x: 500, z: 5, radius: 3, phases: [{ id: 'p', name: 'P', duration: 5 }] }],
  }), RESOURCES);
  assert.ok(warningCodes(report).includes('hazard.out-of-bounds'));
  assert.equal(report.errors, 0);
});

test('a crisis with only one phase is a warning', () => {
  const report = validateLevel(validLevel({
    hazards: [{
      id: 'hz', label: 'H', type: 'flood', x: 5, z: 5, radius: 3, crisis: true,
      phases: [{ id: 'p', name: 'P', duration: 5 }],
    }],
  }), RESOURCES);
  assert.ok(warningCodes(report).includes('hazard.crisis-single-phase'));
});

test('a crisis with a real ladder produces no warning', () => {
  const report = validateLevel(validLevel({
    hazards: [{
      id: 'hz', label: 'H', type: 'wildfire', x: 5, z: 5, radius: 3, crisis: true,
      phases: [
        { id: 'p1', name: 'One', duration: 5 },
        { id: 'p2', name: 'Two', duration: 6 },
      ],
    }],
  }), RESOURCES);
  assert.equal(report.errors, 0);
  assert.ok(!warningCodes(report).includes('hazard.crisis-single-phase'));
});

// ---------------------------------------------------------------------------
// The validator — metadata
// ---------------------------------------------------------------------------

test('a level with no metadata is an error', () => {
  const report = validateLevel(validLevel({ metadata: undefined }), RESOURCES);
  assert.ok(errorCodes(report).includes('level.missing-metadata'));
});

test('metadata without an author is an error', () => {
  const report = validateLevel(validLevel({
    metadata: { version: '1.0.0', tags: ['x'] },
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('level.metadata-missing-author'));
});

test('metadata with an empty licence is an error', () => {
  const report = validateLevel(validLevel({
    metadata: { author: 'a', version: '1', tags: ['x'], licence: '' },
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('level.metadata-invalid-licence'));
});

test('metadata without tags is a warning', () => {
  const report = validateLevel(validLevel({
    metadata: { author: 'a', version: '1' },
  }), RESOURCES);
  assert.ok(warningCodes(report).includes('level.metadata-missing-tags'));
});

// ---------------------------------------------------------------------------
// The validator — the level envelope
// ---------------------------------------------------------------------------

test('a non-object level is an error, not a throw', () => {
  for (const bad of [null, undefined, 'level', 42, []]) {
    const report = validateLevel(bad, RESOURCES);
    assert.ok(errorCodes(report).includes('level.not-an-object'));
  }
});

test('a level with no id is an error', () => {
  const report = validateLevel(validLevel({ id: undefined }), RESOURCES);
  assert.ok(errorCodes(report).includes('level.missing-id'));
});

test('a level with a non-numeric seed is an error', () => {
  const report = validateLevel(validLevel({ seed: 'abc' }), RESOURCES);
  assert.ok(errorCodes(report).includes('level.invalid-seed'));
});

test('a level with an unknown difficulty is an error', () => {
  const report = validateLevel(validLevel({ difficulty: 'nightmare' }), RESOURCES);
  assert.ok(errorCodes(report).includes('level.invalid-difficulty'));
});

test('two objectives with the same id is an error', () => {
  const report = validateLevel(validLevel({
    objectives: [
      { id: 'obj-a', label: 'A', type: 'buildings', target: 1 },
      { id: 'obj-a', label: 'B', type: 'buildings', target: 1 },
    ],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('level.duplicate-objective-id'));
});

test('an objective with a non-positive target is an error', () => {
  const report = validateLevel(validLevel({
    objectives: [{ id: 'obj-a', label: 'A', type: 'buildings', target: 0 }],
    exits: [{ id: 'e', label: 'E', x: 5, z: 5, requires: ['obj-a'] }],
  }), RESOURCES);
  assert.ok(errorCodes(report).includes('objective.invalid-target'));
});

// ---------------------------------------------------------------------------
// The library validator
// ---------------------------------------------------------------------------

test('validateLevels reports a duplicate level id', () => {
  const { report } = validateLevels([validLevel(), validLevel()], RESOURCES);
  assert.ok(errorCodes(report).includes('library.duplicate-level-id'));
});

test('validateLevels reports an empty library', () => {
  const { report } = validateLevels([], RESOURCES);
  assert.ok(errorCodes(report).includes('library.empty'));
});

test('validateLevels tags each issue with its level', () => {
  const { report } = validateLevels([validLevel({ id: 'broken', seed: 'x' })], RESOURCES);
  const issue = report.issues.find((i) => i.code === 'level.invalid-seed');
  assert.equal(issue.level, 'broken');
});

// ---------------------------------------------------------------------------
// Objective measurement
// ---------------------------------------------------------------------------

test('measureObjective reads population from the live state', () => {
  const value = measureObjective(
    { type: 'population' },
    { population: { total: 42 } },
    {},
  );
  assert.equal(value, 42);
});

test('measureObjective counts building instances', () => {
  const instances = new Map([['a', {}], ['b', {}], ['c', {}]]);
  const value = measureObjective({ type: 'buildings' }, { buildings: { instances } }, {});
  assert.equal(value, 3);
});

test('measureObjective averages service coverage', () => {
  const value = measureObjective(
    { type: 'coverage' },
    { services: { cityCoverage: { water: 0.5, power: 1 } } },
    {},
  );
  assert.equal(value, 0.75);
});

test('measureObjective survives a malformed state', () => {
  assert.equal(measureObjective({ type: 'population' }, null, {}), 0);
  assert.equal(measureObjective({ type: 'buildings' }, { buildings: {} }, {}), 0);
  assert.equal(measureObjective({ type: 'coverage' }, { services: {} }, {}), 0);
  assert.equal(measureObjective({ type: 'unknown' }, {}, {}), 0);
});

test('measureObjective calls a custom check and survives a throwing one', () => {
  assert.equal(measureObjective({ type: 'custom', check: () => 7 }, {}, {}), 7);
  assert.equal(measureObjective({ type: 'custom', check: () => { throw new Error('boom'); } }, {}, {}), 0);
});

test('measureObjective counts the progression records', () => {
  const ctx = {
    progress: {
      collectibles: () => ['a', 'b'],
      checkpoints: () => ['c'],
    },
  };
  assert.equal(measureObjective({ type: 'collectible' }, {}, ctx), 2);
  assert.equal(measureObjective({ type: 'checkpoint' }, {}, ctx), 1);
});
