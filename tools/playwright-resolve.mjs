/**
 * tools/playwright-resolve.mjs — find Playwright, whatever machine this is on.
 *
 * The browser harness used to import Playwright from one absolute path on one
 * machine:
 *
 *     import { chromium } from '/Users/mac/.local/pw/node_modules/playwright/index.mjs';
 *
 * That made the acceptance harness — the single most important verification
 * step in this project — runnable on exactly one computer and nowhere else.
 * A clone of this repository on a MacBook, a CI runner or a colleague's
 * machine could not run the acceptance tests at all.
 *
 * This module resolves the browser driver in a portable order:
 *
 *   1. `PLAYWRIGHT_MODULE` — an explicit path, if the operator sets one.
 *   2. `playwright` — a normal install, resolved from this file's own
 *      `node_modules` chain (so `npm i -D playwright` in the repo works).
 *   3. A short list of well-known local install locations, including the path
 *      the original code hard-coded, so an existing machine keeps working with
 *      no change at all.
 *
 * If none of those resolve, it throws an error that says exactly what to run.
 *
 * Usage:
 *     import { resolveChromium } from './playwright-resolve.mjs';
 *     const { chromium } = await resolveChromium();
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const HOME = homedir();

/** Locations that have carried a Playwright install on real machines. */
const KNOWN_LOCATIONS = [
  join(HOME, '.local', 'pw', 'node_modules', 'playwright', 'index.mjs'),
  join(HOME, '.local', 'pw', 'node_modules', 'playwright', 'index.js'),
  join(HERE, '..', 'game', 'node_modules', 'playwright', 'index.mjs'),
  join(HERE, '..', 'game', 'node_modules', 'playwright', 'index.js'),
  join(HERE, '..', 'node_modules', 'playwright', 'index.mjs'),
  join(HERE, '..', 'node_modules', 'playwright', 'index.js'),
];

/**
 * Resolve the Chromium launcher.
 *
 * @returns {Promise<{chromium: import('playwright').chromium, source: string}>}
 */
export async function resolveChromium() {
  // 1. an explicit override
  const override = process.env.PLAYWRIGHT_MODULE;
  if (override) {
    if (!existsSync(override)) {
      throw new Error(
        `PLAYWRIGHT_MODULE is set to "${override}", but no such file exists. ` +
        `Point it at the Playwright entry point, or unset it.`);
    }
    const mod = await import(pathToFileURL(override).href);
    if (!mod.chromium) {
      throw new Error(
        `PLAYWRIGHT_MODULE ("${override}") does not export "chromium".`);
    }
    return { chromium: mod.chromium, source: `PLAYWRIGHT_MODULE=${override}` };
  }

  // 2. a normal install, resolved from this module's own node_modules chain
  try {
    const mod = await import('playwright');
    if (mod.chromium) {
      return { chromium: mod.chromium, source: 'playwright (resolved from node_modules)' };
    }
  } catch {
    // not installed here — fall through to the known locations
  }

  // 3. well-known local installs
  for (const path of KNOWN_LOCATIONS) {
    if (!existsSync(path)) continue;
    try {
      const mod = await import(pathToFileURL(path).href);
      if (mod.chromium) {
        return { chromium: mod.chromium, source: path };
      }
    } catch {
      // try the next one
    }
  }

  throw new Error(
    'Playwright could not be found, so the browser harness cannot run.\n' +
    'Fix it with ONE of these:\n' +
    '  • install it in the repo:      cd game && npm i -D playwright && npx playwright install chromium\n' +
    '  • point at an existing install: export PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs\n' +
    '  • install it standalone:         mkdir -p ~/.local/pw && cd ~/.local/pw && npm i playwright && npx playwright install chromium\n' +
    `Looked in: ${KNOWN_LOCATIONS.join(', ')}`);
}

/** Print where Playwright was found — useful in a report or a CI log. */
export function describeResolution(source) {
  return `playwright: ${source}`;
}
