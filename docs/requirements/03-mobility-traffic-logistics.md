# MOBILITY, TRAFFIC & LOGISTICS — SuperCitycon Requirements
> Bot: BOT-03 · Domain code: MOB · Status: REBUILT — re-grounded on verified SuperCitycon sources only
> Sources consulted: 18 · Requirements: 104 FR / 12 NFR / 116 QA
>
> **Rebuild notice.** The previous revision of this document was built on two *Cities: Skylines* videos
> (`ZVslYTb-a2M`, `0SzCY7BFC8A`). Every row whose only support was one of those has been deleted or
> rebuilt. The artefacts they produced — an **Anarchy** toggle, **metre-scale** bridge deck heights,
> **purchasable map tiles**, bus depots of 10/50 vehicles, **tram capacity 380**, **ticket prices**,
> a **1–7 lane** road catalogue, a **traffic-routes overlay**, lane-arrow overlays, traffic-light
> removal, crosswalk editing, turn bans, roundabouts and outside connections — **do not exist in
> SuperCitycon** and are gone from this document unless re-introduced below as an explicitly marked
> `[TBD — design decision]`. Where a behaviour is plainly needed by a mobility system but is evidenced
> nowhere in SuperCitycon, it is kept as a `Could` / `Design` decision and listed in Section 11.
> Road and terrain interaction now uses the **voxel-layer model** of `WLD` (integer layers, no metres).
>
> **Traffic provenance — read this before building anything.** The only traffic behaviour any
> SuperCitycon source actually states is: traffic **moves along the streets** (S27); cars can be
> **entered and driven** in first person (S23); traffic **speed follows the simulation speed-up**
> (S24, S25); **trains, ships and helicopters** are distinct vehicle classes moving through the city
> (S31); and the developer says the traffic model is **"still pretty open"** (S32).
> Everything else in the traffic layer — **lane counts, per-lane capacity, speed limits, junction node
> graphs, movement sets, pathfinding and rerouting, outside connections, dead-end turnarounds,
> 24-hour demand curves, the whole lane-assignment layer and any congestion policy** — is **not
> described in any SuperCitycon source**. Those rules are carried in this document as `Could` /
> `Design` **rebuild design decisions**, each pointing at a Section 11 open question, and they **must
> not** be read as a description of the shipped games. The Steam feature blurb ("watch traffic move
> through your streets", "Flexible Roads & Railways") is cited **only** for the existence of roads,
> railways and visible traffic — never as the source of a graph schema.

---

## 0. Scope

- **In scope:** the **Street Building tool** and street authoring (type picker, per-tap direction
  indicator, placement feedback, continuous runs); the **road-type catalogue** and its tiers; the
  **road network graph** (nodes, segments, junctions, connectivity, dead ends, outside connections) —
  in scope as a **Design-stage decision** (OQ-MOB-08, OQ-MOB-09, OQ-MOB-11), not as shipped
  behaviour; **road-to-building connection** and the tier rule that governs it; **railways**,
  **trains** and the **monorail** (stations, residential street connection, influence areas);
  **waterways, boats and the Harbor** as the region's trade/logistics building; **air traffic**
  (helicopters); **pedestrians**, sidewalks and **walk mode**; **vehicle traffic** (spawning, routing,
  lane assignment, congestion) — in scope as a **Design-stage decision** (OQ-MOB-13, OQ-MOB-16,
  OQ-MOB-17); **public-transport assets** (the bus station and its capacity-gated school connection)
  and transit lines; **bridges, tunnels and grade separation** as transport behaviour on the `WLD`
  layer model; **editing, demolition and rebuildability** of transport assets.
- **Out of scope (owned elsewhere, referenced but not specified here):**
  - `WLD` (BOT-02) — the voxel grid, the layer address space (`G`/`1`–`4`/`U1`/`U2`), elevation maps,
    water bodies and the **water navigation graph**, bridge/pier/tunnel *cells* and clearance volumes.
    `MOB` owns the transport *rules* that run on top of those structures.
  - `ECO` (BOT-04) — money, construction costs, the demand/usage bars, and the **pool-membership
    rules** for Harbor / C-wire / water pipeline (`FR-ECO-101`–`FR-ECO-105`, `FR-ECO-109`,
    `FR-ECO-112`). **This document does not restate those rules**; it states the transport behaviour
    that triggers them and cross-references `ECO`.
  - `SRV` (BOT-06) — coverage radii and capacity maths for schools and other services. `MOB` owns the
    bus station *as a transport asset* and its **activation** signal; `SRV` owns the capacity number
    that flips that signal.
  - `POP` (BOT-05) — citizens, happiness, growth bonuses, City/Mayor Score.
  - `BLD` (BOT-07) — the building catalogue and the building property schema.
  - `UX` (BOT-09) — HUD chrome, Science View chrome, camera UI, settings screens.
  - `STD` (BOT-08) — SCC Studio, the voxel editor, Workshop publishing.
  - `TEC` (BOT-10) — rendering, day/night, weather, audio, save/load, simulation architecture.
  - `CORE` (BOT-01) — the stage model and the unlock ladder.
- **Ownership split, stated explicitly (Harbor / C-wire / water pipeline).** These three are specified
  in three domains and were duplicated. The split is now fixed:
  - **`MOB` owns the buildings and the transport behaviour** — what the Harbor *is* (a placeable
    building in the infrastructure section of the shop), where it may sit, what ships do, what a
    monorail connects, and the fact that a map holding a Harbor is the map that carries the region's
    trade.
  - **`ECO` owns the pool and membership rules** — which maps share food, waste, energy and water
    once a Harbor / C-wire / pipeline exists, the globe icon, and the global versus local accounting.
    `MOB` never restates those rules; it cross-references them.
- **Stage vocabulary** (values permitted in the `Stage` column):
  | Value | Meaning |
  |---|---|
  | `Mobile` | Evidenced as shipped in the mobile title *Super Citycon™: Build a City* (App Store `1607860732` / Google Play `com.benwilles.citybuilder`). |
  | `PC-EA` | Scoped to the PC title *SuperCitycon* (Steam `3474890`) Early Access construction sandbox. |
  | `Both` | The feature family is named in the **PC build's own advertised feature set** (roads, railways, traffic, pedestrians, trains, boats, bridges, tunnels, a construction sandbox) and the behaviour is evidenced in the mobile title, which is the reference implementation. Where the PC build's parity is *not* confirmed — monorail, Harbor, bus station — the row is `Mobile` and a `PC-EA` parity design-decision row carries the gap (FR-MOB-052, FR-MOB-063). **`Both` may only be used where the behaviour itself is evidenced**; naming a feature family in the store blurb is not evidence of a rule, and a rule the sources do not describe is `Design`, never `Both`. |
  | `Design` | Not evidenced in either product. A marked design decision pending the Open Question in Section 11. |
- **Rebuildable vocabulary** (`Rebuildable?` column): `yes` = the player can demolish and re-place /
  replace the asset in-game; `partial` = the player can change some of it but not re-author it;
  `no` = it is a system rule or a content definition that the player does not rebuild.
- **Evidence vocabulary:** `[CONFIRMED]` = stated in the cited source; `[INFERRED]` = strongly implied
  by cited sources; `[TBD — design decision]` = not publicly documented, needs a decision (linked to a
  Section 11 question).
- **`[design decision — OQ-MOB-NN]` marker:** the row is **not evidenced in either product**. It is a
  rebuild proposal whose resolution is tracked by the named Section 11 question. Such a row is
  `Design` in the Stage column; its Priority is `Could` for a *behaviour* rule and may stay `Must` /
  `Should` for a rebuild *architecture or quality* requirement that the team still wants to build. Its
  Source cell points at that question instead of at a URL, and it must not be implemented, quoted or
  scheduled as if it were the shipped game's behaviour until the question is decided.

---

## 1. Observed behaviour (evidence)

### 1.1 Source findings

Every row below was re-verified against the source ledger in `tools/source_ledger.json`. No row in
this document cites a `FOREIGN` or `JUNK` source.

| # | Finding | Status | Source URL |
| S1 | Street Building: "you select one this or that one, you tap on the map and you will get a **visual indicator of every build that every direction that's possible** and you tap there **Bop** and your streets will appear." | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S2 | Demolition of streets runs through the **inventory**: "enter the inventory, select streets and you can simply tap them to remove them." The bulldozer button sits in the right-side inventory and offers **three categories** to choose from; the presenter disables *trees* and *streets*. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S3 | Road **tier** decides building connection: "you drag it there it **automatically snaps to the streets** … the **muddy roads won't give Road connection** to this building." | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S4 | The mobile title's building shop holds **over 300 buildings** and "higher levels unlock more buildings"; the game has **no XP** — level is a direct function of resident amount. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S5 | Zoom model: zoom in fully and zoom in again → **walk mode** (first person), exit button returns; zoom out fully and zoom out again → **region view**. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S6 | Settings include **first-person sensitivity**, tuned "depending on your device". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S7 | Monorail "have the ability to … **provide Street connection to residential buildings in the area without having streets**". | [CONFIRMED] | https://www.youtube.com/watch?v=71H1tU2DGz8 |
| S8 | Monorail "can be build **over fields**" and "the monorails are built **across decoration buildings**, so space that is already occupied by decorational buildings … can be used to also provide connection to the traffic system". | [CONFIRMED] | https://www.youtube.com/watch?v=71H1tU2DGz8 |
| S9 | "it's **only to residential buildings** — commercial buildings and … industrial buildings are **not affected** by the monorail". | [CONFIRMED] | https://www.youtube.com/watch?v=71H1tU2DGz8 |
| S10 | A monorail train runs the track and is audible in-game ("chip chip chip"). | [CONFIRMED] | https://www.youtube.com/watch?v=71H1tU2DGz8 |
| S11 | Science View has a **monorail category**, "the last one at the bottom", listing "all your monoral stations and the area in which they provide connection to residential buildings". | [CONFIRMED] | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| S12 | Influence rule: "if **one tile of a building is affected by an influence** … **the whole building counts as affected**". | [CONFIRMED] | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| S13 | Science View is opened from the **mini map**; the right sidebar selects the category, and selecting a source highlights only that source's area. Orange tint = "this building emits what you're currently selected". | [CONFIRMED] | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| S14 | Science View also shows that **school connection comes partly from bus stops**: "the connection to school is not only given by the school buildings themselves, but also by the bus stops, but bus stops deactivate if you do not have enough school capacity". | [CONFIRMED] | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| S15 | Bus stations "**provide School connection to the surrounding buildings**" and "you can build them anywhere … not to not need to be built directly next to a school"; they "**will deactivate** and will no longer provide connection to the school system" when school capacity is unmet, and "as soon as you increased your Capacity they will get back active". | [CONFIRMED] | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| S16 | Harbor: "when you have a **Harbor** on your map it automatically connects to the global system … it does not matter anymore if the food production or the waste management is on this current map or on any other of your maps within your region". | [CONFIRMED] | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| S17 | "the **harbor** it should be in the **infrastructure section**" of the building shop; energy uses a **C-wire** and water a **water pipeline**, each built once per map to join that map to the global system. | [CONFIRMED] | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| S18 | A **globe icon** on the economy panel marks a connected map, and the panel then shows **global numbers**. | [CONFIRMED] | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| S19 | C-wire purpose: "you can have your energy production facilities on one map but the consumption on another … build the C wire on each map that you want to connect". | [CONFIRMED] | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| S20 | The water pipeline is likewise "to connect multiple Maps in terms of connecting the water" — it is a connector, not a producer. | [CONFIRMED] | https://www.youtube.com/watch?v=yuLUP_ELk4I |
| S21 | Region view: "you can see all of your Maps … the active one is marked in **blue**"; the region lines "fade off" after two or three seconds. Switching maps = zoom into another map, confirm the popup, the game reloads into it. | [CONFIRMED] | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| S22 | Camera modes: **autographic** (pinch zoom, two-finger tilt, rotation "will Auto snap every **55°**") and **perspective** (the default at first launch, with a tilt-shift effect). | [CONFIRMED] | https://www.youtube.com/watch?v=ovWkwWS5FlY |
| S23 | First-person camera: "you can even **jump on cars** if you catch them and **drive with them** around your city". Exit is a red cross button in the top-left corner. | [CONFIRMED] | https://www.youtube.com/watch?v=ovWkwWS5FlY |
| S24 | Simulation speed is observable in traffic: "the **traffic is really slow** cuz I didn't watch an ad and I also don't have the **speed up package**". | [CONFIRMED] | https://www.youtube.com/watch?v=ovWkwWS5FlY |
| S25 | Speed-up is a real mechanic of the mobile title — a watch-an-ad speed-up button, and a **speed-up package** that removes it and makes offline constructions finish faster; constructions are measured "in **minutes**". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S26 | PC feature list: "**Flexible Roads & Railways**: Connect districts with **different road types, bridges and tunnels**"; "Create entire maps, **build roads and railways**"; "connect your neighborhoods with **roads, bridges, tunnels and railways**". | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| S27 | PC feature list: "Watch **traffic move through your streets**, **pedestrians follow the sidewalks**, **trains travel along your railways** and **boats navigate the waterways**." | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| S28 | PC feature list: "**Living Cities**: Experience active neighborhoods and **transport**"; "**First- and third-person modes**". | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| S29 | PC Early Access "begins with a **construction sandbox** centered on shaping worlds, building cities, creating assets and exploring the places you make"; "designed to grow with additional game modes, new rule sets". | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| S30 | SCC Studio can customise "existing buildings, **vehicles**, terrain sets, **citizens** and props" — roads, tracks and stations are **not** in that list. | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| S31 | Steam demo announcement: "on top of **road traffic** there are **trains, helicopters and ships** moving through your city". The demo has **no economy** and **on-foot walking was not yet in the demo**. | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| S32 | The dev on the traffic model: "**traffic is especially tricky**. A lot of city builders use some kind of trick in problematic situations, like **removing cars after they have been stuck for too long**, because otherwise you can easily end up with **one giant permanent traffic jam**"; keeping traffic consistent over long periods "is surprisingly difficult"; "This is still pretty open at the moment". | [CONFIRMED] | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| S33 | Planned modes: "a classical **RCI** mode, one that is more focused on **resource management**, and a very casual **tycoon** mode". | [CONFIRMED] | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| S34 | Official site: "Shape the land, **lay the first road**"; "**Traffic passes the corner café. People cross the square.**" | [CONFIRMED] | https://supercitycon.net/ |
| S35 | Dev post on the voxel editor: "Building your **Monorail** allows you to build your city even more unique and **gives street connection to your surrounding buildings**"; the editor's output integrates "into the gameplay" and the game "automatically calculates construction costs and economic impact". | [CONFIRMED] | https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ |
| S36 | Third-party mobile guide: "no houses or facilities can function without **proper connection of routes** … all the houses, commercial buildings, and facilities [must] be **well connected with the roads**". | [CONFIRMED] | https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |
| S37 | Mobile store listing: **Region View** — "Seamlessly integrate **multiple maps into one cohesive region**"; **Street View** — "Walk through your city and experience parks, bustling streets, and daily life up close". | [CONFIRMED] | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| S38 | The mobile title and the PC title are **separate games** — "The original Super Citycon™: Build a City is free on iPhone, iPad and Android. It is a separate game from SuperCitycon on Steam." | [CONFIRMED] | https://supercitycon.net/ |

### 1.2 Screens/flows observed

- **Street Building** (S1): Street Building button → street-type selector → tap the map → a direction
  indicator is drawn for **every direction that is possible** at that cell → tap one → the segment
  appears with the "Bop" feedback → the tool stays armed for the next tap.
- **Inventory / bulldozer** (S2): Inventory panel on the right → bulldozer button → three checkable
  categories (the presenter disables *trees* and *streets*) → tapping a map object removes it only if
  its category is enabled.
- **Building → road connection** (S3): drag a building into place → it snaps to the streets → a
  building beside a low-tier "muddy" road receives **no** road connection.
- **Monorail** (S7–S11): lay monorail track (over fields, and across decorative buildings) → place
  monorail stations → each station's area grants **residential street connection with no streets** →
  inspect the stations and their areas in the Science View monorail category.
- **Bus station** (S15): place a bus station away from any school → it grants school connection to the
  surrounding buildings → run out of school capacity → the station goes inactive and stops granting
  connection → add capacity → it comes back active.
- **Harbor / global economy** (S16–S18): place a Harbor from the infrastructure section → the map's
  food and waste become globally connected → the economy panel shows the globe icon and global
  numbers; energy (C-wire) and water (water pipeline) connect separately.
- **Region view** (S21): zoom out fully and zoom out again → all maps of the region with the active
  one in blue → the region lines fade → zoom into another map and confirm to switch.
- **First person** (S22–S24): zoom in fully and zoom in again → first person → jump onto a car and
  drive it → exit with the red cross button.

---

## 2. System overview

**Proposed architecture — read it with Section 11.** The *authoring* half of this diagram is evidenced
(S1, S2, S7–S15): the Street Building tool, the bulldozer, the tier rule and the connection assets.
The *graph* half — `RoadGraph`, `Node {kind: junction|end|edge}`, `Junction {movements, phase}`,
`Vehicle.lane`, trip generation and "no path ⇒ no trip" — is a **rebuild proposal, not a description of
the shipped games**. It is the subject of OQ-MOB-08, OQ-MOB-11, OQ-MOB-13 and OQ-MOB-17 and is built
only once those questions are decided.

```
 AUTHORING (player-facing)                     GRAPH (authoritative, per map)
 Street Build tool ─► StreetType catalogue     RoadGraph
   type picker → tap → direction gizmo          ├─ Node {cell, kind: junction|end|edge}
   → tap a direction → "Bop" → segment          └─ Segment {a, b, streetTypeId, layer,
 Inventory ─► Bulldozer (3 categories) ────────►          bridgeFlag, flags}
 Rail / Monorail tools                          RailGraph   (separate from RoadGraph)
   │                                           MonorailGraph
   ├─► CONNECTIVITY RESOLVER                   ├─ Station {cell, influenceArea}
   │    node-sharing ≠ cell adjacency          └─ Track {cells, layer}
   │    building ↔ road attachment (by tier)
   │    monorail station influence (resi only)  WaterGraph  (from WLD navigation graph)
   │    bus-station connection (capacity-gated)   └─ Boat path
   └──────────────────────────────────────►     Harbor {cell, joinsGlobalTrade}
 TRANSPORT LAYER (tick-scaled; speed-ups scale it)      │
  Vehicle {class, path, lane, speed, stuck}     Ship {path, dock}
  Pedestrian {origin, dest, sidewalkPath}       Helicopter {path}
  Junction {movements, phase, signals}                   │
        │                                                 ▼
        └────────────► TRIP GENERATION ◄──────────────────┘
                       origin: building entrance, station, outside connection
                       dest:   building, station, outside connection
                       no path ⇒ trip not generated, building reported unconnected
                                  │
                                  ▼
                     ECONOMY (ECO owns the numbers:
                      Harbor ⇒ global food/waste pool, globe icon,
                      C-wire ⇒ global energy, pipeline ⇒ global water)
```

---

## 3. Functional requirements

### 3.1 Street Building tool and street authoring

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-MOB-001 | The game shall provide a **Street Building tool** reachable from the main HUD which places street segments on the map. | Must | Both | no | QA-MOB-001 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-002 | The Street Building tool shall open a **street-type picker**; the type the player selects there is the type placed by the next map tap, and the selection persists between taps. | Must | Both | no | QA-MOB-002 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-003 | On a map tap the tool shall render a **direction indicator for every build direction that is possible** at that cell — one indicator per legal direction, and no indicator for an illegal one. | Must | Both | no | QA-MOB-003 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-004 | Tapping one of the direction indicators shall commit **exactly one** street segment running in that direction, with the game's "**Bop**" placement feedback at the placed cell. | Must | Both | no | QA-MOB-004 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-005 | The direction-indicator set shall be **recomputed on every tap**, so the legal directions always reflect the current occupancy of the cell and its neighbours. | Must | Both | no | QA-MOB-005 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-006 | After a segment is committed the tool shall **stay armed with the same street type**, so a continuous run of street can be laid by successive taps without re-entering the tool. | Must | Both | no | QA-MOB-006 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-007 | Street segments shall be placed on the **voxel grid**, occupying whole cells; a segment shall never float between cells or sit at a fractional position. | Must | Both | no | QA-MOB-007 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-008 | Each street segment shall carry an **integer layer** drawn from the `WLD` layer address space (`G`, `1`–`4`, `U1`, `U2`); a segment's height shall never be expressed in metres. The layer address space itself is owned by `WLD` (BOT-02). | Must | Both | no | QA-MOB-008 | https://store.steampowered.com/app/3474890/SuperCitycon/ · `WLD` layer address space (BOT-02) |
| FR-MOB-009 | The **bulldozer** shall be reachable from the **Inventory panel** and shall remove a street segment when the player taps it. | Must | Both | no | QA-MOB-009 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-010 | The bulldozer shall expose **three player-selected categories** that determine what a tap removes; a tap shall remove only objects whose category is currently enabled. | Must | Both | no | QA-MOB-010 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-011 | Demolishing a street segment shall **remove it from the transport network** and re-resolve the road connection of every building that touched it. | Must | Both | no | QA-MOB-011 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-012 | A street segment shall be an **addressable object with a stable identity** that other systems (building connection, transit, save/load) can reference. Whether that identity is player-visible is undecided. **[design decision — OQ-MOB-01]** | Should | Design | no | QA-MOB-012 | [TBD — design decision] OQ-MOB-01 |
| FR-MOB-013 | Street Building shall be available in every mode that permits construction: the mobile **sandbox** and **classic simulation** modes, and the PC **construction sandbox**. | Must | Both | no | QA-MOB-013 | https://www.youtube.com/watch?v=jYAD0SkDmY0 · https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-014 | A direction that would place a segment outside the map bounds, or on a cell that is not free under the active layer's occupancy flags, shall **not be offered** as a direction indicator. | Must | Both | no | QA-MOB-014 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.2 Road types, tiers and road connection

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-MOB-015 | The game shall offer a **catalogue of different road types**, selectable from the Street Building tool. | Must | Both | no | QA-MOB-015 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-016 | Road types shall be **tiered**, and the tier shall decide whether an adjacent building receives **road connection**: a low-tier road (the observed "muddy road") confers **none**. | Must | Both | no | QA-MOB-016 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-017 | The catalogue shall be **data-driven** — one definition record per type, consumed by authoring, by the simulation and by the UI — so a new road type ships as content without an engine change. This is a **rebuild architecture decision**: no source states that the shipped catalogue is data-driven. **[design decision — OQ-MOB-02]** | Must | Design | no | QA-MOB-017 | [TBD — design decision] OQ-MOB-02 |
| FR-MOB-018 | A road-type record shall declare at minimum: id, display label, tier, carriageway footprint in cells, direction mode, lanes per direction, maximum speed, per-lane capacity, track acceptance, zoned-frontage acceptance and bridge/tunnel eligibility. Only the *existence of several road types* and the *tier → connection* rule are evidenced; the field set, the lane / speed / capacity fields and every value are not described in any source. **[design decision — OQ-MOB-02]** | Could | Design | no | QA-MOB-018 | [TBD — design decision] OQ-MOB-02 |
| FR-MOB-019 | A road type's **carriageway footprint shall be expressed in whole grid cells**, never in metres or lane-width units, so that geometry stays on the voxel lattice. The **width per type** is unevidenced and is [TBD]. **[design decision — OQ-MOB-02]** | Could | Design | no | QA-MOB-019 | [TBD — design decision] OQ-MOB-02 |
| FR-MOB-020 | Direction mode (two-way / one-way / divided) and lanes per direction shall be **per-type data**, not hard-coded in the engine. Neither the direction modes nor the lane counts are described in any source. **[design decision — OQ-MOB-03]** | Could | Design | no | QA-MOB-020 | [TBD — design decision] OQ-MOB-03 |
| FR-MOB-021 | Each road type shall declare a **maximum speed** and a **per-lane capacity**. No source states any speed limit or any capacity; both values are [TBD] and the fields themselves are a rebuild proposal. **[design decision — OQ-MOB-04]** | Could | Design | no | QA-MOB-021 | [TBD — design decision] OQ-MOB-04 |
| FR-MOB-022 | Each road type shall declare whether a **rail, tram or monorail track** may be laid on it and whether it accepts **zoned frontage**; both flags are unevidenced and their values are [TBD]. **[design decision — OQ-MOB-05]** | Could | Design | no | QA-MOB-022 | [TBD — design decision] OQ-MOB-05 |
| FR-MOB-023 | **Bridge and tunnel shall be per-segment flags**, not separate road types, so the same road type can be used at grade and elevated. **[design decision — OQ-MOB-06]** | Could | Design | no | QA-MOB-023 | [TBD — design decision] OQ-MOB-06 |
| FR-MOB-024 | A road **surface / skin** shall be selectable independently of the type's lane geometry. The skin list is [TBD — design decision] — OQ-MOB-07. **[design decision — OQ-MOB-07]** | Could | Design | partial | QA-MOB-024 | [TBD — design decision] OQ-MOB-07 |
| FR-MOB-025 | A road type shall declare whether it may be laid **over water**, which requires a bridge structure with piers rather than a filled causeway. Bridges and tunnels are evidenced; the **per-type flag** is a rebuild decision. **[design decision — OQ-MOB-06]** | Could | Design | no | QA-MOB-025 | [TBD — design decision] OQ-MOB-06 |
| FR-MOB-026 | The catalogue shall contain at least one tier that **grants** building road connection and at least one that does **not**, so that the tier rule is observable in play. | Must | Both | no | QA-MOB-026 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.3 Network topology, junctions and connectivity

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-MOB-027 | The road network shall be stored as a graph of **nodes** and **segments**, where a segment connects exactly two nodes. **No source describes the game's network representation**; this is the rebuild's topology proposal, not a description of the shipped model. **[design decision — OQ-MOB-08]** | Could | Design | no | QA-MOB-027 | [TBD — design decision] OQ-MOB-08 |
| FR-MOB-028 | A node shall be created where two or more segments meet, where a segment ends, and where the network reaches the edge of the map. The node kinds themselves are unevidenced. **[design decision — OQ-MOB-08]** | Could | Design | no | QA-MOB-028 | [TBD — design decision] OQ-MOB-08 |
| FR-MOB-029 | Two segments shall be connected for traffic **only if they share a node**; two segments that merely occupy neighbouring cells are not connected. The connectivity definition is unevidenced. **[design decision — OQ-MOB-08]** | Could | Design | no | QA-MOB-029 | [TBD — design decision] OQ-MOB-08 |
| FR-MOB-030 | A segment that terminates without meeting another segment shall form a **dead end**; traffic may enter it and shall turn back at the end node rather than vanish. Dead ends — and what happens to a vehicle at one — are unevidenced. **[design decision — OQ-MOB-08]** | Could | Design | no | QA-MOB-030 | [TBD — design decision] OQ-MOB-08 |
| FR-MOB-031 | A segment reaching the **edge of the map** shall form an **outside connection**, a valid origin and destination for traffic that enters and leaves the city. **[design decision — OQ-MOB-09]** | Could | Design | no | QA-MOB-031 | [TBD — design decision] OQ-MOB-09 |
| FR-MOB-032 | A building shall gain **road connection** when at least one cell of its footprint is adjacent to a road segment whose tier grants connection. | Must | Both | no | QA-MOB-032 | https://www.youtube.com/watch?v=jYAD0SkDmY0 · https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |
| FR-MOB-033 | A building's road connection shall be **re-evaluated** whenever the adjacent network changes — a segment built, demolished, re-typed or re-tiered. | Must | Both | no | QA-MOB-033 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-034 | A building with no road connection shall be **reported as unconnected** in its own inspection panel. **[design decision — OQ-MOB-10]** | Could | Design | no | QA-MOB-034 | [TBD — design decision] OQ-MOB-10 |
| FR-MOB-035 | A junction shall resolve, for each of its approaches, the **set of movements** available from that approach; a movement is either present in the set or explicitly excluded from it. The junction and movement model is unevidenced. **[design decision — OQ-MOB-11]** | Could | Design | no | QA-MOB-035 | [TBD — design decision] OQ-MOB-11 |
| FR-MOB-036 | The player shall be able to **ban a movement** at a junction (for example a left turn) and the ban shall take effect from the next traffic tick. **[design decision — OQ-MOB-11]** | Could | Design | no | QA-MOB-036 | [TBD — design decision] OQ-MOB-11 |
| FR-MOB-037 | A junction shall support a **signalised** mode with a phase cycle and an **uncontrolled** mode; which mode is the default for a given junction type is [TBD — design decision] — OQ-MOB-12. **[design decision — OQ-MOB-12]** | Could | Design | no | QA-MOB-037 | [TBD — design decision] OQ-MOB-12 |
| FR-MOB-038 | Each lane shall carry a **movement set**, and a vehicle shall be assigned to a lane whose movement set contains the movement it intends to make, preferring a lane that serves that movement alone. Conditional on lanes existing at all. **[design decision — OQ-MOB-13]** | Could | Design | no | QA-MOB-038 | [TBD — design decision] OQ-MOB-13 |
| FR-MOB-039 | Two vehicles that want the same cell at the same junction shall be resolved **deterministically**, so the junction can never deadlock the network. The conflict-resolution mechanism is unevidenced. **[design decision — OQ-MOB-11]** | Could | Design | no | QA-MOB-039 | [TBD — design decision] OQ-MOB-11 |
| FR-MOB-040 | A trip shall be generated only when a **path exists** in the connected network between the origin and the destination; if no path exists the trip shall not be created and the origin building shall be reported as unconnected. Path existence, and the routing behind it, are unevidenced. **[design decision — OQ-MOB-08]** | Could | Design | no | QA-MOB-040 | [TBD — design decision] OQ-MOB-08 |

### 3.4 Railways, trains and the monorail

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-MOB-041 | The game shall provide a **railway network**, separate in kind from the road network: "build roads and railways", "trains travel along your railways". | Must | Both | no | QA-MOB-041 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-042 | **Train vehicles** shall travel along the railway network and be visible on their track. | Must | Both | partial | QA-MOB-042 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-MOB-043 | A **monorail** shall provide **street connection to residential buildings in its area without streets**, so residential buildings can be reached with no street network at all. | Must | Mobile | no | QA-MOB-043 | https://www.youtube.com/watch?v=71H1tU2DGz8 |
| FR-MOB-044 | Monorail connection shall apply **only to residential buildings**; commercial and industrial buildings shall not be affected by it. | Must | Mobile | no | QA-MOB-044 | https://www.youtube.com/watch?v=71H1tU2DGz8 · https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-MOB-045 | **Monorail stations** shall be the objects that grant the connection, and each station shall have an **influence area** bounded by the station's reach. | Must | Mobile | no | QA-MOB-045 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-MOB-046 | Monorail track shall be buildable **over fields** and **across space already occupied by decorative buildings**, so decorative space can double as transport space. | Must | Mobile | no | QA-MOB-046 | https://www.youtube.com/watch?v=71H1tU2DGz8 |
| FR-MOB-047 | A monorail train shall **run the track** and be visible and audible in the world. | Must | Mobile | partial | QA-MOB-047 | https://www.youtube.com/watch?v=71H1tU2DGz8 |
| FR-MOB-048 | The same map area shall be able to carry **decoration and monorail track simultaneously**, so one square of land can serve both purposes. | Should | Mobile | no | QA-MOB-048 | https://www.youtube.com/watch?v=71H1tU2DGz8 |
| FR-MOB-049 | The Science View shall contain a **monorail category** listing every monorail station in the map and the area in which each one provides residential street connection. | Must | Mobile | no | QA-MOB-049 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-MOB-050 | A monorail station's influence area shall be evaluated **per tile**, and a building touched by that area on **a single tile** shall count as fully affected. | Must | Mobile | no | QA-MOB-050 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-MOB-051 | Monorail and railway geometry shall sit on the voxel grid with an **integer layer**; elevated monorail shall run on a layer above ground rather than at a height in metres. | Must | Both | no | QA-MOB-051 | [TBD — design decision] OQ-MOB-22 · https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-052 | The PC title shall offer the monorail track and station assets with the **same residential street-connection rule** as the mobile title. | Could | PC-EA | yes | QA-MOB-052 | [TBD — design decision] OQ-MOB-23 · https://store.steampowered.com/app/3474890/SuperCitycon/ |

### 3.5 Waterways, boats and the Harbor

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-MOB-053 | The world shall support **boats navigating the waterways**. | Must | Both | no | QA-MOB-053 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-054 | **Ships** shall move through the city as a distinct vehicle class alongside road traffic, trains and helicopters. | Must | Both | partial | QA-MOB-054 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-MOB-055 | A boat's path shall be computed on the `WLD` **water navigation graph** only — over submerged cells of a single connected body — and shall never cross land at the current water level. | Must | Both | no | QA-MOB-055 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-056 | The **Harbor** shall be a placeable building found in the **infrastructure** section of the building shop. | Must | Mobile | yes | QA-MOB-056 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-MOB-057 | The Harbor shall be the region's **trade and logistics anchor**: a map that holds a Harbor is the map that carries the region's trade connection. The **pool-membership rule itself belongs to `ECO`** (`FR-ECO-101`, `FR-ECO-102`, `FR-ECO-112`) and is cross-referenced here, not restated. | Must | Mobile | yes | QA-MOB-057 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-MOB-058 | A Harbor's **placement rule** — what it must touch or sit beside to be legal — is [TBD — design decision] — OQ-MOB-20. | Could | Design | no | QA-MOB-058 | [TBD — design decision] OQ-MOB-20 · https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-MOB-059 | **Ships shall dock at a Harbor and sail from it**, and cargo shall move between the Harbor and the map's industry. | Could | Design | no | QA-MOB-059 | [TBD — design decision] OQ-MOB-20 · https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-MOB-060 | A boat whose route is broken by a **water-level change** shall re-route if a path still exists and otherwise be removed cleanly, leaving no orphaned harbour links. Boats navigating the waterways are evidenced; **route invalidation is a rebuild decision**. **[design decision — OQ-MOB-26]** | Should | Design | no | QA-MOB-060 | [TBD — design decision] OQ-MOB-26 |
| FR-MOB-061 | Placing a Harbor shall cause its map's food and waste to be read as **global** in the economy panel, with the globe icon. `ECO` owns the pool and the icon; `MOB` owns the placement event that triggers it. | Must | Mobile | no | QA-MOB-061 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-MOB-062 | Removing a Harbor shall **detach** its map from the global pool and return that map to local accounting, without a reload. `ECO` owns the re-scoping rule; `MOB` owns the demolition event. | Must | Mobile | no | QA-MOB-062 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-MOB-063 | The PC title shall offer the Harbor and the C-wire / water-pipeline buildings with the same cross-map behaviour as the mobile title. | Could | PC-EA | yes | QA-MOB-063 | [TBD — design decision] OQ-MOB-23 · https://store.steampowered.com/app/3474890/SuperCitycon/ |

### 3.6 Air traffic

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-MOB-064 | **Helicopters** shall move through the city above road traffic, as a distinct vehicle class. | Must | Both | partial | QA-MOB-064 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-MOB-065 | Helicopter **origins, destinations and landing sites** are [TBD — design decision] — OQ-MOB-21. | Could | Design | no | QA-MOB-065 | [TBD — design decision] OQ-MOB-21 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-MOB-066 | Helicopter movement shall be **independent of the road traffic model** — it shall neither consume nor be constrained by carriageway capacity. | Could | Design | no | QA-MOB-066 | [TBD — design decision] OQ-MOB-21 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |

### 3.7 Pedestrians, sidewalks and walk mode

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-MOB-067 | **Pedestrians shall walk on the sidewalks** alongside the streets. | Must | Both | no | QA-MOB-067 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-068 | Pedestrians shall **cross the street** on foot, so a square or a street can be crossed on foot. The site's own wording is "People cross the square"; whether a distinct crossing object exists is unevidenced and is left to the design decisions in FR-MOB-069 and OQ-MOB-14. | Must | Both | no | QA-MOB-068 | https://supercitycon.net/ |
| FR-MOB-069 | The **pedestrian network shall be separate from the carriageway network**; a stretch with no sidewalk shall offer no pedestrian route. **[design decision — OQ-MOB-14]** | Could | Design | no | QA-MOB-069 | [TBD — design decision] OQ-MOB-14 |
| FR-MOB-070 | Pedestrians shall be **spawned from connected buildings** and shall walk to a destination, with their **routing cost function** [TBD — design decision] — OQ-MOB-14. Pedestrian spawning and pedestrian routing are unevidenced; only "pedestrians follow the sidewalks" is stated. **[design decision — OQ-MOB-14]** | Could | Design | no | QA-MOB-070 | [TBD — design decision] OQ-MOB-14 |
| FR-MOB-071 | **Walk mode** shall be entered by zooming in fully and zooming in again, and shall be exited with the exit button, returning to the camera view. | Must | Both | no | QA-MOB-071 | https://www.youtube.com/watch?v=jYAD0SkDmY0 · https://www.youtube.com/watch?v=ovWkwWS5FlY |
| FR-MOB-072 | In first-person mode the player shall be able to **enter a car and drive it**, and shall be able to leave the vehicle again. | Should | Mobile | no | QA-MOB-072 | https://www.youtube.com/watch?v=ovWkwWS5FlY |
| FR-MOB-073 | **First-person sensitivity** shall be a settings value, tuned per device. | Should | Mobile | no | QA-MOB-073 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.8 Vehicle traffic simulation

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-MOB-074 | **Road traffic shall move along the road network** — vehicles travel along the streets. (Turning behaviour at junctions belongs to the Design-stage junction model, FR-MOB-035.) | Must | Both | no | QA-MOB-074 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-075 | Traffic shall advance on the **simulation tick**, so the watch-an-ad speed-up and the speed-up package visibly change how fast traffic moves. | Must | Both | no | QA-MOB-075 | https://www.youtube.com/watch?v=ovWkwWS5FlY · https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-076 | The **evidenced vehicle classes** shall be: cars (road), trains (rail), ships (boats) and helicopters (air). | Must | Both | no | QA-MOB-076 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 · https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-077 | Any further vehicle classes — freight trucks, buses, trams, service vehicles — are [TBD — design decision] — OQ-MOB-15. | Could | Design | no | QA-MOB-077 | [TBD — design decision] OQ-MOB-15 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-MOB-078 | A vehicle shall be **removed from the world when it reaches its destination**, and its slot returned for reuse. The vehicle lifecycle is unevidenced; no source describes when a car leaves the world. **[design decision — OQ-MOB-17]** | Could | Design | no | QA-MOB-078 | [TBD — design decision] OQ-MOB-17 |
| FR-MOB-079 | Traffic **volume** shall scale with the number of residents and the number of jobs in the city. The volume/demand relationship is unevidenced. **[design decision — OQ-MOB-17]** | Could | Design | no | QA-MOB-079 | [TBD — design decision] OQ-MOB-17 |
| FR-MOB-080 | Traffic **demand** shall follow a time-of-day profile, so a busy period of the day is visibly busier than the small hours. No 24-hour demand curve is described in any source. **[design decision — OQ-MOB-17]** | Could | Design | no | QA-MOB-080 | [TBD — design decision] OQ-MOB-17 |
| FR-MOB-081 | The congestion model shall **not end in one permanent gridlock**. The mechanism used to achieve this is [TBD — design decision] — OQ-MOB-16 — because the developer explicitly names "removing cars after they have been stuck for too long" as the trick he wants to avoid, and calls the model "still pretty open". | Must | Design | no | QA-MOB-081 | [TBD — design decision] OQ-MOB-16 · https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-MOB-082 | A vehicle that has been stationary beyond a threshold shall be handled by the **congestion policy** rather than silently removed, and the policy shall be surfaced to the player as a diagnostic. | Could | Design | no | QA-MOB-082 | [TBD — design decision] OQ-MOB-16 · https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-MOB-083 | The traffic simulation shall be **pausable and resumable** without corrupting vehicle state, so the player can pause to inspect a junction. Conditional on the traffic model being decided at all. **[design decision — OQ-MOB-16]** | Could | Design | no | QA-MOB-083 | [TBD — design decision] OQ-MOB-16 |

### 3.9 Public-transport assets and transit lines

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-MOB-084 | A **bus station** shall be a placeable transport asset that grants school-system connection to the surrounding buildings. | Must | Mobile | yes | QA-MOB-084 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-MOB-085 | A bus station shall grant its connection **without needing to be built next to a school** — it may be placed anywhere, and it reaches the surrounding buildings. | Must | Mobile | yes | QA-MOB-085 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-MOB-086 | A bus station shall **deactivate when school capacity is unmet** and stop granting school connection; `SRV` owns the capacity number, `MOB` owns the activation signal. | Must | Mobile | yes | QA-MOB-086 | https://www.youtube.com/watch?v=PifQ_7vj7Ao · https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-MOB-087 | A bus station shall **reactivate** as soon as school capacity is restored, and resume granting connection. | Must | Mobile | yes | QA-MOB-087 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-MOB-088 | A deactivated bus station shall be **shown as inactive** wherever it is listed, so the player can see why a reach is not working. | Could | Design | no | QA-MOB-088 | [TBD — design decision] OQ-MOB-10 · https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-MOB-089 | **Transit lines** — routes with a sequence of stops, a vehicle count, a fare and a colour — are [TBD — design decision] — OQ-MOB-18. | Could | Design | no | QA-MOB-089 | [TBD — design decision] OQ-MOB-18 · https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-MOB-090 | Whether **tram tracks** run on a shared carriageway or on their own reserved alignment is [TBD — design decision] — OQ-MOB-19. **[design decision — OQ-MOB-19]** | Could | Design | no | QA-MOB-090 | [TBD — design decision] OQ-MOB-19 |

### 3.10 Bridges, tunnels, grade separation and terrain interaction

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-MOB-091 | Roads, railways, **bridges** and **tunnels** shall connect districts, and the PC title shall offer them as first-class transport infrastructure. | Must | Both | no | QA-MOB-091 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-092 | A bridge's **deck shall sit at an explicit integer layer** from the `WLD` layer address space, and shall not alter the terrain or the water beneath it. | Must | Both | no | QA-MOB-092 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-093 | A tunnel shall be carried on the **underground layers** (`U1`, `U2`) with a clearance volume of at least one layer; a route may pass under terrain or under a water body. | Must | Both | no | QA-MOB-093 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-094 | Traffic on a bridge and traffic in a tunnel at the same horizontal position shall **not conflict** — grade separation follows from layer addressing, not from a special-case rule. | Must | Both | no | QA-MOB-094 | [INFERRED] from https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-095 | A road crossing a **one-layer terrain step** shall ramp, bridge, or be rejected. `WLD` supplies the elevation queries and the ramp/bridge cells; the **rule set is owned by `MOB`** and its thresholds are [TBD — design decision] — OQ-MOB-22. | Must | Both | no | QA-MOB-095 | [TBD — design decision] OQ-MOB-22 · https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-096 | A road laid **over water** shall require a bridge structure and piers, leaving the water body beneath it open and navigable. | Must | Both | no | QA-MOB-096 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-097 | A road segment shall be laid on the **surface layer of the cell it occupies** by default; a raised or lowered placement shall be an explicit player choice, never a side effect of terrain. | Must | Both | no | QA-MOB-097 | [TBD — design decision] OQ-MOB-22 · https://store.steampowered.com/app/3474890/SuperCitycon/ |

### 3.11 Transport editing, demolition and rebuildability

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-MOB-098 | Any street segment shall be **demolished and re-placed** by the player: bulldoze the segment, then build a new one. | Must | Both | yes | QA-MOB-098 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-099 | A placed transport asset that can be moved (a station, the Harbor) shall be movable through the same **long-tap → orbit → move/rotate → confirm** interaction the game already uses for buildings. | Should | Both | yes | QA-MOB-099 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-100 | **Vehicle models** shall be rebuildable by the player in SCC Studio; road, track and station assets are **not** in the SCC Studio customisation list and shall not be presented as such. | Should | PC-EA | partial | QA-MOB-100 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-MOB-101 | Demolishing a road shall **immediately un-connect** every building it served, and the un-connected buildings shall be reported. | Must | Both | no | QA-MOB-101 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-102 | A transport edit shall be **reversible**: re-building the same cells with the previous type shall restore the previous network state exactly. | Could | Design | yes | QA-MOB-102 | [TBD — design decision] OQ-MOB-24 · https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-103 | The whole transport network shall survive a **save and reload** with its graph, layers and per-segment flags intact, so the player returns to the same city they left. `TEC` owns the save/load mechanism; the **network representation that is saved** is a rebuild decision. **[design decision — OQ-MOB-08]** | Must | Design | no | QA-MOB-103 | [TBD — design decision] OQ-MOB-01 · OQ-MOB-08 · https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-MOB-104 | Transport **statistics** — segment count, network length, vehicle count, connected-building count — shall be derivable from the graph so the player can see whether a city is actually connected. The statistics panel is not described in any source, and the graph it reads is a proposal. **[design decision — OQ-MOB-10]** | Should | Design | no | QA-MOB-104 | [TBD — design decision] OQ-MOB-10 |

---

## 4. Options, variants & configuration matrix

### 4.1 Transport mode matrix

| Mode | Carrier network | Evidenced vehicle | Grid / elevation model | Player-built? | Evidence | Status |
|---|---|---|---|---|---|---|
| **Road** | Road network — node/segment graph **[design — OQ-MOB-08]** | cars | ground layer `G`, integer layers | yes — Street Building tool | S1, S2, S26, S31 | traffic is shipped; the graph shape is OQ-MOB-08 |
| **Railway** | Railway network, separate in kind **[design — OQ-MOB-08]** | trains | integer layer | yes — "build roads and railways" | S26, S27, S31 | trains travelling on railways are shipped; the graph shape is OQ-MOB-08 |
| **Monorail** | Monorail track + stations (graph shape = OQ-MOB-08) | monorail train | integer layer, elevated | yes | S7, S8, S10, S11 | shipped (mobile); PC parity = OQ-MOB-23 |
| **Pedestrian** | Sidewalk / footpath graph | pedestrians | ground layer | yes (as part of the street) | S27, S34, S37 | shipped; graph detail = OQ-MOB-14 |
| **Water** | `WLD` water navigation graph | boats, ships | water level | partly — the world is terraformed | S27, S31 | shipped |
| **Air** | Air space | helicopters | n/a | n/a | S31 | shipped; routing = OQ-MOB-21 |
| **Transit lines** | road + rail + stations | buses / trams / trains on a line | n/a | TBD | — | design decision OQ-MOB-18 |

### 4.2 Road-type catalogue matrix

Only two properties of the catalogue are **evidenced**: that there is more than one road type, and that a
road type's **tier** decides whether an adjacent building receives road connection. Everything else in
this table is a proposed default carried by the Section 11 Open Questions — **not** a claim about the
game. **No numeric value in this table is evidenced**, so every count, width, speed and capacity
default is written `[TBD]`; a builder must not read a number here as the game's value.

| Property | Possible values | Evidenced? | Proposed default | OQ |
|---|---|---|---|---|
| Tier | ordered set of tiers | **yes** — a low tier ("muddy road") grants no connection | tier count and names **[TBD]**; the evidenced rule is that at least one tier grants connection and at least one does not | OQ-MOB-02 |
| Grants building connection | per tier | **yes** — low tier = no | **[TBD]** per tier | OQ-MOB-02 |
| Direction mode | two-way / one-way / divided | no | **[TBD]** | OQ-MOB-03 |
| Lanes per direction | integer ≥ 1 | no | **[TBD]** | OQ-MOB-03 |
| Carriageway footprint | integer cells | no | **[TBD]** cells wide | OQ-MOB-02 |
| Maximum speed | speed units | no | **[TBD]** speed steps | OQ-MOB-04 |
| Per-lane capacity | vehicles | no | **[TBD]** vehicles per lane | OQ-MOB-04 |
| Accepts a track | bool | no | **[TBD]** | OQ-MOB-05 |
| Accepts zoned frontage | bool | no | **[TBD]** | OQ-MOB-05 |
| May be built as bridge / tunnel | bool | no | **[TBD]**; the flag lives on the segment | OQ-MOB-06 |
| Surface / skin | asset id | no | **[TBD]** | OQ-MOB-07 |
| May be laid over water | bool | no | **[TBD]**, requiring a bridge structure | — |

### 4.3 Connection-providing transport assets

| Asset | Grants connection to | Radius / reach | Capacity-gated? | Evidence |
|---|---|---|---|---|
| **Road of a connection-granting tier** | every building type | n/a — footprint adjacency | no | S3, S32, S36 |
| **Monorail station** | **residential buildings only** | influence area, per tile | no | S7, S9, S11, S12 |
| **Bus station** | school-system connection | reach of the surrounding buildings | **yes** — inactive when school capacity is unmet | S14, S15 |
| **Harbor** | global food and waste trade (pool rule owned by `ECO`) | map-wide | no | S16, S17, S18 |

### 4.4 Water and air options

| Option | Evidenced | Owed to `ECO` | Owed to `WLD` |
| Harbor (infrastructure section) | S17 | global food + waste pool membership | — |
| Energy C-wire | S17, S19 | global energy pool membership | — |
| Water pipeline | S17, S20 | global water pool membership | — |
| Boat / ship navigation | S27, S31 | — | water navigation graph, navigable bodies |
| Helicopter | S31 | — | — |

### 4.5 Transit asset options

| Option | Evidenced | Notes |
|---|---|---|
| Bus station | **yes** (S14, S15) | Placeable anywhere; grants school connection; capacity-gated. |
| Bus stop | referenced as a school-connection source in Science View (S14) | distinct from bus station; scope [TBD] OQ-MOB-18 |
| Tram track | no | reserved vs shared alignment [TBD] OQ-MOB-19 |
| Transit line (stops, fare, vehicle count) | no | [TBD] OQ-MOB-18 |

---

## 5. Stage / progression matrix

`MOB` has **no independent stage ladder** — the progression model belongs to `CORE`, the unlock ladder to
`BLD`. The dimension used here is **platform availability × simulation depth**: what the player can
author, and how deep the traffic simulation runs.

| Stage | Entry condition | Player can build | Player can rebuild/modify | Unlocks | Exits when |
|---|---|---|---|---|---|
| **Mobile — street authoring** (shipped) | the player opens the mobile title | street segments via the Street Building tool; bulldoze them via the Inventory | demolish and re-place any segment; the type picker can be re-opened at any time | — (available from the first map) | the player leaves street authoring |
| **Mobile — connection assets** (shipped) | a map exists | monorail track and stations, bus stations, Harbor / C-wire / water pipeline | stations and the Harbor are movable; all are demolishable | monorail and Harbor are content-gated by level in the mobile title (`BLD`) | the map is complete |
| **Mobile — traffic depth** (shipped, shallow) | the simulation is running | — | — | cars move, pedestrians walk, the first-person camera lets the player drive a car | the simulation mode is closed |
| **PC-EA — construction sandbox** | the PC Early Access build is running | roads, railways, bridges, tunnels; terrain and water shaping; walking and driving | everything the player placed can be demolished and rebuilt | the whole sandbox; **no economy** yet | the Early Access sandbox is left |
| **Design — undecided traffic model** | a decision from Section 11 is taken | the node/segment network, the junction movement model, lane counts and speeds, dead-end turnarounds, outside connections, hourly demand curves, signals, turn bans, transit lines, freight, the congestion policy | — | the RCI / resource-management / tycoon modes the developer plans (S33) | the modes ship |

---

## 6. Data model

**Read the status markers.** A field marked **NOT IMPLEMENTED** is **reserved for a Section 11 design
decision**: it is *not* part of the shipped games' behaviour and must not be built until the named
question is decided. An unmarked field is either evidenced by a Section 1.1 finding or is a plain
structural field that carries no behavioural claim. **No field here invents a value** — every
unpublished number is `[TBD]`.

| Entity | Field | Type | Range / units | Meaning | Source |
|---|---|---|---|---|---|
| **StreetType** | `id` | string | unique per catalogue | identity of the road type | S26 |
| | `label` | string | — | the name shown in the picker | S1 |
| | `tier` | enum | ordered set | decides building road connection | S3 |
| | `grantsConnection` | bool | — | `false` for the observed low tier | S3 |
| | `footprintCells` | int | ≥ 1 cells | carriageway width on the grid — **NOT IMPLEMENTED**, the width is [TBD] | OQ-MOB-02 |
| | `directionMode` | enum | TWO_WAY / ONE_WAY / DIVIDED | **NOT IMPLEMENTED** — values [TBD] | OQ-MOB-03 |
| | `lanesPerDirection` | int | ≥ 1 | **NOT IMPLEMENTED** — no lane layer is evidenced | OQ-MOB-03 · OQ-MOB-13 |
| | `maxSpeed` | int | speed steps | **NOT IMPLEMENTED** — no speed limit is evidenced | OQ-MOB-04 |
| | `laneCapacity` | int | vehicles | **NOT IMPLEMENTED** — no capacity is evidenced | OQ-MOB-04 |
| | `acceptsTrack` / `acceptsZoning` | bool | — | **NOT IMPLEMENTED** — both flags [TBD] | OQ-MOB-05 |
| | `skinId` | string | asset id | surface variant — **NOT IMPLEMENTED** | OQ-MOB-07 |
| **RoadSegment** | `id` | string | stable | identity for connection, transit and save/load | OQ-MOB-01 |
| | `a`, `b` | node ids | — | the two endpoints — **NOT IMPLEMENTED**, the node graph is a proposal | OQ-MOB-08 |
| | `streetTypeId` | string | — | the type placed | S1 |
| | `layer` | enum | `G`,`1`–`4`,`U1`,`U2` | elevation address — **integer layers, never metres** | S26 + `WLD` |
| | `bridgeFlag` / `tunnelFlag` | bool | — | elevated / underground carriageway — flag-vs-type is undecided | S26 · OQ-MOB-06 |
| | `cells[]` | int2 list | — | occupied grid cells | S26 |
| **RoadNode** | `id` | string | stable | identity | OQ-MOB-01 |
| | `cell` | int2 | — | the node's position — **NOT IMPLEMENTED** | OQ-MOB-08 |
| | `kind` | enum | JUNCTION / END / EDGE | dead end, junction or map edge — **NOT IMPLEMENTED** | OQ-MOB-08 |
| | `movements[]` | set | per approach | permitted movements; bans are exclusions — **NOT IMPLEMENTED** | OQ-MOB-11 |
| | `signalMode` | enum | NONE / SIGNALLED | **NOT IMPLEMENTED** — [TBD] | OQ-MOB-12 |
| | `phase` | int | cycle index | current signal phase — **NOT IMPLEMENTED** | OQ-MOB-12 |
| **BuildingAttachment** | `buildingId` | string | — | the served building | S3 |
| | `sourceKind` | enum | ROAD / MONORAIL / BUS_STATION | how it is connected | S7, S15 |
| | `sourceId` | string | — | the segment, station or stop that serves it | — |
| | `active` | bool | derived | `false` for a capacity-gated bus station | S15 |
| **MonorailTrack** | `cells[]` | int2 list | — | the track footprint | S7 |
| | `layer` | enum | integer layer | elevated running layer | S7 + OQ-MOB-22 |
| **MonorailStation** | `cell` | int2 | — | where the station stands | S11 |
| | `influenceArea` | cell set | per tile | the area in which it grants residential street connection | S11, S12 |
| | `servesResidentialOnly` | bool | constant `true` | commercial and industrial are unaffected | S9 |
| **RailNetwork** | `nodes[]`, `segments[]` | graph | — | the railway, separate from the road graph — the graph shape is **NOT IMPLEMENTED** | S26 · OQ-MOB-08 |
| **WaterBody (from `WLD`)** | `navigationGraph` | graph | nodes = navigable cells | boat routing input | S27 |
| **Boat** | `path[]` | cell list | — | the route over navigable water | S27 |
| | `class` | enum | BOAT / SHIP | ship is a distinct class | S31 |
| | `dockId` | string | — | the Harbor it is docked at | OQ-MOB-20 |
| **Harbor** | `cell` | int2 | — | placement | S17 |
| | `shopSection` | enum | INFRASTRUCTURE | where the player finds it | S17 |
| | `joinsGlobalTrade` | bool | derived `true` | makes its map a member of the global food/waste pool — **the pool rule itself is `ECO`'s** (`FR-ECO-101`) | S16 |
| **Vehicle** | `class` | enum | CAR / TRAIN / SHIP / HELICOPTER (+ TBD classes) | the evidenced classes | S31 |
| | `path[]` | node/cell list | — | the route — the path representation is **NOT IMPLEMENTED** | S27 · OQ-MOB-08 |
| | `laneIndex` | int | — | **NOT IMPLEMENTED — reserved for a design decision; no lane layer is evidenced** | OQ-MOB-13 |
| | `speed` | float | units/s | current speed | S24 |
| | `stuckTimer` | float | seconds | time stationary | S32 |
| **Pedestrian** | `origin`, `dest` | building ids | — | the trip | S27 |
| | `sidewalkPath[]` | cell list | — | the walking route — **NOT IMPLEMENTED** | S27 · OQ-MOB-14 |
| **BusStation** | `cell` | int2 | — | placement | S15 |
| | `schoolCapacityOk` | bool | derived | `false` ⇒ the station is inactive and grants no connection | S15 |
| | `reach` | cell set | per tile | the surrounding buildings it can serve | S15, S12 |
| **OutsideConnection** | `nodeId` | string | — | a map-edge node usable as an origin/destination — **NOT IMPLEMENTED** | OQ-MOB-09 |
| **TrafficProfile** | `demandByHour` | array[24] | 0..1 | **NOT IMPLEMENTED — reserved for a design decision; no 24-hour demand curve is evidenced** | OQ-MOB-17 |
| | `spawnRate` | float | vehicles/s | trip generation rate — **NOT IMPLEMENTED** | OQ-MOB-17 |
| | `congestionPolicy` | enum | REROUTE / HOLD / DESPAWN | **NOT IMPLEMENTED — reserved for a design decision; the developer names DESPAWN as the trick he wants to avoid, so no default is set here** | OQ-MOB-16 |
| **TransportStats** | `segmentCount`, `networkLength`, `vehicleCount`, `connectedBuildingCount` | int | — | the derived statistics panel | OQ-MOB-10 |

---

## 7. Rules, formulas & tuning

### 7.1 Rules that are evidenced in the real game

| # | Rule | Formula / expression | Evidence |
| M1 | **Influence is per tile, effect is per building.** | `buildingAffected(b) = OR over tiles t of b : t ∈ influenceArea` | S12 |
| M2 | **Road tier grants connection.** | `connected(b) = OR over segments s adjacent to b : s.streetType.grantsConnection` | S3 |
| M3 | **Monorail connects residential only.** | `monorailServes(b) = (b.usage == RESIDENTIAL) AND (OR over tiles t of b : t ∈ station.influenceArea)` | S7, S9, S11 |
| M4 | **Bus-station connection is capacity-gated.** | `busStationServes(b) = busStation.schoolCapacityOk AND (b ∈ busStation.reach)`; when capacity is unmet the station is inactive and serves nothing | S14, S15 |
| M5 | **Harbor joins the map to global trade** (pool rule owned by `ECO`). | `mapInGlobalPool(m) = (m.harbors > 0)` — the accounting consequence is `ECO`'s (`FR-ECO-101`, `FR-ECO-102`) | S16, S17 |
| M6 | **Traffic advances on the simulation tick**, so speed-ups change observable traffic speed. | `trafficAdvance = tickRate × speedMultiplier`; `speedMultiplier` is raised by the watch-an-ad speed-up and by the speed-up package | S24, S25 |
| M7 | **Same space can carry decoration and monorail track.** | `occupancy(monorailCell) = MONORAIL` does not clear `DECORATION` at that cell | S8 |
| M8 | **Player can drive a car in first person.** | first-person actor may `enter(vehicle)` and then drive it along the network | S23 |

### 7.2 Rules to be decided (each has a proposed default in Section 11)

**Nothing in this table is implemented behaviour.** Every row is a *proposal* that becomes a
requirement only once its Section 11 question is decided. The lane rules (M9) and the movement rules
(M10) apply **only if** OQ-MOB-13 / OQ-MOB-11 are decided in favour of lanes and movements; if the
segment-level model is chosen instead, those two rows are dropped rather than implemented.

| # | Rule | Proposed default | OQ |
| M9 | **Lane assignment.** | choose the lane whose movement set contains the intended movement; break ties by fewest movements in the set, then by lowest index | OQ-MOB-13 |
| M10 | **Junction conflict resolution.** | first-come-first-served on the contested cell, with a deterministic tie-break on vehicle id | OQ-MOB-11 |
| M11 | **Trip generation rate.** | `spawnRate = baseRate × residentsFactor × jobsFactor × demandByHour[hour]` — the *shape* is a proposal; every coefficient and the curve itself are [TBD] | OQ-MOB-17 |
| M12 | **Congestion policy.** | re-route first; after `stuckTimeout` seconds hold the vehicle in place and raise a diagnostic — **never silently despawn**; the timeout is [TBD] | OQ-MOB-16 |
| M13 | **Pedestrian route cost.** | `cost = time + crossingPenalty`; a crossing at a junction adds a fixed penalty — the penalty value is [TBD] | OQ-MOB-14 |
| M14 | **Boat route cost.** | shortest 4-connected submerged path within one water body | — |
| M15 | **Road over a terrain step.** | a 1-layer step is ramped automatically; a 2-layer step is rejected with a message | OQ-MOB-22 |
| M16 | **Traffic-light phase cycle.** | fixed-time cycle, alternating opposing approaches; the cycle length is [TBD] | OQ-MOB-12 |

---

## 8. Edge cases, failure modes & required behaviours

| # | Case | Required behaviour | Stage | Covers |
|---|---|---|---|---|
| E1 | The player taps a cell where **no direction is legal** (surrounded, off-map, blocked). | No direction indicator is drawn and no segment is placed; the tool stays armed and the state is unchanged. | Both | FR-MOB-003, FR-MOB-005, FR-MOB-014 |
| E2 | The player taps a direction indicator and then **changes the street type** before the next tap. | The next tap places the newly selected type; the previously armed type is not reused. | Both | FR-MOB-002, FR-MOB-006 |
| E3 | A segment is **demolished while a vehicle is on it**. | The vehicle is removed safely or routed off; no vehicle is left on a missing segment. **Unevidenced** — what happens to a vehicle on a removed segment is a rebuild decision (FR-MOB-078). | Design | FR-MOB-009, FR-MOB-011, FR-MOB-078 |
| E4 | A building's only road is **demolished**. | The building immediately becomes unconnected and is reported as such. | Both | FR-MOB-032, FR-MOB-033, FR-MOB-101 |
| E5 | A segment is **re-typed** to a tier that does not grant connection. | Every building it served is re-evaluated in the same tick. | Both | FR-MOB-016, FR-MOB-033 |
| E6 | A road reaches the **map edge**. | An outside-connection node is created there, and traffic may enter and leave through it. **Unevidenced** — outside connections and map-edge nodes are a rebuild decision (OQ-MOB-09), not shipped behaviour. | Design | FR-MOB-028, FR-MOB-031 |
| E7 | A road ends in a **dead end**. | Vehicles that enter turn back at the end node; they do not despawn at the end. **Unevidenced** — dead ends and the turnaround are a rebuild decision (OQ-MOB-08). | Design | FR-MOB-030 |
| E8 | A **monorail station** is placed so that its influence area touches only the corner of a residential building. | The building counts as affected, because one touched tile is enough. | Mobile | FR-MOB-050 |
| E9 | A **monorail** is built over a field and over a decorative building. | Both remain in place and the track is laid above/beside them. | Mobile | FR-MOB-046, FR-MOB-048 |
| E10 | A commercial building stands inside a **monorail station's** area. | It receives no monorail connection. | Mobile | FR-MOB-044 |
| E11 | A **bus station** is placed with no school anywhere in the map. | It is inactive and grants no connection. | Mobile | FR-MOB-086 |
| E12 | School capacity is **increased** after a bus station went inactive. | The station reactivates on the next evaluation and resumes granting connection. | Mobile | FR-MOB-087 |
| E13 | The **Harbor is demolished**. | Its map leaves the global food and waste pool immediately and falls back to local accounting. | Mobile | FR-MOB-062 |
| E14 | The water level **rises and drains a small lake** that a boat was using. | The boat is removed cleanly with no orphaned harbour links or navigation nodes. **Unevidenced** — what happens to a boat whose route no longer exists is a rebuild decision (OQ-MOB-26). | Design | FR-MOB-060 |
| E15 | A **bridge and a tunnel** cross at the same horizontal position. | The two traffic streams never conflict. | Both | FR-MOB-092, FR-MOB-093, FR-MOB-094 |
| E16 | A road is laid **over open water**. | A bridge structure with piers is required; the water below stays open and navigable. | Both | FR-MOB-025, FR-MOB-096 |
| E17 | A road crosses a **one-layer terrain step**. | It ramps; the ramp cells come from the `WLD` layer model. | Both | FR-MOB-008, FR-MOB-095 |
| E18 | Traffic reaches a **permanent gridlock**. | The congestion policy applies; the vehicle is not silently removed and the situation is surfaced to the player. **Unevidenced** — the congestion policy is a rebuild decision (OQ-MOB-16). | Design | FR-MOB-081, FR-MOB-082 |
| E19 | The player **pauses** to inspect a busy junction. | All vehicles freeze in place and resume unchanged. **Unevidenced** — pausing a traffic simulation is a rebuild decision (OQ-MOB-16). | Design | FR-MOB-083 |
| E20 | The player **enters a car** in first person and drives it. | The car follows the road network under player control and can be left again. | Mobile | FR-MOB-072 |
| E21 | The city is **saved and reloaded**. | The network graph, layers, per-segment flags and connections return identically. **Unevidenced** — the network representation that is saved is a rebuild decision (OQ-MOB-08). | Design | FR-MOB-012, FR-MOB-103 |
| E22 | Two segments occupy **neighbouring cells** but share no node. | They are not connected and no traffic passes between them. **Unevidenced** — shared-node connectivity is a rebuild decision (OQ-MOB-08). | Design | FR-MOB-029, FR-MOB-040 |

---

## 9. Non-functional requirements

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| NFR-MOB-001 | The transport simulation shall run on a **fixed tick decoupled from the render loop**, so traffic speed is frame-rate independent and a speed-up changes traffic speed without a code change. | Must | Both | no | QA-MOB-105 | https://www.youtube.com/watch?v=ovWkwWS5FlY |
| NFR-MOB-002 | The road, rail, monorail and pedestrian graphs shall be **rebuilt incrementally** when a segment is built or demolished, never by a full-world re-simulation. The graphs themselves are Design-stage structures (OQ-MOB-08). | Must | Design | no | QA-MOB-106 | [TBD — design decision] OQ-MOB-08 · https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-MOB-003 | Every transport asset shall be **data-driven** — street types, monorail influence radii and Harbor properties live in external data, not in code — so new content ships without an engine change. This is a **rebuild architecture decision**, not an evidenced property of the shipped games. **[design decision — OQ-MOB-02]** | Must | Design | no | QA-MOB-107 | [TBD — design decision] OQ-MOB-02 |
| NFR-MOB-004 | The whole transport state — graphs, layers, per-segment flags, vehicle pool, connection state — shall be **serialisable and reloadable**, including after a long offline gap. `TEC` owns the save/load mechanism; the state it serialises is Design-stage. | Must | Design | no | QA-MOB-108 | [TBD — design decision] OQ-MOB-08 · https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-MOB-005 | Traffic shall scale to a **large city** without unbounded agent counts; the graph shall use shared segment geometry rather than per-vehicle paths where possible. The agent model this constrains is Design-stage (OQ-MOB-17). | Should | Design | no | QA-MOB-109 | [TBD — design decision] OQ-MOB-17 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| NFR-MOB-006 | The traffic model shall be **deterministic given the same tick sequence and input**, so a reported bug can be reproduced. This constrains the Design-stage traffic model, which the developer calls "still pretty open" (S32). | Should | Design | no | QA-MOB-110 | [TBD — design decision] OQ-MOB-11 · https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| NFR-MOB-007 | Connection resolution shall be **cheap enough to run on the low-spec mobile devices** the region view already targets ("not easy to do this on low speec mobile devices"). | Must | Mobile | no | QA-MOB-111 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| NFR-MOB-008 | Placing, demolishing or re-typing a segment shall update the visible network **within one tick**, so the player never sees a stale road. | Must | Both | no | QA-MOB-112 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-MOB-009 | Vehicle and pedestrian agents shall use a **pool** and be recycled, so a long session does not grow memory without bound. Conditional on the agent model being decided. | Should | Design | no | QA-MOB-113 | [TBD — design decision] OQ-MOB-16 |
| NFR-MOB-010 | The Science View transport overlay shall render **without re-simulating** the network; it reads the live graph. | Should | Mobile | no | QA-MOB-114 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| NFR-MOB-011 | Road and track geometry shall be expressed in **grid cells and integer layers only** — no metre-based or float-height representation anywhere in the transport model. | Must | Both | no | QA-MOB-115 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| NFR-MOB-012 | Every transport requirement in this document shall be covered by at least one acceptance suite in Section 10, and every acceptance suite shall state an **observable outcome**. | Must | Both | no | QA-MOB-116 | [TBD — design decision] OQ-MOB-24 |

---

## 10. Acceptance-criteria suites

| ID | Given | When | Then | Covers |
|---|---|---|---|---|
| QA-MOB-001 | The main HUD of a fresh city | The Street Building tool is opened | The tool arms and a street-type picker becomes available | FR-MOB-001 |
| QA-MOB-002 | The Street Building tool is open | A road type is chosen in the picker and the tool is closed and reopened | The same type is still the armed type | FR-MOB-002 |
| QA-MOB-003 | The Street Building tool is armed with a type selected | The player taps an empty map cell | One direction indicator is drawn for each direction that is legal at that cell | FR-MOB-003 |
| QA-MOB-004 | The direction indicators are drawn at a tapped cell | The player taps one indicator | Exactly one segment appears running in that direction, with the "Bop" feedback | FR-MOB-004 |
| QA-MOB-005 | A segment was placed next to the player | The player taps the cell again | The indicator set is recomputed and now includes the direction that leads to the new segment | FR-MOB-005 |
| QA-MOB-006 | A segment was just placed | The player taps the next cell in line without touching the picker | A second segment of the same type appears | FR-MOB-006 |
| QA-MOB-007 | The Street Building tool is armed | The player taps a cell and builds | The segment occupies whole grid cells and is aligned to the grid | FR-MOB-007 |
| QA-MOB-008 | A segment has been placed | The player inspects the segment's layer | The segment reports a layer from the ground/upper/underground layer set, never a height in metres | FR-MOB-008 |
| QA-MOB-009 | The Inventory panel is open | The bulldozer is enabled and the player taps a street | The street is removed from the map | FR-MOB-009 |
| QA-MOB-010 | The bulldozer is enabled with two of its three categories switched off | The player taps an object belonging to a disabled category | The object is left untouched and the tap has no effect | FR-MOB-010 |
| QA-MOB-011 | A building is served by a road segment | That segment is bulldozed | The segment disappears from the road network and the building is reported as unconnected | FR-MOB-011 |
| QA-MOB-012 | A street segment exists | The game is saved, reloaded and the segment is inspected | **If OQ-MOB-01 is decided as proposed:** the segment is present with the same identity and the same type | FR-MOB-012 |
| QA-MOB-013 | The mobile title is running in sandbox mode and the PC build is running its construction sandbox | The Street Building tool is opened in each | Street segments can be placed in both | FR-MOB-013 |
| QA-MOB-014 | The Street Building tool is armed | The player taps a cell at the very edge of the map | No indicator is offered for the direction that would leave the map | FR-MOB-014 |
| QA-MOB-015 | The Street Building tool is open | The player opens the type picker | More than one road type is listed | FR-MOB-015 |
| QA-MOB-016 | A building is placed beside a low-tier "muddy" road | The placement resolves | The building receives no road connection | FR-MOB-016 |
| QA-MOB-017 | A new road type is added to the catalogue as content | The game loads it | **If the catalogue is data-driven as proposed (OQ-MOB-02):** the new type appears in the picker and works without an engine change | FR-MOB-017 |
| QA-MOB-018 | A road type is defined | The developer reads its record | **If OQ-MOB-02 is decided as proposed:** the record declares tier, footprint in cells, direction mode, lanes, speed, capacity and flags | FR-MOB-018 |
| QA-MOB-019 | A road type is defined | Its footprint is inspected | **If OQ-MOB-02 is decided as proposed:** the footprint is a whole number of grid cells | FR-MOB-019 |
| QA-MOB-020 | The catalogue holds two road types | Their direction modes are compared | **If OQ-MOB-03 is decided as proposed:** the modes differ without any engine change | FR-MOB-020 |
| QA-MOB-021 | A road type is defined | Its speed and capacity are read | **If OQ-MOB-04 is decided as proposed:** both values are present on the record | FR-MOB-021 |
| QA-MOB-022 | A road type is defined | Its flags are read | **If OQ-MOB-05 is decided as proposed:** the record states whether a track may be laid on it and whether it accepts frontage zoning | FR-MOB-022 |
| QA-MOB-023 | A road segment exists | The player sets the bridge flag | **If OQ-MOB-06 is decided as proposed:** the same road type is still used and the segment is raised onto a bridge layer | FR-MOB-023 |
| QA-MOB-024 | Two road types share a geometry | The player changes the skin of one | **If OQ-MOB-07 is decided as proposed:** the skin changes without the carriageway geometry changing | FR-MOB-024 |
| QA-MOB-025 | A road type is defined | Its over-water flag is read | **If OQ-MOB-06 is decided as proposed:** the record states whether the type may be laid over water | FR-MOB-025 |
| QA-MOB-026 | The catalogue is inspected | Types are grouped by tier | At least one tier grants building connection and at least one does not | FR-MOB-026 |
| QA-MOB-027 | Two streets meet | The network is inspected | **If OQ-MOB-08 is decided as proposed:** the network exposes nodes and segments, and the shared meeting point is a single node | FR-MOB-027 |
| QA-MOB-028 | A street ends in open ground | The network is inspected | **If OQ-MOB-08 is decided as proposed:** a node of kind END exists at that street's tip | FR-MOB-028 |
| QA-MOB-029 | Two street segments occupy neighbouring cells but meet nowhere | A vehicle is routed between them | **If OQ-MOB-08 is decided as proposed:** no route exists between them and no traffic crosses | FR-MOB-029 |
| QA-MOB-030 | A street ends in a cul-de-sac | A vehicle drives to the end | **If OQ-MOB-08 is decided as proposed:** the vehicle turns back at the end instead of disappearing | FR-MOB-030 |
| QA-MOB-031 | A street runs off the edge of the map | The network is inspected | An outside-connection node exists at that edge | FR-MOB-031 |
| QA-MOB-032 | A building stands beside a connection-granting road | The connection is evaluated | The building is reported as connected | FR-MOB-032 |
| QA-MOB-033 | A building is connected by one segment | That segment is demolished | The building is reported as unconnected in the same interaction | FR-MOB-033 |
| QA-MOB-034 | A building has no road connection | The building is inspected | The panel reports that it is unconnected | FR-MOB-034 |
| QA-MOB-035 | A junction with four approaches exists | The junction is inspected | **If OQ-MOB-11 is decided as proposed:** each approach lists the movements available from it | FR-MOB-035 |
| QA-MOB-036 | A left turn is banned at a junction | A vehicle approaches wanting to turn left | The vehicle takes another movement and the ban holds on the next tick too | FR-MOB-036 |
| QA-MOB-037 | A junction exists | Its signal mode is read | The junction reports either a signalised mode with a phase or an uncontrolled mode | FR-MOB-037 |
| QA-MOB-038 | A junction has a lane serving only a left turn | A vehicle wants to go straight | **If OQ-MOB-13 is decided in favour of lanes:** the vehicle is not placed in the left-only lane | FR-MOB-038 |
| QA-MOB-039 | Two vehicles contend for the same junction cell | The junction resolves the conflict | **If OQ-MOB-11 is decided as proposed:** the outcome is deterministic and both vehicles continue | FR-MOB-039 |
| QA-MOB-040 | A building is on an isolated island of road | A trip is generated for it | **If OQ-MOB-08 is decided as proposed:** no trip is created and the building is reported as unconnected | FR-MOB-040 |
| QA-MOB-041 | The world contains a railway | The network inspector is opened | A railway network exists that is separate from the road network | FR-MOB-041 |
| QA-MOB-042 | A railway with a train on it runs | The world is observed | The train travels along the railway and is visible | FR-MOB-042 |
| QA-MOB-043 | A monorail station stands with residential buildings inside its area and no streets at all | The connection is evaluated | The residential buildings are connected to the transport system | FR-MOB-043 |
| QA-MOB-044 | A commercial and an industrial building stand inside a monorail station's area | The connection is evaluated | Neither building receives a monorail connection | FR-MOB-044 |
| QA-MOB-045 | A monorail station exists | The station is inspected | It reports an influence area | FR-MOB-045 |
| QA-MOB-046 | A field and a decorative building lie in the monorail's path | The monorail is built | The track is laid over the field and across the decorated space, and neither is removed | FR-MOB-046 |
| QA-MOB-047 | A monorail track exists | The world is observed | A monorail train runs the track and is visible | FR-MOB-047 |
| QA-MOB-048 | A monorail crosses a square that already carries decoration | The square is inspected | Both the decoration and the monorail are present on the same ground | FR-MOB-048 |
| QA-MOB-049 | Several monorail stations exist | The Science View is opened and the monorail category is selected | Every station is listed with the area in which it provides residential street connection | FR-MOB-049 |
| QA-MOB-050 | A residential building's corner tile touches a monorail station's area | The connection is evaluated | The whole building counts as affected | FR-MOB-050 |
| QA-MOB-051 | A monorail track is elevated | Its geometry is inspected | The track sits on an integer layer above the ground layer | FR-MOB-051 |
| QA-MOB-052 | The PC build is running | The monorail assets are opened | Monorail track and stations are offered and grant residential street connection | FR-MOB-052 |
| QA-MOB-053 | A map has an open sea and a bay | The world is observed | Boats travel on the water | FR-MOB-053 |
| QA-MOB-054 | A harbour and a ship exist in the city | The world is observed | The ship moves through the city as a class distinct from cars and trains | FR-MOB-054 |
| QA-MOB-055 | Two water bodies are separated by land | A boat is routed from one to the other | The boat does not cross the land; it stays on its own body | FR-MOB-055 |
| QA-MOB-056 | The building shop is opened | The infrastructure section is selected | The Harbor is listed there | FR-MOB-056 |
| QA-MOB-057 | A region holds two maps | A Harbor is placed on the first map | The first map carries the region's trade connection, and the global food and waste pool rule stays with the economy domain | FR-MOB-057 |
| QA-MOB-058 | A Harbor placement is attempted | The placement is validated | The placement is accepted or refused according to the Harbor's placement rule, and the reason is shown | FR-MOB-058 |
| QA-MOB-059 | A Harbor stands on the water's edge | The world is observed | Ships dock at the Harbor and sail from it | FR-MOB-059 |
| QA-MOB-060 | A boat is on a lake and the water level drops until the lake drains | The lake drains | **If OQ-MOB-26 is decided as proposed:** the boat is removed cleanly and no orphaned harbour link remains | FR-MOB-060 |
| QA-MOB-061 | A Harbor has been placed | The economy panel is opened for food | The map shows as globally connected and the globe icon is present | FR-MOB-061 |
| QA-MOB-062 | A Harbor has been placed and its map is in the global pool | The Harbor is demolished | The map leaves the pool immediately and returns to local accounting without a reload | FR-MOB-062 |
| QA-MOB-063 | The PC build is running | The infrastructure section of the building shop is opened | The Harbor, the C-wire and the water pipeline are offered | FR-MOB-063 |
| QA-MOB-064 | A city has road traffic | The world is observed | Helicopters move above the road traffic | FR-MOB-064 |
| QA-MOB-065 | Helicopters are present | Their movement is inspected | The helicopters follow a defined route rather than moving arbitrarily | FR-MOB-065 |
| QA-MOB-066 | The road network is gridlocked | The helicopter traffic is observed | The helicopters continue to move, unaffected by the congestion below | FR-MOB-066 |
| QA-MOB-067 | A city has streets | The world is observed at street level | Pedestrians walk on the sidewalks | FR-MOB-067 |
| QA-MOB-068 | A square is crossed by a street | The world is observed at street level | Pedestrians cross the street to reach the other side | FR-MOB-068 |
| QA-MOB-069 | A stretch of street has no sidewalk | A pedestrian route is requested across it | No pedestrian route exists across that stretch | FR-MOB-069 |
| QA-MOB-070 | Connected buildings exist | The world is observed at street level | **If OQ-MOB-14 is decided as proposed:** pedestrians leave the connected buildings and walk toward destinations | FR-MOB-070 |
| QA-MOB-071 | The camera is fully zoomed in | The player zooms in once more | The view enters first person, and the exit button returns to the camera | FR-MOB-071 |
| QA-MOB-072 | The player is in first person beside a moving car | The player enters the car | The player drives the car along the streets and can leave it again | FR-MOB-072 |
| QA-MOB-073 | The game is in first person | The settings screen is opened | A first-person sensitivity value is present and adjustable | FR-MOB-073 |
| QA-MOB-074 | A city has a connected road network | The world is observed | Cars travel along the streets and turn at junctions | FR-MOB-074 |
| QA-MOB-075 | Traffic is running and the player triggers a speed-up | The world is observed | The traffic moves faster than before the speed-up | FR-MOB-075 |
| QA-MOB-076 | The world is observed | The vehicle classes present are listed | Cars, trains, ships and helicopters are present | FR-MOB-076 |
| QA-MOB-077 | The vehicle catalogue is inspected | The classes are listed | Only the four evidenced classes are present unless more have been decided | FR-MOB-077 |
| QA-MOB-078 | A car drives to its destination | It arrives | **If OQ-MOB-17 is decided as proposed:** the car leaves the world and its slot is reused | FR-MOB-078 |
| QA-MOB-079 | The city gains residents and jobs | The traffic volume is compared | **If OQ-MOB-17 is decided as proposed:** the number of vehicles on the road is higher than before | FR-MOB-079 |
| QA-MOB-080 | The clock runs through a full day | The traffic volume is sampled hour by hour | **If OQ-MOB-17 is decided as proposed:** some hours are visibly busier than others | FR-MOB-080 |
| QA-MOB-081 | A junction is blocked so that traffic cannot clear | The simulation runs | The network does not settle into one permanent gridlock | FR-MOB-081 |
| QA-MOB-082 | A vehicle has been stationary for a long time | The threshold is reached | The vehicle is handled by the congestion policy and the situation is surfaced rather than hidden | FR-MOB-082 |
| QA-MOB-083 | Traffic is running | The player pauses the simulation | **If OQ-MOB-16 is decided as proposed:** every vehicle freezes in place and resumes unchanged | FR-MOB-083 |
| QA-MOB-084 | An empty map area exists | A bus station is placed | The bus station is placed and stands in the world | FR-MOB-084 |
| QA-MOB-085 | A bus station stands far from any school | The connection is evaluated | The buildings around the bus station receive school connection | FR-MOB-085 |
| QA-MOB-086 | A bus station is granting school connection and the city runs out of school capacity | The capacity is exceeded | The bus station goes inactive and stops granting school connection | FR-MOB-086 |
| QA-MOB-087 | A bus station is inactive for lack of school capacity | A school with spare capacity is added | The bus station reactivates and grants connection again | FR-MOB-087 |
| QA-MOB-088 | A bus station is inactive | The station is inspected | The station is shown as inactive | FR-MOB-088 |
| QA-MOB-089 | A transit line is created | Its properties are opened | The line exposes stops, vehicle count, fare and colour | FR-MOB-089 |
| QA-MOB-090 | A tram alignment is authored | The alignment is inspected | It is clear whether the track shares the carriageway or is reserved | FR-MOB-090 |
| QA-MOB-091 | Two districts are separated by water | The player connects them | A bridge, a tunnel or a railway is available as the connection | FR-MOB-091 |
| QA-MOB-092 | A bridge exists over water | Its geometry is inspected | The deck is placed on an explicit layer and the water beneath is unchanged | FR-MOB-092 |
| QA-MOB-093 | A tunnel is authored beneath a road | The world is inspected | The tunnel runs on an underground layer with clearance and the road above is unaffected | FR-MOB-093 |
| QA-MOB-094 | A bridge and a tunnel cross at the same horizontal position | Both carry traffic | The two traffic streams never conflict | FR-MOB-094 |
| QA-MOB-095 | A road is laid across a one-layer terrain step | The road is committed | The road ramps onto the next layer instead of failing or floating | FR-MOB-095 |
| QA-MOB-096 | A road is laid over open water | The road is committed | A bridge structure with piers is created and the water below stays open | FR-MOB-096 |
| QA-MOB-097 | The player builds a road on uneven ground | The road's layer is inspected | The road sits on the surface layer of the cells it occupies | FR-MOB-097 |
| QA-MOB-098 | A street segment exists | The player bulldozes it and builds a new one in the same place | The new segment occupies the same cells and the network works as before | FR-MOB-098 |
| QA-MOB-099 | A Harbor has been placed | The player long-presses it | The orbit-mode interaction opens with move and rotate available | FR-MOB-099 |
| QA-MOB-100 | SCC Studio is opened | The customisable asset list is read | Vehicles are listed and roads, tracks and stations are not | FR-MOB-100 |
| QA-MOB-101 | A building is served by one road segment | The segment is bulldozed | The building immediately reports that it is unconnected | FR-MOB-101 |
| QA-MOB-102 | A segment has been re-typed | The player re-builds the same cells with the previous type | The original network state is restored exactly | FR-MOB-102 |
| QA-MOB-103 | A city with roads, rail, a monorail and a Harbor | The game is saved, reloaded and the world inspected | The network, layers, flags and connections are identical | FR-MOB-103 |
| QA-MOB-104 | A city exists | The transport statistics are read | **If OQ-MOB-10 is decided as proposed:** segment count, network length, vehicle count and connected-building count are reported | FR-MOB-104 |
| QA-MOB-105 | Traffic is running | The frame rate drops and recovers | The traffic advances at the same simulation rate regardless of frame rate | NFR-MOB-001 |
| QA-MOB-106 | A large city with a long road network | One segment is demolished | The graph updates in place and no full re-simulation occurs | NFR-MOB-002 |
| QA-MOB-107 | A new street type is added as content | The game loads it | No code change was needed for the type to work | NFR-MOB-003 |
| QA-MOB-108 | A city with transport is saved | The game is closed and reopened | The transport state returns identically | NFR-MOB-004 |
| QA-MOB-109 | A city grows to a large size | The simulation runs | The agent count stays bounded and the city remains responsive | NFR-MOB-005 |
| QA-MOB-110 | A traffic jam is produced twice from the same starting state | The two runs are compared | The vehicle behaviour is identical | NFR-MOB-006 |
| QA-MOB-111 | A low-spec mobile device is running the game | A road is built | The connection update completes without a visible stall | NFR-MOB-007 |
| QA-MOB-112 | A segment is demolished | The world is observed immediately | The road is gone from the world with no stale geometry | NFR-MOB-008 |
| QA-MOB-113 | A long session runs with heavy traffic | The memory use is watched | Memory does not grow without bound | NFR-MOB-009 |
| QA-MOB-114 | The Science View monorail category is opened | The overlay renders | The overlay appears from the live graph and the simulation is unaffected | NFR-MOB-010 |
| QA-MOB-115 | The whole transport model is reviewed | Every geometric value is inspected | Heights are integer layers and footprints are whole cells, with no metre-based value anywhere | NFR-MOB-011 |
| QA-MOB-116 | This document is reviewed against Section 10 | Every FR is mapped to a suite and every suite is read | Each requirement has at least one suite and each suite names a visible outcome rather than a requirement id | NFR-MOB-012 |

---

## 11. Open questions & TBDs

**Every question below is unresolved.** Each row is a decision the rebuild must take before the
behaviour it governs can be specified; the **Proposed default** column is a *proposal*, never a claim
about the shipped game. Where a value is not evidenced it is written **[TBD]** — no number in this
document is invented. Answering a question closes the `[design decision — OQ-MOB-NN]` marker on the
rows that depend on it.

| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| OQ-MOB-01 | Do street segments need a **player-visible identity** (a name, an address) or only an internal id? | Save/load, building connection and transit all need to reference a segment; a player-visible name adds a UI surface and a naming scheme. | **Internal stable id only.** No player-visible street names in the first rebuild; expose the id in the debug inspector. If a player-visible name is wanted, the naming scheme is **[TBD]**. |
| OQ-MOB-02 | What is the exact **road-type record schema**, and how wide is a carriageway in cells? | Lane geometry, connection and the tier rule all read from this record. Without a cell-based width there is no way to keep the voxel model consistent. | One **data-driven record per type**, consumed by authoring, simulation and UI. The **tier count and names, the footprint width and every other field value are [TBD]**; the only evidenced rule is that at least one tier grants building connection and at least one does not. |
| OQ-MOB-03 | Which **direction modes and lane counts** are in the first catalogue? | Determines the picker contents and the lane-assignment rule. | Direction modes are **[TBD]** and lane counts per direction are **[TBD]**. No source names any mode or count; two-way is the simplest candidate but is not evidenced. |
| OQ-MOB-04 | What are the **speed limits and per-lane capacities**? | Congestion, travel time and trip generation all depend on them. | Speed steps per tier and per-lane capacity are both **[TBD]**. No speed or capacity value is evidenced anywhere. |
| OQ-MOB-05 | Which roads accept a **track**, and which accept **zoned frontage**? | Decides whether roads and rail can share cells and whether frontage zoning is possible at all. | Track acceptance and frontage-zoning acceptance per road type are both **[TBD]**. |
| OQ-MOB-06 | Is the bridge/tunnel state a **per-segment flag** or a separate road type? | Affects the picker, the upgrade path and the network graph. | Per-segment flag, so one type covers grade and elevated use. **[TBD]** — this is a proposal; bridges and tunnels are evidenced, the flag layout is not. |
| OQ-MOB-07 | Is a **road skin / surface variant** system needed? | Cosmetic only, but it multiplies the catalogue. | One skin per tier to start; no per-lane skins. **The skin list is [TBD]**. |
| OQ-MOB-08 | Is connectivity defined by **shared node** only, and how are dead ends represented? | A wrong definition produces phantom connections that silently break the building-connection rule. | Shared node only; dead ends are nodes of kind END; traffic turns back there. **Whether the network is a node/segment graph at all, how dead ends are represented and the turnaround behaviour are [TBD]** — this single decision governs FR-MOB-027 to FR-MOB-030 and FR-MOB-040. |
| OQ-MOB-09 | Do **outside connections** exist — road stubs at the map edge that generate through-traffic? | If the answer is yes they need a spawning model; if no, traffic is limited to intra-city trips. | Implement as map-edge nodes, but keep the through-traffic volume at 0 until a trip model justifies it. **Whether outside connections exist at all, and the through-traffic volume, are [TBD]**. |
| OQ-MOB-10 | How are **unconnected buildings** surfaced to the player? | Without a signal the player cannot tell why a building is not working. | Show an "unconnected" marker on the building and a count in the transport statistics. **The marker, the panel and the statistics are [TBD]**. |
| OQ-MOB-11 | What is the **junction movement model**, and do turn bans exist in the first rebuild? | It is the core of any traffic simulation and the easiest place to introduce a phantom rule. | Movement sets per approach; turn bans are a per-junction exclusion list the player can edit. **Whether a movement model exists at all, the conflict-resolution rule and the tie-break are [TBD]**. |
| OQ-MOB-12 | Are junctions **signalised by default**, and what is the phase cycle? | Signals dominate junction throughput and the player experience of traffic. | Fixed-time cycle, alternating opposing approaches. **The cycle length is [TBD]**; whether junctions are signalised by default is undecided. |
| OQ-MOB-13 | Are **lanes** and lane movement sets real, or does traffic use whole segments? | Lane-level rules make the simulation much heavier but give the player real control. | Segment-level movement sets in the first rebuild; lanes added only when turn bans ship. **The lane model itself is [TBD]** — if it is rejected, FR-MOB-038, the `lanesPerDirection` / `laneCapacity` / `laneIndex` fields and rule M9 are dropped rather than built. |
| OQ-MOB-14 | What is the **pedestrian network** and the pedestrian routing cost? | Pedestrians are evidenced but their graph is not described anywhere. | Sidewalk graph along the road footprint; cost = time + a fixed crossing penalty. **The graph shape and the penalty value are [TBD]**. |
| OQ-MOB-15 | Which **vehicle classes** beyond cars, trains, ships and helicopters exist? | The four evidenced classes do not cover freight, buses or service traffic. | Ship the four evidenced classes only; add freight and buses when the modes are designed. **Any further class is [TBD]**. |
| OQ-MOB-16 | What is the **congestion policy** for a permanently stuck vehicle? | The developer explicitly wants to avoid the despawn trick, so the default must be chosen deliberately and surfaced. | Re-route first; then hold the vehicle and raise a visible diagnostic. Never despawn silently. **The `stuckTimeout` value is [TBD]**. |
| OQ-MOB-17 | What are the **trip generation rate** and the **time-of-day demand curve**? | Traffic volume is the single most visible output of the system. | `spawnRate = base × residentsFactor × jobsFactor × demandByHour`, with a morning and evening peak. **Every coefficient, the peak times and the curve itself are [TBD]**; no demand curve is evidenced in any source. |
| OQ-MOB-18 | Do **transit lines** (stops, fares, vehicle counts, colours) exist, and how do they interact with a bus station? | A bus station is evidenced; a line network on top of it is not. | No lines in the first rebuild; the bus station stays a connection asset. **Stops, fares, vehicle counts and colours are [TBD]**. |
| OQ-MOB-19 | Do **tram tracks** exist, and are they reserved or shared? | Affects the road-type flags and the lane model. | No trams until OQ-MOB-15 adds a tram class. **The shared-vs-reserved question stays [TBD]**. |
| OQ-MOB-20 | What is the **Harbor's placement rule**, and do ships dock and carry cargo? | Determines whether the Harbor is buildable anywhere and what it does physically. | Proposal: must touch navigable water; ships dock at the Harbor; cargo moves to industry. **The rule itself is [TBD]** — the Harbor's existence and shop section are evidenced, its placement rule is not. |
| OQ-MOB-21 | How do **helicopters** route, and do they need landing pads? | The class is evidenced in the demo but nothing describes its behaviour. | Cosmetic circling routes between map points; no landing pads. **The route shape is [TBD]**. |
| OQ-MOB-22 | What is the **road-over-terrain-step rule**, and how is an elevated monorail layered? | `WLD` owns the terrain; `MOB` owns the rule that turns it into a legal or illegal road. | A 1-layer step ramps; a 2-layer step is rejected with a message. Monorail runs on layer `1` above ground. **The step thresholds are [TBD]**. |
| OQ-MOB-23 | Should the **PC title** ship the monorail and the Harbor with the same rules as the mobile title? | The PC build is a construction sandbox today; the mobile behaviours are the reference implementation. | Yes — parity for the monorail residential-connection rule and the Harbor trade anchor; parity for the pool rules is `ECO`'s call. **Whether parity ships at all is [TBD]**. |
| OQ-MOB-24 | Is there an **undo/redo** for transport edits, and how is a transport edit reversed? | Rebuilding by hand is error-prone once a network is large. | No undo in the first rebuild; reversibility is provided by re-building the same cells with the previous type. **[TBD]** — no undo is proposed for the first rebuild. |
| OQ-MOB-25 | Which parts of the **visible traffic in the shipped games** are the shipped model, and which may a rebuild replace? | Traffic demonstrably exists in both products (S27, S31) and yet no source describes the model behind it. Until this is answered, every lane / junction / pathfinding rule in this document must stay `Design`-stage and must not be scheduled as if it were the game's behaviour. | Treat only the evidenced behaviours — traffic on the streets, drivable cars, tick-scaled speed, and trains / ships / helicopters as distinct classes (S23–S25, S27, S31) — as the shipped contract. Treat the whole lane / junction / pathfinding layer as a rebuild decision until the developer documents it. **[TBD]** — any replacement that changes observable traffic behaviour needs a decision of its own. |
| OQ-MOB-26 | When a **water-level change invalidates a boat's route**, what happens — re-route, dock, or remove? | `WLD` owns the water navigation graph; `MOB` owns what a boat does when its path stops existing, and no source describes it. | Proposal: re-route if a path still exists, otherwise remove the boat cleanly with no orphaned harbour links. **The behaviour and its trigger are [TBD]**. |

---

## 12. Source list

| # | URL | What it gave us | Retrieved |
| 1 | https://www.youtube.com/watch?v=jYAD0SkDmY0 | **The Basics** transcript — the Street Building tool (type picker, per-tap direction indicator, "Bop"), the bulldozer and its three categories, the "muddy roads won't give Road connection" tier rule, building snap-to-street, zoom → walk mode → region view, first-person sensitivity, speed-up button and package, construction times in minutes. | 2026-10-23 |
| 2 | https://www.youtube.com/watch?v=71H1tU2DGz8 | **Monorails** transcript — monorail grants street connection to residential buildings without streets; built over fields and across decorative buildings; commercial and industrial unaffected; the monorail train running the track. | 2026-10-23 |
| 3 | https://www.youtube.com/watch?v=c3L7Qo8fdIM | **Science View** transcript — the monorail category listing stations and their connection areas; the per-tile influence rule; the bus-stop contribution to school connection and its capacity deactivation. | 2026-10-23 |
| 4 | https://www.youtube.com/watch?v=PifQ_7vj7Ao | **Education System** transcript — bus stations provide school connection to surrounding buildings, may be placed anywhere, deactivate when school capacity is unmet and reactivate when capacity is restored. | 2026-10-23 |
| 5 | https://www.youtube.com/watch?v=m5O-A33wQm0 | **Connected Economies** transcript — the Harbor in the infrastructure section, each Harbor-bearing map joining the global system, the globe icon and global numbers; C-wire and water pipeline as the parallel connectors. | 2026-10-23 |
| 6 | https://www.youtube.com/watch?v=y5g7xPHzj0A | **Energy Supply** transcript — the C-wire's cross-map energy purpose, confirming the Harbor/C-wire/pipeline connector family. | 2026-10-23 |
| 7 | https://www.youtube.com/watch?v=yuLUP_ELk4I | **Water Supply** transcript — the water pipeline as a multi-map connector rather than a producer. | 2026-10-23 |
| 8 | https://www.youtube.com/watch?v=ovWkwWS5FlY | **Camera Modes** transcript — autographic vs perspective cameras and the 55° rotation snap, the first-person camera, jumping into a car and driving it, the red-cross exit, and the observation that traffic speed follows the simulation speed-up. | 2026-10-23 |
| 9 | https://www.youtube.com/watch?v=vBJdlAeLn0g | **Switching Maps** transcript — region view, the active map marked blue, the fading region lines, the map-switch confirmation popup, and the low-spec mobile performance constraint. | 2026-10-23 |
| 10 | https://www.youtube.com/watch?v=6Jd2kyaEZbM | **In 30 seconds** — "huge maps and regions", "build freely no restrictions", walk mode. | 2026-10-23 |
| 11 | https://www.youtube.com/watch?v=bOPESpVGXOU | Official Steam announcement video confirming the PC release intent. | 2026-10-23 |
| 12 | https://store.steampowered.com/app/3474890/SuperCitycon/ | PC store page — "Flexible Roads & Railways … different road types, bridges and tunnels", "build roads and railways", "traffic move through your streets, pedestrians follow the sidewalks, trains travel along your railways and boats navigate the waterways", the construction-sandbox Early Access scope, and the SCC Studio customisable list (buildings, vehicles, citizens, props — not roads). | 2026-10-23 |
| 13 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 | Steam demo announcement — "on top of road traffic there are trains, helicopters and ships moving through your city", no economy in the demo, built for performance and scale. | 2026-10-23 |
| 14 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ | Steam "People Simulation" thread — the dev's own words that traffic is especially tricky, that he wants to avoid the "removing cars after they have been stuck" trick, and that the model is still open; the planned RCI / resource-management / tycoon modes. | 2026-10-23 |
| 15 | https://supercitycon.net/ | Official site — "Shape the land, lay the first road", "Traffic passes the corner café. People cross the square.", and the statement that the mobile title is a separate game from the Steam title. | 2026-10-23 |
| 16 | https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ | Dev post — the monorail gives street connection to surrounding buildings, and SCC Studio output integrates into gameplay with automatic cost and economic-impact calculation. | 2026-10-23 |
| 17 | https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ | Third-party mobile guide — buildings and facilities do not function without proper connection of routes, and must be well connected with the roads. | 2026-10-23 |
| 18 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 | App Store listing — Region View integrating multiple maps into one region, and Street View walking through the city. | 2026-10-23 |

**How the Steam store page (source 12) may and may not be used.** It is cited **only** for the
existence of the feature families its own blurb names — roads, railways, traffic moving through the
streets, pedestrians on the sidewalks, trains on the railways, boats on the waterways, bridges and
tunnels, the construction-sandbox scope, and the SCC Studio customisable-asset list. It is **never**
cited as the source of a graph schema, a lane model, a speed or capacity value, a junction rule, a
pathfinding or rerouting policy, or a demand curve. Every rule of that kind in this document is a
`Design`-stage decision that points at a Section 11 open question instead.

**Sources deliberately rejected for this domain:** `youtube.com/watch?v=ZVslYTb-a2M` (Cities: Skylines 2 — "Biffa Plays Indie Games") and
`youtube.com/watch?v=0SzCY7BFC8A` (Cities: Skylines — "UrbanLoon"). Both are in the source ledger as
`FOREIGN` and neither is cited anywhere in this document. Every mechanic that only those two videos
showed — Anarchy mode, metre-scale deck heights, purchasable map tiles, 10/50-vehicle bus depots, tram
capacity 380, ticket prices, 1–7 lane road types, the traffic-routes overlay, lane movement arrows,
traffic-light removal, crosswalk editing, turn bans as shipped features, roundabouts, road naming,
freight roads and road hierarchies — has been **deleted** or reintroduced only as an explicitly marked
`[TBD — design decision]` with no foreign URL.
