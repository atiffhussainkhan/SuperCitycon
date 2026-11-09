import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/core/state.js';
import { GRID, TUNING } from '../src/core/config.js';
import { EVENTS } from '../src/core/events.js';
import { BUILDING_DEFS, getDefinition } from '../src/buildings/catalogue.js';
import { ensureState, canPlace, placeInstance } from '../src/buildings/placement.js';
import { createEconomy } from '../src/economy/index.js';

function createBus() {
  const listeners = new Map();
  return {
    on(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
      return () => listeners.get(name)?.delete(listener);
    },
    emit(name, event) {
      for (const listener of listeners.get(name) ?? []) listener(event);
    },
  };
}

test('the real Citycon Building unlocks the real two-slot monorail', () => {
  const state = createState(1234);
  const cells = GRID.size * GRID.size;
  state.world.heightmap = new Float32Array(cells);
  state.world.water = new Float32Array(cells);
  state.world.types = new Uint8Array(cells);
  ensureState(state);
  const bus = createBus();
  const ctx = {
    state, bus, config: { GRID, TUNING },
    domains: { buildings: { catalogue: () => BUILDING_DEFS, instances: state.buildings.instances } },
  };
  const economy = createEconomy(ctx);
  let now = 0;
  economy.setClock(() => now);
  economy.init();
  try {
    const landmark = getDefinition('spl.citycon_building');
    const monorail = getDefinition('trn.monorail_station');
    assert.equal(landmark.grantsConstructionSlot, true);
    assert.equal(landmark.constructionSlots, 1);
    assert.equal(monorail.constructionSlots, 2);
    assert.equal(economy.constructionSlots().total, 1);
    assert.equal(economy.canPlace(monorail).reason, 'not-enough-slots');
    assert.equal(canPlace(state, monorail, 20, 20).ok, false);

    const landmarkGate = economy.canPlace(landmark);
    assert.equal(landmarkGate.ok, true, 'the slot-granting building itself needs only the starting slot');
    const placedLandmark = placeInstance(state, landmark, 10, 10);
    assert.equal(placedLandmark.ok, true);
    const event = {
      id: placedLandmark.instance.id, type: landmark.id, x: 10, z: 10,
      level: 1, cost: landmarkGate.cost,
    };
    bus.emit(EVENTS.BUILDING_PLACED, event);
    bus.emit(EVENTS.BUILDING_PLACED, event);
    assert.equal(economy.constructionSlots().total, 2, 'duplicate events do not grant extra slots');
    assert.equal(state.buildings.constructionSlots, 2, 'both placement and economy ledgers gain the slot');

    now += state.economy.constructions.get(event.id).durationMs + 1;
    economy.update(0);
    assert.equal(economy.constructionSlots().free, 2, 'the completed landmark leaves two slots free');
    const monorailGate = economy.canPlace(monorail);
    assert.equal(monorailGate.ok, true, 'the existing catalogue progression makes the monorail affordable and buildable');
    const placedMonorail = placeInstance(state, monorail, 20, 20);
    assert.equal(placedMonorail.ok, true);
    bus.emit(EVENTS.BUILDING_PLACED, {
      id: placedMonorail.instance.id, type: monorail.id, x: 20, z: 20,
      level: 1, cost: monorailGate.cost,
    });
    assert.equal(economy.constructionSlots().used, 2, 'the monorail reserves its two slots while under construction');
  } finally {
    economy.dispose();
  }
});
