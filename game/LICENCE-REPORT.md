# Licence report — SuperCitycon

**Everything in this game comes from the user's own asset library.** Nothing
was generated, redrawn, or substituted. This document states exactly what is
in the build and what may legally be published.

## The short version

| | |
|---|---|
| **3D models and animation** | 158 assets across 5 packs — **CC0-1.0 / MIT. Cleared for release.** |
| **2D HUD art** | 82 images from the user's image library — **`licence_status: unverified`. NOT cleared.** |
| **Shippable build** | `npm run build:cleared` — the 2D art is stripped; only the cleared 3D assets ship. |
| **Local build** | `npm run build` — contains the 2D art, for the owner's own use. Must not be published. |

The 2D art is included because the owner asked for the game to use their image
repository and owns that repository. It is included **honestly labelled**: the
HUD says so on screen, and every build writes its own licence status.

## What is in the build

### 3D — cleared

| Pack | Family | Assets | Licence | Author |
|---|---|---|---|---|
| KayKit City Builder Bits | `citybits` | 41 models | **CC0-1.0** | Kay Lousberg (KayKit) |
| Avramania Nature & Terrain | `nature` | 41 models | **CC0-1.0** | Avramania |
| Holokat Game Assets | `props` | 46 models | **MIT** | Holokat |
| KayKit Adventurers + Character Animations 1.2 | `characters` | 6 animated characters | **CC0-1.0** | Kay Lousberg (KayKit) |
| Quaternius Ultimate Animated Character | `citizens` | 14 animated citizens × 17 clips | **CC0-1.0** | Quaternius |
| Quaternius Ultimate Animated Animals | `creatures` | 8 animated creatures | **CC0-1.0** | Quaternius |
| KayKit Skeletons | `undead` | 2 animated skeletons | **CC0-1.0** | Kay Lousberg (KayKit) |

The licence texts ship with the build in `assets/LICENSES/`. Every model and
character was measured by `tools/build_manifest.py`, which walks each glTF
scene graph and records the exact world-space bounding box, footprint, height,
scale and ground offset — the manifest is the only source of art paths in the
code.

### 2D — not cleared

82 images (tool icons, category icons, HUD stat icons, backgrounds, portraits,
sprites, effects, tiles and UI chrome) come from the user's image library.
**Every 2D record in that library carries `licence_status: "unverified"`.** Not
one of them has been cleared for public release.

This is why publication is a deliberate act:

```bash
npm run build           # LOCAL: includes the 2D art; writes dist/LICENCE-STATUS.md
npm run build:cleared   # SHIPPABLE: strips dist/assets/ui/ and dist/assets/ui-assets.json
```

Both builds write `dist/LICENCE-STATUS.md`, which lists each asset set, its
licence and whether it is in the bundle.

**The gate is enforced, not just documented.** The cleared build deletes
`dist/assets/ui/` and `dist/assets/ui-assets.json`, and then **asserts that
BOTH are gone** — if either survives, the build **throws** and fails:

```
[build] licence policy: CLEARED (2D art stripped)
```

A local build additionally writes `dist/DO-NOT-PUBLISH.txt`, so a bundle that
carries the unverified art says so on its own disk.

**The cleared build loses no function.** The HUD is complete and correct with
zero 2D images — every icon slot falls back to its CSS/text treatment, and the
licence line is hidden because there is no art to disclaim. The scenario
harness asserts this explicitly (*"the HUD is complete and correct with ZERO 2D
images"*).

**Verified:** the cleared build passes the full browser harness (40 of 41
checks, with the single 2D-art check correctly skipped because the art is
absent). The local build passes 40 of 40.

## The in-game honesty line

When the 2D art IS loaded, the HUD shows:

```
82 ICON(S) FROM ASSET LIBRARY — LICENCE CLEARANCE PENDING.
```

An unverified image is never presented as cleared. The 3D packs are separately
licensed and are unaffected by that line.

## Audio

The library holds no audio, so the game uses a small procedural WebAudio synth
(`src/audio/audio.js`) — oscillators and noise buffers, no samples. There is no
third-party audio to license.

## What the owner has to do before publishing

1. Run a **licence pass over the 2D art**: for each of the 82 images, confirm
   the licence and record it. The manifest field to update is `licence` in
   `src/data/ui-assets.json` (currently `"unverified"` for every entry).
2. Until then, publish with `npm run build:cleared`, or keep the 2D art behind
   a feature flag once it is cleared.

## How to re-check this

```bash
cd game
npm run build:cleared
ls dist/assets/ui 2>&1            # must be: No such file or directory
ls dist/assets/ui-assets.json 2>&1  # must be: No such file or directory
cat dist/LICENCE-STATUS.md
```
