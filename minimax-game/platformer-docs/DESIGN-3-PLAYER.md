# DESIGN-3 — PLAYER SYSTEMS

**Game:** original 3D side-scrolling platform game (original IP; no Nintendo expressive material)
**Owner:** PD Player Systems (`pd-player`)
**Version:** 1.0 · 30 October 2026
**Authority:** `MASTER-REQUIREMENTS.txt` v1.0 is the single source of truth for requirement *text*. This
document is the authoritative **player-side** design for `REQ-A-001…021` and for the player half of
`REQ-B-003`, `REQ-D-004/005/013/019/020`, `REQ-E-015`, `REQ-E-020`.

**Binding contract.** `minimax-game/platformer-docs/3D-TRANSLATION.md` is binding on this document. Where this
document would contradict it, **this document changes**. Where this document needs the *architecture*
board to change something, it raises a numbered cross-board item (`CB-0n`) rather than acting.

**Companion documents.** `DESIGN-3-ARCHITECTURE.md` §4 (module contract), §5 (schemas), §6 (save),
§7 (CI) are binding interfaces. `ASSET-SURVEY.md` and the asset curator's manifest are the authority
for what exists visually and audibly.

**Rule sets are separate, never blended.** `REQ-E-007`. Five sealed rule sets:
`classic_ground`, `challenge`, `carry_throw`, `world_map_suits`, `branching_companion`. A mechanic
present in one rule set is **absent** in another, not "slightly different".

---

## 0. Scope, authority and reading order

### 0.1 Requirement census owned by this document (29 distinct ids)

| Id | Pri | Authority for the **player-side behaviour** | Section |
|---|---|---|---|
| REQ-A-001 | P0 | PLAYER | §2 |
| REQ-A-002 | P0 | PLAYER | §1.3, §3.1 |
| REQ-A-003 | P0 | PLAYER | §3.2 |
| REQ-A-004 | P0 | PLAYER | §3.3 |
| REQ-A-005 | P0 | PLAYER | §3.4 |
| REQ-A-006 | P0 | PLAYER | §3.5 |
| REQ-A-007 | P0 | PLAYER | §3.6 |
| REQ-A-008 | P1 | PLAYER | §3.7 |
| REQ-A-009 | P1 | PLAYER | §3.8 |
| REQ-A-010 | P1 | PLAYER | §3.9 |
| REQ-A-011 | P1 | PLAYER | §3.10 |
| REQ-A-012 | P1 | PLAYER | §3.11 |
| REQ-A-013 | P1 | PLAYER | §3.12 |
| REQ-A-014 | P1 | PLAYER | §3.13 |
| REQ-A-015 | P1 | PLAYER | §4.1 |
| REQ-A-016 | P1 | PLAYER | §4.2 |
| REQ-A-017 | P1 | PLAYER | §5 |
| REQ-A-018 | P1 | PLAYER | §6 |
| REQ-A-019 | P1 | PLAYER | §7.1–7.4 |
| REQ-A-020 | P1 | PLAYER | §8 |
| REQ-A-021 | P2 | PLAYER | §11.1 |
| REQ-B-003 | P0 | **PLAYER** (WORLD consumes: authored bounds, camera zones) | §9 |
| REQ-D-004 | P0 | **PLAYER** (ENTITIES/WORLD consume: event sources) | §10.1 |
| REQ-D-005 | P1 | **PLAYER** (ENTITIES/WORLD consume: item definitions) | §7.5 |
| REQ-D-013 | P1 | **PLAYER** (WORLD consumes: scene transitions) | §10.2 |
| REQ-D-019 | P2 | **PLAYER** (WORLD consumes: trigger placement, signage) | §10.3 |
| REQ-D-020 | P2 | **PLAYER** (WORLD consumes: in-world cue respect) | §10.4 |
| REQ-E-015 | P1 | ARCHITECTURE owns the system contract; **PLAYER is the consumer** and fixes the normative action vocabulary, dead-zone values, conflict-policy semantics, rebind flow and hotplug behaviour | §2 |
| REQ-E-020 | P2 | ARCHITECTURE owns the export filter and the CI gate; **PLAYER is the consumer** and specifies the player-facing debug verbs and their acceptance | §11.2 |

**Statement of authority.** For every id marked **PLAYER** above, this document is authoritative and
no other board may restate the behaviour differently; the consumer boards supply *content* (levels,
items, entities, bounds, trigger placement) that satisfies it. For `REQ-E-015` and `REQ-E-020` the
architecture board remains authoritative for the module contract and the release gates; this document
fixes the player-facing semantics inside that contract and **does not** restate the contract.

### 0.2 Hard constraints honoured here

1. **3D.** Gravity on −Y, traversal axis X, lane axis Z, height Y. 1 world unit = 1 metre. "Side
   scrolling" = the camera is lane-constrained; the world is a real 3D space.
2. **No procedural art.** Every visible thing is a named asset from the repository (§12). Where a
   visual is missing the requirement is named and the gap is declared — no geometry is invented.
3. **Deterministic fixed-timestep simulation.** The player update is a pure function of
   `(player_state, buffered_input, dt)` with a fixed `dt = 1/fixed_hz`. No render-rate dependency.
   `REQ-A-002`, `REQ-E-002`, `NFR-02`.
4. **Every constant is configurable and marked.** Unpublished constants live in §13 with a proposed
   default and a rationale. No publisher constant is claimed. `GAP-001`, `GAP-002` remain open.
5. **Rule sets stay separate.** §0.3.

### 0.3 Rule-set feature allocation (authoritative for the player board)

`features` keys are the sealed vocabulary from architecture §5.1: `carry_throw`, `mount`,
`secret_exits`, `world_inventory`, `flight`, `power_states`. A rule set that does not enable a
feature **does not contain the mechanic at all** — the code path is absent, not tuned to zero.

| Rule set | `movement_profile` | carry_throw | mount | secret_exits | world_inventory | flight | power_states |
|---|---|---|---|---|---|---|---|
| `classic_ground` | `ground_v1` | false | false | false | false | false | false |
| `challenge` | `ground_hard_v1` | false | false | false | false | false | false |
| `carry_throw` | `ground_carry_v1` | **true** | false | false | false | false | false |
| `world_map_suits` | `suit_v1` | false | false | **true** | **true** | **true** | **true** |
| `branching_companion` | `glide_v1` | false | **true** | **true** | false | false | false |

Two clarifications that the architecture board must not misread:

- **`features.flight` gates the *power-up* flight/glide form (`REQ-D-005`), not the traversal glide.**
  The traversal glide of `REQ-A-017` is gated by `movement_profile: glide_v1` and therefore exists
  **only** in `branching_companion`. No rule set has both a power-up flight form and a traversal
  glide, so the two never mash.
- **Power states exist only in `world_map_suits`** (`features.power_states: true`). In every other
  rule set the power ladder collapses to a single implicit state `none`, and damage decrements
  health directly. The FSM in §7.5 is identical in shape; the state graph is data, so a rule set
  with `power_states: false` simply has no edges into `small`/`large`/`projectile`.

> **`CB-02` — CLOSED 2026-10-30.** Architecture §5.1's *illustrative* JSON for
> `branching_companion` showed `"carry_throw": true`. The binding 3D translation (§5) lists
> `branching_companion` features as "charge-glide, mount/dismount, branching exits" — **no carry** —
> and assigns carry/throw to the `carry_throw` rule set. **The architecture board's example now
> reads `"carry_throw": false`**, matching this board and the translation. The five rule sets
> stay separated (§2.2). *No decision is outstanding.*

### 0.4 Vocabulary and units

| Term | Meaning here |
|---|---|
| Tick | One fixed simulation step. `fixed_hz` is 60 unless the rule set overrides it (architecture §5.1 permits 30/60/120). |
| `dt` | `1.0 / fixed_hz` seconds, constant. Never the rendered frame time. |
| Ticks | **All gameplay timers are integer tick counts**, not float seconds. Seconds appear only for display and in `TUNE` documentation. This removes every float-timer drift path from the simulation. |
| Facing | `+1` (right, +X) or `−1` (left, −X). There is no free Y-axis facing. |
| Lane | The Z band the player is confined to by default; the lane centre is authored per camera zone. |
| `locomotion_state` | The sub-state carried inside `carry` (the player keeps walking while carrying). |
| `player_rng` | The player's own seeded RNG stream, seeded from the run seed. The simulation never calls a global RNG. |
| `TUNE` / `UNVERIFIED` | As architecture §12. `TUNE-P-0nn` are this board's **additions**; they extend, and never renumber, `TUNE-001…016`. |

---

## 1. The player runtime model

### 1.1 Where the player lives

The player is **not** a scene-tree node with logic in it. The player is a **pure data record** owned
by `src/core/**` (engine-agnostic, architecture §4.2) and updated by the core's player-state update;
`src/systems/physics` performs the move and contact resolution; `src/systems/actors` owns the visual
and animation binding. This is what makes the replay gate (§11.1) meaningful.

```
src/core/sim/player_state.gd      # the record below — no engine types
src/core/sim/player_update.gd     # pure function: (state, input_frame, dt) -> state'
src/core/rules/feature_flags.gd   # rules.enabled("carry_throw")
src/systems/physics/…             # move(), resolve_contacts(), material_at(), zones_at()
src/systems/actors/…              # visual binding, animation selection, pooling
src/systems/camera/…              # follow rig (§9)
src/systems/input/…               # poll_tick() (§2)
```

### 1.2 The player state record

```
PlayerState {
  // identity
  profile_id            : string          # "profile_tallow" …
  ruleset_id            : string          # sealed rule-set id
  stage_id              : string
  tick                  : uint64          # ticks elapsed in the current stage
  run_seed              : uint64

  // kinematics (see §1.4 for the arithmetic order)
  pos                   : Vec3
  vel                   : Vec3
  facing                : int             # +1 / -1
  previous_pos          : Vec3           # the "previous bounds" of REQ-A-007
  previous_bounds       : Aabb
  bounds                : Aabb

  // state machine
  state                 : enum           # the 15 states of §3.4
  state_tick            : uint32         # ticks spent in the current state
  locomotion_state      : enum           # sub-state held inside `carry`
  land_lock_ticks       : uint32         # landing recovery counter
  grounded              : bool
  ground_material       : string         # material tag of the supporting collider
  ground_collider_id    : string
  platform_id           : string         # moving-platform reference, for inherited motion

  // jump
  jump_held             : bool
  jump_hold_active      : bool
  coyote_ticks_left     : uint32
  buffer_ticks_left     : uint32
  jump_count            : uint8          # consecutive jumps used (0 = grounded jump)

  // environment
  water_volume_id       : string
  water_submerged_ratio : float
  water_surface_y       : float
  stroke_cooldown_ticks : uint32
  wind_accel            : Vec3
  in_climb_volume       : string
  in_portal_volume      : string

  // carry / abilities
  carried_item_id       : string
  carry_socket          : Vec3           # local offset of the socket
  carry_mass            : float
  special_charges       : Map<ability_id, uint32>   # hover, spin, ground-pound wind-up
  glide_charge_ticks    : uint32        # 0 … 36, the integer tick meter (§5.2)
  glide_state           : enum           # see §5

  // survival
  power_state           : enum           # §7.5
  health                : int
  invulnerable_ticks    : uint32
  knockback             : Vec3
  modifier_timers       : Map<modifier_id, uint32>  # invulnerable, boost, star, …

  // progression
  companion_id          : string
  companion_mounted     : bool
  lives                 : int
  coins                 : int
  score                 : int
  checkpoint_id         : string
}
```

### 1.3 The purity contract (`REQ-A-002`)

- `player_update(state, input_frame, dt, world) -> state'` is **pure**: it reads `state`, the input
  frame and read-only world queries (colliders, zones, material at a point) and returns a new state.
  It writes nothing outside the record, allocates nothing, and never reads a clock.
- The only permitted non-determinism source is `player_rng`, whose stream is a pure function of
  `(run_seed, tick)` — reproducible, and never shared with entity AI.
- All timers are tick counters decremented once per tick. There is no `+= delta` anywhere.
- `dt` is constant for a given rule set. `physics.move(actor, intent, dt)` receives the same `dt`
  every tick regardless of the rendered frame rate.
- The player's update order inside one tick is fixed: **intent → state transitions → kinematics →
  collision resolution → contact attribution → damage events → state transitions (post-events) →
  animation selection**. Animation selection is the last step and never feeds back.

**Determinism arithmetic rule.** All simulation arithmetic on `Vec3` is **component-wise, in the
order X, Y, Z**, using the core's own `Vec3` type — never an engine `Vector3` operation whose
internal evaluation order is not specified by the core. This is what makes the tick-1000 checksum
reproducible across runs on the pinned CI image (architecture §9.6, `NFR-02`).

**Map iteration rule.** The simulation's maps (`special_charges`, `modifier_timers`, the
`flags` map) are **always iterated in sorted key order**, never in insertion order, wherever a
scan can produce a simulation effect (a modifier expiring, an ability charging). A map whose
iteration order can affect the outcome is a determinism bug.

### 1.4 Kinematic model

- The player's collision volume is a **capsule of radius 0.35 m and height 1.75 m**
  (`TUNE-011`, architecture §12) — the 0.7 u footprint the 3D translation describes, measured
  against the Kenney cast bounds. While crouched the capsule's height is `crouch_height`
  (`TUNE-P-039` = 1.0 m); the radius never changes. See `CB-04` for the wording reconciliation.
- Gravity acts on −Y at `gravity` (`TUNE-002`, 24.0 m/s²) scaled by `gravity_scale` (profile or
  state), then by `water_gravity_scale` when submerged, then by `jump_hold_gravity_scale` while the
  jump hold window is open.
- The player accelerates **along X only**; there is no strafe axis (3D translation §2.1).
- The player's **Z is locked to the lane centre** of the active camera zone, except inside a
  **lane transition volume**, where the lane centre is authored along the volume's path and the
  player is carried along it.
- Integration is semi-implicit Euler at a fixed `dt`: `pos += vel * dt` after `vel` is updated.

---

## 2. Input abstraction (`REQ-A-001`, `REQ-E-015`)

Implementation lives in `src/systems/input/` (architecture §4.3: `poll_tick(tick) → InputFrame`,
`bind(action, device, slot)`, `set_deadzone(device, axis, value)`, `set_conflict_policy(p)`,
`remap(profile)`). This section fixes the semantics; the architecture board owns the module.

### 2.1 The sealed action vocabulary

Nine actions, matching `MASTER-REQUIREMENTS` REQ-A-001 ("move, jump, run/action, crouch, interact,
pause"). No system may reference an action outside this set.

| Action | Type | Play meaning | Menus |
|---|---|---|---|
| `move_left` | axis | traverse −X | menu left |
| `move_right` | axis | traverse +X | menu right |
| `move_up` | axis | aim up / climb up / portal up | menu up |
| `move_down` | axis | descend / climb down / aim down / enter a downward pipe | menu down |
| `jump` | button | jump / surface boost / confirm | confirm |
| `run` | button | run; **doubles as the action button** (grab, drop, glide charge, hammer throw, companion mount) | — |
| `crouch` | button | crouch; **doubles as jump-through on one-way platforms** | — |
| `interact` | button | portal / carry-throw / dismount; **held** = the profile special-ability chord (§4.2). World pickups are collected by **contact**, not by a press | confirm / back |
| `pause` | button | pause menu | pause |

`run` is the action button, as the master requirement names it ("run/action"). There is **no**
separate `cast`, `attack`, `spin` or `use` action: the projectile form casts with `run`; the special
abilities use the **held** `interact` (§4.2); the companion is mounted with `run` and dismissed with
`interact`. Adding an action is a change to the sealed vocabulary and requires a master-requirement
change.

### 2.2 Device model

| Device class | Bindable | Axis source | Notes |
|---|---|---|---|
| `keyboard` | yes | discrete keys mapped to −1/0/+1 | modifiers supported as part of a binding (`Shift`+key) |
| `gamepad` | yes | analogue sticks + d-pad + buttons | per-axis dead zone, per-axis inversion |
| `touch` | yes | on-screen controls | optional; binds are region-based, not key-based |

Binding record: `{action, device_class, kind (button|axis|axis_dir), control_id, modifier,
inverted, deadzone}`. A binding profile is a named set of binding records for all three device
classes, stored under `settings.bindings` in the save (§10.4) and mirrored to a global
`userdata://settings.json` so it applies before a save exists.

### 2.3 Dead zones

- Default radial dead zone `0.15` (`TUNE-P-038`), independently settable per axis via
  `set_deadzone(device, axis, value)`. Range 0.0–0.9.
- Dead-zone removal is applied **before** the value is quantised to the simulation's internal axis
  representation, so a stick at 0.10 reads as exactly 0.0 and can never produce a 1-tick drift.
- An axis below the dead zone reads as 0.0 and **clears** any previously-held action for that axis
  (a stick returned to centre releases `move_left`/`move_right`).

### 2.4 Simultaneous-press conflict policy

Conflict = two opposing actions of the same axis active in the same tick (`move_left` and
`move_right`; `move_up` and `move_down`). The policy is a **settings option** with three sealed
values:

| Policy | Behaviour | Rationale |
|---|---|---|
| `last_pressed_wins` | **Default.** The action whose `press_tick` is **larger** (the most recent press) wins; if both were pressed in the same tick, the axis resolves to **neutral** (0). | Deterministic and fair; equal-tick simultaneity is genuinely ambiguous, so neutral is the honest answer. |
| `neutral_on_conflict` | Any opposing pair in one tick resolves the axis to neutral, regardless of press order. | For players who prefer no accidental movement. |
| `priority_order` | A fixed per-axis priority decides (e.g. `move_right` over `move_left`). Set explicitly in the options. | For remap-heavy players. |

The policy is applied **once per tick, at poll time**, before the frame is published. It never
changes between ticks, so it cannot produce a one-tick flicker. The chosen policy is written to
`settings.input.conflict_policy`.

### 2.5 Hotplug

- Device connect/disconnect is detected in the input system and published as a typed event.
- On **disconnect**: every action bound to that device is released in the same tick. No stuck input,
  no phantom held button. The HUD/menu shows the "controller disconnected" prompt.
- On **connect**: the device's bindings are restored **by device class and control id**, not by
  device index, so reconnection after a reboot restores the same layout. The device is accepted
  without a scene reload and without disturbing any other connected device.
- Hotplug during `pause` or during a menu is handled identically to hotplug during play; the
  connected device is usable in the menu on the next tick.
- A reconnect while the game is paused must not unpause it and must not reset the pause timer.

### 2.6 The input frame

```
InputFrame {
  tick          : uint64
  actions       : bitmask   # one bit per action in the sealed vocabulary
  axis_x        : int       # -1000 … +1000, quantised from the analogue stick
  axis_y        : int       # -1000 … +1000
  pressed_mask  : bitmask   # actions that went down this tick
  released_mask : bitmask   # actions that went up this tick
  held_mask     : bitmask   # actions continuously down
  press_tick    : Map<action, uint64>   # the tick each action was last pressed
  device_generation : uint32  # increments on any device topology change
}
```

`pressed_mask` / `released_mask` are **edge** masks derived from the previous frame's `held_mask`.
A press is emitted **exactly once** per press event; a held action re-emits nothing until it is
released and pressed again. This is the mechanism that satisfies REQ-A-001's "exactly once under
press/release".

`axis_x` / `axis_y` are quantised integers so that the recorded replay is byte-exact and does not
depend on float formatting (§11.1).

### 2.7 Rebinding

- The rebind UI is keyboard-, gamepad- and touch-reachable with no mouse (`REQ-D-018` cross-check).
- Flow: select an action → "press a key" → capture the next input **from the chosen device class
  only** → the captured control is bound. If the control is already bound to another action the UI
  offers *swap* or *clear*; it never silently steals a binding.
- Binding the `pause` action to a control used by a menu navigation action is allowed but warned.
- A binding may be reset to the default per action or per device class.
- Bindings apply **immediately** to the live game (no restart) and persist to the save and to
  `userdata://settings.json`.

### 2.8 Acceptance tests (`REQ-A-001`, `REQ-E-015`)

**`REQ-A-001`** — *Check:* a scripted press/release of each of the nine actions produces exactly one
press event and exactly one release event per action, with identical action streams in the title
menu and in a play scene; a 1-tick press of `jump` yields `pressed_mask` set on exactly one tick and
`released_mask` set on exactly the next.

**`REQ-E-015`** — *Check:* (a) a gamepad hotplugged during play is accepted after a pause and a
resume, and its first input is delivered on the tick after the connect event, with no other device's
state changed; (b) with the conflict policy `last_pressed_wins`, pressing `move_left` and
`move_right` in the same tick yields `axis_x == 0`; pressing `move_left` on tick 10 and
`move_right` on tick 11 yields `axis_x == +1000`; (c) disconnecting a gamepad while `jump` is held
emits `released_mask` for `jump` on the disconnect tick and produces no further `jump` presses.

---

## 3. Movement, physics and the player state machine

### 3.1 Ground model (`REQ-A-002`)

On the X axis, with no input held the velocity decays by `ground_friction` per second
(friction 1.0 = full stop in one second); with input held it accelerates toward the target speed at
`ground_accel`. Both are **multiplied by the ground material's profile** (3D translation §1.1), so
`ice` (friction 0.02, accel 0.25) slides and `mud` (friction 2.2, accel 0.6) drags.

| Quantity | Source | Notes |
|---|---|---|
| `walk_speed` | profile table (§4.1) | target speed with `move` only |
| `run_speed` | profile table | target speed with `move` + `run` |
| `ground_accel` | profile table × material `ground_accel` | |
| `ground_decel` | profile table × material `ground_friction` | |
| `air_accel` | profile table | not multiplied by the material; `air_control` scales it |
| `air_control` | ruleset tune file, default 1.0 | `challenge` may use a lower value |
| `gravity` | `TUNE-002` = 24.0 m/s² | scaled by `gravity_scale`, `water_gravity_scale`, `jump_hold_gravity_scale` |
| `turn_rate` | profile table | how fast the body rotates to the new facing |

**Speed tiers.** Three ground speeds exist so that REQ-A-005 can distinguish `walk`, `run` and
`sprint`:

| Tier | Condition |
|---|---|
| `walk` | `0.05 < \|vx\| ≤ walk_speed` and `run` not held |
| `run` | `run` held and `\|vx\| ≤ run_speed × sprint_ratio` |
| `sprint` | `run` held and `\|vx\| > run_speed × sprint_ratio` (`sprint_ratio` = 0.95, `TUNE-P-003`) |

`walk`, `run` and `sprint` differ in **animation** (clip) and in **top speed**; the acceleration
curve is identical, which is what keeps them from becoming three different movement models.

**Acceptance (`REQ-A-002`).** *Check:* the same recorded input stream replayed at 30, 60 and 120
rendered frames per second produces an identical simulation state hash at tick 1000; running the
same input stream twice from the same `run_seed` produces an identical hash; the static scan
`ci/gate/no-delta-accumulation.sh` finds no `+= delta` and no clock read inside the update path
(architecture §4.2, `REQ-E-002`); the player's update order is asserted by the unit test
`test_player_update_order` to be **intent → state transitions → kinematics → collision resolution →
contact attribution → damage events → state transitions (post-events) → animation selection**.

### 3.2 Variable jump (`REQ-A-003`) — 3D form

Exactly the 3D translation §2.2:

1. On the jump press, `vy += jump_impulse` (profile value).
2. While the jump action is **held** and `vy > 0`, gravity is multiplied by
   `jump_hold_gravity_scale` (< 1) — the **hold window**.
3. On the jump **release** while `vy > 0`, `vy *= jump_cutoff_velocity_scale` and gravity returns to
   full — the **apex cut-off**.
4. A ceiling bump cancels the hold window and sets `vy = 0`.

`jump_impulse` and `jump_hold_gravity_scale` are **per-profile** values (§4.1) — `REQ-A-015`
requires an independently data-driven jump height, and the base profile (Brindle) carries the
translation's defaults, `jump_impulse 9.0` and `jump_hold_gravity_scale 0.45`.
`jump_cutoff_velocity_scale` (default 0.4, the translation's value) is a **rule-set** tune value —
`challenge` may use a lower value for a tighter arc; it is not a profile value, because it is a
*feel* property of the rule set, not of the character.

The hold window is **bounded**: it applies for at most `jump_hold_max_ticks` (14 ticks,
`TUNE-P-018`) after the jump, after which gravity is full even if the button is still held. Without
that bound the apex would not be a finite, measurable number. The resulting apex curve is
published in §4.1.

**Acceptance (`REQ-A-003`).** *Check:* with the jump action held for 1 tick the recorded apex is at
least 40 % lower than the apex with the action held for 60 ticks; the short-hop fixture's apex is
below the 1.0 m Kenney block height and the full-hold apex clears it.

### 3.3 Coyote time and jump buffer (`REQ-A-004`)

Both are **independently** tuneable and exposed in the options menu (accessibility). Base values:
`coyote_ticks = 6` (`TUNE-004`), `buffer_ticks = 8` (`TUNE-005`). Both may be set to 0.

| Rule | Behaviour |
|---|---|
| Coyote | On the tick the player leaves a supporting collider, `coyote_ticks_left = coyote_ticks`. A jump press is accepted while `coyote_ticks_left > 0` even though `grounded == false`. The counter decrements once per tick. |
| Buffer | A jump press sets `buffer_ticks_left = buffer_ticks`. On the tick the player becomes grounded, if `buffer_ticks_left > 0` the jump is consumed immediately. The counter decrements once per tick. |
| Independence | Two separate settings, two separate counters, no shared clamp. `coyote_ticks = 0` does not disable the buffer and vice versa. |
| Assist mode | `assist.enabled` multiplies both by 4, capped at 30 ticks each. The *effective* values are what the settings screen shows. |

**Grounded test (3D form).** The player is grounded when a downward probe of length
`ground_probe_distance` (`TUNE-P-005` = 0.12 m) from the capsule's bottom finds a collider with a
`solid` material **and** `vy <= 0`. This works on slopes and on moving platforms without an edge
test. A one-way platform counts as support only when the player is moving downward relative to its
`+Y` face.

**Acceptance (`REQ-A-004`).** *Check:* a jump pressed 3 ticks after leaving a ledge is accepted when
`coyote_ticks >= 3` and rejected when `coyote_ticks = 0`; a jump pressed 1 tick before landing is
accepted when `buffer_ticks >= 1` and rejected when `buffer_ticks = 0`; setting one to 0 leaves the
other's behaviour unchanged.

### 3.4 The movement state machine (`REQ-A-005`)

Fifteen states: `idle`, `walk`, `run`, `sprint`, `skid`, `jump`, `fall`, `crouch`, `climb`, `swim`,
`carry`, `hurt`, `dead`, `victory`, `transition`.

The machine is **data**, encoded in `src/content/characters/<profile_id>.character.json` under `states`
(architecture §5.3 shape: `on` = guarded transitions, `timer_ticks` = bounded timer, `next` =
timer fallback). The tables below are the normative content of that data.

#### 3.4.1 Per-state contract

| State | Allowed input | Collision rule | Exit transitions |
|---|---|---|---|
| `idle` | `move_*` (to locomotion), `jump`, `run`, `crouch`, `interact`, `pause` | mask `solid, one_way, actor`; one-way platforms solid only when descending onto them | §3.4.2 |
| `walk` | as `idle` | as `idle` | §3.4.2 |
| `run` | as `idle` | as `idle` | §3.4.2 |
| `sprint` | as `idle` | as `idle` | §3.4.2 |
| `skid` | `jump`, `pause`; movement input only to end the skid | as `idle`; the player is pushed out of walls | §3.4.2 |
| `jump` | `jump` (hold), `move_*` (air control), `pause` | as `idle`; one-way platforms **ignored** while `vy > 0` | §3.4.3 |
| `fall` | `move_*`, `jump` (buffer/coyote), `pause` | as `idle` | §3.4.3 |
| `crouch` | `crouch` (held), `move_*` at reduced speed, `pause` | as `idle`; capsule height reduced to `crouch_height` (`TUNE-P-039` = 1.0 m) | §3.4.4 |
| `climb` | `move_up`, `move_down`, `jump` (detach), `pause` | **no horizontal collision**; vertical collision only at ladder endpoints; a solid overlap forces an endpoint exit | §3.4.4 |
| `swim` | `move_*`, `jump` (stroke / surface boost), `interact`, `pause` | ground probe disabled; water drag and buoyancy applied | §3.4.4 |
| `carry` | `move_*` (× `carry_speed_scale`), `interact` (throw), `run` (drop), `pause`; **no** portal entry and **no** ability chord while carrying | as the held `locomotion_state`; the carried object has **no collider** | §3.4.4 |
| `hurt` | none (control authority 0) | as `idle`; knockback impulse applied | §3.4.5 |
| `dead` | none | **mask empty**; the player passes through geometry | §3.4.5 |
| `victory` | none | as `idle`; input frozen | §3.4.5 |
| `transition` | `pause` only | no simulation of the player | §3.4.5 |

#### 3.4.2 Transition table — ground locomotion

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| `idle` | `move_left`/`move_right` pressed | grounded | accelerate along X | `walk` |
| `idle` | `move_left`/`move_right` + `run` | grounded, `run` held | accelerate toward `run_speed` | `run` |
| `idle` | `jump` pressed | `grounded` or `coyote_ticks_left > 0` or `buffer_ticks_left > 0` | `vy += jump_impulse`; open hold window; `jump_count = 1` | `jump` |
| `idle` | `crouch` pressed | grounded | shrink capsule | `crouch` |
| `idle` | `interact` pressed | a portal/pickup is in range and its predicate holds | publish the interaction event | `idle` |
| `idle` | lost ground support | `grounded` becomes false | start coyote counter | `fall` |
| `idle` | damage event accepted | resistance outcome = `damage` | apply knockback, set invulnerability | `hurt` |
| `walk` | `run` pressed | `run` held | raise target speed | `run` |
| `walk` | movement released | `\|vx\| ≤ 0.05` | stop accelerating | `idle` |
| `walk` | movement input opposes `vx` | `\|vx\| > skid_entry_speed` | emit `skid_dust` | `skid` |
| `walk` | `jump` / `crouch` / damage / lost support | as above | as above | `jump` / `crouch` / `hurt` / `fall` |
| `run` | `\|vx\| > run_speed × 0.95` | grounded | — | `sprint` |
| `run` | `run` released | grounded | lower target speed | `walk` |
| `run` | movement input opposes `vx` | `\|vx\| > skid_entry_speed` | emit `skid_dust` | `skid` |
| `run` | `jump` / `crouch` / damage / lost support | as above | as above | `jump` / `crouch` / `hurt` / `fall` |
| `sprint` | `run` released | grounded | lower target speed | `run` |
| `sprint` | movement input opposes `vx` | `\|vx\| > skid_entry_speed` | emit `skid_dust` | `skid` |
| `sprint` | `jump` / damage / lost support | as above | as above | `jump` / `hurt` / `fall` |
| `skid` | `\|vx\| ≤ stop_speed` | grounded | stop | `idle` |
| `skid` | movement input matches `vx` | grounded | resume acceleration | `walk` or `run` |
| `skid` | `jump` pressed | buffer/coyote ok | jump out of the skid | `jump` |
| `skid` | damage / lost support | as above | as above | `hurt` / `fall` |

#### 3.4.3 Transition table — air

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| `jump` | jump released | `vy > 0` | `vy *= jump_cutoff_velocity_scale`; close hold window | `jump` |
| `jump` | `vy ≤ 0` | — | close hold window | `fall` |
| `jump` | ceiling bump | contact normal · +Y ≥ 0.7 | `vy = 0`; close hold window; emit `head_bump` | `fall` |
| `jump` | entered a water volume | submerged ratio > 0 | apply buoyancy and drag | `swim` |
| `jump` | damage accepted | resistance = `damage` | knockback | `hurt` |
| `fall` | grounded | probe finds support | `land_lock_ticks = land_recovery_ticks`; emit `land` | `idle` or `walk` (by `\|vx\|`) — or `carry` if an object is carried, in which case the stored `locomotion_state` is restored |
| `fall` | jump pressed | `coyote_ticks_left > 0` or `buffer_ticks_left > 0` | jump | `jump` |
| `fall` | entered a water volume | submerged ratio > 0 | buoyancy and drag | `swim` |
| `fall` | entered a climb volume | `move_up` held | latch the ladder | `climb` |
| `fall` | damage accepted | resistance = `damage` | knockback | `hurt` |

#### 3.4.4 Transition table — crouch, climb, swim, carry

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| `crouch` | `crouch` released | — | restore capsule height | `idle` or `walk` |
| `crouch` | `move_left`/`move_right` | grounded | accelerate at `crouch_speed_scale` | `crouch` (locomotion sub-state) |
| `crouch` | `jump` pressed | `crouch_jump_enabled` | jump | `jump` |
| `crouch` | damage accepted | resistance = `damage` | knockback | `hurt` |
| `climb` | `move_up`/`move_down` | inside the ladder volume | set `vy` directly to ±`climb_speed` | `climb` |
| `climb` | reached the top endpoint | — | detach at the top, keep `vy = 0` | `fall` |
| `climb` | reached the bottom endpoint | — | detach, place on the support | `idle` or `walk` |
| `climb` | solid overlap | — | force exit at the nearest free endpoint (§3.13) | `climb` → `idle`/`fall` |
| `climb` | `jump` pressed | — | detach with a jump impulse | `jump` |
| `climb` | damage accepted | resistance = `damage` | knockback | `hurt` |
| `swim` | `jump` pressed | `stroke_cooldown_ticks == 0` | `vy += swim_stroke_impulse`; set the stroke cooldown | `swim` |
| `swim` | surface reached | head above `water_surface_y` | switch to the surface sub-mode | `swim` (surface) |
| `swim` | `jump` pressed at the surface | head above surface | `vy += surface_boost_impulse` | `jump` |
| `swim` | exited the water volume | ratio == 0 | — | `fall` |
| `swim` | entered a climb volume | `move_up` held | latch the ladder | `climb` |
| `swim` | damage accepted | resistance = `damage` | knockback | `hurt` |
| `carry` | `interact` pressed | an object is carried | release with the throw velocity (§3.12) | the stored `locomotion_state` (an `idle`/`walk`/`run`/`sprint`/`skid`/`crouch` state) |
| `carry` | `run` pressed | an object is carried | release with zero velocity (drop) | the stored `locomotion_state` |
| `carry` | `move_left`/`move_right` | — | accelerate at `carry_speed_scale` | `carry` (locomotion_state becomes `walk`/`run`) |
| `carry` | `jump` pressed | buffer/coyote ok | jump; **the carried object stays on the socket** | `carry` (locomotion_state becomes `jump`) |
| `carry` | damage accepted | resistance = `damage` | knockback; the carried object is dropped | `hurt` |

#### 3.4.5 Transition table — hurt, dead, victory, transition

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| `hurt` | `hurt_duration` elapsed | `state_tick ≥ hurt_duration` | restore control authority | `fall` if airborne, else `idle` |
| `hurt` | invulnerability elapsed | `invulnerable_ticks == 0` | stop the invulnerability flash | `hurt` (unchanged) |
| `dead` | `death_timer` elapsed | `state_tick ≥ death_timer` | publish `player_died`; request the respawn at the checkpoint | `transition` |
| `victory` | `victory_timer` elapsed | `state_tick ≥ victory_timer` | publish `stage_cleared` | `transition` |
| `transition` | scene swap complete | — | install the new scene's player state | (scene) |

**Acceptance (`REQ-A-005`).** *Check:* every one of the fifteen states declares an **explicit
allowed-input set**, one collision rule and one outgoing transition in
`src/content/characters/<profile_id>.character.json`. The set may be **empty — and is empty by design** — for the three
input-locked states `hurt`, `dead` and `victory` (§3.4's table); every other state declares at
least one allowed input. A state whose `states[*].on` and `states[*].next` are both empty fails
schema validation; driving a scripted
input stream through the fixture `walk→run→skid→jump→fall→land` visits the states in the order
above, and the same stream produces the identical state sequence at 30, 60 and 120 rendered FPS.

### 3.5 Collision resolution and masks (`REQ-A-006`)

**Layers (sealed).** `solid`, `one_way`, `actor`, `hazard`, `pickup`, `trigger`, `portal`, `zone`,
`carried`, `projectile`.

| Query | Mask | Purpose |
|---|---|---|
| Player **collision** mask | `solid`, `one_way`, `actor` | Physical blocking and contact attribution only. |
| Player **interaction** query | `pickup`, `trigger`, `portal`, `zone`, `hazard` | Runs **after** the move, as a set of overlap tests. Never blocks movement. |
| Player **damage** query | `hazard`, `projectile`, `actor` | Feeds the damage pipeline (§7). |

The separation is the point: a coin, a portal trigger and a lava volume are **not** in the collision
mask, so the player can walk into a coin without being stopped, and a lava volume cannot act as a
wall. Replacing an art mesh never changes a mask.

**Resolution algorithm (swept, per tick).**

1. Compute the swept AABB from `pos` to `pos + vel * dt`.
2. If the sweep distance exceeds `max_substep_travel` (`TUNE-P-006` = 0.25 m), split the tick into
   `n = ceil(distance / max_substep_travel)` equal sub-steps. Each sub-step is a complete sweep.
3. For each sub-step: gather candidate colliders from the broad phase (the swept AABB expanded by
   the capsule radius); for each candidate compute the time of impact of the swept capsule against
   the candidate's box/rotated-box volume; keep the earliest TOI.
4. Advance to the earliest TOI, apply the response (depenetrate along the contact normal, set
   `vel` component to 0 along the normal), and repeat with the remaining time — at most
   `max_depenetration_iterations` (`TUNE-P-007` = 4) iterations.
5. A one-way platform participates only when the relative velocity into its `+Y` face is downward
   (§3.11).
6. Contacts returned by the resolver carry: the collider id, the contact point, the contact normal,
   the **previous** and **current** AABBs of both bodies, and the tick. These are the inputs the
   attribution logic of §3.6 needs.

The resolver is **pure and deterministic**: candidate ordering is by `(collider_id, sub-step index)`,
never by pointer or insertion order, so two runs produce identical contact sequences.

**Acceptance (`REQ-A-006`).** *Check:* sweeping the player across a 1.0 m-thick solid block at
`run_speed` over 120 sub-steps produces no pass-through and no tunnelling; the player's centre never
crosses the block's far face within one tick; and a 0.1 m-thick one-way platform is never passed
through from above at `sprint_speed`.

### 3.6 Facing, momentum and contact attribution (`REQ-A-007`)

**Facing.** `facing` is `+1`/`−1` along X. It changes only when:

| Condition | Effect |
|---|---|
| The move input opposes the current facing **and** the player is grounded **and** `\|vx\| < facing_flip_dead_speed` (`TUNE-P-004` = 0.6 m/s) | flip immediately |
| The move input opposes the current facing **and** `\|vx\| ≥ facing_flip_dead_speed` | **no** flip; the player enters `skid` instead and keeps the old facing until the velocity drops |
| The player is airborne | no flip from a move input; the facing is inherited from the take-off |
| A portal or a conveyor changes the travel direction | the facing is set by the traversal, not by the player |

**Momentum.** Momentum is not a separate quantity: it is `vel.x` itself. The player's acceleration
toward the target speed is `ground_accel` (material-scaled), so releasing the run button decelerates
through the friction curve rather than snapping to zero. A jump preserves `vel.x` exactly; a landing
preserves `vel.x` exactly (only `vel.y` is reset). This is what makes "jump off a ledge and keep
running" work and "land and stop dead" not happen.

**Stomp and bounce attribution.** A contact between the player and an actor is classified by the
**downward-arc stomp test** of 3D translation §2.4, extended with the previous-bounds test that
REQ-A-007 names. A contact is a **stomp** when **all four** hold at the contact tick:

1. `vel.y < -stomp_min_descent` (`stomp_min_descent` = 0.5, translation §2.4).
2. The contact normal's Y component ≥ `stomp_normal_threshold` (`stomp_normal_threshold` = 0.7,
   translation §2.4).
3. `previous_bounds.min.y ≥ target_previous_bounds.max.y - 0.02` — the player's feet were **above**
   the target's top on the previous tick (the "was above" test).
4. The player was **not grounded** on the previous tick — a player standing on a target is not
   stomping.

Condition 3 is what makes the attribution depend on the *previous and current bounds* rather than on
the current overlap alone; it is the 3D form of "the player landed on the enemy's head".

| Outcome | Damage type | Effect on the player | Effect on the target |
|---|---|---|---|
| Stomp test passes | `stomp` | `vy = stomp_bounce_impulse` (`TUNE-P-009` = 7.5 m/s); state `jump`; `jump_count` reset; emits `player_bounced` | resistance matrix applies (`REQ-C-003`); a stompable target is defeated, `source_id` = the player |
| Contact from above but the target is stomp-immune | `stomp` | `vy = stomp_bounce_impulse` (the bounce still happens) | resistance matrix returns `ignore`; the target is **not** damaged |
| Lateral contact (normal's X component dominates) | `contact` | damage to the player (§7) | the target takes `contact` damage only if its resistance says so |
| Contact from below (normal's Y component negative) | `contact` | damage to the player | as above |
| Contact with an actor whose resistance for `contact` is `immune` | `contact` | damage to the player | the actor is unaffected |

**Jump-from-enemy bounce.** A stomp that resolves to `ignore` (immune target) still bounces the
player — the bounce is a physical response, the damage is not. A stomp that defeats the target
credits the player as `source_id`; a thrown or reflected object carries the original attacker
through the chain (3D translation §3, `REQ-C-014`, `REQ-C-018`).

**Acceptance (`REQ-A-007`).** *Check:* a player descending onto a `stompable` actor emits
`damage_type = stomp` and a defeat event with `source_id` = the player's id, and the player's
`vel.y` is positive afterwards; the same player moving laterally into the actor emits
`damage_type = contact` and a damage event **on that actor**, and a contact damage event on the
**player** unless the player's own `damage.resistances.contact` reduces it; against an actor whose
`damage.resistances.contact` is `immune`, **no** damage event is emitted **on that actor** (the
player still takes the contact). A player whose `previous_bounds.min.y` was below the target's top
(i.e. rising into it) never registers a stomp.

### 3.7 Portals: pipes, doors, ladders (`REQ-A-008`)

A portal is a **volume with a facing predicate**, never a tile index (3D translation §2.6).

| Portal kind | Predicates |
|---|---|
| Pipe (horizontal) | player inside the pipe volume **and** the action pressed **and** `facing` within `portal_facing_tolerance` (25°, translation §2.6) of the pipe axis **and** the destination is unblocked |
| Pipe (vertical) | as above with a vertical axis tolerance |
| Door | player inside the door volume and the action pressed; no facing requirement |
| Ladder / vine | handled by the `climb` state (§3.13), not by a traversal event |

**Traversal algorithm.**

1. Each tick, the interaction query returns the set of portal volumes the player's capsule overlaps.
2. For each candidate, evaluate the predicate. A candidate that fails **any** predicate produces no
   event at all — there is no "near miss" feedback (an optional `denied` sound may be played, but no
   traversal).
3. On success: the player enters `transition`; the target spawn id is resolved; the destination's
   `return_portal` places the player and sets `facing` to the return direction; the camera is
   re-seeded with the destination's bounds within one tick (`REQ-B-010`); the current stage's
   transient actors are torn down and the destination's actors are instantiated (§11.1 for the
   replay guarantee).
4. **Blocked destination:** if the destination spawn volume is occupied by solid geometry, the
   traversal is refused, the player stays in place, and a `portal_blocked` event is published for
   the linter and the telemetry.

**Acceptance (`REQ-A-008`).** *Check:* a pipe traversal fires only when the player is inside the
pipe volume and pressing the direction matching the pipe's exit axis; a press of the wrong
direction, or a press from outside the volume, emits no traversal event; a pipe whose destination
spawn is inside a solid collider is refused and the player does not move.

### 3.8 Water (`REQ-A-009`)

Water is a **volume**; the player may be half in and half out (3D translation §2.7).

| Element | Value | Source |
|---|---|---|
| `water_gravity_scale` | 0.35 | translation §2.7 |
| `water_drag` | 0.85 (per second, applied to velocity) | `TUNE-006` |
| `swim_stroke_impulse` | 4.0 m/s | `TUNE-006` |
| `surface_boost_impulse` | 8.0 m/s | `TUNE-P-010` |
| `stroke_cooldown_ticks` | 18 | `TUNE-P-011` |

- **Submersion** is measured as the fraction of the capsule's height below the volume's surface
  plane. `submerged_ratio > 0` → buoyancy and drag; `head above surface` → the surface sub-mode.
- **Buoyancy** applies a force proportional to the submerged volume, capped so that a fully
  submerged player rises slowly rather than shooting out of the water.
- **Stroke**: each accepted stroke applies `swim_stroke_impulse` along +Y (or along the input
  direction), sets `stroke_cooldown_ticks`, and plays the stroke cue. A press inside the cooldown is
  **not** accepted (the press is not buffered) — this is the "repeated swim stroke" requirement.
- **Surface interaction**: at the surface the player can jump out with a single `surface_boost`
  impulse, and can move along the surface using the swim curve.
- **Different curves**: on land the horizontal speed is governed by `ground_accel` and
  `ground_friction`; in water the horizontal speed is governed by `water_drag` and
  `water_swim_accel` (`TUNE-P-012` = 6.0 m/s²). The two curves are separate parameters and are
  never shared.

**Acceptance (`REQ-A-009`).** *Check:* the horizontal distance covered in 30 ticks in water is
strictly less than on land under the same input; the recorded speed curve in water differs from the
land curve at every sample tick; a second stroke pressed inside `stroke_cooldown_ticks` produces no
impulse and no stroke event.

### 3.9 Wind (`REQ-A-010`)

A wind volume is an oriented box with a direction vector, a magnitude and an optional falloff
(uniform / linear along the volume's local Z). It is sampled at the **player's centre** (a volume,
so the player may be inside a gust and outside it in the same frame).

**Data — `WindVolume` (level JSON, `volumes[]` with `kind: "wind"`):**

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique within the stage; referenced by the level linter |
| `aabb` | vec3 min/max | World-space bounds of the volume |
| `origin` | vec3 | Centre of the box, used as the local-space origin |
| `rotation_y` | float | Yaw of the box, in degrees — sets the local Z axis the falloff runs along |
| `direction` | vec3 (normalised) | Unit vector the wind pushes along |
| `magnitude` | float | Peak acceleration in m/s² at full falloff |
| `falloff` | enum `uniform` \| `linear` | `uniform` = constant across the volume; `linear` = ramps from 0 at the near face to 1 at the far face along local Z |
| `applies_to_projectiles` | bool | Default `true` |
| `applies_to_player` | bool | Default `true`; `false` makes the volume projectile-only |
| `affects_grounded_player` | bool | Default `false`; when `true` the wind also pushes a grounded player (used only by designed "blow" puzzles) |

**Tick order inside one fixed step:**

1. Integrate gravity onto the player's velocity.
2. Sample every wind volume whose AABB contains the player's centre; accumulate
   `Σ direction × magnitude × falloff_sample` into a single wind acceleration vector.
3. Add the accumulated wind acceleration to the player's velocity.
4. Integrate position from the resulting velocity.

The accumulation happens **before** integration, so a wind change can never produce a
per-tick position discontinuity larger than the acceleration applied in that tick.

**Rules:**
- The acceleration applies **only while the player is airborne**, and **always** to projectiles.
- `wind_acceleration` = 6.0 m/s² (`TUNE-007`), scaled by the volume's falloff.
- A wind volume with `applies_to_projectiles: true` (the default) also affects the player's own
  projectiles (§8).

**Acceptance (`REQ-A-010`).** *Check:* with a wind volume active, a projectile's landing point
shifts at least 5 cm downwind; toggling the wind volume mid-flight produces no per-tick position
discontinuity greater than 1 cm; the player's ground position is unaffected by the wind while
grounded.

### 3.10 Surface materials (`REQ-A-011`)

The material set and its values are fixed by 3D translation §1.1: `solid` (1.0/1.0), `ice`
(0.02/0.25), `mud` (2.2/0.6), `quicksand` (3.0/0.4), `conveyor` (1.0/1.0 + a surface velocity
vector), `bouncy` (1.0/1.0 + a launch impulse on contact), `slippery_grunt` (0.35/0.8), `grate`
(1.0/1.0, no pit-death check), `hazard` (1.0/1.0, triggers a hazard event, not a damage response
from the collider). The material drives friction, acceleration, sound and particles — **never** the
mesh.

Additional player-side behaviours:

| Material | Player behaviour |
|---|---|
| `conveyor` | the ground contact adds `conveyor_speed` to the ground's surface velocity; the player standing still is carried; the player's own velocity is unchanged (the surface velocity is added, not blended) |
| `bouncy` | a landing or a downward contact applies the block's launch impulse (World board owns the impulse value, `REQ-D-010`) |
| `quicksand` | the player sinks: gravity scale 1.4 while grounded on it, and the ascent speed is capped |
| `grate` | the pit-death check (§7.3) is skipped |
| `mud` | footstep cue uses the mud step; the slide sound uses the sand step |

**Acceptance (`REQ-A-011`).** *Check:* the same 60-tick input on `ice`, `mud`, `conveyor`,
`quicksand` and `solid` yields five distinct final X positions, ordered
`ice > conveyor > solid > mud > quicksand`; the material tag can be changed on a collider without
changing its mesh and the player's travel distance changes accordingly.

### 3.11 One-way platforms (`REQ-A-012`)

A one-way platform is a box collider with a **single permitted normal (+Y)**. Collision resolves only
when the player's velocity into that face is downward relative to it. Passing upward through it is
always allowed.

**Data — the one-way flag on the collider (level JSON, `placements[]`):**

| Field | Type | Meaning |
|---|---|---|
| `collision_profile` | enum `solid` \| `one_way` \| `hazard` \| `trigger` \| `none` | `one_way` enables the single-permitted-normal behaviour; `none` is collider-free dressing and belongs in `props[]`, not `placements[]` |
| `one_way_normal` | vec3 | The permitted normal. Defaults to `(0, 1, 0)`. A platform that can be passed upward only is `(0, -1, 0)` |
| `one_way_from_below` | bool | Default `true` — the platform is solid from above and passable from below |
| `jump_through_action` | string | The action that suppresses the collider while held. Default `crouch`; `null` disables jump-through |
| `drop_through_time` | int ticks | How long the collider stays suppressed after the action is pressed. Default **15 ticks** (**`TUNE-P-045`**) = 0.25 s at 60 Hz — long enough to clear the platform's thickness, short enough that a held crouch cannot be used to drift through a whole stack. **Ticks, not seconds**, so the authored value is an exact integer at the fixed tick rate |

**Rules:**
- **Jump-through** is enabled by holding the `crouch` action: while `crouch` is held, the one-way
  platform's collision is suppressed entirely for the player, so a jump passes through it and the
  player rises.
- Landing from above lands on it normally.
- A one-way platform is **not** a support for the coyote test unless the player is descending onto
  it.
- The suppression is per-player and lasts `drop_through_time`; it does not disable the platform for
  other actors.

**Acceptance (`REQ-A-012`).** *Check:* rising through a one-way platform produces no contact event;
falling onto it produces a contact with a normal whose Y component ≥ 0.7 and the player comes to
rest on it; holding `crouch` during a jump through it produces no contact either; the platform's
one-way flag can be toggled per platform and the behaviour follows the flag.

### 3.12 Carry, throw and lift (`REQ-A-013`)

Only present in the `carry_throw` rule set (`features.carry_throw: true`); in every other rule set
the mechanic is **absent** — no carry socket exists and the `carry` state is unreachable.

**Socket.** A carried object is parented to a **socket transform** — a named offset on the player's
rig (not a hand bone; Kenney rigs are static and have no hand socket, 3D translation §2.10). Default
socket offset `(0.0, 1.05, 0.55)` m in the player's local frame, `TUNE-P-013`. The socket is placed
in front of the facing direction and is mirrored when `facing` flips.

**Carry sequence.**

1. The `run` action is pressed within `grab_radius` (`TUNE-P-014` = 1.25 m) of a carryable actor.
2. The player's `carry_strength` is compared with the object's `weight` class. If the object is too
   heavy the pickup is refused and a `denied` cue plays; the player never enters `carry`.
3. A **wind-up** of the profile's `grab_ticks` runs, during which the player is slowed to
   `carry_speed_scale` (0.55) and the object is still on the ground. `TUNE-P-015` (21 ticks) is the
   fallback used only by a profile that declares no `grab_ticks`.
4. On completion the object is attached to the socket and **its collider is disabled**. A carried
   object collides with nothing until release.
5. While carried, the object's `weight` also scales the player's deceleration, so a heavy object is
   visibly slower.

**Release.** `interact` throws, `run` drops.

| Release mode | Release velocity |
|---|---|
| Throw | `vel.x` (the player's current X velocity) + `throw_impulse` (9.0 m/s, `TUNE-P-016`) along the facing axis; `vel.y` is the player's current `vel.y` (so throwing upwards mid-jump throws upwards) |
| Drop | the player's current `vel.x`, `vel.y = 0` |

On release the object's collider is re-enabled, it becomes a normal actor, and it carries
`last_attacker_id` so that if it hits a boss the **original attacker** is credited
(3D translation §2.10, `REQ-C-014`, `REQ-C-018`).

**Acceptance (`REQ-A-013`).** *Check:* the carried object stays at the socket offset (within 1 cm)
for 60 ticks, has no collision while carried, and after a throw has collision and a velocity equal
to the configured release vector; an object heavier than the profile's `carry_strength` is never
picked up; a thrown object that hits a boss credits the thrower as `source_id`.

### 3.13 Climbing (`REQ-A-014`)

Inside a ladder/vine/net volume the player enters `climb`:

- Vertical velocity is driven **directly** by the input (`±climb_speed`, 3.0 m/s, `TUNE-P-017`);
  there is no gravity and no acceleration while climbing.
- Horizontal movement is locked to the ladder axis; the lane (Z) remains locked to the lane centre.
- The player **cannot detach into a solid wall**: a solid overlap forces an immediate exit at the
  **nearest free endpoint** of the ladder volume. The endpoint is found by testing the ladder
  volume's two ends against the collision set; the nearer one that is free is used. If both are
  blocked, the player is pushed back to the last free position along the ladder axis (a hard
  blocker, reported to the linter).
- At the top endpoint the player detaches with `vy = 0` and enters `fall`; at the bottom endpoint
  the player detaches onto the support and enters `idle`/`walk`.
- `jump` detaches with a jump impulse in the facing direction.

**Acceptance (`REQ-A-014`).** *Check:* climbing a ladder and reversing at either endpoint exits
cleanly into the documented state; pressing into a solid wall while climbing never detaches the
player and never places the player inside a collider; the player cannot climb past a ladder
volume's top endpoint.

---

## 4. Avatar profiles (`REQ-A-015`, `REQ-A-016`)

### 4.1 The four profiles (data-driven)

The four avatar profiles are **already decided** and are not renamed here. Their ids are
`profile_tallow`, `profile_brindle`, `profile_sable` and `profile_moth`; the save slot's
`profile_id` (architecture §5.7) carries one of them. Each is a separate character
profile file `src/content/characters/<profile_id>.character.json` (`kind: "player"`,
archetype `id` `player.<profile_id>` — architecture §5.3), so every number in
the table below is **data**, not code. Two profiles may share a rule set; the rule set never changes
a profile's numbers.

| | **Tallow** | **Brindle** | **Sable** | **Moth** |
|---|---|---|---|---|
| Role | heavy / slow / high carry | armoured / tank | agile / fast | hover / low gravity |
| Rig asset | KayKit `Barbarian` | KayKit `Knight` | KayKit `Rogue` | KayKit `Rogue_Hooded` |
| Bone map | `kaykit_41` | `kaykit_41` | `kaykit_41` | `kaykit_41` |
| Clip set | `kaykit_76` | `kaykit_76` | `kaykit_76` | `kaykit_76` |
| `walk_speed` (m/s) | 3.2 | 3.0 | 3.8 | 3.4 |
| `run_speed` (m/s) | 6.0 | 5.4 | 7.4 | 6.4 |
| `ground_accel` (m/s²) | 22.0 | 26.0 | 34.0 | 24.0 |
| `ground_decel` (m/s²) | 28.0 | 34.0 | 38.0 | 22.0 |
| `air_accel` (m/s²) | 13.0 | 15.0 | 22.0 | 24.0 |
| `air_control` | 0.8 | 0.9 | 1.2 | 1.3 |
| `jump_impulse` (m/s) | 9.6 | 9.0 | 9.2 | 8.4 |
| `jump_hold_gravity_scale` | 0.38 | 0.45 | 0.62 | 0.55 |
| `gravity_scale` | 1.00 | 1.00 | 1.00 | 0.72 |
| `coyote_ticks` | 6 | 5 | 8 | 10 |
| `buffer_ticks` | 8 | 7 | 10 | 12 |
| `hover_ticks` | 0 | 0 | 0 | 27 |
| `grab_ticks` | 33 | 36 | 19 | 25 |
| `carry_strength` (weight class) | 3.0 | 4.0 | 1.2 | 0.8 |
| `turn_rate` (deg/s) | 540 | 360 | 900 | 720 |
| `damage.resistances` | `contact: take`, `crush: take`, `projectile: take`, `environment: take` | `contact: half`, `crush: half`, `projectile: half`, `environment: take` | all `take` | all `take` |
| Special (`REQ-A-016`) | Quake Stomp | Shield Brace | Spin Vault | Lantern Float |
| Profile-specific clip | `Idle`, `Walking_A`, `Running_A`, `Jump_Full_Long`, `Block` | `Idle`, `Walking_A`, `Running_A`, `Block`, `Blocking` | `Idle`, `Walking_A`, `Running_B`, `2H_Melee_Attack_Spinning` | `Idle`, `Walking_A`, `Running_A`, `Jump_Idle` (hover hold) |

All numeric values are `TUNE` and live in the profile's actor archetype JSON (§13 registers the
rule-set-scoped constants). Where the architecture declares a global value, this table sits under
it: `gravity` is `TUNE-002` (24.0 m/s²) for every profile, scaled by `gravity_scale`; Brindle's
`jump_impulse` is `TUNE-003` (9.0 m/s); architecture `TUNE-009` (max run speed 7.5 m/s) is the
**global ceiling** — every profile's `run_speed` is at or below it (Sable, the fastest, is 7.4 m/s),
so no profile can outrun the level design's ceiling. The architecture's `TUNE-004` (coyote 6 ticks)
and `TUNE-005` (buffer 8 ticks) are the **options-menu defaults**: **Tallow (6/8) matches them
exactly**, while Brindle (5/7) — the tank — has the least assistance, Sable (8/10) has the
most coyote and buffer room of the ground profiles because it is the fastest, and Moth
(10/12) — the hover profile — has the most of all.

**Distinctness check (the REQ-A-015 acceptance).** Measured from the table and from the apex model
below:

| Profile | Time to jump apex (s) | Jump apex height (m) | Top run speed (m/s) | Grab wind-up (ticks) |
|---|---|---|---|---|
| Tallow | 0.545 | 3.16 | 6.0 | 33 |
| Brindle | 0.503 | 2.68 | 5.4 | 36 |
| Sable | 0.472 | 2.43 | 7.4 | 19 |
| Moth | 0.591 | 2.81 | 6.4 | 25 |

Four distinct values on every axis, separated by at least 1.86 ticks (0.031 s) of apex time and
0.12 m of apex height — the profiles are distinguishable by timing alone, with no special-case
code. Tallow's apex (3.16 m ≈ 3.2 blocks) is the figure the 3D translation's "~3.2-block jump
height" describes; the base profile (Brindle) sits lower.

**Jump apex model.** The hold window is **bounded**: it applies while the jump action is held,
`vy > 0`, and the jump state has lasted at most `jump_hold_max_ticks` = 14 ticks (0.233 s),
`TUNE-P-018`. After that gravity is full even if the button is still held. This bounds the apex and
makes it a measurable number.

**The table below is the continuous (closed-form) reference**, computed for `fixed_hz = 60`
(`TUNE-001`). The simulation integrates with semi-implicit Euler (§1.4), so the **measured**
(discrete) apex differs from the reference by at most the discretisation error `v·dt/2` — at most
0.08 m at `jump_impulse` 9.6 and `dt` = 1/60. The implementer's acceptance test therefore asserts
the *discrete* values: the four profiles must keep at least 1.5 ticks of apex-time separation and
0.10 m of apex-height separation, and the 1-tick tap must be at least 40 % below the full-hold
apex. A rule set on another tick rate rescales the window as
`jump_hold_max_ticks = round(0.2333 × fixed_hz)` and publishes its own table; the architecture's
ruleset schema permits 30/60/120.

The base profile is **Brindle**, whose `jump_impulse` (9.0 m/s), `jump_hold_gravity_scale` (0.45)
and `gravity` (24.0) are exactly the 3D translation's documented defaults.

| Release tick (continuous reference) | Apex height (m) | ≈ blocks (1 u grid) |
|---|---|---|
| 1 (quick tap) | 0.41 | 0.4 |
| 6 | 1.06 | 1.1 |
| 8 | 1.29 | 1.3 |
| 14 (release at the window's last tick, cut-off applied) | 1.95 | 1.9 |
| held to the apex (no release, so no cut-off) | 2.68 | 2.7 |

The quick tap reaches 15 % of the full-hold apex — comfortably past the architecture's "at least
40 % below" bar — and a 6-to-8 tick tap lands at ≈1.3 blocks, which is the translation's
"~1.2-block short hop".

> **`CB-05` — CLOSED 2026-10-30.** The three documents previously disagreed about the apex.
> The disagreement was **not** a disagreement about the physics — it was a disagreement about
> which model was normative: "≈1.69 m" is the apex at **full gravity with no hold window**,
> "≈3.2 blocks" is the apex with the **hold window unbounded**, and this board's
> **bounded** hold window (`TUNE-P-018`, 14 ticks) produces the per-profile curve published
> in §4.1. **The bounded-hold model is normative**, and all three documents now publish the
> same per-profile table — Tallow **3.16 m**, Brindle **2.68 m** (base), Sable **2.43 m**,
> Moth **2.81 m** — with the conservative level-design bounds (**vertical ≤ 2.43 m**,
> **horizontal ≤ 5.43 m**) stated for `LINT-005`. The single "≈1.69 m" figure is withdrawn.
> No publisher constant is claimed; the apex is a `TUNE`.

### 4.2 Per-profile special abilities (`REQ-A-016`)

**The chord.** One chord for all four profiles: **hold `interact`**. `interact` is otherwise used
only for portals, carrying, throwing and dismounting, all of which are grounded or mounted
contexts, so the chord displaces nothing. An ability may additionally require `jump` (Sable). The
ability is declared in the profile's `abilities` block:

```
abilities: [{
  id            : "spin_vault",
  contexts      : ["grounded_jump", "airborne"],
  duration_ticks: 30,
  damage_type   : "contact",            # a sealed DamageEvent.damage_type (3D translation §3)
  victim_tags   : ["spin_vulnerable"],  # only actors carrying this tag are hit
  immune_tags   : ["spin_immune"],      # actors carrying this tag are filtered out
  breaks        : ["spin_destructible"],
  cooldown_ticks: 0
}]
```

| Profile | Ability | Context | Effect | Event type / victim filter |
|---|---|---|---|---|
| **Tallow** | Quake Stomp | airborne (`interact` held) | the player curls; on landing, a radial impulse and a damage event to every actor within `pound_radius` (2.0 m, `TUNE-P-019`); breaks `crushable` blocks | `stomp` / victims tagged `pound_vulnerable` |
| | | grounded (`interact` held) | a heavy stance: `ground_decel` × 0.5 and the player resists knockback (knockback × 0.5) | — |
| **Brindle** | Shield Brace | grounded (`interact` held) | contact and crush damage are halved; a projectile flagged `reflectable` is reflected along the contact normal with the player's `source_id` (`REQ-C-018`); the player cannot move faster than 60 % of `walk_speed` while bracing | — |
| | | airborne | **no effect** (declared, not accidental) | — |
| **Sable** | Spin Vault | grounded + `jump` pressed while `interact` is held | a spin jump: `vy = jump_impulse × 0.9`, horizontal speed preserved, `spin_duration` = 30 ticks; during the spin the player damages `spin_vulnerable` actors on contact | `contact` / victims tagged `spin_vulnerable` |
| | | airborne (`interact` held) | a spin dive: the player rotates and falls at 1.6 × gravity, damaging `spin_vulnerable` actors on contact | `contact` / victims tagged `spin_vulnerable` |
| **Moth** | Lantern Float | airborne (`interact` held) | hover: `gravity_scale` becomes 0.15 while `hover_ticks` (27 = 0.45 s) remain; the meter drains and refills only on the ground | — |
| | | grounded | **no effect** (declared) | — |

**Chord resolution — one button, three consumers.** `interact` is also the portal press (§3.7) and
the throw (§3.12). The precedence is fixed and deterministic:

1. An `interact` **press** is consumed by a **portal traversal** or a **throw** if either fires on
   that tick. A consumed press does **not** start the ability chord.
2. The ability chord engages only after `interact` has been held continuously for
   `ability_chord_ticks` (6 ticks, `TUNE-P-040`) **and** no traversal or throw consumed the press.
3. Releasing and re-pressing `interact` restarts the chord from zero.
4. While the player is **carrying**, the ability chord is unavailable outright: the `interact`
   press is the throw.

**Resolution — inside the sealed damage-type enum.** The `DamageEvent.damage_type` enum is sealed by
3D translation §3 (`contact, stomp, projectile, thrown, moving_shell, environment, crush, fall,
poison`) and **this board does not extend it**. A special ability therefore:

1. raises its event with a **sealed** damage type — the spin uses `contact`, the ground pound uses
   `stomp` (a downward impact, which is exactly what a pound is); and
2. applies a **victim filter** to the contact set **before** the event exists, using the target
   archetype's `tags`. A target tagged `spin_immune` is filtered out, so **no damage event is
   emitted at all** — which is precisely the acceptance wording the architecture board uses for
   `REQ-A-016`.

The resistance matrix (Board C, 3D translation §3) is then consulted normally with the sealed type.
The player board owns the tag names it uses (`spin_vulnerable`, `spin_immune`, `pound_vulnerable`,
`pound_immune`, `spin_destructible`, `crushable`, `reflectable`); Board C owns the matrix contents.

**Acceptance (`REQ-A-015`).** *Check:* the four profiles produce four distinct values for
(time-to-peak-jump, top speed, grab time) from the fixture table above; no profile's numbers are
read from a conditional in code — changing a value in the profile JSON changes the measured timing.

**Acceptance (`REQ-A-016`).** *Check:* Sable's spin jump emits a `damage_type = contact` damage
event on a `spin_vulnerable` actor and emits **no** damage event on a `spin_immune` actor; Tallow's
ground pound emits a `damage_type = stomp` damage event on every actor within 2.0 m tagged
`pound_vulnerable` and none outside that radius; Brindle's brace halves the damage magnitude of a
`contact` event; Moth's hover consumes `hover_ticks` at a constant rate and resets to full on
landing.

---

## 5. Flight and gliding (`REQ-A-017`)

**Rule-set gate.** The traversal glide exists **only** in `branching_companion`
(`movement_profile: glide_v1`). In the other four rule sets the states below are unreachable and
the constants are not present in their tune files. The *power-up* flight form (`REQ-D-005`) is a
different feature, gated by `features.flight` in `world_map_suits`; the two never coexist.

### 5.1 Glide state machine

```
glide_none ──(run held, grounded)──► glide_charging ──(run released, charge ≥ min)──► glide_launched
     ▲                                     │                                                │
     │                                     └──(run released, charge < min)────────────────┘
     │                                                                                      ▼
     └──(recover complete)── glide_recovering ◄──(landed / all move_* released / ceiling hit)─ glide_gliding
                                       ▲                        │                 │       │
                                       │                        │(charge = 0)     │       │
                                       └──(landed)──────────────┴─────────────────┘       │
                                                                ▼                            │
                                                          glide_falling ◄────────────────────┘
                                                                │
                                                                (landed)
                                                                ▼
                                                          glide_recovering
```

The `glide_diving` state is a sub-state of `glide_gliding` (entered when `move_down` is held and
left when it is released); it is shown separately in the transition table below.

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| `glide_none` | `run` held | grounded, `features` allow glide | `glide_charge_ticks` starts filling | `glide_charging` |
| `glide_charging` | `run` released | `glide_charge_ticks ≥ glide_min_charge_ticks` (9) | `vy = takeoff_impulse` (8.0 m/s); `vx += takeoff_boost` (3.0 m/s) along the facing | `glide_launched` |
| `glide_charging` | `run` released | `glide_charge_ticks < glide_min_charge_ticks` | `glide_charge_ticks = 0` | `glide_none` |
| `glide_charging` | all `move_*` released | grounded | charge decays | `glide_none` |
| `glide_launched` | 1 tick elapsed | — | the launch impulse is consumed; the glide becomes active | `glide_gliding` |
| `glide_gliding` | `move_down` held | `glide_charge_ticks > 0` | lift is removed, `vx += dive_conversion × glide_lift × dt` (0.8), gravity applies at full strength | `glide_diving` |
| `glide_diving` | `move_down` released | — | lift is restored | `glide_gliding` |
| `glide_gliding` | charge reaches 0 | `glide_charge_ticks == 0` | lift off | `glide_falling` |
| `glide_diving` | charge reaches 0 | `glide_charge_ticks == 0` | lift off | `glide_falling` |
| `glide_gliding` / `glide_diving` | grounded | — | `glide_charge_ticks = 0`; emit `land` | `glide_recovering` |
| `glide_gliding` / `glide_diving` | all `move_*` released | — | `glide_charge_ticks = 0` | `glide_recovering` |
| `glide_gliding` / `glide_diving` | ceiling hit | contact normal · +Y ≥ 0.7 | `vy = 0`; `glide_charge_ticks = 0` | `glide_recovering` |
| `glide_falling` | grounded | — | `glide_charge_ticks = 0` | `glide_recovering` |
| `glide_recovering` | `recover_ticks` elapsed (30) | — | the player re-enters `glide_none`; the movement state returns to `idle`/`fall` | `glide_none` |

### 5.2 Constants

| Id | Constant | Default | Unit | Rationale |
|---|---|---|---|---|
| `glide_charge_full_ticks` | ticks to charge from empty to full | 36 | ticks | `TUNE-P-042`. The translation's `glide_charge_time` 0.60 s expressed as ticks at `fixed_hz` 60. The meter is an **integer tick count**, never a float, so the launch threshold is exact. |
| `glide_drain_ticks_per_s` | ticks consumed per second in flight | 33 | ticks/s | `TUNE-P-020`. ≈0.55 /s, giving ≈1.8 s of flight from a full charge. |
| `glide_min_charge_ticks` | minimum charge to launch | 9 | ticks | `TUNE-P-021`. 9 of 36 ticks is 0.25 of the meter. A tap does not launch. |
| `takeoff_impulse` | upward velocity on launch | 8.0 | m/s | `TUNE-P-022`. |
| `takeoff_boost` | horizontal boost on launch | 3.0 | m/s | `TUNE-P-023`. |
| `glide_lift` | upward acceleration while gliding | 12.0 | m/s² | `TUNE-P-024`. Cancels half of `gravity` (24.0). |
| `glide_drag` | horizontal damping while gliding | 0.35 | /s | `TUNE-P-025`. Lower than normal air drag, so a glide travels further than a fall. |
| `dive_conversion` | fraction of the lift converted to forward speed | 0.80 | — | `TUNE-P-026`. |
| `recover_ticks` | recovery after landing / input release | 30 | ticks | `TUNE-P-027`. |

### 5.3 Interaction with the movement state machine

The glide is an **overlay**: `glide_state` is a field of the player record, not a replacement for
the movement state. While the glide is active the movement state is `jump` or `fall`. `glide_none`
means the glide overlay is inert. This keeps the 15-state machine of §3.4 intact and keeps the
glide absent from rule sets that do not enable it.

**Acceptance (`REQ-A-017`).** *Check:* the glide state diagram is exercised table-wise — every row
of §5.1 is driven by a scripted fixture and the resulting state matches; every (state, input) pair
marked illegal is rejected (pressing `move_down` in `glide_charging` does not dive; releasing
`run` with `glide_charge_ticks < glide_min_charge_ticks` does not launch); after a full charge and launch the
player travels measurably further horizontally than the same jump without a glide (the glide drag is
lower than the air drag); landing resets `glide_charge_ticks` to 0.

---

## 6. The rideable companion (`REQ-A-018`)

### 6.1 Contract

The companion is a separate actor (`kind: "companion"`) with **its own health, its own state
machine and its own damage events**. The player board owns the *behaviour contract* below; the
asset board owns the mesh and the clip set (see the ASSET GAP in §14 for the rig choice).

**Sockets (player side, rig-independent).** `saddle_socket` (the player's seat), `carry_socket`
(where the companion holds the player), `head_socket` (the origin of the tongue). Each is a named
offset on the companion's rig.

### 6.2 Companion state machine

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| `idle` | player enters `mount_radius` (1.5 m) | companion not stunned | the companion follows at `follow_distance` (2.5 m) | `follow` |
| `follow` | player mounts (`run` pressed) | player grounded, within `mount_radius`, companion not stunned | the player attaches to `saddle_socket`; `companion_mounted = true`; the player's own locomotion is suspended | `mounted` |
| `follow` | player leaves the radius (> 6 m) | — | the companion stops following and waits | `idle` |
| `mounted` | `interact` pressed | — | the player is placed at the dismount socket, `vel = 0`, state `idle`; the companion follows again | `follow` |
| `mounted` | the companion takes damage | the companion's health reaches 0 | the player is force-dismounted with 30 ticks of invulnerability; the companion is stunned | `stunned` |
| `mounted` | `interact` pressed near a consumable actor | the actor is within `eat_reach` (1.8 m) of `head_socket` | the actor is consumed; the score is credited to the player; `eat_cooldown` starts | `mounted` |
| `mounted` | `move_up` held inside a `carry_wall` volume | the companion can carry | the player attaches to `carry_socket` and rises with the companion | `carrying` |
| `carrying` | the companion reaches the top of the carry volume | — | the player is released at the top socket and falls | `mounted` |
| `mounted` | `run` pressed while the companion is stunned | — | the companion is launched at `spit_velocity` (10 m/s) with its collider enabled and `last_attacker_id` = the player | `spat` |
| `stunned` | `stun_ticks` (120) elapsed | — | the companion recovers | `follow` |
| `stunned` | the player presses `run` within `reclaim_radius` (2.0 m) | `reclaim_cooldown == 0` | the companion's health is restored by `reclaim_heal` (1); `reclaim_cooldown` = 30 ticks | `follow` |
| `spat` | it hits an actor | the actor is not immune | the actor takes `thrown` damage credited to the player | `stunned` |
| `spat` | `spat_lifetime` (180 ticks) elapsed | — | the companion is removed | `gone` |
| `gone` | the stage reloads | — | a fresh companion is instantiated at the stage's spawn | `idle` |

### 6.3 Rules

- **No duplication.** A stage declares at most one companion id. Mounting, dismounting, reclaiming
  and re-mounting never creates a second companion instance; the companion id is a stable key into
  the actor pool.
- **Independent damage.** A damage event targeting the companion never propagates to the player.
  The player takes no damage from the companion's body at any time (the companion's collider layer
  excludes the player).
- **Mounted movement.** While mounted the companion drives the player's X velocity at
  `mount_speed_scale` (0.9) of the profile's `run_speed`; the player cannot jump or skid; the
  player's facing drives the companion's facing.
- **Control on dismount.** The dismounted player is placed on a free position (the dismount socket
  is tested against the collision set; if blocked, the nearest free point on the companion's far
  side is used, and failing that the dismount is refused with a `denied` cue).

**Acceptance (`REQ-A-018`).** *Check:* a scripted mount → companion damage → forced dismount →
re-mount sequence leaves **exactly one** companion alive at every tick and applies the companion's
damage exactly once; the player takes zero damage from the companion's body; the dismounted player
is never inside a solid collider; a reclaimed companion does not duplicate the actor count.

---

## 7. The damage pipeline and the power-up state machine

### 7.1 The damage event (`REQ-A-019`)

The player **calls** the pipeline; it does not re-implement it (3D translation §3). One typed event,
one authority:

```
DamageEvent {
  source_id        : string
  target_id        : string
  damage_type      : enum { contact, stomp, projectile, thrown, moving_shell,
                            environment, crush, fall, poison }
  magnitude        : number        # health points
  contact_normal   : vec3
  impulse          : vec3
  invulnerable     : bool          # set by the pipeline, not by the source
  timestamp_tick   : uint64
}
```

### 7.2 Processing order (one tick)

| Step | Action | Owner |
|---|---|---|
| 1 | Gather events from the contact resolver (§3.6), hazard zones, projectiles (§8) and the world (crush, pit, poison). A player's special ability filters the contact set by target **tag** first (§4.2), so an immune target produces no event at all. | ENTITIES / WORLD |
| 2 | Deduplicate: the event bus rejects a duplicate `(source_id, damage_type, target_id)` within a tick | ARCHITECTURE (`REQ-E-003`) |
| 3 | **Invulnerability filter** — if `invulnerable_ticks > 0`, the event is *suppressed*: no health decrement, no power downgrade, no knockback, no state change. It is counted as `damage_suppressed` for telemetry. | PLAYER |
| 4 | **Resistance matrix lookup** — `(damage_type × target_state) → outcome ∈ {damage, ignore, bounce, reflect, shatter, phase_transition}`. Only `damage` proceeds to step 5. `reflect` and `bounce` are the player's *offensive* outcomes and are handled by the projectile state machine (§8). | ENTITIES (Board C) |
| 5 | **Apply** — knockback impulse; power downgrade or health decrement; set `invulnerable_ticks = 90` (`TUNE-013`); set the movement state to `hurt`; play the hurt cue; emit `hit_flash` and `hit_stop`. | PLAYER |
| 6 | **Death check** — if `health ≤ 0`, set the state to `dead` and publish `player_died`. | PLAYER |
| 7 | **Respawn** — §7.4. | PLAYER / WORLD |

The pipeline is a **pure function of the event list**; two events in the same tick are processed in
a deterministic order (sorted by `(damage_type ordinal, source_id, target_id)`), so a simultaneous
hit from two sources always produces the same result.

**Invulnerability.** `invulnerable_ticks = 90` (`TUNE-013`), set on every accepted hit and on
respawn. While it is greater than zero the player is invulnerable to **all** damage types, including
the environment and the pit — a pit fall is therefore fatal only outside the invulnerability window.
The player's visual flashes at 12 Hz during invulnerability; with `reduced_flashing` on (accessibility,
§10.4) the flash becomes a 6 Hz low-contrast pulse and a static outline replaces it entirely.

**Knockback.** `knockback = (−facing × 5.0, 6.0)` m/s (`TUNE-P-030`), applied as an impulse at the
start of the `hurt` state; the player has no control authority for `hurt_duration` = 24 ticks
(`TUNE-P-031`). Exceptions: Brindle's Shield Brace and Tallow's Quake Stomp stance each halve the
knockback.

**Health.** `max_health = 3` (`TUNE-P-028`). A health decrement occurs only when the power ladder
cannot absorb the hit (§7.5). Health is restored by a `restorative` item (world board).

**Fall and pit.** A landing with `\|vel.y\| > fall_damage_threshold` (14.0 m/s, `TUNE-P-029`) raises a
`fall` damage event of magnitude 1. A player whose `pos.y` drops below `bounds.min.y − 5` dies
immediately with `damage_type = environment`. The `grate` material skips the **pit** check (not the
fall damage).

### 7.3 `hurt` and `dead` behaviour

| State | Behaviour |
|---|---|
| `hurt` | Control authority 0; the knockback impulse is applied; the player keeps their `facing`; the `hit_flash` effect is emitted; the timer runs `hurt_duration` = 24 ticks, then the player returns to `fall` if airborne, else `idle`. |
| `dead` | The collision mask is empty (the player passes through geometry); the player plays the death clip; `death_timer` = 60 ticks; then the state becomes `transition` and the respawn is requested. `lives` is decremented at the moment of death. |

### 7.4 Death, checkpoint and respawn (`REQ-A-019`)

- The stage's checkpoint list (`src/content/stages/<id>.stage.json` → `checkpoints[]`) supplies the
  checkpoint id, its position and its `captures` array (for example `["transient_power_state"]`).
- On death the player respawns at the **last checkpoint reached in this stage** (or the stage's
  `entry_spawn` if none):
  - `pos` = the checkpoint position; `vel` = 0; `facing` = the checkpoint's authored facing.
  - `health = max_health`; `invulnerable_ticks = 90`.
  - The power ladder is restored to the checkpoint's **captured** value if
    `transient_power_state ∈ captures`, otherwise to `none`. The form axis is always cleared.
  - The stage's transient actors are reset and the camera is re-seeded with the stage bounds.
  - The coins/score/lives of the run are **not** rolled back (world board).
- If `lives` reaches 0 the game enters `game over` (world board, `REQ-B-002`).

**Acceptance (`REQ-A-019`).** *Check:* two damage events of the same type raised on consecutive ticks
inside the invulnerability window produce **one** health decrement and **one** knockback; a single
hit cannot remove more than one ladder step (`large → small`, never `large → none`); the player
returns to the checkpoint's recorded position after death with the health restored and the captured
power state; the death never removes more than one life.

### 7.5 The power-up state machine (`REQ-D-005`)

**Rule-set gate.** Power states exist only where `features.power_states: true`
(`world_map_suits`). Elsewhere the ladder is a single implicit state and every accepted hit
decrements health directly.

**The state is a product of two axes.**

```
ladder : none | small | large | projectile        (growth / capability)
form   : none | flight | aquatic | statue | hammer  (temporary transformed form)
memory : none | small | large | projectile          (the ladder remembered before a form)
```

- **Invulnerability is not a state.** It is a timed **modifier** (`modifier_timers.invulnerable`)
  with a duration, and it may coexist with any ladder/form pair. This is stated explicitly because
  REQ-D-005 lists it among the FSM's members.
- **The ladder is capped at `large`.** There is no tier above `large`; a growth pickup at `large` is
  consumed and discarded.
- **The form axis is orthogonal.** Entering a form stores the current ladder in `memory` and
  restores it on downgrade.

#### 7.5.1 Ladder transitions

| From \ Pickup | `small` | `large` | `projectile` (caster form) | accepted damage |
|---|---|---|---|---|
| `none` | → `small` | → `large` | → `projectile` (memory `none`) | → `none`, **health − 1** |
| `small` | → `small` (consumed, no change) | → `large` | → `projectile` (memory `small`) | → `none`, no health loss |
| `large` | → `large` (consumed, no change) | → `large` (consumed, no change) | → `projectile` (memory `large`) | → `small`, no health loss |
| `projectile` | → `small` | → `large` | → `projectile` (consumed, no change) | → `memory`; if `memory == none` then **health − 1** |

#### 7.5.2 Form transitions

| From \ Pickup | `flight` | `aquatic` | `statue` | `hammer` | damage |
|---|---|---|---|---|---|
| any ladder | form `flight`, memory = current ladder | form `aquatic`, memory = current ladder | form `statue`, memory = current ladder | form `hammer`, memory = current ladder | form cleared, ladder → `memory`; if `memory == none` then health − 1 |

#### 7.5.3 Form behaviours

| Form | Behaviour | Notes |
|---|---|---|
| `flight` | **Levitation**: `gravity_scale = 0`, `vel.y` clamped to `levitation_max_ascent` (3.0 m/s, `TUNE-P-032`), a form timer of `levitation_form_ticks` (480 ticks = 8 s, `TUNE-P-043`) that drains at `levitation_drain_ticks_per_s` (60, `TUNE-P-044`) and refills on the ground. No horizontal boost, no charge meter. | **Deliberately distinct from the `REQ-A-017` charge-glide**, which exists only in `branching_companion`. Levitation has no charge meter and no horizontal boost; the glide has both. They are never combined. |
| `aquatic` | Auto-buoyancy: the player rises to the surface without stroking and cannot be swept by a current. | A traversal upgrade, not a combat form. |
| `statue` | The player is immobilised (input locked) and is **immune to contact damage**; the form is used as a puzzle element (a weight/pressure switch). The player can still be crushed (crush damage applies). | Explicitly declared so the immunity is data, not an emergent bug. |
| `hammer` | The `run` action throws a hammer instead of casting a projectile; the hammer is a short-lived arcing projectile with a limited count (`hammer_count` = 6). | The hammer is a projectile (§8) with `pool_id: hammer`, `max_instances: 1`. |
| `projectile` (ladder) | The player is drawn as the **Vellum** form (KayKit `Mage`) and the `run` action casts a projectile. | Vellum is reserved for this form and appears nowhere else. |

#### 7.5.4 Priority rules

When two or more pickups are collected in the same tick:

1. A **ladder** pickup beats a **form** pickup.
2. Among ladder pickups: `projectile` > `large` > `small`.
3. Among form pickups: `hammer` > `flight` > `aquatic` > `statue`.
4. A pickup that resolves to "no change" is still **consumed** (it is removed from the world) and
   never stacks.
5. The consumption of the losing pickups is recorded so that the world board's "exactly one reward
   event" rule (§REQ-D-002) is not violated.

**Acceptance (`REQ-D-005`).** *Check:* the (current ladder, current form, pickup) table is
enumerated in a fixture — every pair resolves to the expected ladder/form/memory triple; the priority
rules are asserted with a same-tick double pickup; a downgrade from `large` yields `small` and never
`none` in one hit; a damage hit while in the `projectile` ladder returns the player to the ladder
value held in `memory`; the `flight` form applies levitation with no horizontal boost and no charge
meter.

---

## 8. Projectiles (`REQ-A-020`)

A projectile is an actor (`kind: "projectile"`) with its own archetype file. The **player board**
owns the player's projectiles (the caster form and the hammer form) and the pooling rules; Board C
owns enemy projectiles.

### 8.1 Projectile state machine

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| `spawn` | spawn delay elapsed | — | enable the collider; apply the initial velocity; stamp `spawn_tick` | `move` |
| `move` | contact with a collider | the collider's layer ∈ the projectile's mask **and** the faction is hostile **and** the resistance outcome is not `reflect` | emit the damage event with `source_id` = the owner | `hit` |
| `move` | contact with a collider | the resistance outcome is `reflect` | reverse the velocity about the contact normal; `source_id` = the reflector; `reflect_count` decrements | `bounce` |
| `move` | contact with a surface | `bounce_count > 0` | `bounce_count −= 1`; `vel.y` reflects with the archetype's `restitution` (**default 0.5**; the hammer overrides it to 0.45 — §8.4); `vel.x` keeps 0.8 of its magnitude | `bounce` |
| `move` | contact with a surface | `bounce_count == 0` | emit the hit event | `hit` |
| `move` | lifetime elapsed | `state_tick ≥ lifetime_ticks` | emit the exhaust event | `exhaust` |
| `move` | outside the stage bounds | — | — | `exhaust` |
| `bounce` | 1 tick elapsed | — | the reflected velocity is applied | `move` |
| `hit` | 1 tick elapsed | — | disable the collider; play the cue | `despawn` |
| `exhaust` | 1 tick elapsed | — | play the cue | `despawn` |
| `despawn` | — | — | return the instance to the pool; the scene-tree node count is **unchanged** | (pooled) |

### 8.2 Pooling

| Property | Value |
|---|---|
| Pool identity | `pool_id` on the projectile archetype; one pool per projectile type |
| Capacity | `max_instances` per pool; ≤ 128 per type and ≤ 512 pooled objects in total (architecture §9.3) |
| Acquire | Take a free instance. **If the pool is exhausted, the oldest live projectile is recycled** — "oldest" is `(spawn_tick, pool_slot)` ascending, never pointer order — and the recycle counter is incremented. This is the behaviour the architecture's `REQ-A-020` acceptance names. |
| Release | On `despawn`, the instance returns to the pool; its collider is disabled and its node is never removed from the scene tree. |
| Determinism | The pool's free list is ordered; the recycle order is deterministic, so a replay reproduces it exactly. |
| Budget report | The live/free/recycled counts and the recycle counter are published to the perf report (architecture §9.3). |

### 8.3 Collision groups

A projectile's archetype declares `collider.layer = "projectile"` and `collider.mask`, naming the
layers it may hit. The player's caster projectile uses the mask `["solid", "actor"]` and never hits
the player (the player's layer is excluded by construction — the mask is a whitelist, not a
blacklist). **A boss is an actor whose layer is `actor`**, so the same mask reaches a boss; if
Board C needs a distinct boss layer it must declare one in the sealed layer list (architecture §5.3
gives bosses `kind: boss`, not a layer of their own). A thrown or reflected object keeps
`last_attacker_id` so that the correct attacker is credited (3D translation §2.10).

### 8.4 The player's own projectiles

| | Caster (Vellum form) | Hammer (hammer form) |
|---|---|---|
| `speed_mps` | 14.0 | 11.0 |
| `gravity_scale` | 0.0 | 1.2 |
| `lifetime_ticks` | 150 | 90 |
| `bounce_count` | 0 | 1 |
| `restitution` | — | 0.45 |
| `damage` | 1 (`projectile`) | 1 (`thrown`) |
| `pool_id` / `max_instances` | `player_cast` / 2 | `hammer` / 1 |
| cooldown | 18 ticks | 24 ticks |
| Wind affected | yes (always) | yes (always) |

**Acceptance (`REQ-A-020`).** *Check:* a projectile spawned beyond `max_instances` returns the
oldest live projectile to the pool and the live count stays at the cap; a projectile past its
lifetime is returned to the pool, the scene-tree node count is unchanged and the free count rises; a
projectile whose mask excludes the player's layer passes through the player without emitting a
damage event; a projectile in a wind volume follows the wind-adjusted trajectory.

---

## 9. The camera rig (`REQ-B-003`)

**Authority.** This board is authoritative for the **follow algorithm** — dead zone, look-ahead,
vertical tracking, lane constraint, bounds clamping and the scripted-track mode. The world board is
the consumer and owns the **authored content**: the stage `bounds`, the `camera_zones` array and the
lane centres. This board does not restate the stage schema.

Implementation: `src/systems/camera/` (architecture §4.3: `attach(target)`, `update(dt)`,
`set_bounds(aabb)`, `play_track(track_id)`).

### 9.1 Rig parameters

| Property | Value | Source |
|---|---|---|
| Anchor | the player position + `camera_offset` (0, 2.2, −14.0) m | `TUNE-P-033` |
| Rotation | yaw 0° (looking down −Z), pitch −12°, roll 0° | `TUNE-P-034` |
| FOV | 55° vertical | `TUNE-P-035` |
| Lane | the camera's Z is the **authored lane centre** of the active camera zone, clamped to the stage bounds' Z range; it does **not** follow the player's Z except inside a lane transition volume | 3D translation §4 |
| Dead zone | 6 m (X) × 3 m (Y), from `camera_zones[].follow.deadzone` — the architecture's stage schema already carries `deadzone: [6,3]` | `TUNE-010` |
| Vertical dead zone | 3 m (Y) — the same authored rectangle; the vertical axis is tracked **softly** (a follow rate, not a hard edge), which is what stops a climb from jerking the frame | `TUNE-010` |
| Look-ahead | 4 m along X, clamped to ±`look_ahead_max` = 4 m | `TUNE-010` |
| Vertical follow rate | 6.0 /s (soft) | `TUNE-P-037` |
| Bounds | the stage's authored `bounds` | world board |

### 9.2 Per-tick algorithm

The rig updates **once per simulation tick** (not per rendered frame), so the camera is part of the
deterministic simulation.

1. **Target** = the player's position + `camera_offset`.
2. **Horizontal (hard, dead-zone locked).** Project the player's position into the camera's view
   plane. If `\|Δx\| ≤ deadzone_x / 2` the camera's X does not change. Otherwise the camera's X is set
   so that the player sits exactly on the nearer edge of the dead zone. There is no smoothing on X —
   this is the classic dead-zone behaviour and it is fully deterministic.
3. **Look-ahead.** `bias = look_ahead_x × clamp(vel.x / reference_speed, −1, +1)`, clamped to
   ±`look_ahead_max`; `reference_speed` is the active profile's `run_speed`. The bias is added to
   the dead-zone edge target, so the camera leads the player in the direction of travel.
4. **Vertical (soft).** If `\|Δy\| > vertical_deadzone / 2`, the camera's Y moves toward the target by
   `camera_y += (target_y − camera_y) × min(1, follow_rate × dt)`. Below the dead zone the camera
   does not move, so a climb does not jerk the frame.
5. **Lane.** `camera_z = the active camera zone's lane centre`, clamped to the stage bounds' Z
   range. Inside a lane transition volume the lane centre is the authored path value at the
   player's position along the volume, so the camera slides with the authored path rather than
   tracking the player's Z directly.
6. **Bounds (frustum-safe).** The camera's **visible volume** must never extend outside the authored
   bounds. The half-extents of the visible volume at the anchor distance are
   `half_h = tan(fov/2) × d` and `half_w = half_h × sim_aspect`, where `sim_aspect` is the **fixed
   simulation aspect** (16:9, `TUNE-P-041`), **not** the window's aspect. The camera's behaviour is
   therefore identical on any display or window shape; the renderer letterboxes around it. The
   camera's allowed centre range on each axis is
   `[bounds.min + half_extent, bounds.max − half_extent]`. The camera is
   clamped into that range **after** steps 2–5. If a range is inverted (the bounds are smaller than
   the frustum on that axis) the camera centres on that axis and the level linter reports the stage
   as `CAMERA-001 bounds smaller than the frustum` (architecture §7.3).
7. **Scripted track.** While a track is playing the rig outputs the interpolated keyframe pose
   instead of steps 2–5, and step 6 still applies. When the track ends the rig **re-seeds**: it
   computes the follow pose and sets the camera to it in a single step (no drift is carried over).

### 9.3 Bounds changes

`set_bounds(aabb)` is called on stage load, on a portal traversal and on a scene change. On a portal
traversal the new bounds are applied **within one tick** and the camera is re-seeded to the follow
pose under the new bounds, so a stale camera bound can never be observed (`REQ-B-010`).

### 9.4 Autoscroll stages

An autoscroll stage (world board, `REQ-B-012`) drives the camera with a **scripted track** whose
keyframes carry the X speed; the rig's follow algorithm is disabled for the duration of the track.
The trigger that starts the track belongs to the world board.

**Acceptance (`REQ-B-003`).** *Check:* over a 10,000-tick scripted path, all eight frustum corners
at every tick lie inside the stage's authored `bounds` — a single sample outside fails; while the
player is inside the dead zone the camera's X is byte-identical across two consecutive ticks; when
the player leaves the dead zone the camera's X moves exactly to the dead-zone edge; the camera's Z
does not change when the player's Z changes outside a lane transition volume; a portal traversal
re-seeds the camera within one tick with the destination's bounds.

---

## 10. Player-side UX: HUD, inventory, tutorials, accessibility

### 10.1 The HUD (`REQ-D-004`)

**Authority.** This board is authoritative for the **HUD state model** — which values exist, where
each comes from, and when the HUD refreshes. The world and entities boards consume it by publishing
the events that change those values.

**The view model.** The simulation publishes a read-only model; the `ui` system renders it
(architecture §4.3: "reads only through published view models"). The HUD **never** writes simulation
state.

```
HudModel {
  profile_id, profile_display_name     # from the player record
  profile_icon_asset_id                 # a named asset
  power_form, power_ladder              # "Large", "Caster", "Flight" …
  power_label                           # localised string key
  health, health_max                    # hearts / pips
  lives                                 # from the world graph
  coins, score                          # counters
  time_remaining_seconds                # integer, from the stage timer policy
  stage_id, stage_display_name, world_id
  checkpoint_id
  companion_state                       # none | following | mounted | stunned
  carry_item_id                         # null when not carrying
  glide_charge_ratio                    # 0..1, shown only while the glide is active
  tutorial_prompt                       # null or a prompt id
  caption_text                          # the caption line for non-audio cues
  invulnerable                          # drives the flash suppression
}
```

**Refresh triggers.** The model is rebuilt when any contributing value changes, and at most once per
rendered frame. A dirty bit per field is sufficient; the HUD reads the model, never the simulation.

**Elements and layout.**

| Element | Position | Source |
|---|---|---|
| Character status (icon + name + power label) | top-left | the player record |
| Health pips / lives | top-left, under the icon | the player record + the world graph |
| Coins and score | top-right | the counters |
| Time | top-centre | the stage `timer_policy` (world board) |
| Stage / world name | top-centre, under the time | the stage record |
| Companion state, carry icon, glide charge | contextual, bottom-left | the player record |
| Caption line | bottom-centre | the accessibility caption channel |

**Assets.** Text uses `kenvector_future.ttf` and `kenvector_future_thin.ttf` (CC0, the only .ttf in
the corpus). Icons are Kenney UI/icon PNGs registered in the asset manifest — the exact manifest ids
are an asset-board deliverable (§14, `AG-P-01`). If no icon is registered the HUD falls back to a
**text-only** HUD using the same font, which satisfies the requirement's substance (all six values
visible) without inventing art.

**Acceptance (`REQ-D-004`).** *Check:* at the stage spawn the HUD shows the profile, the stage id,
the full health, the starting coins, the starting lives and the starting time; after a pickup the
corresponding value changes by exactly the item's authored amount; after a save is reloaded the HUD
shows the reloaded values with no stale state; every HUD element is legible at UI scale 0.75 and 2.0.

### 10.2 Inventory (`REQ-D-013`)

**Authority.** This board is authoritative for the inventory model, the slot classes and the
consumption semantics. The world board consumes it at scene transitions.

**Slot classes.**

| Slot | Count | Scope | Consumed by |
|---|---|---|---|
| `world_use` | 1 | the world map | using the item on a node or a flag |
| `reserve` | 1 | anywhere | the "held item" slot |
| `stage_use` | `capacity(profile)` (default 2) | in-stage | using the item in a stage (a key, a consumable) |

**Data.**

```
Inventory {
  slots        : [{item_id, scope, consumed: bool, instance_id}]   # ≤ capacity
  reserve      : {item_id, consumed: bool} | null
  capacity     : int
  restrictions : {item_id -> profiles[] | min_carry_strength}
}
```

**Consumption semantics.** `consume(item_id, scope)` is **atomic and idempotent**:

1. The inventory finds the instance with the matching `item_id` and `scope` whose `consumed` flag is
   false.
2. It sets `consumed = true` **and** records the instance id in a `consumed_instances` list **in the
   same operation**. There is no window in which the item is neither consumed nor present.
3. The effect is applied by the consuming system.
4. The inventory snapshot is written to the save **before** the scene transition is executed
   (architecture §6.6 lists "stage exit" and "world-map node change" as full-slot saves), so a
   re-entering scene sees the consumed flag.
5. Calling `consume` again for the same instance is a no-op that returns `false`; it never applies
   the effect twice.

**Profile restrictions.** An item may declare `profiles: ["profile_sable"]` or
`min_carry_strength: 2.0`. The inventory refuses the item for a profile that does not satisfy the
restriction, the item is **not** consumed, and the refusal is surfaced as a `denied` cue and a
telemetry row.

**Acceptance (`REQ-D-013`).** *Check:* an item consumed in a stage is still consumed after the
scene transition and after a save/reload; `consume` called twice for the same instance applies the
effect once; the player cannot carry more than `capacity` items; an item restricted to a profile the
player does not use cannot be consumed and is not removed.

### 10.3 Tutorials (`REQ-D-019`)

**Authority.** This board is authoritative for the prompt behaviour, the one-at-a-time rule and the
persistence. The world board owns the **placement** of the trigger volumes and the signage props.

- A tutorial trigger is a volume with a `tutorial_id` and a predicate (the player's state, the
  region's progress, the number of deaths so far). It is evaluated by the interaction query
  (§3.5) exactly like a portal, but it never blocks movement.
- **One at a time.** The UI holds a single `active_tutorial` slot. A trigger that fires while
  another prompt is active is **queued**, not shown. When the active prompt is dismissed, the next
  queued prompt is shown.
- **Fire once.** Each `tutorial_id` is recorded in the save's `flags` map as `tutorial_<id>: true`
  when it is first shown. A seen tutorial never fires again in that save; a new save re-opens them.
- **Skipping never blocks progress.** A tutorial is never referenced by an exit's `requires`, a
  world's `flags`, or a puzzle predicate. Dismissing a prompt is always permitted with `jump`,
  `interact` or `pause`, and the prompt is closed.
- **In-world cues.** The prompt is a small panel anchored to the world position of the trigger,
  showing the control glyph (or the text label) and a one-line instruction. The stage also carries
  a signage prop (Kenney `sign`) placed by the world board for players who never trigger the panel.
- The prompt teaches **one** mechanic at a time; the content author is responsible for placing
  prompts in an order that introduces one idea per stage region.

**Acceptance (`REQ-D-019`).** *Check:* each tutorial trigger fires exactly once per save; a second
trigger firing while a prompt is active queues rather than replaces; dismissing a tutorial does not
change any exit's availability, and a stage with every tutorial skipped is completable. The
usability clause — a first-time playtester identifying move, jump, run, crouch and interact from
in-world cues alone — is a **manual** `NFR-04` check recorded in the playtest report, not an
automated gate, and is not claimed as discharged by this board.

### 10.4 Accessibility options (`REQ-D-020`)

**Authority.** This board is authoritative for the option set, its semantics, its persistence and
its application. The world board consumes it (in-world cues respect reduced flashing).

| Option | Values | Effect | Persistence key |
|---|---|---|---|
| `rebind` | the binding profile | §2.7 | `settings.bindings` |
| `reduced_flashing` | off / on | disables the 12 Hz invulnerability flash, the hit flash and the block-hit flash; replaces them with a static outline or a 6 Hz low-contrast pulse | `settings.reduced_flashing` |
| `ui_scale` | 0.75 … 2.00 | scales every HUD and menu element, including the font size; the layout re-flows, it does not clip | `settings.ui_scale` |
| `master_volume`, `sfx_volume`, `music_volume` | 0.0 … 1.0 | audio bus gains. The **music** slider is present even though the corpus has no music (§12): the bus exists with zero sources, and the slider must not error or mute the SFX bus | `settings.master_volume` etc. |
| `assist_mode` | off / on | multiplies `coyote_ticks` and `buffer_ticks` by 4 (capped at 30 each) and enables `assist.no_damage` (accepted hits deal no damage but still knock the player back) | `settings.assist_mode` |
| `assist.toggle_jump` | off / on | jump becomes a toggle: pressing jumps, pressing again in the air cuts the jump | `settings.assist_toggle_jump` |
| `captions` | off / on | a text line under the HUD names non-audio cues ("Pickup", "Stomp", "Goal", "Checkpoint") | `settings.captions` |
| `high_contrast_hud` | off / on | draws the HUD text and pips with a 2 px outline in a high-contrast pair | `settings.high_contrast_hud` |
| `colour_safe_palette` | off / on | replaces the four HUD status colours with a shape-and-pattern coding, so no status is conveyed by colour alone (`NFR-05`) | `settings.colour_safe_palette` |

**Persistence.** The options are written to `settings` in the save slot (architecture §5.7) **and**
mirrored to `userdata://settings.json`, so they apply before a save exists and survive a session
restart. Applying an option is immediate — the UI system applies it inside the setter, not on the
next tick.

> **`CB-01` — CLOSED 2026-10-30.** The save schema v5 (§5.7) listed `settings` with `locale`,
> `master_volume` and `reduced_flashing` only, so persisting bindings, assist options,
> `ui_scale`, the caption channel and the two HUD flags required **save schema v6** plus a
> **5 → 6 migration** row. **The architecture board now publishes v6** with all eight settings
> members and the migration row that fills them with their defaults and copies
> `reduced_flashing` verbatim; the default values are listed in §10.4. *No decision is
> outstanding.*

**Acceptance (`REQ-D-020`).** *Check:* each option is independently settable, survives a save/reload
and a full application restart, and changes the output within one frame of being applied; setting
`reduced_flashing` removes every flashing frequency above 3 Hz; setting `ui_scale` to 2.0 produces
no clipped label (verified with the 60 %-longer-locale fixture of `NFR-08`); `colour_safe_palette`
on removes every colour-only status distinction.

---

## 11. The input recorder, frame-step viewer and debug tools

### 11.1 The input recorder and frame-step viewer (`REQ-A-021`)

The recorder lives in `src/core/sim/` (architecture §4.1 lists "replay recorder" there); the viewer
lives in `src/systems/debug/` and is **excluded from release exports** (§11.2).

**Recorder.**

| Property | Value |
|---|---|
| What is recorded | Per tick: the action bitmask (`pressed`, `released`, `held`), `axis_x`, `axis_y` as **quantised int16**, and a state hash of the player record |
| Header | `stage_id`, `ruleset_id`, `profile_id`, `run_seed`, `fixed_hz`, `ticks_count`, `schema_version` |
| Storage | `tests/replays/<name>.replay.json` (fixtures) and `userdata://replays/` (captured runs) |
| Hash | the same canonical serialisation and SHA-256 as architecture §3.4's `LAUNCH_CHECKSUM`, so one gate serves both |
| Determinism | the recorded axes are integers and the actions are bitmasks, so the file is byte-identical for identical inputs on every machine |

The recorder is written **during** the simulation tick, so it never costs a frame: the recorder
appends one packed record per tick to a pre-allocated buffer.

**Frame-step viewer.** A debug UI that:

1. Loads a replay file and a stage.
2. Rebuilds the initial state from the header, then drives the **same** core update function with
   the recorded frames, one tick at a time.
3. Displays, for the selected tick: the player's position, velocity, facing, movement state, glide
   state, power state, the last contact set and the state hash.
4. Offers: play, pause, **step one tick**, step N ticks, step to the next state change, step to the
   next contact, and a speed control (0.25× … 8×) that changes how many ticks are executed per
   rendered frame — **never** the tick duration, so the simulation stays deterministic.
5. **Divergence detection:** the viewer runs the live simulation alongside the replay and compares
   the per-tick hash. The first tick where the hashes differ is highlighted with a side-by-side
   diff of the player record. This is the tool that turns "the movement feels wrong" into "the
   movement diverges at tick 412 because the friction profile was not applied on a conveyor".

**Acceptance (`REQ-A-021`).** *Check:* the fixture `walk_1000ticks` replayed in the viewer
reproduces the golden state hash at tick 1000 byte-for-byte; a replay with one input bit flipped
produces a different hash at the tick where the flip occurs; stepping the viewer one tick at a time
yields the same state sequence as the live run, and the divergence highlight appears on the first
differing tick.

### 11.2 Editor debug tools (`REQ-E-020`)

**Authority.** The architecture board owns the export filter and the release gate. This board
specifies the **player-facing verbs** and their acceptance.

| Verb | Behaviour | Notes |
|---|---|---|
| `teleport(target)` | move the player to a named target: a checkpoint id, a stage spawn id, a world coordinate, or the camera focus | the state machine is re-seeded exactly as on a respawn; the camera is re-seeded in the same tick |
| `set_invincible(bool)` | the player takes no damage; the HUD shows a `DEBUG` marker | implemented by setting the modifier timer to a large value, so it exercises the real pipeline rather than bypassing it |
| `set_speed(mult)` | 0.25× … 8× | implemented as **ticks per rendered frame**, not a changed tick duration, so determinism is preserved |
| `grant(item_id)` | add an item to the inventory and apply its effect | uses the inventory's public verbs; a grant of a power-up runs the real FSM |
| `unlock_gate(id)` | set a world flag and re-evaluate the unlocks | the world's public verbs; the world graph delta is applied idempotently |
| enemy visualiser | draw the colliders, state names, hitboxes and AI targets of every active actor | a debug overlay only; it is drawn by the debug system and never by a gameplay system |

**Production exclusion.** The requirement is that the debug entry points are **absent from the
exported binary and the scene tree** — a runtime boolean is not sufficient. Therefore:

1. `src/systems/debug/` is excluded from the release export by the export filter
   (architecture §7.8), not merely disabled.
2. The debug UI scene is not in the release scene list.
3. No other system may reference the debug system: the debug system's public verbs appear in **no**
   other system's `api.json`, and the module-boundary gate (architecture §4.3) fails the build if a
   non-debug system preloads anything under `src/systems/debug/`.
4. The `debug` autoload is registered only in a non-release build profile.
5. The speed multiplier, invincibility and teleport therefore **cannot be reached** in a shipped
   build — not even by a hidden key binding.

**Acceptance (`REQ-E-020`).** *Check:* in a production export the strings `teleport`,
`set_invincible`, `set_speed`, `grant`, `unlock_gate` and the debug scene's path do not occur in the
exported binary, and no node of the debug system exists in the scene tree of any scene; in a
development build all six verbs work, and `set_speed(0.5)` produces exactly the same per-tick
simulation as the unmodified run.

---

## 12. Animation, audio and the presentation assets

### 12.1 The canonical clip-role registry

Architecture `GAP-3D-008` requires one canonical vocabulary, because `Idle`/`Walk`/`Run` exist with
different lengths and semantics in the KayKit (76), Quaternius (17) and Kenney (25) sets. The player
board defines the **roles**; the asset board measures each rig's clip durations into the registry.

| Role | KayKit Adventurers (76 clips) | Kenney platformer cast (25 clips) | Quaternius (17 clips) |
|---|---|---|---|
| `idle` | `Idle` | `idle` | `Idle` |
| `walk` | `Walking_A` | `walk` | `Walk` |
| `run` | `Running_A` | `sprint` | `Run` |
| `sprint` | `Running_B` | `sprint` | `Run` |
| `skid` | `Walking_Backwards` | `walk` (reversed) | `Walk` (reversed) |
| `jump_rise` | `Jump_Start` → `Jump_Idle` | `jump` | `Jump` |
| `jump_apex` | `Jump_Idle` | `jump` | `Jump` |
| `fall` | `Fall` | `fall` | `Jump` |
| `land` | `Jump_Land` | `jump` | `Jump` |
| `crouch` | `Sit_Floor_*` (§14 `AG-P-02`) | `crouch` | `SitDown` |
| `climb` | `Climbing` (KayKit Character Animations 1.2) | `walk` (vertical, 0.5×) | `Walk` (vertical, 0.5×) |
| `swim` | **blend** (see below) | **blend** | **blend** |
| `glide` | **blend** (see below) | **blend** | **blend** |
| `charge` | **blend** (see below) | **blend** | **blend** |
| `cast` | `Spellcast_Shoot` | `attack-melee-right` | `Shoot_OneHanded` |
| `throw` | `Throw` | `attack-kick-right` | `Punch` |
| `block` | `Blocking` | `static` | `Idle` |
| `spin` | `2H_Melee_Attack_Spinning` | `attack-kick-right` | `Punch` |
| `hurt` | `Hit_A` | `die` (short) | `RecieveHit` |
| `die` | `Death_A` → `Death_A_Pose` | `die` | `Death` |
| `victory` | `Cheer` | `emote-yes` | `Victory` |
| `carry` | `PickUp` (held) | `holding-both` | `Walk_Carry` |
| `interact` | `Interact` | `interact-right` | `Idle` |
| `hover` | `Jump_Idle` (held) | `jump` (held) | `Idle` (held) |
| `levitation` | `Jump_Idle` (held) | `jump` (held) | `Idle` (held) |

**Clip durations are measured, not guessed.** The registry records each rig's clip length; the
animation layer cross-fades when a clip's real duration differs from the state's nominal duration.

### 12.2 `GAP-A10` — the states with no authored clip

**The measured gap.** No clip set in the corpus covers **swimming, gliding, flight, charging or
climbing** (the Kenney 27-clip set has none; KayKit adds `Jump_Full_Long` and `Spellcast_*` but no
swim or glide). `ASSET-SURVEY` `GAP-A10` names `REQ-A-009`, `REQ-A-014`, `REQ-A-017` as blocked.

**The resolution, state by state.**

| State | Resolution | Detail |
|---|---|---|
| **climb** | **Named rig covers it.** | The `Climbing` clip from **KayKit Character Animations 1.2** (same KayKit skeleton family, so it attaches to the 41-joint map without a new family map) is the climb animation for all four profiles. **Fallback** if the attach fails the golden retarget test: `Walking_A` played at 0.5× with the root constrained to the ladder axis. If neither works, the state is declared an ASSET GAP (`AG-P-03`). |
| **swim** | **Runtime blend of existing clips.** | A two-way runtime blend between `Fall` (weight 0.65) and `Idle` (weight 0.35), with the blend factor driven by the vertical velocity. Runtime blending for playback is explicitly permitted (architecture §8.3 forbids *authoring* a blended clip **file**, not runtime blending). No authored swim clip exists; the residual gap is declared in §14 (`AG-P-04`). |
| **glide** | **Named clips, per `G-03` (a).** `Jump_Full_Long` is the launch clip and `Fall` is the held glide clip — a **suspended fall**, because the corpus has no wing-spread pose. *Behavioural difference:* there is no wing-spread or wing beat; the glide reads as a suspended fall on the authored `Fall` clip. | 
| **charge** | **HUD cue + scale ramp, per `G-04` (c).** There is **no in-mesh wind-up pose**. The charge is communicated by the `TUNE-P-021` charge meter (HUD), the `FX-005` concentric-ring telegraph and a uniform scale ramp on the existing rig (`root_node_transform`, architecture §8.3a). *Behavioural difference:* the charge duration is read from the telegraph's progress rather than from an actor animation — which is a *better* cue than an animation would be. |
| **flight (levitation form)** | **Existing clip, held.** | `Jump_Idle` played as a loop for the levitation form; there is no dedicated flight clip and none is needed for a stationary hover. No residual gap. |
| **spin** | **Existing clip.** | `2H_Melee_Attack_Spinning` exists in the 76-clip set. No gap. |

**Rule.** The blends above are **runtime blends of authored clips**, never a new clip file. The
`gate/no-procedural-art` check (§8.4) is unaffected because no clip file is written.

### 12.3 The audio mapping

The corpus has **78 inventory rows** (the architecture's measured breakdown: 52 `.ogg` + 24 `.flac` +
2 `.wav`, 66 unique basenames) and **zero music**. This design consumes the **52 `.ogg` files only**
(40 gameplay SFX + 12 footsteps); the `.flac` duplicates are not shipped.

| Cue id | Source file | Used for |
|---|---|---|
| `cue.jump.tallow` | `jump-b.ogg` | Tallow's jump |
| `cue.jump.brindle` | `jump-a.ogg` | Brindle's jump |
| `cue.jump.sable` | `jump-c.ogg` | Sable's jump |
| `cue.jump.moth` | `jump-d.ogg` | Moth's jump |
| `cue.land` | `Fantozzi-StoneL1.ogg` | landing thud |
| `cue.skid` | `Fantozzi-SandL1.ogg` | skid dust |
| `cue.step.sand` / `cue.step.stone` | `Fantozzi-Sand*` / `Fantozzi-Stone*` | footsteps, by material |
| `cue.coin` | `coin-a.ogg` | currency |
| `cue.pickup` | `coin-b.ogg` | item pickup |
| `cue.hurt` | `hurt-a.ogg` | player hurt |
| `cue.die` | `lose-a.ogg` | player death |
| `cue.break` | `explosion-a.ogg` | block break |
| `cue.ground_pound` | `explosion-b.ogg` | Tallow's Quake Stomp |
| `cue.select` | `select-a.ogg` | menu confirm |
| `cue.move` | `move-a.ogg` | menu move |
| `cue.error` | `error-a.ogg` | a refused action |
| `cue.cast` | `shoot-a.ogg` | the caster projectile |
| `cue.throw` | `shoot-c.ogg` | throwing an object |
| `cue.spin` | `shoot-d.ogg` | Sable's Spin Vault |
| `cue.mount` / `cue.dismount` | `select-a.ogg` / `move-a.ogg` | companion mount / dismount |
| `cue.checkpoint` | `coin-c.ogg` | checkpoint reached |

**The four missing sounds, with their substitutes and their named gaps.**

| Needed | Substitute shipped | Named gap | Effect on the design |
|---|---|---|---|
| **Splash** (entering water) | `fall-a.ogg` — a descending whoosh | **`GAP-AUD-01`** — no water/splash file exists | The water entry is audible but does not read as water. The design does **not** depend on it: the water state change is communicated visually (the camera and the character's `swim` blend). |
| **Swim stroke** | `Fantozzi-SandR2.ogg` — a soft rustle | **`GAP-AUD-02`** — no stroke file | The stroke is audible; the rhythm is the cue. |
| **Climb step** | `Fantozzi-StoneL1.ogg` | **`GAP-AUD-03`** — no climb file | Same treatment. |
| **Glide wind bed** | `fall-b.ogg`, looped with `audio_loop_tag:fall-b` (the loop points lie inside the clip's existing range, which is permitted) | **`GAP-AUD-04`** — no glide file | The glide has a continuous wind bed; the charge meter is communicated visually. |

**No music.** There are **zero** music files in the corpus (verified across all 22 archives,
architecture §2.3). The audio system must therefore start, duck and stop with zero music cues and
report `UNSOURCED` rather than fail closed (architecture §7.5). This board adds no music cue and
does not depend on one: the HUD, the power-up forms and the tutorials are all communicated visually
and through the SFX above.

### 12.4 Fonts and the rebind glyphs

| Use | Asset | Status |
|---|---|---|
| HUD and menu text | `kenvector_future.ttf` (CC0) | Resolved — the only `.ttf` in the corpus. |
| Large titles | `kenvector_future_thin.ttf` (CC0) | Resolved. |
| Rebind prompt glyphs | `shorepine-kenney.zip!icons/Input Prompts/Generic/` and `shorepine-kenney.zip!icons/Input Prompts/Keyboard & Mouse/` — the **trademark-free families only** | **Resolved — manifest row `IN-017`, `SHIPPABLE`, CC0-1.0.** Every console-manufacturer-branded family is excluded from the shipped set. The larger `kenney-cc0-game-art-packs.zip` prompt set (2,733 files) is **measured but not shipped**, because its families carry console-manufacturer trademarks. **Fallback, if a glyph is ever missing:** the rebind UI shows a **text label** for the control (`A`, `B`, `LB`, `RB`, `SPACE`, …) rendered in `kenvector_future.ttf`, which needs no 2D art at all and is therefore safe under every ship profile. |

---

## 13. Constants — the player TUNE / UNVERIFIED register

**Where the constants live.** Architecture §5.1 gives each rule set exactly one `constants_ref`.
Therefore:

- **Rule-set-scoped** constants live in `src/content/tuning/<ruleset_id>.tune.json`.
- **Profile-scoped** constants live in the profile's actor archetype
  `src/content/characters/<profile_id>.character.json` (§4.1) — this is what makes `REQ-A-015`
  data-driven.
- Each ruleset's tune file is **complete for that rule set**: the content pipeline emits it from a
  common base plus the rule set's overrides, so a ruleset never depends on a file the schema does
  not reference.

**No value below is claimed to be a publisher constant.** `GAP-001` (acceleration, friction, gravity,
run speed, jump impulse) and `GAP-002` (hitbox geometry) remain open; the architecture's
`UNVERIFIED-001/002` cover them and this board adds no new claim.

**Reserved ids.** `TUNE-P-001` and `TUNE-P-002` are **reserved and unused**: the values they would
have held (the profile's base acceleration and the base run speed) live in the profile archetype
JSON of §4.1, which is the authoritative home for profile-scoped data. The series therefore starts
at `TUNE-P-003`. `TUNE-P-008` is reserved for the stomp threshold pair and is likewise unused — see
its row below.

| Id | Constant | Default | Unit | Rationale |
|---|---|---|---|---|
| TUNE-P-003 | `sprint_ratio` | 0.95 | — | The fraction of `run_speed` at which the state becomes `sprint`. A hysteresis band of 5 % keeps the state from flickering. |
| TUNE-P-004 | `facing_flip_dead_speed` | 0.6 | m/s | Above this speed an opposing input produces a **skid**, not a turn, so a running player does not flip mid-stride. |
| TUNE-P-005 | `ground_probe_distance` | 0.12 | m | The downward probe length used for the grounded test (3D translation §2.3). Small enough to stay correct on slopes, large enough to survive a 1 u grid. |
| TUNE-P-006 | `max_substep_travel` | 0.25 | m | The maximum distance a collision sub-step may travel. 0.25 m is a quarter of the 1 u grid cell, so no collider thinner than 25 cm can be tunnelled. |
| TUNE-P-007 | `max_depenetration_iterations` | 4 | — | The maximum contact-resolution iterations per sub-step. Bounded so a corner case cannot stall a tick. |
| TUNE-P-008 | *(reserved)* | — | — | Reserved for the stomp threshold pair. **Not used**: `stomp_min_descent` (0.5) and `stomp_normal_threshold` (0.7) are fixed by 3D translation §2.4 and are not this board's to tune. |
| TUNE-P-009 | `stomp_bounce_impulse` | 7.5 | m/s | The upward velocity after a stomp. Below the base profile's jump impulse (9.0), so a stomp bounce is always a shorter hop than a jump. |
| TUNE-P-010 | `surface_boost_impulse` | 8.0 | m/s | The impulse that lifts the player out of water at the surface. |
| TUNE-P-011 | `stroke_cooldown_ticks` | 18 | ticks | 0.3 s between swim strokes; a stroke pressed inside the window is rejected, not buffered. |
| TUNE-P-012 | `water_swim_accel` | 6.0 | m/s² | The horizontal acceleration in water, deliberately different from every land value so the two curves differ at every sample tick (`REQ-A-009`). |
| TUNE-P-013 | `carry_socket_offset` | (0.0, 1.05, 0.55) | m | The named socket offset on the player's rig (not a hand bone — the Kenney rigs have no hand socket). |
| TUNE-P-014 | `grab_radius` | 1.25 | m | The distance within which the `run` action starts a grab. |
| TUNE-P-015 | `grab_windup_default_ticks` | 21 | ticks | The fallback grab wind-up (0.35 s) for a profile that declares none. All four profiles declare their own `grab_ticks` (19–36 ticks), so this value is a default, not the operative one. |
| TUNE-P-016 | `throw_impulse` | 9.0 | m/s | The throw's speed along the facing axis, added to the player's current X velocity. |
| TUNE-P-017 | `climb_speed` | 3.0 | m/s | The direct vertical speed while climbing — no acceleration, so the climb is precise. |
| TUNE-P-018 | `jump_hold_max_ticks` | 14 | ticks | 0.233 s. The hold window is **bounded**, which is what makes the apex a finite, measurable number (see the curve in §4.1 and `CB-05`). |
| TUNE-P-019 | `pound_radius` | 2.0 | m | The radial reach of Tallow's Quake Stomp. |
| TUNE-P-020 | `glide_drain_ticks_per_s` | 33 | ticks/s | ≈0.55 /s — the charge consumed per second in flight, giving ≈1.8 s of flight from a full charge. Expressed in ticks so the meter never carries a float. |
| TUNE-P-021 | `glide_min_charge_ticks` | 9 | ticks | The minimum charge needed to launch; 9 of 36 ticks is 0.25 of the meter. A tap does not launch. |
| TUNE-P-045 | `drop_through_time` | 15 | ticks | 0.25 s. How long a one-way platform's collider stays suppressed after the drop-through action is pressed (§3.11). Long enough to clear the platform's thickness, short enough that a held crouch cannot drift the player through a whole stack. **One id per constant** — `TUNE-P-021` remains `glide_min_charge_ticks`. |
| TUNE-P-022 | `takeoff_impulse` | 8.0 | m/s | The upward velocity on a glide launch. |
| TUNE-P-023 | `takeoff_boost` | 3.0 | m/s | The horizontal boost on a glide launch. |
| TUNE-P-024 | `glide_lift` | 12.0 | m/s² | Cancels half of `gravity` (24.0), so a glide descends slowly. |
| TUNE-P-025 | `glide_drag` | 0.35 | /s | Lower than the normal air drag, so a glide travels measurably further than a fall — the `REQ-A-017` acceptance. |
| TUNE-P-026 | `dive_conversion` | 0.80 | — | The fraction of the lift converted into forward speed on a dive. |
| TUNE-P-027 | `recover_ticks` | 30 | ticks | The glide's recovery after landing, input release or a ceiling hit. |
| TUNE-P-028 | `max_health` | 3 | — | The health ceiling. Three hits kill a player at the bottom of the ladder. |
| TUNE-P-029 | `fall_damage_threshold` | 14.0 | m/s | The vertical speed above which a landing hurts. With `gravity` 24, this is a fall of ≈4.1 m. |
| TUNE-P-030 | `knockback` | (−5.0, 6.0) | m/s | The horizontal/vertical knockback impulse, applied away from the damage source's facing. |
| TUNE-P-031 | `hurt_duration` | 24 | ticks | 0.4 s of control lock-out after an accepted hit. |
| TUNE-P-032 | `levitation_max_ascent` | 3.0 | m/s | The maximum upward speed while the `flight` power-up form is active. |
| TUNE-P-033 | `camera_offset` | (0, 2.2, −14.0) | m | The camera's offset from the player anchor. |
| TUNE-P-034 | `camera_rotation` | yaw 0°, pitch −12° | ° | A side-on framing with a slight downward tilt, so the lane reads as a lane. |
| TUNE-P-035 | `camera_fov` | 55 | ° | The vertical field of view; the frustum half-extents derive from it. |
| TUNE-P-036 | *(reserved)* | — | — | Reserved. The vertical camera dead zone uses architecture `TUNE-010`'s single 6 × 3 m authored rectangle, so no separate vertical value is needed. |
| TUNE-P-037 | `camera_y_follow_rate` | 6.0 | /s | The soft vertical follow rate. |
| TUNE-P-038 | `input_deadzone` | 0.15 | — | The default radial dead zone for analogue sticks, per axis. |
| TUNE-P-039 | `crouch_height` | 1.0 | m | The capsule height while crouched. A 1 u block leaves a 1.0 u gap under it, so crouching lets the player pass under a single block. |
| TUNE-P-040 | `ability_chord_ticks` | 6 | ticks | 0.1 s of holding `interact` before the profile's special ability engages. Long enough that a portal press is never mistaken for a chord, short enough to feel immediate in the air. |
| TUNE-P-041 | `sim_aspect` | 16:9 | — | The **fixed simulation aspect** used to derive the camera's frustum half-extent. It is independent of the window, so the camera's bounds behaviour is identical on every display; the renderer letterboxes around it. |
| TUNE-P-042 | `glide_charge_full_ticks` | 36 | ticks | The translation's `glide_charge_time` 0.60 s expressed as ticks at `fixed_hz` 60. The glide meter is an integer tick count, never a float. |
| TUNE-P-043 | `levitation_form_ticks` | 480 | ticks | 8 s of levitation, the duration of the `flight` power-up form. |
| TUNE-P-044 | `levitation_drain_ticks_per_s` | 60 | ticks/s | The levitation form's drain rate; the meter refills on the ground. |

**UNVERIFIED (player additions).**

| Id | Item | Status |
|---|---|---|
| UNVERIFIED-P-001 | The exact member names of KayKit's `Sit_Floor_*` and `Sit_Chair_*` globs | **Not measured.** The canonical role `crouch` resolves them through the clip registry measurement (architecture §5.8 `clips`). Until then the crouch role falls back to `Unarmed_Pose`. |
| UNVERIFIED-P-002 | The clip names of the Quaternius *Ultimate Animated Animals* pack (`White Horse`, 13 clips) | **Not measured** — only the clip count is known. Affects the companion's clip mapping (§6), not its behaviour. |
| UNVERIFIED-P-003 | The clip durations of the KayKit 76-clip set per role | Measured by the asset board's clip-registry step; the animation layer cross-fades on a duration mismatch rather than assuming one. |

---

## 14. Asset gaps and dependencies

No visual or audio element is invented anywhere in this design. The rows below are the places where
the design needs something the repository has not yet been shown to contain, each naming the
requirement it affects.

| Id | Gap | Blocks | Handling |
|---|---|---|---|
| **AG-P-01** | The HUD icon set (a profile icon, a health pip, a coin, a life, a power-state icon) has **no registered manifest id** | `REQ-D-004` (icon sub-clause only) | The HUD is specified to degrade to a **text-only** HUD in `kenvector_future.ttf` if no icon is registered. The requirement's substance (all six values visible) is met either way. |
| **AG-P-02** | The KayKit `Sit_Floor_*` clip member names are not measured | `REQ-A-015`'s crouch animation | Fallback role: `Unarmed_Pose`. See `UNVERIFIED-P-001`. |
| **AG-P-03** | The `Climbing` clip's attachability to the KayKit 41-joint map is unproven | `REQ-A-014`'s climb animation | Fallback: `Walking_A` at 0.5× on a vertical ladder. The behaviour is unaffected either way. |
| **AG-P-04** | **No swim clip exists** in any measured set (`GAP-A10`) | `REQ-A-009`'s animation | A runtime blend of `Fall` + `Idle` (§12.2). The residual gap is declared, not hidden. |
| **AG-P-05** | **No glide clip exists** (`GAP-A10`) | `REQ-A-017`'s animation | **Decided (`G-03` (a)):** the named clip `Jump_Full_Long` launches and the named clip `Fall` is held for the glide. No wing-spread pose exists and none is fabricated. The behaviour is fully specified. |
| **AG-P-06** | **No charge clip exists** (`GAP-A10`) | `REQ-A-017`'s charge animation | **Decided (`G-04` (c)):** there is **no in-mesh wind-up pose**. The charge is the HUD meter (`TUNE-P-021`) plus the `FX-005` ring telegraph plus a uniform scale ramp on the existing rig. The behaviour is fully specified. |
| **AG-P-07 — RESOLVED 2026-10-30** | **No rideable companion rig with a measured clip list** existed | `REQ-A-018`'s *visual* acceptance only | **Resolved by `BLOCKED-P-02`:** the asset board names **`prototype/animal-horse.glb` (clips `walk, run, down, up`) as the rideable mount `EN-046`**, `ShibaInu.gltf` as `CO-004` and `Fox.gltf` as `CO-005`. All CC0-1.0 and `SHIPPABLE`. The behaviour contract (§6) stays rig-independent; the visual half is now specified to an asset id. |
| **AG-P-08 — RESOLVED 2026-10-30** | The rebind prompt glyphs were cited from the **branded** pack (`kenney-cc0-game-art-packs.zip!assets/kenney/input-prompts/` — an earlier draft counted 2,719 files; the measured count is **2,733**), which has no registered manifest entry and whose families include console-manufacturer trademarks | `REQ-A-001`'s rebind UI | **Resolved by `IN-017`:** the rebind prompts ship from **`shorepine-kenney.zip!icons/Input Prompts/Generic/`** and **`shorepine-kenney.zip!icons/Input Prompts/Keyboard & Mouse/`** — the **trademark-free families only** (590 shipped PNG glyph files: 74 + 516) — registered as `IN-017`, `SHIPPABLE`, `CC0-1.0`. Every branded family (Nintendo, PlayStation, Xbox, Meta Quest, Steam Deck, Playdate) is **excluded by the trademark decision**, not by a licence gap, and the licence gate fails the build if a manifest row resolves into one. The text-label fallback in `kenvector_future.ttf` stays the degradation path when a family is missing. |
| **GAP-A1** | **Zero music files** in the corpus (verified across all 22 archives) | `REQ-D-015` (world board) | No player-side design depends on music. The `music_volume` accessibility slider must not error with an empty bus. |
| **GAP-A10** | No swim / glide / flight / charge / climb clip set covers the mechanic | `REQ-A-009`, `REQ-A-014`, `REQ-A-017` | §12.2. |
| **GAP-AUD-01** | No splash sound | `REQ-A-009` | Substituted with `fall-a.ogg`. |
| **GAP-AUD-02** | No swim-stroke sound | `REQ-A-009` | Substituted with `Fantozzi-SandR2.ogg`. |
| **GAP-AUD-03** | No climb sound | `REQ-A-014` | Substituted with `Fantozzi-StoneL1.ogg`. |
| **GAP-AUD-04** | No glide sound | `REQ-A-017` | Substituted with a looped `fall-b.ogg`. |

**Dependencies on other boards.**

| Dependency | On | Needed for |
|---|---|---|
| The `kaykit_41` bone map and its golden retarget test | ARCHITECTURE | Every profile's animation (`OPEN-006` is **resolved** by the requester's decision: the four profiles use KayKit Adventurers rigs) |
| The clip-registry measurement (role → clip → duration per rig) | ASSETS | §12.1's canonical role table |
| The resistance matrix's `stomp` / `contact` rows and the target tags `spin_vulnerable`, `spin_immune`, `pound_vulnerable` | ENTITIES | `REQ-A-016`'s acceptance |
| The stage schema's `bounds`, `camera_zones`, `checkpoints` and `timer_policy` | WORLD | §9 (camera), §7.4 (checkpoint) |
| The item archetypes for the power-ups (`small`, `large`, `projectile`, `flight`, `aquatic`, `statue`, `hammer`) | ENTITIES / WORLD | §7.5's FSM |

---

## 15. Blocked items and cross-board decisions

### 15.1 `BLOCKED` — a decision this board cannot take alone

| Id | Item | Why it is blocked | The smallest decision needed | Owner |
|---|---|---|---|---|
| **BLOCKED-P-01 — RESOLVED 2026-10-30** | **Persisting rebindings and the accessibility options in the save.** `REQ-A-001` (remappable) and `REQ-D-020` (settings persist across sessions) both require the settings to survive a restart. The save schema v5 (`DESIGN-3-ARCHITECTURE` §5.7) defined `settings` with only `locale`, `master_volume` and `reduced_flashing`, and the schema rejected unknown keys. | The save schema's required shape is owned by ARCHITECTURE; a player board cannot change it. | **DONE — the architecture board's save schema is now v6**, adding `settings.bindings`, `settings.input`, `settings.assist_mode`, `settings.assist_toggle_jump`, `settings.ui_scale`, `settings.captions`, `settings.high_contrast_hud` and `settings.colour_safe_palette`, with the default values listed in §10.4, the existing `reduced_flashing` copied verbatim, and a `5 → 6` migration row. **Closed by `CB-01`.** | Closed |
| **BLOCKED-P-02** — **RESOLVED 2026-10-30** | **The companion's rideable rig and its clip list** (`AG-P-07`). The behaviour is fully designed (§6) and the acceptance test for `REQ-A-018` is rig-independent, but the *visual* half of the requirement (a companion the player can see mount, ride and reclaim) could not be specified down to an asset id. | The corpus contains no measured, skinned, rideable rig with a known clip list; the Quaternius animals pack's clip names were `UNVERIFIED-P-002`. | **RESOLVED — the asset board has named the rigs.** The asset board's manifest registers **`prototype/animal-horse.glb` (clips `walk, run, down, up`) as the rideable mount `EN-046`**, **`assets/glTF/ShibaInu.gltf` (12 clips) as the small companion `CO-004`**, and **`assets/glTF/Fox.gltf` (12 clips) as `CO-005`** — all CC0-1.0 and `SHIPPABLE`. The mount's measured clip list is `walk, run, down, up`. `REQ-A-018` is therefore **no longer behaviour-only**. | ASSETS — closed |

### 15.2 Cross-board items (not blockers — decisions this board has taken and asks to be confirmed)

| Id | Item | What this board decided | Asked of |
|---|---|---|---|
| **CB-01 — CLOSED 2026-10-30** | The save schema v6 fields (same subject as `BLOCKED-P-01`) | The field list and the defaults are in §10.4. | **CLOSED — the architecture board's save schema is now v6**, carrying the eight settings fields (`bindings`, `input`, `assist_mode`, `assist_toggle_jump`, `ui_scale`, `captions`, `high_contrast_hud`, `colour_safe_palette`) with a `5 → 6` migration row. `BLOCKED-P-01` is closed with it |
| **CB-02 — CLOSED 2026-10-30** | `branching_companion`'s `carry_throw` flag | The 3D translation (§5) assigns carry/throw to the `carry_throw` rule set, so `branching_companion` has `carry_throw: false`. Architecture §5.1's *illustrative* JSON showed `true`. | **CLOSED — the architecture board's illustrative example now reads `carry_throw: false`**, matching this board and the translation. The five rule sets are separated (§2.2) |
| **CB-03 — CLOSED 2026-10-30** | The gate for the traversal glide | The charge-glide is gated by `movement_profile: glide_v1` (so `branching_companion` only); `features.flight` gates the *power-up levitation form* (so `world_map_suits` only). The two are deliberately different mechanics and never coexist. No new feature flag is added. | **CLOSED — no new feature flag was added.** The architecture board's feature table carries both `movement_profile` and `features.flight` as distinct gates, and the anti-mash validator (§5.1) asserts they never appear in the same rule set |
| **CB-04 — CLOSED 2026-10-30** | The player capsule wording | 3D translation §0 stated "1.6 u tall, 0.7 u radius"; architecture `TUNE-011` states "radius 0.35 m, height 1.75 m". This board uses **radius 0.35 m, height 1.75 m** (`TUNE-011`), reading the translation's "0.7 u" as the 0.7 u footprint **diameter**, which the measured Kenney cast bounds (0.7 m wide) corroborate. | **CLOSED — the translation contract's §0 wording was aligned** to "radius 0.35 m, height 1.75 m (0.7 m footprint diameter)". Both registers now publish one capsule, and the measured cast bounds corroborate it |
| **CB-05** — **CLOSED 2026-10-30** | The jump apex figure. The three documents previously disagreed: architecture `TUNE-003` said "≈1.69 m", the 3D translation said "≈3.2 blocks", and this board's bounded-hold model computes a **per-profile** apex (Tallow 3.16 m, Brindle 2.68 m, Sable 2.43 m, Moth 2.81 m). | The single figure "≈1.69 m" was **stale** — it never matched the bounded-hold model. The resolution is not one number but **four**, because `REQ-A-015` requires a per-profile jump height. | **CLOSED — all three documents now publish the same per-profile table**, with the **base profile Brindle at 2.68 m** as the shared default and the conservative reachability bounds (**2.43 m vertical, 5.43 m horizontal**) stated for level design. See `DESIGN-3-ARCHITECTURE.md` `TUNE-003`, `3D-TRANSLATION.md` §2.2 and this board's §4.1. |
| **CB-06 — CLOSED 2026-10-30** | `OPEN-006` is resolved | The requester's decision fixes the four profiles on the **KayKit Adventurers** rigs (41 joints). This requires the `kaykit_41` bone map and its golden retarget test from the architecture board, and it is the reason every animation role in §12.1 maps to the 76-clip KayKit vocabulary. | **CLOSED as a decision — the architecture board's `OPEN-006` is closed** and §2.2 names `kaykit_41` as a required bone map with the **golden retarget test** that proves the mapping is lossless in both directions. *Remaining work, not an open question:* the bone map and that test are **written during development** and are a **GATE 2** blocker — the master's `DEL-02` |
| **CB-07 — CLOSED 2026-10-30** | The camera's vertical dead zone | The 3D translation says the vertical axis uses "a **larger** dead zone"; architecture `TUNE-010` and the stage schema both fix the rectangle at `[6, 3]`. This board uses the authored **6 × 3 m rectangle** for both axes and achieves the anti-jerk behaviour with the **soft vertical follow rate** (§9.1), not with a wider band. | **CLOSED — the single authored rectangle `[6, 3]` plus a soft Y follow rate is normative.** The translation contract was amended to state it in the same terms, and the world board's `cz_climb` zone now uses `[6, 3]` as well. No board may widen the rectangle per zone. |

### 15.3 Resolved in this document

| Question | Answer |
|---|---|
| Which rule set owns the charge-glide? | `branching_companion` only (`movement_profile: glide_v1`). |
| Which rule set owns the levitation power-up? | `world_map_suits` only (`features.flight`). |
| Which rule set owns carry/throw? | `carry_throw` only. |
| Which rule set owns the mount? | `branching_companion` only (`features.mount`). |
| Where do power states exist? | `world_map_suits` only (`features.power_states`). |
| Which action is the "action button"? | `run` (the master's "run/action"). There is no `cast` or `attack` action in the sealed vocabulary. |
| How does the player perform a special ability? | By holding `interact` (plus `jump` for Sable's grounded spin). `interact` displaces no existing behaviour. |

---

## 16. Acceptance-test index

Every id this board owns, with the check that can fail.

| Req | The check | §|
|---|---|---|
| REQ-A-001 | A scripted press/release of each of the nine actions emits exactly one press and one release, identically in a menu and in play. | §2.8 |
| REQ-A-002 | The golden replay `walk_1000ticks` yields the identical transform (≤1e-6 m) and the identical state hash at tick 1000 at 30, 60 and 120 rendered FPS. | §1.3, §3.1 |
| REQ-A-003 | The 1-tick tap reaches an apex at least 40 % below the full-hold apex; the full-hold apex clears a 1 u block. | §3.2, §4.1 |
| REQ-A-004 | A jump 3 ticks after a ledge is accepted when `coyote_ticks ≥ 3` and rejected at 0; a jump 1 tick before landing is accepted only when `buffer_ticks ≥ 1`; the two settings are independent. | §3.3 |
| REQ-A-005 | All fifteen states declare an explicit allowed-input set (an **empty** set for the input-locked `hurt`, `dead` and `victory` states, which is a deliberate, declared choice), ≥1 collision rule and ≥1 outgoing transition; a state with neither an `on` nor a `next` entry fails schema validation; the scripted stream visits the states in the documented order. | §3.4 |
| REQ-A-006 | Sweeping across a 1.0 m solid at `run_speed` over 120 sub-steps produces no pass-through; a 0.1 m one-way platform is never tunnelled from above. | §3.5 |
| REQ-A-007 | A descending contact emits `damage_type = stomp` and a defeat event credited to the player; a lateral contact emits `damage_type = contact`; an immune target produces no damage event; a rising player never registers a stomp. | §3.6 |
| REQ-A-008 | A pipe traversal fires only inside the volume with the matching direction; a wrong direction or an out-of-radius press emits nothing; a blocked destination is refused. | §3.7 |
| REQ-A-009 | The water speed curve differs from the land curve at every sample tick; a stroke inside the cooldown produces no impulse. | §3.8 |
| REQ-A-010 | A projectile's landing point shifts ≥ 5 cm downwind; toggling the wind mid-flight produces no per-tick discontinuity > 1 cm. | §3.9 |
| REQ-A-011 | The same 60-tick input on ice, mud, conveyor, quicksand and solid yields five distinct final X positions, ordered `ice > conveyor > solid > mud > quicksand`. | §3.10 |
| REQ-A-012 | Rising through a one-way platform produces no contact; falling onto it does; holding `crouch` during the jump also produces no contact. | §3.11 |
| REQ-A-013 | The carried object stays at the socket (±1 cm) with no collision, and after a throw has collision and the configured release velocity; an over-weight object is never lifted; a thrown object credits the thrower. | §3.12 |
| REQ-A-014 | Reversing at either ladder endpoint exits cleanly; pressing into a solid wall never detaches the player and never places the player inside a collider. | §3.13 |
| REQ-A-015 | The four profiles produce four distinct values for time-to-apex, top speed and grab time, read from data rather than from a conditional in code. | §4.1 |
| REQ-A-016 | A spin damages a `spin_vulnerable` target and emits **no** damage event on a `spin_immune` target; the pound damages only within its radius; the brace halves the damage magnitude; the hover drains its meter at a constant rate. | §4.2 |
| REQ-A-017 | Every row of the glide transition table is driven by a fixture; every pair marked illegal is rejected; a glide travels measurably further than the same jump without one; landing resets the charge. | §5 |
| REQ-A-018 | Mount → damage → dismount → re-mount leaves exactly one companion alive at every tick, applies the companion's damage exactly once, and never places the dismounted player inside a collider. The companion is a **named, measured rig** — `EN-046` (`prototype/animal-horse.glb`, clips `walk, run, down, up`) as the rideable mount, `CO-004` (`ShibaInu.gltf`) and `CO-005` (`Fox.gltf`) as the small companions — so the visual half is specified, not deferred (`BLOCKED-P-02` resolved). | §6.3 |
| REQ-A-019 | Two damage events inside the invulnerability window produce one health decrement and one knockback; one hit removes at most one ladder step; the respawn restores the checkpoint's captured state. | §7.2, §7.4 |
| REQ-A-020 | Spawning beyond `max_instances` recycles the oldest live projectile; an expired projectile returns to the pool with the scene-tree node count unchanged; the mask excludes the player. | §8 |
| REQ-A-021 | The fixture replay reproduces the golden hash at tick 1000; a single flipped input bit produces a different hash at that tick; the viewer's divergence highlight appears on the first differing tick. | §11.1 |
| REQ-B-003 | All eight frustum corners lie inside the authored bounds at every tick of a 10,000-tick path; the camera's X is unchanged inside the dead zone and moves exactly to the edge outside it; the Z does not follow the player outside a lane transition. | §9.2 |
| REQ-D-004 | The HUD shows the correct profile, stage, health, coins, lives and time at spawn, after a pickup and after a reload, with no stale state. | §10.1 |
| REQ-D-005 | The (ladder, form, pickup) table resolves every pair to the expected triple; the priority rules hold for a same-tick double pickup; a downgrade removes one step only. | §7.5 |
| REQ-D-013 | An item consumed in a stage is still consumed after the transition and after a reload; `consume` twice applies the effect once; the capacity is never exceeded; a profile-restricted item is not consumable and is not removed. | §10.2 |
| REQ-D-019 | Each trigger fires once per save; a second trigger queues rather than replaces; skipping changes no exit's availability and a stage with every tutorial skipped is completable. **The "a first-time playtester identifies the controls" clause is a manual `NFR-04` check, not an automated gate, and is not claimed as discharged here.** | §10.3 |
| REQ-D-020 | Each option is independently settable, persists across sessions and changes the output within one frame; reduced flashing removes every flash above 3 Hz; the palette option removes every colour-only distinction. | §10.4 |
| REQ-E-015 | A gamepad hotplugged during play is accepted after a pause/resume; conflicting inputs resolve by the configured policy; a disconnect releases every held action. | §2.8 |
| REQ-E-020 | In a production export the debug entry points are absent from the binary and the scene tree; in a development build all six verbs work and `set_speed(0.5)` does not change the per-tick simulation. | §11.2 |

---

## 17. Definition of done for this document

- [x] All 29 ids this board owns appear with a behaviour, the data that carries it, the algorithm or
      state machine, and a falsifiable acceptance test (§16).
- [x] Every state machine has an explicit transition table with the columns
      *from · event · guard · action · to*.
- [x] Every timer is an integer **tick** count and is registered in §13 with a `TUNE` mark, a unit
      and a rationale.
- [x] No publisher constant is claimed; `GAP-001` and `GAP-002` are cited as open.
- [x] The five rule sets are allocated feature-by-feature (§0.3) and no mechanic is blended across
      them.
- [x] The four profile names are as decided: **Tallow**, **Brindle**, **Sable**, **Moth** (with
      **Vellum** reserved as the caster form).
- [x] `GAP-A10` is resolved state by state with a named clip, a runtime blend or a declared gap
      (§12.2); the four missing sounds are substituted and named (§12.3).
- [x] Shared ids state which board is authoritative (§0.1).
- [x] Two `BLOCKED` items and seven cross-board items are raised with the smallest decision needed
      (§15).

### 17.1 Checks actually run against this document

| Check | Result |
|---|---|
| **Jump arithmetic** — the apex heights, apex times and the release-tick table in §4.1 were recomputed from the stated `jump_impulse`, `gravity` 24.0, `gravity_scale`, `jump_hold_gravity_scale` and the 14-tick hold window, in Python, at `fixed_hz` 60. | **One error found and fixed**: the first draft's "time to jump apex" column quoted free-flight figures (`v/g`), ignoring the hold window and `gravity_scale`. Corrected to 0.545 / 0.503 / 0.472 / 0.591 s, with the apex heights 3.16 / 2.68 / 2.43 / 2.81 m. The table is now labelled the *continuous* reference, with the semi-implicit Euler tolerance stated. |
| **Cross-reference sweep** — every `TUNE-P-0nn` id in the body was matched against the §13 register; the `REQ-` id census was re-run. | Clean: 42 register rows, no body reference without a register row, no missing `REQ` id, no stale parameter name after the metre-to-tick conversion. `TUNE-P-001/002/008/036` are documented as reserved. |
| **Cursor senior review** — the document was passed to the Cursor headless agent (`cursor agent --print --mode ask`) for a defect review. | **31 findings returned; all 31 addressed.** The material ones: an inverted conflict-policy rule (§2.4), a stomp/immunity contradiction between §3.6's table and its acceptance test, a missing `carry` return path from the air states, `locomotion_state` used as a transition target, a dead-zone value contradicting `TUNE-010`, a duplicated grab wind-up, a `"boss"` layer outside the sealed layer list, float game meters contradicting the tick-timer rule, a window-dependent camera aspect, unspecified map iteration order, and an unfalsifiable acceptance clause on `REQ-D-019`. |
| **Markdown / structure** — heading order, table column counts, the 15-state list and the 29-row acceptance index were checked mechanically. | Clean: 15 states, 29 acceptance rows, no broken tables. |

**Unverifiable in this environment.** This is a design document: nothing here has been executed.
No engine is installed on this machine (architecture §2.4), so no fixture, replay or gate has been
run against this design. Every acceptance test in §16 is written to be executable by the
implementation, and **none of them has been observed to pass**. The checks in §17.1 are checks on
the document, not on the game.

---

*End of DESIGN-3 — PLAYER SYSTEMS.*

