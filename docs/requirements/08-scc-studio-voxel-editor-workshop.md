# SCC STUDIO, MODDING PIPELINE, WORKSHOP & CHARACTER CREATION — SuperCitycon Requirements
> Bot: BOT-08 · Domain code: STD · Status: COMPLETE — **remediated 2026-10-23**
> Sources consulted: **23 distinct external URLs** (Steam store page + appdetails API, 2 Steam Community announcements read in full via the Steam News API, Steam Community app hub/discussions/guides, Steam Workshop hub + 4 Valve Workshop platform announcements, supercitycon.net, SteamDB, the dev's own MagicaVoxel authoring tutorial on the official channel, three dev Reddit posts; plus the shared brief as a local file) · Requirements: **135 FR / 12 NFR / 68 QA** · Open questions: **41** · Section contract: 12 sections (0–12) per the shared brief.

**Remediation note (requirement-level audit, 2026-10-23).** This file had never been independently reviewed. A
senior review of sibling domains found rows that read rigorous while asserting things their cited source does
not say; this document was audited against the verified source ledger and the sources were re-read directly.

- **Wrong attribution, corrected.** The automatic **construction-cost / economic-impact derivation** was cited
  throughout §3.4, §6, §7 and §12 to "Shared brief §2 — the dev's Reddit post", with the permalink unrecovered.
  It is now attributed to **Reddit** explicitly (S18), and the dev Reddit posts that *were* re-read this session
  are listed in §12 with their verbatim bodies. **The derivation formula is not published by any source** and is
  asserted nowhere in this document (OQ-STD-33).
- **Guessed numbers removed from Must rows.** `FR-STD-015` carried a proposed resolution table
  (64×64×64, 32×32×16, 16×16×24, 128×128×32) as a **Must**. The authoring-volume resolution, the per-kind
  ceilings, the palette size and the material-class list are **not public**; they are now
  `[TBD — design decision]` (OQ-STD-02, OQ-STD-29, OQ-STD-03). The same applies to the voxel budget in
  NFR-STD-007.
- **Unevidenced editor features demoted.** The palette, the grid resolution, the file format, layer/voxel
  grouping, undo/redo behaviour, symmetry behaviour and copy/paste semantics are **not described in any public
  source**. The rows that assert them are now `[TBD — design decision]`, Priority `Could`, Stage `Design`, each
  with a §11 entry. **59 FR rows and 7 NFR rows now carry that marker**; every one has a §11 entry with a
  proposed default.
- **The derivation input/output set demoted.** The exact inputs (voxel count, bounding box, footprint, volume,
  interior volume, material histogram, surface area, floor count, glazing, emissive count, role, kind) and the
  exact outputs are **not published** — only "construction costs and economic impact" is. The rows that name
  them are now `[TBD — design decision]` (OQ-STD-33); `FR-STD-053`, `FR-STD-054` and `FR-STD-071` stay **Must**
  because they restate the developer's own sentence.
- **Stage vocabulary.** The `Stage` column used five tokens outside the house vocabulary; it is now
  `Mobile` / `PC-EA` / `Both` / `Design`, with the mapping recorded in §0.
- **Platform vs. product.** The Workshop versioning / dependency / load-order rows are now marked explicitly as
  **Steam platform behaviour the game relies on**, never as SuperCitycon specifics (R11, §3.8).
- **New evidence.** The developer's MagicaVoxel tutorial (S33) was retrieved during this audit and supplies the
  32-voxel cell, the indexed palette (indices 9–13), the attach / erase / paint / select / duplicate operations,
  the model browser, and the developer's own statement that user-made models need "some kind of quality level".
  **No evidenced row was removed, and no evidenced row was downgraded.**

**Evidence rule for this document.** Every row below is sourced to material about *one of the two real
SuperCitycon products* — the PC title (`SuperCitycon`, Steam app `3474890`, Sunapie Games) or the mobile title
(`Super Citycon™: Build a City`, App Store id `1607860732` / `com.benwilles.citybuilder`, Ben Willes Games
SL). Behaviour that is plausible but unevidenced appears only as an explicitly marked design decision: Priority
`Could`, Stage `Design`, the marker `[TBD — design decision]`, and a Section 11 entry. A row that *is* a design
decision but states a hard contract the rebuild must honour (a format version field, an integrity ceiling)
keeps its priority and carries `[TBD — see §11 OQ-STD-nn]`, naming the question that closes it.

---

## 0. Scope

**In scope (BOT-08 / `STD`):**
- **SCC Studio** — the PC title's built-in 3D voxel editor: invocation, modes (customise an existing asset vs. start from an empty grid), and the asset types it can author: **buildings, vehicles, citizens, props, terrain sets**, plus **characters**.
- **The voxel workspace** — grid resolution, painting tools, colour palette & material sets, 3D navigation, symmetry, selection, copy/duplicate, undo/redo, layers/groups, dimension authoring.
- **Dimensions & structure** — authoring a model's dimensions in voxels, footprint → world-cell mapping, how an authored model maps onto a building footprint, and how appearance/dimensions can be altered on an existing building while keeping its gameplay identity.
- **Auto-cost & economic derivation** — the required inputs (voxel count, material types, volume, footprint, level/tier, rarity), the derived outputs (construction cost, residential capacity, job count, coverage radius, culture/entertainment/recreation points, wealth level, pollution, traffic), how the player sees the derivation before committing, and the no-gameplay-role fallback.
- **The Citycon Building** — the fictional "City Constructions Inc." construction yard, the player-facing construction point, and the full name-origin story (with citations).
- **Character / avatar creation** — appearance customisation and how the authored character enters the first-person city.
- **Modding pipeline** — the file format ("a unique format"), import/export, versioning, dependency handling, and how a creation is placed into the city.
- **Steam Workshop** — publishing a creation, item types, metadata, visibility, versioning/updates, and the in-game subscribe/browse flow. Platform behaviour is separated from SuperCitycon-specific behaviour.
- **In-game integrity** — editor ceilings, footprint limits, whether a creation can carry unique gameplay stats, and moderation/takedown expectations.

**Out of scope (owner named — referenced, never specified here):**
- The money maths of construction cost, taxes, income → `ECO`. **This document owns the derivation *inputs* and the *contract* with `ECO`, not the formula.**
- Building catalogue content, tier ladder, building property schema, Building-of-the-Week → `BLD`. **This document owns how a custom asset becomes a catalogue entry.**
- Terrain, water, grid, tile addressing, terrain application in the world → `WLD`. **This document owns authoring terrain sets only.**
- HUD / editor chrome layout, camera controls, walk-mode camera height & sensitivity → `UX`.
- Rendering, art direction, voxel mesh generation, file I/O performance, save/load → `TEC`.
- Traffic agents, pathing, road connectivity → `MOB`.
- Happiness, the six growth bonuses, City Score, diversity-point counting → `POP` (the derivation *emits* the values those systems consume).
- Service coverage maths → `SRV` (the derivation *emits* a coverage radius).

**Boundary rule:** this document owns *the editor and the authoring→simulation contract*. Where authoring produces a number the economy uses, the number's **derivation inputs and outputs** live here; the **formula** lives in `ECO`.

**Vocabulary used in this document's `Stage` column — the house vocabulary, and only these four tokens:**
`Mobile` = the mobile title (live today) · `PC-EA` = the PC title on Steam, covering the shipped Next Fest demo
(appid **5295650**), the Q4 2026 Early Access **construction sandbox** and later PC content · `Both` = the PC and
the mobile titles · `Design` = a decision this document makes for the rebuild, not a shipped capability.
**Mapping from the previous five-token vocabulary used in this file:** `EA-DEMO` → `PC-EA` · `EA-SBX` → `PC-EA` ·
`EA-SIM` → `PC-EA` · `POST-EA` → `PC-EA` · `MOB-LIVE` → `Mobile` · `ALL` → `Both`. The finer distinction between
the EA sandbox and the EA simulation modes is preserved in **§5**, which describes delivery order and is not a
`Stage` column.
**Evidence note:** the EA build launches **without an economy** ("there's no economy in the game yet. You can build and explore") [S4]. Therefore *derivation* must exist from `PC-EA`, but the *economic consequence* of a derivation only becomes observable once the simulation modes arrive. That split is load-bearing for §5 and §7.

**Steam platform vs. SuperCitycon — the specificity line.** Workshop **versioning, dependencies, load order,
item disabling, collections, visibility states, per-item-type filters and the Workshop Legal Agreement are
Steam platform behaviour**: citable to the platform's own announcements and to nothing else, never as
SuperCitycon specifics. Everything about *which* item kinds exist, *what* an item contains, *how* an item is
validated and *how* the in-game browser behaves is SuperCitycon-specific and is currently `[TBD]`. This
document relies on the platform's behaviour and does not re-specify it (R11).

**`Rebuildable?` column legend:** `yes` = implementable in the browser-based target stack (MiniMax Code / Three.js-class) from this document alone · `partial` = implementable but a named upstream domain or a platform bridge must also be built · `no` = requires a capability the web stack does not natively provide (e.g. direct Steam Client integration), so it needs a companion service.

---

## 1. Observed behaviour (evidence)

### 1.1 Source findings

| # | Finding | Status | Source URL |
|---|---|---|---|
| S1 | Store copy: "**SCC Studio is SuperCitycon's built-in voxel editor. Customize existing buildings, vehicles, terrain sets, citizens and props, or start from an empty grid and create something new.**" | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |
| S2 | Store copy: "**Work at any scale, from the color of a wall to the look of an entire landscape.** Design your own character, place your creations directly in the city and share them through the Steam Workshop." | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |
| S3 | Feature bullet: "**SCC Studio & Steam Workshop: Create, customize and share maps, models and characters with the in-game voxel editor.**" → shareable item kinds are **maps, models and characters**. | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |
| S4 | Dev (demo announcement): "At its core is the **SCC Studio, our own 3D voxel editor**. Pretty much **everything in the game can be made with it**. And because it was built for scale from the start, it holds up as cities get bigger and busier." | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| S5 | Dev (demo announcement): "there's **no economy in the game yet**. You can build and explore, but it isn't a 'real' city builder yet"; the demo has fires, tornadoes, a day/night cycle, trains, helicopters and ships. | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| S6 | Dev (demo announcement): "**You can't walk around the city on foot in the demo yet**, though." → character creation + first-person exist in the design, absent from the demo build. | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| S7 | Dev (demo announcement): "The **UI is a different story: I'm currently rebuilding it from scratch.** What you see in the demo is not what it'll end up looking like." → editor chrome is explicitly unstable; **no published UI screenshots should be treated as contract**. | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| S8 | Dev (demo announcement): "SuperCitycon is a **completely new game** … built from the ground up, with **performance and scale in mind from day one** … **Not a single line of code from what came before**." | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| S9 | Naming (full announcement, read verbatim): the project was called "**City**" from **2017** for "more than two and a half years"; the original project folder is **still called `City`** today. | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| S10 | Naming: "I was building what is now called the **Citycon Building, the city's construction yard**. I wanted it to look like it belonged to an actual company inside the game world, so I decided to **put the company name directly onto the facade in voxel lettering**. The original idea was something along the lines of **City Constructions Inc.**" | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| S11 | Naming: "**The game used a much lower voxel resolution back then, and there simply wasn't enough space on the building to write *City Constructions* in a way that was still readable. So I shortened it. City Constructions became Citycon.**" | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| S12 | Naming: "The **Super** came from … the **16-bit era**, especially the **Super Nintendo** … Games like *Super Mario World* and *Super Metroid* made the word almost synonymous in my mind with that era"; and "**SimCity on the Super Nintendo**. It was the game that really pulled me into the city-building genre." | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| S13 | Naming conclusion: "Strictly speaking, it doesn't really mean anything. *Citycon* was never a word I invented with some deeper definition in mind. It was simply an **abbreviation born from the fact that *City Constructions* wouldn't fit onto a voxel building** … you could say it means **Super City Constructions**." | [CONFIRMED] | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| S14 | Store copy: "**Map Creation & Terraforming: Shape the terrain and water, and create terrain sets of your own.**" → terrain sets are an authored asset class. | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |
| S15 | Store copy: "**First- & Third-Person Modes: Create your character and explore the city from within.**"; "Place buildings from a growing library, then **open SCC Studio whenever you want to customize a model or create something new**." | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |
| S16 | Store copy: "**Early Access begins with a construction sandbox** centered on shaping worlds, building cities, **creating assets** and exploring the places you make." → asset creation is in EA launch scope. | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |
| S17 | Steam category **id 17 = "Includes level editor"** is set on app 3474890; tags include *Voxel*, *Level Editor*, *Character Customization*, *Retro*. | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |
| S18 | Dev's **Reddit post** (the developer's own announcement thread for this game): everything is voxels; the editor used for each model is **integrated into gameplay**; "a **unique format** allows altering **appearance, dimensions**, or creating **entirely new structures on the fly**, integrated back into the city"; the game **automatically calculates construction costs and economic impact** of any building that transitions from the editor into the gameplay environment — needed "to function universally while still making logical sense". **Attribution: this is a Reddit statement by the developer — the Steam store page carries no cost-derivation claim, and the formula is not published anywhere (OQ-STD-33).** The exact permalink remains unrecovered (Reddit's JSON API and `old.reddit.com` returned HTTP 403 during this audit; post bodies were readable through Reddit's own embed endpoint) → OQ-STD-01. | [CONFIRMED — Reddit, by the developer] — **permalink TBD → OQ-STD-01** | https://www.reddit.com/r/supercitycon/ · https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ |
| S19 | Dev posts to r/MagicaVoxel (same dev, same game) — establishes that dev communication about the voxel pipeline lives on Reddit threads, not Steam. | [CONFIRMED (sibling-domain citation)] | https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ |
| S20 | Third-party video (Wishlist Radar, 22 Oct 2026) — **corroboration only, not a primary source**: "What SuperCitycon adds is **SCC Studio, a voxel editor built in**, so you can **reshape a building or start one from an empty grid and share it on the Workshop**." The video has **no captions at all** (`TranscriptsDisabled`), so no transcript-based claim is drawn from it; the editor modes it restates are already evidenced by the store page (S1). | [CONFIRMED (third-party corroboration)] | https://www.youtube.com/watch?v=FEELWEOJs2M |
| S21 | **Valve platform** — Workshop items can specify **supported game versions**: with the developer having enabled "**Game Branch Versions**", authors specify "the versions of a game that are known to work"; **multiple simultaneous versions** of one item can be accessible; **if no range is specified, Steam assumes the version works with any build**; if several versions are compatible, **the latest uploaded compatible version is downloaded**; settings live under the item's **'Change Notes'** tab. | [CONFIRMED] | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/521953615223457012 |
| S22 | **Valve platform** — **Workshop Collections**: save/load subscription lists as presets; "**the load order for your items will match the order of subscriptions within the collection**"; collections are **shareable via a link**; "Subscribe to all" can **add to or overwrite** the current list; collections can be saved into collections. | [CONFIRMED] | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3889485345756435017 |
| S23 | **Valve platform** — item **dependencies** are declared by creators; the client can **auto-set load order from dependencies**; **missing dependencies are displayed**; items can be **disabled from being loaded**; the local **load order can be changed**; the subscription list shows when the item was last updated, when you subscribed, and any item dependencies; the list can be **filtered by name or by tag**. | [CONFIRMED] | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3888358641555807825 |
| S24 | **Valve platform** — "**Filters can be configured by game developers to apply (and appear) for certain types of items.** For Workshops that contain both **Maps and Items**, developers can define which types each filter should apply to." → per-item-type filtering is a *developer-configurable* platform capability. | [CONFIRMED] | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/518616498862818032 |
| S25 | **Valve platform** — item visibility states include **unlisted** and **friends-only** (both may be added to a collection); "you can **subscribe to an item and all the items it depends on**". | [CONFIRMED] | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3888358641555807825 |
| S26 | **Valve platform** — Workshop is a **central hub of player-created content and tools to publish, organize, and download** content; "The **acceptable items, entry rules, and rewards may be different for each product**"; submitting an item or accepting revenue allocation means agreeing to the **Workshop Legal Agreement**. | [CONFIRMED] | https://steamcommunity.com/workshop/workshopsubmitinfo/ |
| S27 | **Observation (2026-10-23):** the Steam Community hub for app 3474890 lists section tabs **All / Discussions / Screenshots / Artwork / Broadcasts / Videos / News / Guides / Reviews** — **no "Workshop" tab**; and `steamcommunity.com/app/3474890/workshop/` **redirects to the generic Workshop home** rather than an app-specific hub. → **SuperCitycon's Workshop is announced but not yet publicly reachable**; treat all SuperCitycon-specific Workshop behaviour as planned. | [CONFIRMED (negative observation)] | https://steamcommunity.com/app/3474890/ |
| S28 | **Observation (2026-10-23):** the app's Steam Guides list is **empty** (zero guides), while Steam's standard guide tag vocabulary for the app already includes **"Modding or Configuration"**, **"Workshop"** and **"Characters"**. → no community documentation of the editor exists yet. | [CONFIRMED (negative observation)] | https://steamcommunity.com/app/3474890/guides/ |
| S29 | Official site: the mobile title "is a **separate game** from SuperCitycon on Steam"; "Early Access · Q4 2026 · Windows & macOS". | [CONFIRMED] | https://supercitycon.net/ |
| S30 | SteamDB mirrors the store copy and confirms the app identity (Sunapie Games, appid 3474890, Early Access Q4 2026). | [CONFIRMED] | https://steamdb.info/app/3474890/ |
| S31 | Steam News API returns **exactly two** Community Announcements for app 3474890 (the demo post and the naming post) — the full extent of the published dev announcements to date. | [CONFIRMED] | https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=3474890&count=50&maxlength=0&format=json |
| S32 | Steam store: demo appid **5295650**; Early Access **Q4 2026**; `dlc:[5295650]`; genres *Indie / Simulation / Strategy / Early Access*; single-player; "Includes level editor". | [CONFIRMED] | https://store.steampowered.com/api/appdetails?appids=3474890 |
| S33 | Dev's own **authoring tutorial on the official channel** — the only public window into the voxel asset pipeline. **It shows Magica Voxel, a third-party editor the developer uses to make models; it does not show SCC Studio, and it therefore does not enumerate SCC Studio's own toolset.** It does establish: the map **cell is 32 voxels** ("the size in game the cell on the map is 32 so a model for example it's 32×32 and let's make it 32 height"), so a one-cell model is 32×32×32 voxels; the palette is **indexed** ("you can see the index of each color"; "the green we use in game is for our color palette it's **9 till 13**"); the operations shown are **attach, erase, paint** and a **select** tool, plus **duplicate**; models can be grouped and moved; the tool exposes a **model browser** ("here is your browser section where you can find all your models"); building footprints are multiples of the 32-cell. *(No further voxel dimensions are published: the transcript states only the 32-voxel cell and the 32×32×32 one-cell model.)* | [CONFIRMED] | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| S34 | The dev's concern about user-made content: "we might possibly have to **develop a system** because here we can't **overflow the game with a ton of different models** and all keep some kind of **quality level**". → the *existence* of an authored-content quality/limit system is the dev's own stated intent; its rules are not published. | [CONFIRMED] | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| S35 | Dev's **Reddit posts**, re-read during this audit through Reddit's embed endpoint: r/VoxelGameDev `/1g2pbyq/` (cross-posted to r/CityBuilders `/1g2p8jj/` and r/AndroidGaming `/1g2pap5/`) — "We've just made Super Citycon, our new mobile city-building game, available for open testing on Android!"; r/supercitycon `/1ii2w9y/` — "Super Citycon is coming to Steam!"; r/MagicaVoxel `/14fxfk6/` — "Our Voxelgame Super Citycon : Monorail - it's not only for decoration! Building your Monorail allows you to build your city even more unique and gives street connection to your surrounding buildings". → establishes Reddit as the dev's announcement channel for this game. | [CONFIRMED] | https://www.reddit.com/r/VoxelGameDev/comments/1g2pbyq/ · https://www.reddit.com/r/supercitycon/comments/1ii2w9y/super_citycon_is_coming_to_steam/ |

### 1.2 Screens/flows observed

- **Open the editor from the game.** Published flow is text-only, not screenshot-documented: *"Place buildings from a growing library, then open SCC Studio whenever you want to customize a model or create something new"* (S15). The **only** published flow is the *editor's own* description (S1, S2). No editor screenshot, toolbar, palette or dialog has been published; the dev states the UI is being rebuilt and that demo UI is not final (S7). **All chrome-level requirements in this document are therefore stated as behaviours, never as pixel layouts.**
- **Editor mode A — customise an existing asset.** "Customize existing buildings, vehicles, terrain sets, citizens and props" (S1). Entry is an existing asset instance in the city; the editor opens on that asset's model.
- **Editor mode B — start from an empty grid.** "…or start from an empty grid and create something new" (S1); corroborated independently: "start one from an empty grid" (S20).
- **Scale of work.** "from the color of a wall to the look of an entire landscape" (S2) — a single editor spans single-voxel edits through landscape-scale terrain sets.
- **Transition out of the editor.** "place your creations directly in the city" (S2) → an authored creation is placed as a world instance, and at that transition the game derives its cost and economic impact automatically (S18 — **Reddit, by the developer**; the formula itself is not published, OQ-STD-33).
- **The authoring pipeline the developer actually uses (S33).** Models are authored in **Magica Voxel**, a third-party voxel editor, and are brought into the game: the map cell is 32 voxels, the palette is index-addressed (the in-game range is "9 till 13"), the operations are attach / erase / paint / select / duplicate, and the tool exposes a browser of the player's own models. **This is the closest public window into the asset pipeline — and it is not SCC Studio**, whose own toolset remains unpublished (OQ-STD-26). It also carries the developer's own warning that user-made models must keep "some kind of quality level" (S34).
- **Sharing.** "share them through the Steam Workshop" (S2, S3) — publish, and other players subscribe.
- **Character flow.** "Create your character and explore the city from within" (S15) — the authored character is the first-person avatar.
- **Citycon Building.** The construction yard exists as a named, fictional in-world company with **voxel lettering on the facade** (S10, S11) — i.e. the name was itself authored in the voxel editor.
- **Workshop (platform shape only).** Submission is via the Steam client / Workshop page; the platform supplies versioning, dependencies, load order, collections, tags, visibility and per-type filters (S21–S26). The SuperCitycon-specific hub is not yet public (S27).

---

## 2. System overview

```
 ┌──────────────────────────── PLAYER-FACING AUTHORING ───────────────────────────┐
 │  Game shell                                                                   │
 │   ├─ Library ▸ [building|vehicle|citizen|prop|terrain set] ──► "Edit" ─────┐   │
 │   ├─ Empty grid / New model ────────────────────────────────────────────┐   │   │
 │   ├─ Character creator ──────────────────────────────────────────────────┤   │   │
 │   └─ Map creator (terrain + layout) ─────────────────────────────────────┤   │   │
 │                                                                            ▼   │   │
 │                        ┌────────────────────── SCC STUDIO ─────────────────────┐ │
 │                        │  WORKSPACE (voxel grid, W×H×D voxels)                │ │
 │                        │   tools: place│erase│paint│fill│stamp│pick│select   │ │
 │                        │   nav: orbit│pan│zoom  snap: on/off                 │ │
 │                        │   symmetry: X│Y│Z   ops: copy│dup│rotate│scale    │ │
 │                        │   history: undo/redo stack   layers/groups          │ │
 │                        │   palette: material set (indexed colours)            │ │
 │                        └───────────┬──────────────────────────────▲──────────┘ │
 │                                    │ edits                            │ live    │
 │                                    ▼                                  │ preview │
 │                        ┌────────────────────── ASSET RECORD ───────────────┴──┐  │
 │                        │ AssetDefinition { id, kind, dims, pivot, paletteId,│  │
 │                        │   voxels[], gameplayProfile{...} }                  │  │
 │                        └───────────┬──────────────────────────────────────┘  │
 │                                    │ "transitions from the editor into the    │
 │                                    │  gameplay environment"  (S18)             │
 │                                    ▼                                          │
 │         ┌────────────────── DERIVATION ENGINE (STD owns inputs/outputs) ─────┐ │
 │         │  DerivationInputs { voxelCount, volume, bbox, footprintCells,    │ │
 │         │    surfaceArea, enclosedVolume, floors, materialHistogram,      │ │
 │         │    openingRatio, emissiveCount, role, kind }                    │ │
 │         │        ▼                                                        │ │
 │         │  DerivedProperties { buildCost, resCapacity, jobCount,          │ │
 │         │    productionCapacity, coverageRadius, culturePts,               │ │
 │         │    entertainmentPts, recreationPts, wealthLevel, pollution,      │ │
 │         │    trafficGen, trafficAttract, tier, rarity, isDecoration }     │ │
 │         └───┬───────────────┬──────────────┬───────────────┬───────────────┘ │
 │             ▼               ▼              ▼               ▼                  │
 │          ECO (cost)    BLD (catalogue)  POP (bonuses)   SRV (coverage)      │
 │                          WLD (terrain)                   MOB (traffic)       │
 └──────────────────────────────────────────────────────────────────────────────┘

 ┌──────────────────────── MODDING PIPELINE (STD) ──────────────────────────────┐
 │  .scc asset file = { formatVersion, kind, dims, paletteRef, voxels,         │
 │                       gameplayProfile, deps[], contentHash }               │
 │     ▲ export          │ import (validate)        │ resolve deps             │
 │     │                 ▼                          ▼                        │
 │  Workshop publish ─► Steam Workshop (platform: versions, deps, load order,  │
 │   │                  collections, tags, visibility)  ◄── in-game browse &   │
 │   │                                                        subscribe        │
 │   └─ map / model / character / terrain-set items                            │
 └──────────────────────────────────────────────────────────────────────────────┘

 ┌──────────────────── PLAYER-FACING CONSTRUCTION POINT ───────────────────────┐
 │  CITYCON BUILDING ("City Constructions Inc.") — the city's construction yard │
 │   facade lettering authored in voxels (S10/S11)                             │
 │   role: player-facing construction/authoring point (S16 EA scope)            │
 └──────────────────────────────────────────────────────────────────────────────┘
```

> **What this diagram does and does not claim.** The **structure** it shows — editor → asset record →
> derivation → downstream domains — follows the developer's own description of the workflow (S18, Reddit:
> everything is voxels, the per-model editor is integrated into gameplay, and a creation that "transitions from
> the editor into the gameplay environment" has its cost and economic impact computed automatically).
> The **detail inside the boxes is a proposed shape, not published behaviour**: the tool list in the workspace
> bar, the layer/group and undo-redo entries, and the **derivation input and output field lists** are all
> `[TBD — design decision]` (OQ-STD-26, OQ-STD-27, OQ-STD-28, OQ-STD-29, OQ-STD-10, OQ-STD-11, OQ-STD-33). The
> `.scc` asset file layout is a **proposed container** (OQ-STD-07). The Workshop box marks platform behaviour
> the game relies on; the SuperCitycon-specific item kinds come from the store copy (S3).

---

## 3. Functional requirements

### 3.1 Editor scope, invocation and asset types

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-STD-001 | The game shall ship an in-game **voxel editor named SCC Studio**, openable from within the running city without leaving the game. | Must | PC-EA | yes | QA-STD-001 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-002 | SCC Studio shall expose exactly **two authoring modes**: (a) *customise an existing asset* and (b) *start from an empty grid*. | Must | PC-EA | yes | QA-STD-001 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-003 | The editor shall be able to open an existing **building** model for customisation. | Must | PC-EA | yes | QA-STD-002 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-004 | The editor shall be able to open an existing **vehicle** model for customisation. | Must | PC-EA | yes | QA-STD-002 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-005 | The editor shall be able to open an existing **citizen** model for customisation. | Must | PC-EA | yes | QA-STD-002 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-006 | The editor shall be able to open an existing **prop** model for customisation. | Must | PC-EA | yes | QA-STD-002 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-007 | The editor shall be able to open an existing **terrain set** model for customisation. | Must | PC-EA | yes | QA-STD-002 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-008 | The editor shall be able to author **characters** (the player's own avatar) as a distinct asset kind from citizen models. | Must | PC-EA | yes | QA-STD-003 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-009 | The editor shall be able to author **maps** (city layouts) as a shareable kind. | Must | PC-EA | yes | QA-STD-003 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-010 | The editor shall operate across **all** of the above asset kinds with one workspace/toolset, not one editor per kind. | Must | PC-EA | yes | QA-STD-004 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-STD-011 | The editor shall support work at **single-voxel granularity up to landscape scale** within one continuous workflow (the "color of a wall" → "an entire landscape" range). | Must | PC-EA | partial | QA-STD-004 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-012 | SCC Studio shall be the **same authoring system that produced the shipped base content** — the editor used for each model is integrated into gameplay, not a separate offline tool. | Must | PC-EA | partial | QA-STD-005 | Dev's Reddit post — https://www.reddit.com/r/supercitycon/ (exact permalink TBD → OQ-STD-01) |
| FR-STD-013 | **[TBD — design decision; see OQ-STD-26]** Opening the editor on an existing asset shall not mutate the world until the player commits the edit; the live city remains navigable behind/around the editor. No public source states the editor's commit semantics. | Could | Design | yes | QA-STD-005 | [TBD] — see OQ-STD-26 |

### 3.2 The voxel workspace — grid, tools, navigation, history

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-STD-014 | The editor shall present a **3D voxel grid workspace**; the authoring volume's dimensions are **[TBD — see OQ-STD-02]**. (A grid is evidenced: the editor starts "from an empty grid" [S1] and the game is voxel-authored [S4]. The authoring volume's resolution is **not published**.) | Must | PC-EA | yes | QA-STD-006 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-015 | **[TBD — design decision; see OQ-STD-02]** The authoring volume's default resolution and per-kind maximum dimensions shall be configurable per asset kind. The figures below are a **proposed default, not published values**: footprint cells × 32 voxels (the 32-voxel cell is evidenced by S33) — e.g. 64×64×64 buildings/props, 32×32×16 vehicles, 16×16×24 citizens/characters, 128×128×32 terrain sets. | Could | Design | yes | QA-STD-006 | [TBD] — see OQ-STD-02 · https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-016 | The voxel grid shall be **axis-aligned and regular** (no per-voxel rotation/shear); rotation of content shall be achieved by transforming occupancy, not by skewing the lattice. | Must | PC-EA | yes | QA-STD-007 | https://www.youtube.com/watch?v=NJfQ_5-wlWo (32-cell lattice: "the cell on the map is 32 … 32×32 … 32 height") |
| FR-STD-017 | The editor shall provide a **place/attach voxel** operation that writes the currently selected material into the targeted cell. The **operation set is evidenced by the developer's own public authoring workflow** (attach / erase / paint in Magica Voxel); SCC Studio's own tool list is **not published** → OQ-STD-26. | Must | PC-EA | yes | QA-STD-007 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-018 | The editor shall provide an **erase-voxel** operation that clears the targeted cell to empty. Evidenced by the developer's public authoring workflow; SCC Studio's own tool list is **not published** → OQ-STD-26. | Must | PC-EA | yes | QA-STD-007 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-019 | The editor shall provide a **paint / recolour** operation that re-assigns the material of already-occupied cells without changing occupancy. Evidenced by the developer's public authoring workflow; SCC Studio's own tool list is **not published** → OQ-STD-26. | Must | PC-EA | yes | QA-STD-008 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-020 | **[TBD — design decision; see OQ-STD-26]** The editor shall provide a **fill** operation (voxel, box region, and flood-fill of a contiguous region) to bulk-fill a material. No source describes a fill operation in SCC Studio. | Could | Design | yes | QA-STD-008 | [TBD] — see OQ-STD-26 |
| FR-STD-021 | **[TBD — design decision; see OQ-STD-26]** The editor shall provide a **primitive stamp** operation able to stamp a box, plane, column or line of the current material. The developer's authoring workflow shows box and face tools in Magica Voxel — the closest public analogue — but SCC Studio's own stamp set is not published. | Could | Design | yes | QA-STD-008 | [TBD] — see OQ-STD-26 · https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-022 | **[TBD — design decision; see OQ-STD-26]** The editor shall provide an **eyedropper / material pick** that sets the active material from a targeted cell. No source describes it. | Could | Design | yes | QA-STD-009 | [TBD] — see OQ-STD-26 |
| FR-STD-023 | The editor shall provide a **cell selection** operation supporting at minimum a rectangular volume selection. A **select** tool is evidenced by the developer's public authoring workflow; SCC Studio's own selection set is **not published** → OQ-STD-26. | Must | PC-EA | yes | QA-STD-009 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-024 | **[TBD — design decision; see OQ-STD-27]** The editor shall provide **copy** and **paste** of a selected region within the same document. No source describes clipboard semantics for SCC Studio. | Could | Design | yes | QA-STD-009 | [TBD] — see OQ-STD-27 |
| FR-STD-025 | The editor shall provide a **duplicate** operation that clones the current asset (or the selection) into a new asset record. Duplicate is evidenced by the developer's public authoring workflow ("let's duplicate that"); SCC Studio's own operation set is **not published** → OQ-STD-26. | Must | PC-EA | yes | QA-STD-010 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-026 | **[TBD — design decision; see OQ-STD-11]** The editor shall provide **undo and redo** over all mutating operations (voxel edits, structural ops, palette changes that alter appearance), with a bounded history depth. No public source describes the editor's history behaviour. | Could | Design | yes | QA-STD-010 | [TBD] — see OQ-STD-11 |
| FR-STD-027 | **[TBD — design decision; see OQ-STD-11]** Undo/redo shall restore both **occupancy and material assignment** of edited cells, and shall restore **structural** changes (dimension changes, layer moves) as single atomic steps. | Could | Design | yes | QA-STD-010 | [TBD] — see OQ-STD-11 |
| FR-STD-028 | **[TBD — design decision; see OQ-STD-26]** The workspace shall support **3D navigation**: orbit, pan and zoom about a focus point, independent of the game camera. No source describes the editor's navigation model. | Could | Design | yes | QA-STD-011 | [TBD] — see OQ-STD-26 |
| FR-STD-029 | **[TBD — design decision; see OQ-STD-26]** Navigation shall support a **view snapping** mode that constrains the camera to discrete axes/angles for precise cell targeting. | Could | Design | yes | QA-STD-011 | [TBD] — see OQ-STD-26 |
| FR-STD-030 | The workspace shall support **grid snapping of edits** to the voxel lattice (edits never land off-lattice). | Must | PC-EA | yes | QA-STD-011 | https://www.youtube.com/watch?v=NJfQ_5-wlWo (32-cell lattice) |
| FR-STD-031 | **[TBD — design decision; see OQ-STD-28]** The editor shall support **symmetry mirroring** across the X, Y and/or Z axes, applied live to subsequent edits within the session. No public source mentions symmetry. | Could | Design | yes | QA-STD-012 | [TBD] — see OQ-STD-28 |
| FR-STD-032 | **[TBD — design decision; see OQ-STD-28]** Symmetry shall be independently toggleable per axis and shall apply to place, erase, paint, fill and stamp operations. | Could | Design | yes | QA-STD-012 | [TBD] — see OQ-STD-28 |
| FR-STD-033 | **[TBD — design decision; see OQ-STD-10]** The editor shall support **layers or groups** so that parts of a model can be addressed as a unit (select, hide, move, mirror as a group). | Could | Design | yes | QA-STD-012 | [TBD] — see OQ-STD-10 |
| FR-STD-034 | The editor shall expose a **palette** of selectable colours/materials, and the active material shall be visually indicated in the workspace. The **existence of an indexed palette** is evidenced by the developer's public authoring workflow; the palette's **size, contents and per-index semantics are not published** → OQ-STD-29. | Must | PC-EA | yes | QA-STD-013 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-035 | Materials shall be addressed by **index into a material set**, not by raw RGB, so that a model can be recoloured globally without rewriting every voxel. **Evidenced**: the dev shows the index of each colour and names the in-game palette range "9 till 13" (S33). | Must | PC-EA | yes | QA-STD-013 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-036 | **[TBD — design decision; see OQ-STD-29]** The game shall support **material sets** — named, reusable palettes that an authored asset references; a palette change therefore restyles every model that references it. | Could | Design | yes | QA-STD-013 | [TBD] — see OQ-STD-29 |
| FR-STD-037 | **[TBD — design decision; see OQ-STD-03]** Material classes shall include at least the semantic classes the derivation reads. Proposed default: **structural**, **glass/transparent**, **emissive/lit**, **foliage/vegetation**, **water**, **road surface**, **metal**, **signage/lettering**. The class list is the derivation's semantic input and is **not published**. | Could | Design | yes | QA-STD-013 | [TBD] — see OQ-STD-03 |
| FR-STD-038 | **[TBD — design decision; see OQ-STD-26]** The editor shall support **rotating** the authored content about the vertical axis in 90° steps, re-orienting occupancy and preserving material assignment. | Could | Design | yes | QA-STD-014 | [TBD] — see OQ-STD-26 |
| FR-STD-039 | **[TBD — design decision; see OQ-STD-26]** The editor shall support **scaling** the authored content (integer voxel step) with the resulting dimensions and re-derived properties recomputed before commit. | Could | Design | yes | QA-STD-014 | [TBD] — see OQ-STD-26 |

### 3.3 Dimensions, structure, footprint mapping and asset identity

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-STD-040 | Every authored asset shall declare its **dimensions in voxels** (width × depth × height), independent of any world unit. **Evidenced**: the dev's tutorial authors a one-cell model at 32 × 32 × 32 voxels (S33). | Must | PC-EA | yes | QA-STD-015 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-041 | **[TBD — design decision; see OQ-STD-04]** The editor shall let the player **set the model's dimensions explicitly** (resize the authoring volume), and resizing shall preserve or crop existing voxels according to an explicit, stated rule (crop-from-origin proposed default). | Could | Design | yes | QA-STD-015 | [TBD] — see OQ-STD-04 |
| FR-STD-042 | **[TBD — design decision; see OQ-STD-30]** The asset shall declare a **pivot / origin** so that the model can be anchored to a world cell, a road edge, a lot, or a terrain surface. No source states the pivot convention. | Could | Design | yes | QA-STD-016 | [TBD] — see OQ-STD-30 |
| FR-STD-043 | The **footprint** of an authored asset shall be derived from its occupied cells as a set of world cells (x,z) projected from the voxel volume, and shall be the unit of placement in the city. The **32-voxel cell → 1 world cell** mapping is evidenced by the dev's tutorial (S33); the dev's tutorial authors a one-cell model at 32 × 32 × 32 voxels, so a model's footprint in world cells is its voxel footprint divided by 32. | Must | PC-EA | partial | QA-STD-016 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-044 | Changing a model's dimensions shall change its footprint, and the world placement shall re-validate against collision/occupancy when the change is committed. | Must | PC-EA | partial | QA-STD-017 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-045 | **[TBD — design decision; see OQ-STD-05]** An authored model shall map onto a **building footprint** such that a building occupying N×M world cells is satisfied by a model whose footprint equals or is contained by N×M; the mapping rule (contained vs. exact) is **OQ-STD-05** (proposed default: exact footprint match required, with contained footprints auto-centring and flagging a footprint mismatch). | Could | Design | partial | QA-STD-017 | [TBD] — see OQ-STD-05 |
| FR-STD-046 | Editing an existing building's **appearance** shall preserve that building's **gameplay identity** (its category, tier, level, unlocked content position and any catalogue slot) unless the player explicitly re-classifies it. **Evidenced**: the dev's Reddit post — the format "allows altering appearance, dimensions". | Must | PC-EA | partial | QA-STD-018 | Dev's Reddit post — https://www.reddit.com/r/supercitycon/ (exact permalink TBD → OQ-STD-01) |
| FR-STD-047 | Editing an existing building's **dimensions** shall preserve its gameplay identity while changing its footprint, cost and derived economic values — i.e. "altering appearance, dimensions" is a supported first-class operation. **Evidenced**: the dev's Reddit post. | Must | PC-EA | partial | QA-STD-018 | Dev's Reddit post — https://www.reddit.com/r/supercitycon/ (exact permalink TBD → OQ-STD-01) |
| FR-STD-048 | **[TBD — design decision; see OQ-STD-06]** A re-dimensioned building that no longer fits its placed lot shall, on commit, either **relocate automatically** or **be refused with an explicit conflict message**; the default is **OQ-STD-06** (proposed default: refuse with conflict message; relocation is an explicit player action). | Could | Design | partial | QA-STD-019 | [TBD] — see OQ-STD-06 |
| FR-STD-049 | The editor shall be able to author **entirely new structures**, not only variations of existing assets — the empty-grid mode ("start from an empty grid and create something new") shall produce a first-class asset. The **parent / derivation relationship for empty-grid creations is [TBD — see OQ-STD-30]**. | Must | PC-EA | yes | QA-STD-019 | https://store.steampowered.com/api/appdetails?appids=3474890 · Dev's Reddit post — https://www.reddit.com/r/supercitycon/ |
| FR-STD-050 | **[TBD — design decision; see OQ-STD-30]** Editing an existing asset shall record the **parent asset id** and produce a **derived copy**, leaving the original base asset unmodified unless the player explicitly overwrites it. | Could | Design | yes | QA-STD-020 | [TBD] — see OQ-STD-30 |
| FR-STD-051 | An authored asset shall be able to be **placed directly in the city** as a placed instance carrying the authored model and the derived properties of that model. | Must | PC-EA | partial | QA-STD-020 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-052 | **[TBD — design decision; see OQ-STD-31]** A placed instance of an authored asset shall be **individually re-editable** without affecting other instances of the same asset. No source states whether instances are individually editable or whether editing edits the asset definition. | Could | Design | partial | QA-STD-021 | [TBD] — see OQ-STD-31 |

### 3.4 Auto-cost and economic derivation (the core requirement)

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-STD-053 | The game shall **automatically compute the construction cost and economic impact** of any asset that transitions from the editor into the gameplay environment, with **no manual cost entry** by the player. **Evidenced — and only from the developer's Reddit post**; the Steam store page carries no cost-derivation claim, and the **formula is not published**. | Must | PC-EA | partial | QA-STD-022 | Dev's Reddit post — https://www.reddit.com/r/supercitycon/ (exact permalink TBD → OQ-STD-01) |
| FR-STD-054 | The derivation shall be **universal**: it must produce a valid result for *any* authored asset without per-asset hand-authored cost data, so it "functions universally while still making logical sense". **Evidenced** — the developer's own wording, from Reddit. | Must | PC-EA | partial | QA-STD-022 | Dev's Reddit post — https://www.reddit.com/r/supercitycon/ (exact permalink TBD → OQ-STD-01) |
| FR-STD-055 | **[TBD — design decision; see OQ-STD-32]** The derivation shall be **deterministic**: the same asset definition always yields the same derived properties, on any machine and in any session. No source states determinism as a property of the original derivation. | Could | Design | yes | QA-STD-023 | [TBD] — see OQ-STD-32 |
| FR-STD-056 | **[TBD — design decision; see OQ-STD-12]** The derivation shall **recompute automatically** after every mutating editor operation, so the displayed cost always matches the current voxels. Whether the original shows a live readout or computes only at commit is not evidenced. | Could | Design | yes | QA-STD-023 | [TBD] — see OQ-STD-12 |
| FR-STD-057 | **[TBD — design decision; see OQ-STD-32]** The derivation shall be **monotonic in scale**: increasing a model's occupied volume shall never decrease its construction cost. | Could | Design | partial | QA-STD-024 | [TBD] — see OQ-STD-32 |
| FR-STD-058 | **[TBD — design decision; see OQ-STD-32]** The derivation shall be **monotonic in material luxury**: replacing a structural material with a higher-tier material shall never decrease cost. | Could | Design | partial | QA-STD-024 | [TBD] — see OQ-STD-32 |
| FR-STD-059 | **[TBD — design decision; see OQ-STD-32]** The derivation shall be a **pure function** of the asset definition plus a versioned rule set; the rule-set version shall be stored with the derived record. | Could | Design | yes | QA-STD-025 | [TBD] — see OQ-STD-32 |
| FR-STD-060 | **[TBD — design decision; see OQ-STD-33]** The derivation shall take as input the **occupied voxel count** of the model. **The derivation's input set is not published** — the dev states only that a cost and an economic impact are computed. | Could | Design | yes | QA-STD-025 | [TBD] — see OQ-STD-33 |
| FR-STD-061 | **[TBD — design decision; see OQ-STD-33]** The derivation shall take as input the **bounding-box dimensions** (W×D×H in voxels) of the model. **Input set not published** (OQ-STD-33). | Could | Design | yes | QA-STD-025 | [TBD] — see OQ-STD-33 |
| FR-STD-062 | **[TBD — design decision; see OQ-STD-33]** The derivation shall take as input the **footprint area in world cells** occupied by the model. **Input set not published** (OQ-STD-33). | Could | Design | partial | QA-STD-026 | [TBD] — see OQ-STD-33 |
| FR-STD-063 | **[TBD — design decision; see OQ-STD-33]** The derivation shall take as input the **occupied volume** and the **enclosed interior volume** of the model, computed from the occupancy shell. **Input set not published** (OQ-STD-33). | Could | Design | yes | QA-STD-026 | [TBD] — see OQ-STD-33 |
| FR-STD-064 | **[TBD — design decision; see OQ-STD-33]** The derivation shall take as input the **material histogram** of the model — the count of voxels per material class / material set entry. **Input set not published** (OQ-STD-33). | Could | Design | yes | QA-STD-026 | [TBD] — see OQ-STD-33 |
| FR-STD-065 | **[TBD — design decision; see OQ-STD-33]** The derivation shall take as input the **exposed surface area** of the model. **Input set not published** (OQ-STD-33). | Could | Design | yes | QA-STD-027 | [TBD] — see OQ-STD-33 |
| FR-STD-066 | **[TBD — design decision; see OQ-STD-33]** The derivation shall take as input the **floor count** of the model. **Input set not published** (OQ-STD-33). | Could | Design | yes | QA-STD-027 | [TBD] — see OQ-STD-33 |
| FR-STD-067 | **[TBD — design decision; see OQ-STD-33]** The derivation shall take as input the **role** the asset is authored to play — at minimum the categories consumed by the simulation: residential, commercial, industrial, service/civic, and decoration/prop. **Input set not published** (OQ-STD-33). | Could | Design | partial | QA-STD-027 | [TBD] — see OQ-STD-33 |
| FR-STD-068 | **[TBD — design decision; see OQ-STD-33]** The derivation shall take as input the **asset kind** (building, vehicle, citizen, prop, terrain set, character, map), because the same voxel model yields different economics per kind. The **kinds** are evidenced (S1, S3); their **role in the derivation** is not. | Could | Design | yes | QA-STD-028 | [TBD] — see OQ-STD-33 · https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-069 | **[TBD — design decision; see OQ-STD-33]** The derivation shall **derive a tier/level** for an authored building from its dimensions, floor count and material quality. **Not published** (OQ-STD-33). | Could | Design | partial | QA-STD-028 | [TBD] — see OQ-STD-33 |
| FR-STD-070 | **[TBD — design decision; see OQ-STD-33]** The derivation shall **derive a rarity class** for an authored asset from its size/complexity band. **Not published** (OQ-STD-33). | Could | Design | yes | QA-STD-029 | [TBD] — see OQ-STD-33 |
| FR-STD-071 | The derivation output shall include a **construction cost value** expressed in the game's currency, handed to `ECO` (which owns the money maths and the final formula). **Evidenced** — the dev names "construction costs" explicitly. **The formula itself is not published.** | Must | PC-EA | partial | QA-STD-029 | Dev's Reddit post — https://www.reddit.com/r/supercitycon/ (exact permalink TBD → OQ-STD-01) |
| FR-STD-072 | **[TBD — design decision; see OQ-STD-33]** The derivation output shall include a **residential capacity** (resident slots) for assets authored with a residential role. **The output set is not published** — the dev says "economic impact" without enumerating it (OQ-STD-33). | Could | Design | partial | QA-STD-030 | [TBD] — see OQ-STD-33 |
| FR-STD-073 | **[TBD — design decision; see OQ-STD-33]** The derivation output shall include a **job count** and **workspace capacity** for assets authored with a commercial or industrial role. **Output set not published** (OQ-STD-33). | Could | Design | partial | QA-STD-030 | [TBD] — see OQ-STD-33 |
| FR-STD-074 | **[TBD — design decision; see OQ-STD-33]** The derivation output shall include a **production capacity** for assets authored with an industrial role. **Output set not published** (OQ-STD-33). | Could | Design | partial | QA-STD-030 | [TBD] — see OQ-STD-33 |
| FR-STD-075 | **[TBD — design decision; see OQ-STD-33]** The derivation output shall include a **service coverage radius** (in world cells) for assets authored with a service/civic role. **Output set not published** (OQ-STD-33). | Could | Design | partial | QA-STD-031 | [TBD] — see OQ-STD-33 |
| FR-STD-076 | **[TBD — design decision; see OQ-STD-33]** The derivation output shall include **culture points**, **entertainment points** and **recreation points** (the three growth-bonus point categories the simulation consumes). **Output set not published** (OQ-STD-33); the PC/mobile parity of the six growth bonuses is itself unverified (OQ-STD-25). | Could | Design | partial | QA-STD-031 | [TBD] — see OQ-STD-33 · OQ-STD-25 |
| FR-STD-077 | **[TBD — design decision; see OQ-STD-33]** The derivation output shall include a **wealth level** expressed as the game's three wealth levels, and shall be able to output **"no wealth value"** — only assets that carry a wealth value contribute to the map's average wealth level. **Output set not published** (OQ-STD-33); the PC/mobile parity of the three wealth levels is itself unverified (OQ-STD-25). | Could | Design | partial | QA-STD-032 | [TBD] — see OQ-STD-33 · OQ-STD-25 |
| FR-STD-078 | **[TBD — design decision; see OQ-STD-33]** The derivation output shall include a **pollution** value and a **traffic generation / attraction** value for placed assets. **Output set not published** (OQ-STD-33). | Could | Design | partial | QA-STD-032 | [TBD] — see OQ-STD-33 |
| FR-STD-079 | **[TBD — design decision; see OQ-STD-33]** The derivation shall persist a **cost-derivation record** — the inputs, the outputs, and the rule-set version — with the asset, so that a placed asset's economics remain auditable and reproducible after a save/load cycle. | Could | Design | yes | QA-STD-033 | [TBD] — see OQ-STD-33 |

### 3.5 The Citycon Building — "City Constructions Inc."

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-STD-080 | The game shall contain a **Citycon Building** — the city's construction yard — as a placeable, visible city structure. | Must | Both | yes | QA-STD-034 | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| FR-STD-081 | The Citycon Building shall be presented as the home of the fictional in-world construction company **City Constructions Inc.** | Must | Both | yes | QA-STD-034 | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| FR-STD-082 | The Citycon Building's facade shall carry the company name **in voxel lettering**, and the game's naming shall be derived from this: "City Constructions" was shortened to **"Citycon"** because the **lower voxel resolution** of the era's facade had no room for a readable full name. | Must | Both | yes | QA-STD-035 | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| FR-STD-083 | The game's name origin shall be reproduced faithfully in content: the project was called "**City**" from 2017 for more than two and a half years (the internal project folder is still called `City`); "**Citycon**" came from the construction company, not from a planned title; "**Super**" comes from the **16-bit / Super Nintendo era** (Super Mario World, Super Metroid) and from **SimCity on the Super Nintendo**, which "pulled him into the city-building genre"; the name reads as "**Super City Constructions**". | Must | Both | yes | QA-STD-035 | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| FR-STD-084 | The Citycon Building shall be the **player-facing construction point** in the PC title as well — the dev describes it as "the city's construction yard". Whether authored assets must enter the city's build flow *through* the building is a **design decision — see OQ-STD-34**. | Must | PC-EA | partial | QA-STD-036 | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| FR-STD-085 | **[TBD — design decision; see OQ-STD-34]** The Citycon Building shall be **itself an authored voxel asset**, i.e. the player shall be able to open it in SCC Studio and customise it like any other building. Its facade lettering was certainly voxel-authored, but the player-facing ability to open it is not stated. | Could | Design | yes | QA-STD-036 | [TBD] — see OQ-STD-34 · https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 |
| FR-STD-086 | Where the construction-yard building grants a construction slot or a build privilege (mobile title: each Citycon Building grants one more **permanent** construction slot), the PC title shall expose the same mechanic on the same building. | Should | PC-EA | partial | QA-STD-037 | Shared brief §3.4 (mobile title) — **TBD** (PC carry-over unverified → OQ-STD-20) |
| FR-STD-087 | **[TBD — design decision; see OQ-STD-34]** The Citycon Building shall appear as a **named, addressable world object** so that it can be located, referenced by narrative text and used as a landmark. | Could | Design | yes | QA-STD-037 | [TBD] — see OQ-STD-34 |

### 3.6 Character / avatar creation

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-STD-088 | The player shall be able to **create their own character** as a first-class creation, distinct from citizen models. | Must | PC-EA | yes | QA-STD-038 | https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-089 | Character creation shall be built on the **same voxel editor and the same authoring format** as every other asset kind. **Evidenced**: the dev's Reddit post describes one "unique format" for everything, and the store copy lists characters among the authored kinds. The **character-specific authoring volume and an optional rig/skeleton definition are [TBD — see OQ-STD-18]**. | Must | PC-EA | partial | QA-STD-038 | Dev's Reddit post — https://www.reddit.com/r/supercitycon/ · https://store.steampowered.com/api/appdetails?appids=3474890 |
| FR-STD-090 | Character creation shall support **appearance customisation** — at minimum body/proportion, and the colours/materials of the visible surfaces. The **capability is evidenced** ("Design your own character"); the **full option list is [TBD — see OQ-STD-19]**. | Must | PC-EA | yes | QA-STD-039 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-STD-091 | The authored character shall be usable as the **first-person avatar** for exploring the city. | Must | PC-EA | partial | QA-STD-039 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-STD-092 | **[TBD — design decision; see OQ-STD-31]** The authored character shall be **placeable in the city** as a citizen-like instance so that the player's own creation can be seen inside the world. No source states that an authored character can be placed as a world citizen. | Could | Design | partial | QA-STD-040 | [TBD] — see OQ-STD-31 |
| FR-STD-093 | The character shall be **walkable** in the world — the avatar moves under the world's pedestrian rules rather than on an independent path. **Evidenced**: the store copy says "pedestrians follow the sidewalks" and "First- and third-person modes let you step inside and explore the city you created". The **crossing and collision rules** are owned by `MOB`/`WLD` and are **[TBD — see OQ-STD-35]**. | Must | PC-EA | partial | QA-STD-040 | https://store.steampowered.com/app/3474890/SuperCitycon/ · https://www.youtube.com/watch?v=6Jd2kyaEZbM |
| FR-STD-094 | On-foot exploration and the authored character shall **not be present in the demo build** — "You can't walk around the city on foot in the demo yet" — so first-person avatar features are **PC-title features (Stage `PC-EA`)**, not demo-build features. | Must | PC-EA | yes | QA-STD-041 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-STD-095 | **[TBD — design decision; see OQ-STD-35]** The character authoring screen shall be reachable **from the character-creation entry point**, not only from the generic library, so a player can create a character before having any asset in the library. | Could | Design | yes | QA-STD-041 | [TBD] — see OQ-STD-35 |
| FR-STD-096 | A character asset shall be **shareable** through the same sharing pipeline as other creations, with "characters" as a first-class shareable item kind. | Must | PC-EA | partial | QA-STD-042 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-STD-097 | **[TBD — design decision; see OQ-STD-35]** The character creation shall expose a **camera/framing view** of the authored character that shows the result of the customisation; the camera's height, sensitivity and collision behaviour are owned by `UX`. | Could | Design | yes | QA-STD-042 | [TBD] — see OQ-STD-35 |

### 3.7 Modding pipeline — file format, import/export, versioning, dependencies

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-STD-098 | The game shall use a **single documented asset format** for every authored kind (buildings, vehicles, citizens, props, terrain sets, characters, maps) — the dev's "unique format" that supports altering appearance, dimensions, or entirely new structures. **Evidenced — Reddit, by the developer.** | Must | PC-EA | yes | QA-STD-043 | Dev's Reddit post — https://www.reddit.com/r/supercitycon/ (exact permalink TBD → OQ-STD-01) |
| FR-STD-099 | The format shall store voxels as **material indices into a referenced palette**, not raw colour values. **Evidenced**: the dev's tutorial shows the index of each colour and the in-game palette range "9 till 13" (S33). | Must | PC-EA | yes | QA-STD-043 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-100 | **[TBD — design decision; see OQ-STD-07]** The format shall store the model's **dimensions in voxels**, the **pivot**, the **asset kind** and the **palette/material-set reference**. The field list is not published (the dimensions-in-voxels convention and the index-addressed palette are evidenced; the rest is not). | Could | Design | yes | QA-STD-044 | [TBD] — see OQ-STD-07 · https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-101 | The format shall carry an explicit **format version** field, and readers shall refuse (or offer a migration path for) files with a newer major version. **[TBD — see OQ-STD-07]** — this is a hard contract the rebuild must honour; the *platform's* item-versioning behaviour is a separate, Valve-owned mechanism (FR-STD-116/117). | Must | PC-EA | yes | QA-STD-044 | [TBD] — see OQ-STD-07 · platform analogue: https://steamcommunity.com/games/SteamWorkshop/announcements/detail/521953615223457012 |
| FR-STD-102 | **[TBD — see OQ-STD-07]** The format shall carry a **content hash** so that a creation's identity and change-detection do not depend on file name or timestamps. The platform does not hash item payloads; this is a rebuild-side mechanism. | Should | PC-EA | yes | QA-STD-045 | [TBD] — see OQ-STD-07 |
| FR-STD-103 | **[TBD — see OQ-STD-07]** The format shall be able to carry **dependencies** on other assets (e.g. a referenced material set, a terrain set, a parent model), declared explicitly. The *platform* supports item-level dependencies (FR-STD-121); the asset-format-level dependency declaration is not published. | Must | PC-EA | yes | QA-STD-045 | [TBD] — see OQ-STD-07 · platform analogue: https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3888358641555807825 |
| FR-STD-104 | On load, the game shall **resolve dependencies**, report **missing dependencies** to the player, and substitute a safe fallback (default palette / base model) rather than failing to load the creation. **[TBD — see OQ-STD-07]** — the *platform* reports missing item dependencies (FR-STD-121); the asset-level fallback rule is not published. | Must | PC-EA | yes | QA-STD-046 | [TBD] — see OQ-STD-07 · platform analogue: https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3888358641555807825 |
| FR-STD-105 | The game shall support **exporting** an authored asset to the format, and **importing** a file into the editor as a new asset. The exact container and file extension are not public → **OQ-STD-07** (proposed default: JSON manifest + RLE typed-array voxel payload, extension `.sccasset`). | Must | PC-EA | yes | QA-STD-046 | https://store.steampowered.com/app/3474890/SuperCitycon/ · Dev's Reddit post — https://www.reddit.com/r/supercitycon/ |
| FR-STD-106 | Import shall **validate** the file: unknown format version, malformed payload, out-of-range voxel index, or oversized dimensions shall be rejected with a specific, human-readable reason. **[TBD — see OQ-STD-07]** — a hard contract the rebuild must honour; the rules themselves are not published. | Must | PC-EA | yes | QA-STD-047 | [TBD] — see OQ-STD-07 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-STD-107 | An authored asset shall **not** be able to declare gameplay statistics that bypass the derivation. Whether the format carries an optional **gameplay-profile hint block** that the derivation consumes is **[TBD — see OQ-STD-09]**; the profile must be *hints*, never a raw override of the derived cost. | Must | PC-EA | partial | QA-STD-048 | Dev's Reddit post — https://www.reddit.com/r/supercitycon/ · [TBD] — see OQ-STD-09 |
| FR-STD-108 | An imported asset shall pass through the **same derivation** as an in-editor asset, so imports cannot bypass the cost/economic rules. **Evidenced**: the dev's Reddit statement covers any building that "transitions from the editor into the gameplay environment". | Must | PC-EA | partial | QA-STD-048 | Dev's Reddit post — https://www.reddit.com/r/supercitycon/ (exact permalink TBD → OQ-STD-01) |
| FR-STD-109 | The game shall persist authored assets in the player's own library so that they survive a session. **Evidenced**: the dev's authoring workflow shows a **model browser** listing the player's own models. Whether a placed instance can be **re-opened and re-edited** is **[TBD — see OQ-STD-31]**. | Must | PC-EA | partial | QA-STD-049 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-110 | **[TBD — design decision; see OQ-STD-36]** The game shall be able to **import a published Workshop creation directly into the player's library** as an editable asset (not only as a locked instance). The store copy speaks of placing *your own* creations; it does not describe importing a subscribed item. | Could | Design | partial | QA-STD-049 | [TBD] — see OQ-STD-36 |
| FR-STD-111 | The game shall **not** load third-party content into the simulation without validating it against the same integrity limits applied to its own content (see §3.9). **Evidenced as intent**: the dev states that user-made models need "some kind of quality level" and that the game must not "overflow … with a ton of different models". | Must | PC-EA | partial | QA-STD-050 | https://www.youtube.com/watch?v=NJfQ_5-wlWo |

### 3.8 Steam Workshop — publishing, item types, metadata, visibility, in-game flow

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-STD-112 | The game shall allow a player to **publish a creation to the Steam Workshop**. **Evidenced**: "share them through the Steam Workshop". *How* the publish flow is reached — an in-game dialog or the Steam client — is **[TBD — see OQ-STD-37]**; the store copy does not say. | Must | PC-EA | no | QA-STD-051 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-STD-113 | The Workshop shall support **shareable item kinds** corresponding to the authored kinds: **map**, **model** (building / vehicle / citizen / prop / terrain set), and **character**. **Evidenced** — the store's own feature bullet: "SCC Studio & Steam Workshop: Create, customize and share maps, models and characters with the in-game voxel editor". | Must | PC-EA | no | QA-STD-051 | https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-STD-114 | A published item shall carry the metadata set **title, description, thumbnail/preview image, and tags**; the exact field list and tag vocabulary for SuperCitycon are **OQ-STD-08** (proposed default: title ≤ 128 chars, description ≤ 8 000 chars, 1 thumbnail + ≥ 1 preview image, developer-defined tags for asset kind + theme + style). The *metadata model itself* is the platform's; the SuperCitycon field list and tag vocabulary are not published. | Must | PC-EA | no | QA-STD-052 | [TBD] — see OQ-STD-08 · https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3888358641555807825 |
| FR-STD-115 | The game shall let the publisher choose a **visibility** state for an item — at minimum public, unlisted, and friends-only. **This is Steam platform behaviour the game relies on**, not a SuperCitycon feature; any SuperCitycon-specific visibility states beyond the platform's are **[TBD — see OQ-STD-38]**. | Must | PC-EA | no | QA-STD-052 | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3888358641555807825 |
| FR-STD-116 | Publishing an item shall create a **version** of that item; updating an item shall create a **new version** while retaining the previous versions' history, and the publisher shall be able to **roll back** to an earlier version. **Steam platform behaviour the game relies on** — not a SuperCitycon feature and not an asset-format version (FR-STD-101). | Must | PC-EA | no | QA-STD-053 | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/521953615223457012 |
| FR-STD-117 | The game shall support **multiple simultaneous versions** of one published item, and shall support declaring the **supported game-version range** for each version — defaulting, per platform behaviour, to "works with any build" when no range is given. **Steam platform behaviour.** | Must | PC-EA | no | QA-STD-053 | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/521953615223457012 |
| FR-STD-118 | Where several versions of an item are compatible with the player's build, the game shall load the **latest uploaded compatible version**. **Steam platform behaviour.** | Must | PC-EA | no | QA-STD-054 | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/521953615223457012 |
| FR-STD-119 | **[TBD — design decision; see OQ-STD-37]** The game shall expose an **in-game Workshop browser** allowing a player to browse, preview, and subscribe to creations for this game. No source describes an in-game browser; the store copy says only that creations are shared *through the Steam Workshop*, and the app's Workshop hub is not yet publicly reachable (S27). | Could | Design | no | QA-STD-054 | [TBD] — see OQ-STD-37 |
| FR-STD-120 | **[TBD — design decision; see OQ-STD-37]** The in-game browser shall provide **filtering by item kind** (map / model / character) and by tag. The *platform* lets developers configure which filters apply to which item types (FR-STD-115/117 context); the in-game filter set is SuperCitycon-specific and not published. | Could | Design | no | QA-STD-055 | [TBD] — see OQ-STD-37 · https://steamcommunity.com/games/SteamWorkshop/announcements/detail/518616498862818032 |
| FR-STD-121 | Subscribing to an item shall also subscribe to its **declared dependencies**, and the game shall surface **missing dependencies**. **Steam platform behaviour the game relies on.** | Must | PC-EA | no | QA-STD-055 | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3888358641555807825 |
| FR-STD-122 | The game shall allow the player to **disable an item from being loaded** and to **change the load order** of subscribed items; where dependencies exist, load order may be **derived automatically from the dependency graph**. **Steam platform behaviour the game relies on.** | Must | PC-EA | no | QA-STD-056 | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3888358641555807825 |
| FR-STD-123 | The game shall support **subscription lists / collections** that can be saved, loaded and swapped, with **load order matching subscription order within a collection**. **Steam platform behaviour the game relies on.** | Should | PC-EA | no | QA-STD-056 | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3889485345756435017 |
| FR-STD-124 | **[TBD — design decision; see OQ-STD-36]** A subscribed creation shall become **available to place in the city** through the same placement flow as a locally authored creation. The store copy evidences placing *your own* creations; it does not describe placing a subscribed one, nor whether the derivation record is recomputed or restored (OQ-STD-14). | Could | Design | partial | QA-STD-057 | [TBD] — see OQ-STD-36 · https://store.steampowered.com/app/3474890/SuperCitycon/ |
| FR-STD-125 | Publishing shall be subject to the platform's **Workshop Legal Agreement**, and SuperCitycon shall additionally publish its own acceptable-item rules and entry rules (the platform explicitly states these differ per product). The **Workshop Legal Agreement is platform behaviour**; SuperCitycon's own acceptable-item rules are **[TBD — see OQ-STD-24]**. | Must | PC-EA | no | QA-STD-057 | https://steamcommunity.com/workshop/workshopsubmitinfo/ |

### 3.9 In-game integrity — ceilings, stat limits, moderation

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| FR-STD-126 | The editor shall enforce **per-kind voxel volume and dimension ceilings**, and shall refuse or clip an edit that would exceed them, with an explicit message. **Evidenced as intent**: the dev states that user-made models must keep "some kind of quality level" and that the game must not "overflow … with a ton of different models". **The ceilings themselves are [TBD — see OQ-STD-02]**. | Must | PC-EA | yes | QA-STD-058 | https://www.youtube.com/watch?v=NJfQ_5-wlWo · [TBD] — see OQ-STD-02 |
| FR-STD-127 | The game shall enforce a **performance ceiling** on authored content so that a city containing many player creations does not degrade below the **published minimum specification** (Win 10 64-bit, i5-6600 / Ryzen 5 1600, 8 GB RAM, GTX 1050 / RX 560 2 GB, DX11) — the game was "built … **with performance and scale in mind from day one**". The ceiling value is **[TBD — see OQ-STD-02]**. | Must | PC-EA | partial | QA-STD-058 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english (minimum spec) · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-STD-128 | A creation shall **not** be able to declare unique gameplay statistics that bypass the derivation — an authored asset's economy shall always be the derived value. **Evidenced**: the dev's Reddit statement that the game "automatically calculates construction costs and economic impact". Whether an author may *influence* derivation via gameplay-profile hints is **OQ-STD-09** (proposed default: hints may shift the result within bounded bands, never set it). | Must | PC-EA | partial | QA-STD-059 | Dev's Reddit post — https://www.reddit.com/r/supercitycon/ (exact permalink TBD → OQ-STD-01) |
| FR-STD-129 | The game shall apply the **same integrity validation to Workshop content** as to locally authored content. **[TBD — see OQ-STD-36]** — a hard contract the rebuild must honour; the rule is not published. | Must | PC-EA | partial | QA-STD-059 | [TBD] — see OQ-STD-36 · https://www.youtube.com/watch?v=NJfQ_5-wlWo |
| FR-STD-130 | **[TBD — design decision; see OQ-STD-24]** The game shall not allow a creation to **obscure or replace system-critical UI** or to embed interactive content, and shall treat any imported payload that is not voxel data as invalid. The platform states that "the acceptable items, entry rules, and rewards may be different for each product", so SuperCitycon's own rule is not the platform's. | Could | Design | yes | QA-STD-060 | [TBD] — see OQ-STD-24 · https://steamcommunity.com/workshop/workshopsubmitinfo/ |
| FR-STD-131 | The publisher of a Workshop item shall be able to **delete or unlist** it, and the game shall stop loading an item that has been deleted or has been removed by moderation. **Steam platform behaviour the game relies on.** | Must | PC-EA | no | QA-STD-060 | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3888358641555807825 |
| FR-STD-132 | The game shall follow the **Steam Workshop standard for moderation and takedown**: content violating Valve's Workshop rules is removed by Valve. SuperCitycon's own acceptable-item rules — forbidding items that break the game, exceed integrity ceilings, or are malicious — are **[TBD — see OQ-STD-24]**; the platform states these differ per product. | Must | PC-EA | partial | QA-STD-061 | [TBD] — see OQ-STD-24 · https://steamcommunity.com/workshop/workshopsubmitinfo/ |
| FR-STD-133 | **[TBD — design decision; see OQ-STD-24]** The editor shall **warn the player before publishing** if the creation is empty, exceeds a ceiling, or derives no gameplay role. | Could | Design | yes | QA-STD-061 | [TBD] — see OQ-STD-24 |
| FR-STD-134 | The game shall be **robust to a corrupt or truncated asset file** — it shall refuse the file and continue to run with the rest of the library intact. **[TBD — see OQ-STD-39]** — a hard contract the rebuild must honour; the behaviour is not published. | Must | PC-EA | yes | QA-STD-062 | [TBD] — see OQ-STD-39 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| FR-STD-135 | Every authored or imported asset shall be re-validated on **load of a save game**, so a saved city cannot be corrupted by a tampered asset file. **[TBD — see OQ-STD-39]** — a hard contract the rebuild must honour; the behaviour is not published. | Must | PC-EA | partial | QA-STD-062 | [TBD] — see OQ-STD-39 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |

---

## 4. Options, variants & configuration matrix

### 4.1 Editor mode / asset-type options matrix

| Asset kind | Customise existing | Author from empty grid | Has footprint | Has gameplay role | Derivation outputs produced | Shareable item kind |
|---|---|---|---|---|---|---|
| Building | Yes [S1] | Yes [S1] | Yes (world cells) | Yes | **[TBD — OQ-STD-33]** · proposed default: cost, capacity, jobs, coverage, points, wealth, pollution, traffic, tier, rarity | Model [S3] |
| Vehicle | Yes [S1] | Yes [S1] | n/a (instanced on road/rail) | Optional | **[TBD — OQ-STD-33]** · proposed default: cost only | Model [S3] |
| Citizen | Yes [S1] | Yes [S1] | n/a (agent) | n/a | **[TBD — OQ-STD-33]** · proposed default: cost only | Model [S3] |
| Prop | Yes [S1] | Yes [S1] | Yes (single cell) | Decoration | **[TBD — OQ-STD-33]** · proposed default: cost, pollution (visual) | Model [S3] |
| Terrain set | Yes [S1] | Yes [S1] | Yes (tile set) | Terrain (consumed by `WLD`) | **[TBD — OQ-STD-33]** · proposed default: cost of the set; no city economics | Model [S3] / terrain set [S14] |
| Character (player avatar) | n/a (created) | Yes [S2][S15] | n/a | n/a | **[TBD — OQ-STD-33]** · proposed default: cost of the asset | Character [S3] |
| Map (city layout) | Yes (edit a published map) | Yes [S3] | Yes (whole map) | Whole city | **[TBD — OQ-STD-33]** · proposed default: cost of contents only | Map [S3] |

### 4.2 Tool / operation matrix

| Group | Operations | Evidence | Notes |
|---|---|---|---|
| Voxel write | place/attach, erase, paint/recolour | [S33] — the developer's **public authoring workflow** (Magica Voxel) | the operation set is evidenced for the authoring workflow, **not** for SCC Studio — see OQ-STD-26 |
| Fill / stamp | fill (voxel/box/flood), stamp (box/plane/column/line) | — | **[TBD — design decision]** — not evidenced; see OQ-STD-26 |
| Selection | rectangular volume selection, select-all, invert selection | [S33] — a select tool is shown | selection feeds copy/paste/duplicate; see OQ-STD-26 |
| Clipboard | copy, paste, duplicate | [S33] — duplicate is shown | copy/paste semantics are **[TBD]** — see OQ-STD-27 |
| Structure | rotate 90°, scale (integer voxel step), resize dimensions, mirror | — | **[TBD — design decision]** — not evidenced; see OQ-STD-26 |
| Symmetry | mirror X, mirror Y, mirror Z, independently toggleable | — | **[TBD — design decision]** — not evidenced; see OQ-STD-28 |
| Navigation | orbit, pan, zoom; view snapping toggle; edit-grid snapping | [S33] — the 32-cell lattice | the navigation model is **[TBD]** — see OQ-STD-26; the camera itself is `UX`'s |
| Layers | add/select/hide/move group | — | **[TBD]** — layers/groups are not evidenced; see OQ-STD-10 |
| History | undo, redo | — | **[TBD]** — undo/redo is standard and required by any editor; no public source, see OQ-STD-11 |
| Palette | select material, switch material set, material class | [S33] — the palette is index-addressed (indices 9–13) | palette size/contents **[TBD]** — see OQ-STD-29; material classes **[TBD]** — see OQ-STD-03 |
| Derivation | live derivation readout, preview before commit | [S18] — **Reddit** | the *existence* of the derivation is evidenced; the inputs, outputs and readout are **[TBD]** — see OQ-STD-33 and OQ-STD-12 |
| Publishing | publish to Workshop, manage versions, set visibility/tags | [S3] (SuperCitycon item kinds) · [S21][S25] (**Steam platform**) | platform-backed; the SuperCitycon-specific parts are **[TBD]** — see OQ-STD-37 |

### 4.3 Derivation input → output matrix (what feeds what)

> **[TBD — see OQ-STD-33] The published record does not contain this matrix.** The developer's Reddit statement
> establishes only that the game "automatically calculates construction costs and economic impact" of any
> building that "transitions from the editor into the gameplay environment", and that the derivation must
> "function universally while still making logical sense". **Neither the input set, the output set, nor the
> mapping between them is published.** The previous revision of this table asserted a full ✔-matrix as if it
> were original behaviour; it was a proposed default and is now recorded as such. The formula itself is owned
> by `ECO` (§7 R1) and is not published anywhere.

| What is published | Status |
|---|---|
| A construction cost is computed automatically, with no manual entry by the player | [CONFIRMED] — Reddit (S18) |
| An "economic impact" is computed automatically | [CONFIRMED] — Reddit (S18) — **the impact is not enumerated** |
| The derivation is universal: no per-asset hand-authored cost table | [CONFIRMED] — Reddit (S18) |
| The derivation happens at the moment a creation enters the gameplay environment | [CONFIRMED] — Reddit (S18) |
| The **input set** (voxel count, bounding box, footprint, volume, interior volume, material histogram, surface area, floor count, glazing, emissive count, role, kind) | **[TBD — OQ-STD-33]** — proposed default: the geometric and material measures listed in §6.6 |
| The **output set** (cost, capacities, jobs, coverage, points, wealth, pollution, traffic, tier, rarity) | **[TBD — OQ-STD-33]** — proposed default: the measures listed in §6.5 |
| The **mapping** between inputs and outputs, and the formula | **[TBD — OQ-STD-33]** — owned by `ECO`; see §7 R1 |

### 4.4 Workshop item type & metadata matrix

| Item kind | SuperCitycon-specific | Platform-provided | [TBD] for SuperCitycon |
|---|---|---|---|
| Map | map data + contents | versions, deps, load order, collections, tags, visibility | map schema, size limits |
| Model (building/vehicle/citizen/prop/terrain set) | asset file + derived-properties record | " | derived-properties policy on publish |
| Character | character asset | " | character item schema |

Common metadata: **title, description, thumbnail/preview, tags** [S14 platform analogue + S3 SuperCitycon-specific kind list] · visibility: **public / unlisted / friends-only** [S25] · versioning: **version history + rollback + simultaneous versions + supported game-version ranges** [S21] · dependencies: **declared, auto-resolved, missing-dependency reporting** [S23].

---

## 5. Stage / progression matrix

| Stage | Entry condition | Editor capability | Asset kinds authorable | Derivation available | Workshop publishing | Exits when |
|---|---|---|---|---|---|---|
| `PC-EA` — row 1: **Next Fest demo** (appid 5295650) | installs the demo | The tech foundation exists ("At its core is the SCC Studio … Pretty much everything in the game can be made with it") but **no economy** and **no on-foot exploration**; the dev warns "almost nothing in this demo is final" [S4][S6] | n/a — scope not specified | Not meaningful: no economy [S4] | No | EA launches |
| `PC-EA` — row 2: **Early Access construction sandbox** (Q4 2026) | Early Access begins | **Full SCC Studio**: customise existing + empty-grid; all asset kinds incl. characters and maps [S1][S3][S15]; place creations directly in the city [S2] | Building, vehicle, citizen, prop, terrain set, character, map | **Derivation is computed** (cost + economic impact) [S18 — Reddit]; the economic *consequence* only lands with simulation modes | Announced and shipping [S3]; **not yet publicly reachable as of 2026-10-23** [S27] | Simulation modes arrive, or EA ends |
| `PC-EA` — row 3: **EA simulation modes** (RCI / resource-management / tycoon) | the dev's announced first two simulation modes | Unchanged | Unchanged | Derived values now **feed the live simulation**. The specific outputs that are fed are **[TBD — OQ-STD-33]**; the six growth bonuses and three wealth levels are themselves a mobile-title carry-over (**OQ-STD-25**) | Live | Full release |
| `PC-EA` — row 4: **full release** | full release | Unchanged; library keeps growing | Unchanged | Unchanged | Live, with the platform's version/dependency/collection features fully exercised [S21][S22][S23] | — |
| `Mobile` | App Store / Play | **No SCC Studio** — the mobile title is a separate game [S29]; it has a **Citycon Building** (each grants a permanent construction slot) and a building **store/inventory** [brief §3.4] | n/a | n/a | n/a | n/a |

**Domain stage note.** This domain has **no in-game progression ladder** — SCC Studio is not gated by level,
resident count or city tier in any published source. Its stage dimension is **product stage** crossed with
**asset kind**. The `Stage` column uses only the house vocabulary; the finer delivery order above is a
**sequence within `PC-EA`** (demo → Early Access sandbox → EA simulation modes → full release), not a separate
stage token — mapping from the previous vocabulary: `EA-DEMO` → `PC-EA` (row 1) · `EA-SBX` → `PC-EA` (row 2) ·
`EA-SIM` → `PC-EA` (row 3) · `POST-EA` → `PC-EA` (row 4) · `MOB-LIVE` → `Mobile` · `ALL` → `Both`. If a future
build gates authoring (e.g. Workshop publishing behind a level), that gate belongs to `CORE` and is currently
**OQ-STD-13**.

---

## 6. Data model

### 6.1 `VoxelModel` — the authored model

| Field | Type | Range / domain | Meaning | Source |
|---|---|---|---|---|
| `id` | string (uuid) | unique | Stable identity of the model | [S1] |
| `kind` | enum | building \| vehicle \| citizen \| prop \| terrain_set \| character \| map | Which authoring template applies | [S1][S3] |
| `parentAssetId` | string \| null | null for empty-grid creations | The base asset this was derived from | **[TBD]** OQ-STD-30 |
| `dims` | vec3 int | per-kind ceiling | Model dimensions **in voxels** (W×D×H) | [S33] (a one-cell model is 32×32×32 voxels) · ceiling **[TBD]** OQ-STD-02 |
| `pivot` | vec3 int | within dims | Anchor used for world placement | **[TBD]** OQ-STD-30 |
| `voxels` | grid of u16 | index into `palette` | Occupancy + material index per cell; 0 = empty | [S33] (index-addressed palette) |
| `paletteId` | string | id of a `MaterialSet` | Palette reference (not inline colours) | [S33] · set model **[TBD]** OQ-STD-29 |
| `layers` | list of cell-groups | — | Optional groups for addressability | **[TBD]** OQ-STD-10 |
| `gameplayProfile` | object \| null | see §6.6 | Optional *hints*, not raw stats | **[TBD]** OQ-STD-09 |
| `formatVersion` | int | ≥1 | Format version of the serialised form | **[TBD]** OQ-STD-07 |
| `contentHash` | hex string | — | Identity for change detection | **[TBD]** OQ-STD-07 |

### 6.2 `Voxel`

| Field | Type | Range | Meaning | Source |
|---|---|---|---|---|
| `x,y,z` | int | 0..dims−1 | Cell coordinates | [S33] (32-cell lattice) |
| `materialIndex` | u16 | 0..palette.length−1 (0 = empty) | Which palette entry fills the cell | [S33] (palette is index-addressed) |
| `flags` | bitmask | — | e.g. emissive, glazed, structural | **[TBD]** OQ-STD-03 |

### 6.3 `MaterialSet` (palette)

| Field | Type | Range | Meaning | Source |
|---|---|---|---|---|
| `id` | string | — | Palette identity | **[TBD]** OQ-STD-29 |
| `name` | string | — | Display name | **[TBD]** OQ-STD-29 |
| `entries[]` | list | — | `{ index, displayName, class, baseColour, tier }` | **[TBD]** OQ-STD-29 (index-addressed palette itself: [S33]) |
| `class` | enum | structural \| glass \| emissive \| foliage \| water \| road \| metal \| signage (proposed) | Semantic class used by the derivation | **[TBD]** OQ-STD-03 |
| `tier` | int | per material | Material quality tier feeding the derivation | **[TBD]** OQ-STD-03 |

### 6.4 `AssetDefinition` — the shippable asset

| Field | Type | Meaning | Source |
|---|---|---|---|
| `model` | `VoxelModel` | Geometry + palette | [S1] |
| `derived` | `CostDerivationRecord` | Auto-computed cost + economic impact — **the existence of the record is evidenced; its contents are not** | [S18 — Reddit] · contents **[TBD]** OQ-STD-33 |
| `identity` | object | `{ category, tier, rarity, wealthValue? }` — the **gameplay identity** preserved across appearance/dimension edits | [S18 — Reddit] · the field set and the PC/mobile parity of the tiers are **[TBD]** OQ-STD-25 |
| `placement` | object | `{ anchorRule, allowedTerrain, roadSnap }` | **[TBD]** OQ-STD-30 |
| `provenance` | object | `{ author, source: local \| workshop, workshopItemId?, workshopItemVersion? }` | [S3][S21] |

### 6.5 `CostDerivationRecord` — the auto-cost output

| Field | Type | Meaning | Source |
|---|---|---|---|
| `ruleSetVersion` | string | Version of the derivation rule set used | **[TBD]** OQ-STD-32 |
| `inputs` | `DerivationInputs` | The full input snapshot | **[TBD]** OQ-STD-33 |
| `buildCost` | number | Construction cost handed to `ECO` | [S18 — Reddit] |
| `residentialCapacity` | int | Resident slots (0 if no residential role) | **[TBD]** OQ-STD-33 |
| `jobCount` / `workspaceCapacity` | int | Jobs / workplaces | **[TBD]** OQ-STD-33 |
| `productionCapacity` | number | Industrial output capacity | **[TBD]** OQ-STD-33 |
| `coverageRadius` | number (cells) | Service coverage radius | **[TBD]** OQ-STD-33 |
| `culturePoints` / `entertainmentPoints` / `recreationPoints` | number | Growth-bonus point categories | **[TBD]** OQ-STD-33 · OQ-STD-25 |
| `wealthLevel` | 0 \| 1 \| 2 \| 3 | 0 = **no wealth value** (does not contribute to map wealth) | **[TBD]** OQ-STD-33 · OQ-STD-25 |
| `pollution` | number | Pollution contribution | **[TBD]** OQ-STD-33 |
| `trafficGenerated` / `trafficAttracted` | number | Traffic pressure | **[TBD]** OQ-STD-33 |
| `tier` / `rarity` | enum / int | Derived class | **[TBD]** OQ-STD-33 |
| `isDecoration` | bool | True when the asset has **no meaningful gameplay role** | **[TBD]** OQ-STD-33 |

### 6.6 `DerivationInputs` — the auto-cost input snapshot

**[TBD — see OQ-STD-33.]** The published record names **no** derivation inputs. *Proposed default (a rebuild
decision, not an original figure):* `occupiedVoxelCount` · `dims` · `footprintCells` · `occupiedVolume` ·
`enclosedInteriorVolume` · `exposedSurfaceArea` · `floorCount` · `glazingRatio` · `emissiveVoxelCount` ·
`materialHistogram{}` · `assetKind` · `authoredRole` · `ruleSetVersion`. The only published fact about the
derivation is that it exists, is automatic and is universal ([S18 — Reddit]).

### 6.7 `WorkshopItem` (SuperCitycon-specific part)

| Field | Type | Meaning | Source |
|---|---|---|---|
| `itemKind` | enum | map \| model \| character | [S3] |
| `title` | string | Display name | **[TBD]** OQ-STD-08 (platform metadata model: [S23]) |
| `description` | string | Free text | **[TBD]** OQ-STD-08 |
| `thumbnail` / `previewImages` | image[] | Preview art | **[TBD]** OQ-STD-08 |
| `tags` | string[] | Developer-defined tags (kind, theme, style) | [S24] — **Steam platform** |
| `visibility` | enum | public \| unlisted \| friends_only | [S25] — **Steam platform** |
| `assetFile` | binary | The serialised `VoxelModel` + profile | [S18 — Reddit] · layout **[TBD]** OQ-STD-07 |
| `derivedSnapshot` | object | Optional: the derived properties as published | **[TBD]** OQ-STD-14 |
| `supportedGameVersions` | range | Platform-provided; defaults to "any build" | [S21] — **Steam platform** |
| `dependencies` | itemId[] | Declared dependencies | [S23] — **Steam platform** |

---

## 7. Rules, formulas & tuning

**R1 — Universal derivation (evidenced — Reddit).** "The game **automatically calculates construction costs and economic impact** of any building that transitions from the editor into the gameplay environment … needed to **function universally while still making logical sense**." → the derivation is a **general rule over voxel geometry**, never a per-asset lookup table. [S18 — **Reddit, by the developer**; not the Steam store page]. **The formula itself is not published (OQ-STD-33) and is owned by `ECO`.**

**R2 — Transition point (evidenced).** The derivation is guaranteed to be correct **at the moment the creation transitions from the editor into the gameplay environment**. The engine must therefore produce the derived record as part of the commit/place transaction, atomically with placement. [S18 — Reddit]

**R3 — Live preview. [TBD — design decision; OQ-STD-12].** *Not evidenced* whether the derivation is displayed continuously while editing or only at commit. Recommended default: compute continuously (it is cheap and monotonic), and display a compact readout that updates on every edit; the commit is the point at which the value becomes authoritative. [S18 — Reddit]

**R4 — Monotonicity. [TBD — design decision; OQ-STD-32].** Scaling up a model never lowers its cost (FR-STD-057); upgrading a material never lowers cost (FR-STD-058). These are the two monotonicity invariants a "logical sense" derivation *should* satisfy — an inference from the developer's wording, not a published rule. [S18 — Reddit]

**R5 — Determinism & versioning. [TBD — design decision; OQ-STD-32].** `derived = f(assetDefinition, ruleSetVersion)`. The record stores the rule-set version so that a city saved under rule-set *v*1 can be re-derived under *v*2 without changing the already-placed assets' economics (re-derive on demand, never silently on load). Not stated by any source. [S18 — Reddit]

**R6 — Footprint mapping. [TBD — design decision; OQ-STD-05].** Footprint = the set of (x,z) world cells under the model's occupied volume, relative to the pivot. A building placed on a lot of N×M cells requires a model whose footprint fits within N×M; mismatch is surfaced to the player (FR-STD-045). The **32-voxel cell → 1 world cell** mapping is evidenced; the containment/exactness rule is not. [S33][S18]

**R7 — Identity preservation (evidenced — Reddit).** Appearance and dimension edits preserve the asset's gameplay identity (category/tier/catalogue position); re-classification is an explicit, separate player action. [S18 — Reddit]

**R8 — No meaningful gameplay role. [TBD — design decision; OQ-STD-33].** An authored asset with no gameplay role becomes **decoration**: it still carries a construction cost and still counts toward the city's **diversity** (each unique building = 1 diversity point, 1 % bonus, capped at 250 % — a `POP` rule), but it contributes **no** residential capacity, jobs, production, coverage, culture/entertainment/recreation points, wealth value, or traffic. `wealthLevel = 0` ("no wealth value") — only buildings *with* a wealth value contribute to the map's average wealth level. The *output set* this rule constrains is not published (OQ-STD-33); the growth-bonus and wealth-level semantics are a mobile-title carry-over (OQ-STD-25). [S18 — Reddit][brief §3.6]

**R9 — Format rules (evidenced shape, exact bytes [TBD — OQ-STD-07]).** One format for all kinds ([S18]); voxels stored as **material indices** and dimensions **in voxels** ([S33]); explicit pivot; palette/material-set reference; format version; optional dependency list; content hash — **all of the last five are the rebuild's proposed shape, not published**. A *new* palette reference must not require rewriting voxel data. [S18][S33][OQ-STD-07]

**R10 — Published-item derivation.** When a creation is published, the derived record may be **snapshotted** with the item so that subscribers see identical economics, or **recomputed on load** so that balance changes propagate. *Not evidenced* → **OQ-STD-14**; recommended default: **snapshot the derivation record and the rule-set version at publish time, and re-derive only when the rule-set version changes**, so that published creations remain economically stable.

**R11 — Platform vs. SuperCitycon.** All of §4.4's platform column is **Valve's**, not SuperCitycon's: version history + rollback, simultaneous versions, game-branch version ranges (default "any build"), latest-compatible-version selection, dependencies + auto load order + missing-dependency reporting, item disabling, local load order, Collections (load order = subscription order, shareable by link), tags, visibility (public/unlisted/friends-only), developer-configurable per-item-type filters, and the Workshop Legal Agreement. **Everything about *which* item kinds exist, *what* an item contains, *how* an item is validated, and *how* the in-game browser behaves is SuperCitycon-specific and currently [TBD].** [S21][S22][S23][S24][S25][S26]

**R12 — Naming (evidenced, non-negotiable lore).** "City Constructions Inc." is the in-world company; "Citycon" is the shortened form forced by the **low voxel resolution** of the facade; the project was "City" from 2017 for 2½ years; "Super" is from the **16-bit / SNES era** and from **SimCity on the Super Nintendo**; the name can be read as "Super City Constructions". The game named itself. [S9][S10][S11][S12][S13]

**R13 — Stability caveat.** The dev states the UI is being rebuilt from scratch and that the demo is not final [S7]; no screenshot in any public source shows SCC Studio's chrome. Therefore **no requirement in §3.2 may be implemented as a fixed layout**, and every editor behaviour in this document is deliberately stated as a *behaviour*, not a pixel arrangement. [S7]

---

## 8. Edge cases, failure modes & required behaviours

| # | Situation | Required behaviour | FRs |
|---|---|---|---|
| E1 | Authored model is **empty** (zero voxels) | Block placement; block publish; explain that the model has no content. | FR-STD-133 |
| E2 | Authored model exceeds the per-kind **dimension or volume ceiling** | Refuse the edit / clamp the resize with an explicit message; never silently truncate. | FR-STD-126 |
| E3 | Resize **crops** existing voxels | Apply the stated crop rule (OQ-STD-04) and re-derive; warn if the crop removes occupied cells. | FR-STD-041 |
| E4 | Re-dimensioned building **no longer fits its placed lot** | Refuse commit with a conflict message; relocation is an explicit action. | FR-STD-048 |
| E5 | Model placed on **slope / non-flat terrain** | Placement follows the terrain anchoring rule owned by `WLD`; the footprint snaps to the terrain's cell grid. | FR-STD-043 |
| E6 | Asset with **no meaningful gameplay role** | Derive cost only; mark `isDecoration`; contribute nothing to capacity/jobs/coverage/points/wealth/traffic; still count for diversity. | FR-STD-079, R8 |
| E7 | Model has **no wealth value** (e.g. a shed) | `wealthLevel = 0`; excluded from the map's average-wealth computation. | FR-STD-077 |
| E8 | Asset references a **missing palette or dependency** | Load with a fallback palette/base model, display the missing-dependency warning, do not fail the load. | FR-STD-104 |
| E9 | Imported file has a **newer format version** | Refuse with a specific reason; offer migration only for supported older versions. | FR-STD-101, FR-STD-106 |
| E10 | Imported file has a **voxel index outside the palette range** | Reject the file with a named reason; do not partially import. | FR-STD-106 |
| E11 | Asset file is **corrupt or truncated** | Refuse the file, keep the rest of the library playable, and offer a re-download for Workshop items. | FR-STD-134 |
| E12 | Save game contains a **tampered asset** | Re-validate on load; quarantine the offending instance; do not corrupt the city. | FR-STD-135 |
| E13 | Published item's **author deletes it** | Stop loading it in clients; existing placed instances degrade gracefully to the base asset. | FR-STD-131 |
| E14 | Several item versions are **compatible** with the player's build | Load the latest uploaded compatible version. | FR-STD-118 |
| E15 | Item declares a **missing dependency** | Surface it explicitly (platform behaviour) and offer to subscribe to the dependency and its own dependencies. | FR-STD-121 |
| E16 | City is **heavily modded** and hits the performance ceiling | Enforce the integrity ceiling at publish/import time; degrade or refuse rather than ship a city that breaks the minimum spec. | FR-STD-127, FR-STD-129 |
| E17 | Player tries to **give a creation unique stats** | Not permitted; the profile block is hints only, bounded by the rule set. | FR-STD-107, FR-STD-128 |
| E18 | **Undo/redo** across a dimension change | Undo restores both geometry and the pre-change derived record. | FR-STD-027 |
| E19 | **Symmetry** on an odd-width axis | Mirror about the lattice centre; never produce half-voxel offsets. | FR-STD-031 |
| E20 | Player edits the **Citycon Building** itself | Allowed under the chosen default (OQ-STD-34) — it is an ordinary authored asset; naming/lettering is content, not engine state. | FR-STD-085 |
| E21 | Workshop is **unreachable** (no network / client not signed in) | The in-game browser shows an explicit offline state; local authoring and placement continue to work. | FR-STD-119 |

---

## 9. Non-functional requirements

| ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source |
|---|---|---|---|---|---|---|
| NFR-STD-001 | **[TBD — design decision; see OQ-STD-26]** The editor shall keep the game **navigable and the city interactive** while open (no full-screen lock-in), so that the player can author against a live city. No source describes the editor's relationship to the live city. | Could | Design | partial | QA-STD-063 | [TBD] — see OQ-STD-26 |
| NFR-STD-002 | **[TBD — design decision; see OQ-STD-12]** The derivation shall be **cheap enough to recompute on every edit** (no perceptible stall while painting), so the cost readout can stay live. | Could | Design | yes | QA-STD-063 | [TBD] — see OQ-STD-12 |
| NFR-STD-003 | Authored content shall respect the published **minimum specification** (Win 10 64-bit, i5-6600 / Ryzen 5 1600, 8 GB RAM, GTX 1050 / RX 560 2 GB, DX11) — the game is "built … with performance and scale in mind from day one". The **specification is published**; the "respect" clause is the rebuild's contract. | Must | Both | partial | QA-STD-064 | https://store.steampowered.com/api/appdetails?appids=3474890&l=english (minimum spec) · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| NFR-STD-004 | **[TBD — design decision; see OQ-STD-32]** The derivation shall be **deterministic across platforms and across machines** — identical asset input yields identical derived output on Windows and macOS. | Could | Design | yes | QA-STD-064 | [TBD] — see OQ-STD-32 |
| NFR-STD-005 | The asset format shall be **forward-versioned**: a file written by a newer minor format version must not silently load as different content. **[TBD — see OQ-STD-07]** — a hard contract the rebuild must honour; the versioning *rule* is not published. | Must | Both | yes | QA-STD-065 | [TBD] — see OQ-STD-07 · https://steamcommunity.com/games/SteamWorkshop/announcements/detail/521953615223457012 (platform analogue) |
| NFR-STD-006 | Loading third-party content shall be **sandboxed**: a malformed asset may fail to load but must not crash the game or corrupt a saved city. **[TBD — see OQ-STD-39]** — a hard contract the rebuild must honour; the behaviour is not published. | Must | Both | yes | QA-STD-065 | [TBD] — see OQ-STD-39 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| NFR-STD-007 | **[TBD — design decision; see OQ-STD-02]** The editor shall support a **10 000-voxel budget per authored model** as a working performance envelope. The figure is a **proposed default, not a published value**; the real ceiling is **OQ-STD-02**. | Could | Design | yes | QA-STD-066 | [TBD] — see OQ-STD-02 |
| NFR-STD-008 | **[TBD — design decision; see OQ-STD-32]** The derivation record shall be **self-describing** (inputs + outputs + rule-set version stored together) so any placed asset's economics can be explained to the player after the fact. | Could | Design | yes | QA-STD-066 | [TBD] — see OQ-STD-32 |
| NFR-STD-009 | The editor's behaviour shall be **stable across the Early Access → full-release transition**: asset files authored during EA shall remain loadable, with versioned migration rather than breakage. **[TBD — see OQ-STD-07]**. | Must | PC-EA | yes | QA-STD-067 | [TBD] — see OQ-STD-07 · https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 |
| NFR-STD-010 | **[TBD — design decision; see OQ-STD-37]** The in-game Workshop browser shall degrade gracefully when the Steam client or network is unavailable. (The in-game browser itself is a design decision — FR-STD-119.) | Could | Design | partial | QA-STD-067 | [TBD] — see OQ-STD-37 |
| NFR-STD-011 | The whole `STD` subsystem shall be implementable in a **browser-based 3D stack** (MiniMax Code / Three.js-class), with the Workshop integration isolated behind a single service boundary so the rest of the game is platform-neutral. **This is a rebuild-target constraint of the dossier, not a claim about the original game** — the original's technology stack is not published. **[TBD — rebuild-target decision; see OQ-STD-40]**. | Must | Both | partial | QA-STD-068 | [TBD] — rebuild target, see OQ-STD-40 |
| NFR-STD-012 | **[TBD — design decision; see OQ-STD-41]** All editor behaviours shall be **accessible without mouse-precision assumptions** (keyboard-navigable tool selection, undo/redo shortcuts) — the editor must not be usable only by precise pointer work. | Could | Design | yes | QA-STD-068 | [TBD] — see OQ-STD-41 |

---

## 10. Acceptance-criteria suites

| ID | Given | When | Then | Covers |
|---|---|---|---|---|

> **Reading these suites.** Every row states an **observable outcome** — the behaviour the rebuild must produce
> and how a tester sees it. Where a covered FR is marked `[TBD — design decision]`, the suite tests the
> **chosen default recorded in §11**, not an original behaviour: the suites are the rebuild's contract, and the
> §11 entry is the question that would change the answer.
| QA-STD-001 | A running PC build of SuperCitycon | The player opens SCC Studio | The editor opens in-game with two modes: customise-existing and empty-grid | FR-STD-001, FR-STD-002 |
| QA-STD-002 | A city containing a building, a vehicle, a citizen, a prop and a terrain set | The player selects each and chooses "edit" | Each opens in the editor with its own model loaded, editable, and closable without mutating the world | FR-STD-003…007, FR-STD-013 |
| QA-STD-003 | The SCC Studio launcher | The player picks "new character" / "new map" | A character (and a map) can be authored from an empty grid | FR-STD-008, FR-STD-009 |
| QA-STD-004 | One editor session | The player edits a single wall voxel and, in a second session, edits a terrain set spanning many tiles | The same toolset serves both; the single-voxel edit and the landscape-scale edit are both supported | FR-STD-010, FR-STD-011 |
| QA-STD-005 | An open editor over a placed building | The player edits voxels then exits without confirming | The world instance is unchanged; confirming applies the edit | FR-STD-013, FR-STD-050 |
| QA-STD-006 | A new empty-grid document | The player opens the dimension control | A voxel grid with declared W×D×H appears and is editable | FR-STD-014, FR-STD-015 |
| QA-STD-007 | The voxel grid | The player places, erases and rotates content | Occupancy changes as commanded; the grid stays axis-aligned; rotation preserves material assignment | FR-STD-016…018, FR-STD-038 |
| QA-STD-008 | The voxel grid | The player paints an existing voxel and floods a box | Only the material index changes on paint; fill respects the region selected | FR-STD-019…021 |
| QA-STD-009 | The voxel grid | The player picks a material with the eyedropper, then copies and pastes a region | The active material matches the picked cell; the pasted region reproduces occupancy and materials | FR-STD-022…024 |
| QA-STD-010 | A document with edits | The player duplicates it, then undoes and redoes | A second independent asset exists; undo and redo restore occupancy, materials and structural changes | FR-STD-025…027 |
| QA-STD-011 | The editor viewport | The player orbits, pans, zooms and toggles snapping | The camera moves independently of the game camera; snapping constrains the view and the edits stay on-lattice | FR-STD-028…030 |
| QA-STD-012 | Symmetry enabled on X, Y and Z | The player places and erases voxels | Mirrored edits appear on every enabled axis only; odd axes mirror about the lattice centre | FR-STD-031…033 |
| QA-STD-013 | The palette panel | The player switches to a different material set | The active material changes; models referencing a material set restyle without rewriting voxel data | FR-STD-034…037 |
| QA-STD-014 | A model | The player scales it by one voxel step | Dimensions, footprint and derived properties all update | FR-STD-039 |
| QA-STD-015 | A new model | The player sets its dimensions explicitly | The authoring volume resizes; the stated crop rule is applied and the result is re-derived | FR-STD-040, FR-STD-041 |
| QA-STD-016 | A model with a pivot | The player inspects its footprint | The footprint is the set of world cells under the occupied volume, relative to the pivot | FR-STD-042, FR-STD-043 |
| QA-STD-017 | A model resized to a different footprint | The player places it on a lot | The footprint is re-validated against the lot; a mismatch is reported, not silently accepted | FR-STD-044, FR-STD-045 |
| QA-STD-018 | A placed library building | The player changes its wall colour and then its dimensions | The building keeps its category/tier/identity; only appearance, footprint and derived values change | FR-STD-046, FR-STD-047 |
| QA-STD-019 | A building that no longer fits its lot | The player commits the resize | The commit is refused with a conflict message, or relocated only on an explicit action | FR-STD-048 |
| QA-STD-020 | An empty-grid creation | The player places it in the city | It appears as a placed instance with no base-game parent | FR-STD-049…051 |
| QA-STD-021 | Two instances of one authored asset | The player edits one | Only that instance changes | FR-STD-052 |
| QA-STD-022 | An authored building | The player commits it into the city | A construction cost and an economic impact are computed automatically with no manual entry | FR-STD-053, FR-STD-054 |
| QA-STD-023 | The same asset definition, loaded twice | The derivation runs both times | The derived record is byte-identical, including the rule-set version | FR-STD-055, FR-STD-059 |
| QA-STD-024 | A model, then the same model with 100 more voxels | The derivation runs | The larger model never costs less | FR-STD-057, FR-STD-058 |
| QA-STD-025 | An authored model | The player inspects the derivation inputs | The derivation's input record (the proposed default set of §6.6 — OQ-STD-33) is present and current: voxel count, dims, volume, footprint, interior volume, material histogram, floor count and role | FR-STD-060…068 |
| QA-STD-026 | A model with a hole in the middle | The player inspects the derivation | The proposed input record reports enclosed interior volume from the occupancy shell, not from the bounding box (OQ-STD-33) | FR-STD-063 |
| QA-STD-027 | A model with a decorative facade and a lit interior | The player inspects the derivation | The proposed input record reports surface area, glazing ratio and emissive count separately (OQ-STD-33) | FR-STD-065, FR-STD-066 |
| QA-STD-028 | A model authored as residential vs. as commercial | The derivation runs on both | Under the proposed output set (OQ-STD-33) residential capacity is non-zero only for the first; job count only for the second | FR-STD-067, FR-STD-069, FR-STD-072, FR-STD-073 |
| QA-STD-029 | A small model and a large model | The derivation runs | Under the proposed output set (OQ-STD-33) tier and rarity differ, and build cost tracks scale | FR-STD-070, FR-STD-071 |
| QA-STD-030 | A residential model | The player inspects the derivation output | The proposed output record (OQ-STD-33) carries residential capacity and job count, and zero where not applicable | FR-STD-072…074 |
| QA-STD-031 | A service building and a park | The derivation runs | The proposed output record (OQ-STD-33) carries a non-zero coverage radius and culture/entertainment/recreation points | FR-STD-075, FR-STD-076 |
| QA-STD-032 | A luxury tower and a plain shed | The derivation runs | The proposed output record (OQ-STD-33) reports different wealth levels; the shed reports "no wealth value" (0) | FR-STD-077, FR-STD-078 |
| QA-STD-033 | A placed authored building | The player saves, reloads, and inspects the asset | The full derivation record — inputs, outputs, rule-set version — is restored | FR-STD-079 |
| QA-STD-034 | A city | The player places the Citycon Building | A construction yard stands in the city, with "City Constructions Inc." on the facade | FR-STD-080, FR-STD-081 |
| QA-STD-035 | The Citycon Building's facade lettering | The player inspects it | The lettering is voxel text; the short name "Citycon" is present and readable at the model's voxel resolution | FR-STD-082, FR-STD-083 |
| QA-STD-036 | A city | The player interacts with the Citycon Building | Under the chosen default (OQ-STD-34) it is the construction yard, authored assets enter the city's build flow through it, and the building itself can be opened in SCC Studio | FR-STD-084, FR-STD-085 |
| QA-STD-037 | Two Citycon Buildings | The player compares them | Each grants the construction-slot/privilege the mechanic defines | FR-STD-086, FR-STD-087 |
| QA-STD-038 | The character creator | The player starts | A character can be authored from scratch in the voxel editor | FR-STD-088, FR-STD-089 |
| QA-STD-039 | A character in progress | The player changes proportions and colours | The appearance changes and the framing view updates | FR-STD-090, FR-STD-097 |
| QA-STD-040 | A finished character | The player enters first-person mode and then places the character in the city | The character is the first-person avatar and is also placeable as a citizen instance that walks the city's navigation | FR-STD-091…093 |
| QA-STD-041 | The demo build | The player tries to walk on foot / create a character | First-person avatar features are absent in the demo and present in EA — the two are not conflated | FR-STD-094, FR-STD-095 |
| QA-STD-042 | A finished character | The player publishes it | It appears in the sharing pipeline under the "character" item kind | FR-STD-096 |
| QA-STD-043 | An authored asset | The player exports it | A single file contains material indices, dimensions, pivot, palette reference and kind | FR-STD-098, FR-STD-099 |
| QA-STD-044 | An exported file | The player re-imports it | The model round-trips identically and carries a format version | FR-STD-100, FR-STD-101 |
| QA-STD-045 | Two exports of the same content | The player compares them | The content hash matches; a one-voxel change changes it | FR-STD-102 |
| QA-STD-046 | An asset depending on a palette set that is absent | The player loads it | The asset loads with a fallback palette and the missing dependency is reported | FR-STD-103, FR-STD-104 |
| QA-STD-047 | A malformed file | The player imports it | Import is refused with a specific reason and nothing partial is created | FR-STD-105, FR-STD-106 |
| QA-STD-048 | An imported asset with a gameplay profile | The player places it | The derivation runs on the import path too; the profile biases but never sets the cost | FR-STD-107, FR-STD-108 |
| QA-STD-049 | A saved city and a published Workshop model | The player reloads / subscribes | Local assets persist and re-edit; the subscribed model enters the library as an editable asset | FR-STD-109, FR-STD-110 |
| QA-STD-050 | A tampered Workshop asset | The player loads it | It is rejected by the same integrity validation applied to local assets | FR-STD-111 |
| QA-STD-051 | A finished creation | The player publishes it | It reaches the Steam Workshop for this game under the correct item kind | FR-STD-112, FR-STD-113 |
| QA-STD-052 | The publish form | The player fills it in | Title, description, thumbnail and tags are captured, and visibility can be set to public / unlisted / friends-only | FR-STD-114, FR-STD-115 |
| QA-STD-053 | A published item | The player updates it | A new version is created, history is retained, and rollback is possible | FR-STD-116 |
| QA-STD-054 | An item with two versions, one compatible with the current build | The player subscribes | The latest uploaded compatible version is loaded | FR-STD-117, FR-STD-118 |
| QA-STD-055 | The in-game Workshop browser (chosen default, OQ-STD-37) | The player filters by kind and by tag | Filtering by map / model / character works, and subscribing pulls in dependencies while reporting missing ones | FR-STD-119, FR-STD-120, FR-STD-121 |
| QA-STD-056 | A subscribed set with dependencies | The player inspects subscriptions | Items can be disabled and load order changed, and a collection can be saved with load order = subscription order | FR-STD-122, FR-STD-123 |
| QA-STD-057 | A subscribed creation | The player places it in the city | Under the chosen default (OQ-STD-36) it places through the same flow as a local creation, with a derivation record present | FR-STD-124, FR-STD-125 |
| QA-STD-058 | An over-ceiling model / a city of many creations | The player attempts the edit / loads the city | The edit is refused with a message and the city stays within the performance envelope | FR-STD-126, FR-STD-127 |
| QA-STD-059 | A creation attempting to declare its own stats | The player publishes it | The declared stats are ignored/bounded and the derived values govern | FR-STD-128, FR-STD-129 |
| QA-STD-060 | A published item that is later deleted or unlisted | The player loads the city | The item is no longer loaded and the game remains playable | FR-STD-130, FR-STD-131 |
| QA-STD-061 | A creation that breaks the rules | The player tries to publish it | The platform's Workshop rules and SuperCitycon's own acceptable-item rules are enforced; pre-publish warnings appear for empty, oversized or role-less creations | FR-STD-132, FR-STD-133 |
| QA-STD-062 | A corrupt asset file / a tampered save | The player loads | The file is refused, the library survives, and the save is quarantined rather than corrupted | FR-STD-134, FR-STD-135 |
| QA-STD-063 | A live city behind an open editor | The player paints continuously | The city stays navigable and the cost readout updates with no perceptible stall | NFR-STD-001, NFR-STD-002 |
| QA-STD-064 | The same asset on Windows and on macOS | The derivation runs | The derived record is identical | NFR-STD-003, NFR-STD-004 |
| QA-STD-065 | A file from a newer format version | The player imports it | It is refused, never silently reinterpreted; a malformed file cannot crash the game | NFR-STD-005, NFR-STD-006 |
| QA-STD-066 | A large authored model | The player edits it | The model stays inside the voxel budget and the derivation record remains self-describing | NFR-STD-007, NFR-STD-008 |
| QA-STD-067 | An asset authored during EA | The player loads it after a later build | It still loads, migrated by version rather than broken | NFR-STD-009, NFR-STD-010 |
| QA-STD-068 | The whole subsystem in a browser build | The player authors and publishes | The editor, the derivation and the Workshop flow work, with the platform integration behind a service boundary and keyboard-reachable tools | NFR-STD-011, NFR-STD-012 |

---

## 11. Open questions & TBDs

| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| OQ-STD-01 | What is the **exact URL** of the dev's Reddit post describing the "unique format" and the automatic cost/economic calculation? During this audit Reddit's `.json` API and `old.reddit.com` still returned a network-security block, but post bodies were readable through Reddit's **embed** endpoint (`embed.reddit.com`), so three dev posts are now quoted verbatim in §12 (sources 21, 24, 25) — **the specific post carrying the auto-cost statement was still not recovered.** | FR-STD-012, FR-STD-046…047, FR-STD-053…054, FR-STD-071, FR-STD-098, FR-STD-107…108, FR-STD-128 all rest on this single quote. The **attribution is now correct — Reddit, by the developer, not the Steam store page — but the permalink must be citable so a reader can verify it.** | Cite as "Dev's Reddit post — https://www.reddit.com/r/supercitycon/ (exact permalink TBD → OQ-STD-01)" until the permalink is recovered. **The auto-cost requirement stands as CONFIRMED meanwhile; the formula does not.** |
| OQ-STD-02 | What are the **per-kind authoring volume resolutions and maximum dimensions**? | Determines the editor's grid, the budget in NFR-STD-007, and the footprint ceilings. **No source publishes a resolution.** The only published voxel figure is the **32-voxel map cell** (S33), which fixes the *footprint* granularity, not the authoring volume. | Footprint cells × 32 voxels; e.g. 64×64×64 buildings/props, 32×32×16 vehicles, 16×16×24 citizens/characters, 128×128×32 terrain sets; 10 000 voxels per model as a working envelope. **All figures are proposed defaults, not published values.** |
| OQ-STD-03 | What is the **material class list** (and per-class tier ladder) that the derivation reads? | The class list *is* the derivation's semantic input (glass ⇒ capacity, emissive ⇒ culture, signage ⇒ flavour). | Eight classes: structural, glass, emissive, foliage, water, road, metal, signage — each with a tier 1..n. |
| OQ-STD-04 | On resize, are voxels **cropped** or is the resize refused? | A crop rule that silently deletes a floor is a data-loss bug. | Refuse if occupied cells would be removed; offer "crop from the far edge" as an explicit opt-in. |
| OQ-STD-05 | Must an authored building's footprint **exactly** match the lot, or may it be contained? | Determines the placement validation and the auto-grow/auto-shrink behaviour. | Containment allowed; a footprint smaller than the lot is auto-centred; a larger one is refused with the lot size stated. |
| OQ-STD-06 | On a footprint conflict, does the game **relocate automatically** or refuse? | Auto-relocation silently moves the player's building. | Refuse with a conflict message; relocation is an explicit action. |
| OQ-STD-07 | What are the **exact container, extension and byte layout** of the asset format? | Required to interoperate with any external tool and to reimplement the format faithfully. | JSON manifest + RLE compressed typed-array voxel payload; extension `.sccasset`; manifest keys `formatVersion`, `kind`, `dims`, `pivot`, `paletteId`, `gameplayProfile`, `deps`, `contentHash`. |
| OQ-STD-08 | What are SuperCitycon's **Workshop item metadata fields and tag vocabulary**? | Needed for the publish form and the in-game browser filters. | Title (≤128), description (≤8000), 1 thumbnail + ≥1 preview, tags for asset kind / theme / architectural style. |
| OQ-STD-09 | May an author **influence** the derivation at all via the gameplay profile? | Determines whether mods can be "tuned" or only shaped. | Hints only, bounded to a ±band around the derived value; the raw cost is never settable. |
| OQ-STD-10 | Does SCC Studio have **layers/groups**? | FR-STD-033 is currently unevidenced. | No formal layers; a flat voxel grid with named selections only. If layers exist, they are groups of cell-ranges. |
| OQ-STD-11 | Are **undo/redo** and copy/paste present, and how deep is the history? | FR-STD-026/027 assume a standard editor history. | Undo/redo present, ≥ 200 steps, whole-operation granularity. |
| OQ-STD-12 | Is the derivation shown **live while editing** or only on commit? | Decides the editor's cost-readout UX and the compute cost of the editor. | Live, continuous recompute with a compact readout; commit makes it authoritative. |
| OQ-STD-13 | Will **Workshop publishing be gated** by level / city stage / account state? | Determines whether the `Stage` column needs a progression dimension. | Ungated in the PC title's Early Access sandbox (`PC-EA`); publishing requires a signed-in Steam client with a linked account. |
| OQ-STD-14 | On publish, is the **derived-properties record snapshotted** or recomputed on load? | Decides whether balance changes silently alter published creations. | Snapshot at publish time with the rule-set version; re-derive only when the rule-set version changes. |
| OQ-STD-15 | Does a published item expose its **item kind** to the platform's per-type filters as "Map" vs "Item" (or a third category)? | The platform supports developer-defined per-type filters; SuperCitycon's mapping is unknown. | Map → "Maps or Levels"; model/character → "Items". |
| OQ-STD-16 | Are there **in-game content-type limits** beyond the format's? | Determines what a modder can and cannot publish. | No structural limits beyond the format; items must be loadable by the shipped engine without external assets. |
| OQ-STD-17 | Can a creation include **custom scripts / logic** (e.g. a factory that behaves specially)? | A major capability decision; would also change the integrity story. | No scripting; behaviour is entirely derived from the kind + role + material composition. |
| OQ-STD-18 | Does the character system support **animation rigs** (skeleton + clip), or is the character a static voxel mesh with procedural motion? | Determines the character file schema. | A named skeleton with a small fixed clip set (idle/walk/run), procedurally driven by the simulation. |
| OQ-STD-19 | What are the **character appearance options** beyond colour (body type, hair, face, height)? | FR-STD-090 currently states only proportions and colours. | Body proportions (3 presets), height, skin/hair/garment colours, and 1 hat slot. |
| OQ-STD-20 | Does the **Citycon Building** on the PC title keep the mobile's "each grants a permanent construction slot" mechanic, or is it a different construction point? | FR-STD-086 is a mobile-title carry-over and is not evidenced for PC. | Yes — each Citycon Building grants one additional permanent construction slot, matching mobile. |
| OQ-STD-21 | Does the PC title's construction yard also carry the mobile's "Sandbox Constructions = zero construction time" purchase? | Affects how authored assets are placed in the sandbox. | Yes, in sandbox mode only; zero construction time for all placements, matching the mobile sandbox. |
| OQ-STD-22 | Can a **Workshop item be a map** in the PC title at EA, given maps are authored via terraforming + layout rather than pure voxels? | The store bullet lists maps as shareable [S3], but map authoring spans terrain and layout. | Yes — a map item bundles terrain sets + placed assets + layout metadata; voxel terrain sets are the only pure-voxel part. |
| OQ-STD-23 | What is the **maximum number of subscribed Workshop items** the game will load, and the per-city instance ceiling? | The performance ceiling requirement needs a number to test against. | 200 subscribed items; 10 000 authored instances per map; 1 000 per city. |
| OQ-STD-24 | Is there a **Supercitycon-specific moderation/takedown policy** on top of Valve's Workshop rules (e.g. a curated "official" tag, or dev approval for certain categories)? | Affects FR-STD-132 and the publish gate. | Dev-authored acceptable-item rules published on the Workshop "About" page; no pre-approval requirement; Valve's standard takedown applies. |
| OQ-STD-25 | Are the PC title's **growth-bonus point categories and wealth-level semantics identical** to the mobile title's six bonuses and three wealth levels? | FR-STD-076 and FR-STD-077 require the derivation to emit exactly these categories; a PC/mobile divergence would break the contract with `POP`. | Yes — the PC simulation reuses the mobile title's six growth bonuses (culture, entertainment, recreation, …) and three wealth levels, with "no wealth value" (0) for assets that carry none. |
| OQ-STD-26 | What is **SCC Studio's own toolset**, and how does the editor relate to the live city while it is open? The dev's public tutorial shows **Magica Voxel** — a third-party editor he uses to make models — and enumerates *its* operations (attach, erase, paint, select, duplicate), not SCC Studio's. | FR-STD-013, 017…019, 020…023, 028…030, 038…039 and NFR-STD-001 all describe editor behaviour that **no public source states**. Without this, the rebuild's toolset is a guess presented as a spec. | Adopt the demonstrated authoring workflow as the baseline toolset (place/attach, erase, paint, select, duplicate, rotate, scale, undo/redo) plus a fill and a stamp; the editor overlays the live city and commits on confirm. |
| OQ-STD-27 | What are the **copy/paste and clipboard semantics** — within one document, across documents, across assets? | FR-STD-024 asserts a clipboard that no source describes. | Clipboard is in-memory and per-session; paste into the active document only; a pasted region keeps occupancy and material indices. |
| OQ-STD-28 | Is there **symmetry**, on which axes, and does it apply live to subsequent edits? | FR-STD-031/032 assert a feature no source mentions. | X and Y mirror, toggled per axis, applied live to every write operation; mirroring is about the lattice centre. |
| OQ-STD-29 | What is the **palette** — how many entries, which index ranges are reserved, and are there reusable named **material sets**? The only published facts are that the palette is index-addressed and that foliage occupies indices 9–13 (S33). | FR-STD-034/036 and the whole material model depend on it; the derivation reads material classes (OQ-STD-03). | One 64-entry palette with reserved ranges (0 empty, 9–13 foliage, 16+ structural/glass/emissive/signage); named material sets as named index ranges into the same palette. |
| OQ-STD-30 | What are the **pivot / origin convention**, the **parent / derived-copy** relationship for edits, and the **placement anchor** rules? | FR-STD-042, FR-STD-048, FR-STD-050 and §6.1/§6.4 depend on them. | Pivot at the model centre of mass on the ground plane; editing an asset produces a new derived record linked by `parentAssetId`; the base asset is never mutated. |
| OQ-STD-31 | Is a **placed instance** individually re-editable, and can an authored **character** be placed in the city as a citizen-like instance? | FR-STD-052, FR-STD-092 and FR-STD-109 assert instance-level behaviour no source states. | Editing a placed instance edits that instance only and writes a derived record for it; an authored character can be placed as a static citizen instance (no nav role). |
| OQ-STD-32 | What are the derivation's **determinism, monotonicity and rule-set-versioning** invariants? | FR-STD-055, 057…059, 079 and R4/R5 assert them; the developer's Reddit statement establishes only that the derivation is automatic and universal. | `derived = f(assetDefinition, ruleSetVersion)`; cost is monotonic in occupied volume and in material tier; the rule-set version is stored with the record and re-derivation never changes an already-placed asset. |
| OQ-STD-33 | **What are the derivation's input set, its output set, and the formula itself?** The published record names only "construction costs and economic impact". | The single largest unevidenced surface in this document: it drives FR-STD-060…079, §4.3, §6.5 and §6.6, and the contract with `ECO`. | Inputs: the geometric and material measures of §6.6. Outputs: the measures of §6.5. The formula stays in `ECO`; `STD` owns only the *inputs* and the *outputs*. |
| OQ-STD-34 | What is the **Citycon Building's role on the PC title** — is it an editable authored asset, and is it the entry point through which authored assets enter the build flow? | FR-STD-084/085/087 assert this; the naming announcement establishes only that the Citycon Building *is* the construction yard and that its facade lettering was voxel-authored. | The Citycon Building is the construction yard and is an ordinary editable authored asset; authored assets enter the build flow through it; it is a named landmark. |
| OQ-STD-35 | Where does **character creation** live (entry point, preview/framing view), and how is an authored character **placed and navigated** in the world? | FR-STD-093/095/097 assert these; the store copy establishes first-/third-person modes and sidewalk-following pedestrians, not the authoring entry point. | Character creation is a dedicated entry point with an orbit-and-frame preview; the character is placeable as a citizen instance and navigates on the world's pedestrian rules. |
| OQ-STD-36 | Can a **subscribed Workshop item** be imported into the library as an editable asset, **placed** in the city, and re-validated on load with the same integrity rules as local content? | FR-STD-110, FR-STD-124, FR-STD-129 and FR-STD-111 assume a specific answer. | A subscribed item is placeable and validated identically, but is **not** editable in place; editing it creates a local derived copy. |
| OQ-STD-37 | Is there an **in-game Workshop browser**, and how is the **publish flow** reached — in-game dialog or the Steam client? The store copy says only that creations are shared *through the Steam Workshop*, and the app's Workshop hub is not yet publicly reachable (S27). | FR-STD-112, FR-STD-119, FR-STD-120 and NFR-STD-010 assume an in-game browser that no source describes. | Publishing opens the Steam client overlay; the in-game browser is a read-only list of subscribed items with kind and tag filters. |
| OQ-STD-38 | Are there **SuperCitycon-specific visibility states** beyond the platform's public / unlisted / friends-only? | FR-STD-115 asserts the platform's states as the game's own. | None — the game exposes exactly the platform's three states. |
| OQ-STD-39 | What are the **asset-file robustness** rules (corrupt, truncated, tampered) and the **save-load re-validation** rules? | FR-STD-134/135 and NFR-STD-006 assert behaviour no source states. | A file that fails its checksum or structural validation is refused with a reason and the rest of the library stays playable; every asset is re-validated on save load and a failure quarantines that instance only. |
| OQ-STD-40 | Which **browser-based 3D stack** is the rebuild target for this subsystem? | NFR-STD-011 states a constraint rather than a target; the original's stack is not published. | Three.js-class WebGL2 stack with a WebGPU path behind a renderer interface; the Workshop integration behind one service boundary. |
| OQ-STD-41 | What **accessibility floor** does the editor need — keyboard reachability, no mouse-precision dependency, remappable actions? | NFR-STD-012 asserts an accessibility contract no source states. | Every tool is selectable and operable by keyboard; undo/redo and tool selection have shortcuts; no action requires sub-cell pointer precision. |

---

## 12. Source list

| # | URL | What it gave us | Retrieved |
|---|---|---|---|
| SRC-01 | https://store.steampowered.com/api/appdetails?appids=3474890 | Full store copy: SCC Studio as built-in voxel editor; asset kinds; empty-grid mode; "any scale"; character design; place + share; "SCC Studio & Steam Workshop: Create, customize and share maps, models and characters"; terrain sets of your own; EA = construction sandbox incl. creating assets; category id 17 "Includes level editor"; tags; demo appid 5295650 | 2026-10-23 |
| SRC-02 | https://store.steampowered.com/app/3474890/SuperCitycon/ | Store page corroborating S1 | 2026-10-23 |
| SRC-03 | https://steamcommunity.com/games/3474890/announcements/detail/1842846814455135 | **"Why Is It Called SuperCitycon?"** — full verbatim: project "City" from 2017 (2½ years, folder still `City`); Citycon Building = the city's construction yard; "City Constructions Inc." written on the facade in voxel lettering; the lower voxel resolution forced the shortening to "Citycon"; "Super" from the 16-bit / Super Nintendo era and SimCity on SNES; "Super City Constructions"; "the game named itself" | 2026-10-23 |
| SRC-04 | https://steamcommunity.com/games/3474890/announcements/detail/1846651706675798 | **"The demo is out. Please ask me things."** — SCC Studio is the core 3D voxel editor, "pretty much everything in the game can be made with it"; built for scale/performance; no economy yet; UI being rebuilt from scratch, demo not final; cannot walk on foot in the demo; fires, tornadoes, day/night, trains, helicopters, ships | 2026-10-23 |
| SRC-05 | https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=3474890&count=50&maxlength=0&format=json | Both announcements' full text (S3, S4) and proof that only two Community Announcements exist for this app | 2026-10-23 |
| SRC-06 | https://supercitycon.net/ | Official site: "Small beginnings. Super cities."; Early Access Q4 2026 Windows & macOS; the mobile title is "a separate game from SuperCitycon on Steam"; Discord + r/supercitycon communities; © 2026 Sunapie Games LLC | 2026-10-23 |
| SRC-07 | https://steamcommunity.com/app/3474890/ | Steam Community app hub — **negative observation:** no "Workshop" tab in the section list (All / Discussions / Screenshots / Artwork / Broadcasts / Videos / News / Guides / Reviews) | 2026-10-23 |
| SRC-08 | https://steamcommunity.com/app/3474890/discussions/ | General Discussions index — only 7 topics (iOS-port question, People Simulation, CJK localisation bug, SC3000/SC4 nostalgia, demo launch, updates, release date); **no SCC Studio thread** | 2026-10-23 |
| SRC-09 | https://steamcommunity.com/app/3474890/guides/ | Steam Guides index — **zero guides**; Steam's standard guide tag list for the app includes "Modding or Configuration", "Workshop", "Characters" | 2026-10-23 |
| SRC-10 | https://steamcommunity.com/app/3474890/workshop/ | **Negative observation:** the app-specific Workshop URL redirects to the generic Workshop home → SuperCitycon's Workshop is announced but not publicly reachable | 2026-10-23 |
| SRC-11 | https://steamcommunity.com/workshop/ | Workshop home; "Used by over 3,000 games"; browse sort options; the platform's own announcement feed | 2026-10-23 |
| SRC-12 | https://steamcommunity.com/workshop/workshopsubmitinfo/ | "Different games will utilize the Workshop in different ways"; "**The acceptable items, entry rules, and rewards may be different for each product**"; Workshop Legal Agreement | 2026-10-23 |
| SRC-13 | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/521953615223457012 | **Valve platform:** supported game versions; "Game Branch Versions"; multiple simultaneous item versions; default = works with any build; latest compatible version is downloaded; settings under the item's Change Notes tab | 2026-10-23 |
| SRC-14 | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3889485345756435017 | **Valve platform:** Workshop Collections — save/load subscription lists, load order = subscription order, shareable by link, subscribe-to-all add/overwrite | 2026-10-23 |
| SRC-15 | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/3888358641555807825 | **Valve platform:** item dependencies, auto load order from dependencies, missing-dependency display, disabling items, local load order, subscription metadata, filter by name/tag, unlisted & friends-only visibility, subscribe-to-item-and-dependencies | 2026-10-23 |
| SRC-16 | https://steamcommunity.com/games/SteamWorkshop/announcements/detail/518616498862818032 | **Valve platform:** developer-configurable filters per item type; "For Workshops that contain both Maps and Items, developers can define which types each filter should apply to" | 2026-10-23 |
| SRC-17 | https://www.youtube.com/watch?v=FEELWEOJs2M | Third-party video (Wishlist Radar, 22 Oct 2026): "SCC Studio, a voxel editor built in, so you can reshape a building or start one from an empty grid and share it on the Workshop" — independent corroboration of both editor modes and Workshop sharing | 2026-10-23 |
| SRC-18 | Dev's Reddit post — https://www.reddit.com/r/supercitycon/ (**exact permalink TBD → OQ-STD-01**); the shared brief's copy of the quote is at `docs/00-research-brief.md` §2 | Dev's Reddit post: everything is voxels; the per-model editor is integrated into gameplay; "a **unique format** allows altering appearance, dimensions, or creating entirely new structures on the fly"; the game **automatically calculates construction costs and economic impact** of any building transitioning from the editor into the gameplay environment, "needed to function universally while still making logical sense". **This is a Reddit statement by the developer — the Steam store page carries no cost-derivation claim — and the formula is not published anywhere (OQ-STD-33).** The permalink remains unrecovered: Reddit's `.json` API and `old.reddit.com` returned HTTP 403 during this audit; post bodies were readable through Reddit's own embed endpoint. | 2026-10-23 |
| SRC-19 | https://www.reddit.com/r/MagicaVoxel/comments/14fxfk6/our_voxelgame_super_citycon_monorail_its_not_only/ | Dev's own Reddit post on the game's voxel monorail — **post body re-read this session**: "Our Voxelgame Super Citycon : Monorail - it's not only for decoration! Building your Monorail allows you to build your city even more unique and gives street connection to your surrounding buildings" | 2026-10-23 |
| SRC-20 | https://steamdb.info/app/3474890/ | Third-party mirror of the store copy; app identity and Early Access timing | 2026-10-23 |
| SRC-21 | https://www.youtube.com/watch?v=NJfQ_5-wlWo | Dev's **MagicaVoxel authoring tutorial** on the official channel (S33, S34) — transcript retrieved this session: the map cell is **32 voxels**; the palette is **indexed** with the in-game range "9 till 13"; the operations **attach / erase / paint / select / duplicate**; a **model browser** listing the player's models; footprints at multiples of the 32-cell; and the dev's own "some kind of **quality level**" concern about user-made models. **It shows Magica Voxel — a third-party editor — not SCC Studio, so it does not enumerate SCC Studio's toolset.** | 2026-10-23 |
| SRC-22 | https://www.reddit.com/r/supercitycon/comments/1ii2w9y/super_citycon_is_coming_to_steam/ | Dev's Reddit post announcing the Steam version — **post body re-read this session**: "Super Citycon is coming to Steam!" | 2026-10-23 |
| SRC-23 | https://www.reddit.com/r/VoxelGameDev/comments/1g2pbyq/ | Dev's announcement post (cross-posted to r/CityBuilders `/1g2p8jj/` and r/AndroidGaming `/1g2pap5/`) — **post body re-read this session**: "We've just made Super Citycon, our new mobile city-building game, available for open testing on Android!" | 2026-10-23 |

**Retrieval notes / limitations**
- The dev's MagicaVoxel tutorial transcript was retrieved programmatically during this audit. Its captions are
  **auto-generated**, so quotations from it are the transcript's wording, not a scripted script; the numeric
  claims it supports (32-voxel cell, palette indices 9–13) were read back from the transcript directly.
- Reddit's `.json` API and `old.reddit.com` return HTTP 403 to automated retrieval. Post bodies were read
  through Reddit's **embed** endpoint (`embed.reddit.com`), which serves the rendered post text — sources 19,
  22 and 23 are quoted verbatim above. The **post carrying the developer's automatic-construction-cost
  statement was not recovered**; OQ-STD-01 keeps that permalink open rather than guessing one.
- The **third-party** Wishlist Radar video (source 17) has **no captions** and is used only as corroboration
  of claims the store page already makes.
- The four **Steam Workshop platform announcements** (sources 13–16) are **platform behaviour**, citable as
  such and never as SuperCitycon specifics (see the specificity line in §0 and R11).
