#!/usr/bin/env node
/**
 * V4 — prepare the licence-cleared asset subset.
 *
 * The V4 app is self-contained: it serves its own copies of the 3D models the
 * project already owns and has already cleared (CC0-1.0 / MIT). It must never
 * copy the 2D art — those 69 files are licence-unverified at source and are
 * quarantined (see v4/data/quarantine-2d.json).
 *
 * This script is deliberately explicit about what it copies and what it
 * refuses, and it verifies the copy rather than trusting it.
 *
 * Usage: node scripts/prepare-assets.mjs [--check]
 */
import { cp, mkdir, readdir, stat, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const V4 = resolve(HERE, '..');
const REPO = resolve(V4, '..');
const SOURCE_MODELS = join(REPO, 'game', 'public', 'assets', 'models');
const SOURCE_LICENCES = join(REPO, 'game', 'public', 'assets', 'LICENSES');
const TARGET_MODELS = join(V4, 'public', 'assets', 'models');
const TARGET_LICENCES = join(V4, 'public', 'assets', 'LICENSES');

/** Anything under the 2D art is quarantined and must never be copied. */
const FORBIDDEN = ['ui', 'ui-assets.json'];

async function hashFile(path) {
  const { readFile } = await import('node:fs/promises');
  const buf = await readFile(path);
  return createHash('sha256').update(buf).digest('hex');
}

async function walk(dir, base = dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, base, out);
    else out.push(p);
  }
  return out;
}

export async function prepareAssets({ check = false } = {}) {
  if (!existsSync(SOURCE_MODELS)) {
    throw new Error(`source models not found: ${SOURCE_MODELS}`);
  }
  const files = await walk(SOURCE_MODELS);
  const refused = files.filter((f) => FORBIDDEN.some((bad) => f.includes(`/${bad}/`) || f.endsWith(`/${bad}`)));

  if (check) {
    const target = existsSync(TARGET_MODELS) ? await walk(TARGET_MODELS) : [];
    return { source: files.length, target: target.length, refused: refused.length, missing: files.length - target.length };
  }

  await rm(TARGET_MODELS, { recursive: true, force: true });
  await mkdir(TARGET_MODELS, { recursive: true });
  let copied = 0;
  let bytes = 0;
  for (const file of files) {
    const rel = file.slice(SOURCE_MODELS.length + 1);
    if (FORBIDDEN.some((bad) => rel === bad || rel.startsWith(`${bad}/`))) continue;
    const target = join(TARGET_MODELS, rel);
    await mkdir(dirname(target), { recursive: true });
    await cp(file, target);
    copied += 1;
    bytes += (await stat(target)).size;
  }

  // The licence texts for the packs that are actually shipped.
  await mkdir(TARGET_LICENCES, { recursive: true });
  let licenceFiles = 0;
  if (existsSync(SOURCE_LICENCES)) {
    for (const name of await readdir(SOURCE_LICENCES)) {
      await cp(join(SOURCE_LICENCES, name), join(TARGET_LICENCES, name));
      licenceFiles += 1;
    }
  }

  const manifest = {
    generatedBy: 'v4/scripts/prepare-assets.mjs',
    note: 'Only licence-cleared 3D models are copied. The 2D art is licence-unverified and quarantined; it is never copied here.',
    models: copied,
    licenceTexts: licenceFiles,
    refused: refused.map((f) => f.slice(SOURCE_MODELS.length + 1)),
    bytes,
  };
  await writeFile(join(V4, 'public', 'assets', 'CLEARED-ASSETS.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  // Verify: every copied file must exist at the target and hash identically.
  const verified = [];
  for (const file of files) {
    const rel = file.slice(SOURCE_MODELS.length + 1);
    if (FORBIDDEN.some((bad) => rel === bad || rel.startsWith(`${bad}/`))) continue;
    const target = join(TARGET_MODELS, rel);
    if (!existsSync(target)) continue;
    if (await hashFile(file) === await hashFile(target)) verified.push(rel);
  }

  return { copied, verified: verified.length, licenceFiles, bytes, refused: manifest.refused };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  const result = await prepareAssets({ check });
  if (check) {
    console.log(`source ${result.source} files, target ${result.target} files, refused ${result.refused}`);
  } else {
    console.log(`copied ${result.copied} model files (${(result.bytes / 1024 / 1024).toFixed(1)} MB), verified ${result.verified} by sha256`);
    console.log(`licence texts copied: ${result.licenceFiles}`);
    console.log(`refused (quarantined 2D art): ${result.refused.length ? result.refused.join(', ') : 'none present in the source tree'}`);
  }
}
