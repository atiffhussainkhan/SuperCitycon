#!/usr/bin/env python3
"""
Numeric audit: does each requirement's cited source actually contain the numbers it states?

The most dangerous defect class found in this dossier was a requirement stating a precise value
(radius, percentage, multiplier, capacity) that its cited source did not support. This script
automates the check for the video-backed rows:

  * for every FR/NFR row with a YouTube citation, map the video id -> the locally captured
    transcript in docs/transcripts/
  * extract the numeric tokens in the requirement text (%, x, ×, plain integers with a unit)
  * report numbers that do NOT appear anywhere in that transcript

Output is a REVIEW LIST, not a verdict: a number can legitimately come from a different source in
the same row, or be a design decision. But every hit is worth a human look.

Usage: python3 tools/audit_numbers.py [--all] [--domain XXX]
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REQ = ROOT / "docs" / "requirements"
TRANS = ROOT / "docs" / "transcripts"

# a number worth checking: 90%, 250%, x15, 1.65, 13x13, 380, 24 hours ...
NUM_PATTERNS = [
    re.compile(r"(\d+(?:\.\d+)?)\s*%"),            # 90%
    re.compile(r"[x×]\s*(\d+(?:\.\d+)?)"),         # x15, ×15
    re.compile(r"(\d+(?:\.\d+)?)\s*(?:x|×)\s*\d"),  # 13x13
    re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:hours|hour|days|day|minutes|minute|points|point)\b"),
    re.compile(r"\b(\d+)\s*(?:units|vehicles|cars|residents|citizens|buildings)\b"),
]
ID_ROW = re.compile(r"^\|\s*((?:FR|NFR)-[A-Z]{2,6}-\d{3})\s*\|")
YT = re.compile(r"youtube\.com/watch\?v=([\w-]{6,})")


def transcripts() -> dict[str, str]:
    out = {}
    for t in TRANS.glob("*.txt"):
        vid = t.name.split("__")[0]
        out[vid] = t.read_text(encoding="utf-8", errors="ignore")
    return out


def main() -> int:
    txs = transcripts()
    show_all = "--all" in sys.argv
    domain = None
    if "--domain" in sys.argv:
        domain = sys.argv[sys.argv.index("--domain") + 1].upper()

    total_rows = 0
    hits = []
    for f in sorted(REQ.glob("*.md")):
        if domain and not f.name.upper().startswith(domain[:3]):
            continue
        for line in f.read_text(encoding="utf-8", errors="ignore").splitlines():
            m = ID_ROW.match(line)
            if not m:
                continue
            rid = m.group(1)
            yt = YT.search(line)
            if not yt:
                continue
            vid = yt.group(1)
            body = line.split("|")[2] if len(line.split("|")) > 2 else ""
            if not body.strip():
                continue
            total_rows += 1
            tx = txs.get(vid)
            if tx is None:
                continue
            txn = re.sub(r"[^0-9.]", "", tx)
            txnums = set(re.findall(r"\d+(?:\.\d+)?", tx))
            missing = []
            for pat in NUM_PATTERNS:
                for num in pat.findall(body):
                    if num in txnums:
                        continue
                    # tolerate 250 vs 250.0 and percent written as "250%"
                    if num.rstrip("0").rstrip(".") in {n.rstrip("0").rstrip(".") for n in txnums}:
                        continue
                    missing.append(num)
            if missing:
                hits.append((f.name, rid, vid, sorted(set(missing)), body.strip()[:170]))

    print(f"transcripts available: {len(txs)}")
    print(f"video-backed requirement rows checked: {total_rows}")
    print(f"rows whose stated numbers are absent from the cited transcript: {len(hits)}\n")
    for name, rid, vid, missing, body in hits:
        print(f"{name:<44} {rid:<14} {vid}  numbers not in transcript: {', '.join(missing)}")
        if show_all:
            print(f"    {body}")
    print("\nREVIEW LIST ONLY — a missing number may be a design decision or come from another source in the same row.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
