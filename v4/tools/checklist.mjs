#!/usr/bin/env node
/**
 * tools/checklist.mjs — print the development checklist for a phase.
 *
 * Usage: node tools/checklist.mjs [--phase setup|scene|assets|gameplay|test|release] [--name "My Game"] [--json]
 */

import { developmentChecklist } from '../src/ai/checklist.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const phase = typeof args.phase === 'string' ? args.phase : 'setup';
const project = { name: typeof args.name === 'string' ? args.name : 'this project' };

const checklist = developmentChecklist({ phase, project });

if (args.json) {
  console.log(JSON.stringify(checklist, null, 2));
  process.exit(checklist.items.length ? 0 : 1);
}

if (!checklist.items.length) {
  console.error(checklist.notes);
  process.exit(1);
}

console.log(`Development checklist — ${checklist.phase} phase (${project.name})`);
console.log('='.repeat(`Development checklist — ${checklist.phase} phase (${project.name})`.length));
console.log('');
for (const item of checklist.items) {
  console.log(`[ ] ${item.title}`);
  console.log(`    ${item.detail}`);
  if (item.command) console.log(`    $ ${item.command}`);
  console.log('');
}
console.log(`${checklist.items.length} item(s) — ${checklist.knownPhases.join(' / ')}`);
