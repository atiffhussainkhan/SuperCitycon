# DESIGN-3 — ARCHITECTURE & QUALITY

**Game:** original 3D side-scrolling platform game (original IP, no Nintendo expressive material)
**Owner:** PD Architecture & Quality (`pd-architecture`)
**Version:** 1.0 · 30 October 2026
**Authority:** `MASTER-REQUIREMENTS.txt` v1.0 is the single source of truth for requirement text. This document is the authoritative *technical* design for `REQ-E-001…020` and `NFR-01…10`, and the complete census of all 102 requirement ids.

**Supersession notice.** `REQ-E-001` in the master document proposes *"Godot 4.x 2D with GDScript"*. That proposal is **superseded** by the requester's decision that this is a **3D game**. Section 3 makes and justifies a 3D engine decision against explicit criteria. No 2D engine, 2D renderer or 2D level format appears anywhere in this design.

**Scope boundary.** This document designs; it does not implement. No code is pasted. Every algorithm is described by contract, state, inputs, outputs and failure behaviour.

---

## 1. Reading order and vocabulary

Read in this order: §2 evidence → §3 engine → §4 module contract → §5 schemas → §6 save → §7 CI → §8 asset pipeline → §9 performance → §10 matrix → §11 gaps → §12 constants → §13 open decisions.

| Term | Meaning in this document |
|---|---|
| **Ship set** | The subset of repository assets permitted in a release build. Default profile `cc0_3d_only`. |
| **Manifest** | `src/assets/asset_manifest.json` — the registry of every asset reference with its licence metadata and measurements (§5.8). |
| **Ruleset** | One of the five sealed rule-sets: `classic_ground`, `challenge`, `carry_throw`, `world_map_suits`, `branching_companion`. Never blended (`REQ-E-007`). |
| **Tick** | One fixed simulation step. 60 Hz by default, configurable per ruleset. |
| **TUNE** | A constant whose value is a design choice, configurable, and *not* claimed to match any reference game (§12). |
| **UNVERIFIED** | A reference value that could not be evidenced; never asserted as fact. |
| **TARGET** | A budget or limit stated as an aim, not a measurement. All of §9 is TARGET until a baseline run exists. |

---

## 2. Evidence base

Everything below was **measured** in this workspace. Method is given so any claim can be re-derived. Nothing in §9 or §11 relies on an unmeasured figure.

### 2.1 Corpus measurements

| Fact | Value | Method |
|---|---|---|
| 3D records in the index | **1,994** — CC0-1.0 989 / MIT 1,005, all `approved: true` | parsed `library-inventory/3d-models-index.json` (JSONL, one record per line) |
| 3D formats | glb 1,314 · gltf 280 · fbx 267 · obj 68 · blend 65 | same |
| Rigged records | 28 rigged; 37 records carry clips; 1,217 clip entries over 36 distinct rig names | same |
| Mirrored animated packs | 12 packs, **791 clips**, 12 animated rigs | ASSET-SURVEY §2.2 (12 packs in `~/.minimax/asset-library/packs/`) |
| Kenney 3D | **4,812 GLB** across 49 kits; **125.8 MB** total uncompressed | zip central-directory scan of `shorepine-kenney.zip` |
| Kenney `platformer` kit | 153 models, **3.06 MB** | same |
| Kenney textures in the same zip | 48,281 files, 121.1 MB | same |
| PolyHaven skyboxes | 80 `.hdr` at 1k, **126.5 MB** total, 1.58 MB average | zip scan of `polyhaven-cc0-hdris-textures-models.zip` |
| ambientCG PBR | 80 sets, 115.0 MB of PNG | zip scan of `ambientcg-cc0-pbr-materials.zip` |
| KayKit Adventurers GLB | 32 files, **17.3 MB** | zip scan of the mirror pack |
| Quaternius animated-character GLB | 50 files, **94.6 MB** | zip scan of the mirror pack |
| Fetched archives | 22 zips, **2.4 GB** in `library-packs/` | directory measurement |

### 2.2 Rig families and bone naming — the retargeting problem, measured

Retargeting is the highest-risk technical area because the corpus contains **four incompatible bone-naming conventions** and **two incompatible animation models**. Measured directly from the GLB/gltf JSON chunks:

| Rig family | Models | Joints | Naming convention | Animation model |
|---|---|---|---|---|
| **Kenney platformer cast** (`character-oobi`…`character-oozi`) | 5 | **6** | `root, leg-left, leg-right, torso, arm-left, arm-right` | **Skinned**, 25 clips each |
| **KayKit** Adventurers / Skeletons | 5 + 5 | **41** | `root, hips, spine, chest, upperarm.l, lowerarm.l` (lower-case, dot-side) | Skinned, 76 / 95 clips |
| **Quaternius** Ultimate Animated Character | 12 | **23** | `Bone, Foot.L, Body, Hips, Abdomen, Torso, Neck, Head` (mixed-case, dot-side) | Skinned, 17 clips |
| **holokat / barnabe** | 1,768 files | varies | not standardised | mixed |
| **Kenney non-cast** (doors, buttons, chests, spikes, mills, cube-pets) | 150 with animation | 0 skins | n/a | **Node-transform only** (no skeleton) |

Kenney clip vocabulary on the 6-joint cast is platformer-native and complete for our purposes: `static, idle, walk, sprint, jump, fall, crouch, sit, drive, die, pick-up, emote-yes, emote-no, holding-right, holding-left, holding-both, holding-right-shoot, holding-left-shoot, holding-both-shoot, attack-melee-right, attack-melee-left, attack-kick-right, attack-kick-left, interact-right, interact-left`.

> **Correction to ASSET-SURVEY §2.1.** An earlier draft of the survey stated that Kenney models are static flat-shaded meshes and that "FBX-only skinned-character kits were excluded". That is true of the **bulk** of the library but **false of the platformer cast**: all five `3d/platformer/character-*.glb` are **skinned (1 skin) with 25 clips each**, and 26 Kenney GLB in total carry skins. 150 Kenney GLB carry animation, of which 124 are node-transform-only. The survey has been corrected, and the correction is restated in `DESIGN-3-ASSETS.md`.

**Design consequence.** Four bone maps are required, not one.

**The KayKit 41-joint map is the PRIMARY playable rig** — `kaykit_41`. The requester's
decision fixes the four player profiles (Tallow, Brindle, Sable, Moth) on the KayKit
Adventurers rigs, and the 76-clip KayKit vocabulary covers the movement, combat and
reaction states the player board needs. The Kenney 6-joint cast (`kenney_6`) remains the
**secondary rig** for NPCs, and is the natural choice for the node-transform props.

> **Reconciled from the player board's `CB-06`.** The architecture board had named the
> Kenney 6-joint cast as primary; the player board's profile decision names KayKit.
> **KayKit wins.** `kaykit_41` is therefore the required bone map, and it must ship with
> a **golden retarget test**: one authored KayKit clip retargeted onto the Kenney 6-joint
> cast and back must reproduce the same joint-angle deltas within 1e-3 rad, proving the
> mapping is lossless in both directions. This test is a Gate 2 blocker.

The 124 node-transform Kenney assets are animated by **scripted transform on the node
hierarchy** — a runtime transform of an existing asset, which is permitted (§8.3), not
authoring. The runtime-transform vocabulary is codified in §8.3a.

### 2.3 Audio — the honest picture, corrected

Scanning **all 22 fetched archives** for `.ogg .flac .wav .mp3 .m4a .aif .aiff .opus`:

| Source | Files | Size | Disposition |
|---|---|---|---|
| `fps-buildings-env-kit.zip` | 40 `.ogg` | 0.31 MB | **Ship.** Kenney desert-shooter SFX: jump×6, coin×4, hurt×5, fall×2, explosion×3, lose×4, move×4, select×1, error×3, shoot×8 |
| `fps-asset-kit.zip` → `sfx/footsteps` | 24 `.flac` + 12 `.ogg` (12 distinct sounds × 2 formats) | small | **Ship the `.ogg` set only**; the `.flac` are the same 12 sounds |
| `fps-asset-kit.zip` → `sfx/firearm_sfx` + `gunshots` | 58 `.wav` | **329.4 MB** | **Exclude by rule.** Firearm library: out of genre, and it is 99.9 % of the pack's audio bytes |
| Music | **0 files** | 0 | **Does not exist.** Zero music-named files in any archive |

> **Two corrections to ASSET-SURVEY §3.** (1) The survey's "78 audio files total" understates the raw archive contents — `fps-asset-kit.zip` alone holds 94 audio files, because the 329 MB firearm WAV set is excluded from the shipped inventory. (2) The survey's own original arithmetic (40 + 24 + 24 = 88) did not reconcile with its stated total of 78. **Both have since been corrected in the survey itself**, which now publishes the measured breakdown — **78 inventory rows = 52 `.ogg` + 24 `.flac` + 2 `.wav`, 66 unique basenames** — and its table sums to the 78 paths. The raw archive total is **134 files / 329.7 MB**.

**Shippable audio = the 52 shipped `.ogg`** (40 gameplay SFX + 12 footstep variants), out of **78 audio file paths resolving to 66 unique sounds** (the 12 `.flac` are alternates of the shipped footsteps at two paths each; the 2 `.wav` are gunshots). **Music is an unsourced asset gap** (`ASSETS` GAP-A1). The mixer (§7.5) must therefore be specified to operate with **zero music cues** and to report an `UNSOURCED` state rather than fail closed. `REQ-D-015` is consequently PARTIAL, not complete (§10).

### 2.4 Local toolchain — measured

| Tool | State | Consequence |
|---|---|---|
| **Godot** | **Not installed** on this machine | CI must download the pinned binary; a bootstrap script installs it to `.godot-bin/` with a checksum (§3.6) |
| **Unity** | **Two editors installed via the Hub**: `6000.6.4f1` at `/Applications/Unity/Hub/Editor/6000.6.4f1/Unity.app` and `6000.3.22f1` at `/Applications/Unity/Hub/Editor/6000.3.22f1/Unity.app`. (`/Users/mac/.unity/Editor/…` does **not** exist.) | Unity is the fallback engine (§3.7) and is available at zero extra install cost. The **fallback pin is `6000.6.4f1`** (the newer of the two) |
| Node / npm | v22.14.0 | CI tooling (screenshot diff) uses Node, matching the repository's existing convention |
| Python | 3.9.6 | CI tooling (schema validation, asset audit) uses Python, matching `tools/verify_design.py` |
| Cursor agent | 3.27.22, logged in | senior review pass available |
| CI host | GitHub Actions (existing `deploy.yml` uses Node 20, `npm ci`) | the new pipeline follows the same conventions |

---

## 3. Engine decision (`REQ-E-001`)

### 3.1 Criteria and weights

Weights are the requester's stated priorities, with the corpus reality folded in.

| # | Criterion | Weight | Why it is weighted this way |
|---|---|---|---|
| C1 | **glTF/GLB import fidelity** | 15 % | 4,812 Kenney GLB + 203 KayKit GLB + 1,314 indexed GLB/gltf are the corpus backbone |
| C2 | **FBX / .blend import** | 5 % | 267 FBX + 65 blend records exist; .blend needs Blender in the loop |
| C3 | **Animation retargeting across 4 rig families** | 15 % | 12 mirrored rigs, 36 named rigs in the index, 791+ clips; this is the hardest technical requirement |
| C4 | **Deterministic fixed tick** | 15 % | `REQ-E-002`, `NFR-02`, `REQ-A-002` — non-negotiable |
| C5 | **Headless CI** | 15 % | every gate in §7 runs unattended; a GPU-free runner is mandatory |
| C6 | **Desktop + web reach** | 10 % | §7.4 of the master document targets desktop-first with web reach |
| C7 | **Licence and running cost** | 10 % | no per-seat cost, no licence server in the build path |
| C8 | **Team cost (AI-authored, diffable assets)** | 10 % | content is produced by an automated pipeline; text formats merge, binary formats do not |
| C9 | **Asset-bundle streaming** | 5 % | PCK/chunked bundles for the 73 MB ship set |

### 3.2 Candidates compared

| | **A. Godot 4.7.2-stable 3D / GDScript** | **B. Godot 4.7.2-stable 3D / C#** | **C. Unity 6000.6.4f1 URP** | **D. Three.js + TypeScript** | **E. Bevy / Rust (wgpu)** |
|---|---|---|---|---|---|
| C1 glTF | **Native, first-class**, PBR materials, embedded textures | Same | Good via glTFast package; but Kenney's flat-shaded look needs material standardisation | Good (`GLTFLoader` + `KHR_materials`) | Good |
| C2 FBX/blend | FBX native; .blend needs Blender | Same | FBX native; .blend native | **Poor** — needs FBX2glTF in the pipeline | Weak |
| C3 Retargeting | **Built in** (`Skeleton3D` + `BoneMap` + `AnimationTree` retarget); 4 bone maps are a bounded authoring job | Same | **Best in class** (Humanoid auto-mapping) — a genuine advantage | **None** — `AnimationMixer` only; retargeting must be hand-written | Weak |
| C4 Fixed tick | `_physics_process` @ fixed Hz; input sampled into a tick buffer | Same | `FixedUpdate` | **None built in** — must be written | ECS schedule exists |
| C5 Headless CI | `--headless` runs the whole engine; no GPU, no display | Same, but needs .NET SDK | `-batchmode -nographics -runTests`, **but requires licence activation** | Headless via Node + headless-gl/Puppeteer | `cargo test` + `WGPU_BACKEND=gl` |
| C6 Desktop + web | Desktop: first-class. **Web: needs COOP/COEP for threads** | Same | Desktop first-class; WebGL heavy (100 MB+ baseline) | **Web-native** — the strongest option here | Web support experimental |
| C7 Licence | **MIT, zero cost, no activation** | MIT + .NET runtime | Free under thresholds, but **CI needs an activated licence + secret** | MIT | MIT/Apache |
| C8 Team cost | **Text `.tscn`/`.tres` — diffable, mergeable, scriptable** | Same plus C# verbosity | Binary `.unity`/`.prefab` — merge-hostile, editor-locked | No editor at all; everything is code | Code-only, steepest |
| C9 Streaming | `--export-pack`, per-bundle PCK, chunked | Same | Addressables | Manual | Manual |
| Asset import time in CI | Fast (~4,800 small GLB) | Same | Slow — Unity re-imports are the classic CI bottleneck | Fast | Fast |

### 3.3 Decision

**Godot 4.7.2-stable, 3D renderer, GDScript, pinned.**

Rationale, tied to the criteria that actually decide it:

- **C7 + C5 together are decisive.** A licence-activation step inside the build path is a permanent single point of failure for every gate in §7, and Unity's asset re-import is a known CI cost that scales with our 4,812-model corpus. Godot is MIT, needs no activation, and `--headless` runs the complete engine loop with no GPU and no display server.
- **C8 is the second decisive factor.** Our content pipeline is automated. `.tscn` and `.tres` are text; a level, a ruleset and an actor archetype are reviewable in a diff and can be generated by a script without an editor. Unity's binary-prefab and editor-locked scene format inverts that. Three.js has no editor at all, which is the opposite extreme: nothing to diff, nothing to review.
- **C1 is comfortably met.** Godot's glTF importer handles the corpus's standard PBR GLB directly. No conversion step is required for the 4,812 Kenney GLB, the 203 KayKit dungeon-remastered GLB, or the 65 blend records (which we route through FBX where an equivalent exists, so Blender is never in the build path).
- **C3 is met with bounded work.** Godot's `BoneMap` retargeting needs one map per bone-naming family. §2.2 measured exactly four families, and the two that matter most are structurally simple. This is a bounded, testable authoring job — not a research project.
- **C6 is the weakest axis for Godot** and is handled as a risk, not a hope: see §3.5 R1.

### 3.4 Pin and the deterministic launch scene (satisfies `REQ-E-001` acceptance)

| Item | Value |
|---|---|
| Engine pin | `4.7.2-stable` — one line in `godot.version`, nothing else in the tree names a version |
| `project.godot` | `config/features=PackedStringArray("4.7", "Forward Plus")` |
| Import settings | `glTF` importer: `use_named_shaders=false`, `ensure_tangents=true`, `mesh_compression` per-asset from the manifest, `animation/fps=60` |
| Physics tick | 60 Hz, `physics/common/physics_ticks_per_second=60`, `max_physics_steps_per_frame=8` |
| **Main scene** | `res://src/scenes/core/bootstrap.tscn` |
| **Deterministic launch scene** | `res://src/scenes/core/selftest.tscn` — a scene that runs with **no input**, executes 1,000 simulation ticks, and prints `LAUNCH_CHECKSUM=<sha256 of the canonical state serialisation>`. The checksum is recorded in the repository as `tests/golden/launch.checksum` and compared byte-for-byte by CI; the tool that produces it is `src/tools/launch_checksum.py`. |

**Launch-checksum contract.** The serialisation is a canonical, sorted, fixed-precision text encoding of the full simulation state after tick 1,000 with a fixed seed. It must be identical across runs on the pinned engine and pinned CI image. It is **not** claimed to be identical across platforms or engine versions — see §3.5 R3.

### 3.5 Risks, and the fallback

| Id | Risk | Likelihood | Impact | Mitigation | Fallback |
|---|---|---|---|---|---|
| **R1** | Godot 4 web export requires COOP/COEP headers for threaded wasm; **GitHub Pages cannot set response headers**, and the repository's existing deploy target is GitHub Pages | High | Web target unreachable on the current host | Ship a single-threaded web export variant (supported, slower); or deploy the web build to a header-capable host (Cloudflare Pages / Netlify) while the desktop build stays on the existing host. Desktop remains the release target for GATE 0–5. | Three.js + TypeScript web client (§3.7 B) |
| **R2** | Four bone-naming families; a fifth archive (holokat) is unstandardised | High | Enemy rigs cannot share one animation set | Bone-map registry (§4.3) with one map per family; a golden retarget test per family; **restrict the shipped animated cast to the Kenney 6-joint and KayKit 41-joint rigs only** until retargets are proven | Node-transform rigs for any unproven rig (§2.2) |
| **R3** | Floating-point divergence across CPU architectures makes replay checksums platform-specific | Medium | Replay gate cannot be a cross-platform claim | The replay gate compares against goldens **on the pinned CI image only**; cross-platform determinism is explicitly not claimed and is stated in the release notes | Per-platform golden files, keyed by runner image digest |
| **R4** | Godot's 3D web export maturity is unproven for a game of this scope | Medium | Web slip past GATE 5 | Desktop-first sequencing; web is a GATE-6 stretch with its own gate | Same as R1 |
| **R5** | Godot is **not installed on the developer machine** (§2.4) | Certain | Slower onboarding | `make godot` bootstrap downloads the pinned binary to `.godot-bin/`, verifies the published SHA-256, and prints the version | Unity 6000.6.4f1 already installed |
| **R6** | GDScript is slower than C#/native in hot paths | Low | Simulation budget pressure | The simulation core is **engine-agnostic** (§4.2); profiling gates target the simulation at ≤ 2.0 ms/tick (§9), which leaves ample headroom | Port the core to C# (option B) without touching content |

### 3.6 Fallback engine

**Unity 6000.6.4f1 URP**, already installed (a second editor, `6000.3.22f1`, is also present). Migration cost is bounded because (a) all content is JSON with a published schema (§5), (b) the simulation core holds no engine types (§4.2), and (c) the asset manifest, licence audit and CI gate list are engine-independent. Migration triggers: R1 unresolved at GATE 4, or a Godot 4.7 regression that blocks GATE 2 for more than five working days.

### 3.7 Rejected alternatives, with the specific reason

| Rejected | Specific reason |
|---|---|
| **Godot 2D** (the master's original proposal) | **Superseded by the 3D decision.** A 2D renderer cannot show the 4,812-model 3D corpus, the 80 HDR skyboxes, the PBR material sets, or any 3D camera. The corpus is 3D-first; a 2D game would discard 100 % of the 3D corpus and depend on the 114,852-record **licence-unverified** 2D set, which cannot ship in a release build (§8.6). |
| **Godot + C# (option B)** | Requires the .NET SDK in every CI runner and doubles the toolchain for no benefit at this content scale; GDScript's data-binding syntax is materially shorter for JSON-driven content. Retained as the R6 mitigation (port the core) rather than the default. |
| **Unity 6000.6.4f1 URP (option C)** | Two hard blockers: **licence activation inside the CI path** (an activation outage breaks every gate), and **binary `.unity`/`.prefab` assets** that defeat the diff-and-script content pipeline this project depends on. Retained as the fallback engine because its Humanoid retargeting is genuinely better than Godot's. |
| **Three.js + TypeScript (option D)** | No editor, no scene or level format, **no retargeting** (the 791 clips would need a hand-written retargeter before any enemy could animate), **no fixed-tick scheduler** and no deterministic capture harness. Its one decisive win is web reach, which §3.5 R1 isolates. Retained as the **web-only fallback** for R1/R4 — and it is the repository's existing stack (`three@0.169` + Vite), so the fallback is not a foreign stack. |
| **Bevy / Rust (option E)** | Retargeting and editor tooling are immature for a 12-rig library; the web target is experimental; and the schema validation, licence audit and manifest tooling would have to be rebuilt in Rust for no gameplay gain. |

### 3.8 Decision record

**Status: DECIDED.** Engine Godot 4.7.2-stable, 3D, GDScript, pinned in `godot.version`; C# explicitly not selected; Unity 6000.6.4f1 URP is the fallback; Three.js is the web-only fallback. Changing this decision requires a written ADR superseding §3 and re-running the §7 gates.

---

## 4. Module and folder contract

### 4.1 Folder tree

```
platformer3d/
├── godot.version                  # THE engine pin: one line, "4.7.2-stable"
├── project.godot                  # config/features, physics tick, autoloads, input map
├── .gitattributes                 # line endings and LFS rules for the asset tree
├── .godot-bin/                    # pinned engine binary (git-ignored, bootstrap-verified)
├── src/
│   ├── core/                      # ENGINE-AGNOSTIC SIMULATION — no Node, no Vector3
│   │   ├── math/                  # Vec3, Quat, Aabb, deterministic fixed-point helpers
│   │   ├── sim/                   # tick scheduler, tick clock, seeded RNG, replay recorder
│   │   ├── data/                  # schema models, validators, loaders, registries
│   │   ├── events/                # typed event bus + event definitions
│   │   ├── rules/                 # ruleset selection and feature gates
│   │   ├── damage/                # resistance matrix, damage event types
│   │   └── save/                  # save schema, migration chain, atomic writer, backup ring
│   ├── systems/                   # ENGINE-BOUND SERVICES — one directory per system
│   │   ├── input/                 # action map, dead zones, hotplug, conflict policy, rebinding
│   │   ├── physics/               # profiles, material surfaces, zones, kinematic mover, contacts
│   │   ├── player/                # player profiles, power ladder, state machine, damage intake
│   │   ├── actors/                # actor base, FSM, pooling, activation regions
│   │   ├── camera/                # follow rig, dead zone, look-ahead, scripted tracks
│   │   ├── world/                 # world graph runtime, unlock evaluation, map scenes
│   │   ├── inventory/             # slots, reserve, capacity, consumption
│   │   ├── audio/                 # bus graph, cue registry, ducking, priority
│   │   ├── fx/                    # pooled effect triggers
│   │   ├── ui/                    # HUD, menus, options, tutorials, localisation view
│   │   ├── localisation/          # locale tables, font fallback chain, RTL readiness
│   │   ├── telemetry/             # opt-in collector, debug overlay, build id
│   │   └── debug/                 # teleport, invincible, speed, item grant, gate unlock
│   ├── content/                   # DATA ONLY — no code in this tree
│   │   ├── rulesets/              # ruleset JSON (ARCH §5.1)
│   │   ├── tuning/                # <ruleset_id>.tune.json — every configurable constant
│   │   ├── stages/                # stage JSON (ARCH §5.2), v2 with the 3D field groups
│   │   ├── actors/                # actor archetypes (ARCH §5.3) — enemies, bosses, companions
│   │   ├── characters/            # player profiles — <profile_id>.character.json (ARCH §5.3)
│   │   ├── items/                 # item archetypes (ARCH §5.4)
│   │   ├── blocks/                # block archetypes (ARCH §5.5)
│   │   ├── objects/               # interactive-object archetypes (WORLD §6)
│   │   ├── worlds/                # world-map nodes (ARCH §5.6) + reachability obligations
│   │   ├── flows/                 # scene_flow.json — the 19 scene transitions (WORLD §7.3)
│   │   ├── palettes/              # stage palettes and their high-contrast variants
│   │   ├── backgrounds/           # background rig definitions
│   │   ├── audio/                 # cue registry and caption tables
│   │   ├── fx/                    # effect definitions
│   │   ├── damage/                # resistance_matrix.json — the three-axis damage key
│   │   ├── scoring/               # score tables — goal_reward.score_table_ref
│   │   ├── save/                  # save.schema.json — the on-disk shape (ARCH §5.7)
│   │   └── localisation/          # <locale>.json — every user-visible string
│   ├── scenes/                    # .tscn composition only
│   │   ├── core/                  # bootstrap.tscn, selftest.tscn
│   │   ├── actors/                # one directory per actor family
│   │   │   ├── player/            # the player actor scene
│   │   │   ├── enemy/             # enemy actor scenes
│   │   │   ├── boss/              # boss actor scenes
│   │   │   ├── companion/         # companion actor scenes
│   │   │   ├── projectile/        # projectile actor scenes
│   │   │   └── carried_object/    # carryable actor scenes
│   │   ├── objects/               # interactive-object scenes
│   │   └── ui/                    # HUD, menus and map scenes
│   │       ├── hud/               # the in-game HUD
│   │       ├── menus/             # title, profile select, pause, options, credits
│   │       └── maps/              # world-map screens
│   ├── assets/                    # imported asset tree — READ-ONLY after ingest
│   │   ├── asset_manifest.json    # the registry of every asset reference (§5.8)
│   │   ├── asset_manifest.schema.json
│   │   ├── licence_registry.json  # pack → licence, source URL, status
│   │   └── licence_manifest.json  # the generated attribution file
│   └── tools/                     # CLI tools (headless): validator, linter, packer, audit, harness
│       ├── validate_schema.py
│       ├── localisation_check.py
│       ├── launch_checksum.py
│       ├── level_linter.py
│       ├── world_map_validator.py
│       ├── check_asset_manifest.py
│       ├── asset_manifest.py
│       ├── asset_audit.py
│       ├── death_report.py
│       └── asset_pipeline/
├── tests/
│   ├── unit/ integration/ replay/ e2e/ golden/ fixtures/
│   ├── harness/
│   └── player/ entities/ world/ assets/
├── ci/                            # workflow definitions, gate scripts, runner images
├── docs/
│   ├── PROJECT_PLAN.md            # the milestone plan and the gate sequence
│   ├── BACKLOG.md                 # everything deferred out of the 13-stage slice
│   ├── REQUIREMENTS_TRACEABILITY.md  # one row per requirement: status, owner, evidence
│   ├── GAP_REGISTER.md            # every gap, its REQ id, and the decision that closed it
│   ├── ASSET_MANIFEST.md          # the human-readable manifest
│   ├── ASSET_GAP_REGISTER.md      # every asset gap and its adopted option
│   ├── ATTRIBUTION.md             # the shipped attribution file
│   └── LICENCE_AUDIT.md           # the per-file licence audit
└── dist/                          # build output (git-ignored)
```

**The three path namespaces.** A path in this design means exactly one of these, and
they are never mixed inside a single reference:

| Namespace | Shape | Meaning |
|---|---|---|
| **Project tree** | `src/…`, `tests/…`, `ci/…`, `docs/…` | A file in this game's own source tree. The tree above is exhaustive: if a path is not in it, it does not exist. |
| **Pack-relative** | `assets/glTF/Fox.gltf`, `kenney/platformer/block-grass.glb` | A file **inside a downloaded pack**, as recorded in the manifest's `source_path`. It is not a project path and is never written by any board. |
| **Design package** | `tools/verify_design.py`, `tools/audit_depth.py` | The gate scripts that check this design. They live outside the game tree on purpose and are not shipped with the game. |

A board that cites a project path outside this tree has named a file that will not
exist; a board that cites a pack-relative path is citing a library asset, which the
asset board resolves and registers.

### 4.2 The two-layer rule

| Layer | May reference | Must not reference |
|---|---|---|
| `src/core/**` | GDScript built-ins, `src/core/math/**` types, other `src/core/**` modules | **Any engine type.** No `Node`, `Node3D`, `Vector3`, `Transform3D`, `PhysicsServer3D`, `Resource`, `FileAccess`, `Input`, `Time`. Core reads its inputs through injected interfaces. |
| `src/systems/**` | `src/core/**`, engine types, `src/content/**` (read-only), `src/assets/**` (read-only) | Another system's internals (§4.4) |

**Why the core is engine-agnostic.** It is the insurance behind the fallback decision (§3.6) and the web fallback (§3.7 D): the simulation, the schemas, the save format, the rulesets and the damage matrix are portable, and only the systems layer is Godot-bound. A web client in TypeScript would re-implement `src/core/**` against the same JSON schemas and the same golden replay checksums.

**Mechanical enforcement.** `ci/gate/core-purity.sh` fails the build if any file under `src/core/**` contains a forbidden engine identifier from the pinned list (`Node`, `Node3D`, `Vector3`, `Vector2`, `Transform3D`, `Basis`, `AABB`, `Resource`, `FileAccess`, `Input`, `Time`, `OS`, `Engine`). The list is versioned with the engine pin.

### 4.3 Ownership boundaries and public interfaces (`REQ-E-003`, `REQ-E-014`, `REQ-E-019`)

Each system owns exactly one directory and exposes one public surface, declared in `src/systems/<system>/api.md` and machine-readable in `src/systems/<system>/api.json` (list of public type and method names). The CI gate `ci/gate/module-boundary.sh` parses every `preload()` / `load()` string under `src/` and fails if it points into a directory that is not the current system's own or `src/core/**`, unless the target is listed in that system's `api.json`.

| System | Owns | Public interface (verbs) | Must never touch |
|---|---|---|---|
| `input` | action map, device binding, dead zones, rebinding, hotplug | `poll_tick(tick) → InputFrame`, `bind(action, device, slot)`, `set_deadzone(device, axis, value)`, `set_conflict_policy(p)`, `remap(profile)` | Player state, any system other than `ui` |
| `physics` | movement profiles, material surfaces, zones (water/wind/ice/mud), kinematic mover, contact resolver | `move(actor, intent, dt) → MotionResult`, `material_at(point) → MaterialProfile`, `zones_at(aabb) → Zone[]`, `resolve_contacts(motion) → Contact[]` | Actor AI, camera |
| `player` | player profiles, the power ladder, the player state machine, damage intake, the character profile data | `profile(profile_id) → PlayerProfile`, `state() → PlayerState`, `apply_damage(event) → DamageOutcome`, `power_state() → PowerState`, `reset(profile_id)` | Actor AI, world graph, save internals |
| `actors` | actor base, FSM runtime, pooling, activation regions | `spawn(archetype_id, transform, context) → ActorHandle`, `despawn(handle)`, `activate_region(aabb)`, `actor_count()` | Camera, UI, world graph |
| `camera` | follow rig, dead zone, look-ahead, scripted tracks, bounds | `attach(target)`, `update(dt)`, `set_bounds(aabb)`, `play_track(track_id)` | Actor transforms, world graph |
| `world` | world graph runtime, node state, unlock predicates, map scenes | `node_state(node_id) → NodeState`, `evaluate_unlocks(state) → UnlockDelta`, `enter_node(node_id, entry)`, `apply_delta(delta)` | Stage interiors, player controller |
| `inventory` | slots, reserve, capacity, consumption, world-use vs stage-use | `add(item_id)`, `consume(item_id, scope)`, `capacity(profile)`, `snapshot()` | Audio, UI |
| `audio` | bus graph, cue registry, ducking, priority, pause behaviour | `play(cue_id, params)`, `set_bus_state(state)`, `duck(bus, amount)`, `active_loops(bus)` | Anything visual |
| `fx` | pooled effect triggers | `emit(effect_id, transform, params)` | Simulation state |
| `ui` | HUD, menus, options, tutorials, confirmation dialogs | `show(screen_id, context)`, `refresh(model)`, `bind_input()` | Simulation writes; reads only through published view models |
| `localisation` | locale tables, font fallback chain, RTL readiness | `text(key, locale)`, `locale()`, `set_locale(l)`, `font_chain(locale)` | UI layout logic |
| `telemetry` | opt-in collector, debug overlay, build id | `enabled()`, `record(event, fields)`, `overlay_toggle()` | Any personal data not on the allow-list |
| `debug` | teleport, invincible, speed adjust, item grant, gate unlock, enemy visualiser | `teleport(target)`, `set_invincible(b)`, `set_speed(mult)`, `grant(item_id)`, `unlock_gate(id)` | Present in production builds — excluded by the export filter (§7.8) |

**The rule that no system reaches into another's internals.** A system's public surface is the *only* legal coupling. Concretely: no system may `load()` a script, scene or resource inside another system's directory; may read another system's private fields; may call a method not listed in that system's `api.json`; or may mutate another system's state except through a published method. Coupling is expressed as **dependency injection at construction time**: `core` publishes interfaces; `systems` publish verbs; `scenes` wire them. A dependency cycle is a gate failure, not a code smell.

**Feature flags live in `src/core/rules`, never in a system.** A ruleset (`classic_ground`, `challenge`, `carry_throw`, `world_map_suits`, `branching_companion`) enables features; systems query `rules.enabled("carry_throw")` and never branch on a ruleset name. A system containing a literal ruleset id is a gate failure — this is what keeps the five rule-sets separate (`REQ-E-007`).

### 4.4 Runtime pipelines (`REQ-E-002`)

Authoritative, from the master document §7.3, restated for the 3D engine:

1. **Gameplay tick** — `input.poll_tick(tick)` → buffered intent → `core` player-state update → `physics.move` → contact resolve → typed damage events → `core` state transitions → animation selection. No rendering work occurs here.
2. **Stage load** — schema validation → level instantiation from data → player spawn → level events → actor activation → camera attach → goal → world-graph update → atomic save.
3. **World map** — node selection → prerequisite validation → stage launch → exit type → unlock transition → save → return to map.
4. **Boss** — trigger → arena lock → intro → attack loop → vulnerability window → damage → phase change → reward → unlock → stage completion.

Render order per frame: **poll input → run N fixed ticks (N = clamped accumulator) → interpolate transforms → render**. The renderer never advances simulation state.

---

## 5. Data schemas (`REQ-E-005`)

### 5.0 Common conventions

- Every file is **UTF-8 JSON**, no comments, no trailing commas, LF endings.
- Every file carries `schema_version` (integer) and `id` (string, `^[a-z0-9][a-z0-9_-]*$`).
- `schema_version` is the **version of that file's own schema**, not of the content. It increments only on a breaking change to that schema.
- Unknown keys are a **validation error** (`SCHEMA-UNKNOWN-KEY`), not a warning — this is what prevents silent data drift.
- All schemas are validated by `src/tools/validate_schema.py` (Python 3.9, JSON Schema draft 2020-12, vendored — no network fetch at CI time).
- All content lives under `src/content/` and is **read-only at runtime**; the runtime never writes content files.

### 5.1 Ruleset — `src/content/rulesets/<id>.ruleset.json` (`REQ-E-007`)

```json
{
  "schema_version": 1,
  "id": "branching_companion",
  "display_name": "Branching & Companion",
  "fixed_hz": 60,
  "movement_profile": "glide_v1",
  "features": {
    "carry_throw": false,
    "mount": true,
    "secret_exits": true,
    "world_inventory": false,
    "flight": false,
    "power_states": false
  },
  "damage_profile": "power_downgrade",
  "lives_enabled": true,
  "constants_ref": "src/content/tuning/branching_companion.tune.json"
}
```

| | |
|---|---|
| **Required** | `schema_version`(=1), `id`, `display_name`, `fixed_hz`, `movement_profile`, `features`, `damage_profile`, `lives_enabled`, `constants_ref` |
| **Feature-flag note (reconciled)** | `carry_throw` is `true` **only** in the `carry_throw` rule set — the example above shows `false` for `branching_companion` (player board `CB-02`). The **charge-glide** is gated by `movement_profile: "glide_v1"` and the **levitation power-up form** is gated by `features.flight`; they are two different mechanics, they never coexist, and no `glide` feature flag is added (player board `CB-03`). The example is **illustrative**; the sealed feature-to-ruleset allocation in `3D-TRANSLATION.md` §5 is normative. |
| **Validation rule** | `id` ∈ the sealed set `{classic_ground, challenge, carry_throw, world_map_suits, branching_companion}`; `fixed_hz` ∈ {30,60,120}; every `features` key ∈ the sealed feature vocabulary and every feature has a boolean value; `constants_ref` must resolve to an existing tuning file whose `ruleset_id` equals this `id`; **feature flags are mutually exclusive across the sealed sets** — a validator check asserts no two rulesets differ only by flipping `carry_throw` (the anti-mash guard for `REQ-E-007`) |
| **Failing example** | `{"schema_version":1,"id":"smb2_plus_smb3","fixed_hz":60,"features":{"carry_throw":true,"mount":true,"secret_exits":true,"world_inventory":true}}` → `RULESET-002 unknown ruleset id 'smb2_plus_smb3' (sealed set: classic_ground, challenge, carry_throw, world_map_suits, branching_companion)` and `RULESET-004 features.world_inventory=true is only permitted in world_map_suits` |

### 5.2 Stage — `src/content/stages/<id>.stage.json`

> **SUPERSEDED IN PART — reconciled to stage schema v2 (2026-10-30).**
> The world board's §2.3 proposes **v2** with 30 top-level fields (v1's 20 required
> fields plus `music_cue_id` plus nine 3D field groups). Its three deltas are accepted:
> **W-01** `music_cue_id` becomes required; **W-02** `placements` is added and `props`
> becomes collider-free by construction; **W-03** the 3D field groups are added.
> **v1 files remain valid** — they keep `schema_version: 1`. New stages use v2.
> The **normative v2 field list, types and ownership** are
> `DESIGN-3-WORLD.md` §2.3. This section is updated here so the two boards do not
> disagree; the field names below are unchanged for v1, and the v2 additions are
> marked.

```json
{
  "schema_version": 2,
  "id": "region01_stage03",
  "world_id": "region01",
  "ruleset_id": "branching_companion",
  "variant": "overworld",
  "bounds": {"min": [0, 0, 0], "max": [240, 28, 16]},
  "entry_spawn": {"id": "spawn_main", "position": [3, 0, 20], "facing": 1},
  "tilemap": {"palette_ref": "src/content/palettes/region01.palette.json", "collision_layers": ["solid", "one_way"], "visual_layers": ["art"], "grid": {"cell": [1,1,1], "origin": [0,0,0], "size": [240,28,16]}},
  "placements": [{"asset_id": "kenney.platformer.block-grass", "cell": [12,0,20], "collision_profile": "solid", "material": "solid"}],
  "props": [{"asset_id": "kenney.platformer.flag", "position": [12, 0, 20], "rotation_y": 0.0, "scale": 1.0}],
  "objects": [{"object_id": "obj.door_01", "kind": "door", "asset_id": "kenney.platformer.door-rotate", "position": [60,0,20]}],
  "camera_zones": [{"id": "cz_main", "trigger_aabb": {"min": [0,0,0], "max": [240,28,16]}, "follow": {"deadzone": [6,3], "look_ahead": [4,0], "bounds": {"min":[0,0,0],"max":[240,28,16]}}}],
  "lane_transitions": [{"id": "lt_01", "aabb": {"min":[120,0,18],"max":[132,8,22]}, "to_lane_z": 18.0, "blend": 0.5}],
  "volumes": [{"id": "vol_01", "kind": "ambient", "aabb": {"min":[0,0,0],"max":[240,28,16]}}],
  "water_volumes": [],
  "wind_volumes": [],
  "portal_volumes": [{"id": "pv_01", "kind": "pipe_forward", "asset_id": "kenney.platformer.pipe", "aabb": {"min":[200,0,19],"max":[202,2,21]}, "axis": [1,0,0], "to_node": "region01_stage04", "return_portal": "pv_02"}],
  "checkpoints": [{"id": "cp01", "position": [96, 0, 20], "captures": ["transient_power_state"]}],
  "exits": [
    {"id": "normal", "type": "primary", "to_node": "region01_stage04", "requires": []},
    {"id": "hidden", "type": "secret", "to_node": "region01_bonus02", "requires": ["key_a"]}
  ],
  "actors": [{"archetype_id": "enemy.ground_walker", "position": [25, 0, 20], "facing": -1}],
  "triggers": [{"id": "tr_spawn_a", "type": "spawn", "aabb": {"min":[20,0,18],"max":[30,6,22]}, "payload": {"archetype_id": "enemy.shell_critter"}}],
  "background": {"skybox_asset_id": "polyhaven.aarfontein_dawn_2", "parallax_layers": []},
  "light_rig": {"preset_id": "rig.region01.day", "ambient": [0.42,0.45,0.52], "sun": {"asset_id": "none", "rotation": [-52,38,0], "energy": 1.1, "color": [1.0,0.96,0.88]}},
  "palette": "palette.region01.meadow_day",
  "timer_policy": {"mode": "countdown", "limit_seconds": 300, "pauses_in_menu": true},
  "difficulty_tag": "intro",
  "music_cue_id": null,
  "goal_reward": {"kind": "exit_card", "score_table_ref": "src/content/scoring/region01.score.json"},
  "save_flags": [],
  "qa_tags": ["teaches_hidden_block"]
}
```

| | |
|---|---|
| **Required** | `schema_version`, `id`, `world_id`, `ruleset_id`, `variant`, `bounds`, `entry_spawn`, `tilemap`, `placements`, `props`, `objects`, `actors`, `triggers`, `camera_zones`, `lane_transitions`, `volumes`, `water_volumes`, `wind_volumes`, `portal_volumes`, `checkpoints`, `exits` (≥1), `background`, `light_rig`, `palette`, `timer_policy`, `difficulty_tag`, **`music_cue_id`**, `goal_reward`, `save_flags`, `qa_tags` — **30 top-level fields** (v2). v1's 20-field set remains valid for files with `schema_version: 1`. |
| **Validation rule** | Every `ruleset_id` resolves to a ruleset; every `archetype_id` and `object_id` resolves to an actor archetype or object definition; every `asset_id` resolves to an entry in the asset manifest (§5.8) **and** that entry is permitted in the active ship profile; `entry_spawn.position` and every `checkpoint.position` lie inside `bounds`; each `exits[].to_node` resolves to a node in the world graph (§5.6) and `exits[].requires` names only flags declared by that world; `variant` ∈ the 13 sealed biome variants; `timer_policy.limit_seconds` > 0; **`music_cue_id` may be `null` but the field itself is required, and a `null` cue forces the `music_unsourced` qa_tag**; every `placements[].asset_id` resolves to an asset with a `collision_profile` and a `material`; `props[]` entries **must not** carry a collider — the linter rejects `props[].collision_profile`; every `portal_volumes[].to_node` resolves in the world graph and each declares a `return_portal`; `lane_transitions[].to_lane_z` lies inside the stage's Z bounds |
| **Failing example** | `{"schema_version":2,"id":"region01_stage09","world_id":"region01","ruleset_id":"classic_ground","variant":"overworld","bounds":{"min":[0,0,0],"max":[240,28,16]},"entry_spawn":{"id":"s","position":[300,0,20],"facing":1},"tilemap":{"palette_ref":"src/content/palettes/region01.palette.json"},"placements":[{"asset_id":"kenney.platformer.lava-block","cell":[4,0,20],"collision_profile":"solid","material":"solid"}],"props":[{"asset_id":"kenney.platformer.block-grass","position":[5,0,20],"collision_profile":"solid"}],"actors":[{"archetype_id":"enemy.ground_walker"}],"exits":[{"id":"normal","type":"primary","to_node":"nowhere"}]}` → `STAGE-004 entry_spawn.position x=300 is outside bounds.max.x=240` · `STAGE-009 asset_id 'kenney.platformer.lava-block' is not in the asset manifest` · `STAGE-014 props[0].collision_profile is forbidden — props are collider-free dressing; use placements[]` · `STAGE-011 exit 'normal' target node 'nowhere' does not exist in world 'region01'` |

### 5.3 Actor archetype — `src/content/actors/<id>.actor.json`

> **Where the player profiles live.** The four **player profiles** are character
> profiles, not enemy/boss archetypes, and they live in
> `src/content/characters/<profile_id>.character.json` — for example
> `src/content/characters/profile_tallow.character.json`. They use **this same
> actor-archetype schema** with `"kind": "player"`, and their archetype `id` stays
> `player.<profile_id>` so that a stage can reference a profile by the same id
> whether it is the player or an enemy. The split is deliberate: the **player
> board** owns `src/content/characters/**` and the **entities board** owns
> `src/content/actors/**`, so no two boards write the same file.

```json
{
  "schema_version": 1,
  "id": "enemy.ground_walker",
  "kind": "enemy",
  "rig": {"asset_id": "kenney.platformer.character-oobi", "bone_map_id": "kenney_cast_6", "clip_set_id": "kenney_cast_25"},
  "collider": {"shape": "capsule", "radius": 0.45, "height": 1.8, "layer": "actor", "mask": ["solid", "one_way", "actor"]},
  "health": 1,
  "damage": {"contact": 1, "resistances": {"stomp": "take", "contact": "take", "environment": "take"}},
  "tags": ["stompable", "grounded"],
  "faction": "hostile",
  "movement": {"controller": "patrol_edge_turn", "speed_mps": 1.8, "turn_on_ledge": true, "turn_on_obstacle": true},
  "states": {
    "spawn": {"on": [], "timer_ticks": 1, "next": {"idle": "timer_expired"}},
    "idle": {"on": [], "timer_ticks": 60, "next": {"patrol": "timer_expired"}},
    "patrol": {"on": [{"event": "blocked", "to": "idle"}], "timer_ticks": null, "next": {"idle": "blocked"}},
    "defeated": {"on": [], "timer_ticks": 30, "next": {"despawn": "timer_expired"}},
    "despawn": {"on": [], "timer_ticks": null, "next": {}}
  },
  "parts": [],
  "despawn": {"policy": "camera_margin", "margin_m": 12.0},
  "activation": {"region_id": null, "sleep": "camera"},
  "drops": [],
  "audio": {"defeat_cue_id": "sfx.explosion_a"}
}
```

**Two additions this example carries, and why.** (1) The **`spawn`** state is the
twelfth state of the archetype FSM. `REQ-C-002` names eleven, and `spawn` is the
twelfth — required by pooling and by `REQ-E-016`'s clean reload. (2) **`parts[]`** is
declared (empty here) for **multi-part actors** — the three candle heads, the airship's
hull and pilot — which have their own `id`, `health`, `hitbox` and `armour` but are
**not** separate actors: they get no pool entry, no FSM and no death. Both additions are
the entities board's `XN-ENT-03` and `XN-ENT-13`, now settled in the schema rather than
in a note.

| | |
|---|---|
| **Required** | `schema_version`, `id`, `kind` ∈ {player, enemy, boss, companion, projectile, carried_object}, `rig`, `collider`, `health`, `damage`, `tags`, `faction`, `movement`, `states`, `despawn`, `activation`, `drops`, `audio`, `parts` (may be empty) |
| **Validation rule** | Every state has at least one outgoing transition **unless** it is a terminal state; every `timer_ticks` is `null` or an integer in 1..3600; every transition target is a declared state; `movement.controller` ∈ the sealed controller vocabulary; `damage.resistances` values ∈ {take, half, zero, immune}; `rig.asset_id` resolves to a manifest entry and `rig.bone_map_id` resolves to a declared bone map whose family matches the asset's rig family (§2.2); **no archetype may name a ruleset id** (§4.3); every state in the archetype's FSM that the archetype declares must be a member of the sealed twelve-state vocabulary, which includes **`spawn`** |
| **Damage authority — the matrix key** | The damage matrix lives at `src/content/damage/resistance_matrix.json` and is keyed by **`(damage_type × matrix_state × normal_bin) → outcome`** — **three** axes, not two. `damage_type` ∈ {`contact`, `stomp`, `projectile`, `thrown`, `moving_shell`, `environment`, `crush`, `fall`, `poison`}; `matrix_state` is the target's resolved state (nine named columns); `normal_bin` ∈ {`any`, `front`, `back`, `side`, `top`}, derived from the contact normal. The third axis is what lets a front-struck shell hurt the player while a back-struck one bounces. A lookup that finds neither a bin-specific row nor an `any` row **fails** with `DAMAGE-006` — it never falls back silently. The archetype's own `damage.resistances` map supplies the **resistance column**; the board that owns the roster is the entities board (§2.3), and this key is the architecture board's published form of it |
| **Failing example** | `{"schema_version":1,"id":"enemy.shell_critter","kind":"enemy","rig":{"asset_id":"kenney.platformer.character-oobi","bone_map_id":"kaykit_41"},"collider":{"shape":"capsule","radius":0.45,"height":1.8},"health":1,"damage":{"contact":1},"tags":[],"faction":"hostile","movement":{"controller":"patrol","speed_mps":1.8},"states":{"patrol":{"on":[],"timer_ticks":null,"next":{"idle":"never"}}},"despawn":{"policy":"never"},"activation":{},"drops":[],"audio":{}}` → `ACTOR-007 state 'patrol' transition target 'idle' is not a declared state`, `ACTOR-009 bone_map_id 'kaykit_41' is not valid for rig family 'kenney_cast_6' (expected a map in family 'kenney_cast_6')`, `ACTOR-011 required field 'damage.resistances' missing`, `ACTOR-012 despawn.policy 'never' is not permitted (bounded policies only)` |

### 5.4 Item — `src/content/items/<id>.item.json`

```json
{
  "schema_version": 1,
  "id": "item.mushroom_growth",
  "kind": "power_up",
  "stackable": false,
  "max_stack": 1,
  "icon": {"asset_id": "kenney.platformer.mushrooms"},
  "effect": {"type": "power_state", "target": "growth", "value": 1},
  "physics": {"spawn": {"mode": "emerge", "rise_mps": 1.1, "delay_ticks": 24}, "gravity_mps2": 24.0, "bounce": 0.0},
  "respawn_policy": "never",
  "licence_ref": "manifest:kenney.platformer.mushrooms"
}
```

| | |
|---|---|
| **Required** | `schema_version`, `id`, `kind` ∈ {power_up, negative, currency, extra_life, boost, restorative, score_token}, `stackable`, `max_stack`, `icon`, `effect`, `physics`, `respawn_policy`, `licence_ref` |
| **Validation rule** | `effect.type` ∈ the sealed effect vocabulary; `kind: negative` **must** not have an `effect` of type `power_state` and must declare `harm: true`; `stackable: false` ⇒ `max_stack == 1`; `icon.asset_id` and `licence_ref` resolve in the manifest; `licence_ref` must match the manifest id of the icon asset (the licence travels with the reference — `REQ-E-012`) |
| **Failing example** | `{"schema_version":1,"id":"item.poison_shroom","kind":"power_up","stackable":false,"max_stack":3,"icon":{"asset_id":"kenney.platformer.mushrooms"},"effect":{"type":"power_state","target":"growth"},"physics":{"spawn":{"mode":"emerge"},"gravity_mps2":24.0},"respawn_policy":"never"}` → `ITEM-004 kind 'power_up' with negative semantics must set kind='negative' and harm=true` and `ITEM-006 stackable is false but max_stack is 3` and `ITEM-008 missing required field 'licence_ref'` |

### 5.5 Block — `src/content/blocks/<id>.block.json`

```json
{
  "schema_version": 1,
  "id": "block.brick_payload",
  "material": "breakable",
  "collision": {"layer": "solid", "mask": ["actor"], "shape": "box"},
  "states": {"idle": {"visual": "kenney.platformer.brick"}, "hit": {"visual": "kenney.platformer.brick", "flash_ticks": 8}, "empty": {"visual": null, "collidable": false}},
  "payload": {"kind": "item", "item_id": "item.coin_gold", "amount": 1, "spawn_offset": [0, 1, 0]},
  "damage_permissions": {"breakable": true, "bumpable": true, "destructible_by": ["stomp", "spin_jump"]},
  "bounce": {"impulse_mps": 6.0, "player_only": true},
  "audio": {"hit_cue_id": "sfx.coin_a"}
}
```

| | |
|---|---|
| **Required** | `schema_version`, `id`, `material` ∈ {solid, breakable, bumpable, invisible, one_way, slope, hurt, liquid, decorative}, `collision`, `states` (must contain `idle`), `damage_permissions`, `bounce` |
| **Validation rule** | `material` and `collision` are **independent** (art may change without changing collision — `REQ-D-001`); `states` must include `idle`; a `payload` of kind `item` must name a valid `item_id`; `bounce.impulse_mps` ≥ 0; `damage_permissions.breakable` requires `material ∈ {breakable, bumpable}`; a block with `material: invisible` must set `states.idle.visual` to `null` |
| **Failing example** | `{"schema_version":1,"id":"block.invisible_coin","material":"solid","collision":{"layer":"solid"},"states":{"idle":{"visual":null}},"damage_permissions":{"breakable":true,"bumpable":true},"bounce":{"impulse_mps":6.0}}` → `BLOCK-005 material 'solid' is not in {breakable, bumpable} but damage_permissions.breakable is true` and `BLOCK-008 payload is required when material is breakable or bumpable` and `BLOCK-010 material 'invisible' requires states.idle.visual to be null (it is 'solid-model')` |

### 5.6 World-map node — `src/content/worlds/<world_id>.world.json`

```json
{
  "schema_version": 1,
  "id": "region01",
  "display_name": "Meadow",
  "ruleset_id": "classic_ground",
  "nodes": [
    {"id": "region01_stage01", "kind": "stage", "position": [0, 0], "entry": "start", "exits": [{"to": "region01_stage02", "type": "primary"}], "requires": []},
    {"id": "region01_stage02", "kind": "stage", "position": [1, 0], "entry": "west", "exits": [{"to": "region01_stage03", "type": "primary"}, {"to": "region01_bonus02", "type": "secret", "requires": ["key_a"]}], "requires": []}
  ],
  "flags": {"key_a": {"kind": "item", "item_id": "item.key_a"}},
  "encounters": [],
  "completion": {"required_nodes": ["region01_stage05"], "final_boss_node": "region01_boss01"}
}
```

| | |
|---|---|
| **Required** | `schema_version`, `id`, `display_name`, `ruleset_id`, `nodes` (≥1), `flags`, `encounters`, `completion` |
| **Validation rule** | `nodes[].id` is globally unique; every `exits[].to` resolves to a node **in this world or a declared world**; a node may not be its own exit; every `requires` name resolves to a key in `flags`; `flags[*].kind == "item"` ⇒ `item_id` resolves; `completion.required_nodes` resolve and each is reachable from the entry node by a path of non-secret edges; the world graph validator (§7.3) additionally proves a reachable ending |
| **Failing example** | `{"schema_version":1,"id":"region01","display_name":"Meadow","ruleset_id":"classic_ground","nodes":[{"id":"region01_stage01","kind":"stage","position":[0,0],"exits":[{"to":"region01_stage01","type":"primary"}],"requires":["key_z"]}],"flags":{"key_a":{"kind":"item","item_id":"item.key_a"}},"encounters":[],"completion":{"required_nodes":["region01_stage01"],"final_boss_node":"region01_boss01"}}` → `WORLD-003 node 'region01_stage01' has an exit to itself`, `WORLD-005 requires 'key_z' is not declared in flags (declared: key_a)`, `WORLD-008 completion.final_boss_node 'region01_boss01' does not resolve to a node` |

### 5.7 Save slot — `src/content/save/save.schema.json` (the on-disk shape)

```json
{
  "schema_version": 6,
  "slot_id": "slot_01",
  "checksum": "sha256:9f2c…",
  "written_at_utc": "2026-10-30T09:14:02Z",
  "build_id": "bld-2026-10-30-a91f2c",
  "ruleset_id": "classic_ground",
  "profile_id": "profile_01",
  "world_graph": {"visited_nodes": ["region01_stage01"], "completed_exits": ["region01_stage01:normal"], "unlocked_nodes": ["region01_stage02"], "secret_routes": []},
  "flags": {"key_a": false, "switch_region01_a": true},
  "inventory": {"slots": [], "reserve": null, "capacity": 2},
  "player": {"lives": 5, "coins": 0, "score": 0, "power_state": "small"},
  "last_checkpoint": {"stage_id": "region01_stage01", "checkpoint_id": "cp01"},
  "settings": {"locale": "en-GB", "master_volume": 0.8, "reduced_flashing": false, "bindings": {}, "input": {"deadzone": 0.15}, "assist_mode": false, "assist_toggle_jump": false, "ui_scale": 1.0, "captions": false, "high_contrast_hud": false, "colour_safe_palette": false},
  "stats": {"deaths_by_stage": {"region01_stage01": 2}, "playtime_seconds": 431}
}
```

| | |
|---|---|
| **Required** | `schema_version`, `slot_id`, `checksum`, `written_at_utc`, `build_id`, `ruleset_id`, `profile_id`, `world_graph`, `flags`, `inventory`, `player`, `last_checkpoint`, `settings`, `stats` — and, inside `settings`, **`bindings`, `input`, `assist_mode`, `assist_toggle_jump`, `ui_scale`, `captions`, `high_contrast_hud`, `colour_safe_palette`** in addition to `locale`, `master_volume` and `reduced_flashing`. These eight carry the remappable input bindings and the accessibility options, so they survive a restart as `REQ-A-001` and `REQ-D-020` require. (Reconciled from the player board's `BLOCKED-P-01` / `CB-01`.) |
| **Validation rule** | `checksum` is `sha256:` + hex of the canonical serialisation of the payload **excluding** the `checksum` field; `slot_id` matches `^slot_[0-9]{2}$`; `ruleset_id` ∈ the sealed ruleset set; `world_graph.completed_exits` entries are `<node_id>:<exit_id>` and both halves resolve; `inventory.slots` length ≤ `inventory.capacity`; `flags` values are booleans; `schema_version` must be ≤ the version the build understands, or the loader must find a migration path (§6.4) |
| **Failing example** | `{"schema_version":3,"slot_id":"slot_01","checksum":"sha256:deadbeef","written_at_utc":"2026-10-30T09:14:02Z","build_id":"bld-1","ruleset_id":"smb1_mixed","profile_id":"profile_01","world_graph":{"visited_nodes":[],"completed_exits":["region01_stage01:normal"],"unlocked_nodes":[],"secret_routes":[]},"flags":{"key_a":"yes"},"inventory":{"slots":[],"reserve":null,"capacity":2},"player":{"lives":5,"coins":0,"score":0,"power_state":"small"},"last_checkpoint":{"stage_id":"region01_stage01","checkpoint_id":"cp01"},"settings":{"locale":"en-GB","master_volume":0.8,"reduced_flashing":false},"stats":{}}` → `SAVE-003 checksum mismatch: computed sha256:a1c4… != stored sha256:deadbeef`, `SAVE-005 ruleset_id 'smb1_mixed' is not a sealed ruleset id`, `SAVE-007 flags.key_a must be boolean, got string` |

### 5.8 Asset manifest — `src/assets/asset_manifest.json`

```json
{
  "schema_version": 1,
  "generated_at_utc": "2026-10-30T08:00:00Z",
  "generator": "src/tools/asset_manifest.py@1.0.0",
  "ship_profile": "cc0_3d_only",
  "assets": [
    {
      "asset_id": "kenney.platformer.block-grass",
      "source_pack": "shorepine-kenney.zip",
      "source_path": "shorepine-kenney/3d/platformer/block-grass.glb",
      "format": "glb",
      "licence": {"spdx": "CC0-1.0", "creator": "Kenney", "source_url": "https://github.com/atiffhussainkhan/Image/releases/download/mega-assets-expansion-v1/shorepine-kenney.zip", "attribution_required": false, "modifications": ["uniform_scale:1.0", "recentre:pivot_base_centre"]},
      "measurements": {"bbox_min": [-0.5, 0.0, -0.5], "bbox_max": [0.5, 1.0, 0.5], "size_m": [1.0, 1.0, 1.0], "footprint_m2": 1.0, "ground_offset_m": 0.0, "pivot": "base_centre"},
      "rig": null,
      "clips": [],
      "pack": "core_world.pck",
      "lod": "l0",
      "expected_instances": 412
    },
    {
      "asset_id": "kenney.platformer.character-oobi",
      "source_pack": "shorepine-kenney.zip",
      "source_path": "shorepine-kenney/3d/platformer/character-oobi.glb",
      "format": "glb",
      "licence": {"spdx": "CC0-1.0", "creator": "Kenney", "source_url": "https://github.com/atiffhussainkhan/Image/releases/download/mega-assets-expansion-v1/shorepine-kenney.zip", "attribution_required": false, "modifications": ["uniform_scale:1.0", "recentre:pivot_base_centre"]},
      "measurements": {"bbox_min": [-0.35, 0.0, -0.35], "bbox_max": [0.35, 1.72, 0.35], "size_m": [0.7, 1.72, 0.7], "footprint_m2": 0.49, "ground_offset_m": 0.0, "pivot": "base_centre"},
      "rig": {"family": "kenney_cast_6", "joints": 6, "bone_map_id": "kenney_cast_6"},
      "clips": ["static", "idle", "walk", "sprint", "jump", "fall", "crouch", "sit", "drive", "die", "pick-up", "emote-yes", "emote-no", "holding-right", "holding-left", "holding-both", "holding-right-shoot", "holding-left-shoot", "holding-both-shoot", "attack-melee-right", "attack-melee-left", "attack-kick-right", "attack-kick-left", "interact-right", "interact-left"],
      "pack": "actors.pck",
      "lod": "l0",
      "expected_instances": 0
    }
  ]
}
```

| | |
|---|---|
| **Required — per asset entry** | `asset_id`, `source_pack`, `source_path`, `format`, `licence.spdx`, `licence.creator`, `licence.source_url`, `licence.attribution_required`, `licence.modifications`, `measurements.bbox_min`, `measurements.bbox_max`, `measurements.size_m`, `measurements.footprint_m2`, `measurements.ground_offset_m`, `measurements.pivot`, `pack`, `lod` |
| **Required — manifest file** | `schema_version`, `generated_at_utc`, `generator`, `ship_profile`, `assets` |
| **Validation rule** | `asset_id` unique; `status` ∈ {`SHIPPABLE`, `PENDING`, `DERIVED`, `OUT_OF_SCOPE`, `GAP`} and must agree with the gap decision recorded for that element in the asset board §13 (a decided gap may never be published as `GAP`, and an unresolved one may never be published as `DERIVED` or `OUT_OF_SCOPE`); `format` ∈ {glb, gltf, fbx, blend, obj, png, jpg, ttf, ogg, flac, wav, hdr, tres}; `licence.spdx` ∈ the **approved set** `{CC0-1.0, MIT, CC-BY-4.0}`; `source_path` resolves under an allowed source root **and** exists on disk; `source_path` must not resolve inside a pack whose `licence_status` is `PACK_LEVEL`; `licence.modifications` entries must all be in the **permitted-transform vocabulary** (§8.3); `measurements` must match a re-measure of the file within 0.5 % tolerance (the manifest is **verified**, not asserted); `rig.family` must be one of the measured families (§2.2); every `pack` must be one of the declared bundle names; `ship_profile` must be a declared profile |
| **Failing example** | `{"asset_id":"jam.mystery_pack.hero","source_pack":"jam-ready-assets.zip","source_path":"jam-ready-assets/hero.glb","format":"glb","licence":{"spdx":"UNKNOWN","creator":"?","source_url":"","attribution_required":false,"modifications":["procedural_remesh"]},"measurements":{...},"pack":"core_world.pck","lod":"l0"}` → `ASSET-LICENCE-001 licence.spdx 'UNKNOWN' is not in the approved set {CC0-1.0, MIT, CC-BY-4.0}`, `ASSET-LICENCE-004 source_pack 'jam-ready-assets.zip' has licence_status PACK_LEVEL and is excluded from every ship profile`, `ASSET-PIPELINE-002 modification 'procedural_remesh' is not in the permitted-transform vocabulary` |

### 5.9 Registry and cross-reference rules

- **Registry:** `src/core/data/registry.gd` holds id → loaded resource maps for rulesets, stages, archetypes, items, blocks, worlds and manifest assets. All ids are validated at load; a missing id is a hard error with the referencing file named (`REQ-E-005` acceptance: *"Invalid entity reference fails content validation with clear error"*).
- **Forward references** are resolved lazily by id, never by index, so a file may be reordered freely.
- **Version pinning:** each registry records the `schema_version` it loaded; a registry that contains two files of the same type with different `schema_version` values fails to load.

---

## 6. Save system (`REQ-E-006`, `NFR-06`)

### 6.1 Storage layout

```
<userdata>/saves/
├── slot_01.json          # current
├── slot_01.bak.1.json    # previous generation
├── slot_01.bak.2.json
├── slot_01.bak.3.json
├── slot_01.json.tmp      # staging file (in-flight write)
└── slot_01.corrupt.<utc-timestamp>.json   # quarantined, never auto-deleted
```

### 6.2 Atomic write protocol

1. Serialise the payload to canonical JSON (sorted keys, fixed float precision, LF).
2. Compute `checksum = sha256(payload-without-checksum)`.
3. Write `slot_01.json.tmp`; `flush()`; `fsync()`.
4. Rotate the backup ring: `bak.3` ← `bak.2` ← `bak.1` ← `slot_01.json`.
5. `rename(slot_01.json.tmp → slot_01.json)` — a same-filesystem POSIX rename, which is atomic.
6. `fsync()` the directory.

**Interrupted-write guarantee.** A crash at any point before step 5 leaves `slot_01.json` untouched; the partial file exists only as `.tmp` and is discarded on next load. A crash between steps 4 and 5 leaves the current slot valid and the backup ring rotated — the slot is still loadable, and the previous generation is available. **An interrupted save never replaces the last valid save** (`REQ-E-006` acceptance).

**Simulation stall.** Serialisation happens on a background thread; the main thread hands over an immutable snapshot and is notified when the rename completes. The simulation thread never blocks on I/O. A save during a frame costs one snapshot copy, not a file write.

### 6.3 Backup ring

Three generations, rotated on every successful write. The ring is the corruption fallback (§6.5) and also allows "undo to previous save" if that feature is ever wanted.

### 6.4 Migration table

Migrations are pure functions `v(n) → v(n+1)` applied in sequence at load. The chain is data-driven and stored in `src/core/save/migrations/` with a registry.

| From → To | Change | Rule |
|---|---|---|
| 1 → 2 | `completed_exits` split from `completed_levels`; `flags` promoted from an array to a map | array → map with `false` defaults; ids preserved |
| 2 → 3 | `player` split from `player_stats`; `settings` added; `checksum` field introduced | values copied verbatim; `settings` defaults from the build's defaults |
| 3 → 4 | `world_graph.secret_routes` added | defaults to `[]` |
| 4 → 5 | `inventory.reserve` moved under `inventory`; `profile_id` added | single-slot move; `profile_id` defaults to `profile_01` |
| 5 → 6 | `settings` gains `bindings`, `input`, `assist_mode`, `assist_toggle_jump`, `ui_scale`, `captions`, `high_contrast_hud`, `colour_safe_palette` | the eight new keys take the build defaults listed in `DESIGN-3-PLAYER.md` §10.4; the existing `reduced_flashing` is copied verbatim; `bindings` starts empty, meaning "the default binding set". Reconciled from the player board's `BLOCKED-P-01` / `CB-01`. |

**Rules.** (a) A migration never loses a value that a later version cannot express — if it cannot, the migration records a `lossy: true` entry in `stats.migration_log` and the loader surfaces it in the debug overlay. (b) A save with `schema_version` **greater** than the build understands is **refused**, not truncated; the file is left intact and the player is told the save is from a newer build. (c) Migration is applied in memory; the migrated save is written back only on the next explicit save, so a failed migration cannot destroy the original. (d) Each migration has a unit test with a hand-written v(n) fixture and an asserted v(n+1) fixture — the golden files live in `tests/golden/saves/`.

### 6.5 Corruption fallback

On load, for each candidate in order `slot_01.json`, `bak.1`, `bak.2`, `bak.3`:

1. Parse the JSON. On parse failure → next candidate, reason `parse_error`.
2. Verify `checksum`. On mismatch → next candidate, reason `checksum_mismatch`.
3. Validate against the save schema. On failure → next candidate, reason `schema_invalid`.
4. Apply migrations. On failure → next candidate, reason `migration_failed`.

If **all** candidates fail: the game starts a **new slot** for that id, copies every failed candidate to `slot_01.corrupt.<utc>.json` for diagnosis, and reports "save could not be read — a new game has been started" in the UI. **The corrupt files are never overwritten or deleted by the game.** The recovery log is written to the structured log (`build_id`, `slot_id`, `candidate`, `reason`, `checksum_expected`, `checksum_actual`).

### 6.6 Save triggers and scope

| Trigger | What is saved |
|---|---|
| Stage exit, world-map node change, item purchase, setting change, manual save | Full slot |
| Death | `last_checkpoint` and transient player state only (checkpoint capture semantics, `REQ-B-005`) |
| Boss defeat | Full slot (region unlock) |
| Quit | Full slot, on clean shutdown |

**Ruleset isolation (`REQ-E-007`).** A slot records the `ruleset_id` it was created under. Switching rulesets **never mutates saved data**: the ruleset id is stored in a separate per-ruleset namespace so that `classic_ground` and `challenge` slots cannot read each other's progress. The acceptance test asserts that loading a `classic_ground` slot under `challenge` returns the `challenge` namespace state and leaves the `classic_ground` namespace byte-identical.

---

## 7. CI pipeline (`REQ-E-008`, `REQ-E-017`, `REQ-E-018`)

### 7.1 Pipeline stages and gate names

Every gate is a separate, named, individually re-runnable step. A failure names the gate, the file, and the rule that failed.

| # | Gate name | Runs on | Fails on |
|---|---|---|---|
| 1 | `gate/lint` | push, PR | Formatting, unresolved `preload` of a missing file, forbidden engine identifier in `src/core/**`, a system referencing another system's internals |
| 2 | `gate/schema` | push, PR | Any content file failing its JSON Schema; any unknown key; any cross-reference that does not resolve |
| 3 | `gate/unit` | push, PR | Any headless unit test failure (physics maths, schema models, event bus, save codec, migration chain) |
| 4 | `gate/integration` | push, PR | Any headless scene test failure (damage pipeline, inventory, world graph, ruleset switching, scene transitions) |
| 5 | `gate/replay-determinism` | push, PR | A golden physics replay whose checksum differs from `tests/golden/*.checksum`; a launch checksum mismatch |
| 6 | `gate/content-lint` | push, PR | Level-linter errors: camera limits, invalid spawns, unreachable mandatory targets, embedded collision, missing assets (`REQ-E-010`) |
| 7 | `gate/world-graph` | push, PR | A world graph with an unreachable ending, a dead end, an alternative exit that does not branch, or a secret prerequisite that no node can satisfy (`REQ-E-009`) |
| 8 | `gate/screenshot-diff` | push, PR (non-blocking label on docs-only PRs) | A visual diff above the per-shot pixel threshold, or a missing baseline (`REQ-E-017`) |
| 9 | `gate/audio-smoke` | push, PR | A cue that resolves to no shipped file, a bus with two active loops, a missing file, an undecodable file, or a cue louder than the loudness ceiling (`REQ-D-015`, `REQ-E-017`) |
| 10 | `gate/no-procedural-art` | push, PR | Any runtime geometry or texture synthesis API in gameplay code; any mesh-bearing node whose mesh is not traceable to a manifest entry (`REQ-E-012` and the asset rule) |
| 11 | `gate/asset-licence` | push, PR | An asset without licence metadata, an unknown licence, a reference to a `PACK_LEVEL` pack, a reference to the unverified 2D set under a release profile, or a content file referencing an unregistered asset (`REQ-E-012`, `NFR-07`) |
| 12 | `gate/packaging` | push, PR | A missing export template, a missing bundle, a ship-set size over budget (§9.4), or a bundle containing a file not in the manifest |
| 13 | `gate/release-audit` | tag, release | Missing attribution, licence manifest, privacy notice, build metadata or crash-log handler; a non-zero unlicensed-asset count (`REQ-E-018`) |
| 14 | `gate/perf-budget` | nightly, release | Frame-time or entity-budget violations on the baseline runner (§9) |

**Gate order is a DAG, not a chain.** Gates 2, 3, 5, 10 and 11 are independent and run in parallel; 8 and 9 depend on 2 and 3; 12 depends on all content gates; 13 depends on 12; 14 runs on the merge commit. A PR is green when all non-blocking-labelled gates pass.

### 7.2 Headless test runners

| Suite | Runner | Invocation |
|---|---|---|
| Unit | in-repo runner `src/tools/test/run_tests.gd` — discovers `tests/unit/**/*_test.gd`, no third-party addon | `godot --headless --path . -s res://src/tools/test/run_tests.gd --suite unit` |
| Integration | same runner, `--suite integration`; loads real scenes in headless mode | `godot --headless --path . -s res://src/tools/test/run_tests.gd --suite integration` |
| Replay | `src/tools/test/run_replays.gd` — feeds recorded tick-level input to the core and compares checksums | `godot --headless --path . -s res://src/tools/test/run_replays.gd` |
| End-to-end | `src/tools/test/run_e2e.gd` — a scripted play session through the bootstrap scene, asserting the save round-trip | `godot --headless --path . -s res://src/tools/test/run_e2e.gd` |
| Schema / lint / graph | Python 3.9 tools, matching the repository's existing `tools/verify_design.py` convention | `python3 src/tools/validate_schema.py`, `python3 src/tools/level_linter.py`, `python3 src/tools/world_map_validator.py` |
| Asset audit | Python 3.9 | `python3 src/tools/asset_audit.py --profile cc0_3d_only --fail-on-unlicensed` |

**Why an in-repo runner rather than a test addon.** The runner is 100 % under our control, adds no third-party licence to the project, cannot drift from the engine pin, and runs identically on the CI image. A third-party addon is a dependency the licence gate would then have to audit.

**CI image.** A pinned container/VM image digest is recorded in `ci/runner-image.txt`. The runner installs the pinned Godot binary and verifies its SHA-256 before any test runs. `gate/lint` additionally asserts `godot --version` output equals the contents of `godot.version`.

### 7.3 Content lint and world-graph validation

- **Level linter** (`REQ-E-010`) checks, per stage: camera bounds enclose the stage bounds; every spawn and checkpoint is inside the bounds and not inside solid geometry; every mandatory target (exit, key, boss trigger) is reachable from the entry spawn by a movement-aware search over the collision volumes; no interactive volume is embedded inside another solid volume; every referenced asset is in the manifest; every `exits[].requires` flag is obtainable within the stage.
- **World-graph validator** (`REQ-E-009`) builds the directed graph of nodes and exits and proves: (a) from each world's entry node there is a path to the world's `completion.required_nodes`; (b) every main progression path terminates in a reachable ending; (c) every secret exit's prerequisites are satisfiable by some node in the graph; (d) no node is unreachable except those explicitly marked `hidden`; (e) the graph is acyclic within a world except for declared loops.
- Both emit **actionable** errors: `file`, `field`, `rule`, `offending value`, and the nearest valid alternative when one exists.

### 7.4 Screenshot-diff harness

1. A fixture file lists **fixed camera poses** (position, rotation, FOV) per scene, plus the exact tick count to settle before capture.
2. The harness runs the scene headless on a Linux runner under `xvfb-run -a` with `--rendering-driver opengl3`, advances the simulation to the specified tick, renders, and writes a PNG to `artifacts/screenshots/<build_id>/<shot>.png`.
3. Baselines live in `tests/golden/screenshots/`. The comparison is Node 20 + `pixelmatch` + `pngjs` (Node is already the repository's CI language).
4. **Threshold policy:** changed-pixel ratio ≤ 0.1 % → pass; 0.1 % – 1 % → pass with a warning and the diff is uploaded; > 1 % → fail, and the diff image is uploaded as the artefact. New shots with no baseline → fail with "baseline missing" (a new shot must be reviewed and accepted, which records the baseline).
5. Diffs are uploaded as build artefacts so a reviewer sees the picture, not just a number (`REQ-E-017` acceptance: *"Visual changes produce reviewable diffs"*).

**Known limitation (stated, not hidden).** The visual diff compares a fixed camera pose and a settled tick; it does not capture continuous animation or lighting variation. Deterministic rendering therefore depends on a fixed random seed and a fixed time-of-day value in the harness.

### 7.5 Audio smoke test

Because headless Godot uses a dummy audio driver, the audio gate is **static and deterministic**, not a listening test:

1. **Cue resolution.** Every id in the cue registry resolves to a shipped file in the manifest, to an explicit `DERIVED` marker (content mixed in-engine from shipped assets by a named rule — currently only the ambience beds, `G-06`), to an explicit `UNSOURCED` marker, or to an explicit `SILENT` marker. A cue that resolves to none of the four fails.
2. **File presence and decodability.** Each shipped audio file exists in the bundle and decodes (the gate decodes it through the engine's audio loader in headless mode and asserts a non-zero sample count and a non-zero length).
3. **Loop exclusivity.** The music bus and the ambience bus state machines assert that at most one loop is active per bus at any time, and that switching cues cross-fades rather than overlaps (`REQ-D-015` acceptance).
4. **Priority and ducking.** The priority table resolves deterministically: with three cues requested on one bus, the winner is the highest priority, ties broken by cue id (stable ordering, no RNG).
5. **Loudness ceiling.** Peak and integrated loudness per file are measured offline (`ffmpeg -f null -` with `ebur128` where available) and must be within the configured ceiling; the measurement is recorded in the build artefact.
6. **Music gap is explicit.** Because the corpus contains **zero music files** (§2.3), the music cue registry is populated with `UNSOURCED` markers and the gate asserts that the mixer still starts, ducks, and stops correctly with no music loaded. The gate reports `music_cues_unsourced: N` — a visible, counted gap, never a silent one.

### 7.6 Asset licence check (`REQ-E-012`, `REQ-E-018`, `NFR-07`)

`src/tools/asset_audit.py` performs, in order:

1. **Manifest completeness.** Every entry has `licence.spdx`, `creator`, `source_url`, `attribution_required`, `modifications`, and full `measurements`.
2. **Approved licence set.** `spdx` ∈ `{CC0-1.0, MIT, CC-BY-4.0}`. Anything else fails, including `UNKNOWN`, `PACK_LEVEL`, and `unverified`.
3. **Pack-level exclusion.** The audit holds a hard exclusion list of packs whose `licence_status` is `PACK_LEVEL` — **`jam-ready-assets.zip` is on it** — and fails if any manifest entry or content file resolves inside one. The exclusion is applied at the **source-root** level (the full corpus path and the release download URLs), so an asset fetched later cannot slip in.
4. **Profile filtering.** Under `ship_profile = cc0_3d_only`, any entry whose source is the **licence-unverified 2D set** (the 114,852-record 2D index) fails. The 2D set is includable only under `cc0_3d_plus_ui_2d_pending`, which additionally requires the generated `dist/LICENCE-STATUS.md` to mark those assets `PENDING CLEARANCE — NOT LICENSED FOR DISTRIBUTION`.
5. **Reference resolution.** Every asset id referenced by any content file resolves to a manifest entry.
6. **Manifest verification.** Each entry's measurements are re-derived from the file on disk and must match within 0.5 %; a mismatch fails (the manifest cannot drift from reality).
7. **Modification vocabulary.** Every entry in `licence.modifications` is in the permitted-transform vocabulary (§8.3).
8. **Output.** The gate writes `dist/ASSET-LICENCE-AUDIT.json` (per-asset licence and counts) and `dist/ATTRIBUTION.md` (human-readable attribution, as `REQ-E-018` requires) and **fails** on any unlicensed asset.

### 7.7 Ship profiles (configuration switch)

| Profile | 3D corpus | 2D unverified set | `jam-ready-assets.zip` | Release-eligible |
|---|---|---|---|---|
| `cc0_3d_only` (**default**) | included | excluded | excluded | **yes** |
| `cc0_3d_plus_ui_2d_pending` | included | included, labelled pending | excluded | **no** — build produces a `DO-NOT-PUBLISH.txt` marker, mirroring the repository's existing `SuperCitycon` convention |
| `internal_all` | included | included | included | **no** — developer builds only; the packaging gate refuses to produce a release artefact from this profile |

### 7.8 Packaging and release audit

`gate/packaging` exports the desktop build, splits the content into the declared bundles (`core_world.pck`, `actors.pck`, `biome_NN.pck`, `ui.pck`, `audio.pck`), verifies the ship-set size against the budget (§9.4), and asserts every file in every bundle appears in the manifest. Debug tooling is excluded from release exports by the export filter, not by convention.

`gate/release-audit` additionally requires the bundle to contain `ATTRIBUTION.md`, `ASSET-LICENCE-AUDIT.json`, `PRIVACY-NOTICE.md`, `BUILD-METADATA.json` (build id, engine version, content hash, build timestamp) and a crash-log handler that writes to `userdata://crashes/` with a user-consent prompt. The audit reports **zero unlicensed assets** or the build fails (`REQ-E-018` acceptance).

### 7.9 CI configuration switch

```yaml
# ci/pipelines/pr.yml
jobs:
  content-gates:
    strategy:
      matrix:
        gate: [schema, unit, integration, replay-determinism, content-lint, world-graph, audio-smoke, no-procedural-art, asset-licence]
```

Each matrix leg installs the pinned engine, runs exactly one gate, and uploads its artefacts. A failing leg names the gate.

---

## 8. Asset pipeline

### 8.1 The rule

> Every mesh, texture, animation, skybox, background, UI element, icon and sound in the shipped game is a **named file that exists in the image repository**, recorded in the asset manifest with its exact path, pack and licence. The pipeline **measures and registers**; it never **authors**. No procedural geometry, no runtime-generated texture, no shader-only character, no primitive-composition actor. Compositing library assets into a level is allowed; fabricating an asset is not.

### 8.2 The flow

```
repository file
   │
   ├─(1) INGEST ──────── copy from an allowed source root; verify SHA-256; record pack, path, licence
   │                    FAIL on: PACK_LEVEL pack, unverified-licence file under a release profile, missing file
   ├─(2) MEASURE ─────── derive world-space bounds, size, footprint, ground offset, pivot, triangle count,
   │                    material count, texture dimensions, rig family, clip list, clip durations
   │                    (measurement only — nothing is written back to the source file)
   ├─(3) REGISTER ─────── write the manifest entry (§5.8) with licence metadata and the measurement block
   │                    FAIL on: unapproved licence, missing creator/source_url, a modification outside the
   │                    permitted vocabulary, an unmeasurable asset
   ├─(4) IMPORT ──────── engine import (gltf importer settings from §3.4); optional lossless compression
   │                    (Draco/Meshopt) recorded as a permitted modification
   ├─(5) PACK ────────── assign the asset to a bundle (core_world, actors, biome_NN, ui, audio)
   ├─(6) LICENCE GATE ── §7.6, per bundle and for the whole build
   └─(7) SHIP ────────── the bundle is only reachable from a build whose profile permits every asset it contains
```

**Step 2 is the only step that touches asset data, and it only reads.** The measurement block is what lets the level designer place a prop on the ground without eyeballing it, and it is re-verified by the gate (§7.6 step 6) so it can never drift from the file.

### 8.3 Permitted and forbidden transforms

**Permitted** (recorded in `licence.modifications` as a tagged string, e.g. `uniform_scale:0.75`):

| Tag | Meaning | Constraint |
|---|---|---|
| `uniform_scale:<s>` | A single scalar applied to the whole asset | One value per asset; no per-axis scaling |
| `recentre:<pivot>` | Translation so the pivot lands at the origin | `pivot` ∈ {`base_centre`, `bounding_centre`, `origin`} |
| `rotate_y:<deg>` | Rotation about the up axis, in 90° steps | ±90/180/270 only |
| `up_axis:<axis>` | Up-axis conversion (Z-up → Y-up) | 90° only |
| `mesh_compression:<codec>` | Draco or Meshopt quantisation | Lossless-to-tolerance; no vertex removal, no welding of distinct surfaces |
| `texture_reencode:<format>` | PNG → KTX2/Basis, or lossless PNG re-compression | No painting, no upscaling, no AI upscaling, no normal-map synthesis |
| `clip_trim:<clip>:<a>-<b>` | Trim a clip's active range | Keyframes are not added, moved, or interpolated |
| `clip_rename:<from>:<to>` | Rename a clip to the canonical vocabulary | Semantics must match the canonical clip definition |
| `clip_retime:<clip>:<scale>` | Uniform time-scale of a clip | Scale is a constant; no per-key editing |
| `audio_reencode:<codec>` | ogg ↔ wav, flac → ogg | No synthesis, no pitch shifting, no generative processing |
| `audio_trim:<a>-<b>` | Trim silence | No time-stretching or pitch change |
| `audio_loop_tag:<clip>` | Set loop points on an existing clip | Loop points must lie inside the clip's existing range |

**Forbidden** (each is a hard gate failure):

| Forbidden operation | Why |
|---|---|
| Generating geometry — primitives, `ArrayMesh`, `ImmediateMesh`, `SurfaceTool`, CSG booleans, particle meshes, shape-cast gizmos as visible geometry | This is authoring. Violates the asset rule. |
| Procedural or runtime-generated textures — noise, gradient, random, viewport capture used as art | This is authoring. |
| Shader-only characters, silhouette-by-fragment, "no mesh, just a shader" actors | The rule requires a named file for every mesh. |
| Authoring or re-authoring skeletons, bones, skin weights, or rigging a static model | Retargeting onto **existing** bones is permitted; creating bones is not. |
| Synthesising animation — generating keyframes, motion capture, procedural animation, blending authored clips into a new clip file | The clip must exist in the source file. Runtime *blending* for playback is permitted; authoring a blended clip file is not. |
| Painting, sculpting, UV authoring, normal-map derivation from depth not already present, AI upscaling, generative fill | Authoring. |
| Changing an asset's silhouette by anything other than a uniform scale | Changes the expressive content of the source asset. |
| Merging several source meshes into a new mesh file | Composites are a **scene** concern; a merged mesh is a new asset. Use instancing instead (§9.3). |
| Adding any file that does not exist in the repository, including any generated placeholder | The rule. An absent asset is an **ASSET GAP** row, never a placeholder. |
| Including `jam-ready-assets.zip` or the licence-unverified 2D set in a release profile | §7.6 steps 3–4. |
| Compositing a *fictional* character design out of several library characters into a new character | The shipped cast must be a named existing asset. Style variation is achieved by **choosing** among the existing assets, not by assembling new ones. |

### 8.3a Runtime transforms — permitted, and not asset modifications

The entities board needs a way to animate the 124 node-transform Kenney props and to
express swim, glide, flight, charge and climb, for which **no clip exists in the corpus**
(`GAP-A10`). The following are **runtime behaviours on a named, unmodified asset**. They
write no file, change no vertex, and produce no new asset — so they are **permitted**, and
they are distinguished from the forbidden table above by exactly that fact.

| Runtime transform | What it does | Constraint |
|---|---|---|
| `root_node_transform:<axis>:<a>:<b>` | Drives a node's rotation/translation over time, e.g. bobbing, spinning, pulsing, a rising platform | The node must exist in the source file. **No new bones are created.** The transform is a uniform rigid motion of an existing node — never a non-uniform squash, and never a change to the mesh's vertex data |
| `root_node_path:<node>:<waypoints>` | Moves an existing node along an authored waypoint path (moving platforms, drifting props, a bobbing boat) | Waypoints are level data, not a new curve asset |
| `clip_blend:<a>:<b>:<weight>` | Blends two **existing** authored clips at playback time for a state transition | Permitted at runtime. **Authoring a blended clip file is forbidden** (see the table above) |
| `clip_select:<state>:<clip>` | Selects the clip that matches a state machine's current state | The clip must exist in the source file |

**Why this is not authoring.** The asset file on disk is byte-identical after the build. A
runtime transform is the same category of thing as playing the clip at a different speed —
it is playback, not authoring. The forbidden table above forbids writing *new geometry,
new textures, new bones or new clips*; none of the four rows above does.

**The rig-allocation rule that uses it.** Where no clip exists for a required state
(swim, glide, flight, charge, climb), the entities board applies a **four-tier** rule, in
order: (1) bind to a rig that **has** the clip — `KayKit_AnimatedCharacter_v1.2` carries
`Climbing` and `Hop`; (2) otherwise apply a `root_node_transform` on a **named** rig,
never a non-uniform squash; (3) otherwise use the nearest named analogue asset with the
behavioural difference stated in the gap register; (4) otherwise raise an **ASSET GAP**.
Ten gap rows result, none of them filled with a placeholder. (Reconciled from the entities
board's `XN-ENT-09`.)

### 8.4 How "no procedural art" is enforced mechanically

`gate/no-procedural-art` runs three independent checks:

**Check 1 — forbidden API scan.** Every `.gd` file under `src/` is scanned for the synthesis API set: `ArrayMesh`, `ImmediateMesh`, `SurfaceTool`, `CSGBox3D`/`CSGCombiner3D`/`CSGShape3D`, `PrimitiveMesh` and its subclasses (`BoxMesh`, `SphereMesh`, `CapsuleMesh`, `CylinderMesh`, `PlaneMesh`, `QuadMesh`, `PointMesh`, `RibbonTrailMesh`, `TextMesh`), `Image.create`, `Image.create_empty`, `ImageTexture`, `CompressedTexture2D` built at runtime, `GradientTexture*`, `NoiseTexture2D`, `FastNoiseLite`, `PortableCompressedTexture2D` construction, `CurveTexture*`. A hit outside `src/tools/**` and `src/systems/debug/**` fails. `TextMesh` is permitted only for **debug labels** and only inside `src/systems/debug/**`, which is excluded from release exports.

**Check 2 — mesh provenance.** The packer walks every `MeshInstance3D` in every exported scene and traces its `mesh` resource back to an imported asset resource. A mesh with no manifest entry fails. A `MultiMesh` whose transform count is authored by a script (rather than from a level file) fails.

**Check 3 — resource closure.** The release bundle is enumerated; every file in it must be either (a) an engine/built-in resource, (b) a manifest-registered imported asset, (c) a manifest-registered audio file, or (d) a manifest-registered localisation/UI/text file. Anything else — an ad-hoc `.obj`, a hand-placed `.png`, a checked-in binary blob — fails.

The three checks are independent on purpose: an API scan alone would miss a mesh dropped in as a file, and a provenance check alone would miss code that generates geometry at runtime.

### 8.5 Ship set composition (measured, against the 73 MB target)

| Bundle | Contents | Measured size |
|---|---|---|
| `core_world.pck` | 10 Kenney kits: platformer 153, nature 329, castle 76, graveyard 91, mini-characters 26, blocky-characters 18, cube-pets 24, retro-fantasy 105, modular-dungeon 39, mini-dungeon 25 — **886 models** | **28.3 MB** uncompressed |
| `actors.pck` | KayKit Adventurers 32 GLB (5 rigs × 76 clips) — **the primary playable rig** — + KayKit Skeletons 34 GLB (5 rigs × 95 clips) + Quaternius Ultimate Animated Animals 36 GLB (3 rigs × 12–13 clips) + Quaternius animated mech 4 GLB (`Leela`, 18 clips) | **17.3 MB** base + the skeletons / animals / mech amendment below |
| `biome_NN.pck` | per-region variant kits, streamed on demand | from the remaining Kenney budget |
| `sky.pck` | 12 of the 80 PolyHaven 1k HDR (1.58 MB average) | **~19.0 MB** |
| `audio.pck` | 52 shipped sounds (40 Kenney `.ogg` 0.31 MB + 12 footstep `.ogg`) | **~0.6 MB** |
| `ui.pck` | Kenney UI subset + `kenvector_future.ttf` + thin weight | ~2 MB |
| **Total** | | **~67 MB**, headroom to the 73 MB target |

**Ship-set amendment (reconciled from the entities board's `XN-ENT-02`).** The
entities roster requires four groups that §8.5 originally excluded, because the
archetype table binds a named rig to every archetype:

| Added bundle | Contents | Why | Size |
|---|---|---|---|
| `skeletons.pck` | KayKit Skeletons — 5 rigs × 95 clips | the 12 skeleton-archetypes (`Skeleton`, `Skeleton_Warrior`, `Skeleton_Mage`, `Skeleton_Rogue`, `Skeleton_Minion`) need the `Spawn_Ground_Skeletons`, `Death_C_Skeletons_Resurrect` and `Skeletons_Awaken_*` clips that no other rig carries | ~14 MB |
| `holiday.pck` | KayKit Halloween — 63 GLTF | the Halloween-region archetypes and the `coffin_decorated` / `crypt` / `grave_*` / `candle` props the world board's Region 6 uses | ~6.5 MB |
| `hexagon.pck` | KayKit Medieval Hexagon — 263 models | the hex-tile terrain family, `building_castle`, `building_tower_catapult`, `flag_*` and the `hex_river_*` / `hex_coast_*` water and coastline pieces for Regions 1, 2 and 7 | ~9 MB |
| `animals.pck` + `mech.pck` | Quaternius animals (3 rigs) + Quaternius animated mech (`Leela`, 18 clips) | the animal archetypes (`Fox`, `Shiba Inu`, `White Horse`) and the mobile-airship boss analogue | ~8 MB |

These are **streamed on demand** as `biome_NN.pck` and are excluded from the always-resident
`core_world.pck`, so the resident budget does not change; the release size grows by roughly
**37 MB**, from ~67 MB to ~104 MB against the 73 MB target. **The 73 MB target is therefore
missed and is restated as ~104 MB.** The alternative — dropping the skeleton, Halloween,
hexagon, animal and mech archetypes — would break the roster, so the budget moves rather
than the design. The budget is a **target, not a measurement**.

**Constraints this imposes.** All 80 PolyHaven HDRs (126.5 MB) cannot ship; the selection of 12 is a **content decision** recorded per biome in the manifest. All 4,812 Kenney GLB (125.8 MB) cannot ship; the 10 kit selection is the ship set and the remaining 39 kits are available for biome packs. The Quaternius animated-character pack (94.6 MB of GLB) is **excluded by default**; at most 2 characters may be added, at ~4 MB each. The 329 MB firearm WAV set is excluded by rule (§2.3).

### 8.6 The licence-pending 2D layer

The 114,852-record 2D set is `licence_status: unverified`. It is **excluded by default** because the game is 3D-first and ships complete from the cleared 3D corpus. The switch is `ship_profile` (§7.7): `cc0_3d_only` excludes it; `cc0_3d_plus_ui_2d_pending` includes it and marks the build non-releasable. The gate is the same code path in both cases — a profile filter over the manifest — so the switch cannot be bypassed by editing content.

### 8.7 Asset gaps are rows, not placeholders

When the pipeline cannot find a file for a required element, it writes an **ASSET GAP** row naming the requirement it blocks, and the content referencing it fails validation rather than being filled with a placeholder. Known open asset gaps at design time:

| Gap | Blocks |
|---|---|
| **GAP-A1** — no music in the corpus (0 files, verified across all 22 archives) | 8 region music cues; `REQ-D-015`'s music-bus acceptance clause |
| **GAP-A2** — Kenney props are static or node-transform-animated only | animated hazards and scenery beyond the 150 animated GLB |
| **GAP-A3** — ~50 archetypes vs 12 mirrored animated rigs (36 named rigs indexed) | every animated enemy archetype beyond the rig families in §2.2 |
| **GAP-A4** — the 2D set is licence-unverified | any shipped build that depends on it |
| **GAP-A5** — `jam-ready-assets.zip` is `PACK_LEVEL` | excluded by rule; nothing may depend on it |
| **GAP-A7** — ambientCG PBR is photographic; Kenney is flat-shaded | the material and lighting standard (§9.5) |

---

## 9. Performance budget

> **Everything in this section is a TARGET, not a measurement.** No frame-time, draw-call or triangle figure here has been measured on target hardware — the engine is not installed on the developer machine (§2.4) and no baseline runner exists yet. Every number below is a budget with a named acceptance test; each becomes a measurement only after `gate/perf-budget` runs and records its result.

### 9.1 Hardware baseline

**Normative baseline device.** `NFR-01` requires a *defined* baseline, so this is now
**pinned, not proposed**: a 2020-class 6-core desktop CPU (e.g. Ryzen 5 3600 / i5-10400),
**16 GB RAM**, a GPU of **GTX 1650 / RX 5500XT class or better**, **SSD storage**,
**1920×1080** at 60 FPS, with a 10 GB free-disk budget for the installed build.
The performance budget in §9.2 is measured **against this device string** and nowhere
else. If the requester later names a different target, this string is the single place
that changes and §9.2 is re-derived. (`OPEN-001` is therefore **closed** — see §13.)

### 9.2 Frame-time budget (targets)

| Metric | Target | Notes |
|---|---|---|
| Rendered frame rate | 60 FPS | `NFR-01` |
| Frame time, 95th percentile | ≤ 16.7 ms | `NFR-01` |
| Frame time, 99th percentile | ≤ 33.3 ms | Two-frame allowance |
| Simulation tick | ≤ 2.0 ms average, ≤ 4.0 ms worst tick | The tick budget is separate from the frame budget |
| Max frame hitch during play | ≤ 50 ms | Excludes level load and first-frame shader compile, which are logged separately |
| Loading a stage | ≤ 2.0 s from a warm cache | Streamed (§9.4) |
| Memory, resident | ≤ 512 MB | Target |

The **simulation tick budget is the one that governs architecture**: at 2.0 ms of a 16.7 ms frame, gameplay consumes at most 12 % of the frame, leaving the renderer room to breathe on integrated graphics.

### 9.3 Draw-call and geometry strategy

| Budget | Target |
|---|---|
| Draw calls, typical stage view | ≤ 800 |
| Draw calls, stress scene | ≤ 1,200 |
| Triangles rendered, typical | ≤ 600,000 |
| Active actors, typical stage | ≤ 120 |
| Active actors, stress scene | ≤ 300 |
| Pooled objects (projectiles, FX) | ≤ 512 total, per type ≤ 128 |

**Strategy.** The library's assets are **instanced and pooled; they are never composed per frame**.

1. **MultiMesh for repetition.** Repeated props (grass tufts, coins, blocks, fence posts) are one `MultiMeshInstance3D` per model per region: one draw call for N instances. A region with 400 coins of one model is 1 draw call, not 400.
2. **Model-level batching.** Kenney ships one model per file, so a level that uses 40 distinct Kenney models has an unavoidable 40-model floor. The budget is therefore managed by **limiting distinct models per view** (the level linter flags a view frustum containing more than 120 distinct models) and by **per-model LOD** (`lod: l0/l1/l2` in the manifest), with distant props dropped to `l1` and culled entirely beyond the visibility range.
3. **Visibility ranges.** Every prop has an authored visibility range; beyond it the instance is culled, not merely hidden.
4. **Pooling.** Projectiles, pickups, FX and enemies are pooled. A pool has a fixed capacity; acquiring beyond capacity returns the oldest idle entry or refuses, and the refusal is counted and reported (`REQ-E-011`, `NFR-03`).
5. **No per-frame composition.** A frame must not construct meshes, materials or scene trees. This is enforced by the `no-procedural-art` gate (§8.4) and by the `gate/perf-budget` counter that asserts the scene-tree node count does not change during steady-state play.

### 9.4 Streaming plan for the 73 MB ship set

| Phase | Content | Target |
|---|---|---|
| Boot | `core_world.pck` header + bootstrap + title | ≤ 300 ms |
| Stage load | The stage's own bundle + `core_world` + `actors` + `sky` + `audio` | ≤ 2.0 s warm |
| Region streaming | `biome_NN.pck` for the next region, loaded during the region-transition cutscene | ≤ 4.0 s, off the critical path |
| Resident ceiling | Everything the current region needs | ≤ 512 MB |

Bundles are separate PCK files, so a region can be added or removed from the build without touching the others. The bundle manifest in the asset manifest (`pack` field) is the single list of what exists; the packer refuses to place an asset in an undeclared bundle.

### 9.5 Lighting and material standard

Target: a single flat-shaded low-poly look (the Kenney corpus's native style), one directional key light with a fixed angle per biome, one ambient/hemisphere fill, and a skybox from the 12 selected PolyHaven HDRs. The ambientCG photographic PBR sets are **excluded from the default ship set** (GAP-A7) because they would clash with flat shading and cost 115 MB for 80 sets; they may be used only in a deliberately photoreal biome variant, which does not exist at GATE 0.

### 9.6 Determinism and performance interaction (`REQ-E-002`, `NFR-02`)

The simulation is fixed-step and therefore **frame-rate independent by construction**: the number of ticks executed in a frame is derived from an accumulator, never from the rendered frame count. `NFR-02`'s acceptance is therefore a structural property, verified by the replay gate (§7.1 gate 5) at 30, 60 and 120 rendered FPS.

---

## 10. Requirement traceability matrix

**Complete census: 102 requirement rows + 10 NFR rows = 112 rows.**

**Columns.** `ID | Priority | Authority | Owning section | Design artefact | Acceptance test | Status`

**Authority rule.** `ARCHITECTURE` is authoritative for every `REQ-E-*` and every `NFR-*`, because the engineering contract is the deliverable that makes the behaviour possible; the second board named in the authority column owns the *content* that must satisfy the contract and is a **consumer**. The same rule applies to the three shared non-E ids: `B-003` → PLAYER (camera follow algorithm) with WORLD as consumer (authored bounds); `D-019` and `D-020` → PLAYER (UX and settings persistence) with WORLD as consumer (trigger points and world-side cues).

**Status legend.** `DESIGNED` = the contract and a falsifiable acceptance test are defined here; implementation is outstanding. `SHARED` = as `DESIGNED`, and a second board is named in the Authority column. `PARTIAL` = one clause cannot be discharged until a named asset or decision exists. `BLOCKED` = see §13. **No row is marked implemented; nothing is built yet.**

### 10.1 Board A — input, physics, player (authority: PLAYER)

| ID | Pri | Authority | Owning section | Design artefact | Acceptance test | Status |
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

### 10.2 Board B — worlds, stages, progression (authority: WORLD)

| ID | Pri | Authority | Owning section | Design artefact | Acceptance test | Status |
|---|---|---|---|---|---|---|
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

### 10.3 Board C — entities, enemies, bosses (authority: ENTITIES)

| ID | Pri | Authority | Owning section | Design artefact | Acceptance test | Status |
|---|---|---|---|---|---|---|
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

### 10.4 Board D — objects, items, FX, UI, audio

| ID | Pri | Authority | Owning section | Design artefact | Acceptance test | Status |
|---|---|---|---|---|---|---|
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

### 10.5 Board E — engineering, content, quality (authority: ARCHITECTURE)

| ID | Pri | Authority | Owning section | Design artefact | Acceptance test | Status |
|---|---|---|---|---|---|---|
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

### 10.6 Non-functional requirements (authority: ARCHITECTURE)

| ID | Pri | Authority | Owning section | Design artefact | Acceptance test | Status |
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

### 10.7 Census check

| Set | Count |
|---|---|
| Board A rows | 21 |
| Board B rows | 21 |
| Board C rows | 20 |
| Board D rows | 20 |
| Board E rows | 20 |
| **Total REQ rows** | **102** |
| NFR rows | 10 |
| **Total rows** | **112** |

Ids appearing in two authorities (11): `B-003` (PLAYER/WORLD), `D-019` (PLAYER/WORLD), `D-020` (PLAYER/WORLD), `E-004` (ARCH/ENTITIES), `E-009` (ARCH/WORLD), `E-010` (ARCH/WORLD), `E-011` (ARCH/ENTITIES), `E-013` (ARCH/WORLD), `E-015` (ARCH/PLAYER), `E-016` (ARCH/ENTITIES), `E-020` (ARCH/PLAYER). **No id is unowned.**

---

## 11. Gap analysis — `GAP-001 … GAP-015` under the 3D translation

Classification: **MOOT** = the gap does not constrain the shipped 3D game; **KEPT** = the gap stands and must be handled by the TUNE/UNVERIFIED discipline (§12).

| Gap | Missing / not claimed | 3D translation | Class | Handling |
|---|---|---|---|---|
| GAP-001 | Exact per-version acceleration, friction, gravity, run speed, jump impulses, subpixel rounding | 3D does not supply any of these. The **subpixel** clause is void — 3D positions are float-valued, so there is no subpixel rounding to recover | **KEPT** | All movement constants live in the TUNE table (§12). No Nintendo value is asserted. The 3D game defines its own feel. |
| GAP-002 | Pixel-precise hitboxes/hurtboxes and animation frame timing per actor and state | "Pixel-precise" is void in 3D — a hitbox is a **volume**, and our own clip durations are read from the source GLB rather than unknown | **MOOT** (reframed) | Our hitboxes are original volumes declared in §5.3, not recovered reference values. Clip durations are measured from the GLB (§5.8 `clips`) — measured, not guessed. |
| GAP-003 | Complete per-tile geometry and enemy/secret/item placement of every original stage | The shipped game has **original** stage geometry. We never need the originals | **MOOT** | The 8 regions are authored from scratch (§5.2). Nothing is replicated. |
| GAP-004 | Exact enemy FSM logic, timers, PRNGs and offscreen lifecycle per game revision | 3D supplies nothing; our FSMs are original designs informed by the taxonomy | **KEPT** | Does not block delivery — the reference internals are not reproduced. Our FSMs are original and data-driven (§5.3). |
| GAP-005 | ROM-level memory layout, object format, streaming and hardware rendering limits | No ROM, no 256 KB page, no sprite budget. Modern GPU and disk | **MOOT** | Our budgets are our own (§9). |
| GAP-006 | All regional differences across FDS, NES, SNES, All-Stars, GBA, Virtual Console/Switch | We ship **five sealed original rule-sets**, not five edition emulations | **MOOT** | Rule-set separation (§5.1) is our substitute; edition-accurate variants are out of scope. |
| GAP-007 | Complete original music, sound, animation and all original AV assets — intentionally excluded from build | Already excluded by policy. The **replacement** gap is ours: the corpus has 0 music files | **MOOT** (policy) | Replaced by **ASSETS GAP-A1** (§8.7). `REQ-D-015` is PARTIAL until music is sourced. |
| GAP-008 | Exhaustive named enemy/object/boss rosters and all variants per version | 3D supplies nothing; our roster is ~50 original archetypes described by behaviour, not by name | **KEPT** | Does not block delivery — §5.3 archetypes are original. Rig coverage is tracked separately as GAP-3D-001. |
| GAP-009 | Exact AI/boss cycle timing and damage exceptions in all encounters | 3D supplies nothing; our boss cycles are original designs | **KEPT** | Does not block delivery — boss patterns are original (§5.3, `kind: boss`). |
| GAP-010 | Precise scoring tables, combo ladders, timer conversion and lives/continues per edition | 3D supplies nothing; our score table is authored | **KEPT** | Does not block delivery — original score tables live under `src/content/scoring/`. |
| GAP-011 | Full 96-exit SMW world map geometry, every route, ghost-house sequences, maze solutions | The 3D game ships its own world graph; the 96-exit map is neither referenced nor replicated | **MOOT** | §5.6 defines our own graph; the validator proves reachability (§7.3). |
| GAP-012 | Source-specific glitch/quirk compatibility (wall clips, frame rules, arbitrary input anomalies) | We implement no source-specific quirks, and shipping them would be a legal risk | **MOOT** | Deliberately excluded. |
| GAP-013 | Exact sprite memory limits and draw-order bugs of original hardware | No sprite budget; modern GPU and instancing | **MOOT** | Replaced by our own draw-call budget (§9.3). |
| GAP-014 | Target platform, monetisation, language set, multiplayer scope, final art direction not specified | **Partially narrowed**: platform is desktop-first with web reach (§3.3); art direction is constrained to the flat-shaded corpus look (§9.5); **the language set is decided by `G-14` — Latin-1 only (`en-GB`, `en-US`), no RTL and no CJK**. Monetisation, multiplayer and final art direction remain open | **KEPT** (narrowed) | See `OPEN-001`…`OPEN-004` (§13). |
| GAP-015 | Platform-specific rights review and trademark/licensing; no Nintendo licences available | The **shape** of the risk changes: it is no longer sprite/music copying but **3D asset similarity** — a Kenney model resembling a specific commercial character, or a level resembling a specific commercial stage. The no-Nintendo-licence statement stands | **KEPT** (reshaped) | Original names, original geometry, no clone of any commercial asset; a rights review is required before distribution (§13, `OPEN-005`). |

**Counts: 8 MOOT, 7 KEPT.** "MOOT" means the 3D translation removes the gap's subject matter from the shipped game; "KEPT" means the gap stands as an unevidenced reference behaviour. Four of the seven KEPT gaps (004, 008, 009, 010) do **not** block delivery, because the shipped game implements original behaviour and never claims to reproduce reference internals; they are retained so that no future "we matched the original" claim is ever made without evidence.

### 11.1 Gaps created by the 3D translation

These are **new** (ids `GAP-3D-*`); they do not exist in the master GAP register.

| New id | Gap | Consequence |
|---|---|---|
| GAP-3D-001 | **Rig coverage.** 4 bone-naming families, 12 mirrored animated rigs, 36 named rigs indexed — against roughly 50 archetypes | Most archetypes share a rig or use a scripted-transform rig. The bone-map registry (§2.2, §4.3) bounds the work; the risk is *visual* sameness across enemies sharing a rig, which the art direction must address by silhouette and proportion rather than by new assets. |
| GAP-3D-002 | **No music.** 0 music files across all 22 archives (verified) | 8 region cues unsourced; `REQ-D-015` PARTIAL; the mixer must be designed for zero music (§7.5). |
| GAP-3D-003 | **Static or node-transform-only props.** 150 Kenney GLB carry animation, 124 of them with no skeleton; 4,662 carry none | Animated hazards and scenery need either one of the 150 animated assets, or a scripted transform on an existing model (permitted), or an ASSET GAP row. |
| GAP-3D-004 | **Material style clash.** Flat-shaded Kenney vs photographic ambientCG PBR (115 MB, 80 sets) | The lighting and material standard must be fixed at GATE 0 or the build reads as incoherent. §9.5 fixes it by defaulting to flat-shaded and excluding ambientCG. |
| GAP-3D-005 | **Web export header constraint.** Godot 4 web needs COOP/COEP for threaded wasm; GitHub Pages cannot set headers | The web target needs either a single-threaded build or a different host. Risk R1. |
| GAP-3D-006 | **3D level authoring and sightlines.** 8 regions in 3D need volume design, occlusion and camera framing that no tool supports yet | The level linter (§7.3) must grow 3D-specific checks (occlusion, camera framing, vertical dead space). Content effort per region is higher than 2D. |
| GAP-3D-007 | **Cross-platform float determinism** | Replay checksums are per-platform; the golden files are keyed by runner image digest (§3.5 R3). |
| GAP-3D-008 | **Clip-name collision across rigs.** `Idle`/`Walk`/`Run` exist with different lengths and semantics in the 76-clip KayKit set, the 17-clip Quaternius set and the 25-clip Kenney set | A canonical clip registry with per-rig duration metadata is required, or animations will visibly desynchronise between actors. |

**Counts: 8 gaps created.**

---

## 12. Constants — TUNE and UNVERIFIED register

Every gameplay constant is **configurable** and lives in `src/content/tuning/<ruleset_id>.tune.json`. **No value below is claimed to be a Nintendo constant.** Values marked TUNE are original design choices; values marked UNVERIFIED are reference values we could not evidence and therefore do not assert.

| Id | Constant | Default | Class | Rationale |
|---|---|---|---|---|
| TUNE-001 | Simulation rate | 60 Hz | TUNE | A design choice; a stable divisor of common display rates. Not a reference claim. |
| TUNE-002 | Gravity | 24.0 m/s² | TUNE | Original feel; selected for a readable jump arc at 60 Hz, not matched to any reference. |
| TUNE-003 | Jump impulse / full-hold apex | **per profile** — `jump_impulse` 9.6 / 9.0 / 9.2 / 8.4 m/s (Tallow / Brindle / Sable / Moth); `jump_hold_gravity_scale` 0.38 / 0.45 / 0.62 / 0.55; **apex 3.16 / 2.68 / 2.43 / 2.81 m** respectively; the hold window is bounded by `jump_hold_max_ticks` = 14 ticks (`TUNE-P-018`) | TUNE | The apex is **per-profile**, because `REQ-A-015` requires an independently data-driven jump height. The **base profile Brindle** carries the shared defaults (`jump_impulse` 9.0, `jump_hold_gravity_scale` 0.45) and an apex of **2.68 m**. The earlier "≈1.69 m" figure was stale and is withdrawn. Level-design reachability uses the **lowest** profile apex (**2.43 m**, Sable) and the **smallest** horizontal clearance (**5.43 m**, Brindle) so every profile clears every mandatory gap. Derived from `TUNE-002`. |
| TUNE-004 | Coyote time | 6 ticks (0.10 s) | TUNE | Accessibility default; a modern convention, not a reference value. |
| TUNE-005 | Jump buffer | **8 ticks (0.133 s)** | TUNE | Accessibility default, independently adjustable from TUNE-004 (`REQ-A-004`). Reconciled with `3D-TRANSLATION.md` §2.3, which now reads 8 ticks rather than the earlier 0.12 s. |
| TUNE-006 | Swim stroke impulse / drag | 4.0 m/s; 0.85 | TUNE | Original water feel. |
| TUNE-007 | Wind acceleration | 6.0 m/s² | TUNE | Original; scaled so a 2 s exposure shifts a projectile ≈1 m. |
| TUNE-008 | Surface material set — **(friction, acceleration)** pairs | `solid` (1.00, 1.00) · `ice` (0.02, 0.25) · `mud` (2.20, 0.60) · `quicksand` (3.00, 0.40) · `conveyor` (1.00, 1.00) + surface velocity · `bouncy` (1.00, 1.00) + launch impulse · `slippery_grunt` (0.35, 0.80) · `grate` (1.00, 1.00) · `hazard` (1.00, 1.00) | TUNE | **One schema: a (friction, acceleration) pair per material**, exactly as published in `3D-TRANSLATION.md` §1.1 and used by the player and world boards. The earlier scalar list here (`mud 0.55 · conveyor 0.30 · quicksand 0.75 · normal 0.20`) used a different schema and different values and is **withdrawn**. Friction is a decay rate (1.00 = full stop in one second); acceleration is a per-second approach rate. Ordered so the same input gives nine distinguishable distances (`REQ-A-011`). |
| TUNE-009 | Max run speed | 7.5 m/s | TUNE | Original; sized against the 1-unit Kenney block so a running jump clears 4 blocks. |
| TUNE-010 | Camera dead zone / look-ahead | 6×3 m / 4 m | TUNE | Original framing; a 3D camera needs a wider dead zone than a 2D one. |
| TUNE-011 | Player capsule | radius 0.35 m, height 1.75 m | TUNE | Sized against the measured Kenney cast bounds (0.7 × 1.72 m, §2.2). |
| TUNE-012 | Enemy contact damage cooldown | 30 ticks | TUNE | Original; prevents multi-hit in one contact frame. |
| TUNE-013 | Invulnerability after damage | 90 ticks | TUNE | Original; longer than TUNE-012 by design. |
| TUNE-014 | Entity cap per stage | 120 typical / 300 stress | TUNE | §9.3 budget; the stress figure is the hard cap the pool enforces. |
| TUNE-015 | Stage time limit | 300 s | TUNE | Original default; overridable per stage and per rule-set. |
| TUNE-016 | Stage dimensions | 240 × 28 × 16 m | TUNE | Sized to a 30–90 s traversal at TUNE-009. |
| UNVERIFIED-001 | Any reference acceleration, friction, gravity, run speed or jump impulse | — | **UNVERIFIED** | `GAP-001`. Not asserted. Our values stand on their own. |
| UNVERIFIED-002 | Any reference hitbox or hurtbox geometry | — | **UNVERIFIED** | `GAP-002`. Our volumes are original (§5.3). |
| UNVERIFIED-003 | Any reference enemy or boss timing | — | **UNVERIFIED** | `GAP-004`, `GAP-009`. Our cycles are original. |
| UNVERIFIED-004 | Any reference score table, timer conversion or lives/continues rule | — | **UNVERIFIED** | `GAP-010`. Our tables are authored. |
| UNVERIFIED-005 | Any reference world-map route count or topology | — | **UNVERIFIED** | `GAP-011`. Our graph is our own. |

---

## 13. Open decisions and blockers

| Id | Item | Why it is open | The smallest decision needed | Owner |
|---|---|---|---|---|
| **OPEN-001 — CLOSED** | The **hardware baseline** for `NFR-01` | Resolved 2026-10-30: §9.1 now **pins** the baseline as normative — a 2020-class 6-core desktop CPU, 16 GB RAM, GTX 1650 / RX 5500XT class or better, SSD, 1920×1080 at 60 FPS, 10 GB free-disk budget. `NFR-01` requires a *defined* baseline, and it is now defined. | None — the requester may still replace the pinned string, in which case §9.2 is re-derived | Requester (may replace) |
| **OPEN-002** | **Web release target** | Godot 4 web needs COOP/COEP headers, which GitHub Pages cannot set (R1) | Choose: (a) desktop-only release, (b) single-threaded web build on the existing host, or (c) move the web build to a header-capable host | Requester |
| **OPEN-003 — CLOSED 2026-10-30** | **Music sourcing** | The corpus has 0 music files (verified across every fetched archive). The region music cues are unsourced (the 8 ambience cues are **derived in the mixer** from the shipped SFX per `G-06`, so they need no file) and `REQ-D-015` is PARTIAL. **Ship decision taken 2026-10-30: the music bus ships SILENT and no cue is fabricated**; a composer-supplied file enters through the same manifest slot and the same CI gate, and the build is releasable in the silent state. | Optional, not blocking: (a) commission original music, or (b) licence CC0 music from outside the corpus, and drop it into the existing manifest slot. The build is releasable without either | Requester |
| **OPEN-004 — CLOSED 2026-10-30** | **Language set and RTL scope** | `GAP-014`; `REQ-E-013` says "RTL readiness **if needed**", which depends on the language set. **Resolved by `G-14` (ADOPTED option (c)): the shipped locale set is restricted to Latin-1**, because the corpus holds exactly one font family (`FT-001`, `FT-002`). `en-GB` and `en-US` ship; **RTL is not in scope** and no CJK is in scope. `REQ-E-013` re-opens if the corpus gains a second family. | None — the requester may re-open it, in which case a licensed font asset must be added to the manifest first | Closed |
| **OPEN-005** | **Rights review before distribution** | `GAP-015` reshaped: 3D asset similarity is the live risk, not sprite copying | Commission a platform-specific rights review before any public distribution | Requester |
| **OPEN-006 — CLOSED** | **Bone-map assignment for the 2nd animated rig family** | Resolved 2026-10-30: **KayKit 41-joint is the primary playable rig** and the Kenney 6-joint cast is the secondary NPC rig. The requester's profile decision (Tallow, Brindle, Sable, Moth on the KayKit Adventurers rigs) settles it. §2.2 now names `kaykit_41` as a required bone map and specifies the **golden retarget test** that proves the mapping is lossless in both directions — a GATE 2 blocker. | None — the requester may re-open it, in which case the profile table and the retarget test both change | Architecture + Player boards |

**Nothing else in this document is blocked.** All 102 requirements and 10 NFRs have a named owning section and a falsifiable acceptance test (§10).

---

## 14. Definition of done for this document

- [x] All 102 REQ ids and all 10 NFR ids appear in the traceability matrix, each with a named owning document and a falsifiable acceptance test.
- [x] The engine decision is explicit (Godot 4.7.2-stable, 3D, GDScript), justified against ten weighted criteria, with the rejected alternatives, six risks and a fallback.
- [x] `REQ-E-001`'s acceptance is satisfied by a pinned engine version and a deterministic launch scene with a checksum contract.
- [x] All eight schemas carry a version field, required fields, a validation rule and a failing example.
- [x] The save system specifies atomic write, a 3-entry backup ring, a 5-step migration table and a 4-candidate corruption fallback.
- [x] The CI pipeline names 14 gates, each with what it fails on, plus headless runners, the screenshot-diff harness, the audio smoke test and the asset licence check.
- [x] The asset pipeline permits 12 tagged transformations, forbids 12 operations, and enforces "no procedural art" through three independent mechanical checks.
- [x] The licence gate excludes `jam-ready-assets.zip` and excludes the unverified 2D set by configuration (`ship_profile`).
- [x] The performance budget is labelled a TARGET throughout, with a named acceptance test per budget line.
- [x] `GAP-001…015` are each classified MOOT or KEPT, with the classification argued; eight new gaps created by the 3D translation are registered.
- [x] No Nintendo constant is asserted; 16 TUNE constants and 5 UNVERIFIED classes are registered with rationale.
