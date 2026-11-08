**Task Observer:** 16 open observations, last review `never` — review the 10 oldest when you want; this report continues.

**Gates this session:** Ask mode blocked shell, so `verify_design.py` / `verify_devbots.py` / `audit_depth.py` were **not** re-executed here. Figures below are from document text + source inspection only.

---

## 1. PART A — T-01…T-09

| ID | Verdict | Evidence relied on |
|---|---|---|
| **T-01** | **FIXED** | `pd-dev-world/agent.md` L160: “across all **15** scene transitions… two transitions… stage → victory… stage → game over… victory → world map, applies… `save_flags`… `REQ-E-006`” |
| **T-02** | **FIXED** | `pd-dev-player/agent.md` L89: empty allowed-input for `hurt`/`dead`/`victory`; `DESIGN-3-ARCHITECTURE.md` L1074; `DESIGN-3-PLAYER.md` L583–588 |
| **T-03** | **FIXED** | `pd-dev-entities/agent.md` L146: “**9 damage sources**” + nine named types; matrix `DESIGN-3-ARCHITECTURE.md` L1124 |
| **T-04** | **FIXED** | `pd-dev-entities/agent.md` L156: “**6 parameterised hazard kinds**… **all 11 hazard archetypes**”; matrix L1134 |
| **T-05** | **FIXED** | Table inventory rules `DESIGN-3-WORLD.md` L1511–1517; AC-B002 L1529–1539; world REQ row L2058; arch matrix L1097; master matrix L369 — all agree: two snapshot mutators; victory→map = `save_flags`/`completed_exits` outside snapshot → `REQ-E-006` |
| **T-06** | **FIXED** | Counted table rows L1507–1521 = **15**, includes `Pause → Stage` and `Options → Pause`. Live “13 transition” cites for scene flow are gone (remaining “13”s are biomes/stages/etc.) |
| **T-07** | **FIXED** *(register row)* | `DESIGN-3-PLAYER.md` L1963 `AG-P-08 — RESOLVED`; points at `shorepine-kenney` Generic / Keyboard & Mouse; `IN-017` `DESIGN-3-ASSETS.md` L721. **Live shipping cites elsewhere still stale — see D-01** |
| **T-08** | **FIXED** | Player owns `src/systems/{…,player}/**` (`pd-dev-player` L123); no off-tree `behaviours/player` path found |
| **T-09** | **FIXED** | `TUNE-002` = `24.0 m/s²` (`DESIGN-3-ARCHITECTURE.md` L1275); player L245, L403, L947. No remaining live `24.0 m/s` (non-acceleration) typo |

---

## 2. PART B — Path namespace

**1. Project paths use `src/`?**  
Almost. Boards consistently use `src/content/…`, `src/assets/…`, `src/tools/…`. One remaining project-ish path without the tree prefix: architecture L337 `` `core/rules` `` (should be `src/core/rules`). No surviving `content/…` / `data/…` / `scenes/…` project paths in the five boards (master changelog quotes are historical).

**2. Pack-relative paths / 849 claim?**  
Pack-relative forms (`assets/kenney/…`, `mini-characters/…`, `shorepine-kenney/…`) remain and are intentional (§4.1). **Challenge to “849 resolving”:** `check_assets` admits any basename / last-two-path-segments / kit-relative alias into `known` (`verify_design.py` L137–150, L220–251). A wrong pack-qualified cite whose basename exists anywhere still PASSes. 849 proves “something with that name exists,” not “this citation is the right pack member.”

**3. Manifest / licence / attribution under `src/assets/`?**  
Consistent: arch §1 L21, §4.1 L269–272, §5.8 L601; assets board L1249–1273; world LINT-007 L1973 and cue registry L1696–1703 all point at `src/assets/asset_manifest.json` with cues in `src/content/audio/`.

**4. Player profiles / archetype ids?**  
Coherent: `profile_id` ∈ {`profile_tallow`,…}; file `src/content/characters/<profile_id>.character.json`; archetype id `player.<profile_id>` (`DESIGN-3-PLAYER.md` L913–916; arch §5.3 L452–460). §5.3 explicitly forbids dual homes (characters vs actors). **Stale residue:** player acceptance still says `player.<profile>.actor.json` (L586) — see D-03.

**5. Content-kind partition (17 kinds)**

| Content kind | Sole owner | Matches design dir? |
|---|---|---|
| `rulesets` | pd-dev-platform | yes |
| `tuning` | pd-dev-platform | yes |
| `save` | pd-dev-platform | yes |
| `stages` | pd-dev-world | yes |
| `blocks` | pd-dev-world | yes |
| `objects` | pd-dev-world | yes |
| `worlds` | pd-dev-world | yes |
| `palettes` | pd-dev-world | yes |
| `backgrounds` | pd-dev-world | yes |
| `audio` | pd-dev-world | yes |
| `fx` | pd-dev-world | yes |
| `localisation` | pd-dev-world | yes |
| `actors` | pd-dev-entities | yes |
| `items` | pd-dev-entities | yes |
| `damage` | pd-dev-entities | yes |
| `scoring` | pd-dev-entities | yes |
| `characters` | pd-dev-player | yes |

**No kind with zero or two owners. Partition is clean.**

**6. Tree ↔ bot directories?**  
Every bot-owned `src/…` / `tests/…` prefix appears under §4.1. Tree also lists unowned infra (`ci/`, `docs/`, `dist/`, `tests/{unit,integration,…}`) — fine. **Hole:** §4.1 lists `systems/player/`, but §4.3’s system table **omits `player` entirely** (L321–333) — bots own a directory the ownership/API contract never publishes (D-02).

---

## 3. PART C — Five new checks (false-pass?)

| Check | False-pass? | Slip-through input | Concrete fix |
|---|---|---|---|
| **Acceptance-text vs matrix** (`verify_devbots.py` L393–424) | **YES** | Bot AC cell = matrix text **plus** a contradictory appendix (`…15 transitions… (implement against the old 8)`). Test is `want not in got` (substring), so extras never fail | Require equality after `normalise`, or tokenise and forbid digits/ids in `got` that are absent from `want` |
| **§4.1 containment** (`verify_devbots.py` L366–391) | **YES** | Bot owns `src/tools/evil_extra.py` while tree only lists four tool files. Check only tests `directory in tree_dirs`, never `leaf in tree_files` for nested files | For non-`**` leaves, require `directory/leaf ∈ tree_files`; for `**`, require the directory node itself be enumerated |
| **Content ownership** (`verify_devbots.py` L426–452) | **YES** | Swap owners: player owns `src/content/stages/**`, world owns `characters/**`. Still “exactly one owner” → PASS, even though wrong board | Compare discovered kinds to a hard-coded owner map derived from the bots’ design roles (or from §4.1 comments), not cardinality alone |
| **Path namespace** (`verify_design.py` L1091–1133) | **YES** | `` `core/rules` ``, `` `systems/player/foo.gd` ``, or unbackticked `content/stages/x` — only heads `content`/`data`/`scenes` and `assets/*.json` are flagged | Flag any backtick path whose first segment is a §4.1 root (`core`,`systems`,`content`,`scenes`,`assets`,`tools`) **without** `src/` (except allow-listed design tools and true pack-relative `assets/…` non-JSON) |
| **Published gate figures** (both gates) | **YES** | Leave `@@DESIGN_GATE@@` / `@@DEVBOTS_GATE@@` in the master forever → automatic PASS with no count check (`verify_design.py` L1163–1167; `verify_devbots.py` L204–207). Also only the PASS count is checked, not FAIL/WARN/INFO | Fail if placeholder remains outside a builder run; assert full `0 FAIL, N PASS[, M INFO]` tuple |

Would a deliberately broken variant fail when the check is *supposed* to work?  
- Wrong AC **replacing** matrix text → yes (substring fails).  
- Off-tree **directory** (`src/behaviours/**`) → yes.  
- Contested content kind → yes.  
- `` `content/foo` `` → yes.  
- Master PASS count off by 1 (no placeholder) → yes.  

The holes above are the cases that still green-light.

---

## 4. PART D — Remaining defects

1. **MAJOR — IN-017 pack path contradicted in shipping boards**  
   - `DESIGN-3-WORLD.md` L1753: `` `kenney-cc0-game-art-packs.zip!/assets/kenney/input-prompts/*` ``  
   - L1789–1791: same pack as the rebind source, while claiming `IN-017`  
   - `DESIGN-3-PLAYER.md` L1865: same pack in the live glyph table  
   - **Authoritative:** `IN-017` / AG-P-08 → `shorepine-kenney.zip` → `icons/Input Prompts/Generic|Keyboard & Mouse/`  
   - **Fix:** Replace every shipping cite with the `shorepine-kenney` paths; keep `kenney-cc0-…` only as ASSET-SURVEY measurement history.

2. **BLOCKER — `player` system missing from architecture §4.3**  
   - Tree L225 and player bot own `src/systems/player/**`  
   - §4.3 table L321–333 has no `| \`player\` |` row; matrix still points REQ-A-005 at “§4.3 (`actors`)” (L1074)  
   - **Fix:** Add a `player` system row (owns profiles/power ladder/state machine/damage intake; publish verbs); retarget matrix section refs from `actors` to `player` where appropriate.

3. **MAJOR — stale profile filename in live acceptance**  
   - `DESIGN-3-PLAYER.md` L586: `` `player.<profile>.actor.json` ``  
   - Conflicts with `….character.json` under `src/content/characters/`  
   - **Fix:** Say `src/content/characters/<profile_id>.character.json`.

4. **MAJOR — scene-flow table vs flow graph disagree**  
   - Table (15 rows) has no `Title → Options` / `Options → Title`  
   - Flow graph L1773: “options (reachable from the title)”  
   - Graph also nests `rebind` / `save_slots` without table rows (overlays vs transitions unclear)  
   - **Fix:** Either add the title↔options edges to the 15-row table and bump REQ-B-002, or delete title reachability and define rebind/save_slots as non-transition overlays of Options.

5. **MAJOR — path-namespace / ownership gates can false-pass** (Part C)  
   - Package can read green while wrong owner, invented tool file, or stale AC appendix ships  
   - **Fix:** as in Part C table.

6. **MINOR — architecture L337** `` `core/rules` ``  
   - Violates the three-namespace rule as written  
   - **Fix:** `` `src/core/rules` ``.

**Clean categories (explicit):** content-kind dual-ownership; gravity unit; T-01…T-06 / T-08 / T-09; OPEN-002/005 still the only declared opens; no new music / code / OPEN-02 claims.

---

## 5. Verdict

**Not ready for the five development bots** — still blocked by the missing `player` system API in §4.3, and by IN-017 / scene-flow contradictions that would make bots implement the wrong pack paths and an incomplete transition graph; harden the five gate checks before treating a green run as evidence.
