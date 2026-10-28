#!/usr/bin/env python3
"""
Repair the integrity defects found by tools/validate_requirements.py in a domain document:

  1. duplicate requirement-table IDs (a bot edit inserted a second definition of an ID)
     -> the LATER definition is renumbered to the next free ID; cross-references that
        pointed at the ambiguous ID are re-pointed at the canonical (first) definition.
  2. dangling FR references (an ID cited in a "Covers"/edge-case column that is never
     defined) -> re-pointed at the defined FR that covers the same behaviour.
  3. a requirement sentence duplicated inside its own cell -> collapsed.

Every change is reported. Nothing is invented: re-pointed targets are chosen from
requirements already defined in the same document whose text covers the cited scenario.

Usage: python3 tools/repair_requirements.py <file> [--dry-run]
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ID_RE = re.compile(r"^(FR|NFR|QA)-([A-Z]{2,6})-(\d{3})$")
ANY_ID_RE = re.compile(r"\b(?:FR|NFR|QA)-[A-Z]{2,6}-\d{3}\b")

# Scenario-driven re-pointing for dangling FR references: dangling -> defined FR
# that already covers the same behaviour in the same document.
REPOINT = {
    "FR-MOB-117": "FR-MOB-045",  # zoned industry + outside connection -> freight requirement
    "FR-MOB-126": "FR-MOB-102",  # bridge deck height budget        -> bridge height/slope cost
    "FR-MOB-131": "FR-MOB-101",  # bridge/tunnel over valley/water  -> bridge & tunnel structures
    "FR-MOB-133": "FR-MOB-026",  # bulldozer removes streets         -> bulldozer requirement
    "FR-MOB-135": "FR-MOB-056",  # 2->4 lane widening                -> capacity increase in place
}


def cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def main() -> int:
    path = Path(sys.argv[1])
    dry = "--dry-run" in sys.argv
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    changes: list[str] = []

    # ---------- pass 1: find duplicate definitions -------------------------------
    seen_def: dict[str, int] = {}
    dup_later: dict[str, int] = {}  # duplicated id -> line index of the LATER definition
    for i, line in enumerate(lines):
        if not line.strip().startswith("|"):
            continue
        cs = cells(line)
        if not cs:
            continue
        m = ID_RE.match(cs[0])
        if not m:
            continue
        gid = m.group(0)
        if gid in seen_def:
            dup_later[gid] = i
        else:
            seen_def[gid] = i

    # next free number per kind, above every existing definition
    maxnum: dict[str, int] = {}
    for gid in seen_def:
        kind, _, num = gid.split("-")
        maxnum[kind] = max(maxnum.get(kind, 0), int(num))
    nextnum = {k: v + 1 for k, v in maxnum.items()}
    rename: dict[str, str] = {}  # (old id) -> new id, only for later definitions
    for old, idx in sorted(dup_later.items(), key=lambda kv: kv[1]):
        kind = old.split("-")[0]
        new = f"{kind}-{old.split('-')[1]}-{nextnum[kind]:03d}"
        nextnum[kind] += 1
        rename[f"{idx}:{old}"] = new
        changes.append(f"line {idx+1}: duplicate definition {old} -> {new} (canonical kept at first occurrence)")

    # ---------- pass 2: apply renames ------------------------------------------
    for idx, line in enumerate(lines):
        key = f"{idx}:"
        for k, new in list(rename.items()):
            if k.startswith(key):
                cs = cells(line)
                old = k.split(":")[1]
                cs[0] = new
                lines[idx] = "| " + " | ".join(cs) + " |"
                # fix the FR/QA id that may also appear in the row's other cells
                lines[idx] = lines[idx].replace(f"| {old} |", f"| {new} |")
                break

    # ---------- pass 3: re-point cross-references to ambiguous ids --------------
    text = "\n".join(lines)
    for old in set(dup_later):
        # the canonical definition stays the first occurrence -> references keep the old id
        pass

    # ---------- pass 4: dangling FR references ----------------------------------
    defined = set()
    for line in lines:
        if line.strip().startswith("|"):
            cs = cells(line)
            if cs and ID_RE.match(cs[0]):
                defined.add(cs[0])
    cited = set(ANY_ID_RE.findall(text))
    dangling = sorted(c for c in cited if c not in defined)
    for d in dangling:
        target = REPOINT.get(d)
        if target is None:
            continue
        before = sum(l.count(d) for l in lines)
        # apply to the line buffer, not to the stale `text` copy, so the change is not
        # discarded when `lines` is re-joined below.
        lines = [re.sub(rf"\b{re.escape(d)}\b", target, l) for l in lines]
        text = "\n".join(lines)
        changes.append(f"dangling {d} -> {target} ({before} reference(s) re-pointed)")
    unresolved = sorted(c for c in set(ANY_ID_RE.findall(text)) if c not in defined)
    for u in unresolved:
        changes.append(f"STILL DANGLING: {u}")

    # ---------- pass 5: duplicated sentence inside one cell --------------------
    for i, line in enumerate(lines):
        if not line.strip().startswith("|"):
            continue
        cs = cells(line)
        if len(cs) < 3:
            continue
        body = cs[1]
        # find a sentence repeated twice inside the same cell
        m = re.match(r"^(.*?\.)\s+(.*)$", body)
        if not m:
            continue
        first, rest = m.group(1).strip(), m.group(2).strip()
        if len(first) < 40:
            continue
        if rest.startswith(first.rstrip(".")) or first.rstrip(".").lower() in rest.lower():
            if rest.lower().startswith(first.lower()[:40]):
                cs[1] = first
                lines[i] = "| " + " | ".join(cs) + " |"
                changes.append(f"line {i+1}: collapsed duplicated sentence in {cs[0]}")

    text = "\n".join(lines)

    if dry:
        print("DRY RUN — proposed changes:")
        for c in changes:
            print("  -", c)
        return 0

    path.write_text(text, encoding="utf-8")
    print(f"repaired {path}")
    for c in changes:
        print("  -", c)
    return 0


if __name__ == "__main__":
    sys.exit(main())
