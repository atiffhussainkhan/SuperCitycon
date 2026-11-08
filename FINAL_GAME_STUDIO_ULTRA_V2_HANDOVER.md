# FINAL HANDOVER — MINIMAX GAME STUDIO ULTRA V2

**Repository:** `/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace`
**Report date:** 2026-11-08
**Branch:** `main` — the licence fix was committed and **pushed** as `c58d265`;
the workflow ran green and deployed in 9 s, so the corrected build is **live**.
This report's final wording is in the follow-up commits listed in §12
(`e59b668`, `9d12462`, `ae40767`) and the report's own later commits, all
pushed to `main`.
**Machine:** macOS 26.7.1 (25G241), **x86_64 Intel**, Node 22.14.0, npm 10.9.2,
Python 3.15.2, git 2.50.1

---

## 0. Final conclusion

# **B. READY WITH EXTERNAL LIMITATIONS**

Every automated check that can run on this machine **passes**, and the game is
playable, buildable and publishable today. The limitations below are **external**:
they require hardware, a publisher's licence decision, or an account the project
does not have — not a fix to the code.

**No critical failure remains.** Nothing in §9 blocks playing, building,
packaging or publishing the 2D game with `npm run build:cleared`.

Two things are genuinely outside my reach and are stated plainly rather than
glossed:

1. **The 2D HUD art is licence-unverified.** 82 images carry
   `licence_status: "unverified"`. The publishable build strips them and the
   HUD stays complete; clearing the licences is a **publisher's** decision.
2. **Apple Silicon was not executed.** This machine is Intel. The shipped
   bundle contains **0 native executables**, so the same artefact runs on ARM,
   but I will not claim a test I did not run.

**The licence exposure on the live site is closed.** With your approval the
corrected build was committed and pushed; the site now serves the publishable
bundle, and `DO-NOT-PUBLISH.txt`, `assets/ui-assets.json` and `assets/ui/` all
return **404**.

---

## 1. What this project is

Two sub-projects, in one repository:

| | |
|---|---|
| **`game/`** | **SuperCitycon v1.0.0** — a playable Vite + Three.js city-builder. 45 source modules, 3 test files, real build, real tests, real running app. Published at `https://atiffhussainkhan.github.io/SuperCitycon/`. |
| **`minimax-game/`** | **LANTERNWAKE** — the 3D **design-only** package. 102 requirements, 8 documents (13,001 lines), 5 development bots, 4 executable gates. **There is no game code for it.** |

The 3D package is a *design* deliverable, and is described as such everywhere.
No part of this report claims the 3D game runs.

---

## 2. Tests executed — the actual results

Every figure below was produced by running the command shown, in this session.
Nothing is projected or quoted from memory.

### 2.1 The 2D game

| # | Command | Result | Verdict |
|---|---|---|---|
| 1 | `cd game && npm run check` | `56/56 files parse cleanly.` | **PASS** |
| 2 | `cd game && npm test` | `# tests 395 · # pass 395 · # fail 0 · # suites 8 · 3.55 s` | **PASS 395/395** |
| 3 | `npm run verify:production -- --port 4181` (publishable profile) | `40/41 checks passed, 1 skipped` | **PASS** — the skip is the 2D-art check, correctly skipped |
| 4 | `npm run verify:production -- --port 4182 --profile local` | `40/40 checks passed` | **PASS 40/40** |
| 5 | `npm ci` from the lockfile, then re-run #2 | clean install, 395/395 again | **PASS** |
| 6 | `node tools/performance.mjs --port 4176 --frames 90` | see §6 | **PASS** — 0 console errors |
| 7 | Live site `https://atiffhussainkhan.github.io/SuperCitycon/` | **after the deploy**: `DO-NOT-PUBLISH.txt` → **404**, `assets/ui-assets.json` → **404**, `assets/ui/` → **404**, `index.html` → **200**; the acceptance harness against the live URL → **40/41, 1 skipped** (the 2D-art check) | **PASS** — the licence exposure is closed |

The acceptance harness is the one that matters: it builds the bundle, serves
it with `vite preview`, opens it in a headless Chromium, and **plays it** —
building a city through the real input path, reading the state back, looking
at the pixels, saving and reloading in a fresh session.

### 2.2 The 3D design package

| # | Command | Result | Verdict |
|---|---|---|---|
| 8 | `python3 tools/verify_design.py` | `0 FAIL, 0 WARN, 31 PASS, 5 INFO` | **PASS** |
| 9 | `python3 tools/audit_depth.py` | `102/102 requirements implementable` | **PASS** |
| 10 | `python3 tools/verify_devbots.py` | `0 FAIL, 0 WARN, 13 PASS` | **PASS** |
| 11 | `python3 tools/fault_inject_hardened.py` | `18/18 hardened checks bite` | **PASS** |
| 12 | `python3 tools/pack_cache.py` | `all 22 expected archives are present and readable` | **PASS** |
| 13 | `python3 tools/build_master.py` (twice) | byte-identical master | **PASS** — idempotent |

**18/18 fault injections bite** means each of those 18 checks was made to
**fail** on a known-bad input and was caught. A gate that has never failed
proves nothing; that is why the injection count is a published figure.

### 2.3 The final round — rebuilding the release from a clean checkout

Run after the fixes in §4.7 and §4.8, against the release commit itself:

| # | Command | Result | Verdict |
|---|---|---|---|
| 14 | `git worktree add --detach /tmp/pkg-src <commit>` → `npm ci` → `npm run build:cleared` | **218 files, 72.6 MB**, licence policy `CLEARED` (2D art stripped) | **PASS** |
| 15 | `node tools/package-release.mjs` in that worktree | **720 files, 167.3 MB, 719 hashed**, secret scan clean over 711 files, `DO-NOT-PUBLISH` absent | **PASS** |
| 16 | `shasum -a 256 -c SHA256SUMS.txt` in the built package | **719/719 OK**, exit 0 | **PASS** |
| 17 | clean copy of the package → `npm ci` → `npm test` | **395/395 pass**, 8 suites, 0 fail | **PASS** |
| 18 | clean copy of the package → `npm run check` | **56/56 files parse cleanly** | **PASS** |
| 19 | clean copy → `python3 tools/audit_depth.py` / `verify_devbots.py` | **102/102 implementable** · **0 FAIL, 13 PASS** | **PASS** |
| 20 | clean copy → `python3 tools/verify_design.py` | **3 FAIL, 28 PASS** — *correctly*: the package ships without the 2.4 GB cache, so the gate calls the paths **UNVERIFIED** and prints the restore command | **PASS (legible failure)** |
| 21 | `python3 tools/pack_cache.py` in the clean copy | **FAIL** — names the 22 missing archives and the restore command; no path is called fabricated | **PASS (legible failure)** |
| 22 | construction-slot progression, measured against the shipped source | slots `1 → 2`; Monorail Station gate `ok: true` once the landmark completes | **PASS** |
| 23 | live HTTP against the deployed site | `DO-NOT-PUBLISH.txt` / `assets/ui-assets.json` / `assets/ui/` → **404**, `index.html` → **200** | **PASS** |
| 24 | packaged `verify_devbots.py` with `HOME` pointed at an empty directory | **0 FAIL, 13 PASS** — the gate passes on a machine that has never run this project, because the bots now travel inside the package | **PASS** |
| 25 | packaged `fault_inject_hardened.py` with no asset cache | **BLOCKED, exit 2**, restore command printed, no figure published | **PASS (legible block)** |

### 2.4 Classification

| Class | Items |
|---|---|
| **PASS** | All 25 checks above, plus the release-package verification in §8 |
| **FAIL** | None outstanding. Every failure found during this work was fixed and re-verified. |
| **BLOCKED** | 4 — see §9 |
| **NOT APPLICABLE** | 2 — the 2D-art acceptance check on the publishable profile (correctly skipped, because that bundle deliberately ships no 2D art); the ARM build (no ARM hardware here) |

---

## 3. Verified features — the 2D game

Confirmed by the harness against the **built bundle**, not the dev server:

- Boots to ready with all **8 runtime domains** loaded (`wld`, `buildings`,
  `economy`, `mobility`, `population`, `services`, `studio`, `ui`).
- Terrain generates (4096 cells), nature scatters (798 placements), roads and
  buildings place on the map.
- The economy, treasury, population, happiness and day cycle run and read back
  correctly.
- **Save/load round-trips**: a slot is written, a fresh session loads it, and
  the buildings reappear in the scene.
- The **SCC Studio** opens, sculpts a voxel (0 → 2), and exports a valid OBJ.
- **Construction-slot progression** (FR-ECO-020): the player starts with one
  slot; two-slot buildings are refused with `not-enough-slots`; placing the
  **Citycon Building** grants a second permanent slot (`total: 1 → 2`); once
  that construction completes (120,000 ms) the **Monorail Station** gate flips
  to `ok: true` and it builds, occupying both slots (`used: 2, free: 0`).
  Measured directly against the shipped source.
- **No uncaught page errors and no console errors.**
- The frame is not a flat colour: 660 distinct colours, mean luma 111.2.

Screenshots I opened and inspected: `game/verification/final-cleared/02-overview.png`
— a full city, a complete HUD, the icon bar, and (on the cleared profile) text
labels where the uncleared icons would be.

---

## 4. Problems discovered and resolved

### 4.1 A live licence defect — the highest-severity finding

`game/LICENCE-REPORT.md` says the LOCAL build "must not be published".
`.github/workflows/deploy.yml` ran `npm run build` — the **LOCAL** profile — and
deployed it. The published site was serving the **82 licence-unverified 2D
images** *and* the `DO-NOT-PUBLISH.txt` notice that says the bundle must not be
published. I confirmed both live by HTTP.

**Fixed**: the workflow now runs `npm run build:cleared` and **asserts** that
`dist/assets/ui/`, `dist/assets/ui-assets.json` and `dist/DO-NOT-PUBLISH.txt`
are all absent before it deploys. The LOCAL profile remains available for the
owner's own use.

**Fixed and live.** The change was committed and pushed to `main` (`c58d265`),
the workflow ran green — including the new "Check the bundle" step — and
deployed in 9 s. The live site now returns **404** for `DO-NOT-PUBLISH.txt`,
`assets/ui-assets.json` and `assets/ui/`, and **200** for `index.html`. The
licence exposure is closed, not merely fixed in the source tree.

### 4.2 The harness was verifying the wrong bundle

`npm run verify:production` built the **LOCAL** profile, so the command named
"production" was proving a bundle that CI never ships and that carries the
uncleared art. **Fixed**: the harness now builds the **publishable** profile by
default — the same bundle the deploy workflow produces — and refuses to verify
a bundle carrying the uncleared art or the notice. `--profile local` selects
the local build.

### 4.3 A missing cache looked identical to a broken design

The 3D gate resolves 849 cited asset paths, 722 of which live inside the pack
archives. With the cache absent, the gate reported "722/849 cited paths do not
resolve" and printed **41 FAIL lines** naming paths as **fabricated**. They were
not fabricated — the archives that would have proved they exist were not there
to open. A missing cache and a broken design produced the same output.

**Fixed**: the gate now measures the cache state first. With the cache
incomplete it emits **one** legible FAIL naming the missing archives and the
command that restores them, and calls the paths **UNVERIFIED** — never
fabricated. With the cache complete the strict behaviour is unchanged.

### 4.4 Four false-certificate holes, found by senior review

I ran the Cursor senior agent over the change set three times. It found **4
MAJOR** and **8 MINOR** defects in my own work; all are fixed and re-verified.
The most serious were holes I had just introduced:

- An **empty** expected-archive list read as a *complete* cache.
- A **partial** derivation (one fetch script missing) read as complete.
- The fetch-script set was a **typed tuple**, so a third script would have been
  invisible to the check.
- Injection #15 **did not prove what it claimed** — its "no path was called
  fabricated" assertion was vacuous, because with an incomplete cache the path
  check reports UNVERIFIED and never "fabricated".

The last one is the reason this package has an injection harness at all. It
now proves the property in two halves: the real path check must report *"all
849 cited paths resolve"*, and the **real `main()`** must then refuse to
certify with one archive missing.

### 4.5 Portability defects

- Six tools hard-coded one machine's absolute Playwright path → replaced with
  `tools/playwright-resolve.mjs`, which tries `PLAYWRIGHT_MODULE`, then a
  normal import, then known local locations, and fails with an actionable
  message.
- Both asset fetch scripts hard-coded one session's absolute path → they now
  derive the destination from their own location, with an argument override.
- The design tool allow-list was hand-typed → it is now read from the
  filesystem, so it cannot drift.

### 4.6 A figure I published was wrong

I wrote that the old gate printed "721 further lines". It printed **41 FAIL
lines** (the header, the first forty, and a count of the rest). I reconstructed
the old output to confirm the number, then corrected the figure in the code
comment, the module docstring and the master. Two other published figures
(721 vs 722) were measuring different conditions; they are now separated
explicitly — **722** is the portable figure, **721** is the case where the
shared mirror happens to hold one of them.

### 4.7 The release documents were never version-controlled

`.gitignore` ended with a bare `release/` pattern. Git matches an unanchored
pattern at **any depth**, so it silently excluded `docs/release/` as well as the
root package. The six release documents — `RELEASE-MANIFEST`, `TEST-RESULTS`,
`PERFORMANCE`, `REMAINING-ISSUES`, `RECOVERY`, `LICENCES` — shipped inside the
package, but existed only in the working tree: a clean checkout could not
rebuild the release, and `git status` showed nothing because ignored files are
hidden by default.

**Found** while rebuilding the package from an isolated worktree at the release
commit: the rebuild produced **708 files instead of 720**, and the missing 12
were exactly the six documents in `docs/release/` and their six copies at the
package root. **Fixed**: the pattern is now anchored (`/release/`), the six
documents are committed, and the same worktree rebuild produces the full
**720 files / 719 checksums** again.

### 4.8 A claim in this report was wrong about the game's progression

§9 said the two-slot buildings could *never* be built. They can. The
construction-slot progression is implemented (FR-ECO-020): the player starts
with one slot, the **Citycon Building** — a placeable landmark, unlocked at
level 8, carrying `grantsConstructionSlot` — grants a second permanent slot,
and once that construction completes the Monorail Station gate flips to `ok`
and it builds. Measured directly against the shipped source: slots
`total: 1 → 2`, then `free: 2`, Monorail Station gate `ok: true`, and
`used: 2, free: 0` while it is under construction. The acceptance harness
reports the refusal only because its scenario exercises the early game and
never places the landmark. **Corrected** in §3 and §9.

### 4.9 The release package shipped a gate that failed on arrival

The five 3D development bots (`pd-dev-*`) lived only in the desktop runtime's
agent home, `~/.minimax/agents` — **outside the repository**. The release
package shipped `verify_devbots.py`, the gate that checks those bots, but not
the bots themselves. Measured on a machine without them:

```
[FAIL] 5 development bot(s) not found: pd-dev-platform, pd-dev-player,
        pd-dev-entities, pd-dev-world, pd-dev-assets
```

So a recipient who extracted the package on a fresh Mac got a gate that failed
out of the box, and no way to satisfy it from the package. Nothing in the
migration guide mentioned the bots either.

**Fixed**: the bots now travel with the project in `minimax-game/agents/`, the
packager includes that directory, `verify_devbots.py` reads the portable copy
by default (falling back to the installed one), and `docs/MAC-PORTABILITY.md`
§1b gives the one-line install step for re-enabling them in the desktop
runtime.

The fault-injection harness needed the matching fix: it had been mutating the
**installed** bots in place, so once the gate read the portable copy those
injections no longer bit anything — the score dropped to **13/18**. The harness
now copies the bots into a throwaway directory and points the gate at it, so
an injection never edits the repository or the installed agents. Back to
**18/18**, with both copies verified byte-identical afterwards.

One more thing surfaced while verifying the packaged copy: the hardened
harness needs the asset cache, because some injections mutate the path check
and can only be proven when every cited path resolves. Without the cache it
died with a raw `AssertionError` traceback. It now **reports `[BLOCKED]`**,
names the restore command, and exits **2** — it never prints a figure it did
not earn. With the cache present it is unchanged at **18/18**.

---

## 5. Storage and clean-up — what was actually reclaimed

**Reclaimed inside the workspace:** removed, via the recoverable system Trash
(never `rm`):

| Item | What it was |
|---|---|
| 7 × `.DS_Store` | Finder metadata |
| `minimax-game/tools/__pycache__` | Python bytecode cache |
| `minimax-game/_audit_basenames_out.txt` | a generated audit scratch file |
| `minimax-game/my_mario_game` | an empty stray directory |

**Trash state, measured now:** **empty — 0 items, 0 B.** At the end of this work
the Trash held **1,077 MB across 5 items**, and every single one was scratch
this project created in the final verification round: the temporary directories
used to rebuild and independently verify the release package (`pkg-src/`,
`pkg-out/`, `pkg-out2/`, `pkg-verify2/`, `pkg-final-out/`).

| Item | Size | What it was |
|---|---|---|
| `pkg-src/` | 245 MB | an isolated `git worktree` at the release commit: `npm ci` → `build:cleared` → the packager |
| `pkg-verify2/` | 216 MB | a clean copy of the package, used for the independent `npm ci` + test run |
| `pkg-out/`, `pkg-out2/` | 424 MB | two complete package builds produced by that worktree |
| `pkg-final-out/` | 192 MB | the final package build, before it was copied into `release/` |

All five were **mine, from this session, and fully regenerable** — the package
is rebuilt by `node tools/package-release.mjs` and re-verified by extracting it
to a temporary directory. **The owner approved the permanent emptying at the
end of this session and it is done**: `osascript -e 'tell application "Finder"
to empty trash'` → the Trash measured **0 B / 0 items** immediately after, and
**1,077 MB reclaimed**. The Trash's earlier contents (18 items / 455 MB, also
all scratch of mine) had already been emptied before this round. No pre-existing
user data was in the Trash at any point: the 1,362 items the brief referred to
were already empty when I first measured.

**What I deliberately did NOT delete:**

- **The 2.4 GB pack cache** (`minimax-game/platformer-docs/library-packs/`).
  Measured, not assumed: with it deleted, **722 of the 849** cited paths cannot
  be verified. It is a regenerable cache of a public upstream repository, it is
  gitignored, and the 10 MB inventory that travels with the release package
  depends on it for path verification.
- All original assets, source, licences, working builds and review history.

**`.gitignore`** keeps the 2.4 GB pack cache, the `__pycache__` and the **release
package itself** out of the repository. The release package is a rebuildable
artefact that deliberately contains the built bundle, so committing it would put
a *third* copy of every model binary in the history. Verified with
`git check-ignore`, which is the check that actually decides the question:
`release/MINIMAX-GAME-STUDIO-ULTRA-V2/SHA256SUMS.txt` **is ignored** and
`minimax-game/platformer-docs/library-packs/` **is ignored**.

**A defect in that file was found and fixed in the final round** — see §4.7:
the bare `release/` pattern also matched `docs/release/`, so the six release
documents were never version-controlled.

**Current footprint:** workspace **2.9 GB** = `minimax-game/` 2.4 GB (cache) +
`game/` 229 MB + `release/` 212 MB + `docs/` 3.8 MB.

---

## 6. Performance — measured, not modelled

`node tools/performance.mjs --port 4176 --frames 90`, against the built bundle
(`game/verification/performance/performance.json`):

| Measure | Value |
|---|---|
| Load event | **169 ms** |
| Ready | **1,605 ms** |
| City state | 12 buildings · 9 roads · 447 residents · 60 vehicles |
| Draw calls | **633** (buildings: 12 instances → 12 batches → 43 draw calls) |
| Triangles | **1,124,545** |
| Scene meshes | 632 |
| Save / load | **23.9 ms / 27.1 ms** |
| Console errors | **0** |
| Frame time (90 frames) | median **240.9 ms**, p95 **627.8 ms**, max 870.5 ms → **4.2 FPS** median |

**The frame rate is not a game defect.** The headless browser runs on
**software GL (SwiftShader)**, not a GPU. The simulation uses a fixed step, so
gameplay is unaffected. **I have no real-GPU figure**, and I will not
manufacture one — that is recorded as a limitation in §9.

---

## 7. Supported platforms

| Platform | Status |
|---|---|
| **macOS, x86_64 Intel** | **Verified on this machine.** All checks above ran here. |
| **macOS, Apple Silicon (arm64)** | **Technically feasible, NOT executed.** The shipped bundle has **0 native executables** (117 `.glb`, 41 `.gltf`, 41 `.bin` — all data, all portable). The lockfile carries `darwin-arm64` variants, so `npm ci` resolves on ARM. **I did not run an ARM build, and this report does not claim one.** |
| **Linux / CI** | The deploy workflow runs on `ubuntu-latest` with Node 20; the bundle is platform-neutral. |
| **Any modern browser** | WebGL + WebGL2 required. |

Machine-specific limits are catalogued in `docs/MAC-PORTABILITY.md` §8.

---

## 8. Release package

**Location:** `workspace/release/MINIMAX-GAME-STUDIO-ULTRA-V2`

| | |
|---|---|
| Files | **720** (719 checksummed + `SHA256SUMS.txt`) |
| Size | **167.3 MB** |
| Secret scan | **clean** — every text file scanned, no credential pattern matched |
| Checksums | **719/719 verified OK** by independent `shasum -a 256 -c` |
| `DO-NOT-PUBLISH.txt` | **absent** |
| Independent extract + `npm ci` + `npm test` | **395/395 pass**; harness 40/41 (1 skipped) |
| Rebuilt from a **clean checkout** of the release commit | **720 files / 719 checksums** — `git worktree` → `npm ci` → `npm run build:cleared` → `node tools/package-release.mjs` |

**Contents:** the verified game source *and* the built, licence-cleared bundle;
the 3D design package (documents, inventory, gates, **the five development
bots**, review record); the harness and tooling; the release documentation.
`node_modules/`, `library-packs/`, `.git/`, logs and `.DS_Store` are excluded,
and every exclusion is written down in `tools/package-release.mjs`.

**Independently verified by extracting it to a clean directory** and running it
from there — not from the working tree:

| Step | Result |
|---|---|
| `npm ci` from the shipped lockfile | **PASS** — clean install |
| `npm test` | **PASS — 395/395**, 8 suites, 0 fail |
| `npm run check` | **PASS — 56/56 files parse cleanly** |
| `npm run verify:production` | **PASS — 40/41, 1 skipped** (the 2D-art check, correctly skipped) |
| `python3 tools/audit_depth.py` | **PASS — 102/102 implementable** |
| `python3 tools/verify_devbots.py` | **PASS — 0 FAIL, 13 PASS** — against the bots the package now carries (`minimax-game/agents/`), so the gate passes on a machine that has never run this project |
| `python3 tools/verify_design.py` | **3 FAIL, 28 PASS** — *correctly*: the package ships without the 2.4 GB cache, so the gate reports the paths as **UNVERIFIED** and names the restore command. The fetch scripts ship with it and resolve their destination from their own location, so `bash tools/fetch-3d-packs.sh` restores the cache in place. |
| `python3 tools/fault_inject_hardened.py` | **BLOCKED (exit 2)** — *correctly*: this gate needs the archive cache, because some injections mutate the path check and can only be proven when all 849 paths resolve. It prints the restore command instead of a traceback, and publishes no figure. With the cache present it reports **18/18**. |
| `shasum -a 256 -c SHA256SUMS.txt` | **719/719 OK**, 0 non-matching |
| Independent secret scan (stricter patterns) | **0 findings** across 304 text files |

The package deliberately duplicates ~150 MB — both `game/public/assets`
(source) and `game/dist` (built) — so the package is both rebuildable and
immediately playable. That trade-off is documented in
`docs/release/RELEASE-MANIFEST.md`.

One earlier grep hit was a false positive — it matched the scanner's own regex
*source* in `tools/package-release.mjs`, not a credential.

---

## 9. Remaining external blockers

These need hardware, a publisher's decision, or an account the project does not
have. None is a code fix.

| # | Blocker | Why it cannot be closed here | Effect |
|---|---|---|---|
| **B-1** | **Apple Silicon untested** | This machine is x86_64. The bundle is portable (0 native binaries) but I did not execute an ARM build, and will not claim I did. | A copy/rename risk on ARM only; low. Run the harness on an M-series Mac to close it. |
| **B-2** | **82 2D HUD images licence-unverified** | Every 2D record in the library carries `licence_status: "unverified"`. Only the publisher can clear them. | The publishable build ships no 2D icons; the HUD falls back to text and stays complete. |
| **B-3** | **No real-GPU performance figure** | The headless browser here uses software GL. | The 4.2 FPS figure is not representative; no GPU measurement exists. |
| **B-4** | **The 3D game has no code** | It is a design package by instruction. Its first real gate is **GATE 1**; `DEL-02` blocks its Gate 2. | Not a defect. The design is implementation-ready. |

### Open design decisions (need the requester, not the team)

| Item | Effect |
|---|---|
| `OPEN-002` — the web release host and its COOP/COEP limits | Neither blocks desktop Gates 0–5 |
| `OPEN-005` — the rights review before public distribution | Neither blocks desktop Gates 0–5 |

### Known, accepted, non-blocking

- **2 npm advisories** (1 moderate esbuild, 1 high vite). Verified **neither
  is in the shipped bundle** — the only `vite` string in the built JS is the
  `vite:preloadError` event name — and the dev server binds to loopback.
  Fixing requires `vite@8.3.6`, a semver-major bump that would force
  re-verifying everything. **Deliberately not upgraded**, documented in
  `docs/release/PERFORMANCE.md` §4 and `game/README.md` §7.
- **Two-slot buildings are gated on progression, not broken.** The player starts
  with **one** construction slot, so `trn.monorail_station` and `eng.coal` (both
  ask for two) are refused with `not-enough-slots` early on. The **Citycon
  Building** — a placeable landmark that unlocks at level 8 and carries
  `grantsConstructionSlot` (FR-ECO-020) — grants a second permanent slot.
  Measured: slots go `total: 1 → 2`, and once that construction completes the
  Monorail Station gate flips to `ok: true` (see §3). The acceptance harness
  reports the refusal because its scenario exercises the early game and never
  places the landmark.
- **The shop category bar overflows at 1600 px.** Measured in the browser:
  `.sc-shop-tabs` has `scrollWidth: 2091` in a `clientWidth: 1584` box, so
  four of twelve categories sit outside the viewport by default. **Reachable**
  — scrolling to `scrollLeft: 507` brings the last chip fully into view and it
  clicks. Cosmetic: macOS overlay scrollbars advertise nothing.
- **27 music cues have no source** (`DEL-01`). The music bus ships **silent**,
  no cue is fabricated, and `REQ-D-015` says so. Optional, not blocking.

---

## 10. Manual actions still necessary

**The Trash no longer needs your attention** — it was emptied with your approval
at the end of this session (§5): **1,077 MB reclaimed, 0 items left**.

1. **Clear the 82 2D licences** (publisher's decision) if you want a decorated
   build. The published site is already licence-compliant without them.
2. **Run the harness on an Apple Silicon Mac** to close B-1.
3. **Review the 4 open design decisions** (`OPEN-002`, `OPEN-005`, and the two
   published-value questions in `docs/release/REMAINING-ISSUES.md` §3–§5).
4. **Adopt or discard the concurrent work in the working tree** — another
   process is editing this repository (a shop-tab wrap fix, a hardware-GPU
   performance mode, and new tests). It is uncommitted and deliberately not in
   the release; it needs a review and a commit, or a discard, by whoever owns
   that work.

**Done during this session, with your approval:** the corrected build was
committed and **pushed to `main`** (commit `c58d265`). The GitHub Actions
workflow ran green — including its new "Check the bundle" step, which asserts
the uncleared art and the notice are absent — and deployed in 9 s. The live
site now returns **404** for `DO-NOT-PUBLISH.txt`, `assets/ui-assets.json` and
`assets/ui/`, **200** for `index.html`, and passes the acceptance harness at
**40/41 (1 skipped)** against the live URL. The licence exposure described in
§4.1 is closed.

---

## 11. Mac portability and migration artefacts

| Artefact | Purpose |
|---|---|
| `docs/dependency-manifest.json` | Machine-readable dependency and version manifest |
| `docs/MAC-PORTABILITY.md` | Install, environment template, backup, migration, MacBook setup, Apple Silicon notes, machine-specific limits, recovery. Shipped in the package as `MIGRATION.md`. |
| `docs/release/*.md` | RELEASE-MANIFEST, TEST-RESULTS, PERFORMANCE, REMAINING-ISSUES, RECOVERY, LICENCES |
| `tools/playwright-resolve.mjs` | Portable Playwright resolution (no vendored dependency) |
| `tools/package-release.mjs` | Reproducible packager with secret scan and checksums |
| `tools/performance.mjs` | The performance probe in §6 |

The 3D design package carries its own portability: both fetch scripts now
resolve their destination from their own location, and the cache check fails
closed when it cannot derive what the cache should contain.

---

## 12. What changed on disk

**Modified:** `.github/workflows/deploy.yml` (the licence fix) · `.gitignore` ·
`game/README.md` · `game/tools/verify-production.mjs` (the profile fix) ·
`minimax-game/tools/verify_devbots.py` (the portable bot copy) ·
`minimax-game/tools/fault_inject_hardened.py` (injections on a throwaway copy) ·
`tools/{scenario,headed,probe-pointer,probe-save,probe,shoot}.mjs` (portable
Playwright) · `tools/package-release.mjs` (ships the bots) ·
`docs/MAC-PORTABILITY.md`

**New:** `tools/{playwright-resolve,performance,package-release}.mjs` ·
`docs/dependency-manifest.json` · `docs/MAC-PORTABILITY.md` · `docs/release/*`
(now **tracked** — see §4.7) · `docs/review/*` (the three Cursor review briefs
and their README) ·
`game/verification/{prod-run,live-run,live-final,cleared-run,portable-run,
final-prod,final-prod-rerun,final-cleared,final-local,performance}/` ·
`release/MINIMAX-GAME-STUDIO-ULTRA-V2/` (gitignored — a rebuildable artefact) ·
`minimax-game/tools/pack_cache.py` (the cache module) ·
`minimax-game/agents/pd-dev-*/agent.md` (the five development bots, now
portable — see §4.9) · the whole `minimax-game/` tree

**Committed and pushed**, in order:

| Commit | What it carried |
|---|---|
| `c58d265` | the licence fix, the deploy workflow change, the profile fix, the portability artefacts, and the first version of this report — 85 files, 132,713 insertions, 0 archives |
| `e59b668` | the completed deploy and the live verification evidence |
| `9d12462` | the corrected construction-slot claim (§4.8) |
| `ae40767` | the `.gitignore` anchor fix and the six release documents (§4.7) |

Two further commits carry this report's own final wording (the §2.3 round, and
the Trash figure). They change no code, and the last of them is the commit that
carries this file — `git log --oneline -6` shows the whole series.

The release package is deliberately **not** committed; it is rebuilt by
`node tools/package-release.mjs` — and now verifiably so, from a clean checkout
(§8).

---

## 13. Recommendations

1. **Run the harness once on an Apple Silicon Mac** — 15 minutes, closes B-1,
   and makes the "portable to ARM" claim measured rather than argued.
2. **Do not upgrade Vite for the two advisories.** Neither is in the shipped
   artefact; the major bump would cost more re-verification than it buys.
3. **Keep the pack cache.** It is 2.4 GB of regenerable cache, but deleting it
   makes 722 of 849 cited paths unverifiable, and the gate will (correctly)
   refuse to certify the design without it.
4. **Treat the injection count as the real health metric.** 18/18 is the
   number that says the gates can be fooled — and have been taught not to be.
   A gate that has never failed proves nothing.
5. **Fix the shop-tab overflow cosmetically** — a fade or wrapping layout. It
   is the only player-facing defect I found, and it is cosmetic.

---

## 14. Where to look

| Want | Read |
|---|---|
| What the project is | `README.md`, `game/README.md`, `minimax-game/platformer-docs/DESIGN-3-MASTER.md` |
| How to run it | `game/PLAY-GUIDE.md` (shipped as `OPERATING-GUIDE.md`) |
| How to move it to another Mac | `docs/MAC-PORTABILITY.md` (shipped as `MIGRATION.md`) |
| The evidence | `docs/release/TEST-RESULTS.md`, `game/verification/` |
| What is still open | `docs/release/REMAINING-ISSUES.md` |
| If it breaks | `docs/release/RECOVERY.md` |
| Licences | `docs/release/LICENCES.md`, `game/LICENCE-REPORT.md` |
| The 3D design | `minimax-game/platformer-docs/DESIGN-3-MASTER.md` (§11.2 records all 15 review rounds) |
| How this change set was reviewed | `docs/review/README.md` and the three briefs beside it |

---

## 15. A note on how these figures were produced

Every number in this report was produced by running a command in this session.
Where a figure could not be measured on this machine — the ARM build, the
real-GPU frame rate — it is listed as **BLOCKED** rather than estimated.

Three Cursor senior review rounds were run over the change set. They found
**4 MAJOR** and **8 MINOR** defects in my own work, including four
false-certificate holes in the gate I had just written. Every one was fixed and
re-verified, and the master's published figures are **measured at build time
by `tools/build_master.py`**, never typed — so the document cannot claim a
number the gate did not produce. That is the same rule the package has
followed since its eleventh review round, and this report follows it too: if a
figure is not in here, it was not measured.
