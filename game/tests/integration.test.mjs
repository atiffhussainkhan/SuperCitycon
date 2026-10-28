/**
 * tests/integration.test.mjs — cross-domain contract conformance.
 *
 * The ten domain agents each ship their own green unit tests. This file is
 * the check that the domains FIT TOGETHER: every factory exists, every
 * service exposes the API the contract fixes, no domain imports `three` where
 * the contract forbids it, and no catalogue entry points at a model key that
 * is not in the manifest.
 *
 * It also covers the wiring the INTEGRATOR owns:
 *   - the placement gate (main.js) that puts the economy's construction-slot
 *     check in front of every placement,
 *   - the curated 2D art manifest reaching the HUD,
 *   - the build configuration that keeps the art as static files.
 *
 * Run:  node --test tests/integration.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installFakeDom } from './helpers/fake-dom.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const GAME = join(HERE, '..');
const PUBLIC = join(GAME, 'public');

/** Load a module if it exists, else null. */
async function optional(rel) {
  const p = join(SRC, rel);
  if (!existsSync(p)) return null;
  return import(p);
}

/** Read every source file under a directory (recursively). */
function readAll(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...readAll(p));
    else if (/\.m?js$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * The UX domain builds its HUD eagerly inside `createUI()`, so the factory
 * needs a `document`. Install the stand-in for the duration of `fn`.
 */
async function withDom(fn) {
  const restore = installFakeDom();
  try {
    return await fn();
  } finally {
    restore();
  }
}

// ---------------------------------------------------------------------------
describe('domain factories', () => {
  const SPECS = [
    ['world/index.js', 'createWorld', ['init', 'update', 'tick', 'generate', 'heightAt', 'setHeight',
      'typeAt', 'waterLevel', 'isWater', 'buildMesh', 'scatter', 'placeNature', 'terraform', 'dispose']],
    ['buildings/index.js', 'createBuildings', ['init', 'update', 'tick', 'catalogue', 'instances', 'place',
      'remove', 'buildingAt', 'canPlace', 'upgrade', 'occupancy', 'countByType', 'dispose']],
    ['economy/index.js', 'createEconomy', ['init', 'update', 'tick', 'treasury', 'canAfford', 'spend',
      'earn', 'monthlyIncome', 'monthlyUpkeep', 'applyBudget', 'budget', 'dispose']],
    ['mobility/index.js', 'createMobility', ['init', 'update', 'tick', 'rebuildNetwork', 'roadAt',
      'addRoad', 'removeRoad', 'vehicleCount', 'congestion', 'averageCommute', 'setDensity', 'dispose']],
    ['population/index.js', 'createPopulation', ['init', 'update', 'tick', 'population', 'happiness',
      'loyalty', 'households', 'addCitizens', 'removeCitizens', 'happinessBreakdown', 'spawnCitizen',
      'despawnCitizen', 'citizenCount', 'dispose']],
    ['services/index.js', 'createServices', ['init', 'update', 'tick', 'coverageFor', 'cityCoverage',
      'availability', 'unmetDemand', 'registerFacility', 'dispose']],
    ['studio/index.js', 'createStudio', ['init', 'update', 'tick', 'open', 'close', 'isOpen', 'voxels',
      'paint', 'erase', 'brushSize', 'setBrush', 'saveWorkshop', 'loadWorkshop', 'exportOBJ', 'dispose']],
    ['ui/index.js', 'createUI', ['init', 'update', 'mount', 'unmount', 'setTool', 'setSelection',
      'showToast', 'openPanel', 'closePanel', 'panel', 'camera', 'hoverCell', 'dispose']],
  ];

  for (const [rel, factoryName, methods] of SPECS) {
    test(`${rel} exports ${factoryName} with the contracted API`, async () => {
      const mod = await optional(rel);
      if (!mod) {
        // The domain has not landed yet — that is reported, not silently passed.
        assert.fail(`${rel} is missing — the domain has not been implemented yet`);
      }
      assert.equal(typeof mod[factoryName], 'function', `${factoryName} must be a function`);

      // A minimal context that satisfies the contract's ctx shape. The UX
      // domain builds its HUD eagerly, so it needs a `document`.
      const ctx = makeStubCtx();
      const svc = await withDom(async () => mod[factoryName](ctx));
      assert.ok(svc, `${factoryName} must return a service object`);
      for (const m of methods) {
        assert.ok(m in svc, `${rel}: service is missing "${m}"`);
      }
    });
  }
});

// ---------------------------------------------------------------------------
describe('CORE modules', () => {
  test('core/stage.js exposes the stage API', async () => {
    const mod = await optional('core/stage.js');
    if (!mod) return assert.fail('core/stage.js missing');
    for (const fn of ['getStage', 'currentStage', 'evaluateStage', 'advanceStage', 'stageProgress']) {
      assert.equal(typeof mod[fn], 'function', `stage.${fn} must be a function`);
    }
    assert.ok(Array.isArray(mod.STAGES) && mod.STAGES.length >= 3,
      'the catalogue must define at least 3 stages');
  });

  test('core/save.js exposes the save API', async () => {
    const mod = await optional('core/save.js');
    if (!mod) return assert.fail('core/save.js missing');
    for (const fn of ['serialize', 'deserialize', 'saveToStorage', 'loadFromStorage', 'listSaves', 'deleteSave']) {
      assert.equal(typeof mod[fn], 'function', `save.${fn} must be a function`);
    }
  });

  test('core/modes.js exposes the mode API', async () => {
    const mod = await optional('core/modes.js');
    if (!mod) return assert.fail('core/modes.js missing');
    for (const fn of ['startMode', 'canSwitchMode', 'availableModes', 'setSpeed', 'setPaused', 'advanceDay']) {
      assert.equal(typeof mod[fn], 'function', `modes.${fn} must be a function`);
    }
  });
});

// ---------------------------------------------------------------------------
describe('purity: rules modules must not import three', () => {
  // The list in core/CONTRACT.md §5 rule 5. It is repeated here so a module
  // that drifts back to importing `three` fails the build.
  const PURE = [
    'core/config.js',
    'core/events.js',
    'core/state.js',
    'core/modes.js',
    'core/save.js',
    'core/stage.js',
    'buildings/catalogue.js',
    'buildings/properties.js',
    'buildings/placement.js',
    'economy/logic.js',
    'mobility/network.js',
    'mobility/traffic.js',
    'population/happiness.js',
    'services/coverage.js',
    'services/services.js',
    'studio/voxels.js',
    'ui/panels.js',
    'ui/toasts.js',
    'ui/camera.js',
    'world/heightfield.js',
  ];
  for (const rel of PURE) {
    test(`${rel} does not import three`, () => {
      const p = join(SRC, rel);
      // A missing module must FAIL, not pass silently: the purity list is
      // only worth anything if every name in it exists.
      assert.ok(existsSync(p), `${rel} is named in the purity list but does not exist`);
      const src = readFileSync(p, 'utf8');
      assert.ok(!/from\s+['"]three['"]/.test(src),
        `${rel} must not import three — its rules must be unit-testable in Node`);
    });
  }

  test('the contract lists every pure module the test enforces', () => {
    const contract = readFileSync(join(SRC, 'core', 'CONTRACT.md'), 'utf8');
    for (const rel of PURE) {
      const name = rel.split('/').pop();
      assert.ok(contract.includes(name),
        `core/CONTRACT.md must name ${name} in its purity list`);
    }
  });
});

// ---------------------------------------------------------------------------
describe('asset integrity', () => {
  test('every catalogue entry points at a real manifest model key', async () => {
    const cat = await optional('buildings/catalogue.js');
    if (!cat) return assert.fail('buildings/catalogue.js missing');
    const manifest = JSON.parse(readFileSync(join(SRC, 'data', 'manifest.json'), 'utf8'));
    const modelKeys = new Set(Object.keys(manifest.models));
    const bad = [];
    for (const def of cat.BUILDING_DEFS) {
      if (def.model === null || def.model === undefined) {
        assert.equal(def.available, false,
          `${def.id} has no model but claims to be available`);
        continue;
      }
      if (!modelKeys.has(def.model)) bad.push(`${def.id} -> ${def.model}`);
    }
    assert.deepEqual(bad, [], `catalogue references ${bad.length} non-existent model keys`);
  });

  test('the manifest licences are ship-safe', () => {
    const manifest = JSON.parse(readFileSync(join(SRC, 'data', 'manifest.json'), 'utf8'));
    for (const [key, rec] of Object.entries(manifest.models)) {
      assert.ok(['CC0-1.0', 'MIT', 'CC0', 'Public Domain'].includes(rec.licence),
        `${key} has licence "${rec.licence}" — the 3D bundle must be ship-safe`);
    }
  });

  test('every manifest model file exists on disk', () => {
    const manifest = JSON.parse(readFileSync(join(SRC, 'data', 'manifest.json'), 'utf8'));
    const pub = join(SRC, '..', 'public');
    const missing = [];
    for (const [key, rec] of Object.entries(manifest.models)) {
      const p = join(pub, rec.file.replace(/^\//, ''));
      if (!existsSync(p)) missing.push(`${key} -> ${rec.file}`);
    }
    assert.deepEqual(missing, [], `${missing.length} manifest model files are missing on disk`);
  });
});

// ---------------------------------------------------------------------------
describe('no placeholder or generated art', () => {
  test('no source file references an asset path outside the manifest', () => {
    const files = readAll(SRC);
    const offenders = [];
    for (const f of files) {
      if (f.includes('data/manifest.json')) continue;
      const src = readFileSync(f, 'utf8');
      // A hard-coded "/assets/models/..." literal bypasses the manifest.
      const m = src.match(/['"]\/assets\/models\/[^'"]+['"]/g);
      if (m) offenders.push(`${relative(SRC, f)}: ${m.join(', ')}`);
    }
    assert.deepEqual(offenders, [],
      'model paths must come from the manifest, not be hard-coded');
  });

  test('no source file references an asset outside the staged packs', () => {
    const files = readAll(SRC);
    const offenders = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      // Allowed: the 3D model bundle, the 2D UI bundle, and the 2D manifest
      // that the UI domain loads at runtime.
      const m = src.match(/['"]\/assets\/(?!models\/|ui\/|ui-assets\.json)[^'"]+['"]/g);
      if (m) offenders.push(`${relative(SRC, f)}: ${m.join(', ')}`);
    }
    assert.deepEqual(offenders, [],
      'asset references must stay inside /assets/models/, /assets/ui/ or /assets/ui-assets.json');
  });
});

// ---------------------------------------------------------------------------
describe('the placement gate (integrator wiring, main.js)', () => {
  /** A buildings domain that records what it was asked to place. */
  function stubBuildings(catalogue) {
    const placed = [];
    return {
      placed,
      catalogue: () => catalogue,
      place(typeId, cx, cz, rot = 0) {
        placed.push({ typeId, cx, cz, rot });
        return { ok: true, reason: null, id: placed.length };
      },
    };
  }

  function stubCtx({ canPlace, catalogue }) {
    const toasts = [];
    const buildings = stubBuildings(catalogue);
    const ctx = {
      domains: {
        buildings,
        economy: canPlace ? { canPlace } : undefined,
      },
      ui: { showToast: (message, kind) => { toasts.push({ message, kind }); } },
    };
    return { ctx, buildings, toasts };
  }

  const CATALOGUE = [
    { id: 'res.house', displayName: 'House', category: 'residential' },
    { id: 'trn.monorail_station', displayName: 'Monorail Station', category: 'transit' },
  ];

  test('a placement the economy allows reaches the buildings domain', async () => {
    const { installPlacementGate } = await import('../src/main.js');
    const { ctx, buildings, toasts } = stubCtx({
      canPlace: () => ({ ok: true, reason: null, cost: 120, required: 1, free: 1 }),
      catalogue: CATALOGUE,
    });
    installPlacementGate(ctx);
    const result = ctx.domains.buildings.place('res.house', 10, 12, 0);
    assert.equal(result.ok, true);
    assert.equal(buildings.placed.length, 1, 'the placement reached BLD');
    assert.deepEqual(buildings.placed[0], { typeId: 'res.house', cx: 10, cz: 12, rot: 0 });
    assert.equal(toasts.length, 0, 'an accepted placement is silent');
  });

  test('a placement refused for lack of a construction slot never reaches BLD', async () => {
    const { installPlacementGate } = await import('../src/main.js');
    const { ctx, buildings, toasts } = stubCtx({
      canPlace: () => ({ ok: false, reason: 'not-enough-slots', cost: 120, required: 2, free: 0 }),
      catalogue: CATALOGUE,
    });
    installPlacementGate(ctx);
    const result = ctx.domains.buildings.place('trn.monorail_station', 10, 12, 0);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'not-enough-slots', 'the reason is reported to the caller');
    assert.equal(buildings.placed.length, 0, 'BLD was NOT asked to place anything');
    assert.equal(toasts.length, 1, 'the player is told');
    assert.equal(toasts[0].kind, 'warn');
    assert.match(toasts[0].message, /slot/i, `the toast explains the slots: "${toasts[0].message}"`);
    assert.match(toasts[0].message, /Monorail Station/, 'the toast names the building');
  });

  test('a placement refused for lack of money is also surfaced', async () => {
    const { installPlacementGate } = await import('../src/main.js');
    const { ctx, buildings, toasts } = stubCtx({
      canPlace: () => ({ ok: false, reason: 'insufficient-funds', cost: 900, required: 0, free: 0 }),
      catalogue: CATALOGUE,
    });
    installPlacementGate(ctx);
    const result = ctx.domains.buildings.place('res.house', 10, 12, 0);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'insufficient-funds');
    assert.equal(buildings.placed.length, 0);
    assert.equal(toasts.length, 1);
    assert.match(toasts[0].message, /coin/i);
  });

  test('an unknown building type is left to the buildings domain', async () => {
    const { installPlacementGate } = await import('../src/main.js');
    const { ctx, buildings } = stubCtx({
      canPlace: () => ({ ok: false, reason: 'not-enough-slots', cost: 0, required: 9, free: 0 }),
      catalogue: CATALOGUE,
    });
    installPlacementGate(ctx);
    ctx.domains.buildings.place('no.such.building', 1, 1, 0);
    assert.equal(buildings.placed.length, 1, 'BLD still gets to report "unknown-building"');
  });

  test('the gate never blocks building when the economy is missing or broken', async () => {
    const { installPlacementGate } = await import('../src/main.js');
    // No economy at all.
    const a = stubCtx({ canPlace: null, catalogue: CATALOGUE });
    installPlacementGate(a.ctx);
    assert.equal(a.ctx.domains.buildings.place('res.house', 1, 1, 0).ok, true);
    assert.equal(a.buildings.placed.length, 1);

    // An economy that throws.
    const b = stubCtx({
      canPlace: () => { throw new Error('boom'); },
      catalogue: CATALOGUE,
    });
    installPlacementGate(b.ctx);
    assert.equal(b.ctx.domains.buildings.place('res.house', 1, 1, 0).ok, true);
    assert.equal(b.buildings.placed.length, 1);
  });

  test('the gate is installed only once', async () => {
    const { installPlacementGate } = await import('../src/main.js');
    const { ctx, buildings } = stubCtx({
      canPlace: () => ({ ok: true, reason: null, cost: 0, required: 1, free: 1 }),
      catalogue: CATALOGUE,
    });
    installPlacementGate(ctx);
    const first = ctx.domains.buildings.place;
    installPlacementGate(ctx);
    assert.equal(ctx.domains.buildings.place, first, 'the gate was not wrapped twice');
    ctx.domains.buildings.place('res.house', 1, 1, 0);
    assert.equal(buildings.placed.length, 1, 'the placement was not duplicated');
  });
});

// ---------------------------------------------------------------------------
describe('the curated 2D art reaches the HUD', () => {
  const MANIFEST_CANDIDATES = [
    join(PUBLIC, 'assets', 'ui-assets.json'),
    join(SRC, 'data', 'ui-assets.json'),
  ];
  const manifestPath = MANIFEST_CANDIDATES.find((p) => existsSync(p));

  test('the HUD looks for the 2D manifest where the build serves it', async () => {
    const hud = await optional('ui/hud.js');
    if (!hud) return assert.fail('ui/hud.js missing');
    assert.ok(Array.isArray(hud.UI_ASSET_CANDIDATES) && hud.UI_ASSET_CANDIDATES.length > 0);
    assert.ok(hud.UI_ASSET_CANDIDATES.includes('/assets/ui-assets.json'),
      'the HUD must look for /assets/ui-assets.json — that is the path the build serves');
  });

  test('every icon in the manifest exists on disk', { skip: !manifestPath && 'no 2D manifest published yet' }, () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.ok(manifest.images && typeof manifest.images === 'object', 'the manifest has an images map');
    const missing = [];
    const excludedWithFile = [];
    for (const [key, rec] of Object.entries(manifest.images)) {
      // The curator may record a candidate it decided NOT to ship. Such an
      // entry must carry no file at all.
      if (rec?.disposition === 'exclude') {
        if (rec?.file) excludedWithFile.push(`${key} -> ${rec.file}`);
        continue;
      }
      if (!rec?.file) { missing.push(`${key}: no file`); continue; }
      const onDisk = join(PUBLIC, rec.file.replace(/^\//, ''));
      if (!existsSync(onDisk)) missing.push(`${key} -> ${rec.file}`);
    }
    assert.deepEqual(excludedWithFile, [], 'an excluded entry must not point at a file');
    assert.deepEqual(missing, [], `${missing.length} manifest icons are missing on disk`);
  });

  test('every icon in the manifest is reachable from a HUD slot', { skip: !manifestPath && 'no 2D manifest published yet' }, async () => {
    const hud = await optional('ui/hud.js');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const slots = Object.values(manifest.images).map((r) => r?.slot).filter(Boolean);
    assert.ok(slots.length > 0, 'the manifest declares slots');
    // Every declared slot must be one the HUD can look up (it matches on the
    // slot name, tolerating a prefix).
    for (const slot of slots) {
      const found = hud.findAssetBySlot(manifest, slot);
      assert.ok(found, `the HUD cannot resolve the manifest slot "${slot}"`);
    }
  });

  test('the 2D art is served as static files under public/assets/ui', { skip: !manifestPath && 'no 2D manifest published yet' }, () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const files = Object.values(manifest.images).map((r) => r?.file).filter(Boolean);
    const outside = files.filter((f) => !f.startsWith('/assets/ui/'));
    assert.deepEqual(outside, [], `icons must live under /assets/ui/: ${outside.slice(0, 3).join(', ')}`);
    assert.ok(existsSync(join(PUBLIC, 'assets', 'ui')), 'public/assets/ui must exist');
  });
});

// ---------------------------------------------------------------------------
describe('the build configuration', () => {
  test('vite.config.js keeps the art static and out of the JS bundle', () => {
    const src = readFileSync(join(GAME, 'vite.config.js'), 'utf8');
    assert.match(src, /assetsInlineLimit:\s*0/,
      'assetsInlineLimit must be 0 — an inlined .glb or .png is a broken asset');
    assert.match(src, /publicDir/,
      'the build must decide what it copies out of public/');
    assert.match(src, /\.(glb|gltf|bin|png)/,
      'the asset extensions must be listed');
  });

  test('the runtime asset folders exist under public/assets', () => {
    for (const dir of ['models', 'ui']) {
      assert.ok(existsSync(join(PUBLIC, 'assets', dir)), `public/assets/${dir} must exist`);
    }
  });

  test('the raw library archives are NOT part of the runtime asset set', () => {
    // They are source material. If they ever end up in the runtime set the
    // bundle grows by ~560 MB.
    const src = readFileSync(join(GAME, 'vite.config.js'), 'utf8');
    assert.ok(!/RUNTIME_DIRS\s*=\s*\[[^\]]*extracted/.test(src),
      'the extracted library trees must not be copied into dist/');
  });

  test("the build never deletes Vite's own bundle output", () => {
    // `dist/assets/` is BOTH Vite's asset directory (the hashed entry chunk)
    // and the destination for the runtime assets. Wiping it deleted the
    // bundle and the production build booted to a 404.
    const src = readFileSync(join(GAME, 'vite.config.js'), 'utf8');
    assert.ok(!/remove\s*\(\s*dest\s*,/.test(src),
      "the build must not wipe dist/assets — that is Vite's own output directory");
    assert.match(src, /verifyDistEntry/,
      'the build must verify that dist/index.html references only files that exist');
  });

  test('the licence policy is a deliberate act, and both paths are declared', () => {
    const src = readFileSync(join(GAME, 'vite.config.js'), 'utf8');
    assert.match(src, /SC_SHIP_CLEARED/,
      'the cleared build must be selectable');
    assert.match(src, /LICENCE-STATUS/, 'every build must state its licence status');
    assert.match(src, /applyLicencePolicy/,
      'the licence policy must actually run at the end of the build');

    const pkg = JSON.parse(readFileSync(join(GAME, 'package.json'), 'utf8'));
    assert.ok(pkg.scripts['build:cleared'], 'npm run build:cleared must exist');
    assert.match(pkg.scripts['build:cleared'], /SC_SHIP_CLEARED=1/,
      'build:cleared must set the cleared flag');
  });

  test('the 2D art manifest records every image as unverified', () => {
    // The whole point of the licence policy: nothing in the 2D set has been
    // cleared, and the manifest must say so for EVERY image.
    const manifest = JSON.parse(
      readFileSync(join(GAME, 'src', 'data', 'ui-assets.json'), 'utf8'),
    );
    const entries = Object.entries(manifest.images ?? {});
    assert.ok(entries.length > 0, 'the 2D manifest must not be empty');
    for (const [slot, rec] of entries) {
      assert.equal(rec.licence, 'unverified',
        `${slot} must be recorded as unverified until the licence pass says otherwise`);
    }
  });
});

// ---------------------------------------------------------------------------
function makeStubCtx() {
  const noop = () => {};
  const bus = { on: () => noop, off: () => false, once: () => noop, emit: noop };
  const state = {
    meta: { seed: 1, mode: 'play', stageId: 'stage-1', stageIndex: 0, day: 1, tick: 0, elapsed: 0, speed: 2, paused: false, score: 0, ready: false },
    world: { heightmap: null, water: null, types: null, waterLevel: 0, scenery: [], modified: 0, seed: 1 },
    economy: { treasury: 1000, budget: {}, ledger: [], lastIncome: 0, lastUpkeep: 0, month: 1, revenue: 0, expenditure: 0 },
    population: { total: 0, happiness: 60, loyalty: 50, households: 0, needs: {}, citizens: [], migration: 0, employed: 0, unemployed: 0 },
    services: { coverage: {}, cityCoverage: {}, facilities: [] },
    mobility: { network: { nodes: new Map(), edges: 0 }, vehicles: [], activeVehicles: 0, congestion: 0, averageCommute: 0, routes: [] },
    buildings: { instances: new Map(), nextId: 1, zones: new Map(), catalogue: new Map() },
    studio: { open: false, voxels: new Map(), doc: null, dirty: false, palette: [], brush: 1 },
    ui: { tool: 'inspect', hover: null, selection: null, panel: null, camera: { x: 0, z: 0, distance: 66, yaw: 0.78, pitch: 0.96 }, toasts: [], speed: 2, muted: false },
  };
  const group = { add: noop, remove: noop, children: [], clear: noop };
  const renderer = {
    scene: group, camera: {}, renderer: {}, clock: {},
    world: group, actors: group, overlay: group,
    add: noop, remove: noop, clearWorld: noop, resize: noop, start: noop, stop: noop,
    screenToGround: () => null, screenToObjects: () => null,
    focusOn: noop, setDistance: noop, getDistance: () => 66,
    setYaw: noop, rotateYaw: noop, getYaw: () => 0.78, setPitch: noop, getPitch: () => 0.96,
    update: noop,
  };
  const assets = {
    loadModel: async () => null, loadCharacter: async () => null,
    getModel: () => null, getCharacter: () => null,
    preload: async () => ({ loaded: 0, total: 0, failures: [] }),
    isReady: () => true, manifest: { models: {}, characters: {} }, keysByFamily: () => ({}),
  };
  return {
    state, bus, assets, renderer, config: {}, manifest: assets.manifest,
    rng: () => 0.5, domains: {}, ui: null,
  };
}
