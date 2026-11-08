# MiniMax Game Studio Ultra V4 — Developer Guide

Everything needed to run, build, test and extend V4.

---

## 1. Quick start

```sh
cd v4-worktree/v4        # the V4 app root
npm install               # or: npm ci  (the lockfile is committed)
npm run dev               # the editor + the demo village, with hot reload
```

Open the URL Vite prints (by default `http://localhost:5173`).

The **Play** button in the toolbar starts the simulation. The **?** button
lists every keyboard shortcut.

### The production build

```sh
npm run build             # runs prepare-assets, then vite build
npm run preview           # serves dist/ on http://localhost:4180
```

`npm run build` also re-runs the asset pipeline, which copies the cleared
3D models and verifies every file by sha256.

### The scripts

| Script | What it does |
|---|---|
| `npm run dev` | The Vite dev server |
| `npm run build` | The asset pipeline + the production build |
| `npm run preview` | Serves the production build on port 4180 |
| `npm test` | The 149-test suite |
| `npm run check` | Parses every source file (`node --check`) |
| `npm run slice` | The 28-check browser acceptance run + screenshots |
| `npm run prepare-assets` | Copies and verifies the cleared 3D models |

---

## 2. The acceptance run — the most useful command

```sh
npm run slice
```

It starts the built app in a preview server, drives it in a real browser
through the whole vertical slice, and writes:

```
v4/verification/slice/slice-report.json
v4/verification/slice/01-boot.png
v4/verification/slice/01b-inspector.png
v4/verification/slice/02-moved.png
v4/verification/slice/03-interaction.png
v4/verification/slice/04-hud.png
v4/verification/slice/05-final.png
```

The report records every check, its observation and the measured numbers.
**Read the screenshots.** A green harness does not prove the picture is
right.

Options:

```sh
node scripts/launch-slice.mjs --out verification/slice --port 4180
node scripts/launch-slice.mjs --headed        # a real window
node scripts/launch-slice.mjs --url http://127.0.0.1:4180/   # an existing server
```

---

## 3. The performance probe

```sh
npx vite preview --port 4186 --strictPort &
node scripts/gpu-profile.mjs "http://127.0.0.1:4186/" \
  --out verification/gpu --seconds 10 --label v4
```

```
GPU: ANGLE (Intel, ANGLE Metal Renderer: Intel(R) UHD Graphics 630 …)
software renderer: no — hardware
frames: 1016 | 100.8 fps | mean 9.92 ms | median 6.3 ms | p95 15.7 ms
engine: 68.8 fps | 312 draws | 151980 tris
console errors: 0
```

The probe **refuses to publish a figure when the renderer is software**.
That refusal is the point: the headless number is a floor, and it must
never be reported as a GPU measurement.

### The diagnostics

Both exist because a real defect needed explaining, and both print the
measured state rather than a guess:

```sh
node scripts/diagnose-boot.mjs --headed --seconds 14
#   → the console log, the HTTP failures, the world's state, the ready flag

node scripts/probe-edit-camera.mjs
#   → the camera pose, the scene contents, the renderer counters

node scripts/probe-interaction.mjs
#   → every interactive entity, which one is targeted, and what the
#     interaction payload actually carried
```

---

## 4. The developer tools

All offline and deterministic. The same input always produces the same
output, and nothing leaves the machine.

```sh
# What is in the project? What is broken? What may be exported?
node tools/audit-assets.mjs
node tools/audit-assets.mjs --json

# Generate a starter project, scene, component, controller, behaviour or tests
node tools/generate.mjs project --name demo --template platformer --out /tmp/demo
node tools/generate.mjs scene --name level1 --entity "Ground:static" --out /tmp/level1
node tools/generate.mjs component --name Health --out /tmp
node tools/generate.mjs animation --name Hero --out /tmp
node tools/generate.mjs npc --name Guard --out /tmp
node tools/generate.mjs tests --module ecs --out /tmp

# What does this error mean?
node tools/explain-error.mjs --message 'failed to load model "nature.bank"'
node tools/explain-error.mjs --message "boom" --json

# What should I do next?
node tools/checklist.mjs --phase release --name "My Game"
node tools/checklist.mjs --phase scene --json
```

The generator **refuses to write into `v4/src`, `v4/tools`, `v4/tests` or
`v4/data`** — generated code goes somewhere else, so it can never
overwrite the engine by accident.

### The optional LLM adapter

`src/ai/llm.js` can call a provider, but it is **disabled by default** and
no provider was authorised for this release. If you enable it:

```sh
export V4_LLM_ENDPOINT="https://…"    # must be an http(s) URL
export V4_LLM_KEY="…"                  # never hardcoded, never logged
export V4_LLM_MODEL="…"
```

The key is read from the environment, redacted from every log line, and
every call falls back to the deterministic path when the provider is
unavailable. **Do not commit a key.**

---

## 5. The code layout

```
src/core/       the engine core — no DOM, no Three.js, unit-testable
src/render/     the Three.js facade and the GLTF loader
src/input/      the action bindings
src/physics/    deterministic boxes and spheres
src/anim/       the animation state machine
src/audio/      the Web Audio mixer
src/editor/     the 3D world editor
src/npc/        the behaviours and the A* pathfinding
src/gameplay/   the character controller, the interaction, the HUD, …
src/levels/     the demo village
src/assets/     the asset library, the integrity checks, the safe export
src/ai/         the offline developer tooling
src/main.js     the integration point and the frame loop
```

### Conventions

- **The core has no DOM and no Three.js.** Anything in `src/core/` can be
  tested in plain Node, and is.
- **A runtime handle never reaches the save format.** If a component holds
  a live object, give it an explicit serialiser in the registry, or make
  sure the value is plain data. `toPlainData` is the safety net, not the
  design.
- **The editor owns the camera in edit mode; the runtime owns it in play
  mode.** Two systems writing the same transform will fight.
- **Counts and figures are derived, never typed.** If a number can be
  computed, compute it.
- **A dynamic import must be a literal.** `import(path)` with a variable
  is not statically analysable and will not be code-split — the module
  will 404 in the production build. Use a thunk with a literal path.

### Adding a component type

```js
// src/core/serialization.js — inside registerBuiltins()
registry.register('myComponent', {
  defaults: () => ({ value: 0, label: '' }),
  serialize: (d) => ({ value: d.value, label: d.label }),
  deserialize: (r) => ({ value: r.value ?? 0, label: r.label ?? '' }),
});
```

The serialiser is optional — without one, plain data round-trips through
`toPlainData` — but **provide one whenever the component holds anything
that is not plain data**.

### Adding an NPC behaviour

```js
// src/npc/behaviours.js
export const DEMO_BEHAVIOURS = {
  myState: {
    enter(ctx) { /* … */ },
    update(ctx, dt) { /* return true to stay, false to fall through */ },
    exit(ctx) { /* … */ },
  },
};
```

The behaviour machine owns the transitions and announces them on the bus
as `npc:state`.

### Adding a model

1. Put the file in `game/public/assets/models/<pack>/`.
2. Add an entry to `MODEL_CATALOGUE` in `src/render/asset-loader.js` with
   the licence and the author **copied from the shipped licence file**.
3. Re-run `node scripts/prepare-assets.mjs`.
4. `node tools/audit-assets.mjs` must report **0 broken files**.

---

## 6. Testing

```sh
npm test                                  # 149 tests
node --test "tests/*.test.mjs"           # the same, by glob
node --test tests/core-ecs.test.mjs      # one file
```

### The test rules

- A test that fails is fixed, not skipped. **No test in this release is
  skipped, weakened or masked.**
- One test was *corrected* rather than the code: the import-depth
  expectation in `ai-generators.test.mjs` asserted three `../` levels while
  the test's own path arithmetic required four. The code was right; the
  expectation was corrected, and the correction is visible in the test.
- The integration tests in `tests/v4-integration.test.mjs` exist because a
  review found real defects. **When you fix a defect, add the test that
  would have caught it.**

### What an automated test cannot check

The picture. After a change, run `npm run slice` and **look at the
screenshots**.

---

## 7. Assets

```sh
node scripts/prepare-assets.mjs           # copy + sha256-verify
node scripts/prepare-assets.mjs --check   # verify only, change nothing
```

The pipeline copies the **cleared 3D models only**. The 69 2D images are
licence-unverified and are **never copied** — they are quarantined, with
the per-file record in `v4/data/quarantine-2d.json`. The asset exporter
refuses them by design, and that refusal is covered by a test.

If you need to add art, clear it first and update the inventory. Do not
work around the quarantine.

---

## 8. The frame loop

One loop, in `src/main.js`:

```
clock.tick(now)          fixed steps, or one slow frame
  └─ simulate(dt)        physics → controller → interaction → NPC →
                          NPC animation conditions → animators
editor.update(dt, now)   the editor panels, the camera, the gizmos
level.syncTransforms()   the entity transforms → the meshes
sceneManager.update(now) the fade transitions
camera                   follow rig in play mode; the editor owns it in edit
renderer.render()        the measured frame
profiler.endFrame()      fps, frame time, draw calls, triangles
hud.update(state)        the live readout
```

The simulation runs on a **fixed 1/60 s step**, so the same inputs always
produce the same result.

### The inspection surface

`window.__v4` is live in the browser console:

```js
__v4.version            '4.0.0'
__v4.mode               'edit' | 'play'
__v4.setMode('play')    → true
__v4.pause() / resume()
__v4.stats()            { fps, frameMs, drawCalls, triangles, … }
__v4.gpu()              the real GPU identity
__v4.world.entityCount
__v4.editor.selection
__v4.npc.debugState()
__v4.controller.state
__v4.interaction.prompt()
__v4.level.applyScene(doc)
```

---

## 9. The editor's keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl/Cmd + P` | Toggle play / edit mode |
| `Ctrl/Cmd + S` | Save the scene |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Undo redo |
| `Ctrl/Cmd + D` | Duplicate the selection |
| `Ctrl/Cmd + A` | Select everything |
| `W` / `E` / `R` | Move / rotate / scale gizmo |
| `F` | Frame the selection |
| `G` | Toggle the grid |
| `C` | Toggle the collider boxes |
| `Delete` | Delete the selection |
| `?` or `F1` | The shortcut overlay |

**Gameplay keys** (in play mode): `W A S D` to move, `Shift` to sprint,
`Space` to jump, `E` to interact, `I` for the inventory, `Esc` to pause.

---

## 10. The repository layout

V4 lives on its own branch in its own worktree, so it never disturbs the
V2 project:

```
workspace/                  main — the V2 city builder, untouched
workspace/../v4-worktree/   branch v4/studio — the V4 app
```

`main` is at `92c0b37` and the V4 branch at `620f14c`. **Nothing has been
published**, and the live site is untouched.

---

## 11. When something breaks

| Symptom | First thing to do |
|---|---|
| The app does not start | `node scripts/diagnose-boot.mjs --headed --seconds 14` — it prints the console log and the HTTP failures |
| The viewport is empty | `node scripts/probe-edit-camera.mjs` — it prints the camera pose and the scene contents |
| A module is missing in the build | Check that its dynamic import is a **literal** path |
| A save disappears | The storage adapter no longer swallows write failures — read the error |
| The HUD shows `—` | The field names are `animState`, `health {current,max}`, `objective`, `prompt`, `message` |
| A test fails | Fix the code, not the test — unless the test's *expectation* is wrong, and then correct it visibly |
