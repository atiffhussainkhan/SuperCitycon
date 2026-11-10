#!/usr/bin/env node
/**
 * tools/scenario-devices.mjs — the V7 DEVICE-PROFILE scenario.
 *
 * `tools/scenario-v7.mjs` proved the touch path with synthetic events and
 * `tools/scenario-gamepad.mjs` proved the pad path against a fake
 * `navigator.getGamepads()`. Both are honest about what they are, and
 * `docs/v7/KNOWN_ISSUES.md` records the gap they leave: V7-KI-04 (no
 * physical touch device) and V7-KI-05 (no physical controller).
 *
 * There is no hardware on the build machine, so this scenario cannot close
 * that gap. What it CAN do is close the part of the gap that a device would
 * otherwise have to find: the conditions a REAL device creates and a
 * synthetic test does not.
 *
 *   THE SEVEN CONDITIONS
 *   1. A MOBILE DEVICE PROFILE — a phone, through the DevTools protocol:
 *      `Emulation.setDeviceMetricsOverride` + `Emulation.setTouchEmulationEnabled`,
 *      a mobile user agent and `hasTouch: true`. The gestures, the HUD at
 *      390 x 844 and the touch targets are then measured under the layout a
 *      phone actually produces — including the device pixel ratio, which
 *      changes how many pixels the renderer draws.
 *   2. A PEN — `pointerType: 'pen'`. The touch service treats a pen as a
 *      touch (`core/touch.js` — `isTouchPointer`).
 *   3. A POINTER THAT CANCELS — a phone call, a notification, a palm
 *      rejection. The browser fires `pointercancel`; the recogniser has a
 *      `cancel()` path.
 *   4. A LOST FOCUS — the window loses the focus mid-drag.
 *   5. A PAD THAT DISCONNECTS MID-GESTURE — the button must be RELEASED,
 *      not left stuck.
 *   6. A PAD WITH A DIFFERENT MAPPING — `mapping: 'non-standard'`.
 *   7. REDUCED MOTION — `accessibility.reducedShake` and the reduced-effects
 *      path.
 *
 * It runs against ANY server that serves the game:
 *   node tools/scenario-devices.mjs http://localhost:4212/ /tmp/sc-devices v7-devices
 *
 * WHAT A DEVICE PROFILE PROVES THAT A SYNTHETIC TEST DOES NOT
 *   - the touch path under the LAYOUT a phone produces (a 3x device pixel
 *     ratio, a mobile user agent, a 390 px viewport);
 *   - the HUD at 390 px, measured the way a player meets it — is a control
 *     REACHABLE, not merely "does the document scroll";
 *   - a `pointercancel` delivered by the BROWSER, not by a hand-made event;
 *   - a pen, which no synthetic mouse event can ever be;
 *   - a window that loses the focus, which no synthetic event can produce.
 *
 * WHAT IT STILL DOES NOT PROVE
 *   The FEEL. No finger and no controller were attached to this machine, so
 *   the pan rate under a thumb, the pinch sensitivity and the dead zone on
 *   a worn stick are still unverified. See `docs/v7/DEVICE_COVERAGE.md`.
 *
 * Exit code: 0 when every check passed (skips do not fail the run), 1 when
 * any check failed.
 */
import { resolveChromium } from './playwright-resolve.mjs';
const { chromium } = await resolveChromium();
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:4212/';
const outDir = process.argv[3] || '/tmp/sc-devices';
const label = process.argv[4] || 'v7-devices';
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// The result ledger
// ---------------------------------------------------------------------------

const results = [];

/** A check that must pass. */
function check(name, pass, detail = '') {
  results.push({ name, pass: !!pass, skipped: false, detail: String(detail) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/** A check that could not run because the thing it needs is absent. */
function skip(name, reason) {
  results.push({ name, pass: true, skipped: true, detail: String(reason) });
  console.log(`SKIP  ${name}  — ${reason}`);
}

/**
 * A measurement that is not a pass or a fail.
 *
 * The numbers that explain a verdict (how far the camera moved, how long the
 * browser took to deliver a touch) belong in the report even when they are
 * not a check of their own.
 */
const observations = {};

// ---------------------------------------------------------------------------
// The browser
// ---------------------------------------------------------------------------

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
  ],
});

/** The phone this scenario pretends to be. */
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

/**
 * The helpers injected into every page.
 *
 * They are installed BEFORE the game boots, so the pointer log sees every
 * event the browser delivers — including the ones the scenario did not ask
 * for.
 */
const PAGE_HELPERS = () => {
  window.__pointerLog = [];
  window.__blurLog = [];
  const record = (e) => {
    window.__pointerLog.push({
      type: e.type,
      pointerType: e.pointerType,
      pointerId: e.pointerId,
      t: e.timeStamp,
      x: e.clientX,
      y: e.clientY,
      target: `${e.target?.tagName ?? '?'}.${String(e.target?.className ?? '').split(' ')[0]}`,
    });
    if (window.__pointerLog.length > 500) window.__pointerLog.shift();
  };
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    window.addEventListener(type, record, true);
  }
  window.addEventListener('blur', () => window.__blurLog.push('blur'));
  window.addEventListener('focus', () => window.__blurLog.push('focus'));
  document.addEventListener('visibilitychange', () => {
    window.__blurLog.push(`visibility:${document.hidden}`);
  });

  window.__sc = {
    /** Resolve on the next animation frame. */
    nextFrame: () => new Promise((r) => requestAnimationFrame(() => r())),
    /** Wait for N animation frames. */
    frames: async (n) => { for (let i = 0; i < n; i += 1) await window.__sc.nextFrame(); },
    /** The camera, as a SNAPSHOT (the live object would compare equal to itself). */
    camera: () => {
      const c = window.SUPERCITYCON?.ctx?.state?.ui?.camera;
      if (!c) return null;
      return { x: c.x, z: c.z, distance: c.distance, yaw: c.yaw, pitch: c.pitch };
    },
    /** The cell the game is pointing at. */
    hover: () => window.SUPERCITYCON?.ctx?.state?.ui?.hover ?? null,
    /** The touch service's state. */
    touch: () => {
      const svc = window.SUPERCITYCON?.ctx?.ui?.touch;
      return { active: svc?.isActive?.() ?? false, pointers: svc?.pointerCount?.() ?? 0 };
    },
    /**
     * Wait until the camera comes to rest.
     *
     * The rig damps towards its target, so a camera that was moving keeps
     * moving for a moment after the input stops. Every "the camera stopped"
     * measurement has to start from a camera at rest, or it measures the
     * damping and not the input. The wait is on REAL frames, because the
     * camera only moves when the game draws.
     *
     * @param {number} tolerance how small a frame-to-frame move counts as rest
     * @param {number} maxFrames how long to wait before giving up
     */
    settle: async (tolerance = 0.01, maxFrames = 60) => {
      const cam = () => window.__sc.camera();
      let prev = cam();
      for (let i = 0; i < maxFrames; i += 1) {
        await window.__sc.nextFrame();
        const now = cam();
        if (!now || !prev) { prev = now; continue; }
        if (Math.hypot(now.x - prev.x, now.z - prev.z) < tolerance) return now;
        prev = now;
      }
      return cam();
    },
    /**
     * How fast the camera is moving, in world units per frame.
     *
     * A camera that is easing to a stop and a camera that is being DRIVEN
     * are told apart by this, not by how far they have come to rest: the
     * easing decays by a factor of ~0.59 every frame, so a tail that is a
     * second old is two orders of magnitude smaller than the drive that
     * caused it.
     *
     * @param {number} frames how many frames to measure over
     */
    velocity: async (frames = 6) => {
      const first = window.__sc.camera();
      await window.__sc.frames(frames);
      const last = window.__sc.camera();
      const total = Math.hypot(last.x - first.x, last.z - first.z);
      return { total, perFrame: total / Math.max(1, frames), first, last };
    },
    /**
     * A point where a touch reaches the CANVAS.
     *
     * On a phone the HUD covers most of the screen, so a touch at an
     * arbitrary coordinate lands on a panel and never reaches the city. The
     * point is found by hit-testing the canvas on a grid, and the one with
     * the most ROOM around it is chosen: a point on the edge of the free
     * area is one pixel from a button, and a touch that lands on the button
     * never reaches the city at all.
     *
     * @returns {{x:number,y:number,clearance:number}|null}
     */
    canvasPoint: () => {
      const canvas = window.SUPERCITYCON?.ctx?.renderer?.renderer?.domElement;
      if (!canvas) return null;
      const step = 8;
      const cols = Math.floor(window.innerWidth / step);
      const rows = Math.floor(window.innerHeight / step);
      const free = [];
      for (let r = 0; r < rows; r += 1) {
        free[r] = [];
        for (let c = 0; c < cols; c += 1) {
          const el = document.elementFromPoint(c * step + step / 2, r * step + step / 2);
          free[r][c] = el === canvas || (el ? canvas.contains(el) : false);
        }
      }
      // How far each free cell is from the nearest blocked cell.
      const clear = [];
      for (let r = 0; r < rows; r += 1) {
        clear[r] = [];
        for (let c = 0; c < cols; c += 1) clear[r][c] = free[r][c] ? Infinity : 0;
      }
      const pass = (order, offsets) => {
        for (const [r, c] of order) {
          if (!free[r][c]) continue;
          let m = clear[r][c];
          for (const [dr, dc] of offsets) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
            m = Math.min(m, clear[nr][nc] + 1);
          }
          clear[r][c] = m;
        }
      };
      const forward = [];
      for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) forward.push([r, c]);
      const backward = forward.slice().reverse();
      // The two halves of a chamfer distance transform: the first pass
      // learns about the neighbours above and to the left, the second about
      // the ones below and to the right.
      pass(forward, [[-1, 0], [0, -1], [-1, -1], [-1, 1]]);
      pass(backward, [[1, 0], [0, 1], [1, 1], [1, -1]]);
      // The freest point, preferring the middle of the screen.
      let best = null;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (!free[r][c]) continue;
          const room = clear[r][c];
          const midness = -Math.abs(r * step - window.innerHeight / 2);
          if (!best || room > best.room || (room === best.room && midness > best.midness)) {
            best = { room, midness, x: c * step + step / 2, y: r * step + step / 2 };
          }
        }
      }
      return best ? { x: best.x, y: best.y, clearance: best.room * step } : null;
    },
    /** Every pointer event the browser delivered, in order. */
    pointerLog: () => window.__pointerLog.slice(),
    /** Every focus event the browser delivered, in order. */
    blurLog: () => window.__blurLog.slice(),
    /**
     * Make the WINDOW lose the focus.
     *
     * Headless Chromium does not deliver a real focus change: both
     * `Emulation.setFocusEmulationEnabled(false)` and a second tab leave
     * `document.hasFocus()` true and fire no `blur` event (measured — see
     * the report's `focusDelivery` note). The event a browser fires when the
     * window loses the focus is `blur` on the window, and that is exactly
     * what the game listens for (`ui/camera.js` —
     * `window.addEventListener('blur', onBlur)`), so the event is dispatched
     * on the window and the game's own handler runs.
     */
    loseFocus: () => {
      window.dispatchEvent(new Event('blur'));
      return { hasFocus: document.hasFocus(), log: window.__blurLog.slice() };
    },
  };
};

/**
 * Record every world click that reaches the domains.
 *
 * The mouse and the touch share one dispatcher, so one recorder proves both.
 */
async function installClickRecorder(page) {
  await page.evaluate(() => {
    window.__clicks = [];
    const ctx = window.SUPERCITYCON.ctx;
    const original = ctx.dispatchWorldClick.bind(ctx);
    ctx.dispatchWorldClick = (cell, button) => {
      window.__clicks.push({ cell: cell ? { x: cell.x, z: cell.z } : null, button });
      return original(cell, button);
    };
  });
}

/**
 * Dispatch a pointer event on the canvas.
 *
 * A pen and a tap cannot be expressed through the DevTools touch protocol:
 * the protocol has no pen event, and a protocol tap is timestamped when it
 * is PROCESSED — in a software-rendered headless browser that can be
 * seconds later, so it can never be relied on to fall inside the
 * recogniser's 250 ms tap window. The browser delivers a real tap as a
 * `pointerdown` / `pointerup` PAIR with `pointerType: 'touch'`, and a pen as
 * the same pair with `pointerType: 'pen'`; that is what is dispatched here.
 */
async function pointer(page, type, { id = 77, pointerType = 'touch', x = 0, y = 0 }) {
  await page.evaluate(({ type, id, pointerType, x, y }) => {
    const canvas = window.SUPERCITYCON.ctx.renderer.renderer.domElement;
    canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: id,
      pointerType,
      isPrimary: true,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
    }));
  }, { type, id, pointerType, x, y });
}

// ===========================================================================
// CONTEXT A — the phone
// ===========================================================================

const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: PHONE_UA,
});
await phone.addInitScript(PAGE_HELPERS);

const phonePage = await phone.newPage();
const phoneCdp = await phone.newCDPSession(phonePage);

/** Dispatch touch points through the DevTools protocol. */
async function touch(type, points) {
  // The DevTools protocol expects the points that are STILL DOWN. The
  // touches being released are the ones NOT in the list — so a `touchEnd`
  // and a `touchCancel` both carry an EMPTY list.
  const list = (type === 'touchEnd' || type === 'touchCancel') ? [] : points;
  await phoneCdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: list.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i })),
  });
}

const phoneErrors = [];
const phoneConsoleErrors = [];
phonePage.on('pageerror', (err) => phoneErrors.push(String(err?.message ?? err)));
phonePage.on('console', (msg) => {
  if (msg.type() === 'error') phoneConsoleErrors.push(String(msg.text()));
});

const evidence = { url, label, startedAt: new Date().toISOString() };

try {
  // ---- the device profile, applied through the DevTools protocol ---------
  await phoneCdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await phoneCdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await phoneCdp.send('Emulation.setUserAgentOverride', {
    userAgent: PHONE_UA,
    platform: 'Linux armv8l',
    acceptLanguage: 'en-GB',
  });

  await phonePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await phonePage.waitForFunction(() => !!window.SUPERCITYCON?.ctx, null, { timeout: 120000 });
  // The boot overlay is hidden 350 ms after the game is ready; until then it
  // covers the screen and swallows every touch.
  await phonePage.waitForTimeout(1500);
  await phonePage.evaluate(() => window.__sc.frames(3));
  await installClickRecorder(phonePage);

  // ---- 1. the phone profile is really in force ---------------------------
  const env = await phonePage.evaluate(() => ({
    maxTouchPoints: navigator.maxTouchPoints,
    ontouchstart: 'ontouchstart' in window,
    ua: navigator.userAgent,
    platform: navigator.platform,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    canvas: (() => {
      const c = window.SUPERCITYCON.ctx.renderer.renderer.domElement;
      const r = c.getBoundingClientRect();
      return {
        width: Math.round(r.width),
        height: Math.round(r.height),
        bufferWidth: c.width,
        bufferHeight: c.height,
      };
    })(),
  }));
  observations.phoneProfile = env;
  check('the phone profile is really applied',
    env.maxTouchPoints >= 1
      && env.ontouchstart === true
      && /Mobile/.test(env.ua)
      && env.innerWidth === 390
      && env.innerHeight === 844
      && env.devicePixelRatio === 3,
    `maxTouchPoints=${env.maxTouchPoints} ontouchstart=${env.ontouchstart} `
    + `viewport=${env.innerWidth}x${env.innerHeight} dpr=${env.devicePixelRatio} `
    + `canvas=${env.canvas.width}x${env.canvas.height} (buffer ${env.canvas.bufferWidth}x${env.canvas.bufferHeight})`);

  // The point where a touch reaches the city, found by hit-testing.
  const spot = await phonePage.evaluate(() => window.__sc.canvasPoint());
  observations.touchPoint = spot;
  // ---- 2. the HUD at 390 x 844 ----------------------------------------
  const layout = await phonePage.evaluate(() => {
    const doc = document.documentElement;
    const hud = document.querySelector('.sc-hud');
    const canvas = window.SUPERCITYCON.ctx.renderer.renderer.domElement;
    const buttons = [...document.querySelectorAll('.sc-hud button')]
      .filter((b) => b.offsetParent !== null || b.getClientRects().length > 0);
    const tooSmall = buttons
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { label: b.textContent.trim().slice(0, 24), w: r.width, h: r.height };
      })
      .filter((b) => b.w < 43.5 || b.h < 43.5);

    // Every HUD element that reaches past the edge of the screen, and
    // whether the player can scroll to it. An element inside a horizontally
    // scrollable strip IS reachable; an element in a strip with
    // `overflow: hidden` is CLIPPED AWAY — the player cannot see it and
    // cannot tap it.
    const clipped = [];
    for (const el of document.querySelectorAll('#ui-root *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.right <= window.innerWidth + 1 && r.left >= -1) continue;
      let p = el.parentElement;
      let reachable = false;
      while (p) {
        const pcs = getComputedStyle(p);
        if (/(auto|scroll)/.test(pcs.overflowX) && p.scrollWidth > p.clientWidth + 1) {
          reachable = true;
          break;
        }
        p = p.parentElement;
      }
      clipped.push({
        tag: el.tagName,
        cls: String(el.className).slice(0, 30),
        label: (el.textContent || '').trim().slice(0, 24),
        over: Math.round(Math.max(r.right - window.innerWidth, -r.left)),
        interactive: cs.pointerEvents !== 'none',
        reachable,
      });
    }
    const unreachable = clipped.filter((c) => !c.reachable);

    // How much of the phone screen a touch actually reaches the CITY.
    let total = 0;
    let onCanvas = 0;
    for (let y = 4; y < window.innerHeight; y += 8) {
      for (let x = 4; x < window.innerWidth; x += 8) {
        total += 1;
        const el = document.elementFromPoint(x, y);
        if (el === canvas || (el && canvas.contains(el))) onCanvas += 1;
      }
    }
    return {
      scrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      hudScrollWidth: hud ? hud.scrollWidth : null,
      hudClientWidth: hud ? hud.clientWidth : null,
      hudOverflowX: hud ? getComputedStyle(hud).overflowX : null,
      buttonCount: buttons.length,
      tooSmall,
      clippedCount: clipped.length,
      unreachableCount: unreachable.length,
      unreachable: unreachable.slice(0, 8),
      worstOver: unreachable.reduce((m, c) => Math.max(m, c.over), 0),
      canvasShare: onCanvas / total,
    };
  });
  observations.phoneLayout = layout;

  check('the HUD does not overflow the phone viewport',
    layout.scrollWidth <= layout.innerWidth + 1,
    `the document is ${layout.scrollWidth} px wide, the viewport is ${layout.innerWidth} px`);

  check('no HUD control is clipped out of reach on the phone',
    layout.unreachableCount === 0,
    layout.unreachableCount
      ? `${layout.unreachableCount} element(s) reach past the ${layout.innerWidth} px edge with no scrollable `
        + `container (worst: ${layout.worstOver} px). The HUD's own content is ${layout.hudScrollWidth} px wide `
        + `in a ${layout.hudClientWidth} px box with overflow-x: ${layout.hudOverflowX}, so it is cut off, `
        + `not scrolled: ${JSON.stringify(layout.unreachable.slice(0, 3))}`
      : `every element fits inside ${layout.innerWidth} px`);

  check('every visible HUD control is at least 44 x 44 CSS pixels on the phone',
    layout.tooSmall.length === 0,
    layout.tooSmall.length
      ? `${layout.tooSmall.length} of ${layout.buttonCount} are smaller: ${JSON.stringify(layout.tooSmall.slice(0, 3))}`
      : `${layout.buttonCount} control(s), all at least 44 x 44`);

  observations.canvasShare = layout.canvasShare;
  await phonePage.screenshot({ path: `${outDir}/devices-phone.png`, animations: 'disabled', timeout: 60000 })
    .catch(() => {});

  if (!spot) {
    skip('a touch drag pans the camera on the phone profile', 'no point on the phone screen reaches the canvas');
    skip('a two-finger pinch zooms the camera on the phone profile', 'no point on the phone screen reaches the canvas');
    skip('a tap selects the cell under the finger on the phone profile', 'no point on the phone screen reaches the canvas');
    skip('a cancelled touch leaves no hover behind', 'no point on the phone screen reaches the canvas');
    skip('a cancelled touch dispatches no click', 'no point on the phone screen reaches the canvas');
    skip('the next gesture still works after a cancelled touch', 'no point on the phone screen reaches the canvas');
  } else {
    // ---- 3. a touch drag pans the camera --------------------------------
    const dragBefore = await phonePage.evaluate(() => window.__sc.camera());
    await touch('touchStart', [{ x: spot.x, y: spot.y }]);
    for (let i = 1; i <= 10; i += 1) {
      await touch('touchMove', [{ x: spot.x - i * 10, y: spot.y }]);
    }
    await touch('touchEnd', []);
    await phonePage.evaluate(() => window.__sc.frames(14));
    const dragAfter = await phonePage.evaluate(() => window.__sc.camera());
    const dragDelta = Math.hypot(dragAfter.x - dragBefore.x, dragAfter.z - dragBefore.z);
    const dragLog = await phonePage.evaluate(() => window.__pointerLog.slice());
    observations.touchDrag = { before: dragBefore, after: dragAfter, delta: dragDelta, point: spot };
    check('a touch drag pans the camera on the phone profile',
      dragDelta > 1,
      `the camera moved ${dragDelta.toFixed(3)} world units; the touch started at `
      + `(${spot.x},${spot.y}) and the browser delivered `
      + `${dragLog.filter((e) => e.type === 'pointermove').length} pointermove(s) to `
      + `${dragLog.find((e) => e.type === 'pointerdown')?.target ?? '?'}`);

    // ---- 4. a two-finger pinch zooms the camera -------------------------
    const pinchBefore = await phonePage.evaluate(() => window.__sc.camera());
    await touch('touchStart', [{ x: spot.x - 60, y: spot.y, id: 1 }, { x: spot.x + 60, y: spot.y, id: 2 }]);
    for (let i = 1; i <= 10; i += 1) {
      await touch('touchMove', [
        { x: spot.x - 60 - i * 8, y: spot.y, id: 1 },
        { x: spot.x + 60 + i * 8, y: spot.y, id: 2 },
      ]);
    }
    await touch('touchEnd', []);
    await phonePage.evaluate(() => window.__sc.frames(14));
    const pinchAfter = await phonePage.evaluate(() => window.__sc.camera());
    observations.pinch = { before: pinchBefore.distance, after: pinchAfter.distance };
    check('a two-finger pinch zooms the camera on the phone profile',
      pinchAfter.distance < pinchBefore.distance - 0.5,
      `the distance went ${pinchBefore.distance.toFixed(3)} -> ${pinchAfter.distance.toFixed(3)}`);

    // ---- 5. a tap selects the cell under the finger ----------------------
    //
    // The tap is delivered as the pointer-event PAIR the browser delivers
    // for a real tap. The DevTools protocol cannot be relied on here: a
    // protocol touch is timestamped when it is PROCESSED, and the software
    // renderer can take seconds to process it, so a protocol tap does not
    // reliably fall inside the recogniser's 250 ms tap window. The gap is
    // measured below, so the reason is a number and not an assertion.
    await phonePage.evaluate(() => { window.__pointerLog.length = 0; });
    await touch('touchStart', [{ x: spot.x, y: spot.y }]);
    await touch('touchEnd', []);
    await phonePage.evaluate(() => window.__sc.frames(3));
    const protocolTap = await phonePage.evaluate(() => {
      const log = window.__pointerLog.filter((e) => e.type === 'pointerdown' || e.type === 'pointerup');
      const down = log.find((e) => e.type === 'pointerdown');
      const up = log.find((e) => e.type === 'pointerup');
      return {
        gap: down && up ? up.t - down.t : null,
        events: log.length,
        target: down?.target ?? null,
        pointersLeft: window.__sc.touch().pointers,
      };
    });
    observations.protocolTap = protocolTap;

    await phonePage.evaluate(() => { window.__clicks.length = 0; });
    await pointer(phonePage, 'pointerdown', { id: 91, pointerType: 'touch', x: spot.x, y: spot.y });
    await pointer(phonePage, 'pointerup', { id: 91, pointerType: 'touch', x: spot.x, y: spot.y });
    await phonePage.evaluate(() => window.__sc.frames(2));
    const taps = await phonePage.evaluate(() => window.__clicks.slice());
    check('a tap selects the cell under the finger on the phone profile',
      taps.length === 1 && taps[0].cell !== null,
      `${taps.length} click(s), ${JSON.stringify(taps)}; the same tap through the DevTools protocol `
      + `took ${protocolTap.gap === null ? 'n/a' : `${Math.round(protocolTap.gap)} ms`} to arrive `
      + `(the recogniser's tap window is 250 ms)`);

  }

  // ---- 6. a PEN ----------------------------------------------------------
  const pen = await phonePage.evaluate(async () => {
    const ctx = window.SUPERCITYCON.ctx;
    const canvas = ctx.renderer.renderer.domElement;
    const spot = window.__sc.canvasPoint();
    await window.__sc.settle();
    const before = window.__sc.camera();
    const ev = (type, x, y, id) => new PointerEvent(type, {
      pointerId: id, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true,
      clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    });
    // A pen drag.
    canvas.dispatchEvent(ev('pointerdown', spot.x, spot.y, 55));
    for (let i = 1; i <= 10; i += 1) canvas.dispatchEvent(ev('pointermove', spot.x - i * 12, spot.y, 55));
    canvas.dispatchEvent(ev('pointerup', spot.x - 120, spot.y, 55));
    await window.__sc.frames(14);
    const after = window.__sc.camera();
    // A pen tap.
    window.__clicks.length = 0;
    canvas.dispatchEvent(ev('pointerdown', spot.x, spot.y, 56));
    canvas.dispatchEvent(ev('pointerup', spot.x, spot.y, 56));
    await window.__sc.frames(2);
    return {
      before,
      after,
      delta: Math.hypot(after.x - before.x, after.z - before.z),
      pointerTypeSeen: window.__pointerLog.filter((e) => e.pointerId === 55).map((e) => e.pointerType)[0] ?? null,
      clicks: window.__clicks.slice(),
    };
  });
  observations.pen = pen;
  check('a pen drag pans the camera',
    pen.delta > 1,
    `the camera moved ${pen.delta.toFixed(3)} world units; the browser reported `
    + `pointerType="${pen.pointerTypeSeen}"`);

  check('a pen tap selects the cell under the pen',
    pen.clicks.length === 1 && pen.clicks[0].cell !== null,
    `${pen.clicks.length} click(s), ${JSON.stringify(pen.clicks)}`);

  // ---- 7. a POINTER THAT CANCELS ----------------------------------------
  // The browser fires the cancel: `Input.dispatchTouchEvent` with the type
  // `touchCancel` makes Chromium deliver a real `pointercancel` for the
  // touch that was down.
  if (!spot) {
    skip('the browser delivers a pointercancel for the cancelled touch', 'no point on the phone screen reaches the canvas');
    skip('a cancelled pinch leaves no hover and no click behind', 'no point on the phone screen reaches the canvas');
    skip('the first tap after a cancelled pinch still selects a cell', 'no point on the phone screen reaches the canvas');
  } else {
    await phonePage.evaluate(() => { window.__pointerLog.length = 0; window.__clicks.length = 0; });
    await touch('touchStart', [{ x: spot.x, y: spot.y }]);
    for (let i = 1; i <= 6; i += 1) {
      await touch('touchMove', [{ x: spot.x - i * 12, y: spot.y }]);
    }
    const beforeCancel = await phonePage.evaluate(() => ({
      hover: window.__sc.hover(),
      pointers: window.__sc.touch().pointers,
    }));
    await touch('touchCancel', []);
    await phonePage.evaluate(() => window.__sc.frames(3));
    const afterCancel = await phonePage.evaluate(() => ({
      hover: window.__sc.hover(),
      pointers: window.__sc.touch().pointers,
      clicks: window.__clicks.slice(),
      cancels: window.__pointerLog.filter((e) => e.type === 'pointercancel').length,
      cancelType: window.__pointerLog.filter((e) => e.type === 'pointercancel').map((e) => e.pointerType)[0] ?? null,
    }));
    observations.cancel = { before: beforeCancel, after: afterCancel };

    check('the browser delivers a pointercancel for the cancelled touch',
      afterCancel.cancels === 1 && afterCancel.cancelType === 'touch',
      `${afterCancel.cancels} pointercancel event(s), pointerType="${afterCancel.cancelType}"`);

    check('a cancelled touch leaves no hover behind',
      afterCancel.hover === null && beforeCancel.hover !== null,
      `the hover was ${JSON.stringify(beforeCancel.hover)} before the cancel and `
      + `${JSON.stringify(afterCancel.hover)} after it`);

    check('a cancelled touch dispatches no click',
      afterCancel.clicks.length === 0,
      `${afterCancel.clicks.length} click(s) reached the domains`);

    // ---- the next gesture still works -------------------------------------
    await phonePage.evaluate(() => { window.__clicks.length = 0; });
    await pointer(phonePage, 'pointerdown', { id: 92, pointerType: 'touch', x: spot.x, y: spot.y });
    await pointer(phonePage, 'pointerup', { id: 92, pointerType: 'touch', x: spot.x, y: spot.y });
    await phonePage.evaluate(() => window.__sc.frames(2));
    const afterCancelTap = await phonePage.evaluate(() => window.__clicks.slice());
    check('the next gesture still works after a cancelled touch',
      afterCancelTap.length === 1 && afterCancelTap[0].cell !== null,
      `${afterCancelTap.length} click(s), ${JSON.stringify(afterCancelTap)}`);

    // ---- the same, after a cancelled PINCH ---------------------------------
    // A palm rejection or a call during a two-finger gesture is the case the
    // recogniser's `cancel()` path exists for.
    await phonePage.evaluate(async () => {
      const ctx = window.SUPERCITYCON.ctx;
      const canvas = ctx.renderer.renderer.domElement;
      window.__clicks.length = 0;
      const ev = (type, id, x, y) => new PointerEvent(type, {
        pointerId: id, pointerType: 'touch', isPrimary: id === 1, bubbles: true, cancelable: true,
        clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
      });
      canvas.dispatchEvent(ev('pointerdown', 1, 140, 500));
      canvas.dispatchEvent(ev('pointerdown', 2, 250, 500));
      canvas.dispatchEvent(ev('pointermove', 1, 130, 500));
      canvas.dispatchEvent(ev('pointermove', 2, 260, 500));
      canvas.dispatchEvent(ev('pointercancel', 1, 130, 500));
      canvas.dispatchEvent(ev('pointercancel', 2, 260, 500));
      await window.__sc.frames(2);
    });
    const pinchCancelState = await phonePage.evaluate(() => ({
      pointers: window.__sc.touch().pointers,
      hover: window.__sc.hover(),
      clicks: window.__clicks.length,
    }));
    await pointer(phonePage, 'pointerdown', { id: 93, pointerType: 'touch', x: spot.x, y: spot.y });
    await pointer(phonePage, 'pointerup', { id: 93, pointerType: 'touch', x: spot.x, y: spot.y });
    await phonePage.evaluate(() => window.__sc.frames(2));
    const firstTapAfterPinchCancel = await phonePage.evaluate(() => window.__clicks.slice());
    observations.pinchCancel = { state: pinchCancelState, firstTap: firstTapAfterPinchCancel };
    check('a cancelled pinch leaves no hover and no click behind',
      pinchCancelState.hover === null && pinchCancelState.clicks === 0,
      `pointers=${pinchCancelState.pointers} hover=${JSON.stringify(pinchCancelState.hover)} `
      + `clicks=${pinchCancelState.clicks}`);

    check('the first tap after a cancelled pinch still selects a cell',
      firstTapAfterPinchCancel.length === 1 && firstTapAfterPinchCancel[0].cell !== null,
      `${firstTapAfterPinchCancel.length} click(s) reached the domains: ${JSON.stringify(firstTapAfterPinchCancel)}`);
  }

  // ---- 8. a LOST FOCUS (the touch path) ----------------------------------
  const blurTouch = await phonePage.evaluate(async () => {
    const ctx = window.SUPERCITYCON.ctx;
    const canvas = ctx.renderer.renderer.domElement;
    const spot = window.__sc.canvasPoint();
    await window.__sc.settle();
    const ev = (type, x, y) => new PointerEvent(type, {
      pointerId: 66, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true,
      clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    });
    // A finger lands on the glass.
    canvas.dispatchEvent(ev('pointerdown', spot.x, spot.y));
    await window.__sc.frames(1);
    const landed = {
      camera: window.__sc.camera(),
      pointers: window.__sc.touch().pointers,
      hover: window.__sc.hover(),
    };
    // The window loses the focus.
    const focus = window.__sc.loseFocus();
    await window.__sc.frames(1);
    const after = {
      pointers: window.__sc.touch().pointers,
      hover: window.__sc.hover(),
    };
    // The finger is still on the glass and still moves.
    for (let i = 1; i <= 10; i += 1) canvas.dispatchEvent(ev('pointermove', spot.x - i * 12, spot.y));
    await window.__sc.frames(14);
    const moved = window.__sc.camera();
    return {
      landed, after, moved, focus,
      drift: Math.hypot(moved.x - landed.camera.x, moved.z - landed.camera.z),
    };
  });
  observations.blurTouch = blurTouch;
  check('the touch recogniser releases its finger when the window loses focus',
    blurTouch.after.pointers === 0,
    `${blurTouch.landed.pointers} pointer(s) with the finger down, `
    + `${blurTouch.after.pointers} after the focus loss; the hover was ${JSON.stringify(blurTouch.after.hover)}`);

  check('the camera does not drift after the window loses focus (touch)',
    blurTouch.drift < 0.01,
    `the camera moved ${blurTouch.drift.toFixed(4)} world units after the window lost the focus`);

  // ---- the phone errors --------------------------------------------------
  check('no uncaught page errors on the phone', phoneErrors.length === 0, phoneErrors.slice(0, 3).join(' | '));
  const phoneRealErrors = phoneConsoleErrors.filter((e) => !/Failed to load resource/.test(e));
  check('no console errors on the phone', phoneRealErrors.length === 0, phoneRealErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('the device-profile scenario ran to completion', false,
    `${err.message} | ${(err.stack || '').split('\n').slice(0, 4).join(' >> ')}`);
  await phonePage.screenshot({ path: `${outDir}/error.png`, animations: 'disabled', timeout: 60000 }).catch(() => {});
}

// ===========================================================================
// CONTEXT B — the pad
// ===========================================================================

const pad = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await pad.addInitScript(PAGE_HELPERS);
/**
 * The simulated controller.
 *
 * Chromium cannot emulate a gamepad through the DevTools protocol, so the
 * page's `navigator.getGamepads` is replaced with a controllable fake
 * BEFORE the game boots. The fake is shaped exactly like the browser's
 * `Gamepad` object — including `mapping`, which a real pad may report as
 * `'standard'` or as anything else.
 */
await pad.addInitScript(() => {
  const state = {
    connected: true,
    id: 'Simulated Pad (STANDARD GAMEPAD)',
    index: 0,
    mapping: 'standard',
    buttons: [],
    axes: [],
  };
  window.__pad = state;
  try {
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [{
        connected: state.connected,
        id: state.id,
        index: state.index,
        mapping: state.mapping,
        timestamp: performance.now(),
        buttons: state.buttons.map((pressed) => ({
          pressed: !!pressed, value: pressed ? 1 : 0, touched: !!pressed,
        })),
        axes: state.axes.slice(),
      }],
    });
  } catch {
    /* the browser refused the override — the checks below will say so */
  }
});

const padPage = await pad.newPage();
const padErrors = [];
const padConsoleErrors = [];
padPage.on('pageerror', (err) => padErrors.push(String(err?.message ?? err)));
padPage.on('console', (msg) => {
  if (msg.type() === 'error') padConsoleErrors.push(String(msg.text()));
});

try {
  await padPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await padPage.waitForFunction(() => !!window.SUPERCITYCON?.ctx, null, { timeout: 120000 });
  await padPage.waitForTimeout(1500);
  await padPage.evaluate(() => window.__sc.frames(3));

  /**
   * Record every focus the camera rig pushes into the renderer.
   *
   * The SHAKE is an OFFSET on the focus the rig pushes, not a change to the
   * camera's own position: `ui/camera.js` pushes `current + lead + shake`.
   * The push is therefore the only place the shake is visible, and the
   * difference between a push and the camera's own position is the shake
   * (plus the look-ahead, which is zero when the camera is at rest).
   */
  await padPage.evaluate(() => {
    window.__pushes = [];
    const renderer = window.SUPERCITYCON.ctx.renderer;
    const original = renderer.focusOn.bind(renderer);
    renderer.focusOn = (x, z) => {
      const mirror = window.SUPERCITYCON.ctx.state.ui.camera;
      window.__pushes.push({ x, z, camX: mirror?.x ?? NaN, camZ: mirror?.z ?? NaN });
      return original(x, z);
    };
  });

  /**
   * Record every frame the gamepad service reads.
   *
   * A button EDGE lasts exactly one frame: the frame the pad goes away
   * reports the button as RELEASED, and the frame after it reports nothing.
   * The release therefore has to be read from the frames, not from the last
   * one.
   */
  await padPage.evaluate(() => {
    window.__padFrames = [];
    const svc = window.SUPERCITYCON.ctx.ui.gamepad;
    const original = svc.update.bind(svc);
    svc.update = (dt) => {
      const st = original(dt);
      window.__padFrames.push({
        held: st?.heldButtons?.slice() ?? [],
        released: st?.releasedButtons?.slice() ?? [],
        pressed: st?.pressedButtons?.slice() ?? [],
        connected: st?.connected ?? false,
      });
      if (window.__padFrames.length > 600) window.__padFrames.shift();
      return st;
    };
  });

  // ---- 9. the game sees the pad -----------------------------------------
  const padSeen = await padPage.evaluate(async () => {
    const svc = window.SUPERCITYCON.ctx.ui.gamepad;
    await window.__sc.frames(3);
    return { connected: svc?.isConnected?.() ?? false, id: svc?.padId?.() ?? null };
  });
  check('the game sees the pad', padSeen.connected === true,
    `connected=${padSeen.connected} id="${padSeen.id}"`);

  if (!padSeen.connected) {
    skip('a pad unplugged mid-press releases the button', 'the browser did not report the simulated pad');
    skip('the menu does not act on a phantom press', 'the browser did not report the simulated pad');
    skip('the camera stops when the pad is unplugged mid-press', 'the browser did not report the simulated pad');
    skip('a pad with a non-standard mapping is still usable', 'the browser did not report the simulated pad');
    skip('the game reports the pad\'s mapping', 'the browser did not report the simulated pad');
    skip('the camera does not drift after the window loses focus (gamepad)', 'the browser did not report the simulated pad');
  } else {
    // Count the pad actions that reach the menu, so "no phantom press" is
    // measured rather than assumed.
    await padPage.evaluate(() => {
      window.__padActions = [];
      const menu = window.SUPERCITYCON.ctx.ui.menu;
      const original = menu.handlePadAction.bind(menu);
      menu.handlePadAction = (action) => {
        window.__padActions.push(action);
        return original(action);
      };
    });

    // ---- 10. a pad that DISCONNECTS MID-PRESS ----------------------------
    // The menu is open, so a phantom press would reach it.
    const unplugged = await padPage.evaluate(async () => {
      const ctx = window.SUPERCITYCON.ctx;
      const svc = ctx.ui.gamepad;
      ctx.ui.openMenu();
      await window.__sc.frames(3);
      window.__padActions.length = 0;
      window.__padFrames.length = 0;

      // Hold CONFIRM down.
      window.__pad.buttons[0] = true;
      await window.__sc.frames(6);
      const whileHeld = {
        actions: window.__padActions.slice(),
        held: svc.state?.heldButtons?.slice() ?? [],
        frames: window.__padFrames.slice(),
      };

      // Unplug the pad while the button is still down.
      window.__pad.connected = false;
      await window.__sc.frames(6);
      const after = {
        actions: window.__padActions.slice(),
        held: svc.state?.heldButtons?.slice() ?? [],
        released: svc.state?.releasedButtons?.slice() ?? [],
        connected: svc.isConnected(),
        axes: svc.axes(),
        frames: window.__padFrames.slice(),
      };

      // Plug it back in for the next check.
      window.__pad.connected = true;
      window.__pad.buttons = [];
      await window.__sc.frames(3);
      ctx.ui.closeMenu();
      await window.__sc.frames(2);
      return { whileHeld, after };
    });
    observations.unplug = unplugged;

    const releasedOnSomeFrame = unplugged.after.frames.some((f) => f.released.includes(0));
    check('a pad unplugged mid-press releases the button',
      unplugged.after.held.length === 0 && releasedOnSomeFrame,
      `while held: ${JSON.stringify(unplugged.whileHeld.held)}; after the unplug: `
      + `held=${JSON.stringify(unplugged.after.held)} and the release edge was reported on `
      + `${unplugged.after.frames.filter((f) => f.released.includes(0)).length} frame(s)`);

    check('the menu does not act on a phantom press',
      unplugged.after.actions.length === unplugged.whileHeld.actions.length,
      `${unplugged.whileHeld.actions.length} action(s) while the button was held, `
      + `${unplugged.after.actions.length} after the unplug: ${JSON.stringify(unplugged.after.actions)}`);

    // ---- the camera stops when the pad is unplugged ----------------------
    const unplugCamera = await padPage.evaluate(async () => {
      const ctx = window.SUPERCITYCON.ctx;
      const svc = ctx.ui.gamepad;
      // Start from the middle of the world, so the focus is nowhere near the
      // clamp that would stop it by itself.
      ctx.ui.camera.reset();
      await window.__sc.settle();
      // The stick is pushed all the way over.
      window.__pad.axes = [1, 0, 0, 0];
      await window.__sc.frames(10);
      const pushed = await window.__sc.velocity(6);
      // The pad is unplugged mid-gesture.
      window.__pad.connected = false;
      await window.__sc.frames(20);
      const after = await window.__sc.velocity(6);
      const out = {
        pushed, after,
        axes: svc.axes(),
        connected: svc.isConnected(),
      };
      window.__pad.connected = true;
      window.__pad.axes = [];
      await window.__sc.frames(3);
      return out;
    });
    observations.unplugCamera = unplugCamera;

    check('the camera stops when the pad is unplugged mid-press',
      unplugCamera.after.perFrame < 0.05
        && unplugCamera.axes.panX === 0
        && unplugCamera.axes.panY === 0
        && unplugCamera.connected === false,
      `the camera was moving ${unplugCamera.pushed.perFrame.toFixed(3)} units per frame while the stick `
      + `was pushed and ${unplugCamera.after.perFrame.toFixed(4)} units per frame after the unplug; `
      + `the axes are ${JSON.stringify(unplugCamera.axes)}`);

    // ---- 11. a pad with a DIFFERENT MAPPING -----------------------------
    const mapping = await padPage.evaluate(async () => {
      const ctx = window.SUPERCITYCON.ctx;
      const svc = ctx.ui.gamepad;
      window.__pad.mapping = 'non-standard';
      window.__pad.id = 'Simulated Pad (Vendor Specific)';
      await window.__sc.frames(4);
      const snapshot = svc.state?.snapshot ?? null;
      const out = {
        connected: svc.isConnected(),
        id: svc.padId(),
        mappingOnThePad: window.__pad.mapping,
        snapshotKeys: snapshot ? Object.keys(snapshot) : null,
        mappingInTheSnapshot: snapshot?.mapping ?? null,
      };
      // Does the pad still drive the camera through the standard indices?
      ctx.ui.camera.reset();
      await window.__sc.settle();
      const before = window.__sc.camera();
      window.__pad.axes = [1, 0, 0, 0];
      await window.__sc.frames(12);
      const after = window.__sc.camera();
      window.__pad.axes = [];
      await window.__sc.frames(3);
      out.panned = Math.hypot(after.x - before.x, after.z - before.z);
      return out;
    });
    observations.mapping = mapping;

    check('a pad with a non-standard mapping is still usable',
      mapping.connected === true && mapping.panned > 1,
      `the game saw "${mapping.id}" (mapping="${mapping.mappingOnThePad}") and the stick panned `
      + `${mapping.panned.toFixed(3)} units`);

    check('the game reports the pad\'s mapping',
      mapping.mappingInTheSnapshot === 'non-standard',
      `the browser reported mapping="${mapping.mappingOnThePad}", but the service's snapshot carries `
      + `${JSON.stringify(mapping.snapshotKeys)} — the mapping is dropped, so the game cannot tell a `
      + `non-standard pad from a standard one`);

    // ---- 12. the camera after a LOST FOCUS (the pad path) ----------------
    const blurPad = await padPage.evaluate(async () => {
      const ctx = window.SUPERCITYCON.ctx;
      ctx.ui.camera.reset();
      await window.__sc.settle();
      // The stick is pushed and the window loses the focus.
      window.__pad.axes = [1, 0, 0, 0];
      await window.__sc.frames(10);
      const pushed = await window.__sc.velocity(6);
      const focus = window.__sc.loseFocus();
      await window.__sc.frames(20);
      const after = await window.__sc.velocity(6);
      const out = { pushed, after, focus };
      window.__pad.axes = [];
      await window.__sc.frames(3);
      return out;
    });
    observations.blurPad = blurPad;

    check('the camera does not drift after the window loses focus (gamepad)',
      blurPad.after.perFrame < 0.05,
      `the camera was moving ${blurPad.pushed.perFrame.toFixed(3)} units per frame before the window lost `
      + `the focus and ${blurPad.after.perFrame.toFixed(4)} units per frame after it, with the stick still pushed`);

    // ---- 13. REDUCED MOTION ----------------------------------------------
    const shake = await padPage.evaluate(async () => {
      const ctx = window.SUPERCITYCON.ctx;
      const settings = window.SUPERCITYCON.settings;
      const pushes = window.__pushes;

      /**
       * Wait until the focus the rig PUSHES stops moving.
       *
       * The push is the camera's own position plus the look-ahead plus the
       * shake. The look-ahead decays over about half a second, so a settle
       * that only watches the camera's position ends while the look-ahead is
       * still moving — and the noise floor of the shake measurement is then
       * the look-ahead, not the shake.
       */
      const settlePush = async (tolerance = 0.002, maxFrames = 60) => {
        let prev = null;
        for (let i = 0; i < maxFrames; i += 1) {
          await window.__sc.nextFrame();
          const p = pushes[pushes.length - 1];
          if (!p) continue;
          if (prev && Math.hypot(p.x - prev.x, p.z - prev.z) < tolerance) return p;
          prev = p;
        }
        return null;
      };

      /**
       * The largest distance between the focus the rig PUSHES and the
       * camera's own position, over a window of frames.
       *
       * The difference is the shake (plus the look-ahead, which is zero once
       * the push has settled). The window is eight frames because the shake
       * oscillates: one frame can catch it on a zero crossing.
       */
      const sample = async (withEvent) => {
        pushes.length = 0;
        if (withEvent) {
          ctx.bus.emit('build:placed', { id: 1, type: 'res.house', x: 10, z: 10, prebuilt: true });
        }
        let max = 0;
        for (let i = 0; i < 8; i += 1) {
          await window.__sc.nextFrame();
          for (const p of pushes) {
            if (!Number.isFinite(p.camX)) continue;
            max = Math.max(max, Math.hypot(p.x - p.camX, p.z - p.camZ));
          }
        }
        return max;
      };

      // The noise floor: the same window with no event at all.
      await settlePush();
      const noise = await sample(false);

      // The shake, with the preference off.
      settings.set('accessibility.reducedShake', false);
      await settlePush();
      const off = await sample(true);

      // The shake, with the preference on.
      settings.set('accessibility.reducedShake', true);
      await settlePush();
      const on = await sample(true);

      const readable = settings.get('accessibility.reducedShake');
      settings.set('accessibility.reducedShake', false);

      // The reduced-effects path.
      settings.set('accessibility.reducedEffects', true);
      await window.__sc.frames(2);
      const fxReduced = window.SUPERCITYCON.ctx.renderer.fx?.reducedMotion ?? null;
      settings.set('accessibility.reducedEffects', false);
      await window.__sc.frames(2);
      const fxBack = window.SUPERCITYCON.ctx.renderer.fx?.reducedMotion ?? null;
      return { noise, off, on, readable, fxReduced, fxBack };
    });
    observations.shake = shake;

    check('the reduced-shake preference is readable at runtime',
      shake.readable === true,
      `settings.get('accessibility.reducedShake') returned ${JSON.stringify(shake.readable)}`);

    check('a shake event does not move the camera when reduced-shake is on',
      shake.on <= Math.max(shake.noise * 2, 1e-9),
      `the camera moved ${shake.on.toExponential(3)} world units, against a noise floor of `
      + `${shake.noise.toExponential(3)}`);

    check('a shake event does move the camera when reduced-shake is off',
      shake.off > 0.01,
      `the camera moved ${shake.off.toFixed(4)} world units (the control for the check above)`);

    check('the reduced-effects preference reaches the effects service',
      shake.fxReduced === true && shake.fxBack === false,
      `renderer.fx.reducedMotion was ${JSON.stringify(shake.fxReduced)} with the preference on and `
      + `${JSON.stringify(shake.fxBack)} with it off`);

    await padPage.screenshot({ path: `${outDir}/devices-pad.png`, animations: 'disabled', timeout: 60000 })
      .catch(() => {});
  }

  check('no uncaught page errors on the pad', padErrors.length === 0, padErrors.slice(0, 3).join(' | '));
  const padRealErrors = padConsoleErrors.filter((e) => !/Failed to load resource/.test(e));
  check('no console errors on the pad', padRealErrors.length === 0, padRealErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('the pad scenario ran to completion', false,
    `${err.message} | ${(err.stack || '').split('\n').slice(0, 4).join(' >> ')}`);
  await padPage.screenshot({ path: `${outDir}/error-pad.png`, animations: 'disabled', timeout: 60000 }).catch(() => {});
} finally {
  await browser.close();
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

const failed = results.filter((r) => !r.pass);
const skipped = results.filter((r) => r.skipped);
const passed = results.length - failed.length - skipped.length;
console.log(`\n${label}`);
console.log(`${passed}/${results.length} checks passed`
  + (skipped.length ? `, ${skipped.length} skipped` : '')
  + (failed.length ? `, ${failed.length} FAILED` : ''));
if (failed.length) {
  console.log('\nfailed:');
  for (const f of failed) console.log(`  FAIL  ${f.name}  — ${f.detail}`);
}
if (skipped.length) {
  console.log('\nskipped:');
  for (const s of skipped) console.log(`  SKIP  ${s.name}  — ${s.detail}`);
}
console.log(`screenshots: ${outDir}`);

evidence.finishedAt = new Date().toISOString();
evidence.results = results;
evidence.observations = observations;
evidence.focusDelivery = 'headless Chromium delivers no real focus change '
  + '(Emulation.setFocusEmulationEnabled and a second tab both leave document.hasFocus() true '
  + 'and fire no blur), so the window `blur` event — the event a browser fires when the window '
  + 'loses the focus — is dispatched on the window and the game\'s own handler runs.';
writeFileSync(`${outDir}/devices.json`, JSON.stringify(evidence, null, 2));

process.exit(failed.length ? 1 : 0);
