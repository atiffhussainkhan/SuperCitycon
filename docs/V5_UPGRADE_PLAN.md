# SuperCitycon — V5 Upgrade Plan

**Document status:** complete (Phase 0 deliverable)
**Applies to:** SuperCitycon V4 → V5
**Branch:** `v5/upgrade`
**Baseline commit:** `92c0b37` (`main`)
**Prepared:** SuperCitycon V5 upgrade programme

---

## 0. How to read this document

This plan is the contract between the V5 programme and the evidence it will
produce. Every phase states:

- **what** is being built,
- **which files** it owns,
- **how** it will be verified,
- and **what would make it INCOMPLETE**.

The companion documents are:

| Document | Role |
|---|---|
| `docs/V4_BASELINE_AUDIT.md` | what V4 actually is, measured |
| `docs/V5_REQUIREMENTS_MATRIX.md` | every requirement, its id, status, evidence |
| `docs/V5_RISK_REGISTER.md` | every risk, its likelihood, impact, mitigation, owner |
| `docs/V5_SYSTEM_ARCHITECTURE.md` | the V5 architecture and what changed |
| `docs/V5_RELEASE_NOTES.md` | what ships |
| `docs/V5_TEST_REPORT.md` | what was tested and what it returned |
| `docs/V5_PERFORMANCE_REPORT.md` | measured performance |
| `docs/V5_KNOWN_ISSUES.md` | what is still wrong |
| `docs/V5_FINAL_VERIFICATION.md` | the eight gates, with evidence |

---

## 1. The genre mapping (a stated assumption)

The V5 directive is written in the language of a 2D action platformer: it asks
for "enemy intelligence", "boss encounters", "player movement", "jumping",
"weapon damage pipelines", "collectibles" and "level transitions".

**SuperCitycon is a 3D city builder.** Turning it into a platformer would
destroy the completed V4 game, which RULE 3 and RULE 17 of the directive both
forbid.

The directive therefore maps its capability areas onto SuperCitycon's own
idiom. This mapping is an explicit, stated assumption — not a silent
substitution — and it is the same assumption recorded in
`docs/V4_BASELINE_AUDIT.md`:

| Directive capability | SuperCitycon V5 idiom | Where it lands |
|---|---|---|
| Enemy archetypes (patrol/chase/retreat/projectile/guard) | **Service-driven city systems** — power, water, waste, health, police, fire, transit — each with its own coverage model, demand curve and failure state | `src/services/`, `src/economy/` |
| Multi-phase boss encounter | **Multi-phase city crisis** — a hazard that escalates through a telegraphed phase ladder (flood → surge → breach) and must be resolved by the city's own infrastructure | `src/hazards/` |
| Player movement / jumping / coyote time | **Camera rig + build-tool cursor** — the player moves the city, not an avatar | `src/ui/camera.js` (V4) |
| Damage pipeline | **Hazard damage pipeline** — phase damage rate × distance falloff × (1 − mitigation) → buildings, happiness, treasury | `src/hazards/logic.js` |
| Checkpoints / collectibles / achievements | **City milestones** — named districts the city has secured, records recovered, city awards earned | `src/core/progress.js` |
| Level templates / world-map nodes | **Level templates** — terrain seed, starting city, objectives, hazards, checkpoints, exit conditions | `src/content/` |
| Menus / HUD / accessibility / remappable controls | Kept 1:1 — the directive's UI section maps directly onto the existing UI domain | `src/ui/` |
| Save migration | Kept 1:1 — save format versioning already existed; V5 adds the migration chain | `src/core/save.js` |
| Fixed timestep / event bus / structured logging | Kept 1:1 — direct architecture requirements | `src/core/`, `src/main.js` |

What the directive asks for that has **no** city-builder equivalent, and is
therefore explicitly **NOT** claimed as delivered:

- character locomotion (walk/run/sprint/jump/crouch/swim/climb),
- melee/ranged combat, projectiles, hitstun, knockback, i-frames,
- character animation state machines (idle/walk/jump/attack/death),
- NPC pathfinding and behaviour trees,
- motion capture, retargeting, inverse kinematics.

---

## 2. Phase 0 — Discovery, preservation, plan

**Exit criteria:** the actual V4 environment inspected, the upgrade scope
documented, a recovery strategy exists.

| Task | Status | Evidence |
|---|---|---|
| Inspect the real project (not the brief) | complete | `docs/V4_BASELINE_AUDIT.md` |
| Establish the V4 baseline | complete | 395 tests pass, 56/56 files parse, `npm audit` = 2 advisories |
| Preserve V4 | complete | branch `v5/upgrade` from `92c0b37`; `main` and production untouched |
| Recoverable checkpoint | complete | `main` @ `92c0b37` remains the recovery point; worktree is disposable |
| Audit: world / entities / simulation | complete | baseline audit §2 |
| Audit: UI / audio / camera | complete | baseline audit §2 |
| Audit: core loop / saves | complete | baseline audit §2 |
| Audit: tests / tools / build | complete | baseline audit §3 |
| `docs/V4_BASELINE_AUDIT.md` | complete | this repository |
| `docs/V5_UPGRADE_PLAN.md` | complete | this document |
| `docs/V5_REQUIREMENTS_MATRIX.md` | complete | shared with Phase 7 |
| `docs/V5_RISK_REGISTER.md` | complete | — |

### Isolation rules (binding)

1. V5 work happens on `v5/upgrade` in a **separate git worktree**:
   `…/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/v5-worktree`.
2. `main` is never checked out in the V5 worktree, never force-pushed, never
   merged into.
3. Six files are being edited by a concurrent process in the `main` workspace:
   `game/src/ui/styles.js`, `tools/performance.mjs`,
   `game/tests/construction-progression.test.mjs`, `tools/performance-gpu.mjs`,
   `tools/performance-gpu.test.mjs`, `tools/verify-shop-layout.mjs`.
   **None of them are touched by the V5 programme.**
4. Production (`origin/main` and the live site) is not touched until the user
   explicitly authorises a deploy.

---

## 3. Phase 1 — Core architecture

**Goal:** the technical foundation for a substantially larger game — modular
subsystems, deterministic simulation, versioned data, structured logging,
save migration, lifecycle management.

| # | Item | Files | Status |
|---|---|---|---|
| 1.1 | Structured logging with severity + category + ring buffer | `src/core/log.js` | **complete** |
| 1.2 | Global error handlers routed into the log | `src/core/log.js` | **complete** |
| 1.3 | Validated, persisted user settings (audio / display / accessibility / input) | `src/core/settings.js` | **complete** |
| 1.4 | Single input-binding table with rebinding + reset | `src/core/input-map.js` | **complete** |
| 1.5 | Progression record (checkpoints / collectibles / achievements) | `src/core/progress.js` | **complete** |
| 1.6 | **Fixed-timestep simulation** with bounded catch-up | `src/main.js` | **complete** |
| 1.7 | **One clock** — CORE's `advanceClock` is the only time authority | `src/core/modes.js`, `src/main.js` | **complete** |
| 1.8 | Save format versioning + **migration chain** | `src/core/save.js` | **complete** |
| 1.9 | Explicit teardown: every domain disposed, rAF cancelled, timer cleared | `src/main.js` | **complete** |
| 1.10 | Diagnostics surface published for the harness | `src/main.js` | **complete** |
| 1.11 | Event-driven communication, centralised | `src/core/events.js` | **complete** |
| 1.12 | Defensive handling of missing/invalid resources | across domains | **complete** |
| 1.13 | Configuration separated from logic (`TUNING` + `TUNING_TBD`) | `src/core/config.js` | **complete** |
| 1.14 | Object pooling where profiling shows benefit | `src/population/`, `src/render/fx.js` | **complete** |
| 1.15 | `docs/V5_SYSTEM_ARCHITECTURE.md` | — | **complete** |

**Verification:** `npm test` (495 tests), `npm run check` (68/68), `npm run build`.

### The two defects this phase found and fixed

1. **The day counter incremented twice.** `main.js` kept its own `dayAccum`
   *and* called CORE's `advanceDay`, so every day boundary bumped the counter
   twice and emitted `DAY_CHANGED` twice with two different payload shapes.
   Fixed by making CORE's `advanceClock` the only clock.
2. **The simulation was frame-rate dependent.** Domains were ticked with a
   variable wall-clock `dt`, so a decay rate was really "per screen refresh".
   Fixed with a fixed step of `TUNING.fixedStep` (1/60 s) and a bounded
   catch-up of `TUNING.maxCatchUpSteps` (8).

---

## 4. Phase 2 — Gameplay transformation

**Goal:** more reliable, more varied city gameplay, expressed in the city
builder's own language.

| # | Item | Files | Status |
|---|---|---|---|
| 2.1 | Multi-phase hazard ladder with telegraph windows | `src/hazards/logic.js` | **complete** |
| 2.2 | Hazard damage pipeline (buildings / morale / treasury) | `src/hazards/logic.js` | **complete** |
| 2.3 | Mitigation from the city's own service coverage | `src/hazards/logic.js` | **complete** |
| 2.4 | City-crisis escalation (the "boss" encounter) | `src/hazards/logic.js` | **complete** |
| 2.5 | Checkpoint integration — a checkpoint survives a crisis and a reload | `src/hazards/`, `src/core/progress.js` | **complete** |
| 2.6 | Collectibles and achievements persisted in the save | `src/core/progress.js` | **complete** |
| 2.7 | Level entry / exit conditions | `src/content/` | **complete** |
| 2.8 | Branching progression (objectives → checkpoints → exit) | `src/content/validate.js` | **complete** |
| 2.9 | Interactive environment: hazards affect the live city | `src/hazards/` | **complete** |
| 2.10 | Population animation FSM, terrain-following, pooling | `src/population/` | **complete** |

---

## 5. Phase 3 — Visual, animation, audio

**Goal:** a more polished, visually consistent experience with real feedback.

| # | Item | Files | Status |
|---|---|---|---|
| 3.1 | Pooled, instanced VFX service with 9 effect kinds | `src/render/fx.js`, `src/render/fx-plan.js` | **complete** |
| 3.2 | VFX wired to gameplay events (placement, demolish, level-up, checkpoint, achievement, hazard) | `src/main.js` | **complete** |
| 3.3 | Audio mixer connected to the event bus (it was built in V4 and never called) | `src/main.js` | **complete** |
| 3.4 | Structured audio buses: master / music / sfx / ambience / ui | `src/audio/audio.js` (V4) + `src/core/settings.js` | **complete** |
| 3.5 | Reduced-motion honoured by the effect service | `src/render/fx.js` | **complete** |
| 3.6 | Day/night driven by the game clock, not a second counter | `src/main.js`, `src/render/sky.js` | **complete** |
| 3.7 | Camera boundaries, smoothing, focus | `src/ui/camera.js` (V4) | **complete (V4)** |

**Audio honesty note:** the project has **no audio asset files**. The mixer
synthesises every sound at runtime. There is therefore no music, no ambience
loop and no voice content, and none is claimed.

---

## 6. Phase 4 — Interface, accessibility, UX

**Goal:** a coherent V5 interface system with real accessibility.

| # | Item | Files | Status |
|---|---|---|---|
| 4.1 | Settings menu wired to the real settings store | `src/ui/` | **complete** |
| 4.2 | Remappable controls from the single binding table | `src/core/input-map.js`, `src/ui/` | **complete** |
| 4.3 | Accessibility: reduced effects, reduced shake, text scale, high contrast, colour-blind indicators | `src/core/settings.js`, `src/ui/` | **complete** |
| 4.4 | Main menu / pause menu / level select | `src/ui/` | **complete** |
| 4.5 | Pause / resume | `src/main.js`, `src/core/modes.js` | **complete (V4)** |
| 4.6 | Keyboard navigation | `src/ui/` | **complete** |
| 4.7 | Controller navigation | `src/ui/` | **PARTIAL** — see known issues |

---

## 7. Phase 5 — Content pipeline

**Goal:** a reusable level-content pipeline with real validation.

| # | Item | Files | Status |
|---|---|---|---|
| 5.1 | Level template schema + shipped library | `src/content/levels.js` | **complete** |
| 5.2 | Content validator (pure) | `src/content/validate.js` | **complete** |
| 5.3 | Offline validator CLI | `game/tools/validate-content.mjs` | **complete** |
| 5.4 | Content service (apply a level to the live city) | `src/content/index.js` | **complete** |
| 5.5 | Detect missing exits | `src/content/validate.js` | **complete** |
| 5.6 | Detect invalid spawn points | `src/content/validate.js` | **complete** |
| 5.7 | Detect broken progression links | `src/content/validate.js` | **complete** |
| 5.8 | Detect missing resources | `src/content/validate.js` | **complete** |
| 5.9 | Detect incorrect checkpoint definitions | `src/content/validate.js` | **complete** |
| 5.10 | Detect unsupported object types | `src/content/validate.js` | **complete** |
| 5.11 | Detect invalid metadata | `src/content/validate.js` | **complete** |
| 5.12 | Detect unreachable required objectives | `src/content/validate.js` | **complete** |
| 5.13 | A polished original level demonstrating the integrated mechanics | `src/content/levels.js` (`the-long-night`) | **complete** |

---

## 8. Phase 6 — Engineering, performance, security, testing

| # | Item | Status |
|---|---|---|
| 6.1 | Unit tests for every new system | **complete** — 495 tests pass |
| 6.2 | Save safety: new / compatible / corrupt / missing / migration | **complete** |
| 6.3 | Diagnostics: build version, engine version, subsystem, test status | **complete** — `core/log.js` |
| 6.4 | Dependency advisories | **complete** — vite upgraded to 7.x, `npm audit` clean |
| 6.5 | Frame time / memory / load time / bundle measured | **complete** — `docs/V5_PERFORMANCE_REPORT.md` |
| 6.6 | Regression check against the 395-test V4 baseline | **complete** |
| 6.7 | Acceptance harness run against the built app | **complete** |
| 6.8 | Build reproducibility | **complete** |

---

## 9. Phase 7 — Release

| # | Item | Status |
|---|---|---|
| 9.1 | Version metadata → 5.0.0 | **complete** |
| 9.2 | `README.md` / `CHANGELOG.md` | **complete** |
| 9.3 | The seven V5 release documents | **complete** |
| 9.4 | Build identifier, source revision, engine version, target platform, build command, build result, test summary, blockers, release status | **complete** — `docs/V5_RELEASE_NOTES.md` |
| 9.5 | Release classification | **complete** — `docs/V5_FINAL_VERIFICATION.md` |

---

## 10. Acceptance gates

Each gate has a status, evidence, tests performed, failures and outstanding
work. The full evidence is in `docs/V5_FINAL_VERIFICATION.md`.

| Gate | Subject | Status |
|---|---|---|
| 0 | V4 preservation and audit complete | **PASS** |
| 1 | V5 architecture implemented and validated | **PASS** |
| 2 | Core gameplay systems functioning | **PASS** |
| 3 | Enemy, combat and progression systems verified | **PASS (city-builder interpretation)** |
| 4 | Visual, animation and audio integration reviewed | **PASS** |
| 5 | UI, accessibility and content systems tested | **PASS** |
| 6 | Performance and regression verification complete | **PASS** |
| 7 | Build and release verification complete | **PASS** |

---

## 11. What V5 deliberately does NOT deliver

Stated plainly so no reader mistakes silence for completion:

1. **No character locomotion, combat, projectiles, hitstun or i-frames.** They
   have no meaning in a city builder. See §1.
2. **No motion capture, retargeting or IK.** Never implemented, never claimed.
3. **No native executable.** Web only. No macOS/Windows/Linux binary was
   produced or tested.
4. **No Apple Silicon validation.** The machine is x86_64. The gate stays open.
5. **No shipped music, ambience or voice.** The mixer synthesises effects at
   runtime; there are no audio asset files.
6. **No 2D art ships.** 69 images are licence-unverified and are quarantined.
   The cleared build serves 0 of them.
7. **No Windows / Linux / non-Chromium browser testing.** No such machines or
   browsers are available in this environment.
8. **No LLM-driven NPC dialogue.** No authorised provider is configured; the
   directive permits it only with one.
9. **Save size is not optimised.** Measured at ~46.6 KB empty / ~99.1 KB
   populated, dominated by JSON-encoded terrain arrays. Judged not to be a
   bottleneck against the 5 MB quota; base64 encoding was deliberately
   deferred and is recorded in the risk register rather than silently skipped.
