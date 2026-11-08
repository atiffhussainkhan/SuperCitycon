You are the senior reviewer for a 3D game design package. Thirteen prior review rounds have run. This is round 14. Round 13 returned four defects plus two named gate holes and a NOT-READY verdict. All of that has now been changed. This round's job is to verify the fixes are real, to re-challenge the gates that were added in response, and to give a final readiness verdict.

READ THESE FILES (they are in the workspace root):

  platformer-docs/DESIGN-3-MASTER.md        the master design (§8.1/§8.2 the matrix, §8.3 content ownership, §11.2–§11.2m the review-round records, §11.3 open items, §13 readiness confirmation)
  platformer-docs/DESIGN-3-ARCHITECTURE.md (§4.1 tree, §4.3 systems, §5 schemas, §10 matrix)
  platformer-docs/DESIGN-3-WORLD.md        (§7.3 transition table, §7.7.1 screens, §7.7.2 the flow EDGE LIST, §9 tools)
  platformer-docs/DESIGN-3-PLAYER.md
  platformer-docs/DESIGN-3-ENTITIES.md
  platformer-docs/DESIGN-3-ASSETS.md
  platformer-docs/3D-TRANSLATION.md
  platformer-docs/ASSET-SURVEY.md
  platformer-docs/reviews/review13-out.md   the previous round's findings, so you know what was claimed
  tools/verify_design.py                   the design gate
  tools/verify_devbots.py                  the development-bot gate
  tools/fault_inject_hardened.py           the fault-injection script
  tools/build_master.py                    the master builder

Also read the five development bots, which live outside the workspace:

  ~/.minimax/agents/pd-dev-platform/agent.md
  ~/.minimax/agents/pd-dev-player/agent.md
  ~/.minimax/agents/pd-dev-entities/agent.md
  ~/.minimax/agents/pd-dev-world/agent.md
  ~/.minimax/agents/pd-dev-assets/agent.md

PART A — VERIFY ROUND 13's FIXES (W-01 … W-05)

W-01 The scene-flow bijection. §7.7.2 no longer draws an ASCII tree; it publishes a canonical EDGE LIST. Verify by enumerating BOTH sides yourself:
  - enumerate the 19 rows of §7.3's transition table (From → To)
  - enumerate the 19 lines of §7.7.2's edge list
  - confirm they are the same 19 edges, in the same order, with the same screen names (allowing only case and the mapping "Profile select"→profile, "World map"→worldmap, "Game over"→game_over)
  - confirm the prose that claims the bijection is now TRUE
  - confirm no stale reference to an ASCII tree, a "⇄" pair, or "drawn above the tree" survives anywhere in the live documents

W-02 The development bots' prompt-pack cites. `pd-dev-world` must ship IN-017 from `shorepine-kenney.zip!icons/Input Prompts/Generic/` and `…/Keyboard & Mouse/`, and must treat `kenney-cc0-game-art-packs.zip!assets/kenney/input-prompts/` as measured-but-not-shipped. Check EVERY one of the five bots, not just the world bot, for any place where a branded prompt family could be read as the shipping source. Also check the count: the boards claim 590 shipped PNG glyph files (74 Generic + 516 Keyboard & Mouse) and 2,733 files in the branded pack (1,958 PNG). If you can, verify those numbers against the real archives in platformer-docs/library-packs/ (shorepine-kenney.zip and kenney-cc0-game-art-packs.zip) with `unzip -l`. Say clearly if you could not verify them.

W-03 §11.3's heading must be on its own line with **Three id namespaces, never mixed.** as its own lead sentence.

W-04 The published review-round count. The master says the review ran 13 times, in §11.4 and in §13, and the count is now substituted at build time.

W-05 (found during the fix, not in round 13's output) Eight of the §11.2x section titles were each ONE AHEAD of the round their own prose describes, and the ninth round had no record of its own. The titles are now corrected and a §11.2i records the ninth round. Verify:
  - each of the 13 review-round records names the round it holds, in order
  - the ninth round's record claims only what the package can evidence and does NOT fabricate a finding list
  - the master's published count equals the number of review-round records

PART B — CHALLENGE THE FOUR NEW GATES FOR FALSE-PASSES

Round 13 named two classes that no gate covered. Four checks were added. For each, read the code and decide whether it can STILL produce a FALSE PASS. Name the specific input that would slip through.

  G1 (verify_design.py, "flow edge list") compares §7.7.2's edge list against §7.3's table. Can it be fooled by an edge that is present but semantically wrong? By a duplicated line? By a table row whose cell contains two arrows? By a section that renames the heading so the regex misses the block entirely?
  G2 (verify_devbots.py, "bot prose") requires every bot that mentions input prompts to cite the shipping pack, and requires the branded pack to appear near a "not shipped"/"trademark" marker within a 500-character window. Can a wrong shipping cite slip through? Is the 500-char window too tight or too loose? What if a bot cites a DIFFERENT wrong pack entirely?
  G3 (verify_devbots.py, content ownership) now compares SETS of content kinds rather than lengths. Is it still possible for §8.3 and the boards to disagree in a way it misses? Read `content_kind_set_mismatch` and the surrounding code.
  G4 (verify_design.py, "review-round records") requires each §11.2x review-round heading to name the round it holds. Can a title be reworded to evade the ordinal check while still being wrong?

Then check the fault-injection script actually exercises all four with the review's own inputs: tools/fault_inject_hardened.py claims 10/10. Read it and say whether any of the four new injections would pass even if the check were broken — i.e. whether the injection really proves the check bites.

PART C — THE STANDING QUESTION

Round 13's verdict was NOT READY because of W-01 and W-02, and it noted that "neither is covered by the current gates, so a green gate run would not clear them." That reasoning is now addressed by construction.

Answer these directly:
  1. After this round's changes, is the package READY to hand to the five development bots?
  2. Is any requirement (of the 102) still under-specified, contradictory, or unimplementable as written?
  3. Is any published number in the master still wrong, hand-written where it should be measured, or measured where it should be stated?
  4. Are there any statements in the five bots that contradict the boards, the master, or each other?
  5. Name the three things you would still change first if you were the person about to write the first line of code.

The gates were run by the parent process; you are in ask mode and cannot run them. You MAY read the packs with `unzip -l` if you want to verify the asset counts. If you cannot verify something, say so plainly rather than implying success.

Report findings as a table of # / severity / finding / resolution-needed, then the five answers above, then a verdict. Be concrete: cite file and line. Do not praise; report what is wrong or what you could not verify.
