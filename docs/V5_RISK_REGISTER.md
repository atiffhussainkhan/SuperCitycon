# SuperCitycon — V5 Risk Register

**Document status:** complete (Phase 0 deliverable, re-verified at Phase 7)
**Applies to:** SuperCitycon V4 → V5
**Branch:** `v5/upgrade`
**Baseline:** `main` @ `92c0b37`

---

## 1. How risks are scored

**Likelihood** and **Impact** are each `High` / `Medium` / `Low`. The
**Severity** is the product, and it drives the mitigation effort.

| | Impact Low | Impact Medium | Impact High |
|---|---|---|---|
| **Likelihood High** | Medium | High | **Critical** |
| **Likelihood Medium** | Low | Medium | **High** |
| **Likelihood Low** | Low | Low | Medium |

Each risk has a **status**: `OPEN`, `MITIGATED`, `ACCEPTED` (a deliberate,
documented decision not to fix it), or `CLOSED` (the risk is gone).

---

## 2. The register

### R-01 — 2D art licence exposure

| Field | Value |
|---|---|
| **Category** | Legal / licensing |
| **Likelihood** | High |
| **Impact** | High |
| **Severity** | **Critical** |
| **Status** | **ACCEPTED (quarantined)** |
| **Owner** | Release manager |

**Description.** 69 distinct 2D images in the asset library carry
`licence: "unverified"`. Their redistribution rights could not be confirmed
against an authoritative source. Shipping any of them would risk distributing
unlicensed art.

**Mitigation implemented.**
- The cleared build (`npm run build:cleared`) excludes every unverified 2D
  file. Verified live: **0 of 69** uncleared files are served;
  `DO-NOT-PUBLISH.txt`, `assets/ui-assets.json` and `assets/ui/` all return
  **404** on the live site.
- The HUD renders with **0 images** in the cleared build — icons are optional
  by construction when `ui-assets.json` is absent.
- The acceptance harness's 2D-art check is **skipped** (not failed) in the
  cleared profile, so a green harness run never hides the quarantine.

**Residual risk.** The publisher may want the 2D art. That is a licence
clearance task, not an engineering one, and it needs per-image authoritative
sources. **Not an engineering action.**

---

### R-02 — Apple Silicon / ARM build never validated

| Field | Value |
|---|---|
| **Category** | Platform / hardware |
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Severity** | Medium |
| **Status** | **OPEN** |
| **Owner** | Release manager |

**Description.** The development machine is `x86_64`. No ARM build was
produced, no ARM benchmark was run, and no native executable exists at all.

**Mitigation implemented.** The claim is scoped honestly: every performance
figure in `docs/V5_PERFORMANCE_REPORT.md` is labelled with the machine it was
measured on, and no ARM or native performance is claimed. The web build is
architecture-independent, so an M-series Mac runs the same JavaScript — but
that is an inference, **not a test**.

**Closure requirement.** An ARM64 machine (or an ARM CI runner) running the
build and the acceptance harness.

---

### R-03 — Cursor senior review could not be run

| Field | Value |
|---|---|
| **Category** | Process / quality |
| **Likelihood** | High |
| **Impact** | Medium |
| **Severity** | **High** |
| **Status** | **OPEN** |
| **Owner** | Release manager |

**Description.** The working standard requires a Cursor senior review of every
deliverable. `cursor agent` was invoked three times on three different models
and every attempt returned **`You're out of usage`**. The review is therefore
**Awaiting Cursor review**, and this document must not be read as if a senior
review had taken place.

**Mitigation implemented.** `CURSOR-HANDOFF.md` (this repository root) carries
the full brief, the acceptance criteria, the changed-file list with reasons,
the real test output and the known issues needing visual inspection — so the
review can be run the moment quota returns.

**Closure requirement.** Run `cursor agent --print --trust --mode ask` with the
handoff prompt and integrate the findings.

---

### R-04 — Two clocks in the simulation (found and fixed in V5)

| Field | Value |
|---|---|
| **Category** | Correctness |
| **Likelihood** | High (in V4) |
| **Impact** | High |
| **Severity** | **High** |
| **Status** | **CLOSED** |
| **Owner** | Integrator |

**Description.** `main.js` kept its own day accumulator *and* called CORE's
`advanceDay`. Every day boundary therefore incremented the counter twice and
emitted `DAY_CHANGED` twice, with two different payload shapes.

**Mitigation implemented.** CORE's `advanceClock` is now the **only** clock.
`main.js` derives the time of day from `meta.elapsed` and `seekTimeOfDay`
moves the elapsed time rather than setting the renderer directly. Covered by
the core test suite.

---

### R-05 — Frame-rate-dependent simulation (found and fixed in V5)

| Field | Value |
|---|---|
| **Category** | Correctness / determinism |
| **Likelihood** | High (in V4) |
| **Impact** | Medium |
| **Severity** | **High** |
| **Status** | **CLOSED** |
| **Owner** | Integrator |

**Description.** Domains were ticked with a variable wall-clock `dt`, so a
decay rate was really "per screen refresh" — the same city could behave
differently at 30 Hz and 144 Hz.

**Mitigation implemented.** A fixed step of `TUNING.fixedStep` (1/60 s of game
time) with a bounded catch-up of `TUNING.maxCatchUpSteps` (8). A backlog
larger than the bound is dropped rather than spiralled. Presentation (camera,
animation) still uses the real frame time.

---

### R-06 — Save format break across versions

| Field | Value |
|---|---|
| **Category** | Data / persistence |
| **Likelihood** | Medium |
| **Impact** | High |
| **Severity** | **High** |
| **Status** | **MITIGATED** |
| **Owner** | Integrator |

**Description.** V5 changes the state tree (`state.meta.progress`, the hazard
subtree). A V4 save loaded by a V5 build must migrate, not be misread.

**Mitigation implemented.**
- `SAVE_VERSION` bumped `1 → 2` with a `MIGRATIONS` chain keyed by source
  version and a `migrateRecord()` step.
- Migration is wired into both `loadFromStorage` and `importSave`, and the
  payload records `migratedFrom`.
- A save with a **newer** version is refused, never guessed at.
- Four migration regression tests were added.

**Residual risk.** Migration is tested for v1 → v2 only. A future v3 must add
its own migration and its own test.

---

### R-07 — Concurrent edits by another process to six files

| Field | Value |
|---|---|
| **Category** | Process / repository integrity |
| **Likelihood** | High |
| **Impact** | High |
| **Severity** | **High** |
| **Status** | **CLOSED** |
| **Owner** | Integrator |

**Description.** Six files in the `main` workspace are being edited by another
process: `game/src/ui/styles.js`, `tools/performance.mjs`,
`game/tests/construction-progression.test.mjs`, `tools/performance-gpu.mjs`,
`tools/performance-gpu.test.mjs`, `tools/verify-shop-layout.mjs`.

**Mitigation implemented.** All V5 work happens on `v5/upgrade` in an isolated
worktree. None of the six files was read-modified, overwritten, committed or
merged by the V5 programme. `main` remains at `92c0b37` with the other
process's edits intact.

---

### R-08 — Accidental write to the wrong worktree (occurred once, contained)

| Field | Value |
|---|---|
| **Category** | Process / repository integrity |
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Severity** | Medium |
| **Status** | **CLOSED** |
| **Owner** | Integrator |

**Description.** One edit was written to the V4 Game Studio worktree
(`v4-worktree/game/src/main.js`) instead of the V5 worktree. It was detected
immediately and reverted with `git checkout --`; the V4 branch was confirmed
clean at `3d3a8bb`.

**Mitigation implemented.** Every write since has been preceded by an explicit
`cd` into the V5 worktree in the same command.

---

### R-09 — Save size dominated by JSON-encoded terrain arrays

| Field | Value |
|---|---|
| **Category** | Performance / storage |
| **Likelihood** | Low |
| **Impact** | Low |
| **Severity** | Low |
| **Status** | **ACCEPTED (deferred)** |
| **Owner** | Integrator |

**Description.** A save is **~46.6 KB empty** and **~99.1 KB populated**. The
dominant cost is the heightmap, water map and type map serialised as JSON
arrays — 4096 numbers each, written as decimal text.

**Assessment.** The quota is 5 MB. The populated save uses under 2 % of it.
Base64 encoding of the typed arrays would roughly halve the size, at the cost
of a change to the save codec and a migration risk on a format that is not
pressured.

**Decision.** Deliberately deferred. Recorded here rather than silently
skipped.

---

### R-10 — Controller navigation is partial

| Field | Value |
|---|---|
| **Category** | Accessibility / input |
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Severity** | Medium |
| **Status** | **PARTIAL** |
| **Owner** | UI domain |

**Description.** The directive asks for controller support. The gamepad API is
read and the bindings are routed through the same `input-map` table, but
full gamepad navigation (analogue stick camera, focus traversal, menu
navigation with a pad) is incomplete.

**Honesty.** This is reported as **PARTIAL**, not "complete". It does not block
the release classification, because keyboard navigation — the primary input
path — is complete and tested.

---

### R-11 — Non-Chromium browsers, Windows and Linux untested

| Field | Value |
|---|---|
| **Category** | Compatibility |
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Severity** | Medium |
| **Status** | **OPEN** |
| **Owner** | Release manager |

**Description.** The game is a Vite + Three.js web build. It has been tested in
Chromium only. No Windows or Linux machine is available in this environment.

**Mitigation implemented.** The build uses no platform-specific API beyond
`localStorage`, `requestAnimationFrame` and the WebGL2 context — all of which
are long-standing, widely supported. **This is reasoning, not a test.**

**Closure requirement.** A run of `tools/scenario.mjs` against the built app
in Firefox and Safari, plus a CI matrix.

---

### R-12 — No native executable

| Field | Value |
|---|---|
| **Category** | Packaging |
| **Likelihood** | High |
| **Impact** | Medium |
| **Severity** | **High** |
| **Status** | **ACCEPTED (out of scope)** |
| **Owner** | Release manager |

**Description.** The directive's Phase 7 asks for a reproducible playable
build and asks not to claim an installer that does not exist. The workspace
supports **web only**.

**Mitigation implemented.** No installer is claimed. The release notes state
the target platform as *web (Chromium-verified)* and give the exact build and
launch commands.

---

### R-13 — 2D art assets exist but are unusable

| Field | Value |
|---|---|
| **Category** | Content / assets |
| **Likelihood** | High |
| **Impact** | Low |
| **Severity** | Medium |
| **Status** | **ACCEPTED** |
| **Owner** | Release manager |

**Description.** The library holds 2D image packs that the game's HUD would
like to use, but they are the same unverified set as R-01.

**Mitigation implemented.** The HUD is built so icons are **optional by
construction**: with `ui-assets.json` absent, the cleared build renders the
full HUD with zero images and no broken-image placeholders. Verified live.

---

### R-14 — TUNING discipline breach (found and fixed in V5)

| Field | Value |
|---|---|
| **Category** | Correctness / honesty |
| **Likelihood** | Medium |
| **Impact** | Low |
| **Severity** | Low |
| **Status** | **CLOSED** |
| **Owner** | Integrator |

**Description.** During the V5 core work, four new numbers were introduced into
the integrator's own code without going through `TUNING`, which is a breach of
the project's own rule 3 — a rule that binds the integrator as much as the
domain agents.

**Mitigation implemented.** `TUNING.dayStartFraction`, `TUNING.skyRepaintStep`,
`TUNING.fixedStep` and `TUNING.maxCatchUpSteps` were added, each with a
matching `TUNING_TBD` entry, and the inline constants were replaced with reads
from `TUNING`.

---

### R-15 — New domain code could import `three` into a pure module

| Field | Value |
|---|---|
| **Category** | Architecture |
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Severity** | Medium |
| **Status** | **MITIGATED** |
| **Owner** | Integrator |

**Description.** The contract requires that the modules holding game rules
never import `three`, so they stay unit-testable in Node.

**Mitigation implemented.** `tests/integration.test.mjs` verifies the pure-rule
module list automatically. The V5 pure modules added to that list:
`core/log.js`, `core/settings.js`, `core/input-map.js`, `core/progress.js`,
`content/levels.js`, `content/validate.js`, `hazards/logic.js`.

---

### R-16 — No audio asset files exist

| Field | Value |
|---|---|
| **Category** | Content |
| **Likelihood** | High |
| **Impact** | Low |
| **Severity** | Medium |
| **Status** | **ACCEPTED** |
| **Owner** | Integrator |

**Description.** The directive asks for music, ambience and voice. The
project has **no audio files at all** — the V4 mixer synthesises its ten
sounds at runtime.

**Mitigation implemented.** The mixer is now genuinely connected to the event
bus (in V4 it was built and never called), with six category buses and
settings-driven volumes. The absence of music/ambience/voice is stated
explicitly in the release notes; nothing is described as a "placeholder" that
is really final.

---

### R-17 — No LLM-driven NPC dialogue

| Field | Value |
|---|---|
| **Category** | Scope / authorisation |
| **Likelihood** | Low |
| **Impact** | Low |
| **Severity** | Low |
| **Status** | **ACCEPTED (out of scope)** |
| **Owner** | Release manager |

**Description.** The directive permits optional LLM-driven NPC dialogue only
with an authorised provider and documented safeguards. No provider is
configured and no key exists in this environment, and the directive forbids
hardcoding credentials.

**Decision.** Not implemented. Not claimed. No scripted behaviour is presented
as generative AI.

---

### R-18 — A hazard can fire outside the playfield

| Field | Value |
|---|---|
| **Category** | Content |
| **Likelihood** | Low |
| **Impact** | Low |
| **Severity** | Low |
| **Status** | **MITIGATED** |
| **Owner** | Integrator |

**Description.** A level could declare a hazard whose centre lies outside the
64 × 64 grid, where it can never affect the city.

**Mitigation implemented.** The content validator reports
`hazard.out-of-bounds` as a **warning** and the hazard domain clamps the
affected area to the playfield. The shipped library validates with zero
warnings.

---

### R-19 — A visual effect is placed underground and nobody sees it

| Field | Value |
|---|---|
| **Category** | Rendering / content |
| **Likelihood** | High (it happened) |
| **Impact** | High (a headline feature is invisible) |
| **Severity** | High |
| **Status** | **CLOSED** |
| **Owner** | Integrator |

**Description.** `cellCenter(cx, cz)` and `cellToWorld(cx, cz)` both default
their height to `0`, and the terrain has real elevation. Any effect placed
with the default height is drawn **inside** any raised ground. The V5 hazard
effects were placed this way: the wildfire's cell (56, 32) is on a plateau
**9 units above** the base plane, so the fire was drawn 9 units inside the
hill. The effect service reported the spawns; **no pixels reached the
screen**.

**Mitigation implemented.** Every effect now asks the WORLD domain for the
ground it sits on (`wld.heightAt(cx, cz)`), in both the hazard domain and the
integrator's visual-feedback bridge. Measured before and after: the hazard's
particles moved from world y 0.82–1.27 to y 10.02–13.13, and the ember,
flame and smoke pixels are now captured on the plateau.

**Regression protection.** Seven tests cover it (five in
`tests/integration.test.mjs`, two in `src/hazards/hazards.test.mjs`), and
they were **mutation-tested**: reverting the height makes them fail.

---

### R-20 — The performance counter under-reports the frame

| Field | Value |
|---|---|
| **Category** | Rendering / diagnostics |
| **Likelihood** | High (it happened) |
| **Impact** | Medium (the adaptive driver and the HUD are told the wrong thing) |
| **Severity** | Medium |
| **Status** | **CLOSED** |
| **Owner** | Integrator |

**Description.** Three.js resets `renderer.info` **after** the shadow-map
pass, so the default counter describes the main scene pass only. With the
post chain on it described the fullscreen retro pass alone — the acceptance
harness caught this as `1 draw calls, 1 triangles` for a scene with 573
meshes. The counter feeds the adaptive-quality driver, so the game was
deciding it could afford more quality than the frame actually allowed.

**Mitigation implemented.** `renderer.info.autoReset = false`, with
`renderer.info.reset()` at the top of `update()` and the monitor and the
adaptive driver moved **after** the draw, so they sample the frame that was
just rendered. The boot scene now reports 63 draw calls — 34 for the main
pass plus 29 for the shadow pass.

---

### R-21 — The roster costs memory and download size

| Field | Value |
|---|---|
| **Category** | Performance / assets |
| **Likelihood** | Certain (it happened) |
| **Impact** | Medium |
| **Severity** | Medium |
| **Status** | **ACCEPTED** |
| **Owner** | Integrator |

**Description.** The V5 population work expanded the cast from 6 characters
to 20. That adds roughly 16.5 MB of character models to the download and is
the dominant contributor to the **+23.6 MB** of boot heap (109.51 MB → 133.07
MB) and the +54.6 MB in the populated city (86.55 MB → 141.19 MB).

**Why it is accepted.** The same work is what produced the frame-time
improvement in the populated city: mean frame time 23.445 ms → 18.167 ms and
the worst frame 83.3 ms → 35.1 ms against the V4 baseline. A city builder
with one repeated pedestrian also looks empty. The cost is measured and
published rather than hidden.

**Mitigation available if it ever matters.** The roster is a manifest-driven
list (`src/data/manifest.json`); the characters could be fetched on demand
per district instead of all at boot. That is not implemented.

---

## 3. Risk summary

| ID | Risk | Severity | Status |
|---|---|---|---|
| R-01 | 2D art licence exposure | Critical | ACCEPTED (quarantined) |
| R-02 | Apple Silicon never validated | Medium | OPEN |
| R-03 | Cursor review not run | High | **OPEN** |
| R-04 | Two clocks | High | CLOSED |
| R-05 | Frame-rate-dependent simulation | High | CLOSED |
| R-06 | Save format break | High | MITIGATED |
| R-07 | Concurrent edits to six files | High | CLOSED |
| R-08 | Wrong-worktree write | Medium | CLOSED |
| R-09 | Save size | Low | ACCEPTED (deferred) |
| R-10 | Controller navigation partial | Medium | PARTIAL |
| R-11 | Non-Chromium / Windows / Linux untested | Medium | OPEN |
| R-12 | No native executable | High | ACCEPTED (out of scope) |
| R-13 | 2D art unusable | Medium | ACCEPTED |
| R-14 | TUNING discipline breach | Low | CLOSED |
| R-15 | `three` in a pure module | Medium | MITIGATED |
| R-16 | No audio assets | Medium | ACCEPTED |
| R-17 | No LLM dialogue | Low | ACCEPTED (out of scope) |
| R-18 | Hazard outside the playfield | Low | MITIGATED |
| R-19 | Effect placed underground | High | CLOSED |
| R-20 | Performance counter under-reports | Medium | CLOSED |
| R-21 | Roster costs memory and download size | Medium | ACCEPTED |

**Counts:** 3 OPEN, 1 PARTIAL, 5 ACCEPTED, 2 MITIGATED, 10 CLOSED.

The three OPEN risks (R-02, R-03, R-11) are all blocked by the *environment*
rather than by the code: no ARM machine, no Cursor quota, no second browser or
operating system. They are stated as open rather than closed because closing
them would be a false claim.
