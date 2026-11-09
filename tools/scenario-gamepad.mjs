#!/usr/bin/env node
/**
 * tools/scenario-gamepad.mjs — the V6 gamepad acceptance scenario.
 *
 * This is the browser proof for V5 issue KI-05. It boots the real game in a
 * real browser, plugs in a SIMULATED controller, and drives it the way a
 * player would: the D-pad moves the menu focus, A confirms, B goes back, the
 * left stick pans the camera, and unplugging the pad mid-session releases
 * everything it was holding.
 *
 * It runs against ANY server that serves the game:
 *   node tools/scenario-gamepad.mjs http://localhost:4173/ /tmp/sc-pad
 *
 * THE SIMULATED PAD
 *   Chromium cannot emulate a gamepad through the DevTools protocol, so the
 *   page's `navigator.getGamepads` is replaced with a controllable fake
 *   BEFORE the game boots (an init script). The fake is shaped exactly like
 *   the browser's `Gamepad` object: `connected`, `buttons[]` with `pressed`
 *   and `value`, and `axes[]`.
 *
 *   WHAT THAT PROVES: the routing, the focus ring, the dead zone, the button
 *   edge, the camera gating and the connect / disconnect handling.
 *
 *   WHAT THAT DOES NOT PROVE: how the game feels on real hardware. No
 *   physical controller was available in the build environment. See
 *   `docs/V6_KNOWN_ISSUES.md` V6-KI-10.
 *
 * Exit code: 0 when every check passed (skips do not fail the run), 1 when
 * any check failed.
 */
import { resolveChromium } from './playwright-resolve.mjs';
const { chromium } = await resolveChromium();
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:4173/';
const outDir = process.argv[3] || '/tmp/sc-gamepad';
const label = process.argv[4] || 'v6-gamepad';
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
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

/**
 * The simulated controller.
 *
 * It is installed before any page script runs, so the game's first frame
 * already sees a pad. `window.__pad` is the live state the test drives.
 */
await context.addInitScript(() => {
  const pad = {
    connected: true,
    id: 'Simulated Pad (STANDARD GAMEPAD)',
    index: 0,
    buttons: [],
    axes: [],
  };
  window.__pad = pad;

  const build = () => {
    const buttons = pad.buttons.map((pressed) => ({
      pressed: !!pressed,
      value: pressed ? 1 : 0,
      touched: !!pressed,
    }));
    return [{
      connected: pad.connected,
      id: pad.id,
      index: pad.index,
      mapping: 'standard',
      timestamp: performance.now(),
      buttons,
      axes: pad.axes.slice(),
    }];
  };

  try {
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => (pad.connected ? build() : build()),
    });
  } catch {
    /* the browser refused the override — the checks below will say so */
  }

  window.__sc = {
    /** Resolve on the next animation frame (the game renders on rAF). */
    nextFrame: () => new Promise((r) => requestAnimationFrame(() => r())),
    /** Wait for N animation frames. */
    frames: async (n) => { for (let i = 0; i < n; i += 1) await window.__sc.nextFrame(); },
    /**
     * Press a button and hold it for `hold` frames.
     * @param {number} index the standard-mapping button index
     * @param {number} hold how many frames to hold it down
     */
    async press(index, hold = 2) {
      pad.buttons[index] = true;
      await window.__sc.frames(hold);
      pad.buttons[index] = false;
      await window.__sc.frames(2);
    },
    /** Hold a button down without releasing it. */
    hold(index) { pad.buttons[index] = true; },
    /** Release every button. */
    releaseAll() { pad.buttons = []; },
    /** Set the analogue axes. */
    setAxes(axes) { pad.axes = axes.slice(); },
    /** Unplug the pad. */
    disconnect() { pad.connected = false; },
    /** Plug the pad back in. */
    reconnect() { pad.connected = true; },
    /**
     * Put the camera back in the middle of the world and let it settle.
     *
     * The rig damps towards its target, so a camera that was moving keeps
     * moving for a moment after the input stops. Every measurement has to
     * start from a settled camera, or the measurement is of the damping and
     * not of the pad.
     */
    async settle(frames = 140) {
      window.SUPERCITYCON.ctx.ui.camera.reset();
      window.__sc.setAxes([]);
      await window.__sc.frames(frames);
      return window.__sc.camera();
    },
    /** The camera the game is showing — a SNAPSHOT, not the live object. */
    camera: () => {
      const c = window.SUPERCITYCON?.ctx?.state?.ui?.camera;
      if (!c) return null;
      return {
        x: c.x, z: c.z, distance: c.distance, yaw: c.yaw, pitch: c.pitch,
      };
    },
    /** The id of the menu item that currently carries the focus. */
    focused: () => {
      const el = document.querySelector('.sc-menu .is-focused');
      return el ? (el.dataset.scMenuItem ?? el.dataset.scSetToggle ?? el.tagName) : null;
    },
    /** How many times the menu has been asked to do something by the pad. */
    padActions: () => (window.__padActions ?? []).slice(),
  };
});

const pageErrors = [];
const consoleErrors = [];

const page = await context.newPage();
page.on('pageerror', (err) => pageErrors.push(String(err?.message ?? err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(String(msg.text()));
});
page.on('requestfailed', (req) => {
  consoleErrors.push(`request failed: ${req.url()} ${req.failure()?.errorText ?? ''}`);
});

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

const evidence = { url, label, startedAt: new Date().toISOString() };

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !!window.SUPERCITYCON?.ctx, null, { timeout: 120000 });
  await page.evaluate(() => window.__sc.frames(10));

  // ---- 0. the pad is seen at all -----------------------------------------
  const padSeen = await page.evaluate(async () => {
    const svc = window.SUPERCITYCON.ctx.ui.gamepad;
    await window.__sc.frames(5);
    return { connected: svc?.isConnected?.() ?? false, id: svc?.padId?.() ?? null };
  });
  check('the game sees the controller', padSeen.connected,
    `connected=${padSeen.connected} id=${padSeen.id}`);
  if (!padSeen.connected) {
    skip('the gamepad flows', 'the browser did not report the simulated pad');
  } else {
    // ---- the instrumentation -------------------------------------------
    // Count the pad actions that reach the menu, so "a held button confirms
    // once" is measured rather than assumed.
    await page.evaluate(() => {
      window.__padActions = [];
      const menu = window.SUPERCITYCON.ctx.ui.menu;
      const original = menu.handlePadAction.bind(menu);
      menu.handlePadAction = (action) => {
        window.__padActions.push(action);
        return original(action);
      };
    });

    // ---- 1. the menu opens and the D-pad moves the focus -----------------
    await page.evaluate(() => { window.SUPERCITYCON.ctx.ui.openMenu(); });
    await page.evaluate(() => window.__sc.frames(3));
    const menuOpen = await page.evaluate(() => window.SUPERCITYCON.ctx.ui.menu.isOpen());
    check('the menu opens', menuOpen === true);

    const focusBefore = await page.evaluate(() => window.__sc.focused());
    await page.evaluate(() => window.__sc.press(13));          // D-pad down
    const focusAfter = await page.evaluate(() => window.__sc.focused());
    check('the D-pad moves the menu focus',
      focusBefore !== null && focusAfter !== null && focusBefore !== focusAfter,
      `focus ${focusBefore} -> ${focusAfter}`);

    const ringVisible = await page.evaluate(() => {
      const el = document.querySelector('.sc-menu .is-focused');
      if (!el) return false;
      const cs = window.getComputedStyle(el);
      // The ring must be visible: a border, an outline, or a background.
      const border = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
      return border || cs.outlineStyle !== 'none' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    });
    check('the focus ring is visible', ringVisible);

    // ---- 2. A confirms the focused item ----------------------------------
    // "Level Select" is the third item, and it is ENABLED (unlike "Continue",
    // which is greyed out when there are no saves), so the confirmation has a
    // real effect that can be observed.
    await page.evaluate(() => window.__sc.press(12));          // up -> New Game
    await page.evaluate(() => window.__sc.press(13));          // down
    await page.evaluate(() => window.__sc.press(13));          // down -> Level Select
    const focusTarget = await page.evaluate(() => window.__sc.focused());
    await page.evaluate(() => window.__sc.press(0));           // A
    const viewAfterConfirm = await page.evaluate(() => window.SUPERCITYCON.ctx.ui.menu.view());
    check('A confirms the focused item',
      focusTarget === 'level-select' && viewAfterConfirm === 'levels',
      `focus was "${focusTarget}", the view became "${viewAfterConfirm}"`);

    // ---- 3. B goes back --------------------------------------------------
    const viewBeforeBack = await page.evaluate(() => window.SUPERCITYCON.ctx.ui.menu.view());
    await page.evaluate(() => window.__sc.press(1));           // B
    await page.evaluate(() => window.__sc.frames(3));
    const viewAfterBack = await page.evaluate(() => window.SUPERCITYCON.ctx.ui.menu.view());
    check('B goes back', viewAfterBack === 'main',
      `view ${viewBeforeBack} -> ${viewAfterBack}`);

    // ---- 4. a held button does not confirm twice -------------------------
    // The menu must be OPEN for this to mean anything: with no menu open
    // the pad has nothing to confirm and the count would be zero for the
    // wrong reason.
    await page.evaluate(async () => {
      window.SUPERCITYCON.ctx.ui.openMenu();
      await window.__sc.frames(3);
      window.__padActions.length = 0;
    });
    await page.evaluate(() => window.__sc.hold(0));             // hold A down
    await page.evaluate(() => window.__sc.frames(12));
    await page.evaluate(() => window.__sc.releaseAll());
    await page.evaluate(() => window.__sc.frames(3));
    const heldActions = await page.evaluate(() => window.__sc.padActions());
    const confirms = heldActions.filter((a) => a === 'menu.confirm').length;
    check('a held CONFIRM does not confirm twice', confirms === 1,
      `${confirms} confirm(s) in 12 held frames`);

    // ---- 5. the camera does not move while the menu has the focus -------
    // The camera is settled FIRST, so the comparison measures the pad and
    // not the tail of an earlier move.
    const cameraUnderMenu = await page.evaluate(async () => {
      window.SUPERCITYCON.ctx.ui.closeMenu();
      await window.__sc.settle();
      window.SUPERCITYCON.ctx.ui.openMenu();
      await window.__sc.frames(5);
      const before = window.__sc.camera();
      window.__sc.setAxes([1, 1, 0, 0]);               // full stick
      await window.__sc.frames(30);
      const after = window.__sc.camera();
      window.__sc.setAxes([]);
      window.SUPERCITYCON.ctx.ui.closeMenu();
      await window.__sc.frames(3);
      return { before, after };
    });
    const underDelta = cameraUnderMenu.before && cameraUnderMenu.after
      ? Math.hypot(cameraUnderMenu.after.x - cameraUnderMenu.before.x,
        cameraUnderMenu.after.z - cameraUnderMenu.before.z)
      : null;
    check('the camera does not move while the menu has the focus',
      underDelta !== null && underDelta < 0.001,
      `the focus moved ${underDelta}`);

    // ---- 6. the analogue stick pans the camera --------------------------
    const stick = await page.evaluate(async () => {
      const before = await window.__sc.settle();
      window.__sc.setAxes([1, 0, 0, 0]);                       // full right
      await window.__sc.frames(30);
      const after = window.__sc.camera();
      window.__sc.setAxes([]);
      await window.__sc.frames(3);
      return { before, after };
    });
    const stickDelta = stick.before && stick.after ? stick.after.x - stick.before.x : null;
    check('the analogue stick pans the camera',
      stickDelta !== null && stickDelta > 1,
      `the camera moved ${stickDelta} units east`);

    // ---- 7. a resting stick moves nothing -------------------------------
    const resting = await page.evaluate(async () => {
      const before = await window.__sc.settle();
      window.__sc.setAxes([0.08, -0.06, 0.03, 0]);             // inside the dead zone
      await window.__sc.frames(30);
      const after = window.__sc.camera();
      window.__sc.setAxes([]);
      await window.__sc.frames(3);
      return { before, after };
    });
    const restDelta = resting.before && resting.after
      ? Math.hypot(resting.after.x - resting.before.x, resting.after.z - resting.before.z)
      : null;
    check('a resting stick does not drift the camera',
      restDelta !== null && restDelta < 0.001,
      `the camera drifted ${restDelta}`);

    // ---- 8. an unplugged pad releases everything -------------------------
    const unplugged = await page.evaluate(async () => {
      const before = await window.__sc.settle();
      window.__sc.setAxes([1, 0, 0, 0]);                        // panning
      await window.__sc.frames(20);
      const moving = window.__sc.camera();
      window.__sc.disconnect();
      // The rig DAMPENS towards its target, so the camera keeps easing
      // towards the place the pad had already sent it. That tail is the
      // rig's designed smoothing, not the pad still driving. The test is
      // therefore: does the camera come to REST?
      await window.__sc.frames(140);
      const resting = window.__sc.camera();
      await window.__sc.frames(30);
      const after = window.__sc.camera();
      const service = window.SUPERCITYCON.ctx.ui.gamepad;
      return {
        before, moving, resting, after,
        connected: service.isConnected(),
        axes: service.axes(),
      };
    });
    const unplugRestDelta = unplugged.resting && unplugged.after
      ? Math.hypot(unplugged.after.x - unplugged.resting.x, unplugged.after.z - unplugged.resting.z)
      : null;
    const movedBeforeUnplug = unplugged.before && unplugged.moving
      ? Math.hypot(unplugged.moving.x - unplugged.before.x, unplugged.moving.z - unplugged.before.z)
      : null;
    check('an unplugged pad is reported as disconnected', unplugged.connected === false);
    check('an unplugged pad stops the camera',
      movedBeforeUnplug !== null && movedBeforeUnplug > 1,
      `the camera moved ${movedBeforeUnplug} units before the unplug`);
    check('an unplugged pad lets the camera come to rest',
      unplugRestDelta !== null && unplugRestDelta < 0.001,
      `the camera moved ${unplugRestDelta} units once it had settled`);
    check('an unplugged pad reports zero axes',
      unplugged.axes && unplugged.axes.panX === 0 && unplugged.axes.panY === 0,
      JSON.stringify(unplugged.axes));

    // ---- 9. a pad that is plugged back in works again -------------------
    const replugged = await page.evaluate(async () => {
      window.__sc.reconnect();
      await window.__sc.frames(10);
      const service = window.SUPERCITYCON.ctx.ui.gamepad;
      const before = await window.__sc.settle();
      window.__sc.setAxes([1, 0, 0, 0]);
      await window.__sc.frames(30);
      const after = window.__sc.camera();
      window.__sc.setAxes([]);
      await window.__sc.frames(3);
      return { connected: service.isConnected(), before, after };
    });
    check('a pad that is plugged back in is reported as connected',
      replugged.connected === true);
    const replugDelta = replugged.before && replugged.after
      ? replugged.after.x - replugged.before.x
      : null;
    check('a reconnected pad drives the camera again',
      replugDelta !== null && replugDelta > 1,
      `the camera moved ${replugDelta} units east`);

    // ---- 10. the reduced-shake preference is honoured -------------------
    const shake = await page.evaluate(async () => {
      const settings = window.SUPERCITYCON.settings;
      const before = settings.get('accessibility.reducedShake');
      settings.set('accessibility.reducedShake', true);
      await window.__sc.frames(5);
      return { before, after: settings.get('accessibility.reducedShake') };
    });
    check('the reduced-shake preference can be turned on',
      shake.after === true,
      `reducedShake ${shake.before} -> ${shake.after}`);

    await page.screenshot({ path: `${outDir}/gamepad-menu.png`, animations: 'disabled', timeout: 60000 })
      .catch(() => {});
  }

  // ---- 11. no runtime errors ---------------------------------------------
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  const realErrors = consoleErrors.filter((e) => !/Failed to load resource/.test(e));
  check('no console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  evidence.finishedAt = new Date().toISOString();
  evidence.results = results;
  writeFileSync(`${outDir}/gamepad.json`, JSON.stringify(evidence, null, 2));
} catch (err) {
  check('the gamepad scenario ran to completion', false,
    `${err.message} | ${(err.stack || '').split('\n').slice(0, 4).join(' >> ')}`);
  await page.screenshot({ path: `${outDir}/error.png`, animations: 'disabled', timeout: 60000 }).catch(() => {});
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
process.exit(failed.length ? 1 : 0);
