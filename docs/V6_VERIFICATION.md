# SuperCitycon V6 — Final Verification

**Product version:** 6.0.0
**Save schema:** version 2 (unchanged from V5)
**Branch:** `v6/upgrade-Zehe03`
**Baseline:** `69b65793a5d10c18d8c8b426fc5431897fada5bd` (`main`, the merged V5)
**Target platform:** Web — Chromium verified
**Build command:** `npm ci && npm run build:cleared`
**Evidence:** `/Users/mac/Documents/SuperCitycon-V6-runs/supercitycon-v6-baseline.Zehe03/evidence`

---

## 1. The verdict

**V6 RELEASE CANDIDATE.**

Every functional gate passed. The one gate that is **open** is the Cursor
senior review (Gate F below): the account's quota was exhausted during the
V5 session and the review was not re-run for the V6 diff. The work is
complete, tested and reproducible; the *review* is the missing piece.

Under the release rules, a release is only called "complete and verified"
when **every** gate passes, so V6 is a release candidate and not a completed
release.

---

## 2. The gate-by-gate table

| Gate | What it proves | Result | Evidence |
|---|---|---|---|
| **A — Baseline** | V5 merged into `main` at `69b6579`; every V5 check re-run at that commit | **PASS** | `evidence/status.tsv` — all eleven preflight checks exit 0; `evidence/production/` |
| **B — Gamepad rules** | The dead zone, the button edge, the axis maths, connect / disconnect | **PASS** | `game/src/core/gamepad.test.mjs` — 27 tests, 27 pass |
| **C — Gamepad service** | The routing, the modal gate, the disconnect handling | **PASS** | `game/src/ui/gamepad.test.mjs` — 17 tests, 17 pass |
| **D — Menu navigation** | Directional navigation, a visible focus ring, confirm / back, a valid focus target after a panel rebuild | **PASS** | `game/src/ui/menu.test.mjs` — 28 tests, 28 pass |
| **E — Analogue camera** | Pan / rotate / zoom, the analogue speed, the modal gate | **PASS** | `game/src/ui/ui.test.mjs` — 45 tests, 45 pass |
| **F — Cursor senior review** | An independent senior review of the V6 diff | **OPEN** | The V5 session exhausted the account quota (`ActionRequiredError: … You're out of usage`). Not re-run for V6. |
| **G — Save compatibility** | A V5 city opens in V6, unrewritten | **PASS** | `game/src/core/save-compat.test.mjs` — 11 tests, 11 pass |
| **H — The whole suite** | No regression anywhere | **PASS** | 770 tests, 770 pass, 0 fail, 0 skipped (9 suites) |
| **I — Syntax** | Every source file parses | **PASS** | 85/85 files parse cleanly |
| **J — Content pipeline** | The authored levels validate | **PASS** | 3 levels checked — 0 errors, 0 warnings, 3 notes |
| **K — GPU tooling** | The performance tooling still runs | **PASS** | `tools/performance-gpu.test.mjs` — 5 tests, 5 pass |
| **L — Security** | No known dependency vulnerability | **PASS** | `npm audit` — 0 vulnerabilities |
| **M — Cleared build** | The shippable bundle builds and is licence-clean | **PASS** | 218 files, 72.7 MB, licence policy **CLEARED**; `dist/assets/ui`, `dist/assets/ui-assets.json` and `dist/DO-NOT-PUBLISH.txt` all absent |
| **N — Browser acceptance (V5)** | The V5 scenario still passes against the V6 build | **PASS** | 40/41 checks passed, 1 correctly skipped — **PRODUCTION BUILD VERIFIED** |
| **O — Browser acceptance (gamepad)** | The gamepad path in a real browser | **PASS** | `tools/scenario-gamepad.mjs` — 19/19 checks passed (`evidence/gamepad/`) |
| **P — Build identity** | The product version is stamped into the bundle | **PASS** | `dist/assets/index-*.js` carries `6.0.0` and the `6.0.0-dev` fallback |

---

## 3. The measurements

### 3.1 The unit suite

```
$ cd game && npm test
# tests 770
# suites 9
# pass 770
# fail 0
# cancelled 0
# skipped 0
```

The V5 baseline at `69b6579` was **704 tests / 704 pass**. V6 added **66**
tests:

| Suite | Tests | What it covers |
|---|---|---|
| `core/gamepad.test.mjs` | 27 | the dead zone, the button edge, the axis maths, connect / disconnect, the binding table |
| `ui/gamepad.test.mjs` | 17 | the routing, the modal gate, the held-button rule, the disconnect handling |
| `ui/menu.test.mjs` (+6) | 6 | the pad navigation, the visible ring, the valid focus target after a panel rebuild |
| `ui/ui.test.mjs` (+5) | 5 | the analogue camera, the analogue speed, the modal gate |
| `core/save-compat.test.mjs` | 11 | the V5 save round trip, the schema version, the v1 → v2 migration |

### 3.2 The browser scenarios

**The V5 acceptance scenario** (unchanged, `tools/scenario.mjs`) against the
cleared V6 build:

```
40/41 checks passed, 1 skipped
PRODUCTION BUILD VERIFIED
```

**The V6 gamepad scenario** (`tools/scenario-gamepad.mjs`) against the same
build:

```
19/19 checks passed
```

including: the D-pad moves the focus; the focus ring is visible; A confirms;
B goes back; a held CONFIRM confirms exactly once in 12 held frames; the
camera moves 95.3 units with a full stick; a resting stick drifts
2.6e-53 units; the camera does not move under the menu; an unplugged pad is
reported, releases the axes and lets the camera come to rest; a reconnected
pad drives the camera again.

### 3.3 The build

```
$ cd game && npm run build:cleared
✓ built in 3.25s
[build] verified 1 referenced file(s) in dist/index.html — all present.
[build] licence policy: CLEARED (2D art stripped)
[dist] 218 files, 72.7 MB total
```

---

## 4. What the gamepad evidence does and does not prove

**Proves:** the routing, the focus ring, the dead zone, the button edge, the
camera gating, the connect / disconnect handling — all in a real browser,
against the real build.

**Does not prove:** how the game feels on real hardware. No physical
controller was available in the build environment; the pad is simulated.
See [`V6_KNOWN_ISSUES.md`](V6_KNOWN_ISSUES.md) V6-KI-10.

---

## 5. The defects found and fixed during V6

| Defect | How it was found | Fix |
|---|---|---|
| The trigger axes were never defined, so the trigger-as-axis path never worked | `core/gamepad.test.mjs` — 3 failures on the first run | `PAD_AXES.LEFT_TRIGGER` / `RIGHT_TRIGGER` added |
| The dead zone was applied to the trigger axes, swallowing the first 18% of every pull | Reading the failing expectations against the rules | The dead zone now applies to the **sticks only**; the triggers are read raw and normalised |
| The menu's focus ring could point at a control that a panel had replaced | The focus-after-a-panel-change requirement | The ring is pruned against the DOM on every move, and the ring re-applies itself where the focus actually is |
| The settings rows were unreachable by keyboard or pad | The same requirement | The panel registers its rows with the menu's focus ring |
| The test DOM shim did not detach replaced children, so it could not model a re-render | The focus-after-a-panel-change test | `replaceChildren()` now clears the old children's `parentNode`, as a real DOM does |

---

## 6. The open gate

**Gate F — the Cursor senior review — is OPEN.**

The V5 session exhausted the account's Cursor quota and the review could not
be run there. The V6 diff has **not** been reviewed by Cursor.

What that means for this release: the V6 work is implemented, tested and
reproducible; it has not had an independent senior review. The release
classification above follows that fact.

---

## 7. How to reproduce every number in this document

```bash
git checkout v6/upgrade-Zehe03
cd game
npm ci
npm test                          # 770 tests
npm run check                     # 85/85 files parse
node tools/validate-content.mjs   # 3 levels, 0 errors
node --test ../tools/performance-gpu.test.mjs
npm audit                         # 0 vulnerabilities
npm run build:cleared             # 218 files, CLEARED
npm run preview                   # http://localhost:4173

node tools/scenario.mjs         http://localhost:4173/ /tmp/sc-v5   v5-acceptance
node tools/scenario-gamepad.mjs http://localhost:4173/ /tmp/sc-pad  v6-gamepad
```
