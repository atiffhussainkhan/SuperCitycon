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
import { createToastQueue } from './toasts.js';
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
  const camera = createCameraRig(ctx, { listen: true });

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
   */
  function setSpeed(name) {
    const meta = state?.meta;
    if (!meta) return null;
    if (name === 'paused') {
      meta.paused = true;
    } else {
      meta.paused = false;
      meta.speed = SPEED[name] ?? SPEED.normal;
    }
    if (state?.ui) state.ui.speed = meta.speed;
    bus?.emit?.(EVENTS.SPEED_CHANGED, { speed: meta.speed, paused: meta.paused });
    bus?.emit?.(EVENTS.PAUSE_CHANGED, { paused: meta.paused });
    return { speed: meta.speed, paused: meta.paused };
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
      onTool: (tool) => setTool(tool),
      onSelection: (sel) => setSelection(sel),
      onSpeed: (name) => setSpeed(name),
      onSave: () => saveGame(),
      onOpenPanel: (id) => { panelId = id; if (state?.ui) state.ui.panel = id; },
      onClosePanel: () => { panelId = null; if (state?.ui) state.ui.panel = null; },
    });
    return hud;
  }

  const service = {
    /** Prepare the HUD. Safe to call before `mount()`. */
    async init() {
      if (!hud) buildHud();

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
      camera.update(d);
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
      mounted = true;
      return true;
    },

    /** Remove the HUD from the DOM. */
    unmount() {
      hud?.unmount();
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
