#!/usr/bin/env node
/**
 * tests/index.mjs — the test entry point for `node --test tests/`.
 *
 * `node --test tests/` resolves this directory through `tests/package.json`,
 * which points at this file. Every `*.test.mjs` in this folder is imported
 * here, so a new test file is picked up without anyone editing this file.
 */

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const files = readdirSync(here)
  .filter((name) => name.endsWith('.test.mjs'))
  .sort();

for (const file of files) {
  await import(pathToFileURL(join(here, file)).href);
}
