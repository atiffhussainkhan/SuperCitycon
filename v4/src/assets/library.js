/**
 * V4 — Asset library.
 *
 * A read-only view over the project's assets. It answers the questions the
 * editor, the CLI tools and the release checklist ask:
 *
 *   - what do we have?            list() / byCategory() / stats()
 *   - where does it live?         find(id)
 *   - is it cleared for shipping?  redistributable / quarantined flags
 *   - are two entries the same?    duplicates()  (sha256 over the bytes)
 *   - is the file actually there? broken()
 *   - did the bytes change?       integrity(manifest)
 *   - what depends on this?       dependenciesOf(id)
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from './catalogue.js';
import { buildManifest, sha256File, sizeOf, verifyManifest } from './integrity.js';

/**
 * @param {object} opts
 * @param {Array}  [opts.entries]  Catalogue entries.
 * @param {string} [opts.root]     Repo root the entry paths are relative to.
 * @param {object} [opts.manifest]  A manifest to verify against.
 * @param {object|Map} [opts.references] assetId -> array of referenced asset ids.
 */
export function createAssetLibrary({ entries = [], root = REPO_ROOT, manifest = null, references = null } = {}) {
  const list = [];
  const byId = new Map();
  for (const entry of entries) {
    if (!entry || !entry.id) continue;
    if (byId.has(entry.id)) continue;
    byId.set(entry.id, entry);
    list.push(entry);
  }

  /** assetId -> Set of referenced asset ids */
  const refs = new Map();
  function addReference(from, to) {
    if (!from || !to) return;
    if (!refs.has(from)) refs.set(from, new Set());
    refs.get(from).add(to);
  }
  for (const entry of list) {
    for (const dep of entry.dependsOn ?? []) addReference(entry.id, dep);
  }
  if (references) {
    const pairs = references instanceof Map ? references.entries() : Object.entries(references);
    for (const [from, tos] of pairs) {
      for (const to of [].concat(tos ?? [])) addReference(from, to);
    }
  }

  const hashCache = new Map();

  function absPath(entry) {
    return join(root, entry.path);
  }

  /** sha256 of an entry's file (cached). Null when the file is missing. */
  function hashOf(entry) {
    if (hashCache.has(entry.id)) return hashCache.get(entry.id);
    const hash = sha256File(absPath(entry));
    hashCache.set(entry.id, hash);
    return hash;
  }

  const library = {
    root,
    entries: list,

    /** All entries, optionally filtered. */
    list({ category, redistributable, quarantined, search } = {}) {
      let out = list;
      if (category !== undefined && category !== null) {
        const wanted = [].concat(category);
        out = out.filter((e) => wanted.includes(e.category));
      }
      if (redistributable !== undefined && redistributable !== null) {
        out = out.filter((e) => e.redistributable === !!redistributable);
      }
      if (quarantined !== undefined && quarantined !== null) {
        out = out.filter((e) => e.quarantined === !!quarantined);
      }
      if (search) {
        const needle = String(search).toLowerCase();
        out = out.filter((e) => {
          const haystack = [
            e.id, e.category, e.path, e.author, e.source, e.title, e.pack,
            ...(e.tags ?? []),
          ].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(needle);
        });
      }
      return [...out];
    },

    /** One entry by id, or null. */
    find(id) {
      return byId.get(id) ?? null;
    },

    /** Entries grouped by category. */
    byCategory() {
      const map = new Map();
      for (const entry of list) {
        if (!map.has(entry.category)) map.set(entry.category, []);
        map.get(entry.category).push(entry);
      }
      return map;
    },

    /**
     * Groups of entries whose files have identical content.
     * Only groups with two or more members are returned.
     */
    duplicates() {
      const byHash = new Map();
      for (const entry of list) {
        const hash = hashOf(entry);
        if (!hash) continue;
        if (!byHash.has(hash)) byHash.set(hash, []);
        byHash.get(hash).push(entry);
      }
      const groups = [];
      for (const [hash, members] of byHash) {
        if (members.length < 2) continue;
        groups.push({ hash, sizeBytes: sizeOf(absPath(members[0])), entries: members });
      }
      return groups;
    },

    /** Entries whose file is not on disk. */
    broken() {
      const out = [];
      for (const entry of list) {
        if (!existsSync(absPath(entry))) out.push(entry);
      }
      return out;
    },

    /**
     * Verify the library against a manifest (the one supplied at creation,
     * or one passed in).
     */
    integrity(manifestOverride = null) {
      const m = manifestOverride ?? manifest;
      return verifyManifest(list, m, { root });
    },

    /** Build a manifest for the current entries. */
    manifest() {
      return buildManifest(list, { root });
    },

    /**
     * What depends on this asset.
     *
     * `dependsOn` are the assets/files it needs; `referencedBy` are the assets
     * that need it; `transitive` is the full dependency closure.
     */
    dependenciesOf(id) {
      const entry = byId.get(id) ?? null;
      const direct = entry ? [...(entry.dependsOn ?? [])] : [];
      const referencedBy = [];
      for (const [from, tos] of refs) {
        if (tos.has(id)) referencedBy.push(from);
      }
      const seen = new Set();
      const transitive = [];
      const stack = [...direct];
      while (stack.length) {
        const next = stack.pop();
        if (seen.has(next)) continue;
        seen.add(next);
        transitive.push(next);
        const nextEntry = byId.get(next);
        for (const dep of nextEntry?.dependsOn ?? []) stack.push(dep);
        for (const to of refs.get(next) ?? []) stack.push(to);
      }
      return { id, dependsOn: direct, referencedBy, transitive };
    },

    /** Register references between assets (assetId -> referenced ids). */
    addReferences(map) {
      const pairs = map instanceof Map ? map.entries() : Object.entries(map ?? {});
      for (const [from, tos] of pairs) {
        for (const to of [].concat(tos ?? [])) addReference(from, to);
      }
      return library;
    },

    /** A summary of the whole library. */
    stats() {
      const byCategory = {};
      const byLicence = {};
      const byAuthor = {};
      let bytes = 0;
      let knownBytes = 0;
      for (const entry of list) {
        byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
        byLicence[entry.licence] = (byLicence[entry.licence] ?? 0) + 1;
        byAuthor[entry.author] = (byAuthor[entry.author] ?? 0) + 1;
        if (typeof entry.sizeBytes === 'number') {
          bytes += entry.sizeBytes;
          knownBytes += 1;
        }
      }
      const broken = library.broken();
      const duplicates = library.duplicates();
      return {
        total: list.length,
        byCategory,
        byLicence,
        byAuthor,
        redistributable: list.filter((e) => e.redistributable).length,
        quarantined: list.filter((e) => e.quarantined).length,
        broken: broken.length,
        duplicateGroups: duplicates.length,
        duplicateEntries: duplicates.reduce((n, g) => n + g.entries.length, 0),
        knownBytes: bytes,
        sizedEntries: knownBytes,
      };
    },
  };

  return library;
}
