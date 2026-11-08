## 1. PART A — Round 11 fixes

| ID | Call | Lines relied on |
|---|---|---|
| **U-01** | **FIXED** | Shipping cites are shorepine trademark-free: WORLD L1764, L1808–1813; PLAYER L1865; ASSETS IN-001…IN-017 L705–721. Branded pack kept as measurement: ASSET-SURVEY L413–416 (“2,733 files”); ASSETS L858. No live shipping cite still points rebind glyphs at `kenney-cc0-game-art-packs`. (AG-P-08 L1963 still *narrates* the old “2,719” branded path as the defect that was fixed — survey itself corrected that to 2,733.) |
| **U-02** | **FIXED** | ARCH §4.1 lists `player/` L225; §4.3 row L331 with owns/verbs/must-never-touch; REQ-A-005 / REQ-A-019 matrix → `§4.3 (\`player\`)` L1082, L1096. Thirteen tree dirs ↔ thirteen §4.3 rows. |
| **U-03** | **FIXED** | PLAYER acceptance uses `src/content/characters/<profile_id>.character.json` L481, L585; zero `player.<profile>.actor.json` in PLAYER. |
| **U-04** | **NOT FIXED** (count fixed; graph/prose still wrong) | Table L1507–1524 = **18** rows (counted). “18” agrees in WORLD AC L1539–1550 / matrix L2080, ARCH L1105, MASTER L369, `pd-dev-world` L160; snapshot mutators agree (stage→victory, stage→game over; victory→world map outside snapshot). But §7.7.2 L1788–1790 claims every table row appears in the graph — **false**: graph L1775–1786 omits **Boot→Title**, **Pause→Stage**, **Any→Boot**. Overlays declared L1531–1537 / L1791–1793 — OK. |
| **U-05** | **PARTIALLY FIXED** | Named Round-11 slips are closed in code: AC equality L404–437 `verify_devbots.py`; leaf containment L388–393; declared-owner check L439–475; TREE_ROOTS L1105; placeholder fail L1201–1207. `fault_inject_hardened.py` still injects `**0 FAIL, 26 PASS**` (L119) while master publishes **27 PASS** (L11) — inject #5 is a no-op against current master, so the “all five fault-injected” claim is stale. Residual false-pass holes remain (Part C). |
| **U-06** | **FIXED** | ARCH L345: `` `src/core/rules` `` — no live un-prefixed `` `core/rules` ``. |

---

## 2. PART B — Consistency sweep

**Parameter / value contradictions**

| Parameter | Values | Where |
|---|---|---|
| Scene-transition set | Table = 18 edges; graph shows ~15 visible edges; prose “every row appears in the graph” | WORLD L1507–1524 vs L1775–1790 |
| `flag.endgame_complete` | Set by `region08_finale` exit; table says World map→Credits “set once”; graph says credits when flag “is set” (prerequisite) | WORLD L1140 vs L1513 vs L1785 |
| “Three transitions change persistent state” | Credits / profile / quit paths also mutate session or flags | WORLD L1526–1529 vs L1508 / L1513 / L1524 |
| Tool basename | `validate_schema.py` (tree) vs `validate_schemas.py` (prose) | ARCH L274 vs L368, L765 |
| World-graph tool | `world_map_validator.py` (tree + platform bot) vs `world_graph_validator.py` (world + arch prose) | ARCH L277 vs L765; WORLD L1194, L2034–2036 |
| Prompt pack count (history) | AG-P-08 still says “2,719 files” for the branded pack | PLAYER L1963 vs ASSET-SURVEY L413–416 (2,733) — historical only if read as defect narrative |

**Clean (explicit):** gravity / capsule (0.35 × 1.75) vs translation; IN-017 shipping pack vs survey measurement role; OPEN-002 / OPEN-005 only open design decisions; DEL-01…DEL-06 separate; music G-05 known; content-kind partition in MASTER §8.3 L474–492 (17 kinds, one owner each); no dual bot write of the same kind in the ownership table.

**Other classes**
- **AC met two ways:** REQ-B-002 AC is coherent on the snapshot tuple; the *prose* “three persistent changes” is the incompatible second story.
- **Trademark leakage in shipped content:** IN-017 / rule 4 / glyph table clean; branded families only as excluded/measured.
- **Generate-art mandates:** none found in live boards beyond known Tier-B excluded paths.
- **Id namespaces:** OPEN / W-OPEN·CB·XN / DEL separation published MASTER L908–918 — clean.
- **Credits dead-end:** `screen.credits` has inbound only — no Credits→* row — contradicts L1527 “every screen… has an entry out of it”.

---

## 3. PART C — Gate false-pass table

Gates **not re-executed in this Ask-mode session** (shell blocked). Master L11 claims `verify_design.py → 0 FAIL, 27 PASS` and `verify_devbots.py → 0 FAIL, 11 PASS`; static PASS-slot count matches 27 / 11 (review prompt’s “26 PASS” is stale).

### `verify_design.py` (27 PASS slots)

| # | Check | False-pass? | Slipping input | Fix |
|---|---|---|---|---|
| 1 | REQ coverage | **no** | — | — |
| 2 | NFR coverage | **no** | — | — |
| 3 | Asset path resolution | **yes** | Cite only inside a FAILING-EXAMPLE / `<placeholder>` / history strip | Narrow exemptions; don’t skip whole review-history for path claims that are still normative elsewhere |
| 4 | Constant conflicts | **yes** | Same value under two different names; unitless vs unit mismatch the regex misses | Normalize aliases; require unit token |
| 5 | IP leakage | **yes** | Shipped name with research-tag framing on same line | Require research-tag *and* non-shipped context grammar |
| 6 | Procedural-art words | **yes** | Synonym outside `PROCEDURAL_WORDS` (“author a mesh”, “synth texture”) | Expand / semantic scan |
| 7 | Open-decision register | **yes** | Open ask without a matching `OPEN-###` token | Fail any ASKS line lacking an id |
| 8 | Camera dead zone | **no** (for the pattern it scans) | — | — |
| 9 | Trademark safety (manifest rows) | **yes** | Branded path in a non-table paragraph or non-`SHIPPABLE` row later treated as shippable in prose | Scan all shipping cites, not only `SHIPPABLE` table cells |
| 10 | Manifest counts | **no** | — | — |
| 11 | Non-shippable ↔ ADOPTED | **yes** | ADOPTED block mentions wrong `AU-###` | Bind gap_id on the row to the §13 section |
| 12 | Audio vocabulary | **yes** | “unsourced ambience” without the exact banned tokens | Broader patterns |
| 13 | Asset CI status enum | **no** | — | — |
| 14–15 | Published measured counts | **yes** | Paraphrase that avoids banned phrases but still asserts “78 shipped SFX” | Assert the canonical triple must appear wherever corpus is discussed |
| 16 | Example vocabulary | **yes** | Bad enum only outside the scanned example shapes | Parse schema enums and diff examples |
| 17 | Audio arithmetic | **yes** | New wrong split not in `FORBIDDEN_AUDIO` | Derive forbidden list from measured inventory |
| 18 | Re-open decided items | **yes** | Soft reopen without ASK_STRONG verbs | Broader ask lexicon |
| 19 | Hazard cardinality | **no** (for REQ-D-012 rows) | — | — |
| 20 | Stale GAP labels | **yes** | “gap” without `GAP G-xx` adjacency | Match resolved ids more broadly |
| 21 | Catalogue tally | **no** | — | — |
| 22 | Body callout closedness | **yes** | Callout without `CB-/XN-/W-OPEN-` id | Require ids on all cross-board asks |
| 23 | REQ-B-002 / A-005 clauses | **yes** | “18” present but wrong mutators; graph never checked | Parse transition table; diff graph edges; assert mutator set |
| 24 | Path namespace | **yes** | Unbackticked `content/stages/x`; `` `tools/fault_inject_hardened.py` `` outside stripped history (not in allowlist) | Scan bare paths; add allowlisted design tools |
| 25 | System ↔ §4.3 | **no** | — | — |
| 26 | Duplicate section numbers | **yes** | Same number with different heading depth tricks / typos `## 5.` vs `### 5.` | Normalize numbering |
| 27 | Published figures | **yes** | Master `0 FAIL, 27 PASS` while run has FAILs but same PASS count; WARN/INFO unchecked; `MASTER_BUILDING=1` + placeholder | Assert full `F/W/P/I` tuple; ignore env outside `build_master.py` |

### Round-11 five (hardened?) — residual

| Hardened check | Still false-pass? | Input | Fix |
|---|---|---|---|
| AC text equality | **weak yes** | Delete REQ from bot scope (caught elsewhere); cosmetic-only after `normalise` | Also flag owned matrix REQs missing from bot |
| §4.1 leaf containment | **no** for named files | — | — |
| Content ownership vs §8.3 | **yes** | Delete §8.3 table → `declared={}` → vacuous PASS | Fail if `len(declared) != 17` |
| Path namespace TREE_ROOTS | **yes** | Unbackticked project path | See #24 |
| Published figures placeholder | **yes** | See #27; plus `fault_inject` still targets **26** PASS | Parameterize expected PASS; assert FAIL=0 |

### `verify_devbots.py` (11 PASS)

| # | Check | False-pass? | Slipping input | Fix |
|---|---|---|---|---|
| 1 | Required sections | **yes** | Section heading present, body empty | Require non-empty body under each heading |
| 2 | REQs appear in some bot | **yes** | REQ listed but not owned correctly (caught partly by #3) | — |
| 3 | Scope ↔ matrix | **no** for ownership sets | — | — |
| 4 | Cross-board = 2 bots | **yes** | Wrong two bots | Compare to matrix owner+consumer |
| 5 | NFR owned | **yes** | NFR row present, AC wrong (NFRs not in AC equality) | Extend AC equality to NFRs |
| 6 | Ownership overlap | **yes** | Disjoint globs that still collide at runtime (`a/*` vs concrete file via different spelling) | Expand against tree file set |
| 7 | §4.1 containment | **no** for named leaves | — | — |
| 8 | AC equality | **no** for appendix attack | — | Keep; fix fault_inject expected count |
| 9 | Content ownership | **yes** | Vacuous empty §8.3 | Fail unless 17 kinds |
| 10 | Defer-to-design phrase | **yes** | Soft authority claim without banned phrase | Broader authority lexicon |
| 11 | Published figures | **yes** | Same as design #27 | Same fix |

---

## 4. PART D — Remaining defects

1. **MAJOR** — `DESIGN-3-WORLD.md` L1788–1790 / L1775–1786  
   *“Every arrow in this graph is a row of that table, and every row of that table appears here”*  
   **Fix:** Redraw graph to include Boot→Title, Pause→Stage, Any→Boot (or drop those rows from the table and stop claiming bijection).

2. **MAJOR** — `DESIGN-3-WORLD.md` L1527 vs absent Credits exit  
   *“every screen the game can occupy has an entry out of it”* — `screen.credits` has no outbound row.  
   **Fix:** Add Credits→Title (or World map) to the table and graph; bump “18” everywhere via `build_master` / matrix / bot AC.

3. **MAJOR** — `DESIGN-3-WORLD.md` L1513 vs L1140 vs L1785  
   World map→Credits inventory rule *“`flag.endgame_complete` set once”* vs finale *sets* the flag vs graph *when flag is set*.  
   **Fix:** Table rule = prerequisite only (no set); align graph wording.

4. **MAJOR** — `DESIGN-3-WORLD.md` L1526  
   *“Eighteen transitions, three of which change persistent state”* undercounts (credits/profile/quit).  
   **Fix:** Restate against the AC-B002 snapshot definition only, or enumerate every mutator.

5. **MAJOR** — `DESIGN-3-ARCHITECTURE.md` L274 vs L368 / L765  
   `` `validate_schema.py` `` vs `` `validate_schemas.py` ``.  
   **Fix:** One basename everywhere (tree, bots, invocations).

6. **MAJOR** — ARCH L277 / platform bot vs ARCH L765 / WORLD L2034  
   `` `world_map_validator.py` `` vs `` `world_graph_validator.py` ``.  
   **Fix:** Pick one name; update tree, bot ownership, world §9.2, arch tooling table.

7. **MAJOR** — `DESIGN-3-WORLD.md` L1951 / L2049  
   `` `src/tools/localisation_check.py` `` not in §4.1 tree.  
   **Fix:** Add to tree + owning bot, or rename to an existing tool.

8. **MAJOR** — `tools/fault_inject_hardened.py` L119  
   Injects `26 PASS` into a master that publishes `27 PASS`.  
   **Fix:** Read the live figure from the master / gate summary before mutate.

9. **MINOR** — `DESIGN-3-PLAYER.md` L1963  
   AG-P-08 still says branded pack “2,719 files”.  
   **Fix:** Say “earlier draft count 2,719; measured 2,733” to match ASSET-SURVEY.

10. **MINOR** — WORLD L1764 vs L1809  
    Screen table uses pack-relative `shorepine-kenney/icons/...`; rule 4 uses `shorepine-kenney.zip!icons/...`. Same pack, two cite forms.  
    **Fix:** Standardize on the zip! form used by IN-017.

**Clean categories (explicit):** U-01 shipping pack path; U-02 `player` API row; U-03 profile filename; U-06 `src/` prefix; OPEN/DEL namespace collision; content-kind dual-ownership in §8.3; music G-05 / DEL-01 known; no new code/test claims.

---

## 5. Verdict

**NOT READY for the five development bots** — Round 11’s packing/API/profile/prefix fixes are real, but scene-flow still disagrees with itself (graph ↔ table ↔ credits/flag prose), tool basenames disagree across tree and boards, and the hardened gates still admit false passes (including a stale fault-inject for published figures).
