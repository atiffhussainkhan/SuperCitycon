# CURSOR-HANDOFF — WLD domain (world / terrain / water / grid)

**Status: AWAITING CURSOR REVIEW.** The `cursor agent` headless reviewer could not run in
this environment. Every attempt failed before any file could be read:

```
$ /Applications/Cursor.app/Contents/Resources/app/bin/cursor agent --print --trust --mode ask "<prompt>"
... Task Observer startup has not run in this session ...
$ bash /Users/mac/.claude/hooks/task-observer-workspace-init.sh     # ran OK, but the
                                                                    # agent's own session
                                                                    # still blocks reads
$ /Applications/Cursor.app/Contents/Resources/app/bin/cursor agent --print --trust "<prompt>"
ActionRequiredError: Increase limits for faster responses You're out of usage.
                        Switch to Auto, or ask your admin to increase your limit to continue.
$ /Applications/Cursor.app/Contents/Resources/app/bin/cursor agent models
ActionRequiredError: ... You're out of usage. ...
```

Two independent blockers: a session-scoped local hook and an **account usage quota**.
Neither can be fixed from inside this session. Re-run the review once the quota is lifted:

```
/Applications/Cursor.app/Contents/Resources/app/bin/cursor agent --print --trust \
  "$(cat game/src/world/CURSOR-HANDOFF.md | sed -n '/^## PROMPT/,$p')"
```

There is **no git patch**: neither `workspace/` nor `workspace/game/` is a git repository
(`fatal: not a git repository`). The deliverable is the six new files listed below — all of
them are new, so a patch is equivalent to the file list plus the contents.

---

## FILES (all new, absolute paths)

| File | Lines | Role |
|---|---|---|
| `/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace/game/src/world/heightfield.js` | 501 | Pure terrain model. **No `three` import.** |
| `/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace/game/src/world/water.js` | 243 | Pure flood model + the water surface mesh. |
| `/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace/game/src/world/terrain.js` | 419 | The merged terrain mesh (Three.js). |
| `/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace/game/src/world/scatter.js` | 429 | Deterministic placement of library models. |
| `/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace/game/src/world/index.js` | 279 | `createWorld(ctx)` domain service. |
| `/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace/game/src/world/world.test.mjs` | 483 | `node:test` unit + integration tests. |

Nothing outside `game/src/world/` was created or modified.

---

## PROMPT

You are a senior developer reviewing a new game-domain module in the SuperCitycon project.

REPO ROOT: /Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace
GAME ROOT:  <repo>/game
FILES UNDER REVIEW (all NEW, written by the WLD domain agent):
  <repo>/game/src/world/heightfield.js   — pure terrain model (no `three` import)
  <repo>/game/src/world/water.js         — pure flood model + the water surface mesh
  <repo>/game/src/world/terrain.js       — the merged terrain mesh (Three.js)
  <repo>/game/src/world/scatter.js       — deterministic placement of library models
  <repo>/game/src/world/index.js         — createWorld(ctx) domain service
  <repo>/game/src/world/world.test.mjs   — node:test unit tests

SETUP (if a local "task observer" hook blocks reads):
  bash /Users/mac/.claude/hooks/task-observer-workspace-init.sh
REVIEW RULES: do not modify/create/delete any file in the repository; do not run
`npm run build`; do not start a dev server.

READ FIRST (binding contract):
  <repo>/game/src/core/CONTRACT.md   (integration contract; section 7 fixes the WLD public API)
  <repo>/game/src/core/config.js     (GRID/CELL/WORLD/PALETTE/TUNING/TOOLS/makeRng)
  <repo>/game/src/core/state.js      (the WLD domain owns state.world)
  <repo>/game/src/data/manifest.json (the ONLY source of models)
  <repo>/docs/requirements/02-world-terrain-water-grid.md (the WLD spec: FR-WLD-*, NFR-WLD-*, QA-WLD-*)

WHAT WAS ASKED FOR
The WLD domain had to implement the Must-priority world/terrain/water/grid requirements:
seeded landmass generation with a coastline, surface-type classification, water level +
depth + connected water bodies, a fast merged voxel-ish terrain mesh (one BufferGeometry with
per-vertex colours, top quad per cell plus side skirts where neighbours differ), a translucent
water surface, deterministic scattering of real library nature models, and terraforming
(raise/lower) that updates state.world and emits EVENTS.TERRAIN_CHANGED.
The service object must expose EXACTLY:
  init, update, tick, generate(seed), heightAt(cx,cz), setHeight(cx,cz,h), typeAt(cx,cz),
  waterLevel(), isWater(cx,cz), buildMesh(), scatter(seed), placeNature(cx,cz,modelKey),
  terraform(cx,cz,delta), dispose   + onClick(cell, button) and onHover(cell).

HARD CONSTRAINTS THE CODE MUST RESPECT
- Only files under game/src/world/ may be created or modified.
- heightfield.js and the pure part of water.js must NOT import `three`.
- Every decorative model must be a real key from manifest.json (family `nature`, plus the
  citybits props bush/bench/watertower). Never invent a key.
- Publisher-unknown numbers must be marked `// TBD:` and proposed as TUNING additions,
  not silently hard-coded.

VERIFICATION ALREADY RUN (real output)
  $ node --check src/world/heightfield.js && node --check src/world/terrain.js && \
    node --check src/world/water.js && node --check src/world/scatter.js && \
    node --check src/world/index.js
  ALL SYNTAX OK
  $ node --test src/world/world.test.mjs
  # tests 17
  # pass 17
  # fail 0
  (17 node:test cases: determinism, water fraction, height range, interpolation, type
  classification, slope, terraform raise/lower/clamp/out-of-bounds, water depth, flood fill,
  water bodies, smoothing, scatter manifest validity + determinism + spacing, terrain mesh
  geometry, partial mesh refresh, and a full createWorld integration test.)

MEASURED NUMBERS
- water fraction: 737/4096 = 0.179932 (TUNING.waterFraction = 0.18)
- surface-type histogram: water 737 (17.99%), sand 649 (15.84%), rock 759 (18.53%),
  grass 1143 (27.91%), forest 500 (12.21%), dirt 308 (7.52%)
- terrain mesh: 81,920 vertices, 40,960 triangles (16,128 of them degenerate zero-area
  skirts), 8,320 cliff faces, one draw call; full build ~210-270 ms, partial cell refresh
  0.6-12.6 ms
- water mesh: 4,225 vertices / 8,192 triangles, one translucent plane with per-vertex depth tint
- scatter: 873 placements, 188 trees, 31 distinct manifest models, min tree spacing 2 cells
- all 128 manifest model files resolve on disk under game/public/assets/models/

KNOWN ISSUES / NOT VERIFIED HERE
- No browser was available in this environment, so nothing was visually verified: the
  terrain colours, the water ripple shader (MeshLambertMaterial + onBeforeCompile), and the
  ~873 individual prop draw calls have NOT been seen on screen.
- Scatter props are one Object3D each (~873 draw calls); InstancedMesh batching is a
  known follow-up.
- Terrain rebuilds are throttled to 250 ms and patch only the dirty cells in place.

YOUR JOB
Act as a senior developer and analyst. Review the five source files against the contract
and the WLD spec and report REAL DEFECTS, prioritised, with file:line references:
1. Correctness bugs (heightmap maths, water level/quantile logic, flood fill, type
   classification, slope, terrain mesh vertex layout / winding / normals / wall ownership,
   partial refresh correctness, water mesh depth tint).
2. Contract violations (wrong public API shape, writing outside state.world, importing three
   where forbidden, referencing model keys that are not in manifest.json).
3. Determinism / replay problems (FR-WLD-035, FR-WLD-039, NFR-WLD-007).
4. Performance risks against NFR-WLD-002/003/004.
5. Edge cases from section 8 of the spec that are mishandled (E1-E14, E28).
6. Anything that would break the integrator's main.js boot path.

Do not rewrite the module. Report findings as a prioritised list. Be concrete and cite
file:line. If you find nothing in a category, say so explicitly. You may run read-only
commands (node --check, node --test, grep) to verify your claims.
