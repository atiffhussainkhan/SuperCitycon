# DESIGN-3 — ASSET MANIFEST AND COVERAGE

**Game:** original 3D side-scrolling platformer · **Owner:** asset curator
**Compiled:** 30 October 2026 · **Status:** binding asset map for the build
**Ground truth:** `ASSET-SURVEY.md`, `MASTER-REQUIREMENTS.txt` (102 REQs), `library-inventory/`

---

## 0. Scope, corpus and the one rule

### 0.1 The corpus, measured

The user described "12 GB of images". **The measured corpus is 16.16 GB** — 98 release
assets across 10 releases of `atiffhussainkhan/Image`. The local processed mirror is
1.0 GB and the git clone is 425 MB, which is why a narrow local search surfaces only a
few hundred MB. No figure in this document is rounded to match "12 GB".

| Layer | Measured content |
|---|---|
| A — release corpus | **16.16 GB**, 98 assets, 10 releases |
| B — processed mirror | 12 local 3D/character packs, 116,880 indexed rows (114,852 2D + 1,994 3D + 34 packs) |
| Fetched for this project | **23 packs, 2.7 GB** in `minimax-game/platformer-docs/library-packs/` |

The single most valuable pack is `shorepine-kenney.zip` (152.1 MB): the complete Kenney
CC0 library — **4,812 GLB across 49 kits**, 35,998 2D sprites, 4,686 UI elements,
7,508 icons.

### 0.2 Path citation convention

Every row's `exact path` is an **archive member**, so an engineer can resolve it with
`unzip -p <pack> "<path>" > out`. Two Kenney path forms exist and are equivalent:

```
10-kenney-collection.zip!<kit>/<name>.glb              ← cited in this document
shorepine-kenney.zip!shorepine-kenney/3d/<kit>/<name>.glb  ← identical model, stable-path mirror
```

2D sprites, UI and icons exist **only** in `shorepine-kenney.zip` and are cited with that
prefix (`shorepine-kenney/2d/…`, `shorepine-kenney/ui/…`, `shorepine-kenney/icons/…`).
`kenney-cc0-game-art-packs.zip` is a second CC0 source (FBX/OBJ alongside GLB) and is
cited where a non-GLB interchange is wanted.

### 0.3 The asset rule (binding)

> Every mesh, texture, animation, skybox, background, UI element, icon and sound in the
> shipped game is a **named file that exists in the image repository**, recorded in the
> asset manifest with its exact path, pack and licence. The pipeline may **measure and
> register** an asset (world-space bounds, footprint, scale, ground offset, orientation,
> compression) — it may **never author** one. No procedural geometry, no runtime-generated
> texture, no shader-only character, no primitive-composition actor. Compositing library
> assets into a level is allowed; fabricating an asset is not. If an element has no file,
> it is an **ASSET GAP** row with the requirement it blocks — it is never filled with a
> placeholder.

The CI enforcement of this rule is specified in **§14**.

### 0.4 Status vocabulary

| status | meaning |
|---|---|
| `SHIPPABLE` | 3D/2D asset with a verified CC0-1.0 or MIT licence, cleared to ship in the release bundle |
| `PENDING` | asset exists and is usable in the build, but its licence is unverified; must be excludable by configuration at release |
| `DERIVED` | no file exists, but the element is **produced at runtime from already-shipped named assets** by a named, decided rule in **§13** (currently `G-06`: the ambience bed is mixed from the shipped SFX) |
| `OUT_OF_SCOPE` | the need was real, and a named decision in **§13** removed the element from the shipping scope (currently `G-08`: no voice layer, announcements are text cards) |
| `GAP` | no file exists in the repository for this element **and no decision resolves it**; carries a decision in **§13** (currently only `AU-019`, the music cues) |

`DERIVED` and `OUT_OF_SCOPE` exist so that a **decided** gap is never published as an
unresolved one, and an unresolved one is never buried. The CI gate `asset-manifest-status`
enforces that every row's status matches the decision recorded for it in §13.

### 0.5 Measured facts this document depends on

- **150 of the 4,812 Kenney GLB are animated; 26 are skinned.** Per-kit animated counts:
  prototype 25, cube-pets 24, blocky-characters 18, platformer 13, mini-characters 12,
  factory 11, building 8, graveyard 7, mini-arcade 6, mini-dungeon 5, hexagon 3, blaster 3,
  mini-market 3, modular-space 2, mini-skate 2, holiday 2, modular-dungeon 2, survival 1,
  mini-forest 1, pirate 1, mini-arena 1.
- **Kenney character clip vocabulary (measured, exact names).**
  `platformer/character-oobi…oozi.glb` — skinned, **25 clips**:
  `static, idle, walk, sprint, jump, fall, crouch, sit, drive, die, pick-up, emote-yes,
  emote-no, holding-right, holding-left, holding-both, holding-right-shoot,
  holding-left-shoot, holding-both-shoot, attack-melee-right, attack-melee-left,
  attack-kick-right, attack-kick-left, interact-right, interact-left`.
  `mini-characters/character-{male,female}-a…f.glb` — skinned, **32 clips** (the 25 plus
  `wheelchair-sit, wheelchair-look-left, wheelchair-look-right, wheelchair-move-forward,
  wheelchair-move-back, wheelchair-move-left, wheelchair-move-right`).
  `blocky-characters/character-a…r.glb` — 27 clips, node-transform animated.
  `cube-pets/animal-*.glb` — **8 clips**:
  `static, idle, walk, run, eat, dance, gesture-positive, gesture-negative`.
- **No clip set anywhere in the corpus covers swimming, gliding, flight, charging or
  climbing**, except the single `Climbing` clip in `KayKit_AnimatedCharacter_v1.2.glb`
  (30 clips). This is **GAP-A10** and drives gap entries G-02, G-03, G-04.
- **Audio is **78 audio file paths**, resolving to **66 unique sounds** — 52 `.ogg` (40 Kenney Desert Shooter + 12 `Fantozzi` footsteps), 12 `.flac` (the same 12 footsteps, each present at **two** paths) and 2 `.wav` (gunshot files no cue needs). **52 `.ogg` ship**.** The 12 `.flac` are alternates of footsteps already shipped
  in OGG; the raw archive total is 134 files / 329.7 MB, the firearm WAV set being
  excluded from the shipped inventory. **Zero music anywhere in the corpus.**
- **KayKit Skeletons contains 4 character rigs** (measured: `Skeleton_Minion`,
  `Skeleton_Rogue`, `Skeleton_Mage`, `Skeleton_Warrior`, 95 clips each) plus 16 weapon
  props. *Correction to ASSET-SURVEY §2.2, which records a fifth rig named `Skeleton`;
  the catalogue's `Skeleton` record resolves to `Skeleton_Minion.glb` and no
  `Skeleton.glb` exists in the pack.*
- **KayKit Adventurers contains 5 rigs** (`Barbarian`, `Knight`, `Mage`, `Rogue`,
  `Rogue_Hooded`), **76 clips each**.
- **Quaternius Ultimate Animated Character** — 50 rig files in `assets/glTF/`,
  17 clips each (`Death, Defeat, Idle, Jump, PickUp, Punch, RecieveHit, Roll, Run,
  Run_Carry, Shoot_OneHanded, SitDown, StandUp, SwordSlash, Victory, Walk, Walk_Carry`).
- **Quaternius animated mech** — `George`, `Leela`, `Mike`, `Stan` in
  `assets/Textured/glTF/`; `Leela` carries 18 clips.

---

## 1. AVATARS AND THE CASTER FORM

Four original avatar profiles for `REQ-A-015`, mapped onto real CC0 rigs. The **names
are original; the meshes are not** — every row below is a CC0 file from a named pack.

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| AV-001 | **Tallow** — heavy/slow/high-carry avatar | A-015, A-005, A-013 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/Barbarian.glb` | glb | CC0-1.0 | SHIPPABLE |
| AV-002 | **Brindle** — armoured/tank avatar | A-015, A-005, A-019 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb` | glb | CC0-1.0 | SHIPPABLE |
| AV-003 | **Sable** — agile/fast avatar | A-015, A-005, A-003 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/Rogue.glb` | glb | CC0-1.0 | SHIPPABLE |
| AV-004 | **Moth** — hover/low-gravity avatar | A-015, A-017, A-005 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/Rogue_Hooded.glb` | glb | CC0-1.0 | SHIPPABLE |
| AV-005 | **Vellum** — projectile/caster power-up form | D-005, A-020, A-016 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/Mage.glb` | glb | CC0-1.0 | SHIPPABLE |
| AV-006 | Player locomotion clip set — 76 clips (Idle, Walking_A/B/C, Walking_Backwards, Running_A/B, Running_Strafe_Left/Right, Jump_Start, Jump_Idle, Jump_Land, Jump_Full_Short, Jump_Full_Long, Fall, Hit_A/B, Death_A/B, Block, Block_Attack, Dodge_*, Interact, PickUp, Throw, Use_Item, Cheer, Spellcasting, Spellcast_Long, Spellcast_Raise, Spellcast_Shoot, 1H_Ranged_*) | A-002..A-005, A-007, A-013, A-016, A-019 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/Barbarian.glb` (clip bank shared by AV-001…AV-005) | glb | CC0-1.0 | SHIPPABLE |
| AV-007 | Avatar accessory — round shield (armour profile read) | A-015, D-003 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Assets/gltf/shield_round.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| AV-008 | Avatar accessory — one-handed sword (melee read) | A-016, C-003 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Assets/gltf/sword_1handed.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| AV-009 | Avatar accessory — staff (caster read) | D-005, A-020 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Assets/gltf/staff.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| AV-010 | Avatar accessory — quiver + arrows (agile read) | A-015, A-020 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Assets/gltf/quiver.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| AV-011 | Avatar fallback rig — skinned, 25 clips | A-005, A-007 | 10-kenney-collection.zip | `platformer/character-oobi.glb` | glb | CC0-1.0 | SHIPPABLE |
| AV-012 | Avatar fallback rig set — 5 skinned, 25 clips | A-005, A-015 | 10-kenney-collection.zip | `platformer/character-oodi.glb`, `platformer/character-ooli.glb`, `platformer/character-oopi.glb`, `platformer/character-oozi.glb` | glb | CC0-1.0 | SHIPPABLE |
| AV-013 | Avatar fallback rig set — 12 skinned, 32 clips (incl. wheelchair mobility) | A-005, A-018, D-020 | 10-kenney-collection.zip | `mini-characters/character-male-a.glb` … `mini-characters/character-female-f.glb` | glb | CC0-1.0 | SHIPPABLE |
| AV-014 | Player climb cycle — the **only** climbing clip in the corpus | A-014, A-008 | kaykit-character-animations-1.2.zip | `Animations/gltf/KayKit_AnimatedCharacter_v1.2.glb` | glb | CC0-1.0 | SHIPPABLE |
| AV-015 | Player roll / dash / hop cycle set — `Roll, DashFront, DashBack, DashLeft, DashRight, Hop, Jump, Run, Walk, Idle, Attack(1h), AttackCombo, AttackSpinning, Block, Cheer, Climbing, Defeat, HeavyAttack, Interact, PickUp, Shoot(1h), Shoot(2h), Shoot(2h)Bow, Shooting(1h), Shooting(2h), Throw, Wave, LayingDownIdle, BasePose` | A-016, A-003, A-013 | kaykit-character-animations-1.2.zip | `Animations/gltf/KayKit_AnimatedCharacter_v1.2.glb` | glb | CC0-1.0 | SHIPPABLE |
| AV-016 | Player armour/tunic colour variant — 12 rig files for silhouette reads | A-015 | quaternius-ultimate-animated-character.zip | `assets/glTF/Knight_Male.gltf`, `assets/glTF/Ninja_Male.gltf`, `assets/glTF/Pirate_Male.gltf`, `assets/glTF/Soldier_Male.gltf`, `assets/glTF/BlueSoldier_Male.gltf`, `assets/glTF/Wizard.gltf`, `assets/glTF/Witch.gltf`, `assets/glTF/Viking_Male.gltf`, `assets/glTF/Elf.gltf`, `assets/glTF/Goblin_Male.gltf`, `assets/glTF/Worker_Male.gltf`, `assets/glTF/Chef_Male.gltf` | gltf | CC0-1.0 | SHIPPABLE |

---

## 2. ENEMY ARCHETYPES

The taxonomy in `MASTER-REQUIREMENTS.txt` §5 yields **70 implementation archetypes**.
Ten are boss behaviours (mapped in **§3**); the remaining **60 are enemy archetypes**
served by **59 distinct actor rows** — `walker` appears twice in the taxonomy and shares
one rig. **Every EN row additionally serves `REQ-C-001` (actor base), `REQ-C-002` (FSM),
`REQ-C-003` (typed damage), `REQ-C-004` (spawn/pool) and `REQ-C-020` (analytics)**; the
`REQ ids served` column lists the archetype-distinguishing requirement only.

Reference-game names in the taxonomy are research tags only. The shipped game uses the
original archetype names below.

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| EN-001 | Ground walker — edge turn, obstacle turn, speed variants | C-005 | 10-kenney-collection.zip | `blocky-characters/character-a.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-002 | Shell creature — retract on stomp, kickable, chain-hits, re-emerges | C-006 | 10-kenney-collection.zip | `mini-characters/character-female-b.glb` (skinned, 32 clips) — the retract is a **uniform scale of 0.6** on this rig; **no detached carapace mesh exists and none is required** (`G-01` option (a′)) | glb | CC0-1.0 | **SHIPPABLE** |
| EN-003 | Winged hopper — cyclical arcs, loss-of-wings state | C-007 | 10-kenney-collection.zip | `cube-pets/animal-parrot.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-004 | Armoured walker — stomp-immune (armour is a damage tag, not a shell) | C-005, C-003 | 10-kenney-collection.zip | `cube-pets/animal-cow.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-005 | Pipe plant — proximity-gated emergence | C-008 | 10-kenney-collection.zip | `mini-dungeon/trap.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-006 | Volley thrower — arced projectiles with telegraph and cooldown | C-010 | 10-kenney-collection.zip | `mini-arcade/character-employee.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-007 | Airborne spawner — drops subordinate hazards under a cap | C-009 | 10-kenney-collection.zip | `cube-pets/animal-penguin.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-008 | Spiked floor threat — static spike bed | C-013 | 10-kenney-collection.zip | `platformer/trap-spikes.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-009 | Horizontal projectile launcher — travelling bolt | C-010 | 10-kenney-collection.zip | `pirate/cannon-mobile.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-010 | Aquatic fish — water-specific collision | C-011 | 10-kenney-collection.zip | `cube-pets/animal-fish.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-011 | Homing drifter — armoured swimmer that pursues | C-011 | 10-kenney-collection.zip | `cube-pets/animal-crab.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-012 | Vertical jumper — leaps out of a molten pit | C-013 | 10-kenney-collection.zip | `cube-pets/animal-chick.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-013 | Negative pickup — poison item with a fairness warning cue | D-007 | 10-kenney-collection.zip | `nature/mushroom_redTall.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-014 | Aggressive proximity variant — always-cycle plant | C-008 | 10-kenney-collection.zip | `platformer/plant.glb` + `mini-dungeon/trap.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-015 | Directional force volume (wind) — no actor mesh; visible through reactive foliage | A-010, D-012 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Grass.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-016 | Ceiling emitter — drops hazards downward on a timer | C-013 | 10-kenney-collection.zip | `mini-dungeon/trap.glb` (inverted trigger polarity) | glb | CC0-1.0 | SHIPPABLE |
| EN-017 | Bullet shooter — ranged fire with a dodge window | C-010 | kaykit-skeletons.zip | `kaykit-skeletons/addons/kaykit_character_pack_skeletons/Characters/gltf/Skeleton_Mage.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-018 | Hopper — bounded vertical hops | C-005 | 10-kenney-collection.zip | `cube-pets/animal-bunny.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-019 | Leaper — pouncing attacker | C-005 | 10-kenney-collection.zip | `cube-pets/animal-cat.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-020 | Climbing pursuer — ascends ladders/vines, reverses at endpoints | A-014, C-002 | kaykit-character-animations-1.2.zip | `Animations/gltf/KayKit_AnimatedCharacter_v1.2.glb` (clip `Climbing`) | glb | CC0-1.0 | SHIPPABLE |
| EN-021 | Key guardian — defends a locked door, dies in one hit | D-011, C-005 | 10-kenney-collection.zip | `mini-dungeon/character-orc.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-022 | Fire shooter — flame projectile on cooldown | C-010 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/Mage.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-023 | Explosive — proximity-detonating hazard | C-013 | 10-kenney-collection.zip | `platformer/bomb.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-024 | Aerial carrier — carries a payload over the arena | C-009 | 10-kenney-collection.zip | `cube-pets/animal-beaver.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-025 | Runner — fast patroller with momentum | C-005 | 10-kenney-collection.zip | `cube-pets/animal-deer.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-026 | Machine rider — a small mech ridden by an enemy | C-005 | quaternius-animated-mech.zip | `assets/Textured/glTF/Mike.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| EN-027 | Spiked hazard — immovable spike block | C-013 | 10-kenney-collection.zip | `platformer/spike-block.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-028 | Slippery walker — low-friction walker | A-011 | 10-kenney-collection.zip | `cube-pets/animal-polar.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-029 | Emerging thrower — erupts from the floor and lobs a tool | C-010 | 10-kenney-collection.zip | `graveyard/character-zombie.glb` + `mini-dungeon/trap.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-030 | Tethered charger — a predator bound by a rope/chain | C-013 | 10-kenney-collection.zip | `cube-pets/animal-lion.glb` + `platformer/fence-rope.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-031 | Facing ghost — movement toggles on facing transition | C-012 | 10-kenney-collection.zip | `graveyard/character-ghost.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-032 | Reassembling skeleton — separates and reconverges on death | C-003, C-002 | kaykit-skeletons.zip | `kaykit-skeletons/addons/kaykit_character_pack_skeletons/Characters/gltf/Skeleton_Rogue.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-033 | Vertical crusher — descends on a track, lethal contact | C-013 | 10-kenney-collection.zip | `platformer/block-grass-large-tall.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-034 | Orbit hazard — a rotating body on a fixed orbit | C-013 | 10-kenney-collection.zip | `prototype/indicator-round-a.glb` (clip `animation`) | glb | CC0-1.0 | SHIPPABLE |
| EN-035 | Surface ghost — skims the ground plane | C-012 | 10-kenney-collection.zip | `graveyard/character-vampire.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-036 | Pursuing flame — mobile fire that tracks the player | C-013 | 10-kenney-collection.zip | `cube-pets/animal-bee.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-037 | Ground shock — a heavy body whose stomp emits a shockwave | C-013 | 10-kenney-collection.zip | `cube-pets/animal-elephant.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-038 | Returning projectile — a boomerang that returns to the thrower | C-010, C-018 | 10-kenney-collection.zip | `platformer/arrows.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-039 | Flame volley — a squad that throws burning bolts | C-010 | kaykit-skeletons.zip | `kaykit-skeletons/addons/kaykit_character_pack_skeletons/Characters/gltf/Skeleton_Warrior.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-040 | Spiked ball — an armoured rolling hazard | C-013 | 10-kenney-collection.zip | `cube-pets/animal-hog.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-041 | Segmented pursuer — a multi-section crawler | C-013 | 10-kenney-collection.zip | `cube-pets/animal-caterpillar.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-042 | Stationary electric hazard — a fixed emitter | C-013 | 10-kenney-collection.zip | `tower-defense/tower-round-crystals.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-043 | Radial projectile thrower — 360° burst on a timer | C-010 | 10-kenney-collection.zip | `prototype/figurine.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-044 | Movement impediment — a soft blocker the player must clear | C-002 | 10-kenney-collection.zip | `platformer/hedge.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-045 | Rideable flyer — a mount that carries the player | A-018, B-014 | 10-kenney-collection.zip | `cube-pets/animal-parrot.glb` (shared mesh with EN-003, distinct archetype parameters) | glb | CC0-1.0 | SHIPPABLE |
| EN-046 | Mount — rideable companion with mount/dismount | A-018 | 10-kenney-collection.zip | `prototype/animal-horse.glb` (clips `walk, run, down, up`) | glb | CC0-1.0 | SHIPPABLE |
| EN-047 | Ambusher — waits, then strikes | C-002 | 10-kenney-collection.zip | `cube-pets/animal-tiger.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-048 | Multi-stomp — a heavy body requiring repeated stomps | C-005 | 10-kenney-collection.zip | `cube-pets/animal-beaver.glb` (shared mesh with EN-024) | glb | CC0-1.0 | SHIPPABLE |
| EN-049 | Reactive crawler — turns sharply on contact | C-005 | 10-kenney-collection.zip | `cube-pets/animal-monkey.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-050 | Charging athlete — a fast charger with a wind-up | C-005 | 10-kenney-collection.zip | `cube-pets/animal-dog.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-051 | Tile-altering mage — converts outlined blocks | C-002, D-008 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/Mage.glb` (clips `Spellcasting`, `Spellcast_Long`) | glb | CC0-1.0 | SHIPPABLE |
| EN-052 | Giant projectile — a slow, arena-scale body | C-010 | 10-kenney-collection.zip | `space/machine_generatorLarge.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-053 | Ghost flyer — an airborne phantom | C-012 | 10-kenney-collection.zip | `graveyard/character-ghost.glb` (shared mesh with EN-031) | glb | CC0-1.0 | SHIPPABLE |
| EN-054 | Sleeping pursuer — dormant until disturbed | C-002 | 10-kenney-collection.zip | `cube-pets/animal-pig.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-055 | Fire breather — carries a brazier; the plume is an FX emitter | C-010 | 10-kenney-collection.zip | `graveyard/character-keeper.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-056 | Small flame — a self-propelled fire; behaviour is emissive material + FX, not skeletal animation | C-013 | 10-kenney-collection.zip | `nature/campfire_bricks.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-057 | Lightning/shock — a crackling emitter | C-013 | 10-kenney-collection.zip | `tower-defense/tower-round-crystals.glb` (shared mesh with EN-042) | glb | CC0-1.0 | SHIPPABLE |
| EN-058 | Lure ghost — a phantom drawn to a lure object | C-012 | 10-kenney-collection.zip | `graveyard/character-ghost.glb` + `platformer/flag.glb` | glb | CC0-1.0 | SHIPPABLE |
| EN-059 | Throwable mechanical enemy — a machine that can be picked up and thrown | C-014 | quaternius-animated-mech.zip | `assets/Textured/glTF/Stan.gltf` | gltf | CC0-1.0 | SHIPPABLE |

---

## 3. BOSSES

Ten **boss-pattern archetypes** (BS-001…BS-010) from the taxonomy, plus the **eight
regional bosses and the finale** (BS-011…BS-019) for the 8-region campaign.
All boss rows serve `REQ-C-015` (boss framework: arena enter, intro, attack loop, phase,
vulnerability window, damage, stagger, defeat, reward) and `REQ-C-016` (pattern set);
BS-001…BS-010 additionally serve `REQ-C-018` (projectile reflection/return);
BS-011…BS-019 additionally serve `REQ-B-019` (end-of-world sequence) and `REQ-C-019`
(restart/checkpoint/post-clear persistence). `REQ-C-017` (switch-triggered elimination
instead of damage) is served by BS-009/BS-012 — the airship and the catapult-tower can be
defeated by destroying their mounts or driving them into the goal mechanism.

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| BS-001 | Boss pattern — arena/bridge guardian | C-016, C-018 | quaternius-ultimate-animated-character.zip | `assets/glTF/Ninja_Male.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| BS-002 | Boss pattern — returnable-projectile spitter | C-016, C-018 | quaternius-ultimate-animated-character.zip | `assets/glTF/Wizard.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| BS-003 | Boss pattern — bomb thrower | C-016, C-018 | quaternius-ultimate-animated-character.zip | `assets/glTF/Worker_Male.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| BS-004 | Boss pattern — multi-headed flame | C-016, C-018 | quaternius-ultimate-animated-character.zip | `assets/glTF/Witch.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| BS-005 | Boss pattern — splitting flame | C-016, C-018 | quaternius-ultimate-animated-character.zip | `assets/glTF/Viking_Male.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| BS-006 | Boss pattern — rock volley | C-016, C-018 | quaternius-ultimate-animated-character.zip | `assets/glTF/Soldier_Male.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| BS-007 | Boss pattern — item-fed final boss | C-016, C-018 | holokat-game-assets.zip | `holokat-game-assets/site/studio/public/models/warrior-base-rigged.glb` | glb | MIT | SHIPPABLE |
| BS-008 | Boss pattern — fortress guard | C-016, C-018 | kaykit-skeletons.zip | `kaykit-skeletons/addons/kaykit_character_pack_skeletons/Characters/gltf/Skeleton_Warrior.glb` | glb | CC0-1.0 | SHIPPABLE |
| BS-009 | Boss pattern — mobile airship | C-016, C-017 | 10-kenney-collection.zip | `space/rocket_baseA.glb` + `space/rocket_sidesA.glb` + `space/rocket_finsA.glb` + `space/rocket_topA.glb` + `space/turret_double.glb` + `space/satelliteDish.glb` | glb | CC0-1.0 | SHIPPABLE |
| BS-010 | Boss pattern — wheel-platform boss | C-016, C-018 | 10-kenney-collection.zip | `castle/siege-ballista.glb` + `castle/siege-ballista-demolished.glb` | glb | CC0-1.0 | SHIPPABLE |
| BS-011 | **Region 1 — Meadow** regional boss | B-019, C-015 | quaternius-ultimate-animated-character.zip | `assets/glTF/Goblin_Male.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| BS-012 | **Region 2 — Sand/Temple** regional boss | B-019, C-015, C-017 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/yellow/building_tower_catapult_yellow.gltf` + `…/Assets/gltf/buildings/neutral/projectile_catapult.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| BS-013 | **Region 3 — Water/Coast** regional boss | B-019, C-015 | quaternius-animated-mech.zip | `assets/Textured/glTF/George.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| BS-014 | **Region 4 — Giant/Forest** regional boss | B-019, C-015 | 10-kenney-collection.zip | `cube-pets/animal-elephant.glb` (registered at ×3 scale; scale is a measurement, not authoring) | glb | CC0-1.0 | SHIPPABLE |
| BS-015 | **Region 5 — Sky** regional boss | B-019, C-015 | quaternius-ultimate-animated-character.zip | `assets/glTF/BlueSoldier_Male.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| BS-016 | **Region 6 — Snow/Ghost** regional boss | B-019, C-015 | kaykit-skeletons.zip | `kaykit-skeletons/addons/kaykit_character_pack_skeletons/Characters/gltf/Skeleton_Minion.glb` | glb | CC0-1.0 | SHIPPABLE |
| BS-017 | **Region 7 — Forge/Fortress** regional boss | B-019, C-015 | quaternius-ultimate-animated-character.zip | `assets/glTF/Knight_Golden_Male.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| BS-018 | **Region 8 — Storm/Final** regional boss (airship) | B-019, C-015, C-017 | 10-kenney-collection.zip | `space/rocket_baseB.glb` + `space/rocket_sidesB.glb` + `space/rocket_finsB.glb` + `space/rocket_topB.glb` + `space/rocket_fuelB.glb` + `space/turret_single.glb` | glb | CC0-1.0 | SHIPPABLE |
| BS-019 | **Finale** boss | B-019, C-015 | quaternius-animated-mech.zip | `assets/Textured/glTF/Leela.gltf` (18 clips) | gltf | CC0-1.0 | SHIPPABLE |
| BS-020 | Boss arena dressing — fortress wall run | C-015 | kaykit-dungeon-remastered.zip | `kaykit-dungeon-remastered/addons/kaykit_dungeon_remastered/Assets/gltf/wall_half.gltf.glb` | glb | CC0-1.0 | SHIPPABLE |
| BS-021 | Boss arena dressing — floor spikes (arena hazard) | C-013, C-015 | kaykit-dungeon-remastered.zip | `kaykit-dungeon-remastered/addons/kaykit_dungeon_remastered/Assets/gltf/floor_tile_big_spikes.glb` | glb | CC0-1.0 | SHIPPABLE |
| BS-022 | Boss arena dressing — torch (arena light) | C-015 | kaykit-dungeon-remastered.zip | `kaykit-dungeon-remastered/addons/kaykit_dungeon_remastered/Assets/gltf/torch_lit.gltf.glb` | glb | CC0-1.0 | SHIPPABLE |
| BS-023 | Boss arena dressing — goal banner (arena exit marker) | D-014 | kaykit-dungeon-remastered.zip | `kaykit-dungeon-remastered/addons/kaykit_dungeon_remastered/Assets/gltf/banner_shield_red.gltf.glb` | glb | CC0-1.0 | SHIPPABLE |
| BS-024 | Boss reward — treasure chest | D-003, C-015 | 10-kenney-collection.zip | `survival/chest.glb` | glb | CC0-1.0 | SHIPPABLE |

---

## 4. COMPANIONS AND MOUNTS

`REQ-A-018` (rideable companion mount/dismount, independent damage, tongue/eat, carrying,
spit, reclaim) and `REQ-B-014` (companion-accessible exits). Companion bodies are real
rigs; the mount/dismount transition uses existing clip banks, not new animation.

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| CO-001 | Rideable mount — equine body, `walk/run/down/up` clips | A-018, B-014 | 10-kenney-collection.zip | `prototype/animal-horse.glb` | glb | CC0-1.0 | SHIPPABLE |
| CO-002 | Rideable mount — equine body, 13 clips, larger silhouette | A-018 | quaternius-ultimate-animated-animals.zip | `assets/glTF/Horse_White.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| CO-003 | Rideable mount — flying body | A-018, B-014 | 10-kenney-collection.zip | `cube-pets/animal-parrot.glb` | glb | CC0-1.0 | SHIPPABLE |
| CO-004 | Small companion — dog body, 12 clips | A-018 | quaternius-ultimate-animated-animals.zip | `assets/glTF/ShibaInu.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| CO-005 | Small companion — fox body, 12 clips | A-018 | quaternius-ultimate-animated-animals.zip | `assets/glTF/Fox.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| CO-006 | Companion NPC — shopkeeper | D-013, B-002 | quaternius-ultimate-animated-character.zip | `assets/glTF/Chef_Hat.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| CO-007 | Companion NPC — guide | B-002 | quaternius-ultimate-animated-character.zip | `assets/glTF/Cowboy_Male.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| CO-008 | Companion NPC — sage/quest giver | B-002, D-011 | quaternius-ultimate-animated-character.zip | `assets/glTF/OldClassy_Male.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| CO-009 | Carried object — crate (light) | A-013, C-014 | 10-kenney-collection.zip | `platformer/crate.glb` | glb | CC0-1.0 | SHIPPABLE |
| CO-010 | Carried object — barrel (medium) | A-013 | 10-kenney-collection.zip | `platformer/barrel.glb` | glb | CC0-1.0 | SHIPPABLE |
| CO-011 | Carried object — treasure chest (heavy) | A-013, D-003 | 10-kenney-collection.zip | `platformer/chest.glb` | glb | CC0-1.0 | SHIPPABLE |
| CO-012 | Carried object — boulder (very heavy) | A-013 | 10-kenney-collection.zip | `platformer/rocks.glb` | glb | CC0-1.0 | SHIPPABLE |
| CO-013 | Carried object — reinforced crate (heavy) | A-013 | 10-kenney-collection.zip | `platformer/crate-strong.glb` | glb | CC0-1.0 | SHIPPABLE |
| CO-014 | Carried object — item crate (breakable, yields a pickup) | A-013, D-006 | 10-kenney-collection.zip | `platformer/crate-item.glb` | glb | CC0-1.0 | SHIPPABLE |

---

## 5. PROJECTILE MESHES

`REQ-A-020` (spawn, move, bounce, hit, exhaust, lifetime, pooling) and `REQ-C-010`
(telegraph, arc, cooldown). Projectile bodies are separate meshes from their launchers so
that one launcher mesh can spawn several projectile types.

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| PJ-001 | Projectile — cannonball (horizontal roll) | A-020, C-010 | 10-kenney-collection.zip | `pirate/cannon-ball.glb` | glb | CC0-1.0 | SHIPPABLE |
| PJ-002 | Projectile — arrow (forest/hunting) | A-020 | 10-kenney-collection.zip | `mini-forest/weapon-arrow.glb` | glb | CC0-1.0 | SHIPPABLE |
| PJ-003 | Projectile — flat arrow (platformer scale) | A-020 | 10-kenney-collection.zip | `platformer/arrow.glb` | glb | CC0-1.0 | SHIPPABLE |
| PJ-004 | Projectile — returning boomerang | A-020, C-018 | 10-kenney-collection.zip | `platformer/arrows.glb` | glb | CC0-1.0 | SHIPPABLE |
| PJ-005 | Projectile — thrown spear/tool | A-020, C-010 | 10-kenney-collection.zip | `mini-dungeon/weapon-spear.glb` | glb | CC0-1.0 | SHIPPABLE |
| PJ-006 | Projectile — thrown sword | A-020, C-010 | 10-kenney-collection.zip | `mini-dungeon/weapon-sword.glb` | glb | CC0-1.0 | SHIPPABLE |
| PJ-007 | Projectile — thrown grenade/fireball | A-020, C-010 | 10-kenney-collection.zip | `weapon/grenade.glb` | glb | CC0-1.0 | SHIPPABLE |
| PJ-008 | Projectile — heavy rock (rock-volley boss) | A-020, C-010 | 10-kenney-collection.zip | `tower-defense/weapon-ammo-boulder.glb` | glb | CC0-1.0 | SHIPPABLE |
| PJ-009 | Projectile — shield disc (returning) | A-020, C-018 | 10-kenney-collection.zip | `mini-dungeon/shield-round.glb` | glb | CC0-1.0 | SHIPPABLE |

---

## 6. TERRAIN, PLATFORMS AND HAZARDS

`REQ-D-001` (tile materials: solid, breakable, bumpable, invisible, one-way, slope, hurt,
liquid, decorative), `REQ-A-011` (material profiles), `REQ-A-012` (one-way platforms),
`REQ-D-012` (unified hazard events).

### 6.1 Terrain blocks and material variants

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| TR-001 | Solid grass block | D-001, A-006 | 10-kenney-collection.zip | `platformer/block-grass.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-002 | Solid grass block — large | D-001 | 10-kenney-collection.zip | `platformer/block-grass-large.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-003 | Solid grass block — narrow | D-001 | 10-kenney-collection.zip | `platformer/block-grass-narrow.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-004 | Solid grass block — long | D-001 | 10-kenney-collection.zip | `platformer/block-grass-long.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-005 | Solid grass block — low | D-001 | 10-kenney-collection.zip | `platformer/block-grass-low.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-006 | Grass block — corner | D-001 | 10-kenney-collection.zip | `platformer/block-grass-corner.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-007 | Grass block — edge | D-001 | 10-kenney-collection.zip | `platformer/block-grass-edge.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-008 | Grass block — curve | D-001 | 10-kenney-collection.zip | `platformer/block-grass-curve.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-009 | Grass block — curve half | D-001 | 10-kenney-collection.zip | `platformer/block-grass-curve-half.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-010 | Grass block — curve low | D-001 | 10-kenney-collection.zip | `platformer/block-grass-curve-low.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-011 | Grass block — hexagon | D-001 | 10-kenney-collection.zip | `platformer/block-grass-hexagon.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-012 | Grass block — low hexagon | D-001 | 10-kenney-collection.zip | `platformer/block-grass-low-hexagon.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-013 | Grass ceiling block — overhang corner variant | D-001 | 10-kenney-collection.zip | `platformer/block-grass-corner-overhang.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-014 | Grass ceiling block — overhang edge | D-001 | 10-kenney-collection.zip | `platformer/block-grass-overhang-edge.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-015 | Grass ceiling block — overhang corner | D-001 | 10-kenney-collection.zip | `platformer/block-grass-overhang-corner.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-016 | Grass ceiling block — overhang hexagon | D-001 | 10-kenney-collection.zip | `platformer/block-grass-overhang-hexagon.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-017 | Grass slope — large | D-001 | 10-kenney-collection.zip | `platformer/block-grass-large-slope.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-018 | Grass slope — large steep | D-001 | 10-kenney-collection.zip | `platformer/block-grass-large-slope-steep.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-019 | Grass tall block | D-001 | 10-kenney-collection.zip | `platformer/block-grass-large-tall.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-020 | Ice/snow block family (edge, corner, overhang, large, narrow, long, low, hexagon, curve, large-slope, large-tall) — **ice material profile** | A-011, D-001 | 10-kenney-collection.zip | `platformer/block-snow.glb`, `platformer/block-snow-edge.glb`, `platformer/block-snow-corner.glb`, `platformer/block-snow-corner-low.glb`, `platformer/block-snow-corner-overhang.glb`, `platformer/block-snow-overhang-edge.glb`, `platformer/block-snow-overhang-corner.glb`, `platformer/block-snow-overhang-hexagon.glb`, `platformer/block-snow-overhang-large.glb`, `platformer/block-snow-overhang-long.glb`, `platformer/block-snow-overhang-narrow.glb`, `platformer/block-snow-overhang-low.glb`, `platformer/block-snow-large.glb`, `platformer/block-snow-narrow.glb`, `platformer/block-snow-long.glb`, `platformer/block-snow-low.glb`, `platformer/block-snow-hexagon.glb`, `platformer/block-snow-curve.glb`, `platformer/block-snow-curve-half.glb`, `platformer/block-snow-curve-low.glb`, `platformer/block-snow-large-slope.glb`, `platformer/block-snow-large-slope-steep.glb`, `platformer/block-snow-large-tall.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-021 | Breakable brick block | D-001, D-002 | 10-kenney-collection.zip | `platformer/brick.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-022 | Switch-gated moving block (outlined block target) | D-008, B-015 | 10-kenney-collection.zip | `platformer/block-moving-blue.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-023 | Platformer kit colour map (tint palette for all platformer tiles) | D-017 | 10-kenney-collection.zip | `platformer/Textures/colormap.png` | png | CC0-1.0 | SHIPPABLE |
| TR-024 | Hex terrain — grass tile | D-001 | 10-kenney-collection.zip | `hexagon/grass.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-025 | Hex terrain — river tile | D-001 | 10-kenney-collection.zip | `hexagon/river-straight.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-026 | Hex terrain — sand tile (**quicksand material profile**) | A-011 | 10-kenney-collection.zip | `hexagon/sand.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-027 | Hex terrain — stone tile | D-001 | 10-kenney-collection.zip | `hexagon/stone.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-028 | Hex terrain — water tile (**liquid material**) | D-001, A-009 | 10-kenney-collection.zip | `hexagon/water.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-029 | Hex terrain — path tile | D-001 | 10-kenney-collection.zip | `hexagon/path-straight.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-030 | Hex terrain — dirt tile (**mud material profile**) | A-011 | 10-kenney-collection.zip | `hexagon/dirt.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-031 | KayKit medieval hex — grass tile | D-001 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/tiles/base/hex_grass.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| TR-032 | KayKit medieval hex — river tile | D-001 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/tiles/rivers/hex_river_A.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| TR-033 | KayKit medieval hex — coast tile | D-001 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/tiles/coast/hex_coast_A.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| TR-034 | KayKit medieval hex — road tile (sloped low) | D-001 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/tiles/roads/hex_road_A_sloped_low.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| TR-035 | KayKit hex — grass slope (high / low) | D-001 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/tiles/base/hex_grass_sloped_high.gltf`, `…/hex_grass_sloped_low.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| TR-036 | Modular dungeon — floor tile | D-001 | 10-kenney-collection.zip | `modular-dungeon/template-floor.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-037 | Modular dungeon — wall tile | D-001 | 10-kenney-collection.zip | `modular-dungeon/template-wall.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-038 | Modular dungeon — room module | B-007 | 10-kenney-collection.zip | `modular-dungeon/room-small.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-039 | Modular cave — floor tile | D-001 | 10-kenney-collection.zip | `modular-cave/template-floor.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-040 | Modular cave — corridor module | B-007 | 10-kenney-collection.zip | `modular-cave/corridor.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-041 | Building kit — floor tile | D-001 | 10-kenney-collection.zip | `building/floor.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-042 | Building kit — low wall | D-001 | 10-kenney-collection.zip | `building/wall-low.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-043 | Nature — rock cliff block | D-001 | 10-kenney-collection.zip | `nature/cliff_block_rock.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-044 | Nature — stone cliff block | D-001 | 10-kenney-collection.zip | `nature/cliff_block_stone.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-045 | Nature — ground path | D-001 | 10-kenney-collection.zip | `nature/ground_pathCorner.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-046 | Nature — river end ground | A-009, D-001 | 10-kenney-collection.zip | `nature/ground_riverEnd.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-047 | KayKit dungeon — foundation floor tile | D-001 | kaykit-dungeon-remastered.zip | `kaykit-dungeon-remastered/addons/kaykit_dungeon_remastered/Assets/gltf/floor_foundation_allsides.gltf.glb` | glb | CC0-1.0 | SHIPPABLE |
| TR-048 | PBR material — asphalt | D-017 | fps-asset-kit.zip | `fps-asset-kit/textures/Asphalt031/Asphalt031.png` | png | CC0-1.0 | SHIPPABLE |
| TR-049 | PBR material — brick | D-017 | fps-asset-kit.zip | `fps-asset-kit/textures/Bricks097/Bricks097.png` | png | CC0-1.0 | SHIPPABLE |
| TR-050 | PBR material — concrete | D-017 | fps-asset-kit.zip | `fps-asset-kit/textures/Concrete034/Concrete034.png` | png | CC0-1.0 | SHIPPABLE |
| TR-051 | PBR material — rock | D-017 | fps-asset-kit.zip | `fps-asset-kit/textures/Rock058/Rock058.png` | png | CC0-1.0 | SHIPPABLE |
| TR-052 | PBR material — wood | D-017 | fps-asset-kit.zip | `fps-asset-kit/textures/Wood092/Wood092.png` | png | CC0-1.0 | SHIPPABLE |
| TR-053 | PBR material — plaster | D-017 | fps-asset-kit.zip | `fps-asset-kit/textures/Plaster001/Plaster001.png` | png | CC0-1.0 | SHIPPABLE |
| TR-054 | PBR material — ground | D-017 | fps-asset-kit.zip | `fps-asset-kit/textures/Ground037/Ground037.png` | png | CC0-1.0 | SHIPPABLE |
| TR-055 | PBR material — metal | D-017 | fps-asset-kit.zip | `fps-asset-kit/textures/Metal049A/Metal049A.png` | png | CC0-1.0 | SHIPPABLE |
| TR-056 | PBR material set — ambientCG library (80 sets, one directory per set; naming convention `assets/ambientcg/<Name>/<Name>.png`) | D-017 | ambientcg-cc0-pbr-materials.zip | `assets/ambientcg/Asphalt031/Asphalt031.png`, `assets/ambientcg/Bricks097/Bricks097.png` | png | CC0-1.0 | SHIPPABLE |

### 6.2 Platforms

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| PF-001 | Static platform | A-012, D-001 | 10-kenney-collection.zip | `platformer/platform.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-002 | Ramp platform | A-012, D-001 | 10-kenney-collection.zip | `platformer/platform-ramp.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-003 | Fortified platform | A-012 | 10-kenney-collection.zip | `platformer/platform-fortified.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-004 | Overhang platform | A-012 | 10-kenney-collection.zip | `platformer/platform-overhang.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-005 | One-way / jump-through platform | A-012 | 10-kenney-collection.zip | `mini-forest/platform.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-006 | Raised one-way platform | A-012 | 10-kenney-collection.zip | `mini-forest/building-platform.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-007 | Hex floating bridge platform | A-012 | 10-kenney-collection.zip | `hexagon/bridge.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-008 | Hex floating island platform | A-012 | 10-kenney-collection.zip | `hexagon/water-island.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-009 | Space platform — side | A-012 | 10-kenney-collection.zip | `space/platform_side.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-010 | Space platform — large | A-012 | 10-kenney-collection.zip | `space/platform_large.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-011 | Space platform — corner | A-012 | 10-kenney-collection.zip | `space/platform_cornerRound.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-012 | Nature — wooden bridge platform | A-012 | 10-kenney-collection.zip | `nature/bridge_woodNarrow.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-013 | Nature — stone bridge platform | A-012 | 10-kenney-collection.zip | `nature/bridge_stoneNarrow.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-014 | Skate structure platform | A-012 | 10-kenney-collection.zip | `mini-skate/structure-platform.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-015 | Space-station narrow rail platform | A-012 | 10-kenney-collection.zip | `space-station/rail-narrow.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-016 | Dungeon stairs | A-013, B-013 | kaykit-dungeon-remastered.zip | `kaykit-dungeon-remastered/addons/kaykit_dungeon_remastered/Assets/gltf/stairs.gltf.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-017 | Dungeon narrow stairs | B-013 | kaykit-dungeon-remastered.zip | `kaykit-dungeon-remastered/addons/kaykit_dungeon_remastered/Assets/gltf/stairs_narrow.gltf.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-018 | Space ramp | D-001 | 10-kenney-collection.zip | `space/terrain_ramp.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-019 | Space ramp — large | D-001 | 10-kenney-collection.zip | `space/terrain_rampLarge.glb` | glb | CC0-1.0 | SHIPPABLE |
| PF-020 | Arena platform block | D-001 | 10-kenney-collection.zip | `mini-arena/block.glb` | glb | CC0-1.0 | SHIPPABLE |

### 6.3 Hazards

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| HZ-001 | Spike bed | D-012 | 10-kenney-collection.zip | `platformer/trap-spikes.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-002 | Spike bed — large | D-012 | 10-kenney-collection.zip | `platformer/trap-spikes-large.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-003 | Spike block | D-012 | 10-kenney-collection.zip | `platformer/spike-block.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-004 | Spike block — wide | D-012 | 10-kenney-collection.zip | `platformer/spike-block-wide.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-005 | Saw blade (rotating) | D-012, C-013 | 10-kenney-collection.zip | `platformer/saw.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-006 | Bomb hazard | D-012 | 10-kenney-collection.zip | `platformer/bomb.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-007 | Dungeon floor spikes | D-012 | kaykit-dungeon-remastered.zip | `kaykit-dungeon-remastered/addons/kaykit_dungeon_remastered/Assets/gltf/floor_tile_big_spikes.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-008 | Molten pool (lava surface) | D-012 | 10-kenney-collection.zip | `survival/campfire-pit.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-009 | Molten pool — log ring variant | D-012 | 10-kenney-collection.zip | `nature/campfire_logs.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-010 | Falling weight / crusher block | D-012, C-013 | 10-kenney-collection.zip | `platformer/block-moving-large.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-011 | Crushing ceiling | D-012, C-013 | 10-kenney-collection.zip | `platformer/block-grass-overhang-large.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-012 | Rolling boulder | D-012, C-013 | 10-kenney-collection.zip | `mini-dungeon/stones.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-013 | Waterfall (current source) | D-012, A-009 | 10-kenney-collection.zip | `nature/cliff_waterfallTop_stone.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-014 | Falling body hazard | D-012 | 10-kenney-collection.zip | `space/meteor_half.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-015 | Electric arc emitter | D-012 | 10-kenney-collection.zip | `space/rock_crystals.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-016 | Toxic pool marker | D-012, D-007 | 10-kenney-collection.zip | `nature/mushroom_redTall.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-017 | Chain tether (environmental hazard line) | D-012, C-013 | 10-kenney-collection.zip | `platformer/fence-rope.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-018 | Fire pit (forge region) | D-012 | 10-kenney-collection.zip | `survival/campfire-stand.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-019 | Wind-driven debris field (storm region) | A-010, D-012 | 10-kenney-collection.zip | `nature/grass.glb` | glb | CC0-1.0 | SHIPPABLE |
| HZ-020 | Ice hazard field | A-011, D-012 | 10-kenney-collection.zip | `platformer/block-snow-low.glb` | glb | CC0-1.0 | SHIPPABLE |

---

## 7. PICKUPS, LOCKS, SWITCHES, MOVING PLATFORMS, ANIMATED PROPS

### 7.1 Pickups and power-ups

`REQ-D-003` (currency, extra life, temporary boost, restorative health, score token),
`REQ-D-005` (power-up FSM), `REQ-D-006` (emerge, delayed pickup, bounce, fall),
`REQ-D-007` (negative pickup).

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| PK-001 | Currency — bronze coin | D-003, D-017 | 10-kenney-collection.zip | `platformer/coin-bronze.glb` | glb | CC0-1.0 | SHIPPABLE |
| PK-002 | Currency — silver coin | D-003 | 10-kenney-collection.zip | `platformer/coin-silver.glb` | glb | CC0-1.0 | SHIPPABLE |
| PK-003 | Currency — gold coin | D-003 | 10-kenney-collection.zip | `platformer/coin-gold.glb` | glb | CC0-1.0 | SHIPPABLE |
| PK-004 | Score token | D-003, B-017 | 10-kenney-collection.zip | `platformer/star.glb` | glb | CC0-1.0 | SHIPPABLE |
| PK-005 | Restorative health | D-003, A-019 | 10-kenney-collection.zip | `platformer/heart.glb` | glb | CC0-1.0 | SHIPPABLE |
| PK-006 | High-value jewel | D-003 | 10-kenney-collection.zip | `platformer/jewel.glb` | glb | CC0-1.0 | SHIPPABLE |
| PK-007 | Key (consumable) | D-011, B-011 | 10-kenney-collection.zip | `platformer/key.glb` | glb | CC0-1.0 | SHIPPABLE |
| PK-008 | Growth power-up (small/large form) | D-005, D-006 | 10-kenney-collection.zip | `platformer/mushrooms.glb` | glb | CC0-1.0 | SHIPPABLE |
| PK-009 | Projectile/caster form pickup (grants **Vellum**) | D-005, A-020 | kaykit-adventurers.zip | `kaykit-adventurers/addons/kaykit_character_pack_adventures/Assets/gltf/spellbook_open.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| PK-010 | Invulnerability charm | D-005 | kaykit-prototype-bits.zip | `kaykit-prototype-bits/addons/kaykit_prototype_bits/Assets/gltf/Coin_A.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| PK-011 | Extra life | D-003 | kaykit-prototype-bits.zip | `kaykit-prototype-bits/addons/kaykit_prototype_bits/Assets/gltf/Coin_B.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| PK-012 | Temporary boost charm | D-005 | kaykit-prototype-bits.zip | `kaykit-prototype-bits/addons/kaykit_prototype_bits/Assets/gltf/Coin_C.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| PK-013 | Negative pickup — poison mushroom | D-007 | 10-kenney-collection.zip | `nature/mushroom_redTall.glb` | glb | CC0-1.0 | SHIPPABLE |
| PK-014 | Reserve item (world-use slot) | D-013 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/sack.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| PK-015 | Hidden collectible (secret-room bonus) | B-011, B-020 | 10-kenney-collection.zip | `mini-dungeon/coin.glb` | glb | CC0-1.0 | SHIPPABLE |
| PK-016 | Bonus reward container | D-003 | 10-kenney-collection.zip | `mini-dungeon/chest.glb` | glb | CC0-1.0 | SHIPPABLE |
| PK-017 | Weapon pickup — bow (forest companion) | D-005, A-020 | 10-kenney-collection.zip | `mini-forest/weapon-bow.glb` | glb | CC0-1.0 | SHIPPABLE |

### 7.2 Keys, locks, doors and traversal portals

`REQ-D-011` (data predicates), `REQ-A-008` (directional pipe/door/ladder traversal),
`REQ-B-010` (warps, return portals), `REQ-B-011` (key/lock puzzles).

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| KL-001 | Lock plate (keyhole block) | D-011, B-011 | 10-kenney-collection.zip | `platformer/lock.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-002 | Door — open state | D-011 | 10-kenney-collection.zip | `platformer/door-open.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-003 | Door — large, open state | D-011 | 10-kenney-collection.zip | `platformer/door-large-open.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-004 | Door — rotating, animated `open/close/open-and-close` | D-011 | 10-kenney-collection.zip | `platformer/door-rotate.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-005 | Door — large rotating, animated | D-011 | 10-kenney-collection.zip | `platformer/door-rotate-large.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-006 | Dungeon gate, animated `open/close/open-close` | D-011 | 10-kenney-collection.zip | `mini-dungeon/gate.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-007 | Modular dungeon gate, animated | D-011 | 10-kenney-collection.zip | `modular-dungeon/gate-door.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-008 | Modular space gate, animated | D-011 | 10-kenney-collection.zip | `modular-space/gate-door.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-009 | Crypt door, animated | D-011 | 10-kenney-collection.zip | `graveyard/crypt-door.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-010 | Crypt large door, animated | D-011 | 10-kenney-collection.zip | `graveyard/crypt-large-door.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-011 | Cabin door, animated | D-011 | 10-kenney-collection.zip | `holiday/cabin-door-rotate.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-012 | Market fence gate, animated | D-011 | 10-kenney-collection.zip | `mini-market/fence-door-rotate.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-013 | Factory door, animated | D-011 | 10-kenney-collection.zip | `factory/door.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-014 | Building door set, animated (8 variants) | D-011 | 10-kenney-collection.zip | `building/door-rotate-square-a.glb` … `building/door-rotate-round-d.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-015 | Prototype door set, animated (sliding, garage, rotating) | D-011 | 10-kenney-collection.zip | `prototype/door-sliding.glb`, `prototype/door-sliding-double.glb`, `prototype/door-sliding-double-wide.glb`, `prototype/door-sliding-double-round.glb`, `prototype/door-garage.glb`, `prototype/door-rotate.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-016 | Alternate-world portal frame (open arch) | D-011, B-010 | kaykit-dungeon-remastered.zip | `kaykit-dungeon-remastered/addons/kaykit_dungeon_remastered/Assets/gltf/wall_archedwindow_open.gltf.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-017 | Pipe (directional traversal) | A-008, B-010 | 10-kenney-collection.zip | `platformer/pipe.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-018 | Ladder (climb traversal) | A-014, A-008 | 10-kenney-collection.zip | `platformer/ladder.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-019 | Ladder — long | A-014 | 10-kenney-collection.zip | `platformer/ladder-long.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-020 | Ladder — broken | A-014 | 10-kenney-collection.zip | `platformer/ladder-broken.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-021 | Rope/net traversal line | A-014 | 10-kenney-collection.zip | `platformer/fence-rope.glb` | glb | CC0-1.0 | SHIPPABLE |
| KL-022 | Hex gate (world-map edge lock) | B-011 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/neutral/fence_stone_straight_gate.gltf` | gltf | CC0-1.0 | SHIPPABLE |

### 7.3 Switches

`REQ-D-008` (temporary world-state switches), `REQ-B-015` (global colour-switch flags).

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| SW-001 | Round button — animated `toggle-on/toggle-off/toggle` | D-008 | 10-kenney-collection.zip | `platformer/button-round.glb` | glb | CC0-1.0 | SHIPPABLE |
| SW-002 | Square button | D-008 | 10-kenney-collection.zip | `platformer/button-square.glb` | glb | CC0-1.0 | SHIPPABLE |
| SW-003 | Lever — single, animated | D-008 | 10-kenney-collection.zip | `factory/lever-single.glb` | glb | CC0-1.0 | SHIPPABLE |
| SW-004 | Lever — double, animated | D-008 | 10-kenney-collection.zip | `factory/lever-double.glb` | glb | CC0-1.0 | SHIPPABLE |
| SW-005 | Prototype lever — single, animated | D-008 | 10-kenney-collection.zip | `prototype/lever-single.glb` | glb | CC0-1.0 | SHIPPABLE |
| SW-006 | Prototype lever — double, animated | D-008 | 10-kenney-collection.zip | `prototype/lever-double.glb` | glb | CC0-1.0 | SHIPPABLE |
| SW-007 | Floor button — round, animated | D-008 | 10-kenney-collection.zip | `factory/button-floor-round.glb` | glb | CC0-1.0 | SHIPPABLE |
| SW-008 | Floor button — square, animated | D-008 | 10-kenney-collection.zip | `factory/button-floor-square.glb` | glb | CC0-1.0 | SHIPPABLE |
| SW-009 | Floor button — small round, animated | D-008 | 10-kenney-collection.zip | `factory/button-floor-round-small.glb` | glb | CC0-1.0 | SHIPPABLE |
| SW-010 | Prototype floor button — round, animated | D-008 | 10-kenney-collection.zip | `prototype/button-floor-round.glb` | glb | CC0-1.0 | SHIPPABLE |
| SW-011 | Indicator lamp (switch state read) | D-008 | 10-kenney-collection.zip | `factory/indicator-special-arrow.glb` | glb | CC0-1.0 | SHIPPABLE |
| SW-012 | Wall switch (space-station) | D-008 | 10-kenney-collection.zip | `space-station/wall-switch.glb` | glb | CC0-1.0 | SHIPPABLE |
| SW-013 | Coloured switch flag — red | B-015 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/flag_red.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| SW-014 | Coloured switch flag — blue | B-015 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/flag_blue.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| SW-015 | Coloured switch flag — green | B-015 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/flag_green.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| SW-016 | Coloured switch flag — yellow | B-015 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/flag_yellow.gltf` | gltf | CC0-1.0 | SHIPPABLE |

### 7.4 Moving platforms

`REQ-D-009` (loop, oscillate, fall, seesaw, rideable flyer, rotating, weight-sensitive,
autoscroll).

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| MV-001 | Loop-track platform | D-009 | 10-kenney-collection.zip | `platformer/block-moving.glb` | glb | CC0-1.0 | SHIPPABLE |
| MV-002 | Loop-track platform — large | D-009 | 10-kenney-collection.zip | `platformer/block-moving-large.glb` | glb | CC0-1.0 | SHIPPABLE |
| MV-003 | Oscillating platform | D-009 | 10-kenney-collection.zip | `platformer/block-moving-blue.glb` | glb | CC0-1.0 | SHIPPABLE |
| MV-004 | Falling platform (collapsing bridge) | D-009 | 10-kenney-collection.zip | `mini-forest/bridge.glb` | glb | CC0-1.0 | SHIPPABLE |
| MV-005 | Seesaw platform (pallet plank) | D-009 | kaykit-medieval-hexagon.zip | `kaykit-medieval-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/props/pallet.gltf` | gltf | CC0-1.0 | SHIPPABLE |
| MV-006 | Rotating platform (prize-wheel disc, animated) | D-009 | 10-kenney-collection.zip | `mini-arcade/prize-wheel.glb` | glb | CC0-1.0 | SHIPPABLE |
| MV-007 | Rideable flyer platform (hover craft) | D-009, A-018 | 10-kenney-collection.zip | `space/craft_speederA.glb` | glb | CC0-1.0 | SHIPPABLE |
| MV-008 | Autoscroll carrier (rail box) | D-009, B-012 | 10-kenney-collection.zip | `space/monorail_trainBox.glb` | glb | CC0-1.0 | SHIPPABLE |
| MV-009 | Weight-sensitive platform (pallet) | D-009 | 10-kenney-collection.zip | `mini-skate/pallet.glb` | glb | CC0-1.0 | SHIPPABLE |
| MV-010 | Timed / switch-expiry platform | D-009, D-008 | 10-kenney-collection.zip | `mini-arena/block.glb` | glb | CC0-1.0 | SHIPPABLE |
| MV-011 | Rotating disc platform (indicator disc, animated) | D-009 | 10-kenney-collection.zip | `prototype/indicator-round-c.glb` | glb | CC0-1.0 | SHIPPABLE |
| MV-012 | Wind-driven swaying bridge | D-009, A-010 | 10-kenney-collection.zip | `nature/bridge_woodRoundNarrow.glb` | glb | CC0-1.0 | SHIPPABLE |
| MV-013 | Vertical elevator (animated piston platform) | D-009 | 10-kenney-collection.zip | `factory/piston-square.glb` | glb | CC0-1.0 | SHIPPABLE |

### 7.5 Animated interactive props

`REQ-D-002` (block states and bounce), `REQ-D-010` (springboard/bounce pad), `REQ-D-014`
(goal objects). These are the props that already carry authored clip banks.

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| IP-001 | Springboard / bounce pad | D-010 | 10-kenney-collection.zip | `platformer/spring.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-002 | Note block (bumpable block with payload) | D-002, D-006 | 10-kenney-collection.zip | `platformer/brick.glb` (bump animation is a material/state change on the same mesh) | glb | CC0-1.0 | SHIPPABLE |
| IP-003 | Chest — survival, animated `open/close/open-close` | D-002, D-003 | 10-kenney-collection.zip | `survival/chest.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-004 | Chest — pirate, animated | D-002, D-003 | 10-kenney-collection.zip | `pirate/chest.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-005 | Chest — mini-dungeon, animated | D-002, D-003 | 10-kenney-collection.zip | `mini-dungeon/chest.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-006 | Trap — ceiling/flip, animated `show/hide/show-hide` | C-013, D-008 | 10-kenney-collection.zip | `mini-dungeon/trap.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-007 | Factory piston — square, animated `toggle-on/toggle-off/toggle` | D-009 | 10-kenney-collection.zip | `factory/piston-square.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-008 | Factory piston — thin square, animated | D-009 | 10-kenney-collection.zip | `factory/piston-thin-square.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-009 | Factory piston — round, animated | D-009 | 10-kenney-collection.zip | `factory/piston-round.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-010 | Blaster crate — animated `open/close/open-close` | D-002 | 10-kenney-collection.zip | `blaster/crate-wide.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-011 | Mini-market wall door, animated | D-011 | 10-kenney-collection.zip | `mini-market/wall-door-rotate.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-012 | Arcade claw machine, animated `animation` | B-018 | 10-kenney-collection.zip | `mini-arcade/claw-machine.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-013 | Arcade ticket machine, animated `animation` | B-018 | 10-kenney-collection.zip | `mini-arcade/ticket-machine.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-014 | Hex watermill — animated `animation` (rotating sails) | B-007, D-017 | 10-kenney-collection.zip | `hexagon/building-watermill.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-015 | Hex mill — animated `animation` | B-007, D-017 | 10-kenney-collection.zip | `hexagon/building-mill.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-016 | Prototype figurine — 27-clip animated actor (minigame host) | B-018 | 10-kenney-collection.zip | `prototype/figurine-cube.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-017 | Prototype figurine — cube detailed, 27 clips | B-018 | 10-kenney-collection.zip | `prototype/figurine-cube-detailed.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-018 | Holiday cabin overhang door, animated | D-011 | 10-kenney-collection.zip | `holiday/cabin-overhang-door-rotate.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-019 | Skateboard (rideable prop) | A-018 | 10-kenney-collection.zip | `mini-skate/skateboard.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-020 | Goal marker — flag pole base | D-014 | 10-kenney-collection.zip | `platformer/flag.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-021 | Goal marker — sign | D-014, D-019 | 10-kenney-collection.zip | `platformer/sign.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-022 | Goal marker — castle pennant | D-014 | 10-kenney-collection.zip | `castle/flag-pennant.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-023 | Conveyor belt surface (material profile) | A-011 | 10-kenney-collection.zip | `platformer/conveyor-belt.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-024 | Factory conveyor surface (material profile) | A-011 | 10-kenney-collection.zip | `factory/conveyor.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-025 | Bumpable block — strong crate | D-002 | 10-kenney-collection.zip | `platformer/crate-strong.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-026 | Bumpable block — item crate | D-002, D-006 | 10-kenney-collection.zip | `platformer/crate-item.glb` | glb | CC0-1.0 | SHIPPABLE |
| IP-027 | Bumpable block — reinforced item crate | D-002, D-006 | 10-kenney-collection.zip | `platformer/crate-item-strong.glb` | glb | CC0-1.0 | SHIPPABLE |

---

## 8. SKYBOXES AND BACKGROUNDS

`REQ-D-017` (parallax backgrounds, palette variants, screen transitions, light effects),
`REQ-B-007` (per-biome visual profile). **80 PolyHaven CC0 HDR skyboxes** are available;
**4** more ship inside the environment kit.

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| SB-001 | Skybox HDR — dawn | D-017 | polyhaven-cc0-hdris-textures-models.zip | `assets/polyhaven/aarfontein_dawn_2/aarfontein_dawn_2_1k.hdr` | hdr | CC0 | SHIPPABLE |
| SB-002 | Skybox HDR — dusk | D-017 | polyhaven-cc0-hdris-textures-models.zip | `assets/polyhaven/aarfontein_dusk/aarfontein_dusk_1k.hdr` | hdr | CC0 | SHIPPABLE |
| SB-003 | Skybox HDR — sunrise | D-017 | polyhaven-cc0-hdris-textures-models.zip | `assets/polyhaven/aarfontein_sunrise/aarfontein_sunrise_1k.hdr` | hdr | CC0 | SHIPPABLE |
| SB-004 | Skybox HDR — clear sky (2K) | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/skyboxes/polyhaven-hdri/kloppenheim_02_puresky_2k.hdr` | hdr | CC0 | SHIPPABLE |
| SB-005 | Skybox HDR — clear sky variant (2K) | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/skyboxes/polyhaven-hdri/kloppenheim_06_puresky_2k.hdr` | hdr | CC0 | SHIPPABLE |
| SB-006 | Skybox HDR — urban alley (2K) | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/skyboxes/polyhaven-hdri/urban_alley_01_2k.hdr` | hdr | CC0 | SHIPPABLE |
| SB-007 | Skybox HDR — urban street (2K) | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/skyboxes/polyhaven-hdri/urban_street_01_2k.hdr` | hdr | CC0 | SHIPPABLE |
| SB-008 | Skybox — Kenney day | D-017 | kenney-cc0-game-art-packs.zip | `assets/kenney/skyboxes/skybox-day.png` | png | CC0-1.0 | SHIPPABLE |
| SB-009 | Skybox — Kenney night | D-017 | kenney-cc0-game-art-packs.zip | `assets/kenney/skyboxes/skybox-night.png` | png | CC0-1.0 | SHIPPABLE |
| SB-010 | Skybox — Kenney morning | D-017 | kenney-cc0-game-art-packs.zip | `assets/kenney/skyboxes/skybox-morning.png` | png | CC0-1.0 | SHIPPABLE |
| SB-011 | Skybox — Kenney alien | D-017 | kenney-cc0-game-art-packs.zip | `assets/kenney/skyboxes/skybox-alien.png` | png | CC0-1.0 | SHIPPABLE |
| SB-012 | Skybox — Kenney space | D-017 | kenney-cc0-game-art-packs.zip | `assets/kenney/skyboxes/skybox-space.png` | png | CC0-1.0 | SHIPPABLE |
| SB-013 | Skybox — Kenney space galaxy | D-017 | kenney-cc0-game-art-packs.zip | `assets/kenney/skyboxes-space/skybox-space-galaxy.png` | png | CC0-1.0 | SHIPPABLE |
| SB-014 | Skybox — Kenney space nebula | D-017 | kenney-cc0-game-art-packs.zip | `assets/kenney/skyboxes-space/skybox-space-nebula.png` | png | CC0-1.0 | SHIPPABLE |
| SB-015 | Skybox HDR library — 80 PolyHaven scenes, naming `assets/polyhaven/<scene>/<scene>_1k.hdr` | D-017 | polyhaven-cc0-hdris-textures-models.zip | `assets/polyhaven/abandoned_bakery/abandoned_bakery_1k.hdr`, `assets/polyhaven/abandoned_church/abandoned_church_1k.hdr`, `assets/polyhaven/abandoned_construction/abandoned_construction_1k.hdr`, `assets/polyhaven/aarfontein_pan/aarfontein_pan_1k.hdr` | hdr | CC0 | SHIPPABLE |
| BG-001 | Far parallax layer — dark tree line | D-017 | 10-kenney-collection.zip | `nature/tree_simple_dark.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-002 | Far parallax layer — dark plateau | D-017 | 10-kenney-collection.zip | `nature/tree_plateau_dark.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-003 | Mid parallax layer — castle | D-017, B-007 | 10-kenney-collection.zip | `hexagon/building-castle.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-004 | Mid parallax layer — village | D-017, B-007 | 10-kenney-collection.zip | `hexagon/building-village.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-005 | Mid parallax layer — farm | D-017, B-007 | 10-kenney-collection.zip | `hexagon/building-farm.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-006 | Mid parallax layer — harbour dock | D-017, B-007 | 10-kenney-collection.zip | `hexagon/building-dock.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-007 | Mid parallax layer — mine | D-017, B-007 | 10-kenney-collection.zip | `hexagon/building-mine.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-008 | Mid parallax layer — smelter (forge region) | D-017, B-007 | 10-kenney-collection.zip | `hexagon/building-smelter.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-009 | Mid parallax layer — wizard tower | D-017, B-007 | 10-kenney-collection.zip | `hexagon/building-wizard-tower.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-010 | Mid parallax layer — watch tower | D-017, B-007 | 10-kenney-collection.zip | `hexagon/building-tower.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-011 | Far parallax layer — stone mountain | D-017 | 10-kenney-collection.zip | `hexagon/stone-mountain.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-012 | Far parallax layer — stone hill | D-017 | 10-kenney-collection.zip | `hexagon/stone-hill.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-013 | Far parallax layer — hex forest | D-017 | 10-kenney-collection.zip | `hexagon/grass-forest.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-014 | Far parallax layer — desert | D-017 | 10-kenney-collection.zip | `hexagon/sand-desert.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-015 | Far parallax layer — rock field | D-017 | 10-kenney-collection.zip | `hexagon/stone-rocks.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-016 | 2D parallax layer — cloud band | D-017 | 08-tiles.zip | `background-elements/PNG/Flat/cloud1.png` | png | CC0-1.0 | SHIPPABLE |
| BG-017 | 2D parallax layer — hill band | D-017 | 08-tiles.zip | `background-elements/PNG/Flat/hills1.png` | png | CC0-1.0 | SHIPPABLE |
| BG-018 | 2D parallax layer — mountain band | D-017 | 08-tiles.zip | `background-elements/PNG/Flat/mountain1.png` | png | CC0-1.0 | SHIPPABLE |
| BG-019 | 2D parallax layer — grass tuft band | D-017 | 08-tiles.zip | `background-elements/PNG/Flat/grass1.png` | png | CC0-1.0 | SHIPPABLE |
| BG-020 | 2D parallax layer — castle silhouette | D-017 | 08-tiles.zip | `background-elements/PNG/Flat/castle.png` | png | CC0-1.0 | SHIPPABLE |
| BG-021 | 3D water surface shader texture | A-009, D-017 | godot-asset-library-3d-animation.zip | `assets/godot/40/water.png` | png | CC0-1.0 | SHIPPABLE |
| BG-022 | 3D water displacement texture | A-009 | godot-asset-library-3d-animation.zip | `assets/godot/40/waterdisplacement.png` | png | CC0-1.0 | SHIPPABLE |
| BG-023 | 3D water DUDV displacement map | A-009 | godot-asset-library-3d-animation.zip | `assets/godot/42/waterDUDV.png` | png | CC0-1.0 | SHIPPABLE |
| BG-024 | 3D gradient background texture | D-017 | godot-asset-library-3d-animation.zip | `assets/godot/40/background.png` | png | CC0-1.0 | SHIPPABLE |
| BG-025 | Screen-transition terrain blend — grass | D-017 | godot-asset-library-3d-animation.zip | `assets/godot/59/grass.png` | png | CC0-1.0 | SHIPPABLE |
| BG-026 | Screen-transition terrain blend — sand | D-017 | godot-asset-library-3d-animation.zip | `assets/godot/59/sand.png` | png | CC0-1.0 | SHIPPABLE |
| BG-027 | Screen-transition terrain blend — sand transition | D-017 | godot-asset-library-3d-animation.zip | `assets/godot/59/sand_transition.png` | png | CC0-1.0 | SHIPPABLE |
| BG-028 | Stylised vegetation — grass tuft | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Grass.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-029 | Stylised vegetation — fern | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Fern.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-030 | Stylised vegetation — tree | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Tree-aVOxaHRPWe.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-031 | Stylised vegetation — twisted tree | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Twisted Tree-7PDBpElkQr.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-032 | Stylised vegetation — pine | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Pine.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-033 | Stylised vegetation — mushroom | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Mushroom.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-034 | Stylised vegetation — plant | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Plant-xH5gNlQxAZ.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-035 | Stylised vegetation — flower petal | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Flower Petal.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-036 | Stylised vegetation — bush (round) | D-017 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/environment/vegetation/polypizza-stylized-nature-gltf/Pebble Round.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-037 | Low-poly nature — tree set (5 variants + cluster) | D-017 | jean-charpentier-lowpoly.zip | `assets/165248/FBX/arbre01.fbx`, `assets/165248/FBX/arbre02.fbx`, `assets/165248/FBX/arbre03.fbx`, `assets/165248/FBX/arbre04.fbx`, `assets/165248/FBX/arbre05.fbx`, `assets/165248/FBX/arbres_amas.fbx` | fbx | CC0-1.0 | SHIPPABLE |
| BG-038 | Low-poly nature — rock set (simple/cluster) | D-017 | jean-charpentier-lowpoly.zip | `assets/165248/FBX/rocher_simple01.fbx`, `assets/165248/FBX/rocher_simple02.fbx`, `assets/165248/FBX/rocher_simple03.fbx`, `assets/165248/FBX/rocher_amas01.fbx`, `assets/165248/FBX/rocher_amas02.fbx`, `assets/165248/FBX/rocher_amat01.fbx` | fbx | CC0-1.0 | SHIPPABLE |
| BG-039 | Low-poly nature — fence set | D-017 | jean-charpentier-lowpoly.zip | `assets/165248/FBX/barriere01.fbx`, `assets/165248/FBX/barriere02.fbx` | fbx | CC0-1.0 | SHIPPABLE |
| BG-040 | Low-poly nature — plank set | D-017 | jean-charpentier-lowpoly.zip | `assets/165248/FBX/planches01.fbx`, `assets/165248/FBX/planches02.fbx`, `assets/165248/FBX/planches03.fbx` | fbx | CC0-1.0 | SHIPPABLE |
| BG-041 | Low-poly nature — grass and campfire | D-017 | jean-charpentier-lowpoly.zip | `assets/165248/FBX/herbe.fbx`, `assets/165248/FBX/feu.fbx` | fbx | CC0-1.0 | SHIPPABLE |
| BG-042 | Spring nature set — trees and bushes | D-017 | jean-charpentier-lowpoly.zip | `assets/4738760/Spring/Medium_Tree_Spring.fbx`, `assets/4738760/Spring/Small_Tree_Spring.fbx`, `assets/4738760/Spring/Big_Tree_Spring.fbx`, `assets/4738760/Spring/Big_Tree_Dead.fbx`, `assets/4738760/Spring/Medium_Tree_Dead.fbx`, `assets/4738760/Spring/Small_Tree_Dead.fbx`, `assets/4738760/Spring/Big_Box_Bush.fbx`, `assets/4738760/Spring/Medium_Box_Bush.fbx`, `assets/4738760/Spring/High_Box_Bush.fbx`, `assets/4738760/Spring/Round_Bush_Green.fbx` | fbx | CC0-1.0 | SHIPPABLE |
| BG-043 | Avramania nature terrain set (41 `mdvl_nature_*` models) | D-017 | avramania-nature-terrain.zip | `assets/19504024/Nature_Terrain/glTF/mdvl_nature_bank_01.glb`, `assets/19504024/Nature_Terrain/glTF/mdvl_nature_birch_01.glb`, `assets/19504024/Nature_Terrain/glTF/mdvl_nature_boulder_01.glb`, `assets/19504024/Nature_Terrain/glTF/mdvl_nature_bridge_plank_01.glb`, `assets/19504024/Nature_Terrain/glTF/mdvl_nature_bush_01.glb`, `assets/19504024/Nature_Terrain/glTF/mdvl_nature_cave_01.glb` | glb | CC0-1.0 | SHIPPABLE |
| BG-044 | CC0Tree props (24 FBX models) | D-017 | cc0tree.zip | `cc0tree/Assets/SM_Tree_Rounded.fbx`, `cc0tree/Assets/SM_Pine_Tree.fbx`, `cc0tree/Assets/SM_DeadPineTree.fbx` | fbx | CC0-1.0 | SHIPPABLE |
| BG-045 | Halloween biome set — graves, pumpkins, candles, coffins, crypt | D-017, B-007 | kaykit-halloween.zip | `kaykit-halloween/addons/kaykit_halloween_bits/Assets/gltf/grave_A.gltf`, `…/grave_B.gltf`, `…/gravestone.gltf`, `…/pumpkin_orange.gltf`, `…/pumpkin_yellow.gltf`, `…/pumpkin_orange_jackolantern.gltf`, `…/candle.gltf`, `…/candle_melted.gltf`, `…/coffin.gltf`, `…/coffin_decorated.gltf`, `…/crypt.gltf`, `…/skull.gltf`, `…/ribcage.gltf`, `…/bone_A.gltf`, `…/bone_B.gltf`, `…/bone_C.gltf`, `…/lantern_standing.gltf`, `…/lantern_hanging.gltf`, `…/shrine.gltf`, `…/shrine_candles.gltf`, `…/arch.gltf`, `…/arch_gate.gltf`, `…/fence.gltf`, `…/fence_gate.gltf`, `…/tree_dead_large_decorated.gltf`, `…/tree_dead_medium.gltf`, `…/path_A.gltf`, `…/floor_dirt.gltf` | gltf | CC0-1.0 | SHIPPABLE |

---

## 9. EFFECTS

`REQ-D-016` (skid dust, landing puff, hit flash, item emergence, environmental particles,
boss telegraphs). Effects are billboarded 2D sprites or masked textures — **not**
procedural geometry. Note the licence split: the Kenney sub-packs `light-masks/`,
`foliage-sprites/`, `smoke-particles/` carry a read CC0 `License.txt`; the `oga-*`
sub-packs in the same archive carry only `SOURCE.md` and are therefore **PENDING**.

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| FX-001 | Skid dust / landing puff — black smoke sprite sequence | D-016 | 07-vfx.zip | `smoke-particles/PNG/Black smoke/blackSmoke00.png` … `blackSmoke07.png` | png | CC0-1.0 | SHIPPABLE |
| FX-002 | Item emergence / explosion burst — ground explosion sequence | D-016, D-006 | 07-vfx.zip | `smoke-particles/PNG/Black smoke/blackSmoke00.png` (shared emitter) | png | CC0-1.0 | SHIPPABLE |
| FX-003 | Hit flash / glow mask | D-016 | 07-vfx.zip | `light-masks/Default/circle_a.png` | png | CC0-1.0 | SHIPPABLE |
| FX-004 | Hit flash — streak variant | D-016 | 07-vfx.zip | `light-masks/Default/circle_a_streaks.png` | png | CC0-1.0 | SHIPPABLE |
| FX-005 | Boss telegraph — concentric ring mask | D-016, C-015 | 07-vfx.zip | `light-masks/Default/circle_rings_a.png` | png | CC0-1.0 | SHIPPABLE |
| FX-006 | Item emergence sparkle mask | D-016, D-006 | 07-vfx.zip | `light-masks/Default/circle_b.png` | png | CC0-1.0 | SHIPPABLE |
| FX-007 | Environmental particle mask | D-016 | 07-vfx.zip | `light-masks/Default/circle_c.png` | png | CC0-1.0 | SHIPPABLE |
| FX-008 | Hazard warning mask | D-016, D-012 | 07-vfx.zip | `light-masks/Default/circle_d.png` | png | CC0-1.0 | SHIPPABLE |
| FX-009 | Environmental particle — foliage sprite | D-016 | 07-vfx.zip | `foliage-sprites/PNG/Flat/sprite_0001.png` | png | CC0-1.0 | SHIPPABLE |
| FX-010 | Screen-transition light mask | D-017 | 07-vfx.zip | `light-masks/Default/circle_a_noise.png` | png | CC0-1.0 | SHIPPABLE |
| FX-011 | Screen-transition light mask (streaks + noise) | D-017 | 07-vfx.zip | `light-masks/Default/circle_a_streaks_noise.png` | png | CC0-1.0 | SHIPPABLE |
| FX-012 | Light mask — alternate profile | D-016 | 07-vfx.zip | `light-masks/Default/circle_b_noise.png` | png | CC0-1.0 | SHIPPABLE |
| FX-013 | Level-debug boundary overlay | E-010, E-014 | godot-asset-library-3d-animation.zip | `assets/godot/59/debug-border.png` | png | CC0-1.0 | SHIPPABLE |
| FX-014 | Level-debug fill overlay | E-010, E-014 | godot-asset-library-3d-animation.zip | `assets/godot/59/debug-fill.png` | png | CC0-1.0 | SHIPPABLE |
| FX-015 | Collision-path debug icon | E-010 | godot-asset-library-3d-animation.zip | `assets/godot/56/CollisionPath2D_icon.png` | png | CC0-1.0 | SHIPPABLE |
| FX-016 | Inverted light mask (silhouette / shadow pass) | D-016 | shorepine-kenney.zip | `shorepine-kenney/2d/Light Masks/Inverted/circle_a.png` | png | CC0-1.0 | SHIPPABLE |
| FX-017 | Explosion sprite sequence (optional 2D enhancement layer) | D-016 | 07-vfx.zip | `oga-explosion/` — directory contains `SOURCE.md` only for licence | png | unverified (per-file) | PENDING |

---

## 10. HUD, MENUS, ICONS, FONTS, INPUT PROMPTS

`REQ-D-004` (HUD), `REQ-D-018` (pause/options/rebind/save-slot UI), `REQ-D-019`
(tutorial prompts), `REQ-D-020` (accessibility), `REQ-A-001` and `REQ-E-015` (input).

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| HUD-001 | HUD panel frame (nine-slice) | D-004, D-018 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/panel_beige.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-002 | HUD panel frame — blue variant | D-004 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/panel_blue.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-003 | HUD panel frame — brown variant | D-004 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/panel_brown.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-004 | HUD inset panel | D-004 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/panelInset_beige.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-005 | HUD health bar — horizontal back (left) | D-004 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/barBack_horizontalLeft.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-006 | HUD health bar — horizontal back (mid) | D-004 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/barBack_horizontalMid.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-007 | HUD health bar — horizontal back (right) | D-004 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/barBack_horizontalRight.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-008 | HUD health bar — fill (blue) | D-004 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/barBlue_horizontalBlue.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-009 | HUD health bar — fill (green) | D-004 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/barGreen_horizontalLeft.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-010 | HUD health bar — fill (red) | D-004 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/barRed_horizontalLeft.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-011 | HUD timer bar — vertical back | D-004, B-008 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/barBack_verticalTop.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-012 | HUD timer bar — vertical fill | D-004, B-008 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/barBlue_verticalMid.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-013 | HUD arrow indicator — left | D-004 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/arrowBeige_left.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-014 | HUD arrow indicator — right | D-004 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/arrowSilver_right.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-015 | HUD confirm tick icon | D-018 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/iconCheck_beige.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-016 | HUD cancel cross icon | D-018 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/iconCross_grey.png` | png | CC0-1.0 | SHIPPABLE |
| HUD-017 | HUD circle badge | D-004 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/iconCircle_blue.png` | png | CC0-1.0 | SHIPPABLE |
| MN-001 | Menu button — long, beige | D-018 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/buttonLong_beige.png` | png | CC0-1.0 | SHIPPABLE |
| MN-002 | Menu button — long, beige, pressed state | D-018 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/buttonLong_beige_pressed.png` | png | CC0-1.0 | SHIPPABLE |
| MN-003 | Menu button — round, blue | D-018 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/buttonRound_blue.png` | png | CC0-1.0 | SHIPPABLE |
| MN-004 | Menu button — square, brown | D-018 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/buttonSquare_brown.png` | png | CC0-1.0 | SHIPPABLE |
| MN-005 | Menu button — square, grey (disabled read) | D-018, D-020 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/buttonSquare_grey.png` | png | CC0-1.0 | SHIPPABLE |
| MN-006 | Menu frame — fantasy border | D-018 | shorepine-kenney.zip | `shorepine-kenney/ui/Fantasy UI Borders/Border/` (border set) | png | CC0-1.0 | SHIPPABLE |
| MN-007 | Menu frame — fantasy panel | D-018 | shorepine-kenney.zip | `shorepine-kenney/ui/Fantasy UI Borders/Panel/` (panel set) | png | CC0-1.0 | SHIPPABLE |
| MN-008 | Menu divider — fantasy | D-018 | shorepine-kenney.zip | `shorepine-kenney/ui/Fantasy UI Borders/Divider/` (divider set) | png | CC0-1.0 | SHIPPABLE |
| MN-009 | Menu cursor — hand, blue | D-018 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/cursorHand_blue.png` | png | CC0-1.0 | SHIPPABLE |
| MN-010 | Menu cursor — sword, gold | D-018 | shorepine-kenney.zip | `shorepine-kenney/ui/UI Adventure Pack/cursorSword_gold.png` | png | CC0-1.0 | SHIPPABLE |
| MN-011 | Mobile/touch control sprite (virtual stick + buttons) | D-018, A-001 | shorepine-kenney.zip | `shorepine-kenney/ui/Mobile Controls/Sprites/` (sprite set) | png | CC0-1.0 | SHIPPABLE |
| IC-001 | Icon — arrow up | D-004, B-009 | shorepine-kenney.zip | `shorepine-kenney/icons/Game Icons/White/1x/arrowUp.png` | png | CC0-1.0 | SHIPPABLE |
| IC-002 | Icon — arrow down | D-004 | shorepine-kenney.zip | `shorepine-kenney/icons/Game Icons/White/1x/arrowDown.png` | png | CC0-1.0 | SHIPPABLE |
| IC-003 | Icon — arrow left | D-004 | shorepine-kenney.zip | `shorepine-kenney/icons/Game Icons/White/1x/arrowLeft.png` | png | CC0-1.0 | SHIPPABLE |
| IC-004 | Icon — arrow right | D-004 | shorepine-kenney.zip | `shorepine-kenney/icons/Game Icons/White/1x/arrowRight.png` | png | CC0-1.0 | SHIPPABLE |
| IC-005 | Icon — audio on | D-020, D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Game Icons/White/1x/audioOn.png` | png | CC0-1.0 | SHIPPABLE |
| IC-006 | Icon — audio off | D-020, D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Game Icons/White/1x/audioOff.png` | png | CC0-1.0 | SHIPPABLE |
| IC-007 | Icon — menu bars | D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Game Icons/White/1x/barsHorizontal.png` | png | CC0-1.0 | SHIPPABLE |
| IC-008 | Icon — gamepad button A | D-018, A-001 | shorepine-kenney.zip | `shorepine-kenney/icons/Game Icons/White/1x/buttonA.png` | png | CC0-1.0 | SHIPPABLE |
| IC-009 | Icon — gamepad button B | D-018, A-001 | shorepine-kenney.zip | `shorepine-kenney/icons/Game Icons/White/1x/buttonB.png` | png | CC0-1.0 | SHIPPABLE |
| IC-010 | Icon — gamepad left bumper | D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Game Icons/White/1x/buttonL.png` | png | CC0-1.0 | SHIPPABLE |
| IC-011 | Icon — gamepad right bumper | D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Game Icons/White/1x/buttonR.png` | png | CC0-1.0 | SHIPPABLE |
| IC-012 | Icon set — board-game icons (64 px and 128 px) | B-009, D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Board Game Icons/Default (64px)/` (icon set) | png | CC0-1.0 | SHIPPABLE |
| IN-001 | Input prompt — keyboard A | A-001, D-018, E-015 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Keyboard & Mouse/keyboard_a.png` | png | CC0-1.0 | SHIPPABLE |
| IN-002 | Input prompt — keyboard B | A-001, D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Keyboard & Mouse/keyboard_b.png` | png | CC0-1.0 | SHIPPABLE |
| IN-003 | Input prompt — keyboard X | A-001, D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Keyboard & Mouse/keyboard_x.png` | png | CC0-1.0 | SHIPPABLE |
| IN-004 | Input prompt — keyboard Y | A-001, D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Keyboard & Mouse/keyboard_y.png` | png | CC0-1.0 | SHIPPABLE |
| IN-005 | Input prompt — keyboard space | A-001, D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Keyboard & Mouse/keyboard_space.png` | png | CC0-1.0 | SHIPPABLE |
| IN-006 | Input prompt — keyboard shift | A-001, D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Keyboard & Mouse/keyboard_shift.png` | png | CC0-1.0 | SHIPPABLE |
| IN-007 | Input prompt — keyboard ctrl | A-001, D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Keyboard & Mouse/keyboard_ctrl.png` | png | CC0-1.0 | SHIPPABLE |
| IN-008 | Input prompt — keyboard enter | A-001, D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Keyboard & Mouse/keyboard_enter.png` | png | CC0-1.0 | SHIPPABLE |
| IN-009 | Input prompt — keyboard escape | A-001, D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Keyboard & Mouse/keyboard_escape.png` | png | CC0-1.0 | SHIPPABLE |
| IN-010 | Input prompt — keyboard tab | A-001, D-018 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Keyboard & Mouse/keyboard_tab.png` | png | CC0-1.0 | SHIPPABLE |
| IN-011 | Input prompt — generic controller button | A-001, E-015 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Generic/Double/generic_button.png` | png | CC0-1.0 | SHIPPABLE |
| IN-012 | Input prompt — generic controller button, pressed | A-001, E-015 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Generic/Double/generic_button_pressed.png` | png | CC0-1.0 | SHIPPABLE |
| IN-013 | Input prompt — generic trigger | A-001, E-015 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Generic/Double/generic_button_trigger_a.png` | png | CC0-1.0 | SHIPPABLE |
| IN-014 | Input prompt — generic button, circle | A-001 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Generic/Double/generic_button_circle.png` | png | CC0-1.0 | SHIPPABLE |
| IN-015 | Input prompt — generic button, square | A-001 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Generic/Double/generic_button_square.png` | png | CC0-1.0 | SHIPPABLE |
| IN-016 | Input prompt — keyboard/mouse set, double-line variant | A-001 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Keyboard & Mouse/Double/keyboard_a.png` | png | CC0-1.0 | SHIPPABLE |
| IN-017 | Input prompt — **trademark-free families only** (Generic, Keyboard & Mouse) | A-001, E-015 | shorepine-kenney.zip | `shorepine-kenney/icons/Input Prompts/Generic/`, `…/Keyboard & Mouse/` (per-family directories) | png | CC0-1.0 | SHIPPABLE |
| FT-001 | HUD and menu typeface — Kenney Vector Future (regular) | D-004, D-018, E-013 | 03-scifi.zip | `space-shooter-remastered/Bonus/kenvector_future.ttf` | ttf | CC0-1.0 | SHIPPABLE |
| FT-002 | Title and large-heading typeface — Kenney Vector Future (thin) | D-018, E-013 | 03-scifi.zip | `space-shooter-remastered/Bonus/kenvector_future_thin.ttf` | ttf | CC0-1.0 | SHIPPABLE |

---

## 11. AUDIO

**The entire audio corpus in the repository is **78 audio file paths**, resolving to **66 unique sounds** — 52 `.ogg` (40 Kenney Desert Shooter + 12 `Fantozzi` footsteps), 12 `.flac` (the same 12 footsteps, each present at **two** paths) and 2 `.wav` (gunshot files no cue needs). **52 `.ogg` ship****, all CC0. There is **no music**.

| asset_id | element | REQ ids served | pack | exact path | format | licence | status |
|---|---|---|---|---|---|---|---|
| AU-001 | Jump — 6 variants | A-003, D-015 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/jump-a.ogg` … `jump-f.ogg` | ogg | CC0-1.0 | SHIPPABLE |
| AU-002 | Coin pickup — 4 variants | D-003, D-015 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/coin-a.ogg` … `coin-d.ogg` | ogg | CC0-1.0 | SHIPPABLE |
| AU-003 | Player hurt — 5 variants | A-019, D-015 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/hurt-a.ogg` … `hurt-e.ogg` | ogg | CC0-1.0 | SHIPPABLE |
| AU-004 | Fall — 2 variants | A-005, D-015 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/fall-a.ogg`, `…/fall-b.ogg` | ogg | CC0-1.0 | SHIPPABLE |
| AU-005 | Explosion — 3 variants | C-013, D-015 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/explosion-a.ogg` … `explosion-c.ogg` | ogg | CC0-1.0 | SHIPPABLE |
| AU-006 | Death / game-over — 4 variants | A-019, B-016, D-015 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/lose-a.ogg` … `lose-d.ogg` | ogg | CC0-1.0 | SHIPPABLE |
| AU-007 | Movement — 4 variants | A-002, D-015 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/move-a.ogg` … `move-d.ogg` | ogg | CC0-1.0 | SHIPPABLE |
| AU-008 | UI select | D-018, D-015 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/select-a.ogg` | ogg | CC0-1.0 | SHIPPABLE |
| AU-009 | UI error / invalid action — 3 variants | D-018, D-015 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/error-a.ogg` … `error-c.ogg` | ogg | CC0-1.0 | SHIPPABLE |
| AU-010 | Shoot / projectile fire — 8 variants | A-020, C-010, D-015 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/shoot-a.ogg` … `shoot-h.ogg` | ogg | CC0-1.0 | SHIPPABLE |
| AU-011 | Gunshot | C-010, D-015 | fps-asset-kit.zip | `fps-asset-kit/sfx/gunshots/game_gunshot.wav` | wav | CC0-1.0 | SHIPPABLE |
| AU-012 | Sniper shot | C-010, D-015 | fps-asset-kit.zip | `fps-asset-kit/sfx/gunshots/sniper_shot.wav` | wav | CC0-1.0 | SHIPPABLE |
| AU-013 | Footstep — sand, 6 variants (FLAC set A) | A-002, D-015 | fps-asset-kit.zip | `fps-asset-kit/sfx/footsteps_flac/Fantozzi-SandL1.flac`, `…SandL2.flac`, `…SandL3.flac`, `…SandR1.flac`, `…SandR2.flac`, `…SandR3.flac` | flac | CC0-1.0 | SHIPPABLE |
| AU-014 | Footstep — stone, 6 variants (FLAC set A) | A-002, D-015 | fps-asset-kit.zip | `fps-asset-kit/sfx/footsteps_flac/Fantozzi-StoneL1.flac`, `…StoneL2.flac`, `…StoneL3.flac`, `…StoneR1.flac`, `…StoneR2.flac`, `…StoneR3.flac` | flac | CC0-1.0 | SHIPPABLE |
| AU-015 | Footstep — sand, 6 variants (FLAC set B) | A-002, D-015 | fps-asset-kit.zip | `fps-asset-kit/sfx/footsteps/Fantozzi-footsteps/flac/Fantozzi-SandL1.flac` … `Fantozzi-SandR3.flac` | flac | CC0-1.0 | SHIPPABLE |
| AU-016 | Footstep — stone, 6 variants (FLAC set B) | A-002, D-015 | fps-asset-kit.zip | `fps-asset-kit/sfx/footsteps/Fantozzi-footsteps/flac/Fantozzi-StoneL1.flac` … `Fantozzi-StoneR3.flac` | flac | CC0-1.0 | SHIPPABLE |
| AU-017 | Footstep — sand, 6 variants (OGG) | A-002, D-015 | fps-asset-kit.zip | `fps-asset-kit/sfx/footsteps/Fantozzi-footsteps/ogg/Fantozzi-SandL1.ogg` … `Fantozzi-SandR3.ogg` | ogg | CC0-1.0 | SHIPPABLE |
| AU-018 | Footstep — stone, 6 variants (OGG) | A-002, D-015 | fps-asset-kit.zip | `fps-asset-kit/sfx/footsteps/Fantozzi-footsteps/ogg/Fantozzi-StoneL1.ogg` … `Fantozzi-StoneR3.ogg` | ogg | CC0-1.0 | SHIPPABLE |
| AU-019 | **Region music cues — 8 themes + boss theme + finale** | D-015, B-001, B-007 | — | *no music file exists anywhere in the 16.16 GB corpus* — gap `G-05` | — | — | **GAP** |
| AU-020 | **Ambience beds — wind, water, fire, cave, forge, storm** | D-015, B-007 | — | *no ambience loop exists in the corpus — **derived in the mixer** from the 52 shipped `.ogg` by randomised, pitch-preserving one-shot scheduling* — gap `G-06` (ADOPTED option (c)) | — | — | **DERIVED** |
| AU-021 | **Tonal UI set — confirm, deny, pause, save, load** | D-018, D-020 | fps-buildings-env-kit.zip | `fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/select-a.ogg` (every positive action) and `…/error-a.ogg` (every negative action) — **reused from `AU-008` / `AU-009`**; no new file — gap `G-07` (ADOPTED option (c)) | ogg | CC0-1.0 | **SHIPPABLE** |
| AU-022 | **Voice / announcer** | D-015 | — | *no voice assets in the corpus — **out of scope**; announcements are delivered as text cards in `FT-001`* — gap `G-08` (ADOPTED option (c)) | — | — | **OUT_OF_SCOPE** |

---

## 12. PER-CATEGORY COVERAGE

Counts are **manifest rows**, and where a row names a family the family size is given in
brackets. "Distinct meshes" counts unique file paths, not rows.

### 12.1 Player avatars — 16 rows
Four original profiles (**Tallow**, **Brindle**, **Sable**, **Moth**) plus **Vellum** (the
projectile/caster power-up form), each on a distinct real rig.

| Rig family | Count | Clips | Licence |
|---|---|---|---|
| KayKit Adventurers — `Barbarian`, `Knight`, `Mage`, `Rogue`, `Rogue_Hooded` | 5 | 76 each | CC0-1.0 |
| KayKit Skeletons — `Skeleton_Minion`, `Skeleton_Rogue`, `Skeleton_Mage`, `Skeleton_Warrior` | 4 | 95 each | CC0-1.0 |
| KayKit Character Animations 1.2 — `KayKit_AnimatedCharacter_v1.2` | 1 | 30 (incl. `Climbing`) | CC0-1.0 |
| Quaternius Ultimate Animated Character — 50 rig files, 12 families | 50 | 17 each | CC0-1.0 |
| Quaternius Ultimate Animated Animals | 12 | 12–13 | CC0-1.0 |
| Quaternius animated mech — `George`, `Leela`, `Mike`, `Stan` | 4 | 18 (`Leela`) | CC0-1.0 |
| Kenney skinned characters — platformer 5, mini-characters 12, mini-arcade 2, mini-dungeon 2, mini-market 1, mini-skate 2, mini-forest 1, mini-arena 1 | 26 | 25 / 32 | CC0-1.0 |
| Kenney node-animated characters — blocky 18, prototype 7, cube-pets 24, graveyard 5 | 54 | 8 / 27 / 32 / 35 | CC0-1.0 |
| Kenney animated interactive props — factory 11, building 8, prototype 18, blaster 3, hexagon 3, modular-space 2, modular-dungeon 2, holiday 2, platformer 8, survival 1, pirate 1, mini-dungeon 3, mini-arcade 4, mini-market 2 | 70 | 1 / 3 | CC0-1.0 |
| holokat — `warrior-base-rigged` | 1 | 1 (`RigNeutral`) | MIT |
| barnabe wild rigged character | 1 | — | CC0-1.0 |

**Totals, measured:** Kenney contributes **150 animated models** of its 4,812 GLB —
**80 characters** (26 skinned, 54 node-animated) and **70 animated interactive props**.
Across every pack there are **158 animated character and animal rigs** (80 Kenney + 78
KayKit / Quaternius / holokat / barnabe) and **228 animated models** in total.

### 12.2 Enemies — 60 rows, 60 archetypes, 52 primary meshes
Every archetype in the taxonomy is covered by a named rig. The `shell retract/kick`
archetype was a **GAP** and is now **resolved** — see **G-01 option (a′)**: it ships
`mini-characters/character-female-b.glb` with a uniform-scale retract, so **no archetype
in the roster is left without a file**. The 60 shipped rows draw on **52
primary meshes** (53 distinct file paths, two of them composite secondaries:
`platformer/fence-rope.glb` and `platformer/flag.glb`). Measured breakdown of the 51:
**Kenney cube-pets 20 · Kenney platformer kit 7 · other Kenney kits 15 · KayKit 5 ·
Quaternius 2 · stylised vegetation 1.**

### 12.3 Bosses — 24 rows, 35 distinct file paths
10 pattern archetypes, 9 campaign encounters (8 regions + finale), 4 arena dressing
meshes and 1 reward mesh — **24 primary boss bodies** drawing on **35 distinct file
paths**, because three bosses are **composites of library assets**: the mobile airship
(6 Kenney `space/` parts), the regional airship (6 parts) and the R2 catapult tower
(2 KayKit hex parts). Compositing library assets is permitted; fabricating is not.

### 12.4 Companions and mounts — 14 rows
4 mount rigs (2 equine, 1 flying, 1 small-companion family), 3 NPC rigs, 6 carryable
object meshes (crate, barrel, chest, boulder, strong crate, item crate), 1 rideable prop.

### 12.5 Projectiles — 9 rows
Cannonball, arrow (×2 scales), boomerang, spear, sword, grenade, boulder, shield disc.

### 12.6 Terrain and materials — 56 rows
The Kenney `platformer` kit (153 models) contributes **78 terrain block variants** —
measured as **39 `block-grass*` + 39 `block-snow*`** (large, narrow, long, low, corner,
edge, curve, curve-half, curve-low, hexagon, low-hexagon, the overhang family, slope,
large-slope, large-tall) — plus 3 `block-moving*` variants; the `hexagon` kit
contributes 72 models; KayKit medieval hex contributes 221 glTF; `modular-dungeon` 39;
`modular-cave` 40; `building` 79; `nature` 329; KayKit dungeon remastered 203.
**PBR materials: 24 sets** in `fps-asset-kit.zip` (each with Color, NormalDX, NormalGL,
Roughness, AmbientOcclusion, Displacement, Metalness) **plus 80 sets** in
`ambientcg-cc0-pbr-materials.zip` — **104 CC0 material sets** in total.

### 12.7 Platforms — 20 rows
### 12.8 Hazards — 20 rows
### 12.9 Pickups and power-ups — 17 rows
### 12.10 Keys, locks, doors, portals — 22 rows
**12 of the 22 carry an authored animation clip bank** (`open/close/open-and-close` on the
doors and gates). The other 10 are static meshes — lock plate, the two open-door states,
the portal arch, pipe, three ladders, the rope line and the hex gate — whose behaviour is
a transform or a state change rather than a clip.

### 12.11 Switches — 16 rows
**10 of the 16 are animated** with the `toggle-on/toggle-off/toggle` clip bank (both
platformer buttons, four factory buttons, both factory levers, both prototype levers and
the prototype floor button). The remaining 6 — the factory indicator lamp, the
space-station wall switch and the four coloured switch flags — are static meshes read as
state.

### 12.12 Moving platforms — 13 rows
### 12.13 Animated interactive props — 27 rows
**16 of the 27 carry an authored Kenney clip bank** — the doors, gates, chests, traps,
pistons, crates, buttons and mill sails are already animated in the source art. The
other 11 (spring, bump block, skateboard, flag, sign, pennant, two conveyors, three
crates) are static meshes whose behaviour is a material or state change.

### 12.14 Skyboxes — 15 rows
**80 PolyHaven CC0 HDR** scenes, **4 more HDR** in the environment kit, **5 Kenney PNG**
skyboxes and **5 more Kenney space PNG** skyboxes — **94 distinct skyboxes**.

### 12.15 Backgrounds — 45 rows
3D parallax layers (hex buildings ×10, hex landforms ×5, nature trees ×2), 2D parallax
bands (5), water/gradient/blend textures (7), stylised vegetation (9), low-poly nature
(6 sets), Avramania terrain, CC0Tree, and the KayKit Halloween biome set (30 models).

### 12.16 Effects — 17 rows (16 SHIPPABLE, 1 PENDING)
### 12.17 HUD — 17 rows
### 12.18 Menus — 11 rows
### 12.19 Icons — 12 rows
### 12.20 Input prompts — 17 rows
**The corpus holds two prompt sets, and only one of them ships.** The flat set
`kenney-cc0-game-art-packs.zip!assets/kenney/input-prompts/` holds **2,733 files**
(1,958 PNG + 744 SVG + 31 TXT) and is **measured, not shipped**: its families carry
console-manufacturer trademarks. The **shipped** set is
`shorepine-kenney.zip!icons/Input Prompts/Generic/` (**74 PNG**) and
`shorepine-kenney.zip!icons/Input Prompts/Keyboard & Mouse/` (**516 PNG**) — **590
glyph files** in total. The branded families in that pack (GameCube, Switch, Switch 2,
Wii, WiiU, PlayStation, Steam Deck, Playdate, Meta Quest, and every other
console-manufacturer family) are **excluded from the shipped set** by the trademark
decision, not by a licence gap; `IN-017` registers only the two trademark-free
families, and the licence gate fails the build if a row resolves into a branded
directory.

### 12.21 Fonts — 2 rows
**The only fonts in the corpus.** Kenney Vector Future regular and thin, CC0, both in
`03-scifi.zip`. *Correction to ASSET-SURVEY §4: the survey names a Kenney pixel font
inside `10-kenney-collection.zip`; that archive contains **no** `.ttf`, `.otf` or `.woff`
member (verified by full-member listing). The survey's font conclusion still holds — the
HUD typeface is resolved — but there is no second family.*

### 12.22 Audio — 22 rows, **66 unique sounds (78 paths), 52 `.ogg` ship, 0 music**
| Group | Files | Path root |
|---|---|---|
| Kenney Desert Shooter SFX | 40 | `fps-buildings-env-kit/military/kenney-desert-shooter-pack/Sounds/` |
| Fantozzi footsteps (FLAC set A) | 12 | `fps-asset-kit/sfx/footsteps_flac/` |
| Fantozzi footsteps (FLAC set B) | 12 | `fps-asset-kit/sfx/footsteps/Fantozzi-footsteps/flac/` |
| Fantozzi footsteps (OGG) | 12 | `fps-asset-kit/sfx/footsteps/Fantozzi-footsteps/ogg/` |
| Gunshots (WAV) | 2 | `fps-asset-kit/sfx/gunshots/` |
| **Total** | **78** | **music: 0** |

*Correction to ASSET-SURVEY §3: the survey records "24 `.flac` + 24 `.ogg`". The measured
inventory is **36 `.flac` (24 in two separate directories) + 12 `.ogg` + 2 `.wav` = 50**
in `fps-asset-kit.zip`, plus 40 `.ogg` in `fps-buildings-env-kit.zip` = **78**.*

### 12.23 Requirements bound at section level

Some requirements are satisfied by a whole section rather than by one row's `REQ ids
served` cell. These bindings are stated here so that **every one of the 102 REQ ids is
bound to at least one asset id, or to an explicit "no surface" statement**.

| REQ ids | Bound at | Asset ids |
|---|---|---|
| REQ-A-002, REQ-A-003, REQ-A-004, REQ-A-005, REQ-A-007, REQ-A-013, REQ-A-014, REQ-A-015, REQ-A-016, REQ-A-019, REQ-A-020 | §1 Avatars, §2 Enemies, §4 Companions, §5 Projectiles | AV-001…AV-016, EN-001…EN-059, CO-001…CO-014, PJ-001…PJ-009 |
| REQ-A-006, REQ-A-012 | §6.1 Terrain, §6.2 Platforms | TR-001…TR-056, PF-001…PF-020 |
| REQ-A-008, REQ-A-009, REQ-A-010, REQ-A-011, REQ-A-017, REQ-A-018 | §6.3 Hazards, §7.2 Keys and portals, §4 Companions | TR-020, TR-026, TR-028, TR-030, TR-046, EN-010, EN-011, EN-015, EN-045, EN-046, HZ-001…HZ-020, KL-001…KL-022, CO-001…CO-005 |
| REQ-A-001, REQ-A-021 | §10 Input prompts, §9 Effects, §14.2 CI check | IN-001…IN-017, IC-008…IC-011, MN-011, FX-013, FX-014, FT-001 |
| REQ-B-001, REQ-B-003, REQ-B-007 | §8 Skyboxes and backgrounds, §11 Audio | SB-001…SB-015, BG-001…BG-045, AU-019 (GAP) |
| REQ-B-002, REQ-B-008, REQ-B-016, REQ-B-017 | §4 Companions, §10 HUD and menus | CO-006…CO-008, HUD-001…HUD-017, MN-001…MN-011 |
| REQ-B-004, REQ-B-005, REQ-B-018, REQ-B-020 | §7.1 Pickups, §7.5 Animated props | IP-020…IP-022, IP-002, IP-012, IP-013, IP-016, IP-017, PK-004, PK-006, PK-015 |
| REQ-B-009, REQ-B-010, REQ-B-011, REQ-B-015 | §7.2 Keys and portals, §7.3 Switches, §10 Icons | KL-001…KL-022, SW-001…SW-016, IC-001…IC-004, PF-007 |
| REQ-B-012, REQ-B-013, REQ-B-014 | §6.2 Platforms, §7.4 Moving platforms, §4 Companions | MV-008, PF-016, PF-017, CO-001, CO-003, EN-045 |
| REQ-B-019 | §3 Bosses | BS-011…BS-019 |
| REQ-C-001, REQ-C-002, REQ-C-003, REQ-C-004, REQ-C-020 | §2 Enemies — every EN row | EN-001…EN-059 |
| REQ-C-005, REQ-C-007…C-013, REQ-C-015, REQ-C-016 | §2 Enemies, §3 Bosses | EN-001…EN-059, BS-001…BS-019 |
| REQ-C-014 | §4 Companions, §5 Projectiles | EN-059, CO-009…CO-014, PJ-005, PJ-006 |
| REQ-C-017, REQ-C-018, REQ-C-019 | §3 Bosses, §7.3 Switches, §5 Projectiles | BS-002, BS-006, BS-009, BS-010, BS-012, BS-018, SW-001…SW-012, EN-038, PJ-004, PJ-009 |
| REQ-D-001, REQ-D-002, REQ-D-010, REQ-D-011, REQ-D-012, REQ-D-013, REQ-D-014 | §6, §7 | TR-001…TR-056, IP-002, IP-010, IP-025…IP-027, IP-001, KL-001…KL-022, HZ-001…HZ-020, PK-001…PK-016 |
| REQ-D-003, REQ-D-004, REQ-D-005, REQ-D-006, REQ-D-007 | §7.1 Pickups, §10 HUD | PK-001…PK-017, HUD-001…HUD-017, AV-005 |
| REQ-D-008, REQ-D-009 | §7.3 Switches, §7.4 Moving platforms, §7.5 Animated props | SW-001…SW-016, MV-001…MV-013, IP-006…IP-009 |
| REQ-D-015, REQ-D-016, REQ-D-017, REQ-D-018, REQ-D-019, REQ-D-020 | §8, §9, §10, §11 | AU-001…AU-022, FX-001…FX-017, SB-001…SB-015, BG-001…BG-045, MN-001…MN-011, IN-001…IN-017, FT-001, FT-002 |
| REQ-E-005, REQ-E-010, REQ-E-012, REQ-E-017, REQ-E-018, REQ-E-020 | §14.2 CI check, §14.3 manifest schema, §15 licence audit | §14.3 schema, FX-013…FX-015, §15.4 manifest |
| REQ-E-013, REQ-E-014 | §10 Fonts, §9 Effects | FT-001, FT-002, FX-013, FX-014, HUD-001 |
| REQ-E-009, REQ-E-015 | §10 Icons and input prompts | IC-001…IC-004, IN-001…IN-017, KL-022, PF-007 |
| REQ-B-006, REQ-B-021, REQ-E-001, REQ-E-002, REQ-E-003, REQ-E-004, REQ-E-007, REQ-E-008, REQ-E-011, REQ-E-016, REQ-E-019 | **no visual or audible surface** — data, engine or configuration only | — |

---

## 13. GAP REGISTER

Fourteen gaps. Each names the requirement it blocks and three workable options: **(a)**
an original analogue built from an existing asset, with the behavioural difference stated;
**(b)** an asset from another pack; **(c)** a scope decision.

### G-01 — Shell creature mesh — **RESOLVED 2026-10-30: option (a′), "uniform-scale retract"**
- **Blocks:** `REQ-C-006` (shell retract on stomp, kickable, chain-hits, re-emerges).
  No turtle, shell or carapace mesh exists anywhere in the 16.16 GB corpus.
- **DECISION — option (a′), an original analogue on an existing character rig.** The
  archetype is realised as a **whole-body retract**: the actor uses the named rig
  `10-kenney-collection.zip!mini-characters/character-female-b.glb` (skinned, 32 clips) and
  the retracted state is a **uniform scale of 0.6** applied to that rig — a single scalar, on
  an existing asset, at runtime. **There is no detached carapace mesh and none is required.**
  The "kick" applies a launch impulse to the *same* actor, which slides as a thrown body
  with `attacker_chain = [player]`.
  *Behavioural difference, stated:* the retracted state is a **shrinking actor**, not a
  separate shell object, so chain-hit scoring works but there is no independently
  pickable shell and no shell that survives its owner.
  **Options (a) the crab and (b) the shield disc are DECLINED**, and option (c) — dropping
  the archetype — is not needed. The entities board's `enemy.tumble_shell` implements this
  decision, and `REQ-C-006`'s acceptance test was rewritten to match.
- **(a) Original analogue:** `10-kenney-collection.zip!cube-pets/animal-crab.glb`
  (8 clips). *Behavioural difference:* the carapace is not separable, so "retract" is
  expressed as a crouch-and-flatten transform of the same mesh and "kick" applies a
  launch impulse to the same actor rather than to a detached shell. Chain-hit scoring
  works; the classic kicked-shell-as-independent-projectile behaviour does not.
- **(b) Another pack:** `10-kenney-collection.zip!mini-dungeon/shield-round.glb` as a
  detached disc. *Behavioural difference:* the shield is a separate floating prop, not a
  fitted carapace, so the retracted state reads as a disc hovering, not a shell closing.
- **(c) Scope:** drop the shell archetype and re-specify `REQ-C-006` as an
  armoured-walker archetype using `cube-pets/animal-cow.glb` with a stomp-immunity tag.

### G-02 — Swimming animation set
> **ADOPTED 2026-10-30 — option (a′), a runtime blend on an existing rig.** Swimming is
> played as a **two-way runtime blend of `Fall` (weight 0.65) and `Idle` (weight 0.35)**,
> with the blend factor driven by the vertical velocity, on the KayKit Adventurers rig
> `kaykit-adventurers.zip!.../Characters/gltf/Knight.glb`. Runtime blending for playback is
> permitted (architecture §8.3a forbids *authoring* a blended clip **file**). The player board
> already implements exactly this (`DESIGN-3-PLAYER.md` §12.2, `AG-P-04`), so the two boards
> agree. *Behavioural difference:* there is no distinct arm-pull cycle — the swim reads as a
> controlled fall. The residual absence of an authored swim clip remains declared as
> `AG-P-04` / `GAP-A10`; **it is a declared limitation, not an open decision.**

- **Blocks:** `REQ-A-009` (water zone changes gravity/drag, repeated swim stroke, surface
  interaction). No clip set in the corpus contains a swim stroke; the Kenney 25/27/32-clip
  sets and the KayKit 76/95-clip sets stop at `Fall`.
- **(a) Original analogue:** `kaykit-character-animations-1.2.zip!Animations/gltf/KayKit_AnimatedCharacter_v1.2.glb`
  with the `Fall` clip re-timed to a horizontal stroke. *Behavioural difference:* the
  stroke is a re-timed fall, so there is no distinct arm-pull cycle; the surface-exit
  pose must be a blend of `Fall` and `Idle`.
- **(b) Another pack:** `kaykit-skeletons.zip!.../Skeleton_Minion.glb` — its 95-clip set
  adds `Spawn_Air` and `Death_C_Skeletons`, which read as air-motion, but still contains
  no water locomotion. *Behavioural difference:* identical limitation.
- **(c) Scope:** implement swimming with the physics profile and a held `fall`/`Idle`
  blend, and record swim-animation absence in the verification log rather than in the
  asset register.

### G-03 — Glide and flight animation set
- **Blocks:** `REQ-A-017` (flight and gliding: charge meter, takeoff velocity, lift,
  gravity, dive, recovery, air time). No clip set covers glide, flight or a charge
  wind-up. `Jump_Full_Long` (KayKit) and `Jump_Start`/`Jump_Land` (Kenney) are the
  closest authored motions.
- **(a) Original analogue — ADOPTED.** `kaykit-adventurers.zip!.../Characters/gltf/Rogue_Hooded.glb`
  using `Jump_Full_Long` as the launch and `Fall` as the glide. *Behavioural difference:*
  there is **no wing-spread pose and no wing beat**; the glide reads as a **suspended fall**
  on the authored `Fall` clip.
  > **Corrected 2026-10-30** (Cursor senior review). An earlier draft of this option said
  > the wing beat "must be driven by the material/shader layer". That is **withdrawn** — a
  > shader-driven wing beat would be a shader-only visual, which the asset rule forbids.
  > The shipped glide uses **only named meshes and named clips**; if the absence of a wing
  > pose is unacceptable, option (c) applies. No part of the shipped presentation may be
  > produced by the shader layer.
- **(b) Another pack:** `10-kenney-collection.zip!cube-pets/animal-parrot.glb` (8 clips)
  as a wing-beat donor for the Moth profile. *Behavioural difference:* the parrot's
  8-clip vocabulary has no hover or dive, and its node-transform rig is not skinned,
  so it cannot be blended onto a KayKit skinned rig.
- **(c) Scope:** cut the glide state from Gate 4 and re-time `REQ-A-017` to a charge →
  launch → suspended-fall model with no authored wing pose.

### G-04 — Charge / wind-up animation set
> **ADOPTED 2026-10-30 — option (c).** Every charge and telegraph is expressed as a
> **HUD / light-mask cue (`FX-005` concentric ring, `FX-008` hazard warning) plus a scale ramp
> on the existing rig** (`root_node_transform`, architecture §8.3a). There is **no in-mesh
> wind-up pose**. *Consequence:* the charge duration is communicated by the telegraph's
> progress, not by an actor animation — the player board's charge meter (`TUNE-P-021`) is
> therefore the primary readout, which is a *better* cue than an animation would be.

- **Blocks:** `REQ-A-016` (spin jump, ground pound, per-profile special jump) and the
  telegraph phase of `REQ-C-010` (turret, cannon, thrower telegraph).
  No corpus clip is named `charge`, `windup` or `telegraph`.
- **(a) Original analogue:** `kaykit-adventurers.zip!.../Characters/gltf/Barbarian.glb`
  using `AttackCombo` as the wind-up. *Behavioural difference:* the wind-up is a swing,
  so the charge has no sustained hold pose and the telegraph must be timed by scaling
  the clip rather than by holding it.
- **(b) Another pack:** `10-kenney-collection.zip!factory/lever-single.glb`
  (`toggle-on`/`toggle-off`) as a telegraph pose for static emitters. *Behavioural
  difference:* a lever throw reads as a pull, not as a build-up, so it communicates
  readiness but not duration.
- **(c) Scope:** express every telegraph as a HUD/light-mask cue (FX-005, FX-008) plus a
  scale ramp on the existing rig, and drop the in-mesh wind-up pose.

### G-05 — Music
> **ADOPTED 2026-10-30 — option (c), the silent music bus.** The shipped build has a
> **silent music bus and no placeholder music**; no cue is fabricated and the build is
> releasable in that state. `REQ-D-015` is **PARTIAL** and says so, and the ship decision is
> baked into its acceptance test (architecture §10.4, master §6.3). A composer-supplied file
> enters through the same manifest slot and the same CI gate, with its licence, creator and
> URL recorded per `NFR-07`. **This is a decided scope, not an open decision.**

- **Blocks:** `REQ-D-015` (audio mixer: looping world music, boss music), `REQ-B-001`
  (`music` field in the level schema), `REQ-B-007` (per-biome audio profile) — and the
  Gate 5 deliverable "add music/art". **The corpus contains zero music files.**
- **(a) Original analogue:** none possible — music is not a mesh. The nearest available
  material is the 12 `move-a…d.ogg` ambience clips, which are short UI/footstep stings,
  not loops, and must not be looped as music.
- **(b) Another pack:** none in the corpus. Music must be **composed or licensed
  externally**; this is the only route. Any such file must be added to the corpus with
  its licence, creator and URL recorded per `NFR-07`.
- **(c) Scope:** ship the game with the **52 shipped `.ogg`** (out of 78 audio file paths
  resolving to 66 unique sounds) and a **silent music bus**, and record the absence as an
  explicit open item against Gate 5 rather than shipping placeholder music.

### G-06 — Ambience loops
> **ADOPTED 2026-10-30 — option (c).** Biome ambience is derived **in the mixer** from the
> existing 78 audio files (52 of them the shipped `.ogg`) by randomised, pitch-preserving
one-shot scheduling. *Behavioural
> difference:* the bed is granular rather than a continuous loop — it reads as texture, not
> as a sustained tone. No asset is authored and no file is pitch-shifted (the asset rule
> forbids pitch shifting; the scheduling is a mixing decision, not an asset transform).

- **Blocks:** `REQ-D-015` (looping buses) and `REQ-B-007` (per-biome audio profile).
  Wind, water, fire, cave, forge and storm loops do not exist.
- **(a) Original analogue:** `fps-asset-kit.zip!fps-asset-kit/sfx/footsteps_flac/Fantozzi-SandL1.flac`
  et al. re-voiced per biome. *Behavioural difference:* these are one-shots with a
  transient attack; a loop cross-faded from them reads as periodic texture, not a bed.
- **(b) Another pack:** none in the corpus.
- **(c) Scope:** derive biome ambience in-engine from the existing 78 audio files
  (52 of them the shipped `.ogg`) through
  randomised, **pitch-preserving** one-shot scheduling (a mixing decision, not an asset
  decision), and document it in the verification log.

### G-07 — Tonal UI set
> **ADOPTED 2026-10-30 — option (c).** `select-a.ogg` is used for **every** positive menu
> action and `error-a.ogg` for **every** negative one. *Consequence:* menu feedback repeats;
> that is accepted, and the UI compensates visually (the selected item's border, per the
> Kenney UI pack). No new asset is required.

- **Blocks:** `REQ-D-018` (pause/options/rebind/save-slot UI) and `REQ-D-020` (accessibility
  feedback). The corpus has `select-a.ogg` and `error-a…c.ogg` but no confirm, deny,
  save, load or pause tones.
- **(a) Original analogue:** `fps-buildings-env-kit.zip!.../Sounds/select-a.ogg` for
  confirm and `…/error-a.ogg` for deny. *Behavioural difference:* these are already the
  right semantic poles; only save/load and pause lack a cue, and they would need a
  distinct sound to avoid menu fatigue.
- **(b) Another pack:** none in the corpus.
- **(c) Scope:** reuse `select-a.ogg` for every positive action and `error-a.ogg` for
  every negative action, accepting the repetition; no new asset.

### G-08 — Voice / announcer
> **ADOPTED 2026-10-30 — option (c), out of scope.** Announcements are delivered as **text
> cards** in the HUD font (`FT-001`), which is also the localisation-safe route
> (`REQ-E-013`). No voice asset is needed and no voice layer is shipped.

- **Blocks:** `REQ-D-015` (audio mixer) if a voice layer is in scope.
- **(a) Original analogue:** none — no speech asset exists.
- **(b) Another pack:** none in the corpus.
- **(c) Scope:** **out of scope.** Announcements are delivered as text cards in the
  existing HUD font (FT-001), which is also the localisation-safe route (`REQ-E-013`).

### G-09 — Boss phase-change animation
> **ADOPTED 2026-10-30 — option (c).** A boss phase change is a **pure data transition**
> with a HUD / light-mask telegraph (`FX-005`) and an audio sting (`AU-005` explosion
> variants). There is **no in-mesh phase animation**, and the phase boundary is read from
> the telegraph rather than from the body.

- **Blocks:** `REQ-C-015` (boss phase change as a distinct, readable state).
  No rig in the corpus carries a named phase-change or stagger clip; the closest are
  KayKit `Death_A_Pose`/`Death_B_Pose` and `Block_Hit`.
- **(a) Original analogue:** `kaykit-skeletons.zip!.../Skeleton_Warrior.glb` using
  `Block_Hit` as the stagger and `Death_A_Pose` as the phase-collapse. *Behavioural
  difference:* the collapse reads as death rather than as a phase reset, so the phase
  boundary must be signalled by HUD and light-mask cues (FX-005) instead.
- **(b) Another pack:** `10-kenney-collection.zip!graveyard/character-vampire.glb`
  (32 clips) for a re-entry flourish. *Behavioural difference:* the 32-clip set has no
  phase vocabulary at all; it is a locomotion bank.
- **(c) Scope:** make phase change a **pure data transition** with a HUD/light-mask
  telegraph, and accept that it has no in-mesh animation.

### G-10 — Wind-streak visual effect
> **ADOPTED 2026-10-30 — option (a).** The gust is the named mask
> `07-vfx.zip!light-masks/Default/circle_a_streaks.png`, stretched and scrolled as a gust band
> and **rotated to the wind vector** — a named file, oriented, not generated. *Behavioural
> difference:* it conveys "air is moving that way" through rotation rather than through
> intrinsic directional streaks. Option (b) is **declined**: it required shader deformation
> of a registered mesh, which the asset rule forbids.

- **Blocks:** `REQ-A-010` (wind volume, directional acceleration including airborne
  movement and projectile response) and the visible half of `REQ-D-012`.
  No wind streak or gust sprite exists.
- **(a) Original analogue:** `07-vfx.zip!light-masks/Default/circle_a_streaks.png`
  stretched and scrolled as a gust band. *Behavioural difference:* it is a radial glow
  mask, not a directional streak, so it conveys "air is moving" but not "air is moving
  that way" unless the mask is rotated per wind vector.
- **(b) Another pack:** `fps-buildings-env-kit.zip!…/polypizza-stylized-nature-gltf/Grass.glb`
  as the reaction cue. *Behavioural difference:* grass bend shows wind only where grass
  exists, and the bend must be driven by shader deformation of a registered mesh.
- **(c) Scope:** make wind **audio-and-physics only** at Gate 4 — telegraphed by the
  foliage response and by HZ-019 — and defer the streak sprite to GATE 5 polish.

### G-11 — Quicksand suction effect
> **ADOPTED 2026-10-30 — option (c).** Quicksand is a **material profile plus a sink
> volume**, with the surface mesh `hexagon/sand.glb` re-textured from `ambientcg`
> `Ground037`. *Consequence:* there is no suction sprite; the pull is communicated by the
> player's sink motion and by the camera. The suction sprite is deferred to post-GATE 5
> polish and is **not** required by any acceptance test.

- **Blocks:** the visual half of `REQ-A-011` (quicksand material profile).
  The surface mesh exists (`10-kenney-collection.zip!hexagon/sand.glb`); the suction
  effect does not.
- **(a) Original analogue:** `07-vfx.zip!smoke-particles/PNG/Black smoke/blackSmoke00.png`
  as a downward-sinking puff column. *Behavioural difference:* a smoke puff reads as
  steam rather than as suction; the pull itself is a physics volume, not an asset.
- **(b) Another pack:** none of the 104 PBR material sets includes a displacement-driven
  sand shader; `ambientcg` supplies `Ground037`/`Ground054`/`Ground103` colour and
  normal maps only.
- **(c) Scope:** implement quicksand as a **material profile plus a sink volume**, with
  the surface mesh re-textured from `ambientcg` `Ground037`, and defer the suction sprite.

### G-12 — Note-block tone
> **ADOPTED 2026-10-30 — option (c).** The note block is a **bumpable block that launches**;
> the pitched-note requirement is **dropped** and recorded against `REQ-D-010`'s acceptance
> evidence. Option (a) is **declined**: pitching a coin sample would be an audio transform,
> and the asset rule forbids pitch shifting. The block plays `AU-001` (the jump variants) as
> its launch cue, which is a real shipped file.

- **Blocks:** the audible half of `REQ-D-010` (springboard, bounce pad, trampoline and
  **note block**). The block mesh exists (`IP-002`); no pitched note set exists.
- **(a) Original analogue:** `fps-buildings-env-kit.zip!.../Sounds/coin-a.ogg` pitched up
  by a fixed semitone ratio per block row. *Behavioural difference:* a coin sample has a
  strong attack transient and no sustain, so it reads as a chime rather than as a
  sustained note.
- **(b) Another pack:** none in the corpus.
- **(c) Scope:** treat the note block as a **bumpable block that launches** and drop the
  pitched-note requirement, recording it against `REQ-D-010` acceptance evidence.

### G-13 — Composite boss bodies
> **ADOPTED 2026-10-30 — option (a) for the multi-headed flame and option (b) for the
> wheel-platform boss.** The multi-headed flame uses the segmented body
> `10-kenney-collection.zip!cube-pets/animal-caterpillar.glb`, whose 8 clips read as segment
> travel; the split is a **spawned secondary body**, which preserves the mechanic.
> The wheel-platform boss uses `10-kenney-collection.zip!castle/siege-ballista.glb`
> (already mapped at `BS-010`) with `nature/campfire_logs.glb` for the flame body
> (already mapped at `EN-055`). *Behavioural differences, stated:* the segments do not detach
> into independent fire projectiles, and the ballista is a **fixed armoured deck** the player
> boards by interaction rather than a platform the player rides. Both deviations are recorded
> against `REQ-C-016`'s acceptance evidence.

- **Blocks:** `REQ-C-016` for the multi-headed flame, splitting flame and wheel-platform
  boss patterns. No single authored mesh is a multi-headed creature, a splittable flame
  body, or a wheeled boss platform.
- **(a) Original analogue:** `10-kenney-collection.zip!cube-pets/animal-caterpillar.glb`
  as a segmented body for the multi-headed flame — its 8 clips read as segment travel,
  so the heads are segments. *Behavioural difference:* the segments do not detach into
  independent fire projectiles; the split must be a spawned secondary body.
- **(b) Another pack:** `10-kenney-collection.zip!castle/siege-ballista.glb` for the
  wheel-platform boss (already mapped at BS-010) and
  `10-kenney-collection.zip!nature/campfire_logs.glb` for the flame body (already mapped
  at EN-055). *Behavioural difference:* the ballista is a static emplacement with a
  demolition variant, not an armoured platform with a rideable deck.
- **(c) Scope:** deliver these three patterns as **mechanically distinct encounters that
  reuse a single boss body with different attack sets**, and record the visual deviation
  against `REQ-C-016` acceptance evidence.

### G-14 — Font family coverage for localisation
> **ADOPTED 2026-10-30 — option (c).** The shipped locale set is **restricted to Latin-1**,
> and the RTL / CJK limitation is recorded in the verification log. The corpus holds two
> weights of one family (`FT-001`, `FT-002`) and no second family, so no fallback is
> possible. `REQ-E-013` is re-opened if the corpus gains a second family. **This is a decided
> scope, not an open decision.**

- **Blocks:** `REQ-E-013` (font fallbacks, RTL readiness) and `NFR-08`.
  The corpus holds **two weights of one family** (FT-001, FT-002) and nothing else.
  No RTL, no CJK, no second family.
- **(a) Original analogue:** `03-scifi.zip!space-shooter-remastered/Bonus/kenvector_future_thin.ttf`
  as a lighter weight for dense text. *Behavioural difference:* a thin weight is not a
  fallback family — it cannot substitute for a missing script.
- **(b) Another pack:** none — no other fetched pack contains a `.ttf`, `.otf` or
  `.woff` member.
- **(c) Scope:** **restrict the shipped locale set to Latin-1** and record the RTL/CJK
  limitation in `docs/verification_gaps.md`; re-open `REQ-E-013` when the corpus gains a
  second family.

---

## 14. THE ASSET RULE, THE CI CHECK AND THE MANIFEST SCHEMA

### 14.1 The rule, as engineers must follow it

> Every mesh, texture, animation, skybox, background, UI element, icon and sound in the
> shipped game is a **named file that exists in the image repository**, recorded in the
> asset manifest with its exact path, pack and licence. The pipeline may **measure and
> register** an asset (world-space bounds, footprint, scale, ground offset, orientation,
> compression) — it may **never author** one. No procedural geometry, no runtime-generated
> texture, no shader-only character, no primitive-composition actor. Compositing library
> assets into a level is allowed; fabricating an asset is not. If an element has no file,
> it is an **ASSET GAP** row with the requirement it blocks — it is never filled with a
> placeholder.

Three operational clauses:

1. **Extraction is the only way in.** An asset enters the project by
   `unzip -p <pack> "<archive member path>" > assets/<target>`. A file that is not the
   byte-exact content of an archive member is a fabrication, even if it looks right.
2. **Measurement is allowed; authoring is not.** You may scale, rotate, translate,
   re-parent, re-skin (to an existing skeleton), set an existing material, compress and
   re-export an asset. You may not add a polygon, paint a texture, write a new shader
   that generates a character, or assemble an actor out of engine primitives.
3. **A gap is a decision, not a placeholder.** When no file exists, add a `GAP` manifest
   row referencing a gap id from **§13**, and take one of the three options recorded
   there. Never ship a stand-in.

### 14.2 The CI check

**Name:** `check_asset_manifest`
**Where:** `src/tools/check_asset_manifest.py`, invoked by `.github/workflows/ci.yml` as the
first job in the build matrix, before the engine import step.

**Inputs**

| Input | Path | Purpose |
|---|---|---|
| Machine-readable manifest | `src/assets/asset_manifest.json` | the file under test |
| Pack directory | `minimax-game/platformer-docs/library-packs/` | the archives to resolve against |
| Pack allow-list | `src/assets/licence_registry.json` | pack → licence, source URL, status |
| Content references | `src/content/`, `src/scenes/`, `src/assets/` (recursive) | every `asset_id` referenced by a scene, resource or data file |
| Release config | `project.godot` → `[asset_release] include_pending_assets=false` | decides whether `PENDING` assets may ship |

**The check performs these steps, in order, and fails the build on the first error:**

| # | Step | Error raised |
|---|---|---|
| 1 | Parse the manifest; assert `manifest_version` is a known integer | `ASSET-SCHEMA-VERSION` |
| 2 | Assert every entry has all required fields, non-empty | `ASSET-SCHEMA-FIELD` (field name) |
| 3 | Assert `asset_id` is unique and matches `^[A-Z]{2,3}-\d{3}$` | `ASSET-ID-DUPLICATE` / `ASSET-ID-FORMAT` |
| 4 | Assert `status` ∈ {`SHIPPABLE`, `PENDING`, `DERIVED`, `OUT_OF_SCOPE`, `GAP`}, **and** that the status agrees with the gap decision recorded for that element in **§13** | `ASSET-STATUS-INVALID` / `ASSET-STATUS-DECISION-MISMATCH` |
| 5 | Assert `pack` ∈ the pack allow-list, and the archive file exists on disk | `ASSET-PACK-UNKNOWN` / `ASSET-PACK-MISSING` |
| 6 | For `status ∉ {GAP, DERIVED, OUT_OF_SCOPE}`: build the member list of the pack once (`unzip -Z1`) and assert `path` is present | `ASSET-PATH-404` (asset_id, pack, path) |
| 7 | For `status ∉ {GAP, DERIVED, OUT_OF_SCOPE}`: extract the member and assert its `sha256` and `bytes` equal the recorded values | `ASSET-HASH-MISMATCH` |
| 8 | Assert `licence` ∈ the licence set recorded for that pack in `licence_registry.json` | `ASSET-LICENCE-MISMATCH` |
| 9 | For `status = SHIPPABLE`: assert `licence` ∈ {`CC0-1.0`, `CC0`, `MIT`} | `ASSET-LICENCE-UNVERIFIED` |
| 10 | For `status = PENDING`: assert the asset is on the pending allow-list **and** `include_pending_assets` is `false` in the release config | `ASSET-PENDING-IN-RELEASE` |
| 11 | For `status ∈ {GAP, DERIVED, OUT_OF_SCOPE}`: assert `gap_id` is present and resolves to a gap in **§13**, that `req_ids` is non-empty, and that the §13 entry carries an `ADOPTED` option | `ASSET-GAP-UNREFERENCED` / `ASSET-GAP-NO-REQ` / `ASSET-GAP-UNDECIDED` |
| 12 | Assert no entry references a pack whose licence status is `PACK_LEVEL` or `unverified` | `ASSET-PACK-NOT-CLEARED` |
| 13 | Walk `src/content/`, `src/scenes/`, `src/assets/`; for every referenced `asset_id`, assert it exists in the manifest and its `status` is `SHIPPABLE` (or `PENDING` when `include_pending_assets=true`) | `ASSET-REF-MISSING` / `ASSET-REF-STATUS` |
| 14 | Assert every `SHIPPABLE` entry has a `sha256` and an attribution record (`creator`, `source_url`) | `ASSET-PROVENANCE-INCOMPLETE` (NFR-07, REQ-E-018) |
| 15 | Emit `src/assets/licence_manifest.json` — the shipped attribution file | — |

**Exit behaviour:** any step raising an error exits non-zero with the message
`asset_id: ERROR-CODE (detail)` and a one-line summary
`asset manifest check failed: N error(s) across M entries`. The build fails; the
release packaging step must not run.

**Worked example — the check catching a fabrication.** Suppose an engineer adds a
shell-creature enemy and writes this into `src/assets/asset_manifest.json`:

```json
{
  "asset_id": "EN-002",
  "element": "Shell creature — retract on stomp, kickable",
  "req_ids": ["REQ-C-006"],
  "pack": "10-kenney-collection.zip",
  "path": "platformer/shell-turtle.glb",
  "format": "glb",
  "licence": "CC0-1.0",
  "status": "SHIPPABLE",
  "sha256": "8f14e45fceea167a5a36dedd4bea2543f5f1e0b2b7c1a2d3e4f50617283940a5b"
}
```

The check fails at **step 6**:

```
EN-002: ASSET-PATH-404 (path 'platformer/shell-turtle.glb' not present in pack '10-kenney-collection.zip')
```

There is no such member in the archive — the corpus has no shell-creature mesh with a
detached carapace. **This is the worked example of the gate catching a fabricated path,
and the resolution is now decided (`G-01` option (a′)):** the entry is repointed at the
real member `10-kenney-collection.zip!mini-characters/character-female-b.glb`, and the
retract is expressed as a **uniform scale of 0.6** on that rig. `EN-002` therefore ships
with `status: "SHIPPABLE"`; it is **not** re-declared as a GAP. Had the path existed but
not with the byte-exact member content, the gate would fail at **step 7** with
`ASSET-HASH-MISMATCH`.

### 14.3 The machine-readable manifest schema

`src/assets/asset_manifest.json`, version 1:

```json
{
  "manifest_version": 1,
  "game": "original-3d-platformer",
  "generated_from": "minimax-game/platformer-docs/DESIGN-3-ASSETS.md",
  "entries": [
    {
      "asset_id": "TR-001",
      "element": "Solid grass block",
      "req_ids": ["REQ-D-001", "REQ-A-006"],
      "pack": "10-kenney-collection.zip",
      "path": "platformer/block-grass.glb",
      "format": "glb",
      "licence": "CC0-1.0",
      "status": "SHIPPABLE",
      "gap_id": null,
      "sha256": "…64 hex chars…",
      "bytes": 10192,
      "provenance": {
        "creator": "Kenney",
        "source_url": "https://kenney.nl",
        "source_pack": "kenney-cc0-game-art-packs"
      }
    }
  ]
}
```

**Required fields on every entry**

| field | type | rule |
|---|---|---|
| `asset_id` | string | unique; `^[A-Z]{2,3}-\d{3}$` |
| `element` | string | non-empty; the design element this file serves |
| `req_ids` | array of string | non-empty; each matches `^REQ-[A-E]-\d{3}$` |
| `pack` | string or null | an archive file name in the pack allow-list; `null` when `status ∈ {"GAP", "DERIVED", "OUT_OF_SCOPE"}` |
| `path` | string or null | the **archive member path**; `null` when `status ∈ {"GAP", "DERIVED", "OUT_OF_SCOPE"}` |
| `format` | string | one of: `glb`, `gltf`, `fbx`, `blend`, `obj`, `png`, `jpg`, `hdr`, `ogg`, `wav`, `flac`, `ttf` |
| `licence` | string | one of: `CC0-1.0`, `CC0`, `MIT`, `unverified` |
| `status` | string | `SHIPPABLE` \| `PENDING` \| `DERIVED` \| `OUT_OF_SCOPE` \| `GAP` |
| `gap_id` | string or null | required and non-null iff `status ∈ {"GAP", "DERIVED", "OUT_OF_SCOPE"}`; it must resolve to a §13 entry carrying an **ADOPTED** option; else `null` |
| `sha256` | string or null | required and non-null iff `status ∈ {"SHIPPABLE", "PENDING"}`; 64 lower-case hex chars |
| `bytes` | integer or null | required and non-null iff `status ∈ {"SHIPPABLE", "PENDING"}` |
| `provenance.creator` | string | required iff `status = "SHIPPABLE"` (NFR-07) |
| `provenance.source_url` | string | required iff `status = "SHIPPABLE"` (NFR-07) |

**Family rows.** Where one manifest row names several archive members (for example
`TR-020`, the snow-block family of 12), the machine-readable form carries one entry per
member, all sharing the same `element` and `req_ids`, distinguished by `path`. The
table in this document is the human-readable roll-up.

**Validation rule, in one sentence.** *An entry is valid iff its `asset_id` is unique
and well-formed, its `status` is one of the **five** permitted values, and — when the
status is `SHIPPABLE` or `PENDING` — its `path` is a member of its `pack`, its `sha256`
and `bytes` match that member byte-for-byte, and its `licence` is the licence recorded
for that pack; when the status is `GAP`, `DERIVED` or `OUT_OF_SCOPE`, its `gap_id`
resolves to §13, that entry carries an **ADOPTED** option, and its `req_ids` names at least
one requirement.*

**A failing example, complete:**

```json
{
  "asset_id": "EN-002",
  "element": "Shell creature — retract on stomp, kickable",
  "req_ids": ["REQ-C-006"],
  "pack": "10-kenney-collection.zip",
  "path": "platformer/shell-turtle.glb",
  "format": "glb",
  "licence": "CC0-1.0",
  "status": "SHIPPABLE",
  "gap_id": null,
  "sha256": "8f14e45fceea167a5a36dedd4bea2543f5f1e0b2b7c1a2d3e4f50617283940a5b",
  "bytes": 20480,
  "provenance": {
    "creator": "Kenney",
    "source_url": "https://kenney.nl",
    "source_pack": "kenney-cc0-game-art-packs"
  }
}
```

**Why it fails:** `path` is not a member of `10-kenney-collection.zip` (no shell-creature
model with a detached carapace exists in the corpus) → **step 6, `ASSET-PATH-404`**. Had
the path existed but the bytes differed, it would fail **step 7,
`ASSET-HASH-MISMATCH`**. Had the file existed with these bytes but the licence were
`unverified`, it would fail **step 9, `ASSET-LICENCE-UNVERIFIED`**. **The corrected
entry** repoints at the real member and ships:
`"status": "SHIPPABLE", "pack": "10-kenney-collection.zip",
"path": "mini-characters/character-female-b.glb"` — the decided `G-01` option (a′),
recorded in §13.

---

## 15. LICENCE AUDIT

### 15.1 Corpus-level position

| Layer | Records | Licence | Shippable? |
|---|---|---|---|
| 3D models (catalogue) | **1,994** | **MIT 1,005 · CC0-1.0 989** | **Yes — 100% cleared** |
| 2D records (catalogue) | **114,852** | `licence_status: unverified` | **No — pending clearance** |
| Pack-level records | 34 | mixed | per pack |

### 15.2 Manifest-level counts

| Status | Rows | Share | Meaning |
|---|---|---|---|
| `SHIPPABLE` | **467** | 99.4% | licence read and confirmed CC0-1.0 / CC0 / MIT, and a named file ships |
| `PENDING` | **1** | 0.2% | `FX-017` — the `oga-explosion/` sub-pack carries `SOURCE.md` only |
| `DERIVED` | **1** | 0.2% | `AU-020` — no file; the ambience bed is produced **in the mixer** from the shipped SFX by a named, decided rule (`G-06`) |
| `OUT_OF_SCOPE` | **1** | 0.2% | `AU-022` — the need was real and a named decision removed it from the shipping scope (`G-08`, text cards) |
| `GAP` | **1** | 0.2% | `AU-019` — the music cues. **No file exists anywhere in the corpus and no decision removes the need**; the ship decision is a silent music bus (`G-05`), so the build is releasable while the row stays a visible gap |
| **Total manifest rows** | **471** | 100% | The counts above were **measured** by parsing the manifest tables, not asserted by hand |

Every `SHIPPABLE` row's licence was read from the pack's own licence file, not inferred
from the pack name:

| Licence evidence read | Covers |
|---|---|
| `shorepine-kenney.zip!shorepine-kenney/LICENSE.txt` (Kenney per-kit CC0) | all Kenney 3D, UI, icons and 2D cited from that archive |
| `kenney-cc0-game-art-packs.zip!assets/kenney/*/License.txt` | skyboxes and input prompts |
| `07-vfx.zip!light-masks/License.txt`, `!foliage-sprites/License.txt`, `!smoke-particles/license.txt` | FX rows |
| `08-tiles.zip!background-elements/License.txt` | BG-016…BG-020 |
| `05-environments.zip!foliage-pack/License.txt` | foliage sprites |
| `fps-buildings-env-kit.zip!.../kenney-desert-shooter-pack/License.txt` | AU-001…AU-010 (40 SFX) |
| `fps-asset-kit.zip!fps-asset-kit/README.md` — Fantozzi footsteps (OGA CC0) and The Free Firearm Sound Library (OGA CC0) | AU-011…AU-018 (38 audio files) |
| KayKit, Quaternius, Avramania, CC0Tree, jean-charpentier, barnabe — `CC0-1.0` in the catalogue record | all cited 3D rows |
| holokat — `MIT` in the catalogue record | BS-007 |
| ambientCG, PolyHaven — `CC0` in the pack metadata | TR-048…TR-056, SB-001…SB-015 |
| `03-scifi.zip` — Kenney Vector Future, CC0 | FT-001, FT-002 |

### 15.3 Exclusions

| Excluded set | Size | Reason | Rule |
|---|---|---|---|
| `jam-ready-assets.zip` | **1,817.1 MB** | `licence_status: PACK_LEVEL` — not cleared | **Must not be downloaded into the build workspace and must never appear in a manifest entry or the shipped bundle. The CI check raises `ASSET-PACK-NOT-CLEARED` (step 12) for any entry naming it.** |
| `EPS_Clipart.rar` | 1,098.6 MB | release `workplace-art-unverified-2026-10-05` — unverified | Excluded on sight |
| `Clipart.tar` | 615.0 MB | unverified | Excluded on sight |
| `10000.HighDefinition.PNG.Icon.Pack.rar` | 240.8 MB | unverified | Excluded on sight |
| `Samples.rar` | 144.1 MB | unverified | Excluded on sight |
| `oga-*` sub-packs inside `01`/`02`/`03`/`04`/`05`/`07`/`08` (15 in `07-vfx` alone) | — | `SOURCE.md` present, no per-pack licence | Treated as **PENDING**: usable in the build, excluded from the release bundle by `include_pending_assets=false` |
| The 114,852-record 2D corpus outside the Kenney CC0 sub-packs | — | `licence_status: unverified` | Treated as **PENDING** on the same rule |

**Exact exclusion rule, as CI implements it.**

> An asset may ship in a release bundle **iff** its manifest entry has
> `status = "SHIPPABLE"`. An entry with `status = "PENDING"` may be present in a
> developer or CI build only when `[asset_release] include_pending_assets = true` in
> `project.godot`; the release packaging step runs with that flag `false` and fails
> with `ASSET-PENDING-IN-RELEASE` if any `PENDING` entry is reachable from a shipped
> scene. An entry with `status = "GAP"` may never be referenced by any scene, resource
> or data file. No entry may name `jam-ready-assets.zip` or any release asset from
> `workplace-art-unverified-2026-10-05`.

### 15.4 Attribution and release packaging

`src/assets/licence_manifest.json` is generated by the CI check (step 15) from the
`SHIPPABLE` entries. It lists, per asset: `asset_id`, `creator`, `source_url`,
`source_pack`, `licence`, `licence_text`, `sha256` and the target path inside the
bundle. It satisfies `NFR-07` (data provenance), `REQ-E-012` (licensing metadata
blocks release packaging) and `REQ-E-018` (release audit reports zero unlicensed
assets).

---

## 16. REQ COVERAGE INDEX

All **102** requirements. Where a requirement has **no visual or audible surface**, the
row says so explicitly — that is a design fact, not an omission. Asset ids are the
manifest ids of this document.

### Board A — input and player controller (21)

| REQ | visual/audible surface | asset_ids |
|---|---|---|
| REQ-A-001 | rebind UI, key/button glyphs | IN-001…IN-017, IC-008…IC-011, MN-011 |
| REQ-A-002 | locomotion clips, movement SFX, footstep surfaces | AV-006, AV-011…AV-013, AU-007, AU-013…AU-018 |
| REQ-A-003 | jump clips, jump SFX | AV-006, AV-015, AU-001 |
| REQ-A-004 | no distinct art — same jump clip | AV-006 |
| REQ-A-005 | all movement-state clips, fall SFX | AV-006, AV-011…AV-013, AU-004 |
| REQ-A-006 | solid tile and platform art | TR-001…TR-019, TR-036…TR-047, PF-001…PF-020 |
| REQ-A-007 | facing/stomp clips, hurt SFX | AV-006, AV-011, EN-001, EN-005, AU-003 |
| REQ-A-008 | pipe, door, ladder traversal art | KL-002…KL-022 |
| REQ-A-009 | water surfaces; **swim art — runtime blend of `Fall` + `Idle` on `Knight.glb` (`G-02` a′, a declared limitation, not an open gap)** | TR-028, TR-046, BG-021…BG-023, EN-010, EN-011, HZ-013 |
| REQ-A-010 | wind volume; **wind streak — the named mask `circle_a_streaks.png` (`G-10` a)** | EN-015, HZ-019, MV-012, BG-028 |
| REQ-A-011 | material surfaces, conveyor; **quicksand — a material profile plus a sink volume (`G-11` c)** | TR-020, TR-026, TR-030, IP-023, IP-024 |
| REQ-A-012 | one-way platform art | PF-001…PF-020, MV-001…MV-013 |
| REQ-A-013 | carry clips, carryable object art | AV-006, AV-015, CO-009…CO-014 |
| REQ-A-014 | ladder art, the one climbing clip | AV-014, EN-020, KL-018…KL-021 |
| REQ-A-015 | the four original avatar rigs | AV-001…AV-004, AV-011…AV-013, AV-016 |
| REQ-A-016 | spin/ground-pound; **the charge is a HUD/light-mask cue plus a scale ramp, with no in-mesh wind-up pose (`G-04` c)** | AV-015, AV-006, EN-004, EN-050 |
| REQ-A-017 | flight/glide — **`Jump_Full_Long` to launch and `Fall` to hold (`G-03` a)** | AV-004 |
| REQ-A-018 | mount and companion art | CO-001…CO-005, EN-045, EN-046, IP-019, AV-013 |
| REQ-A-019 | hurt clips, heart, damage flashes | AV-006, AU-003, AU-006, PK-005, FX-003, FX-004 |
| REQ-A-020 | projectile meshes and fire SFX | PJ-001…PJ-009, AU-010…AU-012 |
| REQ-A-021 | debug overlay art | FT-001, HUD-001, FX-013, FX-014 |

### Board B — worlds, stages and progression (21)

| REQ | visual/audible surface | asset_ids |
|---|---|---|
| REQ-B-001 | per-level skybox, background, tiles, music | SB-001…SB-015, BG-001…BG-045, TR-001…TR-056, AU-019 (GAP) |
| REQ-B-002 | scene-state UI, NPC art | MN-001…MN-011, CO-006…CO-008 |
| REQ-B-003 | skybox and parallax layers | SB-001…SB-015, BG-001…BG-015 |
| REQ-B-004 | goal objects, portal frame | IP-020, IP-021, IP-022, KL-016 |
| REQ-B-005 | checkpoint sign, score token | IP-021, PK-004 |
| REQ-B-006 | **no visual or audible surface** — data only | — |
| REQ-B-007 | biome-specific art and audio profile | SB-001…SB-015, BG-003…BG-015, BG-044, IP-014, IP-015, TR-025…TR-030, AU-020 (DERIVED) |
| REQ-B-008 | timer bar | HUD-011, HUD-012 |
| REQ-B-009 | world-map icons, gate, bridge | IC-001…IC-004, KL-022, PF-007 |
| REQ-B-010 | warp pipe, portal frame | KL-016, KL-017 |
| REQ-B-011 | lock, key, hidden collectible | KL-001, PK-007, PK-015, TR-022 |
| REQ-B-012 | autoscroll carrier | MV-008 |
| REQ-B-013 | stairs, climb art | PF-016, PF-017, AV-014 |
| REQ-B-014 | companion-accessible exit art | CO-001, CO-003, EN-045 |
| REQ-B-015 | coloured switch flags, switch-gated block | SW-013…SW-016, TR-022 |
| REQ-B-016 | continue-screen UI, death SFX | MN-001…MN-005, AU-006 |
| REQ-B-017 | coins, score token, HUD | PK-001…PK-004, HUD-001…HUD-017, IC-008 |
| REQ-B-018 | minigame props | IP-012, IP-013, IP-016, IP-017 |
| REQ-B-019 | the nine campaign boss encounters | BS-011…BS-019 |
| REQ-B-020 | hidden collectible, jewel, HUD badge | PK-015, PK-006, HUD-017 |
| REQ-B-021 | **no visual or audible surface** — data only | — |

### Board C — entities, enemies and bosses (20)

| REQ | visual/audible surface | asset_ids |
|---|---|---|
| REQ-C-001 | actor base: every enemy and boss mesh | EN-001…EN-059, BS-001…BS-024 |
| REQ-C-002 | enemy FSM: walker, blocker, ambusher, mage, sleeper | EN-001, EN-044, EN-047, EN-051, EN-054 |
| REQ-C-003 | typed damage: armour, projectiles, hazards | EN-004, EN-023, EN-032, PJ-001…PJ-009, HZ-001…HZ-020 |
| REQ-C-004 | spawn/pool: enemy meshes, spawn SFX | EN-001…EN-059, AU-007 |
| REQ-C-005 | basic walkers | EN-001, EN-004, EN-018, EN-019, EN-021, EN-025, EN-026, EN-048, EN-050 |
| REQ-C-006 | shell creature — the shell retract is a **uniform scale of 0.6** on `EN-002` (`mini-characters/character-female-b.glb`, `G-01` option a′) | EN-002 |
| REQ-C-007 | winged hopper | EN-003, EN-045 |
| REQ-C-008 | pipe plant, aggressive variant | EN-005, EN-014, IP-006 |
| REQ-C-009 | spawner and dropper | EN-007, EN-024 |
| REQ-C-010 | turret, cannon, throwers; **the telegraph is a HUD/light-mask cue plus a scale ramp (`G-04` c)** | EN-006, EN-009, EN-017, EN-022, EN-029, EN-038, EN-039, EN-043, EN-051, EN-052, EN-055, PJ-001…PJ-009, AU-010 |
| REQ-C-011 | aquatic enemies | EN-010, EN-011, TR-028 |
| REQ-C-012 | ghost AI | EN-031, EN-035, EN-053, EN-058 |
| REQ-C-013 | parameterised hazards | EN-008, EN-012, EN-016, EN-023, EN-030, EN-033, EN-034, EN-036, EN-037, EN-040, EN-041, EN-042, EN-056, EN-057, HZ-001…HZ-020 |
| REQ-C-014 | carryable/throwable enemy and objects | EN-059, CO-009…CO-014, PJ-005, PJ-006 |
| REQ-C-015 | boss framework; **a phase change is a pure data transition with a HUD/light-mask telegraph and an audio sting (`G-09` c)** | BS-001…BS-024, FX-005 |
| REQ-C-016 | boss patterns; **the multi-headed flame is the segmented `animal-caterpillar.glb` body with a spawned secondary body, and the wheel-platform boss is `castle/siege-ballista.glb` (`G-13` a+b)** | BS-001…BS-010, BS-011…BS-019 |
| REQ-C-017 | switch-triggered boss elimination | BS-009, BS-012, BS-018, SW-001…SW-012 |
| REQ-C-018 | projectile reflection and return | BS-002, BS-006, BS-010, EN-038, PJ-004, PJ-009 |
| REQ-C-019 | boss restart, checkpoint, reward | BS-011…BS-019, IP-003…IP-005, BS-024 |
| REQ-C-020 | **no visual or audible surface** — data only | — |

### Board D — objects, items, FX, UI and audio (20)

| REQ | visual/audible surface | asset_ids |
|---|---|---|
| REQ-D-001 | tile material set | TR-001…TR-056, IP-023, IP-024 |
| REQ-D-002 | block states, payload, bounce | IP-002, IP-010, IP-025…IP-027, TR-021 |
| REQ-D-003 | collectables and score | PK-001…PK-016, BS-024 |
| REQ-D-004 | HUD | HUD-001…HUD-017, IC-001…IC-012, FT-001 |
| REQ-D-005 | power-up FSM | PK-008…PK-012, PK-017, AV-005 |
| REQ-D-006 | emerge, bounce, fall of a spawned item | IP-002, IP-026, IP-027, FX-006 |
| REQ-D-007 | negative pickup and warning cue | PK-013, HZ-016, EN-013, HUD-015 |
| REQ-D-008 | temporary world-state switches | SW-001…SW-016, TR-022, IP-006 |
| REQ-D-009 | moving platforms | MV-001…MV-013, IP-007…IP-009 |
| REQ-D-010 | springboard, bump block; **the pitched-note requirement is dropped — the block launches and plays the shipped `AU-001` jump cue (`G-12` c)** | IP-001, IP-002 |
| REQ-D-011 | keys, locks, doors, portals | KL-001…KL-022, PK-007 |
| REQ-D-012 | unified hazard events | HZ-001…HZ-020, EN-008, EN-012, EN-016, EN-023, FX-008 |
| REQ-D-013 | inventory and reserve item | PK-014, MN-001…MN-005, CO-006 |
| REQ-D-014 | goal rewards | IP-020, IP-021, IP-022, BS-023 |
| REQ-D-015 | audio mixer — **music GAP `G-05` (AU-019), ambience DERIVED `G-06` (AU-020), UI tone SHIPPABLE `G-07` (AU-021), voice OUT_OF_SCOPE `G-08` (AU-022)** | AU-001…AU-018 |
| REQ-D-016 | state and animation effects | FX-001…FX-015 |
| REQ-D-017 | parallax, palette, transitions, light | SB-001…SB-015, BG-001…BG-045, TR-023, FX-010, FX-011 |
| REQ-D-018 | pause, options, rebind, save-slot UI | MN-001…MN-011, IN-001…IN-017, HUD-015…HUD-017 |
| REQ-D-019 | tutorial prompts and signage | IP-021, FT-001, FT-002 |
| REQ-D-020 | accessibility options | IC-005, IC-006, MN-005, IN-001…IN-017, FT-001, AU-021 (SHIPPABLE) |

### Board E — engineering, content and quality (20)

| REQ | visual/audible surface | asset_ids |
|---|---|---|
| REQ-E-001 | **no visual or audible surface** — engine selection | — |
| REQ-E-002 | **no visual or audible surface** — tick separation | — |
| REQ-E-003 | **no visual or audible surface** — event bus | — |
| REQ-E-004 | **no visual or audible surface** — scene composition format | — |
| REQ-E-005 | the asset registry itself (§14.3 schema) | §14.3 manifest schema |
| REQ-E-006 | save-slot UI | MN-001…MN-005 |
| REQ-E-007 | **no visual or audible surface** — rule-set config | — |
| REQ-E-008 | **no visual or audible surface** — test runners | — |
| REQ-E-009 | world-graph editor icons | IC-001…IC-004, KL-022, PF-007 |
| REQ-E-010 | level-linter debug art and the manifest | FX-013…FX-015, §14.2 check |
| REQ-E-011 | **no visual or audible surface** — pooling budget | — |
| REQ-E-012 | licensing metadata on animation/audio refs | §14.3 manifest schema, §15.4 |
| REQ-E-013 | localisation fonts — **the shipped locale set is restricted to Latin-1, `en-GB` and `en-US` (`G-14` c)** | FT-001, FT-002 |
| REQ-E-014 | debug overlay | FX-013, FX-014, FT-001, HUD-001 |
| REQ-E-015 | controller abstraction glyphs | IN-001…IN-017, IC-008…IC-011 |
| REQ-E-016 | **no visual or audible surface** — reload semantics | — |
| REQ-E-017 | screenshot and audio smoke tests | §14.2 check, AU-001…AU-018 |
| REQ-E-018 | attribution and licence manifest | §15.4, FT-001, TR-023 |
| REQ-E-019 | **no visual or audible surface** — replay determinism | — |
| REQ-E-020 | debug tools | FX-013…FX-015, HUD-001 |

### Coverage summary

| Board | REQs | With a visual/audible surface | With no surface |
|---|---|---|---|
| A — input and player | 21 | 21 | 0 |
| B — worlds and progression | 21 | 19 | 2 |
| C — entities, enemies, bosses | 20 | 20 | 0 |
| D — objects, items, FX, UI, audio | 20 | 20 | 0 |
| E — engineering and quality | 20 | 9 | 11 |
| **Total** | **102** | **89** | **13** |

**14 gaps** are raised against **17 distinct requirements**: REQ-A-009, REQ-A-010,
REQ-A-011, REQ-A-016, REQ-A-017, REQ-B-001, REQ-B-007, REQ-C-006, REQ-C-010,
REQ-C-015, REQ-C-016, REQ-D-010, REQ-D-012, REQ-D-015, REQ-D-018, REQ-D-020,
REQ-E-013.

---

## 17. DECISIONS CARRIED FORWARD

- **Four original avatar profiles** — **Tallow** (KayKit `Barbarian`), **Brindle**
  (KayKit `Knight`), **Sable** (KayKit `Rogue`), **Moth** (KayKit `Rogue_Hooded`) — plus
  **Vellum** (KayKit `Mage`) reserved as the projectile/caster power-up form for
  `REQ-D-005`. The names are original; the meshes are CC0.
- **Composition is allowed, fabrication is not.** The mobile airship boss and the R2
  catapult-tower boss are assembled from Kenney `space/` and KayKit hex parts.
- **The 3D-first build.** The game is built from the CC0/MIT 3D corpus so the
  licence-pending 2D set stays an optional layer that a release build excludes by
  configuration.
- **Corrections to ASSET-SURVEY** are recorded where the measurement disagrees with the
  survey: the Kenney Skeletons pack holds **4** rigs, not 5; the audio corpus is
  **78 file paths resolving to 66 unique sounds — 52 `.ogg` (40 Kenney Desert Shooter +
  12 `Fantozzi` footsteps), 12 `.flac` (the same 12 footsteps, each at two paths) and
  2 `.wav` (gunshots)** — and the 52 `.ogg` are what ship, not "24 FLAC + 24 OGG"; the
  Kenney pixel font named in the survey **does not exist** in `10-kenney-collection.zip`;
  the Kenney `platformer` kit holds **78** terrain block variants (39 grass + 39 snow),
  not 106; and the 15 `oga-*` sub-packs inside `07-vfx.zip` carry `SOURCE.md` only, so
  they are **PENDING**, not cleared.
- **Decided, not open:** §13 G-01 (shell creature → option (a′)), G-05 (music → option (c), a silent music bus),
  G-11 (quicksand FX), G-13 (composite boss bodies) and G-14 (font coverage) each carry an
  **ADOPTED** option in §13. **No option remains to be chosen** — these are decisions, not
  questions, and they are binding on Gate 4 content authoring. The full list of all 14
  adopted gap resolutions is in §13 and in the master document §11.2b.

---

*End of document. Every path in this manifest was resolved against a real archive
listing or a real inventory file; every licence was read from a real licence file or a
real catalogue record; every gap names a requirement and three options.*

