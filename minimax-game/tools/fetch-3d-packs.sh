#!/usr/bin/env bash
# Fetch the 3D-relevant packs from the Image repository's releases so the
# design can cite REAL asset names instead of guessing.
set -u
# The destination is derived from this script's own location, so the package
# works on any machine and in any checkout. A hard-coded absolute path from
# one session made this script fetch into a directory that did not exist
# anywhere else. An explicit first argument still overrides it.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${1:-$HERE/../platformer-docs/library-packs}"
mkdir -p "$DEST"

BASE="https://github.com/atiffhussainkhan/Image/releases/download"

fetch() {  # tag  filename
  local tag="$1" name="$2" out="$DEST/$2"
  if [ -s "$out" ]; then echo "SKIP  $name (already there)"; return 0; fi
  echo "GET   $name"
  curl -sL --retry 3 --retry-delay 2 -o "$out.part" "$BASE/$tag/$name" && mv "$out.part" "$out" \
    && echo "OK    $name ($(du -h "$out" | cut -f1))" \
    || { echo "FAIL  $name"; rm -f "$out.part"; }
}

fetch "asset-bot-tranche-2026-10-25" "fps-asset-kit.zip"
fetch "asset-bot-tranche-2026-10-25" "fps-buildings-env-kit.zip"
fetch "mega-acquisition-2026-10-25" "01-characters.zip"
fetch "mega-acquisition-2026-10-25" "02-fantasy.zip"
fetch "mega-acquisition-2026-10-25" "03-scifi.zip"
fetch "mega-assets-v1" "shorepine-kenney.zip"
fetch "mega-assets-v1" "ambientcg-cc0-pbr-materials.zip"
fetch "staged-pixel-adventure-2026-10-25" "pixel-frog-pixel-adventure-1.zip"

echo "=== fetched ==="
du -sh "$DEST"
ls -la "$DEST"
