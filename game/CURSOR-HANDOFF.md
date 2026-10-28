# CURSOR-HANDOFF.md — SuperCitycon senior review

**Status: Awaiting Cursor review.**

## Why this file exists

The standing project standard requires a Cursor senior-review pass on every
task. The Cursor CLI is present and working:

```
/Applications/Cursor.app/Contents/Resources/app/bin/cursor agent --print --trust --model <model> --mode ask "<prompt>"
```

but every **named** model is refused by the account:

```
$ cursor agent status
ActionRequiredError: Increase limits for faster responses You're out of usage.
Switch to Auto, or ask your admin to increase your limit to continue.

$ cursor agent models
ActionRequiredError: Increase limits for faster responses You're out of usage.
```

This is an account-level usage cap, not a configuration problem, and it must
not be worked around. **However, `--model auto` is not capped** and does work —
the ECO/MOB domain agent ran two full Cursor review rounds with it
(`cursor agent --print --trust --model auto --mode ask`) and it caught real
defects that were then fixed. Run the pass below with `--model auto` if the
named models are still refused.

## The review prompt to run

Run this from the workspace root
(`/Users/mac/.minimax/sessions/mvs_be813ca06b864c7390e5996b68d3db8f/workspace`):

```bash
cursor agent --print --trust --model auto --mode ask "$(cat game/CURSOR-REVIEW-PROMPT.md)"
```

`game/CURSOR-REVIEW-PROMPT.md` is the full brief: the request, the acceptance
criteria, the architecture, the file map, the known issues, and the exact
questions the reviewer should answer.

## What has already been reviewed (and fixed)

The ECO/MOB agent ran two Cursor rounds during implementation. Cursor found
and the agent fixed:

- a duplicate `MONEY_CHANGED` event per settlement;
- a residential-income overcount (the city was taxed for more residents than
  it had);
- a `tripCells` value that shrank, making the average commute wrong;
- traffic advancing only one cell per tick;
- a pole-barn gate that silenced energy and water producers;
- un-flagged magic numbers in the voxel economic-impact model;
- an O(N×E) bonus scan (172 ms → 6 ms for a 5,000-building city);
- a double `ROAD_NETWORK_CHANGED` emission;
- per-frame `TRAFFIC_CHANGED` emissions;
- an async model race where a late-loading road model overwrote a newer one.

## What still needs the review

The parts Cursor has **not** seen:

- the assembled ten-domain game (only ECO and MOB were reviewed in isolation);
- `src/main.js` — the boot path, the frame loop, the input dispatch, the
  `ctx.state` liveness fix;
- the UX/STD domains and the SCC Studio voxel editor;
- the WLD terrain and scatter batching;
- the BLD catalogue and the infrastructure category;
- the production build and the integration test suite;
- the asset manifests and the licence handling.

## Independent review performed instead

While Cursor was capped, an independent `verifier` agent was run against the
assembled game. Its findings are recorded in `game/DEFECTS.md` and the
integration defect log at the workspace root. That review found eight real
defects (a scenery blocker that made the map unbuildable, a terrain grid
artefact, a sky-coloured rock palette, diagonal terrain banding, a floating map
edge, 748 draw calls, a missing road catalogue category, and the Cursor quota
block itself). It is **not** a substitute for the Cursor pass — it is an
independent check, and the Cursor pass is still required.
