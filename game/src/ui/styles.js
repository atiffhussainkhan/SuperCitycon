/**
 * ui/styles.js — the HUD's visual language.
 *
 * OWNER: UX (BOT-09). This file is the single source of the HUD's CSS.
 *
 * THE 16-BIT LOOK IS THE SPEC (dossier FR-UX-017/018, evidence S16-S20):
 *   - hard edges only: 2-3 px solid borders, ZERO border-radius, no blur;
 *   - the palette comes from the CSS custom properties the shell already
 *     defines (--sc-ink, --sc-panel, --sc-panel-2, --sc-edge, --sc-text,
 *     --sc-dim, --sc-gold, --sc-green, --sc-red, --sc-blue, --sc-purple);
 *   - panels are offset-solid-shadowed (a hard 4 px block), never a soft
 *     drop shadow — a soft shadow is a gradient, and gradients are banned;
 *   - the pixel font stack is inherited from --sc-font;
 *   - every interactive target is at least 44x44 logical px (FR-UX-017);
 *   - the layout respects `env(safe-area-inset-*)` (FR-UX-018).
 *
 * This module is PURE: importing it in Node must not touch `document`.
 * `ensureStyles()` is the only DOM-aware helper and it is guarded.
 */

export const HUD_STYLES = `
/* ==========================================================================
   SuperCitycon HUD — 16-bit chrome
   ========================================================================== */

#ui-root > .sc-hud {
  pointer-events: none;            /* the 3D view keeps receiving clicks */
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--sc-font);
  color: var(--sc-text);
  font-size: 11px;
  line-height: 1.35;
  letter-spacing: .02em;
  text-transform: uppercase;
  -webkit-user-select: none;
  user-select: none;
}

#ui-root > .sc-hud * { box-sizing: border-box; }

.sc-hud button,
.sc-hud input,
.sc-hud select {
  font-family: inherit;
  font-size: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
}

/* --- the pixel panel ---------------------------------------------------- */
.sc-panelbox {
  background: var(--sc-panel);
  border: 3px solid var(--sc-edge);
  box-shadow: 4px 4px 0 0 #0d0f1c;
  padding: 6px;
}

.sc-hud .sc-btn {
  pointer-events: auto;
  min-width: 44px;
  min-height: 44px;
  padding: 4px 8px;
  background: var(--sc-panel-2);
  border: 3px solid var(--sc-edge);
  border-radius: 0;
  color: var(--sc-text);
  cursor: pointer;
  box-shadow: 3px 3px 0 0 #0d0f1c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.sc-hud .sc-btn:hover { background: var(--sc-slate, #3a4170); border-color: var(--sc-dim); }
.sc-hud .sc-btn:active,
.sc-hud .sc-btn.is-active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 #0d0f1c; }
.sc-hud .sc-btn:focus-visible { outline: 2px solid var(--sc-gold); outline-offset: 2px; }
.sc-hud .sc-btn[disabled] { opacity: .45; cursor: not-allowed; }

.sc-hud .sc-btn.is-active {
  background: var(--sc-ink);
  border-color: var(--sc-gold);
  color: var(--sc-gold);
}

/* --- top bar ------------------------------------------------------------ */
.sc-topbar {
  position: absolute;
  top: 0; left: 0; right: 0;
  display: flex;
  align-items: stretch;
  gap: 6px;
  padding: 6px 8px;
  padding-top: calc(6px + env(safe-area-inset-top, 0px));
  padding-left: calc(8px + env(safe-area-inset-left, 0px));
  padding-right: calc(8px + env(safe-area-inset-right, 0px));
  background: var(--sc-panel);
  border-bottom: 3px solid var(--sc-edge);
  box-shadow: 0 3px 0 0 #0d0f1c;
  pointer-events: none;
  flex-wrap: wrap;
}

.sc-mayor {
  pointer-events: auto;
  min-width: 64px;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--sc-ink);
  border: 3px solid var(--sc-purple);
  color: var(--sc-purple);
  padding: 2px 6px;
  cursor: pointer;
}
.sc-mayor b { color: var(--sc-text); font-size: 12px; }
.sc-mayor span { font-size: 8px; color: var(--sc-dim); }

.sc-stats { display: flex; gap: 6px; flex: 1 1 auto; min-width: 0; }

/* The demand + usage row lives inside the top bar as a second line. */
.sc-statusrow {
  display: flex;
  gap: 6px;
  flex-basis: 100%;
  min-width: 0;
}
.sc-statusrow > .sc-stats { flex: 0 1 auto; }
.sc-statusrow .sc-stat { min-width: 96px; }

.sc-stat {
  pointer-events: auto;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  background: var(--sc-panel-2);
  border: 3px solid var(--sc-edge);
  padding: 2px 8px;
  cursor: pointer;
  text-align: left;
}
.sc-stat > span { font-size: 8px; color: var(--sc-dim); }
.sc-stat > b { font-size: 12px; color: var(--sc-text); }
.sc-stat[data-tone="gold"] > b { color: var(--sc-gold); }
.sc-stat[data-tone="green"] > b { color: var(--sc-green); }
.sc-stat[data-tone="red"] > b { color: var(--sc-red); }
.sc-stat[data-tone="blue"] > b { color: var(--sc-sky, #4cc9f0); }
.sc-stat.is-assumed > b::after {
  content: ' ~';
  color: var(--sc-dim);
}
.sc-stat .sc-icon { width: 16px; height: 16px; image-rendering: pixelated; }

.sc-clock {
  pointer-events: auto;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: var(--sc-panel-2);
  border: 3px solid var(--sc-edge);
  padding: 2px 10px;
  cursor: pointer;
}
.sc-clock b { color: var(--sc-sky, #4cc9f0); font-size: 12px; }
.sc-clock span { font-size: 8px; color: var(--sc-dim); }

.sc-speed { display: flex; gap: 4px; align-items: center; }
.sc-speed .sc-btn { min-width: 40px; padding: 4px 6px; }

/* --- day / event ticker ------------------------------------------------- */
.sc-ticker {
  position: absolute;
  top: calc(112px + env(safe-area-inset-top, 0px));
  left: calc(8px + env(safe-area-inset-left, 0px));
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 260px;
  pointer-events: none;
}
.sc-ticker > * {
  pointer-events: auto;
  background: var(--sc-ink);
  border-left: 4px solid var(--sc-gold);
  border-top: 2px solid var(--sc-edge);
  border-right: 2px solid var(--sc-edge);
  border-bottom: 2px solid var(--sc-edge);
  padding: 2px 8px;
  font-size: 9px;
  color: var(--sc-dim);
}
.sc-ticker > * b { color: var(--sc-text); }

/* --- left vertical tool stack (FR-UX-011) ------------------------------- */
.sc-tools {
  position: absolute;
  left: calc(8px + env(safe-area-inset-left, 0px));
  top: calc(168px + env(safe-area-inset-top, 0px));
  display: flex;
  flex-direction: column;
  gap: 5px;
  pointer-events: none;
}
.sc-tool {
  pointer-events: auto;
  width: 52px;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  background: var(--sc-panel);
  border: 3px solid var(--sc-edge);
  border-radius: 0;
  color: var(--sc-text);
  cursor: pointer;
  box-shadow: 3px 3px 0 0 #0d0f1c;
  padding: 3px 2px;
}
.sc-tool > span { font-size: 7px; color: var(--sc-dim); }
.sc-tool > kbd { font-size: 7px; color: var(--sc-gold); }
.sc-tool .sc-icon { width: 20px; height: 20px; image-rendering: pixelated; }
.sc-tool.is-active {
  border-color: var(--sc-gold);
  color: var(--sc-gold);
  background: var(--sc-ink);
  box-shadow: 0 0 0 2px var(--sc-gold);
}
.sc-tool.is-active > span { color: var(--sc-gold); }

/* --- bottom shop (FR-UX-013/014) --------------------------------------- */
.sc-shop {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 6px 8px;
  padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
  padding-left: calc(8px + env(safe-area-inset-left, 0px));
  padding-right: calc(8px + env(safe-area-inset-right, 0px));
  background: var(--sc-panel);
  border-top: 3px solid var(--sc-edge);
  box-shadow: 0 -3px 0 0 #0d0f1c;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.sc-shop-tabs { display: flex; gap: 4px; overflow-x: auto; pointer-events: none; scrollbar-width: none; }
.sc-shop-tabs::-webkit-scrollbar { display: none; }
.sc-tab {
  pointer-events: auto;
  min-height: 34px;
  padding: 3px 8px;
  background: var(--sc-panel-2);
  border: 3px solid var(--sc-edge);
  border-radius: 0;
  color: var(--sc-dim);
  cursor: pointer;
  white-space: nowrap;
  font-size: 9px;
}
.sc-tab.is-active { background: var(--sc-ink); border-color: var(--sc-gold); color: var(--sc-gold); }
.sc-tab .sc-count { color: var(--sc-dim); font-size: 8px; }
.sc-tab .sc-icon { width: 16px; height: 16px; image-rendering: pixelated; vertical-align: -3px; margin-right: 3px; }

.sc-shop-cards {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  pointer-events: none;
  scrollbar-width: thin;
  padding-bottom: 2px;
  min-height: 84px;
}
.sc-card {
  pointer-events: auto;
  flex: 0 0 auto;
  width: 116px;
  min-height: 78px;
  background: var(--sc-panel-2);
  border: 3px solid var(--sc-edge);
  border-radius: 0;
  color: var(--sc-text);
  cursor: pointer;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}
.sc-card:hover { border-color: var(--sc-dim); }
.sc-card.is-selected { border-color: var(--sc-gold); box-shadow: 0 0 0 2px var(--sc-gold); }
.sc-card .sc-name { font-size: 9px; color: var(--sc-text); }
.sc-card .sc-meta { font-size: 8px; color: var(--sc-dim); }
.sc-card .sc-cost { font-size: 9px; color: var(--sc-gold); }
.sc-card .sc-icon { width: 100%; height: 26px; image-rendering: pixelated; object-fit: contain; }

/* The modal shop's card — the SAME contract as the strip card
   (data-sc-card), sized for the panel grid instead of the strip. */
.sc-shopcard {
  pointer-events: auto;
  display: block;
  width: 100%;
  text-align: left;
  background: var(--sc-ink);
  border: 3px solid var(--sc-edge);
  border-radius: 0;
  color: var(--sc-text);
  cursor: pointer;
  padding: 5px 6px;
  font-family: inherit;
}
.sc-shopcard:hover { border-color: var(--sc-dim); }
.sc-shopcard.is-selected { border-color: var(--sc-gold); }
.sc-shopcard .sc-svc-name { color: var(--sc-text); }
.sc-shopcard .sc-note { margin-top: 2px; }
.sc-shop-empty { color: var(--sc-dim); font-size: 9px; padding: 8px; pointer-events: none; }

/* --- camera cluster ----------------------------------------------------- */
.sc-camctl {
  position: absolute;
  right: calc(8px + env(safe-area-inset-right, 0px));
  bottom: calc(110px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 5px;
  pointer-events: none;
}
.sc-camctl .sc-btn { min-width: 44px; padding: 4px 6px; font-size: 10px; }
.sc-camctl .sc-btn.is-active { border-color: var(--sc-gold); color: var(--sc-gold); }

/* --- toasts (FR-UX-107..110) ------------------------------------------- */
.sc-toasts {
  position: absolute;
  top: calc(112px + env(safe-area-inset-top, 0px));
  right: calc(8px + env(safe-area-inset-right, 0px));
  width: 250px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}
.sc-toast {
  pointer-events: auto;
  background: var(--sc-panel);
  border: 3px solid var(--sc-edge);
  border-left-width: 6px;
  border-radius: 0;
  padding: 5px 8px;
  font-size: 9px;
  color: var(--sc-text);
  box-shadow: 3px 3px 0 0 #0d0f1c;
  cursor: pointer;
}
.sc-toast[data-kind="info"] { border-left-color: var(--sc-blue); }
.sc-toast[data-kind="success"] { border-left-color: var(--sc-green); }
.sc-toast[data-kind="warn"] { border-left-color: var(--sc-gold); }
.sc-toast[data-kind="error"] { border-left-color: var(--sc-red); }
.sc-toast[data-kind="alert"] {
  border-left-color: var(--sc-red);
  border-color: var(--sc-red);
  background: #2a1024;
  font-weight: bold;
}
.sc-toast .sc-toast-pending { color: var(--sc-dim); font-size: 8px; }
.sc-toast-count {
  pointer-events: auto;
  align-self: flex-end;
  background: var(--sc-ink);
  border: 2px solid var(--sc-gold);
  color: var(--sc-gold);
  font-size: 8px;
  padding: 1px 5px;
}

/* --- modal panel (FR-UX-032/033) ---------------------------------------- */
.sc-panel {
  position: absolute;
  inset: 0;
  background: rgba(13, 15, 28, .78);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  z-index: 20;
}
.sc-panel[hidden] { display: none; }
.sc-panel-card {
  pointer-events: auto;
  width: min(720px, 92vw);
  max-height: 84vh;
  overflow: auto;
  background: var(--sc-panel);
  border: 3px solid var(--sc-edge);
  box-shadow: 6px 6px 0 0 #0d0f1c;
  padding: 10px;
}
.sc-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 3px solid var(--sc-edge);
  padding-bottom: 6px;
  margin-bottom: 8px;
}
.sc-panel-head h2 { margin: 0; font-size: 12px; color: var(--sc-gold); letter-spacing: .1em; }
.sc-panel-close { min-width: 44px; min-height: 44px; }

.sc-kv { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 5px; }
.sc-kv > div {
  background: var(--sc-ink);
  border: 2px solid var(--sc-edge);
  padding: 4px 6px;
}
.sc-kv span { display: block; font-size: 8px; color: var(--sc-dim); }
.sc-kv b { font-size: 11px; }

.sc-svcblock {
  background: var(--sc-ink);
  border: 2px solid var(--sc-edge);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sc-svcblock[data-developed="false"] { border-color: var(--sc-gold); }
.sc-svcblock .sc-svc-head { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.sc-svcblock .sc-svc-name { font-size: 9px; color: var(--sc-text); }
.sc-svcblock .sc-svc-note { font-size: 8px; color: var(--sc-gold); }
.sc-svcblock .sc-meter {
  height: 10px;
  background: var(--sc-panel-2);
  border: 2px solid var(--sc-edge);
}
.sc-svcblock .sc-meter > i { display: block; height: 100%; background: var(--sc-green); }
.sc-svcblock .sc-circle {
  width: 18px; height: 18px;
  border: 3px solid var(--sc-dim);
  display: inline-block;
  position: relative;
  /* A pixel-art DISC (an octagon), not a rounded rectangle: the 16-bit look
     forbids border-radius, and the coverage gauge is a circle in the game's
     own overview (FR-UX-036). */
  clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
}
.sc-svcblock .sc-circle > i {
  position: absolute;
  inset: 0;
  background: var(--sc-green);
  opacity: .85;
}
.sc-svcblock .sc-circle[data-full="false"] { border-color: var(--sc-gold); }
.sc-grid2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px; }

.sc-list { display: flex; flex-direction: column; gap: 3px; }
.sc-list > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  background: var(--sc-ink);
  border: 2px solid var(--sc-edge);
  padding: 3px 6px;
  font-size: 9px;
}
.sc-list .sc-dim { color: var(--sc-dim); }

.sc-legend { font-size: 8px; color: var(--sc-dim); margin: 6px 0; }
.sc-note { font-size: 8px; color: var(--sc-dim); line-height: 1.6; }
.sc-assumed {
  display: inline-block;
  border: 1px solid var(--sc-dim);
  color: var(--sc-dim);
  font-size: 7px;
  padding: 0 3px;
  margin-left: 4px;
  vertical-align: 1px;
}

/* --- licence honesty line ------------------------------------------------ */
.sc-licence {
  position: absolute;
  left: calc(8px + env(safe-area-inset-left, 0px));
  bottom: calc(112px + env(safe-area-inset-bottom, 0px));
  max-width: 340px;
  font-size: 7px;
  color: var(--sc-dim);
  background: rgba(13, 15, 28, .82);
  border: 2px solid var(--sc-edge);
  padding: 2px 5px;
  pointer-events: none;
}
.sc-licence[hidden] { display: none; }

/* --- studio (SCC) overlay ------------------------------------------------ */
.sc-studio {
  position: absolute;
  inset: 0;
  background: #0d0f1c;
  display: grid;
  grid-template-rows: auto 1fr auto;
  pointer-events: auto;
  z-index: 40;
}
.sc-studio[hidden] { display: none; }
.sc-studio-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  background: var(--sc-panel);
  border-bottom: 3px solid var(--sc-edge);
  padding: 6px 8px;
  padding-top: calc(6px + env(safe-area-inset-top, 0px));
}
.sc-studio-bar h2 { margin: 0 6px 0 0; font-size: 11px; color: var(--sc-gold); }
.sc-studio-view { position: relative; overflow: hidden; }
.sc-studio-view canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.sc-studio-hud {
  position: absolute;
  left: 8px;
  top: 8px;
  background: rgba(13, 15, 28, .86);
  border: 2px solid var(--sc-edge);
  padding: 5px 7px;
  font-size: 9px;
  pointer-events: none;
}
.sc-studio-hud b { color: var(--sc-gold); }
.sc-studio-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  background: var(--sc-panel);
  border-top: 3px solid var(--sc-edge);
  padding: 6px 8px;
  padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
}
.sc-palette { display: flex; gap: 3px; flex-wrap: wrap; }
.sc-swatch {
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  border: 3px solid var(--sc-edge);
  padding: 0;
  cursor: pointer;
  image-rendering: pixelated;
}
.sc-swatch.is-active { border-color: var(--sc-gold); box-shadow: 0 0 0 2px var(--sc-gold); }
.sc-studio-status {
  margin-left: auto;
  font-size: 9px;
  color: var(--sc-dim);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.sc-studio-status b { color: var(--sc-text); }

/* --- small screens ------------------------------------------------------ */
@media (max-width: 720px) {
  .sc-shop-cards { min-height: 72px; }
  .sc-card { width: 100px; }
  .sc-ticker { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .sc-hud * { transition: none !important; animation: none !important; }
}
`;

/** True once the stylesheet has been injected into a document. */
let injected = false;

/**
 * Inject the HUD stylesheet once. Safe to call in Node (returns false).
 * @param {Document|null} doc
 * @returns {boolean} true when the stylesheet was injected by this call.
 */
export function ensureStyles(doc) {
  const target = doc || (typeof document !== 'undefined' ? document : null);
  if (!target || injected) return false;
  const style = target.createElement('style');
  style.id = 'sc-hud-styles';
  style.setAttribute('data-sc-hud-styles', '1');
  style.textContent = HUD_STYLES;
  const head = target.head || target.getElementsByTagName('head')[0];
  if (!head) return false;
  head.appendChild(style);
  injected = true;
  return true;
}

export default HUD_STYLES;
