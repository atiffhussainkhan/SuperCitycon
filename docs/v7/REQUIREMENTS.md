# SuperCitycon V7 — Requirements

**Target version:** 7.0.0
**Baseline:** V6 at `ecc30fc4c25ebb3b0cb9dd2b1a261dee3df99c7d` (`v6/upgrade-Zehe03`)
**Branch:** `development/v7`
**Document status:** the specification this release is built and verified against

---

## A. Executive objectives

V6 delivered the **input** half of the player-facing work: a full gamepad
path with a real dead zone, real button edges, a visible focus ring and an
analogue camera. It left three gaps that a player actually feels:

1. **The citizens do not walk.** They move in a straight line from A to B,
   through buildings and through water. The population is the part of the
   game the player looks at, and it is the part that looks least alive.
2. **There is no touch.** The game is a web game and the deployment target is
   the open web. On a phone it is a picture of a city that cannot be moved.
3. **The content pipeline cannot prove its own levels are playable.** The
   level validator says so in its own output: reachability "is not proven".

V7 closes those three gaps, plus one real defect V6 inherited from V5, and
proves every claim with an automated check.

**The theme: Navigation, Touch and Pipeline Truth.** Nothing in V7 is a
version number, a colour change or a documentation-only promise.

---

## B. Current V6 baseline

| | |
|---|---|
| **Repository** | `SuperCitycon` |
| **Remote** | `git@github.com:atiffhussainkhan/SuperCitycon.git` |
| **V6 release commit** | `ecc30fc4c25ebb3b0cb9dd2b1a261dee3df99c7d` |
| **Engine** | Three.js 0.169.0 |
| **Language** | JavaScript (ES modules), no TypeScript |
| **Build** | Vite 7.3.7 |
| **Test runner** | `node --test` (the Node built-in) |
| **Targets** | Web — Chromium verified |
| **Save schema** | version 2 (unchanged since V5) |

**Baseline measurements, taken in the V7 worktree at `ecc30fc`:**

| Check | Command | Result |
|---|---|---|
| Unit suite | `npm test` | 770 tests, 770 pass, 0 fail, 0 skipped (9 suites) |
| Syntax | `npm run check` | 85/85 source files parse cleanly |
| Content | `node tools/validate-content.mjs` | 3 levels — 0 errors, 0 warnings, 3 notes |
| GPU tooling | `node --test ../tools/performance-gpu.test.mjs` | 5 tests, 5 pass |
| Dependencies | `npm audit` | 0 vulnerabilities |
| Cleared build | `npm run build:cleared` | 218 files, licence policy **CLEARED** |
| Browser acceptance | `npm run verify:production -- --profile cleared` | 40/41 passed, 1 skipped — **PRODUCTION BUILD VERIFIED** |
| Gamepad acceptance | `node tools/scenario-gamepad.mjs` | 19/19 checks passed |

---

## C. Existing functionality (verified at the V6 baseline)

| System | Where | State |
|---|---|---|
| Game loop, fixed step | `src/main.js` | VERIFIED WORKING |
| Core state, save / load | `src/core/state.js`, `src/core/save.js` | VERIFIED WORKING |
| Modes, progression, stages | `src/core/modes.js`, `src/core/stage.js` | VERIFIED WORKING |
| Grid, terrain, water | `src/world/` | VERIFIED WORKING |
| Buildings, placement, catalogue | `src/buildings/` | VERIFIED WORKING |
| Economy, budget, resources | `src/economy/` | VERIFIED WORKING |
| Mobility, traffic | `src/mobility/` | VERIFIED WORKING |
| Population, citizens, happiness | `src/population/` | VERIFIED WORKING (the *walking* is the defect, below) |
| Services, coverage | `src/services/` | VERIFIED WORKING |
| Hazards, crises | `src/hazards/` | VERIFIED WORKING |
| Content, levels, validation | `src/content/` | VERIFIED WORKING (reachability is the gap, below) |
| Renderer, assets, post FX | `src/render/` | VERIFIED WORKING |
| HUD, menus, camera, settings | `src/ui/` | VERIFIED WORKING |
| SCC Studio voxel editor | `src/studio/` | VERIFIED WORKING (undo/redo already present) |
| Keyboard input | `src/ui/camera.js`, `src/core/input-map.js` | VERIFIED WORKING |
| Gamepad input | `src/core/gamepad.js`, `src/ui/gamepad.js` | VERIFIED WORKING (simulated pad only) |
| Audio | `src/audio/` | VERIFIED WORKING (fully synthesised; no audio files) |

---

## D. Identified technical debt

| id | Debt | Where | V7 treatment |
|---|---|---|---|
| D-01 | The citizen path is a straight line with a random lateral offset | `src/population/citizens.js` `buildPath()` | **Fixed** by V7-FR-001…005 |
| D-02 | No touch input of any kind | the whole input stack | **Fixed** by V7-FR-006…012 |
| D-03 | The level validator cannot prove reachability | `src/content/validate.js` | **Fixed** by V7-FR-013…014 |
| D-04 | A held key keeps panning the camera while the menu is open | `src/ui/camera.js` `onKeyDown()` | **Fixed** by V7-FR-015 |
| D-05 | The save file is dominated by JSON-encoded terrain arrays | `src/core/state.js` | **Carried.** Changing the save format would break every existing city; the schema stays at version 2. Recorded in `docs/v7/KNOWN_ISSUES.md`. |
| D-06 | The 2D HUD art licence is unresolved | `game/public/assets/ui` | **Carried.** It does not ship; the cleared build strips it. |
| D-07 | No Windows / Linux / non-Chromium / ARM verification | the environment | **Carried.** Recorded honestly in `docs/v7/PLATFORM_COMPATIBILITY.md`. |

---

## E. Confirmed V6 defects

Every one of these was reproduced on the V6 baseline before V7 changed
anything. Each carries a V7 test that fails on `ecc30fc` and passes on V7.

| id | Defect | Reproduced by |
|---|---|---|
| **BUG-01** | A citizen walks in a straight line through a building and through water. The path is `from → midpoint+offset → to`, with no knowledge of the world. | `game/src/population/citizens.test.mjs` (V7) |
| **BUG-02** | Holding a movement key and then opening the menu leaves the camera panning under the menu. The key handler returns early when the menu is open, but the held-key set is never cleared. | `game/src/ui/ui.test.mjs` (V7) |
| **BUG-03** | The level validator reports "reachability … is not proven" for all three authored levels. Nothing in the codebase attempts it. | `game/src/content/validate.js` output |

---

## F. V7 functional requirements

### Navigation (the citizens)

| id | Requirement | Acceptance criteria |
|---|---|---|
| **V7-FR-001** | A **pure** grid pathfinder shall exist in CORE: A* over the 64 × 64 city grid, 8-way movement, with the standard admissible heuristic. | `core/navigation.js` imports nothing but `core/config.js`; it never imports `three` and never touches the DOM. |
| **V7-FR-002** | The pathfinder shall be **deterministic**: the same start, goal and obstacle map always produce the same path, byte for byte. | The same call 100 times returns an identical array; the tie-break is a fixed neighbour order, never a random one. |
| **V7-FR-003** | The pathfinder shall respect a **node budget**. A search that exceeds it returns the best partial path found, not an infinite loop. | A blocked goal returns `null` within the budget; the search visits at most `budget` nodes. |
| **V7-FR-004** | The obstacle model shall be derived from the **live city**: water blocks, buildings block their footprint, steep terrain costs more to cross. | A path never crosses a water cell or a building footprint. |
| **V7-FR-005** | Citizens shall **walk their pathfinding path**, cell by cell, and shall **face the direction of travel**. | A citizen spawned across a building arrives at its destination and does not pass through the building. |
| **V7-FR-006** | The path shall be **smoothed** — the collinear cells between two turns are removed, so a citizen walks a straight line where it can. | A path across open ground has at most one waypoint per turn. |
| **V7-FR-007** | The pathfinder shall expose a **debug** mode: the path, its cost and the visited-cell count are returned, so a developer can see why a citizen went the way it did. | `findPath(..., { debug: true })` returns `{ path, cost, visited, reason }`. |

### Touch (the platform)

| id | Requirement | Acceptance criteria |
|---|---|---|
| **V7-FR-008** | A **pure** gesture recogniser shall exist in CORE. It turns a stream of touch points into gestures: **tap**, **double-tap**, **long press**, **drag** (with velocity), and **pinch** (with scale and rotation). | `core/touch.js` is pure, imports nothing, and is fully unit-testable in Node. |
| **V7-FR-009** | The gesture recogniser shall be **frame-rate independent**: the long-press threshold is in milliseconds and the drag threshold is in pixels, never in frames. | The same gesture sequence produces the same gesture at 30 Hz and at 144 Hz. |
| **V7-FR-010** | A **one-finger drag pans the camera**, a **two-finger pinch zooms it**, and a **two-finger drag rotates it** — the touch equivalents of the mouse and the keyboard. | A synthetic one-finger drag moves the camera focus; a synthetic pinch changes the camera distance; a synthetic two-finger drag changes the yaw. |
| **V7-FR-011** | A **tap selects a cell** in the world, exactly as a mouse click does, and it must go through the same domain dispatch. | A synthetic tap places a building through the real input path. |
| **V7-FR-012** | The HUD's interactive controls shall have a **minimum touch target** of 44 × 44 CSS pixels, and the page shall declare `touch-action` so the browser does not steal the gestures. | Every button in the HUD measures at least 44 px in a 390 px-wide viewport. |
| **V7-FR-013** | The layout shall be **responsive**: the HUD reflows on a narrow viewport and respects the **safe-area insets** of a notched device. | The HUD renders without horizontal overflow at 390 px wide. |

### The content pipeline

| id | Requirement | Acceptance criteria |
|---|---|---|
| **V7-FR-014** | The content validator shall **prove reachability**: for each authored level, every required objective and every checkpoint shall be shown reachable from the level's spawn, using the real grid, the real terrain and the real pathfinder. | The validator reports the proof, and a level whose objective is walled off is reported as an **error**, not a note. |
| **V7-FR-015** | The reachability proof shall be **deterministic** and **bounded**: the same level always gives the same verdict, and a level that cannot be resolved in the budget is reported as `unknown`, never as `reachable`. | Running the validator twice gives identical output. |

### The inherited defect

| id | Requirement | Acceptance criteria |
|---|---|---|
| **V7-FR-016** | The camera shall **not move while a modal has the focus**, for the keyboard as well as the gamepad. A held movement key must be released when the menu opens. | Holding `W`, opening the menu and waiting 30 frames leaves the camera exactly where it was. |
| **V7-FR-017** | The save **schema stays at version 2**. V7 is a product upgrade, not a save-format upgrade. | `core/save-compat.test.mjs` still passes unchanged; `SAVE_VERSION === 2`. |

---

## G. V7 non-functional requirements

| id | Requirement | Target |
|---|---|---|
| **V7-NFR-001** | A path search must not stall a frame. | The 95th-percentile search over the 64 × 64 grid is **under 2 ms** in Node; the in-game budget is 4 ms. |
| **V7-NFR-002** | A path search must not allocate without bound. | At most `budget` (default 4096) nodes are visited per search; the visited set is reused. |
| **V7-NFR-003** | The citizens' pathfinding must not regress the frame rate. | The measured frame time with the maximum citizen count must stay within 10% of the V6 measurement. |
| **V7-NFR-004** | No new runtime dependency. | `game/package.json` dependencies are unchanged: `three` only. |
| **V7-NFR-005** | Every V7 module that contains rules is **pure and Node-testable**. | No `three` import, no DOM access, in `core/navigation.js`, `core/touch.js` and their tests. |
| **V7-NFR-006** | The cleared build must stay licence-clean. | `npm run build:cleared` fails if any uncleared 2D art survives; the bundle contains no `dist/assets/ui`. |

---

## H. User-interface requirements

| id | Requirement |
|---|---|
| **V7-UI-001** | A touch action has **visible feedback**: the cell under the finger is highlighted exactly as the hovered cell is on the desktop. |
| **V7-UI-002** | A gesture that is not recognised must not **trigger an action**: a drag never places a building. |
| **V7-UI-003** | The touch controls must **not fight the browser**: `touch-action: none` on the canvas, and no double-tap zoom on the game surface. |
| **V7-UI-004** | The HUD must remain **readable on a 390 px viewport**: no horizontal scroll, no overlapping controls. |

---

## I. Game engine requirements

| id | Requirement |
|---|---|
| **V7-ENG-001** | The navigation module lives in **CORE**, because pathfinding is a rule, not a presentation. It must not import `three`. |
| **V7-ENG-002** | The touch module lives in **CORE** for the same reason. The browser wiring lives in UX. |
| **V7-ENG-003** | The population domain owns the citizens' behaviour; it does not own the pathfinder. It asks CORE for a path and follows it. |
| **V7-ENG-004** | `core/CONTRACT.md` stays the binding contract; any change to a domain's public API is recorded there. |

---

## J. Asset requirements

| id | Requirement |
|---|---|
| **V7-AST-001** | V7 introduces **no new art**. Everything it draws is geometry the renderer already has. |
| **V7-AST-002** | The navigation debug overlay draws with the existing line/material helpers; it adds no texture. |
| **V7-AST-003** | The uncleared 2D art stays quarantined. V7 does not touch `game/public/assets/ui`. |

---

## K. Animation requirements

| id | Requirement |
|---|---|
| **V7-ANI-001** | A citizen's facing follows the **direction of travel** along the path, not the direction from spawn to destination. |
| **V7-ANI-002** | The existing animation state machine is unchanged; V7 does not add a state. |
| **V7-ANI-003** | The walk cycle keeps running while the citizen is on a path, and stops when it arrives, as it does today. |

---

## L. AI requirements

| id | Requirement |
|---|---|
| **V7-AI-001** | The navigation is **grid A\*** with an admissible heuristic — not a behaviour tree, not a learning system, and it is not described as one. |
| **V7-AI-002** | The search is **deterministic**; a citizen's route is reproducible from the seed. |
| **V7-AI-003** | The search is **budgeted** and **graceful**: an unreachable goal returns `null` and the citizen keeps its previous behaviour rather than freezing. |
| **V7-AI-004** | The obstacle model reflects the **live** city: a new building changes the routes. |

---

## M. Performance requirements

| id | Requirement |
|---|---|
| **V7-PERF-001** | The pathfinder's cost is **measured**, not assumed: a benchmark over the real grid is part of the test suite and the number is recorded. |
| **V7-PERF-002** | The citizens' path budget is **bounded per frame**: at most `N` searches are started per frame, so a city full of citizens cannot flood the frame. |
| **V7-PERF-003** | The V6 frame-time baseline is **measured before and after**, and the difference is reported. |

---

## N. Security requirements

| id | Requirement |
|---|---|
| **V7-SEC-001** | No credential, token or key may appear in the source, the bundle, the documentation or the evidence. A secret scan runs over the tree and the built bundle. |
| **V7-SEC-002** | `npm audit` must report **0 vulnerabilities**. |
| **V7-SEC-003** | The import of a save file is **validated** before it is applied (it already is; V7 does not weaken it). |
| **V7-SEC-004** | No new dependency is added, so no new supply-chain surface is introduced. |

---

## O. Compatibility requirements

| id | Requirement |
|---|---|
| **V7-CMP-001** | A **V5 save opens in V7** and a **V6 save opens in V7**, unchanged. The schema stays at version 2. |
| **V7-CMP-002** | The **V6 acceptance scenario** (`tools/scenario.mjs`) and the **V6 gamepad scenario** (`tools/scenario-gamepad.mjs`) still pass against the V7 build. |
| **V7-CMP-003** | The macOS development environment keeps working: `npm run dev`, `npm run build`, `npm run preview`. |
| **V7-CMP-004** | The V7 touch support must **not regress** the mouse, the keyboard or the gamepad. |

---

## P. Reliability requirements

| id | Requirement |
|---|---|
| **V7-REL-001** | A pathfinding failure must never throw into the frame loop. The citizen service catches, logs and falls back. |
| **V7-REL-002** | A gesture recogniser fed garbage (a NaN coordinate, a zero-length pinch) must not throw and must not produce a gesture. |
| **V7-REL-003** | The navigation module must not mutate the obstacle map it is given. |

---

## Q. Build requirements

| id | Requirement |
|---|---|
| **V7-BLD-001** | The product version is **7.0.0** in `game/package.json`, `game/package-lock.json` and the build-identity fallback. |
| **V7-BLD-002** | The cleared build stays the shippable target, and it must stay licence-clean. |
| **V7-BLD-003** | The build identity must be stamped into the bundle: `7.0.0`. |
| **V7-BLD-004** | The V6 release branch and its history are untouched. |

---

## R. Testing requirements

| id | Requirement |
|---|---|
| **V7-TEST-001** | Every V7 requirement has at least one automated test. |
| **V7-TEST-002** | The navigation module has a **unit suite** covering: the straight path, the detour around a wall, the water block, the budget, the determinism, the smoothing and the debug output. |
| **V7-TEST-003** | The touch recogniser has a **unit suite** covering: the tap, the double-tap, the long press, the drag, the pinch, the frame-rate independence and the malformed input. |
| **V7-TEST-004** | The content validator has a **unit suite** covering: a reachable objective, an unreachable objective, the determinism and the unknown case. |
| **V7-TEST-005** | A **browser scenario** (`tools/scenario-v7.mjs`) drives the built game and proves the touch path in a real browser with synthetic touch events. |
| **V7-TEST-006** | The V6 scenarios still pass against the V7 build. |
| **V7-TEST-007** | Every check is reported as **PASS / FAIL / NOT RUN / BLOCKED / NOT APPLICABLE**, with the command that produced it. |

---

## S. Deployment requirements

| id | Requirement |
|---|---|
| **V7-DEP-001** | The shipped artefact is the cleared static bundle in `game/dist`. |
| **V7-DEP-002** | No deployment, release or tag is performed without an explicit instruction. |
| **V7-DEP-003** | The default branch is not replaced by V7. `main` stays where it is. |

---

## T. Acceptance criteria

V7 is accepted when **every** one of these is true and has evidence:

| # | Criterion | Evidence |
|---|---|---|
| AC-01 | The V6 baseline is identified, preserved and reachable in the remote. | `origin/v6/upgrade-Zehe03` = `ecc30fc` |
| AC-02 | The V7 branch is created from that commit and contains real implementation. | `development/v7` |
| AC-03 | Every V7 functional requirement is implemented and has a test. | `docs/v7/FEATURE_MATRIX.md` |
| AC-04 | The whole suite passes with no regression. | `npm test` |
| AC-05 | Every source file parses. | `npm run check` |
| AC-06 | The cleared build is licence-clean and stamps 7.0.0. | `npm run build:cleared` |
| AC-07 | The V5 and V6 acceptance scenarios still pass against the V7 build. | `tools/scenario.mjs`, `tools/scenario-gamepad.mjs` |
| AC-08 | The V7 touch scenario passes in a real browser. | `tools/scenario-v7.mjs` |
| AC-09 | The content validator now **proves** reachability instead of noting it away. | `node tools/validate-content.mjs` |
| AC-10 | The save schema is still version 2 and a V5 save still opens. | `core/save-compat.test.mjs` |
| AC-11 | The secret scan and `npm audit` are clean. | `docs/v7/SECURITY_REVIEW.md` |
| AC-12 | The performance measurements are recorded before and after. | `docs/v7/PERFORMANCE_REPORT.md` |
| AC-13 | The documentation describes what was actually built. | `docs/v7/` |

**If any criterion is not met, the release is a candidate and the exact
blocker is named.** It is not called complete.

---

## The traceability matrix

The authoritative version of this table — with the source files, the test
files and the verification result for every requirement — is
[`FEATURE_MATRIX.md`](FEATURE_MATRIX.md). It is updated as the work lands,
not written at the end.
