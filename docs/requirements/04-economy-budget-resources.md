# ECONOMY, BUDGET & RESOURCES — SuperCitycon Requirements
> Bot: BOT-04 · Domain code: ECO · Status: COMPLETE
> Sources consulted: 22 distinct URLs · Requirements: 129 FR / 12 NFR / 70 QA · Open questions: 16
>
> **Remediation note (requirement-level audit, 2026-10-23).** This file was re-checked against the verified
> source ledger and the official tutorials re-read directly.
> - **The 90 % growth rule contradicted itself** (FR-ECO-065 vs FR-ECO-067 / QA-ECO-031 / OQ-ECO-10 / F2).
>   The tutorial says *"below 90 % you are fine, starting from 90 % usage it will reduce the growth of your
>   city … once something is 100 % usage your city will not grow anymore"*, so the single rule is now:
>   `g(u) = 1.0` for `u < 90 %`, `0 < g(u) < 1.0` for `90 % ≤ u < 100 %`, `g(100 %) = 0`. The proposed linear
>   `g(u) = (100−u)/10` is **withdrawn** — it would give `g(90 %) = 1.0` and contradict the source.
> - **The wallet scope** is now stated only as far as the source supports ("shared across all maps"); whether
>   that balance is region-wide or profile-wide is **[TBD]** and **OQ-ECO-16 owns that question** — `ECO` owns
>   the wallet model, and `CORE` cross-references it instead of asserting a scope of its own.
> - **Harbor membership** now follows the transcript: *"each map that owns a Harbor is connected to the global
>   system"* — the **Harbor is a per-map membership token, the pool it joins is region-wide**, and a map without
>   a Harbor is **not** a member of the pool and cannot share it (FR-ECO-102). `SRV` now cross-references
>   instead of restating it.
> - **The editor auto-cost rows** (FR-ECO-050…054) were re-pointed from the Steam store page to the **dev's
>   Reddit post**, which is where the behaviour comes from; the **formula is [TBD]** (OQ-ECO-09) and the
>   guessed `cost = a·voxelCount + …` is now a proposed default, not a requirement.
> - **29 rows carried an `OQ-ECO-xx` pointer with no source URL**; each now also carries a ledger source URL.
> - The header's **FR / NFR / QA counts were stale** (they did not match the tables) and have been corrected to the
>   validator's counts; no requirement row was added or removed by this pass.

## 0. Scope
- **In scope:** the two-currency wallet (**coins** earned in-game, **Super Cash** premium), the **Piggy Bank** Super Cash collector, Super Cash purchase options, **chests** and collectible/bonus cards; the **income model** (residential / commercial / industrial income, the **global / map / local** bonus tiers, City Upgrades as income multipliers, the monthly income settlement); **expenditure** (construction cost, the **SCC Studio voxel-editor auto-calculation** of construction cost and economic impact, maintenance and service upkeep); **taxes / rates / budget cycle / financial report**; the **demand bar** model (residential / commercial / industrial capacity); the **usage bar** model (energy / water / food / waste) including the **90 % growth penalty** and **100 % growth stop**; the **economic half of the Government Overview panel** (bars = usage & demand, want LOW; circles = service coverage, want FULL — circles owned by `SRV`); **production & consumption chains** (energy, water, food: fields → plant food → animals → animal food → food industry; waste) including **area/radius bonus buildings**; **connected economies** (Harbor → global food + waste, **C-wire** → global energy, water pipeline → global water, per-map vs. region-wide accounting); **construction time, offline progress, speed-ups, construction slots**.
- **Out of scope (owned elsewhere, referenced not specified):** building catalogue contents and the per-building property schema (**BOT-07 `BLD`** — ECO consumes its `cost`, `incomeBase`, `consumes`, `produces`, `bonusRadius` fields); service **coverage radius math** and the coverage **circles** (**BOT-06 `SRV`**); citizen happiness, the **six residence growth bonuses**, City/Mayor Score (**BOT-05 `POP`** — ECO consumes happiness only as a penalty consequence); traffic and transport economy (**BOT-03 `MOB`**); HUD layout, top-bar chrome, Science View chrome (**BOT-09 `UX`**); terrain, tile grid, map creation (**BOT-02 `WLD`**); **voxel editor mechanics** (**BOT-08 `STD`** — ECO owns only the *cost/economic model* the editor calls); stage/progression/unlock gating (**BOT-01 `CORE`**); rendering, day/night, weather, audio, save-load (**BOT-10 `TEC`**).
- **Boundary rule:** this document owns *money, cost, income, production and the bar model*. Where another domain produces a number ECO consumes (a building's cost, a coverage %, a resident count), ECO states the consumption and the hook, not the producing rule.

## 1. Observed behaviour (evidence)

### 1.1 Source findings
| # | Finding | Status | Source URL |
|---|---|---|---|
| 1 | The top HUD has **two bar blocks**: a **building demand** block and an **economy usage** block. "The Fuller bar is the more you need of it. Once it's completely full you run out." | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| 2 | Demand block = **residential capacity, commercial capacity (workspaces), industrial capacity (workspaces)**. | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| 3 | Usage block = **energy supply, water supply, food supply, waste management**. | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| 4 | Usage bars: "below 90% you are fine. Starting from 90% [usage] it will reduce the growth of your city. Once something is 100% usage your city will not grow anymore." | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| 5 | Worked example: food at **82 %** usage = fine now but shortage soon as residents arrive; energy at **56 %** fine; water production huge; waste fine; residential demand high because "too few residential". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 6 | Government Overview shows the same three things as **circles (coverage, want FULL)** and **bars (usage/demand, want LOW)**; "this block is not fully developed" is possible. | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| 7 | Government has an **Income** tab split into three categories: **residential, commercial, industrial**. | [CONFIRMED] | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| 8 | Income bonuses have **three scopes**: **Global** (all maps in the current region), **Map** (all buildings on the current map), **Local** (emitted by decoration/bonus buildings in an area). | [CONFIRMED] | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| 9 | "Global bonuses are mainly from **City upgrades**… City upgrades are **always region wide**." Map bonuses come from buildings such as the airport. | [CONFIRMED] | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| 10 | Bonus buildings emit a **rectangular tile area**: a business park emits in an area of **11 × 11**, a parking lot in **10 × 9**; food windmills/silos in **13 × 13**. | [CONFIRMED] | https://www.youtube.com/watch?v=OUYirEhc9c8 · https://www.youtube.com/watch?v=6wWZxnm_YLk |
| 11 | "All that sums up to your **monthly income**." | [CONFIRMED] | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| 12 | Two currencies: **coins** (buy City Upgrades early on) and **Super Cash** (some later City Upgrades). Coin **value** and coin **appearance** are themselves City Upgrades. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 13 | The **Piggy Bank** "collects Super Cash over time for your activity"; once filled it can be bought "for very reduced price compared to the normal pricing of Super Cash". Regular Super Cash options sit below it. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 14 | **Chests**: "every 4 hours or every 24 hours you can redeem free chest here that give you **collectible parts** and that give you **bonus cards**". Collectible cards can also be completed early as a premium option. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 15 | **Construction slots**: you start with **one**; each **Citycon Building** you build grants **another permanent construction slot**; slots can also be collected over time or bought in the shop; large buildings need **two or more slots**. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 16 | Construction times are "measured in **minutes** not in hours or days" and "progress when you're not in the game", faster with speed-up. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 17 | Shop add-ons are **permanent unlocks** ("you unlock it once you got it forever"). | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 18 | **Sandbox Constructions** purchase = **zero construction time**; **Citycon Building** purchase = extra construction slot; **Speed-up package** removes the ad speed-up button and makes offline construction faster. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 19 | Money is **shared across all maps**: "all your coins, all your Super Cash — that's also one amount… it's shared across all maps". Whether that shared balance is scoped **region-wide** or **profile-wide** is **[TBD]** — OQ-ECO-16. | [CONFIRMED] (shared across maps) / [TBD] (scope) | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| 20 | **Harbor** on a map automatically joins the **global system** for **food and waste**; once connected, which map produces food or handles waste no longer matters. | [CONFIRMED] | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| 21 | **C-wire** connects a map to the **global energy net**; **water pipeline** connects a map to the **global water net**; a **globe icon** in the economy panel marks a connected map, and the panel then shows **global numbers**. | [CONFIRMED] | https://www.youtube.com/watch?v=m5O-A33wQm0 · https://www.youtube.com/watch?v=y5g7xPHzj0A · https://www.youtube.com/watch?v=yuLUP_ELk4I |
| 22 | Food chain: **fields** → plant-sourced food; **animals consume plant food and produce animal food**; **processed food** consumes both and outputs more. Government food tab splits into **plant source / animal source / processed food**. | [CONFIRMED] | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| 23 | "These bonus buildings **do not have effect on Industrial food production**, they only have effect on your fields and on your animal enclosures." | [CONFIRMED] | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| 24 | Energy producers observed: **wind power (on land)**, **wind power (offshore)**, **PO coal power plant**, **waste incineration**, **solar power**, **nuclear power** (unlocked at city size). Green vs non-green production is shown separately. | [CONFIRMED] | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| 25 | Waste handling: **landfill** (cheap), **recycling station** (more expensive, **upgradeable**), **waste incineration** (removes waste, produces energy, **high pollution**). Waste overview breaks production down by **residential / commercial / industrial / government / farms** plus removal. | [CONFIRMED] | https://www.youtube.com/watch?v=HDjaWySDKOM |
| 26 | Water producers: **water tower**, **small water pump**, **big water pump**; the **water pipeline** is a connector, not a producer. | [CONFIRMED] | https://www.youtube.com/watch?v=yuLUP_ELk4I |
| 27 | Storage: buildings and bonus cards can be moved from the inventory to the **warehouse** (still owned) or **sold** — selling is permanent and yields **some coins**. The storage tab in the shop only appears when storage is non-empty. | [CONFIRMED] | https://www.youtube.com/watch?v=cSRDwHvowWI |
| 28 | The mobile **sandbox mode** still costs resources: "Build instantly without delays. Resources are key, but there's no waiting for construction!" | [CONFIRMED] | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| 29 | The **PC Steam title's Early Access scope is a construction sandbox**; the economy and progression systems are the mobile title's behaviour and are the target for later PC modes. | [CONFIRMED] | https://store.steampowered.com/app/3474890/Super_Citycon/ · https://supercitycon.net/ |
| 30 | No tutorial exposes a player-settable **tax rate**, a **budget cycle** UI, **maintenance/upkeep** charges, or a **bankruptcy** state. | [TBD] → OQ-ECO-01, OQ-ECO-05, OQ-ECO-08 | (absence across https://www.youtube.com/playlist?list=PLw0KMesSQbg8GvG8OXmaMp7gYNlMFEqCx) |
| 31 | The **wealth-level → bonus %** mapping is not published. One observed anchor: wealth level **1.65 → 129 %** bonus; wealth level 3 → full **250 %**. | [TBD] → OQ-ECO-11 | https://www.youtube.com/watch?v=CIb2IWyNPJw |

### 1.2 Screens/flows observed
- **Top HUD**: money (tap to toggle short/long display), level, resident count for the current map, date (starts **Day Zero**), then the **demand block** and the **usage block**; tapping either block opens a detail view with exact numbers and a textual hint ("we need to increase the food production because the usage is at 82%"). — https://www.youtube.com/watch?v=jYAD0SkDmY0
- **Government panel**: tabs *Collectibles · High Scores · Income · City Upgrades · Overview · Mailbox*; Overview sub-tabs *electricity · water · food · waste management · health care · police · fire · education*. — https://www.youtube.com/watch?v=jYAD0SkDmY0
- **Income tab**: three columns (residential / commercial / industrial), each split into **Global bonuses / Map bonuses / Local bonuses**, with a global bonus panel that shows the same global values whichever map you open it from. — https://www.youtube.com/watch?v=OUYirEhc9c8
- **Building inspector**: a block of bonus icons (police protection, fire protection, health care, three school levels) — **greyed out = not covered**, **full colour = bonus active**; a **bars icon** opens the full list of everything granting a bonus to that building (local, map, global); tapping a bonus highlights its **area of effect** on the map. — https://www.youtube.com/watch?v=OUYirEhc9c8
- **Shop**: add-ons, Building of the Week, Sandbox Constructions, Citycon Building, speed-up packages, a free-user block (premium options every 8 h by watching 4 ads; a free gift every 3 h), the **Piggy Bank** with regular Super Cash options beneath, and **chests** (4 h / 24 h). — https://www.youtube.com/watch?v=jYAD0SkDmY0
- **Construction tray** (bottom-left): construction slots + a **speed-up button** that can be watched as an ad for a temporary boost. — https://www.youtube.com/watch?v=jYAD0SkDmY0
- **Region View**: all maps of the region, active map marked in blue; switch maps by zooming into a map and confirming. — https://www.youtube.com/watch?v=vBJdlAeLn0g

## 2. System overview

```
                     WALLET (one balance per currency, shared across all maps — region-vs-profile scope [TBD])
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │  GLOBAL BONUSES  (City Upgrades — always region-wide)                            │
 │  region income multiplier · coin value · coin appearance · production multipliers │
 └──────────────────────────────────────────────────────────────────────────────────┘
        ▲ applies to every building on every map                    │ applies per map
 ┌───────────────────────────┐        ┌───────────────────────────┼──────────────────┐
 │  MAP A                    │◀──────▶│  MAP B                    │◀────────────────▶│
 │  Map bonuses (airport…)   │        │  Map bonuses               │                  │
 │  Local bonus emitters     │        │  Local bonus emitters      │                  │
 │  ┌─────────────────────┐  │        │  ┌─────────────────────┐   │                  │
 │  │ DEMAND (3 bars)     │  │        │  │ DEMAND (3 bars)     │   │                  │
 │  │  residential ▮▮▮▯▯  │  │        │  │  residential ▮▯▯▯▯  │   │  ← FULL = need more│
 │  │  commercial  ▮▯▯▯▯  │  │        │  │  commercial  ▮▮▮▯▯  │   │  ← EMPTY = covered │
 │  │  industrial  ▮▯▯▯▯  │  │        │  │  industrial  ▮▮▮▮▮  │   │                  │
 │  └─────────────────────┘  │        │  └─────────────────────┘   │                  │
 │  ┌─────────────────────┐  │        │  ┌─────────────────────┐   │                  │
 │  │ USAGE (4 bars)      │  │        │  │ USAGE (4 bars)      │   │                  │
 │  │  energy  ▮▮▯▯▯ 56% │  │        │  │  energy  ▮▯▯▯▯     │   │                  │
 │  │  water   ▮▯▯▯▯  5% │  │        │  │  water   ▮▮▯▯▯     │   │  ← <90% fine      │
 │  │  food    ▮▮▮▮▯ 82% │  │        │  │  food    ▮▮▮▯▯     │   │  ← ≥90% growth cut │
 │  │  waste   ▮▯▯▯▯     │  │        │  │  waste   ▮▯▯▯▯     │   │  ← =100% no growth│
 │  └─────────────────────┘  │        │  └─────────────────────┘   │                  │
 │  ┌─────────────────────┐  │        │  ┌─────────────────────┐   │                  │
 │  │ PRODUCTION CHAINS   │  │        │  │ PRODUCTION CHAINS   │   │                  │
 │  │ fields→plant        │  │        │  │ water tower/pump    │   │                  │
 │  │ animals→animal      │  │        │  │ wind/coal/solar/…   │   │                  │
 │  │ food factory→proc.  │  │        │  │ landfill/recycle/   │   │                  │
 │  │ (+silo/windmill 13²) │  │        │  │ incinerator         │   │                  │
 │  └─────────────────────┘  │        │  └─────────────────────┘   │                  │
 │  ▲Harbor   ▲C-wire   ▲Water pipeline  (each joins a GLOBAL pool) │              │
 └──────────────────────────────────────────────────────────────────────────────────┘
   GLOBAL FOOD+WASTE POOL   GLOBAL ENERGY POOL   GLOBAL WATER POOL  (all-region)
```

**Two-way coupling.** *Income → city:* high usage (≥90 %) reduces city growth, 100 % stops it; the consequence is carried into happiness and Mayor Score (`POP`). *City → income:* the population and zone mix of built buildings drives residential/commercial/industrial income, which is then multiplied by global, map and local bonuses and settled **monthly** into the **shared wallet** (scope **[TBD]** — OQ-ECO-16).

## 3. Functional requirements

### 3.1 Currency, wallet & monetization
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-ECO-001 | The economy shall use **two distinct currencies**: **coins** (soft, earned in-game) and **Super Cash** (premium, purchasable). | Must | Mobile | no | QA-ECO-001 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-002 | The wallet shall hold **one balance per currency**, **shared across all maps** — "all your coins … all your Super Cash … that's also one amount … it's shared across all maps in general". Whether that shared balance is scoped to the **region** or to the whole **profile** is **[TBD — design decision]** (OQ-ECO-16); `CORE` owns the profile/region model. | Must | Both | no | QA-ECO-002 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-ECO-003 | The HUD money readout shall be **tappable to toggle a short and a long (unabbreviated) display**. | Should | Mobile | no | QA-ECO-003 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-004 | The **Piggy Bank** shall accumulate **Super Cash over time**, driven by the player's activity. | Must | Mobile | no | QA-ECO-004 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-005 | The Piggy Bank shall offer a **discounted purchase of the accumulated Super Cash** once filled, priced "very reduced" below the normal Super Cash price. | Must | Mobile | no | QA-ECO-005 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-006 | The exact Piggy Bank **discount percentage**, **fill rate** and **fill cap** are not published and shall be authored as tunable constants. | Should | Both | no | QA-ECO-005 | OQ-ECO-02; https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-007 | The shop shall expose **regular Super Cash purchase options** in addition to the Piggy Bank, as a list of tiered bundles. | Must | Mobile | no | QA-ECO-006 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-008 | The exact Super Cash **bundle tiers, prices and bonus multipliers** are not published and shall be authored as data. | Should | Both | no | QA-ECO-006 | OQ-ECO-02; https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-009 | The shop shall expose **free chests redeemable every 4 h** and **every 24 h**, both **free** of charge. | Must | Mobile | no | QA-ECO-007 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-010 | A chest shall grant a mix of **collectible parts** and **bonus cards**. | Must | Mobile | no | QA-ECO-007 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-011 | The exact chest **reward tables, rarity weights and part-to-card conversion rates** are not published and shall be authored as data. | Should | Both | no | QA-ECO-008 | OQ-ECO-03; https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-012 | A **free gift** shall be claimable every **3 hours** at no cost. | Must | Mobile | no | QA-ECO-009 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-013 | A **collectible card** shall be completable **early** as a paid premium option, before its natural timer expires. | Should | Mobile | no | QA-ECO-010 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-014 | A **bonus card** shall be storable in the **storage/warehouse** and redeemable back into the inventory from the shop. | Must | Mobile | no | QA-ECO-011 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-ECO-015 | Shop **add-ons** shall be **permanent unlocks**: once purchased the add-on is owned forever and the associated building may be placed any number of times. | Must | Mobile | no | QA-ECO-012 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-016 | The **storage tab** in the building shop shall be visible **only while storage is non-empty**. | Should | Mobile | no | QA-ECO-011 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-017 | A building or card moved to storage shall remain **owned** but leave the active inventory. | Must | Mobile | no | QA-ECO-011 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-ECO-018 | **Selling** a building from the inventory shall be **irreversible** and shall credit **coins** to the wallet. | Must | Mobile | no | QA-ECO-013 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-ECO-019 | The **sell-back coin value** of a building is not published; it shall be a per-building field (defaulting to 0) owned by `BLD` and paid by ECO. | Should | Both | no | QA-ECO-013 | OQ-ECO-04; https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-ECO-020 | A **Citycon Building** purchase shall grant **one additional construction slot**, permanently. | Must | Mobile | no | QA-ECO-014 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-021 | A **Speed-up package** purchase shall remove the ad-based speed-up button and make constructions complete faster **while the player is offline**. | Must | Mobile | no | QA-ECO-015 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-022 | A **Sandbox Constructions** purchase shall set construction time to **zero** and allow buildings to be **instantly confirmed when moved**. | Must | Mobile | no | QA-ECO-016 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-023 | Free users shall regain access to premium options every **8 hours** by watching **4 ads**, and shall receive a **free gift every 3 hours**. | Should | Mobile | no | QA-ECO-009 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-024 | Watching the support/"support us" ad shall run the game at **double speed for 10 minutes**. | Should | Mobile | no | QA-ECO-017 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.2 Income model
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-ECO-025 | Income shall be accumulated per **residential**, **commercial** and **industrial** sector, and the three sectors shall be reported separately in the Income tab. | Must | Mobile | no | QA-ECO-018 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-026 | Each sector's income shall be the sum of its buildings' base income after applying **Global → Map → Local** bonuses. | Must | Mobile | no | QA-ECO-018 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-027 | A **Global bonus** shall apply to **every building on every map in the current region**. | Must | Mobile | no | QA-ECO-019 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-028 | The **global bonus values shown must be identical whichever map the Income tab is opened from**. | Must | Mobile | no | QA-ECO-019 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-029 | **City Upgrades** shall be the primary source of Global bonuses and shall apply **region-wide**. | Must | Mobile | no | QA-ECO-019 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-030 | A **Map bonus** shall apply to **all buildings on the current map only**. | Must | Mobile | no | QA-ECO-020 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-031 | Map bonuses shall be sourced from buildings such as the **airport**. | Should | Mobile | no | QA-ECO-020 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-032 | A **Local bonus** shall be emitted by a **decoration or bonus building** and shall apply only to buildings **inside that emitter's area**. | Must | Mobile | no | QA-ECO-021 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-033 | A bonus emitter's area shall be **rectangular in tiles** around the emitter, defined per building (observed 10×9, 11×11, 13×13). | Must | Mobile | no | QA-ECO-021 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-034 | Tapping a bonus source shall **highlight its area of effect** on the map. | Should | Mobile | no | QA-ECO-021 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-035 | The building inspector shall expose a **bars icon** listing every source granting a bonus to that building, partitioned into local, map and global groups. | Must | Mobile | no | QA-ECO-022 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-036 | The building inspector shall show a **summary of active bonuses per category** with a greyed-out (absent) vs. full-colour (active) icon state. | Must | Mobile | no | QA-ECO-022 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-037 | The **income categories covered by the bonus icons** shall be police protection, fire protection, health care and **three school levels**. | Should | Mobile | no | QA-ECO-022 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-038 | Sector income shall settle on a **monthly cycle** into the **shared wallet** — one balance shared across all maps. The wallet's region-vs-profile scope is **[TBD]** — OQ-ECO-16. | Must | Mobile | no | QA-ECO-023 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-039 | The **day of month on which income settles**, the **in-game day length**, and whether accrual is continuous-then-paid or paid-lump-sum are not published and shall be authored as tunables. | Should | Both | no | QA-ECO-023 | OQ-ECO-06; https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-040 | **City Upgrades** shall be purchasable with **coins**, and a later tier of upgrades shall be purchasable with **Super Cash**. | Must | Mobile | no | QA-ECO-024 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-041 | The City Upgrade catalogue shall include upgrades affecting **water consumption, water production, energy, trash**, the **value of coins**, and the **appearance of coins**. | Must | Mobile | no | QA-ECO-024 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-042 | A City Upgrade that changes the **coin value** shall multiply coin-denominated income and/or expenditure; which side it applies to is not published. | Should | Both | no | QA-ECO-024 | OQ-ECO-07; https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-043 | A City Upgrade that changes the **appearance of coins** shall be cosmetic only and shall not alter any balance. | Should | Mobile | no | QA-ECO-024 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-044 | The exact **base income per building** is not published; it shall be a per-building field owned by `BLD`. | Must | Both | no | QA-ECO-018 | OQ-ECO-08; https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-045 | The exact **bonus magnitudes** (global, map, local) are not published; each shall be a per-source multiplier. | Must | Both | no | QA-ECO-020 | OQ-ECO-08; https://www.youtube.com/watch?v=OUYirEhc9c8 |

### 3.3 Expenditure, construction cost & the voxel-editor cost model
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-ECO-046 | Placing a building shall **deduct its construction cost** from the **shared wallet's** coin balance at the moment of placement. The wallet's region-vs-profile scope is **[TBD]** — OQ-ECO-16. | Must | Both | no | QA-ECO-025 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-047 | Sandbox mode shall **still charge construction cost** while omitting the construction timer ("Resources are key, but there's no waiting for construction"). | Must | Mobile | no | QA-ECO-025 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| FR-ECO-048 | The construction cost of a building shall be a **per-building data field** consumed from `BLD`; the cost model shall not be hard-coded in UI code. | Must | Both | no | QA-ECO-025 | OQ-ECO-08; https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-049 | The cost of a building whose cost is not authored shall fall back to a documented default (proposed: 0) rather than blocking placement. | Should | Both | no | QA-ECO-025 | OQ-ECO-08; https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-050 | **SCC Studio** shall be able to place a custom voxel model into the gameplay environment and the game shall **automatically compute that model's construction cost and economic impact**. | Must | PC-EA | partial | QA-ECO-026 | https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ |
| FR-ECO-051 | The auto-calculation shall derive a cost from **authorable model inputs** via a **single named formula** shared with hand-authored buildings. The inputs (e.g. voxel volume, bounding-box footprint, material count) and the **formula itself are [TBD — design decision]** (OQ-ECO-09); only the *behaviour* — the game "automatically calculates construction costs" for a custom voxel model — is evidenced. | Must | PC-EA | partial | QA-ECO-026 | https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ |
| FR-ECO-052 | The auto-calculation shall also derive an **economic impact** (income and/or consumption) for the custom model, using the same production/consumption fields as catalogue buildings. Which fields participate, and their weights, are **[TBD — design decision]** (OQ-ECO-09); the dev states the game "automatically calculates … economic impact" but does not publish the derivation. | Must | PC-EA | partial | QA-ECO-026 | https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ |
| FR-ECO-053 | The auto-calculation must produce values that "function universally while still making logical sense" (dev, Reddit). The concrete properties this implies — **scale-monotonicity** (a larger model never costs less) and determinism for identical inputs — are **[TBD — design decision]** (OQ-ECO-09) and shall be asserted by the rebuild's own test suite. | Must | PC-EA | partial | QA-ECO-026 | https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ |
| FR-ECO-054 | The auto-calculated cost shall be **editable by the player before placement** so that the voxel editor cannot create free money or unwinnable economies. This editing affordance is a **[TBD — design decision]** (OQ-ECO-09; proposed default: the player may override the derived cost) — the dev publishes neither the behaviour nor the formula. | Should | PC-EA | partial | QA-ECO-026 | https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ |
| FR-ECO-055 | **Maintenance / recurring upkeep** charges are not evidenced in any tutorial; the rebuild shall support a per-building `upkeep` field but default it to **0** and charge it only if a mode enables it. | Should | Both | no | QA-ECO-027 | OQ-ECO-05; https://www.youtube.com/watch?v=OUYirEhc9c8; https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-ECO-056 | **Demolition shall not refund construction cost** unless a refund rule is authored; no refund behaviour is evidenced. | Should | Both | no | QA-ECO-027 | OQ-ECO-05; https://www.youtube.com/watch?v=OUYirEhc9c8; https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-ECO-057 | When a whole map is wiped ("bulldoze all map at once"), owned buildings shall return to the **inventory** and the player's money balance shall be handled by an authored rule (proposed: unchanged). | Should | Mobile | no | QA-ECO-027 | https://www.youtube.com/watch?v=vBJdlAeLn0g · OQ-ECO-05 |

### 3.4 The demand & usage bar model (core UX)
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-ECO-058 | The HUD shall expose **two separate bar blocks**: a **building-demand block** and an **economy-usage block**. | Must | Mobile | no | QA-ECO-028 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-059 | The demand block shall contain exactly **three bars**: **residential**, **commercial**, **industrial**. | Must | Mobile | no | QA-ECO-028 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-060 | The usage block shall contain exactly **four bars**: **energy**, **water**, **food**, **waste**. | Must | Mobile | no | QA-ECO-028 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-061 | **Demand bar semantics:** a demand bar shows **unmet demand** for that sector. The **fuller the bar, the more of that sector is needed**. A **full** demand bar means the sector's capacity is exhausted and **more buildings of that sector are required**. | Must | Mobile | no | QA-ECO-029 | https://www.youtube.com/watch?v=LmY_TpU1B5Y · https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-062 | An **empty demand bar** means the sector is adequately covered and no action is required; a demand bar can never be negative and is never below 0. | Must | Mobile | no | QA-ECO-029 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-063 | **Usage bar semantics:** a usage bar shows **consumption as a fraction of available supply** for that resource. **Low is good.** | Must | Mobile | no | QA-ECO-030 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-064 | A usage bar below **90 %** shall be considered **fine** — no penalty of any kind. | Must | Mobile | no | QA-ECO-031 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-065 | The growth factor shall be **1.0 (nominal) below 90 % usage**. At **90 % usage or above** the system shall **reduce city growth** (the growth factor is **below 1.0**), and at **100 %** the city shall **stop growing** (factor **0.0**). Source quote: "below 90 % you are fine, starting from 90 % usage it will reduce the growth of your city … once something is 100 % usage your city will not grow anymore". | Must | Mobile | no | QA-ECO-031 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-066 | At **100 %** usage the city shall **stop growing** (growth factor = 0). | Must | Mobile | no | QA-ECO-031 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-067 | The **growth-penalty curve between 90 % and 100 %** is not published; it shall be authored as a single monotonic function shared by all four resources, constrained by `g(u) = 1.0` for `u < 90 %`, `0 < g(u) < 1.0` for `90 % ≤ u < 100 %` and `g(100 %) = 0`. The **shape is [TBD — design decision]** (OQ-ECO-10); a linear form `g(u) = (100−u)/10` is **not admissible**, because it yields `g(90 %) = 1.0` and would contradict the tutorial. | Must | Both | no | QA-ECO-031 | OQ-ECO-10; https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-068 | Being at or above 90 % usage shall additionally carry **negative effects on happiness and on the Mayor Score**. | Must | Mobile | no | QA-ECO-032 | https://www.youtube.com/watch?v=6wWZxnm_YLk · https://www.youtube.com/watch?v=yuLUP_ELk4I |
| FR-ECO-069 | Tapping either bar block shall open a **detail view for that category** showing exact production, consumption and the resulting percentage. | Must | Mobile | no | QA-ECO-033 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-070 | The detail view shall include a **plain-language recommendation** (e.g. "we need to increase the food production because the usage is at 82%"). | Should | Mobile | no | QA-ECO-033 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-071 | The bar model shall be **internally consistent**: the same bar value must be derivable from the underlying production/consumption numbers, never authored twice. | Must | Both | no | QA-ECO-034 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-072 | Demand bars shall be evaluated **per map** (the current map's zone mix), while a map connected to a global pool shall display **global** supply/consumption numbers for the usage bars. | Should | Both | no | QA-ECO-035 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-ECO-073 | The bar fill direction shall be **consistent**: both blocks fill upward as the represented quantity rises, so a full bar always means "more needed / more used" and the player reads them identically. | Must | Mobile | no | QA-ECO-029 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-074 | The bar block shall show the usage percentage as a **number** in addition to the fill, so the 90 %/100 % thresholds are readable without opening the detail view. | Should | Mobile | no | QA-ECO-031 | OQ-ECO-10; https://www.youtube.com/watch?v=LmY_TpU1B5Y |

### 3.5 Government overview panel (economic portion)
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-ECO-075 | The Government Overview shall render **one section per category**: energy supply, water supply, food supply, waste, health care, security, fire, school system. | Must | Mobile | no | QA-ECO-036 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-076 | Each section shall render **bars** (usage and demand) and **circles** (service coverage) side by side. | Must | Mobile | no | QA-ECO-036 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-077 | The **bars** in the panel shall be the **same** usage/demand values shown in the HUD bar blocks, not a separate computation. | Must | Mobile | no | QA-ECO-036 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-078 | **Bars want LOW** (below 90 %); **circles want FULL** — the panel shall communicate this polarity to the player. | Must | Mobile | no | QA-ECO-037 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-079 | The panel shall allow a section to be **not fully developed** (e.g. a partially covered service circle) without being an error state. | Should | Mobile | no | QA-ECO-037 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-ECO-080 | The **coverage circles** themselves are owned by `SRV`; ECO shall expose the **numeric bar values** and the **global-vs-local flag** to the panel and shall not compute coverage. | Must | Both | no | QA-ECO-036 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |

### 3.6 Production & consumption chains
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-ECO-081 | Every building shall carry **consumption** values for the resources it uses and **production** values for the resources it yields. | Must | Mobile | no | QA-ECO-038 | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| FR-ECO-082 | The **energy chain** shall support the producers named in the official *Energy Supply* tutorial: **wind power (on land)**, **wind power (offshore)**, a **coal power plant**, **waste incineration**, **solar power** and **nuclear power**. **Solar power** and **nuclear power** unlock once the city is big enough. | Must | Mobile | no | QA-ECO-038 | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| FR-ECO-083 | The energy overview shall report **production split into green and non-green**; **nuclear counts as non-green** in the shipped game. | Must | Mobile | no | QA-ECO-039 | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| FR-ECO-084 | The **water chain** shall support producers: **water tower**, **small water pump**, **big water pump**. The **water pipeline** shall be a connector only and produce nothing. | Must | Mobile | no | QA-ECO-040 | https://www.youtube.com/watch?v=yuLUP_ELk4I |
| FR-ECO-085 | The water overview shall report **current production** and **current consumption** separately. | Must | Mobile | no | QA-ECO-040 | https://www.youtube.com/watch?v=yuLUP_ELk4I |
| FR-ECO-086 | The **food chain** shall implement three tiers: **plant source** (fields), **animal source** (animal enclosures), **processed food** (food industry). | Must | Mobile | no | QA-ECO-041 | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-ECO-087 | **Animal enclosures shall consume plant-sourced food and produce animal-sourced food**, i.e. a two-stage chain; a city with animals but no fields must starve them. | Must | Mobile | no | QA-ECO-041 | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-ECO-088 | **Animal enclosures and fields shall produce net output** — animals "leverage your food supply so they consume less as they produce" — i.e. the chain is value-adding, not break-even. | Must | Mobile | no | QA-ECO-041 | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-ECO-089 | **Processed food (food industry) shall consume both animal- and plant-sourced food and output more than it consumes.** | Must | Mobile | no | QA-ECO-041 | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-ECO-090 | The food overview shall split into **plant source / animal source / processed food**, showing **production at the bottom**, **consumption at the top right**, and a **resident food quota** showing which food type residents are currently eating. | Must | Mobile | no | QA-ECO-042 | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-ECO-091 | The overall food usage bar shall be computed from the **aggregate** of the three food tiers and shall be held **below 90 %** to avoid penalties. | Must | Mobile | no | QA-ECO-042 | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-ECO-092 | **Area bonus buildings** (food: **silos**, **windmills**) shall boost production of **fields** and **animal enclosures** within their area rectangle, and shall **not** affect **industrial food production**. | Must | Mobile | no | QA-ECO-043 | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-ECO-093 | The **waste chain** shall support **landfill** (cheap), **recycling station** (upgradeable) and **waste incineration** as removal buildings. | Must | Mobile | no | QA-ECO-044 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-ECO-094 | **Waste incineration shall simultaneously remove waste, produce energy, and add pollution** — a deliberate trade-off the player positions in industrial areas. | Must | Mobile | no | QA-ECO-044 | https://www.youtube.com/watch?v=y5g7xPHzj0A · https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-ECO-095 | The waste overview shall break production down by **residential, commercial, industrial, government and farms**, and shall show **removal** alongside it. | Must | Mobile | no | QA-ECO-044 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-ECO-096 | A **recycling station** shall support **upgrade tiers** that increase its removal capacity and/or efficiency. | Must | Mobile | no | QA-ECO-045 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-ECO-097 | The exact **per-building production/consumption magnitudes**, **conversion ratios** (e.g. plant → animal) and **bonus strength** of area emitters are not published; each shall be an authored tunable. | Must | Both | no | QA-ECO-038 | OQ-ECO-08; https://www.youtube.com/watch?v=6wWZxnm_YLk; https://www.youtube.com/watch?v=y5g7xPHzj0A |
| FR-ECO-098 | The **pole barn** shall gate **fields** and **animal enclosures**: they only operate when inside a pole barn's area. | Must | Mobile | no | QA-ECO-046 | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-ECO-099 | **Waste capacity** semantics in the overview (the tutorial shows "177% in use" while stating the city is fine) are ambiguous; the rebuild shall define one explicit reading (proposed: the bar shows **removal capacity utilisation**, so a full bar means waste is fully handled). | Should | Both | no | QA-ECO-044 | OQ-ECO-12; https://www.youtube.com/watch?v=HDjaWySDKOM |

### 3.7 Connected economies (per-map vs region-wide)
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-ECO-100 | The four connectable systems shall be **food supply, waste management, water supply and energy supply**. | Must | Mobile | no | QA-ECO-047 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-ECO-101 | A **Harbor** on a map shall automatically connect that map to the **global food and waste system**. | Must | Mobile | no | QA-ECO-047 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-ECO-102 | **The Harbor is a per-map membership token; the pool it joins is region-wide.** A Harbor is a **per-map object**: building one on a map makes **that map** a **member** of the **region-wide** food-and-waste pool — source quote: "each map that owns a Harbor is connected to the global system". A map **without** a Harbor is **not** a member, cannot share the pool and keeps its own local figures. Once a map is a member, "it does not matter anymore if the food production or the waste management is on this current map or on any other of your maps within your region — it's all connected". **This row owns the membership and pool rules; `SRV`, `CORE` and `MOB` reference them and shall not restate them.** | Must | Mobile | no | QA-ECO-048, QA-ECO-070 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-ECO-103 | An **energy C-wire** on a map shall connect that map to the **global energy net**. | Must | Mobile | no | QA-ECO-049 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-ECO-104 | For energy, **every map holding a C-wire** shall be joined to the same global net, so production can sit on one map and consumption on another. | Must | Mobile | no | QA-ECO-049 | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| FR-ECO-105 | A **water pipeline** on a map shall connect that map to the **global water net**; water connection is **not** granted by the Harbor. | Must | Mobile | no | QA-ECO-050 | https://www.youtube.com/watch?v=m5O-A33wQm0 · https://www.youtube.com/watch?v=yuLUP_ELk4I |
| FR-ECO-106 | The economy panel shall display a **globe icon** on a category when the current map is part of that category's global net. | Must | Mobile | no | QA-ECO-051 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-ECO-107 | When a category is globally connected, the panel shall show the **global** production/consumption values rather than the local map's. | Must | Mobile | no | QA-ECO-051 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-ECO-108 | A **local (unconnected)** map shall show only its own map's numbers for that category and shall have **no globe icon** for it. | Must | Mobile | no | QA-ECO-052 | https://www.youtube.com/watch?v=yuLUP_ELk4I |
| FR-ECO-109 | Adding or removing a Harbor, C-wire or water pipeline shall **re-scope the affected pool immediately**, re-aggregating connected maps and updating the bars without a restart. | Must | Both | no | QA-ECO-048 | OQ-ECO-13; https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-ECO-110 | The **money wallet is one shared balance across all maps** and shall not be affected by which systems are connected. Its region-vs-profile scope is **[TBD]** and is owned by `ECO` — OQ-ECO-16; no other document shall assert a scope for it. | Must | Mobile | no | QA-ECO-002 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-ECO-111 | **Global income bonuses are already region-wide** and are distinct from the *connected economies* pools, which carry only physical resources. | Must | Mobile | no | QA-ECO-028 | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-112 | A **Harbor** shall also act as the trade/logistics building for the region (`MOB` owns its physical trade behaviour; ECO owns its pool-membership effect). | Should | Mobile | partial | QA-ECO-047 | https://www.youtube.com/watch?v=m5O-A33wQm0 |

### 3.8 Construction time, speed-ups & construction slots
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-ECO-113 | Construction shall use a **timer measured in minutes**, with a documented maximum (proposed: ≤ 60 min for the largest building) so it never approaches hours or days. | Must | Mobile | no | QA-ECO-053 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-114 | Construction shall **progress while the player is offline**, using wall-clock time, and shall resume at the correct remaining time on load. | Must | Mobile | no | QA-ECO-054 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-115 | Offline progress shall be **faster** when a speed-up is active or a speed-up package is owned. | Must | Mobile | no | QA-ECO-054 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-116 | A **speed-up button** shall be available in the construction tray and shall apply a temporary boost when invoked (via ad for free users). | Must | Mobile | no | QA-ECO-055 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-117 | Purchasing the speed-up package shall **remove the speed-up button** permanently. | Must | Mobile | no | QA-ECO-055 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-118 | The player shall start with **one construction slot**; each owned **Citycon Building** shall grant **one additional permanent slot**. | Must | Mobile | no | QA-ECO-056 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-119 | Additional construction slots shall also be obtainable **over time** (collect) and **from the shop** (purchase), in addition to Citycon Buildings. | Should | Mobile | no | QA-ECO-056 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-120 | A large building requiring **two or more construction slots** shall occupy that many slots concurrently for its whole build duration. | Must | Mobile | no | QA-ECO-057 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-121 | A building shall only be placed when **enough free construction slots** exist; the UI shall state how many are required. | Must | Mobile | no | QA-ECO-057 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-ECO-122 | The **exact construction time per building** and the **slot cost** per building are not published and shall be authored as per-building fields. | Must | Both | no | QA-ECO-053 | OQ-ECO-08; https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.9 Taxes, budget cycle & financial reporting
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-ECO-123 | The system shall expose a **tax rate per zone type** as a configurable model field, even though the shipped mobile game shows no player-facing rate control; default rates shall be authored per zone type. | Should | Both | no | QA-ECO-058 | OQ-ECO-01; https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-124 | The tax rate, if present, shall multiply the **base income of each building** before global/map/local bonuses are applied, and shall be shown in the Income tab per sector. | Should | Both | no | QA-ECO-058 | OQ-ECO-01; https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-125 | The rebuild shall provide a **budget cycle**: income settles monthly (FR-ECO-038) and expenditure is charged at the moment of commitment (FR-ECO-046), producing a **period ledger**. | Must | Both | no | QA-ECO-023 | OQ-ECO-06; https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-126 | The rebuild shall provide a **periodic financial report** listing, per sector, income, bonuses applied, construction expenditure and the net change for the period. | Should | Both | no | QA-ECO-059 | OQ-ECO-14; https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-127 | A **negative balance** shall not hard-block gameplay by default; the behaviour (warning, build lockout, or bankruptcy) is not evidenced and shall be authored (proposed: a soft warning only). | Should | Both | no | QA-ECO-060 | OQ-ECO-08; https://www.youtube.com/watch?v=OUYirEhc9c8 |
| FR-ECO-128 | The **tycoon mode** ("city management without the stress of financial constraints") shall disable the negative-balance consequence while leaving the economy running. | Must | Both | no | QA-ECO-060 | OQ-ECO-08; https://steamcommunity.com/app/3474890/guides/ |
| FR-ECO-129 | The **sandbox mode** shall keep cost accounting visible (cost is still charged) while imposing no timer and no financial-stress consequence. | Must | Both | no | QA-ECO-025 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |

## 4. Options, variants & configuration matrix

### 4.1 Currency & monetisation options
| Option | Variants evidenced | Economic effect | Source |
|---|---|---|---|
| Coins | soft, earned in-game | pays City Upgrades and construction | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Super Cash | premium, purchasable; **regular bundles** + **Piggy Bank** | pays premium City Upgrades, premium options, early card completion | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Piggy Bank | accumulates Super Cash over time from activity; discounted purchase when filled | cheaper Super Cash | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Chests | **free chest every 4 h**, **free chest every 24 h** | collectible parts + bonus cards | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Free gift | every **3 h** | unspecified reward | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Free-user premium | every **8 h** via **4 ads** | access to premium options | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Add-on | permanent unlock | permanent availability of a building | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Building of the Week | rotating weekly, unique, gone after the week | content availability | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Sandbox Constructions | one-off purchase | zero construction time | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Citycon Building | one-off purchase (or built in-world) | +1 construction slot | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Speed-up package | one-off purchase | removes ad button; faster offline builds | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Support ad | watch | **double speed for 10 minutes** | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 4.2 Income modifiers matrix
| Scope | Applies to | Sources | Observed magnitude | Source |
|---|---|---|---|---|
| **Global** | every building, every map in the region | City Upgrades (coin value, production/consumption upgrades, city-wide upgrades) | not published | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| **Map** | every building on the current map | map-specific buildings (e.g. **airport**) | not published | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| **Local** | buildings inside an emitter's rectangle | decoration & bonus buildings | **10×9**, **11×11**, **13×13** tile areas | https://www.youtube.com/watch?v=OUYirEhc9c8 · https://www.youtube.com/watch?v=6wWZxnm_YLk |

### 4.3 Resource & chain matrix
| Resource | Producers evidenced | Consumers | Connector | Global pool trigger | Source |
|---|---|---|---|---|---|
| Energy | wind power (on land), wind power (offshore), PO coal power plant, waste incineration, solar power, nuclear power | all buildings and people | **C-wire** | C-wire on ≥1 map | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| Water | water tower, small water pump, big water pump | residents, industry, commerce | **water pipeline** | pipeline on ≥1 map | https://www.youtube.com/watch?v=yuLUP_ELk4I |
| Food (plant) | **fields** (boosted by silos/windmills, gated by pole barns) | animals, food industry | **Harbor** | Harbor on ≥1 map (only maps that **own** a Harbor are connected — FR-ECO-102) | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| Food (animal) | **animal enclosures** (consume plant food; boosted by silos/windmills; gated by pole barns) | food industry | **Harbor** | Harbor on ≥1 map (only maps that **own** a Harbor are connected — FR-ECO-102) | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| Food (processed) | **food industry** (consumes plant + animal, outputs more) | residents (quota) | **Harbor** | Harbor on ≥1 map (only maps that **own** a Harbor are connected — FR-ECO-102) | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| Waste | (produced by residential, commercial, industrial, government, farms) | landfill, recycling station, waste incineration | **Harbor** | Harbor on ≥1 map (only maps that **own** a Harbor are connected — FR-ECO-102) | https://www.youtube.com/watch?v=HDjaWySDKOM |

### 4.4 Bar semantics matrix (the contract)
| Block | Bar | Direction | Full bar means | Empty bar means | Threshold | Source |
|---|---|---|---|---|---|---|
| Demand | residential | up = more needed | need more residential buildings | residential demand met | — | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Demand | commercial | up = more needed | need more commercial/workspace buildings | commercial demand met | — | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Demand | industrial | up = more needed | need more industrial/workspace buildings | industrial demand met | — | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Usage | energy | up = more used | 100 % → **city stops growing** | idle supply | 90 % → growth reduced | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| Usage | water | up = more used | 100 % → **city stops growing** | idle supply | 90 % → growth reduced | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| Usage | food | up = more used | 100 % → **city stops growing** | idle supply | 90 % → growth reduced | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| Usage | waste | up = more used | 100 % → **city stops growing** | idle capacity | 90 % → growth reduced | https://www.youtube.com/watch?v=HDjaWySDKOM |
| Coverage | energy/water/food/waste/health/security/fire/school | up = more covered | fully covered | no coverage | — | https://www.youtube.com/watch?v=LmY_TpU1B5Y |

## 5. Stage / progression matrix
ECO has **no independent stage ladder** — economic pressure is gated by the *core* stage model (`CORE`), by *building unlocks* (`BLD`) and by *region size* (`CORE`). The dimension used here is **when economic pressure first appears**.

| Stage | Entry condition | Player can build (economically) | Player can rebuild/modify | Unlocks | Exits when |
|---|---|---|---|---|---|
| **E0 — Sandbox / free build** | sandbox mode (mobile) or Steam Early Access construction sandbox | anything affordable; **costs charged, no timers** | full edit, move, rotate, demolish | all add-ons; zero-construction-time purchase | never leaves (parallel mode) |
| **E1 — First city (classic sim, small)** | first map; ~Day Zero; 1 construction slot | fields, basic housing, first energy/water producers; pay in coins | edit/move; sell from inventory | Piggy Bank, chests, first City Upgrades (coin-only), storage tab on use | demand bars fill (residential/commercial/industrial) → build more zone capacity |
| **E2 — Supply balance** | first full supply chains in place | farms + animal enclosures + food factory; pole barns; silos/windmills; landfill | upgrade recycling station | C-wire, water pipeline, Harbor (→ global pools), speed-up package, Citycon Building (slots) | any usage bar reaches **90 %** → growth reduction begins |
| **E3 — Region / multi-map** | second map in the region | production on one map + consumption on another | per-map layout changes; region-wide upgrades apply to all | **Global bonuses** (City Upgrades, region-wide), monthly income settlement visible per sector | a usage bar reaches **100 %** → **city stops growing** |
| **E4 — Mature / optimisation** | large city (nuclear & solar unlocked) | high-tier producers, incinerator trade-offs, area-bonus emitters | refining bonus layout for max local income | super-cash City Upgrades, free gifts every 3 h, premium speed-ups | — (terminal) |

**Financial-pressure gate (the domain's own "stage" signal):** the game escalates from *no pressure* (E0–E1, income covers costs) → *growth drag* (E2–E3, any usage bar ≥ 90 %) → *growth stop* (E3+, any usage bar = 100 %) → *budget stress* (proposed, unevidenced: coin balance trending negative).

## 6. Data model

| Entity | Field | Type | Range / values | Meaning | Source |
|---|---|---|---|---|---|
| **SharedWallet** | `coins` | int64 | ≥ 0 | Soft currency — **one balance shared across all maps**; wallet scope (region-wide vs profile-wide) **[TBD]** — OQ-ECO-16 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| | `superCash` | int64 | ≥ 0 | Premium currency — same shared-balance model as `coins`; scope **[TBD]** — OQ-ECO-16 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| | `displayMode` | enum | `short` \| `full` | HUD money format | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| **PiggyBank** | `amount` | int64 | ≥ 0 | Super Cash accumulated | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| | `fillRate` | float | TBD | Super Cash per unit of activity | OQ-ECO-02 |
| | `discountPct` | float | TBD | Discount vs. normal price | OQ-ECO-02 |
| **LedgerEntry** | `id` | uuid | — | unique | derived |
| | `timestamp` | datetime | — | when booked | derived |
| | `mapId` | uuid | — | map the entry is attributed to (`null` = region-wide) | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| | `sector` | enum | `residential` \| `commercial` \| `industrial` \| `none` | income sector | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| | `kind` | enum | `income_base` \| `bonus_global` \| `bonus_map` \| `bonus_local` \| `expenditure_construction` \| `expenditure_upkeep` \| `expenditure_upgrade` \| `refund` | entry class | derived |
| | `currency` | enum | `coins` \| `superCash` | which balance | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| | `amount` | int64 | signed | + income, − expenditure | derived |
| | `sourceId` | uuid | nullable | building/upgrade that caused it | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| **Budget** | `periodStart` / `periodEnd` | datetime | — | monthly settlement window | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| | `incomeBySector` | map<enum,int64> | ≥ 0 | per-sector accrual | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| | `expenditure` | int64 | ≥ 0 | costs committed in period | derived |
| | `net` | int64 | signed | income − expenditure | derived |
| **TaxRate** | `sector` | enum | 3 values | one rate per zone type | OQ-ECO-01 |
| | `rate` | float | 0.0–2.0 (TBD) | multiplier on base income | OQ-ECO-01 |
| **BuildingEconomy** (consumed from `BLD`) | `cost` | int64 | ≥ 0 | construction cost in coins | OQ-ECO-08 |
| | `constructionMinutes` | int64 | ≥ 0 (minutes) | build duration | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| | `constructionSlots` | int64 | ≥ 1 | slots occupied | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| | `incomeBase` | int64 | ≥ 0 | pre-bonus income | OQ-ECO-08 |
| | `produces` | map<resource,float> | ≥ 0 | per-tick output (energy, water, plantFood, animalFood, processedFood) | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| | `consumes` | map<resource,float> | ≥ 0 | per-tick input | https://www.youtube.com/watch?v=yuLUP_ELk4I |
| | `isGreenEnergy` | bool | — | green vs non-green classification | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| | `upgradeable` | bool | — | recycling station tiers | https://www.youtube.com/watch?v=HDjaWySDKOM |
| **BonusEmitter** | `ownerId` | uuid | — | emitting building | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| | `areaW` / `areaH` | int | tiles (e.g. 11×11, 10×9, 13×13) | rectangle in tiles | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| | `appliesTo` | enum[] | `fields` \| `animalEnclosures` \| `allBuildings` \| … | which targets the bonus hits (food bonuses exclude industry) | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| | `scope` | enum | `global` \| `map` \| `local` | where it applies | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| | `magnitude` | float | TBD | bonus strength | OQ-ECO-08 |
| **SupplyChainNode** | `resource` | enum | `energy` \| `water` \| `plantFood` \| `animalFood` \| `processedFood` \| `waste` | node type | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| | `inputs` | map<resource,float> | — | consumed per output | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| | `output` | float | > 0 | produced per tick | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| **ResourcePool** | `scope` | enum | `map` \| `global` | accounting scope of a pool | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| | `memberMapIds` | uuid[] | — | maps in a global pool | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| | `triggerBuilding` | enum | `harbor` \| `cwire` \| `waterPipeline` | what creates the global pool | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| | `production` / `consumption` | float | ≥ 0 | aggregated | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| | `usagePct` | float | 0–∞ | consumption ÷ production | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| **DemandBar** | `sector` | enum | 3 values | residential/commercial/industrial | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| | `demand` | float | ≥ 0 | unsatisfied demand | derived |
| | `capacity` | float | ≥ 0 | supplied capacity | derived |
| | `fillPct` | float | 0–1 | demand ÷ capacity | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| **UsageBar** | `resource` | enum | 4 values | energy/water/food/waste | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| | `production` / `consumption` | float | ≥ 0 | from the active pool | derived |
| | `usagePct` | float | 0–∞ | consumption ÷ production | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| | `growthFactor` | float | 0.0–1.0 | 1.0 below 90 %, 0 at 100 % | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| **ConstructionSlot** | `index` | int | — | slot identity | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| | `occupiedBy` | uuid | nullable | building under construction | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| | `startedAt` / `durationMinutes` | datetime / int | — | offline-safe progress | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| **VoxelCostModel** (STD-facing) | `voxelCount` | int | ≥ 0 | input volume | OQ-ECO-09 |
| | `footprintTiles` | float | ≥ 0 | bounding-box area | OQ-ECO-09 |
| | `materialCount` | int | ≥ 0 | distinct materials | OQ-ECO-09 |
| | `computedCost` | int64 | ≥ 0 | derived construction cost | OQ-ECO-09 |

## 7. Rules, formulas & tuning

**F1 — Usage ratio (all four usage bars).** `[CONFIRMED]`
```
usagePct(resource) = consumption(resource) ÷ production(resource) × 100
```
Consumption and production are aggregated over the **active pool**: the map's own buildings if the map is not connected, otherwise every map in the global pool.
Source: https://www.youtube.com/watch?v=LmY_TpU1B5Y · https://www.youtube.com/watch?v=m5O-A33wQm0

**F2 — Growth penalty.** `[CONFIRMED thresholds / TBD curve]`
```
usagePct < 90          → growthFactor = 1.0        (no effect)
90 ≤ usagePct < 100    → growthFactor < 1.0        (city growth reduced)
usagePct ≥ 100         → growthFactor = 0.0        (city stops growing)
```
The curve between the thresholds is **not published**. **Design decision required:** adopt a single monotonic function `g(u)` shared by all four resources, constrained by `g(u) = 1.0` for `u < 90 %`, `0 < g(u) < 1.0` for `90 % ≤ u < 100 %` and `g(100 %) = 0`; the **shape itself is [TBD — design decision]** (OQ-ECO-10). A linear `g(u) = (100−u)/10` is **excluded** — it would give `g(90 %) = 1.0`, contradicting the tutorial's "starting from 90 % usage it will reduce the growth of your city". Do **not** let each resource define its own curve — the game presents the four bars as one mechanic.
Source: https://www.youtube.com/watch?v=LmY_TpU1B5Y · https://www.youtube.com/watch?v=6wWZxnm_YLk · https://www.youtube.com/watch?v=HDjaWySDKOM

**F3 — Demand ratio.** `[INFERRED]`
```
demandFill(sector) = unmetDemand(sector) ÷ capacity(sector)      (clamped 0..1)
fill = 1.0  → the sector's capacity is exhausted → build more of that sector
fill = 0.0  → the sector is covered → nothing to do
```
The exact numerator/denominator split is not published — only the observable polarity (fuller = more needed) and the worked example (well covered in commercial & industrial, too few residential → residential bar high). **Design decision required:** fix one definition and derive the bar only from it.
Source: https://www.youtube.com/watch?v=jYAD0SkDmY0 · https://www.youtube.com/watch?v=LmY_TpU1B5Y

**F4 — Income per sector.** `[INFERRED from structure; magnitudes TBD]`
```
sectorIncome(sector, map) = Σ over buildings of sector on map
                                [ baseIncome(building)
                                × taxRate(sector)
                                × (1 + globalBonus)
                                × (1 + mapBonus(map))
                                × (1 + Σ localBonuses covering building) ]
```
Global bonuses come from **City Upgrades** and apply to every map in the region; map bonuses come from map-specific buildings (e.g. the airport); local bonuses come from **decoration/bonus buildings** whose rectangular area must contain the target building. Exact multipliers are not published.
Source: https://www.youtube.com/watch?v=OUYirEhc9c8

**F5 — Area bonus application.** `[CONFIRMED mechanism / TBD magnitude]`
```
covered(b, emitter) = |tileX(b) − tileX(emitter)| ≤ emitter.areaW ÷ 2
                   AND |tileY(b) − tileY(emitter)| ≤ emitter.areaH ÷ 2
bonus applies only if covered AND emitter.appliesTo contains b's category
```
Observed rectangles: business park **11×11**, parking lot **10×9**, food silos/windmills **13×13**. **Food-area bonuses must exclude industrial food production** — they hit fields and animal enclosures only.
Source: https://www.youtube.com/watch?v=OUYirEhc9c8 · https://www.youtube.com/watch?v=6wWZxnm_YLk

**F6 — Food chain conversion.** `[CONFIRMED structure / TBD ratios]`
```
fields            → plantFood
animalEnclosures  : consumes plantFood, produces animalFood   (net-adding)
foodIndustry      : consumes plantFood + animalFood, produces processedFood (net-adding)
residents consume a per-type food quota (which type is currently eaten is shown)
foodUsagePct = totalConsumption(plant+animal+processed) ÷ totalProduction × 100
```
Source: https://www.youtube.com/watch?v=6wWZxnm_YLk

**F7 — Waste chain.** `[CONFIRMED structure]`
```
wasteProduced = Σ (residential + commercial + industrial + government + farms)
wasteRemoved  = Σ (landfill + recyclingStation[tier] + wasteIncinerator)
wasteIncinerator also produces energy AND adds pollution
```
Source: https://www.youtube.com/watch?v=HDjaWySDKOM · https://www.youtube.com/watch?v=y5g7xPHzj0A

**F8 — Connected pool membership.** `[CONFIRMED]`
```
globalFoodWastePool  = { maps containing a Harbor }     # membership token is PER MAP; the pool itself is REGION-WIDE
globalEnergyPool     = { maps containing an energy C-wire }
globalWaterPool      = { maps containing a water pipeline }
if pool is non-empty: production/consumption aggregate over all member maps; globe icon shown
else:                 the map's own numbers; no globe icon
```
A map is a **member** of a pool only if it owns the corresponding building; a map without a
Harbor is not a member of the food-and-waste pool, cannot share it and keeps local figures.
The pool spans the region, so two member maps aggregate together (FR-ECO-102).
Money is **one balance shared across all maps** and global *income bonuses* are region-wide
**regardless** of these pools; the wallet's region-vs-profile scope is **[TBD]** — OQ-ECO-16.
Source: https://www.youtube.com/watch?v=m5O-A33wQm0 · https://www.youtube.com/watch?v=yuLUP_ELk4I · https://www.youtube.com/watch?v=y5g7xPHzj0A

**F9 — Construction progress.** `[CONFIRMED structure]`
```
remaining(t) = durationMinutes × 60 − (wallClockNow − startedAt) × speedFactor
speedFactor = 1 (normal) | >1 (speed-up active or speed-up package owned)
on load: recompute from wall-clock — constructions progress while offline
```
Durations are in **minutes**. Slot occupancy is released only at `remaining ≤ 0`.
Source: https://www.youtube.com/watch?v=jYAD0SkDmY0

**F10 — Voxel-editor auto cost & economic impact.** `[CONFIRMED behaviour / TBD formula]`
The dev states that the PC title "**automatically calculates construction costs and economic impact** of any building that transitions from the editor into the gameplay environment", and that the value must "function universally while still making logical sense". **The formula is [TBD — design decision] (OQ-ECO-09):** ECO must publish one named cost function and one economic-impact function that both the catalogue and the editor use, but the **inputs, the shape and the coefficients are unpublished** and shall not be asserted as requirements. The editor output is proposed to be player-overridable (FR-ECO-054). A candidate form (`cost = a·voxelCount + b·footprintTiles + c·materialCount`, `a,b,c ≥ 0`, monotonicity asserted in tests) is a **proposed default only**, and the whole draft is withdrawn if a better-authored one is chosen.
Source: https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ · OQ-ECO-09

**F11 — Tax rate.** `[TBD — no player-facing rate evidenced]`
No tutorial shows a tax slider or per-zone rate. **Design decision required:** either (a) ship no player-facing rate and fold the rate into `incomeBase` (simplest, most faithful to the evidence), or (b) ship a hidden per-sector rate defaulting to **1.0** so the model is extensible. Proposed default: (b) with `residential = commercial = industrial = 1.0`.
Source: OQ-ECO-01

**F12 — Wealth level → bonus %.** `[TBD — owned by `POP`]`
Observed: wealth level **1.65 → 129 %**; wealth level **3 → 250 %**. The mapping is not published. **The curve is owned by `POP`** (FR-POP-059, OQ-POP-05), which publishes it once and states its anchor as [TBD]; ECO does **not** restate or re-derive it here and no competing default is proposed in this document. ECO consumes the resulting bonus percentage only as a growth input.
Source: https://www.youtube.com/watch?v=CIb2IWyNPJw · OQ-ECO-11 → see `POP` FR-POP-059 / OQ-POP-05

## 8. Edge cases, failure modes & required behaviours
| # | Case | Required behaviour | Source |
|---|---|---|---|
| 1 | Production is **zero** while consumption is non-zero (no energy plant placed) | The usage bar must be treated as **100 % (saturated)**, not divide-by-zero; city growth stops; the detail view must state "no supply". | derived from F1/F2 · OQ-ECO-10 |
| 2 | Consumption is **zero** (nothing built yet) | Usage bar = 0 %, empty, no penalty. | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 3 | Production and consumption are **both zero** | Usage bar = 0 %, not NaN. | derived |
| 4 | A building is **demolished** while producing | Its production is removed from the pool on the same tick; its construction cost is **not** auto-refunded (FR-ECO-056). | OQ-ECO-05 |
| 5 | A **Harbor is demolished** | The map that owned it **leaves the region-wide food/waste pool immediately**; the remaining member maps keep pooling together and, if none is left, fall back to local accounting; bars and the globe icon update without a reload. | https://www.youtube.com/watch?v=m5O-A33wQm0 · OQ-ECO-13 |
| 6 | A **C-wire or water pipeline is demolished** | Same re-scoping behaviour as case 5 for the energy / water pools. | https://www.youtube.com/watch?v=y5g7xPHzj0A · OQ-ECO-13 |
| 7 | The player switches maps | The wallet and global bonuses are unchanged; only the demand bars (per-map) and unconnected usage bars re-scope. | https://www.youtube.com/watch?v=vBJdlAeLn0g · https://www.youtube.com/watch?v=OUYirEhc9c8 |
| 8 | **Offline** for longer than the longest construction | Constructions complete on load; the player is not charged twice; speed-up multipliers apply across the whole offline window. | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 9 | Not enough **construction slots** | Placement is refused with a message stating the required slot count; the cost is not deducted. | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| 10 | **Insufficient coins** at placement | Placement is refused; no partial charge; no construction slot is consumed. | derived |
| 11 | Coin balance goes **negative** | No hard-lock by default (FR-ECO-127); the HUD shows a warning; in tycoon mode no warning is shown at all. | OQ-ECO-08 |
| 12 | A city is wiped with **"bulldoze all map at once"** | Buildings return to the inventory; the shared wallet is handled by the authored rule (scope **[TBD]** — OQ-ECO-16); the map's pools re-scope. | https://www.youtube.com/watch?v=vBJdlAeLn0g · OQ-ECO-05 |
| 13 | A building is sold from the **inventory** | Irreversible; credits coins; the building no longer contributes income or production. | https://www.youtube.com/watch?v=cSRDwHvowWI |
| 14 | A building sits in **storage** | It contributes **no** income and **no** production while stored. | derived |
| 15 | Animals exist but **no fields** | Animal enclosures starve: plant-food consumption is unsatisfied and animal food production is 0; the food bar reflects the shortfall. | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| 16 | A field sits **outside every pole barn** | The field does not operate (no plant-food output). | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| 17 | A **bonus building** covers an industrial food plant | No food bonus is applied to it (explicit exclusion). | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| 18 | A **waste incinerator** is used | It removes waste, produces energy, and adds pollution — the player is expected to place it in industrial areas. | https://www.youtube.com/watch?v=HDjaWySDKOM |
| 19 | **Nuclear power** used | Counts as **non-green** energy in the shipped game. | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| 20 | A **custom voxel model** is placed with no authored cost | Uses the computed cost (FR-ECO-050); if that is 0, the placement is free but must be reported as such. | OQ-ECO-09 |
| 21 | The player has **no Harbor / C-wire / pipeline** | All four systems use purely local accounting; no globe icons anywhere. | https://www.youtube.com/watch?v=yuLUP_ELk4I |
| 22 | A **global bonus** is viewed from two different maps | Identical values on both (FR-ECO-028). | https://www.youtube.com/watch?v=OUYirEhc9c8 |
| 23 | A usage bar sits at exactly **90 %** | Growth is reduced (the penalty applies *from* 90 %). | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| 24 | A usage bar sits at exactly **100 %** | Growth stops. | https://www.youtube.com/watch?v=LmY_TpU1B5Y |

## 9. Non-functional requirements
| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| NFR-ECO-001 | The economy simulation shall run on a **fixed tick** (proposed 1 Hz) decoupled from the render loop, so bars, income and usage values are frame-rate independent. | Must | Mobile | no | QA-ECO-061 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| NFR-ECO-002 | All monetary values shall be held as **64-bit integers** (minor units) to avoid floating-point drift in the monthly settlement. | Must | Mobile | no | QA-ECO-062 | derived from https://www.youtube.com/watch?v=OUYirEhc9c8 |
| NFR-ECO-003 | All economic tunables (thresholds, coefficients, costs, magnitudes) shall live in **external data files**, not in code, so the PC title can ship new balance without an engine change. | Must | Mobile | yes | QA-ECO-063 | https://store.steampowered.com/app/3474890/Super_Citycon/ |
| NFR-ECO-004 | A full economy state (wallet, pools, bars, ledger, construction timers, bonus emitters) shall be **serialisable and reloadable**, including after a long offline gap. | Must | Mobile | no | QA-ECO-064 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-ECO-005 | Construction progress shall be computed from **wall-clock timestamps**, not accumulated delta-time, so that time spent with the browser closed is honoured. | Must | Mobile | no | QA-ECO-054 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-ECO-006 | Recomputing all four usage bars and three demand bars shall take **< 2 ms** for a city of 5,000 buildings, so the HUD can update every tick. | Should | Mobile | no | QA-ECO-065 | derived from https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| NFR-ECO-007 | Changing pool membership (adding/removing a Harbor, C-wire, pipeline) shall re-aggregate **without a full world re-simulation** (incremental re-scoping). | Should | Mobile | no | QA-ECO-066 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| NFR-ECO-008 | Bar values shall be computed from the **same underlying numbers** shown in the detail views and the Government panel — no second implementation of the same ratio. | Must | Mobile | no | QA-ECO-034 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| NFR-ECO-009 | Every economic read-out shall be **localisable** — the "Super Cash", "coins", category names and recommendation strings shall come from a string table, not literals. | Should | Mobile | no | QA-ECO-067 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| NFR-ECO-010 | The economy system shall support a **headless / no-UI mode** so the numbers can be verified by simulation tests without a renderer. | Should | Mobile | no | QA-ECO-068 | derived from https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-ECO-011 | The voxel-editor cost model shall be **deterministic**: identical model inputs must always yield an identical cost and economic impact. | Must | Mobile | no | QA-ECO-026 | https://store.steampowered.com/app/3474890/Super_Citycon/ |
| NFR-ECO-012 | The economy shall tolerate **missing or invalid authored data** (e.g. a building with no cost or an unknown resource key) by falling back to documented defaults and logging a warning, never by throwing. | Must | Mobile | yes | QA-ECO-069 | derived from https://www.youtube.com/watch?v=jYAD0SkDmY0 |

## 10. Acceptance-criteria suites
| ID | Given | When | Then | Covers |
|---|---|---|---|---|
| QA-ECO-001 | A fresh region with 0 coins and 0 Super Cash | The wallet is inspected | Two separate balances exist, both zero, both shared across all maps (region-vs-profile scope [TBD] — OQ-ECO-16) | FR-ECO-001, FR-ECO-002 |
| QA-ECO-002 | Two maps in one region | Coins are earned on map A and then map B is opened | Map B shows the **same** coin balance; no per-map wallets exist | FR-ECO-002, FR-ECO-110 |
| QA-ECO-003 | The HUD money readout | The money value is tapped | The display toggles between the short and the long format | FR-ECO-003 |
| QA-ECO-004 | An active player with an empty Piggy Bank | Time passes and the player performs activity | The Piggy Bank's Super Cash total increases | FR-ECO-004 |
| QA-ECO-005 | A full Piggy Bank | The discounted purchase is confirmed | Super Cash is added at a price strictly below the normal Super Cash price | FR-ECO-005, FR-ECO-006 |
| QA-ECO-006 | The shop | The Super Cash section is opened | Regular Super Cash bundles are listed below the Piggy Bank | FR-ECO-007, FR-ECO-008 |
| QA-ECO-007 | A player who has claimed the 4 h chest | The 4 h timer elapses and the chest is opened | The chest is free and yields a mix of collectible parts and bonus cards | FR-ECO-009, FR-ECO-010 |
| QA-ECO-008 | A chest with a configured reward table | The chest is opened repeatedly | The observed reward distribution matches the table within tolerance | FR-ECO-011 |
| QA-ECO-009 | A free user | 3 h elapse | A free gift is claimable; and after 8 h the premium options unlock after 4 ads | FR-ECO-012, FR-ECO-023 |
| QA-ECO-010 | An incomplete collectible card | The player pays to complete it early | The card completes immediately and the premium charge is applied | FR-ECO-013 |
| QA-ECO-011 | A bonus card and a building in storage | The shop is opened and the storage tab is tapped | The storage tab is visible; the card and building can be redeemed back into the inventory | FR-ECO-014, FR-ECO-016, FR-ECO-017 |
| QA-ECO-012 | An add-on for a building | The add-on is purchased and the building is placed 3 times | All 3 placements succeed; no second purchase is required | FR-ECO-015 |
| QA-ECO-013 | A building in the inventory | It is sold | Coins are credited and the building is permanently gone from the inventory | FR-ECO-018, FR-ECO-019 |
| QA-ECO-014 | A player with 1 construction slot | The Citycon Building is purchased | The slot count becomes 2 permanently | FR-ECO-020 |
| QA-ECO-015 | A player with the speed-up package | A construction is running with the browser closed | On return, the construction is further along than it would be at normal speed | FR-ECO-021 |
| QA-ECO-016 | A player with Sandbox Constructions | A building is placed and then moved | Placement is instant and the move can be confirmed instantly | FR-ECO-022 |
| QA-ECO-017 | A player who watches the support ad | 10 minutes of game time pass | The game runs at double speed for that window | FR-ECO-024 |
| QA-ECO-018 | A city with residential, commercial and industrial buildings | The Income tab is opened | Income is shown separately for the three sectors, each split into global, map and local | FR-ECO-025, FR-ECO-026, FR-ECO-044 |
| QA-ECO-019 | A region with a Global bonus upgrade | The Income tab is opened from map A and again from map B | Both views show identical Global bonus values and equal income from the upgrade | FR-ECO-027, FR-ECO-028, FR-ECO-029 |
| QA-ECO-020 | A map with an airport map-bonus building | A building on that map is inspected and the Income tab is opened | The airport bonus appears as a Map bonus affecting that map's buildings only | FR-ECO-030, FR-ECO-031 |
| QA-ECO-021 | A business park emitting an 11×11 bonus area and a parking lot emitting 10×9 | A building inside and a building outside each area are inspected | Only the inside building receives the local bonus; the affected area highlights when the emitter is tapped | FR-ECO-032, FR-ECO-033, FR-ECO-034 |
| QA-ECO-022 | A selected building | The bars icon and the bonus icons are inspected | The full list of local/map/global bonus sources is shown and each category icon is greyed out when inactive | FR-ECO-035, FR-ECO-036, FR-ECO-037 |
| QA-ECO-023 | A region with buildings producing income | One in-game month elapses | Income is credited to the shared wallet and a ledger entry is recorded per sector | FR-ECO-038, FR-ECO-039, FR-ECO-125 |
| QA-ECO-024 | The City Upgrade list | The upgrade list is opened | Coin upgrades and Super Cash upgrades are both present, including coin value and coin appearance, and production/consumption upgrades | FR-ECO-040, FR-ECO-041, FR-ECO-042, FR-ECO-043 |
| QA-ECO-025 | A player with enough coins | A building is placed | The cost is deducted exactly once; in sandbox mode the cost is still deducted and no timer starts | FR-ECO-046, FR-ECO-047, FR-ECO-048, FR-ECO-049, FR-ECO-129 |
| QA-ECO-026 | A custom voxel model with known volume, footprint and material count | It is placed from SCC Studio | A cost and an economic impact are computed automatically, deterministically, and are at least as large as those of a strictly smaller model | FR-ECO-050, FR-ECO-051, FR-ECO-052, FR-ECO-053, FR-ECO-054, NFR-ECO-011 |
| QA-ECO-027 | A built building with upkeep 0 and no refund rule | It is demolished | No upkeep is charged and no refund is granted | FR-ECO-055, FR-ECO-056, FR-ECO-057 |
| QA-ECO-028 | A city | The HUD is inspected | Exactly 3 demand bars (residential, commercial, industrial) and 4 usage bars (energy, water, food, waste) are present in two separate blocks | FR-ECO-058, FR-ECO-059, FR-ECO-060 |
| QA-ECO-029 | A city well covered in commercial and industrial but short of residential | The demand bars are inspected | The residential bar is the fullest and the detail view says more residential buildings are needed; an empty bar means the sector is covered | FR-ECO-061, FR-ECO-062, FR-ECO-073 |
| QA-ECO-030 | A city with a known production and consumption for a resource | The usage bar is inspected | The bar equals consumption ÷ production and is oriented so that more usage = fuller bar | FR-ECO-063 |
| QA-ECO-031 | Usage at 89 %, 90 %, 99 %, 100 % | The growth factor is read | 89 % → factor 1.0; 90 % → factor below 1.0; 99 % → factor still below 1.0 and above 0.0; 100 % → factor 0.0 and the city stops growing | FR-ECO-064, FR-ECO-065, FR-ECO-066, FR-ECO-067, FR-ECO-074 |
| QA-ECO-032 | A usage bar at 95 % | Happiness and Mayor Score are read | Both are lower than the same city at 89 % usage | FR-ECO-068 |
| QA-ECO-033 | A usage bar of 82 % | The bar block is tapped | The detail view shows exact production, consumption, the percentage and a plain-language recommendation | FR-ECO-069, FR-ECO-070 |
| QA-ECO-034 | A city | The HUD bar, the bar detail view and the Government panel are compared | All three report identical numbers | FR-ECO-071, NFR-ECO-008 |
| QA-ECO-035 | Two maps, one connected to a global pool and one not | The usage bars are compared | The connected map shows global numbers and a globe icon; the unconnected map shows only its own | FR-ECO-072 |
| QA-ECO-036 | The Government Overview | The energy, water, food, waste, health, security, fire and education sections are opened | Each section shows bars and circles; the bars equal the HUD values; the circles come from `SRV` | FR-ECO-075, FR-ECO-076, FR-ECO-077, FR-ECO-080 |
| QA-ECO-037 | A fully covered service and an uncovered one | The Government panel is inspected | One circle is full and one is not, with no error state, and the panel conveys that bars want low and circles want full | FR-ECO-078, FR-ECO-079 |
| QA-ECO-038 | A city with wind power, a coal plant, solar and nuclear | The energy overview is opened | Production is shown split into green and non-green, with nuclear counted as non-green | FR-ECO-081, FR-ECO-082, FR-ECO-083 |
| QA-ECO-039 | A city with nuclear power | The energy overview is read | The non-green portion includes the nuclear output | FR-ECO-083 |
| QA-ECO-040 | A city with a water tower and two pumps | The water overview is opened | Current production and current consumption are reported separately; the pipeline contributes no production | FR-ECO-084, FR-ECO-085 |
| QA-ECO-041 | A city with fields, animal enclosures and a food factory | The food chain is evaluated | Fields produce plant food; animals consume plant food and produce animal food; the factory consumes both and outputs more | FR-ECO-086, FR-ECO-087, FR-ECO-088, FR-ECO-089 |
| QA-ECO-042 | The food tab of the Government panel | It is opened | Plant source, animal source and processed food are listed with production at the bottom, consumption top right, a resident quota and an overall usage bar | FR-ECO-090, FR-ECO-091 |
| QA-ECO-043 | A silo with a 13×13 area next to fields, an animal enclosure and a food factory | The bonus is applied | Fields and the enclosure are boosted; the food factory is **not** | FR-ECO-092 |
| QA-ECO-044 | A city with a landfill, a recycling station and an incinerator | The waste overview is opened | Production is broken down by residential, commercial, industrial, government and farms, removal is shown, and the incinerator also produces energy and pollution | FR-ECO-093, FR-ECO-094, FR-ECO-095, FR-ECO-099 |
| QA-ECO-045 | A recycling station | It is upgraded | Its removal capacity increases and the waste bar improves | FR-ECO-096 |
| QA-ECO-046 | A field outside every pole barn and one inside | The production totals are read | The outside field produces nothing; the inside field produces plant food | FR-ECO-098 |
| QA-ECO-047 | A region with a Harbor on map A | The economy panel is opened | Map A is in the global food+waste system; the globe icon is shown for food and waste | FR-ECO-100, FR-ECO-101, FR-ECO-112 |
| QA-ECO-048 | A region in which **map A and map B each own a Harbor** | Map B's food and waste numbers are read | They aggregate map A's and map B's own production and removal, and both maps carry the globe icon for food and waste | FR-ECO-102, FR-ECO-109 |
| QA-ECO-049 | A region with a C-wire on map A | Map B's energy numbers are read | They include map A's generation, and the globe icon is shown for energy | FR-ECO-103, FR-ECO-104 |
| QA-ECO-050 | A region with no water pipeline | Map A's water numbers are read | They are local-only and carry no globe icon; a Harbor alone does not connect water | FR-ECO-105, FR-ECO-108 |
| QA-ECO-051 | A connected map | The economy panel is opened for food and for energy | The globe icon appears on both and the displayed values are the global ones | FR-ECO-106, FR-ECO-107 |
| QA-ECO-052 | An unconnected map | The economy panel is opened | No globe icon appears and only local values are shown | FR-ECO-108 |
| QA-ECO-053 | A building with a configured duration | It is placed | The construction timer is expressed in minutes and completes in the configured time | FR-ECO-113, FR-ECO-122 |
| QA-ECO-054 | A construction in progress | The browser is closed for 30 minutes and reopened | The construction has progressed by the elapsed wall-clock time, faster if a speed-up applies | FR-ECO-114, FR-ECO-115, NFR-ECO-005 |
| QA-ECO-055 | A free user | The speed-up button is tapped | A temporary speed-up applies; a speed-up-package owner has no such button | FR-ECO-116, FR-ECO-117 |
| QA-ECO-056 | A new region | The construction tray is inspected | There is exactly 1 slot; each Citycon Building built adds 1 | FR-ECO-118, FR-ECO-119 |
| QA-ECO-057 | A large building needing 2 slots with 1 slot free | It is placed | Placement is refused with a message stating the required slots; with 2 slots free it occupies both for the whole build | FR-ECO-120, FR-ECO-121 |
| QA-ECO-058 | A tax rate of 1.2 is authored for residential | The Income tab is opened | The residential figure reflects the rate and the rate is shown per sector | FR-ECO-123, FR-ECO-124 |
| QA-ECO-059 | A completed month | The financial report is opened | It lists income per sector, bonuses applied, construction expenditure and the net change | FR-ECO-126 |
| QA-ECO-060 | A classic-mode city whose balance would go negative | The city continues and tycoon mode is toggled | Classic mode shows a warning but does not hard-block; tycoon mode shows no financial-stress consequence | FR-ECO-127, FR-ECO-128 |
| QA-ECO-061 | A city of 5,000 buildings | 60 ticks are run | Every bar value is identical across runs and independent of frame rate | NFR-ECO-001 |
| QA-ECO-062 | A monthly settlement of 10,000 ledger entries | The period is closed | The integer total is exact with no floating-point drift | NFR-ECO-002 |
| QA-ECO-063 | A tunable file | The 90 % threshold is changed and the game restarted | The new threshold takes effect with no code change | NFR-ECO-003 |
| QA-ECO-064 | A saved city | It is reloaded after a long gap | Wallet, pools, bars, ledger and construction timers all restore consistently | NFR-ECO-004 |
| QA-ECO-065 | A city of 5,000 buildings | Bars are recomputed | The recomputation completes in under 2 ms | NFR-ECO-006 |
| QA-ECO-066 | A Harbor on map A | The Harbor is demolished | The pools re-scope immediately and the bars update without a reload | NFR-ECO-007 |
| QA-ECO-067 | A German locale | The economy UI is inspected | All economic strings are translated from the string table | NFR-ECO-009 |
| QA-ECO-068 | A headless build | The economy is stepped for 100 ticks | Bars, income and ledger update with no renderer present | NFR-ECO-010 |
| QA-ECO-069 | A building with a missing cost and an unknown resource key | The city loads | The documented defaults are applied, a warning is logged, and no exception is thrown | NFR-ECO-012 |
| QA-ECO-070 | A region in which **map A owns a Harbor and map B owns none** | Map B's food and waste numbers are read | They are map B's own local figures with **no globe icon**, and map A's production and waste are not included | FR-ECO-102, FR-ECO-108 |

## 11. Open questions & TBDs
| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| OQ-ECO-01 | **[TBD]** Is there a player-facing **tax rate** per zone type (residential / commercial / industrial)? | No tutorial exposes a rate control; the Income tab shows only bonuses. The rebuild needs to know whether to build a tax slider UI at all. | **No player-facing rate.** Keep a per-sector `taxRate` field defaulting to **1.0** so the model is extensible, and fold any tuning into `incomeBase`. See F11. |
| OQ-ECO-02 | **[TBD]** Exact **Piggy Bank fill rate, cap and discount**, and the **Super Cash bundle tiers/prices**. | Prices and rates are monetisation-facing and must not be invented silently. | Author from a published store sheet; until then, placeholder tiers with a **50 %** Piggy Bank discount and a 24 h fill cap, flagged as non-shippable. |
| OQ-ECO-03 | **[TBD]** **Chest reward tables** — part amounts, card rarity weights, conversion. | Chest cadence is confirmed; contents are not. | Author a data table (common/rare/epic) and mark as provisional. |
| OQ-ECO-04 | **[TBD]** **Sell-back value** of a building from the inventory. | Affects economy balance and the storage/sell decision. | Sell for **0** by default (no exploit: selling must never be profitable). |
| OQ-ECO-05 | **[TBD]** Are there **maintenance / service upkeep** charges, and is there a **demolition refund**? | No upkeep appears in any tutorial; without a rule, upkeep is unmodellable and refunds can be exploited. | **No upkeep (0)** and **no refund** in the first rebuild; support the fields for later use. |
| OQ-ECO-06 | **[TBD]** What exactly is the **budget cycle** — day length, settlement day, accrual-vs-lump-sum? | Income is confirmed monthly but the calendar mechanics behind it are not; the date starts at "Day Zero" and a demo city was 229 years old. | 1 in-game day = 1 real minute; settle on day 1 of each month; accrue continuously and pay the delta monthly. |
| OQ-ECO-07 | **[TBD]** Does the **coin value** City Upgrade multiply income, expenditure, or both? | It is confirmed to exist ("the value of coins") but its target is unstated. | Multiply **income only**, so it cannot be used to deflate build costs. |
| OQ-ECO-08 | **[TBD]** **Base income, production/consumption magnitudes, conversion ratios and bonus strengths.** | Without them the economy cannot be balanced at all. | Author a first-pass table per building category and expose every value as a tunable; never hard-code. |
| OQ-ECO-09 | The exact **SCC Studio auto-cost / auto-economic-impact formula**. | The behaviour is confirmed by the dev ("automatically calculates construction costs and economic impact"), but the formula is not published; the rebuild must publish one named function used by both the editor and the catalogue. | The **formula is [TBD — design decision]**. Proposed default only (not a requirement): `cost = a·voxelCount + b·footprintTiles + c·materialCount` with `a,b,c ≥ 0`, `economicImpact` derived from the same authored production/consumption fields, player-overridable. See F10. |
| OQ-ECO-10 | The **growth-penalty curve between 90 % and 100 %**. | A single shared curve must be chosen; per-resource curves would break the mechanic's legibility. | One shared monotonic curve; the **shape is [TBD]**. Fixed by the tutorial: `g(u) = 1.0` for `u < 90 %`, `0 < g(u) < 1.0` for `90 % ≤ u < 100 %`, `g(100 %) = 0`. A linear `g(u) = (100−u)/10` is **excluded** (it would give `g(90 %) = 1.0`). See F2. |
| OQ-ECO-11 | **[TBD]** The **wealth level → bonus %** mapping (observed 1.65 → 129 %, 3 → 250 %). | The mapping is deliberately opaque; a rebuild must still pick one. It **belongs to `POP`** (FR-POP-059, OQ-POP-05), which publishes the curve and its anchor as [TBD]. | **[TBD — owned by `POP`]**. `ECO` consumes the published bonus percentage only as a growth input and proposes **no competing default**; see F12. |
| OQ-ECO-12 | **[TBD]** The waste bar's numeric semantics (the tutorial shows "177% in use" while calling the city fine). | Determines whether a full waste bar means "saturated" (bad) or "fully handled" (good) — the opposite polarities. | Define the waste bar as **removal-capacity utilisation**; 100 % means waste is exactly balanced, and only >100 % means a shortage. Flag as a deliberate divergence from the other three usage bars. |
| OQ-ECO-13 | **[TBD]** Should a pool re-scope be **instant** when a Harbor/C-wire/pipeline is added or removed? | Affects save/load determinism and whether mid-session pool changes need a re-simulation. | **Instant and incremental**; store pool membership explicitly in the save so reloads are deterministic. See NFR-ECO-007. |
| OQ-ECO-14 | **[TBD]** What should the **periodic financial report** show? | A requirement exists for reporting but no UI is evidenced. | Per sector: gross income, each bonus scope's contribution, expenditure, net — with a monthly comparison to the previous month. |
| OQ-ECO-15 | **[TBD]** Should the **90 % / 100 % thresholds** differ per resource (e.g. food is scarcer than water)? | All four are presented as one mechanic; per-resource thresholds would need strong justification. | **One shared threshold set for all four resources** (90 % / 100 %), with resource-specific *values* instead. |
| OQ-ECO-16 | Is the shared currency balance scoped to the **region** or to the whole **profile**? | The tutorial only says the balance is "shared across all maps in general"; the two readings differ once a player has more than one region, and `ECO` owns the money model, so the answer must be published here once. | **[TBD — design decision] — this question owns the scope.** Until it is answered, every document says "the shared wallet" and asserts no scope. Proposed default when forced: **profile-wide** (one wallet for the whole save); `CORE` cross-references this question and shall not assert a scope of its own. |

## 12. Source list
| # | URL | What it gave us | Retrieved |
|---|---|---|---|
| 1 | https://www.youtube.com/watch?v=LmY_TpU1B5Y | **Economy Overview** tutorial transcript — demand/usage bar blocks, the 90 %/100 % growth rules, Government panel circles-vs-bars polarity. | 2026-10-23 |
| 2 | https://www.youtube.com/watch?v=jYAD0SkDmY0 | **The Basics** transcript — two bar blocks, the worked 82 %/56 % example, currencies, Piggy Bank, chests, add-ons, construction slots, speed-up packages, City Upgrades, storage, sandbox speed ad. | 2026-10-23 |
| 3 | https://www.youtube.com/watch?v=OUYirEhc9c8 | **Income Bonuses** transcript — residential/commercial/industrial split, global/map/local bonus scopes, region-wide City Upgrades, 11×11 and 10×9 bonus areas, **monthly income**. | 2026-10-23 |
| 4 | https://www.youtube.com/watch?v=m5O-A33wQm0 | **Connected Economies** transcript — Harbor→global food+waste (only maps that **own** a Harbor are connected), C-wire→global energy, water pipeline, globe icon, wallet shared across all maps (scope [TBD]). | 2026-10-23 |
| 5 | https://www.youtube.com/watch?v=6wWZxnm_YLk | **Food Supply System** transcript — plant/animal/processed tiers, pole barns, silo & windmill 13×13 bonuses, the explicit exclusion of industrial food production. | 2026-10-23 |
| 6 | https://www.youtube.com/watch?v=yuLUP_ELk4I | **Water Supply System** transcript — water tower / small pump / big pump, pipeline as connector, production vs consumption, globe icon. | 2026-10-23 |
| 7 | https://www.youtube.com/watch?v=y5g7xPHzj0A | **Energy Supply** transcript — producer list, green vs non-green (nuclear non-green), C-wire, incinerator energy + pollution. | 2026-10-23 |
| 8 | https://www.youtube.com/watch?v=HDjaWySDKOM | **Waste Management** transcript — landfill / recycling station (upgradeable) / incinerator, production split by category, the ambiguous "177% in use" reading. | 2026-10-23 |
| 9 | https://www.youtube.com/watch?v=cSRDwHvowWI | **Storage Feature** transcript — warehouse mechanics, irreversible sell for coins, blue-button redeem, inventory vs built counts. | 2026-10-23 |
| 10 | https://www.youtube.com/watch?v=CIb2IWyNPJw | **Resident Bonuses** transcript — the wealth level → bonus anchor (1.65 → 129 %, level 3 → 250 %). | 2026-10-23 |
| 11 | https://www.youtube.com/watch?v=_QpxzZFTBtw | **Happiness & Mayor Score** transcript — confirms the 90 %-usage penalty feeds happiness and Mayor Score; the region-wide Mayor Score aggregation. | 2026-10-23 |
| 12 | https://www.youtube.com/watch?v=vBJdlAeLn0g | **Switching Maps** transcript — region view, per-map switch, whole-map bulldoze returning buildings to the inventory. | 2026-10-23 |
| 13 | https://www.youtube.com/playlist?list=PLw0KMesSQbg8GvG8OXmaMp7gYNlMFEqCx | The official How-To playlist — used to enumerate every tutorial and to confirm the **absence** of a tax/budget/maintenance tutorial (OQ-ECO-01, OQ-ECO-05). | 2026-10-23 |
| 14 | https://store.steampowered.com/app/3474890/Super_Citycon/ | PC title store page — Early Access is a **construction sandbox**; the feature list and system requirements. *Not* the source of the editor auto-cost behaviour (see source #19). | 2026-10-23 |
| 15 | https://supercitycon.net/ | Official site — confirms the mobile and Steam titles are **separate products**; Early Access Q4 2026. | 2026-10-23 |
| 16 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 | App Store listing (id1607860732) — "Resources are key, but there's no waiting for construction" (sandbox still costs), 300+ structures, Region View, Mayoral Match-Up. | 2026-10-23 |
| 17 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder | Google Play listing — cross-check of the mobile product, modes and features. | 2026-10-23 |
| 18 | https://www.youtube.com/watch?v=c3L7Qo8fdIM | **Science View** tutorial — the overlay that visualises the food-supply areas (pole barns, bonus emitters) used by FR-ECO-092 / FR-ECO-098. | 2026-10-23 |
| 19 | https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ | Dev's own Reddit post (same dev, same game) — the source of the **auto-calculated construction costs and economic impact** of editor buildings (F10, FR-ECO-050…054). Reddit serves the post body client-side, so the quotation is carried via the shared research brief §2; the **formula itself is not published** (OQ-ECO-09). | 2026-10-23 |
