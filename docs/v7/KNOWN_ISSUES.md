# SuperCitycon V7 — Known Issues

**Applies to:** SuperCitycon 7.0.0
**Supersedes:** [`V6_KNOWN_ISSUES.md`](../V6_KNOWN_ISSUES.md) and [`V5_KNOWN_ISSUES.md`](../V5_KNOWN_ISSUES.md), which are kept as historical records
**Save schema:** version 2 — unchanged

---

## The issues that V7 CLOSED

| Was | Now |
|---|---|
| **V5 KI-05** — "the Gamepad API is read and the bindings are routed through the same input-map table" — **which was false**: V6 had no gamepad code at all | Closed in V6. The gamepad is implemented, tested and documented. |
| **BUG-01** — the citizens walked in a straight line through buildings and water | **Closed in V7.** They walk a real route. |
| **BUG-02** — a held key kept panning the camera under the menu | **Closed in V7.** |
| **GAP-01** — no touch input at all | **Closed in V7.** |
| **GAP-02** — the content validator could not prove reachability | **Closed in V7.** It proves it. |
| **D-09** — no secret scan in the toolchain | **Closed in V7.** `tools/secret-scan.mjs`. |

---

## The issues that are still open

### V7-KI-01 — Apple Silicon / ARM64 never validated

| | |
|---|---|
| **Severity** | LIMITATION |
| **Blocks release?** | No |
| **Was** | V6-KI-01 / KI-01 |

The build machine is `Darwin x86_64`. Every number in the V7 evidence was
measured on an Intel Mac. **No ARM measurement was taken**, so the V7
figures must not be read as ARM figures.

### V7-KI-02 — No Windows, Linux or non-Chromium browser testing

| | |
|---|---|
| **Severity** | LIMITATION |
| **Blocks release?** | No |
| **Was** | V6-KI-02 / KI-02 |

All browser evidence was produced in headless Chromium. No other engine and
no other operating system was exercised.

### V7-KI-03 — No native executable

| | |
|---|---|
| **Severity** | LIMITATION |
| **Blocks release?** | No |
| **Was** | V6-KI-03 / KI-03 |

The product is a web build. No installer, no native executable and no
application bundle exist. The cleared bundle in `game/dist` is the only
artefact.

### V7-KI-04 — The touch path was verified with simulated devices, not hardware

| | |
|---|---|
| **Severity** | LIMITATION |
| **Blocks release?** | No |
| **Evidence** | `tools/scenario-devices.mjs` — **32/32**; `tools/compat-audit.mjs` — **43/43** |

**No physical touch device was attached to the build machine.** What the
V7.2 round did instead was test the paths under the conditions a device
creates and a synthetic test does not: a phone profile with touch
emulation, a pen, a browser-delivered `pointercancel`, a lost window
focus, and a resize. That found and fixed **six real defects** — the game
did not boot with cookies blocked, the canvas did not follow a resize, the
HUD's demand rail was unreachable on a phone, the search box had no style at
all, the recogniser kept its finger after a blur, and a cancelled pinch
swallowed the next tap.

What is still unverified is the **feel**:

- whether the pan rate is right for a thumb;
- whether the pinch is sensitive enough for two thumbs;
- whether the 44 px touch targets are usable in a hand;
- whether the safe-area insets are honoured on the device they were written
  for;
- real pen pressure, tilt and palm rejection;
- touch latency under load;
- notches and foldables.

Treat the touch support as **functionally verified, ergonomically
unverified**. The pan rate in particular (`RIG_RATES.dragPan`, the same
scale the mouse uses) is a reasonable default and not a measured one.

### V7-KI-05 — The gamepad path was verified against a SIMULATED pad

| | |
|---|---|
| **Severity** | LIMITATION |
| **Blocks release?** | No |
| **Was** | V6-KI-10 |

Unchanged from V6, except that the V7.2 round closed two more gaps in it: a
pad unplugged **mid-press** now releases the button instead of leaving a
phantom press for the menu, and the camera stops when the window loses the
focus. The pad's **mapping** is now carried into the snapshot, so a
non-standard pad can at least be TOLD apart from a standard one.

No physical controller was available. The logic is verified; the feel on
real hardware is not.

### V7-KI-06 — The 2D HUD art cannot ship

| | |
|---|---|
| **Severity** | LIMITATION (licensing) |
| **Blocks release?** | No — the cleared build is complete without it |
| **Was** | V6-KI-06 / KI-06 |

Unchanged. 69 distinct 2D images carry `licence: "unverified"`; they are
quarantined and **none of them ships**. The cleared build strips them and
**fails the build** if any survives.

### V7-KI-07 — No music, ambience or voice content

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |
| **Was** | V6-KI-07 / KI-07 |

Unchanged. Every sound is synthesised at runtime; no audio file ships.

### V7-KI-08 — The save file's size: MEASURED, and the premise was wrong

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |
| **Was** | V6-KI-08 / KI-08 — carried on an ASSUMPTION |
| **Evidence** | `tools/save-size-report.mjs` and [`SAVE_SIZE.md`](SAVE_SIZE.md) |

V5 and V6 recorded this issue as "the save file is dominated by
JSON-encoded terrain arrays". **That was never measured, and it is not
true.** The V7.2 round measured it:

| | |
|---|---|
| A typical city (533 buildings, 884 roads, 15,968 residents) | **778,418 bytes** |
| The largest city the game can hold (1,988 buildings, 56,844 residents) | **1,405,068 bytes** |
| The terrain arrays' share of that | **2.25%** |
| The JSON scaffolding's share | **69.5%** |
| The **avoidable** part of a re-encoded terrain | **0.30%** — and lossless base64 would be *bigger*, because the terrain holds 14 distinct short decimals, not arbitrary floats |
| The genuinely avoidable block (the static catalogue, republished in every save) | **41.9%** of the worst save — droppable with **no migration at all** |
| The save / load time for the worst city | 39–50 ms to write, 87 ms to read |

**The decision stands and is now evidence-based:** the schema stays at
version 2, because a migration for 0.30% is not worth asking every player
to accept. But the real win — trimming the static catalogue and the derived
caches — is 41.9% and needs no migration. That belongs in V8.

### V7-KI-09 — Gamepad buttons cannot be REBOUND in the UI

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |
| **Was** | V6-KI-11 |
| **Status** | **CLOSED in the V7.1 round** |

**CLOSED.** The Controls view now has a **Gamepad bindings** section: a pad
button can be bound to an action, the binding is stored in the new
`input.padBindings` setting, it is applied to the live pad table, it shows a
readable button name ("A", "D-pad up", "right bumper"), it can be cancelled,
and "RESET ALL BINDINGS" resets the pad table too.

Two details make it safe rather than merely present:

- **The capture never steals a menu button.** The buttons bound to
  `menu.up` / `menu.down` / `menu.left` / `menu.right` / `menu.confirm` /
  `menu.back` in the live table are RESERVED: the capture keeps waiting and
  says so. A player cannot bind away their own menu.
- **Only button EDGES count.** The capture takes a baseline when it starts,
  so a button the player is already holding is not treated as a press.

A real defect fell out of the work: the key capture used to bind **Escape**
even though the toast promised "Esc cancels". That is fixed too.

### V7-KI-10 — LLM-driven NPC dialogue is not implemented

| | |
|---|---|
| **Severity** | MINOR |
| **Blocks release?** | No |
| **Was** | V6-KI-09 / KI-09 |

Unchanged.

### V7-KI-11 — The Cursor senior review was not re-run for V7

| | |
|---|---|
| **Severity** | MAJOR (for the "complete and verified" classification) |
| **Blocks release?** | **Yes — for "complete and verified"** |
| **Was** | V6-KI-12 / KI-04 |

The review policy for V7 is explicit: **Cursor is optional and must not
block the primary development.** It was not run for the V7 diff, and no
attempt was made to wait for a quota.

The V7 review was performed with the native tools instead:

| Review pass | How |
|---|---|
| the requirements | every V7 requirement has an implementation and a test — `FEATURE_MATRIX.md` |
| the architecture | `ARCHITECTURE.md` §2 is an analysis of the actual source, and §3 matches the code that was written |
| the defects | each defect has a test that was run against the baseline first — two of them fail on V6 |
| the code | the unit suite (835), the syntax check, the three browser scenarios, the benchmark and the secret scan |
| the release | `FINAL_VERIFICATION.md` §10 |

See `FINAL_VERIFICATION.md` for the exact status.

---

## The summary table

| id | Issue | Severity | Blocks release? |
|---|---|---|---|
| V7-KI-01 | Apple Silicon never validated | LIMITATION | No |
| V7-KI-02 | Non-Chromium / Windows / Linux untested | LIMITATION | No |
| V7-KI-03 | No native executable | LIMITATION | No |
| V7-KI-04 | Touch verified with synthetic events, no device | LIMITATION | No |
| V7-KI-05 | Gamepad verified against a simulated pad | LIMITATION | No |
| V7-KI-06 | 2D HUD art cannot ship | LIMITATION | No |
| V7-KI-07 | No music / ambience / voice content | MINOR | No |
| V7-KI-08 | Save size dominated by JSON terrain arrays | MINOR | No |
| V7-KI-09 | Gamepad buttons cannot be rebound in the UI | — | **CLOSED in V7.1** |
| V7-KI-10 | No LLM-driven dialogue | MINOR | No |
| V7-KI-11 | The Cursor senior review was not re-run | MAJOR | **Yes — for "complete and verified"** |
