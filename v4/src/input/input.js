/**
 * V4 — Input abstraction.
 *
 * The game never reads `keydown` directly: it asks for an action. Bindings
 * are data, so they can be rebound, replayed in tests and listed in the
 * editor's shortcut panel.
 */

export const DEFAULT_BINDINGS = {
  'player.forward': ['KeyW', 'ArrowUp'],
  'player.back': ['KeyS', 'ArrowDown'],
  'player.left': ['KeyA', 'ArrowLeft'],
  'player.right': ['KeyD', 'ArrowRight'],
  'player.jump': ['Space'],
  'player.sprint': ['ShiftLeft', 'ShiftRight'],
  'player.interact': ['KeyE'],
  'player.inventory': ['KeyI'],
  'player.pause': ['Escape'],
  'editor.undo': ['KeyZ'],
  'editor.redo': ['KeyY', 'KeyZ'],
  'editor.play': ['Enter'],
};

export function createInput({ target = globalThis, bindings = DEFAULT_BINDINGS } = {}) {
  const state = new Map();      // code -> set of actions
  const down = new Set();       // codes currently held
  const pressed = new Set();    // codes pressed this frame
  const pointer = { x: 0, y: 0, dx: 0, dy: 0, down: false, clicked: false, wheel: 0 };
  const listeners = { keydown: [], keyup: [], pointermove: [], pointerdown: [], pointerup: [], wheel: [] };
  let enabled = true;

  function rebuild() {
    state.clear();
    for (const [action, codes] of Object.entries(bindings)) {
      for (const code of [].concat(codes)) {
        if (!state.has(code)) state.set(code, new Set());
        state.get(code).add(action);
      }
    }
  }
  rebuild();

  function onKeyDown(event) {
    if (!enabled) return;
    down.add(event.code);
    pressed.add(event.code);
    for (const fn of listeners.keydown) fn(event);
  }
  function onKeyUp(event) {
    down.delete(event.code);
    for (const fn of listeners.keyup) fn(event);
  }
  function onPointerMove(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.dx = event.movementX ?? 0;
    pointer.dy = event.movementY ?? 0;
    for (const fn of listeners.pointermove) fn(event);
  }
  function onPointerDown(event) {
    pointer.down = true;
    pointer.clicked = true;
    for (const fn of listeners.pointerdown) fn(event);
  }
  function onPointerUp() {
    pointer.down = false;
    for (const fn of listeners.pointerup) fn();
  }
  function onWheel(event) {
    pointer.wheel += event.deltaY;
    for (const fn of listeners.wheel) fn(event);
  }

  target.addEventListener?.('keydown', onKeyDown);
  target.addEventListener?.('keyup', onKeyUp);
  target.addEventListener?.('pointermove', onPointerMove);
  target.addEventListener?.('pointerdown', onPointerDown);
  target.addEventListener?.('pointerup', onPointerUp);
  target.addEventListener?.('wheel', onWheel, { passive: true });

  const input = {
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; if (!enabled) { down.clear(); pressed.clear(); } },

    isDown(action) {
      for (const codes of Object.entries(bindings)) {
        if (codes[0] !== action) continue;
        for (const code of [].concat(codes[1])) if (down.has(code)) return true;
      }
      return false;
    },

    wasPressed(action) {
      for (const [name, codes] of Object.entries(bindings)) {
        if (name !== action) continue;
        for (const code of [].concat(codes)) if (pressed.has(code)) return true;
      }
      return false;
    },

    /** A 2D axis from two actions (left/right, forward/back). */
    axis(negativeAction, positiveAction) {
      return (input.isDown(positiveAction) ? 1 : 0) - (input.isDown(negativeAction) ? 1 : 0);
    },

    /** Actions currently held, for the HUD and the debugger. */
    activeActions() {
      const out = new Set();
      for (const [code, actions] of state) {
        if (!down.has(code)) continue;
        for (const a of actions) out.add(a);
      }
      return [...out];
    },

    bindings() { return { ...bindings }; },

    rebind(action, codes) {
      bindings[action] = [].concat(codes);
      rebuild();
    },

    pointer,

    /** Call once per frame, after the frame has read the state. */
    endFrame() {
      pressed.clear();
      pointer.dx = 0;
      pointer.dy = 0;
      pointer.clicked = false;
      pointer.wheel = 0;
    },

    /**
     * Forget the key-down edges, keeping the keys that are still held.
     *
     * One frame can run several fixed simulation steps (the clock catches up
     * after a slow frame), and every one of those steps would otherwise see
     * the same key-down edge: a single press of E would interact up to five
     * times and a single press of Escape would toggle the pause five times.
     * The first step consumes the edge; the remaining steps see the key as
     * *held* rather than *pressed*, which is what they should see.
     */
    consumeEdges() {
      pressed.clear();
    },

    on(event, fn) {
      listeners[event]?.push(fn);
      return () => {
        const arr = listeners[event];
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
      };
    },

    dispose() {
      target.removeEventListener?.('keydown', onKeyDown);
      target.removeEventListener?.('keyup', onKeyUp);
      target.removeEventListener?.('pointermove', onPointerMove);
      target.removeEventListener?.('pointerdown', onPointerDown);
      target.removeEventListener?.('pointerup', onPointerUp);
      target.removeEventListener?.('wheel', onWheel);
    },
  };
  return input;
}
