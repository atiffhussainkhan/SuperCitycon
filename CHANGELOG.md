# Changelog

All notable changes to SuperCitycon are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

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

[5.0.0]: https://github.com/atiffhussainkhan/SuperCitycon/releases/tag/v5.0.0
[4.x]: https://github.com/atiffhussainkhan/SuperCitycon/releases
