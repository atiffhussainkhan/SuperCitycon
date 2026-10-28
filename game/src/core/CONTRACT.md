# SuperCitycon — Domain Contract v1

**This file is the integration contract. Every domain agent codes against it exactly.**
If you need behaviour that is not here, add it *inside your own module* and
export it — do not change another module's public API and do not change this
file. The integrator owns `src/main.js`, `src/core/config.js`,
`src/core/events.js`, `src/core/state.js`, `src/render/renderer.js`,
`src/render/assets.js`, `src/data/manifest.json` and `index.html`.

---

## 0. Ground rules

1. **You own exactly one folder.** Never write a file outside it. The
   integrator (or another agent) owns everything else. If you need a change
   elsewhere, report it in your final message instead of making it.
2. **Every model you place must come from `src/data/manifest.json`.** Keys are
   the manifest's `models` / `characters` maps. There are exactly three model
   families and six characters:
   - `citybits` — KayKit City Builder Bits (CC0-1.0). Buildings A–H, roads,
     traffic lights, street lights, cars, bench, hydrant, dumpster, watertower.
   - `props` — Holokat Game Assets (MIT). Residential, shops, office, market,
     factory, warehouse, clinic, fire, park, museum, utility, water, waste,
     power plants, transit, water supply.
   - `nature` — Avramania Nature & Terrain (CC0-1.0). Trees, rocks, cliffs,
     grass, flowers, bushes, water-adjacent pieces.
   - characters — `Knight`, `Mage`, `Rogue`, `Rogue_Hooded`, `Barbarian`,
     `KayKit_AnimatedCharacter_v1.2`.
   **Never hard-code a file path. Never invent a model that is not in the
   manifest.**
3. **Never generate, redraw or substitute art.** If the manifest has no
   suitable model, report that in your final message and use the closest
   genuine library model (or omit the feature) — do not fabricate geometry.
4. **Honesty discipline.** Any number the publisher never published must live
   in `TUNING` (`src/core/config.js`) and be read from there. Do not inline a
   guess like `0.15` in your code — if it is a magic number that affects
   gameplay, add it to `TUNING` via a clearly-marked proposal in your final
   message, or read the closest existing `TUNING` key.
5. **Pure logic vs. view.** Split your module where you can:
   - `xxx/logic.js` — pure functions, **must not import `three`**. These can be
     unit-tested with `node --test`.
   - `xxx/view.js` — Three.js code.
   Keep the domain's public surface identical either way.

   **The pure rule modules of this project** — these carry the game rules and
   must never import `three` (verified by `tests/integration.test.mjs`):

   | Domain | Pure rule modules |
   |---|---|
   | CORE | `core/config.js`, `core/events.js`, `core/state.js`, `core/modes.js`, `core/save.js`, `core/stage.js` |
   | BLD  | `buildings/catalogue.js`, `buildings/properties.js`, `buildings/placement.js` |
   | ECO  | `economy/logic.js` |
   | MOB  | `mobility/network.js`, `mobility/traffic.js` |
   | POP  | `population/happiness.js` |
   | SRV  | `services/coverage.js`, `services/services.js` |
   | STD  | `studio/voxels.js` |
   | UX   | `ui/panels.js`, `ui/toasts.js`, `ui/camera.js` |
   | WLD  | `world/heightfield.js` |

   The **view** modules — these may import `three`: `render/*`,
   `world/terrain.js`, `world/water.js`, `population/citizens.js`,
   `studio/editor.js`, `audio/audio.js`, `main.js`.

   A domain's `index.js` is the *service* layer: it wires the rules to the
   view and may therefore reach a view module (for example `buildings/index.js`
   imports `render/renderer.js` for `cellCenter`). The RULES stay in the pure
   modules above, and the pure modules are where the unit tests live.
6. **Module format.** ES modules (`import` / `export`). `package.json` has
   `"type": "module"`. Node 22 is available for syntax checks and tests.
7. **Verification you must actually run before reporting done:**
   - `node --check <file>` for every file you wrote (syntax).
   - `node --test tests/<your-domain>.test.mjs` for pure logic (write the test
     file inside your own folder: `<your-folder>/<your-domain>.test.mjs`).
   - Paste the **actual output** of those commands into your final message.
     Never claim a test passed that you did not run.

---

## 1. The shared context object (`ctx`)

`main.js` creates one `ctx` and passes it to every domain factory.

```js
ctx = {
  state,          // live state object (core/state.js) — mutate only YOUR subtree
  bus,            // { on, off, once, emit } from core/events.js
  assets,         // asset service, see §3
  renderer,       // renderer service, see §4
  config,         // { CELL, GRID, WORLD, PALETTE, TUNING, SPEED, MODES, TOOLS, makeRng, ... }
  manifest,       // the parsed src/data/manifest.json
  rng,            // seeded PRNG function: rng() -> 0..1
  domains,        // Map/obj of sibling domains — populated AFTER all create() calls
  ui,             // UX service, may be undefined during early boot
}
```

`ctx.domains` is assigned by `main.js` **after** every `create(ctx)` returns.
Your factory must therefore not call siblings during `create()` — read
`ctx.domains.x` lazily inside `update()`/`tick()` instead.

### Domain factory shape

Every domain exports a factory that returns a service object:

```js
export function createMyDomain(ctx) {
  return {
    // optional async warm-up (load models etc.)
    async init() {},
    // per-frame update, seconds; called every frame by main.js
    update(dt) {},
    // per-simulation-step tick, seconds of *game* time (paused -> 0)
    tick(dt) {},
    // optional: called when the player picks up the mouse over a cell
    onHover(cell) {},
    // optional: called when the player clicks a cell with the current tool
    onClick(cell, button) {},
    // optional: called when a tool is selected
    setTool(tool) {},
    dispose() {},
    // ... your domain's own public API
  };
}
```

`update(dt)` is wall-clock time (drives animation/camera smoothing).
`tick(dt)` is *game* time (drives economy, population, traffic); `main.js`
calls it with `dt * speed` and skips it while paused.

---

## 2. Event bus

Use the `EVENTS` constants from `src/core/events.js`. Emit on meaningful
changes only — do not emit every frame.

```js
import { EVENTS } from '../core/events.js';
ctx.bus.emit(EVENTS.BUILDING_PLACED, { id, type, x, z });
```

---

## 3. Asset service (`ctx.assets`)

```js
await ctx.assets.loadModel(key)        // -> THREE.Object3D (clone) | null
await ctx.assets.loadCharacter(key)    // -> { model, clips[] } | null
ctx.assets.getModel(key)               // -> clone of an already-loaded model | null
ctx.assets.getCharacter(key)           // -> clone | null
ctx.assets.preload(keys, onProgress)   // -> { loaded, total, failures[] }
ctx.assets.isReady()
ctx.assets.manifest                    // the manifest object
```

A loaded model is already scaled and ground-aligned by the asset service:
its lowest point sits at `y = 0` and its footprint is already in world units.
To place a model on cell `(cx, cz)`:

```js
const m = await ctx.assets.loadModel('building_A');
const rec = ctx.assets.manifest.models.building_A;   // footprint, height, centerXZ
const c = cellCenter(cx, cz);        // from render/renderer.js
m.position.set(
  c.x - rec.centerXZ[0],
  0,
  c.z - rec.centerXZ[1],
);
```

(`centerXZ` is the offset from the model origin to the centre of its
footprint, so subtracting it centres the model on its cell.)

---

## 4. Renderer service (`ctx.renderer`)

```js
ctx.renderer.scene, .camera, .renderer, .clock
ctx.renderer.world     // Group — static world content
ctx.renderer.actors    // Group — moving entities (cars, citizens)
ctx.renderer.overlay   // Group — ghost previews, selection highlights
ctx.renderer.add(obj)  // -> world
ctx.renderer.remove(obj)
ctx.renderer.clearWorld()
ctx.renderer.screenToGround(clientX, clientY)  // -> {x,z} | null
ctx.renderer.screenToObjects(clientX, clientY, objects) // -> hit | null
ctx.renderer.focusOn(x, z)
ctx.renderer.setDistance(d) / .getDistance()
ctx.renderer.setYaw(r) / .rotateYaw(d) / .getYaw()
ctx.renderer.setPitch(deg)
ctx.renderer.update(dt)
ctx.renderer.resize()
```

Also exported from `src/render/renderer.js`:
`cellCenter(cx, cz, y)` and `cellCenterF(cx, cz, y)` return `THREE.Vector3`.

---

## 5. Grid & world

```js
config.CELL          // 4 world units per cell
config.GRID.size     // 64 cells per side
config.WORLD         // { width, depth, originX, originZ }
cellToWorld(cx, cz, y)   // -> {x,y,z}
worldToCell(x, z)        // -> fractional {x,z}
worldToCellInt(x, z)     // -> integer {x,z}
inBounds(cx, cz)
cellKey(cx, cz)          // integer key (core/state.js)
parseCellKey(key)
```

`state.world.heightmap` is a `Float32Array(GRID.size * GRID.size)` of terrain
heights in world units (0 = sea level). `state.world.types` is a
`Uint8Array` of terrain type ids. `state.world.water` is a `Float32Array` of
water depth.

---

## 6. State subtrees (ownership)

| Subtree | Owner | Notes |
|---|---|---|
| `state.meta` | integrator + CORE | seed, mode, stage, day, tick, speed, paused, score |
| `state.world` | WLD | heightmap, water, types, scenery |
| `state.economy` | ECO | treasury, budget, ledger, revenue, expenditure |
| `state.population` | POP | total, happiness, loyalty, households, citizens |
| `state.services` | SRV | coverage maps, cityCoverage, facilities |
| `state.mobility` | MOB | network, vehicles, congestion, routes |
| `state.buildings` | BLD | instances, zones, catalogue |
| `state.studio` | STD | voxels, doc, palette, brush |
| `state.ui` | UX | tool, hover, selection, panel, camera, toasts |

---

## 7. Per-domain public API

Each domain's exact exported names. `main.js` calls these, so they are binding.

### CORE — `src/core/stage.js`, `src/core/save.js`, `src/core/modes.js`
```js
// stage.js
export const STAGES;                       // [{id,name,desc,goals:[{id,label,target,check(state)}]}]
export function getStage(id);
export function currentStage(state);
export function evaluateStage(state) -> {stageId, goals:[{id,label,current,target,met}], allMet}
export function advanceStage(state) -> boolean;
export function stageProgress(state) -> 0..1;
// save.js
export function serialize(state) -> string;
export function deserialize(json) -> state;
export function saveToStorage(state, slot) -> boolean;
export function loadFromStorage(slot) -> state|null;
export function listSaves() -> [{slot,name,date,stage}];
export function deleteSave(slot) -> boolean;
// modes.js
export function startMode(mode, opts) -> boolean;
export function canSwitchMode(mode) -> boolean;
export function availableModes() -> [mode];
```

### WLD — `src/world/`
```js
export function createWorld(ctx) -> { init, update, tick, generate(seed), heightAt(cx,cz),
  setHeight(cx,cz,h), typeAt(cx,cz), waterLevel(), isWater(cx,cz), buildMesh(), scatter(seed),
  placeNature(cx,cz,key), terraform(cx,cz,delta), dispose }
export function generateHeightmap(seed, size) -> Float32Array;
export function terrainTypeAt(hf, cx, cz) -> 'water'|'sand'|'grass'|'rock'|'forest';
```

### MOB — `src/mobility/`
```js
export function createMobility(ctx) -> { init, update, tick, rebuildNetwork(), roadAt(cx,cz),
  addRoad(cx,cz), removeRoad(cx,cz), vehicleCount(), congestion(), averageCommute(),
  setDensity(n), dispose }
```

### ECO — `src/economy/`
```js
export function createEconomy(ctx) -> { init, update, tick, treasury(), canAfford(cost),
  spend(amount, reason), earn(amount, reason), monthlyIncome(), monthlyUpkeep(),
  applyBudget(map), budget(), dispose }
```

### POP — `src/population/`
```js
export function createPopulation(ctx) -> { init, update, tick, population(), happiness(),
  loyalty(), households(), addCitizens(n), removeCitizens(n), happinessBreakdown(),
  spawnCitizen(), despawnCitizen(), citizenCount(), dispose }
```

### SRV — `src/services/`
```js
export function createServices(ctx) -> { init, update, tick, coverageFor(serviceId, cx, cz),
  cityCoverage(serviceId), availability(serviceId) -> {capacity, demand, served},
  unmetDemand(serviceId), registerFacility(f), dispose }
```

### BLD — `src/buildings/`
```js
export function createBuildings(ctx) -> { init, update, tick, catalogue, instances,
  place(typeId, cx, cz, rot) -> {ok, reason, id}, remove(cx, cz) -> {ok, reason},
  buildingAt(cx, cz), canPlace(typeId, cx, cz) -> {ok, reason}, upgrade(cx, cz),
  occupancy(cx, cz), countByType(typeId), dispose };
export { BUILDING_DEFS } from './catalogue.js';   // the data table
```

### STD — `src/studio/`
```js
export function createStudio(ctx) -> { init, update, tick, open(), close(), isOpen(),
  voxels, paint(x,y,z,color), erase(x,y,z), brushSize(), setBrush(n),
  saveWorkshop(), loadWorkshop(), exportOBJ(), dispose }
```

### UX — `src/ui/`
```js
export function createUI(ctx) -> { init, update, mount(el), unmount(), setTool(tool),
  setSelection(sel), showToast(msg, kind), openPanel(id), closePanel(), panel(),
  camera: { focus(x,z), zoomTo(d), rotate(delta), reset() },
  hoverCell, dispose };
export { HUD_STYLES } from './styles.js';
```

### TEC — `src/render/`, `src/audio/`
```js
// render/renderer.js  (already implemented in the spine — extend, keep API)
export function createRenderer(container);
// render/assets.js    (already implemented in the spine — extend, keep API)
export function loadModel(key); export function loadCharacter(key);
export function preload(keys, onProgress);
// render/materials.js  (new)
export function createMaterials(); export function voxelMaterial(color);
// render/sky.js        (new)
export function createSky(scene);
// audio/audio.js       (new)
export function createAudio(ctx) -> { play(name), stop(name), setMuted(b), isMuted(), unlock() };
```

---

## 8. Deliverable per agent

Your final message must contain:

1. The list of files you created (absolute paths).
2. The exact commands you ran and their **real output** (syntax check, tests).
3. Any manifest key you wished existed but could not find.
4. Any `TUNING` value you propose adding, with the reason.
5. Anything you could not verify in this environment.

Do not describe work you did not do. Do not claim a test passed that you did
not run.
