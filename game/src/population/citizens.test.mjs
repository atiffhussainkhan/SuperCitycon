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
 *   3. every character the module uses really exists in the manifest and
 *      really has a walk clip and an idle clip.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as THREE from 'three';
import { CHARACTER_KEYS, skinBindingReport } from './citizens.js';

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
  assert.equal(CHARACTER_KEYS.length, 6, 'the six rigged characters');
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
