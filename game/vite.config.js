import { defineConfig } from 'vite';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The asset folders the game actually loads at runtime.
 *
 * `public/assets` ALSO holds the raw library packs: the five `.zip` archives
 * and the 428 MB `extracted/` trees. Those are source material for the asset
 * curator, not game assets — nothing in `src/` or `index.html` references
 * them. Vite's default behaviour is to copy the whole `public/` tree into
 * `dist/`, which produced a 586 MB bundle. The build therefore disables
 * `publicDir` and copies only the runtime set, as static files.
 */
const RUNTIME_DIRS = ['models', 'ui', 'LICENSES'];
const RUNTIME_FILES = ['ui-assets.json'];

/**
 * The shippable build.
 *
 * Every 2D image in the user's asset library carries `licence_status:
 * unverified`, so NONE of it is cleared for public release. The 3D packs are
 * CC0-1.0 / MIT and are ship-safe. Publication therefore has to be a
 * DELIBERATE act:
 *
 *   npm run build              -> a LOCAL build that contains the 2D art and
 *                                 says so, in `dist/LICENCE-STATUS.md`.
 *   npm run build:cleared      -> the SHIPPABLE build: the unverified 2D art
 *                                 is stripped and only the cleared 3D assets
 *                                 remain.
 *
 * The game runs identically either way — the HUD is complete and correct
 * with zero 2D images.
 */
const SHIP_CLEARED = process.env.SC_SHIP_CLEARED === '1';

/**
 * Copy the runtime asset set into `dist/` after the bundle is written.
 *
 * The models (`.glb`) and the 2D art (`.png`) are copied byte-for-byte: they
 * are never bundled, never inlined and never mangled. `assetsInlineLimit: 0`
 * in the build config stops Vite from base64-ing anything it does import.
 */
function runtimeAssets() {
  return {
    name: 'sc-runtime-assets',
    apply: 'build',
    async closeBundle() {
      const pub = resolve(process.cwd(), 'public', 'assets');
      const dest = resolve(process.cwd(), 'dist', 'assets');
      if (!existsSync(pub)) {
        this.warn('public/assets is missing — the built game will have no art.');
        return;
      }
      // Replace ONLY the runtime asset slots.
      //
      // `dist/assets/` is BOTH Vite's asset output directory (the hashed
      // `index-<hash>.js` entry chunk lives there) and the destination for
      // the runtime set. Wiping the whole directory here deleted Vite's own
      // bundle, so `dist/index.html` pointed at a script that 404'd and the
      // production build never booted. Clear the individual slots instead.
      await mkdir(dest, { recursive: true });
      for (const dir of RUNTIME_DIRS) {
        const from = resolve(pub, dir);
        const to = resolve(dest, dir);
        await rm(to, { recursive: true, force: true });
        if (!existsSync(from)) continue;
        await cp(from, to, { recursive: true });
      }
      for (const file of RUNTIME_FILES) {
        const from = resolve(pub, file);
        const to = resolve(dest, file);
        await rm(to, { force: true });
        if (!existsSync(from)) continue;
        await cp(from, to);
      }
      // A one-line note so nobody wonders where the library packs went.
      await writeFile(resolve(dest, 'README.txt'),
        'SuperCitycon runtime assets.\n'
        + '  models/     — the 128 .glb library models (CC0-1.0 / MIT) + characters\n'
        + '  ui/         — the 2D HUD icons\n'
        + '  ui-assets.json — the 2D icon manifest the HUD loads at runtime\n'
        + '  LICENSES/   — the licence texts for the 3D packs\n'
        + 'The raw library archives and their extracted trees are source material\n'
        + 'and are deliberately NOT shipped.\n', 'utf8');
      await verifyDistEntry();
      await applyLicencePolicy();
      await reportDist();
    },
  };
}

/**
 * Apply the licence policy to the finished build.
 *
 * In a cleared build the unverified 2D art is REMOVED from `dist/`, so the
 * bundle cannot ship by accident. Either way the build states its licence
 * position in `dist/LICENCE-STATUS.md`.
 */
async function applyLicencePolicy() {
  const dist = resolve(process.cwd(), 'dist');
  const uiDir = resolve(dist, 'assets', 'ui');
  const uiManifest = resolve(dist, 'assets', 'ui-assets.json');

  if (SHIP_CLEARED) {
    await rm(uiDir, { recursive: true, force: true });
    await rm(uiManifest, { force: true });
  }

  // The gate asserts BOTH halves of the unverified art. Checking only the
  // manifest would let a failed directory removal pass silently and ship
  // orphan PNGs in a bundle that claims to be ship-safe.
  const manifestStillThere = existsSync(uiManifest);
  const dirStillThere = existsSync(uiDir);
  if (SHIP_CLEARED && (manifestStillThere || dirStillThere)) {
    // A shippable command must never succeed while shipping unverified art.
    const left = [dirStillThere ? uiDir : null, manifestStillThere ? uiManifest : null]
      .filter(Boolean).join(', ');
    throw new Error(
      '[build] the cleared build still contains the unverified 2D art '
      + `(${left}). The build is FAILED — refusing to ship it.`,
    );
  }
  const lines = [];
  lines.push('# Licence status of this build');
  lines.push('');
  if (SHIP_CLEARED) {
    lines.push('**SHIP-SAFE BUILD.** The unverified 2D art has been removed from this bundle.');
  } else {
    lines.push('**LOCAL BUILD — this bundle contains 2D art whose licence is NOT cleared.**');
    lines.push('Do not publish it. Run `npm run build:cleared` for a shippable bundle.');
  }
  lines.push('');
  lines.push('## What is in this build');
  lines.push('');
  lines.push('| Asset set | Licence | Status |');
  lines.push('|---|---|---|');
  lines.push('| KayKit City Builder Bits (41 city models) | CC0-1.0 | cleared |');
  lines.push('| Avramania Nature & Terrain (41 nature models) | CC0-1.0 | cleared |');
  lines.push('| Holokat Game Assets (46 service/prop models) | MIT | cleared |');
  lines.push('| KayKit Adventurers + Character Animations (6 characters) | CC0-1.0 | cleared |');
  lines.push('| Quaternius Ultimate Animated Character (14 citizens) | CC0-1.0 | cleared |');
  lines.push('| Quaternius Ultimate Animated Animals (8 creatures) | CC0-1.0 | cleared |');
  lines.push('| KayKit Skeletons (2 undead) | CC0-1.0 | cleared |');
  lines.push(`| 2D HUD icons (82 images) | unverified | ${(manifestStillThere || dirStillThere) ? 'PRESENT — not cleared for release' : 'removed from this build'} |`);
  lines.push('');
  lines.push('## The 2D art');
  lines.push('');
  lines.push('Every 2D record in the user\'s asset library carries `licence_status: "unverified"`.');
  lines.push('None of it has been cleared for public release, so it is never presented as');
  lines.push('cleared: the HUD shows "LICENCE CLEARANCE PENDING" on screen whenever the art');
  lines.push('is loaded, and the 3D licence texts ship in `assets/LICENSES/`.');
  lines.push('');
  lines.push('The game is COMPLETE and CORRECT with zero 2D images — every icon slot falls');
  lines.push('back to its CSS/text treatment — so the cleared build loses no function.');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  await writeFile(resolve(dist, 'LICENCE-STATUS.md'), lines.join('\n'), 'utf8');

  // A local build carries a marker file in the bundle root: whoever picks the
  // bundle up cannot miss it.
  const marker = resolve(dist, 'DO-NOT-PUBLISH.txt');
  if (SHIP_CLEARED) {
    await rm(marker, { force: true });
  } else {
    await writeFile(marker,
      'DO NOT PUBLISH THIS BUNDLE.\n\n'
      + 'It contains 82 2D images from the user\'s asset library. Every one of\n'
      + 'them carries licence_status "unverified" — none has been cleared for\n'
      + 'public release.\n\n'
      + 'To build a publishable bundle:\n'
      + '    npm run build:cleared\n\n'
      + 'See LICENCE-STATUS.md in this folder for the full position.\n', 'utf8');
  }

  console.log(`[build] licence policy: ${SHIP_CLEARED ? 'CLEARED (2D art stripped)' : 'LOCAL (2D art included, unverified)'}`);
}

/**
 * HARD GATE: every asset `dist/index.html` references must exist on disk.
 *
 * This is the check that catches the class of bug where a plugin deletes
 * Vite's own bundle output and leaves the HTML pointing at a 404. The build
 * must not "succeed" with a missing entry chunk — the built game would be a
 * blank page that looks perfectly fine in the build log.
 */
async function verifyDistEntry() {
  const out = resolve(process.cwd(), 'dist');
  const htmlPath = resolve(out, 'index.html');
  if (!existsSync(htmlPath)) {
    throw new Error('[build] dist/index.html is missing — the build produced no page.');
  }
  const html = await readFile(htmlPath, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)]
    .map((m) => m[1])
    .filter((u) => !/^(https?:|data:|#|mailto:)/.test(u));
  const missing = [];
  for (const ref of refs) {
    const clean = ref.split('?')[0].split('#')[0];
    const abs = resolve(out, clean.replace(/^\.\//, ''));
    if (!existsSync(abs)) missing.push(ref);
  }
  if (missing.length) {
    throw new Error(
      `[build] dist/index.html references ${missing.length} file(s) that do not exist:\n`
      + missing.map((m) => `  - ${m}`).join('\n')
      + '\nThe built game would boot to a 404. Fix the build before shipping.',
    );
  }
  console.log(`[build] verified ${refs.length} referenced file(s) in dist/index.html — all present.`);
}

/** Report what actually landed in `dist/`, so the build log is evidence. */
async function reportDist() {
  const out = resolve(process.cwd(), 'dist');
  if (!existsSync(out)) return;
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = resolve(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
  const files = walk(out);
  const byExt = new Map();
  let bytes = 0;
  for (const f of files) {
    const s = await stat(f);
    bytes += s.size;
    const ext = f.slice(f.lastIndexOf('.'));
    const entry = byExt.get(ext) ?? { count: 0, bytes: 0 };
    entry.count += 1;
    entry.bytes += s.size;
    byExt.set(ext, entry);
  }
  const parts = [...byExt.entries()]
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .map(([ext, e]) => `${ext} ${e.count} (${(e.bytes / 1048576).toFixed(1)} MB)`);
  console.log(`\n[dist] ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB total`);
  console.log(`[dist] by extension: ${parts.join(', ')}`);
}

export default defineConfig(({ command }) => ({
  // The dev server serves the whole `public/` tree (that is where the asset
  // curator works). The build serves only the runtime set — see below.
  publicDir: command === 'serve' ? 'public' : false,
  base: './',
  server: { port: 5173, strictPort: false },
  build: {
    target: 'es2020',
    outDir: 'dist',
    // Never inline anything: the .glb models and the .png icons must stay
    // separate files that a browser can fetch, range-request and cache.
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    reportCompressedSize: false,
  },
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.bin', '**/*.png'],
  plugins: [runtimeAssets()],
}));
