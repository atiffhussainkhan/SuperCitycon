# THE 3D TRANSLATION CONTRACT

**Binding on all five boards.** The reference mechanics are 2D. This game is 3D. This file
is the single authority for how each 2D-era mechanic becomes a 3D mechanic. If a board
document contradicts this file, **this file wins** and the board must be corrected.

Every rule here is written so that it can be implemented and tested. Every number that
the publishers never published is marked `TUNE` and carries a rationale.

---

## 0. The frame of reference

- The world is a real 3D space with gravity on **−Y**.
- The **traversal axis is X** (left/right). The **lane** is the Z axis. The **height**
  is Y.
- "Side-scrolling" means the camera is constrained to a **lane** (a narrow Z band) while
  following the player along X. It does **not** mean the world is a 2D plane.
- Units: **1 world unit = 1 metre**. The player capsule is **1.75 m tall with a 0.35 m
  radius — a 0.7 m footprint diameter** (`TUNE-011`). (Reconciled with the architecture
  board's `TUNE-011` and the player board's `CB-04`: the earlier "1.6 u tall, 0.7 u radius"
  wording was ambiguous between a radius and a diameter. **Radius 0.35 m, height 1.75 m.**
  The 0.7 m footprint width is corroborated by the measured Kenney cast bounds. No publisher
  constant is claimed.)
- The **simulation runs at a fixed 60 Hz** (`fixed_hz: 60`). Rendering is decoupled and
  may run at any rate. `REQ-E-002`, `NFR-02`.

---

## 1. Grid and cell semantics (the 2D "tile" becomes 3D)

The source document's tilemap becomes a **3D occupancy grid**. The grid is an authoring
convenience only; **every cell resolves to a named repository asset**.

| 2D concept | 3D form |
|---|---|
| Tile layer | Grid cell → `asset_id` + `collision_profile` + `material` |
| Solid tile | Axis-aligned box collider (or the asset's measured footprint collider) |
| One-way platform | Box collider with a **one-sided normal**: collision only when the player's velocity into the face is negative-Y relative to the face |
| Slope tile | Rotated box collider; the slope angle is a property of the asset, never generated |
| Background layer | **Separate visual rig**, not cells: skybox + parallax backdrop planes + fog volume |
| Foreground layer | Instanced visual-only props with no collider |
| Screen / room | **Volume bounds** in world space (the camera's authored bounds) |
| Screen scroll | Camera translation along X inside those bounds |

`REQ-B-001`, `REQ-D-001`.

### 1.1 Collision materials

Every collider carries exactly one `material` tag. The material drives friction,
acceleration, sound and particle choice — **never** the mesh. This is what makes
`REQ-A-011` (ice / mud / conveyor / quicksand / slippery) work without one-off code.

| Material | Ground friction | Ground accel | Notes |
|---|---|---|---|
| `solid` | 1.0 | 1.0 | default |
| `ice` | 0.02 | 0.25 | low friction, low accel — long slide (`TUNE`) |
| `mud` | 2.2 | 0.6 | high drag, sinks (`TUNE`) |
| `quicksand` | 3.0 | 0.4 | sink volume, slow ascent (`TUNE`) |
| `conveyor` | 1.0 | 1.0 | adds a surface velocity vector (`conveyor_speed`, `TUNE`) |
| `bouncy` | 1.0 | 1.0 | adds a launch impulse on contact (`TUNE`) |
| `slippery_grunt` | 0.35 | 0.8 | mid-slip surface |
| `grate` | 1.0 | 1.0 | does not trigger the pit-death check |
| `hazard` | 1.0 | 1.0 | collision enabled; triggers the hazard event, not a damage response from the collider itself |

All values are `TUNE` and live in the ruleset, not in code. `REQ-A-011`, `REQ-D-001`.

---

## 2. The move set, in 3D

### 2.1 Ground movement (`REQ-A-002`)

- Acceleration is applied **along X only** while grounded. There is no strafe axis —
  the player faces ±X.
- The **lane (Z) is locked** by default: the player's Z stays at the lane centre. This
  is what makes the game read as side-scrolling while being genuinely 3D. The lane
  centre may shift when the player traverses a **lane transition volume** (a sloped
  path, a doorway, a drifting platform), and the shift is authored, never automatic.
- **Friction** is material-driven: `ground_friction` decelerates X velocity when no
  movement input is held; `ground_accel` accelerates it when input is held.
- **Skid**: when the input opposes velocity above a speed threshold, the player enters
  the `skid` state — reduced control authority, increased deceleration, and a
  `skid_dust` FX event. `REQ-A-005`.

### 2.2 Variable jump (`REQ-A-003`)

3D form of jump-hold + cut-off:

1. On jump press, apply `jump_impulse` along +Y.
2. While the jump button is **held** and vertical velocity is still positive, apply
   `jump_hold_gravity_scale` (a gravity multiplier, **less than 1**) — this is the hold
   window.
3. On jump **release** while vertical velocity is positive, apply the **apex cut-off**:
   vertical velocity is clamped to `jump_cutoff_velocity_scale × current`, and gravity
   returns to full.
4. A **ceiling bump** cancels the hold window and zeroes +Y velocity.

The acceptance test: a short press produces a measurably lower apex than a full hold.
`TUNE` values: `jump_impulse 9.0`, `jump_hold_gravity_scale 0.45`,
`jump_cutoff_velocity_scale 0.4`.

**The apex is per-profile, not one number.** Under the **bounded-hold** model (the hold
window ends after `jump_hold_max_ticks` = 14 ticks, `TUNE-P-018`), the full-hold apex is:

| Profile | `jump_impulse` | `jump_hold_gravity_scale` | **Full-hold apex** |
|---|---|---|---|
| Tallow | 9.6 m/s | 0.38 | **3.16 m** |
| **Brindle** (base profile) | **9.0 m/s** | **0.45** | **2.68 m** |
| Sable | 9.2 m/s | 0.62 | **2.43 m** |
| Moth | 8.4 m/s | 0.55 | **2.81 m** |

The values above are the shared defaults for the **base profile**, which is what this
contract states; the other three are the profile table in `DESIGN-3-PLAYER.md` §4.1.
(Reconciled with the architecture board's `TUNE-003` and the player board's `CB-05`: the
earlier single figure of "≈1.69 m" is **withdrawn** — it was stale and never matched the
bounded-hold model. The apex is a **target** measured by the model, not a publisher
constant.)

**Level-design reachability therefore uses the conservative profile:** a mandatory vertical
step must be ≤ **2.43 m** (Sable, the lowest apex) and a mandatory horizontal gap must be
≤ **5.43 m** (Brindle, the smallest `2 × time_to_apex × run_speed`).

### 2.3 Coyote time and jump buffer (`REQ-A-004`)

Both are **independently** tuneable and default-adjustable in the options menu.

- **Coyote time**: after leaving a ledge, the player may still jump for
  `coyote_window` seconds. **`TUNE-004` = 6 ticks (0.100 s)**.
- **Jump buffer**: a jump pressed up to `jump_buffer_window` seconds **before** landing
  is honoured on the landing frame. **`TUNE-005` = 8 ticks (0.133 s)**.
- Both default to **on** (accessibility) and both can be set to 0.

**3D note:** the "ledge" is a **grounded-contact test**, not a 2D edge test. The player is
grounded if a downward probe (or a downward velocity component) finds a collider with
the `solid` material within `ground_probe_distance`. This is what makes coyote time work
correctly on slopes and moving platforms in 3D.

### 2.4 Stomp (`REQ-A-007`, `REQ-C-003`)

The 2D "overlap the enemy's head" test becomes an explicit **downward-arc stomp test**:

A stomp is registered when **all** of the following hold at the contact tick:
1. The player's vertical velocity is **strictly negative** (`vy < -stomp_min_descent`,
   `TUNE 0.5`).
2. The contact normal between the player's feet collider and the target's top collider
   has a **+Y component ≥ `stomp_normal_threshold`** (`TUNE 0.7`).
3. The player was airborne in the previous tick (so a grounded player standing on a
   target is not stomping).

This test is **direction-vector based, not sprite-overlap based**, and it is
direction-agnostic in Z: the player may stomp from any side of the target's X face,
because the test uses the contact normal, not the X overlap alone.

### 2.5 One-way platforms (`REQ-A-012`)

A one-way platform is a collider with a **single permitted normal** (+Y). Collision
resolves only when the player is moving **against** that normal (downward relative to
the +Y face). Passing upward through it is always allowed. Jump-through is enabled by
holding the crouch action.

### 2.6 Portals: pipes, doors, ladders (`REQ-A-008`, `REQ-D-011`, `REQ-B-010`)

A portal is a **volume with a facing predicate**, never a tile index.

| Portal | Predicates |
|---|---|
| Pipe (forward) | Player inside the pipe volume **and** pressing the action **and** facing within `portal_facing_tolerance` of the pipe axis (`TUNE 25°`) **and** the destination is not blocked |
| Pipe (vertical) | Same, with a vertical axis tolerance |
| Door | Player inside the door volume and pressing action; no facing requirement |
| Ladder / vine | Player inside the ladder volume; vertical motion is clamped to the ladder axis while `climbing` |

On a successful portal traversal the player is placed at the destination's
`return_portal` with the camera re-seeded from the destination's bounds (no stale camera
bounds). `REQ-B-010`.

### 2.7 Water (`REQ-A-009`)

Water is a **volume**, not a tile type, so the player can be half in and half out.

- Inside the volume: gravity scale `water_gravity_scale` (`TUNE 0.35`), a **drag**
  coefficient on velocity, a **buoyancy** force when the player is below the surface,
  and a swim-stroke impulse on a repeated action press.
- The **surface interaction** is a separate state: at the water surface the player can
  jump out (a single "surface boost" impulse, `TUNE`) and can move along the surface.
- Swimming and landing use **different movement curves** — that is the acceptance test
  for `REQ-A-009`.

### 2.8 Wind (`REQ-A-010`)

Wind is a **directional vector field volume**. It applies an acceleration to the
player **only while airborne**, and to projectiles always.

- `wind_volume`: an oriented box with a direction vector, a magnitude, and an optional
  `falloff` curve (uniform / linear along the volume's local Z).
- The acceleration is applied **after** gravity and **before** the integration step, so
  the trajectory is predictable and free of jitter (the acceptance test for `REQ-A-010`).
- A wind volume is a **volume**, so the player can be inside a gust and outside it in
  the same frame — the field is sampled at the player's centre.

### 2.9 Flight and glide (`REQ-A-017`)

- **Charge meter**: hold the action to charge; the meter fills over `glide_charge_time`
  (`TUNE 0.6 s`) and drains in flight.
- **Take-off**: releasing the charge applies a takeoff velocity along +Y plus a
  horizontal boost.
- **Lift**: while gliding, an upward lift force partially cancels gravity.
- **Dive**: a downward input converts lift into forward speed.
- **Drag**: while gliding, horizontal velocity is damped by a lower coefficient than normal
  air drag, so a glide travels further than a fall.
- **Recovery**: releasing all input or touching the ground resets the charge to 0.
- The state diagram is: `grounded → charging → gliding → recovering → grounded`, with
  `gliding → falling` when the charge empties.

### 2.10 Carry, throw, lift (`REQ-A-013`)

- A carried object is parented to a **socket transform** (a named offset on the
  player's rig, not a hand bone — Kenney rigs are static and have no hand socket).
- The carried object **has no collider while carried** — it collides only when released.
- **Throw** applies a release velocity composed of the player's current X velocity plus
  `throw_impulse` along the facing axis.
- **Weight**: each carryable object declares a `weight` class; a profile's
  `carry_strength` decides whether it can be lifted at all, and how quickly
  `grab_speed` reaches full speed.
- **Ownership**: a thrown object carries a `last_attacker_id` so that if it hits a boss,
  the **correct attacker** is credited. `REQ-C-014`, `REQ-C-018`.

### 2.11 Climb (`REQ-A-014`)

While inside a ladder volume the player is in `climbing`: vertical velocity is driven
directly by input, horizontal movement is locked to the ladder axis, and the player
cannot detach into a solid wall — a solid overlap forces an immediate exit at the
nearest free endpoint.

---

## 3. Damage, immunity and the resistance matrix (`REQ-C-003`)

One typed damage event, one authority. **Board A and Board D call this; they do not
re-implement it.**

```
DamageEvent {
  source_id        : string     // who caused it
  target_id        : string
  damage_type      : enum { contact, stomp, projectile, thrown, moving_shell,
                            environment, crush, fall, poison }
  magnitude        : number     // in health points
  contact_normal   : vec3       // from the contact resolver
  impulse          : vec3       // knockback
  invulnerable     : bool       // set by the pipeline, not the source
  timestamp_tick   : uint64
}
```

**The resistance matrix** is a data table, keyed by
`(damage_type × target_state) → outcome`, where `outcome ∈ {damage, ignore, bounce,
reflect, shatter, phase_transition}`. The target's `immunities` list is one column of
that table. `REQ-A-007`, `REQ-C-003`.

**Attribution**: when a stomp defeats an actor, `source_id` is the player. When a
thrown actor or a reflected projectile defeats a boss, `source_id` is the **original
attacker**, carried through the throw chain. `REQ-C-018`.

---

## 4. Camera (`REQ-B-003`)

A 3D follow rig with a lane constraint.

| Property | Behaviour |
|---|---|
| Anchor | Player position + `camera_offset` |
| Lane | The camera's Z is clamped to the **authored lane band** of the stage volume; it does not follow the player's Z unless a lane transition volume is active |
| Dead zone | A rectangle in view space; the camera moves only when the player leaves it |
| Look-ahead | The camera biases along X by `look_ahead × velocity.x`, clamped to `look_ahead_max` |
| Vertical | The camera tracks Y within the **same authored rectangle** as the X axis, and uses a **soft vertical follow rate** rather than a wider band, so climbs do not jerk. (Reconciled with the player board's `CB-07`: the architecture board's `TUNE-010` and the stage schema both fix the rectangle at `[6, 3]`; the anti-jerk behaviour comes from the follow rate, not from a larger rectangle. **One rectangle, both axes, plus a soft Y rate.**) |
| Bounds | The camera is clamped to the stage's authored `bounds` volume — **it can never show outside them** |
| Scripted track | A stage may define camera keyframes that override the rig during a scripted sequence |

The acceptance test for `REQ-B-003` is that the camera's visible volume never extends
outside the authored bounds — enforced by a test that samples the camera frustum corners
against the bounds volume.

---

## 5. Rule sets (never mashed) (`REQ-E-007`)

The five rule sets are **separate, selectable configurations**. A stage names exactly
one. Switching rule sets never mutates saved data unexpectedly.

| Rule set | Movement profile | Features |
|---|---|---|
| `classic_ground` | `ground_v1` | momentum running, variable jump, no glide, no carry |
| `challenge` | `ground_hard_v1` | lower grip, faster enemies, tighter timers, no checkpoints at half-stage |
| `carry_throw` | `ground_carry_v1` | carry/throw enabled, weight classes, throw chains |
| `world_map_suits` | `suit_v1` | transformation states, world inventory, secret exits |
| `branching_companion` | `glide_v1` | charge-glide, mount/dismount, branching exits |

A mechanic that exists in one rule set and not another is **absent** in the other, not
behaving slightly differently. This is the rule the source document calls "keep
inspiration profiles per game" and it is enforced by the ruleset schema.

---

## 6. The original-IP boundary

- Reference-game names appear in this project **only** as **research tags** beside a
  behavioural archetype, e.g. `shell_retract_kick` *(research tag: SMB1 shell creature)*.
- **No reference name appears in shipped content**: no character, enemy, boss, stage,
  item, world, sprite, mesh, animation, music or dialogue.
- **Silhouette separation is mandatory.** Where an archetype derives from a reference
  creature, the shipped design must differ in silhouette, proportion and colour so the
  result reads as an original design rather than a recolour.
- The design document's own verification gate checks this mechanically
  (`tools/verify_design.py`, IP-leakage check).

---

## 7. The no-procedural-art rule

> Every mesh, texture, animation, skybox, background, UI element, icon and sound in the
> shipped game is a **named file that exists in the image repository**, recorded in the
> asset manifest with its exact path, pack and licence. The pipeline may **measure and
> register** an asset — world-space bounds, footprint, scale, ground offset, orientation,
> compression — but it may **never author** one. No procedural geometry, no
> runtime-generated texture, no shader-only character, no primitive-composition actor.
> Compositing library assets into a level is allowed; fabricating an asset is not.
> If an element has no file, it is an **ASSET GAP** row naming the requirement it
> blocks — never a placeholder.

Enforced mechanically by `tools/verify_design.py` (asset-path resolution and
procedural-language checks) and by the CI licence/asset gate in the architecture board.
