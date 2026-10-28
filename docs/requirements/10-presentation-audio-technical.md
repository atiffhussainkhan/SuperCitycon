# TEC — Presentation, Art Direction, Audio, Simulation Tech & Platform — SuperCitycon Requirements
> Bot: BOT-10 · Domain code: TEC · Status: COMPLETE — **remediated 2026-10-23**
> Sources consulted: 25 · Requirements: 138 FR / 16 NFR / 23 QA · Open questions: 30

**Remediation note (requirement-level audit, 2026-10-23).** This file had never been independently
reviewed. Four requirement rows carried no source and no TBD marker at all — `FR-TEC-037`,
`FR-TEC-060`, `FR-TEC-110`, `FR-TEC-115` — and are now resolved: the Steam store feature bullet
("*In-game footage captured using SuperCitycon's built-in video tools*") for `FR-TEC-037` and
`FR-TEC-040`, the store's first-/third-person-mode copy plus the official 30-seconds video for
`FR-TEC-060`, the App Store and Google Play listings for `FR-TEC-110`, and an explicit rebuild-target
decision (§11 Q26) for `FR-TEC-115`. Two rows had been attributed to a source that does not carry the
claim: `FR-TEC-012` cited the MagicaVoxel tutorial for the camera modes (that video shows no camera
modes) and now cites the official *The Basics* tutorial; `FR-TEC-045`/`FR-TEC-041` cited "Shared brief
§2" for the time-of-day and weather controls and now cite the store page, which carries that copy
verbatim. The **Stage** column used a five-token vocabulary (`ALL`, `DEMO`, `EA-SBX`, `POST-EA`,
`MOB-LIVE`) that is not the house vocabulary; it is now `Mobile` / `PC-EA` / `Both` / `Design`
throughout, with the mapping recorded in §0. The NFR table was missing the `Stage` and
`Rebuildable?` columns entirely and now carries them. Rows that assert product behaviour no source
states (the mobile quality-tier cap `FR-TEC-137`, the reduced-motion preset `FR-TEC-136`, the music
idiom `FR-TEC-082`, the caption track `FR-TEC-134` and the per-locale voice-asset rule `FR-TEC-083`)
are now labelled `[TBD — design decision]` with Priority `Could` and Stage `Design`; `FR-TEC-115`
(Pointer Lock, a browser platform API) is now Priority `Should` / Stage `Design`. **No evidenced row
was removed, and no evidenced row was downgraded.** In total **6 FR rows** changed priority or stage in
this file, and every one of them asserted a behaviour that no source states.

**Evidence rule for this document.** Every row below is sourced to material about *one of the two real
SuperCitycon products* — the PC title (`SuperCitycon`, Steam app `3474890`, Sunapie Games) or the mobile
title (`Super Citycon™: Build a City`, App Store id `1607860732` / `com.benwilles.citybuilder`, Ben Willes
Games SL). Behaviour that is plausible but unevidenced appears only as an explicitly marked design
decision: Priority `Could`, Stage `Design`, the marker `[TBD — design decision]`, and a Section 11
entry. Rows that specify the *rebuild's own engineering* (renderer architecture, simulation
scheduling, save encoding, module layout) are rebuild requirements, not claims about the original:
they carry `[INFERRED] design decision` or `[TBD — see §11 Qn]` and name the question that closes
them. No guessed number is presented as an original figure — the published record contains hardware
specifications only (T13).

---

## 0. Scope

- **In scope (this document owns the technical substrate every other domain renders through):**
  - **Art direction** — the retro 16-bit palette look in a modern 3D world; the voxel aesthetic and its resolution; the visual language of the seaside neighbourhood / downtown / bridge / bay; sprite-vs-geometry decision; how the look reads at each zoom level.
  - **Rendering** — voxel chunking, greedy meshing, instancing, texture atlas + palette swap, LOD and region view, shadows, transparency (water/glass), day-night lighting model, weather visuals.
  - **Animation & agents** — how vehicles, pedestrians, trains, boats and helicopters are modelled, animated and driven; agent render LOD; the player avatar.
  - **Simulation tech** — tick rate, determinism, agent budget, spatial partitioning, traffic routing, coverage-field computation cadence, pause / fast-forward / offline continuation.
  - **Audio** — music + SFX integration contract, bus model, settings hooks.
  - **Persistence** — save schema and versioning, multi-map region saves, autosave, cloud sync, Workshop-modified cities.
  - **Performance & platform** — web-build targets derived from the published Steam hardware, quality tiers, platform scope, input per platform.
  - **Build-target architecture** — the module layout a browser-based 3D rebuild should use.
- **Out of scope (reference only, do not spec here):** building catalogue & property schema (`BLD`), terrain/water/grid authoring (`WLD`), road & transit types and traffic game rules (`MOB`), economy/cost/production maths (`ECO`), happiness/scores/bonuses (`POP`), service coverage maths (`SRV`), the SCC Studio editor and Workshop publishing UX (`STD`), HUD layout, panels, camera UX and onboarding (`UX`).

**Column conventions used throughout**
- **Priority** — `Must` (a rebuild without it is not SuperCitycon), `Should` (materially improves fidelity), `Could` (polish).
- **Stage** — the house vocabulary, and only these four tokens: `Mobile` (mobile title behaviour only), `PC-EA` (the PC title on Steam, covering the shipped demo of 7 Oct 2026, the Q4 2026 Early Access construction sandbox and later PC content), `Both` (the PC and the mobile titles), `Design` (a decision this document makes for the rebuild, not a shipped capability). **Mapping from the previous five-token vocabulary used in this file:** `ALL` → `Both` · `EA-SBX` → `PC-EA` · `POST-EA` → `PC-EA` · `DEMO` → `PC-EA` · `MOB-LIVE` → `Mobile`. The two former post-EA rows in §5 are retained there as sequenced sub-stages of `PC-EA` because that table describes delivery order, not the `Stage` column.
- **Rebuildable?** — `yes` = the artefact is fully data-driven and regenerated from source assets by the rebuild pipeline; `no` = engine-owned and fixed in code; `partial` = mixed (e.g. a fixed geometry kernel plus data-driven variations).
- **Status tags** — `[CONFIRMED]` stated in a cited source · `[INFERRED]` strongly implied by cited sources · `[TBD]` not publicly documented; carries a proposed default and an entry in §11.
- **Design-decision marker** — `[TBD — design decision]` means the row asserts something no public source states. Such a row is Priority `Could` and Stage `Design` and has a §11 entry. Rows marked `[INFERRED] design decision` or `[TBD — see §11 Qn]` are *rebuild engineering* requirements: they specify how the rebuild is built and are not claims about the original game.

**Steam platform vs. SuperCitycon — the specificity line.** Steam Workshop **versioning, dependencies, load order, item visibility, per-type filtering and the Workshop Legal Agreement are Steam platform behaviour**, citable to the platform's own announcements and to nothing else. They are never SuperCitycon specifics, and this document does not restate them: `STD` owns the publishing requirements. `TEC` treats Workshop content only as **content-addressed payloads** (FR-TEC-092, FR-TEC-093) and never re-specifies platform behaviour. Likewise the published Steam hardware requirements (T13) are *hardware specifications*, not frame, draw-call or memory budgets — every budget in §4.1 and §7 is a design decision.

---

## 1. Observed behaviour (evidence)

### 1.1 Source findings

| # | Finding | Status | Source URL |
|---|---|---|---|
| T1 | The PC title's headline art promise: "Classic city building, retro 16-bit palette" rendered in a "modern 3D world". Voxel, Retro, Isometric, Stylized, 3D are Steam tags. | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| T2 | Dev statement: "SuperCitycon is a completely new game. It's been built from the ground up, **with performance and scale in mind from day one**… Not a single line of code from what came before." | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| T3 | The engine's core authoring tool is **SCC Studio, the developer's own 3D voxel editor**; "Pretty much everything in the game can be made with it"; it "holds up as cities get bigger and busier". | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| T4 | **1 world tile = 32 × 32 voxels.** The dev's MagicaVoxel tutorial: "the size in game the crit on the map is 32 so a Model A 1 by one model for example it's 32x 32 and let's make it 32 height". | [CONFIRMED] | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| T5 | **The palette is indexed and semantically ranged.** "the green we use in game is for our color palette it's 9 till 13" — the dev randomises grass/foliage variation with MagicaVoxel's `Rand 9 13` across palette indices 9–13. | [CONFIRMED] | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| T6 | Models are authored as voxel cuboids with **Face** and **Box** tools and **Attach / Erase / Paint** operations; the console `Rand` command produces pixelated material variation. | [CONFIRMED] | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| T7 | Voxel resolution constrains signage: "The game used a much lower voxel resolution back then, and there simply wasn't enough space on the building to write City Constructions in a way that was still readable." | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| T8 | The 16-bit identity is a personal tribute to the **Super Nintendo era** and to SimCity on SNES, whose soundtrack the dev remembers as "slightly strange, almost psychedelic MIDI". | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| T9 | Official site hero art is described as "A SuperCitycon island city: old town, a bridge with traffic, a downtown skyline, sailboats and dolphins in the bay", with scene captions "Traffic passes the corner café. People cross the square." and "Day becomes night and the windows light up". | [CONFIRMED] | https://supercitycon.net/ |
| T10 | The shipped demo (7 Oct 2026) contains "fires and tornadoes, a full day and night cycle, and on top of road traffic there are trains, helicopters and ships moving through your city"; on-foot walking is not in the demo. | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| T11 | The demo's Steam feature categories include **Camera Comfort**, **Custom Volume Controls**, **Mouse Only Option**, **Playable without Timed Input**, **Includes level editor**. | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| T12 | Full game platforms: Windows + macOS, `linux: false` (Linux requirements blocks are empty). 24 languages, all flagged "languages with full audio support". Early Access Q4 2026. Steam app 3474890, demo app 5295650. | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| T13 | Minimum hardware: Win 10 64-bit, i5-6600 / Ryzen 5 1600, 8 GB RAM, GTX 1050 / RX 560 2 GB, DX11, 4 GB storage. Recommended: Win 11, i5-10600 / Ryzen 5 3600, 16 GB, GTX 1660 / RX 5600 XT 6 GB, 10 GB. macOS min 12 Monterey + M1 + 8 GB; recommended macOS 14 Sonoma + M1 Pro/M2 + 16 GB. | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| T14 | The dev on simulation scaling: "The hard part with this stuff is always scaling. Once you really simulate every single person in detail, you hit limits pretty quickly. And traffic is especially tricky. A lot of city builders use some kind of trick in problematic situations, like **removing cars after they have been stuck for too long**"; city builders "work with unrealistic distances, speeds and time scales… keeping traffic completely consistent over a long period of time is surprisingly difficult". | [CONFIRMED] | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| T15 | Region View is entered by **zooming out fully, then zooming out again**; it shows all maps of the one region, the active map is marked blue; switching maps **reloads the game** with the selected city. | [CONFIRMED] | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| T16 | Two camera modes are switched from the top-left of the HUD: a **perspective camera with tilt-shift** and an **orthographic camera** ("autographic gives you a bigger field of view"). | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| T17 | The mobile title is a **voxel-based 3D tycoon city builder**; "huge maps and regions", "zoom in and explore in walk mode", "hundreds of buildings", add-ons for continuous content growth, premium sandbox. | [CONFIRMED] | https://www.youtube.com/watch?v=6Jd2kyaEZbM |
| T18 | The Steam release is a **separate, non-free product** with a **map creator** for unlimited user maps; Steam version carries "no microtransactions" and "a fair progression system". | [CONFIRMED] | https://www.youtube.com/watch?v=bOPESpVGXOU |
| T19 | The **Science View** renders data as a separate map layer with a right-hand selector; emitters highlight in orange, affected areas in brown, with a per-selection "?" explainer. | [CONFIRMED] | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| T20 | The mobile build's telemetry stack is disclosed as **Unity Analytics / Unity Ads**, **Firebase** (Realtime Database, Cloud Firestore, Cloud Functions, Remote Config), **Microsoft Azure**, **Sentry** and **Tenjin** — i.e. a Unity client with a hosted backend. | [CONFIRMED] | https://supercitycon.net/privacypolicy.html |
| T21 | Mobile listings: iOS 14+, iPhone/iPad/iPod touch, 300+ structures, Region View, Street View, Mayoral Match-Up (4.7★ / 1,576 ratings); Google Play — Android 8.0+, "Updated on Dec 21, 2025", 10K+ downloads, contains ads, in-app purchases, 4.2★ / 598 ratings, also offered on "Windows* (*Powered by Intel® technology)". | [CONFIRMED] | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 · https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| T22 | A shipped localisation defect proves the shipped build has a **font-asset / glyph-fallback pipeline**: tutorial dialogue renders blank for CJK while Latin scripts render normally. | [CONFIRMED] | https://steamcommunity.com/app/3474890/discussions/0/563671339629567949/ |
| T23 | A shipped defect report states the demo "gets to the loading screen & that's it" — load-time robustness is a live, unfixed issue on the PC build. | [CONFIRMED] | https://steamcommunity.com/app/3474890/discussions/ |
| T24 | iCloud sync between iPhone and iPad is part of the mobile title's feature set. | [CONFIRMED] | Shared brief §3.11 (mobile title feature list) |
| T25 | The developer's stated community surfaces are Discord and Reddit — "the Discord and the Reddit is actually the communities… for up-to-date informations as well as this YouTube channel". | [CONFIRMED] | https://www.youtube.com/watch?v=bOPESpVGXOU · https://www.reddit.com/r/supercitycon/ |
| T26 | The Steam store page's own **feature bullets** state: "**SCC Studio & Steam Workshop**: Create, customize and share maps, models and characters with the in-game voxel editor"; "**In-game footage captured using SuperCitycon's built-in video tools**"; "**First- and third-person modes** let you step inside and explore the city you created"; "**Design your own character**"; "Choose the time of day and weather to give your city a different atmosphere". | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| T27 | The dev's authoring tutorial states the concern that user-made models "might possibly have to develop a system because here we can't overflow the game with a ton of different models and all keep some kind of **quality level**", and shows a **model browser** ("here is your browser section where you can find all your models"). | [CONFIRMED] | https://www.youtube.com/watch?v=NJfQ_5-wlWo |

### 1.2 Screens / flows observed

- **Official site hero + three scene panels** — an island city containing an old town, a bridge carrying traffic, a downtown skyline, sailboats and dolphins in the bay; a corner café with passing traffic and pedestrians crossing a square; a night shot where windows are lit. This is the canonical art-direction brief for the rebuild (T9).
- **"The Basics" tutorial (mobile)** — right-hand inventory rail with bulldozer categories; drag-to-build with automatic snapping to streets; long-press a building to enter orbit/edit mode with rotate / move / confirm; construction-slot counter bottom-left; camera-mode toggle top-left; minimap top-right opening the Science View. UI is being rebuilt from scratch for the PC title, so treat mobile HUD layout as reference only (T16, T19).
- **"Switching Maps" tutorial (mobile)** — double zoom-out enters Region View; map cards fade their connecting lines after ~2–3 s leaving a "clean area" for screenshots; tapping a map shows per-map tile usage (land / beach / water occupied and free), rename, and a full-map bulldoze that returns owned buildings to the inventory and cannot be undone (T15).
- **"How to make models … with Magica Voxel" tutorial (dev)** — the only public window into the actual voxel asset pipeline: 32×32-voxel tiles, indexed palette, Face/Box tools, Attach/Erase/Paint, console-driven `Rand` material variation (T4, T5, T6).
- **"Camera Modes" tutorial** — a dedicated official video exists for camera modes; the transcript was not machine-retrievable, so camera detail is taken from the "The Basics" narration (T16) and the video's existence (source S19).

---

## 2. System overview

```
                        ┌──────────────────────────────────────────────┐
                        │            SIMULATION CORE (headless)        │
  clock / speed  ──────▶│  fixed 20 Hz tick · seeded PRNG · no DOM     │
  offline delta  ──────▶│  ┌───────────┐ ┌──────────┐ ┌────────────┐   │
                        │  │ Traffic   │ │ People   │ │ Services   │   │
                        │  │ (MOB)     │ │ (POP)    │ │ (SRV)      │   │
                        │  └─────┬─────┘ └────┬─────┘ └─────┬──────┘   │
                        │        └────────────┴────────────┘           │
                        │        agents ← capped per segment           │
                        │        spatial hash grid (uniform, 16 m)      │
                        └──────────────────────┬───────────────────────┘
                                               │ snapshot (positions, LOD flags)
                        ┌──────────────────────▼───────────────────────┐
                        │             PRESENTATION LAYER              │
                        │  World → Region → Map → Chunk(16² tiles)    │
                        │  Chunk → greedy mesh → atlas material pass  │
                        │  Agents → instanced draw (LOD0/1/2)          │
                        │  Overlays → Science View / region overlay   │
                        │  Post → day/night grade → weather grade  │
                        │        → palette quantise (LAST)           │
                        └──────────────────────┬───────────────────────┘
                                               │
       ┌───────────────────┬───────────────────┼───────────────────┐
       ▼                   ▼                   ▼                   ▼
  AUDIO BUS          PERSISTENCE          PLATFORM            CONTENT
  master/music/      save schema v_N      storage adapter     asset registry
  sfx/ambience/ui    → region JSON        input adapter       (.vox → atlas →
  voice                → autosave          renderer backend     chunk binary)
                       → cloud sync        quality tier
```

**Layer rules (non-negotiable for the rebuild)**
1. The simulation layer has **no dependency** on the renderer, the DOM, or the audio layer — it must run headless for tests and for offline catch-up.
2. The renderer reads an immutable **snapshot** produced by the tick; it never mutates simulation state.
3. Content (voxel assets, definitions) is addressed by **content hash**; the simulation refers to assets only by hash, never by inline geometry.
4. Persistence writes the **simulation state plus content hashes**, never GPU resources.

---

## 3. Functional requirements

### 3.1 Art direction & palette

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-TEC-001 | The renderer must present the world in a **retro 16-bit palette** while remaining a modern 3D world: colour is authored and indexed against a fixed 16-bit-era palette, not arbitrary RGB. | Must | PC-EA | partial | QA-TEC-001 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english, https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-TEC-002 | Final frame colour must be **quantised to the palette** as a post-process so that every pixel in the frame uses an approved palette entry; no intermediate shading colour may survive the quantise step. | Must | PC-EA | partial | QA-TEC-001 | [INFERRED] from https://store.steampowered.com/api/appdetails?appids=3474890&l=english, https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-TEC-003 | The world grid must be authored at **32 × 32 voxels per tile**; a model occupying one tile has a 32 × 32 voxel footprint, and the author's reference park-tile model is 32 voxels tall. All model imports, terrain stamping and road widths must reconcile to this grid. | Must | Both | partial | QA-TEC-002 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-TEC-004 | Palette entries must be **indexed with semantic ranges** (foliage occupies indices 9–13) so that material variation can be generated procedurally inside a range, as the original does. | Must | PC-EA | yes | QA-TEC-001 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-TEC-005 | Material variation must be reproducible procedurally from a palette range (the original's `Rand 9 13` technique) with a deterministic seed. | Should | PC-EA | yes | QA-TEC-001 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-TEC-006 | MagicaVoxel `.vox` must be usable as an **authoring interchange format** so third-party and player-authored voxel models convert without loss of the 32×32 grid or the palette indices. Whether `.vox` is accepted as a **runtime** import path (into `STD`'s asset format) or only as an offline conversion input is a **design decision — see §11 Q29**; the public sources show models authored in Magica Voxel, not a runtime import path. | Should | PC-EA | yes | QA-TEC-018 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-TEC-007 | Buildings, vehicles, citizens and props must be **voxel geometry**, not billboarded sprites; the developer's own editor produces voxels and "pretty much everything in the game can be made with it". | Must | PC-EA | yes | QA-TEC-002 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798, https://www.youtube.com/watch?v=NJfQ_5-wlWo, https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| FR-TEC-008 | Facade signage must respect the voxel budget: legible lettering requires a minimum cap height of 4 voxels per character row (**TBD — see §11 Q20**), and text longer than the facade's voxel budget must be truncated or omitted by the authoring tool rather than scaled into illegibility. | Should | PC-EA | yes | QA-TEC-018 | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| FR-TEC-009 | The renderer must be able to reproduce the **published art direction** — the seaside neighbourhood, bridge with traffic, downtown skyline, sailboats and dolphins in the bay — at the same art standard as the rest of the city. (The listed scenes are the official site's own description of the shipped look; they are a capability requirement, not a claim that a specific scene ships in Early Access.) | Must | PC-EA | partial | QA-TEC-004 | https://supercitycon.net/ |
| FR-TEC-010 | At night, **building windows must emit light** (the official site's scene caption reads "Day becomes night and the windows light up"). The **implementation** — emissive window state as a per-voxel material flag switched by the day/night clock rather than a separate overlay mesh — is a **design decision — see §11 Q1**. | Must | PC-EA | yes | QA-TEC-005 | https://supercitycon.net/ |
| FR-TEC-011 | The 16-bit identity must be an explicit art-direction constraint on every art asset (palette-bounded, hard-edged, no anti-aliased gradients), enforced by the asset validator. | Must | PC-EA | yes | QA-TEC-001 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english, https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| FR-TEC-012 | The default view framing is **isometric-style** (the Steam tag set includes "Isometric"); the perspective camera applies a **tilt-shift** look, and the second camera mode is **orthographic**, which gives a wider field of view than the tilt-shift perspective mode. | Should | PC-EA | partial | QA-TEC-004 | https://www.youtube.com/watch?v=jYAD0SkDmY0 · https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-013 | Rendering must stay visually coherent across the whole zoom range: fully zoomed in, individual voxels are readable; fully zoomed out, the city reads as a pixel-art silhouette with no shimmering. | Must | PC-EA | partial | QA-TEC-004 | [INFERRED] from https://supercitycon.net/, https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-TEC-014 | Weather-driven palette shifts (rain desaturation, snow tint, night grade) must be applied **within the same palette** — a grade may remap palette indices, never introduce off-palette colours (**TBD — see §11 Q6**). | Must | PC-EA | partial | QA-TEC-006 | [INFERRED] from https://store.steampowered.com/api/appdetails?appids=3474890&l=english, https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |

### 3.2 Voxel data & asset pipeline

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-TEC-015 | The pipeline must be `source .vox → voxel grid → per-chunk greedy mesh → GPU buffers`, executed as an offline build step for shipped content and a runtime path for editor output. | Must | Both | yes | QA-TEC-018 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798, https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-TEC-016 | A **chunk** must be the unit of mesh build, upload and culling; chunk side length is a build-time constant (default 16 × 16 tiles = 512 × 512 voxels) (**TBD — see §11 Q1**). | Must | Both | yes | QA-TEC-003 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-017 | All voxel surfaces must sample a **single texture atlas** built from the palette, sampled with nearest-neighbour filtering and **without mipmaps**, to preserve hard pixel edges. | Must | PC-EA | yes | QA-TEC-001 | [INFERRED] from https://store.steampowered.com/api/appdetails?appids=3474890&l=english, https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-TEC-018 | Repeated small props (street furniture, trees, lamps) must render via **GPU instancing** from a shared mesh library, not as unique geometry per instance. | Must | PC-EA | yes | QA-TEC-015 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-019 | Every asset must carry at least **two detail levels** (full voxel mesh and a reduced mesh) plus an **impostor** representation used at Region View distance (**TBD — see §11 Q3**). | Should | PC-EA | yes | QA-TEC-004 | [INFERRED] from https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-TEC-020 | The asset registry must be **content-addressed** (hash → payload) so that Workshop-modified assets, DLC buildings and base assets coexist in one cache without filename collisions. **[INFERRED] design decision — see §11 Q9** (the hash algorithm is not specified by any source). | Must | PC-EA | yes | QA-TEC-018 | [INFERRED] design decision · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798, https://www.youtube.com/watch?v=bOPESpVGXOU |
| FR-TEC-021 | A runtime-generated asset (SCC Studio output) must be insertable into a live city **without rebuilding unrelated chunks**; only chunks intersecting the asset's footprint re-mesh. | Must | PC-EA | partial | QA-TEC-018 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-022 | Each asset must auto-generate a **collision proxy** from its voxel occupancy (solid voxels → collision) so custom assets block movement without manual authoring. Pedestrian walk surfaces are **not** derived from voxels: `MOB` owns the sidewalk network (FR-MOB-033), and the engine exposes each asset's footprint to it as an obstruction. | Must | PC-EA | yes | QA-TEC-018 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-023 | The asset validator must reject any `.vox` whose colour indices fall outside the engine palette, with a per-asset error listing offending indices. | Should | PC-EA | yes | QA-TEC-018 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |

### 3.3 Rendering pipeline

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-TEC-024 | The renderer must be a **WebGL2-first, WebGPU-optional** stack (Three.js-class), with a backend abstraction so the same scene code runs on either (**TBD — see §11 Q14**). | Must | Both | partial | QA-TEC-015 | Rebuild target (brief) + https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-025 | Chunk meshes must be produced by **greedy meshing** per chunk and per material pass, with interior faces between neighbouring solid voxels culled. | Must | PC-EA | yes | QA-TEC-003 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798, https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-TEC-026 | Chunk visibility must be decided by **frustum culling plus a camera-distance band**; a chunk is culled when it fails **either** test (outside the frustum **or** beyond the distance band) and is submitted only when it passes both. | Must | PC-EA | yes | QA-TEC-015 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-027 | The renderer must hold the **draw-call budget in §7**; when the budget is exceeded the renderer must escalate chunk LOD rather than drop visible geometry silently. | Must | PC-EA | partial | QA-TEC-015 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-028 | Agents (vehicles, citizens, trains, boats, helicopters) must be drawn by **instanced passes** keyed on agent archetype and LOD, never one draw call per agent. | Must | PC-EA | partial | QA-TEC-015 | [INFERRED] · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-029 | Transparent surfaces (water, glass, canopy foliage) must render in a **separate pass after opaque**, sorted back-to-front, with depth-write disabled. | Must | PC-EA | partial | QA-TEC-003 | [INFERRED] · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 · https://supercitycon.net/ |
| FR-TEC-030 | Water must be a distinct material pass with an animated surface; shoreline treatment (foam, depth tint) must be derived from terrain height, not painted per tile (**TBD — see §11 Q7**). | Should | PC-EA | partial | QA-TEC-003 | [INFERRED] from https://supercitycon.net/ |
| FR-TEC-031 | Shadows must be a **directional cascade set** whose cascade count and resolution scale with the quality tier; the shadow camera must follow the view target, not the world origin. | Must | PC-EA | partial | QA-TEC-015 | [INFERRED] from https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-032 | A **quality-tier-driven shadow switch** must exist: Low tier disables shadow casting entirely; High tier enables the full cascade set. | Must | PC-EA | partial | QA-TEC-015 | [INFERRED] · https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-033 | **Ambient occlusion must be baked per voxel corner** at mesh-build time from the 8 neighbouring voxels of that corner, so voxel forms read as solid without runtime SSAO. | Should | PC-EA | yes | QA-TEC-003 | [INFERRED] from https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-TEC-034 | The final blit must apply, in order: **day/night colour grade → weather grade → palette quantise**. The quantise step is last so that no later pass can introduce off-palette colour. | Must | PC-EA | partial | QA-TEC-001 | [INFERRED] from https://store.steampowered.com/api/appdetails?appids=3474890&l=english, https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-035 | The sky must be a **gradient dome with a sun/moon disc**, driven by the same clock as the directional light, so sun position and sky can never disagree. | Should | PC-EA | partial | QA-TEC-005 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-036 | A **Region View render mode** must exist, showing all maps of the region simultaneously with per-map boundary overlays that fade after ~2–3 s of no input, matching the published behaviour. | Must | PC-EA | partial | QA-TEC-004 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-TEC-037 | Built-in **video/screen capture tools** must exist: the store page's own feature bullet reads "*In-game footage captured using SuperCitycon's built-in video tools*", so the tools are part of the shipped PC title; capture must take the running framebuffer to a file without altering simulation speed. The **capture output format and resolution are [TBD — see §11 Q28]**. | Should | PC-EA | yes | QA-TEC-019 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-TEC-038 | The Science View must render as a **separate overlay pass** that can be toggled over the live 3D map, with per-selection help text available. The engine supplies the overlay pass, the highlight shader and the emitter/affected-area masks; **the category colours are owned by `SRV`** (the published build highlights emitters in orange and affected areas in brown). | Must | PC-EA | partial | QA-TEC-004 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-TEC-039 | The simulation tick must run on a **Web Worker** with a message-based snapshot hand-off, so the 4 ms tick budget is not contended with WebGL on the main thread. Render may drop to a lower internal render rate, but the simulation tick rate must not vary with frame rate. | Must | Both | no | QA-TEC-008 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-040 | The renderer must support an **off-screen/capture mode** that renders at a fixed resolution independent of the window, so the recorded output is stable. | Should | PC-EA | yes | QA-TEC-019 | [INFERRED] · https://store.steampowered.com/app/3474890/SuperCitycon/ (built-in video tools) · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |

### 3.4 Lighting, day/night & weather visuals

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-TEC-041 | A **full day/night cycle** must be simulated and visible; the player controls time of day ("Choose the time of day and weather to give your city a different atmosphere"). | Must | PC-EA | no | QA-TEC-005 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798, https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-TEC-042 | Sun and moon direction must be derived from the simulation clock by a single function; the directional light angle, sky gradient and shadow direction all read from it. | Must | PC-EA | no | QA-TEC-005 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-043 | A **day/night colour-grade LUT** must exist with at least four keyframes (dawn, day, dusk, night); grade must be palette-bounded (FR-TEC-014). The keyframe count is a **design decision — see §11 Q1**. | Must | PC-EA | partial | QA-TEC-005 | [INFERRED] from https://store.steampowered.com/api/appdetails?appids=3474890&l=english, https://supercitycon.net/ |
| FR-TEC-044 | Ambient light must be an explicit term in the lighting model with its own day/night curve, separate from the directional light, so night scenes remain readable without blowing out window emission. | Must | PC-EA | no | QA-TEC-005 | [INFERRED] · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-045 | The player must be able to set **weather**; weather must be a simulation-owned state that the renderer and the simulation both read (**TBD — see §11 Q5**). | Must | PC-EA | no | QA-TEC-006 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-TEC-046 | Weather states must include at least clear, rain, snow and fog (or heavy overcast), each with a distinct visual treatment (**TBD — the state set is not public, see §11 Q5**). | Should | PC-EA | partial | QA-TEC-006 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 · §11 Q5 |
| FR-TEC-047 | Rain must be a GPU particle/sheet effect plus a **wetness term** that darkens horizontal surfaces and adds specular response to roads (**TBD — the wetness response is a design decision, see §11 Q5**). | Should | PC-EA | no | QA-TEC-006 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 · §11 Q5 |
| FR-TEC-048 | Snow must be a falling-particle effect plus an **accumulation tint** applied to upward-facing voxel faces, mixed by the weather state (**TBD — see §11 Q5**). | Should | PC-EA | partial | QA-TEC-006 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 · §11 Q5 |
| FR-TEC-049 | Fog must be **height-based exponential fog** (denser in low terrain, thinner above), with density bound to the weather state and to a camera-distance LOD so that distant chunks fade out rather than popping (**TBD — the fog model is a design decision, see §11 Q5**). Fog density must be capped so that Region View and the fully zoomed-out city stay legible (FR-TEC-013, FR-TEC-036). | Must | PC-EA | no | QA-TEC-004 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 · §11 Q5 |
| FR-TEC-050 | **Fires and tornadoes** must be renderable world events with dedicated visual effects (flame/emissive voxel + smoke column; tornado column + debris). | Should | PC-EA | partial | QA-TEC-006 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-051 | A **disaster/tornado** effect must not desynchronise from the simulation: effect placement, duration and damage must be driven by simulation state with the renderer only presenting it. | Must | PC-EA | partial | QA-TEC-006 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798, https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |

### 3.5 Animation & agents

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-TEC-052 | **Vehicles** must be voxel models driven along the road graph with their body orientation following the path tangent; wheel rotation must be derived from travelled distance, not from a fixed rate (**design decision — see §11 Q21**). | Must | PC-EA | yes | QA-TEC-007 | https://www.youtube.com/watch?v=NJfQ_5-wlWo, https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-053 | **Pedestrians** must be voxel citizens walking sidewalk paths with a procedural walk cycle (leg/arm phase, body bob) driven by distance travelled (**design decision — see §11 Q21**). | Must | PC-EA | yes | QA-TEC-007 | https://supercitycon.net/, https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-054 | **Trains** must run on railway paths with bogie-aligned orientation; multi-car consists must articulate along the track curve (**design decision — see §11 Q21**). | Must | PC-EA | yes | QA-TEC-007 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-055 | **Boats / sailboats** must navigate water paths with hull orientation following the path; a **wake** effect must trail the hull (**design decision — see §11 Q21**). | Should | PC-EA | yes | QA-TEC-007 | https://supercitycon.net/, https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-056 | **Helicopters** must animate rotor spin and a hover bob independent of ground contact, and must not be subject to the road-graph movement model (**design decision — see §11 Q21**). | Should | PC-EA | yes | QA-TEC-007 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-057 | **Dolphins** in the bay must be animated water-surface entities (arc trajectory + surface breach), not building props (**design decision — see §11 Q22**). | Could | PC-EA | yes | QA-TEC-007 | https://supercitycon.net/ |
| FR-TEC-058 | Agent **render LOD** must be three-tier: LOD0 full voxel model (near), LOD1 reduced mesh (mid), LOD2 instanced billboard/impostor or hidden (far); the switch distance scales with the quality tier (**TBD — see §11 Q3**). | Must | PC-EA | partial | QA-TEC-015 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-059 | An agent that is **not being simulated must not be animated**; render LOD and simulation LOD must be driven from the same visibility decision, so simulation cost bounds rendering cost. | Must | PC-EA | partial | QA-TEC-009 | [INFERRED] from https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-TEC-060 | The **player avatar** must be a voxel model whose appearance is player-editable: the store page lists "First- and third-person modes let you step inside and explore the city you created" and "Design your own character", and the official 30-seconds video shows "zoom in and explore in walk mode". Whether the body is hidden in first person and shown in third is a **design decision — see §11 Q24**. | Must | PC-EA | yes | QA-TEC-007 | https://store.steampowered.com/app/3474890/SuperCitycon/ · https://www.youtube.com/watch?v=6Jd2kyaEZbM |
| FR-TEC-061 | Animation phase must be a function of **simulation time**, so that pausing, fast-forwarding and offline catch-up all animate agents consistently. | Must | PC-EA | no | QA-TEC-008 | [INFERRED] from https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-TEC-062 | Vehicles and citizens must **stop animating and be culled** when their segment is not in the active simulation set, with a grace period to avoid pop-in. | Should | PC-EA | partial | QA-TEC-009 | [INFERRED] · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |

### 3.6 Simulation tech

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-TEC-063 | The simulation must run on a **fixed timestep** (proposed 20 Hz) decoupled from rendering, with an accumulator and a spiral-of-death guard (max 5 catch-up ticks per frame) (**TBD — see §11 Q15**). | Must | Both | no | QA-TEC-008 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798, https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-TEC-064 | The simulation must be **deterministic given a seed and an input sequence**: all randomness comes from a seeded PRNG; no `Math.random`, no wall-clock reads inside simulation code. | Must | Both | no | QA-TEC-008 | [INFERRED] from https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-TEC-065 | Speed control must support **pause, 1×, 2×, 3×** (the mobile title shows a 2× ad-boost; the PC title's speed set is **TBD — see §11 Q19**; the timed 2× ad boost itself is `CORE`'s, FR-CORE-010). Speed is implemented by consuming more fixed ticks per real second, never by changing the tick length. | Must | PC-EA | no | QA-TEC-008 | https://www.youtube.com/watch?v=jYAD0SkDmY0 · https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ · Shared brief §3.4 |
| FR-TEC-066 | The **time-conversion mechanism** for offline progression must be computed on load from `savedAt`: elapsed real time is converted into simulated minutes at the documented rate (see §11 Q4). `TEC` owns only the conversion and the catch-up cap (§7.2 rule 7); the simulation domains own what the elapsed time does (construction timers are `CORE`'s, FR-CORE-011). | Must | PC-EA | partial | QA-TEC-012 | Shared brief §3.4 (offline progress) · https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-TEC-067 | The agent set must be **budgeted**: a hard cap on simultaneously simulated agents, enforced by culling the lowest-priority agents (far, off-screen, non-critical) when the cap is reached, with the cap set by quality tier (**TBD — see §11 Q2**). | Must | PC-EA | partial | QA-TEC-009 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/, Shared brief §3.6 |
| FR-TEC-068 | Agents must be indexed in a **uniform spatial hash grid** (proposed 16 m cell) so that neighbour queries, collision and culling are O(1)-ish rather than O(n) (**TBD — see §11 Q2**). | Must | PC-EA | partial | QA-TEC-009 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-069 | `MOB` owns the routing algorithm and its cost function (FR-MOB-039). `TEC` must supply the enabling substrate: a **road graph** of nodes and directed edges carrying a version counter, a **route cache** keyed on (origin, destination, graph-version), and an incremental path-query interface that does not re-plan the whole network when one edge changes. | Must | PC-EA | partial | QA-TEC-010 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-TEC-070 | The graph version must increment on any network edit, invalidating stale routes; newly routed agents must re-plan rather than continue on a deleted edge. | Must | PC-EA | partial | QA-TEC-010 | [INFERRED] · https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-TEC-071 | The engine must support `MOB`'s **stuck-vehicle despawn** rule (FR-MOB-046; threshold in `MOB`'s OQ-MOB-10, proposed 60 s) so a single jam cannot deadlock the network. `TEC` supplies the per-segment blocker timer and the removal from the active simulation set; `MOB` owns the threshold and the despawn destination (**design decision — see §11 Q16**). | Should | PC-EA | partial | QA-TEC-010 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-TEC-072 | Service **coverage fields** must be computed as a rasterised field per service category and updated **incrementally on a budget** (a fixed number of tiles per tick), never fully recomputed in one frame. | Must | PC-EA | partial | QA-TEC-011 | [INFERRED] from https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-TEC-073 | Coverage computation must be **incremental and order-independent** with respect to frame timing: a coverage field computed at tick N is identical regardless of how many ticks ran per frame. | Must | PC-EA | partial | QA-TEC-011 | [INFERRED] from the FR-TEC-064 determinism rule · https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-TEC-074 | The simulation must expose a **headless mode** (no renderer, no DOM, no audio) that runs the identical tick code, so determinism and balance can be tested in CI. | Must | Both | no | QA-TEC-008 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-075 | The tick must publish an immutable **snapshot** (agent positions, orientations, LOD flags, tile states) that the renderer interpolates between the last two ticks. The snapshot must be **double-buffered** — two pre-allocated buffers swapped at the end of each tick — so the tick path performs no per-tick allocation (NFR-TEC-004). | Must | Both | no | QA-TEC-007 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-076 | Simulation state must be **serialisable to and from a canonical JSON form** using the same schema as the save file, so the in-memory model and the save model cannot drift. Canonical form = sorted keys, fixed number formatting, no timestamps outside `savedAt`. Regenerable entities (vehicles, citizens — §6.6) are **excluded** from the round-trip comparison, and gzip (FR-TEC-124) is a transport encoding, not part of the canonical form. | Must | PC-EA | no | QA-TEC-012 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |

### 3.7 Audio

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-TEC-077 | The audio layer must use a **named bus model** — Master → {Music, SFX, Ambience, UI, Voice} — so per-category volume is separately controllable. | Must | PC-EA | no | QA-TEC-016 | [INFERRED] from https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| FR-TEC-078 | **Custom volume controls** must be exposed to the player (Steam feature category on the shipped demo) with independent sliders for music, effects, ambience and UI. | Must | PC-EA | no | QA-TEC-016 | https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| FR-TEC-079 | The engine must expose an **audio event bus** (`sfx.play(id, {position, gain})`) so that gameplay code requests sounds by semantic id and never by asset path. | Must | PC-EA | yes | QA-TEC-016 | [INFERRED] · https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| FR-TEC-080 | Traffic **ambience** must be a continuous bed whose density and stereo width scale with the number of vehicles in the listener's cell, plus per-vehicle engine sounds with distance attenuation. | Should | PC-EA | partial | QA-TEC-016 | [INFERRED] from https://supercitycon.net/ |
| FR-TEC-081 | Construction and demolition must have distinct audio feedback, and UI interactions (confirm, cancel, error) must have distinct cues. | Should | PC-EA | yes | QA-TEC-016 | [INFERRED] · https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| FR-TEC-082 | Music direction should sit in the **16-bit / chiptune-MIDI idiom** the developer cites as formative (SimCity SNES's "slightly strange, almost psychedelic MIDI soundtrack"). **[TBD — design decision; see §11 Q11]** — the source establishes the developer's taste, not the shipped score. | Could | Design | partial | QA-TEC-016 | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| FR-TEC-083 | The Steam listing flags all **24 languages as having full audio support**, so the audio pipeline should support a per-locale voice track plus a shared SFX bed. **[TBD — design decision; see §11 Q18]** — the listing states the localisation claim; it does not state the asset mix. | Could | Design | yes | QA-TEC-016 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-084 | Audio must **suspend when the page is hidden** and must resume on return without a burst of stale scheduled sounds. | Must | PC-EA | no | QA-TEC-016 | [INFERRED] · https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| FR-TEC-085 | In a browser build, the audio context must be **unlocked on the first user gesture** and must degrade to a silent-but-alive state if unlocking fails. | Must | PC-EA | no | QA-TEC-016 | [INFERRED] · https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| FR-TEC-086 | The audio system must be fully optional: disabling all audio must not change simulation outcomes, and no simulation behaviour may branch on audio state. | Must | PC-EA | no | QA-TEC-016 | [INFERRED] from FR-TEC-064 · https://store.steampowered.com/api/appdetails?appids=5295650&l=english |

### 3.8 Persistence & cloud sync

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-TEC-087 | The **logical save schema** must be a versioned JSON document (`schemaVersion`, `savedAt`, `region`, `maps[]`, `inventory`, `settings`) that is human-inspectable and diffable. The **physical package** is defined by FR-TEC-098 and FR-TEC-138: one region manifest plus one document per map (**design decision — see §11 Q9**). | Must | PC-EA | yes | QA-TEC-012 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-088 | The save schema must carry a **version integer** and every load must run a migration chain from the file's version to the current version. | Must | PC-EA | yes | QA-TEC-013 | [INFERRED] · Shared brief §3.4 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-089 | A **region save** must contain all maps of the region in one document, with each map carrying its own tile-usage statistics (land / beach / water occupied and free) and its own name. | Must | PC-EA | yes | QA-TEC-012 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-TEC-090 | **Autosave** must run on a fixed interval and on every state-changing action the player confirms. In the browser build the write must be a **single IndexedDB transaction** (atomic by definition); no autosave may depend on `beforeunload`, which cannot complete an asynchronous write. The previous good save must never be corrupted. The **interval is a design decision — see §11 Q30**. | Must | PC-EA | yes | QA-TEC-012 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-091 | Switching maps must **not reload the page** in the rebuild; it must swap the streamed map while preserving the region document, even though the original reloads the game (**TBD — see §11 Q17**). | Must | PC-EA | yes | QA-TEC-012 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-TEC-092 | Save documents must reference assets by **content hash** only; a save written with a Workshop asset must record the hash so the asset can be re-fetched or reported missing on load (**TBD — see §11 Q10**). | Must | PC-EA | yes | QA-TEC-014 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798, https://www.youtube.com/watch?v=bOPESpVGXOU |
| FR-TEC-093 | Loading a city containing a **missing Workshop asset** must succeed with a placeholder and a visible warning listing the missing hashes — it must not abort the load. | Must | PC-EA | yes | QA-TEC-014 | [INFERRED] · https://store.steampowered.com/app/3474890/SuperCitycon/ (Steam Workshop sharing) · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-094 | Cloud sync must work between iPhone and iPad via **iCloud** on the Apple mobile target only (Stage `Mobile`); the web build has no iCloud entitlement and uses the provider-agnostic adapter of FR-TEC-095, which may be a local-only adapter on a static host (FR-TEC-116). The sync contract is a per-region document with per-map granularity and last-write-wins per map (**design decision — see §11 Q9**). | Should | Mobile | partial | QA-TEC-014 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 (iPhone/iPad) · Shared brief §3.11 for the iCloud-sync statement |
| FR-TEC-095 | The sync layer must be **provider-agnostic** behind a storage adapter so iCloud, a web backend, and local disk implement the same interface. | Must | PC-EA | yes | QA-TEC-014 | https://supercitycon.net/privacypolicy.html |
| FR-TEC-096 | The simulation clock must be stored as **simulation-relative time**, not wall-clock timestamps, so a save loaded in a different timezone continues identically. | Must | PC-EA | yes | QA-TEC-013 | [INFERRED] · Shared brief §3.2 (Day Zero, year counter) · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-097 | The browser build must persist saves to **IndexedDB** (auto) and allow explicit **export / import as a downloadable file** for backup and transfer. | Must | PC-EA | yes | QA-TEC-012 | [INFERRED] · Shared brief §3.11 (iCloud sync) · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-098 | Save data must be **size-bounded**; the physical package is a **region manifest plus one JSON document per map** (FR-TEC-138), never a single monolithic file. The logical schema (FR-TEC-087) is unchanged by this split. | Should | PC-EA | yes | QA-TEC-012 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |

### 3.9 Performance targets & quality tiers

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-TEC-099 | The web build must define **concrete frame-rate, draw-call, agent-count, memory and load-time targets** derived from the published Steam minimum/recommended hardware. The published sources give **hardware only, no frame budgets** — the budgets below are an explicit design decision (**TBD — see §11 Q1**). | Must | Both | no | QA-TEC-015 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english (design decision) |
| FR-TEC-100 | The engine must expose **four quality tiers** — Low, Medium, High, Ultra — each defining draw-call cap, shadow cascade count, LOD distances, particle budget, agent cap and memory ceiling (§4.1) (**TBD — see §11 Q1**). | Must | PC-EA | no | QA-TEC-015 | [INFERRED] from https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-101 | The quality tier must be **auto-detected** from device heuristics on first run and **manually overridable** at any time, with the override persisted in settings. | Must | PC-EA | yes | QA-TEC-015 | [INFERRED] · https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-102 | Independent **settings** must exist for shadows, LOD distance bias, agent cap, resolution scale, particle density and palette quantisation — each with a defined effect on the tier defaults (§4.1). | Must | PC-EA | yes | QA-TEC-015 | https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| FR-TEC-103 | A **resolution scale** (render scale 50–100 %) must exist as the primary performance lever on low tiers, applied as a render-target resize with UI rendered at native resolution. The range is a **design decision — see §11 Q1**. | Must | PC-EA | yes | QA-TEC-015 | [INFERRED] design decision · https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-104 | A **performance overlay** must be available (frame time, tick time, draw calls, triangles, agent count, chunk count, VRAM estimate) for tuning. | Should | PC-EA | yes | QA-TEC-015 | [INFERRED] · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-105 | The **load path must be fault-tolerant**: a failure while loading a map must surface a readable error and a retry, never an indefinite loading screen. | Must | PC-EA | partial | QA-TEC-020 | https://steamcommunity.com/app/3474890/discussions/ |
| FR-TEC-106 | The initial web payload must be **code-split**: the shell + city core loads first, and map/region data streams in afterwards. | Should | PC-EA | yes | QA-TEC-020 | [INFERRED] · https://steamcommunity.com/app/3474890/discussions/ · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-107 | The build must **budget asset bytes per map** so that a region of N maps does not multiply the initial download; assets are fetched per content hash on demand. | Should | PC-EA | yes | QA-TEC-015 | [INFERRED] · Shared brief §2 (huge maps) · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |

### 3.10 Platform & input

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-TEC-108 | Supported platforms for the rebuild: **Windows, macOS, Linux, iOS, Android, Web** (Must) and **Steam Deck** (Should, Stage `PC-EA` — the original lists Windows and macOS only, `linux: false`, and has no Deck listing; see §11 Q12). | Must | Both | no | QA-TEC-017 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english, https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 · https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| FR-TEC-109 | Input must be abstracted behind a **platform-agnostic action map** (move, look, zoom, place, demolish, open panel, speed toggle) so that mouse/keyboard, touch and gamepad all drive the same game logic. | Must | Both | yes | QA-TEC-017 | https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| FR-TEC-110 | **Touch input** must be supported: the mobile title is published for iPhone/iPad/iPod touch and Android, so touch is a shipped input mode of the product family. A per-device **first-person sensitivity** setting is a **design decision — see §11 Q25**; neither listing states one. | Must | Mobile | yes | QA-TEC-017 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 · https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| FR-TEC-111 | A **mouse-only option** must exist (Steam feature category on the shipped demo): every action reachable without a keyboard. | Should | PC-EA | yes | QA-TEC-017 | https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| FR-TEC-112 | The game must be **playable without timed input** (Steam feature category) — no action may require a reaction inside a timed window. | Must | PC-EA | no | QA-TEC-017 | https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| FR-TEC-113 | **Camera comfort** options must exist (Steam feature category on the shipped demo). The category is the evidenced fact; **the option set — field of view, camera shake / tornado shake, head-bob magnitude — is a design decision (see §11 Q27)**, and the shake amount must be reducible to zero. | Must | PC-EA | partial | QA-TEC-017 | https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| FR-TEC-114 | **Steam Deck** support must be evaluated and stated; at minimum, 1280 × 800 UI readability, controller navigation of all panels, and a Deck-appropriate quality tier are required. Treated as Stage `PC-EA` until §11 Q12 closes. | Should | PC-EA | partial | QA-TEC-017 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-115 | First-person look on web should use **Pointer Lock** where available, with a documented fallback (drag-look) and an always-visible exit affordance. **[TBD — design decision; see §11 Q26]** — Pointer Lock is a browser platform API and a rebuild-target choice; no SuperCitycon source states it. | Should | Design | no | QA-TEC-017 | [TBD] — see §11 Q26 |
| FR-TEC-116 | The web build must not require a **native plugin or download**; it must run from a static host with no server-side requirement for single-player. | Must | PC-EA | no | QA-TEC-020 | Rebuild target (brief); https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-117 | A **PWA / offline-play** mode (installable, playable without network after first load) is desirable but not required for EA. | Could | PC-EA | no | QA-TEC-020 | [TBD] — see §11 Q13 |
| FR-TEC-118 | The build must emit a **structured crash/telemetry hook** (error + performance breadcrumbs) usable by Sentry or an equivalent, matching the mobile title's disclosed Sentry/Firebase stack. | Should | PC-EA | yes | QA-TEC-020 | https://supercitycon.net/privacypolicy.html |

### 3.11 Build-target architecture

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-TEC-119 | The codebase must be split into **seven modules with one-way dependencies**: `core` (shared types/IDs), `sim` (tick), `content` (assets & definitions), `render`, `ui`, `audio`, `platform`. `sim` must not import `render`, `ui` or `audio`. | Must | Both | no | QA-TEC-008 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798, https://supercitycon.net/privacypolicy.html |
| FR-TEC-120 | Building and road definitions must be **data-driven JSON** (the content module), not code; `sim` reads them through a registry interface. | Must | PC-EA | yes | QA-TEC-018 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798, https://www.youtube.com/watch?v=bOPESpVGXOU |
| FR-TEC-121 | The scene graph must be organised **World → Region → Map → Chunk → Tile → Voxel**, with region and map nodes owning their streamed chunk sets. | Must | Both | no | QA-TEC-004 | [INFERRED] from https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-TEC-122 | Agents must use a lightweight **ECS-lite**: archetype component arrays with a free-list allocator, so the tier's agent cap (≤ 10⁴ at Ultra, §4.1) is affordable in a browser. The cap is a **design decision — see §11 Q2**. | Must | PC-EA | partial | QA-TEC-015 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-123 | The engine must define a **single world-unit scale** — `WLD` fixes 1 world unit = 1 voxel (FR-WLD-002) — and expose one derived **voxel→metre constant**; every LOD distance and physical quantity is expressed in world units and converted once at the boundary. The metre scale itself is **TBD — see §11 Q23**. | Must | Both | no | QA-TEC-008 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-124 | The save format must be **JSON, gzip-compressed**, with the compression layer swappable so a binary format can be added later without changing the schema. | Must | PC-EA | yes | QA-TEC-012 | [INFERRED] · Shared brief §3.4 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-125 | The voxel asset pipeline must produce, from a `.vox` source: a **palette-validated voxel grid**, an **atlas entry**, a **greedy-meshed chunk mesh** and **collision/nav proxies**, all content-addressed. | Must | PC-EA | yes | QA-TEC-018 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798, https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-TEC-126 | The engine must expose a **renderer-backend interface** (`WebGL2Renderer`, `WebGPURenderer`) so WebGPU can be adopted without touching simulation or content code. | Should | PC-EA | partial | QA-TEC-015 | [INFERRED] · https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-127 | The platform layer must expose a **storage adapter** (local disk / IndexedDB / cloud provider) and an **input adapter** (pointer+keyboard / touch / gamepad), selected at boot. | Must | PC-EA | yes | QA-TEC-017 | [INFERRED] from https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 (iPhone/iPad) · Shared brief §3.11 for the iCloud-sync statement |
| FR-TEC-128 | The engine must ship a **headless deterministic test harness** that can replay a recorded input stream and assert an identical simulation checksum. | Must | Both | no | QA-TEC-008 | [INFERRED] from https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-TEC-129 | The bundle must be built with a modern bundler (**Vite-class**) with manual chunking so that `sim`, `content` and `render` can be split independently. | Should | PC-EA | yes | QA-TEC-020 | [INFERRED] design decision · https://steamcommunity.com/app/3474890/discussions/ |
| FR-TEC-130 | Simulation code must use a **deterministic math subset**: no transcendental functions (`sin`, `cos`, `pow`, `sqrt` of non-perfect squares), fixed operation order, and fixed-precision or integer arithmetic for currency, positions and timers. The engine must not assume a **fixed frame time anywhere**; all timing derives from the simulation clock plus a monotonic performance timer. | Must | Both | no | QA-TEC-008 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-TEC-131 | The engine must publish an explicit **palette definition**: its length, bit depth, and the reserved index ranges (including foliage 9–13), as machine-readable data. FR-TEC-001, FR-TEC-002 and FR-TEC-023 cannot be tested against an undefined palette. | Must | Both | no | QA-TEC-021 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-TEC-132 | The save document must carry a **`profile` extension object** owned by `CORE` (mode, unlocks, construction slots, residents, score — FR-CORE-124/125), so that sibling domains' state survives a save/load round-trip without `TEC` owning its contents. | Must | Both | no | QA-TEC-023 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-TEC-133 | The agent **archetype enum must be extensible by `MOB`** without engine changes (at minimum: car, truck, bus, bicycle, tram, train, monorail, boat, helicopter, pedestrian); each archetype supplies its own movement model, render model and animation set. | Should | Both | yes | QA-TEC-015 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-TEC-134 | Audio content on the **voice bus** should ship with captions/subtitles, addressable per cue id and per locale, and the caption track should be toggleable independently of the voice track. **[TBD — design decision; see §11 Q18]** — no source states a caption track. | Could | Design | yes | QA-TEC-016 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-135 | A **UI scale** setting must exist (100–200 %, applied to UI elements only, not to the 3D render target) so the interface stays legible on small and high-DPI displays. The range is a **design decision — see §11 Q27**. | Should | PC-EA | no | QA-TEC-022 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-TEC-136 | A **reduced-motion preset** should exist that disables camera bob, camera shake, tornado screen shake and ambient particle motion in one action, independent of the individual camera-comfort options. **[TBD — design decision; see §11 Q27]** — the Steam "Camera Comfort" category covers the individual options, not a one-action preset. | Could | Design | no | QA-TEC-022 | https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| FR-TEC-137 | On mobile (iOS/Android) the quality tier should be **capped at Medium**: the Ultra cascade count and triangle budget are unavailable on those devices, and selecting Ultra should clamp to Medium with a visible notice. **[TBD — design decision; see §11 Q27]** — no source states a tier cap for the mobile title. | Could | Design | no | QA-TEC-015 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| FR-TEC-138 | The **physical save package** must be defined as a region manifest (schema version, region id, map list, per-map document hashes, `savedAt`) plus one JSON document per map, so that a region of N maps is not a single monolithic file and individual maps can be synced independently. | Must | PC-EA | partial | QA-TEC-023 | https://www.youtube.com/watch?v=vBJdlAeLn0g |

---

## 4. Options, variants & configuration matrix

### 4.1 Quality tier matrix (technical meaning of each tier — UX owns the UI wording)

| Parameter | Low | Medium | High | Ultra |
|---|---|---|---|---|
| Render scale | 50 % | 75 % | 100 % | 100 % |
| Target frame rate | 30 fps | 60 fps | 60 fps | 60 fps |
| Frame budget (wall) | 33 ms | 17 ms | 17 ms | 17 ms |
| Tick budget | 4 ms | 4 ms | 4 ms | 4 ms |
| Render budget (frame − tick − 2 ms UI) | 27 ms | 11 ms | 11 ms | 11 ms |
| Draw-call cap | 150 | 300 | 600 | 1 200 |
| Triangles (visible) | 1.5 M | 3 M | 6 M | 12 M |
| Shadow cascades / resolution | 0 / — | 1 / 1024 | 2 / 2048 | 4 / 4096 |
| Chunk LOD0 distance (tiles) | 8 | 16 | 24 | 32 |
| Chunk LOD1 distance (tiles) | 20 | 40 | 60 | 80 |
| Agent LOD1 distance (tiles) | 3 | 6 | 9 | 12 |
| Agent LOD2 distance (tiles) | 6 | 12 | 18 | 24 |
| Simulated agent cap (pedestrian + vehicle caps are **subsets** of it) | 400 | 1 500 | 4 000 | 10 000 |
| Pedestrian cap | 200 | 800 | 2 500 | 6 000 |
| Vehicle cap | 120 | 400 | 1 000 | 2 500 |
| Weather particle budget | 1 000 | 5 000 | 15 000 | 40 000 |
| Memory ceiling (JS heap) | 512 MB | 1 GB | 2 GB | 3 GB |
| GPU resource ceiling | 256 MB | 512 MB | 1 GB | 1.5 GB |
| Audio voices | 16 | 32 | 64 | 128 |
| Initial load target | ≤ 6 s | ≤ 4 s | ≤ 3 s | ≤ 3 s |

> Distances are expressed in **world tiles** (1 tile = 32 × 32 voxels); the voxel→metre scale is **TBD — see §11 Q23** (FR-TEC-123). All values in this table are **design decisions** [TBD in the public record]. The only published figures are the Steam hardware requirements (T13); the original game's frame budgets, agent caps and LOD distances are not public. See §11 Q1–Q5.
>
> **Mobile tier cap (FR-TEC-137) — [TBD — design decision; see §11 Q27]:** on iOS/Android the highest selectable tier *should* be **Medium**; High and Ultra are clamped off, so the mobile-relevant column is the Medium column. No source states a tier cap for the mobile title, so this is a rebuild decision, not a shipped behaviour.

### 4.2 Platform × asset format × delivery matrix

| Platform | Renderer | Input | Storage | Asset delivery | Status |
|---|---|---|---|---|---|
| Windows | WebGL2 (WebGPU opt-in) | Mouse+KB, gamepad | IndexedDB + file export | CDN, hashed, gzip/br | Rebuild target (original: Win 10 64-bit+, DX11, T13) |
| macOS | WebGL2 (WebGPU opt-in) | Mouse+KB, gamepad | IndexedDB + file export | CDN | Rebuild target (original: macOS 12 Monterey+, T13) |
| Linux | WebGL2 | Mouse+KB, gamepad | IndexedDB + file export | CDN | **Not** in the original (`linux: false`, T12); rebuild target |
| Steam Deck | WebGL2 | Gamepad-first + touch | IndexedDB + file export | CDN | [TBD] — original has no Deck listing (Q12) |
| iOS | WebGL2 | Touch (virtual stick, drag-look) | IndexedDB + iCloud | App-bundled / CDN | Mobile title exists (T21); iCloud sync confirmed (T24) |
| Android | WebGL2 | Touch | IndexedDB + cloud | CDN | Mobile title exists, Android 8.0+ (T21) |
| Web | WebGL2 (WebGPU opt-in) | Mouse+KB, touch, gamepad | IndexedDB + file export | CDN | **Primary rebuild target** |

### 4.3 Rendering technique options considered

| Option | Decision | Rationale |
|---|---|---|
| True voxel geometry vs. billboarded sprites | **True voxel geometry** | Everything in the game is voxel-authored and editable in SCC Studio (T3, T7); sprites would break the "change any model" promise |
| Greedy meshing vs. per-cube meshing | **Greedy meshing** | Required to hit the draw-call budget with 32×32-voxel tiles (FR-TEC-025) |
| Per-frame coverage recompute vs. incremental | **Incremental on a budget** | Coverage is a per-category raster field; full recompute would spike tick time (FR-TEC-072) |
| Runtime quantisation vs. palette-only shading | **Runtime quantise post-pass** | Preserves lighting while guaranteeing the 16-bit identity (FR-TEC-034) |
| SSAO vs. baked voxel AO | **Baked per-corner AO** | Cheaper and stylistically correct for a hard-edged voxel look (FR-TEC-033) |
| Single shadow cascade vs. cascades | **Cascade set, tier-scaled** | Large view distances across a region map (FR-TEC-031) |

### 4.4 Persistence mode matrix

| Mode | Trigger | Scope | Conflict rule | Notes |
|---|---|---|---|---|
| Manual save | Player action | Current region | n/a | JSON+gzip; exportable file |
| Autosave | Interval (default 5 min — **design decision, §11 Q30**) + graceful unload | Current region | n/a | Temp-write then atomic replace |
| Offline catch-up | On load, elapsed since `savedAt` | Active map | n/a | Same tick code as online (FR-TEC-066) |
| iCloud sync (mobile) | Background + on change | Per region, per-map granularity | Last-write-wins per map | iPhone ↔ iPad confirmed (T24) |
| Web cloud sync | Post-EA | Per region | Last-write-wins per map | Provider-agnostic adapter (FR-TEC-095) |
| Workshop-modified city | On load | Region | Missing asset → placeholder + warning | Assets stored by hash (FR-TEC-092/093) |

### 4.5 Audio bus matrix

| Bus | Default | Sources | Settings |
|---|---|---|---|
| Master | 100 % | All | Master volume, mute |
| Music | 70 % | Dynamic score | Music volume |
| SFX | 100 % | Construction, demolition, alerts, disasters | Effects volume |
| Ambience | 60 % | Traffic bed, water, wind, rain, weather | Ambience volume |
| UI | 80 % | Click, confirm, cancel, error | UI volume |
| Voice | 100 % | Localised dialogue (24 locales, T12) | Voice volume |

---

## 5. Stage / progression matrix

*This domain has no player-progression dimension; the dimension used is **delivery stage of the technical capability** across the Early Access roadmap. The `Stage` column below uses only the house vocabulary (`Mobile`, `PC-EA`, `Both`, `Design`); the two sub-stages of the PC title are retained as rows because this table describes **delivery order**, which the `Stage` column cannot express. Mapping from the previous vocabulary: `ALL` → `Both` · `DEMO` → `PC-EA` · `EA-SBX` → `PC-EA` · `POST-EA` → `PC-EA` · `MOB-LIVE` → `Mobile`. The only publicly confirmed staging facts are: the demo shipped 7 Oct 2026 with day/night, fires/tornadoes, trains, helicopters and ships; the PC title's Early Access launches as a construction sandbox with economy and progression not yet included; Early Access is Q4 2026.*

| Stage | Entry condition | Technical capability available | Rebuildable / modifiable | Unlocks | Exits when |
|---|---|---|---|---|---|
| `Both` (foundation) | — | Voxel pipeline, chunked renderer, palette quantise, fixed-timestep sim, headless harness, save schema v1, quality tiers, audio bus, palette definition (FR-TEC-131), save `profile` block (FR-TEC-132), agent archetype enum (FR-TEC-133) | All core assets pipeline-built | — | Sim + render + save round-trip green |
| `PC-EA` (shipped in the original demo, 7 Oct 2026) | Demo build | Day/night cycle, fires & tornadoes, road traffic + trains + helicopters + ships, region-view entry by double zoom-out, map switch (reload), Science View overlay | — | — | — |
| `PC-EA` (Q4 2026, Early Access) | EA launch | Sandbox construction loop; SCC Studio voxel editor integration; Workshop asset pipeline (hash-addressed); autosave + export/import; physical save package (FR-TEC-138); 4 quality tiers; weather visuals; Region View multi-map streaming; agent LOD tiers (FR-TEC-058); UI scale + reduced motion (FR-TEC-135/136) | Every building, vehicle, citizen and prop via SCC Studio | Steam Workshop sharing; map creator | EA feature gate closed |
| `PC-EA` (after the EA gate, stage 1) | After the EA gate | First/third-person modes + player avatar (FR-TEC-060); walk mode; cloud sync for web; video capture tools; captions for the voice bus (FR-TEC-134) | Character and props | — | — |
| `PC-EA` (after stage 1) | After stage 1 | Simulation modes (RCI / resource / tycoon — per the dev, the first two may land in EA); coverage fields (FR-TEC-072); agent budget scaling to Ultra; camera comfort; Steam Deck (FR-TEC-114) | — | Rule sets | — |
| `Mobile` | Ongoing | iCloud sync (FR-TEC-094), in-app purchase hooks, ad-boost speed, 300+ structure library, monthly add-on cadence | Add-on content | — | — |

---

## 6. Data model

### 6.1 Asset

| Field | Type | Range | Meaning | Source |
|---|---|---|---|---|
| `assetId` | string (hash) | content hash | Content-addressed identity; used by saves and chunks | T3 |
| `sourceFormat` | enum | `vox`, `procedural` | Authoring origin | T6 |
| `voxelSize` | int[3] | 32 × 32 footprint for a one-tile model; height in voxels (32 in the author's reference park tile) | Model extents in voxels | T4 |
| `paletteIndices` | uint8[] | 0–255, must be within engine palette | Colours used; indices 9–13 = foliage | T5 |
| `materialRanges` | {from,to}[] | e.g. {9,13} | Procedural variation ranges | T5 |
| `footprintTiles` | int[2] | ≥ 1 × 1 | Tiles occupied on the grid | T4 |
| `lod` | {mesh, meshReduced, impostor} | 3 levels | Detail ladder | [INFERRED] |
| `navProxy` | byte[] | solid / walkable | Generated from voxel occupancy | [INFERRED] |
| `collisionProxy` | byte[] | solid | Generated from voxel occupancy | [INFERRED] |
| `author` | enum | `base`, `dlc`, `workshop`, `player` | Provenance | T3, T18 |

### 6.2 Chunk

| Field | Type | Range | Meaning | Source |
|---|---|---|---|---|
| `chunkId` | string | `mapId:cx:cy` | Position identity | [INFERRED] |
| `sizeTiles` | int | 16 (default) | Chunk side in tiles | [INFERRED] |
| `voxelExtent` | int | 512 | Chunk side in voxels | T4 |
| `dirtyFlags` | bitmask | material / collision / nav / mesh | Which derived data needs rebuild | [INFERRED] |
| `meshVersion` | int | monotonic | Bumped on rebuild; used to detect stale GPU buffers | [INFERRED] |
| `visible` | bool | — | Frustum + distance result for the current frame | [INFERRED] |
| `lodLevel` | uint8 | 0–2 | Current detail level | [INFERRED] |
| `materialMask` | bitset | per palette index | Which palette entries appear (drives palette-swap passes) | T5 |

### 6.3 Tile

| Field | Type | Range | Meaning | Source |
|---|---|---|---|---|
| `x,y` | int | map bounds | Grid position | T4 |
| `heightLevel` | uint | map height range | Terrain elevation in voxel steps | T4 |
| `terrainSet` | string id | — | Terrain material set | T3 |
| `landType` | enum | land / beach / water | Used for per-map tile-usage statistics | T15 |
| `zone` | enum | none / res / com / ind | Zoned land | Shared brief §2 |
| `roadId` | string id | — | Road segment occupying the tile | Shared brief §2 |
| `buildingId` | string id | — | Occupant | T3 |
| `occupied` | bool | — | Counts toward tile-usage stats | T15 |

`zone`, `roadId` and `terrainSet` are listed for interface completeness: `CORE` owns `zone`, `MOB` owns `roadId`, `WLD` owns `terrainSet`. `TEC` stores and versions them but defines none of them.

### 6.4 Agent

| Field | Type | Range | Meaning | Source |
|---|---|---|---|---|
| `agentId` | uint32 | — | Stable identity within a session | [INFERRED] |
| `archetype` | enum | car / truck / bus / bicycle / tram / train / monorail / boat / helicopter / pedestrian | Movement + render model; extensible by `MOB` (FR-TEC-133) | T9, T10 |
| `segmentId` | string id | — | Road/water/rail segment the agent occupies | T14 |
| `s` (arc position) | float | 0–segment length | Position along segment | [INFERRED] |
| `speed` | float | m/s | Current speed; drives wheel spin and animation | [INFERRED] |
| `state` | enum | travelling / waiting / parked / stuck / despawned | Drives animation + audio | T14 |
| `stuckTimer` | float | seconds | Feeds the stuck-vehicle rule | T14 |
| `lvl` | uint8 | 0–2 | Render LOD | [INFERRED] |
| `visible` | bool | — | Whether this agent is in the active sim set | FR-TEC-059 |
| `modelAssetId` | string hash | — | Render model (may be player-authored) | T3 |

### 6.5 Tick

| Field | Type | Range | Meaning | Source |
|---|---|---|---|---|
| `tickIndex` | uint64 | monotonic | Deterministic step counter | [INFERRED] |
| `simTimeSec` | float | monotonic | Simulation time (not wall clock) | FR-TEC-096 |
| `clock` | {day, year, hour, minute} | — | In-game date/time | Shared brief §3.2 |
| `weather` | enum | clear / overcast / rain / snow / fog | Weather state | Shared brief §2 |
| `speedMul` | float | 0, 1, 2, 3 | Simulation speed multiplier | T14 |
| `prngState` | uint64 | — | Seeded PRNG state — the sole source of randomness | FR-TEC-064 |
| `agentCount` | uint32 | ≤ tier cap | Live agent count | T14 |
| `coverageDirty` | bitset | per service category | Coverage fields needing recompute | [INFERRED] |
| `checksum` | uint32 | — | Determinism assertion value for the test harness | FR-TEC-128 |

### 6.6 Save schema (v1)

| Field | Type | Meaning | Source |
|---|---|---|---|
| `schemaVersion` | int | Migration-chain entry point | FR-TEC-088 |
| `savedAt` | ISO-8601 UTC | Wall-clock stamp used only for offline catch-up | FR-TEC-066 |
| `simTimeSec` | float | Simulation time — authoritative for continuation | FR-TEC-096 |
| `region` | {id, name, maps[]} | The region and all its maps | T15 |
| `maps[].id` / `.name` | string | Per-map identity; renaming supported | T15 |
| `maps[].tileUsage` | {land, beach, water} × {used, free} | Per-map tile statistics shown in the map card | T15 |
| `maps[].tiles` | packed tile array | Terrain + zone + occupancy | T4 |
| `maps[].buildings` | {buildingId, defId, x, y, rotation, modelAssetId} | Placed structures with their model hash | T3 |
| `maps[].agents` | persisted subset | Long-lived agents only (vehicles/citizens regenerate) | [INFERRED] |
| `inventory` | {defId → count} | Owned buildings; returned on full-map bulldoze | T15 |
| `settings` | {qualityTier, volumes, sensitivity, camera comfort} | Player preferences | T11 |
| `assets` | hash → {url, size, hash} | Referenced external assets (Workshop) | T3 |
| `profile` | {mode, unlocks, constructionSlots, residents, score} | Sibling-owned extension block (`CORE`, FR-CORE-124/125) carried verbatim, not owned by `TEC` | FR-TEC-132 |

### 6.7 Quality tier

| Field | Type | Range | Meaning | Source |
|---|---|---|---|---|
| `tierId` | enum | low / medium / high / ultra | Selected tier | FR-TEC-100 |
| `auto` | bool | — | Whether tier was auto-detected | FR-TEC-101 |
| `renderScale` | float | 0.5–1.0 | Render-target scale | FR-TEC-103 |
| `shadowEnabled` | bool | — | Shadow pass toggle | FR-TEC-032 |
| `lodBias` | float | 0.5–2.0 | Multiplier on all LOD distances | FR-TEC-102 |
| `agentCap` | int | tier default ± 50 % | Hard simulated-agent ceiling | FR-TEC-067 |
| `particleScale` | float | 0–2 | Weather particle multiplier | FR-TEC-102 |
| `paletteQuantise` | bool | — | Switch for the 16-bit pass. **Must default to on**; switching it off is a debug-only override, not a player-facing setting, because FR-TEC-002 is a Must | FR-TEC-002 |

---

## 7. Rules, formulas & tuning

> The original game's numeric internals are **not public**. Everything below is either (a) confirmed behaviour, or (b) an explicit design decision for the rebuild. No value here is presented as an original figure.

### 7.1 Performance budget rules (design decision, derived from T13)

1. **Frame budget** = 16.6 ms (60 fps) or 33.3 ms (30 fps floor). The floor of 30 fps on the *minimum* published hardware is the build rule: the web build must degrade to 30 fps rather than drop below it on GTX 1050-class / M1-class devices (T13).
2. **Tick budget** ≤ 4 ms per tick at 20 Hz (≤ 8 % of a 60 fps frame). Simulation cost is measured per tick, not per frame.
3. **Render budget** = frame budget − tick budget (4 ms) − 2 ms reserved for UI/audio. At 60 fps that is 16.6 − 4 − 2 ≈ 10.6 ms; at the 30 fps floor, 33.3 − 4 − 2 ≈ 27.3 ms. §4.1 lists the rounded per-tier values.
4. **Draw-call rule**: `chunkMaterialPasses + agentInstances + overlayPasses ≤ tierCap`, where `chunkMaterialPasses` counts one draw per (chunk, material) pair — a chunk needing three materials costs three draws, not four. On exceeding the cap the renderer escalates LOD one step; it never drops geometry without a visible seam.
5. **Agent rule**: `simulatedAgents ≤ tierCap`, with the pedestrian and vehicle caps as subsets. **Segment membership is sticky**: a segment enters or leaves the active set only after a 15 % hysteresis window, so membership never flickers between frames (the 15 % window is a **design decision — see §11 Q1**). Individual agents inside an active segment may still be culled by priority when the cap is reached (FR-TEC-067), and the renderer drops every agent that is not simulated (FR-TEC-059).
6. **Memory rule**: JS heap ≤ tier ceiling; GPU resources (atlases, textures, buffers) ≤ the tier's GPU byte ceiling (§4.1); no unbounded growth across a 4-hour session.
7. **Load rule**: shell + core ≤ 3 MB compressed; a map's chunks and assets are fetched per content hash and streamed.
8. **LOD rule**: LOD switches are hysteretic (a 15 % dead-band, **design decision — see §11 Q1**) so agents and chunks do not flicker at a boundary.
9. **Regression rule**: the §4.1 table is a regression gate — a build that exceeds the budget at its tier must fail CI (QA-TEC-015).

### 7.2 Fixed-timestep simulation contract

| # | Rule |
|---|---|
| 1 | The simulation advances only in discrete ticks of a fixed `dt = 1/20 s`. Rendering never advances the simulation. |
| 2 | Each frame the host accumulates **real elapsed time × `speedMul`**, then consumes whole `dt` ticks from the accumulator, capped at **5 ticks per frame**. Remaining time stays in the accumulator. |
| 3 | `speedMul` scales the amount of **simulated time requested per real second**, never the tick length. At 3× the accumulator receives three times the real elapsed time and the same 1/20 s ticks are consumed, so behaviour at 3× is identical to behaviour at 1× over the same simulated duration. The 5-tick-per-frame cap therefore sets the maximum sustainable speed at a given frame rate (at 60 fps it allows up to 12×). |
| 4 | All simulation randomness comes from a seeded PRNG whose state lives in the save. Identical seed + identical input sequence ⇒ identical tick checksums. |
| 5 | No simulation code may read wall-clock time. Simulation time advances only by `dt` per tick; wall clock appears only in `savedAt` and in the offline catch-up computation. |
| 6 | Pausing stops tick execution; it does not freeze a partially-accumulated frame. Accumulator state is cleared on resume. |
| 7 | Offline catch-up is executed as real ticks through the same code path, capped at a maximum catch-up duration (default 24 simulated hours — **design decision, §11 Q30**); if the cap is hit, the remainder is applied by the owning domain's aggregate approximation and the save is flagged as approximate. `TEC` supplies the conversion and the cap (FR-TEC-066); it does not replay traffic for hours. |
| 8 | The renderer interpolates agent positions between the last two ticks using the accumulator's fractional remainder; interpolation is presentational only and never feeds back into the simulation. |
| 9 | A tick must be atomic with respect to the snapshot: the renderer reads a snapshot that is never mutated after publication. |
| 10 | The tick function must be callable in a headless environment with no renderer, DOM or audio present, and must produce the same checksum in headless and browser runs. |

---

## 8. Edge cases, failure modes & required behaviours

| # | Edge case | Required behaviour | Linked FR |
|---|---|---|---|
| E1 | Player switches maps while the simulation is running | Save the active map's state, stream the target map's chunks, resume the same simulation clock — **no page reload** | FR-TEC-091 |
| E2 | Player demolishes an entire map | Buildings return to the inventory and the map is emptied; the save reflects the emptied map and the returned inventory. The confirmation UI and the inventory rule are owned by `BLD`/`UX`; `TEC` persists the outcome | FR-TEC-089, FR-TEC-092 |
| E3 | Save references a Workshop asset that no longer exists | Load succeeds with a placeholder mesh and a visible warning listing the missing hashes | FR-TEC-093 |
| E4 | Save references a Workshop asset that exists but is a different version | Load uses the hash recorded in the save, not the latest version | FR-TEC-092 |
| E5 | Device loses focus / tab hidden mid-tick | Audio suspends, the accumulator is cleared, no burst of catch-up ticks on return | FR-TEC-084, FR-TEC-063 |
| E6 | Frame time spikes to 500 ms (GC, tab restore, breakpoint) | Tick count for that frame is capped at 5; the excess is dropped, and the dropped time is not replayed as a burst | FR-TEC-063 |
| E7 | Two clients edit the same map in a synced region | Last-write-wins at **per-map** granularity; no partial map merge | FR-TEC-094 |
| E8 | CJK (or any non-Latin) locale selected | Every glyph used by UI and tutorial text must render from a loaded font subset; the shipped build has a known defect where CJK dialogue renders blank | NFR-TEC-012, FR-TEC-131, §11 Q8 |
| E9 | Region with many maps opened at once | Only the active map's chunks are resident; region view uses per-map LOD2 proxies | FR-TEC-036, FR-TEC-107 |
| E10 | Weather changes while the camera is far out | The weather post-process and particle budget scale with tier; no particle burst at LOD transitions | FR-TEC-046, FR-TEC-047 |
| E11 | Traffic deadlock (all roads blocked) | The stuck-vehicle rule releases agents progressively; the network must never fully lock | FR-TEC-071 |
| E12 | Player places a player-authored model over a road or a pedestrian path | Nav/collision proxies regenerate and the path is re-planned; agents must not walk through the new model | FR-TEC-022, FR-TEC-070 |
| E13 | Save file is corrupt or truncated | Load fails safely with a readable message and offers the previous autosave; the corrupt file is preserved for diagnostics | FR-TEC-090 |
| E14 | Offline for 10 real hours | Catch-up is capped; the player is told that the catch-up was approximate | FR-TEC-066, FR-TEC-097 |
| E15 | GPU context lost (browser tab crash, driver reset) | The renderer must restore from the chunk store without reloading the simulation state | FR-TEC-076 |
| E16 | Very low frame rate on the minimum hardware | Resolution scale and agent cap reduce automatically; the simulation tick rate never changes | FR-TEC-039, FR-TEC-103 |
| E17 | Audio context blocked by browser autoplay policy | The game runs silently, shows a one-tap "enable sound" affordance, and resumes without a reload | FR-TEC-085 |
| E18 | Asset with out-of-palette colour indices | The validator rejects the asset with a per-index error list before it can reach the renderer | FR-TEC-023 |

---

## 9. Non-functional requirements

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| NFR-TEC-001 | The build must sustain **60 fps at High tier** on hardware equivalent to the published recommended spec (i5-10600 / **GTX** 1660 6 GB / 16 GB), and must never drop below **30 fps at Low tier** on the published **minimum** spec (i5-6600 / GTX 1050 2 GB / 8 GB). The 60 / 30 fps floors are a **design decision — see §11 Q1**; the hardware anchors are published (T13). | Must | PC-EA | partial | QA-TEC-015 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| NFR-TEC-002 | The build must remain **playable at 30 fps on the published minimum spec** (i5-6600 / GTX 1050 2 GB / 8 GB) with the Low tier auto-selected. (**design decision — see §11 Q1**) | Must | PC-EA | partial | QA-TEC-015 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| NFR-TEC-003 | Simulation determinism must hold: two runs with the same seed and input sequence produce identical tick checksums over 10 000 ticks, in both browser and headless runs, **within the deterministic math subset of FR-TEC-130** (the subset removes transcendental and floating-point-order sensitivity). | Must | Both | no | QA-TEC-008 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| NFR-TEC-004 | Memory must stay within the tier ceiling (§4.1) with no unbounded growth across a 4-hour session (no per-tick allocation in the agent hot path; the tick snapshot is double-buffered per FR-TEC-075). | Must | Both | partial | QA-TEC-015 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| NFR-TEC-005 | Draw calls must never exceed the tier cap; the renderer must escalate LOD rather than exceed it. | Must | Both | partial | QA-TEC-015 | [INFERRED] · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| NFR-TEC-006 | **Simulation and rendering must be separable**: the simulation layer must import nothing from the rendering, UI or audio layers (enforced by a CI import-boundary check). | Must | Both | no | QA-TEC-008 | [INFERRED] from https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| NFR-TEC-007 | A city save must round-trip losslessly at the **logical** level: save → load → save produces byte-identical canonical JSON (modulo `savedAt`), with regenerable entities and compression excluded (FR-TEC-076, FR-TEC-124). | Must | Both | partial | QA-TEC-012 | Shared brief §3.4 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| NFR-TEC-008 | Every save-schema change must ship a migration; loading a save from any prior shipped schema version must succeed or fail with an explicit, actionable message — never a silent partial load. | Must | Both | yes | QA-TEC-013 | [INFERRED] · Shared brief §3.4 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| NFR-TEC-009 | The web build must run from a **static host** with no server-side requirement for single-player, and must degrade gracefully when the CDN is unreachable (cached assets still playable). | Must | Both | partial | QA-TEC-020 | [INFERRED] · https://steamcommunity.com/app/3474890/discussions/ · Shared brief §3.11 |
| NFR-TEC-010 | The engine must expose **no runtime dependency on a specific GPU API**: WebGL2 is the baseline and WebGPU is opt-in, selected at boot. | Must | Both | no | QA-TEC-015 | [INFERRED] · https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| NFR-TEC-011 | Initial interactive time on the web build must be **≤ 3 s** at High tier on a broadband connection, measured from navigation to first interactive frame. (**design decision — see §11 Q1**) | Should | Both | partial | QA-TEC-020 | [INFERRED] from https://steamcommunity.com/app/3474890/discussions/ |
| NFR-TEC-012 | All 24 shipped locales must render **every** UI string and tutorial line without missing glyphs (font subsets loaded per locale). The 24-locale claim is published (T12); the per-locale subsetting is a **design decision — see §11 Q8**. | Should | Both | yes | QA-TEC-016 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english, https://steamcommunity.com/app/3474890/discussions/0/563671339629567949/ |
| NFR-TEC-013 | Every action must be reachable **without a keyboard** (the shipped demo's "Mouse Only Option" category) and no action may require a timed reaction ("Playable without Timed Input" category). Keyboard navigation and UI scaling are additional engine-owned requirements (FR-TEC-135). | Should | Both | no | QA-TEC-017 | https://store.steampowered.com/api/appdetails?appids=5295650&l=english |
| NFR-TEC-014 | The asset pipeline must process a one-tile 32 × 32-voxel-footprint model (32 voxels tall) into chunk meshes in **≤ 50 ms** at build time on a mid-range laptop CPU, so a full-map re-bake is interactive. | Should | PC-EA | yes | QA-TEC-018 | [INFERRED] design decision · https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| NFR-TEC-015 | Crash reporting must capture an error with the active map id, tier, tick index and asset hashes, sufficient to reproduce a content-load failure. | Should | Both | yes | QA-TEC-020 | https://supercitycon.net/privacypolicy.html |
| NFR-TEC-016 | The engine must not leak GPU resources across map switches: switching maps 50 times must not grow GPU memory beyond the tier ceiling (buffers disposed on chunk eviction). | Must | Both | no | QA-TEC-015 | [INFERRED] · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |

---

## 10. Acceptance-criteria suites

| ID | Given | When | Then | Covers |
|---|---|---|---|---|
| QA-TEC-001 | A lit city scene with any material | The frame is captured | Every pixel colour is an exact member of the engine palette; foliage variation falls inside indices 9–13; nearest-neighbour sampling produces hard pixel edges with no mipmap blur | FR-TEC-001/002/004/005/011/017/034 |
| QA-TEC-002 | A 1×1-tile building model | It is imported and placed | The model occupies 32 × 32 voxels in plan and 32 voxels in height, aligning exactly with the tile grid | FR-TEC-003/007 |
| QA-TEC-003 | A chunk of mixed terrain and buildings | The chunk is built | Interior faces are culled, the chunk is split into opaque + transparent material passes, and a corner AO value is written per vertex | FR-TEC-016/025/029/030/033 |
| QA-TEC-004 | The camera at maximum zoom-out | Region View is entered | All maps of the region render as LOD2 proxies; the active map is marked; boundary lines fade after ~2–3 s; re-zooming enters the target map without a page reload; the Science View overlay toggles over the live map, highlights emitters in the `SRV`-owned category colour and shows the per-selection explainer | FR-TEC-009/012/013/019/036/038/049/121 |
| QA-TEC-005 | The clock at 00:00, 06:00, 12:00, 18:00 | The frame is captured | Sun/moon direction, sky gradient, shadow direction, ambient term and the colour grade all derive from the same clock function; at night windows emit light | FR-TEC-010/035/041/042/043/044 |
| QA-TEC-006 | Weather set to rain, then snow, then fog; then a fire and a tornado are triggered | The frame is captured | Rain shows particles plus wet-surface darkening; snow shows particles plus upward-face accumulation tint; fog is height-based and denser in low terrain but never erases the zoomed-out city; the fire renders as an emissive voxel flame plus smoke; the tornado renders as a column plus debris; all grades stay inside the palette | FR-TEC-014/045/046/047/048/049/050/051 |
| QA-TEC-007 | Vehicles, pedestrians, a train, a boat, a helicopter and the player avatar | Each is in motion | Wheel rotation matches travelled distance; walk cycle and body bob advance with simulation time; the train articulates on curves; the boat leaves a wake; the helicopter bobs with spinning rotors; the avatar is hidden in first person and visible in third | FR-TEC-052/053/054/055/056/057/060/061 |
| QA-TEC-008 | A fixed seed and a recorded input stream | The harness replays it in headless and in the browser | Tick checksums match across 10 000 ticks within the deterministic math subset; speed 3× yields identical state to 1× over the same simulated time; the tick runs on a Worker; pause halts ticks and clears the accumulator | FR-TEC-039/063/064/065/074/075/119/123/128/130, NFR-TEC-003/006 |
| QA-TEC-009 | A city at 5 000 agents | The agent cap for the tier is exceeded | The cap is enforced per segment (no segment is partially simulated), the spatial index remains consistent, and agents removed from simulation are also removed from rendering | FR-TEC-058/059/062/067/068, NFR-TEC-004 |
| QA-TEC-010 | A road network that is fully blocked | The simulation runs for 60 simulated minutes | Agents exceeding the stuck threshold are removed progressively; the network does not deadlock; routes re-plan after any network edit and never use a deleted edge | FR-TEC-069/070/071 |
| QA-TEC-011 | A service building is placed | Coverage recomputes | The coverage field updates only for the affected tiles, within the per-tick coverage budget, and the resulting field is identical regardless of tick batching | FR-TEC-072/073 |
| QA-TEC-012 | A built city with one map and a region of three maps | The region is saved, closed and reloaded | The save is versioned JSON; all three maps and their tile-usage statistics are present; the reload reproduces the exact state; export produces a downloadable file and import restores it | FR-TEC-066/076/087/089/090/091/097/098, NFR-TEC-007/009 |
| QA-TEC-013 | A save written by schema v1 | The current build (v2+) loads it | The migration chain runs and the load succeeds; a save from a future/unknown version fails with an explicit message and no partial load; the simulation clock continues identically in another timezone | FR-TEC-088/096, NFR-TEC-008 |
| QA-TEC-014 | Two devices editing the same region, and a save referencing a removed Workshop asset | Sync runs and the save is loaded | Sync resolves per map with last-write-wins; the missing asset yields a placeholder and a visible warning naming the hash, and the load still completes | FR-TEC-092/093/094/095 |
| QA-TEC-015 | A representative large city at each tier | The performance harness runs for 60 s | Draw calls, triangles, frame time, tick time, agent count and memory all stay within the §4.1 caps; exceeding the cap escalates LOD instead of dropping geometry | FR-TEC-018/024/026/027/028/031/032/058/100/101/102/103/104/107/122/126, NFR-TEC-001/002/004/005/010/016 |
| QA-TEC-016 | The settings panel | Music, effects, ambience, UI and voice volumes are adjusted | Each bus responds independently; the mix audibly changes; all audio off leaves simulation outcomes unchanged; the audio context resumes after a hidden-tab suspension and after a blocked autoplay unlock | FR-TEC-077/078/079/080/081/082/083/084/085/086, NFR-TEC-012 |
| QA-TEC-017 | The same build on desktop, touch device and Steam Deck | Each plays the build | All actions are reachable via mouse-only, touch and gamepad; first-person sensitivity is per-device; camera comfort options include a zero-shake setting; no action requires a timed reaction | FR-TEC-108/109/110/111/112/113/114/115/127, NFR-TEC-013 |
| QA-TEC-018 | A `.vox` file, including one with out-of-palette indices | It is imported and placed | Valid models produce chunk meshes, collision and nav proxies; invalid indices are rejected with a per-index error list; a runtime-created asset re-meshes only the chunks it touches | FR-TEC-006/015/020/021/022/023/125, NFR-TEC-014 |
| QA-TEC-019 | The game running | Screen and video capture are used | The capture records the simulation view at a stable resolution, does not alter simulation speed, and saves a file | FR-TEC-037/040 |
| QA-TEC-020 | A fresh browser load of the web build | The app boots and a map is opened | The shell becomes interactive within the load target; the initial payload is code-split; a simulated load failure shows a readable error with retry rather than an endless loading screen; the build runs from a static host | FR-TEC-105/106/116/117/118/129, NFR-TEC-009/011/015 |
| QA-TEC-021 | The engine's palette definition and a simulation using a transcendental function | The palette is read and the sim runs 1 000 ticks | The palette's length, bit depth and reserved ranges (including foliage 9–13) are published machine-readably; every rendered colour is a palette member; a transcendental call inside simulation code is rejected by a lint rule | FR-TEC-001/002/004/023/130/131, NFR-TEC-003 |
| QA-TEC-022 | The settings panel on a small high-DPI display | UI scale is raised to 200 %, the reduced-motion preset is enabled, and captions are toggled | UI elements scale without affecting the 3D render target; camera bob, shake and particle motion stop; the caption track renders independently of the voice bus; all three settings persist across a reload | FR-TEC-113/134/135/136, NFR-TEC-012/013 |
| QA-TEC-023 | A region of three maps with a sibling `profile` block | The region is saved, the manifest is inspected, and one map is edited in isolation | The package is one manifest plus three per-map documents; the manifest lists the map ids and their document hashes; the `CORE` profile block survives the round-trip unchanged; a per-map edit syncs without rewriting the other maps | FR-TEC-087/090/132/138, NFR-TEC-007/008 |

---

## 11. Open questions & TBDs

| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| Q1 | What are the original's actual frame-time, draw-call and VRAM budgets? Only hardware specs are published. | The whole performance regime of the rebuild is guessed from hardware rather than measured behaviour. | Use the §4.1 table as the contract; treat it as a design decision, not a replica target. |
| Q2 | How many agents does the original simulate simultaneously, and at what fidelity? The dev states only that "the hard part with this stuff is always scaling". | Sets the ceiling for the whole browser build; a 10⁵-agent browser sim is not feasible at 60 fps. | 4 000 agents at High tier, ECS-lite, 20 Hz tick. |
| Q3 | What is the original's LOD scheme for citizens and vehicles, and at what distances? | Drives agent render cost and the visual density of the city at mid zoom. | Three-tier LOD with distances proportional to the chunk LOD ladder in §4.1. |
| Q4 | Is the original's day/night cycle a fixed-length clock (e.g. N real minutes per in-game day) and what is N? | Time compression is a core mechanic for offline progression and speed-up. | 1 in-game day = 24 real minutes at 1×; configurable per game mode. |
| Q5 | What are the original's exact weather states and transition rules? | "Player controls weather" is confirmed, but the state set is not. | clear / overcast / rain / snow / fog, player-selectable, with a 10-minute minimum dwell time. |
| Q6 | Does the original use palette **swap** (remapping palette indices per material class) for seasonal/weather variants, or re-authored voxel models? | Determines whether weather variants cost memory (models) or nothing (swap). | Index remap in the shader — zero extra asset cost. |
| Q7 | What is the original's water rendering technique (flat animated surface, reflection, depth-based tint)? | Water is the largest transparent surface in a coastal map. | Flat animated normal + depth tint + shoreline foam; no SSR. |
| Q8 | What font pipeline does the original use, and does it subset per locale? The shipped build has a known CJK glyph-fallback defect. | A browser rebuild inherits the risk of 24 locales with missing glyphs. | Pre-subset WOFF2 per locale at build time, bundled with the locale pack. |
| Q9 | What is the original's save format and does it support cloud sync on the PC title, or is iCloud sync mobile-only? | Determines the web sync backend (the mobile stack is Unity + Firebase, the PC title is not). | Per-region JSON in IndexedDB; provider-agnostic adapter with a hosted backend optional. |
| Q10 | Does the original's Workshop content carry custom voxels into the save, or are Workshop items re-resolved by id on load? | Determines save size and offline behaviour for user cities. | Store the content hash + payload reference; resolve missing payloads to a placeholder. |
| Q11 | What is the original's audio content — a dynamic adaptive score, loops, or both — and how does it react to city state? | Drives the size and complexity of the music system. | Layered ambience beds + a chiptune/MIDI track with intensity tiers; no adaptive harmony yet. |
| Q12 | Is Steam Deck a supported platform for the original? The Steam listing shows only Windows and macOS. | Determines whether Deck-specific UI scaling and controller work is in scope. | Support Deck in the rebuild at 1280 × 800 with a controller-first UI; treat original support as unknown. |
| Q13 | Is a PWA/offline web mode in scope, and what is the minimum offline guarantee? | Affects asset caching strategy and the storage adapter contract. | Offline play of the last-opened map after first load; no cloud dependency offline. |
| Q14 | What is the original's technical rendering backend and precision (WebGPU? Vulkan? Metal?)? The Steam requirements list only DirectX 11 for Windows. | Affects whether the rebuild can target WebGPU without visual divergence. | WebGL2 baseline with a WebGPU path that produces an identical palette-quantised image. |
| Q15 | Does the original run a fixed simulation tick, and at what rate? | Determines the determinism contract and the interpolation design. | 20 Hz fixed tick, interpolation in the renderer (already specified in §7.2 as a design decision). |
| Q16 | What is the original's rule for when a vehicle is considered "stuck" and released? | Prevents the traffic model from deadlocking; the dev names the technique but not the threshold. | **Deferred to `MOB`** (OQ-MOB-10, proposed 60 s). `TEC` supplies only the per-segment blocker timer; `MOB` owns the threshold and the despawn destination. |
| Q17 | Is the map-switch reload (T15) a technical constraint (whole-region reload) or a UX choice? | If it is technical, the web rebuild must replicate the cost; if not, streaming is safe. | Treat as UX choice; implement streaming (FR-TEC-091). |
| Q18 | What are the exact per-locale audio tracks and do 24 locales mean 24 voice recordings of all tutorial dialogue? | Determines the audio asset pipeline cost. | Full voice for tutorial/dialogue lines only; SFX shared. |
| Q19 | What speed multipliers does the **PC title** offer (the mobile title shows a 2× ad-boost; the mobile brief only evidences a speed-up purchase)? | Determines the speed-control set and the offline catch-up multiplier on the Steam build. | pause, 1×, 2×, 3×, implemented by consuming more fixed ticks per real second (§7.2 rules 2–3). |
| Q20 | What is the minimum legible cap height, in voxels, for facade signage? | The original's rule is known only as "there simply wasn't enough space on the building to write City Constructions in a way that was still readable"; without a number, FR-TEC-008 is untestable. | 4 voxels minimum cap height; longer strings are truncated or omitted by the authoring tool. |
| Q21 | What animation techniques does the original use for vehicles, pedestrians, trains, boats and helicopters (wheel rotation, walk cycle, bogie articulation, wake, rotor)? | The public sources confirm the actors exist but not how they are animated; every animation FR is currently a design decision. | Distance-derived wheel rotation; procedural distance-derived walk cycle; curve-aligned bogies; hull-following wake; rotor spin plus hover bob. |
| Q22 | Are the **dolphins** in the bay simulated agents or decorative animation? | Confirmed only by the official site's hero-art description; treating them as agents adds simulation cost for no gameplay role. | Decorative water-surface animation, excluded from the agent budget (Priority Could, FR-TEC-057). |
| Q23 | What is the **voxel→metre scale**? | Every LOD distance and physical quantity in §4.1 is expressed in world units; without a scale the tier distances are unenforceable and physics/collision tuning is impossible. | 1 voxel = 0.25 m, so a 32-voxel tile = 8 m; declared once as a single constant (FR-TEC-123) and changeable without touching any other table. |
| Q24 | How is the **player avatar's body presented** in first person — hidden, or a translucent/partial body? | The store copy states first-/third-person modes exist (T26) but not what the body looks like in first person; FR-TEC-060 depends on it. | Hide the body in first person, show it in third; expose a third-person orbit so the character is always inspectable. |
| Q25 | Does the mobile title expose a **per-device first-person sensitivity** setting, and does the rebuild need one per device profile? | The listings establish touch input (T21) but say nothing about sensitivity; FR-TEC-110 currently rests on the shared brief rather than a re-readable source. | One sensitivity slider per input device profile (touch, mouse, gamepad), persisted in settings. |
| Q26 | Should the web first-person look use **Pointer Lock** or a drag-look fallback as the primary? | Pointer Lock is a browser platform API, not a SuperCitycon behaviour; the choice affects the first-person UX and the exit affordance (FR-TEC-115). | Pointer Lock where available, drag-look otherwise, with an always-visible escape hint. |
| Q27 | What is the **camera-comfort / reduced-motion / UI-scale** option set, and what is the **mobile quality-tier cap**? | The Steam categories prove the options exist (T11) but not their contents, and no source states a mobile tier cap (FR-TEC-113, FR-TEC-135, FR-TEC-136, FR-TEC-137). | FOV + shake + head-bob sliders with shake reducible to zero, a one-action reduced-motion preset, UI scale 100–200 %, and mobile capped at Medium. |
| Q28 | What **format, resolution and frame rate** does the built-in video capture write? | The store bullet proves the tools exist (T26) but not their output; QA-TEC-019 cannot assert a format. | PNG frame grab plus a WebM (VP9) capture at the render resolution, no audio, never touching simulation speed. |
| Q29 | Is `.vox` a **runtime** import format or only an offline authoring interchange? | The public sources show models authored in Magica Voxel (T6), not a runtime import path; this decides whether the build ships a Magica Voxel parser (FR-TEC-006, FR-TEC-023). | Offline-only conversion into the runtime asset format; keep a small `.vox` reader behind the content module for the build pipeline, not in the shipped client. |
| Q30 | What are the **autosave interval** and the **offline catch-up cap**? | Both are stated as defaults in §4.4 and §7.2 with no source; autosave cadence trades save latency against data loss, and the catch-up cap bounds load time. | Autosave every 5 minutes plus on every confirmed state change; catch-up capped at 24 simulated hours, remainder flagged approximate. |

---

## 12. Source list

| # | URL | What it gave us | Retrieved |
|---|---|---|---|
| 1 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english | Store metadata: "retro 16-bit palette" + modern 3D world feature list, tags (Voxel/Retro/Isometric), Early Access Q4 2026, Windows/macOS only (`linux: false`), 24 languages with full audio support, full system requirements (T1, T12, T13) | 2026-10-23 |
| 2 | https://store.steampowered.com/api/appdetails?appids=5295650&l=english | Demo app 5295650: released 7 Oct 2026, feature categories Camera Comfort / Custom Volume Controls / Mouse Only Option / Playable without Timed Input / Includes level editor (T11) | 2026-10-23 |
| 3 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 | "The demo is out. Please ask me things." — performance-and-scale-from-day-one, SCC Studio voxel editor, day/night + fires/tornadoes + trains/helicopters/ships, UI rebuild, EA preparation (T2, T3, T10) | 2026-10-23 |
| 4 | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 | "Why Is It Called SuperCitycon?" — voxel-resolution constraint on signage, 16-bit/SNES identity, SimCity SNES "almost psychedelic MIDI soundtrack" (T7, T8) | 2026-10-23 |
| 5 | https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=3474890&count=10&maxlength=0&format=json | Full announcement bodies (both posts) — the only public announcement surface for the PC title (T2, T7, T8, T10) | 2026-10-23 |
| 6 | https://supercitycon.net/ | Official site: hero art description (island city, old town, bridge with traffic, downtown skyline, sailboats and dolphins in the bay), scene captions including "Day becomes night and the windows light up", Early Access Q4 2026 (T9) | 2026-10-23 |
| 7 | https://supercitycon.net/privacypolicy.html | Mobile privacy policy exposing the client/server stack: Unity Analytics + Unity Ads, Firebase (Realtime Database, Firestore, Cloud Functions, Remote Config), Azure, Sentry, Tenjin (T20) | 2026-10-23 |
| 8 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 | iOS 14+, iPhone/iPad/iPod, 300+ structures, Region View, Street View, Mayoral Match-Up, ratings (T21) | 2026-10-23 |
| 9 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder | Android 8.0+, updated 21 Dec 2025, 10K+ downloads, contains ads, in-app purchases, also offered on Windows (Intel) (T21) | 2026-10-23 |
| 10 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ | Dev's simulation-scaling answer: per-person simulation limits, traffic trick of removing stuck cars, unrealistic distances/speeds/time scales (T14) | 2026-10-23 |
| 11 | https://steamcommunity.com/app/3474890/discussions/0/563671339629567949/ | Shipped localisation bug: CJK tutorial dialogue renders blank (font/glyph-fallback defect) (T22) | 2026-10-23 |
| 12 | https://steamcommunity.com/app/3474890/discussions/ | Discussion index — includes the demo "gets to the loading screen & that's it" report (load-path defect) (T23) | 2026-10-23 |
| 13 | https://www.youtube.com/watch?v=NJfQ_5-wlWo | Dev's MagicaVoxel tutorial (transcript): 32 × 32 voxels per tile, palette indices 9–13 for foliage, Face/Box tools, Attach/Erase/Paint, console `Rand 9 13` (T4, T5, T6) | 2026-10-23 |
| 14 | https://www.youtube.com/watch?v=jYAD0SkDmY0 | "The Basics" (transcript): perspective tilt-shift vs orthographic "autographic" camera modes, camera toggle top-left, construction slots, bulldozer categories, minimap → Science View (T16) | 2026-10-23 |
| 15 | https://www.youtube.com/watch?v=vBJdlAeLn0g | "Switching Maps" (transcript): region view by double zoom-out, active map marked blue, lines fading after 2–3 s, per-map tile usage stats, rename, irreversible full-map bulldoze, game reload on map switch (T15) | 2026-10-23 |
| 16 | https://www.youtube.com/watch?v=c3L7Qo8fdIM | "Science View" (transcript): data overlay layers, orange emitters, brown affected areas, per-selection "?" explainer (T19) | 2026-10-23 |
| 17 | https://www.youtube.com/watch?v=6Jd2kyaEZbM | "Super Citycon in 30 seconds" (transcript): voxel-based 3D tycoon, huge maps and regions, walk mode, hundreds of buildings, add-ons, premium sandbox (T17) | 2026-10-23 |
| 18 | https://www.youtube.com/watch?v=bOPESpVGXOU | "Coming to Steam" (transcript): Mac + PC on Steam, separate paid product, map creator with unlimited maps, no microtransactions, Discord + Reddit as the dev's community channels (T18, T25) | 2026-10-23 |
| 19 | https://www.youtube.com/watch?v=ovWkwWS5FlY | Official "Camera Modes" tutorial — existence and topic confirmed; transcript not machine-retrievable (no auto-captions) | 2026-10-23 |
| 20 | https://www.reddit.com/r/supercitycon/ | Dev-run subreddit (community/announcement surface) (T25) — **note: the subreddit HTML is reachable; the `.json` API and `old.reddit.com` return HTTP 403 to automated retrieval, so post bodies were read through Reddit's own embed endpoint** | 2026-10-23 |
| 21 | https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ | Dev Reddit post on the voxel game — post body re-read this session: "Our Voxelgame Super Citycon : Monorail - it's not only for decoration! Building your Monorail allows you to build your city even more unique and gives street connection to your surrounding buildings" | 2026-10-23 |
| 22 | https://discord.gg/btTPqsNYRP | Developer Discord invite, published as the primary support/community channel (T25) | 2026-10-23 |
| 23 | https://store.steampowered.com/app/3474890/SuperCitycon/ | Store page **feature bullets**: "SCC Studio & Steam Workshop: Create, customize and share maps, models and characters with the in-game voxel editor"; "In-game footage captured using SuperCitycon's built-in video tools"; "First- and third-person modes let you step inside and explore the city you created"; "Design your own character"; "Choose the time of day and weather to give your city a different atmosphere" (T26) | 2026-10-23 |
| 24 | https://www.reddit.com/r/supercitycon/comments/1ii2w9y/super_citycon_is_coming_to_steam/ | Dev Reddit post announcing the Steam version — post body re-read this session: "Super Citycon is coming to Steam!" | 2026-10-23 |
| 25 | https://www.reddit.com/r/VoxelGameDev/comments/1g2pbyq/ | Dev announcement post — body re-read this session: "We've just made Super Citycon, our new mobile city-building game, available for open testing on Android!" (the same post is cross-posted to r/CityBuilders `/1g2p8jj/` and r/AndroidGaming `/1g2pap5/`) | 2026-10-23 |

**Retrieval notes / limitations**
- YouTube transcripts were retrieved programmatically during this audit (`youtube-transcript-api` against the official channel). The official `Camera Modes` video (source 19) has **no auto-generated captions at all** — `TranscriptsDisabled` — so no transcript-based claim is made from it, and camera detail is taken from the "The Basics" narration (T16). The Wishlist Radar video `FEELWEOJs2M` is a **third-party** upload and is likewise not cited as evidence of product behaviour.
- Reddit's `.json` API and `old.reddit.com` return HTTP 403 to automated retrieval (bot wall). Post bodies were re-read this session through Reddit's own **embed** endpoint (`embed.reddit.com`), which serves the rendered post text: sources 21, 24 and 25 are quoted verbatim above. The **exact post carrying the developer's automatic-construction-cost statement could not be recovered** in this session — see `STD`'s OQ-STD-01, which keeps that attribution open rather than guessing a permalink.
- The `web_fetch` tool reaches DuckDuckGo but hit a bot challenge partway through the batch; all search-derived claims in this document were subsequently verified against a primary source directly.
- The Steam *gameplay trailer* (Steam movie ids 257456281 / 257414348) was not analysed frame-by-frame; the art-direction facts here come from the official site's own art descriptions and the MagicaVoxel tutorial.
- The four **Steam Workshop platform announcements** cited by `STD` are platform behaviour, not SuperCitycon evidence; this document deliberately does not restate them (see the specificity line in §0).
