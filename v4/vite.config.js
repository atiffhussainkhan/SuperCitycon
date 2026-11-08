import { defineConfig } from 'vite';

/**
 * V4 — build configuration.
 *
 * The app root is `v4/`. The cleared 3D models live in `v4/public/assets`
 * (populated by `scripts/prepare-assets.mjs`), so the bundle never carries
 * the quarantined 2D art.
 */
export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 4180,
    strictPort: true,
    fs: { allow: ['..'] },
  },
  preview: {
    port: 4180,
    strictPort: true,
  },
});
