/**
 * render/postfx.js — the light-weight retro post chain.
 *
 * OWNERSHIP: TEC. Imports only `three`, `three/examples/jsm/postprocessing/*`
 * and this folder's own modules.
 *
 * What it does, in the order FR-TEC-034 requires:
 *   1. the scene is rendered into a NEAREST-filtered render target, at
 *      1/`pixelSize` resolution -> chunky pixels (FR-TEC-013);
 *   2. a single full-screen pass converts linear -> sRGB, applies an optional
 *      ordered-dither + vignette + scanline grade, and then snaps every
 *      pixel to the nearest `config.PALETTE` entry (FR-TEC-002/034);
 *   3. that palette lookup is ONE texture fetch from a pre-baked 3D->2D LUT,
 *      so the "exact palette member" guarantee (QA-TEC-001) costs one sample
 *      per pixel rather than a 23-entry search.
 *
 * ROBUSTNESS (the brief's hard requirement): the whole chain is optional and
 * is built inside a try/catch. If `EffectComposer` cannot be constructed —
 * no WebGL2, a broken addon, a hostile GPU — `createPostFX` returns a
 * service with `available === false` whose `render()` draws the scene
 * directly. The renderer therefore never depends on this file succeeding.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { PALETTE } from '../core/config.js';
import { paletteRgbList } from './materials.js';

/** Resolution of the palette lookup cube (per axis). */
export const LUT_SIZE = 32;

/** Default pixel chunk size. 1 = no downscale (pure colour quantise). */
export const DEFAULT_PIXEL_SIZE = 1;

/** The most recently created post chain, for the module-level helpers. */
let activePostFX = null;

// --------------------------------------------------------------------------
// Pure palette maths (unit-testable)
// --------------------------------------------------------------------------

/**
 * Index of the palette entry nearest to an RGB triple.
 * Plain Euclidean distance in sRGB space — the same metric the LUT bakes, so
 * the CPU helper and the GPU lookup always agree.
 *
 * @param {number} r @param {number} g @param {number} b
 * @param {Uint8Array} rgbList flat r,g,b triples
 * @returns {number} palette index, 0 when the list is empty
 */
export function nearestPaletteIndex(r, g, b, rgbList) {
  const count = Math.floor(rgbList.length / 3);
  let best = 0;
  let bestD = Infinity;
  for (let p = 0; p < count; p++) {
    const dr = r - rgbList[p * 3];
    const dg = g - rgbList[p * 3 + 1];
    const db = b - rgbList[p * 3 + 2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Snap an RGB triple to the nearest palette entry.
 * @param {number} r @param {number} g @param {number} b
 * @param {Uint8Array} [rgbList]
 * @returns {{r:number,g:number,b:number}}
 */
export function quantiseColour(r, g, b, rgbList = paletteRgbList()) {
  const i = nearestPaletteIndex(r, g, b, rgbList);
  return { r: rgbList[i * 3], g: rgbList[i * 3 + 1], b: rgbList[i * 3 + 2] };
}

/**
 * Bake the 3D palette lookup into a flat 2D texture.
 *
 * Layout (matches `RetroShader`): the cube axis `r` is the texture X, and
 * `g * size + b` is the texture Y. The texture is `size` wide and
 * `size * size` tall. Every texel is an exact palette entry, so the final
 * frame can only contain palette colours.
 *
 * @param {number} [size]
 * @param {Record<string, number>} [palette]
 * @returns {{width:number,height:number,data:Uint8Array}}
 */
export function buildPaletteLut(size = LUT_SIZE, palette = PALETTE) {
  const rgb = paletteRgbList(palette);
  const width = size;
  const height = size * size;
  const data = new Uint8Array(width * height * 4);
  for (let b = 0; b < size; b++) {
    const bv = Math.round((b / (size - 1)) * 255);
    for (let g = 0; g < size; g++) {
      const gv = Math.round((g / (size - 1)) * 255);
      for (let r = 0; r < size; r++) {
        const rv = Math.round((r / (size - 1)) * 255);
        const p = nearestPaletteIndex(rv, gv, bv, rgb);
        const o = ((g * size + b) * size + r) * 4;
        data[o] = rgb[p * 3];
        data[o + 1] = rgb[p * 3 + 1];
        data[o + 2] = rgb[p * 3 + 2];
        data[o + 3] = 255;
      }
    }
  }
  return { width, height, data };
}

// --------------------------------------------------------------------------
// The shader
// --------------------------------------------------------------------------

export const RetroShader = {
  name: 'RetroShader',
  uniforms: {
    tDiffuse: { value: null },
    tPalette: { value: null },
    uLutSize: { value: LUT_SIZE },
    uDither: { value: 0.035 },
    uVignette: { value: 0.35 },
    uScanlines: { value: 0.06 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uQuantise: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tPalette;
    uniform float uLutSize;
    uniform float uDither;
    uniform float uVignette;
    uniform float uScanlines;
    uniform float uQuantise;
    uniform vec2 uResolution;
    varying vec2 vUv;

    // three's exact sRGB OETF, so palette bytes and frame bytes agree.
    vec3 linearToSRGB( vec3 c ) {
      return mix(
        pow( max( c, vec3( 0.0 ) ), vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ),
        c * 12.92,
        vec3( lessThanEqual( c, vec3( 0.0031308 ) ) )
      );
    }

    // 4x4 ordered Bayer threshold, values 0 .. 0.9375.
    float bayer2( vec2 a ) {
      a = floor( a );
      return fract( a.x / 2.0 + a.y * a.y * 0.75 );
    }
    float bayer4( vec2 a ) {
      return bayer2( 0.5 * a ) * 0.25 + bayer2( a );
    }

    void main() {
      vec3 col = texture2D( tDiffuse, vUv ).rgb;   // linear (render target)

      // Scanlines: subtle horizontal darkening, in display space.
      float scan = 1.0 - uScanlines * ( 0.5 + 0.5 * sin( vUv.y * uResolution.y * 3.14159265 ) );
      col *= scan;

      // Vignette: radial darkening toward the corners.
      vec2 d = vUv - 0.5;
      col *= 1.0 - uVignette * dot( d, d ) * 2.0;

      // Work in sRGB from here on: the palette is authored in sRGB.
      col = clamp( linearToSRGB( col ), 0.0, 1.0 );

      // Ordered dither BEFORE the quantise, so the result is still an exact
      // palette member (QA-TEC-001).
      float th = ( bayer4( vUv * uResolution ) - 0.46875 ) * uDither;
      col = clamp( col + th, 0.0, 1.0 );

      if ( uQuantise > 0.5 ) {
        float n = uLutSize - 1.0;
        vec3 idx = floor( col * n + 0.5 );
        vec2 lutUv = vec2(
          ( idx.r + 0.5 ) / uLutSize,
          ( idx.g * uLutSize + idx.b + 0.5 ) / ( uLutSize * uLutSize )
        );
        col = texture2D( tPalette, lutUv ).rgb;
      }

      // Written raw: the canvas is already an sRGB surface.
      gl_FragColor = vec4( col, 1.0 );
    }
  `,
};

// --------------------------------------------------------------------------
// The chain
// --------------------------------------------------------------------------

/**
 * Build the retro post chain.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @returns {{
 *   available: boolean, enabled: boolean, pixelSize: number,
 *   error: Error|null, composer: THREE.EffectComposer|null,
 *   render: (dt?:number)=>void,
 *   setEnabled: (b:boolean)=>void,
 *   setPixelSize: (n:number)=>void,
 *   resize: (w:number,h:number)=>void,
 *   dispose: ()=>void,
 * }}
 */
export function createPostFX(renderer, scene, camera) {
  const state = {
    available: false,
    enabled: false,
    pixelSize: DEFAULT_PIXEL_SIZE,
    error: null,
    composer: null,
  };

  let composer = null;
  let retroPass = null;
  let lutTexture = null;

  // ---- build (guarded) ---------------------------------------------------
  try {
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    // NoColorSpace on purpose: three writes LINEAR values into a render
    // target, and the shader does the sRGB encode itself before the lookup.
    rt.texture.colorSpace = THREE.NoColorSpace;

    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(1);
    composer.addPass(new RenderPass(scene, camera));

    const lut = buildPaletteLut();
    lutTexture = new THREE.DataTexture(lut.data, lut.width, lut.height, THREE.RGBAFormat);
    lutTexture.magFilter = THREE.NearestFilter;
    lutTexture.minFilter = THREE.NearestFilter;
    lutTexture.generateMipmaps = false;
    lutTexture.colorSpace = THREE.NoColorSpace;
    lutTexture.needsUpdate = true;

    retroPass = new ShaderPass(RetroShader);
    retroPass.material.uniforms.tPalette.value = lutTexture;
    retroPass.material.uniforms.uLutSize.value = lut.width;
    composer.addPass(retroPass);

    state.composer = composer;
    state.available = true;
  } catch (err) {
    // EffectComposer (or one of its passes) could not be built. Fall back to
    // direct rendering; the game must still run.
    state.error = err instanceof Error ? err : new Error(String(err));
    composer?.dispose?.();
    composer = null;
    retroPass = null;
  }

  // ---- sizing ------------------------------------------------------------
  function currentBufferSize() {
    const size = new THREE.Vector2();
    renderer.getDrawingBufferSize(size);
    return { w: Math.max(1, size.x), h: Math.max(1, size.y) };
  }

  function applySize() {
    if (!composer) return;
    const { w, h } = currentBufferSize();
    const chunk = Math.max(1, Math.floor(state.pixelSize));
    const lowW = Math.max(1, Math.ceil(w / chunk));
    const lowH = Math.max(1, Math.ceil(h / chunk));
    composer.setSize(lowW, lowH);
    if (retroPass) {
      retroPass.material.uniforms.uResolution.value.set(lowW, lowH);
    }
  }

  function render(dt) {
    if (!state.available || !state.enabled || !composer) {
      renderer.render(scene, camera);
      return;
    }
    try {
      composer.render(dt);
    } catch (err) {
      // A failing post pass must never take the game down: drop the chain
      // and go back to direct rendering for the rest of the session.
      state.available = false;
      state.enabled = false;
      state.error = err instanceof Error ? err : new Error(String(err));
      renderer.render(scene, camera);
    }
  }

  function setEnabled(b) {
    state.enabled = !!b && state.available;
    if (state.enabled) applySize();
  }

  function setPixelSize(n) {
    const v = Number(n);
    state.pixelSize = Number.isFinite(v) ? Math.max(1, Math.floor(v)) : DEFAULT_PIXEL_SIZE;
    if (state.enabled) applySize();
  }

  function resize() {
    if (state.enabled) applySize();
  }

  function dispose() {
    try {
      composer?.dispose?.();
      lutTexture?.dispose?.();
    } catch {
      /* disposing twice must not throw */
    }
    composer = null;
    retroPass = null;
    lutTexture = null;
    state.available = false;
    state.enabled = false;
    state.composer = null;
    if (activePostFX === service) activePostFX = null;
  }

  const service = {
    get available() { return state.available; },
    get enabled() { return state.enabled; },
    get pixelSize() { return state.pixelSize; },
    get error() { return state.error; },
    get composer() { return state.composer; },
    render,
    setEnabled,
    setPixelSize,
    resize,
    dispose,
  };

  applySize();
  activePostFX = service;
  return service;
}

/**
 * Enable or disable the most recently created post chain.
 * @param {boolean} enabled
 */
export function setPostFXEnabled(enabled) {
  activePostFX?.setEnabled(enabled);
}

/**
 * Set the pixel chunk size of the most recently created post chain.
 * 1 = no downscale, 2 = half resolution, 3 = third resolution, ...
 * @param {number} n
 */
export function setPixelSize(n) {
  activePostFX?.setPixelSize(n);
}

/** Tear down the most recently created post chain. */
export function disposePostFX() {
  activePostFX?.dispose();
}
