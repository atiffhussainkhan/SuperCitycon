#!/usr/bin/env python3
"""Verify the five development bots against the design they implement.

The design gate (`verify_design.py`) proves the documents agree with each other.
This gate proves the **development bots** agree with the documents: that every
requirement has an owner, that the owner's scope table is the design's own
traceability matrix, and that no two bots claim the same files.

Usage:
    python3 tools/verify_devbots.py [--agents-dir DIR]

Exit code 0 when every check passes, 1 otherwise.
"""

from __future__ import annotations

import argparse
import collections
import pathlib
import os
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
DOCS = HERE.parent / "platformer-docs"
DEFAULT_AGENTS = pathlib.Path.home() / ".minimax" / "agents"

BOTS = {
    "pd-dev-platform": "ARCHITECTURE",
    "pd-dev-player": "PLAYER",
    "pd-dev-entities": "ENTITIES",
    "pd-dev-world": "WORLD",
    "pd-dev-assets": "ASSETS",
}

# Every development bot must carry these sections, or its contract is incomplete.
REQUIRED_SECTIONS = [
    "The binding contract",
    "Files you own",
    "Non-negotiable engineering rules",
    "Definition of done",
]

# The five design boards, in the same order as the master matrix.
REQUIRED_REQS = {f"REQ-{letter}-{n:03d}"
                 for letter in "ABCDE"
                 for n in range(1, 22)
                 if not (letter in "CDE" and n > 20)}

REQUIRED_NFRS = {f"NFR-{n:02d}" for n in range(1, 11)}

results: list[tuple[str, str]] = []


def rec(level: str, message: str) -> None:
    results.append((level, message))
    print(f"[{level}] {message}")


def parse_matrix(path: pathlib.Path) -> dict[str, dict[str, str]]:
    """Read the traceability matrix out of the architecture board.

    The master document's §8.1 is generated from this table, so this is the
    single authoritative statement of who owns what.
    """
    rows: dict[str, dict[str, str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 7:
            continue
        if re.fullmatch(r"REQ-[A-E]-\d{3}", cells[0]):
            rows[cells[0]] = {"owner": cells[2], "artefact": cells[3],
                              "section": cells[4], "ac": cells[5]}
        elif re.fullmatch(r"NFR-\d{2}", cells[0]):
            rows[cells[0]] = {"owner": cells[2], "artefact": cells[3],
                              "section": cells[4], "ac": cells[5]}
    return rows


def owner_of(cell: str) -> str:
    return cell.split("(")[0].strip().strip("*").upper()


def consumer_of(cell: str) -> str | None:
    m = re.search(r"\(([A-Z]+)\s+consumer\)", cell, re.I)
    return m.group(1).upper() if m else None


def expand_braces(pattern: str) -> list[str]:
    """Expand `a/{b,c}/d` into its concrete alternatives."""
    m = re.search(r"\{([^{}]*)\}", pattern)
    if not m:
        return [pattern]
    out: list[str] = []
    for alt in m.group(1).split(","):
        out.extend(expand_braces(pattern[:m.start()] + alt.strip()
                                 + pattern[m.end():]))
    return out


def split_pattern(pattern: str) -> tuple[str, str]:
    """Split a glob into (directory prefix, leaf glob).

    `src/core/math/**` -> ('src/core/math', '**')
    `src/systems/input.**` -> ('src/systems', 'input.**')
    `src/tools/audit.py` -> ('src/tools', 'audit.py')
    """
    cleaned = pattern.split(" ")[0].strip().strip("`")
    if "/" in cleaned:
        head, _, tail = cleaned.rpartition("/")
        return head, tail
    return "", cleaned


def covers(outer: tuple[str, str], inner: tuple[str, str]) -> bool:
    """True when `outer` would also claim a file that `inner` claims."""
    o_dir, o_leaf = outer
    i_dir, i_leaf = inner
    if o_dir == i_dir:
        # same directory: a clash only if the leaf globs can match the same name
        return o_leaf == i_leaf or o_leaf == "**" or i_leaf == "**"
    if not o_dir:
        return False
    # a subtree pattern (`dir/**`) claims everything beneath it
    if o_leaf == "**" and i_dir.startswith(o_dir + "/"):
        return True
    # a concrete file name in a directory claims that file, not a sibling tree
    return False


def owned_paths(text: str) -> list[str]:
    m = re.search(r"## Files you own\n\n```\n(.*?)```", text, re.S)
    if not m:
        return []
    out: list[str] = []
    for line in m.group(1).splitlines():
        line = line.strip()
        if not line or line.startswith("("):
            continue
        # a line may hold several space-separated paths; the parenthetical
        # prose after a path is not a path
        line = re.sub(r"\(.*?\)", " ", line)
        for token in line.split():
            token = token.strip("`,")
            if token:
                out.append(token)
    return out


def parse_tree(text: str) -> tuple[set[str], set[str]]:
    """The directories and files enumerated by the architecture board's §4.1 tree.

    The tree is the design's authority on what may exist in the project. A bot
    that claims a path outside it has named a file that will never be created,
    so this gate has to actually read the tree rather than guess at its shape.
    """
    m = re.search(r"### 4\.1 Folder tree\n\n```\n(.*?)```", text, re.S)
    if not m:
        return set(), set()
    dirs: set[str] = set()
    files: set[str] = set()
    stack: list[str] = []          # stack[d] = directory name at depth d
    for raw in m.group(1).splitlines():
        if not raw.strip():
            continue
        j = raw.find("──")
        if j == -1:
            continue
        # the box-drawing prefix encodes the depth: four columns per level
        depth = (len(raw[:j]) + 4) // 4 - 1
        rest = re.sub(r"\s+#.*$", "", raw[j + 2:]).strip()
        for name in rest.split():
            clean = name.rstrip("/")
            del stack[depth:]
            if name.endswith("/"):
                stack.append(clean)
                dirs.add("/".join(stack))
            else:
                files.add("/".join(stack + [clean]))
    return dirs, files


def normalise(text: str) -> str:
    """Strip markdown emphasis so a cosmetic difference is not a content one."""
    return re.sub(r"\s+", " ", text.replace("*", "").replace("`", "")).strip()


def bot_scope_rows(text: str) -> dict[str, str]:
    """REQ id -> the acceptance-test cell the bot publishes for it."""
    out: dict[str, str] = {}
    for line in text.splitlines():
        m = re.match(r"^\|\s*`((?:REQ|NFR)-[A-Z0-9-]+)`\s*\|(.*)$", line)
        if not m:
            continue
        cells = [c.strip() for c in m.group(2).strip().strip("|").split("|")]
        if len(cells) >= 2:
            out[m.group(1)] = cells[-1]
    return out


def content_kind_set_mismatch(declared: set[str], design_kinds: set[str]) -> list[str]:
    """Return the content kinds on which two sets disagree.

    The thirteenth review found that the ownership check compared **lengths**,
    so two equal-sized but different kind sets could agree on the number and
    disagree on the content while the bots still matched §8.3. This is the
    stricter rule, as a pure function so it can be fault-injected with the
    review's exact input.
    """
    return sorted(declared ^ design_kinds)


def check_published_figures(master: str, expected_pass: int) -> None:
    """The master must publish the dev-bot gate figures this run produced."""
    if "@@DEVBOTS_GATE@@" in master:
        if os.environ.get("MASTER_BUILDING"):
            rec("PASS", "published figures: the master's dev-bot gate figure is being "
                        "measured by the builder this run")
            return
        rec("FAIL", "published figures: the master still carries the builder's "
                    "placeholder — the gate figure was never measured")
        return
    m = re.search(r"verify_devbots\.py` → \*\*0 FAIL, (\d+) PASS\*\*", master)
    if not m:
        rec("FAIL", "published figures: the master does not publish a "
                    "verify_devbots.py pass count")
        return
    if any(level == "FAIL" for level, _ in results):
        rec("FAIL", f"published figures: this run has failures, so the master's "
                    f"published figure certifies nothing")
        return
    if int(m.group(1)) != expected_pass:
        rec("FAIL", f"published figures: the master claims verify_devbots.py → 0 FAIL, "
                    f"{m.group(1)} PASS, but this run has {expected_pass} PASS")
        return
    rec("PASS", "published figures: the master's stated dev-bot gate count matches "
                "this run")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--agents-dir", default=str(DEFAULT_AGENTS))
    args = ap.parse_args()
    agents = pathlib.Path(args.agents_dir).expanduser()

    matrix = parse_matrix(DOCS / "DESIGN-3-ARCHITECTURE.md")
    if not matrix:
        rec("FAIL", "could not read the traceability matrix from the architecture board")
        return 1

    missing_files = [b for b in BOTS if not (agents / b / "agent.md").exists()]
    if missing_files:
        rec("FAIL", f"{len(missing_files)} development bot(s) not found in {agents}: "
                    f"{', '.join(missing_files)}")
        return 1

    texts = {b: (agents / b / "agent.md").read_text(encoding="utf-8")
             for b in BOTS}

    # --- 1. every bot carries a complete contract -------------------------
    bad_sections = []
    for bot, text in texts.items():
        for section in REQUIRED_SECTIONS:
            if section not in text:
                bad_sections.append(f"{bot} is missing '{section}'")
    if bad_sections:
        rec("FAIL", f"{len(bad_sections)} contract section(s) missing")
        for s in bad_sections:
            rec("FAIL", f"  {s}")
    else:
        rec("PASS", f"every development bot carries all {len(REQUIRED_SECTIONS)} "
                    f"required contract sections")

    # --- 2. every requirement has exactly one owning bot -------------------
    scope: dict[str, list[str]] = collections.defaultdict(list)
    for bot, text in texts.items():
        for rid in re.findall(r"^\| `(REQ-[A-E]-\d{3})`", text, re.M):
            scope[rid].append(bot)

    uncovered = sorted(REQUIRED_REQS - set(scope))
    if uncovered:
        rec("FAIL", f"{len(uncovered)} requirement(s) appear in no development bot's "
                    f"scope table")
        for r in uncovered:
            rec("FAIL", f"  {r}")
    else:
        rec("PASS", f"all {len(REQUIRED_REQS)} requirements appear in at least one "
                    f"development bot's scope table")

    # --- 3. the scope tables match the matrix exactly ----------------------
    mismatched = []
    for bot, token in BOTS.items():
        expected = {r for r, row in matrix.items()
                    if r.startswith("REQ-") and owner_of(row["owner"]) == token}
        got = {r for r in scope if bot in scope[r]}
        # a bot may also list a requirement it consumes rather than owns
        consumed = {r for r, row in matrix.items()
                    if r.startswith("REQ-") and consumer_of(row["owner"]) == token}
        extra = got - expected - consumed
        missing = expected - got
        if extra:
            mismatched.append(f"{bot} lists {sorted(extra)} which the matrix does not "
                              f"assign to it")
        if missing:
            mismatched.append(f"{bot} omits {sorted(missing)} which the matrix "
                              f"assigns to it")
    if mismatched:
        rec("FAIL", f"{len(mismatched)} scope-table disagreement(s) with the matrix")
        for m in mismatched:
            rec("FAIL", f"  {m}")
    else:
        rec("PASS", "every development bot's scope table matches the design "
                    "traceability matrix exactly")

    # --- 4. cross-board rows are handled by exactly two bots ----------------
    cross = [r for r, row in matrix.items()
             if r.startswith("REQ-") and consumer_of(row["owner"])]
    bad_cross = [f"{r} is listed by {len(scope[r])} bot(s), expected 2"
                 for r in cross if len(scope.get(r, [])) != 2]
    if bad_cross:
        rec("FAIL", f"{len(bad_cross)} cross-board requirement(s) are not handled by "
                    f"exactly two bots")
        for b in bad_cross:
            rec("FAIL", f"  {b}")
    else:
        rec("PASS", f"all {len(cross)} cross-board requirements are handled by both "
                    f"the owning board and the consuming board")

    # --- 5. the non-functional requirements have an owner -------------------
    nfr_missing = []
    for nid in sorted(REQUIRED_NFRS):
        row = matrix.get(nid)
        if not row:
            nfr_missing.append(f"{nid} is not in the matrix")
            continue
        token = owner_of(row["owner"])
        bot = next((b for b, t in BOTS.items() if t == token), None)
        if bot and f"| `{nid}` |" not in texts[bot]:
            nfr_missing.append(f"{nid} is not in {bot}'s scope table")
    if nfr_missing:
        rec("FAIL", f"{len(nfr_missing)} non-functional requirement(s) are unowned")
        for n in nfr_missing:
            rec("FAIL", f"  {n}")
    else:
        rec("PASS", f"all {len(REQUIRED_NFRS)} non-functional requirements have an "
                    f"owning development bot")

    # --- 6. no two bots own the same file ----------------------------------
    owned: dict[str, list[str]] = collections.defaultdict(list)
    for bot, text in texts.items():
        for pattern in owned_paths(text):
            for expanded in expand_braces(pattern):
                owned[expanded].append(bot)
    clashes: list[str] = []
    seen: set[tuple[str, str]] = set()
    for pattern, bots in owned.items():
        for other_pattern, other_bots in owned.items():
            for a in set(bots):
                for b in set(other_bots):
                    if a == b:
                        continue
                    # Two bots claiming the *same* path is the most direct clash
                    # there is, so it is checked before the containment test.
                    if pattern == other_pattern:
                        overlap = True
                    else:
                        overlap = covers(split_pattern(pattern),
                                         split_pattern(other_pattern))
                    if not overlap:
                        continue
                    key = tuple(sorted((a, b)))
                    if key in seen:
                        continue
                    seen.add(key)
                    clashes.append(f"{a} owns `{pattern}` and {b} owns "
                                   f"`{other_pattern}` — they overlap")
    if clashes:
        rec("FAIL", f"{len(clashes)} ownership overlap(s) between development bots")
        for c in sorted(set(clashes)):
            rec("FAIL", f"  {c}")
    else:
        rec("PASS", f"no two development bots own the same file "
                    f"({len(owned)} expanded path patterns checked)")

    # --- 6b. the bots' paths must exist in the design's folder tree ---------
    tree = (DOCS / "DESIGN-3-ARCHITECTURE.md").read_text(encoding="utf-8")
    tree_dirs, tree_files = parse_tree(tree)
    off_tree = []
    for bot, text in texts.items():
        for pattern in owned_paths(text):
            for expanded in expand_braces(pattern):
                directory, leaf = split_pattern(expanded)
                if not directory:
                    # a top-level file: `project.godot`, `godot.version`
                    if leaf not in tree_files:
                        off_tree.append(f"{bot} owns `{expanded}` — not a file in the "
                                        f"design's folder tree (§4.1)")
                    continue
                if directory not in tree_dirs:
                    off_tree.append(f"{bot} owns `{expanded}` — `{directory}` is not a "
                                    f"directory in the design's folder tree (§4.1)")
                elif leaf != "**" and f"{directory}/{leaf}" not in tree_files:
                    # a named file inside a tree directory must itself be named by
                    # the tree — otherwise a bot can invent a file the design
                    # never authorised
                    off_tree.append(f"{bot} owns `{expanded}` — `{directory}/{leaf}` "
                                    f"is not a file in the design's folder tree (§4.1)")
    if off_tree:
        rec("FAIL", f"{len(off_tree)} owned path(s) are outside the design's folder "
                    f"tree (§4.1)")
        for o in sorted(set(off_tree)):
            rec("FAIL", f"  {o}")
    else:
        rec("PASS", f"every owned path sits inside the design's folder tree "
                    f"(architecture §4.1 — {len(tree_dirs)} directories, "
                    f"{len(tree_files)} files enumerated)")

    # --- 6c. the acceptance tests the bots publish must be the design's -----
    # A bot's scope table claims its rows are "taken verbatim from the master
    # traceability matrix". Checking only the requirement IDs cannot see a
    # stale acceptance test — a bot can carry the right REQ id with the wrong
    # numbers and the gate stays green. So the text is compared, and compared
    # for EQUALITY: a substring test would let a bot append a contradicting
    # appendix to the matrix's text and still pass.
    ac_bad = []
    for bot, text in texts.items():
        rows = bot_scope_rows(text)
        for rid, cell in sorted(rows.items()):
            row = matrix.get(rid)
            if not row:
                continue
            # A *consumed* requirement is not re-published by the consumer — the
            # owner holds the acceptance test. Only owned rows are compared.
            if owner_of(row["owner"]) != BOTS[bot]:
                continue
            want = normalise(row["ac"])
            got = normalise(cell)
            if want and want != got:
                ac_bad.append(f"{bot}:{rid} does not carry the matrix acceptance test "
                              f"verbatim — matrix says {want[:110]!r}, bot says "
                              f"{got[:110]!r}")
    for bot, text in texts.items():
        rows = bot_scope_rows(text)
        for rid, row in sorted(matrix.items()):
            if not rid.startswith("REQ-"):
                continue
            if owner_of(row["owner"]) != BOTS[bot]:
                continue
            if rid not in rows:
                ac_bad.append(f"{bot}:{rid} is owned by this bot but appears in no "
                              f"scope row")
    if ac_bad:
        rec("FAIL", f"{len(ac_bad)} acceptance test(s) in the development bots do not "
                    f"match the design's traceability matrix")
        for a in ac_bad[:12]:
            rec("FAIL", f"  {a}")
        if len(ac_bad) > 12:
            rec("FAIL", f"  ... and {len(ac_bad) - 12} more")
    else:
        rec("PASS", "every acceptance test published by a development bot matches the "
                    "design's traceability matrix verbatim")

    # --- 6d. every content kind has exactly the owner the design names ----
    # The design's §8.3 states which board owns which content kind. Checking
    # only that each kind has *some* owner would pass a package where two
    # boards had swapped their content, so the declared owner is checked.
    master_path = DOCS / "DESIGN-3-MASTER.md"
    master_text = master_path.read_text(encoding="utf-8") if master_path.exists() else ""
    design_kinds: set[str] = set()
    for doc in DOCS.glob("DESIGN-3-*.md"):
        design_kinds |= set(re.findall(r"src/content/([a-z_]+)/", doc.read_text()))
    declared: dict[str, str] = {}
    for kind, directory, owner in re.findall(
            r"^\|\s*`([a-z_]+)`\s*\|\s*`(src/content/[a-z_]+/)`\s*\|\s*([A-Z]+)\s*\|",
            master_text, re.M):
        declared[kind] = owner
    kind_owners: dict[str, set[str]] = collections.defaultdict(set)
    for bot, text in texts.items():
        for pattern in owned_paths(text):
            for expanded in expand_braces(pattern):
                m = re.match(r"src/content/([a-z_]+)/", expanded)
                if m:
                    kind_owners[m.group(1)].add(BOTS[bot])
    # Set equality, not just equal length. Two equal-sized but different kind
    # sets could agree on the number while disagreeing on the content, and the
    # bots would still match §8.3 and pass.
    kind_diff = content_kind_set_mismatch(set(declared), design_kinds)
    if kind_diff:
        only_design = sorted(design_kinds - set(declared))
        only_decl = sorted(set(declared) - design_kinds)
        rec("FAIL", f"content ownership: the master's §8.3 declares {len(declared)} "
                    f"content kind(s) but the boards define {len(design_kinds)} — the "
                    f"declared table is missing or incomplete")
        for k in only_design:
            rec("FAIL", f"  `{k}` — the boards define this content kind but §8.3 does "
                        f"not declare it")
        for k in only_decl:
            rec("FAIL", f"  `{k}` — §8.3 declares this content kind but no board defines it")
    unowned = sorted(k for k in declared if not kind_owners.get(k))
    contested = sorted(k for k in declared if len(kind_owners.get(k, set())) > 1)
    wrong = sorted(f"{k} (design: {declared[k]}, bots: "
                   f"{sorted(kind_owners.get(k, []))})"
                   for k in declared
                   if kind_owners.get(k) and kind_owners[k] != {declared[k]})
    if unowned or contested or wrong:
        rec("FAIL", f"content ownership: {len(unowned)} content kind(s) have no owner, "
                    f"{len(contested)} have more than one, {len(wrong)} are owned by the "
                    f"wrong board")
        for k in unowned:
            rec("FAIL", f"  src/content/{k}/ — the design names an owner and no bot claims it")
        for k in contested:
            rec("FAIL", f"  src/content/{k}/ — claimed by {sorted(kind_owners[k])}")
        for w in wrong:
            rec("FAIL", f"  src/content/{w.split(' ')[0]}/ — {w}")
    else:
        rec("PASS", f"every one of the {len(declared)} content kinds the design defines "
                    f"is owned by exactly the board its §8.3 names")

    # --- 6e. the tools the boards invoke must exist and have an owner -----
    # A tool named in an acceptance test is a promise that the file exists and
    # that somebody will write it. Two tools were invoked for years of review
    # rounds without ever appearing in the folder tree.
    invoked: dict[str, set[str]] = collections.defaultdict(set)
    for doc in DOCS.glob("DESIGN-3-*.md"):
        text = doc.read_text()
        if doc.name == "DESIGN-3-MASTER.md":
            # the changelog quotes superseded wording deliberately, in order to
            # record what was fixed. It is a record, not a specification.
            start = text.find("### 11.2 ")
            end = text.find("### 11.3 ")
            if start != -1 and end != -1 and end > start:
                text = text[:start] + text[end:]
        for tool in re.findall(r"src/tools/([a-z_/]+\.py)", text):
            invoked[f"src/tools/{tool}"].add(doc.name)
    owner_of_file: dict[str, set[str]] = collections.defaultdict(set)
    for bot, text in texts.items():
        for pattern in owned_paths(text):
            for expanded in expand_braces(pattern):
                directory, leaf = split_pattern(expanded)
                if leaf == "**":
                    for tree_file in tree_files:
                        if tree_file.startswith(directory + "/"):
                            owner_of_file[tree_file].add(bot)
                elif f"{directory}/{leaf}" in tree_files:
                    owner_of_file[f"{directory}/{leaf}"].add(bot)
    tool_bad = []
    for tool, docs_ in sorted(invoked.items()):
        if tool not in tree_files:
            tool_bad.append(f"`{tool}` is invoked by {sorted(docs_)} but is not in the "
                            f"§4.1 tree")
        elif not owner_of_file.get(tool):
            tool_bad.append(f"`{tool}` is invoked by {sorted(docs_)} and is in the tree, "
                            f"but no development bot owns it")
    for tool in sorted(tree_files):
        if tool.startswith("src/tools/") and tool not in invoked:
            tool_bad.append(f"`{tool}` is in the §4.1 tree but no board invokes it")
    if tool_bad:
        rec("FAIL", f"tool inventory: {len(tool_bad)} tool(s) are invoked, present or "
                    f"owned inconsistently")
        for t in tool_bad:
            rec("FAIL", f"  {t}")
    else:
        rec("PASS", f"every tool the boards invoke exists in the §4.1 tree and has an "
                    f"owning bot, and every tool in the tree is invoked")

    # --- 6f. a bot's prose must not ship a trademarked prompt family --------
    # The thirteenth review found a defect that no gate read: the world bot
    # still aimed `IN-017` at `kenney-cc0-game-art-packs.zip` — the pack whose
    # families carry console-manufacturer trademarks — while every board shipped
    # from `shorepine-kenney.zip`. The boards were checked; the bots were not.
    #
    # The fourteenth review found this check could still be fooled: "trademark"
    # and "excluded" were accepted as not-shipped markers, so a bot could ship
    # from the branded pack while saying "trademark-free families of <branded
    # path> … branded families are excluded" and pass. The markers are now only
    # the ones that actually assert the pack is not shipped.
    SHIPPING_PROMPTS = "shorepine-kenney.zip!icons/Input Prompts/"
    BRANDED_PROMPTS = "kenney-cc0-game-art-packs.zip!assets/kenney/input-prompts/"
    NOT_SHIPPED = ("not shipped", "measured")
    ALLOWED_PACKS = ("shorepine-kenney.zip", "kenney-cc0-game-art-packs.zip")
    prose_bad: list[str] = []
    for bot, text in sorted(texts.items()):
        # The rules are scoped to the LIST ITEM or paragraph that mentions the
        # prompts. The fourteenth review's first attempt used a 500-character
        # window, which reached into the neighbouring bullet and flagged
        # `fps-buildings-env-kit.zip` for appearing near the word "prompt" — a
        # false positive that would have taught the team to ignore this check.
        # The world bot's asset list is one block of bullets, so the split has
        # to break at item starts as well as at blank lines.
        items = re.split(r"\n\s*\n|\n(?=\s*(?:[-*+]|\d+\.|#+)\s)", text)
        for item in items:
            if not re.search(r"input[\s-]*prompts?|IN-017", item, re.I):
                continue
            low = item.lower()
            if BRANDED_PROMPTS in item and not any(k in low for k in NOT_SHIPPED):
                prose_bad.append(
                    f"{bot}: cites the branded prompt pack `{BRANDED_PROMPTS}` without "
                    f"marking it as measured / not shipped — a reader would take it as "
                    f"the shipping source")
            for m in re.finditer(r"[A-Za-z0-9_.-]+\.zip", item):
                pack = m.group(0)
                if pack not in ALLOWED_PACKS:
                    prose_bad.append(
                        f"{bot}: names a third prompt pack `{pack}` in the same passage "
                        f"as the input prompts — only `shorepine-kenney.zip` ships them")
        if re.search(r"input[\s-]*prompts?", text, re.I) and SHIPPING_PROMPTS not in text:
            prose_bad.append(
                f"{bot}: mentions the input-prompt families but never cites the "
                f"shipping source `{SHIPPING_PROMPTS}`")
        # A bot that names the manifest row owns the shipping decision and must
        # name the shipping path, whatever words it uses around it.
        if "IN-017" in text and SHIPPING_PROMPTS not in text:
            prose_bad.append(
                f"{bot}: names `IN-017` but never cites the shipping source "
                f"`{SHIPPING_PROMPTS}`")
        for stale in ("2,719", "2719"):
            if stale in text:
                prose_bad.append(
                    f"{bot}: publishes the stale prompt-pack count `{stale}`; the "
                    f"measured count is 2,733")
    if prose_bad:
        rec("FAIL", f"bot prose: {len(prose_bad)} statement(s) point the input prompts "
                    f"at the wrong pack or publish a stale count")
        for p in prose_bad:
            rec("FAIL", f"  {p}")
    else:
        rec("PASS", "every bot's prose ships the input prompts from "
                    "`shorepine-kenney.zip!icons/Input Prompts/` and treats the branded "
                    "pack as measured, not shipped")

    # --- 7. the bots do not claim to be the design's source of truth -------
    stale = [b for b, t in texts.items()
             if re.search(r"\b(I (decide|invent) the (design|requirements))\b", t)]
    if stale:
        rec("FAIL", f"{len(stale)} bot(s) claim authority over the design: {stale}")
    else:
        rec("PASS", "every development bot defers to the design documents for "
                    "requirements and acceptance tests")

    # --- 8. the master must publish the figures this run produced ----------
    master_path = DOCS / "DESIGN-3-MASTER.md"
    master = master_path.read_text(encoding="utf-8") if master_path.exists() else ""
    # the +1 is this check itself, which passes when the master's figure is right
    passes_so_far = sum(1 for lvl, _ in results if lvl == "PASS")
    check_published_figures(master, passes_so_far + 1)

    fails = sum(1 for lvl, _ in results if lvl == "FAIL")
    warns = sum(1 for lvl, _ in results if lvl == "WARN")
    passes = sum(1 for lvl, _ in results if lvl == "PASS")
    print(f"\n=== {fails} FAIL, {warns} WARN, {passes} PASS ===")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
