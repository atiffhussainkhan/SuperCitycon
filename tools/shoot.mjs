#!/usr/bin/env node
/**
 * tools/shoot.mjs — headless screenshot + console capture for SuperCitycon.
 *
 * Usage:
 *   node tools/shoot.mjs <url> <outfile.png> [waitMs] [width] [height] [script]
 *
 * `script` is optional JavaScript evaluated in the page before the shot;
 * the file is read from the given path. It may return a value which is
 * printed as JSON (use it to assert on game state).
 */
import { chromium } from '/Users/mac/.local/pw/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:5177/';
const out = process.argv[3] || '/tmp/supercitycon.png';
const waitMs = Number(process.argv[4] || 9000);
const width = Number(process.argv[5] || 1600);
const height = Number(process.argv[6] || 1000);
const scriptPath = process.argv[7] || '';

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const ctx = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} :: ${r.failure()?.errorText}`));

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(waitMs);

  if (scriptPath) {
    const code = readFileSync(scriptPath, 'utf8');
    const result = await page.evaluate(`(async () => { ${code} })()`);
    if (result !== undefined) console.log('EVAL:', JSON.stringify(result, null, 2));
    await page.waitForTimeout(1200);
  }

  await page.screenshot({ path: out });
  console.log(`SHOT: ${out}`);
} catch (err) {
  console.error('SHOOT ERROR:', err.message);
} finally {
  console.log('--- console ---');
  for (const l of logs.slice(0, 80)) console.log(l);
  await browser.close();
}
