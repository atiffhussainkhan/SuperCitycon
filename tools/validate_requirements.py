#!/usr/bin/env python3
"""
Validate the SuperCitycon requirement documents produced by the requirement bots.

Checks, per document:
  * the 12-section contract from docs/00-research-brief.md
  * requirement ID shape, uniqueness (within file and across all files)
  * domain code matches the file's declared domain
  * every FR/NFR row carries a source URL or an explicit TBD marker
  * house minimum counts (>=60 FR, >=8 NFR, >=12 QA per domain - stated in
    docs/00-research-brief.md section 5) and source URL diversity
  * SOURCE LEDGER ENFORCEMENT: no requirement row may cite a source that
    tools/source_ledger.json marks FOREIGN or JUNK (a different game)
  * QA rows must state an observable outcome, not just re-cite a requirement ID

Usage:  python3 tools/validate_requirements.py [--json]
Exit code 0 = all hard checks pass, 1 = at least one hard failure.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REQ_DIR = ROOT / "docs" / "requirements"
BRIEF = ROOT / "docs" / "00-research-brief.md"

ID_RE = re.compile(r"\b(FR|NFR|QA)-([A-Z]{2,6})-(\d{3})\b")
URL_RE = re.compile(r"https?://[^\s|)\]<>\"'`]+")
SECTION_RE = re.compile(r"^##\s+(\d{1,2})\.", re.M)
# A requirement row is any line that starts with a pipe. Rows may legitimately carry a
# second source after a trailing "<br>URL", so the row does not have to end with "|".
TABLE_ROW_RE = re.compile(r"^\s*\|")
EXPECTED_SECTIONS = list(range(0, 13))
MIN_FR, MIN_NFR, MIN_QA = 60, 8, 12

# House vocabulary — research brief §4a. Exact values only.
STAGE_VALUES = {"Mobile", "PC-EA", "Both", "Design"}
PRIORITY_VALUES = {"Must", "Should", "Could"}
REBUILDABLE_VALUES = {"yes", "no", "partial"}

# Per-domain minimums are the contract from the brief; the validator enforces them.
HARD_FAILURES: list[str] = []
WARNINGS: list[str] = []


def strip_links(text: str) -> str:
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    return text


def cells(line: str) -> list[str]:
    raw = line.strip().strip("|")
    return [c.strip() for c in raw.split("|")]


def oq_has_source(doc_text: str, oq_id: str) -> bool:
    """True when the document's Open Questions section defines `oq_id` with a source URL
    or an explicit TBD, so a row may legitimately point at it instead of a URL."""
    for line in doc_text.splitlines():
        if oq_id in line and line.strip().startswith("|"):
            if URL_RE.search(line) or "TBD" in line.upper():
                return True
    return False


def main() -> int:
    as_json = "--json" in sys.argv
    files = sorted(REQ_DIR.glob("*.md"))
    if not files:
        print("FAIL: no requirement documents found in", REQ_DIR)
        return 1

    ledger = {}
    ledger_path = ROOT / "tools" / "source_ledger.json"
    if ledger_path.exists():
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    yt_verdict = ledger.get("youtube", {})
    host_verdict = ledger.get("hosts", {})
    url_verdict = ledger.get("url_overrides", {})

    def source_verdict(url: str) -> str:
        m = re.search(r"youtube\.com/watch\?v=([\w-]{6,})", url)
        if m and m.group(1) in yt_verdict:
            return yt_verdict[m.group(1)].get("verdict", "UNKNOWN")
        host = re.sub(r"^https?://([^/]+).*", r"\1", url).lower()
        if host in host_verdict:
            return host_verdict[host].get("verdict", "UNKNOWN")
        for ov, meta in url_verdict.items():
            if url.startswith(ov.rstrip("/")):
                return meta.get("verdict", "UNKNOWN")
        # An unlisted host is an UNCHECKED host and must never pass silently.
        # (This is exactly how the Playkot "Supercity Friends Wiki" slipped through pass 1.)
        return "UNVERIFIED_HOST"

    brief_domains: dict[str, str] = {}
    if BRIEF.exists():
        brief = BRIEF.read_text(encoding="utf-8")
        for m in re.finditer(r"\|\s*BOT-(\d{2})\s*\|\s*`([A-Z]{2,6})`\s*\|", brief):
            brief_domains[m.group(2)] = m.group(1)

    global_ids: dict[str, str] = {}
    summary = []
    all_urls: dict[str, set[str]] = defaultdict(set)

    for f in files:
        text = f.read_text(encoding="utf-8")
        lines = text.splitlines()
        rel = str(f.relative_to(ROOT))

        secs = sorted({int(s) for s in SECTION_RE.findall(text)})
        missing_secs = [s for s in EXPECTED_SECTIONS if s not in secs]
        if missing_secs:
            HARD_FAILURES.append(f"{rel}: missing section(s) {missing_secs}")

        ids = ID_RE.findall(text)
        # A requirement is DEFINED where its ID is the first cell of a table row.
        # IDs appearing elsewhere (acceptance-criteria columns, traceability lists) are
        # cross-references, not duplicate definitions.
        def_ids: list[str] = []
        for line in lines:
            if not TABLE_ROW_RE.match(line):
                continue
            cs = cells(line)
            if cs and ID_RE.match(cs[0]):
                def_ids.append(ID_RE.match(cs[0]).group(0))
        counts = Counter(k for k, _, _ in ids)
        def_counts = Counter(i.split("-")[0] for i in def_ids)
        domains = {d for d in {i.split("-")[1] for i in def_ids} if d}
        own_domain = sorted(domains)[0] if domains else "???"
        if len(domains) > 1:
            HARD_FAILURES.append(f"{rel}: mixes domain codes {sorted(domains)}")

        # duplicate DEFINITIONS inside the file
        seen_def: Counter = Counter()
        for gid in def_ids:
            seen_def[gid] += 1
        dupes = {k: v for k, v in seen_def.items() if v > 1}
        if dupes:
            HARD_FAILURES.append(f"{rel}: ID defined more than once {dict(list(dupes.items())[:10])}")

        # numbering gaps (warning only)
        for kind in ("FR", "NFR", "QA"):
            nums = sorted({int(i.split("-")[2]) for i in def_ids if i.startswith(kind + "-")})
            if nums:
                expected = set(range(1, max(nums) + 1))
                gap = sorted(expected - set(nums))
                if gap:
                    WARNINGS.append(f"{rel}: {kind} numbering gaps at {gap[:12]}")

        # cross-file duplicate DEFINITIONS
        for gid in def_ids:
            if gid in global_ids:
                HARD_FAILURES.append(f"{rel}: ID {gid} already defined in {global_ids[gid]}")
            else:
                global_ids[gid] = rel

        # rows: does every FR/NFR row carry a source or TBD?
        missing_src = []
        weak_qa = []
        bad_sources = []
        unverified = []
        bad_vocab = []
        bad_shape = []
        rows_with_id = 0
        for line in lines:
            if not TABLE_ROW_RE.match(line):
                continue
            cs = cells(line)
            if not cs:
                continue
            head = cs[0]
            m = ID_RE.match(head)
            if not m:
                continue
            rows_with_id += 1
            kind = m.group(1)
            row = " ".join(cs)
            if kind == "QA":
                # QA table layout is: ID | Given | When | Then | Covers.
                # A real test states an observable outcome in "Then"; a "Then" that only
                # repeats requirement IDs is not a test.
                if len(cs) >= 5:
                    then_cell = cs[3]
                elif len(cs) >= 4:
                    then_cell = cs[2]
                else:
                    then_cell = cs[-1] if cs else ""
                only_ids = re.fullmatch(r"[A-Za-z0-9,.\-\s]*", then_cell or "") and bool(
                    re.search(r"(FR|NFR|QA)-[A-Z]{2,6}-\d{3}", then_cell or "")
                )
                # A "Then" that merely restates the requirement is not an observable outcome.
                # These are the vacuous phrasings a bot falls back on when it has no outcome.
                vacuous = re.fullmatch(
                    r"(the\s+)?(requirement|rule|behaviou?r|condition|constraint)s?\s*"
                    r"(is\s+|are\s+|remains?\s+|stays?\s+|will\s+be\s+)?"
                    r"(met|held|holds|satisfied|respected|honoured|honored|followed|obeyed|true|valid|"
                    r"in\s+effect)?\s*[.!]?",
                    then_cell.strip(),
                    re.I,
                )
                vacuous2 = re.fullmatch(
                    r"(it|that|this)\s+(works|holds|passes|succeeds|is\s+correct|is\s+met)\s*[.!]?",
                    then_cell.strip(),
                    re.I,
                )
                if not then_cell.strip() or only_ids or vacuous or vacuous2:
                    weak_qa.append(head)
                continue
            has_url = bool(URL_RE.search(row))
            has_tbd = "TBD" in row.upper()
            # House vocabulary (brief §4a) + the FR/NFR table shape:
            # ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source
            if len(cs) != 7:
                bad_shape.append(f"{head} ({len(cs)} cells)")
            else:
                if cs[2] not in PRIORITY_VALUES:
                    bad_vocab.append(f"{head} priority={cs[2]!r}")
                if cs[3] not in STAGE_VALUES:
                    bad_vocab.append(f"{head} stage={cs[3]!r}")
                if cs[4] not in REBUILDABLE_VALUES:
                    bad_vocab.append(f"{head} rebuildable={cs[4]!r}")
            oq_ok = False
            if not has_url and not has_tbd:
                for m2 in re.finditer(r"OQ-[A-Z]{2,6}-\d{2,3}", row):
                    if oq_has_source(text, m2.group(0)):
                        oq_ok = True
                        break
            if not has_url and not has_tbd and not oq_ok:
                missing_src.append(head)
            for u in URL_RE.findall(row):
                v = source_verdict(u.rstrip(".,;"))
                if v in ("FOREIGN", "JUNK"):
                    bad_sources.append(f"{head} -> {u[:110]}")
                elif v == "UNVERIFIED_HOST":
                    unverified.append(f"{head} -> {u[:110]}")
        if weak_qa:
            HARD_FAILURES.append(f"{rel}: {len(weak_qa)} QA row(s) with no stated outcome: {weak_qa[:8]}")
        if bad_shape:
            HARD_FAILURES.append(
                f"{rel}: {len(bad_shape)} FR/NFR row(s) not in the 7-column house layout "
                f"(ID | Requirement | Priority | Stage | Rebuildable? | Acceptance criteria | Source): "
                f"{bad_shape[:8]}"
            )
        if bad_vocab:
            HARD_FAILURES.append(
                f"{rel}: {len(bad_vocab)} FR/NFR row(s) with out-of-vocabulary Priority/Stage/Rebuildable "
                f"(allowed: Priority {sorted(PRIORITY_VALUES)}, Stage {sorted(STAGE_VALUES)}, "
                f"Rebuildable {sorted(REBUILDABLE_VALUES)}): {bad_vocab[:8]}"
            )
        if unverified:
            HARD_FAILURES.append(
                f"{rel}: {len(unverified)} row(s) cite a host with NO verdict in tools/source_ledger.json "
                f"(an unlisted host is an unchecked host and must be verified before it can be trusted): "
                f"{unverified[:8]}"
            )
        if bad_sources:
            HARD_FAILURES.append(
                f"{rel}: {len(bad_sources)} row(s) cite a FOREIGN/JUNK source (a different game): "
                f"{bad_sources[:8]}"
            )
        # Document-wide sweep: the row scan above only inspects requirement tables.
        # A FOREIGN or JUNK URL hiding in Section 1.1 (findings) or Section 12 (source list)
        # is still a foreign source, so the whole document is checked here.
        doc_foreign = []
        for ln_no, ln in enumerate(lines, 1):
            if not URL_RE.search(ln):
                continue
            for u in URL_RE.findall(ln):
                v = source_verdict(u.rstrip(".,;"))
                if v in ("FOREIGN", "JUNK"):
                    doc_foreign.append(f"L{ln_no} -> {u[:110]}")
        if doc_foreign:
            HARD_FAILURES.append(
                f"{rel}: {len(doc_foreign)} FOREIGN/JUNK URL(s) anywhere in the document (including "
                f"Section 1.1 findings and the Section 12 source list, which the requirement-row scan "
                f"does not cover): {doc_foreign[:8]}"
            )
        if missing_src:
            HARD_FAILURES.append(
                f"{rel}: {len(missing_src)} requirement row(s) without source or TBD: {missing_src[:8]}"
            )

        urls = set(URL_RE.findall(text))
        for u in urls:
            all_urls[own_domain].add(u)

        if def_counts["FR"] < MIN_FR:
            HARD_FAILURES.append(f"{rel}: only {def_counts['FR']} FR defined (min {MIN_FR})")
        if def_counts["NFR"] < MIN_NFR:
            HARD_FAILURES.append(f"{rel}: only {def_counts['NFR']} NFR defined (min {MIN_NFR})")
        if def_counts["QA"] < MIN_QA:
            HARD_FAILURES.append(f"{rel}: only {def_counts['QA']} QA defined (min {MIN_QA})")
        if len(urls) < 8:
            WARNINGS.append(f"{rel}: only {len(urls)} distinct source URLs")

        tbd = len(re.findall(r"\bTBD\b", text))
        summary.append(
            {
                "file": rel,
                "domain": own_domain,
                "bot": brief_domains.get(own_domain, "?"),
                "fr": def_counts["FR"],
                "nfr": def_counts["NFR"],
                "qa": def_counts["QA"],
                "mentions_total": len(ids),
                "unique_urls": len(urls),
                "rows_with_id": rows_with_id,
                "tbd_markers": tbd,
                "lines": len(lines),
                "words": len(text.split()),
                "sections_missing": missing_secs,
            }
        )

    # every bot in the brief must have produced a doc
    partial = "--partial" in sys.argv
    produced = {s["domain"] for s in summary}
    for code, bot in brief_domains.items():
        if code not in produced:
            msg = f"missing requirement document for BOT-{bot} domain {code}"
            (WARNINGS if partial else HARD_FAILURES).append(msg)

    total_fr = sum(s["fr"] for s in summary)
    total_nfr = sum(s["nfr"] for s in summary)
    total_qa = sum(s["qa"] for s in summary)
    union_urls = set().union(*all_urls.values()) if all_urls else set()

    if not as_json:
        print("=" * 92)
        print("SUPERCITYCON REQUIREMENTS — VALIDATION REPORT")
        print("=" * 92)
        print(f"{'file':<52} {'bot':<5} {'FR':>4} {'NFR':>4} {'QA':>4} {'urls':>5} {'lines':>6} {'words':>7}")
        print("-" * 92)
        for s in sorted(summary, key=lambda x: x["file"]):
            print(
                f"{s['file']:<52} {s['bot']:<5} {s['fr']:>4} {s['nfr']:>4} {s['qa']:>4} "
                f"{s['unique_urls']:>5} {s['lines']:>6} {s['words']:>7}"
            )
        print("-" * 92)
        print(
            f"{'TOTAL':<52} {'':<5} {total_fr:>4} {total_nfr:>4} {total_qa:>4} "
            f"{len(union_urls):>5}"
        )
        print(f"\ndistinct source URLs across all documents: {len(union_urls)}")
        print(
            f"total DEFINED requirement IDs: {total_fr + total_nfr + total_qa} "
            f"(a definition = the first cell of a requirement table row; cross-references are not counted)"
        )
        if WARNINGS:
            print("\nWARNINGS")
            for w in WARNINGS:
                print("  - " + w)
        if HARD_FAILURES:
            print("\nHARD FAILURES")
            for h in HARD_FAILURES:
                print("  ✗ " + h)
            print(f"\nRESULT: FAIL ({len(HARD_FAILURES)} hard failures)")
        else:
            print("\nRESULT: PASS (0 hard failures)")

    payload = {
        "documents": summary,
        "foreign_source_rows": sum(1 for s2 in summary for _ in ()),
        "hard_failure_count": len(HARD_FAILURES),
        "totals": {
            "fr": total_fr,
            "nfr": total_nfr,
            "qa": total_qa,
            "defined_ids": total_fr + total_nfr + total_qa,
            "distinct_urls": len(union_urls),
        },
        "hard_failures": HARD_FAILURES,
        "warnings": WARNINGS,
        "ok": not HARD_FAILURES,
    }
    (ROOT / "docs" / "validation-report.json").write_text(
        json.dumps(payload, indent=2) + "\n", encoding="utf-8"
    )
    if not as_json:
        print(f"\nreport written: docs/validation-report.json")
    return 0 if not HARD_FAILURES else 1


if __name__ == "__main__":
    sys.exit(main())
