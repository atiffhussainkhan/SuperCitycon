# CORE LOOP, MODES, STAGES & PROGRESSION — SuperCitycon Requirements
> Bot: BOT-01 · Domain code: CORE · Status: COMPLETE — **remediated 2026-10-23**
> Sources consulted: **20 distinct URLs** (official SuperCitycon How-To tutorials, the official Steam store page + appdetails API, the official Steam demo announcement, the dev's own Steam discussion thread, the official site, App Store + iTunes lookup + Google Play listings, one third-party guide) · Requirements: **78 FR / 12 NFR / 45 QA** · Open questions: **9**
>
> **Remediation note.** The previous revision of this file sourced 35 requirement rows to
> `playkot.helpshift.com` and `supercitygametips.com` — **Playkot's "SuperCity"**, a different mobile game.
> Every row resting only on those sources has been deleted. The Playkot-only concepts that were carried
> into it (Story Expeditions, Superzilla / Nessie / Genie quests, Fruit Salads, Club Boom, energy→crystal
> currency, Prosperity Point, Special Factories, the Department of Architecture, the six-rung
> farm→village→small-town→town→city→metropolis ladder) do not exist in SuperCitycon and appear nowhere
> below. The stage ladder is now **not a mechanic**: see §5.3 and FR-CORE-046.
>
> **Evidence rule for this document.** Every row below is sourced to material about *one of the two real
> SuperCitycon products* — the PC title (`SuperCitycon`, Steam app `3474890`, Sunapie Games) or the mobile
> title (`Super Citycon™: Build a City`, App Store id `1607860732` / `com.benwilles.citybuilder`, Ben Willes
> Games SL). Any behaviour that is plausible but unevidenced appears **only** as an explicitly marked
> design decision: Priority `Could`, Stage `Design`, the marker `[TBD — design decision]`, and a Section 11
> entry. There are no such rows with a foreign source URL.
>
> **Second remediation pass (2026-10-23, senior review).**
> - **Harbor scope.** A Harbor is a **per-map membership token**; the food-and-waste pool it joins is
>   **region-wide**. `ECO` owns that rule (FR-ECO-102); `CORE` now points at it instead of restating it
>   (FR-CORE-065, §4.5, E13).
> - **Wallet scope.** The shared wallet's region-vs-profile scope stays **[TBD]** and is owned by `ECO`
>   (OQ-ECO-16); `CORE` (FR-CORE-007, FR-CORE-067, OQ-CORE-05) now says "the shared wallet" and asserts no scope.
> - **Mode picker.** FR-CORE-028 is narrowed: **no persistent picker on the build screen**; a **one-off**
>   selection surface is allowed. QA-CORE-011 tests the mode registry and QA-CORE-018 the one-off surface.
> - **Mayor Score.** FR-CORE-069 now points at `POP` (FR-POP-099, FR-POP-100) for the score rule.

---

## 0. Scope

**In scope (BOT-01 / CORE):**
- The **core loop** and session structure: what the player does moment to moment, and the machine that runs a
  session (mode → region → map → clock → build → resolve → score → persist).
- The **mode registry**: a data-driven table of game modes, each with a ruleset flag set. Covers the mobile
  *Sandbox Construction Mode*, the PC *Construction Sandbox*, the dev's announced PC simulation modes, and the
  mode-adjacent experiences that are evidenced (Region View, Street View, Mayoral Match-Up).
- The **progression gate**: level is a direct function of resident count; higher levels unlock more buildings.
  This document owns *the gate and the unlock mechanism*; the population maths is owned by `POP`.
- **The unlock / library-growth model**: required-level gating of the building catalogue, the continuously
  growing library, and the separate city-upgrade track.
- **Content cadence / live-ops**: add-ons, Building of the Week, chests, free gifts, the free-user premium
  window, the Piggy Bank, storage/warehouse redemption, monthly content updates.
- The **region system**: multiple maps per region, region switching, cross-map economy connections, and the
  region-level score aggregation boundary.
- **Mayoral Match-Up** and the global leaderboard framing (score *presentation* only; formulas owned by `POP`).
- **Onboarding / first-session flow** at mode level and **persistence of progression** at mode level (the
  save-file format itself is owned by `TEC`).

**Out of scope (owner named — referenced, never specified here):**
- Economy numbers, costs, taxes, production/consumption chains, the wallet model → `ECO`.
- Happiness maths, the six growth bonuses, City Score formula → `POP`.
- Service coverage radii → `SRV`.
- Building catalogue content, tier ladders, building property schema → `BLD`.
- HUD layout, top-bar composition, panel chrome, camera controls → `UX`.
- Rendering, art direction, audio, day/night rendering, simulation tech, save-file format → `TEC`.
- Voxel editor, auto-cost/economy calculation, Workshop publishing → `STD`.
- Road/traffic/rail/boat behaviour → `MOB`.
- Terrain, water, grid, voxel layer addressing → `WLD`.

**Boundary rule.** This document owns *modes, the progression gate and unlock cadence* — i.e. **which
systems are switched on for which mode, and what the player has earned the right to use**. It does not own
the numbers those systems compute.

**Stage vocabulary used in the `Stage` column** (this domain's own dimension; exactly four values are legal):

| Value | Meaning |
|---|---|
| `Mobile` | Live in the **mobile title** today (App Store id `1607860732` / `com.benwilles.citybuilder`). |
| `PC-EA` | The **PC title** (Steam app `3474890`) — Early Access scope and the announced post-EA roadmap. |
| `Both` | Live on mobile **and** named by the developer as a target for the PC title's future simulation modes. |
| `Design` | **Not an evidenced game behaviour.** A design decision for this rebuild; always carries `[TBD — design decision]` and a Section 11 entry. |

**Product boundary (critical).** The PC title and the mobile title are **two different products**. The
official site states that the original `Super Citycon™: Build a City` "is a **separate game from
SuperCitycon on Steam**" ([S12](https://supercitycon.net/)). The PC Early Access build ships **without**
economy or progression — the store's Early Access Q&A answers "What is the current state of the Early Access
version?" with: *"The current version focuses on the city-building sandbox. … **Economy and progression
systems are not yet included.**"* ([S1](https://store.steampowered.com/app/3474890/SuperCitycon/)). The mobile
title is therefore the only product where the simulation and progression systems are publicly observable
today, and this document specifies the mobile behaviour as the **target specification** for the PC title's
future modes.

---

## 1. Observed behaviour (evidence)

### 1.1 Source findings

| # | Finding | Status | Source URL |
|---|---|---|---|
| S1 | Steam Early Access Q&A, "What is the current state of the Early Access version?": "The current version focuses on the city-building sandbox. You can shape terrain, build roads and railways, and create neighborhoods using the model library. SCC Studio lets you customize models or create your own assets and use them in your city. You can also adjust the time of day and weather. **Economy and progression systems are not yet included.**" | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| S2 | Steam Early Access Q&A, "How is the full version planned to differ from the Early Access version?": "I plan to expand the creative sandbox with **economic systems, progression and new challenges**, giving players more ways to experience the cities they build." | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| S3 | Steam store: "**Early Access begins with a construction sandbox** centered on shaping worlds, building cities, creating assets and exploring the places you make." | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| S4 | Steam store: "This city-building game is **designed to grow with additional game modes, new rule sets and new ways to experience the cities you create**." | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| S5 | Steam store, "FEATURES AT A GLANCE": Construction Sandbox; Map Creation & Terraforming; Flexible Roads & Railways; SCC Studio & Steam Workshop; **Continuously Growing Library** ("Expand the city with new architectural styles, buildings, vehicles, citizens and props"); Living Cities; First- & Third-Person Modes. | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| S6 | Official Steam demo announcement, "The demo is out. Please ask me things.": "For example, **there's no economy in the game yet. You can build and explore, but it isn't a 'real' city builder yet, with systems that feed into each other and goals to work toward.**" | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| S7 | Same announcement: "SuperCitycon is a **completely new game** … built from the ground up, with performance and scale in mind from day one"; the demo shows "fires and tornadoes, a full day and night cycle", trains, helicopters and ships; "You can't walk around the city on foot in the demo yet, though." | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| S8 | Dev (Ben) in the Steam thread **"People Simulation"**: "what is pretty much decided is that there will be **different game modes**. I'm thinking a **classical RCI mode**, one that is more focused on **resource management**, and a **very casual tycoon mode**. … one of them could definitely go **much deeper into the individual people, their life cycle, relationships, routines**"; "The hard part with this stuff is always **scaling**." | [CONFIRMED] | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| S9 | Dev, same thread, replying to "without RCI bars or something, it's just drawing for the sake of it": "working on it! **If things go well, it will have the first two simulation modes already in early access.**" | [CONFIRMED] | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| S10 | Tutorial "The Basics": "we don't have **XP points** … your level straight forward depends on your **residence amount** … to level up you simply need more residence"; "once you reach more residents you will reach a higher level, **higher levels unlock more buildings**". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S11 | "The Basics": "in the beginning you will have **only one** [construction slot] but for each **Citycon Building** that you build … you will get another **permanent** construction slot"; "some bigger buildings … require **two or more** construction slots"; "you can get those from **shop** … you can also **collect them over time**". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S12 | "The Basics": "**add-on** means you **unlock it once you got it forever** you can build it as often as you want"; **Building of the Week** is "a **weekly rotating building** and it's **Unique** and it's **only available for this week** … it maybe will come back … but **not soon**". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S13 | "The Basics": **Sandbox Constructions** = "**zero construction time** … instantly confirm buildings when you move them"; **Citycon Building** = "another construction slot"; **speed-up package** = "get rid of this … **speed up button** … you got that speed up option **forever** … constructions will finish **faster when you're not in game**". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S14 | "The Basics": the free-user block "is for our **free users** … every **8 hours** you can use those options and watch the **four ads**"; "every **3 hours** you get a **free gift**"; **chests**: "every **4 hours** or every **24 hours** you can redeem free chest … that give you **collectible parts** … and **bonus cards**"; the ad popup grants "**double speed for 10 minutes**"; the **Piggy Bank** "collects **Super Cash** over time for your activity" and "once you filled it you can purchase it for **very reduced price**". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S15 | "The Basics": the building shop shows "**over 300**" buildings that are "**continuously growing**"; the **storage** tab "is **only there when you got something in storage**"; "you can put buildings and **bonus Cards** into storage … and you can redeem it from here by tapping this button in shop". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S16 | "The Basics": the tutorial runs "on already existing City because some of the features … they are **not unlocked at the game start**". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S17 | "The Basics": top-left cluster = camera mode, **mini-map**, **science view**, **government** ("for everything related to manage the game"), **collectibles** ("card you get from chests or over time … you can also tap them to complete them earlier, that's a **premium** option"), **high scores** ("an overview of your current ranking"), **income**, **city upgrades**, **overview** (electricity, water, food, waste, health care, police, fire, education), **mailbox** ("mainly where you receive your tasks"). | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S18 | "The Basics": the **date** starts at "**Day Zero** … my city here this demo city is **229 years old**"; the top bar carries the money amount ("tap your money amount to get it sorted"), the **level**, the "**residence amount of this current map**", and the **date**. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S19 | "The Basics": the bulldozer offers "**three categories**" that decide what gets bulldozed; a new building is placed by **dragging** it and it "automatically snaps to the streets"; editing = long-press → **orbit mode** → rotate / move / confirm. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S20 | "The Basics": the top bar has two blocks — "this is your **building demand**, this is your **economy usage**"; "when a bar is **full** it means you need something … when the bar is **empty** it means you're fine"; tapping a bar block opens its details. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S21 | Tutorial "Switching Maps": "in version one we had the map window, this **no longer exists in version two** since in version two we introduced the **region view**"; you enter it "by **zooming out and zooming out again**"; it shows "all maps of this region"; "the active one is **marked in blue**"; "possibly in the future there will be different regions but **for now it's only one**". | [CONFIRMED] | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| S22 | "Switching Maps": switching is "you simply **zoom into another map**, this **popup appears asks you to switch** … you say yes or no" and then "the game will **reload with the city you selected**"; tapping a map shows its **tile usage** (land / beach / water tiles occupied and free) and allows **renaming**; "you can also … **demolish all your map at once** … once you click okay your city is wiped out and there is **no way to restore it** … all the buildings that you own will be **put into your inventory** … you don't lose those buildings". | [CONFIRMED] | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| S23 | Tutorial "Storage Feature": "once your inventory is pretty full … you got the option to **store cards, buildings** … which means they are **out of your inventory but you still own them** for later use"; you can "put them to **Warehouse** or you can **sell** them — if you sell them they are **gone forever** and you will get some **coins**"; to redeem, "you go to **store** and buildings that you have in storage now have this **blue button instead of the price**". | [CONFIRMED] | https://www.youtube.com/watch?v=cSRDwHvowWI |
| S24 | Tutorial "Connected Economies": "what you can connect is your **food supply**, your **Waste Management**, your **water** and your **energy Supply**"; a **Harbor** "automatically connects to the **global system** … it does not matter anymore if the food production … is on this current map or on any other of your maps **within your region**"; the **energy C-Wire** and the **water pipeline** connect a map the same way. | [CONFIRMED] | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| S25 | Same tutorial, general hint: "all your money … all your **coins**, all your **super cash** … that's also **one amount** … it's **shared across all maps** in general". | [CONFIRMED] | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| S26 | Tutorial "Income Bonuses": the income panel is divided into **residential / commercial / industrial**; three bonus scopes exist — **Global** bonuses ("they apply to all of your Maps in the current Region"), **map** bonuses ("apply to all of the buildings on this current map"), and **local** bonuses (emitted by decorative buildings within an area of effect); "**City upgrades are always region wide**". | [CONFIRMED] | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| S27 | Tutorial "Economy Overview": "keep the bars as low as possible … **below 90% you are fine** … starting from **90%** usage … it will reduce the growth of your city … once something is **100%** usage your city will not grow anymore"; the government overview shows **bars** (want low) and **circles** (coverage, want full); "**major score is the sum of all City scores of your region**". | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| S28 | Tutorial "Happiness & Mayor Score": "happiness is essentially a factor that's shaped from **everything in your city**"; "from happiness and the amount of residents combined we calculate your **City score**"; "all the cities of one region combined to your **major score** for that region"; it is shown "in the top left" and in the government area overview tab; "with your Mayor score you can **compete with other mayors**"; "not all of them possibly we **will launch new regions soon**"; "so far **no one figured out what's the maximum**". | [CONFIRMED] | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| S29 | Tutorial "Camera Modes": two main cameras — **orthographic** (pinch zoom, two-finger tilt, auto-snap rotation) and **perspective** (the default on first launch, with a **tilt-shift** effect); "you can **zoom in fully and zoom in again** and you enter the **first person camera**"; "if you **zoom out fully and zoom out again** you will enter the **region view**"; in first person "you can even **jump on cars** if you catch them and drive with them". | [CONFIRMED] | https://www.youtube.com/watch?v=ovWkwWS5FlY |
| S30 | Official short: "Super Citycon is a **voxel based 3D Tycoon city building simulation with a casual touch**"; "it has **huge maps and regions**, build freely no restrictions"; "**add-ons for continuous content growth**"; "**premium sandbox** for ultimate creativity". | [CONFIRMED] | https://www.youtube.com/watch?v=6Jd2kyaEZbM |
| S31 | App Store listing feature bullets: "**SANDBOX CONSTRUCTION MODE**: Build instantly without delays. Resources are key, but there's **no waiting for construction**"; "**BOUNDLESS MAPS**"; "**REGION VIEW**: Seamlessly integrate multiple maps into one cohesive region"; "**SUPER CITYCON STREET VIEW**"; "**MONTHLY ADD-ONS**: … new buildings **every month**"; "**GROW FROM FARM TO METROPOLIS**: Expand your city with over 300 unique structures"; "**MAYORAL MATCH-UP**: Compete globally to build the grandest city and climb the ranks." | [CONFIRMED] | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| S32 | Google Play listing: "**SANDBOX CONSTRUCTION**: Build your city instantly — **no waiting, no timers**"; "**HUGE MAPS**: Build on massive maps with total creative freedom — **from quiet villages and small towns to sprawling metropolises** with towering skyscrapers"; "**REGION VIEW**: Connect multiple city maps into one region"; "**STREET VIEW**"; "**300+ BUILDINGS**: **Grow from farm to metropolis**"; "**MONTHLY UPDATES**: New buildings and content every month"; "**Compete in the Mayoral Match-Up — a global ranking where mayors compete to construct the best city and grow their empire**". | [CONFIRMED] | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| S33 | iTunes lookup API for the mobile title: name "Super Citycon™ - Build a City", current version **2.4.0**, last updated **2025-12-21** — the mobile title is live and versioned independently of the PC title. | [CONFIRMED] | https://itunes.apple.com/lookup?id=1607860732 |
| S34 | Official site: "Playing on your phone? The original Super Citycon™: Build a City is free on iPhone, iPad and Android. **It is a separate game from SuperCitycon on Steam.**" | [CONFIRMED] | https://supercitycon.net/ |
| S35 | Official Steam announcement "Why Is It Called SuperCitycon?": "I was building what is now called the **Citycon Building**, the city's construction yard … The original idea was something along the lines of **City Constructions Inc.**" — the construction-slot building is an in-world object, not an abstract counter. | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| S36 | Third-party guide (2022): "you get **bonuses and new buildings as you level up**"; "complete the **task that you receive in the mail** … whenever you meet the task, you will get **points** which you can later invest in the things you want to buy." | [CONFIRMED] | https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |
| S37 | Steam appdetails API for app `3474890`: developer/publisher **Sunapie Games**; genres Indie / Simulation / Strategy / Early Access; category "Includes level editor"; `demos: [5295650]`; planned release **Q4 2026**; supported OS Windows 10 64-bit / macOS 12+. | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |

### 1.2 Screens/flows observed

- **Mode-less first entry (mobile).** The player arrives in a city already in progress; the tutorial is recorded on
  "an already existing City". **No mode picker is observed in any published flow** — mode selection, where it
  exists, is implicit in which experience is entered. The mode registry below is therefore built from the
  dev's stated plan and the store/listing copy, not from an observed picker. *Sources: `jYAD0SkDmY0`, S8.*
- **The Basics flow (mobile).** Inventory sheet → bulldozer (three categories) → drag-to-place with street snap →
  long-press → orbit mode → rotate / move / confirm → bottom-left construction-slot strip → top-left cluster
  (camera / mini-map / science view / government / collectibles / high scores / income / upgrades / overview) →
  mailbox (tasks, messages, tutorials) → shop (add-ons, Building of the Week, Sandbox Constructions, Citycon
  Building, speed-up package, free-user block, Piggy Bank, Super Cash, chests) → building shop (300+ buildings,
  category tabs, storage tab that exists only when storage is non-empty). *Source: `jYAD0SkDmY0`.*
- **Region view (mobile).** Zoom out fully → zoom out again → all region maps, active map marked blue; tap a map
  for tile-usage stats, rename, or "demolish all map at once"; zoom into a map and confirm to switch, then the
  game reloads. *Source: `vBJdlAeLn0g`.*
- **Storage (mobile).** Tap a building in the inventory → blue button → menu offering *put to Warehouse* or
  *sell for coins*; in the shop, stored entries show a blue redeem button in place of the price. *Source:
  `cSRDwHvowWI`.*
- **Camera surfaces (mobile).** Orthographic ⇄ perspective toggle (perspective is the first-launch default);
  zoom in twice → first-person camera with a red-cross exit; zoom out twice → region view. *Sources:
  `ovWkwWS5FlY`, `jYAD0SkDmY0`.*

---

## 2. System overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     PROFILE / SAVE ROOT            (file format → TEC)          │
│  accountId · entitlements (add-ons, packs) · regionId · maps[] · settings · clock│
└───────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                        ┌───────────────▼────────────────┐
                        │        MODE REGISTRY  (CORE)    │
                        │  modeId → ruleset flags →       │
                        │  {economy, progression,        │
                        │   residents, traffic, zoning,   │
                        │   score, leaderboard,          │
                        │   constructionTimers, camera,  │
                        │   premiumEconomy}              │
                        │  status: shipped|in-dev|announced│
                        └───────────────┬────────────────┘
                                        │  flag set gates every subsystem
   ┌───────────────┬──────────────┬─────┴─────────┬───────────────┬──────────────┐
   ▼               ▼              ▼               ▼               ▼              ▼
 ModeController  ClockTracker   LevelTracker   UnlockRegistry  LiveOpsScheduler RankService
 pause/speed/    Day Zero →     level =        catalogue item →  BoW weekly,     City Score →
 time-of-day     year counter   f(residents)   requiredLevel    chests 4h/24h,   Mayor Score =
 free-premium                    (no XP)        + per-mode      gifts 3h, 8h    Mayoral Match-Up
 window                                        capability set   window, monthly
                                                                     updates
                                        │
                    ┌───────────────────┴────────────────────┐
                    │              REGION / MAPS               │
                    │  regionId → [ mapId … ]  activeMapId      │
                    │  per-map: resident count, level?, tiles   │
                    │  cross-map: harbor→global food+waste,     │
                    │             C-Wire→global energy,        │
                    │             water pipeline→global water  │
                    │  region-wide: City Upgrades, Mayor Score,│
                    │                leaderboard               │
                    │  shared wallet (scope TBD — OQ-ECO-16)   │
                    └──────────────────────────────────────────┘
```

**Architectural finding — two axes, and only one of them is real.** *Level* is the **mechanical** progression
axis: it is derived from resident count and it gates the building catalogue (S10). *Scale language* ("farm",
"village", "small town", "metropolis") appears **only in store-listing marketing copy** describing map size and
library size (S31, S32) — never as a game state with thresholds — so it is **not** a second axis and must not
be modelled as one (§5.3, FR-CORE-046). Equally, the **PC Early Access build has no level at all**: the store
says "Economy and progression systems are not yet included" (S1) and the demo announcement says "there's no
economy in the game yet" (S6), so the mode registry must be able to disable `LevelTracker`, `UnlockRegistry`
and `RankService` wholesale without leaving the rest of the game in an invalid state.

---

## 3. Functional requirements

### 3.1 Session root, core loop and the simulation clock

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-CORE-001 | The session root shall be identified by `(accountId, product, modeId, regionId, activeMapId)`; every simulation tick, save write and UI refresh shall be scoped to exactly one session root. | Must | Both | no | QA-CORE-001 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-CORE-002 | The core loop shall be a fixed cycle: *select tool or building → confirm placement → resolve construction/operation → advance the clock → re-evaluate demand, usage, level, unlocks and score → persist*. The cycle shall run continuously and shall be pausable. | Must | Both | no | QA-CORE-002 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-003 | The simulation clock shall originate at **Day Zero** and shall expose a year counter that advances with elapsed simulated time (the tutorial's demo city was 229 years old). | Must | Both | no | QA-CORE-003 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-004 | All timed content — chests, free gifts, the free-user premium window, the Building-of-the-Week rotation — shall be evaluated against **one** authoritative clock, so a session cannot observe two different "now"s. | Must | Mobile | no | QA-CORE-003 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-005 | The session shall support **pause** and **speed** control; the observed ad reward grants **double speed for 10 minutes**. | Must | Mobile | no | QA-CORE-004 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-006 | Construction shall **progress while the player is not in the game**, shall be measured in **minutes** rather than hours or days, and shall progress **faster** when a speed-up remains or the speed-up package is owned. | Must | Mobile | no | QA-CORE-005 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-007 | Switching to another map shall reload the session onto the selected city (observed behaviour: "the game will reload with the city you selected") without losing shared state such as the **shared wallet** (its region-vs-profile scope is **[TBD]** — `ECO` owns it, OQ-ECO-16), the Building of the Week unlock or the City Upgrade set. | Must | Mobile | no | QA-CORE-006 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-CORE-008 | Each map shall keep its own identity — display name, tile-usage statistics (land / beach / water tiles occupied and free), resident count and level — so that switching maps re-scopes map-scoped progression. | Must | Mobile | no | QA-CORE-007 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-CORE-009 | A map shall be renameable by the player with a custom name or by choosing from generated city names. | Should | Mobile | no | QA-CORE-007 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-CORE-010 | Construction slots shall be a session-scoped progression resource: the player starts with **1**; each **Citycon Building** built grants **+1 permanent** slot; slots are also obtainable from the shop or collected over time. | Must | Mobile | partial | QA-CORE-008 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-011 | A building requiring **two or more** construction slots shall be placeable only when that many slots are free, and shall consume all of them for the duration of its construction. | Must | Mobile | no | QA-CORE-008 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-012 | "Demolish all map" shall be irreversible and shall return **owned buildings to the inventory** rather than destroying them, so a wipe never destroys the player's building collection. | Must | Mobile | no | QA-CORE-009 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-CORE-013 | The system shall support features that are **not available at game start** and shall express that as a per-mode starting capability set rather than as scattered code branches (the tutorial runs on an already-built city because "some of the features … are not unlocked at the game start"). | Must | Both | yes | QA-CORE-015 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.2 Game-mode registry and mode rulesets

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-CORE-014 | The build shall expose a **data-driven mode registry**: each mode definition carries `modeId`, display name, status and a **ruleset flag set** (economy, progression, residents, traffic, zoning, score, leaderboard, construction timers, camera/region, premium economy). Subsystems shall read the flags and shall never hard-code mode checks. | Must | Both | yes | QA-CORE-010 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-CORE-015 | A mode definition shall record its **status** — `shipped`, `in-development`, `announced`. Only `shipped` modes are selectable; `announced` modes are display-only, so the plan "the first two simulation modes already in early access" can be version-controlled before it ships. | Must | Both | yes | QA-CORE-011 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-CORE-016 | The registry shall ship at minimum the modes evidenced in published material: **Construction Sandbox** (PC Early Access) and **Sandbox Construction Mode** (mobile). | Must | Both | yes | QA-CORE-012 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-CORE-017 | **Construction Sandbox** (PC Early Access) shall enable world shaping, building placement, asset creation and exploration, and shall **disable** economy, progression, resident simulation, score and leaderboard — the store states "Economy and progression systems are not yet included". | Must | PC-EA | no | QA-CORE-012 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-CORE-018 | The PC Early Access build shall **not** present a demand bar, usage bar, level, resident count or City Score that cannot be satisfied by any simulated system: the demo announcement states "there's no economy in the game yet. You can build and explore, but it isn't a 'real' city builder yet, with systems that feed into each other and goals to work toward." | Must | PC-EA | no | QA-CORE-012 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-CORE-019 | **Sandbox Construction Mode** (mobile) shall permit **instant placement with no construction timers and no pay-to-skip**, while the economy still tracks the cost of what is built ("Resources are key, but there's no waiting for construction"). | Must | Mobile | no | QA-CORE-013 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| FR-CORE-020 | The **sandbox offer** ("we also have a new Sandbox offer with version two"; "premium sandbox for ultimate creativity") shall be modelled as an **entitlement that modifies a mode's ruleset**, not as a separate mode, so a third sandbox variant does not fork the ruleset. | Should | Mobile | partial | QA-CORE-014 | https://www.youtube.com/watch?v=6Jd2kyaEZbM |
| FR-CORE-021 | Entitlements shall **compose** with mode rulesets: the effective ruleset is the mode ruleset overridden by owned entitlements (e.g. owning **Sandbox Constructions** sets construction time to zero and permits instant confirmation when moving a building, inside the normal simulation context). | Must | Mobile | no | QA-CORE-014 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-022 | Each mode shall declare which **top-bar blocks** it shows — building demand, economy usage, money, level, resident count, date — and which are hidden. | Must | Both | no | QA-CORE-015 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-023 | The dev's announced PC simulation modes shall be represented in the registry as **announced** entries: a "**classical RCI mode**", one "**more focused on resource management**", and "**a very casual tycoon mode**". | Should | PC-EA | yes | QA-CORE-016 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-CORE-024 | The registry shall support a mode whose citizen simulation goes "**much deeper into the individual people, their life cycle, relationships, routines**", selectable as a distinct **opt-in** mode rather than as the default city simulation. | Should | PC-EA | no | QA-CORE-016 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| FR-CORE-025 | The registry shall be **extensible without an engine change**, matching the store's promise that the game is "designed to grow with additional game modes, new rule sets and new ways to experience the cities you create". | Must | Both | yes | QA-CORE-017 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-CORE-026 | Switching modes shall **never silently migrate, copy or destroy** city data; the player shall be told explicitly what happens to the existing city. | Must | Both | no | QA-CORE-017 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-CORE-027 | A mode shall be **re-enterable with an existing save**, and creating a city in one mode shall not destroy saves belonging to another mode. | Should | Both | no | QA-CORE-017 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-CORE-028 | **[TBD — design decision]** A **mode picker at session start** is not evidenced: no published flow shows one, and the observed mobile entry goes straight into a city. The build screen shall carry **no persistent mode picker**; if a mode-selection surface is implemented at all it shall be a **one-off** selection surface (first run, or an entry in a menu), listing shipped modes plus announced modes marked as coming later, and the save shall reopen on the last mode played. See OQ-CORE-03. | Could | Design | yes | QA-CORE-018 | TBD — OQ-CORE-03 |
| FR-CORE-029 | **[TBD — design decision]** A **shipped mobile "Classic Simulation mode"** and a **shipped mobile "Tycoon mode"** are not evidenced by any published source: the mobile listings name *Sandbox Construction Mode*, *Region View*, *Street View*, *Monthly Add-ons* and *Mayoral Match-Up*, and use "tycoon" as a **genre** ("Master the blend of tycoon strategy and creative puzzle-solving"), not as a mode name. Treat both names as unconfirmed until the developer clarifies. See OQ-CORE-04. | Could | Design | yes | QA-CORE-019 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 · TBD — OQ-CORE-04 |
| FR-CORE-030 | The **announced** PC modes and the shipped mobile mode shall be listed in the registry with their evidence and their status, so a reader can always tell which entries are shipped behaviour and which are roadmap. | Should | Both | yes | QA-CORE-016 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |

### 3.3 The progression gate: level, unlocks and library growth

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-CORE-031 | The build shall implement **no XP, no skill points and no experience bar**. Level shall be a direct function of **resident count**: "we don't have XP points, your level … depends on your residence amount". | Must | Both | no | QA-CORE-020 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-032 | Level shall be **monotone in resident count** — more residents means an equal or higher level — with no second progress accumulator that can drift away from the population. | Must | Both | no | QA-CORE-020 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-033 | The level curve shall be a **data table** (`level → minimum residents`) so it can be retuned without an engine change. The actual thresholds are **not published by the developer** and are [TBD] — OQ-CORE-01. | Must | Both | yes | QA-CORE-020 | https://www.youtube.com/watch?v=jYAD0SkDmY0 · TBD — OQ-CORE-01 |
| FR-CORE-034 | Raising the resident count shall raise the level, and "**higher levels unlock more buildings**" shall be the gating rule for the building catalogue. | Must | Both | no | QA-CORE-021 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-035 | Each catalogue entry shall declare a **required level**, and the unlock check shall consult **only** the level — no second, parallel unlock path. | Must | Both | yes | QA-CORE-021 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-036 | The level and the unlock set shall be **re-evaluated whenever the resident count changes**, including after demolitions and after a map wipe, so the catalogue never shows an entry that the player has earned or lost. | Must | Both | no | QA-CORE-022 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-CORE-037 | Whether the level is **per-map** or **region/account-wide** is not stated by the source (the top bar shows the level next to "your residence amount of this current map"). The build shall resolve this [TBD] — OQ-CORE-02 — and shall not assert either scope until it is confirmed. | Should | Both | no | QA-CORE-023 | https://www.youtube.com/watch?v=jYAD0SkDmY0 · TBD — OQ-CORE-02 |
| FR-CORE-038 | Unlocked catalogue entries shall **persist**; demolishing, moving, storing or selling a building shall never revoke an unlock. | Must | Both | no | QA-CORE-022 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-CORE-039 | The level→unlock mechanic is corroborated by third-party play: "you get **bonuses and new buildings as you level up**". | Should | Mobile | no | QA-CORE-021 | https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |
| FR-CORE-040 | The building library shall be **continuously growing**: the mobile title ships "over 300" buildings and the PC store promises a "**Continuously Growing Library**" of buildings, vehicles, citizens and props. | Must | Both | no | QA-CORE-024 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-041 | The catalogue shall be wide enough to be a **progression pressure**, not decoration: the diversity bonus needs **250 unique building types** to reach its cap, so unlocking breadth is what drives growth. | Should | Mobile | no | QA-CORE-024 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-CORE-042 | The city shall expose a distinct **growth-stall** state: when any usage bar reaches **100 %** the city stops growing, so the level stops rising and **no further unlock becomes reachable** until usage is reduced. | Must | Both | no | QA-CORE-025 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-CORE-043 | The **90 % usage band** shall reduce city growth proportionally, so between 90 % and 100 % the player experiences slowed progress toward the next level rather than a hard stop. | Must | Both | no | QA-CORE-025 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-CORE-044 | The **mailbox** shall be a progression input: it is "mainly where you receive your tasks", and completing a mailed task awards points that can be spent. | Should | Mobile | no | QA-CORE-026 | https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |
| FR-CORE-045 | **City Upgrades** shall be a **separate, coin-funded progression track** from the level track — bought with coins (some with Super Cash) and covering water consumption/production, energy, trash, coin value and coin appearance. | Must | Mobile | no | QA-CORE-026 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-046 | **No content shall be gated on a named city stage.** The stage vocabulary ("farm", "village", "small town", "town", "city", "metropolis") appears only in store-listing marketing copy about **map scale** ("HUGE MAPS: … from quiet villages and small towns to sprawling metropolises") and **library size** ("300+ BUILDINGS: Grow from farm to metropolis"), never as a game state with published thresholds. See §5.3. | Must | Both | no | QA-CORE-027 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |

### 3.4 Content cadence: add-ons, Building of the Week, chests, gifts, storage

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-CORE-047 | **Add-ons** shall be **permanent unlocks**: "add-on means you unlock it once you got it forever, you can build it as often as you want". | Must | Mobile | no | QA-CORE-028 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-048 | The **Building of the Week** shall be a **weekly rotating** building that is **Unique** and available **only that week**; it may return much later, so the rotation must not be a fixed calendar. | Must | Mobile | yes | QA-CORE-028 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-049 | The game shall support a **monthly content cadence**: "MONTHLY ADD-ONS: … new buildings every month" and "MONTHLY UPDATES: New buildings and content every month". | Must | Mobile | yes | QA-CORE-028 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| FR-CORE-050 | Free **chests** shall be redeemable every **4 hours** and every **24 hours**, granting **collectible parts** and **bonus cards**. | Must | Mobile | no | QA-CORE-029 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-051 | A **free gift** shall be granted every **3 hours** at no cost. | Must | Mobile | no | QA-CORE-029 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-052 | **Free users** shall receive a premium-options block every **8 hours**, redeemable by watching **four ads**; that block is the free-user route to the premium options. | Must | Mobile | no | QA-CORE-029 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-053 | The **speed-up package** shall remove the ad-based speed-up button permanently and shall make offline constructions finish faster; an unowned speed-up remains available as an **ad reward granting double speed for 10 minutes**. | Must | Mobile | no | QA-CORE-029 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-054 | The **Piggy Bank** shall accumulate **Super Cash** over time from player activity and shall be purchasable at a heavily reduced price once filled. | Must | Mobile | no | QA-CORE-029 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-055 | **Collectible cards** shall be obtainable from chests or over time, and shall be **completable early** through a premium option. | Must | Mobile | no | QA-CORE-029 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-056 | **Storage** shall hold buildings and bonus cards that are **out of the inventory but still owned**; moving an item into storage shall never reduce what the player owns. | Must | Mobile | no | QA-CORE-030 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-CORE-057 | A stored item shall be **redeemed from the shop**: a stored entry shows a **blue redeem button in place of its price** and returns the chosen quantity to the inventory. | Must | Mobile | no | QA-CORE-030 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-CORE-058 | **Selling** a building from the inventory shall be **irreversible** and shall credit **coins**; selling shall be a distinct, explicit choice from storing. | Must | Mobile | no | QA-CORE-030 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-CORE-059 | The **storage tab** shall be present in the building shop **only when storage is non-empty** ("this tab … is only there when you got something in storage"). | Must | Mobile | no | QA-CORE-030 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-060 | The live-ops schedule shall be **data-driven and clock-driven**, so a rotation entry can end and be replaced (BoW → next BoW, chest window → next window) without a client update. | Must | Both | yes | QA-CORE-028 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.5 Region, maps and cross-map play

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-CORE-061 | **Region View** shall be entered by **zooming out fully and zooming out again**, and shall show all maps of the region with the **active map marked in blue**. | Must | Mobile | no | QA-CORE-031 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-CORE-062 | The region shall own the set of maps, and the active map shall be switchable from Region View with a **confirmation prompt**; switching reloads the game onto the selected city. | Must | Mobile | no | QA-CORE-031 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-CORE-063 | There is currently **exactly one region** ("for now it's only one") and multiple regions are an announced future feature ("we will launch new regions soon"); the data model shall therefore carry a region id and shall not hard-code a single region. | Must | Mobile | yes | QA-CORE-031 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-CORE-064 | Region View shall support a **clean presentation state** (the map lines fade after a few seconds) so the region can be used for screenshots and sharing. | Should | Mobile | no | QA-CORE-032 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-CORE-065 | Cross-map economy connections shall be resolved **per region**: a map owning a **Harbor** joins the region-wide food-and-waste pool, a map owning the **energy C-Wire** joins the energy net, and the **water pipeline** joins the water net. **The membership and pool rules are owned by `ECO`** (FR-ECO-101…FR-ECO-105, FR-ECO-102) and are not restated here. | Must | Mobile | no | QA-CORE-033 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-CORE-066 | Bonus scopes shall be distinct and shall not be conflated: **Global** bonuses (from City Upgrades) apply to all maps in the current region, **map** bonuses apply to all buildings on the current map, and **local** bonuses apply only inside the emitter's area of effect. | Must | Mobile | no | QA-CORE-033 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-CORE-067 | The scope of the shared currency pool shall **not be asserted** beyond the source: the only evidenced statement is "all your coins, all your super cash — that's also one amount … it's **shared across all maps**". Whether the pool is **profile-wide** or **region-wide** is **[TBD]** — **OQ-ECO-16**, which `ECO` owns; `CORE` cross-references it (OQ-CORE-05) and shall not contradict it. | Must | Both | no | QA-CORE-034 | https://www.youtube.com/watch?v=m5O-A33wQm0 · TBD — OQ-ECO-16 |

### 3.6 Ranking: City Score → Mayor Score → Mayoral Match-Up

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-CORE-068 | Each map shall carry a **City Score** derived from its resident count and its happiness; the formula itself is owned by `POP`. | Must | Mobile | no | QA-CORE-035 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-CORE-069 | The **region** shall be the grouping unit for the Mayor Score, which is the **sum of the City Scores of its maps**, shown top-left in the HUD and again in the government overview tab. **The score definitions and the aggregation are owned by `POP`** (FR-POP-099, FR-POP-100); `CORE` owns only the region container and shall not restate the scoring rule. | Must | Mobile | no | QA-CORE-035 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-CORE-070 | The game shall offer the **Mayoral Match-Up**, a global ranking: "Compete in the Mayoral Match-Up — a global ranking where mayors compete to construct the best city and grow their empire." | Must | Mobile | no | QA-CORE-036 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| FR-CORE-071 | A **High Scores** HUD entry shall show the player "an overview of your current ranking". | Must | Mobile | no | QA-CORE-036 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-CORE-072 | Leaderboard submission shall transmit **only aggregate score and region identity**, never per-citizen or per-building data. | Should | Mobile | no | QA-CORE-036 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| FR-CORE-073 | The **maximum attainable City Score shall not be published** by the game ("so far no one figured out what's the maximum"); the build shall keep the optimum discoverable without publishing a target value. | Should | Mobile | no | QA-CORE-036 | https://www.youtube.com/watch?v=_QpxzZFTBtw |

### 3.7 Explicitly unevidenced behaviour — design decisions only

> Every row in this subsection is a **design decision for this rebuild**, not a claim about the game. Each carries
> Priority `Could`, Stage `Design`, the marker `[TBD — design decision]` and a Section 11 entry. None of them
> cites a source for a behaviour that does not exist in the game.

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-CORE-074 | **[TBD — design decision]** An **optional cosmetic scale label** derived from the level band may be shown as framing. It shall **never** gate content, unlock buildings, change a ruleset or alter scoring. See OQ-CORE-06. | Could | Design | yes | QA-CORE-037 | TBD — OQ-CORE-06 |
| FR-CORE-075 | **[TBD — design decision]** If a named scale taxonomy is adopted at all, it shall live in a data table with **no published thresholds** and shall be labelled in the UI as descriptive framing. The only published vocabulary is marketing adjectives for map scale and library size. See OQ-CORE-06. | Could | Design | yes | QA-CORE-038 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder · TBD — OQ-CORE-06 |
| FR-CORE-076 | **[TBD — design decision]** The resident→level curve values, and whether level is per-map or per-account, shall be settled before implementation; the implementation shall read both from data so that either outcome is a **tuning change, not a code change**. See OQ-CORE-01 and OQ-CORE-02. | Could | Design | yes | QA-CORE-039 | https://www.youtube.com/watch?v=jYAD0SkDmY0 · TBD — OQ-CORE-01, OQ-CORE-02 |
| FR-CORE-077 | **[TBD — design decision]** A **puzzle / scenario** mode with fixed objectives (hinted at by the store listing's "creative puzzle-solving") is not evidenced as a shipped mode. If added it shall be a ruleset with a **win-condition list** and a **starting grant**, distinct from free-form play. See OQ-CORE-07. | Could | Design | yes | QA-CORE-039 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 · TBD — OQ-CORE-07 |
| FR-CORE-078 | **[TBD — design decision]** A **deep per-citizen simulation** mode shall remain **opt-in** and shall be gated behind a mode flag, because the developer identifies **scaling** as "the hard part with this stuff". See OQ-CORE-08. | Could | Design | yes | QA-CORE-039 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ · TBD — OQ-CORE-08 |

---

## 4. Options, variants & configuration matrix

### 4.1 Mode registry (as shipped in this build)

| Mode | Evidence | Status | Stage | Economy | Progression / level | Construction timers | Score / leaderboard | Region / camera |
|---|---|---|---|---|---|---|---|---|
| **Construction Sandbox** | Steam store feature list; EA Q&A; demo announcement | shipped | `PC-EA` | off | off | off | off | map creation, terraforming, SCC Studio, 1st/3rd person |
| **Sandbox Construction Mode** | App Store + Google Play feature bullets; "premium sandbox" offer | shipped | `Mobile` | on (cost tracked) | on | **zero** — instant placement | on | region view, street view |
| **Default city play** (the mode entered by opening the game) | "The Basics" flow, economy tutorial | shipped | `Mobile` | on | on | on | on | region view, street view |
| **Classical RCI** | dev Steam thread | announced | `PC-EA` | on | on | on | on | — |
| **Resource Management** | dev Steam thread | announced | `PC-EA` | on | on | on | on | — |
| **Casual tycoon** | dev Steam thread | announced | `PC-EA` | relaxed | on | on | on | — |
| **Deep-citizen simulation** | dev Steam thread | announced | `PC-EA` | on | on | on | on | opt-in |
| **Mode picker** | *none* | TBD (design) | `Design` | — | — | — | — | OQ-CORE-03 |
| **Mobile "Classic Simulation" / "Tycoon" as named modes** | *none* | TBD (design) | `Design` | — | — | — | — | OQ-CORE-04 |

### 4.2 Entitlement matrix (mobile)

| Entitlement | Effect | Cadence / permanence | Progress value |
|---|---|---|---|
| **Add-ons** | unlock content that can then be built as often as wanted | permanent ("once you got it forever") | permanent catalogue additions |
| **Building of the Week** | one unique building, that week only | weekly rotation, may return much later | time-limited unlock |
| **Sandbox Constructions** | zero construction time; instant confirm when moving buildings | permanent | removes the wait from the sandbox context |
| **Citycon Building** | **+1 permanent construction slot** | permanent, one per building placed | raises parallel construction capacity |
| **Speed-up package** | removes the ad speed-up button; faster offline construction | permanent | removes the ad tax on speed-ups |
| **Piggy Bank** | accumulates Super Cash from activity | fills over time; discounted purchase when full | premium currency accrual |
| **Super Cash** | premium currency | purchasable | economy |

### 4.3 Timed cadence matrix

| Cadence | Period | Reward | Source |
|---|---|---|---|
| Free chest | every **4 h** and every **24 h** | collectible parts + bonus cards | `jYAD0SkDmY0` |
| Free gift | every **3 h** | free reward | `jYAD0SkDmY0` |
| Free-user premium block | every **8 h**, 4 ads | temporary access to premium options | `jYAD0SkDmY0` |
| Ad speed-up | on request | **double speed for 10 minutes** | `jYAD0SkDmY0` |
| Building of the Week | **weekly** | one unique building | `jYAD0SkDmY0` |
| Monthly add-ons / updates | **monthly** | new buildings and content | App Store, Google Play |

### 4.4 Top-bar block availability by mode

| Block | Construction Sandbox (`PC-EA`) | Sandbox Construction Mode (`Mobile`) | Default city play (`Mobile`) |
|---|---|---|---|
| Building demand bars | hidden | shown | shown |
| Economy usage bars | hidden | shown | shown |
| Money | hidden | shown | shown |
| Level | hidden | shown | shown |
| Resident count (current map) | hidden | shown | shown |
| Date (Day Zero → year counter) | shown (world time) | shown | shown |
| Mayor Score / high scores | hidden | shown | shown |
| Region View / Street View | region + first/third person | shown | shown |

### 4.5 Cross-map connection options (pool membership — `ECO` owns the rule)

| Connection | Effect | Scope |
|---|---|---|
| **Harbor** | makes **this map** a member of the **region-wide** food-and-waste pool | membership per map, pool region-wide |
| **Energy C-Wire** | makes **this map** a member of the **region-wide** energy net | membership per map, pool region-wide |
| **Water pipeline** | makes **this map** a member of the **region-wide** water net | membership per map, pool region-wide |
| **City Upgrades** | source of **Global** income bonuses | region |
| Currency pool (coins, Super Cash) | one amount "shared across all maps" | **TBD** — OQ-ECO-16 (cross-referenced by OQ-CORE-05), owned by `ECO` |

> **The membership and pool rules are owned by `ECO`** (FR-ECO-101…FR-ECO-105, FR-ECO-102); this table
> lists the connections only and does not restate them. A map that does not own the building is not a
> member of that pool.

---

## 5. Stage / progression matrix (level-gated)

> **This domain's progression dimension is the LEVEL BAND, not a named city stage.** Level is the only
> progression axis the game evidences (S10). The stage rows below are therefore expressed as **level bands**,
> whose thresholds are [TBD] — OQ-CORE-01. No row in this document gates content on a stage *name*.

### 5.1 Level band → capability matrix

| Band | Entry condition | Player can build | Player can rebuild / modify | Unlocks | Exits when |
|---|---|---|---|---|---|
| **Band 1 — starting city** | A new city at level 1; "some of the features … are not unlocked at the game start" | Everything already visible in the shop at level 1 | Full edit: rotate, move, demolish, store, sell | The level-1 subset of the catalogue plus one construction slot | Resident count crosses the level-2 threshold (TBD) |
| **Band N — growth band** | Level *N* reached by raising the resident count | Catalogue entries with `requiredLevel ≤ N` | Unchanged | The catalogue rows unlocked at level *N* | Resident count crosses the level-*(N+1)* threshold (TBD) |
| **Band max — stalled** | Any usage bar at **100 %**: the city stops growing | No new unlocks are reachable — progression is blocked by supply, not by a gate | Unchanged (demolish / rebuild still allowed) | None until usage drops below the stall | Usage falls back below 100 %, then the 90 % band still slows growth until it is below 90 % |
| **Band — regressed** | Resident count falls (demolition, emigration, map wipe) below the current band's threshold | Catalogue rows above the current level re-lock | Unchanged | Previously unlocked rows remain owned; only *availability* changes | Resident count rises again |

### 5.2 Per-mode progression availability

| Mode | Level shown | Catalogue gated by level | Unlock check active | Notes |
|---|---|---|---|---|
| Construction Sandbox (`PC-EA`) | no | **no** | **disabled** | "Economy and progression systems are not yet included" |
| Sandbox Construction Mode (`Mobile`) | yes | yes | active | progression runs in parallel with instant construction |
| Default city play (`Mobile`) | yes | yes | active | the evidenced progression context |

### 5.3 Scale vocabulary in store listings — **marketing copy, not a game mechanic**

| Phrase as published | Where it actually appears | What it describes | Game mechanic? |
|---|---|---|---|
| "from quiet villages and small towns to sprawling metropolises" | Google Play, under the bullet "**HUGE MAPS**: Build on massive maps with total creative freedom" | **map scale** | **No** — no thresholds, no state, no trigger anywhere in the game's own text |
| "Grow from farm to metropolis" | Google Play, under the bullet "**300+ BUILDINGS**"; App Store, under "**GROW FROM FARM TO METROPOLIS**: Expand your city with over 300 unique structures" | **library size / marketing arc** | **No** — "farm" and "metropolis" are the only two rungs that ever appear; "town" and "city" are absent from the game's own text |
| "Design your town from a small village to a massive metropolis" | Google Play intro copy | marketing arc | **No** |
| "grow your city from its first block to an enormous metropolis" | Steam store description | marketing arc | **No** |

**Consequence.** There is no six-rung ladder, no `town` or `city` stage, and no published threshold. The
rebuild therefore gates **only** on level (FR-CORE-031 … FR-CORE-036), and any scale label is an explicitly
labelled cosmetic design decision (FR-CORE-074, FR-CORE-075).

---

## 6. Data model

### 6.1 `SessionRoot`

| Field | Type | Range / domain | Meaning | Source |
|---|---|---|---|---|
| `accountId` | uuid | — | Player account | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| `product` | enum | `pc` / `mobile` | The two products are separate games | https://supercitycon.net/ |
| `modeId` | string | registry key | Active mode definition | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| `regionId` | uuid | — | Owning region; multiple regions announced | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| `activeMapId` | uuid | — | The map being played | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| `clock.simulatedSeconds` | int64 | ≥ 0 | Elapsed simulated time since Day Zero | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `clock.dayIndex` | int64 | ≥ 0 | Day counter; the game starts at Day Zero | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `clock.yearIndex` | int64 | ≥ 0 | Year counter (demo city reached 229) | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `clock.speedMultiplier` | float | ≥ 0 | Current speed; ad reward sets 2× for 10 minutes | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `constructionSlotsFree` | int32 | ≥ 0 | Slots in use; total = 1 + owned Citycon Buildings + purchased/collected slots | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 6.2 `ModeDefinition`

| Field | Type | Range / domain | Meaning | Source |
|---|---|---|---|---|
| `modeId` | string | — | Stable key | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| `displayName` | string | — | Player-facing name | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| `status` | enum | `shipped` / `in-development` / `announced` | Only `shipped` is selectable | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| `flags.economy` | bool | — | Economy systems active | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| `flags.progression` | bool | — | Level + unlock gating active; **off** in the PC Early Access build | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| `flags.residents` | bool | — | Resident simulation active | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| `flags.zoning` / `flags.traffic` | bool | — | RCI-style systems active | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| `flags.score` / `flags.leaderboard` | bool | — | City/Mayor Score and the Mayoral Match-Up active | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| `flags.constructionTimers` | bool | — | `false` ⇒ instant placement (sandbox) | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| `flags.premiumEconomy` | bool | — | Piggy Bank / Super Cash / ad block active | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `topBarBlocks` | set | demand, usage, money, level, residents, date | Which top-bar blocks the mode shows | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `startingCapabilities` | set | capability ids | Features "not unlocked at the game start" | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `startingGrant` | object | coins, superCash, unlockSet | Baseline for a new city in this mode | TBD — OQ-CORE-07 |

### 6.3 `LevelTable` and `UnlockEntry`

| Field | Type | Range / domain | Meaning | Source |
|---|---|---|---|---|
| `levelTable[level].minResidents` | int64 | ≥ 0 | Resident count required for the level — **values TBD** | https://www.youtube.com/watch?v=jYAD0SkDmY0 · TBD — OQ-CORE-01 |
| `levelTable[level].unlockIds[]` | string[] | catalogue ids | Catalogue entries released at that level | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `unlockEntry.requiredLevel` | int32 | ≥ 0 | Level gate for one catalogue entry; `0` = available from the start | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `unlockEntry.source` | enum | `level` / `addOn` / `buildingOfTheWeek` / `store` | How the entry became available | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `unlockEntry.expiresAt` | timestamp | — | Set only for weekly/rotating content | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 6.4 `Region` and `MapRecord`

| Field | Type | Range / domain | Meaning | Source |
|---|---|---|---|---|
| `region.regionId` | uuid | — | Region identity; one exists today, more announced | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| `region.mapIds[]` | uuid[] | — | Maps in the region | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| `region.activeMapId` | uuid | — | The map currently loaded; rendered blue in Region View | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| `region.mayorScore` | int64 | ≥ 0 | Σ City Score of the region's maps | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| `map.displayName` | string | — | Custom or generated city name | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| `map.residents` | int64 | ≥ 0 | Resident count of **this map** (owned by `POP`) | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `map.level` | int32 | ≥ 1 | Level of this map — **scope TBD** | https://www.youtube.com/watch?v=jYAD0SkDmY0 · TBD — OQ-CORE-02 |
| `map.tileUsage.land/beach/water` | {used, free} | ≥ 0 | Tile occupancy shown in the map info window | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| `map.connections.harbor` | bool | — | Joins the map to the global food + waste system | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| `map.connections.cWire` | bool | — | Joins the map to the global energy system | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| `map.connections.waterPipeline` | bool | — | Joins the map to the global water system | https://www.youtube.com/watch?v=m5O-A33wQm0 |

### 6.5 `LiveOpsSchedule`, `StorageRecord`, `RankSubmission`

| Entity | Field | Type | Meaning | Source |
|---|---|---|---|---|
| `LiveOpsSchedule` | `entryId`, `type` (`boW` / `chest` / `gift` / `freeWindow` / `monthly`) | — | Which cadence slot | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| | `startsAt`, `endsAt`, `periodSeconds` | int64 | Window boundaries; chest 4 h/24 h, gift 3 h, free window 8 h | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| | `reward` | object | Parts, bonus cards, gift, premium block, unique building | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `StorageRecord` | `itemId`, `type` (`building` / `bonusCard`), `quantity` | int32 ≥ 0 | Items out of the inventory but still owned | https://www.youtube.com/watch?v=cSRDwHvowWI |
| | `redeemableFrom` | enum | `shop` — stored entries show a blue redeem button in place of the price | https://www.youtube.com/watch?v=cSRDwHvowWI |
| `RankSubmission` | `regionId`, `mayorScore` | uuid, int64 | The only data sent to the leaderboard | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| | `publishedMaximum` | bool | `false` — the maximum City Score is not published | https://www.youtube.com/watch?v=_QpxzZFTBtw |

---

## 7. Rules, formulas & tuning

### 7.1 Level — the only evidenced progression formula

```
level = max { L : levelTable[L].minResidents <= residents }        # monotone, no XP
```

- The **only** input is the resident count of the relevant scope (per-map or account — OQ-CORE-02).
- There is **no XP**, no separate progress bar and no skill points (S10).
- `levelTable` is data, so the curve is retunable without an engine change (FR-CORE-033).
- Thresholds are **not published** → [TBD] — OQ-CORE-01.

### 7.2 Unlock evaluation

```
unlocked(entry) := entry.requiredLevel <= level        # level is the only gate
```

- A catalogue entry may have **several** unlock sources: level, add-on, Building of the Week, direct store
  purchase. Availability = the **union**; the level gate is the *level* source only (FR-CORE-035).
- Weekly entries additionally carry `expiresAt`; expiry removes availability but never ownership.
- Ownership survives demolition, moving, storing and selling (FR-CORE-038).

### 7.3 Construction slots

```
totalSlots   = 1 + (#CityconBuildings placed) + purchasedSlots + collectedSlots
freeSlots    = totalSlots - Σ slots consumed by in-progress constructions
placeable(b) := freeSlots >= b.requiredSlots
```

- A building requiring two or more slots consumes all of them until it completes (S11).
- Citycon Buildings grant their slot **permanently** (S11, S35).

### 7.4 Clock and cadence

```
dayIndex  = floor(simulatedSeconds / secondsPerDay)
yearIndex = floor(dayIndex / daysPerYear) + yearBase        # starts at Day Zero
nextClaim(entry) = entry.startsAt + k * entry.periodSeconds   # k = elapsed periods
```

- Chest periods: **4 h** and **24 h**; free gift **3 h**; free-user premium block **8 h** (4 ads);
  Building of the Week **weekly**; monthly add-ons (S14, S49).
- Construction timers are measured in **minutes** and progress while the player is offline; speed-ups shorten
  the remaining time (S13, S14).
- `secondsPerDay` and `daysPerYear` are tuning values → [TBD] — OQ-CORE-09.

### 7.5 Region score aggregation

```
cityScore(map)  = f(residents(map), happiness(map))     # formula owned by POP
mayorScore      = Σ cityScore(map)  for all maps in region
```

- Leaderboard submission = `{ regionId, mayorScore }` only (S28, S70).
- The maximum attainable City Score is **not published** (S73).

### 7.6 Bonus scopes (for unlock/region reasoning only)

| Scope | Applies to | Source of the bonus | Scope of the effect |
|---|---|---|---|
| Global | all maps in the current region | City Upgrades | region |
| Map | all buildings on the current map | map-specific buildings | map |
| Local | buildings inside the emitter's area of effect | decorative / bonus buildings | area |

### 7.7 Tuning values that are **not** published

| Value | Status | Open question |
|---|---|---|
| `levelTable[L].minResidents` for every L | [TBD] | OQ-CORE-01 |
| Level scope (per-map vs per-account) | [TBD] | OQ-CORE-02 |
| Wallet scope (profile-wide vs region-wide) | [TBD] — owned by `ECO` | OQ-ECO-16 (via OQ-CORE-05) |
| Scale-label thresholds, if any label ships | [TBD] — design only | OQ-CORE-06 |
| `secondsPerDay`, `daysPerYear` | [TBD] | OQ-CORE-09 |

---

## 8. Edge cases, failure modes & required behaviours

| # | Edge case | Required behaviour | Source |
|---|---|---|---|
| E1 | Player switches maps mid-session | Region-wide state (City Upgrades, Building of the Week, Mayor Score) is preserved, and so is the **shared wallet** (its scope is **[TBD]** — OQ-ECO-16); map-scoped state (resident count, tiles, level) re-scopes | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| E2 | Player cancels the map-switch confirmation | The session stays on the current map; no state changes | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| E3 | Player uses "demolish all map" | A warning is shown, the OK control is styled as destructive, the city is wiped irreversibly, and **owned buildings return to the inventory** | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| E4 | Wipe drops the resident count below the current level threshold | The level recomputes downward, catalogue rows above the level re-lock, and previously unlocked rows stay owned | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| E5 | A usage bar reaches 100 % | City growth stops; the level stops rising; no further unlock is reachable until usage is reduced | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| E6 | A usage bar sits between 90 % and 100 % | Growth is reduced proportionally — visible as slower progress toward the next level | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| E7 | Player is offline across a chest/gift boundary | On return, the elapsed periods are reconciled and the claimable chests/gifts are shown | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| E8 | The Building of the Week expires while the player is offline | The entry leaves availability but the player's ownership record is not corrupted | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| E9 | Storage holds every copy of a building | The inventory shows zero of it; the building remains owned and redeemable from the shop | https://www.youtube.com/watch?v=cSRDwHvowWI |
| E10 | Player sells a stored building | Not possible — the sell action exists on inventory items only; stored items are redeemed, not sold | https://www.youtube.com/watch?v=cSRDwHvowWI |
| E11 | Player is in the PC Construction Sandbox | No demand bar, usage bar, level, resident count or score is shown; nothing is locked behind a level | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| E12 | Player switches into an announced mode | The mode is listed as coming later and cannot be entered; the existing city is untouched | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ |
| E13 | A map in the region **owns a Harbor** and another does not | Only the map that owns the Harbor is a **member** of the **region-wide** food-and-waste pool; the map without a Harbor keeps its local figures and cannot share the pool. The membership rule is owned by `ECO` — FR-ECO-102 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| E14 | City Upgrades are purchased while a second map is open | The Global bonus applies to all maps in the region, so the other map's income changes too | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| E15 | Player has no storage items | The storage tab is absent from the building shop | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| E16 | A new region is created | Map-scoped data needs no schema change; only region membership changes | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| E17 | Player has no ad entitlement and no speed-up package | The ad speed-up button remains and grants double speed for 10 minutes | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| E18 | Level is evaluated while the population is mid-tick | The unlock set reflects the last committed resident count, never a partially applied one | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

---

## 9. Non-functional requirements

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| NFR-CORE-001 | The mode registry, level table, unlock table and live-ops schedule shall be authored as **external data** (JSON/asset), so content can be added or retuned without recompiling or republishing the client — the store's "new rule sets" promise has to be deliverable. | Must | Both | yes | QA-CORE-040 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| NFR-CORE-002 | Unlock evaluation shall be **O(1) per catalogue entry** on a level change and shall not require scanning placed buildings; re-evaluation shall be triggered by resident-count changes, not by a per-frame poll. | Should | Both | no | QA-CORE-041 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-CORE-003 | The build shall **never present an unlock gate the player cannot clear** in the current mode: a mode with `flags.progression = false` shall show no level-locked catalogue entries at all. | Must | Both | no | QA-CORE-041 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| NFR-CORE-004 | Unconfigured or not-yet-tuned values (a missing level threshold, an unset region id) shall be surfaced in developer tooling as an **explicit TBD**, not silently defaulted to zero. | Should | Both | yes | QA-CORE-041 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-CORE-005 | A mode switch shall not cost more than one **session reload**; the observed behaviour is a full reload onto the selected city. | Should | Mobile | no | QA-CORE-042 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| NFR-CORE-006 | Region View shall remain usable on **low-spec mobile devices** — the dev explicitly calls it "everything but not easy to do this on low spec mobile devices but yeah we made it work". | Should | Mobile | no | QA-CORE-042 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| NFR-CORE-007 | **Region-wide** and **map-scoped** progression state shall be stored separably, so that adding a second region (announced as "we will launch new regions soon") requires no schema change to map-scoped data. | Should | Both | yes | QA-CORE-042 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| NFR-CORE-008 | Timed content shall survive an application restart: the clock shall be reconstructed from persisted state so a chest or gift window left open is still claimable on return. | Must | Mobile | no | QA-CORE-043 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-CORE-009 | Offline progression shall be **reconciled on first launch after an absence** using elapsed real time, so a returning player is shown the correct number of claimable chests, gifts and free-user blocks. | Must | Mobile | no | QA-CORE-043 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-CORE-010 | The top bar shall show the player's **level** and the **current map's resident count** adjacently, as the reference UI does, so the level↔population link is always visible to the player. | Should | Both | no | QA-CORE-044 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-CORE-011 | The unlock table shall be able to express a **required level of 0**, so a fresh city is never artificially gated. | Should | Both | yes | QA-CORE-044 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-CORE-012 | Every source used for this product family shall identify **one of the two real SuperCitycon products** — the PC title (Steam app `3474890`) or the mobile title (App Store id `1607860732` / `com.benwilles.citybuilder`); a source describing any other game shall be rejected by the dossier's source-ledger check. | Must | Both | yes | QA-CORE-045 | https://supercitycon.net/ |

---

## 10. Acceptance-criteria suites

| ID | Given | When | Then | Covers |
|---|---|---|---|---|
| QA-CORE-001 | A save with two maps in one region and an active map | A tick, a save write and a UI refresh occur | All three are scoped to the same `(accountId, product, modeId, regionId, activeMapId)` root | FR-CORE-001 |
| QA-CORE-002 | A running city session | The player places a building | The loop runs select → confirm → resolve → advance clock → re-evaluate demand/level/unlocks/score → persist, and can be paused at any step | FR-CORE-002 |
| QA-CORE-003 | A newly created city | The clock is read and a chest window is inspected | The date reads "Day Zero", the year counter advances, and the chest window and the clock resolve to the same "now" | FR-CORE-003, FR-CORE-004 |
| QA-CORE-004 | A session at normal speed | The player watches the speed-up ad | The session runs at 2× speed and the boost expires by itself after 10 minutes | FR-CORE-005 |
| QA-CORE-005 | A building under construction and the app closed for 30 minutes | The player returns | The construction has advanced by the elapsed minutes, and advances further when the speed-up package is owned | FR-CORE-006, FR-CORE-053 |
| QA-CORE-006 | A region with a purchased City Upgrade and a Building of the Week unlock | The player switches to another map | The new map loads with the region-wide upgrades and unlock intact, and only map-scoped values change | FR-CORE-007 |
| QA-CORE-007 | A region with two maps | The player opens a map's info panel | The map shows its own display name, its land/beach/water tile usage and its own resident count, and the name can be edited to a custom value | FR-CORE-008, FR-CORE-009 |
| QA-CORE-008 | A fresh city with one construction slot | The player builds a Citycon Building, then places a building that needs two slots | The slot count rises to 2 and the two-slot building can then be placed and occupies both slots until it completes | FR-CORE-010, FR-CORE-011 |
| QA-CORE-009 | A city with owned buildings | The player uses "demolish all map" and confirms | The map is emptied irreversibly, the buildings reappear in the inventory, and none of them is lost | FR-CORE-012 |
| QA-CORE-010 | Two modes with different ruleset flags | The economy subsystem queries its active state | The answer comes from the mode's flags, and no subsystem contains a hard-coded mode name | FR-CORE-014 |
| QA-CORE-011 | The mode registry is inspected (shipped and announced modes listed) | The player opens the registry's mode list | Only `shipped` modes are selectable; `announced` modes are shown as coming later and cannot be entered; the registry is a data view, not a build-screen picker | FR-CORE-015 |
| QA-CORE-012 | The PC Early Access build | The player opens a city | No demand bar, usage bar, level, resident count or City Score is shown, and no catalogue entry is level-locked | FR-CORE-016, FR-CORE-017, FR-CORE-018 |
| QA-CORE-013 | Sandbox Construction Mode | The player places a building | The building is placed instantly with no construction timer and no pay-to-skip prompt, while its cost is still deducted | FR-CORE-019 |
| QA-CORE-014 | Sandbox Construction Mode without the Sandbox Constructions entitlement | The player places and then moves a building | Construction is not instant and the move requires confirmation; after purchasing the entitlement both become instant | FR-CORE-020, FR-CORE-021 |
| QA-CORE-015 | Two modes with different starting capabilities and top-bar blocks | The player switches between them | The locked features and the visible top-bar blocks change exactly as each mode declares | FR-CORE-013, FR-CORE-022 |
| QA-CORE-016 | The registry | The registry is inspected | It contains the announced RCI, resource-management, casual-tycoon and deep-citizen entries, each marked as not yet selectable | FR-CORE-023, FR-CORE-024, FR-CORE-030 |
| QA-CORE-017 | A city in one mode | The player switches to another mode | The existing city is neither migrated nor destroyed, the registry can be extended without an engine change, and returning to the first mode restores the save | FR-CORE-025, FR-CORE-026, FR-CORE-027 |
| QA-CORE-018 | A mode-selection surface has been implemented as a **one-off** screen (first run, or a menu entry) | The player opens it, chooses a mode and returns to the city | It lists shipped modes plus announced modes marked as coming later, the chosen mode loads, the save reopens on the last mode played, and the build screen itself carries no persistent mode picker | FR-CORE-028 |
| QA-CORE-019 | The mode registry | The registry is inspected | No shipped mobile mode is named "Classic Simulation" or "Tycoon" until the developer confirms those names; "tycoon" appears only as a genre descriptor | FR-CORE-029 |
| QA-CORE-020 | A city at 1,200 residents | The level is read and then the residents rise to 1,400 | No XP bar or skill point exists; the level is derived from residents and never decreases as residents rise | FR-CORE-031, FR-CORE-032, FR-CORE-033 |
| QA-CORE-021 | A catalogue entry with `requiredLevel = 5` and a city at level 4 | The building shop is opened | The entry is locked; at level 5 it is available, and no second gate (such as a stage name) can lock it | FR-CORE-034, FR-CORE-035, FR-CORE-039 |
| QA-CORE-022 | A city at level 6 with a level-5 building unlocked, then the player demolishes buildings and stores one | The inventory and the building shop are inspected | The level recomputes from the new resident count, the level-5 entry re-locks only if the level dropped, and the stored building is still owned | FR-CORE-036, FR-CORE-038 |
| QA-CORE-023 | A region containing two maps with different resident counts | The level is read on each map | The level scope is whatever the data table declares; the build exposes one documented scope and does not silently mix the two | FR-CORE-037 |
| QA-CORE-024 | The catalogue | The building shop is opened | The catalogue lists the shipped library size and the data set carries room for continuous growth | FR-CORE-040, FR-CORE-041 |
| QA-CORE-025 | A city whose food usage is at 82 %, then raised to 95 %, then to 100 % | The resident count is observed over time | Growth is normal below 90 %, reduced between 90 % and 100 %, and zero at 100 %, so no new level and no new unlock is reached | FR-CORE-042, FR-CORE-043 |
| QA-CORE-026 | A mailbox containing a task | The player completes the task | Points are awarded that can be spent, and the City Upgrade track can be bought with coins independently of the level track | FR-CORE-044, FR-CORE-045 |
| QA-CORE-027 | A catalogue with level gates | The catalogue is audited | No entry is gated on a stage name, and the words farm, village, town, city or metropolis appear only in marketing copy or in a clearly labelled cosmetic label | FR-CORE-046 |
| QA-CORE-028 | The shop and the live-ops schedule | The shop is opened and a week boundary is crossed | An add-on stays owned permanently, the Building of the Week is unique and available only for its week, and the monthly cadence delivers new content | FR-CORE-047, FR-CORE-048, FR-CORE-049, FR-CORE-060 |
| QA-CORE-029 | A free account | The player returns over several hours | A free chest is claimable every 4 h and every 24 h, a free gift every 3 h, a premium block every 8 h after four ads, the Piggy Bank fills with Super Cash, and cards can be completed early for premium | FR-CORE-050, FR-CORE-051, FR-CORE-052, FR-CORE-054, FR-CORE-055 |
| QA-CORE-030 | A full inventory containing two copies of a building | The player stores both, opens the shop, then sells another item | The stored items leave the inventory but stay owned and show a blue redeem button in the shop; the sold item is gone for good and pays coins; the storage tab is absent while storage is empty | FR-CORE-056, FR-CORE-057, FR-CORE-058, FR-CORE-059 |
| QA-CORE-031 | A region with several maps | The player zooms out twice and taps another map | Region View shows every map of the region with the active one in blue, tapping another map offers to switch, and confirming reloads onto that city | FR-CORE-061, FR-CORE-062, FR-CORE-063 |
| QA-CORE-032 | Region View | The player waits a few seconds | The map lines fade and a clean region image can be captured for sharing | FR-CORE-064 |
| QA-CORE-033 | A region with a Harbor on map A, a C-Wire on map B and a water pipeline on map C | The economy panels are opened on each map | Food and waste resolve globally for map A, energy for map B and water for map C, and Global bonuses from City Upgrades apply to all maps while map and local bonuses stay scoped | FR-CORE-065, FR-CORE-066 |
| QA-CORE-034 | The wallet model | The wallet scope is inspected | The build states **no scope of its own**, cites the "shared across all maps" source, and defers to `ECO`'s OQ-ECO-16 for the profile-wide versus region-wide decision | FR-CORE-067 |
| QA-CORE-035 | A region with two maps of different population and happiness | The overview tab is opened | Each map shows its own City Score and the region shows their sum as the Mayor Score, top-left and in the government overview | FR-CORE-068, FR-CORE-069 |
| QA-CORE-036 | A city in the Mayoral Match-Up | The High Scores entry is opened and a score is submitted | The entry shows the player's current ranking overview and the submitted payload contains only the region id and the aggregate score; no target maximum is published | FR-CORE-070, FR-CORE-071, FR-CORE-072, FR-CORE-073 |
| QA-CORE-037 | A cosmetic scale label enabled in the design build | The label is displayed and a level is changed | The label changes with the band and unlocks nothing, gates no catalogue entry and changes no score | FR-CORE-074 |
| QA-CORE-038 | The scale-taxonomy data table | The table is inspected | It contains no published thresholds, no entry is required by any other table, and the UI labels it as descriptive framing | FR-CORE-075 |
| QA-CORE-039 | The tuning data for level thresholds, scenario modes and citizen depth | The data set and the mode list are inspected | Level thresholds live only in data, a scenario mode is expressed as a ruleset with a win-condition list and a starting grant, and the deep-citizen mode is opt-in behind a mode flag | FR-CORE-076, FR-CORE-077, FR-CORE-078 |
| QA-CORE-040 | The shipped data files | The game is rebuilt and run | The mode registry, level table, unlock table and live-ops schedule are read from data, and adding an entry needs no recompilation | NFR-CORE-001 |
| QA-CORE-041 | A catalogue of 300+ entries and a mode with progression disabled | A level change and a shop open are performed | The unlock re-evaluation completes without scanning placed buildings, no entry is shown locked in a progression-free mode, and an unset threshold is reported as a TBD in tooling | NFR-CORE-002, NFR-CORE-003, NFR-CORE-004 |
| QA-CORE-042 | A region on a low-spec device | A mode switch and a Region View open are performed | The switch costs one reload and the region renders and remains interactive on low-spec hardware | NFR-CORE-005, NFR-CORE-006, NFR-CORE-007 |
| QA-CORE-043 | A chest window left open before the app was killed | The player relaunches the app | The chest is still claimable and the elapsed chest, gift and free-user periods are reconciled from persisted state | NFR-CORE-008, NFR-CORE-009 |
| QA-CORE-044 | The top bar and the unlock table | The city is opened and a fresh catalogue is authored | The level and the current map's resident count are shown side by side, and an entry with `requiredLevel = 0` is available immediately | NFR-CORE-010, NFR-CORE-011 |
| QA-CORE-045 | The dossier's source ledger | The requirement set is validated | Every cited source identifies the PC title or the mobile title, and any row citing a different game is rejected by the validator | NFR-CORE-012 |

---

## 11. Open questions & TBDs

| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| OQ-CORE-01 | **[TBD]** What are the resident-count thresholds for each level? | The level curve is the only progression gate in the game and no public source publishes a single threshold. | A monotone `level → minResidents` table with a geometric progression (**proposed**, not published: ~1.6× the residents per level), tuned so that the diversity bonus (250 unique buildings) is reachable by a mid-game level. |
| OQ-CORE-02 | **[TBD]** Is the level a per-map value or a region/account-wide value? | The top bar shows the level next to "your residence amount of this current map", which is consistent with both. The answer decides where the unlock table is evaluated. | Treat the level as **region-wide** and derived from the region's total residents, because higher levels unlock buildings that are then available on every map — but keep the scope a single data flag so either choice is a tuning change. |
| OQ-CORE-03 | **[TBD]** Is there a mode picker at session start, and where does it live? | The mode registry needs a UI entry point; no published flow shows one. | If one ships at all, make it a **one-off** selection surface — **first run only** (shipped modes + announced modes marked "coming later"), never a persistent picker over the build screen — with the save reopening on the last mode played. Marked as a design decision, not as observed behaviour. |
| OQ-CORE-04 | **[TBD]** Does the mobile title have shipped modes named "Classic Simulation" and "Tycoon"? | The shared brief listed both; no published source names either as a mobile mode, and the listings use "tycoon" as a genre. | Treat the mobile default city as **one simulation mode** (not two), and reserve "RCI / resource-management / casual tycoon" for the **announced PC modes** until the developer names the mobile modes. |
| OQ-CORE-05 | **[TBD]** Is the shared currency pool profile-wide or region-wide? | The only quote is "all your coins, all your super cash … it's shared across all maps"; `ECO` owns the money model and owns this question (OQ-ECO-16), so `CORE` shall not assert a scope of its own. | **Defer to `ECO` (OQ-ECO-16).** `CORE` refers to "the shared wallet" and marks the scope **[TBD]**; it does not adopt a profile-wide or region-wide reading. |
| OQ-CORE-06 | **[TBD]** Should any scale label ("farm to metropolis") appear in the build at all? | It is marketing copy for map size and library size, with no thresholds and no "town"/"city" rung. | Ship **no** label by default. If a label is wanted, add it as a purely cosmetic band name derived from the level, clearly marked as framing, and never let any other table reference it. |
| OQ-CORE-07 | **[TBD]** Should a puzzle/scenario mode exist, and what are its objectives? | The store listing mentions "creative puzzle-solving", which may imply fixed-goal play that no source documents. | Do not implement a separate mode. If needed later, express it as a ruleset with a `winConditions[]` list and a `startingGrant`, reusing the mode machinery. |
| OQ-CORE-08 | **[TBD]** How deep should the per-citizen simulation go, and at what scale does it stop being affordable? | The dev names scaling as "the hard part" and offers deep-citizen simulation as one idea. | Implement the citizen model as an **optional depth setting** on one mode, with aggregation above a population threshold, so the default mode stays affordable. |
| OQ-CORE-09 | **[TBD]** What are `secondsPerDay` and `daysPerYear` for the game clock? | Day and year quantisation drive loyalty decay, need evaluation and the offline cadence; the demo city reached year 229. | One day ≈ 4 real minutes at 1× speed (**proposed**, not published), tuned so the 4 h / 8 h / 24 h real-time cadences map onto whole in-game days. |

---

## 12. Source list

| # | URL | What it gave us | Retrieved |
|---|---|---|---|
| 1 | https://www.youtube.com/watch?v=jYAD0SkDmY0 | Level = f(residents), no XP, higher levels unlock more buildings; construction slots; add-ons, Building of the Week, Sandbox Constructions, Citycon Building, speed-up package, Piggy Bank, chests 4 h/24 h, free gift 3 h, free-user 8 h/4 ads, 300+ buildings, storage tab, Day Zero / 229 years, top-bar blocks, mailbox, city upgrades, demand vs usage bars | 2026-10-23 |
| 2 | https://www.youtube.com/watch?v=LmY_TpU1B5Y | 90 % / 100 % growth rule; bars vs circles; Mayor Score = Σ City Scores of the region | 2026-10-23 |
| 3 | https://www.youtube.com/watch?v=m5O-A33wQm0 | Cross-map connections (Harbor / C-Wire / water pipeline); "all your coins, all your super cash … shared across all maps" | 2026-10-23 |
| 4 | https://www.youtube.com/watch?v=OUYirEhc9c8 | Global / map / local bonus scopes; City Upgrades are region-wide | 2026-10-23 |
| 5 | https://www.youtube.com/watch?v=_QpxzZFTBtw | City Score = residents + happiness; Mayor Score = Σ City Scores; compete with other mayors; new regions announced; maximum not published | 2026-10-23 |
| 6 | https://www.youtube.com/watch?v=vBJdlAeLn0g | Region View entry and blue active map; one region for now; map switch + reload; tile usage; rename; demolish all map returns buildings to inventory | 2026-10-23 |
| 7 | https://www.youtube.com/watch?v=cSRDwHvowWI | Storage = out of inventory but still owned; warehouse vs sell; redeem from the shop via the blue button | 2026-10-23 |
| 8 | https://www.youtube.com/watch?v=CIb2IWyNPJw | Diversity bonus needs 250 unique building types — unlock breadth is progression pressure | 2026-10-23 |
| 9 | https://www.youtube.com/watch?v=ovWkwWS5FlY | Orthographic ⇄ perspective; perspective is the first-launch default; first-person via zoom-in twice; region view via zoom-out twice | 2026-10-23 |
| 10 | https://www.youtube.com/watch?v=6Jd2kyaEZbM | "voxel based 3D Tycoon city building simulation with a casual touch"; huge maps and regions; add-ons for continuous content growth; premium sandbox | 2026-10-23 |
| 11 | https://store.steampowered.com/app/3474890/SuperCitycon/ | EA Q&A ("Economy and progression systems are not yet included"; "expand the creative sandbox with economic systems, progression and new challenges"); "Early Access begins with a construction sandbox"; "designed to grow with additional game modes, new rule sets"; feature list incl. Continuously Growing Library | 2026-10-23 |
| 12 | https://store.steampowered.com/api/appdetails?appids=3474890 | Developer/publisher Sunapie Games; genres; "Includes level editor"; demo appid 5295650; Q4 2026 | 2026-10-23 |
| 13 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 | The demo announcement, verbatim: "there's no economy in the game yet. You can build and explore, but it isn't a 'real' city builder yet, with systems that feed into each other and goals to work toward." | 2026-10-23 |
| 14 | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 | Citycon Building / City Constructions Inc. — the construction-slot building is an in-world object | 2026-10-23 |
| 15 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ | Dev: classical RCI / resource-management / casual tycoon modes; deep-citizen simulation; scaling is the hard part; "first two simulation modes already in early access" | 2026-10-23 |
| 16 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 | Feature bullets: Sandbox Construction Mode, Region View, Street View, Monthly Add-ons, "Grow from Farm to Metropolis", Mayoral Match-Up | 2026-10-23 |
| 17 | https://itunes.apple.com/lookup?id=1607860732 | App identity, version 2.4.0, updated 2025-12-21 | 2026-10-23 |
| 18 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder | "SANDBOX CONSTRUCTION … no waiting, no timers"; "HUGE MAPS … quiet villages and small towns to sprawling metropolises"; "300+ BUILDINGS: Grow from farm to metropolis"; "MONTHLY UPDATES"; "Compete in the Mayoral Match-Up" | 2026-10-23 |
| 19 | https://supercitycon.net/ | "It is a separate game from SuperCitycon on Steam." | 2026-10-23 |
| 20 | https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ | Third-party corroboration: "you get bonuses and new buildings as you level up"; mail tasks award points | 2026-10-23 |

**Sources deliberately not used.** `playkot.helpshift.com` and `supercitygametips.com` (a different game — Playkot's "SuperCity");
`theend.wiki` (body returns a bot checkpoint); `trophieshunter.com` (page body returns a bot challenge, so the
"100,000 / 1,000,000 Residents" achievement titles are **not** asserted anywhere in this document).
