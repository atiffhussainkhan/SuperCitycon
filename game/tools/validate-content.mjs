#!/usr/bin/env node
/**
 * game/tools/validate-content.mjs — the offline content validator.
 *
 * Runs the content validator over the shipped level library and exits with a
 * non-zero status when any level has an ERROR. Warnings are printed but do
 * not fail the run unless `--strict` is passed.
 *
 * Usage:
 *   node tools/validate-content.mjs [--strict] [--json] [--level <id>]
 *
 * Exit codes:
 *   0  every level passed (or only warnings, unless --strict)
 *   1  at least one level has an error (or a warning, with --strict)
 *   2  the tool could not run (bad arguments, unreadable library)
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { LEVELS } from '../src/content/levels.js';
import { validateLevels } from '../src/content/validate.js';
import { BUILDING_DEFS } from '../src/buildings/catalogue.js';

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, '..', 'src', 'data', 'manifest.json');

function parseArgs(argv) {
  const out = { strict: false, json: false, level: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--strict') out.strict = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--level') {
      const value = argv[i + 1];
      if (!value) throw new Error('--level needs a level id');
      out.level = value;
      i += 1;
    } else if (arg.startsWith('--level=')) {
      out.level = arg.slice('--level='.length);
    } else {
      throw new Error(`Unknown argument "${arg}"`);
    }
  }
  return out;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(2);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    process.stderr.write(`Could not read the asset manifest at ${manifestPath}: ${err.message}\n`);
    process.exit(2);
  }

  const resources = {
    buildings: new Set(BUILDING_DEFS.map((d) => d.id)),
    characters: new Set(Object.keys(manifest.characters ?? {})),
    models: new Set(Object.keys(manifest.models ?? {})),
    footprints: Object.fromEntries(
      BUILDING_DEFS
        .filter((d) => Array.isArray(d.footprintCells) && d.footprintCells.length >= 2)
        .map((d) => [d.id, [d.footprintCells[0], d.footprintCells[1]]]),
    ),
  };

  const levels = args.level
    ? LEVELS.filter((l) => l.id === args.level)
    : LEVELS;

  if (args.level && levels.length === 0) {
    process.stderr.write(`No level with id "${args.level}".\n`);
    process.exit(2);
  }

  const { levels: perLevel, report } = validateLevels(levels, resources);

  if (args.json) {
    process.stdout.write(`${JSON.stringify({
      levels: perLevel.map((entry) => ({
        id: entry.id,
        ok: entry.report.ok,
        errors: entry.report.errors,
        warnings: entry.report.warnings,
        infos: entry.report.infos,
        issues: entry.report.issues,
      })),
      report,
    }, null, 2)}\n`);
  } else {
    for (const entry of perLevel) {
      const status = entry.report.ok ? 'PASS' : 'FAIL';
      process.stdout.write(
        `${status}  ${entry.id}  `
        + `(${entry.report.errors} error(s), ${entry.report.warnings} warning(s), ${entry.report.infos} note(s))\n`,
      );
      for (const issue of entry.report.issues) {
        const where = issue.path ? ` [${issue.path}]` : '';
        process.stdout.write(`        ${issue.severity.toUpperCase()}  ${issue.code}: ${issue.message}${where}\n`);
      }
    }
    process.stdout.write(
      `\n${perLevel.length} level(s) checked — `
      + `${report.errors} error(s), ${report.warnings} warning(s), ${report.infos} note(s).\n`,
    );
  }

  const failed = report.errors > 0 || (args.strict && report.warnings > 0);
  process.exit(failed ? 1 : 0);
}

main();
