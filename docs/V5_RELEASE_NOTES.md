# SuperCitycon — V5 Release Notes

**Release:** SuperCitycon **5.0.0**
**Branch:** `v5/upgrade`
**Baseline:** V4 at `main` @ `92c0b37`
**Target platform:** Web (Chromium-verified)
**Build command:** `npm ci && npm run build:cleared`
**Release status:** see `docs/V5_FINAL_VERIFICATION.md`

---

## 1. The release identity

| Field | Value |
|---|---|
| **Product** | SuperCitycon — a retro 16-bit-palette voxel city builder for the browser |
| **Version** | 5.0.0 |
| **Source revision** | `v5/upgrade` (branch tip — see §2) |
| **Baseline revision** | `92c0b37` (`main`, the V4 release) |
| **Engine** | Three.js 0.169.0 |
| **Bundler** | Vite 7.3.7 |
| **Runtime** | ES modules in the browser; no framework; no native build |
| **Target platform** | Web — Chromium verified. Firefox, Safari, Windows and Linux **not** tested (see `docs/V5_KNOWN_ISSUES.md` KI-02) |
| **Build command** | `cd game && npm ci && npm run build:cleared` |
| **Build result** | `✓ built in 3.85 s` → 218 files, 72.7 MB, licence policy **CLEARED** |
| **Test summary** | **687 unit tests, 687 pass, 0 fail** · 79/79 files parse cleanly · content validator 3 levels / 0 errors / 0 warnings · acceptance harness 40/41 pass (1 correctly skipped) · **PRODUCTION BUILD VERIFIED** · real-GPU profile: 0 console / 0 page errors
| **Known blockers** | none code-level. Four environment limitations are named in `docs/V5_KNOWN_ISSUES.md` |
| **Release status** | **V5 RELEASE CANDIDATE** — see `docs/V5_FINAL_VERIFICATION.md` §10 for the reasoning |

---

## 2. Reproducing the build

```bash
git clone <repo> && cd SuperCitycon
git checkout v5/upgrade

cd game
npm ci                    # clean install from the lock file
npm test                  # 687 tests, 687 pass
npm run check             # 79/79 source files parse cleanly
npm run build:cleared     # -> game/dist  (the shippable bundle)

# serve it (the asset paths are absolute, so it must be served from the root)
npm run preview           # http://localhost:4173
```

**Why `build:cleared` and not `build`:** the plain build contains the 2D HUD
art, whose licence is unverified. The cleared build strips it and **fails**
the build if any of it survives. The game is complete and correct with zero
2D images — the HUD falls back to its CSS/text treatment for every icon slot.

---

## 3. What shipped in V5

### 3.1 Architecture

| Change | Why it matters |
|---|---|
| **One clock** — CORE's `advanceClock` is the only time authority | V4 incremented the day counter **twice** per day boundary and emitted `DAY_CHANGED` twice with two different payload shapes |
| **Fixed-timestep simulation** — 1/60 s of game time, catch-up bounded to 8 steps | V4 ticked the domains with the raw wall-clock `dt`, so a decay rate was really "per screen refresh" |
| **Structured logging** — severity, category, context, ring buffer, global handlers | V4 had console noise and no record of what happened or when |
| **A validated settings store** — audio / display / accessibility / input | V4 had scattered dead flags (`state.ui.muted` was never read) |
| **One key-binding table** — `matches` / `rebind` / `resetAll` | V4 read keys inline in several places, so they could not be rebound |
| **A progression record** — checkpoints, collectibles, achievements | V4 tracked a single stage index; nothing but that number survived a save |
| **An explicit teardown path** | V4 created a frame loop and a stage timer and **never stopped either** — a reload left both running |
| **A diagnostics surface** — `window.SUPERCITYCON` | There was no way to inspect a running game |

### 3.2 Save format

`SAVE_VERSION` went **1 → 2** with a `MIGRATIONS` chain. A V4 save migrates on
load; a save from a *newer* version is **refused**, never guessed at. The
migrated-from version is recorded in the payload.

### 3.3 Presentation

- **A pooled, instanced VFX service** with nine effect kinds: `place`,
  `bulldoze`, `level-up`, `checkpoint`, `achievement`, `hazard-smoke`,
  `hazard-fire`, `hazard-water`, `warning`. The plan is pure and unit-tested;
  the service owns the pool and reports its statistics.
- **The effects are wired to the game** — a placement, a demolition, a
  level-up, a checkpoint, an achievement and a hazard each spawn their own
  effect at the right place.
- **The audio mixer is finally connected.** V4 built a complete procedural
  synthesiser with six category buses and **not one call site** — the game ran
  in silence. V5 drives it from the event bus.
- **Reduced visual effects** shorten the particle lifetimes, shrink the
  particles and spawn fewer of them.

### 3.4 Gameplay — the hazard system

The city-builder equivalent of the directive's "enemy intelligence" and "boss
encounter": a **multi-phase city crisis**.

- A hazard escalates through a **telegraphed phase ladder** — each phase
  opens with a warning window during which no damage is dealt.
- Damage flows through an explicit pipeline:
  `phase.damagePerSecond × distanceFalloff × (1 − mitigation)`.
- The city fights the hazard with **its own infrastructure**: the mitigation
  level comes from the service coverage inside the hazard's radius.
- A hazard can be resolved **early** when the mitigation is enough, and it
  resolves on its own when the ladder ends.
- The **crisis** variant runs its phases back to back with rising city-wide
  pressure, and holds a checkpoint through it.

### 3.5 Content — the level pipeline

- A **level schema**: terrain seed, starting city, objectives, checkpoints,
  collectibles, hazards with their phase ladders, exit conditions and
  metadata.
- **Three original levels** — `first-light` (tutorial), `high-water`
  (3-phase flood) and `the-long-night` (4-phase wildfire crisis).
- A **content validator** that detects missing exits, invalid spawn points,
  broken progression links, missing resources, incorrect checkpoint
  definitions, unsupported object types, invalid metadata and unreachable
  objectives.
- An **offline validator CLI** (`game/tools/validate-content.mjs`) that exits
  non-zero on an error.
- A **content service** that loads a level into the live city — the terrain
  seed, the starting city, the hazards and the progression links.

### 3.6 Accessibility

Remappable controls, reduced visual effects, reduced screen shake, adjustable
text size, high contrast, colour-blind-safe indicators, and keyboard
navigation throughout the menus.

---

## 4. The defects this release fixes

All of them were found by inspection **and** confirmed by measurement, not by
reading the brief.

1. **The day counter incremented twice.** `main.js` kept its own day
   accumulator *and* called CORE's `advanceDay`. Every day boundary bumped
   the counter twice and emitted the event twice, with two different payload
   shapes. **Fixed** by making CORE's `advanceClock` the only clock.

2. **A level's starting city was refused by the construction-slot gate.** A
   browser run of `loadLevel('the-long-night')` placed 1 building and skipped
   30 with `not-enough-slots`. The starting city already existed when the
   player arrived — it is not player construction, so it should be neither
   charged nor slotted. **Fixed** with an explicit `prebuilt` option on
   `buildings.place()`; the level now loads 128 objects and skips 0.

3. **The hazard's effect was drawn underground.** Effects were placed at world
   `y = 0`, but the terrain has real elevation. The wildfire's cell (56, 32) is
   on a plateau **9 units above** the base plane, so the fire was drawn inside
   the hill: the effect service reported the spawns and **not one pixel**
   reached the screen. **Fixed** by asking the WORLD domain for the ground
   height (`wld.heightAt`) — the hazard's particles moved from world y
   0.82–1.27 to y 10.02–13.13, and the ember, flame and smoke are now
   captured on the plateau. Seven regression tests cover it, and they were
   mutation-verified.

4. **The hazard effect was drawn twice.** The hazard domain pulsed it *and* the
   integrator's event bridge answered the same events, so every phase drew two
   copies — and the bridge's copy was the underground one. **Fixed** by making
   the hazard domain the sole owner of the hazard's visuals.

5. **The renderer counter under-reported every frame.** Three.js resets
   `renderer.info` *after* the shadow-map pass, so the number the adaptive
   quality driver and the HUD's performance read-out depend on described the
   main scene pass only — and with post-processing on, the fullscreen retro
   pass alone. The acceptance harness caught it as `1 draw calls, 1 triangles`
   for a scene with 573 meshes. **Fixed** with `autoReset = false`, a reset at
   the top of the frame, and the monitor and the adaptive driver moved after
   the draw.

6. **The performance profiler could report a negative frame time.** The sampler
   seeded from `performance.now()` and differenced it against the next rAF
   timestamp, which can be earlier. One real run reported `minMs: -63.8` and a
   `p99Ms` of 66.6 — both artefacts. **Fixed** by seeding from the first rAF
   timestamp; every report now publishes `negativeSamples`, which is 0.

---

## 5. Compatibility

| Target | Status |
|---|---|
| macOS, Intel, Chromium | **verified** — 60.0 fps mean, 16.667 ms mean frame, p95 18.6 ms, p99 18.7 ms, 0 console / 0 page errors. In a populated city (186 buildings, 2 473 residents, 60 vehicles): 55.0 fps mean, 18.167 ms mean frame, worst frame 35.1 ms |
| macOS, Apple Silicon | **not verified** — no ARM machine or ARM CI runner available |
| Windows | **not verified** — no Windows machine available |
| Linux | **not verified** — no Linux machine available |
| Firefox / Safari | **not verified** — no non-Chromium browser available |
| Native (macOS / Windows / Linux binary) | **not produced** — out of scope for a web project |

The web bundle is architecture-independent, but that is an inference and is
not presented as a test.

---

## 6. Dependency position

| Package | Version | Note |
|---|---|---|
| `three` | 0.169.0 | the only runtime dependency |
| `vite` | 7.3.7 | dev dependency — **upgraded from 5.4.21** to clear the esbuild advisory |

`npm audit` → **0 vulnerabilities** (it was 2 advisories before the upgrade).

No paid dependency. No credential, token or key anywhere in the tree.

---

## 7. Licence position — unchanged

| Asset set | Licence | Status |
|---|---|---|
| 3D models and animation (158 assets, 5 packs) | CC0-1.0 / MIT | **cleared to publish** |
| 2D HUD art (69 distinct images across 84 HUD records) | `unverified` | **NOT cleared — quarantined** |

The cleared build strips all 69 and **fails** if any survives. The HUD is
complete and correct with **zero** 2D images.

**This is a publisher decision, not an engineering task.** Clearing the 2D art
needs per-image authoritative sources; no assumption was made and no licence
was fabricated. See `game/LICENCE-REPORT.md`.

---

## 8. What V5 does NOT deliver

Stated plainly, because silence would be read as completion.

1. **No character locomotion, combat, projectiles, hitstun, i-frames, health
   or lives.** The directive's capability list is written for a 2D action
   platformer; SuperCitycon is a city builder. The mapping is documented in
   `docs/V5_UPGRADE_PLAN.md` §1 and every platformer-only requirement is
   listed with its reason in `docs/V5_REQUIREMENTS_MATRIX.md` §11.
2. **No native executable.**
3. **No Apple Silicon validation.**
4. **No music, ambience or voice content** — the project has no audio asset
   files; every sound is synthesised at runtime.
5. **No shipped 2D art.**
6. **No Windows / Linux / non-Chromium browser testing.**
7. **Gamepad navigation is partial** — the API is read and the bindings are
   routed, but analogue-stick camera and pad menu navigation are not
   implemented.
8. **No LLM-driven NPC dialogue** — no authorised provider, no key, and the
   directive forbids hardcoding credentials.
9. **Save files are dominated by JSON-encoded terrain arrays** — base64
   encoding was deliberately deferred because a populated save uses under 2 %
   of the quota.

---

## 9. Where to read next

| Document | What it is |
|---|---|
| [`docs/V5_FINAL_VERIFICATION.md`](docs/V5_FINAL_VERIFICATION.md) | the eight acceptance gates and the release classification |
| [`docs/V5_TEST_REPORT.md`](docs/V5_TEST_REPORT.md) | every suite, its real output and its pass count |
| [`docs/V5_PERFORMANCE_REPORT.md`](docs/V5_PERFORMANCE_REPORT.md) | the measured numbers and the machine they came from |
| [`docs/V5_KNOWN_ISSUES.md`](docs/V5_KNOWN_ISSUES.md) | what is still open |
| [`docs/V5_REQUIREMENTS_MATRIX.md`](docs/V5_REQUIREMENTS_MATRIX.md) | every requirement, its status and its evidence |
| [`docs/V5_SYSTEM_ARCHITECTURE.md`](docs/V5_SYSTEM_ARCHITECTURE.md) | the architecture and every change made to reach it |
| [`docs/V5_RISK_REGISTER.md`](docs/V5_RISK_REGISTER.md) | every risk, with likelihood, impact, mitigation and status |
| [`docs/V5_UPGRADE_PLAN.md`](docs/V5_UPGRADE_PLAN.md) | the plan, the genre mapping and the scope decisions |
| [`docs/V4_BASELINE_AUDIT.md`](docs/V4_BASELINE_AUDIT.md) | what V4 actually was, measured |
| [`CHANGELOG.md`](../CHANGELOG.md) | the full change list |
| [`CURSOR-HANDOFF.md`](../CURSOR-HANDOFF.md) | the pending senior review brief |
