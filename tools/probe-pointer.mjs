#!/usr/bin/env node
/**
 * tools/probe-pointer.mjs — why does the canvas click not place a building?
 *
 *   node tools/probe-pointer.mjs http://localhost:4173/
 *
 * Reproduces the scenario's pointer sequence and reports, at the moment of
 * the click: which element is under the pointer, what the domain says about
 * that cell, and what the game did.
 */
import { chromium } from '/Users/mac/.local/pw/node_modules/playwright/index.mjs';

const url = process.argv[2] || 'http://localhost:4173/';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle',
    '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true, null, { timeout: 120000 });
await page.waitForTimeout(2000);

// Find a clickable cell the same way the scenario does.
const target = await page.evaluate(() => {
  const S = window.SUPERCITYCON;
  const r = S.renderer;
  const canvas = r.renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  const x0 = rect.left + 220; const x1 = rect.left + rect.width - 220;
  const y0 = rect.top + 160;  const y1 = rect.top + rect.height - 260;
  for (let y = y0; y <= y1; y += 14) {
    for (let x = x0; x <= x1; x += 14) {
      const hit = r.screenToGround(x, y);
      if (!hit) continue;
      const cell = S.ctx.config.worldToCellInt(hit.x, hit.z);
      const top = document.elementFromPoint(x, y);
      if (!top || (top !== canvas && !canvas.contains(top))) continue;
      return { cx: cell.x, cz: cell.z, x, y, topTag: top.tagName, topClass: top.className };
    }
  }
  return null;
});
console.log('target cell:', JSON.stringify(target));

// Click the build tool, then a shop card — exactly as the scenario does.
await page.locator('#ui-root [data-sc-tool="build"]').click({ timeout: 20000 });
await page.locator('#ui-root [data-sc-card="res.house"]').click({ timeout: 20000 });
await page.waitForTimeout(300);

// What is under the pointer NOW?
const before = await page.evaluate((t) => {
  const S = window.SUPERCITYCON;
  const canvas = S.renderer.renderer.domElement;
  const top = document.elementFromPoint(t.x, t.y);
  const B = S.ctx.domains.buildings;
  const canPlace = B.canPlace ? B.canPlace('res.house', t.cx, t.cz) : null;
  return {
    tool: S.state.ui.tool,
    selectedType: S.state.ui.selectedType,
    topTag: top ? top.tagName : null,
    topClass: top ? String(top.className) : null,
    topIsCanvas: top === canvas,
    topInUiRoot: !!top && !!top.closest && !!top.closest('#ui-root'),
    openPanel: S.state.ui.panel,
    canPlace,
    instances: S.state.buildings.instances.size,
  };
}, target);
console.log('before the canvas click:', JSON.stringify(before, null, 2));

await page.mouse.click(target.x, target.y);
await page.waitForTimeout(1500);

const after = await page.evaluate((t) => {
  const S = window.SUPERCITYCON;
  return {
    instances: S.state.buildings.instances.size,
    buildingHere: S.ctx.domains.buildings.buildingAt(t.cx, t.cz),
    toasts: (S.state.ui.toasts || []).map((x) => x.message),
    tool: S.state.ui.tool,
    selectedType: S.state.ui.selectedType,
  };
}, target);
console.log('after the canvas click:', JSON.stringify(after, null, 2));

await browser.close();
