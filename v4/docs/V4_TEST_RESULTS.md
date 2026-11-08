# MiniMax Game Studio Ultra V4 — Test Results

Every number below is the output of a command that was run in this
repository. Nothing is estimated.

**Overall: 149 tests, 149 pass, 0 fail, 0 skipped, 0 todo.**
**24 of 24 browser acceptance checks pass.**
**56 of 56 source files parse.**

---

## 1. The unit suite

```sh
cd v4-worktree/v4
node --test "tests/*.test.mjs"
```

```
1..149
# tests 149
# suites 0
# pass 149
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

| Test file | Pass | Fail | Covers |
|---|---|---|---|
| `core-ecs.test.mjs` | 11 | 0 | Entity lifecycle, components, tags, queries, disabled entities, per-world ids |
| `core-transform.test.mjs` | 11 | 0 | Matrix composition, the hierarchy, dirty propagation, float hygiene |
| `core-serialization.test.mjs` | 8 | 0 | The scene round-trip, unknown component types, the registry |
| `core-scene.test.mjs` | 7 | 0 | Capture, load, save, storage adapters, the scene events |
| `core-events.test.mjs` | 11 | 0 | On/off/once, history, listener isolation |
| `core-time.test.mjs` | 11 | 0 | The fixed-step clock, the profiler, pause behaviour |
| `core-log.test.mjs` | 9 | 0 | Levels, records, the bus, the global handlers |
| `assets-library.test.mjs` | 22 | 0 | The catalogue, integrity, duplicates, broken files, the refusal to export quarantined assets |
| `ai-generators.test.mjs` | 20 | 0 | Every generator; the generated code is parsed and, for a project, executed |
| `ai-tooling.test.mjs` | 27 | 0 | The error explainer, the analysers, the checklist, the LLM adapter's refusal path |
| `v4-integration.test.mjs` | 10 | 0 | One test per defect found by the review — see §4 |
| **Total** | **149** | **0** | |

### Running the suite

`node --test tests/` does **not** work on this Node (v22.14.0): it resolves
the directory as a module and fails with `Cannot find module …/tests`.
`tests/index.mjs` plus `tests/package.json` make that form work as well, and
the npm script uses the glob form:

```json
"test": "node --test tests/"
```

```sh
npm test                 # the directory form, via tests/index.mjs
node --test "tests/*.test.mjs"   # the glob form
```

Both run the same 149 tests.

---

## 2. The syntax check

```sh
npm run check
```

```
56/56 files parse cleanly.
```

Every file under `src/` and `tools/` is copied to a temporary `.mjs` and run
through `node --check`, so a module that only ever runs as an ES module in
the browser is still parsed as one.

---

## 3. The browser acceptance run

```sh
npm run slice
```

This starts the production build in a preview server, drives it in a real
Chromium, and records what it observed. The full report and five
screenshots are written to `v4/verification/slice/`.

| # | Check | Result | Observed |
|---|---|---|---|
| 1 | the app reaches ready state | **PASS** | 2024 ms |
| 2 | the world is populated | **PASS** | 20 entities |
| 3 | a player entity exists | **PASS** | entity 11 |
| 4 | the editor is mounted | **PASS** | — |
| 5 | the NPC system is mounted | **PASS** | — |
| 6 | the HUD is mounted | **PASS** | — |
| 7 | the inspector renders the selected entity | **PASS** | 969 chars |
| 8 | the inspector does not raise errors | **PASS** | 0 new error(s) |
| 9 | the editor Play button starts the simulation | **PASS** | mode=play |
| 10 | the character moves on input | **PASS** | 3.079 m |
| 11 | the character mesh follows the entity | **PASS** | 3.079 m on screen |
| 12 | forward walks away from the camera | **PASS** | dot=0.88 (camera dir [0,1]) |
| 13 | the character has a live animation state | **PASS** | idle |
| 14 | one key press triggers exactly one interaction | **PASS** | 1 new event(s) of 1 total |
| 15 | the interaction produces a result | **PASS** | result={"speaker":"Barista","text":"The coffee is fresh. Or it was."} |
| 16 | the interaction result is shown in the HUD | **PASS** | HP 100 / 100 Explore the district Talk to Barista The coffee is fresh. Or it was. 9 fps · 113.7 ms 4 NPCs anim: idle |
| 17 | the player is not inside a building | **PASS** | 4 colliders, none overlapping |
| 18 | NPCs are simulated | **PASS** | 4 NPCs, states: interact, chase, idle |
| 19 | at least one NPC walks on screen | **PASS** | 3 of 4 NPCs moved |
| 20 | the HUD renders content | **PASS** | HP 100 / 100 Explore the district Talk to Barista The coffee is fresh. Or it was. 11 fps · |
| 21 | pause and resume work | **PASS** | paused=true resumed=false |
| 22 | the Escape key pauses and resumes | **PASS** | after Escape: paused=true, after Escape again: paused=false |
| 23 | the scene saves and reloads | **PASS** | 20 entities |
| 24 | the reload restores the 3D objects, not just the entity data | **PASS** | prop #2 saved at [-12.0,0.0,-9.0] moved to [-8.0,0.0,-5.0] restored to [-12.0,0.0,-9.0] |
| 25 | interaction still works after a reload | **PASS** | onInteract present, target #16, 1 new event(s), result="The chest is empty, except for a faded photograph." |
| 26 | the performance readout is live | **PASS** | 14.1 fps, 70.9 ms/frame, 77 draws |
| 27 | no uncaught page errors | **PASS** | — |
| 28 | no console errors | **PASS** | — |

**28 / 28.**

The harness deliberately measures the *screen* as well as the data: check 11
reads the mesh's position, not just the entity's, because a character that
moves in the data but stands still on screen is not a playable game.

### Screenshots

| File | What it shows |
|---|---|
| `verification/slice/01-boot.png` | The editor: toolbar, hierarchy, viewport with the village, inspector, console |
| `verification/slice/01b-inspector.png` | The inspector with the player selected |
| `verification/slice/02-moved.png` | Play mode, after the character has walked |
| `verification/slice/03-interaction.png` | The interaction prompt and the resulting line |
| `verification/slice/04-hud.png` | The HUD close-up |
| `verification/slice/05-final.png` | The final state after the save/reload cycle |

---

## 4. The integration regression tests

`tests/v4-integration.test.mjs` holds one test per defect the review
found. They are the executable form of the findings: if one breaks again,
the corresponding bug is back.

| Test | The defect it guards |
|---|---|
| A kinematic body is pushed out of a static collider | The player walked through buildings |
| A body can still step onto a low collider | The fix must not make every obstacle a wall |
| A box uses its own extents per axis, not the vertical one | A wide, flat body passed through walls |
| A scene document with a parented child is JSON-safe | The core save format threw on `JSON.stringify` |
| A loaded scene rebuilds the hierarchy as object links | A loaded scene had a hierarchy of numbers |
| `toPlainData` copies a shared value twice and marks only a real cycle | Shared references were corrupted |
| The animation component never carries a live animator into the document | The mixer reached the save format |
| A compound transition condition can fire | `!sprinting && moving` could never be true |
| A negated condition returns the character to idle | The NPCs never returned to idle |
| A quarter turn produces an exact zero instead of float dust | `cos(π/2)` leaked 1e-16 into the matrices |
| One key press triggers one action, however many fixed steps a frame runs | One press of E interacted up to five times |
| A scene reload restores the interactive callbacks, not just the data | A reloaded world was inert: the prompt showed, nothing happened |

### Defects found in the final integration pass

Three real defects were found after the first full green run, by tightening the
acceptance harness rather than by reading the code. All three are fixed and
guarded by the tests above.

| Defect | How it was found | Fix |
|---|---|---|
| **One key press triggered several actions.** The fixed-step clock runs up to five catch-up steps in one frame, and every step read the same key-down edge, so a single press of E interacted five times and a press of Escape toggled the pause five times. | The acceptance harness counted the interaction events and found 5 for one key press. | `Input.consumeEdges()` clears the key-down edges after the first simulation step. The key is still *held*, so movement is unaffected. |
| **The Escape key did nothing.** The pause module existed and was unit-tested, but the app never created it, and its `update()` called a `toggle` that was not in scope — a `ReferenceError` thrown every frame once it *was* wired. | The harness pressed Escape and the game did not pause; the console showed `toggle is not defined`. | The app now creates the pause controller, and `toggle` is a closure function rather than a method of the returned object. The pause key is read outside the simulation, because a paused clock stops the fixed steps. |
| **A scene load left the world inert.** A callback is a runtime handle, so it never reaches the save format; a load rebuilt the entities from the saved data and left every interactive entity without its `onInteract`. Pressing E showed the prompt and did nothing. | The harness re-interacted with the chest after a reload and the HUD showed the *prompt* instead of the result. | `level.rebindInteractions()` re-attaches the handlers on load, exactly as `rebindAnimators()` rebuilds the animation controllers. |

The third defect is the reason the acceptance harness now asserts on the
**event payload** rather than on the HUD text. The HUD always shows the prompt
("Open chest"), so a check that matched the prompt passed while the
interaction produced nothing at all. The harness reads
`bus.history('gameplay:interaction').at(-1).payload.result` and requires it to
be a non-empty string or a `{speaker, text}` object.

---

## 5. The asset audit

```sh
node tools/audit-assets.mjs
```

| Measure | Value |
|---|---|
| Catalogue entries | 92 |
| Cleared 3D models | 23 catalogue entries → 203 files on disk (71.5 MB copied, 92 MB with the sidecars) |
| Quarantined 2D images | 69 |
| Duplicate content groups | **0** — every file has unique content |
| Broken files | **0** — every catalogue entry points at a file that exists |
| Known bytes | 24.14 MiB |

**A real defect was found here.** The catalogue listed `props.house` →
`props/House.glb`, and no such file exists in the shipped pack (the pack has
`Warehouse.glb`). The browser run surfaced it as a model that failed to
load. The entry now points at the file that exists.

---

## 6. The real-GPU measurement

```sh
node scripts/gpu-profile.mjs "http://127.0.0.1:4186/" --out verification/gpu --seconds 10 --label v4
```

```
GPU: ANGLE (Intel, ANGLE Metal Renderer: Intel(R) UHD Graphics 630, Unspecified Version) (Google Inc. (Intel))
software renderer: no — hardware
frames: 1016 | 100.8 fps | mean 9.92 ms | median 6.3 ms | p95 15.7 ms
engine: 68.8 fps | 312 draws | 151980 tris
console errors: 0
```

The probe **refuses to publish a figure** when the renderer turns out to be a
software implementation — it checks `WEBGL_debug_renderer_info` rather than
assuming. The software-GL number from the headless harness (12.4 fps,
80.94 ms) is a floor, not a GPU measurement, and is reported as such.

Details in `V4_PERFORMANCE.md`.

---

## 7. The AI toolchain's own tests

The generated code is not merely parsed:

- Every generated file is written to a temporary `.mjs` and run through
  `node --check` (a test asserts this).
- A generated **project** was written to `/tmp` and **executed**: its
  generated test passed and `import(main.js).boot()` created 4 entities.
- The asset exporter was run for real: it copied 22 assets (23.84 MiB),
  refused 70, and never created `assets/ui/`.

---

## 8. What is **not** covered by an automated test

Stated plainly, so nothing here reads as more solid than it is.

| Not covered | Why | How it was checked instead |
|---|---|---|
| Apple Silicon | No ARM hardware | Not checked at all. The gate is open. |
| Windows and Linux | No such machine available | Not checked. The runtime is pure web technology; the tooling was only exercised on macOS. |
| Browsers other than Chromium | Only Chromium is installed | Not checked. |
| The visual quality of the scene | A test cannot judge a picture | Reviewed by eye in the screenshots. |
| Motion capture, retargeting, IK | Not implemented | Not applicable. |
| Audio output | No audio assets ship | The audio system's state machine is tested; no sound is heard. |
| A native (non-web) build | V4 is a web app | Not applicable. |
| The native `TransformControls.dispose()` bug in three r169 | A third-party bug | Worked around in the editor's `dispose()`, verified by a browser sweep. |
| Load, memory and thermal behaviour over long sessions | A 10-second profile is not a soak test | Not checked. |

---

## 9. How to reproduce all of it

```sh
cd v4-worktree/v4
npm install
npm test                                        # 149 tests
npm run check                                   # 56/56 files parse
npm run build                                   # production build
npm run slice                                   # 28 acceptance checks + screenshots
node tools/audit-assets.mjs                     # the asset inventory
node tools/checklist.mjs --phase release        # the release checklist
```

The two diagnostics exist because a real defect needed explaining:

```sh
node scripts/diagnose-boot.mjs --headed --seconds 14   # why did the app not reach ready?
node scripts/probe-edit-camera.mjs                    # why was the viewport empty?
```

Both print the measured state — the console log, the HTTP failures, the
camera pose, the scene contents — rather than a guess.
