# Cursor re-review brief — MINIMAX GAME STUDIO ULTRA V2 (round 2)

Second review pass on the **same change set** as `CURSOR-REVIEW-BRIEF.md`, after
your first review's findings were fixed.

Repository:
`/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace`

Work in **read-only mode**. Do NOT edit, create or delete any project file.
Report findings only.

---

## 1. What you found last time, and what was done about it

Your review raised **2 MAJOR** and **4 MINOR** findings. Each is addressed below.
Your numbers were re-measured by the author, not assumed.

### Y-05 (your MAJOR) — empty expected set ⇒ false "complete" → **FIXED**

You were right, and this was a false-certificate hole I introduced. Reproduced
first, then fixed:

```
# before the fix
expected with no scripts: []
check_cache_complete -> True
MSG: asset archive cache: all 0 expected archives are present and readable
```

`tools/pack_cache.py` now treats an empty derivation as a hard FAIL:

```
# after the fix
FAIL-CLOSED on empty derivation -> ok: False
MSG: asset archive cache: the expected archive list could not be derived from
_nope_a.sh, _nope_b.sh — the fetch scripts are missing or no longer match. The
cache therefore cannot be checked at all, and this run certifies nothing about
asset path resolution.
```

`cache_state()` gained a `derivable` key; `complete` is now
`bool(expected) and not missing and not unreadable`.

### Y-07 (your MAJOR) — injection #14 did not prove Y-02 → **FIXED**

Correct: #14 only exercised the case where many paths also stopped resolving.
Two further injections now prove the two properties separately:

- **Injection #15** stubs the cache state so **one** archive is missing while
  **every** cited path still resolves, and asserts the check still refuses to
  certify — and names the missing archive.
- **Injection #16** stubs the fetch scripts away entirely and asserts the check
  fails closed on an empty derivation (the Y-05 hole).

Both are in `tools/fault_inject_hardened.py`. The suite now reports **17/17**.

### Y-08 (your MINOR) — "721 further lines" was wrong → **FIXED**

You were right; I had overstated it. I reconstructed the old output exactly:

```
OLD OUTPUT WOULD BE:
  1 header FAIL + 40 detail FAIL lines = 41 FAIL lines
  + 1 INFO line ('... and 682 more')
  unresolved = 722/849
```

The old gate printed **41 FAIL lines** (1 header + the first 40 + a count of the
rest), not 721. Corrected in `tools/pack_cache.py`'s docstring and in the
master's §11.2o row Y-01.

### Y-09 (your MINOR) — dead `cache_msg` parameter → **FIXED**

`check_assets(boards, known, cache_ok, cache_msg)` → `check_assets(boards, known, cache_ok)`.

### Y-10 (your MINOR) — fetch scripts hard-coded an absolute path → **FIXED**

Both `tools/fetch-3d-packs.sh` and `tools/fetch-remaining-3d.sh` now derive
their destination from `${BASH_SOURCE[0]}`; an explicit argument still
overrides it.

### Y-11 (your MAJOR) — `docs/MAC-PORTABILITY.md` still described the pre-fix
gate → **FIXED**

Updated: the gate figures, the fault-injection count, and the absent-cache
section now describe the UNVERIFIED behaviour and quote the actual failure
output.

### Your MINOR — packs cited outside the fetch scripts are not cache-gated → **MEASURED**

You asked me to check this. Measured, across all board documents:

| Measure | Count |
|---|---|
| Archive names cited anywhere in the boards | 51 |
| Cited together with a member path the gate actually resolves (excluding failing-example rows) | 25 |
| …of those, present in the workspace cache | 16 |
| …of those, present in the shared mirror only | 9 |
| …of those, available in **neither** | **0** |
| Cited only in manifest / size / excluded-pack context (no member path resolved against them) | 26 |

So every archive whose member path the gate resolves is available somewhere,
and the 9 mirror-resident ones still resolve when the mirror is present — which
is why the earlier measurement showed all 849 paths resolving with an empty
mirror. The cache check gates on the fetch-script set (the set the cache is
*built* from, 22 archives); the path check separately proves every cited path
against the archives actually open. The numbers are now published in the
master's §11.2o.

---

## 2. Files changed since your last review

| File | Change |
|---|---|
| `minimax-game/tools/pack_cache.py` | empty derivation now fails closed; `derivable` key; "721 lines" → "41 FAIL lines" |
| `minimax-game/tools/verify_design.py` | dead parameter removed |
| `minimax-game/tools/fault_inject_hardened.py` | injections #15 and #16 added |
| `minimax-game/tools/fetch-3d-packs.sh` | destination derived from script location |
| `minimax-game/tools/fetch-remaining-3d.sh` | destination derived from script location |
| `minimax-game/tools/build_master.py` | §11.2o extended with Y-05/Y-06 and the archive-coverage measurement |
| `minimax-game/platformer-docs/DESIGN-3-MASTER.md` | regenerated (measured figures) |
| `docs/MAC-PORTABILITY.md` | updated to post-fix behaviour |

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
mkdir -p /tmp/emptycache3
GAMESTUDIO_PACK_CACHE_DIR=/tmp/emptycache3 GAMESTUDIO_ASSET_MIRROR=/tmp/emptycache3/m \
  python3 tools/verify_design.py       # expect: 3 FAIL, 28 PASS, 14 INFO; zero "unresolved asset path" FAILs
```

## 4. What I want from you this round

1. **Are the fixes correct?** Specifically: does the fail-closed derivation
   have any remaining hole (a path where `expected` is empty but `complete` is
   still True)? Does injection #15 actually prove independence, or does it
   stub away the thing it claims to test?
2. **Did fixing these introduce any regression** in the four gate scripts,
   `build_master.py`, or the fetch scripts?
3. **Is anything still misstated in prose** — the master's §11.2o, the
   `pack_cache.py` docstring, or `docs/MAC-PORTABILITY.md`? I have already
   found one overstated figure of my own, so please check the numbers in the
   documents against what the code actually does.
4. **Anything in the wider change set** (the `game/` release, the deploy
   workflow fix, the release packaging) that is wrong.

Report concrete findings with file, line, severity and reasoning. **State
explicitly which categories you checked and found clean** — I need to know the
difference between "checked and clean" and "not checked". If you cannot run a
command, say so plainly rather than reporting its expected output.

**Do not** fix anything yourself — report only.
