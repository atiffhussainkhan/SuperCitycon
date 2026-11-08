# DESIGN-3 — ENTITIES, ENEMIES, BOSSES, COMBAT

**Board C authority.** `REQ-C-001 … REQ-C-020`; the entity half of `REQ-D-002`,
`REQ-D-003`, `REQ-D-010`, `REQ-D-014`; the entity consumer half of `REQ-E-004`,
`REQ-E-011`, `REQ-E-016`.

| | |
|---|---|
| **Status** | DESIGNED — every row below carries a falsifiable acceptance test. **No item is blocked pending cross-board sign-off.** The three cross-board notes this board raised — `XN-ENT-02` (the ship-set amendment, §12), `XN-ENT-09` (the runtime-transform vocabulary, §14) and `XN-ENT-10` (the archetype schema's example vocabulary, §14) — have all been **answered by the architecture board** and are recorded as **CLOSED** below. |
| **Binding inputs** | `3D-TRANSLATION.md` (grid/cell model, stomp test, damage event, camera, rule sets, IP boundary) · `DESIGN-3-ARCHITECTURE.md` §4 module contract, §5.3 actor archetype schema, §7 CI gates · `MASTER-REQUIREMENTS.txt` §5 taxonomy |
| **Date** | 30 October 2026 |
| **Language** | British English. `TUNE` marks a value this project chooses; no publisher constant is claimed anywhere in this document. |

---

## 0. Scope, authority and how to read this document

### 0.1 What this board owns, and who owns what beside it

The combat pipeline has **one authority**. This board is that authority for the
damage event, the resistance matrix and the enemy/boss finite-state machine.
**Board A (player) and Board D (objects) call it; they do not re-implement it.**

| Concern | Owner | Consumed by | Contract |
|---|---|---|---|
| `DamageEvent` type, damage-type enum, resistance matrix, outcome vocabulary | **ENTITIES (this board)** | Board A (player damage, invulnerability, knockback), Board D (hazard events, block damage, spring launches) | `src/core/damage/` — engine-agnostic, no engine types (ARCH §4.2) |
| Enemy / boss FSM runtime, actor base, pooling, activation regions | **ENTITIES** | Board B (stage composition), Board A (pickup, carry/throw, mount) | `src/systems/actors/` — public verbs `spawn`, `despawn`, `activate_region`, `actor_count` (ARCH §4.3) |
| Player-side damage *response* (health decrement, power downgrade, knockback application, invulnerability window) | **PLAYER (Board A)** | — | reads the outcome from the matrix; never re-derives it |
| World-side damage *emission* (spikes, lava, saw, crusher) | **WORLD (Board D)** | — | emits a `DamageEvent` with `damage_type: environment`; the matrix decides the outcome |
| Collision, materials, zones (water/wind), kinematic mover, contact resolution | **PHYSICS (ARCH)** | all boards | `src/systems/physics/` |

The rule, stated once: **a damage source emits an event; the matrix decides the outcome;
the target's owner applies the consequence.** No system outside `src/core/damage/` may
branch on `damage_type` to decide what happens. A gate rule (`ci/gate/damage-authority.sh`,
added by this board, see §9.3) fails the build if any file outside `src/core/damage/`
contains a branch on a `damage_type` literal.

### 0.2 Reference families are research tags only

The taxonomy in `MASTER-REQUIREMENTS.txt` §5 lists reference-game families and
example names. **Both are research tags.** They appear in this document only, and
never in `src/content/`. The shipped content uses the generic archetype slugs given
in §4 of this board (e.g. `shell_retract_kick`, `pipe_emerge_gated`). The IP gate
(`tools/verify_design.py`, ARCH §6) checks shipped content, not design prose; the
family codes below are the same codes the taxonomy already uses.

**Silhouette separation is mandatory** (3D-TRANSLATION §6). Where two archetypes
would otherwise share a mesh, they do not: §5.2 allocates distinct rigs and distinct
colour/scale treatments so that no two roster archetypes can be confused at a
glance in a monochrome screenshot.

### 0.3 The twelve states of `REQ-C-002`

`REQ-C-002` names eleven states: idle, patrol, chase, jump, attack, retreat,
stunned, shell, thrown, defeated, despawn. `DESIGN-3-ARCHITECTURE.md` §10.3
requires **twelve** with at least one outgoing transition each. The twelfth is
**`spawn`** — the state an actor occupies between a spawn request and its first
activation. It is required, not decorative: it is where a pooled actor is
acquired, given its transform, and parked, and it is the state a
scene-reload (`REQ-E-016`) parks every actor in. §3.1 defines it.

### 0.4 Numbers in this document

Every numeric constant is `TUNE` and lives in a ruleset tuning file, not in code
(3D-TRANSLATION §1.1, ARCH §12). The values quoted inline are the **defaults** an
implementer types first, with the reason they were chosen.

---

## 1. `REQ-C-001` — the actor base entity and its data contract

> **Requirement (`REQ-C-001`, P0).** Actor base entity declares collision shape,
> health, damage, tags, immunities, faction, movement controller and animation
> graph. **AC:** Data-only enemy can spawn and update without code subclass.

### 1.1 The rule

An archetype is a **JSON file** under `src/content/actors/`. The runtime has **one**
actor base component. A new enemy is a new JSON file and a new entry in the
stage's `actors[]` / a trigger's `payload.archetype_id` — never a script, never a
subclass, never a scene edit. The archetype schema is ARCH §5.3; this section
defines what each field *means* for an implementer and what the designer may set.

### 1.2 The designer-set field contract

`kind` ∈ {`enemy`, `boss`, `projectile`, `carried_object`, `companion`}
(`player` is Board A's).

| Group | Field | Type | Designer meaning | Default if omitted |
|---|---|---|---|---|
| **Identity** | `id` | string `^[a-z0-9][a-z0-9_-]*$` | Content id, `enemy.<slug>` / `boss.<slug>` | required |
| | `display_name` | string | Player-facing name. **Original only.** | required for bosses |
| | `research_family` | string | The taxonomy family code, for provenance only. **Never rendered, never exported to content.** | `null` |
| **Rig** | `rig.asset_id` | manifest id | The **single named mesh+animation file** for this actor. | required |
| | `rig.bone_map_id` | manifest bone map | Must match the asset's measured rig family (ARCH §2.2): `kenney_cast_6` for the 6-joint Kenney cast, `kenney_cast_32` for the 12-/32-clip families, `kaykit_41` for KayKit, `quaternius_23` for Quaternius, `none` for node-transform rigs. | required |
| | `rig.anim_plan` | object | **This board's extension.** See §1.4 — resolves GAP-A10. | required |
| | `rig.clip_set_id` | manifest id | **Retained from ARCH §5.3.** `rig.anim_plan` is **additive** to `clip_set_id`, not a replacement: `clip_set_id` names the asset's measured clip set (and the manifest re-measures it at ingest), while `anim_plan` says how each FSM state is played. An archetype that omits `clip_set_id` fails `ACTOR-018`. | required |
| | `rig.attachments[]` | array | Named sub-meshes parented to a named socket on the rig (weapons, flame heads, a shell lid). Each entry names an `asset_id` and a `socket` from the rig's declared socket list. | `[]` |
| | `parts[]` | array | Independent sub-volumes of the one actor, each with its own `id`, `health`, `hitbox` and `armour` — the three candle heads, an airship's hull and pilot. **A part is not an actor**: it does not get a pool entry, an FSM or a death. | `[]` |
| **Body** | `collider.shape` | `capsule` \| `box` \| `sphere` | The **hit volume** and the **physics body**, in 3D. Never a sprite rect. | `capsule` |
| | `collider.radius`, `collider.height` | number | Metres. The player capsule is **radius 0.35 m, height 1.75 m** (a 0.7 m footprint diameter) — architecture `TUNE-011` — so a small enemy is ~0.45 × 0.9. | required |
| | `collider.offset_y` | number | Centre offset from the rig origin (which is `base_centre` after the manifest `recentre` transform). | `0` |
| | `collider.layer` | layer name | `actor` \| `hazard` \| `projectile` \| `pickup` | `actor` |
| | `collider.mask` | layer array | Which layers this actor collides against. **Aquatic archetypes mask out `solid` land-only queries** (see §4.3, `REQ-C-011`). | required |
| | `collider.hitboxes[]` | array | Named sub-volumes: `{id, shape, radius/half_extents, offset, active_states[]}`. **A hazard with no attack hitbox is invalid** (`REQ-C-013`). | `[]` |
| **Life** | `health` | number ≥ 1 | Hit points, as the **number** the schema uses (ARCH §5.3). 1 = one stomp. | required |
| | `armour` | number | A **sibling** of `health`, not a nested field — ARCH §5.3 declares `health` as a number, so armour is a top-level key. Points that absorb before `health`. | `0` |
| | `invuln_after_hit_ticks` | int | Post-hit invulnerability window, in ticks. | `0` |
| **Damage** | `damage.contact` | number | Magnitude dealt to the player on body contact. `0` = harmless. | required |
| | `damage.outcome_overrides` | map | `damage_type → {outcome, on_state}`. **The only way to change an outcome** — a stomp on a shell *bounces* instead of *damaging* (§2.3.2). | `{}` |
| | `damage.resistances` | map | `damage_type → take \| half \| zero \| immune`. **The per-archetype column of the resistance matrix** (§2.3). | required |
| | `damage.faction_friendly` | bool | Whether this actor's contact damages same-faction actors (a rolling shell damages enemies; most do not). | `false` |
| **Tags** | `tags[]` | string set | Behavioural flags read by the FSM and the ruleset, e.g. `stompable`, `stomp_immune`, `shell_kickable`, `throwable`, `carryable`, `floats`, `aquatic`, `grounded`, `patrols`, `facing_reactive`. Closed vocabulary (ARCH §5.3). | `[]` |
| | `faction` | `hostile` \| `neutral` \| `friendly` \| `player` | Damage filtering between factions. | `hostile` |
| **Movement** | `movement.controller` | sealed string | The **movement controller** — one of the sealed verbs in §1.3. | required |
| | `movement.bounce_on_stomp` | object | `{impulse_mps, vertical_bias}` — the bounce the **target** gives the player when it is stomped and survives (§2.4). | none |
| | `movement.bounce_on_defeat` | object | As above, for a stomp that kills the target. | none |
| | `movement.speed_mps` | number | Ground speed. | required |
| | `movement.turn_on_ledge` | bool | Turns at a ledge (3D ground-probe test, not a 2D edge test). | `true` |
| | `movement.turn_on_obstacle` | bool | Turns at a wall or a step it cannot climb. | `true` |
| | `movement.gravity_scale` | number | 1.0 = earth. Aquatic actors use the water profile (3D-TRANSLATION §2.7). | `1.0` |
| | `movement.lane_mode` | `lane_locked` \| `free_z` | `lane_locked` keeps the actor in the lane band; `free_z` lets it move across Z (airborne, chargers, projectiles). | `lane_locked` |
| **Animation** | `states{}` | map | The FSM. See §3. | required |
| | `states.<s>.clip` | string | The clip **name** for this state. It must exist in the asset's measured `clips` array; the validator fails otherwise. | required unless `clip: null` |
| **Lifecycle** | `despawn.policy` | `camera_margin` \| `killed` \| `timer` \| `offstage_z` \| `arena_exit` | Bounded policies only — `never` is invalid (ARCH §5.3 failing example). | `camera_margin` |
| | `despawn.margin_m` | number | Camera margin for `camera_margin`. | `12.0` |
| | `despawn.delay_ticks` | int | Delay between death and despawn — the window in which the corpse is visible and the drop spawns. | `30` |
| | `activation.region_id` | string \| null | Activation region. `null` = the stage's default. | `null` |
| | `activation.sleep` | `camera` \| `always` | **Two values only.** `camera` = sleep outside the camera margin (the default). `always` = never sleep, always simulate (aquatic actors and traps). | `camera` |
| | `respawn_policy` | `never` \| `designated` \| `always` | Whether backtracking respawns it (`REQ-C-004`). | `never` |
| | `drops[]` | array | Item ids and chances on death. | `[]` |
| | `audio` | map | Cue ids. See §8.2. | `{}` |
| | `pool.budget_class` | `P0` … `P4` | The pool class (§4.7). | `P2` |
| | `pool.cap` | int | Hard cap for this archetype per stage. | by class |
| | `telemetry.death_tag` | string | The archetype tag written into the death record (`REQ-C-020`). | equals `id` |

### 1.3 The sealed movement-controller vocabulary

A controller is **data**, not a class. The sealed set is:

`patrol_edge_turn` · `patrol_walk` · `chase_ground` · `chase_lane` · `hop_arrive` ·
`hover_sine` · `flock_boid` · `emerge_pipe` · `emerge_ceiling` · `guard_turn`
· `tether_charge` · `orbit_point` · `shuttle_linear` · `shuttle_arc` ·
`fall_gravity` · `swim_patrol` · `swim_home` · `surface_ghost` · `facing_mirror` ·
`burrow_dive` · `crush_cycle` · `orbit_body` · `static_hazard` · `radial_burst` ·
`reflectable` · `crawl_reactive` · `teleport_reappear`

Each is a parameter set over the same kinematic mover (`src/systems/physics.move`).
**No controller may branch on a ruleset id** (ARCH §4.3); feature availability is
gated by `rules.enabled(...)`, and the *tuning constants* differ per rule set.

### 1.4 `rig.anim_plan` — the GAP-A10 contract

No clip set in the corpus covers **swimming, gliding, flight, charging or climbing**
(ASSETS GAP-A10). `rig.anim_plan` is how an archetype declares, per FSM state, how
that state's motion is produced. It is the **only** permitted way to move a rig
without an authored clip.

```
rig.anim_plan = {
  "<state>": {
    "clip": "<clip name>" | null,          // must exist in the asset's measured clips, else ACTOR-014
    "clip_rotate": "<clip name>" | null,   // optional secondary clip
    "transform": {                          // runtime node transform — see the vocabulary below
       "type": "none" | "bob" | "sway" | "arc" | "orbit_offset" | "uniform_scale",
       "amplitude_m": number, "period_s": number, "phase_offset": number,
       "scale": number,                      // uniform_scale ONLY — a single scalar
       "yaw_deg": number, "pitch_deg": number
    },
    "root_motion": "none" | "sine_x" | "sine_y" | "figure_eight" | "arc"
  }
}
```

**The runtime-transform vocabulary.** A `transform` moves or rotates the rig's
**root node** at runtime. It never edits the asset file and never adds a keyframe,
so it is a runtime transform of an existing asset — the mechanism ARCH §2.2
endorses explicitly ("the 124 node-transform Kenney assets are animated by
scripted transform on the node hierarchy — a runtime transform of an existing
asset, which is permitted (§8.3), not authoring").

| `type` | What it does | Permission basis |
|---|---|---|
| `none` | No transform. | — |
| `bob` | Vertical offset, `amplitude_m` at `period_s`. | ARCH §2.2 runtime node transform |
| `sway` | Horizontal offset, `amplitude_m` at `period_s`. | ARCH §2.2 |
| `arc` | A parabolic offset over the state duration. | ARCH §2.2 |
| `orbit_offset` | An elliptical offset about a pivot. | ARCH §2.2 |
| `uniform_scale` | A **single scalar** applied to the whole rig. | ARCH §8.3 `uniform_scale:<s>` — the only scale form permitted, because §8.3 forbids changing an asset's silhouette by anything other than a uniform scale |

**Two forms are deliberately absent.** A **non-uniform scale** (a Y-only
"crush" or "squash") is forbidden: it changes the silhouette at runtime, which
ARCH §8.3 forbids. Where an archetype previously wanted a squash it now uses
`uniform_scale`, and the visual difference is stated in its entry. And a
**rotational spin about an arbitrary axis** is not a transform type: a spinning
prop (a saw, a rocket) rotates its **own mesh node**, which is a node transform
of a named asset and is listed per archetype.

**The four tiers, applied in this order:**

1. **Bind to a rig that has the clip.** Where the corpus has one, use it and stop.
   `Climbing` and `Hop` exist on `KayKit_AnimatedCharacter_v1.2` (30 clips).
   `Running_A/B/C` exist on KayKit (76/95 clips). `sprint` exists on the Kenney
   cast and the 32-clip families. `fall` is a plausible neutral stroke pose.
2. **Scripted transform on a named rig.** Where no clip exists, the actor's **root
   node transform** is driven by a named transform descriptor, and the *body* plays
   the nearest authored pose clip. Permitted: ARCH §2.2 states the node-transform
   Kenney assets are animated "by scripted transform on the node hierarchy — a
   runtime transform of an existing asset, which is permitted (§8.3), not authoring".
3. **Nearest available original analogue.** Where the archetype's natural anatomy
   has no analogue at all, the archetype cites the nearest named asset and states
   the behavioural difference. Never an imagined mesh.
4. **ASSET GAP row.** Where even tier 3 is a lie (an aquatic vertebrate with a
   vertebrate silhouette, say), the row is an ASSET GAP (§9.1), not a placeholder.

**The swim/flight resolution, concretely** (this is the GAP-A10 answer):

| Motion | Clip exists? | Resolution | Behavioural difference, stated |
|---|---|---|---|
| **Swim** (humanoid) | No | Tier 2: body plays `fall` as the base pose (limbs splayed — a stroke-neutral pose); root transform `bob` (amplitude 0.09 m, period 0.9 s) plus `sway` yaw ±7°. | No arm-recovery cycle; the swimmer reads as *gliding* strokes, not a crawl. |
| **Swim** (creature) | No | Tier 2 on `kenney.cube-pets.animal-fish` (node-transform rig): root transform `bob` + `yaw_deg` ±11°. | No fin animation; the fish translates and turns like a real fish but the body does not undulate. |
| **Flight / glide** | No | Tier 2: body plays `jump` (arms out) as the base pose; `transform: {type:"arc", amplitude_m:0.35, period_s:2.4}` plus `root_motion: "figure_eight"` (the root motion field, not the transform type), and `pitch_deg` ±12° that follows the velocity vector. | The flyer banks but does not flap; silhouette reads as a gliding creature. |
| **Charge / sprint** | Yes | Tier 1: `sprint` (Kenney 25-clip) / `Running_A` (KayKit). | None. |
| **Climb** | Yes (one rig) | Tier 1: `Climbing` on `KayKit_AnimatedCharacter_v1.2`. | Only archetypes bound to that rig may use it. |
| **Hop / leap** | Yes (one rig) | Tier 1: `Hop` on the same rig. | As above. |

**The validator rule that makes this real:** `gate/schema` checks every
`rig.anim_plan.<state>.clip` against the manifest's measured `clips` array for that
asset id and fails with `ACTOR-014 clip 'X' is not present in asset 'Y' (available:
…)`. A designer therefore cannot cite a clip that does not exist, and cannot
invent one.

### 1.5 Acceptance test — `REQ-C-001`

> **Check:** the test harness loads `src/content/actors/enemy.pebble_grub.actor.json` and
> `src/content/actors/boss.spitcantor.actor.json` into a stage fixture and runs 600
> ticks with a scripted input trace. It asserts (a) **no `.gd` file was added** to
> `src/systems/actors/` by the test — the test asserts the file count and hash of
> that directory are unchanged; (b) the actor moved, changed FSM state, and had a
> non-zero `anim_plan` resolution for every state it entered; (c) **no archetype
> file contains a ruleset id literal** — the validator rejects the strings
> `classic_ground`, `challenge`, `carry_throw`, `world_map_suits`,
> `branching_companion` in any `src/content/actors/**` file with
> `ACTOR-015 archetype 'X' names a ruleset id`.
> **Fails if:** any of the three assertions fails.

---

## 2. `REQ-C-003` — the typed damage pipeline and the resistance matrix

> **Requirement (`REQ-C-003`, P0).** Stomp, melee/special, projectile, thrown item,
> moving shell, invincibility and environmental damage produce typed damage events.
> **AC:** Resistance matrix selects correct outcome on each damage source.

> **This board is the authority.** Board A and Board D call this pipeline; they do
> not re-implement it, and they may not branch on `damage_type` themselves.

### 2.1 The event

The `DamageEvent` is fixed by 3D-TRANSLATION §3 and is reproduced here verbatim
because it is the contract:

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

**Note the enum has nine members, not seven.** ARCH §10.3's acceptance clause said
"7 damage sources"; the binding 3D translation defines **nine** (`crush` is separate
from `environment`). **This board enumerates all nine.** ARCH has since corrected
§10.3 to "**9 damage sources × every archetype**" and names the nine values, so the
cross-board note `XN-ENT-01` in §10.2 is **CLOSED**. The 3D translation wins, and both
boards now say so.

**Two fields are additions this board requires, both defaulted so Board A and Board D
need no change:**

| Added field | Type | Why |
|---|---|---|
| `attacker_chain` | `string[]` | The chain of actors that carried the damage to the target. Set by `src/core/damage` only. **The FIRST entry is the credited attacker** — the origin of the hostile action. The chain is **never truncated from the front**; a new holder is *inserted* at the front, which is why a reflected or caught projectile credits the player who turned it around (3D-TRANSLATION §3: the credit is the *original attacker*, carried through the chain). Board A owns `last_attacker_id` on carried objects (3D-TRANSLATION §2.10); `attacker_chain` is the general form. |
| `phase_context` | `string` | Which boss phase was active when the event was produced. `null` for non-boss targets. |

### 2.2 The pipeline

```
contact resolver  ──►  DamageEvent  ──►  resistance matrix lookup
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
              outcome=damage        outcome=ignore            outcome=bounce
              apply magnitude        emit damage_ignored      set target velocity
              emit damage_applied    no state change          emit damage_bounced
              target owner reacts    (the FX still play)      (player bounced off a shell)
                    │
                    ├──► outcome=reflect   — reverse the projectile's velocity along
                    │                       −contact_normal, set attacker_chain
                    │                       = [reflector_id, …original chain]
                    │
                    ├──► outcome=shatter   — destroy the actor, spawn debris FX,
                    │                       award no score, emit actor_shattered
                    │
                    └──► outcome=phase_transition
                            — advance the boss phase, close the current damage
                              window, emit boss_phase_changed
```

**Order of operations, fixed:**

1. The **source** builds a `DamageEvent`. It may not set `invulnerable`.
2. The **pipeline** sets `invulnerable` by consulting the target's current
   invulnerability window (the target's owner supplies it).
3. The **pipeline** looks up `(damage_type, target_state)` in the matrix
   (§2.3) and obtains `(resistance, outcome)`.
4. `resistance` scales the magnitude: `take` ×1.0, `half` ×0.5, `zero` ×0.0,
   `immune` → the row is not consulted and the event is dropped with
   `damage_ignored` and `reason: immune`.
   *`zero` still runs the reaction (an armoured target flashes and is not damaged);
   `immune` does not react at all. The difference is the whole point of the two
   values.*
5. The **outcome** is dispatched. Only the target's owner applies the consequence
   (health, state change, knockback) — the pipeline never writes target state.

### 2.3 The resistance matrix

The matrix is a **data table** at `src/content/damage/resistance_matrix.json`,
keyed by `(damage_type × matrix_state × normal_bin) → outcome`, with the
archetype's `damage.resistances` map supplying the **resistance column** for that
archetype. Two lookups, one authority:

**`matrix_state`** is the state the target resolves to through the alias rule of
§2.3.1 — nine named columns.

**`normal_bin`** is the direction of the contact, because some outcomes depend on
it (a shell struck from the front hurts the player; from behind it bounces).
The bins are derived from the contact normal, and the derivation is normative:

| `normal_bin` | Test on the contact normal (the normal pointing **out of the target**) | Covers |
|---|---|---|
| `any` | — | the default; used when the source does not distinguish |
| `front` | the normal points within `TUNE 60°` of the target's facing axis | a shell that hits a player facing it |
| `back` | the normal points within `TUNE 60°` of the target's *rear* axis | a shell that hits a player from behind |
| `side` | the normal is perpendicular to the facing axis, within `TUNE 30°` of the horizontal | a flank hit |
| `top` | the normal's +Y component ≥ `0.7` (the stomp threshold) | a stomp |

A source that emits a contact with a normal it does not classify uses `any`.
**`normal_bin` is optional**: a row may be keyed `any`, in which case it applies
to every bin, and a bin-specific row overrides it. A lookup that finds neither a
bin-specific row nor an `any` row **fails** with `DAMAGE-006 no row for
(stomp, shell, front)` — it never falls back to a default silently.

**The default-resistance rule.** Any `damage_type` **not listed** in an
archetype's `damage.resistances` map is `take`. This makes every archetype's
resistance profile complete by omission, and the validator checks only the types
an archetype *does* declare. A full nine-type table per archetype is therefore
unnecessary and is not required by this board.

**The outcome vocabulary is closed**: `{damage, ignore, bounce, reflect, shatter,
phase_transition}`. `reflect`, `shatter` and `phase_transition` appear only in
archetype overrides or in the boss rows; they are still part of the single
authority, and the validator asserts that every outcome the runtime can emit is
present in the data.

```
magnitude_after_resistance =
      resistance == take   ? magnitude
    : resistance == half   ? magnitude * 0.5
    : resistance == zero   ? 0.0
    : resistance == immune ? event is dropped
```

#### 2.3.1 The default matrix (applies to any archetype that does not override)

**Every target state resolves to exactly one of nine matrix columns**: `default`,
`spawn`, `stunned`, `shell`, `thrown`, `defeated`, `despawn`, `vulnerable`,
`invulnerable`. The twelve actor states and the ten boss contexts (twenty-two
states in all) are folded onto those nine columns by the alias rule below.

**Alias rule — how a state resolves to a column.** This is normative, not
descriptive:

| Actor state | Resolves to | Boss context | Resolves to |
|---|---|---|---|
| `spawn` | `spawn` | `arena_enter` | `invulnerable` |
| `idle`, `patrol`, `chase`, `jump`, `attack`, `retreat` | `default` | `intro` | `invulnerable` |
| `stunned` | `stunned` | `combat`, window **open** | `vulnerable` |
| `shell` | `shell` | `combat`, window **closed** | `invulnerable` |
| `thrown` | `thrown` | `stagger` | `vulnerable` |
| `defeated` | `defeated` | `phase_transition`, `reward`, `despawn` | `invulnerable` |
| `despawn` | `despawn` (all-ignore) | | |
| `emerge` (an **additional** actor state, declared by `enemy.spring_wrench` under §3.1's inheritance rule) | `invulnerable` | | |

The table below lists **eight of the nine columns**; the ninth (`despawn`) is
all-ignore, identical to `spawn` and `defeated`, and is omitted for that reason.
Every state in the system maps onto a column by the alias rule, so the table is
the complete specification — an implementer never has to guess a cell.

| `damage_type` | `default` state | `vulnerable` (boss) | `invulnerable` (boss) | `stunned` | `shell` | `thrown` | `spawn` | `defeated` |
|---|---|---|---|---|---|---|---|---|
| `contact` | damage | damage | ignore | damage | damage | damage | ignore | ignore |
| `stomp` | damage | damage | ignore | damage | damage | damage | ignore | ignore |
| `projectile` | damage | damage | ignore | damage | damage | damage | ignore | ignore |
| `thrown` | damage | damage | ignore | damage | damage | damage | ignore | ignore |
| `moving_shell` | damage | damage | ignore | damage | damage | damage | ignore | ignore |
| `environment` | damage | ignore | ignore | damage | damage | damage | ignore | ignore |
| `crush` | damage | ignore | ignore | damage | damage | damage | ignore | ignore |
| `fall` | damage | ignore | ignore | damage | damage | damage | ignore | ignore |
| `poison` | damage | ignore | ignore | damage | damage | damage | ignore | ignore |

**Column notes, each a rule an implementer needs:**

- `vulnerable` (boss): the boss's **damage window is open**. Damage lands.
- `invulnerable` (boss): the boss is mid-attack, mid-intro, staggering, or in a
  phase transition. **Damage is ignored** — this is the mechanical enforcement of
  `REQ-C-015`'s "the boss may be defeated only during enabled damage windows".
- `shell` and `thrown`: a shell or a thrown body is a *moving hazard*, not a
  soft target. Damage lands, and the outcome may be overridden by the archetype's
  own `outcome_override` map (e.g. a shell takes `stomp` as `bounce`, not `damage`).
- `spawn`: actors are invulnerable while being acquired and placed. This is what
  makes a camera-woken actor safe to materialise.
- `defeated`: the corpse is inert. A second hit does nothing and does not re-fire
  the death event — the `REQ-E-003` "events cannot fire twice" rule.

#### 2.3.2 Outcome overrides (per archetype, per damage type)

The default matrix answers "what happens to the magnitude". **Outcome overrides**
answer "what the hit *does*". They live on the archetype, under
`damage.outcome_overrides`, and they are how a stomp on a shell *bounces* instead
of *damaging*:

```
damage.outcome_overrides = {
  "stomp":       { "outcome": "bounce", "on_state": "shell" },
  "contact":     { "outcome": "ignore" },
  "moving_shell":{ "outcome": "bounce", "on_state": "default" }
}
```

The resolver order is: **archetype override → default matrix → archetype
resistance column.** An override that names a state applies only in that state.

#### 2.3.3 Worked examples

| Situation | `damage_type` | Target state | Resistance | Outcome | What happens |
|---|---|---|---|---|---|
| Player stomps a 1-HP walker | `stomp` | `default` | take | damage | 1 damage → `defeated` → drop spawns → player bounces (`bounce` on the *player*, from the target's `on_stomp` reaction) |
| Player stomps a `stomp_immune` spiked crawler | `stomp` | `default` | **zero** | damage | 0 damage, target flashes, target enters `stunned` for 30 ticks — **it does not die** |
| A kicked shell rolls into another enemy | `moving_shell` | `default` | take | damage | enemy dies; the shell's chain counter increments (`REQ-C-006`) |
| A kicked shell hits the player from the front | `moving_shell` | player | take | damage | player takes the hit; **from behind, the player is bounced** — the matrix row is keyed by the *contact normal*, applied as `outcome_override` on the shell archetype |
| The player is hit by a fire shooter | `projectile` | `default` | take | damage | contact damage 1 |
| The player is invulnerable (power-up) | any | player | **immune** | — | event dropped, `damage_ignored` emitted, no HP change (Board A owns this window) |
| A boss is mid-slam | `stomp` | `invulnerable` | take | ignore | no damage; the boss's armour ring flashes |
| A boss's jaw opens | `projectile` | `vulnerable` | take | damage | phase HP reduces |
| The player falls into a pit | `fall` | player | take | damage | death by pit (Board A owns the death sequence) |
| A bomb prop explodes on a stomp-immune target | `environment` | `default` | zero | damage | 0 damage but the target is pushed back — `zero` reacts, `immune` does not |

### 2.4 The stomp test (restated, because it is the most-used rule here)

From 3D-TRANSLATION §2.4, unchanged, because it is binding: a stomp registers when
**all** of the following hold at the contact tick — (1) the player's vertical velocity
is strictly negative (`vy < -stomp_min_descent`, `TUNE 0.5`); (2) the contact normal
between the player's feet collider and the target's top collider has a **+Y component
≥ `stomp_normal_threshold`** (`TUNE 0.7`); (3) the player was airborne in the previous
tick. The test is **direction-vector based, not sprite-overlap based**, and is
direction-agnostic in Z.

**Consequences this board depends on:**

- A stomp on a target whose top collider is a *thin lid* (a shell, a crate lid) is a
  stomp on the **lid**, not on the body. Archetypes with a lid declare a separate
  `hitbox` named `lid` with its own `active_states`.
- The **bounce** the player receives is not part of the damage event. It is the
  target's reaction, declared on the archetype as
  `movement.bounce_on_stomp = { impulse_mps: 7.2, vertical_bias: 0.55 }`. The bounce
  applies when the target survives; when the target dies, the bounce magnitude is
  `movement.bounce_on_defeat` instead (the classic "bounce on the last hit" rule).

### 2.5 Attribution (the rule Board A will be asked about)

**The rule: the credited attacker is `attacker_chain[0]` — the origin of the
hostile action.** The chain is never truncated from the front; a new holder is
*inserted* at the front. This is 3D-TRANSLATION §3's "the credit is the *original
attacker*, carried through the throw chain" made mechanical.

- A stomp that defeats an actor credits **`source_id = player`** — the chain is
  `[player]`.
- A **thrown** actor that defeats a boss credits the **original thrower**: the
  chain is `[player]` when the player threw it, and the chain is **not truncated**
  when the body is released (3D-TRANSLATION §2.10, `REQ-C-014`, `REQ-C-018`).
- A **reflected** projectile inserts the **reflector** at the front — the chain
  becomes `[reflector, original_shooter]` — so the reflector is the credited
  attacker and the original shooter stays in the chain for analytics. This is the
  translation's rule applied to the case the translation names: the *original
  attacker* of the damage to the boss is the player who turned it around.
- A **caught** projectile inserts the **catcher** at the front, for the same
  reason.
- A **moving shell** credits the player who kicked it (`chain = [player]`); a
  shell that kills another enemy after a chain increments the chain counter and
  credits the same origin.

**What the analytics shows.** `source_id` is the credited attacker. The full
chain is recorded on the damage event and is what the death report reads, so a
kill can be attributed to "player → reflected → boss" rather than to the boss's
own projectile.

### 2.6 Acceptance test — `REQ-C-003`

> **Check:** a table-driven unit test enumerates **all 9 damage types × 9 matrix
> columns** (the 22 actor and boss states are first resolved to a column by the
> alias rule of §2.3.1 — the test asserts that every one of the 22 states maps
> to exactly one column and that no state is unmapped) × **every archetype in
> `src/content/actors/`** = the complete cross-product. For every cell the test
> asserts exactly one `(resistance, outcome)` pair is produced, and that the pair
> matches the matrix file. **An unmapped `(damage_type, archetype)` pair fails the
> test** with `DAMAGE-004 no row for (stomp, enemy.pebble_grub)`.
> A second case asserts the pipeline drops an event against an `immune` target
> without firing `damage_applied`, and a third asserts a `bounce` override on a
> shell archetype returns `outcome=bounce` for `stomp` and `damage` for `moving_shell`.
> **Fails if:** any cell is unmapped, or any override leaks into the wrong state.

---

## 3. `REQ-C-002` — the enemy finite-state machine

> **Requirement (`REQ-C-002`, P0).** Enemy FSM supports idle, patrol, chase, jump,
> attack, retreat, stunned, shell, thrown, defeated and despawn. **AC:** Every state
> has transition guards and bounded timers.

### 3.1 The templates, and the twelve states

**Four FSM templates.** Not every actor runs the twelve-state machine, and
pretending otherwise would make the validator fail every boss and every
projectile. The `kind` field selects the template:

| Template | Used by | States |
|---|---|---|
| `actor_fsm_12` | `kind: enemy`, `kind: companion` | the twelve below |
| `boss_outer` | `kind: boss` | the eight outer states of §7.1.1, with the inner pattern FSM (§7.1.2) nested inside `combat` |
| `projectile_fsm` | `kind: projectile` | `spawn → move → hit → exhaust` (four states) |
| `item_fsm` | Board D items (`REQ-D-003`) | `idle → warn → armed → collected` (four states) |

**The inheritance rule.** A template is a **superset contract**: every archetype
declares its own `states` map, and the validator checks that archetype's states
against its template — the twelve for `actor_fsm_12`, the eight outer states for
`boss_outer`, the four for `projectile_fsm`. An archetype may **add** states to
its template (a companion adds `mounted` and `carried`; a split-creature adds
`split`); it may not **omit** a template state. An archetype with extra states
is still data-driven — the extra states are declared in the same JSON and are
run by the same runtime. **No archetype requires a code subclass**, which is
what `REQ-C-001` demands.

**Unreachable template states.** A template state may be **unreachable in play** —
an archetype that never retracts still declares `shell`, so the template is
satisfied, but no transition enters it. Such a state must still declare its
outgoing transitions, and the validator records it as unreachable
(`ACTOR-019 state 'shell' of 'enemy.bulwark_beetle' is unreachable — no transition
enters it`). This is how the beetle "has no shell" without breaking the template.

**Multi-part actors.** An archetype whose body has independent parts (three
candle heads, an airship hull and its pilot) declares them in a `parts[]` array
(§1.2) and each part carries its own `health` and its own hitbox. **No part is a
separate actor** — it is a sub-volume of the one actor, so the actor's pool
count, its FSM and its death are single-instance.

**The twelve states of `actor_fsm_12`:**

| # | State | What the actor is doing | Exit conditions (all bounded) |
|---|---|---|---|
| 1 | `spawn` | Acquired from the pool, transformed, parked, not yet simulating. | `activation_entered` → `idle`; `activation_left` → `despawn`; `despawned` → `despawn` |
| 2 | `idle` | Standing. The default state after activation. | `timer_expired` → `patrol`; `target_in_range` → `chase`; `damaged` → `stunned`; `killed` → `defeated`; `player_out_of_range` → `despawn` |
| 3 | `patrol` | Walking the authored route or the edge-turn rule. | `blocked` / `ledge` → `idle`; `target_in_range` → `chase`; `damaged` → `stunned`; `killed` → `defeated` |
| 4 | `chase` | Moving toward the player on the lane axis. | `target_lost` → `patrol`; `in_attack_range` → `attack`; `too_close` → `retreat`; `damaged` → `stunned`; `killed` → `defeated` |
| 5 | `jump` | Airborne, executing a hop or leap. | `landed` → `idle` \| `patrol`; `timeout` (bounded) → `idle`; `damaged` → `stunned` |
| 6 | `attack` | Telegraphed, then committed. | `attack_complete` → `chase` \| `patrol`; `player_dodged` → `idle`; `killed` → `defeated` |
| 7 | `retreat` | Backing away from the player. | `safe_distance` → `idle`; `timeout` → `chase`; `killed` → `defeated` |
| 8 | `stunned` | Knocked back, cannot act, may be picked up. | `timer_expired` → `idle`; `picked_up` → `thrown`; `killed` → `defeated` |
| 9 | `shell` | Retracted / armoured state. Special: may be kicked. | `kicked` → `thrown`; `timer_expired` → `idle`; `stomped` → `shell` (the player is bounced; the shell stays shelled); `killed` → `defeated` |
| 10 | `thrown` | In flight, owned by a thrower, carrying the attacker's chain. | `impact` → `stunned`; `timeout` → `stunned`; `killed` → `defeated` |
| 11 | `defeated` | Dying / dead. Not collidable with the player, may still show a corpse. | `timer_expired` → `despawn`; `drop_spawned` → `despawn` |
| 12 | `despawn` | Returned to the pool. Terminal. | — |

**Validation rule (ARCH §5.3):** every state has at least one outgoing transition
unless it is terminal (`despawn`); every `timer_ticks` is `null` or an integer in
1..3600; every transition target is a declared state. `ACTOR-007` and `ACTOR-008`
enforce this. **`null` timers are allowed only on states whose only exit is
event-driven and non-terminal** — a `null` timer on `idle` is a validator failure
(`ACTOR-008 state 'idle' has no bounded timer and no event-driven exit`).

### 3.2 Transition guards — the vocabulary

A transition is `{event, to, guard?}`. The event vocabulary is closed:

`timer_expired` · `blocked` · `ledge` · `landed` · `target_in_range` ·
`target_lost` · `in_attack_range` · `too_close` · `safe_distance` ·
`attack_complete` · `player_dodged` · `damaged` · `killed` · `stomped` ·
`kicked` · `picked_up` · `impact` · `drop_spawned` · `activation_entered` ·
`activation_left` · `phase_changed` · `window_opened` · `window_closed` ·
`arena_cleared` · `goal_reached` · `subordinate_cap_reached` ·
`spawn_exhausted` · `variant_changed` · `part_destroyed` · `devour_available` ·
`devoured` · `mounted` · `dismounted` · `fuse_defused` · `reassemble_ready` ·
`phase_hp_zero` · `burst` · `split` · `pool_refused` · `charge_ready` ·
`variant_is_ready` · `despawned` · `player_out_of_range` · `timeout`

**Guards** are data predicates evaluated against the world state at the transition
tick. The closed guard vocabulary:

| Guard | Meaning |
|---|---|
| `player_facing_away` | The player's facing vector points away from the actor, within `facing_tolerance_rad` (`TUNE 35°`). Used by the facing-reactive ghosts (`REQ-C-012`). |
| `player_within(n)` | Distance to the player ≤ n metres. |
| `player_outside(n)` | Distance to the player > n metres. |
| `player_in_lane` / `player_out_of_lane` | The player is inside / outside the actor's lane band (3D-TRANSLATION §2.1). |
| `line_of_sight` | A ray from the actor's eye to the player's centre is unobstructed by `solid` geometry. |
| `grounded` / `airborne` | The actor's own grounded test (3D-TRANSLATION §2.3). |
| `cooldown_ready` | The state's own cooldown timer has expired. |
| `hp_below(pct)` | The actor's remaining health is under `pct` % of its maximum. |
| `phase_is(n)` | The boss's current phase equals n. |
| `window_open` | The boss's damage window is enabled (`REQ-C-015`). |
| `arena_locked` | The arena lock is engaged. |
| `aggro_enabled` | The archetype's own `aggro_enabled` flag is true — the passive archetypes set it false and can never enter `chase`. |
| `variant_is(v)` | The actor's current `variant` equals `v` (e.g. `winged`, `ground`). |
| `stomp_counter_at_least(n)` | The actor's `stomp_counter` has reached `n` (multi-hit archetypes). |
| `parts_alive(n)` | At least `n` of the actor's `parts[]` are undestroyed. |
| `subordinate_count_below(n)` | The actor currently has fewer than `n` live subordinates. |
| `reassemble_count_below(n)` | The actor has reassembled fewer than `n` times. |
| `payload_present` | The actor's payload (an item in the maw, a shell to kick) exists. |
| `always` | Unconditional. |

**No guard may reference a ruleset id** (ARCH §4.3). Feature gating uses
`rules.enabled(...)` inside the controller, never inside a guard string.

### 3.3 Bounded timers — the full list

Every state timer, with its default and the reason for the value:

| State | `timer_ticks` | 60 Hz seconds | Why |
|---|---|---|---|
| `spawn` | `null` (event-driven) | — | It ends when the activation region fires. |
| `idle` | 60 | 1.00 | A one-second pause before a patrol beat, so patrols read as deliberate rather than robotic. |
| `patrol` | `null` | — | Ends on a `blocked`/`ledge`/`target_in_range` event. |
| `chase` | `null` | — | Ends on a distance or LOS event. |
| `jump` | 90 | 1.50 | A hard ceiling on an airborne state, so a bad launch can never hang the actor. |
| `attack` | 45 | 0.75 | Telegraph + commit + recover. The telegraph is 15 ticks (`TUNE 0.25 s`) — long enough to read, short enough to be fair. |
| `retreat` | 120 | 2.00 | A bounded retreat. |
| `stunned` | 90 | 1.50 | Long enough to be thrown (pickup requires `stunned`), short enough not to be a free camp. |
| `shell` | 360 | 6.00 | The window in which a retracted shell may be kicked. After it, the actor re-emerges (`REQ-C-006`). |
| `thrown` | 120 | 2.00 | A thrown body cannot fly forever. |
| `defeated` | 30 | 0.50 | The corpse is visible for half a second before the drop spawns and the actor despawns. |
| `despawn` | `null` | — | Terminal. |

**Rule:** a state whose timer is `null` must have at least one event-driven exit,
and the event must be one the controller can actually produce. The validator
cross-checks `movement.controller` against the events declared for the states that
use it (`ACTOR-016 state 'idle' declares event 'target_in_range' but controller
'patrol_edge_turn' cannot produce it`).

### 3.4 The three transitions that carry the game

**1. `patrol` → `chase` (the aggro gate).** Guard: `player_within(aggro_radius)`
AND `line_of_sight` (if the archetype declares `requires_line_of_sight`) AND
`aggro_enabled` (a per-archetype bool, false for passive archetypes). The radius
is `TUNE 6.0 m` for ordinary walkers and `TUNE 11.0 m` for the aggressive pipe
variant. **The aggro gate is a distance in 3D, not an X-distance.**

**2. `stunned` → `thrown` (the pickup path).** `REQ-C-014`. Guards: `picked_up` AND
`carryable` tag AND the player's `carry_strength` ≥ the archetype's `weight_class`
(3D-TRANSLATION §2.10). The carried actor has **no collider while carried** and
rides the player's `carry_socket`; on release it enters `thrown` with
`attacker_chain = [player_id]`.

**3. `shell` → `thrown` (the kick path).** `REQ-C-006`. Guards: `kicked` AND the
kicking contact normal is within `kick_tolerance_rad` (`TUNE 55°`) of the shell's
facing axis. The shell's velocity is `kick_speed_mps` along the contact normal, and
`attacker_chain = [player_id]`. While in `shell`, the shell's `contact` damage
applies to **the player** only when the contact normal opposes the player's motion
(a front hit hurts; a rear hit bounces) — implemented as an
`outcome_override` with an `on_state: shell` entry, not as bespoke code.

### 3.5 Acceptance test — `REQ-C-002`

> **Check:** a validator pass over every archetype asserts (a) the archetype's
> declared states **cover its template exactly** — all twelve
> `spawn, idle, patrol, chase, jump, attack, retreat, stunned, shell, thrown,
> defeated, despawn` for `actor_fsm_12`, the eight outer boss states for
> `boss_outer`, the four projectile states for `projectile_fsm` — and may declare
> **additional** states, never fewer; (b) every declared state has ≥1 outgoing
> transition except the terminal one; (c) every `timer_ticks` is `null` or in
> 1..3600, and every `null`-timer state has an event-driven exit; (d) every
> transition target is a declared state; (e) every event and guard is in the
> closed vocabularies of §3.2; (f) **no archetype's `states` map requires a
> script** — the runtime resolves every archetype through the generic actor
> path.
> **Fails if:** any archetype has an unbounded or missing timer, an undeclared
> target, or an out-of-vocabulary event.

---

## 4. `REQ-C-004` — spawn triggers, sleeping, respawn and pooling

> **Requirement (`REQ-C-004`, P0).** Spawn triggers, camera-based sleeping,
> respawn policy and actor pooling prevent unbounded entities. **AC:** Backtracking
> respawns only designated entities.

### 4.1 The lifecycle of an actor

```
   stage load
      │
      ▼
  ACTORS.spawn(archetype_id, transform, context) ──► pooled instance in `spawn` state
      │                                                        │
      │                                              activation region test
      │                                                        ▼
      ├── outside camera margin ──► stays in `spawn` (asleep, zero cost) ──┐
      │                                                                     │
      ▼                                                                     │
   `idle` ──► FSM runs ──► `defeated` ──► `despawn` ──► returned to pool ◄───┘
```

### 4.2 Spawn triggers

Four trigger kinds, all declared in the stage JSON (ARCH §5.2 `triggers[]`):

| Trigger | Fires | Actor behaviour |
|---|---|---|
| `spawn` | On entry into the trigger AABB | Spawns `payload.archetype_id` at `payload.position` (or at the trigger's centre if `null`) |
| `spawn_on_sight` | When the camera's frustum contains the trigger AABB | Same; used for enemies that must not pop in inside the view |
| `spawn_on_camera` | When the trigger's X is within `camera_lead_m` of the camera | Same; used for autoscroll stages (`REQ-B-012`) |
| `despawn` | On exit of the trigger AABB | Despawns actors tagged `bound_to_trigger` inside it |

**Rules.** A spawn trigger fires **once per activation cycle** unless
`respawn_policy: always`. A trigger may carry `max_instances` (hard cap for its
archetype in that trigger) and `min_distance_from_player_m` — an enemy never
materialises within 2 m of the player (`TUNE 2.0 m`), because materialising inside
the player is a free hit and feels unfair.

### 4.3 Camera-based sleeping

`activation.sleep: camera` is the default. An actor outside
`camera_margin + wake_margin` (default margin 12.0 m, wake margin 4.0 m) is put
into `spawn` state: its FSM stops running, its animation stops, and it costs
**one transform update**, not a full update. An actor that re-enters the wake
margin returns to `idle`.

**Aquatic exception (`REQ-C-011`).** Aquatic archetypes use
`activation.sleep: always` — a fish must keep swimming even off-camera, because
its position is part of the water's state (currents, shoals). The cost is bounded
by the pool cap (§4.7), not by the camera.

### 4.4 Respawn policy

| Policy | Behaviour | Used by |
|---|---|---|
| `never` | The actor does not come back after being despawned. | Bosses, one-shot puzzle actors, dropped items |
| `designated` | The actor respawns when its trigger re-arms, **only** if the archetype declares `respawn_armed_by: "trigger_reentry"`. | Ordinary walkers and the hazards a stage wants re-usable |
| `always` | The actor respawns on the trigger's next cycle. | Pressure stages with a deliberately repeating hazard |

**The backtracking rule (`REQ-C-004` AC).** The acceptance test backtracks three
times and asserts that only archetypes with `respawn_policy: designated` (or
`always`) return. **`never` archetypes do not.** In practice: bosses, dropped
collectables and puzzle pieces are `never`.

### 4.5 Pooling

`src/systems/actors/` owns the pools. One pool per archetype id. A pool has a
fixed capacity; acquiring beyond capacity **returns the oldest idle entry** if
one exists, otherwise it **refuses** and increments a counter that the perf report
reads (ARCH §9.3, `REQ-E-011`). A refusal is never silent.

### 4.6 Acceptance test — `REQ-C-004`

> **Check:** the integration test loads a fixture stage with 40 spawned actors
> (`respawn_policy: designated`), 10 (`never`) and 5 (`always`); walks the player
> left 200 m, right 200 m, left 200 m; then asserts (a) the count of live actors
> with `never` policy is 0 and never increases, (b) the `designated` actors return
> to their trigger count, (c) the `always` actors return to their trigger count,
> and (d) `actors.actor_count()` never exceeded the stage's declared
> `actor_budget` at any tick — the count is sampled every tick, not just at the
> end.
> **Fails if:** the live actor count exceeds the budget on any sampled tick, or a
> `never` actor reappears.

### 4.7 Pool budget classes

`pool.budget_class` maps to a hard per-stage cap. The caps sum to the stage's
`actor_budget` (ARCH §9.3: ≤120 active actors typical, ≤300 in the stress scene).

| Class | Meaning | Per-stage cap | Pool cap (per type) |
|---|---|---|---|
| `P0` | Singleton. One per stage. Bosses, arena mechanisms, the bridge. | 1 | 1 |
| `P1` | Scarce. A stage may have a handful. Elite walkers, key guardians, armoured shells. | 6 | 8 |
| `P2` | Standard. The common roster. | 24 | 32 |
| `P3` | Dense. Pressure groups and swarms. | 48 | 64 |
| `P4` | Swarm. Fish shoals, spores, projectiles in flight. | 96 | 128 |

**Projectiles are a separate cap** (ARCH §9.3: ≤512 pooled objects total, ≤128 per
type), counted independently of actors, because a projectile is a pooled object, not
an actor with an FSM.

**The accounting rule, stated once so it is not applied twice.** An archetype of
`kind: projectile` **counts against the pooled-object budget only**. It does not
occupy an `actor_budget` slot, it does not appear in `actors.actor_count()`, and
it does not consume an activation region. It **is** despawned by the
`REQ-E-016` reload (step 3 of §9.3.1), because it is a pooled object in the
projectile pool and the projectile pool is cleared wholesale. Every other kind —
`enemy`, `boss`, `companion` — counts against `actor_budget` and appears in
`actor_count()`.

**The refusal counter.** When a pool is asked for an instance it does not have and
has no idle entry to recycle, it **refuses** and increments
`actors.pool_refusals[archetype_id]`. The perf report reads this counter
(`REQ-E-011`). A refusal is never silent and never silently drops a required
encounter: an archetype flagged `required_for_stage` causes the refusal to **fail the
stage load** rather than continue.

---

## 5. The archetype roster

### 5.1 How to read a roster entry

Every entry gives, in this order:

- **Id** — the content id, `enemy.<slug>` or `boss.<slug>`.
- **Name** — the shipped, original name. No reference-game name appears here.
- **Ref** — the taxonomy's generic archetype slug and the research family code.
- **Behaviour** — the 3D behaviour in one paragraph, in the game's terms.
- **FSM** — the states this archetype actually uses, and the transitions that differ
  from the reference template of §3.
- **Damage** — contact magnitude, the resistance column (the archetype's
  `damage.resistances`), and the outcome overrides.
- **Pool** — budget class, cap, `activation.sleep`, `despawn.policy`.
- **Spawn** — the trigger kind, the aggro gate, `respawn_policy`.
- **Assets** — the exact path(s). Every path is a file that exists in the repository.
- **Acceptance** — the falsifiable check.

**Parameter sets, not mash-ups.** Where two reference families want the same
archetype to behave differently, they are **two archetypes with different parameter
sets**, never one archetype with a mode flag. The only exception is the pipe plant,
where the taxonomy itself calls for a normal and an aggressive variant — and those
are two archetypes with different rigs, because silhouette separation is mandatory.

### 5.2 Rig allocation and silhouette separation

Every archetype in the roster owns a distinct rig or a distinct silhouette treatment
of a rig whose scale or attachment differs. The allocation, with no rig used by two
archetypes in the same family:

| Rig family | Assets | Archetypes drawn from it |
|---|---|---|
| `kenney_cast_6` (skinned, 25 clips) | `platformer/character-oobi`, `-oodi`, `-ooli`, `-oopi`, `-oozi` | **5** — one per model: `pebble_grub`, `rail_rider`, `spring_wrench`, `censer_thrower`, `pyre_breather` |
| `kenney_cast_32` (skinned, 32 clips) | `mini-characters/character-male-a`, `character-female-b`; `mini-dungeon/character-human`; `mini-forest/character-archer`; `mini-arcade/character-employee`, `character-gamer`; `mini-skate/character-skate-girl`, `character-skate-boy` | **8** — the armed and humanoid archetypes |
| `kenney_cast_25` (skinned, 25 clips) | `mini-arena/character-soldier` | **1** — the 25-clip family, which is **not** the 32-clip family |
| `kenney_cast_25_node` (node-transform, 27 clips) | `blocky-characters/character-k`, `character-r` | **2** — the two archetypes that need a named head socket or a fully node-transformed rig |
| `kenney_graveyard_32` (node-transform, 32 clips) | `graveyard/character-ghost`, `-vampire`, `-skeleton`, `-keeper`, `-zombie` | **5** — one per model |
| `kenney_cube_pets_8` (node-transform, 8 clips) | `cube-pets/animal-*` | **18** of the 24 models, one per archetype |
| `kenney_prop_anim_3` (node-transform, 3 clips) | `platformer/trap-spikes`, `trap-spikes-large`; `mini-dungeon/trap`; `factory/piston-round`, `piston-thin-round` | **6** — the hazards that have a real authored show/hide or toggle clip |
| `kenney_prop_static` | `platformer/plant`, `flowers-tall`, `spike-block-wide`, `saw`, `bomb`, `pipe`, `crate-strong`, `barrel`, `arrows`, `block-moving-large`; `space/satelliteDish` | **10** |
| `kaykit_prop` (static props) | `kaykit-halloween/candle`, `candle_melted`; `kaykit-medieval-hexagon/building_tower_catapult_red` | **3** — the flame and fortress bodies |
| `kaykit_41` (skinned, 76 clips) | `Barbarian`, `Knight`, `Mage`, `Rogue_Hooded` | **6** archetypes over **4** models |
| `kaykit_skeleton_41` (skinned, 95 clips) | `Skeleton_Mage`, `Skeleton_Rogue`, `Skeleton_Warrior` | **3** |
| `kaykit_anim12_30` (skinned, 30 clips) | `KayKit_AnimatedCharacter_v1.2` — the only rig with `Climbing` and `Hop` | **1** |
| `quaternius_23` (skinned, 17 clips) | `Wizard`, `Goblin` | **2** |
| `quaternius_mech_18` (skinned, 18 clips) | `Leela` | **1** (boss pilot) |
| `quaternius_animal_12` (skinned, 12 clips) | `Fox` | **1** (mount companion) |

**Totals: 72 actor archetypes — 48 on a character rig, 24 on a named prop.** The
counts above are **tallied from this document's roster**, not asserted; a
validator (`ACTOR-017`) re-derives them from the archetype files and fails the
build if the tally and the files disagree. The same validator asserts that no two
archetypes in the same reference family cite the same primary mesh, which is the
mechanical form of the silhouette rule.

**By `kind`:** 57 `enemy` · 10 `boss` · 4 `projectile` · 1 `companion` = **72
actor archetypes**. One further roster entry, `item.cinder_thorn`, is **not** an
actor archetype — it is a Board D item (§5.4.1).

**Silhouette rule, enforced mechanically.** The art-direction pass renders every
archetype in a monochrome silhouette at a fixed camera pose and stores the PNG in
`tests/golden/silhouettes/`. Two archetypes whose silhouettes overlap by more than
35 % of the smaller one's bounding-box area fail `gate/screenshot-diff`. That is how
"silhouette separation is mandatory" stops being an aspiration. **The 35 %
threshold is a gate-enforced target, not a measurement this board has taken** —
the silhouettes do not exist until the rigs are imported and rendered, so the
first real measurement is the screenshot gate's own output.

### 5.3 Family A — reference family `SMB1` (research tag)

Fourteen archetypes: the walking baseline of the game, and the three aquatic
members of `REQ-C-011`.

#### 5.3.1 `enemy.pebble_grub` — **Pebble Grub**
*Ref: `ground_walker` · family `SMB1`*
- **Behaviour** — A low, round grazer that walks the lane, turns at a ledge (a
  3D downward ground-probe test, 3D-TRANSLATION §2.3) and at a wall it cannot
  climb. It is inert until the player comes within its aggro radius. This is the
  archetype the rest of the roster is tuned against: one stomp, one coin.
- **FSM** — `spawn → idle(60) → patrol → chase → attack → patrol`; `damaged → stunned(90)
  → idle`; `killed → defeated(30) → despawn`. `attack` is a short lunge with a
  15-tick telegraph.
- **Damage** — contact 1. Resistances: `stomp: take`, `contact: take`,
  `projectile: take`, `thrown: take`, `moving_shell: take`, `environment: take`,
  `crush: take`, `fall: take`, `poison: take`. Outcome override: none.
- **Pool** — `P2`, cap 24. `sleep: camera`, `despawn: camera_margin`
  (12 m), `respawn_policy: designated`.
- **Spawn** — `spawn` trigger, aggro radius `TUNE 6.0 m`, min distance from player
  `TUNE 2.0 m`.
- **Assets** — `shorepine-kenney/3d/platformer/character-ooli.glb` (skinned, 1 skin,
  25 clips, rig family `kenney_cast_6`). Clip map: `idle → idle`, `patrol → walk`,
  `chase → sprint`, `jump → jump`, `attack → attack-melee-right`, `stunned →
  emote-negative`, `defeated → die`.
- **Acceptance** — a walker turns at a ledge and at a wall; a stomp kills it in one
  hit; a `stomp_immune` sibling survives a stomp with 0 damage (`REQ-C-005`).

#### 5.3.2 `enemy.tumble_shell` — **Tumble Shell**
*Ref: `shell_retract_kick` · family `SMB1`*
- **Behaviour** — Walks like a grub, but a stomp makes it **retract** into a shell:
  it collapses to a low dome (a scripted **uniform** scale of 0.6 on the named rig —
  not a non-uniform squash, which §8.3 forbids), stops
  acting, and can be **kicked**. A kicked shell slides along the lane, damaging
  every enemy it touches, and hurts the player if it strikes from the front. After
  `TUNE 6.0 s` it re-emerges and resumes patrolling.
- **FSM** — as `pebble_grub`, plus `stomped → shell(360)`; `shell` exits:
  `kicked → thrown` (the shell rolls as a thrown body with
  `attacker_chain = [player]`), `timer_expired → idle` (re-emerges),
  `stomped → shell` (a second stomp **bounces** the player and does not kill).
- **Damage** — contact 1 while walking. In the `shell` state: contact 1 against
  the player **from the front**, `bounce` against the player **from behind**
  (the `normal_bin` column of §2.3). Resistances: `stomp: zero` (it retracts
  rather than taking damage), `moving_shell: take`, `thrown: take`,
  `projectile: take`. Outcome overrides:
  `{"stomp": {"outcome":"bounce","on_state":"shell"}}` — a stomp **in the shell
  state** bounces the player and does not kill. The **first** stomp, in the
  `default` state, meets `stomp: zero`, so the actor takes no damage and enters
  `shell`. One story, two states, no ambiguity.
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger, aggro `TUNE 6.0 m`.
- **Assets** — `10-kenney-collection.zip!mini-characters/character-female-b.glb`
  (skinned, 2 skins, 32 clips, `kenney_cast_32`). **This is the manifest citation of record**
  — the same file is also present in `shorepine-kenney.zip` under
  `shorepine-kenney/3d/mini-characters/character-female-b.glb`, but the manifest names the
  `10-kenney-collection` member, so the two boards cannot drift apart. Clip map: `shell → crouch` with a
  `uniform_scale` of 0.6 (a single scalar — the whole rig shrinks); `kicked → attack-kick-right`;
  `re-emerge → idle`.
- **Acceptance** — a kicked shell damages an enemy in its path and the player when
  struck from the front; the shell re-emerges after the configured time
  (`REQ-C-006`). **The retracted state is a uniform-scale retract (0.6) on this same
  named rig, not a detached carapace mesh** — the corpus contains no shell, carapace or
  turtle mesh, and none is required. This is the assets board's `G-01` option **(a′)**,
  adopted 2026-10-30; options (a) the crab and (b) the shield disc are declined. The
  "kick" therefore applies a launch impulse to the *same* actor, which slides as a thrown
  body with `attacker_chain = [player]`.

#### 5.3.3 `enemy.gustfeather` — **Gustfeather**
*Ref: `winged_hopper` · family `SMB1`*
- **Behaviour** — A small flier that bobs on a **sine arc** and periodically drops
  toward the player in a short dive. Its "wings" are the paired wing meshes of the
  parrot asset; the first compatible hit **converts** it to a ground variant — the
  wing meshes are hidden and the state changes to `patrol`, making it a walking
  grub. It is the archetype that teaches the "the first hit strips the wings" rule.
- **FSM** — `spawn → idle(60) → patrol(air) → jump(90) → patrol(air)`; `chase`
  uses the horizontal sine; `damaged → stunned`; `killed → defeated`.
  The wing-stripping is an `outcome: damage` with `on_state: default` that also
  sets `variant: ground`.
- **Damage** — contact 1. Resistances, per variant: the **`winged`** variant has
  `stomp: zero` (the stomp strips the wings and deals no damage); the
  **`ground`** variant has `stomp: take` (one stomp kills it). `contact: take`,
  `projectile: take` for both. Wing state is a `tags` flag `winged`; the archetype
  has two variants (`variant: winged`, `variant: ground`) with the **same rig**,
  and the variant change is made by the `variant_changed` event (§3.2).
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn_on_sight` trigger; it must never materialise mid-dive.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-parrot.glb` (5–7 meshes,
  node-transform, 8 clips: `static, idle, walk, run, eat, dance, gesture-positive,
  gesture-negative`). **Flight has no clip (GAP-A10)** → `rig.anim_plan` tier 2:
  `transform: {type:"bob", amplitude_m:0.42, period_s:1.6}` + `root_motion:"sine_x"`,
  with the base clip `idle`. Behavioural difference: **the body does not flap; the
  wings are static meshes and the parrot translates and pitches instead.**
- **Acceptance** — the first compatible hit converts the flyer to its ground variant
  and the wing state is lost (`REQ-C-007`); a silhouette capture of the winged
  variant differs from the ground variant by more than the 35 % threshold.

#### 5.3.4 `enemy.bulwark_beetle` — **Bulwark Beetle**
*Ref: `armoured_shell` · family `SMB1`*
- **Behaviour** — A slow armoured crawler that ignores stomp damage entirely and
  cannot be kicked. It must be defeated by a projectile, a thrown body, a moving
  shell, or a hazard. It is the archetype that teaches "some things cannot be
  stomped".
- **FSM** — `spawn → idle(60) → patrol → chase → attack`; the `shell` state is
  **declared but unreachable** — it declares its outgoing transitions, but no
  transition enters it, because the beetle does not retract (§3.1's rule);
  `damaged → stunned(90)` only if the damage was `projectile`/`thrown`/
  `moving_shell` — a `stomp` with resistance `zero` does not interrupt it.
- **Damage** — contact 1. Resistances: `stomp: zero`, `contact: take`,
  `projectile: take`, `thrown: take`, `moving_shell: take`, `environment: take`,
  `crush: take`. Tags: `stomp_immune`.
- **Pool** — `P1`, cap 8.
- **Spawn** — `spawn` trigger, aggro `TUNE 8.0 m`.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-crab.glb` (6 meshes,
  node-transform, 8 clips). Clip map: `idle → idle`, `patrol → walk`, `chase → run`,
  `attack → gesture-negative`, `defeated → dance` (the crab's "flip over" reads as
  a defeat).
- **Acceptance** — a `stomp_immune` archetype survives a stomp with **zero** health
  loss and no state change to `defeated` (`REQ-C-005`).

#### 5.3.5 `enemy.vine_maw` — **Vine Maw**
*Ref: `pipe_emerge_gated` · family `SMB1`*
- **Behaviour** — A plant that lives inside a pipe and **emerges only when the player
  is not adjacent**. It rises out of the pipe mouth, waits, and retracts. If the
  player stands next to the pipe while it is out, it pauses its cycle and waits —
  this is the "proximity gate" that makes the pipe plant fair rather than a
  coin-flip.
- **FSM** — `spawn → idle(hidden) → attack(emerge) → idle(retracted)`; the emerge
  state is gated by the guard `player_outside(pipe_clear_radius)` with
  `pipe_clear_radius = TUNE 2.6 m`; the cycle is a two-state ping-pong with a
  60-tick hold each way.
- **Damage** — contact 1, **only while out of the pipe**. Resistances:
  `stomp: take`, `contact: take`, `projectile: take`. When retracted it has no
  collider (`collider.active_states`).
- **Pool** — `P2`, cap 24.
- **Spawn** — placed by the stage's `actors[]`, bound to a `kenney.platformer.pipe`
  prop; `respawn_policy: never`.
- **Assets** — body `shorepine-kenney/3d/platformer/plant.glb` (static, 0 clips);
  pipe `shorepine-kenney/3d/platformer/pipe.glb` (static). **Emergence has no
  clip** → tier 2 scripted transform: `transform: {type:"uniform_scale",
  scale:0.72}` plus a vertical rise over 30 ticks. Behavioural difference:
  **the plant does not unfold; it rises and shrinks evenly. A non-uniform squash
  is not used, because it would change the silhouette at runtime.**
- **Acceptance** — the normal variant does **not** emerge while the player is
  adjacent; it emerges within one tick of the player leaving the radius
  (`REQ-C-008`).

#### 5.3.6 `enemy.haul_maul` — **Haul Maul**
*Ref: `projectile_arc_thrower` · family `SMB1`*
- **Behaviour** — A heavy labourer that lobs an overhand implement in a **fixed
  arc** on a cooldown. The arc is fully telegraphed: a 15-tick wind-up with a
  visible raise, then the release. The projectile is dodgeable by leaving the arc.
  This is the archetype that teaches "the arc is the tell".
- **FSM** — `spawn → idle(60) → patrol → chase → attack(45)`; the attack is
  telegraph 15 → release → recover 30; cooldown 120 ticks between throws
  (`TUNE 2.0 s`).
- **Damage** — contact 1. Resistances: `stomp: take` (it is stompable but heavy —
  `bounce_on_defeat` is stronger), `projectile: take`.
- **Pool** — `P1`, cap 8.
- **Spawn** — `spawn` trigger, aggro `TUNE 9.0 m`.
- **Assets** — body `kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/Barbarian.glb`
  (skinned, 76 clips, `kaykit_41`); implement as a named attachment
  `kaykit-adventurers/.../Assets/gltf/axe_2handed.gltf` on the rig's `hand_right`
  socket; the thrown projectile is a *separate* named file —
  `kaykit-adventurers/addons/kaykit_character_pack_adventures/Assets/gltf/smokebomb.gltf`. Clip map: `idle → Idle`,
  `chase → Running_A`, `attack → 2H_Melee_Attack_Chop` (the throw read),
  `defeated → Death_A`.
- **Acceptance** — the projectile follows the configured trajectory and can be
  dodged by leaving the arc; the cooldown is respected (`REQ-C-010`).

#### 5.3.7 `enemy.skywatcher` — **Skywatcher**
*Ref: `airborne_spawner` · family `SMB1`*
- **Behaviour** — Hovers above the lane and **deploys** a subordinate hazard that
  falls. It never attacks directly. It has a hard cap on live subordinates and a
  hard cap on total spawns; when either is reached it retreats upward and leaves.
  This is the archetype that teaches "the enemy in the sky is a delivery system".
- **FSM** — `spawn → idle(60) → patrol(hover) → attack(deploy)`; the deploy state
  has a 45-tick cycle; it exits to `retreat` when `subordinate_cap_reached`.
- **Damage** — contact 0 (harmless to touch). Resistances: `stomp: take`,
  `projectile: take`. **The subordinates are the threat.**
- **Pool** — `P1`, cap 6. Subordinate cap `TUNE 3` live, `TUNE 8` total.
- **Spawn** — `spawn_on_sight` trigger, high in the volume.
- **Assets** — body `shorepine-kenney/3d/cube-pets/animal-bee.glb` (node-transform,
  8 clips); subordinate `shorepine-kenney/3d/cube-pets/animal-chick.glb`.
  **Hover has no clip** → tier 2 `transform: {type:"bob", amplitude_m:0.3, period_s:1.1}`
  over the `idle` clip. Behavioural difference: **the bee does not fly; it bobs.**
- **Acceptance** — the spawner never exceeds its cap and despawned hazards leave the
  active entity list (`REQ-C-009`).

#### 5.3.8 `enemy.thornback` — **Thornback**
*Ref: `spiked_floor_threat` · family `SMB1`*
- **Behaviour** — A floor threat: a spiked trap that rises from the ground on a
  cycle and retracts. It is not an actor that walks — it is a **hazard with a
  state machine** and an explicit attack hitbox.
- **FSM** — `spawn → idle(hidden) → attack(rise) → idle(retract)`, a 120-tick
  cycle (60 hidden, 30 rising, 30 out).
- **Damage** — contact 1 while out. Resistances: `stomp: immune` (a trap cannot be
  stomped), `projectile: immune`, `environment: immune` — it is inert to damage.
- **Pool** — `P2`, cap 24.
- **Spawn** — placed by the stage's `actors[]` at a floor position;
  `respawn_policy: never`; `activation.sleep: always` (a trap's cycle continues
  off-camera).
- **Assets** — `shorepine-kenney/3d/platformer/trap-spikes.glb` (**animated**,
  3 clips: `show`, `hide`, `show-hide`). Clip map: `attack → show`,
  `idle → hide`. **This is the one hazard family with a real authored clip** — no
  scripted transform is needed.
- **Acceptance** — the hazard has a non-empty attack hitbox declared in the
  archetype data, and its `show`/`hide` clips change on exactly the state
  transition (`REQ-C-013`).

#### 5.3.9 `enemy.cinder_shell` — **Cinder Shell**
*Ref: `horizontal_projectile` · family `SMB1`*
- **Behaviour** — A launched projectile that flies **horizontally** along the lane
  at constant speed, damaging the first thing it touches and then detonating. It
  cannot be stomped, cannot be turned around, and only a reflection or a
  `moving_shell` hit stops it. It is the archetype that teaches "some things you
  can only dodge".
- **FSM** — this is a **projectile**, not an actor: the projectile FSM is
  `spawn → move → hit → exhaust`. It is spawned by a turret archetype, not by a
  trigger.
- **Damage** — contact 1. Resistances: `stomp: immune`, `contact: take`,
  `projectile: take` (it can be shot down), `moving_shell: take`. Reflection is **not**
  a resistance — it is an outcome override: `damage.outcome_overrides` sets
  `{"projectile": {"outcome":"reflect", "on_state":"default"}}` on the
  archetype that owns the reflector (`REQ-C-018`).
- **Pool** — `P4`, cap 64 (projectiles are counted against the pooled-object cap
  of 128 per type).
- **Spawn** — by a `enemy.ember_turret` or a boss; never by a stage trigger.
- **Assets** — `shorepine-kenney/3d/platformer/bomb.glb` (static, 0 clips). **Spin
  has no clip** → tier 2 `transform: {type:"orbit_offset", amplitude_m:0.18,
  period_s:0.5}` rotating the mesh about its local X while it flies.
- **Acceptance** — the projectile travels a straight line at its configured speed,
  damages the first actor it overlaps, and despawns on impact; a reflected copy
  travels back toward its source (`REQ-C-018`).

#### 5.3.10 `enemy.sardine` — **Sardine**
*Ref: `aquatic_fish` · family `SMB1`*
- **Behaviour** — A fish that swims in a straight patrol inside a water volume,
  ignoring gravity, and dies on contact with the player. It does not leave the
  water volume: the water zone's bounds are a hard constraint on its `swim_patrol`
  controller.
- **FSM** — `spawn → idle(60) → patrol(swim) → chase` (a fish only chases within
  `TUNE 4.0 m`), `killed → defeated`.
- **Damage** — contact 1. Resistances: `stomp: take` (a stomp works on a fish),
  `contact: take`, `projectile: take`.
- **Pool** — `P3`, cap 48; `activation.sleep: always` (a fish keeps swimming).
- **Spawn** — `spawn` trigger inside a water volume; `respawn_policy: always` in
  shoals.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-fish.glb` (3 meshes,
  node-transform, 8 clips). **Swim has no clip (GAP-A10)** → tier 2:
  `transform: {type:"bob", amplitude_m:0.11, period_s:0.85}` + `yaw_deg: 11`,
  base clip `idle`. Behavioural difference: **the fish translates and turns; the
  body does not undulate.**
- **Acceptance** — an underwater enemy's behaviour differs from the land
  equivalent under identical input, and its collision mask rejects land-only
  queries (`REQ-C-011`).

#### 5.3.11 `enemy.lantern_jelly` — **Lantern Jelly**
*Ref: `squid_homing` · family `SMB1`*
- **Behaviour** — A floating creature that **homes** on the player: it drifts
  slowly and then accelerates toward the player's position on a fixed interval,
  with a brief re-aim between surges. It cannot be killed by contact — it *is*
  the contact. It passes through terrain (its mask excludes `solid`).
- **FSM** — `spawn → idle(60) → patrol(drift) → chase(surge)`; the chase state has
  a 90-tick cycle: 30 drift, 30 aim, 30 surge. It never stops moving.
- **Damage** — contact 1. Resistances: `stomp: take`, `projectile: take`,
  `contact: take`.
- **Pool** — `P2`, cap 24; `activation.sleep: always`.
- **Spawn** — `spawn_on_sight` trigger; `respawn_policy: never`.
- **Assets** — `kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/Rogue_Hooded.glb`
  (skinned, 76 clips, `kaykit_41`). **Flight has no clip** → tier 2
  `transform: {type:"bob", amplitude_m:0.3, period_s:1.4}`, base clip `Idle`.
  Behavioural difference: **it is a floating hooded figure, not a tentacled creature —
  the nearest available original analogue to a drifting cephalopod.**
- **Acceptance** — the homing creature's surge re-aims at the player's current
  position, and it passes through a `solid` collider without being blocked
  (`REQ-C-011`, mask assertion).

#### 5.3.12 `enemy.cinder_ascender` — **Cinder Ascender**
*Ref: `vertical_lava_jumper` · family `SMB1`*
- **Behaviour** — A vertical threat that erupts upward out of a lava or hazard
  volume at intervals and falls back. Its damage window is the rise and the fall;
  it is safe while hidden. It is the archetype that teaches "the floor is not
  always safe".
- **FSM** — `spawn → idle(hidden) → jump(rise, 90 ticks) → idle(fall)`.
- **Damage** — contact 1 **while ascending or descending**. Resistances:
  `stomp: immune`, `projectile: immune`, `environment: immune`.
- **Pool** — `P2`, cap 24; `activation.sleep: always`.
- **Spawn** — placed at a hazard surface; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/mini-dungeon/trap.glb` (**animated**, 2 meshes,
  3 clips: `show`, `hide`, `show-hide`). Clip map: `jump → show`,
  `idle → hide`. Behavioural difference: the trap does not ascend *and* descend —
  it toggles — so the vertical travel is **not** an `anim_plan` transform. The
  division of responsibility is fixed: **`anim_plan` plays the pose, the movement
  controller moves the body.** The `anim_plan` entry here is
  `{type:"none"}` with the `show`/`hide` clips; the 90-tick vertical travel is
  the `fall_gravity` controller's Y offset.
- **Acceptance** — the ascender is only damaging during its `jump` state and never
  damages while `idle` (`REQ-C-013`).

#### 5.3.13 `boss.ashen_regent` — **Ashen Regent**
*Ref: `arena_bridge_boss` · family `SMB1`* · **class `boss`**
- **Behaviour** — The region's bridge boss. A large skeletal regent that paces its
  arena, slams the ground, and drops masonry. It can also be defeated **without
  damage** by collapsing the bridge it stands on (`REQ-C-017`).
- **FSM** — the full boss FSM (§7.1): `arena_enter → intro(90) → combat →
  phase_transition → combat → stagger → …→ defeated(120) → reward → despawn`.
  The damage window is **not a state**: it is the window flag on `combat`
  (§7.1.3), which resolves the matrix row to `vulnerable` or `invulnerable`.
- **Damage** — contact 1. Resistances: `stomp: take` (only in a vulnerable
  window), `projectile: take`, `crush: take`, `environment: take`. Phases have
  separate HP pools.
- **Pool** — `P0`, cap 1.
- **Spawn** — `boss_trigger` volume at the arena mouth; `respawn_policy: never`
  (the retry path is handled by the checkpoint, `REQ-C-019`).
- **Assets** — body
  `kaykit-skeletons/addons/kaykit_character_pack_skeletons/Characters/gltf/Skeleton_Warrior.glb`
  (skinned, 95 clips, `kaykit_skeleton_41`), `uniform_scale: 1.6`; the masonry it
  drops is `shorepine-kenney/3d/platformer/rocks.glb`; the bridge is
  `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/neutral/building_bridge_A.gltf` +
  `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/neutral/building_bridge_B.gltf`.
- **Acceptance** — the boss may be defeated only during enabled damage windows, and
  the bridge-collapse route removes it with **no damage applied** (`REQ-C-015`,
  `REQ-C-017`).

#### 5.3.14 `enemy.slipstream_bear` — **Slipstream Bear**
*Ref: `current_following_swimmer` · family `SMB1`*
- **Behaviour** — The third member of the aquatic group and the third leg of
  `REQ-C-011`. It does not choose its own path: it is **carried by the water
  current** and drifts with it, so its position is the sum of the current
  velocity field and a weak self-nudge. It is the archetype that teaches "the
  water moves things" — the player cannot outrun it by running, only by changing
  lanes. It never leaves the water volume, and it is swept to the volume's
  downstream edge and respawned at its upstream edge.
- **FSM** — `spawn → idle(60) → patrol(drift) → chase(drift toward the player)`.
  Its `chase` is a **current-relative** pursuit: it aims at the player but the
  current still carries it, so it overshoots and must correct.
- **Damage** — contact 1. Resistances: `stomp: take` (a stomp works on it, and
  the stomp's downward arc is the only way to fight the current), `contact: take`,
  `projectile: take`.
- **Pool** — `P3`, cap 48; `activation.sleep: always` (a current-carried body is
  part of the water's state).
- **Spawn** — `spawn` trigger inside a water volume with a declared
  `current_vector`; `respawn_policy: always` (the volume re-seeds it upstream).
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-polar.glb` (5 meshes,
  node-transform, 8 clips). **Swim has no clip (GAP-A10)** → tier 2
  `transform: {type:"bob", amplitude_m:0.13, period_s:0.95}` over the base clip
  `idle`, with the drift carried by the controller's current field rather than by
  the animation. Behavioural difference: **the bear is carried, not swimming — it
  does not stroke, and it reads as a heavy body in moving water.**
- **Acceptance** — the bear's position equals the integrated current field plus
  its self-nudge; it never leaves its water volume; it is swept downstream and
  re-seeded upstream; it is damaged by a stomp and by a projectile, and by nothing
  else (`REQ-C-011`).

### 5.4 Family B — reference family `Lost Levels` (research tag)

Four archetypes: the difficulty-forward set. **Parameter sets, not mash-ups** — the
aggressive pipe plant is a *different archetype with a different rig*, not a flag.

#### 5.4.1 `item.cinder_thorn` — **Cinder Thorn** *(Board D item, negative pickup)*
*Ref: `negative_pickup` · family `Lost Levels`*

> **This entry is not an actor archetype.** A negative pickup is a **Board D
> item**, living at `src/content/items/item.cinder_thorn.item.json` under ARCH §5.4
> with `kind: negative` and `harm: true`. ARCH §5.3's `kind` vocabulary for actor
> archetypes is `{player, enemy, boss, companion, projectile, carried_object}`
> and has no `item` member, so this board does not add one. The entry is here
> because the negative pickup is an entity the player collides with, and because
> the requirement it serves (`REQ-D-003`) is owned here.
- **Behaviour** — A visibly spiked pickup. Touching it invokes the **damage path**
  (`damage_type: poison`) and a power-state downgrade. It never adds to the
  positive inventory. Under the fairness setting it emits a warning cue 0.5 s
  before its effect becomes active.
- **FSM** — item FSM: `idle → warn(30 ticks) → armed → collected`.
- **Damage** — `poison` magnitude 1; the matrix row `poison × default → damage`
  applies. It has **no** `effect.type = power_state` of a positive kind
  (ARCH §5.4 rule `ITEM-004`).
- **Pool** — `P3`, cap 48.
- **Spawn** — from a block payload or a stage `actors[]` entry.
- **Assets** — `shorepine-kenney/3d/platformer/spike-block.glb` (static).
  **ASSET GAP `GAP-ENT-01`:** the corpus has no distinct food-shaped poison item;
  the spiked block is the nearest named analogue and it is a *deliberate* silhouette
  choice so that the harmful pickup is never confused with the growth item. A
  food-shaped negative pickup is a polish gap, not a blocker.
- **Acceptance** — a negative pickup invokes the damage path and **never**
  increments the positive inventory (`REQ-D-007`, Board D's rule, honoured here
  because the item's authority is this board).

#### 5.4.2 `enemy.feral_stalk` — **Feral Stalk**
*Ref: `aggressive_proximity_variant` · family `Lost Levels`*
- **Behaviour** — A tall, spiky-stalk plant that emerges **regardless** of the
  player's proximity and immediately begins a lunge. It is strictly harder than
  `enemy.vine_maw`: shorter telegraph, faster emergence, and it does not pause.
  It is the archetype that teaches "some plants do not wait".
- **FSM** — `spawn → idle(hidden) → attack(emerge + lunge, 45 ticks) → idle(60)`.
  **No proximity guard on the emerge transition.**
- **Damage** — contact 1. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P1`, cap 8.
- **Spawn** — bound to a `kenney.platformer.pipe` prop; `respawn_policy: never`.
- **Assets** — body `shorepine-kenney/3d/platformer/flowers-tall.glb` (static);
  pipe `shorepine-kenney/3d/platformer/pipe.glb`. Emergence is a tier-2 scripted
  transform (rise + a uniform scale over 18 ticks) — the plant does not unfold.
- **Acceptance** — the aggressive variant **does** emerge while the player is
  adjacent, and the normal variant does not (`REQ-C-008`).

#### 5.4.3 `enemy.drip_vault` — **Drip Vault**
*Ref: `ceiling_emitter` · family `Lost Levels`*
- **Behaviour** — A ceiling-mounted emitter that drops a heavy weight on a
  telegraph, then retracts. It is a hazard with a clear read: the ceiling plate
  lifts, then the weight falls. Its cycle continues off-camera.
- **FSM** — `spawn → idle(armed, 120 ticks) → attack(drop, 45 ticks) → idle`.
- **Damage** — contact 1 while dropping. Resistances: `stomp: immune`,
  `projectile: immune`.
- **Pool** — `P2`, cap 24; `activation.sleep: always`.
- **Spawn** — placed at a ceiling position; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/platformer/trap-spikes-large.glb` (**animated**,
  3 clips: `show`, `hide`, `show-hide`); the dropped weight is
  `shorepine-kenney/3d/platformer/crate-strong.glb`.
- **Acceptance** — the hazard has a declared, non-empty attack hitbox, and its
  damage window matches its `attack` state exactly (`REQ-C-013`).

#### 5.4.4 `enemy.gale_warden` — **Gale Warden**
*Ref: `directional_force_stage` · family `Lost Levels`*
- **Behaviour** — A **stage-level** threat rather than a roaming actor: a set of
  directional wind volumes that push the player along the lane, plus a drifting
  hazard that only makes sense inside them. The Warden is the visible source — a
  rotor that spins and a set of arrow markers that show the flow direction. The
  *mechanic* is the wind volume (3D-TRANSLATION §2.8); the Warden is its
  telegraph.
- **FSM** — `spawn → idle(spinning) → attack(gust, 120 ticks) → idle`. The gust
  phase raises the wind volume's magnitude to `TUNE 14.0 m/s²`; the calm phase
  drops it to `TUNE 4.0 m/s²`.
- **Damage** — contact 1 on the rotor only. Resistances: `stomp: take` (it is
  exposed between gusts), `projectile: take`.
- **Pool** — `P1`, cap 4.
- **Spawn** — one per stage; `respawn_policy: never`.
- **Assets** — rotor `shorepine-kenney/3d/platformer/saw.glb` (static; the spin is
  a tier-2 scripted rotation about its local Y — a runtime transform of a named
  asset, permitted); direction markers `shorepine-kenney/3d/platformer/arrows.glb`
  and `arrow.glb` (static, instanced along the wind volume). **The wind volume is
  a physics zone, not an asset** (3D-TRANSLATION §2.8).
- **Acceptance** — the wind volume applies its acceleration only while the player
  is airborne, the trajectory is predictable with no jitter, and the rotor's
  attack hitbox is declared and non-empty (`REQ-A-010` as consumed here,
  `REQ-C-013`).

### 5.5 Family C — reference family `SMB2 USA` (research tag)

Sixteen archetypes. This family introduces **carry/throw**, **slippery surfaces**
and the **weapon-bearing** enemy, all of which are parameter sets on the reference
FSM of §3 — no new states are invented here.

#### 5.5.1 `enemy.bolt_clerk` — **Bolt Clerk**
*Ref: `bullet_shooter` · family `SMB2 USA`*
- **Behaviour** — A stationary clerk that fires a straight bolt down the lane on a
  cooldown, from a fixed muzzle point. It has a 20-tick aim telegraph (the arm
  raises) before the shot. It never moves. Leaving the lane line is the only
  defence.
- **FSM** — `spawn → idle(60) → patrol(0, stationary) → attack(45: aim 20, fire, recover 25) → idle`;
  cooldown `TUNE 2.4 s` between shots.
- **Damage** — contact 0. Resistances: `stomp: take`, `projectile: take`. Its
  bolts are a separate projectile archetype.
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger, aggro `TUNE 12.0 m`.
- **Assets** — `shorepine-kenney/3d/mini-arcade/character-employee.glb` (skinned, 2
  skins, 32 clips, `kenney_cast_32`); the bolt projectile is
  `shorepine-kenney/3d/platformer/arrow.glb`; the muzzle attachment is the rig's
  `hand_right` socket. Clip map: `idle → idle`, `attack → holding-right-shoot`,
  `defeated → die`.
- **Acceptance** — the bolt follows the configured straight trajectory, can be
  dodged by leaving the lane, and the cooldown is respected (`REQ-C-010`).

#### 5.5.2 `enemy.sporthare` — **Sporthare**
*Ref: `leaper` · family `SMB2 USA`*
- **Behaviour** — A leaper that closes in short hops. It leaps **over** a low
  obstacle or a gap, landing on the far side. Its leap arc is a fixed parabola,
  not a physics guess, so it is always dodgeable by standing still at the apex.
- **FSM** — `spawn → idle(60) → patrol → chase → jump(90: 20 crouch, 50 air, 20 land) → chase`.
  The jump state is bounded at 90 ticks so a bad leap cannot hang it.
- **Damage** — contact 1 while landed; **0 while airborne** (so the player can
  stand under it safely — the leap over the player is a signature move).
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger, aggro `TUNE 8.0 m`.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-bunny.glb` (5 meshes,
  node-transform, 8 clips). **The leap has no clip** → tier 2 scripted transform
  `transform: {type:"arc", amplitude_m:1.15, period_s:0.72}` over the base clip
  `walk`. Behavioural difference: **the bunny arcs without a visible crouch.**
- **Acceptance** — the leaper clears a 1-block gap and lands on the far side; its
  contact damage is 0 during the airborne phase.

#### 5.5.3 `enemy.wall_creeper` — **Wall Creeper**
*Ref: `climbing_pursuer` · family `SMB2 USA`*
- **Behaviour** — A climber that ascends a ladder or a climbable wall volume and
  pursues the player **vertically**, reversing direction at the endpoints. It
  cannot detach into a solid wall (3D-TRANSLATION §2.11). It is the archetype that
  makes verticality a threat.
- **FSM** — `spawn → idle(60) → chase(climb) → retreat(drop) → idle`. The climb
  controller drives vertical velocity directly from the player's Y and clamps at
  the volume's endpoints.
- **Damage** — contact 1. Resistances: `stomp: take` (only at the top, when it
  steps off), `projectile: take`.
- **Pool** — `P1`, cap 8.
- **Spawn** — bound to a `kenney.platformer.ladder` / `ladder-long` volume;
  `respawn_policy: never`.
- **Assets** — `kaykit-character-animations-1.2.zip → Animations/gltf/KayKit_AnimatedCharacter_v1.2.glb`
  (skinned, 30 clips). **This is the only rig in the corpus with a `Climbing`
  clip** (GAP-A10, tier 1) — it also has `Hop`, `Roll`, `AttackCombo`,
  `Shoot(1h)`, `Shoot(2h)Bow`. Clip map: `chase → Climbing`, `jump → Hop`,
  `attack → Attack(1h)`.
- **Acceptance** — the climber reverses at the volume endpoints and cannot detach
  into a solid wall; its climb uses the authored `Climbing` clip, not a scripted
  transform (`REQ-C-012` as consumed here; the `REQ-A-014` rule).

#### 5.5.4 `enemy.reliquary_warden` — **Reliquary Warden**
*Ref: `key_guardian` · family `SMB2 USA`*
- **Behaviour** — A guardian that stands still and will not move for any reason.
  It is invulnerable to everything except being **carried and thrown** or being
  hit by a `moving_shell`. It exists to force a mechanic: you do not kill it, you
  move it. It marks a key or a locked door.
- **FSM** — `spawn → idle(60, terminal)`. `idle` has **no** `patrol`, `chase` or
  `attack` transitions. `damaged → stunned` only for `thrown` / `moving_shell`.
  It is the archetype that proves `REQ-C-002`'s "every state has a guard" rule
  without needing every state.
- **Damage** — contact 1. Resistances: `stomp: immune`, `projectile: immune`,
  `moving_shell: take`, `thrown: take`, `environment: take`, `crush: take`.
- **Pool** — `P1`, cap 4.
- **Spawn** — placed by the stage, tied to a `key` or `lock` trigger;
  `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/graveyard/character-keeper.glb` (6 meshes,
  node-transform, 32 clips, `kenney_graveyard_32`).
- **Acceptance** — the warden is immune to stomp and projectile damage, cannot be
  pushed by contact, and is defeated only by a thrown body or a moving shell.

#### 5.5.5 `enemy.ember_archer` — **Ember Archer**
*Ref: `fire_shooter` · family `SMB2 USA`*
- **Behaviour** — A ranged attacker that lobs a burning shot on a **high arc**,
  so it clears obstacles. The arc's apex is visible. Unlike the Bolt Clerk, its
  shot travels over the player's head if the player stays near — the counter is to
  close the distance.
- **FSM** — `spawn → idle(60) → chase → attack(45: aim 25, release, recover 20)`;
  cooldown `TUNE 2.8 s`; it keeps its distance (`too_close → retreat`).
- **Damage** — contact 0. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P1`, cap 8.
- **Spawn** — `spawn` trigger, aggro `TUNE 13.0 m`.
- **Assets** — `shorepine-kenney/3d/mini-forest/character-archer.glb` (skinned, 32
  clips, `kenney_cast_32`); the shot is `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/candle_melted.gltf`.
  Clip map: `attack → holding-right-shoot`.
- **Acceptance** — the shot follows a high arc that clears a 2-block obstacle, and
  the arc's apex is inside the telegraph window (`REQ-C-010`).

#### 5.5.6 `enemy.blast_boar` — **Blast Boar**
*Ref: `explosive` · family `SMB2 USA`*
- **Behaviour** — A slow charger that detonates on contact — or when it dies. It
  can be **defused** by a stomp that lands in its last half-second of fuse, which
  is the archetype's whole reason to exist.
- **FSM** — `spawn → idle(60) → chase → attack(detonate, 30-tick fuse) → defeated`.
  The fuse state shows a visible wind-up and a rising warning.
- **Damage** — contact 1. Resistances: `stomp: take` (defusing it), `projectile:
  take`. Its explosion is an `environment`-type event with magnitude 2.
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger, aggro `TUNE 7.0 m`.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-hog.glb` (6 meshes,
  node-transform, 8 clips). Clip map: `chase → run`, `attack → gesture-negative`,
  `defeated → dance`.
- **Acceptance** — the boar detonates on contact and its explosion honours the
  resistance matrix (`environment` row), and a stomp inside the fuse window
  defuses it without damage.

#### 5.5.7 `enemy.eggbearer` — **Eggbearer**
*Ref: `aerial_carrier` · family `SMB2 USA`*
- **Behaviour** — A flier that carries a **payload** (an egg) and drops it when it
  is hit or when it reaches a marked drop zone. It never attacks the player
  directly; the egg is the threat, and it becomes a free pickup if it lands
  undamaged.
- **FSM** — `spawn → idle(60) → patrol(hover) → chase(hold) → attack(drop, 45) → patrol`.
- **Damage** — contact 0. Resistances: `stomp: take` (dropping the egg),
  `projectile: take`.
- **Pool** — `P1`, cap 6.
- **Spawn** — `spawn_on_sight`, high in the volume.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-penguin.glb` (5 meshes,
  node-transform, 8 clips); the payload is `shorepine-kenney/3d/platformer/coin-gold.glb`
  rendered as the carried egg. **Hover has no clip** → tier 2
  `transform: {type:"bob", amplitude_m:0.26, period_s:1.2}`.
- **Acceptance** — the carrier's payload is dropped exactly once, on hit or at the
  drop zone, and the drop leaves the active entity list when collected.

#### 5.5.8 `enemy.slate_skater` — **Slate Skater**
*Ref: `runner` · family `SMB2 USA`*
- **Behaviour** — A fast runner that crosses the lane quickly and **cannot be
  stopped** once committed. It is the archetype that teaches "some enemies commit
  to their direction". It has a longer telegraph than a walker but a much shorter
  recovery.
- **FSM** — `spawn → idle(60) → patrol → chase → attack(slide, 45) → retreat`.
  On `chase` it locks a direction and cannot turn until it has passed the player.
- **Damage** — contact 1. Resistances: `stomp: take` (it is fast but light),
  `projectile: take`.
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger, aggro `TUNE 10.0 m`.
- **Assets** — `shorepine-kenney/3d/mini-skate/character-skate-girl.glb` (skinned,
  2 skins, **29 clips** — the 25-clip set plus `skate`, `skate-stand`, `skate-air`,
  `skate-grab`). Clip map: `chase → skate`, `attack → skate-air`,
  `idle → skate-stand`.
- **Acceptance** — the runner locks its direction on commit and cannot turn; its
  speed is measurably higher than `enemy.pebble_grub`'s (`REQ-C-005` speed
  variants).

#### 5.5.9 `enemy.rail_rider` — **Rail Rider**
*Ref: `machine_rider` · family `SMB2 USA`*
- **Behaviour** — An enemy that **rides a moving platform** (a machine block) and
  attacks from it. The machine follows its own route; the rider inherits the
  machine's delta exactly, with no slip (the `REQ-D-009` "no slip" rule applied
  to an enemy). Shooting the rider leaves the machine running empty.
- **FSM** — `spawn → idle(60) → patrol(ride) → attack(45)`; the rider is parented
  to the machine's motion, not to the world.
- **Damage** — contact 1. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P1`, cap 8.
- **Spawn** — bound to a `kenney.platformer.block-moving` route.
- **Assets** — rider `shorepine-kenney/3d/platformer/character-oodi.glb`
  (skinned, 1 skin, 25 clips, `kenney_cast_6`); machine `shorepine-kenney/3d/platformer/block-moving.glb`
  (static, 0 clips — the machine's travel is a controller-driven transform, not an
  authored clip).
- **Acceptance** — the rider's world position equals the machine's position plus
  its socket offset for 60 consecutive ticks with no drift (`REQ-D-009`).

#### 5.5.10 `enemy.thornmat` — **Thornmat**
*Ref: `spiked_hazard` · family `SMB2 USA`*
- **Behaviour** — A floor hazard that rises and retracts on a slower, more
  punishing cycle than `enemy.thornback`, and **stays out longer**. It is the
  variant that teaches "the timing is the same, the tolerance is not".
- **FSM** — `spawn → idle(hidden, 90) → attack(rise, 45) → idle`.
- **Damage** — contact 1 while out. Resistances: `stomp: immune`, `projectile:
  immune`, `environment: immune`.
- **Pool** — `P2`, cap 24; `activation.sleep: always`.
- **Spawn** — placed by the stage; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/platformer/trap-spikes-large.glb` (**animated**,
  3 clips: `show`, `hide`, `show-hide`).
- **Acceptance** — the hazard has a non-empty declared attack hitbox, and its
  visible state (`show`/`hide`) matches its FSM state on every tick.

#### 5.5.11 `enemy.slush_hog` — **Slush Hog**
*Ref: `slippery_walker` · family `SMB2 USA`*
- **Behaviour** — A walker whose **acceleration and friction come from the
  surface material** (3D-TRANSLATION §1.1). On `ice` it glides; on `mud` it drags;
  on `solid` it walks normally. The archetype's own speed is constant — only the
  surface changes the result, which is exactly the `REQ-A-011` acceptance test
  applied to an enemy.
- **FSM** — as a standard walker. No new states.
- **Damage** — contact 1. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger, aggro `TUNE 6.0 m`.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-pig.glb` (6 meshes,
  node-transform, 8 clips).
- **Acceptance** — the same aggro event on `ice` and on `solid` produces measurably
  different travel distances for the same archetype.

#### 5.5.12 `enemy.recall_dart` — **Recall Dart** *(projectile class)*
*Ref: `returnable_projectile` · family `SMB2 USA`*
- **Behaviour** — A projectile that flies out to a maximum distance and then
  **returns to its owner**. It can be **caught and returned** by the player, in
  which case it damages the owner instead. This is the archetype behind
  `REQ-C-018`'s catch/return cycle.
- **FSM** — projectile FSM `spawn → move(out) → move(return) → hit → exhaust`.
  The return leg starts at `TUNE 2.2 s` or when it reaches `max_range_m`.
- **Damage** — contact 1 to the player, 1 to enemies. Resistances:
  `projectile: take`, `stomp: immune`. Outcome override:
  `{"projectile": {"outcome":"reflect"}}` — a catch flips the dart's
  `attacker_chain` to `[player_id]`.
- **Pool** — `P4`, cap 128 (the pooled-object per-type cap).
- **Spawn** — by `boss.spitcantor` or a `enemy.ember_turret`; never by a trigger.
- **Assets** — `shorepine-kenney/3d/platformer/arrows.glb` (static). **The spin
  has no clip** → tier 2 `transform: {type:"orbit_offset", amplitude_m:0.12,
  period_s:0.35}`. Behavioural difference: **it is a spinning fan of arrow
  cards rather than a single dart.**
- **Acceptance** — a caught dart returns toward its owner, credits the catcher,
  and damages the owner (`REQ-C-018`).

#### 5.5.13 `enemy.three_candle` — **Three Candle**
*Ref: `multi_head_flame` · family `SMB2 USA`*
- **Behaviour** — A stationary body with **three flame heads** that fire
  independently on three staggered cooldowns. Destroying one head removes that
  head's attacks; the body has three separate weak points. It is the enemy that
  teaches "the threat has parts".
- **FSM** — `spawn → idle(60) → attack(head_1 | head_2 | head_3, 45) → idle`,
  with three independent cooldowns offset by `TUNE 0.9 s`.
- **Damage** — contact 0. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P1`, cap 6.
- **Spawn** — placed by the stage; `respawn_policy: never`.
- **Assets** — body `shorepine-kenney/3d/blocky-characters/character-k.glb`
  (node-transform, 27 clips); head attachment
  `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/candle_triple.gltf`
  on the rig's `head` socket; the flame projectiles are
  `kaykit-halloween/.../candle_melted.gltf`.
- **Acceptance** — each head has an independent cooldown and removing one head
  removes exactly that head's shots (`REQ-C-010`).

#### 5.5.14 `enemy.ember_pair` — **Ember Pair**
*Ref: `splitting_flame` · family `SMB2 USA`*
- **Behaviour** — A creature that **splits into two smaller ones** when it takes a
  fatal blow. Each half is a complete, separately-simulated actor with its own
  health, so the fight is a two-stage fight. The halves cannot split again.
- **FSM** — `spawn → idle(60) → patrol → chase → attack`; on a fatal damage event
  the actor transitions to `defeated` **and spawns two `ember_pair` halves** with
  `scale_variant: small` and half health. The halves carry
  `attacker_chain = [the original killer]`, so a projectile that killed the parent
  is credited for the halves it spawns.
- **Damage** — contact 1. Resistances: `stomp: take`, `projectile: take`,
  `moving_shell: take`.
- **Pool** — `P2`, cap 24; each split is a **pool acquisition** and is subject to
  the pool's refusal counter.
- **Spawn** — `spawn` trigger, aggro `TUNE 7.0 m`.
- **Assets** — `shorepine-kenney/3d/mini-characters/character-male-a.glb` (skinned,
  32 clips, `kenney_cast_32`). The halves are **two instances of the same named
  asset** at `uniform_scale: 0.7` with half the health — this is scene composition
  of a complete named asset, **not** a composite of several characters into a new
  one (ARCH §8.3 forbids the latter and permits the former).
- **Acceptance** — a fatal blow spawns exactly two halves, the halves cannot
  split, and the credited attacker of the halves is the killer of the parent.

#### 5.5.15 `enemy.boulder_sergeant` — **Boulder Sergeant**
*Ref: `rock_volley` · family `SMB2 USA`*
- **Behaviour** — A ranged attacker that lobs **rocks in a volley** of three on a
  fixed cadence. The rocks land in a spread across the lane, so the player must
  move rather than duck.
- **FSM** — `spawn → idle(60) → chase → attack(volley, 90: aim 25, 3 throws, recover 25)`.
- **Damage** — contact 0. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P1`, cap 8.
- **Spawn** — `spawn` trigger, aggro `TUNE 12.0 m`.
- **Assets** — body `shorepine-kenney/3d/mini-arena/character-soldier.glb` (skinned,
  25 clips, bone-map family `kenney_cast_25` — the measured 25-clip family, which
  is **not** the 32-clip `kenney_cast_32` family); the rocks are `shorepine-kenney/3d/platformer/rocks.glb`.
  Clip map: `attack → 1H_Melee_Attack_Chop` is not available on this rig, so
  `attack → holding-right-shoot`.
- **Acceptance** — the volley fires exactly three rocks per cycle, they land in
  three distinct lane positions, and the cooldown is respected (`REQ-C-010`).

#### 5.5.16 `boss.glutton_crown` — **Glutton Crown**
*Ref: `item_fed_final_boss` · family `SMB2 USA`* · **class `boss`**
- **Behaviour** — The region's final boss. It is **fed**: it swallows items that
  appear in the arena, and each swallowed item makes it **bigger and stronger**.
  The fight is a race — the player must feed it the *wrong* items (a
  `negative` item deals damage; a `restorative` item shrinks it) or damage it
  before it eats. Eating enough items triggers its final form.
- **FSM** — the boss FSM (§7.1) with an extra `devour` state inside the attack
  loop: `arena_enter → intro(120) → combat → devour(60) → phase_transition → …`.
  `devour` is an **additional** state declared by this archetype (§3.1's
  inheritance rule), reached only from `combat`.
  `devour` is reachable only when an item is inside the `maw` volume.
- **Damage** — contact 1. Resistances: `stomp: take` (only in a vulnerable
  window), `projectile: take`, `poison: take` (a negative item damages it).
- **Pool** — `P0`, cap 1.
- **Spawn** — `boss_trigger`; `respawn_policy: never`.
- **Assets** — body `quaternius-ultimate-animated-character.zip → assets/glTF/Wizard.gltf`
  (skinned, 17 clips, `quaternius_23`), `uniform_scale: 1.5`; the items it eats
  are `shorepine-kenney/3d/platformer/mushrooms.glb` and
  `kenney.platformer.heart.glb`. Clip map: `intro → Idle`, `attack → Spellcast_Shoot`
  is not on this rig → `attack → Shoot_OneHanded`, `devour → PickUp`,
  `defeated → Defeat`.
- **Acceptance** — feeding the boss grows its size and its phase HP; a `negative`
  item reduces its phase HP and is not swallowed; the boss changes phase and
  leaves the arena with no live entity behind (`REQ-C-016`).

### 5.6 Family D — reference family `SMB3` (research tag)

Nineteen archetypes. This family is the **dense** end of the roster: many small,
fast, individually-weak enemies that combine. The `P3`/`P4` pool classes exist
for this family.

#### 5.6.1 `enemy.spring_wrench` — **Spring Wrench**
*Ref: `emerging_wrench_thrower` · family `SMB3`*
- **Behaviour** — A figure that erupts from the ground or from a block and throws
  a spinning tool upward in a lob. It cannot be attacked while it is emerging —
  the emerge is a 20-tick window in which it is invulnerable, which is what makes
  it a timing puzzle rather than a damage race.
- **FSM** — `spawn → idle(hidden) → attack(emerge 20, throw 25, retract 15) → idle`.
  The emerge window is an **additional state** named `emerge` (declared, not
  inherited — §3.1's rule allows an archetype to add states). It resolves to the
  `invulnerable` column of the matrix (§2.3.1), so the window is genuinely
  invulnerable.
- **Damage** — contact 0. Resistances: `stomp: take` (after it emerges),
  `projectile: take`.
- **Pool** — `P2`, cap 24; `activation.sleep: always`.
- **Spawn** — placed at a floor position; `respawn_policy: never`.
- **Assets** — body `shorepine-kenney/3d/platformer/character-oopi.glb`
  (skinned, 1 skin, 25 clips, `kenney_cast_6`); the thrown tool is
  `kaykit-skeletons/addons/kaykit_character_pack_skeletons/Assets/gltf/Skeleton_Axe.gltf`
  — **the nearest named analogue to a wrench**; behavioural difference: it is a
  bladed axe head, not a spanner, so its silhouette reads as an axe. The axe is
  also the enemy's held tool, so the two reads are consistent.
- **Acceptance** — the emerge window is invulnerable, the tool follows a lobbed
  parabola, and the tool despawns on impact (`REQ-C-010`).

#### 5.6.2 `enemy.chain_lion` — **Chain Lion**
*Ref: `tethered_charger` · family `SMB3`*
- **Behaviour** — A charger anchored to a fixed point by a chain. It charges
  toward the player, reaches the end of its chain, and is **jerked back** — a
  recovery window during which it is vulnerable. The chain is a visual line, not
  a collider; the anchor point is the constraint.
- **FSM** — `spawn → idle(60) → chase(charge) → retreat(reel, 45) → idle`.
  `retreat` is the vulnerable window.
- **Damage** — contact 1. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger with an `anchor_position`; aggro `TUNE 9.0 m`.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-lion.glb` (6 meshes,
  node-transform, 8 clips). **The chain has no clip and no asset** — it is drawn
  with the `kenney.platformer.poles` prop instanced along the line, which is
  scene composition of a named asset, not a generated mesh.
- **Acceptance** — the charger never travels beyond `chain_length_m` from its
  anchor, and the reel-back window is vulnerable (`REQ-C-013` as consumed here).

#### 5.6.3 `enemy.mirror_wraith` — **Mirror Wraith**
*Ref: `facing_based_ghost` · family `SMB3`*
- **Behaviour** — A ghost that **only moves when the player is not looking at it**
  in the sense the game defines: it advances while the player faces **away** from
  it, and freezes the instant the player turns to face it. It is the archetype
  that teaches "keep facing it". Facing is tested in 3D: the angle between the
  player's facing vector and the vector from the player to the ghost, within
  `TUNE 35°`.
- **FSM** — `spawn → idle(60) → chase(advance, guarded by `player_facing_away`)`.
  Its movement toggles **exactly** on the facing transition — a boolean edge, not
  a smoothed value.
- **Damage** — contact 1. Resistances: `stomp: zero` (a reaction but no damage —
  it is intangible to the stomp arc), `contact: take`, `projectile: take`.
- **Pool** — `P2`, cap 24; `activation.sleep: always`.
- **Spawn** — `spawn_on_sight`; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/graveyard/character-vampire.glb` (6 meshes,
  node-transform, 32 clips). **Flight has no clip** → tier 2
  `transform: {type:"bob", amplitude_m:0.22, period_s:1.1}`.
- **Acceptance** — the ghost's movement toggles **exactly** on the player's facing
  transition, with no intermediate speed (`REQ-C-012`).

#### 5.6.4 `enemy.bone_assembly` — **Bone Assembly**
*Ref: `reassembling_skeleton` · family `SMB3`*
- **Behaviour** — A skeleton that **falls apart** when killed and **reassembles**
  after a fixed delay, up to a fixed number of times, unless the player keeps
  attacking it during the reassembly window. It is the archetype that teaches
  "the fight is not over when the health bar empties".
- **FSM** — `spawn → idle(60) → patrol → chase → stunned(break, 30) → patrol`;
  the `stunned` state is the reassembly window, and it is **not** `defeated` until
  the break count exceeds `reassemble_limit` (3).
- **Damage** — contact 1. Resistances: `stomp: take` (the stomp is the break),
  `projectile: take`. Its health is restored to full at the end of each
  reassembly, up to the limit.
- **Pool** — `P1`, cap 8.
- **Spawn** — `spawn` trigger, aggro `TUNE 7.0 m`.
- **Assets** — `shorepine-kenney/3d/graveyard/character-skeleton.glb` (6 meshes,
  node-transform, 32 clips). The "scattered" state is a **per-mesh visibility
  toggle on the six named meshes of the same asset** — the asset's own parts,
  hidden and shown, not a new mesh.
- **Acceptance** — the skeleton reassembles at most three times, and a hit during
  the reassembly window prevents the reassembly.

#### 5.6.5 `enemy.crush_piston` — **Crush Piston**
*Ref: `vertical_crusher` · family `SMB3`*
- **Behaviour** — A block that slams down from above on a cycle and retracts. It
  is a **hazard with an actor-class FSM** because it has a damage window and a
  telegraph, but it never moves laterally.
- **FSM** — `spawn → idle(raised, 120) → attack(fall 20, hold 20, rise 30) → idle`.
- **Damage** — contact 2 while falling. Resistances: `stomp: immune`,
  `projectile: immune`, `environment: immune`, `crush: take`.
- **Pool** — `P2`, cap 24; `activation.sleep: always`.
- **Spawn** — placed at a ceiling position; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/platformer/block-moving-large.glb` (static,
  0 clips). **The crush has no clip** → the vertical travel is a controller-driven
  Y offset (the machine is a moving platform with a `loop` route, `REQ-D-009`).
- **Acceptance** — the crusher's damage window matches its `attack` state exactly
  and it has a declared, non-empty attack hitbox (`REQ-C-013`).

#### 5.6.6 `enemy.satellite_ward` — **Satellite Ward**
*Ref: `orbit_hazard` · family `SMB3`*
- **Behaviour** — A machine that **orbits a fixed pivot** on an ellipse, sweeping
  a damaging arc through the lane. It is the archetype that teaches "the safe
  spot moves".
- **FSM** — `spawn → idle(60) → patrol(orbit) → chase(orbit toward player)`.
  It never stops orbiting.
- **Damage** — contact 1. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P2`, cap 24; `activation.sleep: always`.
- **Spawn** — placed with a `pivot_position`; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/space/satelliteDish.glb` (static). **The orbit
  has no clip** → tier 2 `transform: {type:"orbit_offset", amplitude_m:2.4,
  period_s:4.0}` on the root, with the pivot-driven path supplied by the
  `orbit_point` controller.
- **Acceptance** — the ward stays on its declared ellipse and its attack hitbox
  sweeps with it (`REQ-C-013`).

#### 5.6.7 `enemy.marsh_wraith` — **Marsh Wraith**
*Ref: `surface_ghost` · family `SMB3`*
- **Behaviour** — A ghost that **skims a surface** — it is confined to a floor or
  a water plane and slides along it, unable to leave. It emerges from and sinks
  into the surface on a slow cycle. It is the archetype that teaches "the floor
  has a second layer".
- **FSM** — `spawn → idle(hidden, 90) → attack(skim, 120) → idle`; the skim is
  constrained to the surface plane by the controller's `lane_mode: lane_locked`
  plus a `surface_y` constraint.
- **Damage** — contact 1 while skimming. Resistances: `stomp: take`,
  `projectile: take`.
- **Pool** — `P2`, cap 24; `activation.sleep: always`.
- **Spawn** — placed on a surface; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/graveyard/character-ghost.glb` (3 meshes,
  node-transform, 32 clips).
- **Acceptance** — the wraith never leaves its declared surface plane and its
  damage window matches its `attack` state.

#### 5.6.8 `enemy.cinder_wisp` — **Cinder Wisp**
*Ref: `pursuing_flame` · family `SMB3`*
- **Behaviour** — A floating flame that **pursues the player** continuously at a
  steady speed and cannot be stopped or outrun at walking pace. It is defeated by
  any hit, but it is faster than a walker. This is the archetype that teaches
  "keep moving".
- **FSM** — `spawn → idle(60) → chase(pursue, permanent)`. It never leaves
  `chase` except on death.
- **Damage** — contact 1. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P3`, cap 48; `activation.sleep: always`.
- **Spawn** — `spawn_on_sight`; `respawn_policy: never`.
- **Assets** — `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/candle_melted.gltf`
  (static). **The flame has no clip** → tier 2
  `transform: {type:"bob", amplitude_m:0.14, period_s:0.5}` plus a yaw wobble.
- **Acceptance** — the wisp's speed is measurably greater than a standard walker's
  and it closes on a stationary player (`REQ-C-005` speed variants).

#### 5.6.9 `enemy.tusk_ram` — **Tusk Ram**
*Ref: `ground_shock` · family `SMB3`*
- **Behaviour** — A heavy beast that slams the ground, producing a **ground shock
  wave** that travels along the lane. The shock wave is a separate, travelling
  hazard with its own hitbox; the animal itself is slow.
- **FSM** — `spawn → idle(60) → patrol → chase → attack(slam, 60: raise 25, impact
  5, recover 30) → idle`.
- **Damage** — contact 1; the shock wave deals 1 and is an `environment`-typed
  event.
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger, aggro `TUNE 8.0 m`.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-cow.glb` (6 meshes,
  node-transform, 8 clips); the shock wave is a travelling
  `kenney.platformer.rocks` hazard — a rolling stone that travels the lane at ground
  height, implemented as a travelling **projectile archetype** with a `ground`
  travel mode.
- **Acceptance** — the shock wave spawns on the slam frame, travels along the lane
  at a constant speed, and despawns at the arena edge (`REQ-C-013`).

#### 5.6.10 `enemy.return_cask` — **Return Cask** *(projectile class)*
*Ref: `returning_projectile` · family `SMB3`*
- **Behaviour** — A projectile that flies out and **returns to its thrower** on a
  looping path, passing the player twice. Unlike `enemy.recall_dart`, it cannot
  be caught — it can only be dodged, or reflected.
- **FSM** — projectile FSM `spawn → move(out) → move(return) → hit → exhaust`.
- **Damage** — contact 1. Resistances: `projectile: take`, `stomp: immune`.
  Outcome override `{"projectile": {"outcome":"reflect"}}` when reflected.
- **Pool** — `P4`, cap 128.
- **Spawn** — by `enemy.sky_warden` or a boss.
- **Assets** — `shorepine-kenney/3d/platformer/barrel.glb` (static). **The spin has
  no clip** → tier 2 `transform: {type:"orbit_offset", amplitude_m:0.2,
  period_s:0.45}`.
- **Acceptance** — the cask passes the player twice on its loop and can be
  reflected (`REQ-C-018`).

#### 5.6.11 `enemy.censer_thrower` — **Censer Thrower**
*Ref: `flame_volley` · family `SMB3`*
- **Behaviour** — A thrower that lobs **flames in a spread volley** of three, in
  a shallow arc. Unlike `enemy.boulder_sergeant`, the spread is along the lane
  (three landing points in sequence) rather than across it.
- **FSM** — `spawn → idle(60) → chase → attack(volley, 90) → retreat`.
- **Damage** — contact 0. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P1`, cap 8.
- **Spawn** — `spawn` trigger, aggro `TUNE 11.0 m`.
- **Assets** — body `shorepine-kenney/3d/platformer/character-oozi.glb`
  (skinned, 1 skin, 25 clips, `kenney_cast_6`); the flame projectiles are
  `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/shrine_candles.gltf`.
- **Acceptance** — the volley fires exactly three flames that land at three
  distinct lane positions in sequence, and the cooldown is respected
  (`REQ-C-010`).

#### 5.6.12 `enemy.thornroller` — **Thornroller**
*Ref: `spiked_ball` · family `SMB3`*
- **Behaviour** — A spiked ball that rolls along the lane, bouncing off walls,
  reversing at ledges. It ignores the player and continues past them.
- **FSM** — `spawn → idle(60) → patrol(roll)`. It has no `chase` and no `attack`;
  its contact damage is continuous.
- **Damage** — contact 1. Resistances: `stomp: take` (a stomp stops it),
  `projectile: take`.
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/platformer/spike-block-wide.glb` (static).
  **The roll has no clip** → tier 2 `transform: {type:"orbit_offset",
  amplitude_m:0.3, period_s:0.8}` rotating the mesh about its local Z.
- **Acceptance** — the ball reverses at a ledge and at a wall, and its contact
  damage is 1 (`REQ-C-005` edge and obstacle turn).

#### 5.6.13 `enemy.ember_worm` — **Ember Worm**
*Ref: `segmented_pursuit` · family `SMB3`*
- **Behaviour** — A **segmented** creature: a chain of body segments that follow
  the leader. The player can stomp **any** segment, not just the head; the
  segments separate and rejoin. It is the archetype that teaches "the body has
  many hit points".
- **FSM** — one FSM per segment, all linked: the head runs `chase`; each
  segment follows its predecessor's position with a fixed delay. A stomp on a
  segment removes it; the worm rejoins after `TUNE 3.0 s`.
- **Damage** — contact 1 on any segment. Resistances: `stomp: take` (per
  segment), `projectile: take`.
- **Pool** — `P3`, cap 48 (each segment is a pooled instance).
- **Spawn** — `spawn` trigger; the segment count is `segment_count` (4–6).
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-caterpillar.glb` (5 meshes,
  node-transform, 8 clips). The segments are **one named asset instanced N times**
  along the path — instancing is explicitly permitted (ARCH §9.3).
- **Acceptance** — any segment can be stomped, the segments rejoin after the
  configured delay, and the pool count equals the segment count
  (`REQ-C-013`).

#### 5.6.14 `enemy.arc_plate` — **Arc Plate**
*Ref: `stationary_electric_hazard` · family `SMB3`*
- **Behaviour** — A floor plate that charges up (visible arcs) and then
  **electrocutes** anything standing on it. The charge-up is the telegraph. It is
  stationary and it does not move or chase.
- **FSM** — `spawn → idle(120) → attack(charge 40, live 30) → idle`.
- **Damage** — contact 1 while live. Resistances: `stomp: immune`,
  `projectile: immune`, `environment: immune`.
- **Pool** — `P2`, cap 24; `activation.sleep: always`.
- **Spawn** — placed on the floor; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/factory/piston-round.glb` (**animated**,
  3 clips: `toggle-on`, `toggle-off`, `toggle`). Clip map: `attack → toggle-on`,
  `idle → toggle-off`.
- **Acceptance** — the plate has a declared attack hitbox active **only** during
  its live window, and the telegraph is at least 40 ticks (`REQ-C-013`).

#### 5.6.15 `enemy.card_volley` — **Card Volley**
*Ref: `radial_projectile` · family `SMB3`*
- **Behaviour** — A caster that fires a **radial burst** of projectiles in every
  direction at once, in a ring. The ring has a gap the player can stand in — the
  burst is a puzzle, not a spray.
- **FSM** — `spawn → idle(60) → patrol → attack(burst, 45: wind 20, fire, recover
  25) → idle`; cooldown `TUNE 3.2 s`.
- **Damage** — contact 0. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P1`, cap 8.
- **Spawn** — `spawn` trigger, aggro `TUNE 12.0 m`.
- **Assets** — body `shorepine-kenney/3d/mini-dungeon/character-human.glb` (skinned, 32 clips,
  `kenney_cast_32`); the projectiles are `shorepine-kenney/3d/platformer/spike-block.glb`
  (spinning shards — one draw call per burst via a `MultiMesh`, ARCH §9.3).
- **Acceptance** — the burst fires a ring of projectiles with exactly one
  navigable gap, and the cooldown is respected (`REQ-C-010`).

#### 5.6.16 `enemy.tall_grazer` — **Tall Grazer**
*Ref: `movement_impediment` · family `SMB3`*
- **Behaviour** — A tall, slow creature that **blocks a corridor**. It cannot be
  pushed, cannot be killed quickly (armour 2), and cannot be stomped. It is the
  archetype that teaches "some enemies are terrain".
- **FSM** — `spawn → idle(60) → patrol → chase`. It does not attack; it is the
  attack.
- **Damage** — contact 1. Resistances: `stomp: immune`, `projectile: half`,
  `moving_shell: take`, `thrown: take`.
- **Pool** — `P1`, cap 6.
- **Spawn** — placed in a corridor; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-giraffe.glb` (5 meshes,
  node-transform, 8 clips).
- **Acceptance** — the grazer has armour 2, takes half damage from projectiles,
  and cannot be displaced by contact.

#### 5.6.17 `enemy.board_rider` — **Board Rider**
*Ref: `rideable_flyer` · family `SMB3`*
- **Behaviour** — A **rideable flyer**: the player may mount it in the
  `branching_companion` rule set, and while mounted it becomes a gliding vehicle
  with its own movement profile. Unmounted, it is a wild flyer that drifts. It is
  the archetype that makes "mount" a *creature* rather than a static platform.
- **FSM** — `spawn → idle(60) → patrol(drift) → chase`; the **mount** state is
  entered by the player's interact action and is handled by Board A's
  `mount/dismount` contract (3D-TRANSLATION §2.17, `REQ-A-018`).
- **Damage** — contact 0 unmounted (a rideable thing is not a hazard), contact 1
  when hostile (in a rule set without the mount feature it is hostile instead —
  **this is a rule-set feature gate, not a mode flag**: `rules.enabled("mount")`
  decides which archetype variant the stage loads; the archetype file itself
  never names a rule-set id).
- **Pool** — `P1`, cap 4.
- **Spawn** — placed on a landing platform; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/mini-skate/character-skate-boy.glb` (skinned,
  29 clips, including `skate`, `skate-stand`, `skate-air`, `skate-grab`).
- **Acceptance** — mounting transfers movement without duplicating the
  companion, and dismounting returns the player to the world (`REQ-A-018`).

#### 5.6.18 `boss.bastion_hopper` — **Bastion Hopper**
*Ref: `fortress_boss` · family `SMB3`* · **class `boss`** — REQ-C-016 pattern
**hopping fortress guard**
- **Behaviour** — A fortress that **hops** between two stances, firing a catapult
  volley when grounded and charging when it lands. Its body is a tower; its
  weapon is a turret. It is the boss that teaches "the boss is also the terrain".
- **FSM** — the boss FSM (§7.1), with the attack loop alternating
  `attack(hop) → attack(volley) → phase_transition`.
- **Damage** — contact 2. Resistances: `stomp: take` (only in a vulnerable
  window), `projectile: take`, `crush: take`.
- **Pool** — `P0`, cap 1.
- **Spawn** — `boss_trigger`; `respawn_policy: never`.
- **Assets** — body
  `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/red/building_tower_catapult_red.gltf`
  (static); turret `shorepine-kenney/3d/space/turret_single.glb` (static, 4
  meshes); projectiles `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/neutral/projectile_catapult.gltf`.
  **The body has no clip and cannot be rigged** (ARCH §8.3 forbids authoring a
  skeleton) → the hop is a **controller-driven Y offset** on the named asset and
  the turret's aim is a **scripted rotation** of the named turret asset.
- **Acceptance** — the boss changes phase and leaves the arena with no live entity
  behind (`REQ-C-016`).

#### 5.6.19 `boss.skybreaker` — **Skybreaker**
*Ref: `airship_boss` · family `SMB3`* · **class `boss`** — REQ-C-016 pattern
**mobile airship boss**
- **Behaviour** — A mobile airship that crosses the arena horizontally, dropping
  bombs and raking the lane with a beam. Its hull is composed of named rocket
  modules; a **pilot** in the bridge is the vulnerable point, and killing the
  pilot ends the fight — the hull is invulnerable.
- **FSM** — the boss FSM (§7.1); the attack loop alternates `attack(pass) →
  attack(drop) → attack(beam) → phase_transition`. In phase 2 the hull moves
  faster and drops two bombs per pass.
- **Damage** — the **hull** is `stomp: immune`, `projectile: immune`;
  the **pilot** takes `projectile: take` and `stomp: take`, and only the pilot's
  damage counts toward the phase HP. This is a per-hitbox resistance split, which
  the matrix supports because the resistance is read from the **hitbox's owner
  part**, not the actor.
- **Pool** — `P0`, cap 1.
- **Spawn** — `boss_trigger`; `respawn_policy: never`.
- **Assets** — hull
  `shorepine-kenney/3d/space/rocket_sidesA.glb` + `rocket_topA.glb` +
  `rocket_finsA.glb` + `rocket_fuelA.glb` + `satelliteDish.glb` (all static, all
  named); pilot `quaternius-animated-mech.zip → assets/Textured/glTF/Leela.gltf`
  (skinned, 18 clips: `Idle, Walk, Run, Jump, Punch, Kick, SwordSlash, Shoot,
  HitRecieve_1, HitRecieve_2, Death, …`); bombs `shorepine-kenney/3d/platformer/bomb.glb`.
  **The hull is a composition of named mechanical parts** — permitted scene
  composition, and explicitly *not* a composite of library characters into a new
  character (ARCH §8.3).
- **Acceptance** — the boss changes phase, its hull ignores damage while its
  pilot does not, and it leaves the arena with no live entity behind
  (`REQ-C-016`).

### 5.7 Family E — reference family `SMW` (research tag)

Fifteen archetypes. This family introduces **companions**, **tile alteration**
and **carryable mechanicals**, and it carries the `branching_companion` rule set's
signature actors.

#### 5.7.1 `companion.fox_pelt` — **Fox Pelt**
*Ref: `mount_companion` · family `SMW`* · **class `companion`**
- **Behaviour** — A rideable companion that the player can mount, carry, feed and
  release. Mounted, it moves faster than the player and can be steered; carried,
  it rides the player's carry socket; released, it recovers. It **eats** a
  designated item to restore a stat, and it **spits** a projectile on command.
  Mount/dismount transfers movement without ever duplicating the companion.
- **FSM** — `spawn → idle(60) → patrol(follow) → chase`; the mount state is
  `mounted` (Board A's contract), plus `carried` (Board A's carry contract) and
  `eaten`/`spit` reactions.
- **Damage** — contact 0 (a companion never hurts the player). Resistances:
  `stomp: take`, `projectile: take`. It has its **own health and death**, and it
  can be lost.
- **Pool** — `P1`, cap 4.
- **Spawn** — one per stage in the `branching_companion` rule set;
  `respawn_policy: never` (it persists across the stage).
- **Assets** — `quaternius-ultimate-animated-animals.zip → assets/glTF/Fox.gltf` (skinned, 12
  clips: `Attack, Death, Eating, Gallop, Gallop_Jump, Idle, …`). Clip map:
  `idle → Idle`, `patrol → Gallop`, `mounted → Gallop`, `eat → Eating`,
  `defeated → Death`.
- **Acceptance** — mount, damage, dismount and regain all work and the companion
  is never duplicated; the companion's own death is handled independently of the
  player's (`REQ-A-018`).

#### 5.7.2 `enemy.digger_beaver` — **Digger Beaver**
*Ref: `ambush_burrower` · family `SMW`*
- **Behaviour** — A creature that **hides underground** and surfaces **directly
  under the player** when it passes. It is invisible while burrowed (no collider,
  no damage) and erupts with a short telegraph. It is the archetype that teaches
  "the ground is not safe".
- **FSM** — `spawn → idle(burrowed) → jump(emerge, 30 ticks) → chase → retreat(dive)`.
  The emerge is the only vulnerable moment.
- **Damage** — contact 1 while surfaced. Resistances: `stomp: take` **in the
  `jump` (emerge) state only**; `stomp: zero` in every other state, so the only
  way to hurt it is to catch it as it surfaces. `projectile: take`.
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-beaver.glb` (6 meshes,
  node-transform, 8 clips). **Burrow has no clip** → tier 2: the actor's Y offset
  is driven below the floor by the controller, and the emerge is a scripted
  vertical transform over 30 ticks.
- **Acceptance** — the burrower is invisible and harmless while burrowed, erupts
  within one tick of the player passing its trigger, and can be stomped only
  during the emerge window.

#### 5.7.3 `enemy.ash_horn` — **Ash Horn**
*Ref: `multi_stomp_rex` · family `SMW`*
- **Behaviour** — A large beast that **requires three stomps** to bring down. The
  first two stomps stagger it (it roars, shakes off the hit, and resumes) and
  only the third kills it. It is the archetype that teaches "the big one takes
  more than one".
- **FSM** — `spawn → idle(60) → patrol → chase → attack`; `stomp → stunned(60,
  staggered) → chase`, with a `stomp_counter` that must reach 3 for `defeated`.
- **Damage** — contact 1. Resistances: `stomp: take` (but with a `stomp_counter`
  gate), `projectile: take`, `moving_shell: take`.
- **Pool** — `P1`, cap 4.
- **Spawn** — `spawn` trigger, aggro `TUNE 8.0 m`.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-elephant.glb` (6 meshes,
  node-transform, 8 clips), `uniform_scale: 1.25`. Clip map: `chase → run`,
  `stunned → gesture-negative`, `defeated → dance`.
- **Acceptance** — two stomps leave the beast alive and staggered; the third
  defeats it (`REQ-C-005` extended for multi-hit archetypes).

#### 5.7.4 `enemy.startled_cat` — **Startled Cat**
*Ref: `reactive_crawler` · family `SMW`*
- **Behaviour** — A crawler that **reacts to being looked at**: it freezes when
  the player faces it and bolts the instant the player looks away. It is the
  crawling cousin of the Mirror Wraith, but the reaction is on the *approaching*
  rather than the *retreating*.
- **FSM** — `spawn → idle(60) → patrol(freeze) → chase(bolt)`. The `chase` state
  is guarded by `player_facing_away`.
- **Damage** — contact 1. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger, aggro `TUNE 7.0 m`.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-cat.glb` (7 meshes,
  node-transform, 8 clips).
- **Acceptance** — the crawler is frozen exactly while the player faces it and
  moves exactly when the player looks away (`REQ-C-012`).

#### 5.7.5 `enemy.streak_tiger` — **Streak Tiger**
*Ref: `charging_athlete` · family `SMW`*
- **Behaviour** — A fast sprinter that charges in **straight lines**, turning
  only at walls and ledges. It accelerates over three steps and cannot be
  interrupted while committed. It is the archetype that teaches "the telegraph
  is the acceleration".
- **FSM** — `spawn → idle(60) → patrol → chase(charge, 3 stages: crouch 15,
  accelerate, sustain) → retreat(recover 30)`.
- **Damage** — contact 1. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger, aggro `TUNE 10.0 m`.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-tiger.glb` (6 meshes,
  node-transform, 8 clips). Clip map: `chase → run`, `idle → idle`.
- **Acceptance** — the charger turns only at obstacles and ledges, and its
  acceleration phase is visible before it commits (`REQ-C-005` obstacle turn).

#### 5.7.6 `enemy.rune_scribe` — **Rune Scribe**
*Ref: `tile_altering_mage` · family `SMW`*
- **Behaviour** — A caster that **changes the world's tiles**: it converts a
  block into a hazard, or a hazard into a solid, within a small radius, on a
  cooldown. It is the archetype that teaches "the enemy can rewrite the stage".
  Its alteration is announced by a coloured telegraph on the affected cell.
- **FSM** — `spawn → idle(60) → patrol → chase → attack(alter, 45: chant 25,
  alter, recover 20) → idle`; cooldown `TUNE 4.0 s`.
- **Damage** — contact 0. Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P1`, cap 6.
- **Spawn** — `spawn` trigger, aggro `TUNE 11.0 m`.
- **Assets** — `kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/Mage.glb`
  (skinned, 76 clips, `kaykit_41`); the staff is
  `kaykit-adventurers/.../Assets/gltf/staff.gltf` on the `hand_right` socket.
  Clip map: `idle → Idle`, `chase → Walking_A`, `attack → Spellcasting`,
  `defeated → Death_A`.
- **Acceptance** — the alteration changes the targeted cell's collision and art
  exactly once per cycle, the telegraph precedes it, and the alteration is
  reverted when the scribe dies (`REQ-C-008`).

#### 5.7.7 `enemy.sky_cargo` — **Sky Cargo**
*Ref: `giant_projectile` · family `SMW`*
- **Behaviour** — A **giant** projectile — a huge crate hurled along a flat arc
  that shatters into smaller crates on impact. Its size makes it slow and
  obvious; it is a rolling hazard with a long shadow.
- **FSM** — projectile FSM `spawn → move → hit → exhaust`, plus a `split` on
  impact that spawns three small crates with `P3` pool acquisitions.
- **Damage** — contact 2. Resistances: `stomp: immune`, `projectile: take`,
  `moving_shell: take`.
- **Pool** — a **pooled object**, not an actor: it counts against the pooled-object
  budget only (§4.7's accounting rule), per-type cap 24, and it does **not**
  occupy an `actor_budget` slot.
- **Spawn** — by `enemy.sky_warden` or a boss.
- **Assets** — `shorepine-kenney/3d/platformer/crate-strong.glb` (static). The
  fragments are `shorepine-kenney/3d/platformer/crate.glb`.
- **Acceptance** — the cargo deals 2 damage, shatters into exactly three
  fragments on impact, and each fragment is a separate pooled actor that
  despawns on rest.

#### 5.7.8 `enemy.pale_hover` — **Pale Hover**
*Ref: `ghost_flyer` · family `SMW`*
- **Behaviour** — A figure that **flies** and passes through terrain, ignoring
  gravity. It drifts toward the player at walking pace. It is the archetype that
  teaches "some enemies ignore the floor".
- **FSM** — `spawn → idle(60) → patrol(hover) → chase(drift)`. It never lands.
- **Damage** — contact 1. Resistances: `stomp: take` (a stomp catches it
  mid-air), `projectile: take`.
- **Pool** — `P2`, cap 24; `activation.sleep: always`.
- **Spawn** — `spawn_on_sight`; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/blocky-characters/character-r.glb` (node-
  transform, 27 clips). **Flight has no clip** → tier 2
  `transform: {type:"bob", amplitude_m:0.34, period_s:1.5}` + `root_motion:"sine_x"`,
  base clip `static`. **Behavioural difference, stated plainly: this is a solid
  hovering figure, not a translucent ghost.** *ASSET GAP `GAP-ENT-02` — the corpus
  contains no material permitting transparency without authoring one (ARCH §8.3
  forbids procedural textures); a translucent ghost silhouette is therefore a
  polish gap, and this archetype is blocked from shipping as a "ghost" until a
  permitted alpha asset exists.*
- **Acceptance** — the hover passes through a `solid` collider without being
  blocked and takes no gravity; the gap row is present in the asset-gap register.

#### 5.7.9 `enemy.dozer_koala` — **Dozer Koala**
*Ref: `sleeping_pursuer` · family `SMW`*
- **Behaviour** — A creature that **sleeps until the player comes close**, then
  charges. It is asleep (and harmless) until the aggro gate opens, which is what
  makes it a free hit if you approach carefully — but it wakes with a loud
  telegraph.
- **FSM** — `spawn → idle(asleep, 60) → patrol(sleeping) → attack(wake + charge,
  60: wake 20, charge, recover 40) → retreat`.
- **Damage** — contact 0 while asleep, 1 while awake. Resistances:
  `stomp: take` (a sleeping target is a free stomp), `projectile: take`.
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger, aggro `TUNE 5.0 m`.
- **Assets** — `shorepine-kenney/3d/cube-pets/animal-koala.glb` (5 meshes,
  node-transform, 8 clips). Clip map: `idle → sit` (the 8-clip cube-pets set has
  no `sit`; it uses `idle` with a `crouch`-style transform) → the sleeping pose is
  a tier-2 `transform: {type:"uniform_scale", scale:0.78}` shrinking the rig evenly.
- **Acceptance** — the koala deals no contact damage while asleep, wakes with a
  20-tick telegraph, and can be stomped while asleep.

#### 5.7.10 `enemy.spark_rod` — **Spark Rod**
*Ref: `lightning_shock` · family `SMW`*
- **Behaviour** — A ranged attacker that fires a **chain of lightning** along the
  lane at the player — a short, fast, telegraphed beam that is **jumpable** (it
  travels at a fixed height, so jumping over it is the counter). It is the
  archetype that teaches "the shape of the attack is the defence".
- **FSM** — `spawn → idle(60) → patrol → attack(zap, 45: charge 20, fire, recover
  25) → idle`; cooldown `TUNE 3.0 s`.
- **Damage** — contact 0; the beam deals 1. Resistances: `stomp: take`,
  `projectile: take`.
- **Pool** — `P1`, cap 8.
- **Spawn** — `spawn` trigger, aggro `TUNE 13.0 m`.
- **Assets** — body `shorepine-kenney/3d/factory/piston-thin-round.glb`
  (**animated**, 3 clips: `toggle-on`, `toggle-off`, `toggle`); the beam itself
  is a travelling projectile using `shorepine-kenney/3d/platformer/arrow.glb`
  with a `lane_height` constraint of `TUNE 1.1 m` — jumpable.
- **Acceptance** — the beam travels at a fixed height and can be jumped over; the
  cooldown is respected; the attack hitbox is declared and non-empty
  (`REQ-C-010`, `REQ-C-013`).

#### 5.7.11 `enemy.wick_cinder` — **Wick Cinder**
*Ref: `small_flame` · family `SMW`*
- **Behaviour** — A small flame that **rises** from a fixed point on a slow cycle
  and pops, damaging anything in its column. It is a small, cheap, frequent
  threat that punishes standing still.
- **FSM** — `spawn → idle(hidden, 90) → jump(rise, 60) → idle`.
- **Damage** — contact 1 while risen. Resistances: `stomp: immune`,
  `projectile: immune`.
- **Pool** — `P3`, cap 48; `activation.sleep: always`.
- **Spawn** — placed at a floor position; `respawn_policy: never`.
- **Assets** — `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/candle.gltf`
  (static). **The rise has no clip** → controller-driven Y offset over 60 ticks.
- **Acceptance** — the cinder damages only during its risen window and never
  damages while hidden (`REQ-C-013`).

#### 5.7.12 `enemy.pyre_breather` — **Pyre Breather**
*Ref: `fire_breather` · family `SMW`*
- **Behaviour** — A stationary enemy that **breathes a sustained cone of fire**
  along the lane. The cone is telegraphed by a 30-tick glow and a head turn, and
  it sweeps. It is the archetype that teaches "the attack is a space, not a
  point".
- **FSM** — `spawn → idle(60) → attack(breathe, 120: glow 30, burn 60, recover
  30) → idle`.
- **Damage** — contact 0; the cone deals 1 continuously while burning.
  Resistances: `stomp: take`, `projectile: take`.
- **Pool** — `P1`, cap 6.
- **Spawn** — placed at a wall or an edge; `respawn_policy: never`.
- **Assets** — body `shorepine-kenney/3d/platformer/character-oobi.glb`
  (skinned, 1 skin, 25 clips, `kenney_cast_6`); the flame is
  `kaykit-halloween/.../candle_melted.gltf` instanced along the cone as a
  `MultiMesh` (one draw call, ARCH §9.3).
- **Acceptance** — the cone has a declared, non-empty attack hitbox that sweeps
  with the head, and it is only live during the `burn` window (`REQ-C-013`).

#### 5.7.13 `enemy.gear_lobber` — **Gear Lobber**
*Ref: `throwable_mechanical_enemy` · family `SMW`*
- **Behaviour** — A **mechanical enemy that can be picked up and thrown**. It is
  inert until it is hit, at which point it becomes a `stunned` body that can be
  carried. Thrown at a boss, it damages it and credits the thrower; thrown at
  another enemy, it damages it too. It is the archetype that carries
  `REQ-C-014`'s "throw a stunned enemy at the boss" rule into the open world.
- **FSM** — `spawn → idle(60) → patrol → chase`; `damaged → stunned(120, carryable)
  → patrol`; `picked_up → thrown`; `thrown → stunned(90) → patrol` on impact.
- **Damage** — contact 1. Resistances: `stomp: take`, `projectile: take`,
  `moving_shell: take`, `thrown: take`. While **carried**, it has **no collider**
  and cannot damage anything (3D-TRANSLATION §2.10).
- **Pool** — `P2`, cap 24.
- **Spawn** — `spawn` trigger, aggro `TUNE 7.0 m`.
- **Assets** — `shorepine-kenney/3d/mini-arcade/character-gamer.glb` (skinned, 2
  skins, 32 clips, `kenney_cast_32`). Clip map: `stunned → sit`, `thrown → fall`,
  `idle → idle`.
- **Acceptance** — picking the enemy up grants pickup immunity and removes its
  collider; a thrown stunned enemy damages a boss and then recovers; the boss's
  damage is credited to the original thrower (`REQ-C-014`).

#### 5.7.14 `enemy.lure_husk` — **Lure Husk**
*Ref: `lure_ghost` · family `SMW`*
- **Behaviour** — A creature that **pretends to be harmless** — it lies still and
  looks inert until the player comes close, then it lunges. It is the archetype
  that teaches "not everything that is still is safe". It **lures** by being
  placed in tempting positions (near a pickup or a key).
- **FSM** — `spawn → idle(luring, indefinite) → attack(lunge, 45: rise 15, lunge,
  recover 30) → retreat(60) → idle`.
- **Damage** — contact 0 while luring, 1 while lunging. Resistances:
  `stomp: take`, `projectile: take`.
- **Pool** — `P2`, cap 24.
- **Spawn** — placed by the stage; `respawn_policy: never`.
- **Assets** — `shorepine-kenney/3d/graveyard/character-zombie.glb` (6 meshes,
  node-transform, 32 clips). **Behavioural difference, stated: it lures by
  shambling, not by floating** — the silhouette is upright, not spectral.
- **Acceptance** — the husk deals no damage while luring, has a 15-tick rise
  telegraph, and cannot be killed without first being triggered.

#### 5.7.15 `boss.cinder_wheel` — **Cinder Wheel**
*Ref: `wheel_platform_boss` · family `SMW`* · **class `boss`**
- **Behaviour** — A boss that rides a **rotating wheel platform** — the platform
  itself is the hazard, carrying the boss around a circular track through the
  arena, and rotating to sweep its arms. The player must read the rotation, not
  the boss's position.
- **FSM** — the boss FSM (§7.1); the attack loop is
  `attack(sweep) → attack(drop) → phase_transition`. In phase 2 the wheel
  reverses direction.
- **Damage** — contact 2 on the arms, 1 on the hub. Resistances: `stomp: take`
  (hub only, in a vulnerable window), `projectile: take` (hub only).
- **Pool** — `P0`, cap 1.
- **Spawn** — `boss_trigger`; `respawn_policy: never`.
- **Assets** — wheel arms `shorepine-kenney/3d/space/turret_double.glb` (static,
  2 meshes); hub `shorepine-kenney/3d/space/machine_generatorLarge.glb` (static);
  boss body `kaykit-adventurers/.../Characters/gltf/Knight.glb` (skinned, 76
  clips). **The wheel has no clip and cannot be rigged** → the rotation is a
  scripted transform on the named assets, parented to a rotating pivot node.
- **Acceptance** — the boss changes phase, its wheel reverses between phases, and
  it leaves the arena with no live entity behind (`REQ-C-016`).

---

## 6. `REQ-C-005 … REQ-C-014` — the archetype mechanics, and where each lives

The ten archetype requirements (`REQ-C-005 … REQ-C-014`) are implemented by the roster in §5. This
section is the index: which archetype carries which requirement, and the single
falsifiable check that closes it.

| Req | Requirement in one line | Implementing archetypes | Acceptance test (fails if untrue) |
|---|---|---|---|
| `REQ-C-005` | Walkers: edge turn, obstacle turn, speed variants, stomp-immunity flags | `enemy.pebble_grub`, `enemy.bulwark_beetle`, `enemy.slush_hog`, `enemy.slate_skater`, `enemy.cinder_wisp`, `enemy.thornroller`, `enemy.streak_tiger` | A walker placed at a ledge turns within 1 tick and does not fall; a walker placed against a 1-block step turns; a walker flagged `stomp_immune` survives a stomp with 0 HP loss; two walkers with different `speed_mps` cover different distances in 120 ticks. |
| `REQ-C-006` | Shell creature: retracts on stomp, kickable, chain-hits, re-emerges | `enemy.tumble_shell` | A kicked shell damages an enemy in its path and the player when struck from the front; a second stomp bounces the player; the shell re-emerges after `shell_timer_ticks` and resumes patrolling. **The retract is a uniform-scale (0.6) on the same named rig — there is no detached carapace mesh, because the corpus contains none (`G-01` option (a′)).** |
| `REQ-C-007` | Winged hopper: cyclical arcs, loss-of-wings state | `enemy.gustfeather` | The first compatible hit converts the flyer to its ground variant, the `winged` tag is cleared, and the silhouette capture of the two variants differs by more than the 35 % threshold. |
| `REQ-C-008` | Pipe plant: proximity-gated emergence + aggressive variant | `enemy.vine_maw`, `enemy.feral_stalk` | The normal variant does not emerge while the player is within `pipe_clear_radius` and emerges within one tick of the player leaving it; the aggressive variant emerges **while** the player is adjacent. |
| `REQ-C-009` | Spawner deploys subordinates with caps | `enemy.skywatcher` | The spawner never has more than `subordinate_cap` live subordinates and never spawns more than `spawn_total_cap` in a stage; despawned subordinates leave the active entity list. |
| `REQ-C-010` | Turret / cannon / hammer / boomerang / fire shooter: telegraph, arc, cooldown | `enemy.bolt_clerk`, `enemy.haul_maul`, `enemy.ember_archer`, `enemy.boulder_sergeant`, `enemy.spring_wrench`, `enemy.censer_thrower`, `enemy.card_volley`, `enemy.spark_rod`, `enemy.three_candle` | Each projectile follows its configured trajectory (straight, lobbed arc, high arc, spread, radial ring) and can be dodged by leaving that trajectory; the cooldown between shots is respected to the tick. |
| `REQ-C-011` | Aquatic: fish, squid, current-following swimmer, electrical obstacle | `enemy.sardine` (fish), `enemy.lantern_jelly` (squid homing), `enemy.slipstream_bear` (current-following swimmer) — the water-volume electrical obstacle is Board D's `REQ-D-012` and is **not** an actor archetype; `XN-ENT-14` records the hand-off | An underwater enemy's behaviour differs from the land equivalent under identical input; its collision mask rejects land-only queries; a fish never leaves its water volume's bounds. |
| `REQ-C-012` | Ghost AI reacts to facing, visibility, line of sight, proximity | `enemy.mirror_wraith` (facing), `enemy.startled_cat` (facing, the crawling variant) | Each ghost's movement toggles **exactly** on the player's facing transition — no intermediate speed, no hysteresis, one boolean edge. |
| `REQ-C-013` | Ceiling / drop hazard, rotating fire bar, falling weight, rolling boulder, chain tether, roaming flame | `enemy.thornback`, `enemy.thornmat`, `enemy.drip_vault`, `enemy.crush_piston`, `enemy.satellite_ward`, `enemy.chain_lion`, `enemy.cinder_wisp`, `enemy.arc_plate`, `enemy.tusk_ram`, `enemy.thornroller`, `enemy.wick_cinder` | Every one of the hazards has a **non-empty attack hitbox declared in the archetype data** and its hitbox is active **only** during its declared damaging state; the validator fails an archetype with `hitboxes: []` and an `attack` state. |
| `REQ-C-014` | Carryable enemy and throw-weapon: pickup immunity, stun time, projectile ownership | `enemy.gear_lobber`, `enemy.tumble_shell` (kick path), `enemy.reliquary_warden` | A thrown stunned enemy damages a boss and then recovers or despawns; the pickup grants pickup immunity (no contact damage while carried) and removes the collider; the boss's damage is credited to the **original thrower**, not to the body. |

---

## 7. `REQ-C-015 … REQ-C-020` — the boss framework

### 7.1 `REQ-C-015` — the boss framework

> **Requirement (`REQ-C-015`, P1).** Boss framework includes arena enter, intro,
> attack pattern, phase, vulnerability window, damage, stagger, defeat and reward.
> **AC:** Boss may be defeated only during enabled damage windows.

#### 7.1.1 The outer FSM

A boss is `kind: boss` in the archetype schema and runs an **outer** FSM over an
**inner** pattern FSM.

```
        ┌──────────┐   trigger       ┌────────┐  intro_ticks  ┌────────┐
        │ arena_   │────(enter)──────►│ intro  │──────────────►│ combat │
        │ enter    │                 └────────┘               └───┬────┘
        └──────────┘                                               │
                                   ┌───────────────┐   phase HP 0  │
                                   │ phase_        │◄──────────────┤
                                   │ transition    │               │
                                   └───────┬───────┘               │
                                           │ phase changed       │
                                           └──────────────► ┌─────┴─────┐
                                                          │  combat   │
                                                          └─────┬─────┘
                                                                │ HP ≤ stagger_threshold
                                                                │ and window open
                                                          ┌─────▼─────┐
                                                          │  stagger  │
                                                          └─────┬─────┘
                                                                │
                            ┌───────────┐   goal mechanism   ┌──▼────────┐
                            │ defeated  │◄───────────────────┤ (damage)  │
                            └─────┬─────┘   REQ-C-017        └───────────┘
                                  │ damage window depleted
                            ┌─────▼─────┐
                            │  reward   │  → emits goal_reward ONCE
                            └─────┬─────┘
                            ┌─────▼─────┐
                            │  despawn  │
                            └───────────┘
```

| Outer state | `timer_ticks` | What it does |
|---|---|---|
| `arena_enter` | 30 | The arena lock engages: the exits seal, the camera bounds tighten to the arena volume, the player cannot leave. The lock is a **volume**, not a flag (3D-TRANSLATION §1). |
| `intro` | 90–120 | The boss plays its entrance (a scripted transform on the named rig) and is **invulnerable**. Nothing may damage it; a projectile that hits it is absorbed with `damage_ignored`. |
| `combat` | `null` (event-driven) | Runs the inner pattern FSM. |
| `phase_transition` | 45 | Invulnerable. The boss repositions, the arena hazard set changes, the music/pitch cue changes, and the next phase's HP pool is loaded. |
| `stagger` | 60 | A free damage window: the boss is on its knees. Damage in this window counts. |
| `defeated` | 120 | The boss plays its death animation and stops colliding with the player. The reward fires at the **start** of this state, once. |
| `reward` | 1 tick (an event, not a wait) | Emits `goal_reward` with the boss's reward descriptor. Guarded by `reward_granted`. |
| `despawn` | `null` | Terminal. The boss returns to the pool and the arena lock releases. |

#### 7.1.2 The inner pattern FSM

Within `combat`, the boss runs:

```
pattern_select → telegraph → commit → recover → pattern_select
                       │                  │
                       └── window_open ───┘
```

- `telegraph` — the boss plays a wind-up. Every projectile attack **must** have a
  telegraph of at least 15 ticks (`TUNE 0.25 s`); area attacks at least 30 ticks.
- `commit` — the attack executes. Some patterns open a **damage window** here.
- `recover` — the boss is open. **The recover state is the standard damage
  window**; that is what makes every boss pattern fair without special-casing.

#### 7.1.3 The vulnerability window — the hard rule

> A boss takes damage **only** when `damage_window_open` is true.

The flag is set by the pattern's `open_window_during` list and cleared on every
phase change, stagger, intro, transition and defeat. When the flag is false, the
boss's matrix row is the `invulnerable` column, and every damage event against it
returns `outcome: ignore`.

**The acceptance test** for `REQ-C-015` is mechanical: a test harness fires a
projectile at the boss on **every tick of a full encounter** and asserts that
the boss's HP fell **only** on ticks where the flag was open, and that the total
damage taken equalled the sum of the phase pools plus the phase-transition
carry-over, exactly.

#### 7.1.4 Phases

Each phase is a data row:

```
phases[] = {
  "id": "p2",
  "hp": 6,
  "patterns": ["volley", "sweep"],
  "parameters": { "volley.count": 3, "sweep.arc_deg": 40 },
  "on_enter": { "arena_hazards": ["crush_piston"], "speed_scale": 1.15 },
  "stagger_threshold": 2
}
```

- A phase change happens when the phase's HP reaches 0.
- **Damage carries over** at 1 HP into the next phase (so the fight does not
  reset), and the carry-over is capped at 1 HP.
- The phase index is saved (§7.5, `REQ-C-019`).
- Phases are **parameter sets**, never behaviour switches: a phase changes
  numbers and the pattern list, never the code path.

#### 7.1.5 Stagger

When the phase HP falls to or below `stagger_threshold` **while the damage window
is open**, the boss enters `stagger` for 60 ticks and the phase HP does not fall
below 1 until the stagger ends. Stagger is the fight's punctuation: it gives the
player a beat, and it is the moment the telegraph for the next pattern is
suppressed so the player is not hit while reading.

### 7.2 `REQ-C-016` — the seven boss patterns

> **Requirement (`REQ-C-016`, P1).** Boss patterns include projectile-spitter,
> bomb thrower, split-on-hit, multi-head flame, rock-lobber, hopping fortress
> guard and mobile-airship boss. **AC:** Each test boss changes phase and exits
> arena safely.

| # | Pattern | Boss archetype | Primary body asset | Core loop |
|---|---|---|---|---|
| 1 | **projectile-spitter** | `boss.spitcantor` | `kaykit-skeletons/.../Skeleton_Mage.glb` | Aims, spits a lobbed shot, recovers. Phase 2 adds a second mouth and a faster cadence. |
| 2 | **bomb thrower** | `boss.ballast_breaker` | `kaykit-adventurers/.../Barbarian.glb` | Lobs bombs on an arc; each bomb detonates into a short-range blast. Phase 2 double-bombs. |
| 3 | **split-on-hit** | `boss.fission_choir` | `kaykit-skeletons/.../Skeleton_Rogue.glb` | A single body that splits into two smaller bodies on a fatal blow; each half must also be defeated. Phase 2 splits into three. |
| 4 | **multi-head flame** | `boss.candelabra_tyrant` | `kaykit-adventurers/.../Knight.glb` + 3 × `candle.gltf` heads | Three heads breathe independent flame cones on staggered cooldowns; destroying a head removes its cone. |
| 5 | **rock-lobber** | `boss.boulder_marshal` | `quaternius-ultimate-animated-character.zip → assets/glTF/Goblin_Male.gltf` | Lobs heavy rocks in a three-shot spread; the rocks leave rubble that becomes a temporary hazard. |
| 6 | **hopping fortress guard** | `boss.bastion_hopper` | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/red/building_tower_catapult_red.gltf` + `shorepine-kenney/3d/space/turret_single.glb` | Hops between two stances, firing a catapult volley when grounded. |
| 7 | **mobile-airship boss** | `boss.skybreaker` | Kenney `space` rocket modules + `quaternius-animated-mech/.../Leela.gltf` pilot | Crosses the arena, drops bombs, rakes with a beam. Only the pilot is vulnerable. |

#### 7.2.1 `boss.spitcantor` — **Spitcantor**
*Ref: `projectile_spitter_boss` · REQ-C-016 pattern 1*
- **Behaviour** — A skeletal cantor that spits a heavy lobbed shot. The shot is
  slow enough to outrun. Phase 2 adds a second spit that brackets the player.
- **FSM** — outer boss FSM; inner `aim(25) → spit(10) → recover(30)`.
- **Damage** — the shot deals 1 and is an `environment`-typed event. Resistances:
  `stomp: take` (only in a window), `projectile: take`, `moving_shell: take`.
- **Pool** — `P0`, cap 1.
- **Spawn** — `boss_trigger`; `respawn_policy: never`.
- **Assets** — body `kaykit-skeletons/addons/kaykit_character_pack_skeletons/Characters/gltf/Skeleton_Mage.glb`
  (skinned, 95 clips); the shot is `shorepine-kenney/3d/platformer/jewel.glb` (static). Clip map:
  `attack → Spellcast_Shoot`, `telegraph → Spellcast_Raise`,
  `recover → Idle_Combat`, `defeated → Death_C_Skeletons`.
- **Acceptance** — the boss changes phase and leaves the arena with no live entity
  behind; the shot follows the configured arc and can be outrun.

#### 7.2.2 `boss.ballast_breaker` — **Ballast Breaker**
*Ref: `bomb_thrower_boss` · REQ-C-016 pattern 2*
- **Behaviour** — A hooded bomber that lobs bombs on an arc. Each bomb detonates
  on impact into a blast with a radius; the bombs can be **shot down** mid-air.
  Phase 2 throws two bombs on a split arc.
- **FSM** — inner `wind(20) → throw(10) → recover(25)`.
- **Damage** — blast 1 (`environment`-typed, radius `TUNE 1.4 m`). Resistances:
  `stomp: take` (window only), `projectile: take`.
- **Pool** — `P0`, cap 1.
- **Spawn** — `boss_trigger`; `respawn_policy: never`.
- **Assets** — body `kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/Barbarian.glb`
  (skinned, 76 clips); the bombs are
  `kaykit-adventurers/.../Assets/gltf/smokebomb.gltf` (static). Clip map:
  `telegraph → Throw`, `attack → Throw`, `recover → Idle`, `defeated → Death_A`.
- **Acceptance** — bombs follow the configured arc, can be shot down before impact,
  and the boss changes phase and exits the arena safely.

#### 7.2.3 `boss.fission_choir` — **Fission Choir**
*Ref: `split_on_hit_boss` · REQ-C-016 pattern 3*
- **Behaviour** — A roguish body that **splits** on a fatal blow into two
  independent smaller bodies, each with its own HP and its own attacks. The fight
  becomes a two-stage fight; the halves are credited to the killer of the parent.
  Phase 2 splits into three.
- **FSM** — outer boss FSM; on the fatal damage event the boss transitions to
  `defeated` **and** spawns `boss.fission_shard` instances (a `boss.fission_choir`
  archetype with `scale_variant: shard`).
- **Damage** — the parent takes 1 per hit; the shards take 1 per hit.
  Resistances: `stomp: take` (window only), `projectile: take`.
- **Pool** — `P0`, cap 1 for the parent; the shards are `P1`, cap 4.
- **Spawn** — `boss_trigger`; `respawn_policy: never`.
- **Assets** — parent `kaykit-skeletons/.../Characters/gltf/Skeleton_Rogue.glb`
  (skinned, 95 clips); shards `kaykit-skeletons/.../Characters/gltf/Skeleton_Minion.glb`
  (skinned, 95 clips) — **two distinct rigs, so the halves are visibly different
  creatures, not scaled copies**. Clip map: `telegraph → Taunt`,
  `attack → 1H_Melee_Attack_Chop`, `defeated → Death_C_Skeletons`.
- **Acceptance** — a fatal blow spawns exactly the phase's shard count, each shard
  is independently defeatable, the credited attacker of a shard is the killer of
  the parent, and no shard is left live when the arena is exited.

#### 7.2.4 `boss.candelabra_tyrant` — **Candelabra Tyrant**
*Ref: `multi_head_flame_boss` · REQ-C-016 pattern 4*
- **Behaviour** — A knight carrying three candle heads, each of which breathes an
  independent flame cone on a staggered cooldown. Destroying a head removes its
  cone permanently. The three cones sweep the arena between them.
- **FSM** — outer boss FSM; inner `flame(120: glow 30, burn 60, recover 30)`, with
  three cooldowns offset by `TUNE 0.9 s`.
- **Damage** — the cone deals 1 continuously while burning. Resistances:
  `stomp: take` (window only), `projectile: take` — a head is a separate hitbox
  with its own HP.
- **Pool** — `P0`, cap 1.
- **Spawn** — `boss_trigger`; `respawn_policy: never`.
- **Assets** — body `kaykit-adventurers/.../Characters/gltf/Knight.glb` (skinned,
  76 clips); heads `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/candle.gltf`
  × 3, attached to the rig's `head` socket at three offsets; the flame is
  `candle_melted.gltf` instanced along the cone.
- **Acceptance** — removing one head removes exactly that head's cone and leaves
  the other two firing; the boss changes phase and exits the arena safely.

#### 7.2.5 `boss.boulder_marshal` — **Boulder Marshal**
*Ref: `rock_lobber_boss` · REQ-C-016 pattern 5*
- **Behaviour** — A goblin marshal that lobs heavy rocks in a three-shot spread.
  The rocks leave **rubble** that becomes a temporary hazard for `TUNE 8.0 s`, so
  the arena degrades as the fight goes on. Phase 2 adds a second volley.
- **FSM** — inner `wind(20) → volley(30) → recover(30)`.
- **Damage** — the rock deals 2 on impact. Resistances: `stomp: take` (window
  only), `projectile: take`.
- **Pool** — `P0`, cap 1; the rubble is `P3`, cap 16.
- **Spawn** — `boss_trigger`; `respawn_policy: never`.
- **Assets** — body `quaternius-ultimate-animated-character.zip → assets/glTF/Goblin_Male.gltf`
  (skinned, 17 clips); the rocks are `shorepine-kenney/3d/platformer/rocks.glb`;
  the rubble is `kenney.platformer.stones`. Clip map: `telegraph → Punch`,
  `attack → Run_Carry`, `recover → Idle`, `defeated → Defeat`.
- **Acceptance** — the volley fires exactly three rocks; each leaves rubble that
  expires after the configured time; the boss changes phase and exits the arena
  safely.

### 7.3 `REQ-C-017` — defeating a boss without damage

> **Requirement (`REQ-C-017`, P1).** Bridge-collapse or switch-triggered boss
> elimination is supported as alternative to direct damage. **AC:** Goal mechanism
> removes boss and advances stage.

#### 7.3.1 The mechanism

A boss may declare a `goal_mechanism` in its archetype:

```
goal_mechanism = {
  "mode": "bridge_collapse" | "switch_trigger",
  "target_ids": ["bridge_span_a", "bridge_span_b"],   // stage trigger ids
  "requires": ["carry_throw"],                        // a ruleset feature gate
  "on_activate": "defeat_boss",
  "failure": "boss_resumes"                            // what happens if the player never triggers it
}
```

- **`bridge_collapse`** — the boss stands on a bridge. The bridge has **two
  support posts**, each bound to a stage trigger. Destroying or dropping a heavy
  object on both posts collapses the span; the boss falls with it and is defeated
  with **no damage applied**.
- **`switch_trigger`** — a `kenney.platformer.lever` or `button-square` in the
  arena triggers the mechanism when it is struck by the player or by a thrown
  object.

#### 7.3.2 The event

On activation the mechanism emits:

```
boss_defeated {
  boss_id, attacker_chain: [player_id], damage_applied: false,
  reason: "goal_mechanism", mechanism: "bridge_collapse" | "switch_trigger"
}
```

The boss enters `defeated` with the `Death` animation, the arena lock releases,
and the reward fires **exactly as it would for a damage defeat** — the reward is
keyed on the boss being defeated, not on how.

#### 7.3.3 The rules

- The mechanism is **optional**. The boss is always also defeatable by damage.
- The mechanism is **not available in every rule set**: `requires: ["carry_throw"]`
  means the mechanism's stage variant is only loaded in a rule set where
  `rules.enabled("carry_throw")` is true. This is a **feature gate**, not a
  hard-coded rule-set name (ARCH §4.3).
- If the player does the damage route first, the mechanism's triggers are
  deactivated and cannot fire a second defeat.

#### 7.3.4 Acceptance test

> **Check:** the fixture arena has a boss with `goal_mechanism.mode =
> bridge_collapse`. The test destroys both support posts **without damaging the
> boss** and asserts (a) the boss is in `defeated`, (b) the boss's phase HP is
> **unchanged** — the damage applied is exactly 0, (c) the stage advances and the
> exit is unlocked, (d) the reward was granted **once**. A second run damages the
> boss to death and asserts the reward is still granted once.
> **Fails if:** the boss is defeated with any damage applied, or the reward is
> granted twice.

### 7.4 `REQ-C-018` — reflection and catch/return cycles

> **Requirement (`REQ-C-018`, P1).** Boss projectile reflection or catch/return
> cycles are independently configurable. **AC:** Reflected object credits correct
> attacker and damages boss.

#### 7.4.1 Two mechanisms, independently configurable

| Mechanism | How it is enabled | Attacker credit |
|---|---|---|
| **Reflection** | The projectile archetype declares `reflectable: true` and the **reflector** archetype declares `reflects: true`. A `reflectable` projectile that hits a `reflects` actor reverses its velocity along `−contact_normal` and its `attacker_chain` becomes `[reflector_id] + the original chain` — the reflector is **inserted at the front**. | The credited attacker is `attacker_chain[0]`, so the **reflector** is credited; the original shooter stays in the chain for analytics. This is 3D-TRANSLATION §3's rule — the credit is the *original attacker*, carried through the chain. |
| **Catch / return** | The projectile declares `catchable: true`. A `catchable` projectile that overlaps the player is **caught** if the player's `catch_enabled` rule-set feature is on; the player becomes the projectile's owner and may **fire it back** with the action key. The catcher's id is **inserted at the front** of the chain. | The credited attacker is `attacker_chain[0]`, so the **catcher** is credited, with the original chain preserved behind them. |

The two are **independent flags**: a projectile may be `reflectable` but not
`catchable`, `catchable` but not `reflectable`, both, or neither. They are
configured per archetype, so a stage chooses the interaction by data, not by code.

#### 7.4.2 The catch/return cycle

```
  spawn ──► move ──► [player presses catch] ──► caught ──► [player fires] ──► returned ──► hit ──► exhaust
              │                                                                                   │
              └──► hit ──► exhaust (missed)                                        owner damaged ─┘
```

- A caught projectile stops, attaches to the player's `catch_socket`, and its
  collider is disabled while held.
- Firing it applies `throw_impulse` along the player's facing axis and sets
  `attacker_chain = [player_id] + original_chain`.
- The returned projectile's damage type stays `projectile`; the **target** is
  whatever it hits, and the **credit** is the chain's first entry — the player, who
  re-rooted the chain by catching it.
- A projectile that hits its own owner is credited to the original shooter, and
  the owner takes the damage (a boomerang that returns home).

#### 7.4.3 Acceptance test

> **Check:** a fixture boss fires a `reflectable` projectile at a
> `reflects` wall actor. The test asserts (a) the projectile's velocity is
> reversed along `−contact_normal`, (b) its `attacker_chain` is
> `[reflector, original_shooter]`, (c) when it subsequently hits the boss, the
> boss's damage record names the **reflector** as `source_id` — the credited
> attacker — and the original shooter appears behind it in the chain. A second case has the player catch a
> `catchable` projectile and return it; the test asserts the boss's damage
> record names the **player** as the credited attacker.
> **Fails if:** the credit is lost at the reflection, or the catch, or if the
> projectile's `reflectable` and `catchable` flags are not independent (changing
> one changes the other's behaviour in the fixture).

### 7.5 `REQ-C-019` — boss retry, checkpoints and no duplicate reward

> **Requirement (`REQ-C-019`, P1).** Boss encounter restart, stage checkpoint and
> post-clear persistence handle death/retry. **AC:** Boss returns to correct phase
> after retry, no duplicate reward.

#### 7.5.1 What is captured

At the boss trigger, the checkpoint captures (`REQ-B-005`):

| Captured | Where it lives | Restored on retry |
|---|---|---|
| `boss_phase_index` | the stage's checkpoint record | The boss resumes at this phase. |
| `boss_phase_hp` | the checkpoint record | The phase's HP is restored to this value. |
| `boss_defeated` | `world_graph.completed_exits` as `<node_id>:<exit_id>` | A defeated boss does **not** respawn. |
| `reward_granted` | the same completed-exit entry | The reward is not granted again. |
| `arena_locked` | not captured | Always `false` on load — the arena is re-armed. |
| `subordinate_state` | not captured | Boss subordinates are respawned by their own `respawn_policy`. |

#### 7.5.2 The retry rule

On death and respawn at the checkpoint:

- The boss is **re-armed**: `arena_enter → intro → combat`, restored to
  `boss_phase_index` and `boss_phase_hp`.
- Every boss projectile, subordinate and spawned hazard is despawned — the
  `REQ-E-016` clean-reload rule applies to the boss encounter too.
- The arena lock is released on death and re-engaged on the boss trigger.
- **`reward_granted` is never re-armed.** If the boss was already defeated in a
  previous life of this stage, the trigger does not fire the encounter again.

#### 7.5.3 Acceptance test

> **Check:** the fixture boss has three phases. The test damages it into phase 2,
  dies, respawns at the checkpoint, and asserts (a) the boss re-enters `combat` at
  **phase index 1** (the second phase), (b) its phase HP equals the captured value,
  not the full pool, (c) no boss projectile survived the reload. A second test
  defeats the boss, records the reward, then dies and retries the stage, and
  asserts the reward counter is **unchanged** — the reward was granted exactly
  once across all retries.
> **Fails if:** the boss restarts at phase 0, or the reward counter increments
> twice.

### 7.6 `REQ-C-020` — enemy analytics and the QA aggregation

> **Requirement (`REQ-C-020`, P2).** Enemy analytics capture hit reason,
> archetype, location, time and repeated player deaths. **AC:** QA report
> aggregates death locations per build.

#### 7.6.1 The death record

Every player death writes one row. The record is **local** by default and is
subject to the telemetry opt-in (`REQ-E-014`, ARCH §4.3 `telemetry`); the local
debug overlay always shows the last row.

```
DeathRecord {
  build_id              : string     // from the save schema
  slot_id               : string
  stage_id              : string
  ruleset_id            : string
  profile_id            : string
  archetype_id          : string     // the actor that killed the player
  archetype_name        : string     // the shipped name, for the QA report
  damage_type           : string     // the typed cause: contact, stomp, projectile, …
  hit_reason            : string     // the human-readable cause, e.g. "shell from behind"
  hit_x, hit_y, hit_z   : number     // the world position of the killing contact
  death_x, death_y, death_z : number // the player's position at death
  stage_elapsed_ticks   : uint64
  wall_clock_utc        : string
  attempt_number        : int        // the attempt within this stage since the checkpoint
  stage_death_index     : int        // the ordinal death within this stage
  recent_deaths[]       : string[]   // the last 8 archetype ids that killed the player
  repeated_death        : bool       // stage_death_index >= 3 at the same location bucket
  location_bucket       : string     // "<stage_id>:<floor(x/4)>:<floor(y/4)>:<lane>" 
}
```

**`hit_reason`** is a closed vocabulary, derived from the damage event and the
actor's state, so it is machine-aggregatable:

`contact_side` · `contact_front` · `contact_behind` · `contact_above` ·
`stomp_failed` · `shell_front` · `shell_behind` · `projectile` · `explosion` ·
`crush` · `spikes` · `lava` · `saw` · `fall` · `electric` · `wind_push` ·
`quicksand` · `ceiling` · `encumbered` (crushed by a carried object) ·
`boss_pattern:<id>`

The `boss_pattern:<id>` form is how a boss kill is attributed to a specific
pattern rather than to the boss as a whole — this is the field that makes a boss
fight tunable.

**`location_bucket`** quantises the death position to a 4 m grid so that repeated
deaths at the same spot aggregate. The bucket is derived from the death
position, not the stage authoring, so it works for every stage without authoring.

#### 7.6.2 The QA aggregation

The report is produced by `src/tools/death_report.py` from the local death log.

| Report section | Contents | Sorted by |
|---|---|---|
| **Top killers** | archetype id and shipped name, count, share of deaths | count descending |
| **Kill reasons** | `hit_reason`, count | count descending |
| **Death hotspots** | `location_bucket`, count, the archetype that killed there, a thumbnail hint (`stage_id`, `x`, `y`) | count descending |
| **Repeat deaths** | buckets with `repeated_death = true`, with the archetype sequence | count descending |
| **Per-stage** | deaths per stage, and the average attempt index | stage id |
| **Boss pattern attribution** | deaths per `boss_pattern:<id>` | count descending |

The report is a **build artefact**, written to `dist/DEATH-REPORT.md` and
`dist/DEATH-REPORT.json` by the CI runner. It contains no personal data: the
records carry a slot id and a build id and nothing else; the opt-in flag
(`REQ-E-014`) governs whether any of it leaves the machine.

#### 7.6.3 Acceptance test

> **Check:** the fixture stage contains a `enemy.thornback` at a known position
  and a `enemy.cinder_shell` fired from a known muzzle. The test kills the player
> three times on the thornback and once with the shell, then asserts (a) the QA
> report contains **four** death rows for that stage, (b) the `Death hotspots`
  section names the bucket the thornback occupies, (c) the `Kill reasons` section
  counts three `contact_above` rows (the thornback is a floor threat) and one
  `projectile` row, (d) the `Repeat deaths` section lists the thornback's bucket
  with `repeated_death = true`, and (e) the rows carry archetype, location and
> time.
> **Fails if:** any row is missing a field, or the aggregation does not match the
> fixture's expectations.

---

## 8. The entity half of Board D — `REQ-D-002`, `REQ-D-003`, `REQ-D-010`, `REQ-D-014`

These four requirements are owned by **this board** (ARCH §10.3) even though they
concern objects and presentation. Board D owns the visuals, the mixer and the HUD;
this board owns the **state machine, the payload accounting and the reward
accounting** that sit behind them.

### 8.1 `REQ-D-002` — block payload states

> **Requirement (`REQ-D-002`, P0).** Blocks store state idle/hit/empty, item or
> coin payload, damage permissions and bounce animation. **AC:** Each hit produces
> exactly one configured reward event.

#### 8.1.1 The block state machine

The block schema is ARCH §5.5. The entity contribution is the **state machine and
the exactly-once guard**.

```
        ┌────────┐   hit (permitted)   ┌──────┐   payload_spawned   ┌────────┐
        │  idle  │────────────────────►│ hit  │───────────────────►│ empty  │
        └────────┘                     └──────┘                    └────────┘
             │                               │
             │ bounce                        │ timer_expired (payload consumed)
             ▼                               ▼
        (player bounced)                  ┌────────┐
                                        │  idle  │
                                        └────────┘
```

| State | Meaning | `timer_ticks` | Collidable |
|---|---|---|---|
| `idle` | Untouched. The payload is armed. | `null` | Yes |
| `hit` | The hit animation is playing. The payload has been **claimed**. | 8–16 (`TUNE 0.2 s`) | Yes |
| `empty` | The payload is gone. The block is spent (if breakable) or inert (if bumpable). | `null` | Depends on `damage_permissions` |

**The exactly-once guard.** A block carries a `payload_claimed` boolean. The
transition `idle → hit` is the **only** transition that may spawn a payload, and
it may do so **only** if `payload_claimed == false`; the transition sets it to
`true` in the same tick. A second hit while in `hit` or `empty` plays the
bump/impact effect and **spawns nothing**. This is the whole of the
`REQ-D-002` acceptance clause, and it is enforced in one place — the block's
`hit` transition handler — so no caller can bypass it.

#### 8.1.2 The payload

```
payload = {
  "kind": "item" | "coin" | "none",
  "item_id": "item.mushroom_growth",     // for kind=item
  "coin_value": 1,                        // for kind=coin
  "amount": 1,
  "spawn_offset": [0, 1, 0],
  "respawn_policy": "never" | "timer" | "always",
  "respawn_ticks": 0
}
```

- `kind: coin` increments the currency counter and plays the coin cue.
- `kind: item` spawns the item entity (§8.2), which rises from the block over
  `physics.spawn.rise_mps` and cannot spawn inside solid geometry (ARCH §5.4;
  the spawn volume is asserted free before the item is created).
- `kind: none` is a pure bump block: it moves and it plays a sound, it yields
  nothing. It exists so a level can have a readable bump without a reward.

#### 8.1.3 Damage permissions and the enemy interaction

`damage_permissions.destructible_by` names the damage types that break a block.
An enemy can therefore **break blocks**: `enemy.tusk_ram`'s ground shock is an
`environment`-typed event with a `breakable` flag, and `enemy.ember_pair`'s
halves deal `stomp`/`projectile` damage that a `destructible_by: ["stomp"]` block
accepts.

**Bounce.** A block may declare `bounce: {impulse_mps: 6.0, player_only: true}`.
The bounce is a **reaction to the player**, not a damage event: the player is
given a vertical impulse and the block plays its bump transform. `player_only:
true` means enemies hitting the same block get the impact effect but no impulse.

#### 8.1.4 The bounce animation

The Kenney crates are **static** (measured: 0 clips). The bump is therefore a
**scripted transform on the named asset** — the crate node is offset along +Y by
`TUNE 0.12 m` over 4 ticks and returned over 4 — which is a permitted runtime
transform of an existing asset (ARCH §2.2), not an authored clip. The
`kenney.platformer.spring.glb` is also static; its compression is a scripted
transform plus the launch impulse (§8.3).

#### 8.1.5 Acceptance test

> **Check:** a fixture stage places a `block.brick_payload` with
> `payload.kind = coin`. The test hits it 5 times in 60 ticks and asserts (a)
> exactly **one** `pickup_collected` event with `kind = currency` was emitted,
> (b) the currency counter incremented by exactly 1, (c) the block's state
> sequence was `idle → hit → empty`, and (d) the block's `payload_claimed` flag
> is `true` afterwards. A second case hits a block with `kind = none` and asserts
> zero pickup events.
> **Fails if:** any hit beyond the first produces a reward event, or the counter
> diverges from the event count.

### 8.2 `REQ-D-003` — the collectable and score system

> **Requirement (`REQ-D-003`, P0).** Collectable and score system includes
> currency, extra life, temporary boost, restorative health and score token.
> **AC:** Collection increments correct counters exactly once.

#### 8.2.1 Seven collectable kinds, nine shipped variants

The item schema is ARCH §5.4 with `kind ∈ {power_up, negative, currency,
extra_life, boost, restorative, score_token}`. The entity board's contribution
is the **collection handler** and the **exactly-once guard**.

| `kind` | Shipped name | Effect on collection | Counter touched | Asset |
|---|---|---|---|---|
| `currency` | **Tally Coin** (bronze) | `player.coins += coin_value`; score `+coin_value × score_table.coins` | coins | `kenney.platformer.coin-bronze.glb` |
| `currency` | **Bright Coin** (silver) | as above, `coin_value = 5` | coins | `kenney.platformer.coin-silver.glb` |
| `currency` | **Crown Coin** (gold) | as above, `coin_value = 20` | coins | `kenney.platformer.coin-gold.glb` |
| `extra_life` | **Life Charm** | `player.lives += 1`; plays the life cue, not the coin cue | lives | `kenney.platformer.heart.glb` |
| `boost` | **Starfall** | `player.power_state = invincible` for `TUNE 9.0 s`; a countdown is displayed | none | `kenney.platformer.star.glb` |
| `restorative` | **Bloom Berry** | `player.health = min(max, health + 1)` — only meaningful in a rule set with a health meter | health | `kenney.platformer.mushrooms.glb` |
| `score_token` | **Gem Shard** | `player.score += 500`; no counter other than score | score | `kenney.platformer.jewel.glb` |
| `negative` | **Cinder Thorn** | **no positive counter** — invokes the damage path (§5.4.1) | none | `kenney.platformer.spike-block.glb` |
| `power_up` | **Spore Cap** | `player.power_state = growth` (Board A's power-up FSM) | none | `kenney.platformer.mushrooms.glb` |

**`restorative` and `power_up` deliberately share the `mushrooms` mesh** but are
distinguished by their item id, their effect and their icon; the design records
that they are **visually identical** and that a stage that uses both must place
them in separate rooms. *ASSET GAP `GAP-ENT-03` — the corpus has one food-shaped
plant mesh and no distinct growth/curative pair; a differentiated pair is a
polish gap, not a blocker.* The growth and curative are never shown in the same
room in the shipped content.

#### 8.2.2 The collection handler

```
on_overlap(collector, item):
    if item.collected: return                  // the exactly-once guard
    item.collected = true                      // set in the same tick
    item.despawn(policy = pool)
    apply(item.effect)                         // increments exactly one counter
    emit pickup_collected {collector_id, item_id, kind, value}
    emit score_awarded {delta, score_table_ref}
```

The guard is `item.collected`, set before the effect is applied, so a second
overlap in the same tick — or in any later tick — cannot double-count. The
`pickup_collected` event is emitted **after** the effect is applied, so the HUD
and the audio read the already-updated state.

#### 8.2.3 The score table

Score is not hard-coded in the item. Each item's `effect` names a
`score_table_ref`; the score table lives under `src/content/scoring/` and is a data
file per region (ARCH §5.2 `goal_reward.score_table_ref`). A score award is
therefore a **lookup**, and the same item is worth different points in a
challenge rule set.

#### 8.2.4 Acceptance test

> **Check:** a fixture places one of each collectable kind. The test collects
> each **twice** (the second collection by forcing the overlap) and asserts (a)
> exactly **one** `pickup_collected` event per item, (b) the coins counter
> incremented by the sum of the three coin values and not more, (c) the lives
> counter incremented by exactly 1, (d) the negative item produced a **damage
> event** and **zero** pickup events, and (e) the score counter matches the score
> table.
> **Fails if:** any counter is incremented twice, or the negative item increments
> any positive counter.

### 8.3 `REQ-D-010` — bounce pads, springs and launch impulses

> **Requirement (`REQ-D-010`, P1).** Springboard, bounce pad, trampoline and note
> block offer configurable launch impulse. **AC:** Standing/jumping interaction
> produces expected bounce.

#### 8.3.1 The launch descriptor

Every launching surface declares a `bounce` block (ARCH §5.5) and this board
defines its semantics:

```
bounce = {
  "impulse_mps": 12.0,          // the vertical impulse given to the player
  "standing": { "impulse_mps": 9.0,  "cooldown_ticks": 30 },
  "jumping":  { "impulse_mps": 14.0, "cooldown_ticks": 30 },
  "min_contact_speed": 0.0,     // the contact must be at least this fast
  "max_contact_speed": 40.0,    // above this, the launch is not applied (anti-tunnelling)
  "player_only": true,
  "hold_to_higher": true,       // holding the action adds up to +30 % impulse
  "cooldown_ticks": 30
}
```

The two cases in the acceptance clause are distinguished by the **player's
vertical velocity at the contact tick**: `standing` means the player is
**grounded on the pad** or is arriving with a speed below
`landing_speed_epsilon` (`TUNE 1.0 m/s`); `jumping` means the player was moving
**downward** faster than `landing_speed_epsilon` when it hit. The two impulses
are therefore separate numbers, not one number with a modifier. A player who
drops onto a pad from a height gets the **jumping** impulse, not the standing
one — which is the whole point of having two numbers.

#### 8.3.2 The launch pipeline

1. The contact resolver finds the launch surface and the contact normal.
2. The pipeline checks `min_contact_speed ≤ |vy| ≤ max_contact_speed`. Outside
   that band, no launch occurs — this is what stops a pad from being a rocket
   when the player falls fast through it, and what stops a fast fall from being
   silently swallowed.
3. The surface's `cooldown_ticks` gate is checked. A pad that has just fired
   cannot fire again for `TUNE 0.5 s`.
4. The impulse is applied along `+Y`, scaled by `hold_to_higher` if the action is
   held, and the player enters the `jump` state with the launch's terminal
   velocity — **not** the ordinary jump (3D-TRANSLATION §2.3, which governs the
   *jump* input, not a launch impulse).
5. The surface plays its compression transform.

#### 8.3.3 The surfaces

| Surface | Shipped name | Standing | Jumping | Asset |
|---|---|---|---|---|
| Springboard | **Coil Pad** | 9.0 | 14.0 | `kenney.platformer.spring.glb` (static; the compression is a scripted transform) |
| Bounce pad | **Tension Tile** | 7.0 | 11.0 | `kenney.platformer.platform.glb` (static) |
| Trampoline | **Vault Drum** | 12.0 | 12.0 (no difference) | `kenney.platformer.platform-fortified.glb` (static) |
| Note block | **Tone Block** | 10.0 | 10.0 | `kenney.mini-dungeon.chest.glb` (**animated**: `open`, `close`, `open-close`) — the lid opens on the bounce |
| — | — | — | — | **Rule:** two surfaces with different launch parameters are **two block archetypes**, never one archetype with a flag. `Coil Pad` and `Vault Drum` are therefore separate entries with separate assets. |

**Note-block variant.** A tone block may also **launch the player upward into a
ceiling**, in which case the launch is a "note" event: the block plays `open`,
the player is launched, and the block enters `hit` state for 16 ticks. A note
block with `payload.kind = none` is a pure note; with `payload.kind = item` it
is a block that happens to make a sound.

#### 8.3.4 Acceptance test

> **Check:** the fixture places a springboard. The test drops the player onto it
> (standing case) and asserts the resulting vertical velocity equals
> `standing.impulse_mps` within `TUNE 0.05 m/s`; it then drops the player onto it
> with a larger downward speed and asserts the velocity equals
> `jumping.impulse_mps`. It asserts the cooldown: a second contact within
> `cooldown_ticks` produces **no** launch.
> **Fails if:** the standing and jumping cases produce the same impulse, or the
> cooldown does not suppress the second launch.

### 8.4 `REQ-D-014` — goal rewards

> **Requirement (`REQ-D-014`, P1).** Goal reward system supports flag/pole score,
> goal-card sequence, orb/bridge unlock and moving goal tape. **AC:** End-screen
> reward differs by configured rule set.

#### 8.4.1 The four goal kinds

The goal is a stage trigger, not an actor. It declares:

```
goal_reward = {
  "kind": "flag_pole" | "goal_card" | "orb_unlock" | "moving_tape",
  "score_table_ref": "src/content/scoring/region01.score.json",
  "tiers": [ { "at_x": 0, "at_y": 0, "score": 100, "label": "Low", "badge": null } ],
  "unlocks": [ "region01_stage05" ],
  "reward_actor": { "archetype_id": "item.bloom_berry", "amount": 1 },
  "rule_set_overrides": {
     "challenge":   { "score_multiplier": 2.0, "tiers": [ … ] },
     "carry_throw": { "score_multiplier": 1.0, "extra_reward": "item.key_a" }
  }
}
```

| Kind | Behaviour | Shipped names | Asset |
|---|---|---|---|
| `flag_pole` | The player grabs a pole; the height reached selects a **tier**, which selects a score and a badge. | **Meridian Pole** | `kenney.platformer.poles.glb` (static) + `kenney.platformer.flag.glb` (static) |
| `goal_card` | A sequence of cards is collected in order; each card is one room's clearance. | **Clearance Cards** | `kenney.platformer.sign.glb` / `kenney.mini-dungeon.chest.glb` (animated `open`/`close`) |
| `orb_unlock` | A held orb is carried to a socket; inserting it unlocks a node or a bridge. | **Warden Orb** | `kenney.platformer.jewel.glb`; the socket is `kenney.platformer.lock.glb` |
| `moving_tape` | A goal that travels along the lane; reaching it while it is moving scores a "catch" bonus. | **Drifting Gate** | `kenney.platformer.door-rotate.glb` (**animated**: `open`, `close`, `open-and-close`) |

#### 8.4.2 The reward accounting

- The goal's score is **tier-based**, and the tier table is data. The player
  receives the score of the **highest tier reached**.
- `unlocks` are applied through the world graph's `evaluate_unlocks` (Board B's
  verb) — the goal does not write the graph directly.
- `reward_actor` spawns a collectable **once**, guarded exactly like a block
  payload (§8.1.1).
- `rule_set_overrides` are looked up by the **active rule set id** — this is the
  only place in the entity board where a rule-set id appears in *content*, and it
  appears in a **goals** file, not in an archetype, so ARCH §4.3's
  "no archetype may name a ruleset id" rule is untouched. The override is read
  through `rules.enabled`/`rules.active_id`, never by a literal comparison in
  code.

#### 8.4.3 Acceptance test

> **Check:** the fixture stage has a `flag_pole` goal with three tiers. The test
> triggers the goal at each tier height and asserts the awarded score matches
  the tier table. The test then runs the same stage under two rule sets
  (`classic_ground` and `challenge`) and asserts the **end-screen reward
  differs** — the challenge rule set's `score_multiplier` changes the award and
  the HUD's goal summary differs.
> **Fails if:** the two rule sets produce an identical end-screen reward, or a
  tier awards the wrong score.

---

## 9. The entity half of Board E — `REQ-E-004`, `REQ-E-011`, `REQ-E-016`

### 9.1 `REQ-E-004` — scene composition and the actor layer

> **Requirement (`REQ-E-004`, P0).** Tiled scene composition separates collision,
> art, triggers, interactive tiles, actors, FX and camera zones. **AC:** One level
> file instantiates without code modification.

#### 9.1.1 The eight layers

The stage schema (ARCH §5.2) already separates the layers. The entity board's
contribution is the **`actors` layer and the `triggers` layer** and the rules that
connect them.

| Layer | Owner | Contains |
|---|---|---|
| `collision` | WORLD | Grid-derived box colliders with materials |
| `art` | WORLD | Instanced visual meshes |
| `triggers` | ENTITIES + WORLD | Spawn triggers, goal triggers, boss triggers, mechanism triggers, hazard volumes |
| `interactive_tiles` | WORLD | Blocks, switches, doors, platforms |
| `actors` | **ENTITIES** | Every archetype instance: its archetype id, position, facing, and per-instance overrides |
| `fx` | WORLD | Effect emitters |
| `camera_zones` | WORLD | Follow-rig bounds and dead zones |

#### 9.1.2 The actor instance entry

```
"actors": [
  { "archetype_id": "enemy.pebble_grub", "position": [25, 0, 20], "facing": -1,
    "overrides": { "speed_mps": 2.4, "aggro_radius_m": 8.0 },
    "instance_id": "grub_01" }
]
```

`overrides` are a **whitelist** of the archetype's data fields (§1.2), so a stage
can tune an instance without creating a new archetype. The whitelist is enforced
by the schema: an override key that is not a declared archetype field fails
validation with `STAGE-014 override 'foo' is not a field of archetype
'enemy.pebble_grub'`.

#### 9.1.3 The separation rule

**Actors are never authored into the tilemap, and the tilemap is never authored
into an actor.** A stage that references a missing archetype fails at load with
the file, the field and the id named (ARCH §5.9). A stage that places an actor
inside solid geometry fails the level linter (`REQ-E-010`).

#### 9.1.4 Acceptance test

> **Check:** the fixture stage JSON is instantiated with **no code change**. The
> test asserts the resulting scene tree contains exactly the node sets declared
> by the eight layers — one `Collision` node, one `Art` node, one `Triggers`
> node, one `InteractiveTiles` node, one `Actors` node containing the declared
> actor count, one `FX` node and one `CameraZones` node — and that the actor
> count equals the JSON's `actors[]` length.
> **Fails if:** the node set differs, or an actor is missing or duplicated.

### 9.2 `REQ-E-011` — pooling and activation regions

> **Requirement (`REQ-E-011`, P1).** Actor pooling and activation regions enforce
> scene entity budget. **AC:** Stress scene stays below set frame-time budget on
> target hardware.

#### 9.2.1 The budget

From ARCH §9.3: ≤120 active actors typical, ≤300 in the stress scene, ≤512
pooled objects in total, ≤128 per type. The stage declares its own budget and
the linter enforces it:

```
"actor_budget": { "active_typical": 110, "active_stress": 260,
                  "pooled_total": 480, "pooled_per_type": 96 }
```

The per-archetype `pool.cap` (§4.7) is the authority; the stage budget is the
sum. A stage whose archetype caps exceed its budget fails the linter with
`STAGE-015 actor caps (sum 340) exceed actor_budget.active_stress (260)`.

#### 9.2.2 Activation regions

An **activation region** is a volume that switches actors between *simulated* and
*asleep*. The region is declared on the actor (`activation.region_id`) and its
volume lives on the stage.

**Two values only** — `camera` and `always`:

| `activation.sleep` | Behaviour | Cost while asleep |
|---|---|---|
| `camera` | The default. Off-camera actors sleep. | One transform update per tick, no FSM, no animation. |
| `always` | The actor is always simulated — it never sleeps. | Full update always. Used by fish, traps, bosses and any actor whose position is part of the world's state. |

Waking is hysteretic: an actor wakes at `camera_margin + wake_margin` and sleeps
at `camera_margin`, so an actor on the boundary does not thrash. `wake_margin` is
`TUNE 4.0 m`.

#### 9.2.3 The refusal counter

`actors.pool_refusals[archetype_id]` counts acquisitions the pool could not
satisfy. The perf report publishes it. A non-zero count is **not** a build
failure — it is a signal that the stage's budget is wrong — but an archetype
marked `required_for_stage` converts a refusal into a **stage-load failure**,
because a required encounter that cannot spawn is a broken stage, not a tuning
issue.

#### 9.2.4 Acceptance test

> **Check:** the stress fixture spawns 300 actors across 12 archetypes with a
> declared budget of 260 active and 480 pooled. The test runs 3,600 ticks with a
  scripted camera path and asserts (a) the live actor count never exceeds 260 on
  any sampled tick, (b) the pooled total never exceeds 480, (c) the number of
  sleeping actors is greater than 40 % of the live count while the camera is
  stationary (the sleep path is real), and (d) the perf report exposes
  `pool_refusals` with a value per archetype.
> **Fails if:** any budget is exceeded on any tick, or the refusal counter is
> absent from the report.
> **Note:** the frame-time clause of the requirement is verified by
> `gate/perf-budget` on the baseline runner (ARCH §9.2), not by this test; this
> test verifies the budget half, which is the part this board owns.

### 9.3 `REQ-E-016` — clean scene reload

> **Requirement (`REQ-E-016`, P1).** Scene reload and death handling cleanly reset
> transient timers/projectiles and retain persistent world switches. **AC:** No
> duplicated enemies or phantom projectiles after retry.

#### 9.3.1 The reload contract

On a stage reload — a death respawn, a stage restart, a rule-set switch, or a
return from a sub-area — the following happen, **in this order**:

| Step | Action | Owner |
|---|---|---|
| 1 | The **event bus** is flushed and the "duplicate `(source_id, event_type)` in one tick" guard is reset for the new tick counter. | ARCH |
| 2 | Every **actor** is despawned and returned to its pool, in reverse activation order. Every pool is cleared. | **ENTITIES** |
| 3 | Every **projectile** is despawned. A projectile is an actor of `kind: projectile` and is covered by step 2, but it is also **separately tracked** in the projectile pool so that a projectile in flight when the stage died cannot survive. | **ENTITIES** |
| 4 | Every **timer** owned by an actor (cooldowns, fuses, telegraph timers, respawn timers) is cleared with the actor. | **ENTITIES** |
| 5 | Every **fx** emitter is cleared. | WORLD |
| 6 | **Persistent world switches** (the flags in `save.flags`) are re-applied from the save, not from the previous session. A switch that was on before the death is still on; a switch that expired is off. | WORLD |
| 7 | The player is placed at the checkpoint and the camera is re-seeded from the destination's bounds (no stale camera bounds, 3D-TRANSLATION §2.6). | ARCH |
| 8 | The **boss** is re-armed at its saved phase (§7.5). | **ENTITIES** |

#### 9.3.2 What is explicitly *not* reset

- **Persistent world switches** (`save.flags`) — retained (§9.3.1 step 6).
- **The world graph** (`save.world_graph`) — retained.
- **The inventory** — retained; a consumed item is not restored by a death
  (`REQ-D-013`).
- **Collectables already collected** — retained, via `save.flags` /
  `world_graph` keys, so a death does not duplicate a pickup (`REQ-B-005`).

#### 9.3.3 Acceptance test

> **Check:** the test performs **100 consecutive deaths and respawns** at a
> checkpoint in a fixture stage that contains 40 actors, a boss that fires
  projectiles, and a persistent switch that is on. After the 100th reload the
> test asserts (a) `actors.actor_count()` equals the pre-death baseline, (b) the
> projectile pool count is **zero** and no projectile is alive, (c) no actor
  exists outside the stage's declared `actors[]` list — no duplicates, (d) the
  persistent switch is still **on**, and (e) the stage's live actor count does
  not grow monotonically across the 100 cycles.
> **Fails if:** the actor count drifts upward, a projectile survives, or the
> switch is lost.

---

## 10. Audio, animation and asset gaps — stated, not hidden

### 10.1 The audio corpus, measured

The whole corpus is **52 unique shippable sounds** out of **78 audio file paths
resolving to 66 unique sounds** (ARCH §2.3): 40 Kenney
desert-shooter `.ogg` plus 12 `Fantozzi` footsteps. There is **no music**
(`GAP-A1`). There is **no stomp, no shell-kick, no boss-hit, no boss-defeat, no
water sound and no wind sound.** Every cue below is therefore one of four things: a
**substitute** from the 52 shipped `.ogg`, a **`DERIVED`** bed mixed in-engine from them
(`G-06`), or an explicit **`UNSOURCED`** row.

### 10.2 The entity cue table

| Game event | Cue | File | Note |
|---|---|---|---|
| Player jump | `sfx.jump_b` | Kenney desert-shooter `jump-b.ogg` | |
| Player land | `sfx.jump_c` | `jump-c.ogg` | |
| Player hurt | `sfx.hurt_d` | `hurt-d.ogg` | |
| Player death | `sfx.lose_a` | `lose-a.ogg` | |
| **Stomp landing thump** | `sfx.fall_a` | `fall-a.ogg` | **Substitute.** No stomp sound exists; a fall/impact is the closest. |
| **Enemy defeated (stomp)** | `sfx.explosion_a` | `explosion-a.ogg` | **Substitute** for a defeat pop. |
| **Shell kicked** | `sfx.shoot_c` | `shoot-c.ogg` | **Substitute.** A launch whoosh. |
| **Shell hits an enemy** | `sfx.hurt_a` | `hurt-a.ogg` | **Substitute** for a shell impact. |
| Enemy contact (player hurt) | `sfx.hurt_b` | `hurt-b.ogg` | |
| Enemy telegraph | `sfx.error_a` | `error-a.ogg` | **Substitute** — a short warning pip. Low volume. |
| **Boss hit** | `sfx.hurt_c` | `hurt-c.ogg` | **Substitute**; no boss-hit sound exists. |
| **Boss defeat** | `sfx.explosion_c` | `explosion-c.ogg` | **Substitute** — the largest explosion in the corpus. |
| Boss stagger | `sfx.explosion_b` | `explosion-b.ogg` | **Substitute.** |
| Boss telegraph | **UNSOURCED** | — | Visual only: a ring pulse plus the arena light change. The audio gate records `boss_telegraph: UNSOURCED`. |
| Boss music | **UNSOURCED** | — | `GAP-A1` (architecture). The mixer's music bus starts, ducks and stops with no music loaded (ARCH §7.5). |
| Coin pickup | `sfx.coin_a` | `coin-a.ogg` | |
| Item pickup | `sfx.coin_c` | `coin-c.ogg` | |
| Goal / reward | `sfx.coin_d` + `sfx.select_a` | `coin-d.ogg`, `select-a.ogg` | |
| Spring launch | `sfx.jump_d` | `jump-d.ogg` | |
| Block bump / break | `sfx.shoot_a` | `shoot-a.ogg` | **Substitute** for a "thunk". |
| **Water entry / splash** | `sfx.fall_b` | `fall-b.ogg` | **Substitute.** No water sound exists. |
| Swim stroke | `sfx.fall_b` | `fall-b.ogg` | **Substitute**, at 0.5 volume, pitch **not** altered (ARCH §8.3 forbids pitch shifting). |
| **Wind** | **`DERIVED`** | — | **No single wind file exists in the corpus**, but the wind bed is **mixed in-engine from the 52 shipped `.ogg`** by randomised, **pitch-preserving** one-shot scheduling, per `G-06` (ADOPTED option (c)). Wind is additionally communicated visually — the arrow markers, the drifting debris props and the player's airborne trajectory. The audio gate records `wind: DERIVED`; the game ships with a real wind bed **and** the visual cue. |
| **Water ambience** | **`DERIVED`** | — | Same disposition as wind — mixed in-engine from the shipped SFX per `G-06`. |
| Enemy footsteps | `sfx.footstep_stone_1…3`, `sfx.footstep_sand_1…3` | `Fantozzi-Stone{L,R}{1,2,3}.ogg`, `Fantozzi-Sand{L,R}{1,2,3}.ogg` | **The surface material chooses the variant** — `solid`/`one_way` → stone, `mud`/`quicksand` → sand. This is the 3D-TRANSLATION §1.1 material model applied to audio. |

**Rule.** No cue may be pitch-shifted, time-stretched or synthesised (ARCH §8.3
forbids it). A substitute is a **different file**, not a processed one.

### 10.3 The ASSET GAP register for this board

Every gap names the requirement it blocks and its severity. **No gap is filled
with a placeholder** (ARCH §8.7).

| Gap | What is missing | Blocks | Severity | Handling |
|---|---|---|---|---|
| `GAP-ENT-01` | A distinct **food-shaped negative pickup** (the corpus has one food mesh, used by the growth item) | `REQ-D-003` (polish only) | **Low — non-blocking** | `item.cinder_thorn` uses the spiked block, whose silhouette is deliberately, unmistakably hostile. A food-shaped poison item is a polish item. |
| `GAP-ENT-02` | A **translucent / ghost-like material** — the corpus has no alpha-capable character material, and ARCH §8.3 forbids authoring one | `enemy.pale_hover` (the "ghost flyer" identity), `REQ-C-012` presentation | **Medium — blocks that archetype from being described as a ghost** | The archetype is renamed and specified as a **solid hovering figure** with the difference stated. It is honest about what the corpus can render. |
| `GAP-ENT-03` | **Differentiated growth and restorative** item meshes | `REQ-D-003` (polish only) | **Low — non-blocking** | Both use `mushrooms.glb`; the shipped content never shows them in the same room. |
| `GAP-ENT-04` | **Clip coverage for swimming, gliding, flight, charging and climbing** (`ASSETS GAP-A10`) | `REQ-A-009`, `REQ-A-017`, `REQ-C-011` (presentation) | **Medium — mitigated, not eliminated** | Resolved by the three-tier policy in §1.4: `Climbing`/`Hop` are taken from the one rig that has them; every other missing motion is a **scripted transform on a named rig**, and each affected archetype **states its behavioural difference** in its entry. No clip is ever invented. |
| `GAP-ENT-05` | **Boss music** and region music | `REQ-D-015` (Board D) | **High for D-015, not this board's** | `GAP-A1` (architecture). The mixer is specified for zero music; the gate reports `music_cues_unsourced: N`. |
| `GAP-ENT-06` | A **wind** sound | `REQ-A-010` (presentation) | **Low — mitigated** | **Resolved by `G-06`:** the wind bed is **derived in the mixer** from the 52 shipped `.ogg` by randomised, pitch-preserving one-shot scheduling. No new file is needed; wind is additionally communicated visually. |
| `GAP-ENT-07` | A **water ambience** bed | `REQ-A-009` (presentation) | **Low — mitigated** | **Resolved by `G-06`:** derived in the mixer from the shipped SFX, as with wind. `sfx.fall_b` covers the interaction. |
| `GAP-ENT-08` | A **wrench** prop (the nearest analogue is `Skeleton_Axe.gltf`) | `REQ-C-010` (the `enemy.spring_wrench` read) | **Low — mitigated** | The axe is the enemy's held tool, so the held and thrown silhouettes agree. The difference is stated in the archetype. |
| `GAP-ENT-09` | A **spiked ball** mesh (the nearest analogue is `spike-block-wide.glb`) | `REQ-C-005` (the `enemy.thornroller` read) | **Low — mitigated** | The difference is stated in the archetype. |
| `GAP-ENT-10` | A **rigged** fortress / wheel body (`building_tower_catapult_red.gltf`, `turret_double.glb` are static props) | `REQ-C-016` (the `boss.bastion_hopper` and `boss.cinder_wheel` presentation) | **Medium — mitigated** | The movement is a **scripted transform on the named asset**; the boss's body (where one exists) is a separate rigged character. No skeleton is authored (ARCH §8.3). |

**Count: 10 gaps, 0 blocking.** Classification: **7** are mitigated by an explicit
named alternative (`GAP-ENT-02`, `04`, `06`, `07`, `08`, `09`, `10`); **1** is
owned by another board (`GAP-ENT-05`, the music gap); **2** are low-severity polish
rows with no blocker (`GAP-ENT-01`, `GAP-ENT-03`).

---

## 11. The `TUNE` register

Every constant this board introduces, with its value and its reason. **No
publisher constant is claimed.** All of these live in a ruleset tuning file
(ARCH §5.1 `constants_ref`), not in code.

| Constant | Default | Reason |
|---|---|---|
| `stomp_min_descent` | 0.5 m/s | From 3D-TRANSLATION §2.4 (binding, not ours). |
| `stomp_normal_threshold` | 0.7 | From 3D-TRANSLATION §2.4 (binding). |
| `aggro_radius.standard` | 6.0 m | Roughly three player widths — long enough to be avoidable, short enough that a walker is a threat. |
| `aggro_radius.far` | 12.0 m | For ranged archetypes that should open fire down the lane. |
| `aggro_radius.close` | 4.0 m | For the fish, which should not chase across a room. |
| `facing_tolerance_rad` | 35° | The ghost's facing test must be forgiving enough to read the player's intent. |
| `kick_tolerance_rad` | 55° | A kick must feel aimed; past 55° the shell is not kicked, it is nudged. |
| `pipe_clear_radius` | 2.6 m | The pipe plant's proximity gate — just over the player's own radius plus a step. |
| `attack.telegraph_ticks` | 15 (25 for area attacks) | 0.25 s is the floor for a readable wind-up. |
| `state.idle_ticks` | 60 | A one-second pause so patrols read as deliberate. |
| `state.jump_ceiling_ticks` | 90 | A hard ceiling on any airborne state. |
| `state.attack_ticks` | 45 | Telegraph 15 + commit + recover. |
| `state.retreat_ticks` | 120 | A bounded retreat. |
| `state.stunned_ticks` | 90 | Long enough to be picked up, short enough not to be a camp. |
| `state.shell_ticks` | 360 | Six seconds to kick a shell before it re-emerges. |
| `state.thrown_ticks` | 120 | A thrown body cannot fly forever. |
| `state.defeated_ticks` | 30 | Half a second of visible corpse. |
| `boss.intro_ticks` | 90–120 | The arena reads before the fight starts. |
| `boss.stagger_ticks` | 60 | The fight's punctuation. |
| `boss.damage_window.standard` | the `recover` sub-state | The default window is the recovery, not a special case. |
| `boss.phase_hp` | 4–8 per phase | Six is the default; a phase must not be longer than one attempt. |
| `boss.stagger_threshold` | 2 HP | The stagger lands before the phase ends. |
| `pool.margin_m` | 12.0 | The camera margin at which actors sleep. |
| `pool.wake_margin_m` | 4.0 | The hysteresis band that stops boundary thrash. |
| `spawn.min_distance_from_player_m` | 2.0 | Nothing materialises inside the player. |
| `capture.window_ticks` | 30 | The capture grace window at the top of a fling. |
| `location_bucket_m` | 4.0 | The death-report grid size. |
| `repeat_death_threshold` | 3 | Three deaths at one bucket is flagged as a repeat. |

---

## 12. Ship-set impact

ARCH §8.5 fixes the ship set at ~67 MB against a 73 MB target, with
`actors.pck` = the Kenney platformer cast + KayKit Adventurers, and at most
**two** Quaternius characters. This board's roster needs more than that. The
following is the honest delta, and it is a **GATE-0 decision for the architecture
board** (cross-board note `XN-ENT-02`).

| Asset family | Count used | Ship-set status | Disposition |
|---|---|---|---|
| Kenney platformer cast (25 clips) | 5 | In `core_world.pck` | Ship as is. |
| Kenney mini-characters (32 clips) | 2 | In `core_world.pck` | Ship as is. |
| Kenney mini-dungeon / mini-forest / mini-arena / mini-arcade / mini-skate | 7 | In `core_world.pck` | Ship as is. |
| Kenney blocky-characters (27 clips) | 2 | In `core_world.pck` | Ship as is. |
| Kenney graveyard (32 clips) | 5 | In `core_world.pck` | Ship as is. |
| Kenney cube-pets (8 clips) | 18 | In `core_world.pck` | Ship as is. |
| Kenney platformer / space / factory props | 21 | In `core_world.pck` (platformer) and `biome_NN.pck` (space, factory) | Ship as is. |
| **KayKit Adventurers** (76 clips) | 4 models | In `actors.pck` | Ship as is. |
| **KayKit Skeletons** (95 clips) | 3 rigs | **Not in the declared ship set** | **Amendment required** — add to `actors.pck`. |
| **KayKit Character Animations 1.2** (30 clips, the only `Climbing`/`Hop` rig) | 1 | **Not in the declared ship set** | **Amendment required.** |
| **KayKit Medieval Hexagon** (fortress, bridge, crates) | 4 models | **Not in the declared ship set** | **Amendment required** — or place in `biome_NN.pck` for the fortress region. |
| **KayKit Halloween** (candle, skull, crypt) | 4 models | **Not in the declared ship set** | **Amendment required** — or place in `biome_NN.pck` for the graveyard region. |
| **Quaternius Ultimate Animated Character** (17 clips) | 2 (`Wizard`, `Goblin`) | Excluded by default, **2 permitted** | Ship the two. Within the ARCH §8.5 limit. |
| **Quaternius Ultimate Animated Animals** (`Fox`) | 1 | Not in the declared ship set | **Amendment required** — 1 model. |
| **Quaternius animated mech** (`Leela`) | 1 | Not in the declared ship set | **Amendment required** — 1 model. |

**The size figures are not asserted.** The manifest re-measures every asset at
ingest (ARCH §5.8), and the packer measures the bundle. This board states the
**count** of models required, not a byte total it has not measured. ARCH §8.5's
6 MB headroom is therefore the constraint that the amendment is measured against
at GATE 0 — this board flags the risk and does not hide it behind an estimate.

**Mitigation if the amendment is refused:** the three KayKit Skeleton archetypes
(`boss.spitcantor`, `boss.fission_choir`, and the skeleton-themed enemies) fall
back to the Kenney `shorepine-kenney/3d/graveyard/character-skeleton.glb` (32 clips) and the
`shorepine-kenney/3d/mini-dungeon/character-orc.glb` (32 clips), which are already in the ship set.
The fallback loses the `Spellcast_Shoot` and `Death_C_Skeletons` clips — the
cast-casting becomes a `holding-right-shoot` clip and the death becomes `die`.
This is recorded so that the fallback is a decision, not a scramble.

---

## 13. Acceptance-test index

Every requirement this board owns, with the test that closes it and the suite it
runs in.

| Req | Pri | Test | Suite |
|---|---|---|---|
| `REQ-C-001` | P0 | A data-only archetype spawns and updates with **no new script**; the actor directory's file count and hash are unchanged; no archetype names a ruleset id. | integration |
| `REQ-C-002` | P0 | All twelve states declared; every state has ≥1 outgoing transition except `despawn`; every timer is bounded or event-driven; every target and event is in the closed vocabulary. | unit (validator) |
| `REQ-C-003` | P0 | All 22 states map to exactly one of the 9 matrix columns; the full **9 damage types × 9 columns × every archetype** cross-product resolves to exactly one `(resistance, outcome)`; an unmapped pair fails. | unit (table-driven) |
| `REQ-C-004` | P0 | Backtracking three times respawns only `designated`/`always` archetypes; the live actor count never exceeds the budget on any sampled tick. | integration |
| `REQ-C-005` | P1 | A walker turns at a ledge and at an obstacle; a `stomp_immune` walker survives a stomp; two speed variants cover different distances. | integration |
| `REQ-C-006` | P1 | A kicked shell damages an enemy in its path and the player from the front; a second stomp bounces; the shell re-emerges after the configured time. | integration |
| `REQ-C-007` | P1 | The first compatible hit converts the flyer to its ground variant and clears the `winged` tag; the two silhouettes differ by more than 35 %. | integration + screenshot |
| `REQ-C-008` | P1 | The normal variant does not emerge while the player is adjacent; the aggressive variant does. | integration |
| `REQ-C-009` | P1 | The spawner never exceeds its subordinate cap and its spawn total; despawned subordinates leave the active list. | integration |
| `REQ-C-010` | P1 | Each projectile follows its configured trajectory and can be dodged; the cooldown is respected to the tick. | integration |
| `REQ-C-011` | P1 | An underwater enemy behaves differently from its land equivalent under identical input; the collision mask rejects land-only queries; a fish never leaves its water volume. | integration |
| `REQ-C-012` | P1 | The ghost's movement toggles **exactly** on the player's facing transition — one boolean edge, no hysteresis. | integration |
| `REQ-C-013` | P1 | Every hazard declares a **non-empty** attack hitbox, active only during its damaging state; an archetype with `hitboxes: []` and an `attack` state fails validation. | unit (validator) + integration |
| `REQ-C-014` | P1 | A thrown stunned enemy damages a boss and then recovers; the pickup grants immunity and removes the collider; the credit is the original thrower. | integration |
| `REQ-C-015` | P1 | The boss's HP falls **only** on ticks where the damage window is open; the total damage equals the sum of the phase pools plus the carry-over. | integration |
| `REQ-C-016` | P1 | Each of the seven pattern bosses changes phase and leaves the arena with no live entity behind. | integration (7 fixtures) |
| `REQ-C-017` | P1 | The goal mechanism removes the boss with **zero** damage applied and advances the stage; the reward is granted once across both routes. | integration |
| `REQ-C-018` | P1 | A reflected projectile credits the reflector and damages the boss; a caught projectile credits the catcher; the two flags are independent. | integration |
| `REQ-C-019` | P1 | The boss returns to the **correct phase** with the captured HP; no projectile survives the reload; the reward is granted exactly once across all retries. | integration |
| `REQ-C-020` | P2 | A scripted death produces a QA row carrying archetype, location and time; the report aggregates death locations per build. | integration + tool |
| `REQ-D-002` | P0 | Hitting a block N times inside one window emits **exactly one** reward event; the state sequence is `idle → hit → empty`. | integration |
| `REQ-D-003` | P0 | Collecting a currency increments the counter exactly once; the same collectable cannot be collected twice; the negative item increments nothing. | integration |
| `REQ-D-010` | P1 | Standing and jumping on a spring produce the **two** configured launch impulses; the cooldown suppresses a second launch. | integration |
| `REQ-D-014` | P1 | The end-screen reward differs between two configured rule sets. | integration |
| `REQ-E-004` | P0 | A stage instantiates from its JSON alone and produces exactly the declared node set, with no code modification. | integration |
| `REQ-E-011` | P1 | The stress scene stays within the entity budget on every sampled tick; the pool's refusal counter is exposed in the perf report. | integration + perf |
| `REQ-E-016` | P1 | After 100 consecutive retries the live actor count returns to its baseline, no projectile survives, and the persistent switch is retained. | integration |

---

## 14. Cross-board notes

| Id | To | Note |
|---|---|---|
| `XN-ENT-01 — CLOSED 2026-10-30` | ARCH | **The damage-type enum has nine members, not seven.** 3D-TRANSLATION §3 defines `contact, stomp, projectile, thrown, moving_shell, environment, crush, fall, poison` — nine values; ARCH §10.3's acceptance clause said "7 damage sources". | **CLOSED — ARCH corrected §10.3 to "9 damage sources × every archetype" and names the nine values.** The 3D translation wins, and both boards now publish nine. |
| `XN-ENT-02 — CLOSED 2026-10-30` | ARCH | **The ship set must be amended.** §12 lists the asset families the roster requires beyond ARCH §8.5's declared bundles (KayKit Skeletons, KayKit Character Animations 1.2, KayKit Medieval Hexagon, KayKit Halloween, the Quaternius animal and the mech). | **CLOSED — ARCH §8.5 now carries the reconciled ship set** (the roster's families are included, and the target moved from 73 MB to **≈104 MB**), and the master document records the same amendment. Nothing further is needed from this board. |
| `XN-ENT-03 — CLOSED 2026-10-30` | ARCH | **The twelfth FSM state.** ARCH §10.3 requires twelve states; `REQ-C-002` names eleven. The twelfth is **`spawn`**, required by pooling and by `REQ-E-016`'s clean reload. | **CLOSED — ARCH §5.3's example archetype now declares the `spawn` state**, and its validation rule requires every archetype state to be a member of the sealed twelve-state vocabulary, which includes `spawn`. The reference template matches the FSM contract. |
| `XN-ENT-04` | PLAYER | **Settled ownership — no decision outstanding.** **The player board consumes this board's pipeline.** The `DamageEvent` (§2.1), the resistance matrix (§2.3) and the outcome vocabulary (§2.2) are owned here. Board A owns the *response* — health decrement, power downgrade, knockback application, the invulnerability window — and reads the outcome rather than re-deriving it. Board A must not branch on `damage_type`.|
| `XN-ENT-05` | PLAYER | **Settled ownership — no decision outstanding.** **Carry and throw.** 3D-TRANSLATION §2.10 gives the carried object a `last_attacker_id`; this board generalises it to `attacker_chain` (§2.1) so a shell, a thrown body and a reflected projectile all credit correctly (`REQ-C-014`, `REQ-C-018`). Board A should populate the chain on pickup and release.|
| `XN-ENT-06` | WORLD | **Settled ownership — no decision outstanding.** **The stomp test is binding.** §2.4 restates 3D-TRANSLATION §2.4 unchanged. Board A owns the player's velocity and the contact normal; this board owns the target side of the test (the top collider and the lid hitboxes). The two halves must agree on the tick.|
| `XN-ENT-07` | WORLD | **Settled ownership — no decision outstanding.** **Block payload accounting** (§8.1) and **collectable accounting** (§8.2) are owned here; the blocks' art and the HUD are Board D's. The exactly-once guards (`payload_claimed`, `collected`) must not be re-implemented on the presentation side.|
| `XN-ENT-08` | ARCH | **Settled ownership — no decision outstanding.** **A new gate.** `ci/gate/damage-authority.sh` (§0.1) fails the build if any file outside `src/core/damage/` branches on a `damage_type` literal. This is the mechanical enforcement of "one authority".|
| `XN-ENT-09 — CLOSED 2026-10-30` | ARCH | **Codify the runtime-transform vocabulary.** ARCH §8.3 listed only *offline, file-level* modifications; the roster's tier-2 motions relied on §2.2's wording alone. | **CLOSED — ARCH §8.3a now carries the runtime-transform vocabulary** as a numbered clause, naming the permitted forms (`bob`, `sway`, `arc`, `orbit_offset`, `uniform_scale`, node rotation) and forbidding a **non-uniform scale** because it changes the silhouette. The master document records the same clause. |
| `XN-ENT-10 — CLOSED 2026-10-30` | ARCH | **The archetype schema's example taught the old shapes** — `"fire"` (not in the damage enum, which has `environment` and `poison`) and `"activation": {"sleep": "outside_camera_margin"}` (this board uses `camera`). | **CLOSED — ARCH §5.3's example archetype is corrected**: the resistance now reads `"environment": "take"` and the activation reads `"sleep": "camera"`. The example no longer teaches a vocabulary the enum does not contain. |
| `XN-ENT-11 — CLOSED 2026-10-30` | ARCH | **The matrix key needs a third axis.** A front/behind distinction (a shell that hits a player from the front hurts, from behind it bounces) cannot be expressed without a `normal_bin` axis (§2.3). | **CLOSED — ARCH §5.3 now publishes the three-axis key** in its *Damage authority* row: `(damage_type × matrix_state × normal_bin) → outcome`, with the nine damage types, the nine matrix states, the five `normal_bin` values and the `DAMAGE-006` no-silent-fallback rule. The board and the architecture document agree. |
| `XN-ENT-12 — CLOSED 2026-10-30` | ARCH | **`REQ-C-013` named seven hazards; this board specifies eleven archetypes.** The requirement names **six** parameterised hazard kinds (ceiling/drop, rotating fire bar, falling weight, rolling boulder, chain tether, roaming flame), and the roster implements them across **eleven** archetypes. | **CLOSED — ARCH's acceptance clause now states both numbers**: the **6** required kinds, each implemented by at least one archetype, and the **11** roster archetypes, all of which must declare a non-empty attack hitbox. Both boards agree. |
| `XN-ENT-14 — CLOSED 2026-10-30` | WORLD | **The water-volume electrical obstacle is Board D's.** `REQ-C-011` names four aquatic things: fish, squid, a current-following swimmer and an electrical obstacle. The first three are actor archetypes here; the electrical obstacle is a **hazard**, and hazards belong to Board D's `REQ-D-012` unified hazard events. | **CLOSED — the world board's hazard catalogue now carries `H-14` `hazard.electrical`**, the submerged pylon, with `AC-H14` (non-empty hitbox, active only while charged, light-rig flicker telegraph, one `environment` damage event per cooldown window, and the water collision mask rejecting it for land-only queries). The world board's `REQ-D-012` clause now names all **14** catalogue entries and the **8** required kinds. |

| `XN-ENT-13 — CLOSED 2026-10-30` | ARCH | **The actor schema needs `parts[]` and `clip_set_id` clarified.** Multi-part actors (the three candle heads, the airship hull and pilot) have their own health and hitbox but are **not** separate actors. | **CLOSED — ARCH §5.3's schema now declares `parts[]`** (an array, empty in the example, listed as a required field), and the example carries it. `clip_set_id` is already declared in the example's `rig` object. Both boards now agree on the shape. |

---

## 15. Summary

| | |
|---|---|
| **Requirements owned** | `REQ-C-001 … REQ-C-020` (20) · `REQ-D-002`, `REQ-D-003`, `REQ-D-010`, `REQ-D-014` (4) · `REQ-E-004`, `REQ-E-011`, `REQ-E-016` (3) = **27** |
| **Archetypes designed** | **72 actor archetypes** — 57 `enemy`, 10 `boss`, 4 `projectile`, 1 `companion` — plus 1 Board D item (`item.cinder_thorn`), which is not an actor archetype |
| **Reference families covered** | 5 (all 67 taxonomy entries, 1:1, plus the third aquatic archetype `REQ-C-011` names) |
| **Boss patterns** | 7 of 7 (`REQ-C-016`), each with a dedicated fixture |
| **Every archetype cites a real file** | Yes — every path resolves inside the corpus; no archetype is mesh-less |
| **Asset gaps** | 10 rows (§10.3), 0 blocking, no placeholders |
| **TUNE constants** | 28 (§11), each with a rationale; no publisher constant claimed |
| **Cross-board notes** | 14 (§14) |
| **IP** | No reference-game name appears in any shipped id, name or file. Family codes appear in this document only, as research tags (§0.2). |

**The one thing this board could not fully deliver:** there is no swimming,
gliding, flight, charging or climbing **clip** anywhere in the corpus
(`GAP-ENT-04` / `ASSETS GAP-A10`). Every affected archetype therefore states, in
its own entry, exactly how its motion is produced and exactly what is lost — a
swimmer that glides rather than strokes, a flyer that banks rather than flaps, a
leaper that arcs without a crouch. No clip has been invented, no mesh has been
imagined, and no placeholder has been used.

