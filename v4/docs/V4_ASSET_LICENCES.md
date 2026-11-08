# MiniMax Game Studio Ultra V4 — Asset Licences

Two asset populations exist in this project. One is cleared and shipped. The
other is **quarantined and never shipped**. This document states, per
population, exactly what was checked, against which authority, and what the
result was.

---

## 1. Summary

| | 3D models | 2D images |
|---|---|---|
| Files | **203** (74,961,118 bytes) | **69** distinct PNGs |
| Source packs | 8 | 4 |
| Licence status | CC0-1.0 / MIT — **verified** | `unverified` — **all 69** |
| Redistributable | **Yes** | **No** |
| Shipped in V4 | **Yes**, sha256-verified | **No** — quarantined |
| Authority | The licence text shipped with each pack | The library's own index |

The shipped set is recorded in `v4/public/assets/CLEARED-ASSETS.json`; the
quarantined set is recorded, per file, in `v4/data/quarantine-2d.json`.

---

## 2. The cleared 3D models (shipped)

`v4/scripts/prepare-assets.mjs` copies the 3D models out of the V2 tree
into `v4/public/assets/models`, **verifying every file by sha256** as it
goes. The 8 licence texts travel with them in
`v4/public/assets/LICENSES/`.

```json
{
  "generatedBy": "v4/scripts/prepare-assets.mjs",
  "note": "Only licence-cleared 3D models are copied. The 2D art is
            licence-unverified and quarantined; it is never copied here.",
  "models": 203,
  "licenceTexts": 8,
  "refused": [],
  "bytes": 74961118
}
```

### The packs and their licences

| Pack | Licence | Author | Files |
|---|---|---|---|
| KayKit Adventurers | CC0-1.0 | KayKit | `kaykit-adventurers-LICENSE.txt` |
| KayKit Character Animations | CC0-1.0 | KayKit | `kaykit-character-animations-LICENSE.txt` |
| KayKit City Builder | CC0-1.0 | KayKit | `kaykit-city-builder-LICENSE.txt` |
| Avramania Nature Terrain | CC0-1.0 | Avramania | `avramania-nature-terrain-CC0.txt` |
| Holokat Game Assets | MIT | Holokat | `holokat-game-assets-MIT.txt` |
| Quaternius Citizens | CC0-1.0 | Quaternius | `citizens-CC0-1.0.txt` |
| Creatures | CC0-1.0 | — | `creatures-CC0-1.0.txt` |
| Undead | CC0-1.0 | — | `undead-CC0-1.0.txt` |

Every licence string in the catalogue is copied from these files. Nothing is
inferred from a filename, a folder name or a convention.

### Verification

| Check | Result |
|---|---|
| Source files present | 203 |
| Files copied | 203 |
| Files sha256-verified after the copy | **203 / 203** |
| Files refused | 0 |
| `--check` re-run: source count vs target count | 203 vs 203, refused 0 |

Re-run it yourself:

```sh
cd v4-worktree/v4
node scripts/prepare-assets.mjs            # copy + verify
node scripts/prepare-assets.mjs --check    # verify only
```

### The catalogue is the single list of what may be loaded

`v4/src/render/asset-loader.js` holds `MODEL_CATALOGUE`: 23 entries, each
with an id, a file, a category, the licence, the author and the
redistributable flag. A model that is not in the catalogue cannot be loaded
by id.

**One entry was wrong and was corrected.** `props.house` pointed at
`props/House.glb`, which does not exist in the shipped pack — the pack
contains `Warehouse.glb`. The browser run surfaced it as a model that
failed to load; the asset audit confirmed it. The entry now reads
`props.warehouse` → `props/Warehouse.glb`, and the asset audit reports
**0 broken files**.

---

## 3. The quarantined 2D images (not shipped)

### What was checked

The authoritative source is the asset library's own index:

```
~/.minimax/asset-library/catalogue/game_asset_index.json
```

Every one of the 69 distinct PNGs referenced by the V2 UI manifest was
looked up in that index by library id. The index's own summary field reads:

```json
{ "licence": { "unverified": 114852 } }
```

**All 69 of the V4-relevant records read `"licence": "unverified"`.**

No pack-level licence file exists for any of the four packs. There is
therefore no licence text to point at, no author to attribute, and no
permission to redistribute.

### The inventory

| Pack | Files | Licence |
|---|---|---|
| Clipart | 28 | unverified |
| EPS_Clipart | 23 | unverified |
| Samples | 14 | unverified |
| 10000.HighDefinition.PNG.Icon.Pack | 4 | unverified |
| **Total** | **69** | **all unverified** |

Per-file record (a real entry, from `v4/data/quarantine-2d.json`):

```json
{
  "file": "assets/ui/bg-desert.png",
  "pack": "Clipart",
  "title": "Sand · j0157683",
  "library_id": "680510628657c92c95a4",
  "licence": "unverified",
  "source_url": "https://github.com/atiffhussainkhan/Image/releases/download/game-art-search-v2-2026-10-05/Clipart-cleaned-01.zip",
  "slots": ["bg.desert"],
  "redistributable": false,
  "decision": "QUARANTINE — licence unverified at source"
}
```

The inventory records the **file**, the **pack**, the **title**, the
**library id**, the **source URL** and the **decision** for every image, so
the clearance decision can be revisited without re-deriving anything.

### How the quarantine is enforced

The quarantine is not a note in a document; it is enforced in code, in four
places:

1. **`scripts/prepare-assets.mjs`** copies the 3D models only. The 2D art is
   never written into `v4/public/`.
2. **The asset catalogue** contains no 2D entry, so no 2D image can be
   loaded by id.
3. **The exporter** (`src/assets/export.js`) refuses any entry that is not
   redistributable, and refuses to create an `assets/ui/` directory. This
   refusal is covered by a test in `assets-library.test.mjs`.
4. **The audit** reports the quarantine on every run, so it cannot be
   forgotten:
   ```
   Note: 69 asset(s) are quarantined. The export refuses them by design.
   ```

### What this costs, stated plainly

The V4 HUD is drawn with CSS and text, not with the 2D icon set. That is a
direct consequence of the quarantine, and it is the correct trade: shipping
an image whose licence nobody can verify is not a trade at all.

### Who can close this

This is **not** a decision that can be taken from inside this repository.
It needs either:

- a licence file from the four source packs (the packs are
  `atiffhussainkhan/Image` release zips — the `source_url` in each record
  points at the exact archive), or
- a publisher with authority to accept a licence the library cannot verify.

Until one of those happens, the 69 images stay out of every V4 build.

---

## 4. Audio

**No audio ships with V4.** The cleared catalogue contains no audio files, so
the audio system (`src/audio/audio.js`) is present, wired and inspectable,
but silent. Adding sound requires cleared audio assets, which the current
catalogue does not contain.

---

## 5. Redistribution summary

| Population | Files | Bytes | Redistributable | In the V4 build |
|---|---|---|---|---|
| 3D models | 203 | 74,961,118 | Yes (CC0-1.0 / MIT) | **Yes** |
| 2D images | 69 | — | **No** | **No** |
| Audio | 0 | — | n/a | **No** |

Nothing else is redistributed. The V4 source, the licence texts and the
quarantine inventory are the only other files in the release.

---

## 6. Checks to re-run

```sh
cd v4-worktree/v4
node scripts/prepare-assets.mjs --check   # 203 source, 203 target, 0 refused
node tools/audit-assets.mjs               # 92 entries, 0 broken, 0 duplicates, 69 quarantined
node --test "tests/assets-library.test.mjs"  # the refusal to export quarantined art
```

The last one matters most: it is the check that proves the quarantine cannot
be bypassed by accident.
