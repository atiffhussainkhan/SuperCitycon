/**
 * hazards/hazards.test.mjs — the HAZARD unit tests.
 *
 * Run with:  node --test src/hazards/hazards.test.mjs
 *
 * The tests cover the PURE rules (`logic.js`) AND the service layer
 * (`index.js`):
 *   - the phase ladder advancing
 *   - the telegraph window (the warning before the damage)
 *   - the escalation between the phases
 *   - the early resolution (containment)
 *   - the damage computation and its distance falloff
 *   - the mitigation reducing the damage and speeding the phase up
 *   - the defensive behaviour on malformed input
 *   - the crisis escalation, its panic, its victory and its failure
 *   - the checkpoint integration (and its survival through a save/load)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENTS, on, off, once, emit } from '../core/events.js';
import { createState, snapshot, restore } from '../core/state.js';
import { serialize, deserialize } from '../core/save.js';
import { getLevel } from '../content/levels.js';
import { validateLevel } from '../content/validate.js';

import {
  HAZARD_STATUS,
  HAZARD_OUTCOME,
  HAZARD_TBD,
  createHazardState,
  phaseOf,
  isVulnerable,
  severityOf,
  advanceHazard,
  resolveEarly,
  mitigationLevel,
  mitigationServicesFor,
  effectiveDps,
  effectiveDuration,
  damageAt,
  damageForDps,
  computeDamageReport,
  telegraphWindow,
  falloff,
  isCrisisDef,
  isHazardDef,
  findDef,
  normaliseHazardTree,
  emptyHazardTree,
  cellDistance,
} from './logic.js';
import { createHazards } from './index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A three-phase flood, modelled on the shipped `hz-flood` ladder. */
const FLOOD = {
  id: 'hz-flood',
  label: 'The river breaks its banks',
  type: 'flood',
  x: 46,
  z: 48,
  radius: 14,
  phases: [
    { id: 'flood-1', name: 'Floodwater', duration: 45, damagePerSecond: 1, telegraphSeconds: 6 },
    { id: 'flood-2', name: 'Surge', duration: 60, damagePerSecond: 2, telegraphSeconds: 4 },
    { id: 'flood-3', name: 'The breach', duration: 75, damagePerSecond: 4, telegraphSeconds: 3 },
  ],
};

/** A four-phase wildfire, modelled on the shipped `hz-fire` ladder. */
const FIRE = {
  id: 'hz-fire',
  label: 'The wildfire',
  type: 'wildfire',
  x: 56,
  z: 32,
  radius: 18,
  phases: [
    { id: 'fire-1', name: 'Spot fire', duration: 50, damagePerSecond: 2, telegraphSeconds: 8 },
    { id: 'fire-2', name: 'Crown fire', duration: 60, damagePerSecond: 4, telegraphSeconds: 6 },
    { id: 'fire-3', name: 'Fire storm', duration: 70, damagePerSecond: 7, telegraphSeconds: 5 },
    { id: 'fire-4', name: 'The burnout', duration: 45, damagePerSecond: 1, telegraphSeconds: 10 },
  ],
};

/** Run a hazard forward until it stops changing, or the budget runs out. */
function run(hazardState, def, seconds, ctxLike = {}, step = 1) {
  let state = hazardState;
  const events = [];
  let elapsed = 0;
  while (elapsed < seconds) {
    const result = advanceHazard(state, step, { def, ...ctxLike });
    state = result.hazardState;
    for (const event of result.events) events.push({ ...event, at: elapsed + step });
    elapsed += step;
    if (state.status === HAZARD_STATUS.RESOLVED) break;
  }
  return { state, events, elapsed };
}

/** A context with no renderer, no assets and no siblings. */
function makeCtx(seed = 20261023) {
  const state = createState(seed);
  return {
    state,
    // The REAL event bus, so the events the service emits are the events the
    // contract defines.
    bus: { on, off, once, emit },
    config: { GRID: { size: 64 } },
    rng: () => 0.5,
    domains: {},
    assets: undefined,
    renderer: undefined,
    manifest: undefined,
  };
}

/**
 * Collect the payloads of one event while `fn` runs.
 * @param {string} evt
 * @param {Function} fn
 * @returns {Array<object>}
 */
function collect(evt, fn) {
  const seen = [];
  const handler = (payload) => seen.push(payload);
  on(evt, handler);
  try {
    fn();
  } finally {
    off(evt, handler);
  }
  return seen;
}

// ---------------------------------------------------------------------------
// 1. The hazard record
// ---------------------------------------------------------------------------

test('createHazardState builds a JSON-safe record from a definition', () => {
  const state = createHazardState(FLOOD);
  assert.equal(state.id, 'hz-flood');
  assert.equal(state.type, 'flood');
  assert.equal(state.x, 46);
  assert.equal(state.z, 48);
  assert.equal(state.radius, 14);
  assert.equal(state.status, HAZARD_STATUS.IDLE);
  assert.equal(state.phaseIndex, 0);
  assert.equal(state.damageDealt, 0);
  assert.equal(state.outcome, null);
  // It must survive a JSON round trip unchanged (the save format).
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
});

test('createHazardState refuses a malformed definition', () => {
  assert.equal(createHazardState(null), null);
  assert.equal(createHazardState({}), null);
  assert.equal(createHazardState({ id: 'x', type: 'flood' }), null);
  assert.equal(createHazardState({ id: 'x', type: 'flood', phases: [] }), null);
  assert.equal(isHazardDef(FLOOD), true);
  assert.equal(isHazardDef({ phases: [{}] }), true);
  assert.equal(isHazardDef({ phases: 'nope' }), false);
});

test('phaseOf reads the phase the hazard is in', () => {
  const state = createHazardState(FLOOD);
  assert.equal(phaseOf(state, FLOOD).id, 'flood-1');
  const later = { ...state, phaseIndex: 2 };
  assert.equal(phaseOf(later, FLOOD).id, 'flood-3');
  assert.equal(phaseOf({ ...state, phaseIndex: 99 }, FLOOD), null);
  assert.equal(phaseOf(state, null), null);
});

test('a phase is vulnerable unless it says otherwise', () => {
  const state = createHazardState(FLOOD);
  assert.equal(isVulnerable(state, FLOOD), true);
  const def = { ...FLOOD, phases: [{ ...FLOOD.phases[0], vulnerable: false }] };
  assert.equal(isVulnerable(state, def), false);
  assert.equal(isVulnerable(state, null), false);
});

test('the severity climbs with every phase of the ladder', () => {
  const state = createHazardState(FLOOD);
  const severities = FLOOD.phases.map((_, i) => severityOf({ ...state, phaseIndex: i }, FLOOD));
  assert.ok(severities[0] < severities[1], 'the second phase is more severe than the first');
  assert.ok(severities[1] < severities[2], 'the third phase is more severe than the second');
  assert.ok(severities[2] <= 1, 'the severity never leaves 0..1');
});

// ---------------------------------------------------------------------------
// 2. The telegraph window
// ---------------------------------------------------------------------------

test('the hazard announces itself before it damages anything', () => {
  const state = createHazardState(FLOOD);
  const result = advanceHazard(state, 1, { def: FLOOD });
  assert.equal(result.hazardState.status, HAZARD_STATUS.TELEGRAPH);
  const started = result.events.find((e) => e.type === 'started');
  assert.ok(started, 'the hazard announces that it started');
  assert.equal(started.id, 'hz-flood');
  assert.equal(started.hazardType, 'flood');
  assert.equal(started.radius, 14);
  const phase = result.events.find((e) => e.type === 'phase');
  assert.equal(phase.telegraphing, true);
  assert.equal(phase.phaseId, 'flood-1');
  assert.equal(result.hazardState.damageDealt, 0, 'nothing is damaged during the warning');
});

test('the telegraph window lasts exactly telegraphSeconds', () => {
  const state = createHazardState(FLOOD);
  const early = advanceHazard(state, 5, { def: FLOOD });
  assert.equal(early.hazardState.status, HAZARD_STATUS.TELEGRAPH);
  assert.equal(early.hazardState.damageDealt, 0);
  const late = advanceHazard(state, 6, { def: FLOOD });
  assert.equal(late.hazardState.status, HAZARD_STATUS.ACTIVE, 'the hazard is live after the warning');
  assert.ok(late.events.some((e) => e.type === 'phase' && e.telegraphing === false));
});

test('a phase with no telegraph warns for nothing', () => {
  const def = { ...FLOOD, phases: [{ id: 'p1', name: 'P1', duration: 10, damagePerSecond: 1, telegraphSeconds: 0 }] };
  const result = advanceHazard(createHazardState(def), 1, { def });
  assert.equal(result.hazardState.status, HAZARD_STATUS.ACTIVE);
  assert.equal(telegraphWindow(def.phases[0], 0, false), 0);
});

test('an ordinary hazard pauses between two phases, a crisis does not', () => {
  const ordinary = telegraphWindow(FLOOD.phases[1], 1, false);
  const crisis = telegraphWindow(FLOOD.phases[1], 1, true);
  assert.equal(crisis, FLOOD.phases[1].telegraphSeconds);
  assert.equal(ordinary, FLOOD.phases[1].telegraphSeconds + HAZARD_TBD.phaseGapSeconds);
});

// ---------------------------------------------------------------------------
// 3. The phase ladder
// ---------------------------------------------------------------------------

test('the ladder advances one phase at a time', () => {
  const { state } = run(createHazardState(FLOOD), FLOOD, 400);
  assert.equal(state.status, HAZARD_STATUS.RESOLVED);
  assert.equal(state.outcome, HAZARD_OUTCOME.SURVIVED);
  assert.equal(state.phaseIndex, 2, 'the hazard ended on its last phase');
});

test('every phase change is announced', () => {
  const { events } = run(createHazardState(FLOOD), FLOOD, 400);
  const phaseEvents = events.filter((e) => e.type === 'phase');
  assert.ok(phaseEvents.length >= 6, 'each phase warns and then goes live');
  const live = phaseEvents.filter((e) => e.telegraphing === false);
  assert.equal(live.length, 3, 'the three phases of the ladder went live');
  assert.deepEqual(live.map((e) => e.phaseId), ['flood-1', 'flood-2', 'flood-3']);
});

test('the damage escalates across the phases', () => {
  const rates = FLOOD.phases.map((p, i) => effectiveDps(p, i, 0, true));
  assert.ok(rates[1] > rates[0], 'the second phase hits harder than the first');
  assert.ok(rates[2] > rates[1], 'the third phase hits harder than the second');
});

test('the escalation factor is applied to the published rate', () => {
  const phase = FLOOD.phases[0];
  assert.equal(effectiveDps(phase, 0, 0, true), phase.damagePerSecond);
  assert.ok(
    Math.abs(effectiveDps(phase, 1, 0, true)
      - phase.damagePerSecond * (1 + HAZARD_TBD.escalationStep)) < 1e-9,
    'the second phase carries the escalation factor',
  );
});

test('a phase the city cannot fight ignores the mitigation relief', () => {
  const phase = { ...FLOOD.phases[0], vulnerable: false };
  assert.equal(effectiveDps(phase, 0, 0, false), phase.damagePerSecond);
  assert.equal(effectiveDps(phase, 0, 1, false), phase.damagePerSecond,
    'a phase the city cannot fight is never mitigated');
  assert.ok(effectiveDps(phase, 0, 1, true) < phase.damagePerSecond,
    'the same phase IS mitigated when it is vulnerable');
});

// ---------------------------------------------------------------------------
// 4. Damage
// ---------------------------------------------------------------------------

test('the damage falls off with the distance from the centre', () => {
  const state = { ...createHazardState(FLOOD), status: HAZARD_STATUS.ACTIVE };
  const centre = damageAt(state, FLOOD, { x: 46, z: 48 }, 0);
  const edge = damageAt(state, FLOOD, { x: 46 + 7, z: 48 }, 0);
  const outside = damageAt(state, FLOOD, { x: 46 + 30, z: 48 }, 0);
  assert.ok(centre > edge, 'the centre is hit harder than the edge');
  assert.ok(edge > 0, 'the edge of the hazard is still hit');
  assert.equal(outside, 0, 'a cell outside the hazard is never hit');
  assert.equal(falloff(0, 14), 1);
  assert.equal(falloff(14, 14), 0);
  assert.equal(falloff(7, 14), 0.5);
});

test('the damage report names the buildings it hits', () => {
  const state = { ...createHazardState(FLOOD), status: HAZARD_STATUS.ACTIVE };
  const report = damageForDps(2, state, FLOOD, {
    buildings: [{ id: 'a', x: 46, z: 48 }, { id: 'b', x: 50, z: 48 }, { id: 'c', x: 200, z: 200 }],
  }, 3);
  assert.equal(report.points, 6);
  assert.equal(report.buildings.length, 2, 'the far building is outside the radius');
  const a = report.buildings.find((b) => b.id === 'a');
  const b = report.buildings.find((b) => b.id === 'b');
  assert.ok(a.amount > b.amount, 'the building at the centre takes more');
  assert.ok(report.repairCost > 0, 'repairs cost money');
  assert.ok(report.happinessLoss > 0, 'the city loses morale');
  assert.ok(report.loyaltyLoss > 0, 'the city loses loyalty');
});

test('a malformed input never throws and never deals damage', () => {
  assert.equal(damageAt(null, FLOOD, { x: 0, z: 0 }, 0), 0);
  assert.equal(damageAt(createHazardState(FLOOD), null, { x: 0, z: 0 }, 0), 0);
  assert.equal(damageAt(createHazardState(FLOOD), FLOOD, null, 0), 0);
  assert.equal(damageAt(createHazardState(FLOOD), FLOOD, { x: NaN, z: 0 }, 0), 0);
  const report = damageForDps(NaN, createHazardState(FLOOD), FLOOD, {}, 5);
  assert.equal(report.points, 0);
  assert.equal(report.buildings.length, 0);
  const empty = computeDamageReport(null, null, {}, 5);
  assert.equal(empty.points, 0);
  assert.equal(empty.happinessLoss, 0);
});

test('a hazard that is still telegraphing deals no damage', () => {
  const state = createHazardState(FLOOD);
  assert.equal(damageAt(state, FLOOD, { x: 46, z: 48 }, 0), 0);
  const report = computeDamageReport(state, FLOOD, { buildings: [{ id: 1, x: 46, z: 48 }] }, 5);
  assert.equal(report.points, 0);
});

// ---------------------------------------------------------------------------
// 5. Mitigation
// ---------------------------------------------------------------------------

test('the mitigation services are the real service ids', () => {
  assert.deepEqual(mitigationServicesFor({ type: 'wildfire' }), ['fire']);
  assert.deepEqual(mitigationServicesFor({ type: 'outage' }), ['energy']);
  assert.deepEqual(mitigationServicesFor({ type: 'heatwave' }), ['water', 'health']);
  assert.deepEqual(mitigationServicesFor({ type: 'earthquake' }), ['police', 'health']);
  assert.deepEqual(mitigationServicesFor({ type: 'flood' }), []);
  assert.deepEqual(mitigationServicesFor({ type: 'wildfire', mitigationServices: ['water'] }), ['water']);
  assert.deepEqual(mitigationServicesFor(null), []);
});

test('the mitigation level comes from the service coverage', () => {
  const covered = {
    coverageFor: () => 1,
    cityCoverage: () => 1,
  };
  const bare = {
    coverageFor: () => 0,
    cityCoverage: () => 0,
  };
  assert.equal(mitigationLevel(FIRE, { services: covered }), 1);
  assert.equal(mitigationLevel(FIRE, { services: bare }), 0);
  assert.equal(mitigationLevel(FIRE, {}), 0, 'a missing services domain means no mitigation');
  assert.equal(mitigationLevel(FLOOD, { services: covered }), 0, 'a flood has no mitigating service');
});

test('the city-wide coverage contributes to the mitigation', () => {
  const onlyCityWide = {
    coverageFor: () => 0,
    cityCoverage: () => 1,
  };
  const level = mitigationLevel(FIRE, { services: onlyCityWide });
  assert.ok(level > 0, 'the city-wide fire coverage counts for something');
  assert.ok(level < 1, 'but it is not a full local coverage');
});

test('the mitigation reduces the damage', () => {
  const phase = FIRE.phases[0];
  const bare = effectiveDps(phase, 0, 0, true);
  const mitigated = effectiveDps(phase, 0, 1, true);
  assert.ok(mitigated < bare, 'a fully mitigated phase hits less hard');
  assert.ok(
    Math.abs(mitigated - bare * (1 - HAZARD_TBD.mitigationDamageReduction)) < 1e-9,
    'the reduction is the published fraction',
  );
});

test('the mitigation speeds the phase up', () => {
  const phase = FIRE.phases[0];
  const bare = effectiveDuration(phase, 0, true);
  const mitigated = effectiveDuration(phase, 1, true);
  assert.ok(mitigated < bare, 'a fully mitigated phase resolves faster');
  assert.equal(effectiveDuration(phase, 1, false), phase.duration,
    'a phase the city cannot fight keeps its duration');
});

test('a broken services domain cannot break the mitigation', () => {
  const broken = {
    coverageFor: () => { throw new Error('boom'); },
    cityCoverage: () => { throw new Error('boom'); },
  };
  assert.equal(mitigationLevel(FIRE, { services: broken }), 0);
  assert.equal(mitigationLevel(FIRE, { services: { coverageFor: 'not a function' } }), 0);
});

// ---------------------------------------------------------------------------
// 6. Resolution
// ---------------------------------------------------------------------------

test('a hazard resolves when its last phase ends', () => {
  const { state, events } = run(createHazardState(FLOOD), FLOOD, 1000);
  assert.equal(state.status, HAZARD_STATUS.RESOLVED);
  assert.equal(state.outcome, HAZARD_OUTCOME.SURVIVED);
  const resolved = events.find((e) => e.type === 'resolved');
  assert.ok(resolved, 'the resolution is announced');
  assert.equal(resolved.outcome, HAZARD_OUTCOME.SURVIVED);
});

test('a hazard can be resolved early', () => {
  const resolved = resolveEarly(createHazardState(FLOOD), 'the fire brigade got there');
  assert.equal(resolved.status, HAZARD_STATUS.RESOLVED);
  assert.equal(resolved.outcome, HAZARD_OUTCOME.CONTAINED);
  assert.equal(resolved.reason, 'the fire brigade got there');
});

test('a resolved hazard stays resolved', () => {
  const resolved = resolveEarly(createHazardState(FLOOD));
  const again = resolveEarly(resolved, 'too late');
  assert.equal(again.outcome, HAZARD_OUTCOME.CONTAINED);
  const result = advanceHazard(resolved, 5, { def: FLOOD });
  assert.equal(result.events.length, 0, 'a resolved hazard emits nothing');
});

test('a well-mitigated hazard is contained before the ladder burns out', () => {
  const { state, events } = run(createHazardState(FIRE), FIRE, 1000, { mitigation: 1 });
  assert.equal(state.status, HAZARD_STATUS.RESOLVED);
  assert.equal(state.outcome, HAZARD_OUTCOME.CONTAINED);
  const resolved = events.find((e) => e.type === 'resolved');
  assert.equal(resolved.outcome, HAZARD_OUTCOME.CONTAINED);
});

test('an unmitigated hazard is never contained', () => {
  // A wildfire that is NOT the crisis map's hazard: the crisis has its own
  // panic failure condition, which is tested further down.
  const wildfire = { ...FIRE, id: 'hz-wildfire-plain' };
  const { state } = run(createHazardState(wildfire), wildfire, 1000, { mitigation: 0 });
  assert.notEqual(state.outcome, HAZARD_OUTCOME.CONTAINED);
  assert.equal(state.outcome, HAZARD_OUTCOME.SURVIVED);
});

test('advanceHazard survives a malformed definition or a NaN delta', () => {
  const result = advanceHazard(createHazardState(FLOOD), NaN, { def: null });
  assert.equal(result.events.length, 0);
  const again = advanceHazard(createHazardState(FLOOD), 10, { def: { phases: [] } });
  assert.equal(again.events.length, 0);
  const none = advanceHazard(null, 10, { def: FLOOD });
  assert.equal(none.hazardState, null);
  assert.equal(none.events.length, 0);
});

// ---------------------------------------------------------------------------
// 7. The crisis (the boss encounter)
// ---------------------------------------------------------------------------

test('the shipped wildfire is the crisis encounter', () => {
  assert.equal(isCrisisDef(FIRE), true, 'hz-fire is the crisis');
  assert.equal(isCrisisDef(FLOOD), false);
  assert.equal(isCrisisDef({ ...FIRE, id: 'hz-other' }), false);
  assert.equal(isCrisisDef({ ...FIRE, id: 'hz-other', crisis: true }), true);
  assert.equal(createHazardState(FIRE).crisis, true);
  assert.equal(createHazardState(FLOOD).crisis, false);
});

test('a crisis runs its phases back to back', () => {
  const crisis = { ...FIRE, id: 'hz-crisis-test', crisis: true };
  const ordinary = { ...FIRE, id: 'hz-ordinary-test' };
  // The same mitigation on both, so the only difference is the lull between
  // the phases (a mitigation of 0.5 keeps the crisis alive but is not enough
  // to contain it).
  const crisisRun = run(createHazardState(crisis), crisis, 1000, { mitigation: 0.5 });
  const ordinaryRun = run(createHazardState(ordinary), ordinary, 1000, { mitigation: 0.5 });
  const gaps = ordinary.phases.length - 1;
  assert.equal(
    ordinaryRun.elapsed - crisisRun.elapsed,
    gaps * HAZARD_TBD.phaseGapSeconds,
    'the only difference is the lull between the phases',
  );
});

test('a crisis builds a city-wide panic', () => {
  const crisis = { ...FIRE, id: 'hz-crisis-test', crisis: true };
  const { state } = run(createHazardState(crisis), crisis, 60);
  assert.ok(state.panic > 0, 'the city is panicking');
  assert.ok(state.panic <= 1);
});

test('the panic is slowed by the mitigation and by a held checkpoint', () => {
  const crisis = { ...FIRE, id: 'hz-crisis-test', crisis: true };
  const bare = run(createHazardState(crisis), crisis, 30).state.panic;
  const mitigated = run(createHazardState(crisis), crisis, 30, { mitigation: 1 }).state.panic;
  const held = run(createHazardState(crisis), crisis, 30, { heldCheckpoints: 1 }).state.panic;
  const heldList = run(createHazardState(crisis), crisis, 30, { heldCheckpoints: ['cp-a', 'cp-b'] }).state.panic;
  assert.ok(mitigated < bare, 'the mitigation slows the panic');
  assert.ok(held < bare, 'a held checkpoint slows the panic');
  assert.ok(heldList < bare, 'a held checkpoint list slows the panic too');
  assert.ok(heldList > 0, 'and it is still a number, not NaN');
});

test('the crisis has a failure condition', () => {
  const crisis = { ...FIRE, id: 'hz-crisis-test', crisis: true };
  const { state, events } = run(createHazardState(crisis), crisis, 4000, { mitigation: 0 });
  assert.equal(state.status, HAZARD_STATUS.RESOLVED);
  assert.equal(state.outcome, HAZARD_OUTCOME.FAILED, 'the panic won');
  const resolved = events.find((e) => e.type === 'resolved');
  assert.equal(resolved.outcome, HAZARD_OUTCOME.FAILED);
});

test('the crisis has a victory condition', () => {
  const crisis = { ...FIRE, id: 'hz-crisis-test', crisis: true };
  const { state } = run(createHazardState(crisis), crisis, 4000, { mitigation: 1 });
  assert.equal(state.status, HAZARD_STATUS.RESOLVED);
  assert.notEqual(state.outcome, HAZARD_OUTCOME.FAILED, 'the city held the crisis');
});

// ---------------------------------------------------------------------------
// 8. The state subtree
// ---------------------------------------------------------------------------

test('the hazard tree is repaired when it comes back from a save', () => {
  const repaired = normaliseHazardTree({ hazards: 'nope', records: [null], checkpoints: ['a', 7] });
  assert.deepEqual(repaired.hazards, []);
  assert.deepEqual(repaired.records, []);
  assert.deepEqual(repaired.checkpoints, ['a']);
  assert.equal(repaired.panic, 0);
  const fresh = normaliseHazardTree(null);
  assert.deepEqual(fresh, emptyHazardTree());
});

test('findDef looks a definition up by id', () => {
  assert.equal(findDef([FLOOD, FIRE], 'hz-fire'), FIRE);
  assert.equal(findDef([FLOOD], 'hz-nope'), null);
  assert.equal(findDef(null, 'hz-fire'), null);
});

// ---------------------------------------------------------------------------
// 9. The service layer
// ---------------------------------------------------------------------------

test('the service installs the level definitions and starts nothing', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FLOOD, FIRE]);
  assert.equal(svc.active().length, 2);
  assert.equal(svc.state().defs.length, 2);
  assert.equal(svc.resolved().length, 0);
  svc.dispose();
});

test('the service announces the hazard and its phases', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  const started = [];
  const phases = [];
  on(EVENTS.HAZARD_STARTED, (p) => started.push(p));
  on(EVENTS.HAZARD_PHASE, (p) => phases.push(p));
  try {
    svc.load([FLOOD]);
    svc.tick(1);
    svc.tick(6);
    assert.equal(started.length, 1);
    assert.equal(started[0].id, 'hz-flood');
    assert.equal(started[0].type, 'flood');
    assert.equal(started[0].radius, 14);
    assert.ok(phases.length >= 2, 'the warning and the live phase are both announced');
    assert.equal(phases[0].telegraphing, true);
    assert.equal(phases[1].telegraphing, false);
  } finally {
    svc.dispose();
  }
});

test('the service resolves a hazard and records it', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  const resolved = [];
  on(EVENTS.HAZARD_RESOLVED, (p) => resolved.push(p));
  try {
    svc.load([FLOOD]);
    for (let i = 0; i < 500; i += 1) svc.tick(1);
    assert.equal(svc.resolved().length, 1);
    assert.equal(svc.resolved()[0].outcome, HAZARD_OUTCOME.SURVIVED);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].id, 'hz-flood');
    assert.equal(svc.active().length, 0);
  } finally {
    svc.dispose();
  }
});

test('the service can resolve a hazard early', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  svc.tick(1);
  assert.equal(svc.resolveEarly('hz-flood', 'the levee held'), true);
  assert.equal(svc.resolved().length, 1);
  assert.equal(svc.resolved()[0].outcome, HAZARD_OUTCOME.CONTAINED);
  assert.equal(svc.resolveEarly('hz-flood'), false, 'a resolved hazard cannot be resolved twice');
  assert.equal(svc.resolveEarly('hz-nope'), false);
  svc.dispose();
});

test('the service survives a missing world', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  assert.doesNotThrow(() => {
    svc.tick(10);
    svc.update(10);
    svc.damage('hz-flood');
    svc.mitigationFor('hz-flood');
    svc.phaseOf('hz-flood');
    svc.crisis();
  });
  svc.dispose();
});

test('the service survives a paused game (a zero tick)', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  svc.tick(0);
  svc.tick(NaN);
  assert.equal(svc.active()[0].status, HAZARD_STATUS.IDLE, 'nothing moved');
  svc.dispose();
});

test('a hazard whose definition vanishes is retired, not left running blind', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  svc.tick(1);
  // The level changed under the domain's feet.
  svc.state().defs = [];
  const resolved = collect(EVENTS.HAZARD_RESOLVED, () => svc.tick(1));
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].outcome, HAZARD_OUTCOME.FAILED);
  assert.equal(svc.active().length, 0);
  svc.dispose();
});

test('the service applies the mitigation from the services domain', () => {
  const ctx = makeCtx();
  ctx.domains.services = { coverageFor: () => 1, cityCoverage: () => 1 };
  const svc = createHazards(ctx);
  svc.load([FIRE]);
  assert.equal(svc.mitigationFor('hz-fire'), 1);
  ctx.domains.services = { coverageFor: () => 0, cityCoverage: () => 0 };
  assert.equal(svc.mitigationFor('hz-fire'), 0);
  assert.equal(svc.mitigationFor('hz-nope'), 0);
  svc.dispose();
});

test('the service damages the buildings it reaches', () => {
  const ctx = makeCtx();
  const removed = [];
  ctx.domains.buildings = {
    instances: () => [{ id: 7, x: 46, z: 48 }],
    remove: (x, z) => { removed.push({ x, z }); return { ok: true, reason: null }; },
  };
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  for (let i = 0; i < 400; i += 1) svc.tick(1);
  const report = svc.damage('hz-flood');
  assert.ok(report, 'the hazard has a damage report');
  assert.ok(report.damageDealt > 0, 'the hazard dealt damage');
  assert.ok(removed.length >= 1, 'the building at the centre was destroyed');
  assert.equal(removed[0].x, 46);
  svc.dispose();
});

test('the service spends money on the repairs', () => {
  const ctx = makeCtx();
  const spent = [];
  ctx.domains.economy = {
    treasury: () => 10000,
    spend: (amount, reason) => { spent.push({ amount, reason }); return { ok: true, reason: null }; },
  };
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  for (let i = 0; i < 20; i += 1) svc.tick(1);
  assert.ok(spent.length >= 1, 'the repairs were paid for');
  assert.equal(spent[0].reason, 'hazard-repair');
  assert.ok(spent[0].amount > 0);
  assert.ok(svc.state().repairs.coins > 0, 'the cost is recorded in the save tree');
  svc.dispose();
});

test('a repair the city cannot afford becomes an unpaid debt', () => {
  const ctx = makeCtx();
  const spent = [];
  ctx.domains.economy = {
    treasury: () => 0,
    spend: (amount, reason) => { spent.push({ amount, reason }); return { ok: false, reason: 'insufficient-funds' }; },
  };
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  for (let i = 0; i < 20; i += 1) svc.tick(1);
  assert.ok(svc.state().repairs.unpaid > 0, 'the unpaid part is recorded');
  assert.equal(svc.state().repairs.coins, 0, 'nothing was paid');
  assert.equal(spent.length, 0, 'the economy was never overdrawn');
  svc.dispose();
});

test('the service records the morale loss when the population cannot be hit', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  for (let i = 0; i < 20; i += 1) svc.tick(1);
  assert.ok(svc.state().morale.happiness > 0, 'the morale loss is recorded');
  svc.dispose();
});

test('the service hands the morale loss to the population when it can', () => {
  const ctx = makeCtx();
  const hits = [];
  ctx.domains.population = { applyMorale: (loss) => { hits.push(loss); } };
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  for (let i = 0; i < 20; i += 1) svc.tick(1);
  assert.equal(hits.length >= 1, true, 'the population took the hit');
  assert.ok(hits[0].happiness > 0);
  svc.dispose();
});

test('the service announces the damage with the contract payload', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  const damages = collect(EVENTS.HAZARD_DAMAGE, () => {
    for (let i = 0; i < 30; i += 1) svc.tick(1);
  });
  assert.ok(damages.length >= 1, 'the damage was announced');
  const payload = damages[0];
  assert.equal(payload.id, 'hz-flood');
  assert.equal(typeof payload.amount, 'number');
  assert.equal(typeof payload.target, 'string');
  assert.ok(['building', 'morale', 'treasury', 'aggregate'].includes(payload.kind));
  svc.dispose();
});

test('the service uses the renderer effect service and nothing else', () => {
  const ctx = makeCtx();
  const spawned = [];
  ctx.renderer = {
    fx: {
      reducedMotion: false,
      spawn: (kind, opts) => { spawned.push({ kind, opts }); return true; },
    },
  };
  const svc = createHazards(ctx);
  svc.load([FLOOD, FIRE]);
  svc.tick(1);
  svc.update(5);
  assert.ok(spawned.length >= 1, 'the effect service was used');
  const kinds = new Set(spawned.map((s) => s.kind));
  assert.ok(kinds.has('warning') || kinds.has('hazard-water') || kinds.has('hazard-fire'),
    `only the contract effect kinds are used, saw ${[...kinds].join(',')}`);
  svc.dispose();
});

test('the service respects the reduced motion preset', () => {
  const ctx = makeCtx();
  const spawned = [];
  ctx.renderer = {
    fx: {
      reducedMotion: true,
      spawn: (kind) => { spawned.push(kind); return true; },
    },
  };
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  svc.tick(1);
  svc.update(5);
  assert.equal(spawned.length, 0, 'no effect is spawned under reduced motion');
  svc.dispose();
});

test('the hazard effect is placed on the TERRAIN, not at world y = 0', () => {
  const ctx = makeCtx();
  const spawned = [];
  // The world answers with a plateau 9 units above the base plane.
  ctx.domains = { wld: { heightAt: () => 9 } };
  ctx.renderer = {
    fx: {
      reducedMotion: false,
      spawn: (kind, opts) => { spawned.push({ kind, opts }); return true; },
    },
  };
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  svc.tick(1);
  svc.update(5);
  assert.ok(spawned.length >= 1, 'an effect was spawned');
  for (const s of spawned) {
    const y = s.opts?.position?.y;
    assert.ok(Number.isFinite(y), `the effect has a finite height (y=${y})`);
    assert.ok(y > 5, `the effect is ON the ground, not underground (y=${y}, kind=${s.kind})`);
  }
  svc.dispose();
});

test('a world without a heightmap never breaks the hazard effect', () => {
  const ctx = makeCtx();
  const spawned = [];
  ctx.domains = { wld: { heightAt: () => NaN } };
  ctx.renderer = {
    fx: {
      reducedMotion: false,
      spawn: (kind, opts) => { spawned.push({ kind, opts }); return true; },
    },
  };
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  svc.tick(1);
  svc.update(5);
  assert.ok(spawned.length >= 1, 'the effect was still spawned');
  for (const s of spawned) {
    assert.ok(Number.isFinite(s.opts?.position?.y), 'the height is a finite number');
  }
  svc.dispose();
});

// ---------------------------------------------------------------------------
// 10. The checkpoint integration
// ---------------------------------------------------------------------------

test('the city can hold a checkpoint during a crisis', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FIRE]);
  assert.equal(svc.holdCheckpoint('cp-north-gate'), true);
  assert.equal(svc.holdCheckpoint('cp-north-gate'), false, 'a checkpoint is held once');
  assert.deepEqual(svc.checkpoints(), ['cp-north-gate']);
  svc.dispose();
});

test('the checkpoint reaches the progression record', () => {
  const ctx = makeCtx();
  const reached = [];
  ctx.progress = { reachCheckpoint: (id, details) => { reached.push({ id, details }); return true; } };
  const svc = createHazards(ctx);
  svc.load([FIRE]);
  svc.holdCheckpoint('cp-north-gate');
  assert.equal(reached.length, 1);
  assert.equal(reached[0].id, 'cp-north-gate');
  svc.dispose();
});

test('a checkpoint reached during a crisis is held automatically', async () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  await svc.init();
  svc.load([FIRE]);
  svc.tick(1);
  assert.equal(svc.crisis().active, true);
  emit(EVENTS.CHECKPOINT_REACHED, { id: 'cp-mid-market' });
  assert.deepEqual(svc.checkpoints(), ['cp-mid-market']);
  svc.dispose();
  // After the teardown the domain stops listening.
  emit(EVENTS.CHECKPOINT_REACHED, { id: 'cp-after-dispose' });
  assert.deepEqual(svc.checkpoints(), ['cp-mid-market']);
});

test('the hazard state survives the real save codec', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FIRE]);
  svc.tick(10);
  svc.holdCheckpoint('cp-north-gate');
  const json = serialize(ctx.state);
  const revived = deserialize(json);
  assert.ok(revived, 'the save came back');
  assert.ok(revived.hazards, 'the hazard subtree came back with it');
  assert.equal(revived.hazards.hazards.length, 1);
  assert.equal(revived.hazards.hazards[0].id, 'hz-fire');
  assert.equal(revived.hazards.hazards[0].status, 'active');
  assert.deepEqual(revived.hazards.checkpoints, ['cp-north-gate']);
  assert.equal(revived.hazards.defs.length, 1);
  assert.equal(revived.hazards.defs[0].phases.length, 4);
  svc.dispose();
});

test('the checkpoint state survives a save and a load', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FIRE]);
  svc.tick(1);
  svc.holdCheckpoint('cp-north-gate');
  const saved = JSON.stringify(snapshot(ctx.state));
  const restored = JSON.parse(saved);
  assert.ok(restored.hazards, 'the hazard subtree travels with the save');
  assert.deepEqual(restored.hazards.checkpoints, ['cp-north-gate']);
  assert.equal(restored.hazards.hazards.length, 1);
  assert.equal(restored.hazards.hazards[0].status, 'telegraph');
  assert.equal(restored.hazards.hazards[0].phaseIndex, 0);
  assert.ok(Array.isArray(restored.hazards.defs), 'the definitions travel too');
  svc.dispose();
});

test('the crisis state reports the victory and the failure conditions', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FIRE]);
  svc.tick(1);
  const state = svc.crisis();
  assert.equal(state.active, true);
  assert.equal(state.failure, false);
  assert.equal(state.victory, false);
  assert.equal(state.checkpoints, 0);
  svc.holdCheckpoint('cp-north-gate');
  assert.equal(svc.crisis().checkpoints, 1);
  svc.dispose();
});

test('the hazard state itself round-trips through the state helpers', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FIRE]);
  svc.tick(10);
  const tree = snapshot(ctx.state);
  const revived = restore(tree);
  assert.ok(revived.hazards, 'the restored tree has the hazard subtree');
  assert.equal(revived.hazards.hazards.length, 1);
  assert.equal(typeof revived.hazards.hazards[0].elapsed, 'number');
  svc.dispose();
});

test('the service can be disposed twice', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  svc.dispose();
  assert.doesNotThrow(() => svc.dispose());
  assert.doesNotThrow(() => svc.tick(10));
});

test('the cell distance helper measures cells', () => {
  assert.equal(cellDistance(0, 0, 3, 4), 5);
  assert.equal(cellDistance(10, 10, 10, 10), 0);
});

// ---------------------------------------------------------------------------
// 11. The live state (a save/load replaces the sub-tree)
// ---------------------------------------------------------------------------

test('the domain follows the live tree when it is replaced', () => {
  let live = createState(20261023);
  const ctx = {
    bus: { on, off, once, emit },
    config: { GRID: { size: 64 } },
    rng: () => 0.5,
    domains: {},
  };
  Object.defineProperty(ctx, 'state', {
    get: () => live,
    configurable: true,
  });
  const svc = createHazards(ctx);
  svc.load([FLOOD]);
  svc.tick(10);
  assert.equal(svc.active().length, 1);

  // A save/load REPLACES the tree: the domain must pick the new one up.
  live = restore(snapshot(live));
  assert.equal(svc.active().length, 1, 'the hazard survived the tree swap');
  assert.equal(svc.state().hazards[0].id, 'hz-flood');
  svc.dispose();
});

// ---------------------------------------------------------------------------
// 12. The shipped level content
// ---------------------------------------------------------------------------

test('the shipped level hazards load and run', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  const level = getLevel('the-long-night');
  assert.ok(level, 'the crisis level exists');
  svc.load(level.hazards);
  assert.equal(svc.active().length, 1);
  assert.equal(svc.active()[0].crisis, true, 'the shipped wildfire IS the crisis');
  assert.equal(svc.crisis().active, true);
  svc.tick(1);
  assert.equal(svc.active()[0].status, HAZARD_STATUS.TELEGRAPH, 'it warns before it burns');
  svc.dispose();
});

test('the shipped flood hazard runs its three phases', () => {
  const ctx = makeCtx();
  const svc = createHazards(ctx);
  const level = getLevel('high-water');
  assert.ok(level, 'the flood level exists');
  svc.load(level.hazards);
  for (let i = 0; i < 500; i += 1) svc.tick(1);
  assert.equal(svc.resolved().length, 1);
  assert.equal(svc.resolved()[0].id, 'hz-flood');
  assert.equal(svc.resolved()[0].outcome, HAZARD_OUTCOME.SURVIVED);
  svc.dispose();
});

test('the shipped hazard definitions satisfy the content validator', () => {
  const report = validateLevel(getLevel('the-long-night'), { gridSize: 64 });
  const hazardIssues = report.issues.filter((i) => i.path.startsWith('hazards'));
  assert.deepEqual(hazardIssues, [], 'the shipped hazards are valid');
});
