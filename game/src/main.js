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
import { createContent } from './content/index.js';
import { createHazards } from './hazards/index.js';
import * as coreStage from './core/stage.js';
import * as coreSave from './core/save.js';
import * as coreModes from './core/modes.js';
import { EVENTS, emit, on, off, once, clearAll } from './core/events.js';
import { createLogger, installGlobalHandlers, buildIdentity } from './core/log.js';
import { createSettings } from './core/settings.js';
import { createInputMap } from './core/input-map.js';
import { createProgress } from './core/progress.js';
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
  ['content', createContent],
  ['hazards', createHazards],
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
  // The logger is created BEFORE anything else, so every later subsystem can
  // record what it did with a severity, a category and a context object.
  const logger = createLogger({
    category: 'game',
    level: 'info',
    build: buildIdentity(),
  });
  const uninstallGlobalHandlers = installGlobalHandlers(logger);

  // The user's settings: audio levels, display options, accessibility
  // options and the key bindings. They are a user preference, so they live
  // in their own localStorage record and never inside a save.
  const settings = createSettings({ storage: globalThis.localStorage ?? null, logger });
  settings.load();

  // One table of key bindings for the whole game, so a key can be rebound
  // and the on-screen hints are generated from the same source.
  const inputMap = createInputMap({ bindings: settings.get('input.bindings') });

  const ctx = {
    bus: { on, off, once, emit },
    assets: assetService,
    renderer,
    logger,
    settings,
    inputMap,
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
    /**
     * Send a click on a world cell to every domain.
     *
     * The MOUSE path has always done this in `installInput()`. V7 gives the
     * TOUCH path the same dispatcher, so a tap and a click cannot drift
     * apart: the same domain receives the same cell and the same button.
     *
     * @param {{x:number,z:number}} cell
     * @param {number} [button] 0 = the primary button
     * @returns {boolean} true when the cell was dispatched
     */
    dispatchWorldClick(cell, button = 0) {
      if (!cell) return false;
      for (const svc of Object.values(ctx.domains)) svc?.onClick?.(cell, button);
      return true;
    },
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

  // The progression record: checkpoints, collectibles and achievements. It
  // lives in `state.meta.progress`, so it travels with the save.
  ctx.progress = createProgress(ctx);

  // ---- 3b. the placement gate ----------------------------------------------
  // BLD only asks the economy whether the player can AFFORD a building. The
  // economy also owns the construction-slot ledger (FR-ECO-120/121): a new
  // building may only START when a free construction slot exists, and a
  // refused placement must not be charged. This coordinator puts the full
  // `economy.canPlace(def, level)` gate in front of every placement.
  const placementGate = installPlacementGate(ctx);

  // ---- 4. audio (optional) ----------------------------------------------
  let uninstallAudioUnlock;
  try {
    const audioMod = await import('./audio/audio.js');
    ctx.audio = audioMod.createAudio(ctx);
    applyAudioSettings(ctx);
    uninstallAudioUnlock = installAudioFeedback(ctx);
  } catch (err) {
    log(`audio unavailable: ${err && err.message}`);
  }

  // ---- 4b. the settings are the player's, and they apply immediately ------
  settings.onChange((key) => {
    emit(EVENTS.SETTINGS_CHANGED, { key, value: settings.get(key) });
    if (key.startsWith('audio.')) applyAudioSettings(ctx);
    if (key === 'input.bindings') inputMap.applyOverrides(settings.get('input.bindings'));
    if (key === 'accessibility.reducedEffects') applyAccessibilitySettings(ctx);
  });

  // ---- 4c. visual feedback ----------------------------------------------
  // The VFX service knows how to build each effect; this connects it to the
  // events that describe where those effects belong.
  installFxFeedback(ctx);
  applyAccessibilitySettings(ctx);

  // ---- 5. mount the HUD --------------------------------------------------
  if (ctx.ui && typeof ctx.ui.mount === 'function') {
    try {
      ctx.ui.mount(uiRoot);
    } catch (err) {
      log(`UI mount failed: ${err && err.message}`);
    }
  }

  // ---- 6. frame loop -----------------------------------------------------
  // The simulation runs on a FIXED step, and the presentation runs on the
  // real frame time.
  //
  // Two clocks used to exist and both were wrong in different ways:
  //
  //   - this file kept its own day counter (`dayAccum`) AND called CORE's
  //     `advanceDay`, so every day boundary incremented the counter TWICE and
  //     emitted DAY_CHANGED twice with two different payload shapes;
  //   - the live loop passed a variable `dt` straight to the domains, so a
  //     domain that decayed a value by `RATE * dt` per tick decayed it at
  //     the user's monitor refresh rate rather than in game time.
  //
  // V5 has ONE clock — CORE's `advanceClock`, which owns the elapsed time,
  // the day counter and the year — and ONE fixed simulation step. The
  // domains are ticked a whole number of times per frame with exactly
  // TUNING.fixedStep of game time each, so the same inputs always produce the
  // same result whatever the frame rate.
  /** How many fixed steps one call to the deterministic test hook may run. */
  const MAX_STEPS_PER_CALL = 600;

  // The dome is repainted from vertex colours, so it is refreshed on a
  // throttle rather than every frame: a full day lasts 60 real seconds at
  // normal speed, so this is still far smoother than the eye needs.
  let lastSkyT = null;
  function updateSky() {
    const t = coreModes.timeOfDay(liveState);
    if (lastSkyT !== null && Math.abs(t - lastSkyT) < TUNING.skyRepaintStep) return;
    lastSkyT = t;
    try {
      renderer.setTimeOfDay(t);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[sky] could not set the time of day:', err);
    }
  }

  // Refresh the renderer before the HUD redraws the clock preset panel.
  on(EVENTS.TIME_SEEKED, (request) => {
    if (!coreModes.seekTimeOfDay(request?.t, liveState)) return;
    lastSkyT = null;
    updateSky();
  });

  /**
   * One fixed simulation step.
   *
   * CORE's `advanceClock` is the ONLY clock: it owns the elapsed time, the
   * tick counter, the day counter and the year, and it emits DAY_CHANGED
   * exactly once per day boundary with a consistent payload. The previous
   * code kept a second day counter here as well, so every day boundary
   * incremented the counter twice and emitted the event twice.
   */
  function simulate(fixedDt) {
    if (ctx.core.modes?.advanceClock) {
      ctx.core.modes.advanceClock(liveState, fixedDt);
    } else {
      // CORE is always present, but the game must still run if it is not.
      liveState.meta.elapsed = (liveState.meta.elapsed ?? 0) + fixedDt;
      liveState.meta.tick = (liveState.meta.tick ?? 0) + 1;
    }
    for (const [key, svc] of services) {
      if (!svc) continue;
      try {
        svc.tick?.(fixedDt);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[loop] domain "${key}" tick threw:`, err);
      }
    }
  }

  const stepGame = coreModes.createFixedStepRunner(simulate);

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
    updateSky();
    renderer.update(dt);
    rafId = requestAnimationFrame(frame);
  }
  let rafId = requestAnimationFrame(frame);

  // Adaptive quality: drop shadows / post FX / pixel ratio when the frame
  // rate will not hold. (No-op on a real GPU, essential on weak hardware.)
  // NOTE: the renderer owns the live adaptive-quality driver (it updates it
  // inside renderer.update). This is a READ-ONLY reference for the
  // integrator. Do not add a second update loop here - two drivers fight.

  // ---- 7. input ----------------------------------------------------------
  const uninstallInput = installInput(ctx, renderer);

  // ---- 7b. reload the view of a loaded city ------------------------------
  installLoadRelay(ctx);

  // ---- 8. stage evaluation on a timer ------------------------------------
  // The timer is kept so it can be CLEARED on teardown. V4 started this
  // interval and never cancelled it, so a reload left the old timer running
  // alongside the new one.
  const stageTimer = setInterval(() => {
    if (!ctx.core.stage) return;
    try {
      const evaln = ctx.core.stage.evaluateStage(liveState);
      if (evaln.allMet && ctx.core.stage.advanceStage(liveState)) {
        logger.info('the city advanced to the next stage', { stage: liveState.meta.stageId });
      }
    } catch (err) {
      logger.exception(err, { subsystem: 'stage' });
    }
  }, 2000);

  // ---- 8b. teardown -------------------------------------------------------
  // Every domain exposes a `dispose()`, but nothing ever called one: there
  // was no teardown path at all, so the frame loop, the stage timer, the
  // event bus and every GPU resource outlived the page they belonged to.
  let disposed = false;
  let bootTimer;
  function dispose() {
    if (disposed) return false;
    disposed = true;
    try { clearInterval(stageTimer); } catch { /* optional */ }
    try { cancelAnimationFrame(rafId); } catch { /* optional */ }
    clearTimeout(bootTimer);
    uninstallInput();
    uninstallAudioUnlock?.();
    uninstallGlobalHandlers();
    for (const [key, svc] of services) {
      try {
        svc?.dispose?.();
      } catch (err) {
        logger.exception(err, { subsystem: key, phase: 'dispose' });
      }
    }
    try { ctx.audio?.dispose?.(); } catch { /* optional */ }
    try { renderer.dispose(); } catch (err) {
      logger.exception(err, { subsystem: 'renderer', phase: 'dispose' });
    }
    try { assetService.disposeAssets(); } catch (err) {
      logger.exception(err, { subsystem: 'assets', phase: 'dispose' });
    }
    try { clearAll(); } catch { /* optional */ }
    try { settings.dispose?.(); } catch { /* optional */ }
    if (window.SUPERCITYCON?.ctx === ctx) delete window.SUPERCITYCON;
    logger.info('the game was torn down', { domains: services.length });
    return true;
  }

  // ---- 9. boot complete --------------------------------------------------
  liveState.meta.ready = true;
  emit(EVENTS.GAME_READY, { ctx });
  setProgress(1, 'ready');
  bootTimer = setTimeout(() => bootEl?.classList.add('hidden'), 350);

  window.SUPERCITYCON = {
    ctx, renderer, assetService,
    /**
     * The V5 services: the logger, the player's settings, the key bindings
     * and the progression record. They are published so the diagnostics
     * surface and the acceptance harness can read them.
     */
    logger, settings, inputMap, progress: ctx.progress,
    /** The content domain: the level library, the validator and the loader. */
    content: ctx.domains.content ?? null,
    /** The hazard domain: the multi-phase city crises. */
    hazards: ctx.domains.hazards ?? null,
    /**
     * Load a level by id: the terrain seed, the starting city, the hazards
     * and the progression links. Returns what was applied and what was
     * skipped, so a caller can report a partial load honestly.
     */
    loadLevel: (id) => ctx.domains.content?.apply?.(id) ?? { ok: false, applied: 0, skipped: [] },
    /** Tear the game down: the loop, the timer, the bus and every domain. */
    dispose,
    /** A diagnostic snapshot of the running game. */
    diagnostics() {
      return {
        build: buildIdentity(),
        summary: logger.summary(),
        settings: settings.all(),
        progress: ctx.progress?.summary?.() ?? null,
        hazards: ctx.domains.hazards?.resolved?.()?.length ?? 0,
        // The hazards that are running right now, and the effect each one is
        // drawing. This is the quickest way to tell "the hazard is not
        // happening" from "the hazard is happening but nobody can see it".
        activeHazards: (ctx.domains.hazards?.active?.() ?? []).map((h) => {
          const def = (ctx.domains.hazards?.defs?.() ?? []).find((d) => d && d.id === h?.id);
          return {
            id: h?.id ?? null,
            type: def?.type ?? null,
            phase: h?.phaseIndex ?? null,
            status: h?.status ?? null,
            effect: hazardEffectKind(def?.type),
          };
        }),
        level: liveState.meta.levelId ?? null,
        performance: renderer.getPerformance?.() ?? null,
        mode: liveState.meta.mode,
        day: liveState.meta.day,
        stage: liveState.meta.stageId,
        paused: !!liveState.meta.paused,
        speed: liveState.meta.speed,
        timeOfDay: coreModes.timeOfDay(liveState),
      };
    },
    /**
     * The live state tree — a GETTER, not a snapshot.
     *
     * `setState()` REPLACES the tree, so a copied value would go stale the
     * moment a save is loaded.
     */
    get state() { return liveState; },
    resetState, createState, setState, bootLog,
    /**
     * Deterministic fixed-step simulation hook used by the test harness.
     *
     * It advances the game by real seconds of game time, in whole fixed
     * steps, with a generous catch-up bound: the harness fast-forwards the
     * city, so it must be allowed to run many steps in one call.
     */
    step: (dt) => stepGame(dt, MAX_STEPS_PER_CALL),
    /** The placement gate (see `installPlacementGate`). */
    placementGate,
    THREE,
  };
  log('boot complete');
}

/**
 * ---------------------------------------------------------------------------
 * Audio
 * ---------------------------------------------------------------------------
 *
 * The mixer in `src/audio/audio.js` is a complete procedural synthesiser
 * with a master bus and five category buses. V4 built it and then never
 * called it: there was not a single `play()` call site in the project, so the
 * game ran in silence and the `state.ui.muted` flag was dead.
 *
 * V5 connects it. The mixer is driven from the game's own event bus, so a
 * sound is played where the thing it describes happens — not scattered
 * through the domains as individual calls.
 */

/**
 * Push the player's audio settings into the mixer.
 *
 * @param {object} ctx
 */
function applyAudioSettings(ctx) {
  const audio = ctx?.audio;
  if (!audio) return;
  const settings = ctx?.settings;
  if (!settings) return;
  try {
    for (const bus of ['master', 'music', 'sfx', 'ambience', 'ui']) {
      const value = settings.get(`audio.${bus}`);
      if (typeof value === 'number') audio.setBusVolume?.(bus, value);
    }
    audio.setMuted?.(!!settings.get('audio.muted'));
  } catch (err) {
    ctx?.logger?.warn?.('the audio settings could not be applied', {
      error: String(err?.message ?? err),
    });
  }
}

/**
 * Play the game's sounds.
 *
 * The mapping is deliberately small and explicit: a sound is named after the
 * event that causes it. Anything that happens often is throttled, so a busy
 * frame cannot machine-gun the mixer.
 *
 * @param {object} ctx
 */
function installAudioFeedback(ctx) {
  const audio = ctx?.audio;
  if (!audio) return;

  // The browser will not start an audio context without a gesture, so the
  // first one unlocks the mixer. Until then the game is silent — it never
  // depends on the audio succeeding.
  let unlocked = false;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    try {
      audio.unlock?.();
      ctx?.logger?.debug?.('the audio context was unlocked');
    } catch (err) {
      ctx?.logger?.warn?.('the audio context could not be unlocked', {
        error: String(err?.message ?? err),
      });
    }
  };
  for (const evt of ['pointerdown', 'keydown']) {
    try { globalThis.addEventListener?.(evt, unlock, { once: true, passive: true }); } catch { /* optional */ }
  }

  // The events that carry a sound. A missing sound name is ignored by the
  // mixer itself, so an unmapped event is harmless.
  const SOUNDS = [
    [EVENTS.BUILDING_PLACED, 'place'],
    [EVENTS.BUILDING_REMOVED, 'bulldoze'],
    [EVENTS.BUILDING_UPGRADED, 'level-up'],
    [EVENTS.DAY_CHANGED, 'day-change'],
    [EVENTS.TOAST, 'error'],
    [EVENTS.CHECKPOINT_REACHED, 'confirm'],
    [EVENTS.COLLECTIBLE_FOUND, 'confirm'],
    [EVENTS.ACHIEVEMENT_UNLOCKED, 'level-up'],
    [EVENTS.HAZARD_STARTED, 'alert'],
    [EVENTS.HAZARD_RESOLVED, 'confirm'],
    [EVENTS.MODE_CHANGED, 'confirm'],
  ];

  for (const [evt, sound] of SOUNDS) {
    on(evt, () => {
      try {
        audio.play?.(sound);
      } catch (err) {
        ctx?.logger?.warn?.('a sound could not be played', {
          sound, error: String(err?.message ?? err),
        });
      }
    });
  }

  // The interface sounds are driven by the UI's own events, so a click does
  // not have to travel through the domain layer to be heard.
  on(EVENTS.TOOL_CHANGED, () => { try { audio.play?.('click'); } catch { /* optional */ } });
  on(EVENTS.OPEN_PANEL, () => { try { audio.play?.('click'); } catch { /* optional */ } });
  on(EVENTS.CLOSE_PANEL, () => { try { audio.play?.('cancel'); } catch { /* optional */ } });
  return () => {
    for (const evt of ['pointerdown', 'keydown']) globalThis.removeEventListener?.(evt, unlock);
  };
}

/**
 * Push the player's accessibility settings into the presentation layer.
 *
 * The VFX service is the only subsystem that can honour "reduced visual
 * effects" today: it shortens the particle lifetimes, shrinks the particles
 * and spawns fewer of them. Screen shake is the renderer's business, and it
 * is applied there when the renderer exposes the switch.
 *
 * @param {object} ctx
 */
function applyAccessibilitySettings(ctx) {
  const settings = ctx?.settings;
  if (!settings) return;
  const reduced = !!settings.get('accessibility.reducedEffects');
  try {
    ctx?.renderer?.fx?.setReducedMotion?.(reduced);
  } catch {
    /* the FX service is optional */
  }
  try {
    const renderer = ctx?.renderer;
    if (typeof renderer?.setReducedShake === 'function') {
      renderer.setReducedShake(!!settings.get('accessibility.reducedShake'));
    }
  } catch {
    /* the renderer is optional */
  }
}

/**
 * ---------------------------------------------------------------------------
 * Visual feedback
 * ---------------------------------------------------------------------------
 *
 * The VFX service (`renderer.fx`) knows how to build a pooled, instanced
 * particle effect for each kind of event — a building goes down, the city
 * levels up, a checkpoint is reached, a hazard erupts. What it did NOT know
 * is WHERE those things happen, because that knowledge lives in the domains.
 *
 * This installer is the bridge. It listens to the game's own event bus and
 * spawns the right effect at the right place, so the effect is always
 * produced by the thing it describes rather than sprinkled through the
 * domains as individual calls.
 *
 * Every spawn is defensive: an effect that cannot be placed is dropped, never
 * allowed to break the frame loop.
 *
 * @param {object} ctx
 */
function installFxFeedback(ctx) {
  const fx = ctx?.renderer?.fx;
  if (!fx || typeof fx.spawn !== 'function') return false;

  /**
   * Spawn an effect at a cell, if the effect service is there.
   *
   * The effect goes on the GROUND, not at world y = 0. The terrain has real
   * elevation, so an effect placed at y = 0 is buried inside any raised
   * ground — a wildfire on a hill burns underground where nobody can see it.
   * The WORLD domain publishes `heightAt(cx, cz)` in world-space units (the
   * same units the buildings use to sit on the terrain), so the effect and
   * the building it marks always agree.
   */
  function at(kind, cx, cz, opts = {}) {
    try {
      const cellX = Math.round(Number(cx) || 0);
      const cellZ = Math.round(Number(cz) || 0);
      let y = Number.isFinite(opts.y) ? opts.y : null;
      if (y === null) {
        const ground = ctx?.domains?.wld?.heightAt?.(cellX, cellZ);
        // A small lift so the base of the effect clears the ground it sits on.
        y = (Number.isFinite(ground) ? ground : 0) + 0.2;
      }
      const position = cellCenter(cellX, cellZ, y);
      fx.spawn(kind, { position, ...opts });
    } catch {
      /* an effect that cannot be placed is dropped, never fatal */
    }
  }

  // -- the city changes ---------------------------------------------------
  on(EVENTS.BUILDING_PLACED, (payload) => {
    at('place', payload?.x, payload?.z);
  });

  on(EVENTS.BUILDING_REMOVED, (payload) => {
    at('bulldoze', payload?.x, payload?.z);
  });

  on(EVENTS.BUILDING_UPGRADED, (payload) => {
    at('level-up', payload?.x, payload?.z);
  });

  // -- the player's progress ----------------------------------------------
  on(EVENTS.CHECKPOINT_REACHED, (payload) => {
    const cp = ctx?.content?.checkpointStatus?.().find((c) => c.id === payload?.id);
    if (cp) at('checkpoint', cp.x, cp.z);
  });

  on(EVENTS.ACHIEVEMENT_UNLOCKED, () => {
    // An achievement has no position of its own — it is shown at the middle
    // of the city, which is where the camera usually is.
    at('achievement', 32, 32);
  });

  // -- the hazards --------------------------------------------------------
  // The HAZARD DOMAIN owns its own visuals: it knows the phase cadence and
  // pulses the effect itself, on the ground its cell actually sits on (see
  // `groundY` in hazards/index.js). The bridge used to add a second burst on
  // HAZARD_STARTED / HAZARD_PHASE / HAZARD_DAMAGE as well, which doubled the
  // effect and put one of the two copies underground at world y = 0. One
  // owner, one effect, in the right place.

  // -- the player asks for something impossible ----------------------------
  on(EVENTS.TOAST, (payload) => {
    if (payload?.kind !== 'error' && payload?.kind !== 'warn') return;
    at('warning', 32, 32, { scale: 0.5 });
  });

  return true;
}

/**
 * The effect kind that matches a hazard type.
 *
 * The hazard domain maps its own types to effect kinds (see `FX_BY_TYPE` in
 * hazards/index.js) because it owns the hazard's visuals. This table is kept
 * for the diagnostics surface, which reports what a hazard WOULD look like.
 *
 * @param {string} type
 * @returns {string}
 */
function hazardEffectKind(type) {
  switch (type) {
    case 'wildfire':
    case 'heatwave':
      return 'hazard-fire';
    case 'flood':
    case 'blight':
      return 'hazard-water';
    case 'outage':
    case 'earthquake':
      return 'hazard-smoke';
    default:
      return 'warning';
  }
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

  const pointerDown = (e) => {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
  };
  const pointerUp = (e) => {
    dragging = false;
    if (moved < 6) handleClick(ctx, e);
  };
  const pointerMove = (e) => {
    moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
    handleHover(ctx, e);
  };
  const listeners = {
    pointerdown: pointerDown, pointerup: pointerUp, pointermove: pointerMove,
    contextmenu: (e) => e.preventDefault(),
  };
  for (const [type, listener] of Object.entries(listeners)) el.addEventListener(type, listener);

  // The KEYBOARD scheme belongs to the UX layer: plain 1-7 select a tool,
  // Shift+1-4 set the speed, Space pauses, Ctrl+S saves. This file used to
  // bind the digit keys to the speed as well, so pressing "2" for Build also
  // forced Normal speed. One owner per key.
  return () => {
    for (const [type, listener] of Object.entries(listeners)) el.removeEventListener(type, listener);
  };
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
  ctx.dispatchWorldClick?.(cell, e.button);
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
 * WLD rebuilds its view directly from the loaded terrain and scenery.
 *
 * @param {object} ctx the shared context
 */
function installLoadRelay(ctx) {
  async function rebuild(key, method = 'init') {
    try {
      await ctx.domains?.[key]?.[method]?.();
    } catch (err) {
      ctx.logger.exception(err, { subsystem: key, phase: method });
    }
  }

  on(EVENTS.GAME_LOADED, () => {
    void rebuild('wld', 'restoreView');
    void rebuild('buildings');
    // Roads at the same coordinates may have a different terrain height.
    void rebuild('mobility', 'dispose');
    void rebuild('mobility');
  });

  on(EVENTS.GAME_RESET, ({ levelId } = {}) => {
    // Authored maps own their ordered terrain and placement pipeline.
    if (levelId || ctx.domains?.content?.isLoading()) return;
    liveState.meta.ready = true;
    void rebuild('wld', 'generate');
    void rebuild('buildings');
    void rebuild('economy');
    void rebuild('mobility');
  });
}

// The auto-boot only runs when the page really provides a viewport. The
// integration test imports this module for its pure helpers, and Node has no
// viewport to boot into.
if (hasDom && document.getElementById('viewport')) {
  main().catch(fatal);
}

export { cellCenter, installPlacementGate, installFxFeedback };
