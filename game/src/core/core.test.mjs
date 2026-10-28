/**
 * core.test.mjs — unit tests for the CORE domain.
 *
 * Covers the three CORE modules that are pure logic:
 *   - core/stage.js  — milestone goal evaluation, advance, progress, level table
 *   - core/save.js   — serialize/deserialize round trip (Map + typed array),
 *                      corrupt saves, storage slots, listing and deletion
 *   - core/modes.js  — mode switching, mode gates, speed / pause / day
 *
 * Run:  node --test src/core/core.test.mjs
 * (from the `game/` directory)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createState, restore, setState, snapshot, state as liveState } from './state.js';
import { TUNING, TUNING_TBD, tuningIsTbd, tuningTbd } from './config.js';
import { EVENTS, on, clearAll } from './events.js';
import {
  STAGES,
  getStage,
  currentStage,
  evaluateStage,
  advanceStage,
  stageProgress,
  allStages,
  levelForResidents,
  isUnlocked,
  unlockState,
} from './stage.js';
import {
  serialize,
  deserialize,
  saveToStorage,
  loadFromStorage,
  listSaves,
  deleteSave,
  importSave,
  exportSave,
  buildRecord,
  SAVE_KEY_PREFIX,
} from './save.js';
import {
  MODE_REGISTRY,
  startMode,
  canSwitchMode,
  availableModes,
  setSpeed,
  setPaused,
  advanceDay,
  advanceClock,
  dayIndex,
  currentSpeedName,
  clearParkedCities,
} from './modes.js';
import { SPEED } from './config.js';

// ---------------------------------------------------------------------------
// A minimal localStorage so the storage path can be exercised in Node.
// ---------------------------------------------------------------------------

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  get length() {
    return this.map.size;
  }

  key(index) {
    return Array.from(this.map.keys())[index] ?? null;
  }

  getItem(key) {
    const k = String(key);
    return this.map.has(k) ? this.map.get(k) : null;
  }

  setItem(key, value) {
    this.map.set(String(key), String(value));
  }

  removeItem(key) {
    this.map.delete(String(key));
  }

  clear() {
    this.map.clear();
  }
}

globalThis.localStorage = new MemoryStorage();

/** A city with enough data to satisfy the first milestone. */
function makeCity(seed = 4242) {
  const state = createState(seed);
  state.population.total = 40;
  state.population.happiness = 70;
  state.population.employed = 12;
  state.economy.treasury = 30000;
  state.services.cityCoverage = { electricity: 0.8, water: 0.7, waste: 0.6, health: 0.55 };
  state.services.facilities = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }];
  state.mobility.network.nodes = new Map([[10, {}], [11, {}], [12, {}], [13, {}]]);
  state.mobility.congestion = 0.2;
  state.buildings.instances = new Map([
    [1, { id: 1, type: 'residential_small', x: 1, z: 1 }],
    [2, { id: 2, type: 'factory', x: 2, z: 2 }],
  ]);
  state.world.heightmap = new Float32Array([0.5, 1.25, 2]);
  state.world.types = new Uint8Array([1, 2, 3]);
  return state;
}

function resetLive(state = makeCity()) {
  clearAll();
  clearParkedCities();
  globalThis.localStorage.clear();
  setState(state);
  return state;
}

// ---------------------------------------------------------------------------
// stage.js
// ---------------------------------------------------------------------------

test('stage: the milestone track ships at least five ordered stages', () => {
  assert.ok(STAGES.length >= 5, 'expected at least 5 stages');
  assert.equal(STAGES[0].id, 'stage-1');
  assert.equal(currentStage(makeCity()).id, 'stage-1');
  assert.equal(getStage('stage-1').id, 'stage-1');
  assert.equal(getStage('nope'), null);
});

test('stage: goal evaluation reads the live state and reports every goal', () => {
  const state = resetLive();
  const evaluation = evaluateStage(state);

  assert.equal(evaluation.stageId, 'stage-1');
  assert.equal(evaluation.goals.length, 3);
  assert.equal(evaluation.allMet, true);

  const roads = evaluation.goals.find((g) => g.id === 'first-roads');
  assert.equal(roads.current, 4);
  assert.equal(roads.target, 4);
  assert.equal(roads.met, true);
  assert.equal(roads.progress, 1);
});

test('stage: an unmet goal blocks the advance and keeps the stage index', () => {
  const state = resetLive();
  state.mobility.network.nodes = new Map(); // no roads yet

  const evaluation = evaluateStage(state);
  assert.equal(evaluation.allMet, false);
  assert.equal(evaluation.goals.find((g) => g.id === 'first-roads').met, false);

  assert.equal(advanceStage(state), false);
  assert.equal(state.meta.stageIndex, 0);
  assert.equal(state.meta.stageId, 'stage-1');
});

test('stage: advancing moves to the next stage and emits STAGE_ADVANCED', () => {
  const state = resetLive();
  const seen = [];
  const off = on(EVENTS.STAGE_ADVANCED, (payload) => seen.push(payload));

  assert.equal(advanceStage(state), true);
  off();

  assert.equal(state.meta.stageIndex, 1);
  assert.equal(state.meta.stageId, 'stage-2');
  assert.equal(currentStage(state).id, 'stage-2');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].from, 'stage-1');
  assert.equal(seen[0].to, 'stage-2');
});

test('stage: progress is the mean of the goal progresses', () => {
  const state = resetLive();
  state.mobility.network.nodes = new Map([[1, {}], [2, {}]]); // 2 of 4 roads
  state.population.total = 0;                                  // 0 of 8 residents
  state.services.cityCoverage = { electricity: 0.25 };         // 0.25 of 0.5

  const evaluation = evaluateStage(state);
  const byId = Object.fromEntries(evaluation.goals.map((g) => [g.id, g]));
  assert.equal(byId['first-roads'].progress, 0.5);     // 2 of 4 roads
  assert.equal(byId['first-residents'].progress, 0);   // 0 of 8 residents
  assert.equal(byId['first-power'].progress, 0.5);     // 0.25 of 0.5 coverage
  assert.ok(Math.abs(evaluation.progress - 1 / 3) < 1e-9); // mean of the three
  assert.ok(Math.abs(stageProgress(state) - 1 / 3) < 1e-9);
  assert.ok(stageProgress(state) >= 0 && stageProgress(state) <= 1);
});

test('stage: allStages returns every stage with its live goal evaluation', () => {
  const state = resetLive();
  const stages = allStages(state);

  assert.equal(stages.length, STAGES.length);
  assert.equal(stages[0].current, true);
  assert.equal(stages[0].met, true);
  assert.equal(stages[1].current, false);
  assert.equal(stages[1].reached, false);
  assert.ok(Array.isArray(stages[0].goals));
  assert.ok(stages[0].goals.every((g) => typeof g.progress === 'number'));
});

test('stage: the industry goal counts the BLD catalogue namespace', () => {
  const state = resetLive();
  // BLD namespaces its catalogue ids (com.*, ind.*, res.*, …).
  state.buildings.instances = new Map([
    [1, { id: 1, type: 'res.house', defId: 'res.house' }],
    [2, { id: 2, type: 'ind.cargo_yard', defId: 'ind.cargo_yard' }],
    [3, { id: 3, type: 'com.office_block', defId: 'com.office_block' }],
    [4, { id: 4, type: 'eng.wind', defId: 'eng.wind' }],
  ]);

  const industry = allStages(state).find((s) => s.id === 'stage-4');
  const goal = industry.goals.find((g) => g.id === 'industry-buildings');
  assert.equal(goal.current, 2, 'ind.* and com.* count, res.* and eng.* do not');
});

test('stage: the unlock gate reads BLD\'s catalogue shape', () => {
  const state = resetLive();
  state.population.total = 100; // level 8 in the shipped table

  // BLD's catalogue uses `unlock: { kind: 'level', level }`.
  const entry = { id: 'res.apartment', unlock: { kind: 'level', level: 5 } };
  assert.equal(unlockState(entry, state).unlocked, true);
  assert.equal(unlockState(entry, state).requiredLevel, 5);

  // The plain `requiredLevel` form still works.
  assert.equal(unlockState({ requiredLevel: 20 }, state).unlocked, false);

  // A non-level gate (a content pack) is not a level gate.
  const pack = { id: 'addon.x', unlock: { kind: 'pack', packId: 'p1' } };
  assert.equal(unlockState(pack, state).requiredLevel, 0);
});

test('stage: a progression-free mode locks nothing (NFR-CORE-003)', () => {
  const state = resetLive();
  state.population.total = 0;
  assert.equal(unlockState({ requiredLevel: 5 }, state).unlocked, false);

  state.meta.progression = false;
  const result = unlockState({ requiredLevel: 5 }, state);
  assert.equal(result.unlocked, true);
  assert.equal(result.gated, false);

  // And the milestone track has no goals in a progression-free mode.
  const evaluation = evaluateStage(state);
  assert.equal(evaluation.goals.length, 0);
  assert.equal(evaluation.allMet, true);
  assert.equal(stageProgress(state), 1);
});

test('stage: the level table is monotone in the resident count', () => {
  assert.equal(levelForResidents(0), 1);
  assert.equal(levelForResidents(11), 1);
  assert.equal(levelForResidents(12), 2);
  assert.equal(levelForResidents(500), 9);
  assert.ok(levelForResidents(10000) >= levelForResidents(1000));

  // The level is the only gate; requiredLevel 0 is available from the start.
  assert.equal(isUnlocked({ requiredLevel: 0 }, 1), true);
  assert.equal(isUnlocked({ requiredLevel: 5 }, 4), false);
  assert.equal(isUnlocked({ requiredLevel: 5 }, 5), true);
});

// ---------------------------------------------------------------------------
// save.js
// ---------------------------------------------------------------------------

test('save: a round trip survives a Map, a Set and a typed array', () => {
  const state = resetLive();
  state.studio.voxels = new Map([['1,2,3', { color: 7 }]]);
  state.buildings.zones = new Set([1, 2, 3]);

  const json = serialize(state);
  const restored = deserialize(json);

  assert.ok(restored, 'deserialize returned a state');
  assert.ok(restored.buildings.instances instanceof Map);
  assert.equal(restored.buildings.instances.size, 2);
  assert.equal(restored.buildings.instances.get(2).type, 'factory');
  assert.ok(restored.buildings.zones instanceof Set);
  assert.equal(restored.buildings.zones.size, 3);
  assert.ok(restored.world.heightmap instanceof Float32Array);
  assert.deepEqual(Array.from(restored.world.heightmap), [0.5, 1.25, 2]);
  assert.ok(restored.world.types instanceof Uint8Array);
  assert.deepEqual(Array.from(restored.world.types), [1, 2, 3]);
  assert.equal(restored.meta.seed, 4242);
});

test('save: a load keeps the identity of the live state object', () => {
  const state = resetLive();
  state.meta.day = 21;
  const identity = liveState;

  saveToStorage(state, '1');
  const loaded = loadFromStorage('1');

  assert.equal(loaded, identity, 'the live state object was restored in place');
  assert.equal(liveState.meta.day, 21);
  assert.equal(liveState.meta.seed, 4242);
});

test('save: corrupt JSON is handled without throwing', () => {
  resetLive();
  assert.equal(deserialize('{not json'), null);
  assert.equal(deserialize(''), null);
  assert.equal(deserialize('null'), null);
});

test('save: a file that is not a city is refused without touching the live state', () => {
  const state = resetLive();
  state.population.total = 33;

  assert.equal(deserialize('{}'), null, 'an empty object is not a city');
  assert.equal(deserialize('{"meta":"x"}'), null, 'meta must be an object');
  assert.equal(deserialize('{"meta":{"seed":1},"population":5}'), null, 'subtrees must be objects');
  assert.equal(liveState.population.total, 33, 'the live city was not touched');
});

test('save: a slot written by another version is listed but not loadable', () => {
  resetLive();
  globalThis.localStorage.setItem(`${SAVE_KEY_PREFIX}9`, JSON.stringify({
    version: 99,
    savedAt: '2026-01-01T00:00:00.000Z',
    name: 'From the future',
    stage: 'First Foundations',
    data: { meta: { seed: 1, day: 1 } },
  }));

  const saves = listSaves();
  assert.equal(saves.length, 1);
  assert.equal(saves[0].unsupported, true);
  assert.equal(loadFromStorage('9'), null);
});

test('save: an exported file can be imported again', () => {
  resetLive();
  // The export writes the same record the storage slots use.
  const record = JSON.parse(JSON.stringify(buildRecord(liveState, { name: 'Round Trip' })));
  assert.equal(record.version, 1);
  assert.equal(record.name, 'Round Trip');

  const imported = importSave(JSON.stringify(record));
  assert.ok(imported);
  assert.equal(imported.meta.seed, 4242);

  // A raw snapshot is still accepted.
  const raw = importSave(serialize(liveState));
  assert.ok(raw);
});

test('save: a slot survives a save / load round trip', () => {
  const state = resetLive();
  state.meta.day = 12;

  assert.equal(saveToStorage(state, '1', { name: 'Testville' }), true);
  assert.ok(globalThis.localStorage.getItem(`${SAVE_KEY_PREFIX}1`), 'the slot was written');

  const record = JSON.parse(globalThis.localStorage.getItem(`${SAVE_KEY_PREFIX}1`));
  assert.equal(record.version, 1);
  assert.equal(record.name, 'Testville');
  assert.equal(record.stage, 'First Foundations');
  assert.ok(typeof record.savedAt === 'string' && record.savedAt.length > 0);

  const loaded = loadFromStorage('1');
  assert.ok(loaded, 'loadFromStorage returned a state');
  assert.equal(loaded.meta.day, 12);
  assert.equal(loaded.meta.seed, 4242);
  assert.ok(loaded.buildings.instances instanceof Map);
});

test('save: a corrupt slot is ignored instead of thrown', () => {
  resetLive();
  globalThis.localStorage.setItem(`${SAVE_KEY_PREFIX}2`, '{ this is not json');

  assert.equal(loadFromStorage('2'), null);
  assert.equal(loadFromStorage('missing'), null);
});

test('save: listing returns the slots newest first and deletion removes them', () => {
  const state = resetLive();
  saveToStorage(state, 'alpha', { name: 'Alpha' });
  saveToStorage(state, 'beta', { name: 'Beta' });

  const saves = listSaves();
  assert.equal(saves.length, 2);
  assert.deepEqual(saves.map((s) => s.slot).sort(), ['alpha', 'beta']);
  assert.ok(saves[0].date >= saves[1].date, 'newest first');
  assert.equal(saves[0].stage, 'First Foundations');
  assert.equal(saves[0].meta.seed, 4242);

  assert.equal(deleteSave('alpha'), true);
  assert.equal(deleteSave('alpha'), false);
  assert.equal(listSaves().length, 1);
  assert.equal(listSaves()[0].slot, 'beta');
});

test('save: import throws a clear error on a bad file and returns a state on a good one', () => {
  resetLive();
  assert.throws(() => importSave('not json at all'), /import failed/);
  assert.throws(() => importSave(''), /import failed/);

  const json = serialize(makeCity());
  const imported = importSave(json);
  assert.ok(imported);
  assert.equal(imported.meta.seed, 4242);
});

test('save: export is a no-op without a DOM instead of an exception', () => {
  resetLive();
  assert.equal(exportSave(makeCity()), false);
});

// ---------------------------------------------------------------------------
// modes.js
// ---------------------------------------------------------------------------

test('modes: starting a mode sets the mode, the flags and emits MODE_CHANGED', () => {
  resetLive();
  const seen = [];
  const off = on(EVENTS.MODE_CHANGED, (payload) => seen.push(payload));

  assert.equal(startMode('play'), true);
  off();

  assert.equal(liveState.meta.mode, 'play');
  assert.equal(liveState.meta.modeFlags.economy, true);
  assert.equal(liveState.meta.progression, true);
  assert.deepEqual(liveState.meta.topBarBlocks, MODE_REGISTRY.play.topBarBlocks);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].mode, 'play');
});

test('modes: the sandbox ruleset switches economy and progression off', () => {
  resetLive();
  assert.equal(startMode('sandbox'), true);

  assert.equal(liveState.meta.mode, 'sandbox');
  assert.equal(liveState.meta.modeFlags.economy, false);
  assert.equal(liveState.meta.modeFlags.progression, false);
  assert.equal(liveState.meta.progression, false);
  assert.deepEqual(liveState.meta.topBarBlocks, ['date']);
});

test('modes: announced and unknown modes cannot be entered', () => {
  resetLive();
  assert.equal(startMode('classical-rci'), false);
  assert.equal(startMode('not-a-mode'), false);
  assert.equal(canSwitchMode('classical-rci'), false);
  assert.equal(canSwitchMode('not-a-mode'), false);
  assert.equal(liveState.meta.mode, 'play');
});

test('modes: the studio is not gated on a stage name (FR-CORE-046)', () => {
  resetLive();
  // The studio is a mode, not content behind a milestone: FR-CORE-046 forbids
  // gating content on a named city stage and §4.1 lists SCC Studio as a
  // feature of the shipped Construction Sandbox.
  assert.equal(canSwitchMode('editor'), true);
  assert.ok(availableModes().includes('editor'));

  // The in-development scenario mode is never selectable (FR-CORE-015).
  assert.ok(!availableModes().includes('scenario'));

  assert.equal(startMode('editor'), true);
  assert.equal(liveState.meta.mode, 'editor');
  assert.equal(liveState.meta.progression, false);
});

test('modes: a registry entry outside config.MODES cannot be entered', () => {
  resetLive();
  // "Sandbox Construction Mode" is registry-only (FR-CORE-016 / FR-CORE-019).
  assert.equal(MODE_REGISTRY['sandbox-construction'].status, 'shipped');
  assert.equal(MODE_REGISTRY['sandbox-construction'].selectable, false);
  assert.equal(canSwitchMode('sandbox-construction'), false);
  assert.equal(startMode('sandbox-construction'), false);
  assert.equal(liveState.meta.mode, 'play');
});

test('modes: a scenario needs objectives and keeps them', () => {
  resetLive();
  assert.equal(startMode('scenario'), false, 'no objectives, no scenario');

  const seen = [];
  const off = on(EVENTS.MODE_CHANGED, (p) => seen.push(p));
  assert.equal(startMode('scenario', { winConditions: [{ id: 'w1', label: 'Grow' }] }), true);
  off();

  assert.equal(liveState.meta.mode, 'scenario');
  assert.equal(liveState.meta.winConditions.length, 1);
  assert.equal(liveState.meta.winConditions[0].id, 'w1');
  assert.equal(seen[0].winConditions.length, 1);
});

test('modes: a parked city keeps its typed arrays when it comes back', () => {
  const state = resetLive();
  state.world.heightmap = new Float32Array([1.5, 2.5, 3.5]);

  assert.equal(startMode('sandbox'), true);
  assert.equal(startMode('play'), true);

  assert.ok(liveState.world.heightmap instanceof Float32Array, 'the heightmap is still a typed array');
  assert.deepEqual(Array.from(liveState.world.heightmap), [1.5, 2.5, 3.5]);
});

test('modes: restoring a parked city emits GAME_LOADED', () => {
  resetLive();
  const seen = [];
  const off = on(EVENTS.GAME_LOADED, (p) => seen.push(p));

  startMode('sandbox');
  startMode('play');
  off();

  assert.ok(seen.length >= 1, 'the domains are told the city was put back');
  assert.equal(seen[seen.length - 1].source, 'mode');
});

test('modes: switching parks the city so the mode stays re-enterable', () => {
  const state = resetLive();
  state.population.total = 77;

  assert.equal(startMode('sandbox'), true);
  assert.equal(liveState.meta.mode, 'sandbox');

  assert.equal(startMode('play'), true);
  assert.equal(liveState.meta.mode, 'play');
  assert.equal(liveState.population.total, 77, 'the parked city came back');
});

test('modes: re-entering the same mode keeps the city unless a fresh one is asked for', () => {
  const state = resetLive();
  state.population.total = 55;
  state.meta.day = 9;

  assert.equal(startMode('play'), true);
  assert.equal(liveState.population.total, 55, 'the same mode must not wipe the city');
  assert.equal(liveState.meta.day, 9);

  assert.equal(startMode('play', { fresh: true }), true);
  assert.equal(liveState.population.total, 0, 'a fresh city was requested');
  assert.equal(liveState.meta.day, 1);
  assert.equal(liveState.meta.stageIndex, 0);
});

test('modes: the clock advances the day on a day boundary', () => {
  resetLive();
  const dayEvents = [];
  const off = on(EVENTS.DAY_CHANGED, (p) => dayEvents.push(p));

  assert.equal(dayIndex(), 0, 'the game starts at Day Zero');

  // `DAY_LENGTH` is 60 real seconds at normal speed.
  const before = liveState.meta.day;
  advanceClock(liveState, 59);
  assert.equal(liveState.meta.day, before, 'no boundary yet');

  advanceClock(liveState, 2);
  off();

  assert.equal(liveState.meta.day, before + 1, 'the day advanced');
  assert.equal(dayIndex(), 1);
  assert.equal(dayEvents.length, 1);
  assert.equal(liveState.meta.elapsed, 61);
});

test('modes: choosing a speed resumes, and a no-op emits nothing', () => {
  resetLive();
  setSpeed('fast');
  assert.equal(liveState.meta.paused, false);

  const speedEvents = [];
  const pauseEvents = [];
  const offSpeed = on(EVENTS.SPEED_CHANGED, (p) => speedEvents.push(p));
  const offPause = on(EVENTS.PAUSE_CHANGED, (p) => pauseEvents.push(p));

  // The same speed again changes nothing and emits nothing.
  assert.equal(setSpeed('fast'), true);
  assert.equal(speedEvents.length, 0);
  assert.equal(pauseEvents.length, 0);

  // Pausing, then choosing a speed resumes the session.
  assert.equal(setPaused(true), true);
  assert.equal(pauseEvents.length, 1);
  assert.equal(liveState.meta.paused, true);

  assert.equal(setSpeed('normal'), true);
  offSpeed();
  offPause();
  assert.equal(liveState.meta.paused, false);
  assert.equal(currentSpeedName(), 'normal');
  assert.equal(speedEvents.length, 1);
});

test('modes: speed, pause and the day counter drive the clock', () => {
  resetLive();
  const speedEvents = [];
  const pauseEvents = [];
  const dayEvents = [];
  const offSpeed = on(EVENTS.SPEED_CHANGED, (p) => speedEvents.push(p));
  const offPause = on(EVENTS.PAUSE_CHANGED, (p) => pauseEvents.push(p));
  const offDay = on(EVENTS.DAY_CHANGED, (p) => dayEvents.push(p));

  assert.equal(setSpeed('fast'), true);
  assert.equal(liveState.meta.speed, SPEED.fast);
  assert.equal(currentSpeedName(), 'fast');

  assert.equal(setPaused(true), true);
  assert.equal(liveState.meta.paused, true);
  assert.equal(currentSpeedName(), 'paused');

  assert.equal(setPaused(false), true);
  assert.equal(liveState.meta.paused, false);
  assert.equal(currentSpeedName(), 'fast');

  assert.equal(setSpeed('nonsense'), false);

  const before = liveState.meta.day;
  const day = advanceDay();
  offSpeed();
  offPause();
  offDay();

  assert.equal(day, before + 1);
  assert.equal(liveState.meta.day, before + 1);
  assert.equal(speedEvents.length, 1);
  assert.equal(speedEvents[0].name, 'fast');
  assert.equal(pauseEvents.length, 2);
  assert.equal(dayEvents.length, 1);
  assert.equal(dayEvents[0].day, before + 1);
});

// ===========================================================================
// The honesty discipline: which tuning numbers are unpublished
// ===========================================================================

test('tuningTbd reports ONLY the numbers the publisher never published', () => {
  const tbd = tuningTbd();
  assert.ok(Array.isArray(tbd) && tbd.length > 0, 'there must be some unresolved numbers');

  for (const entry of tbd) {
    assert.ok(TUNING_TBD.has(entry.key),
      `${entry.key} is reported as provisional but is not in TUNING_TBD`);
    assert.equal(entry.value, TUNING[entry.key], 'the reported value is the live one');
  }

  // Every key in the set must be a real numeric tuning value.
  for (const key of TUNING_TBD) {
    assert.ok(Object.prototype.hasOwnProperty.call(TUNING, key),
      `TUNING_TBD names "${key}", which is not in TUNING`);
    assert.equal(typeof TUNING[key], 'number', `${key} must be a number`);
  }

  // The starting balance is NOT published — it must be flagged.
  assert.ok(tbd.some((e) => e.key === 'startingTreasury'),
    'the starting treasury was never published and must be flagged');
});

test('a PUBLISHED tuning value is never marked as provisional', () => {
  // `tuningTbd` used to report every numeric key, so a published value would
  // have been marked as an assumption too. It must not be.
  const published = Object.keys(TUNING).filter((k) => !TUNING_TBD.has(k));
  for (const key of published) {
    assert.ok(!tuningTbd().some((e) => e.key === key),
      `${key} carries a published number and must not be reported as provisional`);
  }
});

test('tuningIsTbd answers the same question as the list', () => {
  assert.equal(tuningIsTbd('startingTreasury'), true);
  assert.equal(tuningIsTbd('definitely-not-a-key'), false);
});

// ===========================================================================
// The typed arrays survive a snapshot/restore round trip
// ===========================================================================

test('a typed array survives snapshot -> restore without any repair', () => {
  // `core/save.js` used to repair the typed arrays AFTER `restore()`, because
  // `state.js` tested `Array.isArray(v.__typed)` while the marker is a
  // STRING. The root cause is fixed in `state.js`; this test proves it, so
  // the repair can never silently become load-bearing again.
  const src = createState(11);
  src.world.heightmap = new Float32Array([0.5, 1.25, 2]);
  src.world.types = new Uint8Array([1, 2, 3]);

  const snap = snapshot(src);
  const revived = restore(snap);

  assert.ok(revived.world.heightmap instanceof Float32Array,
    'the heightmap must come back as a Float32Array');
  assert.ok(revived.world.types instanceof Uint8Array,
    'the type map must come back as a Uint8Array');
  assert.equal(revived.world.heightmap[1], 1.25, 'and with the right values');
  assert.equal(revived.world.types[2], 3);
});
