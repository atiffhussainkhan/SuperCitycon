**Verdict:** Not safe to build from. The foreign-game purge holds, and the checked-in validator report is a pass, but the normative sections of population still hard-code the numbers the requirement rows forbid, and mobility still specifies a traffic simulation the SuperCitycon sources do not describe.

Live page fetches and shell execution were blocked in this session. YouTube, Steam, the Common Crawl index, and the live blog URL were not re-fetched. Claims below were checked against the local transcripts (captured 2026-10-23, channel named in each file header) and against the requirement text. The energy-supply transcript file contains only caption timestamps, so the coal/solar/nuclear quotes could not be confirmed from it.

## Findings

### BLOCKER

1. **The ×15 / ×16 rule is still hard-coded in the section an implementer will code.** `docs/requirements/05-population-citizens-happiness.md` §7.1 (lines 415–417) sets `residenceBonusPct` to the sum of the six percentages and `M = 1 + residenceBonusPct / 100`, with the comment `≤ 16 ⇒ M ≤ 16 (dev states ≤ 15)`. The data model (line 382) gives `totalBonusPct` the range `0..1500`, which is that same ×16. The diagram at line 103 prints the same formula. `FR-POP-078` and `FR-POP-079` say the combination is unpublished and that neither ×15 nor ×16 may be hard-coded. The file header (lines 14–16), `FR-POP-080`, and `OQ-POP-09` (line 567) still say the blog URL does not resolve. §1.1 row 25 and §12 note 11 say the opposite: the Common Crawl capture was read and it states “x15” plus per-map calculation, and it publishes no formula. The local Resident Bonuses transcript supports only “no one knows what’s the actual maximum of a map” (`CIb2IWyNPJw`, about 03:05). It does not contain “x15”.
   **Fix:** Delete the formula, the `0..1500` range, and the diagram equation. Make `OQ-POP-09`, `FR-POP-080`, and the header match §12: the ceiling quote is recovered, the combination formula is not, and no multiplier ships until one rule is chosen. Point the citation at the WARC record, not only the index query.

2. **Mobility Must-rows specify a traffic simulator the sources do not describe.** After the Skylines videos were removed, these rows are still `Must` / `Both`, marked `[TBD — design decision]`, and cited to the Steam page’s “watch traffic move” / “flexible roads” lines: `FR-MOB-018` (lanes, max speed, per-lane capacity, zoned frontage), `FR-MOB-021`, `FR-MOB-027` through `FR-MOB-030` (node graph, dead-end U-turn), `FR-MOB-035`, `FR-MOB-039`, `FR-MOB-040` (`docs/requirements/03-mobility-traffic-logistics.md`, lines 207–234). Edge cases E6 and E7 (lines 521–522) require outside connections and dead-end turnarounds. The data model adds `laneIndex`, a 24-hour `demandByHour` curve, and a `REROUTE / HOLD / DESPAWN` policy (lines 469–480). The dev’s own comment, quoted as S32, is that the traffic model is “still pretty open.” The evidenced mobile behaviour is the street tool, the muddy-road connection rule, monorail-to-residential connection, and the school-capacity bus station. Those are real. The lane/junction/pathfinding layer is a different design wearing a Steam URL.
   **Fix:** Move every unevidenced traffic rule to `Could` / `Design`, and keep `Must` only for behaviours a transcript or the store page actually states. Do not cite the Steam feature blurb as the source of a graph schema.

### MAJOR

3. **Happiness is still a 0–100 scale in the schema, the tests, and the formulas.** `FR-POP-085` (line 253) says no 0–100 scale may be assumed. `HappinessState.value` is typed `0..100` (line 393). `QA-POP-021` (line 549) expects 10,000 residents at H=50 and 5,000 at H=100 to tie. `OQ-POP-12` (line 570) proposes `round(residents × (H/100))`. `OQ-POP-11` uses bands H<40 and H≥60. §7.3 (line 449) offers `S = 100` as the default.
   **Fix:** Change the field range, `QA-POP-021`, and `OQ-POP-12` so they use the scale symbol `S` and do not treat 100 as the maximum.

4. **The 90 % boundary is consistent in ECO and contradicted in POP’s test and formula.** The Economy Overview transcript says “below 90% you are fine, starting from 90% … reduce the growth … 100% … will not grow” (`LmY_TpU1B5Y`). `FR-ECO-064`–`067` and `QA-ECO-031` match that, and they correctly reject `g(u) = (100−u)/10`. `QA-POP-005` (line 533) still expects usage at 95 % to cut growth **by 50 %**, which is that rejected line. §7.3 `supplyAdequacy` is `1` at exactly 90 % (`1 − max(0, usage−90)/10`), so happiness is perfect at the growth-penalty point. `FR-POP-031` (line 175) says the throttle starts at **>90 %**. The water tutorial says “over 90%” for happiness and Mayor Score (`yuLUP_ELk4I`); the food tutorial says keep usage “below 90%” (`6wWZxnm_YLk`). Those two phrases are not the same threshold.
   **Fix:** Delete the 50 % expectation from `QA-POP-005`. Make §7.3 and `FR-POP-031` use ECO’s `< 90` / `≥ 90` / `= 100` split for growth, and record the water video’s “over 90%” as a separate open question for the happiness penalty.

5. **Harbor membership is per map in ECO and region-wide in the brief and in services.** The Connected Economies transcript says “each map that owns a Harbor is connected” (`m5O-A33wQm0`, caption “owns in Harbor”). `FR-ECO-102` matches that. `docs/00-research-brief.md` §3.9 (lines 154–156) still says one Harbor means “all maps in the region are connected.” `QA-SRV-075` (line 525) expects waste pooled across the region when only one of two maps has a Harbor. Edge case E13 (line 417) lets map A’s waste be handled region-wide when the Harbor is on map B.
   **Fix:** Rewrite §3.9, `QA-SRV-075`, and E13 to the per-map rule, or mark them `[TBD]` if the second transcript sentence (“it does not matter anymore if production is on this map or any other”) is meant to override membership.

6. **The wallet is region-scoped in Must rows and profile-scoped in the open question.** The transcript only says coins and Super Cash are “one amount … shared across all maps in general.” `FR-ECO-002` and `FR-ECO-110` leave region versus profile as TBD. `FR-ECO-038` (line 160) and `FR-ECO-046` (line 172) require a **region wallet**. The prose at line 112 does the same. `FR-CORE-007` (line 210) names a region wallet as state that survives a map switch. `OQ-ECO-16` proposes **profile-wide** and says that matches CORE. `OQ-CORE-05` (line 679) says treat it as **region-scoped** because ECO asserts region-wide.
   **Fix:** Strip “region” from `FR-ECO-038`, `FR-ECO-046`, `FR-CORE-007`, and line 112. Pick one default in one open question and point the other document at it.

7. **Loyalty is per map in the requirement and shared in the progression table.** `FR-POP-075` and `OQ-POP-08` say per map, which matches the blog sentence the dossier quotes and the tutorial’s “stay away from your city.” §5 line 360 says “five bonuses per map; loyalty shared.” Line 354 allows loyalty to be non-zero on a brand-new map because of an existing account. `LoyaltyState` (line 388) is a single `points` field with no `mapId`.
   **Fix:** Change line 360 and the Day Zero cell to per-map loyalty, and key `LoyaltyState` by map.

8. **Households, emigration, and a citizen day-cycle are unevidenced in the FR rows and required in the model.** `FR-POP-018`, `FR-POP-106`, and `FR-POP-107` correctly default to “not implemented.” §4 (lines 330–336) still has Shopper, At leisure, and Emigrating as states. §5 (lines 354–359) has households and “emigration visible” on the Village-to-Metropolis ladder. §6 (lines 368–373) defines `Household` and `householdId` as the citizen model.
   **Fix:** Remove those entities from §4–§6, or move the whole block under the `Could` / `Design` rows so a builder cannot implement them by following the schema.

9. **POP §5 puts the marketing stage ladder back.** `FR-CORE-046` and `docs/00-research-brief.md` §4 say farm/village/town/city/metropolis is store copy about map scale, and any taxonomy must be `Could` / `Design`. POP §5 (lines 347–360) is a Village / Town / City / Metropolis table with invented bands (“tens”, “hundreds”, “thousands”) and exit conditions. No Must row gates content on those names. The table is still written as what the population system must support, and the merger’s Appendix B introduces every §5 as “the city-stage model.”
   **Fix:** Replace §5 with the level-from-residents gate, or label the whole table `Could` / `Design` and delete the population thresholds.

10. **A mode list is both denied and acceptance-tested.** `FR-CORE-028` says no mode picker was observed and marks one as `Could` / `Design`. `QA-CORE-011` (line 633), which covers the Must row `FR-CORE-015`, says the player opens the mode list and only shipped modes are selectable. `OQ-CORE-03` proposes shipping that picker.
    **Fix:** Change `QA-CORE-011` so it checks the registry data, not a screen. Keep the picker only under `QA-CORE-018`.

11. **The purged daily-bonus ladder is still a Must.** Fandom, SuperBucks, and Casino Chips are gone from `docs/requirements/09-ui-ux-hud-camera-controls.md`. `FR-UX-111` correctly specifies the evidenced 3-hour free gift from The Basics. `FR-UX-112` is `Must` / `Mobile` and says the rebuild must specify a multi-day ladder and its reset. `OQ-UX-30` says ship no ladder. The data-model note at line 546 still says “daily gift.”
    **Fix:** Demote `FR-UX-112` to `Could` / `Design`, or delete it. The evidenced grant is the 3-hour gift.

### MINOR

12. **`FR-UX-085` assigns a mobile 2.0 feature to the PC title.** Finding S31 (line 71) is an “Android Debut” post that lists orthographic camera, Region View, and expanded languages. `FR-UX-085` (line 254) says the PC title shall add Region View as part of that 2.0 set. Region View is already specified from the mobile Switching Maps tutorial. The Facebook post was not re-fetched.
    **Fix:** Cite the mobile tutorial for Region View, and drop the PC obligation unless a PC source names it.

13. **`FR-ECO-082` ships the caption fragment “PO coal power plant.”** The same producer is “the Coal Power Plant” in the services findings. The stored energy transcript has no speech, so the producer list itself is unverified here.
    **Fix:** Use “Coal Power Plant,” and attach a transcript that actually contains the sentence before keeping nuclear, solar, and green/non-green as `Must`.

14. **Unknown hosts still pass the validator.** `source_verdict` returns `UNKNOWN` for a host that is not in `tools/source_ledger.json`, and only `FOREIGN` and `JUNK` become hard failures (`tools/validate_requirements.py` lines 85–95 and 216–219). That is how `supercity-friends.fandom.com` survived pass 1. `docs/SOURCE-VERIFICATION.md` says the ledger must be closed. The code is still open. A `FOREIGN` URL in §12 or in a finding row is also ignored, because only FR/NFR/QA rows are scanned. `06-services-coverage.md` line 589 still lists a `lite.duckduckgo.com` search URL in the source list; the ledger marks that host `JUNK`, and the validator does not look there.

15. **QA outcome check has a false negative.** A Then cell passes when it is non-empty and is not composed solely of IDs and the character class `[A-Za-z0-9,.\-\s]`. `The requirement holds.` passes. `Passes (see notes).` passes because of the parentheses. A mixed row is caught: any URL in the row whose verdict is `FOREIGN` or `JUNK` is enough, including when a good YouTube URL sits beside it.

### NIT

16. The merger’s reported line count is `len(L)` after each domain body has been appended as one list element (`tools/merge_requirements.py` line 359). The brief’s “2,248 lines” is that figure. The master file itself continues past line 9,300. The stage column in the master index now shows `PC-EA` / `Mobile` for FR rows (for example `FR-WLD-001`), so the old “stage column was rebuildable” bug is fixed in the parser. QA index rows still show Source `TBD` because those rows carry no URL.
17. `tools/audit_numbers.py` now splits lines and reads the requirement cell. The unused `txn` string and `--domain POP` (files are named `05-…`, and the filter uses the first three characters) are leftover defects. It was not re-run here, so the “654 rows, 5 flags” claim was not reproduced.
18. `SOURCE-VERIFICATION.md` still says the Fandom article has “UX: 3 citations.” That is the pre-purge count. The live UX file has zero.

## Remediation verification

| First-pass item | Result |
|---|---|
| 0. Fandom / SuperBucks / Casino Chip purge in `09-ui-ux-hud-camera-controls.md` | **Pass** for the live file. No `fandom`, SuperBucks, or Casino Chip in `docs/requirements/`. The host is `FOREIGN` in `tools/source_ledger.json`, so an FR/NFR/QA row that cites it fails. `.snapshot/09-ui-ux-hud-camera-controls.md` still contains the old rows. `FR-UX-112` keeps the ladder shape at Must priority (finding 11). |
| 1. CORE no longer specifies Playkot’s SuperCity | **Pass.** `playkot` and `supercitygametips` appear only in rejection notes. Story Expeditions, Superzilla, Fruit Salads, Club Boom, Prosperity Point, and Department of Architecture do not appear as requirements. |
| 2. MOB no longer cites the Skylines videos | **Pass** on citations. `0SzCY7BFC8A`, `ZVslYTb-a2M`, Anarchy, and “40 m” survive only as rejection text. **Fail** on the replacement: finding 2. |
| 3. Six-rung stage ladder is not a mechanic | **Pass in CORE** (`FR-CORE-046`, §5.3). **Fail in POP §5** (finding 9). No Must row gates on a stage name. |
| 4. Contradictions | **90 %:** partial (ECO fixed, POP test and formula not). **Harbor:** partial. **Wallet:** fail. **Wealth average:** pass — one definition, wealth-neutral buildings excluded (`FR-POP-056`, `FR-POP-061`); transcript matches 1.65 → 129 % and 3 → 250 %. **×15/×16:** fail (finding 1). **Happiness scale:** fail (finding 3). **Loyalty:** partial (finding 7). **Diversity:** pass in the FR pair — `FR-POP-065` is the point deduction the tutorial states, `FR-POP-066` is the unevidenced hard block. The §5 “max 8 per type” unlock cell is still loose. **Emigration / households:** FR rows pass, schema fails (finding 8). **Mode picker:** partial (finding 10). |
| 5. MOB QA rows with no outcome | **Pass** on the mechanical check. Sampled QA and edge-case rows state an observable result. The check can still be satisfied by a vague sentence (finding 15). |
| 6. Duplicate Harbor / C-Wire / pipeline ownership | **Partial.** The headers now assign buildings to MOB and pool rules to ECO. SRV still states membership outcomes that disagree with ECO (finding 5). |
| 7. Tooling bugs | **Merger count:** fixed in code (`len(docs)` of `len(ORDER)`). **Stage column:** fixed for FR rows. **Repair script:** dangling replacements are written back onto `lines` before the file is saved. **Validator:** definitions are first-cell IDs; QA rows are checked; vocabulary is exact. **Not re-run.** Checked-in `docs/validation-report.json` says `ok: true`, 0 hard failures, 1,168 FR / 126 NFR / 573 QA, 1,867 defined IDs, 86 URLs. **Still open:** unknown hosts pass (finding 14). |

Pass-2 loyalty change: the FR text is right and incomplete. Per-map is what `FR-POP-075` and `OQ-POP-08` say. The Common Crawl URL is an index query. It can prove a capture exists. It does not contain the page text. The quoted WARC offset was not re-fetched. The file disagrees with itself about whether that page was recovered (finding 1).

## Coverage gaps

MOB can be built for streets, muddy-road connection, monorails, and the school bus station. It cannot be built for a road catalogue: the only evidenced tier fact is that a muddy road does not connect buildings. Lane counts, speeds, transit lines, and vehicle capacities are absent, and the gap is filled with Must rows rather than a short TBD list.

BLD names real categories from the tutorials (waste buildings, food chain, monorail, services) and honestly leaves footprints and capacities as data. It does not contain a building list. `FR-BLD-011`’s house → apartment → luxury apartment → skyscraper ladder cites the bare subreddit `https://www.reddit.com/r/supercitycon/`. Three hundred-plus buildings is a count, not a catalogue. A content import still has to be done from the game.

TBD is an honest label on the editor cost formula (`OQ-ECO-09`), the diversity-penalty magnitude (`OQ-POP-07`), and the wealth anchor (`OQ-POP-05`). It is a dumping ground where a row is `Must` and `[TBD]` at once (`FR-MOB-018`, `FR-MOB-021`, `FR-UX-112`) and where §7 “proposed defaults” are written as formulas a programmer can copy (`M = 1 + Σ/100`, H/100, the 50 % growth cut, lane assignment, 24-hour demand).

## Blocked questions

- The Common Crawl body was not fetched, so the verbatim “x15” and “Per Map Calculation” sentences are only as strong as the dossier’s own quotation.
- YouTube `og:title` / channel were not re-checked live. Local transcript headers for the how-to files that contain speech name the channel “Super Citycon - City Building Game,” and the titles match the topics (Connected Economies, Resident Bonuses, Economy Overview, Happiness & Mayor Score, Food Supply).
- `y5g7xPHzj0A__energy-supply.txt` has no spoken words, so `FR-ECO-082` / `FR-ECO-083` (wind, offshore wind, coal, incineration, solar, nuclear, green versus non-green) are unverified in this bundle.
- The Facebook 2.0 photo and `thegameextras.com` were not opened. `www.facebook.com` is ledgered as `OFFICIAL` and `thegameextras.com` as `THIRD_PARTY`.

## Tooling issues

A broken document still passes if it cites a host that is not in the ledger, if a `FOREIGN` URL sits only in §1.1 or §12, if a QA Then cell is a vague sentence, or if §6/§7 contradict the FR rows. The validator never reads formulas.

Mixed-row reproduction, from the code: a row whose last cell contains both `https://www.youtube.com/watch?v=jYAD0SkDmY0` and `https://supercity-friends.fandom.com/wiki/Daily_Player_Bonus` is a hard failure, because every URL is classified and `FOREIGN` is enough. A row that cites `https://example.com/some-other-city-wiki` is a pass, because that host returns `UNKNOWN`.

QA false-negative reproduction: Then = `The requirement holds.` is accepted. Then = `FR-POP-094, FR-POP-095` is rejected. That second case is the old bug, and it is fixed.

`repair_requirements.py` still has a hard-coded `REPOINT` map for `FR-MOB-117`, `FR-MOB-126`, `FR-MOB-131`, `FR-MOB-133`, and `FR-MOB-135`. Those IDs are not in the current MOB file, so the map does nothing until one of them reappears.

The validator was not executed here. The checked-in report matches the brief’s totals and says pass.

## What is genuinely strong

The Playkot and Skylines material is gone from requirement rows, and the rejection notes say why. CORE’s reading of the two products is the right one: mobile has the simulation, Steam Early Access is a construction sandbox without economy or progression, and level is resident count with no XP. The street tool, monorail residential connection, bus-station school link, six residence bonuses, wealth average, diversity deduction, 90/100 growth quote, and per-map Harbor sentence are all traceable to the official transcripts that actually contain speech. The wealth average is now one rule. The diversity penalty is no longer both a deduction and a hard block. House vocabulary is enforced as exact 7-column Must/Should/Could, Mobile/PC-EA/Both/Design, and yes/no/partial values. The merger counts real files and puts stage, not rebuildable, in the FR index.
