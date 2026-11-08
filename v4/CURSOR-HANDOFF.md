# Cursor review handoff — MiniMax Game Studio Ultra V4

**Status: _Awaiting Cursor review_.**

The always-on working standard requires a Cursor senior review of every
deliverable. A Cursor review **did** run over part of V4, but the account
quota was exhausted before the *final integrated state* could be reviewed. This
file holds everything needed to re-run that review the moment the quota is
restored.

---

## 1. Why this file exists

| Fact | How it was verified |
|---|---|
| `cursor agent status` returns `ActionRequiredError: You're out of usage` | Run on 2026-11-08 from the V4 worktree |
| `cursor agent models` returns the same error | Same session |
| `cursor agent --print --mode ask` returns the same error | Tried on two different models |
| A review *did* run earlier, over the NPC / gameplay / level modules | It returned 13 defects; all 13 were fixed and given regression tests |

The binary is `/Applications/Cursor.app/Contents/Resources/app/bin/cursor`.
`cursor --help` lists `agent` only at the very bottom, under **Subcommands** —
read the whole output before concluding the agent is missing.

**Do not work around the quota.** Do not pull a token out of the keychain.
`cursor agent login` is the supported route and it needs the account owner.

---

## 2. What is being handed over

| Item | Value |
|---|---|
| Repository | `minimax-game-studio` (this worktree) |
| Branch | `v4/studio` |
| Base commit | `92c0b37` (the `main` HEAD — `main` was **not** modified) |
| V4 commit under review | see `git log --oneline v4/studio` — the branch tip |
| Application root | `v4/` |
| Documents | `v4/docs/V4_*.md` — nine documents |
| Evidence | `v4/verification/slice/` (28 acceptance checks + 5 screenshots), `v4/verification/gpu/` (real-GPU measurement) |

The work was done in an isolated worktree so that the V2 city-builder in
`game/` and the design package in `minimax-game/` were never touched.

---

## 3. The exact prompt to re-run

```sh
cd /Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/v4-worktree

/Applications/Cursor.app/Contents/Resources/app/bin/cursor agent --print --trust \
  --model gpt-5.6-sol-xhigh --mode ask "$(cat v4/CURSOR-HANDOFF-PROMPT.txt)"
```

`v4/CURSOR-HANDOFF-PROMPT.txt` holds the review brief itself, so the prompt
survives quoting and shell-escaping. Use `--mode ask` for a read-only review;
`--mode plan` also works.

---

## 4. The review brief (what is in `CURSOR-HANDOFF-PROMPT.txt`)

In summary, the reviewer is asked to act as a senior developer and analyst and
to review the V4 application for:

1. **Correctness** — logic errors, state-machine mistakes, race conditions
   between the ECS, the physics world, the scene manager and the Three.js
   scene.
2. **The save/load contract** — the save format must hold *data* only; runtime
   handles must never reach it; a load must restore both the data and the
   behaviour.
3. **The input model** — one key press must trigger exactly one action;
   edge-triggered input must not be read twice by the fixed-step catch-up.
4. **Performance** — anything that would allocate per frame, leak a GPU
   resource, or grow without bound.
5. **Error handling** — a failing subsystem must never take the frame loop
   down.
6. **Presentation** — whether the editor and the HUD are usable and honest.
7. **Honesty of the claims** — whether every number in `v4/docs/` is backed by
   a measurement that is reproducible with the commands the documents give.

---

## 5. What has already been verified (so the reviewer need not repeat it)

| Gate | Command | Result |
|---|---|---|
| Unit + integration suite | `node --test "tests/*.test.mjs"` | **149 tests, 149 pass, 0 fail** |
| Syntax | `node tools/check-syntax.mjs` | **56/56 files parse cleanly** |
| Dependency security | `npm audit` | **0 vulnerabilities** |
| Asset audit | `node tools/audit-assets.mjs` | 92 entries, 0 broken, 0 duplicates, 69 quarantined by design |
| Asset pipeline | `node scripts/prepare-assets.mjs --check` | source 203, target 203, refused 0, sha256-verified |
| Production build | `npx vite build` | 8 chunks; index 187.19 kB gzip, editor 22.10 kB gzip |
| Browser acceptance | `node scripts/launch-slice.mjs` | **28/28 checks pass**, 0 console errors, 0 uncaught page errors |
| Real-GPU measurement | `node scripts/gpu-profile.mjs <url>` | ANGLE Metal / Intel UHD 630, `isSoftware: false`, 100.8 fps, mean 9.92 ms, median 6.3 ms, p95 15.7 ms, 1016 frames, 0 console errors |

### Defects already found and fixed (19 in total)

- 13 integration defects found by the browser harness.
- 16 findings from an independent verifier agent (5 major, 11 minor) — all
  major and 10 of the minor ones fixed, the remainder documented in
  `v4/docs/V4_FEATURE_MATRIX.md`.
- 3 defects found in the final integration pass: one key press triggering up
  to five actions, the Escape key doing nothing, and a scene load leaving the
  interactive entities inert.

Each is guarded by a test in `v4/tests/v4-integration.test.mjs` and, where it
is user-visible, by an acceptance check.

---

## 6. Known limitations — not defects for the reviewer to re-litigate

These are documented, deliberate and external. They are listed so the reviewer
does not mistake them for oversights.

| # | Limitation | Why |
|---|---|---|
| 1 | **Apple Silicon is untested.** | The machine is x86_64 (Intel i9-9980HK). No ARM build and no ARM performance figure is claimed. The gate stays open by instruction. |
| 2 | **69 2D images are quarantined.** | Every one reads `licence: "unverified"` in the library index. They are excluded from the build by design and the exporter refuses them. Clearing them is the publisher's decision. |
| 3 | **No audio assets ship.** | The cleared catalogue has none. The audio system is wired and inspectable, but the build is silent. |
| 4 | **Nine gameplay modules are starter modules.** | Combat, inventory, dialogue, checkpoints, menus, pause and settings are modular and separately testable, but the demo level does not exercise all of them. They are not AAA systems and are not claimed to be. |
| 5 | **Windows, Linux and non-Chromium browsers are untested.** | No machines or browsers are available in this environment. |
| 6 | **There is no native build.** | V4 is a web application. |
| 7 | **The LLM adapter is disabled by default.** | It reads its key from the environment, redacts it and always falls back to the deterministic path. No provider was authorised. |

---

## 7. If the quota is still exhausted

The work stands on its own measurements and an independent verifier review.
Do **not** simulate a Cursor review and do not present a self-review as one.
Record the outcome as _Awaiting Cursor review_ and re-run this file's prompt
when the quota is restored.
