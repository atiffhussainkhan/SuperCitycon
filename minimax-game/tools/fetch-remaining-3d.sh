#!/usr/bin/env bash
# Fetch the remaining 3D-relevant release assets for the platformer survey.
# Each is a separate curl with retries; failures are reported, not fatal.
set -u
REPO="https://github.com/atiffhussainkhan/Image/releases/download"
# Derived from this script's own location, so the package works on any
# machine and in any checkout. A hard-coded absolute path from one session
# made this script fetch into a directory that did not exist anywhere else.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/../platformer-docs/library-packs}"
mkdir -p "$OUT"

fetch() {
  tag="$1"; name="$2"
  dest="$OUT/$name"
  if [ -s "$dest" ]; then echo "SKIP $name (already present)"; return 0; fi
  url="$REPO/$tag/$name"
  for attempt in 1 2 3; do
    if curl -sL --fail --retry 2 --connect-timeout 20 --max-time 900 -o "$dest.part" "$url"; then
      mv "$dest.part" "$dest"
      echo "OK   $name  $(du -h "$dest" | cut -f1)"
      return 0
    fi
    echo "RETRY $name (attempt $attempt)"
    sleep 5
  done
  rm -f "$dest.part"
  echo "FAIL $name"
  return 1
}

fetch "asset-bot-tranche-2026-10-25" "polyhaven-cc0-hdris-textures-models.zip"
fetch "asset-bot-tranche-2026-10-25" "godot-asset-library-3d-animation.zip"
fetch "asset-bot-tranche-2026-10-25" "kenney-cc0-game-art-packs.zip"
fetch "mega-assets-expansion-v2" "kaykit-halloween.zip"
fetch "mega-assets-expansion-v2" "kaykit-city-builder.zip"
fetch "mega-assets-expansion-v2" "kaykit-prototype-bits.zip"
fetch "mega-assets-expansion-v2" "kaykit-furniture.zip"
fetch "mega-assets-expansion-v2" "kaykit-dungeon-remastered.zip"
fetch "catalog-completion-2026-10-06" "jean-charpentier-lowpoly.zip"
fetch "mega-acquisition-2026-10-25" "04-ui.zip"
fetch "mega-acquisition-2026-10-25" "05-environments.zip"
fetch "mega-acquisition-2026-10-25" "07-vfx.zip"
fetch "mega-acquisition-2026-10-25" "08-tiles.zip"
fetch "mega-acquisition-2026-10-25" "10-kenney-collection.zip"
echo "=== FETCH BATCH DONE ==="
ls -la "$OUT"
