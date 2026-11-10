#!/usr/bin/env node
/**
 * tools/compat-audit.mjs — the cross-engine / cross-device audit of the
 * SHIPPED bundle.
 *
 * WHY THIS EXISTS
 *   SuperCitycon V7 has only ever been verified in Chromium on macOS x86_64.
 *   `docs/v7/PLATFORM_COMPATIBILITY.md` lists Firefox, Safari, Windows, Linux
 *   and ARM64 as NOT BUILT / NOT TESTED, and GATE 9 (platform verification) is
 *   PARTIAL.
 *
 *   This machine has ONE browser engine: the Chromium in
 *   `~/Library/Caches/ms-playwright/`. There is no Firefox, no WebKit and no
 *   second engine to test against, and downloading one is out of scope.
 *
 *   So this tool does the next most useful thing: it audits the artefact that
 *   ACTUALLY ships for the hazards that make a web game break on another
 *   engine or another device, and it PROVES the graceful-degradation paths
 *   really work by removing the APIs at runtime and watching what happens.
 *
 * WHAT IT DOES, IN THREE PHASES
 *
 *   1. STATIC — reads `game/dist/assets/index-*.js` (the built bundle that
 *      ships) and looks for the things that break cross-engine: modern
 *      syntax, unguarded platform APIs, and the specific hazards named in the
 *      V7 brief (PointerEvent, getGamepads, performance.memory, Event.timeStamp,
 *      structuredClone, Array.prototype.at, Object.hasOwn, replaceAll,
 *      top-level await, import.meta). Each one is classified as a REAL hazard
 *      or a FALSE ALARM, with the evidence being the bundle text itself.
 *
 *   2. RUNTIME — launches Chromium through the project's own
 *      `tools/playwright-resolve.mjs`, serves the built bundle, and drives the
 *      REAL game in each degraded configuration. For every configuration it
 *      asserts that the game boots, the HUD renders, the camera answers the
 *      keyboard and no console error appears — and it MEASURES the boot time
 *      and the frame-time distribution, so the cost of the degradation is a
 *      number rather than an opinion.
 *
 *   3. DEVICE — measures the real layout at 320 / 390 / 768 / 1280 / 1920 px
 *      and in landscape on a phone: the horizontal overflow and the size of
 *      every touch target. Nothing here is guessed.
 *
 * THE MEASUREMENT IS ROUND-ROBIN ON PURPOSE
 *   The build machine runs a SOFTWARE GL (SwiftShader) and is shared with
 *   other work, so a single timing sample is noise. Every configuration is
 *   therefore booted and sampled ROUNDS times, interleaved (baseline,
 *   degraded, baseline, degraded, …), so any machine load hits every
 *   configuration equally. The tool reports the median of each configuration
 *   AND the spread of the baseline's own repeats, which is the noise floor:
 *   a difference smaller than that floor is not a finding.
 *
 * USAGE
 *     node tools/compat-audit.mjs [url] [outDir]
 *
 *     url     the served build   (default http://localhost:4210/)
 *     outDir  the evidence folder (default /tmp/sc-compat)
 *
 *     Serve the build first:
 *         cd game && npm run build:cleared && npx vite preview --port 4210 --strictPort
 *
 * EXIT CODE
 *     0  the audit ran to the end (a finding is not a failure of the tool)
 *     1  the audit could not run, or the BASELINE configuration failed
 */
import { resolveChromium } from './playwright-resolve.mjs';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const { chromium } = await resolveChromium();

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DIST = resolve(ROOT, 'game', 'dist');
const GAME = resolve(ROOT, 'game');

// The arguments are POSITIONAL: a URL and an output folder.
//
// A flag-style call (`--url https://…`) used to be accepted silently, and
// the URL was then used as the OUTPUT FOLDER — which created a directory
// named after the URL inside the repository. A mistake in the invocation
// must fail loudly, not litter the tree.
const args = process.argv.slice(2);
if (args.some((a) => a.startsWith('--'))) {
  process.stderr.write(
    'Usage: node tools/compat-audit.mjs [url] [outDir]\n'
    + '  url     the served build (default http://localhost:4210/)\n'
    + '  outDir  the evidence folder (default /tmp/sc-compat)\n'
    + 'The arguments are POSITIONAL — there are no flags.\n',
  );
  process.exit(2);
}
const url = args[0] || 'http://localhost:4210/';
const outDir = args[1] || '/tmp/sc-compat';
/** How many interleaved rounds each configuration is measured over. */
const ROUNDS = Number(process.env.SC_COMPAT_ROUNDS || 3);
/** How long each frame sample runs, in milliseconds. */
const FRAME_WINDOW_MS = Number(process.env.SC_COMPAT_FRAME_MS || 3000);
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// The result ledger
// ---------------------------------------------------------------------------

const results = [];

/** A check that must pass. */
function check(name, pass, detail = '') {
  results.push({ name, pass: !!pass, skipped: false, detail: String(detail) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  return !!pass;
}

/** A section heading. */
function section(title) {
  console.log(`\n=== ${title} ===`);
}

/** The median of a number list. */
function median(values) {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// ---------------------------------------------------------------------------
// PHASE 1 — the static audit of the shipped bundle
// ---------------------------------------------------------------------------

/**
 * The bundle's syntax features, and whether each one is a hazard.
 *
 * `test` is a REGULAR EXPRESSION run over the shipped bundle. The `hazard`
 * field says what it would break if the feature were MISSING in the engine.
 */
const FEATURE_PROBES = [
  {
    id: 'PointerEvent (the constructor)',
    test: /\bPointerEvent\b/g,
    hazard: 'the touch/mouse path is built on pointer events; Safari < 13 has no PointerEvent at all',
  },
  {
    id: 'navigator.getGamepads',
    test: /getGamepads/g,
    hazard: 'absent in older Safari; THROWS in a non-secure context',
  },
  {
    id: 'performance.memory',
    test: /performance\.memory/g,
    hazard: 'Chromium-only; used by the profiler tools',
  },
  {
    id: 'structuredClone',
    test: /\bstructuredClone\b/g,
    hazard: 'absent before Chrome 98 / Safari 15.4 / Firefox 94',
  },
  {
    id: 'Object.hasOwn',
    test: /\bObject\.hasOwn\b/g,
    hazard: 'absent before Chrome 93 / Safari 15.4 / Firefox 92',
  },
  {
    id: 'String.prototype.replaceAll',
    test: /\.replaceAll\(/g,
    hazard: 'absent before Chrome 85 / Safari 13.1 / Firefox 77',
  },
  {
    id: 'Array.prototype.at',
    test: /\.at\(\s*-?\d+\s*\)/g,
    hazard: 'absent before Chrome 92 / Safari 15.4 / Firefox 90',
  },
  {
    id: 'import.meta',
    test: /\bimport\.meta\b/g,
    hazard: 'a module-only feature; an engine without it cannot parse the bundle',
  },
  {
    id: 'optional chaining (?.)',
    test: /\?\./g,
    hazard: 'absent before Chrome 80 / Safari 13.1 / Firefox 74',
  },
  {
    id: 'nullish coalescing (??)',
    test: /\?\?/g,
    hazard: 'absent before Chrome 80 / Safari 13.1 / Firefox 74',
  },
  {
    id: 'logical assignment (||= &&= ??=)',
    test: /(?:\|\|=|&&=|\?\?=)/g,
    hazard: 'ES2021 syntax; absent before Chrome 85 / Safari 14 / Firefox 79',
  },
  {
    id: 'requestIdleCallback',
    test: /\brequestIdleCallback\b/g,
    hazard: 'absent in Safari; the game would lose a deferred work slot',
  },
  {
    id: 'ResizeObserver',
    test: /\bResizeObserver\b/g,
    hazard: 'absent before Chrome 64 / Safari 13.1 / Firefox 69',
  },
  {
    id: 'matchMedia',
    test: /\bmatchMedia\b/g,
    hazard: 'absent before Chrome 39 / Safari 10.1 / Firefox 53',
  },
  {
    id: 'localStorage',
    test: /\blocalStorage\b/g,
    hazard: 'throws in a blocked-cookies context, and is missing in some private modes',
  },
  {
    id: 'WeakRef',
    test: /\bWeakRef\b/g,
    hazard: 'absent before Chrome 84 / Safari 14.1 / Firefox 79',
  },
  {
    id: 'OffscreenCanvas',
    test: /\bOffscreenCanvas\b/g,
    hazard: 'absent before Chrome 69 / Safari 16.4 / Firefox 105',
  },
];

/**
 * The guards the code relies on. Each is a REGULAR EXPRESSION that must be
 * present in the shipped bundle for the degradation to be handled.
 */
const GUARD_PROBES = [
  {
    id: 'the getGamepads absence guard',
    test: /getGamepads\s*!==?\s*"function"/,
    why: 'the service checks that the method exists before calling it',
  },
  {
    id: 'the getGamepads throw guard',
    test: /getGamepads[\s\S]{0,400}?catch/,
    why: 'the call is wrapped, so a SecurityError becomes "no pad"',
  },
  {
    id: 'the ResizeObserver presence guard',
    test: /typeof\s+ResizeObserver/,
    why: 'the renderer falls back to the window resize event',
  },
  {
    id: 'the guarded localStorage read (core/save.js)',
    test: /try\{return globalThis\.localStorage\|\|null\}catch/,
    why: 'the save path survives a storage that throws',
  },
  {
    id: 'the UNGUARDED localStorage read (main.js)',
    test: /globalThis\.localStorage\?\?null/,
    why: 'the settings store is handed the storage object WITHOUT a try/catch around the property READ',
  },
];

/** The bundle's own entry chunk. */
function findEntryChunk() {
  const dir = join(DIST, 'assets');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => /^index-.*\.js$/.test(f));
  if (!files.length) return null;
  files.sort();
  return join(dir, files[files.length - 1]);
}

/**
 * Ask esbuild to parse and re-emit the bundle at a given target.
 *
 * esbuild REFUSES a feature the target cannot express — top-level await at
 * es2020, for instance — and it WARNS when it has to drop one (`import.meta`
 * below es2020). So the lowest target that passes cleanly is the bundle's
 * real syntax floor, and the first target that warns names the feature that
 * sets it.
 */
function syntaxFloor(entry) {
  const bin = join(GAME, 'node_modules', '.bin', 'esbuild');
  if (!existsSync(bin)) {
    return { measured: false, reason: 'esbuild is not installed in game/node_modules' };
  }
  const targets = ['es2020', 'es2019', 'es2018', 'es2017'];
  const results = {};
  for (const target of targets) {
    const r = spawnSync(
      bin,
      [entry, `--target=${target}`, '--minify', '--log-level=warning', '--outfile=/dev/null'],
      { encoding: 'utf8', cwd: GAME },
    );
    const stderr = String(r.stderr || '').trim();
    results[target] = {
      clean: r.status === 0 && stderr === '',
      exit: r.status,
      diagnostics: stderr ? stderr.split('\n').filter(Boolean).slice(0, 4) : [],
    };
  }
  const lowestClean = targets.find((t) => results[t].clean) ?? null;
  const firstWarning = targets.find((t) => !results[t].clean && results[t].diagnostics.length) ?? null;
  return {
    measured: true,
    lowestClean,
    firstWarning,
    blocking: firstWarning ? results[firstWarning].diagnostics : [],
    results,
  };
}

/** The static phase. */
function staticAudit() {
  section('PHASE 1 — the static audit of the shipped bundle');
  const entry = findEntryChunk();
  if (!entry) {
    check('the built bundle exists', false, 'no game/dist/assets/index-*.js — run the build first');
    return null;
  }
  const text = readFileSync(entry, 'utf8');
  const sha = createHash('sha256').update(text).digest('hex');
  console.log(`bundle: ${entry.replace(ROOT + '/', '')}`);
  console.log(`size:   ${statSync(entry).size} bytes`);
  console.log(`sha256: ${sha}`);

  // The bundle that is SCANNED must be the bundle that is SERVED, or the
  // runtime evidence below is about a different artefact.
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const entryName = entry.split('/').pop();
  const served = html.includes(entryName);
  check('the scanned bundle is the one dist/index.html loads', served,
    served ? `dist/index.html loads ${entryName}` : `dist/index.html does NOT load ${entryName}`);
  if (!served) {
    const refs = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
    console.log(`  dist/index.html references: ${refs.join(', ')}`);
  }

  const features = [];
  for (const probe of FEATURE_PROBES) {
    const matches = text.match(probe.test) || [];
    features.push({ id: probe.id, count: matches.length, hazard: probe.hazard });
    console.log(`  ${String(matches.length).padStart(5)}  ${probe.id}`);
  }

  const guards = [];
  for (const probe of GUARD_PROBES) {
    const found = probe.test.test(text);
    guards.push({ id: probe.id, found, why: probe.why });
    console.log(`  ${found ? 'GUARD ' : 'ABSENT'}  ${probe.id}`);
  }

  const floor = syntaxFloor(entry);

  // The build target, read from the project's own Vite config.
  let buildTarget = null;
  try {
    const viteConfig = readFileSync(join(GAME, 'vite.config.js'), 'utf8');
    const m = viteConfig.match(/target:\s*'([^']+)'/);
    if (m) buildTarget = m[1];
  } catch {
    /* keep it null */
  }

  console.log(`\nbuild target (game/vite.config.js): ${buildTarget}`);
  if (floor.measured) {
    console.log(`lowest clean esbuild target:       ${floor.lowestClean}`);
    if (floor.blocking.length) {
      console.log('first blocking diagnostic:');
      for (const line of floor.blocking) console.log(`  ${line}`);
    }
  } else {
    console.log(`syntax floor: NOT MEASURED — ${floor.reason}`);
  }

  const evidence = {
    bundle: entry.replace(ROOT + '/', ''),
    bytes: statSync(entry).size,
    sha256: sha,
    servedByIndexHtml: served,
    buildTarget,
    features,
    guards,
    syntaxFloor: floor,
  };
  writeFileSync(join(outDir, 'static-evidence.json'), JSON.stringify(evidence, null, 2));
  return evidence;
}

// ---------------------------------------------------------------------------
// PHASE 2 — the runtime degradation matrix
// ---------------------------------------------------------------------------

/**
 * The degraded configurations.
 *
 * Each `init` runs in the page BEFORE any of the game's own code, so the
 * game boots into the degraded world rather than discovering the problem
 * later.
 */
const CONFIGS = [
  {
    id: 'baseline',
    title: 'Baseline — nothing removed',
    init: null,
  },
  {
    id: 'no-getgamepads',
    title: 'navigator.getGamepads is absent',
    init: () => { delete Navigator.prototype.getGamepads; },
  },
  {
    id: 'getgamepads-throws',
    title: 'navigator.getGamepads throws (non-secure context)',
    init: () => {
      Navigator.prototype.getGamepads = function getGamepads() {
        throw new DOMException('The gamepad API is not available in this context.', 'SecurityError');
      };
    },
  },
  {
    id: 'no-pointerevent',
    title: 'The engine has no PointerEvent at all (Safari < 13)',
    // The pointer path is GONE, so a mouse click cannot select a cell
    // either: the canvas listens for pointerdown/pointerup/pointermove.
    expectMouseClicks: 0,
    init: () => {
      // 1. the constructor is gone
      try { delete window.PointerEvent; } catch { /* ignore */ }
      // 2. and the engine delivers NO pointer events at all, which is what an
      //    engine without PointerEvent support actually does. Registering a
      //    listener for a pointer type the engine does not have is a no-op
      //    there, so the closest faithful simulation is to drop the
      //    registration itself.
      const blocked = new Set([
        'pointerdown', 'pointerup', 'pointermove', 'pointercancel',
        'pointerover', 'pointerout', 'pointerenter', 'pointerleave',
        'pointerrawupdate', 'gotpointercapture', 'lostpointercapture',
      ]);
      const add = EventTarget.prototype.addEventListener;
      const remove = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener = function (type, ...rest) {
        if (blocked.has(String(type))) return undefined;
        return add.call(this, type, ...rest);
      };
      EventTarget.prototype.removeEventListener = function (type, ...rest) {
        if (blocked.has(String(type))) return undefined;
        return remove.call(this, type, ...rest);
      };
    },
  },
  {
    id: 'no-resizeobserver',
    title: 'ResizeObserver is absent',
    init: () => { try { delete window.ResizeObserver; } catch { /* ignore */ } },
  },
  {
    id: 'blocked-localstorage',
    title: 'localStorage access throws (cookies blocked / storage disabled)',
    init: () => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException(
            "Failed to read the 'localStorage' property from 'Window': "
            + 'Access is denied for this document.',
            'SecurityError',
          );
        },
      });
    },
  },
];

/** The browser launch arguments, matching the release harness. */
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--ignore-gpu-blocklist',
];

/** The helpers injected into every page. */
const INIT_HELPERS = `
window.__sc = {
  nextFrame: () => new Promise((r) => requestAnimationFrame(() => r())),
  frames: async (n) => { for (let i = 0; i < n; i += 1) await window.__sc.nextFrame(); },
  camera: () => {
    // The camera rig's façade (ctx.ui.camera) exposes only the commands.
    // The rig's MIRROR of itself lives on the state tree, and the rig
    // refreshes it every frame (ui/camera.js:585).
    const copy = window.SUPERCITYCON?.ctx?.state?.ui?.camera;
    if (!copy) return null;
    return {
      x: copy.x, z: copy.z, distance: copy.distance,
      yaw: copy.yaw, pitch: copy.pitch,
    };
  },
  bootMs: () => new Promise((resolve) => {
    const id = setInterval(() => {
      if (window.SUPERCITYCON?.ctx) { clearInterval(id); resolve(performance.now()); }
    }, 1);
    // A healthy boot takes about 1-2.5 s here. Thirty seconds is generous;
    // a longer wait only makes a configuration that CANNOT boot slower to
    // diagnose.
    setTimeout(() => { clearInterval(id); resolve(-1); }, 30000);
  }),
  hud: () => {
    const q = (s) => document.querySelector(s);
    const visible = (el) => !!el && (el.offsetParent !== null || el.getClientRects().length > 0);
    const fatal = q('#fatal');
    return {
      booted: !!window.SUPERCITYCON?.ctx,
      fatalVisible: !!fatal && getComputedStyle(fatal).display !== 'none' && fatal.textContent.trim().length > 0,
      fatalText: fatal ? fatal.textContent.trim().slice(0, 800) : '',
      hudPresent: !!q('.sc-hud'),
      hudChildren: q('.sc-hud') ? q('.sc-hud').children.length : 0,
      uiRootChildren: q('#ui-root') ? q('#ui-root').children.length : 0,
      visibleButtons: [...document.querySelectorAll('button')].filter(visible).length,
      bootOverlayHidden: !!q('#boot') && q('#boot').classList.contains('hidden'),
    };
  },
  /**
   * Install the click recorder ONCE. Calling it again only resets the
   * array — wrapping the dispatcher twice would count every click twice.
   */
  watchClicks: () => {
    window.__clicks = [];
    if (window.__clickWatcher) return true;
    const ctx = window.SUPERCITYCON?.ctx;
    if (!ctx) return false;
    const orig = ctx.dispatchWorldClick.bind(ctx);
    ctx.dispatchWorldClick = (cell, button) => {
      window.__clicks.push({ cell, button });
      return orig(cell, button);
    };
    window.__clickWatcher = true;
    return true;
  },
  clicks: () => (window.__clicks || []).slice(),
  /** Collect the frame times for a window of real time. */
  frameTimes: (windowMs, minFrames = 8) => new Promise((resolve) => {
    const times = [];
    let last = performance.now();
    const start = last;
    const tick = (now) => {
      times.push(Math.max(0, now - last));
      last = now;
      // The minimum frame count matters: on a heavily loaded software
      // renderer a SINGLE frame can take longer than the whole window, and
      // stopping there would leave a sample of one.
      if (times.length >= minFrames
        && ((now - start >= windowMs) || times.length >= 600)) {
        resolve(times.slice(3));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }),
  /** Dispatch a pointer event with a CONTROLLED timestamp. */
  pointer: (type, opts) => {
    const canvas = document.querySelector('#viewport canvas');
    if (!canvas) return false;
    const ev = new PointerEvent(type, {
      pointerId: opts.id ?? 91,
      pointerType: 'touch',
      isPrimary: true,
      bubbles: true,
      cancelable: true,
      clientX: opts.x,
      clientY: opts.y,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
    });
    if (opts.timeStamp !== undefined) {
      Object.defineProperty(ev, 'timeStamp', { value: opts.timeStamp, configurable: true });
    }
    canvas.dispatchEvent(ev);
    return true;
  },
  /**
   * What the recogniser actually receives.
   *
   * The recogniser's own down/move/up are wrapped so the timestamps the
   * gesture rules actually see are recorded, rather than inferred.
   */
  captureRecogniser: () => {
    const rec = window.SUPERCITYCON?.ctx?.ui?.touch?.recogniser;
    if (!rec) return false;
    if (rec.__captured) return true;
    const seen = [];
    rec.__captured = seen;
    for (const method of ['down', 'move', 'up', 'cancel']) {
      const orig = rec[method].bind(rec);
      rec[method] = (p) => { seen.push({ method, t: p?.t, at: performance.now() }); return orig(p); };
    }
    return true;
  },
  seen: () => (window.SUPERCITYCON?.ctx?.ui?.touch?.recogniser?.__captured || []).slice(),
  /** Empty the recogniser's capture. The array itself, not a copy of it. */
  clearSeen: () => {
    const rec = window.SUPERCITYCON?.ctx?.ui?.touch?.recogniser;
    if (rec && Array.isArray(rec.__captured)) rec.__captured.length = 0;
    return rec?.__captured?.length ?? 0;
  },
  /** The per-frame cost of the gamepad path, in microseconds per call. */
  gamepadCost: (calls) => {
    const svc = window.SUPERCITYCON?.ctx?.ui?.gamepad;
    if (!svc) return { error: 'no gamepad service' };
    const t0 = performance.now();
    for (let i = 0; i < calls; i += 1) svc.update(0.016);
    const t1 = performance.now();
    return { perCallUs: +(((t1 - t0) / calls) * 1000).toFixed(3), calls };
  },
  /** The raw cost of navigator.getGamepads(), in microseconds per call. */
  getGamepadsCost: (calls) => {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return { available: false, perCallUs: 0 };
    }
    let thrown = 0;
    const t0 = performance.now();
    for (let i = 0; i < calls; i += 1) {
      try { navigator.getGamepads(); } catch { thrown += 1; }
    }
    const t1 = performance.now();
    return { available: true, threw: thrown, perCallUs: +(((t1 - t0) / calls) * 1000).toFixed(3) };
  },
};
`;

/** The percentile of a sorted number list. */
function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

/** The frame-time statistics of one sample. */
function frameStats(times) {
  if (!times.length) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    samples: sorted.length,
    meanMs: +(sum / sorted.length).toFixed(2),
    p50Ms: +percentile(sorted, 50).toFixed(2),
    p90Ms: +percentile(sorted, 90).toFixed(2),
    p99Ms: +percentile(sorted, 99).toFixed(2),
    maxMs: +sorted[sorted.length - 1].toFixed(2),
    fpsFromMean: +(1000 / (sum / sorted.length)).toFixed(1),
  };
}

/**
 * Boot the game in one configuration and measure it.
 *
 * @param {import('playwright').Browser} browser
 * @param {object} config
 * @param {object} [opts]
 * @param {boolean} [opts.functional] run the functional assertions
 */
async function runConfig(browser, config, opts = {}) {
  const { functional = false } = opts;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    hasTouch: true,
  });
  await context.addInitScript(INIT_HELPERS);
  if (config.init) await context.addInitScript(config.init);

  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err?.message ?? err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(String(msg.text()));
  });
  page.on('requestfailed', (req) => {
    consoleErrors.push(`request failed: ${req.url()} ${req.failure()?.errorText ?? ''}`);
  });

  const result = {
    id: config.id,
    title: config.title,
    booted: false,
    bootMs: null,
    hud: null,
    camera: null,
    frames: null,
    gamepadCostUs: null,
    getGamepadsCostUs: null,
    pageErrors,
    consoleErrors: [],
  };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const bootMs = await page.evaluate(() => window.__sc.bootMs());
    result.bootMs = bootMs > 0 ? +bootMs.toFixed(1) : null;
    const hud = await page.evaluate(() => window.__sc.hud());
    result.hud = hud;
    result.booted = !!(hud && hud.booted);

    if (result.booted) {
      // The camera must answer the KEYBOARD. The keyboard path is independent
      // of every pointer API, so it is the one control that must survive in
      // every degraded configuration.
      //
      // The renderer is warmed up first: the first frames after the boot are
      // the slowest (the models are still settling) and a key pressed into
      // that stall barely moves the camera.
      await page.waitForTimeout(1000);
      const before = await page.evaluate(() => window.__sc.camera());
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(3000);
      await page.keyboard.up('KeyD');
      await page.waitForTimeout(800);
      const after = await page.evaluate(() => window.__sc.camera());
      const moved = before && after
        ? Math.hypot(after.x - before.x, after.z - before.z)
        : null;
      result.camera = {
        before, after,
        movedUnits: moved === null ? null : +moved.toFixed(3),
      };

      // The per-frame cost of the paths the degraded configurations touch.
      const gpCost = await page.evaluate(() => window.__sc.getGamepadsCost(20000));
      result.getGamepadsCostUs = gpCost;
      const svcCost = await page.evaluate(() => window.__sc.gamepadCost(2000));
      result.gamepadCostUs = svcCost.error ? null : svcCost;

      // --- the pointer path and the pad path, in this configuration ---------
      // A MOUSE click is dispatched as real browser input, so this measures
      // whether the pointer path survived the degradation.
      await page.evaluate(() => window.__sc.watchClicks());
      await page.mouse.click(640, 400);
      await page.waitForTimeout(600);
      const mouseClicks = await page.evaluate(() => window.__sc.clicks().length);

      // The touch service and the pad service must both still be alive and
      // must not throw when they run.
      const services = await page.evaluate(() => {
        const ctx = window.SUPERCITYCON?.ctx;
        const touch = ctx?.ui?.touch;
        const pad = ctx?.ui?.gamepad;
        let padThrew = false;
        let padConnected = null;
        try {
          pad?.update(0.016);
          padConnected = pad?.isConnected?.() ?? null;
        } catch {
          padThrew = true;
        }
        let touchThrew = false;
        try {
          touch?.update(0.016);
        } catch {
          touchThrew = true;
        }
        return {
          touchPresent: !!touch,
          touchThrew,
          padPresent: !!pad,
          padThrew,
          padConnected,
          touchThresholds: touch?.recogniser?.thresholds?.() ?? null,
        };
      });
      result.mouseClicks = mouseClicks;
      result.services = services;

      const times = await page.evaluate((ms) => window.__sc.frameTimes(ms), FRAME_WINDOW_MS);
      result.frames = frameStats(times);
    }
  } catch (err) {
    result.pageErrors.push(`harness: ${String(err?.message ?? err)}`);
  }

  result.consoleErrors = consoleErrors.filter((e) => !/Failed to load resource/.test(e));
  await context.close();
  return result;
}

/**
 * The `Event.timeStamp` guard in `ui/touch.js`.
 *
 * The rule under test (`ui/touch.js:236`):
 *
 *     function eventTime(e) {
 *       const stamp = Number(e?.timeStamp);
 *       if (Number.isFinite(stamp) && stamp > 0 && stamp < 1e12) return stamp;
 *       return now();
 *     }
 *
 * A browser that reports `event.timeStamp` in EPOCH milliseconds produces a
 * value around 1.8e12, which is above the 1e12 ceiling, so the guard rejects
 * it and falls back to `performance.now()`.
 *
 * The proof has four parts:
 *   C — CONTROL: a fast, real tap DOES reach the domains, so the harness can
 *       see a tap when there is one.
 *   D — COUNTERFACTUAL: with the two events carrying the SAME timestamp, the
 *       recogniser reads a duration of 0 ms and fires a TAP. This is exactly
 *       what would happen if the event's own stamp were taken at face value.
 *   B — THE REAL TEST: with an EPOCH timestamp whose two values differ by a
 *       few milliseconds, the guard must reject it, so the recogniser reads
 *       the REAL elapsed time instead and does NOT fire a tap.
 *   A — DIRECT: the timestamps the recogniser actually receives are
 *       performance.now()-based, not epoch values.
 */
async function timestampGuardTest(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  await context.addInitScript(INIT_HELPERS);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err?.message ?? err)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => window.__sc.bootMs());
  await page.evaluate(() => { window.__sc.watchClicks(); window.__sc.captureRecogniser(); });

  /**
   * One trial.
   *
   * @param {object} opts
   * @param {number} opts.gapMs the REAL time between the two events
   * @param {string} opts.stampMode 'real' | 'frozen' | 'epoch'
   * @param {number} opts.epochDeltaMs the epoch delta for the 'epoch' mode
   */
  const trial = async (opts) => {
    const r = await page.evaluate(async (o) => {
      window.__sc.watchClicks();
      window.__sc.clearSeen();
      const x = 640;
      const y = 400;
      const epochBase = Date.now();
      // 'frozen' puts BOTH stamps in the future. That stops the long-press
      // clock (which reads the REAL clock) from preempting the tap, so the
      // trial isolates the timestamp rule and nothing else.
      const frozen = performance.now() + 600000;
      const downStamp = o.stampMode === 'epoch' ? epochBase
        : o.stampMode === 'frozen' ? frozen
          : undefined;
      const downAt = performance.now();
      window.__sc.pointer('pointerdown', { x, y, timeStamp: downStamp });
      await new Promise((r2) => setTimeout(r2, o.gapMs));
      const upStamp = o.stampMode === 'epoch' ? epochBase + o.epochDeltaMs
        : o.stampMode === 'frozen' ? downStamp
          : undefined;
      const upAt = performance.now();
      window.__sc.pointer('pointerup', { x, y, timeStamp: upStamp });
      await new Promise((r2) => setTimeout(r2, 250));
      const seen = window.__sc.seen();
      const down = seen.find((s) => s.method === 'down');
      const up = seen.find((s) => s.method === 'up');
      return {
        clicks: window.__sc.clicks().length,
        downT: down ? down.t : null,
        upT: up ? up.t : null,
        perceivedDurationMs: down && up ? +(up.t - down.t).toFixed(2) : null,
        constructionGapMs: +(upAt - downAt).toFixed(2),
        realGapMs: o.gapMs,
        epochBase,
        epochDeltaMs: o.epochDeltaMs,
      };
    }, opts);
    return r;
  };

  // C — the control: with the browser's OWN timestamps, the recogniser must
  // time the gesture by the moment the events were GENERATED, not by the
  // moment they were processed. On a busy main thread those are far apart,
  // and this is the difference between a tap and a long press.
  const c = await trial({ gapMs: 120, stampMode: 'real', epochDeltaMs: 0 });
  check('with the browser\'s own timestamps, the gesture is timed by when the events were GENERATED',
    c.perceivedDurationMs !== null && Math.abs(c.perceivedDurationMs - c.constructionGapMs) < 60,
    `the recogniser read ${c.perceivedDurationMs} ms; the events were generated ${c.constructionGapMs} ms apart; ${c.clicks} click(s) reached the domains`);

  // D — the counterfactual: the SAME timestamp on both events. The
  // recogniser must read a duration of 0 ms, which is a tap — and that is
  // exactly what the epoch pair below WOULD have produced if the guard had
  // let the epoch value through.
  const d = await trial({ gapMs: 350, stampMode: 'frozen', epochDeltaMs: 0 });
  check('two events with the SAME timestamp are read as a 0 ms gesture (a tap)',
    d.perceivedDurationMs !== null && Math.abs(d.perceivedDurationMs) < 0.5 && d.clicks === 1,
    `the recogniser read ${d.perceivedDurationMs} ms and ${d.clicks} click(s) reached the domains`);

  // B — the real test: an EPOCH stamp whose two values differ by 5 ms. If the
  // epoch value were taken at face value, the duration would be 5 ms — a tap,
  // as trial D shows. The guard must reject it, so the duration is the REAL
  // elapsed time instead.
  const b = await trial({ gapMs: 350, stampMode: 'epoch', epochDeltaMs: 5 });
  check('an epoch timeStamp is rejected, so the gesture is timed by the real clock',
    b.perceivedDurationMs !== null && b.perceivedDurationMs >= 300 && b.clicks === 0,
    `the recogniser read ${b.perceivedDurationMs} ms (the events said ${b.epochBase} and ${b.epochBase + 5}, a 5 ms difference); ${b.clicks} click(s) reached the domains`);

  // A — direct: the value the recogniser receives is performance.now()-based.
  const a = await page.evaluate(() => {
    window.__sc.seen().length = 0;
    const epoch = Date.now();
    window.__sc.pointer('pointerdown', { x: 640, y: 400, timeStamp: epoch });
    const seen = window.__sc.seen();
    const down = seen.find((s) => s.method === 'down');
    return { epoch, t: down ? down.t : null, at: down ? down.at : null };
  });
  check('the epoch timeStamp is replaced by the processing clock',
    a.t !== null && a.t < 1e12 && Math.abs(a.t - a.at) < 2000,
    `the recogniser received t=${a.t} (the event said ${a.epoch}); performance.now() was ${a.at?.toFixed(1)}`);

  const evidence = { control: c, counterfactual: d, epoch: b, direct: a, errors };
  writeFileSync(join(outDir, 'timestamp-guard-evidence.json'), JSON.stringify(evidence, null, 2));
  await context.close();
  return evidence;
}

// ---------------------------------------------------------------------------
// PHASE 3 — the device matrix
// ---------------------------------------------------------------------------

/** The viewports the matrix measures. */
const VIEWPORTS = [
  { id: '320x568', label: '320 px — the smallest phone still sold', width: 320, height: 568 },
  { id: '390x844', label: '390 px — a modern phone (portrait)', width: 390, height: 844 },
  { id: '768x1024', label: '768 px — a tablet (portrait)', width: 768, height: 1024 },
  { id: '1280x800', label: '1280 px — a desktop window', width: 1280, height: 800 },
  { id: '1920x1080', label: '1920 px — a desktop display', width: 1920, height: 1080 },
  { id: '844x390', label: '844 × 390 — a phone in LANDSCAPE', width: 844, height: 390 },
];

/** The minimum touch target the project claims (FR-UX-017). */
const TOUCH_TARGET_MIN = 44;

/**
 * Measure the layout in the page.
 *
 * The measurement runs in the page, so the numbers are the browser's own
 * layout boxes, not an estimate.
 *
 * Two rules make the numbers mean what they say:
 *   - an element inside a SCROLLING or CLIPPING box (the shop's card strip)
 *     is allowed to stick out: the box scrolls it. Only an element with no
 *     such ancestor counts as page overflow;
 *   - the canvas is measured separately, because its DISPLAY size (the CSS
 *     box the player sees) and its DRAWING BUFFER can disagree.
 */
const measureLayout = async (page) => page.evaluate(async (minSize) => {
  const visible = (el) => !!el && (el.offsetParent !== null || el.getClientRects().length > 0);
  const label = (el) => {
    const cls = (el.className && typeof el.className === 'string') ? el.className.trim() : '';
    return `${el.tagName.toLowerCase()}${cls ? `.${cls.split(/\s+/).join('.')}` : ''}`;
  };
  /** Is the element clipped or scrolled by an ancestor box? */
  const clippedByAncestor = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
      p = p.parentElement;
    }
    return false;
  };

  const roots = [document.getElementById('ui-root'), document.getElementById('viewport')]
    .filter(Boolean);
  const all = roots.flatMap((r) => [...r.querySelectorAll('*')]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // --- overflow -----------------------------------------------------------
  let maxRight = 0;
  let maxBottom = 0;
  let minLeft = 0;
  const overflowing = [];
  for (const el of all) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (clippedByAncestor(el)) continue;
    maxRight = Math.max(maxRight, r.right);
    maxBottom = Math.max(maxBottom, r.bottom);
    minLeft = Math.min(minLeft, r.left);
    if (r.right > vw + 0.5 || r.left < -0.5) {
      overflowing.push({
        el: label(el),
        left: +r.left.toFixed(1),
        right: +r.right.toFixed(1),
        width: +r.width.toFixed(1),
        overflowRight: +(r.right - vw).toFixed(1),
        overflowLeft: +(-r.left).toFixed(1),
      });
    }
  }
  overflowing.sort((a, b) => (b.overflowRight + b.overflowLeft) - (a.overflowRight + a.overflowLeft));

  // --- the canvas ---------------------------------------------------------
  const canvas = document.querySelector('#viewport canvas');
  const canvasBox = canvas ? (() => {
    const r = canvas.getBoundingClientRect();
    return {
      displayW: +r.width.toFixed(1),
      displayH: +r.height.toFixed(1),
      right: +r.right.toFixed(1),
      bottom: +r.bottom.toFixed(1),
      bufferW: canvas.width,
      bufferH: canvas.height,
      inlineStyle: canvas.getAttribute('style'),
    };
  })() : null;

  // --- touch targets ------------------------------------------------------
  const SELECTOR = 'button, a[href], input, select, textarea, [role="button"], .sc-swatch, .sc-setbtn, .sc-setrange';
  // Each element gets a stable id the first time it is seen, so the SAME
  // control is not counted twice when it appears in two measurements (the
  // HUD and an open panel).
  let compatCounter = 0;
  const idFor = (el) => {
    if (el.__compatId === undefined) {
      compatCounter += 1;
      el.__compatId = compatCounter;
    }
    return el.__compatId;
  };
  // The DOM is re-queried every time: opening a panel CREATES controls, and
  // a snapshot taken before the panel opened would miss them.
  const measureTargets = () => [...document.querySelectorAll(SELECTOR)].filter(visible).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      id: idFor(el),
      el: label(el),
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      tooSmall: r.width + 0.5 < minSize || r.height + 0.5 < minSize,
    };
  });
  const targets = measureTargets();
  /** The DISTINCT targets that are too small, across every surface. */
  const tooSmallById = new Map();
  const record = (list) => {
    for (const t of list) if (t.tooSmall && !tooSmallById.has(t.id)) tooSmallById.set(t.id, t);
  };
  record(targets);

  // --- the panels, which hold the small controls --------------------------
  const panelResults = {};
  for (const id of ['settings', 'shop', 'help']) {
    try { window.SUPERCITYCON?.ctx?.ui?.openPanel?.(id); } catch { /* optional */ }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const inPanel = measureTargets();
    panelResults[id] = {
      count: inPanel.length,
      tooSmall: inPanel.filter((t) => t.tooSmall),
    };
    record(inPanel);
    try { window.SUPERCITYCON?.ctx?.ui?.closePanel?.(); } catch { /* optional */ }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  // The studio palette, which the studio service owns.
  let studio = null;
  try {
    const studioSvc = window.SUPERCITYCON?.ctx?.domains?.studio;
    studioSvc?.open?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const swatches = [...document.querySelectorAll('.sc-swatch')].filter(visible).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: idFor(el),
        el: 'button.sc-swatch',
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
        tooSmall: r.width + 0.5 < minSize || r.height + 0.5 < minSize,
      };
    });
    studio = {
      visibleCount: swatches.length,
      domCount: document.querySelectorAll('.sc-swatch').length,
      sizes: swatches.slice(0, 3),
      tooSmall: swatches.length > 0 && swatches.some((s) => s.tooSmall),
    };
    record(swatches);
    studioSvc?.close?.();
  } catch { /* optional */ }

  return {
    viewport: { w: vw, h: vh },
    doc: {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    },
    bounds: {
      maxRight: +maxRight.toFixed(1),
      maxBottom: +maxBottom.toFixed(1),
      minLeft: +minLeft.toFixed(1),
      overflowRightPx: +(maxRight - vw).toFixed(1),
      overflowBottomPx: +(maxBottom - vh).toFixed(1),
      overflowLeftPx: +(-minLeft).toFixed(1),
    },
    overflowing: overflowing.slice(0, 8),
    canvas: canvasBox,
    interactiveCount: targets.length,
    tooSmallTargets: [...tooSmallById.values()],
    panels: panelResults,
    studio,
  };
}, TOUCH_TARGET_MIN);

/**
 * The device phase.
 *
 * The matrix has TWO columns, because they answer different questions:
 *
 *   FRESH  — the page is LOADED at that size. This is what a device gets
 *            when it arrives: a phone that opens the game in portrait.
 *   RESIZED — the page was loaded at 1280 x 800 and the viewport is then
 *            changed. This is what a device gets after a ROTATION or a
 *            window resize.
 */
async function deviceAudit(browser) {
  section('PHASE 3 — the device matrix');
  const fresh = [];
  const resized = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: true,
    });
    await context.addInitScript(INIT_HELPERS);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err?.message ?? err)));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate(() => window.__sc.bootMs());
    await page.waitForTimeout(1500);
    const m = await measureLayout(page);
    fresh.push({ ...vp, ...m, errors });
    console.log(
      `FRESH  ${vp.id.padEnd(9)} canvas ${String(m.canvas?.displayW).padStart(6)}x${String(m.canvas?.displayH).padEnd(6)} `
      + `overflow-right ${String(m.bounds.overflowRightPx).padStart(7)} px  `
      + `under ${TOUCH_TARGET_MIN}px: ${m.tooSmallTargets.length}`,
    );
    await context.close();
  }

  // The rotation / window-resize sweep.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    await context.addInitScript(INIT_HELPERS);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err?.message ?? err)));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate(() => window.__sc.bootMs());
    await page.waitForTimeout(1500);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(2500);
      const m = await measureLayout(page);
      resized.push({ ...vp, ...m, errors });
      console.log(
        `RESIZE ${vp.id.padEnd(9)} canvas ${String(m.canvas?.displayW).padStart(6)}x${String(m.canvas?.displayH).padEnd(6)} `
        + `buffer ${String(m.canvas?.bufferW).padStart(6)}x${String(m.canvas?.bufferH).padEnd(6)}  `
        + `overflow-right ${String(m.bounds.overflowRightPx).padStart(7)} px  `
        + `under ${TOUCH_TARGET_MIN}px: ${m.tooSmallTargets.length}`,
      );
    }
    await context.close();
  }

  const evidence = { fresh, resized, minTarget: TOUCH_TARGET_MIN };
  writeFileSync(join(outDir, 'device-evidence.json'), JSON.stringify(evidence, null, 2));
  return evidence;
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });

const staticEvidence = staticAudit();

section(`PHASE 2 — the runtime degradation matrix (${ROUNDS} interleaved rounds)`);

/** The measurements, per configuration. */
const byId = new Map(CONFIGS.map((c) => [c.id, {
  id: c.id,
  title: c.title,
  boots: [],
  frameP50: [],
  frameP90: [],
  frameFps: [],
  rounds: [],
}]));

for (let round = 0; round < ROUNDS; round += 1) {
  for (const config of CONFIGS) {
    const r = await runConfig(browser, config, { functional: round === 0 });
    const acc = byId.get(config.id);
    acc.rounds.push({
      round: round + 1,
      booted: r.booted,
      bootMs: r.bootMs,
      frames: r.frames,
      camera: r.camera,
      hud: r.hud,
      pageErrors: r.pageErrors,
      consoleErrors: r.consoleErrors,
      gamepadCostUs: r.gamepadCostUs,
      getGamepadsCostUs: r.getGamepadsCostUs,
      mouseClicks: r.mouseClicks,
      services: r.services,
    });
    if (r.booted) {
      acc.boots.push(r.bootMs);
      if (r.frames) {
        acc.frameP50.push(r.frames.p50Ms);
        acc.frameP90.push(r.frames.p90Ms);
        acc.frameFps.push(r.frames.fpsFromMean);
      }
    }
    console.log(
      `round ${round + 1}  ${config.id.padEnd(20)} booted=${String(r.booted).padEnd(5)} `
      + `boot=${String(r.bootMs ?? 'n/a').padStart(8)} ms  `
      + `p50=${r.frames ? String(r.frames.p50Ms).padStart(7) : '     n/a'} ms  `
      + `errors=${r.pageErrors.length + r.consoleErrors.length}`
      + ((r.pageErrors.length + r.consoleErrors.length)
        ? `  -> ${[...r.pageErrors, ...r.consoleErrors][0].slice(0, 160)}` : ''),
    );
  }
}

/** The matrix, with the medians and the noise floor. */
const matrix = [...byId.values()].map((acc) => {
  const first = acc.rounds[0];
  return {
    id: acc.id,
    title: acc.title,
    booted: first.booted,
    bootMsMedian: median(acc.boots),
    bootMsSamples: acc.boots,
    frameP50Median: median(acc.frameP50),
    frameP50Samples: acc.frameP50,
    frameP90Median: median(acc.frameP90),
    fpsMedian: median(acc.frameFps),
    frameSamples: acc.rounds.map((r) => r.frames).filter(Boolean),
    camera: first.camera,
    hud: first.hud,
    pageErrors: first.pageErrors,
    consoleErrors: first.consoleErrors,
    gamepadCostUs: first.gamepadCostUs,
    getGamepadsCostUs: first.getGamepadsCostUs,
    mouseClicks: first.mouseClicks,
    services: first.services,
  };
});

const baselineAcc = byId.get('baseline');
/** The noise floor: the baseline's own spread over the rounds. */
const noise = {
  bootMsSpread: baselineAcc.boots.length > 1
    ? +(Math.max(...baselineAcc.boots) - Math.min(...baselineAcc.boots)).toFixed(1) : null,
  frameP50Spread: baselineAcc.frameP50.length > 1
    ? +(Math.max(...baselineAcc.frameP50) - Math.min(...baselineAcc.frameP50)).toFixed(1) : null,
};

section('the degradation matrix, as assertions');
for (const m of matrix) {
  check(`${m.id}: the game boots`, m.booted,
    m.booted ? `ready in ${m.bootMsMedian} ms (median of ${m.bootMsSamples.length})` : (m.hud?.fatalText || 'no game context'));
  if (m.booted) {
    check(`${m.id}: the HUD renders`, !!(m.hud?.hudPresent && m.hud.hudChildren > 0 && m.hud.visibleButtons > 0),
      `${m.hud.hudChildren} HUD children, ${m.hud.visibleButtons} visible buttons`);
    check(`${m.id}: the camera answers the keyboard`,
      m.camera?.movedUnits !== null && m.camera?.movedUnits > 0.5,
      m.camera?.movedUnits === null
        ? 'no camera'
        : `the camera moved ${m.camera.movedUnits} world units on KeyD`);
  }
  check(`${m.id}: no console error`, m.pageErrors.length === 0 && m.consoleErrors.length === 0,
    [...m.pageErrors, ...m.consoleErrors].slice(0, 2).join(' | '));
  if (m.booted) {
    check(`${m.id}: the touch and pad services are alive and do not throw`,
      m.services?.touchPresent === true && m.services?.touchThrew === false
      && m.services?.padPresent === true && m.services?.padThrew === false,
      `touch ${m.services?.touchPresent ? 'present' : 'MISSING'}/${m.services?.touchThrew ? 'threw' : 'ok'}, `
      + `pad ${m.services?.padPresent ? 'present' : 'MISSING'}/${m.services?.padThrew ? 'threw' : 'ok'}`);
    const expect = CONFIGS.find((c) => c.id === m.id)?.expectMouseClicks ?? 1;
    check(`${m.id}: the mouse pointer path ${expect ? 'still selects a cell' : 'is gone, as expected'}`,
      m.mouseClicks === expect,
      `${m.mouseClicks} click(s) reached the domains (expected ${expect})`);
  }
}
check('the baseline configuration is healthy',
  matrix[0].booted && matrix[0].pageErrors.length === 0 && matrix[0].consoleErrors.length === 0,
  'the baseline must pass, or the audit itself is not trustworthy');

section('PHASE 2b — the Event.timeStamp guard');
const tsEvidence = await timestampGuardTest(browser);

// The runtime evidence is only about the bundle that was SCANNED if the
// bundle on disk did not change while the audit was running.
const entryAfter = findEntryChunk();
const shaAfter = entryAfter
  ? createHash('sha256').update(readFileSync(entryAfter, 'utf8')).digest('hex')
  : null;
check('the shipped bundle did not change while the audit was running',
  !!staticEvidence && shaAfter === staticEvidence.sha256,
  shaAfter === staticEvidence?.sha256
    ? `sha256 ${shaAfter}`
    : `the bundle changed during the audit (${staticEvidence?.sha256} -> ${shaAfter}) — re-run the audit`);

section('PHASE 3 — the device matrix');
const deviceEvidence = await deviceAudit(browser);

await browser.close();

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

const evidence = {
  generatedAt: new Date().toISOString(),
  url,
  engine: 'chromium (playwright) — the only engine in this environment',
  rounds: ROUNDS,
  frameWindowMs: FRAME_WINDOW_MS,
  static: staticEvidence,
  matrix,
  noiseFloor: noise,
  timestampGuard: tsEvidence,
  device: deviceEvidence,
  results,
};
writeFileSync(join(outDir, 'audit-evidence.json'), JSON.stringify(evidence, null, 2));

section('the summary');
console.log(`checks run:     ${results.length}`);
console.log(`checks failed:  ${results.filter((r) => !r.pass).length}`);
console.log(`noise floor:    boot ±${noise.bootMsSpread} ms, frame p50 ±${noise.frameP50Spread} ms (the baseline's own spread)`);
console.log(`evidence:       ${outDir}/audit-evidence.json`);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.log('\nfailed checks:');
  for (const f of failed) console.log(`  - ${f.name}  (${f.detail})`);
}

// The audit finding a problem is not the same as the audit failing to RUN.
// The tool exits non-zero only when it could not do its job.
if (!matrix[0]?.booted) {
  console.error('\nThe BASELINE configuration did not boot — the audit could not be trusted.');
  process.exit(1);
}
process.exit(0);
