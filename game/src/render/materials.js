/**
 * render/materials.js — the retro 16-bit material factory.
 *
 * OWNERSHIP: TEC. Imports only `three` and `core/config.js`.
 *
 * The SuperCitycon look is an *indexed* palette (FR-TEC-001/004): every colour
 * in the world comes from `config.PALETTE`. This module is the single place
 * that turns a palette index into a Three.js material, and it is the only
 * place allowed to build a texture — so the "hard pixel edges, no mipmaps,
 * no antialiasing" rule (FR-TEC-011/017) is enforced once rather than in
 * twenty call sites.
 *
 * Rules enforced here:
 *   - every texture uses NearestFilter and never generates mipmaps;
 *   - palette textures are raw sRGB *bytes* (colorSpace = NoColorSpace) so
 *     the GPU never re-decodes them and the palette stays exact;
 *   - generated voxel geometry is flat-shaded (the library models are low
 *     poly and ship their own materials, which we do not touch);
 *   - materials are cached, because 4096 terrain cells + hundreds of
 *     buildings must not become thousands of shader programs.
 */

import * as THREE from 'three';
import { PALETTE } from '../core/config.js';

/** Width of the palette atlas texture. Height follows the entry count. */
export const PALETTE_TEXTURE_WIDTH = 8;

/** Number of toon shading steps (FR-TEC-001 hard-edged banding). */
export const TOON_STEPS = 4;

/**
 * The toon ramp is built from the palette's own cool luminance ramp so no
 * off-palette value is ever introduced. Three's toon shader samples the RED
 * channel of the gradient map as a multiplier, hence the byte-only ramp.
 */
const TOON_RAMP_KEYS = ['night', 'slate', 'mist', 'snow'];

/** @type {Map<string, THREE.Material>} */
const materialCache = new Map();
/** @type {THREE.DataTexture|null} */
let paletteTex = null;
/** @type {THREE.DataTexture|null} */
let gradientTex = null;

// --------------------------------------------------------------------------
// Pure helpers (unit-testable, no Three.js objects)
// --------------------------------------------------------------------------

/**
 * Split a 0xRRGGBB colour into its bytes.
 * @param {number} hex
 * @returns {{r:number,g:number,b:number,a:number}}
 */
export function hexToBytes(hex) {
  const v = hex >>> 0;
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff, a: 255 };
}

/**
 * Build the byte layout of the palette atlas.
 *
 * Layout contract (relied on by `postfx.js` and by the tests):
 *   - `width`  = PALETTE_TEXTURE_WIDTH (8)
 *   - `height` = ceil(entryCount / width)
 *   - `data`   = RGBA8, row-major, left-to-right, top-to-bottom
 *   - texel i holds PALETTE_NAMES[i]; unused texels stay (0,0,0,0)
 *   - every used texel is fully opaque (alpha 255)
 *
 * @param {Record<string, number>} [palette]
 * @returns {{width:number, height:number, data:Uint8Array, names:string[]}}
 */
export function paletteTextureBytes(palette = PALETTE) {
  const names = Object.keys(palette);
  const width = PALETTE_TEXTURE_WIDTH;
  const height = Math.max(1, Math.ceil(names.length / width));
  const data = new Uint8Array(width * height * 4);
  names.forEach((name, i) => {
    const { r, g, b, a } = hexToBytes(palette[name]);
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = a;
  });
  return { width, height, data, names };
}

/**
 * Flat list of the palette's sRGB bytes, in index order. Used by the post
 * chain's nearest-palette search (and by the CPU-side 3D LUT builder).
 * @param {Record<string, number>} [palette]
 * @returns {Uint8Array} r,g,b triples
 */
export function paletteRgbList(palette = PALETTE) {
  const names = Object.keys(palette);
  const out = new Uint8Array(names.length * 3);
  names.forEach((name, i) => {
    const { r, g, b } = hexToBytes(palette[name]);
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  });
  return out;
}

// --------------------------------------------------------------------------
// Textures
// --------------------------------------------------------------------------

/**
 * The palette atlas: every palette entry as one texel.
 * NearestFilter, no mipmaps, NoColorSpace (raw sRGB bytes).
 * @returns {THREE.DataTexture}
 */
export function paletteTexture() {
  if (paletteTex) return paletteTex;
  const { width, height, data } = paletteTextureBytes();
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  tex.name = 'palette-atlas';
  paletteTex = tex;
  return tex;
}

/**
 * The toon banding ramp (4 steps) used as `gradientMap` on toon materials.
 * @returns {THREE.DataTexture}
 */
export function toonGradientMap() {
  if (gradientTex) return gradientTex;
  const data = new Uint8Array(TOON_STEPS * 4);
  for (let i = 0; i < TOON_STEPS; i++) {
    const key = TOON_RAMP_KEYS[Math.min(i, TOON_RAMP_KEYS.length - 1)];
    const { r, g, b, a } = hexToBytes(PALETTE[key]);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  const tex = new THREE.DataTexture(data, TOON_STEPS, 1, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  tex.name = 'toon-gradient';
  gradientTex = tex;
  return tex;
}

// --------------------------------------------------------------------------
// Materials
// --------------------------------------------------------------------------

function cached(key, make) {
  let m = materialCache.get(key);
  if (!m) {
    m = make();
    materialCache.set(key, m);
  }
  return m;
}

/**
 * The workhorse material for generated voxel geometry.
 *
 * MeshToonMaterial + a 4-step nearest-filtered gradient map gives the hard,
 * banded 16-bit shading the art direction asks for (FR-TEC-001/011) without
 * the cost of a full PBR pipeline.
 *
 * @param {number|string} color palette colour
 * @returns {THREE.MeshToonMaterial}
 */
export function voxelMaterial(color) {
  const key = `voxel:${color}`;
  return cached(key, () => {
    const m = new THREE.MeshToonMaterial({
      color: new THREE.Color(color),
      gradientMap: toonGradientMap(),
    });
    m.flatShading = true;
    m.name = `voxel-${color}`;
    return m;
  });
}

/**
 * Inverted-hull outline material for the UX overlay (a mesh rendered with
 * BackSide slightly larger than the target reads as a hard 16-bit outline).
 * @param {number|string} [color]
 * @returns {THREE.MeshBasicMaterial}
 */
export function outlineMaterial(color = PALETTE.void) {
  const key = `outline:${color}`;
  return cached(key, () => {
    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      side: THREE.BackSide,
    });
    m.name = `outline-${color}`;
    return m;
  });
}

/**
 * Flat translucent highlight used by the UX overlay for the hovered / selected
 * cell. Depth-write off so it composites over the city without z-fighting.
 * @param {number|string} [color]
 * @returns {THREE.MeshBasicMaterial}
 */
export function selectionMaterial(color = PALETTE.gold) {
  const key = `selection:${color}`;
  return cached(key, () => {
    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    m.name = `selection-${color}`;
    return m;
  });
}

/**
 * Water surface. Transparent, depth-write off, so it renders in the
 * transparent pass after the opaque geometry (FR-TEC-029).
 * @returns {THREE.MeshLambertMaterial}
 */
export function waterMaterial() {
  return cached('water', () => {
    const m = new THREE.MeshLambertMaterial({
      color: new THREE.Color(PALETTE.water),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    m.flatShading = true;
    m.name = 'water';
    return m;
  });
}

/**
 * Self-lit material for lit windows, street lamps and fire.
 * @param {number|string} color
 * @returns {THREE.MeshLambertMaterial}
 */
export function emissiveMaterial(color = PALETTE.gold) {
  const key = `emissive:${color}`;
  return cached(key, () => {
    const m = new THREE.MeshLambertMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: 1,
    });
    m.flatShading = true;
    m.name = `emissive-${color}`;
    return m;
  });
}

/**
 * The full material surface, for callers that prefer a service object.
 * @returns {{
 *   voxelMaterial: typeof voxelMaterial,
 *   paletteTexture: typeof paletteTexture,
 *   toonGradientMap: typeof toonGradientMap,
 *   outlineMaterial: typeof outlineMaterial,
 *   selectionMaterial: typeof selectionMaterial,
 *   waterMaterial: typeof waterMaterial,
 *   emissiveMaterial: typeof emissiveMaterial,
 *   dispose: () => void,
 * }}
 */
export function createMaterials() {
  return {
    voxelMaterial,
    paletteTexture,
    toonGradientMap,
    outlineMaterial,
    selectionMaterial,
    waterMaterial,
    emissiveMaterial,
    dispose: disposeMaterials,
  };
}

/**
 * Dispose every cached material and texture. Safe to call twice.
 */
export function disposeMaterials() {
  for (const m of materialCache.values()) m.dispose?.();
  materialCache.clear();
  paletteTex?.dispose();
  gradientTex?.dispose();
  paletteTex = null;
  gradientTex = null;
}

/** @returns {number} how many distinct materials are currently cached. */
export function cachedMaterialCount() {
  return materialCache.size;
}
