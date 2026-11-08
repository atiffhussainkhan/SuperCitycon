/**
 * V4 — Asset integrity.
 *
 * Hashing and manifest handling for the asset library. Everything here is
 * content-addressed: a sha256 over the bytes on disk, so "is this the file we
 * signed off?" is answered by the bytes themselves and not by a filename.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** sha256 of a buffer, hex encoded. */
export function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * sha256 of a file. Returns null when the file cannot be read — a missing
 * file is never silently treated as "hash of nothing".
 */
export function sha256File(path) {
  try {
    return hashBuffer(readFileSync(path));
  } catch {
    return null;
  }
}

/** Size of a file in bytes, or null when it cannot be read. */
export function sizeOf(path) {
  try {
    return statSync(path).size;
  } catch {
    return null;
  }
}

/**
 * Build a manifest describing the given catalogue entries.
 *
 * The manifest records only what a redistribution needs: identity, licence
 * and content hash. It never records secrets and never records the absolute
 * path of the machine that produced it.
 *
 * @param {Array} entries
 * @param {{root?:string, generatedAt?:string}} [opts]
 */
export function buildManifest(entries, { root, generatedAt = new Date().toISOString() } = {}) {
  const assets = [];
  for (const entry of entries) {
    const abs = root ? join(root, entry.path) : entry.path;
    assets.push({
      id: entry.id,
      path: entry.path,
      category: entry.category,
      licence: entry.licence,
      author: entry.author,
      source: entry.source ?? null,
      redistributable: entry.redistributable === true,
      quarantined: entry.quarantined === true,
      sizeBytes: sizeOf(abs),
      hash: sha256File(abs),
      dependsOn: [...(entry.dependsOn ?? [])],
    });
  }
  return {
    format: 'v4-asset-manifest',
    version: 1,
    generatedAt,
    assets,
  };
}

/**
 * Verify catalogue entries against a manifest.
 *
 * Returns a report; it never throws for a mismatch, because a mismatch is
 * information, not a crash.
 *
 * @param {Array} entries
 * @param {object|null} manifest
 * @param {{root?:string}} [opts]
 */
export function verifyManifest(entries, manifest, { root } = {}) {
  const report = {
    ok: false,
    checked: 0,
    missing: [],
    sizeMismatch: [],
    hashMismatch: [],
    unverifiable: [],
    details: [],
  };

  if (!manifest || !Array.isArray(manifest.assets)) {
    report.reason = 'no manifest supplied — nothing to verify against';
    return report;
  }

  const byId = new Map(manifest.assets.map((a) => [a.id, a]));
  for (const entry of entries) {
    const expected = byId.get(entry.id);
    if (!expected) continue;
    report.checked += 1;
    const abs = root ? join(root, entry.path) : entry.path;
    if (!existsSync(abs)) {
      report.missing.push({ id: entry.id, path: entry.path });
      continue;
    }
    const actualSize = sizeOf(abs);
    const actualHash = sha256File(abs);
    if (actualHash === null) {
      report.unverifiable.push({ id: entry.id, path: entry.path, reason: 'file could not be read' });
      continue;
    }
    const sizeOk = expected.sizeBytes === undefined || expected.sizeBytes === null
      ? true
      : actualSize === expected.sizeBytes;
    const hashOk = !expected.hash ? true : actualHash === expected.hash;
    if (!sizeOk) report.sizeMismatch.push({ id: entry.id, path: entry.path, expected: expected.sizeBytes, actual: actualSize });
    if (!hashOk) report.hashMismatch.push({ id: entry.id, path: entry.path, expected: expected.hash, actual: actualHash });
    report.details.push({ id: entry.id, path: entry.path, sizeOk, hashOk });
  }

  report.ok = report.missing.length === 0
    && report.sizeMismatch.length === 0
    && report.hashMismatch.length === 0
    && report.unverifiable.length === 0;
  return report;
}
