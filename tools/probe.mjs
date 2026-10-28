#!/usr/bin/env node
/**
 * tools/probe.mjs — dump whatever the page tells us about a failed boot.
 *
 *   node tools/probe.mjs http://localhost:4173/ 25000
 *
 * Prints: console errors, uncaught page errors, failed network requests,
 * the #fatal pane text, window.SUPERCITYCON.bootLog, and the ready flag.
 */
import { chromium } from '/Users/mac/.local/pw/node_modules/playwright/index.mjs';

const url = process.argv[2] || 'http://localhost:4173/';
const waitMs = Number(process.argv[3] || 25000);

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleErrors = [];
const consoleAll = [];
const pageErrors = [];
const failedReqs = [];
const responses404 = [];

page.on('console', (m) => {
  consoleAll.push(`[${m.type()}] ${m.text()}`);
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => pageErrors.push(`${e.message}\n${e.stack || ''}`));
page.on('requestfailed', (r) => failedReqs.push(`${r.failure()?.errorText} ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 400) responses404.push(`${r.status()} ${r.url()}`); });

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(waitMs);

const info = await page.evaluate(() => {
  const fatal = document.getElementById('fatal');
  const boot = document.getElementById('boot');
  return {
    hasSC: typeof window.SUPERCITYCON !== 'undefined',
    ready: window.SUPERCITYCON?.state?.meta?.ready ?? null,
    bootLog: window.SUPERCITYCON?.bootLog ?? null,
    domains: window.SUPERCITYCON ? Object.keys(window.SUPERCITYCON.ctx?.domains || {}) : null,
    fatalDisplay: fatal ? getComputedStyle(fatal).display : 'no-el',
    fatalText: fatal ? fatal.textContent.slice(0, 4000) : null,
    bootDisplay: boot ? getComputedStyle(boot).display : 'no-el',
    bootText: boot ? boot.textContent.slice(0, 1000) : null,
    scripts: Array.from(document.scripts).map((s) => s.src || '(inline)'),
  };
});

console.log('===== PROBE', url, '=====');
console.log(JSON.stringify(info, null, 2));
console.log('--- console (all) ---');
console.log(consoleAll.slice(0, 60).join('\n'));
console.log('--- console errors ---');
console.log(consoleErrors.join('\n') || '(none)');
console.log('--- page errors ---');
console.log(pageErrors.join('\n\n') || '(none)');
console.log('--- failed requests ---');
console.log(failedReqs.slice(0, 40).join('\n') || '(none)');
console.log('--- 4xx/5xx responses ---');
console.log(responses404.slice(0, 40).join('\n') || '(none)');

await browser.close();
