# SuperCitycon V7 — Test Results

**Run at:** the V7 commit, on Darwin x86_64, node v22.14.0, npm 10.9.2.
**Every result below was produced by the command named beside it.**

---

## 1. The summary

| Check | Command | Result | Status |
|---|---|---|---|
| The unit suite | `npm test` | **898 tests, 898 pass, 0 fail, 0 skipped** (9 suites) | **PASS** |
| The syntax check | `npm run check` | **94/94 source files parse cleanly** | **PASS** |
| The content validator | `node tools/validate-content.mjs` | 3 levels — **0 errors, 0 warnings**, 3 notes | **PASS** |
| The GPU tooling | `node --test ../tools/performance-gpu.test.mjs` | 5 tests, 5 pass | **PASS** |
| The dependency audit | `npm audit` | **0 vulnerabilities** | **PASS** |
| The cleared build | `npm run build:cleared` | 218 files, 72.7 MB, licence policy **CLEARED** | **PASS** |
| The V5 acceptance scenario | `node tools/scenario.mjs` | **40/41 passed, 1 skipped** | **PASS** |
| The V5 acceptance, against the LIVE site | `node tools/scenario.mjs https://atiffhussainkhan.github.io/...` | **40/41 passed, 1 skipped** | **PASS** |
| The V7 scenario, against the LIVE site | `node tools/scenario-v7.mjs https://atiffhussainkhan.github.io/...` | **14/14 passed** | **PASS** |
| The V6 gamepad scenario | `node tools/scenario-gamepad.mjs` | **19/19 passed** | **PASS** |
| The V7 scenario | `node tools/scenario-v7.mjs` | **14/14 passed** | **PASS** |
| The device scenario | `node tools/scenario-devices.mjs` | **32/32 passed** | **PASS** |
| The compatibility audit | `node tools/compat-audit.mjs` | **43/43 passed** | **PASS** |
| The production verification | `npm run verify:production -- --profile cleared` | **PRODUCTION BUILD VERIFIED** | **PASS** |
| The navigation benchmark | `node tools/profile-navigation.mjs` | p95 **1.350 ms** against a 2 ms budget | **PASS** |
| The secret scan | `node tools/secret-scan.mjs` | 274 files, **0 findings** | **PASS** |
| The GPU profile | `node tools/profile-gpu.mjs` | mean 16.666 ms, p95 18.4 ms, 60 fps, 0 errors | **PASS** |

**NOT RUN / NOT APPLICABLE**

| Check | Why |
|---|---|
| A Windows build | No Windows toolchain in this environment — `PLATFORM_COMPATIBILITY.md` |
| An ARM64 build | The host is x86_64 — `PLATFORM_COMPATIBILITY.md` |
| A Firefox / Safari run | Only Chromium is installed — `PLATFORM_COMPATIBILITY.md` |
| A physical gamepad | No controller is attached — `KNOWN_ISSUES.md` |
| A physical touch device | No touch hardware is attached; the touch path is proven with synthetic touch events through the DevTools protocol — `KNOWN_ISSUES.md` |

## 2. The unit suite, in detail

```
$ cd game && npm test
# tests 898
# suites 9
# pass 898
# fail 0
# cancelled 0
# skipped 0
```

**The V6 baseline was 770 tests.** V7 added **128**:

| File | Added | What it proves |
|---|---|---|
| `src/core/navigation.test.mjs` | 26 | the pathfinder, the obstacle model, the determinism, the budget, the smoothing, the performance |
| `src/core/touch.test.mjs` | 18 | the gesture recogniser, the frame-rate independence, the malformed input |
| `src/ui/touch.test.mjs` | 13 | the touch service, the pinch deltas, the mouse exclusion |
| `src/content/content.test.mjs` | 4 | the reachability proof, the unreachable target, the determinism |
| `src/population/citizens.test.mjs` | 3 | the citizens walking around a building and around the flood |
| `src/ui/ui.test.mjs` | 2 | the held key under the menu |
| **The V7.1 round** | | |
| `src/core/input-map.test.mjs` | 16 | the pad binding table, `padLabel()`, `padRebind()` |
| `src/ui/navigation-debug.test.mjs` | 18 | the debug panel's model, the reasons and the service |
| `src/ui/touch.test.mjs` (+4) | 4 | the touch hover, the event-time rule, the tap-once rule |
| `src/core/touch.test.mjs` (+4) | 4 | the multi-touch guard and the flag's scope |
| `src/population/citizens.test.mjs` (+3) | 3 | the per-frame path-search budget |
| `src/ui/settings-panel.test.mjs` (+11) | 11 | the gamepad rebinding capture |
| `src/ui/navigation-debug.test.mjs` (the overlay) | — | the route model, the projection, the service |

## 3. The browser scenarios, in detail

### The V5 acceptance scenario — 40/41, 1 skipped

The one skip is the same one the V5 baseline has: the 2D HUD art is not
published, so there is no art manifest to resolve. The uncleared art does
not ship and the HUD is complete without it.

### The V6 gamepad scenario — 19/19

Unchanged from V6, and it still passes against the V7 build: the D-pad moves
the focus, the ring is visible, A confirms, B goes back, a held CONFIRM
confirms once, the camera pans with the stick, a resting stick drifts
2.6e-53 units, the camera does not move under the menu, and an unplugged pad
is released and reconnects cleanly.

### The V7 scenario — 10/10

| Check | Result |
|---|---|
| the touch service is installed | PASS |
| a one-finger drag pans the camera | PASS — the camera moved 31.68 units |
| a two-finger pinch zooms the camera | PASS — the distance went 66 → 33.00 |
| a two-finger drag rotates the camera | PASS — the yaw went 0.785 → 1.460 |
| a drag never selects a cell | PASS — 0 clicks reached the domains |
| a tap selects the cell under the finger | PASS — 1 click, cell (43, 43) |
| the mouse still selects a cell | PASS — 1 click |
| a city of buildings does not break the citizens | PASS — 56 buildings placed, the citizen spawned |
| no uncaught page errors | PASS |
| no console errors | PASS |

## 4. The defects the checks caught during V7

These were found by the checks, not by reading the code.

| Defect | Found by | Fix |
|---|---|---|
| The city grid ignored the context's grid size, so every obstacle lookup was wrong | `navigation.test.mjs` — "deep water blocks a cell" | `createCityGrid` now reads `ctx.config.GRID.size` |
| A pinch was applied **cumulatively**: the zoom was multiplied once per move event, and the rotation was applied in full every time | `scenario-v7.mjs` — the distance went 66 → 22 instead of 66 → 33 | the pinch now carries a phase, and the service applies the CHANGE since the last event |
| A touch tap selected the cell **twice** — once from the touch service and once from the pointer handler | `scenario-v7.mjs` — "a tap selects the cell" saw two clicks | the integrator's pointer handler now ignores touch pointers; one owner per device |
| The camera's held-key set was never cleared when the menu opened | `ui.test.mjs` — proven to fail on the V6 baseline | `keys.clear()` when the menu has the focus |

## 5. The evidence

| Where | What |
|---|---|
| `/Users/mac/Documents/SuperCitycon-V7-runs/evidence/baseline-production/` | the V6 baseline's production verification |
| `/Users/mac/Documents/SuperCitycon-V7-runs/evidence/v5-regression/` | the V5 scenario against the V7 build |
| `/Users/mac/Documents/SuperCitycon-V7-runs/evidence/gamepad-regression/` | the V6 gamepad scenario against the V7 build |
| `/Users/mac/Documents/SuperCitycon-V7-runs/evidence/v7-scenario/` | the V7 scenario: `v7.json` and `v7-city.png` |
| `/Users/mac/Documents/SuperCitycon-V7-runs/evidence/perf-v6/`, `perf-v7/` | the GPU profiles, before and after |
