# MiniMax Game Studio Ultra V4 — Handover

**Verdict: B. READY WITH EXTERNAL LIMITATIONS**

This is the ninth and final V4 document. It is the single page a new owner
needs: what exists, what was measured, what is still open, and exactly which
commands reproduce every number in this release.

| | |
|---|---|
| Project | MiniMax Game Studio Ultra V4 |
| Branch | `v4/studio` |
| Code commit | `620f14c` — *"V4: fix one-press-per-action, wire the pause key, restore behaviour on load"* |
| Base commit | `92c0b37` — the `main` branch, **unmodified** |
| Application root | `v4-worktree/v4` |
| Status | **Local branch. Not pushed. Production untouched.** |
| Review status | **Awaiting Cursor review** — see §7 |

---

## 1. What was actually built

V4 is a **new application** under `v4/`. It is not a rewrite of the V2
city-builder in `game/`, and it is not the design-only `minimax-game/`
package. Both are untouched.

**52 source files, 12,661 lines**, plus **2,114 lines of tests** and 14
tools and scripts.

| Area | Files | What it does |
|---|---|---|
| `src/core/` | 8 | ECS with tag/component queries, transform hierarchy with lazy world matrices, event bus with history, component registry and JSON-safe serialisation, scene manager with memory and `localStorage` adapters, project manager, fixed-step clock with a frame profiler, logger that captures global errors |
| `src/render/` | 2 | Three.js renderer facade with quality presets and GPU identity detection; GLTF/GLB loader over the cleared-asset catalogue |
| `src/input/` | 1 | Action-based input, rebindable, with edge and level state separated |
| `src/physics/` | 1 | Deterministic AABB/sphere physics with static-collider resolution and per-axis extents |
| `src/anim/` | 1 | Animation state machine with conditions, expressions, blending and events |
| `src/audio/` | 1 | Audio manager — wired and inspectable, **silent** (no cleared audio exists) |
| `src/editor/` | 7 | The 3D world editor: hierarchy, inspector, viewport, gizmos, undo/redo, validation, styles |
| `src/npc/` | 4 | NPC behaviour system: states, senses, A* pathfinding, behaviour tree, difficulty profiles, debug overlay |
| `src/gameplay/` | 12 | Character controller, interaction, HUD, objectives, and the starter modules: combat, inventory, dialogue, checkpoints, menus, pause, settings |
| `src/levels/` | 2 | The demo village: terrain, buildings, roads, props, lights, the player and four NPCs |
| `src/assets/` | 5 | Asset library: catalogue, search, duplicate and broken-file detection, integrity checks, dependency identification, safe export |
| `src/ai/` | 6 | Offline generators (project, scene, component, animator, NPC script), error explainer, refactor analyser, checklist, build-error reviewer |
| `src/main.js` | 1 | The integration point — where every subsystem is wired together |

### The editor

Hierarchy panel, object inspector, 3D viewport, selection, move/rotate/scale
gizmos, grid snapping, camera orbit/pan/zoom, duplication, undo/redo,
scene save/load, material and lighting controls, play and edit modes,
collision visualisation, camera preview, scene validation, and keyboard
shortcuts.

The editor and the runtime **share one ECS world and one Three.js scene**.
Play does not reload a level; it switches the mode of the same world.

### The AI-assisted tooling

Everything in `src/ai/` is **deterministic and offline** — it needs no network
and no API key. An LLM adapter exists, is **disabled by default**, reads its
key from the environment, redacts it from logs, and always falls back to the
deterministic path. No provider was authorised, so no provider is used.

---

## 2. Demonstrated functionality

The vertical slice was driven in a real Chromium against the production build.
**28 of 28 acceptance checks pass, with 0 console errors and 0 uncaught page
errors.** The recorded evidence is `v4/verification/slice/slice-report.json`
plus five screenshots.

| The directive's 12 required steps | Evidence |
|---|---|
| 1. Start the game | Ready in 2048 ms; `data-v4-ready="1"` set on the body |
| 2. Load a real 3D scene | 20 entities, 14 cleared models, 4 colliders, 3 lights |
| 3. Control a character | 3.478 m travelled on a held `W` |
| 4. Move through the environment | The **mesh** moved the same 3.478 m on screen — not just the data |
| 5. Observe working character animation | Live state machine on a 30-clip model; the HUD reports `anim: idle`; NPCs animate from their behaviour state |
| 6. Interact with an object | `E` → exactly **one** event, `result="The chest is empty, except for a faded photograph."`, shown in the HUD |
| 7. Demonstrate working NPC behaviour | 4 NPCs with distinct behaviours; 3 of 4 observed walking on screen; states observed: `idle`, `patrol`, `chase`, `interact` |
| 8. Display a functional HUD | HP, objective, prompt, message, fps, ms, NPC count, animation state — all live |
| 9. Pause and resume | `v4.pause()` / `v4.resume()` **and** the Escape key, which pauses and resumes |
| 10. Save and reload game state | 20 entities saved and reloaded; the 3D objects are restored to their saved positions; the interactive behaviour is re-attached and works again |
| 11. Display performance information | Live fps, frame ms, draw calls, triangle count |
| 12. Exit without errors | 0 uncaught page errors, 0 console errors |

**Exact launch command:**

```sh
cd v4-worktree/v4
npm install
npm run dev            # development server
# or, against the production build:
npm run build && npm run preview
```

---

## 3. Tests executed and their results

Every figure below is the recorded output of the command shown.

| Gate | Command | Result |
|---|---|---|
| Unit + integration suite | `node --test "tests/*.test.mjs"` | **149 tests, 149 pass, 0 fail, 0 skipped** |
| Syntax | `node tools/check-syntax.mjs` | **56/56 files parse cleanly** |
| Dependency security | `npm audit` | **0 vulnerabilities** |
| Asset audit | `node tools/audit-assets.mjs` | 92 entries, 0 broken, 0 duplicate groups, 69 quarantined by design |
| Asset pipeline | `node scripts/prepare-assets.mjs --check` | source 203, target 203, refused 0, sha256-verified |
| Production build | `npx vite build` | 8 chunks; index **187.19 kB gzip**, editor **22.10 kB gzip**; `dist/` 93 MB |
| Browser acceptance | `node scripts/launch-slice.mjs` | **28/28 pass**, 0 console errors, 0 uncaught page errors |
| Real-GPU measurement | `node scripts/gpu-profile.mjs <url> --seconds 10` | see §5 |

**Nothing was skipped, masked or marked as passing without running.** The
suite grew from 137 to 149 tests during the final integration pass; the two
new tests guard the two newest defects, and the acceptance harness gained
four checks (one press → one interaction, the interaction produces a result,
the Escape key pauses and resumes, the reload restores the 3D objects and
their behaviour).

---

## 4. Problems discovered and resolved

**19 defects in this release**, each found by a measurement and each fixed
with a regression test. The full list is in `v4/docs/V4_READINESS_REPORT.md`
§5; the three newest are summarised here because they are the most instructive:

1. **One key press triggered up to five actions.** The fixed-step clock runs
   several catch-up steps in one slow frame, and every step read the same
   key-down edge. One press of `E` interacted five times; one press of
   `Escape` would have toggled the pause five times. Fixed with
   `Input.consumeEdges()`, which clears the edges after the first simulation
   step — the key stays *held*, so movement is unaffected.
2. **The Escape key did nothing.** The pause module existed and was
   unit-tested, but the app never created it, and its `update()` called a
   `toggle` that was not in scope — a `ReferenceError` every frame once it
   *was* wired. The app now creates the controller, `toggle` is a closure
   function, and the pause key is read outside the simulation, because a
   paused clock stops the fixed steps.
3. **A scene load left the world inert.** A callback is a runtime handle, so
   it never reaches the save format; a load rebuilt the entities without
   their `onInteract`, and pressing `E` showed the prompt and did nothing.
   `level.rebindInteractions()` re-attaches the handlers on load, exactly as
   `rebindAnimators()` rebuilds the animation controllers.

Defect 3 also exposed a weakness in the **harness itself**: the interaction
check matched the HUD text, and the HUD always shows the prompt, so it passed
while the interaction produced nothing at all. The harness now asserts on the
event payload's `result` — a change that would have caught defect 3 the
first time.

---

## 5. Performance measurements

**Real hardware, not a software renderer.** The probe refuses to publish a
figure if the renderer turns out to be a software implementation.

| Measure | V4 (real GPU) | V2 baseline (real GPU) |
|---|---|---|
| Renderer | ANGLE (Intel, ANGLE Metal Renderer: Intel UHD Graphics 630) | ANGLE Metal / Intel UHD 630 |
| `isSoftware` | **false** | false |
| Presentation rate | **100.8 fps** | 432.3 fps |
| Mean frame interval | **9.92 ms** | 2.31 ms |
| Median frame interval | **6.3 ms** | 2 ms |
| p95 frame interval | **15.7 ms** | 4 ms |
| Frames sampled | 1016 | — |
| Engine frame rate | 68.8 fps | 62.8 fps |
| Draw calls | 312 | 274 |
| Triangles | 151,980 | 151,524 |
| Console errors | **0** | 0 |

The V4 figure is lower than the V2 figure because V4 renders a full 3D village
with shadows, a 30-clip animated character, four animated NPCs, a
third-person camera and an editor UI — against the V2 2D/3D city-builder's
scene. The comparison is recorded, not used as an excuse: both are real
hardware measurements on the same machine, and neither is a target.

The **headless** acceptance run uses SwiftShader (software GL) and measures
around **13.5 fps, 73.93 ms/frame, 77 draws**. That is a software floor for a headless CI-style
run, **not** a GPU figure, and is never presented as one.

Raw evidence: `v4/verification/gpu/v4-real-gpu-final.json` and `.png`.

---

## 6. Hardware and platform coverage

| Target | Status | Note |
|---|---|---|
| macOS Intel (this machine) | **TESTED** | x86_64, Intel i9-9980HK; full suite, browser acceptance and real-GPU profile all run |
| macOS Apple Silicon | **NOT TESTED — GATE OPEN** | `hw.optional.arm64` is absent. No ARM build was produced and no ARM performance is claimed. |
| Windows | **NOT TESTED** | No machine or browser available in this environment |
| Linux | **NOT TESTED** | Same |
| Chromium / Chrome / Edge | **TESTED** | The acceptance harness and the GPU probe both run Chromium |
| Firefox, Safari | **NOT TESTED** | Same reason |

**Apple Silicon remains explicitly open by instruction.** The build is plain
ES modules with no native binary and no platform-specific code path, so it is
*expected* to run on ARM, but that is an expectation, not a measurement, and
it is recorded as such.

---

## 7. The review situation — read this

The always-on working standard requires a Cursor senior review of every
deliverable.

- A **Cursor review did run** over the NPC, gameplay and level modules. It
  returned **13 defects**, all fixed and given regression tests.
- The **account quota then ran out**: `cursor agent status`, `cursor agent
  models` and `cursor agent --print --mode ask` all return
  `ActionRequiredError: You're out of usage`, verified on two models.
- The final integrated state therefore could not go through Cursor. An
  **independent verifier agent** reviewed the integrated code instead and
  returned **16 findings** (5 major, 11 minor); all 5 major and 10 of the
  minor findings are fixed and covered by tests, and the remaining one is
  documented in `v4/docs/V4_FEATURE_MATRIX.md`.

**This release is labelled _Awaiting Cursor review_.** `v4/CURSOR-HANDOFF.md`
and `v4/CURSOR-HANDOFF-PROMPT.txt` hold the exact prompt to re-run when the
quota is restored. No self-review has been presented as a Cursor review.

---

## 8. Missing licences and quarantined assets

| Item | State |
|---|---|
| **69 2D images** | Every one reads `licence: "unverified"` against the library index `~/.minimax/asset-library/catalogue/game_asset_index.json`. **All 69 are quarantined** and are **not** redistributed. The exporter refuses them by design, and the build ships none of them. Per-file records: `v4/data/quarantine-2d.json`. |
| **203 3D model files** | Copied with **sha256 verification**, each with a shipped licence text. Manifest: `v4/public/assets/CLEARED-ASSETS.json`. |
| 8 licence texts | Shipped alongside the models they cover. |

No licence was assumed, substituted or fabricated. Clearing the 2D art is the
publisher's decision and cannot be made from inside this repository — it is
the second of the two external blockers.

---

## 9. Remaining issues and honest limits

These are real and are not presented as working:

1. **Apple Silicon is untested.** External (§6).
2. **The 69 2D images are not redistributable.** External (§8).
3. **No audio ships.** The cleared catalogue contains no audio files, so the
   audio system is wired and inspectable but **silent**.
4. **Nine gameplay modules are starter modules, not demo features.** Combat,
   inventory, dialogue, checkpoints, menus, pause, settings, objectives and
   the HUD are modular and separately testable — which is what the directive
   asks of them — but the demo level does not exercise all of them. They are
   not AAA systems and are not claimed to be.
5. **No native (non-web) build.** V4 is a web application; the
   cross-platform story is the browser's.
6. **The final integrated state has not been through Cursor** (§7).
7. **The demo level's chest and sign use primitive geometry** — the cleared
   catalogue has no chest or sign model.
8. **The 2D asset pipeline has no cleared 2D input**, so the 2D side of the
   asset library is exercised only by its own tests.

---

## 10. Dependencies introduced

| Package | Version | Type | Why |
|---|---|---|---|
| `three` | ^0.169.0 | runtime | The engine. The only runtime dependency. |
| `vite` | ^7.3.7 | dev | Build tool and preview server. Upgraded from 5.4.21 during the final pass: `esbuild <= 0.24.2` is reachable through `vite <= 6.4.3` (GHSA-67mh-4wv8-2f99), and `npm audit` reports 0 vulnerabilities after the upgrade. |

**No paid dependency was introduced.** The engine is the renderer and the
loaders; no game framework, no physics library, no UI kit and no state
management library was added. The build system is the only tool beyond the
engine itself.

---

## 11. Reproduction commands

```sh
cd v4-worktree/v4
npm install

# Gates
npm test                       # 149 tests
npm run check                  # 56/56 files parse cleanly
npm audit                      # 0 vulnerabilities
node tools/audit-assets.mjs    # 92 entries, 0 broken, 69 quarantined
node scripts/prepare-assets.mjs --check

# Build and run
npm run build                  # production build
npm run preview                # serve the production build

# The vertical slice
npm run slice                  # 28 acceptance checks + 5 screenshots

# The real-GPU measurement (needs a running preview server)
node scripts/gpu-profile.mjs "http://127.0.0.1:4180/" --out verification/gpu --seconds 10 --label v4

# Diagnostics
node scripts/diagnose-boot.mjs --headed --seconds 14
node scripts/probe-edit-camera.mjs
node scripts/probe-interaction.mjs
```

---

## 12. The nine V4 documents

| Document | What it answers |
|---|---|
| `V4_READINESS_REPORT.md` | The mandatory acceptance criteria, answered one by one, with the defects list |
| `V4_ARCHITECTURE.md` | How the engine, the editor and the runtime fit together |
| `V4_FEATURE_MATRIX.md` | Every capability from the directive, marked MET / PARTIAL / OPEN / INCOMPLETE |
| `V4_TEST_RESULTS.md` | Every test executed, with its real output |
| `V4_ASSET_LICENCES.md` | Every asset, its source, its licence state, and the quarantine record |
| `V4_PERFORMANCE.md` | The measurements, the baseline and what changed |
| `V4_COMPATIBILITY.md` | Platform support, what was tested and what was not |
| `V4_DEVELOPER_GUIDE.md` | How to build, run, extend and debug it |
| `V4_HANDOVER.md` | **This document** — the single page a new owner needs |

---

## 13. Final verdict

### B. READY WITH EXTERNAL LIMITATIONS

V4 is a genuinely working, professional and extensible 3D game development
environment. The editor runs, the runtime runs, the NPC behaviour runs, the
animation runs, the demo level is playable end to end, save/load restores both
the scene and its behaviour, and 149 automated tests plus 28 browser acceptance
checks pass with zero console errors on real hardware.

It is **not** A, because two limitations are external and cannot be closed from
inside this repository: the 2D art licences are unverified at source and stay
quarantined, and no Apple Silicon hardware was available to test on. It is
certainly not C — no critical failure remains, and every claim in these nine
documents is backed by a command that was run.

**What a new owner should do first:**

1. Restore the Cursor quota and run the review in `v4/CURSOR-HANDOFF.md`. The
   integrated state is otherwise unreviewed by Cursor.
2. Make the licence decision on the 69 quarantined 2D images.
3. Run the suite on an Apple Silicon machine to close that gate.
4. Push `v4/studio` when you are ready — it is **local only**, and `main` and
   production are untouched.
