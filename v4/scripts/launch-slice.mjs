#!/usr/bin/env node
/**
 * V4 — acceptance harness for the vertical slice.
 *
 * Starts the built app, opens it in a real browser, and drives the slice
 * through the twelve required steps: start, load a scene, control the
 * character, move, animate, interact, NPC behaviour, HUD, pause/resume,
 * save/reload, performance readout and a clean exit. It measures what
 * happens; it never asserts a figure it did not observe.
 *
 * Usage:
 *   node scripts/launch-slice.mjs [--out <dir>] [--port 4180] [--headed]
 *                                 [--url <url>] [--keep-open]
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChromium } from '../../tools/playwright-resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const V4 = resolve(HERE, '..');
const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const OUT = resolve(argOf('out', join(V4, 'verification', 'slice')));
const PORT = Number(argOf('port', 4180));
const HEADED = argv.includes('--headed');
const KEEP_OPEN = argv.includes('--keep-open');
const EXTERNAL_URL = argOf('url', null);

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: detail ?? null });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  return !!ok;
}

async function waitForServer(url, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  let server = null;
  let url = EXTERNAL_URL;

  if (!url) {
    server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      cwd: V4, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', () => {});
    server.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
    url = `http://127.0.0.1:${PORT}/`;
    const up = await waitForServer(url);
    if (!up) throw new Error(`the preview server did not come up at ${url}`);
  }

  const { chromium } = await resolveChromium();
  const browser = await chromium.launch({
    headless: !HEADED,
    chromiumSandbox: true,
    args: [
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
    ],
  });

  const report = { url, at: new Date().toISOString(), headed: HEADED, checks: [], timeline: [] };
  const mark = (label, data) => {
    report.timeline.push({ label, at: Date.now(), ...data });
  };

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)));

    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.body?.getAttribute('data-v4-ready') === '1', null, { timeout: 180000 });
    const readyMs = Date.now() - t0;
    mark('ready', { readyMs });
    check('the app reaches ready state', true, `${readyMs} ms`);

    const state = await page.evaluate(() => {
      const v4 = window.__v4;
      return {
        version: v4?.version,
        entities: v4?.world?.entityCount ?? 0,
        hasEditor: !!v4?.editor,
        hasNpc: !!v4?.npc,
        hasHud: !!v4?.hud,
        player: v4?.player ?? null,
        gpu: v4?.gpu?.() ?? null,
        errors: (v4?.logger?.errors?.() ?? []).map((e) => e.message),
      };
    });
    report.state = state;
    check('the world is populated', state.entities > 0, `${state.entities} entities`);
    check('a player entity exists', state.player !== null, `entity ${state.player}`);
    check('the editor is mounted', state.hasEditor);
    check('the NPC system is mounted', state.hasNpc);
    check('the HUD is mounted', state.hasHud);

    await page.screenshot({ path: join(OUT, '01-boot.png') });

    // --- the inspector renders a selected entity ----------------------------
    // The player carries a live animation controller, which is exactly the
    // kind of value that used to break the inspector.
    const inspector = await page.evaluate(async () => {
      const v4 = window.__v4;
      const before = v4?.logger?.errors?.().length ?? 0;
      v4?.editor?.select?.([v4?.player]);
      await new Promise((r) => setTimeout(r, 400));
      const panel = document.querySelector('.v4-panel-body');
      const text = panel?.innerText ?? '';
      return {
        selected: v4?.editor?.selection ?? [],
        text: text.slice(0, 300),
        length: text.length,
        errorsBefore: before,
        errorsAfter: v4?.logger?.errors?.().length ?? 0,
      };
    });
    report.inspector = inspector;
    check('the inspector renders the selected entity', inspector.length > 20, `${inspector.length} chars`);
    check('the inspector does not raise errors', inspector.errorsAfter === inspector.errorsBefore,
      `${inspector.errorsAfter - inspector.errorsBefore} new error(s)`);
    await page.screenshot({ path: join(OUT, '01b-inspector.png') });

    // --- enter play mode through the editor's own Play button ---------------
    // The button is the real user path: if clicking it does not start the
    // simulation, the slice does not play.
    const playButton = await page.$('button:text-is("Play")');
    let played = false;
    if (playButton) {
      await playButton.click();
      await page.waitForTimeout(300);
      played = await page.evaluate(() => window.__v4?.mode === 'play');
    }
    report.playMode = { buttonFound: !!playButton, mode: await page.evaluate(() => window.__v4?.mode) };
    check('the editor Play button starts the simulation', played, `mode=${report.playMode.mode}`);

    // --- 3/4: control the character and move -------------------------------
    const before = await page.evaluate(() => {
      const v4 = window.__v4;
      const t = v4?.player ? v4.world.getComponent(v4.player, 'transform') : null;
      const object = v4?.level?.objects?.get?.(v4?.player);
      return {
        entity: t ? [...t.position] : null,
        mesh: object ? [object.position.x, object.position.y, object.position.z] : null,
      };
    });
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1400);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => {
      const v4 = window.__v4;
      const t = v4?.player ? v4.world.getComponent(v4.player, 'transform') : null;
      const object = v4?.level?.objects?.get?.(v4?.player);
      return {
        entity: t ? [...t.position] : null,
        mesh: object ? [object.position.x, object.position.y, object.position.z] : null,
      };
    });
    const dist = (a, b) => (a && b ? Math.hypot(b[0] - a[0], b[2] - a[2]) : 0);
    const moved = dist(before.entity, after.entity);
    const movedMesh = dist(before.mesh, after.mesh);
    report.moved = moved;
    report.movedMesh = movedMesh;
    check('the character moves on input', moved > 0.05, `${moved.toFixed(3)} m`);
    check('the character mesh follows the entity', movedMesh > 0.05, `${movedMesh.toFixed(3)} m on screen`);

    // "Forward" must mean *away from the camera*, not a fixed world axis.
    const forward = await page.evaluate((beforePos) => {
      const v4 = window.__v4;
      const cam = v4?.renderer?.camera;
      if (!cam) return null;
      const dir = new v4.renderer.three.Vector3();
      cam.getWorldDirection(dir);
      const after = v4.world.getComponent(v4.player, 'transform').position;
      const move = [after[0] - beforePos[0], after[1] - beforePos[1], after[2] - beforePos[2]];
      const len = Math.hypot(move[0], move[2]) || 1;
      const dot = (dir.x * move[0] + dir.z * move[2]) / len;
      return { dot: Math.round(dot * 100) / 100, cameraDir: [Math.round(dir.x), Math.round(dir.z)] };
    }, before.entity);
    report.forward = forward;
    check('forward walks away from the camera', (forward?.dot ?? -1) > 0.3,
      `dot=${forward?.dot} (camera dir ${JSON.stringify(forward?.cameraDir)})`);
    await page.screenshot({ path: join(OUT, '02-moved.png') });

    // --- 5: animation state ------------------------------------------------
    const animState = await page.evaluate(() => {
      const p = window.__v4?.player;
      const c = p ? window.__v4.world.getComponent(p, 'animation') : null;
      return c?.controller?.state ?? null;
    });
    report.animationState = animState;
    check('the character has a live animation state', !!animState, animState ?? 'none');

    // --- 6: interaction -----------------------------------------------------
    const interaction = await page.evaluate(() => {
      const v4 = window.__v4;
      const interactive = v4?.world?.query('interactive') ?? [];
      if (!interactive.length) return { movedTo: false, events: 0 };
      // Walk the player onto the first interactive object. The teleport goes
      // through the character controller so the body and the transform agree.
      const target = interactive[0];
      const tt = v4.world.getComponent(target.id, 'transform');
      if (!tt) return { movedTo: false, events: 0 };
      const pos = tt.position ?? [0, 0, 0];
      if (v4.controller?.teleport) {
        v4.controller.teleport(pos[0], pos[1], pos[2] + 1.0);
      } else {
        const t = v4.world.getComponent(v4.player, 'transform');
        if (t) { t.position = [pos[0], pos[1], pos[2] + 1.0]; t.dirty = true; }
      }
      return { movedTo: true, target: target.name };
    });
    await page.waitForTimeout(300);
    const eventsBefore = await page.evaluate(() => window.__v4?.bus?.history('gameplay:interaction')?.length ?? 0);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
    const interactionEvents = await page.evaluate(() => window.__v4?.bus?.history('gameplay:interaction')?.length ?? 0);
    const newInteractionEvents = interactionEvents - eventsBefore;
    report.interaction = { ...interaction, events: interactionEvents, newEvents: newInteractionEvents };
    // Exactly one event for one key press: the frame runs several fixed
    // simulation steps after a slow frame, and every one of them used to
    // read the same key-down edge.
    check('one key press triggers exactly one interaction', newInteractionEvents === 1,
      `${newInteractionEvents} new event(s) of ${interactionEvents} total`);

    // The result of the interaction must be *shown*, not just computed.
    //
    // The assertion is made on the event payload's `result`, not on the HUD
    // text: the HUD always shows the prompt ("Open chest"), so matching the
    // prompt would pass even when the interaction produced nothing at all.
    // A prop answers with a string, an NPC with a `{speaker, text}` object.
    const shown = await page.evaluate(() => {
      const history = window.__v4?.bus?.history('gameplay:interaction') ?? [];
      const last = history[history.length - 1] ?? null;
      const result = last?.payload?.result ?? null;
      return {
        text: document.getElementById('hud')?.innerText ?? '',
        result,
        resultText: typeof result === 'string' ? result : (result?.text ?? null),
        prompt: last?.payload?.prompt ?? null,
      };
    });
    report.interactionShown = {
      hud: shown.text.replace(/\s+/g, ' ').slice(0, 160),
      result: shown.result,
    };
    check('the interaction produces a result', typeof shown.resultText === 'string' && shown.resultText.length > 0,
      `result=${JSON.stringify(shown.result)}`);
    check('the interaction result is shown in the HUD', typeof shown.resultText === 'string'
      && shown.resultText.length > 0 && shown.text.includes(shown.resultText.slice(0, 20)),
      report.interactionShown.hud);
    await page.screenshot({ path: join(OUT, '03-interaction.png') });

    // --- the player must not be able to walk into a building ----------------
    const inside = await page.evaluate(() => {
      const v4 = window.__v4;
      const id = v4?.player;
      const body = v4?.physics?.getBody?.(id);
      if (!body) return { checked: false };
      const colliders = v4.physics.colliders?.() ?? [];
      const hx = body.halfExtents?.[0] ?? 0.4;
      const hz = body.halfExtents?.[2] ?? 0.4;
      const hy = body.halfExtents?.[1] ?? 0.9;
      const hits = colliders.filter((c) => (
        body.position.x + hx > c.min.x && body.position.x - hx < c.max.x
        && body.position.z + hz > c.min.z && body.position.z - hz < c.max.z
        && body.position.y + hy > c.min.y && body.position.y - hy < c.max.y
      ));
      return { checked: true, hits: hits.map((c) => c.name), count: colliders.length };
    });
    report.insideColliders = inside;
    check('the player is not inside a building', inside.checked && inside.hits.length === 0,
      inside.hits?.length ? `inside: ${inside.hits.join(', ')}` : `${inside.count} colliders, none overlapping`);

    // --- 7: NPC behaviour ---------------------------------------------------
    const npcState = await page.evaluate(() => {
      const npc = window.__v4?.npc;
      if (!npc) return null;
      const debug = npc.debugState?.() ?? [];
      return { count: debug.length, states: [...new Set(debug.map((d) => d.state))], first: debug[0] ?? null };
    });
    report.npc = npcState;
    check('NPCs are simulated', (npcState?.count ?? 0) > 0, npcState ? `${npcState.count} NPCs, states: ${npcState.states.join(', ')}` : 'no NPC system');

    // The NPCs must move on screen too, not only in the entity data.
    const npcMesh = await page.evaluate(async () => {
      const v4 = window.__v4;
      const ids = v4?.level?.npcIds ?? [];
      const read = () => ids.map((id) => {
        const o = v4.level.objects.get(id);
        return o ? [o.position.x, o.position.z] : null;
      });
      const start = read();
      await new Promise((r) => setTimeout(r, 2500));
      const end = read();
      let moved = 0;
      for (let i = 0; i < start.length; i += 1) {
        if (!start[i] || !end[i]) continue;
        if (Math.hypot(end[i][0] - start[i][0], end[i][1] - start[i][1]) > 0.05) moved += 1;
      }
      return { total: ids.length, moved };
    });
    report.npcMesh = npcMesh;
    check('at least one NPC walks on screen', npcMesh.moved > 0, `${npcMesh.moved} of ${npcMesh.total} NPCs moved`);

    // --- 8: HUD -------------------------------------------------------------
    const hud = await page.evaluate(() => {
      const el = document.getElementById('hud');
      return { present: !!el, text: el?.innerText?.slice(0, 400) ?? '' };
    });
    report.hud = hud;
    check('the HUD renders content', hud.present && hud.text.length > 10, hud.text.replace(/\s+/g, ' ').slice(0, 90));
    await page.screenshot({ path: join(OUT, '04-hud.png') });

    // --- 9: pause / resume --------------------------------------------------
    const paused = await page.evaluate(() => {
      window.__v4.pause();
      return window.__v4.clock.paused;
    });
    await page.waitForTimeout(400);
    const resumed = await page.evaluate(() => {
      window.__v4.resume();
      return window.__v4.clock.paused;
    });
    check('pause and resume work', paused === true && resumed === false, `paused=${paused} resumed=${resumed}`);

    // The Escape key must pause and resume as well. The pause module used to
    // exist but was never wired into the app, so the key did nothing.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const keyPaused = await page.evaluate(() => window.__v4.clock.paused);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const keyResumed = await page.evaluate(() => window.__v4.clock.paused);
    report.keyboardPause = { keyPaused, keyResumed };
    check('the Escape key pauses and resumes', keyPaused === true && keyResumed === false,
      `after Escape: paused=${keyPaused}, after Escape again: paused=${keyResumed}`);

    // --- 10: save / reload --------------------------------------------------
    const saveReload = await page.evaluate(async () => {
      const name = 'slice-check';
      const doc = await window.__v4.sceneManager.save(name);
      const before = window.__v4.world.entityCount;
      await window.__v4.sceneManager.load(name);
      return { entities: doc.entities.length, before, after: window.__v4.world.entityCount };
    });
    report.saveReload = saveReload;
    check('the scene saves and reloads', saveReload.entities > 0 && saveReload.after === saveReload.entities,
      `${saveReload.entities} entities`);

    // --- 10b: the reload restores the 3D objects, not just the data --------
    // A reload has to bring the *scene* back: a prop that was moved after the
    // save must return to the place it was saved at. The mesh position is
    // read in the same synchronous block as the load, before the frame loop
    // has had a chance to sync it, so this measures the restore path itself.
    const restore = await page.evaluate(async () => {
      const v4 = window.__v4;
      const name = 'slice-objects';
      const doc = await v4.sceneManager.save(name);

      // Pick a prop that owns a 3D object.
      const propId = (v4.level?.propIds ?? []).find((id) => v4.level?.objects?.get(id));
      const mesh = propId ? v4.level.objects.get(propId) : null;
      const savedTransform = propId ? v4.world.getComponent(propId, 'transform') : null;
      const saved = savedTransform ? [...(savedTransform.position ?? [])] : null;

      // Move it away from the saved position, in the data *and* on screen.
      let moved = null;
      if (propId && mesh && saved) {
        moved = [saved[0] + 4, saved[1], saved[2] + 4];
        savedTransform.position = moved;
        savedTransform.dirty = true;
        mesh.position.set(moved[0], moved[1], moved[2]);
      }

      await v4.sceneManager.load(name);

      // Read the object straight after the load, before any frame runs.
      const restored = mesh ? [mesh.position.x, mesh.position.y, mesh.position.z] : null;
      const restoredTransform = propId ? [...(v4.world.getComponent(propId, 'transform')?.position ?? [])] : null;
      return { entities: doc.entities.length, propId, saved, moved, restored, restoredTransform };
    });
    report.objectRestore = restore;
    const restoredOk = restore.restored && restore.saved
      && Math.abs(restore.restored[0] - restore.saved[0]) < 0.001
      && Math.abs(restore.restored[1] - restore.saved[1]) < 0.001
      && Math.abs(restore.restored[2] - restore.saved[2]) < 0.001;
    check('the reload restores the 3D objects, not just the entity data', restoredOk,
      `prop #${restore.propId} saved at [${(restore.saved ?? []).map((n) => n.toFixed(1))}] `
      + `moved to [${(restore.moved ?? []).map((n) => n.toFixed(1))}] `
      + `restored to [${(restore.restored ?? []).map((n) => n.toFixed(1))}]`);

    // --- 10c: the behaviour survives the reload ----------------------------
    // Saving the *data* is not enough: the callbacks that make the world
    // react are runtime handles and are never part of the save format, so
    // they have to be re-attached when the scene comes back.
    const afterReload = await page.evaluate(() => {
      const v4 = window.__v4;
      const interactive = v4?.world?.query('interactive') ?? [];
      const target = interactive.find((e) => e.name?.toLowerCase().includes('chest')) ?? interactive[0];
      if (!target) return { movedTo: false };
      const tt = v4.world.getComponent(target.id, 'transform');
      const pos = tt?.position ?? [0, 0, 0];
      // Stand exactly on the chest so it is unambiguously the nearest
      // interactive entity: a villager standing nearby would otherwise be
      // the target, and the check would measure the wrong thing.
      v4.controller?.teleport?.(pos[0], pos[1], pos[2]);
      return {
        movedTo: true,
        target: target.name,
        targetId: target.id,
        hasCallback: typeof v4.world.getComponent(target.id, 'interactive')?.onInteract === 'function',
        before: (v4.bus?.history('gameplay:interaction') ?? []).length,
      };
    });
    await page.waitForTimeout(300);
    const selected = await page.evaluate(() => ({
      targetId: window.__v4.interaction?.targetId ?? null,
      prompt: window.__v4.interaction?.prompt?.() ?? null,
      playerPosition: window.__v4.world?.getComponent?.(window.__v4.player, 'transform')?.position ?? null,
      candidates: (window.__v4.interaction?.candidates?.() ?? []).map((c) => ({
        id: c.entity.id, name: c.entity.name, distance: Number(c.distance.toFixed(2)),
      })),
    }));
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
    const afterReloadState = await page.evaluate(() => {
      const history = window.__v4?.bus?.history('gameplay:interaction') ?? [];
      const last = history[history.length - 1] ?? null;
      const result = last?.payload?.result ?? null;
      return {
        text: document.getElementById('hud')?.innerText ?? '',
        count: history.length,
        result,
        resultText: typeof result === 'string' ? result : (result?.text ?? null),
      };
    });
    const newResults = afterReloadState.count - (afterReload.before ?? 0);
    report.afterReload = {
      ...afterReload,
      selected,
      newResults,
      result: afterReloadState.result,
      text: afterReloadState.text.replace(/\s+/g, ' ').slice(0, 160),
    };
    // `newResults === 1` is part of the assertion on purpose: one press of E
    // must trigger exactly one interaction, not one per fixed simulation step.
    check('interaction still works after a reload',
      afterReload.hasCallback && selected.targetId === afterReload.targetId && newResults === 1
      && typeof afterReloadState.resultText === 'string' && afterReloadState.resultText.length > 0,
      `onInteract ${afterReload.hasCallback ? 'present' : 'MISSING'}, target #${selected.targetId}, `
      + `${newResults} new event(s), result=${JSON.stringify(afterReloadState.result)}`);

    // --- 11: performance ----------------------------------------------------
    const perf = await page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 1500));
      return { ...window.__v4.stats(), gpu: window.__v4.gpu() };
    });
    report.performance = perf;
    check('the performance readout is live', perf.frames > 0, `${perf.fps} fps, ${perf.frameMs} ms/frame, ${perf.drawCalls} draws`);
    await page.screenshot({ path: join(OUT, '05-final.png') });

    // --- 12: clean exit -----------------------------------------------------
    check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
    check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

    report.checks = checks;
    report.passed = checks.filter((c) => c.ok).length;
    report.failed = checks.filter((c) => !c.ok).length;
    await writeFile(join(OUT, 'slice-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log(`\n=== ${report.passed}/${checks.length} slice checks passed ===`);
    if (KEEP_OPEN) await new Promise((r) => setTimeout(r, 600000));
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
  return report.failed === 0 ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error('[v4/slice] harness failed:', err?.message ?? err);
  process.exit(2);
});
