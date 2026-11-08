# Recovery instructions — MiniMax Game Studio ULTRA V2

For when something is broken and you need to get back to a working state. Every
command here was run on the machine that produced this package.

---

## Triage order

Work down this list. Each step is cheap and each one rules something out.

```bash
cd game
npm run check      # 1. does everything parse?
npm test           # 2. do the 395 tests pass?
npm run build:cleared   # 3. does it build?
```

If step 1 or 2 fails, the problem is in the source and `git status` will show
what changed. If only step 3 fails, the problem is in the build configuration.
If all three pass and the *game* looks wrong, it is a content or balance issue
— see `game/DEFECTS.md`.

---

## 1. The game will not load, or the screen is black

**Serve it over HTTP. Never open `index.html` with `file://`.** ES modules and
the `fetch` of the asset manifest both require an HTTP origin.

```bash
cd game
npm run build:cleared
npm run preview      # http://localhost:4173
```

**A blank screen with a 404 on `/assets/...` means the site is being served
from a sub-path.** The model and icon paths in the manifests are absolute
(`/assets/models/...`), so the game **must be served from the root of a host**.
GitHub Pages serves the project site at the root of `SuperCitycon/`, which
works. A deep sub-path will not.

**The page shows a "fatal" panel.** That is the game telling you a boot
dependency failed. The boot log is in the browser console; the eight runtime
domains (`wld`, `buildings`, `economy`, `mobility`, `population`, `services`,
`studio`, `ui`) and their readiness order are logged there too.

## 2. The build fails

```bash
cd game
npm ci          # wipe node_modules and reinstall EXACTLY the lockfile
npm run check
npm run build:cleared
```

`npm ci` — not `npm install`. `npm install` may resolve newer versions inside
the declared ranges and would then not reproduce the verified build.

**"referenced file(s) … not present"** means a model binary is missing from
`game/public/assets/models/`. That directory is the one thing git carries in
full; restore it from the backup (see `MIGRATION.md` §3).

**A licence-policy error** means the build was interrupted between stripping
the 2D art and asserting it was gone. Run `npm run build` (the local profile)
and then `npm run build:cleared` again — the local build puts the art back, the
cleared build removes it.

## 3. The tests fail

```bash
cd game
npm test
```

395 tests, 8 suites. `node --test` auto-discovers; do **not** use
`node --test tests/`, which Node 22 treats as a module path and fails on.

A failure in one domain is a real regression. The domain owners and every
previously found defect — with its reproduction — are in `game/DEFECTS.md`.
Every one of the 17 logged defects is currently marked FIXED, so a new failure
is new information, not a known issue resurfacing.

To run one suite:
```bash
node --test tests/integration.test.mjs
```

## 4. The acceptance harness will not start

```bash
cd ..
node -e "import('./tools/playwright-resolve.mjs').then(async m=>{const r=await m.resolveChromium();console.log(r.source)})"
```

If that throws, it prints three ways to fix it. The usual cause is that the
browser was never downloaded:

```bash
cd game && npx playwright install chromium
```

**"the preview server did not come up"** — the port is in use. Pass another one:

```bash
cd game && npm run verify:production -- --port 4188 --outdir /tmp/sc-prod
```

## 5. The acceptance harness fails against the LIVE site

The live site is built by CI on every push to `main`; there is no committed copy
of the build output, so it cannot drift from the code. If the live site is
broken, the source is broken — rebuild locally and find out:

```bash
cd game && npm run build:cleared && npm run verify:production
```

If the local build passes and the live site does not, re-run the workflow from
the GitHub Actions tab (`workflow_dispatch` is enabled on
`.github/workflows/deploy.yml`).

## 6. The 3D design gate reports unverifiable asset paths

```bash
cd minimax-game
bash tools/fetch-3d-packs.sh
bash tools/fetch-remaining-3d.sh
python3 tools/verify_design.py
```

The gate resolves each of its 849 cited asset paths against the real archive
listings. With the archive cache absent, **722 of the 849 cannot be verified**
— 721 on a machine that also has the shared asset mirror, which holds one of
them — and the gate says so. **That is the gate working, not the gate being
broken.** The archives are a cache of a public upstream repository, not project
content; they are gitignored.

The gate names those paths **UNVERIFIED**, never fabricated, because the
archives that would prove they exist were not present to be opened. It also
names the missing archives and the command that restores them, so the cause is
readable without a full report.

## 7. Recover the published site

```bash
git push origin main     # .github/workflows/deploy.yml builds and deploys
```

Or re-run it from the Actions tab. The workflow builds with
`npm run build:cleared` and asserts that the uncleared 2D art and the
`DO-NOT-PUBLISH.txt` notice are **absent** before it deploys, so a bundle that
must not be published cannot reach the public site through CI.

## 8. Start completely over, from the repository

The worst case, and the cheapest:

```bash
cd /path/to/parent
git clone <your-clone-url> supercitycon
cd supercitycon/game
npm ci
npm run check && npm test && npm run build:cleared
```

If the model binaries are also gone, restore them from the backup described in
`MIGRATION.md` §3, or re-fetch them from the upstream asset library.
