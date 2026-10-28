# UI/UX — HUD, PANELS, CAMERA, CONTROLS, ONBOARDING, SETTINGS, ACCESSIBILITY & LOCALISATION — SuperCitycon Requirements
> Bot: BOT-09 · Domain code: UX · Status: COMPLETE
> Sources consulted: **20 distinct URLs** (official YouTube How-To transcripts read verbatim from `docs/transcripts/`; official YouTube channel index; Steam store page + `appdetails` API + 16 store screenshots read as pixels; Steam Community announcement and discussion; official site; App Store listing + `itunes` lookup API; Google Play listing; developer Facebook post; r/supercitycon; shared research brief) · Requirements: **142 FR / 12 NFR / 34 QA** · Open questions: **33**
> Evidence caveat: every transcript-derived fact below was read directly in the captured official YouTube transcripts (`docs/transcripts/*.txt`, verbatim captions) and each such row carries the transcript URL. PC-title HUD elements marked *(pixels)* were read directly from the published Steam store screenshots. Facts belonging to **any other title** — including other games' wikis, help centres and tip sites — have been removed from this document; where such a fact had no counterpart in this title's own public evidence, the requirement is marked `[TBD — design decision]` and recorded as an open question instead.
>
> **Remediation note (senior review, 2026-10-23).**
> - **FR-UX-112** no longer implies that a daily-bonus ladder must exist: a ladder is **not published for this
>   title**, so the rebuild **shall not ship one** until it is decided (OQ-UX-30). The evidenced daily
>   engagement is the 3-hour free gift and the 4 h / 24 h chests. No foreign source remains in this file.
> - **FR-UX-085** no longer assigns the mobile **Region View** to the PC title. The 2.0 announcement's
>   "Introducing the Region View" is the **mobile** title's version-two feature ("in version one we had the map
>   window … in version two we introduced the region view"), and no PC source evidences a Region View; the PC
>   parity question is now **OQ-UX-33**. Stage corrected `PC-EA` → `Mobile`.

---

## 0. Scope

**In scope (BOT-09 / UX):**
- The **top bar / HUD**: every element left→right, its states, tap targets and the panel each opens.
- The **demand / usage detail panels**, the **government overview panel**, the **building shop**, **inventory / bulldozer**, **construction slot display**.
- **Camera**: zoom levels & limits, pan/rotate/tilt, orbit & pitch constraints, camera-mode switching (perspective ↔ orthographic), third-person character camera, **Walk Mode** (first-person) transition + exit, first-person **sensitivity per device**.
- **Region View**: zoom-out reveal, map switching, region HUD additions, per-map resident/date relation.
- **Street View** (mobile first-person walkthrough) entry points, controls, UI.
- **Time-of-day and weather controls** and their HUD representation.
- **Notifications & feedback**: toasts, tutorial prompts, "Bop" build feedback, notification queue, surfacing of daily gift / 4 h & 24 h chests / Building of the Week / monthly add-on.
- **Onboarding & tutorial**: first-run flow, the "Basics" tutorial subjects, PC help surfaces.
- **Settings & accessibility**: audio, graphics, controls, sensitivity, language, colour-blind palettes, text size, haptics.
- **Localisation**: evidenced language lists and a rebuildable localisation architecture.

**Out of scope (owner named — referenced, never specified here):**
- Money/cost/tax/production numbers behind the bars → `ECO`. Happiness, City Score & Mayor Score **maths** → `POP` (their **display** is here).
- Coverage radii and service-building geometry → `SRV` (the **circles** that visualise it are here).
- Building catalogue, tiers, building property schema, shop contents → `BLD`. Traffic/road behaviour → `MOB`. Terrain → `WLD`. Voxel editor, SCC Studio internals → `STD`. Rendering, day/night *lighting*, weather *simulation*, audio assets, save format, perf → `TEC`. Mode registry, stage model, unlock cadence → `CORE`.

**Boundary rule:** this document owns **what the player sees, taps and how the camera responds**. Values shown by a widget are owned elsewhere; the widget's **contract** (what it displays, when, and what it opens) is owned here.

**Stage vocabulary used in the `Stage` column:** `Mobile` = the mobile title, live today (the only product where the simulation HUD is publicly observable) · `PC-EA` = the PC/Steam title — the Early Access construction sandbox (ships Q4 2026) plus PC features the developer has announced for it · `Both` = applies to both products · `Design` = a rebuild decision rather than a behaviour observed in either product.

**Product boundary:** the PC/Steam title (app **3474890**) and the mobile title (**id1607860732** / `com.benwilles.citybuilder`) are two products; the mobile game "is a separate game from SuperCitycon on Steam". The PC Early Access build ships **without** economy or progression, so its HUD shows *build/camera* affordances but **no demand/usage/money bars**. Both products are specified here; each requirement is tagged with the stage where it applies.

---

## 1. Observed behaviour (evidence)

### 1.1 Source findings

| # | Finding | Status | Source URL |
|---|---|---|---|
| S1 | Mobile top bar, left→right: **building demand block** (residential / commercial / industrial capacity bars), **usage block** (energy, water, food, waste), **money** (tap toggles short/unsorted display), **level**, **resident amount for the current map**, **date** starting at **Day Zero** with an advancing year counter. Tap each for detail. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S2 | Demand bars: **full bar = demand = you need more of that type**; a full demand bar means that capacity (residential / commercial workspaces / industrial workspaces) is exhausted. | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| S3 | Usage bars: keep them **low** — **below 90 % is fine**, **from 90 % city growth is reduced**, **at 100 % the city stops growing**. Worked example in the tutorial: food production at **82 %** is fine now but a shortage looms as residents arrive; energy **56 %** fine; water production huge; waste fine. | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y + https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S4 | Government overview panel: per-category overview for **energy supply, water supply, food supply, waste, health care, security, fire, school system** (8 blocks). **Bars = usage & demand → want them low**; **circles = coverage of your services → you want them full**. A block "is not fully developed" when coverage is incomplete. | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| S5 | **City Score** = f(residents, happiness); **Mayor Score** = Σ City Scores of all maps in the region; **shown top-left** and in the government overview. | [CONFIRMED] | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| S6 | Street Building tool: select a street type → tap the map → "a **visual indicator of every build that every direction that's possible**" appears → tap a direction → the street appears (**"Bop"**). | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S7 | Demolition: "enter the **inventory**… select streets and you can simply **tap them to remove them**". Inventory (right side) holds a **bulldozer** with **three categories**; the demo had *trees* and *streets* enabled. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S8 | **Zoom in/out**; **zoom out fully enters Region View**; **Walk Mode** enters first-person exploration; an **exit button** returns. Settings include **first-person sensitivity per device**. | [CONFIRMED] | https://www.youtube.com/watch?v=ovWkwWS5FlY + https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S9 | Zoom model restated as thresholds: fully zoomed in → **walk mode**; fully zoomed out **twice** → **region view**. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S10 | Mobile HUD top-left cluster = **camera mode** (perspective w/ tilt-shift ↔ **orthographic**), **mini-map**, **science view**, **government** (manage-the-game), **collectibles area** (cards from chests or over time), **high scores**, **income**, **city upgrades**, **overview** (electricity, water, food, waste, health care, police, fire, education), **mailbox** (where you receive your tasks), **shop**, **building shop**. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S11 | **Construction slots**: one at the start; each **Citycon Building** grants another **permanent** slot; larger buildings "require **two or more** construction slots"; slots also obtainable from the shop or collected over time. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S12 | Region View: "I'll show you how to **switch maps and use the region view**"; all maps of the region are shown with the **active map marked blue**; "**one region** for now". | [CONFIRMED] | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| S13 | PC title feature list includes **Living Cities** ("Experience active neighborhoods and transport, and **control day, night and weather**") and **First- & Third-Person Modes** ("Create your character and explore the city from within"). | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |
| S14 | PC title about-text: "**Choose the time of day and weather** to give your city a different atmosphere. First- and third-person modes let you step inside and explore the city you created." | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |
| S15 | PC title demo (Steam announcement): demo has "fires and tornadoes, **a full day and night cycle**"; "**You can't walk around the city on foot in the demo yet**". | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| S16 | *(pixels)* PC HUD **left vertical tool stack**, 4 rounded buttons top→bottom: **blue cursor (select, active)**, **salmon road-with-excavator (street building)**, **tan undo arrow**, **tan redo arrow**. | [CONFIRMED] | https://store.steampowered.com/app/3474890/ (store screenshot 1 of 16) |
| S17 | *(pixels)* PC HUD **bottom-left 3 tabs**: terrain/landscape-with-water (terraforming), **yellow construction crane on hazard-striped pad (construction yard)**, retro **desktop computer with a list (SCC Studio / asset browser)**. Active tab has a white ring. | [CONFIRMED] | https://store.steampowered.com/app/3474890/ (store screenshot 1 of 16) |
| S18 | *(pixels)* PC HUD **bottom-centre strip**: a **star** button (favourites), then a row of **building-category icons** (gazebo, house, market stall, civic building, house, park, windmill, barn, stone), then three rounded buttons labelled **Gr / Am / De**, then a **"#"** button. A **building-catalogue carousel** of large cards (3D model + name, e.g. BAYWATCH TOWER, CENTRAL HIGH SCHOOL, FIRE DEPARTMENT) sits above the strip with **‹ › paging arrows**. | [CONFIRMED] | https://store.steampowered.com/app/3474890/ (store screenshot 1 of 16) |
| S19 | *(pixels)* PC HUD **bottom-right cluster**: rounded **search field** with magnifier, **3×3 grid icon** button (library/menu), **video-camera icon**, **crescent-moon icon** (time of day), **camera icon** (photo mode). Screenshots carry a "**Development Build**" watermark bottom-right. | [CONFIRMED] | https://store.steampowered.com/app/3474890/ (store screenshots 1 and 9 of 16) |
| S20 | *(pixels)* PC HUD **top-right**: a **diamond-shaped minimap** showing the whole map with coloured districts and icons. | [CONFIRMED] | https://store.steampowered.com/app/3474890/ (store screenshots 1 and 9 of 16) |
| S21 | Settings: "open the **settings** and you will find options to modify how **sensitive the first person mode** is, depending on your device". The settings surface is reached from the HUD. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S22 | Long-pressing a placed building opens **edit mode** (the camera orbits it); the **edit button** then offers the options to **rotate** and to confirm the change. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S23 | Camera modes: a **camera-mode button** in the top-left (marked with a blue dot) toggles between **orthographic** and **perspective**; perspective is the default on first launch and adds **tilt-shift**; the camera **auto-snaps every 55°** while rotating. | [CONFIRMED] | https://www.youtube.com/watch?v=ovWkwWS5FlY |
| S24 | Free gifts and premium unlocks: "every **3 hours** you get a **free gift**"; every **8 hours** the **premium options** can be unlocked by watching **4 ads**; the **Piggy Bank** collects **Super Cash** over time and, once full, is purchasable at a heavily reduced price. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S25 | Resident bonuses: **culture, entertainment, recreation, wealth, diversity and loyalty** sum up to the **resident bonus** and raise the resident amount and the residential capacity in parallel; **loyalty** is collected **twice a day** (morning and evening) and loses **one point per complete 24-hour day** away. | [CONFIRMED] | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| S26 | Storage: the storage tab is "maybe not present in your game — it's only there when you got **something in storage**"; **buildings and bonus cards** can be put into storage and redeemed from the shop. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S27 | Government overview: one block per service category — **energy supply, water supply, food supply, waste, health care, security, fire, school system** — each showing **usage** (bars), **demand** (bars) and **coverage** (circles). | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| S28 | PC/Steam title lists **22 languages with full audio support**: English, French, Italian, German, Spanish-Spain, Danish, Dutch, Finnish, Indonesian, Japanese, Korean, Norwegian, Polish, Portuguese-Brazil, Portuguese-Portugal, Russian, Simplified Chinese, Swedish, Traditional Chinese, Turkish, Ukrainian, Vietnamese. | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |
| S29 | iOS build (v2.4.0, updated 2025-12-21, min iOS 14) declares **21 ISO language codes**: DA, NL, EN, FI, FR, DE, ID, IT, JA, KO, NB, PL, PT, RU, ZH, ES, SV, ZH, TR, UK, VI (ZH appears twice = Simplified + Traditional). | [CONFIRMED] | https://itunes.apple.com/lookup?id=1607860732&country=us |
| S30 | Store listings: **REGION VIEW** ("Connect multiple city maps into one region"), **STREET VIEW** ("Walk through your city in 3D… parks, bustling streets, and daily life up close"), **MAYORAL MATCH-UP** (global leaderboard), **MONTHLY ADD-ONS**, **BOUNDLESS MAPS**, **SANDBOX CONSTRUCTION MODE** (build instantly, no construction delay). | [CONFIRMED] | https://itunes.apple.com/lookup?id=1607860732&country=us + https://play.google.com/store/apps/details?id=com.benwilles.citybuilder |
| S31 | Developer **mobile** 2.0 announcement lists: "Android Debut, **New Orthographic Camera Mode**, **Introducing the Region View**, Economy Update and Rebalancing, **Expanded Language Support**". | [CONFIRMED] | https://www.facebook.com/benwillesgames/photos/956023616528658/ |
| S32 | Camera model: **pinch** to zoom, **two-finger swipe** to tilt, **drag** to rotate with a **55° auto-snap**; **zoom in fully, then zoom in again** enters first-person, **zoom out fully, then zoom out again** enters Region View. | [CONFIRMED] | https://www.youtube.com/watch?v=ovWkwWS5FlY + https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S33 | Chests: free chests every **4 h / 24 h** giving collectible parts and bonus cards; **Building of the Week** = a rotating **unique** building available only that week; **add-on** purchases are **permanent unlocks**. | [CONFIRMED] | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| S34 | Global-connected-economy panels gain a **globe icon** and then show **global numbers** (food, waste via Harbor; energy via C-Wire; water via Water Pipeline) — a HUD-affecting state on the economy panel. | [CONFIRMED] | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| S35 | Service demand/usage: the tutorial states the rule set explicitly — **below 90 % usage is fine**, **from 90 % city growth is reduced**, **at 100 % the city stops growing** — and that **circles are coverage** ("you ideally want to be completely full") while **bars are usage** ("you want to be empty or not filled"). | [CONFIRMED] | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| S36 | Official YouTube How-To titles that map 1:1 to UX surfaces: "**The Basics**" (jYAD0SkDmY0), "**Switching Maps**" (vBJdlAeLn0g), "**Camera Modes**" (ovWkwWS5FlY), "**Connected Economies**" (m5O-A33wQm0), "**Water Supply System**" (yuLUP_ELk4I). | [CONFIRMED] | https://www.youtube.com/@supercitycon/videos |
| S37 | Official site: mobile is a **separate game**; PC "Early Access coming **Q4 2026** for Windows and macOS"; links to Discord, r/supercitycon, App Store, Google Play, Steam. | [CONFIRMED] | https://supercitycon.net/ |
| S38 | Reddit r/supercitycon: player feedback that the game "has **a day and night cycle**" and asks for street lighting; the game's community surface for UI feedback. | [CONFIRMED] | https://www.reddit.com/r/supercitycon/ |

### 1.2 Screens/flows observed

- **Top bar (mobile sim)** — demand block | usage block | money | level | residents | date, each block independently tappable (S1).
- **Top bar (PC sandbox)** — no demand/usage/money/level/resident/date block exists in the EA build; the persistent readouts are the **minimap (top-right)** and the **bottom bar** (S16–S20).
- **Demand panel** — tap a demand bar → exact figures for that category + what it means (S2).
- **Usage panel** — tap a usage bar → exact figures + the 90 %/100 % guidance (S3).
- **Government overview** — 8 service blocks, each with a **circle** (coverage) and a **bar** (usage/demand); "not fully developed" state; Mayor Score (S4, S5).
- **Street building** — Street Building button → type selector → tap map → direction gizmos → tap a direction → "Bop" (S6).
- **Inventory / bulldozer** — right-hand inventory panel → bulldozer → three category checkboxes → tap object to remove (S7).
- **Zoom-out to Region View** — all region maps shown, active map blue (S8, S9, S12).
- **Zoom-in to Walk Mode** — first-person; exit button returns to the prior camera (S8, S9).
- **Settings (mobile)** — reached from the HUD; contains **first-person sensitivity options that depend on the player's device** (S21).
- **Free gift & chests (mobile)** — a free gift every **3 h**; premium options unlockable every **8 h** by watching 4 ads; free chests every **4 h / 24 h**; a Piggy Bank that accumulates Super Cash (S24, S26).
- **Tasks & messages (mobile)** — reached through the **mailbox** entry point in the top-left cluster, which is where the player receives tasks (S10).
- **Camera modes (mobile)** — camera-mode button top-left toggles orthographic ↔ perspective; rotation auto-snaps every 55°; perspective adds tilt-shift (S23).
- **PC build catalogue** — bottom-centre category strip + paging carousel of named building cards + search field + 3×3 library button (S18, S19).
- **PC map/region navigation** — diamond minimap top-right; 3×3 grid button opens the library/all-categories surface (S19, S20).

---

## 2. System overview

```
┌──────────────────────────── TOP BAR (mobile simulation) ────────────────────────────┐
│ [DEMAND BLOCK] [USAGE BLOCK] [MONEY] [LEVEL] [RESIDENTS(current map)] [DATE]        │
│  R/C/I bars      E/W/F/W bars   tap→    lvl=f()  per-map count   Day Zero + year    │
│  tap→panel       tap→panel     toggle                            tap→calendar      │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌─ TOP-LEFT (mobile) ──────────────┐        ┌─ TOP-RIGHT (PC) ─────────┐
│ camera-mode | minimap | science   │        │ diamond minimap           │
│ gov | collectibles | highscores   │        └──────────────────────────┘
│ income | city upgrades | overview  │
│ mailbox(tasks) | shop | bldg shop │
└────────────────────────────────────┘
┌─ LEFT RAIL (mobile) ──────────────┐  ┌─ RIGHT RAIL (mobile) ──────────────┐
│ task list placement = TBD          │  │ inventory → bulldozer (3 cats)     │
│ (mailbox entry point, OQ-UX-23)    │  │ construction slots                 │
└────────────────────────────────────┘  └────────────────────────────────────┘
┌─ BOTTOM BAR (PC EA) ────────────────────────────────────────────────────────────────┐
│ [select][street][undo][redo] │ [terrain][construction yard][studio] │ ★ cats Gr Am De # │
│ ‹ CAROUSEL: MODEL + NAME ‹ ›    │ search ........ │ [grid][video][moon][camera]     │
└─────────────────────────────────────────────────────────────────────────────────────────┘

 CAMERA RIG
   OrbitCam (top-down city)  ──zoom-out──▶  RegionCam (multi-map)
        │ zoom-in                                        │ tap map
        ▼                                                ▼
   WalkCam (first-person, sensitivity/device) ◀── exit button
        │
   ThirdPersonCam (character, created by player)

 PANEL ROUTER  tap(widget) → PanelFactory(kind) → Panel instance (stacked, dismissable)
 NOTIFICATION QUEUE  enqueue(kind, payload) → single-slot toast + persistent queue
 SETTINGS  persisted schema (audio/graphics/controls/sensitivity/language/accessibility)
 LOCALISATION  key → string table per locale; widget layout driven by token metrics
```

---

## 3. Functional requirements

### 3.1 Top bar / HUD (FR-UX-001 … 020)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-UX-001 | The simulation top bar shall render **six independent blocks in this fixed left→right order**: (1) building demand block, (2) usage block, (3) money, (4) level, (5) resident amount **for the current map**, (6) date. | Must | Mobile | partial | QA-UX-001 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-002 | The demand block shall show **three bars** — residential, commercial, industrial — each representing **remaining capacity** for that class. | Must | Mobile | partial | QA-UX-001 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-003 | The usage block shall show **four bars** — energy, water, food, waste — each representing **consumption as a percentage of production**. | Must | Mobile | partial | QA-UX-001 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-004 | Each of the six top-bar blocks shall be an **independent tap target** that reveals its own detail (the money widget toggles its display instead — FR-UX-005); tapping one block shall not open another's detail. | Must | Mobile | yes | QA-UX-001 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-005 | The money widget shall **toggle between a short/compact display and an unsorted (full breakdown) display** on tap. | Must | Mobile | yes | QA-UX-002 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-006 | The money widget shall show the **spendable coins balance**, and the premium currency **Super Cash** shall be presented as a **separate HUD surface** (the Super Cash options sit under the Piggy Bank, beside the collectibles and chests); the two balances shall never be merged into one readout. | Must | Mobile | yes | QA-UX-003 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-007 | The level indicator shall display a **level number derived from the resident amount** (no XP), and shall update when the resident count crosses a threshold. | Must | Mobile | yes | QA-UX-006 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-008 | The resident widget shall display the **resident count of the currently active map only**, and shall change on map switch. | Must | Mobile | yes | QA-UX-005 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-009 | The date widget shall start at **Day Zero** and shall maintain a **year counter** that advances as in-game days accumulate; the widget shall render both day and year. | Must | Mobile | yes | QA-UX-004 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-010 | The PC Early Access HUD shall **not** display demand, usage, money, level or resident widgets (no economy/progression in EA) and shall instead present a persistent **minimap top-right** plus a **bottom action bar**. | Must | PC-EA | yes | QA-UX-001 | https://store.steampowered.com/app/3474890/ |
| FR-UX-011 | The PC build shall provide a **left vertical tool stack** with, top→bottom: **select**, **street building**, **undo**, **redo**; the active tool shall be indicated by a highlighted ring. | Must | PC-EA | yes | QA-UX-017 | https://store.steampowered.com/app/3474890/ (screenshot 1) |
| FR-UX-012 | The PC build shall provide **three bottom-left tabs**: **terrain/terraforming**, **construction yard (Citycon Building)**, and **SCC Studio / asset browser**; the active tab shall be ring-highlighted. | Must | PC-EA | yes | QA-UX-017 | https://store.steampowered.com/app/3474890/ (screenshot 1) |
| FR-UX-013 | The PC build shall provide a **bottom-centre category strip**: a **favourites star** followed by **building-category icon tabs**, plus a **"#" secondary filter/customisation button**. | Must | PC-EA | yes | QA-UX-018 | https://store.steampowered.com/app/3474890/ (screenshot 1) |
| FR-UX-014 | The PC build shall provide a **building-catalogue carousel** of large cards showing a **3D model preview and the building's name**, with **‹ › paging arrows**; the card set shall page by category. | Must | PC-EA | yes | QA-UX-018 | https://store.steampowered.com/app/3474890/ (screenshot 1) |
| FR-UX-015 | The PC build shall provide a **bottom-right cluster** containing a **search field** (magnifier), a **3×3 library/menu grid button**, a **video-record button**, a **crescent-moon time-of-day button**, and a **camera (photo-mode) button**. | Must | PC-EA | yes | QA-UX-027 | https://store.steampowered.com/app/3474890/ (screenshot 1) |
| FR-UX-016 | The PC build shall render a **diamond-oriented minimap** in the top-right corner showing the whole map, district colouring and map icons, and shall support a click-to-jump to that location. | Must | PC-EA | yes | QA-UX-021 | https://store.steampowered.com/app/3474890/ (screenshots 1, 9) |
| FR-UX-017 | **[TBD — design decision]** Every HUD widget shall be a **minimum 44×44 px logical touch target** with a visible pressed/active state, and no widget shall be occluded by the bottom action bar or the notch/safe area; the title's own hit-target sizes are not published — OQ-UX-32. | Must | Both | yes | QA-UX-001 | [TBD] — OQ-UX-32 |
| FR-UX-018 | The HUD shall be **safe-area aware**: top bar below the status bar/notch, bottom bar above the home indicator, on all supported aspect ratios. | Must | Both | yes | QA-UX-001 | https://supercitycon.net/ |
| FR-UX-019 | The HUD shall **auto-collapse** (to a reduced form) when the viewport height is insufficient for the full bar, and shall offer a manual expand toggle. | Should | Both | yes | QA-UX-001 | [TBD] — OQ-UX-01 |
| FR-UX-020 | **[TBD — design decision]** The top bar shall be **non-blocking**: the simulation values it shows (demand, usage, money, level, residents, date) are readable without an advertisement or a premium unlock in the captured tutorial, but whether any HUD readout may ever be gated is undecided — OQ-UX-28. | Must | Both | yes | QA-UX-001 | [TBD] — OQ-UX-28 |

### 3.2 Demand & usage detail panels (FR-UX-021 … 034)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-UX-021 | Tapping a **demand bar** shall open a detail panel for that category showing its **exact figures** (current capacity, current demand, remaining capacity, and the ratio as a number). | Must | Mobile | partial | QA-UX-007 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-022 | The demand detail panel shall state the rule "**a full demand bar means you need more of that type**" in player-facing wording, and name the exhausted class (residential / commercial workspaces / industrial workspaces). | Must | Mobile | yes | QA-UX-007 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-023 | Tapping a **usage bar** shall open a detail panel showing that resource's **exact production, consumption and percentage usage**. | Must | Mobile | partial | QA-UX-008 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-024 | The usage detail panel shall carry the threshold legend: **below 90 % = fine**, **from 90 % = city growth reduced**, **at 100 % = city stops growing**. | Must | Mobile | yes | QA-UX-009 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-UX-025 | The usage bar shall express the same three bands the panel states — **below 90 % fine, from 90 % city growth reduced, at 100 % the city stops growing** — and the **visual encoding** of each band (fill, colour, label, and never colour alone) is **[TBD — design decision]** — OQ-UX-29. | Should | Mobile | yes | QA-UX-009 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-UX-026 | A usage bar at **exactly 100 %** shall surface a **blocking warning**, because the city stops growing at 100 %; whether 100 % is drawn differently from 99 % is **[TBD — design decision]** — OQ-UX-29. | Must | Mobile | yes | QA-UX-009 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-UX-027 | The usage panel shall show a **forward-looking note** when a resource is below 100 % but projected to be exceeded by incoming residents (the tutorial's food-at-82 %-will-fall-short case). | Should | Mobile | yes | QA-UX-008 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-028 | Tapping the **money** widget once shall toggle short↔unsorted display **without opening a panel**; the unsorted form shall group receipts and costs. | Must | Mobile | yes | QA-UX-002 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-029 | The level widget shall show which **buildings/markers a level unlocks** (higher levels unlock more buildings) and the next level's requirement; how that list is presented (panel on tap) is **[TBD — design decision]** — OQ-UX-31. | Should | Mobile | yes | QA-UX-006 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-030 | The HUD shall expose the **resident growth modifiers** — the six bonuses (**culture, entertainment, recreation, wealth, diversity, loyalty**) that together scale the resident amount and the residential capacity in parallel — and the exact contents of any panel opened from the **residents** widget are **[TBD — design decision]** — OQ-UX-31. | Should | Mobile | partial | QA-UX-005 | https://www.youtube.com/watch?v=CIb2IWyNPJw |
| FR-UX-031 | The date widget shall show the current **day and year**, starting at **Day Zero**; whether a calendar/date panel opens on tap, and whether it lists scheduled resets, is **[TBD — design decision]** — OQ-UX-31. | Should | Mobile | yes | QA-UX-004 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-032 | Each detail panel shall be **dismissible** by a close control, by tapping outside, and by the platform back gesture, and shall return the HUD to its prior state. | Must | Both | yes | QA-UX-007 | [TBD] — OQ-UX-02 |
| FR-UX-033 | Detail panels shall show **live values** while open (the underlying simulation continues to run) and shall re-render on change. | Must | Mobile | yes | QA-UX-007 | [TBD] — OQ-UX-02 |
| FR-UX-034 | The demand and usage panels shall show a **globe icon and global numbers** when that resource is connected to the region-wide system (Harbor → food & waste; C-Wire → energy; Water Pipeline → water). | Must | Mobile | partial | QA-UX-008 | https://www.youtube.com/watch?v=m5O-A33wQm0 |

### 3.3 Government overview panel (FR-UX-035 … 046)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-UX-035 | The government overview panel shall present **eight service blocks**: energy supply, water supply, food supply, waste, health care, security, fire, school system. | Must | Mobile | partial | QA-UX-011 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-036 | Within each service block, **circles shall represent service coverage** and **bars shall represent usage/demand**, with the panel's legend stating that circles should be **full** and bars should be **low**. | Must | Mobile | yes | QA-UX-011 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-UX-037 | The **coverage circle** of a service block shall show how much of the city that service covers and shall be distinguishable from a fully covered service; the exact fill encoding (including whether fill is proportional to covered population) is **[TBD — design decision]** — OQ-UX-29. | Must | Mobile | partial | QA-UX-012 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-UX-038 | A service block shall expose a **"not fully developed" state** when its coverage is incomplete, with a text label in addition to the partial circle. | Must | Mobile | yes | QA-UX-013 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-UX-039 | Tapping a service block in the overview shall open the **service detail panel** for that category, showing its **usage, demand and service coverage**; the additional contents (building list, advice text) are **[TBD — design decision]** — OQ-UX-31. | Must | Mobile | partial | QA-UX-011 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-UX-040 | The overview panel shall display the **Mayor Score** for the region. | Must | Mobile | yes | QA-UX-014 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-UX-041 | The **Mayor Score shall be shown top-left** of the HUD as well as in the overview; the **City Score** of the active map is the per-city value that feeds it, and where the City Score itself is displayed is **[TBD — design decision]** — OQ-UX-31. | Must | Mobile | yes | QA-UX-014 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-UX-042 | The overview panel shall be reachable from the **top-left "government" button** in the mobile HUD. | Must | Mobile | yes | QA-UX-011 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-043 | The top-left HUD cluster shall additionally provide: **minimap**, **science view**, **collectibles area**, **high scores**, **income**, **city upgrades**, **overview (electricity, water, food, waste, health care, police, fire, education)**, **mailbox (tasks)**, **shop** and **building shop** entry points. | Must | Mobile | yes | QA-UX-011 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-044 | The **overview** button shall open a condensed all-services summary that is a strict subset of the government panel's eight blocks. | Should | Mobile | yes | QA-UX-011 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-045 | The **collectibles area** shall show cards obtained from chests or over time and shall allow claiming them; claiming before the free tier is used up may offer an ad-based alternative, and the UI shall state that clearly. | Must | Mobile | yes | QA-UX-034 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-046 | The **mailbox** shall be the entry point to the task list and shall badge the count of claimable/completed tasks. | Must | Mobile | yes | QA-UX-030 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.4 Toolbars, build tools, shop, inventory, construction slots (FR-UX-047 … 060)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-UX-047 | Selecting the **Street Building** tool shall open a **street-type selector** before any placement is possible. | Must | Both | yes | QA-UX-015 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-048 | With a street type selected, tapping the map shall display a **visual direction gizmo for every build direction that is possible** at that point, and only those directions. | Must | Both | yes | QA-UX-015 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-049 | Tapping a direction gizmo shall place the street and shall emit the game's characteristic build feedback sound (the "**Bop**"). | Must | Both | yes | QA-UX-015 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-050 | Street placement shall support **continuous runs** — after a segment is built the tool shall remain active and extend from the last placed node. | Must | Both | yes | QA-UX-015 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-051 | The **inventory** shall contain a **bulldozer** exposing **three demolition categories**; observed enabled categories are **trees** and **streets** (the third category's identity is TBD — OQ-UX-03). | Must | Mobile | yes | QA-UX-016 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-052 | Demolition shall be executed by **tapping the object** while its category is enabled; an object of a disabled category shall not be removable and shall give explicit feedback. | Must | Mobile | yes | QA-UX-016 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-053 | The **building shop** shall present categories with **paged carousel/card lists** and a **search** affordance, and shall support a **storage tab that only appears when storage is non-empty**. | Must | Mobile | partial | QA-UX-018 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-054 | The building shop shall expose an **add-ons section** where an add-on is a **permanent unlock** and the UI shall label it as permanently owned once bought. | Must | Mobile | yes | QA-UX-034 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-055 | The HUD shall display **construction slots** as discrete indicators; the player starts with **one** slot, each **Citycon Building** grants another **permanent** slot, and larger buildings require **two or more** slots. | Must | Mobile | yes | QA-UX-019 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-056 | Attempting to place a building that needs more slots than are free shall be **blocked with an explanatory message** naming the required and available slot count. | Must | Mobile | yes | QA-UX-019 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-057 | Tools shall be **mutually exclusive**: selecting a new tool shall cancel the previous one, and the active tool shall be visibly indicated in the tool stack. | Must | Both | yes | QA-UX-017 | [TBD] — OQ-UX-04 |
| FR-UX-058 | Every active tool shall offer an explicit **cancel** affordance (escape key / back gesture / tapping the active tool) that returns to the default select tool without placing anything. | Must | Both | yes | QA-UX-017 | [TBD] — OQ-UX-04 |
| FR-UX-059 | Long-pressing a placed **building** shall open the building's **edit mode** (the camera orbits it) and expose an **edit button** offering the **rotate** action and a confirm action; which building classes support rotation, and whether non-rotatable classes hide the action, is **[TBD — design decision]** — OQ-UX-22. | Must | Mobile | yes | QA-UX-017 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-060 | The PC build shall provide **undo and redo** as first-class tool-stack actions for build operations. | Must | PC-EA | yes | QA-UX-017 | https://store.steampowered.com/app/3474890/ (screenshot 1) |

### 3.5 Camera rig, zoom, walk mode, third person (FR-UX-061 … 078)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-UX-061 | The city camera shall support **continuous zoom** with a defined **minimum** (street level) and **maximum** (whole map) distance. | Must | Both | yes | QA-UX-020 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-062 | Zooming **fully out** shall transition the camera into **Region View** rather than simply stopping at a maximum distance. | Must | Mobile | yes | QA-UX-021 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-063 | Zooming **fully in** shall transition the camera into **Walk Mode** (first-person) rather than simply stopping at a minimum distance. | Must | Mobile | yes | QA-UX-020 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-064 | Walk Mode shall be **entered by the player** as well as by zoom, and the HUD shall show an **exit button** that returns the player to the previous camera state (position, pitch, zoom, mode). | Must | Mobile | yes | QA-UX-023 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-065 | First-person **sensitivity shall be configurable per device** (e.g. separate settings for touch/phone, tablet, mouse+keyboard/PC), not a single global value. | Must | Mobile | yes | QA-UX-024 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-066 | The sensitivity control shall expose **at least three named presets or a continuous 0–100 slider**, with a live "look around" preview. | Should | Both | yes | QA-UX-024 | [TBD] — OQ-UX-05 |
| FR-UX-067 | The camera shall support **pan** (drag), **rotate** (yaw) and **tilt** (pitch) with **pitch clamped to a documented range** so the camera never passes through the ground plane or flips upside-down. | Must | Both | yes | QA-UX-020 | [TBD] — OQ-UX-06 |
| FR-UX-068 | The camera shall support a **perspective ↔ orthographic toggle** as an explicit camera-mode control. | Must | Mobile | yes | QA-UX-026 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-069 | The camera-mode toggle shall be reachable from the **top-left camera-mode button** and shall be reflected in the button's own state. | Must | Mobile | yes | QA-UX-026 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-070 | Perspective mode shall offer a **tilt-shift / depth-of-field look** as an option; orthographic mode shall offer none. | Should | Mobile | yes | QA-UX-026 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-071 | The PC title shall support **first-person and third-person modes**; the player creates their own character and explores the city from within. | Must | PC-EA | partial | QA-UX-025 | https://store.steampowered.com/app/3474890/ |
| FR-UX-072 | Third-person mode shall render the player character with a **follow camera** that maintains framing against terrain and buildings and that supports the same yaw/pitch clamping. | Must | PC-EA | yes | QA-UX-025 | https://store.steampowered.com/app/3474890/ |
| FR-UX-073 | Third-person mode shall expose a character switcher over the **player's created characters** (models created in SCC Studio). | Should | PC-EA | yes | QA-UX-025 | https://store.steampowered.com/app/3474890/ |
| FR-UX-074 | The camera shall maintain a **collision/clamp** so it never ends up inside geometry or below terrain when tilted or zoomed. | Must | Both | yes | QA-UX-020 | [TBD] — OQ-UX-06 |
| FR-UX-075 | Tapping an object in any camera mode shall select it (not fire a ray through it); a tap that moves the camera shall not select. | Must | Both | yes | QA-UX-015 | [TBD] — OQ-UX-07 |
| FR-UX-076 | Zooming in and out shall be **smoothly interpolated**, and the transition into/out of Walk Mode and Region View shall be a **single continuous camera move**, not a hard cut. | Should | Both | yes | QA-UX-020 | [TBD] — OQ-UX-08 |
| FR-UX-077 | The PC build shall provide **camera presets**: the **video-record button** (cinematic capture) and the **camera button** (photo mode), both of which shall hide or minimise HUD chrome for the capture. | Should | PC-EA | yes | QA-UX-027 | https://store.steampowered.com/app/3474890/ (screenshot 1) |
| FR-UX-078 | A **minimap** shall be available in every camera mode and shall indicate the camera's position and viewport extent. | Must | Both | yes | QA-UX-021 | https://store.steampowered.com/app/3474890/ (screenshot 1) |

### 3.6 Region view (FR-UX-079 … 088)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-UX-079 | Region View shall show **all maps of the region** simultaneously, each rendered as a thumbnail of its map. | Must | Mobile | partial | QA-UX-022 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-UX-080 | The **active map shall be marked in blue**; inactive maps shall be visually distinct from the active one without relying on colour alone. | Must | Mobile | yes | QA-UX-022 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-UX-081 | The player shall be able to **switch the active map** by tapping a map thumbnail; the switch shall be reflected immediately in the top bar's **resident count** and **date**. | Must | Mobile | yes | QA-UX-022 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-UX-082 | Region View shall expose **per-map summary chips** (map name, residents, day/year) so the player can compare maps without entering them. | Should | Mobile | yes | QA-UX-022 | [TBD] — OQ-UX-09 |
| FR-UX-083 | The **date and resident count shall be per-map**, while money, Super Cash, add-ons and unlocks are **shared across all maps**; the UI shall make that distinction explicit. | Must | Mobile | partial | QA-UX-005 | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| FR-UX-084 | Region View shall support the **single-region limitation** currently shipped ("one region for now") without the UI implying that multiple simultaneous regions are available. | Must | Mobile | yes | QA-UX-022 | https://www.youtube.com/watch?v=vBJdlAeLn0g |
| FR-UX-085 | The **2.0 feature set** shall introduce the **Region View** for the **mobile title** — the developer announcement lists "Android Debut, New Orthographic Camera Mode, **Introducing the Region View**, Economy Update and Rebalancing, Expanded Language Support", and the mobile tutorial dates it to version two ("in version one we had the map window … in version two we introduced the region view"). **Whether the PC title also ships a Region View is [TBD — design decision]** — OQ-UX-33; no PC source evidences one. | Should | Mobile | yes | QA-UX-022 | https://www.youtube.com/watch?v=vBJdlAeLn0g · https://www.facebook.com/benwillesgames/photos/956023616528658/ |
| FR-UX-086 | Entering and leaving Region View shall preserve the **per-map camera position** of every map. | Should | Mobile | yes | QA-UX-022 | [TBD] — OQ-UX-09 |
| FR-UX-087 | The **Mayor Score** displayed in the HUD shall aggregate across **all maps in the region**, and the Region View shall show the same aggregate. | Must | Mobile | yes | QA-UX-014 | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| FR-UX-088 | Tapping a map thumbnail in Region View shall **enter that map** at its saved camera position and switch the top bar to that map's residents/date. | Must | Mobile | yes | QA-UX-022 | [TBD] — OQ-UX-09 |

### 3.7 Street view / walk-through mode (FR-UX-089 … 096)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-UX-089 | The mobile title shall provide a **Street View** feature: walk through the city in 3D and experience "**parks, bustling streets, and daily life up close**". | Must | Mobile | partial | QA-UX-023 | https://itunes.apple.com/lookup?id=1607860732&country=us |
| FR-UX-090 | Street View shall have **explicit entry points** in the HUD — not only via the zoom threshold — so the player can enter deliberately. | Must | Mobile | yes | QA-UX-023 | [TBD] — OQ-UX-10 |
| FR-UX-091 | Street View shall offer **on-foot movement controls** (walk, look, and an interaction action) with an on-screen control affordance set that does not obscure the scene. | Must | Mobile | yes | QA-UX-023 | [TBD] — OQ-UX-10 |
| FR-UX-092 | Street View shall render the city's **street life** — parks, bustling streets and daily life up close — with **pedestrians on the sidewalks and vehicles in the streets** visible in the 3D scene. | Must | Mobile | partial | QA-UX-023 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 + https://www.youtube.com/watch?v=ovWkwWS5FlY + https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-UX-093 | The **exit button** shall be reachable from Street View / Walk Mode — the title shows it in the **top-left corner** as a red cross — and shall return the player to the city camera. | Must | Mobile | yes | QA-UX-023 | https://www.youtube.com/watch?v=ovWkwWS5FlY |
| FR-UX-094 | A **HUD-hiding / cinematic toggle** shall be available in Street View so the player can view the city without overlays. | Should | Mobile | yes | QA-UX-023 | [TBD] — OQ-UX-11 |
| FR-UX-095 | Street View shall render the **current time of day and weather** consistently with the simulation clock. | Must | Mobile | partial | QA-UX-027 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-UX-096 | The PC Early Access demo does **not** yet support on-foot walking; the PC HUD shall therefore not advertise Street View until it ships. | Must | PC-EA | yes | QA-UX-023 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |

### 3.8 Time of day and weather (FR-UX-097 … 106)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-UX-097 | The player shall be able to **set the time of day**, and the game shall run a **day/night cycle** that visibly changes lighting. | Must | Both | yes | QA-UX-027 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-UX-098 | A **clock** shall be visible in the HUD showing the current in-game time and shall be tappable to open the time control. | Must | Both | yes | QA-UX-027 | [TBD] — OQ-UX-12 |
| FR-UX-099 | The time control shall expose a **speed control** (pause / 1× / faster / fastest) for the simulation clock. | Must | Both | yes | QA-UX-027 | [TBD] — OQ-UX-12 |
| FR-UX-100 | The time control shall offer **named times of day** (dawn / day / dusk / night) as quick presets in addition to free scrubbing. | Should | Both | yes | QA-UX-027 | [TBD] — OQ-UX-12 |
| FR-UX-101 | The player shall be able to **select the weather**, and the selected condition shall be represented in the HUD next to the clock. | Must | Both | partial | QA-UX-028 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-UX-102 | The weather selector's **option list is [TBD]** — the PC demo is documented as including "**fires and tornadoes**", implying at least clear / rain / snow / severe variants — OQ-UX-13. | Should | Both | partial | QA-UX-028 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-UX-103 | The PC build shall expose time-of-day via the **crescent-moon button** in the bottom-right HUD cluster. | Must | PC-EA | yes | QA-UX-027 | https://store.steampowered.com/app/3474890/ (screenshot 1) |
| FR-UX-104 | **[TBD — design decision]** The simulation clock's **time base** (UTC vs device-local) and whether the HUD surfaces the player's local offset are **not published for this title**; the rebuild must fix one time base and display it consistently — OQ-UX-21. | Should | Mobile | yes | QA-UX-004 | [TBD] — OQ-UX-21 |
| FR-UX-105 | Time-of-day and weather changes shall apply **immediately** to the rendered scene without requiring a rebuild of the world. | Must | Both | partial | QA-UX-027 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-UX-106 | Changing time or weather shall **not** reset the construction timer model** — the mobile game measures construction in minutes that progress offline. | Must | Mobile | yes | QA-UX-019 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.9 Notifications, feedback and the notification queue (FR-UX-107 … 118)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-UX-107 | The game shall use **light, non-blocking toasts** for transient confirmations (build placed, resource collected, quest completed) that never interrupt play. | Must | Both | yes | QA-UX-029 | [TBD] — OQ-UX-14 |
| FR-UX-108 | A **notification queue** shall hold pending notifications and deliver them one at a time in FIFO order, with a visible indicator when more than one is pending. | Must | Both | yes | QA-UX-029 | [TBD] — OQ-UX-14 |
| FR-UX-109 | A notification shall be **dismissible** by tap, by a timeout, or by opening the related surface (e.g. tapping a chest notification opens the chest). | Must | Both | yes | QA-UX-029 | [TBD] — OQ-UX-14 |
| FR-UX-110 | **Blocking alerts** (usage at 100 %, insufficient slots, insufficient funds) shall be **distinguishable in kind** from informational toasts (different presentation, higher priority, not auto-dismissed). | Must | Both | yes | QA-UX-029 | [TBD] — OQ-UX-14 |
| FR-UX-111 | The HUD shall surface a **free gift** that becomes claimable every **3 hours**, with a countdown to the next claim; the claim affordance's exact form and position are **[TBD — design decision]** — OQ-UX-30. | Must | Mobile | yes | QA-UX-034 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-112 | **[TBD — design decision]** A **multi-day bonus ladder** (and its reset rule) is **not published for this title**; the rebuild **shall not ship a ladder** until the ladder, its rewards and its reset condition are decided — OQ-UX-30. The evidenced daily engagement is the **3-hour free gift** (FR-UX-111) and the **4 h / 24 h chests** (FR-UX-113). | Must | Mobile | yes | QA-UX-034 | [TBD] — OQ-UX-30 |
| FR-UX-113 | The **4-hour and 24-hour free chests** shall be surfaced in the **collectibles area** of the HUD, each with its own countdown to the next claim. | Must | Mobile | yes | QA-UX-034 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-114 | The **Building of the Week** shall be surfaced in the **building shop** as a distinct, time-limited entry that states it is **unique** and available **only that week**, and that it may return much later. | Must | Mobile | yes | QA-UX-034 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-115 | The **monthly add-on** shall be surfaced in the shop and/or a notification, stating it is a **permanent unlock** available for the month, with a permanent-ownership marker once claimed. | Must | Mobile | yes | QA-UX-034 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-116 | The **Piggy Bank** shall be surfaced in the HUD as a fill-level indicator that can be exchanged at a **heavily reduced price** once full. | Should | Mobile | yes | QA-UX-034 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-117 | Tutorial prompts shall be **contextual** — shown when the relevant UI element first becomes available — and shall be skippable and re-openable from a help surface. | Must | Both | yes | QA-UX-030 | [TBD] — OQ-UX-15 |
| FR-UX-118 | An ad-gated speed-up offer shall be presented as a **popup** that can be dismissed without penalty. | Should | Mobile | yes | QA-UX-029 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.10 Onboarding and tutorial (FR-UX-119 … 128)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-UX-119 | A **first-run tutorial** shall run on a new city and teach, in order: the **demand bars**, the **usage bars**, the **90 % rule**, the **government overview panel**, and **tapping money**. | Must | Mobile | yes | QA-UX-030 | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| FR-UX-120 | The tutorial shall **require the action**, not merely display text: e.g. the player must tap a usage bar and read its detail before the tutorial advances. | Should | Mobile | yes | QA-UX-030 | [TBD] — OQ-UX-15 |
| FR-UX-121 | The tutorial shall teach that **some features are not unlocked at the game start** and shall point to where the player finds them later. | Should | Mobile | yes | QA-UX-030 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-122 | A **help / tutorial surface** shall be reachable at any time (help button or pause menu) and shall list the game's how-to topics. | Must | Both | yes | QA-UX-031 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-123 | The PC build's help surfaces shall include **per-system How-To tutorials** following the official naming pattern (`Super Citycon: <Topic> – City Building Game How-To Tutorial`), covering at minimum The Basics, Camera Modes and Switching Maps. | Must | PC-EA | yes | QA-UX-031 | https://www.youtube.com/@supercitycon/videos |
| FR-UX-124 | The tutorial shall **not block** the simulation: the world shall keep running while prompts are visible, and the player may dismiss the tutorial permanently. | Must | Both | yes | QA-UX-030 | [TBD] — OQ-UX-15 |
| FR-UX-125 | The **mailbox** entry point shall surface the player's **tasks and messages** (the mailbox is "mainly where you receive your tasks"); where the task list sits on screen and whether the number of simultaneously visible tasks is capped is **[TBD — design decision]** — OQ-UX-23. | Must | Mobile | yes | QA-UX-030 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-126 | **[TBD — design decision]** A task detail view and its tab structure are **not published for this title**; the rebuild must define how a task's assignments and targets are presented — OQ-UX-23. | Must | Mobile | yes | QA-UX-030 | [TBD] — OQ-UX-23 |
| FR-UX-127 | **[TBD — design decision]** Reward-badging on the task list and any task-timer presentation are **not published for this title**; the rebuild must define how claimable rewards and time limits are shown — OQ-UX-23. | Must | Mobile | yes | QA-UX-030 | [TBD] — OQ-UX-23 |
| FR-UX-128 | In-game **tutorial topics shall be reachable from the HUD** (the tutorial shows them inside the top-left cluster, next to the mailbox); whether a structured "beginner's guide" topic set exists is **[TBD — design decision]** — OQ-UX-24. | Should | Mobile | yes | QA-UX-031 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 3.11 Settings, accessibility and localisation (FR-UX-129 … 142)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-UX-129 | A **settings** surface shall be reachable from the HUD and shall contain at least the **first-person sensitivity options, which depend on the player's device**; the settings entry affordance's position and icon are **[TBD — design decision]** — OQ-UX-25. | Must | Mobile | yes | QA-UX-031 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-130 | Settings shall be **organised into panels**: **audio**, **graphics**, **controls/sensitivity**, **language**, and **accessibility**. | Must | Both | yes | QA-UX-031 | [TBD] — OQ-UX-16 |
| FR-UX-131 | The **audio** panel shall expose independent **music** and **sound-effects** volume controls (and a master mute). | Must | Both | yes | QA-UX-031 | [TBD] — OQ-UX-16 |
| FR-UX-132 | **[TBD — design decision]** The graphics panel's **quality levels** are **not published for this title**; the rebuild must define the tier names and what each tier changes — OQ-UX-26. | Must | Mobile | yes | QA-UX-031 | [TBD] — OQ-UX-26 |
| FR-UX-133 | The graphics panel shall expose a **resolution / render-scale** control and a **fullscreen** toggle. | Should | PC-EA | yes | QA-UX-031 | [TBD] — OQ-UX-16 |
| FR-UX-134 | **[TBD — design decision]** Whether the game exposes an **animation toggle** (and how it is presented, or whether it is disabled at a lower graphics quality) is **not published for this title** — OQ-UX-26. | Must | Mobile | yes | QA-UX-031 | [TBD] — OQ-UX-26 |
| FR-UX-135 | The **controls** panel shall expose **first-person sensitivity per device class**, as separate settings for touch/mobile and mouse+keyboard/PC. | Must | Both | yes | QA-UX-024 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| FR-UX-136 | Settings shall **persist** across sessions and across map switches, and shall be applied without a restart. | Must | Both | yes | QA-UX-031 | [TBD] — OQ-UX-16 |
| FR-UX-137 | The **language** panel shall list the supported locales and apply the choice immediately, re-layouting the HUD in place. | Must | Both | yes | QA-UX-033 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-UX-138 | The rebuild shall implement a **key-based localisation architecture**: every user-facing string is a key resolved through a per-locale string table; no string shall be hard-coded in a layout. The **target locale set** is **[TBD — design decision]** — OQ-UX-27 (the PC title publishes 22 locales with full audio). | Must | Design | yes | QA-UX-033 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-UX-139 | The localisation layer shall support **plural forms, currency/number formatting and date formatting per locale**, and shall handle **right-to-left** mirroring of the HUD. | Should | Both | yes | QA-UX-033 | [TBD] — OQ-UX-17 |
| FR-UX-140 | The HUD shall provide **colour-blind-safe palettes** as an accessibility option, and every status indicator shall remain **legible without colour** (shape/label/icon redundancy). | Should | Both | yes | QA-UX-032 | [TBD] — OQ-UX-18 |
| FR-UX-141 | The HUD shall provide a **text-size / UI-scale** option with at least small / default / large steps that reflows the top bar without clipping. | Should | Both | yes | QA-UX-032 | [TBD] — OQ-UX-18 |
| FR-UX-142 | The build shall support **haptics** on touch devices with an on/off setting for key confirmations (build placed, task complete). | Should | Mobile | yes | QA-UX-032 | [TBD] — OQ-UX-18 |

---

## 4. Options, variants & configuration matrix

### 4.1 HUD element matrix

| HUD element | Position | Mobile simulation | PC Early Access | States | Tap target opens |
|---|---|---|---|---|---|
| Demand block (R/C/I bars) | Top bar, 1st | Yes | No (no economy in EA) | normal / full-demand warning | Demand detail panel per category |
| Usage block (E/W/F/W bars) | Top bar, 2nd | Yes | No | ok (<90 %) / at-risk (≥90 %) / critical (100 %) | Usage detail panel per resource |
| Money | Top bar, 3rd | Yes | No | short / unsorted | toggle on tap; Super Cash detail on long-press |
| Level | Top bar, 4th | Yes | No | static | Level / unlock list |
| Residents (current map) | Top bar, 5th | Yes | No | static | Resident breakdown |
| Date (Day Zero + year) | Top bar, 6th | Yes | No | static | Date / reset calendar |
| City Score & Mayor Score | Top-left | Yes | No | static | Score breakdown |
| Camera-mode button | Top-left | Yes | Yes | perspective / orthographic | Camera options |
| Mini-map | Top-left (mobile) / top-right (PC, diamond) | Yes | Yes | static | Map / jump |
| Science view | Top-left | Yes | No | static | Science overlay |
| Government | Top-left | Yes | No | static | Government overview panel |
| Collectibles area | Top-left | Yes | No | empty / filled | Chests & cards |
| High scores | Top-left | Yes | No | static | Leaderboard |
| Income | Top-left | Yes | No | static | Income breakdown |
| City upgrades | Top-left | Yes | No | static | Upgrade shop |
| Overview (8 services) | Top-left | Yes | No | static | Condensed service summary |
| Mailbox | Top-left | Yes | No | badge / empty | Task list |
| Shop / Building shop | Top-left | Yes | Yes (bottom-left tabs + carousel) | empty / populated | Shop |
| Task / message list | Mailbox entry point (exact placement TBD — OQ-UX-23) | Yes | No | empty / list | Task detail |
| Inventory + bulldozer | Right rail | Yes | No | 3 categories | Bulldozer picker |
| Construction slots | Right rail | Yes | Yes (construction yard tab) | free / used | Slot detail |
| Select / street / undo / redo | Left vertical stack | No (different layout) | Yes | active / inactive | Tool activation |
| Terrain / construction yard / studio tabs | Bottom-left | No | Yes | active / inactive | Panel open |
| ★ favourites + category strip + # | Bottom-centre | No | Yes | selected / unselected | Category filter |
| Gr / Am / De button group | Bottom-centre (right of categories) | No | Yes | selected / unselected | **Unidentified — OQ-UX-19** |
| Catalogue carousel + ‹ › | Above bottom bar | No | Yes | page 1..n | Building placement |
| Search field | Bottom-right | No | Yes | empty / query | Search results |
| 3×3 grid (library) | Bottom-right | No | Yes | closed / open | Library menu |
| Video record / photo (camera) | Bottom-right | No | Yes | armed / capturing | Capture |
| Crescent moon (time of day) | Bottom-right | No | Yes | day / night | Time control |
| Clock + weather chip | Near clock | Yes (per FR-UX-098/101) | Yes | paused / running | Time & weather panel |

### 4.2 Panel matrix

| Panel | Opened from | Contains | Owner of the numbers |
|---|---|---|---|
| Demand detail | Demand bar | exact figures, "you need more of this" guidance | `ECO` |
| Usage detail | Usage bar | production / consumption / %, 90 % & 100 % legend | `ECO` |
| Money (unsorted) | Tap money | grouped receipts and costs | `ECO` |
| Super Cash | Top-left, under the Piggy Bank | Super Cash balance & purchase options | `ECO` |
| Level / unlocks | Tap level | unlocks at level, next requirement | `CORE` |
| Residents | Tap residents | resident amount + growth modifiers (panel contents TBD — OQ-UX-31) | `POP` |
| Date / calendar | Tap date | day, year (panel contents TBD — OQ-UX-31) | `CORE` |
| Government overview | Top-left government | 8 service blocks: circles (coverage) + bars (usage) | `SRV` |
| Service detail | Tap service block | coverage, usage, demand | `SRV` |
| Score breakdown | Tap Mayor Score | Mayor Score, contributing cities | `POP` |
| Building edit mode | Long-press building | rotate action + confirm | `BLD` |
| Task detail | Task list | structure TBD — OQ-UX-23 | `CORE` |
| Road picker | Road name label | type, lanes, one-way, bridge, traffic overlay | `MOB` |
| Free gift | HUD claim affordance (exact form TBD — OQ-UX-30) | free gift, every 3 h | `CORE` |
| Time & weather | Clock / moon button | time of day, speed, weather | `TEC` |

### 4.3 Camera-mode matrix

| Mode | Trigger | Movement | HUD | Exit |
|---|---|---|---|---|
| Orbit / top-down city | Default | pan, yaw, pitch, zoom | full HUD + minimap | n/a |
| Perspective ↔ Orthographic toggle | Camera-mode button | same | camera-mode button shows state | toggle back |
| Walk Mode (first person) | Zoom fully in **or** explicit entry | look + walk, sensitivity per device | reduced HUD, exit button | exit button |
| Third person (character) | PC character mode | follow camera, character input | full HUD | toggle back |
| Region View | Zoom fully out (twice) | pan between map thumbnails | region HUD + map chips | tap a map |
| Street View (mobile) | Explicit entry point | on-foot walk, look, interact | reduced HUD, exit button | exit button |
| Photo / cinematic capture | Camera & video buttons | camera may orbit slowly | HUD hidden/minimised | press again |

### 4.4 Settings matrix

| Panel | Option | Values evidenced | Default | Applies to |
|---|---|---|---|---|
| Audio | Music volume | continuous | [TBD] OQ-UX-16 | Both |
| Audio | SFX volume | continuous | [TBD] OQ-UX-16 | Both |
| Graphics | Quality | tier names **not published** — OQ-UX-26 | [TBD] OQ-UX-26 | Both |
| Graphics | Animation toggle | existence **not published** — OQ-UX-26 | [TBD] OQ-UX-26 | mobile |
| Graphics | Resolution / render scale | TBD | TBD | PC |
| Graphics | Fullscreen | on / off | off | PC |
| Controls | First-person sensitivity | per device class (touch / mouse+kb), value TBD | TBD | Both |
| Controls | Invert Y / pan direction | TBD | TBD | Both |
| Language | Locale list | **22 locales** (Steam, full audio) / **21 ISO codes** (iOS) | system locale | Both |
| Accessibility | Colour-blind palette | TBD | TBD | Both |
| Accessibility | Text size / UI scale | TBD | TBD | Both |
| Accessibility | Haptics | on / off | TBD | touch |

---

## 5. Stage / progression matrix

This domain's stage dimension is **(camera/mode stage) × (city stage)**; city-stage gating itself is owned by `CORE`.

| Stage | Entry condition | UI surfaces available | Not yet available | Exits when |
|---|---|---|---|---|
| `PC-EA` (PC Early Access sandbox) | Launch of Steam build (Q4 2026) | Left tool stack (select/street/undo/redo); bottom-left tabs (terrain, construction yard, SCC Studio); category strip + catalogue carousel + search; bottom-right cluster (grid/video/moon/camera); diamond minimap; How-To help topics; SCC Studio | Demand/usage/money/level/resident/date bars; government overview; **Region View** (evidenced on the **mobile** title only — OQ-UX-33); on-foot Street View (demo had no walking); economy/progression UI | Mode change (not shipped in EA) |
| `Mobile` — first session | New city created | Top bar (6 blocks); tutorial prompts (demand bars, usage bars, 90 % rule, government panel, money tap); mailbox entry point (tasks and messages); settings reachable from the HUD | Some features are locked at start and are pointed to by the tutorial | Tutorial completed |
| `Mobile` — early city | First city built; resident amount raises the level | Science view; city upgrades (coins and Super Cash); income; high scores; collectibles (chests, bonus cards, Piggy Bank); storage; walk mode | Content gated behind higher levels (level derives from the resident amount) | Level gates open |
| `Mobile` — Region View | Multiple maps exist | Region View with per-map thumbnails, **active map blue**, map chips; per-map residents/date; region Mayor Score; globe icons on globally connected resources | A second simultaneous region ("one region for now") | Tap a map to enter it |
| `Mobile` — Street View | Player chooses to enter | First-person walkthrough; exit button; HUD-hiding | — | Exit button |
| `PC-EA` — PC 2.0 feature set | Announced, unshipped | **New orthographic camera mode**; expanded language support; economy UI mirroring the mobile bars. **Region View is not in the PC evidence set** — the 2.0 announcement's Region View bullet is the **mobile** title's version-two feature (OQ-UX-33) | — | Not shipped — do not build against a date |

---

## 6. Data model

### 6.1 HUD widget state

| Field | Type | Range / values | Meaning | Source |
|---|---|---|---|---|
| `hud.demand[r,c,i].value` | float 0–1 | 0–1 | Capacity used for that class | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| `hud.demand[].full` | bool | — | Demand bar saturated ⇒ need more of that class | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| `hud.usage[e,w,f,wa].pct` | float 0–1 | 0–1 | Consumption ÷ production | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| `hud.usage[].band` | enum | `ok` (<0.90) / `at_risk` (≥0.90) / `critical` (=1.0) | Growth effect band | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| `hud.money.displayMode` | enum | `short` / `unsorted` | Tap-toggled money format | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `hud.money.currency` | int | ≥0 | Spendable balance | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `hud.money.superCash` | int | ≥0 | Premium balance (own HUD surface) | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `hud.level` | int | ≥1 | Derived from residents, no XP | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `hud.residents` | int | ≥0 | Residents of **active map** | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `hud.date.day` | int | starts at **0** | Day counter (Day Zero) | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `hud.date.year` | int | ≥0 | Year counter | https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| `hud.scores.city` / `.mayor` | int | ≥0 | City Score / Σ City Scores in region | https://www.youtube.com/watch?v=_QpxzZFTBtw |
| `hud.service[s].coverage` | float 0–1 | 0–1 | Circle fill (want full) | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| `hud.service[s].usage` | float 0–1 | 0–1 | Bar fill (want low) | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| `hud.service[s].developed` | bool | — | False ⇒ "not fully developed" | https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| `hud.service[s].global` | bool | — | Globe icon: region-wide connection | https://www.youtube.com/watch?v=m5O-A33wQm0 |
| `hud.constructionSlots` | `{free:int, used:int, required:int}` | ≥0 | Slot state; large buildings need ≥2 | https://www.youtube.com/watch?v=jYAD0SkDmY0 |

### 6.2 Panel model

| Field | Type | Meaning |
|---|---|---|
| `panel.id` | string | Unique panel instance |
| `panel.kind` | enum | `demand_detail`, `usage_detail`, `money`, `super_cash`, `level`, `residents`, `date`, `government`, `service_detail`, `score`, `building_edit`, `task_detail`, `road_picker`, `free_gift`, `time_weather`, `settings` |
| `panel.stack` | ordered list | Modal stacking; only the top is interactive |
| `panel.origin` | widget id | Which HUD element opened it |
| `panel.live` | bool | Re-render on simulation tick |
| `panel.dismissibleBy` | set | `close_button`, `outside_tap`, `back_gesture` |
| `panel.payload` | object | Kind-specific data (e.g. `{resource:'food'}`) |

### 6.3 Camera rig

| Field | Type | Range | Meaning |
|---|---|---|---|
| `camera.mode` | enum | `orbit`, `walk`, `third_person`, `region` | Active rig |
| `camera.projection` | enum | `perspective`, `orthographic` | Projection; tilt-shift only in perspective |
| `camera.position` | vec3 | — | World position |
| `camera.target` | vec3 | — | Orbit pivot |
| `camera.yaw` | float | 0–360° | Rotation |
| `camera.pitch` | float | clamped **[TBD]** OQ-UX-06 | Tilt |
| `camera.distance` | float | `dMin`…`dMax` | Zoom; `dMax` ⇒ region transition, `dMin` ⇒ walk transition |
| `camera.fov` | float | per projection | Field of view |
| `camera.tiltShift` | bool | — | Perspective-only depth-of-field look |
| `camera.exitState` | snapshot of the above | — | Restored on exit from walk/region |
| `camera.sensitivity[touch,mouse]` | float | 0–1 | Per-device first-person sensitivity (https://www.youtube.com/watch?v=jYAD0SkDmY0) |
| `camera.collision` | enabled | — | Never inside geometry or under terrain |

### 6.4 Input map

| Action | Touch | Mouse + keyboard | Notes |
|---|---|---|---|
| Select / inspect | tap | LMB | Tap ≠ drag |
| Pan camera | one-finger drag | MMB / RMB drag | Orbit rig |
| Rotate (yaw) | one-finger drag (camera mode) | MMB / RMB drag | — |
| Tilt (pitch) | two-finger drag | — | Clamped |
| Zoom | pinch | wheel | Thresholds trigger mode changes |
| Place road | tap map → tap direction gizmo | same | "Bop" feedback |
| Demolish | tap object with bulldozer active | same | Category must be enabled |
| Rotate building | long-press building → edit mode → rotate button | same | Which classes expose it is TBD — OQ-UX-22 |
| Switch tool | tap tool in stack | hotkey | Mutually exclusive |
| Undo / redo | toolbar | Ctrl+Z / Ctrl+Y | PC EA confirmed in tool stack |
| Cancel tool | back gesture / ESC | ESC | Returns to select |
| Move (walk) | virtual stick | WASD | First person |
| Look | drag right half | mouse | Sensitivity-scaled |
| Interact | tap prompt | E | Street View |
| Open panel | tap widget | LMB | — |
| Toggle money display | tap money | LMB | — |
| Super Cash detail | Tap Super Cash surface (under the Piggy Bank) | — | Own HUD surface |

### 6.5 Settings schema

| Path | Type | Values | Default |
|---|---|---|---|
| `audio.music` | float 0–1 | — | [TBD] OQ-UX-16 |
| `audio.sfx` | float 0–1 | — | [TBD] OQ-UX-16 |
| `audio.muted` | bool | — | false |
| `graphics.quality` | enum | tier names **not published** — OQ-UX-26 | [TBD] OQ-UX-26 |
| `graphics.resolutionScale` | float | — | 1.0 |
| `graphics.fullscreen` | bool | — | false |
| `graphics.animation` | bool | existence **not published** — OQ-UX-26 | [TBD] OQ-UX-26 |
| `graphics.tiltShift` | bool | — | false |
| `controls.sensitivity.touch` | float 0–1 | — | [TBD] OQ-UX-05 |
| `controls.sensitivity.mouse` | float 0–1 | — | [TBD] OQ-UX-05 |
| `controls.invertY` | bool | — | false |
| `language.locale` | string | 22 evidenced locales (Steam) / 21 ISO codes (iOS) — target set OQ-UX-27 | system |
| `accessibility.palette` | enum | `default`, `deuteranopia`, `protanopia`, `tritanopia`, `highContrast` | default |
| `accessibility.textScale` | enum | `small`, `default`, `large`, `xlarge` | default |
| `accessibility.haptics` | bool | — | true |

### 6.6 Notification model

| Field | Type | Values | Meaning |
|---|---|---|---|
| `notification.id` | string | — | Unique |
| `notification.kind` | enum | `info`, `reward`, `warning`, `blocking`, `tutorial`, `event`, `shop` | Presentation class |
| `notification.priority` | int | lower = sooner | Queue ordering within a kind |
| `notification.expiresAt` | timestamp | — | Time-based event expiry (daily gift, chests, weekly building) |
| `notification.action` | `{surface, payload}` | — | Where tapping goes |
| `notification.dismissible` | bool | — | Blocking alerts are false |
| `notification.ttl` | duration | — | Auto-dismiss time (informational only) |
| `notification.state` | enum | `queued`, `showing`, `claimed`, `expired` | Queue lifecycle |

---

## 7. Rules, formulas & tuning

- **Usage thresholds (evidenced).** `pct < 0.90` ⇒ no growth penalty. `0.90 ≤ pct < 1.00` ⇒ **city growth is reduced**. `pct = 1.00` ⇒ **city stops growing**. These are the only documented usage thresholds (https://www.youtube.com/watch?v=LmY_TpU1B5Y).
- **Demand semantics (evidenced).** A **full** demand bar means demand is exhausted for that class ⇒ the player must build more of that class (https://www.youtube.com/watch?v=LmY_TpU1B5Y).
- **Coverage vs usage (evidenced).** In the government panel, **circles = coverage (want full)** and **bars = usage/demand (want low, below 90 %)** (https://www.youtube.com/watch?v=LmY_TpU1B5Y).
- **Score semantics (evidenced).** City Score = f(residents, happiness); Mayor Score = Σ City Scores of all maps in the region; shown top-left and in the overview (https://www.youtube.com/watch?v=_QpxzZFTBtw).
- **Level semantics (evidenced).** Level is a direct function of resident amount; no XP (https://www.youtube.com/watch?v=jYAD0SkDmY0).
- **Date semantics (evidenced).** The clock starts at **Day Zero** and the year counter advances with the in-game days (https://www.youtube.com/watch?v=jYAD0SkDmY0). The clock's **time base** (UTC vs device-local) and any local-offset display are **[TBD — design decision]** — OQ-UX-21.
- **Zoom thresholds (evidenced).** Fully zoomed in ⇒ **Walk Mode**; fully zoomed out **twice** ⇒ **Region View** (https://www.youtube.com/watch?v=jYAD0SkDmY0).
- **Camera rotation (evidenced).** Rotation **auto-snaps every 55°**; perspective is the default camera on first launch and is the only projection with **tilt-shift** (https://www.youtube.com/watch?v=ovWkwWS5FlY).
- **Direction gizmo rule (evidenced).** The gizmo shows **every build direction that is possible** at the tapped point — and only those (https://www.youtube.com/watch?v=jYAD0SkDmY0).
- **Free-gift cadence (evidenced).** A **free gift every 3 hours**; the premium options can be unlocked every **8 hours** by watching **4 ads**; free **chests every 4 h / 24 h** give collectible parts and bonus cards; the **Piggy Bank** accumulates Super Cash over time and is purchasable at a heavily reduced price once full (https://www.youtube.com/watch?v=jYAD0SkDmY0). A multi-day bonus ladder and its reset rule are **[TBD — design decision]** — OQ-UX-30.
- **Graphics quality / animation rule (unevidenced).** No public source for this title states the graphics quality tiers, an animation toggle, or any dependency between them — **[TBD — design decision]** — OQ-UX-26.
- **Sensitivity mapping (rule to implement).** Look delta = `pointerDelta × sensitivity[device] × dt`. Speed of travel in walk mode is a separate constant, not a function of look sensitivity. Exact defaults are TBD (OQ-UX-05).
- **Tap vs drag rule (rule to implement).** A pointer sequence lasting under **~250 ms** with movement under a small threshold is a **tap**; anything longer or further is a **drag** and must not select or place. Threshold values TBD (OQ-UX-07).
- **Panel modality.** Panels are modal-stack; only the top panel receives input; the simulation keeps running underneath (live panels re-render).

---

## 8. Edge cases, failure modes & required behaviours

| # | Case | Required behaviour |
|---|---|---|
| E1 | Tapping the money widget while a panel is open | Money toggle still applies; no panel stacking error |
| E2 | The platform has no long-press gesture and the player wants the premium balance | The Super Cash surface stays reachable from its own HUD entry point (under the Piggy Bank) |
| E3 | A demand bar reaches full while the demand panel is open | Panel re-renders live and the bar enters the warning state without closing |
| E4 | Usage crosses 90 % and then 100 % mid-panel | Band change must be signalled; at 100 % a blocking warning is raised (FR-UX-026) |
| E5 | No resources at all (usage 0) | Bars render at 0 and must not be confused with "no data"; show an explicit "no production" state |
| E6 | Map switched while in Region View | Top-bar residents and date update to the newly active map; money stays shared |
| E7 | Region View with a single map | Region View still reachable; must not show a misleading multi-map layout |
| E8 | Zooming fully out with one map | Region View entered; zoom-out must not be a dead end |
| E9 | Entering Walk Mode where the player is inside geometry | Camera must be pushed to a valid spawn (last valid position) |
| E10 | Exiting Walk Mode after the city was demolished under the player | Restore the last valid camera state, not the exact now-invalid position |
| E11 | Graphics quality is changed while a quality-dependent toggle is on | Behaviour is **[TBD — design decision]** — OQ-UX-26 (no public evidence of quality tiers or of any dependent toggle) |
| E12 | The device time zone differs from the simulation clock's time base | The HUD must not display a silently wrong day or year — the time base is **[TBD — design decision]**, OQ-UX-21 |
| E13 | Locale changed to a longer language | HUD must reflow; no widget may clip or overlap |
| E14 | Locale changed to an RTL locale (none currently shipped) | Layout must mirror; mirror support required even though the 22 shipped locales are LTR |
| E15 | A Building-of-the-Week entry expires while the shop is open | Entry must be withdrawn and shown as expired, not left purchasable |
| E16 | The free-gift timer expires while its claim affordance is on screen | The affordance resets to its not-ready state and shows the next countdown |
| E17 | Two notifications raised in the same tick | Queue delivers in order; the second is visibly pending |
| E18 | A blocking warning raised while a toast is showing | Blocking warning preempts the toast; the toast returns to the queue |
| E19 | Building placed with insufficient construction slots | Placement blocked, message names required vs available slots (FR-UX-056) |
| E20 | Bulldozer category unchecked for the tapped object | Object is not removed; explicit "category disabled" feedback |
| E21 | Rotate is invoked on a building class that does not support rotation | The rotate action is not offered — which classes do not support it is **[TBD — design decision]**, OQ-UX-22 |
| E22 | Tutorial prompt appears while the player is in Walk Mode | Prompt must not block the exit button |
| E23 | Player taps a HUD widget while dragging the camera | The drag wins; no panel opens (tap/drag disambiguation) |
| E24 | App loses focus (mobile backgrounded) during a live panel | Panel state persists; timers keep counting on the server clock, not the render clock |

---

## 9. Non-functional requirements

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| NFR-UX-001 | The HUD shall render and remain interactive within **16 ms** of the simulation state changing (one frame at 60 fps) on the reference device. | Must | Both | yes | QA-UX-001 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| NFR-UX-002 | Opening any detail panel shall take **≤ 1 frame** and shall not cause a visible hitch in the city simulation. | Must | Both | yes | QA-UX-007 | [TBD] — OQ-UX-02 |
| NFR-UX-003 | All HUD text shall remain legible at the smallest supported UI scale and at a 4:3 aspect ratio without truncation of any widget label. | Must | Both | partial | QA-UX-001 | [TBD] — OQ-UX-18 |
| NFR-UX-004 | The HUD shall be usable with **one hand** on a 5-inch phone in portrait and landscape; primary actions reachable within the bottom third. | Should | Mobile | yes | QA-UX-001 | [TBD] — OQ-UX-01 |
| NFR-UX-005 | Every status colour pair shall meet **WCAG AA contrast (≥ 4.5:1)** for text and **≥ 3:1** for graphical indicators, in every colour-blind palette. | Must | Both | yes | QA-UX-032 | [TBD] — OQ-UX-18 |
| NFR-UX-006 | The HUD shall remain usable at **320 px** effective width (small phone) and at **2560 × 1440** (desktop) without layout breakage. | Must | Both | yes | QA-UX-001 | [TBD] — OQ-UX-01 |
| NFR-UX-007 | Camera transitions (↔ walk, ↔ region, ↔ orthographic) shall be **frame-rate independent** and shall not drop below the target frame rate. | Must | Both | partial | QA-UX-020 | [TBD] — OQ-UX-08 |
| NFR-UX-008 | All user-facing strings shall be **externalised** so that adding a locale requires no code change and no layout re-authoring. | Must | Both | yes | QA-UX-033 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| NFR-UX-009 | Settings shall be written to persistent storage within **1 second** of change and re-read identically on next launch. | Must | Both | partial | QA-UX-031 | [TBD] — OQ-UX-16 |
| NFR-UX-010 | The notification queue shall hold at least **20** pending notifications without loss, and shall survive a scene/map change. | Should | Both | yes | QA-UX-029 | [TBD] — OQ-UX-14 |
| NFR-UX-011 | The HUD shall render correctly at **1×–3× device pixel ratio** without blurry sprites or clipped 9-slice borders. | Should | Both | yes | QA-UX-001 | [TBD] — OQ-UX-16 |
| NFR-UX-012 | Input latency for camera look in Walk Mode shall be **≤ 50 ms** end-to-end on the reference device at the default sensitivity. | Must | Both | partial | QA-UX-024 | [TBD] — OQ-UX-05 |

---

## 10. Acceptance-criteria suites

| ID | Given | When | Then | Covers |
|---|---|---|---|---|
| QA-UX-001 | A new city in a simulation mode | The top bar renders | Six blocks appear in order (demand, usage, money, level, residents, date); each is an independent tap target ≥44 px; all are inside the safe area | FR-UX-001..004, 010, 017..020, NFR-UX-001/003/006 |
| QA-UX-002 | The top bar is visible | The player taps the money widget | The display toggles short ↔ unsorted and no panel opens | FR-UX-005, 028 |
| QA-UX-003 | The top bar is visible | The player opens the Super Cash surface under the Piggy Bank | A separate Super Cash balance and the Super Cash purchase options are shown, distinct from the coins balance in the money widget | FR-UX-006 |
| QA-UX-004 | A city at Day Zero | 400 in-game days elapse | The date widget shows Day 400 and the year counter has advanced by 1; the day boundary follows the single time base fixed by OQ-UX-21 | FR-UX-009, 031, 104 |
| QA-UX-005 | Two maps with different resident counts | The player switches the active map | The resident widget changes to the new map's count; money is unchanged | FR-UX-008, 083, 088 |
| QA-UX-006 | A city whose residents cross a level threshold | The threshold is crossed | The level widget increments; tapping it lists that level's unlocks | FR-UX-007, 029 |
| QA-UX-007 | The demand block is visible | The player taps the industrial demand bar | A detail panel shows exact industrial figures and the "you need more of this type" rule | FR-UX-021, 022, 032, 033 |
| QA-UX-008 | The usage block is visible | The player taps the food usage bar | A detail panel shows production, consumption, exact % and a projection note when a shortage is forecast | FR-UX-023, 027, 034 |
| QA-UX-009 | Food usage is set to 89 %, then 90 %, then 100 % | Each value is applied | 89 % shows "fine"; 90 % shows "growth reduced" and a distinct state; 100 % shows "city stops growing" and raises a blocking warning | FR-UX-024, 025, 026, 110 |
| QA-UX-010 | Industrial demand is saturated | The bar is inspected | The bar shows full and the panel states that industrial capacity is exhausted | FR-UX-002, 022 |
| QA-UX-011 | The government button is tapped | The overview opens | Eight service blocks are present, each with a circle (coverage) and a bar (usage), plus the Mayor Score | FR-UX-035..040, 042..044 |
| QA-UX-012 | A service covers half the population | The overview renders | The coverage circle shows partial coverage and is distinguishable from a full circle (fill encoding per OQ-UX-29) | FR-UX-037 |
| QA-UX-013 | A service's coverage is incomplete | The overview renders | The block shows the "not fully developed" label in addition to the partial circle | FR-UX-038 |
| QA-UX-014 | A region with three maps | The HUD renders | The Mayor Score appears top-left and in the overview and equals the sum of the three maps' City Scores | FR-UX-041, 087 |
| QA-UX-015 | The street tool is selected and a type chosen | The player taps the map, then a direction gizmo | Only legal directions show; tapping one places the street with the "Bop" feedback; the tool stays active for a continuous run | FR-UX-047..050, 075 |
| QA-UX-016 | The inventory's bulldozer is open with "streets" enabled | The player taps a street and then a tree while "trees" is disabled | The street is removed; the tree is not, and the UI explains the disabled category | FR-UX-051, 052 |
| QA-UX-017 | A tool is active | The player selects another tool, then cancels | Tools are mutually exclusive, the active tool is ring-highlighted, and cancel returns to select without placing anything | FR-UX-011, 057, 058, 060, 059 |
| QA-UX-018 | The PC build is running | The player opens the catalogue | A category strip and paged carousel of model+name cards are shown; paging arrows move the set; search filters | FR-UX-013, 014, 053 |
| QA-UX-019 | The player has 1 free slot and places a building needing 2 | The placement is attempted | It is blocked with a message naming required (2) and available (1); after buying a Citycon Building a second slot appears permanently | FR-UX-055, 056, 106 |
| QA-UX-020 | The camera is at maximum zoom-in | The player zooms fully in | The camera transitions continuously into Walk Mode with first-person controls | FR-UX-061, 063, 067, 074, 076 |
| QA-UX-021 | The camera is at maximum zoom-out | The player zooms out | The camera transitions into Region View showing all maps with the active map in blue | FR-UX-062, 079, 080, 084, 016, 078 |
| QA-UX-022 | Region View is open with 3 maps | The player taps a map thumbnail | That map becomes active, the camera enters it, and the top bar switches to its residents and date | FR-UX-081..088, 082, 086 |
| QA-UX-023 | The player is in Walk Mode or Street View | The exit button is tapped | The previous camera state (position, pitch, zoom, mode) is restored exactly | FR-UX-064, 089, 090, 093, 094, 096 |
| QA-UX-024 | Settings › Controls is open | The player changes sensitivity for touch and for mouse+kb | The two values are independent and persist; look response changes accordingly | FR-UX-065, 066, 135, 136, NFR-UX-012 |
| QA-UX-025 | A character has been created in SCC Studio | Third-person mode is enabled | The character is rendered with a follow camera that avoids terrain and buildings; the character can be switched | FR-UX-071..073 |
| QA-UX-026 | The HUD top-left camera button is tapped | The camera mode is toggled | Projection switches perspective ↔ orthographic and the button reflects the state; tilt-shift is offered only in perspective | FR-UX-068, 069, 070 |
| QA-UX-027 | The game is running | The clock / moon button is opened | The time of day can be set, the speed can be changed, and the scene lighting updates immediately | FR-UX-097..100, 103, 105, 077 |
| QA-UX-028 | The weather panel is open | A weather condition is selected | The selected condition is shown next to the clock and the scene reflects it | FR-UX-101, 102 |
| QA-UX-029 | Several notifications are raised | The player watches the HUD | Toasts appear one at a time in FIFO order, pending count is visible, and blocking warnings preempt toasts | FR-UX-107..110, 118, NFR-UX-010 |
| QA-UX-030 | A new city is created | The first-run tutorial runs | It teaches demand bars, usage bars, the 90 % rule, the government panel and tapping money, in that order, and the mailbox entry point (tasks and messages) is available in the HUD | FR-UX-119..121, 124..127, 046 |
| QA-UX-031 | Settings is opened from its HUD entry point | Each panel is inspected | Audio (music/sfx), graphics, controls (per-device sensitivity) and language panels exist and every change persists across relaunch; the graphics tier names and the animation toggle follow OQ-UX-26 | FR-UX-129..136, 122, NFR-UX-009 |
| QA-UX-032 | Accessibility options are enabled | The HUD renders | A colour-blind palette applies, text size changes reflow the top bar without clipping, and haptics fire on key confirmations | FR-UX-140..142, NFR-UX-003/005 |
| QA-UX-033 | The language list is opened | Each of the 22 locales is selected in turn | The HUD re-renders in that locale with no clipped or overlapping widget; numbers, currency and dates use locale formatting | FR-UX-137..139, NFR-UX-008 |
| QA-UX-034 | A free gift, 4 h and 24 h chests, a Building of the Week and a monthly add-on are all live | The player walks the HUD | The free gift shows a claim affordance with a 3-hour countdown (its exact form per OQ-UX-30); chests appear in the collectibles area with 4 h / 24 h countdowns; the weekly building appears in the shop labelled unique and week-limited; the add-on is labelled a permanent unlock; **no multi-day bonus ladder is offered while OQ-UX-30 is undecided** | FR-UX-111..116, 045, 054 |

---

## 11. Open questions & TBDs

| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| OQ-UX-01 | Does the mobile top bar collapse on short viewports, and what is the manual expand affordance? | Affects layout reflow on small phones/landscape | Keep the six blocks always visible; shrink icons before hiding content. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-02 | Are detail panels modal (blocking) or overlay (non-blocking)? | Changes input routing and whether the simulation continues | Overlay, non-blocking, live-updating, dismissible by close/outside-tap/back. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-03 | What is the third bulldozer category (only "trees" and "streets" are observed)? | The bulldozer UI must list the right categories | Expose three data-driven categories; ship trees, streets, and "decorations". Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-04 | What are the exact cancel semantics for an active tool? | Affects undo/redo and accidental placement | ESC / back gesture cancels; tapping the active tool also cancels. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-05 | What is the first-person sensitivity range, its presets, and its default per device class? | Needed for the feel of Walk Mode | Continuous 0–100 slider, default 50 on touch, 40 on mouse+kb. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-06 | What are the camera pitch-clamp and orbit limits (min/max pitch, min distance)? | Prevents the camera passing through terrain and defines the zoom thresholds | Pitch clamp 15°–85°, min distance 1.5 m, max = map diagonal. Evidence: [TBD] — https://www.youtube.com/watch?v=ovWkwWS5FlY |
| OQ-UX-07 | What is the tap-vs-drag disambiguation threshold (ms and px)? | Prevents accidental selection while panning | Tap ≤ 250 ms and ≤ 10 px movement. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-08 | Should the walk/region transitions be continuous camera moves or cuts? | Affects camera code and feel | Continuous interpolated move over ≈ 0.6 s. Evidence: [TBD] — https://www.youtube.com/watch?v=ovWkwWS5FlY |
| OQ-UX-09 | What per-map summary chips does the mobile Region View show? | The player needs residents/date at a glance per map | Name, resident count, day/year. Evidence: [TBD] — https://www.youtube.com/watch?v=vBJdlAeLn0g |
| OQ-UX-10 | What are the explicit Street View entry points and on-screen controls? | Street View needs deliberate entry, not only a zoom threshold | A dedicated HUD button plus a "visit" action on the city name; left thumb-stick + right-side look. Evidence: [TBD] — https://www.youtube.com/watch?v=ovWkwWS5FlY |
| OQ-UX-11 | Does Street View have a HUD-hiding cinematic toggle? | Needed for sightseeing and for PC parity | Yes — a hide-HUD button beside exit. Evidence: [TBD] — https://www.youtube.com/watch?v=ovWkwWS5FlY |
| OQ-UX-12 | What time-of-day presets and simulation-speed steps exist? | The clock and speed control must be implementable | Presets dawn/day/dusk/night; speeds pause, 1×, 2×, 4×. Evidence: [TBD] — https://store.steampowered.com/api/appdetails?appids=3474890 |
| OQ-UX-13 | What is the full weather option list? | The selector must be data-driven | clear, cloudy, rain, storm, snow, fog (+ severe: tornado, fire on the PC demo). Evidence: [TBD] — https://store.steampowered.com/api/appdetails?appids=3474890 |
| OQ-UX-14 | What are the notification presentation classes and durations? | Toast design and queue behaviour | info/reward/warning/blocking/tutorial/event/shop; info auto-dismiss 4 s. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-15 | Are tutorial prompts blocking or skippable, and where are they re-opened? | Onboarding flow | Non-blocking, skippable, re-openable from the help surface. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-16 | What are the full settings values (audio defaults, graphics quality tiers, resolution steps)? | Settings panel completeness | Music 0.7, SFX 0.9, quality medium, scale 1.0. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-17 | Do any shipped locales require RTL, and is number/date formatting locale-aware? | Localisation architecture | Support RTL in the layout engine; format numbers/dates per locale. Evidence: [TBD] — https://itunes.apple.com/lookup?id=1607860732&country=us |
| OQ-UX-18 | Are colour-blind palettes, text size and haptics confirmed features or desired additions? | Accessibility section is entirely unevidenced beyond contrast | Implement as standard options with the proposed defaults. Evidence: [TBD] — no public source states them |
| OQ-UX-19 | What are the PC "Gr / Am / De" buttons in the bottom-centre strip? | They are visible in the store screenshots but unidentified | Treat as three named display/quality presets; label them out until confirmed. Evidence: [TBD] — https://store.steampowered.com/app/3474890/ |
| OQ-UX-20 | Is the evidenced **3-hour free gift** the only timed grant, or does a multi-day/seasonal ladder exist alongside it? | The bonus cadence drives the notification queue and the HUD claim surface | Implement the evidenced 3-hour free gift; add any ladder only by explicit decision (OQ-UX-30). Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-21 | What is the simulation clock's time base — UTC or device-local — and is the player's local offset surfaced? | A wrong day boundary is silently wrong data in the HUD | Fix one time base server-side and never display a day the player did not reach. Evidence: [TBD] — https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| OQ-UX-22 | Which building classes expose the rotate action, and how is a non-rotatable class presented? | The edit-mode surface must not offer an action it cannot perform | Rotate is offered per building class; the class table is data-driven. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-23 | Where does the task/message list live, is it capped, and what does a task detail view contain? | The task surface is the main onboarding funnel after the tutorial | Mailbox entry point opens a task list; detail shows assignments and targets. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-24 | Is there a structured in-game help/topic set (a "beginner's guide" equivalent)? | Onboarding knowledge should not be stranded on the web | Tutorial topics live in the HUD cluster and are re-openable. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-25 | Where does the settings surface open from, and what is its icon? | A dedicated, findable settings entry | A settings entry in the top-left cluster, icon set by the art pass. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-26 | What are the graphics quality tiers, and does an animation toggle exist (and depend on the tier)? | The graphics panel and any dependent toggle need a defined model | Define tiers by measured cost; expose an animation toggle only if it has a player-visible effect. Evidence: [TBD] — https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| OQ-UX-27 | Which locale set is the rebuild target — the PC title's 22 shipped locales, the iOS 21 ISO codes, or a subset? | Determines the string-table size and the translation pipeline | Target the union of the two evidenced lists. Evidence: [TBD] — https://store.steampowered.com/api/appdetails?appids=3474890 |
| OQ-UX-28 | May any top-bar readout ever be gated behind an advertisement or a premium unlock? | A gated HUD value breaks the non-blocking contract | No top-bar readout is ever gated; premium options act on rewards instead. Evidence: [TBD] — https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| OQ-UX-29 | How are the usage bands and the coverage circles encoded visually, so state is legible without colour alone? | The bars and circles are the main glanceable readouts | Fill level plus a text/label state for each band and each coverage state. Evidence: [TBD] — https://www.youtube.com/watch?v=LmY_TpU1B5Y |
| OQ-UX-30 | Is there a multi-day bonus ladder (and reset rule) beyond the 3-hour free gift, and what is the claim affordance? | The claim surface and the notification queue depend on it | Ship the 3-hour free gift with a countdown affordance; no ladder until decided. Evidence: [TBD] — https://www.youtube.com/watch?v=jYAD0SkDmY0 |
| OQ-UX-31 | What do the top-bar detail panels show — level unlocks, resident growth modifiers, date/reset schedule, score breakdown, service advice? | The panels are the game's main teaching surface | Each panel shows the value it belongs to plus the modifier/advice that explains it. Evidence: [TBD] — https://www.youtube.com/watch?v=_QpxzZFTBtw |
| OQ-UX-32 | What minimum hit-target size and safe-area insets does the HUD use? | The touch targets and the notch/home-indicator avoidance | 44×44 px logical targets with platform safe-area insets. Evidence: [TBD] — https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 |
| OQ-UX-33 | Does the **PC title** ship a Region View in the 2.0 feature set? | The 2.0 announcement ("Android Debut, New Orthographic Camera Mode, Introducing the Region View, Economy Update and Rebalancing, Expanded Language Support") is the **mobile** 2.0 release — the mobile tutorial dates Region View to version two — and no PC source evidences a Region View, so the PC build must not inherit the claim by accident. | **No Region View in the PC Early Access build**; the mobile Region View (FR-UX-079…FR-UX-084) is the reference implementation. PC parity is a design decision for a later release. Evidence: [TBD] — https://www.youtube.com/watch?v=vBJdlAeLn0g |

---

## 12. Source list

| # | URL | What it gave us | Retrieved |
|---|---|---|---|
| 1 | https://www.youtube.com/watch?v=jYAD0SkDmY0 | "The Basics" — top-bar composition, demand/usage rules, 90 % rule, government panel, construction slots, street-build "Bop", inventory/bulldozer, zoom→walk/region, top-left HUD cluster, mailbox/tasks, storage, chests, Piggy Bank, free gift cadence, settings/sensitivity, long-press→edit mode with rotate | 2026-10-23 (transcript read verbatim) |
| 2 | https://www.youtube.com/watch?v=vBJdlAeLn0g | "Switching Maps" — Region View, all maps shown, active map blue, one region for now | 2026-10-23 |
| 3 | https://www.youtube.com/watch?v=ovWkwWS5FlY | "Camera Modes" — orthographic ↔ perspective toggle, tilt-shift in perspective only, 55° rotation auto-snap, first-person entry and exit, region entry | 2026-10-23 |
| 4 | https://www.youtube.com/watch?v=m5O-A33wQm0 | "Connected Economies" — globe icon + global numbers on the economy panel | 2026-10-23 |
| 5 | https://www.youtube.com/watch?v=LmY_TpU1B5Y | "Economy Overview" — demand vs usage bars, coverage circles, the 90 %/100 % thresholds, the eight service categories, "not fully developed" block, Mayor Score in the overview | 2026-10-23 |
| 6 | https://www.youtube.com/watch?v=CIb2IWyNPJw | "Resident Bonuses" — the six resident bonuses and how they scale the resident amount and the residential capacity | 2026-10-23 |
| 7 | https://www.youtube.com/watch?v=_QpxzZFTBtw | "Happiness & Mayor Score" — City Score, Mayor Score as the region aggregate, and where the score is displayed | 2026-10-23 |
| 8 | https://www.youtube.com/watch?v=yuLUP_ELk4I | Existence of the "Water Supply System" how-to | 2026-10-23 |
| 9 | https://www.youtube.com/@supercitycon/videos | Official how-to catalogue and naming pattern | 2026-10-23 |
| 10 | https://store.steampowered.com/api/appdetails?appids=3474890 | PC feature list, 22 supported languages with full audio, about-the-game text (traffic, pedestrians, first/third person), screenshots list | 2026-10-23 |
| 11 | https://store.steampowered.com/app/3474890/ | PC store page + 16 screenshots read as pixels (left tool stack, bottom-left tabs, category strip, Gr/Am/De, catalogue carousel, search, grid/video/moon/camera, diamond minimap) | 2026-10-23 |
| 12 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 | Demo has a full day/night cycle and fires/tornadoes; no on-foot walking in the demo | 2026-10-23 |
| 13 | https://supercitycon.net/ | Product split (mobile is a separate game), EA Q4 2026, community links | 2026-10-23 |
| 14 | https://itunes.apple.com/lookup?id=1607860732&country=us | iOS v2.4.0, min iOS 14, 21 ISO language codes, full description (Region View, Street View, Monthly Add-ons, Mayoral Match-Up, Sandbox Construction Mode) | 2026-10-23 |
| 15 | https://apps.apple.com/us/app/super-citycon-build-a-city/id1607860732 | App Store listing (Street View / Region View / Mayoral Match-Up) | 2026-10-23 |
| 16 | https://play.google.com/store/apps/details?id=com.benwilles.citybuilder | Google Play listing — HUGE MAPS, REGION VIEW, STREET VIEW, MAYORAL MATCH-UP | 2026-10-23 |
| 17 | https://www.facebook.com/benwillesgames/photos/956023616528658/ | 2.0 feature list: Android debut, new orthographic camera mode, Region View, economy rebalance, expanded language support | 2026-10-23 |
| 18 | https://www.reddit.com/r/supercitycon/ | Community surface for UI feedback; day/night cycle and lighting request | 2026-10-23 |
| 19 | https://steamcommunity.com/app/3474890/discussions/0/520883748724674896/ | Dev on planned modes (RCI, resource management, tycoon) and scaling of simulations | 2026-10-23 |
| 20 | https://www.reddit.com/r/CityBuilders/comments/tzyyym/hi_guys_im_ben_the_designer_of_super_citycon/ | Developer Ben Willes — mobile product design lead | 2026-10-23 |
| 21 | Shared research brief §2, §3.1–§3.11 (workspace file `docs/00-research-brief.md`) | The confirmed fact base for top bar, government panel, scores, region/walk mode, sensitivity, inventory/bulldozer, PC first/third person, day/night + weather control | 2026-10-23 |
| 22 | Sibling BOT-01 `docs/requirements/01-core-loop-modes-progression.md` (read-only, style calibration) | Sibling transcription of the same How-To transcripts; used only for calibration and cross-checking the HUD top-left cluster | 2026-10-23 |
