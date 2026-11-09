# SuperCitycon — V6 Release Notes

**Release:** SuperCitycon **6.0.0**
**Branch:** `v6/upgrade-Zehe03`
**Baseline:** V5 merged into `main` @ `69b65793a5d10c18d8c8b426fc5431897fada5bd`
**Target platform:** Web (Chromium-verified)
**Build command:** `npm ci && npm run build:cleared`
**Release status:** see [`V6_VERIFICATION.md`](V6_VERIFICATION.md)
**Save schema:** version **2** — unchanged from V5

---

## 1. The release identity

| Field | Value |
|---|---|
| **Product** | SuperCitycon — a retro 16-bit-palette voxel city builder for the browser |
| **Version** | 6.0.0 |
| **Product version source** | `game/package.json` → `6.0.0`; `game/package-lock.json` → `6.0.0` (both the root and the `packages[""]` entry) |
| **Build identity** | `game/vite.config.js` reads `package.json` and stamps `VITE_BUILD_VERSION`; the fallback in `game/src/core/log.js` is `6.0.0-dev` |
| **Baseline revision** | `69b6579` (`main`, the merged V5) |
| **Engine** | Three.js 0.169.0 |
| **Bundler** | Vite 7.3.7 |
| **Runtime** | ES modules in the browser; no framework; no native build |
| **Target platform** | Web — Chromium verified. Firefox, Safari, Windows and Linux **not** tested (see [`V6_KNOWN_ISSUES.md`](V6_KNOWN_ISSUES.md) V6-KI-02) |
| **Build command** | `cd game && npm ci && npm run build:cleared` |
| **Save schema** | **Version 2** — V5 saves open in V6 with no migration and no loss |

The **product version** and the **save format version** are deliberately two
different numbers. `6.0.0` is what the player is told; `2` is what the save
file is. They are pinned apart by tests in
`game/src/core/save-compat.test.mjs`.

---

## 2. Reproducing the build

```bash
git clone <repo> && cd SuperCitycon
git checkout v6/upgrade-Zehe03

cd game
npm ci                    # clean install from the lock file
npm test                  # the unit suite
npm run check             # every source file parses cleanly
npm run build:cleared     # -> game/dist  (the shippable bundle)

npm run preview           # http://localhost:4173
```

**Why `build:cleared` and not `build`:** the plain build contains the 2D HUD
art, whose licence is unverified. The cleared build strips it and **fails** the
build if any of it survives. The game is complete and correct with zero 2D
images.

**The V6 browser scenarios** (both against a served build):

```bash
node tools/scenario.mjs      <url> <outDir> v5-acceptance   # the V5 scenario, unchanged
node tools/scenario-v6.mjs   <url> <outDir> v6-regression   # the V6 flows
```

---

## 3. What shipped in V6

### 3.1 Gamepad support (V5 issue KI-05) — implemented from scratch

V5's KI-05 claimed the Gamepad API was already read and routed through the
input map. It was not: at the baseline `69b6579` the tree contained **no
gamepad code at all**. V6 implemented the whole path.

**The rules live in CORE** (`game/src/core/gamepad.js`, pure and Node-testable):

| Rule | Why it exists |
|---|---|
| A dead zone of 0.18, with the usable range **rescaled** | A worn stick rests at 0.05–0.1. Inside the zone it reads as exactly `0`, so the camera cannot drift on its own. The rescale keeps the response linear and still reaches 1.0 at full deflection. |
| The dead zone applies to the **sticks only** | A trigger rests at zero and a part-pull is a deliberate half-press. Dead-zoning a trigger would swallow the first 18% of every pull. |
| A button fires on its **edge**, not while held | A held CONFIRM confirms **once**. This is the "no double confirm" rule. |
| A disconnect **releases** every held button | An unplugged pad cannot leave a button stuck down. |
| Connect / disconnect are reported explicitly | The UI can tell the player the pad arrived, and can drop the pad hint when it leaves. |

**The bindings live beside the keyboard bindings** in
`game/src/core/input-map.js` — one table describes the player's controls and
one place rebinds them. The pad actions are deliberately separate from the
keyboard actions, because the menu's own arrow / Enter / Escape scheme is not
a rebindable game action.

**The browser half lives in UX** (`game/src/ui/gamepad.js`): it reads
`navigator.getGamepads()`, compares the frames and routes the result.

| Behaviour | Where |
|---|---|
| Directional menu navigation with a **visible focus ring** | `ui/menu.js` — `handlePadAction('menu.up' / 'menu.down')`, the same `is-focused` class the keyboard uses |
| Confirm and back | `ui/menu.js` — `menu.confirm` activates the focused control, `menu.back` walks out of a view and closes the overlay |
| A **valid focus target after a panel changes** | `ui/menu.js` — the focus ring is pruned against the DOM on every move, so a control that was replaced by a re-render can never be the focus target, and the ring re-applies itself where the focus actually is |
| The settings rows are reachable with a pad | `ui/settings-panel.js` registers its rows with the menu's focus ring; a slider takes LEFT / RIGHT for itself |
| Analogue camera movement | `ui/camera.js` — `setPadAxes()`; the left stick pans, the right stick rotates, the right trigger zooms in and the left zooms out |
| **Held input** | The camera applies the axes every frame, so a held stick keeps moving the camera at a speed that follows the deflection |
| **Dead zones** | `core/gamepad.js` — applied to the sticks, rescaled |
| **Disconnect / reconnect** | `core/gamepad.js` — the held buttons are released and the axes go to zero; the pad hint follows the connection |
| **No held-button double confirm** | `core/gamepad.js` — the edge, not the level |
| **The camera does not move while a modal has the focus** | `ui/gamepad.js` — the axes are released while the menu or a HUD panel is open; `ui/camera.js` has its own guard as well |
| **Reduced screen shake is honoured** | The camera rig reads `accessibility.reducedShake` itself and silences the shake entirely. A pad cannot override it. |

### 3.2 A V6 gameplay regression suite

`tools/scenario-v6.mjs` drives the assembled game in a real browser through
five flows — an authored map launch, the First Light progression, a save and
continue round trip, the hazard effects, and the city transitions.

It is a **new** file. The V5 acceptance scenario `tools/scenario.mjs` and all
of its assertions are untouched, and both are run.

### 3.3 V5 save compatibility, proved rather than asserted

`game/src/core/save-compat.test.mjs` writes a **hand-built V5 record** — the
V5 envelope with a V5-shaped payload and the V5 progression record — into
storage and loads it in V6. It asserts the buildings, the treasury, the day,
the seed and the progression record all come back, that the stored save is not
rewritten, that a V6 save is the same format as a V5 save, and that the v1 →
v2 migration still works.

---

## 4. What V6 deliberately did NOT change

| | |
|---|---|
| **The save schema** | It stays at version 2. |
| **The V5 acceptance scenario** | `tools/scenario.mjs` is untouched. |
| **The shop layout** | `tools/verify-shop-layout.mjs` is untouched and still passes. |
| **The performance tools** | `tools/performance.mjs` and `tools/performance-gpu.mjs` are untouched. |
| **The cleared build target** | `npm run build:cleared` is still the shippable target. |
| **The 2D art quarantine** | Unchanged — none of it ships. |
| **The domain layout** | One folder per domain; `core/CONTRACT.md` is unchanged. |

---

## 5. The honest limits

- **The gamepad path was verified against a SIMULATED pad.** No physical
  controller was available in the build environment. The logic is verified; the
  feel on real hardware is not. See [`V6_KNOWN_ISSUES.md`](V6_KNOWN_ISSUES.md)
  V6-KI-10.
- **Gamepad buttons cannot be rebound in the UI.** The machinery is in place
  (`applyPadOverrides`, and the service reads the table every frame); the
  capture screen is not. See V6-KI-11.
- **No ARM, no Windows, no Linux, no non-Chromium browser.** See V6-KI-01 and
  V6-KI-02.
- **No native executable.** The cleared bundle is the artifact. See V6-KI-03.
- **No audio files.** Every sound is synthesised. See V6-KI-07.
- **The 2D art licence is unresolved.** None of it ships. See V6-KI-06.
