#!/usr/bin/env node
/**
 * tools/verify-production.mjs — prove the PRODUCTION bundle, not just the dev
 * server.
 *
 * A green `vite build` says nothing about whether the built game runs: the
 * asset paths, the manifest and the 2D art all have to resolve from `dist/`.
 * This script is the step that closes that gap:
 *
 *   1. build the game into `dist/`,
 *   2. report what landed in `dist/` (file count, total size, by extension),
 *   3. start `vite preview` on a free port,
 *   4. run the acceptance harness (`tools/scenario.mjs`) against the preview
 *      URL, so the production bundle is played exactly like the dev server,
 *   5. shut the preview down and exit with the harness's verdict.
 *
 * Usage:
 *   node tools/verify-production.mjs [--port 4173] [--outdir /tmp/sc-prod]
 *                                    [--profile cleared|local]
 *
 * The profile defaults to **cleared** — the publishable build, the same one
 * `.github/workflows/deploy.yml` produces and deploys. The harness used to
 * build the LOCAL profile, so "verify:production" was proving a bundle that
 * CI never ships and that carries the uncleared 2D art. Pass `--profile local`
 * to verify the LOCAL build instead.
 *
 * Exit code: 0 when the production run passed, 1 when it failed, 2 when the
 * preview server could not be started at all.
 */
import { spawn } from 'node:child_process';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, '..');
const WORKSPACE = resolve(GAME, '..');
const SCENARIO = join(WORKSPACE, 'tools', 'scenario.mjs');

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const PORT = Number(argOf('port', 4173));
const OUTDIR = argOf('outdir', '/tmp/sc-prod');
const PROFILE = argOf('profile', 'cleared');
if (!['cleared', 'local'].includes(PROFILE)) {
  console.error(`unknown profile "${PROFILE}" — use "cleared" or "local"`);
  process.exit(2);
}

/** Report what the build actually produced. */
function reportDist() {
  const dist = join(GAME, 'dist');
  if (!existsSync(dist)) {
    console.log('[dist] MISSING — the build produced nothing');
    return null;
  }
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
  const files = walk(dist);
  const byExt = new Map();
  let bytes = 0;
  for (const f of files) {
    const s = statSync(f);
    bytes += s.size;
    const ext = f.slice(f.lastIndexOf('.'));
    const e = byExt.get(ext) ?? { count: 0, bytes: 0 };
    e.count += 1;
    e.bytes += s.size;
    byExt.set(ext, e);
  }
  const parts = [...byExt.entries()]
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .map(([ext, e]) => `${ext}: ${e.count} (${(e.bytes / 1048576).toFixed(2)} MB)`);
  console.log(`[dist] ${files.length} files, ${(bytes / 1048576).toFixed(2)} MB total`);
  console.log(`[dist] by extension — ${parts.join(', ')}`);
  return { count: files.length, bytes };
}

/** Run a command, resolving with its exit code. */
function run(cmd, args, opts = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(cmd, args, { cwd: GAME, stdio: 'inherit', ...opts });
    child.on('exit', (code) => resolveRun(code ?? 1));
    child.on('error', () => resolveRun(1));
  });
}

/** Is the preview server answering? */
async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function main() {
  console.log('=== 1. build ===');
  // The publishable profile is the default, because it is the one CI deploys.
  // `SC_SHIP_CLEARED=1` is exactly what `npm run build:cleared` sets.
  const buildEnv = PROFILE === 'cleared'
    ? { ...process.env, SC_SHIP_CLEARED: '1' }
    : { ...process.env };
  const buildCode = await run('npx', ['vite', 'build'], { env: buildEnv });
  if (buildCode !== 0) {
    console.error('the build FAILED — the production bundle cannot be verified');
    return 2;
  }
  console.log(`profile: ${PROFILE}`
    + (PROFILE === 'cleared'
      ? ' (publishable — the same bundle CI deploys)'
      : ' (local — includes the uncleared 2D art)'));

  console.log('\n=== 2. what landed in dist/ ===');
  const dist = reportDist();
  if (!dist) return 2;

  // The publishable bundle must not carry the uncleared 2D art, and must not
  // carry the notice that says the bundle must not be published. These are the
  // same three assertions the deploy workflow makes before it publishes, so
  // this harness cannot pass a bundle that CI would refuse to ship.
  if (PROFILE === 'cleared') {
    const forbidden = [
      ['dist/assets/ui', 'the uncleared 2D art directory'],
      ['dist/assets/ui-assets.json', 'the uncleared 2D art manifest'],
      ['dist/DO-NOT-PUBLISH.txt', 'the "must not be published" notice'],
    ];
    const present = forbidden.filter(([p]) => existsSync(join(GAME, p)));
    if (present.length) {
      for (const [p, what] of present) console.error(`[dist] FORBIDDEN: ${p} — ${what}`);
      console.error('the CLEARED bundle is not publishable — refusing to verify it');
      return 2;
    }
    console.log('[dist] publishable: no uncleared 2D art, no DO-NOT-PUBLISH.txt');
  }

  console.log('\n=== 3. start the preview server ===');
  const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: GAME, stdio: ['ignore', 'pipe', 'pipe'] });
  let previewLog = '';
  preview.stdout.on('data', (d) => { previewLog += d.toString(); });
  preview.stderr.on('data', (d) => { previewLog += d.toString(); });

  const url = `http://localhost:${PORT}/`;
  const up = await waitForServer(url);
  if (!up) {
    console.error(`the preview server did not come up on ${url}`);
    console.error(previewLog.slice(0, 800));
    preview.kill('SIGTERM');
    return 2;
  }
  console.log(`preview server is up on ${url}`);

  console.log('\n=== 4. play the production build ===');
  let scenarioCode = 1;
  try {
    scenarioCode = await run(process.execPath, [SCENARIO, url, OUTDIR, `PROD (vite preview :${PORT})`]);
  } finally {
    preview.kill('SIGTERM');
    // Give the preview a moment to release the port.
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\n=== 5. verdict ===`);
  if (scenarioCode === 0) {
    console.log(`PRODUCTION BUILD VERIFIED — the built game passed the acceptance harness (${OUTDIR})`);
  } else {
    console.error(`PRODUCTION BUILD FAILED the acceptance harness (exit ${scenarioCode}) — see ${OUTDIR}`);
  }
  return scenarioCode === 0 ? 0 : 1;
}

process.exit(await main());
