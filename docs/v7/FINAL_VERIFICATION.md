# SuperCitycon V7 — Final Verification

**Product version:** 7.0.0
**Save schema:** version 2 (unchanged since V5)
**Branch:** `development/v7`
**Baseline:** V6 at `ecc30fc4c25ebb3b0cb9dd2b1a261dee3df99c7d`
**Target platform:** Web — Chromium verified
**Build command:** `npm ci && npm run build:cleared`
**Evidence:** `/Users/mac/Documents/SuperCitycon-V7-runs/evidence`
**Release artefacts:** `/Users/mac/Documents/SuperCitycon-V7-runs/release`

---

## 1. The verdict

**V7 RELEASE CANDIDATE.**

Every functional, regression, security and performance gate passed. Two
gates are not fully closed, and they are named exactly:

| Gate | Status | Why |
|---|---|---|
| **GATE 9 — Platform verification** | **PARTIAL** | Chromium is the only engine and macOS x86_64 the only platform that could be built and tested. Windows, Linux, Firefox, Safari and ARM64 could not be verified in this environment. The touch support is proven with synthetic events, not on a device. |
| **GATE 12 — Final quality review** | **OPEN** | The Cursor senior review was **not** run for the V7 diff. The V7 review policy states that Cursor is optional and must not block the primary development, so the review was performed with the native tools instead — but an independent external senior review is not something this session can substitute for. |

Under the release rules, a release is called "complete and verified" only
when **every** gate passes. V7 is therefore a **release candidate**, and the
blocker is exactly as stated above: **no independent senior review, and no
platform verification beyond Chromium on macOS x86_64.**

Everything else — the implementation, the tests, the regression safety, the
security, the performance, the documentation and the packaging — is
verified with evidence.

---

## 2. The gate-by-gate table

| # | Gate | Evidence | Result |
|---|---|---|---|
| **1** | **A verified V6 baseline** | `origin/v6/upgrade-Zehe03` = `ecc30fc`; the baseline re-measured in the V7 worktree: 770 tests, 85/85 parse, 0 audit vulnerabilities, **PRODUCTION BUILD VERIFIED** | **PASS** |
| **2** | **Complete requirements** | `docs/v7/REQUIREMENTS.md` — 17 functional, 6 non-functional and 40 grouped requirements, each with an acceptance criterion; `docs/v7/FEATURE_MATRIX.md` maps every one to an implementation and a test | **PASS** |
| **3** | **Architecture validation** | `docs/v7/ARCHITECTURE.md` — §2 is an analysis of the actual source, §3 describes the code that was written; the pure-module rule is enforced by `npm run check` and by the fact that the new modules import no `three` | **PASS** |
| **4** | **Functional implementation** | The navigation, the touch path, the reachability proof and the camera fix are implemented, with 66 new unit tests and a 10-check browser scenario | **PASS** |
| **5** | **Regression safety** | The V5 acceptance scenario **40/41** (the same single correct skip) and the V6 gamepad scenario **19/19**, both against the V7 build; the whole V6 suite still passes (835 = 770 + 66) | **PASS** |
| **6** | **Automated testing** | 835 unit tests, 835 pass, 0 fail, 0 skipped; 91/91 files parse; 3 browser scenarios green | **PASS** |
| **7** | **Security** | `tools/secret-scan.mjs`: 274 files, 0 findings, exit 0; the scanner itself verified against a planted secret (exit 1); `npm audit`: 0 vulnerabilities; no new dependency | **PASS** |
| **8** | **Performance** | The navigation search: median 0.202 ms, p95 **1.350 ms** against a 2 ms budget; the frame rate unchanged at 60 fps (V6 16.667 ms → V7 16.666 ms mean); the boot time unchanged (2060 → 2070 ms) | **PASS** |
| **9** | **Platform verification** | Chromium only. Windows, Linux, Firefox, Safari and ARM64 were **not** built or tested. The touch path was verified with synthetic Chromium touch events, not on a physical device | **PARTIAL** — see §5 |
| **10** | **Release documentation** | `docs/v7/` — the requirements, the baseline audit, the architecture, the feature matrix, the implementation plan, the test plan, the test results, the security review, the performance report, the platform compatibility, the migration guide, the release notes, the known issues and this document. Each number in them was produced by a named command | **PASS** |
| **11** | **Package validation** | The package builds, is hashed and is clean: see §6 | **PASS** |
| **12** | **Final quality review** | The Cursor senior review was **not** run for the V7 diff. The native review passes are listed in §7 | **OPEN** — the blocker |

---

## 3. The measurements

| Check | Command | Result |
|---|---|---|
| The unit suite | `cd game && npm test` | **835 tests, 835 pass, 0 fail, 0 skipped** (9 suites) |
| The syntax check | `npm run check` | **91/91 source files parse cleanly** |
| The content validator | `node tools/validate-content.mjs` | 3 levels — **0 errors, 0 warnings**, 3 notes; the reachability proof: **3/3, 5/5 and 7/7** targets reachable |
| The GPU tooling | `node --test ../tools/performance-gpu.test.mjs` | 5 tests, 5 pass |
| The dependency audit | `npm audit` | **0 vulnerabilities** |
| The cleared build | `npm run build:cleared` | 218 files, 72.7 MB, licence policy **CLEARED** |
| The build identity | `grep 7.0.0 dist/assets/index-*.js` | the bundle carries **7.0.0** |
| The V5 acceptance scenario | `node tools/scenario.mjs` | **40/41 passed, 1 skipped** |
| The V6 gamepad scenario | `node tools/scenario-gamepad.mjs` | **19/19 passed** |
| The V7 scenario | `node tools/scenario-v7.mjs` | **10/10 passed** |
| The production verification | `npm run verify:production -- --profile cleared` | **PRODUCTION BUILD VERIFIED** |
| The navigation benchmark | `node tools/profile-navigation.mjs` | median 0.202 ms, p95 1.350 ms, budget 2 ms — **PASS** |
| The secret scan | `node tools/secret-scan.mjs` | 274 files, **0 findings** |
| The GPU profile | `node tools/profile-gpu.mjs` | mean 16.666 ms, p95 18.4 ms, 60 fps, 0 errors |

---

## 4. The defects this release fixed, and the proof

| Defect | The proof |
|---|---|
| The citizens walked in a straight line through buildings and water | `population/citizens.test.mjs` — "a citizen walks AROUND a building", "a citizen walks AROUND the flood" |
| A held key kept panning the camera under the menu | `ui/ui.test.mjs` — the test was run against the **V6** `camera.js` and **failed** there (46/47); it passes on V7 (47/47) |
| There was no touch support at all | `core/touch.test.mjs` (18), `ui/touch.test.mjs` (13), `tools/scenario-v7.mjs` (10/10) |
| The content validator could not prove reachability | `content/content.test.mjs` (+4) and the CLI, which now reports the proof |
| A pinch zoomed and rotated **cumulatively** | Found by `scenario-v7.mjs` (the distance went 66 → 22 instead of 66 → 33); fixed and re-proved |
| A touch tap selected the cell **twice** | Found by `scenario-v7.mjs` (two clicks reached the domains); fixed — the pointer handler now ignores touch pointers |

---

## 5. What is NOT verified

| | |
|---|---|
| **Windows, Linux, Firefox, Safari** | Not built, not tested. Only Chromium on macOS. |
| **ARM64** | The host is x86_64. No ARM measurement was taken. |
| **A native mobile build** | It does not exist. The **web** build works on a phone; that is a different and smaller claim. |
| **A physical touch device** | The gestures are real browser events, but their FEEL was never put in front of a human. See `KNOWN_ISSUES.md` V7-KI-04. |
| **A physical gamepad** | Unchanged from V6: the pad is simulated. See V7-KI-05. |
| **The independent senior review** | Gate 12. See §7. |
| **A smaller save file** | Deliberately not done: the schema stays at version 2 so no existing city is stranded. |

---

## 6. The release artefacts

| | |
|---|---|
| **The package** | `supercitycon-7.0.0-cleared.tar.gz` |
| **Its SHA-256** | `d7ca1ff57c05007ad8040b80c716479e8c421a809b84a6d75fa7b4584d659e8d` |
| **The size** | 22,593,876 bytes (218 files, 72.7 MB uncompressed) |
| **The file manifest** | `MANIFEST.sha256` — a SHA-256 for every file in the bundle |
| **How it was built** | `node tools/package-game-release.mjs` |
| **What the packager refuses** | any path matching the uncleared 2D art, any credential file, and any credential-shaped value in a text file. It exits 1 rather than shipping one. |
| **Reproducible** | the packager builds the archive **twice** and compares the hashes. The same bundle always produces the same bytes: the file list is sorted, the ownership is normalised, the modification times are pinned and the gzip timestamp is dropped. The rebuild check is part of the packaging step, and the pipeline fails if the two differ. |
| **A note on what "reproducible" means here** | the ARCHIVE is reproducible **given the same bundle**. The BUNDLE itself is not byte-identical across builds, by design: `vite.config.js` stamps the build time into the bundle's identity, so two builds of the same commit differ. The checksum identifies **this** package, which is what a release checksum is for. |
| **Verified** | the package contains **0** paths matching `assets/ui`, `ui-assets.json` or `DO-NOT-PUBLISH.txt` |

**The rollback** is one command: check out `v6/upgrade-Zehe03` (or `main`),
rebuild with `npm run build:cleared`, and serve `game/dist`. **No save
migration is needed in either direction**, because the schema did not move.

---

## 7. The review

The V7 review policy is explicit: **Cursor is optional and must not block
the primary development.** The review was therefore performed with the
native tools:

| Pass | How | Result |
|---|---|---|
| the requirements | every requirement mapped to an implementation and a test | `FEATURE_MATRIX.md` — no requirement without a test |
| the architecture | the source was read before anything was changed; §2 of the architecture document is that analysis | `ARCHITECTURE.md` |
| the defects | each defect was **reproduced before it was fixed**, and two of them carry a test that fails on the V6 baseline | `TEST_RESULTS.md` §4 |
| the code | the unit suite, the syntax check, three browser scenarios, the benchmark, the secret scan | §3 |
| the packaging | the package builds, hashes and refuses to ship a leak | §6 |

**What that is not:** an independent senior review by a party outside this
session. Gate 12 stays **OPEN** for that reason.

---

## 8. The final status

**V7 RELEASE CANDIDATE.**

The implementation is complete, the tests pass, the regression is clean, the
security is reviewed, the performance is measured, the documentation matches
what was built, and the package is hashed.

The exact blockers to a "complete and verified" classification:

1. **No independent senior review of the V7 diff** (Gate 12).
2. **Platform verification is limited to Chromium on macOS x86_64** (Gate 9),
   and the touch path has not been tried on a physical device.

Both are recorded in `KNOWN_ISSUES.md` with the same numbers.
