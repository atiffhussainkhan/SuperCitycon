#!/usr/bin/env node
/**
 * tools/audit-assets.mjs — print the asset audit.
 *
 * Counts per category, the licence breakdown, the quarantined list, the
 * duplicate content groups and the entries whose file is missing on disk.
 *
 * Usage: node tools/audit-assets.mjs [--json]
 */

import { buildCatalogue } from '../src/assets/catalogue.js';
import { createAssetLibrary } from '../src/assets/library.js';

const asJson = process.argv.includes('--json');

const { entries, totals, sources } = buildCatalogue();
const library = createAssetLibrary({ entries });

const stats = library.stats();
const broken = library.broken();
const duplicates = library.duplicates();
const quarantined = library.list({ quarantined: true });

if (asJson) {
  console.log(JSON.stringify({
    totals,
    stats,
    quarantined: quarantined.map((e) => ({ id: e.id, path: e.path, licence: e.licence, source: e.source })),
    duplicates: duplicates.map((g) => ({ hash: g.hash, sizeBytes: g.sizeBytes, ids: g.entries.map((e) => e.id) })),
    broken: broken.map((e) => ({ id: e.id, path: e.path })),
    sources,
  }, null, 2));
  process.exit(0);
}

const line = (label, value) => console.log(`${label.padEnd(28)} ${value}`);

console.log('V4 asset audit');
console.log('===============');
console.log('');
line('catalogue entries', stats.total);
line('known bytes', `${(stats.knownBytes / (1024 * 1024)).toFixed(2)} MiB`);

console.log('By category');
for (const [category, count] of Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])) {
  line(`  ${category}`, count);
}
console.log('');

console.log('By licence');
for (const [licence, count] of Object.entries(stats.byLicence).sort((a, b) => b[1] - a[1])) {
  line(`  ${licence}`, count);
}
console.log('');

line('redistributable', stats.redistributable);
line('quarantined', stats.quarantined);
line('broken files', stats.broken);
line('duplicate groups', stats.duplicateGroups);
line('duplicate entries', stats.duplicateEntries);
console.log('');

console.log(`Quarantined (${quarantined.length}) — never redistributed:`);
for (const entry of quarantined) {
  console.log(`  - ${entry.id}  ${entry.path}`);
  console.log(`      licence: ${entry.licence} | pack: ${entry.pack ?? 'unknown'} | source: ${entry.source}`);
}
console.log('');

console.log(`Duplicate content (${duplicates.length} group(s)):`);
if (!duplicates.length) console.log('  none — every file has unique content');
for (const group of duplicates) {
  console.log(`  sha256 ${group.hash.slice(0, 16)}… (${group.sizeBytes} bytes)`);
  for (const entry of group.entries) console.log(`    - ${entry.id}  ${entry.path}`);
}
console.log('');

console.log(`Broken files (${broken.length}):`);
if (!broken.length) console.log('  none — every entry points at a file that exists');
for (const entry of broken) {
  console.log(`  - ${entry.id}  ${entry.path}`);
}
console.log('');

if (stats.quarantined > 0) {
  console.log(`Note: ${stats.quarantined} asset(s) are quarantined. The export refuses them by design.`);
}
