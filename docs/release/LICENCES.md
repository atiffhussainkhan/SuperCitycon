# Dependency and licence manifest — MiniMax Game Studio ULTRA V2

**Every asset in this game comes from the user's own asset library.** Nothing was
generated, redrawn, or substituted. This manifest states exactly what is in the
build and what may legally be published.

The machine-readable version of the dependency half is `docs/dependency-manifest.json`.

---

## 1. Software dependencies

| Package | Declared | Installed | Licence | Role |
|---|---|---|---|---|
| `three` | `^0.169.0` | 0.169.0 | MIT | the 3D renderer |
| `vite` | `^5.4.10` | 5.4.21 | MIT | the build tool and dev server (dev-only) |
| `esbuild` | (transitive) | 0.21.5 | MIT | Vite's transform pipeline (dev-only) |
| `rollup` | (transitive) | 4.65.0 | MIT | Vite's bundler (dev-only) |
| `fsevents` | (transitive, optional) | 2.3.3 | MIT | macOS file-watching for the dev server (dev-only) |
| `playwright` | **not a package.json dependency** | 1.64.0 | Apache-2.0 | drives the headless Chromium for the acceptance harness |
| Python (stdlib only) | — | 3.15.2 | — | the 3D design gates — **nothing to install** |

`npm ci` installs exactly the lockfile. The only platform-specific packages are
optional prebuilt binaries (`@esbuild/darwin-x64`, `@esbuild/darwin-arm64`,
`@rollup/rollup-darwin-x64`, `@rollup/rollup-darwin-arm64`, …); npm selects the
matching one automatically.

**Known advisories:** 2, both in `vite`/`esbuild`, both affecting the **dev
server only**, neither present in the shipped bundle. Full analysis and
mitigation in `PERFORMANCE.md` §4.

## 2. Game assets

### 2.1 3D — CLEARED for release

All art is from the user's own asset library. All licences are CC0-1.0 or MIT.

| Pack | Family | Assets | Licence | Author |
|---|---|---|---|---|
| KayKit City Builder Bits | `citybits` | 41 models | **CC0-1.0** | Kay Lousberg (KayKit) |
| Avramania Nature & Terrain | `nature` | 41 models | **CC0-1.0** | Avramania |
| Holokat Game Assets | `props` | 46 models | **MIT** | Holokat |
| KayKit Adventurers + Character Animations 1.2 | `characters` | 6 animated characters | **CC0-1.0** | Kay Lousberg (KayKit) |
| Quaternius Ultimate Animated Character | `citizens` | 14 animated citizens × 17 clips | **CC0-1.0** | Quaternius |
| Quaternius Ultimate Animated Animals | `creatures` | 8 animated creatures | **CC0-1.0** | Quaternius |
| KayKit Skeletons | `undead` | 2 animated skeletons | **CC0-1.0** | Kay Lousberg (KayKit) |

**158 assets total.** The licence texts ship with the build in
`game/dist/assets/LICENSES/`. Every model and character was measured by
`tools/build_manifest.py`, which walks each glTF scene graph and records the
exact world-space bounding box, footprint, height, scale and ground offset —
**the manifest is the only source of art paths in the code**.

### 2.2 2D — NOT cleared for release

**69 distinct 2D images** across **84 HUD records** — 82 of those records reference an image file, and 12 files serve more than one slot (tool icons, category icons, HUD stat icons, backgrounds,
portraits, sprites, effects, tiles and UI chrome) come from the user's image
library. **Every 2D record in that library is licence-unverified** — the
library's own field is `licence_status: "unverified"`, and the game's published
manifest records it as `licence: "unverified"`. Not one has been cleared for
public release.

| Build | Contains the 2D art? | Publishable? |
|---|---|---|
| `npm run build:cleared` | **No** — stripped, and the build **throws** if either the folder or the manifest survives | **Yes** |
| `npm run build` | Yes — and it writes `dist/DO-NOT-PUBLISH.txt` saying so | **No** |

The cleared build **loses no function**: the HUD is complete and correct with
zero 2D images — every icon slot falls back to its CSS/text treatment, and the
licence disclaimer line is hidden because there is no art to disclaim. The
acceptance harness asserts this explicitly.

### 2.3 Audio — no third-party audio

The library holds **no audio**, so the game uses a small **procedural WebAudio
synth** (`game/src/audio/audio.js`) — oscillators and noise buffers, no samples.
There is no third-party audio to license.

### 2.4 Fonts

One family: **Kenney Vector Future** (regular and thin), CC0, from the Kenney
CC0 collection.

## 3. The in-game honesty line

When the 2D art IS loaded (the local build), the HUD shows:

```
2D icons: your asset library — licence clearance pending.
```

An unverified image is never presented as cleared. The 3D packs are separately
licensed and are unaffected by that line.

## 4. The 3D design package

`minimax-game/` contains **documentation and tooling only** — no art, no audio,
no third-party code. Its asset *citations* point into the same user library
described above; the path **inventory** (10 MB of listings) travels with the
repository, while the 2.4 GB archive cache it was derived from does not (it is
gitignored, and re-fetchable with `minimax-game/tools/fetch-3d-packs.sh`).

## 5. Secrets

**None.** The release package is scanned for credential patterns before it is
written, and the scan is part of the packaging script:

```
=== 3. secret scan ===
  clean — 699 files scanned, no credential patterns matched
```

The game needs no environment variables, no `.env` file and no credentials.

## 6. How to re-check the licence position yourself

```bash
cd game
npm run build:cleared
ls dist/assets/ui            # must be: No such file or directory
ls dist/assets/ui-assets.json  # must be: No such file or directory
ls dist/DO-NOT-PUBLISH.txt     # must be: No such file or directory
cat dist/LICENCE-STATUS.md
```

And the full report is in `game/LICENCE-REPORT.md`.
