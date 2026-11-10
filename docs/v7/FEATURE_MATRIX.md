# SuperCitycon V7 — Feature Matrix

**Target version:** 7.0.0
**Baseline:** V6 at `ecc30fc4c25ebb3b0cb9dd2b1a261dee3df99c7d`
**Branch:** `development/v7`

This is the authoritative traceability matrix. Every V7 requirement maps to a
design component, an implementation, a test and a verification result. No
requirement is silently omitted, and nothing is counted as implemented that
is not.

**Status vocabulary**

| Status | Meaning |
|---|---|
| COMPLETE | implemented, tested, and verified |
| PARTIAL | implemented, but something in the requirement is not covered |
| NOT STARTED | not implemented — and not claimed to be |

---

## 1. The functional requirements

| ID | Feature | Requirement | Design | Implementation | Test | Status | Result |
|---|---|---|---|---|---|---|---|
| **V7-FR-001** | Grid A* pathfinder | `REQUIREMENTS.md` F | `ARCHITECTURE.md` §3.2 | `game/src/core/navigation.js` | `core/navigation.test.mjs` (26 tests) | **COMPLETE** | PASS |
| **V7-FR-002** | Deterministic search | F | §3.2 | `core/navigation.js` — fixed neighbour order, total order over the open set | `navigation.test.mjs` — "the search is DETERMINISTIC", "the same world always gives the same path" | **COMPLETE** | PASS |
| **V7-FR-003** | Node budget | F | §3.2 | `core/navigation.js` — `NAV_BUDGET`, the `budget` reason | `navigation.test.mjs` — "the search stops at its budget" | **COMPLETE** | PASS |
| **V7-FR-004** | The live obstacle model | F | §3.1, §3.2 | `core/navigation.js` — `createCityGrid()` | `navigation.test.mjs` — the building / water / slope cases | **COMPLETE** | PASS |
| **V7-FR-005** | The citizens walk the route | F | §4 | `population/citizens.js` — `buildPath()` | `population/citizens.test.mjs` — "a citizen walks AROUND a building", "a citizen walks AROUND the flood" | **COMPLETE** | PASS |
| **V7-FR-006** | Path smoothing | F | §3.2 | `core/navigation.js` — `smoothPath()`, `lineIsClear()` | `navigation.test.mjs` — the smoothing cases | **COMPLETE** | PASS |
| **V7-FR-007** | The debug mode | F | §3.2 | `core/navigation.js` — `findPath()` returns `{ path, cost, visited, reason }` | `navigation.test.mjs` — the `visited` and `reason` assertions | **COMPLETE** | PASS |
| **V7-FR-008** | The gesture recogniser | F | §3.3 | `game/src/core/touch.js` | `core/touch.test.mjs` (18 tests) | **COMPLETE** | PASS |
| **V7-FR-009** | Frame-rate independence | F | §3.3 | `core/touch.js` — millisecond and pixel thresholds | `touch.test.mjs` — "the gesture is the SAME at 30 Hz and at 144 Hz" | **COMPLETE** | PASS |
| **V7-FR-010** | The touch camera | F | §3.3 | `game/src/ui/touch.js` | `ui/touch.test.mjs` (13 tests) + `tools/scenario-v7.mjs` | **COMPLETE** | PASS |
| **V7-FR-011** | The touch selection | F | §3.3 | `ui/touch.js` — `ctx.dispatchWorldClick()` | `ui/touch.test.mjs` — "a tap selects the cell"; `scenario-v7.mjs` | **COMPLETE** | PASS |
| **V7-FR-012** | 44 × 44 touch targets | F | §3.3 | `game/src/ui/styles.js` — `.sc-hud .sc-btn`, `.sc-menu-btn` | `scenario-v7.mjs` — the narrow-viewport run | **COMPLETE** (already true in the baseline) | PASS |
| **V7-FR-013** | The responsive layout and the safe areas | F | §3.3 | `ui/styles.js` — `env(safe-area-inset-*)` and the `@media (max-width: 520px)` block | `scenario-v7.mjs` — the narrow viewport | **COMPLETE** | PASS |
| **V7-FR-014** | The reachability proof | F | §3.5 | `game/src/content/validate.js` — `proveReachability()` | `content/content.test.mjs` — the reachability cases; `node tools/validate-content.mjs` | **COMPLETE** | PASS — 3/3, 5/5 and 7/7 targets proven |
| **V7-FR-015** | A deterministic, bounded proof | F | §3.5 | `content/validate.js` — the same pathfinder, the same budget | `content.test.mjs` — "the reachability proof is deterministic" | **COMPLETE** | PASS |
| **V7-FR-016** | The camera stops under a modal | F | §2.4 | `game/src/ui/camera.js` — `keys.clear()` | `ui/ui.test.mjs` — "a held movement key does not pan the camera while the menu is open" | **COMPLETE** | PASS — and the test FAILS on the V6 baseline |
| **V7-FR-017** | The save schema stays at 2 | F | §5 | `game/src/core/save.js` — unchanged | `core/save-compat.test.mjs` — unchanged, 11 tests | **COMPLETE** | PASS |

---

## 2. The non-functional requirements

| ID | Requirement | Implementation | Verification | Status | Result |
|---|---|---|---|---|---|
| **V7-NFR-001** | A search under 2 ms | `core/navigation.js` | `tools/profile-navigation.mjs` — median 0.202 ms, p95 1.350 ms | **COMPLETE** | PASS |
| **V7-NFR-002** | A bounded search | `core/navigation.js` — the visited set is capped | `navigation.test.mjs` — "the search stops at its budget" | **COMPLETE** | PASS |
| **V7-NFR-003** | The frame rate must not regress | the path search runs once per spawn, not per frame | `docs/v7/PERFORMANCE_REPORT.md` | **COMPLETE** | PASS |
| **V7-NFR-004** | No new runtime dependency | `game/package.json` — `three` only | `npm audit` — 0 vulnerabilities | **COMPLETE** | PASS |
| **V7-NFR-005** | The rules are pure | `core/navigation.js`, `core/touch.js` — no `three`, no DOM | `npm run check`; the modules import only `core/config.js` | **COMPLETE** | PASS |
| **V7-NFR-006** | The cleared build stays clean | `game/vite.config.js` — unchanged | `npm run build:cleared` — 218 files, CLEARED | **COMPLETE** | PASS |

---

## 3. The other requirement groups

| ID | Requirement | Status | Result |
|---|---|---|---|
| **V7-UI-001** | A touch has visible feedback | COMPLETE | The hover cell follows the finger (the pointer-move path) |
| **V7-UI-002** | An unrecognised gesture does not act | COMPLETE | `scenario-v7.mjs` — "a drag never selects a cell" |
| **V7-UI-003** | The browser must not steal the gesture | COMPLETE (already true in the baseline) | `touch-action: none` was already on `html, body` |
| **V7-UI-004** | The HUD is readable at 390 px | COMPLETE | The narrow-viewport CSS block |
| **V7-ENG-001** … **V7-ENG-004** | The engine rules | COMPLETE | `ARCHITECTURE.md` §3 |
| **V7-AST-001** … **V7-AST-003** | The assets | COMPLETE | V7 adds no art |
| **V7-ANI-001** … **V7-ANI-003** | The animation | COMPLETE | The facing follows the path (the rig already set `rotation.y` from the segment) |
| **V7-AI-001** … **V7-AI-004** | The AI | COMPLETE | Grid A* — not a behaviour tree, and not described as one |
| **V7-PERF-001** … **V7-PERF-003** | The performance | COMPLETE | `docs/v7/PERFORMANCE_REPORT.md` |
| **V7-SEC-001** … **V7-SEC-004** | The security | COMPLETE | `docs/v7/SECURITY_REVIEW.md` |
| **V7-CMP-001** … **V7-CMP-004** | The compatibility | COMPLETE | `docs/v7/PLATFORM_COMPATIBILITY.md` |
| **V7-REL-001** … **V7-REL-003** | The reliability | COMPLETE | `core/touch.test.mjs` — the malformed input; the fallback path in `citizens.js` |
| **V7-BLD-001** … **V7-BLD-004** | The build | COMPLETE | 7.0.0 in the package, the lockfile and the build identity |
| **V7-TEST-001** … **V7-TEST-007** | The testing | COMPLETE | `docs/v7/TEST_RESULTS.md` |
| **V7-DEP-001** … **V7-DEP-003** | The deployment | COMPLETE | The cleared bundle; nothing published |

---

## 4. The requirements that were deliberately NOT done

| Item | Why | Where it is recorded |
|---|---|---|
| The studio editor's undo / redo | **It already exists.** The audit found `createHistory()` in `studio/voxels.js` and `undo()` / `redo()` in `studio/index.js`. Re-implementing it would have been a fake feature. | `ARCHITECTURE.md` §2.5 |
| A mobile native build | The project is a web build. A native package cannot be produced or verified in this environment, and a native wrapper would be an unverified claim. | `PLATFORM_COMPATIBILITY.md` |
| Gamepad rebinding in the UI | The machinery is in place (`applyPadOverrides`, and the service reads the table every frame); the capture screen is not. It was not in the V7 scope. | `KNOWN_ISSUES.md` |
| A smaller save file | The save format is unchanged on purpose: a V5 or V6 city must open in V7. | `KNOWN_ISSUES.md` |

---

## 5. The test coverage of the V7 work

| File | Tests | What it covers |
|---|---|---|
| `game/src/core/navigation.test.mjs` | 26 | the pathfinder, the obstacle model, the determinism, the budget, the smoothing, the performance |
| `game/src/core/touch.test.mjs` | 18 | the gesture recogniser, the frame-rate independence, the malformed input |
| `game/src/ui/touch.test.mjs` | 13 | the touch service: the camera, the selection, the mouse exclusion, the pinch deltas |
| `game/src/content/content.test.mjs` | +4 | the reachability proof, the unreachable target, the determinism |
| `game/src/population/citizens.test.mjs` | +3 | the citizens walking around a building and around the flood |
| `game/src/ui/ui.test.mjs` | +2 | the held key under the menu |
| **The V7 total** | **+66** | **770 (the V6 baseline) → 835** |

And in the browser: `tools/scenario-v7.mjs` — **10/10 checks passed** against
the cleared V7 build.
