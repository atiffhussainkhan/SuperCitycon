**Task-observer:** 16 open observations, last review `never` — want a bounded slice (10 oldest) after this, or carry on?

Gates were **not** re-executed (Ask mode). Figures below are from the documents and source reads only.

---

## 1. PART A — V-01..V-10

**V-01 — NOT FIXED.** Table has 19 edges (WORLD L1507–1525). Graph (L1786–1797) draws `boot → title` and implies most others via nesting/`⇄`, but **`Pause → Stage` is still not an arrow** (`stage ─┬─ pause ⇄ options` is stage→pause plus pause↔options only), and **`Any → Boot` is prose-only** (L1805: “belongs to no screen at all”), not drawn. Bijection claim at L1799–1801 remains false. Gate `6u` (verify_design.py L1174+) checks catalogue↔table screens, **not** graph↔table edges.

**V-02 — FIXED.** Counted 19 table rows including `Credits → Title` (L1514). “Nineteen”/“19” in WORLD L1527, L1801, L2092; ARCH matrix REQ-B-002 L1107; MASTER L369; world bot REQ-B-002. No live “18 transitions” left (historical U-04/T-06 narrative only).

**V-03 — FIXED.** Finale writes: WORLD L1140 `sets flag.endgame_complete`. Transition reads only: L1513. Graph: L1795 “reachable only when flag.endgame_complete is set”.

**V-04 — FIXED.** L1527–1528 + AC-B002 L1541–1552: two snapshot mutators (stage→victory, stage→game over); one outside-snapshot mutator (victory→world map / `REQ-E-006`). Matches matrix/master/bot.

**V-05 — FIXED.** Live name is `src/tools/validate_schema.py` (ARCH tree L274, prose L370, L767). `validate_schemas.py` only in review history.

**V-06 — FIXED.** Live name is `src/tools/world_map_validator.py` (ARCH L278, L767; WORLD L1194, L2038). `world_graph_validator.py` only in review history.

**V-07 — FIXED.** In §4.1 tree (ARCH L275); world bot owns it (agent.md L218); platform “do not own” names it (agent.md L148).

**V-08 — FIXED.** `fault_inject_hardened.py` L69–72 and L125–129 read the live figure and `raise RuntimeError` if missing.

**V-09 — FIXED** (AG-P-08 only). PLAYER L1963: “earlier draft counted 2,719 … measured count is **2,733**”. (World bot still publishes 2,719 — Part D #2, not a failure of the AG-P-08 row.)

**V-10 — FIXED** for the shipping cites that were the defect. WORLD L1774, L1821–1822 and PLAYER L1865 use `shorepine-kenney.zip!icons/…`. ASSETS IN-001..017 keep pack-relative `source_path` under `source_pack: shorepine-kenney.zip` (ASSETS L705–721) — that is the §4.1 pack-relative namespace, not a second shipping-cite form. Residual: AG-P-08 resolution still uses arrow form (`shorepine-kenney.zip` → `icons/…`, PLAYER L1963), and V-10’s claim that IN-017 uses `zip!` is wrong.

---

## 2. PART B — Breakage from rounds 10–12

**World bot contradicts the boards on IN-017 (round 11/12 residue).**

- `pd-dev-world/agent.md` L96–97: `` `kenney-cc0-game-art-packs.zip!assets/kenney/input-prompts/` (2,719 glyph files) ``
- L124–126: “`IN-017` ships **only** the `Generic/` and `Keyboard & Mouse/` families of `kenney-cc0-game-art-packs.zip!assets/kenney/input-prompts/`”

Boards/master ship from **`shorepine-kenney.zip!icons/Input Prompts/…`** and measure **2,733** on the branded pack. No gate reads bot asset-pack prose, so this stays green while wrong.

**Flow-graph/table bijection still broken** — same as V-01; rounds 11–12 added the claim and the Credits edge but did not finish the graph.

**§11.3 heading smashed into body** (MASTER L958):

> `### 11.3 What is still open — and it is not the design**Three id namespaces, never mixed.**`

**§11.4 stale vs §13:** L985 “run **eleven times**” / L979–980 “eleventh pass” while §13 L1079 says “**twelve** times”.

**Path/tool ownership after tree edits:** localisation_check and death_report are in the tree and owned; asset tools match ARCH L279–282; no orphan project path found in the spot-check of boards vs §4.1. **Clean** for “tree path with no owner / owned path off-tree” among the tools touched in rounds 10–12.

**Requirement AC text (master / owning board / owning bot):** REQ-B-002 agrees across MASTER, ARCH, WORLD, world bot. No other AC drift found in the closure set. **Clean** for that category in this pass.

**Published counts that agree:** 19 transitions; 17 content kinds (§8.3); verify_design **28 PASS / 5 INFO**; verify_devbots **12 PASS** (header L11, §10.1 L530, §12 L1022 — prompt’s “11 PASS” is stale); 12,750 lines (L12, L1083); 849 cited paths. **No three-way count fight** among the live figures checked.

---

## 3. PART C — Four changed checks (false-pass?)

Documents claim: `verify_design.py` → 0 FAIL, 0 WARN, 28 PASS, 5 INFO; `verify_devbots.py` → 0 FAIL, 0 WARN, **12** PASS (not 11); audit 102/102; fault_inject 5/5. **Not re-run here.**

| Check | Can it false-pass? | Slipping input | Fix |
|---|---|---|---|
| **Content-ownership completeness** (`verify_devbots.py` L474–477) | **YES** | `len(declared) == len(design_kinds)` without `declared.keys() == design_kinds` — §8.3 and board citations can name different equal-sized kind sets while bots still match §8.3 | Fail unless `set(declared) == design_kinds` |
| **Missing-owned-REQ** (L432–441) | **NO** (for omit-a-row) | — | Overlaps check 3; omission of an owned REQ fails. Residual: artefact/section columns are not compared, only AC text |
| **Failing-run-cannot-certify** (`verify_design.py` L1254–1257) | **NO** for FAIL>0 + matching PASS count | — | Early FAIL if `results["FAIL"]`. Residual (not this rule): WARN/INFO and the full `F/W/P/I` tuple still unchecked; **`MASTER_BUILDING=1` still auto-passes placeholders** (L1241–1245) |
| **Live-figure injection** (`fault_inject_hardened.py` L69–72, L125–129) | **NO** for the stale-“26 PASS” class | — | Reads live figure; refuses if absent. Residual: injection #5 only proves the placeholder path, not the FAIL>0 certify path |

**Uncovered by any gate:** graph↔table edge bijection (V-01) and bot prose that names the wrong prompt pack (Part B).

---

## 4. PART D — Remaining defects

1. **MAJOR** — `DESIGN-3-WORLD.md` L1786–1805 vs L1507–1525. Graph claims every table row appears; **`Pause → Stage` and `Any → Boot` do not appear as arrows**. **Fix:** Draw `pause → stage` (or `stage ⇄ pause`) and `any → boot` explicitly, or drop the bijection claim and list deliberate omissions.

2. **MAJOR** — `~/.minimax/agents/pd-dev-world/agent.md` L96–97 and L124–126. Offending: shipping IN-017 from `` `kenney-cc0-game-art-packs.zip!assets/kenney/input-prompts/` `` with **`(2,719 glyph files)`**. **Fix:** Match boards — `shorepine-kenney.zip!icons/Input Prompts/Generic/` and `…/Keyboard & Mouse/`; branded pack only as measured **2,733**, not shipped.

3. **MINOR** — `DESIGN-3-MASTER.md` L958. Heading glued to body (`…design**Three id…`). **Fix:** Newline after the heading; restore `**Three id namespaces…**` as its own lead sentence.

4. **MINOR** — `DESIGN-3-MASTER.md` L985–980 vs L1079. “Eleven” / “eleventh pass” after twelve reviews. **Fix:** Align §11.4 with §13 (twelve / twelfth), or scope §11.4 as “through round 11”.

**Exhausted / clean this pass:** V-02..V-09 as scoped; tool basename dual-spellings; localisation_check ownership; AC-B002 mutator wording; `flag.endgame_complete` three-way write; live “18 transitions”; §4.1 tool inventory for the tools rounds 10–12 touched; known accepted items (music DEL-01, no code, DEL-02 Gate 2, unverified 2D, jam zip).

---

## 5. Verdict

**NOT READY to hand to the five bots** until **#1** (scene-flow bijection still false) and **#2** (world bot still aims IN-017 at the branded pack with a stale 2,719 count) are fixed; neither is covered by the current gates, so a green gate run would not clear them.
