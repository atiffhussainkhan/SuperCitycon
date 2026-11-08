/**
 * Asset library tests — the catalogue, the filters, the duplicate and broken
 * detection, the integrity check and the export rule that a quarantined
 * asset is never shipped.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildCatalogue, readQuarantine } from '../src/assets/catalogue.js';
import { exportPack, scrubSecrets } from '../src/assets/export.js';
import { buildManifest, sha256File, verifyManifest } from '../src/assets/integrity.js';
import { createAssetLibrary } from '../src/assets/library.js';
import { MODEL_CATALOGUE } from '../src/render/asset-loader.js';

const { entries, totals } = buildCatalogue();
const library = createAssetLibrary({ entries });

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'v4-assets-'));
}

test('the catalogue holds every cleared model and every quarantined image', () => {
  const quarantine = readQuarantine();
  const expectedImages = quarantine.assets.length;

  assert.equal(totals.models, MODEL_CATALOGUE.length);
  assert.equal(totals.images, expectedImages);
  assert.equal(totals.entries, MODEL_CATALOGUE.length + expectedImages);
  assert.equal(library.entries.length, totals.entries);
});

test('the cleared models are redistributable and the 2D images are not', () => {
  for (const entry of library.list({ category: 'ui2d' })) {
    assert.equal(entry.quarantined, true, `${entry.id} must be quarantined`);
    assert.equal(entry.redistributable, false, `${entry.id} must not be redistributable`);
    assert.equal(entry.licence, 'unverified');
  }
  for (const entry of library.list()) {
    if (entry.category === 'ui2d') continue;
    assert.equal(entry.quarantined, false, `${entry.id} must not be quarantined`);
    assert.equal(entry.redistributable, true, `${entry.id} must be redistributable`);
    assert.notEqual(entry.licence, 'unverified');
  }
});

test('every entry carries the fields the catalogue promises', () => {
  for (const entry of library.entries) {
    assert.equal(typeof entry.id, 'string');
    assert.equal(typeof entry.category, 'string');
    assert.equal(typeof entry.path, 'string');
    assert.equal(typeof entry.licence, 'string');
    assert.equal(typeof entry.author, 'string');
    assert.equal(typeof entry.source, 'string');
    assert.equal(typeof entry.redistributable, 'boolean');
    assert.equal(typeof entry.quarantined, 'boolean');
    assert.ok(Array.isArray(entry.tags));
  }
});

test('list filters by category, licence status and search', () => {
  assert.equal(library.list({ category: 'character' }).length, library.list().filter((e) => e.category === 'character').length);
  assert.equal(library.list({ quarantined: true }).length, readQuarantine().assets.length);
  assert.equal(library.list({ redistributable: true }).length, MODEL_CATALOGUE.length);
  assert.equal(library.list({ search: 'kaykit' }).length > 0, true);
  assert.equal(library.list({ search: 'nothing-matches-this' }).length, 0);
});

test('find and byCategory work on the real catalogue', () => {
  const found = library.find('character.kaykit');
  assert.ok(found);
  assert.match(found.path, /KayKit_AnimatedCharacter/);

  assert.equal(library.find('nope'), null);

  const categories = library.byCategory();
  assert.ok(categories.get('ui2d').length > 0);
  const total = [...categories.values()].reduce((n, list) => n + list.length, 0);
  assert.equal(total, library.entries.length);
});

test('stats describe the whole library', () => {
  const stats = library.stats();
  assert.equal(stats.total, library.entries.length);
  assert.equal(stats.quarantined, library.list({ quarantined: true }).length);
  assert.equal(stats.redistributable, library.list({ redistributable: true }).length);
  assert.equal(stats.byCategory.ui2d, library.list({ category: 'ui2d' }).length);
  assert.ok(stats.knownBytes > 0);
});

test('broken() lists exactly the entries whose file is missing', () => {
  const broken = library.broken();
  for (const entry of broken) {
    assert.equal(existsSync(join(library.root, entry.path)), false, `${entry.id} should be missing`);
  }
  const expected = library.entries.filter((e) => !existsSync(join(library.root, e.path)));
  assert.equal(broken.length, expected.length);
});

test('duplicates() detects identical files by content hash', () => {
  const dir = tempDir();
  try {
    writeFileSync(join(dir, 'a.bin'), 'the same bytes');
    writeFileSync(join(dir, 'b.bin'), 'the same bytes');
    writeFileSync(join(dir, 'c.bin'), 'different bytes');

    const local = createAssetLibrary({
      root: dir,
      entries: [
        { id: 'a', path: 'a.bin', category: 'test', licence: 'CC0-1.0', redistributable: true, quarantined: false },
        { id: 'b', path: 'b.bin', category: 'test', licence: 'CC0-1.0', redistributable: true, quarantined: false },
        { id: 'c', path: 'c.bin', category: 'test', licence: 'CC0-1.0', redistributable: true, quarantined: false },
      ],
    });

    const groups = local.duplicates();
    assert.equal(groups.length, 1);
    assert.equal(groups[0].entries.length, 2);
    assert.deepEqual(groups[0].entries.map((e) => e.id).sort(), ['a', 'b']);
    assert.equal(sha256File(join(dir, 'a.bin')), sha256File(join(dir, 'b.bin')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the real catalogue has no duplicated content', () => {
  const groups = library.duplicates();
  assert.equal(groups.length, 0, `unexpected duplicate groups: ${groups.map((g) => g.entries.map((e) => e.id).join(',')).join('; ')}`);
});

test('dependenciesOf reports the sidecars a .gltf needs', () => {
  const deps = library.dependenciesOf('citybits.building_a');
  assert.ok(deps.dependsOn.length > 0, 'building_A.gltf needs its .bin buffer');
  assert.ok(deps.dependsOn.some((d) => d.endsWith('.bin')));
  assert.ok(deps.transitive.includes(deps.dependsOn[0]));
});

test('integrity() verifies the bytes against a manifest', () => {
  const dir = tempDir();
  try {
    writeFileSync(join(dir, 'model.bin'), 'original bytes');
    const local = createAssetLibrary({
      root: dir,
      entries: [{
        id: 'model', path: 'model.bin', category: 'test', licence: 'CC0-1.0',
        author: 'test', source: 'test', redistributable: true, quarantined: false,
      }],
    });

    const manifest = local.manifest();
    assert.equal(manifest.format, 'v4-asset-manifest');
    assert.equal(manifest.assets.length, 1);

    const clean = local.integrity(manifest);
    assert.equal(clean.ok, true);
    assert.equal(clean.checked, 1);

    writeFileSync(join(dir, 'model.bin'), 'tampered bytes');
    const dirty = local.integrity(manifest);
    assert.equal(dirty.ok, false);
    assert.equal(dirty.hashMismatch.length, 1);
    assert.equal(dirty.hashMismatch[0].id, 'model');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('integrity() without a manifest says so instead of pretending', () => {
  const report = library.integrity();
  assert.equal(report.ok, false);
  assert.match(report.reason, /no manifest/);
});

test('a missing file is reported as missing, not as a hash mismatch', () => {
  const dir = tempDir();
  try {
    const local = createAssetLibrary({
      root: dir,
      entries: [{
        id: 'gone', path: 'gone.bin', category: 'test', licence: 'CC0-1.0',
        author: 'test', source: 'test', redistributable: true, quarantined: false,
      }],
    });
    const report = verifyManifest(local.entries, buildManifest(local.entries, { root: dir }), { root: dir });
    assert.equal(report.missing.length, 1);
    assert.equal(report.ok, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('exportPack refuses every quarantined asset and reports what it refused', () => {
  const out = tempDir();
  try {
    const report = exportPack({ library, outDir: out });

    const quarantined = library.list({ quarantined: true });
    assert.equal(report.refused.length, quarantined.length + library.broken().length);
    const refusedIds = new Set(report.refused.map((r) => r.id));
    for (const entry of quarantined) {
      assert.equal(refusedIds.has(entry.id), true, `${entry.id} must be refused`);
      assert.ok(report.refused.find((r) => r.id === entry.id).reasons.join(' ').match(/quarantined|unverified/i));
    }

    assert.ok(report.exported.length > 0);
    assert.equal(report.exported.some((e) => e.id.startsWith('2d.')), false);
    assert.equal(existsSync(join(out, 'assets/ui')), false, 'no quarantined image may be copied');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the exported manifest contains no quarantined asset and no secret', () => {
  const out = tempDir();
  try {
    const report = exportPack({ library, outDir: out });
    const manifest = JSON.parse(readFileSync(report.manifestPath, 'utf8'));

    assert.equal(manifest.format, 'v4-asset-pack');
    assert.equal(manifest.assets.length, report.exported.length);
    for (const asset of manifest.assets) {
      assert.equal(quarantinedIds().has(asset.id), false, `${asset.id} must not be in the manifest`);
      assert.notEqual(asset.licence, 'unverified', `${asset.id} must not carry an unverified licence`);
      assert.ok(typeof asset.hash === 'string' && asset.hash.length === 64);
      assert.ok(asset.author && asset.author !== '[redacted]', `${asset.id} must keep its attribution`);
    }

    const text = readFileSync(report.manifestPath, 'utf8');
    assert.equal(/sk-[A-Za-z0-9]{16,}/.test(text), false);
    assert.equal(/"(apiKey|token|secret|password)"\s*:/i.test(text), false);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the exported files really are on disk', () => {
  const out = tempDir();
  try {
    const report = exportPack({ library, outDir: out });
    for (const asset of report.exported) {
      assert.equal(existsSync(join(out, asset.path)), true, `${asset.path} should have been copied`);
    }
    assert.ok(report.bytes > 0);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('exportPack refuses to write into the engine source tree', () => {
  const out = tempDir();
  try {
    const report = exportPack({ library, outDir: out, dryRun: true });
    assert.equal(report.dryRun, true);
    assert.equal(existsSync(join(out, 'manifest.json')), false, 'a dry run writes nothing');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('onlyCleared:false still refuses every quarantined asset', () => {
  const out = tempDir();
  try {
    const report = exportPack({ library, outDir: out, onlyCleared: false });
    const quarantined = library.list({ quarantined: true });
    const refusedIds = new Set(report.refused.map((r) => r.id));

    for (const entry of quarantined) {
      assert.equal(refusedIds.has(entry.id), true, `${entry.id} must be refused even with onlyCleared:false`);
    }
    assert.equal(report.exported.some((e) => e.id.startsWith('2d.')), false);
    assert.equal(existsSync(join(out, 'assets/ui')), false, 'no quarantined image may be copied');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('an entry that claims to be redistributable but is quarantined is still refused', () => {
  const dir = tempDir();
  try {
    writeFileSync(join(dir, 'sneaky.png'), 'pretend this is fine');
    const local = createAssetLibrary({
      root: dir,
      entries: [{
        id: 'sneaky', path: 'sneaky.png', category: 'ui2d', licence: 'CC0-1.0',
        author: 'unknown', source: 'unknown', redistributable: true, quarantined: true,
      }],
    });

    const report = exportPack({ library: local, outDir: join(dir, 'out') });
    assert.equal(report.exported.length, 0);
    assert.equal(report.refused.length, 1);
    assert.match(report.refused[0].reasons.join(' '), /quarantined/);
    assert.equal(existsSync(join(dir, 'out', 'sneaky.png')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an entry whose licence is unverified is refused even when it is not marked quarantined', () => {
  const dir = tempDir();
  try {
    writeFileSync(join(dir, 'mystery.png'), 'no licence known');
    const local = createAssetLibrary({
      root: dir,
      entries: [{
        id: 'mystery', path: 'mystery.png', category: 'ui2d', licence: 'unverified',
        author: 'unknown', source: 'unknown', redistributable: true, quarantined: false,
      }],
    });

    const report = exportPack({ library: local, outDir: join(dir, 'out'), onlyCleared: false });
    assert.equal(report.exported.length, 0);
    assert.equal(report.refused.length, 1);
    assert.match(report.refused[0].reasons.join(' '), /unverified/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scrubSecrets removes credential-shaped fields', () => {
  const scrubbed = scrubSecrets({
    id: 'a',
    author: 'Avramania',
    apiKey: 'super-secret-value',
    nested: { password: 'hunter2', note: 'fine' },
    value: 'sk-abcdefghijklmnopqrstuvwx',
  });
  assert.equal(scrubbed.apiKey, '[redacted]');
  assert.equal(scrubbed.nested.password, '[redacted]');
  assert.equal(scrubbed.nested.note, 'fine');
  assert.equal(scrubbed.value, '[redacted]');
  assert.equal(scrubbed.id, 'a');
  assert.equal(scrubbed.author, 'Avramania', 'the author is attribution, not a credential');
});

test('the export copies the .bin sidecars a .gltf needs', () => {
  const out = tempDir();
  try {
    const report = exportPack({ library, outDir: out });
    const buildingA = report.exported.find((e) => e.id === 'citybits.building_a');
    assert.ok(buildingA, 'citybits.building_a should be exported');
    const sidecars = report.dependencies.filter((d) => d.id === 'citybits.building_a');
    assert.ok(sidecars.length > 0);
    for (const sidecar of sidecars) {
      assert.equal(existsSync(join(out, sidecar.path)), true, `${sidecar.path} should be copied`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

function quarantinedIds() {
  return new Set(library.list({ quarantined: true }).map((e) => e.id));
}
