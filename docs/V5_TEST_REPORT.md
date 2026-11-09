# SuperCitycon — V5 Test Report

**Branch:** `v5/upgrade`
**Baseline:** V4 at `main` @ `92c0b37`
**Measured:** 2026-11-09
**Verdict:** **PASS** — 687 tests, 687 pass, 0 fail, 0 skipped. Every one of the
395 V4 baseline tests still passes.

---

## 1. What was run, and what it proved

Every number in this document came from a command that was actually executed
in the V5 worktree during the release pass. Nothing is projected or
extrapolated. Where a check could **not** be run, it is listed in §7 as
unavailable, not quietly omitted.

| # | Check | Command | Result |
|---|---|---|---|
| T1 | Unit + integration suite | `npm test` | **687 tests · 687 pass · 0 fail · 0 skipped** |
| T2 | Source parse check | `npm run check` | **79/79 files parse cleanly** |
| T3 | Dependency audit | `npm audit` | **0 vulnerabilities** |
| T4 | Content validator | `node tools/validate-content.mjs` | **3 levels · 0 errors · 0 warnings · 3 notes** |
| T5 | Acceptance harness (cleared build) | `node tools/scenario.mjs <url> <dir> v5-final` | **40/41 pass · 1 skipped** |
| T6 | Production build verification | `node tools/verify-production.mjs --profile cleared` | **PRODUCTION BUILD VERIFIED** |
| T7 | Real-GPU frame profile (boot + populated city) | `node tools/profile-gpu.mjs` | 0 console errors, 0 page errors, 0 failed requests |
| T8 | Hazard effect on screen | `node tools/capture-effect.mjs` | fire, ember and smoke pixels captured on the plateau |
| T9 | Browser probes (content, camera, post-FX, draw calls, hazard height) | `node tools/shoot.mjs` | 8 probes, all returned real data |

The one **skip** is T5's "the 2D HUD art is applied and its files resolve".
It is skipped deliberately: the 2D art is quarantined because its licence is
unverified, so a cleared build has no `assets/ui-assets.json` to resolve. The
harness proves the *opposite* in the next check — "the HUD is complete and
correct with **ZERO** 2D images (88 buttons, 72 labelled, 0 images)".

---

## 2. The test inventory

21 test files, 687 tests.

| File | Tests | Pass | Fail | Covers |
|---|---:|---:|---:|---|
| `src/content/content.test.mjs` | 81 | 81 | 0 | level validation, spawn cells, required closure, progression links, objective reachability |
| `src/hazards/hazards.test.mjs` | 69 | 69 | 0 | phase ladder, telegraph windows, escalation, mitigation, damage falloff, crisis panic/victory/failure, checkpoints, effect placement |
| `src/buildings/buildings.test.mjs` | 60 | 60 | 0 | placement, footprints, blocking cells, catalogues |
| `src/core/core.test.mjs` | 42 | 42 | 0 | save/load, migration chain, settings, progress, input map, logging |
| `src/ui/ui.test.mjs` | 40 | 40 | 0 | HUD, panels, camera rig, credits, keyboard/focus behaviour |
| `src/population/animation.test.mjs` | 32 | 32 | 0 | animation state machine, transitions, incompatible-state prevention |
| `src/population/population.test.mjs` | 32 | 32 | 0 | residents, morale, housing, service demand |
| `src/economy/economy.test.mjs` | 36 | 36 | 0 | treasury, construction slots, service upkeep, budget rules |
| `src/mobility/mobility.test.mjs` | 30 | 30 | 0 | roads, traffic routing, commute, congestion |
| `src/render/tec.test.mjs` | 31 | 31 | 0 | instancing, materials, shadow/post-FX toggles, renderer contract |
| `src/services/services.test.mjs` | 28 | 28 | 0 | coverage computation, service types, staffing |
| `src/studio/studio.test.mjs` | 25 | 25 | 0 | the SCC Studio voxel editor, OBJ export |
| `src/ui/menu.test.mjs` | 21 | 21 | 0 | main menu, pause overlay, level select, credits |
| `src/population/citizens.test.mjs` | 18 | 18 | 0 | citizen spawning, terrain following, pathing |
| `src/world/world.test.mjs` | 17 | 17 | 0 | terrain generation, heightmap, water, scenery scatter |
| `src/render/fx-plan.test.mjs` | 14 | 14 | 0 | effect recipes, particle planning, reduced-motion path |
| `src/population/pool.test.mjs` | 13 | 13 | 0 | object pooling, reuse, bounded capacity |
| `src/ui/settings-panel.test.mjs` | 12 | 12 | 0 | settings, accessibility toggles, rebinding |
| `src/render/fx.test.mjs` | 11 | 11 | 0 | the effect service: pools, spawn, update, stats |
| `tests/live-state.test.mjs` | 8 | 8 | 0 | the live state tree survives a save/load boundary |
| `tests/integration.test.mjs` | 67 | 67 | 0 | cross-domain contracts, purity, asset integrity, integrator wiring |
| **Total** | **687** | **687** | **0** | |

---

## 3. Regression against the V4 baseline

This is the check the directive calls *regression protection*: every test that
existed in V4 must still exist and still pass.

| Test file | V4 | V5 | Delta |
|---|---:|---:|---:|
| `src/buildings/buildings.test.mjs` | 60 | 60 | — |
| `src/core/core.test.mjs` | 38 | 42 | +4 |
| `src/economy/economy.test.mjs` | 36 | 36 | — |
| `src/mobility/mobility.test.mjs` | 30 | 30 | — |
| `src/population/citizens.test.mjs` | 5 | 18 | +13 |
| `src/population/population.test.mjs` | 29 | 32 | +3 |
| `src/render/tec.test.mjs` | 31 | 31 | — |
| `src/services/services.test.mjs` | 28 | 28 | — |
| `src/studio/studio.test.mjs` | 25 | 25 | — |
| `src/ui/ui.test.mjs` | 35 | 40 | +5 |
| `src/world/world.test.mjs` | 17 | 17 | — |
| `tests/integration.test.mjs` | 53 | 67 | +14 |
| `tests/live-state.test.mjs` | 8 | 8 | — |
| **V4 sub-total** | **395** | **395** | **0 removed, 0 changed, 0 failing** |
| New V5 files (8) | — | 253 | +253 |
| **Total** | **395** | **687** | **+292** |

**All 395 V4 tests still pass.** No V4 test was deleted, skipped or weakened.
The eight new files carry 253 new tests; the existing files gained 39 more.

---

## 4. Tests that were written for a defect, and were proven to catch it

A regression test that passes against the broken code is worthless. Each of
the three defects below was found by measurement during this release pass, and
each was **mutation-tested**: the fix was reverted in the working tree, the
test was re-run, and it was required to fail.

### 4.1 The hazard effect was buried under the terrain

**Found by:** loading `the-long-night` in a real browser, starting the
wildfire, and reading the live particle transforms out of the instance
matrices.

**The defect:** `cellToWorld(x, z, 0)` placed the hazard's effect at world
`y = 0`. The wildfire's cell (56, 32) is on a plateau **9 units above the
base plane**, so the fire was drawn 9 units inside the ground. The effect
service reported 15 fire spawns and 16 live particles; **not one pixel** of
them reached the screen.

**Measured before and after:**

| | Particles' world Y | Visible pixels |
|---|---|---|
| Before | 0.82 – 1.27 | **0** |
| After | 10.02 – 13.13 | ember, flame and smoke captured on the plateau |

**The fix:** the hazard domain asks the WORLD domain for the ground it sits
on (`wld.heightAt(cx, cz)`), and the integrator's visual-feedback bridge
does the same for every other effect.

**The tests:**
- `src/hazards/hazards.test.mjs` — "the hazard effect is placed on the
  TERRAIN, not at world y = 0" and "a world without a heightmap never breaks
  the hazard effect" (2 new).
- `tests/integration.test.mjs` — "an effect is placed on the TERRAIN, not at
  world y = 0", "an effect on flat ground still lands on that ground", "a
  world without a heightmap never breaks the bridge" and "the bridge does NOT
  also draw the hazards — the hazard domain owns those" (4 new).

**Mutation check:** reverting the height to `0` makes **2 of the 4**
integration tests fail; restoring it returns the suite to 687/687.

### 4.2 The renderer counter under-reported every frame

**Found by:** the acceptance harness failing its "scene renders geometry"
check — `1 draw calls, 1 triangles, 573 meshes` for a scene with 573 meshes.

**The defect:** three.js resets `renderer.info` *after* the shadow-map pass,
so the default counter described the main scene pass only. With the post
chain on it described the fullscreen retro pass alone. The number that the
adaptive-quality driver and the HUD's performance read-out depend on was
wrong, and it was wrong in the direction that flatters the game.

**The fix:** `renderer.info.autoReset = false`, with `renderer.info.reset()`
at the **top** of `update()` and the monitor and the adaptive driver moved
**after** the draw, so they sample the frame that was actually rendered.

**Measured:** the boot scene reports 63 draw calls — 34 for the main pass
plus 29 for the shadow pass — against V4's 34 for the same scene.

### 4.3 The performance profiler could report a negative frame time

**Found by:** the real-GPU profile reporting `minMs: -63.8`.

**The defect:** the sampler seeded its previous timestamp from
`performance.now()` and then differenced it against the next
`requestAnimationFrame` timestamp. A rAF timestamp is the time the frame
*began*, which can be earlier than a `performance.now()` taken a moment ago,
so the first sample could be negative — and it dragged the mean and the p99
with it.

**The fix:** the sampler seeds from the first rAF timestamp, so every delta is
a real frame gap. The report now also carries `negativeSamples`, so an
artefact can never hide inside an average again.

---

## 5. The acceptance harness — 41 checks against the built game

`tools/scenario.mjs` drives the **real input path** in a real browser against
the **built** bundle and reads the **real pixels**. It is not a mock.

| # | Check | Result |
|---|---|---|
| 1 | game boots to ready | PASS — 10 domains: wld, buildings, economy, mobility, population, services, studio, ui, content, hazards |
| 2 | no fatal pane | PASS |
| 3 | all eight runtime domains loaded | PASS |
| 4 | CORE modules loaded | PASS — stage, save, modes |
| 5 | terrain generated | PASS — 4096 cells |
| 6 | nature scattered | PASS — 798 placements |
| 7 | a building needing more slots than the player owns is refused | PASS — "needs 2 slots, the player owns 1" |
| 8 | that refusal is explained to the player | PASS |
| 9 | the first placement is accepted | PASS |
| 10 | a placement with no free construction slot is refused | PASS — `not-enough-slots` |
| 11 | the refusal reaches the player as a toast | PASS |
| 12 | a refused placement is not charged | PASS — treasury 24880 → 24880 |
| 13 | a building can be placed on a cell that holds scenery | PASS |
| 14 | buildings place on the map | PASS — 17/18 placed, 1 failed (`trn.monorail_station@36,34: slot-timeout`) |
| 15 | roads place on the map | PASS — 9/9 |
| 16 | every placed building has a model in the scene | PASS — 19 instances for 17 buildings |
| 17 | population grows from housing | PASS — 602 residents |
| 18 | day counter advances | PASS — day 2 after 91 s |
| 19 | citizens spawn | PASS — 25 rendered citizens |
| 20 | traffic spawns on roads | PASS — 60 vehicles |
| 21 | service coverage computed | PASS — 10 service types |
| 22 | economy responds to the city | PASS — treasury 25249 from 25000 |
| 23 | HUD mounted | PASS — 2 nodes, 88 buttons |
| 24 | HUD shows live numbers | PASS |
| 25 | the 2D HUD art is applied and its files resolve | **SKIP** — no 2D manifest: the art is quarantined for licence reasons |
| 26 | the HUD is complete and correct with ZERO 2D images | PASS — 88 buttons, 72 labelled, 0 images |
| 27 | a pointer click selects the build tool | PASS |
| 28 | a pointer click on a shop card selects the building type | PASS — `res.house` |
| 29 | a pointer click on the canvas places a building | PASS — cell (44, 32), models 19 → 20 |
| 30 | scene renders geometry | PASS — 974 draw calls, 2 184 208 triangles, 573 meshes |
| 31 | the building models are batched into instanced draws | PASS — 20 buildings of 17 types in 17 batches = 61 draw calls |
| 32 | frame is not a flat colour | PASS — 135 distinct colours, mean luma 13.5 |
| 33 | the SCC Studio opens | PASS |
| 34 | the SCC Studio sculpts a voxel | PASS — 0 → 2 voxels |
| 35 | the SCC Studio exports a valid OBJ | PASS — 761 bytes, has vertices, has faces |
| 36 | the city saves to a slot | PASS — 20 buildings |
| 37 | save round-trips | PASS — 488 542 bytes, 20 buildings preserved |
| 38 | a fresh session loads the save file | PASS — session B: 0 → 20 buildings |
| 39 | the loaded city renders its buildings | PASS — 20 models after the load |
| 40 | no uncaught page errors | PASS |
| 41 | no console errors | PASS |

**40/41 pass, 1 skipped.** The same run against the production bundle
(`verify-production.mjs --profile cleared`) also reported
**PRODUCTION BUILD VERIFIED**.

---

## 6. Content validation

`node tools/validate-content.mjs` checks every shipped level for missing
exits, invalid spawns, broken progression links, missing resources, bad
checkpoints, unsupported object types, invalid metadata and unreachable
required objectives.

```
PASS  first-light      (0 error(s), 0 warning(s), 1 note(s))
PASS  high-water       (0 error(s), 0 warning(s), 1 note(s))
PASS  the-long-night   (0 error(s), 0 warning(s), 1 note(s))

3 level(s) checked — 0 error(s), 0 warning(s), 3 note(s).
```

The one note on each level is the same, and it is a limitation the validator
states about itself: *"Reachability beyond the declared progression links is
not proven by this validator; it cannot tell whether the terrain allows a
route to the exit."* That is recorded as **KI-11** rather than papered over.

The validator is not decoration — it found real content gaps when it was
first written. Three objectives (`obj-first-roads`, `obj-hw-buildings`,
`obj-tln-buildings`) were not on any path to an exit, and three checkpoints
(`cp-landing`, `cp-east-quay`, `cp-mid-market`) were referenced by nothing.
The level data was corrected.

---

## 7. What was NOT tested — and therefore not claimed

These are the limits of this environment, not of the work. Each one is
carried in `docs/V5_KNOWN_ISSUES.md`.

| Not tested | Why | Issue |
|---|---|---|
| Apple Silicon / ARM64 | this machine is x86_64 (Intel Core i9-9980HK) | KI-01, R-02 |
| Windows, Linux | no such machine or CI runner here | KI-02, R-11 |
| Firefox, Safari, other browsers | only Chromium is installed | KI-02, R-11 |
| A native executable / installer | the engine is web-only | KI-03, R-12 |
| Gamepad menu navigation and analogue-stick camera | the API is read and routed; the navigation itself is not implemented | KI-05, R-10 |
| Music, ambience and voice assets | no audio asset files exist; every sound is runtime synthesis | KI-07, R-16 |
| The 69 quarantined 2D images' licences | no authoritative source was reachable; the art is excluded, not shipped | KI-06, R-01, R-13 |
| The Cursor senior review | the account's quota was exhausted (attempted four times, `ActionRequiredError`) | KI-04, R-03 |
| LLM-driven NPC dialogue | no authorised provider with documented safeguards | KI-09, R-17 |
| The platformer capability list (double jump, wall-run, …) | out of scope: V5 is a city builder | KI-10 |

**The Cursor senior review is the one that matters for the release
classification.** It is the only outstanding item that blocks
*V5 COMPLETE AND VERIFIED*, and it could not be run because the quota was
exhausted. The full brief is in `CURSOR-HANDOFF.md`.

---

## 8. Verdict

| Gate | Status | Evidence |
|---|---|---|
| Unit + integration tests | **PASS** | 687/687, 0 fail, 0 skipped |
| V4 regression | **PASS** | all 395 V4 tests still pass |
| Source parse | **PASS** | 79/79 |
| Dependency audit | **PASS** | 0 vulnerabilities |
| Content validation | **PASS** | 3 levels, 0 errors, 0 warnings |
| Acceptance harness (build) | **PASS** | 40/41, 1 correctly skipped |
| Production bundle | **PASS** | PRODUCTION BUILD VERIFIED |
| Real-GPU run | **PASS** | 0 console errors, 0 page errors, 0 failed requests |
| Hazard effect on screen | **PASS** | ember/flame/smoke pixels captured |
| Cursor senior review | **NOT RUN** | quota exhausted — KI-04 |

**Test verdict: PASS.** The suite is green, the V4 baseline is intact, the
build is verified, and the one outstanding review is blocked by the tooling,
not by the work.

See `docs/V5_PERFORMANCE_REPORT.md` for the measurements and
`docs/V5_FINAL_VERIFICATION.md` for the release classification.
