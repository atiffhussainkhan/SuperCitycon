# POPULATION, CITIZENS, HAPPINESS, WEALTH, DIVERSITY, LOYALTY — SuperCitycon Requirements
> Bot: BOT-05 · Domain code: POP · Status: COMPLETE
> Sources consulted: 12 source entries (14 distinct URLs) · Requirements: 115 FR / 12 NFR / 26 QA · Open questions: 14
>
> **Remediation note (requirement-level audit, 2026-10-23).** This file was re-checked against the verified
> source ledger and the official *Resident Bonuses* / *Happiness & Mayor Score* tutorials re-read directly.
> - **Happiness** is a derived composite whose **internal scale is [TBD]**; the 0–100 normalisation has been
>   removed (FR-POP-085). §7.3/§7.4 now carry an explicit scale `S` instead of a hard-coded 100.
> - **Emigration** (FR-POP-091/107), **households** (FR-POP-106) and the **citizen daily routine**
>   (FR-POP-018) are **not evidenced** and are now explicitly marked `[TBD — design decision]`; the documented
>   default in each case is "not implemented".
> - **The wealth average has one definition**: it is taken over the buildings that **carry** a wealth value;
>   wealth-neutral buildings are excluded (FR-POP-056) and therefore **do not dilute** it (FR-POP-061).
> - **The six-bonus combination and its ceiling are [TBD]** (FR-POP-078/079, OQ-POP-09). The dev blog article
>   **was** recovered from a Common Crawl capture and read (§12 source #11): it states the six bonuses "together
>   can scale up to x15" and carries an explicit "**Important Note: Per Map Calculation**" clause — but it
>   publishes **no** formula for how the six combine, and the tutorial publishes no maximum ("no one knows
>   what's the actual maximum of a map"). **The ceiling quote is recovered; the combination rule is not.**
>   Neither ×15 nor ×16 is asserted, and no combination formula appears in §2, §6 or §7.1.
> - **The ×15 headline and the 1500 % arithmetic disagree**, and this dossier does not paper over it: six
>   independently capped 250 % bonuses sum to 1500 %, which under an additive reading would be ×16. The
>   reconciliation is that the six maxima are **not simultaneously reachable** (§7.1) — so the tension is
>   **recorded, not resolved**, and that is exactly why the combination stays a `[TBD]` parameter.
> - **The 90 % boundary is one rule and it is owned by `ECO`**: `< 90` fine, `≥ 90` penalised, `= 100` frozen
>   (FR-ECO-064…067). POP carries no second copy of that curve; the 90–100 % **shape** is `ECO`'s `[TBD]` curve
>   (OQ-ECO-10), and the happiness-penalty wording conflict (the water tutorial says "over 90 %" where the
>   growth rule says "from 90 %") is recorded as **OQ-POP-14**.
> - **Diversity** is split into two rows with distinct outcomes — FR-POP-065 is the documented **point
>   deduction**, FR-POP-066 is the unevidenced **hard placement block**, now a design decision — and QA-POP-018
>   accepts exactly one outcome.
>
> **Reading note.** The population, economy, services, scoring and bonus systems of SuperCitycon are publicly
> documented only for the **mobile title** ("Super Citycon™: Build a City", Ben Willes Games SL, App Store id
> `1607860732`). The PC title (`SuperCitycon`, Steam app `3474890`) launches in Early Access as a **construction
> sandbox** whose store page states "Economy and progression systems are not yet included", so every simulation
> requirement below is marked **Mobile** or **Both** unless it is explicitly a **PC-EA** sandbox/editor feature.
> *Stage key: `Mobile` = live in the mobile title today · `Both` = live on mobile and intended for the PC
> simulation modes · `PC-EA` = PC Early Access scope only.*

## 0. Scope
- **In scope:** citizens as agents and their visible behaviour; citizen lifecycle (arrival, employment, migration,
  departure); residential capacity → resident count conversion; the citizen→need model; the **six residence growth
  bonuses** (culture, entertainment, recreation, wealth, diversity, loyalty) as first-class mechanics; **happiness**;
  **City Score**; **Mayor Score** and the Mayoral Match-Up leaderboard; residential tiers from the population side.
- **Out of scope (owned elsewhere, referenced only):** economy cost/tax/rate numbers and the demand-vs-usage bar model
  mechanics — `ECO`; service coverage geometry and the service building catalogue — `SRV`; building catalogue
  content, tiers and property schema — `BLD`; HUD/panel layout and top-bar composition — `UX`; traffic routing,
  vehicles and pedestrian pathing — `MOB`; terrain/water/grid — `WLD`; SCC Studio voxel editor and character authoring
  mechanics — `STD`; stage/unlock model and the level ladder itself — `CORE`.
- **Ownership boundary:** `POP` owns happiness and the score model; `SRV` owns coverage math and feeds `POP` and
  `ECO`; `BLD` owns building properties (including the culture/entertainment/recreation/wealth/diversity property
  values that `POP` consumes); `ECO` owns cost/tax.

## 1. Observed behaviour (evidence)
### 1.1 Source findings
| # | Finding | Status | Source URL |
|---|---|---|---|
| 1 | "Happiness is essentially a factor that's shaped from everything in your city … all your supply, it's the pollution situation … it's everything"; maximum happiness when everything is perfect. | [CONFIRMED] | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| 2 | "I won't give too much details about the weight of each because it's little bit different — not everything affects happiness in the same way." | [CONFIRMED] | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| 3 | "From happiness and the amount of residents combined we calculate your City score … the more residents you got at a higher happiness level, the higher is your City score." | [CONFIRMED] | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| 4 | A high City Score is reachable via "very happy people but not too much of them" **or** "much residents which are not too happy"; best is "a lot of residents that are very happy". | [CONFIRMED] | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| 5 | "So far no one figured out what's the maximum" — the maximum attainable City Score is an unsolved puzzle. | [CONFIRMED] | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| 6 | "All the city scores of your different cities in your region … all the cities of one region combined to your Mayor score for that region." | [CONFIRMED] | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| 7 | Mayor Score is shown **top-left** and again in the **government area, overview tab**; it is the figure used to "compete with other mayors". | [CONFIRMED] | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| 8 | The six residence bonuses are **culture, entertainment, recreation, wealth, diversity, loyalty**; "all those bonuses sum up to your residence bonus and increase your residence amount". | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 9 | "You need to satisfy your residence and get the full bonus of **250% for each category** … you need to have **one point per thousand residents** that live in your city" (e.g. 10,000 residents → 10 culture points). | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 10 | Culture/entertainment/recreation points come from buildings; a "**+**" symbol means multiple copies of that building on one map still score the bonus **for each one**; a **unique** symbol (e.g. cinema) scores **only once per map** no matter how many copies exist. | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 11 | Wealth: some buildings carry a wealth value shown as **one, two or three dollar signs** (levels 1–3); buildings with none are "neutral to the wealth system … they do not matter". | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 12 | "What matters essentially is the **average of all the buildings that have the wealth property** … the average is what decides how many of the bonus you get." | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 13 | Observed values: map wealth level **1.65** → **129%** bonus; wealth level **3** → the full **250%** bonus. | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 14 | Diversity: "you get **one diversity point for each unique building** that you've got on your map … to get 250 diversity points you need at least 250 different buildings". | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 15 | "You can't have more of **eight skyscrapers at a time** in your city … once you have more than eight of a skyscraper of a type you will get a **diversity penalty** … diversity points will be deducted." | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 16 | The building library already exceeds 250 types, so the diversity penalty can be absorbed up to a point — "that's the puzzle part of the game". | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 17 | Loyalty: "**twice a day, once in the morning once in the evening**, you can log into the game, care about your city each time you do that you will get **one loyalty point**." | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 18 | "If you stay away from your city longer as **24 hours** loyalty points will deduct … you will lose **one point per complete day** … that you stay away." Loyalty is "a long-term bonus that you collect over time"; new boost mechanics are "possible". | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 19 | "That translates to your overall resident bonus and your **residential capacity** will be increased by this amount, but also your **workspace spaces** … commercial and industrial … scale at the same level so this grows in parallel." | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 20 | The residence bonuses "came to the game in **version two**". | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 21 | Level: "we don't have XP points … to level up you simply need **more residents** … higher levels unlock more buildings." | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 22 | Usage bars: "the fuller the bar is the more you need of it … once it's completely full you run out of residential capacity"; "below **90%** you are fine, starting from **90%** usage it will reduce the growth of your city, once something is **100%** usage your city will not grow anymore." | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| 23 | Government overview categories: **energy supply, water supply, food supply, waste, health care, security, fire, school system**; shown as circles (coverage) alongside the usage/demand bars, where coverage should be **full**. | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| 24 | "Mayor score is the sum of all city scores of your region." | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| 25 | The old hidden residence scaling (reported as up to **×10** via the shared brief) was replaced by **six new bonuses "that together can scale up to x15"**; each bonus is independently calculated per map ("**all these bonuses are calculated independently for each map. Your progress and bonus levels are specific to each map and won't impact other maps**"), and each category is capped at 250 % ("Meeting these needs fully results in receiving the maximum bonus of 250% for each category"). The blog publishes **no** combination formula, so the ceiling itself remains **[TBD]** — OQ-POP-09. | [CONFIRMED] (per-bonus rules and the ×15 headline); [TBD] (the combination formula and the achievable ceiling) | https://index.commoncrawl.org/CC-MAIN-2024-51-index?url=supercitycon.net%2Fnew-bonuses-for-residence-growth%2F&output=json (index query) + https://data.commoncrawl.org/crawl-data/CC-MAIN-2024-51/segments/1733066116599.47/warc/CC-MAIN-20241213074100-20241213104100-00780.warc.gz (the WARC record itself — byte range 494166670, length 39681) — the archived capture of the live dev blog; the live URL now returns 404 — see §12 source #11 |
| 26 | Loyalty rule conflict: the shared brief states "missing **two consecutive days** deducts points"; the official tutorial states decay starts **after 24 hours away**, at one point per complete day away. | [TBD] — OQ-POP-06 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| 27 | App Store listing markets "**KEEP CITIZENS HAPPY**: Maintain the perfect balance of services and leisure to keep your citizens smiling" and "**MAYORAL MATCH-UP**: Compete globally to build the grandest city and climb the ranks". | [CONFIRMED] | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| 28 | App Store listing: "**GROW FROM FARM TO METROPOLIS**", "**REGION VIEW**: Seamlessly integrate multiple maps into one cohesive region", "**STREET VIEW** … Walk through your city and experience parks, bustling streets, and daily life up close", "over **300 unique structures**". | [CONFIRMED] | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| 29 | Steam page: "traffic move through your streets, **pedestrians follow the sidewalks**", and SCC Studio can "customize existing buildings, vehicles, terrain sets, **citizens** and props" — citizens are authored assets. | [CONFIRMED] | https://store.steampowered.com/app/3474890/ |
| 30 | Dev on per-citizen simulation: "one of them could definitely go much deeper into the individual people, their **life cycle, relationships, routines**"; modes planned: "a classical RCI mode, one that is more focused on resource management, and a very casual tycoon mode". | [CONFIRMED] | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| 31 | Dev: "people want the residents to **feel more like actual people and less like anonymous numbers** moving around the city"; "the hard part with this stuff is always **scaling**". | [CONFIRMED] | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| 32 | Dev on demand bars: a full bar means demand — "once it's completely full you run out of residential capacity"; commercial and industrial capacity are "workspaces". | [CONFIRMED] | https://store.steampowered.com/app/3474890/ |
| 33 | Two products are distinct: the mobile game "is a separate game from SuperCitycon on Steam"; the PC Early Access build is a construction sandbox and "Economy and progression systems are not yet included". | [CONFIRMED] (via shared brief §1) | https://supercitycon.net/ |
| 34 | The official How-To catalogue contains dedicated tutorials per system: Resident Bonuses, Happiness & Mayor Score, Economy Overview, The Basics, Education System, Healthcare, Fire, Police, Water/Energy/Food Supply, Waste Management, Science View, Camera Modes, Switching Maps, Income Bonuses, Connected Economies. | [CONFIRMED] | https://www.youtube.com/feeds/videos.xml?channel_id=UCb5PQ1wJm1XVukaSPya3qww |

### 1.2 Screens/flows observed
- **Government overview → residence bonus panel** (mobile): the six bonus categories (culture, entertainment, recreation,
  wealth, diversity, loyalty) are listed with their current values; their sum is the residence bonus. The wealth row
  shows the map's current wealth level and the resulting percentage; the diversity row shows the unique-building count.
  *Sources: `CIb2IWyNPJw`.*
- **Government overview → city/building card**: building cards carry a wealth indicator at the top (1–3 dollar signs),
  and culture/entertainment/recreation icons with either a "+" (stackable) or a unique marker. *Source: `CIb2IWyNPJw`.*
- **Top bar** (mobile): resident amount for the current map, level, date, and the usage/demand bar blocks; tapping a bar
  opens the per-category detail. *Sources: `jYAD0SkDmY0`, `LmY_TpU1B5Y`.*
- **Top-left HUD chip + Government → Overview tab**: both display the **Mayor Score**; the government view also lists
  the individual **City Scores** of the region's maps. *Source: `_QpxzZFTBtw`.*
- **City view (3D)**: pedestrians walk the sidewalks of residential and commercial streets; street/first-person views
  show citizens up close. *Sources: `store.steampowered.com/app/3474890/`, `apps.apple.com/.../id1607860732`.*

## 2. System overview
```
                              ┌──────────────────────────────────────────┐
   residential buildings ───▶ │  RESIDENCE BONUS  (six, summed, per map) │
   (tier capacity, BLD)       │  culture  ┐                                │
                              │  entertain│                                │
   commercial/industrial  ───▶│  recreatn │  Σ bonus%  ⇒ multiplier M      │
   (workspace capacity)       │  wealth   │  M = f(Σ bonus%)  [TBD]        │
                              │  diversity┤  (each category ≤ 250%)        │
   building diversity  ───▶   │  loyalty  ┘                                │
   (unique types, 8/type cap)└──────────────┬───────────────────────────┘
                                               │ multiplies
              ┌────────────────────────────────┴─────────────────────────────┐
              ▼                                                              ▼
   RESIDENT COUNT (per map)                                   WORKSPACE CAPACITY
   = floor(residential capacity × M)                           = base capacity × M
              │                                                              │
              │ needs (housing, energy, water, food, waste,                │ jobs
              │ health, security, fire, school, culture,                    ▼
              │ entertainment, recreation)                          EMPLOYMENT POOL
              ▼                                                              │
   ┌───────────────────────┐                                                │
   │      HAPPINESS        │◀── supply adequacy, service coverage,          │
   │  (composite, unequal  │    pollution, usage pressure                   │
   │   weights, 0..S)      │                                               │
   └───────────┬───────────┘                                               │
               │ residents × happiness                                      │
               ▼                                                           │
        ┌─────────────┐   Σ over all maps in the region                     │
        │ CITY SCORE  │────────────────────────────────────────────▶ MAYOR SCORE
        └─────────────┘                                                    │
               │                                                             ▼
               │                                        MAYORAL MATCH-UP (global leaderboard)
               ▼
   level (no XP)  ·  building unlocks
```
*The residence multiplier `M` is the one deliberate gap in this diagram: the six category bonuses sum to the
residence bonus (FR-POP-077), but **how that sum becomes `M` is a `[TBD]` parameter** (FR-POP-078/079,
OQ-POP-09) — no combination rule and no numeric ceiling is asserted anywhere in this document.*

## 3. Functional requirements
### 3.1 Resident count, level and capacity conversion
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-POP-001 | The player level shall be a direct function of **resident count**; the game shall **not** implement XP, skill points or an XP bar. | Must | Both | no | QA-POP-001 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-POP-002 | Resident count shall be shown for the **current map** in the top bar (value owned by `POP`, placement owned by `UX`). | Must | Both | no | QA-POP-002 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-POP-003 | Resident count shall be maintained **per map**; switching maps shall show that map's own population, not a region total. | Must | Both | no | QA-POP-002 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-004 | Raising the resident count shall raise the level, and higher levels shall unlock more buildings (unlock table owned by `CORE`/`BLD`). | Must | Both | no | QA-POP-001 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-POP-005 | The resident count shall be a **non-negative integer** displayed with thousands separators. | Should | Both | no | QA-POP-002 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-006 | Residents shall be **derived, never authored**: `residents = f(residential capacity, residence bonus)`; no direct "add population" player action shall exist. | Must | Mobile | no | QA-POP-003 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-007 | The residence bonus shall **multiply residential capacity** to produce the resident count (see §7.1). | Must | Mobile | no | QA-POP-003 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-008 | The **same** residence-bonus multiplier shall apply to **commercial workspace capacity**. | Must | Mobile | no | QA-POP-004 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-009 | The **same** residence-bonus multiplier shall apply to **industrial workspace capacity**; jobs therefore grow **in parallel** with residents rather than lagging behind them. | Must | Mobile | no | QA-POP-004 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-010 | When **any** tracked usage bar reaches **100 %**, the city shall **stop growing** and the resident count shall freeze. | Must | Both | no | QA-POP-005 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-011 | From **90 %** usage upward, growth shall be **reduced** (proportionally reduced resident inflow), reaching zero at 100 %. | Must | Both | no | QA-POP-005 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-012 | Growth shall resume, at full rate, once usage drops back below **90 %**. | Must | Both | no | QA-POP-005 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-013 | A **full demand bar** shall mean the corresponding capacity (residential / commercial workspaces / industrial workspaces) is exhausted and no further residents/workers can be absorbed. | Must | Both | no | QA-POP-005 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-014 | The population system shall consume these **seven** capacity/usage tracks: residential capacity, commercial workspaces, industrial workspaces, energy supply, water supply, food supply, waste management. | Must | Both | no | QA-POP-005 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-015 | The game shall start at **Day Zero**; the date/year counter shall advance and be readable, because loyalty decay and need evaluation are day-quantised. | Must | Both | no | QA-POP-010 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.2 Citizens as agents
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-POP-016 | Citizens shall exist as **visible pedestrian agents** that walk the sidewalk network of the city. | Must | Both | yes | QA-POP-006 | https://store.steampowered.com/app/3474890/ |
| FR-POP-017 | Citizens shall be **first-class assets**: SCC Studio shall be able to customise existing citizen models and create new ones, and placed creations shall appear in the city. | Should | PC-EA | yes | QA-POP-007 | https://store.steampowered.com/app/3474890/ |
| FR-POP-018 | **[TBD — design decision]** The citizen agent model **may** support an explicit **daily routine** (home → work → shop → leisure). No source evidences a citizen routine or citizen movement — the mobile store listing says only that the player watches "daily life up close", which is marketing copy, not a mechanic. If the rebuild simulates movement at all, the routine shape, its timings and durations are **[TBD]** — OQ-POP-01. | Could | Design | no | QA-POP-008 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| FR-POP-019 | A citizen shall be **employed** when a free commercial or industrial **workspace slot** exists; the slot pool shall be sized by commercial + industrial workspace capacity (§3.10). | Must | Mobile | no | QA-POP-009 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-020 | The number of **jobs** on a map shall be derived from workspace capacity, not authored; jobs shall therefore scale with the same residence-bonus multiplier as residents. | Must | Mobile | no | QA-POP-009 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-021 | The system shall represent **unemployment** (residents > jobs) as an explicit state, with unemployment visible in the population/happiness presentation. Threshold and presentation [TBD] — OQ-POP-02. | Should | Mobile | no | QA-POP-009 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-022 | The number of **rendered** pedestrians shall scale with the resident count, with a documented LOD/aggregation strategy so that large cities remain renderable (see NFR-POP-005). | Should | Both | yes | QA-POP-006 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-POP-023 | Citizen agents shall be **spawned and despawned around their home and workplace buildings** rather than being permanently resident objects; the routing inside the city is owned by `MOB`. Spawn thresholds [TBD] — OQ-POP-03. | Should | Both | no | QA-POP-008 | https://store.steampowered.com/app/3474890/ |
| FR-POP-024 | A **deep per-citizen simulation** (individual life cycle, relationships, personal routines) shall be modelled as a **separate, opt-in simulation mode**, not as the default economy mode. | Should | PC-EA | no | QA-POP-007 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-POP-025 | The game shall support at least three simulation modes with different citizen depth: **classic RCI**, **resource-management**, **casual tycoon**. | Should | PC-EA | no | QA-POP-007 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-POP-026 | Citizen presentation shall be varied enough that residents do not read as "anonymous numbers" (distinct silhouettes/wardrobes/animations within the voxel style). | Should | Both | yes | QA-POP-006 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-POP-027 | The citizen model shall be **scale-aware**: the simulation shall aggregate citizens above a configurable threshold and degrade to aggregate/count visualisation rather than dropping population numbers. | Should | Both | no | QA-POP-006 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |

### 3.3 Citizen needs and their satisfaction
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-POP-028 | The need model shall cover exactly these **twelve** categories: **housing, energy, water, food, waste, health, security, fire, school, culture, entertainment, recreation**. | Must | Both | no | QA-POP-010 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-029 | Each resident shall carry a **need record** per category with a satisfied/unsatisfied state and, where measurable, a satisfaction ratio. | Must | Both | no | QA-POP-010 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-030 | The **housing** need shall be satisfied by occupying a residence; a resident without housing shall be in an unhoused state and shall count as an unhappy resident. | Must | Mobile | no | QA-POP-010 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-031 | The **energy** need shall be satisfied by energy-supply coverage; energy is a usage track whose pressure at **90 % or above** also throttles growth (the same `< 90` / `≥ 90` / `= 100` split as FR-ECO-065/066). | Must | Both | no | QA-POP-010 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-032 | The **water** need shall be satisfied by water-supply coverage (water can be shared between maps in a region). | Must | Both | no | QA-POP-010 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-033 | The **food** need shall be satisfied by the two-stage chain **fields → farm animals → food** plus food industry; a shortfall shall reduce satisfaction. | Must | Mobile | no | QA-POP-011 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-034 | The **waste** need shall be satisfied by waste-management capacity; waste may be shared region-wide via the harbor. | Must | Mobile | no | QA-POP-011 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-035 | The **health** need shall be satisfied by health-care **coverage** (the government coverage circle). | Must | Mobile | no | QA-POP-011 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-036 | The **security** need shall be satisfied by police/security coverage. | Must | Mobile | no | QA-POP-011 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-037 | The **fire** need shall be satisfied by fire-department coverage. | Must | Mobile | no | QA-POP-011 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-038 | The **school** need shall be satisfied by the school system; education has a dedicated tutorial and its own service coverage. | Must | Mobile | no | QA-POP-011 | https://www.youtube.com/feeds/videos.xml?channel_id=UCb5PQ1wJm1XVukaSPya3qww |
| FR-POP-039 | The **culture** need shall be satisfied by culture points, and its points feed the culture growth bonus — the same building property serves both. | Must | Mobile | no | QA-POP-011 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-040 | The **entertainment** need shall be satisfied by entertainment points; a cinema may carry **both** culture and entertainment properties. | Must | Mobile | no | QA-POP-011 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-041 | The **recreation** need shall be satisfied by recreation points (parks and decorative/leisure content). | Must | Mobile | no | QA-POP-011 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-042 | Each of the eight **government coverage categories** (energy, water, food, waste, health, security, fire, school) shall expose a coverage circle that the player wants **full**; incomplete coverage ("this block is not fully developed") shall be representable. | Must | Mobile | no | QA-POP-012 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-043 | Unmet needs shall **reduce happiness**; the reduction shall be proportional to the size of the shortfall and shall not be applied per-need with equal weight (see FR-POP-087). | Must | Both | no | QA-POP-012 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-044 | Parks and leisure content shall satisfy the recreation need; replacing parks with dense residential towers is an explicit trade the game presents to the player. | Should | Mobile | no | QA-POP-012 | https://www.youtube.com/watch?v=CIb2IWyNPJw |

### 3.4 Bonus mechanics — culture, entertainment, recreation (the "points" trio)
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-POP-045 | Buildings shall be able to carry **culture**, **entertainment** and **recreation** point properties (values owned by `BLD`; consumption owned by `POP`). | Must | Mobile | yes | QA-POP-013 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-046 | Each of the three categories shall be computed **independently** — a city rich in parks is not automatically rich in entertainment. | Must | Mobile | no | QA-POP-013 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-047 | A **stackable** building (marked with "+") shall contribute its points **once per copy** on the map. | Must | Mobile | no | QA-POP-013 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-048 | A **unique** building (e.g. cinema) shall contribute its points **only once per map**, regardless of how many copies are placed. | Must | Mobile | no | QA-POP-013 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-049 | The number of points required for a category shall be **1 point per 1,000 residents** on that map, rounded up (`required = ceil(residents / 1000)`). | Must | Mobile | no | QA-POP-014 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-050 | The trio shall reach the **full 250 %** bonus for a category when available points ≥ required points. | Must | Mobile | no | QA-POP-014 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-051 | Each of the three categories shall be **capped at 250 %**; surplus points shall not increase the category beyond the cap. | Must | Mobile | no | QA-POP-014 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-052 | Partial coverage shall produce a **proportional** bonus between 0 % and 250 % (linear in points ÷ required). The exact curve [TBD] — OQ-POP-04. | Should | Mobile | no | QA-POP-014 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-053 | Point totals shall be **recomputed on every map change** (build, demolish, upgrade), so removing parks visibly reduces the recreation bonus and the residence bonus. | Must | Mobile | no | QA-POP-015 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-054 | The trio's requirement denominator (residents) shall itself use the **current** resident count, so the bonus is a moving target as the city grows. | Must | Mobile | no | QA-POP-014 | https://www.youtube.com/watch?v=CIb2IWyNPJw |

### 3.5 Bonus mechanics — wealth
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-POP-055 | Buildings shall optionally carry a **wealth property** with one, two or three **dollar signs**, i.e. **three wealth levels**. | Must | Mobile | yes | QA-POP-016 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-056 | Buildings **without** a wealth value shall be **neutral** and shall be **excluded** from the wealth average. | Must | Mobile | no | QA-POP-016 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-057 | The map's **wealth level** shall be the **arithmetic average of the wealth levels of all wealth-carrying buildings on that map**. | Must | Mobile | no | QA-POP-016 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-058 | A wealth level of **3** shall yield the full **250 %** wealth bonus. | Must | Mobile | no | QA-POP-016 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-059 | The wealth bonus shall be a **linear function of the map wealth level**; the only two published data points are level **1.65 → 129 %** and level **3 → 250 %**. The exact anchor at level 1 / 0 is [TBD] — OQ-POP-05. | Must | Mobile | no | QA-POP-016 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-060 | The building card shall display the building's wealth indicator (1–3 dollar signs) at the **top of the card**, and the government overview shall display the map's current wealth level and the derived percentage. | Should | Mobile | no | QA-POP-016 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-061 | The wealth average shall be computed over the **whole map** (not per district), over **only the buildings that carry a wealth value** — buildings without one are neutral and are **excluded** (FR-POP-056). A single wealthy tower can therefore pull the map average up; wealth-neutral buildings neither raise nor lower it. Source quote: "some of the buildings … do not have an actual wealth value … they are neutral to the wealth system, they do not matter. What matters essentially is the average of all the buildings that have the wealth property". | Must | Mobile | no | QA-POP-016 | https://www.youtube.com/watch?v=CIb2IWyNPJw |

### 3.6 Bonus mechanics — diversity
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-POP-062 | The map shall award **1 diversity point per unique building type** present on it (a type with 12 copies still counts once). | Must | Mobile | no | QA-POP-017 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-063 | Each diversity point shall be worth **1 %**, reaching the **250 %** cap at **250 unique building types**. | Must | Mobile | no | QA-POP-017 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-064 | The building library shall contain **more than 250 types** (mobile ships 300+ structures), so the diversity cap is reachable and surplus types are meaningful. | Must | Mobile | no | QA-POP-017 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| FR-POP-065 | Exceeding **eight skyscrapers of one type** shall **deduct diversity points** — the only documented outcome. Source quote: "once you have more than eight of a skyscraper of a type you will get a diversity penalty … diversity points will be deducted". Penalty magnitude and shape [TBD] — OQ-POP-07. | Must | Mobile | no | QA-POP-018 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-066 | **[TBD — design decision]** A **hard placement block** on the ninth skyscraper of a type is **not evidenced** — the only documented consequence of exceeding the limit is the diversity-point deduction (FR-POP-065). The default for the rebuild is **no hard block**: the ninth skyscraper is placeable and costs diversity points. If a hard cap is wanted, it shall be authored explicitly — OQ-POP-07. | Could | Design | no | QA-POP-018 | [TBD — design decision] |
| FR-POP-067 | The penalty shall be absorbable: a player with surplus unique types shall be able to exceed the per-type limit without losing the 250 % benefit, up to a limit the game leaves to the player to discover. | Should | Mobile | no | QA-POP-018 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-068 | The diversity count shall be **per map** and shall survive save/load unchanged. | Must | Mobile | no | QA-POP-019 | https://www.youtube.com/watch?v=CIb2IWyNPJw |

### 3.7 Bonus mechanics — loyalty
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-POP-069 | The player shall earn **1 loyalty point per login/city visit**. | Must | Mobile | no | QA-POP-020 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-070 | The player may earn **up to 2 loyalty points per day** — one for a morning session and one for an evening session. | Must | Mobile | no | QA-POP-020 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-071 | Loyalty shall be a **long-term accumulating** balance that persists across sessions and is not reset by city changes. | Must | Mobile | no | QA-POP-020 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-072 | Loyalty shall **decay** when the player stays away from the city for **more than 24 hours**, at a rate of **1 point per complete 24-hour day away**. | Must | Mobile | no | QA-POP-020 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-073 | The loyalty balance shall map **1 point = 1 %** of bonus and shall be **capped at 250 points / 250 %**. | Must | Mobile | no | QA-POP-020 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-074 | Decay shall be computed on **login reconciliation** using elapsed real time, so a player who closes the app for three days loses three points on return. The decay threshold is resolved to the **tutorial reading** (decay starts after 24 h away, one point per complete day away); the shared brief's "two consecutive missed days" is treated as a secondary, conflicting description — OQ-POP-06. | Must | Mobile | no | QA-POP-020 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-075 | The loyalty bonus shall be **per map**, like the other five: the dev blog states "**all these bonuses are calculated independently for each map. Your progress and bonus levels are specific to each map and won't impact other maps**". A login-visit mechanic is evaluated against the map the player is currently in. | Must | Mobile | no | QA-POP-020 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-076 | The game shall keep the door open for **additional loyalty boost mechanics** without breaking the 250 % cap. | Could | Mobile | no | QA-POP-020 | https://www.youtube.com/watch?v=CIb2IWyNPJw |

### 3.8 Combining the six bonuses
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-POP-077 | The six bonuses shall **sum** into a single **residence bonus**, shown as one figure in the government overview ("all those bonuses sum up to your residence bonus"). | Must | Mobile | no | QA-POP-013 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-078 | **[TBD — design decision]** The six residence bonuses shall combine into a single residence multiplier. The **combination rule is not published**: the tutorial says only that the bonuses "sum up to your residence bonus" and that "no one knows yet what's the actual maximum of a map", so whether the combination is additive or multiplicative is **[TBD]** — OQ-POP-09. No rule shall be assumed here. | Could | Design | no | QA-POP-013 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-079 | The published ceiling on the combined residence multiplier is **[TBD — design decision]**. The dev blog states the six bonuses "together can scale up to **x15**", but it publishes **no** formula for how six category bonuses combine and no per-category total; the tutorial likewise publishes no maximum ("no one knows what's the actual maximum of a map"), so **neither ×15 nor ×16 shall be hard-coded**. The combination rule and the achievable ceiling are one **[TBD]** — OQ-POP-09. | Could | Design | no | QA-POP-013 | [TBD — design decision]; https://index.commoncrawl.org/CC-MAIN-2024-51-index?url=supercitycon.net%2Fnew-bonuses-for-residence-growth%2F&output=json |
| FR-POP-080 | **[TBD — design decision]** The six bonuses shall **replace** the old hidden residence scaling, so no additional hidden scalar multiplier shall sit on top of the six. The recovered dev-blog text says only "we're replacing this old system with an innovative set of six new bonuses that together can scale up to x15"; the **value of the replaced factor** is not stated in the recovered text and stays **[TBD]** (the "up to ×10" figure is carried via the shared brief §3.6). The live blog URL now returns **404**; the article was read from the Common Crawl capture (§12 source #11). | Should | Mobile | no | QA-POP-013 | [TBD — design decision]; https://index.commoncrawl.org/CC-MAIN-2024-51-index?url=supercitycon.net%2Fnew-bonuses-for-residence-growth%2F&output=json |
| FR-POP-081 | **All six** residence bonuses shall be **independently calculated per map** — the dev blog states "all these bonuses are calculated independently for each map. Your progress and bonus levels are specific to each map and won't impact other maps" (see also FR-POP-075). | Must | Mobile | no | QA-POP-015 | https://index.commoncrawl.org/CC-MAIN-2024-51-index?url=supercitycon.net%2Fnew-bonuses-for-residence-growth%2F&output=json |
| FR-POP-082 | The game shall **not** expose a second, undisclosed growth scalar; the residence bonus displayed to the player shall be the whole truth about why resident capacity changed. | Must | Mobile | no | QA-POP-015 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-083 | The residence bonus shall be presented as a **trade-off puzzle**: the player can remove culture/entertainment/recreation content and rebuild with higher-yield residential or commercial buildings, trading score for raw capacity. | Should | Mobile | no | QA-POP-015 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-084 | Bonus values shall be shown **broken down per category** with their cap (250 %) so the player can see which category is short. | Must | Mobile | no | QA-POP-013 | https://www.youtube.com/watch?v=CIb2IWyNPJw |

### 3.9 Happiness
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-POP-085 | Happiness shall be a **single derived composite** for the map, "shaped from everything in your city". The **internal scale and representation are [TBD — design decision]** (OQ-POP-10): no source publishes a numeric range, so **no 0–100 scale shall be assumed**. The **weights** are likewise published only as a design decision (FR-POP-087). | Must | Both | no | QA-POP-012 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-086 | The composite shall include, at minimum, these measurable inputs: **supply adequacy** (all usage tracks), **service coverage** (the eight government circles), **pollution**, **housing adequacy**, and **unemployment**. | Must | Both | no | QA-POP-012 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-087 | The relative **weights of the inputs shall be unequal** — the dev states "not everything affects happiness in the same way" and withholds the weights. The exact weights are [TBD] — OQ-POP-10 (proposed default in §7.3). | Must | Both | no | QA-POP-012 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-088 | Happiness shall reach its **maximum** only when every input is perfect everywhere ("if everything is perfect everywhere you will achieve the maximum happiness"). | Must | Both | no | QA-POP-012 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-089 | Usage at **90 % or above** shall have a **negative effect on happiness** (and therefore on Mayor Score), not only on growth. The **growth** rule is unambiguous ("starting from 90 % usage it will reduce the growth of your city"), but the water tutorial phrases the happiness / Mayor-Score penalty as "over 90 %"; the exact threshold for the **happiness** penalty is therefore **[TBD]** — OQ-POP-14. Until it is resolved, `POP` implements the **same** `< 90` / `≥ 90` split as `ECO` (FR-ECO-064/065). | Must | Mobile | no | QA-POP-013 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-090 | Happiness shall be **readable by the player** as a single figure plus per-contribution breakdown; surface and breakdown layout owned by `UX`. | Must | Both | no | QA-POP-012 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-091 | **Low happiness** shall reduce the map's City Score. Whether sustained low happiness also causes **emigration** is a separate, **unevidenced** design decision — see FR-POP-107. | Must | Both | no | QA-POP-012 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-092 | Happiness shall be a **per-map** value; a region-level happiness figure shall be derivable (mean or capacity-weighted) for the region summary. | Must | Mobile | no | QA-POP-012 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-093 | Happiness shall be evaluated on the **game clock** (day quantisation) rather than per frame, to keep the composite stable and cheap. | Should | Both | no | QA-POP-012 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |

### 3.10 City Score, Mayor Score and the leaderboard
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-POP-094 | **City Score** shall be computed from **two inputs**: the map's resident count and the map's happiness. | Must | Mobile | no | QA-POP-021 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-095 | City Score shall **increase** with residents at fixed happiness. | Must | Mobile | no | QA-POP-021 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-096 | City Score shall **increase** with happiness at fixed residents. | Must | Mobile | no | QA-POP-021 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-097 | The two inputs shall act as **substitutes**: a small, very happy city and a large, unhappy city shall be able to reach comparable City Scores; the optimum is "a lot of residents that are very happy". Exact curve [TBD] — OQ-POP-12 (proposed default in §7.4). | Must | Mobile | no | QA-POP-021 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-098 | The **maximum attainable City Score shall not be documented** by the game; the build shall keep the optimum discoverable but not publish a target value. | Should | Mobile | no | QA-POP-021 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-099 | **Mayor Score** shall be the **sum of the City Scores of all maps in the player's region**. | Must | Mobile | no | QA-POP-022 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-100 | Mayor Score shall be displayed **top-left** in the HUD and again in the **government overview tab**, and the overview shall list the **individual City Scores** of the region's maps. | Must | Mobile | no | QA-POP-022 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-101 | The **Mayoral Match-Up** shall be a **global leaderboard** ranking players by Mayor Score. | Must | Mobile | no | QA-POP-023 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| FR-POP-102 | A **region** shall be the grouping unit for Mayor Score; the region shall be player-visible and shall support multiple maps ("not all of them possibly, we will launch new regions soon"). | Must | Mobile | no | QA-POP-022 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-103 | The region shall support at least the two economies documented for the mobile title: **Region View** joining multiple maps, and **connected economies** (food/waste via harbor, energy via C-Wire, water by manual link). | Should | Mobile | no | QA-POP-022 | https://www.youtube.com/feeds/videos.xml?channel_id=UCb5PQ1wJm1XVukaSPya3qww |
| FR-POP-104 | Leaderboard submission shall transmit only the **scores and region identity**, never citizen-level data. | Must | Mobile | no | QA-POP-023 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |

### 3.11 Residential tiers, capacity and failure states
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-POP-105 | Residential buildings shall contribute **tier capacity** (residents held per building tier); the tier ladder itself is owned by `BLD`, the capacity value is consumed by `POP`. | Must | Mobile | yes | QA-POP-024 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-POP-106 | **[TBD — design decision]** **Households** — a residential building partitioned into household units whose count derives from tier capacity — are **not evidenced** for the shipped build; the only mention is a possible future "deep people" mode on the dev's Steam thread. The default for the rebuild is **per-building capacity without households**. If implemented, the household-size distribution is **[TBD]** — OQ-POP-13. | Could | Design | no | QA-POP-024 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-POP-107 | **[TBD — design decision]** **Emigration** — reducing the resident count when happiness is sustained below a threshold or a need is critically unmet — is **not evidenced**: no source states that residents leave the city. The default for the rebuild is **no emigration** (the resident count only grows). If the rebuild implements it, the trigger (happiness threshold, rate or per-tick probability) and the magnitude are **[TBD]** — OQ-POP-11. | Could | Design | no | QA-POP-025 | [TBD — design decision] |
| FR-POP-108 | **Immigration / arrival** shall increase the resident count when capacity, supply and happiness allow, respecting the 90 %/100 % usage throttle. | Must | Both | no | QA-POP-025 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-109 | The system shall recognise **population stagnation at the 100 % usage ceiling** as a distinct, recoverable failure state: residents stop arriving, the level stops rising, and no new buildings unlock, until usage is reduced. | Must | Both | no | QA-POP-025 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-110 | The system shall recognise **happiness collapse**: simultaneous unmet needs drive happiness down, which lowers the map's City Score and (through `ECO`) its revenue, and can spiral. The game shall surface the cause, not only the symptom. Emigration is **not** part of this behaviour (FR-POP-107 — it is not implemented): the resident count does not fall. | Must | Both | no | QA-POP-025 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-POP-111 | The system shall recognise the **supply-shortage stall**: a partially met need throttles growth (90–100 % usage band) rather than stopping it outright, and shall distinguish "growing slowly" from "capped". | Must | Both | no | QA-POP-025 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-POP-112 | The system shall recognise the **diversity penalty spiral**: hoarding a single high-rise type reduces the diversity bonus and therefore reduces capacity, which can shrink the city below the level needed to recover. | Should | Mobile | no | QA-POP-018 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-113 | The system shall recognise the **loyalty decay spiral**: absence erodes the bonus, shrinking capacity, while the player is not present to fix the city. | Should | Mobile | no | QA-POP-020 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-POP-114 | Demolishing a residence shall **reduce residential capacity**, and the residents it held shall be **released** — the resident count is re-derived from the reduced capacity, so no resident stays attached to a building that no longer exists. Demolition is a capacity change, **not** the emigration mechanic of FR-POP-107 (which is not implemented). | Must | Both | no | QA-POP-026 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-POP-115 | The system shall recognise **idle capacity**: residential capacity with no demand yields no residents and should not be scored as population; the player-facing hint ("full bar = demand") remains the signal. | Should | Both | no | QA-POP-026 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |

## 4. Options, variants & configuration matrix
### 4.1 The six residence bonuses
| Bonus | Source input | Unit | Per-map or account | Cap | Notes |
|---|---|---|---|---|---|
| Culture | culture points on buildings | points | per map | 250 % | 1 point per 1,000 residents |
| Entertainment | entertainment points on buildings | points | per map | 250 % | 1 point per 1,000 residents; a cinema can carry culture + entertainment |
| Recreation | recreation points on buildings (parks/leisure) | points | per map | 250 % | 1 point per 1,000 residents |
| Wealth | wealth property on buildings (1/2/3 $) | avg level → % | per map | 250 % | wealth-less buildings excluded from the average; 1.65 → 129 %; 3 → 250 % |
| Diversity | unique building types present | points (1 per type) | per map | 250 % | 250 unique types; max 8 skyscrapers per type; exceeding → penalty |
| Loyalty | login cadence | points (1 per visit, ≤2/day) | per map | 250 % | decay 1 point per complete day away after >24 h; **per map, like the other five** (FR-POP-075) |

### 4.2 Building point contribution modes
| Mode | Marker | Contribution | Example |
|---|---|---|---|
| Stackable | "+" on the card | points × number of copies on the map | park, plaza |
| Unique | distinct icon | points × 1 regardless of copies | cinema |

### 4.3 Citizen need categories
| Need | Satisfied by | Track type | In government overview | Failure signal |
|---|---|---|---|---|
| Housing | residence occupancy | capacity | no (top bar) | unhoused citizens (emigration is not implemented — FR-POP-107) |
| Energy | energy supply | usage bar | yes (circle) | ≥ 90 % usage ⇒ growth throttle |
| Water | water supply | usage bar | yes | ≥ 90 % usage ⇒ growth throttle |
| Food | fields → animals → food (+ industry) | usage bar | yes | shortfall, unhappiness |
| Waste | waste management | usage bar | yes | backlog, unhappiness |
| Health | health-care buildings | coverage | yes | incomplete circle |
| Security | police/security buildings | coverage | yes | incomplete circle |
| Fire | fire department | coverage | yes | incomplete circle |
| School | school system | coverage | yes | incomplete circle |
| Culture | culture buildings | points | no (bonus panel) | points < required |
| Entertainment | entertainment buildings | points | no (bonus panel) | points < required |
| Recreation | parks / leisure | points | no (bonus panel) | points < required |

### 4.4 Citizen agent states (implemented)
| State | Meaning | Visible as | Owner |
|---|---|---|---|
| Resident | occupies a residence | pedestrian at home | POP |
| Employed | holds a commercial/industrial workspace slot | commuter walking to work | POP + MOB |
| Unemployed | resident without a workspace slot | idler / commuter to no job | POP |
| Unhoused | resident with no residence | transient | POP |

### 4.5 Reserved — future deep-simulation states (**not implemented**)
The states below are **not** part of the shipped build and **must not be built** from this table. They are
reserved for the future deep per-citizen simulation mode (FR-POP-024/FR-POP-025) and for the two unevidenced
design decisions FR-POP-106 (households) and FR-POP-107 (emigration). No source evidences a citizen daily
routine, a shopping/leisure state or a departure behaviour; the App Store listing's "daily life up close" is
marketing copy, not a mechanic.

| State (reserved) | Meaning | Why it is reserved | Owner |
|---|---|---|---|
| Shopping | at a commercial building during a retail window | part of the unevidenced daily routine — FR-POP-018, OQ-POP-01 | POP + MOB |
| Leisure | at a park / culture / entertainment building | part of the unevidenced daily routine — FR-POP-018, OQ-POP-01 | POP + MOB |
| Leaving | departing the city | emigration is not implemented — FR-POP-107, OQ-POP-11 | POP |
| Entering | entering the city | a pedestrian arrival animation is not evidenced; arrivals are a **count** change (FR-POP-108), not an agent state | POP + MOB |

### 4.6 Score surfaces
| Surface | Value | Owner of layout |
|---|---|---|
| Top-left HUD chip | Mayor Score | UX |
| Government → Overview tab | Mayor Score + list of per-map City Scores | UX |
| Government → residence bonus panel | the six bonuses and their sum | UX |
| Top bar | resident count, level, date | UX |
| Mayoral Match-Up | global Mayor Score leaderboard | UX + CORE |

## 5. Progression matrix (population axis = level, from resident count)
Population has **no independent stage ladder**: it is driven by the city level — a **direct function of the
resident count** (FR-POP-001) — and by the simulation mode.

The **Village / Town / City / Metropolis** names are **store copy about map scale**, not a population taxonomy
(FR-CORE-046; the shared brief §4). No threshold for them was ever published, so **no requirement in this
document is derived from them and no population thresholds are asserted here**. The only progression gate the
game actually shows is the **level derived from resident count**; the level thresholds themselves are owned by
`CORE`/`BLD`, and `POP` only consumes the level ↔ resident-count mapping and publishes the resident count.

| Progression axis | Entry condition | Population state | Bonuses available | Player can rebuild/modify | Unlocks | Exits when |
|---|---|---|---|---|---|---|
| **Level 1 — first residents** | the first residence is placed and the first resident arrives | the resident count comes from the residence's tier capacity (FR-POP-105); no employment pool yet; every need unmet | all six are visible and **per map**, all at 0 % — loyalty starts at **0** on a new map (FR-POP-075) | yes | level-gated building unlocks (the unlock table is owned by `CORE`/`BLD`) | the resident count crosses the next level threshold |
| **Level N (N ≥ 2)** | the resident count crosses level N's threshold | the resident count rises; the employment pool grows with commercial + industrial workspace capacity (FR-POP-019/020); need coverage becomes the binding constraint | all six accumulating **per map**; diversity becomes meaningful as the count of distinct placed building types grows; the wealth average becomes meaningful as wealth-carrying buildings accumulate | yes | level-gated unlocks (`CORE`/`BLD`) | the next level threshold |
| **Region — several maps** | the player owns more than one map in one region | per-map populations; the region's population is the sum of its maps' populations | **all six bonuses are per map** (FR-POP-081, FR-POP-075); the region total is not a stack of them | yes | connected economies (harbor / C-Wire / water link) | a new region is released (dev: "we will launch new regions soon") |
| **Deep-people mode (PC, planned)** | the player opts into the deep per-citizen simulation mode | per-citizen life cycle, relationships and routines — **not implemented**; no such mode ships today | the same per-map bonuses | yes | the deep simulation itself | n/a — mode-specific |

**Not implemented, and therefore not part of any progression axis:** households (FR-POP-106), happiness-driven
emigration (FR-POP-107) and the citizen daily routine (FR-POP-018). The data-model fields reserved for them are
listed in §6.1 and **must not** be built from this table.

## 6. Data model
| Entity | Field | Type | Range / domain | Meaning | Source |
|---|---|---|---|---|---|
| `Residence` | `buildingId` | id | BLD catalogue id | owning building | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `Residence` | `tierCapacity` | int | ≥ 0 | residents this tier can hold | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `Citizen` | `id` | id | — | individual resident | https://store.steampowered.com/app/3474890/ |
| `Citizen` | `jobId` | id / null | nullable | occupied workspace slot | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `Citizen` | `needs[]` | map<need, ratio> | 0..1 | per-category satisfaction | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| `Citizen` | `state` | enum | resident/employed/unemployed/unhoused | employment/housing state only — the daily-cycle states are **not implemented** (§6.1, §4.5) | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `Citizen` | `appearanceId` | id | SCC Studio asset | citizen model/skin | https://store.steampowered.com/app/3474890/ |
| `NeedDef` | `id`, `category` | id, enum | 12 categories | need registry | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| `NeedStatus` | `needId`, `satisfied`, `shortfall` | id, bool, 0..1 | per map | aggregate demand vs supply | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| `BonusAccumulator` | `culturePoints` | int | ≥ 0 | sum of culture points (copy-weighted) | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `BonusAccumulator` | `entertainmentPoints` | int | ≥ 0 | sum of entertainment points | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `BonusAccumulator` | `recreationPoints` | int | ≥ 0 | sum of recreation points | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `BonusAccumulator` | `cultureBonusPct` … `loyaltyBonusPct` | float | 0..250 | per-category bonus percent | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `BonusAccumulator` | `requiredPoints` | int | ceil(residents/1000) | points needed for full bonus | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `BonusAccumulator` | `totalBonusPct` | float | **[TBD]** — the Σ of the six per-category percentages shown as the residence bonus; the **ceiling and the conversion into the residence multiplier are [TBD — design decision]** (FR-POP-078/079) and neither ×15 nor ×16 may be assumed | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `WealthState` | `buildingValues[]` | list<float> | 1..3 per building | wealth-carrying buildings only | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `WealthState` | `averageLevel` | float | 0..3 | map wealth level (1.65 observed) | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `DiversityState` | `uniqueTypeIds` | set<id> | — | one entry per distinct building type | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `DiversityState` | `perTypeCounts` | map<id,int> | int | copies per type, compared against the cap of 8 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `DiversityState` | `penaltyPoints` | int | ≤ 0 | negative value deducted from the diversity point total | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `LoyaltyState` | `mapId` | id | one record **per map** | loyalty is keyed per map, like the other five bonuses (FR-POP-075, FR-POP-081) | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `LoyaltyState` | `points` | int | 0..250 | loyalty balance **of that map** | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `LoyaltyState` | `lastSessionAt`, `lastMorningClaimed`, `lastEveningClaimed` | timestamp, bool, bool | — | daily login reconciliation | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `PopulationSnapshot` | `residents` | int | ≥ 0 | resident count for the map | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `PopulationSnapshot` | `residentialCapacity`, `commercialCapacity`, `industrialCapacity` | int | ≥ 0 | base capacities before the bonus multiplier | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `PopulationSnapshot` | `jobs`, `employed`, `unemployed` | int | ≥ 0 | employment pool | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| `HappinessState` | `value` | float | **0..S** — `S` is the composite's internal scale, **[TBD]** (FR-POP-085 / OQ-POP-10); no source publishes a numeric range | composite happiness | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| `HappinessState` | `contributions[]` | map<factor, float> | sum = value | per-factor contributions (weights internal) | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| `ScoreRecord` | `mapId`, `residents`, `happiness`, `cityScore` | id, int, float, float | — | per-map City Score snapshot | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| `RegionRecord` | `regionId`, `mapIds[]`, `mayorScore` | id, list, float | — | Mayor Score = Σ City Scores | https://www.youtube.com/watch?v=_QpxzZFTBtw |

### 6.1 Reserved — **not implemented** (design stage only)
**Nothing in this table is implemented and nothing in it may be built.** The entries are reserved for the future
deep per-citizen simulation mode (FR-POP-024/FR-POP-025) and for the two unevidenced design decisions
**FR-POP-106** (households) and **FR-POP-107** (emigration); the third, **FR-POP-018** (citizen daily routine),
covers the reserved agent states in §4.5. No source evidences a household concept, a happiness-driven departure
or a citizen routine, and the documented default in each case is **"not implemented"**.

| Reserved entity / field | Type | Why it is reserved | Decision row |
|---|---|---|---|
| `Household` | entity with an id, a residence link and a size | a residence partitioned into household units is unevidenced; the shipped build tracks capacity per building | FR-POP-106, OQ-POP-13 |
| residence → household link | list | would exist only if households are implemented | FR-POP-106, OQ-POP-13 |
| citizen → household link | id | would exist only if households are implemented | FR-POP-106, OQ-POP-13 |
| citizen daily-cycle state | enum (home → work → shop → leisure) | no source evidences a citizen routine or citizen movement | FR-POP-018, OQ-POP-01 |
| happiness-driven departure counter | int | no source states that residents leave the city | FR-POP-107, OQ-POP-11 |

## 7. Rules, formulas & tuning
### 7.1 Residence bonus and resident count
```
requiredPoints(cat) = ceil(residents / 1000)                    # 1 point per 1,000 residents
points(cat)         = Σ over placed buildings: value × copies
                       # stackable building ⇒ copies = number placed;
                       # unique building    ⇒ copies = 1 regardless of how many are placed
pointsBonusPct(cat) = min(250, floor(250 × points / required))    # partial credit: OQ-POP-04
                       (= 250 when points ≥ required — the requirement is the 250 % threshold,
                        not the 100 % one; 3 of 10 points ⇒ 75 %)

wealthLevel    = average(wealthLevelOf(b) for b in map if b has wealth property)
wealthBonusPct = clamp(floor(250 × (wealthLevel − L0) / (3 − L0)), 0, 250)   # L0 TBD — OQ-POP-05
diversityPts   = uniqueBuildingTypes + diversityPenaltyPoints   # penaltyPoints ≤ 0 (a deduction)
diversityPct   = clamp(min(250, diversityPts), 0, 250)           # 1 point = 1 %
loyaltyPct     = clamp(loyaltyPoints, 0, 250)                     # 1 point = 1 %

residenceBonusPct = culturePct + entertainmentPct + recreationPct
                   + wealthPct + diversityPct + loyaltyPct   # the six "sum up to your residence bonus"
                   #  → COMBINATION [TBD]: how residenceBonusPct becomes the residence
                   #    multiplier M is an explicit [TBD — design decision] parameter
                   #    (FR-POP-078 / FR-POP-079 / OQ-POP-09). No additive rule, no
                   #    multiplicative rule and no numeric ceiling is asserted here.

residents         = floor(residentialCapacityBase × M)   # M is the [TBD] combination result
                                                        # (capped by demand (ECO) and by the usage throttle)
commercialJobs    = floor(commercialCapacityBase × M)
industrialJobs    = floor(industrialCapacityBase × M)
```
Rounding: the published data point (wealth level 1.65 → **129 %**) is consistent with **floor**ing a linear
interpolation of ≈129.46 %, and with **floor**ing 129.46 in the trio formula; no source states the rule, so
`floor` is a **proposed default** (OQ-POP-05).

**The combination of the six bonuses is a `[TBD]` parameter, not a formula.** The six per-category rules above
*are* evidenced (each category is capped at 250 %); what is **not** published is how the six combine into one
multiplier. Two published statements pull in different directions and this dossier leaves that tension open:

- the recovered dev-blog text says the six bonuses "together can scale up to **x15**";
- six independently capped 250 % bonuses sum to **1500 %**, which under an additive reading would be **×16**.

The reconciliation the evidence supports is that the six maxima are **not simultaneously reachable**:
culture / entertainment / recreation need **1 point per 1,000 residents** while the bonus multiplies residents
(a moving target, FR-POP-054); diversity needs **250 distinct building types** while penalising more than
**eight** of any one type (FR-POP-065); wealth needs **every** wealth-carrying building at level 3 (FR-POP-058).
So the ×15 headline is not simply the sum of the six caps — but the blog publishes no formula, so the
combination stays a `[TBD]` **decision to be made**, and **neither ×15 nor ×16 is hard-coded** (FR-POP-078,
FR-POP-079, OQ-POP-09). A builder must not read a combination rule out of this document.

### 7.2 Loyalty clock
```
onSessionStart(now):                                        # run for the map the player is in
    elapsed = now − lastSessionAt                           # the per-map loyalty record (FR-POP-075)
    daysAway = 0 if elapsed ≤ 24h else floor(elapsed / 24h)   # decay starts only *after* 24 h
    if daysAway ≥ 1:  points = max(0, points − daysAway)        # "one point per complete day" away
    grant = (morningSession ? 1 : 0) + (eveningSession ? 1 : 0) # ≤ 2 per calendar day
    points = min(250, points + grant)
```
Whether the decay clock starts at 24 h (tutorial) or after two missed days (shared brief) is **OQ-POP-06**; the
tutorial is the more specific statement and is the proposed default.

### 7.3 Happiness composition (proposed default — weights are not public)
```
inputs (each normalised 0..1):
    supplyAdequacy   = 1                  if maxUsagePct < 90          # below 90 %: no usage pressure
                    = g(maxUsagePct)     if 90 ≤ maxUsagePct ≤ 100    # the shared [TBD] curve from `ECO`
    serviceCoverage  = weighted mean of the 8 government coverage circles
    housingAdequacy  = min(1, residents / housingCapacity)
    employmentRate   = employed / max(1, residents)
    pollutionIndex   = 1 − normalised pollution load

H = S × Σ wᵢ × inputᵢ ,  Σ wᵢ = 1
S = the composite's internal scale — [TBD] (FR-POP-085 / OQ-POP-10)
    proposed default (a decision to be made, not a published value): S = 100
proposed weights: supplyAdequacy 0.30 · serviceCoverage 0.30 · housingAdequacy 0.15
                  employmentRate 0.10 · pollutionIndex 0.15
```
The tutorial states only that happiness is shaped from everything, that the weights are **unequal** and
**undisclosed**, and that maximum happiness requires everything perfect. The weights above are a **proposed
default** (OQ-POP-10) chosen to satisfy: (a) an unequal-weight profile, (b) H = S only when every input is 1,
(c) supply and coverage dominate because those are the levers the tutorial demonstrates. The scale `S` is a
**design decision** — no source publishes a numeric range, so the rebuild must not assume 0–100 (FR-POP-085).
**Every expression that mentions happiness is written against `S`, never against a hard-coded maximum.**

`g` in `supplyAdequacy` is the **single shared curve owned by `ECO`** (FR-ECO-067 / OQ-ECO-10): `g(u) = 1.0`
for `u < 90`, `0 < g(u) < 1.0` for `90 ≤ u < 100` and `g(100) = 0`. Its **shape is [TBD]**. `POP` therefore does
**not** define its own usage→penalty curve, and the linear `(100 − u)/10` form is **excluded** — it would give
`g(90) = 1.0`, i.e. happiness *perfect* at the very point where growth is already penalised. The boundary is
fixed: happiness pressure **starts at 90 %**, not after it (the water tutorial's "over 90 %" wording for the
happiness penalty is recorded as **OQ-POP-14**).

### 7.4 City Score and Mayor Score (proposed default — curve not published)
```
CityScore(map)   = round(residents × (H / S)^γ)       # γ = 1 by default; S = the happiness scale (OQ-POP-10)
                    ≡ "effective happy population"
                    (a small very happy city ≈ a large unhappy city — as the tutorial states)
MayorScore(region) = Σ CityScore(map) over all maps in the region
```
`γ` controls how strongly happiness is weighted. `γ = 1` reproduces the tutorial's substitutability claim exactly
(10,000 residents at H = S/2 ⇒ 5,000; 5,000 residents at H = S ⇒ 5,000 — the same two points, written against
the scale `S` rather than against a hard-coded 100). If the real game weights happiness more
strongly than linearly, γ > 1; the value is **OQ-POP-12**.

### 7.5 Growth throttle (interface to `ECO`/`MOB`)
```
usagePct(t) for t ∈ {energy, water, food, waste, residential, commercial, industrial}
growthFactor = 1                       if max(usagePct) < 90        # nominal growth
             = g(max(usagePct))         if 90 ≤ max(usagePct) < 100 # 0 < g < 1 — curve [TBD], OQ-ECO-10
             = 0                       if max(usagePct) ≥ 100      # city stops growing
residents += round(arrivals × growthFactor × housingFactor × happinessFactor)
```
`g` is the **single shared curve owned by `ECO`** (FR-ECO-067). Its shape is **[TBD]**: the linear
`(100 − u)/10` form is **excluded**, because it would give `g(90) = 1.0` and contradict the tutorial
("starting from 90 % usage it will reduce the growth of your city"). The only fixed points are
`g(u) = 1.0` for `u < 90` and `g(100) = 0`.

`happinessFactor` is the **immigration** gate (FR-POP-108). **Emigration is not implemented**
(FR-POP-107, OQ-POP-11): the resident count only grows.

## 8. Edge cases, failure modes & required behaviours
| # | Edge case | Required behaviour | Reference |
|---|---|---|---|
| 1 | Resident count is 0 and the player has 0 loyalty | No division-by-zero in `requiredPoints`; treat `required = 0` and bonus = 0 until residents ≥ 1 | FR-POP-049 |
| 2 | `requiredPoints` changes because the city grew | Points requirement and hence trio bonuses are recomputed on the same tick as the resident count | FR-POP-053, FR-POP-054 |
| 3 | All buildings on a map are wealth-neutral | Wealth average is undefined ⇒ wealth bonus = 0 %, not NaN; the UI must show "no wealth value" rather than 0.00 | FR-POP-056 |
| 4 | A unique building is duplicated | Points counted once; the duplicate still occupies space and may contribute to capacity | FR-POP-048 |
| 5 | A stackable building is duplicated 10× | Points counted 10× | FR-POP-047 |
| 6 | More than 8 skyscrapers of one type | The **diversity-point deduction** is applied (FR-POP-065); the 9th placement is **not** blocked (FR-POP-066) — the outcome must be deterministic and communicated | FR-POP-065, FR-POP-066 |
| 7 | A building is demolished while it held residents | Residents must be released from the demolished building, capacity reduced, diversity/wealth averages recomputed, and the resident count re-derived — no resident may stay attached to a demolished building | FR-POP-114, FR-POP-053 |
| 8 | Map switched while a growth tick is pending | Each map keeps independent population, bonus and score state; the switch must not leak state | FR-POP-003, FR-POP-081 |
| 9 | Usage hits exactly 90 % / exactly 100 % | The throttle follows `ECO`'s single rule (FR-ECO-065): factor **= 1.0 below 90 %**, **< 1.0 from 90 % up**, **= 0 at 100 %**. The exact curve in the 90–100 % band is **[TBD]** (OQ-ECO-10), but the **boundary** is not: code must implement the `< 90` / `≥ 90` split exactly as written, with no off-by-one at 90.0 % | FR-POP-010, FR-POP-011 |
| 10 | Player absent 3 days with 10 loyalty points | On return, 3 points deducted (floor of complete days away); balance floors at 0 | FR-POP-072, FR-POP-074 |
| 11 | Player changes device timezone | Loyalty reconciliation uses server/elapsed time, not local wall clock, so the balance cannot be farmed | FR-POP-074 |
| 12 | Region contains a map the player has not opened | Mayor Score includes only maps that exist in the region; empty/absent maps contribute 0 | FR-POP-099 |
| 13 | A map is removed from the region | Its City Score is subtracted from the Mayor Score | FR-POP-099 |
| 14 | Resident count exceeds one of the number formatting widths | Numbers must stay legible (separators, abbreviations at large magnitudes) | FR-POP-005, NFR-POP-006 |
| 15 | Happiness cannot be perfect because a service is unreachable | Coverage circles partially filled ⇒ H < S (the composite's scale, §7.3); the game must not round a partially covered city up to full | FR-POP-088, FR-POP-042 |
| 16 | Happiness-driven emigration while residential capacity is unchanged | **Not implemented** — emigration is not part of the shipped build (FR-POP-107), so this case cannot occur. If emigration is ever implemented: the resident count would fall while capacity stays, and the UI would show the gap | FR-POP-107, FR-POP-115 |
| 17 | A building with both culture and entertainment points | Both categories must count it, independently | FR-POP-040, FR-POP-046 |
| 18 | Two maps in a region both provide the same bonus-affecting content | Bonuses are per-map; the region total is not a stack of both | FR-POP-081 |
| 19 | Save/load mid-day | Loyalty day-window state, need statuses, bonus accumulators and scores must round-trip exactly | NFR-POP-004 |
| 20 | 100 000+ citizens in one map | Simulation must aggregate/LOD rather than drop residents; headless counters stay exact | FR-POP-027, NFR-POP-005 |

## 9. Non-functional requirements
| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| NFR-POP-001 | The bonus accumulators, resident count, employment pool, happiness and scores shall be computable from map state **deterministically** — no hidden randomness, so the same save always yields the same numbers. | Must | Mobile | no | QA-POP-019 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| NFR-POP-002 | Recomputation of the six bonuses and their sum after a build/demolish shall complete in **O(buildings)** time and within a single frame budget on the largest map. | Must | Mobile | no | QA-POP-015 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| NFR-POP-003 | Happiness evaluation shall be **incremental and cached** (recomputed on the day tick and on material state change), not per frame, so it costs ≤ 2 ms/frame amortised. | Must | Mobile | no | QA-POP-012 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| NFR-POP-004 | Save/load shall round-trip **all** implemented population state (citizens, needs, bonus accumulators, the per-map loyalty clock, score records) with no drift; reloading a save and recomputing shall reproduce identical scores. | Must | Mobile | no | QA-POP-019 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| NFR-POP-005 | The renderer shall display at least **100 000 citizens** in a single map via instancing/LOD while keeping the 3D view interactive; the simulation may aggregate agents above a configurable threshold, but the **resident count must remain exact**. | Should | Mobile | no | QA-POP-006 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| NFR-POP-006 | All population numbers (residents, points, percentages, scores) shall be **locale-formatted** with thousands separators and shall render correctly in the game's 16-bit retro UI at the smallest supported viewport. | Must | Mobile | no | QA-POP-002 | https://store.steampowered.com/app/3474890/ |
| NFR-POP-007 | Loyalty accrual/decay shall be reconciled **server-side or with a tamper-resistant signed timestamp**, so the bonus cannot be farmed by changing the device clock. | Should | Mobile | no | QA-POP-020 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| NFR-POP-008 | The leaderboard submission shall be **rate-limited and payload-minimal** (score + region + player id only); no citizen-level, household or need data shall leave the device. | Must | Mobile | no | QA-POP-023 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| NFR-POP-009 | The population subsystem shall be **decoupled from the render layer**: headless/aggregate mode shall produce identical numbers with no citizen meshes instantiated, so servers and tests can compute scores. | Must | Mobile | no | QA-POP-021 | https://supercitycon.net/ |
| NFR-POP-010 | The simulation shall support a **fixed timestep** (game clock) with deterministic tick order (needs → employment → happiness → growth → migration → scores → bonuses) to make bugs reproducible. | Must | Mobile | no | QA-POP-025 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| NFR-POP-011 | Population state shall be **migration-safe**: adding a new need, bonus category or score field shall not corrupt older saves (schema versioning with defaults). | Should | Mobile | no | QA-POP-019 | https://supercitycon.net/ |
| NFR-POP-012 | Citizen data shall be **anonymous**: no real-world identifiers, names, or behavioural tracking beyond what the score submission requires. | Must | Mobile | no | QA-POP-023 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |

## 10. Acceptance-criteria suites
| ID | Given | When | Then | Covers |
|---|---|---|---|---|
| QA-POP-001 | A city with 1,200 residents | the level is read from the UI | the level is derived from the resident count and no XP value exists anywhere in the save | FR-POP-001, FR-POP-004 |
| QA-POP-002 | Two maps in a region, A with 900 and B with 4,200 residents | the player switches maps | each map displays its own resident count, integer-formatted with separators | FR-POP-002, FR-POP-003, FR-POP-005 |
| QA-POP-003 | Base residential capacity 100 and a residence multiplier M = 2.5 (the value produced by the residence-bonus combination, which is itself a [TBD] parameter) | the population tick runs | residents = floor(100 × 2.5) = 250, and commercial capacity is multiplied by the same 2.5 | FR-POP-006, FR-POP-007, FR-POP-008, FR-POP-009 |
| QA-POP-004 | Commercial capacity 40, industrial capacity 20, multiplier 2.0 | the employment pool is built | 80 commercial and 40 industrial jobs exist, scaling in parallel with the 2× residents | FR-POP-020, FR-POP-008, FR-POP-009 |
| QA-POP-005 | Food usage at 89 %, then at exactly 90 %, then at 100 % | the growth tick runs three times | growth is full at 89 %, is **strictly reduced** at exactly 90 % (the amount is set by the single shared [TBD] curve `g` owned by `ECO`, OQ-ECO-10 — no specific percentage is asserted here), and is zero at 100 %, where residents freeze; growth returns to full rate once usage falls back below 90 % | FR-POP-010, FR-POP-011, FR-POP-012, FR-POP-013, FR-POP-014 |
| QA-POP-006 | A city of 25,000 residents in first-person view | the player walks a street | pedestrians are visible on sidewalks, density scales with population, and the resident readout stays exact | FR-POP-016, FR-POP-022, FR-POP-026, FR-POP-027 |
| QA-POP-007 | SCC Studio | a custom citizen model is exported and placed | the custom citizen appears in the city as a citizen asset | FR-POP-017, FR-POP-024, FR-POP-025 |
| QA-POP-008 | A clock set to 08:00, 13:00 and 20:00 | the citizen agents run their day | no per-citizen movement is simulated — the city has no individual citizens walking a routine (the documented default for the unevidenced daily routine, FR-POP-018) | FR-POP-018, FR-POP-023 |
| QA-POP-009 | 500 residents, 400 commercial + industrial workspace slots | the employment tick runs | 400 citizens are employed and 100 are unemployed, and the unemployment is visible in the population presentation | FR-POP-019, FR-POP-020, FR-POP-021 |
| QA-POP-010 | A new map at Day Zero | the needs panel is opened | all twelve need categories are listed and each citizen carries a status per category | FR-POP-028, FR-POP-029, FR-POP-030 |
| QA-POP-011 | A city of 400 residents with fields feeding 3 animals feeding a food industry | the food chain resolves | food demand is met through the two-stage chain and any shortfall shows as an unmet food need | FR-POP-033, FR-POP-034 |
| QA-POP-012 | A city where health care covers 60 % of blocks and energy usage is 95 % | the happiness tick runs | the health circle shows partially filled, energy contributes a negative term, and happiness is below the maximum | FR-POP-035, FR-POP-042, FR-POP-043, FR-POP-085, FR-POP-087, FR-POP-089, FR-POP-090 |
| QA-POP-013 | Culture +250 %, Entertainment +0 %, Recreation +250 %, Wealth +250 %, Diversity +40 %, Loyalty +250 % | the government residence panel is opened | the six categories are listed with their 250 % caps and the panel shows their **sum** (1040 %) as the residence bonus; **no combined multiplier is displayed or asserted**, because the combination rule and its ceiling are [TBD] | FR-POP-077, FR-POP-078, FR-POP-084 |
| QA-POP-014 | A city of 10,000 residents with 10 culture points, 3 entertainment points and 12 recreation points | the trio is recomputed | culture = 250 %, entertainment = 75 % (3 of 10 points, floor), recreation = 250 %, and no category exceeds 250 % | FR-POP-049, FR-POP-050, FR-POP-051, FR-POP-052 |
| QA-POP-015 | A city at 250 % recreation because of 3 large parks | the player demolishes one park and builds 4 residential towers | the recreation bonus drops to the new points/requirement ratio, the residence bonus falls, and resident capacity falls accordingly | FR-POP-053, FR-POP-077, FR-POP-083 |
| QA-POP-016 | A map with 10 wealth-carrying buildings (6 at level 1, 2 at level 2, 2 at level 3) and 40 wealth-neutral buildings | the wealth level is computed | the average is 1.6 over the 10 wealth-carrying buildings only, mapping to the published interpolation band (1.65 → 129 %) | FR-POP-055, FR-POP-056, FR-POP-057, FR-POP-059, FR-POP-060, FR-POP-061 |
| QA-POP-017 | A map with 250 distinct building types | the diversity bonus is computed | diversity = 250 % (1 % per unique type, capped) | FR-POP-062, FR-POP-063, FR-POP-064 |
| QA-POP-018 | A map with 8 skyscrapers of type X and 9 of type Y | the diversity state is evaluated | the over-cap type **loses diversity points** (the documented penalty) and the bonus reflects the deduction; the ninth skyscraper is **not** blocked from placement | FR-POP-065, FR-POP-066, FR-POP-067 |
| QA-POP-019 | A save with populated accumulators, loyalty clock and score records | the save is reloaded and recomputed | every accumulated value, need status, score and loyalty window is identical, and recomputation reproduces the same City Score | FR-POP-068, NFR-POP-001, NFR-POP-004, NFR-POP-011 |
| QA-POP-020 | A map whose loyalty balance is 250 points, with the player away for 3 days | the player logs in to that map | 3 points are deducted from **that map's** loyalty balance (one per complete day away, after the 24 h threshold), then up to 2 points are granted for the day's sessions, the balance stays ≤ 250, and a second map's loyalty balance is unaffected | FR-POP-069, FR-POP-070, FR-POP-072, FR-POP-073, FR-POP-074, FR-POP-075 |
| QA-POP-021 | Map A: 10,000 residents at H = S/2; Map B: 5,000 residents at H = S (S = the happiness scale, §7.3) | City Scores are computed | both reach the same City Score (5,000 effective happy residents), and a map with both many and happy residents scores highest | FR-POP-094, FR-POP-095, FR-POP-096, FR-POP-097, FR-POP-098 |
| QA-POP-022 | A region with three maps having City Scores 1,200 / 800 / 3,400 | the government overview and the top-left chip are read | Mayor Score shows 5,400 in both places and the overview lists the three City Scores separately | FR-POP-099, FR-POP-100, FR-POP-102 |
| QA-POP-023 | The player finishes a session | the leaderboard upload runs | only the score, region and player identifier are transmitted, and the payload is rate-limited | FR-POP-101, FR-POP-104, NFR-POP-008, NFR-POP-012 |
| QA-POP-024 | A tier-2 residence (capacity 24) and a tier-3 residence (capacity 96) | residential capacity is totalled and converted | base capacity = 120 and residents = floor(120 × M); no household partition is computed, because households are not implemented (FR-POP-106) | FR-POP-105, FR-POP-106 |
| QA-POP-025 | A city at the 100 % food-usage ceiling with H = 0.3·S | the player fixes food production and raises happiness | residents resume growing above 90 %, the state is no longer reported as a stall, and no resident leaves the city (emigration is not implemented — the documented default) | FR-POP-107, FR-POP-108, FR-POP-109, FR-POP-110, FR-POP-111, NFR-POP-010 |
| QA-POP-026 | A residence holding 12 residents | the player demolishes it | capacity drops, the 12 residents are released and the resident count is re-derived from the reduced capacity, the level may fall, and no resident record is orphaned | FR-POP-114, FR-POP-115 |

## 11. Open questions & TBDs
| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| OQ-POP-01 | What is the exact citizen daily routine (times, durations, sequence home→work→shop→leisure)? | Drives pedestrian spawning and where citizen agents appear | **No citizen routine by default** (FR-POP-018 — the routine is unevidenced). If it is implemented, a proposed schedule would be: 24 h clock, leave home 07:00, work 08:00–17:00, shop 17:00–19:00, leisure 19:00–22:00, home 22:00–07:00 |
| OQ-POP-02 | Is unemployment modelled explicitly, and what is its threshold and presentation? | The video confirms jobs come from workspace capacity but never shows unemployment | Model unemployment as residents − workspace slots; show it in the government overview; treat it as a happiness input |
| OQ-POP-03 | When are citizen agents spawned and despawned relative to their home/work buildings? | Affects pedestrian counts and traffic load | Spawn on schedule within a radius of home/work, despawn when the agent reaches its destination building |
| OQ-POP-04 | Is partial trio coverage linear (points ÷ required) or stepped? | Changes the value of the first parks in a growing city | Linear, floored to whole percent |
| OQ-POP-05 | What is the wealth-level → percent mapping's anchor and rounding? Only (1.65 → 129 %) and (3 → 250 %) are published | Every wealth bonus value depends on it | Linear from 0 % at level 0.2 to 250 % at level 3, floored: `floor(250 × (L − 0.2) / 2.8)` → 1.65 ⇒ 129, 3 ⇒ 250 |
| OQ-POP-06 | Does loyalty decay start after 24 h away (tutorial) or after two missed days (shared brief)? | Off-by-one-day errors change long-term bonus values | Tutorial reading: decay starts after 24 h, 1 point per complete day away; brief's "two consecutive days" treated as a secondary description |
| OQ-POP-07 | What is the diversity penalty magnitude and shape for exceeding 8 skyscrapers of a type? | Directly changes how far a player can push a single type before losing the 250 % | The penalty is **[TBD]**. Proposed default only (not published): 1 diversity point per skyscraper above the 8th, deducted from the diversity point total (then capped at 250 %). Whether a hard placement block accompanies it is a separate design decision — FR-POP-066 |
| OQ-POP-08 | **RESOLVED — per map.** The dev blog's explicit "Per Map Calculation" note covers all six bonuses, so loyalty is per map like the other five. | A daily-login mechanic could otherwise be implemented account-wide, which would contradict the published per-map rule | Per map, matching the blog and the tutorial's "if you stay away from **your city**" wording |
| OQ-POP-09 | How do the six bonuses combine, and what is the combined ceiling? The dev blog's "×15" headline **was** recovered from the Common Crawl capture, but it publishes no combination formula. | Sets the whole economy curve | **[TBD — design decision].** The tutorial publishes no combination rule and explicitly says "no one knows yet what's the actual maximum of a map"; the recovered blog text publishes no formula either (§12 source #11). Six independent 250 % caps sum to 1500 %, which under an additive reading would be ×16 — but the six maxima are not simultaneously reachable (§7.1). **Neither an additive nor a multiplicative combination, and neither a ×15 nor a ×16 ceiling, may be assumed.** The rebuild picks one rule and publishes it as a design decision. |
| OQ-POP-10 | What are the happiness weights? The dev explicitly withholds them and says they are unequal | Happiness drives City Score (and would drive emigration only if that were ever enabled) | Weighted sum with the §7.3 weights (supply 0.30, coverage 0.30, housing 0.15, employment 0.10, pollution 0.15) and the §7.3 scale `S` — both are **[TBD] design decisions**, not published values |
| OQ-POP-11 | What triggers emigration — a happiness threshold, a rate, or per-tick probability? | Determines the collapse dynamics | **No emigration by default** (FR-POP-107 — the behaviour is unevidenced; residents never leave). If it is implemented, a proposed trigger would be a linear rate in the band H < 0.4·S, 0 at H ≥ 0.6·S, scaled by unmet-need share |
| OQ-POP-12 | What curve maps (residents, happiness) to City Score, and what is the maximum? | City Score is the ranked quantity in the leaderboard | `round(residents × (H / S))` — reproduces the "substitutes" property; γ = 1. `S` is the happiness scale of §7.3 and is itself **[TBD]** (OQ-POP-10) |
| OQ-POP-13 | What is the household-size distribution inside a residence? | Affects per-household need demand and citizen counts | **No households by default** (FR-POP-106 — the concept is unevidenced; capacity is tracked per building). If implemented, a proposed distribution would be a fixed household size of 2–4 derived from tier capacity, rounded to fill capacity exactly |
| OQ-POP-14 | At what usage does the **happiness / Mayor-Score** penalty start — at 90 % or above, or only *over* 90 %? | The **growth** rule is unambiguous ("starting from 90 % usage it will reduce the growth of your city"), but the water tutorial phrases the happiness penalty as "over 90 %". The readings differ only at exactly 90 %, and the two systems must not diverge in code | **[TBD].** Until it is resolved, `POP` implements the **same** `< 90` / `≥ 90` split as `ECO` (FR-ECO-064/065): no usage penalty below 90 %, a penalty from 90 % up, growth frozen at 100 %. The 90–100 % **shape** is `ECO`'s `[TBD]` curve `g` (FR-ECO-067 / OQ-ECO-10). Tutorial set: https://www.youtube.com/feeds/videos.xml?channel_id=UCb5PQ1wJm1XVukaSPya3qww |

## 12. Source list
| # | URL | What it gave us | Retrieved |
|---|---|---|---|
| 1 | https://www.youtube.com/watch?v=CIb2IWyNPJw | **Resident Bonuses** tutorial (full transcript): the six bonuses, the 1-point-per-1,000 rule, 250 % caps, stackable vs unique point contribution, wealth average and the 1.65 → 129 % / 3 → 250 % data points, diversity = 1 per unique type, the 8-skyscraper limit and diversity penalty, loyalty at ≤2 points/day with decay after 24 h, and the parallelism of residence and workspace scaling | 2026-10-23 (auto-generated captions via `youtube-transcript-api`) |
| 2 | https://www.youtube.com/watch?v=_QpxzZFTBtw | **Happiness & Mayor Score** tutorial (full transcript): happiness as a composite of everything with unequal undisclosed weights, City Score from residents + happiness as substitutes, the unsolved maximum, Mayor Score = Σ City Scores of the region, and the two display surfaces | 2026-10-23 (auto-generated captions) |
| 3 | https://www.youtube.com/watch?v=LmY_TpU1B5Y | **Economy Overview** tutorial (full transcript): the seven usage/demand tracks, the 90 % growth-throttle and 100 % growth-stop, the eight government coverage categories, and the Mayor Score = Σ City Scores restatement | 2026-10-23 (auto-generated captions) |
| 4 | https://www.youtube.com/watch?v=jYAD0SkDmY0 | **The Basics** tutorial (transcript excerpt): no XP, level from resident count, higher levels unlock more buildings | 2026-10-23 (auto-generated captions) |
| 5 | https://www.youtube.com/feeds/videos.xml?channel_id=UCb5PQ1wJm1XVukaSPya3qww | Official channel RSS: the complete How-To catalogue (Resident Bonuses, Happiness & Mayor Score, Education System, Healthcare, Fire, Police, Supply systems, Waste Management, Science View, Switching Maps, Income Bonuses, Connected Economies …) — the index of the per-system tutorial set | 2026-10-23 |
| 6 | https://store.steampowered.com/app/3474890/ | PC title: pedestrians follow the sidewalks; citizens are customisable assets in SCC Studio; citizens/props in the growing library; sandbox Early Access framing (the "economy not yet included" caveat is from the shared brief §1) | 2026-10-23 |
| 7 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 | Mobile listing: "KEEP CITIZENS HAPPY … balance of services and leisure"; "MAYORAL MATCH-UP: Compete globally"; Region View; Street View; "GROW FROM FARM TO METROPOLIS"; 300+ structures; sandbox construction mode | 2026-10-23 |
| 8 | https://itunes.apple.com/lookup?id=1607860732 | Machine-readable retrieval of the App Store metadata above (title "Super Citycon™ - Build a City", Ben Willes Games SL, version date 2025-12-21) | 2026-10-23 |
| 9 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ | Dev (Ben) on people simulation: planned modes (RCI / resource management / tycoon), per-citizen life cycle + relationships + routines as a possible deeper mode, the scaling problem, and the "residents should feel like actual people, not anonymous numbers" intent | 2026-10-23 |
| 10 | https://supercitycon.net/ | Official site: the two products are distinct and the PC Early Access build is a construction sandbox — the basis for the Mobile/Both/PC-EA stage tagging used throughout §3 | 2026-10-23 |
| 11 | https://index.commoncrawl.org/CC-MAIN-2024-51-index?url=supercitycon.net%2Fnew-bonuses-for-residence-growth%2F&output=json (the **index query** that proves a capture exists and yields the WARC filename/offset/length) **+** https://data.commoncrawl.org/crawl-data/CC-MAIN-2024-51/segments/1733066116599.47/warc/CC-MAIN-20241213074100-20241213104100-00780.warc.gz (the **WARC record itself** — byte range 494166670, length 39681 — so the exact captured bytes can be fetched) | Archived capture of the supercitycon.net dev blog **"New Bonuses for Residence Growth"**. *Note:* the live URL `https://supercitycon.net/new-bonuses-for-residence-growth/` now returns **404** (the site is mid-rebuild), so this row cites the **Common Crawl CC-MAIN-2024-51 capture** of the live page (capture timestamp 2024-12-13, HTTP 200), whose recovered text is quoted verbatim here and in §1.1 row 25. The page states the six bonuses "together can scale up to **x15**", that the six replace the old hidden residence system, that each category's maximum is **250 %**, and it carries an explicit "**Important Note: Per Map Calculation**" clause. **It publishes no formula for how the six combine**, so the ceiling itself remains a design decision (FR-POP-078/079, OQ-POP-09) — the ceiling *quote* is recovered, the *combination rule* is not. | 2026-10-23 (live 404; archived capture retrieved 2026-10-23) |
| 12 | https://www.youtube.com/@supercitycon | Official channel landing page for the tutorial set referenced by source #5 | 2026-10-23 |
