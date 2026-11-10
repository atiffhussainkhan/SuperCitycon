# SuperCitycon V7 — Test Plan

**Baseline:** V6 at `ecc30fc` (770 tests)
**Target:** every V7 requirement carries at least one automated check.

---

## 1. The layers

| Layer | What it proves | How |
|---|---|---|
| **Unit** | the RULES | `node --test` — pure modules, no browser |
| **Integration** | the domains together | `game/tests/integration.test.mjs` |
| **Content** | the shipped levels | `node tools/validate-content.mjs` |
| **Browser (V5)** | the assembled game | `node tools/scenario.mjs` — unchanged from V5 |
| **Browser (V6)** | the gamepad path | `node tools/scenario-gamepad.mjs` — unchanged from V6 |
| **Browser (V7)** | the touch path and the navigation | `node tools/scenario-v7.mjs` — new |
| **Build** | the shippable bundle | `npm run build:cleared` + `npm run verify:production` |
| **Performance** | the budgets | `tools/profile-navigation.mjs`, `tools/profile-gpu.mjs` |
| **Security** | no leaked credential | `tools/secret-scan.mjs` |

## 2. What each V7 requirement is checked by

| Requirement | Unit | Browser |
|---|---|---|
| V7-FR-001 … 007 (navigation) | `core/navigation.test.mjs` (26), `population/citizens.test.mjs` (+3) | `scenario-v7.mjs` — the citizens in a walled city |
| V7-FR-008, 009 (gestures) | `core/touch.test.mjs` (18) | `scenario-v7.mjs` — the gestures in Chromium |
| V7-FR-010, 011 (the touch camera and selection) | `ui/touch.test.mjs` (13) | `scenario-v7.mjs` — 10 checks |
| V7-FR-012, 013 (the layout) | — | `scenario-v7.mjs` — the narrow viewport |
| V7-FR-014, 015 (reachability) | `content/content.test.mjs` (+4) | `tools/validate-content.mjs` |
| V7-FR-016 (the camera under a modal) | `ui/ui.test.mjs` (+2) | — |
| V7-FR-017 (the save schema) | `core/save-compat.test.mjs` (unchanged) | — |
| V7-NFR-001 … 003 (performance) | `navigation.test.mjs` — the median | `tools/profile-navigation.mjs`, `tools/profile-gpu.mjs` |
| V7-SEC-001 (no secrets) | — | `tools/secret-scan.mjs` |

## 3. The regression rules

1. **The V5 and V6 acceptance scenarios are not modified.** They run against
   the V7 build and must pass. A V7 change that breaks V5 behaviour is a
   V7 defect, not a test to be updated.
2. **A defect fix carries a test that fails on the baseline.** BUG-02's test
   was run against the V6 `camera.js` and failed there (46/47); it passes on
   V7 (47/47).
3. **A timing assertion inside the parallel suite uses the median.** The
   suite runs nine files at once, so a single sample can be stretched by
   another process. The real 95th percentile is measured on a quiet machine
   by `tools/profile-navigation.mjs`.
4. **A browser check measures a SNAPSHOT, never the live object.** Comparing
   the live camera object with itself always says "no change" — which is how
   the first version of the gamepad scenario produced a false pass.

## 4. The commands

```bash
cd game
npm ci
npm test                              # the unit suite
npm run check                         # every source file parses
node tools/validate-content.mjs       # the content validator
node --test ../tools/performance-gpu.test.mjs
npm audit                             # the dependency check
npm run build:cleared                 # the shippable bundle
npm run preview                       # http://localhost:4173

cd ..
node tools/secret-scan.mjs            # the secret scan
node tools/profile-navigation.mjs     # the navigation benchmark
node tools/profile-gpu.mjs --url http://localhost:4173/ --frames 300
node tools/scenario.mjs         http://localhost:4173/ /tmp/sc-v5 v5-acceptance
node tools/scenario-gamepad.mjs http://localhost:4173/ /tmp/sc-pad v6-gamepad
node tools/scenario-v7.mjs      http://localhost:4173/ /tmp/sc-v7 v7
```
