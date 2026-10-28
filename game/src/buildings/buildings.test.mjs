/**
 * buildings/buildings.test.mjs — BLD domain unit tests.
 *
 *   node --test src/buildings/buildings.test.mjs
 *
 * These cover the three PURE modules (catalogue.js, properties.js,
 * placement.js) plus the service factory (index.js) driven with a stub
 * context - no browser, no WebGL, no dev server.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BUILDING_DEFS, CATEGORIES, MODEL_KEYS, getDefinition, definitionsByCategory,
  catalogueSize, allDefinitions,
} from './catalogue.js';
import {
  validateDefinition, validateCatalogue, deriveCost, deriveCapacity, tierFor,
  coverageRadiusFor, unlockStageFor, diversityPoints, diversityPenalty,
  diversityScore, wealthLevel, categoryPoints, pointsBonus, wealthBonus, diversityBonus,
  bonusAreaCells, isUnlocked,
} from './properties.js';
import {
  canPlace, placeInstance, removeInstance, upgradeInstance, occupancy,
  instancesByType, footprintCells, footprintCentre, ensureState, maxLevelFor,
} from './placement.js';
import { createBuildings } from './index.js';
import { cellCenter } from '../render/renderer.js';
import { createState } from '../core/state.js';
import * as THREE from 'three';

/**
 * Read the world transform of one instance slot of a batch group.
 * @param {THREE.Group} group the batch group
 * @param {number} index the slot
 * @param {number} [part] the model part
 */
function slotTransform(group, index, part = 0) {
  const im = group?.parts?.[part];
  if (!im) return null;
  const m = new THREE.Matrix4();
  im.getMatrixAt(index, m);
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  m.decompose(p, q, sc);
  return { x: p.x, y: p.y, z: p.z, scale: sc.x, quat: q };
}
import { diversityBonusPct, wealthBonusPct } from '../population/happiness.js';
import { GRID, TUNING, CELL } from '../core/config.js';

// The manifest is the ONLY source of art. Read it from disk so the test
// proves the catalogue's model references really exist.
const manifest = JSON.parse(
  readFileSync(new URL('../data/manifest.json', import.meta.url), 'utf8'),
);
const MANIFEST_KEYS = Object.keys(manifest.models);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** A flat, dry, empty map. */
function makeState() {
  const state = createState(1234);
  const size = GRID.size * GRID.size;
  state.world.heightmap = new Float32Array(size);
  state.world.water = new Float32Array(size);
  state.world.types = new Uint8Array(size);
  ensureState(state);
  return state;
}

function heightIndex(cx, cz) {
  return cz * GRID.size + cx;
}

// ===========================================================================
// 1. CATALOGUE INTEGRITY
// ===========================================================================

test('every catalogue entry passes the property schema', () => {
  const problems = validateCatalogue(BUILDING_DEFS);
  assert.deepEqual(problems, [], `catalogue schema problems:\n${problems.join('\n')}`);
  assert.equal(validateDefinition(getDefinition('res.house')).length, 0);
});

test('every referenced model really exists in the manifest', () => {
  const bad = BUILDING_DEFS.filter((d) => d.model && !MANIFEST_KEYS.includes(d.model));
  assert.deepEqual(bad.map((b) => `${b.id}:${b.model}`), [], 'bad model references');
});

test('MODEL_KEYS is exactly the manifest model list', () => {
  assert.deepEqual([...MODEL_KEYS].sort(), [...MANIFEST_KEYS].sort());
  assert.equal(MODEL_KEYS.length, 128);
});

test('unavailable entries never point at a model', () => {
  for (const d of BUILDING_DEFS.filter((x) => !x.available)) {
    assert.equal(d.model, null, `${d.id} must have model === null`);
    assert.ok(d.displayName.length > 0);
    assert.ok(d.unlock, `${d.id} must still declare how it unlocks`);
  }
});

test('entry ids are unique and footprints match the manifest', () => {
  const ids = new Set(BUILDING_DEFS.map((d) => d.id));
  assert.equal(ids.size, BUILDING_DEFS.length, 'duplicate catalogue id');
  for (const d of BUILDING_DEFS.filter((x) => x.available)) {
    const rec = manifest.models[d.model];
    assert.deepEqual(
      [d.footprintCells[0], d.footprintCells[1]],
      [rec.cells[0], rec.cells[1]],
      `${d.id} footprint does not match the manifest footprint of ${d.model}`,
    );
  }
});

// ===========================================================================
// 2. THE CATALOGUE SIZE IS DERIVED (FR-BLD-002)
// ===========================================================================

test('the catalogue size is derived from the loaded records', () => {
  assert.equal(catalogueSize(), BUILDING_DEFS.length);
  assert.equal(catalogueSize(), allDefinitions().length);
  assert.notEqual(catalogueSize(), 300, 'the count must not be a hard-coded marketing number');
  // Every definition belongs to exactly one category, so the sum over ALL
  // categories must equal the total. Deriving the category list from the
  // data keeps this honest when a category is added.
  const summed = CATEGORIES.reduce((n, c) => n + definitionsByCategory(c.id).length, 0);
  assert.equal(summed, BUILDING_DEFS.length,
    'every definition must be counted by exactly one category');
});

// ===========================================================================
// 3. CATEGORY COVERAGE (FR-BLD-009 / FR-BLD-019)
// ===========================================================================

test('every dossier category exists and holds at least one entry', () => {
  const expected = [
    'residential', 'commercial', 'industrial', 'energy', 'water', 'food',
    'waste', 'health', 'police', 'fire', 'education', 'transit', 'parks',
    'decoration', 'infrastructure', 'special',
  ];
  assert.deepEqual(CATEGORIES.map((c) => c.id).sort(), [...expected].sort());
  for (const id of expected) {
    assert.ok(definitionsByCategory(id).length > 0, `category ${id} is empty`);
  }
});

test('each entry sits in exactly one tab', () => {
  const seen = new Set();
  for (const d of BUILDING_DEFS) {
    const n = CATEGORIES.filter((c) => c.id === d.category).length;
    assert.equal(n, 1, `${d.id} must map to exactly one category`);
    seen.add(d.id);
  }
  assert.equal(seen.size, BUILDING_DEFS.length);
});

test('the residential ladder house -> apartment -> luxury apartment -> skyscraper exists', () => {
  const names = definitionsByCategory('residential').map((d) => d.displayName);
  for (const wanted of ['House', 'Apartment', 'Luxury Apartment', 'Skyscraper']) {
    assert.ok(names.includes(wanted), `residential is missing "${wanted}"`);
  }
});

test('the waste tab sits at the lower end of the shop', () => {
  const order = CATEGORIES.map((c) => c.id);
  assert.ok(order.indexOf('waste') >= order.length - 2, 'waste must be near the end');
});

// ===========================================================================
// 4. TIERS, COSTS AND UNLOCKS (FR-BLD-022 / 048 / 050 / 051)
// ===========================================================================

test('each tier owns its own capacity and coverage and both grow with level', () => {
  const def = getDefinition('hea.hospital');
  assert.ok(def.maxLevels > 1, 'the hospital must be upgradeable');
  const t1 = tierFor(def, 1);
  const t2 = tierFor(def, 2);
  assert.ok(t2.capacity.served > t1.capacity.served, 'capacity must grow with level');
  assert.ok(t2.coverage.radiusTiles > t1.coverage.radiusTiles, 'coverage must grow with level');
  assert.equal(deriveCapacity(def, 2).served, t2.capacity.served);
  assert.ok(coverageRadiusFor(def, 2) > coverageRadiusFor(def, 1));
  assert.equal(coverageRadiusFor(def, 1), t1.coverage.radiusTiles * CELL);
});

test('costs are positive and grow with the level and the footprint', () => {
  const house = getDefinition('res.house');
  const shop = getDefinition('com.shopping_arcade');
  assert.ok(deriveCost(house, 1) > 0);
  assert.ok(deriveCost(shop, 1) > deriveCost(house, 1), 'bigger entries cost more');
  assert.ok(deriveCost(house, 2) > deriveCost(house, 1), 'upgrades cost more');
});

test('unlocks declare a kind and a stage', () => {
  for (const d of BUILDING_DEFS) {
    assert.ok(['level', 'pack', 'event'].includes(d.unlock.kind));
    assert.equal(unlockStageFor(d), d.unlockStage);
  }
  assert.equal(isUnlocked(getDefinition('res.house'), { level: 1 }), true);
  assert.equal(isUnlocked(getDefinition('res.house'), { level: 0 }), false);
  assert.equal(isUnlocked(getDefinition('addon.amsterdam_canal_house'), { ownedPacks: [] }), false);
  assert.equal(isUnlocked(getDefinition('addon.amsterdam_canal_house'), { ownedPacks: ['addon-amsterdam'] }), true);
});

// ===========================================================================
// 5. PLACEMENT (FR-BLD-021 / 044 / 045 / 079)
// ===========================================================================

test('a valid placement succeeds and reports its footprint', () => {
  const state = makeState();
  const def = getDefinition('res.apartment');
  const res = canPlace(state, def, 10, 10, 0);
  assert.equal(res.ok, true);
  assert.equal(res.reason, null);
  assert.equal(res.cells.length, 4);
  assert.deepEqual(res.cells.map((c) => `${c.x},${c.z}`), ['10,10', '11,10', '10,11', '11,11']);
});

test('a rotated footprint swaps width and depth', () => {
  const def = getDefinition('com.grocery'); // 2 x 1 tiles
  assert.deepEqual(footprintCells(def, 10, 10, 0).map((c) => c.x), [10, 11]);
  assert.deepEqual(footprintCells(def, 10, 10, 0).map((c) => c.z), [10, 10]);
  assert.deepEqual(footprintCells(def, 10, 10, 1).map((c) => c.x), [10, 10]);
  assert.deepEqual(footprintCells(def, 10, 10, 1).map((c) => c.z), [10, 11]);
  assert.deepEqual(footprintCentre(def, 10, 10, 0), { x: 10.5, z: 10 });
  assert.deepEqual(footprintCentre(def, 10, 10, 1), { x: 10, z: 10.5 });
});

test('the placement check honours the rotation', () => {
  const state = makeState();
  const def = getDefinition('com.grocery'); // 2 x 1 tiles
  placeInstance(state, getDefinition('res.house'), 10, 11, 0);
  // Unrotated the shop covers (10,10) and (11,10): free.
  const rot0 = canPlace(state, def, 10, 10, 0);
  assert.equal(rot0.ok, true);
  // Rotated it covers (10,10) and (10,11): the house is in the way.
  const rot1 = canPlace(state, def, 10, 10, 1);
  assert.equal(rot1.ok, false);
  assert.equal(rot1.reason, 'occupied');
});

test('a second building on the same tile is refused', () => {
  const state = makeState();
  const def = getDefinition('res.house');
  assert.equal(canPlace(state, def, 12, 12, 0).ok, true);
  const placed = placeInstance(state, def, 12, 12, 0);
  assert.equal(placed.ok, true);
  const second = canPlace(state, def, 12, 12, 0);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'occupied');
});

test('out-of-bounds placements are refused', () => {
  const state = makeState();
  const def = getDefinition('res.house');
  const res = canPlace(state, def, GRID.size, 5, 0);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'out-of-bounds');
  assert.equal(canPlace(state, def, -1, 5, 0).reason, 'out-of-bounds');
});

test('building on water is refused', () => {
  const state = makeState();
  state.world.water[heightIndex(20, 20)] = 1.5;
  const res = canPlace(state, getDefinition('res.house'), 20, 20, 0);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'water');
});

test('building on a steep slope is refused', () => {
  const state = makeState();
  state.world.heightmap[heightIndex(21, 20)] = 12; // 12 world units of step
  const res = canPlace(state, getDefinition('res.apartment'), 20, 20, 0);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'slope');
});

test('a building that needs more slots than the player owns is refused', () => {
  const state = makeState();
  assert.equal(state.buildings.constructionSlots, 1);
  const res = canPlace(state, getDefinition('eng.coal'), 30, 30, 0);
  assert.equal(res.ok, false);
  assert.match(res.reason, /2 slots/, 'the warning must name the slot requirement');
  state.buildings.constructionSlots = 2;
  assert.equal(canPlace(state, getDefinition('eng.coal'), 30, 30, 0).ok, true);
});

test('an entry without art cannot be placed', () => {
  const state = makeState();
  const res = canPlace(state, getDefinition('edu.university'), 40, 40, 0);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'unavailable');
});

test('a missing road connection is reported but never blocks the placement', () => {
  const state = makeState();
  const def = getDefinition('res.house');
  const res = canPlace(state, def, 14, 14, 0);
  assert.equal(res.ok, true, 'FR-BLD-079: an unconnected building is still placeable');
  assert.equal(res.connected, false);
  state.mobility = { network: { nodes: new Map([[14 * GRID.size + 15, { x: 15, z: 14 }]]) } };
  assert.equal(canPlace(state, def, 14, 14, 0).connected, true);
});

test('placing writes the instance, the id counter and the occupancy index', () => {
  const state = makeState();
  const def = getDefinition('res.house');
  const res = placeInstance(state, def, 15, 15, 0);
  assert.equal(res.ok, true);
  assert.equal(res.instance.id, state.buildings.nextId - 1);
  assert.equal(state.buildings.nextId, 2);
  assert.equal(state.buildings.instances.size, 1);
  assert.equal(occupancy(state, 15, 15), res.instance);
  assert.equal(instancesByType(state, 'res.house').length, 1);
  assert.equal(res.instance.level, 1);
  assert.equal(res.instance.constructionState, 'done');
});

test('a zoned entry paints its zone', () => {
  const state = makeState();
  const res = placeInstance(state, getDefinition('foo.field'), 16, 16, 0);
  assert.equal(res.ok, true);
  assert.equal(state.buildings.zones.size, 2, 'the field covers two tiles');
  assert.equal([...state.buildings.zones.values()][0], 'farmland');
});

test('a road tile may not be paved over', () => {
  const state = makeState();
  state.mobility = { network: { nodes: new Map([[14 * GRID.size + 14, { x: 14, z: 14 }]]) } };
  const res = canPlace(state, getDefinition('res.house'), 14, 14, 0);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'road');
});

test('decorative scenery does not block construction', () => {
  // D-01: the world scatters ~900 nature props, and refusing to build on
  // any of them made most of the map unbuildable. Placing now CLEARS the
  // scenery on the target cell instead of refusing.
  const state = makeState();
  state.world.scenery = [{ model: 'mdvl_nature_oak_01', cx: 19, cz: 19 }];
  const res = canPlace(state, getDefinition('res.house'), 19, 19, 0);
  assert.equal(res.ok, true, `expected a clear plot, got "${res.reason}"`);
  assert.notEqual(res.reason, 'scenery');
});

test('fractional cells and radians are refused', () => {
  const state = makeState();
  const def = getDefinition('res.house');
  assert.equal(canPlace(state, def, 3.5, 4, 0).reason, 'invalid-cell');
  assert.equal(canPlace(state, def, 3, 4, Math.PI / 2).reason, 'invalid-rotation');
  assert.equal(placeInstance(state, def, 3.5, 4, 0).ok, false);
});

test('the Citycon Building gives a slot back when it is demolished', () => {
  const state = makeState();
  const before = state.buildings.constructionSlots;
  assert.equal(placeInstance(state, getDefinition('spl.citycon_building'), 17, 17, 0).ok, true);
  assert.equal(state.buildings.constructionSlots, before + 1);
  assert.equal(removeInstance(state, 17, 17).ok, true);
  assert.equal(state.buildings.constructionSlots, before, 'the slot must not be farmed');
});

// ===========================================================================
// 6. UPGRADE (FR-BLD-049 / 050 / 054)
// ===========================================================================

test('an upgrade happens in place and respects the maximum level', () => {
  const state = makeState();
  const def = getDefinition('res.house');
  const placed = placeInstance(state, def, 18, 18, 0);
  const cellsBefore = JSON.stringify(placed.instance.cells);

  const up = upgradeInstance(state, 18, 18);
  assert.equal(up.ok, true);
  assert.equal(up.instance.level, 2);
  assert.equal(up.instance.tier, 2);
  assert.equal(JSON.stringify(up.instance.cells), cellsBefore, 'the cells must not move');
  assert.equal(up.instance.x, 18);
  assert.equal(up.instance.z, 18);

  assert.equal(upgradeInstance(state, 18, 18).ok, true);
  assert.equal(placed.instance.level, 3);
  assert.equal(upgradeInstance(state, 18, 18).ok, false, 'no level beyond the maximum');
  assert.equal(upgradeInstance(state, 18, 18).reason, 'max-level');
  assert.equal(maxLevelFor(def), TUNING.maxLevels);
});

test('upgrading a service building raises its capacity and coverage', () => {
  const state = makeState();
  const def = getDefinition('hea.hospital');
  placeInstance(state, def, 20, 20, 0);
  const before = deriveCapacity(def, 1);
  upgradeInstance(state, 20, 20);
  const after = deriveCapacity(def, 2);
  assert.ok(after.served > before.served);
  assert.ok(coverageRadiusFor(def, 2) > coverageRadiusFor(def, 1));
});

// ===========================================================================
// 7. DEMOLISH AND REFUND (FR-BLD-087 / 088, TUNING.demolishRefundRate)
// ===========================================================================

test('demolishing frees the tiles and reports the refund', () => {
  const state = makeState();
  const def = getDefinition('res.apartment');
  const placed = placeInstance(state, def, 22, 22, 0);
  assert.equal(placed.ok, true);

  const res = removeInstance(state, 22, 22);
  assert.equal(res.ok, true);
  const expected = Math.round(deriveCost(def, 1) * TUNING.demolishRefundRate);
  assert.equal(res.refund, expected);
  assert.equal(state.buildings.instances.size, 0);
  assert.equal(occupancy(state, 22, 22), null);
  assert.equal(canPlace(state, def, 22, 22, 0).ok, true, 'the tiles must be free again');
  assert.equal(removeInstance(state, 22, 22).reason, 'no-building');
});

test('demolishing releases every tile of a multi-tile building', () => {
  const state = makeState();
  placeInstance(state, getDefinition('res.apartment'), 24, 24, 0);
  removeInstance(state, 24, 24);
  for (const c of [{ x: 24, z: 24 }, { x: 25, z: 24 }, { x: 24, z: 25 }, { x: 25, z: 25 }]) {
    assert.equal(occupancy(state, c.x, c.z), null);
  }
});

// ===========================================================================
// 8. DIVERSITY, WEALTH AND POINTS (FR-BLD-098 / 099 / 100 / 102 / 103)
// ===========================================================================

test('diversity counts one point per distinct catalogue entry', () => {
  const state = makeState();
  placeInstance(state, getDefinition('res.house'), 1, 1, 0);
  placeInstance(state, getDefinition('res.house'), 2, 1, 0);
  placeInstance(state, getDefinition('res.apartment'), 3, 1, 0);
  const list = Array.from(state.buildings.instances.values());
  assert.equal(diversityPoints(list), 2, 'three buildings, two distinct entries');
  assert.equal(diversityScore(list), 2);
});

test('more than eight copies of one entry type cost diversity points', () => {
  const state = makeState();
  const def = getDefinition('res.house');
  for (let i = 0; i < 9; i += 1) placeInstance(state, def, i % 10, Math.floor(i / 10) + 1, 0);
  const list = Array.from(state.buildings.instances.values());
  assert.equal(diversityPoints(list), 1);
  assert.equal(diversityPenalty(list), 1, 'one point per copy beyond eight');
  assert.equal(diversityScore(list), 0);
});

test('wealth averages only the entries that carry a wealth value', () => {
  const state = makeState();
  placeInstance(state, getDefinition('res.house'), 1, 1, 0);              // wealth 1
  placeInstance(state, getDefinition('res.luxury_apartment'), 2, 1, 0); // wealth 2
  placeInstance(state, getDefinition('dec.oak_tree'), 3, 1, 0);          // no wealth value
  const list = Array.from(state.buildings.instances.values());
  assert.equal(wealthLevel(list), 1.5, 'the neutral entry must not drag the average down');
  assert.equal(wealthLevel([]), 0);
});

test('a unique entry scores its points once, a stackable entry once per copy', () => {
  const state = makeState();
  const unique = getDefinition('edu.art_museum');   // culture 10, unique
  const stackable = getDefinition('dec.flower_patch'); // recreation 1, stackable
  placeInstance(state, unique, 1, 1, 0);
  placeInstance(state, unique, 2, 1, 0);
  placeInstance(state, stackable, 3, 1, 0);
  placeInstance(state, stackable, 4, 1, 0);
  const list = Array.from(state.buildings.instances.values());
  assert.equal(categoryPoints(list, 'culture'), 10, 'the unique entry counts once');
  assert.equal(categoryPoints(list, 'recreation'), 2, 'the stackable entry counts per copy');
});

test('one point per 1000 residents reaches the 250 % cap', () => {
  assert.equal(pointsBonus(10, 10000), 250);
  assert.equal(pointsBonus(5, 10000), 125);
  assert.equal(pointsBonus(100, 1000), 250, 'the bonus is capped');
  // The wealth curve passes through BOTH published anchors: 1.65 -> 129 %
  // and 3 -> 250 % (FR-BLD-101).
  assert.equal(Math.round(wealthBonus(1.65)), 129);
  assert.equal(wealthBonus(3), 250);
  assert.ok(wealthBonus(1.65) < wealthBonus(3));
  assert.ok(wealthBonus(2) > wealthBonus(1.65));
});

// ===========================================================================
// 9. BONUS AREAS (FR-BLD-041 - the published 13 x 13)
// ===========================================================================

test('the published bonus area is 13 x 13', () => {
  const silo = getDefinition('foo.silo');
  assert.equal(silo.bonusArea.radiusTiles, 6);
  const cells = bonusAreaCells(silo, 10, 10, GRID.size);
  assert.equal(cells.length, 169, '13 x 13 = 169 cells');
  const xs = cells.map((c) => c.x);
  const zs = cells.map((c) => c.z);
  assert.equal(Math.max(...xs) - Math.min(...xs) + 1, 13);
  assert.equal(Math.max(...zs) - Math.min(...zs) + 1, 13);
});

test('a bonus area is clipped to the grid and a plain entry has none', () => {
  const silo = getDefinition('foo.silo');
  assert.equal(bonusAreaCells(silo, 0, 0, GRID.size).length, 49, '7 x 7 at the corner');
  assert.deepEqual(bonusAreaCells(getDefinition('res.house'), 5, 5, GRID.size), []);
});

// ===========================================================================
// 10. THE SERVICE FACTORY (index.js)
// ===========================================================================

function makeCtx(state) {
  const world = {
    children: [],
    add(o) { this.children.push(o); },
    remove(o) {
      const i = this.children.indexOf(o);
      if (i >= 0) this.children.splice(i, 1);
    },
  };
  const events = [];
  return {
    events,
    world,
    ctx: {
      state,
      bus: { on() {}, off() {}, once() {}, emit(evt, payload) { events.push({ evt, payload }); } },
      assets: {
        manifest,
        // A REAL Object3D, prepared exactly the way `render/assets.js`
        // prepares a loaded model: the family scale on the root and the
        // ground offset under it. The buildings domain batches models into
        // InstancedMeshes, so the fake has to be a real scene graph.
        loadModel: async (key) => {
          const rec = manifest.models[key];
          const group = new THREE.Group();
          group.name = key;
          group.scale.setScalar(rec?.scale ?? 1);
          group.position.y = rec?.yOffset ?? 0;
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
          mesh.name = `${key}-part`;
          group.add(mesh);
          return group;
        },
        getModel: () => null,
        preload: async () => ({ loaded: 0, total: 0, failures: [] }),
      },
      renderer: { world },
      config: { CELL, GRID, TUNING },
      manifest,
      rng: () => 0.5,
      domains: {},
      ui: null,
    },
  };
}

const tick = () => new Promise((resolve) => { setTimeout(resolve, 0); });

test('the service exposes the contracted API', async () => {
  const { ctx } = makeCtx(makeState());
  const svc = createBuildings(ctx);
  for (const name of [
    'init', 'update', 'tick', 'catalogue', 'instances', 'place', 'remove',
    'buildingAt', 'canPlace', 'upgrade', 'occupancy', 'countByType', 'dispose',
    'onClick', 'setTool',
  ]) {
    assert.equal(typeof svc[name], 'function', `missing method ${name}`);
  }
  assert.equal(svc.catalogue().length, BUILDING_DEFS.length);
  assert.equal(svc.catalogueSize(), BUILDING_DEFS.length);
});

test('placing through the service builds the 3D model and emits the event', async () => {
  const { ctx, world, events } = makeCtx(makeState());
  const svc = createBuildings(ctx);
  await svc.init();

  const res = svc.place('res.house', 30, 30, 0);
  assert.equal(res.ok, true);
  assert.equal(typeof res.id, 'number');
  await tick();

  assert.equal(world.children.length, 1, 'the batch must be added to renderer.world');
  const batch = world.children[0];
  const t = slotTransform(batch, 0);
  assert.ok(Number.isFinite(t.x), 'the instance must have a finite x');
  assert.ok(Number.isFinite(t.z), 'the instance must have a finite z');
  assert.equal(svc.renderStats().instances, 1, 'the building occupies one instance slot');
  assert.equal(svc.renderStats().batches, 1, 'one model means one batch');

  const placed = events.find((e) => e.evt === 'build:placed');
  assert.ok(placed, 'BUILDING_PLACED must be emitted');
  assert.equal(placed.payload.type, 'res.house');
  assert.equal(svc.occupancy(30, 30).id, res.id);
  assert.equal(svc.countByType('res.house'), 1);
  assert.equal(svc.buildingAt(30, 30).type, 'res.house');
});

test('removing through the service takes the model out of the world', async () => {
  const { ctx, world, events } = makeCtx(makeState());
  const svc = createBuildings(ctx);
  await svc.init();
  svc.place('res.house', 31, 31, 0);
  await tick();
  assert.equal(world.children.length, 1);

  const res = svc.remove(31, 31);
  assert.equal(res.ok, true);
  await tick();
  // The batch stays in the world (it may hold other buildings), but the
  // removed building's slot is hidden.
  assert.equal(world.children.length, 1, 'the batch stays in the world');
  assert.equal(slotTransform(world.children[0], 0).scale, 0,
    'the removed building must be hidden');
  assert.equal(svc.renderStats().instances, 0, 'no instance is left for it');
  assert.ok(events.find((e) => e.evt === 'build:removed'));
  assert.equal(svc.countByType('res.house'), 0);
});

test('the service refuses a placement the placement rules reject', async () => {
  const { ctx } = makeCtx(makeState());
  const svc = createBuildings(ctx);
  await svc.init();
  assert.equal(svc.canPlace('res.house', 32, 32).ok, true);
  assert.equal(svc.canPlace('res.house', 999, 32).ok, false);
  assert.equal(svc.place('edu.university', 33, 33).ok, false);
  assert.equal(svc.place('no.such.building', 33, 33).reason, 'unknown-building');
});

test('onClick places with the selected type and bulldozes with the bulldozer', async () => {
  const { ctx } = makeCtx(makeState());
  const svc = createBuildings(ctx);
  await svc.init();
  svc.setSelectedType('res.house');
  svc.setTool('build');
  svc.onClick({ x: 34, z: 34 }, 0);
  assert.equal(svc.countByType('res.house'), 1);

  svc.setTool('bulldoze');
  svc.onClick({ x: 34, z: 34 }, 0);
  assert.equal(svc.countByType('res.house'), 0);
});

test('a model that loads after its instance was demolished is not left in the world', async () => {
  const { ctx, world } = makeCtx(makeState());
  const svc = createBuildings(ctx);
  await svc.init();
  svc.place('res.house', 36, 36, 0);
  // Demolish before the (asynchronous) model load resolves.
  assert.equal(svc.remove(36, 36).ok, true);
  await tick();
  assert.equal(world.children.length, 0, 'no ghost mesh may be left behind');
});

test('the waste channel exposes production and removal separately', () => {
  const incinerator = getDefinition('wst.incineration');
  assert.ok(incinerator.production.wasteRemoval > 0, 'the incinerator removes waste');
  assert.equal(incinerator.wasteProduction, 0, 'it does not create waste');
  const house = getDefinition('res.house');
  assert.ok(house.wasteProduction > 0, 'a house creates waste');
  assert.equal(house.production.wasteRemoval, 0);
  assert.equal(validateDefinition(house).length, 0);
});

test('the 3D model is centred on the cells of its footprint', async () => {
  const { ctx, world } = makeCtx(makeState());
  const svc = createBuildings(ctx);
  await svc.init();
  // A 2 x 1 shop: the model centre must sit on the centre of the two tiles.
  svc.place('com.grocery', 10, 10, 0);
  await tick();
  const batch = world.children[0];
  const t = slotTransform(batch, 0);
  const rec = manifest.models.shop_grocery;
  const expect = cellCenter(10.5, 10);
  // The transform goes through a matrix, so compare with a tolerance.
  const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-4, `${what}: ${a} != ${b}`);
  near(t.x, expect.x - rec.centerXZ[0], 'x');
  near(t.z, expect.z - rec.centerXZ[1], 'z');
  near(t.quat.y, 0, 'no rotation at rot 0');
  near(t.scale, rec.scale, 'the family scale is carried by the instance');
});

test('the 3D model stands on the terrain instead of being buried in it', async () => {
  const state = makeState();
  // The whole footprint is raised by 6 world units.
  state.world.heightmap[heightIndex(10, 10)] = 6;
  state.world.heightmap[heightIndex(11, 10)] = 6;
  const { ctx, world } = makeCtx(state);
  const svc = createBuildings(ctx);
  await svc.init();
  const res = svc.place('com.grocery', 10, 10, 0);
  assert.equal(res.ok, true);
  await tick();
  const rec = manifest.models.shop_grocery;
  const t = slotTransform(world.children[0], 0);
  assert.equal(t.y, 6 + (rec.yOffset ?? 0), 'the model must sit on the raised ground');
});

test('dispose() stops models from being added to the world', async () => {
  const { ctx, world } = makeCtx(makeState());
  const svc = createBuildings(ctx);
  await svc.init();
  svc.place('res.house', 38, 38, 0);
  svc.dispose();
  await tick();
  assert.equal(world.children.length, 0, 'no model may appear after dispose()');
});

test('init() clears the instances that no longer exist', async () => {
  const { ctx, world } = makeCtx(makeState());
  const svc = createBuildings(ctx);
  await svc.init();
  svc.place('res.house', 39, 39, 0);
  await tick();
  assert.equal(world.children.length, 1);
  // A reset replaces the instances map; the old building must not survive.
  ctx.state.buildings.instances = new Map();
  ctx.state.buildings.occupancy = new Map();
  await svc.init();
  await tick();
  assert.equal(slotTransform(world.children[0], 0).scale, 0,
    'a stale instance must be hidden');
  assert.equal(svc.renderStats().instances, 0, 'no instance is left for it');
});

test('a right click never places or demolishes', async () => {
  const { ctx } = makeCtx(makeState());
  const svc = createBuildings(ctx);
  await svc.init();
  svc.setSelectedType('res.house');
  svc.setTool('build');
  svc.onClick({ x: 40, z: 40 }, 2);
  assert.equal(svc.countByType('res.house'), 0, 'the right button must do nothing');
  svc.onClick({ x: 40, z: 40 }, 0);
  assert.equal(svc.countByType('res.house'), 1);
  svc.setTool('bulldoze');
  svc.onClick({ x: 40, z: 40 }, 2);
  assert.equal(svc.countByType('res.house'), 1, 'the right button must not bulldoze either');
});

test('a unique entry is never also stackable', () => {
  for (const d of BUILDING_DEFS) {
    assert.ok(!(d.unique && d.stackable), `${d.id} is both unique and stackable`);
  }
  assert.equal(getDefinition('edu.art_museum').unique, true);
  assert.equal(getDefinition('edu.art_museum').stackable, false);
});

test('the pole barn has art, so the food chain can be completed', () => {
  const poleBarn = getDefinition('foo.pole_barn');
  assert.equal(poleBarn.available, true);
  assert.ok(poleBarn.model, 'the pole barn must reference a real model');
  assert.ok(MANIFEST_KEYS.includes(poleBarn.model));
  assert.equal(poleBarn.bonusArea.radiusTiles, 6);
});

test('a bonus entry never targets processed food production', () => {
  for (const d of BUILDING_DEFS.filter((x) => x.bonusArea)) {
    for (const target of d.bonusArea.targets) {
      assert.notEqual(target, 'food.processed', `${d.id} must not boost processed food`);
      assert.notEqual(target, 'food', `${d.id} must target production channels, not the whole food category`);
    }
  }
});

// ===========================================================================
// 10. ONE IMPLEMENTATION OF THE BONUS RULES (no drift between BLD and POP)
// ===========================================================================

test('the BLD wealth bonus IS the POP wealth bonus, at every level', () => {
  // POP owns the canonical bonus maths. BLD delegates to it, so the two can
  // never drift apart — this sweep is the guarantee.
  for (const level of [0, 0.1, 0.2, 0.5, 1, 1.25, 1.65, 2, 2.5, 2.999, 3, 4, 99]) {
    assert.equal(wealthBonus(level), wealthBonusPct(level),
      `level ${level} must give the same number in both domains`);
  }
  // The published anchors still hold.
  assert.equal(wealthBonusPct(1.65), 129, 'the published 1.65 -> 129 % anchor');
  assert.equal(wealthBonus(3), 250, 'the published 3 -> 250 % anchor');
});

test('the BLD diversity bonus IS the POP diversity bonus', () => {
  for (const points of [0, 1, 7.5, 100, 249, 250, 251, 9999]) {
    assert.equal(diversityBonus(points), diversityBonusPct(points),
      `diversity ${points} must give the same number in both domains`);
  }
  assert.equal(diversityBonusPct(9999), 250, 'the diversity cap holds');
});

test('delegating to POP introduces no import cycle', () => {
  // `population/happiness.js` must not (transitively) import `buildings/`.
  const src = readFileSync(new URL('../population/happiness.js', import.meta.url), 'utf8');
  assert.ok(!/from\s+['"][^'"]*buildings/.test(src),
    'the canonical bonus module must not import the buildings domain');
  assert.ok(/from\s+['"][^'"]*core\/config\.js/.test(src),
    'the canonical bonus module may only depend on the pure core');
});

// ===========================================================================
// 11. The batching: copies of one model must not each cost a draw call
// ===========================================================================

test('twenty copies of one model cost the same draw calls as one', async () => {
  const { ctx, world } = makeCtx(makeState());
  const svc = createBuildings(ctx);
  await svc.init();

  svc.place('res.house', 10, 10, 0);
  await tick();
  const one = svc.renderStats();
  assert.equal(one.instances, 1);
  assert.equal(one.batches, 1, 'one model means one batch');
  const drawCallsForOne = one.drawCalls;

  // Nineteen more copies of the SAME model, well away from each other.
  let placed = 1;
  for (let x = 12; x < 60 && placed < 20; x += 2) {
    const r = svc.place('res.house', x, 20, 0);
    if (r.ok) placed += 1;
  }
  await tick();

  const many = svc.renderStats();
  assert.equal(many.instances, placed, `expected ${placed} instances`);
  assert.equal(many.batches, 1, 'twenty copies of one model still share ONE batch');
  assert.equal(many.drawCalls, drawCallsForOne,
    'twenty copies must not cost more draw calls than one');

  // The batch grew to hold them all, and every instance is in the scene.
  const batch = world.children[0];
  assert.ok(batch.parts.length >= 1, 'the batch has its parts');
  assert.ok(batch.parts[0].count >= placed, 'the batch grew to hold every copy');
});

test('a demolished copy frees its slot for the next building', async () => {
  const { ctx, world } = makeCtx(makeState());
  const svc = createBuildings(ctx);
  await svc.init();

  svc.place('res.house', 10, 10, 0);
  await tick();
  const batch = world.children[0];
  const capacityAfterOne = batch.parts[0].capacity;

  svc.remove(10, 10);
  await tick();
  assert.equal(svc.renderStats().instances, 0, 'the demolished building is gone');
  assert.equal(slotTransform(batch, 0).scale, 0, 'its slot is hidden');

  // The freed slot is reused, so the batch does not have to grow.
  svc.place('res.house', 12, 10, 0);
  await tick();
  assert.equal(svc.renderStats().instances, 1);
  assert.equal(batch.parts[0].capacity, capacityAfterOne,
    'the batch must reuse the freed slot rather than grow');
  assert.ok(slotTransform(batch, 0).scale > 0, 'the new building is visible');
});
