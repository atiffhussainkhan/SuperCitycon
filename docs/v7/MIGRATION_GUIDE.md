# SuperCitycon V7 — Migration Guide

**For the player:** nothing to do. **For the publisher:** read §2.

---

## 1. The short version

**Your city is safe.** V7 does not change the save format. A city you built
in V5 or V6 opens in V7 exactly as it was — the same buildings, the same
treasury, the same progression record.

**The product version moved to 7.0.0. The save schema did not.** Those are
two different numbers and they stay two different numbers on purpose:

| | V5 | V6 | V7 |
|---|---|---|---|
| the product version | 5.0.0 | 6.0.0 | **7.0.0** |
| the save schema | 2 | 2 | **2** |

A save that says `version: 2` is read by every build from V5 onwards.

## 2. What the publisher has to do

**Nothing.** The V7 build is the V6 build with more code in it. The level
library, the building catalogue, the asset manifest, the settings schema and
the save format are all unchanged.

If you run a server that serves the bundle:

1. build with `npm run build:cleared` — the shippable target;
2. the bundle stamps `7.0.0` in its build identity, so you can confirm the
   deployment from the diagnostics;
3. **do not** run `npm run build` (the uncleared build) for a public
   deployment — it contains 2D art whose licence is unresolved.

## 3. What changed for the developer

### The new modules

| Module | Why |
|---|---|
| `game/src/core/navigation.js` | the grid A* pathfinder — pure, Node-testable |
| `game/src/core/touch.js` | the gesture recogniser — pure, Node-testable |
| `game/src/ui/touch.js` | the browser half of the touch path |
| `game/tools/secret-scan.mjs` | the secret scan |
| `tools/profile-navigation.mjs` | the navigation benchmark |
| `tools/scenario-v7.mjs` | the V7 browser acceptance scenario |

### The changed contracts

| Contract | What changed |
|---|---|
| `ctx.dispatchWorldClick(cell, button)` | **NEW.** The world-click dispatch moved from `main.js`'s private function onto the context, so the mouse and the touch share one path. `handleClick()` now calls it. |
| `camera.panBy(dx, dz)` | **NEW.** The camera rig's pan, for the touch drag. `panRelative()` was already there; it now has a public name. |
| `camera.setPadAxes(axes)` | unchanged from V6, and the touch service does **not** use it — a touch drag is a delta, a stick is an absolute position. |
| `menu.handlePadAction(action)` | unchanged from V6. |

### The new settings

**None.** V7 adds no setting. The four new numbers (`citizenSlopeCost`,
`citizenWadeDepth`, `citizenPathBudget`, `citizenPathsPerFrame`) are in
`TUNING`, not in the settings schema — they are tuning, not player choices.

### The behaviour changes a developer might notice

| Change | Why |
|---|---|
| The citizens now walk around buildings and water | the path is a real route, not a straight line |
| A touch tap selects the cell ONCE | the pointer handler no longer also acts on a touch pointer |
| A held key does not pan the camera under the menu | the held-key set is cleared when the menu takes the focus |
| The content validator now reports reachability | the "not proven" note is replaced by a proof |

## 4. The rollback procedure

1. `git checkout v6/upgrade-Zehe03` (or `main`, if the V6 release is what
   is deployed);
2. `cd game && npm ci && npm run build:cleared`;
3. serve `game/dist`.

**No save migration is needed in either direction**, because the schema did
not move. A city saved in V7 opens in V6.

## 5. The compatibility proof

| Check | Where |
|---|---|
| a V5 save opens in V7 | `game/src/core/save-compat.test.mjs` — 11 tests, including a hand-built V5 record |
| the save schema is still 2 | `save-compat.test.mjs` — "the save schema stays at version 2" |
| a V6 save opens in V7 | the same suite — "a save written by V6 is still a version 2 save" |
| the V5 acceptance scenario passes against the V7 build | `node tools/scenario.mjs` — 40/41 |
| the V6 gamepad scenario passes against the V7 build | `node tools/scenario-gamepad.mjs` — 19/19 |
