/**
 * V4 — Asset export.
 *
 * Packs the cleared assets into a redistributable bundle: a JSON manifest
 * plus the files themselves.
 *
 * Two rules are enforced here and cannot be switched off:
 *
 *   1. A QUARANTINED asset is never copied. Not with `onlyCleared: false`,
 *      not with a flag, not ever. The refusal is reported so the developer
 *      can see exactly what was withheld and why.
 *   2. No secret ever reaches the bundle. Manifest metadata is scrubbed of
 *      credential-shaped fields, and the pack never reads the environment.
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';

import { PUBLIC_PREFIX } from './catalogue.js';
import { sha256File, sizeOf } from './integrity.js';

/**
 * Field names that must never appear in an exported manifest.
 * The name is normalised first (case and separators removed), so `apiKey`,
 * `api_key` and `API-KEY` are all caught — while `author`, which merely
 * starts with the same letters, is not.
 */
const SECRET_KEY_PATTERN = /password|passwd|secret|token|apikey|credential|privatekey|authorization|cookie|sessionid|accesskey|clientsecret/i;
/** Value shapes that look like a leaked credential. */
const SECRET_VALUE_PATTERN = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.)/;

/**
 * Remove anything that looks like a credential from a metadata object.
 * Returns a new object; the input is not mutated.
 */
export function scrubSecrets(value) {
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && SECRET_VALUE_PATTERN.test(value)) return '[redacted]';
    return value;
  }
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    const normalised = String(key).replace(/[^A-Za-z0-9]/g, '');
    if (SECRET_KEY_PATTERN.test(normalised)) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = scrubSecrets(val);
  }
  return out;
}

/** The path an asset takes inside the exported pack. */
export function exportLayoutPath(entryPath) {
  const normalised = entryPath.split(sep).join('/');
  if (normalised.startsWith(`${PUBLIC_PREFIX}/`)) return normalised.slice(PUBLIC_PREFIX.length + 1);
  return normalised;
}

/**
 * Export the cleared assets of a library into `outDir`.
 *
 * The invariant, under every flag combination: a quarantined asset — or an
 * asset whose licence is still "unverified" — is NEVER copied. `onlyCleared`
 * only decides whether an asset that is neither quarantined nor marked
 * redistributable (a verified licence the project has not cleared for
 * redistribution) is copied as well; the default (`true`) refuses it.
 *
 * @param {object} opts
 * @param {object} opts.library        A library from `createAssetLibrary`.
 * @param {string} opts.outDir         Where the pack is written.
 * @param {boolean} [opts.onlyCleared] Only export redistributable assets (default true).
 * @param {string}  [opts.manifestName] Name of the manifest file (default 'manifest.json').
 * @param {boolean} [opts.dryRun]      Plan the export without touching the disk.
 * @returns {{outDir:string, exported:Array, refused:Array, dependencies:Array, manifest:object, manifestPath:string, bytes:number, dryRun:boolean}}
 */
export function exportPack({
  library,
  outDir,
  onlyCleared = true,
  manifestName = 'manifest.json',
  dryRun = false,
} = {}) {
  if (!library) throw new Error('exportPack needs a library');
  if (!outDir) throw new Error('exportPack needs an outDir');

  const exported = [];
  const refused = [];
  const dependencies = [];
  let bytes = 0;

  const entries = library.list();

  for (const entry of entries) {
    const reasons = [];
    if (entry.quarantined) reasons.push('asset is quarantined (licence unverified)');
    if (entry.licence === 'unverified') reasons.push('licence is unverified');
    if (onlyCleared && entry.redistributable !== true && !entry.quarantined) {
      reasons.push('asset is not marked redistributable');
    }

    if (reasons.length) {
      refused.push({ id: entry.id, path: entry.path, licence: entry.licence, reasons });
      continue;
    }

    const abs = join(library.root, entry.path);
    if (!existsSync(abs)) {
      refused.push({ id: entry.id, path: entry.path, licence: entry.licence, reasons: ['file is missing on disk'] });
      continue;
    }

    const rel = exportLayoutPath(entry.path);
    const target = join(outDir, rel.split('/').join(sep));
    const size = sizeOf(abs) ?? 0;

    if (!dryRun) {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(abs, target);
    }
    bytes += size;
    exported.push({
      id: entry.id,
      path: rel,
      licence: entry.licence,
      author: entry.author,
      source: entry.source ?? null,
      sizeBytes: size,
      hash: sha256File(abs),
    });

    // A .gltf is useless without its .bin sidecars — copy them too.
    for (const dep of entry.dependsOn ?? []) {
      const depAbs = join(library.root, dep);
      if (!existsSync(depAbs)) {
        dependencies.push({ id: entry.id, path: dep, copied: false, reason: 'missing on disk' });
        continue;
      }
      const depRel = exportLayoutPath(dep);
      const depTarget = join(outDir, depRel.split('/').join(sep));
      if (!dryRun) {
        mkdirSync(dirname(depTarget), { recursive: true });
        copyFileSync(depAbs, depTarget);
      }
      bytes += sizeOf(depAbs) ?? 0;
      dependencies.push({ id: entry.id, path: depRel, copied: true, sizeBytes: sizeOf(depAbs) ?? 0 });
    }
  }

  const manifest = scrubSecrets({
    format: 'v4-asset-pack',
    version: 1,
    generatedAt: new Date().toISOString(),
    onlyCleared,
    counts: {
      exported: exported.length,
      refused: refused.length,
      dependencies: dependencies.length,
    },
    assets: exported,
    dependencies,
    refused: refused.map((r) => ({ id: r.id, path: r.path, reasons: r.reasons })),
  });

  const manifestPath = join(outDir, manifestName);
  if (!dryRun) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  return {
    outDir,
    exported,
    refused,
    dependencies,
    manifest,
    manifestPath,
    bytes,
    dryRun,
  };
}

/**
 * A human-readable summary of what an export refused and why. Used by the
 * CLI so the developer sees the refusals, not just the success count.
 */
export function describeRefusals(report) {
  if (!report.refused.length) return 'No assets were refused.';
  const lines = report.refused.map((r) => `  - ${r.id} (${r.path}): ${r.reasons.join('; ')}`);
  return `${report.refused.length} asset(s) refused:\n${lines.join('\n')}`;
}
