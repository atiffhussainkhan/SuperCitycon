# Performance report — MiniMax Game Studio ULTRA V2

All figures below were measured on **2026-11-08** on the machine described in
`MIGRATION.md` (macOS 26.7.1, x86_64, Node 22.14.0), against the **built
licence-cleared bundle** served by `vite preview`, in headless Chromium.

**Read this before quoting a number.** The headless browser runs on a **software
GL implementation** (SwiftShader). The frame times are therefore a **floor**,
not a measurement of what a GPU delivers. They are useful for regression
detection and for comparing runs against each other. They are **not** a claim
about the game on real hardware.

---

## 1. Build

| Profile | Command | Files | Size | Build time |
|---|---|---|---|---|
| **Cleared** (publishable) | `npm run build:cleared` | 218 | 72.6 MB | 3.7 s (vite) / ~5.0 s (incl. npm) |
| Local (2D art included) | `npm run build` | 290 | 73.2 MB | 3.9 s (vite) |

Three consecutive `npm run build:cleared` invocations took **5.54 s, 4.97 s,
4.93 s** wall-clock including npm's own overhead.

The build **fails** if the bundle references a file that is not on disk:

```
[build] verified 1 referenced file(s) in dist/index.html — all present.
[build] licence policy: CLEARED (2D art stripped)
```

## 2. Bundle composition (cleared build)

| Extension | Count | Size |
|---|---|---|
| `.glb` | 117 | 69.8 MB |
| `.bin` (glTF buffers) | 41 | 1.5 MB |
| `.js` | 4 | 1.1 MB |
| `.png` | 3 | 0.0 MB |
| `.gltf` | 41 | 0.2 MB |
| `.json` | 2 | 0.0 MB |
| `.txt` | 9 | 0.0 MB |
| `.html` | 1 | 0.0 MB |
| **Total** | **218** | **72.6 MB** |

The local build adds 72 PNG files and one licence notice, for 290 files and
73.2 MB. The difference is the uncleared 2D art.

**Native executables in the bundle: 0.** It is a static web bundle.

## 3. Runtime

Measured by `tools/performance.mjs` on a city built through the real placement
gate with the real construction speed (12 buildings, 9 roads), then run for 90
seconds of game time so population and traffic exist.

| Metric | Value |
|---|---|
| Load event | **169 ms** |
| Game ready (boot complete) | **1,605 ms** |
| Population | 447 residents |
| Citizens rendered | 18 |
| Vehicles | 60 |
| Draw calls | **633** |
| Triangles | **1,124,545** |
| Scene meshes | 632 |
| Building instances → batches | 12 → 12 (**43 draw calls**) |
| Save to storage | **23.9 ms** |
| Load from storage | **27.1 ms** (12 buildings preserved) |
| Console errors | **0** |

### Frame times — 90 rendered frames, software GL

| | |
|---|---|
| Min | 11.1 ms |
| Median | **240.9 ms** (4.2 FPS) |
| p95 | 627.8 ms (1.6 FPS) |
| Max | 870.5 ms |
| Mean | 359.2 ms |

The acceptance harness reports a comparable figure for its populated city:
**405 draw calls, 1,028,617 triangles, 682 meshes**.

### Why the frame times are so low, and why that is not a defect

The headless browser has no GPU. Every frame is rasterised on the CPU by
SwiftShader, so a frame with 1.1 M triangles costs hundreds of milliseconds.
**The game advances its simulation on a fixed step** (`SUPERCITYCON.step(dt)`),
so simulation behaviour is decoupled from render speed — a slow headless frame
rate changes how long the frames take, not what the game does. The harness
deliberately drives the fixed step rather than waiting on wall-clock frames,
which is why its verdicts are meaningful despite the software renderer.

**What the numbers DO tell you, reliably:**

- The scene renders real geometry (1.1 M triangles, 633 draw calls).
- Building models are **batched**: 12 instances cost 43 draw calls, not 12 ×
  the model part count. The acceptance harness proves the stronger property —
  20 buildings of 17 types collapse into 17 batches.
- Boot to playable is ~1.6 s, and the load event is 169 ms.
- A save is ~24 ms and a load ~27 ms for a 12-building city.
- No console errors and no uncaught exceptions during the whole run.

**What they do NOT tell you:** the frame rate on a real GPU. That has not been
measured. The README's own hardware target is a 2020-class 6-core CPU with a
GTX 1650 / RX 5500XT class or better.

## 4. Dependency advisories

`npm audit` reports **2 advisories** (1 moderate, 1 high), both in **`vite` and
its transitive `esbuild`** — the build toolchain, not the game:

| Advisory | Severity | Affects | Fixed in |
|---|---|---|---|
| [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) — esbuild allows any website to send requests to the dev server and read the response | moderate | `npm run dev` | esbuild > 0.24.2 |
| [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) and a `launch-editor` issue — path traversal in optimised-deps `.map` handling | high | `npm run dev` | vite > 6.4.3 |

**Neither is present in the shipped artefact.** The bundle contains no Vite or
esbuild runtime code — the only occurrence of the string `vite` in the built
JavaScript is the `vite:preloadError` event name that Vite's build step injects
for module preload failures. Both advisories affect the **development server**,
which never ships.

**Mitigation in force today:** Vite's dev server binds to **loopback only**
(`server.host` is unset, so it defaults to `localhost`). Do not run
`npm run dev -- --host` on a shared or untrusted network. To show the game to
someone else, use the static preview (`npm run build:cleared && npm run
preview`), which serves plain files with no dev server involved.

**Why it was not upgraded.** The fix requires `vite@8.3.6` — a semver-major jump
from the pinned 5.4.x — which would mean re-verifying the whole build, the
asset pipeline and the acceptance harness against a new bundler. The pinned
Vite 5.4.21 is the stable release this project was built and verified against.
When Vite 8 is adopted deliberately, re-run the full verification.

## 5. Test-suite performance

| Suite | Duration |
|---|---|
| `npm run check` (56 files) | ~0.4 s |
| `npm test` (395 tests, 8 suites) | 2.54 s |
| `npm run verify:production` (build + 40-check browser harness) | ~40 s |
| `tools/performance.mjs` (90 frames) | ~50 s |
| `python3 tools/verify_design.py` (31 checks) | ~3 s |
| `python3 tools/fault_inject_hardened.py` (14 injections) | ~25 s |
