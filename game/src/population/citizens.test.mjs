/**
 * population/citizens.test.mjs — the POP citizen VIEW tests.
 *
 * Run with:  node --test src/population/citizens.test.mjs
 *
 * The point of this file is the CLONING question: a city needs many citizens
 * from one loaded character, and cloning a rigged mesh can break the skeleton
 * binding. These tests prove, against the REAL Knight.glb of the library:
 *
 *   1. `Object3D.clone(true)` SHARES the source skeleton - the clone's own
 *      mixer animates bones the skin never reads, so the skin does NOT move.
 *   2. `SkeletonUtils.clone()` rebuilds the skeleton against the clone's own
 *      bones - the skin DOES deform.
 *   3. every character the module uses really exists in the manifest, really
 *      has a walk clip and an idle clip, and can really play the five
 *      animation states (idle, walk, run, cheer, flee).
 *   4. the manager wires the machine, the terrain height and the pool the way
 *      the V5 upgrade asks for.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as THREE from 'three';
import {
  CHARACTER_KEYS,
  CITY_CHARACTER_KEYS,
  CLASSIC_CHARACTER_KEYS,
  MAX_RENDERED_CITIZENS,
  createCitizens,
  skinBindingReport,
} from './citizens.js';
import { STATE_CLIP_CANDIDATES, createAnimationMachine } from './animation.js';

/** The manifest, read from disk (Node needs an import attribute for JSON). */
const manifest = JSON.parse(
  readFileSync(new URL('../data/manifest.json', import.meta.url), 'utf8'),
);

/** Minimal DOM stub so GLTFLoader can "load" the embedded PNG. */
function installDomStub() {
  globalThis.self = globalThis;
  globalThis.document = {
    createElementNS(_ns, tag) {
      if (tag !== 'img') {
        return { style: {}, addEventListener() {}, removeEventListener() {} };
      }
      const img = { width: 64, height: 64 };
      img.addEventListener = (type, cb) => {
        if (type === 'load') setTimeout(() => cb.call(img, { target: img }), 0);
      };
      img.removeEventListener = () => {};
      Object.defineProperty(img, 'src', {
        set(v) { this._src = v; setTimeout(() => img.onload && img.onload({ target: img }), 0); },
        get() { return this._src; },
      });
      return img;
    },
  };
}

// The DOM stub stays installed for the whole file: the GLB's textures are
// fetched asynchronously AFTER the parse resolves, so restoring the globals
// in a finally block would break the texture load.
installDomStub();

/** Load the real Knight.glb of the library. */
async function loadKnight() {
  const url = new URL('../../public/assets/models/characters/Knight.glb', import.meta.url);
  let buf;
  try {
    buf = readFileSync(url);
  } catch {
    return null;
  }
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
}

/** The first skinned mesh of a character. */
function firstSkin(root) {
  let skin = null;
  root.traverse((o) => { if (o.isSkinnedMesh && !skin) skin = o; });
  return skin;
}

/** The world position of a vertex after the skinning, in bind space. */
function skinnedPosition(root, skin, index = 0) {
  root.updateMatrixWorld(true);
  skin.skeleton.update();
  const target = new THREE.Vector3();
  skin.applyBoneTransform(index, target);
  return target;
}

// ---------------------------------------------------------------------------
// 1. The characters of the library
// ---------------------------------------------------------------------------

test('every character the citizens use really exists in the manifest', () => {
  assert.equal(CHARACTER_KEYS.length, 20, 'the twenty rigged characters');
  assert.equal(CITY_CHARACTER_KEYS.length, 14, 'the city crowd');
  assert.equal(CLASSIC_CHARACTER_KEYS.length, 6, 'the adventurers');
  assert.equal(CHARACTER_KEYS.length, CITY_CHARACTER_KEYS.length + CLASSIC_CHARACTER_KEYS.length);
  for (const key of CHARACTER_KEYS) {
    assert.ok(manifest.characters[key], `"${key}" is in the manifest`);
    const rec = manifest.characters[key];
    assert.ok(rec.file.endsWith('.glb'), `"${key}" points at a real glb`);
    assert.ok(Array.isArray(rec.animations) && rec.animations.length > 0, `"${key}" has clips`);
  }
});

test('every character really has a walk clip and an idle clip', () => {
  for (const key of CHARACTER_KEYS) {
    const clips = manifest.characters[key].animations;
    assert.ok(clips.includes('Idle'), `"${key}" has an Idle clip`);
    const walk = clips.find((c) => /walk/i.test(c));
    assert.ok(walk, `"${key}" has a walk clip (${walk})`);
  }
});

test('the city crowd has the clips a modern city needs', () => {
  for (const key of CITY_CHARACTER_KEYS) {
    const clips = manifest.characters[key].animations;
    assert.ok(clips.includes('Idle'), `"${key}" has an Idle clip`);
    assert.ok(clips.includes('Walk'), `"${key}" has a Walk clip`);
    assert.ok(clips.includes('Run'), `"${key}" has a Run clip`);
    assert.ok(clips.includes('Victory'), `"${key}" has a Victory clip to cheer with`);
  }
});

test('every character of the roster can play all five animation states', () => {
  for (const key of CHARACTER_KEYS) {
    const machine = createAnimationMachine({ clips: manifest.characters[key].animations });
    for (const state of Object.keys(STATE_CLIP_CANDIDATES)) {
      const clip = machine.clipFor(state);
      assert.ok(clip, `"${key}" can play "${state}" (${clip ?? 'no clip'})`);
      assert.equal(machine.resolveState(state), state, `"${key}" never falls back to idle`);
    }
  }
});

test('a character without a walk clip falls back to idle', () => {
  const machine = createAnimationMachine({ clips: ['Idle', 'Defeat'] });
  assert.equal(machine.clipFor('walk'), null);
  assert.equal(machine.resolveState('walk'), 'idle');
});

// ---------------------------------------------------------------------------
// 2. The cloning
// ---------------------------------------------------------------------------

test('a plain clone shares the source skeleton and its skin does NOT deform', async (t) => {
  const gltf = await loadKnight();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  {
    const root = gltf.scene;
    const skin = firstSkin(root);
    assert.ok(skin, 'Knight.glb has a skinned mesh');

    const plain = root.clone(true);
    const plainSkin = firstSkin(plain);
    assert.equal(plainSkin.skeleton, skin.skeleton, 'the plain clone SHARES the source skeleton');

    // A mixer on the clone drives the CLONE's bones; the skin reads the
    // SOURCE's bones, so nothing on the skin moves.
    const mixer = new THREE.AnimationMixer(plain);
    const walk = gltf.animations.find((c) => /walk/i.test(c.name));
    assert.ok(walk, 'Knight.glb has a walk clip');
    mixer.clipAction(walk).play();

    const before = skinnedPosition(plain, plainSkin);
    mixer.update(0.5);
    const after = skinnedPosition(plain, plainSkin);
    assert.ok(
      before.distanceTo(after) < 1e-9,
      `the broken clone does not deform (${before.distanceTo(after)})`,
    );

    const report = skinBindingReport(plain);
    assert.equal(report.skinned, true);
    assert.equal(report.ownBones, false, 'the report sees the shared skeleton');
    assert.equal(report.shared, true);
  }
});

test('the skeleton-safe clone rebinds the skin and the skin DOES deform', async (t) => {
  const gltf = await loadKnight();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  {
    const { clone: skClone } = await import('three/examples/jsm/utils/SkeletonUtils.js');
    const root = gltf.scene;
    const skin = firstSkin(root);

    const fixed = skClone(root);
    const fixedSkin = firstSkin(fixed);
    assert.notEqual(fixedSkin.skeleton, skin.skeleton, 'the rebuilt skeleton is not shared');
    assert.equal(
      fixedSkin.skeleton.bones[0],
      fixed.getObjectByName(skin.skeleton.bones[0].name),
      'the rebuilt skeleton points at the CLONE own bone',
    );

    const report = skinBindingReport(fixed);
    assert.equal(report.ownBones, true, 'the report sees the own bones');
    assert.equal(report.shared, false);

    // THE PROOF: the mixer moves the clone's own bones and the skin follows.
    const mixer = new THREE.AnimationMixer(fixed);
    const walk = gltf.animations.find((c) => /walk/i.test(c.name));
    mixer.clipAction(walk).play();

    const before = skinnedPosition(fixed, fixedSkin);
    mixer.update(0.5);
    const after = skinnedPosition(fixed, fixedSkin);
    assert.ok(
      before.distanceTo(after) > 1e-4,
      `the skin deforms (${before.distanceTo(after)} world units)`,
    );

    // The clone's own bones moved too - the rig is alive.
    const bones = fixedSkin.skeleton.bones;
    const boneMatrices = bones.map((b) => b.matrixWorld.clone());
    mixer.update(0.5);
    fixed.updateMatrixWorld(true);
    const moved = bones.filter((b, i) => !boneMatrices[i].equals(b.matrixWorld)).length;
    assert.ok(moved > 0, `the clone own bones are animated (${moved} of ${bones.length})`);
  }
});

test('several clones animate independently', async (t) => {
  const gltf = await loadKnight();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  {
    const { clone: skClone } = await import('three/examples/jsm/utils/SkeletonUtils.js');
    const a = skClone(gltf.scene);
    const b = skClone(gltf.scene);
    const skinA = firstSkin(a);
    const skinB = firstSkin(b);
    assert.notEqual(skinA.skeleton, skinB.skeleton, 'each clone owns its skeleton');
    assert.notEqual(skinA.skeleton.bones[0], skinB.skeleton.bones[0], 'each clone owns its bones');

    const walk = gltf.animations.find((c) => /walk/i.test(c.name));
    const mixerA = new THREE.AnimationMixer(a);
    const mixerB = new THREE.AnimationMixer(b);
    mixerA.clipAction(walk).play();
    mixerB.clipAction(walk).play();

    // The same clip, the same time - the two clones must agree.
    mixerA.update(0.4);
    mixerB.update(0.4);
    const pa = skinnedPosition(a, skinA);
    const pb = skinnedPosition(b, skinB);
    assert.ok(pa.distanceTo(pb) < 1e-6, 'two clones of the same character agree');

    // And they must not share the bones: moving one must not move the other.
    const boneBBefore = skinB.skeleton.bones[0].quaternion.clone();
    mixerA.update(0.4);
    assert.ok(
      boneBBefore.angleTo(skinB.skeleton.bones[0].quaternion) < 1e-9,
      'animating one clone does not move the other',
    );
  }
});

// ---------------------------------------------------------------------------
// 3. The manager: the machine, the terrain and the pool
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
  };
}

/**
 * A context with the real Knight model behind the fake asset service.
 */
async function makeCtx() {
  const gltf = await loadKnight();
  const actors = new THREE.Group();
  const bus = fakeBus();
  const ctx = {
    renderer: { actors },
    assets: {
      loadCharacter: async () => ({ model: gltf.scene, clips: gltf.animations }),
    },
    rng: () => 0.5,
    bus,
    state: { population: { happiness: 60 } },
    domains: { wld: { heightAt: () => 3.5 } },
  };
  return { ctx, bus, actors, gltf };
}

/** The actions of a mixer that are really playing. */
function runningActions(mixer) {
  const actions = mixer?._actions ?? [];
  return actions.filter((a) => a.isRunning());
}

test('a walking citizen plays the walk state and stands on the terrain', async (t) => {
  const { ctx, gltf } = await makeCtx();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  const citizens = createCitizens(ctx);
  await citizens.preload();

  const citizen = citizens.spawn({ from: { x: 10, z: 10 }, to: { x: 20, z: 20 } });
  assert.ok(citizen, 'the citizen is spawned');
  assert.equal(citizens.count(), 1);

  citizens.update(0.1);
  assert.equal(citizen.state, 'walk', 'a moving citizen walks');
  assert.equal(citizen.model.position.y, 3.5, 'the citizen stands on the terrain');
});

test('the terrain is re-sampled while the citizen walks', async (t) => {
  const { ctx, gltf } = await makeCtx();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  let height = 1;
  ctx.domains.wld.heightAt = () => height;

  const citizens = createCitizens(ctx);
  await citizens.preload();
  const citizen = citizens.spawn({ from: { x: 10, z: 10 }, to: { x: 20, z: 20 } });
  citizens.update(0.1);
  assert.equal(citizen.model.position.y, 1);

  height = 7.5;
  citizens.update(0.1);
  assert.equal(citizen.model.position.y, 7.5, 'the citizen follows the ground');
});

test('without a world domain the citizen keeps the old behaviour', async (t) => {
  const { ctx, gltf } = await makeCtx();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  delete ctx.domains;

  const citizens = createCitizens(ctx);
  await citizens.preload();
  const citizen = citizens.spawn({ from: { x: 10, z: 10 }, to: { x: 20, z: 20 } });
  citizens.update(0.1);
  assert.equal(citizen.model.position.y, 0, 'no terrain, no height');
  assert.equal(citizen.state, 'walk');
});

test('only ONE action plays at a time, and the old one is stopped', async (t) => {
  const { ctx, bus, gltf } = await makeCtx();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  const citizens = createCitizens(ctx);
  await citizens.preload();
  const citizen = citizens.spawn({ from: { x: 10, z: 10 }, to: { x: 20, z: 20 } });

  citizens.update(0.1);
  citizens.update(0.1);
  citizens.update(0.1);
  assert.equal(runningActions(citizen.rig.mixer).length, 1, 'the walk clip plays alone');

  // A hazard starts: the citizen panics and the clips crossfade.
  bus.emit('hazard:started', { id: 'h1', type: 'fire', x: 10, z: 10, radius: 4 });
  citizens.update(0.1);
  assert.equal(citizen.state, 'flee', 'the citizen panics');

  citizens.update(0.1);
  citizens.update(0.1);
  citizens.update(0.1);
  assert.equal(runningActions(citizen.rig.mixer).length, 1, 'the old action is stopped');
});

test('a hazard makes the citizen flee and its end calms it down', async (t) => {
  const { ctx, bus, gltf } = await makeCtx();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  const citizens = createCitizens(ctx);
  await citizens.preload();
  const citizen = citizens.spawn({ from: { x: 10, z: 10 }, to: { x: 20, z: 20 } });
  citizens.update(0.1);
  assert.equal(citizen.state, 'walk');

  bus.emit('hazard:started', { id: 'h1', type: 'fire', x: 10, z: 10, radius: 4 });
  citizens.update(0.1);
  assert.equal(citizen.state, 'flee');

  bus.emit('hazard:resolved', { id: 'h1', outcome: 'contained' });
  citizens.update(0.1);
  assert.equal(citizen.state, 'walk', 'the citizen calms down');
});

test('without a bus nothing ever panics', async (t) => {
  const { ctx, gltf } = await makeCtx();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  delete ctx.bus;

  const citizens = createCitizens(ctx);
  await citizens.preload();
  const citizen = citizens.spawn({ from: { x: 10, z: 10 }, to: { x: 20, z: 20 } });
  for (let i = 0; i < 10; i += 1) citizens.update(0.1);
  assert.equal(citizen.state, 'walk', 'no bus, no panic');
});

test('a happy city cheers the citizens that stand still', async (t) => {
  const { ctx, gltf } = await makeCtx();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  ctx.state.population.happiness = 90;

  const citizens = createCitizens(ctx);
  await citizens.preload();
  const citizen = citizens.spawn({ from: { x: 10, z: 10 }, to: { x: 14, z: 10 } });

  let state = citizen.state;
  for (let i = 0; i < 400 && state !== 'cheer'; i += 1) {
    citizens.update(0.1);
    state = citizen.state;
  }
  assert.equal(state, 'cheer', 'a happy citizen celebrates');
});

test('a despawned citizen goes back to the pool and is reused', async (t) => {
  const { ctx, actors, gltf } = await makeCtx();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  const citizens = createCitizens(ctx);
  await citizens.preload();

  const citizen = citizens.spawn({ from: { x: 10, z: 10 }, to: { x: 20, z: 20 } });
  const model = citizen.model;
  citizens.update(0.1);
  assert.equal(actors.children.length, 1, 'the citizen is in the scene');

  assert.equal(citizens.despawn(), true);
  assert.equal(citizens.count(), 0);
  assert.equal(actors.children.length, 0, 'the citizen left the scene');
  const stats = citizens.poolStats();
  assert.equal(stats.free, 1, 'the rig waits in the pool');
  assert.equal(stats.live, 0);
  assert.equal(stats.hits, 0);
  assert.equal(stats.misses, 1, 'one rig was built');

  const again = citizens.spawn({ from: { x: 30, z: 30 }, to: { x: 40, z: 40 } });
  assert.equal(again.model, model, 'the very same rig is reused');
  assert.equal(citizens.poolStats().hits, 1, 'the reuse is a hit');
  assert.equal(actors.children.length, 1, 'the citizen is back in the scene');
});

test('the number of rendered citizens is capped', async (t) => {
  const { ctx, gltf } = await makeCtx();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  const citizens = createCitizens(ctx);
  await citizens.preload();
  for (let i = 0; i < MAX_RENDERED_CITIZENS + 5; i += 1) {
    citizens.spawn({ from: { x: 1, z: 1 }, to: { x: 2, z: 2 } });
  }
  assert.equal(citizens.count(), MAX_RENDERED_CITIZENS);
  assert.equal(citizens.spawn({ from: { x: 1, z: 1 }, to: { x: 2, z: 2 } }), null);
});

test('disposing the citizens tears everything down', async (t) => {
  const { ctx, actors, gltf } = await makeCtx();
  if (!gltf) {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }
  const citizens = createCitizens(ctx);
  await citizens.preload();
  citizens.spawn({ from: { x: 10, z: 10 }, to: { x: 20, z: 20 } });
  citizens.update(0.1);

  citizens.dispose();
  assert.equal(citizens.count(), 0);
  assert.equal(actors.children.length, 0, 'nothing is left in the scene');
  assert.equal(citizens.spawn({ from: { x: 1, z: 1 } }), null, 'a disposed manager spawns nothing');
});
