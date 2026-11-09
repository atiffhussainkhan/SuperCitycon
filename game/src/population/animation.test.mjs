/**
 * population/animation.test.mjs — the PURE animation state machine tests.
 *
 * Run with:  node --test src/population/animation.test.mjs
 *
 * The module under test imports NOTHING from three (core/CONTRACT.md §0.5):
 * the rules of the citizen animation live here, so they can be checked in
 * Node without a GPU.
 *
 * What is proved here:
 *   1. the condition expressions parse and evaluate (negation, conjunction,
 *      disjunction, parentheses),
 *   2. the transition table is honoured and an IMPOSSIBLE transition is
 *      refused,
 *   3. `force` overrides the table,
 *   4. every edge publishes the crossfade the view layer must run,
 *   5. a character without a clip for a state falls back to `idle`,
 *   6. the hazard watch counts the hazards and degrades without a bus.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANIMATION_STATES,
  DEFAULT_FADE_SECONDS,
  STATE_CLIP_CANDIDATES,
  TRANSITIONS,
  createAnimationMachine,
  createHazardWatch,
  evaluate,
  evaluateCondition,
  nextTransition,
  parseCondition,
} from './animation.js';

// ---------------------------------------------------------------------------
// 1. The conditions
// ---------------------------------------------------------------------------

test('a plain flag is true only when the flag is set', () => {
  assert.equal(evaluateCondition('moving', { moving: true }), true);
  assert.equal(evaluateCondition('moving', { moving: false }), false);
  assert.equal(evaluateCondition('moving', {}), false, 'a missing flag is falsy');
});

test('a negated flag inverts the flag', () => {
  assert.equal(evaluateCondition('!panicked', { panicked: false }), true);
  assert.equal(evaluateCondition('!panicked', { panicked: true }), false);
});

test('a conjunction needs both sides', () => {
  const expr = '!panicked && moving';
  assert.equal(evaluateCondition(expr, { panicked: false, moving: true }), true);
  assert.equal(evaluateCondition(expr, { panicked: true, moving: true }), false);
  assert.equal(evaluateCondition(expr, { panicked: false, moving: false }), false);
});

test('a disjunction needs only one side', () => {
  const expr = 'happy || cheering';
  assert.equal(evaluateCondition(expr, { happy: true }), true);
  assert.equal(evaluateCondition(expr, { cheering: true }), true);
  assert.equal(evaluateCondition(expr, {}), false);
});

test('parentheses group the expression', () => {
  const expr = '(!panicked || moving) && fast';
  assert.equal(evaluateCondition(expr, { panicked: true, moving: true, fast: true }), true);
  assert.equal(evaluateCondition(expr, { panicked: true, moving: false, fast: true }), false);
  assert.equal(evaluateCondition(expr, { panicked: false, moving: false, fast: false }), false);
});

test('a broken condition is a syntax error, not a silent false', () => {
  assert.throws(() => parseCondition('moving &&'), SyntaxError);
  assert.throws(() => parseCondition('moving fast'), SyntaxError);
});

test('the condition cache returns the same predicate for the same text', () => {
  assert.equal(parseCondition('moving'), parseCondition('moving'));
});

// ---------------------------------------------------------------------------
// 2. The table
// ---------------------------------------------------------------------------

test('the five states are the ones the table talks about', () => {
  assert.deepEqual([...ANIMATION_STATES], ['idle', 'walk', 'run', 'cheer', 'flee']);
  for (const state of ANIMATION_STATES) {
    assert.ok(STATE_CLIP_CANDIDATES[state]?.length, `"${state}" has candidate clips`);
  }
});

test('every edge of the table names real states and a fade', () => {
  for (const edge of TRANSITIONS) {
    assert.ok(ANIMATION_STATES.includes(edge.from), `${edge.from} is a state`);
    assert.ok(ANIMATION_STATES.includes(edge.to), `${edge.to} is a state`);
    assert.ok(edge.fadeSeconds > 0, `${edge.from} -> ${edge.to} has a fade`);
    assert.ok(edge.when, `${edge.from} -> ${edge.to} has a condition`);
  }
});

test('the panic edge comes first on every state that can panic', () => {
  for (const state of ANIMATION_STATES) {
    const edges = TRANSITIONS.filter((e) => e.from === state);
    assert.ok(edges.length, `"${state}" has an outgoing edge`);
    if (state === 'flee') {
      // A citizen that is already fleeing leaves only when the danger is over.
      assert.match(edges[0].when, /!panicked/, `"${state}" leaves on the end of the hazard`);
      continue;
    }
    assert.equal(edges[0].when, 'panicked', `"${state}" checks for a hazard first`);
  }
});

test('the first matching edge of the state wins', () => {
  const edge = nextTransition('idle', { moving: true, fast: true, panicked: true });
  assert.equal(edge.to, 'flee', 'a hazard overrides the walk');
  assert.equal(nextTransition('idle', { moving: true, fast: true }).to, 'run');
  assert.equal(nextTransition('idle', { moving: true }).to, 'walk');
  assert.equal(nextTransition('idle', { happy: true, cheering: true }).to, 'cheer');
  assert.equal(nextTransition('idle', {}), null, 'nothing happens when nothing applies');
});

test('evaluate is pure: it does not touch the state it is given', () => {
  const state = 'idle';
  assert.equal(evaluate(state, { moving: true }), 'walk');
  assert.equal(state, 'idle', 'the state is untouched');
  assert.equal(evaluate(state, { panicked: true }), 'flee');
  assert.equal(evaluate(state, {}), null);
});

// ---------------------------------------------------------------------------
// 3. The machine
// ---------------------------------------------------------------------------

test('a fresh machine starts in idle', () => {
  const machine = createAnimationMachine({ clips: ['Idle', 'Walk'] });
  assert.equal(machine.state, 'idle');
});

test('a transition the table does not define is refused', () => {
  const machine = createAnimationMachine({ clips: ['Idle', 'Walk', 'Cheer'] });
  machine.transition('walk', { conditions: { moving: true } });
  assert.equal(machine.state, 'walk');

  // The table has no walk -> cheer edge: a walking citizen never starts
  // celebrating on the spot.
  const result = machine.transition('cheer', { conditions: { happy: true, cheering: true } });
  assert.equal(result.changed, false);
  assert.equal(result.from, 'walk');
  assert.equal(result.to, 'walk', 'the machine stays where it was');
  assert.equal(result.reason, 'no-transition');
  assert.equal(machine.state, 'walk');
});

test('a transition whose condition does not hold is refused', () => {
  const machine = createAnimationMachine({ clips: ['Idle', 'Walk'] });
  const result = machine.transition('walk', { conditions: { moving: false } });
  assert.equal(result.changed, false);
  assert.equal(result.to, 'idle');
  assert.equal(result.reason, 'condition');
  assert.equal(machine.state, 'idle');
});

test('a transition whose condition holds is taken', () => {
  const machine = createAnimationMachine({ clips: ['Idle', 'Walk'] });
  const result = machine.transition('walk', { conditions: { moving: true } });
  assert.equal(result.changed, true);
  assert.equal(result.from, 'idle');
  assert.equal(result.to, 'walk');
  assert.equal(result.reason, 'ok');
  assert.equal(machine.state, 'walk');
});

test('force overrides the table AND the condition', () => {
  const machine = createAnimationMachine({ clips: ['Idle', 'Walk', 'Cheer'] });
  machine.transition('walk', { conditions: { moving: true } });
  const refused = machine.transition('cheer', { conditions: { happy: true, cheering: true } });
  assert.equal(refused.changed, false);
  assert.equal(refused.reason, 'no-transition');

  const forced = machine.transition('cheer', { force: true, conditions: { happy: true } });
  assert.equal(forced.changed, true);
  assert.equal(forced.to, 'cheer');
  assert.equal(forced.reason, 'forced');
  assert.equal(machine.state, 'cheer');
});

test('every edge publishes the crossfade the view layer runs', () => {
  const clips = ['Idle', 'Walk', 'Run', 'Cheer', 'Roll'];
  const machine = () => createAnimationMachine({ clips });

  const walk = machine().transition('walk', { conditions: { moving: true } });
  assert.equal(walk.fadeSeconds, 0.25);

  const run = machine().transition('run', { conditions: { moving: true, fast: true } });
  assert.equal(run.fadeSeconds, 0.2);

  const cheer = machine().transition('cheer', { conditions: { happy: true, cheering: true } });
  assert.equal(cheer.fadeSeconds, 0.35);

  const flee = machine().transition('flee', { conditions: { panicked: true } });
  assert.equal(flee.fadeSeconds, 0.12);

  const walker = machine();
  walker.transition('walk', { conditions: { moving: true } });
  const idle = walker.transition('idle', { conditions: { moving: false } });
  assert.equal(idle.fadeSeconds, 0.3);
});

test('a forced transition without a table edge uses the default fade', () => {
  const machine = createAnimationMachine({ clips: ['Idle', 'Walk'] });
  const forced = machine.transition('walk', { force: true });
  assert.equal(forced.changed, true);
  assert.equal(forced.fadeSeconds, DEFAULT_FADE_SECONDS);
});

test('a character without a walk clip falls back to idle', () => {
  const machine = createAnimationMachine({ clips: ['Idle', 'Defeat'] });
  assert.equal(machine.clipFor('walk'), null, 'there is no walk clip');
  assert.equal(machine.resolveState('walk'), 'idle', 'the walk falls back to idle');

  const result = machine.transition('walk', { conditions: { moving: true } });
  assert.equal(result.changed, false, 'idle -> idle is not a change');
  assert.equal(result.to, 'idle');
  assert.equal(result.reason, 'fallback');
  assert.equal(machine.state, 'idle');
});

test('the machine picks the first candidate clip the character really has', () => {
  const machine = createAnimationMachine({ clips: ['Idle', 'Walking_A', 'Running_B'] });
  assert.equal(machine.clipFor('walk'), 'Walking_A');
  assert.equal(machine.clipFor('run'), 'Running_B');
  assert.equal(machine.clipFor('idle'), 'Idle');
  assert.equal(machine.clipFor('flee'), null);
});

test('the clip lookup ignores the case of the clip name', () => {
  const machine = createAnimationMachine({ clips: [{ name: 'idle' }] });
  assert.equal(machine.clipFor('idle'), 'idle');
});

test('the driver follows the situation', () => {
  const machine = createAnimationMachine({ clips: ['Idle', 'Walk', 'Run', 'Cheer', 'Roll'] });
  assert.equal(machine.evaluate({ moving: true }).to, 'walk');
  assert.equal(machine.state, 'walk');
  assert.equal(machine.evaluate({ moving: true, fast: true }).to, 'run');
  assert.equal(machine.state, 'run');
  assert.equal(machine.evaluate({ moving: false }).to, 'idle');
  assert.equal(machine.state, 'idle');
  assert.equal(machine.evaluate({ happy: true, cheering: true }).to, 'cheer');
  assert.equal(machine.state, 'cheer');
  assert.equal(machine.evaluate({ cheering: false }).to, 'idle');
  assert.equal(machine.state, 'idle');
  assert.equal(machine.evaluate({ panicked: true }).to, 'flee');
  assert.equal(machine.state, 'flee');
  assert.equal(machine.evaluate({ panicked: false }).to, 'idle');
});

test('the driver refuses to leave a state without a matching edge', () => {
  const machine = createAnimationMachine({ clips: ['Idle'] });
  const result = machine.evaluate({});
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'no-transition');
  assert.equal(machine.state, 'idle');
});

test('reset puts the machine back into a state', () => {
  const machine = createAnimationMachine({ clips: ['Idle', 'Walk'] });
  machine.transition('walk', { conditions: { moving: true } });
  assert.equal(machine.state, 'walk');
  machine.reset();
  assert.equal(machine.state, 'idle');
  assert.deepEqual(machine.conditions, {});
});

// ---------------------------------------------------------------------------
// 4. The hazards
// ---------------------------------------------------------------------------

/** A tiny event bus for the tests. */
function fakeBus() {
  const listeners = new Map();
  return {
    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
      return () => listeners.get(evt)?.delete(fn);
    },
    emit(evt, payload) {
      for (const fn of [...(listeners.get(evt) ?? [])]) fn(payload);
    },
    count(evt) {
      return listeners.get(evt)?.size ?? 0;
    },
  };
}

test('without a bus no hazard is ever active', () => {
  const watch = createHazardWatch({});
  assert.equal(watch.active(), false);
  assert.equal(watch.count(), 0);
  assert.equal(watch.near(10, 10), false);
  watch.dispose();
});

test('a bus that cannot subscribe does not break the watch', () => {
  const watch = createHazardWatch({ bus: { on() { throw new Error('nope'); } } });
  assert.equal(watch.active(), false);
  watch.dispose();
});

test('a started hazard makes the citizens panic and a resolved one calms them', () => {
  const bus = fakeBus();
  const watch = createHazardWatch({ bus });
  assert.equal(bus.count('hazard:started'), 1, 'the watch listens');
  assert.equal(bus.count('hazard:resolved'), 1, 'the watch listens');

  bus.emit('hazard:started', { id: 'h1', type: 'fire', x: 10, z: 12, radius: 3 });
  assert.equal(watch.active(), true);
  assert.equal(watch.count(), 1);
  assert.equal(watch.near(11, 12), true, 'the cell is inside the hazard');
  assert.equal(watch.near(40, 40), false, 'the far cell is not');

  bus.emit('hazard:resolved', { id: 'h1', outcome: 'contained' });
  assert.equal(watch.active(), false);
  assert.equal(watch.count(), 0);
  watch.dispose();
});

test('two hazards are counted until both are resolved', () => {
  const bus = fakeBus();
  const watch = createHazardWatch({ bus });
  bus.emit('hazard:started', { id: 'a', x: 1, z: 1, radius: 2 });
  bus.emit('hazard:started', { id: 'b', x: 30, z: 30, radius: 2 });
  assert.equal(watch.count(), 2);
  bus.emit('hazard:resolved', { id: 'a' });
  assert.equal(watch.count(), 1);
  assert.equal(watch.active(), true);
  bus.emit('hazard:resolved', { id: 'b' });
  assert.equal(watch.active(), false);
  watch.dispose();
});

test('a hazard without a position panics everybody', () => {
  const bus = fakeBus();
  const watch = createHazardWatch({ bus });
  bus.emit('hazard:started', { id: 'x' });
  assert.equal(watch.near(0, 0), true);
  assert.equal(watch.near(63, 63), true);
  watch.dispose();
});

test('a resolve without an id drops every hazard', () => {
  const bus = fakeBus();
  const watch = createHazardWatch({ bus });
  bus.emit('hazard:started', { id: 'a', x: 1, z: 1, radius: 2 });
  bus.emit('hazard:resolved', {});
  assert.equal(watch.active(), false, 'the citizens do not panic forever');
  watch.dispose();
});

test('dispose stops the listening', () => {
  const bus = fakeBus();
  const watch = createHazardWatch({ bus });
  watch.dispose();
  assert.equal(bus.count('hazard:started'), 0);
  bus.emit('hazard:started', { id: 'a', x: 1, z: 1, radius: 2 });
  assert.equal(watch.active(), false);
});
