/**
 * AI tooling tests — the error explainer, the analysers, the checklist and
 * the optional LLM adapter.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { detectUnusedAssets, reviewBuildErrors, suggestRefactors } from '../src/ai/analyzers.js';
import { CHECKLISTS, PHASES, developmentChecklist } from '../src/ai/checklist.js';
import { explainError } from '../src/ai/error-explainer.js';
import { LLM_ENV, createLlmAdapter, redact, unavailableReason, withLlm } from '../src/ai/llm.js';
import { describeCapabilities } from '../src/ai/index.js';
import { createAssetLibrary } from '../src/assets/library.js';

/* --------------------------------------------------------- error explainer */

test('the explainer names the known V4 failure modes', () => {
  const cases = [
    ['failed to load model "nature/bank.glb": 404', 'missing-model'],
    ['unknown scene "level9"', 'unknown-scene'],
    ['duplicate entity id 12', 'duplicate-entity-id'],
    ['transform position became NaN', 'nan-transform'],
    ['no physics body for entity 4', 'missing-physics-body'],
    ['animation clip "Strafe" not found', 'animation-clip-missing'],
    ['QuotaExceededError: the quota has been exceeded', 'localstorage-quota'],
  ];

  for (const [message, expected] of cases) {
    const explanation = explainError({ message });
    assert.equal(explanation.matched, expected, `"${message}" should match ${expected}`);
    assert.ok(explanation.title.length > 0);
    assert.ok(explanation.cause.length > 0);
    assert.ok(explanation.likelyFixes.length > 0);
    assert.ok(explanation.whereToLook.length > 0);
    assert.ok(['high', 'medium', 'low'].includes(explanation.confidence));
  }
});

test('the explainer falls back honestly on an unknown error', () => {
  const explanation = explainError({ message: 'something entirely unexpected happened' });
  assert.equal(explanation.matched, null);
  assert.equal(explanation.title, 'Unrecognised error');
  assert.equal(explanation.confidence, 'low');
  assert.ok(explanation.likelyFixes.length > 0);
});

test('the explainer says so when there is nothing to explain', () => {
  const explanation = explainError({});
  assert.equal(explanation.title, 'Nothing to explain');
  assert.equal(explanation.confidence, 'low');
});

test('the explainer uses the stack and the logger records as evidence', () => {
  const explanation = explainError({
    message: 'failed to load model "props/house.glb"',
    stack: 'Error: failed to load model\n    at loadModel (asset-loader.js:60:9)',
    loggerRecords: [{ level: 'error', message: 'failed to load model "props/house.glb"' }],
    events: [{ type: 'error', payload: { message: 'failed to load model' } }],
  });
  assert.equal(explanation.matched, 'missing-model');
  assert.ok(explanation.evidence.length >= 2);
});

/* ---------------------------------------------------------------- analyzers */

function fakeLibrary() {
  return createAssetLibrary({
    root: '/nowhere',
    entries: [
      { id: 'used.one', path: 'a', category: 'x', licence: 'CC0-1.0', author: 'a', source: 'a', redistributable: true, quarantined: false },
      { id: 'unused.one', path: 'b', category: 'x', licence: 'CC0-1.0', author: 'a', source: 'a', redistributable: true, quarantined: false },
      { id: 'unused.two', path: 'c', category: 'y', licence: 'CC0-1.0', author: 'a', source: 'a', redistributable: true, quarantined: false },
    ],
  });
}

test('detectUnusedAssets reports the entries nothing references', () => {
  const result = detectUnusedAssets({ library: fakeLibrary(), referencedIds: ['used.one'] });
  assert.equal(result.total, 3);
  assert.deepEqual(result.used.map((e) => e.id), ['used.one']);
  assert.deepEqual(result.unused.map((e) => e.id).sort(), ['unused.one', 'unused.two']);
  assert.deepEqual(result.unknownReferences, []);
});

test('detectUnusedAssets reports references that point at nothing', () => {
  const result = detectUnusedAssets({ library: fakeLibrary(), referencedIds: ['ghost'] });
  assert.deepEqual(result.unknownReferences, ['ghost']);
});

test('reviewBuildErrors summarises a vite build failure', () => {
  const output = [
    'vite v5.4.10 building for production...',
    'transforming...',
    'src/main.js:12:5: ERROR: Failed to resolve import "./missing.js"',
    'src/core/ecs.js:4:1: WARNING: "world" is not exported',
    'build failed with 1 error',
  ].join('\n');

  const review = reviewBuildErrors({ output });
  assert.equal(review.ok, false);
  assert.equal(review.errors.length, 1);
  assert.equal(review.errors[0].file, 'src/main.js');
  assert.equal(review.errors[0].line, 12);
  assert.match(review.errors[0].message, /Failed to resolve/);
  assert.equal(review.warnings.length, 1);
  assert.match(review.summary, /1 error/);
});

test('reviewBuildErrors reports a clean build', () => {
  const review = reviewBuildErrors({ output: 'vite v5.4.10 building for production...\n✓ built in 1.20s' });
  assert.equal(review.ok, true);
  assert.equal(review.errors.length, 0);
  assert.match(review.summary, /no errors/);
});

test('reviewBuildErrors copes with empty output', () => {
  const review = reviewBuildErrors({});
  assert.equal(review.ok, true);
  assert.equal(review.errors.length, 0);
});

test('suggestRefactors finds long functions, TODO markers, duplicate literals and deep nesting', () => {
  const longBody = Array.from({ length: 50 }, (_, i) => `  const value${i} = ${i};`).join('\n');
  const files = [
    {
      path: 'src/big.js',
      content: `export function doEverything() {\n${longBody}\n}\n// TODO: split this up\n`,
    },
    {
      path: 'src/other.js',
      content: 'const magic = "a-very-long-magic-string";\nconst again = "a-very-long-magic-string";\n',
    },
    {
      path: 'src/third.js',
      content: 'const magic = "a-very-long-magic-string";\n',
    },
  ];

  const result = suggestRefactors({ files });
  const rules = new Set(result.findings.map((f) => f.rule));
  assert.ok(rules.has('long-function'));
  assert.ok(rules.has('todo-marker'));
  assert.ok(rules.has('duplicate-literal'));
  assert.ok(result.findings.length >= 3);
});

test('suggestRefactors finds deep nesting', () => {
  const nested = 'function f() {\n'.repeat(1) + '  if (a) {\n    if (b) {\n      if (c) {\n        if (d) {\n          return 1;\n        }\n      }\n    }\n  }\n}\n';
  const result = suggestRefactors({ files: [{ path: 'x.js', content: nested }] });
  assert.ok(result.findings.some((f) => f.rule === 'deep-nesting'));
});

test('suggestRefactors reports a clean file honestly', () => {
  const result = suggestRefactors({ files: [{ path: 'clean.js', content: 'export const x = 1;\n' }] });
  assert.equal(result.findings.length, 0);
  assert.match(result.summary, /no findings/);
});

/* ---------------------------------------------------------------- checklist */

test('every phase has a checklist', () => {
  for (const phase of PHASES) {
    const checklist = developmentChecklist({ phase });
    assert.ok(checklist.items.length > 0, `${phase} must have items`);
    for (const item of checklist.items) {
      assert.equal(typeof item.id, 'string');
      assert.equal(typeof item.title, 'string');
      assert.equal(typeof item.detail, 'string');
    }
  }
  assert.deepEqual(Object.keys(CHECKLISTS).sort(), [...PHASES].sort());
});

test('the checklist is phase-aware', () => {
  const setup = developmentChecklist({ phase: 'setup' });
  const release = developmentChecklist({ phase: 'release' });
  assert.notEqual(setup.items[0].id, release.items[0].id);
  assert.ok(release.items.some((i) => /licence|secret/i.test(i.title + i.detail)));
});

test('an unknown phase says so instead of pretending', () => {
  const checklist = developmentChecklist({ phase: 'nonsense' });
  assert.equal(checklist.items.length, 0);
  assert.match(checklist.notes, /Unknown phase/);
});

test('the checklist carries the project name', () => {
  const checklist = developmentChecklist({ phase: 'setup', project: { name: 'Space Game' } });
  assert.match(checklist.notes, /Space Game/);
});

/* --------------------------------------------------------------------- llm */

test('the LLM adapter is off by default', () => {
  const adapter = createLlmAdapter();
  const status = adapter.status();
  assert.equal(status.available, false);
  assert.match(status.reason, /disabled by default/);
});

test('the LLM adapter stays unavailable without its environment variables', () => {
  const adapter = createLlmAdapter({ env: {}, enabled: true });
  const status = adapter.status();
  assert.equal(status.available, false);
  assert.match(status.reason, new RegExp(LLM_ENV.endpoint));
});

test('the LLM adapter reports a bad endpoint instead of using it', () => {
  const adapter = createLlmAdapter({
    env: { [LLM_ENV.endpoint]: 'not-a-url', [LLM_ENV.key]: 'x' },
    enabled: true,
  });
  assert.equal(adapter.status().available, false);
  assert.match(adapter.status().reason, /http\(s\) URL/);
});

test('the LLM adapter is available once the environment is configured', () => {
  const adapter = createLlmAdapter({
    env: { [LLM_ENV.endpoint]: 'http://localhost:11434/v1/chat', [LLM_ENV.key]: 'local-key' },
    enabled: true,
  });
  const status = adapter.status();
  assert.equal(status.available, true);
  assert.equal(status.endpoint, 'http://localhost:11434/v1/chat');
});

test('the LLM adapter refuses to call an unconfigured provider', async () => {
  const adapter = createLlmAdapter({ env: {}, enabled: false });
  await assert.rejects(() => adapter.complete('hello'), /disabled by default/);
});

test('the LLM adapter posts to the configured endpoint and parses the answer', async () => {
  const calls = [];
  const adapter = createLlmAdapter({
    env: { [LLM_ENV.endpoint]: 'http://localhost:11434/v1/chat', [LLM_ENV.key]: 'local-key', [LLM_ENV.model]: 'a-model' },
    enabled: true,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ text: 'generated answer' }),
      };
    },
  });

  const result = await adapter.complete('make a scene');
  assert.equal(result.text, 'generated answer');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:11434/v1/chat');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.prompt, 'make a scene');
  assert.equal(body.model, 'a-model');
});

test('withLlm falls back to the deterministic path when no provider is configured', async () => {
  const adapter = createLlmAdapter({ env: {}, enabled: false });
  const result = await withLlm({
    prompt: 'anything',
    adapter,
    fallback: async () => ({ files: [], notes: ['deterministic'] }),
  });
  assert.equal(result.source, 'fallback');
  assert.match(result.reason, /disabled by default/);
  assert.deepEqual(result.result.notes, ['deterministic']);
});

test('redact removes the key from anything that is about to be logged', () => {
  assert.equal(redact('the key is super-secret-value', 'super-secret-value'), 'the key is [redacted]');
  assert.equal(redact('token sk-abcdefghijklmnopqrstuvwxyz', null), 'token [redacted]');
});

test('unavailableReason names the environment variables it needs', () => {
  assert.match(unavailableReason({}, false), /V4_LLM_ENDPOINT/);
  assert.match(unavailableReason({ [LLM_ENV.endpoint]: 'http://x' }, true), /V4_LLM_KEY/);
});

test('the LLM module contains no hardcoded key, endpoint or provider URL', () => {
  const source = readFileSync(new URL('../src/ai/llm.js', import.meta.url), 'utf8');
  assert.equal(/sk-[A-Za-z0-9]{8,}/.test(source), false);
  assert.equal(/AKIA[0-9A-Z]{12,}/.test(source), false);
  assert.equal(/api\.(openai|anthropic|googleapis|groq)\./i.test(source), false);
  assert.equal(/https?:\/\/(?!localhost)/i.test(source), false);
  assert.match(source, /process\.env/);
});

/* -------------------------------------------------------------- capabilities */

test('describeCapabilities separates the deterministic work from the LLM work', () => {
  const capabilities = describeCapabilities();
  assert.equal(capabilities.offline, true);
  assert.ok(capabilities.deterministic.length > 0);
  assert.ok(capabilities.llmAssisted.length > 0);
  assert.equal(capabilities.llmAvailable, false);
  assert.ok(capabilities.deterministic.some((d) => /generateProject/.test(d)));
});
