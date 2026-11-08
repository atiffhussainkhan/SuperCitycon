#!/usr/bin/env python3
"""
verify_design.py — cross-board verification for the 3D platformer master design.

Checks, in order:
  1. REQUIREMENT COVERAGE  — all 102 REQ ids + 10 NFRs appear across the board docs.
  2. ASSET PATH RESOLUTION — every repository path cited in the design resolves to a
     real file (inventory file or a fetched pack listing). Fabricated paths fail.
  3. CONSTANT CONFLICTS    — the same named parameter with different values in two
     different board documents is a contradiction.
  4. IP LEAKAGE            — reference-game names must not appear as shipped content.
  5. PROCEDURAL-ART WORDS — the design must not ask for generated geometry.

Usage:  python3 tools/verify_design.py [--json]
Exit:   0 = all gates pass, 1 = at least one FAIL.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pack_cache  # noqa: E402  (local module, resolved from this file's directory)

WORKSPACE = Path(__file__).resolve().parent.parent
DOCS = WORKSPACE / "platformer-docs"
INV = DOCS / "library-inventory"
# The archive cache location is resolved in one place, so the path check and
# the cache-completeness check can never disagree about where it is.
PACKS = pack_cache.PACKS

BOARDS = {
    "ASSETS": DOCS / "DESIGN-3-ASSETS.md",
    "PLAYER": DOCS / "DESIGN-3-PLAYER.md",
    "ENTITIES": DOCS / "DESIGN-3-ENTITIES.md",
    "WORLD": DOCS / "DESIGN-3-WORLD.md",
    "ARCHITECTURE": DOCS / "DESIGN-3-ARCHITECTURE.md",
}

ALL_REQ = (
    [f"REQ-A-{i:03d}" for i in range(1, 22)]
    + [f"REQ-B-{i:03d}" for i in range(1, 22)]
    + [f"REQ-C-{i:03d}" for i in range(1, 21)]
    + [f"REQ-D-{i:03d}" for i in range(1, 21)]
    + [f"REQ-E-{i:03d}" for i in range(1, 21)]
)
ALL_NFR = [f"NFR-{i:02d}" for i in range(1, 11)]

# Reference-game names. Legitimate uses are research tags ("derived from the SMB1
# shell archetype"). The check flags them only in SHIPPED-CONTENT phrasing.
IP_TERMS = [
    "Mario", "Luigi", "Goomba", "Koopa", "Koopalings", "Bowser", "Boo ", "Dry Bones",
    "Thwomp", "Bullet Bill", "Cheep", "Blooper", "Piranha", "Paratroopa", "Buzzy",
    "Hammer Bro", "Lakitu", "Spiny", "Podoboo", "Shy Guy", "Snifit", "Ninji", "Phanto",
    "Bob-omb", "Albatoss", "Ostro", "Autobomb", "Porcupo", "Flurry", "Birdo", "Mouser",
    "Triclyde", "Fryguy", "Clawgrip", "Wart", "Yoshi", "Monty Mole", "Rex ", "Wiggler",
    "Magikoopa", "Banzai Bill", "Reznor", "Dino", "Mechakoopa", "Ninji", "Wart",
    "Toad", "Peach", "Koopaling", "Fire Flower", "Super Star", "Fire Ball",
]

PROCEDURAL_WORDS = [
    "procedurally generated", "procedural geometry", "generate the mesh",
    "procedural texture", "runtime-generated texture", "shader character",
    "placeholder mesh", "generate a sprite", "procedurally generated texture",
    "noise-based texture", "mathematically generated", "generate geometry",
]

results: dict[str, list[str]] = {
    "FAIL": [],
    "WARN": [],
    "PASS": [],
    "INFO": [],
}


def rec(level: str, msg: str) -> None:
    results[level].append(msg)


# --------------------------------------------------------------------------- #
# Load
# --------------------------------------------------------------------------- #
def load_boards() -> dict[str, str]:
    out = {}
    for name, path in BOARDS.items():
        if path.exists():
            out[name] = path.read_text(encoding="utf-8", errors="replace")
        else:
            out[name] = ""
            rec("FAIL", f"{name}: deliverable missing -> {path}")
    return out


def load_inventory() -> tuple[set[str], dict[str, list[str]]]:
    """Return (known asset paths, pack file listings)."""
    known: set[str] = set()
    for inv_file, prefix in (
        ("kenney-3d-paths.txt", "shorepine-kenney/3d/"),
        ("kenney-2d-paths.txt", "shorepine-kenney/2d/"),
        ("kenney-icon-paths.txt", "shorepine-kenney/icons/"),
    ):
        p = INV / inv_file
        if p.exists():
            for line in p.read_text().splitlines():
                if line.strip():
                    known.add(prefix + line.strip())

    ui = INV / "kenney-ui-index.txt"
    if ui.exists():
        for line in ui.read_text().splitlines():
            if "\t" in line:
                known.add(line.split("\t")[0])

    tsv = INV / "shorepine-kenney" / "index.tsv"
    if tsv.exists():
        for line in tsv.read_text(errors="replace").splitlines()[1:]:
            if "\t" in line:
                known.add(line.split("\t")[0])

    # Every file inside every fetched pack, and the pack-relative path form.
    pack_files: dict[str, list[str]] = {}
    pack_roots = [PACKS]
    local_mirror = pack_cache.local_mirror()
    if local_mirror.exists():
        pack_roots.append(local_mirror)
    for root in pack_roots:
        for zp in sorted(root.glob("*.zip")):
            try:
                with zipfile.ZipFile(zp) as z:
                    names = [n for n in z.namelist() if not n.endswith("/")]
            except (zipfile.BadZipFile, OSError) as e:
                rec("WARN", f"pack unreadable: {zp.name} ({e})")
                continue
            pack_files[zp.name] = names
            known.update(names)
            # also the basename form, for citations that omit the pack folder
            for n in names:
                known.add(os.path.basename(n))
                # and the dotted shorthand form used by some boards:
                # "kenney.platformer.star.glb" -> platformer/star.glb
                parts = n.split("/")
                if len(parts) >= 2:
                    known.add(".".join(parts[-2:]))
                # and the kit-relative form: platformer/star.glb
                for prefix in ("shorepine-kenney/3d/", "shorepine-kenney/2d/",
                               "shorepine-kenney/ui/", "shorepine-kenney/icons/"):
                    if n.startswith(prefix):
                        known.add(n[len(prefix):])

    # 3D model index: model file names from the catalogue
    idx = INV / "3d-models-index.json"
    if idx.exists():
        for line in idx.read_text().splitlines():
            if not line.strip():
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            f = r.get("file")
            if f:
                known.add(f"{f}.glb")
                known.add(f)
                known.add(r.get("name", ""))
                # pack-qualified basename forms
                pack = (r.get("pack") or "").replace(".zip", "")
                known.add(f"{pack}.{f}.glb")
    return known, pack_files


# --------------------------------------------------------------------------- #
# 1. Requirement coverage
# --------------------------------------------------------------------------- #
def check_requirements(boards: dict[str, str]) -> None:
    combined = "\n".join(boards.values())
    missing_req = [r for r in ALL_REQ if r not in combined]
    missing_nfr = [n for n in ALL_NFR if n not in combined]
    if missing_req:
        rec("FAIL", f"requirement coverage: {len(missing_req)} REQ ids absent: "
                    + ", ".join(missing_req))
    else:
        rec("PASS", f"requirement coverage: all {len(ALL_REQ)} REQ ids cited")
    if missing_nfr:
        rec("FAIL", f"requirement coverage: {len(missing_nfr)} NFR ids absent: "
                    + ", ".join(missing_nfr))
    else:
        rec("PASS", f"requirement coverage: all {len(ALL_NFR)} NFR ids cited")

    for name, text in boards.items():
        if not text:
            continue
        hits = len(set(re.findall(r"REQ-[A-E]-\d{3}", text)))
        rec("INFO", f"{name}: cites {hits} distinct REQ ids")

    # every board doc must end each owned requirement with an acceptance test
    for name, text in boards.items():
        if not text:
            continue
        if not re.search(r"acceptance test|AC:|acceptance", text, re.I):
            rec("FAIL", f"{name}: no acceptance-test language found")


# --------------------------------------------------------------------------- #
# 2. Asset path resolution
# --------------------------------------------------------------------------- #
ASSET_FILE = re.compile(
    r"[A-Za-z0-9_][A-Za-z0-9_.&\-]*"
    r"(?: [A-Za-z0-9_][A-Za-z0-9_.&\-]*)*"
    r"\.(?:glb|gltf|png|jpg|jpeg|svg|hdr|ttf|ogg|wav|flac|mtlx|tres|usdc|blend|fbx|obj)"
)
# A row that deliberately demonstrates a REJECTED asset is not a design claim.
FAILING_EXAMPLE = re.compile(
    r"(failing example|rejected example|counter-example|invalid example|"
    r"example of a failure|negative example|ASSET-PATH-404|ASSET-NOT-FOUND|"
    r"not present in pack|path .* not found|does not exist in pack)", re.I)


def candidates(path: str) -> list[str]:
    """Alternative resolvable spellings of a cited path."""
    out = {path, os.path.basename(path)}
    base = os.path.basename(path)
    if "." in base:
        tail = base.split(".")[-2:]          # e.g. star.glb
        kit = base.split(".")[-3:-2]         # e.g. platformer
        if kit:
            out.add(f"{kit}.{tail[0]}")
            out.add(f"{kit}/{tail[0]}")
        out.add(tail[0])
    # drop a leading vendor token from a dotted form: kenney.platformer.star.glb
    parts = path.split(".")
    if len(parts) >= 4:
        out.add(".".join(parts[-3:]))
        out.add(".".join(parts[-2:]))
    # a kit-prefixed form: yellow/building_x.gltf -> <kit>/yellow/building_x.gltf
    if "/" in path:
        tail = path.split("/")[-1]
        for kit in ("platformer", "cube-pets", "blocky-characters", "mini-characters",
                    "prototype", "graveyard", "nature", "castle", "space", "factory",
                    "building", "pirate", "survival", "hexagon", "blaster", "mini-market",
                    "mini-dungeon", "mini-forest", "modular-space", "modular-dungeon",
                    "holiday", "weapon", "food", "furniture", "tower-defense",
                    "tower-defense-classic", "retro-fantasy", "retro-urban",
                    "fantasy-town", "space-station", "modular-cave", "modular-buildings",
                    "mini-arena", "mini-arcade", "mini-skate", "car", "train",
                    "watercraft", "coaster", "toy-car", "road", "brick", "marble",
                    "racing", "toy-car", "city-commercial", "city-industrial",
                    "city-roads", "city-suburban", "castle", "watercraft"):
            out.add(f"{kit}/{tail}")
    return [c for c in out if c]


def tail_variants(path: str) -> list[str]:
    """Successively shorter suffixes of a path that contains spaces."""
    words = path.split(" ")
    return [" ".join(words[i:]) for i in range(len(words))]


def check_assets(boards: dict[str, str], known: set[str], cache_ok: bool) -> None:
    checked = unresolved = 0
    bad: list[str] = []
    for name, text in boards.items():
        if not text:
            continue
        cited = set()
        skip_lines = set()
        for ln, line in enumerate(text.splitlines()):
            if FAILING_EXAMPLE.search(line):
                skip_lines.add(ln)
                continue
            for m in ASSET_FILE.finditer(line):
                start = m.start()
                # a template placeholder like <scene>_1k.hdr is not a claim
                if start > 0 and line[start - 1] in "<{[":
                    continue
                # the tail of a placeholder, e.g. "<scene>_1k.hdr"
                if start > 0 and line[start - 1] == ">":
                    continue
                # a range or elision, e.g. "character-a…r.glb"
                if start > 0 and line[start - 1] == "\u2026":
                    continue
                if "\u2026" in m.group(0):
                    continue
                cited.add(m.group(0))
        for ln, line in enumerate(text.splitlines()):
            if ln in skip_lines:
                for m in ASSET_FILE.finditer(line):
                    cited.discard(m.group(0))
        for path in sorted(cited):
            if path.endswith("/"):
                continue
            checked += 1
            forms: list[str] = []
            for v in tail_variants(path):
                forms.extend(candidates(v))
            if any(c in known for c in forms):
                continue
            unresolved += 1
            bad.append(f"{name}: {path}")
    if not unresolved:
        rec("PASS", f"asset paths: all {checked} cited paths resolve to repository files")
        return

    # A cited path that does not resolve is only evidence of a FABRICATED path
    # if the archives that would prove it exists were available to be opened.
    # When the cache is incomplete the honest statement is that the paths are
    # UNVERIFIED — reporting them one by one as fabricated is both untrue and
    # unreadable, and 41 FAIL lines of noise buries the one fact that matters.
    if not cache_ok:
        rec("FAIL", f"asset paths: {unresolved}/{checked} cited paths are UNVERIFIED "
                    f"because the archives that would prove them are absent — they are "
                    f"not known to be fabricated, and this run does not certify path "
                    f"resolution either way")
        # Name a handful so a reader can see the shape of the gap without
        # drowning in it. The full set is reconstructible from the cache check.
        for b in bad[:8]:
            rec("INFO", f"  unverified (cache absent) -> {b}")
        if len(bad) > 8:
            rec("INFO", f"  ... and {len(bad) - 8} more unverified paths")
        return

    rec("FAIL", f"asset paths: {unresolved}/{checked} cited paths do not resolve "
                f"to a repository file")
    for b in bad[:40]:
        rec("FAIL", f"  unresolved asset path -> {b}")
    if len(bad) > 40:
        rec("INFO", f"  ... and {len(bad) - 40} more")


# --------------------------------------------------------------------------- #
# 3. Constant conflicts across boards
# --------------------------------------------------------------------------- #
# A numeric parameter line:  | `param_name` | value | ...  or  param_name: value
PARAM_RE = re.compile(
    r"^\s*(?:[-*]\s*)?\|?\s*`?(?P<name>[A-Za-z][A-Za-z0-9_.\-]{2,48})`?\s*"
    r"(?:\[[^\]]*\])?\s*[:=]\s*"
    r"(?P<val>-?\d+(?:\.\d+)?)\s*(?P<unit>[a-zA-Z%°/]*)\b",
    re.M,
)
# Also table rows:  | `param` | 12 | m/s |
TABLE_RE = re.compile(
    r"^\s*\|[^|]*`(?P<name>[A-Za-z][A-Za-z0-9_.\-]{2,48})`[^|]*\|[^|]*?"
    r"(?P<val>-?\d+(?:\.\d+)?)\s*(?P<unit>[a-zA-Z%°/]*)\s*\|",
    re.M,
)


def check_constants(boards: dict[str, str]) -> None:
    seen: dict[str, dict[str, list[tuple[str, float, str]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for name, text in boards.items():
        if not text:
            continue
        for rx in (PARAM_RE, TABLE_RE):
            for m in rx.finditer(text):
                pname = m.group("name").strip().lower()
                unit = (m.group("unit") or "").strip().lower()
                try:
                    val = float(m.group("val"))
                except ValueError:
                    continue
                # ignore obvious non-tuning numbers: years, ids, counts of things
                if unit in ("", "id", "s", "ms", "hz", "fps", "%"):
                    # "s"/"ms"/"hz" are meaningful; bare numbers are not
                    if unit == "":
                        continue
                if re.search(r"(19|20)\d{2}$", pname):
                    continue
                seen[pname][unit].append((name, val, unit))

    conflicts = []
    for pname, byunit in seen.items():
        for unit, entries in byunit.items():
            boards_involved = {e[0] for e in entries}
            if len(boards_involved) < 2:
                continue  # a conflict only matters across boards
            vals = {round(e[1], 6) for e in entries}
            if len(vals) > 1:
                conflicts.append(
                    (pname, unit, sorted(vals), sorted(boards_involved))
                )

    if conflicts:
        rec("FAIL", f"constant conflicts: {len(conflicts)} parameter(s) given "
                    f"different values in different boards")
        for pname, unit, vals, boards_involved in conflicts[:40]:
            rec("FAIL", f"  `{pname}` ({unit or 'unitless'}) = {vals} in {boards_involved}")
    else:
        rec("PASS", "constant conflicts: no cross-board parameter disagreement")


# --------------------------------------------------------------------------- #
# 4. IP leakage
# --------------------------------------------------------------------------- #
SHIPPED_CONTEXT = re.compile(
    r"(?:name(?:d|s)?\s+(?:it\s+)?(?:the\s+)?|call(?:ed)?\s+(?:the\s+)?|"
    r"player\s+character\s+(?:is|named)|enemy\s+(?:is|named)|boss\s+(?:is|named)|"
    r"avatar\s+(?:is|named)|ship(?:ped)?\s+(?:as|named)|label(?:l?ed)?\s+)"
    r"[^.\n]{0,40}",
    re.I,
)


def check_ip(boards: dict[str, str]) -> None:
    leaks = []
    for name, text in boards.items():
        if not text:
            continue
        for line in text.splitlines():
            if not any(t.lower() in line.lower() for t in IP_TERMS):
                continue
            # a research tag is fine when the line marks it as a reference
            if re.search(r"reference|research tag|archetype deriv|derives from|"
                         r"research label|not (?:a|the) (?:nintendo|name)|"
                         r"original analogue|behavioural|precedent|tag only|"
                         r"never ship|do not ship|not in the shipped|"
                         r"reference-only|research-only", line, re.I):
                continue
            if SHIPPED_CONTEXT.search(line):
                leaks.append(f"{name}: {line.strip()[:160]}")
    if leaks:
        rec("FAIL", f"IP leakage: {len(leaks)} line(s) name reference-game IP as "
                    f"shipped content")
        for l in leaks[:25]:
            rec("FAIL", f"  {l}")
    else:
        rec("PASS", "IP leakage: reference-game names appear only as research tags")


# --------------------------------------------------------------------------- #
# 5. Procedural-art language
# --------------------------------------------------------------------------- #
def check_procedural(boards: dict[str, str]) -> None:
    hits = []
    for name, text in boards.items():
        if not text:
            continue
        current_heading = ""
        prev_line = ""
        for line in text.splitlines():
            hm = re.match(r"^#{1,6}\s+(.*)$", line)
            if hm:
                current_heading = hm.group(1)
                prev_line = ""
                continue
            low = line.lower()
            for w in PROCEDURAL_WORDS:
                if w not in low:
                    continue
                # a prohibition — either stated in the line or in the line
                # before it (markdown often wraps the negation onto its own line)
                ctx = low + " " + prev_line.lower()
                if re.search(r"forbid|never|not allowed|prohibited|must not|\bno\b|"
                             r"\bnot\b|rather than|instead of|cannot|ban|reject|"
                             r"violation|enforce|block|excluded|"
                             r"this is authoring|not permitted", ctx):
                    continue
                if re.search(r"forbidden|not allowed|prohibited|permitted transform|"
                             r"may not|must not|disallow", current_heading, re.I):
                    continue
                hits.append(f"{name}: {line.strip()[:160]}")
            prev_line = line
    if hits:
        rec("FAIL", f"procedural art: {len(hits)} line(s) request generated visuals")
        for h in hits[:20]:
            rec("FAIL", f"  {h}")
    else:
        rec("PASS", "procedural art: no request for generated visuals")


# --------------------------------------------------------------------------- #
# 6. Decision coherence
# --------------------------------------------------------------------------- #
# Three review rounds found the same class of defect: a decision was taken in one
# board and still contradicted, or still re-opened as a question, in another. The
# earlier gates could not see this — they compared numbers and paths, not decisions.
# This gate closes that hole.
#
# A decision row is a table row naming a tracked decision id. It is "open" when it
# still asks somebody to choose something and is not marked closed.
DECISION_ID = re.compile(r"\*\*((?:W-OPEN|CB|OPEN|BLOCKED|GAP-A\d+|G)-\d+)")
ASKS = re.compile(
    r"(choose\s*\(?[a-c]\)?|name the |apply deltas|confirm\b|acknowledge|"
    r"approve\b|provide the |align the wording|commission\b|re-scope|"
    r"smallest decision needed)", re.I)
CLOSED = re.compile(r"(CLOSED|RESOLVED|ADOPTED|decision taken|optional, not blocking)", re.I)

# A cross-board callout is the decision id quoted in bold at the head of a
# blockquote or a register row: **CB-01**, **W-OPEN-03**, **BLOCKED-P-01** …
CALLOUT_ID = re.compile(r"\*\*`?((?:W-OPEN|CB|OPEN|BLOCKED)(?:-[A-Z])?-?\d+)`?")

# Question forms, matched narrowly. A closed callout may legitimately name a
# board ("the value for WORLD is X"); only an actual request for a decision
# counts as an open question.
BODY_ASK = re.compile(
    r"(smallest decision|needs? to be decided|should be decided|"
    r"must be decided|pending sign-?off|to be decided|is still open|"
    r"remains open|awaiting (?:a |the )?(?:decision|answer|confirmation)|"
    r"who decides|to be (?:chosen|selected|picked|confirmed)\b)", re.I)

# The only decisions that are legitimately still open, with the reason each one
# needs a human. Adding an entry here is a deliberate act; the gate fails on any
# open decision that is NOT on this list, so a board cannot quietly re-open a
# question that another board already answered.
DECLARED_OPEN = {
    "OPEN-002": "web release target — the host's COOP/COEP limits need the requester",
    "OPEN-005": "rights review before any public distribution",
}

# Console-manufacturer-branded prompt families. Kenney's CC0 covers the art, not
# the trademarks, and this project ships original IP only.
BRANDED_PROMPT_DIRS = [
    "PlayStation Series", "Xbox Series", "Nintendo Switch", "Gamecube", "Wii",
    "Meta Quest", "Steam Deck", "Playdate",
]


def decision_rows(text: str):
    for ln, line in enumerate(text.splitlines(), 1):
        if not line.startswith("|"):
            continue
        for did in DECISION_ID.findall(line):
            yield ln, did, line


def strip_review_history(text: str) -> str:
    """Remove the master's §11.2…§11.3 review-history block.

    That block is a changelog: it quotes superseded wording deliberately, in
    order to record what was fixed. It is a record, not a specification, so
    checks for live references to stale tokens skip it.
    """
    start = text.find("### 11.2 ")
    end = text.find("### 11.3 ")
    if start == -1 or end == -1 or end <= start:
        return text
    return text[:start] + text[end:]


def check_decision_coherence(boards: dict[str, str], master: str) -> None:
    # 6a — undeclared open decisions
    undeclared, stale_registry = [], []
    for name, text in boards.items():
        for ln, did, line in decision_rows(text):
            is_open = bool(ASKS.search(line)) and not CLOSED.search(line)
            if is_open and did not in DECLARED_OPEN:
                undeclared.append(f"{name}:{ln} {did} — {line.strip()[:150]}")
            elif not is_open and did in DECLARED_OPEN and CLOSED.search(line):
                stale_registry.append(f"{name}:{ln} {did} is now closed but is still "
                                      f"registered as open")
    if undeclared:
        rec("FAIL", f"decision coherence: {len(undeclared)} open decision(s) that no "
                    f"board owns and that are not on the declared-open register")
        for u in undeclared[:20]:
            rec("FAIL", f"  {u}")
    else:
        rec("PASS", f"decision coherence: every open decision is declared "
                    f"({len(DECLARED_OPEN)} legitimately open: "
                    f"{', '.join(sorted(DECLARED_OPEN))})")
    for s in stale_registry:
        rec("WARN", f"decision coherence: {s}")

    # 6b — one authored camera dead-zone rectangle across every document
    zone_rx = re.compile(r"deadzone\s*\[?\s*(\d+)\s*,\s*(\d+)\s*\]?", re.I)
    zones: dict[str, set[str]] = defaultdict(set)
    corpus = dict(boards)
    corpus["MASTER"] = master
    for name, text in corpus.items():
        for m in zone_rx.finditer(text):
            zones[name].add(f"[{m.group(1)},{m.group(2)}]")
    all_zones: set[str] = set()
    for vals in zones.values():
        all_zones |= vals
    if len(all_zones) > 1:
        rec("FAIL", f"camera dead zone: {len(all_zones)} different values published "
                    f"({sorted(all_zones)}) — one authored rectangle only")
        for name, vals in sorted(zones.items()):
            rec("FAIL", f"  {name}: {sorted(vals)}")
    else:
        rec("PASS", f"camera dead zone: one authored rectangle "
                    f"{sorted(all_zones)[0] if all_zones else 'n/a'} across all documents")

    # 6c — no console-branded prompt family in a shipped manifest row
    assets = boards.get("ASSETS", "")
    shipped_brand: list[str] = []
    for ln, line in enumerate(assets.splitlines(), 1):
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 8:
            continue
        if not re.search(r"SHIPPABLE", cells[-1]):
            continue
        # The path columns are checked strictly: a shipped row's path must never
        # point at branded art. The description is checked separately and may
        # mention a brand only to exclude it.
        path_col = " | ".join(cells[3:5])
        desc = cells[1]
        for brand in BRANDED_PROMPT_DIRS:
            if brand.lower() in path_col.lower():
                shipped_brand.append(
                    f"ASSETS:{ln} {cells[0]} points at the {brand!r} family")
        if re.search(r"(exclud|removed|not ship|withdraw|does not ship|"
                     r"unbranded|trademark-free)", desc, re.I):
            continue
        for brand in BRANDED_PROMPT_DIRS:
            if brand.lower() in desc.lower():
                shipped_brand.append(
                    f"ASSETS:{ln} {cells[0]} advertises the {brand!r} family")
    if shipped_brand:
        rec("FAIL", f"trademark safety: {len(shipped_brand)} shipped manifest row(s) "
                    f"reference a console-manufacturer-branded family")
        for b in shipped_brand:
            rec("FAIL", f"  {b}")
    else:
        rec("PASS", "trademark safety: no shipped manifest row references a "
                    "console-branded prompt family")

    # 6d — manifest row counts must add up and match the published figures
    counts: dict[str, int] = defaultdict(int)
    row_ids: dict[str, str] = {}
    for line in assets.splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 8:
            continue
        status = cells[-1].strip("*` ").upper()
        if status in ("SHIPPABLE", "PENDING", "GAP", "DERIVED", "OUT_OF_SCOPE"):
            counts[status] += 1
            row_ids[cells[0]] = status
    total = sum(counts.values())
    published_total = re.search(
        r"Total manifest rows\s*\*?\*?\s*\|\s*\*\*(\d+)\*\*", assets)
    if not published_total:
        rec("FAIL", "manifest counts: the ASSETS board publishes no total manifest "
                    "row count")
    elif int(published_total.group(1)) != total:
        rec("FAIL", f"manifest counts: ASSETS publishes {published_total.group(1)} "
                    f"total rows but the tables contain {total}")
    else:
        pub_rx = re.compile(r"^\|\s*`([A-Z_]+)`\s*\|\s*\*\*(\d+)\*\*\s*\|", re.M)
        published = {m.group(1): int(m.group(2))
                     for m in pub_rx.finditer(assets)
                     if m.group(1) in ("SHIPPABLE", "PENDING", "DERIVED",
                                        "OUT_OF_SCOPE", "GAP")}
        bad = []
        if not published:
            bad.append("the published status table cannot be parsed")
        else:
            for status in ("SHIPPABLE", "PENDING", "DERIVED", "OUT_OF_SCOPE", "GAP"):
                want = counts.get(status, 0)
                got = published.get(status)
                if got is None:
                    bad.append(f"the published table has no {status} row")
                elif got != want:
                    bad.append(f"{status}: published {got}, tables contain {want}")
            if sum(published.values()) != total:
                bad.append(f"the published statuses sum to {sum(published.values())}, "
                           f"not {total}")
        m_counts = re.search(
            r"\*\*(\d+) rows — (\d+) `SHIPPABLE`, (\d+) `PENDING`"
            r"(?:, (\d+) `DERIVED`)?(?:, (\d+) `OUT_OF_SCOPE`)?, (\d+) `GAP`\*\*",
            master)
        if not m_counts:
            bad.append("the master document publishes no manifest status breakdown")
        else:
            g = m_counts.groups()
            mp = [int(g[1]), int(g[2]), int(g[3] or 0), int(g[4] or 0), int(g[5])]
            if mp != [counts["SHIPPABLE"], counts["PENDING"], counts.get("DERIVED", 0),
                      counts.get("OUT_OF_SCOPE", 0), counts["GAP"]]:
                bad.append(f"the master publishes {mp}, the tables contain "
                           f"{[counts['SHIPPABLE'], counts['PENDING'], counts.get('DERIVED', 0), counts.get('OUT_OF_SCOPE', 0), counts['GAP']]}")
        if bad:
            rec("FAIL", f"manifest counts: {len(bad)} mismatch(es)")
            for b in bad:
                rec("FAIL", f"  {b}")
        else:
            rec("PASS", f"manifest counts: {total} rows — "
                        f"{counts['SHIPPABLE']} shippable, {counts['PENDING']} pending, "
                        f"{counts.get('DERIVED', 0)} derived, "
                        f"{counts.get('OUT_OF_SCOPE', 0)} out of scope, "
                        f"{counts['GAP']} gap — and every published figure agrees")

    # 6e — every non-shippable row must be covered by an adopted decision
    gaps = re.split(r"\n###\s+(G-\d+)", assets)
    decided: dict[str, str] = {}
    for i in range(1, len(gaps) - 1, 2):
        gid, block = gaps[i], gaps[i + 1]
        if "ADOPTED" in block:
            for rid in re.findall(r"\b(AU-\d{3})\b", block):
                decided[rid] = gid
    uncovered = [f"{rid} ({status})" for rid, status in row_ids.items()
                 if status in ("GAP", "DERIVED", "OUT_OF_SCOPE") and rid not in decided]
    if uncovered:
        rec("FAIL", f"decision coherence: {len(uncovered)} non-shippable manifest row(s) "
                    f"have no ADOPTED decision in the asset board's gap register")
        for u in uncovered:
            rec("FAIL", f"  {u}")
    else:
        rec("PASS", f"decision coherence: every non-shippable manifest row is covered "
                    f"by an adopted decision ({len(decided)} rows covered)")


    # 6g — resolved audio vocabulary must be consistent across every document
    # The master's §11.2…§11.3 is a changelog that quotes superseded wording on
    # purpose; it is a record, not a specification, so live-reference checks
    # skip it. The count check below still reads the whole master.
    stale_audio: list[str] = []
    for name, text in corpus.items():
        if name == "MASTER":
            text = strip_review_history(text)
        for ln, line in enumerate(text.splitlines(), 1):
            low = line.lower()
            # the counter was renamed when the ambience beds became DERIVED
            if "ambience_cues_unsourced" in low:
                stale_audio.append(f"{name}:{ln} still uses the counter "
                                   f"'ambience_cues_unsourced'")
            # a three-way cue resolution is no longer correct — there are four
            if "none of the three" in low or "one of three things" in low:
                stale_audio.append(f"{name}:{ln} still describes a three-way cue "
                                   f"resolution")
            if re.search(r"ambience.{0,40}\bUNSOURCED\b", line) and \
               "not" not in low and "derived" not in low:
                stale_audio.append(f"{name}:{ln} describes ambience as UNSOURCED")
    if stale_audio:
        rec("FAIL", f"audio vocabulary: {len(stale_audio)} stale reference(s) to the "
                    f"pre-G-06 ambience treatment")
        for s in stale_audio:
            rec("FAIL", f"  {s}")
    else:
        rec("PASS", "audio vocabulary: ambience is DERIVED everywhere and the "
                    "cue-resolution rule has four outcomes in every document")

    # 6h — the CI status enum must list every status the manifest can carry
    enum_ok = re.search(
        r"`status`\s*∈\s*\{[^}]*`SHIPPABLE`[^}]*`PENDING`[^}]*`DERIVED`"
        r"[^}]*`OUT_OF_SCOPE`[^}]*`GAP`[^}]*\}", assets)
    if not enum_ok:
        rec("FAIL", "asset CI: the manifest status enum in the CI steps does not "
                    "list all five statuses {SHIPPABLE, PENDING, DERIVED, "
                    "OUT_OF_SCOPE, GAP}")
    else:
        rec("PASS", "asset CI: the manifest status enum lists all five statuses")

    # 6j — published measured counts must agree across every document
    # The audio corpus, the damage-source enum and the player capsule all had
    # two live values at once. Each is checked here against the measured truth.
    count_bad: list[str] = []

    # 6j-1 — audio: 78 paths / 66 unique / 52 shipped .ogg, one story everywhere
    audio_variants = {
        "78 shipped SFX": "the 52 shipped `.ogg`",
        "78 files, and there is no music": "the 78-path/66-unique/52-shipped form",
        "shipped SFX by randomised": "the 52 shipped `.ogg`",
    }
    for name, text in corpus.items():
        if name == "MASTER":
            text = strip_review_history(text)
        for phrase, why in audio_variants.items():
            if phrase in text:
                count_bad.append(f"{name}: says '{phrase}' ({why})")
    if "52 unique sounds" not in corpus.get("ASSETS", "") and \
       "52 `.ogg` ship" not in corpus.get("ASSETS", ""):
        count_bad.append("ASSETS: does not publish the 52-shipped-`.ogg` figure")
    if count_bad:
        rec("FAIL", f"published counts: {len(count_bad)} disagreement(s) about the "
                    f"audio corpus")
        for c in count_bad:
            rec("FAIL", f"  {c}")
    else:
        rec("PASS", "published counts: the audio corpus is published as 78 paths / "
                    "66 unique sounds / 52 shipped `.ogg` everywhere")

    # A line that records what a document *used* to say is history, not a live
    # claim. "ARCH said '7 damage sources'" is correct and must stay in the
    # record; "the matrix enumerates 7 damage sources" is a defect.
    HISTORICAL = re.compile(
        r"\b(said|used to|previously|formerly|corrected|has since|now says|"
        r"was|were|old clause|no longer|once said)\b", re.I)

    # 6j-2 — the damage-source enum has nine members, everywhere
    for name, text in corpus.items():
        if name == "MASTER":
            text = strip_review_history(text)
        lines = text.splitlines()
        for i, line in enumerate(lines):
            # a historical marker may sit on the previous line — these
            # references routinely wrap across a line break
            window = (lines[i - 1] + " " + line) if i else line
            if HISTORICAL.search(window):
                continue
            for m in re.finditer(r"(\d+)\s+damage sources?", line):
                if m.group(1) != "9":
                    count_bad.append(f"{name}: says '{m.group(1)} damage sources' "
                                     f"(the 3D translation defines nine)")
    # 6j-3 — one player capsule
    for name, text in corpus.items():
        if name == "MASTER":
            text = strip_review_history(text)
        lines = text.splitlines()
        for i, line in enumerate(lines):
            window = (lines[i - 1] + " " + line) if i else line
            if HISTORICAL.search(window):
                continue
            for m in re.finditer(r"capsule is \*\*?([0-9.]+)\s*[×x]\s*([0-9.]+)", line):
                count_bad.append(f"{name}: publishes the player capsule as "
                                 f"{m.group(1)} × {m.group(2)} (it is radius 0.35 m, "
                                 f"height 1.75 m)")
    if count_bad:
        rec("FAIL", f"published counts: {len(count_bad)} disagreement(s) about a "
                    f"measured constant")
        for c in count_bad:
            rec("FAIL", f"  {c}")
    else:
        rec("PASS", "published counts: the damage-source enum (9) and the player "
                    "capsule (radius 0.35 m, height 1.75 m) agree across all documents")

    # 6k — vocabulary that an example may teach but the enum does not contain
    vocab_bad: list[str] = []
    arch_text = corpus.get("ARCHITECTURE", "")
    # the archetype example's resistance map and activation value
    for m in re.finditer(r'"resistances"\s*:\s*\{[^}]*"(\w+)"\s*:', arch_text):
        if m.group(1) in ("fire", "burn", "flame", "lava"):
            vocab_bad.append(f"ARCHITECTURE: the archetype example uses the "
                             f"non-enum resistance {m.group(1)!r}")
    for m in re.finditer(r'"sleep"\s*:\s*"([^"]+)"', arch_text):
        if m.group(1) not in ("camera", "never", "always", "region"):
            vocab_bad.append(f"ARCHITECTURE: the archetype example uses the "
                             f"non-enum activation value {m.group(1)!r}")
    # the hazard cardinality: the requirement names six kinds, the roster eleven
    # archetypes. Only the REQ-C-013 acceptance clause is checked — a content
    # catalogue may legitimately count stage interactive objects instead.
    for name, text in corpus.items():
        if name == "MASTER":
            text = strip_review_history(text)
        for line in text.splitlines():
            if not line.startswith("| REQ-C-013 |"):
                continue
            for m in re.finditer(r"(\d+)\s+hazards?\b", line):
                if m.group(1) not in ("6", "11"):
                    vocab_bad.append(f"{name}: the REQ-C-013 acceptance clause says "
                                     f"'{m.group(1)} hazards' — the requirement names "
                                     f"6 kinds and the roster has 11 archetypes")
    if vocab_bad:
        rec("FAIL", f"example vocabulary: {len(vocab_bad)} place(s) where an example "
                    f"or a count contradicts the binding enum")
        for v in vocab_bad:
            rec("FAIL", f"  {v}")
    else:
        rec("PASS", "example vocabulary: the archetype example and the hazard "
                    "cardinality agree with the binding enums")

    # 6l — the audio corpus is published as one triple, and the broken
    # enumerations are forbidden. This is deliberately narrow: a fuzzy
    # "do these numbers sum" rule false-positives on per-cue variant counts
    # in the manifest, and a gate that cries wolf is a gate that gets ignored.
    arith_bad: list[str] = []
    FORBIDDEN_AUDIO = [
        "36 FLAC", "24 FLAC", "78 files split", "78** files split",
        "24 FLAC + 24 OGG",
    ]
    for name, text in corpus.items():
        if name == "MASTER":
            text = strip_review_history(text)
        for ln, line in enumerate(text.splitlines(), 1):
            # a line that quotes the superseded figure in order to correct it
            # is history, not a live claim
            if re.search(r"\bnot\b|correct|superseded|survey", line, re.I):
                continue
            for bad in FORBIDDEN_AUDIO:
                if bad in line:
                    arith_bad.append(f"{name}:{ln} contains the superseded audio "
                                     f"enumeration {bad!r}")
    # every document that talks about the corpus must publish the same numbers
    for name, text in corpus.items():
        if name == "MASTER":
            text = strip_review_history(text)
        if re.search(r"audio corpus|the entire audio", text, re.I):
            if "66 unique" not in text and "66 unique sounds" not in text:
                arith_bad.append(f"{name}: discusses the audio corpus but never "
                                 f"publishes the 66 unique sounds")
            if not re.search(r"52", text):
                arith_bad.append(f"{name}: discusses the audio corpus but never "
                                 f"publishes the 52 shipped `.ogg`")
    if arith_bad:
        rec("FAIL", f"audio arithmetic: {len(arith_bad)} disagreement(s) about the "
                    f"audio corpus")
        for a in arith_bad:
            rec("FAIL", f"  {a}")
    else:
        rec("PASS", "audio arithmetic: every document that discusses the corpus "
                    "publishes 78 paths / 66 unique / 52 shipped, and no superseded "
                    "enumeration survives")

    # 6m — a decided gap must not be re-opened outside a table row either
    ASK_STRONG = re.compile(
        r"(each need\b|need an option|option (?:must be |to be )?chosen|"
        r"choose\s*\(?[a-c]\)?|to be decided|undecided|still to be chosen|"
        r"pending (?:on|a|the requester))", re.I)
    DECIDED_ID = re.compile(r"\b(?:G-\d{2}|CB-\d{2}|W-OPEN-\d{2}|OPEN-\d{3})\b")
    reopen: list[str] = []
    for name, text in boards.items():
        # join a bullet with its indented continuation lines, so a question
        # split across a line break is still seen as one sentence
        logical: list[tuple[int, str]] = []
        for ln, raw in enumerate(text.splitlines(), 1):
            if raw.startswith((" ", "\t")) and logical:
                prev_ln, prev = logical[-1]
                logical[-1] = (prev_ln, prev + " " + raw.strip())
            else:
                logical.append((ln, raw))
        for ln, line in logical:
            if not line.startswith(("|", "- ", "*")):
                continue
            if CLOSED.search(line):
                continue
            if ASK_STRONG.search(line) and DECIDED_ID.search(line):
                reopen.append(f"{name}:{ln} re-opens a decided item — "
                              f"{line.strip()[:130]}")
    if reopen:
        rec("FAIL", f"decision coherence: {len(reopen)} prose line(s) re-open a "
                    f"decision that is already taken")
        for r in reopen:
            rec("FAIL", f"  {r}")
    else:
        rec("PASS", "decision coherence: no prose line re-opens a decided item")

    # 6n — the hazard cardinality: the requirement names eight kinds, the
    # world's catalogue holds fourteen entries. The acceptance clause must say
    # both, or an implementer does not know what to build.
    hazard_bad: list[str] = []
    for name, text in corpus.items():
        if name == "MASTER":
            text = strip_review_history(text)
        for line in text.splitlines():
            if not line.startswith("| REQ-D-012 |"):
                continue
            # only the acceptance-clause row states the cardinality; the asset
            # coverage index row does not
            if "hazard kind" not in line and "catalogue" not in line:
                continue
            if not re.search(r"\b8\b", line):
                hazard_bad.append(f"{name}: the REQ-D-012 acceptance clause does not "
                                 f"name the 8 required hazard kinds")
            if not re.search(r"\b14\b", line):
                hazard_bad.append(f"{name}: the REQ-D-012 acceptance clause does not "
                                 f"name the 14 catalogue entries")
    # and the catalogue really does hold fourteen
    world = corpus.get("WORLD", "")
    h_ids = sorted(set(re.findall(r"\bH-(\d{2})\b", world)))
    if len(h_ids) != 14:
        hazard_bad.append(f"WORLD: the hazard catalogue declares {len(h_ids)} entries "
                         f"(H-01…H-{h_ids[-1] if h_ids else '??'}), not 14")
    if hazard_bad:
        rec("FAIL", f"hazard cardinality: {len(hazard_bad)} disagreement(s)")
        for h in hazard_bad:
            rec("FAIL", f"  {h}")
    else:
        rec("PASS", "hazard cardinality: 8 required kinds and 14 catalogue entries, "
                    "stated in the clause and present in the catalogue")

    # 6o — a gap whose §13 decision eliminated the missing file may no longer
    # be labelled a gap. A gap whose file still does not exist (the music) may.
    gaps = re.split(r"\n###\s+(G-\d{2})", assets)
    decided_gaps = {gaps[i] for i in range(1, len(gaps) - 1, 2)
                    if "ADOPTED" in gaps[i + 1]}
    # gap ids whose manifest row is still a GAP — the file genuinely does not exist
    still_missing: set[str] = set()
    for line in assets.splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 8:
            continue
        if cells[-1].strip("*` ").upper() == "GAP":
            still_missing |= set(re.findall(r"\bG-\d{2}\b", line))
    stale_labels: list[str] = []
    for ln, line in enumerate(assets.splitlines(), 1):
        if CLOSED.search(line):
            continue
        # the pattern that claims a gap: the word GAP immediately followed by the id
        for m in re.finditer(r"GAP[^A-Za-z0-9]{0,3}`?(G-\d{2})\b", line):
            gid = m.group(1)
            if gid in decided_gaps and gid not in still_missing:
                stale_labels.append(f"ASSETS:{ln} still labels {gid} a gap, but §13 "
                                    f"resolved it — {line.strip()[:110]}")
    if stale_labels:
        rec("FAIL", f"decision coherence: {len(stale_labels)} place(s) still label a "
                    f"resolved gap as a gap")
        for s in stale_labels:
            rec("FAIL", f"  {s}")
    else:
        rec("PASS", f"decision coherence: no resolved gap is still labelled a gap "
                    f"({len(still_missing)} genuinely missing: "
                    f"{sorted(still_missing) or 'none'})")

    # 6p — the world's closing checklist must agree with its own catalogue rows.
    # The checklist is the summary an implementer reads first; if it disagrees
    # with the tables it summarises, the tables win and the checklist lies.
    tally_bad: list[str] = []
    world_text = corpus.get("WORLD", "")
    rows = re.findall(r"^\|\s*([A-Z]{1,2}-\d{2})\s*\|\s*`([a-z_]+)\.", world_text,
                      re.M)
    measured = {}
    for rid, kind in rows:
        measured.setdefault(rid.split("-")[0], set()).add(rid)
    # the checklist bullet, joined across its wrapped lines
    wlines = world_text.splitlines()
    checklist = ""
    for i, ln in enumerate(wlines):
        if "interactive-object catalogue specifies" in ln:
            checklist = " ".join(wlines[i:i + 6])
            break
    LABELS = [("blocks", "B"), ("moving platforms", "P"), ("switches", "S"),
              ("doors and keys", "D"), ("portals", "W"), ("hazards", "H"),
              ("items", "I"), ("carryables", "K"), ("dressing props", "G")]
    for label, prefix in LABELS:
        want = len(measured.get(prefix, ()))
        m = re.search(r"(\d+)\s+" + re.escape(label), checklist)
        if not m:
            tally_bad.append(f"WORLD: the closing checklist does not state a count "
                             f"for {label}")
            continue
        got = int(m.group(1))
        if got != want:
            tally_bad.append(f"WORLD: the closing checklist says {got} {label}, but "
                             f"the catalogue holds {want}")
    if tally_bad:
        rec("FAIL", f"catalogue tally: {len(tally_bad)} disagreement(s) between the "
                    f"world board's closing checklist and its own tables")
        for t in tally_bad:
            rec("FAIL", f"  {t}")
    else:
        rec("PASS", "catalogue tally: the world board's closing checklist agrees "
                    "with its own catalogue rows")

    # 6q — a cross-board callout in a board's *body* must carry the same closed
    # status as its row in the decision register. Two ways to get this wrong:
    #   (a) the callout is marked CLOSED but its prose still asks a question —
    #       the register lies about what was decided;
    #   (b) the callout is not closed at all and is not on the declared-open
    #       register — an open question left sitting in a board body.
    # The question forms are matched narrowly on purpose: a closed callout may
    # legitimately mention a board's name ("the value for WORLD is X"), and
    # that must not read as an open question.
    body_bad: list[str] = []
    for name, text in boards.items():
        lines = text.splitlines()
        for i, line in enumerate(lines):
            m = CALLOUT_ID.search(line)
            if not m:
                continue
            did = m.group(1)
            # the callout is this line plus its continuation lines
            block = [line]
            for nxt in lines[i + 1:]:
                if nxt.startswith((">", "  ", "\t")) and nxt.strip():
                    block.append(nxt)
                else:
                    break
            joined = " ".join(block)
            if did in DECLARED_OPEN:
                continue
            if CLOSED.search(joined):
                if BODY_ASK.search(joined):
                    body_bad.append(f"{name}:{i + 1} {did} is marked closed but its "
                                    f"callout still asks a question — "
                                    f"{joined.strip()[:120]}")
            else:
                body_bad.append(f"{name}:{i + 1} {did} is not marked closed and is not "
                                f"on the declared-open register — {joined.strip()[:120]}")
    if body_bad:
        rec("FAIL", f"decision coherence: {len(body_bad)} cross-board callout(s) in a "
                    f"board's body disagree with the decision register")
        for b in body_bad:
            rec("FAIL", f"  {b}")
    else:
        rec("PASS", "decision coherence: every cross-board callout in a board's body "
                    "carries the same closed status as its register row")

    # 6r — two acceptance clauses that had two live values
    clause_bad: list[str] = []
    for name, text in corpus.items():
        if name == "MASTER":
            text = strip_review_history(text)
        for line in text.splitlines():
            if line.startswith("| REQ-B-002 |") and "transition" in line:
                if not re.search(r"\b19\b", line):
                    clause_bad.append(f"{name}: the REQ-B-002 acceptance clause does not "
                                     f"name the 19 transitions")
                if not re.search(r"save_flags", line):
                    clause_bad.append(f"{name}: the REQ-B-002 acceptance clause does not "
                                     f"say which transition applies save_flags")
            if line.startswith("| REQ-A-005 |") and "allowed" in line:
                if not re.search(r"empty", line, re.I):
                    clause_bad.append(f"{name}: the REQ-A-005 acceptance clause does not "
                                     f"allow the empty allowed-input set")
    if clause_bad:
        rec("FAIL", f"acceptance clauses: {len(clause_bad)} clause(s) still carry the "
                    f"superseded rule")
        for c in clause_bad:
            rec("FAIL", f"  {c}")
    else:
        rec("PASS", "acceptance clauses: REQ-B-002 names the 19 transitions and the "
                    "save_flags transition, and REQ-A-005 allows the empty allowed-input set")

    # 6s — the path namespace: a project path must use the §4.1 tree's prefix.
    # Three namespaces exist (architecture §4.1): project tree (`src/…`),
    # pack-relative (`assets/glTF/Fox.gltf` — a file inside a downloaded pack)
    # and the design package's own tools (`tools/verify_design.py`). A project
    # path written in the old layout (`content/…`, `data/…`, `scenes/…`) names
    # a file that will not exist, and a project JSON written as `assets/x.json`
    # collides with the pack-relative namespace.
    ns_bad: list[str] = []
    # The design package's own tools are read from the filesystem, not from a
    # hand-typed list. A typed list drifts the first time a tool is added, and
    # the drift shows up as a false failure naming a tool that plainly exists.
    DESIGN_TOOLS = {
        f"tools/{p.name}"
        for p in sorted((WORKSPACE / "tools").iterdir())
        if p.is_file() and p.suffix in (".py", ".sh")
    }
    # The §4.1 tree's roots. A project path that starts with one of them and
    # is not prefixed `src/` names a file that will not exist.
    TREE_ROOTS = ("core", "systems", "content", "scenes", "assets", "tools")
    for name, text in corpus.items():
        if name == "MASTER":
            # the changelog quotes superseded wording deliberately, in order to
            # record what was fixed. It is a record, not a specification.
            text = strip_review_history(text)
        for ln, line in enumerate(text.splitlines(), 1):
            for tok in re.findall(r"`([^`\n]+)`", line):
                if tok.startswith("res://"):
                    continue
                head = tok.split("/")[0]
                if head not in TREE_ROOTS:
                    continue
                if head == "tools":
                    if tok not in DESIGN_TOOLS:
                        ns_bad.append(f"{name}:{ln} unknown design-package tool — "
                                      f"`{tok}` (the only tool paths outside "
                                      f"`src/tools/` are {sorted(DESIGN_TOOLS)})")
                    continue
                if head == "assets":
                    # `assets/<pack>/…` is pack-relative and is legal; a project
                    # JSON written as `assets/<file>.json` is not.
                    if re.match(r"assets/[^/]*\.json$", tok):
                        ns_bad.append(f"{name}:{ln} project JSON in the pack-relative "
                                      f"namespace — `{tok}` (it belongs under "
                                      f"`src/assets/`)")
                    continue
                if "/" in tok:
                    ns_bad.append(f"{name}:{ln} project path in the old layout — "
                                  f"`{tok}` (the §4.1 tree uses `src/{head}/…`)")
    if ns_bad:
        rec("FAIL", f"path namespace: {len(ns_bad)} project path(s) do not use the §4.1 "
                    f"tree's prefix")
        for b in ns_bad[:20]:
            rec("FAIL", f"  {b}")
    else:
        rec("PASS", "path namespace: every project path uses the §4.1 tree's prefix; "
                    "pack-relative asset paths and the design package's tools are "
                    "distinguished")

    # 6t — every system directory must publish a public interface.
    # A system that owns a directory but has no row in the architecture
    # board's §4.3 table has no published API, which is exactly the coupling
    # the design forbids: two boards would be reaching into undeclared
    # interfaces.
    tree = boards.get("ARCHITECTURE", "")
    m = re.search(r"│   ├── systems/.*?\n(│   ├── content/)", tree, re.S)
    sys_dirs: set[str] = set()
    if m:
        sys_dirs = set(re.findall(r"[├└]── ([a-z_]+)/", m.group(0))) - {"systems", "content"}
    api_rows: set[str] = set()
    mr = re.search(r"^\| System \| Owns.*?\n((?:^\|.*\n)+)", tree, re.M)
    if mr:
        api_rows = set(re.findall(r"^\| `([a-z_]+)`", mr.group(1), re.M))
    missing_api = sorted(sys_dirs - api_rows)
    orphan_api = sorted(api_rows - sys_dirs)
    if missing_api or orphan_api:
        rec("FAIL", f"system interface: {len(missing_api)} system director(ies) without a "
                    f"§4.3 API row and {len(orphan_api)} API row(s) without a directory")
        for d in missing_api:
            rec("FAIL", f"  src/systems/{d}/ — the tree gives it a directory but §4.3 "
                        f"publishes no public interface for it")
        for d in orphan_api:
            rec("FAIL", f"  §4.3 publishes a `{d}` system that has no directory in the tree")
    else:
        rec("PASS", f"every one of the {len(sys_dirs)} system directories in the §4.1 "
                    f"tree publishes a §4.3 public interface")

    # 6u — the screen catalogue and the transition table must agree.
    # §7.3 moves between scene screens; §7.7.1 lists every screen, with the
    # overlays named as overlays. A screen that appears in one and not the
    # other means a developer cannot find where to implement it.
    world = boards.get("WORLD", "")
    sc_rows = set(re.findall(r"^\| `screen\.([a-z_]+)`", world, re.M))
    tbl = re.search(r"### 7\.3 Screen transitions.*?\n\n(\|.*?)\n\n", world, re.S)
    tbl_screens: set[str] = set()
    if tbl:
        for line in tbl.group(1).splitlines():
            if not line.startswith("|") or "---" in line:
                continue
            first = line.strip("|").split("|")[0]
            if "From" in first or "→" not in first:
                continue                      # the header row, not a transition
            for side in first.split("→"):
                s = side.strip().lower()
                s = {"profile select": "profile", "world map": "worldmap",
                     "game over": "game_over", "boot (quit)": "boot",
                     "any": "boot"}.get(s, s)
                tbl_screens.add(s)
    OVERLAYS = {"hud", "rebind", "save_slots", "confirm", "tutorial_prompt"}
    scene_screens = sc_rows - OVERLAYS
    missing_cat = sorted(tbl_screens - sc_rows)
    missing_tbl = sorted(scene_screens - tbl_screens)
    if missing_cat or missing_tbl:
        rec("FAIL", f"screen catalogue: {len(missing_cat)} screen(s) in the transition "
                    f"table are not in §7.7.1 and {len(missing_tbl)} scene screen(s) in "
                    f"§7.7.1 are not in the transition table")
        for s in missing_cat:
            rec("FAIL", f"  `{s}` — moved between in §7.3 but not catalogued in §7.7.1")
        for s in missing_tbl:
            rec("FAIL", f"  `{s}` — catalogued as a scene screen in §7.7.1 but never "
                        f"reached by a row of §7.3")
    else:
        rec("PASS", f"the {len(scene_screens)} scene screens of §7.7.1 are exactly the "
                    f"screens §7.3's transition table moves between; the "
                    f"{len(OVERLAYS)} overlays are named as overlays")

    # 6v — the flow edge list and the transition table must be a bijection.
    # §7.3 is the table; §7.7.2 is the edge list derived from it. A developer
    # implements from one and reads the other, so a row with no line (or a line
    # with no row) is a contradiction in the design itself. This was missed by
    # the eleventh and twelfth review rounds: both rounds claimed the graph was
    # a bijection while it was not, because no gate compared the two.
    def _screen(tok: str) -> str:
        s = re.sub(r"\([^)]*\)", "", tok).strip().lower()
        s = re.sub(r"\s+", " ", s)
        return {"profile select": "profile", "world map": "worldmap",
                "game over": "game_over"}.get(s, s)

    def _edges_from_cells(cells: list[str]) -> list[tuple[str, str]]:
        out: list[tuple[str, str]] = []
        for cell in cells:
            parts = cell.split("→")
            if len(parts) != 2:
                return []
            out.append((_screen(parts[0]), _screen(parts[1])))
        return out

    tbl_edges: list[tuple[str, str]] = []
    malformed_tbl: list[str] = []
    if tbl:
        for line in tbl.group(1).splitlines():
            if not line.startswith("|") or "---" in line:
                continue
            first = line.strip("|").split("|")[0]
            if "From" in first or "→" not in first:
                continue
            parts = first.split("→")
            if len(parts) != 2:
                # A cell with zero or two-plus arrows is malformed. The
                # fourteenth review found the two-arrow case was silently
                # truncated to the first two tokens; it is now rejected.
                malformed_tbl.append(first.strip())
                continue
            tbl_edges.append((_screen(parts[0]), _screen(parts[1])))

    graph_blk = re.search(
        r"####\s+7\.7\.2 The flow graph.*?```[a-z]*\n(.*?)```", world, re.S)
    if not graph_blk:
        rec("FAIL", "flow edge list: §7.7.2 publishes no fenced edge-list block, so its "
                    "claim to be a bijection with §7.3 cannot be checked — and cannot "
                    "be true")
        graph_edges = []
    else:
        cells = [ln.strip() for ln in graph_blk.group(1).splitlines() if ln.strip()]
        graph_edges = _edges_from_cells(cells)
        if not graph_edges:
            rec("FAIL", f"flow edge list: §7.7.2's block has {len(cells)} line(s) but "
                        f"{len(cells)} of them are not a `from → to` edge")
    if graph_edges:
        only_tbl, only_grf = flow_edge_mismatch(tbl_edges, graph_edges)
        dup_tbl = [e for e, n in Counter(tbl_edges).items() if n > 1]
        dup_grf = [e for e, n in Counter(graph_edges).items() if n > 1]
        if malformed_tbl:
            rec("FAIL", f"flow edge list: {len(malformed_tbl)} row(s) of §7.3's table are "
                        f"malformed — a transition cell must hold exactly one arrow")
            for m in malformed_tbl:
                rec("FAIL", f"  `{m}` — not a single `From → To` pair")
        if only_tbl or only_grf or dup_tbl or dup_grf:
            rec("FAIL", f"flow edge list: §7.7.2 and §7.3 disagree — {len(only_tbl)} "
                        f"table row(s) with no edge line, {len(only_grf)} edge line(s) "
                        f"with no table row, {len(dup_tbl)} duplicated table row(s), "
                        f"{len(dup_grf)} duplicated edge line(s)")
            for f, t in only_tbl:
                rec("FAIL", f"  `{f} → {t}` is a row of §7.3 but has no line in §7.7.2")
            for f, t in only_grf:
                rec("FAIL", f"  `{f} → {t}` is a line in §7.7.2 but has no row in §7.3")
            for f, t in dup_tbl:
                rec("FAIL", f"  `{f} → {t}` is a row of §7.3 more than once")
            for f, t in dup_grf:
                rec("FAIL", f"  `{f} → {t}` is a line in §7.7.2 more than once")
        elif graph_edges != tbl_edges:
            rec("WARN", f"flow edge list: the {len(graph_edges)} edges are the same set as "
                        f"§7.3's rows but in a different order; §7.7.2 claims 'the same "
                        f"order as §7.3's table'")
        else:
            rec("PASS", f"flow edge list: §7.7.2's {len(graph_edges)} edges are exactly "
                        f"§7.3's {len(tbl_edges)} rows, in order, with no duplicate — the "
                        f"bijection holds in both directions")

    # 6j — a review-round section's title must name the round it actually holds.
    # The thirteenth review found eight titles that were each ONE AHEAD of the
    # round their own prose describes, and one round with no record at all. A
    # reader counting the sections and a reader trusting the titles got different
    # answers, and the published round count was hand-written on top of that.
    ORDINAL_WORDS = {
        "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6,
        "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10, "eleventh": 11,
        "twelfth": 12, "thirteenth": 13, "fourteenth": 14, "fifteenth": 15,
        "sixteenth": 16, "seventeenth": 17, "eighteenth": 18, "nineteenth": 19,
        "twentieth": 20,
    }
    round_heads = re.findall(r"^###\s+(11\.2[a-z]?)\s+(.*review round.*)$",
                             master, re.M)
    wrong_round: list[str] = []
    for idx, (sec, title) in enumerate(round_heads, start=1):
        m = re.search(r"\b(" + "|".join(ORDINAL_WORDS) + r")\b", title)
        if not m:
            wrong_round.append(f"§{sec} — the title names no round number")
        elif ORDINAL_WORDS[m.group(1)] != idx:
            wrong_round.append(f"§{sec} — the title says “{m.group(1)}” but this is the "
                               f"{idx}th review round")
    # The fourteenth review found an evade: a record whose title dropped the
    # words "review round" left the checked set entirely — and left the
    # published count smaller at the same time. Every §11.2x subsection must
    # therefore be a review-round record, unless it is explicitly declared to
    # be something else.
    NON_ROUND_SECTIONS = {"11.2b"}
    all_sections = re.findall(r"^###\s+(11\.2[a-z]?)\s+", master, re.M)
    undeclared = [s for s in all_sections
                  if s not in {h[0] for h in round_heads} and s not in NON_ROUND_SECTIONS]
    for s in undeclared:
        wrong_round.append(f"§{s} — is neither a review-round record nor a declared "
                           f"non-round section, so it escapes both the check and the "
                           f"published count")
    if wrong_round:
        rec("FAIL", f"review-round records: {len(wrong_round)} section title(s) do not "
                    f"name the round they hold")
        for w in wrong_round:
            rec("FAIL", f"  {w}")
    else:
        rec("PASS", f"each of the {len(round_heads)} review-round records names the round "
                    f"it holds, in order, and every §11.2x section is accounted for")

    # 6i — document structure: section numbers must be unique within each document
    dupes: list[str] = []
    for name, text in corpus.items():
        seen: dict[str, int] = defaultdict(int)
        for line in text.splitlines():
            m = re.match(r"^#{2,4}\s+(\d+(?:\.\d+)*[a-z]?)\b", line)
            if m:
                seen[m.group(1)] += 1
        for num, n in seen.items():
            if n > 1:
                dupes.append(f"{name}: section {num} appears {n} times")
    if dupes:
        rec("FAIL", f"document structure: {len(dupes)} duplicate section number(s)")
        for d in dupes:
            rec("FAIL", f"  {d}")
    else:
        rec("PASS", "document structure: no duplicate section numbers in any document")


# --------------------------------------------------------------------------- #
def check_published_figures(master: str, expected_pass: int) -> None:
    """The master must publish the gate figures this run actually produced.

    The master is built by `tools/build_master.py`, which measures the gates
    and substitutes what they reported. This check closes the loop: if the two
    ever disagree — a check added, a figure typed by hand — the build fails
    instead of the document quietly lying about its own verification.
    """
    if "@@DESIGN_GATE@@" in master:
        if os.environ.get("MASTER_BUILDING"):
            rec("PASS", "published figures: the master's gate figure is being measured "
                        "by the builder this run")
            return
        rec("FAIL", "published figures: the master still carries the builder's "
                    "placeholder — the gate figure was never measured")
        return
    m = re.search(r"verify_design\.py` → \*\*0 FAIL, (\d+) PASS\*\*", master)
    if not m:
        rec("FAIL", "published figures: the master does not publish a "
                    "verify_design.py pass count")
        return
    if results["FAIL"]:
        rec("FAIL", f"published figures: this run has failures, so the master's "
                    f"published figure certifies nothing")
        return
    if int(m.group(1)) != expected_pass:
        rec("FAIL", f"published figures: the master claims verify_design.py → 0 FAIL, "
                    f"{m.group(1)} PASS, but this run has {expected_pass} PASS")
        return
    rec("PASS", "published figures: the master's stated design-gate count matches "
                "this run")


def flow_edge_mismatch(tbl_edges: list[tuple[str, str]],
                       graph_edges: list[tuple[str, str]]
                       ) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """Return (table rows with no edge line, edge lines with no table row).

    The eleventh and twelfth review rounds both claimed §7.7.2's graph was a
    bijection with §7.3's table while it was not, because nothing compared the
    two. This is that comparison, as a pure function so it can be fault-injected
    with the review's own input without touching the documents.

    The fourteenth review found two more holes: a **duplicate** edge line was
    only a WARN (the comparison was a set, not a multiset), and a table row
    whose cell held two arrows was silently truncated to the first two tokens.
    The caller now rejects a malformed cell rather than parsing it, and the
    caller also compares the two lists for equality, so a duplicate on either
    side is a failure rather than a warning.
    """
    only_tbl = [e for e in tbl_edges if e not in graph_edges]
    only_grf = [e for e in graph_edges if e not in tbl_edges]
    return only_tbl, only_grf


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    boards = load_boards()
    known, _ = load_inventory()

    master_path = DOCS / "DESIGN-3-MASTER.md"
    master = master_path.read_text(encoding="utf-8") if master_path.exists() else ""

    # The cache state is measured once and reported once. It is its own check,
    # not a side effect of the path check: it must fail even when every cited
    # path happens to resolve, because a cache that is quietly incomplete is a
    # false certificate waiting to happen.
    cache_ok, cache_msg = pack_cache.check_cache_complete()

    check_requirements(boards)
    check_assets(boards, known, cache_ok)
    if cache_ok:
        rec("PASS", cache_msg)
    else:
        rec("FAIL", cache_msg)
    check_constants(boards)
    check_ip(boards)
    check_procedural(boards)
    check_decision_coherence(boards, master)
    # the +1 is this check itself, which passes when the master's figure is right
    check_published_figures(master, len(results["PASS"]) + 1)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        for level in ("FAIL", "WARN", "PASS", "INFO"):
            for m in results[level]:
                print(f"[{level:4s}] {m}")
        f = len(results["FAIL"])
        w = len(results["WARN"])
        print(f"\n=== {f} FAIL, {w} WARN, {len(results['PASS'])} PASS, "
              f"{len(results['INFO'])} INFO ===")
    return 1 if results["FAIL"] else 0


if __name__ == "__main__":
    sys.exit(main())
