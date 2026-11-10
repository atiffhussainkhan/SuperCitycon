# SuperCitycon V7 — Architecture

**Baseline analysed:** V6 at `ecc30fc4c25ebb3b0cb9dd2b1a261dee3df99c7d`
**Branch:** `development/v7`

This document describes the architecture **as it actually is**, and the V7
changes as they actually land. Every file path and every API named here was
read from the source; nothing is aspirational.

---

## 1. The shape of the system

SuperCitycon is a **modular monolith**: one browser page, one ES-module
bundle, ten domain services that share one context object and one state tree.

```
                    ┌──────────────────────────────────────────┐
                    │                  main.js                  │
                    │   the integrator: composition root only    │
                    └──────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
  ┌───────────┐               ┌────────────┐               ┌────────────┐
  │   CORE    │               │  ctx.state │               │  ctx.bus   │
  │ stage     │               │ the single │               │ the event  │
  │ save      │               │ live tree  │               │ bus        │
  │ modes     │               └────────────┘               └────────────┘
  └───────────┘                     ▲                             ▲
        │                           │                             │
        │        ┌──────────────────┴──────────────────┐          │
        │        │                                     │          │
        ▼        ▼                                     ▼          ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  DOMAINS                                                           │
  │  wld · buildings · economy · mobility · population · services       │
  │  studio · ui · content · hazards                                    │
  └─────────────────────────────────────────────────────────────────────┘
        │                                    │
        ▼                                    ▼
  ┌──────────────┐                   ┌──────────────┐
  │ ctx.renderer │                   │  ctx.assets  │
  │ three.js     │                   │ the manifest │
  └──────────────┘                   └──────────────┘
```

**The load-bearing decisions**, all of which V7 keeps:

1. **One state tree.** `ctx.state` is a getter over one live tree. A save
   load replaces the tree, and `liveStateProxy(ctx)` / `liveSubtree(ctx, key)`
   keep a stable identity across that replacement so no domain keeps reading
   an orphaned tree.
2. **One event bus.** `ctx.bus` carries domain events. It is the only
   cross-domain channel that does not run through the state tree.
3. **One folder per domain.** A domain owns its files; CORE owns the shared
   rules. The rules are stated in `game/src/core/CONTRACT.md`, which is
   binding.
4. **The integrator owns the seams.** `main.js` owns `src/main.js`,
   `core/config.js`, `core/events.js`, `core/state.js`, `core/CONTRACT.md`,
   `render/renderer.js`, `render/assets.js`, `data/manifest.json` and
   `index.html`. Nothing else writes them.
5. **Rules are pure.** A module that holds a rule imports no `three` and
   touches no DOM, so it is unit-testable in Node with no browser. This is
   the property that makes the 770-test suite possible.

---

## 2. What the analysis found

### 2.1 The input stack has one owner per device

| Device | Owner | Where |
|---|---|---|
| Keyboard (menus) | UX | `ui/menu.js` — root + window `keydown` |
| Keyboard (camera) | UX | `ui/camera.js` — window `keydown`, a held-key set |
| Keyboard (HUD) | UX | `ui/hud.js` — root + window `keydown` |
| Mouse | the integrator | `main.js` `installInput()` — pointer events on the canvas |
| Gamepad | UX | `ui/gamepad.js` — polls `navigator.getGamepads()` per frame |

V6 added the gamepad row. **There was no touch row** — the canvas listens to
pointer events only, and a touch device's finger produces a pointer event
with `pointerType: 'touch'`, which the click path treats exactly like a
mouse: no drag-pan of the camera, no pinch-zoom, and a fat-finger tap that
places a building.

### 2.2 The citizens do not navigate

`population/citizens.js` `buildPath(from, to)` returns **three points**: the
start, the midpoint plus a random lateral offset, and the destination. The
path has no knowledge of the terrain, the water or the buildings. A citizen
therefore walks in a straight line through a warehouse and, on `high-water`,
through the flood.

The seeded RNG makes the *offset* reproducible, but the path is not a
navigation result — it is a decorative jitter.

### 2.3 The content validator cannot prove its own levels

`content/validate.js` emits, for every level:

```
INFO  level.not-checked: Reachability beyond the declared progression links is
      not proven by this validator; it cannot tell whether the terrain allows
      a route to the exit.
```

That note is honest, and it is the correct thing for a validator to say when
it cannot check something. But it means **no automated check in the project
knows whether a level can actually be completed.** The note is the gap V7
closes.

### 2.4 A held key keeps panning the camera under the menu

`ui/camera.js`:

```js
function onKeyDown(e) {
  if (ctx?.ui?.menu?.isOpen?.()) return;   // <- returns early
  ...
  if (dir) { keys.add(dir); e.preventDefault?.(); }
}
```

The early return stops a *new* key from being added, but the `keys` set is
never cleared when the menu opens. A key held when the menu opens therefore
keeps panning the camera behind the menu until the player releases it.
V6 fixed exactly this class of bug for the **gamepad** (the camera is
released while a modal has the focus) and left the keyboard path with it.

### 2.5 The studio already has undo/redo

`studio/voxels.js` exports `createHistory(depth)`, and `studio/index.js`
exposes `undo()` / `redo()`. **Undo/redo is not a V7 gap** — the directive
lists it as a candidate, and the audit says it is already there. V7 does not
re-implement it.

---

## 3. The V7 architecture

### 3.1 Where the new code goes

```
game/src/core/navigation.js      NEW  pure: the grid pathfinder + the obstacle model
game/src/core/navigation.test.mjs NEW the unit suite
game/src/core/touch.js           NEW  pure: the gesture recogniser
game/src/core/touch.test.mjs     NEW  the unit suite
game/src/ui/touch.js             NEW  the browser half: gestures -> camera + world
game/src/ui/touch.test.mjs       NEW  the unit suite
game/src/ui/navigation-debug.js  NEW  the navigation debug panel (V7.1)
game/src/ui/navigation-debug.test.mjs NEW its unit suite
game/src/population/citizens.js  CHANGED  follow the pathfinder's path; the budget
game/src/population/index.js     CHANGED  forward the path-search counters
game/src/ui/camera.js            CHANGED  release the held keys; the shake table
game/src/core/input-map.js       CHANGED  padLabel(), padRebind(), resetPadAction()
game/src/core/settings.js        CHANGED  the input.padBindings setting
game/src/ui/settings-panel.js    CHANGED  the pad capture screen
game/src/content/validate.js     CHANGED  prove reachability
game/tools/validate-content.mjs  CHANGED  report the proof
tools/scenario-v7.mjs            NEW  the browser acceptance scenario
tools/profile-city.mjs           NEW  the city-scene frame profiler
tools/secret-scan.mjs            NEW  the secret scan
tools/package-game-release.mjs   NEW  the reproducible release package
tools/run-v7-verification.sh     NEW  the whole battery as one command
```

**The V7.1 round kept the same shape.** The touch hover, the path budget and
the pad capture are all in the layer that owns the behaviour — UX for the
hover and the capture, POP for the budget, CORE for the rules. Nothing was
pushed into a domain that does not own it, and no domain was made to know
about another's internals: the path-search counters travel from the citizens'
service, through the POP domain, to the page — one hop each.

**Why CORE owns the rules.** A pathfinder and a gesture recogniser are both
*rules*, not presentation. Putting them in CORE is what makes them
unit-testable in Node without a browser, and it keeps the domains honest:
the population domain asks CORE for a path, and the UX layer asks CORE to
recognise a gesture. Neither domain reimplements either.

**Why the obstacle model is derived, not stored.** A second copy of the city
would go stale the moment a building was placed. The pathfinder is given a
*cost function* over the live tree instead, so a new building changes the
routes with no extra bookkeeping.

### 3.2 The navigation module

```js
// game/src/core/navigation.js
export const NAV_BUDGET = 4096;

export function createGrid({ size, isBlocked, cost }) { ... }
export function findPath(grid, from, to, opts = {}) { ... }
export function smoothPath(path, isBlocked) { ... }
```

- **The grid** is a *view* over the world, not a copy of it: `isBlocked(x, z)`
  and `cost(x, z)` are callbacks into the live state.
- **The search** is A\* with the octile heuristic — admissible, so the first
  path found is optimal for the cost model.
- **The determinism** comes from a fixed neighbour order and a tie-break on
  the insertion counter, never from a random value. The same inputs always
  give the same path.
- **The budget** caps the visited set. When it is hit the search returns the
  best path found so far with `reason: 'budget'`, and `null` with
  `reason: 'unreachable'` when the goal is enclosed.
- **The smoothing** removes the collinear interior points, so a citizen
  walks a straight line where the world allows it.

### 3.3 The touch module

```js
// game/src/core/touch.js
export function createGestureRecogniser({ tapMs, doubleTapMs, longPressMs, movePx })
  → { pointerDown(e), pointerMove(e), pointerUp(e), pointerCancel(e), reset() }
```

The recogniser emits **gestures**, not events: `tap`, `double-tap`,
`long-press`, `drag` (with a velocity) and `pinch` (with a scale and a
rotation). The thresholds are in **milliseconds and pixels**, so the same
physical gesture produces the same result at 30 Hz and at 144 Hz.

`ui/touch.js` maps the gestures onto what the game already has:

| Gesture | Action |
|---|---|
| one-finger drag | pan the camera (the same `panRelative` the keyboard uses) |
| two-finger pinch | zoom the camera |
| two-finger drag | rotate the camera |
| tap | select the cell under the finger, through the same domain dispatch as a mouse click |

### 3.4 The camera's modal gate

The camera already knows whether the menu has the focus. V7 extends that
from "ignore new keys" to "release what is held":

```js
// on every frame
if (menuOwnsFocus) keys.clear();
```

That is one line, and it is the same rule the gamepad path already follows.

### 3.5 The reachability proof

The validator gains a check that asks the pathfinder a real question:

> Is there a walkable route from the level's spawn to every required
> objective and every checkpoint?

The verdict is one of three, and it is never a guess:

| Verdict | Meaning |
|---|---|
| `reachable` | the pathfinder found a route |
| `unreachable` | the search exhausted the space without finding one |
| `unknown` | the search hit its budget — **not** the same as reachable |

A level with an unreachable objective becomes an **error**, which is what
makes the check worth having.

---

## 4. Data flow for a V7 citizen

```
  population/citizens.js
        │  spawn({ from, to })
        ▼
  core/navigation.js  findPath(grid, from, to)
        │  grid.isBlocked / grid.cost  →  the LIVE state
        │  ← path (cells), cost, visited, reason
        ▼
  citizens.js  converts the cell path to world points, smooths it
        │
        ▼
  stepCitizen()  walks it, facing the direction of travel
        │
        ▼
  renderer — the existing model, unchanged
```

---

## 5. What V7 does NOT change

| | |
|---|---|
| The **save schema** | still version 2 |
| The **domain layout** | one folder per domain |
| The **state tree** | one live tree, one ownership rule per subtree |
| The **event bus** | the only cross-domain channel |
| The **renderer** | the same public API; V7 adds no geometry |
| The **cleared build** | the same shippable target, the same licence policy |
| The **V5 and V6 acceptance scenarios** | untouched |
| The **input map** | the keyboard and gamepad tables are unchanged |

---

## 6. Testability

| Module | How it is tested |
|---|---|
| `core/navigation.js` | 20+ unit tests in Node — no browser, no `three` |
| `core/touch.js` | 20+ unit tests in Node — synthetic pointer streams |
| `ui/touch.js` | unit tests with a fake camera and a fake world |
| `population/citizens.js` | the existing suite plus the V7 navigation tests |
| `content/validate.js` | the existing suite plus the reachability tests |
| the whole thing | `tools/scenario-v7.mjs` drives the built game in Chromium with synthetic touch events |

---

## 7. Diagrams

### 7.1 The V7 input stack

```
      keyboard                mouse                  gamepad                touch
         │                      │                       │                     │
         ▼                      ▼                       ▼                     ▼
   ui/camera.js         main.js installInput()   ui/gamepad.js          ui/touch.js
   ui/menu.js                │                       │                     │
   ui/hud.js                 │                       │                     │
         │                    │                       │                     │
         └────────────────────┴───────────┬───────────┴─────────────────────┘
                                          │
                        ┌─────────────────┴──────────────────┐
                        │  camera rig  ·  menu  ·  world    │
                        │  (the one owner per behaviour)    │
                        └────────────────────────────────────┘
```

### 7.2 The V7 navigation search

```
   findPath(grid, from, to)
        │
        ├─ open = [from]           visited = { from }
        ├─ while open is not empty and visited.size < budget:
        │     ├─ take the node with the lowest f = g + h   (fixed order → deterministic)
        │     ├─ if it is the goal → build the path, return { ok: true }
        │     ├─ for each neighbour in the FIXED order:
        │     │     ├─ if it is blocked → skip
        │     │     ├─ if it is visited → skip
        │     │     └─ push it with g + cost(n) and h = octile(n, goal)
        ├─ open ran dry        → { ok: false, reason: 'unreachable' }
        └─ budget ran out      → { ok: false, reason: 'budget', path: best-so-far }
```
