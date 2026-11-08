/**
 * V4 — Heads-up display.
 *
 * A DOM HUD drawn into a container element: health, the current objective,
 * the interaction prompt, the frame timing, the NPC count and the current
 * animation state.
 *
 * The module is import-safe in Node: `document` is looked up lazily and a
 * missing DOM simply turns the HUD into a no-op that still records the last
 * state (so tests can assert on it).
 */

/**
 * The HUD's layout.
 *
 * The editor draws its own furniture over the same viewport: a gizmo badge in
 * the top-left, the edit/play badge in the top-right and the preview inset in
 * the bottom-right. The gameplay readouts are placed so the two never print
 * on top of each other — the health, NPC count and animation state stack up
 * the bottom-left, clear of all three.
 */
const STYLE = {
  root: 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#e8eefc;text-shadow:0 1px 2px rgba(0,0,0,.7);',
  panel: 'position:absolute;padding:10px 14px;background:rgba(10,16,28,.55);border:1px solid rgba(120,160,220,.25);border-radius:6px;backdrop-filter:blur(2px);',
  healthTrack: 'position:relative;width:180px;height:10px;border-radius:5px;background:rgba(255,255,255,.14);overflow:hidden;',
  healthFill: 'position:absolute;inset:0;width:100%;background:linear-gradient(90deg,#48c774,#a6e22e);transition:width .15s linear;',
  objective: 'position:absolute;top:16px;left:50%;transform:translateX(-50%);font-size:14px;letter-spacing:.02em;',
  prompt: 'position:absolute;bottom:84px;left:50%;transform:translateX(-50%);padding:5px 12px;border-radius:4px;background:rgba(10,16,28,.7);border:1px solid rgba(120,160,220,.35);',
  message: 'position:absolute;bottom:124px;left:50%;transform:translateX(-50%);max-width:70%;text-align:center;padding:6px 12px;border-radius:4px;background:rgba(10,16,28,.72);border:1px solid rgba(120,160,220,.35);',
  perf: 'position:absolute;top:44px;right:16px;text-align:right;',
  npc: 'position:absolute;bottom:36px;left:16px;',
  anim: 'position:absolute;bottom:16px;left:16px;',
};

/**
 * @param {object} opts
 * @param {HTMLElement} [opts.container]  where the HUD is drawn
 * @param {object} [opts.bus]
 * @param {Document} [opts.doc]  the document to build in (defaults to globalThis.document)
 */
export function createHud({ container = null, bus = null, doc = null } = {}) {
  const target = doc ?? (typeof document !== 'undefined' ? document : null);
  const host = container ?? null;
  let lastState = null;

  if (!target || !host || typeof target.createElement !== 'function') {
    // No DOM: the HUD keeps the state but draws nothing.
    return {
      /** True when the HUD is actually drawing. */
      get mounted() { return false; },
      /** The last state passed to update(). */
      get state() { return lastState; },
      /** Record a state (no-op when there is no DOM). */
      update(state) { lastState = { ...state }; return lastState; },
      /** Remove the HUD (no-op when there is no DOM). */
      destroy() {},
    };
  }

  function el(tag, style, text) {
    const node = target.createElement(tag);
    if (style) node.setAttribute('style', style);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const root = el('div', STYLE.root);

  // Health.
  const healthPanel = el('div', STYLE.panel);
  // The health panel sits in the bottom-left stack, clear of the editor's own
  // corner badges and of the preview inset.
  healthPanel.style.bottom = '56px';
  healthPanel.style.left = '16px';
  const healthLabel = el('div', null, 'HP 100 / 100');
  const healthTrack = el('div', STYLE.healthTrack);
  const healthFill = el('div', STYLE.healthFill);
  healthTrack.appendChild(healthFill);
  healthPanel.appendChild(healthLabel);
  healthPanel.appendChild(healthTrack);
  root.appendChild(healthPanel);

  // Objective.
  const objective = el('div', STYLE.objective, '');
  root.appendChild(objective);

  // Interaction prompt.
  const prompt = el('div', STYLE.prompt, '');
  prompt.style.display = 'none';
  root.appendChild(prompt);

  // The last thing that was said or read (a dialogue line, a note on a prop).
  const message = el('div', STYLE.message, '');
  message.style.display = 'none';
  root.appendChild(message);

  // Performance.
  const perf = el('div', STYLE.perf, '— fps');
  root.appendChild(perf);

  // NPC count.
  const npc = el('div', STYLE.npc, '0 NPCs');
  root.appendChild(npc);

  // Animation state.
  const anim = el('div', STYLE.anim, 'anim: —');
  root.appendChild(anim);

  host.appendChild(root);

  function healthParts(state) {
    const h = state?.health;
    if (h === null || h === undefined) return null;
    if (typeof h === 'number') {
      const ratio = Math.max(0, Math.min(1, h));
      return { ratio, current: Math.round(ratio * 100), max: 100 };
    }
    const current = h.current ?? 0;
    const max = h.max ?? 100;
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    return { ratio, current, max };
  }

  /**
   * Push a new state into the HUD.
   * @param {object} state
   * @param {{current:number,max:number}|number} [state.health]
   * @param {string} [state.objective]
   * @param {string} [state.prompt]
   * @param {string} [state.message]  the last line that was spoken or read
   * @param {number} [state.fps]
   * @param {number} [state.frameMs]
   * @param {number} [state.npcCount]
   * @param {string} [state.animState]
   */
  function update(state = {}) {
    lastState = { ...state };

    const hp = healthParts(state);
    if (hp) {
      healthLabel.textContent = `HP ${Math.round(hp.current)} / ${hp.max}`;
      healthFill.style.width = `${Math.round(hp.ratio * 100)}%`;
      healthFill.style.background = hp.ratio < 0.25
        ? 'linear-gradient(90deg,#e0554a,#f0a04a)'
        : 'linear-gradient(90deg,#48c774,#a6e22e)';
    }

    if (state.objective !== undefined) objective.textContent = state.objective ?? '';

    if (state.prompt !== undefined) {
      prompt.textContent = state.prompt ?? '';
      prompt.style.display = state.prompt ? 'block' : 'none';
    }

    if (state.message !== undefined) {
      message.textContent = state.message ?? '';
      message.style.display = state.message ? 'block' : 'none';
    }

    if (state.fps !== undefined || state.frameMs !== undefined) {
      const fps = state.fps !== undefined ? state.fps.toFixed(0) : '—';
      const ms = state.frameMs !== undefined ? state.frameMs.toFixed(1) : '—';
      perf.textContent = `${fps} fps · ${ms} ms`;
    }

    if (state.npcCount !== undefined) {
      npc.textContent = `${state.npcCount} NPC${state.npcCount === 1 ? '' : 's'}`;
    }

    if (state.animState !== undefined) anim.textContent = `anim: ${state.animState ?? '—'}`;

    return lastState;
  }

  return {
    /** True when the HUD is drawing. */
    get mounted() { return true; },
    /** The last state pushed into the HUD. */
    get state() { return lastState; },
    /** The HUD root element. */
    get element() { return root; },
    update,
    /** Remove the HUD from the page. */
    destroy() {
      root.remove?.();
    },
  };
}
