/**
 * V4 — NPC debug overlay.
 *
 * Pure formatting functions: the editor and the in-game overlay both render
 * the same text, and neither of them needs an NPC system instance to do it.
 * The input is the array returned by `npcSystem.debugState()`.
 */

/**
 * One line per NPC.
 *
 * @param {{id:number,name:string,state:string,position:number[],pathLength:number,lastTransition:object|null}[]} states
 * @param {object} [options]
 * @param {boolean} [options.transitions]  include the last transition
 * @returns {string[]}
 */
export function formatNpcStateLines(states, { transitions = true } = {}) {
  if (!Array.isArray(states) || states.length === 0) return ['no NPCs'];
  const lines = states.map((s) => {
    const pos = s.position ?? [0, 0, 0];
    const p = `${pos[0].toFixed(1)}, ${pos[2].toFixed(1)}`;
    const path = `${s.pathLength ?? 0}`;
    let line = `#${s.id} ${s.name ?? 'npc'} — ${s.state ?? '?'} @ (${p}) path:${path}`;
    if (transitions && s.lastTransition) {
      line += ` ← ${s.lastTransition.from ?? '-'} (${s.lastTransition.at ?? 0})`;
    }
    return line;
  });
  return lines;
}

/**
 * A multi-line summary of the population.
 *
 * @param {object[]} states
 * @param {object} [options]
 * @param {string} [options.title]
 * @returns {string}
 */
export function formatNpcDebugOverlay(states, { title = 'NPCs' } = {}) {
  const list = Array.isArray(states) ? states : [];
  const counts = countByState(list);
  const summary = Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([state, n]) => `${state}:${n}`)
    .join(' ');

  const header = `${title} (${list.length})${summary ? ` — ${summary}` : ''}`;
  return [header, ...formatNpcStateLines(list)].join('\n');
}

/**
 * How many NPCs are in each state.
 * @param {object[]} states
 * @returns {Record<string, number>}
 */
export function countByState(states) {
  const counts = {};
  if (!Array.isArray(states)) return counts;
  for (const s of states) {
    const key = s?.state ?? 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * A compact one-line status, e.g. for the HUD.
 * @param {object[]} states
 * @returns {string}
 */
export function formatNpcCount(states) {
  const list = Array.isArray(states) ? states : [];
  const counts = countByState(list);
  const detail = Object.entries(counts)
    .map(([state, n]) => `${state} ${n}`)
    .join(', ');
  return detail ? `${list.length} NPC (${detail})` : '0 NPC';
}
