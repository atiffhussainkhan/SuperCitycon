#!/usr/bin/env python3
"""Fault-inject the five hardened gate checks with the review's own inputs.

The eleventh Cursor review named a specific input for each check that would still
green-light a broken package. This script injects each one, proves the gate now
fails, restores the tree, and proves the gate is green again.

Usage: python3 tools/fault_inject_hardened.py
"""

from __future__ import annotations

import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "platformer-docs"

# The bots travel with the project (`minimax-game/agents/pd-dev-*/agent.md`) and
# are installed under `~/.minimax/agents`. The injections must bite the bots the
# gate actually reads, and they must never edit the repository or the installed
# agents — so they work on a throwaway copy and the gate is pointed at it.
PORTABLE_AGENTS = ROOT / "agents"
INSTALLED_AGENTS = pathlib.Path.home() / ".minimax" / "agents"
SOURCE_AGENTS = PORTABLE_AGENTS if PORTABLE_AGENTS.is_dir() else INSTALLED_AGENTS

BOTS = {
    "pd-dev-platform": "ARCHITECTURE",
    "pd-dev-player": "PLAYER",
    "pd-dev-entities": "ENTITIES",
    "pd-dev-world": "WORLD",
    "pd-dev-assets": "ASSETS",
}


def _make_workspace_agents() -> pathlib.Path:
    """Copy the bots into a throwaway directory the injections may edit."""
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="devbots-inject-"))
    for name in BOTS:
        src = SOURCE_AGENTS / name / "agent.md"
        dst_dir = tmp / name
        dst_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst_dir / "agent.md")
    return tmp


WORK_AGENTS = _make_workspace_agents()


def run(script: str) -> str:
    cmd = [sys.executable, str(ROOT / "tools" / script)]
    if script == "verify_devbots.py":
        cmd += ["--agents-dir", str(WORK_AGENTS)]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    return proc.stdout + proc.stderr


def fails(script: str) -> bool:
    return any(line.startswith("[FAIL]") for line in run(script).splitlines())


def bot(name: str) -> pathlib.Path:
    return WORK_AGENTS / name / "agent.md"


def _cache_blocked_reason() -> str | None:
    """Why the path-dependent injections cannot run, or None if they can."""
    sys.path.insert(0, str(ROOT / "tools"))
    try:
        import pack_cache
        import verify_design as vd
    except Exception as exc:  # pragma: no cover - import guard
        return f"the gate modules could not be imported ({exc})"
    state = pack_cache.cache_state()
    if not state.get("complete"):
        missing = len(state.get("missing") or [])
        return (f"the asset archive cache is incomplete ({missing} archive(s) missing), "
                f"so the cited paths cannot all resolve")
    vd.results = {"FAIL": [], "WARN": [], "PASS": [], "INFO": []}
    try:
        boards = vd.load_boards()
        known, _ = vd.load_inventory()
        vd.check_assets(boards, known, True)
    except Exception as exc:  # pragma: no cover - defensive
        return f"the path check could not run ({exc})"
    resolved = any(ln.startswith("asset paths: all ")
                   for ln in vd.results["PASS"])
    if not resolved:
        first = (vd.results["FAIL"] or ["no path check output"])[0]
        return f"the path check did not resolve every cited path ({first})"
    return None


def main() -> int:
    results: list[tuple[str, bool, str]] = []

    # The asset-path injections mutate the path check, so they can only be
    # proven when every cited path resolves — which needs the archive cache.
    # Without it the harness is BLOCKED, not broken: say so legibly instead of
    # dying with a traceback, and do not publish a figure it did not earn.
    blocked = _cache_blocked_reason()
    if blocked:
        print(f"[BLOCKED] the hardened harness needs the asset archive cache: {blocked}")
        print("        Restore with: bash tools/fetch-3d-packs.sh && "
              "bash tools/fetch-remaining-3d.sh")
        return 2

    def check(label: str, script: str, paths, mutate):
        backup = {p: p.read_text(encoding="utf-8") for p in paths}
        try:
            mutate()
            out = run(script)
            caught = any(line.startswith("[FAIL]") for line in out.splitlines())
            detail = next((ln.strip() for ln in out.splitlines()
                           if ln.startswith("[FAIL]")), "(no FAIL line)")
        finally:
            for p, text in backup.items():
                p.write_text(text, encoding="utf-8")
        green = not fails(script)
        results.append((label, caught and green, detail))
        print(f"[{'PASS' if caught and green else 'FAIL'}] {label}")
        print(f"        caught: {detail[:150]}")

    # 1. acceptance text: the matrix text PLUS a contradicting appendix.
    def m1():
        p = bot("pd-dev-world")
        t = p.read_text(encoding="utf-8")
        # read the LIVE figure so this injection cannot go stale
        m = re.search(r"across all \*\*(\d+)\*\* scene transitions", t)
        if not m:
            raise RuntimeError("the world bot does not publish a transition count")
        live = m.group(1)
        t = t.replace(
            f"across all **{live}** scene transitions in the world board's transition table,",
            f"across all **{live}** scene transitions in the world board's transition "
            f"table (implement against the old 8),", 1)
        p.write_text(t, encoding="utf-8")
    check("AC-text: matrix text + contradicting appendix", "verify_devbots.py",
          [bot("pd-dev-world")], m1)

    # 2. §4.1 containment: a named file the tree does not list.
    def m2():
        p = bot("pd-dev-platform")
        t = p.read_text(encoding="utf-8")
        t = t.replace(
            "src/tools/{validate_schema,launch_checksum,level_linter,world_map_validator}.py",
            "src/tools/{validate_schema,launch_checksum,level_linter,world_map_validator}.py\n"
            "src/tools/evil_extra.py", 1)
        p.write_text(t, encoding="utf-8")
    check("§4.1 containment: a named file the tree does not list", "verify_devbots.py",
          [bot("pd-dev-platform")], m2)

    # 3. content ownership: two boards SWAP a kind. There is still exactly one
    #    owner of every kind, so the cardinality check passes — only the
    #    "is it the right owner" check can catch this.
    def m3():
        p = bot("pd-dev-player")
        t = p.read_text(encoding="utf-8")
        t = t.replace("src/content/characters/**", "src/content/palettes/**", 1)
        p.write_text(t, encoding="utf-8")
        q = bot("pd-dev-world")
        u = q.read_text(encoding="utf-8")
        u = u.replace(
            "src/content/{stages,blocks,objects,worlds,palettes,backgrounds,audio,fx,localisation}/**",
            "src/content/{stages,blocks,objects,worlds,characters,backgrounds,audio,fx,localisation}/**", 1)
        q.write_text(u, encoding="utf-8")
    check("content ownership: two boards swap a kind (one owner each, wrong board)",
          "verify_devbots.py",
          [bot("pd-dev-player"), bot("pd-dev-world")], m3)

    # 4. path namespace: a §4.1 root used without the src/ prefix.
    def m4():
        p = DOCS / "DESIGN-3-ARCHITECTURE.md"
        t = p.read_text(encoding="utf-8")
        t = t.replace("`src/core/rules`", "`core/rules`", 1)
        p.write_text(t, encoding="utf-8")
    check("path namespace: a tree root without the src/ prefix", "verify_design.py",
          [DOCS / "DESIGN-3-ARCHITECTURE.md"], m4)

    # 5. published figures: the builder's placeholder survives forever.
    def m5():
        p = DOCS / "DESIGN-3-MASTER.md"
        t = p.read_text(encoding="utf-8")
        # read the LIVE figure the master publishes, so this injection cannot
        # go stale when a check is added
        m = re.search(r"verify_design\.py` → \*\*0 FAIL, (\d+) PASS\*\*", t)
        if not m:
            raise RuntimeError("the master does not publish a verify_design.py figure")
        live = m.group(1)
        t = t.replace(f"verify_design.py` → **0 FAIL, {live} PASS**",
                      "verify_design.py` → **0 FAIL, @@DESIGN_GATE@@ PASS**", 1)
        p.write_text(t, encoding="utf-8")
    check("published figures: the builder placeholder survives", "verify_design.py",
          [DOCS / "DESIGN-3-MASTER.md"], m5)

    # 6. flow edge list: a table row with no edge line. The eleventh and twelfth
    #    rounds both claimed §7.7.2's graph was a bijection with §7.3's table
    #    while it was not, because no gate compared the two.
    def m6():
        p = DOCS / "DESIGN-3-WORLD.md"
        t = p.read_text(encoding="utf-8")
        if "pause → stage\n" not in t:
            raise RuntimeError("the world board does not publish the edge list")
        t = t.replace("pause → stage\n", "", 1)
        p.write_text(t, encoding="utf-8")
    check("flow edge list: a table row with no edge line", "verify_design.py",
          [DOCS / "DESIGN-3-WORLD.md"], m6)

    # 7. bot prose: the world bot aims IN-017 at the branded, trademark-carrying
    #    prompt pack again. The fourteenth review showed the previous version of
    #    this injection did NOT prove the branch it claimed to: the defect text
    #    left "trademark" and "excluded" next to the branded path, which the old
    #    markers accepted, so the catch came from the stale "2,719" count rather
    #    than from the not-shipped rule. This version is the review's own input:
    #    the branded pack IS the shipping source, the count is the CORRECT 2,733,
    #    "trademark-free" and "excluded" are present, and neither "measured" nor
    #    "not shipped" is. The shorepine citation is left intact elsewhere so
    #    the "must cite the shipping pack" branch cannot be what catches it.
    def m7():
        p = bot("pd-dev-world")
        t = p.read_text(encoding="utf-8")
        start = t.find("**Input prompts — trademark-free families only.**")
        if start == -1:
            raise RuntimeError("the world bot does not publish the prompt-pack rule")
        end = t.find("**Do not add a branded prompt family to the release profile.**",
                     start)
        if end == -1:
            raise RuntimeError("the world bot's prompt-pack rule has no end marker")
        end += len("**Do not add a branded prompt family to the release profile.**")
        defect = (
            "**Input prompts — trademark-free families only.** `IN-017` ships **only** the "
            "`Generic/` and `Keyboard & Mouse/` families of "
            "`kenney-cc0-game-art-packs.zip!assets/kenney/input-prompts/` — **2,733 glyph "
            "files**. Every\n"
            "console-manufacturer-branded family (Nintendo, PlayStation, Xbox, Meta Quest, "
            "Steam Deck,\n"
            "Playdate) is **excluded from the shipped set**. **Do not add a branded prompt "
            "family to the release profile.**")
        t = t[:start] + defect + t[end:]
        p.write_text(t, encoding="utf-8")
    check("bot prose: IN-017 aimed at the branded prompt pack", "verify_devbots.py",
          [bot("pd-dev-world")], m7)

    # 7b. the same defect, but with the old weak markers present and the count
    #     correct — proving the not-shipped rule, not the stale count, bites.
    def m7b():
        p = bot("pd-dev-world")
        t = p.read_text(encoding="utf-8")
        start = t.find("**Input prompts — trademark-free families only.**")
        if start == -1:
            raise RuntimeError("the world bot does not publish the prompt-pack rule")
        end = t.find("**Do not add a branded prompt family to the release profile.**",
                     start)
        if end == -1:
            raise RuntimeError("the world bot's prompt-pack rule has no end marker")
        end += len("**Do not add a branded prompt family to the release profile.**")
        defect = (
            "**Input prompts — trademark-free families only.** `IN-017` ships **only** the "
            "`Generic/` and `Keyboard & Mouse/` families of "
            "`kenney-cc0-game-art-packs.zip!assets/kenney/input-prompts/` — **2,733 glyph "
            "files**. Every\n"
            "console-manufacturer-branded family (Nintendo, PlayStation, Xbox, Meta Quest, "
            "Steam Deck,\n"
            "Playdate) is **excluded from the shipped set**. **Do not add a branded prompt "
            "family to the release profile.**")
        t = t[:start] + defect + t[end:]
        # remove the shorepine citation so the ONLY remaining defect is the
        # branded pack used as the shipping source
        t = t.replace("`shorepine-kenney.zip!icons/Input Prompts/Generic/` (74 PNG) and\n"
                      "  `shorepine-kenney.zip!icons/Input Prompts/Keyboard & Mouse/` "
                      "(516 PNG) — **590 shipped\n  glyph files** — for the rebind UI. ",
                      "for the rebind UI. ")
        p.write_text(t, encoding="utf-8")
    check("bot prose: branded pack shipped with only weak markers", "verify_devbots.py",
          [bot("pd-dev-world")], m7b)

    # 8. the set-equality rule, proven in isolation. The end-to-end path cannot
    #    isolate it — a kind the boards define but §8.3 omits is *also* caught by
    #    the "no owner" rule — so the review's exact abstract input is fed to
    #    the pure function directly: two equal-sized, different kind sets.
    def m8():
        sys.path.insert(0, str(ROOT / "tools"))
        import verify_devbots as vd
        declared = {"stages", "blocks", "scoring"}
        design = {"stages", "blocks", "palettes"}
        if len(declared) != len(design):
            raise RuntimeError("the review's input must be equal-sized")
        diff = vd.content_kind_set_mismatch(declared, design)
        if not diff:
            raise AssertionError("the set-equality rule did not catch the review's input")
        print(f"        input: {sorted(declared)} vs {sorted(design)}")
        print(f"        caught: {diff}")
        return True
    results.append(("content ownership: equal-sized but different kind sets",
                    bool(m8()), "content_kind_set_mismatch reported the difference"))
    print(f"[{'PASS' if results[-1][1] else 'FAIL'}] content ownership: "
          f"equal-sized but different kind sets")
    print(f"        caught: {results[-1][2]}")

    # 9. the edge-bijection rule, proven in isolation with the review's input:
    #    a table row that has no edge line.
    def m9():
        sys.path.insert(0, str(ROOT / "tools"))
        import verify_design as vd
        tbl = [("boot", "title"), ("pause", "stage"), ("any", "boot")]
        graph = [("boot", "title"), ("any", "boot")]
        only_tbl, only_grf = vd.flow_edge_mismatch(tbl, graph)
        if not only_tbl and not only_grf:
            raise AssertionError("the edge rule did not catch the review's input")
        print(f"        input: table has {len(tbl)} rows, graph has {len(graph)} lines")
        print(f"        caught: {only_tbl} missing from the graph, {only_grf} with no row")
        return True
    results.append(("flow edge list: a row with no line, proven in isolation",
                    bool(m9()), "flow_edge_mismatch reported the missing row"))
    print(f"[{'PASS' if results[-1][1] else 'FAIL'}] flow edge list: a row with no line, "
          f"proven in isolation")
    print(f"        caught: {results[-1][2]}")

    # 10. a review-round record whose title names the wrong round. This is the
    #     exact defect the thirteenth review found in the master: eight titles
    #     were each one ahead of the round their own prose describes.
    def m10():
        p = DOCS / "DESIGN-3-MASTER.md"
        t = p.read_text(encoding="utf-8")
        old = "### 11.2 A first review round"
        if old not in t:
            raise RuntimeError("the master does not publish the first review round")
        t = t.replace(old, "### 11.2 A second review round", 1)
        p.write_text(t, encoding="utf-8")
    check("review-round record: a title one ahead of the round it holds",
          "verify_design.py", [DOCS / "DESIGN-3-MASTER.md"], m10)

    # 11. a DUPLICATE edge line. The fourteenth review found the comparison was
    #     a set, not a multiset, so a duplicated line was only a WARN.
    def m11():
        p = DOCS / "DESIGN-3-WORLD.md"
        t = p.read_text(encoding="utf-8")
        if "pause → stage\n" not in t:
            raise RuntimeError("the world board does not publish the edge list")
        t = t.replace("pause → stage\n", "pause → stage\npause → stage\n", 1)
        p.write_text(t, encoding="utf-8")
    check("flow edge list: a duplicated edge line", "verify_design.py",
          [DOCS / "DESIGN-3-WORLD.md"], m11)

    # 12. a malformed table row — a cell holding two arrows. The fourteenth
    #     review found it was silently truncated to the first two tokens.
    def m12():
        p = DOCS / "DESIGN-3-WORLD.md"
        t = p.read_text(encoding="utf-8")
        old = "| Stage → Title |"
        if old not in t:
            raise RuntimeError("the world board's table does not have that row")
        t = t.replace(old, "| Stage → Title → Pause |", 1)
        p.write_text(t, encoding="utf-8")
    check("flow edge list: a table cell holding two arrows", "verify_design.py",
          [DOCS / "DESIGN-3-WORLD.md"], m12)

    # 13. a review-round record that drops the words "review round", which left
    #     the checked set AND shrank the published count at the same time.
    def m13():
        p = DOCS / "DESIGN-3-MASTER.md"
        t = p.read_text(encoding="utf-8")
        old = "### 11.2m A thirteenth review round"
        if old not in t:
            raise RuntimeError("the master does not publish the thirteenth round")
        t = t.replace(old, "### 11.2m The thirteenth round", 1)
        p.write_text(t, encoding="utf-8")
    check("review-round record: a title that drops 'review round'",
          "verify_design.py", [DOCS / "DESIGN-3-MASTER.md"], m13)

    # 14. the asset archive cache is incomplete. The gate resolves 849 cited
    #     paths, 722 of which live inside the pack archives. Before the
    #     cache-completeness check existed, an absent cache made the gate
    #     report "722/849 cited paths do not resolve" and print 41 FAIL lines
    #     naming paths as FABRICATED — a false accusation, because the files
    #     that would have proved them were simply not there to open.
    #     The gate must now report the cache as missing, and must NOT report
    #     the paths as fabricated.
    #
    #     The cache location is redirected to an empty directory, so the 2.4 GB
    #     of real archives are never moved or touched. This injection manages
    #     its own run pair rather than using check()'s file-mutation helper,
    #     because the override has to be LIFTED before the green-after-restore
    #     run — otherwise that run would still see an empty cache and could
    #     not show the tree is clean.
    empty_dir = ROOT / "tools" / "_fault_empty_cache"
    empty_dir.mkdir(parents=True, exist_ok=True)
    env_backup = {k: os.environ.get(k) for k in
                  ("GAMESTUDIO_PACK_CACHE_DIR", "GAMESTUDIO_ASSET_MIRROR")}
    os.environ["GAMESTUDIO_PACK_CACHE_DIR"] = str(empty_dir)
    os.environ["GAMESTUDIO_ASSET_MIRROR"] = str(empty_dir / "mirror")
    try:
        injected_out = run("verify_design.py")
    finally:
        for k, v in env_backup.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    caught = any(ln.startswith("[FAIL]") and "cache is incomplete" in ln
                 for ln in injected_out.splitlines())
    fabricated = [ln for ln in injected_out.splitlines()
                  if ln.startswith("[FAIL]") and "unresolved asset path" in ln]
    detail = next((ln.strip() for ln in injected_out.splitlines()
                   if ln.startswith("[FAIL]")), "(no FAIL line)")
    print(f"        cache reported missing; {len(fabricated)} false fabrications")

    # With the override lifted, the tree must be clean again.
    green_out = run("verify_design.py")
    green = not any(ln.startswith("[FAIL]") for ln in green_out.splitlines())
    try:
        empty_dir.rmdir()
    except OSError:
        pass

    results.append(("asset paths: the archive cache is absent",
                    caught and green and not fabricated, detail))
    print(f"[{'PASS' if caught and green and not fabricated else 'FAIL'}] "
          f"asset paths: the archive cache is absent")
    print(f"        caught: {detail[:150]}")

    # 15. the cache check must be INDEPENDENT of the path check.
    #
    #     Injection 14 proves the cache check bites when the cache is absent
    #     AND many paths stop resolving. It does not prove the claim the
    #     master makes: that the cache check fails **even when every cited
    #     path still resolves**. Without that, a quietly-incomplete cache
    #     could still certify the design — which is the false certificate
    #     Y-02 exists to prevent.
    #
    #     This injection proves it, and it proves it in the two halves that
    #     matter:
    #
    #       (a) the path resolution genuinely SUCCEEDS — proven by running the
    #           real path check with the cache reported as complete, which must
    #           record "all N cited paths resolve". Without this the injection
    #           would be vacuous: with an incomplete cache the path check
    #           reports UNVERIFIED, so "no fabricated path" proves nothing.
    #       (b) the REAL gate, driven through its own `main()`, refuses to
    #           certify when the cache is incomplete — and it must fail ON THE
    #           CACHE. Driving `main()` is what makes this a regression lock:
    #           deleting the cache row from `main()` breaks this injection.
    def m15():
        sys.path.insert(0, str(ROOT / "tools"))
        import pack_cache
        import verify_design as vd

        real_state = pack_cache.cache_state
        real_results = vd.results
        real_argv = sys.argv

        # One archive is missing, everything else is present and readable.
        def patched_state():
            st = dict(real_state())
            if st["expected"]:
                st["missing"] = [st["expected"][0]]
                st["present"] = [a for a in st["present"] if a != st["expected"][0]]
            st["complete"] = False
            return st

        try:
            # (a) the path resolution really does succeed.
            vd.results = {"FAIL": [], "WARN": [], "PASS": [], "INFO": []}
            boards = vd.load_boards()
            known, _ = vd.load_inventory()
            vd.check_assets(boards, known, True)
            path_passes = [ln for ln in vd.results["PASS"]
                           if ln.startswith("asset paths: all ")]
            if not path_passes:
                raise AssertionError(
                    "the cited paths did NOT all resolve, so this injection cannot "
                    f"prove independence; the path check said {vd.results['FAIL'][:2]}")
            resolved = path_passes[0]

            # (b) the real gate, through its own main(), must refuse.
            vd.results = {"FAIL": [], "WARN": [], "PASS": [], "INFO": []}
            pack_cache.cache_state = patched_state
            sys.argv = ["verify_design.py"]
            try:
                import contextlib
                import io
                buf = io.StringIO()
                with contextlib.redirect_stdout(buf):
                    exit_code = vd.main()
            finally:
                sys.argv = real_argv
                pack_cache.cache_state = real_state
            fails = list(vd.results["FAIL"])
            cache_fails = [ln for ln in fails if "cache is incomplete" in ln]
            if not cache_fails:
                raise AssertionError(
                    f"the gate did not fail on the cache; its FAILs were {fails[:3]}")
            if exit_code == 0:
                raise AssertionError("the gate exited 0 with an incomplete cache")
            # The paths must NOT have been called fabricated either.
            fabricated = [ln for ln in fails if "unresolved asset path" in ln]
            if fabricated:
                raise AssertionError(
                    f"the gate called {len(fabricated)} path(s) fabricated while the "
                    f"archives were incomplete")
            print(f"        {resolved} — and the real gate still refused to certify")
            return True, cache_fails[0]
        finally:
            pack_cache.cache_state = real_state
            vd.results = real_results
            sys.argv = real_argv
    ok15, detail15 = m15()
    results.append(("asset cache: incomplete while every path still resolves",
                    bool(ok15), detail15))
    print(f"[{'PASS' if ok15 else 'FAIL'}] "
          f"asset cache: incomplete while every path still resolves")
    print(f"        caught: {detail15[:150]}")

    # 16. the cache check must FAIL CLOSED when the expected archive list
    #     cannot be derived in full. If a fetch script is missing or renamed,
    #     a PARTIAL derivation would make "nothing is missing" read as a
    #     complete cache — a certificate for a cache nobody fully checked.
    def m16():
        sys.path.insert(0, str(ROOT / "tools"))
        import pack_cache
        real_scripts = pack_cache.fetch_scripts
        # Only ONE script is missing: the other still yields a non-empty list,
        # so this is the partial-derivation hole, not the empty one.
        pack_cache.fetch_scripts = lambda: [real_scripts()[0],
                                            "_no_such_fetch_script_b.sh"]
        try:
            ok, msg = pack_cache.check_cache_complete()
            expected_now = pack_cache.expected_archives()
        finally:
            pack_cache.fetch_scripts = real_scripts
        if ok:
            raise AssertionError(
                f"the cache check certified a PARTIAL derivation "
                f"({len(expected_now)} archives from one surviving script)")
        if "could not be derived in full" not in msg:
            raise AssertionError(
                f"the failure does not say the list could not be derived in full: "
                f"{msg[:120]}")
        if "_no_such_fetch_script_b.sh" not in msg:
            raise AssertionError(
                f"the failure does not name the unusable script: {msg[:120]}")
        print(f"        one fetch script missing ({len(expected_now)} archives still "
              f"derived) -> refused to certify")
        return True, msg
    ok16, detail16 = m16()
    results.append(("asset cache: the expected list cannot be derived",
                    bool(ok16), detail16))
    print(f"[{'PASS' if ok16 else 'FAIL'}] "
          f"asset cache: the expected list cannot be derived")
    print(f"        caught: {detail16[:150]}")

    # 17. a fetch script that exists but lists NO archives is just as unusable
    #     as a missing one: the archives it was meant to contribute are
    #     invisible to the cache check. The derivation must refuse.
    def m17():
        sys.path.insert(0, str(ROOT / "tools"))
        import pack_cache
        real_scripts = pack_cache.fetch_scripts
        # A script that EXISTS but lists no archives. It has to really exist,
        # otherwise the check reports it as missing — a different hole.
        empty = ROOT / "tools" / "_fault_empty_fetch.sh"
        empty.write_text("#!/usr/bin/env bash\n# no fetch calls here\n", encoding="utf-8")
        pack_cache.fetch_scripts = lambda: [real_scripts()[0], empty.name]
        try:
            ok, msg = pack_cache.check_cache_complete()
        finally:
            pack_cache.fetch_scripts = real_scripts
            try:
                empty.unlink()
            except OSError:
                pass
        if ok:
            raise AssertionError(
                "the cache check certified a derivation from a script that lists "
                "no archives")
        if "lists no archives" not in msg:
            raise AssertionError(
                f"the failure does not say the script lists no archives: {msg[:120]}")
        print(f"        a fetch script that lists no archives -> refused to certify")
        return True, msg
    ok17, detail17 = m17()
    results.append(("asset cache: a fetch script lists no archives",
                    bool(ok17), detail17))
    print(f"[{'PASS' if ok17 else 'FAIL'}] "
          f"asset cache: a fetch script lists no archives")
    print(f"        caught: {detail17[:150]}")

    print()
    bad = [r for r in results if not r[1]]
    total = len(results)
    print(f"=== {total - len(bad)}/{total} hardened checks bite ===")

    # The master publishes this figure. Check it against this run, so the
    # published number cannot say "5/5" while the script runs ten.
    master_path = DOCS / "DESIGN-3-MASTER.md"
    if master_path.exists():
        m = re.search(r"reports \*\*(\d+)/(\d+)\*\* caught", master_path.read_text())
        if not m:
            print(f"[FAIL] published figure: the master does not publish the "
                  f"fault-injection count")
            bad.append(("published figure", False, "absent"))
        elif (m.group(1), m.group(2)) != (str(total - len(bad)), str(total)):
            print(f"[FAIL] published figure: the master publishes "
                  f"{m.group(1)}/{m.group(2)} but this run produced "
                  f"{total - len(bad)}/{total}")
            bad.append(("published figure", False, "mismatch"))
        else:
            print(f"[PASS] published figure: the master publishes {total}/{total}, "
                  f"which is what this run produced")
    shutil.rmtree(WORK_AGENTS, ignore_errors=True)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
