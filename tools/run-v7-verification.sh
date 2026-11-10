#!/usr/bin/env bash
#
# tools/run-v7-verification.sh — the V7 verification pipeline.
#
# ONE command that runs every release check and writes the evidence, so the
# release can be verified again by anyone on any machine:
#
#   bash tools/run-v7-verification.sh [evidenceDir]
#
# It must be run from a CLEAN worktree at the commit being verified. The
# script refuses to run against a dirty tree, because a check against
# uncommitted code proves nothing about the commit.
#
# Exit code: 0 when every check passed, 1 when any check failed.
#
# The checks, in order:
#   install          the dependencies resolve from the lock file
#   syntax           every source file parses
#   tests            the unit suite
#   content          the content validator, with the reachability proof
#   gpu-tools        the performance tooling's own tests
#   audit            the dependency vulnerability check
#   secret-scan      no credential-shaped value in the tree
#   cleared-build    the shippable bundle builds and is licence-clean
#   cleared-contents the bundle carries no uncleared 2D art
#   navigation-prof  the navigation benchmark against its budget
#   production       the full cleared-build acceptance harness
#   package          the release package builds and hashes

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
GAME="$REPO_ROOT/game"
EVIDENCE="${1:-$REPO_ROOT/../SuperCitycon-V7-runs/evidence/verification}"

mkdir -p "$EVIDENCE"
EVIDENCE="$(cd "$EVIDENCE" && pwd -P)"
STATUS="$EVIDENCE/status.tsv"
: > "$STATUS"

REVISION="$(git -C "$REPO_ROOT" rev-parse HEAD)"
BRANCH="$(git -C "$REPO_ROOT" branch --show-current)"
DIRTY="$(git -C "$REPO_ROOT" status --porcelain --untracked-files=normal)"

if [ -n "$DIRTY" ]; then
  echo "REFUSING to verify a dirty worktree." >&2
  echo "Commit the changes first — a check against uncommitted code proves nothing." >&2
  git -C "$REPO_ROOT" status --short >&2
  exit 1
fi

{
  printf 'Revision %s\nBranch %s\nEvidence %s\nStarted %s\n' \
    "$REVISION" "$BRANCH" "$EVIDENCE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} | tee "$EVIDENCE/revision.txt"

FAILED=0

check() {
  local name="$1"; shift
  printf '  %-16s ' "$name"
  if "$@" > "$EVIDENCE/$name.log" 2>&1; then
    printf 'PASS\n'
    printf '%s\t0\n' "$name" >> "$STATUS"
  else
    local code=$?
    printf 'FAIL (exit %s)\n' "$code"
    printf '%s\t%s\n' "$name" "$code" >> "$STATUS"
    FAILED=1
  fi
}

echo "Running the V7 verification pipeline."

check install            npm --prefix "$GAME" ci
check syntax             npm --prefix "$GAME" run check
check tests              npm --prefix "$GAME" test
check content            node "$GAME/tools/validate-content.mjs"
check gpu-tools          node --test "$REPO_ROOT/tools/performance-gpu.test.mjs"
check audit              npm --prefix "$GAME" audit
check secret-scan        node "$REPO_ROOT/tools/secret-scan.mjs"
check cleared-build      npm --prefix "$GAME" run build:cleared
check navigation-prof    node "$REPO_ROOT/tools/profile-navigation.mjs"

# The bundle must not carry the uncleared 2D art.
cleared_contents() {
  local dist="$GAME/dist"
  [ -d "$dist" ] || { echo "no dist"; return 1; }
  local bad=0
  for pattern in 'assets/ui/' 'assets/ui-assets.json' 'DO-NOT-PUBLISH.txt'; do
    if [ -e "$dist/$pattern" ]; then
      echo "FORBIDDEN: $dist/$pattern"
      bad=1
    fi
  done
  if [ -d "$dist/assets/models" ]; then
    echo "the 3D packs are present"
  else
    echo "MISSING: $dist/assets/models"
    bad=1
  fi
  return $bad
}
check cleared-contents cleared_contents

# The production harness needs a port of its own.
PROD_PORT="${SUPERCITYCON_V7_PORT:-4193}"
production() {
  npm --prefix "$GAME" run verify:production -- --profile cleared --port "$PROD_PORT" \
    --outdir "$EVIDENCE/production"
}
check production production

# The release package.
package() {
  node "$REPO_ROOT/tools/package-game-release.mjs" --out "$EVIDENCE/release"
}
check package package

echo
echo "Evidence: $EVIDENCE"
cat "$STATUS"

if [ "$FAILED" -ne 0 ]; then
  echo
  echo "FAIL — at least one check failed. See the logs in $EVIDENCE."
  exit 1
fi

echo
echo "PASS — every check passed."
exit 0
