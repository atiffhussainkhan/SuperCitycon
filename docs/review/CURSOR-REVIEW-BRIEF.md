# Cursor senior review brief — MINIMAX GAME STUDIO ULTRA V2 (final handover)

Review the **final change set** for the Game Studio ULTRA V2 project at
`/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace`.

Work in **read-only mode**. Do NOT edit, create or delete any project file.
Report findings only.

---

## 1. What this project is

Two sub-projects:

- **`game/`** — *SuperCitycon v1.0.0*, a playable Vite + Three.js city-builder
  web game. Real source, real build, real tests, real running app.
- **`minimax-game/`** — the **LANTERNWAKE** 3D **design-only** package.
  102 requirements, 5 board documents, 5 development bots, 4 executable gates.
  **There is no game code** — it is a design package that a team would implement.

## 2. The change set you must review (this is the focus)

The last piece of unfinished work was a **legible failure path** in the design
package's asset-path gate. Files to review, in order of importance:

| File | Status | What changed |
|---|---|---|
| `minimax-game/tools/pack_cache.py` | **NEW** | Measures the asset archive cache state. Derives the expected archive set from the fetch scripts rather than a hand-typed list. |
| `minimax-game/tools/verify_design.py` | MODIFIED | `check_assets()` now distinguishes *fabricated path* from *unverifiable path*. A new cache-completeness check runs as its own gate check. |
| `minimax-game/tools/fault_inject_hardened.py` | MODIFIED | Added injection #14, proving the new cache check bites and that no path is falsely called fabricated. |
| `minimax-game/platformer-docs/DESIGN-3-MASTER.md` | REGENERATED | Published gate figures re-measured by the builder (`build_master.py`), not typed. |

### The defect being fixed (this is the acceptance criterion)

722 of the 849 cited asset paths live **inside** the pack archives rather than in
the repository's own inventory files. Before this change, an absent or unfetched
archive cache made the gate:

- report `"722/849 cited paths do not resolve to a repository file"`, and
- print **41 further lines** naming individual paths as if they were **fabricated**.

They were not fabricated. The files that would have proved they existed were
simply not present to be opened. A missing cache looked identical to a broken
design, and 721 lines of noise buried the one fact that mattered.

**Required behaviour now:**

1. When the cache is incomplete → **one** legible FAIL naming the missing
   archives and how to restore them; the paths are described as **UNVERIFIED**,
   never as fabricated.
2. When the cache is complete → the original strict behaviour: any cited path
   that does not resolve IS a fabricated-path FAIL, listed individually.
3. The cache check is its **own** gate check — it must fail even if every cited
   path happens to resolve, because a quietly-incomplete cache is a false
   certificate waiting to happen.
4. The expected archive list is **derived from the fetch scripts**
   (`tools/fetch-3d-packs.sh`, `tools/fetch-remaining-3d.sh`), never typed by
   hand, so it cannot drift.

## 3. Measured evidence (all figures below were actually observed)

- With the cache present: `verify_design.py` → **0 FAIL, 31 PASS, 5 INFO**;
  all 849 cited paths resolve.
- With the cache absent: **3 FAIL, 28 PASS, 14 INFO** — the cache FAIL, the
  "unverified" FAIL, and the published-figure FAIL. **Zero** paths reported as
  fabricated. Before the fix the same state produced 41 FAIL lines.
- `audit_depth.py` → **102/102 requirements implementable**.
- `verify_devbots.py` → **0 FAIL, 13 PASS**.
- `fault_inject_hardened.py` → **15/15 caught** (14 before this change).
- `build_master.py` is byte-for-byte idempotent: rebuilding produces an
  identical master.
- The **local asset mirror** (`~/.minimax/asset-library/packs`) contributes
  **nothing** to path resolution: with the workspace cache present and the
  mirror absent, all 849 paths still resolve. The mirror is a fallback, never a
  dependency.

## 4. Commands to reproduce (run them; do not trust the numbers above)

```bash
cd /Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace/minimax-game
python3 tools/verify_design.py
python3 tools/audit_depth.py
python3 tools/verify_devbots.py
python3 tools/fault_inject_hardened.py
python3 tools/build_master.py        # must be idempotent
python3 tools/pack_cache.py
```

To simulate an absent cache **without** moving 2.4 GB of archives:

```bash
GAMESTUDIO_PACK_CACHE_DIR=/tmp/empty GAMESTUDIO_ASSET_MIRROR=/tmp/empty/mirror \
  python3 tools/verify_design.py
```

## 5. What I want from you

Senior-developer review, prioritised:

1. **Correctness of the new logic.** Is the derived-archive-set approach sound?
   Can the cache check be fooled into passing when it should fail? Are the
   environment overrides (`GAMESTUDIO_PACK_CACHE_DIR`, `GAMESTUDIO_ASSET_MIRROR`)
   handled consistently by every consumer?
2. **Does the new check preserve the guarantee it replaced?** The old code
   failed loudly on fabricated paths. Confirm the new code still does, and that
   the "unverifiable" branch cannot be used to hide a genuinely fabricated path.
   Specifically: could a *real* fabricated path be silently excused because the
   cache happens to be incomplete? Consider that the board documents and the
   fetch scripts are under my control.
3. **Any hole in injection #14** — does it actually prove what it claims, or
   does it pass vacuously?
4. **Regressions** in the four gate scripts and in `build_master.py`.
5. Anything in the wider change set (the `game/` release, the deploy workflow
   fix, the portability work) that you can see is wrong.

Please report concrete findings with file, line, severity (MAJOR / MINOR / INFO),
and the reasoning. Say explicitly if you find nothing in a category — I need to
know the difference between "checked and clean" and "not checked". Call out any
figure you believe is wrong or unverified.

**Do not** fix anything yourself — report only.
