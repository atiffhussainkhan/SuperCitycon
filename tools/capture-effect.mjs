#!/usr/bin/env node
/**
 * Capture the moment a gameplay EFFECT is actually on screen.
 *
 *   node tools/capture-effect.mjs --url <url> --out <png> [--kind hazard-fire]
 *
 * The VFX effects are short-lived (a fire burst lives ~0.5 s), so a delayed
 * screenshot usually misses them. This tool watches the effect service's own
 * counters, and takes the screenshot the instant the wanted effect is
 * spawned — so the pixels are the effect, not a coincidence.
 *
 * It uses the REAL event path: the loaded hazard enters its active phase,
 * emits HAZARD_STARTED, and the integrator's bridge spawns
 * the effect, and the effect service renders it. Nothing is faked.
 */
import { resolveChromium } from './playwright-resolve.mjs';
const { chromium } = await resolveChromium();
import { writeFileSync } from 'node:fs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const URL_ = arg('url', 'http://127.0.0.1:4188/');
const OUT = arg('out', '/tmp/effect.png');
const KIND = arg('kind', 'hazard-fire');
const LEVEL = arg('level', 'the-long-night');
const W = Number(arg('width', 1600));
const H = Number(arg('height', 1000));

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true, null, { timeout: 120000 });
await page.waitForTimeout(1500);

// Set the scene up: the level, the daylight, the camera on the hazard.
const setup = await page.evaluate(async ({ level }) => {
  const S = window.SUPERCITYCON;
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const modes = S.ctx.core.modes;
  modes.setPaused(true);
  const loaded = await S.loadLevel(level);
  if (!loaded?.ok) throw new Error(`Could not load level ${level}`);
  await nextFrame();
  const dayBtn = document.querySelector('[data-sc-time-preset="day"]');
  if (dayBtn) dayBtn.click();
  for (let i = 0; i < 20; i += 1) await nextFrame();
  const defs = S.ctx.domains.hazards?.defs?.() ?? [];
  const hz = defs[0];
  const WORLD = 4, ORIGIN = -128;
  const wx = (hz?.x ?? 0) * WORLD + ORIGIN;
  const wz = (hz?.z ?? 0) * WORLD + ORIGIN;
  if (S.renderer.focus) { S.renderer.focus.x = wx; S.renderer.focus.z = wz; }
  for (let i = 0; i < 120; i += 1) await nextFrame();
  const armed = hz && S.ctx.domains.hazards.active().some((entry) => entry.id === hz.id);
  return {
    hazard: hz ? { id: hz.id, type: hz.type, cell: [hz.x, hz.z] } : null,
    armed: Boolean(armed),
    terrainHeight: S.ctx.domains.wld?.heightAt?.(hx0(hz), hz?.z) ?? null,
    camera: S.renderer.camera.position.toArray().map((v) => +v.toFixed(1)),
  };
  function hx0(h) { return h?.x ?? 0; }
}, { level: LEVEL });

// Wait for the wanted effect to be spawned, then shoot at once.
const spawned = await page.evaluate(async ({ kind }) => {
  const S = window.SUPERCITYCON;
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const before = S.renderer.fx?.stats?.()?.byKind?.[kind] ?? 0;
  S.ctx.core.modes.setPaused(false);
  for (let i = 0; i < 1200; i += 1) {
    const now = S.renderer.fx?.stats?.()?.byKind?.[kind] ?? 0;
    if (now > before) return { spawned: now - before, waitedFrames: i };
    await nextFrame();
  }
  return { spawned: 0, waitedFrames: 1200 };
}, { kind: KIND });

await page.screenshot({ path: OUT });
const stats = await page.evaluate(() => window.SUPERCITYCON.renderer.fx?.stats?.() ?? null);

writeFileSync(`${OUT}.json`, `${JSON.stringify({ setup, spawned, stats, errors }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ setup, spawned, stats, errors, out: OUT }, null, 2)}\n`);
await browser.close();
process.exit(errors.length || !setup.armed || !spawned.spawned ? 2 : 0);
