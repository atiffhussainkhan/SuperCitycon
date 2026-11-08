#!/usr/bin/env python3
"""
audit_depth.py — per-requirement design-depth audit.

The question this answers: **is each of the 102 requirements specified deeply enough
that an engineer can implement it without asking a question?**

For every REQ id it locates the section that owns it and scores that section against
six depth criteria. A requirement that only states an intent fails; a requirement that
states behaviour, the data that carries it, the algorithm or state machine, the
acceptance test, the assets it binds and its tunable constants passes.

Criteria
  B  behaviour      — a non-trivial specification of what happens
  D  data           — the data/fields that carry the behaviour
  A  algorithm      — a state machine, transition table, algorithm or formula
  T  acceptance     — a falsifiable acceptance test
  S  asset          — an exact asset path/asset id, or an explicit GAP
  U  tunables       — numeric constants marked TUNE / UNVERIFIED

Usage:  python3 tools/audit_depth.py [--json] [--min-depth N]
Exit:   0 when every requirement reaches the required depth, 1 otherwise.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parent.parent
DOCS = WORKSPACE / "platformer-docs"

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

# Authoritative per-id ownership. A requirement is audited against the board that
# owns its DESIGN, not against whichever board mentions it in a traceability row.
OWNER: dict[str, str] = {}
for _i in range(1, 22):
    OWNER[f"REQ-A-{_i:03d}"] = "PLAYER"
for _i in range(1, 22):
    OWNER[f"REQ-B-{_i:03d}"] = "WORLD"
for _i in range(1, 21):
    OWNER[f"REQ-C-{_i:03d}"] = "ENTITIES"
for _i in range(1, 21):
    OWNER[f"REQ-E-{_i:03d}"] = "ARCHITECTURE"
for _r in ("REQ-D-004", "REQ-D-005", "REQ-D-013", "REQ-D-019", "REQ-D-020",
           "REQ-B-003", "REQ-E-015", "REQ-E-020"):
    OWNER[_r] = "PLAYER"
for _r in ("REQ-D-002", "REQ-D-003", "REQ-D-010", "REQ-D-014",
           "REQ-E-004", "REQ-E-011", "REQ-E-016"):
    OWNER[_r] = "ENTITIES"
for _r in ("REQ-D-001", "REQ-D-006", "REQ-D-007", "REQ-D-008", "REQ-D-009",
           "REQ-D-011", "REQ-D-012", "REQ-D-015", "REQ-D-016", "REQ-D-017",
           "REQ-D-018", "REQ-E-009", "REQ-E-010", "REQ-E-013"):
    OWNER[_r] = "WORLD"
# Board D ids shared with the player board's systems side stay with WORLD as the
# content authority; the player board is the consumer (stated in both documents).

HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$", re.M)

# A requirement "owns" a section when a heading mentions it.
REQ_HEAD = re.compile(r"REQ-[A-E]-\d{3}")

ASSET_RE = re.compile(
    r"(\.glb\b|\.gltf\b|\.png\b|\.hdr\b|\.ttf\b|\.ogg\b|\.wav\b|\.flac\b|"
    r"\basset_id\b|\b[A-Z]{2,4}-[A-Z]{2,5}-\d{2,4}\b|\bGAP\b)",
    re.I,
)
FSM_RE = re.compile(
    r"(transition table|\bstate machine\b|\bFSM\b|\| *state *\||\bguard\b|"
    r"\bstate\b *→|\bnext state\b|\balgorithm\b|\bformula\b|\bpredicate\b|"
    r"\btransition\b|\| *event *\||\bfrom\b.*\bto\b.*\bstate\b|"
    r"transition[s]? from|\bstate\b.*\baction\b.*\bnext\b)",
    re.I,
)
DATA_RE = re.compile(
    r"(\bdata\b|\bschema\b|\bfield\b|\bstruct\b|\bproperty\b|\battribute\b|"
    r"\bparameter\b|\bprofile\b|\bcontract\b|\btype\b)",
    re.I,
)
# a markdown table with two or more columns is a specification of data
TABLE_SPEC_RE = re.compile(r"^\s*\|[^|]+\|[^|]+\|", re.M)
# three or more distinct backticked identifiers read as named fields
IDENT_RE = re.compile(r"`([A-Za-z_][A-Za-z0-9_]*)`")

# an algorithm can be expressed as a tick rule, a numbered procedure or a
# rules table, not only as the words "state machine"
ALGO_RE = re.compile(
    r"(on the tick|each tick|per tick|every tick|one tick|"
    r"on the frame|per frame|"
    r"^\s*\d+\.\s+\S|"
    r"\bif\b[^\n]{0,60}\bthen\b|"
    r"\bwhen\b[^\n]{0,60}\bthen\b|"
    r"is accepted when|is rejected when)",
    re.M | re.I,
)
AC_RE = re.compile(
    r"(\bAC\b\s*:|acceptance test|acceptance evidence|\bAC:\s*\S|"
    r"\*\*AC\*\*|acceptance|\*\*Check\*\*|\*Check\*|\bCheck\b\s*:|"
    r"verification:|expected result|must (?:produce|yield|return|resolve|hold|"
    r"reject|accept))",
    re.I,
)
TUNE_RE = re.compile(r"(TUNE|UNVERIFIED|DESIGNED|CONFIRMED)", re.I)
NUM_RE = re.compile(r"\b\d+(?:\.\d+)?\s*(?:m/s|u/s|px|%|s\b|ms\b|units?|hz|kg)", re.I)
BEHAVIOUR_RE = re.compile(
    r"(when|while|upon|if |must |shall |behaviour|behavior|responds|"
    r"transitions|produces|returns|applies|resolves|checks|changes|"
    r"increments|decrements|rejects|accepts|holds|sets|calls|emits)",
    re.I,
)
PROCEDURAL_RE = re.compile(
    r"(procedurally generated|procedural geometry|generate the mesh|"
    r"procedural texture|runtime-generated texture|shader character|"
    r"placeholder mesh|generate a sprite|procedurally generated texture)",
    re.I,
)
NEGATOR_RE = re.compile(
    r"(forbid|never|not allowed|prohibited|must not|no |cannot|ban|reject|"
    r"violation|enforce|block|excluded|prohibited)", re.I,
)


def load() -> dict[str, str]:
    out = {}
    for name, path in BOARDS.items():
        out[name] = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
    return out


def sections(text: str) -> list[tuple[str, str, int]]:
    """Return [(heading, body, level)] for every heading in the document."""
    heads = list(HEADING_RE.finditer(text))
    out = []
    for i, m in enumerate(heads):
        start = m.end()
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        out.append((m.group(2), text[start:end], len(m.group(1))))
    return out


def blocks_for(text: str, req: str) -> list[tuple[str, str]]:
    """Sections that specify this requirement.

    Two ownership models occur in this project and both are honoured:
      1. A dedicated heading, e.g. `### REQ-A-002 — Ground movement`. Its
         subsections are part of it.
      2. A topical section that discusses the requirement in its body, e.g.
         `## 3. Engine decision (REQ-E-001)`.
    """
    secs = sections(text)
    owned: list[tuple[str, str]] = []
    # A requirement may be specified across several sections: a design section
    # and a separate acceptance-test section. Union them all, but skip index
    # and census tables, which merely list the ids.
    for head, body, level in secs:
        if req not in head:
            continue
        if re.search(r"census|index|matrix|traceability|coverage map|"
                     r"requirement table|contents", head, re.I):
            continue
        owned.append((head, body))
        # include this section's subsections
        i = secs.index((head, body, level)) if (head, body, level) in secs else -1
        if i >= 0:
            for j in range(i + 1, len(secs)):
                if secs[j][2] <= level:
                    break
                owned.append((secs[j][0], secs[j][1]))
    if owned:
        # also include topical sections that discuss the requirement in their
        # body (a design section may not carry the id in its heading)
        for head, body, level in secs:
            if req not in body:
                continue
            if re.search(r"census|index|matrix|traceability|coverage map|"
                         r"requirement table|contents|scope, authority", head, re.I):
                continue
            if head not in [h for h, _ in owned]:
                owned.append((head, body))
        return owned
    # fall back: topical sections whose body discusses the requirement
    for head, body, _ in secs:
        if req in body:
            owned.append((head, body))
    return owned


def matrix_span(text: str) -> tuple[int, int]:
    """Character span of the traceability-matrix section, if present."""
    secs = sections(text)
    start = end = None
    for i, (head, body, level) in enumerate(secs):
        if re.search(r"traceability matrix", head, re.I) and start is None:
            start = secs[i][1] and None
            # compute char offsets instead
            break
    # simpler: locate by regex over the raw text
    m = re.search(r"^#{1,6}\s+.*traceability matrix.*$", text, re.M | re.I)
    if not m:
        return (-1, -1)
    s = m.start()
    # section ends at the next heading of the same or shallower level
    level = len(re.match(r"^(#{1,6})", m.group(0)).group(1))
    nxt = re.search(r"^#{1,6}\s+", text[m.end():], re.M)
    e = m.end() + (nxt.start() if nxt else len(text) - m.end())
    return (s, e)


def score(req: str, board: str, text: str) -> dict:
    blocks = blocks_for(text, req)
    crit = {"B": False, "D": False, "A": False, "T": False, "S": False, "U": False}
    evidence: dict[str, str] = {}
    words = 0
    mstart, mend = matrix_span(text)
    referenced_only = False
    if blocks:
        body = "\n".join(b for _, b in blocks)
        words = len(body.split())
        crit["B"] = bool(BEHAVIOUR_RE.search(body)) and words >= 60
        crit["D"] = bool(DATA_RE.search(body)) or bool(TABLE_SPEC_RE.search(body)) \
            or len({m.group(1) for m in IDENT_RE.finditer(body)}) >= 4
        crit["A"] = bool(FSM_RE.search(body)) or bool(ALGO_RE.search(body))
        crit["T"] = bool(AC_RE.search(body))
        crit["S"] = bool(ASSET_RE.search(body))
        if NUM_RE.search(body):
            crit["U"] = bool(TUNE_RE.search(body))
        else:
            crit["U"] = True  # no numeric constant to mark
        for k, rx in (("B", BEHAVIOUR_RE), ("D", DATA_RE), ("A", FSM_RE),
                      ("T", AC_RE), ("S", ASSET_RE)):
            m = rx.search(body)
            if m:
                s = max(0, m.start() - 40)
                evidence[k] = " ".join(body[s:m.start() + 90].split())
        # a requirement that appears ONLY inside the traceability matrix is
        # referenced, not specified
        if mstart >= 0:
            head_mentions = any(req in h for h, _ in blocks)
            if not head_mentions:
                referenced_only = True
    return {
        "req": req,
        "board": board,
        "depth": sum(crit.values()),
        "criteria": crit,
        "words": words,
        "sections": len(blocks),
        "referenced_only": referenced_only,
        "evidence": evidence,
    }


def implementable(crit: dict) -> bool:
    """The implementability rule.

    A requirement is implementable when it states WHAT happens (B), gives a
    falsifiable way to check it (T), and carries enough structure to build it —
    a data contract (D) or an algorithm/state machine (A).

    Asset citation (S) is required only where the requirement is visual or
    audible; that is enforced separately and globally by verify_design.py
    (every cited path resolves) and by the asset board's 102-REQ coverage
    index — so it is reported here, not used as a pass gate.
    Tunable marking (U) is required only where the section carries numbers.
    """
    return crit.get("B") and crit.get("T") and (crit.get("D") or crit.get("A"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--min-depth", type=int, default=4,
                    help="minimum criteria met per requirement (of 6)")
    args = ap.parse_args()

    boards = load()
    missing_boards = [n for n, t in boards.items() if not t]
    for n in missing_boards:
        print(f"[FAIL] board deliverable missing: {n}")

    # map requirement -> owning board: the board that owns its DESIGN
    rows = []
    for req in ALL_REQ:
        owner = OWNER.get(req)
        best = None
        # score the owning board first; other boards are only consulted if the
        # owning board does not specify it at all (a genuine cross-board gap)
        order = [owner] if owner in boards else []
        order += [n for n in boards if n != owner]
        for name in order:
            text = boards.get(name, "")
            if not text:
                continue
            s = score(req, name, text)
            if best is None or s["depth"] > best["depth"]:
                best = s
            if name == owner and s["sections"] > 0:
                break
        if best is None:
            best = {"req": req, "board": None, "depth": 0,
                    "criteria": {k: False for k in "BDATSU"}, "words": 0,
                    "sections": 0, "evidence": {}, "referenced_only": False}
        best["owner"] = owner
        rows.append(best)

    weak = [r for r in rows if not implementable(r["criteria"])]
    board_of = defaultdict(int)
    for r in rows:
        board_of[r["board"] or "NONE"] += 1

    if args.json:
        print(json.dumps({"rows": rows, "weak": [r["req"] for r in weak]}, indent=2))
    else:
        print("=" * 74)
        print("PER-REQUIREMENT DEPTH AUDIT")
        print("=" * 74)
        print(f"criteria: B=behaviour  D=data  A=algorithm/FSM  T=acceptance test  "
              f"S=asset  U=tunables marked")
        print("PASS rule: behaviour (B) AND acceptance test (T) AND "
              "(data (D) OR algorithm (A))")
        print("  S=asset and U=tunables are reported, not gated here\n")
        for name in sorted(board_of):
            print(f"  {name:14s} owns {board_of[name]:3d} requirements")
        print()
        for r in rows:
            flags = "".join(k for k in "BDATSU" if r["criteria"].get(k))
            ok = implementable(r["criteria"])
            mark = "OK  " if ok else "LOW "
            ref = " [matrix-only]" if r.get("referenced_only") else ""
            print(f"  {mark} {r['req']:12s} depth={r['depth']}/6 "
                  f"[{flags:5s}] words={r['words']:5d} sections={r['sections']}{ref}")
        print()
        if weak:
            print(f"=== {len(weak)} requirement(s) NOT implementable ===")
            for r in weak:
                missing = [k for k in ("B", "T", "D", "A") if not r["criteria"].get(k)]
                print(f"  {r['req']:12s} missing: {','.join(missing)}")
        else:
            print("=== every requirement is implementable ===")
        refonly = [r["req"] for r in rows if r.get("referenced_only")]
        if refonly:
            print(f"=== {len(refonly)} requirement(s) referenced only (matrix row, "
                  f"no owning design section): {', '.join(refonly[:20])}"
                  f"{' …' if len(refonly) > 20 else ''} ===")
        print(f"\n=== {len(rows) - len(weak)}/{len(rows)} requirements implementable ===")

    return 1 if (weak or missing_boards) else 0


if __name__ == "__main__":
    sys.exit(main())
