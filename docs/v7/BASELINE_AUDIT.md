# SuperCitycon V7 — Baseline Audit

**Baseline audited:** V6 at `ecc30fc4c25ebb3b0cb9dd2b1a261dee3df99c7d`
**Audited in:** `/Users/mac/Documents/SuperCitycon-V7` (the fresh V7 worktree)
**Host:** Darwin x86_64, node v22.14.0, npm 10.9.2

The audit ran BEFORE any V7 change. Nothing in the V7 worktree was modified
until the baseline was measured and recorded here.

---

## 1. The project

| | |
|---|---|
| Engine | Three.js 0.169.0 |
| Language | JavaScript (ES modules), no TypeScript |
| Bundler | Vite 7.3.7 |
| Test runner | `node --test` (the Node built-in) |
| Runtime dependencies | `three` only |
| Targets | Web — Chromium verified |
| Save schema | version 2 |
| Domains | wld · buildings · economy · mobility · population · services · studio · ui · content · hazards |
| Entry point | `game/src/main.js` |
| Contract | `game/src/core/CONTRACT.md` (binding) |

## 2. The baseline checks

| Check | Command | Result |
|---|---|---|
| Install | `npm ci` | 0 vulnerabilities |
| Unit suite | `npm test` | **770 tests, 770 pass, 0 fail, 0 skipped** (9 suites) |
| Syntax | `npm run check` | **85/85 source files parse cleanly** |
| Content | `node tools/validate-content.mjs` | 3 levels — 0 errors, 0 warnings, **3 notes** |
| GPU tooling | `node --test ../tools/performance-gpu.test.mjs` | 5 tests, 5 pass |
| Dependencies | `npm audit` | **0 vulnerabilities** |
| Cleared build | `npm run build:cleared` | 218 files, 72.7 MB, licence policy **CLEARED** |
| Browser acceptance | `npm run verify:production -- --profile cleared` | 40/41 passed, 1 skipped — **PRODUCTION BUILD VERIFIED** |
| Gamepad acceptance | `node tools/scenario-gamepad.mjs` | 19/19 checks passed |
| Frame time | `node tools/profile-gpu.mjs` | mean 16.667 ms, p95 18.6 ms, 60 fps, 0 errors |
| Secret scan | (not present in V6) | — |

## 3. The feature classification

| System | Where | Classification |
|---|---|---|
| Game loop, fixed step | `src/main.js` | VERIFIED WORKING |
| Core state, save / load | `src/core/state.js`, `src/core/save.js` | VERIFIED WORKING |
| Modes, progression, stages | `src/core/modes.js`, `src/core/stage.js` | VERIFIED WORKING |
| Grid, terrain, water | `src/world/` | VERIFIED WORKING |
| Buildings, placement, catalogue | `src/buildings/` | VERIFIED WORKING |
| Economy, budget, resources | `src/economy/` | VERIFIED WORKING |
| Mobility, traffic | `src/mobility/` | VERIFIED WORKING |
| Population, happiness | `src/population/` | VERIFIED WORKING |
| **Citizen navigation** | `src/population/citizens.js` | **PARTIALLY IMPLEMENTED — the defect below** |
| Services, coverage | `src/services/` | VERIFIED WORKING |
| Hazards, crises | `src/hazards/` | VERIFIED WORKING |
| Content, levels | `src/content/` | VERIFIED WORKING |
| **Content validation** | `src/content/validate.js` | **PARTIALLY IMPLEMENTED — the gap below** |
| Renderer, assets, post FX | `src/render/` | VERIFIED WORKING |
| HUD, menus, camera, settings | `src/ui/` | VERIFIED WORKING |
| SCC Studio voxel editor | `src/studio/` | VERIFIED WORKING (undo / redo already present) |
| Keyboard input | `src/ui/camera.js`, `src/core/input-map.js` | VERIFIED WORKING, with one defect |
| Gamepad input | `src/core/gamepad.js`, `src/ui/gamepad.js` | VERIFIED WORKING (simulated pad only) |
| **Touch input** | — | **NOT PRESENT** |
| Audio | `src/audio/` | VERIFIED WORKING (fully synthesised) |
| **Citizen AI / pathfinding** | `src/population/citizens.js` | **PARTIALLY IMPLEMENTED — scripted movement, not navigation** |

## 4. The defects the audit confirmed

### BUG-01 — the citizens do not navigate

`population/citizens.js` `buildPath(from, to)` returned three points: the
start, the midpoint plus a seeded random offset, and the destination. The
path had no knowledge of the terrain, the water or the buildings, so a
citizen walked in a straight line through a warehouse and, on `high-water`,
through the flood.

### BUG-02 — a held key keeps panning the camera under the menu

`ui/camera.js` `onKeyDown()` returns early when the menu is open, so a new
key is not added — but the held-key **set** is never cleared. A key held as
the menu opened therefore kept panning the camera behind the menu.

### GAP-01 — no touch input

Nothing in the tree handled a touch. The canvas listened to pointer events,
so a finger produced a mouse click and nothing else: no drag-pan, no
pinch-zoom, and no way to move the city on a phone.

### GAP-02 — the content validator cannot prove its own levels

`content/validate.js` emitted, for every level:

> INFO level.not-checked: Reachability beyond the declared progression links
> is not proven by this validator; it cannot tell whether the terrain allows
> a route to the exit.

Honest, and correct — but it means **no automated check in the project knew
whether a level could be completed.**

## 5. The technical debt carried into V7

| id | Debt | V7 treatment |
|---|---|---|
| D-05 | The save file is dominated by JSON-encoded terrain arrays | **Carried** — the schema stays at version 2 so no city is stranded |
| D-06 | The 2D HUD art licence is unresolved | **Carried** — it does not ship |
| D-07 | No Windows / Linux / non-Chromium / ARM verification | **Carried** — recorded honestly |
| D-08 | The gamepad was verified against a SIMULATED pad only | **Carried** |
| D-09 | No secret scan in the toolchain | **Fixed in V7** — `tools/secret-scan.mjs` |
