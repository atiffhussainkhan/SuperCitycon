#!/usr/bin/env node
/**
 * tools/save-size-report.mjs — HOW BIG IS A SUPER CITYCON SAVE, AND WHY?
 *
 *   node tools/save-size-report.mjs [--url <url>] [--port 4211]
 *                                   [--outdir <dir>] [--repeats 5]
 *
 * WHAT THIS IS
 *   The measurement behind `docs/v7/SAVE_SIZE.md`. It builds REAL cities
 *   through the game's own domain API — the same path `tools/scenario.mjs`
 *   and `tools/profile-city.mjs` use — and then measures, for each city:
 *
 *     - the size of the save record the game actually writes;
 *     - the size of EVERY top-level part of the payload and its share;
 *     - inside `world`, the size and the BYTES PER CELL of `heightmap`,
 *       `water` and `types`;
 *     - the THEORETICAL FLOOR: the same data as typed arrays in base64, as
 *       a compact integer encoding, and as JSON with the floats rounded;
 *     - the bytes that are DATA and the bytes that are JSON scaffolding;
 *     - the time to save and to load, through `ctx.core.save`.
 *
 * WHAT THIS IS NOT
 *   A format change. The save schema stays at version 2 and this tool
 *   changes nothing: it writes to scratch slots and reads them back, and it
 *   never touches `game/src/**`.
 *
 * THE MEASUREMENT IS THE POINT
 *   Every number this tool prints was measured on the city in front of it.
 *   Nothing is estimated and nothing is extrapolated: where a number could
 *   not be measured, the tool says so instead of guessing.
 *
 * Exit code: 0 when every stage was measured, 1 when the game never became
 * ready or a stage failed to measure.
 */

import { spawn } from 'node:child_process';
import { accessSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { resolveChromium } from './playwright-resolve.mjs';

const { chromium } = await resolveChromium();

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const PORT = Number(arg('port', 4211));
const REPEATS = Number(arg('repeats', 5));
const EXTERNAL = arg('url', null);
// The evidence lands OUTSIDE the repository by default: this tool writes an
// artefact, and the repository's files belong to their owners.
const OUTDIR = resolve(arg('outdir', join(tmpdir(), 'sc-save-size')));

/**
 * The city sizes the report measures.
 *
 * They are STAGES of ONE city that grows, because that is what a player's
 * city does: the terrain never changes, the buildings accumulate and the
 * scenery is cleared where the city is built.
 *
 * `max` is the worst case the game can hold: every buildable cell carries
 * something, and the citizens are at the cap.
 */
const STAGES = [
  { key: 'small', label: 'small', mode: 'grow', houses: 20, region: { x0: 24, x1: 36, z0: 24, z1: 36 }, roadPitch: 6 },
  { key: 'medium', label: 'medium', mode: 'grow', houses: 130, region: { x0: 16, x1: 44, z0: 16, z1: 44 }, roadPitch: 5 },
  { key: 'large', label: 'large', mode: 'grow', houses: 380, region: { x0: 8, x1: 55, z0: 8, z1: 55 }, roadPitch: 5 },
  { key: 'max', label: 'maximum', mode: 'fill', houses: Infinity, region: { x0: 1, x1: 62, z0: 1, z1: 62 }, roadPitch: 5 },
];

/**
 * The non-residential buildings a real city of this size carries.
 *
 * They are placed FIRST in the `max` stage: the civic buildings grant extra
 * construction slots (FR-ECO-020), which is how a player builds a city this
 * size at all, and the services are what the citizens walk to.
 */
const CIVIC = ['spl.citycon_building', 'spl.citycon_building', 'spl.citycon_building',
  'spl.citycon_building', 'spl.citycon_building', 'spl.citycon_building'];
const SERVICES = [
  'hea.medical_center', 'hea.hospital', 'edu.elementary', 'edu.secondary', 'edu.library',
  'pol.station', 'pol.department', 'prk.park', 'com.grocery', 'com.general_store',
  'com.restaurant', 'ind.warehouse', 'ind.vehicle_garage', 'eng.solar', 'wat.treatment',
  'fir.station', 'edu.bus_station', 'edu.university', 'trn.monorail_station',
];

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
    process.stderr.write(`No build found at ${dist}. Run "npm run build:cleared" in game/ first.\n`);
    process.exit(1);
  }
  preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
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
  headless: true,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

// ---------------------------------------------------------------------------
// The measurement, in the page
// ---------------------------------------------------------------------------

/**
 * Everything below runs INSIDE the page, against the live game.
 *
 * @param {{stages:Array, repeats:number, civic:Array, services:Array}} cfg
 * @returns {Promise<object>} the raw evidence
 */
async function measureInPage(cfg) {
  const S = window.SUPERCITYCON;
  const save = S.ctx.core.save;
  const B = S.ctx.domains.buildings;
  const E = S.ctx.domains.economy;
  const M = S.ctx.domains.mobility;
  const P = S.ctx.domains.population;
  const W = S.ctx.domains.wld;

  const encoder = new TextEncoder();
  const utf8 = (s) => encoder.encode(s).length;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const median = (a) => {
    const s = [...a].filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
    return s.length ? s[Math.floor(s.length / 2)] : null;
  };
  const round = (n, p = 2) => (Number.isFinite(n) ? +Number(n).toFixed(p) : null);

  // The construction windows are compressed so the construction slots free up
  // within milliseconds. The city is still built through the normal placement
  // path, so the slot gate is exercised exactly as a player's is.
  E.setConstructionSpeed?.(6000);

  const catalogue = B.catalogue?.() || [];
  const defOf = (id) => catalogue.find((d) => d && d.id === id) || null;
  const footprintOf = (id) => {
    const def = defOf(id);
    return [Math.max(1, def?.footprintCells?.[0] ?? 1), Math.max(1, def?.footprintCells?.[1] ?? 1)];
  };

  /** Is the cell free for a building? */
  function cellFree(cx, cz) {
    if (cx < 0 || cz < 0 || cx > 63 || cz > 63) return false;
    if (B.buildingAt(cx, cz)) return false;
    if (M?.roadAt?.(cx, cz)) return false;
    if (W?.isWater?.(cx, cz)) return false;
    return true;
  }

  /** Wait until a construction slot is free. */
  async function waitForSlot(maxMs = 4000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      E.update(0);
      const slots = E.constructionSlots();
      if (!slots || slots.free > 0) return true;
      await sleep(3);
    }
    return false;
  }

  /**
   * Place one building, spiralling out from the wanted cell.
   *
   * The only refusal that is waited on is the construction slot; a refusal
   * for money is answered by earning more, and every other refusal is final
   * for that cell.
   */
  async function placeNear(id, cx, cz, maxRadius = 6) {
    const def = defOf(id);
    const [fw, fh] = footprintOf(id);
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
          for (let attempt = 0; attempt < 40; attempt += 1) {
            await waitForSlot();
            const gate = E.canPlace?.(def, 1);
            if (gate && !gate.ok && gate.reason === 'insufficient-funds') {
              E.earn?.(200000, 'save-size-report funding');
              continue;
            }
            const r = B.place(id, tx, tz, 0);
            if (r?.ok) return { ok: true, x: tx, z: tz };
            if (r?.reason === 'not-enough-slots') continue;
            return { ok: false, reason: r?.reason ?? 'unknown' };
          }
          return { ok: false, reason: 'slot-timeout' };
        }
      }
    }
    return { ok: false, reason: 'no-free-cell' };
  }

  /** Lay the street network over the stage region. */
  function layRoads(region, pitch) {
    let roads = 0;
    const failures = {};
    for (let cz = region.z0; cz <= region.z1; cz += 1) {
      for (let cx = region.x0; cx <= region.x1; cx += 1) {
        if (cx % pitch !== 0 && cz % pitch !== 0) continue;
        if (B.buildingAt(cx, cz)) { failures.occupied = (failures.occupied ?? 0) + 1; continue; }
        const r = M?.addRoad ? M.addRoad(cx, cz) : null;
        if (r === false || (r && r.ok === false)) {
          const reason = r?.reason ?? 'rejected';
          failures[reason] = (failures[reason] ?? 0) + 1;
          continue;
        }
        roads += 1;
      }
    }
    return { roads, failures };
  }

  // -------------------------------------------------------------------------
  // The size measurement
  // -------------------------------------------------------------------------

  /**
   * Describe a collection in the SNAPSHOT representation.
   *
   * A Map is snapshotted as `{ __map: [[key, value], ...] }` and a Set as
   * `{ __set: [...] }`, so the bytes of the wrapper and the bytes of the
   * entries can be told apart.
   */
  function describeValue(value) {
    if (Array.isArray(value)) {
      const bytes = utf8(JSON.stringify(value));
      const leaves = leafBytes(value);
      return {
        kind: 'array',
        entries: value.length,
        bytes,
        dataBytes: leaves,
        scaffoldingBytes: bytes - leaves,
        avgPerEntry: value.length ? round(bytes / value.length, 1) : null,
      };
    }
    if (value && typeof value === 'object') {
      if (Array.isArray(value.__map)) {
        const entries = value.__map;
        const bytes = utf8(JSON.stringify(value));
        const leaves = leafBytes(value);
        const sizes = entries.map(([, v]) => utf8(JSON.stringify(v)));
        sizes.sort((a, b) => a - b);
        const keyBytes = entries.reduce((a, [k]) => a + utf8(String(k)), 0);
        return {
          kind: 'map',
          entries: entries.length,
          bytes,
          dataBytes: leaves,
          scaffoldingBytes: bytes - leaves,
          keyBytes,
          payloadBytes: bytes - keyBytes,
          avgPerEntry: entries.length ? round(bytes / entries.length, 1) : null,
          medianEntryBytes: sizes.length ? sizes[Math.floor(sizes.length / 2)] : null,
          maxEntryBytes: sizes.length ? sizes[sizes.length - 1] : null,
        };
      }
      if (Array.isArray(value.__set)) {
        const bytes = utf8(JSON.stringify(value));
        const leaves = leafBytes(value);
        return {
          kind: 'set',
          entries: value.__set.length,
          bytes,
          dataBytes: leaves,
          scaffoldingBytes: bytes - leaves,
          avgPerEntry: value.__set.length ? round(bytes / value.__set.length, 1) : null,
        };
      }
      const bytes = utf8(JSON.stringify(value));
      const leaves = leafBytes(value);
      return {
        kind: 'object',
        keys: Object.keys(value).length,
        bytes,
        dataBytes: leaves,
        scaffoldingBytes: bytes - leaves,
      };
    }
    return { kind: 'scalar', bytes: utf8(JSON.stringify(value)) };
  }

  /** The bytes of the LEAF values: the data, without the JSON scaffolding. */
  function leafBytes(value) {
    if (value === null || value === undefined) return 4;
    if (typeof value === 'number') return Number.isFinite(value) ? utf8(String(value)) : 4;
    if (typeof value === 'boolean') return value ? 4 : 5;
    if (typeof value === 'string') return utf8(value);
    if (Array.isArray(value)) return value.reduce((a, v) => a + leafBytes(v), 0);
    if (typeof value === 'object') {
      if (Array.isArray(value.__map)) {
        return value.__map.reduce((a, [k, v]) => a + leafBytes(k) + leafBytes(v), 0);
      }
      if (Array.isArray(value.__set)) return value.__set.reduce((a, v) => a + leafBytes(v), 0);
      return Object.values(value).reduce((a, v) => a + leafBytes(v), 0);
    }
    return 0;
  }

  /** The per-field cost of a median-sized building instance. */
  function instanceFieldCosts(part) {
    const map = part?.instances;
    if (!map || !Array.isArray(map.__map) || !map.__map.length) return null;
    const entries = [...map.__map].sort(
      (a, b) => utf8(JSON.stringify(a[1])) - utf8(JSON.stringify(b[1])));
    const mid = entries[Math.floor(entries.length / 2)][1];
    const fields = Object.entries(mid)
      .map(([k, v]) => ({ field: k, bytes: utf8(JSON.stringify(v)), dataBytes: leafBytes(v) }))
      .sort((a, b) => b.bytes - a.bytes);
    return {
      sampleBytes: utf8(JSON.stringify(mid)),
      sampleDataBytes: leafBytes(mid),
      fields,
    };
  }

  /**
   * Measure ONE save of the live state.
   *
   * The record is the exact one `saveToStorage()` and `exportSave()` write:
   * `{ version, savedAt, name, stage, data: snapshot(state) }`.
   */
  function measureSize() {
    const record = save.buildRecord(S.state);
    const json = JSON.stringify(record);
    const totalBytes = utf8(json);
    const data = record.data || {};

    // --- every top-level part of the payload ---
    const parts = {};
    let partSum = 0;
    for (const key of Object.keys(data)) {
      const bytes = utf8(JSON.stringify(data[key]));
      const leaves = leafBytes(data[key]);
      partSum += bytes;
      parts[key] = {
        bytes,
        share: totalBytes ? bytes / totalBytes : 0,
        dataBytes: leaves,
        scaffoldingBytes: bytes - leaves,
        sub: describePart(data[key]),
      };
    }

    // --- the terrain ---
    const world = data.world || {};
    const worldParts = {};
    for (const key of ['heightmap', 'water', 'types']) {
      const t = world[key];
      if (!t || typeof t !== 'object') { worldParts[key] = null; continue; }
      const cells = Array.isArray(t.data) ? t.data.length : 0;
      const fullBytes = utf8(JSON.stringify(t));
      const arrayBytes = utf8(JSON.stringify(t.data));
      worldParts[key] = {
        typed: t.__typed ?? null,
        cells,
        bytes: fullBytes,
        arrayBytes,
        wrapperBytes: fullBytes - arrayBytes,
        bytesPerCell: cells ? round(arrayBytes / cells, 2) : null,
        distinctValues: Array.isArray(t.data) ? new Set(t.data).size : null,
      };
    }

    const leaves = leafBytes(data);

    return {
      record,
      json,
      totalBytes,
      chars: json.length,
      partSum,
      envelopeBytes: totalBytes - partSum,
      dataBytes: leaves,
      scaffoldingBytes: totalBytes - leaves,
      parts,
      worldParts,
      instanceFields: instanceFieldCosts(data.buildings),
    };
  }

  /** One level deeper into a part: what is inside it, and how big. */
  function describePart(part) {
    const out = {};
    if (!part || typeof part !== 'object') return out;
    for (const [key, value] of Object.entries(part)) {
      out[key] = describeValue(value);
    }
    return out;
  }

  /**
   * The THEORETICAL FLOOR.
   *
   * Three encodings of the SAME terrain data, each measured on the real
   * arrays:
   *
   *   base64     — the typed array as bytes, base64'd. Lossless.
   *   quantised  — the heights and the water depths as uint16, the terrain
   *                types as uint8 (they already are). The precision that is
   *                given up is MEASURED, not assumed.
   *   rounded    — the SAME JSON shape, with the floats rounded. No schema
   *                change at all: the shape is identical, only the values
   *                differ.
   */
  function measureFloors() {
    const world = S.state.world || {};
    const arrays = { heightmap: world.heightmap, water: world.water, types: world.types };

    /** The length of the base64 STRING that would carry these bytes. */
    const base64Chars = (view) => {
      if (!view || !ArrayBuffer.isView(view)) return null;
      const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
      let bin = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return btoa(bin).length;
    };

    /** Quantise a float array to uint16 and report the error it costs. */
    const quantise = (view) => {
      if (!view || !ArrayBuffer.isView(view)) return null;
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < view.length; i += 1) {
        const v = view[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const span = max - min;
      const scale = span > 0 ? 65535 / span : 0;
      const out = new Uint16Array(view.length);
      let maxError = 0;
      let integerCells = 0;
      for (let i = 0; i < view.length; i += 1) {
        const q = Math.round((view[i] - min) * scale);
        out[i] = q;
        const back = span > 0 ? min + q / scale : min;
        const err = Math.abs(back - view[i]);
        if (err > maxError) maxError = err;
        if (Number.isInteger(view[i])) integerCells += 1;
      }
      return {
        min,
        max,
        span,
        maxError,
        integerCells,
        bytes: out.byteLength,
        base64Chars: base64Chars(out),
      };
    };

    const base64 = {};
    const quant = {};
    const stats = {};
    for (const [key, view] of Object.entries(arrays)) {
      base64[key] = base64Chars(view);
      quant[key] = key === 'types' ? {
        bytes: view?.byteLength ?? null,
        base64Chars: base64Chars(view),
        maxError: 0,
        note: 'already a Uint8Array — lossless as it stands',
      } : quantise(view);

      // --- the shape of the values themselves ---
      if (view && ArrayBuffer.isView(view)) {
        let min = Infinity;
        let max = -Infinity;
        let nonZero = 0;
        let integers = 0;
        for (let i = 0; i < view.length; i += 1) {
          const v = view[i];
          if (v < min) min = v;
          if (v > max) max = v;
          if (v !== 0) nonZero += 1;
          if (Number.isInteger(v)) integers += 1;
        }
        stats[key] = {
          cells: view.length,
          min,
          max,
          nonZeroCells: nonZero,
          integerCells: integers,
          distinctValues: new Set(view).size,
        };
      }
    }

    // --- the same data as JSON, with the floats rounded ---
    const rounded = {};
    for (const decimals of [3, 2]) {
      let bytes = 0;
      for (const key of ['heightmap', 'water', 'types']) {
        const view = world[key];
        if (!view || !ArrayBuffer.isView(view)) continue;
        const arr = Array.from(view, (v) => Number(v.toFixed(decimals)));
        bytes += utf8(JSON.stringify(arr));
      }
      rounded[decimals] = bytes;
    }

    const sum = (o) => Object.values(o).reduce((a, b) => a + (Number(b) || 0), 0);

    return {
      base64: { perArray: base64, total: sum(base64) },
      quantised: {
        perArray: quant,
        total: sum(Object.fromEntries(Object.entries(quant).map(([k, v]) => [k, v?.base64Chars ?? 0]))),
      },
      roundedJson: rounded,
      valueStats: stats,
    };
  }

  // -------------------------------------------------------------------------
  // The timing measurement
  // -------------------------------------------------------------------------

  /**
   * Time a save through the REAL API.
   *
   * `serialize` is the snapshot + the JSON string; `saveToStorage` adds the
   * localStorage write. Both are timed REPEATS times and the median is
   * reported, because a single sample is noise.
   */
  function timeSave(slot) {
    const serializeMs = [];
    const storageMs = [];
    let wrote = false;
    for (let i = 0; i < cfg.repeats; i += 1) {
      const t0 = performance.now();
      save.serialize(S.state);
      serializeMs.push(performance.now() - t0);

      const t1 = performance.now();
      const ok = save.saveToStorage(S.state, slot);
      storageMs.push(performance.now() - t1);
      wrote = wrote || ok === true;
    }
    return {
      serializeMs: { median: round(median(serializeMs), 3), samples: serializeMs.map((n) => round(n, 3)) },
      saveToStorageMs: { median: round(median(storageMs), 3), samples: storageMs.map((n) => round(n, 3)) },
      wrote,
    };
  }

  /**
   * The localStorage quota, measured rather than assumed.
   *
   * This tool's own scratch slots are removed FIRST: the quota is a budget
   * for the whole origin, so leaving four saves in it would understate what
   * a player has.
   */
  function measureQuota() {
    const prefix = 'supercitycon:save:save-size-';
    let removed = 0;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) { localStorage.removeItem(key); removed += 1; }
    }
    const remainingKeys = Object.keys(localStorage);
    const remainingChars = remainingKeys.reduce(
      (a, k) => a + k.length + (localStorage.getItem(k)?.length ?? 0), 0);

    const key = 'supercitycon:save:quota-probe';
    const chunk = 'x'.repeat(256 * 1024);
    let written = 0;
    let error = null;
    try {
      for (let i = 0; i < 400; i += 1) {
        localStorage.setItem(`${key}-${i}`, chunk);
        written += 1;
      }
    } catch (err) {
      error = { name: err?.name ?? 'Error', message: String(err?.message ?? err) };
    }
    for (let i = 0; i < written; i += 1) localStorage.removeItem(`${key}-${i}`);
    return {
      charsWritten: written * chunk.length,
      remainingKeys: remainingKeys.length,
      remainingChars,
      removedScratchSlots: removed,
      error,
    };
  }

  // -------------------------------------------------------------------------
  // The run
  // -------------------------------------------------------------------------

  const evidence = {
    url: location.href,
    schemaVersion: save.SAVE_VERSION ?? null,
    gridSize: S.ctx.config?.GRID?.size ?? null,
    maxRenderedCitizens: S.ctx.config?.TUNING?.maxRenderedCitizens ?? null,
    stages: [],
    load: [],
    quota: null,
  };

  // --- the services, placed ONCE: they are what the citizens walk to ------
  const services = [];
  for (const id of ['hea.medical_center', 'prk.park', 'com.grocery']) {
    const r = await placeNear(id, 32, 32, 12);
    services.push({ id, ...r });
  }

  for (const stage of cfg.stages) {
    const stageEvidence = {
      key: stage.key,
      label: stage.label,
      build: {},
      size: null,
      floors: null,
      timing: null,
      city: null,
    };

    // --- grow the city ----------------------------------------------------
    const placedTypes = {};
    let placed = 0;
    const failures = {};
    const region = stage.region;

    if (stage.mode === 'fill') {
      // The civic buildings first: they grant the construction slots a city
      // this size needs.
      for (const id of cfg.civic) {
        const r = await placeNear(id, 32, 32, 30);
        if (r.ok) placedTypes[id] = (placedTypes[id] ?? 0) + 1;
        else failures[`${id}:${r.reason}`] = (failures[`${id}:${r.reason}`] ?? 0) + 1;
      }
      // Then the services, spread over the map.
      let n = 0;
      for (const id of cfg.services) {
        const cx = 4 + (n * 7) % 56;
        const cz = 4 + (n * 11) % 56;
        const r = await placeNear(id, cx, cz, 10);
        if (r.ok) { placedTypes[id] = (placedTypes[id] ?? 0) + 1; n += 1; }
        else failures[`${id}:${r.reason}`] = (failures[`${id}:${r.reason}`] ?? 0) + 1;
      }
    }

    const roadInfo = layRoads(region, stage.roadPitch);

    outer:
    for (let cz = region.z0; cz <= region.z1; cz += 1) {
      for (let cx = region.x0; cx <= region.x1; cx += 1) {
        if (placed >= stage.houses) break outer;
        if (!cellFree(cx, cz)) continue;
        const r = await placeNear('res.house', cx, cz, 0);
        if (r.ok) { placed += 1; placedTypes['res.house'] = (placedTypes['res.house'] ?? 0) + 1; }
        else failures[r.reason] = (failures[r.reason] ?? 0) + 1;
      }
    }

    // --- the citizens -----------------------------------------------------
    let topped = 0;
    const cap = Number(S.ctx.config?.TUNING?.maxRenderedCitizens) || 0;
    for (let i = 0; i < cap + 8; i += 1) {
      if ((P.citizenCount?.() ?? 0) >= cap) break;
      if (P.spawnCitizen?.()) topped += 1; else break;
    }
    // Let the population derive and the traffic spawn, so the city is a real
    // city and not a pile of instances.
    for (let i = 0; i < 20; i += 1) await sleep(50);

    stageEvidence.build = {
      housesPlaced: placed,
      byType: placedTypes,
      houseFailures: failures,
      roads: roadInfo.roads,
      roadFailures: roadInfo.failures,
      services,
      citizensToppedUp: topped,
    };

    // --- the size ---------------------------------------------------------
    const size = measureSize();
    stageEvidence.size = {
      totalBytes: size.totalBytes,
      chars: size.chars,
      envelopeBytes: size.envelopeBytes,
      dataBytes: size.dataBytes,
      scaffoldingBytes: size.scaffoldingBytes,
      parts: size.parts,
      worldParts: size.worldParts,
      instanceFields: size.instanceFields,
    };

    // --- the floors -------------------------------------------------------
    stageEvidence.floors = measureFloors();

    // --- the timing -------------------------------------------------------
    const slot = `save-size-${stage.key}`;
    stageEvidence.timing = timeSave(slot);

    stageEvidence.city = {
      buildings: S.state.buildings?.instances?.size ?? 0,
      citizensRendered: P.citizenCount?.() ?? 0,
      residents: S.state.population?.total ?? 0,
      roads: S.state.mobility?.roads?.size ?? 0,
      roadNodes: S.state.mobility?.network?.nodes?.size ?? 0,
      vehicles: S.state.mobility?.vehicles?.length ?? 0,
      scenery: S.state.world?.scenery?.length ?? 0,
      ledger: S.state.economy?.ledger?.length ?? 0,
      toasts: S.state.ui?.toasts?.length ?? 0,
      treasury: S.state.economy?.treasury ?? 0,
      day: S.state.meta?.day ?? 0,
    };

    evidence.stages.push(stageEvidence);

    // The record's JSON text is kept for the load measurement.
    stageEvidence.recordJson = size.json;
  }

  // -------------------------------------------------------------------------
  // The load timing — measured LAST, because a load REPLACES the live state.
  // -------------------------------------------------------------------------
  for (const stage of evidence.stages) {
    const slot = `save-size-${stage.key}`;
    const storageSamples = [];
    const importSamples = [];
    let restored = false;
    for (let i = 0; i < cfg.repeats; i += 1) {
      const t0 = performance.now();
      const state = save.loadFromStorage(slot);
      storageSamples.push(performance.now() - t0);
      restored = restored || !!state;
    }
    for (let i = 0; i < cfg.repeats; i += 1) {
      const t1 = performance.now();
      save.importSave(stage.recordJson);
      importSamples.push(performance.now() - t1);
    }
    evidence.load.push({
      key: stage.key,
      label: stage.label,
      restored,
      loadFromStorageMs: { median: round(median(storageSamples), 3), samples: storageSamples.map((n) => round(n, 3)) },
      importSaveMs: { median: round(median(importSamples), 3), samples: importSamples.map((n) => round(n, 3)) },
    });
  }

  // --- the localStorage quota -------------------------------------------
  evidence.quota = measureQuota();

  // The record texts are big; they are dropped from the returned payload.
  for (const stage of evidence.stages) delete stage.recordJson;

  return evidence;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let ready = false;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.SUPERCITYCON?.state?.meta?.ready === true,
    null, { timeout: 180000 });
  ready = true;
} catch (err) {
  process.stderr.write(`The game never became ready: ${err?.message ?? err}\n`);
}

if (!ready) {
  await browser.close();
  if (preview) preview.kill('SIGTERM');
  process.exit(1);
}

// Give the first frames (shader compilation) time to settle.
await page.waitForTimeout(1500);

let evidence = null;
try {
  evidence = await page.evaluate(measureInPage, {
    stages: STAGES,
    repeats: REPEATS,
    civic: CIVIC,
    services: SERVICES,
  });
} catch (err) {
  process.stderr.write(`The measurement failed: ${err?.message ?? err}\n`);
  await browser.close();
  if (preview) preview.kill('SIGTERM');
  process.exit(1);
}

evidence.consoleErrors = consoleErrors.slice(0, 20);
evidence.pageErrors = pageErrors.slice(0, 20);
evidence.generatedAt = new Date().toISOString();

await browser.close();
if (preview) preview.kill('SIGTERM');

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

mkdirSync(OUTDIR, { recursive: true });
const evidencePath = join(OUTDIR, 'save-size-report.json');
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

const kb = (bytes) => (bytes / 1024).toFixed(1);
const pct = (share) => `${(share * 100).toFixed(1)}%`;

console.log('');
console.log('SAVE SIZE REPORT');
console.log('===============');
console.log(`schema version : ${evidence.schemaVersion}   grid: ${evidence.gridSize}x${evidence.gridSize}`);
console.log(`evidence       : ${evidencePath}`);
console.log('');
console.log('stage      buildings  citizens  roads   save KiB   data KiB   serialize ms   storage ms   load ms');
for (const stage of evidence.stages) {
  const load = evidence.load.find((l) => l.key === stage.key);
  console.log(
    `${stage.label.padEnd(10)} ${String(stage.city.buildings).padStart(8)}  `
    + `${String(stage.city.citizensRendered).padStart(8)}  ${String(stage.city.roads).padStart(6)}  `
    + `${kb(stage.size.totalBytes).padStart(8)}  ${kb(stage.size.dataBytes).padStart(8)}  `
    + `${String(stage.timing.serializeMs.median?.toFixed(1)).padStart(13)}  `
    + `${String(stage.timing.saveToStorageMs.median?.toFixed(1)).padStart(10)}  `
    + `${String(load?.loadFromStorageMs.median?.toFixed(1)).padStart(7)}`);
}
console.log('');

const last = evidence.stages[evidence.stages.length - 1];
console.log(`worst save    : ${kb(last.size.totalBytes)} KiB (${last.size.totalBytes} bytes)`);
console.log(`  data        : ${kb(last.size.dataBytes)} KiB   scaffolding: ${kb(last.size.scaffoldingBytes)} KiB`);
console.log('');
console.log('parts of the worst save:');
for (const [key, part] of Object.entries(last.size.parts).sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`  ${key.padEnd(12)} ${kb(part.bytes).padStart(9)} KiB  ${pct(part.share).padStart(7)}`);
}
console.log(`  ${'(envelope)'.padEnd(12)} ${kb(last.size.envelopeBytes).padStart(9)} KiB`);
console.log('');
console.log('the terrain arrays:');
for (const [key, w] of Object.entries(last.size.worldParts)) {
  if (!w) continue;
  console.log(`  ${key.padEnd(10)} ${kb(w.bytes).padStart(9)} KiB  ${w.bytesPerCell.toFixed(2)} bytes/cell  (${w.cells} cells)`);
}
console.log('');
const f = last.floors;
console.log('floors for the same terrain:');
console.log(`  base64 (lossless)        ${kb(f.base64.total).padStart(9)} KiB`);
console.log(`  base64 (uint16 quantised) ${kb(f.quantised.total).padStart(9)} KiB`);
console.log(`  JSON, floats at 3 dp     ${kb(f.roundedJson[3]).padStart(9)} KiB`);
console.log(`  JSON, floats at 2 dp     ${kb(f.roundedJson[2]).padStart(9)} KiB`);
console.log('');
console.log(`localStorage quota: ${evidence.quota.charsWritten} chars`
  + ` (${kb(evidence.quota.charsWritten)} KiB)`
  + `${evidence.quota.error ? ` (stopped: ${evidence.quota.error.name})` : ''}`);
console.log(`  the game keeps ${evidence.quota.remainingKeys} other key(s), ${evidence.quota.remainingChars} chars`);
console.log('');

if (evidence.consoleErrors.length || evidence.pageErrors.length) {
  console.log(`page errors   : ${evidence.pageErrors.length}   console errors: ${evidence.consoleErrors.length}`);
  for (const e of evidence.pageErrors.slice(0, 5)) console.log(`  ! ${e}`);
}

process.exit(0);
