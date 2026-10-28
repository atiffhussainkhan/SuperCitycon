# WORLD, TERRAIN, WATER & GRID — SuperCitycon Requirements
> Bot: BOT-02 · Domain code: WLD · Status: COMPLETE
> Sources consulted: 29 distinct URLs (incl. 3 official trailer clips analysed frame-by-frame, Steam store/API, Steam news + forums, official site, App Store/Google Play, mobile help centre, Reddit, YouTube channel) · Requirements: 92 FR / 14 NFR / 30 QA

---

## 0. Scope

**In scope (BOT-02 / WLD):**
- The voxel grid and world space: cell size, voxel resolution, layer/elevation addressing, snapping, rotation on the grid, footprint occupancy.
- Terrain: elevation model, raise / lower / level / smooth / paint tools, modular terrain pieces (surface tiles, cliff blocks, rim blocks), slopes and cliffs, terracing, retaining walls, ramps, landscaping & vegetation.
- Water: sea/water level, water bodies, shorelines, beaches, submerged terrain, rivers/canals, boats' navigability of water, foundation interaction at the waterline.
- Terrain sets: the data model of a terrain set (biome palette of terrain pieces), how a set is authored in SCC Studio and applied to a map.
- Map creation: new map, map size options, new-map generation, region / multi-map layout (structural only).
- Terrain/structure interaction: bridges, tunnels, crossing clearance, structures conforming to terrain.
- Environment state data model: time of day and weather state and their defined effects on terrain and water (rendering itself is `TEC`).

**Out of scope (owner named):**
- Road/traffic/rail/boat-traffic rules → `MOB`.
- Economy, costs, construction timers → `ECO`.
- Services & coverage → `SRV`.
- Building catalogue content & tier ladders → `BLD`.
- HUD, toolbars, camera, controls, onboarding → `UX`.
- Voxel editor mechanics, Workshop publishing, asset auto-cost → `STD`.
- Population, citizens, happiness → `POP`.
- Rendering/shaders, art direction, save-file format, day-night *rendering* implementation → `TEC`.
- Game modes, region/mode rules, progression unlocks → `CORE`.

---

## 1. Observed behaviour (evidence)

### 1.1 Source findings

| # | Finding | Status | Source URL |
|---|---|---|---|
| 1 | PC title ships **"Map Creation & Terraforming: Shape the terrain and water, and create terrain sets of your own"** as a headline feature. | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| 2 | **"Shape the landscape with terraforming tools. Raise hills, carve valleys and shape the water around your city, then connect your neighborhoods with roads, bridges, tunnels and railways."** — three named verbs (raise, carve, shape water) + crossings. | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| 3 | **"Create entire maps"** — map creation is a first-class shipped feature, not a stretch goal. | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| 4 | SCC Studio can customise **terrain sets** as well as buildings/vehicles/citizens/props, "or start from an empty grid and create something new"; "Work at any scale, from the color of a wall to the look of an entire landscape." | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| 5 | Store tagline hierarchy: **"One world. Endless cities. More ways to build."** — a single world holds many cities. | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| 6 | **"Choose the time of day and weather to give your city a different atmosphere"** — the player *controls* day/night and weather. | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| 7 | "boats navigate the waterways"; "trains travel along your railways". | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| 8 | Official site: **"Shape the land, lay the first road and see where your imagination takes you."** and **"From a seaside neighborhood to a downtown skyline."** — coastal landform is the signature scene. | [CONFIRMED] | https://supercitycon.net/ |
| 9 | Official site: **"Day becomes night and the windows light up."** | [CONFIRMED] | https://supercitycon.net/ |
| 10 | EA scope = **construction sandbox**: "Early Access begins with a construction sandbox centered on shaping worlds, building cities, creating assets and exploring the places you make." "there's no economy in the game yet. You can build and explore." | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| 11 | Demo already shows **"fires and tornadoes, a full day and night cycle"** plus trains, helicopters and ships moving through the city. | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| 12 | **Voxel-resolution naming story**: "The game used a **much lower voxel resolution** back then, and there simply wasn't enough space on the building to write *City Constructions* in a way that was still readable." → current voxel resolution is *higher* than the 2017-era build. | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| 13 | The engine is built "for scale from day one"; "it holds up as cities get bigger and busier"; ~**700 models** today, menu must stay usable at 5,000+. | [CONFIRMED] | https://steamcommunity.com/app/3474890/discussions/1/706660083369610227/ |
| 14 | Build-menu taxonomy is theme-based, and **vegetation lives under a "Green & Nature" theme** ("trees are under Green & Nature"); props under "Amenities". | [CONFIRMED] | https://steamcommunity.com/app/3474890/discussions/1/706660083369610227/ |
| 15 | Community boilerplate: **"huge maps, a sandbox mode, a map creator, and strategic tycoon puzzles"** — a map creator exists and tycoon/puzzle modes are planned. | [CONFIRMED] | https://steamcommunity.com/app/3474890/guides/ |
| 16 | Reviews boilerplate: **"Shape vast maps, build living cities in a sandbox, and use SCC Studio to create or customize everything from terrain to buildings, vehicles and citizens."** | [CONFIRMED] | https://steamcommunity.com/app/3474890/reviews/ |
| 17 | SteamDB mirrors the same boilerplate: "huge maps … a map creator … strategic tycoon puzzles". | [CONFIRMED] | https://steamdb.info/app/3474890/ |
| 18 | **Terrain palette is modular voxel pieces**, each labelled `<CODE> <FOOTPRINT>`; observed footprint tags: `1X1`, `2X2`, `3X3`; observed variant tags: `B1`, `B1_D2`, `B1_D02_2X2`. Two visual passes disagreed on the exact alphanumeric codes → codes are [TBD], the *pattern* is confirmed. | [CONFIRMED] pattern / [TBD] codes | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| 19 | Terrain palette contains **flat surface tiles** (grass, sand/beach) and **cliff/rim tiles** (grass-topped cliff, bare rock cliff, sand-topped cliff) — elevation changes are realised as placed cliff blocks, not a smooth heightmap. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| 20 | **Elevation layer selector** in the left toolstrip: `G` (ground, active), `1`, `2`, `3` (tiers above ground), `U1`, `U2` (underground tiers). A `4` tier is implied by the same control strip. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| 21 | Left toolstrip also carries **magnet (snapping toggle)**, **eye (layer/visibility toggle)**, layer-stack, camera-mode, plus object filters (tree, house, vehicle, pedestrian, livestock) and a bulldozer/demolish. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| 22 | Bottom category bar contains a distinct **shovel / terrain icon** category (terraforming) alongside Road, Residential, Apartment, High-rise, Factory, Tree-Bench (Nature), Landmark/Monument, Star (Favourites). | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| 23 | A **white isometric grid overlay** covers all land surfaces *and* the water plane and the submerged seabed; in build mode destination cells highlight (translucent green/white). | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| 24 | Water = **static translucent turquoise volume** with ripple animation; submerged cliff walls and deep seabed are visible through it; shoreline cliffs show dark wet discolouration near the waterline. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| 25 | Terrain lands as a **plateau 4–6 voxel blocks above the water surface**, with striated rock/olive strata on the cliff walls → the observed vertical scale is single-digit voxels, not tens. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| 26 | A **sailing ship** is visible on open water; the water is a navigable domain, not decoration. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| 27 | Two bridge classes visible: a **multi-lane highway bridge on concrete trestle pillars** spanning a sea chasm, and a **2-lane asphalt bridge** across a narrow sea channel. Roads meet elevated ground via **ramps**; **stone retaining walls** hold terraced ground. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| 28 | Road palette lanes: `1 LANE` … `6 LANE`, plus `RAIL` and `MONORAIL` and `DEMOLISH`. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| 29 | Placement widget offers confirm, **rotate (90°)**, duplicate/flip, cancel. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe96c85ec141.mp4 → correct asset URL in §12 (S10) |
| 30 | Weather clip: **clear** and **snow** are demonstrably implemented. Snow accumulates — green grass turns white, paths/plazas/courtyards frost, brown stepped cliffs keep rocky texture with a light dusting. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/59d592f43badcbe9db8e74ec5477e7a3.mp4 |
| 31 | Day/night: dawn/twilight has artificial lights on (windows, street lamps, headlights); full day turns them off and casts soft shadows; night drops to near-darkness with warm window/streetlight pools on pavement. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/59d592f43badcbe9db8e74ec5477e7a3.mp4 |
| 32 | SCC Studio works on a **uniform voxel grid**; measured asset volumes: humanoid ≈ 24–30 voxels tall, car ≈ 30–35 × 16–18 × 14–16 voxels, house = hundreds of voxels. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 |
| 33 | SCC Studio has a **"Terrain Settings"** inspector section on environmental assets (alongside `Studio Settings`, `Identity`), i.e. assets can carry terrain-interaction metadata. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 |
| 34 | SCC Studio inspector: Name, Description, Category dropdown, Tag pills; editor scope toggles `Contiguous` / `Global`; `Voxel` mode dropdown; Sun/Moon lighting toggle; undo/redo counters (16/16 in the clip); palette includes a `Glow - Neon` material set. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 |
| 35 | Store screenshot of SCC Studio (dev build) shows a character asset with **bounding box 46 × 19 × 54 voxels**, dimension input fields `46`/`19`/`54`, a `Voxel ▲` mode indicator, slice tool with `2D` + slider `16` + axes X/Z/Y, 3-axis symmetry, and grid/wireframe visibility toggles. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/3c069ff2ac9007e2602763f6cbb1db65454747ba/ss_3c069ff2ac9007e2602763f6cbb1db65454747ba.1920x1080.jpg |
| 36 | Edited assets snap directly onto the **world tile grid** along streets in-engine. | [CONFIRMED] | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 |
| 37 | Mobile title: **"BOUNDLESS MAPS: Design massive cities with unlimited creativity"**; **"REGION VIEW: Seamlessly integrate multiple maps into one cohesive region"**. | [CONFIRMED] | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| 38 | Mobile title: **"HUGE MAPS: Build on massive maps with total creative freedom — from quiet villages and small towns to sprawling metropolises"**; **"REGION VIEW: Connect multiple city maps into one region. Build interconnected towns, villages, and landscapes."** | [CONFIRMED] | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| 39 | Dev (mobile): **"we are working on new maps. The multi-map update is planned for week 25."** — multi-map/region work is an active, shipped-in-parts roadmap item. | [CONFIRMED] | https://www.reddit.com/r/supercitycon/comments/v18y65/new_territories/ |
| 40 | **[TBD — design decision]** No Super Citycon source names any map area or water location. The mobile title advertises "REGION VIEW: Seamlessly integrate multiple maps into one cohesive region" and "BOUNDLESS MAPS: Design massive cities with unlimited creativity"; the number of maps, their names and whether they carry distinct building sets are unevidenced. | [TBD] | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| 41 | **[TBD — design decision]** The mobile title advertises boundless map size, but no Super Citycon source describes land being *bought*, or land parcels that must be cleared of an obstacle before building. Whether the rebuild gates buildable land behind a purchase or a clearing step is an open design decision. | [TBD] | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| 42 | Mobile title has a **"Clear The Forest"** step: trees must be removed before building, and clearing yields **wood**. | [CONFIRMED] | https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |
| 43 | Mobile title day/night cycle exists today and players request ambient night lighting. | [CONFIRMED] | https://www.reddit.com/r/supercitycon/ |
| 44 | Official "Switching Maps" tutorial: **"I'll show you how to switch maps and use the region view"** — region view is a shipped mobile feature and a documented tutorial topic. | [CONFIRMED] | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| 45 | Official trailer repost: "**Roads, railways, terraforming**, neighborhoods growing block by block". | [CONFIRMED] | https://www.youtube.com/watch?v=FEELWEOJs2M |
| 46 | Official channel ships a **"Building a Tiny Island 🏝️"** short → island creation on water is a demonstrated, promoted scenario. | [CONFIRMED] | https://www.youtube.com/feeds/videos.xml?channel_id=UCb5PQ1wJm1XVukaSPya3qww |
| 47 | Official "The Basics" tutorial: a selected building opens an edit control that offers **rotate** among its options ("this one will give you the options to rotate"); rotation on the grid is a first-class placement axis. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 48 | Steam metadata: `Includes level editor` category; genres Indie/Simulation/Strategy/Early Access; release `coming_soon: true`, date **"Q4 2026"**; developer & publisher **Sunapie Games**. | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |

### 1.2 Screens/flows observed

- **Shovel/Terrain category (0:00–0:01 of S10).** The bottom category bar highlights the shovel icon; a horizontal tray of terrain cards appears. Cards carry a code line and a footprint line, e.g. `1X1`, `2X2`, `3X3`, `B1`, `B1_D2`, `B1_D02_2X2`. Card art shows a **flat grass cube**, a **flat sand cube**, a **sand-topped cliff edge**, a **bare rock/brown cliff wall**, a **grass-topped cliff rim**.
- **Elevation strip.** Left edge of the screen carries a vertical column of layer buttons: `4`, `3`, `2`, `1`, `G`, `U1`, `U2`; `G` is highlighted teal as the active layer. Below it: camera-mode, layer-stack, eye, magnet, and the object filter row (tree, house, car, pedestrian, pig) and a bulldozer.
- **Grid overlay.** A white isometric lattice is drawn continuously over land, over the water plane, and over the submerged seabed — the ocean is *inside* the grid, not an unbounded plane.
- **Water rendering.** Translucent turquoise/cyan volume, animated surface ripple, submerged cliff walls and deep seabed contours visible with a green-teal depth tint, wet dark band at the waterline on cliffs.
- **Placement flow (0:04–0:06).** Selecting a building card raises a translucent green/white highlight over the destination cells; a floating widget with ✔ / rotate / duplicate / 🗑 appears over the candidate.
- **Weather clip (S11).** Sunrise with lit windows → bright day with grass, cherry-blossom trees, dirt paths → snowfall accumulating → night with street-lamp pools on pavement and dark silhouettes elsewhere.
- **Studio clip (S12) + store screenshot (S13).** Left tool column: Pencil/Voxel draw, Box fill, Line, Eraser, Box select, Translate/Gizmo, Eyedropper, Bevel (`B ⇥`), Slice (`2D`, slider 16, axes X/Z/Y), Symmetry X/Y/Z, grid-visibility, wireframe. Top bar: file tab, `Contiguous`/`Global` scope, `Voxel` dropdown, Sun/Moon toggle, undo/redo counters, projection buttons, fullscreen. Right inspector: Metadata (Name, Description, Category, Tags), `Studio Settings`, **`Terrain Settings`**, `Identity`. Bottom: active swatch + palette grid + material sets incl. `Glow - Neon`. Dimension inputs `46`/`19`/`54`; outliner entry `Main` tagged `46x19x54`.
- **No public Steam Guides exist** for app 3474890 (guides listing returns "No items matching your search criteria"), and the Workshop has no published items yet — so no player-authored terrain set can be cited. [CONFIRMED]

---

## 2. System overview

```
                      ┌───────────────────────────────────────────────┐
                      │            MAP / REGION LAYOUT               │
                      │  MapDefinition (size, seed, terrain set)      │
                      │  RegionLayout = N MapSlots + connectors      │  CORE owns rules
                      └───────────────────┬───────────────────────────┘
                                          │ one map
      ┌───────────────────────────────────▼───────────────────────────────────────┐
      │                              WORLD (per map)                              │
      │                                                                            │
      │  ┌──────────────────────────┐        ┌──────────────────────────────────┐  │
      │  │  GRID / VOXEL SPACE      │        │  TERRAIN SET (biome palette)      │  │
      │  │  cell size = 1 voxel     │        │  • surface tiles (grass/sand/…)   │  │
      │  │  layer addresses:        │        │  • cliff / rim blocks (B1, D2)    │  │
      │  │    G, 1, 2, 3, 4         │        │  • slope / retaining blocks      │  │
      │  │    U1, U2                │        │  • footprint: 1X1 2X2 3X3        │  │
      │  │  snapping: on/off (mag) │        │  authored in SCC Studio (STD)    │  │
      │  └────────┬─────────────────┘        └───────────────┬──────────────────┘  │
      │           │ placement                                │ paint/apply          │
      │  ┌────────▼─────────────────┐        ┌───────────────▼──────────────────┐  │
      │  │  TERRAIN LAYERS         │◄──────►│  TERRAIN TOOLS (shovel category) │  │
      │  │  ElevationMap:          │        │  raise · lower · level · smooth   │  │
      │  │   cell → elevation (int)│        │  paint surface type              │  │
      │  │   cell → surface piece  │        │  place cliff / rim / slope piece  │  │
      │  │   cell → surface type   │        │  place beach / water-edge piece  │  │
      │  │   edge → cliff piece    │        │  demolish · undo/redo             │  │
      │  └────────┬─────────────────┘        └──────────────────────────────────┘  │
      │           │                                                            │
      │  ┌────────▼─────────────────┐        ┌──────────────────────────────────┐  │
      │  │  WATER                  │        │  ENVIRONMENT STATE               │  │
      │  │  waterLevel (int)       │◄──────►│  timeOfDay (0..1) · weather enum │  │
      │  │  waterMask (per cell)   │        │  effects on terrain + water      │  │
      │  │  WaterBody[] (regions)  │        │  (snow accumulation, lighting)   │  │
      │  │  navigation graph       │        │                                  │  │
      │  └────────┬─────────────────┘        └──────────────────────────────────┘  │
      │           │                                                                │
      │  ┌────────▼─────────────────┐                                                │
      │  │  STRUCTURE FITTING      │  roads conform to terrain (MOB)               │
      │  │  bridges / tunnels      │  foundations at waterline                    │
      │  │  retaining walls / ramps│  vegetation props (BLD content, WLD placement)│
      │  └──────────────────────────┘                                                │
      └────────────────────────────────────────────────────────────────────────────┘
```

**Core architectural finding.** Terrain is **not** a continuous float heightmap. It is a per-cell **integer elevation** plus a per-cell **surface piece** plus per-edge **cliff/rim pieces**, authored as modular voxel assets in a **terrain set**, and placed on a discrete **layer address space** (`G`, `1`–`4`, `U1`–`U2`). Water is a separate **static translucent volume** with its own level; a cell is submerged iff `elevation < waterLevel` (or the cell is inside a water body). A rebuild that only implements a float heightmap will not reproduce the observed look (striated voxel strata, modular cliff blocks, a visible submerged grid).

---

## 3. Functional requirements

### 3.1 Voxel grid, world space & layer addressing

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-WLD-001 | The world is an **orthogonal 3D grid of cubic voxels**. All terrain, water, structure and prop placements address grid cells, never arbitrary float coordinates. | Must | PC-EA | no | QA-WLD-001 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-002 | The world shall expose one **cell size in world units** used by every system (terrain, water, structures, boats, camera-relative snapping). The value is [TBD]; default **1.0 world unit = 1 voxel cube**. | Must | PC-EA | no | QA-WLD-002 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 |
| FR-WLD-003 | Terrain placement shall use **integer cell coordinates** `(cx, cy, cz)` with `cx,cz ∈ [0, size)` and `cy` a **layer index**. | Must | PC-EA | no | QA-WLD-001 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-004 | The engine shall provide a **layer address space** with named slots: `G` (ground), `1`,`2`,`3`,`4` (tiers above ground) and `U1`,`U2` (underground tiers). These are the only valid elevation targets for terrain tools. | Must | PC-EA | no | QA-WLD-003 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-005 | Layer targets shall be selectable from a persistent vertical toolstrip; the active layer shall be visually highlighted. | Must | PC-EA | no | QA-WLD-003 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-006 | A **magnet / snapping toggle** shall globally enable or disable strict snapping of placements to grid coordinates and to the active layer. When off, free placement is permitted within the cell. | Must | PC-EA | no | QA-WLD-001 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-007 | A **layer visibility toggle (eye)** shall hide/show whole layers so the player can inspect or edit submerged or buried geometry. | Should | PC-EA | no | QA-WLD-003 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-008 | A **grid overlay** shall be renderable across land, across the water plane and across the submerged seabed, and shall be toggleable from the utility bar (map/grid toggle). | Must | PC-EA | no | QA-WLD-001 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-009 | The grid overlay shall be drawn in **world space on the voxel lattice**, not as a screen-space or decal effect, so it stays locked to terrain when the camera moves. | Must | PC-EA | no | QA-WLD-001 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-010 | While a placement tool is armed, the **destination cells** for the candidate placement shall be highlighted in a translucent green/white volume. | Must | PC-EA | no | QA-WLD-019 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-011 | Grid cells shall expose **occupancy** flags per layer: `FREE`, `TERRAIN`, `STRUCTURE`, `BLOCKED`, so placement can reject collisions deterministically. | Must | PC-EA | no | QA-WLD-019 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-012 | Placed objects shall carry a **footprint in cells** (e.g. `1X1`, `2X2`, `3X3`) and shall occupy the rectangular footprint anchored at the snapped cell. | Must | PC-EA | partial | QA-WLD-019 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-013 | Placement shall support **rotation in 90° increments** about the vertical axis; the rotated footprint must re-validate occupancy before commit. | Must | PC-EA | partial | QA-WLD-020 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-014 | Placed objects shall support **duplicate / mirror** as a distinct action from rotate. | Should | PC-EA | partial | QA-WLD-020 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-015 | Terrain and structure placement shall be **undoable and redoable**; the undo stack shall be unbounded or engine-default bounded, and shall survive layer switching. | Must | PC-EA | no | QA-WLD-027 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-016 | The grid shall support **isometric and perspective camera projection** without changing cell semantics; the camera-mode toggle lives in the left toolstrip. | Should | PC-EA | no | QA-WLD-002 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-017 | The engine shall treat the **voxel resolution as a versioned world constant** so that assets authored at an older resolution (e.g. the pre-"Citycon" low-resolution era) can be detected and flagged rather than silently mis-rendering. | Should | PC-EA | partial | QA-WLD-002 | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| FR-WLD-018 | The world shall support **picking** of the cell and layer under the cursor (used by terrain tools to read the target elevation and surface type). | Must | PC-EA | no | QA-WLD-004 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |

### 3.2 Terrain elevation, sculpting tools, slopes & cliffs

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-WLD-019 | The terrain model shall store, per cell: **integer elevation**, **surface piece id**, **surface type id**, and per horizontal edge an optional **cliff piece id**. | Must | PC-EA | partial | QA-WLD-004 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-020 | The terrain toolset shall provide a **raise** operation that lifts the target cell's elevation by one layer step, producing a cliff face on the newly exposed edge(s). | Must | PC-EA | partial | QA-WLD-004 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-021 | The terrain toolset shall provide a **lower** operation that drops the target cell's elevation by one layer step, removing the surface piece and re-exposing the strata below. | Must | PC-EA | partial | QA-WLD-005 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-022 | "**Carve valleys**" — repeated lowering across a region shall produce a connected valley floor with cliff walls on both sides. | Must | PC-EA | partial | QA-WLD-005 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-023 | The terrain toolset shall provide a **level / flatten** operation that sets a selected region to a uniform elevation. | Must | PC-EA | partial | QA-WLD-006 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-024 | The terrain toolset shall provide a **smooth** operation that averages elevation across the brush neighbourhood while preserving the integer layer model (result is still an integer elevation per cell). | Should | PC-EA | partial | QA-WLD-007 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-025 | All terrain operations shall be **brush-shaped** with a selectable size and shape (square/round) and a selectable target (single cell / region). | Must | PC-EA | partial | QA-WLD-004 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-026 | Raising or lowering a cell shall **auto-generate the appropriate cliff/rim piece** on every edge where the elevation now differs from the neighbour. | Must | PC-EA | partial | QA-WLD-010 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-027 | Cliff faces shall be visually **stratified** (stacked distinct voxel bands in rock/olive/dark tones) rather than a single smooth wall. | Must | PC-EA | partial | QA-WLD-010 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-028 | When elevation changes, the affected surface piece shall **re-skin** to the surface type appropriate to the new elevation (e.g. a grass-topped rim becomes a bare rock wall at cliff edges). | Should | PC-EA | partial | QA-WLD-010 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-029 | A cell whose elevation is **more than 1 layer above a neighbour** shall present a cliff of the corresponding height (multi-layer cliffs stack). | Must | PC-EA | partial | QA-WLD-010 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-030 | The engine shall support **terracing**: a run of equal-elevation cells at consecutive layers, with retaining walls between them, is a valid and encouraged landform. | Must | PC-EA | partial | QA-WLD-023 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-031 | The engine shall provide a **retaining wall** piece that can be placed against an elevation discontinuity to retain fill, distinct from a natural cliff piece. | Should | PC-EA | partial | QA-WLD-023 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-032 | The engine shall support **ramps** connecting two adjacent layers so that road/rail networks can climb an elevation step without a free-form slope. | Must | PC-EA | partial | QA-WLD-021 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-033 | Terrain elevation shall be stored **relative to the map's water datum** so that a map can be raised/lowered as a unit without re-authoring every cell. | Should | PC-EA | partial | QA-WLD-012 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-034 | The **demolish/bulldozer** tool shall remove terrain surface and cliff pieces and restore the cell to bare ground at the appropriate layer. | Must | PC-EA | partial | QA-WLD-027 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-035 | Terrain edits shall be **idempotent per cell** — applying the same edit twice yields the same state, so that network replays / undo-redo cannot double-apply a delta. | Must | PC-EA | no | QA-WLD-027 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-036 | Observed vertical scale: a coastal plateau shall be placeable **4–6 voxels above the water surface** using the layer address space (G + up to 4 tiers). | Must | PC-EA | partial | QA-WLD-004 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-037 | A terrain **slope** piece (non-cliff transitional block) shall be available so that 1-layer steps can be ramped rather than always showing a vertical wall. | Should | PC-EA | partial | QA-WLD-010 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-038 | The engine shall support a **terrain generation** pass for new maps that produces a coherent landmass (coastline, hills, a plain) rather than an undifferentiated plane. | Must | PC-EA | partial | QA-WLD-016 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-039 | New-map generation shall be **seeded** so that a given seed + size + terrain set reproduces the same landmass. | Must | PC-EA | no | QA-WLD-016 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-040 | The generator shall guarantee at least one **navigable water body** at map creation (a sea or bay with sufficient open water for boats). | Should | PC-EA | no | QA-WLD-014 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-041 | A **"Building a Tiny Island"** creation path shall be supported: raising a landmass out of open water with beach edges and a bridge or pier back to mainland. | Should | PC-EA | partial | QA-WLD-011 | https://www.youtube.com/feeds/videos.xml?channel_id=UCb5PQ1wJm1XVukaSPya3qww |

### 3.3 Terrain materials, painting & terrain sets

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-WLD-042 | The world shall support a **surface-type registry** (grass, sand/beach, rock, soil, and additional types) each with an id, display name, colour key and a matching terrain-piece asset set. | Must | PC-EA | partial | QA-WLD-008 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-043 | The engine shall provide a **paint terrain type** operation that re-skins the surface piece of targeted cells without changing their elevation. | Must | PC-EA | partial | QA-WLD-008 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-044 | A **terrain set** shall be a named, versioned collection of terrain pieces grouped by surface type, containing at minimum: flat surface tiles, cliff/rim blocks, slope blocks and any water-edge variants. | Must | PC-EA | yes | QA-WLD-028 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-045 | A terrain set shall declare, per piece: **id**, **surface type**, **footprint (w×h×d in voxels)**, **height class** (flat / base-1 / base-2 …), **variant/direction index**, and the **asset id** to render. | Must | PC-EA | yes | QA-WLD-028 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-046 | Terrain piece naming shall follow the observed convention `<CODE>_<FOOTPRINT-or-VARIANT>` with footprint tags in the forms `1X1`, `2X2`, `3X3` and variant tags in the form `B<height>`, `B<height>_D<depth>`, `B<height>_D<depth>_<w>X<h>`. Exact codes are [TBD] (see OQ-WLD-02). | Should | PC-EA | yes | QA-WLD-028 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-047 | A terrain set shall be **selectable per map**, and switching the active terrain set shall re-skin terrain pieces by (surface type, height class, variant) while preserving the elevation model and all structure placements. | Must | PC-EA | yes | QA-WLD-009 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-048 | Switching terrain sets shall **not** orphan cliff pieces: unmatched variants shall fall back to a default variant of the same height class, and to a bare cliff if none exists. | Must | PC-EA | yes | QA-WLD-009 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-049 | A terrain set shall be **authored inside SCC Studio** (the same voxel editor used for buildings) and be exportable/importable as a **workshop-shareable asset**; authoring mechanics are owned by `STD`, the data model and application rules are owned here. | Must | PC-EA | yes | QA-WLD-028 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-050 | SCC Studio shall expose a **`Terrain Settings`** section in the asset inspector, alongside `Studio Settings` and `Identity`, for authoring terrain-interaction metadata (see FR-WLD-051). | Should | PC-EA | yes | QA-WLD-028 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 |
| FR-WLD-051 | Assets that interact with terrain shall be able to declare: **foundation behaviour** (floats / requires level ground / conforms to slope), **footprint in cells**, and **required clearance** beneath them. | Should | PC-EA | yes | QA-WLD-019 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 |
| FR-WLD-052 | Terrain-set pieces shall use the **same voxel grid** as the rest of the game so that a cliff piece's voxel count exactly equals its declared height class. | Must | PC-EA | yes | QA-WLD-010 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 |
| FR-WLD-053 | A **paint** operation shall support the **beach/sand** type so that shorelines can be re-skinned from grass to sand without moving the coastline. | Should | PC-EA | partial | QA-WLD-011 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-054 | A **"Clear / remove vegetation"** operation shall exist that deletes trees/props from a region and yields a harvestable resource (mobile parity: wood). | Should | Mobile | no | QA-WLD-024 | https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |
| FR-WLD-055 | Terrain and surface-type options shall be exposed as a **single horizontal card tray** under the shovel/terrain category in the bottom bar, consistent with the observed tool layout. | Should | PC-EA | no | QA-WLD-008 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-056 | The terrain tool shall provide a **"Green & Nature"** vegetation sub-category for trees and landscaping props, matching the shipped build-menu theme taxonomy. | Should | PC-EA | no | QA-WLD-024 | https://steamcommunity.com/app/3474890/discussions/1/706660083369610227/ |
| FR-WLD-057 | Surface types shall be **data-driven** (registry + assets), so that a new surface type can be added by a terrain set without an engine change. | Must | PC-EA | yes | QA-WLD-028 | https://store.steampowered.com/app/3474890/SuperCitycon/ |

### 3.4 Water, shorelines & waterways

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-WLD-058 | Water shall be modelled as a **static translucent volume** with its own **water level** (integer layer) per map, distinct from terrain elevation. | Must | PC-EA | no | QA-WLD-012 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-059 | The player shall be able to **raise and lower the water level**, flooding or draining the map ("shape the water around your city"). | Must | PC-EA | no | QA-WLD-012 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-060 | A cell shall be **submerged** iff its terrain elevation is strictly below the water level of the covering water body; the submerged terrain (cliff bases, seabed) shall remain visible through the translucent water. | Must | PC-EA | no | QA-WLD-013 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-061 | Water shall render with **depth tinting** (shallower green-teal → deeper blue-green) driven by the distance between seabed elevation and water level. | Must | PC-EA | no | QA-WLD-013 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-062 | Water surface shall carry a **ripple animation** independent of terrain state. | Should | PC-EA | no | QA-WLD-013 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-063 | Shoreline cliffs shall show a **wet / darker band** where they meet the waterline. | Should | PC-EA | partial | QA-WLD-011 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-064 | The engine shall support **beach/shore terrain**: flat sand tiles placed at the water's edge to form a walkable strand between land and water. | Must | PC-EA | partial | QA-WLD-011 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-065 | The engine shall support **water bodies** as distinct regions with their own identity, level and connected component, so that more than one independent body of water can exist on a single map. | Must | PC-EA | no | QA-WLD-014 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-066 | Water bodies shall be computed as **4-connected components** of submerged cells at a given level; a body shall be identified by a stable id persisted in the save. | Must | PC-EA | no | QA-WLD-014 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-067 | When the water level changes, water bodies shall be **recomputed** and bodies merged/split accordingly, preserving ids where a body survives unchanged. | Must | PC-EA | no | QA-WLD-014 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-068 | The engine shall support **rivers and canals** — narrow connected water channels carved into land — that remain navigable when their width is at least one cell. | Should | PC-EA | no | QA-WLD-014 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-069 | Water shall be **navigable**: a boat's path shall be computed only over submerged cells belonging to a single connected body, and shall never cross land at the current water level. | Must | PC-EA | no | QA-WLD-015 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-070 | The engine shall maintain a **water navigation graph** (nodes = navigable cells, edges = 4-neighbours) for `MOB` boat routing. | Must | PC-EA | no | QA-WLD-015 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-071 | **Foundations at the waterline**: a structure placed on a submerged cell shall be rejected unless its declared foundation behaviour allows water placement (pile/jetty); a structure on a shoreline cell shall conform to the terrain edge. | Must | PC-EA | partial | QA-WLD-019 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 |
| FR-WLD-072 | The engine shall support a **bridge** placement class that crosses water, and a **tunnel** class that passes under it, both connecting road and rail networks across a water body (see FR-WLD-076). | Must | PC-EA | partial | QA-WLD-021 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-073 | The grid overlay shall extend **across submerged cells** (visible underwater) so the player can see the navigable footprint of a water body. | Must | PC-EA | no | QA-WLD-001 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-074 | Water level and terrain elevation shall use the **same integer layer scale** so that "raise the land by one" and "lower the water by one" are exactly equivalent operations on the flood line. | Must | PC-EA | no | QA-WLD-012 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-075 | **[TBD — design decision; see OQ-WLD-06]** The system may provide **named water locations** as a distinct place type with their own building set (mobile parity). No Super Citycon source names any such location, so the name set, the building set and whether the place type exists at all are open design decisions. | Could | Mobile | no | QA-WLD-014 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| FR-WLD-076 | Water shall not be authored in SCC Studio (it is an engine volume); only terrain sets are player-authorable. | Must | PC-EA | no | QA-WLD-028 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 |

### 3.5 Map creation, map sizes & region layout

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-WLD-077 | The game shall offer a **new-map creation flow** that produces a playable world from a chosen size, seed and terrain set. | Must | PC-EA | no | QA-WLD-016 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-078 | The new-map flow shall offer **multiple map sizes**, including at least one small ("village/town") and one large ("metropolis/huge map") option. Exact size list and cell counts are [TBD] (OQ-WLD-01). | Must | PC-EA | no | QA-WLD-017 | https://steamcommunity.com/app/3474890/guides/ |
| FR-WLD-079 | Maps shall be described as **huge / vast** relative to typical city builders; the largest option shall support a city of at least several thousand cells across (TBD value — OQ-WLD-01). | Must | PC-EA | no | QA-WLD-017 | https://steamcommunity.com/app/3474890/reviews/ |
| FR-WLD-080 | The map creation flow shall expose the **terrain set** choice as an option at creation time. | Should | PC-EA | no | QA-WLD-009 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-081 | A **region layout** shall hold multiple map slots; the tagline "One world. Endless cities" implies multiple cities coexist in one world. Mode rules are owned by `CORE`; this domain owns only the layout structure. | Should | PC-EA | no | QA-WLD-018 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-082 | The region layout shall support **switching between maps** and a **region view** that shows all maps together. | Should | Mobile | no | QA-WLD-018 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-WLD-083 | Each map in a region shall be an **independent world** with its own grid, terrain set, water state and save record; the region is a container, not a shared terrain. | Must | PC-EA | no | QA-WLD-018 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| FR-WLD-084 | The region layout shall support **inter-map connectors** (land connection, shared economy link) as slots; the connecting rules belong to `CORE`/`ECO`. | Could | PC-EA | no | QA-WLD-018 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| FR-WLD-085 | Mobile parity: a **region** shall hold more than one distinct **map**, and each map shall carry its own terrain set, so that a player can build a different piece of landscape in each slot. | Should | Mobile | no | QA-WLD-018 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| FR-WLD-086 | Mobile parity: **land expansion** — additional buildable land shall be obtainable beyond the starting area. Whether expansion is purchased, granted by progression, or unlimited (the store advertises "BOUNDLESS MAPS: Design massive cities with unlimited creativity") is an open design decision. | Should | Mobile | no | QA-WLD-024 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| FR-WLD-087 | A **map creator** (as opposed to a random generator) shall exist as a distinct authoring mode in which the player starts from an empty grid and builds the terrain themselves. | Must | PC-EA | no | QA-WLD-016 | https://steamcommunity.com/app/3474890/guides/ |
| FR-WLD-088 | Maps shall be **saveable and loadable** with full fidelity of terrain elevation, surface types, cliff pieces, water level and water bodies. | Must | PC-EA | no | QA-WLD-029 | https://store.steampowered.com/app/3474890/SuperCitycon/ |

### 3.6 Terrain/structure interaction: bridges, tunnels, crossings & fit

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-WLD-089 | The engine shall support **bridges** that span a water gap or a terrain depression without filling it. | Must | PC-EA | partial | QA-WLD-021 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-090 | Bridge classes observed: a **multi-lane highway bridge on concrete trestle pillars** (high-level, long span) and a **2-lane asphalt bridge** (low-level, short span). | Must | PC-EA | partial | QA-WLD-021 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-091 | A bridge's **deck** shall be placed at an explicit layer and shall not alter the terrain or water beneath it; **piers** shall occupy cells and be authored as terrain-conforming pieces. | Must | PC-EA | partial | QA-WLD-021 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-092 | The engine shall support **tunnels** — a passage carried below the surface on the `U1`/`U2` layers — so that a route can pass under terrain or under a water body. | Must | PC-EA | partial | QA-WLD-022 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-093 | A tunnel shall require a **clearance volume** of at least one layer; placing it where the terrain above is not sufficiently thick shall be rejected. | Must | PC-EA | no | QA-WLD-022 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-094 | A tunnel may cross beneath a **water body** (submerged tunnel) provided the tunnel's layer is below the water level and above the seabed. | Should | PC-EA | partial | QA-WLD-022 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-095 | Roads and railways (`MOB`) shall **conform to terrain**: a road segment placed across a 1-layer step shall either ramp, bridge or be rejected, per `MOB` rules; this domain supplies the elevation queries and the ramp/bridge cells. | Must | PC-EA | no | QA-WLD-021 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-096 | Buildings shall sit on terrain via a **foundation rule**: either `requires-level` (reject on a step) or `conforms` (auto-place a plinth/foundation piece). `BLD` owns which buildings use which. | Must | PC-EA | partial | QA-WLD-019 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 |
| FR-WLD-097 | A **plinth/foundation piece** shall be auto-inserted under a building that requires level ground and is placed on a step, so no building floats. | Should | PC-EA | partial | QA-WLD-019 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-098 | Vegetation and props shall be placeable **only on cells with a valid surface** and shall be removable by the demolish tool. | Must | PC-EA | no | QA-WLD-024 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-099 | **Landmark/monument** placement shall be permitted at any elevation step and shall generate its own terrain footprint (e.g. a plateau) on placement. | Could | PC-EA | partial | QA-WLD-019 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| FR-WLD-100 | Structures shall be **repositionable on the grid after placement** (move) without leaving orphaned terrain edits; the move operation shall be atomic and undoable. | Should | PC-EA | no | QA-WLD-027 | https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |

### 3.7 Environment state model (day/night, weather) & its terrain/water effects

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-WLD-101 | The world shall carry an **environment state** with two player-controllable dimensions: **time of day** and **weather**. | Must | PC-EA | no | QA-WLD-026 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-102 | **Time of day** shall be a continuous or discretised clock with at least the states dawn, day, dusk, night distinguishable, and the player shall be able to set it. | Must | PC-EA | no | QA-WLD-026 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/59d592f43badcbe9db8e74ec5477e7a3.mp4 |
| FR-WLD-103 | **Weather** shall be a discrete enum. Confirmed members: `CLEAR` and `SNOW`. `FIRE` and `TORNADO` are confirmed as demo events. `RAIN` and `FOG` are [TBD] (OQ-WLD-05). | Must | PC-EA | no | QA-WLD-025 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-WLD-104 | The environment state shall be **per map** and shall persist across saves. | Must | PC-EA | no | QA-WLD-029 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-105 | The environment state shall be **readable by every rendering system** so that terrain, water, structures and agents respond consistently (rendering implementation is `TEC`; the state model and the effect list are owned here). | Must | PC-EA | no | QA-WLD-026 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-106 | **Snow** shall accumulate on terrain: grass surfaces turn white, paths/plazas/courtyards frost over, and cliff faces keep their rocky texture with a light dusting. | Must | PC-EA | no | QA-WLD-025 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/59d592f43badcbe9db8e74ec5477e7a3.mp4 |
| FR-WLD-107 | Snow accumulation shall be a **surface-type-dependent overlay**, not a terrain re-authoring: clearing it must restore the original surface type exactly. | Must | PC-EA | no | QA-WLD-025 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/59d592f43badcbe9db8e74ec5477e7a3.mp4 |
| FR-WLD-108 | **Night** shall define an ambient light state in which artificial lighting (windows, street lamps, headlights) is on and terrain reads as dark silhouette outside lit pools. | Must | PC-EA | no | QA-WLD-026 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/59d592f43badcbe9db8e74ec5477e7a3.mp4 |
| FR-WLD-109 | **Day** shall define an ambient light state in which artificial lighting is off and the scene casts soft directional shadows. | Must | PC-EA | no | QA-WLD-026 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/59d592f43badcbe9db8e74ec5477e7a3.mp4 |
| FR-WLD-110 | The environment state shall expose an **effects list** — the set of named effects (e.g. `snowfall`, `snow-accumulation`, `wet-surface`, `fire`, `tornado`) — so that rendering and simulation can subscribe rather than hard-code weather checks. | Must | PC-EA | no | QA-WLD-025 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-WLD-111 | **FIRE** shall be an environment/terrain effect that occupies terrain cells (burning structures/vegetation). | Should | PC-EA | no | QA-WLD-025 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-WLD-112 | **TORNADO** shall be a moving environment effect that interacts with terrain cells it crosses. | Should | PC-EA | no | QA-WLD-025 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-WLD-113 | Weather shall be **player-selectable**, not purely simulated; the control shall set the state directly and immediately. | Must | PC-EA | no | QA-WLD-025 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-WLD-114 | The environment state shall be exposed to the **SCC Studio** preview (Sun/Moon toggle) so that emissive voxels can be authored against a night preview. | Should | PC-EA | yes | QA-WLD-026 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 |

---

## 4. Options, variants & configuration matrix

### 4.1 Terrain piece classes (terrain-set content)

| Class | Purpose | Footprints observed | Height class | Surface types observed | Rebuildable via terrain set |
|---|---|---|---|---|---|
| Flat surface tile | ground cover of a cell at its elevation | `1X1`, `2X2`, `3X3` | flat | grass, sand/beach | yes |
| Cliff / rim block | vertical face at an elevation discontinuity | `1X1` | `B1` (base-1) | grass-topped rim, bare rock wall, sand-topped cliff | yes |
| Cliff variant | corner/direction variant of a cliff block | `B1_D2`, `B1_D02_2X2` | `B1`, depth `D2` | sand, rock | yes |
| Slope block | transitional 1-layer ramp | [TBD] | base-1 | grass, sand | yes |
| Retaining wall | man-made vertical retainer | [TBD] | [TBD] | stone | yes |
| Foundation / plinth | auto-placed under buildings | [TBD] | [TBD] | stone | partial |
| Beach tile | shoreline sand | `1X1` | flat | sand | yes |
| Water-edge / submerged tile | seabed under translucent water | [TBD] | [TBD] | sand, rock | yes |

Source for all rows: https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 · exact asset codes [TBD] (OQ-WLD-02).

### 4.2 Elevation layer address space

| Address | Meaning | Terrain tools | Structures | Notes |
|---|---|---|---|---|
| `4` | 4th tier above ground | place/raise to | towers, high-rise | [INFERRED] from the same strip |
| `3` | 3rd tier above ground | place/raise to | mid-rise | confirmed in clip |
| `2` | 2nd tier above ground | place/raise to | low-rise over raised ground | confirmed |
| `1` | 1st tier above ground | place/raise to | ground+1 structures | confirmed |
| `G` | Ground level (default, highlighted) | default target | all ground structures | confirmed |
| `U1` | Underground tier 1 | excavate/tunnel | tunnels | confirmed |
| `U2` | Underground tier 2 | excavate/tunnel | deep tunnels | confirmed |

### 4.3 Terrain tool sub-tool matrix

| Tool | Direction | Target | Affects elevation | Affects surface type | Affects water | Confirmed / [TBD] |
|---|---|---|---|---|---|---|
| Raise | up | cell / brush region | +1 layer | sets surface piece | no | Confirmed (verb) / brush params [TBD] |
| Lower | down | cell / brush region | −1 layer | clears surface piece | no | Confirmed (verb) |
| Level / flatten | — | region | sets uniform | keeps type | no | [INFERRED] from "terraforming tools" |
| Smooth | — | region | averages | keeps type | no | [INFERRED] |
| Paint type | — | cell / brush region | no | sets surface type | no | [INFERRED] |
| Place terrain piece | — | cell | sets/overrides | yes | no | Confirmed (modular placement) |
| Demolish | — | cell / region | resets | resets | no | Confirmed |
| Raise/Lower water | up/down | map or water body | no | no | changes level | Confirmed ("shape the water") |
| Place bridge | — | span | no | no | no | Confirmed |
| Place tunnel | — | span | excavates | no | no | Confirmed |
| Place ramp | — | edge between cells | +1 transition | n/a | no | [INFERRED] from clip |

### 4.4 Environment options

| Dimension | Values | Source |
|---|---|---|
| Time of day | dawn / day / dusk / night (continuous clock) | clip S11 + store |
| Weather | CLEAR, SNOW, FIRE, TORNADO confirmed; RAIN, FOG [TBD] | clip S11 + demo announcement |
| Studio preview | Sun / Moon toggle | clip S12 |

### 4.5 Map options

| Option | Values | Status |
|---|---|---|
| Map size | at least one small and one large; exact cell counts [TBD] | [CONFIRMED] concept ("huge maps", "BOUNDLESS MAPS"), values [TBD] (OQ-WLD-01) |
| Terrain set | any installed/authored terrain set | [CONFIRMED] |
| Seed | user-chosen or random; reproducible | [INFERRED] (FR-WLD-039) |
| Generation mode | generated vs "map creator" from empty grid | [CONFIRMED] both exist |
| Region maps | N map slots with connectors | [CONFIRMED] concept, rules owned by `CORE` |

### 4.6 Crossing / structure options (terrain-facing)

| Class | Deck layer | Clearance | Terrain effect |
|---|---|---|---|
| 2-lane bridge | explicit layer above water | ≥1 cell span | none (piers only) |
| Multi-lane highway bridge | high layer | long span, trestle piers | none (piers only) |
| Tunnel | `U1` / `U2` | ≥1 layer below surface | excavates terrain above |
| Submerged tunnel | `U1`/`U2` below water level | ≥1 layer | excavates seabed |
| Ramp | between `G` and `1` | 1 layer transition | adds transitional slope |
| Pier / dock | at water level | over water cells | none |

---

## 5. Stage / progression matrix

**WLD has no economic stage ladder.** Its progression dimension is the **map life-cycle**; the release dimension is used for gating. Both are given.

### 5.1 Release stage

> **House vocabulary.** The `Stage` column below uses only `Mobile`, `PC-EA`, `Both`, `Design`. The finer
> delivery order inside `PC-EA` (demo → Early Access sandbox → Early Access with economy → post-EA modes)
> is a **sequence within one stage token**, not a separate stage. Mapping from the previous vocabulary:
> `MOB-PAR` → `Mobile` · `EA-SBX` → `PC-EA` (row 2) · `EA-ECON` → `PC-EA` (row 3) · `POST-EA` → `PC-EA` (row 4).
> Per `CORE` (which owns gating), the only in-game progression axis the game evidences is the **level band**;
> there is no published city-stage ladder, so no row here gates world content on a stage *name*.

| Stage | Entry condition | Player can build | Player can rebuild/modify | Unlocks | Exits when |
|---|---|---|---|---|---|
| `Mobile` — mobile title (live, May 2022 → v2.4.0, 21 Dec 2025) | install mobile app | buildings, roads, region view across multiple maps, large buildable land | rotate/place objects; clear forest; switch terrain set per map | 300+ buildings, monthly add-ons, Mayoral Match-Up | — (already live) |
| `PC-EA` — row 2: Early Access, Construction Sandbox (Q4 2026, demo shipped 14 Oct 2026) | buy/launch EA build | full world authoring: raise/lower/level/smooth/paint terrain, place terrain pieces, set water, build bridges/tunnels/roads/rails, sculpt bridges, place boats, control day/night and weather | **author terrain sets in SCC Studio**; re-skin maps by switching terrain set; demolish and re-place anything; undo/redo | terrain tools, terrain sets, map creator, bridges/tunnels, weather+day/night, ~700 models | EA release; UI still being rebuilt |
| `PC-EA` — row 3: Early Access with economy & progression (announced as not yet included) | EA + economy systems land | same world authoring + all of the above | same | zones, demand, cost, construction timers (owned by `ECO`/`CORE`) | — |
| `PC-EA` — row 4: additional game modes / rule sets / tycoon puzzles | row 3 live | same + mode-specific world rules | same | region/tycoon puzzle modes, more map types | — |

### 5.2 Map life-cycle stage (WLD's own progression)

| Stage | Entry condition | Terrain state | Water state | Player actions | Exits when |
|---|---|---|---|---|---|
| 1. Generate | new map requested | generated landmass, elevations + surface types + cliff pieces assigned by seed | default sea level, at least one body | pick size/seed/terrain set | generation completes |
| 2. Sculpt | map loaded, terrain tool armed | player-editable elevation/surface | player-editable level | raise, lower, level, smooth, paint, place cliff/rim/slope pieces, build terraces | player proceeds to build |
| 3. Shore | landmass shaped | beaches placed at waterline | level tuned, bodies recomputed | carve rivers/canals, set beaches, place piers | water satisfies the player's plan |
| 4. Connect | landform settled | ramps/retaining walls added to reach buildable plateaus | water crossed by bridges | place bridges, tunnels, ramps, retaining walls | districts are connectable |
| 5. Build | crossings in place | terrain locked by structures | water locked by boat routes | place buildings/props/vegetation | city is populated (`POP`/`BLD`) |
| 6. Live | city running | terrain reacts to weather (snow accumulation) | water animates and is navigated | adjust day/night and weather; watch effects | save |
| 7. Region | region layout active | per-map terrain independent | per-map water independent | switch maps, view region, add maps | — |

---

## 6. Data model

| Entity | Field | Type | Range / units | Meaning | Source |
|---|---|---|---|---|---|
| **Voxel** | `pos` | int3 | x,y,z grid indices | one cell of the cubic lattice | clip S10/S12 |
| | `layer` | enum | `G`,`1`,`2`,`3`,`4`,`U1`,`U2` | elevation address | clip S10 |
| | `solid` | bool | — | cell has volume | [INFERRED] |
| **GridCell** | `cx`,`cz` | int | `[0, size)` | column index in the map | clip S10 |
| | `elevation` | int | layers, signed relative to datum | height of the ground surface | clip S10 |
| | `surfacePieceId` | string | terrain-set piece id | flat surface asset occupying the top | clip S10 |
| | `surfaceTypeId` | enum/string | grass, sand, rock, soil, … | biome/material classification | clip S10 + store |
| | `occupancy` | flags | FREE/TERRAIN/STRUCTURE/BLOCKED | placement legality per layer | [INFERRED] |
| | `edgePiece[N,E,S,W]` | string | terrain-set piece id | cliff/rim decoration on that edge | clip S10 |
| | `submerged` | bool | derived | `elevation < waterLevel` of covering body | clip S10 |
| **ElevationMap** (the heightmap) | `sizeX`,`sizeZ` | int | cells | map extents | store "huge maps" |
| | `cells[]` | GridCell | — | sparse or dense storage; TBD | — |
| | `datum` | int | layers | reference elevation for the map | [INFERRED] |
| **TerrainPiece** (terrain-set element) | `id` | string | unique per set | asset identifier | clip S10 |
| | `code` | string | e.g. `TERRAINxxxxx` | human label prefix; exact format [TBD] | clip S10 |
| | `footprintW`,`footprintD` | int | ≥1 cells | grid footprint (1X1, 2X2, 3X3 observed) | clip S10 |
| | `heightClass` | int | 0 = flat, 1 = base-1, … | cliff height in layers (`B1` observed) | clip S10 |
| | `depthVariant` | int / enum | `D2` observed | corner/depth variant | clip S10 |
| | `surfaceTypeId` | string | — | biome the piece belongs to | clip S10 |
| | `voxelModelId` | string | SCC Studio asset | the rendered voxel asset | clip S12 |
| **TerrainSet** | `id`,`name` | string | — | identity | store |
| | `author` | string | — | creator id | store (Workshop) |
| | `version` | int | ≥1 | schema/content version | [INFERRED] |
| | `surfaceTypes[]` | registry | — | grass, sand, rock, soil, … | store |
| | `pieces[]` | TerrainPiece | — | full palette | store + clip S10 |
| | `defaultPiecePer(surfaceType,heightClass)` | map | — | fallback for missing variants (FR-WLD-048) | [INFERRED] |
| **WaterBody** | `id` | string | stable across saves | identity | [INFERRED] |
| | `level` | int | layers | surface level of this body | clip S10 |
| | `cells[]` | int2 set | submerged cells | footprint | [INFERRED] |
| | `type` | enum | SEA, LAKE, RIVER, CANAL | classification | clip S10 (store trailer) |
| | `navigable` | bool | — | has a valid boat navigation graph | clip S10 |
| **WaterState (per map)** | `level` | int | layers | default/sea level | clip S10 |
| | `bodies[]` | WaterBody | — | recomputed on level change | [INFERRED] |
| | `navigationGraph` | graph | nodes=cells | boat routing data for `MOB` | clip S10 |
| **MapDefinition** | `id`,`name` | string | — | identity | store |
| | `sizeX`,`sizeZ` | int | cells; options [TBD] | map extent | store "huge maps" |
| | `seed` | uint | — | generation seed | [INFERRED] |
| | `terrainSetId` | string | — | active terrain set | store |
| | `elevationMap` | ElevationMap | — | terrain | clip S10 |
| | `waterState` | WaterState | — | water | clip S10 |
| | `environment` | EnvironmentState | — | day/night + weather | store |
| **RegionLayout** | `mapSlots[]` | MapDefinition refs | ≥1 | multiple cities in one world | store "One world. Endless cities" |
| | `connectors[]` | connector | — | inter-map links | Google Play |
| **EnvironmentState** | `timeOfDay` | float 0..1 | — | clock position | store |
| | `weather` | enum | CLEAR, SNOW, FIRE, TORNADO, [RAIN, FOG TBD] | current weather | store + demo announcement |
| | `activeEffects[]` | string set | effect ids | e.g. `snowfall`, `snow-accumulation` | clip S11 |
| **Crossing** (bridge/tunnel) | `type` | enum | BRIDGE_HIGH, BRIDGE_LOW, TUNNEL, PIER | class | clip S10 |
| | `deckLayer` | enum | `G`..`4`,`U1`,`U2` | vertical placement | clip S10 |
| | `spanCells[]` | int2 path | — | horizontal footprint | [INFERRED] |
| | `pierCells[]` | int2 set | — | support footprint | clip S10 |
| | `clearanceLayers` | int | ≥1 | tunnel headroom | [INFERRED] |
| **TerrainInteraction** (asset-declared) | `foundation` | enum | FLOAT, REQUIRES_LEVEL, CONFORMS | how an asset meets terrain | clip S12 (`Terrain Settings`) |
| | `footprintCells` | int2 | — | grid footprint | clip S12 |
| | `minClearance` | int | layers | space required beneath | clip S12 |

---

## 7. Rules, formulas & tuning

| Rule | Formula / definition | Status |
|---|---|---|
| R1 Grid position | `worldPos = (cx + 0.5) * cellSize, (cz + 0.5) * cellSize` in XZ; `y = layerHeight(layer)` | [INFERRED] |
| R2 Cell size | `cellSize = 1.0` world unit (1 voxel cube). Voxel face ≈ 13×13 px in the studio viewport at default zoom (observed) | [CONFIRMED] ratio / value [TBD] (OQ-WLD-03) |
| R3 Submersion | `submerged(c) ⟺ elevation(c) < waterLevel(body(c))` | [CONFIRMED] from observation |
| R4 Flood line equivalence | raising land by one layer ≡ lowering water by one layer | [INFERRED] (FR-WLD-074) |
| R5 Water body connectivity | bodies = connected components of submerged cells under **4-connectivity** at the current level | [INFERRED] |
| R6 Cliff generation | for each 4-neighbour `n`: if `elev(c) - elev(n) = k > 0` then edge gets a cliff asset of height class `k`; if `k > 1` stack `k` blocks | [CONFIRMED] observation |
| R7 Cliff orientation | the cliff asset on edge `e` is chosen by the variant index of `(surfaceType(c), k, edgeDirection)`; fallback = default variant of class `k` | [INFERRED] |
| R8 Vertical scale | coastal plateau observed at **4–6 voxels** above the water surface | [CONFIRMED] |
| R9 Smooth | `elev'(c) = round( mean of elev over brush neighbourhood )`, then re-evaluated as an integer layer | [INFERRED] |
| R10 Level | `elev'(c) = elev(anchorCell)` for all `c` in the region | [INFERRED] |
| R11 Paint | `surfaceType'(c) = paintedType`; `elevation(c)` unchanged | [INFERRED] |
| R12 Snapping | with magnet ON: `cell = round(cursorWorld / cellSize)`; with OFF: free position retained, `cell` derived for occupancy only | [INFERRED] |
| R13 Footprint fit | a placement of footprint `w×d` at `(cx,cz)` requires all `w×d` cells `FREE` at the target layer and `cx+i, cz+j` in bounds | [INFERRED] |
| R14 Rotation | rotation by `k×90°` transposes the footprint: `(w,d) → (d,w)` when `k` is odd | [INFERRED] |
| R15 Tunnel clearance | valid iff `min(elev(above cells)) - tunnelLayer ≥ 1` and `tunnelLayer > seabed` for water crossings | [INFERRED] |
| R16 Bridge piers | pier cells must be submerged or on land and must be `FREE`; the deck must not alter terrain | [INFERRED] |
| R17 Foundation auto-plinth | if `foundation = REQUIRES_LEVEL` and the footprint spans elevations differing by `> 0`, either reject or auto-insert a plinth of height `max(elev) - min(elev)` | [INFERRED] |
| R18 Snow accumulation | `snow(c) = (surfaceType(c) ∈ snowCoverable)`; overlay only; on clear → `snow(c) = 0` and original type restored | [CONFIRMED] observation |
| R19 Night lighting | `artificialLightsOn = timeOfDay ∈ nightRange`; window/headlight emissives follow | [CONFIRMED] observation |
| R20 Grid overlay coverage | overlay drawn on every cell where `occupancy ≠ BLOCKED`, including submerged cells | [CONFIRMED] observation |
| R21 Terrain-set re-skin | `piece'(c) = resolve(set, surfaceType(c), heightClass(c), variant(c))` with fallback chain variant → same-class default → generic cliff | [INFERRED] |
| R22 Boat navigation | path exists iff both endpoints are submerged in the **same** body and the 4-connected submerged path exists | [CONFIRMED] from "boats navigate the waterways" + MOB routing |

---

## 8. Edge cases, failure modes & required behaviours

| # | Edge case | Required behaviour | Ref |
|---|---|---|---|
| E1 | Raise/lower at the **map border** | Clamp or reject; never write out-of-bounds cells; never leave a dangling cliff referencing an absent neighbour cell. | FR-WLD-003, FR-WLD-026 |
| E2 | Lowering a cell that is **already at the lowest layer** | Reject with a clear message; do not create an "infinite" negative elevation. | FR-WLD-021 |
| E3 | Raising a cell above the **highest layer** | Reject or auto-extend the layer address space, consistently for all tools. | FR-WLD-004 |
| E4 | Terrain edit **under an existing building** | Either block the edit or apply it and re-derive the building's foundation; never leave a floating building. | FR-WLD-096, FR-WLD-097 |
| E5 | Terrain edit **under a bridge** | Bridge deck is independent of terrain; piers may become orphaned — the bridge must either be re-validated or flagged. | FR-WLD-091 |
| E6 | **Water level raised** over a city | Flooded cells become submerged; structures on flooded cells must be flagged (foundation invalid) rather than silently drowned. | FR-WLD-060, FR-WLD-071 |
| E7 | **Water level lowered** | Exposed seabed becomes dry land; it must acquire a surface type (sand/soil) and become buildable, not remain an unrendered hole. | FR-WLD-060 |
| E8 | Water level change **splits a sea in two** | Both halves become separate bodies with distinct ids; boats in one half must not path into the other. | FR-WLD-066, FR-WLD-067 |
| E9 | Water level change **drains a small lake** entirely | The body is removed cleanly with no dangling navigation nodes or harbour links. | FR-WLD-067, FR-WLD-070 |
| E10 | **Beach** placed on a cliff cell | Reject: a beach is a flat surface; cliffs must be resolved first. | FR-WLD-064 |
| E11 | **Tunnel** through a cell whose seabed is too shallow | Reject with a reason; the tunnel must not break the seabed. | FR-WLD-093, FR-WLD-094 |
| E12 | **Tunnel** intersecting an existing tunnel | Reject on overlap of clearance volumes. | FR-WLD-093 |
| E13 | **Bridge** span too short / non-contiguous | Require a contiguous 4-connected span between two land anchors. | FR-WLD-089, FR-WLD-090 |
| E14 | Bridge placed **entirely over land** | Allowed only as an elevated structure with piers; never silently degrade into a road. | FR-WLD-091 |
| E15 | Terrain set **switched** and a surface type is missing | Fall back to a default surface type for that cell, and log which cells were affected. | FR-WLD-048 |
| E16 | Terrain set switched while a **structure is mid-placement** | Block the switch until placement is committed or cancelled. | FR-WLD-047 |
| E17 | Terrain set with a **missing cliff variant** | Fall back to same-height-class default, then to generic cliff. | FR-WLD-048 |
| E18 | Painting **snow-covered** terrain | Painting replaces the underlying surface type; the snow overlay must be recomputed for the new type. | FR-WLD-107 |
| E19 | Weather changed while snow is active | Snow overlay clears when weather leaves `SNOW`, restoring original surface types exactly. | FR-WLD-106, FR-WLD-107 |
| E20 | **Undo** of a terrain edit that generated cliff pieces | The undo must remove the auto-generated cliff pieces as well as the surface change. | FR-WLD-015, FR-WLD-026 |
| E21 | **Undo** of a water-level change | Must restore the previous body set and ids. | FR-WLD-015, FR-WLD-067 |
| E22 | Undo stack across **map switches** | Undo history is per map. | FR-WLD-015 |
| E23 | Placed building with **footprint larger than the brush region** | Placement highlight must show the whole footprint, not only the hovered cell. | FR-WLD-010, FR-WLD-012 |
| E24 | **Rotation** of a non-square footprint | Transpose the footprint and re-test occupancy. | FR-WLD-013 |
| E25 | **Bridge** placed where a boat route must pass | Bridge piers occupy cells; the navigation graph must exclude pier cells, and a route that becomes impossible must be re-planned. | FR-WLD-070, FR-WLD-091 |
| E26 | **Tornado** crosses a terrain cell | Terrain in the path is affected per the tornado effect spec; the effect must be data-driven, not hard-coded in the renderer. | FR-WLD-110, FR-WLD-112 |
| E27 | **Fire** on a cell with vegetation | Vegetation is consumed; the cell becomes burnable terrain with a cleared state. | FR-WLD-111 |
| E28 | Map generation produces **no water** | The generator must guarantee at least one navigable body; if it fails, regenerate with the next seed. | FR-WLD-040 |
| E29 | New map at the **largest size** | Must remain playable at the target frame rate; chunked terrain streaming required (see NFR-WLD-002/003). | NFR-WLD-002 |
| E30 | Region with a map **not yet generated** | The slot shows as an empty/unclaimed slot, not as a default map. | FR-WLD-083 |

---

## 9. Non-functional requirements

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| NFR-WLD-001 | The world shall be representable in a **browser-based 3D stack** (Three.js-class) with terrain stored as chunked typed arrays — `Int16Array` elevation, `Uint8Array`/string-table surface piece, `Uint8Array` surface type — so a 512×512 map is ≤ ~1 MB of terrain state. | Must | PC-EA | no | QA-WLD-017, QA-WLD-030 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| NFR-WLD-002 | Terrain editing shall be **chunk-local**: a brush edit shall touch only the affected chunk(s) and rebuild only their meshes; a single-cell edit on the largest map shall complete in < 16 ms so the edit feels immediate. | Must | PC-EA | no | QA-WLD-030 | https://steamcommunity.com/app/3474890/discussions/1/706660083369610227/ |
| NFR-WLD-003 | The renderer shall draw terrain via **greedy/merged face meshing** of the voxel lattice, with the grid overlay and cliff pieces batched, holding 60 fps on the minimum-spec target (GTX 1050-class) at the default zoom on a large map. | Must | PC-EA | no | QA-WLD-030 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| NFR-WLD-004 | Water shall render as a **single translucent surface + depth pre-pass** rather than per-cell geometry, so a large sea costs O(surface) not O(cells). | Must | PC-EA | no | QA-WLD-030 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| NFR-WLD-005 | Water depth tinting shall be computed from a **depth texture** generated from the heightmap, not from per-vertex colours, to keep the tint continuous at shoreline steps. | Should | PC-EA | no | QA-WLD-013 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| NFR-WLD-006 | Terrain state shall **serialise to a compact binary** (chunked, run-length encoded for elevation) so a huge map loads in < 2 s. | Must | PC-EA | no | QA-WLD-029 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| NFR-WLD-007 | The world shall support **deterministic replay** of edit operations (seeded brush, integer layer arithmetic) so an edit stream reproduces identical terrain on any machine. | Must | PC-EA | no | QA-WLD-029, QA-WLD-030 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| NFR-WLD-008 | Terrain-set definitions shall be **version-independent data** (JSON + voxel model references) so a set authored by a player can be loaded by any future build; version skew shall produce a fallback, never a crash. | Must | PC-EA | yes | QA-WLD-028 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| NFR-WLD-009 | The world shall tolerate **corrupt/absent terrain-set assets** by falling back to the default terrain set and reporting which assets were missing. | Should | PC-EA | no | QA-WLD-028, QA-WLD-009 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| NFR-WLD-010 | The terrain tool shall support **keyboard-only operation** (layer select, tool select, brush size, commit, cancel, undo, redo) for all its functions. | Should | PC-EA | no | QA-WLD-004, QA-WLD-027 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| NFR-WLD-011 | The grid overlay shall be **toggleable and resolution-independent**, remaining legible at min and max zoom. | Must | PC-EA | no | QA-WLD-001 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 |
| NFR-WLD-012 | All environment/weather effects shall be **data-driven** from an effect list so new effects can be added without touching rendering code. | Must | PC-EA | yes | QA-WLD-025 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| NFR-WLD-013 | Terrain, water and environment state shall be **decoupled from rendering**: `TEC` consumes the state; the simulation must be able to run headless for tests. | Must | PC-EA | no | QA-WLD-025, QA-WLD-029 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| NFR-WLD-014 | The water navigation graph shall be **incremental** — updating it after a terrain or water edit must touch only the affected connected component, not the whole map. | Must | PC-EA | no | QA-WLD-015, QA-WLD-030 | https://store.steampowered.com/app/3474890/SuperCitycon/ |

---

## 10. Acceptance-criteria suites

| ID | Given | When | Then | Covers |
|---|---|---|---|---|
| QA-WLD-001 | A map with the grid overlay enabled | the player moves the camera and orbits the world | a white lattice stays locked to the voxel lattice on land, over the water plane and over the submerged seabed; it can be toggled off entirely | FR-WLD-001, FR-WLD-008, FR-WLD-009, FR-WLD-073 |
| QA-WLD-002 | Any world object | the player inspects a placed asset and a terrain cell | both are expressed in the same voxel grid; a voxel face occupies a consistent world size; changing camera projection does not change cell semantics | FR-WLD-002, FR-WLD-016, FR-WLD-017 |
| QA-WLD-003 | The terrain tool armed | the player clicks `G`, then `2`, then `U1` | the active layer highlight moves between the ground, the 2nd tier above ground and the first underground tier; subsequent placements land on the selected layer | FR-WLD-004, FR-WLD-005, FR-WLD-007 |
| QA-WLD-004 | A flat grass cell at ground level | the player applies **raise** with a 1-cell brush | the cell's elevation increases by exactly one layer; a cliff/rim piece appears on every edge now facing a lower neighbour | FR-WLD-019, FR-WLD-020, FR-WLD-025, FR-WLD-036 |
| QA-WLD-005 | A raised cell at layer 1 | the player applies **lower** | the cell returns to ground level and its auto-generated cliff pieces are removed | FR-WLD-021, FR-WLD-022, FR-WLD-034 |
| QA-WLD-006 | A 3×3 region of mixed elevation | the player applies **level** anchored on the centre cell | all 9 cells take the centre cell's elevation and the border cliffs regenerate consistently | FR-WLD-023 |
| QA-WLD-007 | A noisy 3×3 region | the player applies **smooth** | elevations become the rounded local mean, remain integers, and the surface types are unchanged | FR-WLD-024 |
| QA-WLD-008 | The shovel/terrain category open | the player paints the **sand** surface type over a grass region | the surface type changes, elevation does not, and the terrain tray shows the surface-type cards with their footprints | FR-WLD-042, FR-WLD-043, FR-WLD-053, FR-WLD-055 |
| QA-WLD-009 | A map built with terrain set A | the player switches to terrain set B | the elevation model and every structure placement are preserved; cliff pieces are re-resolved by (surface type, height class, variant) with fallback where a variant is missing | FR-WLD-044, FR-WLD-047, FR-WLD-048 |
| QA-WLD-010 | A cell raised 2 layers above its neighbour | the renderer draws the scene | the exposed face shows stacked, stratified cliff bands (not one flat wall) matching the height class | FR-WLD-026, FR-WLD-027, FR-WLD-028, FR-WLD-037, FR-WLD-052 |
| QA-WLD-011 | A landmass edge meeting the water | the player places a beach tile at the waterline | a flat sand strand forms between land and water; the cliff's lower band is visibly wet/darker | FR-WLD-063, FR-WLD-064, FR-WLD-073 (FR-WLD-053) |
| QA-WLD-012 | A coastal map with sea level 0 | the player lowers the water level by one layer | the shoreline retreats by exactly one layer band and the newly exposed seabed acquires a buildable surface type | FR-WLD-058, FR-WLD-059, FR-WLD-074 |
| QA-WLD-013 | A sea with a 6-voxel-deep trench | the camera looks at the water | the water is translucent turquoise with animated ripples, the submerged cliff walls and seabed are visible, and the tint deepens from green-teal to blue-green with depth | FR-WLD-060, FR-WLD-061, FR-WLD-062, FR-WLD-073 |
| QA-WLD-014 | Two landmasses separated by a channel | the player carves a canal connecting them | the canal is a single connected water body at the new level, both halves remain one body, and the boat navigation graph spans it | FR-WLD-065, FR-WLD-066, FR-WLD-068, FR-WLD-070 |
| QA-WLD-015 | A navigable sea and a boat with a route | the player lowers the water level until the channel dries | the route is invalidated, the boat stops at the last navigable cell, and no path crosses land | FR-WLD-069, FR-WLD-070, FR-WLD-067 |
| QA-WLD-016 | The new-map flow | the player picks a size, seed and terrain set | a landmass is generated with a coastline, hills and at least one navigable water body; the same seed + options reproduce it exactly | FR-WLD-038, FR-WLD-039, FR-WLD-040, FR-WLD-077, FR-WLD-087 |
| QA-WLD-017 | The new-map flow | the player compares the smallest and largest size options | the size options are presented distinctly, the largest is materially bigger, and the cell dimensions of each option are shown | FR-WLD-078, FR-WLD-079 |
| QA-WLD-018 | A region with two generated maps | the player switches maps and opens the region view | each map keeps its own terrain, water and environment state; the region shows both and supports adding more slots | FR-WLD-081, FR-WLD-082, FR-WLD-083, FR-WLD-085 |
| QA-WLD-019 | A 2×2 building | the player hovers a legal cell | the whole 2×2 footprint highlights, the object occupies exactly those 4 cells, and an illegal footprint is rejected with a reason | FR-WLD-010, FR-WLD-011, FR-WLD-012, FR-WLD-051, FR-WLD-071, FR-WLD-096 |
| QA-WLD-020 | A 2×1 object placed | the player presses rotate | the footprint becomes 1×2, the rotated object re-snaps to the grid and re-validates occupancy before commit | FR-WLD-013, FR-WLD-014 |
| QA-WLD-021 | A sea channel between two districts | the player places a 2-lane bridge, then a multi-lane highway bridge | both span the water without filling it; the highway bridge stands on visible trestle piers; roads reach the elevated ground via ramps | FR-WLD-032, FR-WLD-089, FR-WLD-090, FR-WLD-091, FR-WLD-095 |
| QA-WLD-022 | A hill with a road over its crest | the player places a tunnel on `U1` | the tunnel is excavated below the surface with at least one layer of clearance; placing it where the cover is too thin is rejected; a submerged tunnel is allowed below the water level | FR-WLD-092, FR-WLD-093, FR-WLD-094 |
| QA-WLD-023 | A 2-layer elevation step | the player adds a retaining wall, then terraces the slope | the wall retains the fill and the terraced steps become flat buildable shelves | FR-WLD-030, FR-WLD-031 |
| QA-WLD-024 | A region of trees | the player uses the Green & Nature category and the clear-vegetation operation | trees can be placed on valid surface cells only, removed by the bulldozer, and clearing yields the harvestable resource | FR-WLD-054, FR-WLD-056, FR-WLD-098, FR-WLD-086 |
| QA-WLD-025 | A map with grass, paved plazas and rocky cliffs | the player sets weather to SNOW, then back to CLEAR | under snow, grass turns white, plazas and paths frost, cliffs keep their rocky texture with a light dusting; returning to CLEAR restores the exact original surface types; FIRE and TORNADO are selectable and act on terrain cells | FR-WLD-103, FR-WLD-106, FR-WLD-107, FR-WLD-110, FR-WLD-111, FR-WLD-112, FR-WLD-113 |
| QA-WLD-026 | A city with lit windows and street lamps | the player sets time of day to night, then to midday | at night the ambient drops to near-darkness with warm light pools on pavement and terrain as silhouettes; at midday artificial lights are off and soft shadows are cast | FR-WLD-101, FR-WLD-102, FR-WLD-105, FR-WLD-108, FR-WLD-109, FR-WLD-114 |
| QA-WLD-027 | A sequence of terrain edits | the player undoes and redoes them | each step restores the exact prior terrain **including** auto-generated cliff pieces; the same state results from redo and from replaying the edits | FR-WLD-015, FR-WLD-020, FR-WLD-034, FR-WLD-035 |
| QA-WLD-028 | SCC Studio open on a terrain set | the player inspects a piece's metadata | the piece exposes id, surface type, footprint, height class, variant and voxel model; the set can be exported, re-imported and applied to a map; a set missing a variant falls back cleanly | FR-WLD-044, FR-WLD-045, FR-WLD-046, FR-WLD-049, FR-WLD-050, FR-WLD-057, FR-WLD-076 |
| QA-WLD-029 | A heavily sculpted map with a custom water level | the player saves, quits and reloads | elevation, surface types, cliff pieces, water level, water body ids, terrain set and environment state are restored exactly | FR-WLD-088, FR-WLD-104, FR-WLD-123 (NFR-WLD-006) |
| QA-WLD-030 | The largest map size | the player sculpts a region and the camera pulls to full zoom-out | edits remain interactive, the frame rate holds, and the water surface still renders as a single translucent sheet over the whole map | FR-WLD-038, FR-WLD-040, FR-WLD-069 (NFR-WLD-002/003/004) |

---

## 11. Open questions & TBDs

| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| OQ-WLD-01 | **Exact map size options and their cell dimensions** are never published. Only "huge maps", "BOUNDLESS MAPS", "Shape vast maps" and "massive cities" are stated. | Drives the grid extent, chunking budget, generation cost and region layout capacity; it is the single largest unknown for the rebuild. | Offer 3 sizes: Small 128×128, Medium 256×256, Large 512×512 cells (1 cell = 1 voxel), each with a cell-count readout at creation. |
| OQ-WLD-02 | **Exact terrain asset codes** (e.g. `TERRAIN04010`, `SAND 001`, `TERRAINC4E4B4`) and the exact meaning of the `B<n>`, `D<n>` and `NXN` suffixes. Two independent visual passes over the same clip produced conflicting code readings. | The naming scheme is part of the observable design and should be reproduced by the re-skin resolution logic. | Adopt the observed pattern only: `SURFACE_<type>_<w>X<h>` for flat tiles and `CLIFF_<type>_B<h>[_D<d>]_<w>X<h>` for cliff blocks; treat the observed strings as illustrative, not canonical. |
| OQ-WLD-03 | **Voxel face size in world units** and the grid cell size relative to a human-scale building (e.g. is a 1-storey house 1×1 cell or 4×4?). | Everything in the world — footprints, road widths, bridge spans, boat size — derives from it. | 1 voxel = 0.25 m; a house = 4×4 cells; a road lane = 2 cells; a ship = 6×12 cells. Tunable constants. |
| OQ-WLD-04 | Does the game support a **continuous heightmap** in addition to modular cliff pieces (e.g. a height-slider terrain brush), or is elevation strictly one-layer-at-a-time placement? | The trailer shows only discrete layers; a continuous brush would change the whole terrain model and the cliff-generation rules. | Strictly discrete integer layers (as observed). Add a continuous brush only behind a debug flag. |
| OQ-WLD-05 | The full **weather enum**. `CLEAR` and `SNOW` are confirmed; `FIRE` and `TORNADO` are confirmed as demo events; `RAIN` and `FOG` are unevidenced. | The environment state model and the effect list are part of this domain's deliverable. | `CLEAR, RAIN, SNOW, FOG, FIRE, TORNADO` — six states; treat RAIN/FOG as design decisions, not evidential. |
| OQ-WLD-06 | Is there a **global** water level per map, or **per water body** level? The trailer shows one sea; whether a map may hold several independent bodies of water is unevidenced. | Determines whether lowering the sea drains the bay too. | Global default level per map + optional per-body override (bodies inherit the map level unless overridden). |
| OQ-WLD-07 | Does the **map creator** start from a truly empty grid, or from a generated landmass the player then edits? | Changes generation, water-body guarantees and tutorial flow. | Two explicit modes: "Generate" (seeded landmass) and "Blank Map" (flat land at datum with a configurable initial sea level). |
| OQ-WLD-08 | Is **terrain-set switching** a first-class in-game action, or only a creation-time choice? Only creation-time is evidenced. | Determines whether FR-WLD-047/048 are Must or Should. | Keep it a creation-time choice plus a "re-skin map" action in the map settings, since the effect list already exists in the terrain set. |
| OQ-WLD-09 | Exact **number and identity of surface types** in the default terrain set (grass, sand, rock, soil are inferred from the trailer; dirt paths and pink blossom ground are seen in the weather clip). | The surface-type registry drives painting, snow cover and beach logic. | 6 types: grass, dirt/soil, sand, rock, snow-ground, paved-asphalt. |
| OQ-WLD-10 | Are **rivers/canals** a distinct authored feature or merely narrow water bodies? | Affects whether a river-specific tool and flow simulation exist. | Model as narrow connected water bodies only; no flow simulation in the first build. |
| OQ-WLD-11 | Does **snow accumulation persist** across saves and across weather changes, or is it ephemeral per weather state? | Affects the data model (persisted overlay vs. derived). | Derived, not persisted: recompute from weather + surface type on load. |
| OQ-WLD-12 | What is the **layer count above ground** in the shipping build — `1`–`4` observed, `U1`–`U2` below; are more tiers planned? | Determines the height address space and the maximum bridge/tunnel elevation. | Support 8 layers above ground and 4 below; the UI shows the tiers in use. |
| OQ-WLD-13 | What is the **region map count** limit and how are maps placed relative to each other in the region view? | Region layout capacity and the connector model. | Up to 9 maps per region, laid out on a 3×3 region grid with adjacency determining connector eligibility. |
| OQ-WLD-14 | Do **fire and tornado** modify terrain destructibly, or are they purely visual/particulate? | Determines whether they need write access to the elevation/surface arrays. | Visual + light only in the first build; reserve an effect hook for future destructive variants. |

---

## 12. Source list

| # | URL | What it gave us | Retrieved |
|---|---|---|---|
| S1 | https://store.steampowered.com/app/3474890/SuperCitycon/ | Headline features: Map Creation & Terraforming, "Raise hills, carve valleys and shape the water", terrain sets of your own, bridges/tunnels/railways, "Create entire maps", day/night + weather control, "One world. Endless cities", EA = construction sandbox, tags (Voxel, Isometric, Level Editor). | 2026-10-23 |
| S2 | https://store.steampowered.com/api/appdetails?appids=3474890 | Release `coming_soon` / "Q4 2026", developer & publisher Sunapie Games, categories incl. "Includes level editor", system requirements. | 2026-10-23 |
| S3 | https://supercitycon.net/ | Official positioning: "Shape the land", "From a seaside neighborhood to a downtown skyline", "Day becomes night and the windows light up", EA Q4 2026 Windows & macOS, mobile title is a separate game. | 2026-10-23 |
| S4 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 | Demo announcement (14 Oct 2026): no economy yet, built from the ground up for scale, SCC Studio at its core, "fires and tornadoes, a full day and night cycle", trains/helicopters/ships moving through the city, UI being rebuilt. | 2026-10-23 |
| S5 | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 | "Why Is It Called SuperCitycon?" (8 Sep 2026): the **low voxel resolution** naming story — "the game used a much lower voxel resolution back then"; project called "City" from 2017. | 2026-10-23 |
| S6 | https://steamcommunity.com/app/3474890/discussions/1/706660083369610227/ | Dev thread (15 Oct 2026): ~700 models, menu must scale to 5,000+, theme-based build menu, vegetation under "Green & Nature", props under "Amenities". | 2026-10-23 |
| S7 | https://steamcommunity.com/app/3474890/discussions/0/706660344651884617/ | Player thread "Reminds me of SC3000 / SC4" (20 Oct 2026) — confirms the SC4 lineage the rebuild is emulating. | 2026-10-23 |
| S8 | https://steamcommunity.com/app/3474890/guides/ | Community boilerplate: "huge maps, a sandbox mode, a **map creator**, and strategic tycoon puzzles"; confirms zero published guides. | 2026-10-23 |
| S9 | https://steamcommunity.com/app/3474890/reviews/ | Reviews boilerplate: "Shape vast maps … use SCC Studio to create or customize everything **from terrain** to buildings, vehicles and citizens." | 2026-10-23 |
| S10 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/bad446b715c17fe945f7be96c85ec141.mp4 | Official "steamline_build" clip: terrain palette cards and footprint/variant tags, layer strip (G/1/2/3/4/U1/U2), magnet + eye toggles, shovel category, grid overlay over land/water/seabed, translucent turquoise water with depth tint, 4–6 voxel cliff scale, plateau + retaining walls + ramps, sailing ship, 2-lane bridge and multi-lane trestle highway bridge, placement widget with rotate/duplicate, road lanes 1–6 + RAIL/MONORAIL. | 2026-10-23 |
| S11 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/59d592f43badcbe9db8e74ec5477e7a3.mp4 | Official "inline_daynightweather" clip: dawn/day/dusk/night light states, artificial lights on/off, soft day shadows, snow falling and accumulating on grass/plazas with light dusting on cliffs. | 2026-10-23 |
| S12 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/extras/3c84c0832327349ae4ff084c53975ec0.mp4 | Official "inlinestudio" clip: SCC Studio voxel grid, asset volumes (character ≈24–30 voxels tall, car ≈30–35 long), editor tools, `Contiguous`/`Global` scope, Sun/Moon toggle, undo/redo counters, **`Terrain Settings`** inspector section, palette incl. `Glow - Neon`, in-engine snapping onto the world tile grid. | 2026-10-23 |
| S13 | https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/3c069ff2ac9007e2602763f6cbb1db65454747ba/ss_3c069ff2ac9007e2602763f6cbb1db65454747ba.1920x1080.jpg | Store screenshot of SCC Studio (dev build): character asset **46 × 19 × 54 voxels**, dimension inputs 46/19/54, `Voxel ▲` mode indicator, slice tool `2D` + slider 16 + X/Z/Y, 3-axis symmetry, grid/wireframe toggles. | 2026-10-23 |
| S14 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 | Mobile App Store listing: BOUNDLESS MAPS, REGION VIEW, Street View, monthly add-ons, 300+ buildings, Mayoral Match-Up. | 2026-10-23 |
| S15 | https://itunes.apple.com/lookup?id=1607860732 | iTunes API record for the mobile title (v2.4.0, updated 2025-12-21, rating 4.68) used to retrieve the full listing description. | 2026-10-23 |
| S16 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder | Google Play listing: "HUGE MAPS … from quiet villages … to sprawling metropolises", "REGION VIEW: Connect multiple city maps into one region", sandbox construction with no timers, 300+ buildings. | 2026-10-23 |
| S17 | https://www.reddit.com/r/supercitycon/comments/v18y65/new_territories/ | Dev post: "we are working on new maps. The multi-map update is planned for week 25." — region/multi-map roadmap. | 2026-10-23 |
| S18 | https://www.reddit.com/r/supercitycon/ | Mobile subreddit: day/night cycle exists in the shipped mobile title; players request ambient night lighting. | 2026-10-23 |
| S19 | https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ | "Tip #4 – Clear The Forest": trees are build-blocking obstacles and clearing yields **wood** — vegetation/clearance behaviour. | 2026-10-23 |
| S20 | https://www.youtube.com/@supercitycon | Official channel: 24-video catalogue of "Super Citycon: &lt;Topic&gt; – City Building Game How-To Tutorial" videos (The Basics, Switching Maps, Camera Modes, Monorails, Water Supply System, Science View, Storage Feature, Connected Economies, …). | 2026-10-23 |
| S21 | https://www.youtube.com/watch?v=jYAD0SkDmY0 | "The Basics" tutorial — the canonical how-to series the rebuild's tutorial flow should mirror. | 2026-10-23 |
| S22 | https://www.youtube.com/watch?v=vBJdlAeLn0g | "Switching Maps" tutorial: "how to switch maps and use the region view" — region view as a documented feature. | 2026-10-23 |
| S23 | https://www.youtube.com/watch?v=FEELWEOJs2M | Official trailer repost: "Roads, railways, **terraforming**, neighborhoods growing block by block". | 2026-10-23 |
| S24 | https://www.youtube.com/feeds/videos.xml?channel_id=UCb5PQ1wJm1XVukaSPya3qww | Channel RSS: video ids/titles including **"Building a Tiny Island 🏝️"** — island creation on water as a promoted scenario. | 2026-10-23 |
| S25 | https://steamdb.info/app/3474890/ | Mirrors the Steam boilerplate ("huge maps … map creator … strategic tycoon puzzles") — corroboration of the map-creator feature. | 2026-10-23 |

**Research limitations (honest statement):**
- **YouTube transcripts could not be retrieved from this network.** Every caption endpoint was tested (`/api/timedtext` signed and unsigned, innertube `get_transcript`, Invidious `/api/v1/captions`, `youtubetranscript.com`, Glasp, ytks, Filmot) and all returned empty or a bot-challenge, because YouTube blocks subtitle fetching from this egress IP. Video **descriptions** and the official channel catalogue were read instead, and the three official Steam trailer clips were analysed frame-by-frame via a video-understanding model. The trailer clips are the primary evidence for every terrain/water/weather UI claim.
- **The store page exposes only one rotating hero screenshot**; the full screenshot gallery was not reachable, so no in-game terrain art beyond the clips could be cited.
- **SteamDB returned HTTP 403** and the **Steam reviews page description is JS-rendered**, so those two strings are cited from the indexed search snippet rather than a direct fetch.
- **No public Steam Guide or Workshop item exists** for app 3474890, so no player-authored terrain set could be used as a data reference.
- Exact terrain asset codes, map size numbers, voxel face size and the full weather enum are therefore **TBD** and carry proposed defaults in §11.
