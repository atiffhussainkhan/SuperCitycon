/**
 * core/input-map.js — one table of key bindings for the whole game.
 *
 * OWNER: the integrator (core/).
 *
 * The bindings used to be literal key comparisons scattered across two files:
 * the HUD compared `e.key` against digit strings and letters, and the camera
 * rig compared `e.key` against 'w', 'q', 'e' and 'r'. Nothing could be
 * remapped, the on-screen key hints were a hand-written snapshot that had
 * already drifted from the code, and a player who wanted 'E' for something
 * else had no way to ask.
 *
 * This module is the single table. Every handler asks it which key an action
 * is bound to, and the settings panel asks it to rebind an action. The
 * on-screen hints are generated from it, so they cannot drift.
 *
 * Codes are `KeyboardEvent.code` values ('KeyW', 'Digit1', 'Space'), not
 * `key` values: a code names a physical key, so the binding survives a
 * different keyboard layout.
 *
 * The GAMEPAD bindings live here too, so one table describes the player's
 * controls and one place rebinds them. The rules that interpret a pad —
 * dead zones, button edges, axis resolution — are in `core/gamepad.js`.
 *
 * Pure: this module imports nothing but the pad constants, and touches no DOM.
 */

import { PAD_BUTTONS } from './gamepad.js';

/** Every action the player can bind. */
export const ACTIONS = Object.freeze([
  'camera.panUp',
  'camera.panDown',
  'camera.panLeft',
  'camera.panRight',
  'camera.rotateLeft',
  'camera.rotateRight',
  'camera.zoomIn',
  'camera.zoomOut',
  'camera.reset',
  'game.pause',
  'game.save',
  'game.help',
  'game.shop',
  'game.government',
  'game.building',
  'game.saves',
  'game.time',
  'game.menu',
  'game.cancel',
]);

/** The default bindings: action -> array of key codes. */
export const DEFAULT_BINDINGS = Object.freeze({
  'camera.panUp': ['KeyW', 'ArrowUp'],
  'camera.panDown': ['KeyS', 'ArrowDown'],
  'camera.panLeft': ['KeyA', 'ArrowLeft'],
  'camera.panRight': ['KeyD', 'ArrowRight'],
  'camera.rotateLeft': ['KeyQ'],
  'camera.rotateRight': ['KeyE'],
  'camera.zoomIn': ['Equal', 'NumpadAdd'],
  'camera.zoomOut': ['Minus', 'NumpadSubtract'],
  'camera.reset': ['KeyR'],
  'game.pause': ['Space'],
  'game.save': ['KeyS'],
  'game.help': ['KeyH'],
  'game.shop': ['KeyB'],
  'game.government': ['KeyG'],
  'game.building': ['KeyI'],
  'game.saves': ['KeyL'],
  'game.time': ['KeyT'],
  'game.menu': ['Escape'],
  'game.cancel': ['Escape'],
});

/**
 * The actions that carry a modifier, so the binding table can show it and
 * the handler can require it.
 */
export const MODIFIER_ACTIONS = Object.freeze({
  'game.save': 'ctrl',
});

/**
 * The actions a gamepad button can trigger.
 *
 * These are deliberately SEPARATE from `ACTIONS`: the menu's own keyboard
 * scheme (arrows, Enter, Escape) is not a rebindable game action, so adding
 * `menu.*` to the keyboard table would expose them to the rebinding screen
 * for no reason.
 */
export const PAD_ACTIONS = Object.freeze([
  'menu.up',
  'menu.down',
  'menu.left',
  'menu.right',
  'menu.confirm',
  'menu.back',
  'game.pause',
  'game.menu',
  'camera.reset',
  'camera.zoomIn',
  'camera.zoomOut',
]);

/**
 * The default pad bindings: action -> button indices.
 *
 * The indices are the standard gamepad mapping (see `core/gamepad.js`), so
 * they work on any browser that reports a standard pad.
 */
export const DEFAULT_PAD_BINDINGS = Object.freeze({
  'menu.up': [PAD_BUTTONS.DPAD_UP],
  'menu.down': [PAD_BUTTONS.DPAD_DOWN],
  'menu.left': [PAD_BUTTONS.DPAD_LEFT],
  'menu.right': [PAD_BUTTONS.DPAD_RIGHT],
  'menu.confirm': [PAD_BUTTONS.A],
  'menu.back': [PAD_BUTTONS.B],
  'game.pause': [PAD_BUTTONS.START],
  'game.menu': [PAD_BUTTONS.GUIDE],
  'camera.reset': [PAD_BUTTONS.LEFT_STICK],
  'camera.zoomIn': [PAD_BUTTONS.RIGHT_BUMPER],
  'camera.zoomOut': [PAD_BUTTONS.LEFT_BUMPER],
});

/**
 * Build an input map.
 *
 * @param {object} [opts]
 * @param {object} [opts.bindings] an override table (action -> codes)
 * @param {object} [opts.padBindings] an override table (action -> button indices)
 * @returns {object} the input map service
 */
export function createInputMap({ bindings = null, padBindings = null } = {}) {
  let table = { ...DEFAULT_BINDINGS };
  let padTable = { ...DEFAULT_PAD_BINDINGS };

  function applyOverrides(overrides) {
    if (!overrides || typeof overrides !== 'object') return false;
    let changed = false;
    for (const [action, codes] of Object.entries(overrides)) {
      if (!(action in DEFAULT_BINDINGS)) continue;
      if (!Array.isArray(codes)) continue;
      const clean = codes.filter((c) => typeof c === 'string' && c.length > 0);
      table[action] = clean;
      changed = true;
    }
    return changed;
  }

  function applyPadOverrides(overrides) {
    if (!overrides || typeof overrides !== 'object') return false;
    let changed = false;
    for (const [action, indices] of Object.entries(overrides)) {
      if (!(action in DEFAULT_PAD_BINDINGS)) continue;
      if (!Array.isArray(indices)) continue;
      const clean = indices.filter((i) => Number.isInteger(i) && i >= 0);
      padTable[action] = clean;
      changed = true;
    }
    return changed;
  }

  if (bindings) applyOverrides(bindings);
  if (padBindings) applyPadOverrides(padBindings);

  return {
    /** The whole table. */
    all() {
      const out = {};
      for (const [action, codes] of Object.entries(table)) out[action] = codes.slice();
      return out;
    },
    /** The codes bound to one action. */
    get(action) { return (table[action] ?? []).slice(); },
    /** The first code bound to one action, or null. */
    primary(action) { return table[action]?.[0] ?? null; },
    /** The modifier an action requires, or null. */
    modifierFor(action) { return MODIFIER_ACTIONS[action] ?? null; },

    // -- the gamepad half of the table ------------------------------------
    /** The whole pad binding table. */
    padAll() {
      const out = {};
      for (const [action, indices] of Object.entries(padTable)) out[action] = indices.slice();
      return out;
    },
    /** The button indices bound to one action. */
    padFor(action) { return (padTable[action] ?? []).slice(); },
    /**
     * The action a pad button triggers, or null.
     *
     * @param {number} buttonIndex
     * @returns {string|null}
     */
    padActionFor(buttonIndex) {
      for (const [action, indices] of Object.entries(padTable)) {
        if (indices.includes(buttonIndex)) return action;
      }
      return null;
    },

    /**
     * Does this keyboard event trigger the action?
     *
     * @param {string} action
     * @param {{code?:string, ctrlKey?:boolean, metaKey?:boolean, shiftKey?:boolean}} event
     * @returns {boolean}
     */
    matches(action, event) {
      const codes = table[action];
      if (!codes || !codes.length || !event) return false;
      const code = event.code || '';
      if (!codes.includes(code)) return false;
      const modifier = MODIFIER_ACTIONS[action];
      if (modifier === 'ctrl') {
        // Either control or command satisfies "the modifier", so the game
        // works on a Mac keyboard and on a PC one.
        return !!(event.ctrlKey || event.metaKey);
      }
      return true;
    },

    /**
     * Bind a new code to an action.
     *
     * The previous binding is kept as a secondary code, so rebinding 'E' does
     * not take the camera's rotate binding away entirely.
     */
    rebind(action, code) {
      if (!(action in DEFAULT_BINDINGS)) return false;
      if (typeof code !== 'string' || !code) return false;
      const previous = table[action] ?? [];
      table[action] = [code, ...previous.filter((c) => c !== code)].slice(0, 3);
      return true;
    },
    /** Restore the default binding for one action. */
    resetAction(action) {
      if (!(action in DEFAULT_BINDINGS)) return false;
      table[action] = DEFAULT_BINDINGS[action].slice();
      return true;
    },
    /** Restore every default binding. */
    resetAll() {
      table = { ...DEFAULT_BINDINGS };
      padTable = { ...DEFAULT_PAD_BINDINGS };
      return true;
    },
    /** Apply a stored override table. */
    applyOverrides,
    /** Apply a stored pad override table. */
    applyPadOverrides,
  };
}

/**
 * A human-readable label for a key code, for the settings panel and the
 * on-screen hints.
 *
 * @param {string} code
 * @returns {string}
 */
export function keyLabel(code) {
  if (!code) return '';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const named = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Space: 'Space', Escape: 'Esc', ShiftLeft: 'L Shift', ShiftRight: 'R Shift',
    ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', MetaLeft: 'L Cmd', MetaRight: 'R Cmd',
    Equal: '=', Minus: '-', Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace',
  };
  return named[code] ?? code;
}
