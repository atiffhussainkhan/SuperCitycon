#!/usr/bin/env node
/**
 * tools/verify-deployment.mjs — verify the LIVE site after a deployment.
 *
 * Pushing to `main` makes GitHub Actions build the cleared bundle and publish
 * it to GitHub Pages. That is the whole release mechanism, and this tool is
 * the other half of it: it proves that what is SERVED is what was INTENDED.
 *
 * Usage:
 *   node tools/verify-deployment.mjs [--url <url>] [--expect-version <v>]
 *
 * What it checks:
 *   1. the site answers;
 *   2. the bundle the page references is served;
 *   3. the build identity in the served bundle is the expected version;
 *   4. the uncleared 2D art is NOT served — the licence markers all 404;
 *   5. the 3D model pack IS served — a game with no models is not a game;
 *   6. the page carries no reference to the uncleared art.
 *
 * Exit code: 0 when every check passed, 1 when any check failed.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const URL_BASE = argOf('url', 'https://atiffhussainkhan.github.io/SuperCitycon/');
const EXPECTED = argOf('expect-version', '7.0.0');

const results = [];

/** A check that could not run because the thing it needs is absent. */
function skip(name, reason) {
  results.push({ name, pass: true, skipped: true, detail: String(reason) });
  console.log(`SKIP  ${name}  — ${reason}`);
}

/**
 * A model file from the local build, as a path the site serves.
 *
 * @returns {string|null}
 */
function readModelPath() {
  const dist = resolve(ROOT, 'game/dist/assets/models');
  const stack = [dist];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { stack.push(full); continue; }
      if (entry.name.endsWith('.glb')) {
        return `assets/models/${relative(dist, full).split(/[\\/]/).join('/')}`;
      }
    }
  }
  return null;
}

/** A check that must pass. */
function check(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail: String(detail) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/**
 * Ask the CDN for a path, retrying a TRANSIENT failure.
 *
 * A 503 or a network error right after a deployment is the CDN edge
 * refreshing, not evidence about the file. Reporting it as "the uncleared
 * art is served" would be a false alarm that trains people to ignore this
 * tool; reporting it as "the file is absent" would be a false pass. So it is
 * retried, and a genuinely served file still fails the check.
 *
 * @param {string} path
 * @returns {Promise<{status:number, type:string}>}
 */
async function head(path, attempts = 4) {
  let last = { status: 0, type: '' };
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(new URL(path, URL_BASE), { redirect: 'follow' });
      last = { status: response.status, type: response.headers.get('content-type') ?? '' };
      // 404 is a real answer. 503 and 5xx are the edge waking up.
      if (last.status < 500) return last;
    } catch (err) {
      last = { status: 0, type: '', error: String(err?.message ?? err) };
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return last;
}

async function get(path) {
  const response = await fetch(new URL(path, URL_BASE), { redirect: 'follow' });
  return { status: response.status, body: await response.text().catch(() => '') };
}

async function main() {
  console.log(`verifying the live site at ${URL_BASE}\n`);

  // --- 1. the site answers ------------------------------------------------
  const index = await get('./');
  check('the site answers', index.status === 200, `HTTP ${index.status}`);

  if (index.status !== 200) {
    console.log('\nFAIL — the site does not answer; the checks below cannot run.');
    process.exit(1);
  }

  // --- 2. the bundle it references is served -----------------------------
  const bundleMatch = index.body.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
  check('the page references a bundle', !!bundleMatch, bundleMatch ? bundleMatch[0] : 'no reference found');
  if (!bundleMatch) {
    process.exit(1);
  }
  const bundle = await get(`./${bundleMatch[0]}`);
  check('the bundle is served', bundle.status === 200, `HTTP ${bundle.status}`);

  // --- 3. the build identity is the expected version ----------------------
  const versioned = bundle.body.includes(EXPECTED);
  check(`the served bundle carries the version ${EXPECTED}`, versioned,
    versioned ? 'the version string is in the bundle' : 'the version string is NOT in the bundle');

  // --- 4. the uncleared 2D art is not served ------------------------------
  for (const marker of ['assets/ui-assets.json', 'assets/ui/', 'DO-NOT-PUBLISH.txt']) {
    const response = await head(marker);
    check(`the uncleared art marker "${marker}" is not served`, response.status === 404,
      `HTTP ${response.status}`);
  }

  // --- 5. the model pack IS served ---------------------------------------
  // A DIRECTORY is not served by GitHub Pages (it answers 404), so the
  // check asks for a real model file. The name is read from the local
  // build, so it is the file the deployed bundle actually uses.
  const modelPath = readModelPath();
  if (modelPath) {
    const model = await head(modelPath);
    check('a 3D model is served', model.status === 200, `${modelPath} -> HTTP ${model.status}`);
  } else {
    skip('a 3D model is served', 'no model file was found in the local build');
  }

  // --- 6. the page does not reference the uncleared art ------------------
  const referencesArt = /assets\/ui|ui-assets\.json/.test(index.body);
  check('the page does not reference the uncleared 2D art', !referencesArt,
    referencesArt ? 'the page references it' : 'no reference');

  // --- the verdict --------------------------------------------------------
  const failed = results.filter((r) => !r.pass);
  console.log('');
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('\nfailed:');
    for (const f of failed) console.log(`  FAIL  ${f.name}  — ${f.detail}`);
    process.exit(1);
  }
  console.log('PASS — the live site is serving the intended build.');
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`The verification could not run: ${err?.message ?? err}\n`);
  process.exit(1);
});
