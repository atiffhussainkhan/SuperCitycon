# SuperCitycon — V5 Final Verification

**Product:** SuperCitycon — a retro 16-bit-palette voxel city builder for the browser
**Version:** 5.0.0
**Branch:** `v5/upgrade`
**Baseline:** V4 at `main` @ `92c0b37`
**Verified:** 2026-11-09

---

# RELEASE CLASSIFICATION: **V5 RELEASE CANDIDATE**

Not *V5 COMPLETE AND VERIFIED*, and not *PARTIALLY IMPLEMENTED* or *BLOCKED*.

**Why not COMPLETE AND VERIFIED:** exactly one release-critical condition is
unmet — the **Cursor senior review could not be run**. It was attempted four
times and failed every time with `ActionRequiredError: … You're out of usage.`
The quota is exhausted; the work itself is not blocked. The full brief for
that review is in `CURSOR-HANDOFF.md`, and the review can be run against this
exact branch without any further code changes.

**Why not PARTIALLY IMPLEMENTED or BLOCKED:** every implementation phase was
completed and verified. 687 tests pass, the V4 baseline is intact, the build
reproduces, the acceptance harness passes against the built bundle, the
production bundle is verified, and the game was measured on a real GPU. The
remaining items are **environment limitations** (no ARM machine, no second
browser or OS, no Cursor quota) and **scope decisions that were stated, not
hidden** (see §6).

---

## 1. Release identity

| Field | Value |
|---|---|
| **Product** | SuperCitycon — a retro 16-bit-palette voxel city builder for the browser |
| **Version** | 5.0.0 |
| **Source revision** | `v5/upgrade` branch tip — see §2 |
| **Baseline revision** | `92c0b37` (`main`, the V4 release) |
| **Engine** | Three.js 0.169.0 |
| **Bundler** | Vite 7.3.7 |
| **Runtime** | ES modules in the browser; no framework; **no native build** |
| **Target platform** | Web — **Chromium verified**. Firefox, Safari, Windows and Linux **not** tested (KI-02) |
| **Build command** | `cd game && npm ci && npm run build:cleared` |
| **Build result** | `✓ built in 3.85 s` → **218 files, 72.7 MB**, licence policy **CLEARED** |
| **Test summary** | **687 tests, 687 pass, 0 fail, 0 skipped** · 79/79 files parse cleanly · content validator 3 levels / 0 errors / 0 warnings · acceptance harness **40/41 pass, 1 skipped** · **PRODUCTION BUILD VERIFIED** · real-GPU profile: 0 console errors, 0 page errors, 0 failed requests |
| **Known blockers** | 1 code-external blocker (KI-04, the Cursor review). 12 documented limitations, none of them a code defect |
| **Release status** | **V5 RELEASE CANDIDATE** |

---

## 2. Revision

The V5 work is **entirely on the `v5/upgrade` branch**. `main` and
`origin/main` are untouched at `92c0b37`, and production was never modified.

```
main        92c0b37   Record the third round of Trash emptying in the handover
v5/upgrade  <tip>     SuperCitycon V5 — the 4 -> 5 upgrade
```

The exact tip commit is recorded in §9 and is also embedded in every build:
`vite.config.js` injects `VITE_BUILD_VERSION`, `VITE_BUILD_REVISION`,
`VITE_ENGINE_VERSION` and `VITE_BUILD_TIME` into the bundle, and the running
game exposes them through `window.SUPERCITYCON.diagnostics().build` and
`window.SUPERCITYCON.logger`.

---

## 3. The eight acceptance gates

Each gate records its status, the evidence behind it, the tests that were run,
the failures, and the work that is still outstanding. **No gate is marked
complete because its documentation exists.**

### GATE 0 — V4 preservation and audit complete

| | |
|---|---|
| **Status** | **PASS** |
| **Evidence** | `docs/V4_BASELINE_AUDIT.md`; the V4 baseline was re-measured on this machine during the release pass (see `docs/V5_PERFORMANCE_REPORT.md` §4) |
| **Tests performed** | V4's own suite re-run from a detached checkout at `92c0b37`: **395 tests, 395 pass**. 4 audits of core, world/entities, UI/audio/camera, and tests/tools/build |
| **Failures** | none |
| **Outstanding** | none |

The V4 baseline was measured, not assumed: 395 tests, 56/56 files parsing,
`npm audit` = 2 advisories, 218-file / 72.6 MB cleared build.

### GATE 1 — V5 architecture implemented and validated

| | |
|---|---|
| **Status** | **PASS** |
| **Evidence** | `docs/V5_SYSTEM_ARCHITECTURE.md`; `game/src/core/CONTRACT.md` |
| **Tests performed** | 687-test suite; the purity gate in `tests/integration.test.mjs` checks that no rule module imports `three` (12 new pure modules are on the list, each enforced) |
| **Failures** | none |
| **Outstanding** | none |

What was built: a **fixed-timestep** simulation with a bounded catch-up; **one
clock** (CORE's `advanceClock` — V4's double day-increment is gone); a
**versioned save format** with a migration chain (`SAVE_VERSION` 1 → 2) that
refuses newer saves rather than guessing; structured logging with severities
and a ring buffer; validated out-of-save user settings; one input-map binding
table; a progression record; an explicit `dispose()` teardown; and a
`window.SUPERCITYCON` diagnostics surface.

### GATE 2 — Core gameplay systems functioning

| | |
|---|---|
| **Status** | **PASS** |
| **Evidence** | `docs/V5_REQUIREMENTS_MATRIX.md` §5; the acceptance harness's 41 checks |
| **Tests performed** | The harness drives the **real input path** in a browser against the **built** bundle: placement, the construction-slot gate, refusal messaging, roads, population growth, the day counter, traffic, service coverage, the economy, save/load round-trip, a fresh session loading the save, and the loaded city rendering |
| **Failures** | none — 40/41 pass, 1 correctly skipped (the 2D art check, which is skipped *because* the art is quarantined) |
| **Outstanding** | none |

### GATE 3 — Enemy, combat and progression systems verified

| | |
|---|---|
| **Status** | **PASS** — with the stated genre mapping |
| **Evidence** | `game/src/hazards/` (69 tests), `game/src/content/` (81 tests), `game/src/core/progress.js` |
| **Tests performed** | 69 hazard tests: the phase ladder, telegraph windows, escalation, mitigation from real service ids, the damage pipeline with distance falloff, crisis panic, victory and failure, checkpoint integration across a save/load; 81 content tests: validation, spawn cells, required closure, progression links, objective reachability |
| **Failures** | none |
| **Outstanding** | The platformer reading of "enemy intelligence / boss encounters" is delivered as the **multi-phase city hazard / crisis** system. This is the city-builder equivalent — a threat that escalates through telegraphed phases and must be contained — and it is stated explicitly in `docs/V5_REQUIREMENTS_MATRIX.md`. KI-11: the validator cannot *prove* terrain reachability. KI-12: the shipped phase durations are design placeholders |

### GATE 4 — Visual, animation and audio integration reviewed

| | |
|---|---|
| **Status** | **PASS** — with one documented limitation |
| **Evidence** | `game/src/render/fx.js` + `fx-plan.js` (25 tests), `game/src/population/animation.js` (32 tests) and `pool.js` (13 tests); the captured hazard-effect screenshots |
| **Tests performed** | 9 effect kinds, pooled and instanced; the animation state machine with incompatible-state prevention; the browser capture of the wildfire's ember, flame and smoke **on the plateau**; the effect pool under load in the city profile (421 spawned, **0 skipped**, no leak) |
| **Failures** | none |
| **Outstanding** | KI-07 / R-16: **no audio asset files exist**. Every sound is runtime synthesis. There is no music, no ambience and no voice content, and none is claimed |

### GATE 5 — UI, accessibility and content systems tested

| | |
|---|---|
| **Status** | **PASS** |
| **Evidence** | `game/src/ui/menu.js` (21 tests), `settings-panel.js` (12 tests), `ui.test.mjs` (40 tests), `game/src/content/validate.js` + `game/tools/validate-content.mjs` |
| **Tests performed** | 73 UI tests; the content validator over all 3 shipped levels: **0 errors, 0 warnings**, 3 honest notes; the harness confirms the HUD is complete with **ZERO** 2D images (88 buttons, 72 labelled) |
| **Failures** | none |
| **Outstanding** | KI-05 / R-10: gamepad **navigation** is partial — the API is read and routed, but analogue-stick camera and pad menu navigation are not implemented. KI-06: the 2D HUD art is quarantined (licence unverified) and ships as 0 of 69 images |

### GATE 6 — Performance and regression verification complete

| | |
|---|---|
| **Status** | **PASS** |
| **Evidence** | `docs/V5_PERFORMANCE_REPORT.md`; `game/verification/v5-gpu/`, `v5-gpu-city/`, `v4-baseline-gpu/`, `v4-baseline-gpu-city/` |
| **Tests performed** | A real-GPU profile of the boot scene **and** a populated city (186 buildings, 254 roads, 2 473 residents, 60 vehicles), 300 frames each, on a **hardware** GPU identified from the live WebGL context (`ANGLE (AMD, … AMD Radeon Pro 5500M)`); the **V4 baseline was re-measured** with the same counter semantics |
| **Failures** | none |
| **Outstanding** | KI-01 / R-02: **Apple Silicon is unvalidated** — this machine is x86_64. KI-13 / R-21: the 20-character roster costs +23.6 MB of boot heap (accepted; it bought a 22.5 % frame-time improvement in the city) |

Measured against the re-measured V4 baseline, with **identical** counter
semantics:

| | V4 | V5 | Delta |
|---|---:|---:|---:|
| Boot mean frame | 16.662 ms | 16.667 ms | within noise |
| City mean frame | 23.445 ms | **18.167 ms** | **−22.5 %** |
| City worst frame | 83.3 ms | **35.1 ms** | **−57.9 %** |
| City draw calls | 1 633 | **1 558** | −4.6 % |
| Console / page errors | 0 | **0** | — |

### GATE 7 — Build and release verification complete

| | |
|---|---|
| **Status** | **PASS** |
| **Evidence** | `docs/V5_RELEASE_NOTES.md`, `docs/V5_TEST_REPORT.md`, `docs/V5_PERFORMANCE_REPORT.md`, `README.md`, `CHANGELOG.md`, `docs/V5_KNOWN_ISSUES.md`, `docs/V5_REQUIREMENTS_MATRIX.md` |
| **Tests performed** | `npm ci` → `npm test` → `npm run check` → `npm run build:cleared` → `npm run preview` → the acceptance harness against the built bundle → `verify-production.mjs --profile cleared` |
| **Failures** | none |
| **Outstanding** | KI-03 / R-12: **there is no native executable** — the engine is web-only. No installer, no binary, no notarisation is claimed. KI-02: Windows, Linux and non-Chromium browsers are untested |

---

## 4. What was implemented

### 4.1 Architecture (integrator-owned, `game/src/core/`)

| Module | What it does |
|---|---|
| `core/log.js` | Structured logging: severities, categories, a ring buffer, `installGlobalHandlers`, `buildIdentity` |
| `core/settings.js` | Validated user preferences, stored **outside** the save format |
| `core/input-map.js` | One binding table: `matches` / `rebind` / `resetAll` / `keyLabel` |
| `core/progress.js` | Checkpoints, collectibles and achievements in `state.meta.progress` |
| `core/save.js` | `SAVE_VERSION` 1 → 2 with a `MIGRATIONS` chain; newer saves are refused, never guessed at |
| `core/events.js` | +13 V5 event constants |
| `core/config.js` | `TUNING` extended with 37 new keys (19 hazard, 10 population, 8 camera), each in `TUNING_TBD` |

### 4.2 New domains

| Domain | Files | Tests | What it does |
|---|---|---:|---|
| **Content** | `content/levels.js`, `content/validate.js`, `content/index.js` | 81 | 3 original levels (`first-light`, `high-water`, `the-long-night`), a pure validator (missing exits, invalid spawns, broken progression links, missing resources, bad checkpoints, unsupported types, invalid metadata, unreachable objectives, transitive required closure, footprint-aware spawn cells), and a service that applies a level to the live city |
| **Hazards** | `hazards/logic.js`, `hazards/index.js` | 69 | The multi-phase crisis machine: telegraphs, escalation, vulnerability, mitigation from real service ids, the damage pipeline, crisis panic, victory and failure, checkpoint integration |
| **VFX** | `render/fx-plan.js`, `render/fx.js` | 25 | 9 pooled, instanced effect kinds |
| **Population** | `population/animation.js`, `population/pool.js` + a rewritten `citizens.js` | 92 | An animation state machine, terrain following, object pooling, and a cast expanded from 6 to 20 |
| **UI** | `ui/menu.js`, `ui/settings-panel.js` + `hud.js`, `camera.js`, `panels.js`, `styles.js` | 73 | Main menu, pause overlay, level select, credits; settings, accessibility and controls panels with rebinding; a camera rig with world-bounds clamping, look-ahead and decaying shake; text scale, focus rings, a colour-blind channel and high contrast |

### 4.3 Integrator work that fixed real defects

| Defect | How it was found | Fix |
|---|---|---|
| The day counter incremented **twice** per day | reading the simulation, not the code | One clock: CORE's `advanceClock` is the only time authority |
| A level's starting city was charged and needed construction slots | browser measurement — 1 of 31 buildings placed | A `prebuilt` path: cost 0, no slot |
| The renderer counter described only the last pass | the harness failing "scene renders geometry" (`1 draw calls` for 573 meshes) | `autoReset = false` + `reset()` at the top of `update()`; the monitor and the adaptive driver moved after the draw |
| The settings panel forced post-processing **on**, fighting the adaptive driver | reading the panel's logic | Post-FX may only be switched **off** (reduced effects), never on |
| The hazard's effect was drawn **underground** | reading the live particle matrices in a browser | Both the hazard domain and the effect bridge ask the WORLD domain for the ground height |
| The hazard effect was drawn **twice** (the domain and the bridge) | instrumenting `fx.spawn` in the live page | The hazard domain is the sole owner of the hazard's visuals |
| The performance profiler could report a **negative** frame time | `minMs: -63.8` in a real profile | Seed from the first rAF timestamp; `negativeSamples` is now published and is 0 |

Every one of these is covered by a test, and the two most recent were
**mutation-tested** — reverting the fix makes the test fail.

### 4.4 Content pipeline

`game/tools/validate-content.mjs` is a runnable validator, not a document. It
found **real** content gaps when it was first written: three objectives that
were on no path to an exit, and three checkpoints that nothing referenced.
The level data was corrected.

---

## 5. Files created or modified

Everything below is on `v5/upgrade`. The six files another process was editing
in the main workspace (`game/src/ui/styles.js`, `tools/performance.mjs`,
`game/tests/construction-progression.test.mjs`, `tools/performance-gpu.mjs`,
`tools/performance-gpu.test.mjs`, `tools/verify-shop-layout.mjs`) were
**never touched** — R-07.

**New — V5 core:** `core/log.js`, `core/settings.js`, `core/input-map.js`,
`core/progress.js`

**New — domains:** `content/` (levels, validate, index, tests),
`hazards/` (logic, index, tests), `render/fx-plan.js`, `render/fx.js`,
`population/animation.js`, `population/pool.js`, `ui/menu.js`,
`ui/settings-panel.js`

**New — tools:** `tools/profile-gpu.mjs`, `tools/capture-effect.mjs`,
`tools/png-read.mjs`, `tools/crop.mjs`, `game/tools/validate-content.mjs`

**New — docs:** `docs/V4_BASELINE_AUDIT.md`, `docs/V5_UPGRADE_PLAN.md`,
`docs/V5_REQUIREMENTS_MATRIX.md`, `docs/V5_RISK_REGISTER.md`,
`docs/V5_SYSTEM_ARCHITECTURE.md`, `docs/V5_TEST_REPORT.md`,
`docs/V5_PERFORMANCE_REPORT.md`, `docs/V5_KNOWN_ISSUES.md`,
`docs/V5_RELEASE_NOTES.md`, `docs/V5_FINAL_VERIFICATION.md`, `CURSOR-HANDOFF.md`,
`CHANGELOG.md`

**Modified:** `src/main.js`, `src/core/{config,events,save,state,CONTRACT}.js`,
`src/buildings/index.js`, `src/economy/index.js`, `src/population/{citizens,index}.js`,
`src/render/renderer.js`, `src/ui/{camera,hud,index,panels,styles}.js`,
`tests/integration.test.mjs`, `vite.config.js`, `package.json`,
`package-lock.json`, `README.md`

---

## 6. Unfinished requirements — stated, not hidden

| ID | Requirement not delivered | Why | Severity |
|---|---|---|---|
| **KI-04** | The Cursor senior review | The account's quota is exhausted (4 attempts, `ActionRequiredError`) | **MAJOR — the only thing blocking COMPLETE AND VERIFIED** |
| KI-01 | Apple Silicon / ARM64 validation | This machine is x86_64 | LIMITATION |
| KI-02 | Windows, Linux, Firefox, Safari | Not available here | LIMITATION |
| KI-03 | A native executable / installer | The engine is web-only | LIMITATION |
| KI-05 | Gamepad menu navigation, analogue-stick camera | The API is routed; the navigation is not built | MINOR |
| KI-06 | The 2D HUD art | 69 images with unverified licences; **0 of them ship** | LIMITATION |
| KI-07 | Music, ambience, voice | No audio asset files exist; every sound is runtime synthesis | MINOR |
| KI-08 | Compact save format | JSON terrain arrays; ~99 KB populated, under 2 % of quota | MINOR |
| KI-09 | LLM-driven NPC dialogue | No authorised provider with documented safeguards | MINOR |
| KI-10 | The platformer capability list | Out of scope: V5 is a city builder | MAJOR (scope, stated) |
| KI-11 | Terrain-level reachability proving | The validator states this limit on every level | MINOR |
| KI-12 | Balanced level difficulty | The publisher published no design values | MINOR |
| KI-13 | On-demand character loading | Accepted trade: it bought the frame-time improvement | MINOR |

---

## 7. Build and export status

| | |
|---|---|
| **Artifact** | `game/dist` — a static web bundle |
| **Type** | **Web only.** There is **no native executable**, no installer, no binary and no notarisation. None is claimed |
| **Size** | 218 files, 72.7 MB (117 `.glb` = 69.8 MB, 41 `.bin` = 1.5 MB, 4 `.js` = 1.2 MB, 41 `.gltf` = 0.2 MB) |
| **Licence policy** | **CLEARED** — the 2D art is stripped, and the build **fails** if any of it survives |
| **Verified** | `verify-production.mjs --profile cleared` → **PRODUCTION BUILD VERIFIED** |
| **Launch** | `cd game && npm ci && npm run build:cleared && npm run preview` → `http://localhost:4173` |

---

## 8. Regression status against V4

| | V4 | V5 | Verdict |
|---|---|---|---|
| Unit + integration tests | 395 | **687** | **All 395 V4 tests still pass.** +292 added, 0 removed, 0 weakened |
| Source files parsing | 56 | **79** | +23 files, all parse |
| Dependency advisories | 2 | **0** | Improved (`vite` 5.4.21 → 7.3.7) |
| Cleared bundle | 218 files / 72.6 MB | 218 files / **72.7 MB** | +0.1 MB (the larger cast) |
| Boot frame time | 16.662 ms | 16.667 ms | Unchanged |
| City frame time | 23.445 ms | **18.167 ms** | **−22.5 %** |
| Acceptance harness | 40/41 (1 skipped) | 40/41 (1 skipped) | Unchanged |
| Every V4 feature | present | present | **No V4 feature was removed** |

---

## 9. The one thing left to do

Run the Cursor senior review. `CURSOR-HANDOFF.md` carries the complete
brief: the request, the acceptance criteria, the branch, the changed files
and the reasons for each change, the tests that were run with their actual
output, and the known issues that need visual inspection.

```bash
cd <repo> && git checkout v5/upgrade
cursor agent --print --trust --model gpt-5.6-sol-xhigh --mode ask \
  "Review the SuperCitycon V4 -> V5 upgrade on branch v5/upgrade against the brief in CURSOR-HANDOFF.md"
```

**When that review comes back clean, this document's classification becomes
V5 COMPLETE AND VERIFIED** — every other release-critical condition has
already passed.

---

## 10. Final recommendation

**SuperCitycon V5 can be designated 5.0.0 as a release candidate. It should
not be designated 5.0.0 "complete and verified" until the Cursor senior
review has been run.**

The upgrade is real, measured and complete on every phase the directive
specified. The V4 architecture was preserved rather than replaced, the
simulation is now frame-rate independent and single-clocked, the content
pipeline validates the levels it ships, the hazards are a working multi-phase
crisis system, the UI has a full menu, settings and accessibility surface,
and the game is measurably **faster** than V4 in a populated city with the
same resident count.

What is not done is listed in §6 with its reason, and exactly one item on that
list — a review that the tooling refused to perform — is a gate on the
strictest classification.

**Classification: V5 RELEASE CANDIDATE.**
