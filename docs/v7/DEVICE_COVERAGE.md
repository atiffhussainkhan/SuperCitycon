# V7 device coverage

**What this is.** `docs/v7/KNOWN_ISSUES.md` records two limitations that
cannot be closed without hardware:

- **V7-KI-04** — the touch path was verified with synthetic touch events;
- **V7-KI-05** — the gamepad path was verified against a *simulated* pad.

There is no finger and no controller attached to the build machine, so this
document does **not** close those two records. What it does is close the
part of the gap that a device would otherwise have to find: the conditions a
real device creates and a synthetic test does not.

The evidence is `tools/scenario-devices.mjs`, run against a served build.

```bash
cd game && npm run build:cleared && npx vite preview --port 4212 --strictPort
node tools/scenario-devices.mjs http://localhost:4212/ <outDir> v7-devices
```

The run behind this document:

| | |
|---|---|
| Date | 2026-11-10 22:27:11 → 22:29:46 UTC |
| Build | `npm run build:cleared` (2D art stripped, bundle 72.7 MB) |
| Served | `vite preview --port 4212` (Chromium, headless, SwiftShader) |
| Result | **26 of 32 checks passed, 6 failed, 0 skipped** |
| Exit code | **1** — a failure is a failure, and the scenario exits non-zero while any check fails |
| Artefacts | `devices.json` (the full ledger and every measurement), `devices-phone.png`, `devices-pad.png` |

The six failures are **defects in the game**, not gaps in the harness. They
are listed in section 3 and they are **not fixed here** — `game/src` belongs
to the integrator.

---

## 1. The summary

### What a device profile proves that a synthetic test does not

A synthetic test hands the game the event it expected to see. A device
profile hands the game the *conditions* a device creates, and lets the game
fail on its own:

- **The layout a phone really produces.** At 390 × 844 with a 3× device pixel
  ratio, the HUD is 573 px wide inside a 390 px box. The document does not
  overflow — because the HUD clips its own overflow — so the earlier
  "the HUD does not overflow a 390 px viewport" check passes while two
  interactive read-outs sit 81 px and 183 px off the right edge of the
  screen, unreachable by any means. **Only a phone-sized viewport with a
  real hit-test finds this.**
- **The browser's own `pointercancel`.** Chromium fires it when the
  DevTools protocol is told to cancel a touch, and the game receives exactly
  the event a phone call would produce. The recogniser's `cancel()` path is
  then exercised for real — and the first tap after a cancelled *pinch* is
  swallowed.
- **A pen.** No synthetic mouse event can be a pen. `pointerType: 'pen'`
  reaches the touch service, and the game treats it as a touch.
- **A window that loses the focus.** Headless Chromium cannot produce one
  (see the note below), but the game's own blur handler can be driven, and
  the input paths that *have* a blur handler and the ones that *do not* are
  told apart.
- **A controller that reports a different mapping.** A pad that says
  `mapping: 'non-standard'` is not the same pad the V6 scenario plugged in,
  and the game turns out not to look.

### What still needs hardware

The **feel**. Every number in this document is a number the machine
produced. None of them is a thumb on glass or a thumb on a stick. The pan
rate under a thumb, the pinch sensitivity, whether 44 px is big enough in a
hand, the safe-area insets on a notched phone, the dead zone on a worn
stick and the ramp of a real trigger are all still **unmeasured**. Section 4
lists them precisely.

### The note on how the focus was lost

Headless Chromium delivers **no real focus change**: both
`Emulation.setFocusEmulationEnabled(false)` and bringing a second tab to the
front leave `document.hasFocus()` true and fire no `blur` event (measured).
The scenario therefore dispatches the window `blur` event directly — the
event a browser fires when the window loses the focus, and the event the
game itself listens for (`game/src/ui/camera.js:700`,
`window.addEventListener('blur', onBlur)`). The game's own handler runs.

This matters for reading the results: on a **real** device the browser also
fires `pointercancel` for an active touch when the window is hidden, which
would mask the touch-side drift (defect D4) before the player ever saw it.
The gamepad-side drift (D5) cannot be masked that way — a controller is not
cancelled by a focus change.

---

## 2. The coverage table

Every row is a check in `tools/scenario-devices.mjs`; every number is from
the run recorded above.

| # | Condition | What it proved | Measured result |
|---|---|---|---|
| 1 | **Mobile device profile** — `Emulation.setDeviceMetricsOverride` + `Emulation.setTouchEmulationEnabled` + a mobile UA + `hasTouch: true` | The profile is really in force before anything is measured | `maxTouchPoints=5`, `ontouchstart=true`, viewport 390 × 844, DPR 3, canvas 390 × 844 CSS (780 × 1688 buffer) |
| 2 | **Touch drag on the phone profile** | A one-finger drag pans the camera, through the DevTools touch protocol, at the phone size | The camera moved **22.000** world units; the browser delivered 10 `pointermove`s to `CANVAS` |
| 3 | **Two-finger pinch on the phone profile** | A pinch zooms the camera | The distance went **66.000 → 28.286** |
| 4 | **Tap on the phone profile** | A tap selects the cell under the finger | **1 click**, cell (38, 37) |
| 5 | **HUD at 390 × 844** — does the document overflow? | The document fits | The document is **390 px** wide, the viewport is 390 px — **PASS** |
| 6 | **HUD at 390 × 844** — is every control *reachable*? | The HUD's own content is clipped away, not scrolled | **FAIL** — 573 px of content in a 390 px box with `overflow-x: hidden`; 42 elements reach past the edge, **6 are unreachable** (worst: 183 px) |
| 7 | **HUD at 390 × 844** — the 44 × 44 targets | Every visible control is at least 44 × 44 CSS px | **61 controls, all ≥ 44 × 44** — **PASS** |
| 8 | **A pen** (`pointerType: 'pen'`) | The touch service treats a pen as a touch | The pen drag moved the camera **11.314** units; the browser reported `pointerType="pen"` |
| 9 | **A pen tap** | A pen selects, exactly as a finger does | **1 click**, cell (40, 39) |
| 10 | **A cancelled touch** — the browser's `pointercancel` | The cancel really reaches the game | **1 `pointercancel`**, `pointerType="touch"` |
| 11 | **A cancelled touch** — the hover | No highlight is left stuck on the last cell | The hover went **cell (41, 40) → null** — **PASS** |
| 12 | **A cancelled touch** — the click | A cancelled gesture never selects a cell | **0 clicks** reached the domains — **PASS** |
| 13 | **The next gesture after a cancel** | The game is still usable | The next tap selected cell (41, 41) — **PASS** |
| 14 | **A cancelled pinch** | The recogniser's `cancel()` path leaves nothing behind | `pointers=0`, `hover=null`, `0 clicks` — **PASS** |
| 15 | **The first tap after a cancelled pinch** | The game is still usable after a two-finger cancel | **FAIL** — **0 clicks**; the tap after that one worked |
| 16 | **A lost focus (touch)** — the recogniser | The touch service gives the finger back when the window loses the focus | **FAIL** — 1 pointer before the loss, **1 pointer after it**; the hover stayed on cell (41, 40) |
| 17 | **A lost focus (touch)** — the camera | The camera must not drift once the focus is gone | **FAIL** — the camera moved **4.788** world units after the window lost the focus |
| 18 | **A pad that disconnects mid-press** — the button | The button is released, not left stuck | `held=[0]` → `held=[]`, and the **release edge was reported on 1 frame** — **PASS** |
| 19 | **A pad that disconnects mid-press** — the menu | The menu does not act on a phantom press | 1 action while held (`menu.confirm`), **1 action after the unplug** — **PASS** |
| 20 | **A pad that disconnects mid-press** — the camera | The camera stops | **4.627 → 0.0000** units per frame; the axes are `{panX:0, panY:0, rotate:0, zoom:0}` — **PASS** |
| 21 | **A pad with `mapping: 'non-standard'`** — survival | The game does not crash and the pad still drives the city | The game saw *"Simulated Pad (Vendor Specific)"* and the stick panned **52.045** units — **PASS** |
| 22 | **A pad with `mapping: 'non-standard'`** — handling | The game knows what the pad is | **FAIL** — the service's snapshot carries `["connected","id","index","buttons","axes"]`; the mapping is **dropped** |
| 23 | **A lost focus (gamepad)** — the camera | A held stick must not keep driving the camera | **FAIL** — **4.600 → 3.042** units per frame (18.25 units over six frames) after the window lost the focus |
| 24 | **Reduced motion — the preference** | The preference is readable at runtime | `settings.get('accessibility.reducedShake')` → `true` — **PASS** |
| 25 | **Reduced motion — the shake** | A shake event produces no camera movement when the preference is on | **4.515 × 10⁻⁷** units against a **1.728 × 10⁻³** noise floor — **PASS** |
| 26 | **Reduced motion — the control** | …and the measurement can see a shake when the preference is off | **0.1883** units with the preference off — **PASS** |
| 27 | **Reduced motion — the effects path** | `accessibility.reducedEffects` reaches the effects service | `renderer.fx.reducedMotion` → `true` with it on, `false` with it off — **PASS** |
| 28 | **Runtime errors** | Neither profile produced an uncaught error or a console error | 0 page errors, 0 console errors on both profiles — **PASS** |

### Two measurements that are not checks, but change how the table reads

- **The canvas receives touches over 46.9 % of the phone screen.** The top
  bar covers 0–259 px and the shop panel 421–844 px, so the city is a band
  between them. The scenario finds the *freest* point on the canvas (96 px
  of clearance, at 148 × 340) and aims every gesture there — an earlier
  version of the scenario touched at a fixed coordinate and the touches
  landed on the tool column, not on the city. This is a layout observation
  for the integrator, not a verdict: a shop that owns half a phone screen
  may well be intended.
- **A DevTools-protocol tap arrives after 213–351 ms** (four runs: 213, 216,
  231, 351), and the recogniser's tap window is 250 ms. The protocol path
  therefore *cannot* be relied on to produce a tap under a software
  renderer — one of the four runs landed outside the window entirely — which
  is why the tap checks use the pointer-event pair the browser delivers for
  a real tap. The measurement is in the ledger so the reason is a number,
  not a claim.

---

## 3. The defects found

Six defects, all exposed by the device profiles and none of them exposed by
the existing synthetic tests. **They are reported, not fixed** — `game/src`
belongs to the integrator.

### D1 — the HUD's demand row is clipped off the right edge of a phone

*Where:* `game/src/ui/styles.js:26` (`#ui-root > .sc-hud { overflow: hidden; }`),
`:162` (`.sc-statusrow`), `:169` (`.sc-statusrow .sc-stat { min-width: 96px; }`),
and the narrow-screen media query at `:60`.

*What happens:* at 390 CSS px the HUD's own content is **573 px wide inside a
390 px box**. The HUD hides the overflow, so nothing scrolls and nothing
wraps: **42 elements reach past the right edge and 6 of them cannot be
reached at all**. They are the demand read-outs — the **"Food"** chip
(81 px off the edge) and the **"Waste"** chip (183 px off the edge), each an
interactive `button` with `pointer-events: auto`. A phone player cannot see
the food or the waste demand and cannot tap them.

*Why the old check missed it:* `tools/scenario-v7.mjs` measures the
**document's** scroll width (`390 ≤ 390` — a pass). The HUD is not
overflowing the document; it is overflowing *itself* and hiding the
evidence. The stylesheet's own comment at `styles.js:56` states the intent —
"on a narrow screen the panels are scaled down to fit rather than
overflowing off the side of the screen" — and the measurement contradicts it
for this row.

*Severity:* the demand row is how a player reads whether the city is
starving. **Player-visible, blocks nothing else.**

*The picture:* `devices-phone.png` is the 390 × 844 profile, and the second
row of the top bar is visibly cut off at **both** ends — "…TAL" on the left
(RESIDENTIAL) and "F" on the right (FOOD). That is defect D1, photographed.

### D2 — the first tap after a cancelled pinch is swallowed

*Where:* `game/src/core/touch.js:343` — `cancel()` removes the pointer and
ends the pinch, but never clears `multiTouch`. `up()` clears it at `:298`
and then consults it at `:318`, where a gesture that used two fingers is
refused a tap.

*What happens:* a phone call, a notification or a palm rejection during a
two-finger gesture cancels both fingers. The recogniser forgets the
pointers but keeps the "this was a multi-touch gesture" flag, so the
**next** single-finger tap is treated as the tail of the pinch and never
becomes a tap. The tap after that one works.

*Measured:* after a cancelled two-finger gesture, the next tap dispatched
**0 clicks**; the state afterwards was clean (`pointers=0`, `hover=null`).

*Severity:* the player taps, nothing happens, they tap again and it works.
**Player-visible, one gesture lost.**

### D3 — the touch recogniser keeps the finger when the window loses focus

*Where:* `game/src/ui/touch.js` — the service installs pointer listeners
only (`install()`, `:314`). It has no `blur` and no `visibilitychange`
handler, while the camera rig has one (`game/src/ui/camera.js:700`) for the
keyboard and the mouse drag.

*What happens:* the window loses the focus mid-drag and the recogniser still
holds the pointer. The hover stays published on the cell under the finger,
and the service still believes a finger is down.

*Measured:* **1 pointer** before the focus loss, **1 pointer** after it; the
hover stayed on cell (41, 40).

### D4 — the camera keeps drifting after the window loses focus (touch)

*The consequence of D3:* the recogniser still consumes the pointer moves, so
the city pans on with nobody touching it.

*Measured:* the camera moved **4.788 world units** after the window lost the
focus, with the finger still down.

*Caveat, stated honestly:* on a real device the browser fires
`pointercancel` when the window is hidden, which would usually stop the
drift before the player noticed. The game should not depend on that, and the
gamepad case (D5) has no such safety net.

### D5 — a held stick keeps driving the camera after the window loses focus

*Where:* `game/src/ui/camera.js:700` — `onBlur()` clears the held keys and
the mouse drag, but not `padAxes`, the analogue axes the gamepad service
pushed. The keyboard and the mouse are released on a blur; the controller
is not.

*What happens:* the player is holding the stick, the window loses the focus
(the player switches apps, a notification arrives), and the camera keeps
panning the city in the background.

*Measured:* **4.600 units per frame** before the focus loss, **3.042 units
per frame** after it — 18.25 units over six frames, with the stick still
pushed. The contrast with the unplug case is decisive: unplugging the pad
gives **7.8 × 10⁻⁹** units per frame.

*Severity:* the city moves while the player is not looking at it.

### D6 — the pad's mapping is dropped, so a non-standard pad is only survived

*Where:* `game/src/core/gamepad.js:123` — `readPad()` copies `connected`,
`id`, `index`, `buttons` and `axes` into the snapshot, and never copies
`mapping`. No production code path in `game/src` reads `pad.mapping` at
all — the only occurrences in the tree are comments and the test fakes
(verified by grep over the whole source tree).

*What happens:* a pad that reports `mapping: 'non-standard'` is handled
exactly as if it reported `'standard'`. Its button indices are read with the
standard table. The game **survives** it — the pad is seen, the stick pans
the city, nothing throws — but it does not **handle** it: the game cannot
tell the two apart, cannot remap the buttons, and cannot warn the player
that the D-pad and the face buttons may be somewhere else.

*Measured:* the browser reported `mapping="non-standard"`; the service's
snapshot carried `["connected","id","index","buttons","axes"]` — the
mapping is not in it. The stick panned **52.045** units, so the pad was
usable.

*Honest verdict:* **survived, not handled.** Whether the game should remap,
warn, or refuse a non-standard pad is a product decision; what is not a
decision is that today it cannot even tell.

---

## 4. What still needs hardware

None of the following can be answered by a device profile, a synthetic event
or a simulated pad. Each needs a person, a finger or a controller.

### Touch (V7-KI-04)

1. **The pan rate under a thumb.** `RIG_RATES.dragPan` (0.11 world units per
   pixel) is a design value, shared with the mouse. Whether the city moves
   at the right speed under a thumb — and whether the damping feels like
   the glass or like a mouse pad — needs a hand.
2. **The pinch sensitivity.** The measured pinch went 66 → 28.286 units over
   a 320 px finger spread. Whether that rate suits two thumbs, and whether
   the pinch and the one-finger pan fight each other in practice, needs two
   hands.
3. **Whether 44 × 44 CSS px is big enough in a hand.** The measurement
   proves the controls *are* 44 px; only a thumb proves they are *usable*.
   The phone's DPR also matters: 44 CSS px is 132 device px on this profile.
4. **The safe-area insets.** The stylesheet carries `safe-area-inset`
   rules, and a notched phone is the only way to see whether the HUD keeps
   clear of the notch and the home indicator.
5. **A real pen.** The game treats a pen as a finger: it ignores pressure,
   tilt, the eraser end and the palm rejection the browser reports
   separately. Whether a stylus should pan, select or scroll is unanswered.
6. **Touch latency.** The whole input path is measured in software-rendered
   frames here. A real touchscreen's latency, and the gap between a
   finger's arrival and the game's reaction to it, is not measured at all.

### Gamepad (V7-KI-05)

7. **The dead zone (0.18) on a worn stick.** The value is a convention, not
   a measurement. A stick that rests at 0.1 will drift on hardware that a
   clean simulator never shows.
8. **The trigger ramp.** `readAxes` accepts the triggers as buttons or as
   axes; the feel of a real analogue pull, and whether the zoom rate suits
   it, needs a trigger.
9. **The buttons on a non-standard pad.** D6 shows the game cannot tell
   which pad it is holding. Whether to remap, warn or refuse needs a pad
   that really reports `'non-standard'`.
10. **Every pad's A/B/X/Y and its d-pad.** The bindings are the standard
    table; on an Xbox-shaped pad on a PlayStation-shaped game, "A" is a
    different physical button, and only a controller proves that the
    on-screen hints match the hardware in the player's hands.

### Both

11. **The screen furniture.** A phone with a notch, a hole-punch, a gesture
    bar, or a fold. The device profile has a rectangle; a real phone does
    not.
12. **Bluetooth.** A controller over Bluetooth loses frames and reports
    buttons it did not press. A fake `navigator.getGamepads()` is perfect
    and instantaneous; a Bluetooth pad is neither.

---

## 5. How to reproduce

```bash
cd /Users/mac/Documents/SuperCitycon-V7/game
npm run build:cleared
npx vite preview --port 4212 --strictPort &

cd /Users/mac/Documents/SuperCitycon-V7
node tools/scenario-devices.mjs http://localhost:4212/ /tmp/sc-devices v7-devices
echo "exit: $?"     # 0 only when every check passed
```

The run writes `devices.json` (the whole ledger plus every measurement
quoted above), `devices-phone.png` (the 390 × 844 profile) and
`devices-pad.png` into the output directory. The scenario exits **1** while
any check fails — the six defects in section 3 are why it does today.
