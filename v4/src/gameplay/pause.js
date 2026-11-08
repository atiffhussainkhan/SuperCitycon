/**
 * V4 — Pause.
 *
 * Freezes the clock and announces the state change on the bus. The pause
 * menu is usually driven from here: `menus.open()` / `menus.close()` are
 * called if a menu object is handed in.
 */

import { Events } from '../core/events.js';

/**
 * @param {object} opts
 * @param {object} [opts.clock]  the fixed-step clock
 * @param {object} [opts.bus]
 * @param {object} [opts.input] reads the 'player.pause' action
 * @param {object} [opts.menus]  a menu object with open()/close()
 */
export function createPause({ clock = null, bus = null, input = null, menus = null } = {}) {
  let paused = false;

  function setPaused(next) {
    const value = !!next;
    if (value === paused) return false;
    paused = value;
    if (clock) clock.paused = paused;
    bus?.emit?.(Events.PAUSED, { paused });
    bus?.emit?.(Events.PLAY_STATE, { paused });
    if (menus) {
      if (paused) menus.open?.();
      else menus.close?.();
    }
    return true;
  }

  return {
    /** Is the game paused? */
    get paused() { return paused; },
    /** The clock this controller drives. */
    get clock() { return clock; },

    /** Pause the game. */
    pause() { return setPaused(true); },
    /** Resume the game. */
    resume() { return setPaused(false); },
    /** Toggle between paused and running. */
    toggle() { return setPaused(!paused); },

    /** Read the pause key and act on it. */
    update() {
      if (input?.wasPressed?.('player.pause')) return toggle();
      return false;
    },
  };
}
