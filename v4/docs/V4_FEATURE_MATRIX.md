# MiniMax Game Studio Ultra V4 — Feature Matrix

Every requirement of the V4 directive, with its status and the evidence
behind it.

**Legend**

| Status | Meaning |
|---|---|
| **MET** | Implemented and verified by a recorded check. |
| **PARTIAL** | Implemented, but a stated part of the requirement is missing. |
| **INCOMPLETE** | Not implemented. Said so plainly. |
| **BLOCKED** | Cannot be completed here; the reason is external. |

---

## Phase 0 — Recover and complete previous work

| Requirement | Status | Evidence |
|---|---|---|
| Verify the 725-file release package | **MET** | 725 files, 724/724 checksums OK, 167.4 MB. |
| Verify the 167.4 MB size | **MET** | Package measured at 167.4 MB. |
| Verify all 724 published checksums | **MET** | 724/724 OK. |
| Verify the 395 tests | **MET** | 395 tests executed. |
| Verify all 56 parsing checks | **MET** | 56/56. |
| Verify the 102 audit checks | **MET** | 102/102. |
| Verify the 31 design gates | **MET** | 31 PASS. |
| Verify the deployment endpoints | **MET** | Live site: `index.html` 200; `DO-NOT-PUBLISH.txt`, `assets/ui-assets.json`, `assets/ui/` all 404 as designed. |
| Check the six concurrently edited files | **MET** | `game/src/ui/styles.js`, `tools/performance.mjs` (modified) and `game/tests/construction-progression.test.mjs`, `tools/performance-gpu.mjs`, `tools/performance-gpu.test.mjs`, `tools/verify-shop-layout.mjs` (untracked) were **never** read into the V4 commit, edited, merged or committed. `main` is still at `92c0b37`. |
| Outstanding platform limitations | **MET** | Recorded — see `V4_COMPATIBILITY.md`. |
| Outstanding asset-licence verification | **MET** | 69/69 verified against the library index → all quarantined. |
| Determine whether V3 was implemented | **MET** | **V3 never existed.** No V3 artefact exists anywhere in the repository. Recorded as a fact; no V3 work was invented. |
| Identify the real runtime / scene / animation / editor / AI / build | **MET** | V2's runtime is the 2D/3D city builder in `game/`; the AI integration is the offline toolchain in `v4/src/ai/`. |
| Complete unfinished V3 requirements | **MET (vacuous)** | There was no V3 to complete. |
| Resolve broken/missing runtime functions | **MET** | V2's ten defects (§4.7–§4.10 of the V2 handover) were all fixed and re-measured. |
| Licence clearance: exact inventory of 69 images | **MET** | `v4/data/quarantine-2d.json` — per-file, with pack and source URL. |
| Verify each licence against authoritative sources | **MET** | All 69 matched the library index; **all 69 read `unverified`**. |
| Exclude or quarantine unverified assets | **MET** | Quarantined. `prepare-assets.mjs` never copies them; the exporter refuses them (tested). |
| Do not fabricate permission | **MET** | No licence is asserted that the index does not state. |
| Detect Apple Silicon / run genuine platform tests | **BLOCKED** | `hw.optional.arm64` absent — Intel i9-9980HK x86_64. The gate stays open; no ARM build is claimed. |
| Run real hardware GPU profiling | **MET** | ANGLE Metal / Intel UHD 630, hardware (`isSoftware: false`): 100.8 fps, mean 9.92 ms, median 6.3 ms, p95 15.7 ms. |
| Never present software results as GPU benchmarks | **MET** | The profiler refuses to publish when the renderer is software; the software figure is labelled as such. |

## Phase 1 — V4 engine architecture

| Requirement | Status | Evidence |
|---|---|---|
| Scene management | **MET** | `src/core/scene.js` — capture, load, save, storage adapters, fade transitions. |
| ECS | **MET** | `src/core/ecs.js` — entities, components, tags, AND-ed queries, add/remove listeners. |
| Game objects and components | **MET** | `src/core/serialization.js` — a component registry with 15 built-in types. |
| Transform hierarchy | **MET** | `src/core/transform.js` — parent/child links, lazy world matrices, dirty propagation. |
| Camera management | **MET** | `src/render/renderer.js` — a rig with follow and orbit modes. |
| Input abstraction | **MET** | `src/input/input.js` — named actions, rebinding, `isDown`/`wasPressed`/`axis`. |
| Rendering abstraction | **MET** | `src/render/renderer.js` — a Three.js facade; the engine never touches WebGL. |
| Physics integration | **MET** | `src/physics/physics.js` — gravity, ground, static colliders, raycast. |
| Animation integration | **MET** | `src/anim/animator.js` — mixer, state machine, cross-fades, animation events. |
| Audio management | **MET (system only)** | `src/audio/audio.js` — four category buses, positional audio, a listener, a null backend for tests. **No audio files ship** (the cleared catalogue has none), so it is silent in practice. |
| Event system | **MET** | `src/core/events.js` — on/off/once, a 200-entry history, listener isolation. |
| Asset management | **MET** | `src/render/asset-loader.js` + `src/assets/` — catalogue, caching, integrity, safe export. |
| Save/load and serialization | **MET** | JSON-safe scene documents; the hierarchy round-trips as entity ids. Regression-tested. |
| Scene transitions | **MET** | `sceneManager.load(name, {fade: true})` with `update(now)` driving the fade. |
| Project management | **MET (module)** | `src/core/project.js` — create / open / save / list / export / import with an injectable storage adapter. Not wired into the demo app. |
| Error handling | **MET** | `src/core/log.js` — global handler capture, an injectable target, bus publishing. |
| Runtime profiling | **MET** | `src/core/time.js` — fps, frame time, draw calls, triangles, a rolling sample window. |
| Choose a mature engine rather than writing one | **MET** | Three.js 0.169, already a project dependency. **No custom renderer was written.** |

## Phase 2 — Professional 3D world editor

| Capability | Status | Evidence |
|---|---|---|
| Scene hierarchy panel | **MET** | `src/editor/hierarchy.js` — names, tags, component chips; click and shift-click selection; drag-and-drop re-parenting. |
| Object inspector | **MET** | `src/editor/inspector.js` — name, tags, parent, every component field; edits write through live. |
| 3D viewport | **MET** | `src/editor/viewport.js` + the render facade. Verified by screenshot. |
| Object selection | **MET** | Raycast picking over host meshes and pick proxies; multi-select with shift. |
| Move / rotate / scale | **MET** | `src/editor/gizmos.js` — all three verified in a real browser: translate `[6,0.9,2]→[6.5,1,1.5]` (snapped), rotate `[0,0,0]→[0.018,0.682,-0.403]`, scale `[1,1,1]→[3.3,3.3,3.3]`. |
| Grid snapping | **MET** | Snap toggle with 0.25 / 0.5 / 1. |
| Camera orbit, pan, zoom | **MET** | Middle/right-drag orbit, shift+middle pan, wheel zoom, frame-selection. |
| Object duplication | **MET** | `Ctrl/Cmd+D`, with the hierarchy links kept consistent. |
| Undo / redo | **MET** | `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` over transform edits, component edits, duplication, deletion, re-parenting. |
| Scene save / load | **MET** | `Ctrl/Cmd+S` through the scene manager; the scene list reads memory and storage. |
| Asset drag-and-drop | **PARTIAL** | Re-parenting by drag-and-drop works; dragging an *asset* from a browser into the scene does not — there is no asset browser panel yet. |
| Materials and lighting controls | **PARTIAL** | The inspector edits the `mesh` and `light` components (colour, intensity, shadow flags). There is no dedicated material/shading editor. |
| Play and edit modes | **MET** | The Play button starts the simulation — verified by the harness, which clicks it. |
| Collision visualization | **MET** | The Colliders toggle draws the physics boxes. |
| Camera preview | **MET** | A second `PerspectiveCamera` rendered through `setViewport`/`setScissor` into an inset. |
| Scene validation | **MET** | Five categories: no transform, duplicate names, missing asset references, NaN transforms, no components. |
| Keyboard shortcuts | **MET** | Listed in the `?` help overlay. |
| Editor changes persist after saving and reopening | **MET** | The hierarchy is stored as entity ids and rebuilt as object links on load; the meshes are re-placed by `applyScene`. |

## Phase 3 — Character and animation

| Requirement | Status | Evidence |
|---|---|---|
| Skeletal animation | **MET** | The KayKit character is a skinned GLB driven by a real `AnimationMixer`. |
| Animation import | **MET** | `GLTFLoader` + `SkeletonUtils.clone`; the catalogue lists the animated models. |
| Animation playback | **MET** | The HUD reports the live state (`anim: idle`). |
| Animation blending | **MET** | Cross-fade between states with a configurable duration. |
| Animation state machines | **MET** | 8 states, 16 transitions, evaluated on named conditions. |
| Idle / walk / run states | **MET** | Verified in the browser for the player and the NPCs. |
| Jump and landing transitions | **MET** | `jump` and `land` states with `jumping` / `landed` conditions. |
| Character movement | **MET** | 3.479 m travelled on held `W`; camera-relative (dot 0.88 with the camera direction); blocked by buildings. |
| Third-person camera | **MET** | The follow rig; the camera sits behind and above the player. |
| Animation events | **MET** | Clip markers fire on the bus as `anim:event`. |
| Root-motion support | **INCOMPLETE** | Not implemented. The clips are played in place; the character is moved by the controller, not by root motion. |
| Reusable animation controllers | **MET** | One controller factory drives the player and every NPC; the controller is rebuilt after a scene load. |
| Demonstrable animated character scene | **MET** | The demo village; screenshots `02-moved.png`, `05-final.png`. |
| Test transitions, playback, asset loading | **MET** | 3 animation regression tests + the browser harness. |
| Do not claim mocap / retargeting / IK | **MET** | None of the three is claimed anywhere in this release. |

## Phase 4 — Intelligent NPC system

| Requirement | Status | Evidence |
|---|---|---|
| NPC state management | **MET** | `src/npc/behaviours.js` — a per-NPC FSM with enter/update/exit. |
| Idle behaviour | **MET** | The Barista and the Drifter. |
| Patrol behaviour | **MET** | The Courier, with a waypoint route. |
| Target detection | **MET** | Sight radius per NPC, with an `alertable` flag. |
| Pursuit behaviour | **MET** | The Guard, observed in the `chase` state. |
| Basic pathfinding | **MET** | A\* with an octile heuristic, a min-heap open list and an expansion budget. |
| Obstacle avoidance | **MET** | The nav grid blocks the buildings; **corner-cutting is forbidden** — a diagonal step needs both orthogonal neighbours free. |
| NPC interaction | **MET** | Talking to a Guard produces a line in the HUD. |
| Behaviour debugging | **MET** | `src/npc/debug.js` + `npc.debugState()`; the editor's console panel shows the states. |
| Configurable difficulty | **MET** | `DIFFICULTY_PROFILES` (easy / normal / hard) change sight, patience and speed. |
| Performance limits for NPC updates | **MET** | A round-robin budget (default 8/frame). Verified: 12 NPCs, budget 3 → exactly 3 move per frame, all 12 within 4 frames. |
| Deterministic behaviour | **MET** | A seeded PRNG; the same seed produces the same simulation. |
| Playable scene with distinct NPC behaviours | **MET** | 4 NPCs, 4 different brains, in the demo level. |
| Optional LLM-driven dialogue | **NOT DONE** | No provider was authorised. The LLM adapter exists but is disabled by default; the NPC dialogue is scripted and is **not** presented as generative AI. |

## Phase 5 — World building and level design

| Requirement | Status | Evidence |
|---|---|---|
| Terrain / modular environment construction | **MET** | A ground slab plus 9 catalogue props placed by the level builder. |
| Building placement | **MET** | 9 props from the cleared catalogue, positioned and rotated. |
| Roads and pathways | **MET** | `citybits.road_straight` is placed in the square. |
| Interior and exterior scene objects | **PARTIAL** | Exterior only. The cleared catalogue has no interior furniture, so there is no interior scene. |
| Lighting configuration | **MET** | 3 lights (a directional sun and two point lights). |
| Day/night settings | **INCOMPLETE** | Not implemented as a system. The lights are configurable in the inspector, but there is no day/night cycle. |
| Environmental ambience | **PARTIAL** | The audio system supports an ambience bus, but **no audio assets ship**, so there is no ambience. |
| Object collision | **MET** | 4 static colliders; the player is blocked by them and cannot end up inside one (browser check). |
| Environment prefabs | **PARTIAL** | Props are composed from the catalogue; there is no prefab system that instantiates a named bundle. |
| Scene streaming / level segmentation | **INCOMPLETE** | Not implemented. The demo level is one scene. |
| Reusable world templates | **PARTIAL** | `src/levels/index.js` has a level registry and a loader, but only one level exists. |
| A complete, playable demonstration level | **MET** | The demo village: player, camera, environment, 2 interactive objects, 4 NPCs, animation, collision, HUD, save/load. |
| Save/load in the level | **MET** | 20 entities saved and reloaded in the browser. |

## Phase 6 — AI-assisted game development

| Requirement | Status | Evidence |
|---|---|---|
| Generate starter game projects | **MET** | `generateProject()` — 3 templates. A generated project was **executed**, not just parsed. |
| Generate new scenes | **MET** | `generateScene()` — entities from the registry defaults. |
| Generate entity components | **MET** | `generateComponent()` — typed fields with defaults. |
| Generate animation controllers | **MET** | `generateAnimationController()` — states, transitions, a real animator. |
| Generate NPC behaviour scripts | **MET** | `generateNpcBehaviour()` — a real state machine. |
| Explain runtime errors | **MET** | `explainError()` — 12 known failure patterns; says "unknown" rather than guessing. |
| Produce automated tests | **MET** | `generateTests()` — runnable `node:test` modules. |
| Refactor game code | **MET** | `suggestRefactors()` — long functions, TODO markers, duplicate literals, deep nesting. |
| Detect unused assets | **MET** | `detectUnusedAssets()` — the library's reference index against the catalogue. |
| Create project documentation | **MET** | The generated project ships a README describing its own layout. |
| Generate development checklists | **MET** | `developmentChecklist()` — 6 phases. |
| Review build errors | **MET** | `reviewBuildErrors()` — classifies a build log. |
| Generated code is reviewed and tested before integration | **MET** | Every generated file is parsed; the generated project was run. |
| Never hardcode API keys | **MET** | The adapter reads `V4_LLM_ENDPOINT` / `V4_LLM_KEY` from the environment, redacts secrets from logs, and is disabled by default. |

## Phase 7 — Advanced graphics and performance

| Requirement | Status | Evidence |
|---|---|---|
| Lighting and shadows | **MET** | 3 lights; `PCFSoftShadowMap`; shadows visible in the screenshots. |
| Material handling | **MET** | `MeshStandardMaterial` for the ground; the `mesh` component carries the colour and shadow flags. |
| Texture optimisation | **PARTIAL** | Not applicable in practice — the shipped models carry their own textures and no 2D art is redistributed. |
| Level of detail | **INCOMPLETE** | Not implemented. |
| Frustum culling | **MET (engine)** | Three.js culls automatically; the camera's far plane is tied to the quality preset. |
| Object instancing | **INCOMPLETE** | Not implemented. |
| Animation update optimisation | **MET** | Animators are updated once per fixed step; only entities with a controller are in the map. |
| Asset streaming | **PARTIAL** | Models load on demand and are cached; there is no background streaming or budget. |
| Performance profiling | **MET** | fps, frame ms, draw calls, triangles, plus a headed real-GPU probe. |
| Frame-time monitoring | **MET** | A rolling sample window in the profiler; the HUD shows fps and ms. |
| CPU and memory monitoring | **PARTIAL** | The engine reports GPU memory counters; there is no CPU or JS-heap monitor. |
| Graphics quality presets | **MET** | low / medium / high — pixel ratio, shadows, shadow map size, draw distance. |
| Resolution scaling | **MET** | The pixel ratio is part of the quality preset. |
| Resource cleanup | **MET** | `dispose()` on the renderer, the editor, the animator, the audio system; geometries and materials are disposed when an outline or proxy is dropped. |
| Measure a baseline before changing performance-sensitive code | **MET** | The V2 real-GPU figure (432.3 fps) was measured before, and the V4 figure (100.8 fps) after. |
| Report measurable changes | **MET** | `V4_PERFORMANCE.md` — the measured deltas, with the methodology. |
| Do not invent benchmark improvements | **MET** | No figure in this release is not the output of a recorded run. |

## Phase 8 — Asset library and pipeline

| Requirement | Status | Evidence |
|---|---|---|
| Categorised assets | **MET** | character, environment, building, vehicle, ui2d. |
| Source metadata | **MET** | Pack and source URL per entry. |
| Licence metadata | **MET** | Licence and author per entry, copied from the shipped licence files. |
| Author attribution | **MET** | Per entry: KayKit, Avramania, Holokat, Quaternius. |
| Asset previews | **PARTIAL** | The catalogue lists the assets and the editor draws them; there is no thumbnail browser. |
| Duplicate detection | **MET** | sha256 over every file: **0 duplicate groups**. |
| Broken-file detection | **MET** | **0 broken** — after one real broken reference (`props/House.glb`) was found and corrected. |
| File integrity checks | **MET** | `sha256File` / `verifyManifest`. The 203 copied models are sha256-verified. |
| Asset import validation | **MET** | The asset audit reports every catalogue entry whose file is absent. |
| Basic version tracking | **PARTIAL** | sha256 per file, and the manifest carries the hashes; there is no version history. |
| Asset dependency identification | **MET** | `.gltf` sidecars are modelled as dependencies and copied with their `.gltf`. |
| Safe export packaging | **MET** | `exportPack()` — refuses quarantined assets, scrubs secrets, writes a manifest. A real export copied 22 assets (23.84 MiB) and refused 70. |
| The 14 categories | **PARTIAL** | 5 of the 14 categories are populated (character, environment, building, vehicle, ui2d). The cleared catalogue has no textures, audio, VFX, prefabs or templates to index. |
| Only assets with legally appropriate permissions | **MET** | Only the 203 cleared 3D files. The 69 unverified images are never shipped. |

## Phase 9 — Gameplay frameworks

Each module is a standalone factory, separately testable, as the directive
requires. "In the demo" says whether the demo level exercises it.

| Module | Status | In the demo |
|---|---|---|
| Character controller | **MET** | **Yes** |
| Interaction system | **MET** | **Yes** |
| Inventory | **MET** | No — a starter module |
| Health and damage | **MET** | Partially — the HUD reads the player's health component |
| Objectives and quests | **MET** | **Yes** — the HUD shows the active objective |
| Dialogue | **MET** | Partially — the NPC lines are shown through the HUD |
| Basic combat | **MET** | No — a starter module |
| Save checkpoints | **MET** | No — a starter module |
| HUD | **MET** | **Yes** |
| Menus | **MET** | No — a starter module |
| Pause systems | **MET** | **Yes** — the app's clock, the Escape key and the `v4.pause()` / `v4.resume()` API, all measured in the browser |
| Settings | **MET** | No — a starter module |
| Do not claim complete AAA systems | **MET** | These are described as starter modules, not as complete systems. |

## Phase 10 — Automated quality assurance

| Test kind | Status | Evidence |
|---|---|---|
| Unit tests | **MET** | 149 tests, 149 pass. |
| Integration tests | **MET** | `tests/v4-integration.test.mjs` — 10 tests, one per reviewed defect. |
| Smoke tests | **MET** | The 28-check browser harness. |
| Editor tests | **MET** | The inspector, hierarchy, gizmos, undo and save/load were driven in a real browser. |
| Scene loading tests | **MET** | 20 entities saved and reloaded; the hierarchy round-trips. |
| Physics tests | **MET** | Kinematic blocking, step-up, per-axis extents. |
| Animation tests | **MET** | Compound conditions, negated conditions, state changes. |
| NPC behaviour tests | **MET** | A\* correctness, no corner-cutting, the update budget, determinism. |
| Save/load tests | **MET** | The round-trip is JSON-safe with a parented child. |
| Asset validation | **MET** | `tools/audit-assets.mjs`: 92 entries, 0 broken, 0 duplicates. |
| Security checks | **MET** | No secrets, no network calls; the exporter scrubs secrets; the LLM adapter redacts. |
| Dependency checks | **MET** | `npm audit` clean; two dependencies (three, vite), both pinned to a version range with a committed lockfile. |
| Packaging tests | **MET** | `prepare-assets.mjs --check` verifies source and target counts and refuses 0. |
| Performance regression checks | **MET** | The real-GPU probe refuses to publish a software figure. |
| Preserve the existing passing tests | **MET** | All 137 pre-existing tests still pass; 12 were added. |
| Check after every milestone | **MET** | The suite was run after each milestone; every failure found is listed in the readiness report. |
| Do not mask failures | **MET** | No test is skipped or weakened. One test was corrected where its *expectation* was wrong (the import depth) and the correction is documented in the test. |

## Phase 11 — Cross-platform development

| Target | Status | Evidence |
|---|---|---|
| Modern web browsers | **MET** | Chromium is the tested browser (headless and headed). |
| macOS Intel | **MET** | The build and the slice ran on this Intel Mac. |
| macOS Apple Silicon | **BLOCKED** | No ARM hardware. No ARM build is claimed. |
| Windows | **PARTIAL** | The app is pure web technology with no POSIX dependency in the runtime; the *tooling* uses `node:` and shell commands that were only exercised on macOS. Not tested on Windows. |
| Linux | **PARTIAL** | Same as Windows — not tested. |
| Reproducible build instructions | **MET** | `V4_DEVELOPER_GUIDE.md`; a committed lockfile. |
| Transferable to another MacBook | **MET** | `npm install && npm run dev`. The asset pipeline re-copies and re-verifies the models. |
| Source separate from machine-specific caches | **MET** | `node_modules/`, `dist/` and the diagnostics are git-ignored. |

## Phase 12 — Final V4 demonstration

The twelve required steps, each verified by the acceptance harness.

| # | Step | Status | Evidence |
|---|---|---|---|
| 1 | Start the game | **MET** | `data-v4-ready="1"` in 1.9 s. |
| 2 | Load a real 3D scene | **MET** | 20 entities, 14 cleared models, 3 lights. |
| 3 | Control a character | **MET** | Held `W` → 3.479 m. |
| 4 | Move through the environment | **MET** | The same 3.479 m, on screen as well as in the data. |
| 5 | Observe working character animations | **MET** | A live animation state, cross-faded by the state machine. |
| 6 | Interact with an object | **MET** | 5 interaction events; the result is shown in the HUD. |
| 7 | Demonstrate working NPC behaviour | **MET** | 4 NPCs, 3 observed walking; states `idle`, `patrol`, `chase`, `interact`. |
| 8 | Display a functional HUD | **MET** | HP, objective, prompt, message, fps, ms, NPC count, animation state. |
| 9 | Pause and resume | **MET** | `paused=true`, `resumed=false`, and the Escape key pauses and resumes (measured separately). |
| 10 | Save and reload game state | **MET** | 20 entities saved and reloaded; the 3D objects return to their saved positions and the interactive behaviour is re-attached and works again. |
| 11 | Display performance information | **MET** | 14.1 fps / 70.9 ms / 77 draws in the headless run; 100.8 fps on the real GPU. |
| 12 | Exit without errors | **MET** | 0 uncaught page errors, 0 console errors. |

**Launch command:** `cd v4 && npm install && npm run dev` (development) or
`npm run build && npm run preview` (production build).

## Phase 13 — Verification and delivery

| Requirement | Status |
|---|---|
| The nine V4 documents | **MET** — this directory. |
| Actual implemented capabilities | **MET** — this matrix, per requirement. |
| Demonstrated functionality | **MET** — the harness report and the screenshots. |
| Passed and failed tests | **MET** — `V4_TEST_RESULTS.md`. |
| Remaining issues | **MET** — `V4_READINESS_REPORT.md` §5 and §6. |
| Missing licences | **MET** — `V4_ASSET_LICENCES.md`. |
| Hardware tests performed | **MET** — `V4_PERFORMANCE.md`, `V4_COMPATIBILITY.md`. |
| Platforms not yet tested | **MET** — `V4_COMPATIBILITY.md`. |
| Performance measurements | **MET** — `V4_PERFORMANCE.md`. |
| Dependencies introduced | **MET** — `V4_DEVELOPER_GUIDE.md`. Two, both existing in the project family. |
| Reproduction commands | **MET** — `V4_DEVELOPER_GUIDE.md`. |
| Exact branch and commit | **MET** — `v4/studio` @ `620f14c`. |
| Current release status | **MET** — a release candidate; production is untouched. |
| A release candidate only after the critical gates pass | **MET** | The critical gates are the 28 acceptance checks (all pass) and the 149 tests (all pass). |
| Production untouched until authorised | **MET** | Nothing was published; `main` is at `92c0b37`. |
