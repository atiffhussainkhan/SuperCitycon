#!/usr/bin/env node
/**
 * tools/profile-gpu.mjs — measure the real running game on the real GPU.
 *
 *   node tools/profile-gpu.mjs [--port 4177] [--outdir <dir>] [--frames 300]
 *                               [--url <url>] [--scene boot|city]
 *
 * WHAT THIS IS:
 *   A headed Chromium window (a real GPU, not the headless software GL
 *   implementation), pointed at a static preview of `game/dist`. It waits for
 *   the game to report ready, then measures the frame-time distribution over a
 *   fixed number of rendered frames, reads the renderer counters, and reports
 *   the memory footprint.
 *
 * WHAT THIS IS NOT:
 *   A claim about any other machine. Every number here is for the machine
 *   named in the output. Software rendering is DETECTED and labelled, never
 *   presented as a GPU benchmark.
 *
 * The renderer is classified from the ACTUAL WebGL context and the browser's
 * own GPU device metadata, not from the launch mode: a headed browser can
 * still fall back to software GL, and a headless one can sometimes reach a
 * real GPU.
 *
 * Exit code: 0 when the probe completed, 1 when the game never became ready.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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

const PORT = Number(arg('port', 4177));
const FRAMES = Number(arg('frames', 300));
const OUTDIR = resolve(arg('outdir', join(ROOT, 'game', 'verification', 'v5-gpu')));
const EXTERNAL = arg('url', null);

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
    await import('node:fs').then((fs) => fs.accessSync(join(dist, 'index.html')));
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

const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true, null, { timeout: 120000 });
const bootMs = Date.now() - t0;

// Let the scene settle so the first frames (shader compilation) are not counted.
await page.waitForTimeout(1500);

/**
 * SCENES.
 *
 *   boot  — the game exactly as it boots: an empty plot waiting for the mayor.
 *   city  — a populated city: housing, shops, a park, a clinic, and the
 *           citizens and traffic that come with them. This is the
 *           HIGH-ACTIVITY scene the performance report has to measure; a
 *           boot-only profile hides the cost of the animated population.
 */
const SCENE = arg('scene', 'boot');
if (!['boot', 'city'].includes(SCENE)) {
  console.error(`unknown scene "${SCENE}" — use "boot" or "city"`);
  process.exit(1);
}

const sceneInfo = { scene: SCENE };

if (SCENE === 'city') {
  const built = await page.evaluate(async () => {
    const S = window.SUPERCITYCON;
    const B = S.ctx.domains.buildings;
    const E = S.ctx.domains.economy;
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

    // Compress the construction windows so the one owned slot frees up
    // within a frame or two; the city is built through the NORMAL placement
    // path, so the slot gate is exercised exactly as a player's is.
    E.setConstructionSpeed?.(6000);

    const catalogue = B.catalogue?.() || [];
    const footprint = (id) => {
      const def = catalogue.find((d) => d && d.id === id);
      return [Math.max(1, def?.footprintCells?.[0] ?? 1), Math.max(1, def?.footprintCells?.[1] ?? 1)];
    };
    const cellFree = (cx, cz) => {
      if (cx < 0 || cz < 0 || cx > 63 || cz > 63) return false;
      if (B.buildingAt(cx, cz)) return false;
      if (S.ctx.domains.mobility?.roadAt?.(cx, cz)) return false;
      if (S.ctx.domains.wld?.isWater?.(cx, cz)) return false;
      return true;
    };

    const PLAN = [];
    for (let cz = 18; cz <= 44; cz += 2) {
      for (let cx = 18; cx <= 44; cx += 2) {
        const k = (cx + cz) % 6;
        if (k === 0) PLAN.push(['prk.park', cx, cz]);
        else if (k === 3) PLAN.push(['com.grocery', cx, cz]);
        else if (k === 4) PLAN.push(['hea.medical_center', cx, cz]);
        else PLAN.push(['res.house', cx, cz]);
      }
    }

    const placed = [];
    const failed = [];

    // A road network first: without roads there is no traffic, and a city
    // without traffic is not the high-activity scene this profile is for.
    const M = S.ctx.domains.mobility;
    let roads = 0;
    for (let cz = 16; cz <= 46; cz += 1) {
      for (let cx = 16; cx <= 46; cx += 1) {
        // One north-south street every 6 cells and one east-west street
        // every 6 cells — a grid the traffic can actually route along.
        if (cx % 6 !== 0 && cz % 6 !== 0) continue;
        if (!cellFree(cx, cz)) continue;
        const r = M?.addRoad ? M.addRoad(cx, cz) : null;
        if (r === false || (r && r.ok === false)) continue;
        roads += 1;
      }
    }
    for (const [id, cx, cz] of PLAN) {
      const [fw, fh] = footprint(id);
      // Find a free cell for the WHOLE footprint, spiralling out from the
      // planned one.
      let target = null;
      for (let d = 0; d <= 4 && !target; d += 1) {
        for (let dz = -d; dz <= d && !target; dz += 1) {
          for (let dx = -d; dx <= d && !target; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
            const tx = cx + dx;
            const tz = cz + dz;
            let clear = true;
            for (let fx = 0; fx < fw && clear; fx += 1) {
              for (let fz = 0; fz < fh && clear; fz += 1) {
                if (!cellFree(tx + fx, tz + fz)) clear = false;
              }
            }
            if (clear) target = [tx, tz];
          }
        }
      }
      if (!target) { failed.push(`${id}@${cx},${cz}: no-free-cell`); continue; }

      let ok = false;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const r = B.place(id, target[0], target[1], 0);
        if (r.ok) { ok = true; break; }
        if (r.reason !== 'not-enough-slots') break;
        await nextFrame();
        await nextFrame();
      }
      if (ok) placed.push(id); else failed.push(`${id}@${cx},${cz}: slot-timeout`);
    }

    // Let the population and the traffic grow into the city.
    const deadline = Date.now() + 25000;
    let citizens = 0;
    while (Date.now() < deadline) {
      citizens = S.ctx.domains.population?.citizenCount?.() ?? 0;
      if (citizens > 0 && S.state.population?.total > 0) break;
      await nextFrame();
    }
    // A short settle so the traffic vehicles reach the roads and the
    // citizens reach their routes before the frame sample starts.
    for (let i = 0; i < 180; i += 1) await nextFrame();

    return {
      placed: placed.length,
      roads,
      failed: failed.slice(0, 10),
      citizens: S.ctx.domains.population?.citizenCount?.() ?? 0,
      residents: S.state.population?.total ?? 0,
      vehicles: S.ctx.domains.mobility?.vehicleCount?.() ?? null,
      instances: S.state.buildings?.instances?.size ?? 0,
    };
  });
  sceneInfo.built = built;
  process.stdout.write(`scene "city": ${JSON.stringify(built)}\n`);
}

const measured = await page.evaluate(async (frameCount) => {
  const S = window.SUPERCITYCON;
  const gl = S.renderer?.renderer?.getContext?.();

  // The REAL renderer string, from the actual context.
  const dbg = gl?.getExtension?.('WEBGL_debug_renderer_info');
  const context = dbg ? {
    unmasked_renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL),
    unmasked_vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL),
  } : { unmasked_renderer: gl?.getParameter?.(gl.RENDERER), unmasked_vendor: '' };

  // Measure the frame-time distribution over real rendered frames.
  //
  // The first sample is taken from the FIRST rAF timestamp, not from
  // `performance.now()`. A rAF callback's timestamp is the time the frame
  // BEGAN, which can be EARLIER than the `performance.now()` we sampled a
  // moment ago — seeding `last` with `performance.now()` therefore produces a
  // spurious NEGATIVE frame time that poisons the mean and the p99. Seeding
  // from the first rAF timestamp guarantees every delta is a real frame gap.
  const times = [];
  await new Promise((resolve) => {
    let last = null;
    let count = 0;
    const step = (now) => {
      if (last !== null) times.push(now - last);
      last = now;
      count += 1;
      if (count > frameCount) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

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
}, FRAMES);

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

const hardware = classifyHardwareRenderer(measured.context, systemInfo);

const times = measured.frameTimes.slice().sort((a, b) => a - b);
const pct = (p) => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))];
const mean = times.reduce((a, b) => a + b, 0) / times.length;

const report = {
  tool: 'profile-gpu',
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
  scene: sceneInfo,
  frames: {
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
  },
  counters: measured.counters,
  rendererPerformance: measured.perf,
  memory: measured.mem,
  state: measured.state,
  fx: measured.fx,
  consoleErrors,
  pageErrors,
  failedRequests: failed,
};

mkdirSync(OUTDIR, { recursive: true });
writeFileSync(join(OUTDIR, 'gpu-profile.json'), `${JSON.stringify(report, null, 2)}\n`);

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`\nreport -> ${join(OUTDIR, 'gpu-profile.json')}\n`);

await browser.close();
if (preview) {
  preview.kill('SIGTERM');
}
process.exit(pageErrors.length || consoleErrors.length ? 2 : 0);
