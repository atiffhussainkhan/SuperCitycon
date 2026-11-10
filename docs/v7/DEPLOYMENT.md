# SuperCitycon V7 — Deployment Runbook

**How a release is published, end to end.** Every command here exists and
works; the ones that change the world are marked.

The mechanism is simple: **pushing to `main` publishes the game.** GitHub
Actions (`.github/workflows/deploy.yml`) builds the cleared bundle and deploys
it to GitHub Pages at <https://atiffhussainkhan.github.io/SuperCitycon/>.

---

## 1. Before you touch anything

```bash
git checkout development/v7
git status --porcelain          # must be EMPTY — a dirty tree proves nothing
git fetch origin
git log --oneline -3
```

**The tree must be clean.** A check against uncommitted code proves nothing
about the commit, and the verification script refuses to run on a dirty tree
for exactly that reason.

**The baseline must be an ancestor.** The V7 branch descends from the V6
release commit `ecc30fc`:

```bash
git merge-base --is-ancestor ecc30fc HEAD && echo "the V6 baseline is intact"
```

---

## 2. The verification battery — ONE command

```bash
bash tools/run-v7-verification.sh
```

It runs twelve checks and writes a log per check plus a `status.tsv` beside
them. Exit 0 means every check passed.

| The check | What it proves |
|---|---|
| `install` | the dependencies resolve from the lock file |
| `syntax` | every source file parses |
| `tests` | the whole unit suite passes |
| `content` | the shipped levels validate and the reachability proof holds |
| `gpu-tools` | the performance tooling's own tests pass |
| `audit` | no known dependency vulnerability |
| `secret-scan` | no credential-shaped value in the tree |
| `cleared-build` | the shippable bundle builds and is licence-clean |
| `navigation-prof` | the path search is inside its budget |
| `cleared-contents` | the bundle carries no uncleared 2D art |
| `production` | the assembled game passes the acceptance harness |
| `package` | the release package builds, hashes and is reproducible |

**The evidence lands in** `../SuperCitycon-V7-runs/evidence/verification`.

---

## 3. The browser scenarios

```bash
cd game && npm run build:cleared && npx vite preview --port 4210 --strictPort &
cd ..
node tools/scenario.mjs         http://localhost:4210/ /tmp/sc-v5  v5-acceptance
node tools/scenario-gamepad.mjs http://localhost:4210/ /tmp/sc-pad v6-gamepad
node tools/scenario-v7.mjs      http://localhost:4210/ /tmp/sc-v7  v7
node tools/scenario-devices.mjs http://localhost:4210/ /tmp/sc-dev v7-devices
node tools/compat-audit.mjs     http://localhost:4210/ /tmp/sc-compat
```

**Each one takes a URL and an output folder as POSITIONAL arguments.** There
are no flags. A call like `--url https://…` is refused, because a mistake in
the invocation used to write the evidence into a directory named after the
URL.

---

## 4. The documentation gate

For a new version, these need updating — and nothing else:

| The document | What changes |
|---|---|
| `docs/v7/REQUIREMENTS.md` | the new requirements and their ids |
| `docs/v7/FEATURE_MATRIX.md` | the new features and their tests |
| `docs/v7/TEST_RESULTS.md` | the new counts |
| `docs/v7/PERFORMANCE_REPORT.md` | the new measurements |
| `docs/v7/FINAL_VERIFICATION.md` | the gate table |
| `docs/v7/KNOWN_ISSUES.md` | what closed and what is still open |
| `CHANGELOG.md` | the release entry |
| `README.md` | the version line |

---

## 5. The version bump — FOUR places, and one that must NOT move

| # | The place | The value |
|---|---|---|
| 1 | `game/package.json` | `"version"` |
| 2 | `game/package-lock.json` — the ROOT | `"version"` |
| 3 | `game/package-lock.json` — `packages[""]` | `"version"` |
| 4 | `game/src/core/log.js` | the `VITE_BUILD_VERSION` fallback |

**The save schema does NOT move.** `game/src/core/save.js` keeps
`SAVE_VERSION = 2`. The product version and the save format version are two
different numbers on purpose: a V5, V6 or V7 city opens in any of them.

Miss #2 or #3 and `npm ci` refuses the lock file. Miss #4 and a build without
the bundler stamps the old version.

---

## 6. Commit, push, and the merge to `main`

```bash
git add -A
git commit -m "..."
git push origin development/v7
```

**Then the merge.** `main` is the Pages source branch, so this step PUBLISHES:

```bash
git checkout main
git pull --ff-only origin main
git merge --ff-only development/v7     # a fast-forward: no history is rewritten
git push origin main                   # ← THIS DEPLOYS
```

The merge is a **fast-forward**: `development/v7` contains every commit on
`main`, so the merge adds no merge commit and rewrites nothing. If it is not
a fast-forward, STOP — that means the branches have diverged and the release
needs a decision, not a push.

**Never** force-push `main`, and never rewrite the V6 release branch.

---

## 7. The deployment check — after the push

```bash
node tools/verify-deployment.mjs --url https://atiffhussainkhan.github.io/SuperCitycon/ --expect-version 7.0.0
```

It proves that what is SERVED is what was INTENDED:

- the site answers;
- the bundle the page references is served;
- the served bundle carries the expected version;
- the uncleared 2D art markers all 404;
- a 3D model is served;
- the page does not reference the uncleared art.

**The deploy takes a couple of minutes.** The Actions run builds the bundle
from scratch on `ubuntu-latest`. Check the run with:

```bash
gh run list --workflow deploy.yml --limit 3
gh run watch <run-id>
```

---

## 8. The rollback

```bash
git checkout main
git revert --no-edit <the release commit>   # or:
git reset --hard <the previous good commit>  # ONLY on a local branch
git push origin main                        # ← this redeploys the previous build
```

**No save migration is needed in either direction**, because the schema did
not move. A city saved in V7 opens in V6.

---

## 9. The failure modes

| What goes wrong | What you see | What to do |
|---|---|---|
| The bundle carries uncleared 2D art | `npm run build:cleared` FAILS | Do not publish. The build refuses to produce it; fix the build, do not relax the check. |
| The package checksum changes between builds | two different SHA-256s | **Expected.** The bundle embeds its build time, so two builds differ. The checksum identifies THAT package, not "the release". |
| A version bump misses the lock file | `npm ci` errors | Update #2 and #3 above. |
| A port is busy | the scenario cannot reach the server | Use another port: `SUPERCITYCON_V7_PORT=4213 bash tools/run-v7-verification.sh`, or `npx vite preview --port 4220`. |
| The live site serves a stale bundle | the version check fails, or the old bundle name | The Pages cache. Wait a minute and re-run; GitHub Pages caches the CDN edge for a short while. |
| A save a player cannot open | `core/save-compat.test.mjs` fails | The schema moved by accident. Revert it: the schema is version 2 and does not move. |
| A secret committed by accident | `tools/secret-scan.mjs` fails | The scan runs BEFORE the push. Rotate the credential if it was ever pushed, and remove it from the tree. |
| The deploy workflow fails on the bundle check | the Actions run is red | The build produced something the workflow will not publish. Read the log; do not disable the check. |
| The worktree is dirty when the verification runs | the script refuses | Commit first, or stash deliberately. The script will not verify uncommitted code. |

---

## 10. The release history

| The release | The branch | The commit | What it added | Its status |
|---|---|---|---|---|
| **V5** | `v5/upgrade` | `412b066` | the requirements dossier, the studio, the hazards, the content pipeline | a release candidate |
| **V6** | `v6/upgrade-Zehe03` | `ecc30fc` | the gamepad (KI-05, which V5 had claimed and never built), the 6.0.0 identity, the V5 save compatibility | a release candidate |
| **V7** | `development/v7` | `89f1764`+ | the citizen navigation, the touch input, the reachability proof, the pad rebinding, the debug panel, the city profiler, the device and compatibility audits | **published** |
