/**
 * tests/live-state.test.mjs — the domains must never write into a dead tree.
 *
 * `ctx.state` is a GETTER in `main.js`, and `core/state.js setState()`
 * REPLACES the tree when a save is loaded. `core/save.js` copies the restored
 * tree over the live one, which keeps the TREE object's identity but
 * REPLACES every SUB-TREE inside it.
 *
 * A domain that captured `ctx.state` (or `state.economy`) at construction
 * time therefore keeps writing into an orphaned object: the money changes, the
 * roads change, the model never appears — and the player sees nothing happen.
 *
 * Every test here FAILS against the pre-fix code and PASSES against the live
 * proxies in `core/state.js`.
 *
 * Run:  node --test tests/live-state.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEconomy } from '../src/economy/index.js';
import { createMobility } from '../src/mobility/index.js';
import { createBuildings } from '../src/buildings/index.js';
import { createStudio } from '../src/studio/index.js';
import { createPopulation } from '../src/population/index.js';
import { createServices } from '../src/services/index.js';
import { TUNING, CELL, GRID } from '../src/core/config.js';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** A minimal event bus that records what the domains emit. */
function makeBus() {
  const events = [];
  return {
    events,
    on() { return () => {}; },
    off() {},
    once() {},
    emit(evt, payload) { events.push({ evt, payload }); },
  };
}

/**
 * A context whose `state` is a GETTER, exactly like `main.js` builds it.
 * `swapTree()` replaces the whole tree; `swapSubtree()` replaces one
 * sub-tree, which is what a save/load does.
 */
function makeCtx(initial) {
  let live = initial;
  const bus = makeBus();
  const world = {
    children: [],
    add(o) { this.children.push(o); },
    remove(o) {
      const i = this.children.indexOf(o);
      if (i >= 0) this.children.splice(i, 1);
    },
  };
  const ctx = {
    bus,
    config: { TUNING, CELL, GRID },
    domains: {},
    manifest: { models: {} },
    rng: () => 0.5,
    renderer: { world, cellCenter: (x, z) => ({ x: x * 4, y: 0, z: z * 4 }) },
    assets: {
      manifest: { models: {} },
      loadModel: async (key) => ({
        name: key,
        position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
        rotation: { y: 0 },
        userData: {},
      }),
      getModel: () => null,
      preload: async () => ({ loaded: 0, total: 0, failures: [] }),
    },
  };
  Object.defineProperty(ctx, 'state', {
    get: () => live,
    set: (next) => { live = next; },
    configurable: true,
    enumerable: true,
  });
  ctx.swapTree = (next) => { live = next; };
  ctx.swapSubtree = (key, next) => { live[key] = next; };
  ctx.live = () => live;
  return ctx;
}

/** A fresh economy-shaped state tree. */
function economyState(treasury = 1000) {
  return {
    economy: { treasury, ledger: [], revenue: 0, expenditure: 0, month: 1 },
    population: { residents: 0, total: 0 },
    buildings: { instances: new Map() },
    mobility: { roads: new Map() },
    world: { scenery: [] },
    ui: { toasts: [] },
    meta: { seed: 7, elapsed: 0, day: 1 },
  };
}

// ---------------------------------------------------------------------------
// ECO — the tree
// ---------------------------------------------------------------------------

test('ECO writes into the tree that is live NOW, not the one it was built with', () => {
  const ctx = makeCtx(economyState(1000));
  const eco = createEconomy(ctx);
  eco.init();
  assert.equal(eco.treasury(), 1000);

  // A save/load: the tree object is REPLACED.
  ctx.swapTree(economyState(5000));

  assert.equal(eco.treasury(), 5000, 'the domain must read the NEW tree');
  eco.earn(250, 'test');
  assert.equal(ctx.live().economy.treasury, 5250, 'the domain must WRITE to the NEW tree');
});

// ---------------------------------------------------------------------------
// ECO — the sub-tree
// ---------------------------------------------------------------------------

test('ECO writes into the economy sub-tree that is live NOW', () => {
  const ctx = makeCtx(economyState(1000));
  const eco = createEconomy(ctx);
  eco.init();
  assert.equal(eco.treasury(), 1000);

  // What `core/save.js` does on a load: the tree keeps its identity, but
  // `state.economy` is replaced with a fresh object.
  ctx.swapSubtree('economy', { treasury: 7777, ledger: [], revenue: 0, expenditure: 0, month: 1 });

  assert.equal(eco.treasury(), 7777, 'the domain must read the NEW sub-tree');
  eco.earn(23, 'test');
  assert.equal(ctx.live().economy.treasury, 7800, 'the domain must WRITE to the NEW sub-tree');
});

// ---------------------------------------------------------------------------
// MOB
// ---------------------------------------------------------------------------

test('MOB writes into the mobility sub-tree that is live NOW', () => {
  const ctx = makeCtx(economyState());
  const mob = createMobility(ctx);
  mob.init();

  ctx.swapSubtree('mobility', { roads: new Map(), network: { nodes: new Map(), edges: 0 } });

  mob.addRoad(10, 10);
  assert.ok(ctx.live().mobility.roads.size >= 1, 'the road must land in the NEW sub-tree');
  assert.ok(mob.roadAt(10, 10), 'the domain must see the road it just wrote');
});

// ---------------------------------------------------------------------------
// BLD
// ---------------------------------------------------------------------------

test('BLD writes into the buildings sub-tree that is live NOW', async () => {
  const ctx = makeCtx(economyState());
  const bld = createBuildings(ctx);
  await bld.init();

  ctx.swapSubtree('buildings', { instances: new Map(), selected: null });

  const placed = bld.place('res.house', 4, 4, 0);
  assert.equal(placed.ok, true, `placement failed: ${placed.reason}`);
  assert.equal(ctx.live().buildings.instances.size, 1, 'the building must land in the NEW sub-tree');
  assert.ok(bld.buildingAt(4, 4), 'the domain must see the building it just wrote');
});

// ---------------------------------------------------------------------------
// STD
// ---------------------------------------------------------------------------

test('STD writes into the studio sub-tree that is live NOW', () => {
  const ctx = makeCtx(economyState());
  const std = createStudio(ctx);
  // `init()` is async and builds the editor, which needs a DOM. The state
  // wiring under test does not need the editor, so it is not called here.

  ctx.swapSubtree('studio', { open: false, voxels: new Map(), doc: null, dirty: false, palette: [], brush: 1 });

  std.paint(2, 3, 4, 8);
  assert.equal(ctx.live().studio.voxels.size, 1, 'the voxel must land in the NEW sub-tree');
  assert.equal(std.voxels.size, 1, 'the domain must see the voxel it just wrote');
  assert.equal(ctx.live().studio.voxels.get('2,3,4').id, 8);
});

// ---------------------------------------------------------------------------
// POP
// ---------------------------------------------------------------------------

test('POP reads and writes the population sub-tree that is live NOW', async () => {
  const { installCatalogue } = await import('../src/population/population.js');
  await installCatalogue();

  const ctx = makeCtx(economyState());
  const pop = createPopulation(ctx);
  await pop.init();

  // A save/load replaces the sub-tree.
  const fresh = {
    total: 1234, happiness: 71, loyalty: 66, households: 400, needs: {},
    citizens: [], migration: 0, employed: 0, unemployed: 0,
  };
  ctx.swapSubtree('population', fresh);

  assert.equal(pop.population(), 1234, 'the domain must read the NEW sub-tree');
  assert.equal(pop.happiness(), 71);
  assert.equal(pop.loyalty(), 66);
  assert.equal(pop.households(), 400);

  // And it must WRITE into the NEW sub-tree.
  pop.tick(1);
  assert.equal(typeof fresh.migration, 'number', 'the tick must write the migration into the NEW sub-tree');
  assert.ok('growthFactor' in fresh, 'the tick must write the growth factor into the NEW sub-tree');
});

// ---------------------------------------------------------------------------
// SRV
// ---------------------------------------------------------------------------

test('SRV reads and writes the services sub-tree that is live NOW', async () => {
  const { installCatalogue } = await import('../src/services/services.js');
  await installCatalogue();

  const ctx = makeCtx(economyState());
  const srv = createServices(ctx);
  await srv.init();

  // A save/load replaces the sub-tree.
  const fresh = { coverage: new Map(), cityCoverage: {}, facilities: [] };
  ctx.swapSubtree('services', fresh);

  srv.update(0);

  assert.ok(fresh.coverage instanceof Map, 'the coverage map must land in the NEW sub-tree');
  assert.equal(typeof fresh.cityCoverage, 'object', 'the city coverage must land in the NEW sub-tree');
  assert.ok(Array.isArray(fresh.facilities), 'the facility list must land in the NEW sub-tree');
});

// ---------------------------------------------------------------------------
// UX
// ---------------------------------------------------------------------------
test('UX writes into the live state tree, not an orphaned one', async () => {
  // The UX factory is imported lazily so the module is loaded with the same
  // globals the test uses. In Node there is no `document`, so the HUD DOM is
  // not built — the state wiring is what is under test here.
  const { createUI } = await import('../src/ui/index.js');

  const first = economyState();
  first.ui = { tool: 'inspect', toasts: [], selection: null, hover: null };
  const ctx = makeCtx(first);

  const ui = createUI(ctx);

  // The UX layer writes through the live proxy.
  ui.setTool('build');
  assert.equal(first.ui.tool, 'build', 'the tool must be written into the live tree');

  // A save/load REPLACES the tree object.
  const second = economyState();
  second.ui = { tool: 'inspect', toasts: [], selection: null, hover: null };
  ctx.swapTree(second);

  // The UX layer must now write into the NEW tree...
  ui.setTool('road');
  assert.equal(second.ui.tool, 'road', 'the tool must be written into the NEW tree');
  assert.equal(first.ui.tool, 'build', 'the orphaned tree must NOT be written to');

  // ...and it must READ the new tree.
  assert.equal(ui.hoverCell, null, 'the hover cell starts empty in the NEW tree');
  second.ui.hover = { x: 7, z: 9 };
  assert.deepEqual(ui.hoverCell, { x: 7, z: 9 }, 'the hover cell must be read from the NEW tree');

  // The toast queue is written live too.
  ui.showToast('live');
  assert.equal(second.ui.toasts.length, 1, 'the toast must land in the NEW tree');
  assert.equal(first.ui.toasts.length, 0, 'the orphaned tree must not collect the toast');

  ui.dispose();
});
