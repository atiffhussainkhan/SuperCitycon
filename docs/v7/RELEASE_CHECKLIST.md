# SuperCitycon V7 — Release Checklist

**Work down the list. The cheap checks come first; the irreversible step is
last.** Every item says whether it is AUTOMATED (a command covers it) or
MANUAL (a human must look).

The full runbook is [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## 1. The tree

- [ ] **AUTOMATED** — the worktree is clean: `git status --porcelain` prints nothing
- [ ] **AUTOMATED** — the branch is `development/v7`: `git branch --show-current`
- [ ] **AUTOMATED** — the V6 baseline is an ancestor: `git merge-base --is-ancestor ecc30fc HEAD`
- [ ] **MANUAL** — the version in `README.md` and `CHANGELOG.md` matches `game/package.json`

## 2. The verification battery

- [ ] **AUTOMATED** — `bash tools/run-v7-verification.sh` exits 0
- [ ] **MANUAL** — read `evidence/verification/status.tsv`: every line is `0`
- [ ] **MANUAL** — the evidence folder holds a log for each of the twelve checks

## 3. The browser scenarios

- [ ] **AUTOMATED** — `tools/scenario.mjs` → 40/41, one skip (the 2D art)
- [ ] **AUTOMATED** — `tools/scenario-gamepad.mjs` → 19/19
- [ ] **AUTOMATED** — `tools/scenario-v7.mjs` → 14/14
- [ ] **AUTOMATED** — `tools/scenario-devices.mjs` → 32/32
- [ ] **AUTOMATED** — `tools/compat-audit.mjs` → 43/43

## 4. The documentation

- [ ] **MANUAL** — `docs/v7/REQUIREMENTS.md` has the new requirements and their ids
- [ ] **MANUAL** — `docs/v7/FEATURE_MATRIX.md` maps every requirement to a test
- [ ] **MANUAL** — `docs/v7/TEST_RESULTS.md` carries the real counts
- [ ] **MANUAL** — `docs/v7/KNOWN_ISSUES.md` says what closed and what is still open
- [ ] **MANUAL** — `docs/v7/FINAL_VERIFICATION.md`'s gate table matches reality
- [ ] **AUTOMATED** — every claim in `docs/v7/` is traced to the code (the claim audit)
- [ ] **MANUAL** — `docs/v7/SENIOR_REVIEW.md` is written for this release

## 5. The version

- [ ] **AUTOMATED** — `game/package.json` → `"version": "7.0.0"`
- [ ] **AUTOMATED** — `game/package-lock.json` → the ROOT version
- [ ] **AUTOMATED** — `game/package-lock.json` → `packages[""]` version
- [ ] **AUTOMATED** — `game/src/core/log.js` → the `VITE_BUILD_VERSION` fallback
- [ ] **AUTOMATED** — the built bundle carries the version: `grep -o "7.0.0" game/dist/assets/index-*.js`
- [ ] **MANUAL** — `game/src/core/save.js` → `SAVE_VERSION` is still **2**

## 6. The package

- [ ] **AUTOMATED** — `node tools/package-game-release.mjs --out <dir>` exits 0
- [ ] **AUTOMATED** — the rebuild produces the same bytes
- [ ] **MANUAL** — the SHA-256 is recorded beside the package
- [ ] **MANUAL** — `MANIFEST.sha256` has one line per file

## 7. The commit and the push

- [ ] **MANUAL** — the commit message says what the release does
- [ ] **AUTOMATED** — `git push origin development/v7`
- [ ] **AUTOMATED** — `git ls-remote origin refs/heads/development/v7` matches the local HEAD

## 8. THE PUBLISHING STEP — irreversible

- [ ] **MANUAL** — `git checkout main && git pull --ff-only origin main`
- [ ] **AUTOMATED** — `git merge --ff-only development/v7` — it MUST be a fast-forward
- [ ] **MANUAL** — **if it is not a fast-forward, STOP.** The branches have diverged and the release needs a decision, not a push.
- [ ] **MANUAL** — `git push origin main` — **this deploys the game**

## 9. The deployment check

- [ ] **AUTOMATED** — the Actions run is green: `gh run list --workflow deploy.yml`
- [ ] **AUTOMATED** — `node tools/verify-deployment.mjs --expect-version 7.0.0` exits 0
- [ ] **MANUAL** — open <https://atiffhussainkhan.github.io/SuperCitycon/> and play for a minute
- [ ] **MANUAL** — the uncleared art markers 404 in the browser's network tab

## 10. The rollback, ready BEFORE you publish

- [ ] **MANUAL** — the previous good commit is known: `git log --oneline origin/main -3`
- [ ] **MANUAL** — the rollback command is written down:
      `git checkout main && git revert --no-edit <commit> && git push origin main`
- [ ] **MANUAL** — nobody's save needs a migration (the schema did not move)
