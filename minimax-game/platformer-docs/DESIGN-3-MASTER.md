# MASTER 3D DESIGN DOCUMENT — **LANTERNWAKE**

**Working title.** *Lanternwake* is an original working title proposed by the integrator
and is trivially replaceable. No reference-game name appears anywhere in this project.

| | |
|---|---|
| **Status** | Ready for implementation. 102/102 requirements specified and verified; 10/10 NFRs specified. |
| **Supersedes** | `MASTER-2D-Platform-Game-Requirements-MiniMax.docx` on the two points the requester overrode (below). |
| **Composed** | 2026-10-30 |
| **Verification** | `tools/verify_design.py` → **0 FAIL, 31 PASS** · `tools/audit_depth.py` → **102/102 implementable** · `tools/verify_devbots.py` → **0 FAIL, 13 PASS** |
| **Total design** | **13,001 lines** across 8 documents (5 boards + the translation contract + the asset survey + this master). The counts are **measured at build time**, not typed by hand |

---

## 0. Control statement — read this first

### 0.1 The three requester overrides

The source requirements document describes a **2D** platform game and proposes
`Godot 4.x 2D`. Two changes were directed, and they are **overrides** — they beat the
source document wherever the two disagree:

| # | Override | What it changes | Where it binds |
|---|---|---|---|
| **O-1** | **It is a 3D game.** | `REQ-E-001`'s "Godot 4.x 2D" default is superseded by a 3D engine proposal. Every 2D-era mechanic is restated as a 3D mechanic. | `3D-TRANSLATION.md` (normative), all five boards |
| **O-2** | **Every visual comes from the image repository. No rendering by mathematical or generative means.** | The asset rule in §7.2 is absolute: the pipeline may **measure and register** assets, never **author** them. | `DESIGN-3-ASSETS.md`, `DESIGN-3-ARCHITECTURE.md` §8, CI gate `asset-no-procedural` |
| **O-3** | **Original work, informed by reference games.** | Reference games are **research tags for behaviour only**. No name, silhouette, layout, music, dialogue or asset of a reference game may appear in the shipped product. | `DESIGN-3-ENTITIES.md` §0.2, `3D-TRANSLATION.md` §6 |

"Side-scrolling" survives O-1 as the **traversal axis**: the world is real 3D and the
camera is constrained to a **lane**. It does not mean the world is a 2D plane.

### 0.2 What is authoritative, and the order of precedence

| Document | Authoritative for | Lines |
|---|---|---|
| **`3D-TRANSLATION.md`** | Every mechanic's 3D form. Grid and cell semantics, collision materials, the jump model, coyote/buffer, the stomp test, one-way platforms, portal volumes, water, wind, charge-glide, carry sockets, the damage event and resistance matrix, the camera rig, the five rule sets | 333 |
| **`DESIGN-3-PLAYER.md`** | REQ-A-001…021 + D-004/005/013/019/020, B-003, E-015/020 | 2,093 |
| **`DESIGN-3-ENTITIES.md`** | REQ-C-001…020 + D-002/003/010/014, E-004/011/016 | 3,505 |
| **`DESIGN-3-WORLD.md`** | REQ-B-001…021 + D-001/006…009/011/012/015…018, E-009/010/013 | 2,270 |
| **`DESIGN-3-ASSETS.md`** | The asset manifest, the 102-REQ coverage index, the gap register, the licence audit | 1,672 |
| **`DESIGN-3-ARCHITECTURE.md`** | REQ-E-001…020 + NFR-01…10, the module contract, the schemas, the save system, CI, the traceability matrix | 1,336 |
| **`ASSET-SURVEY.md`** | The **measured** facts about the image repository. Where any board and the survey disagree, the measurement wins. | 492 |

**Precedence when two boards conflict:** `3D-TRANSLATION.md` (mechanics) →
`ASSET-SURVEY.md` (asset facts) → the owning board (domain detail) →
this document (integration summary). §11 lists every conflict that was found and how
it was resolved.

### 0.3 How to read this document

This is the **integration and orientation** document. It states the single authoritative
answer for the decisions that span boards, carries the complete traceability matrix, and
records what was verified. The **detail** — every state machine, every field list, every
acceptance test — lives in the five board documents; this document tells you which one
to open and never contradicts it.

---

## 1. The game

**Lanternwake** is a 3D side-scrolling platform game in a real 3D world. The player
traverses eight original regions along the X axis while the camera holds a lane in Z.
Every visual in the game is a named file from the image repository; nothing is
generated, no geometry is drawn by maths, and no placeholder ships.

### 1.1 The three pillars

1. **Everything is a real file.** No procedural art, ever — enforced by a CI gate, not by
   convention (§7.2).
2. **The world is 3D.** Depth is a real dimension: lanes, lane transitions, water volumes,
   wind volumes, portal volumes and a 3D camera rig (§3).
3. **Nothing is claimed that was not measured.** Every constant that the publishers never
   published is `TUNE`-marked with a rationale. The corpus figures are measured, not
   estimated (§6).

### 1.2 The eight regions

Original names, original layouts, original bosses. The teaching order is the source
document's; the content is new.

| # | Region | Teaches | Boss |
|---|---|---|---|
| 1 | **Verdance Reach** | movement, jumps, hidden objects, the first enemies | Verdance Warden |
| 2 | **Sirocco Vaults** | wind, sinking sand, moving platforms, switches | — (region boss at stage 5) |
| 3 | **Tidereach Shoals** | swimming, currents, vertical movement, aquatic hazards | — |
| 4 | **Titanroot Canopy** | scale variants, carry-and-throw puzzles, alternate routes | — |
| 5 | **Cirrus Spine** | charge-glide, floating platforms, high wind | **Cirrus Sentinel** |
| 6 | **Palehush Hollow** | friction, visibility puzzles, chasing ghosts, mazes | — |
| 7 | **Cinderforge Keep** | combined traps, boss sequences, item management | — |
| 8 | **Stormwrack Apex** | everything at once, autoscroll airship, multi-phase finale | the finale |

The region tables, their stage lists, palettes, secret routes and music cues are in
`DESIGN-3-WORLD.md` §4.

### 1.3 The four player profiles

Data-driven, no code subclass (`REQ-A-015`, `REQ-A-016`). The rig is the **KayKit
41-joint** family — reconciled across the boards (§11.2, `CB-06`).

| Profile | Trait focus | Rig |
|---|---|---|
| **Tallow** | heavy, slow, high carry | KayKit `Barbarian` |
| **Brindle** | armoured, tank | KayKit `Knight` |
| **Sable** | agile, fast | KayKit `Rogue` |
| **Moth** | hover, low gravity | KayKit `Rogue_Hooded` |
| *Vellum* | *reserved as the projectile/caster power-up form* (`REQ-D-005`) | KayKit `Mage` |

### 1.4 The cast

**72 actor archetypes** — 57 enemies, 10 bosses, 4 projectiles, 1 companion — covering
**all 67 entries of the source taxonomy one-to-one**, plus the third aquatic archetype
`REQ-C-011` names. Every archetype carries all nine required fields, a verified asset
path, and a falsifiable acceptance test. See `DESIGN-3-ENTITIES.md` §3–§7.

---

## 2. Engine and architecture

| | |
|---|---|
| **Engine** | **Godot 4.7.2-stable, 3D renderer, GDScript**, pinned in `godot.version` |
| **Pin evidence** | The tag `4.7.2-stable` was verified to exist (published 2026-08-18). Godot is **not installed** on this machine; `make godot` downloads the pinned binary and verifies its SHA-256. |
| **Fallback** | Unity **6000.6.4f1** URP (installed via the Hub at `/Applications/Unity/Hub/Editor/6000.6.4f1/Unity.app`; `6000.3.22f1` is also present). Three.js is the web-only fallback. |
| **Why** | Compared against explicit criteria — glTF/FBX import, retargeting across 4 rig families, deterministic fixed tick, headless CI, reach, licence, team cost, bundle streaming. The rejected alternatives are listed with their specific reasons in `DESIGN-3-ARCHITECTURE.md` §3.7. |
| **Simulation** | **60 Hz fixed tick**, decoupled from render rate, seeded RNG, `dt` constant per rule set. The simulation core holds **no engine types** — enforced by `ci/gate/core-purity.sh`. |
| **Determinism proof** | The launch scene runs 1,000 ticks and prints `LAUNCH_CHECKSUM=<sha256>`; CI compares it byte-for-byte against `tests/golden/launch.checksum`. |

**The module contract, the folder tree, the eight JSON schemas, the save system, the CI
pipeline and the ship profiles are in `DESIGN-3-ARCHITECTURE.md` §4–§9.**

---

## 3. The 3D translation — the single source of truth for mechanics

This is the part the 2D source document could not answer. `3D-TRANSLATION.md` is
**normative**: where a board differs, it is the board that is wrong.

| 2D-era mechanic | 3D form | Requirement |
|---|---|---|
| Tile layer | 3D occupancy grid → **collision volume + named asset placement** | `REQ-B-001`, `REQ-D-001` |
| One-way platform | Box collider with a **single permitted normal** (+Y) | `REQ-A-012` |
| Slope tile | Rotated box collider; the slope comes from the asset, never generated | `REQ-B-001` |
| Background layer | A **background rig** — skybox + parallax planes + fog, not cells | `REQ-D-017` |
| Screen / room | A **volume** of authored bounds | `REQ-B-003` |
| Jump hold + cut-off | Hold window via `jump_hold_gravity_scale`; release clamps vertical velocity via `jump_cutoff_velocity_scale` | `REQ-A-003` |
| Coyote time | Grounded is a **downward probe**, not an edge test — so it works on slopes and moving platforms | `REQ-A-004` |
| Jump buffer | An input-frame buffer consumed on the landing tick | `REQ-A-004` |
| Stomp (sprite overlap) | **Downward-arc test**: `vy < -threshold` **and** contact normal `+Y ≥ 0.7` **and** was airborne last tick | `REQ-A-007`, `REQ-C-003` |
| Pipe / door / ladder (tile indices) | **Volumes with a facing predicate** | `REQ-A-008`, `REQ-D-011` |
| Water tile | A **volume** — the player can be half in and half out; buoyancy + drag + surface state | `REQ-A-009` |
| Wind | A **directional vector field volume**, sampled at the player's centre, applied after gravity and before integration | `REQ-A-010` |
| Flight / glide | Charge → gliding → recovering state diagram, with a lift/drag/dive split | `REQ-A-017` |
| Carry / throw | A **socket transform** on the rig; the carried object has no collider while carried | `REQ-A-013` |
| Damage | One typed `DamageEvent` and one **resistance matrix** — damage type × target state → outcome | `REQ-A-007`, `REQ-C-003` |
| Camera | A 3D follow rig constrained to an authored **lane**, with a dead-zone rectangle, look-ahead and hard bounds | `REQ-B-003` |

### 3.1 The collision-material taxonomy

One `material` tag per collider drives friction, acceleration, sound and particles —
never the mesh. This is what makes ice, mud, quicksand, conveyors, bounce and slip work
without one-off code (`REQ-A-011`, `REQ-D-001`):

`solid` · `ice` · `mud` · `quicksand` · `conveyor` · `bouncy` · `slippery_grunt` ·
`grate` · `hazard`

### 3.2 The five sealed rule sets

`classic_ground` · `challenge` · `carry_throw` · `world_map_suits` · `branching_companion`

They are **separate configurations**, never a mash-up. A mechanic present in one is
**absent** in another, not behaving slightly differently. `REQ-E-007`; the anti-mash
guard is a validator check.

---

## 4. The single authoritative constant register

Every number the publishers never published is `TUNE`-marked with a rationale. **No
figure in this project is claimed to be a Nintendo constant.** The full register is
`DESIGN-3-ARCHITECTURE.md` §12; the values that had to agree across boards were
reconciled here.

| Constant | Value | Where |
|---|---|---|
| Fixed tick | 60 Hz | architecture §3.4 |
| Player capsule | **radius 0.35 m, height 1.75 m** (0.7 m footprint) | `TUNE-011` — reconciled, `CB-04` |
| Jump impulse / hold / cut-off | **per profile** — impulse 9.6 / 9.0 / 9.2 / 8.4 m/s, hold scale 0.38 / 0.45 / 0.62 / 0.55, cut-off 0.4; the hold window is **bounded** at 14 ticks | `TUNE-003`, `TUNE-P-018` |
| Jump apex | **per profile** — Tallow **3.16 m**, Brindle **2.68 m** (base), Sable **2.43 m**, Moth **2.81 m**; the stale single figure "≈1.69 m" is **withdrawn** | `TUNE-003` — reconciled, `CB-05` |
| Level-design reachability | **vertical ≤ 2.43 m** (lowest profile apex) and **horizontal ≤ 5.43 m** (smallest `2 × t_apex × run_speed`) — every profile clears every mandatory gap | `LINT-005` |
| Coyote / buffer windows | **6 ticks (0.100 s)** / **8 ticks (0.133 s)**, independently settable to 0 | `TUNE-004`, `TUNE-005` — reconciled |
| Surface materials | one schema everywhere: a **(friction, acceleration)** pair per material — `solid` (1.00, 1.00) · `ice` (0.02, 0.25) · `mud` (2.20, 0.60) · `quicksand` (3.00, 0.40) · `conveyor` (1.00, 1.00) + surface velocity · `bouncy` · `slippery_grunt` · `grate` · `hazard` | `TUNE-008` — reconciled |
| Camera dead-zone rectangle | **`[6, 3]` m, both axes**, plus a soft Y follow rate | `TUNE-010` — reconciled, `CB-07` |
| Wind acceleration | 6.0 m/s² | `TUNE-007` |
| Ship set | **≈104 MB** (was a 73 MB target; moved by the roster, not by the design) | architecture §8.5 — reconciled, `XN-ENT-02` |

---

## 5. The schemas

`DESIGN-3-ARCHITECTURE.md` §5 publishes eight versioned schemas with a version field,
required fields, a validation rule and a **failing example**: ruleset, stage, actor
archetype, item, block, world-map node, save slot and asset manifest.

**One reconciliation was required and is applied: the stage schema is now v2.**
The world board's three deltas were accepted — `music_cue_id` becomes required (W-01);
`placements` is added and `props` becomes collider-free by construction (W-02); the
eight 3D field groups (camera lanes, lane transitions, water/wind/portal volumes, light
rig) are added (W-03). **v1 files remain valid** (`schema_version: 1`); new stages use
v2 with 30 top-level fields. `DESIGN-3-ARCHITECTURE.md` §5.2 now carries v2, so the two
boards no longer disagree.

**The save schema is now v6** (was v5). The eight settings fields that carry the
remappable bindings and the accessibility options were added — `bindings`, `input`,
`assist_mode`, `assist_toggle_jump`, `ui_scale`, `captions`, `high_contrast_hud`,
`colour_safe_palette` — with a `5 → 6` migration row. This closes the player board's
`BLOCKED-P-01`: `REQ-A-001` and `REQ-D-020` both require settings to survive a restart.

---

## 6. The image repository — the measured picture

### 6.1 What the repository actually is

| Layer | Location | Size |
|---|---|---|
| **The corpus** | GitHub releases of `atiffhussainkhan/Image` (public) | **16.16 GB**, 98 assets, 10 releases |
| **The processed mirror** | `~/.minimax/asset-library` | 1.0 GB — 12 packs + a 116,880-record index |
| **The working clone** | `/Users/mac/Image` | 425 MB |

> The requester described the repository as "twelve GB". The **measured** figure is
> **16.16 GB**. A narrow search of the local mirror really does surface only a few
> hundred MB — which is why the design is built on the full release set, not the mirror.

**23 packs (2.7 GB) were fetched and inventoried** for this design, and **9 further
packs** remain available on the release server without re-downloading.

### 6.2 The 3D corpus that ships

| | |
|---|---|
| **Kenney CC0 library** | **4,812 GLB models across 49 kits**, 35,998 2D sprites, 4,686 UI elements, 7,508 icons |
| **Animated Kenney models** | **150 of the 4,812 carry animation; 26 are skinned.** 5 platformer characters (25 clips), 12 mini-characters (32 clips, skinned), 18 blocky characters (27 clips), 24 animals (8 clips), 25 prototype figures, and **animated doors, buttons, levers, chests, gates, crates, pistons and traps** with `open/close/toggle/show/hide` clips already authored into the art |
| **KayKit** | Adventurers (5 rigs × **76 clips**), Skeletons (5 rigs × **95 clips**), Character Animations 1.2 (30 clips), Dungeon (585 files), Medieval Hexagon (263), Halloween, City Builder, Furniture, Prototype Bits (25 animated) |
| **Quaternius** | Ultimate Animated Character (12 rigs × 17 clips), Ultimate Animated Animals (3 rigs × 12–13), animated mech (4 rigs; `Leela` 18 clips) |
| **Others** | holokat (1,766 files, MIT), avramania nature terrain, cc0tree, jean-charpentier low-poly, PolyHaven (80 CC0 HDR skyboxes), ambientCG PBR materials |
| **The player capsule cast** | The four profiles sit on the **KayKit 41-joint** rigs — the **primary playable rig**, reconciled with `CB-06`. The Kenney 6-joint cast is the secondary rig for NPCs. |

### 6.3 Audio — the honest picture

**The entire audio corpus is 78 audio file paths resolving to 66 unique sounds — 52 `.ogg`
(40 Kenney Desert Shooter + 12 `Fantozzi` footsteps), 12 `.flac` (the same 12 footsteps,
each at two paths) and 2 `.wav` (gunshots). 52 `.ogg` ship. And there is no music.**

| Available | Count |
|---|---|
| Kenney Desert Shooter `.ogg` — `jump-a…f`, `coin-a…d`, `hurt-a…e`, `fall-a/b`, `explosion-a…c`, `lose-a…d`, `move-a…d`, `select-a`, `error-a…c`, `shoot-a…h` | 40 |
| Fantozzi footsteps — `Fantozzi-{Sand,Stone}{L,R}{1,2,3}` in `.flac` and `.ogg` | 24 + 24 |

**Verified negatives**, not assumptions: all 12 local mirror packs contain **zero** audio
files; the `oga-*sounds` directories inside `01-characters`, `02-fantasy` and `03-scifi`
contain **only `SOURCE.md` stubs** and no audio binaries; no release asset in the 98 is a
music archive.

**Consequence, stated rather than faked:** **27 music cues** across the eight regions
have **no source in the repository** — the corpus contains no music file of any kind.
The **8 ambience cues** are a different case: they are **derived in the mixer** from the
52 shipped `.ogg` by randomised, pitch-preserving one-shot scheduling (`G-06`), so they
need no file and are **not** unsourced. The music bus therefore ships **silent by
default**, with a documented composer-supplied asset slot in the manifest.
`REQ-D-015` is **PARTIAL** for that reason, and four audio gaps (`GAP-AUD-01…04` —
splash, swim stroke, climb, glide) are substituted from the existing set with the
difference stated.

### 6.4 Licence position

| Set | Status | Consequence |
|---|---|---|
| The 3D packs (Kenney, KayKit, Quaternius, holokat/MIT, avramania, cc0tree, jean-charpentier, PolyHaven, ambientCG) | **CC0-1.0 or MIT — cleared to ship** | 1,994 3D records: MIT 1,005 / CC0-1.0 989 |
| The 114,852 2D records | **`licence_status: unverified`** | Usable in the build, labelled pending, and **excludable from a release build by configuration** (`ship_profile`) |
| `jam-ready-assets.zip` (1,817 MB) | **`PACK_LEVEL` — not cleared** | **Must not ship.** Excluded by the CI licence gate |
| The `workplace-art-unverified-*` releases and the 15 `oga-*` sub-packs | Unverified | Excluded from the release profile |

**The game ships 3D-first from the cleared corpus, so it is complete without the
licence-pending 2D set.** A `licensed-only` profile excludes that layer by configuration
and every shipped stage still loads.

---

## 7. The asset rule

### 7.1 The rule, verbatim

> Every mesh, texture, animation, skybox, background, UI element, icon and sound in the
> shipped game is a **named file that exists in the image repository**, recorded in the
> asset manifest with its exact path, pack and licence. The pipeline may **measure and
> register** an asset — world-space bounds, footprint, scale, ground offset, orientation,
> compression — it may **never author** one. No procedural geometry, no runtime-generated
> texture, no shader-only character, no primitive-composition actor. Compositing library
> assets into a level is allowed; fabricating an asset is not. If an element has no file,
> it is an **ASSET GAP** row naming the requirement it blocks — never a placeholder.

### 7.2 How it is enforced mechanically

Six CI gates, each failing the build with a named error:

| Gate | Fails with |
|---|---|
| `asset-path-resolution` | `ASSET_PATH_NOT_FOUND <asset_id> <path>` |
| `asset-licence` | `MISSING_LICENSE <asset_id>` |
| `asset-pack-clearance` | `PACK_NOT_CLEARED <pack>` |
| **`asset-no-procedural`** | `PROCEDURAL_ASSET <file>:<line>` |
| `asset-orphan` | `ORPHAN_ASSET` / `UNMANIFESTED_REF` |
| `asset-attribution` | missing attribution in the release bundle |

The release audit must report **zero unlicensed assets**, or the build fails.

**Runtime transforms are permitted and are not authoring.** The 124 node-transform Kenney
props — and the swim, glide, flight, charge and climb states for which the corpus has no
clip — are handled by `root_node_transform`, `root_node_path`, `clip_blend` and
`clip_select` on a **named, unmodified** asset. The file on disk is byte-identical after
the build. The vocabulary is codified in `DESIGN-3-ARCHITECTURE.md` §8.3a.

### 7.3 The manifest

**471 rows — 467 `SHIPPABLE`, 1 `PENDING`, 1 `DERIVED`, 1 `OUT_OF_SCOPE`, 1 `GAP`** — with a stable `asset_id`, the exact
archive-member path, format, licence and the requirement ids each asset serves. Every one
of the **102 REQ ids** is indexed. All **619** cited archive-member paths were resolved
against the real `zipfile.namelist()` of the packs — **0 failures**.

---

## 8. The traceability matrix

Every one of the **102 requirements** and **10 non-functional requirements**, with its
owner, its design artefact and its acceptance test. Extracted verbatim from
`DESIGN-3-ARCHITECTURE.md` §10.

**Status legend.** `DESIGNED` = specified, with an acceptance test. `PARTIAL` = specified
but with a named gap recorded against it. The only `PARTIAL` row is `REQ-D-015` (the
audio mixer), because the repository contains no music.

### 8.1 The 102 requirements

| REQ id | Pri | Owner board | Design artefact | Section | Acceptance test | Status |
|---|---|---|---|---|---|---|
| REQ-A-001 | P0 | PLAYER | PLAYER — input abstraction | DESIGN-3-ARCHITECTURE §4.3 (`input` system) | Check: a scripted press/release of each of move, jump, run/action, crouch, interact, pause produces exactly one press event and one release event per action, in a menu scene and in a play scene, with identical action streams. | DESIGNED |
| REQ-A-002 | P0 | PLAYER | PLAYER — motion model | §9.6; §4.3 (`physics`) | Check: the golden replay `walk_1000ticks` yields the identical player transform (≤1e-6 m) and the identical state hash at tick 1000 when run at 30, 60 and 120 rendered FPS. | DESIGNED |
| REQ-A-003 | P0 | PLAYER | PLAYER — jump model | §12 TUNE-002/003 | Check: the short-hop fixture (jump held 1 tick) reaches an apex at least 40 % below the full-hold apex, measured from the tick log. | DESIGNED |
| REQ-A-004 | P0 | PLAYER | PLAYER — assist options | §12 TUNE-004/005 | Check: a jump pressed 3 ticks after leaving a ledge is accepted when `coyote_ticks ≥ 3` and rejected when `coyote_ticks = 0`; a jump pressed 1 tick before landing is accepted only when `buffer_ticks ≥ 1`. | DESIGNED |
| REQ-A-005 | P0 | PLAYER | PLAYER — state machine | §5.3 (`states` schema); §4.3 (`player`) | Check: each of the 15 states declares an **explicit allowed-input set**, ≥1 collision rule and ≥1 exit transition. The allowed-input set may be **empty, and is empty by design**, for the three input-locked states `hurt`, `dead` and `victory`; every other state declares ≥1. A state with no exit transition fails validation. | DESIGNED |
| REQ-A-006 | P0 | PLAYER | PLAYER — collision | §4.3 (`physics`) | Check: sweeping the player across a 1-unit-thick solid at the configured maximum speed over 120 sub-steps produces no pass-through and no tunnelling. | DESIGNED |
| REQ-A-007 | P0 | PLAYER | PLAYER — collision attribution | §4.3 (`physics`), §5.3 (`damage`) | Check: a contact from above emits `damage_type=stomp` and a defeat event; a lateral contact emits `damage_type=contact` and a damage event, unless the actor's resistance set contains `contact: immune`. | DESIGNED |
| REQ-A-008 | P1 | PLAYER | PLAYER — traversal | §4.3 (`physics` zones) | Check: a pipe traversal fires only when the player is within `pipe_radius` and pressing the direction matching the pipe's exit; a wrong direction or an out-of-radius press emits no traversal event. | DESIGNED |
| REQ-A-009 | P1 | PLAYER | PLAYER — swimming | §12 TUNE-006 | Check: the measured speed after 30 ticks in water is below the land speed, and the swim-stroke curve differs from the land curve; a stroke is not accepted during the stroke cooldown. | DESIGNED |
| REQ-A-010 | P1 | PLAYER | PLAYER — wind | §12 TUNE-007 | Check: with a wind zone active, a projectile's landing point shifts ≥ 5 cm downwind; toggling wind mid-flight produces no per-tick position discontinuity > 1 cm. | DESIGNED |
| REQ-A-011 | P1 | PLAYER | PLAYER — surfaces | §12 TUNE-008 | Check: the same 60-tick input on ice, mud, conveyor, quicksand and normal ground yields 5 distinct final X positions. | DESIGNED |
| REQ-A-012 | P1 | PLAYER | PLAYER — one-way platforms | §4.3 (`physics`) | Check: rising through a one-way platform does not collide with it; falling onto it from above does. | DESIGNED |
| REQ-A-013 | P1 | PLAYER | PLAYER — carry/throw | §5.4, §5.3 | Check: the carried object stays at the hand-socket offset, has no collision while carried, and after release has collision and a velocity matching the configured release vector. | DESIGNED |
| REQ-A-014 | P1 | PLAYER | PLAYER — climbing | §4.3 (`physics`) | Check: climbing a ladder and reversing at either endpoint exits cleanly; pressing into a solid wall while climbing never detaches the player. | DESIGNED |
| REQ-A-015 | P1 | PLAYER | PLAYER — avatar profiles | §5.1, §12 | Check: the four avatar profiles produce ≥4 distinct values for (time-to-peak-jump, top speed, grab time). | DESIGNED |
| REQ-A-016 | P1 | PLAYER | PLAYER — special abilities | §5.3 (`damage.resistances`) | Check: a spin jump damages a `spin_vulnerable` target and produces no damage event on a `spin_immune` target. | DESIGNED |
| REQ-A-017 | P1 | PLAYER | PLAYER — flight | §5.3 (`states`) | Check: the flight state diagram is exercised table-wise; every (state, input) pair marked illegal is rejected. | DESIGNED |
| REQ-A-018 | P1 | PLAYER | PLAYER — companion | §5.3 (`kind: companion`) | Check: mount → damage → dismount → re-mount leaves exactly one companion alive at any time and applies the companion's damage exactly once. | DESIGNED |
| REQ-A-019 | P1 | PLAYER | PLAYER — damage pipeline | §4.3 (`player`), §5.3 | Check: two damage events inside the invulnerability window produce one health decrement and one knockback. | DESIGNED |
| REQ-A-020 | P1 | PLAYER | PLAYER — projectiles | §5.3 (`kind: projectile`) | Check: spawning beyond `max_projectiles` returns the oldest live projectile to the pool; a projectile past its lifetime is returned to the pool and removed from the scene tree. | DESIGNED |
| REQ-A-021 | P2 | PLAYER | PLAYER — debug tools | §4.3 (`debug`), §7.1 gate 14 | Check: a recorded input sequence replayed in the debug viewer reproduces the expected transform at tick N; a modified sequence produces a different checksum. | DESIGNED |
| REQ-B-001 | P0 | WORLD | WORLD — stage schema | §5.2 | Check: every stage file validates against the stage schema; a stage with an unknown key or a wrong field type fails with the file and field named. | DESIGNED |
| REQ-B-002 | P0 | WORLD | WORLD — scene flow | §4.4 (pipeline 2 and 3) | Check: across all **19** scene transitions in the world board's transition table, the snapshot of `(coins, lives, inventory.slots, inventory.reserve, power_state, score)` is identical before and after — neither lost nor duplicated — **except for the two transitions defined to change it**: stage → victory adds the goal reward (incrementing `score` through the stage's `score_table_ref`), and stage → game over decrements a life. The third transition that changes persistent state, victory → world map, applies the stage's `save_flags` and records `completed_exits` in `flags` and `world_graph`, which are **outside** this snapshot; it is verified by `REQ-E-006`'s save-schema tests, and `AC-B002` asserts only that it does not disturb the snapshot. A transition that changes any other field fails (`AC-B002`). | DESIGNED |
| REQ-B-003 | P0 | **PLAYER** (WORLD consumer) | PLAYER — camera | §4.3 (`camera`), §5.2 (`camera_zones`) | Check: over a 10,000-tick scripted path, the camera position never leaves the authored world bounds; a sample outside the bounds fails. | SHARED |
| REQ-B-004 | P0 | WORLD | WORLD — exits | §5.2 (`exits`), §5.6 | Check: the normal exit and the secret exit resolve to two different destination nodes, and each unlock is recorded exactly once. | DESIGNED |
| REQ-B-005 | P0 | WORLD | WORLD — checkpoints | §5.2 (`checkpoints`), §6.6 | Check: death after a checkpoint respawns at that checkpoint's spawn id, and a collectable consumed after the checkpoint is not duplicated. | DESIGNED |
| REQ-B-006 | P0 | WORLD | WORLD — global state | §5.6, §5.7 | Check: after save → quit → reload, the set of nodes reachable in the world graph is identical to the pre-save set. | DESIGNED |
| REQ-B-007 | P1 | WORLD | WORLD — biomes | §5.2 (`variant`) | Check: each of the 13 variants loads a distinct hazard set, material set and audio/visual profile id; two variants sharing a profile id fail. | DESIGNED |
| REQ-B-008 | P1 | WORLD | WORLD — timer policy | §5.2 (`timer_policy`) | Check: with `pauses_in_menu` true, a 600-tick menu visit leaves the timer value unchanged, and the timer never decrements twice in one tick. | DESIGNED |
| REQ-B-009 | P1 | WORLD | WORLD — world graph | §5.6, §7.3 | Check: applying a world-state delta changes node accessibility exactly as specified, and applying the same delta twice is idempotent. | DESIGNED |
| REQ-B-010 | P1 | WORLD | WORLD — warps | §4.4 (pipeline 3) | Check: a warp places the player at the destination's spawn id and resets the camera bounds to the destination's bounds within 1 tick. | DESIGNED |
| REQ-B-011 | P1 | WORLD | WORLD — puzzles | §5.6 (`flags`) | Check: opening a door with a key consumes the key; reloading a save taken before the door still has the key; a puzzle reset restores the lock. | DESIGNED |
| REQ-B-012 | P1 | WORLD | WORLD — autoscroll | §5.2 (`camera_zones`) | Check: in an autoscroll stage the camera advances at the configured rate, entities spawn only inside the camera window, and the off-screen death rule fires only when enabled. | DESIGNED |
| REQ-B-013 | P1 | WORLD | WORLD — vertical ascent | §4.3 (`camera`) | Check: after an axis switch the player remains inside the camera bounds for 60 consecutive ticks — never trapped. | DESIGNED |
| REQ-B-014 | P1 | WORLD | WORLD — conditional exits | §5.2 (`exits.requires`) | Check: an exit with an unmet prerequisite refuses the player and emits no progress event; with the prerequisite met it completes the stage. | DESIGNED |
| REQ-B-015 | P1 | WORLD | WORLD — global switches | §5.6 (`flags`) | Check: a switch flag survives death, save and restart, and the switch-block's collision state matches the flag. | DESIGNED |
| REQ-B-016 | P1 | WORLD | WORLD — continue flow | §6.6 | Check: the continue screen resumes in the correct world and level mode with the timer reset to the stage's configured limit. | DESIGNED |
| REQ-B-017 | P1 | WORLD | WORLD — scoring | §5.2 (`goal_reward`) | Check: a collected coin increments the counter exactly once and adds the authored table value; the same coin after a reload adds nothing. | DESIGNED |
| REQ-B-018 | P1 | WORLD | WORLD — bonus chambers | §5.6 | Check: a bonus reward appears once per eligibility rule; re-entering the same chamber awards nothing further. | DESIGNED |
| REQ-B-019 | P1 | WORLD | WORLD — region completion | §4.4 (pipeline 2) | Check: defeating the region boss sets the world state that makes the next region's node reachable in the world graph. | DESIGNED |
| REQ-B-020 | P2 | WORLD | WORLD — completion tracking | §5.6 (`completion`) | Check: a level with 2 exits counts as 1 level and 2 exits, and the percentage equals exits_done / exits_total. | DESIGNED |
| REQ-B-021 | P2 | WORLD | WORLD — adaptive difficulty | §5.1, §6.6 | Check: the difficulty setting is explicit, is saved and restored, and changing it does not alter any stored rule-set parameter value. | DESIGNED |
| REQ-C-001 | P0 | ENTITIES | ENTITIES — actor base | §5.3 | Check: a data-only enemy archetype spawns and updates through the generic actor path; the test asserts no new script was added and no archetype names a ruleset. | DESIGNED |
| REQ-C-002 | P0 | ENTITIES | ENTITIES — FSM | §5.3 (`states`) | Check: each of the 12 states has ≥1 outgoing transition and every declared timer is bounded; an unbounded timer fails validation. | DESIGNED |
| REQ-C-003 | P0 | ENTITIES | ENTITIES — damage | §5.3 (`damage`), §5.5 | Check: the resistance matrix is enumerated for **9 damage sources** × every archetype — `contact`, `stomp`, `projectile`, `thrown`, `moving_shell`, `environment`, `crush`, `fall`, `poison` (the binding 3D translation §3 enum), and an unmapped (source, archetype) pair fails the test. | DESIGNED |
| REQ-C-004 | P0 | ENTITIES | ENTITIES — lifecycle | §5.3 (`despawn`, `activation`) | Check: backtracking three times respawns only entities marked `respawn_policy=designated`, and the live actor count never exceeds the cap. | DESIGNED |
| REQ-C-005 | P1 | ENTITIES | ENTITIES — walker archetype | §5.3 (`movement`) | Check: a walker turns at a ledge and at an obstacle; a walker flagged `stomp_immune` survives a stomp. | DESIGNED |
| REQ-C-006 | P1 | ENTITIES | ENTITIES — shell archetype | §5.3 | Check: **the retracted state is a uniform-scale retract on the same named rig — there is no detached carapace mesh, because the corpus contains none (`G-01` option (a′));** a kicked shell damages an enemy in its path and the player when struck from the front; the shell re-emerges after the configured time. | DESIGNED |
| REQ-C-007 | P1 | ENTITIES | ENTITIES — flyer archetype | §5.3 | Check: the first compatible hit converts the flyer to its ground variant and the wing state is lost. | DESIGNED |
| REQ-C-008 | P1 | ENTITIES | ENTITIES — pipe plant | §5.3 | Check: the normal variant does not emerge while the player is adjacent; the aggressive variant does. | DESIGNED |
| REQ-C-009 | P1 | ENTITIES | ENTITIES — spawner | §5.3 (`drops`) | Check: the spawner never exceeds its cap and despawned hazards leave the active entity list. | DESIGNED |
| REQ-C-010 | P1 | ENTITIES | ENTITIES — turret archetype | §5.3 | Check: the projectile follows the configured trajectory and can be dodged by leaving the arc; the cooldown is respected. | DESIGNED |
| REQ-C-011 | P1 | ENTITIES | ENTITIES — aquatic archetype | §5.3 (`collider.mask`) | Check: an underwater enemy's behaviour differs from the land equivalent under identical input; the water collision mask rejects land-only queries. | DESIGNED |
| REQ-C-012 | P1 | ENTITIES | ENTITIES — ghost archetype | §5.3 (`states`) | Check: the ghost's movement toggles exactly on the player's facing transition. | DESIGNED |
| REQ-C-013 | P1 | ENTITIES | ENTITIES — hazards | §5.3 | Check: each of the **6 parameterised hazard kinds** the requirement names — ceiling/drop, rotating fire bar, falling weight, rolling boulder, chain tether, roaming flame — is implemented by at least one archetype, and **all 11 hazard archetypes** in the entities roster declare a **non-empty** attack hitbox, active only during their declared damaging state; the validator fails an archetype with `hitboxes: []` and an `attack` state. | DESIGNED |
| REQ-C-014 | P1 | ENTITIES | ENTITIES — carryable enemy | §5.3 | Check: a thrown stunned enemy damages the boss and then recovers or despawns; the pickup grants pickup immunity. | DESIGNED |
| REQ-C-015 | P1 | ENTITIES | ENTITIES — boss framework | §5.3 (`kind: boss`) | Check: the boss takes damage only inside an enabled vulnerability window; damage inside the window reduces the phase HP. | DESIGNED |
| REQ-C-016 | P1 | ENTITIES | ENTITIES — boss patterns | §5.3 | Check: each of the 7 test bosses changes phase and leaves the arena with no live entity behind. | DESIGNED |
| REQ-C-017 | P1 | ENTITIES | ENTITIES — goal-triggered boss | §5.3 | Check: activating the goal mechanism removes the boss and advances the stage with no damage applied. | DESIGNED |
| REQ-C-018 | P1 | ENTITIES | ENTITIES — reflection | §5.3 | Check: a reflected projectile credits the reflecting attacker and damages the boss. | DESIGNED |
| REQ-C-019 | P1 | ENTITIES | ENTITIES — boss persistence | §6.6 | Check: retrying restores the boss to the correct phase and the reward is awarded exactly once across all retries. | DESIGNED |
| REQ-C-020 | P2 | ENTITIES | ENTITIES — analytics | §4.3 (`telemetry`) | Check: a scripted death produces a death row in the QA report carrying archetype, location and time. | DESIGNED |
| REQ-D-001 | P0 | WORLD | WORLD — tile materials | §5.5 | Check: collision flags are honoured independently of the art layer — replacing the visual mesh changes no collision behaviour. | DESIGNED |
| REQ-D-002 | P0 | ENTITIES | ENTITIES — block state | §5.5 (`states`, `payload`) | Check: hitting a block N times inside one window emits exactly one reward event. | DESIGNED |
| REQ-D-003 | P0 | ENTITIES | ENTITIES — collectables | §5.4 | Check: collecting a currency increments the counter exactly once, and the same collectable cannot be collected twice. | DESIGNED |
| REQ-D-004 | P0 | PLAYER | PLAYER — HUD | §4.3 (`ui`), §5.7 | Check: the HUD shows the correct character status, time, coins, lives, power state and stage at spawn, after a pickup and after a reload. | DESIGNED |
| REQ-D-005 | P1 | PLAYER | PLAYER — power-up FSM | §5.1 (`features`), §5.4 | Check: the (current state, pickup) table is enumerated and every pair resolves to the expected state, with the priority and downgrade rules applied. | DESIGNED |
| REQ-D-006 | P1 | WORLD | WORLD — item emergence | §5.4 (`physics.spawn`) | Check: an item emerging from a block never spawns inside solid geometry — the spawn volume is asserted free. | DESIGNED |
| REQ-D-007 | P1 | WORLD | WORLD — negative pickups | §5.4 (`kind: negative`) | Check: a negative pickup invokes the damage path and never increments the positive inventory. | DESIGNED |
| REQ-D-008 | P1 | WORLD | WORLD — timed switches | §5.5, §5.6 (`flags`) | Check: on expiry the tiles are restored and a player overlapping the area is pushed out safely — neither trapped nor killed. | DESIGNED |
| REQ-D-009 | P1 | WORLD | WORLD — moving platforms | §5.5 (`bounce`), §4.3 (`physics`) | Check: a player on a moving platform keeps a constant position relative to the platform across 60 ticks — no slip. | DESIGNED |
| REQ-D-010 | P1 | ENTITIES | ENTITIES — springs | §5.5 (`bounce`) | Check: standing and jumping on a spring produce the two configured launch impulses. | DESIGNED |
| REQ-D-011 | P1 | WORLD | WORLD — keys and doors | §5.6 (`flags`) | Check: a consumed key stays consumed after a save and reload. | DESIGNED |
| REQ-D-012 | P1 | WORLD | WORLD — hazards | §5.3 | Check: the **8 hazard kinds** the requirement names — lava, spikes, crushing ceilings, pits, currents, waterfalls, wind, fireballs — are each implemented by a named catalogue entry, and **all 14 entries** in the world's hazard catalogue emit the unified hazard event and respect immunity and the damage cooldown (`AC-H01` … `AC-H14`). | DESIGNED |
| REQ-D-013 | P1 | PLAYER | PLAYER — inventory | §4.3 (`inventory`), §5.7 | Check: an item cannot be consumed twice across a scene transition. | DESIGNED |
| REQ-D-014 | P1 | ENTITIES | ENTITIES — goal rewards | §5.2 (`goal_reward`) | Check: the end-screen reward differs between two configured rule-sets. | DESIGNED |
| REQ-D-015 | P1 | WORLD | WORLD — audio mixer | §7.5; §2.3 | Check: the music and ambience bus state machines assert at most one active loop per bus and a clean cross-fade on switch. **The clause "music switches cleanly" cannot be demonstrated end-to-end: the corpus contains 0 music files (verified across every fetched archive), so the 27 music cues are `UNSOURCED` (the 8 ambience cues are `DERIVED` — mixed in-engine from the shipped SFX per `G-06`) and the mixer is verified to start, duck and stop correctly with no music loaded.** **Ship decision (2026-10-30): the music bus ships SILENT and no cue is fabricated; a composer-supplied file enters through the same manifest slot and the same gate, and the build is releasable in the silent state.** | **PARTIAL** |
| REQ-D-016 | P1 | WORLD | WORLD — effects | §4.3 (`fx`) | Check: an effect spawns on the matching state transition and no effect node is present in the physics scene tree. | DESIGNED |
| REQ-D-017 | P1 | WORLD | WORLD — backgrounds | §5.2 (`background`) | Check: a camera displacement produces the authored parallax factor for each layer. | DESIGNED |
| REQ-D-018 | P1 | WORLD | WORLD — menus | §4.3 (`ui`) | Check: every major menu action is reachable with gamepad and keyboard only, with no mouse input. | DESIGNED |
| REQ-D-019 | P2 | **PLAYER** (WORLD consumer) | PLAYER — tutorials | §4.3 (`ui`) | Check: each tutorial trigger fires exactly once; skipping a tutorial does not block progression; a playtester identifies the basic controls from in-world cues alone. | SHARED |
| REQ-D-020 | P2 | **PLAYER** (WORLD consumer) | PLAYER — accessibility | §5.7 (`settings`), §4.3 (`ui`) | Check: each accessibility option is independently settable, persists across sessions, and changes the output within one frame of being applied. | SHARED |
| REQ-E-001 | P0 | ARCHITECTURE | §3 engine decision | §3.3, §3.4 | Check: CI asserts `godot --version` equals the pin in `godot.version` and `project.godot` declares `config/features=PackedStringArray("4.7", "Forward Plus")`; the deterministic launch scene prints the same `LAUNCH_CHECKSUM` on two consecutive headless runs. | DESIGNED |
| REQ-E-002 | P0 | ARCHITECTURE | §9.6, §4.4 | §9.6; §4.3 (`input`) | Check: the same input replay at 30, 60 and 120 rendered FPS produces an identical simulation state hash at tick 1000. | DESIGNED |
| REQ-E-003 | P0 | ARCHITECTURE | §4.3 event bus | §4.3 (events contract), §5.3 | Check: the event bus rejects a duplicate `(source_id, event_type)` within a tick, and each damage, pickup, stage-clear, checkpoint, unlock and persistence event fires exactly once per interaction. | DESIGNED |
| REQ-E-004 | P0 | ARCHITECTURE (ENTITIES consumer) | §4.4, §5.2 | §5.2 (`tilemap`, `camera_zones`, `triggers`, `actors`) | Check: a stage instantiates from its JSON alone and produces exactly the node set declared by its layers (collision, art, triggers, interactive, actors, FX, camera zones) with no code modification. | SHARED |
| REQ-E-005 | P0 | ARCHITECTURE | §5 schemas | §5.1–5.9 | Check: a stage referencing an archetype id that does not exist fails validation with the file, the field and the missing id named. | DESIGNED |
| REQ-E-006 | P0 | ARCHITECTURE | §6 save system | §6.2, §6.4, §6.5 | Check: killing the process mid-save leaves the previous valid save loadable; a corrupted slot falls back through the 3-entry backup ring; if all backups fail the game starts a new slot and preserves the corrupt file. | DESIGNED |
| REQ-E-007 | P0 | ARCHITECTURE | §4.3 rules, §6.6 | §5.1 (sealed rule-sets), §6.6 | Check: switching rule-sets at runtime and back leaves the save data byte-identical except the recorded ruleset id; each sealed rule-set's feature set differs from every other's. | DESIGNED |
| REQ-E-008 | P0 | ARCHITECTURE | §7 CI | §7.1, §7.2 | Check: CI runs the headless unit, integration and replay suites and the build fails when a physics golden or a schema check fails. | DESIGNED |
| REQ-E-009 | P1 | ARCHITECTURE (WORLD consumer) | §7.3 world graph | §7.3 | Check: the validator proves a reachable ending for every main progression path and reports a dead end with the node id. | SHARED |
| REQ-E-010 | P1 | ARCHITECTURE (WORLD consumer) | §7.3 level linter | §7.3 | Check: the deliberately broken sample level emits at least one actionable error naming the file and the rule. | SHARED |
| REQ-E-011 | P1 | ARCHITECTURE (ENTITIES consumer) | §9 performance | §9.3, §9.2 | Check: the stress scene stays below the frame-time target on the baseline runner; the pool's refusal counter is exposed in the perf report. | SHARED |
| REQ-E-012 | P1 | ARCHITECTURE (ASSETS consumer) | §8 pipeline, §7.6 | §5.8, §7.6, §8.4 | Check: a build containing any asset without licence metadata fails `gate/asset-licence`; the release audit reports zero unlicensed assets. | DESIGNED |
| REQ-E-013 | P1 | ARCHITECTURE (WORLD consumer) | §4.3 localisation | §4.3 (`localisation`) | Check: the build switches locale from a configuration value with no script change; a locale test asserts every key of the default locale exists in the target locale and that no user-facing string is hard-coded in scripts. | SHARED |
| REQ-E-014 | P1 | ARCHITECTURE | §4.3 telemetry | §4.3 (`telemetry`) | Check: a fresh session with telemetry disabled sends zero network requests; the debug overlay shows coordinates, state and FPS. | DESIGNED |
| REQ-E-015 | P1 | ARCHITECTURE (PLAYER consumer) | §4.3 input | §4.3 (`input`) | Check: a controller hotplugged during play is accepted after a pause and resume; simultaneous opposing inputs resolve by the configured conflict policy. | SHARED |
| REQ-E-016 | P1 | ARCHITECTURE (ENTITIES consumer) | §4.4 pipeline 2 | §4.4, §9.3 | Check: after 100 consecutive retries the live actor count returns to its pre-death baseline and no projectile survives the reload. | SHARED |
| REQ-E-017 | P1 | ARCHITECTURE | §7.4, §7.5 | §7.4, §7.5 | Check: a deliberate one-pixel visual change produces a diff artefact with a non-zero changed-pixel count, and a deliberately missing audio cue makes the audio smoke test fail. | DESIGNED |
| REQ-E-018 | P1 | ARCHITECTURE | §7.6, §7.8 | §7.8 | Check: the release bundle contains the attribution file, licence manifest, privacy notice, build metadata and crash-log handler, and the audit reports zero unlicensed assets. | DESIGNED |
| REQ-E-019 | P2 | ARCHITECTURE | §4.3 sim, §7.1 gate 5 | §4.3 (`sim`), §3.4 | Check: a recorded run replays to the same checksum at each of 3 designated checkpoints. | DESIGNED |
| REQ-E-020 | P2 | ARCHITECTURE (PLAYER consumer) | §4.3 debug | §4.3 (`debug`), §7.8 | Check: in a production export the debug menu, teleport, invincibility and speed-adjust entry points are absent from the exported binary and the scene tree. | SHARED |

### 8.2 The 10 non-functional requirements

| NFR id | Pri | Owner board | Design artefact | Section | Acceptance test | Status |
|---|---|---|---|---|---|---|
| NFR-01 | — | ARCHITECTURE | §9.1, §9.2 | §9.1, §9.2, §7.1 gate 14 | Check: on the **normative baseline device** pinned in §9.1 (2020-class 6-core desktop CPU, 16 GB RAM, GTX 1650 / RX 5500XT class or better, SSD, 1920×1080), the 95th-percentile frame time over a 10-minute scripted session is ≤ 16.7 ms, and stress-case exceptions are logged rather than hidden. **The baseline is pinned; the frame-time figure is a target, not yet measured.** | DESIGNED |
| NFR-02 | — | ARCHITECTURE | §9.6, §7.1 gate 5 | §9.6, §3.4 | Check: the tick-1000 replay checksum equals the golden value byte-for-byte on the pinned CI image, and is identical at 30, 60 and 120 rendered FPS. | DESIGNED |
| NFR-03 | — | ARCHITECTURE | §9.3, §4.3 actors | §9.3, §4.3 (`actors`) | Check: a 30-minute scripted soak raises zero uncaught exceptions, and 100 consecutive retries leave the live actor count at its baseline. | DESIGNED |
| NFR-04 | — | ARCHITECTURE | §4.3 ui, §5.2 | §4.3 (`ui`) | Check: a first-time playtester completes the movement, interaction, damage and exit lessons using only in-world cues. | DESIGNED |
| NFR-05 | — | ARCHITECTURE | §5.7, §4.3 ui | §5.7 (`settings`), §4.3 (`ui`) | Check: rebinding, assist mode, UI scale, reduced flashing and non-colour-only feedback are each independently settable and persist across sessions. | DESIGNED |
| NFR-06 | — | ARCHITECTURE | §6 save system | §6.2, §6.4, §6.5 | Check: a v1 save migrates forward to the current version; an interrupted save never replaces the last valid save; no account is needed to save or resume. | DESIGNED |
| NFR-07 | — | ARCHITECTURE | §5.8, §7.6 | §5.8, §7.6 | Check: every manifest entry carries creator, source URL, licence, attribution flag and a modification list; the audit reports zero entries missing any of the five. | DESIGNED |
| NFR-08 | — | ARCHITECTURE | §4.3 localisation | §4.3 (`localisation`) | Check: a locale test runs the UI with a 60 %-longer translation and asserts no label is clipped; a script scan finds no hard-coded user-facing string. | DESIGNED |
| NFR-09 | — | ARCHITECTURE | §4.3 telemetry | §4.3 (`telemetry`) | Check: every build emits a build id in the log header and in the debug overlay, and the log lines are structured `key=value`. | DESIGNED |
| NFR-10 | — | ARCHITECTURE | §4.3 telemetry | §4.3 (`telemetry`) | Check: with telemetry disabled a fresh session sends zero network requests; enabling it writes an explicit consent record and collects only allow-listed fields. | DESIGNED |

### 8.3 Content ownership — which board writes which content kind

The design defines eighteen content kinds. Each has **exactly one** owning
board, so no two people write the same file and none is written by nobody.
This table is the authority: `tools/verify_devbots.py` reads it and checks
that the five development bots' file ownership agrees with it, so a board
cannot quietly claim a kind that belongs to another, and a kind cannot be
left with no owner at all.

| Content kind | Directory | Owning board |
|---|---|---|
| `rulesets` | `src/content/rulesets/` | ARCHITECTURE |
| `tuning` | `src/content/tuning/` | ARCHITECTURE |
| `save` | `src/content/save/` | ARCHITECTURE |
| `stages` | `src/content/stages/` | WORLD |
| `blocks` | `src/content/blocks/` | WORLD |
| `objects` | `src/content/objects/` | WORLD |
| `worlds` | `src/content/worlds/` | WORLD |
| `flows` | `src/content/flows/` | WORLD |
| `palettes` | `src/content/palettes/` | WORLD |
| `backgrounds` | `src/content/backgrounds/` | WORLD |
| `audio` | `src/content/audio/` | WORLD |
| `fx` | `src/content/fx/` | WORLD |
| `localisation` | `src/content/localisation/` | WORLD |
| `actors` | `src/content/actors/` | ENTITIES |
| `items` | `src/content/items/` | ENTITIES |
| `damage` | `src/content/damage/` | ENTITIES |
| `scoring` | `src/content/scoring/` | ENTITIES |
| `characters` | `src/content/characters/` | PLAYER |


---

## 9. The build sequence and the gates

The source document's gate structure is retained and adapted to 3D. **GATE 0** closes the
asset question, **GATE 1** proves the deterministic slice, and the remaining gates walk
the content out.

| Gate | Proves | Entry condition |
|---|---|---|
| **GATE 0 — asset resolution** | Every requirement with a visual has a named file or a gap row. No placeholder exists anywhere. | The manifest is complete and the licence audit reports zero unlicensed assets |
| **GATE 1 — the deterministic slice** | The launch scene runs 1,000 ticks and reproduces `LAUNCH_CHECKSUM`. The Gate 1 tutorial stage loads, plays and completes **from its JSON alone**, with no code change. | Godot pinned and bootstrapped; the schema validators green |
| **GATE 2 — physics golden** | Movement, jump, coyote/buffer, stomp, water, wind, glide, carry/throw and portal replays all match their recorded checksums. | The physics replay harness is green; the `kaykit_41` golden retarget test passes |
| **GATE 3 — content** | Every stage validates against the v2 schema, the linter is clean, and the world-graph validator proves a reachable ending for every main path. | The schema validators and the linter are wired into CI |
| **GATE 4 — systems** | Save/load, migration, the continue flow, the completion tracker and the settings persistence all pass. | The save system passes its own fixtures, including `5 → 6` |
| **GATE 5 — presentation** | The audio mixer, the HUD, the menus, the background rigs and the transitions are complete and reachable by keyboard alone. | The content is complete enough to exercise every screen |
| **GATE 6 — release** | The release audit reports zero unlicensed assets, the licence-pending 2D layer is excluded, and the attribution bundle is generated. | Every gate above is green |

---

## 10. The verification record — what actually ran

Every claim below is the output of a command that was run in this workspace. Nothing in
this section is asserted from memory.

### 10.1 The design gates

```
$ python3 tools/verify_design.py
=== 0 FAIL, 0 WARN, 31 PASS, 5 INFO ===

$ python3 tools/audit_depth.py
=== every requirement is implementable ===

$ python3 tools/verify_devbots.py
=== 0 FAIL, 0 WARN, 13 PASS ===
```

Each run prints **one line per check**. The summaries above are not typed by hand:
`tools/build_master.py` runs the three gates against the master it has just
written, substitutes what they actually reported, and rewrites the document.
`tools/verify_design.py` and `tools/verify_devbots.py` then check that the
figures this document publishes still match their own run — so a stale number
cannot survive a rebuild.

`verify_design.py` checks five things: that all 102 REQs and 10 NFRs are cited; that every
asset path cited in any board resolves to a real file in the packs; that the same named
constant does not carry two different values in two boards; that no reference-game name
appears as shipped content; and that no line asks for generated visuals.

`audit_depth.py` scores every requirement against six depth criteria — behaviour, the data
that carries it, the algorithm or state machine, a falsifiable acceptance test, an asset
citation, and marked tunables — and passes a requirement only when it states **what
happens**, gives **a way to check it**, and carries enough structure to build it.

### 10.2 The measurement record

| Measurement | How it was taken |
|---|---|
| 16.16 GB / 98 assets / 10 releases | `catalog/ALL_RELEASE_ASSETS.json` — `release_bytes` and `release_asset_count` |
| 116,880 indexed records; 1,994 3D (MIT 1,005 / CC0-1.0 989); 114,852 2D | `sqlite3` over `catalogue/gamekit.sqlite` |
| 791 animation clips across 12 animated rigs | `catalogue/model_catalogue.json` |
| **150 of 4,812 Kenney GLBs animated, 26 skinned** | A script read the glTF JSON chunk of **every** GLB in `shorepine-kenney.zip` and counted `animations` and `skins` |
| 78 audio file paths = 66 unique sounds; 52 `.ogg` ship, 0 music | `unzip -l` over every fetched pack plus the local mirror's 12 packs; the extension sets of `01/02/03` were read in full; `library-inventory/audio-inventory.txt` holds all 78 paths |
| 80 PolyHaven HDR skyboxes | `unzip -l` of the fetched pack |
| 619 cited archive-member paths, 0 unresolved | The asset board resolved each path against `zipfile.namelist()` of the real packs |
| 849 cited paths across all boards, 0 unresolved | `tools/verify_design.py` |
| Godot `4.7.2-stable` exists (published 2026-08-18) | The GitHub release API |
| Unity `6000.6.4f1` and `6000.3.22f1` installed | The Unity Hub directory |
| Cursor 3.27.22 | `cursor --version` |

### 10.3 The corrections that were found and applied

Errors found by the verification gates and the boards, and fixed:

| Error | Found by | Fix |
|---|---|---|
| Unity path `/Users/mac/.unity/Editor/…` does not exist; **two** editors are installed | Direct filesystem check | Corrected to `/Applications/Unity/Hub/Editor/6000.6.4f1/Unity.app`, with the fallback pin moved to the newer editor |
| Kenney GLBs described as static — **wrong**: 150 are animated, 26 skinned | A direct scan of every GLB's JSON chunk | The survey and the architecture board corrected; the animated vocabulary documented in full |
| `Fantozzi-Sand1.ogg`, `Fantozzi-Stone1.ogg` — no such files | Path resolution | Corrected to the real `Fantozzi-{Sand,Stone}{L,R}{1,2,3}` names |
| `patch_sand.glb` | Path resolution | Corrected to `pirate/patch-sand.glb` |
| `block-grass-overhang.glb`, `block-snow-overhang.glb` — no such bare files | Path resolution | Replaced with the real `-large` variants |
| `floor_tile_big_spikes.gltf.glb` — a doubled extension | Path resolution | Corrected to `floor_tile_big_spikes.glb` |
| `shell-turtle.glb` | The asset board's own validator | Corrected |
| `REQ-A-002` had no acceptance test | The depth audit | An acceptance test was written and added |
| The stage schema differed between the world and architecture boards | The world board's delta note | **v2 adopted**; the architecture board's §5.2 rewritten to match |
| The save schema could not hold the remapped bindings or the accessibility options | The player board's `BLOCKED-P-01` | **Schema v6** with a `5 → 6` migration |
| The player capsule was described two ways | The player board's `CB-04` | **radius 0.35 m, height 1.75 m** everywhere |
| The jump apex was described three ways | `CB-05`, R-01 | The apex is **per-profile** under the bounded-hold model; the stale single figure is withdrawn |
| The camera's vertical dead zone was described two ways | `CB-07` | **One `[6, 3]` rectangle, both axes, plus a soft Y rate** |
| The companion rig was unspecified | `BLOCKED-P-02` | The asset board's named rigs adopted: `prototype/animal-horse.glb` (mount), `ShibaInu.gltf`, `Fox.gltf` |
| The ship set excluded rigs the roster needs | `XN-ENT-02` | The ship set is amended and the **73 MB target is restated as ≈104 MB** |
| The runtime-transform vocabulary was uncodified | `XN-ENT-09` | Codified as `DESIGN-3-ARCHITECTURE.md` §8.3a, permitted and distinct from authoring |
| The jump apex had three different values | The Cursor senior review (R-01) | Made **per-profile**; the stale "≈1.69 m" withdrawn; conservative reachability bounds published |
| The jump buffer was 0.12 s in one place and 8 ticks in another | R-02 | One value: **8 ticks (0.133 s)** |
| `TUNE-008` published a different friction schema from the contract | R-03 | The contract's **(friction, acceleration) pair** schema is now the single source |
| `REQ-C-006` depended on an undecided asset gap | R-04 | `G-01` resolved as option (a′) — a uniform-scale retract on a named rig |
| `LINT-005` compared a horizontal gap to a vertical apex | R-05 | Horizontal clearance and vertical apex now measured **separately** |
| `TUNE-P-021` was double-booked | R-06 | `drop_through_time` is now `TUNE-P-045`, registered |
| Ten sound and particle cue ids named no file | R-09 | Every cue now names a manifest row; the conveyor loop is **SILENT** with a named gap and two more name the nearest shipped row with the difference recorded |
| Nintendo-branded input prompts were marked shippable | R-10 | The Nintendo families are **removed** from the shipped row |
| `G-03` proposed a shader-driven wing beat | R-11 | The clause is **withdrawn** — named meshes and clips only |
| `REQ-D-015` had no ship decision | R-12 | The **silent-music-bus** decision is baked into the acceptance test |
| The `NFR-01` hardware baseline was only proposed | R-13 | **Pinned** as normative; `OPEN-001` closed |

---

## 11. The conflict register — every disagreement found, and its resolution

This is the "no conflicting statements" evidence. **Twelve cross-board conflicts were
raised; all twelve are resolved in the boards themselves, not just described here.**

| # | Conflict | Resolution | Where |
|---|---|---|---|
| `CB-01` / `BLOCKED-P-01` | The save schema could not hold remapped bindings or accessibility settings | Save schema **v6** + a `5 → 6` migration | architecture §5.7, §6.4 |
| `CB-02` | `branching_companion`'s `carry_throw` flag was `true` in the architecture example but the translation assigns carry/throw to the `carry_throw` set | Example corrected to `false`; the feature-to-ruleset allocation marked normative | architecture §5.1 |
| `CB-03` | Charge-glide and the levitation power-up form looked like the same mechanic | They are two different mechanics with two different gates; acknowledged, no new flag added | architecture §5.1 |
| `CB-04` | The player capsule was "1.6 u tall, 0.7 u radius" vs "radius 0.35 m, height 1.75 m" | **radius 0.35 m, height 1.75 m**; the 0.7 m footprint is a diameter | translation §0 |
| `CB-05` | The jump apex was "≈3.2 blocks" vs "≈1.69 m" vs the player's per-profile table | The **bounded-hold model is normative**; all three documents now publish the same per-profile table and the conservative reachability bounds | translation §2.2, architecture `TUNE-003` |
| `CB-06` | The primary playable rig was the Kenney 6-joint cast vs the KayKit 41-joint rigs | **KayKit 41-joint is primary**; the Kenney cast is the NPC rig; a golden retarget test is a Gate 2 blocker | architecture §2.2 |
| `CB-07` | The camera's vertical dead zone was "larger" vs a fixed `[6, 3]` | **One `[6, 3]` rectangle, both axes, plus a soft Y follow rate** | translation §4 |
| `BLOCKED-P-02` | No named rideable companion rig | **Resolved** by the asset board's manifest: `prototype/animal-horse.glb`, `ShibaInu.gltf`, `Fox.gltf` | player §10 |
| `W-01/02/03` | The stage schema lacked `music_cue_id`, `placements` and the 3D field groups | **Stage schema v2** adopted; v1 remains valid | architecture §5.2 |
| `XN-ENT-02` | The ship set excluded rigs the archetype roster requires | Ship set amended; the budget **moved from 73 MB to ≈104 MB** rather than the design | architecture §8.5 |
| `XN-ENT-09` | The runtime-transform vocabulary was uncodified | Codified and explicitly distinguished from authoring | architecture §8.3a |
| `GAP-A10` | No clip set covers swim, glide, flight, charge or climb | A **four-tier rule**: bind to a rig that has the clip → `root_node_transform` on a named rig → nearest named analogue with the difference stated → an ASSET GAP. **Ten gap rows, no placeholders.** | entities §8, architecture §8.3a |

### 11.2 A first review round — the Cursor senior review

A Cursor senior review was run over all five boards with the acceptance criteria in
§13. It returned **17 findings**. **Ten were real and are fixed**; two were false
alarms, caught by checking the packs directly; five were already covered. **One further
review was run after the fixes.**

| # | Finding | Verdict | Resolution |
|---|---|---|---|
| R-01 | The jump apex had **three** values — "≈1.69 m", "≈3.2 blocks", and the player's computed per-profile table | **REAL** | The apex is **per-profile** and the single figure was stale. `TUNE-003`, the translation contract, the world board's reachability rule and `CB-05` now all publish the same table. Conservative reachability bounds: **2.43 m vertical, 5.43 m horizontal** |
| R-02 | The jump buffer was 0.12 s in the contract and 8 ticks (0.133 s) in the boards | **REAL** | One value: **8 ticks (0.133 s)** everywhere |
| R-03 | `TUNE-008` published a different friction **schema** and different numbers from the contract | **REAL** | `TUNE-008` now publishes the contract's **(friction, acceleration) pair** schema; the old scalar list is withdrawn |
| R-04 | `REQ-C-006`'s shell archetype depended on an **undecided** asset gap | **REAL** | `G-01` is **resolved as option (a′)**: a uniform-scale retract on the named rig `mini-characters/character-female-b.glb`. Options (a) and (b) are declined, and the entities acceptance now states the difference |
| R-05 | `LINT-005` compared a **horizontal** gap width against a **vertical** jump apex | **REAL** | The lint rule now uses horizontal clearance (`2 × t_apex × run_speed`) and vertical apex **separately**, against the conservative profile |
| R-06 | `TUNE-P-021` was double-booked | **REAL** | `drop_through_time` is now `TUNE-P-045`, registered in the player's constant table; `TUNE-P-021` remains `glide_min_charge_ticks` |
| R-07 | KayKit paths cited as `*.gltf.glb` | **FALSE ALARM** | The **upstream pack genuinely contains files with the doubled extension** — verified directly against `zipfile.namelist()`. The cited paths are correct |
| R-08 | The `alps_field` HDRI cited by the world board does not exist | **FALSE ALARM** | `assets/polyhaven/alps_field/alps_field_1k.hdr` **is present** in the fetched pack. It was simply outside the survey's sample list |
| R-09 | Ten sound and particle cue ids named no file | **REAL** | Every cue in the world's material table now names a **manifest row** (`AU-…` / `FX-…`); the one with no shipped file (the conveyor loop) is marked **SILENT** with a named gap, and two more (metal footstep, hazard cue) name the nearest shipped row and record the difference |
| R-10 | `IN-017` shipped **console-branded** input prompts | **REAL** | The Nintendo families (Switch, Switch 2, Gamecube, Wii, WiiU) were removed first, and the **third review tightened this further**: **every** console-manufacturer-branded family is now excluded (Nintendo, PlayStation, Xbox, Meta Quest, Steam Deck, Playdate). `IN-017` ships only the **trademark-free** families — `Generic/` and `Keyboard & Mouse/`. Kenney's CC0 covers the *art*, **not the trademarks** |
| R-11 | `G-03` proposed a shader-driven wing beat | **REAL** | That clause is **withdrawn**. The glide uses only named meshes and named clips — a suspended fall on the authored `Fall` clip, with no wing pose |
| R-12 | The music gap left `REQ-D-015` without a ship decision | **REAL** | The **ship decision is baked into the acceptance test**: the music bus ships **silent**, no cue is fabricated, and the build is releasable in that state |
| R-13 | The `NFR-01` hardware baseline was "proposed", not defined | **REAL** | The baseline is now **pinned** in §9.1; `OPEN-001` is closed |
| R-14 | `CB-05` still quoted the withdrawn "≈3.2 blocks" figure | **REAL** | `CB-05` is **closed** and quotes the resolved per-profile table |
| R-15 | Shell and glide gaps still stood against `DESIGNED` statuses | **REAL** | Closed by R-04 and R-11: the chosen analogue is now encoded in the acceptance tests |
| R-16 | World-graph placeholders for deferred regions | Not a defect | Graph placeholders are **not visual placeholders**; they are non-rendered nodes marked `hidden` |
| R-17 | The review could not unzip every pack itself | — | The design's own path resolution did it: **849 cited paths, 0 unresolved**, plus the asset board's independent **619-path** pass against real archive listings |

### 11.2a A second review round — the decisions that were still open

The second review confirmed **10 of the 11 claimed fixes** and found the last set of
issues: some asset gaps were still *undecided*, which would have sent an implementer
back to the requester. **All of them are now decided in the asset board itself.**

| # | Finding | Resolution |
|---|---|---|
| S-01 | `G-01` was marked resolved but `EN-002`, the REQ map, §12.2, the open-decisions list and the CI worked example still said **GAP** | All five now say **SHIPPABLE** with the real member `mini-characters/character-female-b.glb`; the CI example teaches the *decided* fix rather than a nulled entry |
| S-02 | `drop_through_time` was "float seconds, 0.25 s" in the schema and "15 ticks" in the register | **Ticks**, everywhere. The authored value is an exact integer at the fixed tick rate |
| S-03 | The master said "three SILENT" cues; only the conveyor loop is | Corrected — **one SILENT**, two naming the nearest shipped row with the difference recorded |
| S-04 | `G-05` was still an open parent decision against the master's silent-music decision | `G-05` is **ADOPTED (c)** — a silent music bus, no placeholder |
| S-05 | The entities board and the manifest cited the same model in two different pack forms | The **manifest citation of record** is `10-kenney-collection.zip!mini-characters/character-female-b.glb`; the entities board now names it as such and records the duplicate |
| S-06 | `TUNE-009` was called "the base run speed" but is the **maximum** across profiles | Reworded — the conservative clearance uses **Brindle's 5.4 m/s** |
| S-07 | The master and architecture matrix omitted the no-carapace clause on `REQ-C-006` | Added to the architecture matrix row, so the master inherits it |
| S-08 | `G-04`, `G-09`–`G-14` still offered three options each | **Every one now carries an ADOPTED option** — see the table below |

### 11.2b Every asset gap now has a decided option

No implementer can reach a gap and be asked to choose. Each gap names the option taken
and the behavioural difference that follows.

| Gap | Option adopted | The difference that follows |
|---|---|---|
| **G-01** shell creature | **(a′)** a uniform-scale retract on a named rig | No detached carapace; the "kick" launches the same actor |
| **G-02** swimming | **(a′)** a runtime blend of `Fall` + `Idle` | No distinct arm-pull cycle; the swim reads as a controlled fall |
| **G-03** glide / flight | **(a)** `Jump_Full_Long` + `Fall` | No wing-spread pose; **the shader-wing option was struck** |
| **G-04** charge / wind-up | **(c)** HUD + light-mask telegraph | No in-mesh wind-up pose; the charge meter is the primary readout |
| **G-05** music | **(c)** a silent music bus | No region music; the build is releasable in that state |
| **G-06** ambience loops | **(c)** randomised one-shot scheduling in the mixer | The bed is granular texture, not a continuous loop |
| **G-07** tonal UI | **(c)** `select-a` for positive, `error-a` for negative | Menu feedback repeats; the UI compensates visually |
| **G-08** voice | **(c)** out of scope — text cards | No voice layer |
| **G-09** boss phase change | **(c)** a pure data transition with a telegraph | No in-mesh phase animation |
| **G-10** wind streak | **(a)** a named mask, rotated to the wind vector | The mask conveys direction by rotation, not by intrinsic streaks |
| **G-11** quicksand suction | **(c)** a material profile plus a sink volume | No suction sprite; the pull reads through the sink motion |
| **G-12** note-block tone | **(c)** a bumpable block that launches | No pitched note; the pitched-note requirement is dropped |
| **G-13** composite boss bodies | **(a)** for the flame, **(b)** for the platform | The split is a spawned secondary body; the platform is boarded, not ridden |
| **G-14** font coverage | **(c)** a Latin-1-only shipped locale | No RTL, no CJK; `REQ-E-013` re-opens if the corpus gains a family |

**What remains a genuine asset gap is one row, not fourteen**: the **music cues**
(`AU-019`). Every other gap has a **decided** resolution recorded in the asset board
§13, and the manifest now publishes that decision rather than publishing the gap:

| Row | Status | Decided by |
|---|---|---|
| `AU-019` — region music cues | **`GAP`** | `G-05` — the music bus ships **silent**; no cue is fabricated, and a composer-supplied file enters through the same slot and the same gate |
| `AU-020` — ambience beds | **`DERIVED`** | `G-06` — mixed in the engine from the 52 shipped `.ogg` by randomised, **pitch-preserving** one-shot scheduling |
| `AU-021` — tonal UI set | **`SHIPPABLE`** | `G-07` — `select-a` for every positive action, `error-a` for every negative one, reused from `AU-008` / `AU-009` |
| `AU-022` — voice layer | **`OUT_OF_SCOPE`** | `G-08` — announcements are delivered as text cards in `FT-001` |

The distinction matters to an implementer: a `GAP` row means *go and find a file*, a
`DERIVED` row means *write the mixer rule*, an `OUT_OF_SCOPE` row means *do not build
this*. Publishing all four as `GAP` — as the board did — sent an implementer to look for
assets that a decision had already replaced.

### 11.2c A third review round — the cross-board contradictions that survived

The third review confirmed the second round's fixes and then did the thing the first two
missed: it read each board **against the others** rather than reading each board on its
own. That surfaced **nine defects of one kind** — a decision taken in board A and still
contradicted in board B. Every one is fixed, and the fix is in the owning board.

| # | Finding | Resolution |
|---|---|---|
| T-01 | The camera dead zone was `[6, 3]` in the contract, the architecture board, the player board and the master — but the world board's `cz_climb` zone used **`[6, 6]`** | The world board now uses **`[6, 3]`**, the single authored rectangle, and states that the anti-jerk behaviour comes from the **soft vertical follow rate** and that **no zone may widen the rectangle** |
| T-02 | The player board's prose said "Tallow **and Sable** match the coyote/buffer defaults" — Sable is `8/10`, not `6/8` | Corrected. Only **Tallow (6/8)** matches the defaults; Brindle is `5/7`, Sable `8/10`, Moth `10/12` |
| T-03 | The player board still specified **glide = `Jump_Idle` + `Unarmed_Pose`** and **charge = `Block` + `Spellcast_Raise`**, contradicting the adopted `G-03` (a) and `G-04` (c) | The player board now uses **`Jump_Full_Long` + `Fall`** for the glide and the **HUD cue + scale ramp** for the charge — exactly the adopted decisions, with the behavioural difference stated |
| T-04 | The player board's `CB-07` still asked the requester to "confirm the 6 × 3 rectangle **or widen** it" after the translation had already closed it | `CB-07` is **CLOSED**; the single rectangle plus a soft Y rate is normative, and no board may widen it |
| T-05 | The world board's `W-OPEN-01` still asked the requester to "choose (a)/(b)/(c)" for music after `G-05` had **adopted (c)** | `W-OPEN-01` is **CLOSED**; §7.6.4 now states the taken ship decision and describes (a)/(b) as optional future deliveries into the existing slot |
| T-06 | The world board's `W-OPEN-03` still asked for the stage-schema deltas `W-01`/`W-02`/`W-03` to be applied after the architecture board had **accepted** them | `W-OPEN-03` is **CLOSED**; the architecture board's §5.2 carries stage schema **v2** with 30 top-level fields |
| T-07 | The world board's `W-OPEN-04` still asked for the launch language set to be named after `G-14` had **restricted it to Latin-1** | `W-OPEN-04` is **CLOSED**; `en-GB` and `en-US` ship, no RTL, no CJK |
| T-08 | The world board marked the **8 ambience cues** `UNSOURCED` while `G-06` had adopted **deriving them in the mixer**; the asset board's `AU-020` said `GAP` for the same reason | The ambience cues are now **`DERIVED`**, `AU-020` is **`DERIVED`**, the cue counts and the `asset_audit.py` counters (`unsourced_cues: 27`, `ambience_cues_derived: 8`) were corrected, and the manifest gained the `DERIVED` and `OUT_OF_SCOPE` statuses so a **decided** gap can never be published as an unresolved one |
| T-09 | `G-06`'s rejected option (c) bullet still said **pitch-shifted**, while the adopted banner says **pitch-preserving** and the asset rule forbids pitch shifting | The bullet was corrected to **pitch-preserving**. A rejected option that contradicts the adopted one is a trap for whoever reads the options before the banner |

**Two further corrections came from the integrator's own measurement, not from the review:**
the manifest's published row counts were **three different numbers** (465/5, 465/4, and
"465 shippable, 14 asset gaps"), and **465 + 1 + 4 = 470, not the 471 rows claimed**.
Parsing the manifest tables gave the truth — **471 rows: 467 `SHIPPABLE`, 1 `PENDING`,
1 `DERIVED`, 1 `OUT_OF_SCOPE`, 1 `GAP`** — and every document now publishes that
measured figure. The fourth round also tightened `IN-017` from "non-Nintendo console
families" to **trademark-free families only** (`Generic/` and `Keyboard & Mouse/`),
because PlayStation and Xbox are trademarks too.

### 11.2d A fourth review round — the residue of the ambience decision

The fourth review confirmed **8 of the 9** round-three fixes landed and marked **1**
partial, then found **5 further leftovers** — all of them residue from the same two
decisions (`G-06`, the derived ambience, and `G-14`, the Latin-1 locale set). They are
fixed, and the gate now checks for this class explicitly.

| # | Finding | Resolution |
|---|---|---|
| N-01 | **The `G-06` decision had not been propagated.** The ambience beds became `DERIVED`, but `ambience_cues_unsourced: 8` was still the counter in the world board's acceptance test, the world board's `REQ-D-015` matrix row, `GAP-W-001`, the architecture board's `REQ-D-015` row and `OPEN-003`, and the **entities board** still marked its wind and water-ambience cues `UNSOURCED`. The cue-resolution rule itself still allowed only **three** outcomes (shipped / `UNSOURCED` / `SILENT`) in both boards | The counter is now `ambience_cues_derived: 8`; the cue-resolution rule allows **four** outcomes (shipped / `DERIVED` / `UNSOURCED` / `SILENT`) in both the world and architecture boards; the `AUDIO-003` error text lists all four; the entities board's wind and water rows are `DERIVED`, and its `GAP-ENT-06` / `GAP-ENT-07` rows record the `G-06` resolution |
| N-02 | The world board's §8.3 still said "`OPEN-004` has not named the language set" | §8.3 now states the decision — **Latin-1 only, no RTL and no CJK** — and the hard font dependency now governs *future* locales rather than blocking the launch ones |
| N-03 | The asset board's CI steps still validated `status` against **three** values, so a `DERIVED` row would have failed the build | Step 4 validates all **five** statuses and asserts the status agrees with the §13 decision (`ASSET-STATUS-DECISION-MISMATCH`); steps 6 and 7 skip path/hash checks for `GAP`, `DERIVED` and `OUT_OF_SCOPE`; step 11 requires an `ADOPTED` option (`ASSET-GAP-UNDECIDED`) |
| N-04 | The player board's `BLOCKED-P-01` still asked the requester to "**Approve save schema v6**" — a decision the architecture board had already taken | `BLOCKED-P-01` is **RESOLVED**: save schema v6 with the eight settings fields and the `5 → 6` migration row exists. Closed by `CB-01` |
| N-05 | The player board's prose claimed Sable (8/10) "trades coyote time for a **shorter** buffer" — the table says Sable has **more** of both than the 6/8 defaults | Corrected: Tallow (6/8) matches the defaults exactly, Brindle (5/7) has the least, Sable (8/10) has the most coyote and buffer room of the ground profiles, Moth (10/12) the most of all |

**One of these five was an error this integration introduced**, and the review caught it:
N-05 was introduced by the round-three fix to the very sentence it corrects. That is the
case for running the review again after the fixes rather than declaring the class closed.

### 11.2e A fifth review round — the measured constants that had two values

The fifth review confirmed all five of the previous round's fixes landed, then found
**five more** — this time in **measured constants** that were published with two
different values in two documents. All are fixed.

| # | Finding | Resolution |
|---|---|---|
| P-01 | The asset board's **§14.3 manifest schema** still described a **three**-status vocabulary, with `pack`/`path` null only for `GAP`, `gap_id` required only for `GAP`, and `sha256`/`bytes` required iff the status was not `GAP` — so a `DERIVED` row would have failed the build | The schema now carries all **five** statuses throughout: the `status` row, the null rules for `pack`/`path`, the `gap_id` rule (required for `GAP`, `DERIVED` and `OUT_OF_SCOPE`, and it must resolve to an **ADOPTED** entry), the `sha256`/`bytes` rules (required iff `SHIPPABLE` or `PENDING`), and the one-sentence validation rule |
| P-02 | The entities board published the player capsule as **"1.6 × 0.7 (3D-TRANSLATION §0)"** while the translation, the architecture board and the player board all publish **radius 0.35 m, height 1.75 m** | The entities board now publishes **radius 0.35 m, height 1.75 m (0.7 m footprint diameter)** — architecture `TUNE-011` |
| P-03 | The damage-source enum was **seven** in the architecture board's `REQ-C-003` acceptance clause and **nine** in the entities board and the binding translation. The entities board had filed `XN-ENT-01` asking the architecture board to correct it — the note was still open | The architecture board's `REQ-C-003` row now reads **9 damage sources** and names all nine values; `XN-ENT-01` is **CLOSED**; all three boards publish nine |
| P-04 | The audio corpus was published three different ways: **"78 files"** (assets, world, survey, master), **"78 shipped SFX"** (the mix pool for `G-06`), and **"52 unique sounds"** (entities, architecture) — and the world board's shipped cue count read **56**, double-counting `select-a` and `error-a…c` | One triple is published everywhere, taken from the measured inventory: **78 audio file paths → 66 unique sounds → 52 shipped `.ogg`** (40 Kenney Desert Shooter + 12 `Fantozzi` footsteps). The 12 `.flac` are alternates of the shipped footsteps, each present at **two** paths; the 2 `.wav` are gunshot files no cue needs. The shipped cue count is **52**, and the world board states why the old "56" was wrong |
| P-05 | The player board's `REQ-A-018` acceptance still read "**Behaviour-only until `BLOCKED-P-02` names a companion rig**" — although `BLOCKED-P-02` was **RESOLVED** and the rigs were named | The acceptance test now cites the named rigs — `EN-046` (`prototype/animal-horse.glb`, clips `walk, run, down, up`), `CO-004` (`ShibaInu.gltf`), `CO-005` (`Fox.gltf`). `AG-P-07` is **RESOLVED** |

### 11.2f A sixth review round — the residue of the residue

The sixth review confirmed all five of the previous round's fixes landed, then found
**seven more** — one of them a contradiction *inside a single sentence*. All are fixed.

| # | Finding | Resolution |
|---|---|---|
| Q-01 | The asset board's closing bullet re-enumerated the audio corpus as "**78 files split 36 FLAC + 12 OGG + 2 WAV + 40 OGG**" — which sums to **90**, contradicting the body text | The bullet now carries the same measured triple as the body: **78 paths → 66 unique → 52 shipped `.ogg`**, with the 12 `.flac` and 2 `.wav` explained |
| Q-02 | The same closing bullet said the decided gaps "**each need an option chosen** before Gate 4" — in the same sentence that called them "**Decided, not open**" | The bullet now says each carries an **ADOPTED** option in §13 and that **no option remains to be chosen** |
| Q-03 | The entities board still reported `XN-ENT-02` and `XN-ENT-09` as "**blocked pending cross-board sign-off**" although the architecture board had already answered both (ship-set amendment §8.5, runtime-transform vocabulary §8.3a) | All three of the entities board's cross-board notes — `XN-ENT-02`, `XN-ENT-09`, `XN-ENT-10` — are **CLOSED**, with pointers to the architecture board's clauses, and the board's status line no longer says anything is blocked |
| Q-04 | The architecture board's **archetype example** taught two values the binding enums do not contain: the resistance `"fire"` (the enum has `environment` and `poison`) and the activation `"outside_camera_margin"` (the entities board uses `camera`). Anyone copying the example would ship the wrong vocabulary | The example now reads `"environment": "take"` and `"sleep": "camera"`. A gate now fails any example whose vocabulary is not in the enum |
| Q-05 | `REQ-C-013`'s acceptance clause said "**7 hazards**" in the matrix while the entities roster specifies **eleven** archetypes and the requirement itself names **six** kinds | The clause now states both numbers precisely: the **6** parameterised kinds the requirement names, each implemented by at least one archetype, and **all 11** roster archetypes, each of which must declare a non-empty attack hitbox. `XN-ENT-12` is **CLOSED**. The world board's separate count of **13 stage *interactive objects*** is now explicitly labelled as a different category |
| Q-06 | The world board's `W-OPEN-02` still asked the requester to approve the font's licence, although the asset board's manifest rows `FT-001`/`FT-002` are **`SHIPPABLE` with a read `CC0-1.0` licence** | `W-OPEN-02` is **CLOSED**, and the world's gap tally now counts the font row as *resolved by a decision elsewhere* rather than as a requester decision |
| Q-07 | The world board's `W-OPEN-05` re-asked the requester to confirm the Gate 1 stage scope that the board's own §1.1 had already committed to (13 stages) | `W-OPEN-05` is **CLOSED**; the further stages are **backlog**, not an open design question |

**Two of the seven were found by the review in text this integration had just written.**
That is the argument for running the review again after the fixes rather than declaring
the class closed — and it is why the gate now checks prose as well as tables.

### 11.2g A seventh review round — the last three categories

The seventh review confirmed all seven of the previous round's fixes landed, then found
**four** more, and one of them opened a category of eighteen. All are fixed.

| # | Finding | Resolution |
|---|---|---|
| R-01 | `REQ-D-012`'s acceptance clause said "**8 hazard kinds**" in the matrix while the world board's catalogue held **13** — and the world board had carefully reconciled 13 against the *entities* board's 11 for `REQ-C-013`, but never against the matrix's 8 | Both numbers are now stated precisely, as for `REQ-C-013`: the **8 kinds the requirement names** (lava, spikes, crushing ceilings, pits, currents, waterfalls, wind, fireballs) are each implemented by a named catalogue entry, and **all 14 catalogue entries** emit the unified hazard event. The six entries beyond the eight are **extensions**, not replacements |
| R-02 | The entities board's `XN-ENT-14` handed the **submerged electrical obstacle** to the world board — and the world board's hazard catalogue had **no such row**, so `REQ-C-011`'s fourth aquatic thing had nowhere to live | The world board's catalogue now carries **`H-14` `hazard.electrical`**, the submerged pylon (`shorepine-kenney/3d/factory/structure-tall.glb`), with `AC-H14`. `XN-ENT-14` is **CLOSED** |
| R-03 | The asset board's coverage index still labelled **twelve resolved gaps as gaps** — "animation GAP `G-02`", "FX GAP `G-10`", "charge GAP `G-04`", "phase GAP `G-09`", "composite GAP `G-13`", "note tone GAP `G-12`", "family coverage GAP `G-14`" and others — although every one of those §13 entries carries an **ADOPTED** option with a named substitute | Each label now names the **adopted resolution and its assets** instead: the runtime blend of `Fall` + `Idle` on `Knight.glb`, the wind mask `circle_a_streaks.png`, the HUD cue plus scale ramp, the pure data transition, the segmented `animal-caterpillar.glb` body and `castle/siege-ballista.glb`, the dropped pitched-note requirement, and the Latin-1 locale set. The manifest's four audio rows now also carry their `gap_id`, so the one gap that genuinely remains — the music — is the only one still labelled a gap |
| R-04 | The audio corpus was still published two ways: the architecture board said "**52 unique sounds**" and the asset survey's table said "**24 `.flac` + 24 `.ogg`**" (the inventory holds **12** `.ogg`) | The architecture board now publishes the full triple, the survey's table reads "12 `.ogg` + 24 `.flac` **rows** (= the same 12 `.flac` at two paths each)", and the survey gained the missing **gunshots** row so its table sums to the 78 paths |

### 11.2h An eighth review round — the closing checklist

The eighth review confirmed all four of the previous round's fixes landed, and then
tested whether the defect class was closed. It found **four** residual items — all of
them *summary arithmetic* rather than re-opened design forks — and gave the verdict that
the package was **almost** closed, with the class extinguished except for the closing
checklist. All four are fixed.

| # | Finding | Resolution |
|---|---|---|
| S-01 | The world board's closing checklist still said "**13 hazards**" after `H-14` was added, and glossed it as stage interactive objects | The checklist now says **14**, and states that the nine catalogue numbers are the **measured row counts** (`B-01…B-24`, `P-01…P-09`, `S-01…S-08`, `D-01…D-14`, `W-01…W-07`, `H-01…H-14`, `I-01…I-11`, `K-01…K-04`, `G-01…G-15`) |
| S-02 | The same checklist said "**15 doors and keys**" while the catalogue holds `D-01…D-14` — **14** | Corrected to **14** |
| S-03 | The `REQ-D-012` clause said "six entries beyond the eight required kinds" — but spikes are covered by **two** entries (`H-02`, `H-03`), so the eight kinds occupy **9** entries and there are **5** extensions | The clause now says the 8 kinds are covered by **9** entries and the remaining **5** (`H-01`, `H-04`, `H-05`, `H-13`, `H-14`) are extensions |
| S-04 | Three cross-board notes were still open — `XN-ENT-03` (the `spawn` state), `XN-ENT-11` (the `normal_bin` matrix axis) and `XN-ENT-13` (`parts[]`) — because the architecture board's schema and example lagged behind the entities board's decisions | The architecture board's §5.3 example now declares the **`spawn`** state and a **`parts[]`** array, and a new **Damage authority** row publishes the **three-axis** matrix key `(damage_type × matrix_state × normal_bin) → outcome` with the nine damage types, the nine matrix states, the five `normal_bin` values and the `DAMAGE-006` no-silent-fallback rule. All three notes are **CLOSED**. The architecture board's stale callout about the survey's broken arithmetic is also retired — the survey is fixed |

**The gate now measures the checklist against the tables** (`catalogue tally`): the nine
counts in the world board's closing summary are parsed from the catalogue rows
themselves, so a summary that drifts from its own tables fails the build.

### 11.2i A ninth review round — the design boards closed

The **ninth** round ran over the design boards after the eighth round's residue had
been fixed, and **closed the design boards**. The tenth round was then pointed at
the development bots, which is where the remaining defects were.

**This subsection exists because the audit trail had a hole.** The ninth round was
recorded only as a single sentence inside the tenth round's record, and the round
numbers in the eight preceding subsection titles were each **one ahead** of the
round their own prose describes — the first round's seventeen findings sat under a
heading that called it the second review round, and so on down to the eighth. A
reader counting the sections would have found twelve review rounds; a reader
trusting the titles would have read every one of them as the wrong round. The
titles are corrected, this round is given a record of its own, and the count the
master publishes is now **derived from the records** rather than typed — so the
next hole cannot open silently again.

**What this round is not evidence of.** This package does not retain the ninth
round's prompt or its itemised findings, so the master states only what its own
prose supports: the round ran, and it closed the design boards. No finding list
is reconstructed here. A reconstructed list would be indistinguishable from a real
one, and would be worse than the gap it filled.

### 11.2j A tenth review round — the development bots and the path namespace

The ninth round closed the design boards. The tenth was pointed at the **development
bots** and at whether the design could actually be implemented by five people working
at once. It found **nine** defects, two of them blockers, and it also exposed a
weakness in this package's own tooling. All nine are fixed.

| # | Finding | Resolution |
|---|---|---|
| T-01 | **`pd-dev-world` carried `REQ-B-002` as "across all 8 scene transitions"** while the design says 13 (now **19**). The bot would have implemented the wrong test | The bot now carries the matrix's acceptance test **verbatim** |
| T-02 | **`pd-dev-player` required "≥1 allowed input" for all 15 states**, which would fail the three input-locked states the design says are **empty by design** | The bot now carries the matrix's acceptance test verbatim |
| T-03 | **`pd-dev-entities` said "7 damage sources"** where the design enumerates **9** | The bot now carries the matrix's acceptance test verbatim |
| T-04 | **`pd-dev-entities` said "7 hazards"** where the design says **6 required kinds / 11 archetypes** | The bot now carries the matrix's acceptance test verbatim |
| T-05 | **The world's transition table contradicted its own acceptance clause**: the table applied `save_flags` on *stage → world map*, while the clause, the architecture matrix and the master all applied them on *victory → world map*. The table's *victory → world map* row said "no change" | The table now matches the clause: **victory → world map** applies `save_flags` and records `completed_exits`; *stage → world map* is the abandon-a-stage path and changes nothing. The clause was also made exact: `save_flags` writes `flags` and `world_graph`, which are **outside** the snapshot, so the clause now names **two** snapshot mutators and points the third at `REQ-E-006` |
| T-06 | **The pause overlay had no way back.** `Stage → Pause` and `Pause → Options` existed; `Pause → Stage` and `Options → Pause` did not, while `REQ-B-002` treated the table as the complete set of scene transitions | Both reverse edges are added, and every "13" citation was updated — in the world board, the architecture matrix, this master and the world bot. The eleventh review then found two more edges missing (`Title → Options` / `Options → Title`) and a flow graph that did not match the table, so the table stood at **18** transitions and §7.7.2's graph was derived from it |
| T-07 | **`AG-P-08` still called the rebind prompts an unregistered, unconfirmed-licence pack** while `IN-017` registers them as `SHIPPABLE`, CC0-1.0 | `AG-P-08` is **RESOLVED**: the prompts ship from `shorepine-kenney.zip`'s **trademark-free** families only, and the branded families are excluded by the trademark decision, not by a licence gap |
| T-08 | **`pd-dev-player` owned `src/actors/player/**`** — a directory that has never existed in the design's folder tree | The player's own behaviour moved to **`src/systems/player/`**, a real directory in §4.1; the stray path is gone |
| T-09 | `gravity` was published as **24.0 m/s** in one sentence of the player board and **24.0 m/s²** everywhere else | Corrected to m/s² |

**The path namespace was reconciled.** The tenth review also surfaced a defect class
the earlier rounds had missed, because no gate was looking for it: the boards cited
project files as `content/…` while §4.1 and all five development bots said
`src/content/…`, the asset manifest was cited under **two** names (`content/asset_manifest.json`
and `assets/asset_manifest.json`), and **sixteen content kinds** were defined by the
design while the bots' ownership globs covered only **seven** — so `palettes/`, `audio/`,
`scoring/`, `tuning/`, `objects/`, `backgrounds/`, `fx/`, `save/` and `damage/` had **no
owner at all**. Two boards could have written the same file, or none.

The fix was not a find-and-replace. §4.1 enumerates every directory and every
file explicitly — **75 directories and 24 files** as of the
fourteenth round — including every content kind the design defines, and §4.1 states the **three path
namespaces** explicitly: *project tree* (`src/…`), *pack-relative* (`assets/glTF/Fox.gltf`
— a file inside a downloaded pack) and the *design package's own tools*
(`tools/verify_design.py`). The manifest, its schema, the licence registry and the
generated attribution file now live together in **`src/assets/`**, which is the tree they
index. The four player profiles moved to **`src/content/characters/`** — a character
profile is not an enemy archetype, and the split is what gives the player board and the
entities board disjoint files. Every project path in every board was moved onto the
tree's prefix.

**Three new checks, all fault-injected.** The tenth review also pointed out that
`verify_devbots.py` compared only requirement **ids**, never the acceptance-test
**text** — so a bot could carry the right id with the wrong numbers and the gate stayed
green. That is exactly how `T-01`…`T-04` survived nine rounds. The gate now compares
every acceptance test a bot publishes against the matrix, verbatim, and the §4.1
containment check was rewritten to parse the tree instead of guessing at its shape.
A third check, `path namespace`, keeps a project path from drifting back into the old
layout. All three were fault-injected and **each one was made to fail** before the tree
was verified clean.

**The master now measures its own verification record.** The figures this document
publishes — the gate pass counts, the cited-path count — were typed by hand and had
already gone stale twice. `tools/build_master.py` now runs the gates against the master
it has just written, substitutes what they actually reported, and rewrites the document;
both gates then check that the published figure still matches their own run, so a stale
number fails the build instead of quietly surviving.

### 11.2k An eleventh review round — the gates challenged themselves

The tenth round turned the review on the development bots and found nine defects.
The eleventh round was pointed at the **result** of that work and at the **gates**
that were supposed to prove it, and it found six more defects — including one
**blocker** — plus a verdict that five of this package's own checks could still be
made to green-light a broken package. All are fixed.

| # | Finding | Resolution |
|---|---|---|
| U-01 | **`AG-P-08` was fixed, but the live shipping cites were not.** Three places still pointed the rebind glyphs at `kenney-cc0-game-art-packs.zip` — the pack whose families carry console trademarks — while `IN-017` ships from `shorepine-kenney.zip` | The world's screen table, its §7.7.3 rule 4 and the player's glyph table now all name `shorepine-kenney.zip!icons/Input Prompts/Generic/` and `…/Keyboard & Mouse/`. The 2,733-file pack is kept only as **measured, not shipped** |
| U-02 | **`src/systems/player/` existed in the tree and in the player bot's ownership, but §4.3's system table had no `player` row.** A bot owned a directory whose public interface the architecture never published — the exact coupling rule the design forbids | §4.3 now publishes the `player` system: it owns the profiles, the power ladder, the state machine and damage intake, and exposes `profile()`, `state()`, `apply_damage()`, `power_state()` and `reset()`. `REQ-A-005` and `REQ-A-019` now point at `§4.3 (player)` rather than `§4.3 (actors)` |
| U-03 | One live acceptance sentence still named `player.<profile>.actor.json` after the profiles moved to `src/content/characters/<profile_id>.character.json` | Corrected |
| U-04 | **The scene-transition table and the §7.7.2 flow graph did not agree.** The graph said options were reachable from the title and that a stage could quit to the title; the table had neither edge, and it had a `stage → world map` row the graph did not | The table is now **eighteen** transitions, the graph is redrawn from it, and §7.7.2 states that **every arrow in the graph is a row of the table and every row appears in the graph**. `rebind`, `save_slots`, `confirm`, `hud` and `tutorial_prompt` are declared **overlays** — they never replace the scene, so they are deliberately not rows. **This fix proved incomplete twice** — §11.2m (V-01, W-01) records the second correction, and §7.7.2 now publishes a canonical edge list rather than a drawn tree |
| U-05 | Five checks could be made to pass a broken package. The review named the exact input for each | All five were hardened, and each was **fault-injected with the review's own input** — the contradicting appendix, the invented tool file, the swapped content kind, the un-prefixed tree root, the surviving builder placeholder. `tools/fault_inject_hardened.py` runs all five and restores the tree |
| U-06 | `` `core/rules` `` was written without the tree's prefix | Corrected to `src/core/rules` |

**What the hardening actually changed.** The acceptance-text check now compares for
**equality**, not containment — a bot can no longer restate the matrix's clause and
append a different number to it. The §4.1 containment check now checks the **leaf**
as well as the directory, so a bot cannot invent a file the tree never authorised
(the tree now names every `docs/*.md` file for the same reason). The content-ownership
check no longer asks only "does every kind have *some* owner" — it reads the owner
the design states in **§8.3** and checks the bots agree, so two boards cannot swap a
kind and both look right. The path-namespace check now flags **any** §4.1 root used
without the `src/` prefix, not three of them. And the published-figures check now
**fails** on a surviving builder placeholder instead of passing on it, because the
builder sets `MASTER_BUILDING=1` only while it is measuring.

**The delivery items were renamed.** The master's §11.3 used `OPEN-01`…`OPEN-06`
for delivery items while the boards used `OPEN-001`…`OPEN-006` for design
decisions — `OPEN-02` (the bone map) and `OPEN-002` (the web release host) differed
by one digit and meant different things. The delivery items are now `DEL-01`…`DEL-06`,
and §11.3 publishes all **three** id namespaces side by side so a reader never has
to guess which one an id belongs to.

### 11.2l A twelfth review round — the package argued with itself

The eleventh round fixed the shipping cites, the missing `player` API row and the
id-namespace collision, and hardened five gates. The twelfth round was pointed at the
**result** and found that the scene-flow section still **disagreed with itself**, that
two tool basenames had **two spellings**, that a tool had **no owner and no place in
the tree**, and that this package's own fault-injection script had gone **stale** —
it injected a figure the master no longer published, so the injection was a no-op and
the check it was meant to prove was untested. All are fixed.

| # | Finding | Resolution |
|---|---|---|
| V-01 | **§7.7.2's flow graph claimed to be a bijection with §7.3's table, and was not.** It omitted `Boot → Title`, `Pause → Stage` and `Any → Boot` | The graph is redrawn to carry all of them, and says plainly that `boot → title` sits above the tree because it has no parent screen. **This fix proved incomplete** — the thirteenth round showed the redrawn graph still omitted `Pause → Stage` and `Any → Boot` as arrows. §11.2m (W-01) replaced the drawn tree with a canonical edge list and added the gate |
| V-02 | **`screen.credits` had no exit.** The prose claimed "every screen the game can occupy has an entry out of it" | `Credits → Title` was added. The table is now **nineteen** transitions, and every "18" became "19" — in the world board, the architecture matrix, this master and the world bot |
| V-03 | **`flag.endgame_complete` was written three ways**: the finale *sets* it, the `World map → Credits` row said it was "set once" there, and the graph said credits appears "when the flag is set" | The transition **reads** the flag and never writes it; the finale is the only writer. All three now agree |
| V-04 | **"Three transitions change persistent state" undercounted.** Credits, profile and quit also mutate session or flags | The sentence now states the truth the acceptance test actually asserts: **two** transitions change the snapshot, and **one** changes persistent state **outside** it |
| V-05 | **`validate_schema.py` vs `validate_schemas.py`** — the tree and the bot had one, the prose the other | The **tree's** name wins everywhere: `src/tools/validate_schema.py` |
| V-06 | **`world_map_validator.py` vs `world_graph_validator.py`** — the tree and the platform bot had one, the world board and the architecture prose the other | The tree's name wins everywhere: `src/tools/world_map_validator.py` |
| V-07 | **`src/tools/localisation_check.py` was invoked by the world board but was in neither the tree nor any bot's ownership** | It is now in §4.1's tree and owned by the **world** board, which is the board whose acceptance test runs it |
| V-08 | **`tools/fault_inject_hardened.py` injected "26 PASS" into a master that published "27 PASS"** — so injection #5 was a **no-op** and proved nothing | The script now reads the **live** figure from the master before mutating, and refuses to run if it cannot find one. It also caught a genuine crash: the new "a failing run cannot certify the master's figure" rule had been written against the wrong `results` shape and took `verify_design.py` down. That crash was found by the gate itself, not by inspection |
| V-09 | `AG-P-08` still said the branded prompt pack held **2,719** files; the survey measured **2,733** | The row now says the earlier draft counted 2,719 and the measured count is 2,733 |
| V-10 | The same pack was cited in two forms — `shorepine-kenney/icons/…` and `shorepine-kenney.zip!icons/…` | One form everywhere: the `zip!` form, which is what `IN-017` uses |

**Three more gate holes closed.** The content-ownership check read §8.3 into a
dictionary and would have passed **vacuously** if the table were deleted; it now
fails when §8.3 and the boards disagree on how many kinds there are. The
acceptance-text check only compared the rows a bot *had*; it now also fires when a
board **omits** a requirement the matrix assigns to it. And the published-figures
check would have certified a master whose run had failures; it now refuses to
certify a failing run.

**Two tools were invoked for twelve review rounds without ever existing.**
`src/tools/asset_audit.py` (six citations across the architecture and world
boards) and `src/tools/death_report.py` (cited by the entities board) were named in
acceptance tests and in the CI tables, but appeared in **neither** §4.1's folder
tree **nor** any bot's ownership — so a developer following the acceptance test
would have run a command that could not exist, and no bot was told to write it. A
third entry, `src/tools/verify_assets.py`, was in the tree but was never invoked by
any board, and duplicated `check_asset_manifest.py`. All three are resolved: the
audit and death-report tools are now in the tree and owned by the **assets** and
**entities** boards respectively, the redundant verifier is gone, and
`src/tools/launch_checksum.py` is now named in the deterministic-launch clause that
depends on it.

**A new gate now enforces it.** `verify_devbots.py` reads every
`src/tools/*.py` the boards invoke, every tool in §4.1's tree, and every bot's
ownership, and fails if a tool is invoked without existing, exists without an
owner, or exists without being invoked. It was fault-injected in both directions —
an invoked tool removed from the tree, and a tree tool nobody invokes — and caught
both.

### 11.2m A thirteenth review round — the claim that was not true, and the bot nobody checked

The twelfth round added a **bijection claim** between §7.7.2's flow graph and §7.3's
table, and drew the `Credits → Title` edge. The thirteenth round checked the claim
rather than the intention, and found it was **still false**: the graph said *"every row
of that table appears here"* while omitting `Pause → Stage` and `Any → Boot` as
arrows. It also found the one place in the package that **no gate read** — the
development bots' own prose — carrying a contradiction the boards had already
resolved. Both are fixed.

| # | Finding | Resolution |
|---|---|---|
| W-01 | **§7.7.2's graph was not a bijection with §7.3's table.** `Pause → Stage` and `Any → Boot` appeared only as prose, not as arrows, so the bijection claim was false on its face | **The drawn tree was replaced by a canonical edge list** — one line per transition, in the table's order, in the table's words. A drawn tree can only be checked by parsing box-drawing characters, and a parser that mis-reads one gives false confidence; an edge list cannot be mis-read, so the bijection holds by construction. The prose says plainly that resume **is** an edge of the flow and that the quit edge belongs to no screen but is still a table row |
| W-02 | **`pd-dev-world` still aimed `IN-017` at the branded pack.** It cited `kenney-cc0-game-art-packs.zip!assets/kenney/input-prompts/` and called it *2,719 glyph files* — a pack whose families carry console-manufacturer trademarks, with a stale count, **while the boards shipped from `shorepine-kenney.zip`** | The bot now ships `shorepine-kenney.zip!icons/Input Prompts/Generic/` and `…/Keyboard & Mouse/`, and names the branded pack as **measured, not shipped** |
| W-03 | **§11.3's heading was glued to its body** — `### 11.3 …design**Three id namespaces, never mixed.** This package…` | The heading ends with a blank line and `**Three id namespaces, never mixed.**` is its own lead sentence again |
| W-04 | **§11.4 said the review ran *eleven* times** while §13 said *twelve* — the same drift, in a third place | The count is now **derived from the review-round records the master publishes**, and substituted at build time, so it cannot drift again |
| W-05 | **The review-round records themselves were misnumbered, and the audit trail had a hole.** Eight of the section titles were each **one ahead** of the round their own prose describes — the first round's seventeen findings sat under a heading calling it the second review round — and the **ninth round had no record of its own**, surviving only as a sentence inside the tenth round's record. A reader counting the sections and a reader trusting the titles got different answers | All eight titles are corrected, the ninth round is given a record of its own (§11.2i) that states only what the package can evidence, and a new gate check requires **every review-round record to name the round it holds**, in order |

**The prompt-pack count is now measured, not inherited.** The shipping set was
re-counted from the real archive: `Generic/` holds **74** PNG and `Keyboard & Mouse/`
holds **516**, so `IN-017` ships **590 glyph files** — not the branded pack's 2,733,
which includes every Nintendo, PlayStation, Xbox, Meta Quest, Steam Deck and Playdate
family. The branded pack remains **measured, not shipped**, and its 2,733 files are
now stated as what they are.

**Three gate holes closed, and one check made non-vacuous.** The scene-flow gate
compared the **screen catalogue** with the table but never checked the **graph**, so a
false bijection claim passed; it now parses both and requires them to agree. The
development-bot gate compared the content-kind **count** but not the **sets**, so two
equal-sized but different kind sets could agree on the number and disagree on the
content; it now requires set equality. And a new check reads every bot's prose for
the **shipping** asset-pack path, so the class of defect in W-02 cannot recur in a
place no gate was looking. A fourth check requires each review-round record to name
the round it holds, which is the W-05 defect class.

**The review-round count is measured now too.** It was hand-written in two places —
§11.4 and §13 — and had already been wrong once. It is now **counted from the
review-round records the master publishes**, which are in turn the source of the
section letters, exactly as the line counts and the gate figures are. A published
number that nothing measures is a number that will drift.

### 11.2n A fourteenth review round — the gates were asked how they could lie

The thirteenth round left two classes uncovered and said so. The fourteenth round
went further: it **tried to make the four new gates pass on a broken package**, and
found three of them could. It also gave a **READY** verdict, because a gate that can
be fooled about one input is not a reason to hold up a design whose defects are
already fixed. The false-pass holes are closed here; the one limitation that is
inherent — a gate can prove two documents agree, not that the flow is sensible — is
now written into the design rather than left implicit.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| X-01 | **MAJOR (gate)** | **The bot-prose check could be fooled.** `not shipped` was not the only accepted marker: `trademark` and `excluded` were too, and both appear in a passage that *ships from the branded pack* — a bot could say "trademark-free families of `<branded path>` … branded families are excluded" and pass | The markers are now only `not shipped` and `measured`. The old markers were accepted because the world bot's own wording used them near a *correct* mention, which is exactly how a weak marker hides |
| X-02 | **MAJOR (gate)** | **The check's window was a 500-character radius**, so it reached into neighbouring bullets. The first attempt at a fix flagged `fps-buildings-env-kit.zip` for appearing near the word "prompt" — a **false positive**, which is worse than a false pass because it teaches the team to ignore the check | The rules are scoped to the **list item or paragraph** that mentions the prompts, and a third prompt pack is now rejected outright |
| X-03 | **MINOR (gate)** | **A duplicated edge line was only a WARN**, because the comparison was a set, not a multiset | The comparison now checks for duplicates on both sides and a duplicate is a **FAIL** |
| X-04 | **MINOR (gate)** | **A table cell holding two arrows was silently truncated** to its first two tokens | A malformed cell is now **rejected**, not parsed |
| X-05 | **MINOR (gate)** | **A review-round record could escape its own check** by dropping the words "review round" from its title — leaving the checked set and shrinking the published count at the same time | Every §11.2x section must now be a review-round record, or be explicitly declared not to be one |
| X-06 | **MAJOR (injection)** | **The m7 injection did not prove what it claimed.** Its defect text left `trademark` and `excluded` next to the branded path — which the old markers accepted — so the catch came from the stale `2,719` count, not from the not-shipped rule | m7 now uses the **correct** count of 2,733, with the old weak markers present and neither strong marker present. A second injection (m7b) removes the shorepine citation as well, so the branded-window rule is what catches it |
| X-07 | **MINOR** | §7.3 said "the **three** menu overlays (`Pause`, `Options`)" — it named two | "the **two** menu screens reachable as panels" |
| X-08 | **INFO** | The assets board's §12.20 described the input-prompt corpus as "keyboard, mouse, generic controller and nine console families", which reads as though the console families were in the shipped set | §12.20 now states plainly that **two** sets exist, that only one ships, and that the branded families are excluded by the trademark decision |

**Four more injections, and one builder hole.** The script now runs
**18** injections and reports **18/18**
caught. The three new ones cover the duplicate edge, the malformed table cell and
the title that escapes its check.

**A gate that crashes must not be measured as zero.** While fixing X-04 a
`NameError` was introduced into `verify_design.py`. The builder ran the crashed
gate, read no summary line, and published the figure as **"design 0 PASS"** — a
number that looked measured but was a crash, published into the master. The builder
now **stops** when a gate it is measuring produces a traceback or no summary line,
rather than publishing a figure it did not earn.

**The flow is now checked in as data.** The fourteenth review's third
recommendation was that §7.3's nineteen edges should be the first checked-in data
rather than prose, so UI work cannot invent a second flow. They are now specified
as **`src/content/flows/scene_flow.json`**, a new `flows` content kind owned by the
world board, in the §4.1 tree (**75 directories and 24 files**),
loaded by the scene-flow module and read by `AC-B002`. The design now defines
**eighteen** content kinds, each with exactly one owner.

### 11.2o A fifteenth review round — the gate that could not tell a broken design from a missing cache

The fourteenth round asked what the gates could not see. The fifteenth round found
it by **deleting the evidence** rather than by changing the documents: the design
cites **849** asset paths, and **722** of them live inside the pack archives
rather than in the repository's own inventory files. When the archive cache is
absent, those paths cannot be opened — and the gate reported them as
**fabricated**.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| Y-01 | **MAJOR (gate)** | **A missing cache was indistinguishable from a broken design.** The asset check reported `722/849 cited paths do not resolve to a repository file` and then printed **41 FAIL lines** naming individual paths as if they were fabricated — the header, plus the first forty, plus a count of the rest. They were not fabricated: the archives that would have proved they exist were simply not present to be opened. A reader had no way to tell a real defect from an environment gap | The check now **measures the cache state first**. When the cache is incomplete, the gate emits **one** legible FAIL naming the missing archives and how to restore them, and describes the paths as **UNVERIFIED** — never as fabricated. When the cache is complete, the original strict behaviour is unchanged: any path that does not resolve is still a fabricated-path FAIL, listed individually |
| Y-02 | **MAJOR (gate)** | **The gate could be green on an incomplete cache.** A cache that is quietly incomplete — a truncated download, a half-finished fetch — is a false certificate waiting to happen | The cache check is now its **own** gate check, and it fails even when every cited path happens to resolve. An archive counts as present only if it can actually be **opened**; a corrupt zip is a missing archive, not a present one |
| Y-03 | **MINOR (gate)** | **The expected archive list was a hand-written one.** A list typed by hand drifts the first time a pack is added or renamed, and a stale list would report the cache as complete when it is not — exactly the false pass Y-02 is about | The expected set is now **derived from the fetch scripts** (`tools/fetch-3d-packs.sh`, `tools/fetch-remaining-3d.sh`), which are the only place that knows the full intended archive list. The same rule the published figures follow — a number must be measured, not typed — now applies to the cache |
| Y-04 | **MINOR (tooling)** | **The cache location was hard-coded in two places**, so the path check and the cache check could disagree about where the cache was | The location is resolved once, in `tools/pack_cache.py`, and both checks read it. Two environment overrides (`GAMESTUDIO_PACK_CACHE_DIR`, `GAMESTUDIO_ASSET_MIRROR`) let a machine keep the cache elsewhere and let the fault-injection harness simulate its absence **without moving 2.4 GB of archives** |
| Y-05 | **MAJOR (gate)** | **The derived archive list could be empty, and an empty list read as a complete cache.** If both fetch scripts were missing or renamed, the derivation would yield nothing, and "nothing is missing" would have certified a cache that was never checked — the exact false certificate Y-02 was written to prevent | The derivation now **fails closed**: an empty expected set is a hard FAIL that names the fetch scripts and says the run certifies nothing. This was found by the fifteenth round's own senior review, not by inspection |
| Y-06 | **MINOR (tooling)** | **The two fetch scripts hard-coded one session's absolute path**, so on any other machine they fetched into a directory that did not exist | Both scripts now derive their destination from their own location, with an explicit argument still overriding it |
| Y-07 | **MAJOR (gate)** | **A PARTIAL derivation read as a complete cache.** The empty case was closed, but if only ONE of the two fetch scripts were missing, the other still yielded a non-empty list — and the check would certify "all 8 expected archives present" while half the intended fetch set was invisible to it. The same false certificate, with a weaker precondition | The derivation must now be **complete**: every fetch script must exist and must list at least one archive, or the check refuses to certify and names the script that cannot be used. Found by the fifteenth round's own senior review |
| Y-08 | **MINOR (figure)** | **Two published figures disagreed.** The archive-membership count (722 of the 849 cited paths live inside the archives) and the empty-cache unresolved count (721 on a machine with the shared mirror, 722 without it) were quoted interchangeably | The two figures are now distinguished everywhere, with the mirror's one-path contribution stated. The canonical figure is **722**, with 721 named as the mirror-present case |
| Y-09 | **MAJOR (injection)** | **Injection #15 did not prove the independence it claimed.** It ran the gate's internals but re-implemented the cache row itself, so deleting that row from `main()` would not have broken the injection — and its "no path was called fabricated" assertion was **vacuous**, because with an incomplete cache the path check reports UNVERIFIED, never "fabricated" | #15 now proves it in two halves: it first runs the **real path check with the cache reported complete** and requires it to record "all 849 cited paths resolve", and only then drives the **real `main()`** with the cache incomplete and requires the gate to fail **on the cache**. Driving `main()` is what makes it a regression lock |
| Y-10 | **MINOR (gate)** | **The set of fetch scripts was a typed tuple**, so a third script added later would have been invisible to the cache check, and a `fetch` call whose name the parser could not read would have been silently skipped | The scripts are now **discovered** by globbing the design package's tool directory for `fetch-` prefixed scripts — `tools/fetch-3d-packs.sh` and `tools/fetch-remaining-3d.sh` today — and the derivation also compares the number of `fetch` call sites with the number of names it could read. A script that exists but lists no archives is a hard FAIL, covered by injection #17 |

**Four new injections, because a gate that has never failed proves nothing.** The
fifteenth round adds injections **#14**, **#15**, **#16** and **#17**:

- **#14** redirects the cache to an empty directory, proves the gate then
  reports the cache as incomplete, and proves the opposite of the old
  behaviour — that **no path is called fabricated** while the archives are
  absent. It then lifts the override and proves the tree is green again.
- **#15** proves the cache check is **independent** of the path check, in the
  two halves that matter: the real path check must report *"all 849 cited
  paths resolve"* with the cache reported complete, and the **real `main()`**
  must then refuse to certify with one archive missing — failing **on the
  cache**, not on a path.
- **#16** proves the check **fails closed on a partial derivation** (Y-07
  above): one fetch script removed, the other still yielding archives.
- **#17** proves it fails closed when a fetch script exists but **lists no
  archives** — the archives it was meant to contribute are invisible, and an
  invisible archive is as bad as a missing one.

The script now runs **18** injections and reports
**18/18** caught.

**The mirror is a fallback, never a dependency.** The shared asset mirror
(`~/.minimax/asset-library/packs`) was measured, not assumed: with the workspace
cache present and the mirror absent, **all 849** cited paths still resolve. The
mirror therefore contributes **nothing** to path resolution, and the design does
not depend on it.

**What the boards cite, and what is on disk.** The boards cite **51** archive
names. **25** of them are cited together with a member path the gate actually
resolves; of those, **16** are in the workspace cache and **9** are in the
shared mirror, and **none** is unavailable. The remaining cited names appear
only in manifest, size and excluded-pack context, where no member path is
resolved against them. The cache check therefore gates on the fetch-script set
— the set the cache is *built* from — and the path check separately proves
every cited path against the archives that are actually open.

### 11.3 What is still open — and it is not the design

**Three id namespaces, never mixed.** This package tracks open work under three
distinct prefixes, and a reader must never have to guess which one an id belongs to:

| Prefix | What it is | Where it lives | Status |
|---|---|---|---|
| `OPEN-001`…`OPEN-006` | **Design decisions** the requester or a board had to take | The boards' decision registers | All **CLOSED** except `OPEN-002` (web release host) and `OPEN-005` (rights review) |
| `W-OPEN-01`…`W-OPEN-05`, `CB-01`…`CB-07`, `XN-ENT-01`…`XN-ENT-14` | **Cross-board notes** between two boards | The boards' cross-board registers | All **CLOSED** |
| `DEL-01`…`DEL-06` | **Delivery items** — work that belongs to development, not to the design | This section | Listed below |

`DEL-nn` was renamed from `OPEN-nn` in the eleventh review round, because `OPEN-02`
(the bone map) and `OPEN-002` (the web release host) differed by one digit and meant
different things. The two-digit form is retired.

| # | Item | Effect | Owner |
|---|---|---|---|
| **DEL-01** | **27 music cues have no source in the repository.** | **Ship decision taken:** the music bus ships **SILENT**, no cue is fabricated, and the build is releasable in that state. A composer-supplied file enters through the same manifest slot and the same CI gate. `REQ-D-015` is **PARTIAL** and says so. (The 8 ambience cues are **not** in this item — they are derived in the mixer per `G-06`.) | Optional, not blocking |
| **DEL-02** | The `kaykit_41` bone map and its golden retarget test are specified but not yet written. | A **Gate 2** blocker | Architecture board, in development |
| **DEL-06** | **The hardware baseline is now pinned**, not proposed: a 2020-class 6-core desktop CPU, 16 GB RAM, GTX 1650 / RX 5500XT class or better, SSD, 1920×1080 at 60 FPS, 10 GB free-disk budget. `NFR-01` is satisfied; the frame-time figure remains a target, not a measurement. | Closed | Requester may replace the pinned string |
| **DEL-03** | The 73 MB ship target is now ≈104 MB. | Budget, not design. The alternatives break the roster | Decision accepted, recorded |
| **DEL-04** | The 2D corpus is licence-unverified. | Excluded from release builds by configuration; the game ships complete without it | Cleared as a position |
| **DEL-05** | `GAP-001` and `GAP-002` from the source document remain open. | Stated as open, as required | — |

**None of these blocks the start of development.** `DEL-02` blocks **GATE 2**, not
GATE 0 or GATE 1.

### 11.4 What the review rounds changed

The Cursor senior review was run **15 times** — over the integrated design, over the
corrected design, over the design after the gap decisions were taken, over the design
after the cross-board contradictions were removed, and then round after round over the
successive residue each fix exposed. Its findings, and the two false alarms it
produced, are recorded in §11.2 through §11.2o. The review is not a rubber stamp: round
one returned **17 findings**, of which **10 were real defects that were then fixed in
the boards** and **2 were false alarms** that were caught by checking the packs directly
rather than accepting the review's word; round two found the asset gaps that were
still undecided; rounds three to eight returned **9, 5, 5, 7, 4 and 4
further defects** — almost all of one kind: a decision taken in one board and still
contradicted, re-opened, or published with a different measured value in another. **Two
of the defects in rounds five and six were in text this integration had itself just
written**, and round seven found a further category of eighteen stale labels, which is the argument for running the review again after the fixes rather
than declaring the class closed. Round nine closed the design boards. Round ten turned
the review on the **development bots
and the path namespace** and found nine more, including a class none of the earlier
rounds had looked for. All are fixed in the owning board. **The design that
follows the fifteenth pass is the one this document describes.**

**The count above is derived, not typed.** It is computed from the review-round
records §11.2 publishes, and the section letters are computed from the records too.
The thirteenth review found why this matters: eight of the section titles were each
**one ahead** of the round their own prose describes, and one round had no record of
its own, so a hand-written count had already drifted once and a reader counting the
sections would have got a different answer than the reader trusting the titles.

---

## 12. The five development bots

Five implementation agents were created, mirroring the five design boards, each with a
**binding contract**: the documents it must obey, the files it owns, the files it may not
touch, the non-negotiable engineering rules, and its definition of done.

| Bot | Owns | Definition-of-done highlight |
|---|---|---|
| **`pd-dev-platform`** | The engine scaffold, module contract, schemas, save system, CI, determinism harness | The project opens on the pinned engine; 1,000 ticks reproduce the checksum; every schema has a validator and a failing fixture |
| **`pd-dev-player`** | The player controller, input abstraction, camera rig, player state machines, damage reaction, inventory, accessibility | Physics golden tests pass; a replay reproduces its checksum; the four profiles measure differently |
| **`pd-dev-entities`** | The enemy roster, boss framework, damage pipeline, projectiles, spawn and pooling | The damage matrix is proven for every (source × target state) pair; a 100-retry soak shows no leak |
| **`pd-dev-world`** | The stage/world content pipeline, interactive objects, items, presentation, audio mixer, UI, localisation | The Gate 1 tutorial stage loads and completes from its JSON alone; a `licensed-only` build still loads every stage |
| **`pd-dev-assets`** | The asset pipeline, the manifest, the licence gate, the release packaging | Each gate fails on a broken fixture **and** passes on the real corpus; the release audit exits zero only on a clean profile |

They live at `~/.minimax/agents/pd-dev-{platform,player,entities,world,assets}/agent.md`.
Each one is bound by `3D-TRANSLATION.md` and by the board it implements.

Three things make a development bot *functional* rather than merely descriptive, and
each is verified by `tools/verify_devbots.py` (**0 FAIL, 13 PASS**):

1. **An authoritative requirement scope.** Each bot carries the master's traceability
   matrix rows for the requirements it owns — the artefact, the section and the
   **acceptance test** are the design's own words, so an implementer can check off
   their requirements against the design instead of re-deriving them. Together the five
   bots cover **all 102 requirements and all 10 NFRs**, and the **12 cross-board
   requirements** appear in both the owning board's bot and the consuming board's bot.
2. **Disjoint file ownership, taken from the design's own folder tree.** The bots'
   paths are the architecture board's §4.1 tree (`src/core/`, `src/systems/`,
   `src/content/`, `src/scenes/`, `src/assets/`, `src/tools/`, `tests/`, `ci/`) — not an
   invented layout. No two bots own the same file, and no owned path sits outside the
   tree.
3. **The measured constants, published once.** The capsule, the camera dead zone, the
   coyote and buffer ticks, the jump apex, the damage enum, the hazard cardinality and
   the audio corpus are named in each bot with their values, so a bot cannot
   reintroduce a second version of a number the design already fixed.

---

## 13. The readiness confirmation

**Confirmed: the design is thorough enough to code from, and development can start.**

What that rests on, all of it verified rather than asserted:

- **102/102 requirements** and **10/10 NFRs** are specified with behaviour, data,
  algorithm, a falsifiable acceptance test, and the assets they bind.
- **0 FAIL** across **31 automated design checks**: requirement
  coverage, asset-path resolution, cross-board constant agreement, IP leakage,
  procedural-art language, and **decision coherence** — which checks that no board
  re-opens a question another board already answered, that one camera dead-zone
  rectangle is published everywhere, that no shipped manifest row names a
  console-branded prompt family, that the manifest row counts add up, that every
  non-shippable row is covered by an adopted decision, and that no document carries a
  duplicate section number, that the audio vocabulary agrees with the `G-06` decision,
  that the CI status enum carries all five manifest statuses, and that the
  **measured constants** — the audio corpus, the damage-source enum, the player capsule
  and the hazard cardinality — are published with one value across every document, that
  an example never teaches a value the enum does not contain, and that **no prose line
  re-opens a decision that is already taken**. It also checks the two things the
  eleventh and twelfth rounds found false: that **§7.7.2's edge list and §7.3's
  transition table are the same nineteen edges in the same order**, and that **each
  review-round record names the round it holds**.
- **The development bots' own prose is checked, not just the boards.** A check reads
  every bot for the **shipping** input-prompt pack and fails if a bot points the
  shipped glyphs at the branded, trademark-carrying pack — the defect the thirteenth
  round found, in the one place no gate was reading.
- **Every gate was fault-injected.** Deliberate defects were injected into the boards
  one at a time — a widened camera dead zone, an undeclared open decision, a branded
  prompt family in a shipped row, a broken manifest count, a gap with no adopted
  decision, a duplicate section number, the stale ambience counter, a three-way cue
  resolution, a three-status CI enum, a stale damage-source count, a stale capsule and
  a stale audio figure. **Every one was caught**, and the tree was verified clean after
  restore. A gate that has never failed proves nothing, so each one was made to fail.
  The last five checks were hardened **against named slip-through inputs** — an
  acceptance test with a contradicting appendix, an invented tool file, two boards
  swapping a content kind, a tree root used without its prefix, and a surviving
  builder placeholder — and `tools/fault_inject_hardened.py` injects all five and
  restores the tree. **5/5 caught.** The thirteenth round added four more checks
  and four more injections, so the script now runs **18** of them
  and reports **18/18** caught.
- **849 cited asset paths resolve to real files.** No fabricated path survives.
- **12 cross-board conflicts found and resolved in the boards**, not merely catalogued,
  plus **9 more** found by the third review round (§11.2c), and **9 + 6** more by the
  tenth and eleventh rounds (§11.2j, §11.2k) — the last of which found a whole
  *namespace* of project paths written in the wrong prefix and **seventeen** content
  kinds where only **seven** had an owner.
- **471 manifest rows** — 467 shippable, 1 pending, 1 derived, 1 out of scope, and **1**
  genuine gap (the music cues). Every one names the requirement it serves.
- **13,001 lines of design**: the five boards, the translation contract, the asset survey
  and this master document.
- **The five development bots are executable.** Each carries the requirements it owns
  with the design's own acceptance test **verbatim** (checked for equality, not
  containment), a file-ownership list that is disjoint from every other bot and that
  sits inside the §4.1 tree, and the measured constants it must publish identically.
  **13 checks** confirm it, including that every one of the
  **eighteen** content kinds is owned by exactly the board master §8.3 names.

**What is not confirmed, stated plainly:**

- **There is no music in the repository.** 27 cues have no source. The bus ships
  silent by default. This is the single largest open item and it is a *content*
  problem, not a design problem. (`DEL-01`)
- **No code exists yet, and no test has been run against code.** The verification above
  is of the **design**, not of a build. The first real gate is GATE 1.
- The **Cursor senior review** ran **15 times** as `--model auto`; the named models
  (`claude-opus-5-thinking-high`, `gpt-5.3-codex-high-fast`, `gpt-5.6-sol-high-fast`) are
  quota-exhausted on this account, and an `auto` review hung once under load before
  succeeding on retry. Ask mode blocks the shell, so the gates are always run by the
  parent, never by the reviewer.
- **`DEL-02`** (the `kaykit_41` bone map and golden retarget test) blocks GATE 2, not
  GATE 1.
- **Two design decisions remain open** and need the requester, not the team:
  **`OPEN-002`** (the web release host — its COOP/COEP limits) and **`OPEN-005`**
  (the rights review before any public distribution). Neither blocks desktop Gate 0–5.
- The **2D corpus is licence-unverified** (114,852 records). It is excluded from
  release builds by configuration and the game ships complete without it. (`DEL-04`)

---

*End of the master document. The five board documents, the translation contract and the
asset survey are the detailed source; this document never contradicts them.*
