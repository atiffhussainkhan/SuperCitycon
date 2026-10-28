/**
 * render/tec.test.mjs — TEC domain unit tests.
 *
 * OWNERSHIP: TEC. Run with:
 *   node --test src/render/tec.test.mjs
 *
 * These are PURE-LOGIC tests: no DOM, no WebGL context, no dev server.
 * Where a real asset is needed (the rigged-character clone check) a minimal
 * DOM stub is installed for the duration of that one test and removed again.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

import { PALETTE, worldToCellInt, inBounds } from '../core/config.js';
import {
  paletteTextureBytes, paletteRgbList, paletteTexture, voxelMaterial,
  outlineMaterial, selectionMaterial, waterMaterial, emissiveMaterial,
  disposeMaterials, TOON_STEPS,
} from './materials.js';
import {
  SKY_KEYFRAMES, skyColorsAt, sunDirection, lerpHex, wrap01, createSky,
} from './sky.js';
import {
  ADAPTIVE_DEFAULTS, QUALITY_LEVELS, evaluateAdaptiveQuality,
  createPerformanceMonitor, makeInstanced, makeInstancedBatch, composeInstanceMatrix,
  instancedParts, setInstanceCount, disposeInstancedBatch,
  enableInstancing, mergeStaticMeshes,
} from './performance.js';
import { quantiseColour, nearestPaletteIndex, buildPaletteLut, createPostFX } from './postfx.js';
import { cellCenter } from './renderer.js';
import {
  SOUND_NAMES, SOUND_LIBRARY, BUS_NAMES, listSounds, createAudio,
} from '../audio/audio.js';

// ---------------------------------------------------------------------------
// 1. The palette texture builder's byte layout
// ---------------------------------------------------------------------------

test('palette texture builder produces a stable RGBA8 layout', () => {
  const { width, height, data, names } = paletteTextureBytes();

  assert.equal(width, 8, 'the atlas is 8 texels wide');
  assert.equal(names.length, Object.keys(PALETTE).length, 'every palette entry is present');
  assert.equal(height, Math.ceil(names.length / width), 'height follows the entry count');
  assert.equal(data.length, width * height * 4, 'RGBA8, four bytes per texel');
  assert.equal(data.length % 4, 0, 'the buffer is texel-aligned');
  assert.ok(data instanceof Uint8Array, 'the buffer is 8-bit unsigned');

  // The first texel is the first palette entry.
  assert.equal(data[0], (PALETTE.void >> 16) & 0xff, 'R of texel 0');
  assert.equal(data[1], (PALETTE.void >> 8) & 0xff, 'G of texel 0');
  assert.equal(data[2], PALETTE.void & 0xff, 'B of texel 0');
  assert.equal(data[3], 255, 'texel 0 is opaque');

  // A mid-table entry lands at its own index.
  const i = names.indexOf('sky');
  assert.ok(i >= 0, 'the palette has a "sky" entry');
  assert.equal(data[i * 4], (PALETTE.sky >> 16) & 0xff, 'R of the "sky" texel');
  assert.equal(data[i * 4 + 1], (PALETTE.sky >> 8) & 0xff, 'G of the "sky" texel');
  assert.equal(data[i * 4 + 2], PALETTE.sky & 0xff, 'B of the "sky" texel');
  assert.equal(data[i * 4 + 3], 255, 'every used texel is opaque');

  // Unused texels stay transparent.
  assert.equal(data[names.length * 4 + 3], 0, 'unused texels are transparent');

  // The builder is deterministic.
  const again = paletteTextureBytes();
  assert.deepEqual(Array.from(again.data), Array.from(data), 'same bytes every call');
});

test('palette textures use nearest filtering and no mipmaps', () => {
  const tex = paletteTexture();
  assert.equal(tex.magFilter, THREE.NearestFilter, 'nearest magnification');
  assert.equal(tex.minFilter, THREE.NearestFilter, 'nearest minification');
  assert.equal(tex.generateMipmaps, false, 'no mipmaps');
  assert.equal(tex, paletteTexture(), 'the palette texture is cached');
});

// ---------------------------------------------------------------------------
// 2. The material cache returns identical instances for the same colour
// ---------------------------------------------------------------------------

test('material cache returns identical instances for the same colour', () => {
  const a = voxelMaterial(PALETTE.grass);
  const b = voxelMaterial(PALETTE.grass);
  assert.equal(a, b, 'the same colour yields the SAME material instance');
  assert.notEqual(a, voxelMaterial(PALETTE.moss), 'a different colour yields a different instance');

  assert.ok(a.isMeshToonMaterial, 'voxel materials are toon-shaded');
  assert.equal(a.flatShading, true, 'generated voxel geometry is flat-shaded');
  assert.equal(a.gradientMap.magFilter, THREE.NearestFilter, 'hard pixel edges');
  assert.equal(a.gradientMap.generateMipmaps, false, 'no mipmap blur');
  assert.equal(a.gradientMap.image.data.length, TOON_STEPS * 4, 'a four-step toon ramp');

  assert.equal(outlineMaterial(PALETTE.void), outlineMaterial(PALETTE.void), 'outline cached');
  assert.equal(selectionMaterial(PALETTE.gold), selectionMaterial(PALETTE.gold), 'selection cached');
  assert.equal(waterMaterial(), waterMaterial(), 'water cached');
  assert.equal(emissiveMaterial(PALETTE.gold), emissiveMaterial(PALETTE.gold), 'emissive cached');

  assert.equal(waterMaterial().transparent, true, 'water is a transparent surface');
  assert.equal(waterMaterial().depthWrite, false, 'transparent surfaces do not write depth');
  assert.equal(selectionMaterial(PALETTE.gold).depthWrite, false, 'the overlay highlight does not write depth');
  assert.equal(outlineMaterial(PALETTE.void).side, THREE.BackSide, 'the outline is an inverted hull');

  disposeMaterials();
  assert.notEqual(voxelMaterial(PALETTE.grass), a, 'dispose clears the cache');
});

// ---------------------------------------------------------------------------
// 3. The adaptive-quality threshold logic
// ---------------------------------------------------------------------------

test('adaptive quality degrades only after the low threshold is sustained', () => {
  // A single slow frame must not change the quality level.
  let s = { level: 0, belowFor: 0, aboveFor: 0 };
  const one = evaluateAdaptiveQuality(s, { fps: 20, dt: 0.016 }, {});
  assert.equal(one.action, 'none', 'one slow frame does not degrade');
  assert.equal(one.level, 0, 'the level is unchanged');
  assert.ok(one.belowFor > 0, 'the low timer starts');

  // Sustained slowness degrades one level at a time.
  s = { level: 0, belowFor: 0, aboveFor: 0 };
  const actions = [];
  for (let i = 0; i < 200; i++) {
    s = evaluateAdaptiveQuality(s, { fps: 20, dt: 0.05 }, {});
    if (s.action !== 'none') actions.push(s.action);
  }
  assert.deepEqual(actions, ['degrade', 'degrade'], 'exactly two steps were dropped');
  assert.equal(s.level, QUALITY_LEVELS.length - 1, 'it settled on the lowest level');

  // It never drops below the lowest level.
  for (let i = 0; i < 200; i++) {
    s = evaluateAdaptiveQuality(s, { fps: 20, dt: 0.05 }, {});
  }
  assert.equal(s.level, QUALITY_LEVELS.length - 1, 'the floor is respected');
});

test('adaptive quality restores quality after a sustained recovery', () => {
  let s = { level: QUALITY_LEVELS.length - 1, belowFor: 0, aboveFor: 0 };
  const actions = [];
  for (let i = 0; i < 400; i++) {
    s = evaluateAdaptiveQuality(s, { fps: 60, dt: 0.05 }, {});
    if (s.action !== 'none') actions.push(s.action);
  }
  assert.deepEqual(actions, ['upgrade', 'upgrade'], 'quality came back one step at a time');
  assert.equal(s.level, 0, 'back to the top level');

  // The dead band between the two thresholds neither degrades nor upgrades.
  const mid = (ADAPTIVE_DEFAULTS.fpsLow + ADAPTIVE_DEFAULTS.fpsHigh) / 2;
  let b = { level: 0, belowFor: 0, aboveFor: 0 };
  const bandActions = [];
  for (let i = 0; i < 200; i++) {
    b = evaluateAdaptiveQuality(b, { fps: mid, dt: 0.05 }, {});
    if (b.action !== 'none') bandActions.push(b.action);
  }
  assert.deepEqual(bandActions, [], 'the dead band is stable');
  assert.equal(b.level, 0, 'the dead band does not change the level');
});

test('adaptive quality thresholds are the documented ones', () => {
  assert.ok(ADAPTIVE_DEFAULTS.fpsLow < ADAPTIVE_DEFAULTS.fpsHigh, 'the thresholds are ordered');
  assert.equal(ADAPTIVE_DEFAULTS.fpsLow, 45);
  assert.equal(ADAPTIVE_DEFAULTS.fpsHigh, 55);
  assert.equal(ADAPTIVE_DEFAULTS.degradeAfter, 3);
  assert.equal(ADAPTIVE_DEFAULTS.recoverAfter, 8);
  assert.equal(QUALITY_LEVELS.length, 3, 'three quality levels');
  assert.equal(QUALITY_LEVELS[0].shadows, true, 'the top level casts shadows');
  assert.equal(QUALITY_LEVELS[QUALITY_LEVELS.length - 1].shadows, false, 'the bottom level drops shadows');
});

// ---------------------------------------------------------------------------
// 4. The instanced-mesh helper's matrix maths
// ---------------------------------------------------------------------------

test('makeInstanced writes the right matrix per instance', () => {
  const src = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  const im = makeInstanced(src, 3);

  assert.ok(im.isInstancedMesh, 'a real InstancedMesh is produced');
  assert.equal(im.count, 3, 'the instance count is honoured');
  assert.equal(im.castShadow, true, 'instanced props cast shadows');

  assert.equal(im.setInstance(1, { x: 5, y: 2, z: -3, rotY: Math.PI / 2, scale: 2 }), true);

  const m = new THREE.Matrix4();
  im.getMatrixAt(1, m);
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  m.decompose(p, q, s);

  assert.equal(p.x, 5, 'translation x');
  assert.equal(p.y, 2, 'translation y');
  assert.equal(p.z, -3, 'translation z');
  assert.equal(s.x, 2, 'uniform scale x');
  assert.equal(s.y, 2, 'uniform scale y');
  assert.equal(s.z, 2, 'uniform scale z');

  // A +90 degree yaw takes +X to -Z.
  const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  assert.ok(Math.abs(axis.x) < 1e-6, 'x is rotated away');
  assert.ok(Math.abs(axis.z + 1) < 1e-6, 'x became -z');

  assert.equal(im.setInstance(9, {}), false, 'out-of-range writes are refused');
  assert.equal(im.setInstance(-1, {}), false, 'negative indices are refused');

  const out = new THREE.Matrix4();
  composeInstanceMatrix(out, { x: 1, y: 2, z: 3 });
  assert.equal(out.elements[12], 1, 'the translation lives in elements 12..14');
  assert.equal(out.elements[13], 2);
  assert.equal(out.elements[14], 3);
});

test('enableInstancing collapses repeated meshes into one instanced draw', () => {
  const scene = new THREE.Scene();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial();
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(i * 2, 0, 0);
    scene.add(m);
  }

  const res = enableInstancing(scene);
  assert.equal(res.converted, 1, 'one group was instanced');
  assert.equal(res.instances, 5, 'five meshes became instances');
  assert.equal(res.savedDrawCalls, 4, 'four draw calls were saved');
  assert.equal(scene.children.length, 1, 'the five meshes were replaced by one');

  let inst = null;
  scene.traverse((o) => { if (o.isInstancedMesh) inst = o; });
  assert.ok(inst, 'an InstancedMesh is in the scene');
  assert.equal(inst.count, 5);

  const m = new THREE.Matrix4();
  inst.getMatrixAt(3, m);
  assert.equal(Math.round(m.elements[12]), 6, 'the instance kept its world position');
});

test('mergeStaticMeshes collapses a group into one mesh per material', () => {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial();
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(i, 0, 0);
    group.add(m);
  }

  const res = mergeStaticMeshes(group);
  assert.equal(res.removed, 4, 'the source meshes were removed');
  assert.equal(res.merged, 1, 'one merged mesh per material');
  assert.equal(res.drawCallsBefore, 4);
  assert.equal(res.drawCallsAfter, 1);
  assert.equal(group.children.length, 1, 'the group now holds one mesh');
  assert.equal(group.children[0].geometry.attributes.position.count, 4 * 24, 'all the geometry survived');
});

// ---------------------------------------------------------------------------
// 5. The sky's time-of-day colour interpolation
// ---------------------------------------------------------------------------

test('sky colour interpolation follows the four keyframes', () => {
  assert.equal(SKY_KEYFRAMES.length, 4, 'four keyframes: dawn, day, dusk, night');

  const night = skyColorsAt(0.0);
  const dawn = skyColorsAt(0.25);
  const day = skyColorsAt(0.5);
  const dusk = skyColorsAt(0.75);

  assert.equal(night.id, 'night', 'midnight is the night keyframe');
  assert.equal(dawn.id, 'dawn', '06:00 is the dawn keyframe');
  assert.equal(day.id, 'day', 'noon is the day keyframe');
  assert.equal(dusk.id, 'dusk', '18:00 is the dusk keyframe');

  assert.ok(day.sunIntensity > dawn.sunIntensity, 'the sun is stronger at noon than at dawn');
  assert.ok(dawn.sunIntensity > night.sunIntensity, 'the sun is stronger at dawn than at midnight');
  assert.ok(dusk.sunIntensity < day.sunIntensity, 'the sun is weaker at dusk than at noon');
  assert.ok(day.ambientIntensity > night.ambientIntensity, 'ambient light has its own day/night curve');

  assert.notEqual(day.horizon, day.zenith, 'the gradient has more than one colour');
  assert.notEqual(day.zenith, night.zenith, 'the sky changes across the day');
});

test('sky colour interpolation is continuous and wraps at midnight', () => {
  assert.equal(wrap01(1.25), 0.25, 'times past midnight wrap');
  assert.equal(wrap01(-0.25), 0.75, 'negative times wrap');
  assert.equal(wrap01(0.5), 0.5, 'a time in range is untouched');

  const justBefore = skyColorsAt(0.4999);
  const atNoon = skyColorsAt(0.5);
  assert.ok(
    Math.abs(justBefore.sunIntensity - atNoon.sunIntensity) < 0.01,
    'the interpolation is continuous across a keyframe',
  );

  const beforeMidnight = skyColorsAt(0.9999);
  const atMidnight = skyColorsAt(0.0);
  assert.ok(
    Math.abs(beforeMidnight.sunIntensity - atMidnight.sunIntensity) < 0.01,
    'the interpolation is continuous across midnight',
  );

  assert.equal(lerpHex(0x000000, 0xffffff, 0), 0x000000, 'lerp at 0');
  assert.equal(lerpHex(0x000000, 0xffffff, 1), 0xffffff, 'lerp at 1');
});

test('the sun direction is derived from the same clock', () => {
  assert.ok(sunDirection(0.0).y < 0, 'the sun is below the horizon at midnight');
  assert.ok(sunDirection(0.5).y > 0.9, 'the sun is overhead at noon');
  assert.ok(sunDirection(0.25).y > -0.05 && sunDirection(0.25).y < 0.05, 'the sun is on the horizon at dawn');
  assert.ok(sunDirection(0.25).x > 0.9, 'the sun rises in the east');
  assert.ok(sunDirection(0.75).x < -0.9, 'the sun sets in the west');
});

test('createSky builds a dome and chunky voxel clouds as geometry', () => {
  const scene = new THREE.Scene();
  const sky = createSky(scene);
  assert.ok(sky.dome.isMesh, 'the dome is a mesh');
  assert.ok(sky.clouds.isMesh, 'the clouds are a mesh');
  assert.ok(sky.clouds.geometry.attributes.position.count > 0, 'the clouds have geometry');
  assert.equal(scene.getObjectByName('sky-dome') !== undefined, true, 'the dome is in the scene');
  assert.equal(sky.dome.material.side, THREE.BackSide, 'the dome is seen from inside');
  assert.equal(sky.dome.material.vertexColors, true, 'the gradient is vertex-coloured');
  sky.setTimeOfDay(0.5);
  assert.equal(sky.colors().id, 'day', 'the sky follows the clock');
  sky.dispose();
});

// ---------------------------------------------------------------------------
// 6. The audio name list is non-empty and unique
// ---------------------------------------------------------------------------

test('the audio sound list is non-empty and unique', () => {
  assert.ok(SOUND_NAMES.length > 0, 'there is at least one sound');
  assert.equal(new Set(SOUND_NAMES).size, SOUND_NAMES.length, 'the names are unique');
  assert.deepEqual(listSounds(), Array.from(SOUND_NAMES), 'listSounds returns the library');

  for (const required of ['place', 'bulldoze', 'error', 'day-change', 'level-up']) {
    assert.ok(SOUND_NAMES.includes(required), `"${required}" is available`);
  }
  for (const [name, spec] of Object.entries(SOUND_LIBRARY)) {
    assert.ok(BUS_NAMES.includes(spec.bus), `"${name}" plays into a named bus`);
    assert.ok(spec.wave, `"${name}" has a synthesis recipe`);
    assert.ok(typeof spec.gain === 'number', `"${name}" has a gain`);
  }
});

test('the audio service is alive but silent without WebAudio', async () => {
  const audio = createAudio(undefined);
  assert.equal(audio.listSounds().length, SOUND_NAMES.length, 'the service exposes the library');
  assert.equal(audio.isMuted(), false, 'it starts unmuted');
  audio.setMuted(true);
  assert.equal(audio.isMuted(), true, 'mute is remembered');
  audio.setMuted(false);
  assert.equal(audio.isMuted(), false, 'unmute is remembered');
  assert.equal(audio.play('not-a-sound'), false, 'an unknown sound is a no-op');
  assert.equal(audio.play('place'), false, 'no AudioContext means no sound, but no crash');
  assert.equal(await audio.unlock(), false, 'unlock reports failure instead of throwing');
  assert.equal(audio.setBusVolume('sfx', 0.5), true, 'bus volume is settable');
  assert.equal(audio.getBusVolume('sfx'), 0.5, 'bus volume is readable');
  assert.equal(audio.setBusVolume('nope', 0.5), false, 'unknown buses are rejected');
  audio.dispose();
});

// ---------------------------------------------------------------------------
// 7. The palette quantise (the post-process guarantee)
// ---------------------------------------------------------------------------

test('palette quantise snaps a colour to an exact palette member', () => {
  const rgb = paletteRgbList();
  const members = new Set();
  for (let i = 0; i < rgb.length; i += 3) members.add(`${rgb[i]},${rgb[i+1]},${rgb[i+2]}`);

  const q = quantiseColour(200, 210, 220, rgb);
  assert.ok(members.has(`${q.r},${q.g},${q.b}`), 'the result IS a palette member');

  const sky = PALETTE.sky;
  const exact = quantiseColour((sky >> 16) & 0xff, (sky >> 8) & 0xff, sky & 0xff, rgb);
  assert.equal(exact.r, (sky >> 16) & 0xff, 'an exact palette colour maps to itself (r)');
  assert.equal(exact.g, (sky >> 8) & 0xff, 'an exact palette colour maps to itself (g)');
  assert.equal(exact.b, sky & 0xff, 'an exact palette colour maps to itself (b)');

  assert.equal(nearestPaletteIndex(0, 0, 0, rgb) >= 0, true, 'a nearest index is always returned');

  const lut = buildPaletteLut(8);
  assert.equal(lut.width, 8, 'the LUT is 8 wide');
  assert.equal(lut.height, 8 * 8, 'the LUT is 64 tall');
  assert.equal(lut.data.length, 8 * 64 * 4, 'the LUT is RGBA8');
  for (let i = 3; i < lut.data.length; i += 4) {
    assert.equal(lut.data[i], 255, 'every LUT texel is opaque');
  }
});

// ---------------------------------------------------------------------------
// 11. The post chain is optional and survives an EffectComposer failure
// ---------------------------------------------------------------------------

/** A renderer stub with just enough surface for EffectComposer to build. */
function mockRenderer(overrides = {}) {
  const r = {
    getPixelRatio: () => 1,
    getSize: (v) => v.set(800, 600),
    getDrawingBufferSize: (v) => v.set(800, 600),
    renderCalls: 0,
    render() { r.renderCalls += 1; },
    domElement: { clientWidth: 800, clientHeight: 600 },
    ...overrides,
  };
  return r;
}

test('the post chain builds when EffectComposer is available', () => {
  const r = mockRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const fx = createPostFX(r, scene, camera);

  assert.equal(fx.available, true, 'the chain was built');
  assert.equal(fx.enabled, false, 'the chain is off until it is asked for');
  assert.equal(fx.error, null, 'no error was recorded');

  fx.setEnabled(true);
  assert.equal(fx.enabled, true, 'it can be switched on');
  fx.setPixelSize(3);
  assert.equal(fx.pixelSize, 3, 'the pixel size is settable');
  fx.setPixelSize(0);
  assert.equal(fx.pixelSize, 1, 'the pixel size never goes below 1');

  fx.setEnabled(false);
  fx.dispose();
  assert.equal(fx.available, false, 'disposal takes the chain down');
});

test('a failing EffectComposer falls back to direct rendering', () => {
  const broken = mockRenderer({
    getPixelRatio: () => { throw new Error('no WebGL2 here'); },
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const fx = createPostFX(broken, scene, camera);

  assert.equal(fx.available, false, 'the chain reports that it is unavailable');
  assert.ok(fx.error, 'the failure is recorded, not swallowed');

  // Asking for the chain must not throw and must not enable it.
  fx.setEnabled(true);
  assert.equal(fx.enabled, false, 'an unavailable chain cannot be enabled');

  // And the frame still renders, straight to the screen.
  fx.render(0.016);
  assert.equal(broken.renderCalls, 1, 'the scene was rendered directly');
  fx.dispose();
});

// ---------------------------------------------------------------------------
// 8. Grid picking maths (what renderer.pickCell uses)
// ---------------------------------------------------------------------------

test('grid picking converts world space to an in-bounds cell', () => {
  const centre = cellCenter(10, 20);
  const cell = worldToCellInt(centre.x, centre.z);
  assert.equal(cell.x, 10, 'the cell centre maps back to its own cell');
  assert.equal(cell.z, 20, 'the cell centre maps back to its own cell');
  assert.ok(inBounds(cell.x, cell.z), 'and it is in bounds');

  const outside = worldToCellInt(999999, 999999);
  assert.equal(inBounds(outside.x, outside.z), false, 'far away positions are out of bounds');
});

// ---------------------------------------------------------------------------
// 9. The performance monitor
// ---------------------------------------------------------------------------

test('the performance monitor samples fps, draw calls and triangles', () => {
  const fake = {
    info: {
      render: { calls: 42, triangles: 1234, points: 0, lines: 0 },
      memory: { geometries: 7, textures: 3 },
      programs: { length: 5 },
    },
  };
  const mon = createPerformanceMonitor(fake, { windowSeconds: 0.5 });
  for (let i = 0; i < 10; i++) mon.update(0.1);

  const snap = mon.snapshot();
  assert.ok(Math.abs(snap.fps - 10) < 0.001, '10 frames in one second is 10 fps');
  assert.equal(snap.drawCalls, 42, 'draw calls are reported');
  assert.equal(snap.triangles, 1234, 'triangles are reported');
  assert.equal(snap.geometries, 7, 'geometry count is reported');
  assert.equal(snap.textures, 3, 'texture count is reported');
  assert.equal(snap.programs, 5, 'program count is reported');
});

// ---------------------------------------------------------------------------
// 10. The rigged-character clone (the claim this build had to verify)
// ---------------------------------------------------------------------------

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

test('the asset service clones characters through the skeleton-safe path', () => {
  const src = readFileSync(new URL('./assets.js', import.meta.url), 'utf8');
  assert.ok(src.includes('SkeletonUtils'), 'assets.js imports the skeleton-safe clone helper');
  assert.ok(
    /isRigged\(src\)\s*\?\s*cloneRigged\(src\)\s*:\s*src\.clone\(true\)/.test(src),
    'the rigged branch of cloneModel() is wired in',
  );
  assert.ok(src.includes('cloneSkeleton(src)'), 'cloneRigged() uses the skeleton-safe clone');
  assert.ok(/export (async )?function loadAll\b/.test(src), 'loadAll() is exported');
  assert.ok(/export (async )?function setCacheLimit\b/.test(src), 'setCacheLimit() is exported');
});

test('cloning a rigged character rebinds the skeleton to the clone own bones', async (t) => {
  const url = new URL('../../public/assets/models/characters/Knight.glb', import.meta.url);
  let buf;
  try {
    buf = readFileSync(url);
  } catch {
    t.skip('Knight.glb is not available in this checkout');
    return;
  }

  const savedSelf = globalThis.self;
  const savedDoc = globalThis.document;
  installDomStub();

  try {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const { clone: skClone } = await import('three/examples/jsm/utils/SkeletonUtils.js');

    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
    const root = gltf.scene;

    let skin = null;
    root.traverse((o) => { if (o.isSkinnedMesh && !skin) skin = o; });
    assert.ok(skin, 'Knight.glb contains a skinned mesh');
    assert.ok(skin.skeleton.bones.length > 0, 'the skeleton has bones');
    assert.ok(gltf.animations.length > 0, 'the character has animation clips');

    const srcBone = skin.skeleton.bones[0];

    // The plain Object3D.clone() SHARES the source skeleton.
    const plain = root.clone(true);
    let plainSkin = null;
    plain.traverse((o) => { if (o.isSkinnedMesh && !plainSkin) plainSkin = o; });
    assert.equal(plainSkin.skeleton, skin.skeleton, 'a plain clone SHARES the source skeleton');
    assert.equal(plainSkin.skeleton.bones[0], srcBone, 'the shared skeleton still points at the ORIGINAL bone');
    assert.notEqual(
      plainSkin.skeleton.bones[0],
      plain.getObjectByName(srcBone.name),
      'the clone own bone is NOT the bone the skin reads',
    );

    // SkeletonUtils.clone() rebuilds the skeleton against the clone own bones.
    const fixed = skClone(root);
    let fixedSkin = null;
    fixed.traverse((o) => { if (o.isSkinnedMesh && !fixedSkin) fixedSkin = o; });
    assert.notEqual(fixedSkin.skeleton, skin.skeleton, 'the rebuilt skeleton is NOT shared');
    assert.equal(
      fixedSkin.skeleton.bones[0],
      fixed.getObjectByName(srcBone.name),
      'the rebuilt skeleton points at the CLONE own bone',
    );
    assert.equal(
      fixedSkin.skeleton.boneInverses.length,
      skin.skeleton.boneInverses.length,
      'the bind inverses are preserved',
    );
  } finally {
    if (savedSelf === undefined) delete globalThis.self;
    else globalThis.self = savedSelf;
    if (savedDoc === undefined) delete globalThis.document;
    else globalThis.document = savedDoc;
  }
});

// ---------------------------------------------------------------------------
// 5. Multi-mesh models (M4)
// ---------------------------------------------------------------------------

test('makeInstanced keeps EVERY part of a multi-mesh model', () => {
  const group = new THREE.Group();
  const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  const b = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  const c = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshBasicMaterial());
  a.position.set(0, 1, 0);
  b.position.set(2, 0, 0);
  group.add(a, b, c);

  const made = makeInstanced(group, 4);

  assert.ok(made.isGroup, 'a multi-mesh model returns a group');
  assert.equal(made.parts.length, 3, 'one InstancedMesh per source mesh');
  for (const part of made.parts) {
    assert.ok(part.isInstancedMesh, 'every part is a real InstancedMesh');
    assert.equal(part.count, 4, 'every part honours the instance count');
  }
});

test('every part of a multi-mesh model receives the same instance transform', () => {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));

  const made = makeInstanced(group, 2);
  made.setInstance(1, { x: 5, y: 2, z: -3, rotY: 0, scale: 2 });

  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (const part of made.parts) {
    const m = new THREE.Matrix4();
    part.getMatrixAt(1, m);
    m.decompose(p, q, s);
    assert.equal(p.x, 5, 'every part gets the same x');
    assert.equal(p.y, 2, 'every part gets the same y');
    assert.equal(p.z, -3, 'every part gets the same z');
    assert.equal(s.x, 2, 'every part gets the same scale');
    // `needsUpdate` is a write-only setter in three.js: it bumps `version`.
    assert.ok(part.instanceMatrix.version > 0,
      'setInstance must flag the matrix for upload');
  }
});

test('setInstances writes to every part and flags them all', () => {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));

  const made = makeInstanced(group, 3);
  made.setInstances([
    { x: 0, y: 0, z: 0, scale: 1 },
    { x: 4, y: 0, z: 0, scale: 1 },
    { x: 8, y: 0, z: 0, scale: 1 },
  ]);

  for (const part of made.parts) {
    assert.ok(part.instanceMatrix.version > 0, 'the upload flag is set');
    const m = new THREE.Matrix4();
    part.getMatrixAt(2, m);
    const p = new THREE.Vector3();
    m.decompose(p, new THREE.Quaternion(), new THREE.Vector3());
    assert.equal(p.x, 8, 'the third instance is where it was put');
  }
});

test("a part's offset inside the model is baked into its geometry", () => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  body.position.set(0, 3, 0);           // the body sits three units up
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  roof.position.set(0, 5, 0);
  group.add(body, roof);
  group.updateMatrixWorld(true);

  const made = makeInstanced(group, 1);
  const geometry = made.parts[0].geometry;
  geometry.computeBoundingBox();
  assert.equal(geometry.boundingBox.min.y, 2.5,
    'the offset is baked in (the box spans 2.5 .. 3.5)');
  assert.equal(body.geometry.boundingBox, null,
    "the SOURCE model's geometry must not be mutated");
});

test('a single-mesh model still returns a bare InstancedMesh', () => {
  const src = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  const made = makeInstanced(src, 3);
  assert.ok(made.isInstancedMesh, 'the single-mesh API is unchanged');
  assert.equal(made.count, 3);
  assert.equal(typeof made.setInstance, 'function');
  assert.equal(typeof made.setInstances, 'function');
});

// ---------------------------------------------------------------------------
// 6. The batch helpers
// ---------------------------------------------------------------------------

test('instancedParts handles a bare mesh, a group and nothing', () => {
  const single = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  const im = new THREE.InstancedMesh(single.geometry, single.material, 2);
  assert.deepEqual(instancedParts(im), [im], 'a bare InstancedMesh is its own part');

  const group = new THREE.Group();
  const a = new THREE.InstancedMesh(single.geometry, single.material, 2);
  const b = new THREE.InstancedMesh(single.geometry, single.material, 2);
  group.add(a, b);
  group.parts = [a, b];
  assert.deepEqual(instancedParts(group), [a, b], 'a group reports its parts');

  assert.deepEqual(instancedParts(null), [], 'nothing has no parts');
});

test('setInstanceCount sets the live count on every part', () => {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial();
  const a = new THREE.InstancedMesh(geo, mat, 8);
  const b = new THREE.InstancedMesh(geo, mat, 8);
  const group = new THREE.Group();
  group.add(a, b);
  group.parts = [a, b];

  assert.equal(setInstanceCount(group, 3), 3);
  assert.equal(a.count, 3);
  assert.equal(b.count, 3);
  assert.equal(a.instanceMatrix.version > 0, true, 'the upload flag is set');

  assert.equal(setInstanceCount(a, 0), 0, 'a bare mesh works too');
});

test('disposeInstancedBatch frees the parts AND removes the group', () => {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial();
  const a = new THREE.InstancedMesh(geo, mat, 4);
  const b = new THREE.InstancedMesh(geo, mat, 4);
  const group = new THREE.Group();
  group.add(a, b);
  group.parts = [a, b];
  const scene = new THREE.Group();
  scene.add(group);

  disposeInstancedBatch(group);

  assert.equal(group.parent, null, 'the group must leave the scene');
  assert.equal(a.parent, null, 'the parts must leave the group');
  assert.equal(b.parent, null);
});

test('a batch frees the geometry it cloned, and never the cached one', () => {
  const cached = new THREE.BoxGeometry(1, 1, 1);
  const proto = new THREE.Group();
  const mesh = new THREE.Mesh(cached, new THREE.MeshBasicMaterial());
  proto.add(mesh);

  const made = makeInstancedBatch(proto, 2);
  const owned = made.parts[0].geometry;
  assert.notEqual(owned, cached, 'the batch clones the geometry');
  assert.equal(owned.userData.scBatchOwned, true, 'the clone is marked as owned');

  disposeInstancedBatch(made.group);
  // The CACHED geometry must survive: other users of the model still need it.
  assert.ok(cached.attributes.position, 'the cached geometry must not be disposed');
});
