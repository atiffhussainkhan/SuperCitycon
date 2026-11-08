#!/usr/bin/env node
/**
 * tools/explain-error.mjs — explain a V4 error.
 *
 * Usage:
 *   node tools/explain-error.mjs --message "failed to load model \"nature.bank\"" [--stack "..."] [--json]
 *
 * The message may also be piped in: `cat error.log | node tools/explain-error.mjs`.
 */

import { explainError } from '../src/ai/error-explainer.js';

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

let message = typeof args.message === 'string' ? args.message : '';
const stack = typeof args.stack === 'string' ? args.stack : '';

if (!message && !process.stdin.isTTY) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  message = Buffer.concat(chunks).toString('utf8').trim();
}

if (!message) {
  console.error('Nothing to explain. Pass --message "..." or pipe the error in on stdin.');
  process.exit(1);
}

const explanation = explainError({ message, stack });

if (args.json) {
  console.log(JSON.stringify(explanation, null, 2));
  process.exit(0);
}

console.log(`${explanation.title}`);
console.log('='.repeat(explanation.title.length));
console.log('');
console.log('Cause');
console.log(`  ${explanation.cause}`);
console.log('');
console.log('Likely fixes');
for (const fix of explanation.likelyFixes) console.log(`  - ${fix}`);
console.log('');
console.log('Where to look');
for (const where of explanation.whereToLook) console.log(`  - ${where}`);
console.log('');
console.log(`Confidence: ${explanation.confidence}${explanation.matched ? ` (matched: ${explanation.matched})` : ''}`);
if (explanation.evidence.length) {
  console.log('');
  console.log('Evidence');
  for (const item of explanation.evidence) console.log(`  - ${item}`);
}
