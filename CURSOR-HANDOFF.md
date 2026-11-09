# Cursor Senior Review — SuperCitycon V5

**Status: AWAITING CURSOR REVIEW**

The Cursor review could not be run in this environment. `cursor agent` was
invoked **four** times across **three** different models and every attempt
returned:

```
You're out of usage. Switch to Auto, or ask your admin to increase your limit to continue.
```

This document carries everything a reviewer needs. It is not a substitute for
the review — it is the brief for it.

---

## 1. The request

Review the SuperCitycon **V4 → V5** upgrade as a senior developer and analyst.
Look for **real defects**, not style preferences.

Priority order:

1. **Correctness** — does it do what it claims, and does the claim hold?
2. **Regression risk** — did the upgrade break V4 behaviour?
3. **Architecture** — does the design hold together, and are the boundaries real?
4. **Performance** — are the pools and the fixed step actually helping?
5. **Honesty** — does anything in the docs, the code comments or the UI
   overstate what was delivered?

**Explicitly in scope:** the new core modules, the hazard domain, the content
domain, the VFX service, the changes to `main.js`, `core/save.js`,
`core/config.js`, `core/state.js`, `buildings/index.js` and `economy/index.js`.

**Explicitly out of scope:** the art pipeline, the 2D licence quarantine (a
publisher decision), and the platformer-genre mapping (a stated and
documented assumption — see `docs/V5_UPGRADE_PLAN.md` §1).

---

## 2. Where the work is

| | |
|---|---|
| **Repository** | `/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/v5-worktree` |
| **Branch** | `v5/upgrade` |
| **Base commit** | `92c0b37` (`main`) — the V4 baseline |
| **Game** | `game/` |
| **Working tree** | **uncommitted** — the whole V5 change is working-tree only, so `git diff` and `git status` show it all |

```bash
cd /Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/v5-worktree
git status --short
git diff            # tracked changes
```

`main` and production are **untouched**. Do not push, merge or deploy.

---

## 3. Acceptance criteria

The reviewer should hold the work to these, and say which are met.

### Functional

- [ ] A V4 save loads into the V5 build and migrates; a save from a *newer*
      version is refused rather than guessed at.
- [ ] The day counter increments **once** per day boundary, and `DAY_CHANGED`
      fires **once**.
- [ ] The simulation is frame-rate independent: the same game-time input
      produces the same result at any frame rate.
- [ ] `dispose()` releases the animation frame, the stage timer, every
      domain, the audio mixer, the event bus and the settings store — and is
      safe to call twice.
- [ ] A level loads into the live city completely (0 skipped spawns), and the
      starting city is **not** charged to the treasury and **not** counted
      against the player's construction slots.
- [ ] A hazard escalates through its phase ladder, telegraphs before each
      phase, applies damage, is mitigated by the city's service coverage, and
      resolves.
- [ ] The content validator detects each of its eight classes of defect.
- [ ] The VFX effects spawn from real gameplay events, and the effect pool
      does not grow without bound.
- [ ] The audio mixer plays on the mapped events.
- [ ] Every one of the 395 V4 tests still passes.

### Honest

- [ ] Nothing in the docs, the code comments or the UI claims a feature that
      is not implemented.
- [ ] Every unverified limitation (ARM, non-Chromium, no native build, no
      audio assets, no music/voice, partial gamepad) is stated, not implied.
- [ ] No `// TBD:`-marked number is actually load-bearing in a way the
      documents do not disclose.

### Safety

- [ ] No credential, token or key anywhere in the tree.
- [ ] The cleared build still fails if any unverified 2D file survives.
- [ ] The six files owned by another process are untouched.

---

## 4. Changed files and why

### New — `game/src/core/`

| File | Why |
|---|---|
| `log.js` | Structured logging: severity, category, context, ring buffer, global handlers, build identity. |
| `settings.js` | Validated, persisted user settings (audio / display / accessibility / input). Deliberately **outside** the save format. |
| `input-map.js` | One key-binding table: `matches`, `rebind`, `resetAll`, `keyLabel`. |
| `progress.js` | Checkpoints / collectibles / achievements in `state.meta.progress`. |

### New — `game/src/content/`

| File | Why |
|---|---|
| `levels.js` | The shipped level library and the lookup helpers (pure). |
| `validate.js` | The content validator (pure). |
| `index.js` | The service: applies a level to the live city. |

### New — `game/src/render/`

| File | Why |
|---|---|
| `fx-plan.js` | The pure effect plan — no `three`, unit-testable. |
| `fx.js` | The pooled, instanced effect service. |
| `fx-plan.test.mjs`, `fx.test.mjs` | 25 tests. |

### New — `game/src/hazards/`

The multi-phase hazard / crisis domain (the city-builder "boss encounter").

### Modified

| File | Change |
|---|---|
| `game/src/core/events.js` | Added 13 event constants for V5. |
| `game/src/core/config.js` | Added `dayStartFraction`, `skyRepaintStep`, `fixedStep`, `maxCatchUpSteps` + their `TUNING_TBD` entries. |
| `game/src/core/save.js` | `SAVE_VERSION` 1→2, `MIGRATIONS` chain, `migrateRecord()`. |
| `game/src/core/state.js` | `meta.progress` added to the default tree. |
| `game/src/main.js` | Fixed-timestep loop; one clock; the teardown path; the diagnostics surface; the FX feedback bridge; the accessibility bridge; the content domain wiring. |
| `game/src/buildings/index.js` | `place()` gained the `prebuilt` option. |
| `game/src/economy/index.js` | A pre-built building is neither charged nor given a construction slot. |
| `game/src/render/renderer.js` | The `fx` service, created and disposed by the renderer. |
| `game/src/ui/hud.js` | The time presets now seek the clock. |
| `game/vite.config.js` | The build identity is injected into the bundle. |
| `game/package.json` | Version → `5.0.0`. |

### New — docs and tools

`docs/V4_BASELINE_AUDIT.md`, `docs/V5_UPGRADE_PLAN.md`,
`docs/V5_REQUIREMENTS_MATRIX.md`, `docs/V5_RISK_REGISTER.md`,
`docs/V5_SYSTEM_ARCHITECTURE.md`, `docs/V5_KNOWN_ISSUES.md`,
`docs/V5_RELEASE_NOTES.md`, `docs/V5_TEST_REPORT.md`,
`docs/V5_PERFORMANCE_REPORT.md`, `docs/V5_FINAL_VERIFICATION.md`,
`CHANGELOG.md`, `game/tools/validate-content.mjs`, `tools/profile-gpu.mjs`.

---

## 5. Tests that were run, with their actual output

The reviewer should re-run these rather than trust the transcript.

```bash
cd /Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/v5-worktree/game
npm test        # 503 tests, 503 pass, 0 fail
npm run check   # every source file parses
npm run build:cleared
node tools/validate-content.mjs
```

The browser acceptance harness (needs a preview server on 4188):

```bash
node tools/scenario.mjs http://127.0.0.1:4188/ /tmp/sc-v5 v5
```

The real-GPU profiler (needs a build; launches a real browser window):

```bash
node tools/profile-gpu.mjs --frames 300
```

---

## 6. Measurements already taken

For context, not as a substitute for the review.

| Measure | Value | Machine |
|---|---|---|
| Frame time, mean | 16.612 ms (60.2 fps) | Intel i9-9980HK, AMD Radeon Pro 5500M |
| Frame time, p95 | 18.6 ms | as above |
| Boot to ready | 2 261 ms | as above |
| Draw calls | 34 | as above |
| Triangles | 864 055 | as above |
| JS heap used | 112.06 MB | as above |
| Acceptance harness | 40/41 pass, 1 skipped | headless Chromium |
| Save size | ~46.6 KB empty / ~99.1 KB populated | — |

The renderer was classified as **hardware** from the actual WebGL context
(`ANGLE (AMD, ANGLE Metal Renderer: AMD Radeon Pro 5500M)`), not from the
launch mode.

---

## 7. Known issues the reviewer should focus on

These are open. The reviewer should say whether any of them is actually worse
than described.

1. **Gamepad navigation is partial** — the API is read and the bindings are
   routed, but analogue-stick camera and pad menu navigation are not
   implemented. `docs/V5_KNOWN_ISSUES.md` KI-05.
2. **Hazard reachability is not proven** — the content validator proves
   internal consistency, not that a route exists through the generated
   terrain. It says so on every level. KI-11.
3. **Level difficulty is a design placeholder** — the phase durations and
   damage rates are `TBD:`-marked and unpublished. KI-12.
4. **Save size is dominated by JSON terrain arrays** — base64 encoding was
   deliberately deferred because the save uses under 2 % of the quota. R-09.
5. **The `prebuilt` path bypasses the placement gate** — deliberate, but the
   reviewer should check that it cannot be reached by a player action.
6. **The content domain reaches for `buildings.place.__scRawPlace`** — a
   private escape hatch on the gated function. It works, but it is a coupling
   the reviewer should judge.
7. **The hazard domain creates `state.hazards` at construction time** — it may
   not edit `core/state.js`, so the subtree is created defensively rather
   than declared in the default tree.
8. **Three worker domains wrote in parallel** — the population, UI and hazard
   domains were implemented by separate agents against the same contract. The
   reviewer should look hard at the seams between them.

---

## 8. What the reviewer should return

1. **Defects**, each with: the file and line, what breaks, how it breaks, and
   a concrete failing case.
2. **A verdict on each acceptance criterion** above — met, partially met, or
   not met, with the evidence.
3. **Anything the documents overstate.** This is the highest-value finding:
   the V5 work is explicitly evidence-bound, so an overstatement is a
   correctness bug in the documentation.
4. **Anything that would break V4.** The 395 V4 tests must still pass, but a
   passing suite does not prove the *behaviour* is unchanged.
5. **Anything that should be a release blocker.**

---

## 9. The one-line summary

> SuperCitycon V5 is a major-version upgrade of a 3D city builder: one clock,
> a fixed-timestep simulation, a versioned save with a migration chain,
> structured logging, a settings store, one binding table, a real teardown
> path, a pooled VFX service wired to the game's own events, an audio mixer
> that is finally connected, a multi-phase hazard system, and a level-content
> pipeline with a validator and three original levels.
> 503 tests pass. The cleared build passes the browser harness 40/41 with the
> 2D-art check correctly skipped. It is honest about what it does not do:
> no character combat, no native build, no ARM test, no audio assets, no
> music or voice, and a partial gamepad.
