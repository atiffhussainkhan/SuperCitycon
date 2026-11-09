# SuperCitycon — V5 System Architecture

**Document status:** complete (Phase 1 deliverable)
**Applies to:** SuperCitycon V4 → V5
**Branch:** `v5/upgrade`
**Baseline:** `main` @ `92c0b37`

---

## 1. The shape of the system

SuperCitycon is a **3D city builder** built on Vite + Three.js. It is a
browser application: there is no native build, and none is claimed.

```
                        ┌───────────────────────────────────────┐
                        │              main.js                 │
                        │  bootstrap · frame loop · teardown    │
                        └───┬───────────────────────────────┬───┘
                            │                               │
              ┌─────────────▼──────────────┐   ┌────────────▼─────────────┐
              │        CORE (core/)        │   │     PRESENTATION         │
              │  config · events · state   │   │  render/ · audio/       │
              │  save · stage · modes      │   │  ui/ (camera, hud)      │
              │  log · settings            │   └──────────────────────────┘
              │  input-map · progress      │
              └─────────────┬──────────────┘
                            │  event bus (one table, one emit path)
   ┌────────┬────────┬─────┴─────┬────────┬────────┬────────┬────────┐
   │  WLD   │  BLD   │    ECO     │  MOB   │  POP   │  SRV   │  STD   │
   │ world  │buildings│ economy  │mobility│population│services│studio│
   └────────┴────────┴───────────┴────────┴────────┴────────┴────────┘
                            │
                    ┌───────┴────────┐
                    │  HAZ (hazards)│   V5 new
                    │  CONTENT       │   V5 new
                    └────────────────┘
```

### The rule that shapes everything

**One folder per domain. No domain imports another for side effects.**
Cross-domain changes travel over the event bus (`core/events.js`). A domain
that needs a sibling reads `ctx.domains.x` lazily — never at construction
time, because `ctx.domains` is only populated after every `create()` returns.

### The rule that keeps it testable

**Pure rule modules never import `three`.** The modules that hold the game's
rules are plain JavaScript and are unit-tested in Node with no DOM and no
renderer. The modules that draw are separate, and may import `three`.

`tests/integration.test.mjs` verifies the pure-module list automatically, so
the rule cannot silently rot.

---

## 2. What V5 changed, and why

V5 was not a rewrite. It is V4 plus a set of specific, named changes, each
made because a measurement or an inspection showed something was wrong or
missing.

### 2.1 One clock (CORE owns time)

**Before.** `main.js` kept its own `dayAccum` counter *and* called CORE's
`advanceDay`. Every day boundary incremented the counter **twice** and
emitted `DAY_CHANGED` **twice**, with two different payload shapes. The sky
had its own notion of the time of day, so the HUD and the sun could
disagree.

**After.** `core/modes.js` → `advanceClock(state, gameDt)` is the **only**
time authority. It owns `meta.elapsed`, `meta.tick`, `meta.day` and
`meta.year`, and emits `DAY_CHANGED` exactly once per boundary.

`main.js` derives the time of day from `meta.elapsed`:

```js
function timeOfDay() {
  const day = (liveState.meta.elapsed / DAY_LENGTH) % 1;
  return (TUNING.dayStartFraction + day) % 1;
}
```

A HUD time preset no longer sets the renderer directly — it **moves the
clock** (`EVENTS.TIME_SEEKED` → `seekTimeOfDay()`), so the next frame cannot
undo the jump.

### 2.2 Fixed-timestep simulation

**Before.** Domains were ticked with the raw wall-clock `dt`. A decay rate
written as `RATE * dt` was really "per screen refresh": the same city behaved
differently at 30 Hz and at 144 Hz.

**After.** The simulation runs on a fixed step of `TUNING.fixedStep` (1/60 s
of game time). Presentation — the camera, the animation — still uses the real
frame time.

```js
const FIXED_STEP = TUNING.fixedStep;      // 1/60
const MAX_CATCH_UP = TUNING.maxCatchUpSteps;  // 8

function stepGame(gameDt, maxSteps = MAX_CATCH_UP) {
  accumulator += gameDt;
  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < maxSteps) {
    accumulator -= FIXED_STEP;
    steps += 1;
    simulate(FIXED_STEP);
  }
  // A backlog larger than the bound is dropped: a machine that cannot keep
  // up must fall behind, not spiral.
  if (steps >= maxSteps && accumulator >= FIXED_STEP) accumulator = 0;
  return steps;
}
```

The catch-up bound is what stops a slow frame from fast-forwarding the city.
The harness hook (`window.SUPERCITYCON.step`) uses a much larger bound
(600) so a test can still fast-forward deliberately.

### 2.3 Structured logging (`core/log.js`)

A logger with **severity** (`trace`/`debug`/`info`/`warn`/`error`/`fatal`),
a **category**, a **context object**, a bounded **ring buffer** and a
**summary** for the diagnostics panel. `installGlobalHandlers()` routes
uncaught errors and unhandled rejections into it.

Every log line carries the build identity (name, version, build id, build
time) — no personal information and no secrets.

### 2.4 A real settings store (`core/settings.js`)

V4 had scattered flags: `state.ui.muted`, a pixel ratio read from the
window, no way to change a key binding. V5 has one validated, persisted
store with five sections:

| Section | Keys |
|---|---|
| `audio` | `master`, `music`, `sfx`, `ambience`, `ui`, `muted` |
| `display` | `fullscreen`, `resolutionScale` |
| `accessibility` | `reducedEffects`, `reducedShake`, `textScale`, `colourBlind`, `highContrast` |
| `input` | `bindings` |

Each key has a declared type, range, step and label, so the settings screen
can be **generated** from the store rather than hand-written and drifting out
of sync with it.

**Settings are a user preference, not game state.** They live in their own
`localStorage` record and are deliberately **outside the save format**, so a
save never carries someone else's accessibility preferences.

### 2.5 One binding table (`core/input-map.js`)

V4 read keys inline in several places. V5 has one table with `matches()`,
`rebind()` and `resetAll()`, and a `keyLabel()` helper so the on-screen hints
come from the same source as the handler. Bindings live in the settings
store, so they survive a reload.

### 2.6 A progression record (`core/progress.js`)

V4 tracked progress as a single stage index — a number that went up. There
was no way to say "this part of the city is safe", nothing to collect, and
nothing but the stage number survived a save.

V5 adds three records, all in `state.meta.progress` so they travel with the
save:

- **checkpoints** — named milestones the city has reached (a list),
- **collectibles** — one-off discoveries (a set),
- **achievements** — one-off rewards (a set).

### 2.7 A versioned save format with a migration chain (`core/save.js`)

`SAVE_VERSION` went `1 → 2`. A `MIGRATIONS` map is keyed by the **source**
version, and `migrateRecord()` applies the chain. The migration runs in both
`loadFromStorage()` and `importSave()`, and the payload records
`migratedFrom`.

A save with a **newer** version is **refused**, never guessed at. A corrupt
save is reported, not silently replaced.

### 2.8 A teardown path (`main.js`)

V4 created a `requestAnimationFrame` loop and a `setInterval` stage timer and
**never stopped either**. A reload left the old loop and the old timer
running alongside the new ones.

V5 has an explicit `dispose()` that:

1. clears the stage timer,
2. cancels the animation frame,
3. calls every domain's `dispose()`,
4. disposes the audio mixer,
5. clears the event bus,
6. disposes the settings store.

It is idempotent, and every step is individually guarded so one failing
domain cannot abort the teardown.

### 2.9 The diagnostics surface (`window.SUPERCITYCON`)

The page publishes the running game for the acceptance harness and for a
developer:

```js
window.SUPERCITYCON = {
  ctx, renderer, assetService,
  logger, settings, inputMap, progress: ctx.progress,
  content: ctx.domains.content,
  loadLevel: (id) => ctx.domains.content.apply(id),
  dispose,
  diagnostics() { /* build, summary, settings, progress, performance, mode, day, stage, time */ },
  get state() { return liveState; },
  step: (dt) => stepGame(dt, MAX_STEPS_PER_CALL),
  placementGate, THREE,
};
```

`state` is a **getter**, not a snapshot: `setState()` replaces the tree, so a
copied value would go stale the moment a save is loaded.

### 2.10 The audio mixer is actually connected

V4 built a complete procedural synthesiser with six category buses and **not
a single call site** — the game ran in silence and `state.ui.muted` was a dead
flag.

V5 drives the mixer from the event bus, so a sound is played where the thing
it describes happens:

| Event | Sound |
|---|---|
| `BUILDING_PLACED` | `place` |
| `BUILDING_REMOVED` | `bulldoze` |
| `BUILDING_UPGRADED` | `level-up` |
| `DAY_CHANGED` | `day-change` |
| `CHECKPOINT_REACHED` / `COLLECTIBLE_FOUND` | `confirm` |
| `ACHIEVEMENT_UNLOCKED` | `level-up` |
| `HAZARD_STARTED` | `alert` |
| `HAZARD_RESOLVED` | `confirm` |
| `TOOL_CHANGED` / `OPEN_PANEL` / `CLOSE_PANEL` | `click` / `click` / `cancel` |

The browser will not start an audio context without a gesture, so the first
`pointerdown` or `keydown` unlocks the mixer. Until then the game is silent —
it never depends on the audio succeeding.

### 2.11 The VFX service (`render/fx.js`, `render/fx-plan.js`)

A pooled, instanced particle system with nine effect kinds:

`place`, `bulldoze`, `level-up`, `checkpoint`, `achievement`, `hazard-smoke`,
`hazard-fire`, `hazard-water`, `warning`.

The **plan** is pure (`fx-plan.js` — no `three`), so the effect maths is unit
-tested in Node. The **service** (`fx.js`) builds the instanced meshes and
owns the pool.

`installFxFeedback()` in `main.js` is the bridge: it listens to the game's own
events and spawns the right effect at the right place, so an effect is always
produced by the thing it describes rather than sprinkled through the domains.

`accessibility.reducedEffects` shortens the lifetimes, shrinks the particles
and spawns fewer of them.

### 2.12 The content domain (`content/`)

Three modules plus a CLI tool:

| Module | Role | Pure? |
|---|---|---|
| `content/levels.js` | the shipped level library and the lookup helpers | yes |
| `content/validate.js` | the content validator | yes |
| `content/index.js` | the service: applies a level to the live city | no (service layer) |
| `game/tools/validate-content.mjs` | the offline validator CLI | — |

The **schema** of a level:

```
{
  id, name, description, seed, difficulty,
  metadata: { author, version, tags[], licence },
  objectives:   [{ id, label, type, target, checkpointId?, collectibleId?, hazardId?, check? }],
  checkpoints:  [{ id, label, x, z, requires[] }],
  collectibles: [{ id, label, x, z }],
  hazards:      [{ id, label, type, x, z, radius, phases[] }],
  spawns:       [{ id, type, key?, x, z, rot?, rect? }],
  exits:        [{ id, label, x, z, requires[] }],
}
```

A spawn with a `rect` is a **block**: the building type is laid across the
rectangle, stepping by the building's own **footprint**, so a 2×2 building
fills a 2×2 block and the next one starts two cells along. The footprint
comes from the live buildings catalogue, so the level data does not have to
repeat it.

The **progression graph** is:

```
exit --requires--> objective --(type: checkpoint)--> checkpoint --requires--> objective …
```

`requiredClosure()` walks that graph from every exit. An objective outside the
closure can never gate completion, and the validator reports it.

### 2.13 Pre-built buildings

A level's starting city **already existed** when the player arrived. It is
not player construction, so it must not be charged to the treasury and must
not occupy the player's construction slots.

`buildings.place(typeId, cx, cz, rot, { prebuilt: true })` places a
pre-built building: the cost is `0`, the affordability check is skipped, and
the `BUILDING_PLACED` payload carries `prebuilt: true`. The economy's handler
sees the flag, books no cost and starts no construction.

This was found by measurement, not by reading: a browser run of
`loadLevel('the-long-night')` placed 1 building and skipped 30 with
`not-enough-slots`. After the fix it places 128 objects and skips 0.

### 2.14 The hazard domain (`hazards/`)

The city-builder equivalent of the directive's "enemy intelligence" and
"boss encounter": a **multi-phase city crisis**.

```
telegraph ──▶ active ──▶ telegraph ──▶ active ──▶ … ──▶ resolved
   (warn)      (damage)     (warn)      (damage)          (outcome)
```

Each phase declares its own duration, damage rate, telegraph window and
vulnerability. Damage is

```
phase.damagePerSecond × distanceFalloff × (1 − mitigation)
```

where the **mitigation** comes from the city's own service coverage inside
the hazard's radius — the city fights the hazard with its fire stations and
its power grid. Escalation is explicit across the ladder, and the crisis
variant runs the phases back-to-back with rising city-wide pressure.

A hazard can also be resolved **early**, when the mitigation is enough.

---

## 3. Data flow

### 3.1 A frame

```
performance.now() ──▶ dt (clamped to 0.1 s)
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
   update(dt)  [wall clock]      stepGame(dt × speed)
   camera, animation, fx             │
                                     ├─▶ advanceClock(state, FIXED_STEP)
                                     └─▶ every domain's tick(FIXED_STEP)
```

`update` is presentation and is skipped while paused. `tick` is simulation
and runs in whole fixed steps.

### 3.2 The state tree

One mutable tree, one owner per subtree:

| Subtree | Owner | V5 change |
|---|---|---|
| `meta` | integrator + CORE | **`progress`** added |
| `world` | WLD | — |
| `economy` | ECO | pre-built buildings are not charged |
| `population` | POP | — |
| `services` | SRV | — |
| `mobility` | MOB | — |
| `buildings` | BLD | `place()` gained the `prebuilt` option |
| `studio` | STD | — |
| `ui` | UX | — |
| `hazards` | HAZ | **new subtree** |

A domain that captured `const state = ctx.state` at construction time would
keep writing into an **orphaned** tree after a load. `liveStateProxy(ctx)` and
`liveSubtree(ctx, key, ensure)` exist for exactly this reason: a stable
identity that always resolves through the live tree.

### 3.3 The save format

```
{
  version: 2,
  savedAt: <iso>,
  name, stage,
  data: { /* the state tree */ }
}
```

Maps, Sets and typed arrays are encoded as `{__map}`, `{__set}` and
`{__typed}` markers. A v1 record is migrated through the `MIGRATIONS` chain
before it is restored; a record with `version > SAVE_VERSION` is refused.

---

## 4. The event bus

One table (`core/events.js`), one emit path, `on` / `off` / `once` /
`emit` / `clearAll`. The V5 additions:

| Group | Events |
|---|---|
| feedback | `FX_SPAWN`, `SETTINGS_CHANGED`, `BINDINGS_CHANGED` |
| menus | `MENU_OPENED`, `MENU_CLOSED` |
| hazards | `HAZARD_STARTED`, `HAZARD_PHASE`, `HAZARD_DAMAGE`, `HAZARD_RESOLVED` |
| progression | `CHECKPOINT_REACHED`, `COLLECTIBLE_FOUND`, `ACHIEVEMENT_UNLOCKED` |
| time | `TIME_SEEKED` |

A domain emits on a **meaningful change only** — never every frame.

---

## 5. The build

| Item | Value |
|---|---|
| Bundler | Vite |
| Renderer | Three.js r169 |
| Runtime | ES modules, no framework |
| Tests | `node --test` (the Node built-in runner) |
| Syntax gate | `node --check` over every source file |
| Output | `game/dist/` — static files |

`npm run build:cleared` produces the **cleared** build, which excludes the
69 licence-unverified 2D images. That is the build that ships.

---

## 6. Configuration discipline

Every number the publisher never published lives in `TUNING`
(`core/config.js`), and every unresolved one is also listed in `TUNING_TBD`.
A module that needs a genuinely new number declares it as a `// TBD:`-marked
constant **in its own module** and proposes the `TUNING` key in its report —
it does not inline a guess.

`core/stage.js` keeps the same discipline with `MILESTONE_TARGETS` and
`TBD_VALUES`; `render/fx-plan.js` keeps it with `REDUCED_*` constants.

This rule binds the integrator too: the four numbers introduced during the
V5 core work (`dayStartFraction`, `skyRepaintStep`, `fixedStep`,
`maxCatchUpSteps`) were moved into `TUNING` with their `TUNING_TBD` entries
after the first pass inlined them.

---

## 7. What is deliberately not here

Stated plainly so the architecture is not read as more than it is:

- **No native build.** Web only.
- **No character controller, combat or player avatar.** The player builds a
  city. See `docs/V5_UPGRADE_PLAN.md` §1.
- **No NPC behaviour trees.** The city's agents follow the street network,
  which the mobility domain models.
- **No motion capture, retargeting or IK.**
- **No LLM integration.** No authorised provider, no key, and the directive
  forbids hardcoding credentials.
- **No audio asset files.** Every sound is synthesised at runtime.
- **No shipped 2D art.** It is licence-unverified and quarantined.
