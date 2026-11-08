# Remaining issues — MiniMax Game Studio ULTRA V2

Everything here is a real, named gap with an owner. Nothing is a wish list, and
nothing here is hidden behind a green test.

**Nothing in this list blocks the game from being played, built or published**
with `npm run build:cleared`. Items 1 and 2 are the two that matter; the rest
are recorded so they are not lost.

---

## 1. The 2D HUD art is licence-unverified — blocks the *decorated* build

**Status:** open. **Owner:** the publisher. **Severity:** release-gating for any
build that includes the 2D art.

82 HUD images (tool icons, category icons, HUD stat icons, backgrounds,
portraits, sprites, effects, tiles, UI chrome) come from the user's image
library. **Every 2D record in that library carries `licence_status:
"unverified"`.** Not one has been cleared for public release.

**What this means in practice:**

- `npm run build:cleared` — the **publishable** build — strips them entirely.
  The HUD stays complete: every icon slot falls back to its CSS/text treatment,
  and the licence disclaimer line is hidden because there is no art to disclaim.
  Verified: **40 of 41 acceptance checks pass, with the 2D-art check correctly
  skipped.**
- `npm run build` — the local build — includes them, for the owner's own use.
  It writes `dist/DO-NOT-PUBLISH.txt` into its own output saying so.

**The fix:** for each of the 82 images, confirm the licence and record it. The
field to update is `licence` in `game/src/data/ui-assets.json` (currently
`"unverified"` for every entry).

> **This was a live defect and has been corrected in the repository.**
> `.github/workflows/deploy.yml` was running `npm run build` — the LOCAL
> profile — and deploying it to GitHub Pages. The published site was therefore
> serving the 82 uncleared images *and* the `DO-NOT-PUBLISH.txt` notice that
> says the bundle must not be published. The workflow now runs
> `npm run build:cleared` and **asserts** that `dist/assets/ui/`,
> `dist/assets/ui-assets.json` and `dist/DO-NOT-PUBLISH.txt` are all absent
> before deploying. **The live site is corrected the next time the workflow
> runs.** See `RELEASE-MANIFEST.md` §7.

---

## 2. One construction slot, and no way to earn another

**Status:** open. **Owner:** `sc-simulation` (ECO). **Severity:** balance.

`state.economy.constructionSlots.total` starts at **1**, and no catalogue entry
has `grantsConstructionSlot: true`. The player can therefore only ever have one
building under construction. `trn.monorail_station` asks for **two** slots, so
**it can never be built at all**.

The gate is enforced — which is the point of the integrator's placement gate —
so this balance problem is **visible rather than hidden**. The acceptance
harness reports it directly:

```
PASS  buildings place on the map — 17/18 placed, 1 failed:
      trn.monorail_station@36,34: slot-timeout
```

**Proposed `TUNING` keys:** `constructionSlotsTotal` (≥ 3) and
`constructionMinutesByCategory`.

---

## 3. The x15 / x16 bonus ceiling is unresolved

**Status:** open. **Owner:** the publisher (dossier OQ-POP-09).

The recovered dev-blog text says the six bonuses "together can scale up to x15";
six independently capped 250 % bonuses sum to 1500 %, which under an additive
reading is x16. `TUNING.bonusCeiling` is **15** and is applied as a ceiling on
the additive reading, so the headline is x15 and the x16 arithmetic is visible
in the code. **The publisher's value was never published.**

---

## 4. The wealth-curve base level is derived, not published

**Status:** open. **Owner:** the publisher (OQ-POP-05).

`population/happiness.js` derives `L0 = 0.2` from the published anchor (wealth
level 1.65 → 129 %) instead of guessing it, and marks it `TBD`.

**Proposed `TUNING` key:** `wealthBaseLevel`.

---

## 5. The demand-bar model is a design decision

**Status:** open. **Owner:** the publisher (dossier OQ-ECO-*).

The bar **semantics** are published (FR-ECO-061/062: unmet demand, fuller = more
needed). The **inputs** are not, so ECO's model — the resident count as the
demand proxy for all three sectors — is authored, and every bar is marked
`assumed` in the HUD.

---

## 6. Known rough edges

**Status:** open, cosmetic. **Owner:** the integrator.

- The 3D models are placed on the terrain, but the terrain mesh and the model
  bases use slightly different height sampling, so a model can sit a fraction of
  a unit off the ground on steep slopes.
- The camera pitch clamp lives in the UX camera rig; the integrator's old
  `setPitch` was removed after the two fought over radians and degrees.
- **The shop category bar overflows at 1600 px and the overflow is not
  discoverable.** Measured in the browser at a 1600×900 viewport: the element
  `.sc-shop-tabs` has `overflow-x: auto` with `scroll-width: 2091` in a
  `client-width: 1584` box, so **four of the twelve categories — Decoration,
  Infrastructure, Waste and Special / City Upgrade — sit outside the viewport
  by default.** They are **reachable**: scrolling the bar to the far right
  (`scrollLeft` 507) brings the last chip fully into view (right edge 1592) and
  it clicks. But macOS overlay scrollbars mean nothing advertises that there is
  more content, so a player at this width can easily believe those categories
  do not exist. **Not a functional defect** — the acceptance harness's pointer
  test reaches a category chip and selects a building type successfully. The
  fix is cosmetic: a visible fade or scroll affordance at the right edge, or a
  wrapping layout.

---

## 7. Two npm advisories in the build toolchain

**Status:** accepted, mitigated. **Owner:** the integrator. **Severity:** none
for the shipped artefact.

`npm audit` reports 2 advisories (1 moderate, 1 high) in `vite` and its
transitive `esbuild`, both affecting the **development server** only. Neither is
present in the shipped bundle. Vite's dev server binds to loopback by default;
do not expose it with `--host`. Full analysis and the reasoning for not
upgrading: `PERFORMANCE.md` §4 and `game/README.md` §7.

---

## 8. The 3D game has no code yet

**Status:** by design. **Owner:** the five development bots.

The 3D game (working title **LANTERNWAKE**, `src/content/` and the `game/` tree
specified in `minimax-game/`) is a **complete design package**: 102
requirements, each with behaviour, data, algorithm, a falsifiable acceptance
test and the assets it binds — verified by four gates that all pass (31 + 13
checks, 102/102 implementable, 18/18 fault injections bite).

**There is no game code for it yet**, so there is no build, no export and no
runtime test for it. Its first real gate is **GATE 1**.

Two open items travel with the design:

| Item | Effect | Owner |
|---|---|---|
| **DEL-01** — **27 music cues have no source in the repository.** The corpus has 78 audio files and no music | The music bus ships **silent**, no cue is fabricated, and the build is releasable in that state. `REQ-D-015` is **PARTIAL** and says so. A composer-supplied file enters through the same manifest slot and the same CI gate | Optional, not blocking |
| **DEL-02** — the `kaykit_41` bone map and its golden retarget test are specified but not written | A **Gate 2** blocker for the 3D game — not for Gate 0 or Gate 1 | Architecture board, in development |

Two decisions genuinely need the requester, not the team:

| Item | Effect |
|---|---|
| **OPEN-002** — the web release host (its COOP/COEP limits) | Neither blocks desktop Gates 0–5 |
| **OPEN-005** — the rights review before any public distribution | Neither blocks desktop Gates 0–5 |

---

## 9. What is NOT an issue, but might look like one

- **The 2D art missing from the publishable build** — by design, and the HUD is
  complete without it.
- **The low headless frame rate** — software GL, not a game defect. The
  simulation runs on a fixed step and is unaffected.
- **The unverifiable asset paths** if you delete
  `minimax-game/platformer-docs/library-packs/` — that is the design gate
  correctly reporting that it can no longer verify **722 of its 849** cited
  paths against the real archives (721 on a machine that also has the shared
  asset mirror, which holds one of them). It calls them **UNVERIFIED**, not
  fabricated, because the archives that would prove them exist were not
  present to be opened. Restore the cache with the fetch scripts.
- **`npm audit` reporting 2 vulnerabilities** — in the build tool, not the game.
  See §7.
