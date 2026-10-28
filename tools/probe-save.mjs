#!/usr/bin/env node
/**
 * tools/probe-save.mjs — why did "a fresh session loads the save file" time out?
 *
 *   node tools/probe-save.mjs http://127.0.0.1:4321/
 *
 * It reproduces the harness's session-A / session-B sequence and measures how
 * long session B takes to reach `ready`, with session A OPEN and with session A
 * CLOSED, and reports session B's page errors either way.
 */
import { chromium } from '/Users/mac/.local/pw/node_modules/playwright/index.mjs';

const url = process.argv[2] || 'http://127.0.0.1:4321/';
const captureUrl = url.includes('?') ? `${url}&capture=1` : `${url}?capture=1`;

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle',
    '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

// ---- session A: boot, write a save -----------------------------------------
const A = await context.newPage();
const aErrors = [];
A.on('pageerror', (e) => aErrors.push(e.message));
await A.goto(captureUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
let t0 = Date.now();
await A.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true, null, { timeout: 180000 });
console.log(`session A ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const saved = await A.evaluate(() => {
  const save = window.SUPERCITYCON.ctx.core.save;
  return { wrote: save.saveToStorage(window.SUPERCITYCON.state, 'scenario') };
});
console.log('save written:', saved.wrote);

// ---- session B: boot WITH session A still rendering --------------------------
const B = await context.newPage();
const bErrors = [];
const bConsole = [];
B.on('pageerror', (e) => bErrors.push(e.message));
B.on('console', (m) => { if (m.type() === 'error') bConsole.push(m.text()); });

t0 = Date.now();
await B.goto(captureUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log(`session B DOM loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
try {
  await B.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true, null, { timeout: 180000 });
  console.log(`session B ready (A open) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} catch (err) {
  console.log(`session B did NOT become ready with A open: ${err.message}`);
  console.log('B page errors:', JSON.stringify(bErrors.slice(0, 5)));
  console.log('B console errors:', JSON.stringify(bConsole.slice(0, 5)));
  const partial = await B.evaluate(() => ({
    hasGame: !!window.SUPERCITYCON,
    meta: window.SUPERCITYCON?.state?.meta ?? null,
    fatal: document.querySelector('#fatal')?.textContent?.slice(0, 300) ?? null,
  })).catch((e) => ({ error: e.message }));
  console.log('B partial state:', JSON.stringify(partial));
}
await B.close().catch(() => {});

// ---- session C: boot with session A CLOSED ---------------------------------
await A.close().catch(() => {});
const C = await context.newPage();
const cErrors = [];
C.on('pageerror', (e) => cErrors.push(e.message));
t0 = Date.now();
await C.goto(captureUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
try {
  await C.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true, null, { timeout: 180000 });
  console.log(`session C ready (A closed) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const loaded = await C.evaluate(() => {
    const S = window.SUPERCITYCON;
    const save = S.ctx.core.save;
    const restored = save.loadFromStorage('scenario');
    return {
      restored: !!restored,
      after: S.state.buildings.instances.size,
      models: window.__sc?.modelCount?.() ?? null,
    };
  });
  console.log('session C load result:', JSON.stringify(loaded));
} catch (err) {
  console.log(`session C did NOT become ready: ${err.message}`);
  console.log('C page errors:', JSON.stringify(cErrors.slice(0, 5)));
}
await C.close().catch(() => {});

console.log('session A page errors:', JSON.stringify(aErrors.slice(0, 5)));
await browser.close();
