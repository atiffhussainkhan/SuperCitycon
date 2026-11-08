/**
 * V4 — Dialogue.
 *
 * A tiny dialogue-table runner. A table maps a key (a speaker, an NPC, a
 * quest id) to a list of lines:
 *
 *   const table = {
 *     villager: [
 *       { speaker: 'Villager', text: 'Mind the road.', next: 1 },
 *       { speaker: 'Villager', text: 'The chest is north.' },
 *     ],
 *   };
 *
 * `next` may be an index into the same list, or the key of another entry in
 * the table (a branch). Lines without `next` end the conversation.
 *
 * The runner is pure state: it returns the current line and advances on
 * request, so the UI (or the NPC brain) decides how it is displayed.
 */

/**
 * @param {object} [opts]
 * @param {object|Array} [opts.table]  the dialogue table
 * @param {object} [opts.bus]
 */
export function createDialogue({ table = {}, bus = null } = {}) {
  /** @type {Record<string, {speaker:string,text:string,next?:number|string}[]>} */
  const entries = {};

  function addEntry(key, lines) {
    const list = Array.isArray(lines)
      ? lines
      : (Array.isArray(lines?.lines) ? lines.lines : []);
    entries[String(key)] = list
      .filter((l) => l !== null && l !== undefined)
      .map((l) => (typeof l === 'string' ? { speaker: null, text: l } : { ...l }));
  }

  if (Array.isArray(table)) {
    table.forEach((entry, index) => addEntry(entry.key ?? entry.id ?? index, entry.lines ?? entry));
  } else {
    for (const [key, lines] of Object.entries(table)) addEntry(key, lines);
  }

  let active = null;      // the key of the running entry
  let index = 0;          // the index of the current line
  let line = null;        // the current line object

  function publish(reason) {
    bus?.emit?.('gameplay:dialogue', { key: active, index, line: line ? { ...line } : null, reason });
  }

  /**
   * Start a conversation.
   * @param {string} key
   * @returns {object|null} the first line
   */
  function start(key) {
    const id = String(key);
    const list = entries[id];
    if (!list || list.length === 0) return null;
    active = id;
    index = 0;
    line = { speaker: list[0].speaker ?? id, ...list[0] };
    publish('start');
    return { ...line };
  }

  /**
   * Advance to the next line.
   * @returns {object|null} the next line, or null when the conversation ends
   */
  function advance() {
    if (line === null) return null;
    const next = line.next;

    if (next === undefined || next === null) {
      stop();
      return null;
    }

    if (typeof next === 'number') {
      const list = entries[active] ?? [];
      if (!list[next]) {
        stop();
        return null;
      }
      index = next;
      line = { speaker: list[next].speaker ?? active, ...list[next] };
      publish('advance');
      return { ...line };
    }

    // A branch into another entry.
    const target = entries[String(next)];
    if (!target || target.length === 0) {
      stop();
      return null;
    }
    active = String(next);
    index = 0;
    line = { speaker: target[0].speaker ?? active, ...target[0] };
    publish('advance');
    return { ...line };
  }

  /** End the conversation. */
  function stop() {
    const wasActive = active;
    active = null;
    index = 0;
    line = null;
    if (wasActive !== null) publish('stop');
  }

  return {
    /** Is a conversation running? */
    get active() { return active !== null; },
    /** The current line (or null). */
    get current() { return line ? { ...line } : null; },
    /** The key of the running entry. */
    get key() { return active; },
    /** The index of the current line. */
    get index() { return index; },
    /** The keys of every entry in the table. */
    keys() { return Object.keys(entries); },
    /** The lines of one entry. */
    entry(key) { return (entries[String(key)] ?? []).map((l) => ({ ...l })); },

    start,
    advance,
    stop,
  };
}
