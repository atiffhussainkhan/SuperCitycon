#!/usr/bin/env node
/**
 * tools/performance.mjs — measure the real running game, on a real server.
 *
 * The acceptance harness answers "does it work?". This answers "how fast is it?",
 * and it measures the shipped bundle rather than the dev server:
 *
 *   1. start a static preview of `game/dist`,
 *   2. open it in a headless browser,
 *   3. wait for the game to report ready,
 *   4. measure boot time, first-frame time, and the frame-time distribution over
 *      a fixed number of rendered frames,
 *   5. report the renderer counters (draw calls, triangles, meshes),
 *   6. measure a save and a load round-trip,
 *   7. write a JSON report and print it.
 *
 * IMPORTANT — what these numbers are and are not:
 *
 * The headless browser runs on a **software GL implementation** (SwiftShader),
 * so the absolute frame times here are a FLOOR, not a measurement of what a real
 * GPU delivers. They are useful for comparison and for spotting a regression
 * between runs, not as a claim about the game on real hardware.
 *
 * The game advances its simulation on a fixed step
 * (`SUPERCITYCON.step(dt)`), so simulation speed is decoupled from render
 * speed and a slow headless frame rate does not change the simulation's
 * behaviour — it only changes how much wall-clock time the frames take.
 *
 * Usage:
 *   node tools/performance.mjs [--port 4176] [--outdir <dir>] [--frames 120]
 *
 * Exit code: 0 when the probe completed, 1 when the game never became ready.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChromium } from './playwright-resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(HERE, '..');
const GAME = join(WORKSPACE, 'game');

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const PORT = Number(argOf('port', 4176));
const OUTDIR = argOf('outdir', join(WORKSPACE, 'game', 'verification', 'performance'));
const FRAMES = Number(argOf('frames', 120));

mkdirSync(OUTDIR, { recursive: true });

function run(cmd, args, opts = {}) {
  return new Promise((res) => {
    const child = spawn(cmd, args, { cwd: GAME, stdio: 'inherit', ...opts });
    child.on('exit', (code) => res(code ?? 1));
    child.on('error', () => res(1));
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
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
  console.log('=== 1. start a static preview of game/dist ===');
  const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: GAME, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  preview.stdout.on('data', (d) => { log += d.toString(); });
  preview.stderr.on('data', (d) => { log += d.toString(); });
  const url = `http://localhost:${PORT}/`;
  if (!await waitForServer(url)) {
    console.error(`preview did not start on ${url}\n${log.slice(0, 600)}`);
    preview.kill('SIGTERM');
    return 1;
  }
  console.log(`preview up on ${url}`);

  const { chromium } = await resolveChromium();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = { generated_at: new Date().toISOString(), url, label: `PREVIEW :${PORT}` };

  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
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
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    report.load_event_ms = Date.now() - t0;

    await page.waitForFunction(
      () => window.SUPERCITYCON?.state?.meta?.ready === true,
      null, { timeout: 120000 });
    report.ready_ms = Date.now() - t0;

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

    console.log('\n=== 4. frame times over ' + FRAMES + ' rendered frames ===');
    const frames = await page.evaluate(async (n) => {
      const times = [];
      await new Promise((done) => {
        let last = performance.now();
        let count = 0;
        const tick = () => {
          const now = performance.now();
          times.push(now - last);
          last = now;
          if (++count >= n) return done();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      return times;
    }, FRAMES);
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
    await page.screenshot({ path: join(OUTDIR, 'performance-frame.png') });
  } finally {
    await browser.close();
    preview.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
  }

  writeFileSync(join(OUTDIR, 'performance.json'), JSON.stringify(report, null, 2));
  console.log('\n=== 7. report ===');
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nwritten: ${join(OUTDIR, 'performance.json')}`);
  return 0;
}

process.exit(await main());
