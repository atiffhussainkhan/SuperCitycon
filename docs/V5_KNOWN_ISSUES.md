# SuperCitycon — V5 Known Issues

**Document status:** complete (Phase 7 deliverable)
**Applies to:** SuperCitycon 5.0.0
**Branch:** `v5/upgrade`

---

## 1. How to read this

Every issue that is still open after the V5 upgrade is listed here, with what
it is, how bad it is, whether it blocks the release, and what would close it.

**Nothing here is a surprise that was not already documented.** The risk
register (`docs/V5_RISK_REGISTER.md`) carries the same items with their
likelihood, impact and mitigation; this document is the player- and
publisher-facing view of the same facts.

**Severity:**

| | Meaning |
|---|---|
| **BLOCKER** | The release cannot be called complete while this is open. |
| **MAJOR** | A real gap in the feature set. Named, not hidden. |
| **MINOR** | A rough edge that does not impair play. |
| **LIMITATION** | Something this environment could not test. Not a defect. |

---

## 2. Open issues

### KI-01 — Apple Silicon / ARM64 never validated

| | |
|---|---|
| **Severity** | LIMITATION |
| **Blocks release?** | **No** — the release classification names it. |
| **Risk** | R-02 |

The development machine is `x86_64` (Intel Core i9-9980HK). No ARM build was
produced, no ARM benchmark was run, and no native executable exists at all.

The web build is architecture-independent — the same JavaScript runs on an
M-series Mac — but that is an **inference, not a test**, and it is not
presented as one.

**To close:** run the build and `tools/scenario.mjs` on an ARM64 machine or an
ARM CI runner, and record the result.

---

### KI-02 — No Windows, Linux or non-Chromium browser testing

| | |
|---|---|
| **Severity** | LIMITATION |
| **Blocks release?** | No |
| **Risk** | R-11 |

The game has been tested in Chromium only, on macOS. No Windows or Linux
machine and no Firefox or Safari build is available in this environment.

The build uses only `localStorage`, `requestAnimationFrame` and a WebGL2
context — all long-standing, widely supported APIs. Again: reasoning, not a
test.

**To close:** run `tools/scenario.mjs` against the built app in Firefox and
Safari, and add a CI matrix.

---

### KI-03 — No native executable

| | |
|---|---|
| **Severity** | LIMITATION |
| **Blocks release?** | No — it is out of scope for a web project |
| **Risk** | R-12 |

The target platform is **web (Chromium-verified)**. No installer, `.app`,
`.exe` or binary was produced, and none is claimed. The release notes state
the platform and the exact launch command.

---

### KI-04 — Cursor senior review could not be run

| | |
|---|---|
| **Severity** | MAJOR (process, not code) |
| **Blocks release?** | **Yes, for the "complete and verified" classification** |
| **Risk** | R-03 |

The working standard requires a Cursor senior review of every deliverable.
`cursor agent` was invoked **four** times on three different models, and every
attempt returned:

```
You're out of usage. Switch to Auto, or ask your admin to increase your limit to continue.
```

The review is therefore **Awaiting Cursor review**. This is stated plainly
rather than glossed over: the V5 work has been self-reviewed and verified by
the project's own tests, harness, browser runs and profiler, but it has **not**
been through the independent senior review the standard requires.

`CURSOR-HANDOFF.md` at the repository root carries the full brief so the
review can be run the moment quota returns.

---

### KI-05 — Gamepad navigation is partial

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |
| **Risk** | R-10 |

The Gamepad API is read and the bindings are routed through the same
`input-map` table as the keyboard, so a pad button can be bound to any
action. What is **not** implemented:

- analogue-stick camera control (orbit / pan / zoom),
- pad navigation of the menus with a visible focus ring,
- the "reduced screen shake" preference applied to controller feedback.

Keyboard navigation — the primary input path — is complete and tested.

---

### KI-06 — The 2D HUD art cannot ship

| | |
|---|---|
| **Severity** | LIMITATION (licensing) |
| **Blocks release?** | No — the cleared build is complete without it |
| **Risk** | R-01, R-13 |

69 distinct 2D images in the asset library carry `licence: "unverified"`. Their
redistribution rights could not be confirmed against an authoritative source,
so they are **quarantined**.

The cleared build (`npm run build:cleared`) strips all of them and **fails**
the build if any survives. Verified on the live site: 0 of 69 uncleared files
served; `DO-NOT-PUBLISH.txt`, `assets/ui-assets.json` and `assets/ui/` all
return 404.

The HUD is complete and correct with **zero** 2D images — icons are optional
by construction when the manifest is absent. The acceptance harness's 2D-art
check is **skipped** in the cleared profile, so a green run never hides the
quarantine.

**This is a publisher decision, not an engineering task.** Clearing the art
needs per-image authoritative sources.

---

### KI-07 — No music, ambience or voice content

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |
| **Risk** | R-16 |

The project has **no audio asset files**. Every sound the game makes is
synthesised at runtime by the procedural mixer in `src/audio/audio.js`, which
has six category buses (master, music, sfx, ambience, ui, voice) and ten
recipes.

The mixer is now genuinely connected to the event bus — in V4 it was built and
never called — so placements, demolitions, level-ups, day changes,
checkpoints, achievements and hazards are all audible.

But there is **no music bed, no looping ambience and no voice content**,
because no such assets exist. The `music`, `ambience` and `voice` buses are
wired and have working volume controls; they simply have nothing to play
yet. Nothing is described as a "placeholder" that is really final.

---

### KI-08 — Save files are dominated by JSON-encoded terrain arrays

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |
| **Risk** | R-09 |

A save is **~46.6 KB empty** and **~99.1 KB populated**. The dominant cost is
the heightmap, water map and type map serialised as JSON arrays — 4096
numbers each, written as decimal text.

The quota is 5 MB, so a populated save uses under 2 % of it. Base64 encoding
of the typed arrays would roughly halve the size, at the cost of a change to
the save codec and a migration risk on a format that is not under pressure.

**Deliberately deferred** and recorded here rather than silently skipped.

---

### KI-09 — LLM-driven NPC dialogue is not implemented

| | |
|---|---|
| **Severity** | MINOR (out of scope) |
| **Blocks release?** | No |
| **Risk** | R-17 |

The directive permits optional LLM-driven NPC dialogue only with an
**authorised provider** and documented safeguards. No provider is configured
in this environment, no key exists, and the directive forbids hardcoding
credentials.

It is therefore not implemented, and nothing scripted is presented as
generative AI.

---

### KI-10 — The platformer capability list is not delivered

| | |
|---|---|
| **Severity** | MAJOR (scope, stated) |
| **Blocks release?** | No — it is a deliberate genre mapping |
| **Risk** | — |

The V5 directive's capability list — walking, running, sprinting, jumping,
coyote time, crouching, swimming, climbing, carrying, throwing, knockback,
i-frames, melee and ranged combat, projectiles, hitstun, health and lives,
power-ups, character animation state machines, NPC pathfinding and behaviour
trees — is written for a **2D action platformer**.

SuperCitycon is a **3D city builder**. Implementing those would mean replacing
the completed V4 game, which the directive's own RULE 3 ("preserve completed
V4 functionality") and RULE 17 ("do not replace working functionality merely
to reduce task complexity") forbid.

The directive's capability areas are mapped onto the city-builder idiom
instead, and the mapping is stated in full in
[`docs/V5_UPGRADE_PLAN.md`](docs/V5_UPGRADE_PLAN.md) §1 and row-by-row in
[`docs/V5_REQUIREMENTS_MATRIX.md`](docs/V5_REQUIREMENTS_MATRIX.md) §11.

The headline mapping: **"enemy intelligence" and "boss encounters" become the
multi-phase city hazard system** — a flood, a wildfire or a grid outage that
escalates through telegraphed phases and must be resolved by the city's own
infrastructure.

---

### KI-11 — Hazard reachability is not proven by the content validator

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |

The content validator proves a level is **internally consistent**: every exit
has requirements, every requirement points at a real objective, every
checkpoint is reachable through the progression graph, every spawn is inside
the playfield and free of overlaps, and every referenced model and building
exists.

It **cannot** prove that the generated terrain allows a physical route from
the spawn area to the exit, or that the objectives are achievable in the time
given. The validator says so explicitly, on every level, as an `info` issue
rather than a silent pass.

**To close:** a reachability solver over the generated heightmap and water
map, run as part of the validator.

---

### KI-12 — The `the-long-night` level's difficulty is a design placeholder

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |

The phase durations, damage rates and telegraph windows in the shipped levels
are **unpublished design placeholders** — the publisher published none. They
are marked `TBD:` in the source and collected in the TUNING reporting the
project's own rule 3.

The levels are genuinely loadable, genuinely playable and internally
consistent. They are **not** claimed to be balanced. Every one of the three
can be re-tuned without a code change.

---

### KI-13 — The 20-character roster costs memory and download size

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |

The V5 population work expanded the cast from 6 characters to 20. That adds
roughly **16.5 MB** of character models to the download and is the dominant
contributor to the measured memory increase against V4:

| | V4 | V5 | Delta |
|---|---:|---:|---:|
| JS heap at boot | 109.51 MB | 133.07 MB | +23.6 MB |
| JS heap in a populated city | 86.55 MB | 141.19 MB | +54.6 MB |
| cleared bundle size | 72.6 MB | 72.7 MB | +0.1 MB |

The bundle barely moves (the character models were already in the V4 asset
set); the **heap** does, because more characters are resident at once.

**This is the accepted cost of the frame-time improvement.** The same
population work took the populated city's mean frame time from 23.445 ms to
**18.167 ms** and its worst frame from 83.3 ms to **35.1 ms**. The trade is
recorded as **R-21**, with the mitigation (on-demand per-district character
loading) named but not implemented.

**To close:** make the roster's characters load on demand per district.

---

## 3. Fixed during the release pass

These were **defects**, found by measurement during the release pass and
fixed before the release. They are listed so the record shows what was
actually wrong, not only what is left.

| Defect | How it was found | How it was fixed | Evidence |
|---|---|---|---|
| **The hazard's effect was drawn underground.** `cellToWorld(x, z, 0)` put the wildfire's fire at world y = 0; its cell is on a plateau 9 units up, so the fire was inside the hill and no pixel of it reached the screen | Reading the live particle transforms out of the instance matrices in a real browser | The hazard domain and the integrator's effect bridge now ask the WORLD domain for the ground height (`wld.heightAt`) | Particles moved from y 0.82–1.27 to y 10.02–13.13; the ember, flame and smoke pixels are captured on the plateau. 7 regression tests, **mutation-verified** (R-19) |
| **The renderer counter under-reported every frame.** Three.js resets `renderer.info` after the shadow pass, so the number the adaptive driver and the HUD read described the main scene pass only — and with post-processing on, the retro pass alone | The acceptance harness failing its "scene renders geometry" check: `1 draw calls, 1 triangles` for 573 meshes | `renderer.info.autoReset = false`, `reset()` at the top of `update()`, and the monitor and the adaptive driver moved after the draw | The boot scene now reports 63 draw calls — 34 main + 29 shadow (R-20) |
| **The performance profiler could report a negative frame time.** The sampler seeded from `performance.now()` and differenced it against the next rAF timestamp, which can be earlier | The real-GPU profile reporting `minMs: -63.8` and a `p99Ms` of 66.6 | Seed from the first rAF timestamp; the report now publishes `negativeSamples` | `negativeSamples: 0` in every run, and the p99 is 18.7 ms |
| **Two sources drew the hazard effect.** The hazard domain pulsed it *and* the integrator's bridge answered the same events, so every phase drew it twice — and the bridge's copy was the underground one | Instrumenting `fx.spawn` and `wld.heightAt` in the live page | The hazard domain is now the sole owner of the hazard's visuals; the bridge's hazard handlers were removed | `tests/integration.test.mjs`: "the bridge does NOT also draw the hazards — the hazard domain owns those" |

---

## 4. Summary

| ID | Issue | Severity | Blocks release? |
|---|---|---|---|
| KI-01 | Apple Silicon never validated | LIMITATION | No |
| KI-02 | Non-Chromium / Windows / Linux untested | LIMITATION | No |
| KI-03 | No native executable | LIMITATION | No |
| KI-04 | Cursor senior review could not be run | MAJOR | **Yes — for "complete and verified"** |
| KI-05 | Gamepad navigation partial | MINOR | No |
| KI-06 | 2D HUD art cannot ship | LIMITATION | No |
| KI-07 | No music / ambience / voice content | MINOR | No |
| KI-08 | Save size dominated by JSON terrain arrays | MINOR | No |
| KI-09 | No LLM-driven dialogue | MINOR | No |
| KI-10 | Platformer capability list not delivered | MAJOR (scope) | No |
| KI-11 | Hazard reachability not proven | MINOR | No |
| KI-12 | Level difficulty is a design placeholder | MINOR | No |
| KI-13 | The 20-character roster costs memory | MINOR | No |

**No BLOCKER issue is open.** KI-04 is the single item that prevents the
strictest release classification, and it is blocked by the **environment**
(Cursor quota), not by the code.
