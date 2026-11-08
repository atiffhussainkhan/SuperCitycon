#!/usr/bin/env python3
"""Reconcile the project-path namespace across the five design boards.

Three path namespaces exist and must not be confused:

  1. PROJECT TREE paths   `src/...`      — the game's own source tree (§4.1).
  2. PACK-RELATIVE paths `assets/glTF/...` — a file inside a downloaded pack,
                                        recorded in the manifest's `source_path`.
  3. DESIGN-PACKAGE tools `tools/verify_design.py` — the gate scripts, which
                                        live outside the game tree on purpose.

The boards had drifted: 40+ project data files were cited as `content/...`
while §4.1 and the development bots both said `src/content/...`. Two boards
even cited the asset manifest under two different names. This script moves the
project-tree references onto the tree's prefix and leaves pack-relative and
design-tool references alone.

Usage: python3 tools/reconcile_paths.py [--dry-run]
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
DOCS = HERE.parent / "platformer-docs"

BOARDS = [
    "DESIGN-3-ARCHITECTURE.md",
    "DESIGN-3-ASSETS.md",
    "DESIGN-3-PLAYER.md",
    "DESIGN-3-ENTITIES.md",
    "DESIGN-3-WORLD.md",
]

# (pattern, replacement, description)
RULES: list[tuple[re.Pattern[str], str, str]] = [
    # 1. project data files: content/... -> src/content/...
    #    the lookbehind keeps `src/content/...` from becoming `src/src/content/...`
    (re.compile(r"(?<!src/)(?<!/)content/"), "src/content/",
     "project data files -> src/content/"),
    # 2. the asset manifest and its two companions
    (re.compile(r"(?<!src/)assets/asset_manifest\.json"), "src/assets/asset_manifest.json",
     "asset manifest -> src/assets/"),
    (re.compile(r"(?<!src/)assets/licence_registry\.json"), "src/assets/licence_registry.json",
     "licence registry -> src/assets/"),
    # `license_manifest` (American spelling) was the one stray spelling; the
    # rest of the design uses British `licence`, so the file is renamed to match.
    (re.compile(r"(?<!src/)assets/license_manifest\.json"), "src/assets/licence_manifest.json",
     "attribution file -> src/assets/licence_manifest.json (spelling normalised)"),
    # 3. game-tree tools (distinct from the design package's tools/)
    (re.compile(r"(?<!src/)tools/check_asset_manifest\.py"), "src/tools/check_asset_manifest.py",
     "game tool -> src/tools/"),
    (re.compile(r"(?<!src/)tools/asset_manifest\.py"), "src/tools/asset_manifest.py",
     "manifest generator -> src/tools/"),
    # 4. Godot resource paths
    (re.compile(r"res://scenes/"), "res://src/scenes/",
     "res:// scene paths -> res://src/scenes/"),
    # 5. a reference to a tool that does not exist in this repository; the
    #    repository's existing convention tool is tools/verify_design.py
    (re.compile(r"(?<!src/)tools/validate_requirements\.py"), "tools/verify_design.py",
     "dangling tool reference -> the real tools/verify_design.py"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    total = 0
    for name in BOARDS:
        path = DOCS / name
        text = original = path.read_text(encoding="utf-8")
        hits: list[str] = []
        for rx, repl, desc in RULES:
            text, n = rx.subn(repl, text)
            if n:
                hits.append(f"    {n:>3} x {desc}")
        if text != original:
            total += sum(1 for _ in hits)
            print(f"{name}:")
            print("\n".join(hits))
            if not args.dry_run:
                path.write_text(text, encoding="utf-8")
    print(f"\n{'would change' if args.dry_run else 'changed'} {len(BOARDS)} board file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
