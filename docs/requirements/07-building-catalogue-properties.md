# BUILDING CATALOGUE, PROPERTIES, TIERS & SHOP — SuperCitycon Requirements
> Bot: BOT-07 · Domain code: BLD · Status: COMPLETE (rebuilt from verified sources)
> Sources consulted: **24 distinct URLs** (13 official YouTube How-To tutorials read from their own caption tracks, App Store listing, iTunes lookup API, Google Play listing, Steam store + Steam appdetails API, official site, r/supercitycon, third-party guide, two retailer/catalogue mirrors, Steam community guides index) · Requirements: **107 FR / 12 NFR / 70 QA** · Open questions: **21**
> **Evidence note.** The **mobile** title ("Super Citycon: Build a City", App Store id 1607860732, released 11 May 2022) is the only product where the building catalogue, property schema, shop and storage are publicly documented and playable today; it is therefore the **target specification**. The **PC** title (Steam 3474890, Early Access Q4 2026) ships as a **construction sandbox** over a "continuously growing library of buildings, vehicles, citizens and props" and uses the same content model with progression switched off. Every behavioural claim below is grounded in the game's own material — the official YouTube channel "Super Citycon - City Building Game", the official store listings and the official site. **No claim in this document is sourced to a different game.** Where a behaviour is plausible but unevidenced, it is carried as an explicit `[TBD — design decision]` row at Priority `Could` / Stage `Design` with a matching Section 11 entry.

---

## 0. Scope

- **In scope (BOT-07 / BLD):** the **building catalogue** — what the game ships, how it is taxonomised, how it grows; the **building property schema** (the complete field set every entry carries); **tier / level ladders** and what a level changes; the **building shop** (browsing, category tabs, purchase, unlock visibility, storage tab); the **inventory**, the **storage / warehouse** and redemption; **add-ons**, the **Building of the Week**, **bonus cards** and **collectible parts**; **demolition** and the **place → remove → re-place** loop that the user asked for; **unlock conditions**; and the **PC title's catalogue extension** through SCC Studio.
- **Out of scope (owner named — referenced, never specified here):** cost formula, taxes, income/expense maths, production-chain economics → `ECO` (this document supplies the **inputs**: cost components, upkeep, production/consumption coefficients); happiness, City/Mayor Score, the six resident-growth bonuses → `POP` (**inputs**: culture/entertainment/recreation points, wealth level, diversity contribution); service **coverage geometry and radii maths** → `SRV` (**input**: declared radius, capacity, area-of-effect shape); roads, traffic routing, transit → `MOB` (**input**: cars/pedestrians generated, road/monorail connection rules); terrain/water/grid → `WLD`; voxel editor, Workshop publishing → `STD`; HUD layout, shop chrome → `UX`; mode/stage model, level curve → `CORE`; rendering, art direction, save format → `TEC`.
- **Boundary rule:** `BLD` owns **what exists, what each item is, and what it carries** — not the numbers derived from those items.
- **Provenance rule for this rebuild:** every row cites a URL verified in `tools/source_ledger.json` (or a ledger-verified retailer mirror of the publisher's own listing copy, flagged in Section 12). Rows whose only support was one of the two **FOREIGN** sources marked in that ledger — a *different game's* help centre and tips site — have been **deleted**, not reworded. The features, upgrade rules and item classes those sources describe are **not part of Super Citycon** and appear nowhere in this document.

---

## 1. Observed behaviour (evidence)

### 1.1 Source findings

| # | Finding | Status | Source URL |
|---|---|---|---|
| S1 | App Store listing: "**GROW FROM FARM TO METROPOLIS**: Expand your city with **over 300 unique structures**"; "**MONTHLY ADD-ONS**: Enjoy ongoing development and **new buildings every month**"; "**SANDBOX CONSTRUCTION MODE**: Build instantly without delays. Resources are key, but there's no waiting for construction!"; "**BOUNDLESS MAPS**"; "**REGION VIEW**"; "**SUPER CITYCON STREET VIEW**"; "**MAYORAL MATCH-UP**". Subtitle "Building Tycoon Simulation", iOS 14+, rating 4.7 from 1 576 reviews. | [CONFIRMED] | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| S2 | Google Play listing: "Design your town from a small village to a massive metropolis with **over 300 unique buildings**"; "**300+ BUILDINGS**: Grow from farm to metropolis. Construct **homes, factories, landmarks, parks**, and more"; "**MONTHLY UPDATES**: New buildings and content every month"; "Build your city instantly — no waiting, no timers." Meta description: "City builder tycoon simulation! Build your town with no wait timers." Updated 21 Dec 2025. | [CONFIRMED] | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| S3 | iTunes lookup record: version **2.4.0**, first released **2022-05-11**, size 513 497 088 bytes, minimum iOS 14.0, seller "BEN WILLES GAMES, SOCIEDAD LIMITADA". Release notes for 2.4.0: "Build and grow your city with the **Ancient China add-on**. This update also includes some fixes and overall improvements." | [CONFIRMED] | https://itunes.apple.com/lookup?id=1607860732&country=us |
| S4 | Steam store page: "**Build each district directly from a continuously growing library of buildings, vehicles, citizens and props.**"; "**Place buildings from a growing library**, then open SCC Studio whenever you want to customize a model or create something new"; "**SCC Studio** … Customize existing buildings, vehicles, terrain sets, citizens and props, or start from an empty grid and create something new"; "**Different architectural styles** give every neighborhood its own character"; "Early Access begins with a **construction sandbox**"; store category "**Includes level editor**"; Windows + macOS; release **Q4 2026**. | [CONFIRMED] | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| S5 | Steam **appdetails** API returns the same About-the-game text plus structured metadata (categories incl. "Includes level editor", genres incl. Early Access, `release_date.coming_soon: true`, `release_date.date` "Q4 2026", developer/publisher "Sunapie Games"). | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |
| S6 | Official site: "The original **Super Citycon™: Build a City** is free on iPhone, iPad and Android. **It is a separate game from SuperCitycon on Steam.**"; "Early Access · Q4 2026 · Windows & macOS"; "From a **seaside neighborhood to a downtown skyline**." | [CONFIRMED] | https://supercitycon.net/ |
| S7 | **The Basics** tutorial — official channel "Super Citycon - City Building Game", published 2025-02-06. Catalogue: "in the building shop you can find a lot of buildings currently uh as you can see in the top we got **over 300** but it's continuously growing and you will find buildings of **different categories**" (tabs visible: the supply ones, parks, skyscrapers). | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S8 | **The Basics** — placement: "you drag it there it **automatically snaps to the streets** … the **muddy roads won't give Road connection** to this building". Editing: "to edit a building you **long tap a building** and you will get into **orbit mode** … tap the edit button … options to **rotate** … but you can also **move it** and put it somewhere else". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S9 | **The Basics** — demolition: "if you open the **inventory** on the right side you will find the **bulldozer button** uh if you check the bulldozer uh you can choose **three categories** which essentially tells which things get bulldozed when you tap them". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S10 | **The Basics** — construction slots: "in the beginning you will have only **one** but for each **Citycon Building** that you build you will get another **permanent construction slot** … some bigger buildings require **two or more construction slots** … you can get those from **shop** you can also **collect them over time** or a combination of both". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S11 | **The Basics** — shop contents: "**add-ons** … add-on means **you unlock it once you got it forever** you can **build it as often as you want**"; "the **building of the week** … that's a **weekly rotating building** and it's **Unique** and it's **only available for this week** once it's gone it's gone it maybe will come back any time in the future but **not soon**"; "**Sandbox Constructions** … **zero construction time** … you can instantly confirm buildings when you move them"; "the **Citycon Building** … gives you another construction slot"; the **speed-up package**; the **Piggy Bank** collects Super Cash over time; "every 4 hours or every 24 hours you can redeem free chest … that give you **collectible parts** and that give you **bonus cards**". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S12 | **The Basics** — storage tab: "this tab is maybe not present in your game it's **only there when you got something in storage** especially when you got bonus cards in storage … you can put **buildings and bonus Cards into storage** … and you can **redeem it from here** by tapping this button in **shop**". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S13 | **The Basics** — progression: "we don't have **XP points** your level straight forward depends on your **residence amount** … **higher levels unlock more buildings**"; the date "start the date at **Day Zero**". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S14 | **The Basics** — government panel: "**City upgrades** … mainly City upgrades can be purchased with **coins** once you got everything at some point you will find some with **super cash**"; sections for **Collectibles** ("card you get from chests or over time"), High scores, Income, Mailbox, Shop, and an overview for "electricity for water for food Waste Management healthc care police uh fire and education". | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S15 | **Storage Feature** tutorial — "once your inventory is pretty full … you got the option to store cards **buildings** uh cards and buildings um in your storage"; "you tap a building in the inventory and you can see this **blue button** … you get this menu … you can **choose the amount of the building** if you own multiple … you can put them to **Warehouse** or you can **sell** them if you sell them they are **gone forever** and you will get some **coins**". | [CONFIRMED] | https://www.youtube.com/watch?v=cSRDwHvowWI |
| S16 | **Storage Feature** — redemption: "you go to **store** … buildings that you have in storage now have this **blue button instead of the price** and the purchase option when you tap them and simple put to bring them back to your **inventory**"; the card shows "the amount of this building that you got in inventory and also … this super tiny number here in the top left corner is the amount of that building that is **built already on your map**". | [CONFIRMED] | https://www.youtube.com/watch?v=cSRDwHvowWI |
| S17 | **Resident Bonuses** — the six bonuses are "**culture entertainment Recreation wealth diversity and loyalty**"; they "sum up to your residence bonus and increase your residence amount". | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| S18 | **Resident Bonuses** — point properties: buildings carry **culture points**, **entertainment points**, **recreation points**; "you need **one point per thousand residents**" to reach the full **250 %** bonus per category. | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| S19 | **Resident Bonuses** — the **unique** property: "this one is unique uh which means the **cinema will have effect only once on the map** so even when you got multiple Cinemas you only get those points once"; by contrast "this little plus um indicates that you can have multiple of those buildings on one map while you still get the **bonus for each one**". | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| S20 | **Resident Bonuses** — wealth: "some of the buildings **not all of them** have an actual **wealth value** … here is wealth **level one** wealth **level two** … the beach ones they have **wealth level three** … those that don't have the wealth value they are **neutral** to the wealth system"; "what matters essentially is the **average** of all the buildings that have the wealth property … my current wealth level is **1.65** uh which translates to bonus in this case of **129 %** … if the wealth level would be **three** uh I would get the full **250 %** bonus". | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| S21 | **Resident Bonuses** — diversity: "you get **one diversity point for each unique building** that you got on your map … to get **250 diversity points** you need at least 250 different buildings"; and the penalty: "you **can't have more of eight Sky creepers at a time** … once you have more than eight of a skyscraper of a type uh you will get uh a **diversity penalty** um that means diversity points will be deducted". | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| S22 | **Energy Supply** — "all your buildings and your people they consume energy"; production buildings in the shop: "the **wind power** … the **wind power offshore** … the **Coal Power Plant** … the next thing is **waste incineration** … **solar power** and **nuclear power** once you unlocked it **when your city is big enough**"; the **C-wire** connects the energy supply of other maps; the overview shows **green vs non-green energy** ("green means green energy the red one means actually not green energy"); **waste incineration "also produces energy" and "does quite some pollution**". | [CONFIRMED] | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| S23 | **Water Supply** — supply buildings: "we got a **water tower** we got a **small water pump** and we got a **big water pump**"; the **water pipeline** connects multiple maps' water nets; the overview shows current production and consumption. | [CONFIRMED] | https://www.youtube.com/watch?v=yuLUP_ELk4I |
| S24 | **Waste Management** — shop category at "the lower lower end": "we got the **landfill** we got the **recycling station** and we got the **waste incineration**"; the landfill is "cheap and pretty straightforward"; the **recycling station** "also reduces your waste … it's a little more expensive and it's **upgradeable**"; **waste incineration** "will also reduce the waste or burn it for energy and **produce energy** for your city … it creates **a lot of pollution**"; the government overview breaks waste production down by "**residential** uh commercial uh **Industrial** the **government** and the **farms**". | [CONFIRMED] | https://www.youtube.com/watch?v=HDjaWySDKOM |
| S25 | **Food Supply** — sources are "**Fields** … **farm animals** … and you can have uh **food factories** (at the moment it's one food factory)"; the government overview splits food into "**plant Source** animal source and **processed food**"; "**animals will consume plant sourced food to produce animal sourced food**"; "processed food needs animal and plant Source food but outputs more"; "**pole barns** … animal enclosures and the fields they only work **when they are within the area of pole barn**"; bonus buildings "it's **windmills** and uh **silos** … gives a bonus to your food production **within the surrounding area** in this case uh **within an area of 13 by 13**"; bonus buildings "**do not** have effect on **Industrial food production**". | [CONFIRMED] | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| S26 | **Education** — three school levels: "**Elementary School** the first uh level of school system", then "the **secondary schools** and the **university**"; a school "has an **area of effect** and it has a **capacity**"; the demo elementary school was "already **level five** … at that level it's good for **1 million residents**" and connects residential buildings "within an area of **23 by 23**"; **bus stations** "provide School connection to the surrounding buildings … they not need to be built directly next to a school … they can build them anywhere" but "the bus stations will **deactivate** and will no longer provide connection to the school system" when capacity is insufficient; education **bonus buildings** (named **library**, **art museum**) "improve the quality of your school"; covered residential buildings receive an **income bonus**. | [CONFIRMED] | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| S27 | **Healthcare** — two building types: "the **hospital** … the hospital is **upgradeable** has **multiple levels**" and "the **Medical Center** … which is **cheaper** and I think it **unlocks earlier** but it also has a **smaller area of effect**"; healthcare has two measures, "**capacity**" and "the **local coverage**". | [CONFIRMED] | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| S28 | **Police** — "we got this **big Police Department**" and "a **small police station**"; "at this point of development it has only a **decoration and bonus character**"; coverage pays a bonus and "to get the bonuses you need to **cover your full city**"; the coverage icons on a building card (greyed out = not covered) exist "for police and for fire and all **three education levels**". | [CONFIRMED] | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| S29 | **Fire** — "you got this little cute **fire department** … all the buildings if they are covered by fire protection **will receive a bonus**"; the government fire tab shows "the local coverage for each building category so residential uh commercial and Industrial". | [CONFIRMED] | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| S30 | **Monorails** — "monor rails have the ability to **provide Street connection to Residential buildings** in the area **without having streets**"; they "can be built over fields" and over "**decoration buildings** … space that is already occupied by decoration buildings can be used to also provide connection to the traffic system"; the effect is "**only to residential buildings** commercial buildings and industrial buildings are **not affected** by the monor rail". | [CONFIRMED] | https://www.youtube.com/watch?v=71H1tU2DGz8 |
| S31 | r/supercitycon — dev posts name real content packs and real buildings: "**Super Citycon Speed Build with the new Amsterdam Add-on**" (BenWilles); "Have you added the **Space Casino** to your city yet?" (BenWillesGames); "Introducing the **Beach Life Event** – 30 days of sun, sand, and rewards … Lovingly designed **Beach Buildings and Decorations**"; a user post names the residential ladder "**houses apartments and luxury apartment**" and states "everything is **completely upgraded**" while the residential demand bar is still maxed; another reports "A warning pops up saying **2 slots needed**" for power plants and the hospital. | [CONFIRMED] | https://www.reddit.com/r/supercitycon/ |
| S32 | Older publisher listing copy (retailer mirror of the mobile title's own older App Store text): "**Unlock over 150 Buildings of multiple categories, some of them with multiple variations.** Start with a farm, build your **residential neighborhoods, commercial and industrial areas**, care about **water, food, energy, and waste management**. Take care of your resident's security with **police and fire stations**, be sure they stay healthy with **medical center's and hospitals**. Make your City a great place to live with **parks, sports, and recreation areas**!" — the **text** was read directly, but the mirror itself is **not** a ledger-verified source, so it is recorded as historical context and is **not relied on by any requirement row**. | [CONTEXT — non-ledger mirror] | https://thegameextras.com/game/super-citycon-city-builder/ |
| S33 | Third-party guide (2022): "you get **bonuses and new buildings as you level up**"; "as you level up, you will be able to unlock much better facilities like **apartments, parks**"; "no houses or facilities can function without proper **connection of routes**". | [CONFIRMED (third-party)] | https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |
| S34 | App catalogue mirror: "Latest Version **2.4.0**", "Size 489.7 MB", "First Released **May 11, 2022**", publisher "BEN WILLES GAMES, SOCIEDAD LIMITADA". | [CONFIRMED] | https://mwm.ai/apps/super-citycon-tm-build-a-city/1607860732 |
| S35 | Steam community page for app 3474890 — the **Guides** tab currently lists no published guides, so no player-written building list exists to corroborate the catalogue. | [CONFIRMED (absence)] | https://steamcommunity.com/app/3474890/guides/ |

### 1.2 Screens/flows observed

- **Building shop.** Tabs across the top for the catalogue categories ("the supply ones", parks, skyscrapers); a tab that exists **only while something is stored**; each card shows the building and its key badges. Count shown as "over 300". (S7, S12)
- **Placement.** Drag an entry from the shop onto the map; the ghost **snaps to the streets**; on "muddy roads" the building lands without a road connection. (S8)
- **Orbit / edit.** Long-press a building → camera orbits → an **edit** button exposes **rotate** (and **confirm**), plus a **move** action that re-seats the building on another tile. (S8)
- **Inventory / bulldozer.** Right-hand inventory; its **bulldozer** button toggles a **three-category** chooser ("disable trees and streets and … everything gets demolished"). (S9)
- **Inventory → store / sell.** Tap an owned building → a **blue button** → menu → **quantity selector** → *put to Warehouse* or *sell* (permanent, yields coins). (S15)
- **Shop → storage tab.** Stored buildings show a **blue restore button instead of the price**; tapping it returns them to the inventory. The card shows **count owned in inventory** (top-right) and **count built on the map** (small number, top-left). (S16)
- **Shop → purchases overview.** Add-ons, Building of the Week (centre tile), Sandbox Constructions, Citycon Building, speed-up package, Piggy Bank, free gift, free-user ad block, and the free chests. (S11)
- **Science View (mini-map).** Per-category overlays: food (barn areas and food-bonus areas), healthcare (green = covered), police (stations in orange, covered area in purple), fire (stations in orange, covered area in red), monorail (stations + the area they connect). Tapping a building highlights its own effect area. (S22–S26, S30)

---

## 2. System overview

```
 CATALOGUE (authored content, data-driven)              PLAYER-FACING SURFACES
 BuildingDefinition {                                     ┌────────────────────────────┐
   id, displayName, category, footprint, rotation,        │ BUILDING SHOP              │
   tier, tierLadder[], variants[], properties{…},         │  category tabs             │
   unlock{…}, contentPack{…}, appearance{…} }             │  locked entries + reason   │
   │                                                      │  STORAGE tab (if non-empty)│
   ├─ packs: base │ add-on │ event │ building-of-the-week │  BUILDING OF THE WEEK tile │
   │           │ chest │ weekly-rotation                 │  PURCHASES overview        │
   └─ packs are versioned and hot-loadable               └───────────┬────────────────┘
                                                                    │
 PLACEMENT / INSTANCE                                      BUILDING INSTANCE
 BuildingInstance { defId, tier, level, cells[], rotation,  { defId, tier, level, cells,
   skinId, constructionState, constructionSlotsHeld,       rotation, constructionState,
   builtCount, bonusArea }                                 storageState, builtCount }
   │                                                       │
   └─ derived per-map aggregates (consumed by ECO/POP/SRV/MOB)│
      capacity(population, jobs), serviceCoverage,           │
      points{culture,entertainment,recreation}, wealth,     │
      diversityPoints, pollution, traffic{cars,pedestrians}  │
                                                              │
   └─ lifecycle:  BUY ─► INVENTORY ─► PLACE ─► (upgrade in place)
                      ▲          │            │                   │
                      │          └─ MOVE (orbit-mode) ────────────┘
                   STORE (warehouse) ◄── SELL (terminal)
                      │
                   REDEEM (shop restore button) ─► INVENTORY
```

---

## 3. Functional requirements

### 3.1 Catalogue identity, size and growth

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-BLD-001 | The game shall expose a **building catalogue** as data — one definition record per entry — such that adding a building requires no engine change. | Must | Both | yes | QA-BLD-001 | https://store.steampowered.com/app/3474890/SuperCitycon/<br>https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| FR-BLD-002 | The catalogue's size shall be a **derived data field** (count of loaded definition records), never a hard-coded string in the UI. | Must | Both | yes | QA-BLD-001 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-003 | The catalogue shall currently contain **at least 300 distinct entries**, matching the published "over 300 unique structures / 300+ BUILDINGS / over 300 unique buildings". | Must | Mobile | yes | QA-BLD-001 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732<br>https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| FR-BLD-004 | The catalogue shall be **open-ended**: the shipping content packs must be replaceable and extendable without a code change, and the shipped count must be allowed to exceed 300. | Must | Both | yes | QA-BLD-002 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-BLD-005 | The catalogue shall **grow on a monthly cadence** with new buildings and new content, each release adding a pack of entries to the same catalogue. | Must | Mobile | yes | QA-BLD-002 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732<br>https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| FR-BLD-006 | The catalogue shall expose a **stable, unique, content-addressed id per entry** that survives save/load, content-pack updates and re-ordering; ids shall never be reused or renumbered. | Must | Both | yes | QA-BLD-003 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-BLD-007 | Each catalogue entry shall carry a **human-readable display name** shown on its shop card and in the inventory. | Must | Both | yes | QA-BLD-003 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-BLD-008 | The shipped catalogue shall report its **own live count**, derived from the loaded definition records, and shall **not** display a stale marketing number. The publisher's current listings state "over 300 unique buildings" / "300+ BUILDINGS" and the in-game shop shows that same live count, which grows continuously; the older "over 150" figure recorded in Section 12, entry 22 is historical context only and shall not be shipped. | Must | Mobile | yes | QA-BLD-001 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732<br>https://play.google.com/store/apps/details?id=com.benwilles.citybuilder<br>https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.2 Taxonomy and categories

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-BLD-009 | The catalogue shall expose the following **categories**: residential, commercial, industrial, energy, water, food/agriculture, waste, health care, police/security, fire, education, transit (monorail), parks/leisure/recreation, decoration, and special city-wide upgrades. | Must | Mobile | yes | QA-BLD-004 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://www.youtube.com/watch?v=HDjaWySDKOM<br>https://www.youtube.com/watch?v=6wWZxnm_YLk<br>https://www.youtube.com/watch?v=71H1tU2DGz8 |
| FR-BLD-010 | The shop shall expose **one tab per category**, matching the game's own category tabs (supply, parks, skyscrapers and the waste category "at the lower lower end" of the list). | Must | Mobile | no | QA-BLD-004 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-BLD-011 | The **residential** category shall contain at least the ladder **house → apartment → luxury apartment → skyscraper**. | Must | Mobile | yes | QA-BLD-005 | https://www.reddit.com/r/supercitycon/<br>https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-BLD-012 | The **commercial** and **industrial** categories shall exist as distinct categories with distinct entries: the game tracks commercial workspaces separately from residential capacity, splits waste between residential / commercial / industrial / government / farms, and lists a **food factory** as an industrial entry. The individual commercial entries are not named in any verified source. | Must | Mobile | yes | QA-BLD-005 | https://www.youtube.com/watch?v=HDjaWySDKOM<br>https://www.youtube.com/watch?v=LmY_TpU1B5Y<br>https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-BLD-013 | The **energy** category shall contain at least: **wind power (on land)**, **wind power (offshore)**, **coal power plant**, **solar power**, **nuclear power**, plus **waste incineration** as a dual energy/waste entry. | Must | Mobile | yes | QA-BLD-006 | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| FR-BLD-014 | The **water** category shall contain at least: **water tower**, **small water pump**, **big water pump**. | Must | Mobile | yes | QA-BLD-006 | https://www.youtube.com/watch?v=yuLUP_ELk4I |
| FR-BLD-015 | The **food/agriculture** category shall contain at least: **field**, **farm animal enclosure**, **food factory**, and the bonus entries **pole barn**, **windmill**, **silo**. | Must | Mobile | yes | QA-BLD-006 | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-BLD-016 | The **waste** category shall contain at least: **landfill**, **recycling station**, **waste incineration**. | Must | Mobile | yes | QA-BLD-006 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-BLD-017 | The **service** categories shall contain at least: **medical center**, **hospital**, **police station**, **police department**, **fire department**, **elementary school**, **secondary school**, **university**, **bus station**, and the education bonus entries **library** and **art museum**. | Must | Mobile | yes | QA-BLD-006 | https://www.youtube.com/watch?v=4SlxOgZ67MU<br>https://www.youtube.com/watch?v=tFmR_0w1OuQ<br>https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-BLD-018 | The **transit** category shall contain the **monorail** and its **monorail station**; the **decoration** category shall contain non-functional decorative buildings (e.g. the **Space Casino**, beach buildings). | Must | Mobile | yes | QA-BLD-007 | https://www.youtube.com/watch?v=71H1tU2DGz8<br>https://www.reddit.com/r/supercitycon/ |
| FR-BLD-019 | Each entry's category shall determine its shop tab and its grouping in the government overview, whose waste breakdown is by **residential / commercial / industrial / government / farms**. | Must | Mobile | no | QA-BLD-004 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-BLD-020 | The **special / city-upgrade** class shall exist as a distinct purchasable class (the **Citycon Building**, which grants a construction slot; and the purchasable **City upgrades** bought with coins or Super Cash), separate from placeable buildings. | Must | Mobile | no | QA-BLD-008 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.3 The building property schema

> Every field below is a **required key on every catalogue entry** unless explicitly marked optional. `existence` is marked `[CONFIRMED]` only where a cited source shows the property exists in the game; per-entry **values** that are not published are marked `[TBD]` and carry a Section 11 entry. Numeric ranges are the **proposed defaults** (Section 11), not published figures.

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-BLD-021 | Every catalogue entry shall declare a **footprint** (tile width × tile height, both ≥ 1) and a **rotation state** (0/90/180/270). The per-entry footprint values are authored in data and are not published — see OQ-BLD-03. | Must | Both | yes | QA-BLD-009 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-022 | Every catalogue entry shall declare a **tier / level** (integer ≥ 1) and, where applicable, a **tier ladder** naming the levels it can reach. | Must | Mobile | yes | QA-BLD-010 | https://www.youtube.com/watch?v=4SlxOgZ67MU<br>https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-BLD-023 | Every catalogue entry shall declare **residential capacity** (0 for non-residential). The per-entry values are authored in data and are not published — see OQ-BLD-04. | Must | Mobile | yes | QA-BLD-010 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-024 | Every catalogue entry shall declare **job / workspace capacity** (commercial and industrial entries populate it; the game tracks commercial and industrial workspaces separately from residential capacity). | Must | Mobile | yes | QA-BLD-010 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-BLD-025 | Every catalogue entry shall declare the **construction-cost inputs** it contributes (the cost formula itself is owned by `ECO`); the schema shall expose the components, not the final price. | Must | Both | yes | QA-BLD-011 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-BLD-026 | The property schema shall carry an **upkeep** value on every entry (0 where an entry has none). Upkeep is not published anywhere and is not part of the shipped economy, so the field's presence is a design decision. `[TBD — design decision]` — OQ-BLD-05. | Could | Design | yes | QA-BLD-011 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-BLD-027 | Every catalogue entry shall declare **energy production** and **energy consumption** (all buildings and citizens consume energy; production entries populate the production side). | Must | Mobile | yes | QA-BLD-012 | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| FR-BLD-028 | Every catalogue entry shall declare **water production** and **water consumption** (residents, industry and commerce consume water). | Must | Mobile | yes | QA-BLD-012 | https://www.youtube.com/watch?v=yuLUP_ELk4I |
| FR-BLD-029 | Every catalogue entry shall declare **food production** split into the game's three sub-channels — **plant source**, **animal source**, **processed food** — plus food consumption. | Must | Mobile | yes | QA-BLD-012 | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-BLD-030 | Every catalogue entry shall declare **waste production** and **waste removal** (landfill / recycling station / incineration populate removal). | Must | Mobile | yes | QA-BLD-013 | https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-BLD-031 | Every catalogue entry may declare a **coverage radius** and a **coverage capacity** (both required for schools and health-care entries); the geometry and solver are owned by `SRV`. | Must | Mobile | yes | QA-BLD-013 | https://www.youtube.com/watch?v=PifQ_7vj7Ao<br>https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-BLD-032 | Every catalogue entry may declare **culture points**, **entertainment points** and **recreation points** (0 when it carries none); the points engine is owned by `POP`. | Must | Mobile | yes | QA-BLD-014 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-BLD-033 | Every catalogue entry shall declare a **`unique` flag** distinguishing *stackable* point providers (points count **per copy**) from *unique* ones (points count **once per map** — the cinema is the game's example). | Must | Mobile | yes | QA-BLD-014 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-BLD-034 | Every catalogue entry may declare a **wealth level** in the range **1–3** (displayed as one, two or three dollar signs on its card); entries that declare none are **neutral** to the wealth system. | Must | Mobile | yes | QA-BLD-015 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-BLD-035 | **Diversity contribution** shall be **derived, not authored**: every distinct catalogue entry present on the map contributes exactly **1 diversity point**. | Must | Mobile | yes | QA-BLD-015 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-BLD-036 | Every catalogue entry shall declare a **pollution** value (0 when clean); waste incineration is the game's confirmed high-pollution entry. | Must | Mobile | yes | QA-BLD-013 | https://www.youtube.com/watch?v=y5g7xPHzj0A<br>https://www.youtube.com/watch?v=HDjaWySDKOM |
| FR-BLD-037 | Every catalogue entry may declare a **noise** value. Noise is not named in any public source; the field exists for parity with the brief's schema but every value is unevidenced. `[TBD — design decision]` — OQ-BLD-06. | Could | Design | yes | QA-BLD-013 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-038 | Every catalogue entry may declare **traffic generation** (cars) and **pedestrian generation** values; the per-entry values are unevidenced and the agent behaviour is owned by `MOB`. `[TBD — design decision]` — OQ-BLD-07. | Could | Design | yes | QA-BLD-016 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-BLD-039 | Every catalogue entry shall declare an **unlock condition** (a resident-count level threshold, a content-pack purchase, or a timed-event window). | Must | Mobile | yes | QA-BLD-017 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://www.youtube.com/watch?v=y5g7xPHzj0A |
| FR-BLD-040 | Every catalogue entry shall reference an **appearance** record (the voxel model, its architectural style and its palette) so the same entry can be re-rendered identically after a move, an upgrade or a save/load. | Must | Both | yes | QA-BLD-018 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-BLD-041 | Bonus-type entries (silo, windmill, library, art museum) shall declare a **bonus radius / effect area**; the silos' published example is **13 × 13**. | Must | Mobile | yes | QA-BLD-019 | https://www.youtube.com/watch?v=6wWZxnm_YLk<br>https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-BLD-042 | Food entries shall declare whether they require **pole-barn coverage**: fields and animal enclosures "only work when they are within the area of pole barn", while processed/industrial food production does not. | Must | Mobile | yes | QA-BLD-019 | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| FR-BLD-043 | Every catalogue entry shall declare its **content-pack membership** (base / add-on / event / building-of-the-week / chest reward) and the **pack version** it was authored in, so a pack can be loaded, versioned and hot-replaced independently. | Must | Mobile | yes | QA-BLD-020 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732<br>https://www.reddit.com/r/supercitycon/ |
| FR-BLD-044 | Every catalogue entry shall declare **construction slots required** (1 for ordinary entries, **two or more** for larger ones) and the game shall refuse the placement with a "N slots needed" warning when slots are insufficient. | Must | Mobile | yes | QA-BLD-021 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://www.reddit.com/r/supercitycon/ |
| FR-BLD-045 | Every catalogue entry shall declare whether it **requires a road / street connection** to function; placement on "muddy roads" yields a building with no road connection. | Must | Mobile | yes | QA-BLD-022 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |
| FR-BLD-046 | Every catalogue entry shall declare **variants** (cosmetic alternates of the same entry) as an optional list, default empty. The PC store page states the library grows with "different architectural styles"; the older publisher copy recorded in Section 12, entry 22 states "some of them with multiple variations". The live catalogue's variant count is unevidenced. `[TBD — design decision]` — OQ-BLD-08. | Could | Design | yes | QA-BLD-023 | https://store.steampowered.com/app/3474890/SuperCitycon/<br>https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-047 | The schema shall be **serialisable and diffable**: an entry record shall round-trip through save/load without loss, and the PC title's editor shall be able to author against the same field set. | Must | Both | yes | QA-BLD-024 | https://store.steampowered.com/app/3474890/SuperCitycon/ |

### 3.4 Tiers, levels and upgrades

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-BLD-048 | The catalogue shall support entries with **multiple levels** — the game's confirmed examples are the **hospital** ("upgradeable … has multiple levels"), the **recycling station** ("it's … upgradeable") and the **elementary school** (the demo instance was at **level five**). | Must | Mobile | yes | QA-BLD-010 | https://www.youtube.com/watch?v=4SlxOgZ67MU<br>https://www.youtube.com/watch?v=HDjaWySDKOM<br>https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-BLD-049 | An upgrade shall be applied **in place**: the instance keeps its cells and rotation, and only its **tier/level** changes; no building is destroyed and re-created by an upgrade. | Must | Mobile | yes | QA-BLD-025 | https://www.youtube.com/watch?v=4SlxOgZ67MU<br>https://www.reddit.com/r/supercitycon/ |
| FR-BLD-050 | Each tier of an entry shall define its **own property values** — at minimum capacity and coverage area of effect, which grow with level ("secondary schools and the university … have a little bit bigger radius … and they have more capacity"). | Must | Mobile | yes | QA-BLD-026 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-BLD-051 | The number of levels reachable by an entry, and the values at each level, shall be **data on the entry**, not hard-coded per building type. | Must | Mobile | yes | QA-BLD-026 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-BLD-052 | An upgraded instance shall remain **the same catalogue entry** for diversity purposes — upgrading does not create a new diversity point and does not remove the old one. No public source states how an upgrade interacts with the diversity count. `[TBD — design decision]` — OQ-BLD-20. | Could | Design | yes | QA-BLD-027 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-BLD-053 | An upgrade shall not consume an additional **construction slot** and shall not restart the construction timer of an already-finished building. No public source states the upgrade/slot interaction. `[TBD — design decision]` — OQ-BLD-21. | Could | Design | yes | QA-BLD-025 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-054 | The schema shall support a **"upgradeable" flag** so the shop card can show the current level of a placed instance and the next level available. | Must | Mobile | yes | QA-BLD-010 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |

### 3.5 The building shop and the purchases overview

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-BLD-055 | The **building shop** shall list every catalogue entry the player may currently obtain, grouped into category tabs. | Must | Mobile | no | QA-BLD-028 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-056 | A shop card shall show the entry's **display name** and its **key badges** — its wealth level (1–3 dollar signs) when it has one, and its culture / entertainment / recreation icons when it has points. | Must | Mobile | no | QA-BLD-029 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-BLD-057 | A locked entry shall be **visible in the shop** together with the **condition that unlocks it**, rather than being hidden. | Must | Mobile | no | QA-BLD-030 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |
| FR-BLD-058 | The shop shall contain a **storage tab** that is **present only while something is stored**, and which is the place where stored buildings and stored bonus cards are redeemed. | Must | Mobile | yes | QA-BLD-031 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-BLD-059 | A stored building shall render in the shop with a **blue restore button in place of its price / purchase button**; tapping it moves the building back into the inventory. | Must | Mobile | yes | QA-BLD-032 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-BLD-060 | The shop's **purchases overview** shall list the game's non-building purchases: **add-ons**, **Building of the Week**, **Sandbox Constructions**, **Citycon Building**, **speed-up package**, **Piggy Bank**, the free gift and the free-user ad block, plus the free **chests**. | Must | Mobile | no | QA-BLD-033 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-061 | **Add-on** purchases shall be **permanent unlocks** — "you unlock it once you got it forever you can build it as often as you want" — and shall carry no consumable or timed limit. | Must | Mobile | yes | QA-BLD-034 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-062 | The **Building of the Week** shall be a single **rotating weekly unique building**, available **only for that week**; once the week ends the entry is withdrawn, and it "may come back any time in the future but **not soon**". | Must | Mobile | yes | QA-BLD-035 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-063 | The **chests** (free every 4 h and every 24 h) shall grant **collectible parts** and **bonus cards**, and bonus cards shall be storable in the warehouse alongside buildings. | Must | Mobile | yes | QA-BLD-036 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-064 | **Sandbox Constructions** shall set **construction time to zero** and shall allow buildings to be **instantly confirmed when moved**; the default construction timer remains in minutes and continues to progress while the game is closed. | Must | Mobile | yes | QA-BLD-037 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-065 | The shop shall expose the **construction-slot** purchase and the **collect-over-time** grant, and the HUD shall show the player's current slot count. | Must | Mobile | no | QA-BLD-038 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.6 Inventory, storage / warehouse, selling

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-BLD-066 | The **inventory** shall hold every building the player owns but has not placed, and shall be the entry point for both the storage action and the demolition tool. | Must | Mobile | yes | QA-BLD-039 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-BLD-067 | Tapping an inventory entry shall open a menu with a **quantity selector** (when more than one is owned) offering exactly two actions: **put into warehouse** and **sell**. | Must | Mobile | yes | QA-BLD-040 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-BLD-068 | **Selling** shall be **terminal** — the sold building is gone forever and the player receives coins; the transaction shall be irreversible. | Must | Mobile | no | QA-BLD-041 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-BLD-069 | **Storing** shall remove the building from the inventory but **keep it owned**; a stored building shall still be counted by the catalogue and shall still be re-placeable after redemption. | Must | Mobile | yes | QA-BLD-042 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-BLD-070 | The shop's storage tab shall list **both** stored buildings and stored **bonus cards**, and shall let each be redeemed back into the inventory. | Must | Mobile | yes | QA-BLD-043 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-071 | A building card shall display **two counts**: the number owned in the **inventory** and the number **built on the map**. | Must | Mobile | no | QA-BLD-044 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-BLD-072 | The inventory shall **accept a building at any time** the player owns it, not only when "pretty full" — the fullness of the inventory is a nudge, not a gate. | Should | Mobile | yes | QA-BLD-039 | https://www.youtube.com/watch?v=cSRDwHvowWI |

### 3.7 Add-ons, events and content packs

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-BLD-073 | An **add-on** shall be a purchasable, themed **set of building entries** added to the same catalogue, tagged with its pack id (published examples: **Ancient China**, **Amsterdam**). | Must | Mobile | yes | QA-BLD-045 | https://itunes.apple.com/lookup?id=1607860732&country=us<br>https://www.reddit.com/r/supercitycon/ |
| FR-BLD-074 | A **timed event** shall ship themed building and decoration entries for the duration of the event (published example: the **Beach Life Event**, "30 days of sun, sand, and rewards … Lovingly designed Beach Buildings and Decorations"). | Must | Mobile | yes | QA-BLD-046 | https://www.reddit.com/r/supercitycon/ |
| FR-BLD-075 | Content packs shall be **versioned and independently loadable**: adding or replacing a pack shall add or retire catalogue entries without invalidating saves that reference other packs' entries. | Must | Both | yes | QA-BLD-020 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| FR-BLD-076 | Pack membership shall be queryable per entry, so that the game can answer "which pack must I own to build this?" without hard-coded per-building logic. | Must | Mobile | yes | QA-BLD-045 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-077 | The **Building of the Week** shall be modelled as a **rotating pack** whose membership changes on a weekly cadence and whose entries are marked **unique** for diversity purposes. | Must | Mobile | yes | QA-BLD-035 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://www.youtube.com/watch?v=CIb2IWyNPJw |

### 3.8 Placement, connection, edit and move

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-BLD-078 | Placing an entry shall be a **drag from the shop onto the map**, and the ghost shall **snap to the street network**. | Must | Mobile | yes | QA-BLD-047 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-079 | A building placed without a usable road connection shall still be placeable, shall be visibly **unconnected**, and shall not receive the bonuses its connection would grant. | Must | Mobile | yes | QA-BLD-048 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |
| FR-BLD-080 | **Long-pressing a placed building** shall enter **orbit mode** and expose an **edit** action offering **rotate** (and **confirm**). | Must | Mobile | yes | QA-BLD-049 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-081 | **Moving** a placed building shall relocate it to another valid tile set, re-evaluating its road connection, its coverage and its service contribution in the new position. | Must | Mobile | yes | QA-BLD-050 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-082 | The **monorail** entry shall grant **street connection to residential buildings** within its effect area **without streets**, and shall grant it to **residential buildings only** — commercial and industrial buildings are explicitly unaffected. | Must | Mobile | yes | QA-BLD-051 | https://www.youtube.com/watch?v=71H1tU2DGz8 |
| FR-BLD-083 | A **bus station** shall grant school connection to the buildings around it without being adjacent to a school, and shall **deactivate** while school capacity is insufficient, re-activating when capacity rises. | Must | Mobile | yes | QA-BLD-052 | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| FR-BLD-084 | **Rotation** shall be a per-instance property, persisted with the instance, and shall be reapplied identically after a save/load. | Must | Both | yes | QA-BLD-049 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-085 | A placed building shall expose, on its card in orbit mode, the **service-coverage icons** that apply to it (police, fire and the three education levels), **greyed out** when the building is not covered. | Must | Mobile | no | QA-BLD-053 | https://www.youtube.com/watch?v=tFmR_0w1OuQ |

### 3.9 Demolition and the rebuild-in-place loop (the user's core intent)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-BLD-086 | The inventory shall expose a **bulldozer** button; activating it shall present a **three-category chooser** that determines which object classes are demolished when a tile is tapped. | Must | Mobile | yes | QA-BLD-054 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-087 | Demolishing a building shall **release its footprint tiles** back to the map so they can be re-used by another building. | Must | Mobile | yes | QA-BLD-055 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-088 | Demolition shall remove the building's **contribution** to capacity, coverage, points, wealth and diversity on the affected map, and the affected aggregates shall update immediately. | Must | Mobile | yes | QA-BLD-056 | https://www.youtube.com/watch?v=CIb2IWyNPJw<br>https://www.youtube.com/watch?v=4SlxOgZ67MU |
| FR-BLD-089 | **Every** catalogue entry shall be removable and re-placeable — the catalogue shall contain no "place-once" entry. The one candidate exception is the Building of the Week entry, whose post-week treatment is a design decision (see OQ-BLD-09). | Must | Mobile | yes | QA-BLD-057 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-BLD-090 | Add-on buildings, event buildings, Building-of-the-Week buildings and warehouse-stored buildings shall all follow the **same** place → remove → re-place loop as base-catalogue buildings. | Must | Mobile | yes | QA-BLD-058 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://www.youtube.com/watch?v=cSRDwHvowWI |
| FR-BLD-091 | A demolished building shall **return to the inventory** so it can be re-placed, rather than being lost or requiring a re-purchase. `[TBD — design decision]` — OQ-BLD-10. The game exposes a move action and a warehouse, but the public evidence does not state what a bulldozed building becomes. | Could | Design | yes | QA-BLD-059 | https://www.reddit.com/r/supercitycon/ |
| FR-BLD-092 | A **move** shall be distinct from demolish-and-re-place: it shall preserve the instance identity, its tier/level and any accumulated state, and shall not consume a construction slot. `[TBD — design decision]` — OQ-BLD-19. | Could | Design | yes | QA-BLD-060 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-093 | A demolished building shall **not** return any coins by default; refund behaviour is a design decision (OQ-BLD-10) and the game's only published coin-returning disposal action is the explicit **sell** action. `[TBD — design decision]` | Could | Design | yes | QA-BLD-041 | https://www.youtube.com/watch?v=cSRDwHvowWI |

### 3.10 Unlocks and progression gates

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-BLD-094 | The player's **level** shall be a direct function of the **resident amount** on the current map — there are no XP points — and shall be shown in the top bar. | Must | Mobile | no | QA-BLD-061 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-BLD-095 | Reaching a higher level shall **unlock more buildings**, and the unlock threshold shall be evaluated against the current map's resident count. | Must | Mobile | yes | QA-BLD-062 | https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ |
| FR-BLD-096 | An entry's unlock condition shall support at least: **resident-count level threshold**, **content-pack purchase**, and **timed-event window** (the nuclear power plant is the confirmed level-gated production building: "once you unlocked it when your city is big enough"). | Must | Mobile | yes | QA-BLD-017 | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| FR-BLD-097 | A **locked** entry shall be listed in the shop with its unlock condition; unlocking shall be re-evaluated whenever the resident count crosses a threshold, without a restart. | Must | Mobile | no | QA-BLD-030 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.11 Diversity, wealth and point semantics

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-BLD-098 | The **diversity** bonus shall count **1 point per distinct catalogue entry present on the map**, reaching 250 points at 250 distinct entries; which entries are present is irrelevant, only the count of distinct types matters. | Must | Mobile | yes | QA-BLD-063 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-BLD-099 | The game shall apply a **diversity penalty** when more than **8 instances of the same entry type** are present on a map, deducting diversity points to force build diversity. | Must | Mobile | yes | QA-BLD-064 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-BLD-100 | The **wealth** level of a map shall be the **average** of the wealth values of all entries on that map that carry one; entries without a wealth value shall be **excluded** from the average and shall not drag it down. | Must | Mobile | yes | QA-BLD-065 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-BLD-101 | The three wealth levels shall be **1, 2 and 3**, displayed on the card as one, two or three dollar signs; the map's average wealth shall be convertible to the wealth bonus, where **wealth level 3 → the full 250 %** and the published working example **1.65 → 129 %**. | Must | Mobile | yes | QA-BLD-065 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-BLD-102 | The **culture / entertainment / recreation** points shall accumulate at **1 point per 1 000 residents** required, with a **250 %** cap per category, and each category's points shall come only from entries that declare that specific property. | Must | Mobile | yes | QA-BLD-066 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-BLD-103 | A **unique** entry shall contribute its points **once per map** regardless of how many copies are placed; a **stackable** entry shall contribute its points **once per copy**. | Must | Mobile | yes | QA-BLD-067 | https://www.youtube.com/watch?v=CIb2IWyNPJw |

### 3.12 The PC title: SCC Studio, custom buildings and Workshop

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-BLD-104 | The PC title shall use the **same catalogue content model** as the mobile title — building entries reference voxel models from a growing library of architectural styles — so that a mobile catalogue entry can be ported without re-authoring. | Must | PC-EA | yes | QA-BLD-068 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-BLD-105 | The catalogue shall support **custom (player-authored) entries** produced in SCC Studio, which "customize existing buildings … or start from an empty grid and create something new", and such entries shall be placeable in the city like any other entry. | Must | PC-EA | yes | QA-BLD-069 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-BLD-106 | A custom entry that transitions from the editor into the world shall receive an **automatically calculated construction cost and economic impact** — the game "automatically calculates construction costs and economic impact of any building that transitions from the editor into the gameplay environment". | Must | PC-EA | yes | QA-BLD-070 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-BLD-107 | Custom entries shall be publishable to the **Steam Workshop** and re-importable, so that the catalogue is extensible by players. | Must | PC-EA | yes | QA-BLD-069 | https://store.steampowered.com/app/3474890/SuperCitycon/ |

---

## 4. Options, variants & configuration matrix

### 4.1 Catalogue categories → confirmed entries

| Category | Confirmed entries | Notes | Source |
|---|---|---|---|
| Residential | house, apartment, luxury apartment, skyscraper | The skyscraper is the game's named example of the >8-instance diversity penalty. | https://www.reddit.com/r/supercitycon/<br>https://www.youtube.com/watch?v=CIb2IWyNPJw |
| Commercial | commercial workspaces (category named; individual entries not named in a verified source) | Named at category level, not entry level. The game tracks commercial workspaces separately from residential capacity and splits waste between residential / commercial / industrial / government / farms. | https://www.youtube.com/watch?v=LmY_TpU1B5Y<br>https://www.youtube.com/watch?v=HDjaWySDKOM |
| Industrial | industrial areas, food factory | The food factory is the game's only food-industry entry. | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| Energy | wind power (on land), wind power (offshore), coal power plant, solar power, nuclear power | Nuclear is level-gated. | https://www.youtube.com/watch?v=y5g7xPHzj0A |
| Energy + waste | waste incineration | Dual-purpose: removes waste, produces energy, high pollution. | https://www.youtube.com/watch?v=HDjaWySDKOM |
| Water | water tower, small water pump, big water pump | Plus the cross-map **water pipeline** (a connector, not a consumer). | https://www.youtube.com/watch?v=yuLUP_ELk4I |
| Food / agriculture | field, farm animal enclosure, food factory | Two-stage chain: plant → animal → processed. | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| Food bonus | pole barn (enabling), windmill, silo (bonus) | Bonus area example: **13 × 13**. | https://www.youtube.com/watch?v=6wWZxnm_YLk |
| Waste | landfill, recycling station, waste incineration | Recycling station is upgradeable. | https://www.youtube.com/watch?v=HDjaWySDKOM |
| Health care | medical center, hospital | Hospital is upgradeable with multiple levels. | https://www.youtube.com/watch?v=4SlxOgZ67MU |
| Security | police station (small), police department (big) | Decorative + bonus only; no crime system. | https://www.youtube.com/watch?v=tFmR_0w1OuQ |
| Fire | fire department | Covers buildings for a bonus. | https://www.youtube.com/watch?v=0wFTp0aDpQg |
| Education | elementary school, secondary school, university | Three levels; larger radius and capacity as level rises. | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| Education connector | bus station | Grants school connection; deactivates without capacity. | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| Education bonus | library, art museum | Improve education quality. | https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| Transit | monorail, monorail station | Grants street connection to **residential** only. | https://www.youtube.com/watch?v=71H1tU2DGz8 |
| Leisure / recreation | cinema, parks | The cinema is the confirmed **unique** point provider; parks appear as a shop tab and in the publisher's "Construct homes, factories, landmarks, parks". | https://www.youtube.com/watch?v=CIb2IWyNPJw<br>https://www.youtube.com/watch?v=jYAD0SkDmY0<br>https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| Decoration | decoration buildings (incl. Space Casino, beach buildings) | Can be built over by a monorail. | https://www.youtube.com/watch?v=71H1tU2DGz8<br>https://www.reddit.com/r/supercitycon/ |
| Special / city-wide | Citycon Building, City upgrades | Not placeable buildings; grants slots / global modifiers. | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 4.2 Entry archetypes and the properties each must carry

| Archetype | Required properties | Evidence |
|---|---|---|
| Consumer (residential / commercial / industrial) | capacity, energy + water consumption, waste production, road connection required | https://www.youtube.com/watch?v=y5g7xPHzj0A<br>https://www.youtube.com/watch?v=HDjaWySDKOM |
| Producer (power / water / food / waste removal) | production channel, pollution, optional coverage | https://www.youtube.com/watch?v=y5g7xPHzj0A<br>https://www.youtube.com/watch?v=6wWZxnm_YLk |
| Service (police / fire / health / education) | coverage radius + capacity, bonus channel, tier ladder | https://www.youtube.com/watch?v=PifQ_7vj7Ao<br>https://www.youtube.com/watch?v=4SlxOgZ67MU |
| Bonus (silo / windmill / library / art museum) | bonus effect area, affected target set | https://www.youtube.com/watch?v=6wWZxnm_YLk<br>https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| Connector (monorail station / bus station / pipeline / C-wire) | grants connection to a target category; may depend on a capacity elsewhere | https://www.youtube.com/watch?v=71H1tU2DGz8<br>https://www.youtube.com/watch?v=PifQ_7vj7Ao |
| Decoration | no simulation effect; occupies space | https://www.youtube.com/watch?v=71H1tU2DGz8 |
| Unique / one-off (Building of the Week) | unique flag, weekly window | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 4.3 Purchasable options in the shop

| Purchase | Effect | Cadence | Source |
|---|---|---|---|
| Add-on | Permanent unlock of a themed building set | Monthly | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Building of the Week | One unique rotating building | Weekly | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Sandbox Constructions | Zero construction time; instant confirm on move | Permanent | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Citycon Building | One extra permanent construction slot | Permanent | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Speed-up package | Removes the ad-based speed-up button; faster offline construction | Permanent | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| +1 construction slot | One extra slot | Repeatable | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Free chest | Collectible parts + bonus cards | Every 4 h and every 24 h | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| Piggy Bank | Collects Super Cash over time; discounted purchase | Repeatable | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| City upgrades | Global modifiers (water consumption, energy, trash, coin value, coin appearance) | Coins, then Super Cash | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

---

## 5. Stage / progression matrix

| Stage | Entry condition | Player can build | Player can rebuild / modify | Unlocks | Exits when |
|---|---|---|---|---|---|
| **Mobile — Simulation** | Resident count > 0 on the current map | Every entry whose unlock condition is met; entries are placed individually and construct over a short timer measured in minutes that continues while the game is closed. | Long-press → orbit → rotate / move; bulldoze via the inventory; upgrade in place for tiered entries. | Level 1 = house-level starter set; each resident-count level unlocks more buildings; add-ons, event packs and the weekly Building of the Week add entries. | Never — the player switches to Sandbox Construction Mode (same catalogue, instant placement) or into another map of the region. |
| **Mobile — Sandbox Construction Mode** | Mode switch | Every catalogue entry, placed instantly; "Build instantly without delays … no waiting for construction". | Same move / rotate / bulldoze / upgrade loop; **Sandbox Constructions** additionally makes the move confirm instant. | The full catalogue at once — progression gates are bypassed. | The player returns to simulation mode or leaves the app. |
| **PC-EA (Steam 3474890)** | Purchase / demo install | Every building in the "continuously growing library", placed in the **construction sandbox**; no economy or progression gates ship in Early Access. | SCC Studio: customize an existing building's appearance, or author a new model from an empty grid; custom models are placeable and shareable via Steam Workshop. | New architectural styles, buildings, vehicles, citizens and props as the library grows. | More game modes and rule sets are announced but not yet in Early Access. |
| **Design (rebuild decisions, not shipped behaviour)** | — | — | Bulldozed buildings return to the inventory; demolition refunds are zero by default; upgrades never change footprint. | — | — |

---

## 6. Data model

Entity → field → type → range → meaning → source. `existence` is `[CONFIRMED]` where a source shows the property in the game; `value` is `[TBD]` where the number is not published (see Section 11 for proposed defaults).

| Entity | Field | Type | Range | Meaning | Existence |
|---|---|---|---|---|---|
| `BuildingDefinition` | `id` | string | unique, stable | Primary key; survives packs and saves | [CONFIRMED] |
| | `displayName` | string | 1–64 chars | Name on the shop / inventory card | [CONFIRMED] |
| | `categoryId` | enum | 18 categories (§3.2) | Owning shop tab and government grouping | [CONFIRMED] |
| | `archetypeId` | enum | consumer, producer, service, bonus, connector, decoration, unique | Selects which property groups are meaningful | [INFERRED] from the archetypes in §4.2 |
| | `footprint` | object {w,h} | w,h ≥ 1 tiles | Tiles the entry occupies | [CONFIRMED] existence, values [TBD] |
| | `rotationStates` | int | 1–4 | Distinct rotations the model supports | [CONFIRMED] |
| | `tierLadder` | array of tier objects | 1–N tiers | Per-tier property overrides | [CONFIRMED] |
| | `residentialCapacity` | int | ≥ 0 | Residents housed | [CONFIRMED] existence, values [TBD] |
| | `jobCapacity` | int | ≥ 0 | Commercial / industrial workspaces provided | [CONFIRMED] existence, values [TBD] |
| | `costInputs` | object | per component | Inputs to the `ECO` cost formula | [CONFIRMED] |
| | `upkeep` | int | ≥ 0 (currency/minute) | Recurring cost | [TBD] — OQ-BLD-05 |
| | `energyProduction` / `energyConsumption` | int | ≥ 0 | Net energy per minute | [CONFIRMED] |
| | `waterProduction` / `waterConsumption` | int | ≥ 0 | Net water per minute | [CONFIRMED] |
| | `foodProduction` | object {plant, animal, processed} | each ≥ 0 | Food output by the game's three channels | [CONFIRMED] |
| | `foodConsumption` | int | ≥ 0 | Food drawn by residents / industry | [CONFIRMED] |
| | `wasteProduction` / `wasteRemoval` | int | ≥ 0 | Waste created / removed per minute | [CONFIRMED] |
| | `coverage` | object {radiusTiles, capacity, shape} | radius ≥ 0, capacity ≥ 0 | Area of effect and service capacity; geometry owned by `SRV` | [CONFIRMED] |
| | `points` | object {culture, entertainment, recreation} | each ≥ 0 | Growth-bonus points; owned by `POP` | [CONFIRMED] |
| | `unique` | bool | true/false | Points count once per map when true, once per copy when false | [CONFIRMED] |
| | `wealthLevel` | int or null | 1–3 or absent | Dollar-sign badge; absent = neutral | [CONFIRMED] |
| | `pollution` | int | ≥ 0 | Pollution emitted | [CONFIRMED] |
| | `noise` | int | ≥ 0 | Noise emitted | [TBD] — OQ-BLD-06 |
| | `greenEnergy` | bool | true/false | Whether production counts toward the green-energy figure | [CONFIRMED] |
| | `trafficGeneration` | int | ≥ 0 | Cars generated | [TBD] — OQ-BLD-07 |
| | `pedestrianGeneration` | int | ≥ 0 | Pedestrians generated | [TBD] — OQ-BLD-07 |
| | `constructionSlotsRequired` | int | ≥ 1 | Slots consumed while constructing | [CONFIRMED] |
| | `requiresRoadConnection` | bool | true/false | Whether the entry needs a street connection to function | [CONFIRMED] |
| | `bonusArea` | object {radiusTiles, targets[]} | radius ≥ 0 | Effect area of a bonus entry (silo, windmill, library, art museum) | [CONFIRMED] (13 × 13 published for silos) |
| | `requiresPoleBarnCoverage` | bool | true/false | Fields and animal enclosures only work inside a pole-barn area | [CONFIRMED] |
| | `unlock` | object | {kind: level, pack, eventWindow} + params | How the entry becomes obtainable | [CONFIRMED] |
| | `appearance` | object | {modelId, styleId, paletteId} | Voxel model and architectural style | [CONFIRMED] |
| | `variants` | array | 0–N | Cosmetic alternates | [TBD] — OQ-BLD-08 |
| | `contentPack` | object {packId, packVersion, packKind} | — | base, add-on, event, building-of-the-week, chest | [CONFIRMED] |
| `BuildingInstance` | `defId` | string | FK → definition | Which entry this instance is | [CONFIRMED] |
| | `cells` | array of {x,y} | non-empty, contiguous | Tiles occupied on the current map | [CONFIRMED] |
| | `rotation` | int | 0–3 | Current rotation | [CONFIRMED] |
| | `tier` | int | ≥ 1 | Current tier / level | [CONFIRMED] |
| | `constructionState` | enum | idle, constructing, done | Construction progress; instant under Sandbox Constructions | [CONFIRMED] |
| | `builtCount` | int | ≥ 0 | Copies of this entry built on the map (diversity / duplicate cap) | [CONFIRMED] |
| | `storageState` | enum | inInventory, inWarehouse | Where an owned, unplaced copy lives | [CONFIRMED] |
| | `ownedCount` | int | ≥ 0 | Copies owned in inventory | [CONFIRMED] |
| `ContentPack` | `packId` / `packVersion` / `packKind` / `entries[]` / `window` | object | — | An independently versioned set of entries; `window` marks the weekly / event availability | [CONFIRMED] |

---

## 7. Rules, formulas & tuning

1. **Diversity** = 1 point per **distinct catalogue entry present on the map**; 250 points = 250 distinct entries → the 250 % cap. Present count, not weighted. (https://www.youtube.com/watch?v=CIb2IWyNPJw)
2. **Diversity penalty** — more than **8 instances of the same entry type** on a map deducts diversity points. The penalty magnitude is not published → OQ-BLD-11. (https://www.youtube.com/watch?v=CIb2IWyNPJw)
3. **Wealth** — `wealthLevel(map) = average(wealthLevel of every entry on the map that has one)`; entries without a wealth value are excluded. `wealthLevel 3 → 250 %`. Published working example: **1.65 → 129 %**. The interpolation between levels is therefore monotonic from 1 → 3 but its exact curve is not published → OQ-BLD-12. (https://www.youtube.com/watch?v=CIb2IWyNPJw)
4. **Points** — each of culture / entertainment / recreation needs **1 point per 1 000 residents** to reach its **250 %** cap. Stackable entries contribute per copy; `unique` entries contribute once per map. (https://www.youtube.com/watch?v=CIb2IWyNPJw)
5. **Resident bonus** = the sum of the six categories (culture, entertainment, recreation, wealth, diversity, loyalty); it scales **residential capacity and workspaces in parallel**. The bonus arithmetic is owned by `POP`. (https://www.youtube.com/watch?v=CIb2IWyNPJw)
6. **Tiers** — each tier defines its own capacity and coverage area of effect; both grow with level (elementary → secondary → university: bigger radius, more capacity). Values per tier are `[TBD]` → OQ-BLD-13. (https://www.youtube.com/watch?v=PifQ_7vj7Ao)
7. **Bonus areas** — a bonus entry affects the entries inside its effect area; the published example is **13 × 13** for silos and windmills, and bonus buildings **do not** affect industrial/processed food production. (https://www.youtube.com/watch?v=6wWZxnm_YLk)
8. **Pole-barn coverage** — a field or animal enclosure only produces inside a pole-barn area. (https://www.youtube.com/watch?v=6wWZxnm_YLk)
9. **Unlocks** — level is `f(residentCount)` with no XP; higher levels unlock more buildings; a production building (nuclear power) is confirmed to be gated on city size. (https://www.youtube.com/watch?v=jYAD0SkDmY0)
10. **Storage / redemption** — storing removes the copy from the inventory but keeps it owned; the shop's storage tab shows a **restore** button instead of a price; the restore button returns the copy to the inventory. The tab is hidden while empty. (https://www.youtube.com/watch?v=cSRDwHvowWI)
11. **Selling** — terminal, yields coins. (https://www.youtube.com/watch?v=cSRDwHvowWI)
12. **Demolition refunds** — the published disposal actions are *sell* (coins) and *store* (keeps the building). What a **bulldozed** building yields is not published → FR-BLD-091 / FR-BLD-093 are design decisions with OQ-BLD-10. (https://www.youtube.com/watch?v=jYAD0SkDmY0)
13. **Construction slots** — start at **1**; each **Citycon Building** adds a permanent slot; slots are also purchasable and collectable over time; entries declare how many they need (larger entries need **two or more**). (https://www.youtube.com/watch?v=jYAD0SkDmY0)
14. **Building-of-the-Week** — one rotating unique entry per week; withdrawn when the week ends; may return later but "not soon". (https://www.youtube.com/watch?v=jYAD0SkDmY0)
15. **Add-ons** — permanent unlocks; unlimited placement. (https://www.youtube.com/watch?v=jYAD0SkDmY0)

---

## 8. Edge cases, failure modes & required behaviours

| # | Case | Required behaviour |
|---|---|---|
| E1 | Placement on a road with no usable connection ("muddy roads") | The building is placed but has **no road connection**; it must not receive connection-dependent bonuses. (https://www.youtube.com/watch?v=jYAD0SkDmY0) |
| E2 | Placement while construction slots are insufficient | The placement is refused with a "**N slots needed**" warning naming the requirement. (https://www.youtube.com/watch?v=jYAD0SkDmY0, https://www.reddit.com/r/supercitycon/) |
| E3 | Bulldozer active with a category deselected | Tapping an object of a deselected category must **not** demolish it; the three-category chooser is the only filter. (https://www.youtube.com/watch?v=jYAD0SkDmY0) |
| E4 | Moving a building onto an invalid or disconnected tile | The move must be validated against the same rules as a fresh placement (connection, slots, overlap). (https://www.youtube.com/watch?v=jYAD0SkDmY0) |
| E5 | Storage empty | The storage tab must **not appear** in the shop. (https://www.youtube.com/watch?v=jYAD0SkDmY0) |
| E6 | Stored building that the player also owns in the inventory | The shop card shows the stored copy with a **restore** button while still showing the price for an owned copy; the two counts (inventory vs built) are independent. (https://www.youtube.com/watch?v=cSRDwHvowWI) |
| E7 | Selling a building that is placed on the map | The sell action applies to the **inventory copy**; the placed instance is untouched. (https://www.youtube.com/watch?v=cSRDwHvowWI) |
| E8 | More than 8 copies of one entry type | The diversity penalty applies; the player is pushed toward build diversity. (https://www.youtube.com/watch?v=CIb2IWyNPJw) |
| E9 | A `unique` entry placed several times | Points are counted **once** for the map. (https://www.youtube.com/watch?v=CIb2IWyNPJw) |
| E10 | An entry with no wealth value on a wealthy map | It is **excluded** from the average — it neither raises nor lowers the map's wealth level. (https://www.youtube.com/watch?v=CIb2IWyNPJw) |
| E11 | School capacity below demand | **Bus stations deactivate** and stop granting school connection; they reactivate when capacity rises. (https://www.youtube.com/watch?v=PifQ_7vj7Ao) |
| E12 | Education capacity full but coverage incomplete | The game distinguishes **capacity** from **local coverage**; a city can be capacity-complete and still leave residents unserved. Both numbers must be shown. (https://www.youtube.com/watch?v=PifQ_7vj7Ao) |
| E13 | Waste incineration in a residential area | It is legal but creates **a lot of pollution**; the game tells the player to place it in industrial areas. (https://www.youtube.com/watch?v=HDjaWySDKOM) |
| E14 | Monorail over an occupied decoration tile | The monorail may be built there and the tile then also provides connection to the traffic system. (https://www.youtube.com/watch?v=71H1tU2DGz8) |
| E15 | Monorail near commercial / industrial buildings | Those buildings are **not** connected by the monorail — the effect is residential-only. (https://www.youtube.com/watch?v=71H1tU2DGz8) |
| E16 | Building of the Week week ends while the entry is placed | The placed instance must remain (removing a placed building on a timer would be hostile); only the **shop entry** is withdrawn. This reading is a design decision → OQ-BLD-09. |
| E17 | Add-on purchased twice | The purchase must be idempotent — it is a permanent unlock, not a consumable. (https://www.youtube.com/watch?v=jYAD0SkDmY0) |
| E18 | Content pack version replaced by a monthly update | Existing save references must keep resolving; entries must not be renumbered or re-used. (https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732) |
| E19 | Saving and reloading a city | The catalogue count, per-instance cells, rotation, tier and ownership counts must be restored identically. (https://www.youtube.com/watch?v=jYAD0SkDmY0) |
| E20 | A building whose only copy is in the warehouse and the player places a different copy | The stored copy must remain owned and restorable; counts shown on the card must stay accurate. (https://www.youtube.com/watch?v=cSRDwHvowWI) |

---

## 9. Non-functional requirements

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| NFR-BLD-001 | A catalogue entry shall be **addable without an engine change**: shipping a new definition record plus its model shall be sufficient to make a building purchasable and placeable. | Must | Both | yes | QA-BLD-001 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| NFR-BLD-002 | The catalogue shall **load in packs**, so that adding a monthly content pack must not require reloading or rebuilding the whole catalogue, and the already-loaded catalogue must remain usable during the load. | Must | Both | yes | QA-BLD-002 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| NFR-BLD-003 | The shop shall render its category tabs and card list without stalling the simulation: browsing the catalogue with **300+ entries** shall not drop a frame below the project's frame budget while the city keeps running. | Must | Mobile | no | QA-BLD-028 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-BLD-004 | Placing, moving, rotating, upgrading or demolishing a building shall update the map's derived aggregates (capacity, coverage, points, wealth, diversity, pollution) **within one simulation frame**, so the HUD and the demand/usage bars never show a stale value. | Must | Mobile | yes | QA-BLD-056 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| NFR-BLD-005 | Catalogue reads (count, category listing, unlock evaluation) shall be **O(entries)** or better and shall be cacheable; the per-frame path shall not scan all 300+ definitions. | Must | Both | no | QA-BLD-001 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| NFR-BLD-006 | The catalogue shall be **data-only** — definitions, tier ladders, unlock conditions, point values, coverage values and content-pack membership shall live in serialisable data, with no per-building code branches. | Must | Both | yes | QA-BLD-003 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| NFR-BLD-007 | A save file shall store the **catalogue version** alongside the city, and loading a city against a catalogue that has since gained or lost a pack shall degrade gracefully (unknown entry → a documented placeholder) rather than corrupting the save. | Must | Both | yes | QA-BLD-024 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| NFR-BLD-008 | The property schema shall be **versioned per entry**, so that a monthly content update can add a field without invalidating entries authored for the previous version. | Must | Both | yes | QA-BLD-024 | https://www.reddit.com/r/supercitycon/ |
| NFR-BLD-009 | The catalogue shall support **at least 10 000 entries** without degrading shop performance, so that the "continuously growing library" and Workshop imports remain viable. | Should | Both | yes | QA-BLD-003 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| NFR-BLD-010 | Every catalogue entry shall have a **stable thumbnail/model reference** that renders identically across sessions, so that the shop, the inventory and the map show the same building for the same id. | Must | Both | yes | QA-BLD-018 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| NFR-BLD-011 | The **storage / warehouse** shall be bounded and shall refuse new deposits with an explicit message when full, rather than silently discarding a building the player owns. | Must | Mobile | yes | QA-BLD-042 | https://www.youtube.com/watch?v=cSRDwHvowWI |
| NFR-BLD-012 | The catalogue and shop shall be **fully usable without network access** once content packs are downloaded; the game is an offline-playable city builder and the catalogue shall never require a live server to browse or place a building. | Should | Both | no | QA-BLD-001 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

---

## 10. Acceptance-criteria suites

| ID | Given | When | Then | Covers |
|---|---|---|---|---|
| QA-BLD-001 | A freshly installed game with the base content pack | The player opens the building shop and reads the catalogue size | The count shown equals the number of loaded definition records and is at least 300; it is not a hard-coded marketing string | FR-BLD-002, FR-BLD-003, FR-BLD-008, NFR-BLD-005 |
| QA-BLD-002 | A monthly content update that ships a new pack | The update is applied and the shop is reopened | The new pack's entries are listed alongside the old ones and the catalogue count has increased; no code change was required | FR-BLD-004, FR-BLD-005, NFR-BLD-002 |
| QA-BLD-003 | A catalogue with one entry added by hand | The developer inspects that entry's record | The record has a unique id, a display name, a category, a footprint, a tier, properties, an unlock condition, an appearance reference and a content-pack tag | FR-BLD-006, FR-BLD-007, FR-BLD-047, NFR-BLD-006, NFR-BLD-009 |
| QA-BLD-004 | The full catalogue loaded | The player opens the shop and walks the category tabs | Every category in §3.2 has a tab, each entry sits in exactly one tab, and the waste category sits at the lower end of the list | FR-BLD-009, FR-BLD-010, FR-BLD-019 |
| QA-BLD-005 | The residential, commercial and industrial categories | The player filters by each and reads the entries | Residential shows house, apartment, luxury apartment and skyscraper; commercial and industrial are distinct categories with their own entries | FR-BLD-011, FR-BLD-012 |
| QA-BLD-006 | The energy, water, food, waste, health, police, fire and education categories | The player opens each category in turn | Each contains the entries named in §4.1 — including both wind power variants, all three water supply buildings, the pole barn/windmill/silo bonus set, both police sizes and all three school levels | FR-BLD-013, FR-BLD-014, FR-BLD-015, FR-BLD-016, FR-BLD-017 |
| QA-BLD-007 | The transit and decoration categories | The player opens them | Monorail and monorail station are present in transit; decorative entries such as the Space Casino are present and are not offered a production or coverage value | FR-BLD-018 |
| QA-BLD-008 | The purchases overview in the shop | The player scrolls the overview | Add-ons, Building of the Week, Sandbox Constructions, Citycon Building, speed-up package, Piggy Bank, free gift, free-user ad block and the free chests are all listed as distinct purchases | FR-BLD-020, FR-BLD-060 |
| QA-BLD-009 | A catalogue entry whose footprint is 2 × 3 | The player places it and rotates it | The ghost occupies 2 × 3 tiles, snaps to the street network, and rotation produces the four declared orientations | FR-BLD-021 |
| QA-BLD-010 | A hospital, a recycling station and an elementary school | The player inspects each entry's tier ladder | Each exposes its own levels, and the hospital shows more than one level with its level-specific capacity and area of effect | FR-BLD-022, FR-BLD-023, FR-BLD-024, FR-BLD-048, FR-BLD-054 |
| QA-BLD-011 | A building entry with a declared cost | The player purchases it and the developer inspects the charge | The charge equals the `ECO` cost formula applied to the entry's cost inputs, and an entry with zero upkeep adds no recurring charge | FR-BLD-025, FR-BLD-026 |
| QA-BLD-012 | A power plant, a water tower and a field | The player inspects each entry's resource fields | The plant carries energy production, the tower water production, the field plant-source food production, and every building carries non-zero consumption for the resources it uses | FR-BLD-027, FR-BLD-028, FR-BLD-029 |
| QA-BLD-013 | A landfill, an incinerator, an elementary school and a cinema | The player inspects each entry | The incinerator carries high pollution and waste removal, the school a coverage radius and capacity, the cinema entertainment points and the `unique` flag | FR-BLD-030, FR-BLD-031, FR-BLD-036, FR-BLD-037 |
| QA-BLD-014 | A cinema and a stackable point building | The player places two cinemas and two stackable buildings | The cinema contributes its points once for the map; the stackable building contributes twice | FR-BLD-032, FR-BLD-033, FR-BLD-103 |
| QA-BLD-015 | A map holding a wealth-1 entry, a wealth-3 entry and an entry with no wealth value | The player reads the map's wealth level and diversity points | The wealth level is the average of only the two entries that carry a wealth value; each distinct entry present contributes exactly one diversity point | FR-BLD-034, FR-BLD-035, FR-BLD-098, FR-BLD-100, FR-BLD-101 |
| QA-BLD-016 | A residential and an office entry | The player inspects their traffic and pedestrian fields | Both fields are present on every entry and are queryable by the traffic and pedestrian systems | FR-BLD-038 |
| QA-BLD-017 | A locked entry and an unlocked entry | The player opens the shop | The locked entry is visible with the condition that unlocks it, and the unlocked entry is purchasable | FR-BLD-039, FR-BLD-096, FR-BLD-097 |
| QA-BLD-018 | A placed house | The player saves, reloads and looks at the house | The house renders identically, with the same appearance reference, footprint, rotation and tier | FR-BLD-040, NFR-BLD-010 |
| QA-BLD-019 | A silo and a pole barn | The player taps each in Science View | The silo's 13 × 13 bonus area is highlighted and covers only fields and animal enclosures; the pole barn's area covers the fields and enclosures that depend on it | FR-BLD-041, FR-BLD-042 |
| QA-BLD-020 | A monthly pack and a base-pack entry | The developer inspects both records | Each names its pack id and pack version, and the pack can be loaded or replaced without touching the other | FR-BLD-043, FR-BLD-075 |
| QA-BLD-021 | A player holding one construction slot | The player drags a large entry that requires two slots | The placement is refused and a warning states that 2 slots are needed | FR-BLD-044 |
| QA-BLD-022 | A player placing a building on a muddy road | The placement completes | The building sits on the map but shows no road connection and gains no connection-dependent bonus | FR-BLD-045, FR-BLD-079 |
| QA-BLD-023 | An entry with declared variants | The player opens its shop card | The card offers the declared variants and each variant renders as a distinct appearance of the same entry id | FR-BLD-046 |
| QA-BLD-024 | A city saved against a catalogue version | The catalogue is updated and the city is loaded | The city loads, the catalogue version is recorded, and entries introduced by the update are available | FR-BLD-047, NFR-BLD-007, NFR-BLD-008 |
| QA-BLD-025 | A hospital at level 1 | The player upgrades it to level 2 | The hospital stays on the same tiles with the same rotation, its tier reads 2, and its capacity and coverage area grow to the level-2 values | FR-BLD-049, FR-BLD-053 |
| QA-BLD-026 | An elementary school, a secondary school and a university | The player compares their tiers | The higher tier has a larger area of effect and a larger capacity, and the values come from data rather than from hard-coded type logic | FR-BLD-050, FR-BLD-051 |
| QA-BLD-027 | A skyscraper and an ordinary house on one map | The player reads the diversity count | Both contribute one diversity point each; upgrading either does not add or remove a diversity point | FR-BLD-052 |
| QA-BLD-028 | 300+ entries loaded and a running city | The player scrolls the shop's category tabs | The list scrolls smoothly while the simulation continues at the target frame rate | FR-BLD-055, NFR-BLD-003 |
| QA-BLD-029 | A beach-level residential entry and a cinema | The player reads their shop cards | The card shows the wealth badge (one, two or three dollar signs) where the entry has a wealth level, and the culture / entertainment / recreation icon where the entry has points | FR-BLD-056 |
| QA-BLD-030 | An entry gated behind a level threshold | The player raises the resident count past the threshold | The entry becomes purchasable without restarting the game | FR-BLD-057, FR-BLD-097 |
| QA-BLD-031 | An empty storage | The player opens the shop | No storage tab is shown | FR-BLD-058 |
| QA-BLD-032 | One building stored in the warehouse | The player opens the shop's storage tab | The building is listed with a blue restore button in place of its price, and tapping it returns the copy to the inventory | FR-BLD-059 |
| QA-BLD-033 | A purchased add-on | The player reopens the purchases overview and buys the same add-on again | The add-on remains a single permanent unlock and the purchase cannot be duplicated | FR-BLD-060, FR-BLD-061 |
| QA-BLD-034 | An unlocked add-on | The player builds two houses from it | Both are placed successfully and the add-on can never be consumed by building | FR-BLD-061, FR-BLD-073 |
| QA-BLD-035 | A city in the middle of a Building-of-the-Week week | The player opens the shop, then the week ends | During the week the unique entry is purchasable; after the week it is withdrawn from the shop | FR-BLD-062, FR-BLD-077 |
| QA-BLD-036 | A free chest | The player redeems it | The player receives collectible parts and bonus cards, and the cards can be deposited into the warehouse | FR-BLD-063 |
| QA-BLD-037 | A player without Sandbox Constructions, then one with it | The player moves a building in each case | Without it the move confirms after the construction timer; with it the move confirms instantly and construction time is zero | FR-BLD-064 |
| QA-BLD-038 | A player with one construction slot who buys a Citycon Building | The player checks the HUD | The slot count rises by one and stays one higher permanently | FR-BLD-065 |
| QA-BLD-039 | An owned but unplaced building | The player opens the inventory | The building is listed in the inventory, which is also where the bulldozer button lives | FR-BLD-066, FR-BLD-072 |
| QA-BLD-040 | Two copies of the same building in the inventory | The player taps the entry | A menu opens with a quantity selector and exactly two actions — store to warehouse, or sell | FR-BLD-067 |
| QA-BLD-041 | A building in the inventory | The player sells it | The building leaves the inventory permanently, the player receives coins, and the building cannot be recovered | FR-BLD-068, FR-BLD-093 |
| QA-BLD-042 | A building placed into the warehouse | The player opens the inventory and then the shop storage tab | The building is absent from the inventory, still owned, and appears in the storage tab ready to restore | FR-BLD-069, NFR-BLD-011 |
| QA-BLD-043 | Bonus cards in the warehouse | The player opens the storage tab | Both the stored buildings and the stored bonus cards are listed and each can be redeemed | FR-BLD-070 |
| QA-BLD-044 | A building owned in the inventory and also built twice on the map | The player reads its card | The card shows the inventory count and the built count as two separate numbers | FR-BLD-071 |
| QA-BLD-045 | The Ancient China or Amsterdam add-on | The player inspects a building from that pack | The entry names the add-on pack it belongs to, and the entry is only obtainable once the pack is owned | FR-BLD-073, FR-BLD-076 |
| QA-BLD-046 | A timed Beach-style event running | The player opens the shop | The event's buildings and decorations are listed for the event's duration and are withdrawn afterwards | FR-BLD-074 |
| QA-BLD-047 | A building entry in the shop | The player drags it onto the map | The ghost follows the pointer and snaps to the street network as it moves | FR-BLD-078 |
| QA-BLD-048 | A building placed without a road connection | The player reads its bonus indicators | It shows no road-connection badge and receives none of the connection-dependent bonuses | FR-BLD-079 |
| QA-BLD-049 | A placed building | The player long-presses it and taps Edit | Orbit mode is entered and the edit control offers rotate and confirm | FR-BLD-080, FR-BLD-084 |
| QA-BLD-050 | A placed building | The player moves it to another tile | It relocates, its connection and coverage are recomputed, and its contribution moves with it | FR-BLD-081 |
| QA-BLD-051 | A monorail station next to residential, commercial and industrial buildings | The player checks their connections in Science View | Only the residential buildings receive street connection from the monorail | FR-BLD-082 |
| QA-BLD-052 | A bus station placed away from any school, with insufficient school capacity | The player checks the school overlay | The bus station is shown as deactivated and grants no school connection; when capacity rises it reactivates | FR-BLD-083 |
| QA-BLD-053 | A building covered by police, fire and education, and one uncovered | The player long-presses each and reads the icons | The covered building's police, fire and three education icons are lit; the uncovered building's are greyed out | FR-BLD-085 |
| QA-BLD-054 | The inventory with the bulldozer inactive | The player activates it | Three categories are offered and can be toggled independently | FR-BLD-086 |
| QA-BLD-055 | A 2 × 3 building occupying six tiles | The player bulldozes it | All six tiles are released and another building can be placed across them | FR-BLD-087 |
| QA-BLD-056 | A city with a covered cinema and a skyscraper | The player bulldozes the cinema and reads the map's wealth, diversity and capacity figures | The cinema's points, its diversity point and its wealth contribution are removed immediately and the HUD updates without a frame of stale data | FR-BLD-088, NFR-BLD-004 |
| QA-BLD-057 | Every entry in the catalogue | The developer places, removes and re-places each one | Every entry can be placed, removed and placed again; no entry is place-once-only | FR-BLD-089 |
| QA-BLD-058 | A building from an add-on, an event building, a Building-of-the-Week building and a warehouse-restored building | The developer places, removes and re-places each | All four behave identically through the same loop | FR-BLD-090 |
| QA-BLD-059 | A bulldozed building | The developer checks the inventory | Under the design decision the building reappears in the inventory and can be placed again without a repurchase | FR-BLD-091 |
| QA-BLD-060 | A moved building that had been upgraded | The developer inspects it after the move | It keeps its tier, its level and its identity; no construction slot is consumed | FR-BLD-092 |
| QA-BLD-061 | A map with a resident count | The player reads the level in the top bar | The level equals the resident count's derived level, and there is no XP bar | FR-BLD-094 |
| QA-BLD-062 | A map whose resident count crosses a level threshold | The player opens the shop | Newly unlocked buildings are purchasable immediately | FR-BLD-095 |
| QA-BLD-063 | A map holding 30 distinct entry types | The player reads the diversity bonus | The diversity figure is 30 points, one per distinct type | FR-BLD-098 |
| QA-BLD-064 | A map holding nine copies of one skyscraper type | The player reads the diversity bonus | A diversity penalty is applied and the diversity points are lower than the raw distinct-type count | FR-BLD-099 |
| QA-BLD-065 | A map holding a wealth-1 entry, a wealth-3 entry and an entry with no wealth value | The player reads the wealth level and the wealth bonus | The wealth level is the average of the two entries that carry a value, and a level of 3 yields the full 250 % bonus | FR-BLD-100, FR-BLD-101 |
| QA-BLD-066 | A map with 10 000 residents and a culture-point building worth 10 points | The player reads the culture bonus | The 10 points satisfy 1 point per 1 000 residents and the category's bonus is at its 250 % cap | FR-BLD-102 |
| QA-BLD-067 | Two cinemas and two stackable culture buildings on one map | The player reads the culture bonus | The cinemas contribute once between them; the stackable buildings contribute twice | FR-BLD-103 |
| QA-BLD-068 | A mobile catalogue entry ported to the PC content model | The developer loads it in the PC title | The entry loads unchanged and its model renders from the same appearance reference | FR-BLD-104 |
| QA-BLD-069 | A model authored in SCC Studio | The developer places it in the city and publishes it | The custom model is placeable like any catalogue entry and is listed in the Workshop for others to import | FR-BLD-105, FR-BLD-107 |
| QA-BLD-070 | A custom model authored in SCC Studio | The developer places it and reads the resulting cost | The game computes the construction cost and the economic impact of the custom model automatically and applies them | FR-BLD-106 |

---

## 11. Open questions & TBDs

| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| OQ-BLD-01 | What is the **authoritative catalogue size**? The live App Store and Google Play listings both say "over 300" / "300+"; the older publisher copy said "over 150"; a brief note records an iOS revision saying "180+", which could not be re-verified on the live listing. | The count is the single most quoted catalogue fact and it changes every release. | Ship the live derived count (≥ 300) in the UI and record the marketing figures only as historical; do not assert 180+. |
| OQ-BLD-02 | Does a catalogue entry carry **cosmetic variants** in the shipped game? The older publisher copy says "some of them with multiple variations"; the live listings say only "300+ unique structures". | Variants change the data model (one id → many appearances) and the diversity rule. | Support an optional `variants[]` array; default empty. Treated as a design decision in FR-BLD-046. |
| OQ-BLD-03 | What are the **footprints** (tile w × h) of each entry? | Footprints decide grid fit, road snapping and the construction-slot threshold. | Default 1 × 1 for houses, 2 × 2 for shops, 3 × 2 for small production, 3 × 3 for power plants and the hospital; every value authored in data. Treated as a design decision in FR-BLD-021. |
| OQ-BLD-04 | What are the **residential capacity and job capacity** per entry and per tier? | They drive the demand bars and the whole population model. | House 4, apartment 16, luxury apartment 40, skyscraper 120; shop 6, factory 24; scale per tier by ×1.5. Placeholders only. |
| OQ-BLD-05 | Does a building carry a recurring **upkeep**? No public source names one. | Upkeep is a permanent income/expense stream and must not be invented silently. | `upkeep: 0` for every entry unless `ECO` defines otherwise; the field exists so the value can be set later. |
| OQ-BLD-06 | Does the game model **noise** at all? | The brief's schema lists noise; no source mentions it. | Field present, value 0 for all entries until `POP`/`ECO` define a noise model. |
| OQ-BLD-07 | What are the per-entry **traffic and pedestrian generation** values? | Traffic volume is the main `MOB` input from the catalogue. | 0 for decoration, 1–3 for houses, scaled by capacity for commercial and industrial; placeholder values only. |
| OQ-BLD-08 | What is the **variant count** per entry and does a variant count as a distinct type for diversity? | Affects the diversity count and the ">8 of a type" penalty. | Variants do **not** create new diversity points; default one variant per entry. |
| OQ-BLD-09 | What happens to a **Building-of-the-Week** entry that is still placed when the week ends? | The entry is withdrawn from the shop; the placed instance is not covered by any source. | Keep the placed instance alive and fully functional; only the shop entry is withdrawn. Treated as a design decision in FR-BLD-089 / E16. |
| OQ-BLD-10 | What does a **bulldozed** building become — inventory, storage, or scrap with a refund? | The user's core intent is that everything can be rebuilt; the game's only published disposal-with-value action is *sell*. | Bulldozed buildings return to the **inventory** (no coins); selling remains the explicit, coin-paying disposal. Treated as a design decision in FR-BLD-091 / FR-BLD-093. |
| OQ-BLD-11 | What is the **magnitude** of the diversity penalty for exceeding 8 instances of a type? | The rule exists; the numbers do not. | −1 diversity point per excess instance beyond 8, floored at 0. Placeholder. |
| OQ-BLD-12 | What is the **wealth-level → bonus** interpolation between levels 1 and 3? | Only the two anchors are published (1.65 → 129 %, 3 → 250 %). | Linear from 0 % at level 1 to 250 % at level 3; verify against the published 1.65 → 129 % anchor. |
| OQ-BLD-13 | What are the **per-tier capacity and coverage values** for each upgradeable entry? | Upgrades are in place; the values at each level decide whether an upgrade is worth it. | Hospital L1 = 2 × 2 footprint, capacity 40 000, radius 14; +25 % capacity and +2 tiles per level. Placeholders only. |
| OQ-BLD-14 | What is the **exact storage / warehouse capacity**? | The game says storage is for when the inventory is "pretty full"; no number is given. | 500 distinct entries, each with a stack count; refuse deposits past the limit with an explicit message. |
| OQ-BLD-15 | Does the **Building of the Week** rotate on a fixed weekday, and is the rotation global or per-player? | Affects how a content pack's `window` is authored. | Global weekly window starting Monday 00:00 UTC; one entry per window. |
| OQ-BLD-16 | Is the **"Citycon Building"** placeable in the world, or is it purely a purchase that grants a slot? | The Basics describes it in the shop and in the world ("let's find one — it's here, that's the city building"), so it appears to be a placeable special building. | Treat it as a placeable special entry whose primary effect is granting a permanent construction slot. |
| OQ-BLD-17 | Do **decoration** buildings contribute wealth, points or diversity? | The cinema contributes points; it is unclear whether pure decoration does. | Decoration contributes diversity only; points and wealth are opt-in per entry. |
| OQ-BLD-18 | Is the **per-map diversity cap** the true number of distinct entries (the dev says the game "is already more" than 250 and "continuously growing"), and does the penalty scale with the excess? | Sets the top of the diversity bonus curve. | Cap the bonus at 250 points (250 %); continue counting points beyond that but cap the bonus; the penalty subtracts from the raw count. |
| OQ-BLD-19 | Does a **move** preserve the instance's tier, level and accumulated state, and does it consume a construction slot? | The game's move action is evidenced; its interaction with upgrades and slots is not. | A move preserves tier and level, is free of construction slots, and is confirmed instantly under Sandbox Constructions. |
| OQ-BLD-20 | Does an **upgrade** create or remove a **diversity point**? | Diversity counts distinct catalogue entries; an upgrade changes tier, not entry identity. | An upgrade changes neither: the entry keeps its single diversity point. |
| OQ-BLD-21 | Does an **upgrade** consume a construction slot or restart the construction timer? | Affects whether upgrading a large building can deadlock a city at zero free slots. | An upgrade is free of construction slots and does not restart the construction timer. |

---

## 12. Source list

| # | URL | What it gave us | Retrieved |
|---|---|---|---|
| 1 | https://www.youtube.com/watch?v=jYAD0SkDmY0 | The Basics — catalogue count and categories, shop structure, placement and snapping, orbit-mode edit / rotate / move, bulldozer and its three categories, construction slots, add-ons, Building of the Week, Sandbox Constructions, Citycon Building, speed-up package, Piggy Bank, chests, storage tab rule, level = residents, higher levels unlock more buildings, government panel sections | 2026-10-23 (transcript read from the video's own caption track) |
| 2 | https://www.youtube.com/watch?v=cSRDwHvowWI | Storage Feature — inventory → store / sell menu with quantity selector, storage as ownership, shop restore button, inventory-count vs built-count on the card | 2026-10-23 (transcript) |
| 3 | https://www.youtube.com/watch?v=CIb2IWyNPJw | Resident Bonuses — the six bonuses, culture/entertainment/recreation at 1 point per 1 000 residents with a 250 % cap, the `unique` property and the stackable contrast, wealth levels 1–3 and the 1.65 → 129 % example, diversity = 1 point per unique building and the 8-instance penalty | 2026-10-23 (transcript) |
| 4 | https://www.youtube.com/watch?v=y5g7xPHzj0A | Energy Supply — the six energy entries, C-wire, green vs non-green energy, waste incineration producing energy with pollution, nuclear unlocked at city size | 2026-10-23 (transcript) |
| 5 | https://www.youtube.com/watch?v=yuLUP_ELk4I | Water Supply — water tower, small and big water pump, water pipeline, production/consumption overview | 2026-10-23 (transcript) |
| 6 | https://www.youtube.com/watch?v=6wWZxnm_YLk | Food Supply — fields, farm animals, food factory, plant/animal/processed channels, pole-barn requirement, windmills and silos with a 13 × 13 bonus area, bonus does not affect industrial production | 2026-10-23 (transcript) |
| 7 | https://www.youtube.com/watch?v=HDjaWySDKOM | Waste Management — landfill, recycling station (upgradeable), waste incineration (energy + pollution), waste breakdown by residential/commercial/industrial/government/farms | 2026-10-23 (transcript) |
| 8 | https://www.youtube.com/watch?v=PifQ_7vj7Ao | Education — elementary/secondary/university, area of effect and capacity, demo elementary school at level 5 for 1 M residents over 23 × 23, bus stations deactivating without capacity, library and art museum bonus buildings, income bonus for covered buildings | 2026-10-23 (transcript) |
| 9 | https://www.youtube.com/watch?v=4SlxOgZ67MU | Healthcare — hospital (upgradeable, multiple levels) and medical center (cheaper, earlier unlock, smaller area), capacity vs local coverage | 2026-10-23 (transcript) |
| 10 | https://www.youtube.com/watch?v=tFmR_0w1OuQ | Police — big Police Department and small police station, decorative + bonus only, full-city coverage maximises the bonus, coverage icons on the card | 2026-10-23 (transcript) |
| 11 | https://www.youtube.com/watch?v=0wFTp0aDpQg | Fire — fire department, covered buildings receive a bonus, per-category local coverage | 2026-10-23 (transcript) |
| 12 | https://www.youtube.com/watch?v=71H1tU2DGz8 | Monorails — street connection for residential buildings without streets, buildable over fields and decoration, residential-only effect | 2026-10-23 (transcript) |
| 13 | https://www.youtube.com/watch?v=LmY_TpU1B5Y | Economy Overview — demand bars (residential/commercial/industrial capacity) and usage bars (energy/water/food/waste), below 90 % fine, from 90 % growth slows, at 100 % growth stops; coverage circles vs bars | 2026-10-23 (transcript) |
| 14 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 | The live App Store listing — "over 300 unique structures", monthly add-ons, sandbox construction mode, region view, street view, mayoral match-up, rating and platform facts | 2026-10-23 |
| 15 | https://itunes.apple.com/lookup?id=1607860732&country=us | Version 2.4.0, first release 2022-05-11, and the release note naming the **Ancient China add-on** | 2026-10-23 |
| 16 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder | The live Google Play listing — "over 300 unique buildings", "300+ BUILDINGS: … homes, factories, landmarks, parks", monthly updates, no wait timers, updated 21 Dec 2025 | 2026-10-23 |
| 17 | https://store.steampowered.com/app/3474890/SuperCitycon/ | PC store page — "continuously growing library of buildings, vehicles, citizens and props", SCC Studio customising buildings, architectural styles, construction sandbox, Early Access Q4 2026, "Includes level editor" | 2026-10-23 |
| 18 | https://store.steampowered.com/api/appdetails?appids=3474890 | Machine-readable Steam metadata for the PC title — developer/publisher "Sunapie Games", categories incl. "Includes level editor", genres incl. "Early Access", `release_date.coming_soon: true` with `release_date.date` "Q4 2026", demo appid 5295650 | 2026-10-23 |
| 19 | https://supercitycon.net/ | Official site — "It is a separate game from SuperCitycon on Steam", Early Access Q4 2026, seaside-neighbourhood-to-downtown framing | 2026-10-23 |
| 20 | https://www.reddit.com/r/supercitycon/ | Dev posts naming the **Amsterdam add-on**, the **Space Casino** and the **Beach Life Event** (30 days, beach buildings and decorations); user posts naming the residential ladder (house / apartment / luxury apartment), "completely upgraded" buildings, the "2 slots needed" warning, and the request to keep buildings in the inventory when clearing a city | 2026-10-23 (feed read) |
| 21 | https://mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/ | Third-party guide — "new buildings as you level up", unlocking "apartments, parks", and the need for route connection | 2026-10-23 |
| 22 | https://thegameextras.com/game/super-citycon-city-builder/ | Retailer mirror of the **mobile** title's older listing copy — "over 150 Buildings of multiple categories, some of them with multiple variations", residential/commercial/industrial areas, water/food/energy/waste, police and fire stations, medical centers and hospitals, parks/sports/recreation. *Not present in `tools/source_ledger.json`; recommended addition as THIRD_PARTY. Recorded as historical context only — **no requirement row cites it**, and every claim it carried has been re-sourced to a ledger URL (FR-BLD-008, FR-BLD-009, FR-BLD-012, FR-BLD-046).* | 2026-10-23 |
| 23 | https://mwm.ai/apps/super-citycon-tm-build-a-city/1607860732 | App catalogue mirror — version 2.4.0, 489.7 MB, first released 11 May 2022, publisher naming | 2026-10-23 |
| 24 | https://steamcommunity.com/app/3474890/guides/ | Steam community guides index — currently no published guides, so no player-authored building list exists to corroborate the catalogue | 2026-10-23 |

> **Provenance note.** Rows in this document cite only sources verified in `tools/source_ledger.json` (entries 1–21, 23, 24). Entry 22 is a **non-verified** retailer mirror: it is recorded as historical context only and is **cited by no requirement row**. **No row cites either FOREIGN source marked in the ledger**, and this document contains none of the features, upgrade rules or item classes that belong to that other game — they do not exist in Super Citycon.
