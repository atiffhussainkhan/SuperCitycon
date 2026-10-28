#!/usr/bin/env node
/**
 * tools/scenario.mjs — the acceptance test for SuperCitycon.
 *
 * This is NOT a smoke test. It is the thing that proves the assembled game
 * runs: it boots the real page in a headless browser, builds a city through
 * the real input path, reads the real state back, looks at the real pixels,
 * and fails loudly when any of that breaks.
 *
 * It runs against ANY server that serves the game:
 *   node tools/scenario.mjs http://localhost:5177/ /tmp/sc-dev    # dev server
 *   node tools/scenario.mjs http://localhost:4173/ /tmp/sc-prod   # vite preview
 *
 * A dev run that passes and a production run that fails is the single most
 * important finding this harness can produce, so run BOTH.
 *
 * Exit code: 0 when every check passed (skips do not fail the run), 1 when
 * any check failed.
 */
import { chromium } from '/Users/mac/.local/pw/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:5177/';
const outDir = process.argv[3] || '/tmp/sc-scenario';
const label = process.argv[4] || url;
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

/**
 * A check that could not run because the thing it needs is absent.
 * A skip is NOT a pass and NOT a failure — it is reported as skipped.
 */
function skip(name, reason) {
  results.push({ name, pass: true, skipped: true, detail: String(reason) });
  console.log(`SKIP  ${name}  — ${reason}`);
}

// ---------------------------------------------------------------------------
// Browser
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
 * Helpers injected into EVERY page (the main one and the fresh session).
 * They live in the page because they need the live game objects.
 */
await context.addInitScript(() => {
  window.__sc = {
    /** Resolve on the next animation frame (the game renders on rAF). */
    nextFrame: () => new Promise((r) => requestAnimationFrame(() => r())),

    /**
     * Wait until a construction slot is free.
     *
     * The player starts with ONE construction slot, so the city is built in
     * waves and a slot is busy at any given instant. Waiting for a whole
     * animation frame is expensive under software GL (the headless browser
     * renders at a fraction of a frame per second), so the construction
     * timers are advanced directly and a short sleep lets the wall clock
     * move on. This is the same `economy.update()` the frame loop calls —
     * it does not change what is being tested.
     */
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

    /**
     * How many building models are on the map.
     *
     * The buildings are drawn as instanced batches — one draw call per model
     * part, not one per building — so the count is the number of live
     * instance slots, not the number of meshes.
     */
    modelCount: () => {
      const b = window.SUPERCITYCON.ctx.domains.buildings;
      if (b && typeof b.renderStats === 'function') return b.renderStats().instances;
      let n = 0;
      window.SUPERCITYCON.renderer.world.traverse((o) => {
        if (o.userData && o.userData.buildingInstanceId !== undefined) n += 1;
      });
      return n;
    },

    /** How the building models are drawn (batches, instances, draw calls). */
    buildingRenderStats: () => {
      const b = window.SUPERCITYCON.ctx.domains.buildings;
      return b && typeof b.renderStats === 'function' ? b.renderStats() : null;
    },

    /** Is this cell free for a new building? */
    cellIsFree(cx, cz) {
      const S = window.SUPERCITYCON;
      if (S.ctx.domains.buildings.buildingAt(cx, cz)) return false;
      if (S.ctx.domains.mobility?.roadAt?.(cx, cz)) return false;
      if (S.ctx.domains.wld?.isWater?.(cx, cz)) return false;
      const scenery = S.state.world.scenery || [];
      for (const rec of scenery) {
        if (!rec) continue;
        const sx = rec.cx ?? rec.x;
        const sz = rec.cz ?? rec.z;
        if (sx === undefined || sz === undefined) continue;
        if (Math.round(sx) === cx && Math.round(sz) === cz) return false;
      }
      return true;
    },

    /** The first free cell around (cx0, cz0), or null. */
    findFreeCell(cx0 = 32, cz0 = 32, radius = 6) {
      for (let d = 0; d <= radius; d += 1) {
        for (let dz = -d; dz <= d; dz += 1) {
          for (let dx = -d; dx <= d; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
            const cx = cx0 + dx;
            const cz = cz0 + dz;
            if (cx < 0 || cz < 0 || cx > 63 || cz > 63) continue;
            if (window.__sc.cellIsFree(cx, cz)) return { cx, cz };
          }
        }
      }
      return null;
    },

    /**
     * Find a cell that can be clicked with a real mouse.
     *
     * The renderer resolves a screen point against a flat ground PLANE at
     * y = 0 (`renderer.screenToGround`), so the reliable way to find the
     * screen position of a cell is to ask the renderer itself: scan the
     * canvas, ask which cell each point lands on, and keep the first one
     * that is free. The click then lands on exactly that cell.
     *
     * The point must also hit the CANVAS and not a HUD panel that floats
     * above it, so the hit is checked with `elementFromPoint`.
     */
    findClickableCell() {
      const S = window.SUPERCITYCON;
      const r = S.renderer;
      const canvas = r.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const x0 = rect.left + 220;
      const x1 = rect.left + rect.width - 220;
      const y0 = rect.top + 160;
      const y1 = rect.top + rect.height - 260;
      const step = 14;
      for (let y = y0; y <= y1; y += step) {
        for (let x = x0; x <= x1; x += step) {
          const hit = r.screenToGround(x, y);
          if (!hit) continue;
          const cell = S.ctx.config.worldToCellInt(hit.x, hit.z);
          if (!window.__sc.cellIsFree(cell.x, cell.z)) continue;
          const top = document.elementFromPoint(x, y);
          if (!top || (top !== canvas && !canvas.contains(top))) continue;
          return { cx: cell.x, cz: cell.z, x, y };
        }
      }
      return null;
    },
  };
});

const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
let navigations = 0;
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));
// A dev-server reload (HMR) during the run destroys the game state. Count
// it so the verdict can say so instead of failing with a confusing TypeError.
page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations += 1; });

const evidence = { url, label, sections: {} };

try {
  // ?capture=1 turns on preserveDrawingBuffer so the framebuffer can be read back.
  const captureUrl = url.includes('?') ? `${url}&capture=1` : `${url}?capture=1`;

  // Load TWICE. The first load makes the dev server discover and pre-bundle
  // its dependencies, and that optimisation triggers a full page reload a
  // second or two later — which would wipe the game state mid-run. The
  // second load lands on a settled server.
  await page.goto(captureUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true,
    null, { timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.goto(captureUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // ---- 1. boot ------------------------------------------------------------
  // NOTE: waitForFunction's THIRD argument is the options object. Passing the
  // options as the second argument silently leaves the default 30 s timeout in
  // place — that is what the old harness did.
  await page.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true,
    null, { timeout: 120000 });
  const boot = await page.evaluate(() => ({
    log: window.SUPERCITYCON.bootLog,
    domains: Object.keys(window.SUPERCITYCON.ctx.domains),
    core: Object.keys(window.SUPERCITYCON.ctx.core),
    fatalVisible: getComputedStyle(document.getElementById('fatal')).display !== 'none',
  }));
  check('game boots to ready', true, `${boot.domains.length} domains: ${boot.domains.join(', ')}`);
  check('no fatal pane', !boot.fatalVisible);

  const expectedDomains = ['wld', 'buildings', 'economy', 'mobility', 'population', 'services', 'studio', 'ui'];
  const missing = expectedDomains.filter((d) => !boot.domains.includes(d));
  check('all eight runtime domains loaded', missing.length === 0,
    missing.length ? `missing: ${missing.join(', ')}` : 'all present');
  check('CORE modules loaded', boot.core.length === 3, boot.core.join(', '));
  evidence.sections.boot = boot;

  // ---- 2. world -----------------------------------------------------------
  const world = await page.evaluate(() => {
    const s = window.SUPERCITYCON.state;
    return {
      cells: s.world.heightmap?.length || 0,
      scenery: s.world.scenery?.length || 0,
      waterLevel: s.world.waterLevel,
    };
  });
  check('terrain generated (4096 cells)', world.cells === 4096, `${world.cells}`);
  check('nature scattered', world.scenery > 100, `${world.scenery} placements`);
  evidence.sections.world = world;

  // ---- 3a. a building that needs more slots than the player owns -----------
  // `trn.monorail_station` asks for two construction slots. The player starts
  // with one, so the gate must refuse it — and say so.
  const multiSlot = await page.evaluate(async () => {
    const S = window.SUPERCITYCON;
    const B = S.ctx.domains.buildings;
    const E = S.ctx.domains.economy;
    const cell = window.__sc.findFreeCell(20, 24, 8);
    if (!cell) return { ok: false, reason: 'no free cell' };
    const def = (B.catalogue?.() || []).find((d) => d && d.id === 'trn.monorail_station');
    const slots = E.constructionSlots();
    const r = B.place('trn.monorail_station', cell.cx, cell.cz, 0);
    const toasts = (S.state.ui.toasts || []).map((t) => t.message);
    return {
      ok: true,
      required: def?.constructionSlots ?? null,
      total: slots.total,
      used: slots.used,
      placed: r.ok === true,
      reason: r.reason ?? null,
      toasts,
    };
  });
  evidence.sections.multiSlot = multiSlot;
  if (!multiSlot.ok) {
    skip('a building that needs more slots than the player owns is refused', multiSlot.reason);
  } else {
    check('a building that needs more slots than the player owns is refused',
      multiSlot.placed === false && multiSlot.reason === 'not-enough-slots',
      `needs ${multiSlot.required} slots, the player owns ${multiSlot.total} (${multiSlot.used} used): `
      + `placement ${multiSlot.placed ? 'ACCEPTED' : `refused (${multiSlot.reason})`}`);
    check('that refusal is explained to the player',
      multiSlot.toasts.some((t) => /slot/i.test(t)),
      multiSlot.toasts.slice(-2).join(' | ').slice(0, 160) || 'no toasts');
  }

  // ---- 3b. the placement gate (FR-ECO-121) ---------------------------------
  // BLD only checks affordability. The economy also owns the construction
  // slot ledger, so a placement with no free slot must be REFUSED and must
  // not be charged. The refusal must reach the player as a toast.
  const gate = await page.evaluate(async () => {
    const S = window.SUPERCITYCON;
    const B = S.ctx.domains.buildings;
    const E = S.ctx.domains.economy;
    const nextFrame = window.__sc.nextFrame;
    // The gate test runs at the NORMAL construction speed: a residential
    // build then holds its slot for a minute, so the slot is genuinely busy
    // while the second placement is attempted. (Every other phase compresses
    // the construction time so the city can be built quickly.)
    const speed = E.setConstructionSpeed?.(1);
    const buildEntries = () => (S.state.economy.ledger || [])
      .filter((e) => String(e.reason || '').startsWith('build:')).length;

    const cell = window.__sc.findFreeCell(20, 20, 8);
    const out = { speedOk: !!speed?.ok, cell, steps: [] };
    if (!cell) { out.reason = 'no free cell near (20,20)'; return out; }

    const before = { treasury: S.state.economy.treasury, builds: buildEntries() };

    // 1. the first placement is accepted (a slot is free)
    const first = B.place('res.house', cell.cx, cell.cz, 0);
    await nextFrame();
    const afterFirst = { treasury: S.state.economy.treasury, builds: buildEntries() };
    const slots = E.constructionSlots();
    out.slots = slots;

    // 2. the slot is now held — the next placement must be refused
    const second = B.place('res.house', cell.cx + 1, cell.cz, 0);
    const afterSecond = { treasury: S.state.economy.treasury, builds: buildEntries() };
    out.toasts = (S.state.ui.toasts || []).map((t) => ({ message: t.message, kind: t.kind }));
    out.before = before;
    out.afterFirst = afterFirst;
    out.afterSecond = afterSecond;
    out.first = { ok: first.ok, reason: first.reason ?? null };
    out.second = { ok: second.ok, reason: second.reason ?? null };
    out.instances = S.state.buildings.instances.size;
    return out;
  });
  evidence.sections.gate = gate;
  if (gate.reason) {
    skip('the construction-slot gate refuses a placement', gate.reason);
  } else {
    check('the first placement is accepted', gate.first.ok, `reason: ${gate.first.reason}`);
    check('a placement with no free construction slot is refused',
      gate.second.ok === false && gate.second.reason === 'not-enough-slots',
      `ok=${gate.second.ok} reason=${gate.second.reason} (slots ${gate.slots?.used}/${gate.slots?.total} used)`);
    check('the refusal reaches the player as a toast',
      gate.toasts.some((t) => /slot/i.test(t.message)),
      gate.toasts.length ? gate.toasts.map((t) => t.message).join(' | ').slice(0, 200) : 'no toasts');
    check('a refused placement is not charged',
      gate.afterSecond.treasury === gate.afterFirst.treasury
        && gate.afterSecond.builds === gate.afterFirst.builds,
      `treasury ${gate.afterFirst.treasury} -> ${gate.afterSecond.treasury}, `
      + `build ledger entries ${gate.afterFirst.builds} -> ${gate.afterSecond.builds}`);
  }

  // ---- 3c. scenery must not block construction (D-01) ----------------------
  // Decorative scatter may not make a cell unbuildable: placing a building
  // on a wooded lot must clear the scenery on it.
  const scenery = await page.evaluate(async () => {
    const S = window.SUPERCITYCON;
    const B = S.ctx.domains.buildings;
    const nextFrame = window.__sc.nextFrame;
    // Compress the construction windows so the slot the gate test took
    // becomes free again.
    S.ctx.domains.economy?.setConstructionSpeed?.(6000);
    const rec = (S.state.world.scenery || []).find((r) => r && (r.cx ?? r.x) !== undefined);
    if (!rec) return { ok: false, reason: 'the map has no scenery at all' };
    const cx = Math.round(rec.cx ?? rec.x);
    const cz = Math.round(rec.cz ?? rec.z);
    let r = null;
    for (let i = 0; i < 30; i += 1) {
      r = B.place('res.house', cx, cz, 0);
      // Only a slot refusal is worth waiting for: the reason under test is
      // whatever the placement says when the slot is free.
      if (r.ok || r.reason !== 'not-enough-slots') break;
      await window.__sc.waitForSlot();
    }
    return {
      ok: true,
      cx,
      cz,
      placed: r.ok === true,
      reason: r.reason ?? null,
      model: rec.model ?? null,
    };
  });
  evidence.sections.scenery = scenery;
  if (!scenery.ok) {
    skip('a building can be placed on a cell that holds scenery', scenery.reason);
  } else {
    check('a building can be placed on a cell that holds scenery',
      scenery.placed === true,
      `cell (${scenery.cx},${scenery.cz}) held "${scenery.model}": placement `
      + (scenery.placed ? 'accepted' : `REFUSED (${scenery.reason})`));
  }

  // ---- 4. build a city ----------------------------------------------------
  // The construction-slot gate means the city has to be built in waves: a
  // placement that is refused for lack of a slot waits for the construction
  // to finish and tries again.
  const built = await page.evaluate(async () => {
    const S = window.SUPERCITYCON;
    const B = S.ctx.domains.buildings;
    const M = S.ctx.domains.mobility;
    const E = S.ctx.domains.economy;
    const nextFrame = window.__sc.nextFrame;
    E.setConstructionSpeed?.(6000);
    const out = { placed: 0, failed: [], roads: 0, slotWaits: 0, types: {} };

    async function place(id, cx, cz) {
      // A slot becomes free again within a frame or two at the compressed
      // construction speed, so 30 retries is plenty. A building that needs
      // more slots than the player owns never gets one — that is reported by
      // its own check, not waited on here.
      for (let attempt = 0; attempt < 30; attempt++) {
        const r = B.place(id, cx, cz, 0);
        if (r.ok) { out.placed += 1; out.types[id] = (out.types[id] ?? 0) + 1; return r; }
        if (r.reason === 'not-enough-slots') {
          out.slotWaits += 1;
          await window.__sc.waitForSlot();
          continue;
        }
        return r;
      }
      return { ok: false, reason: 'slot-timeout' };
    }

    /**
     * Place a building near its planned cell, on the first cell that is
     * actually free. (Scenery, neighbouring footprints and the terrain make
     * some planned cells unusable; the city still has to get built.)
     */
    async function placeNear(id, cx, cz) {
      const def = (B.catalogue?.() || []).find((d) => d && d.id === id);
      const fw = Math.max(1, def?.footprintCells?.[0] ?? 1);
      const fh = Math.max(1, def?.footprintCells?.[1] ?? 1);
      const candidates = [];
      for (let d = 0; d <= 4; d += 1) {
        for (let dz = -d; dz <= d; dz += 1) {
          for (let dx = -d; dx <= d; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
            const tx = cx + dx;
            const tz = cz + dz;
            if (tx < 0 || tz < 0 || tx > 63 || tz > 63) continue;
            // The WHOLE footprint has to be free, not just the anchor cell.
            let clear = true;
            for (let fx = 0; fx < fw && clear; fx += 1) {
              for (let fz = 0; fz < fh && clear; fz += 1) {
                if (!window.__sc.cellIsFree(tx + fx, tz + fz)) clear = false;
              }
            }
            if (clear) candidates.push([tx, tz]);
          }
        }
      }
      let last = null;
      for (const [tx, tz] of candidates) {
        const r = await place(id, tx, tz);
        if (r.ok) return r;
        last = r;
        // A footprint that still fails (scenery, slope, another building's
        // footprint) just means the next candidate is tried.
      }
      out.failed.push(`${id}@${cx},${cz}: ${last?.reason ?? 'no-free-cell'}`);
      return last ?? { ok: false, reason: 'no-free-cell' };
    }

    const C = 32;
    // a street of roads
    for (let x = -4; x <= 4; x += 1) {
      const r = M?.addRoad ? M.addRoad(C + x, C) : null;
      if (r === false || (r && r.ok === false)) out.failed.push(`road ${x}: ${r?.reason || 'rejected'}`);
      else out.roads += 1;
    }
    // buildings either side
    const plan = [
      ['res.house', -4, 1], ['res.apartment', -3, 1], ['res.terrace_house', -2, 1],
      ['res.semi_detached', -1, 1], ['res.low_rise_flats', 0, 1], ['res.mid_rise_flats', 1, 1],
      ['com.grocery', 2, 1], ['com.cafe', 3, 1], ['com.office_block', 4, 1],
      ['ind.warehouse', -3, -1], ['ind.vehicle_garage', -1, -1],
      ['hea.medical_center', 1, -1], ['fir.station', 2, -1], ['edu.bus_station', 3, -1],
      ['eng.solar', 0, -1], ['wat.tower', 4, -1], ['prk.park', -4, -1], ['trn.monorail_station', 4, 2],
    ];
    for (const [id, dx, dz] of plan) await placeNear(id, C + dx, C + dz);
    out.instances = S.state.buildings.instances.size;
    out.models = window.__sc.modelCount();
    return out;
  });
  check('buildings place on the map', built.placed >= 15,
    `${built.placed}/18 placed, ${built.failed.length} failed: ${built.failed.slice(0, 5).join(' | ')}`);
  check('roads place on the map', built.roads >= 5, `${built.roads}/9 roads`);
  check('every placed building has a model in the scene', built.models >= built.placed,
    `${built.models} instances for ${built.placed} buildings`);
  evidence.sections.build = built;

  // ---- 5. the simulation reacts -----------------------------------------
  // Drive the simulation with a FIXED step instead of waiting on wall-clock
  // frames: the headless browser uses software GL and renders at a fraction
  // of a frame per second, so a wall-clock wait would test the GPU, not the
  // game. `SUPERCITYCON.step(dt)` is the same entry point the frame loop uses.
  const sim = await page.evaluate(async () => {
    const S = window.SUPERCITYCON;
    for (let i = 0; i < 900; i += 1) S.step(0.1);   // 90 s of game time
    const s = S.state;
    return {
      population: s.population.total,
      happiness: s.population.happiness,
      treasury: s.economy.treasury,
      day: s.meta.day,
      vehicles: s.mobility.vehicles?.length ?? 0,
      congestion: s.mobility.congestion,
      // POP owns its citizens in the domain, not in `state.population.citizens`.
      citizens: S.ctx.domains.population?.citizenCount?.() ?? 0,
      citizensInState: s.population.citizens?.length ?? 0,
      coverage: Object.keys(s.services.cityCoverage || {}).length,
      elapsed: Math.round(s.meta.elapsed),
    };
  });
  check('population grows from housing', sim.population > 0, `${sim.population} residents`);
  check('day counter advances', sim.day > 1, `day ${sim.day} after ${sim.elapsed}s`);
  check('citizens spawn', sim.citizens > 0,
    `${sim.citizens} rendered citizens (population ${sim.population})`);
  check('traffic spawns on roads', sim.vehicles > 0, `${sim.vehicles} vehicles`);
  check('service coverage computed', sim.coverage > 0, `${sim.coverage} service types`);
  check('economy responds to the city', sim.treasury !== 25000,
    `treasury ${sim.treasury} (started 25000)`);
  evidence.sections.sim = sim;

  // ---- 6. the HUD ---------------------------------------------------------
  const hud = await page.evaluate(() => {
    const root = document.getElementById('ui-root');
    return {
      children: root ? root.children.length : 0,
      html: root ? root.innerHTML.length : 0,
      buttons: document.querySelectorAll('#ui-root button').length,
      text: (root?.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
    };
  });
  check('HUD mounted', hud.children > 0 && hud.html > 500,
    `${hud.children} nodes, ${hud.buttons} buttons`);
  check('HUD shows live numbers', /[\d]/.test(hud.text), hud.text.slice(0, 140));
  evidence.sections.hud = hud;

  // ---- 7. the curated 2D art reaches the HUD ------------------------------
  const art = await page.evaluate(async () => {
    const icons = [...document.querySelectorAll('#ui-root img.sc-icon')];
    const srcs = [...new Set(icons.map((i) => i.getAttribute('src')).filter(Boolean))];
    // Which manifest can be reached? The SAME candidates the HUD tries, in
    // the same order: the relative path first, so a deployment under a
    // sub-path (a GitHub Pages project site serves at /<repo>/) is found
    // too. Probing only the absolute paths made a full build look like a
    // cleared one.
    let manifest = null;
    for (const candidate of ['assets/ui-assets.json', '/assets/ui-assets.json', '/src/data/ui-assets.json']) {
      try {
        const res = await fetch(candidate, { cache: 'no-cache' });
        if (!res.ok) continue;
        const json = await res.json();
        if (json && json.images) { manifest = { url: candidate, images: Object.keys(json.images).length }; break; }
      } catch { /* try the next candidate */ }
    }
    // Do the icon files actually serve?
    const fetches = [];
    for (const src of srcs) {
      try {
        const res = await fetch(src);
        fetches.push({ src, status: res.status, ok: res.ok, type: res.headers.get('content-type') });
      } catch {
        fetches.push({ src, status: 0, ok: false, type: null });
      }
    }
    return { manifest, iconCount: icons.length, srcs, fetches };
  });
  evidence.sections.art = art;
  if (!art.manifest) {
    skip('the 2D HUD art is applied and its files resolve',
      'no 2D manifest found at assets/ui-assets.json, /assets/ui-assets.json or '
      + '/src/data/ui-assets.json — the asset curator has not published it yet');
    // The CLEARED build (npm run build:cleared) deliberately ships no 2D art.
    // The HUD must still be COMPLETE and CORRECT: every control present, and
    // the licence line hidden (there is no art to disclaim).
    const bare = await page.evaluate(() => {
      const root = document.getElementById('ui-root');
      const licence = document.querySelector('[data-sc-licence]');
      return {
        buttons: document.querySelectorAll('#ui-root button').length,
        labelled: [...document.querySelectorAll('#ui-root button')]
          .filter((b) => (b.innerText || '').trim().length > 0 || b.getAttribute('aria-label')
            || b.dataset.scIconSlot).length,
        licenceHidden: licence ? licence.hidden : true,
        licenceText: licence ? licence.textContent : '',
        images: document.querySelectorAll('#ui-root img').length,
      };
    });
    check('the HUD is complete and correct with ZERO 2D images',
      bare.buttons >= 80 && bare.labelled >= 40 && bare.licenceHidden === true && bare.images === 0,
      `${bare.buttons} buttons, ${bare.labelled} labelled, ${bare.images} images, `
      + `licence line hidden: ${bare.licenceHidden}`);
    evidence.sections.bareHud = bare;
  } else {
    check('the 2D HUD art is applied and its files resolve',
      art.iconCount > 0 && art.fetches.length > 0 && art.fetches.every((f) => f.ok),
      `${art.iconCount} icons, ${art.srcs.length} distinct files, manifest ${art.manifest.url} `
      + `(${art.manifest.images} entries), ${art.fetches.filter((f) => f.ok).length}/${art.fetches.length} files 200`);
  }

  // ---- 8. a real pointer-driven placement ---------------------------------
  // The API checks above prove the domains work. This proves the INPUT PATH
  // works: a real mouse click on the tool button, a real mouse click on a
  // shop card, and a real mouse click on the canvas.
  const pointer = { ok: false, detail: 'not run' };
  try {
    const target = await page.evaluate(() => window.__sc.findClickableCell());
    if (!target) {
      pointer.detail = 'no free cell could be found on the canvas';
    } else {
      const before = await page.evaluate(() => ({
        tool: window.SUPERCITYCON.state.ui.tool,
        instances: window.SUPERCITYCON.state.buildings.instances.size,
        models: window.__sc.modelCount(),
      }));

      // a REAL click on the build tool
      await page.locator('#ui-root [data-sc-tool="build"]').click({ timeout: 20000 });
      const afterTool = await page.evaluate(() => window.SUPERCITYCON.state.ui.tool);

      // a REAL click on a shop card (this selects the building type)
      await page.locator('#ui-root [data-sc-card="res.house"]').click({ timeout: 20000 });
      const selection = await page.evaluate(() => ({
        selectedType: window.SUPERCITYCON.state.ui.selectedType,
        selection: window.SUPERCITYCON.state.ui.selection?.type ?? null,
      }));

      // The construction-slot gate is a REAL rule: the player starts with one
      // slot, so the city is built in waves and a slot may be busy at this
      // exact instant. Wait for a free slot before the click, exactly as the
      // build loop above does — otherwise the click is (correctly) refused.
      const slotFree = await page.evaluate(() => window.__sc.waitForSlot());
      const slotWait = slotFree ? 'a slot was free' : 'NO slot became free';

      // a REAL click on the canvas at the projected cell
      await page.mouse.click(target.x, target.y);
      await page.waitForTimeout(1500);   // the model attaches asynchronously
      const afterClick = await page.evaluate(() => ({
        instances: window.SUPERCITYCON.state.buildings.instances.size,
        models: window.__sc.modelCount(),
        toasts: (window.SUPERCITYCON.state.ui.toasts || []).map((t) => t.message),
        buildingHere: (() => {
          const b = window.SUPERCITYCON.ctx.domains.buildings;
          const cell = window.__sc.findFreeCell(32, 32, 6);
          return b.buildingAt ? 'ok' : 'missing';
        })(),
      }));

      const gained = afterClick.instances - before.instances;
      const meshGained = afterClick.models - before.models;
      Object.assign(pointer, {
        ok: afterTool === 'build'
          && selection.selectedType === 'res.house'
          && gained === 1
          && meshGained === 1,
        detail: `tool=${afterTool} type=${selection.selectedType} cell=(${target.cx},${target.cz}) `
          + `instances ${before.instances}->${afterClick.instances} `
          + `models ${before.models}->${afterClick.models} (${slotWait})`,
        target, before, afterTool, selection, afterClick,
      });
    }
  } catch (err) {
    pointer.detail = `pointer test threw: ${err.message}`;
  }
  evidence.sections.pointer = pointer;
  check('a pointer click selects the build tool', pointer.afterTool === 'build',
    `tool = ${pointer.afterTool}`);
  check('a pointer click on a shop card selects the building type',
    pointer.selection?.selectedType === 'res.house', `selectedType = ${pointer.selection?.selectedType}`);
  check('a pointer click on the canvas places a building and its model appears',
    pointer.ok === true, pointer.detail);
  if (pointer.afterClick?.toasts?.length) {
    console.log(`      (toasts: ${pointer.afterClick.toasts.join(' | ').slice(0, 200)})`);
  }

  // ---- 9. pixels ----------------------------------------------------------
  const render = await page.evaluate(() => {
    const r = window.SUPERCITYCON.renderer;
    return {
      calls: r.renderer.info.render.calls,
      tris: r.renderer.info.render.triangles,
      sceneMeshes: (() => { let n = 0; r.scene.traverse((o) => { if (o.isMesh) n += 1; }); return n; })(),
    };
  });
  check('scene renders geometry', render.calls > 10 && render.tris > 1000,
    `${render.calls} draw calls, ${render.tris} triangles, ${render.sceneMeshes} meshes`);

  // The building models must be BATCHED: N copies of one model cost one draw
  // call per model part, not one per building.
  const bstats = await page.evaluate(() => {
    const stats = window.__sc.buildingRenderStats();
    const distinct = new Set(
      [...(window.SUPERCITYCON.state.buildings.instances?.values() ?? [])].map((i) => i.type),
    ).size;
    return { ...(stats ?? {}), distinctTypes: distinct };
  });
  // The property that matters: copies of the SAME model share one batch, so
  // there can never be more batches than distinct models. (The strict
  // "twenty copies cost what one costs" proof lives in the unit test.)
  check('the building models are batched into instanced draws',
    !!bstats && bstats.instances > 0 && bstats.batches <= bstats.distinctTypes,
    `${bstats?.instances} buildings of ${bstats?.distinctTypes} types in `
    + `${bstats?.batches} batches = ${bstats?.drawCalls} draw calls`);

  await page.screenshot({ path: `${outDir}/01-city.png`, animations: 'disabled', timeout: 120000 });

  // zoomed-out overview
  await page.evaluate(() => {
    const r = window.SUPERCITYCON.renderer;
    r.setDistance(210); r.setPitch(40); r.focusOn(0, 0);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outDir}/02-overview.png`, animations: 'disabled', timeout: 120000 });

  // ---- 10. the framebuffer is not a flat colour --------------------------
  const flatness = await page.evaluate(async () => {
    const c = document.querySelector('#viewport canvas');
    const off = document.createElement('canvas');
    off.width = 160; off.height = 100;
    const g = off.getContext('2d');
    g.drawImage(c, 0, 0, 160, 100);
    const d = g.getImageData(0, 0, 160, 100).data;
    const seen = new Set();
    let sum = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      seen.add((d[i] >> 3 << 10) | (d[i + 1] >> 3 << 5) | (d[i + 2] >> 3));
      sum += d[i] + d[i + 1] + d[i + 2];
      n += 3;
    }
    return { distinct: seen.size, meanLuma: sum / n };
  });
  check('frame is not a flat colour', flatness.distinct > 12,
    `${flatness.distinct} distinct colours, mean luma ${flatness.meanLuma.toFixed(1)}`);
  evidence.sections.render = render;
  evidence.sections.flatness = flatness;

  // ---- 11. the studio sculpts and exports ---------------------------------
  const studio = await page.evaluate(() => {
    const st = window.SUPERCITYCON.ctx.domains.studio;
    if (!st) return { ok: false, reason: 'no studio domain' };
    st.open();
    const isOpen = st.isOpen();
    const before = st.voxels?.size ?? 0;
    const p1 = st.paint(3, 2, 3);
    const p2 = st.paint(4, 2, 3, 3);
    const after = st.voxels?.size ?? 0;
    const obj = st.exportOBJ();
    return {
      ok: true,
      isOpen,
      before,
      after,
      paint1: p1,
      paint2: p2,
      objType: typeof obj,
      objLength: typeof obj === 'string' ? obj.length : 0,
      objHead: typeof obj === 'string' ? obj.slice(0, 300) : '',
      hasVertices: typeof obj === 'string' && /^v\s/m.test(obj),
      hasFaces: typeof obj === 'string' && /^f\s/m.test(obj),
    };
  });
  evidence.sections.studio = studio;
  if (!studio.ok) {
    skip('the SCC Studio opens, sculpts and exports an OBJ', studio.reason);
  } else {
    check('the SCC Studio opens', studio.isOpen === true, `isOpen = ${studio.isOpen}`);
    check('the SCC Studio sculpts a voxel', studio.after > studio.before,
      `${studio.before} -> ${studio.after} voxels (paint: ${studio.paint1?.reason ?? 'ok'})`);
    check('the SCC Studio exports a valid OBJ',
      studio.objLength > 0 && studio.hasVertices && studio.hasFaces,
      `${studio.objLength} bytes, ${studio.hasVertices ? 'has' : 'no'} vertices, ${studio.hasFaces ? 'has' : 'no'} faces`);
  }

  // ---- 12. the save file reloads in a FRESH session -----------------------
  // Session A writes the save; session B is a different page in the same
  // browser context (so it shares the origin's localStorage) and loads it.
  const saved = await page.evaluate(() => {
    const S = window.SUPERCITYCON;
    const save = S.ctx.core.save;
    if (!save) return { ok: false, reason: 'no save module' };
    const instances = S.state.buildings.instances.size;
    const wrote = save.saveToStorage(S.state, 'scenario');
    const listed = save.listSaves().map((s) => s.slot);
    return { ok: true, wrote, instances, listed };
  });
  evidence.sections.save = saved;
  check('the city saves to a slot', saved.ok && saved.wrote === true,
    saved.ok ? `slot "scenario" written, ${saved.instances} buildings, slots: ${saved.listed.join(', ')}` : saved.reason);

  // ---- 13. save round-trip (in memory) -------------------------------------
  // This runs BEFORE session A is closed (see below), because it inspects the
  // live city's state in memory.
  const roundTrip = await page.evaluate(() => {
    const s = window.SUPERCITYCON.ctx.core.save;
    if (!s) return { ok: false, reason: 'no save module' };
    const json = s.serialize(window.SUPERCITYCON.state);
    const back = s.deserialize(json);
    return {
      ok: true,
      bytes: json.length,
      buildings: back.buildings.instances.size,
      original: window.SUPERCITYCON.state.buildings.instances.size,
    };
  });
  check('save round-trips', roundTrip.ok && roundTrip.buildings === roundTrip.original,
    roundTrip.ok ? `${roundTrip.bytes} bytes, ${roundTrip.buildings} buildings preserved` : roundTrip.reason);

  if (saved.ok && saved.wrote) {
    // Session A is CLOSED before session B boots.
    //
    // Both cities render under software GL (swiftshader) in the same browser.
    // Session A's city is a FULL city by now — hundreds of citizens and
    // vehicles, every frame — and it starves the second boot of CPU: session B
    // was still loading models when the 120 s budget ran out. With session A
    // closed, session B reaches `ready` in about two seconds.
    //
    // This does NOT weaken the check: the save lives in localStorage, which
    // belongs to the ORIGIN, not to the page. Session B is still a genuinely
    // fresh boot that loads the file from disk.
    await page.close();
    const sessionB = await context.newPage();
    const bErrors = [];
    sessionB.on('pageerror', (e) => bErrors.push(e.message));
    try {
      await sessionB.goto(captureUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sessionB.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true,
        null, { timeout: 120000 });
      const loaded = await sessionB.evaluate((slot) => {
        const S = window.SUPERCITYCON;
        const save = S.ctx.core.save;
        const before = S.state.buildings.instances.size;
        const restored = save.loadFromStorage(slot);
        return {
          restored: !!restored,
          before,
          after: S.state.buildings.instances.size,
          instances: restored?.buildings?.instances?.size ?? -1,
          treasury: S.state.economy.treasury,
          models: window.__sc.modelCount(),
        };
      }, 'scenario');
      await sessionB.waitForTimeout(2000);
      const modelsAfter = await sessionB.evaluate(() => window.__sc.modelCount());
      evidence.sections.reload = { ...loaded, modelsAfter, pageErrors: bErrors };
      // Session B's errors count towards the run-wide error check.
      pageErrors.push(...bErrors);
      check('a fresh session loads the save file',
        loaded.restored && loaded.after === saved.instances,
        `session B went from ${loaded.before} to ${loaded.after} buildings (session A saved ${saved.instances})`);
      check('the loaded city renders its buildings', modelsAfter > 0,
        `${modelsAfter} building models in the scene after the load`);
    } catch (err) {
      check('a fresh session loads the save file', false, err.message);
    } finally {
      await sessionB.close().catch(() => {});
    }
  }

  // ---- 14. no runtime errors ---------------------------------------------
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  const realErrors = consoleErrors.filter((e) => !/Failed to load resource/.test(e));
  check('no console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  writeFileSync(`${outDir}/scenario.json`, JSON.stringify(evidence, null, 2));
} catch (err) {
  check('scenario ran to completion', false,
    `${err.message} | ${(err.stack || '').split('\n').slice(0, 4).join(' >> ')}`
    + (navigations > 1 ? '  [the page navigated mid-run — a dev-server reload wiped the game state]' : ''));
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
