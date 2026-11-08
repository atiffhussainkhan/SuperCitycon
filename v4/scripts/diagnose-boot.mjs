#!/usr/bin/env node
/**
 * V4 — boot diagnostic.
 *
 * Loads the built app in a real browser, prints every console message, page
 * error and failed request, and reports what `window.__v4` looks like after a
 * settle period. It answers "why did the app not reach ready?" without
 * guessing.
 *
 * Usage: node scripts/diagnose-boot.mjs [--url <url>] [--seconds 20]
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChromium } from '../../tools/playwright-resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const V4 = resolve(HERE, '..');
const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const SECONDS = Number(argOf('seconds', '20'));
const HEADED = argv.includes('--headed');
const OUT = resolve(argOf('out', join(V4, 'verification', 'diagnostics')));
const PORT = Number(argOf('port', '4181'));
const EXTERNAL_URL = argOf('url', null);

async function waitForServer(url, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  let server = null;
  let url = EXTERNAL_URL;
  if (!url) {
    server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      cwd: V4, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', () => {});
    server.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
    url = `http://127.0.0.1:${PORT}/`;
    if (!await waitForServer(url)) throw new Error(`preview server did not come up at ${url}`);
  }

  const { chromium } = await resolveChromium();
  const browser = await chromium.launch({
    headless: !HEADED,
    chromiumSandbox: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  const log = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', (m) => log.push({ kind: 'console', type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => log.push({ kind: 'pageerror', text: String(e?.stack ?? e?.message ?? e) }));
    page.on('requestfailed', (r) => log.push({ kind: 'requestfailed', url: r.url(), reason: r.failure()?.errorText }));
    page.on('response', (r) => { if (r.status() >= 400) log.push({ kind: 'http', status: r.status(), url: r.url() }); });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(SECONDS * 1000);

    const state = await page.evaluate(() => {
      const v4 = window.__v4;
      return {
        bodyAttr: document.body?.getAttribute('data-v4-ready'),
        hasV4: !!v4,
        version: v4?.version ?? null,
        ready: v4?.ready ?? null,
        entities: v4?.world?.entityCount ?? null,
        editor: !!v4?.editor,
        npc: !!v4?.npc,
        hud: !!v4?.hud,
        player: v4?.player ?? null,
        level: v4?.level ?? null,
        errors: (v4?.logger?.errors?.() ?? []).map((e) => ({ message: e.message, data: e.data ?? null })),
        warnings: (v4?.logger?.records?.('warn') ?? []).map((e) => e.message),
        infos: (v4?.logger?.records?.('info') ?? []).map((e) => e.message),
        status: document.getElementById('status')?.textContent ?? null,
      };
    });

    await page.screenshot({ path: join(OUT, 'boot-state.png'), fullPage: false });

    console.log(JSON.stringify({ state, log }, null, 2));
    await writeFile(join(OUT, 'boot-diagnostic.json'), `${JSON.stringify({ state, log }, null, 2)}\n`, 'utf8');
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('[v4/diagnose] failed:', err?.stack ?? err?.message ?? err);
  process.exit(2);
});
