#!/usr/bin/env node
/**
 * tools/package-game-release.mjs — assemble the V7 game release package.
 *
 * The shippable artefact of SuperCitycon is the CLEARED static bundle. This
 * script packages it, writes a SHA-256 for every file in it, and refuses to
 * package anything that looks like a credential.
 *
 * Usage:
 *   node tools/package-game-release.mjs [--dist <dir>] [--out <dir>]
 *                                       [--version <version>]
 *
 * What it produces:
 *   <out>/supercitycon-<version>-cleared.tar.gz   the package
 *   <out>/supercitycon-<version>-cleared.sha256   the package's own checksum
 *   <out>/MANIFEST.sha256                         every file in the bundle
 *
 * Exit code: 0 on success, 1 on failure.
 */
import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync,
  statSync, writeFileSync,
} from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const DIST = resolve(ROOT, argOf('dist', 'game/dist'));
const OUT = resolve(ROOT, argOf('out', 'release'));
const VERSION = argOf('version', (() => {
  try {
    return JSON.parse(readFileSync(resolve(ROOT, 'game/package.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
})());

/**
 * The paths that must never be in a shipped package.
 *
 * The cleared build already strips them, and the build FAILS if any
 * survives — but a package is the last chance to catch one, so the package
 * checks again.
 */
const FORBIDDEN = [
  { pattern: /(^|[\\/])assets[\\/]ui([\\/]|$)/, reason: 'the uncleared 2D HUD art' },
  { pattern: /(^|[\\/])ui-assets\.json$/, reason: 'the uncleared 2D art manifest' },
  { pattern: /(^|[\\/])DO-NOT-PUBLISH\.txt$/, reason: 'the do-not-publish marker' },
  { pattern: /(^|[\\/])\.env(\.|$)/, reason: 'an environment file' },
  { pattern: /(^|[\\/])(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/, reason: 'a private key' },
  { pattern: /(^|[\\/])credentials\.json$/, reason: 'a credentials file' },
  { pattern: /(^|[\\/])secrets?\.json$/, reason: 'a secrets file' },
];

/** The credential shapes, checked in every text file in the bundle. */
const SECRET_RULES = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
];

/**
 * Every file under a folder, in a stable order.
 * @param {string} dir
 * @returns {Array<string>}
 */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * The SHA-256 of a file.
 * @param {string} file
 * @returns {string}
 */
function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function main() {
  if (!existsSync(DIST)) {
    process.stderr.write(`No bundle at ${DIST}. Run "npm run build:cleared" first.\n`);
    process.exit(1);
  }

  const files = walk(DIST);
  if (!files.length) {
    process.stderr.write(`The bundle at ${DIST} is empty.\n`);
    process.exit(1);
  }

  // --- the exclusions -------------------------------------------------------
  const problems = [];
  for (const file of files) {
    const rel = relative(DIST, file).split(sep).join('/');
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(rel)) problems.push(`${rel} — ${rule.reason}`);
    }
    if (/\.(js|mjs|cjs|json|html|txt|md|css)$/.test(rel)) {
      let text;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      for (const rule of SECRET_RULES) {
        if (rule.test(text)) problems.push(`${rel} — a credential-shaped value`);
      }
    }
  }
  if (problems.length) {
    process.stderr.write('REFUSING to package:\n');
    for (const problem of problems) process.stderr.write(`  ${problem}\n`);
    process.exit(1);
  }

  // --- the manifest ---------------------------------------------------------
  const manifest = [];
  let totalBytes = 0;
  for (const file of files) {
    const rel = relative(DIST, file).split(sep).join('/');
    const size = statSync(file).size;
    totalBytes += size;
    manifest.push(`${sha256(file)}  ${rel}`);
  }
  manifest.sort((a, b) => a.slice(66).localeCompare(b.slice(66)));

  mkdirSync(OUT, { recursive: true });
  const manifestPath = join(OUT, 'MANIFEST.sha256');
  writeFileSync(manifestPath, `${manifest.join('\n')}\n`);

  // --- the package ----------------------------------------------------------
  const packageName = `supercitycon-${VERSION}-cleared.tar.gz`;
  const packagePath = join(OUT, packageName);
  rmSync(packagePath, { force: true });
  // `tar` is deterministic enough for a release artefact and is present on
  // every platform this project supports.
  execFileSync('tar', ['-czf', packagePath, '-C', DIST, '.'], { stdio: 'inherit' });

  const packageHash = sha256(packagePath);
  writeFileSync(`${packagePath}.sha256`, `${packageHash}  ${packageName}\n`);

  process.stdout.write(`package: ${relative(ROOT, packagePath)}\n`);
  process.stdout.write(`  files:   ${files.length}\n`);
  process.stdout.write(`  size:    ${(totalBytes / 1048576).toFixed(1)} MB\n`);
  process.stdout.write(`  sha256:  ${packageHash}\n`);
  process.stdout.write(`manifest: ${relative(ROOT, manifestPath)}\n`);
  process.stdout.write('PASS — the package is clean and hashed\n');
}

main();
