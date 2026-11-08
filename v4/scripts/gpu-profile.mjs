#!/usr/bin/env node
/**
 * V4 — real-GPU performance probe.
 *
 * The headless harness forces software GL (SwiftShader), so its frame times
 * are a FLOOR, not a measurement of the machine's GPU. This probe opens a
 * HEADED browser — a real window on the real GPU — records the WebGL
 * renderer identity, and measures the frame-time distribution there.
 *
 * It refuses to report a "GPU" figure when the renderer turns out to be a
 * software implementation: the identity is checked, not assumed.
 *
 * Usage: node scripts/gpu-profile.mjs <url> [--out <dir>] [--seconds 6] [--label name]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChromium } from '../../tools/playwright-resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const V4 = resolve(HERE, '..');
const argv = process.argv.slice(2);
const url = argv.find((a) => a.startsWith('http')) ?? null;
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const OUT = resolve(argOf('out', join(V4, 'verification', 'gpu')));
const SECONDS = Number(argOf('seconds', 6));
const LABEL = argOf('label', 'gpu-profile');

const SOFTWARE = ['swiftshader', 'llvmpipe', 'software', 'microsoft basic render'];

async function main() {
  if (!url) throw new Error('usage: node scripts/gpu-profile.mjs <url> [--out dir] [--seconds n]');
  await mkdir(OUT, { recursive: true });

  const { chromium } = await resolveChromium();
  const browser = await chromium.launch({
    headless: false, // a real window, the machine's real GPU
    args: [
      '--no-sandbox',
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
      '--enable-webgl',
      '--disable-frame-rate-limit',
    ],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    const loadMs = Date.now() - t0;

    // The GPU identity, read from the live WebGL context.
    const gpu = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      if (!gl) return { available: false };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const info = {
        available: true,
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      };
      const r = String(info.renderer ?? '').toLowerCase();
      // The software-renderer list must live INSIDE the page context — the
      // Node-side constant is not available in the browser.
      const software = ['swiftshader', 'llvmpipe', 'software', 'microsoft basic render'];
      info.isSoftware = software.some((s) => r.includes(s));
      return info;
    });

    // The frame-time distribution, measured in the live page.
    const frames = await page.evaluate(async (seconds) => {
      const stamps = [];
      await new Promise((done) => {
        const start = performance.now();
        const tick = (t) => {
          stamps.push(t);
          if (t - start < seconds * 1000) requestAnimationFrame(tick);
          else done();
        };
        requestAnimationFrame(tick);
      });
      const deltas = [];
      for (let i = 1; i < stamps.length; i += 1) deltas.push(stamps[i] - stamps[i - 1]);
      deltas.sort((a, b) => a - b);
      const mean = deltas.reduce((a, b) => a + b, 0) / (deltas.length || 1);
      const median = deltas[Math.floor(deltas.length / 2)] ?? 0;
      const p95 = deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * 0.95))] ?? 0;
      const worst = deltas[deltas.length - 1] ?? 0;
      return {
        frames: deltas.length,
        fps: Number((1000 / mean).toFixed(1)),
        meanMs: Number(mean.toFixed(2)),
        medianMs: Number(median.toFixed(2)),
        p95Ms: Number(p95.toFixed(2)),
        maxMs: Number(worst.toFixed(2)),
      };
    }, SECONDS);

    const engine = await page.evaluate(() => window.__v4?.stats?.() ?? null);

    const report = {
      label: LABEL,
      url,
      at: new Date().toISOString(),
      loadMs,
      gpu,
      frames,
      engineStats: engine,
      consoleErrors,
      hardware: gpu.available && !gpu.isSoftware,
    };

    await writeFile(join(OUT, `${LABEL}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await page.screenshot({ path: join(OUT, `${LABEL}.png`) });

    console.log(`GPU: ${gpu.renderer ?? 'unknown'} (${gpu.vendor ?? '?'})`);
    console.log(`software renderer: ${gpu.isSoftware ? 'YES — this is NOT a hardware measurement' : 'no — hardware'}`);
    console.log(`frames: ${frames.frames} | ${frames.fps} fps | mean ${frames.meanMs} ms | median ${frames.medianMs} ms | p95 ${frames.p95Ms} ms`);
    if (engine) console.log(`engine: ${engine.fps} fps | ${engine.drawCalls} draws | ${engine.triangles} tris`);
    console.log(`console errors: ${consoleErrors.length}`);
    console.log(`report: ${join(OUT, `${LABEL}.json`)}`);

    if (!gpu.available || gpu.isSoftware) {
      console.error('[v4/gpu] refusing to publish a hardware GPU figure: the renderer is a software implementation.');
      return 2;
    }
    return 0;
  } finally {
    await browser.close();
  }
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error('[v4/gpu] probe failed:', err?.message ?? err);
  process.exit(2);
});
