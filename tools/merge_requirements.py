#!/usr/bin/env python3
"""
Merge the ten SuperCitycon requirement documents into one master requirement document.

Produces docs/SUPER-CITYCON-MASTER-REQUIREMENTS.md containing:
  * title page, scope, coverage statistics, bot roster
  * a master index of every requirement ID (title, priority, stage, source)
  * the ten domain documents in full (headings demoted one level)
  * Appendix A — consolidated source index (URL -> domains -> requirement rows)
  * Appendix B — consolidated stage / progression matrices (Section 5 of each doc)
  * Appendix C — consolidated open questions & TBDs (Section 11 of each doc)
  * Appendix D — cross-domain ownership & dependency map, ID convention

Usage:  python3 tools/merge_requirements.py
"""
from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REQ_DIR = ROOT / "docs" / "requirements"
BRIEF = ROOT / "docs" / "00-research-brief.md"
OUT = ROOT / "docs" / "SUPER-CITYCON-MASTER-REQUIREMENTS.md"

ID_RE = re.compile(r"\b(FR|NFR|QA)-([A-Z]{2,6})-(\d{3})\b")
URL_RE = re.compile(r"https?://[^\s|)\]<>\"'`]+")
PRI_RE = re.compile(r"\b(Must|Should|Could)\b")
# House stage vocabulary (see docs/00-research-brief.md section 5):
#   Mobile | PC-EA | Both | Design
STAGE_RE = re.compile(
    r"^(mobile|pc-ea|both|design|n/a|none|any|all|early|mid|late|global|per[- ]map)([\s/].*)?$",
    re.I,
)

ORDER = [
    ("CORE", "01-core-loop-modes-progression.md", "BOT-01", "Core loop, modes, city stages, progression, unlocks"),
    ("WLD", "02-world-terrain-water-grid.md", "BOT-02", "World, terraforming, grid, terrain, water, map creation"),
    ("MOB", "03-mobility-traffic-logistics.md", "BOT-03", "Roads, rails, transit, traffic, logistics"),
    ("ECO", "04-economy-budget-resources.md", "BOT-04", "Economy, budget, costs, resources, production chains"),
    ("POP", "05-population-citizens-happiness.md", "BOT-05", "Population, citizens, needs, happiness, wealth, diversity, loyalty"),
    ("SRV", "06-services-coverage.md", "BOT-06", "City services, coverage, service buildings"),
    ("BLD", "07-building-catalogue-properties.md", "BOT-07", "Building catalogue, properties, tiers, upgrades, inventory"),
    ("STD", "08-scc-studio-voxel-editor-workshop.md", "BOT-08", "SCC Studio voxel editor, modding, Workshop, characters"),
    ("UX", "09-ui-ux-hud-camera-controls.md", "BOT-09", "UI/UX, HUD, camera, controls, onboarding, accessibility"),
    ("TEC", "10-presentation-audio-technical.md", "BOT-10", "Presentation, art direction, audio, simulation tech, platform"),
]


def cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def demote(text: str) -> str:
    out = []
    in_fence = False
    for line in text.splitlines():
        if line.strip().startswith("```"):
            in_fence = not in_fence
            out.append(line)
            continue
        if not in_fence and re.match(r"^(#{1,5}) ", line):
            hashes, rest = line.split(" ", 1)
            line = "#" + hashes + " " + rest
        out.append(line)
    return "\n".join(out)


def parse_rows(text: str) -> list[dict]:
    rows = []
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            continue
        cs = cells(line)
        if not cs or not ID_RE.match(cs[0]):
            continue
        rid = ID_RE.match(cs[0]).group(0)
        title = cs[1] if len(cs) > 1 else ""
        if title.lower().startswith("requirement"):
            title = cs[2] if len(cs) > 2 else title
        pri = ""
        stage = ""
        for c in cs[2:]:
            if not pri and PRI_RE.search(c):
                pri = PRI_RE.search(c).group(1)
            if not stage and STAGE_RE.search(c) and len(c) < 40:
                stage = c
        url = URL_RE.search(" ".join(cs))
        rows.append(
            {
                "id": rid,
                "title": re.sub(r"\s+", " ", title)[:150],
                "priority": pri,
                "stage": stage[:30],
                "source": url.group(0) if url else "",
            }
        )
    return rows


def extract_section(text: str, number: int) -> str:
    m = re.search(rf"^##\s+{number}\.\s.*$", text, re.M)
    if not m:
        return ""
    start = m.start()
    nxt = re.search(r"^##\s+\d{1,2}\.\s.*$", text[m.end():], re.M)
    end = m.end() + nxt.start() if nxt else len(text)
    return text[start:end].strip()


def main() -> int:
    missing = [f for _, f, _, _ in ORDER if not (REQ_DIR / f).exists()]
    if missing:
        print("NOTE: not yet available, merging without:", ", ".join(missing))

    docs = {}
    for code, fname, bot, desc in ORDER:
        p = REQ_DIR / fname
        if p.exists():
            docs[code] = p.read_text(encoding="utf-8")

    all_rows: list[dict] = []
    for code, (fname, bot, desc) in ((c, (f, b, d)) for c, f, b, d in ORDER):
        if code not in docs:
            continue
        for r in parse_rows(docs[code]):
            r["domain"] = code
            r["bot"] = bot
            all_rows.append(r)

    seen: set[str] = set()
    dupes = [r["id"] for r in all_rows if r["id"] in seen or seen.add(r["id"])]
    if dupes:
        print(f"ERROR: duplicate requirement IDs across documents: {sorted(set(dupes))[:20]}")
        return 1

    counts = Counter(r["id"].split("-")[0] for r in all_rows)
    src_by_url: dict[str, dict] = defaultdict(lambda: {"domains": set(), "ids": [], "bots": set()})
    for r in all_rows:
        if r["source"]:
            e = src_by_url[r["source"]]
            e["domains"].add(r["domain"])
            e["ids"].append(r["id"])
            e["bots"].add(r["bot"])
    for code, text in docs.items():
        for u in set(URL_RE.findall(text)):
            src_by_url[u]["domains"].add(code)

    # ------------------------------------------------------------------ build
    L: list[str] = []
    A = L.append
    A("# SuperCitycon — Master Requirements Specification")
    A("")
    A("> **Exact-replication requirement dossier for SuperCitycon**, assembled by ten requirement-level "
      "research bots from primary sources (official site, Steam store + Steam Community, the official "
      "YouTube how-to catalogue, the official blog, App Store / Google Play listings, and the developer's "
      "own Reddit posts).")
    A("> Every requirement cites a source URL from the verified ledger (see `docs/SOURCE-VERIFICATION.md`) "
      "or is explicitly marked `TBD`. Unknown values are named as decisions to be made, not silently "
      "guessed. Source identity was checked against each page's own title/channel, because two of the "
      "original evidence bases turned out to belong to different games.")
    A("")
    A("| | |")
    A("|---|---|")
    A(f"| Generated | {__import__('datetime').date.today().isoformat()} |")
    A(f"| Documents merged | {len(docs)} of {len(ORDER)} |")
    A(f"| Functional requirements (FR) | **{counts['FR']}** |")
    A(f"| Non-functional requirements (NFR) | **{counts['NFR']}** |")
    A(f"| Acceptance-criteria suites (QA) | **{counts['QA']}** |")
    A(f"| Total tracked requirement IDs | **{len(all_rows)}** |")
    A(f"| Distinct source URLs | **{len(src_by_url)}** |")
    A("| Target implementation | browser-based 3D (MiniMax Code / Three.js-class web stack) |")
    A("")
    A("---")
    A("")
    A("## How to use this document")
    A("")
    A("1. **Section 1 — Master index.** Every requirement in one table: ID, title, priority, stage, source. "
      "Sort/filter it to build a backlog or sprint plan.")
    A("2. **Parts I–X — The ten domain specifications.** Each part is one bot's complete, self-contained "
      "specification, following a fixed contract: observed behaviour → system overview → functional "
      "requirements → options matrix → stage/progression matrix → data model → rules & formulas → edge "
      "cases → non-functional requirements → acceptance suites → open questions → source list.")
    A("3. **Appendix A — Source index.** Every URL, which domains used it, which requirement rows cite it.")
    A("4. **Appendix B — Stage matrices.** All ten stage/progression tables side by side.")
    A("5. **Appendix C — Open questions.** Every `TBD` across the dossier, with its proposed default.")
    A("6. **Appendix D — Ownership map.** Which bot owns what, so a change in one place is not silently "
      "duplicated in another.")
    A("")
    A("### Requirement ID convention")
    A("")
    A("`FR-<DOMAIN>-<NNN>` · `NFR-<DOMAIN>-<NNN>` · `QA-<DOMAIN>-<NNN>` — domain codes are unique, "
      "so an ID identifies exactly one requirement in exactly one domain.")
    A("")
    A("### Evidence markers used throughout")
    A("")
    A("| Marker | Meaning |")
    A("|---|---|")
    A("| `[CONFIRMED]` | Stated directly in a cited source. |")
    A("| `[INFERRED]` | Strongly implied by cited sources; the inference is stated. |")
    A("| `[TBD]` | Not publicly documented — a design decision the rebuild team must take. |")
    A("| *shipped today* / *mobile-only today* / *planned for Early Access* | Product-surface status. |")
    A("")
    A("---")
    A("")
    A("## Bot roster")
    A("")
    A("| Bot | Domain code | Owns | File | Status |")
    A("|---|---|---|---|---|")
    for code, fname, bot, desc in ORDER:
        st = "**delivered**" if code in docs else "_pending_"
        A(f"| {bot} | `{code}` | {desc} | `docs/requirements/{fname}` | {st} |")
    if missing:
        A("")
        A(f"> **This build merges {len(docs)} of {len(ORDER)} domain specifications.** "
          f"Still to land: {', '.join(sorted(set(c for c, f, _, _ in ORDER if f in missing)))}. "
          "Re-run `python3 tools/merge_requirements.py` once they arrive to produce the full dossier.")
    A("")
    A("---")
    A("")

    # ------------------------------------------------------- 1. master index
    A("## 1. Master requirement index")
    A("")
    A(f"All {len(all_rows)} tracked requirements, grouped by domain and ordered by ID.")
    A("")
    for code, fname, bot, desc in ORDER:
        rows = [r for r in all_rows if r["domain"] == code]
        if not rows:
            continue
        A(f"### {bot} · `{code}` — {desc}")
        A("")
        A("| ID | Requirement | Priority | Stage | Source |")
        A("|---|---|---|---|---|")
        for r in sorted(rows, key=lambda x: (x["id"].split("-")[0], x["id"])):
            src = f"[link]({r['source']})" if r["source"] else "TBD"
            title = r["title"].replace("|", "\\|")
            A(f"| `{r['id']}` | {title} | {r['priority'] or '—'} | {r['stage'] or '—'} | {src} |")
        A("")

    A("---")
    A("")

    # ------------------------------------------------------- 2. full documents
    A("## 2. Domain specifications (full text)")
    A("")
    for idx, (code, fname, bot, desc) in enumerate(ORDER, start=1):
        if code not in docs:
            continue
        A(f"## Part {['I','II','III','IV','V','VI','VII','VIII','IX','X'][idx-1]} — {bot} · `{code}` — {desc}")
        A("")
        A(f"> Source file: `docs/requirements/{fname}`")
        A("")
        body = demote(docs[code])
        # drop the original H1 (now H2) title, we already have the part heading
        body = re.sub(r"^##\s+.*\n", "", body, count=1)
        A(body)
        A("")
        A("---")
        A("")

    # ------------------------------------------------------- appendix A
    A("## Appendix A — Consolidated source index")
    A("")
    A(f"{len(src_by_url)} distinct URLs were consulted. A URL listed for several domains was used as "
      "cross-cutting evidence.")
    A("")
    A("| # | URL | Domains | Req rows | Bots |")
    A("|---|---|---|---|---|")
    for i, (url, e) in enumerate(sorted(src_by_url.items(), key=lambda kv: (-len(kv[1]["ids"]), kv[0])), 1):
        A(f"| {i} | {url} | {', '.join(sorted(e['domains']))} | {len(e['ids'])} | {', '.join(sorted(e['bots']))} |")
    A("")
    A("---")
    A("")

    # ------------------------------------------------------- appendix B
    A("## Appendix B — Consolidated stage / progression matrices")
    A("")
    A("Every domain's Section 5, reproduced side by side so the city-stage model can be read as one system.")
    A("")
    for code, fname, bot, desc in ORDER:
        sec = extract_section(docs.get(code, ""), 5)
        if not sec:
            if code not in docs:
                continue
            A(f"### {bot} · `{code}`")
            A("")
            A("_No stage matrix section found in the source document._")
            A("")
            continue
        A(demote(sec.replace("## 5.", "###", 1)))
        A("")

    A("---")
    A("")

    # ------------------------------------------------------- appendix C
    A("## Appendix C — Consolidated open questions & TBDs")
    A("")
    A("Every unresolved item across the dossier. Each is a decision the rebuild team must take before the "
      "corresponding requirement can be implemented.")
    A("")
    for code, fname, bot, desc in ORDER:
        sec = extract_section(docs.get(code, ""), 11)
        if not sec:
            continue
        A(demote(sec.replace("## 11.", "###", 1)))
        A("")

    A("---")
    A("")

    # ------------------------------------------------------- appendix D
    A("## Appendix D — Cross-domain ownership & dependency map")
    A("")
    if BRIEF.exists():
        brief = BRIEF.read_text(encoding="utf-8")
        sec = extract_section(brief, 6)
        if sec:
            A(demote(sec.replace("## 6.", "###", 1)))
            A("")
    A("### ID prefix table")
    A("")
    A("| Prefix | Domain | Meaning |")
    A("|---|---|---|")
    for code, fname, bot, desc in ORDER:
        A(f"| `{code}-` | {desc} | Owned by {bot}. |")
    A("")
    A("### Reading order for implementation")
    A("")
    A("The dossier is not a build order, but these dependencies are hard:")
    A("")
    A("1. **`WLD`** — the terrain and grid must exist before anything can be placed on it.")
    A("2. **`MOB`** — roads define the connectivity graph that `ECO` (service coverage, logistics) and "
      "`MOB`/`POP` (citizen routing) depend on.")
    A("3. **`BLD`** — the building catalogue and its property schema are the data contract consumed by "
      "`ECO`, `SRV`, `POP` and `UX`.")
    A("4. **`ECO`** — costs, supply/demand and production chains are consumed by `POP` and `BLD`.")
    A("5. **`SRV`** — coverage maths feeds `POP` (happiness) and `ECO` (budget).")
    A("6. **`POP`** — happiness and the six growth bonuses feed the scoring loop in `CORE`.")
    A("7. **`STD`** — the voxel editor must emit assets conforming to the `BLD` property schema and the "
      "`WLD` terrain-set format; it is a producer, not a consumer.")
    A("8. **`UX`** — the HUD and camera layer renders whatever the other domains produce.")
    A("9. **`TEC`** — rendering, persistence and performance bind everything together.")
    A("")
    A("---")
    A("")
    A(f"_End of master specification. Assembled from {len(docs)} of {len(ORDER)} bot documents, "
      f"{counts['FR']} functional + {counts['NFR']} non-functional + {counts['QA']} acceptance-suite "
      f"requirements, {len(src_by_url)} distinct sources._")
    A("")

    OUT.write_text("\n".join(L), encoding="utf-8")
    size = OUT.stat().st_size
    print(f"master document written: {OUT.relative_to(ROOT)}")
    print(f"  bytes={size}  lines={len(OUT.read_text(encoding='utf-8').splitlines())}  "
          f"FR={counts['FR']} NFR={counts['NFR']} QA={counts['QA']} "
          f"sources={len(src_by_url)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
