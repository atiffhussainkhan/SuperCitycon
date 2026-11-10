# SuperCitycon V7 — Save Size, Measured

**The measurement behind `V7-KI-08`.** Every number below was measured on a
real city, built through the game's own domain API, saved and loaded through
`ctx.core.save`. Nothing is projected, nothing is extrapolated.

| | |
|---|---|
| **Machine** | Darwin x86_64 (macOS 26.7.1), node v22.14.0 |
| **Browser** | headless Chromium, resolved through `tools/playwright-resolve.mjs` |
| **Build** | `cd game && npm run build:cleared` |
| **Tool** | `node tools/save-size-report.mjs --port 4211` (new in this round) |
| **Raw evidence** | `$TMPDIR/sc-save-size/save-size-report.json` (`--outdir` to change it) |
| **Save schema** | **version 2 — unchanged by this work** |

---

## 1. The summary

| | |
|---|---|
| **A typical city** — 533 buildings, 884 roads, 15,968 residents, 40 of 40 citizens | **778,418 bytes (760.2 KiB)** |
| **The worst city the game can hold** — 1,988 buildings, 1,366 roads, 56,844 residents | **1,405,068 bytes (1,372.1 KiB / 1.34 MiB)** |
| **A fresh city** — 23 buildings, 69 roads, ~1,000 residents | 477,791 bytes (466.7 KiB) |
| **Save time / load time, worst case** | **39–50 ms / 87 ms** |

**The one number that says how much of it is avoidable:**
**976,694 bytes — 69.5% of the worst save — is JSON scaffolding** (braces,
commas, quoted key names and the `{"__map":[[k,v],…]}` wrappers), not data.
Only 428,374 bytes (30.5%) is data. That is the upper bound on what *any*
format change could win.

**But the debt as it is written down is not where that bound lives.**
`V7-KI-08` says the save is *"dominated by JSON-encoded terrain arrays"*.
Measured, the three terrain arrays are **31,561 bytes — 2.25% of the worst
save** — and re-encoding them could win at most **4,249 bytes, 0.30% of the
save**. The save is dominated by the **building instances: 41.7%**, and by
the scaffolding around them.

| | bytes | share |
|---|---|---|
| the JSON scaffolding around everything | 976,694 | **69.5%** |
| the building instances | 585,668 | **41.7%** |
| the terrain (`heightmap` + `water` + `types`) | 31,561 | **2.25%** |

---

## 2. The breakdown

### 2.1 Every part of the payload — the worst save (1,405,068 bytes)

| part | bytes | KiB | share | data | scaffolding | per entity |
|---|---|---|---|---|---|---|
| `buildings` | 783,876 | 765.5 | **55.79%** | 170,938 | 612,938 | — |
| &nbsp;&nbsp;├ `instances` (a Map, 1,988 entries) | 585,668 | 571.9 | 41.69% | 119,923 | 465,745 | **294.6 B / building** |
| &nbsp;&nbsp;├ `catalogue` (a Map, 115 definitions) | 173,180 | 169.1 | 12.32% | 35,387 | 137,793 | **1,505.9 B / definition** |
| &nbsp;&nbsp;└ `occupancy` (a Map, 2,028 entries) | 22,834 | 22.3 | 1.63% | 14,711 | 8,123 | 11.3 B / entry |
| `mobility` | 270,816 | 264.5 | **19.27%** | 108,784 | 162,032 | — |
| &nbsp;&nbsp;├ `network` (the road graph) | 143,501 | 140.1 | 10.21% | 55,641 | 87,860 | **105.1 B / road node** |
| &nbsp;&nbsp;├ `roads` (a Map, 1,366 entries) | 105,448 | 103.0 | 7.51% | 43,967 | 61,481 | 77.2 B / road |
| &nbsp;&nbsp;└ `vehicles` (60 entries) | 21,706 | 21.2 | 1.54% | 9,133 | 12,573 | 361.8 B / vehicle |
| `economy` | 270,282 | 263.9 | **19.24%** | 94,832 | 175,450 | — |
| &nbsp;&nbsp;├ `constructions` (a Map, 1,988 entries) | 240,502 | 234.9 | 17.12% | 79,463 | 161,039 | **121.0 B / building** |
| &nbsp;&nbsp;├ `ledger` (200 entries — capped) | 20,459 | 20.0 | 1.46% | 8,458 | 12,001 | 102.3 B / entry |
| &nbsp;&nbsp;└ `charged` (a Set, 1,988 entries) | 8,844 | 8.6 | 0.63% | 6,845 | 1,999 | 4.4 B / building |
| `world` | 42,746 | 41.7 | **3.04%** | 25,108 | 17,638 | — |
| &nbsp;&nbsp;├ `heightmap` | 14,283 | 13.9 | 1.02% | | | **3.48 B / cell** |
| &nbsp;&nbsp;├ `water` | 9,053 | 8.8 | 0.64% | | | **2.20 B / cell** |
| &nbsp;&nbsp;├ `types` | 8,225 | 8.0 | 0.59% | | | **2.00 B / cell** |
| &nbsp;&nbsp;└ `scenery` (39 left) | 11,080 | 10.8 | 0.79% | 5,892 | 5,188 | 284.1 B / placement |
| `services` | 34,716 | 33.9 | **2.47%** | 27,988 | 6,728 | — |
| &nbsp;&nbsp;├ `coverage` (a Map, 6 services) | 32,907 | 32.1 | 2.34% | 27,425 | 5,482 | 5,484.5 B / service |
| &nbsp;&nbsp;└ `facilities` (12 entries) | 1,544 | 1.5 | 0.11% | 439 | 1,105 | 128.7 B / facility |
| `studio` | 1,030 | 1.0 | 0.07% | 338 | 692 | — |
| `population` | 569 | 0.6 | 0.04% | 156 | 413 | — |
| `ui` | 371 | 0.4 | 0.03% | 153 | 218 | — |
| `meta` | 259 | 0.3 | 0.02% | 69 | 190 | — |
| `hazards` | 187 | 0.2 | 0.01% | 8 | 179 | — |
| the record envelope (`version`, `savedAt`, `name`, `stage`) | 216 | 0.2 | 0.02% | | | — |
| **the whole save** | **1,405,068** | **1,372.1** | **100%** | **428,374** | **976,694** | |

### 2.2 Inside `world` — the terrain, cell by cell

The grid is 64 × 64 = **4,096 cells**, and there are **three** per-cell
arrays. The snapshot serialises each typed array as
`{"__typed":"Float32Array","data":[…]}`, so the numbers are JSON numbers in a
JSON array.

| array | typed array | cells | bytes | of which the array | bytes / cell | distinct values | range |
|---|---|---|---|---|---|---|---|
| `heightmap` | `Float32Array` | 4,096 | 14,283 | 14,249 | **3.48** | **14** | −9 … 12 |
| `water` | `Float32Array` | 4,096 | 9,053 | 9,019 | **2.20** | **7** | 0 … 9 |
| `types` | `Uint8Array` | 4,096 | 8,225 | 8,193 | **2.00** | **6** | 0 … 5 |
| **all three** | | 12,288 | **31,561** | 31,461 | **2.57** | | **2.25% of the worst save** |

**Why the terrain is cheap: the values are small.** The terrain is not an
arbitrary float field. `world/heightfield.js` states it plainly — *"The
terrain is not a continuous float heightmap: it is a per-cell INTEGER
elevation"* — laid on layers of `TUNING.heightStep` (1.5 world units). The
measured heightmap holds **14 distinct values between −9 and 12**, so a cell
costs `"1.5,"` (4 bytes) where an arbitrary float32 would cost
`"3.4800000190734863,"` (19 bytes). That is why the JSON is 3.48 B/cell, and
it is the fact the whole terrain argument turns on.

### 2.3 The theoretical floor — the same 12,288 cells, four ways

| encoding | bytes | against the JSON as stored |
|---|---|---|
| **JSON as stored** (with the three `__typed` wrappers) | **31,561** | — |
| JSON as stored, the floats rounded to 3 decimals | 31,461 | **−100 (−0.3%)** |
| JSON as stored, the floats rounded to 2 decimals | 31,461 | **−100 (−0.3%)** |
| the raw float32 / uint8 bytes, no encoding at all | 36,864 | **+5,303 (+16.8%)** |
| **base64 of the typed arrays as they are (lossless)** | **49,160** | **+17,599 (+55.8%)** |
| **base64 of a uint16 heightmap + uint16 water + uint8 types** | **27,312** | **−4,249 (−13.5% of the terrain)** |

Three things fall out of this table, and all three are measured:

1. **Rounding the floats saves nothing (−0.3%).** The values are already
   short decimals; there is no float bloat to squeeze out.
2. **Base64 of the typed arrays makes the save BIGGER.** The lossless binary
   encoding of the terrain is 49,160 bytes against the JSON's 31,561 — 55.8%
   *worse*. Even the bare binary with no encoding at all (36,864 bytes) is
   bigger than the JSON. The JSON encoding of this terrain is already
   **cheaper than the binary it would replace**.
3. **The best case for a compact encoding is uint16 + base64, and it wins
   4,249 bytes.** That is the *maximum* the terrain re-encoding could ever
   save: **0.30% of the worst save**, 0.55% of a typical one. The precision
   it costs is measurable and negligible: the worst height error is
   0.000160 world units (the height range is 21 units) and the worst water
   error is 0.000069.

---

## 3. The scaling

### 3.1 Size and time against city size

| city | buildings | roads | residents | citizens | save bytes | KiB | serialize | save (to storage) | load | import |
|---|---|---|---|---|---|---|---|---|---|---|
| fresh | 23 | 69 | 1,041 | 40 / 40 | 477,791 | 466.7 | 11.7 ms | 10.3 ms | 37.0 ms | 31.8 ms |
| medium | 153 | 289 | 5,764 | 40 / 40 | 564,875 | 551.6 | 13.7 ms | 15.3 ms | 37.5 ms | 40.0 ms |
| **large (typical)** | 533 | 884 | 15,968 | 40 / 40 | **778,418** | **760.2** | 20.9 ms | 22.3 ms | 61.8 ms | 59.1 ms |
| **maximum** | 1,988 | 1,366 | 56,844 | 40 / 40 | **1,405,068** | **1,372.1** | 38.8 ms | 50.4 ms | 86.6 ms | 87.8 ms |

*Medians of 5 samples, through `ctx.core.save`: `serialize` is
`snapshot()` + `JSON.stringify()`, `save` is `saveToStorage()` (which adds the
localStorage write), `load` is `loadFromStorage()`, `import` is
`importSave()` of the exported record.*

**The cost in practice: this is not a problem.** The worst save the game can
hold takes **50 ms to write and 87 ms to read**, on this machine, in headless
Chromium. A player never waits long enough to notice. Both the save and the
load track the size of the payload — they are a JSON round trip of a tree
that grows — and they stay under a tenth of a second at the maximum the
engine allows.

```
save size (KiB)

1400 ┤                                                     ██████████  1372.1
1200 ┤
1000 ┤
 800 ┤                              ██████               760.2
 600 ┤
 400 ┤
 200 ┤
   0 ┼───────────────────────────────────────────────────────────────
      fresh 23        medium 153        large 533        maximum 1,988
                         buildings (1×1 houses placed)
```

### 3.2 What scales with what

| part | fresh | medium | large | maximum | scales with |
|---|---|---|---|---|---|
| `buildings.instances` | 6,749 | 44,649 | 155,990 | 585,668 | **buildings** — 294.6 B each |
| `economy.constructions` | 2,720 | 18,168 | 63,768 | 240,502 | **buildings ever placed** — 121.0 B each |
| `buildings.occupancy` | 250 | 1,604 | 5,762 | 22,834 | buildings — 11.3 B each (derived) |
| `economy.charged` | 71 | 515 | 2,035 | 8,844 | buildings — 4.4 B each (derived) |
| `mobility.network` | 7,479 | 31,014 | 93,657 | 143,501 | **roads** — 105.1 B each (derived) |
| `mobility.roads` | 5,393 | 22,553 | 68,783 | 105,448 | roads — 77.2 B each |
| `mobility.vehicles` | 21,070 | 21,075 | 21,183 | 21,706 | **nothing** — 60 vehicles at the cap |
| `economy.ledger` | 23 | 153 | 200 | 200 | **nothing** — capped at 200 entries |
| `services.coverage` | 4,878 | 4,878 | 4,878 | 32,907 | service buildings |
| `world.scenery` | 216,949 | 194,938 | 131,860 | 11,080 | **it SHRINKS** — building on a cell clears its scenery (D-01) |
| **`world` terrain** | 31,561 | 31,561 | 31,561 | 31,561 | **nothing** — the same 4,096 cells |
| **`buildings.catalogue`** | 173,180 | 173,180 | 173,180 | 173,180 | **nothing** — the same 115 definitions |

Two of those rows are the whole story of this debt:

- **The terrain is a constant.** 31,561 bytes, identical in every city, at
  every size, forever. It cannot be what "dominates" a save that grows from
  466 KiB to 1.34 MiB.
- **The catalogue is a constant too, and it is 12.3% of the worst save and
  36.2% of a fresh-city save.** The same 115 building definitions are
  written into every save — and they are thrown away on load, because
  `BLD.init()` republishes `state.buildings.catalogue` from the build's own
  `BUILDING_DEFS` table every time a city is loaded or reset.

And one row explains why the *total* grows more slowly than the building
count (86× the buildings, 2.9× the save): the scenery the city stands on is
removed as the city is built, and it was as large as the buildings that
replaced it. The per-building parts grow linearly; the total is the sum of
parts that grow and parts that shrink and parts that never move.

### 3.3 How many saves fit in the browser

The `localStorage` quota was **measured**, not assumed: the tool removes its
own scratch slots, then writes 256 KB chunks until the browser refuses.

| | |
|---|---|
| the measured quota | **4,980,736 characters** (`QuotaExceededError` on the next chunk; the same figure in three consecutive runs) |
| fresh-city saves that fit | **10** |
| medium saves that fit | **8** |
| typical (large) saves that fit | **6** |
| **worst-case saves that fit** | **3** |

The quota is the one number here that belongs to a browser, not to the game:
this was Chromium on this machine, with this profile. Firefox and Safari
have their own budgets, so the row above must be re-measured there before it
is quoted anywhere else.

---

## 4. The options

None of these are implemented. They are here so that a future release can
choose with numbers instead of with a hunch.

### Option A — keep version 2 (what V7 does)

- **Saves:** 0 bytes.
- **Costs:** nothing. Every V5, V6 and V7 save keeps opening, forever. There
  is no migration to get wrong and no rollback to write.
- **Leaves:** the save at 1.34 MiB in the worst case, and 3 worst-case saves
  in the browser.

### Option B — re-encode the terrain (the literal `V7-KI-08` fix)

- **Would save:** **4,249 bytes** — the uint16 + base64 floor is 27,312 bytes
  against the JSON's 31,561. That is **0.30% of the worst save**, 0.55% of a
  typical one.
- **Would cost:** a schema version bump (v2 → v3) and a **migration for
  every save that has ever been written**. The migration must rebuild the
  three arrays exactly, or a player's terrain changes under them. The
  precision cost, measured: 0.000160 world units of height.
- **The rollback story:** there isn't one. `migrateRecord()` **refuses** a
  record from a newer build — *"the save uses format v3, this build reads
  v2"* — so a v3 save can never be opened by a v2 build. The v2 reader has
  to stay alive forever, and the v2→v3 migration has to be right on the
  first try, for every city anyone ever saved.
- **Verdict: 0.30% is not worth a one-way door.** The measured floor also
  says the "obvious" fix — base64 of the typed arrays — would make the save
  **17,599 bytes bigger**.

### Option C — re-encode the whole payload (a real binary format)

- **Could win:** up to the **976,694 bytes of scaffolding, 69.5% of the
  worst save** — and that is an *upper bound*, not an estimate. A realistic
  binary format would capture a fraction of it, because most of the
  scaffolding is the Map and array wrappers: the `instances` Map is **79.5%
  scaffolding** (465,745 of 585,668 bytes) and a median building instance is
  **287 bytes of which only 57 are data**.
- **Would cost:** the same v3 migration, the same one-way door, plus the
  whole format.
- **Verdict:** a project, not a patch. Not a V7 change, and not a V7.1 one.

### Option D — drop what the build can rebuild, without moving the schema

This is the one option the measurement actually points at, and it is
**not** a re-encoding: it removes bytes that are either **static** or
**derived**, and it does not need a version bump.

| what | bytes | share of the worst save | why it is droppable |
|---|---|---|---|
| `buildings.catalogue` | 173,180 | 12.32% | the same 115 definitions in **every** save; `BLD.init()` republishes them from the build's own table on every load and reset |
| `economy.constructions` | 240,502 | 17.12% | one record per building **ever placed**; a finished construction is never removed from the map |
| `mobility.network` | 143,501 | 10.21% | the road graph, rebuilt from the roads by `MOB.rebuildNetwork()` |
| `buildings.occupancy` | 22,834 | 1.63% | a cell → instance index, rebuilt from the instances |
| `economy.charged` | 8,844 | 0.63% | the set of already-charged building ids, derived from the ledger |
| **together** | **588,861** | **41.91%** | |

- **Would save:** up to **588,861 bytes — 41.9% of the worst save** — with
  **no migration**, because every one of these fields is *optional*: old saves
  that carry them still open (the loader reads them and discards what it
  rebuilds), and new saves that omit them still open (`restore()` copies only
  the keys a snapshot carries, `createState()` supplies the rest, and
  `isSnapshot()` requires only `meta.seed`).
- **Would cost:** this is real work in integrator-owned code
  (`core/state.js`, `core/save.js`) and in the domains that own the caches.
  **Whether each field is safe to omit was NOT verified here** — only the
  catalogue's rebuild path was traced end to end. An implementer has to
  check the construction-progress path in particular: a building that is
  still being constructed needs its progress record.
- **Verdict:** the best measured win available, and the right V8 candidate.

### The recommendation

**Keep version 2 in V7.** The decision was right, and the measurement makes
the reason precise: the terrain is 2.25% of the save and re-encoding it can
win 0.30%, while the format change costs a migration for every city anyone
has ever saved and a schema version that can never go back. Take **Option D**
to V8 as a measured, migration-free trim worth 41.9% of the worst save.

---

## 5. What stays the same

**The save schema does NOT move in V7.** `core/save.js` keeps `SAVE_VERSION
= 2`, `MIGRATIONS` keeps exactly its one `1 → 2` step, and this round changed
**no code at all** — `tools/save-size-report.mjs` writes to scratch slots and
reads them back, and `docs/v7/SAVE_SIZE.md` is a report.

Why, now that it is measured:

1. **The premise of `V7-KI-08` does not hold in V7.** The issue says the save
   is *"dominated by JSON-encoded terrain arrays"*. Measured, the terrain is
   **31,561 bytes = 2.25%** of the worst save; the save is dominated by the
   **building instances (41.7%)** and by the **JSON scaffolding (69.5%)**.
   The terrain is a *constant*: the same 31,561 bytes in a fresh city and in
   the largest city the game can hold.
2. **The obvious fix would make the file bigger.** Base64 of the typed arrays
   as they are is 49,160 bytes against the JSON's 31,561 — 55.8% worse. The
   terrain values are 14 distinct short decimals (the layer step is 1.5 world
   units), so the JSON encoding of this terrain is already cheaper than the
   binary it would replace.
3. **The best compact encoding wins 4,249 bytes — 0.30%.** That is the
   ceiling of the whole terrain argument, and it is not worth a migration for
   every city a player has ever saved.
4. **Moving the schema is a one-way door.** `migrateRecord()` refuses a
   record from a newer build, so a v3 save can never be read by a v2 build.
   The v2 reader would have to stay alive forever, and the v2 → v3 migration
   would have to be right on the first attempt, for everybody.
5. **There is no user-visible cost to leaving it.** The worst save the game
   can hold takes **50 ms to write and 87 ms to read**; three of them fit in
   the browser's measured `localStorage` quota.

`docs/v7/KNOWN_ISSUES.md` is not modified by this round, and `V7-KI-08`
stands as written. This document is the measurement behind it: the issue can
be re-worded to say what the save is *actually* dominated by, and this report
is where the numbers to re-word it with come from.

---

## 6. How it was measured

```
cd game && npm run build:cleared
node tools/save-size-report.mjs --port 4211
```

The tool serves the cleared build with `vite preview --port 4211
--strictPort`, drives it with the Chromium that `tools/playwright-resolve.mjs`
resolves, and does the work **inside the page**, against the live game:

- **The city is built through the game's own domain API** — `BLD.place()`,
  `MOB.addRoad()`, `ECO.earn()` — the same path `tools/profile-city.mjs` uses.
  The placement gate and the affordability gate are exercised exactly as a
  player's are. The construction windows are compressed with
  `ECO.setConstructionSpeed(6000)` so the slots free up; nothing else about
  the placement path is changed.
- **The size is the byte length of the exact record the game writes**:
  `JSON.stringify(ctx.core.save.buildRecord(state))` — the same bytes
  `saveToStorage()` writes into the slot and `exportSave()` downloads.
- **The times are medians of 5 samples** through `ctx.core.save`:
  `serialize()`, `saveToStorage()`, `loadFromStorage()`, `importSave()`.
- **The floors are computed from the live arrays**, not from a model of
  them: the base64 lengths are the real base64 of the real `ArrayBuffer`s,
  and the quantisation error is the real error against the real floats.
- **The data/scaffolding split is measured, not modelled**: every leaf value
  in the snapshot is counted in bytes, and everything left over — braces,
  commas, colons, quotes, key names and the Map/array wrappers — is
  scaffolding.
- **No console errors and no page errors** were raised during the run.

### How stable are these numbers?

The tool was run **three times** end to end. The payload sizes agree to
within 0.01% (the worst save: 1,404,881 / 1,404,885 / 1,405,068 bytes — the
spread is the `ui` toast list, which holds whatever notices the city happened
to raise, and the exact moment the population derived). The timings vary by
up to ~15% on the maximum city (the serialize measurement came out at 34.0,
34.1 and 38.8 ms), which is why every time here is a median of five samples
and why the conclusions are drawn from the sizes, not from the milliseconds.

### The limits of this measurement

- **One seed** (`20261023`) and one building type (`res.house`, a 1×1
  footprint) plus a fixed service set. The terrain numbers are the terrain
  of that seed. A different seed has different terrain but the same shape of
  numbers, because the values come from the same 14 terrain layers.
- **The maximum city is the byte-worst city.** Every per-building cost
  (the instance, the construction record, the occupancy entry, the charged
  id) is charged *per building*, so filling the grid with the **smallest**
  building maximises the save. A city of 3×3 towers would have far fewer
  buildings and a smaller save. In the measured run every buildable cell in
  the inner 62 × 62 region carried a building or a road, 39 scenery
  placements survived, and the remaining cells are water.
- **The quota is a browser number, not a game number.** It was measured in
  Chromium on this machine and must be re-measured elsewhere.
- **The residents are counters, not entities.** The save carries
  `population.total` and friends; the 40 rendered citizens are not in the
  save at all (`population` is 569 bytes in the worst save). A city with
  56,844 residents saves the same as one with 1,000, apart from the number
  in `meta`.

---

*Cross-references: `docs/v7/KNOWN_ISSUES.md` §V7-KI-08 ·
`docs/v7/PERFORMANCE_REPORT.md` (the frame-time side of the same city) ·
`tools/save-size-report.mjs` (the tool that produced every number above).*
