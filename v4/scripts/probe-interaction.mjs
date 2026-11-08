#!/usr/bin/env node
/**
 * V4 — diagnostic probe for the interaction system.
 *
 * Dumps every interactive entity, which one the interaction system has
 * selected as the target, and what the last interaction payload actually
 * contained. It exists because the acceptance harness once reported a
 * passing interaction check while the payload carried no result at all:
 * the HUD had shown the *prompt*, which is always there.
 *
 * Usage:
 *   node scripts/probe-interaction.mjs [--url <url>] [--port 4180]
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChromium } from '../../tools/playwright-resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const V4 = resolve(HERE, '..');
const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const PORT = Number(argOf('port', 4182));
const EXTERNAL_URL = argOf('url', null);

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
  let server = null;
  let url = EXTERNAL_URL;
  if (!url) {
    server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      cwd: V4, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', () => {});
    server.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
    url = `http://127.0.0.1:${PORT}/`;
    if (!(await waitForServer(url))) throw new Error(`the preview server did not come up at ${url}`);
  }

  const { chromium } = await resolveChromium();
  const browser = await chromium.launch({
    headless: true,
    chromiumSandbox: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.body?.getAttribute('data-v4-ready') === '1', { timeout: 60000 });
    await page.waitForTimeout(800);

    // Play, so the interaction system has a player to look around from.
    await page.evaluate(() => window.__v4.setMode?.('play'));
    await page.waitForTimeout(500);

    const dump = await page.evaluate(() => {
      const v4 = window.__v4;
      const entities = v4.world.query('interactive').map((e) => {
        const data = v4.world.getComponent(e.id, 'interactive');
        const t = v4.world.getComponent(e.id, 'transform');
        return {
          id: e.id,
          name: e.name,
          prompt: data?.prompt ?? null,
          kind: data?.kind ?? null,
          once: !!data?.once,
          hasCallback: typeof data?.onInteract === 'function',
          position: t?.position ?? null,
        };
      });
      return {
        entities,
        player: v4.player,
        playerPosition: v4.world.getComponent(v4.player, 'transform')?.position ?? null,
        npcIds: v4.level?.npcIds ?? [],
        propIds: v4.level?.propIds ?? [],
      };
    });

    console.log('\n=== interactive entities ===');
    for (const e of dump.entities) {
      console.log(`  #${e.id} ${e.name} kind=${e.kind} prompt=${JSON.stringify(e.prompt)} once=${e.once} `
        + `callback=${e.hasCallback ? 'yes' : 'NO'} pos=${JSON.stringify(e.position)}`);
    }
    console.log(`player #${dump.player} at ${JSON.stringify(dump.playerPosition)}`);
    console.log(`npcIds=${JSON.stringify(dump.npcIds)} propIds=${JSON.stringify(dump.propIds)}`);

    // Walk to the chest and see what the interaction system actually picks.
    const chest = dump.entities.find((e) => e.kind === 'chest');
    const targeted = await page.evaluate(async (chestPos) => {
      const v4 = window.__v4;
      v4.controller?.teleport?.(chestPos[0], chestPos[1], chestPos[2]);
      await new Promise((r) => setTimeout(r, 300));
      const target = v4.interaction?.target ?? null;
      const candidates = (v4.interaction?.candidates?.() ?? []).map((c) => ({
        id: c.entity.id, name: c.entity.name, distance: Number(c.distance.toFixed(2)),
      }));
      return {
        targetId: v4.interaction?.targetId ?? null,
        targetName: target?.name ?? null,
        prompt: v4.interaction?.prompt?.() ?? null,
        candidates,
      };
    }, chest.position);
    console.log('\n=== target at the chest ===');
    console.log(`  targetId=${targeted.targetId} (${targeted.targetName}) prompt=${JSON.stringify(targeted.prompt)}`);
    console.log(`  candidates=${JSON.stringify(targeted.candidates)}`);

    const before = await page.evaluate(() => ({
      interaction: (window.__v4.bus?.history('gameplay:interaction') ?? []).length,
      lines: (window.__v4.bus?.history('npc:line') ?? []).length,
    }));
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => {
      const history = window.__v4.bus?.history('gameplay:interaction') ?? [];
      const last = history[history.length - 1] ?? null;
      return {
        interaction: history.length,
        lines: (window.__v4.bus?.history('npc:line') ?? []).length,
        last,
        hud: document.getElementById('hud')?.innerText ?? '',
      };
    });
    console.log('\n=== after pressing E ===');
    console.log(`  interaction events ${before.interaction} -> ${after.interaction}`);
    console.log(`  npc:line events    ${before.lines} -> ${after.lines}`);
    console.log(`  last payload       ${JSON.stringify(after.last)}`);
    console.log(`  hud                ${after.hud.replace(/\s+/g, ' ').slice(0, 160)}`);

    // Call the NPC system directly and report what it returns or throws.
    const direct = await page.evaluate(() => {
      const v4 = window.__v4;
      const out = {};
      try {
        out.npcInteract = v4.npc?.interact?.(12);
      } catch (err) {
        out.npcInteractError = `${err?.name}: ${err?.message}`;
      }
      try {
        const entity = v4.world.get(12);
        const data = entity?.components?.get('interactive');
        out.hasCallback = typeof data?.onInteract === 'function';
        out.directCallback = data?.onInteract?.(entity, { source: 'probe' });
      } catch (err) {
        out.callbackError = `${err?.name}: ${err?.message}`;
      }
      try {
        out.interactionInteract = v4.interaction?.interact?.();
      } catch (err) {
        out.interactionError = `${err?.name}: ${err?.message}`;
      }
      return out;
    });
    console.log('\n=== direct calls ===');
    console.log(`  ${JSON.stringify(direct, null, 2).split('\n').join('\n  ')}`);

    // Now the reload case: save, load, and see whether the player can still
    // be moved and whether the interaction target follows.
    const afterLoad = await page.evaluate(async () => {
      const v4 = window.__v4;
      const chest = v4.world.query('interactive').find((e) => e.name === 'Chest');
      const pos = () => (v4.world.getComponent(v4.player, 'transform')?.position ?? null);
      const out = {};

      // 1. Move the player far away, so a later no-op cannot look like a move.
      v4.controller?.teleport?.(12, 0.9, 12);
      await new Promise((r) => setTimeout(r, 400));
      out.afterFarMove = pos();

      // 2. Save and load.
      await v4.sceneManager.save('probe-reload');
      await v4.sceneManager.load('probe-reload');
      await new Promise((r) => setTimeout(r, 400));
      out.afterLoad = pos();

      // 3. Teleport onto the chest and see whether it sticks.
      const chestPos = v4.world.getComponent(chest.id, 'transform')?.position ?? [0, 0, 0];
      out.chestPos = chestPos;
      v4.controller?.teleport?.(chestPos[0], chestPos[1], chestPos[2]);
      await new Promise((r) => setTimeout(r, 400));
      out.afterTeleport = pos();

      const body = v4.physics?.getBody?.(v4.player);
      out.body = body ? { x: body.position.x, y: body.position.y, z: body.position.z } : null;
      out.candidates = (v4.interaction?.candidates?.() ?? []).map((c) => ({
        id: c.entity.id, name: c.entity.name, distance: Number(c.distance.toFixed(2)),
      }));
      out.targetId = v4.interaction?.targetId ?? null;
      out.playerEntityId = v4.player;
      return out;
    });
    console.log('\n=== after a save + load ===');
    console.log(`  ${JSON.stringify(afterLoad, null, 2).split('\n').join('\n  ')}`);
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
