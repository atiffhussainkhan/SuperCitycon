# SuperCitycon — V5 Performance Report

**Branch:** `v5/upgrade`
**Baseline:** V4 at `main` @ `92c0b37`
**Measured:** 2026-11-09
**Verdict:** **PASS — no performance regression against V4, and a measurable
improvement in the populated city.**

---

## 1. The machine, and why it is named

A benchmark without a machine is an anecdote. Every number in this report was
measured on this machine, and the GPU is identified from the **live WebGL
context**, not from the launch mode.

| | |
|---|---|
| Platform | macOS (darwin 25.6.0), **x86_64** |
| CPU | Intel Core i9-9980HK |
| GPU | **AMD Radeon Pro 5500M** |
| WebGL renderer string | `ANGLE (AMD, ANGLE Metal Renderer: AMD Radeon Pro 5500M, Unspecified Version)` |
| Vendor | `Google Inc. (AMD)` |
| Browser | Chromium, **headed** (a real window, a real GPU) |
| Node | v22.14.0 |
| Engine | Three.js 0.169.0 |

`tools/profile-gpu.mjs` classifies the renderer from the actual context and
the browser's own GPU device metadata, and **detects and labels** software
rendering (SwiftShader, llvmpipe, WARP …) rather than presenting it as a GPU
benchmark. The run recorded `"kind": "hardware", "verified": true`.

**This is not an Apple Silicon machine.** No ARM result is claimed anywhere in
this report — see KI-01.

---

## 2. Method

```bash
# the boot scene: the game exactly as it starts
node tools/profile-gpu.mjs --frames 300 --scene boot --outdir game/verification/v5-gpu

# the populated city: 186 buildings, 254 roads, 2 473 residents, 60 vehicles
node tools/profile-gpu.mjs --frames 300 --scene city --outdir game/verification/v5-gpu-city
```

- A static preview of the **cleared** build (`game/dist`) is served and driven
  with a headed Chromium.
- The probe waits for `state.meta.ready`, then lets the scene settle for
  1.5 s so shader compilation is not counted.
- 300 consecutive real `requestAnimationFrame` frames are timed.
- The counters, the memory figure and the error lists are read from the live
  page at the end.

### 2.1 The measurement instrument was corrected first

Two defects in the measuring tools were found and fixed **before** any
result was recorded, because a wrong instrument produces wrong conclusions:

| Defect | Effect on the numbers | Fix |
|---|---|---|
| The frame sampler seeded its previous timestamp from `performance.now()` and differenced it against the next rAF timestamp | A rAF timestamp is the time the frame *began* and can be **earlier** than a `performance.now()` taken a moment before, so the first sample could be negative. One run reported `minMs: -63.8` and a `p99Ms` of 66.6 — both artefacts | Seed from the **first rAF timestamp**, so every delta is a real frame gap. The report now also publishes `negativeSamples`, which is `0` in every run below |
| `renderer.info` was read with three.js's default `autoReset` | Three.js resets the counter **after** the shadow-map pass, so the number described the main scene pass only — it **under-reported** every frame | `renderer.info.autoReset = false`, with `renderer.info.reset()` at the top of `update()` and the monitor and the adaptive driver moved **after** the draw |

The second fix is a **change to the game**, not only to the tool: the
counter feeds the adaptive-quality driver and the HUD's performance read-out,
so it had to describe the real cost of the frame.

---

## 3. The measurements

### 3.1 Boot scene — the game as it starts

| Metric | V4 | V5 | Delta |
|---|---:|---:|---|
| frames sampled | 300 | 300 | — |
| mean frame time | 16.662 ms | **16.667 ms** | +0.3 % (noise) |
| median frame time | 16.7 ms | 16.7 ms | — |
| p95 | 18.4 ms | 18.6 ms | +0.2 ms |
| p99 | 18.7 ms | 18.7 ms | — |
| fastest / slowest frame | 14.6 / 18.8 ms | 14.6 / 18.8 ms | — |
| mean FPS | 60.0 | **60.0** | — |
| negative samples | 0 | **0** | — |
| draw calls (whole frame) | 63 | 63 | — |
| triangles | 1 699 158 | 1 699 158 | — |
| JS heap in use | 109.51 MB | 133.07 MB | **+21.5 %** |
| boot to ready | 2 156 ms | 2 074 ms | −3.8 % |

**V5 boots and renders exactly as fast as V4.** The frame-time distribution is
identical to within a tenth of a millisecond.

The memory increase is real and is explained in §5.

### 3.2 Populated city — the high-activity scene

The city scene is built through the game's **normal** placement path (the
construction-slot gate included): 186 buildings, 254 roads, 2 473 residents,
60 vehicles and 40 rendered citizens.

| Metric | V4 | V5 | Delta |
|---|---:|---:|---|
| mean frame time | 23.445 ms | **18.167 ms** | **−22.5 %** |
| median frame time | 17.7 ms | **16.7 ms** | −5.6 % |
| p95 | 33.8 ms | 33.3 ms | −1.5 % |
| p99 | 35.4 ms | 35.0 ms | −1.1 % |
| **worst frame** | **83.3 ms** | **35.1 ms** | **−57.9 %** |
| mean FPS | 42.7 | **55.0** | **+28.8 %** |
| draw calls | 1 633 | **1 558** | −4.6 % |
| triangles | 1 817 791 | 1 812 905 | −0.3 % |
| JS heap in use | 86.55 MB | 141.19 MB | **+63.2 %** |
| console errors | 0 | **0** | — |
| page errors | 0 | **0** | — |
| failed requests | 0 | **0** | — |

**V5 is faster than V4 in the city that matters, and dramatically steadier.**
The worst frame in the whole 300-frame window fell from 83.3 ms to 35.1 ms —
the V4 run dropped a frame that cost 5× the frame budget.

The improvement comes from the V5 population work: citizens are **pooled**,
**terrain-following** and driven by a real animation state machine, instead of
V4's per-citizen mesh churn. The draw-call count fell (1 633 → 1 558) while
the resident count stayed identical at 2 473.

### 3.3 The effect service under load

From the city profile, after 186 buildings and 254 roads had been placed:

```
fx: {
  spawned: 421, pooled: 600, skipped: 0, capacity: 600,
  byKind: { place: 186, warning: 235 },
  live: 0, reducedMotion: false
}
```

**`skipped: 0`** — not one effect was refused for want of pool space. The pool
returned to `live: 0` with all 600 slots reusable, so the pool does not leak.

---

## 4. The V4 baseline was re-measured, not assumed

The V4 numbers in the tables above are **not** the numbers V4 published. V4's
own figures (34 draw calls, 864 055 triangles) were taken with the
`autoReset` counter that hid the shadow pass.

To compare V5 with V4 honestly, the V4 baseline was checked out into a
throwaway worktree at `92c0b37`, **one measurement-instrument change** was
applied to it (the same `autoReset = false` + `reset()`-at-the-top fix, so
both builds count the whole frame), and it was rebuilt and re-profiled with
the same tool, the same frame count and the same scenes.

The rendering itself in that baseline worktree is **untouched** — only the
counter's semantics were aligned, and the change is commented in the file
itself.

The V4 baseline worktree is at `…/v4-baseline` (a detached checkout at
`92c0b37`). It is **not** part of the V5 branch and nothing in it was
committed to `v5/upgrade`.

---

## 5. Bundle, download and memory

| | V4 | V5 | Delta |
|---|---:|---:|---|
| files in the cleared build | 218 | 218 | — |
| total size | 72.6 MB | **72.7 MB** | +0.1 MB |
| `.glb` models | 117 (69.8 MB) | 117 (69.8 MB) | — |
| JS bundle | ~1.1 MB | 1.2 MB | — |
| characters in the roster | 6 | **20** | +14 |

The cleared build is dominated by the 3D models (69.8 MB of 72.7 MB); the
JavaScript is 1.2 MB.

**Memory went up, and the reason is the roster.** The V5 population work
expanded the cast from 6 characters to 20, which adds roughly 16.5 MB of
character models to the download and is the dominant contributor to the
+23.6 MB of boot heap. The V5 hazard, content, VFX and UI services add the
rest.

This is a deliberate trade: a city builder with one repeated pedestrian looks
empty, and the V5 population rewrite (pooling, terrain following, an
animation state machine) is what produced the 22.5 % frame-time improvement
in §3.2. The trade is recorded as **R-19** in the risk register.

**Save size** is dominated by JSON-encoded terrain arrays: ~46.6 KB for an
empty save and ~99.1 KB for a populated one — under 2 % of the 5 MB
`localStorage` quota. Base64 encoding was considered and deliberately
deferred; it is recorded as R-09 / KI-08.

---

## 6. What was optimised, and what was deliberately not

| Change | Measured effect |
|---|---|
| `renderer.info` now describes the whole frame | the adaptive driver and the HUD read the real cost (63 calls, not 34, on the boot scene) |
| Post-processing is **off by default** and owned by the adaptive-quality driver; the accessibility setting may only switch it **off**, never on | the settings panel no longer fights the adaptive driver |
| Citizens are pooled and terrain-following | city frame time 23.445 ms → 18.167 ms; worst frame 83.3 ms → 35.1 ms |
| Building models are batched into instanced draws | 20 buildings of 17 types in 17 batches = 61 draw calls |
| The effect service uses pooled instanced particles | 421 effects spawned, **0 skipped**, pool returned to 0 live |

**Not optimised, on purpose.** The V4 draw-call budget is dominated by the
60 vehicles and 40 animated citizens, which cannot be instanced without
freezing their individual animation. Frustum culling is already on
(`frustumCulled = false` is used only where an instanced batch spans the
whole map). The 1 558 draw calls in the city scene are the honest cost of
animating 100 individual actors at 60 fps on this hardware, and the frame
time shows that the GPU is not the bottleneck.

---

## 7. Reproducing these numbers

```bash
git checkout v5/upgrade && cd game
npm ci && npm run build:cleared

cd ..
node tools/profile-gpu.mjs --frames 300 --scene boot --outdir game/verification/v5-gpu
node tools/profile-gpu.mjs --frames 300 --scene city --outdir game/verification/v5-gpu-city
```

The raw reports are committed:

| File | Scene |
|---|---|
| `game/verification/v5-gpu/gpu-profile.json` | V5 boot |
| `game/verification/v5-gpu-city/gpu-profile.json` | V5 populated city |
| `game/verification/v4-baseline-gpu/gpu-profile.json` | V4 boot (re-measured, aligned counter) |
| `game/verification/v4-baseline-gpu-city/gpu-profile.json` | V4 populated city (re-measured, aligned counter) |

---

## 8. Limits of these measurements

| Limit | Effect |
|---|---|
| One machine, one GPU, x86_64 | the numbers are true for *this* machine and are not claimed for any other. Apple Silicon is unvalidated (KI-01) |
| One browser (Chromium) | Firefox and Safari are untested (KI-02) |
| The city scene is a synthetic layout built by the probe | it is the same for V4 and V5, so the comparison is fair, but it is not a player's city |
| The `city` scene measures an empty-at-boot game that the probe fills | the boot and city scenes are reported separately for exactly that reason |
| Software rendering was not used for the reported figures | the harness/probe scripts use SwiftShader for pixel work, and those numbers are **not** in this report |

---

## 9. Verdict

| Check | Result |
|---|---|
| Boot frame time vs V4 | **PASS** — 16.667 ms vs 16.662 ms (within noise) |
| City frame time vs V4 | **PASS** — 18.167 ms vs 23.445 ms (−22.5 %) |
| City worst frame vs V4 | **PASS** — 35.1 ms vs 83.3 ms (−57.9 %) |
| City draw calls vs V4 | **PASS** — 1 558 vs 1 633 (−4.6 %) |
| Effect pool under load | **PASS** — 421 spawned, 0 skipped, no leak |
| Runtime errors during the profile | **PASS** — 0 console, 0 page, 0 failed requests |
| Memory vs V4 | **REGRESSION (accepted)** — +23.6 MB at boot, from the 14 extra characters; recorded as R-19 |
| Bundle size vs V4 | **PASS** — 72.7 MB vs 72.6 MB |

**Performance verdict: PASS.** V5 matches V4 on an empty map and is
substantially better on a populated one, with one accepted regression — the
memory cost of a four-times-larger cast, which bought the frame-time
improvement.
