#!/usr/bin/env node
/**
 * tools/headed.mjs — a REAL browser window, not the headless harness.
 *
 *   node tools/headed.mjs <url> [seconds-to-stay-open]
 *
 * Opens the game in a visible Chromium window with the machine's real GPU,
 * waits for it to reach `ready`, reports every console error, page error and
 * failed request, captures a screenshot, and then leaves the window OPEN for
 * the player to use.
 */
import { chromium } from '/Users/mac/.local/pw/node_modules/playwright/index.mjs';

const url = process.argv[2] || 'http://127.0.0.1:4321/';
const stayOpen = Number(process.argv[3] || 0);
const shot = new URL('../game/screenshots/04-live-window.png', import.meta.url).pathname;

const browser = await chromium.launch({
  headless: false,           // a real window, a real GPU
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});

const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
const pageErrors = [];
const failed = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('requestfailed', (r) => failed.push(`${r.url()} — ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.url()} — HTTP ${r.status()}`); });

const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true, null, { timeout: 120000 });
const bootMs = Date.now() - t0;

await page.waitForTimeout(2500);
const live = await page.evaluate(() => {
  const S = window.SUPERCITYCON;
  const r = S.renderer;
  return {
    renderer: r.renderer?.getContext?.() ? 'webgl' : 'none',
    drawCalls: r.renderer.info.render.calls,
    triangles: r.renderer.info.render.triangles,
    meshes: (() => { let n = 0; r.scene.traverse((o) => { if (o.isMesh) n += 1; }); return n; })(),
    buildings: S.state.buildings.instances.size,
    citizens: S.state.population.total,
    treasury: S.state.economy.treasury,
    day: S.state.meta.day,
    hudButtons: document.querySelectorAll('#ui-root button').length,
    hudIcons: document.querySelectorAll('#ui-root img').length,
    licenceLine: (document.querySelector('[data-sc-licence]')?.textContent || '').trim().slice(0, 80),
  };
});

await page.screenshot({ path: shot });
console.log(`READY in ${(bootMs / 1000).toFixed(1)}s`);
console.log('live state:', JSON.stringify(live, null, 2));
console.log('console errors:', consoleErrors.length ? consoleErrors : '(none)');
console.log('page errors  :', pageErrors.length ? pageErrors : '(none)');
console.log('failed reqs  :', failed.length ? failed : '(none)');
console.log(`screenshot -> ${shot}`);

if (stayOpen > 0) {
  console.log(`the window stays open for ${stayOpen}s`);
  await page.waitForTimeout(stayOpen * 1000);
}
await browser.close();
console.log('closed');
