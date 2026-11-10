# SuperCitycon V7 — Implementation Plan

This is the plan the work followed. It is written in the order the work was
done, with the milestone commits that carry it.

---

## Milestone 1 — the foundation (commit `2031955`)

**Goal:** close the three gaps the audit found, plus the inherited defect.

| Step | Work | Verification |
|---|---|---|
| 1.1 | `core/navigation.js` — the grid A* pathfinder, the obstacle model, the smoothing | 26 unit tests |
| 1.2 | `population/citizens.js` — the citizens follow the real route | 3 unit tests |
| 1.3 | `core/touch.js` — the gesture recogniser | 18 unit tests |
| 1.4 | `ui/touch.js` — the browser half of the touch path | 13 unit tests |
| 1.5 | `ui/camera.js` — the held key is released when a modal takes the focus | 2 unit tests, one of which fails on V6 |
| 1.6 | `content/validate.js` — the reachability proof | 4 unit tests + the CLI |
| 1.7 | `ui/styles.js` — the safe areas and the narrow viewport | the browser scenario |

## Milestone 2 — the release identity (commit `release`)

| Step | Work | Verification |
|---|---|---|
| 2.1 | The product version moves to **7.0.0** in `package.json`, `package-lock.json` and the build-identity fallback | the bundle stamps `7.0.0` |
| 2.2 | The save schema stays at **version 2** | `core/save-compat.test.mjs` unchanged |
| 2.3 | The release notes, the known issues and the final verification | this folder |

## Milestone 3 — the verification (commit `release`)

| Step | Work | Verification |
|---|---|---|
| 3.1 | `tools/scenario-v7.mjs` — the V7 browser scenario | 10/10 checks |
| 3.2 | `tools/secret-scan.mjs` — the secret scan | 274 files, 0 findings; verified against a planted secret |
| 3.3 | `tools/profile-navigation.mjs` — the navigation benchmark | p95 1.350 ms against a 2 ms budget |
| 3.4 | The V5 and V6 acceptance scenarios re-run against the V7 build | 40/41 and 19/19 |
| 3.5 | The GPU profile, before and after | 60 fps in both |
| 3.6 | The release artefacts and the checksums | `docs/v7/FINAL_VERIFICATION.md` |

---

## The order the work was done in, and why

The requirements came first (PART 7), then the architecture (PART 8), then
the implementation (PART 9). That order was not ceremonial: the architecture
document's §2 is the audit's findings, and the requirements' §E lists the
defects that were reproduced **before** anything was changed. Two of the
defects have a test that fails on the V6 baseline — that is what makes them
regression proofs rather than assertions.

The touch work was deliberately split in two:

  - `core/touch.js` holds the RULES (what a gesture means);
  - `ui/touch.js` holds the BINDING (what a gesture does).

The same split the gamepad path uses, and the same reason: the rules are
pure, so every one of them is unit-testable in Node with no browser.

## What was deliberately NOT built

| Item | Why |
|---|---|
| The studio editor's undo / redo | It already exists — `createHistory()` in `studio/voxels.js` and `undo()` / `redo()` in `studio/index.js`. Building it again would have been a fake feature. |
| A native mobile build | It cannot be produced or verified in this environment, and claiming one would be an unverified claim. The touch support makes the WEB build usable on a phone, which is real. |
| A smaller save file | The save format is unchanged on purpose. A V5 or V6 city must open in V7. |
| Gamepad rebinding UI | Not in the V7 scope. The machinery is in place; the capture screen is not. |
