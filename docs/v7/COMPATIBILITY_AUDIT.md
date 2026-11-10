# SuperCitycon V7 — Compatibility Audit

**What this is.** An audit of the **shipped bundle** (`game/dist/assets/index-*.js`)
for the hazards that make a web game break on another engine or another
device, plus a browser run of every graceful-degradation path the code claims
to have.

**Why it exists.** `docs/v7/PLATFORM_COMPATIBILITY.md` lists Firefox, Safari,
Windows, Linux and ARM64 as NOT BUILT / NOT TESTED, and GATE 9 (platform
verification) is PARTIAL. The build machine has exactly one browser engine in
`~/Library/Caches/ms-playwright/` — `chromium-1248`,
`chromium_headless_shell-1248` and `ffmpeg-1013`. There is no Firefox, no
WebKit and no second engine, and downloading one was out of scope.

So this audit does the part that **can** be done honestly: it reads the
artefact that actually ships, classifies every cross-engine hazard as a REAL
hazard or a FALSE ALARM with evidence, and then **proves the degradation paths
work** by deleting the platform APIs before the game boots and watching what
happens.

**The tool.** `tools/compat-audit.mjs` — static + runtime + device. It is
reproducible; §6 has the exact commands. Everything below is measured by that
tool, not estimated.

---

## 1. The summary

### What IS verified now

| Claim | How | Result |
|---|---|---|
| The shipped bundle contains no unguarded use of the named cross-engine APIs | static scan of the built entry chunk | **14 of 15 hazards are false alarms**; the one real one is `localStorage` (§2) |
| The bundle's syntax floor is known, not guessed | esbuild re-emit at es2020 / es2019 / es2018 / es2017 | clean at **es2020**; `import.meta` is the only thing that blocks es2019 |
| The real browser floor is known | the bundle's three.js revision, read from the bundle | three.js **r169** requests `webgl2` only → **WebGL 2 is mandatory** → Safari 15 / iOS 15 |
| The game boots, the HUD renders, the camera answers the keyboard and the console stays clean with `getGamepads` **absent** | Chromium, API deleted before boot | **yes** — 3/3 rounds |
| The same with `getGamepads` **throwing** (a non-secure context) | Chromium, API made to throw before boot | **yes** — 3/3 rounds |
| The same with **no PointerEvent at all** | Chromium, the constructor deleted *and* pointer listeners refused | **yes** — 3/3 rounds; the keyboard still works, the mouse path is gone by design |
| The same with **no ResizeObserver** | Chromium, API deleted before boot | **yes** — 3/3 rounds |
| `Event.timeStamp` in epoch milliseconds is rejected by the touch rule | Chromium, epoch timestamps injected into real pointer events | **yes** — the recogniser read **351 ms** where the epoch delta said 5 ms, and fired **no** tap |
| The layout does not overflow at 320 / 390 / 768 / 1280 / 1920 px **on a fresh load** | Chromium, page loaded at each size | **0 px overflow at every width** |
| The canvas does not overflow after a **rotation or a window resize** | Chromium, viewport changed after boot | **it does — 960 px at 320 px wide** (§4, finding D2) |
| Every interactive target is at least 44 × 44 px (FR-UX-017) | Chromium, real layout boxes of every visible control | **no — 45 of 62 are smaller**, at every width (§4) |

### What is NOT verified — and cannot be, here

* **The game was never run on Firefox, Safari or any WebKit build.** Every
  runtime number in this document comes from Chromium. The audit proves the
  *bundle* is free of the named hazards and that the *degradation paths* work;
  it does not prove the game runs on a second engine.
* **No physical touch device.** The touch path is driven with synthetic
  events, in Chromium, as before.
* **No ARM64, no Windows, no Linux, no phone.** The bundle is
  platform-agnostic JavaScript and the artefact is a static folder, but
  "platform-agnostic" is an inference, not a measurement.
* **No GPU.** Every frame-time number here is a **software-rendered**
  (SwiftShader) number on a shared machine. They are useful only as a
  comparison between configurations, never as a performance claim.

### Does this change GATE 9?

**No — GATE 9 stays PARTIAL, but its scope is now explicit and smaller.**

The honest reading of the gate is two separate claims, and this audit closes
one of them:

| Half of GATE 9 | Before | After |
|---|---|---|
| *"The shipped bundle contains no unguarded cross-engine hazard, and the degradation paths work."* | unexamined | **audited and measured — three real findings** |
| *"The game runs on Safari, Firefox, Windows, Linux, ARM64."* | unexamined | **still unexamined** — impossible in this environment |

A bundle audit is not an engine test. The gate can only move from PARTIAL to
PASS when a second engine actually runs the game, so **this audit does not
close GATE 9**. What it does is replace an open-ended unknown with a bounded,
checked statement, and it adds **three real findings** (D1–D3 in §4) that the
integrator owns. Those should be recorded as known issues before the release
claims anything about phones.

**Recommendation:** keep GATE 9 **PARTIAL**, re-worded to *"bundle-level
cross-engine audit complete (`docs/v7/COMPATIBILITY_AUDIT.md`); no second
engine available, so Safari/Firefox/WebKit, Windows, Linux and ARM64 remain
untested"*, and open D1–D3.

### The real hazards, in one line each

Of the **15 named API hazards, 14 are false alarms** — the bundle either does
not use them or guards them. The ones that are real:

| # | Real hazard | Where | Effect |
|---|---|---|---|
| **D1** | The game **does not boot** when `localStorage` throws | `game/src/main.js:144` | a dead page with the fatal pane; any blocked-cookies / storage-disabled context |
| **D2** | The canvas **keeps its boot size** after a resize or a rotation | `game/src/render/renderer.js:264` | the city is drawn into a corner at the wrong size; up to **960 px** of overflow at 320 px |
| **D3** | **45 of 62 interactive controls are under the 44 px the project claims** (FR-UX-017) | `ui/styles.js:14` vs `ui/hud.js:340`, `ui/hud.js:931`, `ui/styles.js:622-631`, `ui/styles.js:761-772` | a mis-tap on a phone; the worst is the shop panel's search box at **17–18 px** tall |

None of the three was fixed here: `game/src/**` belongs to the integrator.
They are reported in full in §4.

---

## 2. The hazard table

Every row is a hazard named in the V7 brief, plus the ones the code turned up.
"Real" means it would break the game on some engine or device. "False alarm"
means the bundle is safe — and the evidence says *why*.

**Evidence base:** `game/dist/assets/index-s2UJZvgQ.js`, 1 169 048 bytes,
sha256 `1872a22e4c143c5d4a9ed25cf8c08db14bfd4ec1a019dd4e6c70a29e4280a133`,
which is the chunk `dist/index.html` loads (the audit asserts this, and
asserts again at the end that the file did not change while the audit ran).

### 2.1 The APIs

| # | Hazard | Affects | Verdict | Evidence | If it bites |
|---|---|---|---|---|---|
| H1 | **`PointerEvent` does not exist** | Safari < 13, iOS < 13 | **FALSE ALARM** | The bundle contains the identifier `PointerEvent` **0 times**. The game never constructs one; it only calls `addEventListener('pointerdown', …)`, which is a no-op on an engine without that event, not a crash. | Nothing crashes. The game boots, the HUD renders and the keyboard still works — but **the whole pointer path is gone**, mouse included: the canvas listens for `pointerdown`/`pointerup`/`pointermove` (`main.js:924-927`). Measured: **0** mouse clicks reached the domains (the baseline reaches 1), while the camera still moved on `KeyD`. |
| H2 | **`navigator.getGamepads` absent** | Safari (no Gamepad API at all), old browsers | **FALSE ALARM** | 4 occurrences, every one behind `typeof i.getGamepads != "function"` and a `try/catch` (`ui/gamepad.js:55-64`, `ui/settings-panel.js:108-113`). | The service reports "no pad". Measured: boots, HUD renders, keyboard works, **no console error**, the pad service stays alive and reports `isConnected() === false`. |
| H3 | **`navigator.getGamepads` throws** | a page served over plain HTTP on a non-localhost host — Chrome throws `SecurityError` | **FALSE ALARM** | The same `try/catch` covers the throw. | "No pad". Measured: boots, HUD renders, keyboard works, **no console error**. The throw is caught *inside* the frame loop, so it costs one exception per frame at most. |
| H4 | **`performance.memory` absent** | every non-Chromium engine | **FALSE ALARM** | **0 occurrences in the shipped bundle.** It appears only in `tools/profile-gpu.mjs:323` and `tools/profile-city.mjs:279`, which are development tools, not the game. | Nothing. The profilers already branch on it (`performance.memory ? {…} : null`). |
| H5 | **`Event.timeStamp` in epoch milliseconds** | an engine that reports `event.timeStamp` as epoch ms | **FALSE ALARM — the guard works** | `ui/touch.js:236-240` rejects any stamp `>= 1e12` and falls back to `performance.now()`. Proved in the browser (§3.3). | Without the guard, every gesture would be timed by an epoch delta, and a tap on a busy machine would be misread as a long press — the exact failure the rule exists to prevent. With the guard, the recogniser reads the **real elapsed time**. |
| H6 | **`structuredClone`** | Chrome < 98, Safari < 15.4, Firefox < 94 | **FALSE ALARM** | **0 occurrences** in the bundle. The one use in the tree is in `world/world.test.mjs`, a Node test. | Nothing. |
| H7 | **`Array.prototype.at`** | Chrome < 92, Safari < 15.4, Firefox < 90 | **FALSE ALARM** | **0 occurrences** with a numeric index. The 6 raw `.at(` hits are three.js's own `this.at(…)` method on `Ray`/`Line3` — an unrelated API with the same spelling. | Nothing. |
| H8 | **`Object.hasOwn`** | Chrome < 93, Safari < 15.4, Firefox < 92 | **FALSE ALARM** | **0 occurrences** in the bundle. | Nothing. |
| H9 | **`String.replaceAll`** | Chrome < 85, Safari < 13.1, Firefox < 77 | **FALSE ALARM** | **0 occurrences** in the bundle. | Nothing. |
| H10 | **`requestIdleCallback`** | Safari before 15.4 | **FALSE ALARM** | **0 occurrences** in the bundle. The game never defers work to an idle callback. | Nothing. |
| H11 | **`matchMedia`** | — | **FALSE ALARM** | **0 occurrences** in JavaScript. The `@media` rules are CSS, which every engine that parses the stylesheet supports. | Nothing. |
| H12 | **`ResizeObserver` absent** | Chrome < 64, Safari < 13.1, Firefox < 69 | **FALSE ALARM** | 4 occurrences, each behind `typeof ResizeObserver < "u"`, with a `window` `resize` fallback (`render/renderer.js:428-431`, `studio/editor.js:499-501`). | The renderer still learns about the new size, so the drawing buffer tracks the viewport. Measured: boots, HUD renders, keyboard works, **no console error**. Note this is a *different* fault from D2: the fallback works, but the canvas element's size is wrong for a reason that has nothing to do with `ResizeObserver` (D2 exists in the baseline too). |
| H13 | **`WeakRef`** | Chrome < 84, Safari < 14.1, Firefox < 79 | **FALSE ALARM** | **0 occurrences** in the bundle. | Nothing. |
| H14 | **`OffscreenCanvas`** | Safari < 16.4, Firefox < 105 | **FALSE ALARM** | 3 occurrences, all inside three.js and all behind a `typeof` check. | Nothing. |
| **H15** | **`localStorage` throws on access** | a context with cookies blocked (Chrome "block all cookies", Firefox `dom.storage.enabled=false`), a sandboxed iframe, some private modes | **REAL HAZARD** | `main.js:144` reads `globalThis.localStorage ?? null` with **no `try/catch`**. The `??` only guards a *null* value — it cannot guard a *throwing getter*. The save path (`core/save.js:150-155`) does it correctly, with `try { return globalThis.localStorage \|\| null } catch { return null }`, and so does `studio/index.js`. `main.js` is the one that does not. | **The game does not boot.** Measured: the fatal pane appears with `Failed to read the 'localStorage' property from 'Window': Access is denied for this document.` and the boot log stops after `preloaded 128/128 models`. **See D1.** |

### 2.2 Syntax

| # | Hazard | Verdict | Evidence | If it bites |
|---|---|---|---|---|
| S1 | **Top-level `await`** | **NOT PRESENT** | esbuild re-emits the bundle at `es2020` with **zero diagnostics**; esbuild *errors* on a top-level await below es2022, so a clean es2020 pass rules it out. The entry point is `main().catch(fatal)` (`main.js:1008`). | Nothing. |
| S2 | **`import.meta`** | **PRESENT — and it sets the syntax floor** | 9 occurrences: Vite's own preload helper (`lr(() => import(…), [], import.meta.url)`) and the build-identity read (`typeof import.meta < "u"`). `import.meta` is a **module** feature: Chrome 64+, Firefox 62+, Safari 11.1+. esbuild's warning names it as the only blocker below es2020. | An engine without module support cannot parse the bundle at all. But such an engine also cannot load a `<script type="module">`. |
| S3 | **Optional chaining `?.` / nullish `??`** | **PRESENT — this is the real syntax floor** | **1 673** occurrences of `?.` and **838** of `??`. ES2020 features: Chrome 80+, Edge 80+, Firefox 74+, **Safari 13.1+ / iOS 13.4+**. | An engine below Safari 13.1 cannot parse the bundle. |
| S4 | **ES2021 logical assignment (`\|\|=`, `&&=`, `??=`)** | **NOT PRESENT** | **0 occurrences.** | Nothing. |

### 2.3 The build target and the browser the code implies

`game/vite.config.js:334` sets `build.target: 'es2020'`, and the audit's
esbuild sweep agrees: **es2020 is the lowest target the bundle re-emits
cleanly**, and es2019 is the first that warns (`"import.meta" is not available
in the configured target environment`).

The project has **no browserslist**, so the browser set has to be inferred.
Inferred from the code, in ascending order of strictness:

| Requirement | From | Chrome | Edge | Firefox | Safari | iOS |
|---|---|---|---|---|---|---|
| ES modules (`<script type="module">`) | `index.html:83` | 61 | 16 | 60 | 11 | 11 |
| `import.meta` | S2 | 64 | 79 | 62 | 11.1 | 11.3 |
| **Optional chaining + nullish coalescing** | S3 | **80** | **80** | **74** | **13.1** | **13.4** |
| `PointerEvent` | H1 | 55 | 12 | 59 | **13** | **13** |
| **WebGL 2** | **§2.4** | **56** | **79** | **51** | **15** | **15** |

**The binding constraint is WebGL 2, not the syntax.**

### 2.4 WebGL 2 — the floor the brief did not name

The bundle embeds **three.js r169** (`REVISION="169"`). In r169 three.js
requests **`webgl2` only** — there is no WebGL 1 fallback. The bundle's own
code is:

```js
const ie = "webgl2";
if (z = ce(ie, F), z === null)
  throw ce(ie) ? new Error("Error creating WebGL context with your selected attributes.")
               : new Error("Error creating WebGL context.");
```

So on an engine without WebGL 2 the renderer throws and the game shows the
fatal pane. WebGL 2 shipped in **Chrome 56, Edge 79, Firefox 51** and
**Safari 15 / iOS 15** (September 2021) — Safari was the long hold-out.

**Therefore the browser floor this build actually implies is:**

> **Chrome 56+, Edge 79+, Firefox 51+, Safari 15+, iOS 15+**, and any engine
> with WebGL 2.

That single fact retires H1, H2, H3, S2 and S3 as *release* risks: every
engine that clears the WebGL 2 bar also has `PointerEvent`, optional chaining
and `import.meta`. The API-level hazards above remain worth having audited —
they are the things that break a *deployment* (a page on plain HTTP, a
blocked-cookies context) rather than a *browser*.

---

## 3. The degradation matrix

### 3.1 How it was measured

Chromium, launched through the project's own `tools/playwright-resolve.mjs`
(the same resolver the acceptance harness uses — Playwright stays out of
`game/package.json`). Each configuration gets a **fresh browser context** whose
`addInitScript` removes or breaks the API **before the game's first line
runs**, so the game boots into the degraded world rather than discovering the
problem later.

Every configuration is booted **3 times, interleaved** (baseline, degraded,
baseline, degraded, …) so that machine load — this is a shared build machine
running a *software* GL — hits every configuration equally. The tool reports
the **median** of each configuration and the **noise floor**: the spread of
the baseline's own repeats. A difference smaller than the noise floor is not
a finding.

Each boot asserts six things: the game boots, the HUD renders, the camera
answers the keyboard, the console stays clean, the touch and pad services are
alive and do not throw, and a mouse click still selects a cell. It also
measures the boot time, the frame-time distribution, the per-frame cost of the
gamepad path and the cost of a raw `navigator.getGamepads()` call.

### 3.2 The results

**Noise floor first**, because it governs everything below: the baseline's
own spread over the three rounds was **±1 270 ms on boot time** and
**±416.7 ms on the frame-time p50**. This is a shared build machine running a
software GL. Any difference smaller than that is not a finding.

#### The functional result

| Configuration | Boots | HUD renders | Camera answers `KeyD` | Mouse click selects | Console errors | Touch + pad services |
|---|---|---|---|---|---|---|
| **Baseline** — nothing removed | **yes**, 3/3 | yes (9 HUD children, 61 buttons) | yes — **9.317** units | **yes** (1 click) | **0** | alive, neither throws |
| **`navigator.getGamepads` absent** | **yes**, 3/3 | yes | yes — **9.841** units | **yes** (1 click) | **0** | alive; pad reports `isConnected() === false` |
| **`navigator.getGamepads` throws** | **yes**, 3/3 | yes | yes — **6.479** units | **yes** (1 click) | **0** | alive; the throw is caught inside the service |
| **No `PointerEvent` at all** | **yes**, 3/3 | yes | yes — **12.679** units | **no** (0 clicks) — *by design* | **0** | alive; the pointer path is simply never fed |
| **No `ResizeObserver`** | **yes**, 3/3 | yes | yes — **13.225** units | **yes** (1 click) | **0** | alive |
| **`localStorage` access throws** | **NO** — 0/3 | no (0 children) | n/a | n/a | **1 — `SecurityError`** | n/a |

Every degraded configuration that the code claims to survive **does survive**:
the game boots, the HUD renders, the camera answers the keyboard, the touch
and pad services stay alive, and the console stays clean. The only
configuration that fails is the one the code does **not** guard, and it fails
loudly and completely.

The camera's movement differs between configurations (6.5 – 13.2 units) only
because the software renderer ran at a different frame rate in each round;
the direction and the order of magnitude are identical.

#### The timing result

| Configuration | Boot time, ms (3 samples) | median | Frame p50, ms (3 samples) | median | p90 median | fps from the mean |
|---|---|---|---|---|---|---|
| Baseline | 2873.3 / 1603.3 / 1831.9 | **1831.9** | 750 / 333.3 / 666.6 | **666.6** | 716.7 | 1.5 |
| `getGamepads` absent | 1959.2 / 1398.9 / 1922.0 | **1922.0** | 666.6 / 316.6 / 583.3 | **583.3** | 766.7 | 1.6 |
| `getGamepads` throws | 1964.6 / 1227.7 / 1939.4 | **1939.4** | 650 / 316.6 / 583.3 | **583.3** | 650.0 | 1.7 |
| No `PointerEvent` | 2212.2 / 1226.6 / 2004.5 | **2004.5** | 650 / 316.6 / 683.2 | **650.0** | 683.4 | 1.5 |
| No `ResizeObserver` | 2086.0 / 1236.5 / 2115.7 | **2086.0** | 600.1 / 316.6 / 650.0 | **600.1** | 666.5 | 1.7 |
| `localStorage` throws | — | **does not boot** | — | — | — | — |

**Read this honestly:** every one of those differences is **inside the noise
floor** (±1 270 ms on boot, ±416.7 ms on p50). The boot-time spread between
the fastest and the slowest configuration (254 ms) is a fifth of the
baseline's own spread. **The frame times are SwiftShader software-render
numbers at 1.5–1.7 fps on a shared machine and are not a performance claim
about any real device.** The honest conclusion is:

> **The cost of these degradations is below what this environment can
> resolve.** The degraded paths are not free — they are *cheap enough not to
> matter*.

#### The per-frame cost, measured directly

Because the frame times cannot resolve a difference, the tool measures the
paths themselves, in a tight loop, where the answer is exact:

| Measurement | Baseline | `getGamepads` absent | `getGamepads` throws | No `PointerEvent` | No `ResizeObserver` |
|---|---|---|---|---|---|
| The whole gamepad service, **per frame** (2 000 calls) | 7.00 µs | **3.30 µs** | 7.35 µs | 7.80 µs | 6.95 µs |
| A raw `navigator.getGamepads()` call (20 000 calls) | 3.17 µs | **0 µs** (the method is gone) | 2.61 µs (20 000 throws) | 3.06 µs | 3.04 µs |

So the gamepad path costs about **3.7 µs per frame** more than a browser
without the Gamepad API, and a *throwing* `getGamepads()` costs about the
same as a working one (the exception is cheaper than the call). Against a
frame that lasts 600 ms in this environment — and 16 ms on a real GPU — that
is **0.0006 % of a frame, or 0.02 % of a real one**. The degradation is
free in practice.

### 3.3 The `Event.timeStamp` rule, proved

`ui/touch.js:236`:

```js
function eventTime(e) {
  const stamp = Number(e?.timeStamp);
  if (Number.isFinite(stamp) && stamp > 0 && stamp < 1e12) return stamp;
  return now();
}
```

An engine that reports `event.timeStamp` in epoch milliseconds produces a
value around 1.8 × 10¹² — above the 10¹² ceiling — so the guard rejects it
and the recogniser falls back to `performance.now()`.

The audit proves this in the browser with real pointer events on the real
canvas, in four parts. Each part dispatches genuine `PointerEvent`s at
(640, 400) with a **controlled** `timeStamp`, and reads what the gesture
recogniser *actually received* — the recogniser's own `down`/`up` are wrapped
so the timestamps are captured, not inferred.

| # | Trial | The events carried | The recogniser read | Clicks that reached the domains | What it proves |
|---|---|---|---|---|---|
| **A** | Direct | an epoch stamp of `1794349694316` | **t = 2846.7** — the same as `performance.now()` (2846.7) | — | the epoch value was **replaced** by the processing clock |
| **B** | Control | the browser's own timestamps | **132.9 ms**, and the two events were generated **133.1 ms** apart | **1** (a tap) | the gesture is timed by when the events were **generated**, not by when they were processed — the whole point of using `event.timeStamp` |
| **C** | Counterfactual | the **same** timestamp on both events | **0 ms** | **1** (a tap) | two events with the same stamp are read as a **0 ms gesture**, which is a tap — this is exactly what the epoch pair would have produced if the guard had let it through |
| **D** | The real test | epoch stamps `…69708` and `…69713` — a **5 ms** difference | **351 ms** — the *real* elapsed time, not 5 ms | **0** (correctly not a tap) | the epoch value was **rejected**; a 5 ms epoch delta did **not** become a 5 ms tap |

Trial C and trial D are the decisive pair: without the guard the recogniser
would have read 5 ms and fired a tap; with the guard it read 351 ms and did
not. **The guard works.**

Why it matters: the events of one tap are stamped when the browser
**generates** them, and the handler may run a second later on a busy main
thread. Measuring the gap with the processing clock would turn every tap into
a long press (500 ms) on a slow machine. The guard is what makes the tap
window (250 ms) meaningful.

---

## 4. The device matrix

### 4.1 How it was measured

Six viewports, measured two ways, because they answer different questions:

* **FRESH** — the page is **loaded** at that size. This is what a device gets
  on arrival.
* **RESIZED** — the page was loaded at 1280 × 800 and the viewport is then
  changed. This is what a device gets after a **rotation** or a **window
  resize**.

Overflow is measured from the browser's own layout boxes, and an element
inside a scrolling or clipping box (the shop's card strip) is allowed to stick
out — the box scrolls it. Touch targets are the real `getBoundingClientRect()`
boxes of every visible control, against the project's own 44 px claim
(FR-UX-017).

#### On a FRESH load — a device arriving at that size

| Viewport | Canvas display size | Page overflow (right / bottom / left) | Interactive controls | Under 44 px |
|---|---|---|---|---|
| **320 × 568** — the smallest phone still sold | 320 × 568 ✓ | **0 / 0 / 0 px** | 62 | **45** |
| **390 × 844** — a modern phone, portrait | 390 × 844 ✓ | **0 / 0 / 0 px** | 62 | **45** |
| **768 × 1024** — a tablet, portrait | 768 × 1024 ✓ | **0 / 0 / 0 px** | 62 | **45** |
| **1280 × 800** — a desktop window | 1280 × 800 ✓ | **0 / 0 / 0 px** | 62 | **45** |
| **1920 × 1080** — a desktop display | 1920 × 1080 ✓ | **0 / 0 / 0 px** | 62 | **45** |
| **844 × 390** — a phone in **landscape** | 844 × 390 ✓ | **0 / 0 / 0 px** | 62 | **45** |

**On a fresh load the layout is clean at every width.** No page overflow at
320 px, no overflow in landscape, the canvas exactly fills the viewport, and
the HUD's own reflow (`@media (max-width: 520px)` and `@media (max-width:
720px)`) holds.

#### After a RESIZE — what a device gets after a rotation or a window resize

| Viewport | Canvas **display** size | Canvas **drawing buffer** | Page overflow (right / bottom) | Under 44 px |
|---|---|---|---|---|
| **320 × 568** | **1280 × 800** ✗ | 320 × 568 | **960 / 232 px** | 45 |
| **390 × 844** | **1280 × 800** ✗ | 390 × 844 | **890 / 0 px** | 45 |
| **768 × 1024** | **1280 × 800** ✗ | 652 × 870 | **512 / 0 px** | 45 |
| **1280 × 800** | 1280 × 800 ✓ | 896 × 560 | 0 / 0 px | 45 |
| **1920 × 1080** | **1280 × 800** ✗ | 1344 × 756 | 0 / 0 px | 45 |
| **844 × 390** (landscape) | **1280 × 800** ✗ | 590 × 273 | **436 / 410 px** | 45 |

The drawing buffer tracks the viewport — the renderer *knows* the new size —
but the canvas **element** keeps the size it was given at boot. The overflow
column is the consequence.

#### The touch targets, at every width

**Finding D3.** The same 45 controls are under 44 px at **every** width (the
set is identical from 320 px to 1920 px); only the widths of the two search
boxes change with the viewport.

| Control | Measured size | Count | Where |
|---|---|---|---|
| `button.sc-setbtn` | **44 × 32 px** | 20 | the settings / controls / accessibility panels |
| `button.sc-swatch` | **28 × 28 px** | 16 | the studio's voxel material palette |
| `input.sc-setrange` | **129–130 × 24 px** | 7 | the sliders in the settings panels |
| `input.sc-search` | 304–1904 × **34 px** | 1 | the search box in the **shop strip** (in the default HUD) |
| `input.sc-search` | 131–150 × **17–18 px** | 1 | the search box in the **shop panel** |

`ui/styles.js:14` states the rule this project set for itself: *"every
interactive target is at least 44 × 44 logical px (FR-UX-017)"*. **45 of the
62 visible controls are smaller than that.** Only one of them — the shop
strip's search box — is on the default HUD; the other 44 are reachable when
the settings, shop or studio panels are open.

The two worst are the shop panel's search box (**17–18 px tall**, and it has
no styling of its own — `ui/hud.js:931` creates it with a class and
nothing else, so it renders as a native input) and the studio palette
swatches (**28 × 28 px**).

### 4.2 The two real defects

#### D1 — the game does not boot when `localStorage` throws

**Where:** `game/src/main.js:144`

```js
const settings = createSettings({ storage: globalThis.localStorage ?? null, logger });
```

`??` guards a `null` value. It cannot guard a **throwing getter**. When the
context denies storage, reading `globalThis.localStorage` raises a
`SecurityError`, the `main()` promise rejects, and `fatal()`
(`main.js:1008`) paints the fatal pane.

**Measured:** the fatal pane reads

```
SuperCitycon failed to start.

Failed to read the 'localStorage' property from 'Window': Access is denied for this document.

--- boot log ---
preloaded 128/128 models (0 failures)
```

and the console carries the same `SecurityError`. The game never reaches the
HUD: **0 HUD children, 0 visible buttons**.

**This is the one unguarded read in the tree.** The save path does it
correctly — `core/save.js:150-155`:

```js
function getStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
```

and so does the studio (`studio/index.js:232`, `252`). The fix is to read the
storage the same way and hand the result to `createSettings`. **The
integrator owns `game/src/**`; this audit did not change it.**

**Who hits it:** Chrome with "block all cookies", Firefox with
`dom.storage.enabled = false`, a sandboxed iframe, some corporate proxies —
and any deployment that serves the game from a plain-HTTP origin on a
non-localhost host, which is where `navigator.getGamepads` starts throwing
too. A user in any of those contexts gets a dead page instead of a city.

#### D2 — the canvas keeps its boot size after a resize or a rotation

**Where:** `game/src/render/renderer.js:264`

```js
resize() {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);      // ← updateStyle = false
  postfx?.resize();
},
```

three.js's `setSize(w, h, updateStyle)` updates the **drawing buffer**
(`canvas.width` / `canvas.height`) always, but updates the canvas's **CSS
size** (`canvas.style.width` / `height`) only when `updateStyle` is `true`.
It is `false` here — so the canvas keeps whatever inline style it was given
at creation, by `renderer.setSize(container.clientWidth, container.clientHeight)`
at `renderer.js:104`, where the default `updateStyle` is `true`.

The stylesheet's `#viewport canvas { width: 100%; height: 100% }` cannot
override an inline style, so the canvas element stays at its boot size for
the life of the page.

**Measured** (the page was loaded at 1280 × 800, then the viewport changed):

| After a resize to | canvas element | drawing buffer | what the player sees |
|---|---|---|---|
| 390 × 844 | **1280 × 800** | 390 × 844 | the city drawn into a 1280 × 800 box, cropped to 390 × 844 — and stretched, because `camera.aspect` was updated to the *new* ratio while the canvas is displayed at the *old* one |
| 844 × 390 (rotation) | **1280 × 800** | 590 × 273 | the same, plus 436 px of horizontal and 410 px of vertical overflow |
| 320 × 568 | **1280 × 800** | 320 × 568 | **960 px** of horizontal overflow |

Note that the **fresh load** is correct at every size — the canvas is created
at the viewport's size, so a phone that opens the game in portrait is fine.
The defect appears when the viewport changes: **a phone rotating**, a
desktop window being resized, a tablet's browser chrome appearing and
disappearing, or a page restored from the back/forward cache at a different
size.

The one-line shape of the fix is to pass `updateStyle = true` (or to drop
the inline style and let the stylesheet rule win), and to keep the
projection matrix in step with the size actually displayed. **The integrator
owns `game/src/**`; this audit did not change it.**

---

## 5. What is STILL not verified

Stated plainly, because a compatibility document that overstates itself is
worse than none.

1. **The game has never run on a second engine.** Every runtime number here
   is Chromium on macOS x86_64. The audit shows the bundle does not *use* the
   named APIs unguarded, and that the degradation paths work — it does not
   show Safari or Firefox rendering a single frame of this city.
2. **No physical touch device.** The touch gestures are synthetic events in
   Chromium. The *feel* of a finger — the pan rate, the pinch sensitivity,
   whether 44 px is enough in a hand — is still unmeasured.
3. **No real GPU.** Every frame-time number is a SwiftShader software-render
   number on a shared machine. They are a **comparison between
   configurations**, not a performance figure. No conclusion about a real
   phone's frame rate can be drawn from them.
4. **No phone, tablet, Windows, Linux or ARM64.** The artefact is a static
   folder of platform-agnostic JavaScript, but "platform-agnostic" is an
   inference from the code, not a measurement.
5. **The frame-time comparison is at the noise floor.** The machine's own
   variance between repeats is of the same order as the differences between
   the configurations. The honest statement is *"the degradation cost is below
   what this environment can resolve"*, not *"the degradation is free"*.
6. **The `localStorage` failure was reproduced by injecting the throw**, not
   by finding a browser that throws it naturally. The *behaviour* of Chrome
   with "block all cookies" and of Firefox with `dom.storage.enabled=false` is
   documented browser behaviour, but this audit did not run those browsers.
7. **The canvas-size defect was reproduced by resizing the viewport**, which
   is what a rotation does, but no physical device was rotated.
8. **No screen-reader, no keyboard-only, no reduced-motion, no colour-blind
   pass** — out of scope for this audit, and not covered by it.
9. **The device matrix covers the HUD's own surfaces.** The 3D scene's
   performance and framing at these sizes was not measured; only the DOM
   layout and the canvas box were.
10. **The audit is a point-in-time measurement of one bundle.** The tool
    records the sha256 of the chunk it scanned and fails if the file changes
    mid-run, but a rebuild with different source produces a different audit.
11. **The degraded configurations are SIMULATIONS, not old browsers.** The
    tool deletes `PointerEvent` and refuses pointer-event registrations,
    makes `getGamepads` throw, deletes `ResizeObserver` and makes
    `localStorage` throw — all inside Chromium. That proves the *code paths*
    respond correctly; it does not prove how Safari, Firefox or WebKit
    actually behave, which is a different question.
12. **The WebGL 2 floor was derived, not tested.** No engine without WebGL 2
    was run. The conclusion comes from reading the three.js r169 code inside
    the shipped bundle — `webgl2` only, no WebGL 1 fallback — and from the
    published support tables, not from a measurement.

---

## 6. Reproducing this

```bash
# 1. build the shippable bundle
cd game && npm run build:cleared

# 2. serve it
npx vite preview --port 4210 --strictPort

# 3. audit it (from the repository root)
node tools/compat-audit.mjs http://localhost:4210/ /tmp/sc-compat
```

The tool writes three evidence files:

| File | What it holds |
|---|---|
| `/tmp/sc-compat/static-evidence.json` | the bundle hash, the feature counts, the guard checks, the esbuild syntax sweep |
| `/tmp/sc-compat/audit-evidence.json` | everything, including the degradation matrix and the device matrix |
| `/tmp/sc-compat/device-evidence.json` | the per-viewport layout measurements |

Useful switches: `SC_COMPAT_ROUNDS=3` (default) sets how many interleaved
rounds each configuration is measured over; `SC_COMPAT_FRAME_MS=3000` sets the
frame-sampling window.

**Exit code:** 0 when the audit ran to the end — a *finding* is not a failure
of the tool — and 1 when the baseline itself failed, because then the audit's
own numbers cannot be trusted.
