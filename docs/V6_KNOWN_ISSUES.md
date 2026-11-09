# SuperCitycon V6 — Known Issues

**Applies to:** SuperCitycon 6.0.0
**Supersedes:** [`V5_KNOWN_ISSUES.md`](V5_KNOWN_ISSUES.md) (kept as historical evidence)
**Save schema:** version 2 — unchanged from V5
**Status:** see [`V6_VERIFICATION.md`](V6_VERIFICATION.md)

---

## The correction to V5's KI-05

V5's known-issues record said:

> "The Gamepad API is read and the bindings are routed through the same
> `input-map` table as the keyboard, so a pad button can be bound to any
> action."

**That was not true.** At the V6 baseline (`69b6579`) the merged V5 tree
contained **no gamepad code at all**:

```
$ grep -rn "getGamepads|gamepad|Gamepad" --exclude-dir=node_modules .
(no matches outside this document)
```

There was no `navigator.getGamepads()` call, no gamepad binding table, no
analogue handling and no pad navigation. KI-05 described work that had never
been done, and the "not implemented" list under it understated the gap by a
long way.

V6 therefore implemented KI-05 **from scratch** rather than completing a
partial implementation. The V5 document is left unedited — it is a historical
record of what V5 claimed — and this section is the correction.

---

## Carried forward from V5

These are unchanged by V6. They are limits of the environment or of the
published design, not defects V6 introduced.

### V6-KI-01 — Apple Silicon / ARM64 never validated

| | |
|---|---|
| **Severity** | LIMITATION |
| **Blocks release?** | No |
| **V5 reference** | KI-01 |

The build machine is `Darwin x86_64`. Every number in the V6 evidence was
measured on an Intel Mac. No ARM measurement was taken, so the V6 figures
must not be read as ARM figures.

### V6-KI-02 — No Windows, Linux or non-Chromium browser testing

| | |
|---|---|
| **Severity** | LIMITATION |
| **Blocks release?** | No |
| **V5 reference** | KI-02 |

All browser evidence was produced in headless Chromium. No other engine and
no other operating system was exercised.

### V6-KI-03 — No native executable

| | |
|---|---|
| **Severity** | LIMITATION |
| **Blocks release?** | No |
| **V5 reference** | KI-03 |

The product is a web build. No installer, no native executable and no
application bundle exist. The cleared bundle in `dist/` is the only artifact.

### V6-KI-06 — The 2D HUD art cannot ship

| | |
|---|---|
| **Severity** | LIMITATION (licensing) |
| **Blocks release?** | No — the cleared build is complete without it |
| **V5 reference** | KI-06 |

Unchanged. The cleared build (`npm run build:cleared`) strips the
licence-unverified 2D art and fails the build if any survives.

### V6-KI-07 — No music, ambience or voice content

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |
| **V5 reference** | KI-07 |

Unchanged. Every sound is synthesised at runtime; no audio file ships.

### V6-KI-08 — Save files are dominated by JSON-encoded terrain arrays

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |
| **V5 reference** | KI-08 |

Unchanged. The save format is untouched by V6 (see below), so the V5 size
profile still applies.

### V6-KI-09 — LLM-driven NPC dialogue is not implemented

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |
| **V5 reference** | KI-09 |

Unchanged.

---

## New in V6

### V6-KI-10 — The gamepad path was verified against a SIMULATED pad

| | |
|---|---|
| **Severity** | LIMITATION |
| **Blocks release?** | No |
| **Evidence** | `game/src/core/gamepad.test.mjs` (27 tests), `game/src/ui/gamepad.test.mjs` (17 tests), `game/src/ui/ui.test.mjs` (camera analogue), `game/src/ui/menu.test.mjs` (pad navigation) |

**No physical controller was available in the build environment.** The gamepad
path is driven with a fake `navigator.getGamepads()` that returns a pad shaped
like the browser's.

What that proves:

- the dead zone, the button edge, the axis maths, the connect / disconnect
  transitions and the routing all behave as specified;
- the menu navigation, the visible focus ring, the confirm / back actions and
  the "no double confirm on a held button" rule hold;
- the camera does not move while a modal has the focus.

What that does **not** prove: how the game feels on real hardware. Button
labels, trigger travel, stick drift and the feel of the focus ring were never
put in front of a human with a controller in their hands. Treat the gamepad
support as **logically verified but physically unverified**.

### V6-KI-11 — Gamepad buttons cannot be REBOUND in the UI

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |
| **Evidence** | `game/src/core/input-map.js` — `applyPadOverrides`, `padFor`, `padAll` |

The keyboard bindings have a rebind screen. The pad bindings do not: the
defaults in `DEFAULT_PAD_BINDINGS` are fixed.

The machinery is in place — `createInputMap({ padBindings })`,
`applyPadOverrides()` and `resetAll()` all work on the pad table, and the
gamepad service reads the bindings from the input map on every frame, so a
stored override would take effect immediately. What is missing is the UI: a
button that captures a pad press and writes the override into the settings.

This is a deliberate scope decision, not an oversight: the V6 brief listed
the pad behaviours to complete and rebinding was not among them.

### V6-KI-12 — The Cursor senior review gate

| | |
|---|---|
| **Severity** | MAJOR (for "implemented and verified") |
| **Blocks release?** | **Yes — for the "complete and verified" classification** |
| **V5 reference** | KI-04 |

See [`V6_VERIFICATION.md`](V6_VERIFICATION.md) for the exact status of the
review in this build. The classification of the release depends on it.

---

## What V6 deliberately did NOT change

| | |
|---|---|
| **The save schema** | It stays at **version 2**. A V5 city opens in V6 exactly as it was. The product version (6.0.0) and the save format version (2) are separate numbers, and they are separate on purpose. See `game/src/core/save-compat.test.mjs`. |
| **The V5 acceptance scenario** | `tools/scenario.mjs` and its assertions are untouched. The V6 flows live in a new file. |
| **The shop layout** | Verified by the existing `tools/verify-shop-layout.mjs`. |
| **The performance tools** | `tools/performance.mjs` and `tools/performance-gpu.mjs` are untouched. |
| **The cleared build target** | `npm run build:cleared` remains the shippable target. |

---

## Summary table

| id | Issue | Severity | Blocks release? |
|---|---|---|---|
| V6-KI-01 | Apple Silicon never validated | LIMITATION | No |
| V6-KI-02 | Non-Chromium / Windows / Linux untested | LIMITATION | No |
| V6-KI-03 | No native executable | LIMITATION | No |
| V6-KI-04 | Cursor senior review status | MAJOR | **Yes — for "complete and verified"** |
| V6-KI-05 | *(V5 KI-05 was wrong — see the correction above)* | — | Resolved by V6 |
| V6-KI-06 | 2D HUD art cannot ship | LIMITATION | No |
| V6-KI-07 | No music / ambience / voice content | MINOR | No |
| V6-KI-08 | Save size dominated by JSON terrain arrays | MINOR | No |
| V6-KI-09 | No LLM-driven dialogue | MINOR | No |
| V6-KI-10 | Gamepad verified against a simulated pad only | LIMITATION | No |
| V6-KI-11 | Gamepad buttons cannot be rebound in the UI | MINOR | No |
