/**
 * ui/gamepad.js — the gamepad service (V6, issue KI-05).
 *
 * OWNER: UX.
 *
 * WHAT THIS IS
 *   V5 shipped with NO gamepad code at all — the V5 known-issues record
 *   claimed otherwise, and that claim is corrected in
 *   `docs/V6_KNOWN_ISSUES.md`. V6 adds a real pad path.
 *
 *   The RULES live in `core/gamepad.js` (pure, Node-testable): the dead
 *   zone, the button edge, the axis resolution, connect and disconnect.
 *   This file is the part that needs a browser: it reads
 *   `navigator.getGamepads()`, compares the frames, and routes the result
 *   to the menu and the camera.
 *
 * THE FOUR RULES THIS FILE ENFORCES
 *
 *   1. A HELD BUTTON FIRES ONCE.
 *      The core reports an action only on the EDGE (down, not held), so a
 *      player who holds CONFIRM does not confirm twice — which is what
 *      happened on a naive implementation and what made menus feel sticky.
 *
 *   2. THE CAMERA DOES NOT MOVE UNDER A MODAL.
 *      While the menu or a HUD panel has the focus, the analogue axes are
 *      released, not applied. A camera that drifts under a dialog is a
 *      camera the player cannot control.
 *
 *   3. A RESTING STICK MOVES NOTHING.
 *      The dead zone in the core makes a resting stick read as exactly zero.
 *
 *   4. AN UNPLUGGED PAD RELEASES EVERYTHING.
 *      The core reports the held buttons as released, so the focus does not
 *      stay on a control that can no longer be reached.
 *
 * THE HONEST LIMIT
 *   No physical controller was available in the build environment, so the
 *   pad path is verified against a SIMULATED pad (a fake `navigator
 *   .getGamepads`) in `ui/gamepad.test.mjs` and in the V6 browser scenario.
 *   That proves the LOGIC; it does not prove the feel of real hardware.
 */

import { DEFAULT_DEAD_ZONE, readPad, updateGamepadState } from '../core/gamepad.js';
import { DEFAULT_PAD_BINDINGS } from '../core/input-map.js';

/**
 * Read the pads the browser can see.
 *
 * `navigator.getGamepads` does not exist in every browser (older Safari),
 * and it can throw in a page that is not secure. Both are handled: the
 * service simply reports "no pad".
 *
 * @returns {Array|null}
 */
function defaultGetPads() {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (!nav || typeof nav.getGamepads !== 'function') return null;
    const pads = nav.getGamepads();
    return Array.isArray(pads) ? pads : Array.from(pads ?? []);
  } catch {
    return null;
  }
}

/**
 * Create the gamepad service.
 *
 * @param {object} ctx the shared context
 * @param {object} [deps]
 * @param {object} [deps.menu]          the menu service
 * @param {object} [deps.camera]        the camera rig
 * @param {object} [deps.settingsPanel] the settings / controls panel service
 * @param {Function} [deps.getBindings] () -> action -> button indices
 * @param {Function} [deps.getPads]     () -> an array of pads
 * @param {number} [deps.deadZone]
 * @returns {object} the gamepad service
 */
export function createGamepadService(ctx, deps = {}) {
  const logger = deps.logger ?? ctx?.logger ?? null;
  const menu = deps.menu ?? null;
  const camera = deps.camera ?? null;
  const settingsPanel = deps.settingsPanel ?? null;
  const getBindings = deps.getBindings
    ?? (() => ctx?.inputMap?.padAll?.() ?? DEFAULT_PAD_BINDINGS);
  const getPads = deps.getPads ?? defaultGetPads;
  const deadZone = Number.isFinite(deps.deadZone) ? deps.deadZone : DEFAULT_DEAD_ZONE;

  let previous = null;
  let state = null;
  let disposed = false;
  /** True on the frame the menu was opened, so that press cannot act on it. */
  let openedMenuThisFrame = false;
  let frame = 0;

  // ---- the state of the world around the pad ----------------------------

  /** True while the menu overlay has the focus. */
  function menuOpen() {
    try {
      return !!menu?.isOpen?.();
    } catch {
      return false;
    }
  }

  /**
   * True while something modal has the focus.
   *
   * The menu is modal, and so is a HUD panel (the shop, the government, the
   * building browser). While either is open the camera must not move.
   */
  function modalOpen() {
    if (menuOpen()) return true;
    try {
      return !!ctx?.ui?.panel?.();
    } catch {
      return false;
    }
  }

  /** True while a key press is being captured for a rebind. */
  function capturing() {
    try {
      return !!settingsPanel?.isCapturing?.();
    } catch {
      return false;
    }
  }

  // ---- the pad ------------------------------------------------------------

  /** The first connected pad, or null. */
  function pickPad() {
    let pads = null;
    try {
      pads = getPads();
    } catch {
      return null;
    }
    if (!pads) return null;
    for (const pad of pads) {
      if (pad && pad.connected) return pad;
    }
    return null;
  }

  // ---- the routing --------------------------------------------------------

  /**
   * Open the pause overlay, or close it if it is already open.
   *
   * @returns {boolean} true when something changed
   */
  function togglePause() {
    if (menuOpen()) {
      // The pause overlay is the one menu view that closes with the pause
      // button; the main menu stays open until it is dismissed.
      if (menu?.view?.() === 'pause') {
        menu.close();
        return true;
      }
      return false;
    }
    const opened = menu?.open?.('pause', { event: null }) ?? false;
    openedMenuThisFrame = opened;
    return opened;
  }

  /** Open the main menu. */
  function openMainMenu() {
    if (menuOpen()) return false;
    const opened = menu?.open?.('main', { event: null }) ?? false;
    openedMenuThisFrame = opened;
    return opened;
  }

  /**
   * Route the actions the pad pressed this frame.
   *
   * @param {object} st the gamepad state
   */
  function route(st) {
    const menuHasFocus = menuOpen();
    for (const action of st.pressedActions) {
      if (action.startsWith('menu.')) {
        // The press that OPENED the menu must not also act on it.
        if (openedMenuThisFrame) continue;
        if (menuHasFocus) menu?.handlePadAction?.(action);
        continue;
      }
      if (action === 'game.pause') { togglePause(); continue; }
      if (action === 'game.menu') { openMainMenu(); continue; }
      if (modalOpen() || capturing()) continue;
      if (action === 'camera.reset') { camera?.reset?.(); continue; }
      if (action === 'camera.zoomIn') { zoomStep(0.82); continue; }
      if (action === 'camera.zoomOut') { zoomStep(1.22); continue; }
    }
  }

  /**
   * One discrete zoom step, the same size the keyboard's zoom uses.
   * @param {number} factor a multiplier on the current distance
   */
  function zoomStep(factor) {
    if (!camera || typeof camera.zoomTo !== 'function') return;
    const distance = Number(camera.state?.distance);
    if (!Number.isFinite(distance)) return;
    camera.zoomTo(distance * factor);
  }

  /**
   * Push the analogue axes to the camera — or release them.
   *
   * The release is an explicit ZERO object rather than `null`, so the camera
   * always receives a complete set of axes and a caller can compare them.
   *
   * @param {object} st the gamepad state
   */
  function applyAxes(st) {
    if (!camera || typeof camera.setPadAxes !== 'function') return;
    if (modalOpen() || capturing()) {
      camera.setPadAxes({ panX: 0, panY: 0, rotate: 0, zoom: 0 });
      return;
    }
    camera.setPadAxes(st.axes);
  }

  // ---- the connection events ------------------------------------------------

  /** A pad appeared: tell the player, and show the pad hint in the menu. */
  function onConnect() {
    const id = state?.snapshot?.id ?? 'gamepad';
    logger?.info?.('a gamepad was connected', { id });
    menu?.setPadHint?.('D-pad move · A select · B back');
  }

  /** A pad went away: release everything it was holding. */
  function onDisconnect() {
    logger?.info?.('the gamepad was disconnected');
    menu?.setPadHint?.(null);
    // The held buttons are released by the core's diff, so nothing is stuck.
    try { camera?.setPadAxes?.({ panX: 0, panY: 0, rotate: 0, zoom: 0 }); } catch { /* ignore */ }
  }

  // ---- the public surface --------------------------------------------------

  return {
    /**
     * Read the pad and route what it did. Call once per frame.
     *
     * @param {number} dt wall-clock seconds
     * @returns {object|null} the gamepad state for this frame
     */
    update(dt) {
      if (disposed) return null;
      frame += 1;
      openedMenuThisFrame = false;
      const snapshot = readPad(pickPad(), { deadZone });
      const bindings = getBindings();
      state = updateGamepadState(previous, snapshot, bindings);
      previous = state;
      if (state.connectedNow) onConnect();
      if (state.disconnectedNow) onDisconnect();
      if (state.pressedActions.length) route(state);
      applyAxes(state);
      return state;
    },

    /** The gamepad state for the last frame. */
    get state() { return state; },

    /** True while a pad is connected. */
    isConnected() { return !!state?.connected; },

    /** The id of the connected pad, or null. */
    padId() { return state?.snapshot?.id ?? null; },

    /** The analogue axes for the last frame. */
    axes() { return { ...(state?.axes ?? { panX: 0, panY: 0, rotate: 0, zoom: 0 }) }; },

    /** True while a modal has the focus (the camera is released). */
    isModalOpen() { return modalOpen(); },

    /** How many frames the service has run. */
    frameCount() { return frame; },

    dispose() {
      disposed = true;
      previous = null;
      state = null;
      // The camera must not keep the last axes after the service is gone.
      try { camera?.setPadAxes?.({ panX: 0, panY: 0, rotate: 0, zoom: 0 }); } catch { /* ignore */ }
    },
  };
}
