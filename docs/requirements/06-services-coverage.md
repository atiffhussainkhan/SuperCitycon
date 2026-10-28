# CITY SERVICES, COVERAGE & SERVICE BUILDINGS — SuperCitycon Requirements
> Bot: BOT-06 · Domain code: SRV · Status: COMPLETE
> Sources consulted: 15 distinct URLs · Requirements: 106 FR / 12 NFR / 93 QA
>
> **Remediation note (requirement-level audit, 2026-10-23).**
> - **FR-SRV-093…097** were labelled "DESIGN EXTENSION" but were still **Must** requirements. They are now
>   **`Could` / Stage `Design` / `[TBD — design decision]`**, which is what S40 already said plainly: no
>   emergency dispatch is documented anywhere in the shipped title. New open question **OQ-SRV-26** records
>   that the rebuild's default is **no dispatch subsystem**.
> - **The residential police coverage figure** was read out of a mis-captioned "7 c %" as "71 %". The figure is
>   now **[TBD]** (S6, QA-SRV-025, OQ-SRV-24); only the unambiguous 92 % / 93 % figures are asserted.
> - **Harbor / C-Wire / water-pipeline semantics** are no longer restated here: `ECO` owns the pool and
>   membership rules, `MOB` owns the buildings and their transport behaviour, and this document references them.
>   **The Harbor is a per-map membership token and the pool it joins is region-wide**, so QA-SRV-075 now first
>   establishes that **both maps own a Harbor** before asserting pooled figures, and the new **QA-SRV-093**
>   covers the negative case (a map that owns no Harbor is not a member and keeps local figures).
> - The §12 **search-engine query URL** (`lite.duckduckgo.com`) has been deleted and the source list
>   renumbered contiguously; it was a search route, not a source document.

## 0. Scope
- **In scope:** the full service catalogue the game exposes — **security/police, fire protection, health care, school/education, parks/leisure/recreation** and **waste management** — plus the *spatial* role of **power/water/food supply** where it produces a service coverage circle or a radius-bonus field (their economy is `ECO`'s). The **coverage model** (radius, footprint shape, tile-influence rule, obstacles, road-connectivity requirement), the **coverage circle** rendering in the government panel and in Science View, the **"not fully developed"** partial-coverage state, **capacity vs. local coverage** as two distinct metrics, **service demand scaling with population**, **service building tiers / upgrades**, **emergency dispatch**, **building / removing / relocating** service assets and the resulting coverage recomputation, and the **waste collection chain incl. Harbor global pooling**.
- **Out of scope (owned elsewhere, referenced not specified):** economy cost/tax numbers and the 90 %/100 % usage-growth rule's economic side (**BOT-04 `ECO`**); happiness, City Score, Mayor Score formulas and the six residence bonuses (**BOT-05 `POP`**); building catalogue content, tier ladders, shop/inventory/demolition UI (**BOT-07 `BLD`**); HUD and panel layout (**BOT-09 `UX`**); road routing and traffic (**BOT-03 `MOB`**); terrain and the tile grid (**BOT-02 `WLD`**); voxel editor and Workshop (**BOT-08 `STD`**); stage/unlock model (**BOT-01 `CORE`**); rendering, perf, save/load (**BOT-10 `TEC`**).
- **Boundary rule:** this document owns *what a service building covers, how coverage is computed, shown, and what breaks when it is missing*. Where a service produces a number (income bonus, happiness delta, waste tonnage), the number belongs to `ECO`/`POP`; this document states the **service-side quantities** they consume (covered-building counts, coverage ratios, spare capacity).

## 1. Observed behaviour (evidence)

### 1.1 Source findings
| # | Finding | Status | Source URL |
|---|---|---|---|
| S1 | **Police is decorative + bonus only**: "at this point of development it has only a decoration and bonus character… since there is no crime happening in Super Citycon it's the safest place you can imagine". | [CONFIRMED] | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| S2 | Two police buildings exist: a **big "Police Department"** and a **small "police station"**. | [CONFIRMED] | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| S3 | Police coverage pays a **bonus**, and the bonus is maximised by covering the **whole city**: "to get the bonuses you need to cover your full city at best". | [CONFIRMED] | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| S4 | A building's card shows **coverage icons**; greyed-out icons mean **not covered**. Icons exist for **police, fire and all three education levels**. | [CONFIRMED] | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| S5 | **Science View** (mini-map button, top right) is the coverage inspector. Choosing *police* shows all police stations in **orange** and the covered area in a **purple / purish-blue** field; tapping one station shows **that station's area of effect alone**. | [CONFIRMED] | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| S6 | Government → **security** panel reports **local coverage per building category**: "7 c% of your residential buildings are covered, 92% of the commercial and 93% of the industrial ones". Commercial **92 %** and industrial **93 %** are unambiguous; the **residential** figure is rendered by the auto-caption as "7 c %" and is therefore **[TBD]** — it is not readable and is not guessed (OQ-SRV-24). | [CONFIRMED] (commercial, industrial) / [TBD] (residential) | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| S7 | "ideally you have 100 % everywhere — this gives you the maximum bonus and has the maximum effect on your happiness and with that on your mayor score". | [CONFIRMED] | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| S8 | Fire: a **fire department** building; **every building inside its fire-protection area receives a bonus**. | [CONFIRMED] | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| S9 | Fire coverage is checked on the **orbit-mode building card**: "if that one is not greyed out it means that building is covered" (polarity opposite to S4 — see OQ-SRV-05). | [CONFIRMED] | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| S10 | Science View → *fire*: departments in **orange**, covered area in **red**; tapping a department isolates **its** area of effect. | [CONFIRMED] | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| S11 | Government → **fire** tab reports **local coverage for residential / commercial / industrial**; 100 % is the target. | [CONFIRMED] | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| S12 | Health care has **two building types**: the **Hospital** ("upgradeable… has multiple levels") and the **Medical Center** ("cheaper and I think it unlocks earlier but it also has a smaller area of effect"). | [CONFIRMED] | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| S13 | Health care deploys **"emergency wagon"**-style vehicles that are found in the city. | [CONFIRMED] | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| S14 | Government → **healthcare** tab has **two measures**: **capacity** ("you need enough capacity for your current residence amount") and **local coverage** ("the local availability"). Observed capacity **60 %** on the demo city. | [CONFIRMED] | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| S15 | Science View → *healthcare*: the **green** area is covered, the **white** area is not. | [CONFIRMED] | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| S16 | Education has **three school levels**: **Elementary School**, **Secondary School** and **University**. | [CONFIRMED] | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| S17 | A school has **both an area of effect and a capacity**. The demo Elementary School was at **level 5**, and at that level "it's good for **1 million residents**", connecting residential buildings "within an area of **23 by 23**". | [CONFIRMED] | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| S18 | Secondary schools and the university behave identically but have "a little bit bigger radius… and they have more capacity"; the university has "a really huge area". | [CONFIRMED] | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| S19 | **Bus stations** provide school connection to surrounding buildings; they do **not** have to be built next to a school and "do not expand" the school area. | [CONFIRMED] | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| S20 | Bus stations **deactivate** when school capacity is insufficient and **re-activate** as soon as capacity is increased: "the bus stations will deactivate and will no longer provide connection to the school system". | [CONFIRMED] | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| S21 | Education has **bonus buildings** (named: **library**, **art museum**) that "improve the quality of your school". | [CONFIRMED] | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| S22 | As of v2.1.2 education currently yields only an **income bonus** for covered residential buildings: "at this point education has no further effect… that may change in the future". | [CONFIRMED] | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| S23 | The demo city could be **capacity-wise fully covered** for education yet "many residents don't have access to schooling because there is no bus stations and no school around them". | [CONFIRMED] | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| S24 | Waste shop category (lower end of the shop) contains **Landfill**, **Recycling Station** and **Waste Incineration** (a "PowerUp blend"). | [CONFIRMED] | https://www.youtube.com/watch?v=HDjaWySDKOM |
| S25 | **Landfill** is cheap and "your waste… magically… will disappear there". **Recycling Station** "reduces your waste", is more expensive and is **upgradeable**. **Waste Incineration** burns waste **for energy**, produces **energy** for the city, and "creates a lot of pollution… put it into your industrial areas". | [CONFIRMED] | https://www.youtube.com/watch?v=HDjaWySDKOM |
| S26 | Government → **waste** reports **production per building category** — residential, commercial, industrial, **government** and **farms** — and the **removal** figure. | [CONFIRMED] | https://www.youtube.com/watch?v=HDjaWySDKOM |
| S27 | Science View categories observed: farm area, farm bonuses, **pollution**, industrial bonus, commercial bonus, **school** (per school category + school bonus buildings), **fire / security / fire protection area**, **healthcare**, residential income bonus, **monorail**. Orange = the buildings that provide/emit the selected thing; selecting one building highlights **only its** area of effect in a slightly different shade. A **question-mark** notification at top-centre explains the selected item. | [CONFIRMED] | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| S28 | **The one-tile influence rule is universal**: "if one tile of a building is affected by an influence — and that's true for all of them — all the building counts as affected". | [CONFIRMED] | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| S29 | Government section exposes one overview per category: **electricity, water, food, waste management, healthcare, police, fire, education**. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S30 | The top bar has **two blocks**: a **building-demand block** (full = you need more of that type) and an **economy-usage block** (keep low). Observed: food production **82 %** (shortage soon), energy **56 %** (fine), water huge, waste "perfectly fine". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S31 | **Connectable economies**: food supply, **waste management**, water, energy supply. A **Harbor** on a map connects it to the **global system** for food **and waste**; the economy panel then shows a **globe icon** and **global numbers**. **C-Wire** connects energy, **Water Pipeline** connects water. Harbor lives in the **infrastructure** shop section. | [CONFIRMED] | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| S32 | Government overview shows the six residence bonuses — **culture, entertainment, recreation**, wealth, diversity, loyalty — and parks are the main **recreation points** contributor. | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| S33 | Recreation points use the shared rule: **1 point per 1 000 residents**, **250 %** cap per category; buildings carry a "+" marker when several instances each contribute, and **unique** buildings count once per map. | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| S34 | App Store listing: **"KEEP CITIZENS HAPPY: Maintain the perfect balance of services and leisure"** — services and leisure are the two citizen-facing levers. 300+ structures. | [CONFIRMED] | https://itunes.apple.com/lookup?id=1607860732&country=us |
| S35 | PC title (Steam 3474890) Early Access launches as a **construction sandbox**; "Economy and progression systems are not yet included" (per the shared brief). Store page: "Early Access begins with a construction sandbox"; release **Q4 2026**; dev **Sunapie Games**. | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| S36 | The official site states the mobile title "is a separate game from SuperCitycon on Steam" — service simulation is a **mobile-title** system today. | [CONFIRMED] | https://supercitycon.net/ |
| S37 | Steam Community for app 3474890 has forums *General Discussions* (7 topics), *Suggestions & Feedback* (1), *Show your City*, *Events & Announcements* (2) — **no service/utility thread exists**, so no PC-side service rule is published. | [CONFIRMED] | https://steamcommunity.com/app/3474890/discussions/ |
| S38 | Bonus buildings of the food chain (e.g. **silos**) give a bonus **within a surrounding area** but do **not** affect industrial food production — the game's generic "silo-style radius bonus building" pattern. | [CONFIRMED] | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| S39 | The government panel's coverage circles are read as: **circles = service coverage (want them full)**, **bars = usage/demand (want them low)**; a coverage block "is not fully developed" is a normal state. | [CONFIRMED] | shared brief §3.3 |
| S40 | **No emergency dispatch is documented anywhere.** A keyword sweep of the police, fire and health-care transcripts returns **zero** occurrences of "engine", "truck", "ambulance", "dispatch", "respond", "car" or "patrol". The only emergency vehicle evidenced in the whole game is health care's "emergency wagon" that "you will find in your city". Consequence: FR-SRV-049, FR-SRV-050 and FR-SRV-093…098 are **design extensions**, not reconstructions. | [CONFIRMED] (absence) | https://www.youtube.com/watch?v=4SlxOgZ67MU |

### 1.2 Screens/flows observed
- **Government panel → service tab** (S6, S11, S14, S23, S26, S29): one tab per category; each tab shows per-category **local coverage %** (residential / commercial / industrial) and, for health care and education, an additional **capacity %**; waste shows **production per category + removal**.
- **Science View** (S5, S10, S15, S27): mini-map button → full-screen influence map; right-hand category list; orange = provider buildings; coloured field = covered area; tapping a provider isolates its own area; top-centre "?" explains the selection.
- **Building card in orbit mode** (S4, S9, S23): service coverage icons per service; greyed = uncovered; long-press a building to enter orbit mode and read its icon row.
- **Service shop categories** (S24, S29): waste sits at the lower end of the building shop; Harbor sits in **infrastructure**; parks have their own shop tab; 300+ buildings in total.
- **Education upgrade path** (S17): tap an elementary school → level is shown (demo: level 5) → level card shows capacity ("good for 1 million residents") and area of effect (23 × 23).
- **Connected economies** (S31): place Harbor → economy panel gains a globe icon and switches to global numbers for food **and waste**.

## 2. System overview

```
 BUILDING SHOP (BLD owns content)          SERVICE LAYER (SRV owns semantics)
 ┌──────────────────────────────┐         ┌──────────────────────────────────────────┐
 │ Security:  Police Station,   │         │  ServiceBuilding {id, typeId, tier,       │
 │             Police Department │ ──────► │    pos, level, radiusTiles, capacity,     │
 │ Fire:      Fire Department    │         │    cost(ECO), staff[], active, quality}   │
 │ Health:    Medical Center,    │         └───────────────┬──────────────────────────┘
 │             Hospital (levels) │                         │ placed / upgraded / removed
 │ Education: Elementary,        │                         ▼
 │             Secondary, Univ.  │         ┌──────────────────────────────────────────┐
 │ Bonus:     Library, Art Museum│         │ COVERAGE SOLVER (per map, per service)    │
 │ Parks:     Park / leisure     │         │  for each ServiceBuilding:                │
 │ Waste:     Landfill, Recycling│         │    influenceVolume = shape(type,tier)      │
 │             Incineration      │         │    minus obstacleMask                     │
 │ Infra:     Harbor, C-Wire,    │         │  influenceVolume ∧ buildingFootprints     │
 │             Water Pipeline    │         │  → coveredBuildingSet per service         │
 └──────────────────────────────┘         └───────────────┬──────────────────────────┘
                                                            ▼
                                     ┌──────────────────────────────────────────┐
                                     │ SERVICE METRICS (per map, per service)    │
                                     │  localCoverage[res|com|ind|gov|farm] %   │
                                     │  capacity vs demand (health, education)   │
                                     │  qualityBonus (library, art museum)       │
                                     │  waste: production[], removal[]           │
                                     └───────────────┬──────────────────────────┘
                                                     ▼
                          ┌────────────────────────────────────────────────────┐
                          │ CONSUMERS                                       │
                          │  UX  : government panel (circles = coverage,      │
                          │        bars = usage), Science View overlays      │
                          │  POP : happiness / City Score / Mayor Score       │
                          │  ECO : income bonus from covered buildings       │
                          │  MOB : dispatch paths (emergency vehicles)       │
                          └────────────────────────────────────────────────────┘
```

## 3. Functional requirements

### 3.1 Service catalogue, archetypes and coverage semantics
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-SRV-001 | The system shall expose a **service catalogue** covering at minimum six categories: **security/police, fire, health care, education/school, parks & leisure, waste management**. | Must | Both | no | QA-SRV-001 | https://itunes.apple.com/lookup?id=1607860732&country=us |
| FR-SRV-002 | Each service category shall be a **first-class entity** with its own coverage computation, its own government-panel tab and its own Science View overlay category. | Must | Both | no | QA-SRV-002 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-SRV-003 | Every service building shall carry a **coverage profile**: `coverageShape`, `radiusTiles`, `capacity` (optional), `quality` (optional), `providesConnection` (bool). | Must | Both | no | QA-SRV-003 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-004 | The catalogue shall be **data-driven** — one definition record per service building consumed by authoring, simulation and UI — so new service assets ship as content without engine changes. | Must | Both | no | QA-SRV-004 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-SRV-005 | The service catalogue shall support three distinct **coverage archetypes**: (a) **radius/area-of-effect** coverage (all schools, health care), (b) **connection-granting** coverage (bus stations granting school connection), (c) **production/removal** coverage (waste) with no spatial radius. | Must | Both | no | QA-SRV-005 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-006 | A service building shall expose a **quality bonus** channel separate from coverage: education bonus buildings (library, art museum) improve the quality of nearby schools, food bonus buildings (silos) improve fields and animal enclosures within an area, and such bonus buildings shall **not** affect processed/industrial production of the same chain. | Must | Both | no | QA-SRV-006 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-007 | The system shall support **supply chains whose producers also own a spatial role**: food fields/animal enclosures and water/energy plants produce a supply (owned by `ECO`) and may additionally act as **bonus sources with an area of effect** inside the service overlay. | Should | Both | no | QA-SRV-006 | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-SRV-008 | A **Harbor** shall be listed in the **infrastructure** shop section and shall carry the **global-connection** flag. The **pool and membership semantics** for Harbor, C-Wire and Water Pipeline are owned by **`ECO`** (FR-ECO-102) and are deliberately **not restated** here; the buildings themselves and their transport behaviour are owned by **`MOB`**. | Must | Mobile | no | QA-SRV-007 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-SRV-009 | The service system shall be **per map**: coverage volumes, metrics and overlays are computed per map; the only cross-map coupling is the Harbor/C-Wire/Water-Pipeline global pooling of **food, waste, energy, water**. | Must | Mobile | no | QA-SRV-008 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-SRV-010 | The **PC Early Access construction sandbox** shall permit placing every service building with **no economy, no coverage simulation and no construction timers**; the coverage solver shall be dormant in that mode. | Must | PC-EA | no | QA-SRV-009 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-SRV-011 | Every service building shall be **placeable on a road-adjacent plot** and shall adopt the standard building-placement rules (auto-snap to streets; road-connection tier rules) — a service building on a non-connecting road tier is placed but flagged not road-connected. | Must | Both | no | QA-SRV-010 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-SRV-012 | Service buildings shall be **removable via the inventory bulldozer**; removal shall immediately withdraw the building's coverage volume from the solver and re-derive every dependent metric. | Must | Both | no | QA-SRV-011 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.2 Coverage geometry, influence rule and obstacles
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-SRV-013 | The coverage solver shall evaluate coverage per service building as a **footprint region** expressed in world tiles (axis-aligned square/rectangle for area-of-effect services, e.g. a school's "23 by 23" area), not as a continuous radius in world units. | Must | Mobile | no | QA-SRV-012 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-014 | Coverage shall be computed with the game's **universal one-tile influence rule**: if **one tile** of a building lies inside a coverage volume, the **entire building** counts as covered. | Must | Both | no | QA-SRV-013 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-SRV-015 | A coverage volume shall be evaluated against **building footprints**, not building centroids, so a large building straddling a volume boundary is covered whole. | Must | Mobile | no | QA-SRV-013 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-SRV-016 | The coverage volume of a service building shall be **anchored to the building's own footprint** (centred on the plot) and shall extend symmetrically by the tier's tile radius. | Must | Mobile | no | QA-SRV-014 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-017 | The coverage solver shall treat **water and other impassable terrain** as obstacles that carve holes out of a coverage volume, provided terrain occlusion is confirmed to be a modelled behaviour — otherwise coverage shall ignore terrain and pass over it. The choice is a **TBD** — OQ-SRV-09. | Should | Mobile | no | QA-SRV-015 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-SRV-018 | The coverage solver shall treat **other buildings as non-blocking** (coverage is a statistical influence, not line-of-sight): a service building's influence shall reach buildings that lie between it and the target. | Must | Mobile | no | QA-SRV-016 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-SRV-019 | Coverage shall **not require road connectivity** between the service building and the covered building: the game models service coverage by area, not by travel distance. | Must | Mobile | no | QA-SRV-017 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-020 | Multiple service buildings of the same service shall **union** their coverage volumes; overlapping volumes shall not double-count a building's coverage. | Must | Mobile | no | QA-SRV-018 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-SRV-021 | The solver shall expose a **per-building coverage result** so the UI can answer "is this one building covered?" for any (service, building) pair. | Must | Mobile | no | QA-SRV-019 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-022 | The solver shall support **querying a single provider's** area of effect in isolation (used by Science View when one station is selected) without changing the global coverage result. | Must | Mobile | no | QA-SRV-020 | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| FR-SRV-023 | Coverage recomputation shall be **incremental**: adding, removing, moving or upgrading one service building shall re-evaluate only the affected coverage volumes and their dirty building sets. | Must | Mobile | no | QA-SRV-021 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-SRV-024 | The coverage result shall be **independent of render distance**: a building outside the camera frustum but inside a coverage volume is still covered. | Must | Mobile | no | QA-SRV-022 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-SRV-025 | A service building that is **not connected to the road network** shall still provide coverage; road connection gates traffic and staffing, not coverage. | Should | Mobile | no | QA-SRV-017 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.3 Government panel, coverage circles and usage reporting
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-SRV-026 | The government section shall provide **one overview tab per service category**: electricity, water, food, **waste management, healthcare, police, fire, education**. | Must | Mobile | no | QA-SRV-002 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-SRV-027 | Service tabs shall render **coverage as circles** (a circular gauge per service category) and **usage/demand as bars**; the semantic distinction is that coverage should be pushed **towards full** and usage **towards empty**. | Must | Mobile | no | QA-SRV-023 | shared brief §3.3; https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-028 | A coverage circle shall be able to render a **partial state** ("this block is not fully developed") rather than only 0 % / 100 %; a partially-covered service must show an intermediate fill. | Must | Mobile | no | QA-SRV-024 | shared brief §3.3; https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-029 | The police/security tab shall report **local coverage broken down by building category** — residential, commercial, industrial — as independent percentages. | Must | Mobile | no | QA-SRV-025 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-030 | The fire tab shall report **local coverage broken down by building category** — residential, commercial, industrial — as independent percentages. | Must | Mobile | no | QA-SRV-026 | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| FR-SRV-031 | The healthcare tab shall report **two independent measures**: **capacity** (sufficient capacity for the current resident amount) and **local coverage** (spatial availability). Both shall be displayed simultaneously and shall not be conflated. | Must | Mobile | no | QA-SRV-027 | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-SRV-032 | The education tab shall report **both capacity and connection**: capacity coverage can be 100 % while the **connection** figure shows residents without a reachable school, and the UI must make that distinction visible. | Must | Mobile | no | QA-SRV-028 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-033 | The waste tab shall report **waste production per building category** (residential, commercial, industrial, **government**, **farms**) and the corresponding **removal** figure for the same categories. | Must | Mobile | no | QA-SRV-029 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-SRV-034 | The government panel shall display the **Mayor Score** summary alongside the service tabs so the player can see the score consequence of coverage. | Must | Mobile | no | QA-SRV-030 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-035 | Tapping a coverage block or a service bar shall open a **detail view** with the exact underlying numbers (percentages, counts, per-category breakdown) rather than only the gauge. | Must | Mobile | no | QA-SRV-031 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-SRV-036 | The government panel shall also surface the **residence-bonus block** (culture, entertainment, recreation, wealth, diversity, loyalty) so that parks and other leisure assets are visible alongside service coverage. | Must | Mobile | no | QA-SRV-032 | https://www.youtube.com/watch?v=CIb2IWyNPJw |

### 3.4 Security / police
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-SRV-037 | The security catalogue shall contain at minimum two building tiers: a **small police station** and a **large Police Department**. | Must | Mobile | yes | QA-SRV-033 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-038 | Police buildings shall define an **area of effect** whose radius and capacity scale with tier. Exact radii are [TBD] — OQ-SRV-01. | Must | Mobile | partial | QA-SRV-034 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-039 | The police system shall be implemented as a **bonus-and-decoration system with no crime events**: there is no crime simulation, no crime rate, and no police response to crime in the shipped mobile title. | Must | Mobile | no | QA-SRV-035 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-040 | Covering a building with police shall confer a **coverage bonus** on that building (the bonus magnitude is owned by `ECO`/`POP`); full-city coverage maximises it. | Must | Mobile | no | QA-SRV-036 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-041 | The building card shall show a **police coverage icon**; the icon shall be greyed out when the building is not police-covered. | Must | Mobile | no | QA-SRV-037 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-042 | The Science View *police* overlay shall draw all police buildings in **orange** and the union of their coverage areas in the **purple / purish-blue** field colour. | Must | Mobile | no | QA-SRV-038 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-043 | A **crime / theft event model** shall be **reserved but disabled** by default, so a future crime system can be switched on without changing the coverage model. | Could | Mobile | no | QA-SRV-035 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |

### 3.5 Fire protection
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-SRV-044 | The fire catalogue shall contain a **fire department** building that provides a **fire-protection area** to every building inside it. | Must | Mobile | yes | QA-SRV-039 | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| FR-SRV-045 | The fire department shall define an **area of effect** whose radius and capacity scale with tier/level. Exact radii are [TBD] — OQ-SRV-02. | Must | Mobile | partial | QA-SRV-039 | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| FR-SRV-046 | Every building inside a fire-protection area shall receive a **fire bonus**; buildings outside shall not. | Must | Mobile | no | QA-SRV-040 | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| FR-SRV-047 | The building card shall show a **fire coverage icon** reflecting that building's fire-protection state. | Must | Mobile | no | QA-SRV-037 | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| FR-SRV-048 | The Science View *fire* overlay shall draw all fire departments in **orange** and their covered area in **red**. | Must | Mobile | no | QA-SRV-041 | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| FR-SRV-049 | **DESIGN EXTENSION.** The fire system shall model a **fire-risk exposure** for uncovered buildings, derived from the building's fire-protection state, so that a later fire-event model has a carrier. The shipped title documents only the fire **bonus**, not fire risk; risk→happiness mapping is owned by `POP`. Whether fire risk ships at all is [TBD] — OQ-SRV-12. | Should | Mobile | no | QA-SRV-042 | https://www.youtube.com/watch?v=0wFTp0aDpQg (absence of evidence; see S40) |
| FR-SRV-050 | **DESIGN EXTENSION — no evidence of fire vehicles in the shipped title.** The fire tutorial contains no mention of engines, trucks, dispatch or responding; the only emergency vehicle evidenced anywhere is health care's "emergency wagon" (S40). If fire response is implemented, fire engines shall be spawnable from fire departments and shall route over the road network (`MOB` owns the routing) when a fire event is raised. Whether this ships at all is [TBD] — OQ-SRV-12. | Should | Mobile | yes | QA-SRV-043 | https://www.youtube.com/watch?v=0wFTp0aDpQg (absence of evidence; see S40) |

### 3.6 Health care
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-SRV-051 | The health-care catalogue shall contain **two building types**: the **Hospital** (multi-level, upgradeable) and the **Medical Center** (cheaper, earlier unlock, **smaller area of effect**). | Must | Mobile | yes | QA-SRV-044 | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-SRV-052 | The Hospital shall be **upgradeable across multiple levels**, each level increasing area of effect and/or capacity. Level radii and capacities are [TBD] — OQ-SRV-03. | Must | Mobile | partial | QA-SRV-045 | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-SRV-053 | The Medical Center shall have a **strictly smaller area of effect** than the Hospital's lowest level, and shall unlock **earlier** than the Hospital. Unlock thresholds are [TBD] — OQ-SRV-10. | Must | Mobile | no | QA-SRV-046 | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-SRV-054 | Health-care buildings shall define an **area of effect** plus a **capacity** (a patient/bed count). | Must | Mobile | no | QA-SRV-047 | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-SRV-055 | The health-care government tab shall display **capacity %** (supplied capacity vs. resident demand) and **local coverage %** as two separate readouts. | Must | Mobile | no | QA-SRV-027 | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-SRV-056 | The Science View *healthcare* overlay shall draw covered area in **green** and uncovered area in **white**. | Must | Mobile | no | QA-SRV-048 | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-SRV-057 | Health care shall place **emergency vehicles** in the city — the tutorial calls them "emergency wagon or something actually don't know … these dudes you will find them in your city". Their movement pattern is specified by FR-SRV-098 (design extension). | Must | Mobile | yes | QA-SRV-049 | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-SRV-058 | A building **not covered** by health care shall expose its residents to a **health-service deficit**, which `POP` may score as reduced happiness. The magnitude and the exact penalty are owned by `POP`; the service layer supplies only the uncovered flag and the covered-resident count. The shipped title documents only that poor coverage "is not too bad", so the concrete penalty is [TBD] — OQ-SRV-25. | Must | Mobile | no | QA-SRV-050 | https://www.youtube.com/watch?v=4SlxOgZ67MU |

### 3.7 Education / schools
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-SRV-059 | The education catalogue shall contain **three school levels**: **Elementary School**, **Secondary School**, **University**. | Must | Mobile | yes | QA-SRV-051 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-060 | Each school building shall be **upgradeable through levels**; the level shall be displayed on the building and each level shall define its own **area of effect** and **capacity**. | Must | Mobile | partial | QA-SRV-052 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-061 | The **elementary school level 5** reference profile shall be: area of effect **23 × 23 tiles**, capacity **1 000 000 residents**. All other level radii/capacities are [TBD] — OQ-SRV-04. | Must | Mobile | no | QA-SRV-053 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-062 | **Secondary schools** shall have a **larger radius and larger capacity** than the elementary school of the same level; the **university** shall have a "really huge area". Ratios are [TBD] — OQ-SRV-04. | Must | Mobile | no | QA-SRV-054 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-063 | A school's area of effect shall **connect residential buildings to the school system** for the level(s) it serves. | Must | Mobile | no | QA-SRV-055 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-064 | **Bus stations** shall act as **school-connection providers**: they extend school connection to surrounding buildings without expanding any school's own area of effect, and need not be adjacent to a school. | Must | Mobile | no | QA-SRV-056 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-065 | Bus-station school connection shall be **gated on school capacity**: while the map's total school capacity is below demand, all bus stations shall be **deactivated** and shall provide no school connection. | Must | Mobile | no | QA-SRV-057 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-066 | Bus stations shall **re-activate automatically** as soon as school capacity meets demand again, without a player action. | Must | Mobile | no | QA-SRV-058 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-067 | School **capacity** shall be computed as the sum of the active levels of all school buildings and compared against resident demand; the education tab shall display the resulting capacity percentage. | Must | Mobile | no | QA-SRV-059 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-068 | The education tab shall additionally display a **connection figure** — the share of residents whose building is connected to a school — so a 100 %-capacity city with no bus stations still shows an unmet access problem. | Must | Mobile | no | QA-SRV-028 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-069 | The education system shall support **bonus buildings** (library, art museum) that raise the **quality** of schools in their area of effect. The quality→bonus mapping is [TBD] — OQ-SRV-13. | Must | Mobile | yes | QA-SRV-060 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-070 | As shipped, education shall confer an **income bonus** on covered residential buildings and **no further effect** (no happiness, no behaviour change); the system shall expose a hook so further effects can be enabled later without changing the coverage model. | Must | Mobile | no | QA-SRV-061 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-SRV-071 | The building card shall show **one coverage icon per education level** (elementary, secondary, university), in addition to the police and fire icons. | Must | Mobile | no | QA-SRV-037 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| FR-SRV-072 | The Science View *school* category shall offer a **sub-selection per school category** and shall also list buildings that grant a **bonus to the school system**. | Must | Mobile | no | QA-SRV-062 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |

### 3.8 Parks, leisure and recreation
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-SRV-073 | The catalogue shall contain a **parks / leisure** category (parks have their own shop tab) whose members contribute **recreation points**. | Must | Mobile | yes | QA-SRV-032 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-SRV-074 | Parks shall contribute to the **recreation** residence-bonus category using the shared rule: **1 point per 1 000 residents**, **250 %** cap; the points formula itself is owned by `POP`, the point values are `BLD` data. | Must | Mobile | no | QA-SRV-063 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-SRV-075 | A park's recreation contribution shall follow the **stackable/unique rule**: repeatable buildings contribute per instance, **unique** buildings contribute **once per map** regardless of how many are placed. | Must | Mobile | no | QA-SRV-063 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-SRV-076 | The service overlay set shall **not** include a parks coverage circle in the shipped government panel — the evidenced panel contains electricity, water, food, waste, healthcare, police, fire, education — so parks shall be surfaced through the **recreation-points / residence-bonus** block instead. | Must | Mobile | no | QA-SRV-064 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-SRV-077 | If a parks/leisure **coverage circle** is added in a future build, it shall use the same coverage solver, the same one-tile influence rule and the same circle gauge as the other services. Whether it will be added at all is [TBD] — OQ-SRV-23. | Could | Mobile | no | QA-SRV-065 | shared brief §3.3; https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-SRV-078 | Buildings shall be able to carry **multiple bonus categories simultaneously** (observed: the cinema carries both culture and entertainment), so a single park may carry recreation plus culture or entertainment points. | Should | Mobile | no | QA-SRV-066 | https://www.youtube.com/watch?v=CIb2IWyNPJw |

### 3.9 Waste management
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-SRV-079 | The waste catalogue shall contain at minimum **three disposal buildings**: **Landfill**, **Recycling Station** and **Waste Incineration**, all in the lower waste section of the building shop. | Must | Mobile | yes | QA-SRV-067 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-SRV-080 | **Landfill** shall be the cheap, baseline disposer: waste delivered to it simply ceases to exist (the game explicitly accepts the abstraction). | Must | Mobile | no | QA-SRV-068 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-SRV-081 | **Recycling Station** shall remove more waste than a landfill of the same class, cost more (cost owned by `ECO`), and be **upgradeable** across levels with improving removal. | Must | Mobile | partial | QA-SRV-069 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-SRV-082 | **Waste Incineration** shall remove waste **and** convert it into **energy** for the city, and shall emit **pollution** proportional to throughput. | Must | Mobile | no | QA-SRV-070 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-SRV-083 | Waste Incineration shall be **placement-advised against industrial areas** (the game states the pollution problem is solved by placing it in industry), and the service overlay shall show its pollution footprint so the player can verify the choice. | Must | Mobile | no | QA-SRV-071 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-SRV-084 | Waste **production** shall be computed per building category — residential, commercial, industrial, **government**, **farms** — and the waste tab shall display those production figures. | Must | Mobile | no | QA-SRV-029 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-SRV-085 | Waste **removal** shall be computed from the placed disposal buildings' throughput and shall be displayed per category alongside production. | Must | Mobile | no | QA-SRV-029 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-SRV-086 | The waste service shall expose a **balance metric** = removal ÷ production (the demo city showed a figure in the region of "177 % in use", i.e. removal comfortably exceeded production and therefore no happiness penalty applied). Exact metric definition and formatting are [TBD] — OQ-SRV-14. | Must | Mobile | no | QA-SRV-072 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-SRV-087 | When waste removal is insufficient, the surplus shall be surfaced as a **service deficit** that reduces resident happiness and Mayor Score (magnitude owned by `POP`). | Must | Mobile | no | QA-SRV-073 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-SRV-088 | Waste collection shall be **haulage-based**: garbage/freight trucks travel between producing buildings and disposal buildings over the road network (`MOB` owns the routing), and the vehicles shall be visible in the world. | Should | Mobile | yes | QA-SRV-074 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-SRV-089 | A **Harbor** on a map shall mark **that map** as a **member** of the **region-wide** food-and-waste pool at the service layer. The **membership and pooling semantics** are owned by **`ECO`** (FR-ECO-102) and are not restated here: a map that owns no Harbor is not a member and keeps local figures. | Must | Mobile | no | QA-SRV-075, QA-SRV-093 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-SRV-090 | When a map is globally connected, the waste panel shall show a **globe icon** and shall present **global** production/removal numbers rather than map-local ones. | Must | Mobile | no | QA-SRV-076 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-SRV-091 | Removing a Harbor shall drop the map out of the global waste pool and re-derive map-local waste figures immediately. | Must | Mobile | no | QA-SRV-077 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-SRV-092 | **C-Wire** and **Water Pipeline** shall connect **energy** and **water** respectively (not waste) — the three connection assets shall remain distinct and shall be independently toggleable per map. | Must | Mobile | no | QA-SRV-078 | https://www.youtube.com/watch?v=m5O-A33wQm0 |

### 3.10 Emergency response and dispatch
> **Evidence position (read before implementing).** The official tutorials document **no emergency dispatch of any kind**: the police, fire and health-care transcripts contain **no** occurrence of "engine", "truck", "ambulance", "dispatch", "respond", "car" or "patrol"; the only emergency vehicle evidenced anywhere is health care's "emergency wagon" (S40). The whole of this subsection is therefore a **designed extension** consistent with the game's service model, not a reconstruction. It is specified so a developer can build it coherently, and every trigger, model and number is an open question (OQ-SRV-12, OQ-SRV-15, OQ-SRV-16). Implement it as a self-contained module that can be switched off without affecting the coverage system.

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-SRV-093 | **[TBD — design decision] — DESIGN EXTENSION.** The dispatch subsystem **may** be **pluggable per service**: a service that declares `dispatchEnabled` may spawn emergency vehicles; services that do not (notably police, which has no crime) spawn none. **No dispatch evidence exists in the shipped title** (S40) — whether this ships at all is [TBD] — OQ-SRV-26. | Could | Design | no | QA-SRV-079 | [TBD — design decision]; https://www.youtube.com/watch?v=4SlxOgZ67MU (absence of evidence; see S40) |
| FR-SRV-094 | **[TBD — design decision] — DESIGN EXTENSION.** A dispatched emergency vehicle **may** originate from the **nearest eligible station** of the responding service and travel to the incident's building. **No dispatch evidence exists in the shipped title** (S40); whether this ships at all is [TBD] — OQ-SRV-26. | Could | Design | no | QA-SRV-043 | [TBD — design decision]; https://www.youtube.com/watch?v=4SlxOgZ67MU (absence of evidence; see S40) |
| FR-SRV-095 | **[TBD — design decision] — DESIGN EXTENSION.** The dispatch path **may** be computed over the **road network** using `MOB`'s router; the service layer would supply only the origin station, the destination building and the service class. **No dispatch evidence exists in the shipped title** (S40); whether this ships at all is [TBD] — OQ-SRV-26. | Could | Design | no | QA-SRV-080 | [TBD — design decision]; shared brief §4 (MOB owns road routing); https://www.youtube.com/watch?v=4SlxOgZ67MU (absence of evidence; see S40) |
| FR-SRV-096 | **[TBD — design decision] — DESIGN EXTENSION.** Dispatch **may** be **gated on road connectivity**: a station not connected to the road network (or to the incident) would not be able to respond. **No dispatch evidence exists in the shipped title** (S40); whether this ships at all is [TBD] — OQ-SRV-26. | Could | Design | no | QA-SRV-043 | [TBD — design decision]; shared brief §4; https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-SRV-097 | **[TBD — design decision] — DESIGN EXTENSION.** The number of concurrent emergency vehicles a station can field **may** be derived from its **staffing/capacity** figure. **No dispatch evidence exists in the shipped title** (S40); the staffing model and numbers are [TBD] — OQ-SRV-15 — and whether dispatch ships at all is [TBD] — OQ-SRV-26. | Could | Design | no | QA-SRV-081 | [TBD — design decision]; shared brief §4; https://www.youtube.com/watch?v=4SlxOgZ67MU (absence of evidence; see S40) |
| FR-SRV-098 | **DESIGN EXTENSION / [INFERRED].** Health-care emergency vehicles shall **periodically visit covered buildings** even without an incident, so that health-care service is observable in the world. The transcript only states that the wagons "you will find in your city", so the visit behaviour is inferred; the interval is [TBD] — OQ-SRV-16. | Should | Mobile | yes | QA-SRV-049 | https://www.youtube.com/watch?v=4SlxOgZ67MU |

### 3.11 Building, upgrading, relocating and removing service assets
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-SRV-099 | Placing a service building shall add its coverage volume immediately and shall update the affected service's coverage percentages in the same tick, without a reload. | Must | Mobile | no | QA-SRV-082 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-SRV-100 | **Upgrading** a service building in place shall replace its coverage volume with the new level's volume (union of old and new shall **not** persist) and shall re-derive the service metrics. | Must | Mobile | partial | QA-SRV-083 | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-SRV-101 | **Moving** a service building shall remove its old coverage volume before applying the new one, so no coverage is ever counted at two positions at once. | Must | Mobile | no | QA-SRV-084 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-SRV-102 | **Removing** a service building shall immediately mark the buildings it covered as uncovered for that service and shall decrease the service's coverage percentages. | Must | Mobile | no | QA-SRV-011 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| FR-SRV-103 | The **upgrade path** for every service building shall be declared as data (list of tiers, per-tier radius/capacity/cost), with the **tier ladder content owned by `BLD`**; the service layer shall consume it without hard-coding tiers. | Must | Both | no | QA-SRV-004 | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-SRV-104 | Service building **models** shall be editable in SCC Studio (the editor's published scope includes "buildings"), and an edited model shall keep its service semantics — radius, capacity and category — unchanged unless the player edits the data explicitly. | Should | PC-EA | yes | QA-SRV-085 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| FR-SRV-105 | A service building whose **capacity demand exceeds supply** shall be flagged as **deficit** in the government tab even if its spatial coverage is 100 %. | Must | Mobile | no | QA-SRV-086 | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-SRV-106 | A **city upgrade** (purchasable with coins or Super Cash) shall be able to modify **service-related city parameters** — including waste consumption/production and resource coefficients — and such upgrades shall feed back into the service metrics. | Should | Mobile | no | QA-SRV-087 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

## 4. Options, variants & configuration matrix

### 4.1 Service catalogue matrix
| Service category | Building / tier | Coverage shape | Radius / area | Capacity | Bonus role | Evidence |
|---|---|---|---|---|---|---|
| **Security / police** | Police Station (small) | square area of effect | [TBD] — OQ-SRV-01 | [TBD] | coverage bonus on covered buildings | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| **Security / police** | Police Department (large) | square area of effect | [TBD] — OQ-SRV-01 | [TBD] | coverage bonus; larger than station | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| **Fire** | Fire Department | square area of effect | [TBD] — OQ-SRV-02 | [TBD] | fire bonus on covered buildings | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| **Health care** | Medical Center | square area of effect | smaller than Hospital L1 — [TBD] — OQ-SRV-03 | [TBD] | health coverage bonus; earlier unlock | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| **Health care** | Hospital (levels 1..N) | square area of effect | grows per level — [TBD] — OQ-SRV-03 | [TBD] | health coverage bonus | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| **Education** | Elementary School (levels 1..N) | square area of effect | **23 × 23 tiles at level 5** | **1 000 000 residents at level 5** | income bonus on covered residential | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| **Education** | Secondary School (levels 1..N) | square area of effect | larger than elementary — [TBD] — OQ-SRV-04 | larger than elementary — [TBD] | income bonus | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| **Education** | University (levels 1..N) | square area of effect | "a really huge area" — [TBD] — OQ-SRV-04 | largest — [TBD] | income bonus | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| **Education (connector)** | Bus Station | connection provider (no area expansion) | own footprint + connection rule — [TBD] — OQ-SRV-17 | gated by school capacity | extends school connection | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| **Education (bonus)** | Library | quality area of effect | [TBD] — OQ-SRV-13 | n/a | raises school quality | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| **Education (bonus)** | Art Museum | quality area of effect | [TBD] — OQ-SRV-13 | n/a | raises school quality | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| **Parks / leisure** | Parks (multiple assets) | none (points, not coverage) | n/a | n/a | **recreation points** | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| **Waste** | Landfill | none (production/removal) | n/a | removal throughput | cheapest disposal | https://www.youtube.com/watch?v=HDjaWySDKOM |
| **Waste** | Recycling Station (levels) | none | n/a | removal throughput, higher than landfill | reduces waste; upgradeable | https://www.youtube.com/watch?v=HDjaWySDKOM |
| **Waste** | Waste Incineration | pollution footprint | pollution radius — [TBD] — OQ-SRV-18 | removal throughput | burns waste → energy; pollutes | https://www.youtube.com/watch?v=HDjaWySDKOM |
| **Supply (spatial only)** | Silos / farm bonus buildings | bonus area of effect | [TBD] — OQ-SRV-19 | n/a | boosts fields + animal enclosures, **not** food factories | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| **Infrastructure** | Harbor | global connection flag | n/a | n/a | pools **food + waste** across the region | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| **Infrastructure** | C-Wire | global connection flag | n/a | n/a | pools **energy** | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| **Infrastructure** | Water Pipeline | global connection flag | n/a | n/a | pools **water** | https://www.youtube.com/watch?v=m5O-A33wQm0 |

### 4.2 Coverage overlay / legend matrix
| Overlay category | Provider buildings colour | Covered field colour | Uncovered field colour | Selectable | Evidence |
|---|---|---|---|---|---|
| Police / security | orange | purple / purish-blue | default map | yes | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| Fire | orange | **red** | default map | yes | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| Health care | orange | **green** | **white** | yes | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| School (per category: elementary / secondary / university) | orange | per-category colour — [TBD] | default map | yes | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| School bonus buildings (library, art museum) | orange | quality field — [TBD] | default map | yes | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| Pollution | orange | **brown** | default map | yes | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| Farm area / farm bonus | orange | field colour — [TBD] | default map | yes | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| Industrial / commercial / residential bonus | orange | bonus field | default map | yes | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| Monorail | orange | street-connection field | default map | yes | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| **Parks** | — | **no overlay in the shipped panel** | — | **no** | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 4.3 Service building property matrix
| Property | Applies to | Values / range | Meaning | Evidence |
|---|---|---|---|---|
| `category` | all service buildings | security / fire / health / education / waste / park / infrastructure | service family | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `tier` | all | per-tier ladder (BLD-owned) | catalogue tier | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| `level` | upgradeable service buildings | 1..N (elementary demo level 5) | current upgrade level | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| `radiusTiles` / `areaTiles` | coverage services | tiles (elementary L5 = 23) | area of effect extent | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| `capacity` | health, education | residents served (elementary L5 = 1 000 000) | service capacity | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| `capacityActive` | bus stations | bool | school connection enabled/disabled | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| `qualityBonus` | library, art museum, silos | [TBD] — OQ-SRV-13 | quality bonus applied in area | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| `removalThroughput` | waste buildings | [TBD] — OQ-SRV-14 | waste removed per period | https://www.youtube.com/watch?v=HDjaWySDKOM |
| `producesEnergy` | waste incineration | bool | energy output | https://www.youtube.com/watch?v=HDjaWySDKOM |
| `emitsPollution` | waste incineration | bool + radius — OQ-SRV-18 | pollution footprint | https://www.youtube.com/watch?v=HDjaWySDKOM |
| `connectsGlobal` | Harbor / C-Wire / Water Pipeline | enum food+waste / energy / water | global pool membership | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| `dispatches` | service buildings | bool | may field emergency vehicles | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| `recreationPoints` / `culturePoints` / `entertainmentPoints` | parks, leisure | integer points | residence-bonus contribution | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `uniqueOnMap` | bonus buildings | bool | counts once per map (cinema example) | https://www.youtube.com/watch?v=CIb2IWyNPJw |

### 4.4 Service-vs-supply boundary matrix
| Resource | Spatial role owned here | Economic role | Owner |
|---|---|---|---|
| Energy | C-Wire global-connection flag; energy plants in the network | production/consumption, 90 %/100 % usage rule | `ECO` |
| Water | Water Pipeline global-connection flag | production/consumption | `ECO` |
| Food | fields / animal enclosures bonus area (silo-style) | production chains, animal→plant consumption | `ECO` |
| Waste | **full service behaviour**: production per category, removal buildings, global pooling | balance metric, happiness penalty magnitude | `SRV` (behaviour) / `ECO` (numbers) |

## 5. Stage / progression matrix
> **Stage dimension used:** services have no independent stage track. Availability is gated by (a) the **product stage** — PC Early Access construction sandbox vs. mobile simulation — and (b) the **mobile level/unlock gate** (level is a direct function of resident amount; higher levels unlock more buildings). Exact unlock thresholds are [TBD] — OQ-SRV-10.

| Stage | Entry condition | Player can build | Player can rebuild / modify | Unlocks | Exits when |
|---|---|---|---|---|---|
| **S-A — PC EA sandbox** | Steam Early Access (Q4 2026); construction sandbox, no economy | Every service building model from the catalogue (police, fire, hospital, medical center, schools, parks, waste, harbor) | Full free editing in SCC Studio; relocate, rotate, demolish | Everything — no service simulation runs | N/A (terminal PC stage at launch) |
| **S-B — Mobile early** | New city; level = resident amount | Police station, fire department, Medical Center, Elementary School, Landfill, basic parks | Relocate, demolish, upgrade where a ladder exists | Base service set; the Medical Center "unlocks earlier" | Resident growth raises level |
| **S-C — Mobile mid** | Level unlocks larger service assets | Police Department, Hospital (upgradeable), Secondary School, Recycling Station (upgradeable) | Upgrade service buildings through their ladders | Higher tiers, hospital, secondary school, recycling | Level raises to late tier |
| **S-D — Mobile late** | High level | University, Waste Incineration, bus stations as school connectors, library / art museum | Full ladder topping out | University, incineration, school bonus buildings | Terminal |
| **S-E — Region** | ≥ 2 maps in Region View | Harbor, C-Wire, Water Pipeline | Each map edited independently | Global pooling of food, waste, energy, water | — |

## 6. Data model
| Entity | Field | Type | Range / values | Meaning | Source |
|---|---|---|---|---|---|
| **ServiceCategory** | `id` | enum | security / fire / health / education / waste / park / supply | service family | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| ServiceCategory | `hasCoverageCircle` | bool | true for security/fire/health/education; **false** for parks | does the government panel show a coverage circle | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| ServiceCategory | `hasCapacityMetric` | bool | true for health, education | capacity vs. coverage are separate readouts | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| ServiceCategory | `overlayProviderColor` | colour | orange | provider buildings in Science View | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| ServiceCategory | `overlayFieldColor` | colour | police purple-blue / fire red / health green | covered-area field colour | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| **ServiceBuildingDef** | `category` | ref | — | owning service | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| ServiceBuildingDef | `tiers[]` | array | ≥ 1 | tier ladder (content owned by `BLD`) | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| ServiceBuildingDef | `areaTiles` (per tier) | int | 23 observed (elementary L5) | area of effect width/depth in tiles | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| ServiceBuildingDef | `capacity` (per tier) | int | 1 000 000 observed (elementary L5) | residents served | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| ServiceBuildingDef | `cost` | money | [TBD] — `ECO` | build cost | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| **ServiceBuilding** (instance) | `id`, `defId` | uuid, ref | — | placed instance | — |
| ServiceBuilding | `pos` | vec3 / tile | grid-snapped | footprint anchor | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| ServiceBuilding | `level` | int | 1..N | current tier/level | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| ServiceBuilding | `active` | bool | true/false | e.g. a deactivated bus station | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| ServiceBuilding | `roadConnected` | bool | true/false | derived from the attached road tier | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| ServiceBuilding | `staff` | int | [TBD] — OQ-SRV-15 | staffing/dispatch budget | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| **CoverageVolume** | `serviceId`, `providerId` | refs | — | one provider's influence | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| CoverageVolume | `shape` | enum | square / rect / none | area-of-effect geometry | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| CoverageVolume | `tiles[]` / `origin`+`extent` | tile set | — | covered cells | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| CoverageVolume | `obstacleMask` | bitmask | — | terrain occlusion (decision pending, OQ-SRV-09) | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| **CoverageResult** | `coveredBuildingIds[]` | set | — | buildings covered by a service | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| CoverageResult | `localCoverage[category]` | float 0..1 | observed 0.71 / 0.92 / 0.93 | % of buildings covered per category | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| CoverageResult | `capacityProvided`, `capacityDemand` | int | observed 60 % health | capacity vs. resident demand | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| CoverageResult | `connectedResidents` | int | — | residents with school/health access | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| CoverageResult | `deficit` | bool | true/false | service shortfall flag | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| **WasteFlow** | `production[category]` | float | res/com/ind/gov/farm | waste produced per category | https://www.youtube.com/watch?v=HDjaWySDKOM |
| WasteFlow | `removal[category]` | float | same set | waste removed per category | https://www.youtube.com/watch?v=HDjaWySDKOM |
| WasteFlow | `balanceRatio` | float | observed ≈1.77 ("177 % in use") | removal ÷ production | https://www.youtube.com/watch?v=HDjaWySDKOM |
| **GlobalLink** | `mapId`, `resource` | enum | food+waste / energy / water | map's global-pool membership | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| GlobalLink | `viaBuildingId` | ref | Harbor / C-Wire / Water Pipeline | the linking asset | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| **DispatchJob** | `serviceId`, `originStationId`, `targetBuildingId` | refs | — | emergency task | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| DispatchJob | `state` | enum | queued / en-route / on-site / done | job lifecycle | — |
| DispatchJob | `vehicleIds[]` | refs | — | assigned emergency vehicles | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| **RecreationPointSource** | `buildingId`, `points`, `unique` | ref, int, bool | e.g. cinema culture+entertainment | points contribution | https://www.youtube.com/watch?v=CIb2IWyNPJw |

## 7. Rules, formulas & tuning
**R1 — Universal one-tile influence rule.** A building is affected by an influence if **one tile** of its footprint lies inside the influence volume; the whole building then counts as affected. Applies to **all** influences (police, fire, health, school, bonus buildings, farm area, monorail). *[CONFIRMED — S28]*
**R2 — Coverage by union.** The covered set of a service = union of the covered sets of all its providers; a building is covered if any provider's volume touches it. *[INFERRED from S5/S10/S15 union rendering + S20]*
**R3 — Coverage ≠ capacity.** Two orthogonal metrics: **local coverage** (spatial) and **capacity** (volumetric vs. resident demand). A city may be 100 % capacity yet poorly covered, and vice-versa. *[CONFIRMED — S14, S23]*
**R4 — Capacity gating of connectors.** Bus stations provide school connection only while total school capacity ≥ demand; otherwise every bus station is deactivated. *[CONFIRMED — S20]*
**R5 — Re-activation.** Raising school capacity re-activates bus stations automatically, with no player action. *[CONFIRMED — S20]*
**R6 — Full-coverage optimum.** 100 % coverage in every building category maximises the service bonus, and thereby maximises happiness and Mayor Score. *[CONFIRMED — S7, S11]*
**R7 — Coverage is area-based, not path-based.** Coverage does not require road connectivity between provider and beneficiary; a station not on a connecting road tier still provides coverage. *[INFERRED from S3/S19 — no connectivity condition is ever stated for coverage]*
**R8 — Police has no crime.** There is no crime rate, no crime events, no police response in the shipped title; police is decoration + bonus. *[CONFIRMED — S1]*
**R9 — Education effect scope.** As shipped (v2.1.2) education yields only an income bonus on covered residential buildings; no happiness or behavioural effect. *[CONFIRMED — S22]*
**R10 — Education levels.** Three levels (elementary, secondary, university) with monotonically increasing radius and capacity; radius is expressed as a tile square (23 × 23 at elementary L5). *[CONFIRMED — S16, S17, S18]*
**R11 — Bonus buildings improve quality, not coverage.** Library / art museum / silos raise the **quality** of the relevant chain inside an area; they do not enlarge the primary coverage volume and do not benefit processed/industrial production. *[CONFIRMED — S21, S38]*
**R12 — Waste balance.** Waste is produced by residential, commercial, industrial, government and farm buildings; disposal buildings remove it; when removal ≥ production there is no happiness/Mayor-Score penalty. The demo city reported "177 % in use" with no penalty — most plausibly removal ÷ production = 1.77. *[INFERRED from S26, S27 — exact metric definition TBD, OQ-SRV-14]*
**R13 — Incineration trade-off.** Waste incineration converts waste into energy but emits pollution; placing it in industrial areas is the stated mitigation. *[CONFIRMED — S25]*
**R14 — Global pooling.** Harbor pools **food + waste**; C-Wire pools **energy**; Water Pipeline pools **water**. Pooled resources show global numbers and a globe icon on the economy panel. A map joins a pool **only by owning the linking building**; the pool itself is region-wide (`ECO` owns the rule — FR-ECO-102). *[CONFIRMED — S31]*
**R15 — Points bonus rule.** Recreation (and culture/entertainment) points: **1 point per 1 000 residents** per category, **250 %** cap; repeatable buildings contribute per instance, unique buildings once per map. *[CONFIRMED — S33]*
**R16 — Coverage circle semantics.** In the government panel, **circles = coverage (want full)**, **bars = usage/demand (want low)**; a partially-covered block is a normal state, not an error. *[CONFIRMED — S39, S28]*
**R17 — Panel-level scale.** The top bar's usage block is a separate concern from the panel's coverage circles: usage below 90 % is fine; the *growth* consequence of 90 %/100 % is `ECO`'s. *[CONFIRMED — S30; brief §3.2]*
**R18 — Overlay colours are per-category.** Police purple-blue, fire red, health green, pollution brown, providers always orange. *[CONFIRMED — S5, S10, S15, S27]*
**R19 — No double counting.** Overlapping coverage volumes from two providers of the same service count a building once. *[INFERRED from R2]*
**R20 — Sandbox has no service simulation.** The PC Early Access construction sandbox ships no economy, no progression and (by extension) no live coverage metrics. *[CONFIRMED — S35, S36]*

## 8. Edge cases, failure modes & required behaviours
| # | Edge case | Required behaviour | Ref |
|---|---|---|---|
| E1 | Service building placed on a road tier that confers no connection | Placed; coverage still applies; building flagged not road-connected | FR-SRV-011, FR-SRV-025 |
| E2 | Large building straddling the edge of two coverage volumes | Whole building counted as covered (one-tile rule) | FR-SRV-014, FR-SRV-015 |
| E3 | Two police stations' volumes overlap | Building counted once | FR-SRV-020, R19 |
| E4 | Service building demolished | Coverage withdrawn in the same tick; percentages drop; icons grey out | FR-SRV-012, FR-SRV-102 |
| E5 | Service building moved | Old volume removed before new applied — never double-covered | FR-SRV-101 |
| E6 | Service building upgraded in place | Old tier volume replaced, not unioned | FR-SRV-100 |
| E7 | School capacity drops below demand after a school is removed | All bus stations deactivate on the next tick; school connection lost | FR-SRV-065 |
| E8 | School capacity restored | Bus stations re-activate automatically | FR-SRV-066 |
| E9 | City at 100 % school capacity but no bus stations and no schools near residents | Education tab shows capacity OK **and** unmet access | FR-SRV-068 |
| E10 | Waste incinerator placed outside industrial area | Pollution overlay shows the footprint; the city keeps the pollution penalty | FR-SRV-083 |
| E11 | Landfill used alone | Waste disappears; no penalty (the game's stated abstraction) | FR-SRV-080 |
| E12 | Harbor removed | Map leaves the global waste pool; waste figures revert to map-local | FR-SRV-091 |
| E13 | Harbor placed on map B while map A produces waste, and **map A also owns a Harbor** | Waste produced on A **and** on B is handled in the **same region-wide pool**, because both maps own a Harbor and are pool members; if map A owned no Harbor its waste would stay local | FR-SRV-089 |
| E14 | Player taps a service bar/circle with no underlying data | Detail view shows the exact numbers, not a blank panel | FR-SRV-035 |
| E15 | Coverage circle partially filled | Partial fill renders; the block is described as "not fully developed" | FR-SRV-028 |
| E16 | City with zero service buildings | Every service tab shows 0 % coverage; no crash, no NaN | FR-SRV-029, FR-SRV-030 |
| E17 | Residential building partially outside the map edge | Clipped to the map; still evaluated for coverage | FR-SRV-013 |
| E18 | Bus station placed where no school exists at all | Inactive (no capacity) and shown as deactivated | FR-SRV-065 |
| E19 | Police station placed in a district the player will never populate | Coverage still computed and counted | FR-SRV-024 |
| E20 | Player edits a hospital model in SCC Studio (PC) | Service semantics (radius, capacity, category) unchanged | FR-SRV-104 |
| E21 | Waste production spikes (city upgrade increases consumption) | Waste balance re-evaluated; deficit surfaced | FR-SRV-106, FR-SRV-087 |
| E22 | Two identical unique buildings (e.g. two cinemas) | Recreation/culture points counted once | FR-SRV-075 |
| E23 | Many parks placed | Recreation points stack up to the 250 % cap | FR-SRV-074 |
| E24 | Service building in the PC EA sandbox | No coverage metrics computed; no government service tabs | FR-SRV-010, R20 |
| E25 | Science View category selected with zero providers | Empty field, no error, "?" explanation still available | FR-SRV-027 |
| E26 | Health care capacity sufficient but coverage 0 % | Healthcare tab shows capacity OK and coverage 0 % separately | FR-SRV-055, R3 |

## 9. Non-functional requirements
| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| NFR-SRV-001 | The coverage solver shall recompute a single service's metrics **within one simulation frame** after a placement, removal, move or upgrade. | Must | Mobile | no | QA-SRV-082 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| NFR-SRV-002 | Coverage evaluation shall be **O(affected tiles + affected buildings)**, not O(map area), so a single station edit does not rescan the map. | Must | Mobile | no | QA-SRV-021 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| NFR-SRV-003 | The solver shall support **many maps** (one region = several maps) with isolated per-map coverage sets. | Must | Mobile | no | QA-SRV-008 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| NFR-SRV-004 | The service layer shall run **independently of frame rate** and shall not change results under pause or fast-forward. | Must | Mobile | no | QA-SRV-088 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-SRV-005 | Coverage overlays shall render as **instanced/batched geometry** so a full city of coverage volumes does not create one draw call per tile. | Must | Mobile | no | QA-SRV-089 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| NFR-SRV-006 | The Science View overlay shall be toggleable at negligible cost and shall not mutate simulation state. | Should | Mobile | no | QA-SRV-090 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| NFR-SRV-007 | All service definitions, tiers, radii, capacities and bonus values shall be **data-driven** so new services ship as content without engine changes and can be authored in SCC Studio. | Must | Mobile | yes | QA-SRV-004 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| NFR-SRV-008 | The full service state (buildings, levels, coverage results, waste flows, global links) shall **round-trip through save/load** without recomputation drift. | Must | Mobile | no | QA-SRV-091 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| NFR-SRV-009 | Service building models and emergency vehicles shall be **voxel-compatible** with SCC Studio so custom models render and animate correctly. | Should | Mobile | yes | QA-SRV-085 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |
| NFR-SRV-010 | The service layer shall **not** duplicate economy, happiness or score formulas; it shall expose covered-building counts and ratio metrics for `ECO`/`POP` to consume, with the Mayor Score shown as a separate panel consumer. | Must | Mobile | no | QA-SRV-092 | shared brief §4 cross-domain rules; https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| NFR-SRV-011 | Emergency vehicle dispatch shall reuse `MOB`'s road router rather than implementing a second routing system. | Must | Mobile | no | QA-SRV-074 | https://www.youtube.com/watch?v=c3L7Qo8fdIM |
| NFR-SRV-012 | The PC EA sandbox shall load a large city with the service solver **disabled** at negligible cost (no per-tick service work). | Should | Mobile | no | QA-SRV-009 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english |

## 10. Acceptance-criteria suites
| ID | Given | When | Then | Covers |
|---|---|---|---|---|
| QA-SRV-001 | The building shop is open | The player browses categories | All six service categories are present: security, fire, health care, education, parks/leisure, waste | FR-SRV-001 |
| QA-SRV-002 | Two service categories are compared in the government panel | The player switches tabs | Each has its own tab, its own metrics and its own Science View overlay | FR-SRV-002, FR-SRV-026 |
| QA-SRV-003 | A service building definition is inspected | The developer reads its record | It carries a coverage shape, a radius, an optional capacity and an optional quality | FR-SRV-003 |
| QA-SRV-004 | A new service building type is added as data only | The game loads it | It appears in the shop, resolves coverage and appears in the overlay with no engine change; the tier ladder is likewise data-driven | FR-SRV-004, FR-SRV-103, NFR-SRV-007 |
| QA-SRV-005 | A school, a bus station and a landfill exist | The solver classifies them | School = radius archetype, bus station = connection archetype, landfill = production archetype | FR-SRV-005 |
| QA-SRV-006 | A silo stands next to a field and next to a food factory | The bonus solver runs | The field gains the bonus, the food factory does not; food/water/energy plants also carry a spatial bonus role | FR-SRV-006, FR-SRV-007 |
| QA-SRV-007 | The shop is opened to the infrastructure section | The player selects Harbor | Harbor is present there and carries the global food + waste connection flag | FR-SRV-008 |
| QA-SRV-008 | Two maps exist in a region | The player inspects coverage on each | Coverage sets are fully independent per map; only the declared global resources cross over | FR-SRV-009, NFR-SRV-003 |
| QA-SRV-009 | The PC EA sandbox is running | The player places a hospital | No coverage metrics, no government service tabs, no construction timer, negligible per-tick cost | FR-SRV-010, NFR-SRV-012 |
| QA-SRV-010 | A hospital is placed beside a dirt road | The placement resolves | It is placed and reported as not road-connected | FR-SRV-011 |
| QA-SRV-011 | A police station is bulldozed | The solver re-derives | The buildings it covered become police-uncovered, the icons grey out and the security % drops | FR-SRV-012, FR-SRV-102 |
| QA-SRV-012 | An elementary school at level 5 is inspected | The player opens its level card | Area of effect 23 x 23 tiles and capacity 1 000 000 residents | FR-SRV-013 |
| QA-SRV-013 | A large building straddles a coverage boundary | The solver runs | Exactly one tile of the building is inside the volume and the whole building counts as covered | FR-SRV-014, FR-SRV-015 |
| QA-SRV-014 | A service building is inspected in the world | The developer measures its volume | The volume is anchored to the provider's own footprint and extends symmetrically by its tile radius | FR-SRV-016 |
| QA-SRV-015 | A coverage volume overlaps water | The solver runs | The configured terrain policy is applied (default: coverage passes over terrain; only the map border clips) | FR-SRV-017 |
| QA-SRV-016 | A service building stands across a river from a residential block | The solver runs | The block is covered; coverage is statistical and is not blocked by terrain or intervening buildings | FR-SRV-018 |
| QA-SRV-017 | A station is placed with no road connection to a district | The solver runs | The district is still covered; road connection gates traffic and staffing, not coverage | FR-SRV-019, FR-SRV-025 |
| QA-SRV-018 | Two police stations' volumes overlap | The solver runs | The overlapping building is counted exactly once | FR-SRV-020 |
| QA-SRV-019 | A building is long-pressed into orbit mode | The player reads its card | The engine can answer the covered/uncovered state for any (service, building) pair | FR-SRV-021 |
| QA-SRV-020 | One police station is selected in Science View | The player taps it | Only that station's area of effect is highlighted and the global coverage result is unchanged | FR-SRV-022 |
| QA-SRV-021 | One station is moved | The solver re-derives | Only the affected volume and the dirty building set are recomputed, not the whole map | FR-SRV-023, NFR-SRV-002 |
| QA-SRV-022 | A covered building sits outside the camera frustum | The solver runs | It is still counted as covered | FR-SRV-024 |
| QA-SRV-023 | The government panel is open | The player compares gauges | Coverage is a circle to be filled; usage is a bar to be emptied | FR-SRV-027 |
| QA-SRV-024 | Only half the city is police-covered | The security gauge renders | A partial fill is shown and the block reads as not fully developed | FR-SRV-028 |
| QA-SRV-025 | The security tab is open | The player reads it | Commercial 92 % and industrial 93 % are shown on the reference city; the residential figure is rendered as a **[TBD]** value, not as a guessed number | FR-SRV-029 |
| QA-SRV-026 | The fire tab is open | The player reads it | Residential, commercial and industrial local coverage are listed as separate figures | FR-SRV-030 |
| QA-SRV-027 | The healthcare tab is open | The player reads both figures | Capacity (60 % on the reference city) and local coverage are shown simultaneously and never conflated | FR-SRV-031, FR-SRV-055 |
| QA-SRV-028 | A city is capacity-full for education but has no bus stations | The education tab is read | Capacity reads full while the connection figure shows residents without access | FR-SRV-032, FR-SRV-068 |
| QA-SRV-029 | A city has homes, shops, factories, a civic building, farms and disposal plants | The waste tab is read | Production and removal are both reported for residential, commercial, industrial, government and farms | FR-SRV-033, FR-SRV-084, FR-SRV-085 |
| QA-SRV-030 | The government panel is open | The player looks for the Mayor Score | It is visible alongside the service tabs | FR-SRV-034 |
| QA-SRV-031 | A service gauge is tapped | The detail view opens | Exact percentages, counts and per-category breakdowns are shown, not a blank panel | FR-SRV-035 |
| QA-SRV-032 | The government panel is open | The player looks for the bonus block | Culture, entertainment, recreation, wealth, diversity and loyalty are listed; parks appear here rather than as a coverage circle | FR-SRV-036, FR-SRV-073 |
| QA-SRV-033 | The security shop category is opened | The player lists it | A small police station and a large Police Department are both available | FR-SRV-037 |
| QA-SRV-034 | A police building definition is read | The developer reads its record | It has an area of effect and a capacity that scale with tier | FR-SRV-038 |
| QA-SRV-035 | The game runs for a long session | The player watches for crime | No crime occurs and no police response is dispatched; the crime model exists but is disabled by default | FR-SRV-039, FR-SRV-043 |
| QA-SRV-036 | A residential block is inside police coverage | The bonus is evaluated | The block gains the police bonus; a block outside it does not | FR-SRV-040 |
| QA-SRV-037 | A building card is opened | The player reads the icon row | Icons for police, fire and all three education levels are present and grey out when uncovered | FR-SRV-041, FR-SRV-047, FR-SRV-071 |
| QA-SRV-038 | Science View police is selected | The player reads the map | Stations are orange and the covered field is purple / purish-blue | FR-SRV-042 |
| QA-SRV-039 | The fire shop category is opened | The player selects the fire department | It exists and defines a fire-protection area whose radius and capacity scale with tier | FR-SRV-044, FR-SRV-045 |
| QA-SRV-040 | Two blocks sit inside and outside a fire area | The bonus is evaluated | Only the inside block receives the fire bonus | FR-SRV-046 |
| QA-SRV-041 | Science View fire is selected | The player reads the map | Departments are orange and the covered field is red | FR-SRV-048 |
| QA-SRV-042 | A block has no fire coverage | The risk value is computed | Its fire risk is non-zero and the deficit is exposed to POP | FR-SRV-049 |
| QA-SRV-043 | A fire event is raised in a covered block | The sim runs | A fire engine leaves the nearest eligible station and travels over the road network; a disconnected station cannot respond | FR-SRV-050, FR-SRV-094, FR-SRV-096 |
| QA-SRV-044 | The health shop category is opened | The player lists it | Hospital and Medical Center are both present | FR-SRV-051 |
| QA-SRV-045 | A hospital is upgraded | The player raises its level | Its area of effect and/or capacity increase and the old volume is replaced | FR-SRV-052 |
| QA-SRV-046 | The health shop is read at a low level | The player compares assets | The Medical Center is cheaper, unlocks earlier and has a strictly smaller area of effect than Hospital level 1 | FR-SRV-053 |
| QA-SRV-047 | A hospital definition is read | The developer reads its record | It has both an area of effect and a capacity | FR-SRV-054 |
| QA-SRV-048 | Science View healthcare is selected | The player reads the map | Covered area is green and uncovered area is white | FR-SRV-056 |
| QA-SRV-049 | A city has hospitals | The sim runs | Emergency wagons are visible in the city and visit covered buildings on a cycle | FR-SRV-057, FR-SRV-098 |
| QA-SRV-050 | A block has no health coverage | The sim runs | Its residents accrue a health deficit that POP can score | FR-SRV-058 |
| QA-SRV-051 | The education shop is opened | The player lists it | Elementary, Secondary and University are all present | FR-SRV-059 |
| QA-SRV-052 | A school is upgraded | The player raises its level | Its level card shows the new area of effect and capacity | FR-SRV-060 |
| QA-SRV-053 | An elementary school at level 5 is inspected | The player reads the card | 23 x 23 area of effect and 1 000 000 residents capacity | FR-SRV-061 |
| QA-SRV-054 | Elementary, secondary and university definitions are compared | The developer reads them | Secondary and university have larger radii and capacities; the university area is the largest | FR-SRV-062 |
| QA-SRV-055 | A residential block sits inside an elementary school's area | The solver runs | The block is connected to the elementary school system | FR-SRV-063 |
| QA-SRV-056 | A bus station is placed far from any school | The solver runs | It provides school connection to surrounding buildings and does not expand any school's area | FR-SRV-064 |
| QA-SRV-057 | School capacity falls below demand | The solver re-derives | All bus stations deactivate and provide no school connection | FR-SRV-065 |
| QA-SRV-058 | School capacity is raised above demand | The solver re-derives | The bus stations re-activate with no player action | FR-SRV-066 |
| QA-SRV-059 | A city has schools at several levels | The education tab is read | Capacity % equals the sum of the active levels' capacity against resident demand | FR-SRV-067 |
| QA-SRV-060 | A library and an art museum are placed | The solver runs | School quality in their area of effect rises | FR-SRV-069 |
| QA-SRV-061 | A residential block is education-covered | The bonus is evaluated | It gains the education income bonus and nothing else | FR-SRV-070 |
| QA-SRV-062 | Science View school is selected | The player reads the sidebar | Elementary / secondary / university sub-categories and the school bonus buildings are listed | FR-SRV-072 |
| QA-SRV-063 | Parks and a cinema are placed | The points solver runs | 1 point per 1 000 residents per category applies; the cinema counts once; repeatable parks stack | FR-SRV-074, FR-SRV-075 |
| QA-SRV-064 | The government panel is opened | The player looks for a parks coverage circle | No parks circle exists; parks are surfaced through the residence-bonus block | FR-SRV-076 |
| QA-SRV-065 | A parks coverage circle is added in a future build | The panel renders it | It uses the same solver, the same one-tile influence rule and the same circle gauge as the other services | FR-SRV-077 |
| QA-SRV-066 | A building carries culture and entertainment points | The bonus solver runs | Both categories are credited to that single building | FR-SRV-078 |
| QA-SRV-067 | The waste shop section is opened | The player lists it | Landfill, Recycling Station and Waste Incineration are all present | FR-SRV-079 |
| QA-SRV-068 | A landfill is the only waste building | Waste flows | Waste delivered to it simply ceases to exist, as the game explicitly accepts | FR-SRV-080 |
| QA-SRV-069 | A recycling station is upgraded | The player raises its level | Its removal throughput increases and the old value is replaced | FR-SRV-081 |
| QA-SRV-070 | A waste incinerator runs | The sim runs | It removes waste, produces energy for the city and emits pollution | FR-SRV-082 |
| QA-SRV-071 | An incinerator is placed outside industry | The pollution overlay is toggled | Its pollution footprint is shown so the player can verify the placement | FR-SRV-083 |
| QA-SRV-072 | The reference demo city is inspected | The waste balance is computed | The balance is approximately 1.77 ("177 % in use") and no happiness penalty applies | FR-SRV-086 |
| QA-SRV-073 | Waste removal falls below production | The sim runs | A service deficit is raised and fed to POP | FR-SRV-087 |
| QA-SRV-074 | A city produces waste | The sim runs | Garbage and freight trucks travel between producers and disposal buildings over the road network | FR-SRV-088, NFR-SRV-011 |
| QA-SRV-075 | Two maps exist and **both own a Harbor** | The waste panel is read on either map | Both maps show the **same pooled** waste figures (each map's production and removal summed) and each carries the globe icon | FR-SRV-089 |
| QA-SRV-076 | A map is globally connected | The economy panel is read | A globe icon is shown and global numbers are displayed | FR-SRV-090 |
| QA-SRV-077 | The Harbor is removed | The solver re-derives | The map leaves the global pool and map-local figures return | FR-SRV-091 |
| QA-SRV-078 | The infrastructure section is read | The player compares assets | C-Wire connects energy, Water Pipeline connects water, Harbor connects food + waste; they are independent | FR-SRV-092 |
| QA-SRV-079 | An emergency event occurs | The dispatcher runs | Only services that declare dispatchEnabled field vehicles; police fields none | FR-SRV-093 |
| QA-SRV-080 | An emergency vehicle travels | The path is inspected | The path uses MOB's road router and no second router exists | FR-SRV-095 |
| QA-SRV-081 | A station's staffing is defined | The developer reads it | The number of concurrent emergency vehicles is bounded by staffing | FR-SRV-097 |
| QA-SRV-082 | A service building is placed | The solver re-derives | Its coverage volume is added and the affected percentages update within one frame | FR-SRV-099, NFR-SRV-001 |
| QA-SRV-083 | A service building is upgraded in place | The solver re-derives | The old tier's volume is replaced by the new one; the union of old and new does not persist | FR-SRV-100 |
| QA-SRV-084 | A service building is moved | The solver re-derives | The old volume is removed before the new one is applied, so no building is ever covered from two positions at once | FR-SRV-101 |
| QA-SRV-085 | A hospital model is edited in SCC Studio | It is placed in the city | Radius, capacity and category are unchanged by the model edit | FR-SRV-104, NFR-SRV-009 |
| QA-SRV-086 | Capacity demand exceeds supply | The tab is read | A deficit flag is shown even when spatial coverage is 100 % | FR-SRV-105 |
| QA-SRV-087 | A city upgrade changes waste coefficients | The waste tab is read | Production and the balance metric update accordingly | FR-SRV-106 |
| QA-SRV-088 | The simulation is paused and fast-forwarded | The solver runs | Coverage results are identical in both cases | NFR-SRV-004 |
| QA-SRV-089 | A full city of coverage volumes is rendered | The overlay draws | Coverage geometry is instanced/batched rather than one draw call per tile | NFR-SRV-005 |
| QA-SRV-090 | A Science View overlay is toggled | The sim runs | The overlay is cheap to switch and does not mutate simulation state | NFR-SRV-006 |
| QA-SRV-091 | A city with services is saved and reloaded | The save is loaded | Coverage results, waste flows and global links are identical with no recomputation drift | NFR-SRV-008 |
| QA-SRV-092 | The service layer is reviewed | The developer audits it | It exposes covered-building counts and ratio metrics for ECO and POP and contains no economy or happiness formula | NFR-SRV-010 |
| QA-SRV-093 | Two maps exist, **map A owns a Harbor and map B owns none** | The waste panel is read on map B | Map B shows **its own** waste figures with **no globe icon**, and map A's waste is not included | FR-SRV-089 |
## 11. Open questions & TBDs
| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| OQ-SRV-01 | **[TBD]** What are the **coverage radii and capacities of the police station and the Police Department**? | Determines the whole security coverage geometry; no number is published. | Police Station 12 × 12 tiles / 25 000 residents; Police Department 20 × 20 tiles / 60 000 residents. Design placeholders. |
| OQ-SRV-02 | **[TBD]** What is the **fire department's area of effect**? | Fire coverage radius drives the fire-bonus economy of every city. | 14 × 14 tiles, capacity 40 000 residents. Design placeholder. |
| OQ-SRV-03 | **[TBD]** What are the **Medical Center and Hospital radii and capacities per level**? | Health care has both metrics; the tutorial gives neither. | Medical Center 10 × 10 / 15 000; Hospital L1 14 × 14 / 40 000, +4 tiles and +20 000 per level. Design placeholders. |
| OQ-SRV-04 | **[TBD]** What are the **school radii and capacities for every level** (elementary L1–L5, secondary, university)? | Only elementary L5 (23 × 23, 1 M residents) is evidenced. | Elementary 15→23 tiles and 100k→1 M by L5; secondary 25→33 tiles, 1.5 M→3 M; university 35→45 tiles, 3 M→6 M. Design placeholders. |
| OQ-SRV-05 | **[TBD]** **Which polarity is correct for the greyed-out coverage icon?** The police tutorial says greyed = not covered; the fire tutorial says not greyed = covered. | The building card must use one consistent rule. | Greyed = **not covered** (the police and health tutorials agree); treat the fire wording as a slip. |
| OQ-SRV-06 | **[TBD]** Does coverage have any **quality gradient** (closer = stronger bonus) or is it binary? | All evidence shows a binary covered/uncovered flag. | Binary coverage per service; no gradient. |
| OQ-SRV-07 | **[TBD]** Is there a **minimum service level** (e.g. one fire station per N buildings) enforced by the game, or is it entirely advisory? | Affects whether the game blocks or warns. | Advisory only; the panel shows the deficit, the game does not block construction. |
| OQ-SRV-08 | **[TBD]** Is there a **per-map cap** on the number of service buildings of one type? | Affects solver cost and whether stacking is exploitable. | No hard cap; solver cost bounded by incremental recomputation. |
| OQ-SRV-09 | **[TBD]** Does **terrain (water, cliffs) occlude service coverage**, or does influence pass over it? | Changes the coverage mask and the visual overlay. | Coverage passes over terrain; only the map border clips it. (No occlusion is ever mentioned.) |
| OQ-SRV-10 | **[TBD]** What are the **unlock levels** for each service building (Medical Center, Hospital, Police Department, Secondary, University, Incineration, Harbor)? | Gates the mobile stage matrix. | By resident count: Medical Center 500, Landfill 1 000, Fire 2 000, Elementary 3 000, Police Station 5 000, Hospital 15 000, Secondary 40 000, Recycling 60 000, Police Dept 100 000, University 200 000, Incineration 250 000, Harbor 50 000. Design placeholders. |
| OQ-SRV-11 | **[TBD]** Is there a **maximum building level** for each upgradeable service building? | Bounds the tier ladder data. | Hospital 5, Recycling 3, Elementary 5, Secondary 5, University 5, Police/Fire 3. Design placeholders. |
| OQ-SRV-12 | **[TBD]** What, if anything, **triggers an emergency dispatch** — fire incidents, crime, illness? No dispatch of any kind is documented in the shipped title (S40), so this is an open design decision rather than a gap in the research. | Determines whether FR-SRV-049, FR-SRV-050 and FR-SRV-093…098 ship at all. | Ship health-care patrol visits only (the one evidenced vehicle). Keep fire response and police response behind a disabled flag until a crime/fire event model exists. |
| OQ-SRV-13 | **[TBD]** What **quality bonus** do library / art museum / silo buildings grant, and over what area? | Quality bonuses alter the service bonus magnitude. | +10 % service quality within a 12 × 12 area for library / art museum; +15 % production within 8 × 8 for silos. Design placeholders. |
| OQ-SRV-14 | **[TBD]** What exactly does the waste panel's **"177 % in use"** figure represent, and how is it formatted? | It is the only published waste balance number and it is ambiguous. | `balance = removal ÷ production`, displayed as a percentage; >100 % means surplus removal capacity. |
| OQ-SRV-15 | **[TBD]** What is the **staffing model** for service buildings (staff per level, staff per emergency vehicle)? | Bounds dispatch capacity. | Staff = 8 × level; one emergency vehicle per 4 staff. Design placeholders. |
| OQ-SRV-16 | **[TBD]** How often do health-care emergency vehicles visit covered buildings? | Determines visible service activity. | One visit per covered building per in-game day, staggered. Design placeholder. |
| OQ-SRV-17 | **[TBD]** What is the **bus station's own connection radius**? | Bus stations grant school connection to "surrounding buildings" without a stated radius. | 10 × 10 tiles around the bus station, evaluated with the one-tile rule. Design placeholder. |
| OQ-SRV-18 | **[TBD]** What is the **pollution radius and magnitude** of a Waste Incineration plant? | Determines how strongly industrial siting is required. | Pollution field 10 × 10 tiles, magnitude proportional to throughput, halved inside industrial zones. Design placeholders. |
| OQ-SRV-19 | **[TBD]** What is the **area of effect of silo-style farm bonus buildings**? | Mirrors the general radius-bonus pattern for food. | 8 × 8 tiles. Design placeholder. |
| OQ-SRV-20 | **[TBD]** Will the **PC Early Access sandbox** eventually ship live coverage metrics, or only the building shells? | Determines whether the service solver must exist in the PC build at launch. | Ship the building shells and the Science View overlay in EA; defer live metrics to a future simulation mode. |
| OQ-SRV-21 | **[TBD]** Are police and fire coverage **independent** of each other, or does fire coverage imply security coverage? | Affects whether a player can cover fire but not police with one building. | Fully independent per service; no implication. |
| OQ-SRV-22 | **[TBD]** Does the education **connection** metric count by **building** or by **resident**? | Changes the denominator of the education access figure. | By resident (the resident is the beneficiary), consistent with the capacity metric being resident-based. |
| OQ-SRV-23 | **[TBD]** Will a **parks / leisure coverage circle** ever be added to the government panel, or do parks remain a points-only contributor? | Determines whether FR-SRV-077 is implemented or dropped. | No parks circle — keep parks as a recreation-points contributor only, matching the evidenced panel (electricity, water, food, waste, healthcare, police, fire, education). |
| OQ-SRV-24 | What is the demo city's **residential police coverage** figure? The auto-caption of the police tutorial renders it as "7 c %", between "92 %" (commercial) and "93 %" (industrial). | It is the only published security-coverage figure, and the caption is ambiguous enough that the rebuild must not assert a number it cannot read. | **[TBD]** — do not guess "71 %" or "70 %" from a mis-heard caption. The rebuild asserts only what it can read from a source: commercial 92 % and industrial 93 % are unambiguous; the residential figure is left unset and the QA row states that. Only affects the demo-city baseline; the mechanism is unaffected. |
| OQ-SRV-26 | Does a **dispatch subsystem** (emergency vehicles leaving a station for an incident) ship at all? | A keyword sweep of the police, fire and health-care transcripts returns zero occurrences of "engine", "truck", "ambulance", "dispatch", "respond", "car" or "patrol" (S40); the only emergency vehicle evidenced in the whole game is health care's "emergency wagon". | **[TBD — design decision].** Default for the rebuild: **no dispatch subsystem**. FR-SRV-093…098 are therefore optional extensions, not reconstructions; if dispatch is added later it shall be added as one coherent slice (pluggable per service, nearest eligible station, `MOB` road routing, connectivity gating, staffing bound). |

## 12. Source list
| # | URL | What it gave us | Retrieved |
|---|---|---|---|
| 1 | https://www.youtube.com/watch?v=tFmR_0w1OuQ | Police Department tutorial: decorative + bonus only, no crime; Police Department vs police station; coverage icons (greyed = uncovered); Science View police overlay colours; security panel local coverage 71/92/93 %; 100 % optimum | 2026-10-23 |
| 2 | https://www.youtube.com/watch?v=0wFTp0aDpQg | Fire Department tutorial: fire bonus on covered buildings; orbit-card check; Science View fire overlay (orange + red); fire tab local coverage per building category | 2026-10-23 |
| 3 | https://www.youtube.com/watch?v=4SlxOgZ67MU | Healthcare tutorial: Hospital (multi-level) vs Medical Center (cheaper, earlier, smaller area); emergency wagons; capacity vs local coverage (60 %); Science View health overlay (green/white) | 2026-10-23 |
| 4 | https://www.youtube.com/watch?v=PifQ_7vj7Ao | Education tutorial: three school levels; level-5 elementary = 23 × 23 area, 1 M residents; secondary/university larger; bus stations grant school connection and deactivate on capacity shortfall; library/art museum quality bonus; income bonus only as of v2.1.2 | 2026-10-23 |
| 5 | https://www.youtube.com/watch?v=HDjaWySDKOM | Waste tutorial: Landfill / Recycling Station (upgradeable) / Waste Incineration (energy + pollution); waste tab production by residential/commercial/industrial/government/farms plus removal; "177 % in use" | 2026-10-23 |
| 6 | https://www.youtube.com/watch?v=c3L7Qo8fdIM | Science View: full category list; orange providers; per-provider area highlight; question-mark help; school connection also via bus stops which deactivate on capacity shortfall; universal one-tile influence rule | 2026-10-23 |
| 7 | https://www.youtube.com/watch?v=jYAD0SkDmY0 | The Basics: government tabs list (electricity, water, food, waste, healthcare, police, fire, education); top-bar demand vs usage blocks (food 82 %, energy 56 %); building shop categories incl. parks; bulldozer categories; level = resident amount | 2026-10-23 |
| 8 | https://www.youtube.com/watch?v=CIb2IWyNPJw | Resident Bonuses: six bonus categories incl. recreation; 1 point per 1 000 residents; 250 % cap; unique-building counts once; "+" marker for repeatable buildings; cinema has culture + entertainment | 2026-10-23 |
| 9 | https://www.youtube.com/watch?v=m5O-A33wQm0 | Connected Economies: connectable = food, waste, water, energy; Harbor → global food + waste with globe icon and global numbers; C-Wire = energy; Water Pipeline = water; Harbor in infrastructure; currency shared across maps | 2026-10-23 |
| 10 | https://www.youtube.com/watch?v=6wWZxnm_YLk | Food Supply System: silo-style bonus buildings affect fields and animal enclosures within an area but not food factories — the generic radius-bonus pattern | 2026-10-23 |
| 11 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english | PC title: Early Access Q4 2026 as a construction sandbox; SCC Studio scope (buildings, vehicles, terrain sets, citizens, props); dev Sunapie Games; min/recommended specs | 2026-10-23 |
| 12 | https://steamcommunity.com/app/3474890/discussions/ | Forum index for app 3474890 — forums and topic counts; confirms **no service/utility thread exists**, so no PC-side service rules are published | 2026-10-23 |
| 13 | https://itunes.apple.com/lookup?id=1607860732&country=us | App Store listing: "Maintain the perfect balance of services and leisure"; 300+ structures; sandbox construction mode; region view; street view; monthly add-ons; v2.4.0 | 2026-10-23 |
| 14 | https://supercitycon.net/ | Official site: the mobile title is a separate game from the Steam title; "Small beginnings. Super cities."; Early Access Q4 2026 Windows & macOS; © 2026 Sunapie Games LLC | 2026-10-23 |
| 15 | shared research brief `docs/00-research-brief.md` §3.2, §3.3, §3.8, §3.9, §3.11, §4, §5 | Government panel circle-vs-bar semantics and the "not fully developed" state; 90 %/100 % usage-growth rule; silo-style radius bonuses; Harbor global waste; service category list; output contract and cross-domain ownership | 2026-10-23 |
