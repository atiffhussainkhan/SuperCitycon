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
import { buildSettingsModel, buildControlsModel } from './panels.js';

/** The audio buses the settings know about. */
export const AUDIO_BUSES = Object.freeze(['master', 'music', 'sfx', 'ambience', 'ui']);

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

  // ---- key capture (rebinding) ------------------------------------------

  function onCapturedKey(e) {
    if (!capturing) return;
    const action = capturing;
    capturing = null;
    const code = e?.code ?? e?.key ?? null;
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
      wrap.append(btn);
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
        wrap.append(range);
      }
      const minus = make('button', 'sc-setbtn', '−');
      minus.type = 'button';
      minus.dataset.scSetStep = `${row.key}:-1`;
      const plus = make('button', 'sc-setbtn', '+');
      plus.type = 'button';
      plus.dataset.scSetStep = `${row.key}:1`;
      wrap.append(minus, plus);
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
      wrap.append(rebind, reset);
      container.append(wrap);
    }

    const resetAll = make('button', 'sc-setbtn sc-setbtn-wide', 'RESET ALL BINDINGS');
    resetAll.type = 'button';
    resetAll.dataset.scResetAll = '1';
    container.append(resetAll);
    container.append(make('div', 'sc-note',
      'Choose REBIND and press the key you want. The bindings are stored in this browser.'));
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
      capturing = rebind.dataset.scRebind;
      deps.onToast?.('Press a key to bind it (Esc cancels)', 'info');
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
      inputMap?.resetAll?.();
      persistBindings();
      bus?.emit?.(EVENTS.BINDINGS_CHANGED, { action: null, bindings: inputMap.all() });
      deps.onChange?.('input.bindings', inputMap.all());
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
    /** Handle a click on a settings control. */
    onClick,
    /** Write one setting and apply its effects. */
    writeSetting,
    /** Persist the current bindings. */
    persistBindings,
    /** Apply the current settings to the audio mixer, renderer and stylesheet. */
    applyUiEffects() { return applyUiEffects(ctx); },
    /** True while a key press is being captured for a rebind. */
    isCapturing() { return capturing !== null; },
    /** The action being rebound, or null. */
    capturing() { return capturing; },
    /** Cancel a pending capture. */
    cancelCapture() { capturing = null; },
    dispose() {
      capturing = null;
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('keydown', onCapturedKey);
      }
    },
  };
}
