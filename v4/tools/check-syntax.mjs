#!/usr/bin/env node
/**
 * tools/check-syntax.mjs — run `node --check` over every source file.
 *
 * Mirrors the 2D game's style: "N/N files parse cleanly".
 * Exits non-zero when any file fails to parse.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TARGETS = ['src', 'tools'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(m?js)$/.test(name)) out.push(p);
  }
  return out;
}

const files = [];
for (const target of TARGETS) {
  const dir = join(ROOT, target);
  try {
    files.push(...walk(dir));
  } catch {
    // A missing folder is not a failure — there is simply nothing to check.
  }
}
files.sort();

let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log(`ok   ${relative(ROOT, file)}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${relative(ROOT, file)}`);
    console.error((err.stderr || err.stdout || '').toString().trim());
  }
}

console.log(`\n${files.length - failed}/${files.length} files parse cleanly.`);
process.exit(failed ? 1 : 0);
