# Source Verification Ledger — SuperCitycon

Every source cited across the ten requirement documents, independently verified on **2026-10-23** by
fetching the page and reading its own title / channel / identity. This file is the authority for
"is this source actually about SuperCitycon?".

**Two of the original evidence bases were for different games.** A senior review pass caught it; the
verification below proves it and defines the remediation. Any requirement row whose *only* support is
a `FOREIGN` source is invalid and must be deleted or re-grounded.

---

## How each video source was verified

For every YouTube video id used in the dossier, the watch page was fetched and these fields read
directly out of the returned HTML (`og:title`, `ownerChannelName`) and the video description:

```bash
curl -sL -A "<browser UA>" "https://www.youtube.com/watch?v=<ID>" \
  | grep -o '<meta property="og:title" content="[^"]*"'
```

## VERIFIED OFFICIAL — channel "Super Citycon - City Building Game"

These are the game's own how-to tutorials. They are the authoritative behavioural source.

| Video ID | Title | Use it for |
|---|---|---|
| `jYAD0SkDmY0` | Super Citycon: The Basics – City Building Game How-To Tutorial | Core loop, street building tool, HUD, demand/usage bars, government panel |
| `LmY_TpU1B5Y` | Super Citycon: Economy Overview – City Building Game How-To Tutorial | Demand vs usage bars, the 90 % / 100 % growth rule, costs, income |
| `m5O-A33wQm0` | Super Citycon: Connected Economies – City Building Game How-To Tutorial | Harbor, C-wire, water pipeline, cross-map economy |
| `CIb2IWyNPJw` | Super Citycon: Resident Bonuses – City Building Game How-To Tutorial | The six growth bonuses, diversity penalty, loyalty points |
| `c3L7Qo8fdIM` | Super Citycon: Science View – City Building Game How-To Tutorial | The "Science View" (analysis overlay) |
| `OUYirEhc9c8` | Super Citycon: Income Bonuses – City Building Game How-To Tutorial | Income bonus mechanics |
| `PifQ_7vj7Ao` | Super Citycon: Education System – City Building Game How-To Tutorial | Schools, coverage, capacity, bus-station school connection |
| `_QpxzZFTBtw` | Super Citycon: Happiness & Mayor Score – City Building Game How-To Tutorial | Happiness inputs, City Score, Mayor Score |
| `4SlxOgZ67MU` | Super Citycon: Healthcare System – City Building Game How-To Tutorial | Clinics/hospitals, coverage |
| `HDjaWySDKOM` | Super Citycon: Waste Management – City Building Game How-To Tutorial | Waste chains, landfill/recycling/incinerator |
| `6wWZxnm_YLk` | Super Citycon: Food Supply System – City Building Game How-To Tutorial | Fields, animals, food industry, silo radius bonuses |
| `tFmR_0w1OuQ` | Super Citycon: Police Department – City Building Game How-To Tutorial | Police coverage and the security bonus |
| `yuLUP_ELk4I` | Super Citycon: Water Supply System – City Building Game How-To Tutorial | Water towers, supply chain, coverage |
| `vBJdlAeLn0g` | Super Citycon: Switching Maps – City Building Game How-To Tutorial | Multi-map / region mechanics |
| `0wFTp0aDpQg` | Super Citycon: Fire Department – City Building Game How-To Tutorial | Fire coverage |
| `y5g7xPHzj0A` | Super Citycon: Energy Supply – City Building Game How-To Tutorial | Power plants, energy supply |
| `71H1tU2DGz8` | Super Citycon: Monorails – City Building Game How-To Tutorial | Monorail mechanics and building connection |
| `cSRDwHvowWI` | Super Citycon: Storage Feature – City Building Game How-To Tutorial | Storage / warehouse, redemption |
| `ovWkwWS5FlY` | Super Citycon: Camera Modes – City Building Game How-To Tutorial | Camera modes |
| `bOPESpVGXOU` | Super Citycon is Coming to Steam! 🎮 Wishlist Now for PC & Mac! | Official Steam announcement (PC) |
| `6Jd2kyaEZbM` | Super Citycon in 30 seconds 🔥 | Official short feature summary |
| `NJfQ_5-wlWo` | How to make models for Super Citycon with Magica Voxel | Official MagicaVoxel workflow (editor/format) |

## VERIFIED THIRD-PARTY — genuinely about Super Citycon

| Video ID | Channel | Title | Use it for |
|---|---|---|---|
| `TgxftADwB6E` | TA Plays Games | Super Citycon - Build a City First Gameplay Walkthrough | Independent gameplay of the mobile game (secondary evidence) |
| `FEELWEOJs2M` | Wishlist Radar | SuperCitycon: a retro city builder with its own voxel editor | Press coverage of the PC title |

## FOREIGN — MUST NOT BE CITED

Verified to be **other games**. Every row whose only source is one of these is invalid.

| Source | What it actually is | Proof | Rows affected |
|---|---|---|---|
| `youtube.com/watch?v=0SzCY7BFC8A` | **Cities: Skylines** — channel *UrbanLoon*, "I Tried Building a City With 0 Traffic Jams… It Actually Worked" | Title + channel + description ("Traffic in this city is a complete nightmare…") | MOB: 84 citations |
| `youtube.com/watch?v=ZVslYTb-a2M` | **Cities: Skylines 2** — channel *Biffa Plays Indie Games*, "A Viewer Sent Me Their WORST Traffic… So I Fixed It" | Description: "A viewer sent me their Cities: Skylines 2 city because the traffic had reached total gridlock!" | MOB: 91 citations |
| `playkot.helpshift.com/hc/en/4-supercity/…` | **Playkot's "SuperCity"** — a different mobile game by Playkot | Host path `/hc/en/4-supercity/` is Playkot's help centre | CORE: 36 citations; WLD: 5; UX: 12 |
| `supercitygametips.com/…` | **Playkot's "SuperCity"** tips site | Posts are dated 2025–2026 and describe "SuperCity" version numbers and "SuperCity Turns 15!" — a 2011 title, not Super Citycon (2022) | CORE: 35 citations; UX: 2 |
| `supercity-friends.fandom.com/wiki/Daily_Player_Bonus` | **"Supercity Friends Wiki"** (Fandom) — the community wiki for **Playkot's SuperCity**, not Super Citycon | Page title *"Daily Player Bonus \| Supercity Friends Wiki \| Fandom"*; the wiki's own metadata declares the category **"SuperCity Wiki"**. Body text pays "**7 SuperBucks or a Casino Chip**" with green/red/black/gold Casino Chips — SuperBucks and Casino are not Super Citycon currencies (it uses Super Cash and Coins) | UX: 3 citations |

> The third Playkot source was found in **pass 2** of the ledger audit, after the first two were already
> purged. It was invisible to the validator because the host had no entry in `tools/source_ledger.json` —
> an unknown host scores `UNKNOWN`, not `FOREIGN`. It is now `FOREIGN`, and the ledger's host list covers
> every host cited anywhere in the dossier. The lesson is recorded: **an unlisted host is an unchecked
> host**, so the ledger must be closed (no new hosts without a verdict) rather than open.


> The two Cities: Skylines videos produced plausible-looking but wrong content: an **Anarchy** mode
> toggle, **metre-scale** bridge deck heights (~40 m), **purchasable map tiles**, bus depots of 10/50
> vehicles, tram capacity 380, and 1–7 lane road types. None of these exist in SuperCitycon, and the
> metre-scale figures contradict the voxel-layer model in `FR-WLD-004`.
>
> The Playkot material produced **Story Expeditions**, **Superzilla**, **Nessie**, **Genie**,
> **Fruit Salads**, **Club Boom**, **energy/crystal** currencies, **Prosperity Point** and
> **Special Factories** — all Playkot's game, none of it in Super Citycon.

## VERIFIED LEGITIMATE — non-video

| URL | Identity | Verified how |
|---|---|---|
| `store.steampowered.com/app/3474890/` | SuperCitycon (PC, Sunapie Games) | Steam app id 3474890 |
| `store.steampowered.com/app/3474890/SuperCitycon/` | Canonical store slug | HTTP 200; the `Super_Citycon` underscore slug also 200 (Steam redirects) — **prefer the canonical slug** |
| `store.steampowered.com/api/appdetails?appids=3474890` | Steam app details for SuperCitycon | API response |
| `store.steampowered.com/api/appdetails?appids=5295650` | **SuperCitycon Demo** (Sunapie Games) | API response — LEGIT, a separate demo app |
| `steamcommunity.com/games/3474890/announcements/detail/…` | Official SuperCitycon announcements | Steam community, app id 3474890 |
| `steamcommunity.com/app/3474890/…` | Official SuperCitycon discussions / guides / reviews / workshop | Steam community, app id 3474890 |
| `steamcommunity.com/games/SteamWorkshop/announcements/detail/…` | Generic Steam Workshop platform announcements | Steam platform — describes Workshop *behaviour* (versioning, dependencies, load order), not SuperCitycon specifics. Cite only for platform behaviour |
| `steamcommunity.com/workshop/` · `.../workshop/workshopsubmitinfo/` | Generic Steam Workshop pages | Steam platform. Weak as evidence; prefer the game's own workshop hub |
| `api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=3474890…` | Steam news feed for SuperCitycon | App id 3474890 |
| `steamdb.info/app/3474890/` | SteamDB entry for SuperCitycon | App id |
| `apps.apple.com/us/app/super-citycon-build-a-city/id1607860732` | Super Citycon: Build a City (mobile, Ben Willes Games) | App Store id 1607860732 |
| `itunes.apple.com/lookup?id=1607860732` | Same app, lookup API | App id |
| `play.google.com/store/apps/details?id=com.benwilles.citybuilder` | Super Citycon on Google Play | Package id |
| `supercitycon.net/` (+ `/privacypolicy.html`) | Official site | Verified title |
| `www.reddit.com/r/supercitycon` | The game's subreddit | Path |
| `www.reddit.com/r/MagicaVoxel/comments/14fxfk6/…` | Ben Willes on Magica Voxel models for Super Citycon | Title confirms the game |
| `www.reddit.com/r/VoxelGameDev`, `r/CityBuilders`, `r/AndroidGaming` posts `/1g2pbyq/`, `/1g2p8jj/`, `/1g2pap5/` | "Hey Reddit we've just made Super Citycon" — official announcements | Title confirms the game |
| `mobilegaminghub.com/super-citycon-tips-and-tricks-to-build-a-beautiful-city/` | Third-party Super Citycon guide | Title verified |
| `mwm.ai/apps/super-citycon-tm-build-a-city/1607860732` | App catalogue for the same app | App id |
| `trophieshunter.com/games/super-citycon-build-a-city-ios/achievements/…` | Achievement list for the mobile game | Path + title |
| `gamehypes.com/resources/super-citycon` | Third-party resource page | Path |
| `appshunter.io/ios/app/1607860732` | Third-party app page | App id |
| `theend.wiki/games/super-citycon-city-builder` | Third-party wiki — **page body currently returns a Vercel security checkpoint, so it cannot be quoted as evidence** | Fetched; blocked |
| `discord.gg/btTPqsNYRP` | Official community invite | Steam page link |
| `shared.fastly.steamstatic.com/…/3474890/extras/*.mp4` | Official Steam trailer/clip media for SuperCitycon | Asset path under app 3474890 |
| `shared.fastly.steamstatic.com/store_item_assets/steam/apps/3474890/…jpg` | Official Steam screenshots | Asset path under app 3474890 |

## JUNK — not a source at all

| Source | Problem | Fix |
|---|---|---|
| `lite.duckduckgo.com/lite/?q=…` | A search-engine query URL, not a document | Replace with the underlying real source, or drop the row |
| `github.com/` | Bare domain, no path | Replace with a real URL or drop the row |

## Machine-readable form

`tools/source_ledger.json` carries the same verdicts and is read by
`tools/validate_requirements.py`, which now **hard-fails** any requirement row that cites a
`FOREIGN` or `JUNK` source. That check is what keeps the dossier honest from here on.
