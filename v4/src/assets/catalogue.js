/**
 * V4 — Asset catalogue.
 *
 * The catalogue is built from the assets the project ACTUALLY ships:
 *
 *   - the cleared 3D models listed in `MODEL_CATALOGUE` (v4/src/render/asset-loader.js),
 *     which are CC0-1.0 / MIT and therefore redistributable;
 *   - the 2D images listed in `v4/data/quarantine-2d.json`, every one of which
 *     carries licence "unverified" and is therefore QUARANTINED — never
 *     imported, never redistributed, never claimed to be cleared.
 *
 * No licence is invented here. If the source file says "unverified", the
 * catalogue says "unverified" and marks the entry quarantined.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODEL_CATALOGUE } from '../render/asset-loader.js';

/** The repository root (the folder that holds `v4/` and `game/`). */
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
/** The V4 application root (the folder that holds `src/`, `tools/`, `tests/`). */
export const V4_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Repo-relative prefix of everything the game ships publicly. */
export const PUBLIC_PREFIX = 'game/public';
/** Repo-relative prefix of the cleared 3D models. */
export const MODEL_PREFIX = 'game/public/assets/models';
/** Repo-relative prefix of the (quarantined) 2D images. */
export const IMAGE_PREFIX = 'game/public';
/** Repo-relative path of the 2D licence inventory. */
export const QUARANTINE_FILE = 'v4/data/quarantine-2d.json';

/**
 * Where each cleared 3D pack came from. Every string here is grounded in a
 * licence file that ships inside `game/public/assets/LICENSES/`.
 */
export const ASSET_SOURCES = {
  Avramania: {
    source: 'Avramania Asset Library — Nature & Terrain (https://avramania.itch.io/nature-terrain)',
    licenceFile: 'game/public/assets/LICENSES/avramania-nature-terrain-CC0.txt',
  },
  Holokat: {
    source: 'Holokat Game Assets (MIT licence text ships with the pack)',
    licenceFile: 'game/public/assets/LICENSES/holokat-game-assets-MIT.txt',
  },
  KayKit: {
    source: 'Kay Lousberg — KayKit packs (www.kaylousberg.com)',
    licenceFile: 'game/public/assets/LICENSES/kaykit-city-builder-LICENSE.txt',
  },
  Quaternius: {
    source: 'Quaternius — LowPoly Models (https://www.patreon.com/quaternius)',
    licenceFile: 'game/public/assets/LICENSES/citizens-CC0-1.0.txt',
  },
};

/** Which KayKit licence file applies to which model id. */
const KAYKIT_LICENCE_FILES = [
  ['character.kaykit', 'game/public/assets/LICENSES/kaykit-character-animations-LICENSE.txt'],
  ['character.', 'game/public/assets/LICENSES/kaykit-adventurers-LICENSE.txt'],
  ['citybits.', 'game/public/assets/LICENSES/kaykit-city-builder-LICENSE.txt'],
];

function licenceFileFor(model) {
  for (const [prefix, file] of KAYKIT_LICENCE_FILES) {
    if (model.id.startsWith(prefix)) return file;
  }
  return ASSET_SOURCES[model.author]?.licenceFile ?? null;
}

function sourceFor(model) {
  return ASSET_SOURCES[model.author]?.source ?? 'unknown';
}

/** Size of a repo-relative file, or null when it is not on disk. */
export function fileSize(root, relPath) {
  const abs = join(root, relPath);
  try {
    return statSync(abs).size;
  } catch {
    return null;
  }
}

/**
 * External files a `.gltf` document needs beside itself (the `.bin` buffers
 * and any external textures). Returned as repo-relative paths.
 */
export function gltfSidecars(root, relPath) {
  if (!relPath.toLowerCase().endsWith('.gltf')) return [];
  const abs = join(root, relPath);
  if (!existsSync(abs)) return [];
  let doc;
  try {
    doc = JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    return [];
  }
  const uris = [];
  for (const buffer of doc.buffers ?? []) {
    if (buffer.uri && !buffer.uri.startsWith('data:')) uris.push(buffer.uri);
  }
  for (const image of doc.images ?? []) {
    if (image.uri && !image.uri.startsWith('data:')) uris.push(image.uri);
  }
  const dir = posix.dirname(relPath);
  return uris.map((u) => posix.normalize(posix.join(dir, decodeURIComponent(u))));
}

/**
 * Read the 2D licence inventory. This file is the single source of truth for
 * the quarantine decision — it is read, never written.
 */
export function readQuarantine(quarantinePath = join(REPO_ROOT, QUARANTINE_FILE)) {
  const raw = readFileSync(quarantinePath, 'utf8');
  const doc = JSON.parse(raw);
  if (!Array.isArray(doc.assets)) throw new Error(`quarantine file has no assets array: ${quarantinePath}`);
  return doc;
}

/**
 * Build the full asset catalogue.
 *
 * @param {object} [opts]
 * @param {string} [opts.root] Repo root the paths are relative to.
 * @param {string} [opts.quarantinePath] Path of the 2D licence inventory.
 * @param {Array}  [opts.models] The cleared model catalogue (defaults to MODEL_CATALOGUE).
 * @returns {{entries: Array, totals: object, sources: object}}
 */
export function buildCatalogue({
  root = REPO_ROOT,
  quarantinePath = join(REPO_ROOT, QUARANTINE_FILE),
  models = MODEL_CATALOGUE,
} = {}) {
  const entries = [];
  const usedIds = new Set();

  function uniqueId(base) {
    let id = base;
    let n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    return id;
  }

  // --- cleared 3D models ---------------------------------------------------
  for (const model of models) {
    const relPath = posix.join(MODEL_PREFIX, model.file);
    const tags = ['3d', 'model', model.category];
    if (model.animated) tags.push('animated');
    entries.push({
      id: uniqueId(model.id),
      category: model.category,
      path: relPath,
      licence: model.licence,
      author: model.author,
      source: sourceFor(model),
      licenceFile: licenceFileFor(model),
      redistributable: model.redistributable === true,
      quarantined: false,
      tags,
      animated: model.animated === true,
      sizeBytes: fileSize(root, relPath),
      dependsOn: gltfSidecars(root, relPath),
    });
  }

  // --- quarantined 2D images ------------------------------------------------
  const quarantine = readQuarantine(quarantinePath);
  for (const record of quarantine.assets) {
    const relPath = posix.join(IMAGE_PREFIX, record.file);
    const base = posix.basename(relPath).replace(/\.[^.]+$/, '');
    const tags = ['2d', 'image'];
    if (record.pack) tags.push(record.pack);
    for (const slot of record.slots ?? []) tags.push(slot);
    entries.push({
      id: uniqueId(`2d.${base}`),
      category: 'ui2d',
      path: relPath,
      licence: record.licence ?? 'unverified',
      author: 'unknown',
      source: record.source_url ?? 'unknown',
      licenceFile: null,
      redistributable: record.redistributable === true,
      quarantined: true,
      tags,
      pack: record.pack ?? null,
      libraryId: record.library_id ?? null,
      slots: [...(record.slots ?? [])],
      decision: record.decision ?? 'QUARANTINE — licence unverified at source',
      sizeBytes: fileSize(root, relPath),
      dependsOn: [],
    });
  }

  const totals = {
    entries: entries.length,
    models: entries.filter((e) => e.category !== 'ui2d').length,
    images: entries.filter((e) => e.category === 'ui2d').length,
    redistributable: entries.filter((e) => e.redistributable).length,
    quarantined: entries.filter((e) => e.quarantined).length,
    missingOnDisk: entries.filter((e) => e.sizeBytes === null).length,
  };

  return {
    entries,
    totals,
    sources: {
      quarantineFile: quarantinePath,
      quarantinePolicy: quarantine.policy ?? null,
      quarantineTotals: quarantine.totals ?? null,
      modelCount: models.length,
    },
  };
}

/** Convenience: a catalogue ready to hand to `createAssetLibrary`. */
export function createCatalogue(options = {}) {
  return buildCatalogue(options);
}
