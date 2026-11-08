/**
 * V4 — AI-assisted development tooling.
 *
 * Everything here works offline and deterministically. The LLM adapter is
 * optional and off by default; when it is not configured the deterministic
 * generators are the answer.
 */

export {
  PROJECT_TEMPLATES,
  camelCase,
  generateAnimationController,
  generateComponent,
  generateNpcBehaviour,
  generateProject,
  generateScene,
  generateTests,
  importPrefix,
  pascalCase,
  slugify,
} from './generators.js';

export { FAILURE_PATTERNS, explainError } from './error-explainer.js';

export { detectUnusedAssets, reviewBuildErrors, suggestRefactors } from './analyzers.js';

export { CHECKLISTS, PHASES, developmentChecklist } from './checklist.js';

export {
  LLM_ENV,
  createLlmAdapter,
  defaultLlmAdapter,
  redact,
  unavailableReason,
  withLlm,
} from './llm.js';

/**
 * What the tooling can do without a model, and what it cannot.
 *
 * @returns {{deterministic:string[], llmAssisted:string[], offline:boolean, llmAvailable:boolean}}
 */
export function describeCapabilities({ adapter = null } = {}) {
  return {
    offline: true,
    llmAvailable: adapter ? adapter.isAvailable() : false,
    deterministic: [
      'generateProject — a runnable project (entry point, scene, tests, package metadata) from a template',
      'generateScene — a scene module that creates its entities through the serialisation registry',
      'generateComponent — a component module with defaults and a registry registration',
      'generateAnimationController — a state machine wired to the real animator',
      'generateNpcBehaviour — a deterministic NPC state machine driven by caller-supplied distances',
      'generateTests — a node:test module for an engine module',
      'explainError — pattern-matched explanation of the known V4 failure modes',
      'detectUnusedAssets — assets nothing references',
      'reviewBuildErrors — a summary of npm/vite build output',
      'suggestRefactors — long functions, duplicate literals, TODO markers, deep nesting',
      'developmentChecklist — the phase-aware release checklist',
    ],
    llmAssisted: [
      'free-form code review with natural-language explanations',
      'explaining an error whose message does not match a known failure mode',
      'naming and refactoring suggestions that depend on intent, not on rules',
    ],
  };
}
