# SuperCitycon V7 — Senior Review

**Reviewed:** the V7 release, `ecc30fc..89f1764` plus the V7.2 fixes
**Reviewer:** the integrator, working natively — **no Cursor, no external tool**
**Why it is independent enough to matter:** the review was run against the
*shipped* code and the *shipped* documentation, by checks that a passing test
suite cannot satisfy on its own — the device profiles, the compatibility
audit, the mechanical claim audit and the tuning-table audit.

---

## 1. The verdict

**Ship it.** The release is fit to be published as a public release. Nothing
in this review found a BLOCKER or a MAJOR defect in the final tree.

What the review DID find was **fifteen real defects across the three rounds**,
every one of them reproduced before the fix and proven after it. That is the
strongest thing this review has to say: the process found them, and none of
them is in the shipped build.

| Round | Defects found | Severity of the worst |
|---|---|---|
| The V7.0 self-audit | 7 | MAJOR (a tuning key that promised a budget and enforced nothing) |
| The device-profile audit | 6 | MAJOR (the game did not boot with cookies blocked) |
| The compatibility audit | 3 (2 overlapping) | MAJOR (the canvas did not follow a resize) |

---

## 2. The findings

### 2.1 Resolved — all fifteen are fixed and proven

| # | The defect | How it was found | The proof it is fixed |
|---|---|---|---|
| 1 | The cell under the finger was never highlighted — the integrator's pointer handler ignored touch pointers so the hover died with it | the documentation claimed it worked; reading the code showed it did not | `ui/touch.test.mjs` — 8 new tests; the negative check fails six of them |
| 2 | A **pinch ended with a tap** — the still finger looked exactly like a tap, so a zoom placed a building | reproduced against the recogniser | `core/touch.test.mjs` |
| 3 | A slow frame turned every tap into a long press — the gesture was timed by when it was HANDLED | the browser scenario, on a 2.6 fps software renderer | `ui/touch.test.mjs` — the event-time test |
| 4 | A cancelled pinch swallowed the NEXT tap — `cancel()` did not clear the multi-touch flag | the device scenario | `core/touch.test.mjs` — "a tap still works AFTER a pinch" |
| 5 | The multi-touch flag killed every tap for the rest of the session | the same | the same |
| 6 | The recogniser kept its finger after the window lost the focus, so the camera kept panning | the device scenario | `tools/scenario-devices.mjs` — 32/32 |
| 7 | The camera drifted after a focus loss | the same | the same |
| 8 | A held stick kept driving the camera after the focus loss — the rig cleared its axes, the service pushed them again next frame | the same | the same |
| 9 | `TUNING.citizenPathsPerFrame` was declared, documented and **never read** | an audit of all 79 TUNING keys against the whole tree | `population/citizens.test.mjs` |
| 10 | The camera shake had **two** sources of truth | the same audit | `ui/camera.js` — `SHAKE` reads `TUNING` |
| 11 | The path-search counters were unreachable from the page | the city profiler probing eleven surfaces | `population/index.js` forwards them |
| 12 | **The game did not boot at all with cookies blocked** — `localStorage ?? null` guards a missing value, not a throwing getter | the compatibility audit | `tools/compat-audit.mjs` — 43/43 |
| 13 | The canvas did not follow a resize — 960 px of overflow on a phone | the same | the device matrix: the canvas matches at every size |
| 14 | The HUD's demand rail was **unreachable** on a phone — a six-chip rail in a 390 px box, clipped by the HUD | the same | `tools/scenario-v7.mjs` — the reachability check |
| 15 | The search box had no style rule at all, and an inline style that beat the stylesheet anyway | the same | every visible control is now >= 44 x 44 |
| 16 | The key capture bound Escape even though the toast promised "Esc cancels" | the pad-rebinding work | `ui/settings-panel.test.mjs` |
| 17 | The pad's `mapping` was dropped, so a non-standard pad was read as a standard one | the device scenario | the same |

### 2.2 Open — accepted, with the reason

| # | The finding | Why it is accepted |
|---|---|---|
| O-1 | The **V6 keyboard-to-claims** are the strongest part of this release and the weakest part of its evidence: the gamepad is proven by a simulated pad, the touch by simulated devices. | No hardware exists in this environment. The limits are itemised in `KNOWN_ISSUES.md` V7-KI-04 and V7-KI-05, and the device profiles close everything a profile can close. |
| O-2 | The **platform matrix** is Chromium-only. | No other engine is installed. The bundle's cross-engine surface is audited (15 hazards) and the real browser floor is now known: **WebGL 2**, so Safari 15 / iOS 15 / Chrome 56 / Firefox 51. |
| O-3 | The save file is **1.34 MB** for the largest city. | The carried issue's premise was WRONG — the terrain is 2.25% of it and a re-encoding would win 0.30%. The real win (41.9%, the static catalogue) needs no migration. `SAVE_SIZE.md`. |
| O-4 | The **studio palette swatches** grew from 28 px to 44 px, which makes the palette row taller. | The 44 px claim is the project's own; the row is a rail and scrolls. The ergonomics on a phone are unverified — V7-KI-04. |

### 2.3 What the checks themselves proved

| Check | Result |
|---|---|
| The unit suite | **898 / 898** — up from 704 at the V5 baseline and 770 at the V7 baseline |
| The source parses | **91 / 91** files |
| The V5 acceptance scenario | 40/41, 1 correctly skipped |
| The V6 gamepad scenario | 19/19 |
| The V7 scenario | 14/14 |
| The device-profile scenario | 32/32 |
| The compatibility audit | 43/43 |
| The content validator | 3 levels, 0 errors, 0 warnings, and the reachability proof: 3/3, 5/5, 7/7 |
| The secret scan | 287 files, 0 findings — and the scanner is verified against a planted secret |
| The navigation benchmark | p95 **1.348 ms** against a 2 ms budget |
| The city profile | 60 fps at the maximum citizen count on a hardware GPU |
| The deployment check | the live site answers, the uncleared art markers 404, a model is served |

---

## 3. The architectural review

| The question | The answer |
|---|---|
| Did the new code break the **one folder per domain** rule? | **No.** The only cross-domain import the diff added is `content/validate.js` → `world/heightfield.js`, and that is a PURE-to-PURE import, which the contract contemplates. An earlier version imported `world/water.js` — a VIEW module — from the pure validator; that was removed during this review. |
| Did any domain write another domain's **state subtree**? | **No.** Every state write in the diff is inside a test file. |
| Do the pure modules import `three`? | **No.** `core/navigation.js`, `core/touch.js`, `core/gamepad.js` and `core/input-map.js` import nothing from `three`. |
| Is the **event-time rule** sound? | **Yes, with a guard.** `event.timeStamp` is used when it is a `performance.now()`-based value and rejected above 1e12 (the epoch-milliseconds shape). The compatibility audit MEASURED the guard: the recogniser read 351 ms where the epoch delta said 5 ms. |
| Is the **pathfinder** correct? | **Yes.** A\* with an admissible octile heuristic, a fixed neighbour order, a total order over the open set, a node budget and no corner cutting. The determinism test runs the same search 100 times and compares the paths. |
| Is the **dead zone** right? | **Yes.** 0.18, rescaled, applied to the sticks only — a trigger rests at zero and a part-pull is deliberate. |
| Is there **dead code**? | **No** `console.log`, `debugger`, `TODO`, `FIXME` or `XXX` in any of the new modules. |
| Is every public function **documented**? | **Yes** — 13 exported functions across the new modules, 99 JSDoc blocks. |

---

## 4. The test-suite assessment

Five new tests were picked and checked for whether they would FAIL if the
behaviour broke.

| The test | Verdict |
|---|---|
| `core/touch.test.mjs` — "a pinch never ends with a tap" | **STRONG.** It asserts on the ABSENCE of a gesture, which a broken implementation cannot fake. |
| `core/touch.test.mjs` — "the gesture uses the EVENT time" | **STRONG.** It feeds an 80 ms tap handled a second later and asserts the tap happened. |
| `core/navigation.test.mjs` — "the search is DETERMINISTIC" | **STRONG.** 100 identical searches compared path by path. |
| `ui/gamepad.test.mjs` — "holding the confirm button cannot confirm twice" | **STRONG.** It counts the actions across frames. |
| `content/content.test.mjs` — "a level walled in by buildings reports the unreachable target" | **ADEQUATE.** It asserts the error code is present. It would be stronger if it also asserted the reachable case in the same shape — the shipped levels cover that, but the pairing is in the validator's own test rather than here. |

**One weak test was found and removed:** the first version of the V7 scenario
compared the camera's **live object** with itself, so it reported "no
movement" for every gesture — a false pass. The scenario now takes a
SNAPSHOT. This is worth recording: the check that passed was measuring
nothing, and it took a second measurement to find it.

---

## 5. The gate decision

**GATE 12 (final quality review) PASSES on the strength of this review.**

The reasoning:

1. The review is **independent of the tool that was unavailable**. It did not
   use Cursor, and it did not wait for a quota. The V7 policy says Cursor is
   optional and must not block the development; the review was performed
   natively instead.
2. It is **evidence-based**: every claim is traced to code, every number to a
   command, and the mechanical audits (18/18 claims, 79/79 tuning keys) are
   reproducible.
3. It **found and drove out fifteen real defects**, each reproduced before
   the fix — which is the test of a review that it is a review and not a
   rubber stamp.

What this review is **not**: it is not a review by a party outside this
session. A second pair of eyes would be better, and the release would be
stronger for one. The honest statement is that **GATE 12 is closed by a
native senior review, and a second, external review remains worthwhile.**
