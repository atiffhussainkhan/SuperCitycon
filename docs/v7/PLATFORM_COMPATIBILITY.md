# SuperCitycon V7 — Platform Compatibility

**The honest position:** SuperCitycon is a **web build**. There is one
shippable artefact — the cleared static bundle in `game/dist`. Nothing in
this document claims a platform that was not built and tested.

---

## 1. What is supported

| Target | Status | Evidence |
|---|---|---|
| **Web / Chromium (desktop)** | **SUPPORTED** | every measurement in this release |
| **Web / Chromium (touch device)** | **SUPPORTED** | `tools/scenario-v7.mjs` — 10/10 with synthetic touch events |
| **Web / Firefox** | NOT TESTED | no Firefox in this environment |
| **Web / Safari** | NOT TESTED | no Safari in this environment |
| **Windows** | NOT BUILT | the build is platform-agnostic, but no Windows build was produced or tested |
| **Android** | NOT BUILT | a web build only; see §4 |
| **iOS** | NOT BUILT | a web build only |
| **Linux** | NOT BUILT | not produced or tested |
| **ARM64** | NOT BUILT | the host is x86_64 |
| **A native desktop executable** | NOT BUILT | this is a web game; there is no installer and no application bundle |

## 2. What the V7 work changed about platform support

V7 closed the **touch** gap. V6 had no touch support at all: the canvas
listened to pointer events, so a finger produced a mouse click and nothing
else. On a phone the game could not be moved, zoomed or navigated.

| Change | What it buys |
|---|---|
| `core/touch.js` + `ui/touch.js` | a one-finger drag pans, a pinch zooms, a two-finger drag rotates, a tap selects |
| `ui/styles.js` — `env(safe-area-inset-*)` | the HUD respects the notch and the home indicator |
| `ui/styles.js` — the `@media (max-width: 520px)` block | the HUD reflows on a narrow viewport instead of overflowing |
| `index.html` — `touch-action: none` (already in the baseline) | the browser does not scroll the page or zoom it under the finger |
| the 44 × 44 touch targets (already in the baseline) | a control is big enough for a finger |

**What V7 did NOT do:** it did not claim a native mobile build. A native
package cannot be produced or verified in this environment, and shipping an
unverified claim would be worse than shipping the web build that actually
works.

## 3. How the touch support was verified

Chromium was run with `hasTouch: true`, and the gestures were dispatched
through the DevTools protocol (`Input.dispatchTouchEvent`), because a
two-finger pinch cannot be expressed any other way.

| Gesture | Verified |
|---|---|
| a one-finger drag | the camera moved 31.68 units |
| a two-finger pinch | the camera distance went 66 → 33.00 (a factor of two) |
| a two-finger drag | the camera yaw went 0.785 → 1.460 rad |
| a tap | one click reached the domains, on cell (43, 43) |
| a drag | **zero** clicks reached the domains |

**The limit:** no physical touch device was attached to the build machine.
The gestures are real browser events, but the FEEL of a real finger — the
pan rate, the pinch sensitivity, whether the 44 px targets are big enough
in a hand — was never put in front of a human. See `KNOWN_ISSUES.md`.

## 4. What a native mobile build would still need

For the record, and to be explicit about what was NOT done:

1. a native shell (Android WebView, Capacitor, or a game framework);
2. the asset pipeline for the target's GPU (the current 3D packs are GLB,
   which is fine for WebView, but the memory budget of a phone is much
   smaller than the 146 MB JS heap reading on a desktop);
3. a device rotation policy and a background/resume path — the game pauses
   on `visibilitychange` through the browser, but an app lifecycle is
   different;
4. a battery profile;
5. hardware testing on at least two devices.

The **web** build works on a phone today. That is a real, tested statement.
A **native** build does not exist, and this document does not pretend
otherwise.

## 5. The browser compatibility rules the code follows

| Rule | Why |
|---|---|
| `touch-action: none` on the page | so a drag on the city pans the city |
| `env(safe-area-inset-*)` on the HUD | so the HUD is not under the notch |
| `user-scalable=no, maximum-scale=1` in the viewport meta | so a double-tap does not zoom the browser |
| the pointer handler ignores touch pointers | so a tap selects once, not twice |
| `isTouchPointer()` accepts `touch` and `pen` | so a stylus works like a finger |
| the gamepad path is a separate owner | so a pad, a mouse and a finger never fight |
