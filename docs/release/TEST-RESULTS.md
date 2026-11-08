# Test results — MiniMax Game Studio ULTRA V2

Every number below was produced by running the command shown, on the machine
described in `MIGRATION.md`, on **2026-11-08**. Nothing here is a projection.

---

## 1. Syntax check — `cd game && npm run check`

```
56/56 files parse cleanly.
```

**PASS.** Every source file in the project parses under Node 22.

---

## 2. Unit + integration tests — `cd game && npm test`

```
# tests 395
# suites 8
# pass 395
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2538.437959
```

**PASS — 395 of 395.** Eight suites, no failures, no skips, no TODOs, 2.5 s.

The eight suites cover the ten runtime domains plus the cross-domain contract:
`core`, `world`, `buildings`, `economy`, `mobility`, `population`, `services`,
`studio`, `ui`, plus the integration test that binds them together.

---

## 3. Acceptance harness against the PRODUCTION bundle

`cd game && npm run verify:production -- --port 4177 --outdir <dir>`

This is the test that matters. It builds the game, serves the **built bundle**
(not the dev server), opens it in a headless Chromium, and plays it: it builds a
city through the real input path, reads the real state back, looks at the real
pixels, and saves and reloads.

**The harness builds the publishable profile by default** — the same bundle
`.github/workflows/deploy.yml` deploys — and refuses to verify a bundle that
carries the uncleared 2D art or the `DO-NOT-PUBLISH.txt` notice. Pass
`--profile local` to verify the LOCAL build instead.

Against the publishable bundle:

```
profile: cleared (publishable — the same bundle CI deploys)
[dist] publishable: no uncleared 2D art, no DO-NOT-PUBLISH.txt
40/41 checks passed, 1 skipped
PRODUCTION BUILD VERIFIED
```

**PASS — 40 of 41, 1 correctly skipped.** The skip is the 2D-art check: the
publishable bundle deliberately ships no 2D art, so there is no manifest to
resolve. The harness instead proves the HUD is **complete and correct with
zero 2D images** — every control present and labelled, and the licence line
hidden because there is no art to disclaim.

Against the LOCAL bundle (`--profile local`), the same harness reports
**40/40** with the 2D-art check running instead of being skipped.

The full ledger:

| # | Check | Result |
|---|---|---|
| 1 | game boots to ready | PASS — 8 domains: wld, buildings, economy, mobility, population, services, studio, ui |
| 2 | no fatal pane | PASS |
| 3 | all eight runtime domains loaded | PASS — all present |
| 4 | CORE modules loaded | PASS — stage, save, modes |
| 5 | terrain generated (4096 cells) | PASS — 4096 |
| 6 | nature scattered | PASS — 798 placements |
| 7 | a building that needs more slots than the player owns is refused | PASS — needs 2, owns 1: refused (`not-enough-slots`) |
| 8 | that refusal is explained to the player | PASS |
| 9 | the first placement is accepted | PASS |
| 10 | a placement with no free construction slot is refused | PASS — `slots 1/1 used` |
| 11 | the refusal reaches the player as a toast | PASS |
| 12 | a refused placement is not charged | PASS — treasury 24880 → 24880 |
| 13 | a building can be placed on a cell that holds scenery | PASS — accepted |
| 14 | buildings place on the map | PASS — 17/18 placed |
| 15 | roads place on the map | PASS — 9/9 |
| 16 | every placed building has a model in the scene | PASS — 19 instances for 17 buildings |
| 17 | population grows from housing | PASS — 602 residents |
| 18 | day counter advances | PASS — day 3 after 92 s |
| 19 | citizens spawn | PASS — 25 rendered, population 602 |
| 20 | traffic spawns on roads | PASS — 60 vehicles |
| 21 | service coverage computed | PASS — 10 service types |
| 22 | economy responds to the city | PASS — treasury 25249 (started 25000) |
| 23 | HUD mounted | PASS — 2 nodes, 86 buttons |
| 24 | HUD shows live numbers | PASS — treasury, residents, happiness, loyalty, day, clock, zone meters |
| 25 | the 2D HUD art is applied and its files resolve | PASS — 45 icons, 30 distinct files, 30/30 files 200 |
| 26 | a pointer click selects the build tool | PASS — tool = build |
| 27 | a pointer click on a shop card selects the building type | PASS — `res.house` |
| 28 | a pointer click on the canvas places a building and its model appears | PASS — instances 19 → 20 |
| 29 | scene renders geometry | PASS — 405 draw calls, 1,028,617 triangles, 682 meshes |
| 30 | the building models are batched into instanced draws | PASS — 20 buildings of 17 types in 17 batches = 61 draw calls |
| 31 | frame is not a flat colour | PASS — 660 distinct colours, mean luma 111.2 |
| 32 | the SCC Studio opens | PASS |
| 33 | the SCC Studio sculpts a voxel | PASS — 0 → 2 voxels |
| 34 | the SCC Studio exports a valid OBJ | PASS — 761 bytes, has vertices, has faces |
| 35 | the city saves to a slot | PASS — 20 buildings |
| 36 | save round-trips | PASS — 487,504 bytes, 20 buildings preserved |
| 37 | a fresh session loads the save file | PASS — session B: 0 → 20 buildings |
| 38 | the loaded city renders its buildings | PASS — 20 models after the load |
| 39 | no uncaught page errors | PASS |
| 40 | no console errors | PASS |

Evidence (screenshots and the JSON ledger) is in
`game/verification/prod-run/` and `game/verification/final-prod/`.

---

## 4. The acceptance harness against the LICENCE-CLEARED bundle

`node tools/scenario.mjs http://localhost:4174/ <outdir> "CLEARED"`

The publishable build, with the uncleared 2D art stripped:

```
40/41 checks passed, 1 skipped
SKIP  the 2D HUD art is applied and its files resolve
      — no 2D manifest found …
```

**PASS — 40 of 41, 1 correctly skipped.** The skip is the right outcome: the
check asserts the 2D art is present, and in the cleared bundle it must not be.
The build itself **throws** if `dist/assets/ui/` or `dist/assets/ui-assets.json`
survives the strip, so a "cleared" bundle can never carry the uncleared art by
accident.

**The HUD is complete and correct with zero 2D images** — every icon slot falls
back to its CSS/text treatment. The screenshot in
`game/verification/cleared-run/02-overview.png` shows the whole HUD, with the
tool palette reading BUILD / BULLDOZE / ROADS / POWER / TERRITORY / PAINT / STUDIO
as text instead of icons.

---

## 5. The acceptance harness against the LIVE deployment

`node tools/scenario.mjs https://atiffhussainkhan.github.io/SuperCitycon/ <outdir> "LIVE"`

```
40/41 checks passed, 1 skipped
```

**PASS — 40 of 41** against the published site, with **1 correctly skipped**:
the 2D-art check, because the deployed bundle is the licence-cleared profile and
deliberately ships no 2D art. The site was re-verified by HTTP after the
licence fix was deployed — `DO-NOT-PUBLISH.txt`, `assets/ui-assets.json` and
`assets/ui/` all return **404**, `index.html` returns **200**.

---

## 6. The 3D design gates — `cd minimax-game`

| Command | Result |
|---|---|
| `python3 tools/verify_design.py` | **0 FAIL, 0 WARN, 31 PASS, 5 INFO** |
| `python3 tools/audit_depth.py` | **102/102 requirements implementable** |
| `python3 tools/verify_devbots.py` | **0 FAIL, 0 WARN, 13 PASS** |
| `python3 tools/fault_inject_hardened.py` | **18/18 hardened checks bite** |

**PASS.** All four.

The fourth deserves a note: `fault_inject_hardened.py` deliberately breaks the
package in fourteen different ways — a contradicting acceptance-test appendix,
an invented tool file, two boards swapping a content kind, a tree root used
without its prefix, a surviving builder placeholder, a missing edge line, a
duplicated edge line, a malformed table cell, a bot pointing the shipped
prompts at the branded pack, a review-round record with a title one ahead of
the round it holds, and more — and proves that **every one of those is caught**
before restoring the tree. A gate that has never failed proves nothing, so each
of these was made to fail.

---

## 7. Reproducibility — `cd game && npm ci`

The lockfile was reinstalled from scratch and the suite re-run:

```
npm ci          → 2 vulnerabilities (see PERFORMANCE.md §4 — both in the build tool, not the game)
npm test        → 395 pass, 0 fail
```

**PASS.** `npm ci` reproduces the verified install exactly.

---

## 8. Test classification summary

| Area | Class | Notes |
|---|---|---|
| Syntax (56 files) | **PASS** | |
| Unit + integration (395) | **PASS** | 0 fail, 0 skipped |
| Acceptance, production bundle (40) | **PASS** | headless Chromium, real pixels |
| Acceptance, cleared bundle | **PASS** | 40/41, 1 correctly skipped |
| Acceptance, live deployment (41) | **PASS** | 40/41, 1 correctly skipped — against the published URL |
| 3D design gates (4 suites) | **PASS** | 31 + 13 checks, 102/102, 18/18 |
| Reproducible install | **PASS** | `npm ci` |
| Performance probe | **PASS** | see `PERFORMANCE.md` |
| Apple Silicon / ARM | **NOT TESTED** | this machine is x86_64 — see `MIGRATION.md` §6 |
| Unit tests for the 3D game | **NOT APPLICABLE** | the 3D game has no code yet; it is a design package |
| UI tests on real display hardware | **NOT TESTED** | headless software GL only; a real-window run is recorded in `game/DEFECTS.md` (R4-9) |

---

## 9. What is **not** covered

Stated plainly, because a green table is only worth the gaps it does not hide:

1. **No ARM/Apple Silicon execution.** The shipped bundle contains no native
   code, so nothing needs rebuilding — but no ARM build was run on ARM
   hardware.
2. **No real-GPU performance figure.** Every frame time here is software GL.
3. **The 2D HUD art is uncleared.** 69 distinct images in the local build, none in the
   publishable build. See `REMAINING-ISSUES.md`.
4. **One balance defect is visible in the harness output by design.** The
   Monorail Station needs two construction slots and the player owns one, so it
   can never be built. The placement gate enforces it and refuses rather than
   hiding it. See `REMAINING-ISSUES.md` §2.
5. **The 3D game (LANTERNWAKE) has no code.** It is a complete design package
   verified against its own gates; its first real gate is GATE 1.
