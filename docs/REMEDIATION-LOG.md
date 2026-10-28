# Remediation Log — SuperCitycon Requirements Dossier

A running record of what was found wrong, what was changed, and what was verified. Written so that
any claim in the dossier can be traced to a source that was independently checked.

---

## Round 1 — Research and assembly

| # | Event | Detail |
|---|---|---|
| 1 | Primary-source sweep | Official site, Steam app 3474890 (store, API, community, announcements, workshop), Steam app 5295650 (SuperCitycon Demo), the official YouTube channel "Super Citycon - City Building Game" (22 how-to videos), supercitycon.net, App Store 1607860732, Google Play `com.benwilles.citybuilder`, Reddit (r/supercitycon, r/MagicaVoxel, r/VoxelGameDev, r/CityBuilders, r/AndroidGaming, r/IndieGaming, r/CozyGamers), third-party guides. |
| 2 | Shared fact base frozen | `docs/00-research-brief.md` — game identity, the two-product split, confirmed mechanics, method rules, the 12-section output contract, cross-domain ownership map. |
| 3 | Ten requirement bots | One per domain: CORE, WLD, MOB, ECO, POP, SRV, BLD, STD, UX, TEC. Each wrote one 500–720-line specification. |
| 4 | Tooling written | `tools/validate_requirements.py` (contract checks), `tools/merge_requirements.py` (mega document), `tools/repair_requirements.py` (ID integrity). |

## Round 2 — First defects found by the validator

| Defect | Where | Fix |
|---|---|---|
| 7 requirement IDs defined twice | `03-mobility-traffic-logistics.md` | Renumbered the later definitions to QA-MOB-084…090; canonical (first) definitions kept. |
| 5 dangling FR references | same file | Re-pointed to the defined FR that covers the same behaviour (`FR-MOB-117→045`, `126→102`, `131→101`, `133→026`, `135→056`). |
| A lost requirement (the Harbor catalogue row) | same file | Restored as `FR-MOB-111`, sourced to the Connected Economies tutorial. |
| A duplicated sentence inside one requirement cell | `FR-MOB-082` | Collapsed to one sentence. |
| Validator false positives | validator | Row regex was skipping rows whose last cell carried a second URL after `<br>` — relaxed. Cross-references were being counted as duplicate definitions — definitions are now detected by first-cell position only. |

## Round 3 — Cursor senior review (pass 1)

`cursor agent --print --trust --model grok-4.7-high-fast --mode ask` with `CURSOR-REVIEW-BRIEF.md`.
(Opus, GPT-5.6-sol and Gemini were all at their monthly usage cap; Grok had headroom.)

**Verdict returned: not safe to build from.** Two of the six reviewed domains specified *other games*.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **BLOCKER** | **CORE specified Playkot's "SuperCity"** — 35 rows citing `playkot.helpshift.com/hc/en/4-supercity/…` and `supercitygametips.com`. Proof: those posts carry "SuperCity Turns 15!" (July 2026) — a 2011 title; Super Citycon shipped May 2022. Produced Story Expeditions, Superzilla, Fruit Salads, Club Boom, energy/crystal currency, Prosperity Point, Special Factories, "Department of Architecture". | Whole domain re-grounded on verified SuperCitycon sources. |
| 2 | **BLOCKER** | **MOB specified Cities: Skylines** — 77 rows citing `youtube.com/watch?v=ZVslYTb-a2M` (*Biffa Plays Indie Games* — description: *"a viewer sent me their Cities: Skylines 2 city"*) and `0SzCY7BFC8A` (*UrbanLoon*). Produced an "Anarchy" toggle, ~40 m bridge decks, purchasable map tiles, 10/50-vehicle bus depots, tram capacity 380, ticket prices, a 1–7 lane road catalogue, a traffic-routes overlay. | Whole domain re-grounded on the Basics / Monorails / Connected Economies / Switching Maps tutorials and the Steam page. |
| 3 | **BLOCKER** | The six-rung stage ladder (farm → village → small town → town → city → metropolis) was written as **Must** and used to gate content, but came from store-listing marketing copy about *map scale*; `town`/`city` never appear in the game's own text and no thresholds were published. | Demoted to an explicit design decision; resident-count → level kept as the only evidenced gate. |
| 4 | MAJOR | Quotations did not match the brief (Early Access sentence; loyalty-point rule; the Tycoon mode's source). | Each claim re-pointed at the source that actually carries it; contested items marked TBD. |
| 5 | MAJOR | Wallet scope asserted twice (region-wide vs profile-wide) for one quote that says only "shared across all maps". | Restated as the quote supports; scope marked TBD. |
| 6 | MAJOR | "One Harbor pools every map" vs "the map that has the Harbor" — not both implementable. | Resolved against the Connected Economies transcript; ECO owns the pool rule, MOB owns the building. |
| 7 | MAJOR | The 90 % growth rule contradicted itself across `FR-ECO-065` / `FR-ECO-067` / `QA-ECO-031` / `OQ-ECO-10`; POP also applied it to the demand bars. | One consistent statement; demand bars kept separate from usage bars. |
| 8 | MAJOR | Happiness forced onto a 0–100 scale; emigration, households and a daily citizen routine asserted without evidence. | All converted to TBD / design decisions with the source limitation stated. |
| 9 | MAJOR | The wealth average was defined twice (exclude unmarked buildings vs let them dilute). | One definition kept; the other cross-references it. |
| 10 | MAJOR | Bonus combination was Must *and* TBD in one row; six caps of 250 % give ×16 while the official blog says ×15. | Made a single consistent TBD design decision with both figures shown. |
| 11 | MAJOR | Marker abuse: inferences marked CONFIRMED; a source cited that does not carry the claim; guessed numbers kept. | Corrected; unsupported values demoted to TBD with open questions. |
| 12 | MAJOR | 89 MOB QA rows had no outcome — the "Then" column repeated requirement IDs. | Rewritten so every Then states an observable outcome. |
| 13 | MINOR | Harbor / C-Wire / water pipeline specified in three domains. | Ownership split: ECO = pool rules, MOB = buildings and transport, SRV = reference only. |
| 14 | MINOR | `FR-POP-065` was two behaviours. | Split into two rows with distinct outcomes. |
| 15 | MINOR | Stage vocabularies differed per domain (`EA-SBX`, `MOB-LIVE`, `Mobile S2`, `EA-Sandbox`, …). | House vocabulary fixed: `Mobile` · `PC-EA` · `Both` · `Design`. |
| 16 | NIT | Stage vocabulary mismatch broke index filtering. | Fixed in the merger. |
| 17 | TOOLING | Merger printed "Documents merged \| 10" regardless of reality; master "Stage" column was the rebuildable column; `repair_requirements.py` computed dangling-ID fixes then discarded them; validator skipped QA rows, counted every ID mention as a definition, truncated its failure list. | All four fixed and re-tested. |

### The review's own verdict on what was strong
SRV (police as decoration-plus-bonus with no crime; fire/health/education as separate coverage vs
capacity; bus stations that grant school connection; one-tile influence rule; waste chain; Harbor vs
C-Wire vs water pipeline), ECO's demand/usage bar split, POP's six-bonus catalogue, WLD's voxel lattice,
and the brief's product split were called out as genuinely good and were deliberately preserved.

## Round 4 — Independent source verification

Every URL and every video id in the dossier was re-fetched and judged by the page's own identity.

```bash
curl -sL -A "<browser UA>" "https://www.youtube.com/watch?v=<ID>" \
  | grep -o '<meta property="og:title" content="[^"]*"'
```

| Verdict | Count | Examples |
|---|---|---|
| OFFICIAL (the game's own channel) | 22 | The Basics, Economy Overview, Connected Economies, Resident Bonuses, Monorails, Switching Maps, Storage Feature, Camera Modes, Science View, Education/Healthcare/Police/Fire/Waste/Food/Water/Energy, Income Bonuses, Happiness & Mayor Score |
| THIRD_PARTY (genuinely about the game) | 4 | TA Plays Games walkthrough, Wishlist Radar, Mobile Gaming Hub, the app catalogue sites |
| LEGIT (non-video primary) | ~40 | Steam app 3474890 + Demo 5295650, Steam community, SteamDB, App Store, Google Play, supercitycon.net, the dev's Reddit posts |
| **FOREIGN (a different game)** | **4 sources** | 2 Cities: Skylines videos, Playkot's help centre, Playkot's tips site |
| JUNK | 2 | a DuckDuckGo lite query URL, a bare `github.com/` |

Written up as `docs/SOURCE-VERIFICATION.md` and `tools/source_ledger.json`. The validator now
**hard-fails** any requirement row citing a FOREIGN or JUNK source, so the contamination cannot recur.

Two more sources were also confirmed good after suspicion: Steam app id **5295650** is *SuperCitycon
Demo* by Sunapie Games (legitimate, a separate demo app), and the `Super_Citycon` store slug resolves
via redirect (the canonical slug `SuperCitycon` is now preferred).

## Round 5 — Remediation wave

Four bots ran in parallel against the verified ledger:

| Bot | Files | Work |
|---|---|---|
| MOB | `03-mobility-traffic-logistics.md` | Full re-grounding: 77 foreign rows removed, 89 QA rows given real outcomes, the Cities: Skylines artefacts deleted, Harbor/C-Wire ownership reassigned to MOB, voxel-layer terrain interaction instead of metres. A provenance note at the top of the file records exactly what was rejected and why. |
| CORE | `01-core-loop-modes-progression.md` | 35 Playkot rows removed; the stage ladder demoted to a design decision; the mode picker, Tycoon mode and wallet scope reconciled to what is actually evidenced. |
| BLD | `07-building-catalogue-properties.md` | 72 Playkot rows removed (Megabuildings, Department of Architecture, blueprint marathons, archive cards, composition views, Highland/Valley quests); the 8 unsourced rows resolved; the catalogue re-grounded on the App Store/Play feature lists and the tutorial set. |
| CROSS | `02`, `04`, `05`, `06`, `09`, `10` | WLD's 5 Playkot rows purged; ECO's 17 unsourced rows sourced and the 90 % rule made consistent; POP's overclaims converted to TBD and the wealth/bonus/loyalty/diversity rules made single-valued; SRV's unsourced row and its "DESIGN EXTENSION but Must" rows fixed; UX's 12 Playkot rows and 19 unsourced rows resolved and the FR-UX-073 numbering gap closed; TEC's 4 unsourced rows sourced; stage vocabulary normalised everywhere. |

## Round 6 — Second Cursor review

`CURSOR-REVIEW-BRIEF-2.md` asks the reviewer to verify each round-3 finding, re-check the
contradictions across files, spot-check ten more claims against live URLs, look for holes the purge
opened, and re-audit the tooling (including whether the ledger check catches a foreign source inside a
*mixed* row).

### Round 6 — the ledger was open, and that mattered

While the dossier was being closed out, a **fifth foreign source** was found and proved foreign:
`supercity-friends.fandom.com/wiki/Daily_Player_Bonus`. The page title is *"Daily Player Bonus |
Supercity Friends Wiki | Fandom"* and the wiki's own metadata declares the category **"SuperCity Wiki"** —
it is the community wiki for **Playkot's SuperCity**, not Super Citycon. Its body pays "**7 SuperBucks
or a Casino Chip**"; SuperBucks and Casino are not Super Citycon currencies (it uses Super Cash and Coins).

It had survived pass 1 because **the host was not in the ledger**. An unlisted host scored `UNKNOWN`,
which is neither `FOREIGN` nor `JUNK`, so the validator waved it through. That is a design flaw in the
check, not a data-entry mistake.

**Fix, in two parts.**

1. The source was purged from UX — 14 requirement rows, 9 Section 1.1 findings rows, the HUD diagram, the
   options matrix, the stage matrix, the rules section, the QA suites and 7 rows of the source list.
   Eight rows had no legitimate equivalent and were converted to `[TBD — design decision]` with new
   Section 11 open questions; fourteen were re-grounded on the App Store listing or a tutorial transcript,
   keeping only the clause the source actually supports.
2. The check was closed: an unlisted host now returns `UNVERIFIED_HOST` and **hard-fails** the row. This
   immediately surfaced 6 more unchecked hosts (`www.youtube.com`, `index.commoncrawl.org`), both of which
   were then verified and added — the YouTube host by its channel RSS feed and `@supercitycon/videos`
   page title, Common Crawl by its index API returning the archived blog capture. The ledger now carries
   **26 host verdicts**, and every URL cited anywhere in the dossier resolves to one.

### Round 6 — the loyalty scope was wrong

A dedicated fact-check against primary sources recovered the dev blog article *"New Bonuses for Residence
Growth"*. The live URL `https://supercitycon.net/new-bonuses-for-residence-growth/` now returns **404**
(the site is mid-rebuild), so the text was pulled from a **Common Crawl** capture
(`CC-MAIN-2024-51`, capture timestamp 2024-12-13, HTTP 200, WARC byte-range 494166670+39681) and read
verbatim. It states:

> "all these bonuses are calculated independently for each map. Your progress and bonus levels are
> specific to each map and won't impact other maps."

`FR-POP-075` had asserted that the loyalty bonus is **account-level**. That is wrong: the blog's
"Important Note: Per Map Calculation" clause covers all six bonuses. The row now asserts **per map**,
`FR-POP-081` was widened from "the five map-derived bonuses" to **all six**, and `OQ-POP-08` is marked
**RESOLVED**. The tutorial's own wording ("if you stay away from **your city**") agrees.

The **×15** combined ceiling stays `[TBD]`. The blog publishes "together can scale up to **x15**" but
publishes **no** combination formula, and the tutorial says "no one knows what the actual maximum of a
map". Six independent 250 % caps total 1500 %, which under an additive reading would be ×16 and so
contradict the blog's own headline figure. Neither ×15 nor ×16 is hard-coded anywhere.

### Round 6 — house vocabulary is now machine-enforced

The `Rebuildable?` column had drifted: **251 rows** across ECO, POP, SRV and BLD used `n/a` or annotated
variants (`yes (model)`, `yes (vehicle models)`, `yes (property authoring)`), and the `Stage` column still
carried legacy tokens (`MOB-LIVE`, `ALL`, `MOB-PAR`, `POST-EA`, `PC-PLAN`). The brief allows exactly
`yes` / `no` / `partial` and `Mobile` / `PC-EA` / `Both` / `Design`.

`MOB`'s definition is the authority and was applied: `no` = a system rule or content definition the player
does not rebuild; `yes` = the player can demolish and re-place or re-author it; `partial` = the player can
change some of it. Every `n/a` and every annotated variant was normalised on that basis. Four NFR tables
(WLD, ECO, POP, SRV) still used the old 5-column layout and were upgraded to the 7-column FR-family
layout with `Stage` and `Rebuildable?` filled in.

The validator now **hard-fails** on any FR/NFR row that is not exactly 7 columns, or whose Priority /
Stage / Rebuildable value is outside the house vocabulary. The check is permanent, so the drift cannot
return.

### Round 6 — tooling defects fixed

- `tools/audit_numbers.py` iterated the file **character by character** (`for line in
  f.read_text(..., errors="splitlines")` — `splitlines` was passed as the *errors* argument, not called),
  so it reported **0 rows** and looked like it had found nothing. It now checks **654** video-backed
  requirement rows and flags 5 for review.
- `tools/source_ledger.json` gained `supercity-friends.fandom.com` (FOREIGN), `thegameextras.com`
  (THIRD_PARTY) and `www.facebook.com` (OFFICIAL), then `www.youtube.com` and `index.commoncrawl.org`.
- `tools/validate_requirements.py` gained the shape/vocabulary check and the `UNVERIFIED_HOST` hard-fail.

### Round 6 — state at handoff

`python3 tools/validate_requirements.py --partial` → **PASS, 0 hard failures**.
1,168 FR · 126 NFR · 573 QA · 86 distinct source URLs · 1,867 unique requirement IDs, 0 duplicates.
Every FR and NFR row is sourced or explicitly marked TBD; every FR/NFR row is in the 7-column layout with
in-vocabulary values. `docs/SUPER-CITYCON-MASTER-REQUIREMENTS.md` rebuilt from the ten parts
(1,588,996 bytes, 2,248 lines) with the master index, all ten domain parts and Appendices A–D.

**Negative test performed.** A foreign URL was injected into `FR-CORE-001`; the validator failed with
`1 row(s) cite a FOREIGN/JUNK source`, and the file was restored to a PASS. The ledger check catches a
foreign source inside a mixed row, because it scans every URL in the row, not just the first.

---

## Round 7 — Cursor senior review, pass 2 (grok-4.7-high-fast)

The dossier was clean by every machine check, so pass 2 asked a harder question: **is it clean in the
normative sections an implementer actually codes from?** The validator had been checking the requirement
*tables*; a builder also reads §4 options matrices, §5 stage ladders, §6 data models, §7 rules and
formulas, §8 edge cases and §10 test suites.

**Verdict returned: not safe to build from.** The foreign purge held, but two BLOCKERs and nine MAJORs
were found — all in the sections the validator was not reading. The full review is kept verbatim at
`docs/CURSOR-REVIEW-PASS-2.md`.

### BLOCKER 7.1 — the ×15/×16 rule was hard-coded in the sections that matter

`POP`'s `FR-POP-078` and `FR-POP-079` forbade hard-coding the residence multiplier, and they were right
to. But §7.1 still set `M = 1 + residenceBonusPct / 100` with the comment `≤ 16 ⇒ M ≤ 16 (dev states
≤ 15)`; the data model still gave `totalBonusPct` the range `0..1500`; and the diagram still printed
the equation. **A requirement row that says "do not hard-code this" while the formula section hands the
programmer the number is a contradiction a reviewer will always find.**

### BLOCKER 7.2 — MOB specified a traffic simulator the sources do not describe

After the Cities: Skylines videos were purged, ten Must/Both rows still specified lanes, speeds, per-lane
capacity, junction node graphs, dead-end U-turns and pathfinding — all cited to the Steam page's
"watch traffic move through your streets" marketing line. The dev's own comment, recorded as finding S32,
is that the traffic model is **"still pretty open"**. The evidenced behaviour is the street tool, the
muddy-road connection rule, monorail-to-residential connection and the school-capacity bus station; the
lane/junction/pathfinding layer was a different design wearing a Steam URL.

### The nine MAJORs

`POP` — happiness still a 0–100 scale in the schema, the test and the formulas although `FR-POP-085`
forbids it · the 90 % boundary contradicted inside POP's own test and formula (ECO is authoritative) ·
loyalty per-map in the requirement but shared in the §5 progression table · households, emigration and a
citizen day-cycle unevidenced in the FR rows but required in the schema · POP §5 still carried the
marketing Village/Town/City/Metropolis ladder that the brief says is store copy.

`CORE`/`ECO`/`SRV` — Harbor membership per-map in ECO but region-wide in the brief and in SRV's tests ·
the wallet region-scoped in ECO's and CORE's Must rows but profile-scoped in their own open questions ·
a mode picker denied in `FR-CORE-028` but acceptance-tested in `QA-CORE-011`.

`UX` — the purged daily-bonus ladder still a Must while `OQ-UX-30` says to ship none.

### Tooling gaps found by the same review, and closed

- **The validator did not read the source list or the findings tables.** A `lite.duckduckgo.com` search
  URL sat in `SRV`'s §12 and was never checked, because the row scan only inspects requirement tables.
  The validator now sweeps **every URL in the document**, not just requirement rows — and it immediately
  caught that same SRV row.
- **An unlisted host still passed.** The `UNKNOWN` verdict meant an unlisted host was invisible. It now
  returns `UNVERIFIED_HOST` and hard-fails, which surfaced two more hosts (`www.youtube.com`,
  `index.commoncrawl.org`), both then verified and added.
- **The QA-outcome check had a false negative.** A `Then` cell reading *"The requirement holds."*
  passed. Vacuous restatements are now rejected.
- **The merger mis-reported its own line count** (`len(L)` counted list entries, not lines).

### Round 7 status

Remediation dispatched in three disjoint workstreams so the agents could not collide:
POP (BLOCKER 7.1 + the five POP MAJORs) · MOB (BLOCKER 7.2) · CORE+ECO+SRV+UX (the cross-domain
MAJORs and the three MINORs).

### Round 7 outcome — every finding closed

| # | Finding | Status |
|---|---|---|
| B1 | POP §7.1 / data model / diagram hard-coded the ×15–×16 multiplier | **Fixed** — the combination is now an explicit `[TBD — design decision]` parameter; `0..1500` and `≤ 16` are gone; the diagram prints `M = f(Σ bonus%) [TBD]`; a new paragraph records the ×15-headline vs 1500 %-sum tension and why the six maxima are not simultaneously reachable |
| B2 | MOB Must-rows specified a traffic simulator the sources do not describe | **Fixed** — `FR-MOB-018/021/027/028/029/030/035/039/040` are now `Could`/`Design`, each pointing at a Section 11 open question; E6/E7, `laneIndex`, `demandByHour` and the `REROUTE/HOLD/DESPAWN` policy are marked not-implemented; a header notice and a §12 note state exactly what the Steam blurb may and may not be cited for. MOB is now 40 `Must`/`Both` (evidenced) and 36 `Could`/`Design` (design decisions) |
| M3 | Happiness still a 0–100 scale in schema/tests/formulas | **Fixed** — the scale symbol `S` replaces 100 throughout: `HappinessState.value` is `0..S`, `QA-POP-021` uses `H = S/2` and `H = S`, `OQ-POP-11` uses `0.4·S`/`0.6·S`, `OQ-POP-12` uses `round(residents × (H / S))` |
| M4 | 90 % boundary contradicted inside POP | **Fixed** — POP now uses ECO's `< 90` / `≥ 90` / `= 100` split; the invented "reduced by 50 %" expectation is gone; `supplyAdequacy` starts falling **at** 90 %; new `OQ-POP-14` records the water tutorial's "over 90 %" wording as a separate open question |
| M5 | Harbor per-map in ECO, region-wide in the brief and SRV | **Fixed** — ECO `FR-ECO-102` owns the rule in one place: *the Harbor is a per-map membership token; the pool it joins is region-wide; a map without a Harbor is not a member and keeps local figures*. SRV `QA-SRV-075` now requires **both** maps to own a Harbor, a new `QA-SRV-093` tests the negative case, and `E13` establishes both memberships |
| M6 | Wallet region-scoped in Must rows, profile-scoped in the open questions | **Fixed** — the scope stays **[TBD]**, owned by ECO. `FR-ECO-038/046/110` say "the shared wallet"; `RegionWallet` → `SharedWallet` with an explicit `[TBD]` scope; `OQ-ECO-16` owns it; CORE's `FR-CORE-007`, `FR-CORE-067` and `OQ-CORE-05` defer to it instead of asserting a scope |
| M7 | Loyalty per-map in the requirement, shared in the progression table | **Fixed** — §5's region row now says all six are per map, the Day-Zero carry-over allowance is removed, and `LoyaltyState` gained a `mapId` field ("one record per map") |
| M8 | Households, emigration and a citizen day-cycle unevidenced but required | **Fixed** — §4 keeps only Resident/Employed/Unemployed/Unhoused; a new §4.5 and §6.1 hold the removed entities as *reserved — not implemented*; `Household`/`householdId` are gone from §6 |
| M9 | POP §5 carried the marketing stage ladder | **Fixed** — §5 is now the **level-from-resident-count** axis with no invented population thresholds, and states explicitly that Village/Town/City/Metropolis are store copy about map scale |
| M10 | Mode list denied in a requirement, acceptance-tested in a suite | **Fixed** — `FR-CORE-028` narrows to *no persistent mode picker* (a one-off surface is allowed); `QA-CORE-011` now inspects the mode **registry** as a data view; `QA-CORE-018` tests the one-off surface |
| M11 | Purged daily-bonus ladder still a Must | **Fixed** — `FR-UX-112` is now `[TBD — design decision]`: the ladder is not published for this title and shall not ship until decided; `QA-UX-034` asserts no ladder is offered |
| m12 | `FR-UX-085` assigned a mobile 2.0 feature to the PC title | **Fixed** — Stage `PC-EA` → `Mobile`; PC parity moved to a new `OQ-UX-33` |
| m13 | `FR-ECO-082` carried a truncated caption fragment | **Fixed** — rewritten as a complete requirement listing the six power types |
| m14 | A DuckDuckGo search URL in SRV's source list | **Fixed** — row deleted, list renumbered 1–15 contiguously, SRV keeps 15 legitimate URLs |
| N16 | The merger mis-reported its line count | **Fixed** — it counted list entries, not lines |
| N17 | `audit_numbers.py` had an unused variable and a broken `--domain` filter | **Fixed** — both corrected; the tool now checks 677 rows |

### Round 7 — two more citation defects the numeric audit caught

The repaired `audit_numbers.py` was run over the finished dossier and flagged six rows whose stated
numbers are absent from the transcript cited. Three were genuine **misattributions**:

- `FR-ECO-074`, `FR-UX-024` and `FR-UX-119` cited *The Basics* (`jYAD0SkDmY0`) for the **90 % / 100 %**
  thresholds. That threshold is in the *Economy Overview* video (`LmY_TpU1B5Y`: *"below 90% you are fine,
  starting from 90% … it will reduce the growth of your city … once something is 100% usage your city will
  not grow anymore"*). *The Basics* contains no "90" at all. All three now cite the correct video.
- `FR-STD-043` and `STD`'s S33 finding claimed the tutorial cites **46×46 and 96×96 voxel** footprints.
  Those numbers appear in the transcript **only as timestamps**. The claim is withdrawn and replaced with
  what the transcript actually establishes — the 32-voxel cell and the 32×32×32 one-cell model.

Two flags remain and are correct: `FR-STD-015`'s 128/64/32/16 are explicitly labelled *"a proposed
default, not published values"*, and `FR-UX-026`'s 99 % is explicitly an `[TBD — design decision]`.

### Round 7 — final state

`python3 tools/validate_requirements.py --partial` → **PASS, 0 hard failures, 0 warnings**.
1,168 FR · 126 NFR · 575 QA · 86 distinct source URLs · **1,869 unique requirement IDs, 0 duplicates**.
Every FR and NFR row is in the 7-column house layout with in-vocabulary values and a source URL or an
explicit TBD. Every URL cited anywhere in the dossier has a verdict in the ledger (27 hosts, 26 video ids,
**0 unverified**). `docs/SUPER-CITYCON-MASTER-REQUIREMENTS.md` rebuilt from the ten parts
(1,627,570 bytes, 9,670 lines): master index, all ten domain parts, and Appendices A–D.

---

## Verification commands

```bash
cd docs/..                                  # workspace root
python3 tools/validate_requirements.py      # contract + ledger + QA-outcome checks
python3 tools/merge_requirements.py         # rebuild the mega document
python3 tools/repair_requirements.py <file> --dry-run   # ID integrity preview
```
