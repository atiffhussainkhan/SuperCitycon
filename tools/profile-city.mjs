#!/usr/bin/env node
/**
 * tools/profile-city.mjs — the frame time of a REAL city with the MAXIMUM
 * number of citizens.
 *
 *   node tools/profile-city.mjs [--url <url>] [--frames 300] [--outdir <dir>]
 *                               [--port 4201]
 *
 * WHAT THIS IS:
 *   A headed Chromium window (a real GPU, not the headless software GL
 *   implementation) pointed at a served build of the game. It waits for the
 *   game to report ready, measures the frame-time distribution of the BOOT
 *   scene, then builds a real city through the game's own DOMAIN API —
 *   roads, housing, services — until the population has derived enough
 *   residents for the game itself to draw the maximum number of citizens
 *   (`TUNING.maxRenderedCitizens`). It then measures the frame-time
 *   distribution of that city, reads the renderer counters and the memory
 *   footprint, and reports what the pathfinding costs.
 *
 *   The V7 release measured the boot scene (63 draw calls, 60 fps) and never
 *   measured a running city at full population, which is where the new
 *   grid-A* pathfinding cost actually shows up. This tool takes that
 *   measurement (V7-NFR-003).
 *
 * WHAT THIS IS NOT:
 *   A claim about any other machine. Every number here is for the machine
 *   named in the output. Software rendering is DETECTED and labelled, never
 *   presented as a GPU benchmark.
 *
 *   The renderer is classified from the ACTUAL WebGL context and the
 *   browser's own GPU device metadata, not from the launch mode: a headed
 *   browser can still fall back to software GL, and a headless one can
 *   sometimes reach a real GPU.
 *
 *   The path-search counters (`started` / `deferred`) live on the internal
 *   `citizens` service in `game/src/population/citizens.js` and are NOT
 *   published upward by the POP domain, so they cannot be read from the
 *   page. This tool PROBES for them at runtime and reports what it found;
 *   it measures the pathfinding cost instead of guessing at it. The
 *   population domain is NOT modified.
 *
 * Exit code: 0 when the probe completed, 1 when the game never became ready,
 * 2 when the probe completed but the page reported errors.
 */

import { spawn } from 'node:child_process';
import { accessSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChromium } from './playwright-resolve.mjs';

const { chromium } = await resolveChromium();

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const PORT = Number(arg('port', 4201));
const FRAMES = Number(arg('frames', 300));
// The report lands OUTSIDE `game/`: the game tree belongs to other owners,
// and this tool writes an artefact, it does not change the game.
const OUTDIR = resolve(arg('outdir', join(ROOT, 'verification', 'v7-city')));
const EXTERNAL = arg('url', null);

/**
 * The city the tool builds.
 *
 * The plan is deliberately a CITY and not a row of houses: the citizens walk
 * to a serviced building, so every spawn is a real grid-A* search over a
 * city with obstacles in it, and the roads carry traffic, so the frame cost
 * includes the vehicles a real city has.
 */
const CITY_PLAN = {
  region: { x0: 12, x1: 50, z0: 12, z1: 50 },
  /** One north-south street and one east-west street every N cells. */
  roadPitch: 5,
  /** Buildings on every Nth cell of the block grid. */
  housePitch: 1,
  /**
   * The serviced buildings the citizens walk to. Each one is tried at
   * several positions: the terrain decides where a building of that size
   * fits, and the tool reports where it ended up.
   */
  services: [
    { id: 'hea.medical_center', at: [[16, 16], [24, 24], [34, 34]] },
    { id: 'prk.park', at: [[22, 18], [30, 30], [18, 30]] },
    { id: 'com.grocery', at: [[28, 20], [20, 28], [36, 36]] },
  ],
  /** The housing the residents live in. */
  house: 'res.house',
};

/**
 * Classify the ACTUAL renderer.
 *
 * The launch mode is NOT evidence. The WebGL renderer string and the
 * browser's own GPU device metadata are.
 */
function classifyHardwareRenderer(context, systemInfo) {
  const renderer = String(context?.unmasked_renderer || '');
  const vendor = String(context?.unmasked_vendor || '');
  const glStatus = String(systemInfo?.gpu?.featureStatus?.webgl || '');
  const software = /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render|\bwarp\b|virgl/i;
  if (software.test(renderer) || software.test(glStatus)) {
    return {
      kind: 'software',
      verified: false,
      reason: 'The actual WebGL renderer identifies software rendering.',
      renderer,
      vendor,
    };
  }
  if (!renderer || !/\b(?:AMD|ATI|Intel|NVIDIA|Apple)\b|Radeon|GeForce|ANGLE Metal Renderer/i.test(renderer)) {
    return {
      kind: 'unknown',
      verified: false,
      reason: 'The actual WebGL context exposes no recognised physical GPU renderer.',
      renderer,
      vendor,
    };
  }
  if (!Array.isArray(systemInfo?.gpu?.devices) || !systemInfo.gpu.devices.length) {
    return {
      kind: 'unknown',
      verified: false,
      reason: 'Browser GPU device metadata is unavailable; hardware evidence is incomplete.',
      renderer,
      vendor,
    };
  }
  return {
    kind: 'hardware',
    verified: true,
    reason: 'The actual WebGL context names a physical GPU and the browser reports GPU device metadata.',
    renderer,
    vendor,
  };
}

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok || res.status === 404) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

let preview = null;
let url = EXTERNAL;

if (!EXTERNAL) {
  const dist = join(ROOT, 'game', 'dist');
  try {
    accessSync(join(dist, 'index.html'));
  } catch {
    process.stderr.write(`No build found at ${dist}. Run "npm run build" in game/ first.\n`);
    process.exit(1);
  }
  preview = spawn('npm', ['run', 'preview', '--', '--port', String(PORT), '--strictPort'], {
    cwd: join(ROOT, 'game'),
    stdio: 'ignore',
    detached: false,
  });
  url = `http://127.0.0.1:${PORT}/`;
  const up = await waitForServer(url);
  if (!up) {
    process.stderr.write(`The preview server never came up on ${url}\n`);
    preview.kill('SIGTERM');
    process.exit(1);
  }
}

const browser = await chromium.launch({
  headless: false,          // a real window; the renderer is classified separately
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});

const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
const pageErrors = [];
const failed = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('requestfailed', (r) => failed.push(`${r.url()} — ${r.failure()?.errorText}`));

// ---------------------------------------------------------------------------
// The frame-time measurement
// ---------------------------------------------------------------------------

/**
 * Measure the frame-time distribution over `frameCount` rendered frames.
 *
 * This runs IN THE PAGE. The first sample is taken from the FIRST rAF
 * timestamp, not from `performance.now()`: a rAF callback's timestamp is the
 * time the frame BEGAN, which can be EARLIER than the `performance.now()` we
 * sampled a moment ago — seeding `last` with `performance.now()` therefore
 * produces a spurious NEGATIVE frame time that poisons the mean and the p99.
 * Seeding from the first rAF timestamp guarantees every delta is a real frame
 * gap.
 *
 * The citizen count is recorded per frame as well: the frames in which the
 * population GREW are the frames in which the citizens started their path
 * searches, and the report compares them against the frames that did not.
 */
async function measureInPage(frameCount) {
  const S = window.SUPERCITYCON;
  const gl = S.renderer?.renderer?.getContext?.();

  // The REAL renderer string, from the actual context.
  const dbg = gl?.getExtension?.('WEBGL_debug_renderer_info');
  const context = dbg ? {
    unmasked_renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL),
    unmasked_vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL),
  } : { unmasked_renderer: gl?.getParameter?.(gl.RENDERER), unmasked_vendor: '' };

  // The LONG ANIMATION FRAMES.
  //
  // The frame-time distribution above is bounded BELOW by the display's
  // vsync interval, so when the city is cheap enough to hold 60 fps the two
  // scenes measure the same 16.7 ms and the distribution cannot resolve the
  // work the city adds. The long-animation-frame entries report the WORK of
  // a frame — the time from the frame's start to the end of its rendering —
  // and only for the frames that were slower than the threshold. A scene
  // that produced NO entry did not exceed the frame budget at all.
  const loaf = { supported: false, thresholdMs: 16, entries: [] };
  let loafObserver = null;
  try {
    const supported = PerformanceObserver.supportedEntryTypes || [];
    if (supported.includes('long-animation-frame')) {
      loaf.supported = true;
      loafObserver = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          loaf.entries.push({
            durationMs: +Number(e.duration).toFixed(2),
            scriptMs: +(e.scripts ?? []).reduce((a, s) => a + (Number(s.duration) || 0), 0).toFixed(2),
          });
        }
      });
      loafObserver.observe({ type: 'long-animation-frame', durationThreshold: 16 });
    }
  } catch {
    /* the instrument is optional; the report says when it is missing */
  }

  const times = [];
  const citizensPerFrame = [];
  await new Promise((resolve) => {
    let last = null;
    let count = 0;
    const step = (now) => {
      if (last !== null) times.push(now - last);
      last = now;
      citizensPerFrame.push(S.ctx.domains.population?.citizenCount?.() ?? null);
      count += 1;
      if (count > frameCount) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  // The observer delivers its entries after the frame, so the report waits
  // for them before reading them.
  await new Promise((r) => setTimeout(r, 120));
  loafObserver?.disconnect?.();

  const info = S.renderer.renderer.info;
  const perf = S.renderer.getPerformance?.() ?? null;
  const mem = performance.memory
    ? {
      usedJSHeapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(2),
      totalJSHeapMB: +(performance.memory.totalJSHeapSize / 1048576).toFixed(2),
      jsHeapLimitMB: +(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2),
    }
    : null;

  return {
    context,
    frameTimes: times.map((t) => +t.toFixed(3)),
    citizensPerFrame,
    loaf,
    counters: {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? null,
    },
    perf,
    mem,
    state: {
      buildings: S.state.buildings.instances.size,
      citizens: S.state.population.total,
      treasury: S.state.economy.treasury,
      day: S.state.meta.day,
      elapsed: +(S.state.meta.elapsed ?? 0).toFixed(2),
    },
    fx: S.renderer.fx?.stats?.() ?? null,
  };
}

/**
 * The distribution of a frame-time sample.
 *
 * The same fields `profile-gpu.mjs` reports, so the two reports are
 * comparable.
 */
function distribution(frameTimes) {
  const times = frameTimes.slice().sort((a, b) => a - b);
  if (!times.length) {
    return {
      counted: 0, meanMs: null, medianMs: null, p95Ms: null, p99Ms: null,
      minMs: null, maxMs: null, fpsMean: null, fpsP95Worst: null, negativeSamples: 0,
    };
  }
  const pct = (p) => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))];
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    counted: times.length,
    meanMs: +mean.toFixed(3),
    medianMs: pct(50),
    p95Ms: pct(95),
    p99Ms: pct(99),
    minMs: times[0],
    maxMs: times[times.length - 1],
    fpsMean: +(1000 / mean).toFixed(1),
    fpsP95Worst: +(1000 / pct(95)).toFixed(1),
    // A negative frame time is impossible in a real frame loop, so any that
    // survive are a measurement artefact. They are counted, never hidden, and
    // a non-zero count means the frame distribution above is suspect.
    negativeSamples: times.filter((t) => t < 0).length,
  };
}

// ---------------------------------------------------------------------------
// Building the city
// ---------------------------------------------------------------------------

/**
 * Build the city through the game's own DOMAIN API.
 *
 * Nothing here reaches into the game's internals: the roads go through the
 * mobility service, the buildings through the buildings service (and
 * therefore through the economy's construction-slot and treasury gate, exactly
 * as a player's placement does), and the citizens through the population
 * service.
 */
async function buildCityInPage(plan) {
  const S = window.SUPERCITYCON;
  const B = S.ctx.domains.buildings;
  const E = S.ctx.domains.economy;
  const M = S.ctx.domains.mobility;
  const P = S.ctx.domains.population;
  const T = S.ctx.config.TUNING;

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  // Compress the construction windows so the one owned slot frees up within
  // a frame or two; the city is built through the NORMAL placement path, so
  // the slot gate is exercised exactly as a player's is.
  E.setConstructionSpeed?.(6000);

  /** Is this cell free for a new building? */
  const cellFree = (cx, cz) => {
    if (cx < 0 || cz < 0 || cx > 63 || cz > 63) return false;
    if (B.buildingAt(cx, cz)) return false;
    if (M?.roadAt?.(cx, cz)) return false;
    if (S.ctx.domains.wld?.isWater?.(cx, cz)) return false;
    return true;
  };

  /** The footprint of a catalogue entry, in cells. */
  const catalogue = B.catalogue?.() || [];
  const footprint = (id) => {
    const def = catalogue.find((d) => d && d.id === id);
    return [Math.max(1, def?.footprintCells?.[0] ?? 1), Math.max(1, def?.footprintCells?.[1] ?? 1)];
  };

  /**
   * Place one building, spiralling out from the wanted cell until the whole
   * footprint is free.
   *
   * The terrain has water and the streets have their own cells, so a planned
   * cell is often not usable; the spiral is what makes the plan a plan and
   * not a script.
   */
  async function placeNear(id, cx, cz, maxRadius = 12) {
    const [fw, fh] = footprint(id);
    for (let d = 0; d <= maxRadius; d += 1) {
      for (let dz = -d; dz <= d; dz += 1) {
        for (let dx = -d; dx <= d; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
          const tx = cx + dx;
          const tz = cz + dz;
          let clear = true;
          for (let fx = 0; fx < fw && clear; fx += 1) {
            for (let fz = 0; fz < fh && clear; fz += 1) {
              if (!cellFree(tx + fx, tz + fz)) clear = false;
            }
          }
          if (!clear) continue;
          // The construction slot is the only reason to wait: every other
          // refusal (water, slope, money) is final for this cell.
          for (let attempt = 0; attempt < 60; attempt += 1) {
            const r = B.place(id, tx, tz, 0);
            if (r?.ok) return { ok: true, id, x: tx, z: tz };
            if (r?.reason !== 'not-enough-slots') return { ok: false, id, reason: r?.reason ?? 'unknown' };
            await nextFrame();
          }
          return { ok: false, id, reason: 'slot-timeout' };
        }
      }
    }
    return { ok: false, id, reason: 'no-free-cell' };
  }

  // --- the serviced buildings ---------------------------------------------
  // The citizens walk to one of these, so they are placed FIRST: without a
  // serviced building every citizen walks onto its own doorstep and never
  // starts a path search at all. They also go down before the streets,
  // because a service on a street cell can never be built.
  const services = [];
  for (const svc of plan.services) {
    let r = { ok: false, reason: 'no-free-cell' };
    for (const at of svc.at) {
      r = await placeNear(svc.id, at[0], at[1]);
      if (r.ok) break;
    }
    services.push({ ...svc, ...r });
  }

  // --- the street network -------------------------------------------------
  // Without roads there is no traffic, and a city without traffic is not the
  // high-activity scene this profile is for.
  let roads = 0;
  const roadFailures = {};
  for (let cz = plan.region.z0; cz <= plan.region.z1; cz += 1) {
    for (let cx = plan.region.x0; cx <= plan.region.x1; cx += 1) {
      if (cx % plan.roadPitch !== 0 && cz % plan.roadPitch !== 0) continue;
      if (B.buildingAt(cx, cz)) {
        roadFailures['occupied'] = (roadFailures['occupied'] ?? 0) + 1;
        continue;
      }
      const r = M?.addRoad ? M.addRoad(cx, cz) : null;
      if (r === false || (r && r.ok === false)) {
        const reason = r?.reason ?? 'rejected';
        roadFailures[reason] = (roadFailures[reason] ?? 0) + 1;
        continue;
      }
      roads += 1;
    }
  }

  // --- the housing ---------------------------------------------------------
  // The houses go on every free cell of the block grid: a city is as big as
  // its treasury allows, and the treasury IS the limit — when the placement
  // is refused for the lack of coins the city is finished.
  const houses = { placed: 0, failed: {}, byType: {}, stopped: null };
  for (let cz = plan.region.z0; cz <= plan.region.z1 && !houses.stopped; cz += plan.housePitch) {
    for (let cx = plan.region.x0; cx <= plan.region.x1 && !houses.stopped; cx += plan.housePitch) {
      if (!cellFree(cx, cz)) {
        houses.failed['not-free'] = (houses.failed['not-free'] ?? 0) + 1;
        continue;
      }
      const r = await placeNear(plan.house, cx, cz, 0);
      if (r.ok) {
        houses.placed += 1;
        houses.byType[plan.house] = (houses.byType[plan.house] ?? 0) + 1;
      } else if (r.reason === 'insufficient-funds') {
        houses.stopped = `the treasury ran out at ${cx},${cz}`;
        houses.failed[r.reason] = (houses.failed[r.reason] ?? 0) + 1;
      } else {
        houses.failed[r.reason] = (houses.failed[r.reason] ?? 0) + 1;
      }
    }
  }

  // --- let the population derive ------------------------------------------
  // The population is DERIVED from the housing, so the city has to be given
  // a few frames before the residents (and the citizens that walk them)
  // exist.
  const deadline = Date.now() + 30000;
  let total = 0;
  while (Date.now() < deadline) {
    total = S.state.population?.total ?? 0;
    if (total > 0 && P.citizenCount?.() > 0) break;
    await nextFrame();
  }
  // Top the rendered citizens up to the cap through the population service.
  // The population's own sync usually gets there first; this is the
  // backstop, and the report says which one did the work.
  let topped = 0;
  const cap = Number(T.maxRenderedCitizens) || 0;
  for (let i = 0; i < cap + 8; i += 1) {
    if ((P.citizenCount?.() ?? 0) >= cap) break;
    if (P.spawnCitizen?.()) topped += 1; else break;
  }
  // A short settle so the citizens reach their routes before the sample
  // starts.
  for (let i = 0; i < 120; i += 1) await nextFrame();

  return {
    roads,
    roadFailures,
    services: services.map((s) => ({ id: s.id, ok: s.ok, reason: s.reason ?? null, x: s.x ?? null, z: s.z ?? null })),
    houses,
    toppedUpBySpawnCitizen: topped,
    residents: S.state.population?.total ?? 0,
    housingCapacity: S.state.population?.housingCapacity ?? 0,
    renderedCitizens: P.citizenCount?.() ?? 0,
    maxRenderedCitizens: cap,
    vehicles: M?.vehicleCount?.() ?? null,
    treasury: S.state.economy?.treasury ?? null,
    buildingInstances: S.state.buildings?.instances?.size ?? 0,
    speed: S.state.meta?.speed ?? null,
  };
}

// ---------------------------------------------------------------------------
// The pathfinding probe
// ---------------------------------------------------------------------------

/**
 * Probe for the path-search counters and MEASURE the pathfinding cost.
 *
 * The counters (`started` / `deferred`) live on the internal `citizens`
 * service. The probe asks the published POP service for them, and reports
 * honestly what it finds. When they are not published — which is the case
 * today — the cost is MEASURED instead:
 *
 *   - The population is asked to re-spawn the citizens it lost, and the
 *     frames that carried those re-spawns are compared with the frames
 *     between them.
 *   - A burst of spawns inside ONE frame is timed: the frame's search budget
 *     (`TUNING.citizenPathsPerFrame`) is spent on the first spawns and the
 *     rest are deferred to the straight-line fallback.
 *   - The same number of spawns spread over one frame each is timed, so the
 *     marginal cost of a REAL search can be read off the difference.
 */
async function probePathfindingInPage() {
  const S = window.SUPERCITYCON;
  const P = S.ctx.domains.population;
  const T = S.ctx.config.TUNING;

  // --- is the counter surface published? ---------------------------------
  const probed = [];
  const found = {};
  const candidates = [
    ['population.pathStats', () => P?.pathStats],
    ['population.poolStats', () => P?.poolStats],
    ['population.pathfindingStats', () => P?.pathfindingStats],
    ['population.pathSearches', () => P?.pathSearches],
    ['population.paths', () => P?.paths],
    ['population.stats', () => P?.stats],
    ['population.debug', () => P?.debug],
    ['population.citizens.pathStats', () => P?.citizens?.pathStats],
    ['population.citizens.poolStats', () => P?.citizens?.poolStats],
    ['state.population.paths', () => S.state.population?.paths],
    ['state.population.pathStats', () => S.state.population?.pathStats],
  ];
  for (const [name, get] of candidates) {
    let value;
    try { value = get(); } catch { value = undefined; }
    probed.push({ surface: name, present: value !== undefined && value !== null });
    if (value !== undefined && value !== null) {
      try {
        found[name] = typeof value === 'function' ? value.call(P) : value;
      } catch {
        found[name] = 'unreadable';
      }
    }
  }

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const cap = Number(T.maxRenderedCitizens) || 0;
  const budget = Number(T.citizenPathsPerFrame) || 0;

  // --- the frames around a controlled re-spawn ----------------------------
  // The citizens are removed in ONE callback. The population's own sync puts
  // them back at the next tick, and the tick runs in the GAME's frame
  // callback — which is always registered before this tool's, so the game
  // runs first in every frame. The drop therefore happens after the game's
  // callback of that frame, the re-spawn runs in the game's callback of the
  // NEXT frame, and its work is in the gap of the frame after that.
  //
  // The re-spawn is repeated: one sample of a vsync-quantised frame gap
  // cannot tell a real cost from the noise, so the median of several
  // re-spawn frames is compared with the median of the frames between them.
  const before = P.citizenCount?.() ?? 0;
  const drop = Math.min(20, Math.max(0, before - 1));
  const respawnTrace = [];
  const dropIndexes = [];
  {
    let last = null;
    await new Promise((resolve) => {
      let count = 0;
      const step = (now) => {
        if (last !== null) respawnTrace.push({ ms: +(now - last).toFixed(3), citizens: P.citizenCount?.() ?? 0 });
        last = now;
        count += 1;
        // The citizens are dropped every 25 frames, so the window holds
        // several re-spawns and the frames between them.
        if (count >= 5 && (count - 5) % 25 === 0 && count <= 105) {
          dropIndexes.push(respawnTrace.length - 1);
          for (let i = 0; i < drop; i += 1) P.despawnCitizen?.();
        }
        if (count > 120) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // --- a burst of spawns inside ONE frame ---------------------------------
  // The citizens are dropped and the replacements are spawned in the SAME
  // task, so no tick can run in between: the frame's budget is intact and
  // the first spawns of the burst spend it.
  //
  // The probe runs ROUNDS times: a single search is far below the browser's
  // clock resolution (a fraction of a millisecond), so only the AGGREGATE
  // over many rounds can be timed honestly.
  const ROUNDS = 10;
  const burstSize = Math.min(20, Math.max(0, cap - 1));
  const burst = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    for (let i = 0; i < burstSize; i += 1) P.despawnCitizen?.();
    for (let i = 0; i < burstSize; i += 1) {
      const t0 = performance.now();
      const ok = !!P.spawnCitizen?.();
      burst.push({ ok, ms: +(performance.now() - t0).toFixed(4) });
    }
  }

  // --- the same spawns, ONE per frame --------------------------------------
  // One spawn per frame always finds the budget open, so every one of these
  // starts a REAL search.
  const perFrame = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    for (let i = 0; i < 20; i += 1) {
      await nextFrame();
      if ((P.citizenCount?.() ?? 0) >= cap) P.despawnCitizen?.();
      const t0 = performance.now();
      const ok = !!P.spawnCitizen?.();
      perFrame.push({ ok, ms: +(performance.now() - t0).toFixed(4) });
    }
  }

  return {
    counters: {
      available: Object.keys(found).length > 0,
      probed,
      found,
    },
    budgetPerFrame: budget,
    pathBudgetCells: Number(T.citizenPathBudget) || null,
    respawn: {
      dropped: drop,
      citizensBefore: before,
      citizensAfter: P.citizenCount?.() ?? 0,
      dropIndexes,
      trace: respawnTrace,
    },
    burst: { size: burstSize, rounds: ROUNDS, calls: burst },
    perFrame: { size: perFrame.length, rounds: ROUNDS, calls: perFrame },
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let bootMs = null;
let ready = false;
try {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true, null, { timeout: 120000 });
  bootMs = Date.now() - t0;
  ready = true;
} catch (err) {
  process.stderr.write(`The game never became ready: ${err?.message ?? err}\n`);
}

if (!ready) {
  await browser.close();
  if (preview) preview.kill('SIGTERM');
  process.exit(1);
}

// Let the scene settle so the first frames (shader compilation) are not
// counted.
await page.waitForTimeout(1500);

const tuning = await page.evaluate(() => {
  const T = window.SUPERCITYCON?.ctx?.config?.TUNING ?? {};
  return {
    maxRenderedCitizens: T.maxRenderedCitizens ?? null,
    citizenPathsPerFrame: T.citizenPathsPerFrame ?? null,
    citizenPathBudget: T.citizenPathBudget ?? null,
  };
});

// --- 1. the boot scene -----------------------------------------------------
const bootRaw = await page.evaluate(measureInPage, FRAMES);
const bootFrames = distribution(bootRaw.frameTimes);

// --- 2. build the city -----------------------------------------------------
const buildStart = Date.now();
const built = await page.evaluate(buildCityInPage, CITY_PLAN);
const buildMs = Date.now() - buildStart;

// Let the city settle: the buildings are drawn as instanced batches that are
// rebuilt when the city changes, and the traffic needs a moment to reach the
// streets. The city scene must be measured on a RUNNING city, not on the
// settling of the build.
const settleStart = Date.now();
await page.evaluate(async () => {
  for (let i = 0; i < 300; i += 1) {
    await new Promise((r) => requestAnimationFrame(() => r()));
  }
});
const settleMs = Date.now() - settleStart;

// --- 3. the city scene -----------------------------------------------------
const cityRaw = await page.evaluate(measureInPage, FRAMES);
const cityFrames = distribution(cityRaw.frameTimes);

// --- 4. the pathfinding cost ----------------------------------------------
const pathfinding = await page.evaluate(probePathfindingInPage);

// --- 5. the renderer -------------------------------------------------------
const systemInfo = await page.evaluate(async () => {
  // Chrome exposes GPU device metadata through an internal API; when it is
  // unavailable the classification falls back to the WebGL string alone and
  // says so.
  try {
    if (navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter?.();
      if (adapter) {
        const info = adapter.info ?? (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null);
        return {
          webgl2: !!document.createElement('canvas').getContext('webgl2'),
          gpu: {
            featureStatus: { webgl: 'enabled' },
            devices: info ? [{ description: info.description, vendor: info.vendor }] : [{ description: adapter.name ?? 'unknown' }],
          },
        };
      }
    }
  } catch {
    /* fall through */
  }
  return { webgl2: true, gpu: { featureStatus: {}, devices: [] } };
});

const hardware = classifyHardwareRenderer(cityRaw.context ?? bootRaw.context, systemInfo);

// ---------------------------------------------------------------------------
// The pathfinding numbers
// ---------------------------------------------------------------------------

/**
 * Analyse the window around the controlled re-spawns.
 *
 * The citizens are dropped in one frame and the population puts them back at
 * the next tick. The GAME's frame callback is always registered before this
 * tool's, so the game runs first in every frame: the drop happens after the
 * game's callback of that frame, the tick that re-spawns the citizens runs
 * in the game's callback of the NEXT frame, and its work is therefore in
 * the gap of the frame after that.
 *
 * Several re-spawns are sampled, because one sample of a vsync-quantised
 * frame gap cannot tell a real cost from the noise.
 */
function analyseRespawn(trace, dropIndexes) {
  const median = (values) => {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(3);
  };
  const spawnFrames = [];
  const steadyFrames = [];
  for (let i = 0; i < trace.length; i += 1) {
    // The entry at `drop + 1` is the gap that carried the re-spawn.
    if (dropIndexes.includes(i - 1)) spawnFrames.push(trace[i].ms);
    else steadyFrames.push(trace[i].ms);
  }
  const spawnMedian = median(spawnFrames);
  const steadyMedian = median(steadyFrames);
  return {
    respawnFrames: spawnFrames.length,
    respawnFrameMedianMs: spawnMedian,
    steadyFrameMedianMs: steadyMedian,
    overheadMedianMs: (spawnMedian === null || steadyMedian === null)
      ? null
      : +(spawnMedian - steadyMedian).toFixed(3),
    windowFrames: trace.length,
    respawnFrameMaxMs: spawnFrames.length ? +Math.max(...spawnFrames).toFixed(3) : null,
  };
}

/**
 * The aggregate cost of the spawn calls, split into the calls that started a
 * search and the calls that were deferred.
 *
 * The browser's clock is coarse (a fraction of a millisecond), so a single
 * search cannot be timed reliably; the AGGREGATE over many calls can.
 */
function aggregateCalls(calls) {
  if (!calls.length) return { calls: 0, totalMs: null, meanMs: null, maxMs: null };
  const times = calls.map((c) => c.ms);
  const total = times.reduce((a, b) => a + b, 0);
  return {
    calls: calls.length,
    spawned: calls.filter((c) => c.ok).length,
    totalMs: +total.toFixed(3),
    meanMs: +(total / calls.length).toFixed(4),
    maxMs: +Math.max(...times).toFixed(4),
  };
}

const spawnSplit = analyseRespawn(pathfinding.respawn.trace, pathfinding.respawn.dropIndexes);
const burstAgg = aggregateCalls(pathfinding.burst.calls);
const perFrameAgg = aggregateCalls(pathfinding.perFrame.calls);
// The burst spent the frame's whole budget on its first spawns; the rest
// were deferred to the straight-line fallback. The per-frame probe gave
// every spawn a budget of its own, so every one of them searched. The
// difference between the two totals is therefore the cost of the EXTRA real
// searches the per-frame probe ran.
const burstSearches = Math.min(pathfinding.burst.size, pathfinding.budgetPerFrame) * pathfinding.burst.rounds;
const burstDeferred = Math.max(0, pathfinding.burst.size - pathfinding.budgetPerFrame) * pathfinding.burst.rounds;
const perFrameSearches = perFrameAgg.spawned;
const extraSearches = perFrameSearches - burstSearches;
const marginalSearchMs = (perFrameAgg.totalMs !== null && burstAgg.totalMs !== null && extraSearches > 0)
  ? +(((perFrameAgg.totalMs - burstAgg.totalMs) / extraSearches)).toFixed(4)
  : null;

/**
 * The long animation frames of a scene.
 *
 * The instrument only reports the frames whose WORK exceeded the threshold,
 * so "none" is a result: the scene never exceeded the frame budget.
 */
function longFrames(loaf) {
  const entries = loaf?.entries ?? [];
  if (!loaf?.supported) return { supported: false, count: null, maxDurationMs: null, maxScriptMs: null };
  if (!entries.length) {
    return { supported: true, thresholdMs: loaf.thresholdMs, count: 0, maxDurationMs: null, maxScriptMs: null };
  }
  const durations = entries.map((e) => e.durationMs);
  const scripts = entries.map((e) => e.scriptMs);
  return {
    supported: true,
    thresholdMs: loaf.thresholdMs,
    count: entries.length,
    maxDurationMs: +Math.max(...durations).toFixed(2),
    maxScriptMs: +Math.max(...scripts).toFixed(2),
    meanDurationMs: +(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2),
  };
}

const pathfindingReport = {
  counters: {
    available: pathfinding.counters.available,
    note: pathfinding.counters.available
      ? 'The POP domain published a path-search counter surface; the numbers below are the game\'s own.'
      : 'The POP domain does NOT publish the path-search counters. They exist only on the '
        + 'internal `citizens` service (game/src/population/citizens.js, `pathStats()`), which the '
        + 'domain does not expose upward, and no event carries them. The population domain was '
        + 'NOT modified: the cost below is MEASURED, not read from a counter.',
    probed: pathfinding.counters.probed,
    found: pathfinding.counters.found,
  },
  availableInstead: {
    renderedCitizens: built.renderedCitizens,
    maxRenderedCitizens: built.maxRenderedCitizens,
    residents: built.residents,
    housingCapacity: built.housingCapacity,
    poolStats: pathfinding.counters.found['population.poolStats'] ?? null,
  },
  tuning: {
    citizenPathsPerFrame: pathfinding.budgetPerFrame,
    citizenPathBudget: pathfinding.pathBudgetCells,
  },
  measured: {
    respawnWindow: {
      ...spawnSplit,
      dropped: pathfinding.respawn.dropped,
      citizensBefore: pathfinding.respawn.citizensBefore,
      note: 'The citizens were removed in one frame and the population put them back at the '
        + 'next tick, so the frame that carried the re-spawn is the one after the drop. '
        + 'Several re-spawns are sampled and their median is compared with the median of the '
        + 'frames between them. A frame gap is quantised by the display\'s vsync interval, so '
        + 'a difference of a fraction of a millisecond here is BELOW what a frame-time sample '
        + 'can resolve; the cost of the searches themselves is the directly timed burst below.',
    },
    singleFrameBurst: {
      ...burstAgg,
      rounds: pathfinding.burst.rounds,
      spawnsPerRound: pathfinding.burst.size,
      searchesStarted: burstSearches,
      searchesDeferred: burstDeferred,
      note: `These spawns ran ${pathfinding.burst.rounds} rounds of ${pathfinding.burst.size} spawns, `
        + 'each round inside ONE frame, so the frame\'s search budget '
        + `(${pathfinding.budgetPerFrame}) was spent on the first ${Math.min(pathfinding.burst.size, pathfinding.budgetPerFrame)} of every round and the `
        + `remaining ${Math.max(0, pathfinding.burst.size - pathfinding.budgetPerFrame)} of every round were deferred to the straight-line fallback.`,
    },
    oneSpawnPerFrame: {
      ...perFrameAgg,
      rounds: pathfinding.perFrame.rounds,
      note: 'These spawns ran one per frame: the frame\'s budget was open every time, so '
        + 'every one of them started a REAL grid-A* search.',
    },
    marginalSearchMs,
    marginalSearchNote: 'The measured extra cost of a real grid-A* search over a deferred '
      + `spawn: (one-per-frame total ${perFrameAgg.totalMs} ms - single-frame-burst total `
      + `${burstAgg.totalMs} ms) / ${extraSearches} extra real searches. The browser clock is `
      + 'coarse, so this is a small difference between two large numbers; it is an aggregate '
      + 'over the rounds, not a single timed search.',
  },
};

// ---------------------------------------------------------------------------
// The comparison
// ---------------------------------------------------------------------------

const delta = (a, b) => (a === null || b === null ? null : +(b - a).toFixed(3));
const deltaPct = (a, b) => {
  if (a === null || b === null || !a) return null;
  return +(((b - a) / a) * 100).toFixed(2);
};

const comparison = {
  meanDeltaMs: delta(bootFrames.meanMs, cityFrames.meanMs),
  meanDeltaPct: deltaPct(bootFrames.meanMs, cityFrames.meanMs),
  medianDeltaMs: delta(bootFrames.medianMs, cityFrames.medianMs),
  p95DeltaMs: delta(bootFrames.p95Ms, cityFrames.p95Ms),
  p95DeltaPct: deltaPct(bootFrames.p95Ms, cityFrames.p95Ms),
  p99DeltaMs: delta(bootFrames.p99Ms, cityFrames.p99Ms),
  fpsBoot: bootFrames.fpsMean,
  fpsCity: cityFrames.fpsMean,
  note: 'Both scenes were measured in the SAME run, in the SAME browser window, with the '
    + 'same method. The boot scene is the game exactly as it boots: an empty plot waiting '
    + 'for the mayor. The city scene is the built city at the maximum citizen count.',
  vsyncNote: 'A frame-time distribution is bounded BELOW by the display\'s vsync interval. '
    + 'When both scenes hold the refresh rate the two distributions measure the same '
    + 'interval, and the difference the city makes shows up in the WORK instead: the draw '
    + 'calls, the long animation frames and the measured path-search cost.',
};

const bootLong = longFrames(bootRaw.loaf);
const cityLong = longFrames(cityRaw.loaf);

const report = {
  tool: 'profile-city',
  url,
  measuredAt: new Date().toISOString(),
  machine: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cpu: process.env.SC_MACHINE_CPU ?? null,
  },
  hardware,
  bootMs,
  cityBuildMs: buildMs,
  citySettleMs: settleMs,
  framesRequested: FRAMES,
  tuning,
  scenes: {
    boot: {
      frames: bootFrames,
      frameTimes: bootRaw.frameTimes,
      longFrames: longFrames(bootRaw.loaf),
      counters: bootRaw.counters,
      rendererPerformance: bootRaw.perf,
      memory: bootRaw.mem,
      state: bootRaw.state,
      fx: bootRaw.fx,
    },
    city: {
      frames: cityFrames,
      frameTimes: cityRaw.frameTimes,
      longFrames: longFrames(cityRaw.loaf),
      counters: cityRaw.counters,
      rendererPerformance: cityRaw.perf,
      memory: cityRaw.mem,
      state: cityRaw.state,
      fx: cityRaw.fx,
    },
  },
  city: built,
  comparison,
  pathfinding: pathfindingReport,
  consoleErrors,
  pageErrors,
  failedRequests: failed,
};

mkdirSync(OUTDIR, { recursive: true });
const reportPath = join(OUTDIR, 'city-profile.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

// ---------------------------------------------------------------------------
// The readable summary
// ---------------------------------------------------------------------------

const pad = (value, width) => String(value ?? '-').padStart(width);
const lpad = (value, width) => String(value ?? '-').padEnd(width);
const rendererLabel = hardware.kind === 'hardware'
  ? `GPU — ${hardware.renderer}`
  : hardware.kind === 'software'
    ? `SOFTWARE GL — ${hardware.renderer || 'unknown renderer'}`
    : `UNVERIFIED — ${hardware.renderer || 'unknown renderer'}`;

const lines = [];
lines.push('SuperCitycon V7 — city frame-time profile');
lines.push(`  url        ${url}`);
lines.push(`  machine    ${report.machine.platform} ${report.machine.arch} · node ${report.machine.node}`);
lines.push(`  renderer   ${rendererLabel}`);
lines.push(`             ${hardware.reason}`);
lines.push(`  boot       ${bootMs} ms to ready`);
lines.push('');
lines.push('  SCENE      FRAMES     MEAN   MEDIAN       P95       P99       FPS');
lines.push(`  boot       ${pad(bootFrames.counted, 6)} ${pad(bootFrames.meanMs, 9)} ${pad(bootFrames.medianMs, 9)} ${pad(bootFrames.p95Ms, 9)} ${pad(bootFrames.p99Ms, 9)} ${pad(bootFrames.fpsMean, 9)}`);
lines.push(`  city       ${pad(cityFrames.counted, 6)} ${pad(cityFrames.meanMs, 9)} ${pad(cityFrames.medianMs, 9)} ${pad(cityFrames.p95Ms, 9)} ${pad(cityFrames.p99Ms, 9)} ${pad(cityFrames.fpsMean, 9)}`);
lines.push(`  delta                 ${pad(`${comparison.meanDeltaMs} ms`, 9)} ${pad(`${comparison.meanDeltaPct} %`, 9)}`);
lines.push('');
lines.push('  CITY');
lines.push(`    built in         ${buildMs} ms, settled ${settleMs} ms before the sample`);
lines.push(`    roads            ${built.roads}`);
lines.push(`    services         ${built.services.filter((s) => s.ok).length} placed of ${built.services.length} (${built.services.filter((s) => !s.ok).map((s) => `${s.id}:${s.reason}`).join(', ') || 'all placed'})`);
lines.push(`    houses           ${built.houses.placed} placed${built.houses.stopped ? ` (stopped: ${built.houses.stopped})` : ''} (${Object.entries(built.houses.failed).map(([k, v]) => `${k}:${v}`).join(', ') || 'no failures'})`);
lines.push(`    building views   ${built.buildingInstances}`);
lines.push(`    residents        ${built.residents} (housing capacity ${built.housingCapacity})`);
lines.push(`    citizens         ${built.renderedCitizens} / ${built.maxRenderedCitizens} (TUNING.maxRenderedCitizens)`);
lines.push(`    vehicles         ${built.vehicles}`);
lines.push(`    treasury left    ${built.treasury}`);
lines.push('');
lines.push('  PATHFINDING');
lines.push(`    counters         ${pathfindingReport.counters.available ? 'published by the POP domain' : 'NOT published by the POP domain (probed, not found)'}`);
lines.push(`    budget           ${pathfindingReport.tuning.citizenPathsPerFrame} searches/frame, ${pathfindingReport.tuning.citizenPathBudget} cells/search`);
lines.push(`    respawn window   ${spawnSplit.windowFrames} frames, ${pathfinding.respawn.dropped} citizens dropped and re-spawned ${spawnSplit.respawnFrames} time(s)`);
lines.push(`    spawning frame   median ${spawnSplit.respawnFrameMedianMs} ms against a steady ${spawnSplit.steadyFrameMedianMs} ms — difference ${spawnSplit.overheadMedianMs} ms`);
lines.push(`    burst            ${burstAgg.calls} spawns in one frame over ${pathfinding.burst.rounds} rounds: ${burstAgg.totalMs} ms total (${burstSearches} searched, ${burstDeferred} deferred)`);
lines.push(`    one per frame    ${perFrameAgg.calls} spawns, one per frame: ${perFrameAgg.totalMs} ms total (${perFrameSearches} searched)`);
lines.push(`    marginal search  ${pathfindingReport.measured.marginalSearchMs} ms per grid-A* search`);
lines.push('');
lines.push('  MEMORY');
lines.push(`    boot             ${bootRaw.mem ? `${bootRaw.mem.usedJSHeapMB} MB used / ${bootRaw.mem.totalJSHeapMB} MB total` : 'not available'}`);
lines.push(`    city             ${cityRaw.mem ? `${cityRaw.mem.usedJSHeapMB} MB used / ${cityRaw.mem.totalJSHeapMB} MB total` : 'not available'}`);
lines.push('');
lines.push(`  draw calls        boot ${bootRaw.counters.drawCalls} → city ${cityRaw.counters.drawCalls}`);
lines.push(`  triangles         boot ${bootRaw.counters.triangles} → city ${cityRaw.counters.triangles}`);
lines.push(`  long frames       boot ${bootLong.count} → city ${cityLong.count} (frames whose work exceeded ${bootLong.thresholdMs ?? cityLong.thresholdMs ?? 16} ms)`);
lines.push(`  console errors    ${consoleErrors.length}   page errors ${pageErrors.length}   failed requests ${failed.length}`);
lines.push('');
lines.push(`  report -> ${reportPath}`);

process.stdout.write(`${lines.join('\n')}\n`);

await browser.close();
if (preview) {
  preview.kill('SIGTERM');
}
process.exit(pageErrors.length || consoleErrors.length ? 2 : 0);
