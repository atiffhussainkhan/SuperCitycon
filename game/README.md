# SuperCitycon

A retro 16-bit-palette voxel city builder for the browser. Three.js + Vite,
ES modules, no TypeScript.

Every piece of 3D art and animation comes from the user's own asset library.
Nothing is generated, redrawn or substituted.

---

## Run it

```bash
cd game
npm install
npm run dev      # http://localhost:5173
```

## Build it

```bash
cd game
npm run build           # -> game/dist  (local build: includes the 2D art)
npm run build:cleared   # -> game/dist  (shippable: the unverified 2D art is stripped)
npm run preview         # http://localhost:4173  (serves dist/)
```

Both builds write `dist/LICENCE-STATUS.md`, which states exactly which asset
sets are in the bundle and their licence state. See `LICENCE-REPORT.md`.

The build ships **only the runtime assets** — the 128 `.glb` models, the 30
animated characters, the 2D HUD icons and the 2D icon manifest — as static
files. The raw library archives (`public/assets/*.zip`) and the 428 MB
`extracted/` trees are source material for the asset curator and are
deliberately **not** copied into `dist/`. The build logs what it produced and
**fails** if `dist/index.html` references a file that is not on disk:

```
[build] verified 1 referenced file(s) in dist/index.html — all present.
[build] licence policy: LOCAL (2D art included, unverified)
[dist] 290 files, 73.2 MB total
[dist] by extension: .glb 117 (69.8 MB), .bin 41 (1.5 MB), .js 4 (1.1 MB), ...
```

A **cleared** build prints `[build] licence policy: CLEARED (2D art stripped)` and
produces 219 files. The cleared build's gate asserts that BOTH
`dist/assets/ui/` and `dist/assets/ui-assets.json` are gone and **throws** if
either survives, so a "shippable" bundle can never carry the unverified art by
accident.

The game must be served from the **root** of a host: the model and icon paths
in the manifests are absolute (`/assets/models/...`, `/assets/ui/...`).

## Test it

```bash
cd game
npm run check                # node --check over every source file
npm test                     # every unit + integration test
node --test tests/integration.test.mjs   # the cross-domain contract test
```

**Last verified run:**

| Gate | Command | Result |
|---|---|---|
| Parse | `npm run check` | **56/56 files parse cleanly** |
| Unit + integration | `node --test src/*/*.test.mjs tests/*.test.mjs` | **395/395 pass, 0 fail** |
| Production build | `npm run build` | 290 files, 73.2 MB, entry verified |
| Shippable build | `npm run build:cleared` | 219 files, the unverified art gone |
| Browser harness (production) | `node tools/scenario.mjs http://127.0.0.1:4321/ /tmp/sc-prod5` | **40/40 checks passed** |
| Browser harness (cleared) | `node tools/scenario.mjs http://127.0.0.1:4321/ /tmp/sc-cleared2` | **40/41, 1 skipped** (the 2D-art check — intended without the art) |
| **Real browser window** | `node tools/headed.mjs http://127.0.0.1:4321/` | ready in **2.5 s**, WebGL live, **0 console / 0 page / 0 failed requests** |
| Packaged bundle | unzip `supercitycon-build.zip`, serve `game/dist` | boot complete, **0 errors** |

`tools/headed.mjs` opens a **visible** browser window on the real GPU (not the
software-GL headless harness), reports every console error and failed request,
captures a screenshot, and leaves the window open for you to play in.

### The acceptance test is the browser harness

`tools/scenario.mjs` (workspace root) drives the **real** game in a headless
browser: it boots the page, builds a city, plays the simulation, drives the
pointer, reads the framebuffer back and looks for the HUD art. A green unit
suite is not evidence that the assembled game runs.

```bash
cd <workspace root>
node tools/scenario.mjs http://localhost:5177/ /tmp/sc-dev    # dev server
node tools/scenario.mjs http://localhost:4173/ /tmp/sc-prod   # production build
```

Both runs must pass. **A production run that fails where the dev run passes
is the most important finding there is** — the difference is always an asset
path, a manifest or a chunk that only resolves in one of the two.

To build, serve and verify the production bundle in one step:

```bash
cd game
npm run verify:production    # build -> preview -> scenario -> report
```

`game/tools/verify-production.mjs` builds, reports the `dist/` breakdown,
starts `vite preview` on port 4173, runs the acceptance harness against it and
exits with the harness's verdict.

`tools/shoot.mjs` captures a single screenshot plus the console log:

```bash
cd <workspace root>
node tools/shoot.mjs http://localhost:5177/ /tmp/shot.png 12000 1600 1000
```

---

## The five master bots

The game was assembled by five agents working in parallel, each owning a
disjoint slice of the source tree:

| Bot | Owns | Delivers |
|---|---|---|
| `sc-world-content` | `src/world/`, `src/buildings/`, `src/data/` | terrain, water, nature scatter, the 95-entry building catalogue, placement rules, library-model integration |
| `sc-simulation` | `src/economy/`, `src/mobility/`, `src/population/`, `src/services/` | treasury and budget cycle, road network and traffic, citizens and happiness, service coverage |
| `sc-interface` | `src/ui/`, `src/studio/` | the HUD, the camera rig, the tools, the building shop, the SCC Studio voxel editor |
| `sc-asset-curator` | `game/src/data/`, `game/public/assets/` | the 3D manifest, the curated 2D art and its manifest, licence texts |
| `sc-integration` | `src/main.js`, `src/core/`, `src/render/`, the build, the harnesses | the bootstrap, the frame loop, the input dispatch, the cross-domain wiring, the build, and the acceptance harness |

`src/core/CONTRACT.md` is the binding contract between them: it defines the
shared `ctx`, the event bus, the asset and renderer services, and the exact
public API of every domain. Nobody changes another domain's public API.

---

## Architecture

```
src/
  main.js            bootstrap, frame loop, input dispatch, the placement gate
  core/
    config.js        constants: GRID, CELL, PALETTE, TUNING, MODES, TOOLS
    events.js        the event bus + EVENTS constants
    state.js         the single mutable state tree + snapshot/restore
    CONTRACT.md      the binding integration contract for all ten domains
    stage.js         CORE  — stage definitions, goals, progression
    save.js          CORE  — save/load, localStorage slots, export/import
    modes.js         CORE  — play / scenario / sandbox / editor
  world/             WLD   — heightfield, terrain mesh, water, nature scatter
  mobility/          MOB   — road network, traffic simulation, transit
  economy/           ECO   — treasury, costs, income, budget, construction slots
  population/        POP   — citizens, happiness, loyalty, migration
  services/          SRV   — coverage maths, facilities, demand
  buildings/         BLD   — catalogue, property schema, placement
  studio/            STD   — SCC Studio voxel editor, workshop
  ui/                UX    — HUD, panels, camera rig, controls
  render/            TEC   — renderer, assets, materials, sky, performance
  audio/             TEC   — procedural WebAudio (the library has no audio)
  data/manifest.json generated by tools/build_manifest.py
```

One grid cell = **4 world units**, 64 × 64 cells. World origin `(0, 0)` is the
centre of the grid. Use `config.cellToWorld` / `config.worldToCellInt`, never
arithmetic.

### The integrator's wiring

`src/main.js` owns the things no single domain can own:

- **the frame loop** — wall-clock `update(dt)` for every domain, game-time
  `tick(dt)` for every domain, paused-aware;
- **the input dispatch** — pointer and keyboard → a grid cell → every
  domain's `onHover` / `onClick`;
- **the placement gate** — a thin coordinator that puts the economy's
  `canPlace(def, level)` check (money **and** construction slots,
  FR-ECO-120/121) in front of every `buildings.place()` call, and turns a
  refusal into a toast instead of a silent no-op;
- **the load relay** — after a save is loaded, the domains that hold a 3D view
  of the loaded state rebuild it, so a loaded city is not an empty map.

### The honesty rule

Any number the publisher never published lives in `TUNING`
(`src/core/config.js`) marked `TBD:` and is read from there. Domain modules
never inline a guess.

---

## Art provenance and licence position

### The 3D models — cleared to ship

Every model in `game/public/assets/models/` came from a pack in
`~/.minimax/asset-library/packs/`. All four packs are CC0-1.0 or MIT, so they
are safe to ship and redistribute.

| Family | Pack | Licence | Author | What it supplies |
|---|---|---|---|---|
| `citybits` | KayKit City Builder Bits | CC0-1.0 | Kay Lousberg | buildings A–H, roads, junctions, crossings, traffic lights, street lights, cars, bench, hydrant, dumpster, water tower |
| `props` | Holokat Game Assets | MIT | Holokat / OpenGameArt | residential, shops, office, market, factory, warehouse, clinic, fire, park, museum, power plants, transit, water supply |
| `nature` | Avramania Nature & Terrain | CC0-1.0 | Avramania | trees, saplings, bushes, grass, flowers, rocks, cliffs, riverbed, kerb, paths, stepping stones |
| `characters` | KayKit Adventurers + KayKit Character Animations 1.2 | CC0-1.0 | Kay Lousberg | Knight, Mage, Rogue, Rogue_Hooded, Barbarian, KayKit_AnimatedCharacter_v1.2 — rigged, 76 / 30 animation clips each |

Licence texts are copied verbatim into `game/public/assets/LICENSES/`.

### The 2D icons — NOT cleared to publish

The asset curator curated **82 2D images** for the HUD and published them as
`game/public/assets/ui-assets.json` + `game/public/assets/ui/*.png`. The HUD
loads that manifest at runtime and applies the icons by `slot`; the acceptance
harness proves every icon file resolves with HTTP 200.

**Every one of those 82 records carries `licence_status: unverified`.** The
library's 2D image packs have not been licence-cleared. The icons are therefore
fine to *display* while building and testing, and **not fine to publish** —
so publication is a deliberate act:

| Command | Result |
|---|---|
| `npm run build` | a LOCAL build that contains the 2D art and says so |
| `npm run build:cleared` | the SHIPPABLE build: the 2D art is **stripped** from `dist/` |

Either way the build writes `dist/LICENCE-STATUS.md`. The HUD shows
`82 ICON(S) FROM ASSET LIBRARY — LICENCE CLEARANCE PENDING.` whenever the art
is loaded — an unverified image is never presented as cleared.

**The cleared build loses no function.** The HUD is complete and correct with
zero 2D images (every icon slot falls back to CSS); the acceptance harness
asserts it. This is a **legal** gate, not a code gate — see `LICENCE-REPORT.md`
for what the owner has to do.

### The 3D manifest

`game/src/data/manifest.json` is **generated**, not hand-written:

```bash
cd .. && python3 tools/build_manifest.py
```

The generator parses every glTF/GLB, walks the scene graph, computes the exact
world-space bounding box, and emits per model: file path, licence, source bbox,
world footprint, height, uniform scale, ground y-offset, footprint centre and
grid-cell span. It fails loudly if any model cannot be measured.

### Scale policy

Models are **not** individually normalised to the grid cell — the kits are
internally consistent (a car is authored to fit a lane, a street light against
a building) and per-model normalisation destroys those ratios. Each family
gets one uniform scale:

| Family | Scale | Why |
|---|---|---|
| `citybits` | 2.00 | the 2.02u tile becomes exactly the 4.00u grid cell |
| `props` | 1.00 | a 4.5u house fills one cell; an 8u market spans 2×2 |
| `nature` | 1.10 | a 4.3u oak becomes ~4.8u, taller than a 3.3u house |
| `characters` | 0.60 | a 2.47u knight becomes ~1.48u — a human next to houses |

---

## What is not finished

This is the honest list. Everything here is a real gap, not a wish list.

### 1. The 2D icon licence pass — blocks publication
The 82 HUD images are `licence_status: unverified`. **Owner: the publisher.**
Nothing else blocks a release faster. Until it is done, publish with
`npm run build:cleared`. See `LICENCE-REPORT.md`.

### 2. One construction slot, and no way to earn another
`state.economy.constructionSlots.total` starts at **1** and no catalogue entry
has `grantsConstructionSlot: true`, so the player can only ever have one
building under construction. `trn.monorail_station` asks for **two** slots, so
it can never be built at all. The gate is enforced (that was the point of the
integrator's placement gate), which makes this balance problem visible instead
of hidden. **Owner: `sc-simulation` (ECO).** Proposed `TUNING` keys:
`constructionSlotsTotal` (≥ 3) and `constructionMinutesByCategory`.

### 3. The x15 / x16 bonus ceiling is unresolved
The recovered dev-blog text says the six bonuses "together can scale up to
x15"; six independently capped 250 % bonuses sum to 1500 %, which under an
additive reading is x16. `TUNING.bonusCeiling` is **15** and is applied as a
ceiling on the additive reading, so the headline is x15 and the x16 arithmetic
is visible in the code. The publisher's value was never published. **Owner:
the publisher** (dossier OQ-POP-09).

### 4. The wealth-curve base level is derived, not published
`population/happiness.js` derives `L0 = 0.2` from the published anchor
(wealth level 1.65 → 129 %) instead of guessing it, and marks it `TBD`.
Proposed `TUNING` key: `wealthBaseLevel`. **Owner: the publisher** (OQ-POP-05).

### 5. The demand-bar MODEL is a design decision
The bar SEMANTICS are published (FR-ECO-061/062: unmet demand, fuller = more
needed). The INPUTS are not, so ECO's model — the resident count as the demand
proxy for all three sectors — is authored, and every bar is marked `assumed`
in the HUD. **Owner: the publisher** (dossier OQ-ECO-*).

### 6. Known rough edges
- The 3D models are placed on the terrain, but the terrain mesh and the model
  bases use slightly different height sampling, so a model can sit a fraction
  of a unit off the ground on steep slopes.
- The camera pitch clamp lives in the UX camera rig; the integrator's old
  `setPitch` was removed after the two fought over radians and degrees.
- `npm test` used to run `node --test tests/`, which Node 22 treats as a
  module path and fails on. It is now `node --test` (auto-discovery).
- The headless browser uses software GL, so the acceptance harness runs at a
  fraction of a frame per second. The harness drives the simulation through
  `SUPERCITYCON.step(dt)` (a fixed step) rather than waiting on wall-clock
  frames — low headless FPS is an environment artefact, not a game defect.

---

The spec this build implements is `docs/SUPER-CITYCON-MASTER-REQUIREMENTS.md`
with the ten per-domain documents in `docs/requirements/`.
The integration defects and the senior-review findings are logged in
`game/DEFECTS.md`; the licence position is in `game/LICENCE-REPORT.md`.
