#!/usr/bin/env node
/**
 * tools/performance.mjs — measure the real running game, on a real server.
 *
 * The acceptance harness answers "does it work?". This answers "how fast is it?",
 * and it measures the shipped bundle rather than the dev server:
 *
 *   1. start a static preview of `game/dist`,
 *   2. open it in the default software browser, or explicit headed hardware mode,
 *   3. wait for the game to report ready,
 *   4. measure boot time, first-frame time, and the frame-time distribution over
 *      a fixed number of rendered frames,
 *   5. report the renderer counters (draw calls, triangles, meshes),
 *   6. measure a save and a load round-trip,
 *   7. write a JSON report and print it.
 *
 * IMPORTANT — what these numbers are and are not:
 *
 * The default headless browser forces **software GL** (SwiftShader),
 * so default absolute frame times are not a measurement of what a real
 * GPU delivers. They are useful for comparison and for spotting a regression
 * between runs, not as a claim about the game on real hardware.
 *
 * The game advances its simulation on a fixed step
 * (`SUPERCITYCON.step(dt)`), so simulation speed is decoupled from render
 * speed and a slow headless frame rate does not change the simulation's
 * behaviour — it only changes how much wall-clock time the frames take.
 *
 * Hardware mode rejects software/unknown renderer identity before publishing FPS.
 * It records actual context identity plus browser GPU evidence and uses a finite deadline.
 *
 * Usage:
 *   node tools/performance.mjs [--port 4176] [--outdir <dir>] [--frames 120]
 *   node tools/performance.mjs --hardware --outdir <separate-dir>
 *
 * Exit: 0 measured, 1 error/deadline, 2 blocked/unverified hardware or invalid options.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChromium } from './playwright-resolve.mjs';
import { classifyHardwareRenderer, withTimeout, stopPreview } from './performance-gpu.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(HERE, '..');
const GAME = join(WORKSPACE, 'game');

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`Usage: node tools/performance.mjs [--hardware] [--port 4176]
  [--outdir PATH] [--frames 120] [--warmup-frames 30] [--timeout-ms 180000]
  [--no-screenshot]
Default: original software-GL comparison. --hardware opens a headed browser,
requires a verified physical GPU on the actual game WebGL context, and records
GPU identity, browser evidence, focus, quality and frame times. Unknown/software
renderers are BLOCKED (exit 2); no hardware FPS result is emitted for them.
Hardware reports default to game/verification/performance-hardware/.
No build, installation, existing-browser reuse or publication is performed.`);
  process.exit(0);
}
const valued = new Set(['--port', '--outdir', '--frames', '--warmup-frames', '--timeout-ms']);
for (let i = 0; i < argv.length; i += 1) {
  if (['--hardware', '--no-screenshot'].includes(argv[i])) continue;
  if (!valued.has(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--')) {
    console.error(`Unknown or incomplete option: ${argv[i]}`); process.exit(2);
  }
  i += 1;
}
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
function numberOption(name, fallback, min, max) {
  const n = Number(argOf(name, fallback));
  if (!Number.isInteger(n) || n < min || n > max) {
    console.error(`--${name} must be an integer from ${min} to ${max}`); process.exit(2);
  }
  return n;
}
const HARDWARE = argv.includes('--hardware');
const PORT = numberOption('port', 4176, 1, 65535);
const FRAMES = numberOption('frames', 120, 1, 10000);
const WARMUP = numberOption('warmup-frames', HARDWARE ? 30 : 0, 0, 1000);
const TIMEOUT = numberOption('timeout-ms', 180000, 1000, 600000);
const OUTDIR = argOf('outdir', join(WORKSPACE, 'game', 'verification', HARDWARE ? 'performance-hardware' : 'performance'));
const SCREENSHOT = !argv.includes('--no-screenshot');
mkdirSync(OUTDIR, { recursive: true });

function run(cmd, args, opts = {}) {
  return new Promise((res) => {
    const child = spawn(cmd, args, { cwd: GAME, stdio: 'inherit', ...opts });
    child.on('exit', (code) => res(code ?? 1));
    child.on('error', () => res(1));
  });
}

async function waitForServer(url, timeoutMs = 30000, ready = () => true, exited = () => false) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited()) return false;
    if (!ready()) { await new Promise((r) => setTimeout(r, 100)); continue; }
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function stats(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    n: values.length,
    min_ms: +sorted[0].toFixed(2),
    median_ms: +q(0.5).toFixed(2),
    p95_ms: +q(0.95).toFixed(2),
    max_ms: +sorted[sorted.length - 1].toFixed(2),
    mean_ms: +(sum / values.length).toFixed(2),
    fps_median: +(1000 / q(0.5)).toFixed(1),
    fps_p95_worst: +(1000 / q(0.95)).toFixed(1),
  };
}

async function main() {
  const url = `http://127.0.0.1:${PORT}/`;
  const launch = HARDWARE
    ? { headless: false, chromiumSandbox: true, timeout: Math.min(30000, TIMEOUT) }
    : { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'], timeout: Math.min(30000, TIMEOUT) };
  const report = {
    generated_at: new Date().toISOString(), url, label: `PREVIEW :${PORT}`,
    mode: HARDWARE ? 'hardware-requested' : 'software-baseline',
    verdict: 'RUNNING', hardware_verified: false,
    launch: { headless: !HARDWARE, forced_software: !HARDWARE, args: launch.args || [] },
    requested_frames: FRAMES, timeout_ms: TIMEOUT,
    claim_scope: HARDWARE ? 'Observed hardware, viewport, scene and quality only; no other host certification.' : 'Software GL comparison only; not physical GPU performance.',
  };
  let preview = null;
  let browser = null;
  let exitCode = 1;
  try {
    const probe = async () => {
      console.log('=== 1. start a static preview of game/dist ===');
      preview = spawn(process.execPath, [join(GAME, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
        { cwd: GAME, stdio: ['ignore', 'pipe', 'pipe'] });
      let log = '';
      preview.stdout.on('data', (d) => { log += d.toString(); });
      preview.stderr.on('data', (d) => { log += d.toString(); });
      preview.on('error', (error) => { log += String(error); });
      const ready = () => log.includes(`http://127.0.0.1:${PORT}/`);
      if (!await waitForServer(url, Math.min(30000, TIMEOUT), ready, () => preview.exitCode !== null || preview.signalCode !== null)) {
        throw new Error(`Own preview did not start on ${url}\n${log.slice(0, 600)}`);
      }
      console.log(`preview up on ${url}`);
      const { chromium } = await resolveChromium();
      browser = await chromium.launch(launch);
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    context.setDefaultTimeout(Math.min(30000, TIMEOUT));
    // The same helper the acceptance harness injects: wait for a construction
    // slot by advancing the economy's own update, not by waiting on frames.
    await context.addInitScript(() => {
      window.__sc = {
        nextFrame: () => new Promise((r) => requestAnimationFrame(() => r())),
        waitForSlot: async (maxRounds = 40) => {
          const S = window.SUPERCITYCON;
          const eco = S.ctx.domains.economy;
          const free = () => {
            const slots = eco?.constructionSlots?.();
            return !slots || slots.free > 0;
          };
          for (let i = 0; i < maxRounds; i += 1) {
            if (free()) return true;
            try { eco?.update?.(0); } catch { /* ignore */ }
            if (free()) return true;
            await new Promise((r) => setTimeout(r, 40));
            try { eco?.update?.(0); } catch { /* ignore */ }
            if (free()) return true;
          }
          return free();
        },
        modelCount: () => {
          const b = window.SUPERCITYCON.ctx.domains.buildings;
          return b && typeof b.renderStats === 'function' ? b.renderStats().instances : 0;
        },
      };
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    console.log('\n=== 2. boot ===');
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.min(30000, TIMEOUT) });
    report.load_event_ms = Date.now() - t0;

    await page.waitForFunction(
      () => window.SUPERCITYCON?.state?.meta?.ready === true,
      null, { timeout: Math.min(120000, TIMEOUT) });
    report.ready_ms = Date.now() - t0;

    await page.bringToFront();
    report.browser_version = browser.version();
    let systemInfo = null;
    let cdp;
    try {
      cdp = await browser.newBrowserCDPSession();
      const raw = await withTimeout(cdp.send('SystemInfo.getInfo'), 5000, 'GPU metadata');
      systemInfo = { gpu: raw.gpu, modelName: raw.modelName, modelVersion: raw.modelVersion };
    } catch (error) { report.gpu_metadata_error = String(error.message || error); }
    finally { if (cdp) await withTimeout(cdp.detach(), 2000, 'CDP detach').catch(() => {}); }
    const readEnvironment = async () => page.evaluate(() => {
      const service = window.SUPERCITYCON.renderer;
      const gl = service.renderer.getContext();
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        unmasked_renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
        unmasked_vendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null,
        gl_renderer: gl.getParameter(gl.RENDERER), gl_vendor: gl.getParameter(gl.VENDOR),
        gl_version: gl.getParameter(gl.VERSION), context_lost: gl.isContextLost(),
        visibility: document.visibilityState, focused: document.hasFocus(),
        viewport: { width: innerWidth, height: innerHeight }, device_pixel_ratio: devicePixelRatio,
        render_pixel_ratio: service.renderer.getPixelRatio(),
        drawing_buffer: { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight },
        adaptive_quality: service.adaptive?.state?.() ?? null,
        camera: { position: service.camera.position.toArray(), zoom: service.camera.zoom, fov: service.camera.fov },
      };
    });
    report.environment_before = await readEnvironment();
    report.gpu_system_info = systemInfo;
    report.gpu_classification = classifyHardwareRenderer(report.environment_before, systemInfo);
    report.hardware_verified = HARDWARE && report.gpu_classification.verified;
    if (HARDWARE && !report.hardware_verified) {
      const error = new Error(report.gpu_classification.reason); error.code = 'HARDWARE_BLOCKED'; throw error;
    }
    if (HARDWARE && (report.environment_before.visibility !== 'visible' || !report.environment_before.focused || report.environment_before.context_lost)) {
      const error = new Error('Hardware measurement needs a visible, focused page and a live context.'); error.code = 'HARDWARE_BLOCKED'; throw error;
    }


    console.log('\n=== 3. build a realistic city ===');
    // An empty map is not a realistic workload. The city is built the same way
    // the acceptance harness builds it: a street of roads, buildings either
    // side, placed through the real placement gate with the real construction
    // speed. This is what makes the frame-time numbers below comparable to the
    // harness's own renderer counters.
    report.city = await page.evaluate(async () => {
      const S = window.SUPERCITYCON;
      const B = S.ctx.domains.buildings;
      const M = S.ctx.domains.mobility;
      const E = S.ctx.domains.economy;
      E.setConstructionSpeed?.(6000);
      const out = { placed: 0, failed: 0, roads: 0 };

      async function place(id, cx, cz) {
        for (let attempt = 0; attempt < 30; attempt += 1) {
          const r = B.place(id, cx, cz, 0);
          if (r.ok) { out.placed += 1; return true; }
          if (r.reason === 'not-enough-slots') {
            await window.__sc.waitForSlot();
            continue;
          }
          return false;
        }
        return false;
      }

      const C = 32;
      for (let x = -4; x <= 4; x += 1) {
        const r = M?.addRoad ? M.addRoad(C + x, C) : null;
        if (r === false || (r && r.ok === false)) continue;
        out.roads += 1;
      }
      const plan = [
        ['res.house', -4, 1], ['res.apartment', -3, 1], ['res.terrace_house', -2, 1],
        ['res.semi_detached', -1, 1], ['res.low_rise_flats', 0, 1], ['res.mid_rise_flats', 1, 1],
        ['com.grocery', 2, 1], ['com.cafe', 3, 1], ['com.office_block', 4, 1],
        ['ind.warehouse', -3, -1], ['ind.vehicle_garage', -1, -1],
        ['hea.medical_center', 1, -1], ['fir.station', 2, -1], ['edu.bus_station', 3, -1],
        ['eng.solar', 0, -1], ['wat.tower', 4, -1], ['prk.park', -4, -1],
      ];
      for (const [id, dx, dz] of plan) {
        const ok = await place(id, C + dx, C + dz);
        if (!ok) out.failed += 1;
      }
      // let the simulation run so population and traffic actually exist
      for (let i = 0; i < 900; i += 1) S.step(0.1);
      return {
        ...out,
        building_instances: S.state.buildings.instances.size,
        population: S.state.population.total,
        happiness: S.state.population.happiness,
        treasury: S.state.economy.treasury,
        day: S.state.meta.day,
        vehicles: S.state.mobility.vehicles ? S.state.mobility.vehicles.length : 0,
        citizens_rendered: S.ctx.domains.population?.citizenCount?.() ?? 0,
      };
    });
    console.log(`built ${report.city.placed} buildings, ${report.city.roads} roads, `
      + `${report.city.population ?? '?'} residents, ${report.city.vehicles ?? '?'} vehicles`);

    if (WARMUP) {
      await page.evaluate(async (count) => {
        for (let i = 0; i < count; i += 1) await new Promise((r) => requestAnimationFrame(r));
      }, WARMUP);
    }
    report.warmup_frames = WARMUP;
    report.sample_environment = await readEnvironment();

    console.log('\n=== 4. frame times over ' + FRAMES + ' rendered frames ===');
    const frames = await page.evaluate(async ({ n, hardware }) => {
      const times = [];
      await new Promise((done, reject) => {
        let last = performance.now();
        let count = 0;
        const tick = () => {
          if (hardware && (document.visibilityState !== 'visible' || !document.hasFocus())) {
            reject(new Error('Page lost visibility/focus during hardware sampling.')); return;
          }
          const now = performance.now();
          times.push(now - last);
          last = now;
          if (++count >= n) return done();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      return times;
    }, { n: FRAMES, hardware: HARDWARE });
    report.frame_times = stats(frames);

    console.log('\n=== 5. renderer counters ===');
    report.renderer = await page.evaluate(() => {
      const S = window.SUPERCITYCON;
      const r = S.renderer;
      let meshes = 0;
      r.scene.traverse((o) => { if (o.isMesh) meshes += 1; });
      const b = S.ctx.domains.buildings;
      return {
        draw_calls: r.renderer.info.render.calls,
        triangles: r.renderer.info.render.triangles,
        scene_meshes: meshes,
        building_instances: S.state.buildings.instances.size,
        population: S.state.population.total,
        citizens_rendered: S.ctx.domains.population?.citizenCount?.() ?? 0,
        vehicles: S.state.mobility.vehicles ? S.state.mobility.vehicles.length : null,
        building_render_stats: b && typeof b.renderStats === 'function' ? b.renderStats() : null,
      };
    });

    console.log('\n=== 6. save + load round-trip ===');
    report.save_load = await page.evaluate(() => {
      const S = window.SUPERCITYCON;
      const save = S.ctx.core.save;
      if (!save) return { error: 'no save module' };
      const tSave = performance.now();
      const wrote = save.saveToStorage(S.state, 'perfprobe');
      const saveMs = performance.now() - tSave;
      const tLoad = performance.now();
      const restored = save.loadFromStorage('perfprobe');
      const loadMs = performance.now() - tLoad;
      return {
        wrote, restored: !!restored,
        save_ms: +saveMs.toFixed(2), load_ms: +loadMs.toFixed(2),
        buildings_after_load: S.state.buildings.instances.size,
      };
    });

    report.console_errors = consoleErrors;
    report.environment_after = await readEnvironment();
    const finalClass = classifyHardwareRenderer(report.environment_after, systemInfo);
    if (HARDWARE && (!finalClass.verified || report.environment_before.unmasked_renderer !== report.environment_after.unmasked_renderer || report.environment_after.context_lost)) {
      report.hardware_verified = false;
      const error = new Error('Hardware renderer became unknown, changed, or lost its context during measurement.'); error.code = 'HARDWARE_BLOCKED'; throw error;
    }
    if (HARDWARE && consoleErrors.length) throw new Error('Game emitted console/page errors; see console_errors.');
    if (SCREENSHOT) await page.screenshot({ path: join(OUTDIR, 'performance-frame.png'), timeout: Math.min(10000, TIMEOUT) });

    };
    await withTimeout(probe(), TIMEOUT, 'performance probe');
    report.verdict = HARDWARE ? 'HARDWARE_MEASURED' : 'SOFTWARE_BASELINE_MEASURED';
    exitCode = 0;
  } catch (error) {
    report.verdict = error.code === 'HARDWARE_BLOCKED' || (HARDWARE && !report.hardware_verified) ? 'BLOCKED' : 'ERROR';
    report.error = String(error.stack || error);
    exitCode = report.verdict === 'BLOCKED' ? 2 : 1;
    if (HARDWARE && !report.hardware_verified) delete report.frame_times;
    console.error(`${report.verdict}: ${error.message || error}`);
  } finally {
    const cleanup = [];
    if (browser) {
      try { await withTimeout(browser.close(), 10000, 'browser close'); }
      catch (error) { cleanup.push(String(error.message || error)); }
    }
    try { await stopPreview(preview); }
    catch (error) { cleanup.push(String(error.message || error)); }
    if (cleanup.length) {
      report.cleanup_errors = cleanup; report.verdict = 'ERROR'; exitCode = 1;
    }
    report.completed_at = new Date().toISOString();
    writeFileSync(join(OUTDIR, 'performance.json'), JSON.stringify(report, null, 2));
    console.log('\n=== report ===');
    console.log(JSON.stringify(report, null, 2));
    console.log(`\nwritten: ${join(OUTDIR, 'performance.json')}`);
  }
  return exitCode;
}

process.exit(await main());
