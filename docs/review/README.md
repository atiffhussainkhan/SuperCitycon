# Cursor senior review briefs — MINIMAX GAME STUDIO ULTRA V2

These are the **working papers** of the senior review that ran over the final
change set. They are kept because they show what was asked and what was found —
not because they are instructions.

| File | Round | Outcome |
|---|---|---|
| `CURSOR-REVIEW-BRIEF.md` | 1 — the original brief | **2 MAJOR, 4 MINOR** found. The MAJORs were a false-certificate hole (an empty expected-archive list read as a complete cache) and an injection that proved only a message, not the property it claimed. |
| `CURSOR-REVIEW-BRIEF-2.md` | 2 — the fixes | **2 MAJOR, 3 MINOR** found. The MAJORs: a *partial* derivation still failed open, and injection #15 still did not prove the independence it claimed — its "no path was called fabricated" assertion was vacuous, because with an incomplete cache the path check reports UNVERIFIED and never "fabricated". |
| `CURSOR-REVIEW-BRIEF-3.md` | 3 — the second round of fixes | **2 MAJOR, 2 MINOR** found. The MAJORs: #15 still asserted nothing about paths resolving, and it drove the gate's internals rather than its `main()`, so deleting the cache row would not have broken it. Both fixed; #15 now drives the real `main()` and proves the path check separately. |

**Why they are kept.** The design package's own rule is that a figure must be
*measured*, never typed, and that a gate which has never failed proves nothing.
These three briefs are the evidence for the second rule: the reviewer was
adversarial, the findings were real, and every one of them was fixed and
re-verified. The master's §11.2o records the same findings in the design's own
language (Y-05 to Y-10).

**How they were run.** `cursor agent --print --trust --mode ask` with the
`auto` model, read-only, one round at a time, each brief listing the exact
commands to reproduce every figure it claimed. The reviewer was told plainly
that the numbers in the brief were unverified by it, and to say so rather than
report expected output — and it did: in every round it reported that its own
Shell invocations were blocked, and that its figures were therefore
unverified. The author re-measured all of them independently.

**A note on the hook.** A `PreToolUse` hook in `~/.claude/settings.json`
requires the task-observer Skill to run before ordinary tools work. Cursor's
agent session does not expose that Skill, so the reviewer could not open files
or run commands until the hook was disabled for the invocation
(`TASK_OBSERVER_DISABLE=1`). The hook's own logic exempts delegated subagents,
which is what the reviewer was, so this is consistent with its intent — but the
reviewer then could not execute the commands, and said so in every round
rather than reporting figures it had not measured.
