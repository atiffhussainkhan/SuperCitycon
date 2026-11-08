# SuperCitycon — Mac portability, installation and migration

**Everything here was measured on the machine that produced this handover**, not
copied from a template. Where a claim could not be tested on this machine, it says
so rather than implying otherwise.

| | |
|---|---|
| Machine | macOS 26.7.1 (build 25G241) |
| Architecture | **x86_64 (Intel)** — see [Apple Silicon](#apple-silicon) |
| Node | 22.14.0 (npm 10.9.2) |
| Python | 3.15.2 |
| Git | 2.50.1 (Apple Git-155) |
| Verified on | 2026-11-08 |

---

## 1. What you actually need to install

There are **two** independent halves of this project. You can install either one
without the other.

### 1a. The playable game (2D/3D web build)

```bash
git clone <your-clone-url> supercitycon
cd supercitycon/game
npm ci                 # NOT `npm install` — `ci` installs the exact lockfile
npm run build:cleared  # the publishable bundle  ->  game/dist
npm run preview        # serves it at http://localhost:4173
```

`npm ci` is the important word: it installs exactly what `package-lock.json`
pins. `npm install` may resolve newer versions within the declared ranges and
would then not reproduce the verified build.

### 1b. The 3D design package (`minimax-game/`)

No install step. The gates are Python 3.11+ and use **only the standard
library** — there is nothing to `pip install`.

```bash
cd minimax-game
python3 tools/verify_design.py        # 31 checks, 0 FAIL
python3 tools/audit_depth.py          # 102/102 requirements implementable
python3 tools/verify_devbots.py       # 13 checks, 0 FAIL
python3 tools/fault_inject_hardened.py # 18/18 hardened checks bite
```

**The last gate needs the asset archive cache** (below). Without it, it reports
`[BLOCKED]` with the restore command and exits **2** — it never prints a
figure it did not earn, and never dies with a traceback.

**Optional but recommended:** the asset archive cache.

```bash
bash tools/fetch-3d-packs.sh
bash tools/fetch-remaining-3d.sh
```

This downloads ~2.4 GB into `platformer-docs/library-packs/`. It is a **cache of
a public upstream repository**, not project content, and it is gitignored. Both
fetch scripts resolve their destination from their own location, so they work
in any checkout; an explicit path argument overrides it.

The design gate resolves each of its 849 cited asset paths against the real
archive listings. With the cache absent, **722 of the 849 cannot be verified**
— 721 on a machine that also has the shared asset mirror, which holds one of
them — and the gate says so plainly. It does **not** call them fabricated: the
archives that would prove they exist were not there to open.

The sample below is the portable case — **no cache and no mirror**, which is
what a fresh checkout on a machine without the shared library sees:

```bash
mkdir -p /tmp/emptycache
GAMESTUDIO_PACK_CACHE_DIR=/tmp/emptycache GAMESTUDIO_ASSET_MIRROR=/tmp/emptycache/m \
  python3 tools/verify_design.py
```

```
[FAIL] asset archive cache: the cache is incomplete (22 missing); missing: …
       The cited asset paths are UNVERIFIED, not fabricated — this check cannot
       certify path resolution while the archives are absent. Restore with:
       bash tools/fetch-3d-packs.sh && bash tools/fetch-remaining-3d.sh
[FAIL] asset paths: 722/849 cited paths are UNVERIFIED because the archives that
       would prove them are absent — they are not known to be fabricated, and
       this run does not certify path resolution either way
```

Keep the cache if you want to re-run `verify_design.py`; skip it if you only
want to read the documents.

**The five development bots travel with the package** in
`minimax-game/agents/pd-dev-{platform,player,entities,world,assets}/agent.md`.
`verify_devbots.py` reads that portable copy by default, so the gate runs on a
fresh machine with no extra setup. To re-enable the bots in the desktop
runtime (so they can be dispatched as agents), install them once:

```bash
mkdir -p "$HOME/.minimax/agents"
cp -R minimax-game/agents/pd-dev-* "$HOME/.minimax/agents/"
```

The installed copy is what the gate falls back to when the portable copy is
absent; to check the installed ones explicitly:

```bash
python3 tools/verify_devbots.py --agents-dir "$HOME/.minimax/agents"
```

### 1c. The acceptance harness (headless browser)

The browser harness is the project's most important verification step, and it
needs Playwright. It is deliberately **not** a `package.json` dependency, so the
game itself stays a clean two-package install.

```bash
mkdir -p ~/.local/pw && cd ~/.local/pw
npm init -y && npm i playwright
npx playwright install chromium
```

`tools/playwright-resolve.mjs` finds it in this order:

1. `PLAYWRIGHT_MODULE` — an explicit path, if you set one.
2. `playwright` — a normal install in the repo (`cd game && npm i -D playwright`).
3. Known local locations, including the `~/.local/pw` path above.

If none resolve, it throws an error that tells you exactly which of the three to
do. **No tool hard-codes a path to one machine any more** — that was fixed during
this handover (see the handover report).

---

## 2. Environment configuration template

The game needs **no environment variables, no `.env` file and no secrets**. It
is a static site. The only optional variables are for the tooling:

```bash
# Copy to .env or export in your shell if you want to set these.
# None of them is required to build, test or run the game.

# Where the acceptance harness writes its screenshots and JSON ledger.
# Default: /tmp/sc-prod  (on macOS /tmp is swept by the OS, so point it at
# something durable if you want to keep the evidence.)
SC_VERIFY_OUTDIR="$HOME/Desktop/supercitycon-verification"

# Force an explicit Playwright location instead of auto-discovery.
# PLAYWRIGHT_MODULE="$HOME/.local/pw/node_modules/playwright/index.mjs"

# Which licence profile to build. "cleared" is the only publishable one.
# SC_SHIP_CLEARED=1
```

`SC_SHIP_CLEARED=1` is already wired into `npm run build:cleared`; the template
above just documents it.

---

## 3. Backup procedure

### What is worth backing up

| Path | Why | Size |
|---|---|---|
| `game/src/` | the source — irreplaceable | 1.4 MB |
| `game/public/assets/` | the model binaries — irreplaceable, 158 assets | 78 MB |
| `game/tests/`, `game/tools/` | the verification harness | ~60 KB |
| `docs/`, `game/*.md` | the specification and the defect log | ~100 KB |
| `minimax-game/platformer-docs/` | the 3D design package (**excluding** `library-packs/`) | 10 MB |
| `game/dist/` | regenerable in 4 seconds — **do not back up** | 93 MB |
| `game/node_modules/` | regenerable with `npm ci` — **do not back up** | 52 MB |
| `minimax-game/platformer-docs/library-packs/` | regenerable by the fetch scripts — optional | 2.4 GB |

### The procedure

```bash
cd /path/to/parent

# 1. the source, without the regenerable parts
rsync -a --exclude 'node_modules/' --exclude 'dist/' \
      --exclude 'library-packs/' \
      supercitycon/ supercitycon-backup/

# 2. a tarball if you prefer one file
tar czf supercitycon-src-$(date +%Y%m%d).tgz \
    --exclude='node_modules' --exclude='dist' \
    --exclude='library-packs' supercitycon/

# 3. verify the backup restores into a working tree
mkdir -p /tmp/restore-test && tar xzf supercitycon-src-*.tgz -C /tmp/restore-test
cd /tmp/restore-test/supercitycon/game && npm ci && npm test
```

**A backup of `game/public/assets/` is the one that matters.** It holds the 158
model binaries and is the only copy outside the upstream asset library. The
`kaykit-city-builder.zip` pack travels with the repository on purpose: it exists
nowhere else.

---

## 4. Migration guide (moving to a new Mac)

### From this Mac to another Mac

**Step 1 — check the new machine.** You need Node 20 or 22 and Python 3.11+:

```bash
node --version   # must be v18+, and 20.x or 22.x recommended
npm --version
python3 --version
```

**Step 2 — copy the tree.** Use git for the tracked content and a direct copy
for the model binaries:

```bash
git clone <your-clone-url> supercitycon
cd supercitycon
npm --prefix game ci
```

**Step 3 — restore what git does not carry:**

```bash
# the 2.4 GB asset archive cache (optional — only needed to re-run the 3D gates)
bash minimax-game/tools/fetch-3d-packs.sh
bash minimax-game/tools/fetch-remaining-3d.sh
```

**Step 4 — prove the migration worked:**

```bash
cd game
npm run check            # expect: 56/56 files parse cleanly
npm test                 # expect: 395 pass, 0 fail
npm run build:cleared    # expect: licence policy: CLEARED
npm run verify:production  # expect: 40/41 checks passed, 1 skipped
```

**Step 5 — the browser harness.** Install Playwright on the new machine
(section 1c) and run:

```bash
cd ..
node tools/scenario.mjs http://localhost:4173/ /tmp/sc-prod "PROD"
```

### Moving the published site to a different host

The build is a **static site** — `game/dist/` is the whole artefact. Two
constraints:

1. **It must be served from the root of a host.** The model and icon paths in
   the manifests are absolute (`/assets/models/...`, `/assets/ui/...`).
   `vite.config.js` sets `base: './'` for the HTML, but the manifests'
   *asset* paths are absolute, so a sub-path deployment will 404 the models.
2. **Serve it over HTTP, not `file://`.** ES modules and `fetch` of the asset
   manifest both require an HTTP origin.

GitHub Pages works and is already configured (`.github/workflows/deploy.yml`).
Any static host works: upload `game/dist/` as the site root.

---

## 5. MacBook setup instructions

For a fresh MacBook, in order:

**1. Install the command-line tools** (gives you git and a compiler):
```bash
xcode-select --install
```

**2. Install Node.** Use `nvm` so the version is per-shell and reversible:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 22
nvm alias default 22
npm install -g npm@10
```

**3. Install Python 3.11+** if macOS does not already satisfy it:
```bash
brew install python@3.12
```

**4. Clone and install:**
```bash
git clone <your-clone-url> supercitycon
cd supercitycon/game && npm ci
```

**5. Optional — the browser harness:**
```bash
mkdir -p ~/.local/pw && cd ~/.local/pw && npm init -y && npm i playwright
npx playwright install chromium
```

**6. Prove it:**
```bash
cd supercitycon/game && npm test && npm run verify:production
```

### Machine-specific notes

- **Apple Silicon: Rosetta is not needed and is not used.** There is no native
  binary in the shipped artefact and no native binary in the build chain that
  npm has to compile. `esbuild`, `rollup` and `fsevents` all ship
  prebuilt per-architecture binaries as optional dependencies, and npm picks the
  right one automatically.
- **The first `npm ci` on a new machine downloads the esbuild and rollup
  binaries for your architecture.** That is the only "compile" step and it is
  really a download.
- **Headless Chromium on Apple Silicon** needs the `darwin-arm64` Playwright
  browser; `npx playwright install chromium` fetches the right one for the host.
- **Software GL.** The headless browser runs on a software GL implementation,
  so the harness executes at a fraction of real frame rate. The harness
  deliberately drives the simulation through a fixed step
  (`SUPERCITYCON.step(dt)`) rather than waiting on wall-clock frames, so a low
  headless frame rate is an environment artefact and not a game defect.
- **Disk.** Allow ~1 GB for `game/` with dependencies, plus 2.4 GB more if you
  keep the 3D asset archive cache.
- **`/tmp` is swept by macOS.** The harness writes its evidence to `/tmp` by
  default. Point `--outdir` somewhere durable if you want to keep it.

---

## 6. Apple Silicon compatibility

**The honest position, stated precisely.**

The shipped artefact is a **static web bundle**: JavaScript, glTF/GLB models,
PNG textures, JSON manifests and one HTML file. A measurement of the built
bundle found **no native executables at all** — no Mach-O, no ELF:

```
117  glTF binary model        (.glb)
 42  JSON data                (.json, .gltf)
 35  data                     (.bin buffers, unrecognised by file(1))
 10  ASCII text               (.txt)
  3  Unicode text
  3  PNG image data
  3  OpenPGP Public Key       (the licence files)
  3  Matlab v4 mat-file       (.bin glTF buffers that file(1) misidentifies)
  1  c program text           (a .txt file file(1) misidentifies)
  1  HTML document text
```

(Measured on the **cleared** 219-file build. `file(1)` misidentifies some glTF
binary buffers; the count of **native executables is 0**, which is the point.)

There is therefore **nothing to rebuild for ARM**. The same `dist/` directory
runs on an Intel Mac, an Apple Silicon Mac, Windows or Linux, in any modern
browser. The game is WebGL + WebAudio; both are browser concerns.

What *is* architecture-specific, and how it is handled:

| Component | Intel | Apple Silicon | Mechanism |
|---|---|---|---|
| The game itself | ✅ | ✅ | platform-neutral static files — **identical bundle** |
| Vite / esbuild | ✅ | ✅ | `darwin-x64` and `darwin-arm64` are both optional deps in `package-lock.json`; npm installs the matching one |
| Rollup | ✅ | ✅ | same scheme (`rollup-darwin-arm64`) |
| `fsevents` (dev reload) | ✅ | ✅ | darwin-only optional dep; the dev server works without it |
| Playwright Chromium | ✅ | ✅ | separate browser download per architecture |
| The 3D design gates | ✅ | ✅ | pure Python standard library — no compilation |

**What was NOT tested.** This handover was produced on an **x86_64** Mac. The
Apple Silicon path above is derived from the lockfile's own optional-dependency
entries and from the fact that the shipped bundle contains no native code — it
is **not** an ARM build that was run on ARM hardware. **No ARM-specific claim in
this document has been executed on Apple Silicon.** The one-line check to close
that gap, on an M-series Mac, is section 5 step 6.

---

## 7. Recovery instructions

### The game does not load, or the screen is black

1. Serve it over HTTP, never `file://`:
   ```bash
   cd game && npm run preview   # http://localhost:4173
   ```
2. Open the browser's developer console. A blank screen with a 404 on
   `/assets/...` means the site is being served from a sub-path — it must be
   served from the **root** of a host.
3. `npm run build:cleared` prints `licence policy: CLEARED`. If it prints
   `LOCAL`, the 2D art is in the bundle — that is a valid local build, but it
   must not be published.

### The build fails

```bash
cd game && npm ci     # wipe and reinstall exactly the lockfile
npm run check          # 56/56 files must parse cleanly
npm run build:cleared
```

A build that fails with "referenced file(s) … not present" means a model
binary is missing from `game/public/assets/models/`. That directory is the one
thing git carries in full; restore it from the backup.

### The tests fail

```bash
cd game && npm test
```

395 tests, 8 suites. A failure in a single domain is a real regression: the
domain owners and the defect log are in `game/DEFECTS.md`.

### The acceptance harness cannot start

```bash
cd .. && node -e "import('./tools/playwright-resolve.mjs').then(async m=>{const r=await m.resolveChromium();console.log(r.source)})"
```

If that throws, follow the three options it prints. The most common cause is
that `npx playwright install chromium` was never run.

### The 3D design gate reports unverifiable asset paths

```bash
cd minimax-game
bash tools/fetch-3d-packs.sh          # restore the archive cache
bash tools/fetch-remaining-3d.sh
python3 tools/verify_design.py
```

Without the cache, **722 of the 849** cited paths cannot be verified (721 on a
machine that also has the shared asset mirror, which holds one of them) and the
gate says so. That is the gate working, not the gate being broken. The gate
names them **UNVERIFIED**, never fabricated, because the archives that would
prove them exist were not present to be opened.

### Recover the published site

The site is built from source by CI on every push to `main`; there is no
committed copy of the build output, so it cannot drift from the code. To
republish:

```bash
git push origin main     # .github/workflows/deploy.yml builds and deploys
```

If the deploy is stuck, re-run the workflow from the Actions tab
(`workflow_dispatch` is enabled).

---

## 8. Machine-specific limitations

| Limitation | Consequence | Workaround |
|---|---|---|
| The 3D asset archive cache (2.4 GB) is not in git | The design gate cannot verify 722 of 849 cited paths, and reports them as UNVERIFIED rather than fabricated | Re-run the two fetch scripts |
| `game/dist/` is gitignored | A fresh clone has no built bundle | `npm run build:cleared` (about 4 seconds) |
| `game/node_modules/` is gitignored | A fresh clone has no dependencies | `npm ci` |
| The headless browser runs on software GL | The harness is slow; it is not a performance measurement | The harness uses a fixed simulation step, so results are unaffected |
| `/tmp` is swept by macOS | Harness evidence disappears | `--outdir` to a durable path |
| The published site is served from the root of a host | Sub-path deployments 404 the models | Serve from the root, or rebuild with adjusted manifest paths |
| The 2D HUD art is licence-unverified | The publishable build has no 2D icons | Publish `build:cleared`; the HUD falls back to text labels and stays complete |
| The live site was serving the uncleared build | It showed 2D icons and a `DO-NOT-PUBLISH.txt` | Fixed in `deploy.yml` during this handover — see the handover report |
