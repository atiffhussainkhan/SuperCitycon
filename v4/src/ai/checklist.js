/**
 * V4 — Development checklist.
 *
 * A phase-aware checklist: what has to be true before the project moves from
 * one phase to the next. The items are the ones this repository actually
 * enforces (cleared licences, a runnable test suite, a measured performance
 * number), not generic advice.
 */

export const PHASES = ['setup', 'scene', 'assets', 'gameplay', 'test', 'release'];

/** The checklist items per phase. */
export const CHECKLISTS = {
  setup: [
    { id: 'setup.node', title: 'Node and the project dependencies are installed', detail: 'Node 18+ and `npm install` in v4/ — three is the only runtime dependency.', command: 'npm install' },
    { id: 'setup.syntax', title: 'Every source file parses', detail: 'The syntax check must report N/N files parsing cleanly.', command: 'node tools/check-syntax.mjs' },
    { id: 'setup.tests', title: 'The test suite runs green', detail: 'node --test tests/ with no failures.', command: 'node --test tests/' },
    { id: 'setup.layout', title: 'The folder layout matches the plan', detail: 'src/core, src/render, src/ai, src/assets, tools and tests each hold only what they own.' },
  ],
  scene: [
    { id: 'scene.entities', title: 'Every entity has a name and a transform', detail: 'An unnamed entity cannot be found in the hierarchy panel.' },
    { id: 'scene.tags', title: 'Entities are tagged for their role', detail: 'player, npc, static, interactive — the runtime queries by tag.' },
    { id: 'scene.serialise', title: 'The scene round-trips through save and load', detail: 'serializeScene then deserializeScene must produce the same entities.' },
    { id: 'scene.transitions', title: 'Scene transitions fade instead of cutting', detail: 'Load with a fade so the player is not dropped into a new level mid-frame.' },
  ],
  assets: [
    { id: 'assets.audit', title: 'The asset audit has been run', detail: 'node tools/audit-assets.mjs — counts per category, licences, duplicates, broken files.', command: 'node tools/audit-assets.mjs' },
    { id: 'assets.cleared', title: 'Every asset used in the build is cleared for redistribution', detail: 'Unverified licences are quarantined and must never ship.' },
    { id: 'assets.broken', title: 'No entry points at a missing file', detail: 'A catalogue entry whose file is absent is a broken reference, not a warning.' },
    { id: 'assets.duplicates', title: 'Duplicate content has been reviewed', detail: 'Identical files are wasted download weight.' },
    { id: 'assets.manifest', title: 'The exported pack has a manifest', detail: 'The manifest records the sha256 of every exported file.' },
  ],
  gameplay: [
    { id: 'gameplay.physics', title: 'Moving entities have a physics body', detail: 'Kinematic characters are driven by code; everything else is integrated.' },
    { id: 'gameplay.animation', title: 'Animation states map to clips the model really has', detail: 'Check the model\'s clip names before wiring a state machine.' },
    { id: 'gameplay.input', title: 'Input is read through actions, not raw keys', detail: 'Bindings are data so they can be rebound and replayed.' },
    { id: 'gameplay.events', title: 'Gameplay events travel on the bus', detail: 'A throwing listener must never take the frame down.' },
  ],
  test: [
    { id: 'test.unit', title: 'The core modules have unit tests', detail: 'ECS, transform, serialization, scene, clock, profiler, events, logger.' },
    { id: 'test.assets', title: 'The asset tests cover the quarantine rule', detail: 'A quarantined asset must never appear in an exported pack.' },
    { id: 'test.generated', title: 'Generated code is syntax-checked', detail: 'Every generator output is written to a temp file and checked with node --check.' },
    { id: 'test.play', title: 'The vertical slice has been played', detail: 'A green test suite is not the same as a playable build.' },
  ],
  release: [
    { id: 'release.build', title: 'The production build succeeds', detail: 'vite build with no errors — check the output, not just the exit code.', command: 'npm run build' },
    { id: 'release.licence', title: 'No unverified asset is in the bundle', detail: 'The export refuses quarantined assets and reports what it withheld.' },
    { id: 'release.perf', title: 'The performance numbers are measured, not assumed', detail: 'fps, median and p95 frame times come from the profiler samples.' },
    { id: 'release.secrets', title: 'No secret is in the bundle', detail: 'No keys, tokens or endpoints in the source or the exported manifest.' },
    { id: 'release.checklist', title: 'The release checklist is complete', detail: 'Walk every phase of this checklist before shipping.' },
  ],
};

/**
 * Build the checklist for a phase.
 *
 * @param {{phase?:string, project?:object}} opts
 * @returns {{phase:string, project:object, items:Array, notes:string, knownPhases:string[]}}
 */
export function developmentChecklist({ phase = 'setup', project = {} } = {}) {
  const knownPhases = PHASES;
  const key = String(phase ?? '').toLowerCase();
  const items = CHECKLISTS[key];

  if (!items) {
    return {
      phase: key,
      project,
      items: [],
      notes: `Unknown phase "${phase}". Known phases: ${knownPhases.join(', ')}.`,
      knownPhases,
    };
  }

  const name = project.name ?? 'this project';
  const notes = `${items.length} item(s) for the "${key}" phase of ${name}.`;

  return {
    phase: key,
    project,
    items: items.map((item) => ({ ...item })),
    notes,
    knownPhases,
  };
}
