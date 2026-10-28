# Shared Research Brief — SuperCitycon Requirement Extraction

**Purpose:** ground truth for all 10 requirement bots. Every bot MUST read this file first, then do its own
primary-source research, then write its own requirement document.

**Target of the rebuild:** a browser-based 3D city builder (MiniMax Code / web stack) that replicates
SuperCitycon's systems as faithfully as the public evidence allows.

---

## 1. Game identity — there are TWO products, treat them distinctly

| Product | Publisher / dev | Platforms | Status |
|---|---|---|---|
| **SuperCitycon** (the "Steam / PC" one) | Sunapie Games LLC (© 2026 Sunapie Games LLC) | Windows 10 64-bit+, macOS 12 Monterey+, DirectX 11 | Steam app **3474890**, Early Access **Q4 2026** |
| **Super Citycon™: Build a City** (the original mobile one) | Ben Willes Games SL / BEN WILLES GAMES | iOS 14+, iPad, Android, (Windows) | Live since **May 2022**, App Store id **1607860732**, Google Play `com.benwilles.citybuilder` |

- The official site states plainly: the mobile game "is a separate game from SuperCitycon on Steam."
- The Steam discussion thread "Is this a the same game /port of the iOS app" (Ben, the dev, answering)
  confirms the PC title is not merely a port.
- **Consequence for requirements:** the mobile title is the only product where the *economy, population,
  services and progression* systems are publicly documented and playable today. The PC title's Early Access
  scope is explicitly a **construction sandbox** — "Economy and progression systems are not yet included."
- The user's brief ("every building you see can be rebuilt in") matches the **PC title's SCC Studio voxel
  editor + Steam Workshop** proposition. So the replica must cover BOTH: the PC sandbox/editor feature set
  AND the mobile title's simulation systems (documented as the target behaviour for future PC modes).

## 2. Confirmed facts — PC title (Steam 3474890 / supercitycon.net)

Genre/tags: City Builder, Building, Sandbox, Simulation, Management, Voxel, Strategy, Resource Management,
Economy, Relaxing, Transportation, Isometric, Stylized, 3D, Retro, Character Customization, Level Editor,
Early Access.

Feature list as published:
- **Classic city building, retro 16-bit palette**, modern 3D world.
- **Construction Sandbox**: build every district, refine every detail, explore at own pace. This is what
  Early Access launches with. "This city-building game is designed to grow with additional game modes,
  new rule sets and new ways to experience the cities you create."
- **Map Creation & Terraforming**: shape terrain and water, create terrain sets of your own. Raise hills,
  carve valleys, shape water. Connect districts with **roads, bridges, tunnels and railways**.
- **Flexible Roads & Railways**: different road types, bridges, tunnels.
- **SCC Studio** — built-in **voxel editor**: customize existing buildings, vehicles, terrain sets, citizens
  and props, or start from an empty grid and create something new. "Work at any scale, from the color of a
  wall to the look of an entire landscape." Design your own character, place creations in the city, share
  via **Steam Workshop**.
  - From the dev's Reddit post: everything is voxels; the editor used for each model is integrated into
    gameplay; a unique format allows altering appearance, dimensions, or creating entirely new structures
    on the fly, integrated back into the city; the game **automatically calculates construction costs and
    economic impact** of any building that transitions from the editor into the gameplay environment —
    "needed to function universally while still making logical sense."
  - The game traditionally had a **"Citycon Building"** — the city's construction yard, a fictional company
    "City Constructions Inc." (name origin story: "City Constructions" → "Citycon" because it didn't fit the
    low voxel resolution of the facade; "Super" from the 16-bit/Super Nintendo era and SNES SimCity).
- **Continuously growing library**: new architectural styles, buildings, vehicles, citizens and props.
  Mobile title advertises **300+ buildings** (iOS listing says 180+, later marketing says 300+).
- **Living cities**: traffic moves through streets, pedestrians follow sidewalks, trains travel railways,
  boats navigate waterways. Player controls **time of day and weather**. **First- and third-person modes**;
  create your character and explore the city from within.
- Built-in **video tools** (the Steam trailer says footage was captured with "SuperCitycon's built-in video
  tools").
- Windows min: i5-6600/Ryzen 5 1600, 8 GB RAM, GTX 1050/RX 560 2 GB, DX11, 4 GB storage.
  Rec: i5-10600/Ryzen 5 3600, 16 GB, GTX 1660/RX 5600 XT 6 GB, 10 GB. macOS min 12 Monterey + M1, 8 GB.
- Community: Discord, r/supercitycon, Steam Community forums.

## 3. Confirmed facts — mobile title ("Super Citycon: Build a City")

### 3.1 Modes / structure
- **Sandbox Construction Mode**: build instantly, **no construction timers, no pay-to-skip**.
- **Classic Simulation mode**: zoning, resident dynamics, traffic, economy requiring strategic planning.
- **Tycoon mode**: city management without the stress of financial constraints (per dev's Reddit post).
- **Region View**: connect multiple city maps into one region; multiple towns/villages/landscapes in one empire.
- **Street View**: walk through the city in 3D — parks, busy streets, daily city life up close.
- **Mayoral Match-Up**: global leaderboard ranking competing mayors.
- **Monthly add-ons**: new buildings/content every month.

### 3.2 HUD / top bar (from "The Basics" tutorial)
Top bar contains (tap each for detail): **building demand block** (residential / commercial / industrial
capacity), **usage block** (energy, water, food, waste), **money** (tap to toggle short/unsorted display),
**level**, **resident amount for the current map**, **date** (starts at **Day Zero**, year counter advances).
- Demand bars: **full bar = demand = you need more of that type**. When full, the corresponding capacity
  (residential / commercial workspaces / industrial workspaces) is exhausted.
- Usage bars: keep them **low**. Below 90 % is fine; **from 90 % it reduces city growth; at 100 % the city
  stops growing**. Example given: food production at 82 % usage = fine now, but shortage soon as more
  residents arrive; energy at 56 % fine; water production huge; waste fine.
- Tap a bar block to see exact details for that category.

### 3.3 Government / overview panel
Per-category overview for: **energy supply, water supply, food supply, waste, health care, security, fire,
school system**. Shown as **circles** (coverage) vs the **bars** (usage/demand):
- Bars = usage & demand → want them low (below 90 %).
- Circles = **coverage of your services** → you want them **full**.
- "this block is not fully developed" is possible (service coverage can be incomplete).

### 3.4 Economy & resources
- Currency: **Super Cash** (purchasable; Piggy Bank collects Super Cash over time from your activity and can
  be bought at a heavy discount once filled).
- **Construction costs** per building; in sandbox there are no wait timers but the economy still tracks cost.
- Offline progression: construction times are **measured in minutes** (not hours/days) and progress while
  you are **not in the game**; faster with speed-up.
- Chests: free chests every **4 h / 24 h** giving collectible parts and bonus cards.
- Free gift every **3 hours**; free users get premium options every **8 hours** by watching 4 ads.
- **Add-on** purchases are **permanent unlocks** ("you unlock it once you got it forever… build it as often
  as you want").
- **Building of the Week**: a rotating weekly **unique** building, available only that week, may return much
  later ("not soon").
- **Sandbox Constructions** purchase = zero construction time (instant confirm when moving buildings).
- **Citycon Building** purchase = **another construction slot**.
- **Speed-up package** = removes the ad-based speed-up button; constructions finish faster offline.
- **Storage / Warehouse**: put buildings and bonus cards into storage; redeem them later from the shop.
  The storage tab in the building shop only appears when something is in storage.

### 3.5 Level & progression
- **No XP points.** Level is a direct function of **resident amount** — more residents = higher level.
- Higher levels **unlock more buildings**.
- The game starts at **Day Zero** and the year counter climbs (a demo city was 229 years old).

### 3.6 Resident growth bonuses (official blog "New Bonuses for Residence Growth")
An old hidden scaling mechanic that could boost residence amount by up to **×10** was replaced by **six
new bonuses** that together scale up to **×15**. The six bonuses (each independently calculated **per map**):
1. **Culture points** — buildings provide culture points; **1 point satisfies the need of 1,000 residents**;
   need **1 point per 1,000 residents per category**; fully met = **250 %** bonus for that category.
2. **Entertainment points** — same 1-per-1,000 rule and 250 % cap.
3. **Recreation points** — same 1-per-1,000 rule and 250 % cap.
4. **Wealth bonus** — many buildings carry a **wealth property** shown with **one, two, or three dollar signs**
   (three wealth levels). Only buildings **with a wealth value** contribute. The **average wealth level of all
   such buildings on the map** determines the map's overall wealth level. Wealth level 3 = **250 %** bonus.
5. **Diversity bonus** — every **unique building** on the map gives **1 diversity point = 1 %** bonus,
   up to **250 %** at maximum diversity (so 250 unique building types).
6. **Loyalty points** — **1 point per day logged in**; **missing two consecutive days deducts points**;
   collect up to **250 Loyalty Points = 250 %** bonus (1 point = 1 %).
   > ⚠️ **Contested — do not implement without checking the transcript.** The "Resident Bonuses" tutorial
   > (`https://www.youtube.com/watch?v=CIb2IWyNPJw`) reportedly states **up to two points a day**
   > (morning and evening) and **one point lost per complete day away after 24 hours**. The POP domain
   > owns the final, verified statement; this brief's wording is the earlier reading.

### 3.7 Happiness, City Score, Mayor Score
- **Happiness** is a composite factor "shaped from everything in your city": supply, pollution, everything.
  Not every factor has equal weight. Max happiness when everything is perfect everywhere.
- **City Score** = f(residents, happiness) — more residents at higher happiness = higher score. A city can
  score high via many happy few residents, or many unhappy residents; best is many **and** happy.
- **Mayor Score** = **sum of the City Scores of all cities/maps in your region**; shown top-left and in the
  government overview. Used to compete with other mayors globally.

### 3.8 Food supply chain
- Residents need food. Sources: **fields**, **farm animals**, and food **industry**.
- Fields produce plant-sourced food; **animals consume plant-sourced food and produce animal-sourced food**
  (a two-stage chain). Bonus buildings (e.g. **silos**) give a bonus to food production **within a
  surrounding area**; bonus buildings **do not** affect industrial food production, only fields and the
  animal chain. Staying under 90 % usage avoids negative effects on happiness and Mayor Score.

### 3.9 Connected economies (multi-map)
- You can connect parts of the economy **between maps in a region**.
- Connectable: **food supply, waste management, water, energy supply**.
- **Harbor** on a map automatically connects that map to the **global system** for **food and waste** —
  once connected, it no longer matters which map produces food or handles waste, all maps in the region are
  connected.
- **C-Wire** (power cable) on a map connects that map to the global system for **energy**.
- **Water** supply can be connected between maps (but is not automatic via harbor).
- **Harbor** is therefore also a **trade/logistics** building.

### 3.10 Street building & demolition
- Street Building tool: select a street type, tap the map, and a **visual indicator of every build that
  every direction that's possible** appears; tap a direction and the street appears ("Bop").
- Demolish via the **inventory**: select streets and tap them to remove.
- **Zoom** in/out; zoom out fully enters **Region View**; **Walk Mode** enters first-person exploration;
  exit button returns. Settings include **first-person sensitivity** per device.

### 3.11 Other mobile systems (publicly referenced, details to be confirmed by the relevant bot)
Service categories: **police/security, fire, health care, school, parks/leisure**, plus **waste**.
Building of the Week / bonus cards / storage / add-ons. iCloud sync between iPhone and iPad. In-app
purchases; free-to-play. Monthly content updates.

## 4. Method rules for all bots

> **SUPERSEDED / CORRECTED after the first research round.** A senior review pass proved that two of the
> original evidence bases belonged to **different games**:
> - `youtube.com/watch?v=ZVslYTb-a2M` = **Cities: Skylines 2** (channel *Biffa Plays Indie Games*)
> - `youtube.com/watch?v=0SzCY7BFC8A` = **Cities: Skylines** (channel *UrbanLoon*)
> - `playkot.helpshift.com/hc/en/4-supercity/…` and `supercitygametips.com/…` = **Playkot's "SuperCity"**
>
> The authoritative source identity list is `docs/SOURCE-VERIFICATION.md` (+ `tools/source_ledger.json`).
> **Only cite a source whose verdict there is OFFICIAL, THIRD_PARTY, LEGIT or PLATFORM.** The validator
> hard-fails any row citing a FOREIGN or JUNK source, so this is enforced, not advisory.
>
> Also corrected by that review: the **city-stage ladder (farm → village → small town → town → city →
> metropolis) is NOT a game mechanic.** It came from store-listing marketing copy about *map scale*; no
> stage name other than "village/small town/metropolis" was ever found in the game's own text, and no
> thresholds were published. Any stage taxonomy must be labelled `[TBD — design decision]`,
> Priority `Could`, Stage `Design`. The only progression gate the game actually shows is
> **level derived from resident count**.

1. **Primary sources first**: official site, Steam store page, Steam Community forums + guides + news, the
   official YouTube channel ("Super Citycon - City Building Game" — its How-To tutorials are the single
   richest source; titles follow the pattern `Super Citycon: <Topic> – City Building Game How-To Tutorial`),
   the official blog on supercitycon.net, App Store / Google Play listings, and the dev's Reddit posts
   (r/IndieGaming, r/CozyGamers, r/MagicaVoxel, r/VoxelGameDev).
2. `web_search` surfaces YouTube **transcripts** — use queries of the form
   `Super Citycon <system> tutorial` and read the returned transcript text. `web_fetch` on youtube.com
   hits a consent wall — prefer `web_search` for YouTube. (The YouTube timedtext API is also blocked from
   the CLI; `web_search` is the working route.)
3. **Never invent a number.** If a value (cost, radius, coefficient) is not evidenced, write the
   requirement with an explicit `TBD` marker and add it to Open Questions. Distinguish:
   - `[CONFIRMED]` — stated in a cited source.
   - `[INFERRED]` — strongly implied by cited sources.
   - `[TBD]` — not publicly documented; needs design decision.
4. **Cite per requirement**: put the source URL(s) on the requirement row or immediately beneath it.
5. Distinguish **shipped today** vs **announced/planned for Early Access** vs **mobile-only today**.
6. Requirements IDs must be globally unique: use the prefix `FR-<DOMAIN>-<NNN>` where DOMAIN is your
   short domain code (e.g. `FR-ECO-001`, `FR-BLD-014`). Also use `NFR-<DOMAIN>-<NNN>` for non-functional
   requirements and `QA-<DOMAIN>-<NNN>` for acceptance-criteria suites. Each ID is **defined exactly
   once** (as the first cell of its table row) and the sequence must be contiguous.
7. Every requirement must be **implementable** and **testable**. One requirement = one behaviour.
8. Cover explicitly, for your domain:
   - what exists in the game today,
   - **what can be built** and **what can be rebuilt / edited / customised**,
   - the **options and variants** available (types, tiers, levels, styles, upgrade paths),
   - **stage-by-stage availability** (early / mid / late city, or per progression tier) — a table,
   - the **data** each item carries (fields, properties, modifiers),
   - the **rules/formulas** that drive it, where evidenced,
   - the **failure/edge cases** the game handles,
   - open questions.
9. Length target: **250–700 lines** per document, dense and specific. No filler.
10. Write your file to the exact path assigned to you. Do not create or modify any other file.

### 4a. House vocabulary — exact values only

| Column | Allowed values |
|---|---|
| **Stage** | `Mobile` · `PC-EA` · `Both` · `Design` — nothing else. `Design` means "not a game behaviour; a rebuild decision". |
| **Priority** | `Must` · `Should` · `Could` |
| **Rebuildable** | `yes` · `no` · `partial` — nothing else. `yes` = the player can demolish and re-place / re-author it in-game; `partial` = the player can change some of it but not re-author it; `no` = it is a system rule or a content definition the player does not rebuild. |
| **Evidence marker** | `[CONFIRMED]` · `[INFERRED]` · `[TBD]` · `[TBD — design decision]` |

### 4b. House minimums per domain (enforced by `tools/validate_requirements.py`)

`>= 60` functional requirements, `>= 8` non-functional requirements, `>= 12` acceptance-criteria suites,
every FR/NFR row sourced or explicitly `TBD`, every QA row stating an observable outcome in its `Then`
cell, and zero FOREIGN/JUNK sources.

## 5. Output format contract (same for every bot)

```markdown
# DOMAIN — SuperCitycon Requirements
> Bot: BOT-NN · Domain code: XXX · Status: COMPLETE
> Sources consulted: <count> · Requirements: <FR count> FR / <NFR count> NFR / <QA count> QA

## 0. Scope
- In scope: ...
- Out of scope: ... (name the bot that owns it)

## 1. Observed behaviour (evidence)
### 1.1 Source findings
| # | Finding | Status | Source URL |
### 1.2 Screens/flows observed

## 2. System overview
(ASCII diagram or structured description of the subsystem)

## 3. Functional requirements
### 3.x <sub-area>
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
(Rows must be self-contained; acceptance criteria = QA-<DOMAIN>-NNN reference or inline)

## 4. Options, variants & configuration matrix
(tables: every road type, every building category, every tier, every editor mode…)

## 5. Stage / progression matrix
| Stage | Entry condition | Player can build | Player can rebuild/modify | Unlocks | Exits when |
(per domain; where the domain has no stage dimension, say so and give the dimension used instead)

## 6. Data model
(entity → field → type → range → meaning → source)

## 7. Rules, formulas & tuning
(rules only where evidenced; TBD otherwise)

## 8. Edge cases, failure modes & required behaviours

## 9. Non-functional requirements
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |

> NFR rows use the **same 7-column layout** as FR rows. `Stage` and `Rebuildable?` are mandatory on
> every FR and NFR row; `Rebuildable?` uses the MOB definition — `yes` = the player can demolish and
> re-place / re-author it in-game, `partial` = the player can change some of it but not re-author it,
> `no` = it is a system rule or a content definition the player does not rebuild. `n/a` is not a legal
> value.

## 10. Acceptance-criteria suites
| ID | Given | When | Then | Covers |
(gherkin-style, referencing FR IDs)

## 11. Open questions & TBDs
| # | Question | Why it matters | Proposed default |

## 12. Source list
| # | URL | What it gave us | Retrieved |
```

## 6. The 10 bots and their domains

| Bot | Domain code | Domain | Owns |
|---|---|---|---|
| BOT-01 | `CORE` | Core loop, game modes, city stages, progression & unlocks | modes, sandbox/tycoon/sim, stage model, level/unlock, library growth, add-ons cadence, region, mayoral match-up |
| BOT-02 | `WLD` | World, terraforming, grid, terrain, water, map creation | terrain tools, height, water, terrain sets, map size/creation, tile system, bridges/tunnels terrain interaction |
| BOT-03 | `MOB` | Roads, rails, transit, traffic & logistics | road types, connectivity, traffic, intersections, pedestrian paths, trains, boats, harbor trade, monorail |
| BOT-04 | `ECO` | Economy, budget, costs, taxes, resources & production chains | Super Cash, income/expense, construction costs, taxes/rates, demand & usage model, production/consumption, connected economies |
| BOT-05 | `POP` | Population, citizens, needs, happiness, wealth, diversity, loyalty | citizens & migration, the six growth bonuses, happiness, City/Mayor score, residential levels |
| BOT-06 | `SRV` | City services, coverage & service buildings | police/security, fire, health, school, parks/leisure, waste, coverage model, upgrade tiers |
| BOT-07 | `BLD` | Building catalogue, properties, tiers, upgrades, inventory/shop | 300+ building library, building property schema, level/tier ladders, Building of the Week, bonus cards, storage, demolition |
| BOT-08 | `STD` | SCC Studio voxel editor, modding, Workshop, character creation | voxel editor, auto cost/economy calc, asset types, character creation, workshop publishing |
| BOT-09 | `UX` | UI/UX, HUD, camera, controls, onboarding, accessibility, settings | top bars, panels, maps/region view, street view, camera & zoom, walk mode, tutorial, settings, localisation |
| BOT-10 | `TEC` | Presentation, art direction, audio, simulation tech & platform | 16-bit voxel art, day/night, weather, animation, vehicles/agents, audio, performance, save/load, architecture for the rebuild |

**Cross-domain rules:**
- `ECO` owns the money/cost model. `BLD` owns the building catalogue & property schema and references ECO for cost.
- `POP` owns happiness/scores. `SRV` owns coverage math and feeds `POP` and `ECO`.
- `BLD` owns tier ladders; `CORE` owns the stage model that gates them.
- `STD` owns the editor and must state how it feeds `BLD` (auto-cost, auto-properties) and `WLD` (terrain sets).
- `UX` owns HUD/controls; `TEC` owns rendering/perf/save.
- `MOB` owns traffic & connectivity; `WLD` owns terrain that roads sit on.
