#!/usr/bin/env node
/**
 * V4 — edit-mode camera probe.
 *
 * The editor's viewport showed only the scene background in edit mode. This
 * prints the camera pose, the scene contents and the renderer counters, so the
 * cause is measured rather than guessed.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChromium } from '../../tools/playwright-resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const V4 = resolve(HERE, '..');
const PORT = 4182;

async function waitForServer(url, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { const r = await fetch(url); if (r.ok) return true; } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: V4, stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', () => {});
server.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
const url = `http://127.0.0.1:${PORT}/`;
await waitForServer(url);

const { chromium } = await resolveChromium();
const browser = await chromium.launch({
  headless: true, chromiumSandbox: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body?.getAttribute('data-v4-ready') === '1', null, { timeout: 120000 });
  await page.waitForTimeout(1500);

  const probe = await page.evaluate(() => {
    const v4 = window.__v4;
    const cam = v4.renderer.camera;
    const scene = v4.renderer.scene;
    const kids = [];
    for (const child of scene.children) {
      kids.push({
        type: child.type,
        name: child.name || '(unnamed)',
        visible: child.visible,
        pos: [child.position.x, child.position.y, child.position.z].map((n) => Math.round(n * 100) / 100),
        children: child.children.length,
      });
    }
    const dir = new (v4.renderer.three.Vector3)();
    cam.getWorldDirection(dir);
    return {
      mode: v4.mode,
      camera: {
        pos: [cam.position.x, cam.position.y, cam.position.z].map((n) => Math.round(n * 100) / 100),
        dir: [dir.x, dir.y, dir.z].map((n) => Math.round(n * 100) / 100),
        fov: cam.fov, aspect: Math.round(cam.aspect * 100) / 100,
        near: cam.near, far: cam.far,
      },
      sceneChildren: scene.children.length,
      kids: kids.slice(0, 40),
      lights: scene.children.filter((c) => c.isLight).map((c) => ({ type: c.type, intensity: c.intensity, pos: [c.position.x, c.position.y, c.position.z] })),
      renderInfo: { ...v4.renderer.renderer.info.render },
      canvas: {
        w: v4.renderer.renderer.domElement.width,
        h: v4.renderer.renderer.domElement.height,
        cssW: v4.renderer.renderer.domElement.clientWidth,
        cssH: v4.renderer.renderer.domElement.clientHeight,
        pixelRatio: v4.renderer.renderer.getPixelRatio(),
      },
      viewport: v4.renderer.renderer.getViewport(new (v4.renderer.three.Vector4)()),
      size: v4.renderer.renderer.getSize(new (v4.renderer.three.Vector2)()),
    };
  });
  console.log(JSON.stringify(probe, null, 2));

  // Render once from a known camera to see whether the scene has content at all.
  const forced = await page.evaluate(() => {
    const v4 = window.__v4;
    const THREE = v4.renderer.three;
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
    cam.position.set(12, 9, 16);
    cam.lookAt(0, 1, 0);
    v4.renderer.renderer.setViewport(0, 0, v4.renderer.renderer.domElement.width, v4.renderer.renderer.domElement.height);
    v4.renderer.renderer.setScissorTest(false);
    v4.renderer.renderer.render(v4.renderer.scene, cam);
    return { calls: v4.renderer.renderer.info.render.calls, triangles: v4.renderer.renderer.info.render.triangles };
  });
  console.log('forced render:', JSON.stringify(forced));
  await page.screenshot({ path: join(V4, 'verification', 'diagnostics', 'edit-forced-camera.png') });
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
