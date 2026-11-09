/**
 * ui/menu.js — the main menu, the pause overlay and the level select.
 *
 * OWNER: UX (BOT-09).
 *
 * WHAT THIS IS
 *   A full-screen overlay with a real keyboard scheme (arrows / Enter /
 *   Escape), a visible focus ring and honest content:
 *
 *     New Game      starts a fresh city through CORE's mode registry
 *     Continue      lists the real saves (CORE's `listSaves()`)
 *     Level Select  authored maps, modes and the published chapter track
 *     Settings      every row of the settings SCHEMA
 *     Controls      every bindable action of the input map
 *     Accessibility the accessibility rows of the SCHEMA
 *     Credits       the real asset packs and their real licences
 *     Exit          an honest exit: a web page cannot close its own tab
 *
 * THE HONESTY RULES
 *   - Nothing is invented. The saves come from CORE, the modes come from
 *     CORE's registry, the stages come from `core/stage.js`, the settings
 *     come from the settings SCHEMA and the keys from the input map.
 *   - The exit page says plainly that a browser tab cannot be closed by the
 *     page, and offers the two things that DO work: copy the link, or go
 *     back to the city.
 *   - The credits list the packs that ship. The 2D interface art is NOT
 *     listed, because it does NOT ship (its licence clearance is
 *     unresolved).
 *
 * THE PURE PART
 *   The model builders at the top of this file touch no DOM, so they are
 *   unit-tested in Node without a browser.
 */

import { MODES, MODE_LABELS } from '../core/config.js';
import { STAGES } from '../core/stage.js';
import { EVENTS } from '../core/events.js';
import { createLogger } from '../core/log.js';
import { buildCreditsModel } from './panels.js';
import { ensureStyles } from './styles.js';

export { buildCreditsModel };

/** The main menu's items, in the order they are shown. */
export const MENU_ITEMS = Object.freeze([
  Object.freeze({ id: 'new-game', label: 'New Game' }),
  Object.freeze({ id: 'continue', label: 'Continue' }),
  Object.freeze({ id: 'level-select', label: 'Level Select' }),
  Object.freeze({ id: 'settings', label: 'Settings' }),
  Object.freeze({ id: 'controls', label: 'Controls' }),
  Object.freeze({ id: 'accessibility', label: 'Accessibility' }),
  Object.freeze({ id: 'credits', label: 'Credits' }),
  Object.freeze({ id: 'exit', label: 'Exit' }),
]);

/** The pause overlay's items. */
export const PAUSE_ITEMS = Object.freeze([
  Object.freeze({ id: 'resume', label: 'Resume' }),
  Object.freeze({ id: 'restart', label: 'Restart' }),
  Object.freeze({ id: 'settings', label: 'Settings' }),
  Object.freeze({ id: 'return-to-menu', label: 'Return to Menu' }),
]);

/**
 * The main menu model.
 *
 * @param {{saves?:Array, modes?:Array, items?:ReadonlyArray}} opts
 * @returns {{items:Array, saveCount:number, modeCount:number}}
 */
export function buildMenuModel({ saves = [], modes = [], items = MENU_ITEMS } = {}) {
  const saveList = Array.isArray(saves) ? saves : [];
  const modeList = Array.isArray(modes) ? modes : [];
  const rows = (Array.isArray(items) ? items : MENU_ITEMS).map((item) => {
    const enabled = item.id === 'continue' ? saveList.length > 0 : true;
    let hint = '';
    if (item.id === 'continue') {
      hint = saveList.length ? `${saveList.length} save${saveList.length === 1 ? '' : 's'}` : 'No saves yet';
    } else if (item.id === 'level-select') {
      hint = modeList.length ? `${modeList.length} mode${modeList.length === 1 ? '' : 's'}` : 'No modes published';
    } else if (item.id === 'exit') {
      hint = 'A web page cannot close its own tab';
    }
    return { id: item.id, label: item.label, hint, enabled };
  });
  return { items: rows, saveCount: saveList.length, modeCount: modeList.length };
}

/**
 * The save list model.
 *
 * @param {Array} saves the raw list from CORE
 * @returns {Array<{slot:string,name:string,date:string,stage:string|null,corrupt:boolean}>}
 */
export function buildSavesModel(saves) {
  const list = Array.isArray(saves) ? saves : [];
  const rows = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const slot = String(entry.slot ?? '');
    if (!slot) continue;
    rows.push({
      slot,
      name: String(entry.name ?? ''),
      date: String(entry.date ?? ''),
      stage: entry.stage ?? null,
      corrupt: entry.corrupt === true,
    });
  }
  return rows;
}

/**
 * The level-select model: authored maps and modes, plus the chapter track.
 *
 * The modes are selectable. The STAGES are the published chapter track —
 * they are listed with their goals, but CORE publishes no entry point that
 * starts a session at a chosen stage, so they are marked informational
 * instead of pretending to be a button that works.
 *
 * @param {{modes?:Array<string>, levels?:Array, stages?:Array}} opts
 */
export function buildLevelSelectModel({ modes = [], levels = [], stages = STAGES } = {}) {
  const modeList = Array.isArray(modes) ? modes : [];
  const levelList = Array.isArray(levels) ? levels : [];
  const stageList = Array.isArray(stages) ? stages : [];
  return {
    levels: levelList.map(({ id, name, description, difficulty }) => ({ id, name, description, difficulty })),
    modes: modeList.map((id) => ({
      id: String(id),
      label: MODE_LABELS[id] ?? String(id),
      selectable: true,
    })),
    stages: stageList.map((stage, index) => ({
      id: String(stage?.id ?? `stage-${index + 1}`),
      name: String(stage?.name ?? `Stage ${index + 1}`),
      description: String(stage?.description ?? stage?.desc ?? ''),
      order: Number.isFinite(stage?.order) ? stage.order : index + 1,
      goals: (Array.isArray(stage?.goals) ? stage.goals : []).map((g) => ({
        label: String(g?.label ?? ''),
        target: g?.target ?? null,
        unit: String(g?.unit ?? ''),
      })),
      // CORE has no "start at stage N" entry point, so a stage is not a
      // button that pretends to work.
      selectable: false,
    })),
  };
}

/**
 * Create the menu service.
 *
 * @param {object} ctx
 * @param {object} [deps]
 * @param {object} [deps.settingsPanel] the settings/controls panel service
 * @param {Function} [deps.onToast]     (message, kind)
 * @param {Function} [deps.onPause]     (paused:boolean)
 * @param {Function} [deps.onChange]    (view:string)
 * @returns {object} the menu service
 */
export function createMenu(ctx, deps = {}) {
  const logger = deps.logger ?? ctx?.logger ?? createLogger({ category: 'ui/menu', console: false });
  const settingsPanel = deps.settingsPanel ?? null;
  const bus = ctx?.bus ?? null;
  const state = ctx?.state ?? null;

  let container = null;
  let root = null;
  let view = null;
  let viewStack = [];
  let focusables = [];
  let focusIndex = -1;
  let pausedByMenu = false;
  let pendingLevel = null;
  let loadingLevel = false;
  /** The gamepad hint shown in the footer, or null when no pad is connected. */
  let padHint = null;
  /**
   * The event that OPENED the menu.
   *
   * That key press must not also act on the menu: Space opens the pause
   * overlay and would otherwise press "Resume" in it straight away.
   */
  let openingEvent = null;

  // ---- DOM helpers -------------------------------------------------------

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  /**
   * A menu button. It is a real `<button>`, so it is reachable with Tab
   * and announced by a screen reader.
   */
  function menuButton(label, { className = 'sc-menu-btn', data = {}, onClick: handler } = {}) {
    const btn = make('button', className, label);
    btn.type = 'button';
    for (const [key, value] of Object.entries(data)) btn.dataset[key] = value;
    if (typeof handler === 'function') btn.addEventListener('click', handler);
    return btn;
  }

  function focusable(node) {
    focusables.push(node);
    // The browser moves the focus when the player clicks a button, so the
    // keyboard follows the mouse instead of fighting it.
    node.addEventListener?.('focus', () => {
      const index = focusables.indexOf(node);
      if (index >= 0) {
        focusIndex = index;
        for (const other of focusables) other.classList?.remove?.('is-focused');
        node.classList?.add?.('is-focused');
      }
    });
    return node;
  }

  /**
   * Is a node still part of the menu?
   *
   * A view can be re-rendered while it is open — the settings panel rebuilds
   * its rows after every write — and the rows that were on screen a moment
   * ago are then detached from the document. A focus ring that still points
   * at one of them is pointing at nothing: the player presses Enter and
   * nothing happens, with no way to see why.
   *
   * The test is a walk up the parent chain to the menu root, which works in
   * the browser and in the test DOM shim alike.
   *
   * @param {object} node
   * @returns {boolean}
   */
  function isAttached(node) {
    if (!node) return false;
    let current = node;
    while (current) {
      if (current === root) return true;
      current = current.parentNode ?? null;
    }
    return false;
  }

  /**
   * Drop the focusables that are no longer on screen.
   *
   * When the focused control is one of the dropped ones, the ring moves to
   * the last control that is still there and shows itself there — the focus
   * is never left pointing at nothing.
   *
   * @returns {number} how many were dropped
   */
  function pruneFocusables() {
    const before = focusables.length;
    focusables = focusables.filter((node) => isAttached(node));
    if (focusables.length === before) return 0;
    if (focusIndex >= focusables.length) {
      focusIndex = Math.max(0, focusables.length - 1);
    }
    // The ring is re-applied, so the focus always shows where it is.
    const el = focusables[focusIndex];
    if (el) {
      for (const other of focusables) other.classList?.remove?.('is-focused');
      el.classList?.add?.('is-focused');
      if (typeof el.focus === 'function') {
        try { el.focus(); } catch { /* the fake DOM has no focus */ }
      }
    }
    return before - focusables.length;
  }

  // ---- the CORE-backed actions ------------------------------------------

  /** The saves CORE knows about. */
  function listSaves() {
    const save = ctx?.core?.save;
    if (!save || typeof save.listSaves !== 'function') return [];
    try {
      return save.listSaves() ?? [];
    } catch (err) {
      logger.exception(err, { where: 'listSaves' });
      return [];
    }
  }

  /** The modes CORE offers. */
  function availableModes() {
    const modes = ctx?.core?.modes;
    if (!modes || typeof modes.availableModes !== 'function') return [];
    try {
      return modes.availableModes() ?? [];
    } catch (err) {
      logger.exception(err, { where: 'availableModes' });
      return [];
    }
  }

  /** The mode the session is in, or the first one CORE offers. */
  function currentMode() {
    const active = state?.meta?.mode;
    if (active && Object.prototype.hasOwnProperty.call(MODES, active)) return active;
    const offered = availableModes();
    if (offered.length) return offered[0];
    return MODES.play;
  }

  /** Start a fresh city through CORE's mode registry. */
  function startNewGame() {
    const modes = ctx?.core?.modes;
    if (!modes || typeof modes.startMode !== 'function') {
      deps.onToast?.('The mode registry is not available yet', 'warn');
      return false;
    }
    const mode = currentMode();
    let ok = false;
    try {
      ok = modes.startMode(mode, { fresh: true }) !== false;
    } catch (err) {
      logger.exception(err, { where: 'startMode', mode });
      ok = false;
    }
    if (!ok) {
      deps.onToast?.('That mode could not be started', 'error');
      return false;
    }
    deps.onToast?.('A new city is ready', 'success');
    close();
    return true;
  }

  /** Load a save slot through CORE. */
  function loadSave(slot) {
    const save = ctx?.core?.save;
    if (!save || typeof save.loadFromStorage !== 'function') {
      deps.onToast?.('The save system is not available yet', 'warn');
      return false;
    }
    let loaded = null;
    try {
      loaded = save.loadFromStorage(slot);
    } catch (err) {
      logger.exception(err, { where: 'loadFromStorage', slot });
      deps.onToast?.('That save could not be read', 'error');
      return false;
    }
    if (!loaded) {
      deps.onToast?.(`There is no save in slot "${slot}"`, 'warn');
      return false;
    }
    deps.onToast?.(`Loaded "${slot}"`, 'success');
    close();
    return true;
  }

  /** Switch into one of CORE's modes. */
  function startMode(mode) {
    const modes = ctx?.core?.modes;
    if (!modes || typeof modes.startMode !== 'function') {
      deps.onToast?.('The mode registry is not available yet', 'warn');
      return false;
    }
    let ok = false;
    try {
      ok = modes.startMode(mode) !== false;
    } catch (err) {
      logger.exception(err, { where: 'startMode', mode });
      ok = false;
    }
    if (!ok) {
      deps.onToast?.(`"${MODE_LABELS[mode] ?? mode}" could not be started`, 'error');
      return false;
    }
    deps.onToast?.(`${MODE_LABELS[mode] ?? mode} started`, 'success');
    close();
    return true;
  }

  async function startLevel() {
    const content = ctx?.domains?.content;
    const level = pendingLevel;
    if (!level || loadingLevel || !content?.apply) return;
    loadingLevel = true;
    render();
    try {
      const result = await content.apply(level.id);
      if (!result?.ok) {
        deps.onToast?.(result?.reason ?? `${level.name} could not be started`, 'error');
        return;
      }
      const skipped = result.skipped?.length ?? 0;
      if (skipped) {
        deps.onToast?.(`${level.name} loaded with ${skipped} skipped placements`, 'warn');
      } else {
        deps.onToast?.(`${level.name} is ready`, 'success');
      }
      close();
    } catch (err) {
      logger.exception(err, { where: 'startLevel', level: level.id });
      deps.onToast?.(`${level.name} could not be started`, 'error');
    } finally {
      loadingLevel = false;
      if (view === 'level-confirm') render();
    }
  }

  /** Copy the page address, so the player can come back to the city later. */
  function copyLink() {
    const url = (typeof location !== 'undefined' && location.href) ? location.href : '';
    if (!url) {
      deps.onToast?.('There is no address to copy', 'warn');
      return false;
    }
    const clip = (typeof navigator !== 'undefined') ? navigator.clipboard : null;
    if (clip && typeof clip.writeText === 'function') {
      try {
        const result = clip.writeText(url);
        if (result && typeof result.then === 'function') {
          result.then(
            () => deps.onToast?.('The link was copied', 'success'),
            () => deps.onToast?.(`The link could not be copied — it is ${url}`, 'warn'),
          );
          return true;
        }
        deps.onToast?.('The link was copied', 'success');
        return true;
      } catch {
        /* fall through to the honest message */
      }
    }
    deps.onToast?.(`The link could not be copied — it is ${url}`, 'warn');
    return false;
  }

  // ---- the views ---------------------------------------------------------

  function activate(id) {
    switch (id) {
      case 'new-game': return startNewGame();
      case 'continue': return openView('continue');
      case 'level-select': return openView('levels');
      case 'settings': return openView('settings');
      case 'controls': return openView('controls');
      case 'accessibility': return openView('accessibility');
      case 'credits': return openView('credits');
      case 'exit': return openView('exit');
      case 'resume': return close();
      case 'restart': return startNewGame();
      case 'return-to-menu': return openView('main', { push: false });
      default: return false;
    }
  }

  function renderMain(body) {
    const model = buildMenuModel({ saves: listSaves(), modes: availableModes() });
    const list = make('div', 'sc-menu-list');
    for (const item of model.items) {
      const label = item.hint ? `${item.label} — ${item.hint}` : item.label;
      const btn = menuButton(label, {
        data: { scMenuItem: item.id },
        onClick: () => activate(item.id),
      });
      if (!item.enabled) {
        btn.disabled = true;
        btn.classList.add('is-disabled');
      }
      list.append(focusable(btn));
    }
    body.append(list);
    return model;
  }

  function renderPause(body) {
    const list = make('div', 'sc-menu-list');
    for (const item of PAUSE_ITEMS) {
      const btn = menuButton(item.label, {
        data: { scMenuItem: item.id },
        onClick: () => activate(item.id),
      });
      list.append(focusable(btn));
    }
    body.append(list);
    return { items: PAUSE_ITEMS.map((i) => ({ ...i })) };
  }

  function renderContinue(body) {
    const saves = buildSavesModel(listSaves());
    if (!saves.length) {
      body.append(make('div', 'sc-note', 'There are no saves in this browser yet. Save a city with Ctrl+S first.'));
      return saves;
    }
    const list = make('div', 'sc-menu-list');
    for (const save of saves) {
      const when = save.date ? ` — ${save.date}` : '';
      const label = save.corrupt ? `${save.slot} (unreadable)${when}` : `${save.name || 'Save'} — ${save.slot}${when}`;
      const btn = menuButton(label, {
        data: { scMenuSave: save.slot },
        onClick: () => loadSave(save.slot),
      });
      list.append(focusable(btn));
    }
    body.append(list);
    body.append(make('div', 'sc-note', 'The saves live in this browser\'s local storage.'));
    return saves;
  }

  function renderLevels(body) {
    const content = ctx?.domains?.content;
    const levels = content?.apply ? content.forMode?.(currentMode()) ?? content.levels?.() : [];
    const model = buildLevelSelectModel({ modes: availableModes(), levels, stages: STAGES });

    if (model.levels.length) {
      body.append(make('div', 'sc-sethead', 'Authored maps'));
      const list = make('div', 'sc-menu-list');
      for (const level of model.levels) {
        const row = make('div', 'sc-menu-card');
        row.append(focusable(menuButton(level.name, {
          data: { scMenuLevel: level.id },
          onClick: () => {
            pendingLevel = level;
            openView('level-confirm');
          },
        })));
        if (level.description) row.append(make('div', 'sc-note', level.description));
        list.append(row);
      }
      body.append(list);
    }

    const activeLevel = content?.activeLevel?.();
    if (activeLevel) {
      body.append(make('div', 'sc-sethead', `${activeLevel.name} objectives`));
      const { objectives } = content.evaluateObjectives();
      for (const objective of objectives) {
        const status = objective.met ? 'Complete' : `${Math.floor(objective.current)} / ${objective.target}`;
        body.append(make('div', 'sc-note', `${objective.label} · ${status}`));
      }
      body.append(make('div', 'sc-note', 'Select Inspect and click a landmark cell to claim it.'));
      for (const checkpoint of content.checkpointStatus()) {
        const status = checkpoint.reached ? 'Reached' : `cell ${checkpoint.x}, ${checkpoint.z}`;
        body.append(make('div', 'sc-note', `${checkpoint.label} · ${status}`));
      }
      for (const collectible of content.collectibleStatus()) {
        const status = collectible.found ? 'Found' : `cell ${collectible.x}, ${collectible.z}`;
        body.append(make('div', 'sc-note', `${collectible.label} · ${status}`));
      }
    }

    body.append(make('div', 'sc-sethead', 'Modes'));
    if (!model.modes.length) {
      body.append(make('div', 'sc-note', 'The mode registry is not available yet.'));
    } else {
      const list = make('div', 'sc-menu-list');
      for (const mode of model.modes) {
        const btn = menuButton(mode.label, {
          data: { scMenuMode: mode.id },
          onClick: () => startMode(mode.id),
        });
        list.append(focusable(btn));
      }
      body.append(list);
    }

    body.append(make('div', 'sc-sethead', 'Chapters'));
    const stageList = make('div', 'sc-menu-list');
    for (const stage of model.stages) {
      const row = make('div', 'sc-menu-card');
      row.dataset.scStage = stage.id;
      row.append(make('div', 'sc-menu-cardtitle', stage.name));
      if (stage.description) row.append(make('div', 'sc-note', stage.description));
      for (const goal of stage.goals) {
        row.append(make('div', 'sc-note', `• ${goal.label}${Number.isFinite(goal.target) ? ` (${goal.target} ${goal.unit})` : ''}`));
      }
      stageList.append(row);
    }
    body.append(stageList);
    body.append(make('div', 'sc-note',
      'The chapters are the published progression track. CORE publishes no entry point that starts a session at a chosen chapter, so they are listed for reference.'));
    return model;
  }

  function renderLevelConfirm(body) {
    if (!pendingLevel) return;
    if (loadingLevel) {
      const status = make('div', 'sc-note', `Loading ${pendingLevel.name}…`);
      status.setAttribute('role', 'status');
      body.append(status);
      return;
    }
    body.append(make('div', 'sc-note', `Starting ${pendingLevel.name} replaces the current city. Saved slots are kept.`));
    body.append(focusable(menuButton(`Start ${pendingLevel.name}`, {
      data: { scMenuStartLevel: pendingLevel.id },
      onClick: () => startLevel(),
    })));
  }

  function renderCredits(body) {
    const model = buildCreditsModel();
    const list = make('div', 'sc-menu-list');
    for (const pack of model.packs) {
      const row = make('div', 'sc-menu-card');
      row.dataset.scCredit = pack.id;
      row.append(make('div', 'sc-menu-cardtitle', pack.display));
      row.append(make('div', 'sc-note', `${pack.author} — ${pack.licence}`));
      for (const file of pack.licenceFiles) {
        row.append(make('div', 'sc-note', `Licence: ${file}`));
      }
      list.append(row);
    }
    body.append(list);
    const notes = make('div', 'sc-menu-list');
    for (const note of model.notes) {
      notes.append(make('div', 'sc-note', note));
    }
    body.append(notes);
    return model;
  }

  function renderExit(body) {
    body.append(make('div', 'sc-note',
      'A web page cannot close its own tab — the browser owns the tab, not the game. '
      + 'Two things do work: copy the address to come back to this city later, or go back to the city.'));
    const list = make('div', 'sc-menu-list');
    list.append(focusable(menuButton('Copy the link', {
      data: { scMenuItem: 'copy-link' },
      onClick: () => copyLink(),
    })));
    list.append(focusable(menuButton('Back to the city', {
      data: { scMenuItem: 'back-to-city' },
      onClick: () => close(),
    })));
    body.append(list);
    return { canCloseTab: false };
  }

  function renderSettingsView(body, which) {
    if (!settingsPanel) {
      body.append(make('div', 'sc-note', 'The settings are not available in this build.'));
      return null;
    }
    // The panel builds its own rows, so it needs the menu's focus registrar
    // to put them on the focus ring.
    settingsPanel.setFocusRegistrar?.(focusable);
    return settingsPanel.render(body, which);
  }

  // ---- rendering the overlay --------------------------------------------

  const VIEW_TITLES = {
    main: 'SUPERCITYCON',
    pause: 'PAUSED',
    continue: 'CONTINUE',
    levels: 'LEVEL SELECT',
    'level-confirm': 'START LEVEL',
    settings: 'SETTINGS',
    controls: 'CONTROLS',
    accessibility: 'ACCESSIBILITY',
    credits: 'CREDITS',
    exit: 'EXIT',
  };

  function render() {
    if (!root) return;
    root.replaceChildren();
    focusables = [];
    focusIndex = -1;

    const card = make('div', 'sc-menu-card-main');
    const head = make('div', 'sc-menu-head');
    head.append(make('h1', 'sc-menu-title', VIEW_TITLES[view] ?? 'SUPERCITYCON'));
    if (view !== 'main' && view !== 'pause' && !loadingLevel) {
      const backBtn = menuButton('BACK', {
        className: 'sc-menu-btn sc-menu-back',
        data: { scMenuBack: '1' },
        onClick: () => back(),
      });
      head.append(focusable(backBtn));
    }
    card.append(head);

    const body = make('div', 'sc-menu-body');
    card.append(body);

    if (view === 'main') renderMain(body);
    else if (view === 'pause') renderPause(body);
    else if (view === 'continue') renderContinue(body);
    else if (view === 'levels') renderLevels(body);
    else if (view === 'level-confirm') renderLevelConfirm(body);
    else if (view === 'credits') renderCredits(body);
    else if (view === 'exit') renderExit(body);
    else if (view === 'settings') renderSettingsView(body, 'settings');
    else if (view === 'controls') renderSettingsView(body, 'controls');
    else if (view === 'accessibility') renderSettingsView(body, 'accessibility');

    const foot = make('div', 'sc-menu-foot',
      '↑ ↓ move  ·  Enter select  ·  Esc back');
    if (padHint) foot.append(make('span', 'sc-menu-padhint', `  ·  ${padHint}`));
    card.append(foot);

    root.append(card);
    setFocus(0);
  }

  // ---- focus -------------------------------------------------------------

  function setFocus(index) {
    // The ring is rebuilt against the DOM, so a control that was replaced
    // while the menu was open is never the focus target.
    pruneFocusables();
    if (!focusables.length) {
      focusIndex = -1;
      return null;
    }
    focusIndex = ((index % focusables.length) + focusables.length) % focusables.length;
    const el = focusables[focusIndex];
    if (!el) return null;
    for (const other of focusables) other.classList?.remove?.('is-focused');
    el.classList?.add?.('is-focused');
    if (typeof el.focus === 'function') {
      try { el.focus(); } catch { /* the fake DOM has no focus */ }
    }
    return el;
  }

  /**
   * Nudge the focused control sideways, if it is a control that can be nudged.
   *
   * A range slider takes the LEFT / RIGHT press for itself: that is what a
   * player expects from a slider, and it is the only way to change a setting
   * with a pad without a mouse.
   *
   * @param {number} delta -1 for left, +1 for right
   * @returns {boolean} true when the control was adjusted
   */
  function adjustFocused(delta) {
    pruneFocusables();
    const el = focusables[focusIndex];
    if (!el) return false;
    const tag = String(el.tagName ?? '').toUpperCase();
    if (tag !== 'INPUT') return false;
    if (String(el.type ?? '').toLowerCase() !== 'range') return false;
    const min = Number.isFinite(Number(el.min)) ? Number(el.min) : 0;
    const max = Number.isFinite(Number(el.max)) ? Number(el.max) : 1;
    const step = Number.isFinite(Number(el.step)) && Number(el.step) > 0 ? Number(el.step) : 0.1;
    const current = Number(el.value);
    const base = Number.isFinite(current) ? current : min;
    const next = Math.min(max, Math.max(min, base + delta * step));
    if (next === base) return false;
    el.value = String(next);
    const event = (typeof Event === 'function')
      ? new Event('input', { bubbles: true })
      : { type: 'input', target: el };
    try { el.dispatchEvent?.(event); } catch { /* the fake DOM has no events */ }
    return true;
  }

  /**
   * Activate the focused control.
   *
   * @returns {boolean} true when something was activated
   */
  function confirmFocused() {
    if (!view) return false;
    pruneFocusables();
    const el = focusables[focusIndex];
    if (!el) return false;
    if (typeof el.click === 'function') {
      el.click();
      return true;
    }
    return false;
  }

  // ---- input -------------------------------------------------------------

  function onKeyDown(e) {
    if (!view || loadingLevel) return;
    // The key press that opened the menu must not act on it.
    if (e && e === openingEvent) { openingEvent = null; return; }
    openingEvent = null;
    // A rebind capture owns the key press.
    if (settingsPanel?.isCapturing?.()) return;

    const key = e?.key;
    if (key === 'ArrowDown' || key === 'ArrowRight') {
      e.preventDefault?.();
      setFocus(focusIndex + 1);
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowLeft') {
      e.preventDefault?.();
      setFocus(focusIndex - 1);
      return;
    }
    if (key === 'Home') {
      e.preventDefault?.();
      setFocus(0);
      return;
    }
    if (key === 'End') {
      e.preventDefault?.();
      setFocus(focusables.length - 1);
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      // The button the key press landed on wins; the tracked focus is the
      // fallback for a key press that came from outside the overlay.
      const target = e?.target;
      const el = (target && focusables.includes(target)) ? target : focusables[focusIndex];
      if (!el) return;
      // The native activation is prevented, so the action runs exactly once.
      e.preventDefault?.();
      if (typeof el.click === 'function') el.click();
      return;
    }
    if (key === 'Escape' || key === 'Esc') {
      e.preventDefault?.();
      back();
    }
  }

  /** Go one step back: a sub-view returns to the view it came from. */
  function back() {
    if (viewStack.length) {
      view = viewStack.pop();
      render();
      bus?.emit?.(EVENTS.MENU_OPENED, { view });
      deps.onChange?.(view);
      return true;
    }
    return close();
  }

  const onWindowKey = (e) => {
    if (!view) return;
    const t = e?.target;
    // When nothing is focused the target is the WINDOW, which is not a Node
    // — `contains()` would throw on it and silence every shortcut.
    const isNode = !!t && typeof t.nodeType === 'number';
    if (isNode && root?.contains?.(t)) return;   // the root's own handler ran already
    onKeyDown(e);
  };

  // ---- the public surface ------------------------------------------------

  function ensureRoot() {
    if (root) return root;
    if (typeof document === 'undefined') return null;
    ensureStyles(document);
    root = make('div', 'sc-menu');
    root.setAttribute('data-sc-menu', '1');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'SuperCitycon menu');
    root.hidden = true;
    // Every button carries its own click handler and the settings panel
    // binds its own controls, so the overlay only needs the key handler.
    root.addEventListener('keydown', onKeyDown);
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', onWindowKey);
    }
    if (container) container.append(root);
    else if (document.body) document.body.append(root);
    return root;
  }

  /**
   * Open the menu.
   *
   * @param {string} [which] 'main' (default) or 'pause'
   * @param {{event?:object}} [opts] the event that opened the menu — it
   *   must not also act on it.
   */
  function open(which = 'main', { event = null } = {}) {
    const el = ensureRoot();
    if (!el) return false;
    view = which;
    viewStack = [];
    el.hidden = false;
    openingEvent = event;
    if (!pausedByMenu) {
      pausedByMenu = true;
      deps.onPause?.(true);
    }
    render();
    bus?.emit?.(EVENTS.MENU_OPENED, { view: which });
    deps.onChange?.(which);
    return true;
  }

  /** Switch to another view of the open menu. */
  function openView(which, { push = true } = {}) {
    if (!view) return open(which);
    if (push) viewStack.push(view);
    view = which;
    render();
    bus?.emit?.(EVENTS.MENU_OPENED, { view: which });
    deps.onChange?.(which);
    return true;
  }

  /** Close the menu. */
  function close() {
    if (!view) return false;
    const was = view;
    view = null;
    viewStack = [];
    if (root) {
      root.hidden = true;
      root.replaceChildren();
    }
    focusables = [];
    focusIndex = -1;
    if (pausedByMenu) {
      pausedByMenu = false;
      deps.onPause?.(false);
    }
    bus?.emit?.(EVENTS.MENU_CLOSED, { view: was });
    deps.onChange?.(null);
    return true;
  }

  return {
    /** The overlay's root element (null before the first open). */
    get el() { return root; },
    /** Open the menu ('main' or 'pause'). */
    open,
    /** Switch to another view of the open menu. */
    openView,
    /** Close the menu. */
    close,
    /** True while a view is open. */
    isOpen() { return view !== null; },
    /** The open view's id, or null. */
    view() { return view; },

    // ---- the gamepad surface --------------------------------------------
    //
    // The pad does not fake key events. It speaks the same ACTIONS the
    // keyboard does, so the menu routes them through the same focus ring.

    /**
     * Move the focus by a number of steps.
     *
     * @param {number} delta negative moves up / left, positive moves down / right
     * @returns {object|null} the newly focused element
     */
    moveFocus(delta) {
      if (!view) return null;
      const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
      if (!step) return focusables[focusIndex] ?? null;
      return setFocus(focusIndex + step);
    },

    /**
     * Activate the focused control — the pad's CONFIRM button.
     *
     * @returns {boolean} true when something was activated
     */
    confirmFocused() {
      return confirmFocused();
    },

    /** The focused element, or null. */
    focusedElement() {
      pruneFocusables();
      return focusables[focusIndex] ?? null;
    },

    /** How many controls are in the focus ring. */
    focusCount() {
      pruneFocusables();
      return focusables.length;
    },

    /**
     * Route one pad action to the menu.
     *
     * @param {string} action a `menu.*` action
     * @returns {boolean} true when the action was handled
     */
    handlePadAction(action) {
      if (!view || loadingLevel) return false;
      switch (action) {
        case 'menu.up': return !!setFocus(focusIndex - 1);
        case 'menu.down': return !!setFocus(focusIndex + 1);
        case 'menu.left':
          // A slider takes the sideways press for itself; anything else
          // treats it as "the previous control".
          if (adjustFocused(-1)) return true;
          return !!setFocus(focusIndex - 1);
        case 'menu.right':
          if (adjustFocused(1)) return true;
          return !!setFocus(focusIndex + 1);
        case 'menu.confirm': return confirmFocused();
        case 'menu.back': return back();
        default: return false;
      }
    },

    /**
     * Join a control the menu did not create to the focus ring.
     *
     * The settings panel builds its own rows, so it registers them here.
     * A row that is replaced by a re-render is dropped from the ring by the
     * prune, so the focus can never land on a control that is gone.
     *
     * @param {object} node
     */
    registerFocusable(node) {
      if (!node) return null;
      return focusable(node);
    },

    /**
     * Show (or hide) the gamepad hint in the footer.
     * @param {string|null} text
     */
    setPadHint(text) {
      const next = typeof text === 'string' && text.trim() ? text.trim() : null;
      if (next === padHint) return false;
      padHint = next;
      if (view) render();
      return true;
    },

    /** The container the overlay is mounted into. */
    mount(el) {
      container = el ?? null;
      if (root && container) container.append(root);
      return true;
    },
    /** Take the overlay out of the DOM. */
    unmount() {
      root?.remove?.();
      return true;
    },
    dispose() {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('keydown', onWindowKey);
      }
      root?.remove?.();
      root = null;
      view = null;
      focusables = [];
    },
  };
}
