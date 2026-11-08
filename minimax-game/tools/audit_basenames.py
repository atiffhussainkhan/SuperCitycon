#!/usr/bin/env python3
"""Read-only DESIGN-3-ASSETS.md inventory audit (items 1-8)."""
import json
import os
import re
from collections import Counter
from pathlib import Path

WS = Path(__file__).resolve().parent.parent
DESIGN = WS / "platformer-docs" / "DESIGN-3-ASSETS.md"
LIB = WS / "platformer-docs" / "library-inventory"
PACKS = WS / "platformer-docs" / "library-packs"
HOME_PACKS = Path.home() / ".minimax" / "asset-library" / "packs"

text = DESIGN.read_text(encoding="utf-8")
row_re = re.compile(r"^\|\s*([A-Z]{2}-\d{3})\s*\|", re.M)
EXT_BN = re.compile(r"\.(glb|gltf|fbx|png|hdr|ogg|wav|flac|ttf)$", re.I)
ALL_EXTS = re.compile(
    r"\.(glb|gltf|fbx|png|hdr|ogg|wav|flac|ttf|blend|obj|jpg)\b", re.I
)
TICK = re.compile(r"`([^`]+)`")


def split_cells(line: str):
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


asset_rows = []
for m in row_re.finditer(text):
    line = text[m.start() : text.find("\n", m.start())]
    cells = split_cells(line)
    if len(cells) < 5:
        continue
    if not re.match(r"^[A-Z]{2}-\d{3}$", cells[0]):
        continue
    asset_rows.append(
        {
            "id": cells[0],
            "element": cells[1],
            "req": cells[2],
            "pack": cells[3],
            "path": cells[4],
        }
    )

basenames = set()
ellipsis_ids = []
packs_cited = set()
path_ticks = []

for row in asset_rows:
    path_cell = row["path"]
    if "…" in path_cell or "\u2026" in path_cell:
        ellipsis_ids.append(row["id"])
    pk = row["pack"].strip().strip("`")
    if pk and pk not in ("—", "-", "–"):
        packs_cited.add(pk)
    parts = re.split(r"\s*\+\s*|,\s*|\u2026|…", path_cell)
    for p in parts:
        p = p.strip().strip("`").strip()
        if not p or set(p) <= {".", "…", "\u2026", " "}:
            continue
        # strip trailing parenthetical notes after basename
        # keep path-like tokens only
        # take last path-ish token if spaces (notes after)
        # e.g. `foo.glb` (clip bank...) already stripped backticks per part
        # but part may be: foo.glb` (clip...  after split on ellipsis of other ticks
        # Also: `path` (notes) — path_cell may have: `a.glb` (note)
        # After split on +, comma, ellipsis, a part may be:
        #   `platformer/block-snow.glb`
        #   or: platformer/block-snow.glb` (notes)
        p2 = p.split("(")[0].strip().strip("`").strip()
        base = os.path.basename(p2)
        base = base.strip("`").strip()
        if EXT_BN.search(base):
            basenames.add(base)
    for tm in TICK.finditer(path_cell):
        s = tm.group(1)
        if ALL_EXTS.search(s):
            path_ticks.append(s)

# TR-020
tr020 = next((r for r in asset_rows if r["id"] == "TR-020"), None)
tr020_tokens = []
if tr020:
    for m in re.finditer(r"[\w./\-]+\.glb", tr020["path"], re.I):
        tr020_tokens.append(m.group(0))

inv_files = [
    "kenney-3d-paths.txt",
    "3d-models-index.json",
    "audio-inventory.txt",
    "kenney-3d-animation-index.json",
    "kenney-2d-paths.txt",
    "kenney-ui-index.txt",
    "kenney-icon-paths.txt",
]
blobs = {}
for f in inv_files:
    p = LIB / f
    blobs[f] = p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""

zero = []
for bn in sorted(basenames):
    hits = sum(blob.count(bn) for blob in blobs.values())
    if hits == 0:
        zero.append(bn)

# 3d-models-index
idx_lines = (LIB / "3d-models-index.json").read_text(encoding="utf-8").splitlines()
lic = Counter()
for ln in idx_lines:
    try:
        o = json.loads(ln)
    except Exception:
        continue
    lic[str(o.get("licence", "<missing>"))] += 1

# animation index
anim_gt0 = skin_gt0 = plat = cube = 0
anim_lines = (LIB / "kenney-3d-animation-index.json").read_text(encoding="utf-8").splitlines()
for ln in anim_lines:
    try:
        o = json.loads(ln)
    except Exception:
        continue
    if int(o.get("animations", 0) or 0) > 0:
        anim_gt0 += 1
    if int(o.get("skins", 0) or 0) > 0:
        skin_gt0 += 1
    kit = o.get("kit", "")
    if kit == "platformer" and int(o.get("animations", 0) or 0) > 0:
        plat += 1
    if kit == "cube-pets" and int(o.get("animations", 0) or 0) > 0:
        cube += 1

local = {p.name for p in PACKS.iterdir()} if PACKS.exists() else set()
home = {p.name for p in HOME_PACKS.iterdir()} if HOME_PACKS.exists() else set()
missing_local = sorted(p for p in packs_cited if p not in local)

claim_619 = bool(re.search(r"\b619\b", text))

out = []
out.append("===1 UNIQUE BASENAMES===")
out.append(f"asset_rows={len(asset_rows)}")
out.append(f"unique_basenames={len(basenames)}")
out.append("===2 ZERO HITS===")
out.append(f"zero_hit_count={len(zero)}")
for z in zero:
    out.append(f"ZERO|{z}")
out.append("===3 ELLIPSIS ASSET_IDS===")
out.append(f"ellipsis_count={len(ellipsis_ids)}")
out.append("ellipsis_ids=" + ",".join(ellipsis_ids))
out.append("===4 PATH-COL BACKTICK EXTS===")
out.append(f"path_col_backtick_ext_count={len(path_ticks)}")
out.append(f"claim_619_mentioned={claim_619}")
out.append("===5 3D MODELS INDEX===")
out.append(f"total_lines={len(idx_lines)}")
out.append(f"licence_counts={dict(lic)}")
mit = lic.get("MIT", 0)
cc0 = lic.get("CC0", 0)
cc01 = lic.get("CC0-1.0", 0)
out.append(f"MIT={mit} CC0={cc0} CC0-1.0={cc01} sum_MIT_CC0exact={mit+cc0} sum_MIT_CC01={mit+cc01}")
out.append(f"claim_1994_1005_989 match_lines={len(idx_lines)==1994} match_split_exactCC0={mit==1005 and cc0==989}")
out.append("===6 ANIM INDEX===")
out.append(f"entries={len(anim_lines)}")
out.append(f"animations_gt0={anim_gt0}")
out.append(f"skins_gt0={skin_gt0}")
out.append(f"kit_platformer_anim_gt0={plat}")
out.append(f"kit_cube_pets_anim_gt0={cube}")
out.append("===7 PACKS===")
out.append(f"packs_cited={len(packs_cited)}")
out.append("packs_cited_list=" + ",".join(sorted(packs_cited)))
out.append(f"missing_from_library_packs={len(missing_local)}")
for p in missing_local:
    out.append(f"MISSING_LOCAL|{p}|home={p in home}")
out.append("library_packs=" + ",".join(sorted(local)))
out.append("home_packs=" + ",".join(sorted(home)))
out.append("===8 TR-020===")
out.append(f"tr020_glb_token_count={len(tr020_tokens)}")
out.append("tr020_tokens=" + ",".join(tr020_tokens))

report = WS / "_audit_basenames_out.txt"
report.write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"Wrote {report} ({len(out)} lines)")
print("\n".join(out[:80]))
print("...")
print(f"zero={len(zero)} ticks={len(path_ticks)} ellipsis={len(ellipsis_ids)}")
