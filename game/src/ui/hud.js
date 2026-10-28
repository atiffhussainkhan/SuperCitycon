/**
 * ui/hud.js — the DOM half of the HUD.
 *
 * OWNER: UX (BOT-09).
 *
 * This module turns the MODELS built by `panels.js` into pixels and binds
 * every control to a real handler. It owns:
 *
 *   - the top bar (treasury / population / happiness / loyalty / day, the
 *     clock, the pause + speed control);
 *   - the demand & usage bars (FR-UX-002/003) with the published 90 %/100 %
 *     thresholds;
 *   - the vertical tool stack (the seven `config.TOOLS`, FR-UX-011);
 *   - the building shop (FR-UX-013/014/053) whose tabs are DERIVED from
 *     the catalogue, never hard-coded;
 *   - the panels (building info, government overview, save/load, help);
 *   - the toasts (rendered from the queue in `toasts.js`);
 *   - the day & event ticker;
 *   - the keyboard scheme (tools 1..7, Space = pause, Shift+1..4 = speed,
 *     Ctrl+S = save, panel toggles, Escape = cancel).
 *
 * HONESTY: every value written to the DOM comes from a model built by
 * `panels.js`, which reads state live. The HUD never computes a game number.
 */

import { TOOLS } from '../core/config.js';
import { EVENTS } from '../core/events.js';
import {
  PLACEHOLDER, TOOL_LABELS, TOOL_ORDER, TOOL_KEYS,
  buildTopBarModel, buildDemandModel, buildUsageModel, buildGovernmentModel,
  buildBuildingInfoModel, buildShopModel, buildSpeedModel, deriveShopTabs,
  normaliseCatalogue, formatInt, titleCase,
} from './panels.js';
import { ensureStyles } from './styles.js';

/** Where the curated 2D manifest may live. None of these are required. */
export const UI_ASSET_CANDIDATES = Object.freeze([
  // The RELATIVE path is tried first: it resolves against the page, so the
  // game works at the root of a host AND under a sub-path (a GitHub Pages
  // project site serves at /<repo>/). The absolute candidates stay as
  // fallbacks for a host that mounts the assets at the server root.
  'assets/ui-assets.json',    // relative to the page — works at any base
  '/assets/ui-assets.json',   // public/ — the dev server and the build
  '/src/data/ui-assets.json', // a dev server without the public copy
  './ui-assets.json',         // next to the bundle
]);

/** The icon slots the HUD knows how to consume. */
export const ICON_SLOTS = Object.freeze({
  treasury: 'hud.treasury',
  population: 'hud.population',
  happiness: 'hud.happiness',
  loyalty: 'hud.loyalty',
  day: 'hud.day',
  score: 'hud.score',
  pause: 'hud.pause',
  play: 'hud.play',
  save: 'hud.save',
  load: 'hud.load',
  shop: 'hud.shop',
  government: 'hud.government',
  studio: 'hud.studio',
  minimap: 'hud.minimap',
  close: 'panel.close',
  search: 'panel.search',
  toolInspect: 'tool.inspect',
  toolBuild: 'tool.build',
  toolBulldoze: 'tool.bulldoze',
  toolRoad: 'tool.road',
  toolTerraform: 'tool.terraform',
  toolPaint: 'tool.paint',
  toolVoxel: 'tool.voxel',
  toastInfo: 'toast.info',
  toastSuccess: 'toast.success',
  toastWarn: 'toast.warn',
  toastError: 'toast.error',
});

/** The panel ids the HUD can open. */
export const PANEL_IDS = Object.freeze(['shop', 'building', 'government', 'saves', 'time', 'help']);

/** The named times of day the time control offers (FR-UX-100). */
export const TIME_PRESETS = Object.freeze([
  { id: 'dawn', label: 'DAWN', t: 0.25 },
  { id: 'day', label: 'DAY', t: 0.5 },
  { id: 'dusk', label: 'DUSK', t: 0.75 },
  { id: 'night', label: 'NIGHT', t: 0.0 },
]);

/** Normalise a slot so `icon.tool.build` also matches `tool.build`. */
function normaliseSlot(slot) {
  return String(slot || '').toLowerCase().replace(/^(icon|button|img|image|art)[._-]/, '');
}

/**
 * Find the manifest record for a slot.
 * @param {object|null} manifest
 * @param {string} slot
 * @returns {object|null}
 */
export function findAssetBySlot(manifest, slot) {
  const images = manifest?.images;
  if (!images || typeof images !== 'object') return null;
  const wanted = normaliseSlot(slot);
  let loose = null;
  for (const rec of Object.values(images)) {
    if (!rec) continue;
    if (normaliseSlot(rec.slot) === wanted) {
      if (rec.slot === slot) return rec;
      loose = loose || rec;
    }
  }
  return loose;
}

/** Create an element with a class, text and optional attributes. */
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/** A small `<img>` for a manifest icon, or null when the art is absent. */
function iconFor(manifest, slot, altText) {
  const rec = findAssetBySlot(manifest, slot);
  if (!rec || !rec.file) return null;
  const img = document.createElement('img');
  img.className = 'sc-icon';
  img.src = rec.file;
  img.alt = altText || '';
  img.setAttribute('data-slot', slot);
  img.loading = 'lazy';
  if (rec.w && rec.h) { img.width = rec.w; img.height = rec.h; }
  return img;
}

/**
 * Create the HUD.
 *
 * @param {object} ctx the shared context
 * @param {object} deps
 * @param {object} deps.toasts   the toast queue (toasts.js)
 * @param {object} deps.camera   the camera rig (camera.js)
 * @param {Function} deps.onTool        called with a tool id
 * @param {Function} deps.onSelection   called with a selection object
 * @param {Function} deps.onOpenPanel   called with a panel id
 * @param {Function} deps.onClosePanel
 * @param {Function} deps.onSave
 * @param {Function} deps.onOpenStudio
 * @returns {object} the HUD service
 */
export function createHUD(ctx, deps = {}) {
  const state = ctx?.state;
  const bus = ctx?.bus;
  const domains = ctx?.domains ?? {};
  const toasts = deps.toasts;
  const camera = deps.camera;

  ensureStyles(document);

  let manifest = null;
  let activeTab = null;
  let searchText = '';
  let currentPanel = null;
  let lastCatalogueSignature = '';
  let panelClock = 0;
  let cachedCatalogue = null;
  let cachedCatalogueSize = -1;
  let cachedShopModel = null;
  let cachedShopKey = '';
  let cachedTabs = [];
  const ticker = [];
  const unsubscribes = [];
  let costOf = null;

  // -------------------------------------------------------------------------
  // Skeleton
  // -------------------------------------------------------------------------

  const root = make('div', 'sc-hud');
  root.setAttribute('data-sc-hud', '1');
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'SuperCitycon HUD');

  // --- top bar ---
  const topbar = make('div', 'sc-topbar');
  topbar.setAttribute('role', 'toolbar');
  topbar.setAttribute('aria-label', 'City status');

  const mayorBtn = make('button', 'sc-mayor');
  mayorBtn.type = 'button';
  mayorBtn.dataset.scAction = 'mayor';
  mayorBtn.title = 'Government overview (G)';
  const mayorLabel = make('span', null, 'Mayor');
  const mayorValue = make('b', null, PLACEHOLDER);
  mayorBtn.append(mayorLabel, mayorValue);

  const statsWrap = make('div', 'sc-stats');
  const statNodes = new Map();
  for (const id of ['treasury', 'population', 'happiness', 'loyalty', 'day']) {
    const btn = make('button', 'sc-stat');
    btn.type = 'button';
    btn.dataset.scStat = id;
    const label = make('span', null, id);
    const value = make('b', null, PLACEHOLDER);
    btn.append(label, value);
    statsWrap.append(btn);
    statNodes.set(id, { btn, label, value });
  }

  const clockBtn = make('button', 'sc-clock');
  clockBtn.type = 'button';
  clockBtn.dataset.scAction = 'clock';
  clockBtn.title = 'Time control (Space = pause, Shift+1..4 = speed)';
  const clockValue = make('b', null, '--:--');
  const clockLabel = make('span', null, 'Day 1');
  clockBtn.append(clockValue, clockLabel);

  const speedWrap = make('div', 'sc-speed');
  speedWrap.setAttribute('role', 'group');
  speedWrap.setAttribute('aria-label', 'Simulation speed');
  const speedButtons = new Map();
  for (const name of ['paused', 'slow', 'normal', 'fast', 'ultra']) {
    const btn = make('button', 'sc-btn', name === 'paused' ? 'II' : name[0].toUpperCase());
    btn.type = 'button';
    btn.dataset.scSpeed = name;
    btn.title = name === 'paused' ? 'Pause (Space)' : `Speed ${name}`;
    speedWrap.append(btn);
    speedButtons.set(name, btn);
  }

  topbar.append(mayorBtn, statsWrap, clockWrap(), speedWrap);

  // --- demand + usage strip (FR-UX-002/003) ---
  // It lives INSIDE the top bar as a second full-width row: a separate
  // absolutely-positioned strip would be painted behind the positioned bar.
  const statusRow = make('div', 'sc-statusrow');
  const demandWrap = make('div', 'sc-stats');
  demandWrap.setAttribute('data-sc-block', 'demand');
  const demandNodes = [];
  for (const id of ['residential', 'commercial', 'industrial']) {
    const btn = make('button', 'sc-stat');
    btn.type = 'button';
    btn.dataset.scDemand = id;
    const label = make('span', null, id);
    const value = make('b', null, PLACEHOLDER);
    btn.append(label, value);
    demandWrap.append(btn);
    demandNodes.push({ id, btn, label, value });
  }

  const usageWrap = make('div', 'sc-stats');
  usageWrap.setAttribute('data-sc-block', 'usage');
  const usageNodes = [];
  for (const id of ['energy', 'water', 'food', 'waste']) {
    const btn = make('button', 'sc-stat');
    btn.type = 'button';
    btn.dataset.scUsage = id;
    const label = make('span', null, id);
    const value = make('b', null, PLACEHOLDER);
    btn.append(label, value);
    usageWrap.append(btn);
    usageNodes.push({ id, btn, label, value });
  }

  statusRow.append(demandWrap, usageWrap);
  topbar.append(statusRow);

  // --- ticker ---
  const tickerEl = make('div', 'sc-ticker');
  tickerEl.setAttribute('data-sc-ticker', '1');
  tickerEl.setAttribute('aria-live', 'polite');

  // --- tools ---
  const toolsEl = make('div', 'sc-tools');
  toolsEl.setAttribute('role', 'toolbar');
  toolsEl.setAttribute('aria-label', 'Tools');
  const toolNodes = new Map();
  for (const tool of TOOL_ORDER) {
    const btn = make('button', 'sc-tool');
    btn.type = 'button';
    btn.dataset.scTool = tool;
    btn.title = `${TOOL_LABELS[tool] ?? tool} (${TOOL_KEYS[tool]})`;
    const slotKey = {
      [TOOLS.inspect]: 'toolInspect',
      [TOOLS.build]: 'toolBuild',
      [TOOLS.bulldoze]: 'toolBulldoze',
      [TOOLS.road]: 'toolRoad',
      [TOOLS.terraform]: 'toolTerraform',
      [TOOLS.paint]: 'toolPaint',
      [TOOLS.voxel]: 'toolVoxel',
    }[tool];
    btn.dataset.scIconSlot = ICON_SLOTS[slotKey];
    const iconHolder = make('span', 'sc-icon-holder');
    const name = make('span', null, TOOL_LABELS[tool] ?? tool);
    const key = make('kbd', null, TOOL_KEYS[tool]);
    btn.append(iconHolder, name, key);
    toolsEl.append(btn);
    toolNodes.set(tool, { btn, iconHolder, name, key });
  }

  // --- shop ---
  const shopEl = make('div', 'sc-shop');
  const tabsEl = make('div', 'sc-shop-tabs');
  tabsEl.setAttribute('data-sc-shop-tabs', '1');
  tabsEl.setAttribute('role', 'tablist');
  const cardsEl = make('div', 'sc-shop-cards');
  cardsEl.setAttribute('data-sc-shop-cards', '1');
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'sc-search';
  searchInput.placeholder = 'SEARCH';
  searchInput.setAttribute('aria-label', 'Search the building shop');
  searchInput.style.cssText = 'pointer-events:auto;min-height:34px;background:var(--sc-ink);border:3px solid var(--sc-edge);color:var(--sc-text);padding:3px 6px;font-family:inherit;font-size:9px;';
  shopEl.append(tabsEl, cardsEl, searchInput);

  // --- camera cluster ---
  const camEl = make('div', 'sc-camctl');
  const camButtons = [];
  for (const [action, label, title] of [
    ['zoom-in', '+', 'Zoom in (wheel)'],
    ['zoom-out', '-', 'Zoom out (wheel)'],
    ['rotate-left', 'Q', 'Rotate left (Q)'],
    ['rotate-right', 'E', 'Rotate right (E)'],
    ['reset', 'H', 'Reset camera (H)'],
  ]) {
    const btn = make('button', 'sc-btn', label);
    btn.type = 'button';
    btn.dataset.scCam = action;
    btn.title = title;
    camEl.append(btn);
    camButtons.push({ action, btn });
  }

  // --- toasts ---
  const toastEl = make('div', 'sc-toasts');
  toastEl.setAttribute('data-sc-toasts', '1');
  toastEl.setAttribute('aria-live', 'polite');

  // --- panel ---
  const panelEl = make('div', 'sc-panel');
  panelEl.hidden = true;
  panelEl.setAttribute('data-sc-panel', '1');
  const panelCard = make('div', 'sc-panel-card');
  const panelHead = make('div', 'sc-panel-head');
  const panelTitle = make('h2', null, '');
  const panelClose = make('button', 'sc-btn sc-panel-close', 'X');
  panelClose.type = 'button';
  panelClose.dataset.scAction = 'close-panel';
  panelHead.append(panelTitle, panelClose);
  const panelBody = make('div', 'sc-panel-body');
  panelCard.append(panelHead, panelBody);
  panelEl.append(panelCard);

  // --- licence honesty line ---
  const licenceEl = make('div', 'sc-licence');
  licenceEl.hidden = true;
  licenceEl.setAttribute('data-sc-licence', '1');
  licenceEl.textContent = '2D icons: your asset library — licence clearance pending.';

  root.append(topbar, tickerEl, toolsEl, shopEl, camEl, toastEl, panelEl, licenceEl);

  function clockWrap() { return clockBtn; }

  // -------------------------------------------------------------------------
  // Assets (the curated 2D manifest — optional, never a dependency)
  // -------------------------------------------------------------------------

  /**
   * Try to load the curated 2D manifest. The HUD is COMPLETE and CORRECT
   * with zero images, so every failure is swallowed.
   */
  async function refreshAssets() {
    if (typeof fetch !== 'function') return false;
    for (const url of UI_ASSET_CANDIDATES) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res || !res.ok) continue;
        const json = await res.json();
        if (!json || !json.images) continue;
        manifest = json;
        applyIcons();
        licenceEl.hidden = false;
        return true;
      } catch {
        /* try the next candidate */
      }
    }
    return false;
  }

  /** Swap every icon placeholder for the real art, when it exists. */
  function applyIcons() {
    if (!manifest) return;
    for (const [tool, node] of toolNodes) {
      const slot = node.btn.dataset.scIconSlot;
      const img = iconFor(manifest, slot, TOOL_LABELS[tool]);
      if (!img) continue;
      node.iconHolder.replaceChildren(img);
    }
    for (const [id, node] of statNodes) {
      const img = iconFor(manifest, ICON_SLOTS[id], id);
      if (!img) continue;
      node.btn.prepend(img);
    }
    for (const [, node] of speedButtons) {
      const img = iconFor(manifest, node.dataset.scSpeed === 'paused' ? ICON_SLOTS.pause : ICON_SLOTS.play, 'speed');
      if (img) node.prepend(img);
    }
    for (const [, node] of toolNodes) {
      const img = iconFor(manifest, ICON_SLOTS.toastInfo, 'toast');
      if (img) node.btn.dataset.scToastIcon = '1';
    }
  }

  // -------------------------------------------------------------------------
  // Catalogue access
  // -------------------------------------------------------------------------

  /**
   * The live catalogue, whatever shape the BLD domain hands over.
   *
   * This runs EVERY FRAME, so the normalised list is cached: the BLD
   * contract's `catalogue` is a callable that reports its size through a
   * `.length` property, which is a cheap change detector. A catalogue that
   * does not report its size is normalised every frame (small catalogues).
   */
  function catalogue() {
    const bld = domains.buildings;
    const raw = bld && typeof bld.catalogue === 'function' ? bld.catalogue : null;
    if (raw) {
      const size = Number(raw.length);
      if (Number.isFinite(size)) {
        if (size === cachedCatalogueSize && cachedCatalogue) return cachedCatalogue;
        const list = normaliseCatalogue(raw);
        cachedCatalogue = list;
        cachedCatalogueSize = list.length;
        return list;
      }
    }
    if (state?.buildings?.catalogue instanceof Map) {
      return normaliseCatalogue(state.buildings.catalogue);
    }
    return [];
  }

  /** The category metadata, when BLD published it. */
  function categories() {
    const list = state?.buildings?.categories;
    if (Array.isArray(list) && list.length) return list;
    if (domains.buildings?.categories && Array.isArray(domains.buildings.categories)) {
      return domains.buildings.categories;
    }
    return [];
  }

  /**
   * A signature that changes whenever the catalogue changes.
   * Only used by the tests / diagnostics — the render path uses the cached
   * catalogue size instead, because this walks the whole catalogue.
   */
  function catalogueSignature() {
    const list = catalogue();
    return `${list.length}:${list.map((d) => d?.id).join(',')}`;
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  function setText(node, text) {
    const s = String(text);
    if (node.textContent !== s) node.textContent = s;
  }

  function renderTopBar() {
    const model = buildTopBarModel({ state, domains });
    for (const block of model) {
      const node = statNodes.get(block.id);
      if (!node) continue;
      setText(node.label, block.label);
      setText(node.value, block.value);
      if (block.tone) node.btn.dataset.tone = block.tone;
      else delete node.btn.dataset.tone;
      node.btn.classList.toggle('is-assumed', block.assumed === true);
      node.btn.title = block.available === false
        ? `${block.label}: not available yet`
        : `${block.label}: ${block.value}`;
    }
  }

  function renderDemandAndUsage() {
    const demand = buildDemandModel({ state, domains });
    for (const bar of demand) {
      const node = demandNodes.find((n) => n.id === bar.id);
      if (!node) continue;
      setText(node.label, bar.label);
      setText(node.value, bar.text);
      node.btn.dataset.tone = bar.ratio !== null && bar.ratio >= 0.999 ? 'red' : 'blue';
      node.btn.title = bar.ratio === null
        ? `${bar.label}: no data yet`
        : `${bar.label}: ${bar.text} used — a full bar means you need more of this type`;
    }
    const usage = buildUsageModel({ state, domains });
    for (const bar of usage) {
      const node = usageNodes.find((n) => n.id === bar.id);
      if (!node) continue;
      setText(node.label, bar.label);
      setText(node.value, bar.text);
      node.btn.dataset.tone = bar.critical ? 'red' : (bar.warning ? 'gold' : 'green');
      node.btn.title = bar.ratio === null
        ? `${bar.label}: no data yet`
        : `${bar.label}: ${bar.text} of production — below 90% is fine, from 90% growth is reduced, at 100% growth stops`;
    }
  }

  function renderClock() {
    const meta = state?.meta ?? {};
    const day = Number.isFinite(Number(meta.day)) ? Math.floor(Number(meta.day)) : 0;
    setText(clockLabel, `Day ${day}`);
    setText(clockValue, clockText());
  }

  function renderSpeed() {
    const model = buildSpeedModel({ state, domains });
    for (const btn of model.buttons) {
      const node = speedButtons.get(btn.id);
      if (!node) continue;
      node.classList.toggle('is-active', btn.active);
      node.setAttribute('aria-pressed', btn.active ? 'true' : 'false');
    }
  }

  function renderTools() {
    const active = state?.ui?.tool ?? TOOLS.inspect;
    for (const [tool, node] of toolNodes) {
      node.btn.classList.toggle('is-active', tool === active);
      node.btn.setAttribute('aria-pressed', tool === active ? 'true' : 'false');
    }
  }

  function renderShop() {
    const list = catalogue();
    // The tab derivation and the shop model are rebuilt only when the
    // catalogue, the active tab or the search changed: this runs every
    // frame and both walk the whole catalogue.
    const key = `${list.length}|${activeTab}|${searchText}`;
    if (key !== cachedShopKey) {
      cachedShopKey = key;
      cachedTabs = deriveShopTabs(list, categories());
      if (!cachedTabs.some((t) => t.id === activeTab)) activeTab = cachedTabs[0]?.id ?? null;
      cachedShopModel = buildShopModel({
        catalogue: list,
        tabs: cachedTabs,
        activeTab,
        search: searchText,
        costOf,
      });
    }
    renderTabs(cachedTabs);
    renderCards(cachedShopModel);
  }

  function renderTabs(tabs) {
    // Rebuild only when the set of tabs changed.
    const wanted = tabs.map((t) => t.id).join(',');
    if (tabsEl.dataset.scSignature !== wanted) {
      tabsEl.dataset.scSignature = wanted;
      tabsEl.replaceChildren();
      for (const tab of tabs) {
        const btn = make('button', 'sc-tab');
        btn.type = 'button';
        btn.dataset.scTab = tab.id;
        const img = iconFor(manifest, `category.${tab.id}`, tab.label);
        if (img) btn.append(img);
        btn.append(document.createTextNode(tab.label));
        const count = make('span', 'sc-count', ` ${tab.count}`);
        btn.append(count);
        tabsEl.append(btn);
      }
    }
    for (const btn of tabsEl.children) {
      btn.classList.toggle('is-active', btn.dataset.scTab === activeTab);
    }
  }

  function renderCards(model) {
    // Only rebuild the DOM when the card set actually changed: this runs
    // every frame and the cards are static most of the time.
    const signature = `${model.activeTab}|${searchText}|${model.cards.map((c) => `${c.id}:${c.costText}:${c.locked}`).join(',')}`;
    if (cardsEl.dataset.scSignature === signature) return;
    cardsEl.dataset.scSignature = signature;
    cardsEl.replaceChildren();
    if (model.empty) {
      const empty = make('div', 'sc-shop-empty', searchText ? 'NO MATCH' : 'NOTHING HERE YET');
      cardsEl.append(empty);
      return;
    }
    const selected = state?.ui?.selection?.type ?? null;
    for (const card of model.cards) {
      const btn = make('button', 'sc-card');
      btn.type = 'button';
      btn.dataset.scCard = card.id;
      btn.classList.toggle('is-selected', card.id === selected);
      const img = iconFor(manifest, `category.${card.category}`, card.name);
      if (img) btn.append(img);
      btn.append(make('span', 'sc-name', card.name));
      btn.append(make('span', 'sc-cost', card.locked ? 'ART PENDING' : card.costText));
      btn.append(make('span', 'sc-meta', titleCase(card.category)));
      cardsEl.append(btn);
    }
  }

  function renderToasts() {
    const current = toasts?.current?.() ?? null;
    const pending = toasts?.pendingCount?.() ?? 0;
    const signature = `${current ? `${current.id}:${current.message}:${current.kind}` : 'none'}|${pending}`;
    if (toastEl.dataset.scSignature === signature) return;
    toastEl.dataset.scSignature = signature;
    toastEl.replaceChildren();
    if (current) {
      const node = make('div', 'sc-toast', current.message);
      node.dataset.kind = current.kind;
      node.dataset.scToast = String(current.id);
      node.title = current.blocking ? 'Blocking alert — click to dismiss' : 'Click to dismiss';
      toastEl.append(node);
    }
    if (pending > 0) {
      const badge = make('div', 'sc-toast-count', `+${pending} MORE`);
      toastEl.append(badge);
    }
  }

  function renderTicker() {
    const wanted = ticker.map((e) => e.id).join(',');
    if (tickerEl.dataset.scSignature !== wanted) {
      tickerEl.dataset.scSignature = wanted;
      tickerEl.replaceChildren();
      for (const entry of ticker.slice(-4)) {
        const node = make('div', null, entry.text);
        node.dataset.scTicker = String(entry.id);
        tickerEl.append(node);
      }
    }
  }

  function renderMayor() {
    const model = buildGovernmentModel({ state, domains });
    setText(mayorValue, model.mayorScore.value);
    mayorBtn.title = model.mayorScore.available
      ? `Mayor score: ${model.mayorScore.value} (G)`
      : 'Mayor score: not published by the simulation yet (G)';
  }

  // -------------------------------------------------------------------------
  // Panels
  // -------------------------------------------------------------------------

  function renderPanel() {
    if (!currentPanel) return;
    panelBody.replaceChildren();
    if (currentPanel === 'building') renderBuildingPanel();
    else if (currentPanel === 'government') renderGovernmentPanel();
    else if (currentPanel === 'shop') renderShopPanel();
    else if (currentPanel === 'saves') renderSavesPanel();
    else if (currentPanel === 'time') renderTimePanel();
    else if (currentPanel === 'help') renderHelpPanel();
  }

  /**
   * The time control (FR-UX-098/099/100): the clock, the simulation speed
   * and the named times of day. The time of day is applied through the
   * renderer's own `setTimeOfDay`, so it takes effect immediately
   * (FR-UX-105) without a world rebuild.
   */
  function renderTimePanel() {
    panelTitle.textContent = 'TIME';
    const grid = make('div', 'sc-kv');
    const day = state?.meta?.day;
    const clockCell = make('div');
    clockCell.append(make('span', null, 'In-game clock'));
    clockCell.append(make('b', null, clockText()));
    grid.append(clockCell);
    const speedCell = make('div');
    speedCell.append(make('span', null, 'Speed'));
    speedCell.append(make('b', null, state?.meta?.paused ? 'PAUSED' : `x${state?.meta?.speed ?? '—'}`));
    grid.append(speedCell);
    panelBody.append(grid);

    const speedRow = make('div', 'sc-shop-tabs');
    speedRow.setAttribute('data-sc-panel-speeds', '1');
    for (const btn of buildSpeedModel({ state, domains }).buttons) {
      const b = make('button', 'sc-tab');
      b.type = 'button';
      b.dataset.scPanelSpeed = btn.id;
      b.textContent = btn.label === 'II' ? 'PAUSE' : btn.label;
      b.classList.toggle('is-active', btn.active);
      speedRow.append(b);
    }
    panelBody.append(speedRow);

    const presetRow = make('div', 'sc-shop-tabs');
    presetRow.setAttribute('data-sc-panel-time-presets', '1');
    for (const preset of TIME_PRESETS) {
      const b = make('button', 'sc-tab');
      b.type = 'button';
      b.dataset.scTimePreset = preset.id;
      b.textContent = preset.label;
      presetRow.append(b);
    }
    panelBody.append(presetRow);
    panelBody.append(make('div', 'sc-note',
      'The day/night cycle is driven by the renderer. Speed: Space pauses, Shift+1..4 sets slow / normal / fast / fastest.'));
  }

  /** The clock string, shared by the top bar and the time panel. */
  function clockText() {
    let frac = 0.5;
    try {
      const r = ctx?.renderer;
      if (r && typeof r.getTimeOfDay === 'function') frac = Number(r.getTimeOfDay());
    } catch { /* keep the default */ }
    if (!Number.isFinite(frac)) frac = 0.5;
    const minutes = Math.floor(((frac % 1) + 1) % 1 * 1440);
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function renderBuildingPanel() {
    const model = buildBuildingInfoModel({ state, domains, selection: state?.ui?.selection, costOf });
    panelTitle.textContent = model.available ? model.title : 'BUILDING';
    if (!model.available) {
      panelBody.append(make('div', 'sc-note', 'No building selected yet. Pick one from the shop strip below.'));
      return;
    }
    const grid = make('div', 'sc-kv');
    for (const row of model.rows) {
      const cell = make('div');
      cell.append(make('span', null, row.label));
      cell.append(make('b', null, row.value));
      grid.append(cell);
    }
    panelBody.append(grid);
  }

  function renderGovernmentPanel() {
    const model = buildGovernmentModel({ state, domains });
    panelTitle.textContent = 'GOVERNMENT';
    const grid = make('div', 'sc-grid2');
    for (const block of model.blocks) {
      const cell = make('div', 'sc-svcblock');
      if (block.developed === false) cell.dataset.developed = 'false';
      const head = make('div', 'sc-svc-head');
      head.append(make('span', 'sc-svc-name', block.label));
      const circle = make('span', 'sc-circle');
      if (block.coverage !== null) {
        const fill = make('i');
        fill.style.width = `${Math.round(block.coverage * 100)}%`;
        fill.style.height = '100%';
        circle.append(fill);
        circle.dataset.full = block.developed ? 'true' : 'false';
        circle.title = `Coverage ${block.coverageText}`;
      } else {
        circle.dataset.full = 'unknown';
        circle.title = 'Coverage: no data yet';
      }
      head.append(circle);
      cell.append(head);

      const meter = make('div', 'sc-meter');
      const bar = make('i');
      const ratio = block.usage ?? 0;
      bar.style.width = `${Math.round(Math.min(1, ratio) * 100)}%`;
      if (ratio >= 0.9) bar.style.background = 'var(--sc-red)';
      else if (ratio >= 0.75) bar.style.background = 'var(--sc-gold)';
      meter.append(bar);
      cell.append(meter);

      const stats = make('div', 'sc-list');
      const usageRow = make('div');
      usageRow.append(make('span', 'sc-dim', 'Usage'));
      usageRow.append(make('b', null, block.usageText));
      stats.append(usageRow);
      const covRow = make('div');
      covRow.append(make('span', 'sc-dim', 'Coverage'));
      covRow.append(make('b', null, block.coverageText));
      stats.append(covRow);
      cell.append(stats);

      if (block.developed === false) {
        cell.append(make('div', 'sc-svc-note', 'NOT FULLY DEVELOPED'));
      }
      grid.append(cell);
    }
    panelBody.append(grid);
    panelBody.append(make('div', 'sc-legend', model.legend));
    panelBody.append(make('div', 'sc-note', `Mayor score: ${model.mayorScore.value}`));
  }

  function renderShopPanel() {
    panelTitle.textContent = 'BUILDING SHOP';
    const grid = make('div', 'sc-grid2');
    panelBody.append(grid);

    // The modal shop must be PICKABLE. It used to render static cells, so the
    // `B` shortcut opened a full-screen modal that covered the map and offered
    // nothing to choose — a dead end on the way to a building.
    //
    // The modal now uses the SAME `data-sc-card` contract as the persistent
    // strip, so one delegated handler serves both.
    const fill = () => {
      const model = buildShopModel({
        catalogue: catalogue(),
        tabs: deriveShopTabs(catalogue(), categories()),
        activeTab,
        search: searchText,
        costOf,
      });
      grid.replaceChildren();
      const selected = state?.ui?.selection?.type ?? null;
      for (const card of model.cards) {
        const cell = make('button', 'sc-shopcard');
        cell.type = 'button';
        cell.dataset.scCard = card.id;
        cell.classList.toggle('is-selected', card.id === selected);
        const head = make('div', 'sc-svc-head');
        head.append(make('span', 'sc-svc-name', card.name));
        head.append(make('b', null, card.costText));
        cell.append(head);
        cell.append(make('div', 'sc-note', titleCase(card.category)));
        if (card.locked) cell.append(make('div', 'sc-svc-note', 'ART PENDING'));
        grid.append(cell);
      }
      if (model.empty) grid.append(make('div', 'sc-note', 'Nothing in this category yet.'));
    };
    fill();

    // The category tabs, in the modal as well as in the strip.
    const tabs = deriveShopTabs(catalogue(), categories());
    if (tabs.length) {
      const tabRow = make('div', 'sc-shop-tabs');
      for (const tab of tabs) {
        const btn = make('button', 'sc-tab');
        btn.type = 'button';
        btn.dataset.scTab = tab.id;
        btn.append(make('span', null, tab.label));
        btn.append(make('span', 'sc-count', ` ${tab.count}`));
        btn.classList.toggle('is-active', tab.id === activeTab);
        tabRow.append(btn);
      }
      panelBody.append(tabRow);
    }

    // The search affordance of FR-UX-053, in the modal as well as the strip.
    const search = make('input', 'sc-search');
    search.type = 'search';
    search.placeholder = 'SEARCH';
    search.setAttribute('aria-label', 'Search the building shop');
    search.value = searchText ?? '';
    search.addEventListener('input', () => {
      searchText = search.value;
      renderShop();   // the persistent strip follows the same filter
      fill();         // the modal re-fills — the input keeps its focus
    });
    panelBody.append(search);
    panelBody.append(make('div', 'sc-legend',
      'Categories are derived from the building catalogue. Cost is derived by the buildings domain from the shared TUNING values.'));
  }

  function renderSavesPanel() {
    panelTitle.textContent = 'SAVE / LOAD';
    const save = ctx?.core?.save;
    if (!save || typeof save.listSaves !== 'function') {
      panelBody.append(make('div', 'sc-note', 'The save system is not available yet.'));
      return;
    }
    const list = make('div', 'sc-list');
    let saves = [];
    try { saves = save.listSaves() ?? []; } catch { saves = []; }
    for (const entry of saves) {
      const row = make('div');
      row.append(make('span', null, `${entry.slot} — ${entry.name ?? ''}`));
      row.append(make('span', 'sc-dim', `${entry.date ?? ''} · stage ${entry.stage ?? PLACEHOLDER}`));
      list.append(row);
    }
    if (!saves.length) list.append(make('div', 'sc-note', 'No saves yet. Press Ctrl+S to save.'));
    panelBody.append(list);
    panelBody.append(make('div', 'sc-note', 'Saves are written to this browser\'s local storage. Ctrl+S saves, Ctrl+Shift+L loads the newest slot.'));
  }

  function renderHelpPanel() {
    panelTitle.textContent = 'HOW TO PLAY';
    const help = [
      ['1 - 7', 'Select a tool'],
      ['W A S D', 'Pan the camera'],
      ['Q / E', 'Rotate the camera'],
      ['Wheel', 'Zoom'],
      ['Right-drag', 'Rotate + tilt'],
      ['Left-drag', 'Pan'],
      ['Space', 'Pause / resume'],
      ['Shift + 1..4', 'Simulation speed'],
      ['Ctrl + S', 'Save'],
      ['B', 'Building shop'],
      ['G', 'Government overview'],
      ['I', 'Selected building'],
      ['L', 'Save / load'],
      ['H', 'This help'],
      ['Esc', 'Close / cancel the tool'],
    ];
    const list = make('div', 'sc-list');
    for (const [key, text] of help) {
      const row = make('div');
      row.append(make('span', null, key));
      row.append(make('span', 'sc-dim', text));
      list.append(row);
    }
    panelBody.append(list);
    panelBody.append(make('div', 'sc-legend',
      'The published rules this HUD follows: below 90 % usage is fine; from 90 % city growth is reduced; at 100 % the city stops growing. A full demand bar means you need more of that type.'));
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  function pushTicker(text) {
    ticker.push({ id: Date.now() + ticker.length, text });
    if (ticker.length > 12) ticker.shift();
  }

  function onBus(evt, handler) {
    if (!bus || typeof bus.on !== 'function') return;
    const un = bus.on(evt, handler);
    if (typeof un === 'function') unsubscribes.push(un);
  }

  onBus(EVENTS.DAY_CHANGED, (p) => {
    const day = p?.day ?? state?.meta?.day;
    pushTicker(`Day ${day}`);
  });
  onBus(EVENTS.BUILDING_PLACED, (p) => {
    pushTicker(`Built ${p?.type ?? 'building'} at ${p?.x ?? '?'},${p?.z ?? '?'}`);
  });
  onBus(EVENTS.BUILDING_REMOVED, (p) => {
    pushTicker(`Demolished at ${p?.x ?? '?'},${p?.z ?? '?'}`);
  });
  onBus(EVENTS.POPULATION_CHANGED, (p) => {
    pushTicker(`Population ${formatInt(p?.total ?? state?.population?.total)}`);
  });
  onBus(EVENTS.MONEY_CHANGED, () => {
    pushTicker('Treasury updated');
  });
  onBus(EVENTS.STAGE_ADVANCED, (p) => {
    pushTicker(`Stage advanced${p?.stageId ? `: ${p.stageId}` : ''}`);
  });
  onBus(EVENTS.COVERAGE_CHANGED, (p) => {
    pushTicker(`Coverage changed${p?.serviceId ? `: ${p.serviceId}` : ''}`);
  });

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  function onClick(e) {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const toolBtn = target.closest('[data-sc-tool]');
    if (toolBtn) {
      const tool = toolBtn.dataset.scTool;
      const active = state?.ui?.tool ?? TOOLS.inspect;
      // FR-UX-058: every active tool offers an explicit cancel — tapping
      // the active tool returns to the default select tool.
      deps.onTool?.(tool === active ? TOOLS.inspect : tool);
      // Immediate feedback (FR-UX-057): the active tool is visibly indicated
      // on the same click, not on the next frame.
      renderTools();
      return;
    }
    const speedBtn = target.closest('[data-sc-speed]');
    if (speedBtn) {
      deps.onSpeed?.(speedBtn.dataset.scSpeed);
      return;
    }
    const camBtn = target.closest('[data-sc-cam]');
    if (camBtn) {
      const action = camBtn.dataset.scCam;
      if (action === 'zoom-in') camera?.zoomTo((camera?.state?.distance ?? 60) * 0.82);
      else if (action === 'zoom-out') camera?.zoomTo((camera?.state?.distance ?? 60) * 1.22);
      else if (action === 'rotate-left') camera?.rotate(-Math.PI / 12);
      else if (action === 'rotate-right') camera?.rotate(Math.PI / 12);
      else if (action === 'reset') camera?.reset();
      return;
    }
    const tabBtn = target.closest('[data-sc-tab]');
    if (tabBtn) {
      activeTab = tabBtn.dataset.scTab;
      renderShop();
      // A tab clicked INSIDE the modal shop must move the modal too.
      if (currentPanel === 'shop') renderPanel();
      return;
    }
    const cardBtn = target.closest('[data-sc-card]');
    if (cardBtn) {
      const id = cardBtn.dataset.scCard;
      const list = catalogue();
      const def = list.find((d) => d?.id === id) ?? null;
      deps.onSelection?.({ kind: 'building', type: id, def });
      // Picking a card must LEAVE THE MAP CLEAR.
      //
      // The shop is a persistent bottom strip, but the panel is a FULL-SCREEN
      // modal (`inset: 0`). Opening it here swallowed the next canvas click,
      // so the building the player had just chosen could not be placed until
      // they dismissed the modal by hand — a dead end in the build loop.
      //
      // So a card click now: selects the type, arms the build tool (so the
      // map click places it), and dismisses whatever panel was open.
      // The building's details stay reachable through the `i` key (and the
      // building panel's own close control), so nothing is lost.
      deps.onTool?.(TOOLS.build);
      // FR-UX-057: the active tool is visibly indicated on the SAME click,
      // not on the next frame.
      renderTools();
      renderShop();
      closePanel();
      return;
    }
    const statBtn = target.closest('[data-sc-stat]');
    if (statBtn) {
      openPanel(statBtn.dataset.scStat === 'day' ? 'time' : 'government');
      return;
    }
    const demandBtn = target.closest('[data-sc-demand]');
    if (demandBtn) { openPanel('government'); return; }
    const usageBtn = target.closest('[data-sc-usage]');
    if (usageBtn) { openPanel('government'); return; }
    const panelSpeed = target.closest('[data-sc-panel-speed]');
    if (panelSpeed) {
      deps.onSpeed?.(panelSpeed.dataset.scPanelSpeed);
      renderPanel();
      return;
    }
    const timePreset = target.closest('[data-sc-time-preset]');
    if (timePreset) {
      const preset = TIME_PRESETS.find((p) => p.id === timePreset.dataset.scTimePreset);
      try {
        ctx?.renderer?.setTimeOfDay?.(preset ? preset.t : 0.5);
      } catch { /* the renderer owns the cycle */ }
      renderPanel();
      return;
    }
    if (target.closest('[data-sc-action="close-panel"]')) { closePanel(); return; }
    if (target.closest('[data-sc-action="mayor"]')) { openPanel('government'); return; }
    if (target.closest('[data-sc-action="clock"]')) { openPanel('time'); return; }
    const toast = target.closest('[data-sc-toast]');
    if (toast) { toasts?.dismiss?.(); return; }
    // Clicking the backdrop dismisses the panel (FR-UX-032).
    if (target === panelEl) { closePanel(); return; }
  }

  function onKeyDown(e) {
    if (!e) return;
    const tag = e.target?.tagName || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const mod = e.ctrlKey || e.metaKey;

    if (mod && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      deps.onSave?.();
      return;
    }
    if (mod) return;

    if (e.key === ' ') {
      e.preventDefault();
      deps.onSpeed?.(state?.meta?.paused ? 'normal' : 'paused');
      return;
    }
    if (e.shiftKey) {
      const map = { '!': 'slow', '@': 'normal', '#': 'fast', '$': 'ultra' };
      const byDigit = { Digit1: 'slow', Digit2: 'normal', Digit3: 'fast', Digit4: 'ultra' };
      const name = byDigit[e.code] ?? map[e.key];
      if (name) {
        e.preventDefault();
        deps.onSpeed?.(name);
        return;
      }
    }
    if (e.key >= '1' && e.key <= '7' && !e.shiftKey) {
      const tool = TOOL_ORDER[Number(e.key) - 1];
      if (tool) {
        e.preventDefault();
        deps.onTool?.(tool);
      }
      return;
    }
    switch (e.key.toLowerCase()) {
      case 'b': openPanel('shop'); break;
      case 'g': openPanel('government'); break;
      case 'i': openPanel('building'); break;
      case 'l': openPanel('saves'); break;
      case 't': openPanel('time'); break;
      case 'h': openPanel('help'); break;
      case 'escape':
        if (currentPanel) closePanel();
        else deps.onTool?.(TOOLS.inspect);
        break;
      default: break;
    }
  }

  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);
  // The keyboard scheme must work even when the HUD does not have focus.
  // NOTE: when nothing in the page is focused the event target is `window`,
  // which is NOT a Node — `root.contains(window)` throws and would silence
  // every shortcut, so the target is checked before it is used.
  const onWindowKey = (e) => {
    const t = e.target;
    const isNode = !!t && typeof t.nodeType === 'number';
    if (isNode && root.contains(t)) return;
    if (t?.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    onKeyDown(e);
  };
  window.addEventListener('keydown', onWindowKey);

  searchInput.addEventListener('input', () => {
    searchText = searchInput.value || '';
    renderShop();
  });

  // -------------------------------------------------------------------------
  // Public surface
  // -------------------------------------------------------------------------

  function openPanel(id) {
    if (!PANEL_IDS.includes(id)) return null;
    currentPanel = id;
    panelEl.hidden = false;
    panelTitle.textContent = id.toUpperCase();
    renderPanel();
    deps.onOpenPanel?.(id);
    bus?.emit?.(EVENTS.OPEN_PANEL, { id });
    return id;
  }

  function closePanel() {
    if (!currentPanel) return null;
    const id = currentPanel;
    currentPanel = null;
    panelEl.hidden = true;
    panelBody.replaceChildren();
    deps.onClosePanel?.(id);
    bus?.emit?.(EVENTS.CLOSE_PANEL, { id });
    return id;
  }

  return {
    /** The HUD's root element. */
    el: root,
    /** Mount into a container. */
    mount(container) {
      if (!container) return false;
      container.append(root);
      return true;
    },
    /** Remove from its container. */
    unmount() {
      root.remove();
      return true;
    },
    /** Per-frame refresh — every value is re-read from state. */
    update(dt) {
      renderTopBar();
      renderDemandAndUsage();
      renderClock();
      renderSpeed();
      renderTools();
      renderShop();
      renderToasts();
      renderTicker();
      renderMayor();
      // Panels show LIVE values (FR-UX-033), but rebuilding their DOM 60
      // times a second is wasteful: refresh them four times a second.
      panelClock += Number.isFinite(dt) ? dt : 0;
      if (currentPanel && panelClock >= 0.25) {
        panelClock = 0;
        renderPanel();
      }
      void dt;
    },
    openPanel,
    closePanel,
    /** The open panel id, or null. */
    panel: () => currentPanel,
    /** Ask the manifest loader for the curated 2D art. */
    refreshAssets,
    /** Give the HUD the cost function once the buildings domain is ready. */
    setCostOf(fn) { costOf = typeof fn === 'function' ? fn : null; },
    /** The tab the shop is showing. */
    activeTab: () => activeTab,
    setActiveTab(id) { activeTab = id; renderShop(); },
    dispose() {
      for (const un of unsubscribes) { try { un(); } catch { /* ignore */ } }
      unsubscribes.length = 0;
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keydown', onWindowKey);
      root.remove();
    },
  };
}
