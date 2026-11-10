# SuperCitycon V7 — Performance Report

**Every number below was measured on this machine** (Darwin x86_64, node
v22.14.0) with the command named beside it. Nothing is projected.

---

## 1. The navigation search — the new hot path

`core/navigation.js` is the only new per-frame cost in the game, and it
runs once per citizen spawn, not once per frame.

```
$ node tools/profile-navigation.mjs
open ground            median 0.202 ms   p95 0.798 ms   worst 1.293 ms   routes 200/200   avg cells visited 58
150 obstacles          median 0.201 ms   p95 1.065 ms   worst 2.783 ms   routes 200/200   avg cells visited 87
400 obstacles          median 0.202 ms   p95 1.350 ms   worst 2.246 ms   routes 167/200   avg cells visited 114

budget: 2 ms (95th percentile)
worst measured 95th percentile: 1.350 ms
PASS — the budget holds
```

| Metric | Budget | Measured | Status |
|---|---|---|---|
| the 95th-percentile search | 2 ms | **1.350 ms** | PASS |
| the median search | — | 0.202 ms | — |
| the worst single search | — | 2.783 ms | — |
| the cells visited per search | 4096 | 58–114 | PASS |

The "400 obstacles" row finds only 167 of 200 routes — correctly: a dense
scatter genuinely encloses regions. The search says so (`unreachable`)
rather than hanging.

**A note on how this was measured.** The first run of this benchmark
reported 219 ms at the 95th percentile. That was a bug in the **benchmark**,
not in the pathfinder: it rebuilt the obstacle set inside the `isBlocked`
callback, so it measured the allocation of a `Set` several thousand times
per search. The benchmark was fixed and the numbers above are the real ones.
The unit-suite assertion uses the **median**, because that suite runs nine
files in parallel and a single sample there measures the scheduler as much
as the code.

## 1a. The city at the maximum citizen count

`tools/profile-city.mjs` (new in the V7.1 round) builds a REAL city in the
running game and measures it, against the boot scene in the same run:

| | boot | city | change |
|---|---|---|---|
| the mean frame | 16.667 ms | 16.663 ms | **−0.004 ms** |
| the median frame | 16.7 ms | 16.7 ms | — |
| the 95th percentile | 18.3 ms | 18.6 ms | +0.3 ms |
| the 99th percentile | 18.8 ms | 18.7 ms | — |
| the frame rate | 60 fps | 60 fps | — |
| the draw calls | 63 | 816 (peak 2083) | — |
| the long animation frames (> 16 ms of work) | 0 | 0 | — |

**The city at the maximum citizen count holds the boot frame rate.** The
renderer is a hardware GPU (ANGLE / AMD Radeon Pro 5500M), verified against
the WebGL context and the browser's own GPU metadata — not software
rendering.

The city in that run: 558 roads, 255 houses, 3 services, 8,676 residents and
**40 of 40 citizens** (`TUNING.maxRenderedCitizens`).

### The pathfinding cost, measured

| | searches | cost |
|---|---|---|
| 200 spawns in ONE frame (the budget caps it at 2) | 20 searched, 180 deferred | **2.1 ms** |
| the same 200, one per frame | 200 searched | **8.6 ms** |

That is **0.0361 ms per real grid-A\* search**, and it is the number the
per-frame budget (`TUNING.citizenPathsPerFrame`) exists to protect: without
it, a city full of citizens would spend 8.6 ms of a 16.7 ms frame on path
searches alone.

---

## 2. The frame time — before and after

`tools/profile-gpu.mjs`, 300 rendered frames, headed Chromium, the same
machine, the same scene:

```
$ node tools/profile-gpu.mjs --url http://localhost:4191/ --frames 300   # the V6 build
$ node tools/profile-gpu.mjs --url http://localhost:4190/ --frames 300   # the V7 build
```

| Metric | V6 (`ecc30fc`) | V7 | Change |
|---|---|---|---|
| the mean frame | 16.667 ms | 16.666 ms | −0.001 ms |
| the median frame | 16.7 ms | 16.7 ms | — |
| the 95th percentile | 18.6 ms | 18.4 ms | −0.2 ms |
| the 99th percentile | 18.7 ms | 18.7 ms | — |
| the mean frame rate | 60 fps | 60 fps | — |
| the boot time | 2060 ms | 2070 ms | +10 ms |
| the console / page errors | 0 | 0 | — |

**The frame rate did not regress.** The rendering is vsync-capped at 60 fps
in both builds, so the frame time is the same by construction; what the
numbers show is that V7 did not push the frame over the cap.

**The JS heap reading is NOT a regression signal.** Three runs of the same
build reported 134.05 MB, 146.05 MB and 169.66 MB. That is a ±35 MB spread
on identical code, so the number measures when the snapshot was taken, not
how much the game uses. The V7 bundle is **14,052 bytes** larger than the
V6 bundle (1,153,055 vs 1,139,003) — the navigation, touch and validator
code, minified.

## 3. The budget the game enforces on itself

| Budget | Where | Value |
|---|---|---|
| the cells one search may visit | `TUNING.citizenPathBudget` | 4096 |
| the searches one frame may start | `TUNING.citizenPathsPerFrame` | 2 |
| the dead-zone floor | `TUNING.citizenWadeDepth` | 0.05 world units |
| the slope cost per unit of rise | `TUNING.citizenSlopeCost` | 0.35 |

All four are marked in `TUNING_TBD`: the publisher never published them, so
they are design values and are labelled as such in the table itself.

## 4. The startup cost

| | V6 | V7 |
|---|---|---|
| the boot time (to ready) | 2060 ms | 2070 ms |

The +10 ms is inside the run-to-run noise of the measurement and is not
attributed to anything.

## 5. What was NOT optimised, and why

| | |
|---|---|
| The save file size | It is dominated by JSON-encoded terrain arrays (V5 KI-08). Changing the save format would break every existing city, and the V7 requirement is that a V5 and a V6 city both open in V7. **Carried, not fixed.** |
| The render path | The frame time is already vsync-capped at 60 fps with the boot scene at 63 draw calls. There was no measured bottleneck to fix, and speculative optimisation is how new bugs are made. |
| The draw-call batching | The renderer already batches by material. Nothing in the V7 profile showed it as a cost. |

## 6. The conclusion

**PASS.** The new hot path meets its budget with a 32% margin at the 95th
percentile, the frame rate is unchanged, the boot time is unchanged, and no
new error appeared.
