#!/usr/bin/env python3
"""
build_manifest.py — measure every staged game model and emit a deterministic
asset manifest for SuperCitycon.

For each glTF/GLB under game/public/assets/models/** the script:
  * parses the file (GLB chunked container or JSON .gltf + external .bin),
  * walks the scene graph, accumulating each mesh primitive's world transform,
  * computes the exact world-space AABB by transforming the 8 corners of each
    primitive's POSITION accessor min/max box,
  * derives footprint (X/Z), height (Y), and a uniform scale that makes the
    model's footprint fit the game grid cell,
  * records licence and provenance so the shipped manifest is auditable.

Output: game/src/data/manifest.json
"""
from __future__ import annotations

import json
import math
import os
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "game" / "public" / "assets" / "models"
OUT = ROOT / "game" / "src" / "data" / "manifest.json"

# --- pack provenance: id -> (display, licence, source pack zip) ------------
PACKS = {
    "citybits": ("KayKit City Builder Bits", "CC0-1.0", "kaykit-city-builder.zip"),
    "nature": ("Avramania Nature & Terrain", "CC0-1.0", "avramania-nature-terrain.zip"),
    "props": ("Holokat Game Assets", "MIT", "holokat-game-assets.zip"),
    "characters": ("KayKit Adventurers + Character Animations", "CC0-1.0", "kaykit-adventurers.zip"),
    "citizens": ("Quaternius Ultimate Animated Character", "CC0-1.0",
                 "quaternius-ultimate-animated-character.zip"),
    "creatures": ("Quaternius Ultimate Animated Animals", "CC0-1.0",
                  "quaternius-ultimate-animated-animals.zip"),
    "undead": ("KayKit Character Pack: Skeletons", "CC0-1.0", "kaykit-skeletons.zip"),
}

# Author attribution per family, keyed the same way as PACKS.
PACK_AUTHORS = {
    "citybits": "Kay Lousberg (KayKit)",
    "nature": "Avramania",
    "props": "Holokat / OpenGameArt",
    "characters": "Kay Lousberg (KayKit)",
    "citizens": "Quaternius",
    "creatures": "Quaternius",
    "undead": "Kay Lousberg (KayKit)",
}

# Target grid cell, in world units. One grid cell == one building plot.
CELL = 4.0

# ---------------------------------------------------------------------------
# Per-family uniform scale.
#
# Models are NOT individually normalised to the cell: the kits are internally
# consistent (a car is authored to fit a lane, a street light is authored
# against a building) and per-model normalisation destroys those ratios.
# Instead each family gets one uniform scale chosen so that:
#
#   citybits  2.00  -> the 2.02u tile becomes exactly the 4.00u grid cell.
#   props     1.00  -> a 4.5u house fills one cell; an 8u market spans 2x2.
#   nature    1.10  -> a 4.3u oak becomes ~4.8u, taller than a 3.3u house.
#   characters 0.60 -> a 2.47u knight becomes ~1.48u: a human next to houses.
#   citizens  0.55  -> a Quaternius adult (~2.7u) becomes ~1.5u.
#   creatures 0.55  -> a Quaternius animal keeps a plausible size beside people.
#   undead    0.60  -> a KayKit skeleton matches the existing characters family.
# ---------------------------------------------------------------------------
FAMILY_SCALE = {
    "citybits": 2.00,
    "props": 1.00,
    "nature": 1.10,
    "characters": 0.60,
    "citizens": 0.55,
    "creatures": 0.55,
    "undead": 0.60,
}
# Characters and creatures are actors, not plots: they are exempt from the
# one-cell footprint rule and are published under "characters".
CELL_EXEMPT = {"characters", "citizens", "creatures", "undead"}


# --------------------------------------------------------------------------- #
# minimal glTF maths
# --------------------------------------------------------------------------- #
def mat_mul(a, b):
    """a*b where both are 4x4 column-major lists of 16 floats."""
    r = [0.0] * 16
    for i in range(4):
        for j in range(4):
            s = 0.0
            for k in range(4):
                s += a[k * 4 + j] * b[i * 4 + k]
            r[i * 4 + j] = s
    return r


def trs_matrix(node):
    """Compose a node's TRS into a column-major 4x4 matrix."""
    if "matrix" in node:
        return list(node["matrix"])
    t = node.get("translation", [0.0, 0.0, 0.0])
    r = node.get("rotation", [0.0, 0.0, 0.0, 1.0])  # xyzw
    s = node.get("scale", [1.0, 1.0, 1.0])
    x, y, z, w = r
    xx, yy, zz = x * x, y * y, z * z
    xy, xz, yz = x * y, x * z, y * z
    wx, wy, wz = w * x, w * y, w * z
    sx, sy, sz = s
    m = [
        (1 - 2 * (yy + zz)) * sx, (2 * (xy + wz)) * sx, (2 * (xz - wy)) * sx, 0.0,
        (2 * (xy - wz)) * sy, (1 - 2 * (xx + zz)) * sy, (2 * (yz + wx)) * sy, 0.0,
        (2 * (xz + wy)) * sz, (2 * (yz - wx)) * sz, (1 - 2 * (xx + yy)) * sz, 0.0,
        t[0], t[1], t[2], 1.0,
    ]
    return m


def transform_point(m, p):
    x, y, z = p
    return (
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    )


IDENTITY = [1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0]


# --------------------------------------------------------------------------- #
# glTF parsing
# --------------------------------------------------------------------------- #
def load_gltf(path: Path) -> dict:
    if path.suffix.lower() == ".glb":
        raw = path.read_bytes()
        if len(raw) < 12:
            raise ValueError(f"{path}: too short for GLB")
        magic, _ver, length = struct.unpack("<III", raw[:12])
        if magic != 0x46546C67:
            raise ValueError(f"{path}: bad GLB magic")
        off, doc = 12, None
        while off + 8 <= length:
            clen, ctype = struct.unpack("<II", raw[off:off + 8])
            off += 8
            chunk = raw[off:off + clen]
            off += clen
            if ctype == 0x4E4F534A:  # JSON
                doc = json.loads(chunk.decode("utf-8"))
            elif ctype == 0x004E4942:  # BIN
                doc_bin = chunk
        if doc is None:
            raise ValueError(f"{path}: no JSON chunk")
        doc["__bin__"] = doc_bin
        return doc

    doc = json.loads(path.read_text())
    bins = {}
    for uri in doc.get("buffers", []):
        u = uri.get("uri", "")
        if u.startswith("data:"):
            import base64
            bins[uri.get("name", "embedded")] = base64.b64decode(u.split(",", 1)[1])
        else:
            bp = path.parent / u
            if bp.exists():
                bins[uri.get("name", u)] = bp.read_bytes()
    doc["__bins__"] = bins
    return doc


def accessor_range(doc, idx):
    acc = doc["accessors"][idx]
    if "min" in acc and "max" in acc:
        return list(acc["min"]), list(acc["max"])
    # fall back to reading the buffer
    bv = doc["bufferViews"][acc["bufferView"]]
    buf = doc.get("__bin__")
    if buf is None:
        bins = doc.get("__bins__", {})
        buf = bins.get(bv.get("buffer", 0), b"")
    ctype = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
    fmt = ctype[acc["componentType"]]
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    stride = bv.get("byteStride") or (ncomp * struct.calcsize(fmt))
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc["count"]
    vals = []
    for i in range(count):
        p = base + i * stride
        vals.append(struct.unpack_from("<" + fmt * ncomp, buf, p))
    mn = [min(v[k] for v in vals) for k in range(ncomp)]
    mx = [max(v[k] for v in vals) for k in range(ncomp)]
    return mn, mx


def model_bounds(doc):
    """Exact world-space AABB over all mesh primitives in the default scene."""
    scene_idx = doc.get("scene", 0)
    scenes = doc.get("scenes") or [{"nodes": doc.get("nodes", [])}]
    scene = scenes[scene_idx] if scene_idx < len(scenes) else scenes[0]
    nodes = doc.get("nodes", [])
    meshes = doc.get("meshes", [])
    lo = [math.inf] * 3
    hi = [-math.inf] * 3
    found = False

    def walk(node_idx, parent):
        nonlocal found
        n = nodes[node_idx]
        m = mat_mul(parent, trs_matrix(n))
        if "mesh" in n:
            mesh = meshes[n["mesh"]]
            for prim in mesh.get("primitives", []):
                pos = prim.get("attributes", {}).get("POSITION")
                if pos is None:
                    continue
                try:
                    mn, mx = accessor_range(doc, pos)
                except Exception:
                    continue
                if len(mn) < 3:
                    continue
                for cx in (mn[0], mx[0]):
                    for cy in (mn[1], mx[1]):
                        for cz in (mn[2], mx[2]):
                            wx, wy, wz = transform_point(m, (cx, cy, cz))
                            lo[0] = min(lo[0], wx); hi[0] = max(hi[0], wx)
                            lo[1] = min(lo[1], wy); hi[1] = max(hi[1], wy)
                            lo[2] = min(lo[2], wz); hi[2] = max(hi[2], wz)
                found = True
        for child in n.get("children", []):
            walk(child, m)

    for root in scene.get("nodes", []):
        walk(root, IDENTITY)
    if not found:
        return None
    return lo, hi


def gltf_animations(doc):
    names = []
    for a in doc.get("animations", []):
        names.append(a.get("name") or f"anim_{len(names)}")
    return names


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main() -> int:
    if not MODELS.exists():
        print(f"ERROR: {MODELS} not found", file=sys.stderr)
        return 1

    out = {
        "generated_by": "tools/build_manifest.py",
        "grid": {"cell": CELL, "note": "one grid cell == one building plot"},
        "packs": {},
        "models": {},
        "characters": {},
    }

    for family in sorted(PACKS):
        fdir = MODELS / family
        if not fdir.exists():
            continue
        display, licence, zipname = PACKS[family]
        out["packs"][family] = {
            "display": display, "licence": licence, "source": zipname,
            "author": PACK_AUTHORS.get(family, "unknown"),
        }

    total, failed = 0, []
    for family in sorted(PACKS):
        fdir = MODELS / family
        if not fdir.exists():
            continue
        files = sorted(
            [p for p in fdir.iterdir()
             if p.suffix.lower() in (".glb", ".gltf") and not p.name.startswith(".")],
            key=lambda p: p.name.lower(),
        )
        for f in files:
            key = f.stem
            try:
                doc = load_gltf(f)
                b = model_bounds(doc)
                if b is None:
                    failed.append(f"{family}/{f.name}: no mesh")
                    continue
                lo, hi = b
                w = hi[0] - lo[0]
                d = hi[2] - lo[2]
                h = hi[1] - lo[1]
                scale = FAMILY_SCALE.get(family, 1.0)
                anims = gltf_animations(doc)
                sw, sd, sh = w * scale, d * scale, h * scale
                cells_x = max(1, math.ceil(sw / CELL - 0.02))
                cells_z = max(1, math.ceil(sd / CELL - 0.02))
                rec = {
                    "file": f"assets/models/{family}/{f.name}",
                    "family": family,
                    "licence": PACKS[family][1],
                    "srcBBox": {
                        "min": [round(v, 5) for v in lo],
                        "max": [round(v, 5) for v in hi],
                    },
                    "rawFootprint": [round(w, 5), round(d, 5)],
                    "rawHeight": round(h, 5),
                    "footprint": [round(sw, 4), round(sd, 4)],
                    "height": round(sh, 4),
                    "scale": round(scale, 5),
                    "yOffset": round(-lo[1] * scale, 5),
                    "centerXZ": [
                        round(((lo[0] + hi[0]) / 2.0) * scale, 5),
                        round(((lo[2] + hi[2]) / 2.0) * scale, 5),
                    ],
                    "cells": [cells_x, cells_z],
                }
                if anims:
                    rec["animations"] = anims
                if family in CELL_EXEMPT:
                    out["characters"][key] = rec
                else:
                    out["models"][key] = rec
                total += 1
            except Exception as exc:  # noqa: BLE001
                failed.append(f"{family}/{f.name}: {exc}")

    out["counts"] = {
        "models": len(out["models"]),
        "characters": len(out["characters"]),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1, sort_keys=True))

    print(f"manifest written: {OUT}")
    print(f"  models={len(out['models'])} characters={len(out['characters'])}")
    if failed:
        print(f"  FAILED ({len(failed)}):")
        for x in failed:
            print("   -", x)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
