/**
 * ui/settings-panel.js — the settings, accessibility and controls panels.
 *
 * OWNER: UX (BOT-09).
 *
 * THE PANELS ARE DATA-DRIVEN
 *   The setting rows are built from `core/settings.js`'s `SCHEMA` and the
 *   key rows from `core/input-map.js`. Nothing is hard-coded here, so a new
 *   setting or a rebinding shows up without touching this file.
 *
 * THE PAD IS REBINDABLE TOO
 *   A gamepad button can be bound to an action, and the binding is stored
 *   (`input.padBindings`) and pushed into the live pad table, so it takes
 *   effect on the next frame. The panel reads the pad through the browser's
 *   Gamepad API, but ONLY while a capture is running: a panel that polled
 *   the pad forever would be a panel that never slept.
 *
 *   The capture is HONEST. It binds the button that went DOWN — an edge,
 *   not a hold — so a button that was already held when the capture started
 *   is not a press; the menu's own buttons (A, B and the d-pad by default)
 *   are reserved, because the player is using the menu to reach this
 *   screen; and Escape cancels a capture, so the player is never trapped.
 *
 * THE EFFECTS ARE REAL
 *   A row does not just remember a number: it pushes that number into the
 *   audio mixer, into the renderer and into the stylesheet, so the change is
 *   visible (and audible) on the very next frame.
 *
 *     audio.*              -> ctx.audio.setBusVolume(bus, v) / setMuted(b)
 *     display.resolution   -> ctx.renderer.setPixelSize(n)
 *     display.fullscreen   -> the browser's own fullscreen request
 *     reducedEffects       -> ctx.renderer.setPostFX(false) + no shadows
 *     reducedShake         -> the camera rig reads the setting itself
 *     textScale            -> the `--sc-text-scale` CSS variable
 *     highContrast         -> the `data-sc-contrast` attribute
 *     colourBlind          -> the `data-sc-colourblind` attribute
 *
 * This module keeps its PURE parts DOM-free: `applyUiEffects()` and the
 * value formatting can be unit-tested in Node without a document.
 */

import { SCHEMA } from '../core/settings.js';
import { EVENTS } from '../core/events.js';
import { createLogger } from '../core/log.js';
import { buildSettingsModel, buildControlsModel, titleCase } from './panels.js';
import { readPad, diffPad } from '../core/gamepad.js';
import { PAD_ACTIONS, padLabel } from '../core/input-map.js';

/** The audio buses the settings know about. */
export const AUDIO_BUSES = Object.freeze(['master', 'music', 'sfx', 'ambience', 'ui']);

/**
 * The pad actions the MENU owns.
 *
 * A and B confirm and go back in the menu, and the d-pad moves the focus
 * ring, so none of them may be captured: the player is using the menu to
 * reach this very screen, and a capture that ate a navigation press would
 * move the focus instead of binding. Taking the d-pad from the menu would
 * also leave a pad player unable to move around the menu at all.
 *
 * The reservation is read from the LIVE pad table, so a player who has
 * moved the menu's buttons elsewhere gets those buttons back: bind
 * `menu.up` to another button first, and the d-pad is free to be bound.
 */
const MENU_PAD_ACTIONS = Object.freeze([
  'menu.up',
  'menu.down',
  'menu.left',
  'menu.right',
  'menu.confirm',
  'menu.back',
]);

/**
 * How often the panel reads the pad while a capture is running, in
 * milliseconds.
 *
 * TBD: 50 ms is a guess. It is about a frame and a half at 60 Hz, so a
 * press is noticed before it feels laggy, without polling the pad a hundred
 * times a second for nothing. The panel polls ONLY while a capture is
 * running, and stops the moment the capture ends.
 */
const PAD_POLL_MS = 50;

/**
 * "zoomIn" -> "zoom In".
 *
 * The same camel-case split the keyboard rows use, so a pad row reads
 * "Camera — Zoom In" and not "Camera — Zoomin".
 *
 * @param {string} name
 * @returns {string}
 */
function padWords(name) {
  return String(name).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/**
 * Read the pads the browser can see.
 *
 * `navigator.getGamepads` does not exist in every browser and can throw in
 * a page that is not secure, so the failure is a "no pad" rather than a
 * crash.
 *
 * @returns {Array|null}
 */
function readBrowserPads() {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (!nav || typeof nav.getGamepads !== 'function') return null;
    const pads = nav.getGamepads();
    return Array.isArray(pads) ? pads : Array.from(pads ?? []);
  } catch {
    return null;
  }
}

/** The bus a setting key belongs to ('audio.music' -> 'music'). */
function busOf(key) {
  return String(key).startsWith('audio.') ? String(key).slice('audio.'.length) : null;
}

/**
 * Format a setting value for the screen.
 *
 * @param {string} key
 * @param {object} def  the schema entry
 * @param {*} value
 * @returns {string}
 */
export function formatSettingValue(key, def, value) {
  if (def?.type === 'boolean') return value ? 'ON' : 'OFF';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  // The audio buses and the resolution scale are 0..1 ratios: show them as
  // percentages, because "0.7" on a volume slider is a puzzle.
  if (def?.min === 0 && def?.max === 1) return `${Math.round(n * 100)}%`;
  return String(Math.round(n * 100) / 100);
}

/**
 * Apply the player's settings to the systems that own the effects.
 *
 * Everything is optional: a game without audio, without a renderer or
 * without a document still works — the panel simply has nothing to push to.
 *
 * @param {object} ctx
 * @returns {{audio:boolean, display:boolean, accessibility:boolean}}
 */
export function applyUiEffects(ctx) {
  const settings = ctx?.settings;
  const result = { audio: false, display: false, accessibility: false };
  if (!settings || typeof settings.get !== 'function') return result;

  const values = typeof settings.all === 'function' ? settings.all() : {};
  const get = (key) => (typeof settings.get === 'function' ? settings.get(key) : values[key]);

  // ---- audio ------------------------------------------------------------
  const audio = ctx?.audio;
  if (audio) {
    for (const bus of AUDIO_BUSES) {
      const value = get(`audio.${bus}`);
      if (typeof value !== 'number') continue;
      try { audio.setBusVolume?.(bus, value); } catch { /* the mixer is optional */ }
    }
    const muted = get('audio.muted');
    if (typeof muted === 'boolean') {
      try { audio.setMuted?.(muted); } catch { /* the mixer is optional */ }
    }
    result.audio = true;
  }

  // ---- display ----------------------------------------------------------
  const renderer = ctx?.renderer;
  const scale = get('display.resolutionScale');
  if (renderer && typeof scale === 'number') {
    // The renderer works in PIXEL SIZE (1 = native, 2 = half resolution).
    const pixelSize = Math.max(1, Math.min(4, Math.round(1 / scale)));
    try { renderer.setPixelSize?.(pixelSize); } catch { /* the renderer is optional */ }
  }
  result.display = !!renderer;

  // ---- accessibility ----------------------------------------------------
  const reducedEffects = !!get('accessibility.reducedEffects');
  const reducedShake = !!get('accessibility.reducedShake');
  const textScale = Number(get('accessibility.textScale'));
  const highContrast = !!get('accessibility.highContrast');
  const colourBlind = !!get('accessibility.colourBlind');

  if (renderer) {
    // Reduced effects: the retro post chain and the shadows are switched
    // off. The shadows are left to the adaptive quality manager afterwards,
    // so this layer never fights it.
    //
    // The post chain is only ever switched OFF here. It is NOT switched on
    // when reduced effects are off: post-processing is OFF by default in the
    // renderer, and the ADAPTIVE QUALITY driver decides whether to enable it
    // from the measured frame rate. Forcing it on here would override that
    // decision on exactly the weak hardware the driver exists to protect.
    if (reducedEffects) {
      try { renderer.setPostFX?.(false); } catch { /* the renderer is optional */ }
      try { renderer.setShadowsEnabled?.(false); } catch { /* the renderer is optional */ }
    }
    try { renderer.fx?.setReducedMotion?.(reducedEffects); } catch { /* the FX service is optional */ }
    // The renderer has no shake switch of its own — the camera rig owns the
    // shake and reads `accessibility.reducedShake` itself. The call below is
    // a courtesy to a renderer that does have one.
    try { renderer.setReducedShake?.(reducedShake); } catch { /* the renderer is optional */ }
  }

  const doc = typeof document !== 'undefined' ? document : null;
  const root = doc?.documentElement ?? null;
  if (root) {
    const style = root.style;
    if (style && typeof style.setProperty === 'function') {
      style.setProperty('--sc-text-scale', String(Number.isFinite(textScale) ? textScale : 1));
    }
    if (root.dataset) {
      root.dataset.scContrast = highContrast ? 'high' : 'normal';
      root.dataset.scColourBlind = colourBlind ? '1' : '0';
    }
    if (typeof root.setAttribute === 'function') {
      root.setAttribute('data-sc-contrast', highContrast ? 'high' : 'normal');
      root.setAttribute('data-sc-colourblind', colourBlind ? '1' : '0');
    }
  }
  result.accessibility = true;

  return result;
}

/**
 * Create the settings / accessibility / controls panel service.
 *
 * @param {object} ctx
 * @param {object} [deps]
 * @param {Function} [deps.onToast]  called with (message, kind)
 * @param {Function} [deps.onChange]  called after a value was written
 * @returns {object} the panel service
 */
export function createSettingsPanel(ctx, deps = {}) {
  const logger = deps.logger ?? ctx?.logger ?? createLogger({ category: 'ui/settings', console: false });
  const settings = ctx?.settings ?? null;
  const inputMap = ctx?.inputMap ?? null;
  const bus = ctx?.bus ?? null;

  /** The action whose next key press is being captured for a rebind. */
  let capturing = null;

  /** The action whose next PAD BUTTON press is being captured. */
  let padCapturing = null;

  /** The watchers that want to hear about pad button presses. */
  const padWatchers = new Set();

  /** The last pad snapshot, so a press can be told from a hold. */
  let padPrevious = null;

  /** The poll timer. It exists only while a capture is running. */
  let padTimer = null;

  /** The unsubscribe function of the running pad watch, if any. */
  let padUnwatch = null;

  /** The pad reader: the browser's pads, or a fake one in a test. */
  const getPads = typeof deps.getPads === 'function' ? deps.getPads : readBrowserPads;

  /** How often the pad is read while a capture is running, in ms. */
  const pollIntervalMs = Number.isFinite(deps.pollIntervalMs) && deps.pollIntervalMs > 0
    ? deps.pollIntervalMs
    : PAD_POLL_MS;

  /**
   * The menu's focus registrar.
   *
   * The settings rows are built here, not by the menu, so the menu cannot
   * know about them on its own. It hands over a registrar and the rows join
   * the menu's focus ring, which is what makes them reachable with a gamepad
   * and with the keyboard.
   */
  let focusRegistrar = null;

  /**
   * Join a control to the menu's focus ring.
   * @param {object} node
   */
  function registerFocusable(node) {
    if (!node) return null;
    if (typeof focusRegistrar !== 'function') return node;
    try {
      return focusRegistrar(node) ?? node;
    } catch {
      return node;
    }
  }

  /** The container that was rendered last, so a change can refresh it. */
  let lastContainer = null;
  let lastView = null;

  /** The containers the panel has already bound its click handler to. */
  const bound = new WeakSet();

  /**
   * Bind the panel's own click handler to a container.
   *
   * The panel owns its controls, so it listens to them itself — the caller
   * only supplies the container.
   */
  function bind(container) {
    if (!container || typeof container.addEventListener !== 'function') return;
    if (bound.has(container)) return;
    bound.add(container);
    container.addEventListener('click', (e) => {
      // Every write refreshes the view itself, so nothing more is needed
      // here — the handler only has to run.
      onClick(e);
    });
  }

  /** Re-render the last view, so the read-outs follow the change. */
  function refresh() {
    if (!lastContainer || !lastView) return null;
    return renderView(lastContainer, lastView);
  }

  /** Render one of the views into a container. */
  function renderView(container, view) {
    if (view === 'settings') return renderSettings(container);
    if (view === 'accessibility') return renderAccessibility(container);
    if (view === 'controls') return renderControls(container);
    return null;
  }

  /** Create an element with a class, text and attributes. */
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function schema() {
    const s = settings && typeof settings.schema === 'function' ? settings.schema() : SCHEMA;
    return s && typeof s === 'object' ? s : SCHEMA;
  }

  function values() {
    return settings && typeof settings.all === 'function' ? settings.all() : {};
  }

  /**
   * Write one setting and push the consequences out.
   *
   * @param {string} key
   * @param {*} value
   * @param {{refresh?:boolean}} [opts] `refresh:false` keeps the DOM as it
   *   is — a slider that is being dragged must not be rebuilt under the
   *   player's finger.
   */
  function writeSetting(key, value, opts = {}) {
    if (!settings || typeof settings.set !== 'function') {
      logger.warn('a setting was changed but there is no settings store', { key });
      return false;
    }
    let ok = false;
    try {
      ok = settings.set(key, value) !== false;
    } catch (err) {
      logger.exception(err, { key });
      return false;
    }
    applyUiEffects(ctx);
    // NOTE: the settings store notifies its own listeners (the integrator
    // emits SETTINGS_CHANGED from there), so this layer does not emit it a
    // second time.
    deps.onChange?.(key, settings.get?.(key));
    if (opts.refresh !== false) refresh();
    return ok;
  }

  /**
   * Persist the current bindings.
   *
   * The bindings live in the settings store (`input.bindings`), so a
   * rebind survives a reload.
   */
  function persistBindings() {
    if (!inputMap || typeof inputMap.all !== 'function') return false;
    const table = inputMap.all();
    return writeSetting('input.bindings', table);
  }

  /**
   * Persist the current GAMEPAD bindings.
   *
   * The pad table lives in the settings store (`input.padBindings`), so a
   * rebound button survives a reload. The table is also applied to the LIVE
   * input map here: the gamepad service reads that table every frame, so a
   * stored override has to be in it before the next frame is drawn.
   *
   * @returns {boolean} true when the table was written
   */
  function persistPadBindings() {
    if (!inputMap || typeof inputMap.padAll !== 'function') return false;
    const table = inputMap.padAll();
    inputMap.applyPadOverrides?.(table);
    return writeSetting('input.padBindings', table);
  }

  /**
   * Apply the stored gamepad overrides to the live pad table.
   *
   * The panel does this itself because the integrator's boot code wires up
   * the KEY overrides only, and a rebound button that is not in the table
   * before the first frame is a binding that does nothing until the player
   * happens to visit the settings panel.
   *
   * @returns {boolean} true when an override was applied
   */
  function applyStoredPadBindings() {
    if (!inputMap || typeof inputMap.applyPadOverrides !== 'function') return false;
    const stored = settings?.get?.('input.padBindings') ?? null;
    if (!stored || typeof stored !== 'object') return false;
    return inputMap.applyPadOverrides(stored) === true;
  }

  // ---- pad capture (rebinding a gamepad button) --------------------------

  /**
   * The current pad snapshot, or a disconnected one.
   *
   * @returns {object} a snapshot from `readPad`
   */
  function padSnapshot() {
    let pads = null;
    try {
      pads = typeof getPads === 'function' ? getPads() : null;
    } catch {
      return readPad(null);
    }
    if (!pads) return readPad(null);
    const list = Array.isArray(pads) ? pads : Array.from(pads ?? []);
    for (const pad of list) {
      if (pad && pad.connected) return readPad(pad);
    }
    return readPad(null);
  }

  /**
   * Read the pad once and tell the watchers about the buttons that went DOWN.
   *
   * The EDGE is what makes the capture honest: a button that was already
   * held when the capture started is not a press, and a button that is still
   * held is not a second press.
   *
   * @returns {number[]} the button indices that were pressed
   */
  function pollPadButtons() {
    const next = padSnapshot();
    const diff = diffPad(padPrevious, next);
    padPrevious = next;
    for (const index of diff.pressed) {
      for (const fn of Array.from(padWatchers)) {
        try { fn(index); } catch { /* a broken watcher must not break the panel */ }
      }
    }
    return diff.pressed;
  }

  /** Start polling the pad. The timer lives only while a capture runs. */
  function startPadWatch() {
    if (padTimer !== null) return;
    // The baseline is taken NOW: a button the player is already holding —
    // the one that opened this screen — is not a press.
    padPrevious = padSnapshot();
    padTimer = setInterval(pollPadButtons, pollIntervalMs);
  }

  /** Stop polling the pad and forget the baseline. */
  function stopPadWatch() {
    if (padTimer !== null) {
      clearInterval(padTimer);
      padTimer = null;
    }
    padPrevious = null;
  }

  /**
   * Watch the pad for button presses.
   *
   * The panel reads the pad ONLY while a watcher is registered, so a panel
   * nobody is capturing with never touches the gamepad API.
   *
   * @param {Function} fn (buttonIndex) => void
   * @returns {Function} an unsubscribe function
   */
  function watchPadButtons(fn) {
    if (typeof fn !== 'function') return () => {};
    padWatchers.add(fn);
    startPadWatch();
    return () => {
      padWatchers.delete(fn);
      if (!padWatchers.size) stopPadWatch();
    };
  }

  /**
   * The pad buttons the MENU uses, and may not be captured.
   *
   * @returns {Set<number>}
   */
  function reservedPadButtons() {
    const reserved = new Set();
    for (const action of MENU_PAD_ACTIONS) {
      for (const index of inputMap?.padFor?.(action) ?? []) reserved.add(index);
    }
    return reserved;
  }

  /** The pad button the player pressed. */
  function onCapturedPadButton(buttonIndex) {
    if (!padCapturing) return;
    if (reservedPadButtons().has(buttonIndex)) {
      // The menu's own button: it belongs to the menu, and the capture
      // keeps waiting rather than binding something the player did not
      // choose.
      deps.onToast?.(`${padLabel(buttonIndex)} belongs to the menu — press another button`, 'info');
      return;
    }
    const action = padCapturing;
    stopPadCapture();
    const bound = inputMap?.padRebind?.(action, buttonIndex) === true;
    if (bound) {
      persistPadBindings();
      bus?.emit?.(EVENTS.BINDINGS_CHANGED, {
        action,
        button: buttonIndex,
        bindings: inputMap.all?.(),
        padBindings: inputMap.padAll?.(),
      });
      deps.onToast?.(`Bound ${action} to ${padLabel(buttonIndex)}`, 'success');
    }
    deps.onChange?.('input.padBindings', inputMap?.padAll?.());
    refresh();
  }

  /** End the capture machinery. Nothing is bound. */
  function stopPadCapture() {
    padCapturing = null;
    if (padUnwatch) {
      padUnwatch();
      padUnwatch = null;
    }
  }

  /**
   * Start capturing the next pad button press for an action.
   *
   * @param {string} action
   * @returns {boolean} true when the capture started
   */
  function startPadCapture(action) {
    if (!inputMap || typeof inputMap.padFor !== 'function') return false;
    if (!PAD_ACTIONS.includes(action)) return false;
    stopPadCapture();
    padCapturing = action;
    padUnwatch = watchPadButtons(onCapturedPadButton);
    deps.onToast?.('Press a pad button to bind it (Esc cancels)', 'info');
    refresh();
    return true;
  }

  /**
   * Cancel a running pad capture. Nothing is bound.
   *
   * @returns {boolean} true when a capture was cancelled
   */
  function cancelPadCapture() {
    if (!padCapturing) return false;
    stopPadCapture();
    deps.onToast?.('Pad binding cancelled', 'info');
    refresh();
    return true;
  }

  // ---- key capture (rebinding) ------------------------------------------

  function onCapturedKey(e) {
    const code = e?.code ?? e?.key ?? null;
    // ESCAPE CANCELS A CAPTURE.
    // The toast has always promised it ('Esc cancels'), and a capture that
    // cannot be abandoned is a trap: the player is stuck until they press
    // the exact key they meant to bind.
    if (code === 'Escape' && (capturing !== null || padCapturing !== null)) {
      try { e.preventDefault?.(); } catch { /* not a real event */ }
      try { e.stopImmediatePropagation?.(); } catch { /* not a real event */ }
      if (capturing !== null) {
        capturing = null;
        deps.onToast?.('Rebind cancelled', 'info');
      }
      if (padCapturing !== null) stopPadCapture();
      refresh();
      return;
    }
    if (!capturing) return;
    const action = capturing;
    capturing = null;
    // The key must not also trigger a HUD shortcut.
    try { e.preventDefault?.(); } catch { /* not a real event */ }
    try { e.stopImmediatePropagation?.(); } catch { /* not a real event */ }
    if (!code || !inputMap || typeof inputMap.rebind !== 'function') return;
    const bound = inputMap.rebind(action, code);
    if (bound) {
      persistBindings();
      bus?.emit?.(EVENTS.BINDINGS_CHANGED, { action, code, bindings: inputMap.all() });
      deps.onToast?.(`Bound ${action} to ${code}`, 'success');
    }
    deps.onChange?.('input.bindings', inputMap.all());
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('keydown', onCapturedKey);
  }

  // ---- the stored gamepad overrides -------------------------------------

  // The stored pad bindings are applied as soon as the panel exists: the
  // gamepad service reads the pad table every frame, so a rebound button
  // has to be in the table before the first frame is drawn.
  applyStoredPadBindings();

  // Any writer of the setting — this panel, or a boot path that loads it
  // from storage — ends up in the same place: the live pad table.
  const unsubscribeSettings = settings?.onChange?.((key) => {
    if (key === 'input.padBindings') applyStoredPadBindings();
  });

  // ---- rendering --------------------------------------------------------

  /**
   * One settings row.
   *
   * @param {object} row   a row of `buildSettingsModel`
   */
  function renderSettingRow(row) {
    const wrap = make('div', 'sc-setrow');
    wrap.dataset.scSetting = row.key;
    wrap.append(make('span', 'sc-setlabel', row.label));

    if (row.type === 'boolean') {
      // The button IS the read-out: it shows the state and flips it.
      const btn = make('button', 'sc-setbtn', formatSettingValue(row.key, row, row.value));
      btn.type = 'button';
      btn.dataset.scSetToggle = row.key;
      btn.setAttribute('aria-pressed', row.value ? 'true' : 'false');
      wrap.append(registerFocusable(btn));
      return wrap;
    }

    const value = make('span', 'sc-setvalue', formatSettingValue(row.key, row, row.value));
    wrap.append(value);

    if (row.type === 'number') {
      if (row.min !== null && row.max !== null) {
        const range = document.createElement('input');
        range.type = 'range';
        range.className = 'sc-setrange';
        range.min = String(row.min);
        range.max = String(row.max);
        if (row.step !== null) range.step = String(row.step);
        range.value = String(row.value);
        range.setAttribute('aria-label', row.label);
        range.addEventListener('input', () => {
          // The slider is NOT rebuilt while it is being dragged: only the
          // read-out follows the finger.
          const next = Number(range.value);
          value.textContent = formatSettingValue(row.key, row, next);
          writeSetting(row.key, next, { refresh: false });
        });
        wrap.append(registerFocusable(range));
      }
      const minus = make('button', 'sc-setbtn', '−');
      minus.type = 'button';
      minus.dataset.scSetStep = `${row.key}:-1`;
      const plus = make('button', 'sc-setbtn', '+');
      plus.type = 'button';
      plus.dataset.scSetStep = `${row.key}:1`;
      wrap.append(registerFocusable(minus), registerFocusable(plus));
    }
    return wrap;
  }

  /**
   * The settings view: every SCHEMA entry, grouped by section.
   * @param {Element} container
   */
  function renderSettings(container) {
    if (!container) return null;
    lastContainer = container;
    lastView = 'settings';
    bind(container);
    container.replaceChildren();
    const model = buildSettingsModel({ schema: schema(), values: values() });
    for (const group of model.groups) {
      if (group.id === 'input') continue;   // the bindings live in the controls view
      const head = make('div', 'sc-sethead', group.label);
      container.append(head);
      for (const row of group.rows) container.append(renderSettingRow(row));
    }
    container.append(make('div', 'sc-note',
      'Audio and display changes are applied immediately. The settings are stored in this browser.'));
    return model;
  }

  /**
   * The accessibility view: only the accessibility rows.
   * @param {Element} container
   */
  function renderAccessibility(container) {
    if (!container) return null;
    lastContainer = container;
    lastView = 'accessibility';
    bind(container);
    container.replaceChildren();
    const model = buildSettingsModel({ schema: schema(), values: values() });
    const group = model.groups.find((g) => g.id === 'accessibility');
    if (group) {
      container.append(make('div', 'sc-sethead', group.label));
      for (const row of group.rows) container.append(renderSettingRow(row));
    }
    container.append(make('div', 'sc-note',
      'Reduced effects switches the post chain and the shadows off. Reduced shake stops the camera shake. '
      + 'Colour-blind safe indicators add a shape to every coloured read-out. High contrast raises the contrast of the chrome.'));
    return model;
  }

  /**
   * One GAMEPAD row: the action, the button it is bound to, and the button
   * that starts a pad capture.
   *
   * The gamepad rows are their own section, because the pad's actions are
   * not the keyboard's: the stick pans the camera, and there is no key that
   * does that. A row for a key that does not exist would be a lie.
   *
   * @param {string} action
   */
  function renderPadRow(action) {
    const wrap = make('div', 'sc-setrow');
    wrap.dataset.scPadControl = action;
    const [group, name] = String(action).split('.');
    wrap.append(make('span', 'sc-setlabel', `${titleCase(padWords(group))} — ${titleCase(padWords(name ?? action))}`));

    const buttons = inputMap.padFor(action) ?? [];
    const text = buttons.map((index) => padLabel(index)).join(' / ');
    // While the capture is running the read-out says so, so the player knows
    // the row is waiting for a press and not broken.
    const capturingThis = padCapturing === action;
    wrap.append(make('span', 'sc-setvalue', capturingThis ? 'PRESS A BUTTON' : (text || '—')));

    const bind = make('button', 'sc-setbtn', capturingThis ? 'CANCEL' : 'BIND');
    bind.type = 'button';
    bind.dataset.scPadBind = action;
    const reset = make('button', 'sc-setbtn', 'RESET');
    reset.type = 'button';
    reset.dataset.scPadReset = action;
    wrap.append(registerFocusable(bind), registerFocusable(reset));
    return wrap;
  }

  /**
   * The controls view: every bindable action, its keys and the rebind
   * controls.
   * @param {Element} container
   */
  function renderControls(container) {
    if (!container) return null;
    lastContainer = container;
    lastView = 'controls';
    bind(container);
    container.replaceChildren();
    if (!inputMap || typeof inputMap.all !== 'function') {
      container.append(make('div', 'sc-note', 'The key bindings are not available in this build.'));
      return null;
    }

    const model = buildControlsModel({ inputMap });
    const head = make('div', 'sc-sethead', 'Key bindings');
    container.append(head);

    for (const row of model.rows) {
      const wrap = make('div', 'sc-setrow');
      wrap.dataset.scControl = row.action;
      wrap.append(make('span', 'sc-setlabel', `${row.group} — ${row.label}`));
      wrap.append(make('span', 'sc-setvalue', row.keyText || '—'));
      const rebind = make('button', 'sc-setbtn', 'REBIND');
      rebind.type = 'button';
      rebind.dataset.scRebind = row.action;
      const reset = make('button', 'sc-setbtn', 'RESET');
      reset.type = 'button';
      reset.dataset.scResetAction = row.action;
      wrap.append(registerFocusable(rebind), registerFocusable(reset));
      container.append(wrap);
    }

    // The gamepad bindings: their own section, with their own capture.
    if (typeof inputMap.padFor === 'function') {
      container.append(make('div', 'sc-sethead', 'Gamepad bindings'));
      for (const action of PAD_ACTIONS) container.append(renderPadRow(action));
    }

    const resetAll = make('button', 'sc-setbtn sc-setbtn-wide', 'RESET ALL BINDINGS');
    resetAll.type = 'button';
    resetAll.dataset.scResetAll = '1';
    container.append(registerFocusable(resetAll));
    container.append(make('div', 'sc-note',
      'Choose REBIND and press the key you want. Choose BIND under the gamepad bindings and press the pad button. '
      + 'Escape cancels a capture. The bindings are stored in this browser.'));
    return model;
  }

  /**
   * Route a click on a settings / controls control.
   *
   * @param {Event} e
   * @returns {boolean} true when the click was handled
   */
  function onClick(e) {
    const target = e?.target;
    // `closest` is the only DOM method this uses, and a target that has
    // none (the window, for instance) is simply not a control.
    if (!target || typeof target.closest !== 'function') return false;

    const toggle = target.closest('[data-sc-set-toggle]');
    if (toggle) {
      const key = toggle.dataset.scSetToggle;
      const current = settings?.get?.(key);
      writeSetting(key, !current);
      return true;
    }

    const step = target.closest('[data-sc-set-step]');
    if (step) {
      const [key, sign] = String(step.dataset.scSetStep).split(':');
      const def = schema()[key];
      if (!def || def.type !== 'number') return false;
      const stepSize = Number.isFinite(def.step) && def.step > 0 ? def.step : 0.1;
      const current = Number(settings?.get?.(key) ?? def.default);
      const next = current + (Number(sign) * stepSize);
      writeSetting(key, next);
      return true;
    }

    const rebind = target.closest('[data-sc-rebind]');
    if (rebind) {
      // One capture at a time: a key capture and a pad capture cannot both
      // own the next press.
      if (padCapturing !== null) stopPadCapture();
      capturing = rebind.dataset.scRebind;
      deps.onToast?.('Press a key to bind it (Esc cancels)', 'info');
      return true;
    }

    const padBind = target.closest('[data-sc-pad-bind]');
    if (padBind) {
      const action = padBind.dataset.scPadBind;
      // The same button starts and stops a capture: a player who starts a
      // capture by mistake can undo it without reaching for the keyboard.
      if (padCapturing === action) {
        cancelPadCapture();
        return true;
      }
      if (capturing !== null) capturing = null;
      startPadCapture(action);
      return true;
    }

    const padReset = target.closest('[data-sc-pad-reset]');
    if (padReset) {
      const action = padReset.dataset.scPadReset;
      if (inputMap?.resetPadAction?.(action)) {
        persistPadBindings();
        bus?.emit?.(EVENTS.BINDINGS_CHANGED, {
          action, bindings: inputMap.all?.(), padBindings: inputMap.padAll?.(),
        });
        deps.onChange?.('input.padBindings', inputMap.padAll?.());
      }
      return true;
    }

    const resetAction = target.closest('[data-sc-reset-action]');
    if (resetAction) {
      const action = resetAction.dataset.scResetAction;
      if (inputMap?.resetAction?.(action)) {
        persistBindings();
        bus?.emit?.(EVENTS.BINDINGS_CHANGED, { action, bindings: inputMap.all() });
        deps.onChange?.('input.bindings', inputMap.all());
      }
      return true;
    }

    const resetAll = target.closest('[data-sc-reset-all]');
    if (resetAll) {
      // `resetAll` restores BOTH tables: the keyboard bindings and the
      // gamepad bindings are one player's controls.
      inputMap?.resetAll?.();
      persistBindings();
      persistPadBindings();
      bus?.emit?.(EVENTS.BINDINGS_CHANGED, {
        action: null, bindings: inputMap.all(), padBindings: inputMap.padAll?.(),
      });
      deps.onChange?.('input.bindings', inputMap.all());
      deps.onChange?.('input.padBindings', inputMap.padAll?.());
      return true;
    }

    return false;
  }

  return {
    /** Render one of the views into a container. */
    render: renderView,
    renderSettings,
    renderAccessibility,
    renderControls,
    /**
     * Hand over the menu's focus registrar.
     *
     * The rows this panel builds join the menu's focus ring, so they can be
     * reached with the keyboard and with a gamepad.
     *
     * @param {Function|null} fn (node) => node
     */
    setFocusRegistrar(fn) {
      focusRegistrar = typeof fn === 'function' ? fn : null;
      return true;
    },
    /** Handle a click on a settings control. */
    onClick,
    /** Write one setting and apply its effects. */
    writeSetting,
    /** Persist the current bindings. */
    persistBindings,
    /** Persist the current gamepad bindings. */
    persistPadBindings,
    /**
     * Watch the pad for button presses.
     *
     * The panel reads the pad through the browser's Gamepad API, and ONLY
     * while a watcher is registered — a panel that polled the pad forever
     * would be a panel that never slept.
     *
     * @param {Function} fn (buttonIndex) => void
     * @returns {Function} an unsubscribe function
     */
    watchPadButtons,
    /**
     * Read the pad once and report the buttons that went down.
     *
     * This is the same read the poll timer does; it is exposed so a host
     * that drives its own loop — or a test — can step the capture by hand.
     *
     * @returns {number[]} the button indices that were pressed
     */
    pollPadButtons,
    /** Apply the current settings to the audio mixer, renderer and stylesheet. */
    applyUiEffects() { return applyUiEffects(ctx); },
    /**
     * True while a capture is running — a key capture or a pad capture.
     *
     * The gamepad service reads this: while a capture runs, the camera's
     * analogue axes are released and the pad's own game actions are held
     * back, so a stick that is being used to reach the screen cannot also
     * move the city.
     */
    isCapturing() { return capturing !== null || padCapturing !== null; },
    /** The action being rebound, or null. */
    capturing() { return capturing; },
    /** The action whose next pad button press is being captured, or null. */
    padCapturing() { return padCapturing; },
    /** Cancel a pending capture. */
    cancelCapture() {
      capturing = null;
      if (padCapturing !== null) {
        stopPadCapture();
        refresh();
      }
    },
    dispose() {
      capturing = null;
      stopPadCapture();
      unsubscribeSettings?.();
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('keydown', onCapturedKey);
      }
    },
  };
}
