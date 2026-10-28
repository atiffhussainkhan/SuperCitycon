#!/usr/bin/env node
/**
 * tools/check-syntax.mjs — run `node --check` over every source file.
 * Exits non-zero when any file fails to parse.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

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

const files = walk(SRC);
let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log(`ok   ${relative(ROOT, f)}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${relative(ROOT, f)}`);
    console.error((err.stderr || err.stdout || '').toString().trim());
  }
}
console.log(`\n${files.length - failed}/${files.length} files parse cleanly.`);
process.exit(failed ? 1 : 0);
