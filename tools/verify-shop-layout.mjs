#!/usr/bin/env node
// Check real game category visibility. This is a layout test, not a GPU/FPS test.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolveChromium } from './playwright-resolve.mjs';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const outDir = process.argv[3] ?? '/tmp/supercity-shop-layout';
mkdirSync(outDir, { recursive: true });
const { chromium } = await resolveChromium();
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.setDefaultTimeout(15000);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true, null, { timeout: 120000 });
  await page.locator('[data-sc-shop-tabs] .sc-tab').first().waitFor();
  for (const viewport of [{ width: 1600, height: 900 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const geometry = await page.evaluate(() => {
      const strip = document.querySelector('[data-sc-shop-tabs]');
      const bounds = strip.getBoundingClientRect();
      const tabs = [...strip.querySelectorAll('.sc-tab')].map((tab) => {
        const r = tab.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
          id: tab.dataset.scTab, text: tab.textContent.trim(),
          left: r.left, right: r.right, top: r.top, bottom: r.bottom,
          visible: r.width > 0 && r.height > 0 && r.left >= bounds.left - 1 && r.right <= bounds.right + 1
            && r.top >= 0 && r.bottom <= innerHeight && (hit === tab || tab.contains(hit)),
        };
      });
      return { expected: window.SUPERCITYCON.ctx.domains.buildings.catalogue().reduce((s, d) => s.add(d.category || 'other'), new Set()).size,
        tabs, strip: { width: bounds.width, scrollWidth: strip.scrollWidth, height: bounds.height } };
    });
    assert.equal(geometry.tabs.length, geometry.expected, 'every catalogue category has a tab');
    assert.ok(geometry.tabs.every((tab) => tab.visible), `${viewport.width}px hidden tabs: ${geometry.tabs.filter((tab) => !tab.visible).map((tab) => tab.id).join(', ')}`);
    assert.ok(geometry.strip.scrollWidth <= geometry.strip.width + 1, 'category strip has no hidden horizontal overflow');
    const last = page.locator('[data-sc-shop-tabs] .sc-tab').last();
    const lastId = await last.getAttribute('data-sc-tab');
    await last.click();
    await page.waitForFunction((id) => document.querySelector(`[data-sc-tab="${id}"]`)?.classList.contains('is-active'), lastId);
    await page.screenshot({ path: `${outDir}/shop-${viewport.width}.png`, animations: 'disabled', timeout: 30000 });
    results.push({ viewport, ...geometry, lastCategoryClicked: lastId, pass: true });
    console.log(`PASS ${viewport.width}x${viewport.height}: ${geometry.tabs.length} categories visible; last category ${lastId} clicks`);
  }
  writeFileSync(`${outDir}/shop-layout.json`, JSON.stringify({ url, results }, null, 2));
} finally {
  await browser.close();
}
