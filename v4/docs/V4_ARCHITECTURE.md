# MiniMax Game Studio Ultra V4 — Architecture

This document describes how V4 is put together: the module map, the data flow
between the editor and the runtime, the contracts between the parts, and the
decisions that shaped them.

## 1. Shape of the system

V4 is a **web application** built on Three.js. It is a new app under `v4/`;
it does not modify the V2 city-builder in `game/` and it is not the
design-only `minimax-game/` package.

```
v4/
├── index.html              the shell: one mount point, an inline favicon
├── src/
│   ├── main.js             the integration point — builds every system and
│   │                       runs the one frame loop
│   ├── core/               engine core (no DOM, no Three.js)
│   │   ├── ecs.js          entities, components, tags, queries
│   │   ├── transform.js    local transform + lazy world matrices
│   │   ├── events.js       the event bus and its history
│   │   ├── serialization.js component registry + JSON-safe scene documents
│   │   ├── scene.js        scene manager + storage adapters
│   │   ├── project.js      project lifecycle (create / open / save / export)
│   │   ├── time.js         fixed-step clock + frame profiler
│   │   └── log.js          logging and global error capture
│   ├── render/             Three.js facade + the GLTF asset loader
│   ├── input/              action-based input bindings
│   ├── physics/            deterministic boxes and spheres
│   ├── anim/               animation state machine (mixer + cross-fades)
│   ├── audio/              Web Audio mixer
│   ├── editor/             the 3D world editor
│   ├── npc/                behaviours, A* pathfinding, debug overlay
│   ├── gameplay/           character controller, interaction, HUD, …
│   ├── levels/             the demo village
│   ├── assets/             asset library, integrity, safe export
│   └── ai/                 offline developer tooling
├── scripts/                verification harnesses
├── tools/                  command-line developer tools
├── tests/                  the automated test suite
└── docs/                   these documents
```

**51 source files, 12,149 lines.**

## 2. The central decision: one world, two modes

The editor and the runtime do **not** own separate scenes. There is one ECS
world, one Three.js scene, and one frame loop. Pressing **Play** switches
the *same* scene from edit mode to simulation mode.

That is what makes "edit what you play" true rather than aspirational: a
prop dragged in the editor is the prop the player walks into.

The mode is owned by the **editor** (it has the Play/Edit buttons and the
`Ctrl/Cmd+P` shortcut). The editor announces a change on the bus
(`mode:changed`), and the app subscribes. Before that subscription existed,
clicking Play did nothing at all — the simulation stayed frozen while the
toolbar said "Play". That was a real bug, found by the acceptance harness.

```
editor.setMode('play')
      │
      └─ bus.emit('mode:changed', {mode:'play'})
                 │
                 └─ main.js subscribes → v4.mode = 'play'
                          │
                          └─ simulate(dt) runs: physics → controller →
                             interaction → NPC → animators
```

## 3. The ECS

Small on purpose. Entities are ids; components are plain objects stored per
type; systems are functions the host calls each frame.

```js
const world = createWorld();
const player = world.createEntity({ name: 'Player', tags: ['player'] });
world.addComponent(player.id, 'transform', createTransform({ position: [0, 0.9, 6] }));
```

**Queries match a tag *or* a component type.** `world.query('npc')` finds
every entity that is tagged `npc` *or* carries an `npc` component. This keeps
one vocabulary for the editor's hierarchy filtering and for the runtime's
systems. Multiple filters are ANDed: `query('npc', 'transform')` means "an
NPC that also has a transform".

Entity ids are **per world**, not per module. Two worlds in one process must
not share a counter, or a scene loaded into a fresh world would come back
with ids that no longer match the ones it was saved with.

## 4. Transforms

A transform holds a local position, an XYZ euler rotation, a scale, a parent
link and a list of children. World matrices are computed lazily: the matrix
is recomputed only when the transform is dirty, and a change on a parent
marks its whole subtree dirty.

The rotation convention is **three.js Euler 'XYZ'** (roll, then pitch, then
yaw) — the same composite the editor's gizmo writes back. The matrix
composition in `transform.js` was verified element-for-element against
`THREE.Matrix4.makeRotationFromEuler`.

Matrix elements below `1e-12` are snapped to an exact zero. A rotation of
exactly a quarter turn produces `cos(π/2) = 6.1e-17`, and that dust leaked
into equality checks and into "is this transform changed?" comparisons.

## 5. The save format

A scene document is plain JSON:

```json
{
  "format": "v4-scene", "version": 1, "name": "Untitled", "createdAt": "…",
  "entities": [
    { "id": 11, "name": "Player", "tags": ["player"],
      "components": { "transform": { "position": [0,0.9,6], "rotation": [0,0,0],
                                     "scale": [1,1,1], "parent": null, "children": [] } } }
  ]
}
```

Three rules make it safe and useful:

1. **The hierarchy is stored as entity ids.** A parent link and a child link
   point at each other; copying the objects would make the document cyclic
   and `JSON.stringify` would throw. `serializeScene` maps every transform
   to its owning entity id, and `deserializeScene` rebuilds the object links
   on load.
2. **Runtime handles are never saved.** An animation controller holds a
   Three.js `AnimationMixer` and a whole skinned mesh graph. The registry
   gives the `animation` component an explicit serialiser that keeps the
   state description and drops the handle; the generic fallback
   (`toPlainData`) drops functions and class instances and marks a genuine
   cycle as `[circular]`.
3. **A failed write is not swallowed.** The localStorage adapter used to
   catch its own `JSON.stringify` failure, so a save that could not be
   written looked like it had succeeded. It now propagates the error.

Because rule 2 drops every callback, a load has to put the behaviour back.
The level owns the handles and rebuilds them:

| Rebuilt on load | By | Why |
|---|---|---|
| Animation controllers | `level.rebindAnimators()` | The mixer is a runtime handle; the clips are still in memory |
| Interaction callbacks | `level.rebindInteractions()` | `onInteract` is a function; it can never be in the document |
| 3D object transforms | `level.applyScene(doc)` | The meshes live in the level; the document holds only their transforms |

Without the middle row a reloaded world is **inert**: the interaction system
still finds the target and still shows its prompt, but pressing E does
nothing. That is exactly the failure the acceptance harness now guards.

`toPlainData` tracks the *current path* rather than everything it has seen,
so a value shared by two siblings is copied twice and only a value that
contains itself is reported as a cycle.

## 6. Rendering

The engine never touches WebGL directly. It talks to a facade
(`src/render/renderer.js`) that owns the Three.js renderer, the camera, the
quality preset and the measured counters. A different backend could be
dropped behind the same interface; today it is Three.js, because the
project already ships with it and it is a mature, well-understood engine.
No custom renderer was written.

The facade exposes the **real** GPU identity through
`WEBGL_debug_renderer_info` and flags software renderers
(SwiftShader, llvmpipe) explicitly. The profiling script refuses to publish
a "GPU" figure when that flag is set — the headless number and the real
number are never mixed.

The camera rig has two modes. In **play** it follows the player; in **edit**
the editor owns the camera (orbit, pan, zoom, frame-selection) and the app
does not touch it. Two systems writing the same transform fought each other
and produced a NaN camera matrix, which is why the editor viewport rendered
only the background colour.

## 7. Physics

Deterministic boxes and spheres on a fixed step: gravity, a ground plane,
static colliders, and a ray query for editor picking.

Static colliders are resolved along the **axis of least penetration** — the
nearest exit. A character that walks into a wall is stopped at the wall; a
character that hits a corner slides along it. Low colliders (below the step
height) are stepped onto instead.

Bodies are resolved per axis with their **own** extents. An earlier version
used the vertical half-extent for the horizontal overlap tests too, so a
wide, flat body passed through walls that it was obviously touching.

Kinematic bodies — the player — are driven by the character controller and
resolved by the physics world. They are not integrated twice.

## 8. Animation

Three.js' `AnimationMixer` does the interpolation; `src/anim/animator.js`
adds the things a game needs on top of it:

- a **state machine** (idle / walk / run / jump / land / attack / interact)
  with named conditions,
- **cross-fade** blending between states,
- **animation events** — timed clip markers fired through the event bus,
- a per-entity controller that can be rebuilt after a scene load.

Transition conditions are a small boolean language over the named
conditions: `moving`, `!moving`, `sprinting && moving`. The expression is
*evaluated*; it is not looked up as a literal key. (Looking it up as a key
meant `!sprinting && moving` could never fire.)

The clips are real: the KayKit animated character ships 30 clips, the
KayKit Barbarian / Knight / Mage / Rogue ship 76 each, and the Quaternius
citizens ship their own set. The demo level drives the player's 30-clip
controller and gives every NPC a controller driven by its behaviour state.

## 9. NPCs

A finite-state machine per NPC over the states `idle`, `patrol`, `chase`,
`return`, `interact`. Each state has `enter` / `update` / `exit`. The
machine owns the transitions and announces them on the bus.

Pathfinding is **A\*** on a uniform XZ grid, 8-way, with an octile
heuristic and a binary min-heap open list. Two details matter:

- **Corner-cutting is forbidden.** A diagonal step is only legal when both
  orthogonal neighbours are free.
- **The search has a hard expansion budget** (default 8000). A path that
  cannot be found reports `budget-exceeded` instead of burning the frame.

An update **budget** (default 8 NPCs per frame) is enforced by a
round-robin cursor, so a crowd cannot stall the frame. Verified: 12 NPCs
with a budget of 3 update exactly 3 per frame, and all 12 within 4 frames.

The demo level's four NPCs behave differently on purpose: a barista who
stands and is not alertable, a courier who patrols, a guard who chases the
player and a drifter who wanders.

## 10. The editor

Seven modules behind one public API:

```js
const editor = createEditor({ world, bus, registry, sceneManager, renderer, input, logger, canvas });
// update(dt, now) · setMode('edit'|'play') · selection · select(ids)
// duplicate() · undo() · redo() · save() · load() · validate() · dispose()
```

- **hierarchy.js** — the entity tree, with click and shift-click selection
  and drag-and-drop re-parenting.
- **inspector.js** — name, tags, parent and every component field. Edits
  write straight through to the world and push an undo command.
- **viewport.js** — orbit / pan / zoom, raycast picking, the grid, selection
  outlines, collider boxes and the inset preview camera.
- **gizmos.js** — move / rotate / scale with snapping, applied as a
  **world-matrix delta about the pivot** so scaling does not fling the object
  away from the origin.
- **undo.js** — the command stack. Its deep copy follows the hierarchy
  cycle safely and drops runtime handles, so a duplicated animated entity
  does not carry a dead controller.
- **validation.js** — five categories of scene problems.

**Runtime handles are never edited.** A value that is a class instance, or a
plain object carrying functions, is shown read-only. The alternative was
disastrous: the inspector tried to JSON-render the player's animation
controller — a whole skinned mesh graph — and **crashed the browser tab**.

## 11. The asset pipeline

`scripts/prepare-assets.mjs` copies the cleared 3D models from the V2 tree
into `v4/public/assets/models` and verifies **every file by sha256**. It
copies the licence texts alongside them. It never copies the quarantined
2D art.

The **catalogue** in `src/render/asset-loader.js` is the single list of what
may be loaded, with the licence and author of each entry. One entry
(`props.house` → `props/House.glb`) pointed at a file that does not exist in
the shipped pack — found by the asset audit, now corrected to the file that
does (`props/Warehouse.glb`).

The **asset library** (`src/assets/`) answers the questions a project needs
answered: what is in the project, what is broken, what is duplicated, what
may be exported. The exporter refuses quarantined entries by design, and
that refusal is covered by a test.

## 12. AI-assisted development

Everything in `src/ai/` is **offline and deterministic**: the same input
always produces the same output, and nothing leaves the machine.

- `generators.js` — starter projects, scenes, components, animation
  controllers, NPC behaviours and tests. The generated code is real,
  importable ES module code; one generated project was written to a
  temporary directory and **executed**.
- `error-explainer.js` — pattern-matches the failures V4 actually produces
  and explains them in plain words. When nothing matches it says so: a
  wrong confident answer is worse than an honest "unknown".
- `analyzers.js` — unused-asset detection, build-error review, refactor
  suggestions.
- `checklist.js` — a development checklist per phase.
- `llm.js` — an **optional** LLM adapter. It is **disabled by default**,
  reads its endpoint and key from the environment (`V4_LLM_ENDPOINT`,
  `V4_LLM_KEY`), hardcodes no key or URL, never logs the key, and every
  call falls back to the deterministic path when no provider is configured.
  No provider was authorised for this release, so only the fallback path has
  been exercised.

## 13. The frame loop

One loop, in `src/main.js`:

```
clock.tick(now)          →  fixed steps, or one slow frame
  └─ simulate(dt)        →  physics → controller → interaction → NPC →
                             NPC animation conditions → animators
pause.update()           →  read OUTSIDE the simulation (a paused clock
                             stops the fixed steps, so the pause key would
                             never be read and the game could not resume)
editor.update(dt, now)   →  editor panels, camera, gizmos
level.syncTransforms()   →  entity transforms → meshes
sceneManager.update(now) →  fade transitions
camera                   →  follow rig in play mode; the editor owns it in edit
renderer.render()        →  the measured frame
profiler.endFrame()      →  fps, frame time, draw calls, triangles
hud.update(state)        →  the live readout
```

The simulation runs on a **fixed 1/60 s step** with a bounded number of
sub-steps, so the same inputs always produce the same result. The HUD is
updated in both modes: in edit mode it reports the frame cost and the
entity count.

**One key press must trigger exactly one action.** The clock catches up with
several fixed steps in a single slow frame, and every one of those steps
would otherwise read the same key-down edge: one press of `E` would interact
five times and one press of `Escape` would toggle the pause five times. The
first step consumes the edges (`Input.consumeEdges()`); the remaining steps
see the key as *held*, not as *pressed*, which is what they should see.

## 14. Verification

Four kinds of check, each with a different purpose:

| Kind | What it proves | Where |
|---|---|---|
| Unit | The core's behaviour in isolation | `tests/*.test.mjs` — 149 tests |
| Syntax | Every file parses | `tools/check-syntax.mjs` — 56/56 |
| Acceptance | The real slice works in a real browser | `scripts/launch-slice.mjs` — 28 checks |
| Performance | The real GPU is measured, not assumed | `scripts/gpu-profile.mjs` |

Plus two diagnostics that exist because a real defect needed explaining:
`scripts/diagnose-boot.mjs` (why did the app not reach ready?) and
`scripts/probe-edit-camera.mjs` (why was the viewport empty?). Both print
the measured state rather than a guess.
