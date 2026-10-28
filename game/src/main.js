/**
 * main.js — SuperCitycon bootstrap and frame loop.
 *
 * OWNER: the integrator (and later `sc-integration`).
 *
 * Responsibilities:
 *   1. build the render + asset services,
 *   2. create the ten domain services and publish them on `ctx.domains`,
 *   3. run the frame loop (wall-clock `update`, game-time `tick`),
 *   4. dispatch pointer/keyboard input to the domains,
 *   5. trap fatal errors into the on-page #fatal pane instead of a black screen.
 *
 * Design note: a domain that fails to load is reported in the boot log and the
 * rest of the city keeps running. One broken subsystem must never produce a
 * black screen.
 */

import * as THREE from 'three';
import { createRenderer, cellCenter } from './render/renderer.js';
import { createState, setState, resetState, state as liveState } from './core/state.js';

// --- the ten domains, imported STATICALLY --------------------------------
// A dynamic import whose specifier is a VARIABLE cannot be analysed by
// Vite, so it is left as a raw runtime URL and 404s in the production
// bundle (dist/ has no /src/). Static imports are bundled correctly, and a
// genuinely missing module then fails the BUILD instead of the runtime.
// None of these modules import JSON, so main.js stays importable in Node.
import { createWorld } from './world/index.js';
import { createBuildings } from './buildings/index.js';
import { createEconomy } from './economy/index.js';
import { createMobility } from './mobility/index.js';
import { createPopulation } from './population/index.js';
import { createServices } from './services/index.js';
import { createStudio } from './studio/index.js';
import { createUI } from './ui/index.js';
import * as coreStage from './core/stage.js';
import * as coreSave from './core/save.js';
import * as coreModes from './core/modes.js';
import { EVENTS, emit, on, off, once } from './core/events.js';
import {
  makeRng, MODES, SPEED, TUNING, GRID, CELL, PALETTE, WORLD, TOOLS,
  cellToWorld, worldToCell, worldToCellInt, inBounds,
} from './core/config.js';

/** Ordered domain list: [key, factory]. The order matters — world first
 *  (everything else asks it for terrain heights), then the city, then the
 *  simulation, then the presentation. */
const DOMAIN_SPECS = [
  ['wld', createWorld],
  ['buildings', createBuildings],
  ['economy', createEconomy],
  ['mobility', createMobility],
  ['population', createPopulation],
  ['services', createServices],
  ['studio', createStudio],
  ['ui', createUI],
];

/** CORE modules, published on `ctx.core`. */
const CORE_MODULES = {
  stage: coreStage,
  save: coreSave,
  modes: coreModes,
};

// The module is imported by the integration test as well as by the page, so
// the DOM lookups must survive an environment that has no `document` at all.
const hasDom = typeof document !== 'undefined';
const bootEl = hasDom ? document.getElementById('boot') : null;
const bootBar = hasDom ? document.getElementById('boot-bar') : null;
const bootStatus = hasDom ? document.getElementById('boot-status') : null;
const fatalEl = hasDom ? document.getElementById('fatal') : null;

const bootLog = [];

function log(msg) {
  bootLog.push(msg);
  // eslint-disable-next-line no-console
  console.log(`[boot] ${msg}`);
}

function fatal(err) {
  // eslint-disable-next-line no-console
  console.error(err);
  if (fatalEl) {
    fatalEl.style.display = 'block';
    fatalEl.textContent =
      `SuperCitycon failed to start.\n\n${err && (err.stack || err.message || String(err))}\n\n` +
      `--- boot log ---\n${bootLog.join('\n')}`;
  }
  bootEl?.classList.add('hidden');
}

function setProgress(p, msg) {
  if (bootBar) bootBar.style.width = `${Math.round(Math.min(1, p) * 100)}%`;
  if (bootStatus && msg) bootStatus.textContent = msg;
}

async function main() {
  const container = document.getElementById('viewport');
  const uiRoot = document.getElementById('ui-root');

  // ---- 1. render + assets ------------------------------------------------
  setProgress(0.04, 'starting renderer…');
  const renderer = createRenderer(container);
  renderer.focusOn(0, 0);           // world origin == centre of the grid

  setProgress(0.10, 'loading library art…');
  // The asset service is imported lazily: it pulls in the JSON manifest, and
  // a static import would make this module un-importable outside a bundler
  // (Node needs an import attribute for JSON). Keeping it dynamic lets the
  // integration test import the pure helpers below.
  const assetService = await import('./render/assets.js');
  const manifest = assetService.manifest;
  const preloadKeys = Object.keys(manifest.models);
  const pre = await assetService.preload(preloadKeys, (loaded, total, key) => {
    setProgress(0.10 + 0.42 * (loaded / total), `loading ${key}…`);
  });
  log(`preloaded ${pre.loaded}/${pre.total} models (${pre.failures.length} failures)`);
  for (const f of pre.failures) log(`  ! model load failed: ${f.key} — ${f.error}`);

  // ---- 2. context --------------------------------------------------------
  const ctx = {
    bus: { on, off, once, emit },
    assets: assetService,
    renderer,
    config: {
      CELL, GRID, WORLD, PALETTE, TUNING, SPEED, MODES, TOOLS,
      cellToWorld, worldToCell, worldToCellInt, inBounds,
      THREE,
    },
    manifest,
    rng: makeRng(liveState.meta.seed),
    domains: {},
    ui: null,
    core: {},
  };
  // `ctx.state` must ALWAYS point at the live state tree. `setState()`
  // (used by save/load and mode switching) replaces the tree, so a captured
  // reference would leave every domain writing into a dead object.
  Object.defineProperty(ctx, 'state', {
    get: () => liveState,
    set: (next) => { setState(next); },
    configurable: true,
    enumerable: true,
  });

  // ---- 3. create every domain, then publish them, then init -------------
  // (init after publish so a domain can reach its siblings)
  const services = [];
  let step = 0.54;
  for (const [key, factory] of DOMAIN_SPECS) {
    try {
      if (typeof factory !== 'function') throw new Error(`${key} has no factory`);
      const svc = factory(ctx);
      services.push([key, svc]);
      ctx.domains[key] = svc;
    } catch (err) {
      log(`domain "${key}" unavailable: ${err && err.message}`);
    }
    step += 0.04;
    setProgress(step, `starting ${key}…`);
  }

  for (const [key, svc] of services) {
    try {
      if (svc && typeof svc.init === 'function') await svc.init();
      log(`domain "${key}" ready`);
    } catch (err) {
      log(`domain "${key}" init failed: ${err && err.message}`);
    }
  }

  ctx.core = { ...CORE_MODULES };

  ctx.ui = ctx.domains.ui || null;

  // ---- 3b. the placement gate ----------------------------------------------
  // BLD only asks the economy whether the player can AFFORD a building. The
  // economy also owns the construction-slot ledger (FR-ECO-120/121): a new
  // building may only START when a free construction slot exists, and a
  // refused placement must not be charged. This coordinator puts the full
  // `economy.canPlace(def, level)` gate in front of every placement.
  const placementGate = installPlacementGate(ctx);

  // ---- 4. audio (optional) ----------------------------------------------
  try {
    const audioMod = await import('./audio/audio.js');
    ctx.audio = audioMod.createAudio(ctx);
  } catch (err) {
    log(`audio unavailable: ${err && err.message}`);
  }

  // ---- 5. mount the HUD --------------------------------------------------
  if (ctx.ui && typeof ctx.ui.mount === 'function') {
    try {
      ctx.ui.mount(uiRoot);
    } catch (err) {
      log(`UI mount failed: ${err && err.message}`);
    }
  }

  // ---- 6. frame loop -----------------------------------------------------
  // `stepGame(dt)` is the single simulation entry point. The frame loop calls
  // it with scaled game time; the integration harness calls it directly with
  // a fixed step, so the simulation is frame-rate independent and testable.
  const DAY_SECONDS = 60;
  let dayAccum = 0;

  function stepGame(gameDt) {
    if (!(gameDt > 0)) return;
    dayAccum += gameDt;
    if (dayAccum >= DAY_SECONDS) {
      dayAccum -= DAY_SECONDS;
      liveState.meta.day += 1;
      emit(EVENTS.DAY_CHANGED, { day: liveState.meta.day });
      if (ctx.core.modes?.advanceDay) ctx.core.modes.advanceDay(liveState);
    }
    liveState.meta.elapsed += gameDt;
    liveState.meta.tick += 1;
    for (const [key, svc] of services) {
      if (!svc) continue;
      try {
        svc.tick?.(gameDt);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[loop] domain "${key}" tick threw:`, err);
      }
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);   // clamp: a stall must not fast-forward the sim
    last = now;

    const speed = liveState.meta.speed;
    const gameDt = liveState.meta.paused ? 0 : dt * speed;

    for (const [key, svc] of services) {
      if (!svc) continue;
      try {
        svc.update?.(dt);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[loop] domain "${key}" update threw:`, err);
      }
    }

    stepGame(gameDt);
    renderer.update(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Adaptive quality: drop shadows / post FX / pixel ratio when the frame
  // rate will not hold. (No-op on a real GPU, essential on weak hardware.)
  // NOTE: the renderer owns the live adaptive-quality driver (it updates it
  // inside renderer.update). This is a READ-ONLY reference for the
  // integrator. Do not add a second update loop here - two drivers fight.

  // ---- 7. input ----------------------------------------------------------
  installInput(ctx, renderer);

  // ---- 7b. reload the view of a loaded city ------------------------------
  installLoadRelay(ctx);

  // ---- 8. stage evaluation on a timer ------------------------------------
  setInterval(() => {
    if (!ctx.core.stage) return;
    try {
      const evaln = ctx.core.stage.evaluateStage(liveState);
      if (evaln.allMet && ctx.core.stage.advanceStage(liveState)) {
        log(`stage advanced -> ${liveState.meta.stageId}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[stage]', err);
    }
  }, 2000);

  // ---- 9. boot complete --------------------------------------------------
  liveState.meta.ready = true;
  emit(EVENTS.GAME_READY, { ctx });
  setProgress(1, 'ready');
  setTimeout(() => bootEl?.classList.add('hidden'), 350);

  window.SUPERCITYCON = {
    ctx, renderer, assetService,
    /**
     * The live state tree — a GETTER, not a snapshot.
     *
     * `setState()` REPLACES the tree, so a copied value would go stale the
     * moment a save is loaded.
     */
    get state() { return liveState; },
    resetState, createState, setState, bootLog,
    /** Deterministic fixed-step simulation hook used by the test harness. */
    step: (dt) => stepGame(dt),
    /** The placement gate (see `installPlacementGate`). */
    placementGate,
    THREE,
  };
  log('boot complete');
}

/**
 * ---------------------------------------------------------------------------
 * The placement gate
 * ---------------------------------------------------------------------------
 *
 * `buildings.place()` checks one thing: whether the player can afford the
 * building. The economy owns a second, independent gate — the construction
 * slot ledger (FR-ECO-120/121). A building may only be started when a free
 * slot exists; when it may not, the placement is REFUSED and the cost is not
 * deducted.
 *
 * This is a thin coordinator. It wraps `buildings.place` so that every
 * placement path — the shop, a world click, or a script — passes the full
 * `economy.canPlace(def, level)` check first, and so that a refusal reaches
 * the player as a toast instead of vanishing silently.
 *
 * It lives here, in the integrator's bootstrap, because `src/buildings/` and
 * `src/economy/` are owned by other domains: the buildings domain must not
 * know about the economy's internals, and the economy domain must not reach
 * into the buildings domain.
 *
 * @param {object} ctx the shared context
 * @returns {Function|null} the gated `place`, or null when there is nothing to gate
 */
function installPlacementGate(ctx) {
  const bld = ctx.domains?.buildings;
  if (!bld || typeof bld.place !== 'function') return null;
  // Never wrap twice: main() can run again after a reload.
  if (bld.place.__scPlacementGate) return bld.place;

  const rawPlace = bld.place.bind(bld);

  /** The catalogue definition for a type id, or null when it is unknown. */
  function definitionOf(typeId) {
    let raw = null;
    try { raw = bld.catalogue?.(); } catch { raw = null; }
    const list = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === 'object' ? Object.values(raw) : []);
    return list.find((d) => d && d.id === typeId) ?? null;
  }

  /** The player-facing explanation for a refusal. */
  function refusalMessage(def, gate) {
    const name = def?.displayName || def?.id || 'that building';
    if (gate.reason === 'not-enough-slots') {
      const required = Number.isFinite(gate.required) ? gate.required : 1;
      const free = Number.isFinite(gate.free) ? gate.free : 0;
      return `No construction slot free — ${name} needs ${required} `
        + `slot${required === 1 ? '' : 's'} (${free} free).`;
    }
    if (gate.reason === 'insufficient-funds') {
      const cost = Number.isFinite(gate.cost) ? gate.cost : null;
      return cost === null
        ? `Not enough coins for ${name}.`
        : `Not enough coins for ${name} — ${cost} needed.`;
    }
    return `Cannot build ${name} — ${gate.reason ?? 'not allowed'}.`;
  }

  /**
   * The gated `place`.
   * @returns {{ok:boolean, reason:string|null, id:number|null}}
   */
  function gatedPlace(typeId, cx, cz, rot = 0) {
    const eco = ctx.domains?.economy;
    if (!eco || typeof eco.canPlace !== 'function') {
      return rawPlace(typeId, cx, cz, rot);
    }
    const def = definitionOf(typeId);
    // An unknown type id is BLD's business: it reports 'unknown-building'.
    if (!def) return rawPlace(typeId, cx, cz, rot);

    let gate = null;
    try {
      gate = eco.canPlace(def, 1);
    } catch {
      // A broken economy must never block building.
      return rawPlace(typeId, cx, cz, rot);
    }
    if (!gate || gate.ok) return rawPlace(typeId, cx, cz, rot);

    // Refused. Tell the player why, and do not charge them.
    try {
      ctx.ui?.showToast?.(refusalMessage(def, gate), 'warn');
    } catch {
      /* the HUD is optional */
    }
    return { ok: false, reason: gate.reason ?? 'not-allowed', id: null };
  }

  gatedPlace.__scPlacementGate = true;
  gatedPlace.__scRawPlace = rawPlace;
  bld.place = gatedPlace;
  return gatedPlace;
}

/**
 * Pointer + keyboard input.
 *
 * OWNERSHIP: the UX domain owns the **camera** — its rig (`src/ui/camera.js`)
 * binds the canvas pointer/wheel events and the window keyboard, and pushes
 * yaw / pitch / distance to the renderer every frame. This function must NOT
 * write camera state, or the two will fight (the integrator's earlier version
 * mixed radians and degrees in `setPitch` and slammed the pitch to 15°).
 *
 * What lives here is only what no domain owns:
 *   - the pointer position -> grid cell conversion,
 *   - the dispatch of that cell to every domain's `onHover` / `onClick`,
 *   - the speed / pause keyboard shortcuts, routed through CORE.
 */
function installInput(ctx, renderer) {
  const el = renderer.renderer.domElement;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let moved = 0;

  el.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
  });
  el.addEventListener('pointerup', (e) => {
    dragging = false;
    if (moved < 6) handleClick(ctx, e);
  });
  el.addEventListener('pointermove', (e) => {
    moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
    handleHover(ctx, e);
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  // The KEYBOARD scheme belongs to the UX layer: plain 1-7 select a tool,
  // Shift+1-4 set the speed, Space pauses, Ctrl+S saves. This file used to
  // bind the digit keys to the speed as well, so pressing "2" for Build also
  // forced Normal speed. One owner per key.
}

function cellFromEvent(ctx, e) {
  const hit = ctx.renderer.screenToGround(e.clientX, e.clientY);
  if (!hit) return null;
  const c = worldToCellInt(hit.x, hit.z);
  if (!inBounds(c.x, c.z)) return { x: c.x, z: c.z, outOfBounds: true };
  return c;
}

function handleHover(ctx, e) {
  const cell = cellFromEvent(ctx, e);
  ctx.state.ui.hover = cell;
  for (const svc of Object.values(ctx.domains)) svc?.onHover?.(cell);
  emit(EVENTS.HOVER_CHANGED, cell);
}

function handleClick(ctx, e) {
  const cell = cellFromEvent(ctx, e);
  if (!cell) return;
  for (const svc of Object.values(ctx.domains)) svc?.onClick?.(cell, e.button);
}

/**
 * ---------------------------------------------------------------------------
 * The load relay
 * ---------------------------------------------------------------------------
 *
 * `save.loadFromStorage()` restores the STATE tree, but the 3D view of that
 * tree lives in the domains: BLD owns the building models and rebuilds them
 * only inside its own `init()`. Nothing re-runs that after a load, so a
 * loaded city shows an empty map even though every counter is correct.
 *
 * The integrator is the only place that sees the load, so it asks the domains
 * that hold a view of the loaded state to rebuild that view.
 *
 * WLD is deliberately NOT re-initialised: its `init()` regenerates the
 * terrain from the seed, which would destroy the world that was just loaded.
 *
 * @param {object} ctx the shared context
 */
function installLoadRelay(ctx) {
  on(EVENTS.GAME_LOADED, () => {
    for (const key of ['buildings', 'mobility']) {
      const svc = ctx.domains?.[key];
      if (!svc || typeof svc.init !== 'function') continue;
      try {
        svc.init();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[load] domain "${key}" could not rebuild after a load:`, err);
      }
    }
  });
}

// The auto-boot only runs when the page really provides a viewport. The
// integration test imports this module for its pure helpers, and Node has no
// viewport to boot into.
if (hasDom && document.getElementById('viewport')) {
  main().catch(fatal);
}

export { cellCenter, installPlacementGate };