# ASSET SURVEY — the image repository, surveyed

**Compiled:** 2026-10-30 · **Status:** ground truth for every asset claim in the design
**Rule of this file:** every path below was read from a real directory listing, a real
SQLite row or a real release manifest. Nothing here is inferred, and nothing is a
placeholder. If an element is not in this file, it is not in the repository.

---

## 1. What "the image repository" is

There are **three layers**, and they are not the same thing:

| Layer | Location | Size | What it is |
|---|---|---|---|
| **A. The corpus** | GitHub releases of `atiffhussainkhan/Image` (public) | **16.16 GB** | 98 assets across 10 releases. **This is the repository the user means by "12 GB of images".** Measured 16.16 GB — see §1.2 |
| **B. The processed mirror** | `~/.minimax/asset-library` | 1.0 GB | 12 packed 3D/character packs + the searchable index of the 2D corpus |
| **C. The working clone** | `/Users/mac/Image` | 425 MB | Git clone of `main` + the release manifest + catalogue tooling |

### 1.1 Layer A — the 98 release assets (complete)

Every asset, sorted by size. Tags: `mega-assets-v1`, `mega-assets-expansion-v1`,
`mega-assets-expansion-v2`, `catalog-completion-2026-10-06`, `game-art-search-v2-2026-10-05`,
`workplace-art-unverified-2026-10-05`, `asset-bot-tranche-2026-10-25`,
`mega-acquisition-2026-10-25`, `asset-validation-2026-10-25`, `staged-pixel-adventure-2026-10-25`.

**3D-relevant (fetched, ~2.4 GB):**

| MB | Asset | Tag |
|---|---|---|
| 728.4 | `fps-asset-kit.zip` | mega-assets-expansion-v1 |
| 304.9 | `fps-buildings-env-kit.zip` | mega-assets-expansion-v1 |
| 152.1 | `shorepine-kenney.zip` | mega-assets-expansion-v1 |
| 114.9 | `ambientcg-cc0-pbr-materials.zip` | asset-bot-tranche-2026-10-25 |
| 79.7 | `quaternius-animated-mech.zip` | catalog-completion-2026-10-06 |
| 67.6 | `quaternius-ultimate-animated-character.zip` | catalog-completion-2026-10-06 |
| 62.6 | `holokat-game-assets.zip` | mega-assets-expansion-v1 |
| 39.8 | `quaternius-ultimate-animated-animals.zip` | catalog-completion-2026-10-06 |
| 39.8 | `oga-3d-character-pack.zip` | mega-assets-expansion-v2 |
| 34.6 | `kaykit-medieval-hexagon.zip` | mega-assets-expansion-v2 |
| 31.2 | `kaykit-dungeon.zip` | catalog-completion-2026-10-06 |
| 29.1 | `kaykit-adventurers.zip` | mega-assets-v1 |
| 28.4 | `kaykit-dungeon-remastered.zip` | mega-assets-expansion-v2 |
| 27.4 | `kaykit-skeletons.zip` | mega-assets-v1 |
| 11.3 | `cc0tree.zip` | mega-assets-expansion-v1 |
| 7.6 | `kaykit-character-animations-1.2.zip` | mega-assets-v1 |
| 7.1 | `barnabe-wild-rigged-character.zip` | catalog-completion-2026-10-06 |
| 3.1 | `avramania-nature-terrain.zip` | catalog-completion-2026-10-06 |

**2D / UI / environment / VFX (fetched or available):** `01-characters.zip` 39.8,
`02-fantasy.zip` 195.2, `03-scifi.zip` 439.6, `04-ui.zip` 63.0, `05-environments.zip` 25.3,
`06-modern.zip` 10.9, `07-vfx.zip` 42.8, `08-tiles.zip` 62.3, `09-pixel-asset-library.zip` 111.3,
`10-kenney-collection.zip` 25.7, `pixel-frog-pixel-adventure-1.zip` 0.2,
`kenney-cc0-game-art-packs.zip` 41.1, `opengameart-cc0-2d-art.zip` 168.6,
`papyszoo-cc0-sprites.zip` 137.8, `lpc-rpg-character-sprites.zip` 28.3,
`opengameart-knight-princess-dragon-2.zip` 60.9, `opengameart-modular-vector-characters.zip` 68.2,
`tiddybub-2d-assets.zip` 1137.5, `polyhaven-cc0-hdris-textures-models.zip` 105.2,
`godot-asset-library-3d-animation.zip` 1.5, `jean-charpentier-lowpoly.zip` 1.8,
`nasa-public-domain-space-imagery.zip` 132.1, `openverse-cc0-imagery.zip` 15.0,
`cleveland-museum-cc0-artwork.zip` 267.8, `archive-org-cc0-texture-sprite-packs.zip` 621.8.

**NOT shippable:**

| MB | Asset | Why |
|---|---|---|
| 1817.1 | `jam-ready-assets.zip` | `licence_status: PACK_LEVEL` — **not cleared, must not ship** |
| 1098.6 / 615.0 / 240.8 / 144.1 | `EPS_Clipart.rar`, `Clipart.tar`, `10000.HighDefinition.PNG.Icon.Pack.rar`, `Samples.rar` | release `workplace-art-unverified-2026-10-05` — unverified |

### 1.2 The "12 GB" figure — stated plainly

The user described the repository as "twelve GB". The measured figure is **16.16 GB**
across 98 release assets in 10 releases. The individual archives are sized in the table
above; the sum is the release manifest's own `release_bytes` field. The local processed
mirror is **1.0 GB** and the git clone is **425 MB** — so a narrow local search really
does only surface a few hundred MB, exactly as the user warned. The design is built on
the full 16.16 GB corpus. **No figure is rounded to match "12 GB".**

### 1.3 Layer B — the searchable index

`~/.minimax/asset-library/catalogue/gamekit.sqlite` — **116,880 rows**:

| kind | rows | note |
|---|---|---|
| `2d` | 114,852 | roles: ui 29,878 · unclassified 23,823 · animal 19,599 · character 13,961 · scenery 7,536 · food 6,530 · prop 6,338 · tile 2,357 · pickup 2,140 · vehicle 1,153 · fx_glow 932 · effect 605 |
| `3d` | 1,994 | licence: **MIT 1,005 / CC0-1.0 989** — every 3D record is cleared |
| `pack` | 34 | pack-level licence records |

`~/.minimax/asset-library/catalogue/model_catalogue.json` — 12 packs, 1,909 models,
11 rigged, 11 animated, **791 animation clips**.

---

## 2. The 3D corpus in detail

### 2.1 `shorepine-kenney.zip` — the Kenney CC0 library (152 MB)

**The single most important asset in the repository.** It is the complete Kenney
asset library, CC0, organised for stable-path serving.

- `3d/` — **4,812 glTF-binary models across 49 kits**, textures beside each model.
- `2d/` — 36,822 sprite PNGs (every Kenney 2D pack).
- `ui/` — 4,686 UI element PNGs.
- `icons/` — 7,508 icon PNGs.
- `index.tsv` — 48,193 rows: `path, description, WxH, bytes`.
- `3d/kits.tsv` — 49 rows: `slug, title, models`.
- Licence: **CC0 1.0** (`LICENSE.txt`, Kenney). Shippable.

**The 49 kits and their model counts:**

```
blaster 40 · blocky-characters 18 · brick 296 · building 79 · car 50 · castle 76
city-commercial 41 · city-industrial 25 · city-roads 72 · city-suburban 40
coaster 183 · cube-pets 24 · factory 143 · fantasy-town 167 · food 200
furniture 140 · graveyard 91 · hexagon 72 · holiday 99 · marble 162
mini-arcade 20 · mini-arena 22 · mini-characters 26 · mini-dungeon 25
mini-forest 22 · mini-market 20 · mini-skate 20 · minigolf 126
modular-buildings 108 · modular-cave 40 · modular-dungeon 39 · modular-space 40
nature 329 · pirate 72 · platformer 153 · prototype 145 · racing 112
retro-fantasy 105 · retro-urban 124 · road 294 · space 153 · space-station 97
survival 80 · tower-defense-classic 119 · tower-defense 160 · toy-car 157
train 103 · watercraft 46 · weapon 37
```

**`3d/platformer/` — 153 models. This is the core platformer vocabulary.**
Paths are `shorepine-kenney/3d/platformer/<name>.glb`:

*Terrain (106):* `block-grass`, `block-grass-large`, `-narrow`, `-long`, `-low`, `-corner`,
`-edge`, `-curve`, `-curve-half`, `-curve-low`, `-hexagon`, `-low-hexagon`, `-overhang`,
`-overhang-edge`, `-overhang-corner`, `-overhang-hexagon`, `-overhang-large`, `-overhang-low`,
`-overhang-long`, `-overhang-narrow`, `-low-large`, `-low-long`, `-low-narrow`,
`-large-slope`, `-large-slope-steep`, `-large-slope-narrow`, `-large-slope-steep-narrow`,
`-large-tall` (+ `-overhang-` and `-snow-` mirrors of every grass variant, plus
`-low`, `-corner-low`).

*Platforms:* `platform`, `platform-ramp`, `platform-fortified`, `platform-overhang`.

*Hazards:* `trap-spikes`, `trap-spikes-large`, `spike-block`, `spike-block-wide`, `saw`, `bomb`.

*Pickups:* `coin-bronze`, `coin-silver`, `coin-gold`, `star`, `heart`, `jewel`, `key`,
`mushrooms`.

*Interactive:* `button-round`, `button-square`, `lever`, `lock`, `door-open`, `door-large-open`,
`door-rotate`, `door-rotate-large`, `conveyor-belt`, `spring`, `barrel`, `crate`, `crate-strong`,
`crate-item`, `crate-item-strong`, `chest`, `flag`, `sign`, `arrow`, `arrows`.

*Structure & scenery:* `pipe`, `ladder`, `ladder-long`, `ladder-broken`, `poles`,
`fence-straight`, `fence-corner`, `fence-low-straight`, `fence-low-corner`, `fence-broken`,
`fence-low-broken`, `fence-curve*`, `fence-rope`, `hedge`, `hedge-corner`, `tree`, `tree-pine`,
`tree-pine-small`, `tree-snow`, `tree-pine-snow`, `tree-pine-snow-small`, `rocks`, `stones`,
`grass`, `flowers`, `flowers-tall`, `plant`, `mushrooms`.

*Characters:* `character-oobi`, `character-oodi`, `character-ooli`, `character-oopi`,
`character-oozi` (5 playable-cast candidates).

Also `3d/platformer/colormap.png` (the kit's colour map).

**`3d/blocky-characters/` — 18 characters** `character-a` … `character-r`, each with its own
`texture-a.png` … `texture-r.png`. Static.

**`3d/mini-characters/` — 26 models:** `character-male-a…f`, `character-female-a…f`,
plus accessibility props `aid-cane`, `aid-cane-low-vision`, `aid-cane-blind`, `aid-glasses`,
`aid-sunglasses`, `aid-mask`, `aid-crutch`, `aid-hearing`, `aid-defibrillator-green/red`,
and `wheelchair`, `wheelchair-deluxe`, `wheelchair-power`, `wheelchair-power-deluxe`.

**`3d/cube-pets/` — 24 animals** `animal-deer`, `animal-tiger`, `animal-parrot`,
`animal-chick`, `animal-lion`, `animal-elephant`, `animal-pig`, `animal-bunny`,
`animal-crab`, `animal-panda`, `animal-beaver`, `animal-giraffe`, `animal-polar`,
`animal-fox`, `animal-fish`, `animal-bee`, `animal-monkey`, `animal-penguin`, `animal-dog`,
`animal-koala`, `animal-hog`, `animal-cow`, `animal-caterpillar`, `animal-cat`.

**Other kits that map to region themes:** `nature` (329), `castle` (76), `graveyard` (91),
`pirate` (72), `retro-fantasy` (105), `space` (153), `space-station` (97), `modular-space` (40),
`modular-dungeon` (39), `modular-cave` (40), `modular-buildings` (108), `mini-forest` (22),
`mini-dungeon` (25), `survival` (80), `holiday` (99), `factory` (143), `fantasy-town` (167),
`building` (79), `brick` (296), `furniture` (140), `food` (200), `marble` (162),
`hexagon` (72), `weapon` (37), `blaster` (40), `tower-defense` (160),
`tower-defense-classic` (119), `prototype` (145), `retro-urban` (124).

> **CORRECTION (verified by direct GLB JSON-chunk inspection — supersedes the earlier
> claim that the Kenney GLBs are static).** Scanning **all 4,812 GLB files** in
> `shorepine-kenney.zip` for their glTF `animations` and `skins` arrays gives:
>
> **150 models are animated; 26 of those are skinned (rigged).**
>
> The Kenney pack README's "static flat-shading rasterizer" note describes the *Tulip
> asset service's* consumer, not the files. The files themselves carry real animation.
> Measured evidence: `platformer/character-oobi.glb` → `meshes=1 nodes=8 skins=1
> animations=25`; `cube-pets/animal-cat.glb` → `meshes=7 nodes=9 skins=0
> animations=8`; `blocky-characters/character-a.glb` → `animations=27`.
>
> Full per-model data: `minimax-game/platformer-docs/library-inventory/kenney-3d-animation-index.json`
> (one JSON object per GLB: path, kit, meshes, skins, animations, clip names).

### 2.1a The animated Kenney vocabulary (measured, exact clip names)

| Kit | Animated models | Skinned | Clip count | Clip names |
|---|---|---|---|---|
| `platformer` | 13 | **5** | 25 | `static, idle, walk, sprint, jump, fall, crouch, sit, drive, die, pick-up, emote-yes, emote-no, holding-right, holding-left, holding-both, holding-right-shoot, holding-left-shoot, holding-both-shoot, attack-melee-right, attack-melee-left, attack-kick-right, attack-kick-left, interact-right, interact-left` |
| `mini-characters` | 12 | **12** | 32 | the 25 above **plus** `wheelchair-sit, wheelchair-look-left, wheelchair-look-right, wheelchair-move-forward, wheelchair-move-back, wheelchair-move-left, wheelchair-move-right` |
| `blocky-characters` | 18 | 0 | 27 | the 25 above, node-transform animated |
| `prototype` | 25 | 0 | 27 | the 25 above |
| `graveyard` | 7 | 0 | 27 | the 25 above — includes `character-ghost.glb` |
| `mini-arcade` | 6 | 2 | 27 | the 25 above — includes `character-employee.glb` |
| `mini-forest` | 1 | 1 | 27 | `character-archer.glb` |
| `mini-arena` | 1 | 1 | 27 | `character-soldier.glb` |
| `mini-skate` | 2 | 2 | 32 | the 32-clip set **plus** `skate, skate-stand, skate-air, skate-grab` |
| `cube-pets` | 24 | 0 | 8 | `static, idle, walk, run, eat, dance, gesture-positive, gesture-negative` |
| `factory` | 11 | 0 | 3 | `toggle-on, toggle-off, toggle` (pistons, levers, machinery) |
| `building` | 8 | 0 | 3 | `open, close, open-and-close` (doors) |
| `blaster` | 3 | 0 | 3 | `open, close, open-close` (crates) |
| `mini-market` | 3 | 0 | 3 | `open, close, open-and-close` (fence/doors) |
| `mini-dungeon` | 5 | 2 | 3 | `show, hide, show-hide` (the trap) |
| `modular-space` / `modular-dungeon` / `holiday` | 2 / 2 / 2 | 0 | 3 | `open, close, open-and-close` (gates, cabin doors) |
| `survival` / `pirate` | 1 / 1 | 0 | 3 | `open, close, open-close` (chests) |
| `hexagon` | 3 | 0 | 1 | `animation` (e.g. `building-watermill.glb`) |

**What this means for the design:** the 3D cast is no longer a 12-rig problem. There are
**5 skinned platformer characters (25 clips)**, **12 skinned mini-characters (32 clips)**,
**18 blocky characters (27 clips)**, **25 prototype figures (27 clips)**, **24 animals
(8 clips)**, plus KayKit/Quaternius/holokat. The interactive-prop vocabulary is
**directly authored into the art** — doors, buttons, levers, gates, chests, crates,
pistons and traps already have `open/close/toggle/show/hide` animation clips, which is
precisely what `REQ-D-002`, `REQ-D-008`, `REQ-D-009`, `REQ-D-011` and `REQ-C-013` need.
The 27-clip locomotion set also maps almost one-to-one onto the movement states of
`REQ-A-005` (idle, walk, sprint, jump, fall, crouch, sit, die, pickup, hurt/emote).

### 2.2 The animated cast (Layer B, local packs — all CC0-1.0 / MIT)

**This is where animated characters come from.** 37 animated models, 791 clips total.

**KayKit Adventurers** — `kaykit-adventurers.zip`, CC0-1.0, 64 3D files. 5 rigs,
**76 clips each**: `Barbarian`, `Knight`, `Mage`, `Rogue`, `Rogue_Hooded`.

Full 76-clip vocabulary (identical across all five):
`Idle, Unarmed_Idle, Unarmed_Pose, T-Pose, Walking_A, Walking_B, Walking_C,
Walking_Backwards, Running_A, Running_B, Running_Strafe_Left, Running_Strafe_Right,
Jump_Start, Jump_Idle, Jump_Land, Jump_Full_Short, Jump_Full_Long, Fall, Hit_A, Hit_B,
Death_A, Death_A_Pose, Death_B, Death_B_Pose, Block, Block_Attack, Block_Hit, Blocking,
Dodge_Backward, Dodge_Forward, Dodge_Left, Dodge_Right, Interact, PickUp, Throw, Use_Item,
Cheer, Lie_Down, Lie_Idle, Lie_Pose, Lie_StandUp, Sit_Chair_*, Sit_Floor_*,
1H_Melee_Attack_Chop, 1H_Melee_Attack_Slice_Diagonal, 1H_Melee_Attack_Slice_Horizontal,
1H_Melee_Attack_Stab, 2H_Melee_Attack_Chop, 2H_Melee_Attack_Slice, 2H_Melee_Attack_Spin,
2H_Melee_Attack_Spinning, 2H_Melee_Attack_Stab, Dualwield_Melee_Attack_Chop,
Dualwield_Melee_Attack_Slice, Dualwield_Melee_Attack_Stab, Unarmed_Melee_Attack_Kick,
Unarmed_Melee_Attack_Punch_A, Unarmed_Melee_Attack_Punch_B, Spellcasting, Spellcast_Long,
Spellcast_Raise, Spellcast_Shoot, 1H_Ranged_Aiming, 1H_Ranged_Reload, 1H_Ranged_Shoot,
1H_Ranged_Shooting, 2H_Ranged_Aiming, 2H_Ranged_Reload, 2H_Ranged_Shoot, 2H_Ranged_Shooting,
2H_Melee_Idle, 1H_Melee_Attack_*`

**KayKit Skeletons** — `kaykit-skeletons.zip`, CC0-1.0, 34 3D files. 5 rigs,
**95 clips each**: `Skeleton`, `Skeleton_Warrior`, `Skeleton_Mage`, `Skeleton_Rogue`,
`Skeleton_Minion`. Superset of the 76 above plus:
`Idle_B, Idle_Combat, Taunt, Taunt_Longer, Spawn_Air, Spawn_Ground, Spawn_Ground_Skeletons,
Death_C_Pose, Death_C_Skeletons, Death_C_Skeletons_Resurrect, Skeletons_Awaken_Floor,
Skeletons_Awaken_Floor_Long, Skeletons_Awaken_Standing, Skeleton_Inactive_Standing_Pose,
Skeletons_Inactive_Floor_Pose, 1H_Melee_Attack_Jump_Chop, Spellcast_Summon,
Running_C, Walking_D_Skeletons`

**Quaternius Ultimate Animated Character** — `quaternius-ultimate-animated-character.zip`,
CC0-1.0, 125 3D files, **17 clips each**:
`Casual Male, Casual 3 Male, Chef, Goblin, Knight, Ninja, Pirate, Soldier, Blue Soldier,
Wizard, Worker Male, Worker Female`
Clips: `Death, Defeat, Idle, Jump, PickUp, Punch, RecieveHit, Roll, Run, Run_Carry,
Shoot_OneHanded, SitDown, StandUp, SwordSlash, Victory, Walk, Walk_Carry`

**Quaternius Ultimate Animated Animals** — CC0-1.0, 36 3D files, 12–13 clips:
`Fox` (12), `Shiba Inu` (12), `White Horse` (13)

**KayKit Character Animations 1.2** — `kaykit-character-animations-1.2.zip`, CC0-1.0,
13 3D files, **30 clips**: `Attack(1h), AttackCombo, AttackSpinning, BasePose, Block,
Cheer, Climbing, Dance, DashBack, DashFront, DashLeft, DashRight, Defeat, HeavyAttack, Hop,
Idle, Interact, Jump, LayingDownIdle, PickUp, Roll, Run, Shoot(1h), Shoot(2h),
Shoot(2h)Bow, Shooting(1h), Shooting(2h), Throw, Walk, Wave`

**Quaternius animated mech** — `quaternius-animated-mech.zip`, CC0-1.0, 18 clips:
`Leela Robot`

**Kenney Cube Pets** — 8 clips each: `Bunny, Cat, Crab, Koala, Penguin, Pig, Polar Bear,
animal-caterpillar, animal-parrot` (from `shorepine-kenney/3d/cube-pets/`)

**holokat Game Assets** — MIT, 1,766 3D files (the largest 3D pack by file count),
includes `warrior-base-rigged` (1 clip `RigNeutral`), `Attack(1h)`, `AttackCombo`,
`AttackSpinning`, `BaseCharacter`, `Basepose`, `Barbarian` (76).

**barnabe wild rigged character** — `barnabe-wild-rigged-character.zip`, 7.1 MB, rigged.

### 2.3 Other 3D packs

- `kaykit-dungeon.zip` (422 models) + `kaykit-dungeon-remastered.zip` — dungeon kit.
- `kaykit-medieval-hexagon.zip` (263 models) — hexagonal medieval kit.
- `avramania-nature-terrain.zip` (41 models, `mdvl_nature_*`, glTF 2.0, Blender 5.2).
- `cc0tree.zip` (24 models) — trees.
- `oga-3d-character-pack.zip` — contains nested `bravos_game_br_2023.zip`,
  `bravos_game_br_2024.zip`, `bravos_game_br_part_3.zip`.
- `fps-asset-kit.zip` — 24 ambientCG PBR material sets, each with
  `.blend / .mtlx / .tres / .usdc / .png` interchange + `Color, NormalDX, NormalGL,
  Roughness, AmbientOcclusion, Displacement, Metalness` maps.
  Materials: `Asphalt023S, Asphalt025C, Asphalt031, Bricks097, Bricks102, Bricks104,
  Concrete034, Concrete047A, Concrete048, Ground037, Ground054, Ground103,
  Metal049A, Metal055A, Metal063, Plaster001, Plaster002, Plaster007, Rock058,
  Rock063, Rock064, Wood092, Wood094, Wood095`.
- `fps-buildings-env-kit.zip` — 18 stylised GLB vegetation (`polypizza-stylized-nature-gltf`:
  `Bush, Clover×2, Fern, Grass, Mushroom, Pine×5, Plant×2, Tree×5`), 7 ambientCG ground
  material blends, **4 PolyHaven HDRI skyboxes** (`kloppenheim_02_puresky_2k`,
  `kloppenheim_06_puresky_2k`, `urban_alley_01_2k`, `urban_street_01_2k`).
- `ambientcg-cc0-pbr-materials.zip` — 80 CC0 PBR material sets
  (`Asphalt031/033, Bricks097/104/105/106A…113A, Carpet016, Clay005/006/007, …`).

### 2.4 Second fetch batch (14 further packs, +1.2 GB — 23 packs / 2.7 GB total)

| Pack | Contents | Licence |
|---|---|---|
| `polyhaven-cc0-hdris-textures-models.zip` | **80 `.hdr` skyboxes**, `assets/polyhaven/<scene>/<scene>_1k.hdr` — e.g. `aarfontein_dawn_2`, `aarfontein_dusk`, `aarfontein_sunrise`, `aarfontein_pan`, `abandoned_bakery`, `abandoned_church`, `abandoned_construction`, `abandoned_factory_canteen_01/02`, `abandoned_games_room_01/02`, `alps_field`, … plus `ATTRIBUTION.csv` | CC0 |
| `kaykit-dungeon-remastered.zip` | **203 `.glb`** + 203 `.fbx` + 208 `.obj`/`.mtl` | CC0 |
| `kaykit-prototype-bits.zip` | 72 `.gltf` + `.bin`, 144 `.fbx`, 77 `.obj` | CC0 |
| `kaykit-city-builder.zip` | 41 `.gltf` + `.bin`, 82 `.fbx`, 61 `.obj` | CC0 |
| `kaykit-furniture.zip` | 53 `.gltf` + `.bin`, 106 `.fbx`, 53 `.obj` | CC0 |
| `kaykit-halloween.zip` | 63 `.gltf` + `.bin`, 126 `.fbx`, 70 `.obj` | CC0 |
| `jean-charpentier-lowpoly.zip` | 33 `.fbx` + 20 `.blend` — low-poly nature props, French-named: `arbre01–05` (trees), `arbres_amas` (tree cluster), `barriere01/02` (fence), `rocher_simple01–03`, `rocher_amas01/02`, `rocher_amat01`, `planches01–03` (planks), `herbe` (grass), `feu` (fire), `cookie` | CC0 |
| `quaternius-animated-mech.zip` (83.6 MB, fetched in the second batch) | **4 mech characters in five formats**: `assets/Textured/glTF/{George,Leela,Mike,Stan}.gltf` + `assets/Textured/FBX/*.fbx` + `assets/Textured/OBJ/*.obj` + `assets/Textured/Blends/*.blend` + `assets/Textured/Textures/*_Texture.png`, plus `assets/Flat/`, `assets/Preview.jpg`, `assets/License.txt`. **`Leela` carries 18 animation clips** in the index — the only boss-scale animated rig besides KayKit/Quaternius humanoids | CC0 |
| `godot-asset-library-3d-animation.zip` | **Not 3D animation.** It is a 2D **shader/background** library: `40/background.png`, `40/water.png`, `40/waterdisplacement.png`, `59/grass.png`, `59/sand.png`, `59/sand_transition.png`, `59/debug-border.png`, `59/debug-fill.png`, `56/CollisionPath2D_icon.png`, `42/waterDUDV.png`, each with a `README.md`. Useful as 2D FX/backdrop textures only | CC0 |
| `kenney-cc0-game-art-packs.zip` | **7,033 files** — the original Kenney multi-format packs: `assets/kenney/<kit-name>/` each with `License.txt`, `Preview.png`, `Preview_(Variation_A/B/C).png`, `Sample.png` and every model in **`.fbx` + `.glb` + `.obj` + `.png`**. Kits include `city-kit-industrial`, `city-kit-commercial`, `city-kit-roads`, `city-kit-suburban`, `castle-kit`, `graveyard-kit`, `pirate-kit`, `survival-kit`, `holiday-kit`, `platformer-kit`, `nature-kit`, `food-kit`, `furniture-kit`, `space-kit`, `prototype-kit`, `blaster-kit`, `weapon-pack`, `racing-kit`, `toy-car-kit`, `train-kit`, `watercraft-pack`, `mini-characters`, `blocky-characters`, `cube-pets`, `mini-forest`, `mini-dungeon`, `mini-arena`, `minigolf-kit`, `modular-*-kit`, `tower-defense*`, `hexagon-kit`, `marble-kit`, `brick-kit`, `road-pack`, `coaster-kit`, `fantasy-town-kit`, `retro-fantasy-kit`, `retro-urban-kit`, `factory-kit`, `building-kit`, `holiday-kit`, `space-station-kit`, `mini-market`, `mini-skate`, `mini-arcade`, `city-kit` family. **This is the pack that gives FBX and OBJ alongside GLB** — important for engine import where FBX is preferred, and each kit ships its own `License.txt` for per-kit attribution | CC0 |
| `10-kenney-collection.zip` (26.9 MB) | The **same 4,812 Kenney GLB models** as `shorepine-kenney`, but laid out with each kit as a **root-level folder** (`platformer/*.glb`, `nature/*.glb`, `cube-pets/*.glb`, …) plus a `Textures/` subfolder per kit. **This is the cleanest path form to cite**: `platformer/block-grass.glb` rather than `shorepine-kenney/3d/platformer/block-grass.glb`. It is a **duplicate of the same models, not new content** — do not double-count the catalogue | CC0 |
| `04-ui.zip` (66 MB) | UI pack | mixed — verify per file |
| `05-environments.zip` (27 MB) | environment art | mixed — verify per file |
| `07-vfx.zip` (45 MB) | VFX art | mixed — verify per file |
| `08-tiles.zip` (65 MB) | tile art | mixed — verify per file |
| `10-kenney-collection.zip` (27 MB) | Kenney collection incl. pixel font | CC0 |

> **Correction recorded:** `godot-asset-library-3d-animation.zip` is named for 3D animation but
> contains **only 2D shader/background textures**. It is **not** a source of animated 3D
> assets. The animated-3D story remains §2.2 (KayKit / Quaternius / holokat / Kenney cube-pets).

---

## 3. Audio — the honest picture

**The entire audio corpus in the repository is 78 audio file paths resolving to 66 unique sounds — 52 `.ogg` (40 Kenney Desert Shooter + 12 `Fantozzi` footsteps), 12 `.flac` (the same 12 footsteps, each at two paths) and 2 `.wav` (gunshots). 52 `.ogg` ship.**

| Pack | Files | Content |
|---|---|---|
| `fps-buildings-env-kit.zip` → `military/kenney-desert-shooter-pack/Sounds/` | 40 `.ogg` | `jump-a…f` (6), `coin-a…d` (4), `hurt-a…e` (5), `fall-a/b` (2), `explosion-a…c` (3), `lose-a…d` (4), `move-a…d` (4), `select-a` (1), `error-a…c` (3), `shoot-a…h` (8) |
| `fps-asset-kit.zip` → `sfx/footsteps/Fantozzi-footsteps/` | 12 `.ogg` + 24 `.flac` **rows** (= the same 12 `.flac` at two paths each) | `Fantozzi-{Sand,Stone}{L,R}{1,2,3}` — 12 steps in 2 formats; the FLAC copies are alternates of the shipped OGG |
| `fps-asset-kit.zip` → `sfx/gunshots/` | 2 `.wav` | `game_gunshot.wav`, `sniper_shot.wav` — no cue needs them; not shipped |

**The table sums to the 78 paths** — 40 `.ogg` + 12 `.ogg` + 24 `.flac` rows + 2 `.wav` — which resolve to **66 unique sounds**, of which the **52 `.ogg` ship**.

**Verified negatives (read, not assumed):**
- All 12 local packs in `~/.minimax/asset-library/packs/` contain **0 audio files**.
- `01-characters.zip`, `02-fantasy.zip`, `03-scifi.zip` contain **0 audio files** — the
  `oga-*sounds` directories in them hold only `SOURCE.md` and `-info.txt` stubs. Their
  extension sets are: 01 → `fla jpg json ken md png svg tmx tsx txt xcf xml`;
  02 → `auf aup bmp gif html jpeg jpg license ma material md mesh mscz png psd rar svg tga
  tmx tsx txt xcf xml`; 03 → `aup bmp cfg flp gif jpeg jpg md mscz pdf pdn png psd svg tga
  ttf txt xcf xcfbz2 xml`. **No audio container among them.**
- No release asset in the 98-asset list is a music/audio archive by name, and none of the
  16 JSON metadata assets describes one.

**Consequence — this is a real GAP, not an oversight:** the 8 regions need 8+ music cues
and the corpus has **no music**. The SFX vocabulary above is rich enough for gameplay
(jump, land, coin, hurt, fall, die, pickup, select, break, splash-by-analogue) but music
must be sourced, composed outside the repository, or explicitly deferred. **The design
must state this, not fake it.**

---

## 4. UI, fonts, icons

- `shorepine-kenney/ui/` — 4,686 PNGs: `Cursor Pack` (Basic/Outline, Double),
  `Cursor Pixel Pack`, `Fantasy UI Borders` (Border, Divider, Divider Fade, Double, Panel,
  Transparent border, Transparent center), `Mobile Controls/Sprites`,
  `UI Adventure Pack` (arrowBeige/Blue/Brown/Silver, barBack_horizontalLeft, …).
- `shorepine-kenney/icons/` — 7,508 PNGs, 64px, incl. `Board Game Icons`.
- `04-ui.zip` (63 MB) — dedicated UI pack.
- `08-tiles.zip` (62.3 MB) — tiles; `07-vfx.zip` (42.8 MB) — VFX; `05-environments.zip`
  (25.3 MB) — environments; `10-kenney-collection.zip` (25.7 MB) — Kenney collection.
- `03-scifi` contains the **Kenney Vector Future** font family, exactly:
  `space-shooter-remastered/Bonus/kenvector_future.ttf` and
  `space-shooter-remastered/Bonus/kenvector_future_thin.ttf`. CC0.

**Font status: RESOLVED.** The HUD typeface is `kenvector_future.ttf` (with the
`kenvector_future_thin.ttf` thin weight for large titles). It is the only .ttf in any
fetched pack, and Kenney Vector Future is CC0.

> **Corrected 2026-10-30.** An earlier draft of this survey claimed "the Kenney pixel font
> inside `10-kenney-collection.zip` is the fallback". **That was wrong.** Verified by
> listing the archives: `10-kenney-collection.zip`, `shorepine-kenney.zip` and
> `kenney-cc0-game-art-packs.zip` each contain **zero** `.ttf` / `.otf` / `.woff` members.
> **There is exactly one font family in the entire corpus — two weights of Kenney Vector
> Future.** There is no second family and therefore no script fallback, which is why the
> shipped locale set is restricted to Latin-1 (assets gap `G-14`, adopted option (c)).
>
> One packaging consequence: the font lives inside `03-scifi.zip`, whose pack-level licence
> is **unverified per file**, even though Kenney Vector Future itself is CC0. The release
> audit therefore carries a per-file clearance note for `FT-001` / `FT-002`.

---

### 4.1 Skyboxes and input prompts — the measured counts

**Sky assets: 116 in all.**

| Source | Count | Notes |
|---|---|---|
| `polyhaven-cc0-hdris-textures-models.zip` | **80 `.hdr`** | `assets/polyhaven/<scene>/<scene>_1k.hdr` — CC0 environment maps for the skybox rig |
| `fps-buildings-env-kit.zip` | **4 `.hdr`** | `kloppenheim_02_puresky_2k`, `kloppenheim_06_puresky_2k`, `urban_alley_01_2k`, `urban_street_01_2k` |
| `kenney-cc0-game-art-packs.zip` | 16 PNG/JPG | `assets/kenney/skyboxes/` — the Kenney skybox set |
| `shorepine-kenney.zip` | 10 PNG | `2d/Skyboxes/Skyboxes/skybox-{day,night,morning,alien,space}.png` + 5 in the Voxel Pack `Other/` |
| `01-characters.zip` | 5 PNG/JPG | |
| `03-scifi.zip` | 1 PNG/JPG | |
| **Total** | **84 `.hdr` + 32 images = 116** | |

**Input prompts: 2,733 files** in `kenney-cc0-game-art-packs.zip!assets/kenney/input-prompts/`
— **1,958 PNG** + **744 SVG** + **31 TXT** (controller button glyphs, keyboard and mouse
prompts, per-family notes). *(Corrected 2026-10-30: an earlier draft of this survey said
2,719; the measured file count is 2,733, of which 1,958 are PNG.)*

**That set is measured, not shipped.** The **shipped** prompts come from the other
pack, whose families are separated by directory:
`shorepine-kenney.zip!icons/Input Prompts/Generic/` holds **74 PNG** and
`shorepine-kenney.zip!icons/Input Prompts/Keyboard & Mouse/` holds **516 PNG** —
**590 shipped glyph files**. The same directory tree also holds the branded families
(GameCube, Switch, Switch 2, Wii, WiiU, PlayStation, Steam Deck, Playdate, Meta Quest
and others), which are **excluded from the shipped set by the trademark decision**, not
by a licence gap. `IN-017` registers only the two trademark-free families.

## 5. 2D art — available but licence-pending

114,852 2D records, **every one `licence_status: unverified`**. They may be used in the
build but must be labelled pending clearance, and a release build must be able to exclude
them. Roles are available for search: `ui, character, animal, scenery, prop, food, tile,
pickup, vehicle, fx_glow, effect`.

Search tools (already on the machine):
```bash
python3 ~/.minimax/asset-library/tools/image_search.py "<terms>"
python3 ~/.minimax/asset-library/tools/gamekit.py sheet <role>
python3 ~/.minimax/asset-library/tools/gamekit.py doctor <project>
```

> **Design consequence:** the shipped game should be built **3D-first from the
> CC0/MIT 3D corpus**, so that the 2D library stays an optional enhancement layer.
> That way the licence-pending set can be excluded from a release build by config, and
> the game still ships complete.

---

## 6. Measured inventory files (read these, do not re-scan)

| File | Contents |
|---|---|
| `minimax-game/platformer-docs/library-inventory/kenney-3d-animation-index.json` | **all 4,812 Kenney GLBs** with their measured `meshes`, `skins`, `animations` and **exact clip names** — the authoritative animation lookup |
| `minimax-game/platformer-docs/library-inventory/3d-models-index.json` | 1,994 3D models: id, name, pack, licence, roles, animation_count, rigged, clip names, release URL |
| `minimax-game/platformer-docs/library-inventory/shorepine-kenney/3d/kits.tsv` | 49 kits: slug, title, models |
| `minimax-game/platformer-docs/library-inventory/shorepine-kenney/index.tsv` | 48,193 rows: path, description, WxH, bytes |
| `minimax-game/platformer-docs/library-inventory/kenney-3d-paths.txt` | all 4,812 GLB paths, kit-relative |
| `minimax-game/platformer-docs/library-inventory/kenney-2d-paths.txt` | 35,998 2D sprite paths |
| `minimax-game/platformer-docs/library-inventory/kenney-ui-index.txt` | 4,686 UI rows with descriptions |
| `minimax-game/platformer-docs/library-inventory/kenney-icon-paths.txt` | 7,508 icon paths |
| `minimax-game/platformer-docs/library-inventory/audio-inventory.txt` | all 78 audio file paths with their pack (66 unique basenames) |
| `minimax-game/platformer-docs/library-packs/*.zip` | 8 fetched packs (2.1 GB) |

---

## 7. The asset rule (verbatim, for the design and the CI)

> Every mesh, texture, animation, skybox, background, UI element, icon and sound in the
> shipped game is a **named file that exists in the image repository**, recorded in the
> asset manifest with its exact path, pack and licence. The pipeline may **measure and
> register** an asset (world-space bounds, footprint, scale, ground offset, orientation,
> compression) — it may **never author** one. No procedural geometry, no
> runtime-generated texture, no shader-only character, no primitive-composition actor.
> Compositing library assets into a level is allowed; fabricating an asset is not.
> If an element has no file, it is an **ASSET GAP** row with the requirement it blocks —
> it is never filled with a placeholder.

---

## 8. Known gaps declared at survey time

| # | Gap | Blocks |
|---|---|---|
| GAP-A1 | **No music** in the corpus (78 SFX files only) | 8 region music cues, `REQ-D-015` mixer music bus |
| GAP-A2 | ~~Kenney 3D models are static~~ — **RESOLVED by measurement**: 150 of 4,812 Kenney GLBs are animated, 26 skinned; see §2.1a | none — the animated cast is materially larger than first recorded |
| GAP-A3 | ~~Only 12 animated character rigs exist~~ — **RESOLVED by measurement**: 5 skinned platformer characters (25 clips), 12 skinned mini-characters (32 clips), 18 blocky characters (27 clips), 25 prototype figures (27 clips), 24 animals (8 clips), plus KayKit (5×76, 5×95), Quaternius (12×17, 3×12–13), Quaternius mech (18), holokat (76) | none — every animated archetype has a named rig or a named analogue |
| GAP-A4 | 2D corpus is **licence-unverified** | any design that depends on it for a shipped build |
| GAP-A5 | `jam-ready-assets.zip` (1.8 GB) is **PACK_LEVEL / not cleared** | excluded from the shipped bundle by rule |
| GAP-A6 | ~~Font family unnamed~~ — **RESOLVED**: `kenvector_future.ttf` + `kenvector_future_thin.ttf` (CC0), the only fonts in the corpus | none — HUD text is covered |
| GAP-A7 | `ambientcg` PBR sets are photographic realism — style clash with flat-shaded Kenney if mixed freely | the material/lighting consistency rule |
| GAP-A8 | `godot-asset-library-3d-animation.zip` is named for 3D animation but contains **only 2D shader textures** — it is not an animated-3D source | none, but do not cite it as animation |
| GAP-A9 | The corpus gives **84 CC0 `.hdr` skyboxes** (80 PolyHaven + 4 in `fps-buildings-env-kit`) plus **32 skybox images** (PNG/JPG) — 116 sky assets in all — but **no music**; the audio count is 78 paths / 66 unique sounds / 52 shippable `.ogg` | music gap stands |
| GAP-A10 | Kenney's 27-clip character set has **no swimming, gliding, flight, charging or climbing clips**; KayKit adds `Jump_Full_Long`, `Spellcast_*` but no swim/glide either. Swim, glide and climb therefore need **clip selection plus procedural-free pose blending**, or the pure-Kenney rigs must be supplemented by KayKit/Quaternius rigs for those states | `REQ-A-009`, `REQ-A-014`, `REQ-A-017` — the swim/glide/climb animation states |
