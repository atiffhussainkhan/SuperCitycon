#!/usr/bin/env python3
"""The state of the asset archive cache, and the set of archives the design needs.

The 3D design cites **849 asset paths**, and 722 of them live inside the pack
archives rather than in the repository's own inventory files. Verifying those
paths therefore requires the archives to be present.

That made a missing cache look like a broken design. Before this module
existed, a deleted or unfetched cache made the asset check report "722/849
cited paths do not resolve to a repository file" and then print **41 FAIL lines**
naming individual paths as if they were fabricated — the header, plus the first
forty, plus a count of the rest. They were not fabricated — they were simply
**unverifiable**, because the files that would prove they exist were not there
to be opened.

So the cache state is now measured and reported separately from the path check:

  * `expected_archives()` — the archives the design needs, derived from the
    fetch scripts rather than typed by hand. A hand-written list would drift
    the first time a pack was added, exactly as the published gate figures
    drifted before they were made measured.
  * `cache_state()` — which of those archives are actually present and readable.
  * `check_cache_complete()` — the gate check itself, which FAILS with one
    legible message when the cache cannot support a verification, and PASSes
    when it can.

The rule the design has always followed is that a figure must be measured, not
typed. A missing archive cache is exactly the case where that matters most: the
honest statement is "the cited paths are UNVERIFIED because the archives are
absent", never "the cited paths are fabricated".

Usage:  python3 tools/pack_cache.py       # prints the state, exits 0/1
"""

from __future__ import annotations

import os
import re
import sys
import zipfile
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parent.parent
DOCS = WORKSPACE / "platformer-docs"

# The archive cache normally lives inside the design package. The override lets
# a machine keep it elsewhere, and lets the fault-injection harness simulate a
# missing cache without moving 2.4 GB of archives around.
PACKS = Path(os.environ.get("GAMESTUDIO_PACK_CACHE_DIR") or (DOCS / "library-packs"))

# The scripts that populate the cache. Each line is
#     fetch "<release-tag>" "<archive-name>.zip"
# so the archive names can be read straight out of the scripts.
#
# The set of scripts is DISCOVERED, not typed. A hard-coded tuple would go
# stale the moment a third fetch script is added, and the omitted script's
# archives would then be invisible to the cache check — the same false
# certificate as an empty or partial derivation.
FETCH_SCRIPT_GLOB = "fetch-*.sh"
FETCH_LINE = re.compile(r'^fetch\s+"[^"]+"\s+"([^"]+\.zip)"', re.MULTILINE)
# Any `fetch` call at all, whether or not it matches FETCH_LINE. Used to
# detect a call site the parser cannot read.
ANY_FETCH_CALL = re.compile(r'^\s*fetch\s+', re.MULTILINE)


def fetch_scripts() -> list[str]:
    """The fetch scripts that exist, discovered from the tools directory."""
    return sorted(p.name for p in (WORKSPACE / "tools").glob(FETCH_SCRIPT_GLOB))


def derivation_problems() -> list[str]:
    """Why the expected-archive list could not be derived in full.

    A **partial** derivation is as dangerous as an empty one. If a fetch
    script is missing or has stopped matching, the others still yield a
    non-empty list, and the cache check would then certify "all 8 expected
    archives present" while half the intended fetch set was invisible to it.
    So every script must contribute, or the derivation is not usable.

    A call site the parser cannot read counts as a contribution that cannot
    be verified, so it is a problem too.
    """
    problems: list[str] = []
    for script in fetch_scripts():
        path = WORKSPACE / "tools" / script
        if not path.exists():
            problems.append(f"{script} is missing")
            continue
        text = path.read_text(encoding="utf-8")
        found = FETCH_LINE.findall(text)
        if not found:
            problems.append(f"{script} lists no archives")
            continue
        calls = len(ANY_FETCH_CALL.findall(text))
        if calls != len(found):
            problems.append(
                f"{script} has {calls - len(found)} fetch call(s) whose archive "
                f"name the parser cannot read")
    if not fetch_scripts():
        problems.append(f"no {FETCH_SCRIPT_GLOB} script was found in tools/")
    return problems


def expected_archives() -> list[str]:
    """The archives the design's cited paths need, derived from the fetch scripts.

    Derived rather than typed: a hand-written list drifts the moment a pack is
    added or renamed, and a stale list would report the cache as complete when
    it is not — which is precisely the failure this module exists to prevent.

    An EMPTY or PARTIAL result is a failure, not a vacuous success. If a fetch
    script is missing, renamed, or stops matching `FETCH_LINE`, the derivation
    yields less than the full fetch set, and "nothing is missing" would certify
    a cache that was never fully checked. `check_cache_complete()` therefore
    refuses to certify unless every script contributes.
    """
    names: set[str] = set()
    for script in fetch_scripts():
        path = WORKSPACE / "tools" / script
        if not path.exists():
            continue
        names.update(FETCH_LINE.findall(path.read_text(encoding="utf-8")))
    return sorted(names)


def local_mirror() -> Path:
    """The user's shared asset mirror, if it exists. A fallback, never a dependency."""
    return Path(os.environ.get("GAMESTUDIO_ASSET_MIRROR")
                or (Path.home() / ".minimax" / "asset-library" / "packs"))


def cache_state() -> dict:
    """Measure which expected archives are present and readable.

    An archive counts as present only if it can actually be opened. A truncated
    or corrupt download is not a cache; treating it as one would let the gate
    certify paths it never checked.
    """
    expected = expected_archives()
    present: list[str] = []
    unreadable: list[str] = []
    missing: list[str] = []

    for name in expected:
        found = False
        for root in (PACKS, local_mirror()):
            zp = root / name
            if not zp.exists():
                continue
            try:
                with zipfile.ZipFile(zp) as z:
                    z.namelist()
            except (zipfile.BadZipFile, OSError):
                unreadable.append(name)
                found = True
                break
            present.append(name)
            found = True
            break
        if not found:
            missing.append(name)

    # Extra archives present but not required by the fetch scripts are not an
    # error — they are local additions (e.g. quaternius-animated-mech.zip).
    extras = sorted(
        p.name for p in PACKS.glob("*.zip") if p.name not in set(expected)
    )

    return {
        "expected": expected,
        "present": present,
        "missing": missing,
        "unreadable": unreadable,
        "extras": extras,
        # An empty OR PARTIAL derivation is NOT a complete cache. If a fetch
        # script cannot be read, the gate has no idea what the cache should
        # contain, and "nothing is missing" would be a certificate for nothing.
        "derivable": not derivation_problems(),
        "derivation_problems": derivation_problems(),
        "complete": (not derivation_problems()) and not missing and not unreadable,
        "packs_dir": PACKS,
    }


def check_cache_complete() -> tuple[bool, str]:
    """The gate check. Returns (ok, message).

    The message names what is missing and how to restore it, because the whole
    point is that a reader must be able to tell an unverifiable design from a
    broken one without reading hundreds of lines of noise.
    """
    st = cache_state()

    if not st["derivable"]:
        problems = "; ".join(st["derivation_problems"]) or "the fetch scripts did not match"
        return False, (
            f"asset archive cache: the expected archive list could not be derived in "
            f"full from {', '.join(fetch_scripts()) or 'no fetch script'} — {problems}. "
            f"The cache therefore "
            f"cannot be checked completely, and this run certifies nothing about "
            f"asset path resolution. Restore the scripts, or point "
            f"GAMESTUDIO_PACK_CACHE_DIR at the archive cache."
        )

    if st["complete"]:
        return True, (f"asset archive cache: all {len(st['expected'])} expected "
                      f"archives are present and readable")

    parts: list[str] = []
    if st["missing"]:
        parts.append(f"{len(st['missing'])} missing")
    if st["unreadable"]:
        parts.append(f"{len(st['unreadable'])} unreadable")

    detail = ""
    if st["missing"]:
        detail = ("; missing: " + ", ".join(st["missing"][:8])
                  + ("..." if len(st["missing"]) > 8 else ""))
    if st["unreadable"]:
        detail += ("; unreadable: " + ", ".join(st["unreadable"][:8])
                   + ("..." if len(st["unreadable"]) > 8 else ""))

    return False, (
        f"asset archive cache: the cache is incomplete ({', '.join(parts)}){detail}. "
        f"The cited asset paths are UNVERIFIED, not fabricated — this check cannot "
        f"certify path resolution while the archives are absent. "
        f"Restore with: bash tools/fetch-3d-packs.sh && bash tools/fetch-remaining-3d.sh"
    )


def main() -> int:
    ok, msg = check_cache_complete()
    print(("[PASS] " if ok else "[FAIL] ") + msg)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
