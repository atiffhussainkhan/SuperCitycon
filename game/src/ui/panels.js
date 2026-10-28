/**
 * ui/panels.js — the PURE half of the HUD.
 *
 * OWNER: UX (BOT-09).
 *
 * This module MUST NOT import `three` (contract §0.5) so that every rule
 * about what the player sees can be unit-tested in Node. It builds *models*
 * — plain data describing what the HUD should display — and the DOM layer
 * (hud.js) turns those models into pixels.
 *
 * THE HONESTY RULES ENCODED HERE
 * --------------------------------
 * 1. A number is only ever read from `state` or from a domain's PUBLIC
 *    getter, at the moment the model is built. Nothing is cached, nothing is
 *    recomputed locally (contract §6 + the task brief).
 * 2. When the domain that owns a number is not present, the value is the
 *    neutral placeholder `—`. It is NEVER a fabricated 0 (task brief).
 * 3. Where the dossier marks a value TBD, the model carries `assumed: true`
 *    so the HUD can mark it as a proposed value rather than a published fact
 *    (FR-UX-017 area, core/config.js honesty rule).
 */

import { TOOLS, SPEED, PALETTE_NAMES } from '../core/config.js';

/** The neutral placeholder shown when a number has no owner yet. */
export const PLACEHOLDER = '—';

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/** Display names for the seven tools in `config.TOOLS`. */
export const TOOL_LABELS = Object.freeze({
  [TOOLS.inspect]: 'Inspect',
  [TOOLS.build]: 'Build',
  [TOOLS.bulldoze]: 'Bulldoze',
  [TOOLS.road]: 'Road',
  [TOOLS.terraform]: 'Terraform',
  [TOOLS.paint]: 'Paint',
  [TOOLS.voxel]: 'Studio',
});

/** The tool order shown in the vertical stack (FR-UX-011) and the 1..7 keys. */
export const TOOL_ORDER = Object.freeze([
  TOOLS.inspect,
  TOOLS.build,
  TOOLS.bulldoze,
  TOOLS.road,
  TOOLS.terraform,
  TOOLS.paint,
  TOOLS.voxel,
]);

/** The keyboard digit (1..7) bound to each tool. */
export const TOOL_KEYS = Object.freeze({
  [TOOLS.inspect]: '1',
  [TOOLS.build]: '2',
  [TOOLS.bulldoze]: '3',
  [TOOLS.road]: '4',
  [TOOLS.terraform]: '5',
  [TOOLS.paint]: '6',
  [TOOLS.voxel]: '7',
});

// ---------------------------------------------------------------------------
// Service blocks (FR-UX-035: eight blocks)
// ---------------------------------------------------------------------------

/**
 * The eight government-overview blocks, in the dossier's order.
 * `ids` lists the candidate service ids: the SRV service ids are not
 * published, so each block accepts more than one spelling and reports
 * "—" when none of them resolves.
 */
export const SERVICE_BLOCKS = Object.freeze([
  { id: 'energy', label: 'Energy Supply', ids: ['energy', 'power'] },
  { id: 'water', label: 'Water Supply', ids: ['water', 'waterSupply'] },
  { id: 'food', label: 'Food Supply', ids: ['food', 'foodSupply'] },
  { id: 'waste', label: 'Waste', ids: ['waste'] },
  { id: 'health', label: 'Health Care', ids: ['health', 'healthcare', 'clinic'] },
  { id: 'security', label: 'Security', ids: ['security', 'police'] },
  { id: 'fire', label: 'Fire', ids: ['fire'] },
  { id: 'education', label: 'School System', ids: ['education', 'school'] },
]);

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format an integer-ish number, or the placeholder. */
export function formatInt(value, placeholder = PLACEHOLDER) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return placeholder;
  return Math.round(Number(value)).toLocaleString('en-US');
}

/** Format a money amount. Negative values keep their sign. */
export function formatMoney(value, placeholder = PLACEHOLDER) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return placeholder;
  const n = Math.round(Number(value));
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US')}`;
}

/** Format a 0..1 ratio as a whole percentage. */
export function formatPct(ratio, placeholder = PLACEHOLDER) {
  if (ratio === null || ratio === undefined || !Number.isFinite(Number(ratio))) return placeholder;
  return `${Math.round(Number(ratio) * 100)}%`;
}

/** Format a 0..100 value as a percentage string. */
export function formatPct100(value, placeholder = PLACEHOLDER) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return placeholder;
  return `${Math.round(Number(value))}%`;
}

// ---------------------------------------------------------------------------
// Catalogue helpers (the shop is DATA-DRIVEN — never hard-coded)
// ---------------------------------------------------------------------------

/**
 * Normalise the many shapes a building catalogue can arrive in:
 * an array, a Map, a callable that returns an array (the BLD contract's
 * `catalogue` is a callable with a `.length`), or a plain object.
 * @returns {Array<object>}
 */
export function normaliseCatalogue(catalogue) {
  if (!catalogue) return [];
  let list = catalogue;
  if (typeof catalogue === 'function') {
    try {
      list = catalogue();
    } catch {
      return [];
    }
  }
  if (list instanceof Map) list = Array.from(list.values());
  if (!Array.isArray(list)) {
    if (list && typeof list === 'object') {
      // A record of id -> definition.
      list = Object.values(list);
    } else {
      return [];
    }
  }
  return list.filter((d) => d && typeof d === 'object');
}

/**
 * Derive the shop's tabs from the catalogue itself.
 *
 * The categories are DATA: the number of tabs always equals the number of
 * distinct categories present in the catalogue. Labels and order come from
 * the category list when one is supplied (BLD publishes `CATEGORIES`), and
 * are derived from the ids otherwise.
 *
 * @param {Array|Map|Function} catalogue
 * @param {Array<{id:string,label?:string,order?:number}>} [categories]
 * @returns {Array<{id:string,label:string,count:number,order:number}>}
 */
export function deriveShopTabs(catalogue, categories) {
  const list = normaliseCatalogue(catalogue);
  const meta = new Map();
  for (const c of normaliseCatalogue(categories)) {
    if (!c || typeof c.id !== 'string') continue;
    meta.set(c.id, c);
  }

  const tabs = new Map();
  for (const def of list) {
    const id = typeof def.category === 'string' && def.category ? def.category : 'other';
    let tab = tabs.get(id);
    if (!tab) {
      const m = meta.get(id);
      tab = {
        id,
        label: (m && typeof m.label === 'string' && m.label) || titleCase(id),
        count: 0,
        order: (m && Number.isFinite(m.order)) ? m.order : Number.MAX_SAFE_INTEGER,
      };
      tabs.set(id, tab);
    }
    tab.count += 1;
    const own = Number.isFinite(def.categoryOrder) ? def.categoryOrder : null;
    if (own !== null && own < tab.order) tab.order = own;
  }

  return Array.from(tabs.values()).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.label.localeCompare(b.label);
  });
}

/** "residential" -> "Residential" */
export function titleCase(id) {
  return String(id)
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Live read-outs
// ---------------------------------------------------------------------------

/** Read a domain getter defensively — a broken domain must not break the HUD. */
function callDomain(domain, method, ...args) {
  if (!domain || typeof domain[method] !== 'function') return undefined;
  try {
    return domain[method](...args);
  } catch {
    return undefined;
  }
}

/**
 * The top bar (task brief + FR-UX-001/006/007/008/009).
 *
 * Every value is read live. When the owning domain is absent the block
 * shows the placeholder instead of a made-up number.
 *
 * @param {{state:object, domains:object}} ctx
 * @returns {Array<{id:string,label:string,value:string,assumed?:boolean,tone?:string}>}
 */
export function buildTopBarModel({ state, domains } = {}) {
  const eco = domains?.economy;
  const pop = domains?.population;
  const meta = state?.meta ?? {};

  const treasury = eco ? callDomain(eco, 'treasury') : undefined;
  const population = pop ? callDomain(pop, 'population') : undefined;
  const happiness = pop ? callDomain(pop, 'happiness') : undefined;
  const loyalty = pop ? callDomain(pop, 'loyalty') : undefined;

  // The top-bar stats whose value rests on a number the publisher never
  // published. The RULES behind them are published; the CONSTANTS are not,
  // so the HUD marks these as provisional (see `config.TUNING`).
  const ASSUMED = new Set(['happiness', 'loyalty']);

  const blocks = [
    {
      id: 'treasury',
      label: 'Treasury',
      value: formatMoney(treasury),
      tone: 'gold',
      // The economy domain owns the money maths; without it we show "—".
      available: treasury !== undefined,
    },
    {
      id: 'population',
      label: 'Residents',
      value: formatInt(population),
      tone: 'blue',
      available: population !== undefined,
    },
    {
      id: 'happiness',
      label: 'Happiness',
      value: formatPct100(happiness),
      tone: happiness !== undefined && Number(happiness) < 50 ? 'red' : 'green',
      available: happiness !== undefined,
    },
    {
      id: 'loyalty',
      label: 'Loyalty',
      value: formatPct100(loyalty),
      tone: 'green',
      available: loyalty !== undefined,
    },
    {
      id: 'day',
      label: 'Day',
      value: Number.isFinite(Number(meta.day)) ? String(Math.floor(Number(meta.day))) : PLACEHOLDER,
      tone: 'blue',
      available: Number.isFinite(Number(meta.day)),
    },
  ];

  return blocks.map((b) => ({
    id: b.id,
    label: b.label,
    value: b.value,
    tone: b.tone,
    available: b.available,
    // True means: the rule is published, the numbers behind it are not.
    assumed: ASSUMED.has(b.id) && b.available === true,
  }));
}

/**
 * The demand block (FR-UX-002): three bars, residential / commercial /
 * industrial, each showing the UNMET demand of that sector.
 *
 * The published SEMANTICS are FR-ECO-061/062: a demand bar shows unmet
 * demand, the fuller the bar the more of that sector is needed, and a full
 * bar means the sector's capacity is exhausted. The dossier publishes those
 * semantics but NOT the inputs, so the demand MODEL is a design decision.
 *
 * ECO owns that model (the cross-domain ownership map gives the economy the
 * demand maths), so this layer READS ECO's bars instead of inventing a second
 * mapping of its own. The earlier version mapped `employed` onto commercial
 * demand and `unemployed` onto industrial demand, which is not a published
 * rule and is not even a sensible one: an employed resident does not generate
 * demand for MORE commercial buildings, and the unemployed are a labour pool,
 * not industrial demand.
 *
 * Because the INPUTS are unpublished, every bar is marked `assumed: true` so
 * the HUD can show the player that the number is provisional.
 */
export function buildDemandModel({ state, domains } = {}) {
  const eco = domains?.economy;
  const bars = eco ? callDomain(eco, 'demandBars') : undefined;

  if (!bars) {
    return [
      { id: 'residential', label: 'Residential', ratio: null, text: PLACEHOLDER, assumed: true },
      { id: 'commercial', label: 'Commercial', ratio: null, text: PLACEHOLDER, assumed: true },
      { id: 'industrial', label: 'Industrial', ratio: null, text: PLACEHOLDER, assumed: true },
    ];
  }

  const labels = {
    residential: 'Residential',
    commercial: 'Commercial',
    industrial: 'Industrial',
  };

  return Object.keys(labels).map((id) => {
    const bar = bars[id];
    if (!bar) {
      return { id, label: labels[id], ratio: null, text: PLACEHOLDER, assumed: true };
    }
    const ratio = Math.max(0, Math.min(1, Number(bar.fill) || 0));
    const capacity = Number(bar.capacity) || 0;
    const unmet = Number(bar.unmet) || 0;
    return {
      id,
      label: labels[id],
      ratio,
      text: formatPct(ratio),
      capacity,
      demand: Number(bar.demand) || 0,
      unmet,
      remaining: Math.max(0, capacity - unmet),
      saturated: bar.saturated === true,
      // The semantics are published; the inputs are not.
      assumed: true,
    };
  });
}

/**
 * The usage block (FR-UX-003): energy / water / food / waste, each as a
 * percentage of production. The 90 % / 100 % thresholds (FR-UX-024,
 * FR-UX-026) come straight from the published tutorial wording.
 */
export function buildUsageModel({ state, domains } = {}) {
  const bld = domains?.buildings;
  // Same rule as the demand block: the live getter first, the state subtree
  // as the fallback.
  const agg = (bld ? callDomain(bld, 'aggregates') : undefined) ?? state?.buildings?.aggregates;

  const defs = [
    { id: 'energy', label: 'Energy' },
    { id: 'water', label: 'Water' },
    { id: 'food', label: 'Food' },
    { id: 'waste', label: 'Waste' },
  ];

  if (!agg) {
    return defs.map((d) => ({ ...d, ratio: null, text: PLACEHOLDER, critical: false }));
  }

  const energy = agg.energy ?? {};
  const water = agg.water ?? {};
  const food = agg.food ?? {};
  const waste = agg.waste ?? {};

  const usage = {
    energy: [Number(energy.consumption) || 0, Number(energy.production) || 0],
    water: [Number(water.consumption) || 0, Number(water.production) || 0],
    food: [
      Number(food.consumption) || 0,
      (Number(food.plant) || 0) + (Number(food.animal) || 0) + (Number(food.processed) || 0),
    ],
    waste: [Number(waste.production) || 0, Number(waste.removal) || 0],
  };

  return defs.map((d) => {
    const [used, made] = usage[d.id];
    if (!Number.isFinite(used) || !Number.isFinite(made) || (made === 0 && used === 0)) {
      return { ...d, ratio: null, text: PLACEHOLDER, critical: false, used: 0, produced: 0 };
    }
    const ratio = made > 0 ? used / made : (used > 0 ? 1 : 0);
    return {
      ...d,
      ratio: Math.min(2, ratio),
      text: formatPct100(Math.min(100, ratio * 100)),
      used,
      produced: made,
      // At 100 % the city stops growing (published tutorial wording).
      critical: ratio >= 1,
      warning: ratio >= 0.9,
    };
  });
}

/**
 * The government overview (FR-UX-035..040): eight service blocks with a
 * coverage circle and a usage/demand bar each.
 *
 * @returns {{blocks:Array, mayorScore:{value:string,available:boolean}}}
 */
export function buildGovernmentModel({ state, domains } = {}) {
  const srv = domains?.services;
  const coverageMap = state?.services?.cityCoverage ?? {};

  const blocks = SERVICE_BLOCKS.map((block) => {
    let coverage = null;
    let used = null;
    let capacity = null;
    let demand = null;

    for (const sid of block.ids) {
      const c = srv ? callDomain(srv, 'cityCoverage', sid) : coverageMap[sid];
      if (c !== undefined && c !== null) { coverage = Number(c); break; }
    }
    const avail = srv ? callDomain(srv, 'availability', block.ids[0]) : undefined;
    if (avail && typeof avail === 'object') {
      used = Number.isFinite(Number(avail.served)) ? Number(avail.served) : null;
      capacity = Number.isFinite(Number(avail.capacity)) ? Number(avail.capacity) : null;
      demand = Number.isFinite(Number(avail.demand)) ? Number(avail.demand) : null;
    }

    const coverageRatio = Number.isFinite(coverage) ? Math.min(1, Math.max(0, coverage)) : null;
    const usageRatio = (used !== null && demand !== null && demand > 0)
      ? Math.min(1, used / demand)
      : (used !== null && capacity !== null && capacity > 0 ? Math.min(1, used / capacity) : null);

    return {
      id: block.id,
      label: block.label,
      coverage: coverageRatio,
      coverageText: formatPct(coverageRatio),
      usage: usageRatio,
      usageText: formatPct(usageRatio),
      used,
      capacity,
      demand,
      // "not fully developed" (FR-UX-038)
      developed: coverageRatio === null ? null : coverageRatio >= 0.999,
      available: coverageRatio !== null || avail !== undefined,
    };
  });

  const mayor = state?.meta?.mayorScore;
  return {
    blocks,
    mayorScore: {
      value: Number.isFinite(Number(mayor)) ? formatInt(mayor) : PLACEHOLDER,
      available: Number.isFinite(Number(mayor)),
    },
    legend: 'Circles = coverage (want them full). Bars = usage / demand (want them low). Below 90% is fine; from 90% city growth is reduced; at 100% the city stops growing.',
  };
}

/**
 * The selected-building info panel (task brief) — the properties of the
 * catalogue entry the player has selected.
 */
export function buildBuildingInfoModel({ state, domains, selection, costOf } = {}) {
  const typeId = selection?.type ?? selection?.typeId ?? null;
  if (!typeId) {
    return { available: false, typeId: null, title: 'No building selected', rows: [] };
  }
  const bld = domains?.buildings;
  let def = null;
  if (bld && typeof bld.catalogue === 'function') {
    const cat = normaliseCatalogue(bld.catalogue);
    def = cat.find((d) => d && d.id === typeId) || null;
  }
  if (!def && state?.buildings?.catalogue instanceof Map) {
    def = state.buildings.catalogue.get(typeId) || null;
  }
  if (!def) {
    return { available: false, typeId, title: typeId, rows: [] };
  }

  const rows = [
    { label: 'Category', value: titleCase(def.category ?? 'other') },
    { label: 'Footprint', value: Array.isArray(def.footprintCells) ? def.footprintCells.join(' x ') + ' cells' : PLACEHOLDER },
    { label: 'Cost', value: formatMoney(typeof costOf === 'function' ? costOf(def) : def.cost) },
    { label: 'Model', value: def.model ? String(def.model) : (def.available === false ? 'art pending' : PLACEHOLDER) },
  ];
  if (def.residentialCapacity !== undefined) {
    rows.push({ label: 'Residents', value: formatInt(def.residentialCapacity) });
  }
  if (def.levels !== undefined || def.maxLevels !== undefined) {
    rows.push({ label: 'Max levels', value: formatInt(def.maxLevels ?? def.levels) });
  }
  if (def.description) {
    rows.push({ label: 'About', value: String(def.description), wide: true });
  }

  return {
    available: true,
    typeId,
    title: def.displayName || def.name || typeId,
    category: def.category ?? 'other',
    rows,
  };
}

/**
 * The shop model: the cards for the active tab, optionally filtered by a
 * search string. Categories come from the catalogue; never hard-coded.
 */
export function buildShopModel({ catalogue, tabs, activeTab, search, costOf } = {}) {
  const list = normaliseCatalogue(catalogue);
  const allTabs = Array.isArray(tabs) ? tabs : deriveShopTabs(list);
  const tab = allTabs.find((t) => t.id === activeTab) || allTabs[0] || null;
  const needle = (search || '').trim().toLowerCase();

  let cards = tab ? list.filter((d) => d && d.category === tab.id) : list.slice();
  if (needle) {
    cards = cards.filter((d) => {
      const name = String(d.displayName || d.name || '').toLowerCase();
      const id = String(d.id || '').toLowerCase();
      return name.includes(needle) || id.includes(needle);
    });
  }

  return {
    tabs: allTabs,
    activeTab: tab ? tab.id : null,
    cards: cards.map((d) => ({
      id: d.id,
      name: d.displayName || d.name || d.id,
      category: d.category ?? 'other',
      cost: typeof costOf === 'function' ? costOf(d) : d.cost,
      costText: formatMoney(typeof costOf === 'function' ? costOf(d) : d.cost),
      available: d.available !== false,
      locked: d.available === false,
      model: d.model ?? null,
    })),
    empty: cards.length === 0,
  };
}

/**
 * The pause / speed control (FR-UX-099). The speed set is derived from
 * `config.SPEED` so a new speed level never needs a UI change.
 */
export function buildSpeedModel({ state, domains } = {}) {
  const meta = state?.meta ?? {};
  const current = Number.isFinite(Number(meta.speed)) ? Number(meta.speed) : SPEED.normal;
  const paused = !!meta.paused;
  const names = ['paused', 'slow', 'normal', 'fast', 'ultra'];
  const buttons = names.map((name, i) => ({
    name,
    id: name,
    speed: SPEED[name],
    label: name === 'paused' ? 'II' : String(i),
    active: name === 'paused' ? paused : (!paused && SPEED[name] === current),
  }));
  return { paused, speed: current, buttons };
}

/** The 16-bit palette as CSS colours — used by the HUD's own swatches. */
export function paletteCss() {
  return PALETTE_NAMES.map((name) => name);
}

/**
 * A tiny event ring for the ticker (FR-UX-107 / the "day & event" ticker).
 * The HUD keeps the last N events; this just formats them.
 */
export function formatTickerEvent(event) {
  if (!event) return '';
  const label = event.label ?? event.type ?? 'event';
  const detail = event.detail ? ` ${event.detail}` : '';
  return `${label}${detail}`;
}
