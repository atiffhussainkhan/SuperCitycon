# Release manifest — MiniMax Game Studio ULTRA V2

**Package:** `MINIMAX-GAME-STUDIO-ULTRA-V2`
**Built:** {{BUILD_DATE}} on {{BUILD_HOST}}
**Licence profile:** **CLEARED** — the publishable build, with the 82
licence-unverified 2D images stripped. `DO-NOT-PUBLISH.txt` is **absent**.

| | |
|---|---|
| Files | **{{FILE_COUNT}}** |
| Size | **{{PACKAGE_SIZE}}** |
| Secret scan | **clean** — no credential pattern matched in {{SECRET_SCAN_COUNT}} files |
| Checksums | `SHA256SUMS.txt` — SHA-256 for every file in the package, except the checksum index itself (it cannot contain its own hash) |

---

## 1. How to use this package

### Play it immediately

```bash
cd game
npm ci
npm run preview          # http://localhost:4173
```

Or serve `game/dist/` with any static file server. It **must** be served from
the **root** of a host — the model and icon paths in the manifests are absolute.

### Rebuild it

```bash
cd game
npm ci
npm run build:cleared    # -> game/dist   (the publishable bundle)
```

### Read it

| Document | What it is |
|---|---|
| `OPERATING-GUIDE.md` | how to play — controls, the seven tools, the HUD, saving |
| `MIGRATION.md` | install, dependencies, backup, moving to a new Mac, Apple Silicon |
| `RECOVERY.md` | what to do when something breaks |
| `TEST-RESULTS.md` | every test that was run, and its actual output |
| `PERFORMANCE.md` | measurements, and what they do and do not prove |
| `REMAINING-ISSUES.md` | every open gap, with an owner |
| `LICENCES.md` | dependency and asset licence manifest |
| `game/README.md` | the project's own documentation |
| `game/DEFECTS.md` | the 17 logged defects, each with its reproduction |
| `game/LICENCE-REPORT.md` | the full licence position |
| `docs/dependency-manifest.json` | machine-readable dependency manifest |

---

## 2. What is in the package

```
MINIMAX-GAME-STUDIO-ULTRA-V2/
├── SHA256SUMS.txt              SHA-256 of every file
├── RELEASE-MANIFEST.md         this file
├── TEST-RESULTS.md             every test run, with real output
├── PERFORMANCE.md              measurements
├── REMAINING-ISSUES.md         every open gap
├── MIGRATION.md                install / backup / migrate / Apple Silicon
├── RECOVERY.md                 troubleshooting
├── OPERATING-GUIDE.md          how to play
├── LICENCES.md                 dependency and asset licences
├── README.md                   the project's front page
├── .gitignore
├── game/                       THE GAME
│   ├── src/                    the source (12 modules)
│   ├── tests/                  395 tests + a fake-DOM helper
│   ├── tools/                  check-syntax.mjs, verify-production.mjs
│   ├── public/assets/          the 158 model binaries + the 2D art + licences
│   ├── dist/                   THE BUILT BUNDLE — licence profile: CLEARED
│   ├── package.json, package-lock.json, vite.config.js, index.html
│   └── README.md, DEFECTS.md, LICENCE-REPORT.md, PLAY-GUIDE.md, AGENTS.md
├── minimax-game/               THE 3D DESIGN PACKAGE (LANTERNWAKE)
│   ├── platformer-docs/        8 design documents, the asset inventory, 14 review rounds
│   └── tools/                  9 verification gates and scripts
├── docs/                       the specification dossier + MAC-PORTABILITY.md
│   └── release/                the release documents
├── tools/                      the acceptance harness and the release tooling
└── agents/                     the five master bot definitions
```

### Deliberately excluded, and why

| Excluded | Size | Why |
|---|---|---|
| `game/node_modules/` | 52 MB | reinstalled by `npm ci` |
| `minimax-game/platformer-docs/library-packs/` | 2.4 GB | a cache of a public upstream repository; re-fetchable with the two `fetch-*.sh` scripts. The path **inventory** (10 MB) travels with the package |
| `.git/` | — | history lives in the repository |
| `*.log`, `.DS_Store`, `__pycache__` | — | disposable |
| any credential | — | there are none; the secret scan proves it |

### One deliberate duplication

`game/public/assets/models/` (the source models) and `game/dist/assets/models/`
(the built bundle) both contain the model binaries — about **150 MB** of the
package. This is intentional: the source is needed to rebuild, and the built
bundle is needed to play. If you only want one, drop `game/dist/` and run
`npm run build:cleared` (about 4 seconds).

---

## 3. Verification performed on this package

| Check | Result |
|---|---|
| Syntax — 56 files | **56/56 parse cleanly** |
| Unit + integration — 395 tests, 8 suites | **395 pass, 0 fail, 0 skipped** |
| Acceptance harness — production bundle, headless Chromium | **40/40** |
| Acceptance harness — licence-cleared bundle | **40/41**, 1 correctly skipped |
| Acceptance harness — the live deployment | **40/40** |
| 3D design gates — `verify_design.py` | **0 FAIL, 31 PASS** |
| 3D design gates — `audit_depth.py` | **102/102 requirements implementable** |
| 3D design gates — `verify_devbots.py` | **0 FAIL, 13 PASS** |
| 3D design gates — `fault_inject_hardened.py` | **18/18 hardened checks bite** |
| Reproducible install — `npm ci` | **passes**, suite re-runs green |
| Secret scan | **clean** |

Full detail and the raw outputs: `TEST-RESULTS.md`.

---

## 4. Reproducing this package

```bash
cd game && npm ci && npm run build:cleared
cd .. && node tools/package-release.mjs
```

The packaging script prints every copy, runs the secret scan, writes
`SHA256SUMS.txt`, and **refuses to finish** if the built bundle still contains
`DO-NOT-PUBLISH.txt`.

---

## 5. The one thing to know before publishing

The **live site** was, until this release, being served the **local** build —
the one that contains the 82 licence-unverified 2D images and a file saying
"DO NOT PUBLISH THIS BUNDLE". The deploy workflow has been corrected to build
and assert the cleared profile, but **the live site is corrected the next time
that workflow runs**. See `REMAINING-ISSUES.md` §1.

---

## 6. Integrity

Verify the package against its own manifest:

```bash
cd MINIMAX-GAME-STUDIO-ULTRA-V2
shasum -a 256 -c SHA256SUMS.txt
```

Every file must report `OK`.
