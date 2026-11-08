/**
 * Generator tests — the generated code must be real, runnable ES module
 * code. Every generated file is written to a temporary .mjs file and checked
 * with `node --check`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { V4_ROOT } from '../src/assets/catalogue.js';
import { createEventBus, Events } from '../src/core/events.js';
import { createWorld } from '../src/core/ecs.js';
import {
  generateAnimationController,
  generateComponent,
  generateNpcBehaviour,
  generateProject,
  generateScene,
  generateTests,
  importPrefix,
} from '../src/ai/generators.js';

/** Can this runtime run `node --check`? */
function nodeAvailable() {
  try {
    execFileSync(process.execPath, ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const CAN_CHECK = nodeAvailable();

/**
 * Write a generated file to a temp .mjs file and check it parses.
 * @returns {boolean} true when the file parsed cleanly
 */
function parsesCleanly(content, name = 'generated.mjs') {
  const dir = mkdtempSync(join(tmpdir(), 'v4-gen-'));
  try {
    const file = join(dir, name);
    writeFileSync(file, content, 'utf8');
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    return true;
  } catch (err) {
    assert.fail(`generated code does not parse:\n${(err.stderr || err.stdout || '').toString()}`);
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('every generated project file parses as an ES module', { skip: !CAN_CHECK && 'node is unavailable' }, () => {
  const result = generateProject({ name: 'demo', template: 'minimal' });
  assert.ok(result.files.length >= 5);
  for (const file of result.files) {
    if (!file.path.endsWith('.js') && !file.path.endsWith('.mjs')) continue;
    parsesCleanly(file.content, file.path.replace(/[\\/]/g, '_') + '.mjs');
  }
});

test('a generated project is deterministic', () => {
  const first = generateProject({ name: 'demo', template: 'platformer' });
  const second = generateProject({ name: 'demo', template: 'platformer' });
  assert.deepEqual(
    first.files.map((f) => [f.path, f.content]),
    second.files.map((f) => [f.path, f.content]),
  );
});

test('a generated project contains the entry point, the scene and the tests', () => {
  const result = generateProject({ name: 'demo', template: 'minimal' });
  const paths = result.files.map((f) => f.path);
  assert.ok(paths.includes('package.json'));
  assert.ok(paths.includes('index.html'));
  assert.ok(paths.includes('src/main.js'));
  assert.ok(paths.includes('src/scenes/demo.js'));
  assert.ok(paths.includes('tests/ecs.test.mjs'));
});

test('the generated project supports every documented template', () => {
  for (const template of ['minimal', 'platformer', 'sandbox']) {
    const result = generateProject({ name: 'demo', template });
    assert.ok(result.files.length > 0);
    assert.ok(result.notes.length > 0);
  }
});

test('an unknown template falls back to the minimal one', () => {
  const unknown = generateProject({ name: 'demo', template: 'does-not-exist' });
  const minimal = generateProject({ name: 'demo', template: 'minimal' });
  assert.deepEqual(unknown.files.map((f) => f.path), minimal.files.map((f) => f.path));
});

test('generated code imports the V4 core through the right relative path', () => {
  const result = generateScene({
    name: 'level1',
    entities: [{ name: 'Ground', tags: ['static'], components: { mesh: { kind: 'box' } } }],
  });
  const file = result.files[0];
  assert.match(file.content, /from '\.\.\/\.\.\/\.\.\/\.\.\/src\/core\/ecs\.js'/);

  // The prefix really points at the engine source.
  const prefix = importPrefix('generated/level1', file.path);
  assert.equal(resolve(V4_ROOT, 'generated/level1/src/scenes', prefix, 'core/ecs.js'), resolve(V4_ROOT, 'src/core/ecs.js'));
});

test('a generated scene creates its entities through the registry defaults', { skip: !CAN_CHECK && 'node is unavailable' }, () => {
  const result = generateScene({
    name: 'level1',
    entities: [
      { name: 'Ground', tags: ['static'], components: { transform: { position: [0, -1, 0] } } },
      { name: 'Player', tags: ['player'], components: { transform: { position: [0, 1, 0] }, player: { speed: 5 } } },
    ],
  });
  const content = result.files[0].content;
  assert.match(content, /add\("Ground"/);
  assert.match(content, /add\("Player"/);
  assert.match(content, /registry\.registerBuiltins\(\)/);
  parsesCleanly(content, 'scene.mjs');
});

test('a generated component registers itself and round-trips', { skip: !CAN_CHECK && 'node is unavailable' }, () => {
  const result = generateComponent({
    name: 'health',
    fields: [
      { name: 'current', type: 'number', default: 100 },
      { name: 'label', type: 'string', default: 'hp' },
    ],
  });
  const content = result.files[0].content;
  assert.match(content, /COMPONENT_TYPE = "health"/);
  assert.match(content, /registry\.register\(COMPONENT_TYPE/);
  assert.match(content, /"current": 100/);
  assert.match(content, /"label": "hp"/);
  parsesCleanly(content, 'component.mjs');
});

test('a generated animation controller uses the real animator', { skip: !CAN_CHECK && 'node is unavailable' }, () => {
  const result = generateAnimationController({
    name: 'hero',
    states: {
      idle: { clips: ['Idle'], loop: true },
      run: { clips: ['Run', 'Running_A'] },
    },
  });
  const content = result.files[0].content;
  assert.match(content, /from '\.\.\/\.\.\/\.\.\/\.\.\/src\/anim\/animator\.js'/);
  assert.match(content, /createAnimator\(/);
  assert.match(content, /"Run", "Running_A"/);
  parsesCleanly(content, 'anim.mjs');
});

test('a generated NPC behaviour is a real state machine', { skip: !CAN_CHECK && 'node is unavailable' }, () => {
  const result = generateNpcBehaviour({
    name: 'guard',
    states: [{ name: 'idle', speed: 0, sight: 0 }, { name: 'patrol', speed: 2, sight: 0 }],
  });
  const content = result.files[0].content;
  assert.match(content, /setState/);
  assert.match(content, /Events\.NPC_STATE/);
  assert.match(content, /from '\.\.\/\.\.\/\.\.\/\.\.\/src\/core\/events\.js'/);
  parsesCleanly(content, 'npc.mjs');
});

test('a generated test module uses node:test', { skip: !CAN_CHECK && 'node is unavailable' }, () => {
  const result = generateTests({ moduleName: 'ecs' });
  const content = result.files[0].content;
  assert.match(content, /import test from 'node:test'/);
  assert.match(content, /import assert from 'node:assert\/strict'/);
  assert.match(content, /createWorld/);
  parsesCleanly(content, 'ecs.test.mjs');
});

test('a generated test module for an unknown module is still a real test', { skip: !CAN_CHECK && 'node is unavailable' }, () => {
  const result = generateTests({ moduleName: 'mystery-module' });
  const content = result.files[0].content;
  assert.match(content, /await import\('\.\.\/src\/mystery-module\.js'\)/);
  parsesCleanly(content, 'mystery.test.mjs');
});

test('the generators return notes alongside the files', () => {
  assert.ok(generateProject({ name: 'demo' }).notes.length > 0);
  assert.ok(generateScene({ name: 'x' }).notes.length > 0);
  assert.ok(generateComponent({ name: 'x' }).notes.length > 0);
  assert.ok(generateAnimationController({ name: 'x' }).notes.length > 0);
  assert.ok(generateNpcBehaviour({ name: 'x' }).notes.length > 0);
  assert.ok(generateTests({ moduleName: 'ecs' }).notes.length > 0);
});

test('the generated package.json is valid JSON and the html references the entry point', () => {
  const result = generateProject({ name: 'demo' });
  const pkg = result.files.find((f) => f.path === 'package.json');
  const parsed = JSON.parse(pkg.content);
  assert.equal(parsed.name, 'demo');
  assert.equal(parsed.type, 'module');
  assert.equal(parsed.scripts.test, 'node --test tests/');

  const html = result.files.find((f) => f.path === 'index.html');
  assert.match(html.content, /src\/main\.js/);
});

test('the generated entry point boots the scene', { skip: !CAN_CHECK && 'node is unavailable' }, () => {
  const result = generateProject({ name: 'demo' });
  const main = result.files.find((f) => f.path === 'src/main.js');
  assert.match(main.content, /export function boot\(\)/);
  assert.match(main.content, /createDemoScene/);
  parsesCleanly(main.content, 'main.mjs');
});

test('the generated files are readable as UTF-8 text', () => {
  const result = generateProject({ name: 'demo' });
  for (const file of result.files) {
    assert.equal(typeof file.content, 'string');
    assert.ok(file.content.length > 0, `${file.path} must not be empty`);
  }
});

/* ------------------------------------------------- the generated code runs */

/** Write a generated file into a temporary project and import it. */
async function importGenerated(makeResult, fileIndex = 0) {
  // The realpath matters: macOS puts /tmp behind a symlink and the import
  // prefix has to be computed from the path the loader will actually use.
  const projectRoot = realpathSync(mkdtempSync(join(tmpdir(), 'v4-gen-project-')));
  const result = makeResult(projectRoot);
  const file = result.files[fileIndex];
  const target = join(projectRoot, file.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.content, 'utf8');
  const module = await import(pathToFileURL(target).href);
  return { projectRoot, module };
}

test('a generated scene module runs against the real engine', async () => {
  const { module } = await importGenerated((projectRoot) => generateScene({
    name: 'level1',
    entities: [
      { name: 'Ground', tags: ['static'], components: { transform: { position: [0, -1, 0] } } },
      { name: 'Player', tags: ['player'], components: { transform: { position: [0, 1, 0] }, player: { speed: 5 } } },
    ],
    projectRoot,
  }));
  const { world, registry, sceneName } = module.createLevel1Scene();

  assert.equal(sceneName, 'level1');
  assert.equal(world.entityCount, 2);
  assert.equal(world.query('player').length, 1);
  assert.equal(world.query('transform').length, 2);
  assert.equal(registry.has('mesh'), true);
});

test('a generated component module registers and round-trips', async () => {
  const { module } = await importGenerated((projectRoot) => generateComponent({
    name: 'health',
    fields: [{ name: 'current', type: 'number', default: 100 }],
    projectRoot,
  }));
  const registry = module.registerHealthComponent();
  assert.equal(registry.has('health'), true);

  const data = module.createHealthComponent({ current: 42 });
  assert.equal(data.current, 42);

  const raw = registry.serializeComponent('health', data);
  assert.deepEqual(raw, { current: 42 });
  assert.deepEqual(registry.deserializeComponent('health', raw), { current: 42 });
});

test('a generated NPC behaviour module runs against the real engine', async () => {
  const { module } = await importGenerated((projectRoot) => generateNpcBehaviour({
    name: 'guard',
    states: [{ name: 'idle', speed: 0, sight: 0 }, { name: 'patrol', speed: 2, sight: 8 }],
    projectRoot,
  }));
  const world = createWorld();
  const bus = createEventBus();
  const entity = world.createEntity({ name: 'Guard', tags: ['npc'] });
  world.addComponent(entity.id, 'transform', { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });

  const guard = module.createGuardBehaviour({ world, bus, entityId: entity.id });
  assert.equal(guard.state, 'idle');
  assert.deepEqual(guard.states().sort(), ['attack', 'chase', 'idle', 'patrol']);

  // A target inside the sight radius moves the guard into the chase state.
  guard.update(0.016, { distance: 3 });
  assert.equal(guard.state, 'chase');
  assert.equal(bus.history(Events.NPC_STATE).length, 1);
  assert.equal(bus.history(Events.NPC_STATE)[0].payload.to, 'chase');

  // And the chase state moves the entity.
  const before = world.getComponent(entity.id, 'transform').position.slice();
  guard.update(0.5, { distance: 3, direction: [1, 0, 0] });
  const after = world.getComponent(entity.id, 'transform').position;
  assert.ok(after[0] > before[0], 'the guard should have moved');

  // Losing the target sends it back to idle.
  guard.update(0.016, { distance: 100 });
  assert.equal(guard.state, 'idle');
});

test('a generated animation controller module exports its states', async () => {
  const { module } = await importGenerated((projectRoot) => generateAnimationController({
    name: 'hero',
    states: { idle: { clips: ['Idle'] }, run: { clips: ['Run'] } },
    projectRoot,
  }));
  assert.deepEqual(Object.keys(module.HERO_STATES), ['idle', 'run']);
  assert.deepEqual(module.HERO_STATES.run.clips, ['Run']);
  assert.equal(typeof module.createHeroController, 'function');
  assert.equal(module.STATE_EVENT, Events.ANIMATION_STATE);
});
