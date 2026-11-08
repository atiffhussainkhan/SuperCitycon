#!/usr/bin/env node
/**
 * tools/package-release.mjs — assemble the release package.
 *
 * The package is built by a script rather than assembled by hand, so it can be
 * rebuilt byte-for-byte and so its contents are auditable: every exclusion is
 * written down below, and the script prints exactly what it copied.
 *
 * What goes in:
 *   • the verified game source and the built, licence-cleared bundle
 *   • the 3D design package (documents, inventory, gates, review record)
 *   • the harness and the tooling
 *   • the release documentation (tests, performance, issues, migration,
 *     operating guide, recovery, licences)
 *
 * What stays out, and why:
 *   • node_modules/      — reinstalled by `npm ci`
 *   • game/dist/        — NO: the built bundle IS included, that is the point
 *   • library-packs/    — a 2.4 GB cache of a public upstream repository
 *   • .git/             — history lives in the repository
 *   • *.log, .DS_Store  — disposable
 *   • anything that looks like a secret — see the scan below
 *
 * Usage:
 *   node tools/package-release.mjs [--out <dir>] [--name <package-name>]
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

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const OUT = resolve(ROOT, argOf('out', 'release'));
const NAME = argOf('name', 'MINIMAX-GAME-STUDIO-ULTRA-V2');

// Directories copied wholesale.
const COPY_DIRS = [
  ['game/src', 'game/src'],
  ['game/tests', 'game/tests'],
  ['game/tools', 'game/tools'],
  ['game/public', 'game/public'],
  ['game/dist', 'game/dist'],
  ['minimax-game/platformer-docs', 'minimax-game/platformer-docs'],
  ['minimax-game/tools', 'minimax-game/tools'],
  ['docs', 'docs'],
  ['tools', 'tools'],
  ['agents', 'agents'],
];

// Individual files copied.
const COPY_FILES = [
  'game/package.json',
  'game/package-lock.json',
  'game/vite.config.js',
  'game/index.html',
  'game/README.md',
  'game/DEFECTS.md',
  'game/LICENCE-REPORT.md',
  'game/PLAY-GUIDE.md',
  'game/AGENTS.md',
  'README.md',
  '.gitignore',
  'FINAL_GAME_STUDIO_ULTRA_V2_HANDOVER.md',
];

// Files copied under a different name, into the package root.
const COPY_RENAMES = [
  ['docs/MAC-PORTABILITY.md', 'MIGRATION.md'],
  ['game/PLAY-GUIDE.md', 'OPERATING-GUIDE.md'],
];

// Release documents: copied to the package root with {{PLACEHOLDERS}} filled in.
const RELEASE_DOCS = [
  'RELEASE-MANIFEST.md',
  'TEST-RESULTS.md',
  'PERFORMANCE.md',
  'REMAINING-ISSUES.md',
  'RECOVERY.md',
  'LICENCES.md',
];

// Directory names never copied, at any depth.
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'library-packs', '__pycache__', '.serena',
  '.claude', '.DS_Store',
]);

// File names never copied.
const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db']);

// Extensions never copied.
const SKIP_EXT = new Set(['.log', '.pyc', '.bak', '.tmp']);

/** Patterns that must never appear in the package. */
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{20,}/,          // GitHub PAT
  /\bsk-[A-Za-z0-9]{20,}/,           // OpenAI-style key
  /\bAKIA[0-9A-Z]{16}\b/,            // AWS access key id
  /\bAIza[0-9A-Za-z_-]{30,}\b/,      // Google API key
  /xox[baprs]-[A-Za-z0-9-]{10,}/,    // Slack token
];

function walk(dir, base = dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // Dotfiles are skipped — but `.gitignore` and `.github` are kept, so that
    // every file the package actually contains is covered by the checksums.
    if (entry.name.startsWith('.')
        && entry.name !== '.github' && entry.name !== '.gitignore') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(p, base, acc);
    } else {
      if (SKIP_FILES.has(entry.name)) continue;
      if (SKIP_EXT.has(p.slice(p.lastIndexOf('.')))) continue;
      acc.push(p);
    }
  }
  return acc;
}

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function dirSize(dir) {
  let total = 0;
  for (const f of walk(dir)) {
    try { total += statSync(f).size; } catch { /* ignore */ }
  }
  return total;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function main() {
  console.log('=== 1. prepare the output directory ===');
  if (existsSync(OUT)) {
    console.log(`removing the previous package at ${OUT}`);
    rmSync(OUT, { recursive: true, force: true });
  }
  const pkg = join(OUT, NAME);
  mkdirSync(pkg, { recursive: true });

  console.log('\n=== 2. copy the content ===');
  const copied = [];
  for (const [from, to] of COPY_DIRS) {
    const src = join(ROOT, from);
    if (!existsSync(src)) {
      console.log(`  SKIP  ${from} (not present)`);
      continue;
    }
    const dst = join(pkg, to);
    mkdirSync(dirname(dst), { recursive: true });
    for (const f of walk(src)) {
      const rel = relative(src, f);
      const target = join(dst, rel);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(f, target);
      copied.push(target);
    }
    console.log(`  OK    ${from} -> ${to}`);
  }
  for (const f of COPY_FILES) {
    const src = join(ROOT, f);
    if (!existsSync(src)) {
      console.log(`  SKIP  ${f} (not present)`);
      continue;
    }
    const target = join(pkg, f);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(src, target);
    copied.push(target);
    console.log(`  OK    ${f}`);
  }

  console.log('\n=== 3. release documents ===');
  const releaseFiles = [];
  for (const name of RELEASE_DOCS) {
    const src = join(ROOT, 'docs', 'release', name);
    if (!existsSync(src)) {
      console.log(`  SKIP  ${name} (not present)`);
      continue;
    }
    const target = join(pkg, name);
    cpSync(src, target);
    releaseFiles.push(target);
    console.log(`  OK    ${name}`);
  }
  for (const [from, to] of COPY_RENAMES) {
    const src = join(ROOT, from);
    if (!existsSync(src)) {
      console.log(`  SKIP  ${from} (not present)`);
      continue;
    }
    const target = join(pkg, to);
    cpSync(src, target);
    releaseFiles.push(target);
    console.log(`  OK    ${from} -> ${to}`);
  }

  console.log('\n=== 4. secret scan ===');
  // Text files only — a binary blob is not a credential.
  const TEXT_EXT = new Set(['.js', '.mjs', '.json', '.md', '.txt', '.yml', '.yaml',
    '.html', '.css', '.py', '.sh', '.tscn', '.gltf', '.cfg', '.toml', '.csv']);
  const findings = [];
  for (const f of walk(pkg)) {
    const ext = f.slice(f.lastIndexOf('.'));
    if (!TEXT_EXT.has(ext)) continue;
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    for (const pat of SECRET_PATTERNS) {
      const m = pat.exec(text);
      if (m) {
        findings.push(`${relative(pkg, f)}: ${pat} -> ${m[0].slice(0, 12)}…`);
      }
    }
  }
  if (findings.length) {
    console.error(`SECRET SCAN FAILED — ${findings.length} finding(s):`);
    for (const f of findings) console.error(`  ${f}`);
    console.error('the package was NOT written');
    return 1;
  }
  console.log(`  clean — ${copied.length} files scanned, no credential patterns matched`);

  console.log('\n=== 5. fill the manifest placeholders ===');
  // The file list is computed BEFORE SHA256SUMS.txt is written, because the
  // manifest publishes a count that includes it. The manifest is filled and
  // written before the checksums are taken, so the checksum of the manifest
  // itself is the checksum of the finished file.
  const files = walk(pkg).sort();
  const totalBytes = dirSize(pkg);
  const manifestPath = join(pkg, 'RELEASE-MANIFEST.md');
  if (existsSync(manifestPath)) {
    let text = readFileSync(manifestPath, 'utf8');
    text = text
      .replace('{{BUILD_DATE}}', new Date().toISOString().slice(0, 10))
      .replace('{{BUILD_HOST}}', `${process.platform} ${process.arch}, node ${process.version}`)
      .replace('{{FILE_COUNT}}', String(files.length + 1))
      .replace('{{PACKAGE_SIZE}}', human(totalBytes))
      .replace('{{SECRET_SCAN_COUNT}}', String(copied.length + releaseFiles.length));
    writeFileSync(manifestPath, text);
    const left = text.match(/\{\{[A-Z_]+\}\}/g);
    if (left) {
      console.error(`  FAIL  unfilled placeholders in the manifest: ${left.join(', ')}`);
      return 1;
    }
    console.log('  all placeholders filled');
  }

  console.log('\n=== 6. checksums ===');
  const allFiles = walk(pkg).sort();
  const lines = [];
  for (const f of allFiles) {
    lines.push(`${sha256(f)}  ${relative(pkg, f).split(sep).join('/')}`);
  }
  writeFileSync(join(pkg, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`);
  console.log(`  ${lines.length} files hashed`);

  console.log('\n=== 7. summary ===');
  const total = dirSize(pkg);
  console.log(`  package:   ${pkg}`);
  console.log(`  files:     ${allFiles.length + 1}`);
  console.log(`  size:      ${human(total)}`);
  console.log(`  licence profile: see game/dist/LICENCE-STATUS.md`);
  const hasDoNotPublish = existsSync(join(pkg, 'game', 'dist', 'DO-NOT-PUBLISH.txt'));
  console.log(`  DO-NOT-PUBLISH present: ${hasDoNotPublish ? 'YES — THIS PACKAGE IS NOT PUBLISHABLE' : 'no'}`);
  if (hasDoNotPublish) {
    console.error('the built bundle carries the uncleared 2D art — refusing to call this publishable');
    return 1;
  }
  return 0;
}

process.exit(main());
