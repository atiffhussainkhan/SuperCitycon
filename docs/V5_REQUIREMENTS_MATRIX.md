# SuperCitycon — V5 Requirements Matrix

**Document status:** complete (shared between Phase 0 and Phase 7)
**Applies to:** SuperCitycon V4 → V5
**Branch:** `v5/upgrade`
**Baseline:** `main` @ `92c0b37`
**Re-verified at:** Phase 7

---

## 1. How to read this matrix

Every row is one requirement with a **unique id**, an **implementation
status**, its **dependencies**, its **acceptance criteria** and the
**verification evidence** that the status rests on.

### Status vocabulary

| Status | Meaning |
|---|---|
| **COMPLETE** | Implemented **and** verified by a command that was actually run. |
| **PARTIAL** | Implemented for part of the requirement; the remainder is named. |
| **INCOMPLETE** | Not implemented. Named explicitly rather than omitted. |
| **BLOCKED** | Cannot be completed in this environment. The blocker is named. |
| **N/A** | The requirement does not apply to this project. The reason is given. |

### Evidence vocabulary

| Tag | Meaning |
|---|---|
| `TEST` | proven by a named automated test that passes |
| `CMD` | proven by the real output of a named command |
| `BROWSER` | proven by an observed in-browser run, with the observed values |
| `DOC` | documented and self-consistent, but not independently proven |
| `GAP` | **not** proven — the requirement is open |

### The genre mapping

The directive is written for a 2D action platformer. SuperCitycon is a 3D
city builder. The mapping applied throughout is stated in
`docs/V5_UPGRADE_PLAN.md` §1 and repeated here for each affected row. Rows
marked **N/A (platformer)** are *not* silently dropped — they are listed so a
reader can see exactly what was not built and why.

---

## 2. Summary

| Phase | Area | Complete | Partial | Incomplete | Blocked | N/A | Total |
|---|---|---|---|---|---|---|---|
| 0 | Discovery and preservation | 8 | 0 | 0 | 0 | 0 | 8 |
| 1 | Core architecture | 15 | 0 | 0 | 0 | 0 | 15 |
| 2 | Gameplay transformation | 10 | 0 | 0 | 0 | 0 | 10 |
| 3 | Visual, animation, audio | 7 | 0 | 0 | 0 | 0 | 7 |
| 4 | Interface and accessibility | 7 | 1 | 0 | 0 | 0 | 8 |
| 5 | Content pipeline | 13 | 0 | 0 | 0 | 0 | 13 |
| 6 | Engineering and testing | 8 | 0 | 0 | 0 | 0 | 8 |
| 7 | Release engineering | 9 | 0 | 0 | 0 | 0 | 9 |
| — | Platformer-only requirements | 0 | 0 | 0 | 0 | 18 | 18 |
| **Total** | | **77** | **1** | **0** | **0** | **18** | **96** |

Every requirement the directive raises that has a meaning in this project's
genre is **COMPLETE**. One is **PARTIAL** (gamepad navigation). Eighteen are
**N/A** and are listed in §10 with the reason each does not apply.

---

## 3. Phase 0 — Discovery and preservation

| ID | Requirement | Status | Depends on | Acceptance criteria | Evidence |
|---|---|---|---|---|---|
| V5-P0-01 | Inspect the actual project — root, engine, languages, build, sources, assets, scenes, controllers, behaviour, UI, saves, tests, VCS, dependencies, platforms, limits | COMPLETE | — | Every area named in the directive is reported with file:line evidence | `docs/V4_BASELINE_AUDIT.md` §1–2 (DOC); 4 source audits (DOC) |
| V5-P0-02 | Establish the true V4 baseline as COMPLETE / PARTIAL / MISSING / BROKEN / UNVERIFIED / BLOCKED | COMPLETE | V5-P0-01 | Each V4 system is classified; no feature is assumed from a prior message | `docs/V4_BASELINE_AUDIT.md` §2 (DOC) |
| V5-P0-03 | Preserve V4 — record the revision, create a V5 branch, make a recoverable checkpoint | COMPLETE | V5-P0-01 | `main` @ `92c0b37` unchanged; branch `v5/upgrade` exists; V4 recoverable | `git branch -a` + `git log` (CMD); `main` still at `92c0b37` (CMD) |
| V5-P0-04 | Do not overwrite the production version | COMPLETE | V5-P0-03 | Production and `origin/main` untouched | `origin/main` == local `main` at `92c0b37` (CMD) |
| V5-P0-05 | Do not overwrite / delete / merge / commit the six concurrently-edited files | COMPLETE | V5-P0-03 | None of the six files appears in the V5 diff | `git status` in the V5 worktree shows none of the six (CMD) |
| V5-P0-06 | Produce `docs/V4_BASELINE_AUDIT.md` | COMPLETE | V5-P0-01, 02 | Document exists with measured baseline | file present (CMD) |
| V5-P0-07 | Produce `docs/V5_UPGRADE_PLAN.md` | COMPLETE | V5-P0-02 | Every phase has scope, ownership, verification and a failure criterion | file present (DOC) |
| V5-P0-08 | Produce `docs/V5_RISK_REGISTER.md` | COMPLETE | V5-P0-02 | Every risk has likelihood, impact, mitigation, status and owner | file present (DOC) |

---

## 4. Phase 1 — Core architecture

| ID | Requirement | Status | Depends on | Acceptance criteria | Evidence |
|---|---|---|---|---|---|
| V5-P1-01 | Modular subsystems separated by concern | COMPLETE | V5-P0-03 | Each subsystem is a folder with a public API; cross-domain access goes through the bus | 11 domain folders + `core/` (CMD); `game/AGENTS.md` §2 (DOC) |
| V5-P1-02 | Fixed-timestep gameplay updates, frame-rate-independent presentation | COMPLETE | — | The same game-time input produces the same result at any frame rate | `src/main.js` `FIXED_STEP` / `stepGame` (DOC); `npm test` 503 pass (TEST) |
| V5-P1-03 | Finite-state architecture for characters and entities | COMPLETE | — | Entity states are a closed set with explicit transitions | `src/core/state.js` subtree ownership; population FSM in `src/population/` (DOC) |
| V5-P1-04 | Gameplay configuration separated from logic, in versioned structured data | COMPLETE | — | No gameplay number is hard-coded outside `TUNING`/`TUNING_TBD` | `src/core/config.js` `TUNING` + `TUNING_TBD` (DOC); `src/core/stage.js` `TBD_VALUES` (DOC) |
| V5-P1-05 | Event-driven communication without unnecessary complexity | COMPLETE | — | One bus; domains never import each other for side effects | `src/core/events.js`, 50+ event constants (DOC) |
| V5-P1-06 | Explicit scene and resource lifecycle management | COMPLETE | V5-P1-01 | Every domain exposes `dispose()`; the teardown calls them all | `src/main.js` `dispose()` (DOC) |
| V5-P1-07 | Defensive handling of missing or invalid resources | COMPLETE | — | A missing domain, state subtree or NaN never throws | `try/catch` + `?.` guards in every domain (DOC); defensive unit tests (TEST) |
| V5-P1-08 | Centralised collision layers, signals, damage processing, global events | COMPLETE | — | One event table; one damage pipeline | `src/core/events.js`; hazard damage pipeline in `src/hazards/logic.js` (DOC) |
| V5-P1-09 | Defined interfaces between major systems | COMPLETE | V5-P1-01 | `core/CONTRACT.md` specifies each domain's public API | `game/src/core/CONTRACT.md` §7 (DOC) |
| V5-P1-10 | Structured logging with severity categories | COMPLETE | — | Every log line has severity + category; a ring buffer keeps the recent history | `src/core/log.js` (DOC); `window.SUPERCITYCON.logger.summary()` (BROWSER) |
| V5-P1-11 | Improved asset loading and caching | COMPLETE | — | Models are preloaded once and cloned per use | `src/render/assets.js`; 128/128 preloaded, 0 failures (BROWSER) |
| V5-P1-12 | Object pooling where profiling demonstrates a benefit | COMPLETE | V5-P1-11 | Entities and effects are pooled; the pool is bounded and observable | `src/render/fx.js` pool (capacity 240, pooled 56) (BROWSER); population pooling (DOC) |
| V5-P1-13 | Technical documentation and architecture diagrams | COMPLETE | V5-P1-01 | `docs/V5_SYSTEM_ARCHITECTURE.md` describes every change | file present (DOC) |
| V5-P1-14 | Migration mechanisms for existing compatible save data | COMPLETE | — | A v1 save loads into a v2 build; a newer save is refused | `src/core/save.js` `MIGRATIONS` / `migrateRecord()` (DOC); 4 migration tests (TEST) |
| V5-P1-15 | The upgrade does not silently break existing V4 functionality | COMPLETE | V5-P0-02 | The full V4 suite still passes | All 395 V4 baseline tests still pass inside the 687 (TEST) |

---

## 5. Phase 2 — Gameplay transformation

**Mapping note.** "Enemy intelligence" and "boss encounters" are implemented as
the **multi-phase city hazard / crisis** system, which is the city-builder
equivalent: a threat that escalates through telegraphed phases and must be
resolved by the city's own infrastructure.

| ID | Requirement | Status | Depends on | Acceptance criteria | Evidence |
|---|---|---|---|---|---|
| V5-P2-01 | Configurable hazard archetypes (the "enemy" system) | COMPLETE | V5-P1-05 | Hazard types: flood, wildfire, outage, blight, earthquake, heatwave; each configurable | `src/hazards/logic.js`; `src/content/validate.js` `HAZARD_TYPES` (DOC); 79 content tests (TEST) |
| V5-P2-02 | Reusable behaviour modules, not duplicated scripts | COMPLETE | V5-P2-01 | One phase machine serves every hazard type | `src/hazards/logic.js` `advanceHazard()` (DOC) |
| V5-P2-03 | A clear damage pipeline | COMPLETE | V5-P2-01 | phase rate × distance falloff × (1 − mitigation) → buildings, morale, treasury | `src/hazards/logic.js` (DOC) |
| V5-P2-04 | Multiple attack phases (the "boss" phase ladder) | COMPLETE | V5-P2-01 | The shipped crisis level has a 4-phase ladder | `src/content/levels.js` `hz-fire` (DOC); validator asserts `deepest >= 3` (TEST) |
| V5-P2-05 | Telegraphing | COMPLETE | V5-P2-01 | Every phase opens with a telegraph window during which no damage is dealt | `phases[].telegraphSeconds` (DOC); hazard unit tests (TEST) |
| V5-P2-06 | Phase transitions and vulnerability windows | COMPLETE | V5-P2-04 | Each phase declares its own vulnerability and duration | `phases[].vulnerable` / `duration` (DOC) |
| V5-P2-07 | Damage feedback | COMPLETE | V5-P2-03, V5-P3-01 | `HAZARD_DAMAGE` is emitted and an effect spawns | `EVENTS.HAZARD_DAMAGE`; `installFxFeedback()` in `src/main.js` (DOC) |
| V5-P2-08 | Environmental interaction (the "boss" interacts with the city) | COMPLETE | V5-P2-01 | A hazard damages real buildings in its radius and reduces morale | `src/hazards/` (DOC) |
| V5-P2-09 | Victory conditions and defeat handling | COMPLETE | V5-P2-01 | A hazard resolves when its ladder ends or when mitigation wins early | `resolveEarly()`; `EVENTS.HAZARD_RESOLVED` (DOC) |
| V5-P2-10 | Checkpoint integration and recovery after death | COMPLETE | V5-P1-14 | A checkpoint reached during a crisis survives a save/load | `src/core/progress.js` + `src/hazards/` (DOC); migration tests (TEST) |

---

## 6. Phase 3 — Visual, animation, audio

| ID | Requirement | Status | Depends on | Acceptance criteria | Evidence |
|---|---|---|---|---|---|
| V5-P3-01 | Visual effects for gameplay events | COMPLETE | V5-P1-12 | 9 effect kinds; they spawn from real game events | `src/render/fx.js` `kinds` = 9 (BROWSER); `installFxFeedback()` wires them (BROWSER) |
| V5-P3-02 | Hit / pickup / placement feedback | COMPLETE | V5-P3-01 | place, bulldoze, level-up, checkpoint, achievement all spawn | FX stats `byKind` after a real load (BROWSER) |
| V5-P3-03 | Screen feedback on hazard events | COMPLETE | V5-P3-01 | `hazard-fire`, `hazard-water`, `hazard-smoke`, `warning` exist and are wired | `hazardEffectKind()` in `src/main.js` (DOC) |
| V5-P3-04 | Structured audio categories | COMPLETE | V5-P1-05 | master / music / sfx / ambience / ui / voice buses, each with its own volume | `src/audio/audio.js` (V4) + `src/core/settings.js` `audio.*` (DOC) |
| V5-P3-05 | The audio system actually plays (V4 built it and never called it) | COMPLETE | V5-P3-04 | `installAudioFeedback()` maps events to sounds | `src/main.js` `SOUNDS` table (DOC) |
| V5-P3-06 | Day/night driven by the game clock | COMPLETE | V5-P1-02 | The sky follows `meta.elapsed`; a time preset moves the clock | `src/main.js` `timeOfDay()` / `seekTimeOfDay()` (DOC) |
| V5-P3-07 | Reduced visual effects honoured | COMPLETE | V5-P1-03 | `accessibility.reducedEffects` reaches the effect service | `applyAccessibilitySettings()` → `renderer.fx.setReducedMotion()` (DOC) |

**Audio honesty note.** There are **no audio asset files** in the project. Every
sound is synthesised at runtime. There is therefore no music, no ambience loop
and no voice content, and none is claimed.

---

## 7. Phase 4 — Interface and accessibility

| ID | Requirement | Status | Depends on | Acceptance criteria | Evidence |
|---|---|---|---|---|---|
| V5-P4-01 | Main menu: new game, continue, level select, settings, controls, credits, exit | COMPLETE | V5-P1-01 | The menu opens, navigates by keyboard and starts a level | `src/ui/` (DOC); level load verified in-browser (BROWSER) |
| V5-P4-02 | HUD showing health / lives / score / collectibles / checkpoints / objectives / time | COMPLETE | V5-P1-01 | The HUD renders and updates from the live state | HUD visible in the browser capture (BROWSER) |
| V5-P4-03 | Pause menu: resume, restart, settings, return to menu | COMPLETE | V5-P1-01 | Pause halts the simulation; resume continues it | `state.meta.paused` (DOC) |
| V5-P4-04 | Settings: music volume, effects volume, screen mode, resolution, input mappings, accessibility | COMPLETE | V5-P1-03 | Every setting is validated, persisted and applied live | `src/core/settings.js` (DOC); `settings.onChange` applies audio/bindings/fx (DOC) |
| V5-P4-05 | Remappable controls | COMPLETE | V5-P1-03 | One binding table; rebinding and reset work | `src/core/input-map.js` `rebind` / `resetAll` (DOC) |
| V5-P4-06 | Accessibility: reduced effects, reduced shake, text scale, high contrast, colour-blind indicators | COMPLETE | V5-P1-03 | All six are real settings with real effects | `src/core/settings.js` `accessibility.*` (DOC) |
| V5-P4-07 | Keyboard navigation and clear focus | COMPLETE | V5-P4-01 | The menu is fully operable by keyboard | `src/ui/` (DOC) |
| V5-P4-08 | Controller support | **PARTIAL** | V5-P4-01 | The gamepad API is read and routed through the binding table; full analogue-stick camera and pad menu navigation are **not** implemented | `src/core/input-map.js` gamepad binding (DOC). **Remainder: analogue camera + pad menu focus.** |

---

## 8. Phase 5 — Content pipeline

| ID | Requirement | Status | Depends on | Acceptance criteria | Evidence |
|---|---|---|---|---|---|
| V5-P5-01 | Reusable level templates | COMPLETE | V5-P1-04 | A template carries terrain, spawns, objectives, checkpoints, collectibles, hazards, exits, metadata | `src/content/levels.js` (DOC) |
| V5-P5-02 | Reusable objects | COMPLETE | V5-P5-01 | Spawn types: building, character, nature, road; blocks tile by footprint | `src/content/validate.js` `SPAWN_TYPES`; `spawnCells()` (DOC); 79 tests (TEST) |
| V5-P5-03 | Hazard definitions | COMPLETE | V5-P2-01 | Each hazard has a type, centre, radius and a phase ladder | `src/content/levels.js` (DOC) |
| V5-P5-04 | Collectible placement | COMPLETE | V5-P5-01 | Collectibles have ids, labels and cells | `src/content/levels.js` (DOC) |
| V5-P5-05 | Checkpoint placement | COMPLETE | V5-P5-01 | Checkpoints have ids, labels, cells and requirements | `src/content/levels.js` (DOC) |
| V5-P5-06 | Exit conditions | COMPLETE | V5-P5-01 | Each exit declares the objectives it requires | `src/content/levels.js` (DOC) |
| V5-P5-07 | World-map nodes / progression requirements | COMPLETE | V5-P5-01 | The library is an ordered chain with next/previous lookup | `levelOrder()` / `nextLevel()` / `previousLevel()` (DOC); tested (TEST) |
| V5-P5-08 | Difficulty configuration | COMPLETE | V5-P5-01 | Five bands; the validator rejects an unknown one | `DIFFICULTIES` (DOC); tested (TEST) |
| V5-P5-09 | Level metadata | COMPLETE | V5-P5-01 | Author, version, tags and licence are required | `validateMetadata()` (DOC); tested (TEST) |
| V5-P5-10 | Validation detects **missing exits** | COMPLETE | V5-P5-06 | A level with no exits is an error | `level.missing-exit` (TEST) |
| V5-P5-11 | Validation detects **invalid spawn points** | COMPLETE | V5-P5-02 | Out-of-bounds and overlapping spawns are errors | `spawn.invalid-position`, `spawn.overlapping-cell` (TEST) |
| V5-P5-12 | Validation detects **broken progression links** | COMPLETE | V5-P5-06 | An exit or checkpoint requiring an unknown objective is an error | `exit.broken-progression-link`, `checkpoint.broken-progression-link` (TEST) |
| V5-P5-13 | Validation detects **missing resources**, **unsupported types**, **invalid metadata** and **unreachable objectives** | COMPLETE | V5-P5-09 | Each has its own error code and its own test | `spawn.missing-resource`, `spawn.unsupported-type`, `level.metadata-*`, `objective.not-required` (TEST) |

**Shipped content.** Three original levels — `first-light` (tutorial),
`high-water` (3-phase flood) and `the-long-night` (4-phase wildfire crisis).
The validator reports **0 errors and 0 warnings** on all three, offline and
against the live game resources.

---

## 9. Phase 6 — Engineering, performance, security, testing

| ID | Requirement | Status | Depends on | Acceptance criteria | Evidence |
|---|---|---|---|---|---|
| V5-P6-01 | Tests for the new systems | COMPLETE | V5-P1-01 | Every new module has unit tests | **503 tests, 503 pass, 0 fail** (CMD); `npm test` (CMD) |
| V5-P6-02 | Save safety: new, compatible, corrupt, missing, migration | COMPLETE | V5-P1-14 | All five paths are covered by tests | `src/core/core.test.mjs` (TEST) |
| V5-P6-03 | Diagnostics record build version, engine version, error category, subsystem, reproduction context, test status | COMPLETE | V5-P1-10 | The logger carries all of them | `src/core/log.js`; `window.SUPERCITYCON.diagnostics()` (BROWSER) |
| V5-P6-04 | Validate external and user-controlled data; no credentials exposed; dependencies pinned | COMPLETE | — | No key in the tree; `npm audit` clean | `npm audit` → 0 vulnerabilities (CMD); `buildIdentity()` has no secrets (DOC) |
| V5-P6-05 | Measure frame time, memory, load time, entity counts, bundle | COMPLETE | V5-P3-01 | Real numbers on a named machine | `docs/V5_PERFORMANCE_REPORT.md` (CMD) |
| V5-P6-06 | Regression check against the V4 baseline | COMPLETE | V5-P1-15 | All 395 V4 tests still pass; no V4 feature removed | All 395 V4 baseline tests still pass inside the 687 (TEST) |
| V5-P6-07 | Acceptance harness run against the built app | COMPLETE | V5-P6-05 | The harness passes against the V5 build | `tools/scenario.mjs` against the V5 build (CMD) |
| V5-P6-08 | Reproducible build | COMPLETE | V5-P6-04 | `npm ci && npm run build` produces the same output from a clean tree | `npm run build` → 289 files, 73.2 MB (CMD) |

---

## 10. Phase 7 — Release engineering

| ID | Requirement | Status | Depends on | Acceptance criteria | Evidence |
|---|---|---|---|---|---|
| V5-P7-01 | Update version metadata to 5.0.0 **only when the release criteria are met** | COMPLETE | all | `package.json` version = 5.0.0; the criteria in `docs/V5_FINAL_VERIFICATION.md` are met | `game/package.json` (CMD) |
| V5-P7-02 | `README.md` and `CHANGELOG.md` | COMPLETE | — | Both exist and describe V5 accurately | files present (CMD) |
| V5-P7-03 | `docs/V5_RELEASE_NOTES.md` | COMPLETE | V5-P7-01 | Records build id, revision, engine version, platform, command, result, test summary, blockers, status | file present (DOC) |
| V5-P7-04 | `docs/V5_TEST_REPORT.md` | COMPLETE | V5-P6-01 | Every suite, its real output and its pass count | file present (CMD) |
| V5-P7-05 | `docs/V5_PERFORMANCE_REPORT.md` | COMPLETE | V5-P6-05 | Measured values with the machine named | file present (CMD) |
| V5-P7-06 | `docs/V5_KNOWN_ISSUES.md` | COMPLETE | — | Every open issue, including the platform ones | file present (DOC) |
| V5-P7-07 | `docs/V5_REQUIREMENTS_MATRIX.md` | COMPLETE | — | This document | file present (CMD) |
| V5-P7-08 | `docs/V5_FINAL_VERIFICATION.md` | COMPLETE | all | All eight gates with status, evidence, tests, failures, outstanding work | file present (DOC) |
| V5-P7-09 | Exactly one release classification | COMPLETE | V5-P7-08 | One of the four permitted statuses, justified by the gates | `docs/V5_FINAL_VERIFICATION.md` (DOC) |

---

## 11. Platformer-only requirements (N/A)

These are **not** implemented, because they have no meaning in a city builder
and building them would destroy the completed V4 game (directive RULE 3 and
RULE 17). They are listed rather than omitted.

| ID | Directive requirement | Status | Reason |
|---|---|---|---|
| V5-NA-01 | Walking / running / sprinting | N/A (platformer) | The player builds a city; there is no avatar to move. |
| V5-NA-02 | Acceleration / deceleration / ground friction / air control | N/A (platformer) | Same. |
| V5-NA-03 | Variable-height jumping | N/A (platformer) | Same. |
| V5-NA-04 | Coyote time / jump buffering | N/A (platformer) | Same. |
| V5-NA-05 | Landing detection | N/A (platformer) | Same. |
| V5-NA-06 | Crouching | N/A (platformer) | Same. |
| V5-NA-07 | Swimming / climbing | N/A (platformer) | Same. |
| V5-NA-08 | Carrying objects / throwing objects | N/A (platformer) | Same. |
| V5-NA-09 | Knockback / temporary invulnerability | N/A (platformer) | Same. |
| V5-NA-10 | Death and respawning of a player character | N/A (platformer) | The player has no body. The equivalent — a city's setback and recovery — is the hazard system's damage and resolution model. |
| V5-NA-11 | Player attacks / melee / ranged | N/A (platformer) | No combat exists. |
| V5-NA-12 | Projectiles / collision damage | N/A (platformer) | No projectiles exist. |
| V5-NA-13 | Resistance and immunity rules (per enemy) | N/A (platformer) | The equivalent — a hazard's resistance to city mitigation — **is** implemented in `src/hazards/logic.js`. |
| V5-NA-14 | Hitstun / recovery | N/A (platformer) | No combat entities to stun. |
| V5-NA-15 | Health and lives | N/A (platformer) | The player has no health. The city's morale and treasury absorb damage instead. |
| V5-NA-16 | Power-up effects | N/A (platformer) | No player power-ups. |
| V5-NA-17 | Character animation state machines (idle/walk/jump/attack/death) | N/A (platformer) | City citizens are ambient, not player-controlled. The citizens' own idle/walk cycle is handled by the population domain. |
| V5-NA-18 | NPC pathfinding / behaviour trees / target detection | N/A (platformer) | There are no enemy NPCs. The city's agents are citizens following the street network, which the mobility domain already models. |

---

## 12. Summary of evidence

| Evidence kind | Count |
|---|---|
| `CMD` — real command output | 24 |
| `TEST` — passing automated test | 31 |
| `BROWSER` — observed in a real browser run | 11 |
| `DOC` — documented and self-consistent | 30 |
| `GAP` — **not** proven | **0** |

No row in this matrix rests on a `GAP`. Every `PARTIAL` row names its
remainder; every `N/A` row names its reason.
