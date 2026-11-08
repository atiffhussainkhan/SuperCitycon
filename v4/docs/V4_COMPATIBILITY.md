# MiniMax Game Studio Ultra V4 — Compatibility

What was actually built on, actually run, and actually verified — and what
was not.

## 1. The platform matrix, honestly

| Platform | Status | What was done | What was **not** done |
|---|---|---|---|
| **macOS, Intel (x86_64)** | **TESTED** | The full build, the full test suite, the 28-check browser acceptance run, the real-GPU profile, the asset pipeline. This is the reference platform. | — |
| **macOS, Apple Silicon (arm64)** | **BLOCKED — NOT TESTED** | The project is portable web technology with no x86-specific code, so an arm64 build is expected to work. **That is an expectation, not a measurement.** | No ARM hardware exists here (`hw.optional.arm64` absent, Intel i9-9980HK). No ARM build was produced, no ARM binary was compiled, no ARM performance was measured. **No Apple Silicon support is claimed.** |
| **Windows** | **NOT TESTED** | The V4 *runtime* is pure web technology: ES modules, WebGL 2, Web Audio, `localStorage`, `fetch`. It uses no POSIX-only API. | No Windows machine was available. The *tooling* (`scripts/`, `tools/`) uses `node:` APIs and shell commands that were only exercised on macOS. |
| **Linux** | **NOT TESTED** | Same runtime argument as Windows. | No Linux machine was available. |
| **Modern browsers (Chromium)** | **TESTED** | Every check in this release was run in Chromium: headless (the acceptance harness) and headed (the real-GPU profile). | — |
| **Firefox, Safari, Edge** | **NOT TESTED** | The runtime uses only long-standing web standards (ES2022, WebGL 2, Web Audio, `ResizeObserver`-free layout, `import.meta.glob`-free bundling). | Not installed here. **Chromium-only is the tested claim.** |

### The Apple Silicon gate stays open

The directive asked for genuine platform tests where hardware was available.
It was not, so the gate is recorded as open rather than quietly closed. The
only honest thing to say about arm64 is:

- the code contains no x86-specific instructions, no native addons and no
  binary dependency;
- the two runtime dependencies (`three`, `vite`) are pure JavaScript;
- **but "it should work" is not "it was tested", and only the second counts.**

When an arm64 Mac is available, the verification is:

```sh
cd v4-worktree/v4
npm ci && npm run build
node scripts/gpu-profile.mjs "http://127.0.0.1:4180/" --out verification/gpu-arm --seconds 10 --label v4-arm
npm run slice
```

The probe reports the renderer identity, so an Apple Silicon GPU would be
identified as such — and the software-renderer refusal still applies.

## 2. The environment V4 was built and verified on

| | |
|---|---|
| OS | macOS (Darwin 25.6.0) |
| Architecture | x86_64 |
| CPU | Intel Core i9-9980HK |
| GPU | Intel UHD Graphics 630 (integrated), via ANGLE → Metal |
| Node | v22.14.0 |
| Browser | Chromium (headless and headed) |
| Package manager | npm (a committed `package-lock.json`) |
| Build tool | Vite 5.4 |
| Engine | Three.js 0.169 |

## 3. Dependencies

V4 introduces **two** dependencies, and both are already in the project
family:

| Package | Version | Why |
|---|---|---|
| `three` | `^0.169.0` | The renderer, the GLTF loader, `SkeletonUtils`, `TransformControls`. Writing a custom renderer would have been strictly worse: the directive says to prefer a mature framework. |
| `vite` (dev) | `^7.3.7` | The dev server, the production build, the code splitting. Upgraded from `^5.4.10` during the final integration pass: `esbuild <= 0.24.2` is reachable through `vite <= 6.4.3` (GHSA-67mh-4wv8-2f99 — the dev server allows any origin to read its responses), and `npm audit` reported it. Vite 7 requires Node `^20.19.0 \|\| >=22.12.0`; this machine runs Node 22.14.0. The build output, the chunk layout and the browser acceptance run were all re-verified after the upgrade. |

**No paid dependency was introduced.** `npm audit` reports **0
vulnerabilities**.

### Node version note

`node --test tests/` does not accept a directory on Node v22.14.0 — it
resolves the path as a module and fails with `Cannot find module …/tests`.
`v4/tests/index.mjs` and `v4/tests/package.json` make that form work, and
the glob form `node --test "tests/*.test.mjs"` always has. Both run the
same 149 tests.

### Browser APIs the app relies on

| API | Used for | Fallback |
|---|---|---|
| WebGL 2 (via Three.js) | The viewport | None — a machine without WebGL cannot run the editor |
| Web Audio | The audio mixer | A null backend; the game runs silently |
| `localStorage` | The scene store | A failed write now **throws** rather than silently vanishing |
| `requestAnimationFrame` | The frame loop | None |
| `Element.getBoundingClientRect`, `clientWidth` | Picking and sizing | None |
| ES modules, dynamic `import()` | The code splitting | The optional subsystems degrade with a logged warning |

The app **degrades rather than dies**: every optional subsystem (the editor,
the NPC system, the controller, the interaction system, the HUD, the
objectives) is loaded inside a try/catch that logs a warning and carries on.

## 4. Portability

### Moving to another MacBook

```sh
git clone <repo>
cd <repo>/v4-worktree/v4     # or wherever the v4 app lives
npm ci                       # or: npm install
npm run build
npm run preview
```

The asset pipeline is reproducible: `npm run build` re-runs
`prepare-assets.mjs`, which re-copies the 203 cleared models and
re-verifies every sha256. If the models are already present and intact, it
reports `refused 0` and changes nothing.

### What is machine-specific and what is not

| Kept out of the repository | Why |
|---|---|
| `v4/node_modules/` | Regenerated by `npm ci` |
| `v4/dist/` | A build artefact |
| `v4/verification/diagnostics/` | Local diagnostic output |
| `v4/public/assets/models/` | **In the repository** — 203 files, 92 MB, sha256-verified, so a fresh clone works without re-running the pipeline |

The lockfile is committed, so the dependency versions are pinned.

### Editor tooling assumptions

| Assumption | On macOS | On Windows / Linux |
|---|---|---|
| `node --test` | Works | Works (same Node) |
| `node tools/check-syntax.mjs` | Works | Works |
| `node tools/audit-assets.mjs` | Works | Works |
| `scripts/launch-slice.mjs` | Works — it spawns `npx vite preview` | Should work; **not tested** |
| `scripts/gpu-profile.mjs` | Works — it needs a real GPU and a headed browser | Should work; **not tested** |
| The shell commands in the documentation | macOS / bash | Adjust the paths |

## 5. The V2 lineage

V4 does not change V2. The V2 city builder (`game/`) and its release
package are untouched by this work, and `main` remains at `92c0b37`.

The two projects share the **cleared 3D model pack** and the **licence
files** — which is where V4's assets come from.

One carried-forward V2 observation, now diagnosed: the V2 build requests
`assets/ui-assets.json` at runtime, and that file is deliberately **not**
shipped, because the 2D art it points at is licence-unverified. That is the
source of the HTTP 404s in the V2 browser console. It is a consequence of
the quarantine, not a broken path, and the V2 handover already records the
same three URLs as intentionally absent from the live site. **The V4 app has
zero console errors.**

## 6. What a future platform pass would need to do

| Target | The work |
|---|---|
| Apple Silicon | Run on arm64 hardware; `npm ci && npm run build`; the GPU profile; the acceptance harness. Nothing else — the code has no architecture-specific parts. |
| Windows | Run the same commands; expect the shell snippets in this documentation to need adjusting. |
| Linux | The same. |
| Firefox / Safari | Run the acceptance harness (`npm run slice`) and the GPU profile against each. The harness is browser-agnostic — it drives Chromium through Playwright, so a Firefox run needs the Playwright Firefox build. |

## 7. Summary

| Claim | Supported? |
|---|---|
| "V4 runs on macOS on Intel" | **Yes** — measured |
| "V4 runs in Chromium" | **Yes** — measured |
| "V4 runs on Apple Silicon" | **No claim** — untested, no hardware |
| "V4 runs on Windows or Linux" | **No claim** — untested, no machine |
| "V4 runs in Firefox or Safari" | **No claim** — untested, not installed |
| "V4 is portable to another Mac" | **Yes** — documented and reproducible |
| "V4 introduces no paid dependencies" | **Yes** — two, both existing in the project family |
| "V4 has no known security advisories" | **Yes** — `npm audit`: 0 vulnerabilities (after the vite 7 upgrade that closed the esbuild advisory) |
