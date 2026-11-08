# Cursor re-review brief (round 3) — MINIMAX GAME STUDIO ULTRA V2

Third pass on the **same change set** as `CURSOR-REVIEW-BRIEF.md` and
`CURSOR-REVIEW-BRIEF-2.md`, after round 2's findings were fixed.

Repository:
`/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace`

Work in **read-only mode**. Do NOT edit, create or delete any project file.
Report findings only.

---

## 1. Round 2's findings, and what was done

### Y-07 (your MAJOR) — injection #15 proved only the message, not the property → **FIXED**

You were right, and it was the sharpest of the round-2 findings: #15 stubbed
`cache_state` and called only `check_cache_complete()`, so it never resolved a
path and never ran the gate.

#15 now runs the **real gate in process**:
`load_boards()` → `load_inventory()` → `check_cache_complete()` →
`check_assets(boards, known, cache_ok)` → the cache row is recorded exactly as
`verify_design.main()` records it. The patched `cache_state()` reports **one
archive missing** while the real archives are all present.

It asserts three things:
1. `cache_ok` is False — the check refused to certify;
2. **no** `unresolved asset path` FAIL — every cited path still resolved, so
   the injection really does exercise the independence case;
3. the cache failure **is** among the gate's FAILs — the gate refused *on the
   cache*, not on a path.

Output from the run:

```
one archive missing, all 386666 paths resolving -> the gate still refused to certify
[FAIL] asset archive cache: the cache is incomplete (1 missing); missing:
       01-characters.zip. The cited asset paths are UNVERIFIED, not fabricated …
```

Note: while rewriting it, the injection **caught a bug in my own first
version** — the cache FAIL is recorded in `main()`, not inside `check_assets`,
so the first rewrite asserted against an empty FAIL list and raised. It now
mirrors `main()` exactly.

### Y-09 (your MAJOR) — partial derivation still failed open → **FIXED**

You were right: one surviving script still yielded 8 archives, `derivable` was
True, and the check could certify "all 8 expected archives present" while half
the fetch set was invisible.

`pack_cache.py` gained `derivation_problems()`, which requires **every** fetch
script to exist *and* to list at least one archive. `cache_state()` now carries
`derivable` and `derivation_problems`, and `complete` requires a clean
derivation. The message names the unusable script.

Injection #16 was rewritten to cover exactly this case — **one** script removed,
the other still yielding archives:

```
one fetch script missing (8 archives still derived) -> refused to certify
[FAIL] asset archive cache: the expected archive list could not be derived in
       full from fetch-3d-packs.sh, _no_such_fetch_script_b.sh — …
```

### Y-12 (your MINOR) — 721 vs 722 drift → **FIXED, with the two claims separated**

Your observation was right, and the two numbers were measuring different things.
Measured directly:

| Condition | Unverifiable |
|---|---|
| Workspace cache absent, shared mirror **absent** | **722 / 849** |
| Workspace cache absent, shared mirror **present** (this machine) | **721 / 849** |

One cited model is held by the shared mirror, which is why this machine sees
721. The canonical figure is now **722** everywhere, with 721 named explicitly
as the mirror-present case:

- `docs/MAC-PORTABILITY.md` (three places)
- `docs/release/RECOVERY.md`
- `docs/release/REMAINING-ISSUES.md`

The master's §11.2o now carries **Y-08**, stating both figures and the
one-path difference, so the two claims can no longer be quoted
interchangeably.

### Y-13 (your MINOR) — stale "721 lines of noise" comment → **FIXED**

`tools/verify_design.py:314` now says **41 FAIL lines**, matching the
reconstructed old output.

### Y-14 (your MINOR) — the master overstated what #15 proves → **FIXED**

§11.2o now says #15 "runs the real gate in process with the cache state
reporting one archive missing while every cited path still resolves, and
requires the gate to fail **on the cache** and not on a path", and it records
that the first version of the injection proved only the message.

## 2. Files changed since round 2

| File | Change |
|---|---|
| `minimax-game/tools/pack_cache.py` | `derivation_problems()`; `derivable` + `derivation_problems` in `cache_state()`; `complete` requires a clean derivation; message names the unusable script |
| `minimax-game/tools/verify_design.py` | comment corrected to "41 FAIL lines" |
| `minimax-game/tools/fault_inject_hardened.py` | #15 rewritten to run the real gate end to end; #16 rewritten to cover the **partial** derivation |
| `minimax-game/tools/build_master.py` | §11.2o gains Y-07 and Y-08, and the corrected #15/#16 prose |
| `minimax-game/platformer-docs/DESIGN-3-MASTER.md` | regenerated (measured figures) |
| `docs/MAC-PORTABILITY.md`, `docs/release/RECOVERY.md`, `docs/release/REMAINING-ISSUES.md` | 721/722 reconciled |

## 3. Current measured state — please re-verify these yourself

```bash
cd /Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace/minimax-game
python3 tools/verify_design.py        # expect: 0 FAIL, 0 WARN, 31 PASS, 5 INFO
python3 tools/audit_depth.py          # expect: 102/102 requirements implementable
python3 tools/verify_devbots.py       # expect: 0 FAIL, 0 WARN, 13 PASS
python3 tools/fault_inject_hardened.py # expect: 17/17 hardened checks bite
python3 tools/pack_cache.py           # expect: PASS, 22 expected archives present
python3 tools/build_master.py         # expect: byte-identical master (idempotent)
```

Empty-cache simulation, without touching the 2.4 GB cache:

```bash
mkdir -p /tmp/emptycache4
GAMESTUDIO_PACK_CACHE_DIR=/tmp/emptycache4 GAMESTUDIO_ASSET_MIRROR=/tmp/emptycache4/m \
  python3 tools/verify_design.py   # expect: 3 FAIL, 28 PASS, 14 INFO; zero "unresolved asset path" FAILs
```

## 4. What I want from you this round

1. **Is the partial-derivation hole now closed?** Is there any way
   `derivable` can be True while the fetch set is not fully known?
2. **Does #15 now prove what it claims?** It runs the real gate in process
   rather than a subprocess — is that a faithful test of the gate, or does
   driving `main()`'s internals from the harness risk proving something the
   shipped gate does not do? Does it still catch a regression if someone later
   removes the separate cache row from `main()`?
3. **Is any published figure still wrong?** The master's §11.2o, the
   `pack_cache.py` docstring, `verify_design.py`'s comments, and the four
   documentation files. I have now been wrong about one figure twice, so
   please check every number in the documents against what the code does.
4. **Any regression** in the four gate scripts, `build_master.py`, or the fetch
   scripts.

Report concrete findings with file, line, severity and reasoning. **State
explicitly which categories you checked and found clean.** If you cannot run a
command, say so plainly rather than reporting its expected output.

**Do not** fix anything yourself — report only.
