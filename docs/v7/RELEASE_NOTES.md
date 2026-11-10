# SuperCitycon — V7 Release Notes

**Release:** SuperCitycon **7.0.0**
**Branch:** `development/v7`
**Baseline:** V6 at `ecc30fc4c25ebb3b0cb9dd2b1a261dee3df99c7d`
**Target platform:** Web (Chromium verified)
**Build command:** `npm ci && npm run build:cleared`
**Save schema:** version **2** — unchanged from V5
**Release status:** see [`FINAL_VERIFICATION.md`](FINAL_VERIFICATION.md)

---

## 1. The release identity

| Field | Value |
|---|---|
| **Product** | SuperCitycon — a retro 16-bit-palette voxel city builder for the browser |
| **Version** | **7.0.0** |
| **Version source** | `game/package.json`, `game/package-lock.json` (the root and `packages[""]`), and the build-identity fallback in `game/src/core/log.js` (`7.0.0-dev`) |
| **Build identity** | `game/vite.config.js` stamps `VITE_BUILD_VERSION` from `package.json` — the bundle carries `7.0.0` |
| **Baseline revision** | `ecc30fc` (the V6 release) |
| **Engine** | Three.js 0.169.0 |
| **Bundler** | Vite 7.3.7 |
| **Runtime** | ES modules in the browser; no framework; no native build |
| **Target platform** | Web — Chromium verified. Firefox, Safari, Windows, Linux and ARM **not** tested (see [`PLATFORM_COMPATIBILITY.md`](PLATFORM_COMPATIBILITY.md)) |
| **Build command** | `cd game && npm ci && npm run build:cleared` |
| **Build result** | 218 files, 72.7 MB, licence policy **CLEARED** |
| **Package checksum** | written beside the package as `supercitycon-7.0.0-cleared.tar.gz.sha256`, with a SHA-256 per file in `MANIFEST.sha256` |
| **Test summary** | **835 unit tests, 835 pass, 0 fail** · 91/91 files parse cleanly · the content validator: 3 levels, 0 errors, 0 warnings · the V5 acceptance scenario 40/41 (1 correctly skipped) · the V6 gamepad scenario 19/19 · the **V7 scenario 10/10** · `npm audit` 0 vulnerabilities · the secret scan 0 findings |
| **Performance** | the navigation search: median 0.202 ms, **p95 1.350 ms** against a 2 ms budget · the frame rate: 60 fps, unchanged from V6 |
| **Known blockers** | none code-level. Four environment limitations are named in [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) |
| **Release status** | **V7 RELEASE CANDIDATE** — see [`FINAL_VERIFICATION.md`](FINAL_VERIFICATION.md) §10 |

## 2. What shipped in V7

### 2.1 The citizens finally walk

**This is the headline.** V6's citizens walked in a straight line from A to
B — the path was `from → midpoint + a random offset → to`, with no knowledge
of the terrain, the water or the buildings. A citizen walked through a
warehouse, and on `high-water` through the flood.

V7 gives them a real route:

- a **grid A\*** over the 64 × 64 city grid, with the octile heuristic, so
  the first route found is the cheapest one;
- an obstacle model that is a **view over the live city**, not a copy of it:
  water blocks, buildings block, a slope costs more — and a building placed
  a moment ago changes the routes immediately;
- a **deterministic** search: the same world always gives the same path;
- a **node budget**, so a walled-off destination returns the best path found
  so far instead of stalling the frame;
- **path smoothing**, so a citizen walks a straight line where the city
  allows it.

The measured cost: a median of **0.202 ms** and a 95th percentile of
**1.350 ms** per search, against a 2 ms budget.

### 2.2 The game works on a phone

V6 had no touch support at all. Now:

- a **one-finger drag pans the city**, a **pinch zooms it**, a **two-finger
  drag rotates it**, and a **tap selects the cell** — through the same
  dispatcher the mouse uses;
- the gesture rules are **pure and frame-rate independent**: the same
  physical gesture produces the same gesture at 30 Hz and at 144 Hz;
- the HUD respects the **safe areas** of a notched device and **reflows on a
  narrow viewport**;
- a **drag never places a building**, and a tap places exactly one.

### 2.3 The content pipeline proves its own levels

V5 and V6 said: *"Reachability beyond the declared progression links is not
proven by this validator."* V7 **proves** it — it generates the level's
terrain from its own seed, with the world's own functions, and asks the
pathfinder whether a route exists to every exit, checkpoint and collectible.

An unreachable target is now an **error**. The three shipped levels are all
proven: **3/3, 5/5 and 7/7** targets reachable.

### 2.4 A camera that stops when a dialog opens

A movement key held as the menu opened kept panning the camera behind the
menu, because the key handler returns early but the held-key set was never
cleared. The gamepad path already had that rule; the keyboard now has it
too. The regression test **fails on the V6 baseline** and passes on V7.

### 2.5 The toolchain

- `tools/secret-scan.mjs` — scans the tree and the bundle for
  credential-shaped values. It is verified against a planted secret, and it
  does not flag a placeholder.
- `tools/profile-navigation.mjs` — measures the new hot path on a quiet
  machine, where the parallel test suite cannot.
- `tools/scenario-v7.mjs` — the V7 browser acceptance scenario.

## 3. What V7 did NOT change

| | |
|---|---|
| **The save schema** | it stays at **version 2**. A V5 or a V6 city opens in V7 exactly as it was. |
| **The V5 and V6 acceptance scenarios** | untouched, and both still pass against the V7 build. |
| **The studio editor** | its undo / redo already existed; V7 did not rebuild it. |
| **The domain layout** | one folder per domain; `core/CONTRACT.md` is unchanged. |
| **The dependencies** | `three` and nothing else. |
| **The cleared build target** | `npm run build:cleared` is still the shippable target. |
| **The 2D art quarantine** | unchanged — none of it ships. |

## 4. How to reproduce every number

```bash
git clone <repo> && cd SuperCitycon
git checkout development/v7
cd game
npm ci
npm test                       # 835 tests, 835 pass
npm run check                  # 91/91 source files parse cleanly
node tools/validate-content.mjs
node --test ../tools/performance-gpu.test.mjs
npm audit                      # 0 vulnerabilities
npm run build:cleared          # 218 files, CLEARED
npm run preview                # http://localhost:4173

cd ..
node tools/secret-scan.mjs
node tools/profile-navigation.mjs
node tools/scenario.mjs         http://localhost:4173/ /tmp/sc-v5 v5-acceptance
node tools/scenario-gamepad.mjs http://localhost:4173/ /tmp/sc-pad v6-gamepad
node tools/scenario-v7.mjs      http://localhost:4173/ /tmp/sc-v7 v7
```
