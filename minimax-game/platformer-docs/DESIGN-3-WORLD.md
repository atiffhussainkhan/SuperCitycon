# DESIGN-3 — WORLD & CONTENT

**Owner:** PD World & Content board.
**Subject:** the 3D world, its stages, its objects, its presentation and its words.
**Binding upstream:** `minimax-game/platformer-docs/3D-TRANSLATION.md` (the 3D contract) and
`minimax-game/platformer-docs/MASTER-REQUIREMENTS.txt` (102 REQs, ground truth).
**Binding interface:** `minimax-game/platformer-docs/DESIGN-3-ARCHITECTURE.md` §4, §5.1, §5.2, §5.6, §7.3.

> **Where this document stands.** The architecture board owns the *engine*, the *schemas* and
> the *gates*. This board owns the *content inside those schemas*: the stage matrix, the
> eight regions, the world graph, the interactive-object catalogue, the presentation layer
> and the string table. Where the two touch, the architecture board's field names and error
> codes win; where this document adds a field the architecture board did not declare, this
> document is the normative extension and says so explicitly and by name.

---

## 0. Reading order, vocabulary and authority

### 0.1 Vocabulary

| Term | Meaning in this document |
|---|---|
| **cell** | One 1.0 m cube of the authoring grid. `TUNE-016` fixes the cell at 1.0 m; `1 world unit = 1 metre` (3D contract §0). |
| **placement** | A grid cell bound to a named asset, a collision profile and a material. The 3D form of a tile. |
| **object** | An *interactive* instance — a block, a platform, a switch, a door, a hazard, a collectable — placed at a position, not on the terrain grid. |
| **lane** | The Z band the camera is confined to. The stage's playable depth. 3D contract §2.1. |
| **lane transition volume** | An authored volume that shifts the lane centre. 3D contract §2.1. |
| **rig** | The background assembly for a biome: skybox + parallax backdrop + fog + light. |

### 0.2 Authority for shared identifiers

The five boards share ids. **Each id has exactly one authority.** This board's authority is
recorded in `DESIGN-3-ARCHITECTURE.md` §10.2 and §10.4; the table below restates it and
resolves the boundary cases the architecture matrix left implicit.

| Shared id | Authoritative board | This board's role |
|---|---|---|
| `ruleset_id`, rule-set feature flags, TUNE constants | **ARCHITECTURE** (§5.1, §12) | Names the ids. Never defines or overrides a value. |
| Stage **schema** (`src/content/stages/<id>.stage.json`) | **ARCHITECTURE** (§5.2) for v1 | **This board defines v2** — the v1 field set plus the eight 3D field groups in §2.3. See the DELTA note in §2.4. |
| World-map node schema (architecture §5.6) | **ARCHITECTURE** | **This board supplies the graph content** (§5) and the node semantics (kind, icon, requires). |
| Actor archetype schema (§5.3) | **ENTITIES** | **This board supplies the *placement*** of archetypes into stages and the stage-side variant overrides. |
| Item schema (§5.4) | **ENTITIES** (payload/physic semantics) | **This board owns the item *catalogue* content** — which item goes in which block, and the negative-item set (§6.7). |
| Block schema (architecture §5.5) | **ARCHITECTURE** (structure) | **This board owns the block *catalogue*** — the material, the asset, the payload table (§6.1). |
| Collision **material** table (friction/accel) | **3D contract §1.1** | **This board owns the material *assignment* per placement** and the 2D-tile→3D-material mapping (§3). |
| Damage pipeline, resistance matrix | **ARCHITECTURE** §3 / 3D contract §3 | Calls it with the correct `damage_type` for each hazard (§6.6). Never re-implements it. |
| Camera rig behaviour | **PLAYER** (3D contract §4) | **This board owns the authored data**: `camera_zones`, `lane_transitions`, `bounds`, and the scripted-track data (§2.3). |
| Player state machine, jump, glide, carry | **PLAYER** | Never touched here. |
| Physics zones (water/wind) **behaviour** | **PLAYER** (3D contract §2.7–2.8) | **This board owns the authored volumes** and their magnitude/direction data (§2.3, §7.4). |
| **Audio mixer** and cue **registry** | **THIS BOARD** (REQ-D-015) | Mixer bus graph, cue ids, ducking, priority table (§7.6). The architecture gate 9 verifies it. |
| **UI screens, HUD, menus** | **THIS BOARD** (REQ-D-018) | Screen flow, string table boundary, rebind prompts (§7.7, §8). |
| **Tutorial content** | **PLAYER** owns the system; **THIS BOARD owns the content** | Cue text, cue placement, sign art (§8.4). |
| Accessibility **options** | **PLAYER** owns the system; **THIS BOARD owns the content** | Option list, labels, sign/voice content (§8.5). |
| Level linter rule ids | **THIS BOARD** (rule content) | The architecture board owns the *runner* and the *gate* (architecture §7.3); this board defines the rule set and the error text (§9). |
| World-graph validator rule ids | **THIS BOARD** (rule content) | Same split (§9). |

---

## 1. Production scope — what is actually being designed

### 1.1 The proposal versus the commitment

The master document §6 *proposes* "8 regions × 5–8 stages + 10–20 optional stages + 8 regional
boss encounters + 1 finale" and explicitly labels it **a proposed production scope, not a
factual count**. Eighty bespoke 3D stages of 240 m each is roughly 19 200 m of authored
geometry, 8 000+ placements, and 50+ bespoke enemy layouts. That is a multi-year content
budget, and a design pass that claims it would be a lie.

**The scope this document commits to:**

| Layer | Committed here | Deferred |
|---|---|---|
| Regions | **8**, named, themed, with full stage lists, biome sets, palettes, boss specifications and secret routes | — |
| Stages | **13**: Region 1 in full (5 stages + 1 boss arena) and **one representative stage per Region 2–8** (7), giving one original end-to-end stage per shipped mechanic — the release gate in master §9 | 51 further stages of the 5–8-per-region target |
| Bosses | **8**, specified at arena/phase/asset level | Full multi-phase layouts beyond the phase scripts |
| Bonus chambers | **8**, one per region, specified | Minigame interiors beyond the two named below |
| Finale | **1**, `region08_finale`, specified | — |
| World graph | **Complete** for the 13 committed stages; the remaining region nodes are declared as `hidden`/unreachable placeholders so the validator proves the committed subgraph | Full graph for 51 deferred stages |
| Presentation | **Complete**: all 13 biome rigs, 13 palettes, light rigs, FX list, mixer, menu flow | Per-stage bespoke backdrop dressing |

**This is a Gate 1 slice, not a demo.** Gate 1 means: Region 1 playable end to end, the whole
content *system* proven by one stage in each of the remaining seven biomes, and every content
schema populated with real data.

### 1.2 The minimum viable slice — Gate 1 tutorial stage

`region01_stage01` is specified **in full** in §2.9: every field, every placement row, every
entity, every trigger, every tutorial cue, every acceptance test. It is the reference
instance for every other stage in the game. A second stage (`region01_stage02`) is specified
at table level in §4.1 as a contrast case (vertical, one-way platforms).

### 1.3 Hard constraints restated as design rules

1. **3D.** A stage is a 3D volume. A "tile" is a **collision volume + an asset placement on
   a grid**. Every cell resolves to a named repository asset. Never a generated mesh.
2. **No procedural art.** Every prop, tile, background, skybox, UI element and icon is a
   named file from the repository, or an **ASSET GAP** row (§11).
3. **Original content.** Eight original region names, original mechanics lessons, original
   layouts. No reference-game stage, tile layout, name, music or dialogue.
4. **Configurable, never fake-precise.** Timers, scores, lives and difficulty are rule-set
   parameters (`GAP-010`). Every number below is `TUNE` unless explicitly marked otherwise.

---

## 2. The stage schema

### 2.1 The mandatory matrix, mapped onto the architecture board's field names

The master document §6 lists **19 mandatory stage-matrix fields**. The architecture board
§5.2 declares a stage JSON with **20 required fields**. The two are the same information in
two vocabularies; this table is the normative mapping and is what the linter checks.

| # | Master matrix field | Stage schema v2 field | Type | Notes |
|---|---|---|---|---|
| 1 | `stage_id` | `id` | string | `^[a-z0-9][a-z0-9_-]*$`. Unique across all content. |
| 2 | `world_id` | `world_id` | string | Resolves to a node-set in `src/content/worlds/<id>.world.json`. |
| 3 | `entry_spawn` | `entry_spawn` | object | `{id, position[3], facing}` in world metres. Inside `bounds` (§9 `LINT-001`). |
| 4 | `ruleset_id` | `ruleset_id` | string | One of the five sealed ids. Exactly one per stage. |
| 5 | `dimensions` | `bounds` | object | `{min[3], max[3]}` — the authoritative stage volume. Camera and all volumes are clamped inside it. |
| 6 | `tile_palette` | `tilemap.palette_ref` | string | Path to `src/content/palettes/<id>.palette.json`; enumerates the block archetypes this stage may place and each one's asset id. |
| 7 | `collision_layers` | `tilemap.collision_layers` | string[] | The collision layers this stage's placements may write to. |
| 8 | `entities[]` | `objects[]` + `actors[]` | array | **Split in 3D.** `objects[]` = interactive instances (blocks, switches, doors, platforms, hazards, collectables). `actors[]` = actor instances (enemies, bosses, companions). Terrain is `placements[]`. |
| 9 | `triggers[]` | `triggers[]` | array | Spawn / sequence / tutorial / camera-script triggers. |
| 10 | `normal_exit` | `exits[]` where `type == "primary"` | object | **Exactly one** primary exit per stage. |
| 11 | `secret_exits[]` | `exits[]` where `type == "secret"` | array | Zero or more. Each needs `requires`. |
| 12 | `prerequisites[]` | `exits[].requires[]` | string[] | Flag names declared in the world's `flags` (architecture §5.6). |
| 13 | `checkpoint_rules` | `checkpoints[]` | array | `{id, position[3], captures[], respawn_ruleset_id?}`. |
| 14 | `timer_policy` | `timer_policy` | object | `{mode, limit_seconds, pauses_in_menu, on_expiry}`. `limit_seconds` is a ruleset-overridable parameter, never a hard-coded constant. |
| 15 | `difficulty_tag` | `difficulty_tag` | string | `intro` \| `gentle` \| `standard` \| `demanding` \| `severe` \| `finale`. |
| 16 | `music_id` | `music_cue_id` | string\|null | **See the DELTA in §2.4.** `null` is legal only with the `music_unsourced` qa tag. |
| 17 | `goal_reward` | `goal_reward` | object | `{kind, score_table_ref, unlocks[]}`. |
| 18 | `save_flags` | `save_flags` | string[] | Flags this stage sets on completion. |
| 19 | `QA_tags` | `qa_tags` | string[] | Closed vocabulary (§2.6). |

### 2.2 The eight 3D field groups

The 3D contract requires eight things the 2D stage matrix has no place for. Each becomes a
top-level field group in stage schema v2.

| Group | Field | What it carries |
|---|---|---|
| Camera lane | `camera_zones` + `lane_transitions` | `camera_zones` = the authored lane band, dead zone, look-ahead and camera bounds per zone. `lane_transitions` = the authored volumes that shift the lane centre (3D contract §2.1). |
| Volume bounds | `bounds` + `volumes` | `bounds` is the stage envelope. `volumes` are named interior volumes: goal zones, secret zones, safe zones, crush zones, kill floors, camera-only zones. |
| Light rig | `light_rig` | `{preset_id, ambient, key, fill, rim, fog, shadow_bias, time_of_day}`. |
| Background rig | `background` | `{rig_id, skybox_asset_id, backdrop_layers[], fog_color, fog_density}`. `rig_id` resolves to `src/content/backgrounds/<id>.background.json` (§7.1). |
| Asset placement table | `placements` | The grid. One row per non-empty cell: `{cell[3], asset_id, collision{}, rotation_y, scale}`. |
| Lane-transition volumes | `lane_transitions` | `{id, aabb, from_lane_z, to_lane_z, transition_ms, camera_curve}`. |
| Wind / water volumes | `wind_volumes`, `water_volumes` | `wind_volumes`: `{id, aabb, direction[3], magnitude, falloff}`. `water_volumes`: `{id, aabb, surface_y, kind, current[3]}`. |
| Portal volumes | `portal_volumes` | `{id, kind, aabb, axis, facing_tolerance_deg, destination, return_portal, requires[]}`. `kind ∈ {pipe, pipe_vertical, door, ladder, warp, potion}`. |

### 2.3 The stage schema v2 — normative field list

**30 top-level fields.** v1 is the architecture board's 20 required fields plus `music_cue_id`
plus nine 3D groups.

| # | Field | Type | Required | Owner of the value |
|---|---|---|---|---|
| 1 | `schema_version` | int | ✔ (=2) | ARCH |
| 2 | `id` | string | ✔ | WORLD |
| 3 | `world_id` | string | ✔ | WORLD |
| 4 | `ruleset_id` | string | ✔ | WORLD |
| 5 | `variant` | enum | ✔ | WORLD — one of the 13 sealed biome variants |
| 6 | `bounds` | object | ✔ | WORLD |
| 7 | `entry_spawn` | object | ✔ | WORLD |
| 8 | `tilemap` | object | ✔ | WORLD — `{palette_ref, collision_layers, visual_layers, grid}` |
| 9 | `placements` | array | ✔ | WORLD |
| 10 | `props` | array | ✔ | WORLD — dressing only, no collider |
| 11 | `objects` | array | ✔ | WORLD |
| 12 | `actors` | array | ✔ | WORLD |
| 13 | `triggers` | array | ✔ | WORLD |
| 14 | `camera_zones` | array | ✔ | WORLD (authored data; PLAYER owns behaviour) |
| 15 | `lane_transitions` | array | ✔ | WORLD |
| 16 | `volumes` | array | ✔ | WORLD |
| 17 | `water_volumes` | array | ✔ | WORLD |
| 18 | `wind_volumes` | array | ✔ | WORLD |
| 19 | `portal_volumes` | array | ✔ | WORLD |
| 20 | `checkpoints` | array | ✔ | WORLD |
| 21 | `exits` | array | ✔ (≥1) | WORLD |
| 22 | `background` | object | ✔ | WORLD |
| 23 | `light_rig` | object | ✔ | WORLD |
| 24 | `palette` | string | ✔ | WORLD — palette variant id (§7.2) |
| 25 | `timer_policy` | object | ✔ | WORLD |
| 26 | `difficulty_tag` | string | ✔ | WORLD |
| 27 | `music_cue_id` | string\|null | ✔ | WORLD |
| 28 | `goal_reward` | object | ✔ | WORLD |
| 29 | `save_flags` | array | ✔ | WORLD |
| 30 | `qa_tags` | array | ✔ | WORLD |

### 2.4 DELTA against the architecture board §5.2

Three deltas, each a named, single-line change request to the architecture board. **None
breaks v1 files**: v1 files stay `schema_version: 1` and remain valid.

| Delta | Change | Why |
|---|---|---|
| **W-01** | Make `music_cue_id` **required** in the stage schema (it is present in the §5.2 example but absent from the §5.2 required list). | The master matrix requires `music_id` on every stage (REQ-B-001). The §5.2 validation rule already says a `null` cue forces the `music_unsourced` tag — which is meaningless if the field may be absent. |
| **W-02** | Add `placements` to the stage schema and make `props` **collider-free by construction**. | The 3D contract §1 splits the 2D world into a *tile layer* (collidable, on a grid) and a *foreground layer* (visual-only, no collider). The architecture board's `props` currently carries `asset_id, position, rotation_y, scale` with no collider field — under-specifying the split. `placements` is the grid; `props` is the dressing. |
| **W-03** | Add the eight 3D field groups as §2.2 above. | The 3D contract §1, §2.6–2.8, §4 require camera lanes, lane transitions, volume bounds, water/wind volumes, portal volumes, a light rig and an asset placement table. v1 has no home for them. |

### 2.5 Worked instance — `region01_stage01`

```json
{
  "schema_version": 2,
  "id": "region01_stage01",
  "world_id": "region01",
  "ruleset_id": "classic_ground",
  "variant": "overworld",
  "bounds": {"min": [0, 0, 0], "max": [120, 16, 12]},
  "entry_spawn": {"id": "spawn_main", "position": [4, 1, 6], "facing": 1},
  "tilemap": {
    "palette_ref": "src/content/palettes/meadow_day.palette.json",
    "collision_layers": ["solid", "one_way"],
    "visual_layers": ["art"],
    "grid": {"cell_size_m": 1.0, "origin": [0, 0, 0]}
  },
  "placements": [
    {"cell": [8, 0, 6], "asset_id": "kenney.platformer.block-grass",
     "collision": {"profile": "box", "material": "solid"}, "rotation_y": 0.0, "scale": 1.0},
    {"cell": [9, 0, 6], "asset_id": "kenney.platformer.block-grass",
     "collision": {"profile": "box", "material": "solid"}, "rotation_y": 0.0, "scale": 1.0},
    {"cell": [10, 0, 6], "asset_id": "kenney.platformer.block-grass",
     "collision": {"profile": "box", "material": "solid"}, "rotation_y": 0.0, "scale": 1.0},
    {"cell": [10, 1, 6], "asset_id": "kenney.platformer.block-grass",
     "collision": {"profile": "box", "material": "solid"}, "rotation_y": 0.0, "scale": 1.0},
    {"cell": [22, 2, 6], "asset_id": "kenney.platformer.block-grass",
     "collision": {"profile": "box", "material": "solid"}, "rotation_y": 0.0, "scale": 1.0}
  ],
  "props": [
    {"asset_id": "kenney.platformer.tree", "position": [14, 0, 2.5], "rotation_y": 0.4, "scale": 1.0},
    {"asset_id": "kenney.platformer.flowers", "position": [7, 1, 7.5], "rotation_y": 0.0, "scale": 1.0}
  ],
  "objects": [
    {"id": "obj_coin_a", "kind": "collectable", "archetype_id": "object.coin_bronze",
     "position": [16, 1, 6], "placement": "cell"},
    {"id": "obj_block_a", "kind": "block", "archetype_id": "block.bump_coin",
     "position": [30, 4, 6], "placement": "cell"},
    {"id": "obj_sign_a", "kind": "sign", "archetype_id": "object.sign_post",
     "position": [18, 0, 6], "facing": 1, "text_key": "tut.move_01"}
  ],
  "actors": [
    {"id": "act_walker_a", "archetype_id": "enemy.ground_walker", "position": [44, 1, 6], "facing": -1},
    {"id": "act_walker_b", "archetype_id": "enemy.ground_walker", "position": [70, 1, 6], "facing": -1}
  ],
  "triggers": [
    {"id": "tr_tut_move", "type": "tutorial", "aabb": {"min": [4,0,4],"max": [14,8,8]},
     "payload": {"text_key": "tut.move_01", "once": true}},
    {"id": "tr_tut_jump", "type": "tutorial", "aabb": {"min": [22,0,4],"max": [40,8,8]},
     "payload": {"text_key": "tut.jump_01", "once": true}},
    {"id": "tr_spawn_walker_b", "type": "spawn", "aabb": {"min": [64,0,4],"max": [78,8,8]},
     "payload": {"archetype_id": "enemy.ground_walker", "count": 1}}
  ],
  "camera_zones": [
    {"id": "cz_main", "trigger_aabb": {"min": [0,0,0], "max": [120,16,12]},
     "follow": {"deadzone": [6,3], "look_ahead": [4,0],
                "bounds": {"min": [0,0,0], "max": [120,16,12]}}}
  ],
  "lane_transitions": [],
  "volumes": [
    {"id": "vol_goal", "kind": "goal", "aabb": {"min": [114,0,4], "max": [120,8,8]}},
    {"id": "vol_killfloor", "kind": "kill_floor", "aabb": {"min": [0,-4,0], "max": [120,0,12]}}
  ],
  "water_volumes": [],
  "wind_volumes": [],
  "portal_volumes": [
    {"id": "pv_secret_a", "kind": "warp", "aabb": {"min": [96,0,5.2], "max": [100,2,6.8]},
     "axis": [1,0,0], "facing_tolerance_deg": 25,
     "destination": "region01_bonus01", "return_portal": "pv_secret_a", "requires": []}
  ],
  "checkpoints": [
    {"id": "cp01", "position": [46, 1, 6], "captures": ["transient_power_state", "coin_count"]}
  ],
  "exits": [
    {"id": "normal", "type": "primary", "to_node": "region01_stage02", "requires": []},
    {"id": "hidden", "type": "secret", "to_node": "region01_bonus01", "requires": ["key_brass"]}
  ],
  "background": {"rig_id": "bg.meadow_day", "skybox_asset_id": "polyhaven.aarfontein_dawn_2",
                 "backdrop_layers": [], "fog_color": [0.62, 0.74, 0.86], "fog_density": 0.006},
  "light_rig": {"preset_id": "light.day_soft", "ambient": [0.45, 0.48, 0.52],
                "key": {"colour": [1.0, 0.96, 0.86], "intensity": 1.15, "angle_deg": 38},
                "fill": {"colour": [0.62, 0.72, 0.88], "intensity": 0.45},
                "rim": {"colour": [0.85, 0.92, 1.0], "intensity": 0.3},
                "fog": {"enabled": true, "density": 0.006}, "shadow_bias": 0.03, "time_of_day": "morning"},
  "palette": "meadow_day",
  "timer_policy": {"mode": "countdown", "limit_seconds": 300, "pauses_in_menu": true,
                   "on_expiry": "ruleset_default"},
  "difficulty_tag": "intro",
  "music_cue_id": "music.region01.overworld",
  "goal_reward": {"kind": "exit_card", "score_table_ref": "src/content/scoring/region01.score.json",
                  "unlocks": ["flag.region01_stage01"]},
  "save_flags": ["flag.region01_stage01"],
  "qa_tags": ["teaches_move", "teaches_jump", "teaches_hidden_block", "music_unsourced"]
}
```

**Notes on the instance.** `music_cue_id` is a **cue id**, not a file path — it resolves
through the cue registry (§7.6), where every region cue currently resolves to an
`UNSOURCED` marker. `qa_tags` therefore carries `music_unsourced` on **every** stage, which
is the visible, counted form of the music gap (§11, `GAP-A1`). `placements[]` is abridged to
five rows here; the full table for this stage is §2.9.

### 2.6 `qa_tags` — closed vocabulary

`LINT-016` fails on an unknown tag. The vocabulary is closed and extensible only by a
schema bump.

`teaches_move` · `teaches_jump` · `teaches_hidden_block` · `teaches_swim` · `teaches_wind` ·
`teaches_carry` · `teaches_glide` · `teaches_climb` · `teaches_switch` · `teaches_locks` ·
`has_boss` · `has_secret_exit` · `autoscroll` · `vertical_ascent` · `ice_surface` ·
`quicksand` · `conveyor` · `maze` · `low_visibility` · `moving_ends` · `music_unsourced` ·
`asset_gap` · `pending_playtest`

### 2.7 `variant` — the 13 sealed biome variants

`overworld` · `underground` · `underwater` · `castle` · `fortress` · `ghost_house` · `sky` ·
`desert` · `ice` · `giant` · `forest` · `lava` · `airship`

REQ-B-007's acceptance — "each biome loads a distinct hazard set, material set and
audio/visual profile id; two variants sharing a profile id fail" — is enforced by
`LINT-027` (§9): each variant owns a **distinct** `bg.*` rig id and a **distinct** hazard
profile id.

### 2.8 Value discipline

No number in this document claims to be a reference-game constant. `GAP-001`, `GAP-010` and
`GAP-003` stand. Every timing, score, timer, difficulty and count value is a `TUNE`
parameter that lives in `src/content/tuning/<ruleset_id>.tune.json` (architecture §5.1) and is
overridable per stage. The values quoted below are the **defaults** for the *Gate 1 slice*
and are labelled `TUNE`.

### 2.9 The Gate 1 tutorial stage in full — `region01_stage01`

This is the reference instance. Every other stage in the game is authored to the same
shape. Where this section says "the stage file contains one row per cell", it means the
shipped `region01_stage01.stage.json` enumerates every non-empty cell explicitly; the
**range notation** below is the authoring shorthand a human reads, and the authoring tool
expands it. The linter sees only the expanded file.

**Bounds and lane.** `bounds = {min:[0,0,0], max:[120,16,12]}`. The lane centre is
`z = 6`; the lane band is `z ∈ [4,8]`. The camera zone `cz_main` has
`deadzone [6,3]`, `look_ahead [4,0]` and bounds equal to the stage bounds, so the camera
can never show outside them (`REQ-B-003`).

**Terrain placements** (all `collision.profile: "box"`, `material: "solid"`, `rotation_y:
0.0`, `scale: 1.0`):

| Range notation | Cells | Asset | Material |
|---|---|---|---|
| `x ∈ [0..12] ∪ [15..19] ∪ [21..26] ∪ [27..34] ∪ [35..46] ∪ [47..49] ∪ [53..58] ∪ [64..72] ∪ [73..91] ∪ [96..100] ∪ [101..104] ∪ [111..119]`, `y = 0`, `z = 6` | floor | `shorepine-kenney/3d/platformer/block-grass.glb` | `solid` |
| `x = 20`, `y = 1` | one step | `…/block-grass.glb` | `solid` |
| `x = 50, y = 1` · `x = 51, y = 2` · `x = 52, y = 3` | a three-step stair | `…/block-grass.glb` | `solid` |
| `x ∈ [92..92]`, `y ∈ [0..3]` | the secret wall, 4 cells high | `…/block-grass.glb` | `solid` |
| `x = 22`, `y = 4` | ceiling alcove | `…/block-grass.glb` (bump block) | `solid` |
| `x = 30`, `y = 4` | hidden cell | *(no mesh — invisible)* | `solid` |
| `x = 93`, `y = 4` | hidden cell behind the wall | *(no mesh — invisible)* | `solid` |
| `x = 60, y = 3` · `x = 62, y = 3` | optional high route over the long gap | `…/platform.glb` | `solid`, **one-way** |
| `x = 66, y = 0` · `x = 67, y = 0` | floor spikes | `…/trap-spikes.glb` | `hazard` |
| `x = 107, y = 1` | the oscillating platform's home | `…/platform.glb` | `solid` |

**Floor gaps.** `x ∈ [13..14]` and `x ∈ [59..63]` and `x ∈ [105..110]` have **no** floor
cell. Beneath them the stage's `vol_kill_floor` volume (`y ∈ [-4,0]`) triggers the pit
death. The gap widths are `TUNE` 2 m, 5 m and 6 m, sized against the **conservative**
reachability bounds — **horizontal ≤ 5.43 m** (the smallest `2 × time_to_apex × run_speed`
across the four profiles) and **vertical ≤ 2.43 m** (the lowest profile apex, Sable):

| Gap | Width | Against the 5.43 m conservative clearance | Result |
|---|---|---|---|
| `x ∈ [13..14]` | 2 m | 2 m ≤ 5.43 m | cleared by a running jump on **every** profile |
| `x ∈ [59..63]` | 5 m | 5 m ≤ 5.43 m | cleared by a running jump on **every** profile, with 0.43 m of margin |
| `x ∈ [105..110]` | 6 m | 6 m > 5.43 m | **not** cleared by any profile — it requires the oscillating platform or the one-way route, which is the intended lesson |

(The per-profile apex and run-speed figures are in `DESIGN-3-PLAYER.md` §4.1; the model is
`TUNE-003` / `TUNE-P-018`. `TUNE-009` is the **maximum** run speed across the four profiles
(7.5 m/s, Sable) — it is **not** the base speed, and the conservative clearance above uses
**Brindle's 5.4 m/s**, which is the smallest `2 × t_apex × run_speed` of the four.)

**Objects** (the `objects[]` rows):

| id | Kind / archetype | Position | Notes |
|---|---|---|---|
| `obj_sign_move` | `object.sign_post` | `[2, 0, 6]` | `text_key: "tut.move_01"`, `facing: 1` |
| `obj_coin_a` | `object.coin_bronze` | `[8, 1, 6]` | the first collectable |
| `obj_bump_coin` | `block.bump_coin` | `[22, 4, 6]` | one coin, hit from below |
| `obj_hidden_silver` | `item.coin_silver` | `[30, 4, 6]` | **inside** the invisible cell; `hidden: true` until the cell is revealed |
| `obj_platform_a` | `platform.one_way` | `[60, 3, 6]` | optional high route |
| `obj_platform_b` | `platform.one_way` | `[62, 3, 6]` | optional high route |
| `obj_spikes_a` | `hazard.spike_trap` | `[66, 0, 6]` | floor spikes |
| `obj_spikes_b` | `hazard.spike_trap` | `[67, 0, 6]` | floor spikes |
| `obj_hidden_key` | `object.key_brass` | `[97, 1, 6]` | behind the secret wall |
| `obj_oscillator` | `platform.oscillate` | `[107, 1, 6]` | path `[105,1,6] → [110,1,6]`, `TUNE 0.5 Hz` |
| `obj_flag` | `object.flag_marker` | `[118, 0, 6]` | the goal marker; the goal volume is `vol_goal` |
| `obj_secret_block` | `block.invisible` | `[93, 4, 6]` | the hidden cell that reveals the wall |

**Actors.** `act_walker_a` (`enemy.ground_walker`) at `[44, 1, 6]` facing −1, placed.
`act_walker_b` (`enemy.ground_walker`) at `[82, 1, 6]` facing −1, spawned by
`tr_spawn_walker_b` when the camera reaches `x ≥ 74`.

**Triggers.** `tr_spawn_walker_b` (type `spawn`, aabb `x ∈ [74,80]`) and eight `tutorial`
triggers. The eight tutorial cues, in order:

| # | Trigger id | Trigger x-range | Text key | Cue |
|---|---|---|---|---|
| 1 | `tr_tut_move` | 0–6 | `tut.move_01` | "Move with ⟨move⟩. Hold ⟨run⟩ to sprint." |
| 2 | `tr_tut_jump` | 12–16 | `tut.jump_01` | "Press ⟨jump⟩ to hop. Hold it to jump higher." |
| 3 | `tr_tut_block` | 20–24 | `tut.block_01` | "Some blocks react when struck from below." |
| 4 | `tr_tut_hidden` | 28–32 | `tut.hidden_01` | "Some things are only there when you look closely." |
| 5 | `tr_tut_enemy` | 40–46 | `tut.enemy_01` | "Land on a crawler's head to defeat it." |
| 6 | `tr_tut_checkpoint` | 45–47 | `tut.checkpoint_01` | "The lantern marks your place." |
| 7 | `tr_tut_secret` | 90–94 | `tut.secret_01` | "Something is behind this wall." |
| 8 | `tr_tut_exit` | 112–116 | `tut.exit_01` | "Reach the banner to finish." |

Every tutorial trigger has `once: true` and **`blocking: false`**. A tutorial is a prompt,
never a gate: the player can skip it, and the game never waits on it.

**Portal volumes.** `pv_secret_a` (`kind: "warp"`, aabb `x ∈ [98,100], z ∈ [5.2,6.8]`,
destination `region01_bonus01`, `return_portal: "pv_secret_a"`) — behind the secret wall,
so it is only reachable after the hidden cell at `x = 93` is struck and the wall opens.

**The secret is a two-step.** The invisible cell at `[93, 4, 6]` is the *only* thing that
opens the wall at `x = 92`. The `key_brass` at `[97, 1, 6]` is **behind** the wall. The
stage's `hidden` exit requires `key_brass`, so the player must (a) find the hidden cell and
(b) walk through the wall to get the key. Neither step alone opens the bonus chamber.

**Checkpoints.** `cp01` at `[46, 1, 6]`, `captures: ["transient_power_state", "coin_count"]`.
A death after `cp01` returns the player to `[46, 1, 6]`, **not** to the stage start, and
does **not** re-award the coin collected before it (`REQ-B-005`).

**Acceptance tests for the Gate 1 stage.**

- **AC-G1-1 (teachability).** A playtester who has never seen the game can move, jump,
  defeat a crawler and reach the goal using **only** in-world cues and no external guide.
  *Fails if:* the playtester asks a human what any control does, or exits the stage without
  reaching the goal.
- **AC-G1-2 (once only).** Each of the eight tutorial triggers fires **exactly once** across
  a full playthrough, and none fires again after a death (`REQ-D-019`).
- **AC-G1-3 (skippable).** With all tutorials suppressed by the debug flag, the stage is
  still 100 % completable; no tutorial trigger's volume overlaps a mandatory target
  (`LINT-032` enforces this statically).
- **AC-G1-4 (lint clean).** `python3 src/tools/level_linter.py src/content/stages/region01_stage01.stage.json`
  exits 0 with **zero** errors. The only permitted output is the `LINT-021` *warning* for
  the intentionally hidden warp `pv_secret_a`.
- **AC-G1-5 (graph).** `region01_stage01` is reachable from `region01_hub`, its `normal`
  exit resolves to `region01_stage02`, and its `hidden` exit resolves to `region01_bonus01`
  with `requires: ["key_brass"]`.
- **AC-G1-6 (bounds).** Over a 10 000-tick scripted run the camera frustum corners never
  leave `bounds` (`REQ-B-003`).
- **AC-G1-7 (pit).** Falling into either of the first two gaps triggers the pit-death
  volume and returns the player to `cp01` (or the stage spawn if before `cp01`) — never to
  a position inside geometry.

**The contrast case — `region01_stage02` "Hollowbough Rise".** The same schema, one step
more demanding: `bounds = {min:[0,0,0], max:[140,32,12]}`, `variant: "overworld"`, one-way
platforms at `y = 4, 8, 12` in three columns, a `platform.oscillate` lift at `x = 90`, a
`climbing` ladder volume (`portal.ladder_long`, `W-05`) from `y = 0` to `y = 12`, and a
top platform at `y = 22` holding `key_brass` for the stage-2 secret exit to
`region01_bonus02`. Camera zone `cz_climb` has `deadzone [6,3]` — **the same single
authored rectangle as every other zone** (architecture `TUNE-010`, player board §9.1). The
anti-jerk behaviour on climbs comes from the **soft vertical follow rate**, not from a wider
band: the contract forbids widening the rectangle, and a second dead-zone value would make
the camera's behaviour depend on which zone file a stage happened to use.

---

## 3. REQ-D-001 — the collision-material taxonomy in 3D

### 3.1 The rule

> **The collision material drives friction, acceleration, sound and particles — never the
> mesh.** (3D contract §1.1)

A placement's `collision.material` and its `asset_id` are **independent**. Swapping
`block-grass.glb` for `block-snow.glb` changes nothing about behaviour; swapping
`material: "ice"` onto a grass block changes everything. `REQ-D-001`'s acceptance test is
exactly this independence.

### 3.2 The two vocabularies, joined

The master document names nine **tile materials** (`solid, breakable, bumpable, invisible,
one_way, slope, hurt, liquid, decorative`). The 3D contract names nine **collision
materials** (`solid, ice, mud, quicksand, conveyor, bouncy, slippery_grunt, grate, hazard`).
They are different axes and the join table below is the normative one.

| Tile material (master) | Collision material (3D contract) | Behaviour | Canonical asset |
|---|---|---|---|
| `solid` | `solid` | friction 1.0, accel 1.0 | `shorepine-kenney/3d/platformer/block-grass.glb` |
| `solid` | `ice` | friction 0.02, accel 0.25 — long slide | `shorepine-kenney/3d/platformer/block-snow-low.glb` |
| `solid` | `mud` | friction 2.2, accel 0.6 — sinks | `shorepine-kenney/3d/platformer/block-grass-low.glb` |
| `solid` | `quicksand` | friction 3.0, accel 0.4 — sink volume, slow ascent | `shorepine-kenney/3d/platformer/block-snow-overhang-low.glb` |
| `solid` | `conveyor` | adds `conveyor_speed` surface velocity | `shorepine-kenney/3d/platformer/conveyor-belt.glb` |
| `solid` | `bouncy` | adds a launch impulse on contact | `shorepine-kenney/3d/platformer/spring.glb` |
| `solid` | `slippery_grunt` | friction 0.35, accel 0.8 | `shorepine-kenney/3d/platformer/block-grass-overhang-low.glb` |
| `solid` | `grate` | does **not** trigger the pit-death check | `shorepine-kenney/3d/platformer/platform-fortified.glb` |
| `breakable` | `solid` | collides; destroyed by `damage_permissions.breakable` | `shorepine-kenney/3d/platformer/crate.glb` |
| `bumpable` | `solid` | collides; hit from below emits one payload | `shorepine-kenney/3d/platformer/block-grass.glb` |
| `invisible` | `solid` | collides, renders nothing, `states.idle.visual == null` | *(no mesh — the visual is `null`)* |
| `one_way` | `solid` | single permitted normal `+Y`; jump-through on crouch | `shorepine-kenney/3d/platformer/platform.glb` |
| `slope` | `solid` | rotated box collider; angle is a property of the asset | `shorepine-kenney/3d/platformer/block-grass-large-slope.glb` |
| `hurt` | `hazard` | collision enabled; emits the unified hazard event | `shorepine-kenney/3d/platformer/trap-spikes.glb` |
| `liquid` | `solid` | the liquid itself is a **volume**, not a tile | `shorepine-kenney/3d/platformer/block-snow-low.glb` (bedding) |
| `decorative` | *(none)* | no collider at all | any `props[]` entry |

**Rule:** a `breakable`, `bumpable`, `invisible`, `one_way`, `slope`, `hurt` or `decorative`
placement may **not** carry `ice`, `mud`, `quicksand`, `conveyor`, `bouncy`, `slippery_grunt`
or `grate`. Those eight are surface *modifiers* and belong to `solid` placements only.
`LINT-011` enforces it.

### 3.3 The material profile table (authored values, `TUNE`)

These are **our** values, matching 3D contract §1.1. They are authored here because this
board assigns them per placement; the numbers themselves are the contract's.

Every cue below names a **row in the asset manifest** (`DESIGN-3-ASSETS.md` §8–§9), and
every manifest row names a real file. A cue with no shipped file is marked **SILENT** and
carries a named gap — it is never a placeholder and never an invented sound.

| Material | Ground friction | Ground accel | Extra | Sound family (manifest row) | Particle family (manifest row) |
|---|---|---|---|---|---|
| `solid` | 1.0 | 1.0 | — | `AU-014` / `AU-018` — footstep, stone | `FX-001` — skid dust / landing puff |
| `ice` | 0.02 | 0.25 | slide persists `TUNE 0.9 s` after input release | `AU-013` / `AU-017` — footstep, sand | `FX-007` — environmental particle mask |
| `mud` | 2.2 | 0.6 | sink `TUNE 0.6 m/s` while grounded | `AU-013` / `AU-017` — footstep, sand | `FX-007` — environmental particle mask |
| `quicksand` | 3.0 | 0.4 | ascent × 0.35 | `AU-013` / `AU-017` — footstep, sand | `FX-007` — environmental particle mask |
| `conveyor` | 1.0 | 1.0 | `conveyor_speed` `TUNE 2.0 m/s` along `surface_axis` | **SILENT** — no conveyor loop exists in the corpus. The belt's motion is read visually from the animated `platformer/conveyor-belt.glb`. Gap `GAP-AUD-05`. | `FX-001` — skid dust / landing puff |
| `bouncy` | 1.0 | 1.0 | launch impulse `TUNE 9.5 m/s` | `AU-001` — jump variants, used as the launch cue | `FX-005` — concentric ring mask |
| `slippery_grunt` | 0.35 | 0.8 | — | `AU-013` / `AU-017` — footstep, sand | `FX-001` — skid dust / landing puff |
| `grate` | 1.0 | 1.0 | pit-death check suppressed | `AU-016` / `AU-018` — footstep, stone (the nearest shipped material; **no metal footstep exists** — gap `GAP-AUD-06`) | `FX-002` — item emergence / explosion burst |
| `hazard` | 1.0 | 1.0 | emits `DamageEvent{damage_type: environment}` | `AU-003` — player hurt variants (the nearest shipped cue; **no dedicated hazard sound exists** — gap `GAP-AUD-07`) | `FX-008` — hazard warning mask |

> **Reconciled 2026-10-30** from the Cursor senior review. The previous table used
> free-form cue ids (`sfx.step_stone`, `fx.dust_puff`, `sfx.conveyor_loop`,
> `sfx.step_metal`, `sfx.hazard`, `fx.spray_snow`, `fx.splash_mud`, `fx.spring_ring`,
> `fx.spark_ground`, `fx.hazard_puff`) that named no manifest row and therefore no file.
> Every cue now names its manifest row and its real file, and the three that have no
> shipped file are marked **SILENT** with a named gap.

### 3.4 Acceptance tests for REQ-D-001

- **AC-D001-1 (independence).** For each of the nine collision materials, a stage is authored
  twice with the **same** placements and the **same** `collision.material`, but the second
  copy replaces the mesh of every placement with a different manifest asset. The recorded
  trajectory of the player over 1 800 ticks is **byte-identical** between the two runs.
  *Fails if:* any tick differs.
- **AC-D001-2 (distinguishable travel).** The same 1 000-tick input trace on `solid`, `ice`,
  `mud`, `quicksand`, `conveyor` and `slippery_grunt` produces six **pairwise distinct**
  final X positions, with a minimum spread of `TUNE 2.0 m` between the fastest and slowest.
  *Fails if:* any two final positions are within 0.5 m.
- **AC-D001-3 (art-independence).** `LINT-011` rejects any placement whose
  `collision.material` is outside the join table in §3.2.

---

## 4. The eight regions

### 4.0 Design frame

Every region teaches **one** mechanic family that the previous regions have prepared, and
every region is authored from scratch. Region names, mechanic lessons, layouts, boss designs
and secret routes are original to this game. No reference-game stage, name, layout, music or
dialogue is used or referenced in shipped content (3D contract §6).

Each region below specifies: **original name**, theme, biome set (the `variant` values it
uses), stage list, boss, secret route, palette set, music cue, and the REQs it exercises.

**Music cue policy (applies to all eight).** Every region names a cue id. Every cue id
resolves through the cue registry to an `UNSOURCED` marker because the corpus contains
**zero music files** (`GAP-A1`, §7.6, §11). The cue id is nevertheless authored, registered
and lint-checked, so that a commissioned or licensed track drops into a slot that already
exists and is already wired to a region. **No region ships a placeholder track.**

---

### 4.1 Region 1 — **Verdance Reach**

**Theme.** A sunlit valley of low aqueduct walls and tall grass, the last farmland before
the land tips down into the dune sea. Wide sightlines, low ceilings, gentle slopes. The
teaching region: nothing here can kill a first-time player who only walks.

**Biome set (variants).** `overworld`, `underground`.
**Palette set.** `meadow_day` (default), `meadow_dusk` (stage 5 and the boss approach),
`meadow_storm` (secret chamber).
**Music cues.** `music.region01.overworld`, `music.region01.boss`, `music.region01.bonus`.
**Biome kit.** Kenney `platformer` terrain vocabulary, `nature` (`tree_palmTall.glb`,
`ground_riverEnd.glb`), `mini-forest` (`tree-high.glb`, `flag.glb`), `polypizza-stylized-nature`
(`Tree-aVOxaHRPWe.glb`, `Bush.glb`, `Grass.glb`, `Flower Group.glb`).

| Stage id | Name | Variant | Mechanic lesson | Difficulty | Length `TUNE` |
|---|---|---|---|---|---|
| `region01_stage01` | First Light | `overworld` | Move, run, variable jump; the camera and the lane | `intro` | 120 m |
| `region01_stage02` | Hollowbough Rise | `overworld` | Verticality: one-way platforms, climb-up-then-drop | `gentle` | 140 m |
| `region01_stage03` | Stonecap Hollow | `underground` | Hidden objects: invisible blocks, bump blocks, secret chambers | `standard` | 150 m |
| `region01_stage04` | Thornwake Ford | `overworld` | Basic enemies, stomping, hazard awareness | `standard` | 160 m |
| `region01_stage05` | Verdance Gate | `overworld` | Combination; the region exit | `standard` | 180 m |
| `region01_boss01` | Moss Warden | `fortress` | Boss framework: arena, phases, vulnerability window | `standard` | 60 m arena |
| `region01_bonus01` | The Long Drain | `underground` | Reward chamber: a timed coin run | `gentle` | 90 m |

**Boss — the Moss Warden.** A hedge-and-stone siege construct built from
`kenney.platformer.hedge`, `kenney.platformer.stones`, `kenney.platformer.tree` and
`kenney.graveyard.crypt-a` (the core). Three phases:
1. *Bulwark* — it raises a hedge wall in front of itself; the wall is hazard while falling,
   solid while raised. The core is only exposed when the wall drops.
2. *Spore* — it sheds spore puffs along the floor; the player must jump the gaps.
3. *Rootburst* — the arena floor splits into two moving root platforms that carry the
   player over a hazard band.
Vulnerability window: the core is open for `TUNE 1.4 s` after each bulwark drop.
Reward: `item.growth_cap` (power state) + `flag.region01_boss01`.

**Secret routes.** Two.
- *Stage 3* — a `block.bump_invisible` at the third ceiling alcove reveals a warp to
  `region01_bonus01`; the secret exit additionally requires `key_brass`, which sits behind
  the same wall, so the chamber is a **two-step** secret, not a single press.
- *Stage 5* — a `platform.platform-overhang` ledge at height 14 m holds the **second key**
  (`key_iron`). A secret exit from stage 5 to `region01_bonus02` requires it.

**REQs exercised.** `REQ-B-001`, `REQ-B-004`, `REQ-B-005`, `REQ-B-007`, `REQ-B-008`,
`REQ-B-011`, `REQ-B-016`, `REQ-B-017`, `REQ-B-020`; `REQ-D-001`, `REQ-D-002`,
`REQ-D-006`, `REQ-D-007`, `REQ-D-011`, `REQ-D-012`, `REQ-D-016`, `REQ-D-017`,
`REQ-D-019`.

---

### 4.2 Region 2 — **Sirocco Vaults**

**Theme.** A stepwell-temple buried under a dune sea. The wind never stops; the sand has
found its way into every chamber and keeps finding its way back. Vertical, breathy,
unstable.

**Biome set (variants).** `desert`, `underground`.
**Palette set.** `sirocco_noon` (harsh white-gold), `sirocco_dusk` (amber over blue shade),
`sirocco_storm` (ochre over bruised violet).
**Music cues.** `music.region02.desert`, `music.region02.boss`, `music.region02.bonus`.
**Biome kit.** Kenney `platformer` (sand-toned placements), `pirate` (`pirate/patch-sand.glb`,
`structure-fence.glb`), `hexagon` (`unit-wall-tower.glb`), `retro-fantasy`
(`wall-fortified-door.glb`, `battlement.glb`), `castle` (`wall-narrow-gate.glb`).

| Stage id | Name | Variant | Mechanic lesson | Difficulty | Length `TUNE` |
|---|---|---|---|---|---|
| `region02_stage01` | The Mouth of the Vault | `desert` | **Wind** volumes: gust direction is readable from the banners | `gentle` | 160 m |
| `region02_stage02` | Duskglass Dig | `underground` | **Sinking**: quicksand and mud; the player chooses weight over speed | `standard` | 170 m |
| `region02_stage03` | Counterweight Vault | `underground` | **Moving platforms**: oscillate, fall-away, seesaw | `standard` | 180 m |
| `region02_stage04` | Lantern Circuit | `underground` | **Switches**: a timed world-state switch that opens a route only while lit | `demanding` | 170 m |
| `region02_stage05` | Vault of Glass | `desert` | Combination; wind + sink + switch; region exit | `demanding` | 190 m |
| `region02_boss01` | Sandglass Warden | `fortress` | Boss: a rolling, segmented construct | `demanding` | 70 m arena |
| `region02_bonus01` | The Unlit Stair | `underground` | Reward chamber | `standard` | 100 m |

**Boss — the Sandglass Warden.** A three-segment wheel of `kenney.platformer.crate` and
`kenney.platformer.stones` that sheds one segment per phase; each shed segment becomes a
rolling hazard. Phase 2 introduces a sand updraught that lifts the player; phase 3
requires a thrown segment (the `carry_throw` ruleset) to break the hub. Vulnerability
window: `TUNE 1.0 s` after a segment is shed, on the exposed hub.

**Secret route.** `region02_stage04` holds a `object.button-round` that starts a
`TUNE 12 s` lantern timer. While the timer runs, the wall of `block-grass-low` blocks at
x = 96 converts to `block-grass` and the secret exit opens. When the timer expires the
wall returns — **with the player possibly inside it**; `REQ-D-008` forbids trapping or
killing the player, so the expiry pushes the player out along the wall normal. The secret
exit leads to `region02_bonus01`.

**REQs exercised.** `REQ-B-009`, `REQ-B-011`, `REQ-B-015`, `REQ-B-014`;
`REQ-D-001`, `REQ-D-008`, `REQ-D-009`, `REQ-D-012`, `REQ-D-017`;
plus the wind behaviour of the 3D contract §2.8.

---

### 4.3 Region 3 — **Tidereach Shoals**

**Theme.** A reef market drowned at low tide. Half the region is walkable sand with tide
pools; half is open water with a drowned lane of lanterns.

**Biome set (variants).** `underwater`, `overworld` (the coast), `underground` (the
cistern).
**Palette set.** `tidereach_shallow` (cyan over pale sand), `tidereach_deep` (indigo,
low light, heavy fog), `tidereach_dusk` (the coast at evening).
**Music cues.** `music.region03.underwater`, `music.region03.boss`, `music.region03.bonus`.
**Biome kit.** Kenney `platformer` (coral-toned), `hexagon` (`building-watermill.glb`,
`river-start.glb`), `nature` (`ground_riverEnd.glb`), `watercraft` kit, `mini-forest`
(`building-roof.glb` as the reef market stalls).

| Stage id | Name | Variant | Mechanic lesson | Difficulty | Length `TUNE` |
|---|---|---|---|---|---|
| `region03_stage01` | Shoal Shallows | `underwater` | **Swim**: stroke, surface exit, different movement curve | `gentle` | 150 m |
| `region03_stage02` | Undertow Shelf | `underwater` | **Currents**: a directional field inside the water volume | `standard` | 160 m |
| `region03_stage03` | The Kelp Shaft | `underwater` | **Vertical movement**: ascent and descent under drag | `standard` | 120 m tall |
| `region03_stage04` | Reef Lanterns | `overworld` | **Aquatic hazards**; surface entry and exit | `standard` | 170 m |
| `region03_stage05` | Tideward Gate | `overworld` | Combination; region exit | `demanding` | 180 m |
| `region03_boss01` | The Tidewarden | `underwater` | Boss: a patrolling leviathan-shaped hull | `demanding` | 80 m arena |
| `region03_bonus01` | The Drained Cistern | `underground` | Reward chamber; reachable only at low tide | `standard` | 100 m |

**Boss — the Tidewarden.** A slow hull-leviathan of `kenney.platformer.boat-row` (pirate
kit `boat-row-small.glb`) and `kenney.platformer.hedge`. It patrols the arena, drags a
current behind it, and periodically stalls and opens a gill hatch. Vulnerability window:
the hatch, `TUNE 1.6 s`, reachable only by entering the current and riding it up to the
hull.

**Secret route.** `region03_bonus01` is entered through a drained cistern whose sump door
opens on a **tide timer** (`TUNE 25 s` window, restarting on a 60 s cycle). The window is
authored as a `object.button-round` on a `world_map_suits`-era switch flag plus a
`triggers[]` timer; the door asset is `kenney.modular-dungeon.gate-door`.

**REQs exercised.** `REQ-B-010`, `REQ-B-013`, `REQ-B-018`;
`REQ-D-001`, `REQ-D-012`, `REQ-D-016`, `REQ-D-017`;
plus water volumes and the swim curve of the 3D contract §2.7.

---

### 4.4 Region 4 — **Titanroot Canopy**

**Theme.** Old-growth forest at human scale. The player is small; the trees are not. The
region's lesson is that **scale is a level-design tool**, not a costume.

**Biome set (variants).** `giant`, `forest`.
**Palette set.** `titanroot_dawn` (green-gold shafts), `titanroot_deep` (blue-green
shade), `titanroot_dusk` (amber canopy).
**Music cues.** `music.region04.forest`, `music.region04.boss`, `music.region04.bonus`.
**Biome kit.** Kenney `mini-forest` (`tree-high.glb`, `building-roof.glb`),
`nature` (`tree_pineDefaultB.glb`, `rock_tallH.glb`, `cliff_cornerInner_rock.glb`),
`polypizza-stylized-nature` (`Twisted Tree-7PDBpElkQr.glb`, `Dead Tree.glb`),
`cc0tree` (24 trees), `avramania-nature-terrain` (`mdvl_nature_*`, 41 models).

| Stage id | Name | Variant | Mechanic lesson | Difficulty | Length `TUNE` |
|---|---|---|---|---|---|
| `region04_stage01` | Underleaf | `giant` | **Scale variants**: two playable height bands, `big` and `small` | `standard` | 160 m |
| `region04_stage02` | Boughhaul | `forest` | **Carry and throw**: weight classes, throw chains | `standard` | 170 m |
| `region04_stage03` | Rootcause | `forest` | **Alternate routes**: two ways to the same exit, one shorter one richer | `standard` | 180 m |
| `region04_stage04` | Canopy Crossing | `giant` | Combination; carry + scale | `demanding` | 180 m |
| `region04_stage05` | Canopy Gate | `giant` | Region exit | `demanding` | 190 m |
| `region04_boss01` | Heartwood Colossus | `forest` | Boss: a walking trunk with a weak knot | `demanding` | 80 m arena |
| `region04_bonus01` | The Root Cellar | `underground` | Reward chamber | `standard` | 100 m |

**Boss — the Heartwood Colossus.** A `giant`-scale actor built from `nature` trees and
`platformer/block-grass-large`. It stamps; the stamp shockwave is a hazard band; between
stamps it is vulnerable at the knot (`TUNE 1.2 s`). Thrown crates (carry/throw ruleset)
latch into the knot and force a stagger.

**Secret route.** `region04_stage03` forks. The **long route** is a root cellar to
`region04_bonus01` and holds `key_heart`. The **short route** skips it. `region04_stage05`
has a secret exit that requires `key_heart`, so the reward chamber is optional but the
region's second exit is not.

**REQs exercised.** `REQ-B-009`, `REQ-B-014`, `REQ-B-018`;
`REQ-D-009` (weight-sensitive platforms), `REQ-D-001`;
plus carry/throw of the 3D contract §2.10.

---

### 4.5 Region 5 — **Cirrus Spine**

**Theme.** A chain of floating stone vertebrae above an unbroken cloud sea. Everything is
a fall. The region teaches **commitment**: charge, then commit, then recover.

**Biome set (variants).** `sky`.
**Palette set.** `cirrus_noon` (white cloud, cyan sky), `cirrus_gold` (low sun),
`cirrus_violet` (high altitude, purple shadow).
**Music cues.** `music.region05.sky`, `music.region05.boss`, `music.region05.bonus`.
**Biome kit.** Kenney `platformer` (`platform.glb`, `platform-overhang.glb`,
`block-grass-overhang-hexagon.glb`), `hexagon` (`unit-wall-tower.glb`), `space`
(`platform_side.glb`), `space-station` kit.

| Stage id | Name | Variant | Mechanic lesson | Difficulty | Length `TUNE` |
|---|---|---|---|---|---|
| `region05_stage01` | First Ascent | `sky` | **Charge-glide**: charge, take off, glide, recover | `standard` | 170 m |
| `region05_stage02` | Driftstones | `sky` | **Floating platforms**: platforms that bob and carry | `standard` | 180 m |
| `region05_stage03` | Updraught Spire | `sky` | **Wind + glide** combined; wind is the assist and the threat | `demanding` | 180 m |
| `region05_stage04` | Cirrus Crossing | `sky` | Combination; long chain of glides | `demanding` | 200 m |
| `region05_stage05` | Spire Gate | `sky` | Region exit | `severe` | 190 m |
| `region05_boss01` | Cirrus Sentinel | `sky` | Boss: a hovering construct that cuts the air | `severe` | 90 m arena |
| `region05_bonus01` | The Underside | `sky` | Reward chamber, below the lowest vertebra | `standard` | 90 m |

**Boss — the Cirrus Sentinel.** A hovering ring of `space` kit parts with a rotating blade
arm. It cuts the air: crossing its blade line while it is charged is a hazard. The
vulnerability is the hub, exposed for `TUNE 1.3 s` after it completes a charge-and-cut
cycle; the player must be gliding to reach it.

**Secret route.** `region05_bonus01` sits **below** the lowest vertebra and is reachable
only by a committed dive from the stage-3 landing — the one route in the game where the
player must deliberately give up height.

**REQs exercised.** `REQ-B-013`, `REQ-B-014`;
`REQ-D-009` (rideable flyer), `REQ-D-012` (wind hazard), `REQ-D-016`;
plus the glide state diagram of the 3D contract §2.9.

---

### 4.6 Region 6 — **Palehush Hollow**

**Theme.** A frozen memorial garden. Flat light, no shadows to read, and a lantern maze
that remembers which way you were looking.

**Biome set (variants).** `ice`, `ghost_house`, `forest`.
**Palette set.** `palehush_dusk` (blue-violet), `palehush_blue` (near-monochrome),
`palehush_storm` (white-out, the low-visibility stages).
**Music cues.** `music.region06.ghost`, `music.region06.boss`, `music.region06.bonus`.
**Biome kit.** Kenney `platformer` (`block-snow*` family, `tree-snow.glb`),
`graveyard` (`crypt-a.glb`, `crypt-small-roof.glb`, `character-ghost.glb`, `hay-bale.glb`,
`pillar-large.glb`), KayKit Halloween (`kaykit-halloween/.../gltf/grave_B.gltf`,
`crypt.gltf`, `coffin_decorated.gltf`, `arch_gate.gltf`, `candle_thin.gltf`, `skull.gltf`,
`bone_C.gltf`), `hexagon` kit.

| Stage id | Name | Variant | Mechanic lesson | Difficulty | Length `TUNE` |
|---|---|---|---|---|---|
| `region06_stage01` | Hoarfall | `ice` | **Friction**: ice slides, and the player learns to brake | `standard` | 160 m |
| `region06_stage02` | Whiteout | `ghost_house` | **Visibility**: the palette and the fog range narrow | `standard` | 160 m |
| `region06_stage03` | The Chasing Dark | `ghost_house` | **Chasing ghosts**: a pursuer that moves when unobserved | `demanding` | 180 m |
| `region06_stage04` | Lantern Labyrinth | `ghost_house` | **Maze**: doors, keys and a route that must be solved | `demanding` | 200 m |
| `region06_stage05` | Hollow Gate | `forest` | Combination; region exit | `severe` | 190 m |
| `region06_boss01` | The Hollow Choir | `ghost_house` | Boss: three pursuers in sequence | `severe` | 90 m arena |
| `region06_bonus01` | The Unlit Cell | `ghost_house` | Reward chamber | `standard` | 90 m |

**Boss — the Hollow Choir.** Three `graveyard/character-ghost.glb` actors that take turns:
each freezes when faced and advances when the player turns away (3D contract §6's
silhouette-separation rule is satisfied by using a different rig family from every other
region). The player must break line of sight deliberately — the "hide behind a pillar"
loop. All three must be dispersed; they do not respawn.

**Secret route.** The lantern maze's unlit cell (`region06_bonus01`) is sealed by a
`object.lock` that requires `key_lantern`, obtainable only by letting the third ghost
pass over a `object.chest` it cannot see.

**REQs exercised.** `REQ-B-009`, `REQ-B-011`, `REQ-B-020`;
`REQ-D-001` (ice), `REQ-D-011`, `REQ-D-017`, `REQ-D-018`, `REQ-D-020` (reduced flashing,
distinct non-colour cues for the ghost state);
plus the visibility and accessibility content rules of §8.5.

---

### 4.7 Region 7 — **Cinderforge Keep**

**Theme.** A foundry-fortress where the traps still run on rails nobody has oiled in a
century. Item scarcity becomes item management.

**Biome set (variants).** `fortress`, `castle`, `lava`, `underground`.
**Palette set.** `cinderforge_ember` (orange on charcoal), `cinderforge_steel` (blue-grey),
`cinderforge_ash` (grey, post-collapse).
**Music cues.** `music.region07.fortress`, `music.region07.boss`, `music.region07.bonus`.
**Biome kit.** Kenney `factory` (`pipe-large-long.glb`, `door-wide-closed.glb`,
`warning-traffic.glb`), `modular-dungeon` (`corridor.glb`, `gate-door.glb`),
`modular-buildings` (`roof-flat-corner.glb`), `retro-fantasy` (`battlement.glb`),
`mini-dungeon` (`trap.glb`), KayKit Dungeon Remastered (`wall_half.gltf.glb`,
`floor_foundation_allsides.gltf.glb`, `stairs_wood.gltf.glb`, `barrel_large.gltf.glb`),
`hexagon` (`building-watermill.glb` reused as a slag wheel).

| Stage id | Name | Variant | Mechanic lesson | Difficulty | Length `TUNE` |
|---|---|---|---|---|---|
| `region07_stage01` | Slagworks | `fortress` | **Complex traps**: saw, spike, crusher and conveyor in sequence | `demanding` | 180 m |
| `region07_stage02` | Crucible Run | `lava` | **Item management**: limited carries, timed hazards | `demanding` | 190 m |
| `region07_stage03` | Chainvault | `underground` | **Boss sequence**: a mid-boss guarding the vault | `severe` | 140 m |
| `region07_stage04` | Ashfall | `fortress` | Combination; falling ash as a timed hazard | `severe` | 190 m |
| `region07_stage05` | Keep Gate | `castle` | Region exit | `severe` | 200 m |
| `region07_boss01` | The Forge Marshal | `fortress` | Boss: a furnace construct with three hazards | `severe` | 90 m arena |
| `region07_bonus01` | The Slag Chute | `lava` | Reward chamber | `demanding` | 100 m |

**Boss — the Forge Marshal.** A `factory`-kit construct (`pipe-large-long.glb` torso,
`warning-traffic.glb` arms). Phase 1: slag jets from the arms on a cycle. Phase 2: the
arena splits and a conveyor carries the player into a saw. Phase 3: the core opens for
`TUNE 1.1 s` between slag bursts. It is a **switch-triggered** boss in phase 2: pulling
`object.lever` cuts the slag feed, which is the *alternative* defeat path of `REQ-C-017`.

**Secret route.** `region07_bonus01` sits at the bottom of the slag chute, entered only by
surviving the crusher corridor with no carried item — the chute's gate closes if anything
is in the player's carry slot.

**REQs exercised.** `REQ-B-011`, `REQ-B-014`, `REQ-B-016`, `REQ-B-019`;
`REQ-D-001`, `REQ-D-008`, `REQ-D-011`, `REQ-D-012`, `REQ-D-015`, `REQ-D-016`;
plus the hazard unification of the 3D contract §3.

---

### 4.8 Region 8 — **Stormwrack Apex**

**Theme.** An airship convoy caught in a standing storm. The camera takes the wheel.

**Biome set (variants).** `airship`, `sky`, `lava`.
**Palette set.** `stormwrack_gale` (grey-blue, rain streaks), `stormwrack_eye` (dark
violet, the calm centre), `stormwrack_apex` (black with lightning flashes — see the
accessibility rule in §8.5).
**Music cues.** `music.region08.storm`, `music.region08.boss`, `music.region08.finale`.
**Biome kit.** Kenney `space` (`platform_side.glb`, `pipe_rampSmall.glb`),
`modular-space` (`corridor-wide-end.glb`, `gate-door.glb`, `template-floor.glb`),
`space-station` kit, `factory` kit, `hexagon` (`building-watermill.glb` as the convoy
ballast), `polypizza-stylized-nature` (`Dead Tree.glb` as the storm-torn treeline).

| Stage id | Name | Variant | Mechanic lesson | Difficulty | Length `TUNE` |
|---|---|---|---|---|---|
| `region08_stage01` | Squall Line | `airship` | **Autoscroll**: the camera advances; spawns are camera-relative | `severe` | 240 m scroll |
| `region08_stage02` | Galehold | `airship` | Combination: carry + glide in a scrolling frame | `severe` | 240 m scroll |
| `region08_stage03` | Lightning Spine | `sky` | Hazards: strikes, gusts and edge falls | `severe` | 200 m |
| `region08_stage04` | Eye of the Squall | `airship` | **Multi-phase**: three phases in one arena | `severe` | 240 m scroll |
| `region08_stage05` | Apex Gate | `sky` | Every mechanic, in one ascent | `finale` | 220 m |
| `region08_boss01` | The Apex Storm | `airship` | Final boss: a moving-airship boss with three phases | `finale` | 120 m arena |
| `region08_finale` | Stormwrack Ascension | `airship` | **The finale**: the convoy reaches the eye; a choice is offered | `finale` | 160 m |
| `region08_bonus01` | The Hold | `airship` | Reward chamber | `severe` | 90 m |

**Boss — the Apex Storm.** A moving airship that never stops moving (the 3D contract's
moving-airship boss pattern). Phase 1: hull sweep. Phase 2: it sheds debris hazards and
the camera zooms out. Phase 3: the eye opens and the exposed core is reachable only by
riding a wind updraught that the boss itself creates. Defeating it does **not** end the
game: it opens the finale, which is a separate node and a separate stage.

**Secret route.** None by design — the finale region has **three** optional chambers
(`region08_bonus01`–`03`) reachable from `region08_stage01`, `region08_stage03` and
`region08_stage05` respectively. `REQ-B-020`'s counting rule treats the finale region's
three secret exits as three distinct exit records, never as one.

**REQs exercised.** `REQ-B-012`, `REQ-B-019`, `REQ-B-020`, `REQ-B-021`;
`REQ-D-008`, `REQ-D-012`, `REQ-D-015`, `REQ-D-016`, `REQ-D-017`, `REQ-D-018`;
plus the autoscroll spawn rules of `REQ-B-012` and the off-screen death rule.

---

### 4.9 Region coverage check

| Teaching lesson (master §6) | Region | First stage that teaches it | Stage id |
|---|---|---|---|
| Movement, jumps | 1 Verdance Reach | First Light | `region01_stage01` |
| Hidden objects | 1 Verdance Reach | Stonecap Hollow | `region01_stage03` |
| Basic enemies | 1 Verdance Reach | Thornwake Ford | `region01_stage04` |
| Wind | 2 Sirocco Vaults | The Mouth of the Vault | `region02_stage01` |
| Sinking | 2 Sirocco Vaults | Duskglass Dig | `region02_stage02` |
| Moving platforms | 2 Sirocco Vaults | Counterweight Vault | `region02_stage03` |
| Switches | 2 Sirocco Vaults | Lantern Circuit | `region02_stage04` |
| Swim | 3 Tidereach Shoals | Shoal Shallows | `region03_stage01` |
| Current | 3 Tidereach Shoals | Undertow Shelf | `region03_stage02` |
| Vertical movement | 3 Tidereach Shoals | The Kelp Shaft | `region03_stage03` |
| Aquatic hazards | 3 Tidereach Shoals | Reef Lanterns | `region03_stage04` |
| Scale variants | 4 Titanroot Canopy | Underleaf | `region04_stage01` |
| Carry / throw | 4 Titanroot Canopy | Boughhaul | `region04_stage02` |
| Alternate routes | 4 Titanroot Canopy | Rootcause | `region04_stage03` |
| Charge-glide | 5 Cirrus Spine | First Ascent | `region05_stage01` |
| Floating platforms | 5 Cirrus Spine | Driftstones | `region05_stage02` |
| Wind (advanced) | 5 Cirrus Spine | Updraught Spire | `region05_stage03` |
| Friction | 6 Palehush Hollow | Hoarfall | `region06_stage01` |
| Visibility | 6 Palehush Hollow | Whiteout | `region06_stage02` |
| Chasing ghosts | 6 Palehush Hollow | The Chasing Dark | `region06_stage03` |
| Mazes | 6 Palehush Hollow | Lantern Labyrinth | `region06_stage04` |
| Complex traps | 7 Cinderforge Keep | Slagworks | `region07_stage01` |
| Boss sequences | 7 Cinderforge Keep | Chainvault | `region07_stage03` |
| Item management | 7 Cinderforge Keep | Crucible Run | `region07_stage02` |
| Combined mechanics | 8 Stormwrack Apex | Squall Line | `region08_stage01` |
| Autoscroll airship | 8 Stormwrack Apex | Squall Line | `region08_stage01` |
| Multi-phase ending | 8 Stormwrack Apex | Eye of the Squall | `region08_stage04` |

**Every lesson has a first-teaching stage, and every stage's `qa_tags` names the lessons
it teaches.** `LINT-031` fails the build if any region in the table above has no stage
carrying its `teaches_*` tag.

---

## 5. The world-map graph

### 5.1 Node kinds and edge kinds

The architecture board §5.6 defines the world JSON. This board supplies the **semantics**
of its node kinds and the **content** of the graph.

| Node kind | Meaning | Stage launched? | Icon asset |
|---|---|---|---|
| `stage` | A normal stage | ✔ | `kenney.platformer.flag` rendered as a 3D map marker, or the 2D icon in `icons/` (§5.1) |
| `boss` | A boss arena; its completion sets the region's exit flag | ✔ | `kenney.platformer.star` marker |
| `bonus` | A reward chamber | ✔ | `kenney.platformer.coin-gold` marker |
| `hub` | A region's map entry point; carries the region's `ruleset_id` and `flags` | ✖ (map only) | `kenney.platformer.sign` marker |
| `bridge` | A cross-region edge; the map draws a rope/bridge between two hubs | ✖ (map only) | `kenney.platformer.poles` marker |
| `lock` | A locked gate on the map; requires a flag | ✖ (map only) | `kenney.platformer.lock` marker |
| `encounter` | A moving encounter node — a wandering hazard that must be cleared to pass | ✔ (a 40 m encounter stage) | `kenney.platformer.saw` marker |
| `finale` | The ending stage | ✔ | `kenney.platformer.jewel` marker |

| Edge type | Meaning |
|---|---|
| `primary` | The normal forward edge. Always present on a completed node. |
| `secret` | Reachable only when the exit's `requires` flags are all set. Draws as a dotted line. |
| `locked` | A `lock` node's edge. The map shows the lock; the edge opens when the flag is set. |
| `bridge` | Connects two region hubs. Both sides are `hub` nodes. |
| `encounter` | Connects a `hub` to an `encounter` node and back. |
| `return` | The back-edge the map draws from a stage to its hub when the player returns. |

**Icon rule.** Every node carries exactly one `icon` id, and every icon id resolves to a
named PNG in `shorepine-kenney/icons/` (7,508 files) or to a named 3D marker asset in
`shorepine-kenney/3d/platformer/`. The icons are **outside** the licence-unverified 2D
set: every row of `library-inventory/kenney-2d-paths.txt` begins `2d/`, every row of
`library-inventory/kenney-icon-paths.txt` begins `icons/`, and the two sets have **zero**
path overlap (measured). `asset_audit.py` re-checks this on every build (§9, `LINT-034`).

### 5.2 The canonical world graph

The graph is eight regional sub-graphs joined by `bridge` edges, plus a `region00_hub`
entry hub. Node ids follow `regionNN_stageNN`, `regionNN_bossNN`, `regionNN_bonusNN`,
`regionNN_hub`, `regionNN_lock`.

```
region00_hub
   │ (bridge)
   ▼
region01_hub ──primary──▶ region01_stage01 ─▶ region01_stage02 ─▶ region01_stage03 ─▶ region01_stage04 ─▶ region01_stage05 ─▶ region01_boss01
                            │                    │                   │                   │                   │                  │
                            │ secret             │ secret            │ secret            │ secret            │ secret           │
                            ▼                    ▼                   ▼                   ▼                   ▼                  ▼
                     region01_bonus01      region01_bonus02     (none)          region01_bonus03     (none)        region00_hub
                                                                        │
                                                          region02_hub ◀─┘ (bridge, set by region01_boss01)
```

**The region chain.**

| From | Bridge edge | To | Gate condition |
|---|---|---|---|
| `region01_boss01` | `bridge.r01_r02` | `region02_hub` | `flag.region01_boss01` set by the boss defeat (`REQ-B-019`) |
| `region02_boss01` | `bridge.r02_r03` | `region03_hub` | `flag.region02_boss01` |
| `region03_boss01` | `bridge.r03_r04` | `region04_hub` | `flag.region03_boss01` |
| `region04_boss01` | `bridge.r04_r05` | `region05_hub` | `flag.region04_boss01` |
| `region05_boss01` | `bridge.r05_r06` | `region06_hub` | `flag.region05_boss01` |
| `region06_boss01` | `bridge.r06_r07` | `region07_hub` | `flag.region06_boss01` |
| `region07_boss01` | `bridge.r07_r08` | `region08_hub` | `flag.region07_boss01` |
| `region08_boss01` | `bridge.r08_finale` | `region08_finale` | `flag.region08_boss01` |

**Locked doors on the map.** Two `lock` nodes are authored, both in Region 1 and both
optional:

| Lock node | Edge it guards | Requires | Where the flag comes from |
|---|---|---|---|
| `region01_lock_stone` | `region01_stage04` → `region01_stage05` | `key_stone` | `region01_stage03`'s hidden block |
| `region01_lock_iron` | `region01_bonus02` → `region01_bonus03` | `key_iron` | `region01_stage05`'s high ledge |

Both locks are **optional-soft**: if the player has not found the key, the map shows the
lock and the edge is drawn as `locked`, but the **primary** path through
`region01_stage04` → `region01_stage05` does not depend on it (the lock guards a *side*
route). `GRAPH-006` enforces that no lock node guards a path required for the ending.

**Moving encounters.** Three `encounter` nodes sit on the map between regions 2–3, 4–5 and
6–7. An encounter node is a 40 m stage whose camera advances only while the player is
moving forward and the player must clear the encounter (defeat the wandering hazard) to
open the exit. The map draws the encounter marker at a random-but-seeded position on the
bridge (`REQ-B-009`'s "moving enemy encounters").

**Icon set for the map.** Node markers, all named files:
`shorepine-kenney/3d/platformer/flag.glb` (stage), `star.glb` (boss), `coin-gold.glb`
(bonus), `sign.glb` (hub), `poles.glb` (bridge), `lock.glb` (lock), `saw.glb` (encounter),
`jewel.glb` (finale). 2D map overlays (the parchment, the region names) use
`shorepine-kenney/ui/UI Adventure Pack/*` and `shorepine-kenney/icons/Board Game Icons/Default (64px)/*`.

### 5.3 World-graph content — one table per region

Every region's node set, with the `requires` flags. `flag:` names are declared in that
world's `flags` map (architecture §5.6).

**Region 1 — Verdance Reach** (`region01`, `ruleset_id: classic_ground`)

| Node | Kind | Entry | Exits (type → to, requires) |
|---|---|---|---|
| `region01_hub` | `hub` | start | `primary` → `region01_stage01`; `locked` → `region01_lock_stone` (`key_stone`) |
| `region01_stage01` | `stage` | west | `primary` → `region01_stage02`; `secret` → `region01_bonus01` (`key_brass`) |
| `region01_stage02` | `stage` | west | `primary` → `region01_stage03`; `secret` → `region01_bonus02` (`key_brass`) |
| `region01_stage03` | `stage` | north | `primary` → `region01_stage04`; `secret` → `region01_bonus03` (`key_stone`) |
| `region01_stage04` | `stage` | west | `primary` → `region01_stage05`; `secret` → `region01_bonus01` |
| `region01_stage05` | `stage` | east | `primary` → `region01_boss01`; `secret` → `region01_bonus02` (`key_iron`) |
| `region01_boss01` | `boss` | west | `primary` → `region00_hub` (returns to the chain); sets `flag.region01_boss01` |
| `region01_bonus01`–`03` | `bonus` | various | `return` → their parent stage |
| `region01_lock_stone` | `lock` | — | `primary` → `region01_stage05` when `key_stone` is set |

**Region 2 — Sirocco Vaults** (`region02`, `ruleset_id: classic_ground`)

| Node | Exits |
|---|---|
| `region02_hub` | `primary` → `region02_stage01`; `encounter` → `region02_enc01` |
| `region02_stage01` | `primary` → `region02_stage02` |
| `region02_stage02` | `primary` → `region02_stage03` |
| `region02_stage03` | `primary` → `region02_stage04`; `secret` → `region02_bonus01` (`key_sand`) |
| `region02_stage04` | `primary` → `region02_stage05` |
| `region02_stage05` | `primary` → `region02_boss01` |
| `region02_boss01` | `primary` → `region02_hub`; sets `flag.region02_boss01` |
| `region02_enc01` | `encounter` → back to `region02_hub` when cleared |

**Region 3 — Tidereach Shoals** (`region03`, `ruleset_id: classic_ground`)

| Node | Exits |
|---|---|
| `region03_hub` | `primary` → `region03_stage01` |
| `region03_stage01` | `primary` → `region03_stage02`; `secret` → `region03_bonus01` (`key_tide`) |
| `region03_stage02` | `primary` → `region03_stage03` |
| `region03_stage03` | `primary` → `region03_stage04` |
| `region03_stage04` | `primary` → `region03_stage05` |
| `region03_stage05` | `primary` → `region03_boss01` |
| `region03_boss01` | `primary` → `region03_hub`; sets `flag.region03_boss01` |

**Region 4 — Titanroot Canopy** (`region04`, `ruleset_id: carry_throw`)

| Node | Exits |
|---|---|
| `region04_hub` | `primary` → `region04_stage01` |
| `region04_stage01` | `primary` → `region04_stage02` |
| `region04_stage02` | `primary` → `region04_stage03` |
| `region04_stage03` | `primary` → `region04_stage04` **and** `secret` → `region04_bonus01` (`key_heart`) — the alternate route |
| `region04_stage04` | `primary` → `region04_stage05` |
| `region04_stage05` | `primary` → `region04_boss01`; `secret` → `region04_bonus01` (`key_heart`) |
| `region04_boss01` | `primary` → `region04_hub`; sets `flag.region04_boss01` |

**Region 5 — Cirrus Spine** (`region05`, `ruleset_id: branching_companion`)

| Node | Exits |
|---|---|
| `region05_hub` | `primary` → `region05_stage01` |
| `region05_stage01` | `primary` → `region05_stage02` |
| `region05_stage02` | `primary` → `region05_stage03`; `secret` → `region05_bonus01` (`key_cloud`) |
| `region05_stage03` | `primary` → `region05_stage04` |
| `region05_stage04` | `primary` → `region05_stage05` |
| `region05_stage05` | `primary` → `region05_boss01` |
| `region05_boss01` | `primary` → `region05_hub`; sets `flag.region05_boss01` |

**Region 6 — Palehush Hollow** (`region06`, `ruleset_id: classic_ground`)

| Node | Exits |
|---|---|
| `region06_hub` | `primary` → `region06_stage01` |
| `region06_stage01` | `primary` → `region06_stage02` |
| `region06_stage02` | `primary` → `region06_stage03` |
| `region06_stage03` | `primary` → `region06_stage04`; `secret` → `region06_bonus01` (`key_lantern`) |
| `region06_stage04` | `primary` → `region06_stage05` |
| `region06_stage05` | `primary` → `region06_boss01` |
| `region06_boss01` | `primary` → `region06_hub`; sets `flag.region06_boss01` |

**Region 7 — Cinderforge Keep** (`region07`, `ruleset_id: challenge`)

| Node | Exits |
|---|---|
| `region07_hub` | `primary` → `region07_stage01`; `encounter` → `region07_enc01` |
| `region07_stage01` | `primary` → `region07_stage02` |
| `region07_stage02` | `primary` → `region07_stage03` |
| `region07_stage03` | `primary` → `region07_stage04` |
| `region07_stage04` | `primary` → `region07_stage05`; `secret` → `region07_bonus01` (`key_slag`) |
| `region07_stage05` | `primary` → `region07_boss01` |
| `region07_boss01` | `primary` → `region07_hub`; sets `flag.region07_boss01` |

**Region 8 — Stormwrack Apex** (`region08`, `ruleset_id: challenge`)

| Node | Exits |
|---|---|
| `region08_hub` | `primary` → `region08_stage01`; `encounter` → `region08_enc01` |
| `region08_stage01` | `primary` → `region08_stage02`; `secret` → `region08_bonus01` (`key_gale`) |
| `region08_stage02` | `primary` → `region08_stage03` |
| `region08_stage03` | `primary` → `region08_stage04`; `secret` → `region08_bonus02` (`key_gale`) |
| `region08_stage04` | `primary` → `region08_stage05` |
| `region08_stage05` | `primary` → `region08_boss01`; `secret` → `region08_bonus03` (`key_gale`) |
| `region08_boss01` | `primary` → `region08_finale`; sets `flag.region08_boss01` |
| `region08_finale` | `primary` → `region00_hub`; sets `flag.endgame_complete` |
| `region08_enc01` | `encounter` → back to `region08_hub` when cleared |

**`world_map_suits` note.** `ruleset_id: world_map_suits` is reserved for a ruleset whose
feature set includes `world_inventory`. Under the committed scope no region uses it; the
field is nonetheless declared in every world JSON so that the ruleset can be enabled later
without a schema change, and `RULESET-004` (architecture §5.1) keeps it exclusive.

### 5.4 The reachability proof obligation (`REQ-E-009`)

The architecture board §7.3 defines the validator's five proofs. This board supplies the
**obligation** as a data artefact:

> **For every region `R` in the committed set, there must exist a path
> `region00_hub → R.hub → … → R.boss01` in which every edge is `primary` or `bridge`, and
> every `requires` on that path is satisfiable by a flag set by a node on or before it.**

This is expressed as a file `src/content/worlds/reachability.obligation.json`:

```json
{
  "schema_version": 1,
  "id": "reachability.obligation",
  "entry_node": "region00_hub",
  "ending_nodes": ["region08_finale"],
  "obligations": [
    {"region": "region01", "entry": "region01_hub", "required_terminal": "region01_boss01",
     "path_must_include": ["region01_stage01", "region01_stage02", "region01_stage03",
                            "region01_stage04", "region01_stage05"]},
    {"region": "region02", "entry": "region02_hub", "required_terminal": "region02_boss01",
     "path_must_include": ["region02_stage01", "region02_stage02", "region02_stage03",
                            "region02_stage04", "region02_stage05"]},
    {"region": "region03", "entry": "region03_hub", "required_terminal": "region03_boss01",
     "path_must_include": ["region03_stage01", "region03_stage02", "region03_stage03",
                            "region03_stage04", "region03_stage05"]},
    {"region": "region04", "entry": "region04_hub", "required_terminal": "region04_boss01",
     "path_must_include": ["region04_stage01", "region04_stage02", "region04_stage03",
                            "region04_stage04", "region04_stage05"]},
    {"region": "region05", "entry": "region05_hub", "required_terminal": "region05_boss01",
     "path_must_include": ["region05_stage01", "region05_stage02", "region05_stage03",
                            "region05_stage04", "region05_stage05"]},
    {"region": "region06", "entry": "region06_hub", "required_terminal": "region06_boss01",
     "path_must_include": ["region06_stage01", "region06_stage02", "region06_stage03",
                            "region06_stage04", "region06_stage05"]},
    {"region": "region07", "entry": "region07_hub", "required_terminal": "region07_boss01",
     "path_must_include": ["region07_stage01", "region07_stage02", "region07_stage03",
                            "region07_stage04", "region07_stage05"]},
    {"region": "region08", "entry": "region08_hub", "required_terminal": "region08_finale",
     "path_must_include": ["region08_stage01", "region08_stage02", "region08_stage03",
                            "region08_stage04", "region08_stage05", "region08_boss01"]}
  ]
}
```

**Acceptance test (`AC-B009`).** `python3 src/tools/world_map_validator.py --obligation
src/content/worlds/reachability.obligation.json` exits 0 on the committed graph and prints one
line per region: `OK regionNN: path of N nodes from regionNN_hub to <terminal>`. It exits
non-zero and names the region, the broken edge and the unsatisfiable flag if any
obligation fails. A fixture `tests/fixtures/worlds/broken_dead_end.world.json` — a graph
whose `region03_stage04` has no exit — **must** produce
`GRAPH-002 region03_stage04 is a dead end: no exit to a reachable node` and a non-zero
exit code.

**Idempotence (`AC-B009-2`).** Applying the same world-state delta twice produces the
same unlocked-node set as applying it once. The validator asserts this on a delta that
adds and removes `key_stone` in sequence.

**Secret satisfiability (`AC-B009-3`).** For every `secret` edge, at least one node in
the graph sets the required flag, and that node is reachable without passing through the
secret edge itself. The validator proves this; a secret whose flag is only obtainable
*behind* the secret is a content bug, and it fails with
`GRAPH-003 secret edge regionNN_stageNN -> regionNN_bonusNN requires 'key_x' which no node on a non-secret path sets`.

---

## 6. The interactive-object catalogue

### 6.0 Reading the catalogue

Each row gives: **id** (the archetype id in `src/content/objects/`), the **exact asset path**,
the **collision material** (3D contract §1.1), the **behaviour**, and the **acceptance
test** that can fail. Every asset path is a real file in the repository as of this
document. Any element with no file is an **ASSET GAP** row in §11 — never a placeholder.

The `collision.material` column uses the 3D contract's nine materials. The `material`
axis of the master document's nine *tile* materials is folded in through §3.2.

### 6.1 Blocks (`src/content/blocks/<id>.block.json`)

| # | Id | Asset path | Collision | Behaviour | Acceptance test |
|---|---|---|---|---|---|
| B-01 | `block.terrain_grass` | `shorepine-kenney/3d/platformer/block-grass.glb` | `solid` | The default terrain cell. | *AC-B01:* a placement with `collision.material = solid` and this asset registers exactly one box collider of the asset's measured footprint; the linter rejects it if the footprint exceeds the grid cell by > 2 %. |
| B-02 | `block.terrain_grass_large` | `shorepine-kenney/3d/platformer/block-grass-large.glb` | `solid` | 2 m terrain mass; used for cliff bodies and boss plinths. | *AC-B02:* a run along its top is frictionless-free — the same input that stops on `block-grass` stops on this within `TUNE 0.2 m`. |
| B-03 | `block.terrain_grass_low` | `shorepine-kenney/3d/platformer/block-grass-low.glb` | `solid` | Half-height step. | *AC-B03:* the collider height equals the measured bbox height within 0.5 %. |
| B-04 | `block.terrain_snow` | `shorepine-kenney/3d/platformer/block-snow.glb` | `solid` | Snow terrain; the visual carrier for `ice` material. | *AC-B04:* the same placement with `material: ice` produces a measurably longer slide than with `material: solid` (§3.2). |
| B-05 | `block.terrain_snow_low` | `shorepine-kenney/3d/platformer/block-snow-low.glb` | `solid` | Snow step; also the carrier for `quicksand` in Region 2's dig. | *AC-B05:* `quicksand` on this asset sinks the player at `TUNE 0.6 m/s` while grounded. |
| B-06 | `block.terrain_snow_overhang` | `shorepine-kenney/3d/platformer/block-snow-overhang-large.glb` | `solid` | Overhang mass; the visual for `slippery_grunt` floors in Region 6. | *AC-B06:* the player slides on `slippery_grunt` but not on `solid` for the identical input. |
| B-07 | `block.terrain_slope` | `shorepine-kenney/3d/platformer/block-grass-large-slope.glb` | `solid` | Rotated box collider; **the angle is the asset's**, never authored. | *AC-B07:* the collider's surface normal matches the asset's measured top-face normal within 1°. |
| B-08 | `block.terrain_overhang_low` | `shorepine-kenney/3d/platformer/block-grass-overhang-low.glb` | `solid` | Low ledge; the visual carrier for `mud`. | *AC-B08:* `mud` produces a final X position at least 2 m short of `solid` for the same input. |
| B-09 | `block.terrain_hex` | `shorepine-kenney/3d/platformer/block-grass-hexagon.glb` | `solid` | Hexagonal plinth; used for the Region 5 vertebrae. | *AC-B09:* the collider is a convex prism matching the measured bbox; no gap larger than 5 cm between collider and mesh. |
| B-10 | `block.bump_coin` | `shorepine-kenney/3d/platformer/block-grass.glb` | `solid` | Hit from below → one coin, `TUNE 8` hit-flash ticks, no break. | *AC-B10:* hitting it 10 times inside one window emits exactly **one** `collectable` event; the block's state goes `idle → hit → idle`. |
| B-11 | `block.bump_item` | `shorepine-kenney/3d/platformer/block-grass.glb` | `solid` | Hit from below → an item emerges (`REQ-D-006`). | *AC-B11:* the spawned item's position is asserted free of solid geometry at every one of its first 30 ticks; if it is not, the spawn is aborted and the block returns to `idle` with a `WARN` in the log, never a stuck item. |
| B-12 | `block.break_crate` | `shorepine-kenney/3d/platformer/crate.glb` | `solid` | `material: breakable`; destroyed by a downward strike; drops its payload. | *AC-B12:* after destruction the collider is gone within 1 tick and the payload is awarded exactly once. |
| B-13 | `block.break_crate_strong` | `shorepine-kenney/3d/platformer/crate-strong.glb` | `solid` | `material: breakable`; requires a heavier strike than B-12. | *AC-B13:* a normal stomp does **not** break it; a ground-pound does. |
| B-14 | `block.switchable_grass` | `shorepine-kenney/3d/platformer/block-grass.glb` | `solid` | **Outlined** block; converts to solid when its world flag is set. | *AC-B14:* with the flag set the block is collidable and opaque; with it clear the block is pass-through and renders as an outline; the state survives death, save and reload (`REQ-B-015`). |
| B-15 | `block.switchable_blue` | `shorepine-kenney/3d/platformer/block-moving-blue.glb` | `solid` | The blue variant of the switchable family. | *AC-B15:* the blue family is toggled by a **different** flag from the grass family; setting one does not change the other. |
| B-16 | `block.invisible` | *(no mesh — `states.idle.visual = null`)* | `solid` | Invisible solid; reveals a shimmer when the player is within 1.5 m. | *AC-B16:* the block is collidable before and after the shimmer; the linter rejects any `material: invisible` block whose `states.idle.visual` is not `null`. |
| B-17 | `block.one_way` | `shorepine-kenney/3d/platformer/platform.glb` | `solid` | Single permitted normal `+Y`; jump-through on crouch. | *AC-B17:* rising through it is never blocked; falling onto it is always caught; the linter rejects a one-way collider with a second permitted normal. |
| B-18 | `block.spring` | `shorepine-kenney/3d/platformer/spring.glb` | `bouncy` | Launch impulse `TUNE 9.5 m/s`; the clip `platformer/spring` plays in sync. | *AC-B18:* standing on it launches to `TUNE 9.5 m/s`; jumping into it launches to `TUNE 12.0 m/s`; the two differ measurably. |
| B-19 | `block.spike` | `shorepine-kenney/3d/platformer/trap-spikes.glb` | `hazard` | Emits `DamageEvent{damage_type: environment}` on contact. | *AC-B19:* the spike's hitbox is non-empty and its damage respects the 30-tick contact cooldown (`TUNE-012`). |
| B-20 | `block.spike_large` | `shorepine-kenney/3d/platformer/trap-spikes-large.glb` | `hazard` | As B-19, wider. | *AC-B20:* as B-19. |
| B-21 | `block.spike_block` | `shorepine-kenney/3d/platformer/spike-block.glb` | `hazard` | A block that is a hazard on all four sides. | *AC-B21:* contact from any of the four sides emits the hazard event; there is no safe face. |
| B-22 | `block.crate_item` | `shorepine-kenney/3d/platformer/crate-item.glb` | `solid` | Breaks to reveal a fixed item. | *AC-B22:* the payload matches `payload.item_id`; a `payload.item_id` that does not resolve fails the linter. |
| B-23 | `block.crate_item_strong` | `shorepine-kenney/3d/platformer/crate-item-strong.glb` | `solid` | As B-22, heavier strike. | *AC-B23:* as B-22. |
| B-24 | `block.conveyor` | `shorepine-kenney/3d/platformer/conveyor-belt.glb` | `conveyor` | Adds `conveyor_speed` along `surface_axis`. | *AC-B24:* a player who stands still drifts at `TUNE 2.0 m/s` in the belt's direction; a player who walks against it still drifts backwards. |

### 6.2 Moving platforms (`REQ-D-009`)

All eight motion types of `REQ-D-009` are specified. The Kenney `block-moving` family and
`platform` family supply the meshes; **all motion is scripted-transform**, which the
architecture board permits (3D contract §8: a scripted transform on an existing model).

| # | Id | Asset path | Material | Motion | Acceptance test |
|---|---|---|---|---|---|
| P-01 | `platform.loop_horizontal` | `shorepine-kenney/3d/platformer/platform.glb` | `solid` | Constant-velocity loop between two points. | *AC-P01:* a player riding it holds a constant position relative to the platform across 60 ticks — relative drift < 1 cm (`REQ-D-009` acceptance). |
| P-02 | `platform.oscillate` | `shorepine-kenney/3d/platformer/platform.glb` | `solid` | Sine motion on one axis; `TUNE 0.5 Hz`, `TUNE 4 m` amplitude. | *AC-P02:* the platform's velocity is continuous at the turning points (no velocity discontinuity > 0.1 m/s between adjacent ticks). |
| P-03 | `platform.fall_away` | `shorepine-kenney/3d/platformer/platform-overhang.glb` | `solid` | Descends on contact, then respawns after `TUNE 4 s`. | *AC-P03:* stepping on it starts the descent within 1 tick and the respawn restores it to its authored origin exactly. |
| P-04 | `platform.seesaw` | `shorepine-kenney/3d/platformer/platform-ramp.glb` | `solid` | Rotates about its authored pivot in response to the player's offset. | *AC-P04:* the tilt angle is a function of the player's standing offset and is capped at `TUNE 12°`. |
| P-05 | `platform.rideable_flyer` | `shorepine-kenney/3d/platformer/block-moving.glb` | `solid` | Moves along a path; the player mounts it. | *AC-P05:* the mount transfers the player's position without a teleport snap > 0.1 m. |
| P-06 | `platform.rotating` | `shorepine-kenney/3d/platformer/block-moving-large.glb` | `solid` | Rotates about Y at a constant rate. | *AC-P06:* a rider is carried around the circle at the platform's rim speed. |
| P-07 | `platform.weight_sensitive` | `shorepine-kenney/3d/platformer/platform-fortified.glb` | `solid` | Sinks under a carried weight above a threshold; otherwise static. | *AC-P07:* with the carry slot empty it is static; with a `weight ≥ threshold` carried it descends `TUNE 1.5 m` and stays there. |
| P-08 | `platform.autoscroll` | `shorepine-kenney/3d/platformer/platform.glb` | `solid` | Moves with the camera during an autoscroll stage. | *AC-P08:* in `region08_stage01` the platform's X equals the camera's X minus its authored offset, within 0.05 m, for the whole scroll. |
| P-09 | `platform.lifting_column` | `shorepine-kenney/3d/platformer/ladder-long.glb` | `solid` | Vertical lift, the Region 3 shaft mechanism. | *AC-P09:* it carries the player upward at `TUNE 3 m/s` and the player's relative position is constant across 60 ticks. |

### 6.3 Switches and temporary world switches (`REQ-D-008`)

| # | Id | Asset path | Animation | Behaviour | Acceptance test |
|---|---|---|---|---|---|
| S-01 | `object.button_round` | `shorepine-kenney/3d/platformer/button-round.glb` | `toggle-on`, `toggle-off`, `toggle` | Momentary or latching press; sets a world flag. | *AC-S01:* pressing it emits exactly one flag-set event; the flag survives death, save and reload (`REQ-B-015`). |
| S-02 | `object.button_square` | `shorepine-kenney/3d/platformer/button-square.glb` | `toggle-on`, `toggle-off`, `toggle` | As S-01; the square family toggles a **different** flag set. | *AC-S02:* the square and round families are independent; setting one does not change the other. |
| S-03 | `object.lever` | `shorepine-kenney/3d/platformer/lever.glb` | `toggle-on`, `toggle-off`, `toggle` | A latching lever; the Region 7 boss's alternative-defeat switch. | *AC-S03:* pulling it fires the linked trigger exactly once and the lever's visual state matches the flag. |
| S-04 | `object.button_timed` | `shorepine-kenney/3d/platformer/button-round.glb` | `toggle-on`, `toggle-off`, `toggle` | Starts a `TUNE 12 s` timer that expires the flag. | *AC-S04:* on expiry the affected tiles are restored **and** a player overlapping them is pushed out along the wall normal — never trapped, never killed (`REQ-D-008` acceptance). |
| S-05 | `object.switch_block_grass` | `shorepine-kenney/3d/platformer/block-grass.glb` | — | The **target** of S-01: converts to solid/visible when its flag is set. | *AC-S05:* the block's collision state matches the flag at all times, including immediately after a save/reload. |
| S-06 | `object.switch_block_blue` | `shorepine-kenney/3d/platformer/block-moving-blue.glb` | — | The target of S-02. | *AC-S06:* as S-05, with an independent flag. |
| S-07 | `object.timed_platform` | `shorepine-kenney/3d/platformer/platform.glb` | — | Exists only while the timed flag is set. | *AC-S07:* when the flag clears, the platform despawns; a player standing on it is carried down by `TUNE 2 m/s` rather than falling instantly. |
| S-08 | `object.conveyor_toggle` | `shorepine-kenney/3d/platformer/conveyor-belt.glb` | — | Flips the belt's direction. | *AC-S08:* the surface velocity vector's sign reverses, and the swap is instantaneous. |

### 6.4 Keys, locks, doors and chests (`REQ-D-011`)

| # | Id | Asset path | Animation | Behaviour | Acceptance test |
|---|---|---|---|---|---|
| D-01 | `object.key_brass` | `shorepine-kenney/3d/platformer/key.glb` | — | A key collectable; sets `key_brass`. | *AC-D01:* collecting it sets the flag exactly once and removes it from the world; after death it does not respawn. |
| D-02 | `object.key_stone` | `shorepine-kenney/3d/platformer/key.glb` | — | The `key_stone` flag. | *AC-D02:* as D-01. |
| D-03 | `object.key_iron` | `shorepine-kenney/3d/platformer/key.glb` | — | The `key_iron` flag. | *AC-D03:* as D-01. |
| D-04 | `object.key_heart` | `shorepine-kenney/3d/platformer/key.glb` | — | The `key_heart` flag (Region 4). | *AC-D04:* as D-01. |
| D-05 | `object.key_lantern` | `shorepine-kenney/3d/platformer/key.glb` | — | The `key_lantern` flag (Region 6). | *AC-D05:* as D-01. |
| D-06 | `object.lock` | `shorepine-kenney/3d/platformer/lock.glb` | — | A lock volume; the door opens when the named flag is set. | *AC-D06:* the door refuses the player while the flag is clear and emits no progress event; with the flag set it opens. |
| D-07 | `object.door_rotate` | `shorepine-kenney/3d/platformer/door-rotate.glb` | `open`, `close`, `open-and-close` | A swinging door; `open-and-close` on a timer. | *AC-D07:* the door's collider is disabled while the `open` clip is at or past 50 % of its measured length, and re-enabled after `close`. |
| D-08 | `object.door_rotate_large` | `shorepine-kenney/3d/platformer/door-rotate-large.glb` | `open`, `close`, `open-and-close` | As D-07, full-height. | *AC-D08:* as D-07. |
| D-09 | `object.gate_dungeon` | `shorepine-kenney/3d/modular-dungeon/gate-door.glb` | `open`, `close`, `open-and-close` | A rising portcullis gate. | *AC-D09:* as D-07. |
| D-10 | `object.gate_space` | `shorepine-kenney/3d/modular-space/gate-door.glb` | `open`, `close`, `open-and-close` | The Region 8 convoy gate. | *AC-D10:* as D-07. |
| D-11 | `object.chest` | `shorepine-kenney/3d/platformer/chest.glb` | — | A reward container; opens once. | *AC-D11:* the chest's payload is awarded exactly once across all retries; a second open emits nothing. |
| D-12 | `object.chest_survival` | `shorepine-kenney/3d/survival/chest.glb` | `open`, `close`, `open-close` | The Region 6/7 chest variant. | *AC-D12:* as D-11. |
| D-13 | `object.coffin_decorated` | `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/coffin_decorated.gltf` | — | A Region 6 reward container, opens once. | *AC-D13:* as D-11. |
| D-14 | `object.potion_portal` | `shorepine-kenney/3d/platformer/crate-item.glb` | — | **The alternate-world portal**: a volume that swaps the player into a `subspace` layer of the same stage. | *AC-D14:* entering it loads the stage's `subspace` layer and preserves the player's inventory, power state and score; leaving returns to the same position on the other side. |

### 6.5 Portals and warps (`REQ-B-010`, 3D contract §2.6)

| # | Id | Asset | Portal volume | Behaviour | Acceptance test |
|---|---|---|---|---|---|
| W-01 | `portal.pipe_forward` | `shorepine-kenney/3d/platformer/pipe.glb` | `{kind: "pipe", axis: [1,0,0]}` | Player inside the volume + action pressed + facing within `TUNE 25°` of the axis → travel. | *AC-W01:* facing 60° away from the axis does **not** travel; facing 10° does. A blocked destination refuses the travel and the player stays put. |
| W-02 | `portal.pipe_vertical` | `shorepine-kenney/3d/platformer/pipe.glb` | `{kind: "pipe_vertical", axis: [0,1,0]}` | As W-01 on the vertical axis. | *AC-W02:* as W-01 with a vertical tolerance. |
| W-03 | `portal.door` | `shorepine-kenney/3d/platformer/door-rotate.glb` | `{kind: "door"}` | Player inside the volume + action → travel; **no facing requirement**. | *AC-W03:* the player travels facing any direction. |
| W-04 | `portal.ladder` | `shorepine-kenney/3d/platformer/ladder.glb` | `{kind: "ladder"}` | Entering the volume enters the `climbing` state. | *AC-W04:* inside the volume the player's vertical velocity is driven by input and the horizontal axis is locked; a solid overlap forces an exit at the nearest free endpoint (`REQ-A-014`). |
| W-05 | `portal.ladder_long` | `shorepine-kenney/3d/platformer/ladder-long.glb` | `{kind: "ladder"}` | As W-04, 4 m tall. | *AC-W05:* as W-04. |
| W-06 | `portal.ladder_broken` | `shorepine-kenney/3d/platformer/ladder-broken.glb` | `{kind: "ladder"}` | A ladder whose top is missing; the exit endpoint is its midpoint. | *AC-W06:* climbing it ends at the midpoint and never at a solid face. |
| W-07 | `portal.warp_hidden` | *(no mesh)* | `{kind: "warp"}` | The Region 1 hidden warp; reachable only through an invisible block. | *AC-W07:* the warp volume exists in the stage data but is unreachable without triggering the block; `LINT-021` reports the unreachable warp as a **warning**, not an error, because a hidden warp is intentional. |

**Return-portal placement (`REQ-B-010`).** Every portal volume carries `destination` and
`return_portal`. On traversal the player is placed at the destination's `return_portal`
transform and the camera is **re-seeded from the destination stage's `bounds` and
`camera_zones`**, so no stale camera bounds survive the jump.

### 6.6 Hazards (`REQ-D-012`)

All hazards emit **one** typed event — `DamageEvent{damage_type: "environment"}` for
contact hazards, `"poison"` for the negative pool — and all respect the immunity column of
the resistance matrix and the `TUNE-012` 30-tick contact cooldown.

| # | Id | Asset path | Material | Behaviour | Acceptance test |
|---|---|---|---|---|---|
| H-01 | `hazard.saw` | `shorepine-kenney/3d/platformer/saw.glb` | `hazard` | Rotating blade on a fixed track. | *AC-H01:* the blade's hitbox is non-empty and moves with the mesh; contact emits exactly one environment damage event per cooldown window. |
| H-02 | `hazard.spike_trap` | `shorepine-kenney/3d/platformer/trap-spikes.glb` | `hazard` | A pop-up spike with a telegraph. | *AC-H02:* the spike rises over `TUNE 0.4 s` before becoming harmful; a player standing on the tile during the rise is not damaged. |
| H-03 | `hazard.spike_trap_large` | `shorepine-kenney/3d/platformer/trap-spikes-large.glb` | `hazard` | As H-02, wide. | *AC-H03:* as H-02. |
| H-04 | `hazard.bomb` | `shorepine-kenney/3d/platformer/bomb.glb` | `hazard` | A fuse-and-detonate hazard; the fuse is the telegraph. | *AC-H04:* the detonation emits one damage event and one `sfx.explosion_a` cue; the bomb despawns within 1 tick of detonating. |
| H-05 | `hazard.trap_dungeon` | `shorepine-kenney/3d/mini-dungeon/trap.glb` | `hazard` | `show`, `hide`, `show-hide` — a retracting dungeon trap. | *AC-H05:* the trap is harmful only while the `show` clip is past 50 %. |
| H-06 | `hazard.lava_pool` | `shorepine-kenney/3d/platformer/block-snow-low.glb` (bedding) + a volume | `hazard` | A lava **volume** with a surface height; falling in emits environment damage. | *AC-H06:* the volume's `surface_y` matches the visual surface within 0.1 m; the damage cooldown prevents repeat damage within 30 ticks. |
| H-07 | `hazard.fireball` | `shorepine-kenney/3d/factory/pipe-large-long.glb` (emitter) | `hazard` | A horizontal projectile from an emitter; `REQ-C-013`. | *AC-H07:* the fireball has a non-empty attack hitbox and a telegraph of `TUNE 0.6 s` before the first shot. |
| H-08 | `hazard.crusher` | `shorepine-kenney/3d/platformer/block-moving-large.glb` | `hazard` | A descending ceiling block; emits `"crush"` damage. | *AC-H08:* the crusher's damage type is `crush`, distinct from `environment`. |
| H-09 | `hazard.pit` | *(no mesh)* | — | A kill-floor **volume**, not a tile. | *AC-H09:* crossing the volume's plane triggers the death event; the `grate` material suppresses it (`LINT-029`). |
| H-10 | `hazard.current` | *(no mesh — a water volume property)* | — | A directional current inside a water volume. | *AC-H10:* the current's acceleration is applied inside the water volume only, and only while submerged. |
| H-11 | `hazard.wind_gust` | *(no mesh — a wind volume property)* | — | A directional wind volume. | *AC-H11:* the wind is applied **after** gravity and **before** integration, so the trajectory is jitter-free (`REQ-A-010`). |
| H-12 | `hazard.waterfall` | *(no mesh — a water volume with a vertical current)* | — | A falling curtain of water. | *AC-H12:* the current is vertical with magnitude `TUNE 6 m/s²`; the player can swim upward against it at `TUNE 60 %` of its speed. |
| H-13 | `hazard.ashfall` | *(no mesh — a timed hazard volume)* | `hazard` | Region 7's falling ash. | *AC-H13:* the ash damages only while a `TUNE 2 s` cycle is in its "falling" phase, and the phase is visible in the light rig's flicker cue. |
| H-14 | `hazard.electrical` | `shorepine-kenney/3d/factory/structure-tall.glb` (the submerged pylon) + a water volume | `hazard` | Region 3's submerged electrical pylon — the fourth aquatic thing `REQ-C-011` names, handed over from the entities board (`XN-ENT-14`). It electrifies the water volume it stands in. | *AC-H14:* the pylon's hitbox is non-empty and is active only while its `charged` state is on; the charge cycle is telegraphed by the light rig's flicker; contact inside the volume emits one `environment` damage event per cooldown window; and the water collision mask rejects the pylon for land-only queries. |

### 6.7 Collectables and items (`REQ-D-006`, `REQ-D-007`)

| # | Id | Asset path | Kind | Behaviour | Acceptance test |
|---|---|---|---|---|---|
| I-01 | `item.coin_bronze` | `shorepine-kenney/3d/platformer/coin-bronze.glb` | `currency` | +1 coin, `TUNE 200` score. | *AC-I01:* collecting increments the coin counter exactly once; the same coin after a reload adds nothing (`REQ-B-017`). |
| I-02 | `item.coin_silver` | `shorepine-kenney/3d/platformer/coin-silver.glb` | `currency` | +1 coin, `TUNE 500` score. | *AC-I02:* as I-01, with the silver value. |
| I-03 | `item.coin_gold` | `shorepine-kenney/3d/platformer/coin-gold.glb` | `currency` | +1 coin, `TUNE 1000` score. | *AC-I03:* as I-01, with the gold value. |
| I-04 | `item.star_score` | `shorepine-kenney/3d/platformer/star.glb` | `score_token` | A score token worth `TUNE 5000`. | *AC-I04:* as I-01. |
| I-05 | `item.jewel_relic` | `shorepine-kenney/3d/platformer/jewel.glb` | `score_token` | A relic; counts toward `REQ-B-020`'s collectible total. | *AC-I05:* the completion percentage counts this collectible separately from the level count (`REQ-B-020` acceptance). |
| I-06 | `item.heart` | `shorepine-kenney/3d/platformer/heart.glb` | `restorative` | Restores `TUNE 1` health point. | *AC-I06:* it never exceeds the maximum health and never revives a dead player. |
| I-07 | `item.growth_mushroom` | `shorepine-kenney/3d/platformer/mushrooms.glb` | `power_up` | Growth power state. | *AC-I07:* it upgrades the power state by one step and downgrades by one on damage, per the PLAYER board's FSM. |
| I-08 | `item.neg_spore` | `shorepine-kenney/3d/platformer/mushrooms.glb` | **`negative`** | A negative pickup; **harms** and grants nothing. | *AC-I08:* the pickup invokes the damage path and increments **no** positive counter. The manifest's `kind` is `negative` and `harm: true`; a `negative` item may not carry a `power_state` effect (architecture §5.4 validation). |
| I-09 | `item.neg_cinder` | `shorepine-kenney/3d/platformer/rocks.glb` | **`negative`** | A second negative pickup, visually distinct from I-08 by silhouette **and** colour. | *AC-I09:* as I-08, and the two negative items are distinguishable without colour (shape + a distinct sparkle cue). |
| I-10 | `item.extra_life` | `shorepine-kenney/3d/platformer/star.glb` | `extra_life` | +1 life, capped at the ruleset's `max_lives`. | *AC-I10:* the life count never exceeds `max_lives` and the extra life is awarded exactly once. |
| I-11 | `item.emergence_mushroom` | `shorepine-kenney/3d/platformer/mushrooms.glb` | `power_up` | The **emergence** variant: rises out of a block over `TUNE 24` ticks, is delayed-pickup-able, then falls. | *AC-I11:* the item never spawns inside solid geometry; it rises `TUNE 1.1 m/s`, is pickable only once it has cleared the block's top face, and after leaving the block it obeys gravity (`REQ-D-006`). |

### 6.8 Carryables (`REQ-A-013` support)

| # | Id | Asset path | Weight class | Behaviour | Acceptance test |
|---|---|---|---|---|---|
| K-01 | `carry.crate_light` | `shorepine-kenney/3d/platformer/crate.glb` | `light` | Carryable, throwable. | *AC-K01:* while carried it has **no collider**; on release it collides again and carries the release velocity. |
| K-02 | `carry.crate_heavy` | `shorepine-kenney/3d/platformer/crate-strong.glb` | `heavy` | Carryable only by a profile with `carry_strength ≥ heavy`. | *AC-K02:* a profile below the threshold cannot lift it; the grab attempt emits a "too heavy" cue and changes nothing. |
| K-03 | `carry.barrel` | `shorepine-kenney/3d/platformer/barrel.glb` | `medium` | Carryable, throwable; rolls when released. | *AC-K03:* a thrown barrel retains the thrower's `last_attacker_id` through to any boss it hits (`REQ-C-018`). |
| K-04 | `carry.pallet_industrial` | `shorepine-kenney/3d/platformer/crate-item.glb` | `heavy` | The Region 7 puzzle weight. | *AC-K04:* dropping it onto `platform.weight_sensitive` (P-07) sinks that platform. |

### 6.9 Signage and world dressing

| # | Id | Asset path | Role | Acceptance test |
|---|---|---|---|---|
| G-01 | `object.sign_post` | `shorepine-kenney/3d/platformer/sign.glb` | The tutorial sign; carries a `text_key` and a facing. | *AC-G01:* the sign's `text_key` resolves in the locale table and the sign faces the lane (`rotation_y` magnitude ≤ 30° toward the lane centre). |
| G-02 | `object.arrow_marker` | `shorepine-kenney/3d/platformer/arrow.glb` | A directional hint at a fork. | *AC-G02:* the arrow's facing matches the direction of the exit it marks, within 10°. |
| G-03 | `object.arrow_marker_pair` | `shorepine-kenney/3d/platformer/arrows.glb` | A two-way fork marker. | *AC-G03:* the two arrows point at two different, existing exits. |
| G-04 | `object.pole` | `shorepine-kenney/3d/platformer/poles.glb` | Vertical dressing and a climb hint. | *AC-G04:* it is `props[]`-only — it carries no collider (`LINT-013`). |
| G-05 | `object.lantern_grave` | `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/candle_thin.gltf` | Region 6 light source and the visibility puzzle's key light. | *AC-G05:* the lantern is registered in the stage's `light_rig.point_lights` and is the only source inside the maze volume. |
| G-06 | `object.gravestone` | `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/grave_B.gltf` | Region 6 dressing. | *AC-G06:* no collider; `props[]` only. |
| G-07 | `object.crypt` | `shorepine-kenney/3d/graveyard/crypt-a.glb` | Region 6/1 boss-arena dressing. | *AC-G07:* no collider. |
| G-08 | `object.bush` | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Bush.glb` | Region 1/4 dressing. | *AC-G08:* no collider. |
| G-09 | `object.grass_tuft` | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Grass.glb` | Region 1 dressing. | *AC-G09:* no collider. |
| G-10 | `object.tree_stylised` | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Tree-aVOxaHRPWe.glb` | Region 4 dressing. | *AC-G10:* no collider; its measured bbox is used to keep the lane clear of overhang. |
| G-11 | `object.dead_tree` | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Dead Tree.glb` | Region 8 storm dressing. | *AC-G11:* no collider. |
| G-12 | `object.hex_tower` | `shorepine-kenney/3d/hexagon/unit-wall-tower.glb` | Region 2/3 landmark dressing. | *AC-G12:* no collider. |
| G-13 | `object.watermill` | `shorepine-kenney/3d/hexagon/building-watermill.glb` | Region 3 landmark; animated (`animation` clip). | *AC-G13:* the `animation` clip plays on a loop and the wheel's rotation is continuous across the loop seam. |
| G-14 | `object.corpse_marker` | `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/gravemarker_A.gltf` | Region 6 dressing. | *AC-G14:* no collider. |
| G-15 | `object.arch_gate` | `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/arch_gate.gltf` | Region 6 maze entrance dressing. | *AC-G15:* no collider. |

---

## 7. Presentation

### 7.1 The background rig

The 3D contract §1 replaces the 2D background layer with a **separate visual rig**: skybox
+ parallax backdrop planes + fog volume. A rig is data, in
`src/content/backgrounds/<id>.background.json`, and a stage names it by `background.rig_id`.

```json
{
  "schema_version": 1,
  "id": "bg.meadow_day",
  "skybox_asset_id": "polyhaven.aarfontein_dawn_2",
  "skybox_rotation_deg": 12.0,
  "skybox_intensity": 0.85,
  "backdrop_layers": [
    {"id": "far_trees", "asset_id": "kenney.nature.tree_pineDefaultB",
     "parallax_factor": 0.12, "tint": [0.62, 0.70, 0.58], "billboard": false,
     "instances": 14, "span_m": 260, "z_offset_m": -34.0}
  ],
  "fog": {"enabled": true, "colour": [0.62, 0.74, 0.86], "density": 0.006,
          "height_falloff": 0.018, "sun_shaft": true},
  "clear_colour": [0.62, 0.74, 0.86]
}
```

**The 14 biome rigs and their 12 HDRs.** The architecture board §8.5 measured the ship set:
only **12** of the 80 PolyHaven HDRs fit the budget, and the selection "is a content
decision recorded per biome in the manifest". This is that decision. Each rig's
`skybox_asset_id` names one of the 12; several rigs share an HDR and differ by
`skybox_rotation_deg`, `skybox_intensity`, fog and backdrop.

| Rig id | Biome | Skybox asset (path) | Backdrop layer (asset path) | Fog |
|---|---|---|---|---|
| `bg.meadow_day` | Region 1, `overworld` | `polyhaven-cc0-hdris-textures-models.zip!/assets/polyhaven/aarfontein_dawn_2/aarfontein_dawn_2_1k.hdr` | `shorepine-kenney/3d/nature/tree_pineDefaultB.glb` | on, blue-white, `density 0.006` |
| `bg.meadow_dusk` | Region 1, stage 5 | `…/assets/polyhaven/autumn_meadow/autumn_meadow_1k.hdr` | `shorepine-kenney/3d/nature/tree_palmTall.glb` | on, amber, `density 0.009` |
| `bg.meadow_storm` | Region 1 bonus | `…/assets/polyhaven/aarfontein_dusk/aarfontein_dusk_1k.hdr` | `shorepine-kenney/3d/nature/rock_tallH.glb` | on, heavy, `density 0.014` |
| `bg.sirocco_noon` | Region 2, `desert` | `…/assets/polyhaven/aarfontein_pan/aarfontein_pan_1k.hdr` | `shorepine-kenney/3d/pirate/rocks-a.glb` | on, white-gold, `density 0.004` |
| `bg.sirocco_dusk` | Region 2 dusk | `…/assets/polyhaven/aarfontein_dusk/aarfontein_dusk_1k.hdr` | `shorepine-kenney/3d/hexagon/unit-wall-tower.glb` | on, amber-violet, `density 0.010` |
| `bg.vault_interior` | Region 2, `underground` | `…/assets/polyhaven/abandoned_bakery/abandoned_bakery_1k.hdr` | `shorepine-kenney/3d/retro-fantasy/battlement.glb` | on, warm dark, `density 0.020` |
| `bg.tidereach_shallow` | Region 3, `underwater` | `…/assets/polyhaven/aristea_wreck/aristea_wreck_1k.hdr` | `shorepine-kenney/3d/hexagon/river-start.glb` | on, cyan, `density 0.030` |
| `bg.tidereach_deep` | Region 3 deep | `…/assets/polyhaven/abandoned_waterworks/abandoned_waterworks_1k.hdr` | `shorepine-kenney/3d/hexagon/unit-house.glb` | on, indigo, `density 0.055` |
| `bg.titanroot_dawn` | Region 4, `forest` | `…/assets/polyhaven/autumn_forest_02/autumn_forest_02_1k.hdr` | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Twisted Tree-7PDBpElkQr.glb` | on, green-gold, `density 0.016` |
| `bg.cirrus_noon` | Region 5, `sky` | `…/assets/polyhaven/aarfontein_pan/aarfontein_pan_1k.hdr` (rotated 140°) | `shorepine-kenney/3d/space/platform_side.glb` | on, white, `density 0.002` |
| `bg.palehush_dusk` | Region 6, `ice` | `…/assets/polyhaven/alps_field/alps_field_1k.hdr` | `shorepine-kenney/3d/platformer/tree-snow.glb` | on, blue-violet, `density 0.018` |
| `bg.palehush_whiteout` | Region 6 low-visibility | `…/assets/polyhaven/alps_field/alps_field_1k.hdr` (intensity 0.35) | `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/tree_dead_large.gltf` | on, near-white, `density 0.075` |
| `bg.cinderforge_ember` | Region 7, `fortress` | `…/assets/polyhaven/abandoned_factory_canteen_01/abandoned_factory_canteen_01_1k.hdr` | `shorepine-kenney/3d/factory/pipe-large-long.glb` | on, ember orange, `density 0.022` |
| `bg.stormwrack_gale` | Region 8, `airship` | `…/assets/polyhaven/approaching_storm/approaching_storm_1k.hdr` | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Dead Tree.glb` | on, grey-blue, `density 0.026` |

*(`…/` abbreviates `polyhaven-cc0-hdris-textures-models.zip`; the full path form is
`polyhaven-cc0-hdris-textures-models.zip!/assets/polyhaven/<scene>/<scene>_1k.hdr`.)*

**Three rigs reuse one HDR** (`bg.meadow_storm` and `bg.sirocco_dusk` share
`aarfontein_dusk`; `bg.cirrus_noon` reuses `aarfontein_pan`). `REQ-B-007` requires that
"each biome loads a distinct hazard set, material set and audio/visual profile id; two
variants sharing a profile id fail" — the **profile id** is the rig id, not the HDR file,
so distinct rigs are fine. `LINT-027` checks rig-id distinctness across variants, and
`LINT-028` checks that no two `variant` values share a rig id.

**Backdrop layers are 3D.** They are instanced named assets placed behind the lane at a
fixed `z_offset_m`, never sprites and never a 2D image plane. The 2D parallax layers in
`05-environments.zip` and `07-vfx.zip` are **licence-pending** (ASSET-SURVEY §5) and are
therefore *not* used in the release rig; `asset_audit.py` rejects them under
`cc0_3d_only`.

**Parallax acceptance test (`AC-D017-1`).** For each rig, a camera displacement of
`+10 m` along X moves layer `i` by exactly `parallax_factor[i] × 10 m` in screen space,
within 1 cm. A layer whose factor is 0.12 moves 1.2 m; the skybox moves 0 m.

### 7.2 Palette variants

A palette is a named set of colour and light values. A stage names one via `palette`. The
palette changes the **look**, never the behaviour: two stages with different palettes and
the same placements behave identically.

| Palette id | Region | Sky tint | Fog colour | Key light | Ambient | Accent |
|---|---|---|---|---|---|---|
| `meadow_day` | 1 | `#9FC4E2` | `#9EBDDB` | `#FFF5DC` 1.15 | 0.45 | `#7FBF5E` |
| `meadow_dusk` | 1 | `#E8B27A` | `#C89A72` | `#FFD9A0` 0.95 | 0.38 | `#B08A4E` |
| `meadow_storm` | 1 | `#8A93A6` | `#7E879A` | `#C9D4E6` 0.70 | 0.42 | `#5F7A52` |
| `sirocco_noon` | 2 | `#F2E3C2` | `#EAD9B4` | `#FFF6E0` 1.35 | 0.50 | `#C9A15C` |
| `sirocco_dusk` | 2 | `#C48A6A` | `#9C6A5E` | `#FFC58A` 0.90 | 0.36 | `#7E4A44` |
| `tidereach_shallow` | 3 | `#7FC8D8` | `#6FB6C8` | `#DFF6FF` 0.80 | 0.48 | `#E9C46A` |
| `tidereach_deep` | 3 | `#2B4A6B` | `#1E3550` | `#9FD4E8` 0.55 | 0.30 | `#3E7C8C` |
| `tidereach_dusk` | 3 | `#E0A87E` | `#B57E64` | `#FFD0A0` 0.95 | 0.38 | `#4E7F8C` |
| `titanroot_dawn` | 4 | `#C8D9A8` | `#A8BC8E` | `#FFF2C4` 1.10 | 0.44 | `#4F7A3A` |
| `titanroot_deep` | 4 | `#6E8C86` | `#5A766F` | `#D8F0DC` 0.75 | 0.40 | `#3C5C42` |
| `cirrus_noon` | 5 | `#CFE8F7` | `#BFDCEF` | `#FFFFFF` 1.30 | 0.55 | `#8FB6D8` |
| `cirrus_gold` | 5 | `#F3C98A` | `#E0AE7C` | `#FFE3AE` 1.10 | 0.46 | `#B0794E` |
| `cirrus_violet` | 5 | `#9C8CC4` | `#7C6EA8` | `#E4DCFF` 0.85 | 0.34 | `#5A4C86` |
| `palehush_dusk` | 6 | `#AEB8D8` | `#9AA6C8` | `#E6ECFF` 0.80 | 0.44 | `#6E7EA8` |
| `palehush_blue` | 6 | `#8E9CBE` | `#7C8AAC` | `#D6E0F5` 0.65 | 0.40 | `#566A96` |
| `palehush_storm` | 6 | `#D8DEE8` | `#C8D0DC` | `#F2F6FF` 0.55 | 0.52 | `#7C88A0` |
| `cinderforge_ember` | 7 | `#3A2A26` | `#2E211E` | `#FF9A4A` 1.05 | 0.26 | `#C2522A` |
| `cinderforge_steel` | 7 | `#5A6470` | `#4A525C` | `#C8D6E8` 0.85 | 0.34 | `#8C3A2A` |
| `cinderforge_ash` | 7 | `#6A6660` | `#57544F` | `#D8D2C8` 0.70 | 0.38 | `#8A2E22` |
| `stormwrack_gale` | 8 | `#5C6A78` | `#4E5C6A` | `#C0D0E0` 0.80 | 0.34 | `#3A4A5A` |
| `stormwrack_eye` | 8 | `#2E2438` | `#241C2E` | `#B090D0` 0.70 | 0.24 | `#6A4A8A` |
| `stormwrack_apex` | 8 | `#1E1C24` | `#18161E` | `#E8E4F0` 0.95 | 0.22 | `#7A5AC0` |

**Palette acceptance test (`AC-D017-2`).** Switching a stage's `palette` at runtime
changes no gameplay measurement: the same 1 000-tick input trace produces an identical
player trajectory under all 23 palettes.

**`stormwrack_apex` and reduced flashing.** This palette carries lightning flashes. Under
the `reduced_flashing` accessibility option the flash is replaced by a **steady** rim light
and the screen shake amplitude is set to zero; the cue is still communicated by the
lightning **sound** and by a non-colour rim outline on the player. This is the
accessibility content rule of §8.5.

### 7.3 Screen transitions (`REQ-B-002`)

| From → To | Transition | Duration `TUNE` | Inventory rule |
|---|---|---|---|
| Boot → Title | logo fade from black | 0.6 s | n/a |
| Title → Profile select | horizontal wipe, `ui/UI Adventure Pack` border wipe | 0.4 s | profile choice sets `profile_id`, never mutates `inventory` |
| Title → Options | settings panel slide-down | 0.2 s | no change — settings are applied to the live session, not to `inventory` |
| Options → Title | panel slide-up | 0.2 s | no change |
| Profile select → World map | iris-out | 0.5 s | no change |
| World map → Stage | iris-in to black, load, iris-out | 0.35 s + load | the stage's `entry_spawn` is authoritative; the world map does **not** write to `inventory` |
| World map → Credits | slow fade to white | 2.0 s | **no change** — the credits screen is reachable only when `flag.endgame_complete` is **already set** (the finale sets it), so the transition reads the flag and never writes it |
| Credits → Title | slow fade from white | 1.5 s | **no change** — the credits roll ends and the game returns to the title |
| Stage → Pause | freeze + blur, no transition | 0.15 s | `timer_policy.pauses_in_menu` decides whether the timer stops |
| Pause → Stage | freeze released, fade in | 0.15 s | **no change** — resuming restores the exact simulation state the pause froze |
| Pause → Options | slide-in panel | 0.2 s | no change |
| Options → Pause | slide-out panel | 0.2 s | **no change** — the options panel is an overlay on the paused stage, so returning leaves the stage paused |
| Stage → Victory | reward card slide-up | 1.2 s | `goal_reward` applied once |
| Victory → World map | fade | 0.5 s | the stage's `save_flags` are applied **once**; the world's `completed_exits` gains `<node>:<exit>` exactly once |
| Stage → Game over | fade to black | 0.8 s | lives decremented **once**; the continue screen resumes at the last checkpoint |
| Game over → Stage | fade in from black | 0.5 s | no change — the continue resumes at the last checkpoint; the life was already decremented by `stage → game over` |
| Game over → World map | fade | 0.6 s | no change — quitting the game-over screen returns to the map (this is the zero-lives path) |
| Stage → Title | fade to black, then the title screen | 0.5 s + 0.4 s | no change — quitting a stage discards the run and returns to the title; nothing is written to `inventory` |
| Any → Boot (quit) | fade to black | 0.4 s | the atomic save has already completed (architecture §6) |

**Nineteen transitions, two of which change the snapshot and one of which changes
persistent state outside it.** The table is complete: every screen the game can
occupy has an entry out of it, and the two menu screens reachable as panels
(`Pause`, `Options`) have **both** directions, so a developer never has to guess
how the player returns.

**Overlays are not scene transitions.** `screen.hud`, `screen.rebind`,
`screen.save_slots`, `screen.confirm` and `screen.tutorial_prompt` **overlay** the
scene beneath them — they never replace it. They are therefore deliberately **not**
rows in this table: `rebind` and `save_slots` are reached from `screen.options` and
return to it, and `confirm` is a modal on whatever raised it. A table that listed
them would claim transitions that do not change the active scene; §7.7.2's edge
list omits them for exactly that reason, and says so.

**Acceptance test (`AC-B002`).** Across all transitions above, the snapshot of
`(coins, lives, inventory.slots, inventory.reserve, power_state, score)` taken **before**
the transition and **after** it are identical, except for the **two** transitions that are
*defined* to change it: **stage → victory** adds the goal reward (which increments
`score` through the stage's `score_table_ref`), and **stage → game over** decrements a
life. A transition that changes any other field fails.

The **third** transition that changes persistent state — **victory → world map**,
which applies the stage's `save_flags` and records `completed_exits` — writes to
`flags` and `world_graph`, which are **outside** the snapshot above. It is therefore
verified by the save-schema tests (`REQ-E-006`), not by this one; `AC-B002` asserts
only that it does **not** disturb the snapshot.

### 7.4 The light rig

A stage's `light_rig` names a preset and overrides it. The presets:

| Preset id | Key intensity | Key angle | Fill | Rim | Ambient | Shadow | Use |
|---|---|---|---|---|---|---|---|
| `light.day_soft` | 1.15 | 38° | 0.45 | 0.30 | 0.45 | soft, 1 split | Regions 1, 2, 4, 5 |
| `light.day_harsh` | 1.35 | 62° | 0.25 | 0.20 | 0.50 | hard, 4 splits | `sirocco_noon` |
| `light.dusk_warm` | 0.95 | 12° | 0.35 | 0.35 | 0.38 | soft | `meadow_dusk`, `tidereach_dusk` |
| `light.underwater` | 0.80 | 90° | 0.55 | 0.15 | 0.48 | none | Region 3 |
| `light.cavern` | 0.45 | 0° (point) | 0.20 | 0.25 | 0.22 | none | underground variants |
| `light.gloom` | 0.60 | 20° | 0.18 | 0.40 | 0.26 | soft | Region 6 |
| `light.forge_ember` | 1.05 | 30° | 0.30 | 0.45 | 0.26 | hard, 2 splits | Region 7 |
| `light.storm` | 0.80 | 45° | 0.40 | 0.30 | 0.34 | soft | Region 8 |
| `light.storm_apex` | 0.95 | 0° (flash) | 0.25 | 0.55 | 0.22 | hard | `stormwrack_apex` |

**Point lights** are declared per stage in `light_rig.point_lights[]` — every one names a
named asset as its emitter geometry (e.g. `object.lantern_grave`, the KayKit candle) so
that the light has a physical source in the world. A point light with no emitter asset is
an error (`LINT-025`).

**Acceptance test (`AC-D017-3`).** For every one of the 14 rigs in §7.1, the rendered
mean luminance of the region of the frame occupied by the lane is within
`TUNE ±12 %` of the value recorded in the rig's reference table, and no material in the
frame is pure black or pure white (clipped pixels = 0).

### 7.5 The FX list (`REQ-D-016`)

FX are **pooled, non-physical** effects. They never appear in the physics scene tree, and
they never change a gameplay measurement.

| FX id | Trigger | Binding | Tier | Acceptance test |
|---|---|---|---|---|
| `fx.skid_dust` | The player enters the `skid` state | 3 short-lived instances of `kenney.platformer.grass.glb`, scaled to 0.35 and spun | A (3D) | The effect node exists only in the FX pool, never in the physics tree; no FX instance survives more than `TUNE 0.5 s`. |
| `fx.landing_puff` | The player lands with `vy < -6` | `kenney.platformer.stones.glb` scaled 0.4 | A | As above; the number of instances scales with impact speed, capped at 4. |
| `fx.hit_flash` | Any damage event | An emissive colour override on the struck actor for `TUNE 0.15 s` | A | The flash is **not** a screen-space white frame (that would be a flashing hazard); it is confined to the actor's own material. Under `reduced_flashing` it is replaced by a one-shot outline. |
| `fx.item_emergence` | A bump block emits its payload | The item asset rises out of the block | A | The emergence is the **item's own transform**, not a separate effect; it obeys `REQ-D-006`'s free-space assertion. |
| `fx.item_land` | An emerging item hits the floor | `kenney.platformer.grass.glb` scaled 0.3 | A | As `fx.landing_puff`. |
| `fx.coin_sparkle` | A coin is collected | A 0.4 s emissive pulse on the coin before it despawns | A | The coin's scale does not change (a scale pulse would read as a size change to the player's eye). |
| `fx.block_bump` | A bump block is struck | A 0.12 s vertical offset on the block, eased | A | The offset is a visual transform on the **same** collider; the collider never moves. |
| `fx.switch_toggle` | A switch changes state | The switch's own `toggle-on` / `toggle-off` clip | A | The clip is the asset's own; the effect never cross-fades to an authored clip file. |
| `fx.door_swing` | A door opens or closes | The door's own `open` / `close` clip | A | The clip is the asset's; the collider toggles at the clip's 50 % point. |
| `fx.ember_rise` | Region 7 ambience | 5 instances of `kenney.platformer.stones.glb` scaled 0.15, rising | A | No FX instance is a collider. |
| `fx.snow_drift` | Region 6 ambience | 8 instances of `kenney.platformer.grass.glb` scaled 0.12, falling and spinning | A | As above. |
| `fx.storm_debris` | Region 8 ambience | 6 instances of `kenney.platformer.grass.glb` scaled 0.15, tumbling on X | A | As above. |
| `fx.spray_rock` | The player enters or leaves a water volume | 6 instances of `kenney.platformer.stones.glb` scaled 0.18 | A | As above; the Tier B alternative is disabled in a release build. |
| `fx.lightning_flash` | Region 8 lightning hazard | A light-rig intensity override | A | Under `reduced_flashing` the intensity override is capped at `TUNE 0.15` above the base and the screen shake is zero. |
| `fx.boss_telegraph` | A boss enters an attack phase | The boss's own rig clips + a light-rig colour shift | A | The telegraph begins **before** the attack's damage window, by at least `TUNE 0.6 s`. |

**Tier A** effects use only named 3D library assets and light/material changes. The 2D
particle PNGs in `07-vfx.zip` (`smoke-particles/PNG`, `splat-pack/PNG`,
`oga-lens-flares-and-particles`, `oga-simple-colored-particle-lights`,
`light-masks/Default`) and `05-environments.zip` (`oga-6-short-water-splashes`,
`oga-cartonny-tree-leaves-and-flowers`) are **Tier B**: they are licence-pending, they are
**excluded** from the `cc0_3d_only` release profile, and they are **included** in
`cc0_3d_plus_ui_2d_pending`, where the build is marked non-releasable. Every Tier B
effect has a named Tier A substitute above, so no region is visually incomplete in a
release build.

**Acceptance test (`AC-D016-1`).** A headless test walks a scripted path that triggers
every Tier A effect and asserts that (a) zero `CollisionObject3D` nodes exist in the FX
pool, (b) the player's trajectory is byte-identical with all effects enabled and all
effects disabled, and (c) no effect instance outlives its declared lifetime.

### 7.6 The audio mixer (`REQ-D-015`)

#### 7.6.1 The corpus — the honest picture

The entire audio corpus in the repository is **78 audio file paths**, resolving to **66 unique sounds** — 52 `.ogg` (40 Kenney Desert Shooter + 12 `Fantozzi` footsteps), 12 `.flac` (the same 12 footsteps, each present at **two** paths) and 2 `.wav` (gunshot files no cue needs). **52 `.ogg` ship**, and **there is no music**:

| Source | Files | Content |
|---|---|---|
| `fps-buildings-env-kit.zip!/fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/` | 40 `.ogg` | `jump-a…f` (6), `coin-a…d` (4), `hurt-a…e` (5), `fall-a/b` (2), `explosion-a…c` (3), `lose-a…d` (4), `move-a…d` (4), `select-a` (1), `error-a…c` (3), `shoot-a…h` (8) |
| `fps-asset-kit.zip!/fps-asset-kit/sfx/footsteps/Fantozzi-footsteps/ogg/` | 12 `.ogg` | `Fantozzi-{Sand,Stone}{L,R}{1,2,3}` — the 12 footstep variants |
| `fps-asset-kit.zip!/fps-asset-kit/sfx/footsteps_flac/` and `…/Fantozzi-footsteps/flac/` | 24 `.flac` rows = the same **12** footsteps, each at **two** paths | Alternates of the shipped OGG — not shipped separately |
| `fps-asset-kit.zip!/fps-asset-kit/sfx/gunshots/` | 2 `.wav` | `game_gunshot.wav`, `sniper_shot.wav` — no cue needs them; not shipped |

The `oga-*sounds` directories in `01-characters.zip`, `02-fantasy.zip` and `03-scifi.zip`
contain **only `SOURCE.md` stubs — no audio binaries**. There is no music file anywhere in
the corpus. `GAP-A1`, `GAP-3D-002`.

#### 7.6.2 The bus graph

```
master
├── music            (looping cues; currently silent — see §7.6.4)
├── ambience         (derived beds — mixed in-engine from the shipped SFX per `G-06`)
├── sfx_action       (jump, coin, hurt, fall, explosion, lose, move, shoot)
├── sfx_ui           (select, error)
└── sfx_footstep     (Fantozzi surface steps)
```

| Bus | Ducking | Priority | Notes |
|---|---|---|---|
| `master` | — | — | The user-facing volume; `master_volume` in settings. |
| `music` | ducked by −8 dB under `sfx_action` during a boss, and by −6 dB when the pause menu opens | 10 | **At most one active loop at any time** (`REQ-D-015` acceptance). Cross-fade `TUNE 0.8 s`. |
| `ambience` | ducked by −6 dB under `music` | 5 | At most one loop. |
| `sfx_action` | raised +2 dB during a boss's vulnerability window | 20 | Unlimited voices, but the **priority table** resolves collisions deterministically: highest priority wins, ties broken by cue id (stable, no RNG — architecture §7.5 step 4). |
| `sfx_ui` | raised +3 dB while a menu is open | 30 | Never ducked. |
| `sfx_footstep` | — | 15 | Surface-driven; the material chooses the family. |

#### 7.6.3 The cue registry

Every cue id resolves to one of **four** things, and to nothing else (architecture §7.5
step 1): a **shipped file**, an explicit `DERIVED` marker (the content is mixed in-engine
from shipped assets by a named rule — currently only the ambience beds, per `G-06`), an
explicit `UNSOURCED` marker, or an explicit `SILENT` marker.

| Cue id | Category | Resolution | File |
|---|---|---|---|
| `sfx.jump_a` … `sfx.jump_f` | action | shipped | `fps-buildings-env-kit.zip!/fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/jump-a.ogg` … |
| `sfx.coin_a` … `sfx.coin_d` | action | shipped | `fps-buildings-env-kit.zip!/fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/coin-a.ogg` … |
| `sfx.hurt_a` … `sfx.hurt_e` | action | shipped | `fps-buildings-env-kit.zip!/fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/hurt-a.ogg` … |
| `sfx.fall_a`, `sfx.fall_b` | action | shipped | `fps-buildings-env-kit.zip!/fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/fall-a.ogg`, `fall-b.ogg` |
| `sfx.explosion_a` … `sfx.explosion_c` | action | shipped | `fps-buildings-env-kit.zip!/fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/explosion-a.ogg` … |
| `sfx.lose_a` … `sfx.lose_d` | action | shipped | `fps-buildings-env-kit.zip!/fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/lose-a.ogg` … |
| `sfx.move_a` … `sfx.move_d` | action | shipped | `fps-buildings-env-kit.zip!/fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/move-a.ogg` … |
| `sfx.shoot_a` … `sfx.shoot_h` | action | shipped | `fps-buildings-env-kit.zip!/fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/shoot-a.ogg` … |
| `sfx.select_a` | ui | shipped | `fps-buildings-env-kit.zip!/fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/select-a.ogg` |
| `sfx.error_a` … `sfx.error_c` | ui | shipped | `fps-buildings-env-kit.zip!/fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/error-a.ogg` … |
| `sfx.step_sand_l1..l3`, `sfx.step_sand_r1..r3` | footstep | shipped | `fps-asset-kit.zip!/fps-asset-kit/sfx/footsteps/Fantozzi-footsteps/ogg/Fantozzi-SandL1.ogg` … `Fantozzi-SandR3.ogg` … |
| `sfx.step_stone_l1..l3`, `sfx.step_stone_r1..r3` | footstep | shipped | `fps-asset-kit.zip!/fps-asset-kit/sfx/footsteps/Fantozzi-footsteps/ogg/Fantozzi-StoneL1.ogg` … `Fantozzi-StoneR3.ogg` … |
| `music.region01.overworld` · `.boss` · `.bonus` | music | **`UNSOURCED`** | — |
| `music.region02.desert` · `.boss` · `.bonus` | music | **`UNSOURCED`** | — |
| `music.region03.underwater` · `.boss` · `.bonus` | music | **`UNSOURCED`** | — |
| `music.region04.forest` · `.boss` · `.bonus` | music | **`UNSOURCED`** | — |
| `music.region05.sky` · `.boss` · `.bonus` | music | **`UNSOURCED`** | — |
| `music.region06.ghost` · `.boss` · `.bonus` | music | **`UNSOURCED`** | — |
| `music.region07.fortress` · `.boss` · `.bonus` | music | **`UNSOURCED`** | — |
| `music.region08.storm` · `.boss` · `.finale` | music | **`UNSOURCED`** | — |
| `ambience.region01.meadow` … `ambience.region08.storm` (8) | ambience | **`DERIVED`** | No file — **derived in the mixer** from the 52 shipped `.ogg` by randomised, pitch-preserving one-shot scheduling, per `G-06` (ADOPTED option (c)). The bed is granular texture, not a sustained loop |
| `music.disabled` | music | `SILENT` | The explicit marker used when a build ships with the music bus disabled. |

**Cue count.** Shipped: **40 Kenney Desert Shooter `.ogg` — of which 1 `select` and 3
`error` are UI cues — plus 12 `Fantozzi` footsteps = 52 `.ogg`.** (The earlier figure of
"56" counted `select-a` and `error-a…c` twice, once as action cues and once as UI cues;
the shipped file count is **52**.) Plus
**27 music** cues marked `UNSOURCED` (no file exists anywhere in the corpus), plus **8
ambience** cues marked `DERIVED` (produced in the mixer from the 52 shipped `.ogg` per
`G-06`),
plus **1** `SILENT` marker.
The audio gate reports `music_cues_unsourced: 27` and `ambience_cues_derived: 8` —
**a visible, counted gap, never a silent one.**

#### 7.6.4 The music gap — how this design resolves it

The gap is real and it is not solvable from the repository. This design takes the
**silence-by-default music bus with an explicit composer-supplied asset slot**, and states
the alternatives without pretending to have chosen one on the requester's behalf:

1. **What ships now.** The `music` and `ambience` buses exist, are wired, duck, cross-fade
   and stop correctly, and are **silent**. Every region and every boss already has a
   registered cue id with a documented slot. `REQ-D-015` is therefore **PARTIAL** — the
   "music switches cleanly" clause cannot be demonstrated end to end, exactly as the
   architecture board §10.4 already records.
2. **What the slot looks like.** A cue entry in `src/content/audio/cues.json`:
   `{"id": "music.region01.overworld", "bus": "music", "loop": true, "file": null,
   "resolution": "UNSOURCED", "target_lufs": -18, "fade_ms": 800, "slot": "music/region01/overworld"}`.
   `file: null` is the honest value. When a track is delivered, `file` becomes a manifest
   asset id and `resolution` becomes `SHIPPED`; **no code changes** and no content-file
   changes are needed — the cue id, the bus, the cross-fade and the ducking are already in
   place.
3. **The manifest slot.** `src/assets/asset_manifest.json` reserves an entry per cue with
   `source_path: null` and `resolution: UNSOURCED`. `asset_audit.py` reports these as
   `unsourced_cues: 27`; the release gate does **not** fail on them (a build with no
   music is a legitimate build), but the release **report** always carries the count.
4. **The ship decision is taken, not open.** `G-05` and the architecture board's `OPEN-003`
   both **adopt option (c)**: the music bus ships **silent**, no cue is fabricated, and the
   build is releasable in that state. The two options that remain *available but optional*
   are (a) commission original music (8 region cues + 8 boss cues + 1 finale cue + 8
   ambience beds = 25 tracks) and (b) licence CC0 music from outside the corpus and
   register it in the manifest. Either lands in a slot that **already exists** — no code
   change and no content-file change is needed; the cue id, the bus, the cross-fade and
   the ducking are already in place. **This document designs to (c) shipping and to (a) or
   (b) later landing in the same slot.** No region claims to have music it does not have.
5. **What is NOT done.** No placeholder track, no generated drone, no "music" made from
   the 78 SFX files, no silent loop pretending to be a cue. A region with an `UNSOURCED`
   cue is silent, and the build report says so.

#### 7.6.5 Acceptance tests for REQ-D-015

- **AC-D015-1 (loop exclusivity).** With 27 `UNSOURCED` music cues and 8 `DERIVED` ambience
  cues registered, the music bus state machine asserts **at most one active loop
  per bus at any time**, and a cue switch cross-fades rather than overlapping.
- **AC-D015-2 (starts, ducks, stops).** The mixer starts, ducks under `sfx_action` during
  a boss, ducks under the pause menu, and stops cleanly on scene exit — all with **no
  music loaded**. This is the part that *can* be demonstrated, and it is the part the
  architecture board records as the `PARTIAL` boundary.
- **AC-D015-3 (counted gap).** The audio gate's report contains
  `music_cues_unsourced: 27` and `ambience_cues_derived: 8`. A build whose report
  shows a different number fails the gate, because the registry and the report must
  agree.
- **AC-D015-4 (no silent substitution).** No cue id in the registry resolves to a file
  that is not a real repository audio file. The gate resolves each id and fails with
  `AUDIO-003 cue 'music.region01.overworld' resolves to no shipped file, no DERIVED marker, no UNSOURCED marker and no SILENT marker`.
- **AC-D015-5 (surface steps).** The footstep cue's family follows the collision
  material: `solid` → `sfx.step_stone_*`, `mud` / `quicksand` / `ice` → `sfx.step_sand_*`,
  `grate` → `sfx.step_stone_*` at half gain. The cue id is chosen from the material, never
  from the mesh.

### 7.7 Menu and HUD screen flow (`REQ-D-018`)

#### 7.7.1 Screens

**Ten scene screens and five overlays.** The ten *scene* screens —
`boot`, `title`, `profile`, `worldmap`, `stage`, `pause`, `options`, `victory`,
`game_over`, `credits` — are the ones §7.3's transition table moves between. The
other five — `hud`, `rebind`, `save_slots`, `confirm`, `tutorial_prompt` — are
**overlays**: they are drawn on top of a scene, they never replace it, and they
therefore have no row in the transition table.

| Screen id | Purpose | Root assets |
|---|---|---|
| `screen.boot` | The logo/loading screen the engine shows before the title; the first entry of the transition table | `shorepine-kenney/ui/UI Adventure Pack/*` |
| `screen.title` | Logo, "Press ⟨start⟩", the version line | `shorepine-kenney/ui/UI Adventure Pack/*`, `shorepine-kenney/icons/Board Game Icons/Default (64px)/*` |
| `screen.profile` | Rule-set and avatar profile selection | same |
| `screen.worldmap` | The region graph, the player's position, the completion percentage | `kenney.platformer.flag.glb` and the other node markers (§5.1) |
| `screen.stage` | The 3D stage | — |
| `screen.hud` | The in-game overlay | `kenney.platformer.coin-gold.glb` (icon), `kenney.platformer.heart.glb`, `kenney.platformer.star.glb` |
| `screen.pause` | Resume, Options, Restart, Quit | `kenney.platformer.sign.glb` |
| `screen.options` | Display, audio, gameplay, accessibility | `shorepine-kenney.zip!icons/Input Prompts/Generic/*` and `shorepine-kenney.zip!icons/Input Prompts/Keyboard & Mouse/*` for the rebind rows (`IN-017`) |
| `screen.rebind` | Per-action rebinding with a live prompt | the same input-prompt set |
| `screen.save_slots` | Three slots, each with a metadata card | `kenney.platformer.chest.glb` (slot marker) |
| `screen.victory` | The reward card, the score table, the completion tally | `kenney.platformer.star.glb`, `kenney.platformer.jewel.glb` |
| `screen.game_over` | Continue or quit, with the lives remaining | `kenney.platformer.heart.glb` |
| `screen.credits` | The rolling credit list | `kenney.platformer.flag.glb` |
| `screen.confirm` | A generic two-button confirmation | `kenney.platformer.button-round.glb` |
| `screen.tutorial_prompt` | The in-world tutorial bubble | `kenney.platformer.arrow.glb` |

#### 7.7.2 The flow graph

The flow is published as an **edge list**: one line per transition, in the same order
as §7.3's table, using the same screen names. This is deliberate. A drawn tree is
lovely and unverifiable — the only way to check that an ASCII diagram and a table
agree is to parse the diagram, and a parser that mis-reads a box-drawing character
gives false confidence. An edge list cannot be mis-read, so this one is the
**bijection by construction**: every line is a row of the table, and every row of the
table is a line here.

```
boot → title
title → profile select
title → options
options → title
profile select → world map
world map → stage
world map → credits
credits → title
stage → pause
pause → stage
pause → options
options → pause
stage → victory
victory → world map
stage → game over
game over → stage
game over → world map
stage → title
any → boot
```

**Nineteen lines, nineteen rows.** `tools/verify_design.py` parses this block and
§7.3's table and fails the build if the two edge sets differ in either direction —
a row with no line, a line with no row, or a line pointing the wrong way. It also
requires the two to be in the same order, because the block claims to be "the same
order as §7.3's table".

**This is a design-time check, and a different validator is not a substitute for
it.** `src/tools/world_map_validator.py` checks the **overworld region graph**'s
reachability obligations (§9.2) and says nothing about scene transitions; it must
not be read as a second copy of this check. The runtime counterpart of this list is
`AC-B002`: the acceptance test walks each of the nineteen edges in the running build
and asserts that the transition has exactly the effect the table's inventory rule
gives it.

**What this check does not do.** It proves the two lists *agree*. It cannot prove
the flow is *sensible* — if the table and the list both said `title → stage`, they
would agree and the game would still be wrong. Correctness of the flow is a design
decision, checked by the acceptance test and by the review; agreement is mechanical,
and that is what a gate can honestly do.

**Two edges are easy to lose and are therefore visible in their own right.**
`stage → pause` and `pause → stage` are the two halves of the pause menu: resume is
an edge of the flow, not the absence of one. `any → boot` is the quit edge; it
belongs to no screen, but it is a real row of the table, so it is listed rather
than merely described.

**Overlays are not edges.** `rebind`, `save_slots` and `confirm` are reached from
the screen beneath them and return to it, so they are overlays and not scene
transitions; they have no line here and no row in §7.3.

**The flow is checked in as data, not written into code.** The nineteen edges and
their inventory rules are stored in **`src/content/flows/scene_flow.json`** — a
content file owned by this board, in the §4.1 tree, and covered by the `flows`
content kind in the master's §8.3. The scene-flow module **loads** it; it does not
hard-code the edges, and no UI task may introduce a transition that is not in that
file. This is deliberate: the eleventh, twelfth and thirteenth review rounds each
found the flow described in two places that did not agree, and the cheapest way to
stop a fourth is to make one of the two places a file the build reads. `AC-B002`
reads the same file, so a table row and a code path cannot drift apart.

#### 7.7.3 Rules

1. **Every screen is reachable with a gamepad and a keyboard, and no action requires a
   mouse.** The mouse may be *supported* (the cursor pack exists) but is never required.
   *Acceptance test:* an automated pass walks every screen with a synthetic gamepad
   (`REQ-A-001`) and separately with a synthetic keyboard, and reaches every actionable
   control without any pointer event. The pass fails if any control is reachable only by
   pointer.
2. **Focus is always visible** and the focus order is deterministic (the same traversal
   order on every screen). The focus ring uses `shorepine-kenney/ui/Fantasy UI Borders/*`
   and is drawn as an **outline**, not a colour change, so it survives colour-blindness
   and the reduced-flashing option.
3. **No hard-coded strings.** Every label is a key in the locale table (§8.1).
4. **The rebind screen shows the physical key** using the input prompts from
   `shorepine-kenney.zip!icons/Input Prompts/Generic/` and
   `shorepine-kenney.zip!icons/Input Prompts/Keyboard & Mouse/` — the
   **trademark-free families only** (manifest row `IN-017`, `SHIPPABLE`, CC0-1.0).
   The larger `kenney-cc0-game-art-packs.zip` prompt set (2,733 files) is **measured
   but not shipped**: its families include console-manufacturer trademarks. Every
   branded family (Nintendo, PlayStation, Xbox, Meta
   Quest, Steam Deck, Playdate) is **excluded from the shipped set** — Kenney's CC0 covers
   the *art*, not the *trademarks*, and this project ships original IP only. The prompt set
   is chosen from the connected device, with `controller_generic.png` as the fallback; a
   player on a branded controller still gets a correct binding, shown with the generic
   glyph and the key's action name beside it.
5. **The HUD** shows: power state (the player rig's own silhouette), the timer, the coin
   count, the score, the lives, the health, and the current stage name (`REQ-D-004`).
   The HUD is drawn from `kenney.platformer.coin-gold.glb`, `heart.glb` and `star.glb`
   icons and `kenvector_future.ttf` text.

---

## 8. Localisation (`REQ-E-013`, `NFR-08`)

### 8.1 The string table boundary

**All** user-visible text lives in `src/content/localisation/<locale>.json`. No string is
written in a script, in a scene, in a stage file, or in an asset manifest. The boundary
covers:

| Surface | Key prefix | Example |
|---|---|---|
| Menus and HUD | `ui.` | `ui.options`, `ui.hud.coins` |
| Tutorials | `tut.` | `tut.move_01`, `tut.jump_01` |
| Signage and in-world text | `sign.` | `sign.region01.stage03.lantern` |
| Item and object names | `item.`, `object.` | `item.coin_bronze.name` |
| Region, stage, boss and character names | `name.` | `name.region01`, `name.boss.moss_warden` |
| Accessibility option labels and descriptions | `a11y.` | `a11y.reduced_flashing.label`, `a11y.reduced_flashing.desc` |
| Scoring and results | `score.` | `score.coin_bronze` |
| Errors and diagnostics shown to the player | `err.` | `err.no_save_slot` |

**What is NOT in the string table.** Author-supplied *data* (a stage's `text_key`, an
item's `name_key`) is in the content file; the **text itself** is in the locale table.
A content file that contains a literal string where a key is expected fails
`LINT-033`: `LINT-033 {file}: field 'objects[3].text' contains a literal string; use a 'text_key' that resolves in the locale table`.

**The locale files.**

| Locale | Status | Notes |
|---|---|---|
| `en-GB` | **shipped** | The authoring locale. Every key in `en-GB` is the canonical key set. |
| `en-US` | **shipped** | A mechanical variant of `en-GB`; identical key set, `spelling: en-US` only. |
| Any further locale | **outside the Latin-1 scope (`G-14`)** | The shipped locale set is **restricted to Latin-1** because the corpus holds one font family only (§8.2). The pipeline is ready; the content and the font are not. A non-Latin-1 locale needs a licensed font asset added to the manifest first. |

### 8.2 Font fallbacks

The font chain is a **list of manifest asset ids**, and every entry must resolve in the
manifest and pass the licence gate.

| Chain | For | Assets |
|---|---|---|
| `font.chain.ui` | All locales | `kenney.font.vector_future` → `kenney.font.vector_future_thin` (weight) |
| `font.chain.title` | Large titles | `kenney.font.vector_future_thin` → `kenney.font.vector_future` |

**Font assets.** `kenney.font.vector_future` =
`03-scifi.zip!/space-shooter-remastered/Bonus/kenvector_future.ttf`;
`kenney.font.vector_future_thin` =
`03-scifi.zip!/space-shooter-remastered/Bonus/kenvector_future_thin.ttf`.
These are the **only two font files in the entire corpus** (measured: a scan of every
`.ttf` / `.otf` / `.woff` across the 22 archives returns these two, both in `03-scifi.zip`).

**The licence caveat, stated precisely.** Kenney Vector Future is CC0-1.0, and the
architecture board's §8.5 ship set already lists `kenvector_future.ttf` inside `ui.pck`.
**However**, this project's brief classifies `03-scifi.zip` as one of the **licence-
pending 2D packs**. The font's own licence is CC0; the *pack* it travels in is pending.
Resolution: the manifest entry records `licence.spdx: "CC0-1.0"`, `creator: "Kenney"`,
`source_url: <the release URL for 03-scifi.zip>` and `licence.modifications: []`, and
`asset_audit.py` is given a **per-file** allow-list entry for exactly these two paths
under the `cc0_3d_only` profile. If the requester declines that per-file clearance, the
fallback is the `cc0_3d_plus_ui_2d_pending` profile and the build is marked
non-releasable. **This is the one place in this document where a licence decision is
needed from the requester** (§11, `GAP-A11`).

**No unapproved fallback font.** The approved licence set is `{CC0-1.0, MIT, CC-BY-4.0}`
(architecture §5.8). The engine's built-in default font is **not** in that set, so it is
**not** registered as a manifest asset and **not** used as a fallback. If the active
locale needs a glyph the chain does not cover, the localisation system emits a
**missing-glyph report** and the localisation gate fails:

```
LOCALISATION-003 locale 'ja-JP' requires glyph U+6C17 which is not covered by the
font chain [kenney.font.vector_future, kenney.font.vector_future_thin]; add a licensed
font asset to the manifest before adding the locale
```

This makes the language-set decision a **hard dependency** rather than a soft one, which is
the correct shape: a locale without a licensed font must not ship. The decision itself is
taken — `G-14` restricts the shipped set to **Latin-1** (`en-GB`, `en-US`) — so this rule
now governs **future** locales rather than blocking the launch ones.

### 8.3 The RTL rule

`REQ-E-013` says "RTL readiness **if needed**", and `G-14` has decided the language set:
**Latin-1 only, no RTL and no CJK in the shipped scope.** The design is therefore
**RTL-ready but not RTL-enabled**:

- The string table stores keys, never composed sentences, so a translator supplies
  natural order per locale.
- The UI system reads `direction` from a per-locale field (`ltr` | `rtl`) and applies it
  to layout; `localisation.set_locale(l)` returns the direction and the UI mirrors
  accordingly.
- The **HUD** is laid out from named anchors (`anchor.left`, `anchor.right`), so mirroring
  is a layout property, not a per-screen exception.
- The **in-world signage** is an image-free text element attached to a sign asset; the
  sign's text is mirrored by the UI layer, and the sign asset itself is never mirrored
  (the asset rule forbids changing a silhouette).
- `LINT-035` fails if a locale declares `direction: "rtl"` but a screen hard-codes a
  left/right anchor name instead of using `anchor.*`.

### 8.4 The long-string test (`NFR-08`)

Every layout that holds text is tested with an artificially long translation. The test
uses a **synthetic stress locale**, not a real language, so the test is deterministic and
needs no translator.

| Test | What it does | Fails if |
|---|---|---|
| `TEST-LOCTEST-1` (HUD overflow) | Renders the HUD at display scale 1.0 and 2.0 with every HUD string replaced by its stress value — `LONG STRING` repeated to 64 characters, plus a 24-character variant with wide glyphs (`ＷＩＤＥ`) | Any HUD element extends past its anchor's safe area, or any two HUD elements overlap by more than 2 px. |
| `TEST-LOCTEST-2` (menu wrap) | Renders every screen with the stress strings | Any button's text is clipped, or a screen's content exceeds the safe area at scale 2.0. |
| `TEST-LOCTEST-3` (tutorial bubble) | Renders the tutorial bubble with a 96-character stress string in every anchor position (bottom-left, bottom-centre, bottom-right) | The bubble overlaps a HUD element, or the bubble's own tail/pointer is misaligned. |
| `TEST-LOCTEST-4` (sign fit) | Renders a sign with a 40-character stress string | The text exceeds the sign's measured width and is **not** wrapped or scaled to fit. |
| `TEST-LOCTEST-5` (score table) | Renders the victory score table with 12 rows and a long locale | A row's value column is clipped, or the table overflows the card. |
| `TEST-LOCTEST-6` (no hard-coded text) | Greps the shipped `src/` and `src/content/` trees for a string literal in a user-visible position | A literal is found. |

**The stress locale is a fixture, not a translation.** `tests/fixtures/localisation/
stress.json` contains the long values and is loaded only by the localisation test
runner. It is **not** shipped and is **not** a selectable locale.

**Acceptance test (`AC-E013`).** `python3 src/tools/localisation_check.py --locale en-GB
--stress tests/fixtures/localisation/stress.json` exits 0 on the shipped locale and on the
stress fixture, and every one of `TEST-LOCTEST-1…6` passes. It fails with
`LOCALISATION-001 HUD element 'hud.coins' overflows anchor 'anchor.top_left' by 14 px at
display scale 2.0` naming the element, the anchor and the overflow.

### 8.5 Accessibility content (`REQ-D-019`, `REQ-D-020` — content side)

The PLAYER board owns the systems; this board owns the **content** each option changes.

| Option | Content-side effect | Files touched |
|---|---|---|
| `a11y.reduced_flashing` | `fx.hit_flash` becomes an outline instead of an emissive flash; `fx.lightning_flash` caps at `+0.15` intensity and zeroes the screen shake; the `stormwrack_apex` palette's flashes become a steady rim light | `src/content/palettes/stormwrack_apex.palette.json`, `src/content/fx/effects.json` |
| `a11y.ui_scale` | The whole UI scales; `TEST-LOCTEST-1` runs at 1.0 and 2.0 | `src/content/localisation/*.json` (no change) — the scale is a setting |
| `a11y.high_contrast` | The HUD gains a 2 px outline and the focus ring thickens; the palette's `accent` colour is replaced by `palette.high_contrast.accent` | `src/content/palettes/*.palette.json` |
| `a11y.captions` | Every **audio cue that carries information** also emits a caption: hazard cues, boss telegraphs, ghost state changes, checkpoint chimes, and the "item nearby" cue | `src/content/audio/captions.json` |
| `a11y.assist_mode` | Stage content changes: the Region 6 ice gains a visible grip marker at the slide start; the Region 8 lightning gains a `TUNE 0.8 s` longer telegraph; the Region 2 quicksand gains a rising bubble marker | `src/content/stages/*.stage.json` (per-stage flags) |
| `a11y.control_hints` | The tutorial bubble may be re-opened at any time by pressing the hint action; the sign assets also show their text on demand | `src/content/stages/region01_stage01.stage.json` (`tr_tut_*` payloads) |

**Caption content.** `src/content/audio/captions.json` maps a cue id to a caption key. The
caption keys that exist because they carry **information**, not decoration:
`cap.hazard.spike`, `cap.hazard.lava`, `cap.boss.telegraph`, `cap.ghost.state_change`,
`cap.checkpoint`, `cap.item.nearby`, `cap.switch.state_change`, `cap.exit.locked`.

**The acceptance test (`AC-D020-CONTENT`).** For each of the eight caption keys, the
cue that triggers it is listed in `src/content/audio/captions.json` and exists in the cue
registry; a caption with no cue fails with `LOCALISATION-004 caption 'cap.hazard.spike'
maps to no cue id in src/content/audio/cues.json`. With `a11y.captions` on, every one of the
eight information-bearing cues produces a visible caption within `TUNE 0.2 s` of the cue
starting.

---

## 9. The level linter and the world-graph validator (`REQ-E-010`, `REQ-E-009`)

The architecture board §7.3 owns the **runner** and the **gate**; this board owns the
**rule set** and the **error text**. Every rule below is executable: it names the file it
runs over, the check it performs, and the exact message it emits.

### 9.1 The level linter — `src/tools/level_linter.py`

Invocation: `python3 src/tools/level_linter.py src/content/stages/*.stage.json`
Exit code `0` = no errors (warnings do not fail the gate), `1` = at least one error.

| Id | File | Check | Error message |
|---|---|---|---|
| LINT-001 | stage | `entry_spawn.position` and every `checkpoints[].position` lie inside `bounds` | `LINT-001 {file}: entry_spawn 'spawn_main' at [300, 1, 6] is outside bounds min [0,0,0] max [120,16,12]` |
| LINT-002 | stage | `entry_spawn.position` and every `checkpoints[].position` are **not inside** a solid placement or a solid object's collider | `LINT-002 {file}: checkpoint 'cp01' at [46, 1, 6] is inside solid geometry (placement cell [46,0,6], asset 'kenney.platformer.block-grass')` |
| LINT-003 | stage | every `camera_zones[].follow.bounds` is contained by the stage `bounds` | `LINT-003 {file}: camera zone 'cz_main' bounds max [140,16,12] exceeds stage bounds max [120,16,12]` |
| LINT-004 | stage | the union of the `camera_zones[].trigger_aabb` covers the whole playable volume | `LINT-004 {file}: no camera zone covers [60,0,4]-[80,16,8]; the camera would lose its bounds` |
| LINT-005 | stage | every mandatory target (the primary exit's volume, every key object, every boss trigger) is reachable from `entry_spawn` by a movement-aware search over the collision volumes. **Reachability uses horizontal clearance, not vertical apex:** a gap is clearable when its width ≤ `2 × time_to_apex × run_speed` for the profile, and a step is climbable when its height ≤ that profile's apex. The **conservative** profile is used so every profile clears every mandatory gap: **vertical ≤ 2.43 m** (Sable, the lowest apex) and **horizontal ≤ 5.43 m** (Brindle, the smallest `2 × t_apex × run_speed`). The per-profile figures are in `DESIGN-3-PLAYER.md` §4.1; the apex model is `TUNE-003` / `TUNE-P-018`. | `LINT-005 {file}: mandatory target 'exit:normal' at [116,0,6] is not reachable from entry_spawn 'spawn_main'; the nearest blocking cell is [13,0,6] (gap width 7.0 m exceeds the conservative horizontal clearance 5.43 m; vertical step 3.1 m exceeds the conservative apex 2.43 m)` |
| LINT-006 | stage | no interactive volume is embedded inside another solid volume | `LINT-006 {file}: portal volume 'pv_secret_a' overlaps solid placement cell [98,0,6]` |
| LINT-007 | stage | every `asset_id` referenced by `placements`, `props`, `objects`, `background`, `light_rig` resolves in `src/assets/asset_manifest.json` | `LINT-007 {file}: asset_id 'kenney.platformer.block-garss' is not in the asset manifest` |
| LINT-008 | stage | every `exits[].requires` flag is obtainable within the stage or is a world flag declared in the stage's world file | `LINT-008 {file}: exit 'hidden' requires 'key_brass' which no object, actor or trigger in this stage can set` |
| LINT-009 | stage | every `exits[].to_node` resolves to a node in the world graph | `LINT-009 {file}: exit 'normal' target node 'nowhere' does not exist in the world graph` |
| LINT-010 | stage | exactly one `exits[]` entry has `type: "primary"` | `LINT-010 {file}: expected exactly 1 primary exit, found 0` |
| LINT-011 | stage | every `placements[].collision.material` is in the join table of §3.2, and a surface modifier is never paired with a non-`solid` tile material | `LINT-011 {file}: placement cell [30,4,6] has material 'ice' with tile material 'invisible'; surface modifiers are only permitted on 'solid' placements` |
| LINT-012 | stage | a placement's measured footprint fits its grid cell within `TUNE 2 %` | `LINT-012 {file}: placement cell [12,0,6] asset 'kenney.platformer.block-grass-large' footprint 2.00 m exceeds cell size 1.00 m by 100 %` |
| LINT-013 | stage | every `props[]` entry is collider-free | `LINT-013 {file}: props[4] asset 'kenney.platformer.tree' declares a collider; props are visual-only` |
| LINT-014 | stage | every `objects[].id` and every `actors[].id` is unique within the stage | `LINT-014 {file}: duplicate object id 'obj_coin_a'` |
| LINT-015 | stage | every `actors[].archetype_id` resolves to `src/content/actors/<id>.actor.json` and every `objects[].archetype_id` resolves to `src/content/objects/` or `src/content/blocks/` | `LINT-015 {file}: actor 'act_walker_a' archetype_id 'enemy.ground_walker' does not resolve` |
| LINT-016 | stage | every `qa_tags[]` entry is in the closed vocabulary of §2.6 | `LINT-016 {file}: unknown qa_tag 'teaches_wind'` |
| LINT-017 | stage | `music_cue_id` is either null or resolves in the cue registry; a null cue requires the `music_unsourced` tag, and an `UNSOURCED` cue requires it too | `LINT-017 {file}: music_cue_id 'music.region01.overworld' is UNSOURCED but the qa_tags do not include 'music_unsourced'` |
| LINT-018 | stage | `timer_policy.limit_seconds` > 0 and is not a hard-coded constant outside the ruleset's tuning file | `LINT-018 {file}: timer_policy.limit_seconds 0 must be greater than 0` |
| LINT-019 | stage | `timer_policy.mode` ∈ {`countdown`, `none`, `count_up`} and `pauses_in_menu` is a boolean | `LINT-019 {file}: timer_policy.mode 'stopwatch' is not in {countdown, none, count_up}` |
| LINT-020 | stage | every `objects[]` archetype is permitted by the stage's `ruleset_id` feature set | `LINT-020 {file}: object 'obj_crate' uses 'carry.crate_heavy' but ruleset 'classic_ground' does not enable 'carry_throw'` |
| LINT-021 | stage | a `portal_volumes[]` entry of kind `warp` with no visible geometry must be flagged `hidden: true`; if it is not flagged hidden, it is an error; if it is flagged hidden, it is a **warning** | `LINT-021 {file}: portal volume 'pv_secret_a' has no geometry and is not marked hidden` / `LINT-021W {file}: portal volume 'pv_secret_a' is hidden and unreachable by direct traversal (expected for a secret route)` |
| LINT-022 | stage | every `actors[].position` is not inside solid geometry | `LINT-022 {file}: actor 'act_walker_a' at [44, 1, 6] is inside solid geometry` |
| LINT-023 | stage | `bounds.max` minus `bounds.min` is an exact multiple of `tilemap.grid.cell_size_m` on X and Y | `LINT-023 {file}: bounds width 120.5 m is not a multiple of the grid cell size 1.0 m` |
| LINT-024 | stage | the stage's entity budget (placements + objects + actors) is within the ruleset's cap | `LINT-024 {file}: entity count 412 exceeds the ruleset cap of 300` |
| LINT-025 | stage | every `light_rig.point_lights[]` names an emitter asset that resolves in the manifest | `LINT-025 {file}: light_rig.point_lights[2] has no emitter_asset_id` |
| LINT-026 | stage | every `water_volumes[]` and `wind_volumes[]` lies inside `bounds` | `LINT-026 {file}: wind volume 'wv_gust_a' extends to x=260, outside bounds max x=240` |
| LINT-027 | all stages | every `variant` maps to exactly one `background.rig_id`, and no two variants share a rig id | `LINT-027 {variant}: rig id 'bg.sirocco_noon' is used by variant 'desert' and variant 'underground'` |
| LINT-028 | all stages | no two `variant` values share a rig id **or** a hazard profile id | `LINT-028 {variant}: hazard profile 'haze.low' is shared with variant 'ice'` |
| LINT-029 | stage | a placement with `material: grate` never sits directly above a `kill_floor` volume | `LINT-029 {file}: placement cell [88,0,6] has material 'grate' above kill_floor volume 'vol_killfloor'; the grate suppresses the pit-death check and the player would fall through` |
| LINT-030 | stage | every `lane_transitions[]` is fully inside a `camera_zones[]` trigger aabb | `LINT-030 {file}: lane transition 'lt_01' at [20,0,4]-[26,8,8] is not covered by any camera zone` |
| LINT-031 | all stages | each region has at least one stage carrying the `teaches_*` tag of every lesson its region teaches (§4.9) | `LINT-031 region02: no stage carries the qa_tag 'teaches_wind'` |
| LINT-032 | stage | no `tutorial` trigger's aabb contains a mandatory target (an exit volume, a key object, a checkpoint) | `LINT-032 {file}: tutorial trigger 'tr_tut_secret' at [90,0,4]-[94,8,8] contains the mandatory target 'obj_hidden_key'; a tutorial must never gate progress` |
| LINT-033 | content | no content file contains a literal user-visible string where a key is expected | `LINT-033 {file}: field 'objects[3].text' contains a literal string; use a 'text_key' that resolves in the locale table` |
| LINT-034 | content | no asset id used by a menu, HUD or map icon resolves inside the licence-unverified 2D set | `LINT-034 {file}: icon asset 'icons/Board Game Icons/Default (64px)/flag.png' resolves inside the licence-unverified 2D set and is not permitted under ship_profile 'cc0_3d_only'` |
| LINT-035 | content | an RTL locale may not use a hard-coded left/right anchor | `LINT-035 {file}: locale 'ar' declares direction 'rtl' but screen 'screen.hud' uses anchor name 'left_edge'` |
| LINT-036 | stage | no stage may reference a rule-set id inside any of its content fields other than `ruleset_id` | `LINT-036 {file}: objects[2].behaviour contains the ruleset id 'carry_throw'; ruleset gating belongs to the ruleset, not the content` |

### 9.2 The world-graph validator — `src/tools/world_map_validator.py`

Invocation: `python3 src/tools/world_map_validator.py --obligation
src/content/worlds/reachability.obligation.json`

| Id | Check | Error message |
|---|---|---|
| GRAPH-001 | from the world entry node there is a path to the world's `completion.required_nodes` | `GRAPH-001 region03: no path from 'region03_hub' to required node 'region03_boss01'` |
| GRAPH-002 | every main progression path terminates in a reachable ending; a node with no outgoing edge is a dead end | `GRAPH-002 region03_stage04 is a dead end: no exit to a reachable node` |
| GRAPH-003 | every secret edge's prerequisites are satisfiable by some node on a non-secret path | `GRAPH-003 secret edge region01_stage03 -> region01_bonus03 requires 'key_stone' which no node on a non-secret path sets` |
| GRAPH-004 | every node except those explicitly marked `hidden` is reachable | `GRAPH-004 node 'region05_bonus01' is unreachable and is not marked hidden` |
| GRAPH-005 | the graph is acyclic within a world except for declared loops | `GRAPH-005 cycle detected region01_stage01 -> region01_stage02 -> region01_stage01; declare it as a loop or remove it` |
| GRAPH-006 | no `lock` node guards a path required for the ending | `GRAPH-006 lock node 'region01_lock_stone' guards 'region01_stage05', which is on the required path to the ending` |
| GRAPH-007 | every `requires` name resolves to a key in that world's `flags`, and every `flags[*].kind == "item"` resolves to an item id | `GRAPH-007 node 'region01_stage03' requires 'key_z' which is not declared in flags (declared: key_brass, key_stone, key_iron)` |

### 9.3 The localisation check — `src/tools/localisation_check.py`

| Id | Check | Error message |
|---|---|---|
| LOCALISATION-001 | every locale's string set is a superset of `en-GB`'s key set | `LOCALISATION-001 locale 'en-US' is missing key 'ui.options'` |
| LOCALISATION-002 | every key referenced by any content file exists in `en-GB` | `LOCALISATION-002 key 'tut.move_02' referenced by src/content/stages/region01_stage01.stage.json does not exist in locale 'en-GB'` |
| LOCALISATION-003 | every locale's glyph set is covered by its font chain | `LOCALISATION-003 locale 'ja-JP' requires glyph U+6C17 which is not covered by the font chain [kenney.font.vector_future, kenney.font.vector_future_thin]; add a licensed font asset to the manifest before adding the locale` |
| LOCALISATION-004 | every caption key maps to a cue id that exists in the cue registry | `LOCALISATION-004 caption 'cap.hazard.spike' maps to no cue id in src/content/audio/cues.json` |
| LOCALISATION-005 | the stress-locale tests `TEST-LOCTEST-1…6` pass | `LOCALISATION-005 HUD element 'hud.coins' overflows anchor 'anchor.top_left' by 14 px at display scale 2.0` |

### 9.4 The lint acceptance test

A broken fixture stage — `tests/fixtures/stages/broken_sample.stage.json` — must emit at
least one error from each of these families, so that a linter that has silently stopped
checking something fails its own test:

`LINT-001` (spawn outside bounds) · `LINT-002` (checkpoint inside geometry) ·
`LINT-003` (camera bounds exceed the stage) · `LINT-005` (unreachable mandatory target) ·
`LINT-006` (embedded interactive volume) · `LINT-007` (missing asset) · `LINT-008`
(unsatisfiable exit requirement) · `LINT-009` (missing exit target) · `LINT-012`
(footprint too large) · `LINT-014` (duplicate id) · `LINT-020` (rule-set violation).

**`REQ-E-010`'s acceptance test:** `python3 src/tools/level_linter.py
tests/fixtures/stages/broken_sample.stage.json` exits `1` and prints **at least ten**
distinct error ids covering those ten families, each naming the file, the field, the rule
and the offending value, and each naming the nearest valid alternative where one exists.

---

## 10. Requirement traceability — this board's requirements

### 10.1 Board B — worlds, stages and progression (`REQ-B-001` … `REQ-B-021`)

Authority for every row below: **WORLD** (this board), except `REQ-B-003`, whose
behaviour is owned by **PLAYER** and whose authored data is owned here.

| REQ | Pri | Design artefact | Acceptance test (falsifiable) |
|---|---|---|---|
| REQ-B-001 | P0 | §2.1–§2.3 — stage schema v2, 30 top-level fields | Every `src/content/stages/*.stage.json` validates against `stage.schema.v2.json`; a file with an unknown key or a wrong field type fails with the file and field named (`LINT-011`, architecture `SCHEMA-UNKNOWN-KEY`). |
| REQ-B-002 | P0 | §7.3 — the transition table | Across all 19 transitions, the inventory snapshot is identical before and after, except for the two transitions defined to change it — stage → victory (the goal reward increments `score`) and stage → game over (a life is decremented). The third persistent-state change, **victory → world map**, applies the stage's `save_flags` and records `completed_exits` in `flags` and `world_graph`, which are outside that snapshot and are covered by `REQ-E-006`'s save-schema tests (`AC-B002`). |
| REQ-B-003 | P0 | §2.3 `camera_zones` + `lane_transitions`; §2.9 (`cz_main`) | Over a 10 000-tick scripted path the camera frustum corners never leave `bounds` (`AC-G1-6`). Behaviour owned by PLAYER. |
| REQ-B-004 | P0 | §5.3 — `exits[]` with `primary` and `secret` | The normal exit and the secret exit resolve to two **different** destination nodes, and each unlock is recorded exactly once (`LINT-010`). |
| REQ-B-005 | P0 | §2.9 — `cp01` and the `captures` list | Death after `cp01` respawns at `cp01`, not at the stage start, and a collectable consumed after the checkpoint is not duplicated (`AC-G1-7`). |
| REQ-B-006 | P0 | §5.2–§5.3 — the world graph and its flags | After save → quit → reload, the set of reachable nodes is identical to the pre-save set (`AC-B009`). |
| REQ-B-007 | P1 | §2.7 the 13 variants; §7.1 the 14 rigs; §7.2 the 23 palettes | Each variant loads a distinct rig id, palette id, hazard set and material set; two variants sharing a rig or hazard profile fail (`LINT-027`, `LINT-028`). |
| REQ-B-008 | P1 | §2.3 `timer_policy` | With `pauses_in_menu` true, a 600-tick menu visit leaves the timer value unchanged, and the timer never decrements twice in one tick (`LINT-018`). |
| REQ-B-009 | P1 | §5.1–§5.3 — node kinds, edge kinds, the region tables | Applying a world-state delta changes node accessibility exactly as specified; applying it twice is idempotent (`AC-B009-2`). Locked doors, bridges, icons and moving encounters are all present (§5.2). |
| REQ-B-010 | P1 | §6.5 — the portal catalogue | A warp places the player at the destination's `return_portal` and re-seeds the camera bounds to the destination's bounds within 1 tick (`AC-W01` … `AC-W07`). |
| REQ-B-011 | P1 | §6.4 — keys, locks, doors; §4.3 — the Region 2 switch puzzle | Opening a door with a key consumes the key; a save taken before the door still has the key; a puzzle reset restores the lock (`AC-D01` … `AC-D06`). |
| REQ-B-012 | P1 | §4.8 — `region08_stage01`; §6.2 `platform.autoscroll` | In an autoscroll stage the camera advances at the configured rate, entities spawn only inside the camera window, and the off-screen death rule fires only when enabled (`AC-P08`). |
| REQ-B-013 | P1 | §4.3, §4.5 — the vertical shafts | After an axis switch the player remains inside the camera bounds for 60 consecutive ticks — never trapped (`LINT-030`). |
| REQ-B-014 | P1 | §5.3 — `exits[].requires` | An exit with an unmet prerequisite refuses the player and emits no progress event; with the prerequisite met it completes the stage (`LINT-008`, `GRAPH-003`). |
| REQ-B-015 | P1 | §6.3 — S-01 … S-07; §6.1 B-14, B-15 | A switch flag survives death, save and restart, and the switch-block's collision state matches the flag (`AC-S01`, `AC-S05`). |
| REQ-B-016 | P1 | §7.3 — the game-over row; §2.3 `timer_policy` | The continue screen resumes in the correct world and level mode with the timer reset to the stage's configured limit (`AC-B002`). |
| REQ-B-017 | P1 | §6.7 — the item catalogue; `goal_reward.score_table_ref` | A collected coin increments the counter exactly once and adds the authored table value; the same coin after a reload adds nothing (`AC-I01`). |
| REQ-B-018 | P1 | §5.3 — the `bonus` node kind | A bonus reward appears once per eligibility rule; re-entering the same chamber awards nothing further (`AC-D11`). |
| REQ-B-019 | P1 | §4.1–§4.8 — the boss specs; §5.2 — the bridge edges | Defeating a region boss sets the world state that makes the next region's node reachable in the world graph (`GRAPH-001`). |
| REQ-B-020 | P2 | §5.3 — `completion`; §6.7 `item.jewel_relic` | A level with two exits counts as **1 level and 2 exits**, and the percentage equals `exits_done / exits_total` (`AC-I05`). |
| REQ-B-021 | P2 | §2.3 `difficulty_tag`; the ruleset's tuning file | The difficulty setting is explicit, is saved and restored, and changing it alters no stored rule-set parameter value. |

### 10.2 Board D — the requirements this board owns

| REQ | Pri | Design artefact | Acceptance test |
|---|---|---|---|
| REQ-D-001 | P0 | §3 — the join table and the material table | Collision flags are honoured independently of the art layer: replacing the visual mesh changes no collision behaviour (`AC-D001-1`, `AC-D001-2`, `AC-D001-3`). |
| REQ-D-006 | P1 | §6.7 I-11; §6.1 B-11 — the emergence physics | An item emerging from a block never spawns inside solid geometry — the spawn volume is asserted free (`AC-B11`, `AC-I11`). |
| REQ-D-007 | P1 | §6.7 I-08, I-09 — the negative items | A negative pickup invokes the damage path and never increments the positive inventory (`AC-I08`, `AC-I09`). |
| REQ-D-008 | P1 | §6.3 S-04, S-07 — the timed switch | On expiry the tiles are restored and a player overlapping the area is pushed out safely — neither trapped nor killed (`AC-S04`). |
| REQ-D-009 | P1 | §6.2 — all nine platform motions | A player on a moving platform keeps a constant position relative to the platform across 60 ticks — no slip (`AC-P01` … `AC-P09`). |
| REQ-D-011 | P1 | §6.4 — keys, locks, doors, the potion portal | A consumed key stays consumed after a save and reload (`AC-D01` … `AC-D06`). |
| REQ-D-012 | P1 | §6.6 — the hazard catalogue | The **8 hazard kinds** the requirement names — lava (`H-06`), spikes (`H-02`, `H-03`), crushing ceilings (`H-08`), pits (`H-09`), currents (`H-10`), waterfalls (`H-12`), wind (`H-11`), fireballs (`H-07`) — are each implemented by a named catalogue entry, and **all 14 catalogue entries** (`H-01` … `H-14`) emit the unified hazard event and respect immunity and the damage cooldown (`AC-H01` … `AC-H14`). The 8 kinds are covered by **9** entries (spikes use two); the remaining **5** (`H-01`, `H-04`, `H-05`, `H-13`, `H-14`) are **extensions**, not replacements. |
| REQ-D-015 | P1 | §7.6 — the bus graph, the cue registry, the music gap | At most one active loop per bus and a clean cross-fade on switch. **The "music switches cleanly" clause cannot be demonstrated end to end: the corpus has 0 music files, so the 27 music cues are `UNSOURCED` (the 8 ambience cues are `DERIVED` — mixed in-engine from the shipped SFX per `G-06`) and the mixer is verified to start, duck and stop correctly with no music loaded** (`AC-D015-1` … `AC-D015-5`). **Status: PARTIAL.** |
| REQ-D-016 | P1 | §7.5 — the FX list, Tier A and Tier B | Every effect spawns on the matching state transition and no effect node is present in the physics scene tree (`AC-D016-1`). |
| REQ-D-017 | P1 | §7.1 the rigs, §7.2 the palettes, §7.3 the transitions, §7.4 the lights | A camera displacement produces the authored parallax factor for each layer (`AC-D017-1`); switching a palette changes no gameplay measurement (`AC-D017-2`). |
| REQ-D-018 | P1 | §7.7 — the screens and the flow | Every major menu action is reachable with gamepad and keyboard only, with no mouse input (§7.7.3 rule 1). |
| REQ-D-019 | P2 | §2.9 — the eight tutorial cues; §8.5 | Each tutorial trigger fires exactly once; skipping a tutorial does not block progression; a playtester identifies the basic controls from in-world cues alone (`AC-G1-1`, `AC-G1-2`, `AC-G1-3`, `LINT-032`). **System side owned by PLAYER.** |
| REQ-D-020 | P2 | §8.5 — the accessibility content table | Each option is independently settable, persists across sessions, and changes the output within one frame of being applied (`AC-D020-CONTENT`). **System side owned by PLAYER.** |

### 10.3 Board E — the requirements this board owns

| REQ | Pri | Design artefact | Acceptance test |
|---|---|---|---|
| REQ-E-004 | P0 | §2.3 — the eight separated field groups; §2.5 | One stage file instantiates without code modification, and the separation is mechanical: `placements` (collidable, grid), `props` (visual-only, `LINT-013`), `objects` (interactive), `actors` (actors), `triggers`, `camera_zones` — each group is independently replaceable. |
| REQ-E-009 | P1 | §5.4 — the reachability obligation file; §9.2 — the seven graph rules | A reachable ending is proven for every main progression path (`AC-B009`, `AC-B009-2`, `AC-B009-3`). |
| REQ-E-010 | P1 | §9.1 — 36 linter rules; §9.4 | The broken sample level emits actionable lint errors naming the file, the field, the rule, the offending value and the nearest valid alternative. |
| REQ-E-013 | P1 | §8.1–§8.4 — the string table, the font chain, the RTL rule, the long-string test | The build switches locale without modifying scripts, and every one of `TEST-LOCTEST-1…6` passes (`AC-E013`). |

**Count:** 21 (Board B) + 13 (Board D) + 4 (Board E) = **38 requirements** owned by this
board, each with a named artefact and a falsifiable acceptance test.

---

## 11. The asset-gap register

An ASSET GAP is a row, never a placeholder. Each row names the requirement it blocks and
the smallest thing that would close it.

| Gap id | What is missing | Blocks | The smallest thing that closes it |
|---|---|---|---|
| **GAP-W-001** | **Music.** 0 music files in the corpus (78 SFX only). **27 music cues** are `UNSOURCED`. (The 8 ambience cues are **not** in this gap — they are `DERIVED` in the mixer per `G-06`.) | `REQ-D-015` (PARTIAL), the 8 region cues, the 8 boss cues, the finale cue | Commission or licence 25 original tracks and register them in `src/assets/asset_manifest.json`. The cue slots, buses, cross-fades and ducking already exist (§7.6.4). |
| **GAP-W-002** | **Font pack clearance.** The only two font files in the corpus live in `03-scifi.zip`, a licence-pending pack. The font itself is CC0-1.0 (Kenney Vector Future). | `REQ-E-013` under the `cc0_3d_only` profile; `§8.2` | A per-file licence record for `kenvector_future.ttf` and `kenvector_future_thin.ttf`, or a re-source of the same CC0 files from a non-pending Kenney pack, or acceptance of the `cc0_3d_plus_ui_2d_pending` profile. |
| **GAP-W-003** | **A dedicated potion-portal asset.** `object.potion_portal` (D-14) currently reuses `crate-item.glb`, which is not silhouette-distinct enough for an alternate-world portal. | `REQ-D-011`'s "potion-like alternate-world portals" | One named 3D asset with a distinct silhouette. Until then, D-14 ships with the crate variant and carries the `asset_gap` qa tag. |
| **GAP-W-004** | **A square water-surface tile.** The only water meshes in the corpus are hexagonal (`hexagon/water.glb`, `hexagon/river-straight.glb`) while the terrain grid is square, so the Region 3 surface shows seams. | `REQ-B-007`'s `underwater` variant's visual quality | One named square water-surface tile, or a screenshot-gate tolerance that accepts the hex seams, or a lowered camera in Region 3 that hides them. |
| **GAP-W-005** | **2D particle textures.** The `07-vfx.zip` and `05-environments.zip` particle sets are licence-pending. | Tier B FX only | Every Tier B effect has a named Tier A 3D substitute in §7.5, so nothing is blocked. The gap closes when the pending layer is cleared, which upgrades the look but is not required to ship. |
| **GAP-W-006** | **Swim, glide and climb animation clips.** Kenney's 27-clip set and KayKit's 76-clip set have no swim, glide or climb clip (`ASSET-SURVEY` `GAP-A10`). | The *visual* presentation of Regions 3 and 5 | Owned by the PLAYER board (state animation). The content consequence is recorded here: those states use pose selection from existing clips plus runtime blending, which the architecture board §8.3 permits. |
| **GAP-W-007** | **A boss rig per regional boss.** The eight bosses are specified at pattern level; the ENTITIES board owns their actor archetypes and rigs. | The visual identity of the eight bosses | ENTITIES board supplies the archetypes; this board supplies the arena geometry and the phase scripts. |
| **GAP-W-008** | **A distinct "goal marker" icon** for the stage-end banner. `kenney.platformer.flag.glb` is used for both the stage goal and the world-map node marker. | Nothing blocking | Cosmetic. Recorded so it is not mistaken for an oversight. |

**Gap counts:** 8 rows, of which **1 blocks a requirement outright** (GAP-W-001, and only
partially — `REQ-D-015` is PARTIAL, not blocked), **1 is resolved by a decision elsewhere**
(GAP-W-002, the font licence — `FT-001` and `FT-002` are `SHIPPABLE` with a read `CC0-1.0`
licence, so `W-OPEN-02` is closed), and **6 are design decisions with named workarounds**.

---

## 12. Open items this board hands back

| Id | Item | Why it is open | The smallest decision needed | Owner |
|---|---|---|---|---|
| **W-OPEN-01 — CLOSED 2026-10-30** | **Music sourcing** (`GAP-W-001`) | The corpus has 0 music files. 27 cues are `UNSOURCED`. **Decided by `G-05` and the architecture board's `OPEN-003`: option (c), the silent music bus.** The build is releasable in that state and `REQ-D-015` is PARTIAL by design. | None — a composer-supplied file enters through the existing manifest slot and the existing CI gate. | Closed |
| **W-OPEN-02 — CLOSED 2026-10-30** | **Font pack clearance** (`GAP-W-002`) | The font is CC0 but shipped inside a licence-pending pack. | None — **the asset board's manifest rows `FT-001` and `FT-002` (`kenvector_future.ttf`, `kenvector_future_thin.ttf`) are `SHIPPABLE` with a read `CC0-1.0` licence**, and the per-file licence record is in the manifest. The font ships in every profile. | Closed |
| **W-OPEN-03 — CLOSED 2026-10-30** | **Stage-schema v2 delta** (§2.4) | The architecture board's §5.2 stage schema has no home for the eight 3D field groups, and `music_cue_id` is required by the master matrix but optional in §5.2. | None — **the architecture board accepted `W-01`, `W-02` and `W-03`**, and §5.2 now carries stage schema **v2** with 30 top-level fields. v1 files remain valid. | Closed |
| **W-OPEN-04 — CLOSED 2026-10-30** | **Language set** (`OPEN-004`, `G-14`) | The corpus holds one font family, so the shipped locale set is **restricted to Latin-1**. | None — **decided by `G-14`**: `en-GB` and `en-US` ship (§8.1); no RTL and no CJK. `REQ-E-013` re-opens if the corpus gains a second family. | Closed |
| **W-OPEN-05 — CLOSED 2026-10-30** | **The 51 deferred stages** | §1.1 commits to **13 stages** as the release slice; the master §6 proposes 8 × 5–8 + optional + bosses. | None — **this board's §1.1 commitment to 13 stages stands** and is the Gate 1 slice the master §10 records. The further stages are **backlog**, not an open design question, and no implementer needs a decision to start. | Closed |

---

## 13. Definition of done for this document

- [x] All 19 mandatory stage-matrix fields are mapped onto the architecture board's field
  names (§2.1), with the 30-field stage schema v2 specified (§2.3).
- [x] Three named deltas to the architecture board's stage schema are stated, each with a
  reason (§2.4).
- [x] The collision-material taxonomy joins the master document's nine tile materials to
  the 3D contract's nine collision materials, with three falsifiable acceptance tests
  (§3).
- [x] Eight original regions are specified in the teaching order, each with an original
  name, theme, biome set, stage list, boss, secret route, palette set, music cue and REQ
  coverage (§4), and the teaching order is cross-checked against the master document
  (§4.9).
- [x] The world-map graph is specified with node kinds, edge kinds, locked doors,
  bridges, icons and moving encounters, and carries a machine-readable reachability
  obligation (§5).
- [x] The interactive-object catalogue specifies 24 blocks, 9 moving platforms, 8
  switches, 14 doors and keys, 7 portals, 14 hazards, 11 items, 4 carryables and 15
  dressing props — each with its collision material, behaviour, exact asset path and a
  falsifiable acceptance test (§6). **Those nine numbers are the measured row counts**:
  `B-01…B-24`, `P-01…P-09`, `S-01…S-08`, `D-01…D-14`, `W-01…W-07`, `H-01…H-14`,
  `I-01…I-11`, `K-01…K-04`, `G-01…G-15`. **"14 hazards" here means 14 stage
  *interactive objects*** built from prop assets (`saw.glb`, `trap-spikes.glb` and their
  siblings). It is **not** the same set as the entities board's **11 hazard
  *archetypes***, which are actors with their own FSMs (`REQ-C-013`), nor the **8 kinds**
  `REQ-D-012` names. Three different numbers for three different things — the matrix
  clauses name the right one for each requirement.
- [x] The presentation layer specifies 14 background rigs over 12 measured HDRs, 23
  palettes, 19 transitions, 9 light presets, 15 FX, a 6-bus mixer with a counted music
  gap, and 14 screens (§7).
- [x] Localisation specifies the string-table boundary, the font chain, the RTL rule and
  six long-string tests (§8).
- [x] 36 level-linter rules, 7 world-graph rules and 5 localisation rules are specified
  with the file, the check and the exact error message (§9).
- [x] 38 requirements are traced to a named artefact and a falsifiable acceptance test
  (§10).
- [x] 8 asset gaps are registered with the requirement each blocks and the smallest thing
  that closes it (§11).
- [x] The music gap is stated plainly, resolved as a silence-by-default bus with an
  explicit composer slot, counted in the build report, and **not** disguised (§7.6.4).
- [x] The production scope is stated, the commitment is separated from the proposal, and
  the Gate 1 tutorial stage is specified in full (§1.1, §2.9).
- [x] The board authority for every shared id is stated explicitly (§0.2).
