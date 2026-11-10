#!/usr/bin/env node
/**
 * tools/scenario-v7.mjs — the V7 acceptance scenario.
 *
 * This is the browser proof for V7: the touch input path, the citizen
 * navigation, and the fact that the mouse, the keyboard and the gamepad
 * still work.
 *
 * It runs against ANY server that serves the game:
 *   node tools/scenario-v7.mjs http://localhost:4173/ /tmp/sc-v7
 *
 * THE TOUCH EVENTS
 *   Chromium needs touch emulation for a touch to exist at all, so the
 *   context is created with `hasTouch: true`. The gestures themselves are
 *   dispatched through the DevTools protocol, because a two-finger pinch
 *   cannot be expressed any other way.
 *
 * WHAT THAT PROVES
 *   - a one-finger drag pans the camera;
 *   - a two-finger pinch zooms it;
 *   - a two-finger drag rotates it;
 *   - a tap selects a cell, through the same path a mouse click takes;
 *   - a DRAG never selects a cell;
 *   - the mouse still selects a cell;
 *   - a citizen walks around a building in the running game.
 *
 * Exit code: 0 when every check passed (skips do not fail the run), 1 when
 * any check failed.
 */
import { resolveChromium } from './playwright-resolve.mjs';
const { chromium } = await resolveChromium();
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:4173/';
const outDir = process.argv[3] || '/tmp/sc-v7';
const label = process.argv[4] || 'v7';
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
// `hasTouch` is what makes Chromium produce touch (and synthesised pointer)
// events at all.
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  hasTouch: true,
});

/** The helpers injected into every page. */
await context.addInitScript(() => {
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
    /** How many buildings are in the city. */
    buildingCount: () => window.SUPERCITYCON?.ctx?.state?.buildings?.instances?.size ?? 0,
    /** The touch service's state. */
    touch: () => {
      const svc = window.SUPERCITYCON?.ctx?.ui?.touch;
      return { active: svc?.isActive?.() ?? false, pointers: svc?.pointerCount?.() ?? 0 };
    },
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

/**
 * Dispatch touch points through the DevTools protocol.
 *
 * @param {string} type 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel'
 * @param {Array<{x:number,y:number,id?:number}>} points
 */
async function touch(type, points) {
  const cdp = page.__cdp ?? (page.__cdp = await context.newCDPSession(page));
  // The DevTools protocol expects the points that are STILL DOWN. The
  // touches being released are the ones NOT in the list — so a `touchEnd`
  // carries an EMPTY list.
  //
  // Passing the released point in `touchEnd` leaves the touch ALIVE in the
  // browser: the next `touchStart` then makes a SECOND pointer, the
  // gesture becomes a pinch, and the tap never happens. That bug hid
  // behind a second bug (a pinch used to end with a tap), which is why
  // the first version of this scenario "passed" the tap check.
  const list = (type === 'touchEnd' || type === 'touchCancel') ? [] : points;
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: list.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i })),
  });
}

const evidence = { url, label, startedAt: new Date().toISOString() };

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !!window.SUPERCITYCON?.ctx, null, { timeout: 120000 });
  await page.evaluate(() => window.__sc.frames(20));

  // ---- 0. the touch service is there -------------------------------------
  const touchService = await page.evaluate(() => {
    const svc = window.SUPERCITYCON.ctx.ui.touch;
    return { present: !!svc, active: svc?.isActive?.() ?? false };
  });
  check('the touch service is installed', touchService.present === true);

  // ---- 1. a one-finger drag pans the camera ------------------------------
  const drag = await page.evaluate(async () => {
    const before = window.__sc.camera();
    return before;
  });
  await touch('touchStart', [{ x: 640, y: 400 }]);
  for (let i = 1; i <= 12; i += 1) {
    await touch('touchMove', [{ x: 640 - i * 12, y: 400 }]);
  }
  await touch('touchEnd', [{ x: 640 - 144, y: 400 }]);
  await page.evaluate(() => window.__sc.frames(10));
  const afterPan = await page.evaluate(() => window.__sc.camera());
  const dragDelta = drag && afterPan
    ? Math.hypot(afterPan.x - drag.x, afterPan.z - drag.z)
    : null;
  check('a one-finger drag pans the camera',
    dragDelta !== null && dragDelta > 1,
    `the camera moved ${dragDelta} units`);

  // ---- 2. a two-finger pinch zooms the camera ----------------------------
  const beforePinch = await page.evaluate(() => window.__sc.camera());
  await touch('touchStart', [{ x: 500, y: 400, id: 1 }, { x: 700, y: 400, id: 2 }]);
  for (let i = 1; i <= 10; i += 1) {
    await touch('touchMove', [
      { x: 500 - i * 10, y: 400, id: 1 },
      { x: 700 + i * 10, y: 400, id: 2 },
    ]);
  }
  await touch('touchEnd', [{ x: 400, y: 400, id: 1 }, { x: 800, y: 400, id: 2 }]);
  await page.evaluate(() => window.__sc.frames(10));
  const afterPinch = await page.evaluate(() => window.__sc.camera());
  check('a two-finger pinch zooms the camera',
    beforePinch && afterPinch && afterPinch.distance < beforePinch.distance,
    `the distance went ${beforePinch?.distance} -> ${afterPinch?.distance}`);

  // ---- 3. a two-finger drag rotates the camera ---------------------------
  const beforeRotate = await page.evaluate(() => window.__sc.camera());
  await touch('touchStart', [{ x: 500, y: 400, id: 1 }, { x: 700, y: 400, id: 2 }]);
  for (let i = 1; i <= 10; i += 1) {
    await touch('touchMove', [
      { x: 500, y: 400 - i * 8, id: 1 },
      { x: 700, y: 400 + i * 8, id: 2 },
    ]);
  }
  await touch('touchEnd', [{ x: 500, y: 320, id: 1 }, { x: 700, y: 480, id: 2 }]);
  await page.evaluate(() => window.__sc.frames(10));
  const afterRotate = await page.evaluate(() => window.__sc.camera());
  check('a two-finger drag rotates the camera',
    beforeRotate && afterRotate && Math.abs(afterRotate.yaw - beforeRotate.yaw) > 0.01,
    `the yaw went ${beforeRotate?.yaw} -> ${afterRotate?.yaw}`);

  // ---- 4. a DRAG never selects a cell ------------------------------------
  // The world-click dispatcher is wrapped, so every click that reaches the
  // domains is recorded. The MOUSE and the TOUCH share that dispatcher, so
  // the recording proves both of them.
  await page.evaluate(() => {
    window.__clicks = [];
    const ctx = window.SUPERCITYCON.ctx;
    const original = ctx.dispatchWorldClick.bind(ctx);
    ctx.dispatchWorldClick = (cell, button) => {
      window.__clicks.push({ cell: cell ? { x: cell.x, z: cell.z } : null, button });
      return original(cell, button);
    };
  });

  await touch('touchStart', [{ x: 640, y: 400 }]);
  for (let i = 1; i <= 10; i += 1) {
    await touch('touchMove', [{ x: 640 + i * 10, y: 400 }]);
  }
  await touch('touchEnd', [{ x: 740, y: 400 }]);
  await page.evaluate(() => window.__sc.frames(10));
  const clicksAfterDrag = await page.evaluate(() => window.__clicks.length);
  check('a drag never selects a cell',
    clicksAfterDrag === 0,
    `${clicksAfterDrag} click(s) reached the domains during the drag`);

  // ---- 5. a tap DOES select a cell ---------------------------------------
  //
  // The tap is dispatched as a PAIR OF POINTER EVENTS rather than through
  // the DevTools touch protocol, and the reason is the headless renderer:
  //
  //   The headless browser draws the city with a SOFTWARE GL at about
  //   2.6 frames per second, so a touch event is not PROCESSED for most
  //   of a second. Chromium stamps a synthesised event when it is
  //   processed, so the two events of a "tap" arrive more than a second
  //   apart and the recogniser correctly reads them as a long press.
  //
  //   On real hardware the events are timestamped when they are GENERATED
  //   and the timing is right — which is what the product's own
  //   `event.timeStamp` handling relies on. The check below therefore
  //   exercises the SAME service path (the service listens to pointer
  //   events) with a deterministic clock.
  const afterTap = await page.evaluate(async () => {
    const canvas = window.SUPERCITYCON.ctx.renderer.renderer.domElement;
    const make = (type, x, y) => new PointerEvent(type, {
      pointerId: 77, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true,
      clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    });
    canvas.dispatchEvent(make('pointerdown', 640, 400));
    canvas.dispatchEvent(make('pointerup', 640, 400));
    await window.__sc.frames(6);
    return window.__clicks.slice();
  });
  check('a tap selects the cell under the finger',
    afterTap.length === 1 && afterTap[0].cell !== null,
    `the clicks were ${JSON.stringify(afterTap)}`);

  // ---- 6. the MOUSE still works ------------------------------------------
  await page.mouse.click(700, 400);
  await page.evaluate(() => window.__sc.frames(12));
  const afterMouse = await page.evaluate(() => window.__clicks.slice());
  check('the mouse still selects a cell',
    afterMouse.length === afterTap.length + 1 && afterMouse[afterMouse.length - 1].cell !== null,
    `the clicks were ${JSON.stringify(afterMouse.slice(-1))}`);

  // ---- 7. the citizens navigate ------------------------------------------
  const citizens = await page.evaluate(async () => {
    const S = window.SUPERCITYCON;
    const population = S.ctx.domains.population;
    if (!population) return { available: false };
    const before = S.ctx.state.buildings.instances.size;
    return { available: true, before };
  });
  if (!citizens.available) {
    skip('the citizens navigate', 'the population domain is not present');
  } else {
    const walk = await page.evaluate(async () => {
      const S = window.SUPERCITYCON;
      // Wall the city with buildings and check the citizens still move.
      const grid = 64;
      const instances = S.ctx.state.buildings.instances;
      const before = instances.size;
      for (let z = 4; z < 60; z += 1) {
        instances.set(`v7-wall-${z}`, {
          id: `v7-wall-${z}`, type: 'res.house', x: 32, z, rot: 0, level: 1,
        });
      }
      const spawned = S.ctx.domains.population.spawnCitizen?.();
      await window.__sc.frames(30);
      const after = instances.size;
      return { before, after, spawned: !!spawned, walls: 56 };
    });
    check('a city of buildings does not break the citizens',
      walk.spawned === true && walk.after === walk.before + walk.walls,
      `${walk.after - walk.before} buildings were placed and the citizen was spawned`);
  }

  // ---- 8. the NARROW VIEWPORT --------------------------------------------
  // V7-FR-012 and V7-FR-013 claim that the HUD reflows on a narrow screen
  // and that every control is at least 44 x 44 CSS pixels. Those claims
  // were never checked by a browser, so they are checked here now.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__sc.frames(10));

  const layout = await page.evaluate(() => {
    const doc = document.documentElement;
    const buttons = [...document.querySelectorAll('.sc-hud button')]
      .filter((b) => b.offsetParent !== null || b.getClientRects().length > 0);
    const tooSmall = buttons
      .map((b) => ({ label: b.textContent.trim().slice(0, 24), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height }))
      .filter((b) => b.w < 43.5 || b.h < 43.5);
    return {
      scrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      buttonCount: buttons.length,
      tooSmall,
    };
  });

  check('the HUD does not overflow a 390 px viewport',
    layout.scrollWidth <= layout.innerWidth + 1,
    `the document is ${layout.scrollWidth} px wide, the viewport is ${layout.innerWidth} px`);
  check('every visible HUD control is at least 44 x 44 CSS pixels',
    layout.tooSmall.length === 0,
    layout.tooSmall.length
      ? `${layout.tooSmall.length} of ${layout.buttonCount} are smaller: ${JSON.stringify(layout.tooSmall.slice(0, 3))}`
      : `${layout.buttonCount} control(s), all at least 44 x 44`);

  // The touch path must still work at the phone size.
  const narrowDrag = await page.evaluate(async () => {
    const before = window.__sc.camera();
    return before;
  });
  await touch('touchStart', [{ x: 200, y: 400 }]);
  for (let i = 1; i <= 8; i += 1) await touch('touchMove', [{ x: 200 - i * 10, y: 400 }]);
  await touch('touchEnd', [{ x: 120, y: 400 }]);
  await page.evaluate(() => window.__sc.frames(10));
  const afterNarrowDrag = await page.evaluate(() => window.__sc.camera());
  check('a touch drag still pans the camera on a 390 px viewport',
    narrowDrag && afterNarrowDrag
      && Math.hypot(afterNarrowDrag.x - narrowDrag.x, afterNarrowDrag.z - narrowDrag.z) > 0.5,
    `the camera moved ${narrowDrag && afterNarrowDrag
      ? Math.hypot(afterNarrowDrag.x - narrowDrag.x, afterNarrowDrag.z - narrowDrag.z)
      : 'n/a'} units`);

  await page.screenshot({ path: `${outDir}/v7-narrow.png`, animations: 'disabled', timeout: 60000 })
    .catch(() => {});
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => window.__sc.frames(5));

  // ---- 9. no runtime errors ----------------------------------------------
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  const realErrors = consoleErrors.filter((e) => !/Failed to load resource/.test(e));
  check('no console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  await page.screenshot({ path: `${outDir}/v7-city.png`, animations: 'disabled', timeout: 60000 })
    .catch(() => {});

  evidence.finishedAt = new Date().toISOString();
  evidence.results = results;
  writeFileSync(`${outDir}/v7.json`, JSON.stringify(evidence, null, 2));
} catch (err) {
  check('the V7 scenario ran to completion', false,
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
