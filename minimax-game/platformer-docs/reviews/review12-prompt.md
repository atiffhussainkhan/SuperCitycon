You are the senior reviewer for a 3D game design package. Eleven prior review rounds have run. This is round 12. Round 11 found six defects (three stale shipping cites for the input-prompt pack, a missing `player` system API row in the architecture, a stale profile filename, a scene-flow table that disagreed with its own flow graph, a family of gate false-passes, and a unit/prefix typo) plus a naming collision between two id namespaces. All of that has now been changed. This round's job is to verify the fixes are real, to re-challenge the hardened gates, and to give a final readiness verdict.

PROJECT ROOT: /Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace/minimax-game

READ THESE:
  platformer-docs/MASTER-REQUIREMENTS.txt          the 102-REQ source of truth
  platformer-docs/DESIGN-3-MASTER.md              the master design (1044 lines; §8.1/§8.2 the matrix, §8.3 the content-ownership table, §11.2j round 11, §11.3 open items)
  platformer-docs/DESIGN-3-ARCHITECTURE.md        architecture & traceability (§4.1 tree, §4.3 system table, §5 schemas, §10 matrix)
  platformer-docs/DESIGN-3-ASSETS.md              asset manifest board
  platformer-docs/DESIGN-3-PLAYER.md              player systems board
  platformer-docs/DESIGN-3-ENTITIES.md            entities & combat board
  platformer-docs/DESIGN-3-WORLD.md               world & content board (§7.3 transition table, §7.7 screens and flow graph)
  platformer-docs/3D-TRANSLATION.md               the 2D->3D mechanics contract
  platformer-docs/ASSET-SURVEY.md                 the measured repository facts
  tools/verify_design.py, tools/audit_depth.py, tools/verify_devbots.py, tools/build_master.py, tools/reconcile_paths.py, tools/fault_inject_hardened.py
  /Users/mac/.minimax/agents/pd-dev-{platform,player,entities,world,assets}/agent.md

HARD CONSTRAINTS (unchanged - a violation is a blocker)
  - 3D side-scrolling platformer (traversal axis X, camera constrained to a lane on Z). Godot 4.7.2-stable, 3D renderer, GDScript.
  - EVERY mesh, texture, animation, skybox, background, UI element, icon and sound must be a NAMED file that exists in the user's image repository. The pipeline may MEASURE and REGISTER assets; it must never AUTHOR them. No procedural geometry, no generated visuals. Compositing existing library assets is allowed; fabricating is not.
  - Original IP only. Reference games are research tags for BEHAVIOUR only. All console-manufacturer-branded prompt families are EXCLUDED from shipping; IN-017 ships only Generic/ and Keyboard & Mouse/.
  - Precedence on conflict: 3D-TRANSLATION.md (mechanics) > ASSET-SURVEY.md (asset facts) > the owning board > the master document.
  - Unpublished/tuned numbers live in TUNE / UNVERIFIED tables with a stated rationale. Gaps G-01..G-14 are real and carry an ADOPTED option each.
  - Exactly two design decisions remain legitimately open: OPEN-002 (web release host) and OPEN-005 (rights review). Delivery items are a separate namespace, DEL-01..DEL-06, listed in master §11.3. Neither blocks desktop Gate 0-5.

PART A - VERIFY ROUND 11's SIX FIXES (U-01..U-06)
  U-01 Every SHIPPING cite of the rebind input-prompt glyphs now names shorepine-kenney.zip!icons/Input Prompts/Generic/ and .../Keyboard & Mouse/. The 2,733-file kenney-cc0-game-art-packs prompt set appears only as measured-but-not-shipped. Check the world's screen table, its §7.7.3 rule 4, the player's glyph table, the assets board and ASSET-SURVEY. Confirm no shipped cite still points at the branded pack, and that the survey's measurement is still accurate as a measurement.
  U-02 Architecture §4.3 now publishes a `player` system row with its owns/verbs/must-never-touch, and the matrix rows for REQ-A-005 and REQ-A-019 point at §4.3 (`player`). Verify the row is complete against the tree and that every system directory in §4.1 now has a §4.3 row.
  U-03 No live acceptance sentence names player.<profile>.actor.json.
  U-04 The scene-transition table now has EIGHTEEN rows, §7.7.2's flow graph is derived from it, overlays are declared as overlays, and every "15" reference to the transition count is gone. COUNT THE ROWS YOURSELF. Verify the table, the graph, the AC clause, the architecture matrix row, the master matrix row and the world bot all agree on 18 and on which transitions mutate the snapshot.
  U-05 The five hardened checks. For each, read the code and decide whether it can STILL produce a FALSE PASS. Name the specific input that would slip through. The team claims it fault-injected all five with the review's own inputs and that tools/fault_inject_hardened.py reproduces them.
  U-06 No un-prefixed §4.1 root survives.

PART B - THE WHOLE-PACKAGE CONSISTENCY SWEEP
  Hunt for the recurring class: a DECISION OR MEASURED VALUE TAKEN IN ONE BOARD AND STILL CONTRADICTED, RE-OPENED, OR PUBLISHED WITH A DIFFERENT VALUE ELSEWHERE. Enumerate every parameter that appears in more than one document and verify each has exactly one value.
  Also check: any requirement whose acceptance criterion could be met two incompatible ways; any board asserting something the asset survey contradicts; any remaining trademark or reference-game leakage in shipped content; any statement that would require generating art rather than measuring it; any content kind, file or directory two bots would both write; any id that appears in two namespaces.

PART C - THE GATES
  Claimed: python3 tools/verify_design.py -> 0 FAIL, 0 WARN, 26 PASS, 5 INFO; python3 tools/audit_depth.py -> 102/102 requirements implementable; python3 tools/verify_devbots.py -> 0 FAIL, 0 WARN, 11 PASS. The master's published figures are now measured by tools/build_master.py and both gates check them.
  Read the gate code. For each of the 11 dev-bot checks and the 26 design checks, decide: can it produce a FALSE PASS? Say which ones can and give the input. If you find one, say exactly what to change.

PART D - REMAINING DEFECTS
  Every remaining defect as a numbered list with severity (BLOCKER / MAJOR / MINOR), the exact file and line, the quoted offending text, and the concrete fix. Say so explicitly if a category is clean - do not pad.

KNOWN STATE - DO NOT RE-REPORT AS NEW
  - No music in the repository: 27 cues UNSOURCED, music bus ships silent (G-05), REQ-D-015 PARTIAL. Known and accepted.
  - No code exists; no test has been run against code. All verification is of the design.
  - DEL-02 (kaykit_41 bone map + golden retarget test) is specified but not written; a GATE 2 blocker by design.
  - All 114,852 2D records are licence_status: unverified (usable, labelled pending, excludable by config). jam-ready-assets.zip is PACK_LEVEL and must not ship.

OUTPUT FORMAT
  1. PART A: one line per finding U-01..U-06 - FIXED / NOT FIXED + the exact lines you relied on.
  2. PART B: the sweep's results, with the parameter table if you find a contradiction.
  3. PART C: a table of every check - CAN IT FALSE-PASS? yes/no + the slipping input + the fix.
  4. PART D: the numbered defect list.
  5. A final one-line verdict: is this package READY to hand to the five development bots, and what (if anything) still blocks it.

Be adversarial and specific. Prefer quoting exact lines over paraphrase. Make the calls and justify them; do not ask questions.
