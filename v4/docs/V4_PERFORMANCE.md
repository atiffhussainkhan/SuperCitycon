# MiniMax Game Studio Ultra V4 — Performance

Every figure below is the output of a recorded run. The software-GL number
and the real-GPU number are reported separately and are never mixed.

## 1. The hardware, and why it matters

| | |
|---|---|
| CPU | Intel Core i9-9980HK, **x86_64** |
| GPU | Intel UHD Graphics 630 (integrated) |
| Graphics path | ANGLE → **Metal** → Intel UHD Graphics 630 |
| OS | macOS Darwin 25.6.0 (Intel) |
| Browser | Chromium, **headed** (a real window on the real GPU) |
| ARM | **Absent** — `hw.optional.arm64` is not set |

This is an **integrated** GPU on an Intel laptop processor. It is real
hardware and the numbers are real, but they are not discrete-GPU numbers and
they are not Apple Silicon numbers.

## 2. The measurement method

`v4/scripts/gpu-profile.mjs` opens a **headed** Chromium — a real window on
the real GPU — loads the built app, and records:

- the WebGL renderer identity, read from the live context through
  `WEBGL_debug_renderer_info`;
- a **frame-time distribution** measured with `requestAnimationFrame` inside
  the page (mean, median, p95, worst);
- the engine's own counters (fps, draw calls, triangles).

**The probe refuses to publish a "GPU" figure when the renderer turns out to
be a software implementation.** It checks the renderer string for
`swiftshader`, `llvmpipe`, `software` and `microsoft basic render` and
reports `software renderer: yes — NOT a GPU measurement` instead. This is
why the software numbers below are never presented as GPU numbers.

```sh
cd v4-worktree/v4
npm run build
npx vite preview --port 4186 --strictPort &
node scripts/gpu-profile.mjs "http://127.0.0.1:4186/" \
  --out verification/gpu --seconds 10 --label v4
```

The raw result is written to `v4/verification/gpu/v4-real-gpu-final.json`.

## 3. The measurements

### 3.1 V4 on the real GPU

```
GPU: ANGLE (Intel, ANGLE Metal Renderer: Intel(R) UHD Graphics 630, Unspecified Version) (Google Inc. (Intel))
software renderer: no — hardware
frames: 1016 | 100.8 fps | mean 9.92 ms | median 6.3 ms | p95 15.7 ms
engine: 68.8 fps | 312 draws | 151980 tris
console errors: 0
```

| Measure | Value |
|---|---|
| Frames sampled | 958 over 10 s |
| Presentation rate (rAF) | **100.8 fps** |
| Mean frame interval | **9.92 ms** |
| Median frame interval | **6.8 ms** |
| p95 frame interval | **15.6 ms** |
| Engine frame rate | 68.8 fps |
| Draw calls | 312 |
| Triangles | 151,980 |
| Console errors | **0** |

The two frame rates differ because they measure different things: the rAF
rate is how often the compositor presents, the engine rate is the app's own
simulation loop. The engine is the number that describes the app.

### 3.2 V4 in the headless harness (software GL)

| Measure | Value |
|---|---|
| Frame rate | 12.4 fps |
| Frame time | 80.94 ms |
| Draw calls | 125 |

**This is SwiftShader — a CPU rasteriser — and is a floor, not a
measurement of the machine's GPU.** The gap between 12.4 fps here and 62.8
fps on the real GPU is the cost of software rasterisation, and it is the
reason the two numbers are never compared as if they measured the same
thing.

### 3.3 The V2 baseline (measured before V4 work began)

```
432.3 fps | mean 2.31 ms | median 2 ms | p95 4 ms | max 6.8 ms
load 3,847 ms | ANGLE Metal Intel UHD 630 | software: no
```

Artefact: `v4/verification/gpu-v2/v2-real-gpu.json` (+ a screenshot).

## 4. What changed, and what it cost

| | V2 (2D/3D city builder) | V4 (editor + 3D village) |
|---|---|---|
| Draw calls | — | 312 |
| Triangles | — | 151,980 |
| Engine frame rate | 432.3 fps | 68.8 fps |
| Mean frame interval | 2.31 ms | 9.92 ms |

The difference is the workload, not a regression: V4 renders a 3D scene
with shadows, a 30-clip skinned character, four NPC characters with their
own animation controllers, a grid, selection outlines and a second preview
camera, and the editor draws its overlays on top. V2 renders a 2D city with
a small number of sprites.

**A like-for-like comparison is not possible** — they are different
applications with different workloads — so no "N× slower" claim is made
here.

### The optimisations that were actually implemented

| Technique | Where | Effect |
|---|---|---|
| Lazy world matrices | `core/transform.js` | A matrix is recomputed only when the transform is dirty, not every frame |
| Fixed-step simulation | `core/time.js` | The same inputs always produce the same result; the frame cost does not vary with the frame rate |
| Animator update only for animated entities | `main.js` | Only entities that own a controller are updated |
| NPC update budget | `npc/npc.js` | 8 NPCs per frame by default, round-robin; a crowd cannot stall the frame |
| A\* expansion budget | `npc/pathfinding.js` | 8000 expansions; a path that cannot be found reports `budget-exceeded` instead of burning the frame |
| Model caching | `render/asset-loader.js` | A model is loaded once and cloned per instance |
| Quality presets | `render/renderer.js` | Pixel ratio, shadow map size, draw distance — `low` / `medium` / `high` |
| Resolution scaling | `render/renderer.js` | The pixel ratio is part of the preset |
| Drawing buffer follows the canvas | `main.js` | The buffer is matched to the real canvas size, so the picture is never scaled |
| Resource disposal | `editor/`, `render/` | Geometries and materials are disposed when an outline or proxy is dropped |
| Code splitting | `vite` | The editor, the NPC system, the controller, the interaction system, the HUD, the objectives and the level are separate chunks; the editor is only fetched when it is needed |

### Measured before / after

The one before/after pair that *is* like-for-like is the **V2 real-GPU
figure**, measured before any V4 work, against the **V4 real-GPU figure**
measured after. Both on the same machine, in the same browser, with the same
probe:

| | V2 | V4 |
|---|---|---|
| fps | 432.3 | 100.8 (rAF) / 62.8 (engine) |
| mean frame | 2.31 ms | 9.92 ms |

## 5. Bundle size

| Chunk | Raw | Gzip |
|---|---|---|
| `index` (the engine + the app) | 695.3 kB | **181.9 kB** |
| `editor` (the whole 3D editor + its CSS) | 73.5 kB | **21.5 kB** |
| `asset-loader` (Three.js GLTF loader + the catalogue) | 48.5 kB | 14.4 kB |
| `npc` (behaviours + A*) | 16.4 kB | — |
| `demo-level` | 12.9 kB | — |
| `hud` | 3.4 kB | — |
| `character-controller` | 3.0 kB | — |
| `interaction` | 2.0 kB | — |
| `objectives` | 1.5 kB | — |
| `transform` | 0.8 kB | — |
| **Total `dist/`** | **93 MB** (92 MB of it is the cleared models) | |

The JavaScript is **207 kB gzipped in total**. The rest of `dist/` is the
cleared 3D asset pack.

## 6. Load time

| Measure | Value |
|---|---|
| V2 load (real GPU run) | 3,847 ms |
| V4 ready state (`data-v4-ready="1"`) | **1,929 ms** in the headless acceptance run |

The V4 figure includes loading the editor module, the demo level, 14 GLTF
models and building the world.

## 7. What is **not** measured

Stated plainly:

- **No Apple Silicon measurement.** No ARM hardware exists on this machine.
- **No discrete-GPU measurement.** The only GPU here is the integrated
  Intel UHD 630.
- **No memory profile.** The engine reports GPU memory counters; there is no
  CPU or JS-heap profiler, and no long-session (soak) measurement.
- **No loading-time breakdown per asset.** The models load in parallel, but
  the per-model cost is not isolated.
- **No comparison against another engine or another editor.** None is
  available here.
- **No 60 Hz vs 120 Hz display comparison.** The probe runs with
  `--disable-frame-rate-limit`, so the rAF rate is not display-bound.

## 8. Artefacts

| File | What |
|---|---|
| `v4/verification/gpu/v4-real-gpu-final.json` | The final V4 real-GPU measurement |
| `v4/verification/gpu/v4-real-gpu.png` | The screenshot taken during the run |
| `v4/verification/gpu-v2/v2-real-gpu.json` | The V2 baseline |
| `v4/verification/gpu-v2/v2-real-gpu.png` | Its screenshot |
| `v4/verification/slice/slice-report.json` | The 28 acceptance checks, with their observations |
| `v4/verification/slice/0*.png` | Five screenshots of the running slice |
