# SuperCitycon — senior review round 4 (final pre-release)

You are the senior developer and analyst reviewing a finished game build. This
is the **fourth and final** round. Rounds 1–3 produced a fix wave; every finding
from those rounds has been addressed. Your job is the last gate: find what is
still wrong before this ships.

## The project

`/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace/game`

A retro 16-bit-palette **voxel city builder** in the browser: Three.js 0.169 +
Vite 5, ES modules, no TypeScript. Ten domains, each owning one folder, wired
by `src/main.js` through the binding contract in `src/core/CONTRACT.md`.

Read first: `src/core/CONTRACT.md`, then `../game/DEFECTS.md` (every finding and
its fix), then `AGENTS.md`, then `../game/LICENCE-REPORT.md`.

## What changed since round 3

Round 3 reported; these are the fixes. **Verify each one — do not trust it.**

| Round-3 finding | Fix |
|---|---|
| **MAJOR** — the cleared-build strip failed silently, so a "shippable" bundle could still carry unverified art | The strip now **throws**; a failed strip fails the build. |
| **MAJOR** — `disposeInstancedBatch` left the batch's `Group` in the scene | It now removes the group as well as disposing the parts. |
| **MINOR** — `scatterStats` under-counted multi-part scatter batches | It counts parts via `instancedParts`. |
| **MINOR** — `population/index.js` had an import below its statements | Moved to the top of the file. |
| **MINOR** — no tests for `instancedParts` / `setInstanceCount` / `disposeInstancedBatch` / the upgrade-debt path / the UX live state | All five are now covered by unit tests. |
| **MINOR** — cloned batch geometries were never freed | They are marked `scBatchOwned` and freed on dispose. |

**Two further changes were made after round 3, and they are the main subject of
this round.**

### A. The HUD no longer blocks the map after a shop-card click (`src/ui/hud.js`)

Found by the browser harness, not by inspection. The shop is a **persistent
bottom strip** (`.sc-shop`), but the panel is a **full-screen modal**
(`.sc-panel { inset: 0; pointer-events: auto; z-index: 20 }`). Clicking a shop
card used to call `openPanel('building')`, which raised that modal over the map
and swallowed the next canvas click — so the building the player had just
chosen could not be placed until they dismissed the modal by hand. A dead end
in the build loop.

The card handler now: selects the type, **arms the build tool**
(`deps.onTool?.(TOOLS.build)`) and **closes** any open panel (`closePanel()`).
The building-detail panel is still reachable through the HUD button and the `i`
key, so nothing was removed. Covered by a new test in `src/ui/ui.test.mjs`.

### B. The live-state sweep was completed and the broken UX test was rewritten (`tests/live-state.test.mjs`)

The UX test had a top-level `await` inside a synchronous test callback (a
syntax error) and asserted against a `ui.hud.model()` API that does not exist.
It now exercises the real public API (`setTool`, `hoverCell`, `showToast`) and
proves the UX layer writes into the tree that is live *now* and not into an
orphaned one.

## What to check, in priority order

1. **Is the card-click fix correct and complete?** (`src/ui/hud.js`)
   - Does the change break the "building detail panel" path (FR-UX-032 — panels
     must be dismissible by a close control, an outside tap and a back gesture)?
   - Does arming the build tool from a card click violate FR-UX-057 (tools are
     mutually exclusive; the active tool is visibly indicated)?
   - Is `closePanel()` safe to call when no panel is open? Does it clear
     `state.ui.panel` on both paths?
   - Is there any OTHER path in the HUD that opens a full-screen modal and then
     expects the map to be clickable underneath? Search the whole HUD for
     `openPanel(` and list every caller, with what happens to the map after it.
   - Does the change break the shop strip, the tabs, or the card `is-selected`
     highlight?
2. **The whole input path.** From a cold boot: click a tool → click a shop card
   → click the map. Does a building appear? What about `bulldoze`, `road`,
   `paint` and `terraform`? Is there any tool whose click is still swallowed by
   a HUD element?
3. **The live-state sweep.** `core/state.js` `liveStateProxy` / `liveSubtree`.
   Is there ANY domain that still captures `ctx.state` or a sub-tree at
   construction time? Grep every domain for `ctx.state`, `state.ui`,
   `state.economy`, `state.buildings`, `state.mobility` and check each capture.
4. **The batch slot lifecycle** (`src/buildings/index.js`) — allocation,
   free-list reuse, growth, demolish, upgrade, re-init, save/load, dispose and
   the async attach race. Is a slot ever handed out twice?
5. **The economy** — the debt path for BOTH builds and upgrades; can the balance
   still go negative outside a settlement; is the ledger consistent; is the
   injectable clock still deterministic?
6. **The licence policy** — can the unverified 2D art still reach a publishable
   build by any route? Does the cleared build lose any function? Is the HUD
   honest when the art is absent?
7. **The scenario harness (`../tools/scenario.mjs`)** — has it been weakened to
   pass? Is any check now vacuous? Does it still exercise a real pointer click?
8. Anything from rounds 1–3 that is still not actually fixed.

## The rules you must hold me to

- A published number is a publisher fact; an unpublished one must be marked
  provisional, never presented as fact.
- Pure rule modules must not import `three`.
- The state tree is the single source of truth; no domain may hold a stale
  reference to it.
- Never claim a test passed that was not run.

## Commands you may run

```bash
cd /Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace/game
npm run check
node --test src/*/*.test.mjs tests/*.test.mjs
npm run build
npm run build:cleared
```

**If your mode cannot run a shell, say so plainly and mark every runtime
conclusion as UNVERIFIED.** Do not describe a test as passing unless you ran it.
A static review is still useful — do it, and label it honestly.

A dev server runs on `http://localhost:5177/` and a production preview on
`http://127.0.0.1:4321/`. The acceptance harness is
`../tools/scenario.mjs <url> <outdir>`.

## Output

1. **VERDICT** — one line: shippable, and under what conditions?
2. **BLOCKERS** — must be fixed before release, with a reproduction.
3. **MAJOR** — real defects, with a reproduction.
4. **MINOR** — small things.
5. **ROUNDS 1–3 FIXES: CONFIRMED / NOT CONFIRMED** — one line each.
6. **WHAT THIS FIX WAVE BROKE** — regressions introduced since round 3.

Be specific: file, line, reproduction. If you cannot reproduce something, say
so. A short list of real findings beats a long list of speculation.
