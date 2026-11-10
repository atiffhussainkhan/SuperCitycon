/**
 * ui/index.js — the UX domain factory (FR-UX-001 … FR-UX-142).
 *
 * OWNER: UX (BOT-09). Public API is fixed by `core/CONTRACT.md` §7:
 *
 *   export function createUI(ctx) -> {
 *     init, update, mount(el), unmount(),
 *     setTool(tool), setSelection(sel),
 *     showToast(msg, kind), openPanel(id), closePanel(), panel(),
 *     camera: { focus(x,z), zoomTo(d), rotate(delta), reset() },
 *     hoverCell, dispose };
 *   export { HUD_STYLES } from './styles.js';
 *
 * THE DIVISION OF LABOUR
 *   styles.js  — the CSS (the 16-bit look).
 *   panels.js  — PURE models of what the player sees (no DOM, no three).
 *   toasts.js  — PURE notification queue (FIFO, blocking-alert aware).
 *   camera.js  — the camera rig (damping + the control scheme). It uses the
 *                renderer's own API; it never re-implements the camera.
 *   hud.js     — the DOM: builds the markup, binds every control.
 *   index.js   — this file: wires the above together and owns `state.ui`.
 *
 * HONESTY DISCIPLINE
 *   - Every number on screen is read live from `state` (or a domain's public
 *     getter) on each update. Nothing is cached.
 *   - A domain that is not present yields a neutral `—`, never a fake 0.
 *   - Values the dossier marks TBD are shown as assumed values.
 *   - The curated 2D art is OPTIONAL: the HUD is complete without it, and
 *     the licence-pending note appears only when the art is actually used.
 */

import { TOOLS, SPEED } from '../core/config.js';
import { EVENTS } from '../core/events.js';
import { createHUD } from './hud.js';
import { createCameraRig } from './camera.js';
import { createGamepadService } from './gamepad.js';
import { createTouchService } from './touch.js';
import { createNavigationDebug } from './navigation-debug.js';
import { createToastQueue } from './toasts.js';
import { createMenu } from './menu.js';
import { createSettingsPanel } from './settings-panel.js';
import { ensureStyles, HUD_STYLES } from './styles.js';
import { liveStateProxy } from '../core/state.js';

/**
 * Tools whose CLICK is dispatched by a sibling domain that owns its own
 * `onClick` handler. The UX layer must not duplicate those actions, or the
 * city would receive two clicks per press.
 */
const TOOLS_OWNED_ELSEWHERE = Object.freeze(new Set([
  TOOLS.build,      // BLD: buildings/index.js onClick places / demolishes
  TOOLS.bulldoze,   // BLD
  TOOLS.terraform,   // WLD: world/index.js onClick raises / lowers terrain
]));

/**
 * Tools the UX layer drives itself, because no sibling domain claims them.
 * Each entry names the domain and the method to call.
 */
const TOOL_DISPATCH = Object.freeze({
  [TOOLS.road]: { domain: 'mobility', method: 'addRoad', args: (cell) => [cell.x, cell.z] },
  [TOOLS.paint]: { domain: 'buildings', method: 'paintZone', args: (cell) => [cell.x, cell.z, 'residential'] },
});

/**
 * Create the UX service.
 * @param {object} ctx the shared context
 */
export function createUI(ctx) {
  /**
   * The live state tree.
   *
   * `ctx.state` is a GETTER in main.js (core/state.js `setState()` REPLACES
   * the state object when a save is loaded or the game is reset), so a
   * captured `ctx.state` would be an ORPHANED tree. The HUD would keep
   * reading numbers from a tree nobody updates.
   */
  const state = liveStateProxy(ctx);
  const bus = ctx?.bus;
  const domains = ctx?.domains ?? {};

  ensureStyles(typeof document !== 'undefined' ? document : null);

  const toasts = createToastQueue({ ttl: 4.5 });

  // The settings panel owns the SCHEMA-driven rows and the live effects
  // (audio mixer, renderer, stylesheet). It is created BEFORE the camera
  // rig on purpose: its key-capture listener has to be the first one on the
  // window, so a rebind press never reaches the camera's own key handler.
  const settingsPanel = createSettingsPanel(ctx, {
    logger: ctx?.logger,
    onToast: (message, kind) => showToast(message, kind),
  });
  // The stored settings are applied straight away: a player who asked for
  // a bigger text or a high contrast gets them at the first frame, not
  // after they visit the settings panel.
  settingsPanel.applyUiEffects();

  const camera = createCameraRig(ctx, { listen: true });

  // The main menu and the pause overlay.
  const menu = createMenu(ctx, {
    logger: ctx?.logger,
    settingsPanel,
    onToast: (message, kind) => showToast(message, kind),
    onPause: (paused) => setPaused(paused),
  });

  // The gamepad (V6, issue KI-05). The RULES are in `core/gamepad.js`; this
  // service is the browser half: it reads the pads, compares the frames and
  // routes the result to the menu and the camera.
  const gamepad = createGamepadService(ctx, {
    logger: ctx?.logger,
    menu,
    camera,
    settingsPanel,
  });

  // The touch input (V7). The GESTURES are recognised by CORE's pure
  // recogniser; this service binds them to the camera and the world.
  const touch = createTouchService(ctx, {
    logger: ctx?.logger,
    camera,
  });

  // The navigation debug panel (V7). It is OFF by default and it is a
  // developer tool: it shows the route a citizen took, what it cost, how
  // many cells the search visited and WHY a search failed.
  // The mount point is resolved LAZILY by the service: at this moment the
  // HUD has no container yet, and `ctx.ui` is not assigned until this
  // factory returns.
  const navigationDebug = createNavigationDebug(ctx, {
    logger: ctx?.logger,
  });

  let hud = null;
  let mounted = false;
  let disposed = false;
  let panelId = null;
  let toastSignature = '';
  const unsubscribes = [];

  // ---- the hover cell (the integrator's input handler also writes it) -----
  function setHover(cell) {
    const current = state?.ui?.hover ?? null;
    if (current === cell) return;
    if (current && cell && current.x === cell.x && current.z === cell.z
      && !!current.outOfBounds === !!cell.outOfBounds) return;
    if (state?.ui) state.ui.hover = cell;
    bus?.emit?.(EVENTS.HOVER_CHANGED, cell);
  }

  // -------------------------------------------------------------------------
  // Tool + selection
  // -------------------------------------------------------------------------

  /**
   * Convert a world-space hit into a grid cell, using the SHARED grid
   * helpers from `core/config.js` (never a locally invented constant).
   */
  function toCell(hit) {
    const cfg = ctx?.config ?? {};
    let cx = 0;
    let cz = 0;
    if (typeof cfg.worldToCellInt === 'function') {
      const c = cfg.worldToCellInt(hit.x, hit.z);
      cx = c.x;
      cz = c.z;
    } else {
      const grid = cfg.GRID ?? { size: 64, cell: 4 };
      const cell = grid.cell ?? 4;
      const origin = -(grid.size * cell) / 2;
      cx = Math.floor((hit.x - origin) / cell);
      cz = Math.floor((hit.z - origin) / cell);
    }
    const size = cfg.GRID?.size ?? 64;
    const inside = cx >= 0 && cz >= 0 && cx < size && cz < size;
    return inside ? { x: cx, z: cz } : { x: cx, z: cz, outOfBounds: true };
  }

  /**
   * Select a tool. The tool is stored in `state.ui.tool` (the UX subtree the
   * UX domain owns) and broadcast on the bus so every domain can follow.
   */
  function setTool(tool) {
    const next = TOOLS[tool] ? tool : TOOLS.inspect;
    if (state?.ui) state.ui.tool = next;
    // A sibling domain may hold its own override of the active tool.
    try { domains.buildings?.setTool?.(next); } catch { /* optional */ }
    bus?.emit?.(EVENTS.TOOL_CHANGED, { tool: next });
    if (next === TOOLS.voxel) {
      // The voxel tool opens SCC Studio (the editor lives in the STD domain).
      try { domains.studio?.open?.(); } catch { /* optional */ }
    }
    return next;
  }

  /**
   * Set the current selection (the building the build tool will place).
   * BLD reads `state.ui.selection.type` when it has no override of its own.
   */
  function setSelection(sel) {
    const next = sel ?? null;
    if (state?.ui) {
      state.ui.selection = next;
      if (next?.type) state.ui.selectedType = next.type;
    }
    bus?.emit?.(EVENTS.SELECTION_CHANGED, next);
    return next;
  }

  // -------------------------------------------------------------------------
  // Toasts
  // -------------------------------------------------------------------------

  /** Show a notification. `kind` is info | success | warn | error | alert. */
  function showToast(msg, kind = 'info') {
    const toast = toasts.push(msg, kind);
    if (state?.ui?.toasts) state.ui.toasts = toasts.list();
    bus?.emit?.(EVENTS.TOAST, { message: toast.message, kind: toast.kind, id: toast.id });
    return toast;
  }

  // -------------------------------------------------------------------------
  // Panels
  // -------------------------------------------------------------------------

  function openPanel(id) {
    const opened = hud?.openPanel(id) ?? null;
    if (opened) {
      panelId = opened;
      if (state?.ui) state.ui.panel = opened;
    }
    return opened;
  }

  function closePanel() {
    const closed = hud?.closePanel() ?? null;
    panelId = null;
    if (state?.ui) state.ui.panel = null;
    return closed;
  }

  /** The open panel id, or null. */
  function panel() {
    return panelId ?? hud?.panel?.() ?? null;
  }

  // -------------------------------------------------------------------------
  // Simulation speed / pause (FR-UX-099)
  // -------------------------------------------------------------------------

  /**
   * Pause or set the simulation speed.
   *
   * NOTE FOR THE INTEGRATOR: the frame loop in `src/main.js` reads
   * `state.meta.speed` and `state.meta.paused`, so those two fields are
   * written here even though `state.meta` is integrator-owned. The mirror in
   * `state.ui.speed` is the UX subtree this domain owns. Both
   * `EVENTS.SPEED_CHANGED` and `EVENTS.PAUSE_CHANGED` are emitted so CORE
   * can take over the write if it prefers.
   *
   * V5: when CORE's mode registry is reachable the write goes through
   * `ctx.core.modes.setSpeed()`, so CORE keeps ONE authority over the clock
   * (it remembers `meta.speedBeforePause` and restores it on resume).
   */
  function setSpeed(name) {
    const meta = state?.meta;
    if (!meta) return null;
    const modes = ctx?.core?.modes;
    if (modes && typeof modes.setSpeed === 'function') {
      try {
        modes.setSpeed(name);
        if (state?.ui) state.ui.speed = meta.speed;
        return { speed: meta.speed, paused: meta.paused, path: 'core' };
      } catch (err) {
        ctx?.logger?.warn?.('CORE could not set the speed; the UI writes it directly', {
          error: String(err?.message ?? err),
        });
      }
    }
    if (name === 'paused') {
      meta.paused = true;
    } else {
      meta.paused = false;
      meta.speed = SPEED[name] ?? SPEED.normal;
    }
    if (state?.ui) state.ui.speed = meta.speed;
    bus?.emit?.(EVENTS.SPEED_CHANGED, { speed: meta.speed, paused: meta.paused });
    bus?.emit?.(EVENTS.PAUSE_CHANGED, { paused: meta.paused });
    return { speed: meta.speed, paused: meta.paused, path: 'direct' };
  }

  /**
   * Pause or resume the simulation.
   *
   * CORE owns the pause semantics whenever its mode registry is reachable:
   * `setSpeed('paused')` remembers the speed in `meta.speedBeforePause` and
   * `setPaused(false)` restores it. The direct `state.meta.paused` toggle is
   * only the fallback for a build without CORE.
   *
   * @param {boolean} paused
   * @returns {{paused:boolean, path:'core'|'direct'}}
   */
  function setPaused(paused) {
    const next = !!paused;
    const meta = state?.meta;
    const modes = ctx?.core?.modes;
    if (modes && typeof modes.setPaused === 'function') {
      try {
        if (next) {
          // Remember the speed the way CORE does it.
          if (typeof modes.setSpeed === 'function') modes.setSpeed('paused');
          else modes.setPaused(true);
        } else {
          modes.setPaused(false);
        }
        if (state?.ui && meta) state.ui.speed = meta.speed;
        return { paused: !!(meta && meta.paused), path: 'core' };
      } catch (err) {
        ctx?.logger?.warn?.('CORE could not pause the session; the UI writes the flag directly', {
          error: String(err?.message ?? err),
        });
      }
    }
    if (meta) {
      meta.paused = next;
      if (state?.ui) state.ui.speed = meta.speed;
    }
    bus?.emit?.(EVENTS.SPEED_CHANGED, { speed: meta?.speed, paused: next });
    bus?.emit?.(EVENTS.PAUSE_CHANGED, { paused: next });
    return { paused: next, path: 'direct' };
  }

  // -------------------------------------------------------------------------
  // Save / load
  // -------------------------------------------------------------------------

  function saveGame(slot = 'manual') {
    const save = ctx?.core?.save;
    if (!save || typeof save.saveToStorage !== 'function') {
      showToast('Save system unavailable', 'warn');
      return false;
    }
    let ok = false;
    try {
      ok = !!save.saveToStorage(state, slot);
    } catch (err) {
      showToast(`Save failed: ${err?.message ?? 'unknown error'}`, 'error');
      return false;
    }
    showToast(ok ? `Saved (${slot})` : 'Save failed', ok ? 'success' : 'error');
    bus?.emit?.(EVENTS.GAME_SAVED, { slot });
    return ok;
  }

  function loadGame(slot = 'manual') {
    const save = ctx?.core?.save;
    if (!save || typeof save.loadFromStorage !== 'function') {
      showToast('Save system unavailable', 'warn');
      return false;
    }
    let loaded = null;
    try {
      loaded = save.loadFromStorage(slot);
    } catch (err) {
      showToast(`Load failed: ${err?.message ?? 'unknown error'}`, 'error');
      return false;
    }
    if (!loaded) {
      showToast(`No save in slot "${slot}"`, 'warn');
      return false;
    }
    showToast(`Loaded (${slot})`, 'success');
    bus?.emit?.(EVENTS.GAME_LOADED, { slot });
    return true;
  }

  // -------------------------------------------------------------------------
  // Click dispatch for the tools no sibling domain claims
  // -------------------------------------------------------------------------

  /**
   * Handle a click on the world. Sibling domains receive the same call from
   * the integrator; the UX layer only acts for the tools nobody else claims.
   */
  function onClick(cell, button = 0) {
    if (!cell || button === 2) return false;
    const tool = state?.ui?.tool ?? TOOLS.inspect;
    if (TOOLS_OWNED_ELSEWHERE.has(tool)) return false;
    const rule = TOOL_DISPATCH[tool];
    if (!rule) return false;
    const domain = domains[rule.domain];
    if (!domain || typeof domain[rule.method] !== 'function') return false;
    // If the domain grew its own onClick handler, let it own the action.
    if (typeof domain.onClick === 'function' && tool === TOOLS.road) return false;
    try {
      domain[rule.method](...rule.args(cell));
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Assembly
  // -------------------------------------------------------------------------

  function buildHud() {
    hud = createHUD(ctx, {
      toasts,
      camera,
      settingsPanel,
      onTool: (tool) => setTool(tool),
      onSelection: (sel) => setSelection(sel),
      onSpeed: (name) => setSpeed(name),
      onSave: () => saveGame(),
      onOpenPanel: (id) => { panelId = id; if (state?.ui) state.ui.panel = id; },
      onClosePanel: () => { panelId = null; if (state?.ui) state.ui.panel = null; },
      // The main menu and the pause overlay. The key event that opened the
      // menu is handed over, so it cannot also act on it.
      onMenu: (e) => menu.open('main', { event: e ?? null }),
      onPause: (e) => menu.open('pause', { event: e ?? null }),
      isOverlayOpen: () => menu.isOpen(),
      isCapturing: () => settingsPanel.isCapturing(),
    });
    return hud;
  }

  const service = {
    /** Prepare the HUD. Safe to call before `mount()`. */
    async init() {
      if (!hud) buildHud();

      // The audio service is created after the domains, so the stored
      // volumes are pushed into the mixer once it exists.
      settingsPanel.applyUiEffects();

      // The building cost function lives in the buildings domain; it is
      // optional, so the import is guarded and the shop simply shows "—".
      try {
        const props = await import('../buildings/properties.js');
        if (typeof props.deriveCost === 'function') {
          hud?.setCostOf((def) => props.deriveCost(def, 1));
        }
      } catch {
        /* the buildings domain has not landed yet */
      }

      // Mount into the shell's overlay when it is there.
      if (!mounted) {
        const root = typeof document !== 'undefined' ? document.getElementById('ui-root') : null;
        if (root) service.mount(root);
      }

      // The curated 2D art is optional and may appear later.
      try {
        await hud?.refreshAssets();
      } catch {
        /* no 2D art — the HUD is complete without it */
      }
      return service;
    },

    /** Per-frame update (wall-clock seconds). */
    update(dt) {
      if (disposed) return;
      const d = Number.isFinite(dt) ? dt : 0;
      // The pad is read BEFORE the camera, so the axes it pushed are the ones
      // this frame's camera update applies.
      gamepad.update(d);
      // The touch clock is advanced before the camera too, for the same reason.
      touch.update(d);
      camera.update(d);
      // The navigation overlay is redrawn AFTER the camera moved, so the
      // route sits on the frame the player is looking at.
      navigationDebug.update();
      toasts.tick(d);
      hud?.update(d);
      // The toast list is mirrored into the UX subtree, but only when it
      // actually changed — this runs every frame.
      const current = toasts.current();
      const pending = toasts.pendingCount();
      const signature = `${current ? current.id : 0}:${pending}`;
      if (signature !== toastSignature) {
        toastSignature = signature;
        if (state?.ui) state.ui.toasts = toasts.list();
      }
    },

    /** Mount the HUD into a container element. */
    mount(el) {
      if (!hud) buildHud();
      if (!el) return false;
      hud.mount(el);
      // The menu overlay lives beside the HUD in the same container.
      menu.mount(el);
      // The touch listeners go on the CANVAS, not on the HUD.
      const canvas = ctx?.renderer?.renderer?.domElement ?? null;
      if (canvas) touch.install(canvas);
      mounted = true;
      return true;
    },

    /** Remove the HUD from the DOM. */
    unmount() {
      hud?.unmount();
      menu.unmount();
      mounted = false;
      return true;
    },

    setTool,
    setSelection,
    showToast,
    openPanel,
    closePanel,
    panel,

    /** The camera rig's public façade (contract §7). */
    camera: {
      focus(x, z) { return camera.focus(x, z); },
      zoomTo(d) { return camera.zoomTo(d); },
      rotate(delta) { return camera.rotate(delta); },
      reset() { return camera.reset(); },
    },

    /** Set the simulation speed or pause. */
    setSpeed,

    /** Pause or resume the simulation (CORE owns it when it is reachable). */
    setPaused,

    /**
     * The main menu and the pause overlay.
     *
     * `openMenu()` opens the full-screen menu; `openPauseMenu()` opens the
     * pause overlay (which pauses the session through CORE).
     */
    menu,
    openMenu() { return menu.open('main'); },
    openPauseMenu() { return menu.open('pause'); },
    closeMenu() { return menu.close(); },

    /** The settings, accessibility and controls panel service. */
    settingsPanel,

    /** The gamepad service (V6, issue KI-05). */
    gamepad,
    /** True while a gamepad is connected. */
    gamepadConnected() { return gamepad.isConnected(); },

    /** The touch input service (V7). */
    touch,
    /** True while a touch gesture is in progress. */
    touchActive() { return touch.isActive(); },

    /**
     * The navigation debug panel (V7).
     *
     * A developer tool: off by default, switched on from the console or
     * from a test. It shows the route a citizen took, its cost, the cells
     * the search visited and why a search failed.
     */
    navigationDebug,
    /** Switch the navigation debug panel on or off. */
    setNavigationDebug(on) { return navigationDebug.setEnabled(on); },

    /** Show or hide the performance read-out. */
    togglePerformance(force) { return hud?.togglePerformance?.(force) ?? false; },
    performanceVisible() { return hud?.performanceVisible?.() ?? false; },

    /** Save / load helpers (the Ctrl+S binding uses them). */
    saveGame,
    loadGame,

    /** The tool dispatch (called by the integrator for world clicks). */
    onClick,

    /** The toast queue, exposed for the HUD and for tests. */
    toasts,

    /** The underlying HUD (for tests and for the studio overlay). */
    get hud() { return hud; },

    dispose() {
      disposed = true;
      for (const un of unsubscribes) { try { un(); } catch { /* ignore */ } }
      unsubscribes.length = 0;
      hud?.dispose();
      menu.dispose();
      settingsPanel.dispose();
      gamepad.dispose();
      touch.dispose();
      navigationDebug.dispose();
      camera.dispose();
      toasts.clear();
      mounted = false;
    },
  };

  // The HUD is built eagerly so that `mount()`, `openPanel()` and the
  // keyboard scheme all work before `init()` has resolved.
  //
  // It is skipped when there is no DOM (Node, unit tests, a headless
  // contract check). `mount()` builds it on demand, so the browser path is
  // unchanged — but the factory stays side-effect free and testable.
  if (typeof document !== 'undefined') buildHud();

  // The hover cell is a GETTER (the contract lists it as a value).
  Object.defineProperty(service, 'hoverCell', {
    enumerable: true,
    get() { return state?.ui?.hover ?? null; },
  });

  // Track the hover ourselves too, so the HUD works even if the integrator's
  // input handler is not present.
  const canvas = ctx?.renderer?.renderer?.domElement ?? null;  if (canvas && typeof canvas.addEventListener === 'function') {
    const onMove = (e) => {
      try {
        const hit = ctx.renderer.screenToGround?.(e.clientX, e.clientY);
        if (!hit) { setHover(null); return; }
        const cell = toCell(hit);
        if (!cell) { setHover(null); return; }
        setHover(cell);
      } catch {
        setHover(null);
      }
    };
    canvas.addEventListener('pointermove', onMove);
    unsubscribes.push(() => canvas.removeEventListener('pointermove', onMove));
  }

  return service;
}

export { HUD_STYLES };
