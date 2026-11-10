# Changelog

All notable changes to SuperCitycon are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

---

## [7.0.0] — V7.2 — the device and compatibility round

**Branch:** `development/v7`
**Baseline:** V7.1
**Release status:** see [`docs/v7/FINAL_VERIFICATION.md`](docs/v7/FINAL_VERIFICATION.md)

V7.1 audited the release against the source. **V7.2 audits it against the
conditions a device creates and a synthetic test cannot** — a phone profile,
a pen, a cancelled pointer, a lost window focus, a pad unplugged mid-press, a
blocked-cookies context, a resize. That found **nine more real defects**, and
all nine are fixed here.

### Fixed — the game did not boot with cookies blocked

`main.js` read `globalThis.localStorage ?? null`. The `??` guards a MISSING
value, not a THROWING getter — and a browser with cookies blocked makes
`localStorage` throw on ACCESS. The game showed a fatal pane and never
booted at all. The settings are a preference, not a requirement, so a
browser that refuses them still gets a game.

### Fixed — the canvas did not follow a resize

`renderer.setSize(w, h, false)` updates the drawing buffer but leaves the
canvas ELEMENT at its old size. A fresh load is already right, so the bug
hides; after a phone rotation the canvas kept its boot size and overflowed
the page by hundreds of pixels.

### Fixed — the HUD was unreachable on a phone

The demand and usage row is a six-chip rail that needs about 570 px in a
390 px viewport, and the HUD clips its overflow: the chips past the edge
were not scrolled out of sight, they were UNREACHABLE. The rail scrolls
now, and the scenario's overflow check was replaced by a reachability check
that would have caught it.

### Fixed — 44 controls were under the touch target

The search box had **no style rule at all** (and an inline style that beat
the stylesheet anyway); the settings sliders were 24 px, the settings
buttons 32 px and the studio's palette swatches 28 px. All are now at least
44 × 44, at every viewport from 320 px up.

### Fixed — the input kept its finger after the window lost the focus

A window that loses the focus never sends a `pointerup`, so the recogniser
held the finger forever and the camera kept panning into a window the
player was not looking at. The touch service and the gamepad service now
both let go.

### Fixed — a cancelled pinch swallowed the next tap

`cancel()` did not clear the multi-touch flag — only `up()` did. A pinch the
browser cancelled (a call came in) would swallow the next tap as well.

### Fixed — the pad's mapping was dropped

A pad that reports a non-standard mapping was read as a standard one,
silently. The mapping is now carried into the snapshot, so the game can
tell the difference.

### Measured — the save-size premise was wrong

V5 and V6 recorded the save file as "dominated by JSON-encoded terrain
arrays". **That was never measured, and it is not true.** A typical city
saves 778,418 bytes and the largest city 1,405,068 — and the terrain is
**2.25%** of that. A re-encoded terrain would win **0.30%** (and lossless
base64 would be *bigger*). The genuinely avoidable block is the static
catalogue: **41.9%**, droppable with no migration at all. The schema stays
at version 2 — now on evidence rather than on an assumption.

### Added — the audits and the runbook

- `tools/compat-audit.mjs` — 15 cross-engine hazards against the shipped
  bundle, six degraded configurations, six viewports, fresh and resized.
- `tools/scenario-devices.mjs` — the device profiles.
- `tools/save-size-report.mjs` — the save-size measurement.
- `tools/verify-deployment.mjs` — proves the LIVE site serves what was
  intended.
- `tools/run-v7-verification.sh` — the whole battery as one command.
- `docs/v7/SENIOR_REVIEW.md`, `docs/v7/DEPLOYMENT.md`,
  `docs/v7/RELEASE_CHECKLIST.md`, `docs/v7/COMPATIBILITY_AUDIT.md`,
  `docs/v7/DEVICE_COVERAGE.md`, `docs/v7/SAVE_SIZE.md`.

### Verification

- 898 tests, 898 pass, 0 fail.
- The V7 scenario 14/14 · the device scenario 32/32 · the compatibility
  audit 43/43 · the V5 acceptance 40/41 · the V6 gamepad 19/19.
- Every visible control is at least 44 × 44 at 320, 390, 768, 1280 and
  1920 pixels.

---

## [7.0.0] — V7.1 — the audit round

**Branch:** `development/v7`
**Baseline:** V7 at `fa046f1`
**Release status:** see [`docs/v7/FINAL_VERIFICATION.md`](docs/v7/FINAL_VERIFICATION.md)

V7.0.0 shipped and then V7 audited itself. The audit found **seven** gaps —
including two that V7 itself had introduced — and this round closes all of
them. Nothing here is a version bump: every entry is a defect fixed or a
feature finished.

### Fixed — the touch path

- **The cell under the finger was not highlighted.** The integrator's pointer
  handler ignores touch pointers (so a tap cannot select twice), and that
  also stopped the hover. The touch service now publishes the hover itself:
  it converts the finger's position with the same conversion the mouse uses,
  writes `state.ui.hover`, notifies every domain's `onHover` and emits
  `HOVER_CHANGED`. The highlight clears when the last finger lifts.
- **A pinch ended with a tap.** When two fingers were down, the finger that
  lifted first was usually the one that never moved — so it looked exactly
  like a tap, and a zoom placed a building. A gesture that used more than one
  finger is now a MULTI-TOUCH gesture, and nothing in it taps.
- **A slow frame killed the tap.** The gesture was timed with the clock at
  the moment the event was HANDLED. On a busy main thread that gap can be a
  whole second, so every tap became a long press. The gesture now uses the
  browser's own `event.timeStamp` — the time the event was GENERATED.

### Fixed — the tuning table kept a promise nobody kept

- **`TUNING.citizenPathsPerFrame` was declared and documented but never
  read.** The budget is now enforced: a citizen that misses it still spawns
  and still walks (it takes the straight line and clips a corner), because a
  frozen crowd would be a worse defect than a citizen that clips one.
- **The camera shake had two sources of truth** — four numbers in `TUNING`
  and four in the rig's own table, with identical values. `TUNING` is now the
  only one.

### Added — the gamepad can be rebound (closes V7-KI-09)

The Controls view now has a **Gamepad bindings** section: a pad button can be
bound to an action, the binding is stored in the new `input.padBindings`
setting, it is applied to the live pad table, it shows a readable button name,
it can be cancelled, and "RESET ALL BINDINGS" resets the pad table too.

Two details make it safe rather than merely present: the buttons bound to
the menu's own actions are **reserved** (the capture keeps waiting rather
than stealing the player's menu), and only button **edges** count, so a
button the player is already holding is not treated as a press.

A real defect fell out of the work: the key capture used to bind **Escape**
even though the toast promised "Esc cancels". That is fixed too.

### Added — the navigation debug panel

`game/src/ui/navigation-debug.js` — off by default, and it shows the route a
citizen took, what it cost, how many cells the search visited and WHY a
search failed. The route is drawn as an SVG line projected from the camera
matrices, and the projection was verified against three.js to 3.55e-14 px.

### Added — the city profiler and the narrow-viewport check

- `tools/profile-city.mjs` — measures a REAL city at the maximum citizen
  count against the boot scene in the same run. **The city at 40 citizens
  holds 60 fps** (16.663 ms against the boot scene's 16.667 ms) on a
  hardware GPU, and the pathfinding cost is **0.0361 ms per search**.
- `tools/scenario-v7.mjs` now resizes the page to 390 × 844 and checks that
  the HUD does not overflow, that **every visible control is at least
  44 × 44 CSS pixels**, and that a touch drag still pans the camera at that
  size. The check found two controls that were too small — the speed buttons
  (40 px) and the shop's category tabs (34 px) — and both are fixed.

### Measured

- 898 unit tests, 898 pass, 0 fail (was 835).
- 94/94 source files parse cleanly (was 91).
- The V7 scenario: **13/13** (was 10/10).
- The V5 acceptance scenario and the V6 gamepad scenario still pass.

---

## [7.0.0] — V7

**Branch:** `development/v7`
**Baseline:** V6 at `ecc30fc`
**Engine:** Three.js 0.169 · Vite 7.3.7 (bundler only) · ES modules · no framework
**Release status:** **V7 RELEASE CANDIDATE** — 835 tests pass, the build is
verified, and two gates are not fully closed: there was no independent senior
review of the V7 diff, and the platform verification is limited to Chromium on
macOS x86_64. See
[`docs/v7/FINAL_VERIFICATION.md`](docs/v7/FINAL_VERIFICATION.md).

V7 adds to the game and changes **nothing** about the player's saved cities.
The save schema stays at **version 2**, so a V5 or a V6 city opens in V7
exactly as it was.

### Added — the citizens navigate

The citizens used to walk in a straight line from A to B: the path was
`from → midpoint + a random offset → to`, with no knowledge of the terrain,
the water or the buildings. A citizen walked through a warehouse, and on
`high-water` through the flood.

- **`game/src/core/navigation.js`** — a grid A* over the 64 × 64 city grid
  with the octile heuristic, so the first route found is the cheapest one.
  The search is **deterministic** (a fixed neighbour order and a total order
  over the open set), **budgeted** (a walled-off destination returns the best
  path found so far instead of stalling the frame), and it never cuts a
  corner between two blocked cells.
- The obstacle model is a **view over the live city**, not a copy of it:
  water blocks, buildings block, a slope costs more, and a building placed a
  moment ago changes the routes immediately.
- The path is **smoothed**, so a citizen walks a straight line where the city
  allows it.
- Measured: a median of **0.202 ms** and a 95th percentile of **1.350 ms**
  per search, against a 2 ms budget.

### Added — touch input

V6 had no touch support at all. Now a **one-finger drag pans the city**, a
**pinch zooms it**, a **two-finger drag rotates it**, and a **tap selects the
cell** — through the same dispatcher the mouse uses.

- **`game/src/core/touch.js`** — the gesture rules, pure and Node-testable:
  tap, double-tap, long press, drag with a velocity, and pinch with a scale
  and a rotation. Every threshold is in milliseconds or pixels, so the same
  physical gesture produces the same gesture at 30 Hz and at 144 Hz.
- **`game/src/ui/touch.js`** — the browser half.
- The HUD respects the **safe areas** of a notched device and reflows on a
  narrow viewport.

### Added — the content pipeline proves its own levels

V5 and V6 said: *"Reachability beyond the declared progression links is not
proven by this validator."* V7 **proves** it — it generates the level's
terrain from its own seed, with the world's own functions, and asks the
pathfinder whether a route exists to every exit, checkpoint and collectible.
An unreachable target is now an **error**. The three shipped levels are all
proven: 3/3, 5/5 and 7/7 targets reachable.

### Added — the toolchain

- **`tools/secret-scan.mjs`** — scans the tree and the bundle for
  credential-shaped values, and refuses to flag a placeholder.
- **`tools/profile-navigation.mjs`** — measures the new hot path on a quiet
  machine.
- **`tools/scenario-v7.mjs`** — the V7 browser acceptance scenario.
- **`tools/package-game-release.mjs`** — packages the cleared bundle with a
  SHA-256 for every file, and refuses to ship a leak.

### Fixed

- **A held movement key kept panning the camera behind the menu.** The key
  handler returns early when the menu is open, but the held-key set was never
  cleared. The gamepad path already had that rule; the keyboard now has it
  too. The regression test fails on the V6 baseline and passes on V7.
- **A touch tap selected the cell twice** — once from the touch service and
  once from the pointer handler. The integrator's pointer handler now ignores
  touch pointers: one owner per device.
- **A pinch zoomed and rotated cumulatively.** The zoom was multiplied once
  per move event. The pinch now carries a phase, and the camera applies the
  change since the last event.

### Not changed

- The **save schema** stays at version 2.
- The **V5 and V6 acceptance scenarios** are untouched, and both still pass
  against the V7 build.
- The **studio editor** — its undo / redo already existed.
- The **dependencies** — `three` and nothing else.

---

## [6.0.0] — V6

**Branch:** `v6/upgrade-Zehe03`
**Baseline:** V5 merged into `main` @ `69b6579`
**Engine:** Three.js 0.169 · Vite 7.3.7 (bundler only) · ES modules · no framework
**Release status:** see [`docs/V6_VERIFICATION.md`](docs/V6_VERIFICATION.md) for
the gate-by-gate verdict.

V6 is a major-version upgrade that **adds** to the game and changes **nothing**
about the player's saved cities. The save schema stays at **version 2**, so a
V5 city opens in V6 exactly as it was.

### Added — gamepad support (V5 issue KI-05)

V5's KI-05 claimed the Gamepad API was already read and routed through the
input map. It was not — at the V5 baseline the tree contained no gamepad code
at all. V6 implements the whole path from scratch.

- **The pad rules** (`game/src/core/gamepad.js`, pure and Node-testable) — a
  0.18 dead zone with the usable range rescaled so a resting stick reads as
  exactly zero and a full push still reaches 1.0; the dead zone applies to the
  sticks only, because a trigger rests at zero and a part-pull is deliberate;
  buttons fire on their **edge**, so a held CONFIRM confirms **once**; a
  disconnect releases every held button; connect and disconnect are reported.
- **The pad bindings** (`game/src/core/input-map.js`) live beside the keyboard
  bindings in the same table — D-pad to move, A to confirm, B to go back,
  START to pause, the bumpers to zoom, the left stick to reset the camera.
- **The browser half** (`game/src/ui/gamepad.js`) reads
  `navigator.getGamepads()`, compares the frames and routes the result.
- **Directional menu navigation with a visible focus ring**, confirm and back,
  and a focus target that stays valid after a panel rebuilds itself
  (`game/src/ui/menu.js`).
- **Analogue camera movement** (`game/src/ui/camera.js`) — the left stick pans,
  the right stick rotates, the right trigger zooms in and the left zooms out;
  the speed follows the deflection, and a held stick keeps moving.
- **The camera does not move while a modal has the focus**, and the reduced
  screen shake preference is honoured.
- **The settings rows are reachable with a pad**, and a slider takes LEFT /
  RIGHT for itself.

### Added — a V6 gameplay regression suite

- **`tools/scenario-v6.mjs`** drives the assembled game in a real browser
  through five flows: an authored map launch, the First Light progression, a
  save and continue round trip, the hazard effects, and the city transitions.
  The V5 acceptance scenario `tools/scenario.mjs` is untouched, and both are
  run.

### Added — V5 save compatibility, proved rather than asserted

- **`game/src/core/save-compat.test.mjs`** writes a hand-built V5 record into
  storage and loads it in V6, asserting the buildings, the treasury, the day,
  the seed and the progression record all come back; that the stored save is
  not rewritten; that a V6 save is the same format as a V5 save; and that the
  v1 → v2 migration still works.

### Changed

- **The product version is 6.0.0** — `game/package.json`,
  `game/package-lock.json` and the build-identity fallback in
  `game/src/core/log.js`. The build identity in `game/vite.config.js` reads
  `package.json`, so the stamped build follows automatically.
- **`docs/V5_KNOWN_ISSUES.md` is amended** with the correction to KI-05. The
  V5 document is kept as the historical record; the correction and the open
  issues live in [`docs/V6_KNOWN_ISSUES.md`](docs/V6_KNOWN_ISSUES.md).

### Not changed

- The **save schema** stays at version 2.
- The **V5 acceptance scenario**, the shop layout, the performance tools and
  the cleared build target are all untouched.

---

## [5.0.0] — V5

**Branch:** `v5/upgrade`
**Baseline:** V4 at `main` @ `92c0b37`
**Engine:** Three.js 0.169 · Vite 7.3.7 (bundler only) · ES modules · no framework
**Release status:** **V5 RELEASE CANDIDATE** — 687 tests pass, the build is
verified, and the one outstanding gate is the Cursor senior review, which the
account's exhausted quota refused to run. See
[`docs/V5_FINAL_VERIFICATION.md`](docs/V5_FINAL_VERIFICATION.md).

V5 is a major-version upgrade of the 3D city builder. **Every V4 feature still
works** — V5 adds to the game, it does not replace it. The full requirement
status is in [`docs/V5_REQUIREMENTS_MATRIX.md`](docs/V5_REQUIREMENTS_MATRIX.md)
and the release verdict is in
[`docs/V5_FINAL_VERIFICATION.md`](docs/V5_FINAL_VERIFICATION.md).

### Added — architecture

- **Structured logging** (`game/src/core/log.js`) — severity, category, context
  object, bounded ring buffer, global error handlers, and a build identity on
  every line. No secrets, no personal data.
- **A validated settings store** (`game/src/core/settings.js`) — audio,
  display, accessibility and input sections, each key declared with a type,
  range, step and label so the settings screen is generated from the store.
  Settings are a *user preference* and live outside the save format.
- **One key-binding table** (`game/src/core/input-map.js`) — `matches()`,
  `rebind()`, `resetAll()` and `keyLabel()`, so the on-screen hints and the
  handlers come from the same source.
- **A progression record** (`game/src/core/progress.js`) — checkpoints,
  collectibles and achievements, persisted in `state.meta.progress` and carried
  by the save.
- **An explicit teardown path** (`game/src/main.js`) — the animation frame, the
  stage timer, every domain, the audio mixer, the event bus and the settings
  store are all released. V4 created a frame loop and a timer and never
  stopped either.
- **A diagnostics surface** (`window.SUPERCITYCON`) — build identity, log
  summary, settings, progression, renderer performance, mode, day, stage and
  time of day.

### Added — simulation

- **Fixed-timestep simulation** — the simulation runs on a fixed
  `TUNING.fixedStep` (1/60 s of game time) with a bounded catch-up of
  `TUNING.maxCatchUpSteps` (8). Presentation still uses the real frame time.
- **One clock** — CORE's `advanceClock` is the only time authority.

### Added — presentation

- **A pooled, instanced VFX service** (`game/src/render/fx.js`,
  `game/src/render/fx-plan.js`) — nine effect kinds: `place`, `bulldoze`,
  `level-up`, `checkpoint`, `achievement`, `hazard-smoke`, `hazard-fire`,
  `hazard-water`, `warning`. The plan is pure and unit-tested; the service owns
  the pool and reports its own statistics.
- **The effects are wired to the game** (`installFxFeedback` in
  `game/src/main.js`) — a placement, a demolition, a level-up, a checkpoint, an
  achievement and a hazard each spawn their own effect at the right place.
- **The audio mixer is connected** — V4 built a complete procedural synthesiser
  with six category buses and never called it. V5 drives it from the event bus.

### Added — gameplay

- **The hazard system** (`game/src/hazards/`) — the city-builder equivalent of
  a multi-phase boss encounter. A hazard escalates through a telegraphed phase
  ladder, deals damage through an explicit pipeline (phase rate × distance
  falloff × (1 − mitigation)), is fought with the city's own service coverage,
  and can be resolved early.
- **The content pipeline** (`game/src/content/`) — a level schema, three
  original levels (`first-light`, `high-water`, `the-long-night`), a content
  validator and a service that loads a level into the live city.
- **A content validator CLI** (`game/tools/validate-content.mjs`) — detects
  missing exits, invalid spawn points, broken progression links, missing
  resources, incorrect checkpoint definitions, unsupported object types,
  invalid metadata and unreachable objectives. Exits non-zero on an error.

### Changed

- **The save format is versioned** — `SAVE_VERSION` 1 → 2, with a `MIGRATIONS`
  chain. A V4 save migrates on load; a save from a *newer* version is refused,
  never guessed at. The migrated-from version is recorded in the payload.
- **`buildings.place()` gained a `prebuilt` option** — a level's starting city
  already existed when the player arrived, so it is neither charged to the
  treasury nor counted against the player's construction slots.
- **The day counter was corrected.** V4 incremented it twice per day boundary
  and emitted `DAY_CHANGED` twice with two different payload shapes.
- **The simulation was made frame-rate independent.** V4 ticked the domains
  with the raw wall-clock `dt`, so a decay rate was really "per screen
  refresh".
- **The time presets seek the clock** rather than setting the renderer
  directly, so the next frame cannot undo the jump.

### Accessibility

- Remappable controls, from a single binding table.
- Reduced visual effects (shorter, smaller, fewer particles), reduced screen
  shake, adjustable text size, high contrast and colour-blind-safe indicators.
- Keyboard navigation throughout the menus.

### Fixed

- The double day increment (above).
- The frame-rate-dependent simulation (above).
- The HUD time presets fighting the clock (above).
- A level's starting city being refused by the construction-slot gate.
- **The hazard's effect was drawn underground.** Effects were placed at world
  `y = 0`, but the terrain has real elevation — the wildfire's cell is on a
  plateau 9 units up, so the fire was drawn inside the hill and no pixel of it
  reached the screen. Every effect now asks the WORLD domain for the ground
  height (`wld.heightAt`). The hazard's particles moved from world y 0.82–1.27
  to y 10.02–13.13, and the ember, flame and smoke are now captured on the
  plateau.
- **The hazard effect was drawn twice** — the hazard domain pulsed it *and* the
  event bridge answered the same events. The hazard domain is now the sole
  owner of the hazard's visuals.
- **The renderer counter under-reported every frame.** Three.js resets
  `renderer.info` after the shadow-map pass, so the number the adaptive
  quality driver and the HUD read described the main scene pass only — and with
  post-processing on, the fullscreen retro pass alone. The counter now covers
  the whole frame (63 draw calls on the boot scene, not 34).
- **The performance profiler could report a negative frame time.** The frame
  sampler seeded from `performance.now()` and differenced it against the next
  rAF timestamp, which can be earlier. It now seeds from the first rAF
  timestamp, and every report publishes `negativeSamples` so an artefact can
  never hide inside an average again.

### Performance

Measured on the V5 release build against a **re-measured** V4 baseline with
identical counter semantics (Apple Radeon Pro 5500M, Chromium, headed):

| | V4 | V5 |
|---|---:|---:|
| Boot mean frame | 16.662 ms | 16.667 ms |
| Populated city mean frame | 23.445 ms | **18.167 ms** |
| Populated city worst frame | 83.3 ms | **35.1 ms** |
| Populated city draw calls | 1 633 | **1 558** |

The full method, the machine and the limits are in
[`docs/V5_PERFORMANCE_REPORT.md`](docs/V5_PERFORMANCE_REPORT.md).

### Not delivered, and why

Stated plainly rather than left to inference:

- **No character locomotion, combat, projectiles or player avatar.** The
  directive's capability list is written for a 2D action platformer;
  SuperCitycon is a city builder. The mapping is documented in
  [`docs/V5_UPGRADE_PLAN.md`](docs/V5_UPGRADE_PLAN.md) §1 and every
  platformer-only requirement is listed with its reason in the requirements
  matrix.
- **No native executable.** Web only.
- **No Apple Silicon validation.** The development machine is x86_64; the gate
  stays open.
- **No music, ambience or voice.** The project has no audio asset files — every
  sound is synthesised at runtime.
- **No shipped 2D art.** 69 images are licence-unverified and quarantined; the
  cleared build ships 0 of them.
- **No Windows, Linux or non-Chromium browser testing.** None is available in
  this environment.
- **Gamepad navigation is partial.** The API is read and routed through the
  binding table; analogue-stick camera and pad menu navigation are not
  implemented.

---

## [4.x] — V4

V4 is the shipped baseline. Its history is in the repository history and in
[`docs/V4_BASELINE_AUDIT.md`](docs/V4_BASELINE_AUDIT.md), which records what V4
actually was, measured — not what it was claimed to be.

---

## Licence position (unchanged in V5)

| Asset set | Licence | Status |
|---|---|---|
| 3D models and animation (158 assets, 5 packs) | CC0-1.0 / MIT | **cleared to publish** |
| 2D HUD art (69 distinct images across 84 HUD records) | `unverified` | **NOT cleared — do not publish** |

`npm run build:cleared` produces the shippable build and **fails** if any
unverified 2D file survives. The HUD is complete and correct with zero 2D
images.

---

[7.0.0]: https://github.com/atiffhussainkhan/SuperCitycon/releases/tag/v7.0.0
[6.0.0]: https://github.com/atiffhussainkhan/SuperCitycon/releases/tag/v6.0.0
[5.0.0]: https://github.com/atiffhussainkhan/SuperCitycon/releases/tag/v5.0.0
[4.x]: https://github.com/atiffhussainkhan/SuperCitycon/releases
