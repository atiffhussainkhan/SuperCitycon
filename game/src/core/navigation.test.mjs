/**
 * core/navigation.test.mjs — the pathfinder.
 *
 * OWNER: the integrator (core/). Run with:  node --test src/core/navigation.test.mjs
 *
 * WHAT IS COVERED
 *   - the straight path across open ground;
 *   - the detour around a wall (the citizen must NOT walk through it);
 *   - the water block;
 *   - no corner cutting;
 *   - the node budget (a walled-off goal returns, it does not hang);
 *   - DETERMINISM — the same call gives the same path, every time;
 *   - the path smoothing;
 *   - the obstacle model built from a live city;
 *   - the cost of a slope;
 *   - the performance budget.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NAV_BUDGET,
  createCityGrid,
  createGrid,
  findPath,
  lineIsClear,
  octile,
  smoothPath,
} from './navigation.js';

/**
 * A grid with a rectangular wall in it.
 *
 * @param {object} [opts]
 */
function walledGrid({ size = 16, wall = { x: 8, z: 0, w: 1, h: 16 }, cost = null } = {}) {
  const blocked = new Set();
  for (let z = wall.z; z < wall.z + wall.h; z += 1) {
    for (let x = wall.x; x < wall.x + wall.w; x += 1) {
      blocked.add(`${x},${z}`);
    }
  }
  return createGrid({
    size,
    isBlocked: (x, z) => blocked.has(`${x},${z}`),
    cost,
  });
}

/** Is the path free of blocked cells? */
function pathIsClear(grid, path) {
  return path.every((cell) => !grid.isBlocked(cell.x, cell.z));
}

test('navigation: the heuristic is the octile distance', () => {
  assert.equal(octile({ x: 0, z: 0 }, { x: 3, z: 0 }), 3);
  assert.equal(octile({ x: 0, z: 0 }, { x: 0, z: 4 }), 4);
  assert.equal(octile({ x: 0, z: 0 }, { x: 3, z: 3 }), 3 * Math.SQRT2);
  assert.equal(octile({ x: 0, z: 0 }, { x: 0, z: 0 }), 0);
});

test('navigation: a straight path crosses open ground', () => {
  const grid = createGrid({ size: 16 });
  const result = findPath(grid, { x: 2, z: 2 }, { x: 6, z: 2 });
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'found');
  assert.equal(result.path[0].x, 2);
  assert.equal(result.path[0].z, 2);
  assert.equal(result.path[result.path.length - 1].x, 6);
  assert.equal(result.path[result.path.length - 1].z, 2);
});

test('navigation: the start and the goal being the same cell is trivial', () => {
  const grid = createGrid({ size: 16 });
  const result = findPath(grid, { x: 3, z: 3 }, { x: 3, z: 3 });
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'trivial');
  assert.equal(result.path.length, 1);
});

test('navigation: a citizen walks AROUND a wall, never through it', () => {
  // The wall stops short of both edges, so there IS a way round.
  const grid = walledGrid({ wall: { x: 8, z: 1, w: 1, h: 14 } });
  const result = findPath(grid, { x: 2, z: 8 }, { x: 13, z: 8 });
  assert.equal(result.ok, true, 'a route exists around the wall');
  assert.ok(pathIsClear(grid, result.path), 'the path never enters a blocked cell');

  // It must actually go around: some cell of the path has to be on the
  // far side of the wall from the start.
  const crossedWall = result.path.some((cell) => cell.x > 8);
  assert.ok(crossedWall, 'the path reached the far side');
});

test('navigation: a wall that reaches the edge of the grid is impassable', () => {
  const grid = walledGrid({ wall: { x: 8, z: 0, w: 1, h: 16 } });
  const result = findPath(grid, { x: 2, z: 8 }, { x: 13, z: 8 });
  assert.equal(result.ok, false, 'the goal is walled off');
  assert.equal(result.reason, 'unreachable');
});

test('navigation: the search respects a wall with a gap in it', () => {
  const blocked = new Set();
  for (let z = 0; z < 16; z += 1) {
    if (z === 8) continue;              // the gap
    blocked.add(`8,${z}`);
  }
  const grid = createGrid({ size: 16, isBlocked: (x, z) => blocked.has(`${x},${z}`) });
  const result = findPath(grid, { x: 2, z: 8 }, { x: 13, z: 8 });
  assert.equal(result.ok, true);
  assert.ok(result.path.some((cell) => cell.x === 8 && cell.z === 8), 'the path goes through the gap');
});

test('navigation: water blocks a cell', () => {
  const water = new Set(['5,5', '5,6', '5,7', '6,5', '7,5']);
  const grid = createGrid({ size: 16, isBlocked: (x, z) => water.has(`${x},${z}`) });
  const result = findPath(grid, { x: 3, z: 6 }, { x: 9, z: 6 });
  assert.equal(result.ok, true);
  assert.ok(pathIsClear(grid, result.path), 'the path stays out of the water');
});

test('navigation: a citizen cannot cut a corner between two blocked cells', () => {
  // A diagonal gap between two blocked cells: 5,5 and 6,6 are free,
  // 5,6 and 6,5 are blocked.
  const blocked = new Set(['5,6', '6,5']);
  const grid = createGrid({ size: 16, isBlocked: (x, z) => blocked.has(`${x},${z}`) });
  const result = findPath(grid, { x: 4, z: 5 }, { x: 7, z: 6 });
  assert.equal(result.ok, true);
  // The direct diagonal step 5,5 -> 6,6 would cut the corner.
  const cuts = result.path.some((cell, i) => i > 0
    && result.path[i - 1].x === 5 && result.path[i - 1].z === 5
    && cell.x === 6 && cell.z === 6);
  assert.equal(cuts, false, 'the path does not slip through the corner');
});

test('navigation: a blocked goal is reported as such', () => {
  const grid = createGrid({ size: 16, isBlocked: (x, z) => x === 9 && z === 9 });
  const result = findPath(grid, { x: 2, z: 2 }, { x: 9, z: 9 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'blocked-goal');
});

test('navigation: a goal outside the grid is refused', () => {
  const grid = createGrid({ size: 16 });
  const result = findPath(grid, { x: 2, z: 2 }, { x: 99, z: 2 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'out-of-bounds');
});

test('navigation: the search stops at its budget and returns the best it found', () => {
  const grid = walledGrid();
  const result = findPath(grid, { x: 2, z: 8 }, { x: 13, z: 8 }, { budget: 5 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'budget');
  assert.ok(result.visited <= 5, `the budget was respected (visited ${result.visited})`);
  assert.ok(result.path && result.path.length > 0, 'the partial path is returned');
  assert.equal(result.path[0].x, 2, 'and it starts at the origin');
});

test('navigation: the default budget is the published one', () => {
  assert.equal(NAV_BUDGET, 4096);
  const grid = createGrid({ size: 64 });
  const result = findPath(grid, { x: 0, z: 0 }, { x: 63, z: 63 });
  assert.equal(result.ok, true);
  assert.ok(result.visited <= NAV_BUDGET);
});

test('navigation: the search is DETERMINISTIC', () => {
  const grid = walledGrid();
  const first = findPath(grid, { x: 2, z: 8 }, { x: 13, z: 8 });
  for (let i = 0; i < 100; i += 1) {
    const again = findPath(grid, { x: 2, z: 8 }, { x: 13, z: 8 });
    assert.deepEqual(again.path, first.path, `run ${i} gave a different path`);
    assert.equal(again.cost, first.cost);
  }
});

test('navigation: the same world always gives the same path', () => {
  const grid = createGrid({
    size: 16,
    isBlocked: (x, z) => (x + z) % 5 === 0,
  });
  const first = findPath(grid, { x: 1, z: 1 }, { x: 14, z: 14 });
  for (let i = 0; i < 25; i += 1) {
    const again = findPath(grid, { x: 1, z: 1 }, { x: 14, z: 14 });
    assert.deepEqual(again.path, first.path);
  }
});

test('navigation: a costly cell is avoided when there is a cheaper way round', () => {
  const expensive = new Set(['5,8', '6,8', '7,8']);
  const grid = createGrid({
    size: 16,
    isBlocked: () => false,
    cost: (x, z) => (expensive.has(`${x},${z}`) ? 50 : 1),
  });
  const result = findPath(grid, { x: 2, z: 8 }, { x: 11, z: 8 });
  assert.equal(result.ok, true);
  const wentThrough = result.path.some((cell) => expensive.has(`${cell.x},${cell.z}`));
  assert.equal(wentThrough, false, 'the expensive cells were avoided');
});

test('navigation: the smoothing removes the cells between two turns', () => {
  const grid = createGrid({ size: 16 });
  const raw = findPath(grid, { x: 2, z: 2 }, { x: 10, z: 2 });
  const smoothed = smoothPath(raw.path, (x, z) => grid.isBlocked(x, z));
  assert.ok(smoothed.length <= raw.path.length, 'the smoothing never makes the path longer');
  assert.equal(smoothed[0].x, 2);
  assert.equal(smoothed[smoothed.length - 1].x, 10);
  assert.equal(smoothed[smoothed.length - 1].z, 2);
});

test('navigation: the smoothing keeps a waypoint where the path turns', () => {
  const grid = walledGrid({ wall: { x: 8, z: 1, w: 1, h: 14 } });
  const raw = findPath(grid, { x: 2, z: 8 }, { x: 13, z: 8 });
  const smoothed = smoothPath(raw.path, (x, z) => grid.isBlocked(x, z));
  assert.ok(smoothed.length >= 3, 'a detour keeps its turning point');
  assert.ok(pathIsClear(grid, smoothed), 'and the smoothed path is still clear');
});

test('navigation: the line test sees a wall it passes through', () => {
  const blocked = new Set(['3,0', '3,1', '3,2']);
  const isBlocked = (x, z) => blocked.has(`${x},${z}`);
  assert.equal(lineIsClear({ x: 0, z: 1 }, { x: 6, z: 1 }, isBlocked), false);
  assert.equal(lineIsClear({ x: 0, z: 8 }, { x: 6, z: 8 }, isBlocked), true);
});

test('navigation: the smoothing of a short path changes nothing', () => {
  assert.deepEqual(smoothPath([{ x: 1, z: 1 }], () => false), [{ x: 1, z: 1 }]);
  assert.deepEqual(smoothPath([{ x: 1, z: 1 }, { x: 2, z: 2 }], () => false), [{ x: 1, z: 1 }, { x: 2, z: 2 }]);
  assert.deepEqual(smoothPath(null, () => false), []);
});

// ---------------------------------------------------------------------------
// The obstacle model built from a live city
// ---------------------------------------------------------------------------

/**
 * A context with a small city: a heightmap, a water map and some buildings.
 */
function makeCity({ size = 16, heights = null, water = null, buildings = [] } = {}) {
  const heightmap = new Float32Array(size * size);
  if (heights) {
    for (const [x, z, h] of heights) heightmap[(z * size) + x] = h;
  }
  const waterMap = new Float32Array(size * size);
  if (water) {
    for (const [x, z, d] of water) waterMap[(z * size) + x] = d;
  }
  const instances = new Map();
  for (const [i, b] of buildings.entries()) {
    instances.set(`b${i}`, { id: `b${i}`, type: 'res.house', x: b.x, z: b.z, rot: 0, level: 1 });
  }
  return {
    config: { GRID: { size, cell: 4 } },
    state: {
      world: { heightmap, water: waterMap, types: new Uint8Array(size * size), waterLevel: 0 },
      buildings: { instances },
    },
  };
}

test('navigation: a building blocks its cell in the city grid', () => {
  const ctx = makeCity({ buildings: [{ x: 5, z: 5 }] });
  const grid = createCityGrid(ctx);
  assert.equal(grid.isBlocked(5, 5), true, 'the building blocks');
  assert.equal(grid.isBlocked(6, 5), false, 'the street beside it does not');
});

test('navigation: deep water blocks a cell in the city grid', () => {
  const ctx = makeCity({ water: [[5, 5, 1.5]] });
  const grid = createCityGrid(ctx);
  assert.equal(grid.isBlocked(5, 5), true, 'the flood blocks');
});

test('navigation: a film of water does not block a cell', () => {
  const ctx = makeCity({ water: [[5, 5, 0.01]] });
  const grid = createCityGrid(ctx);
  assert.equal(grid.isBlocked(5, 5), false, 'a puddle is walkable');
});

test('navigation: a slope costs more than a flat street', () => {
  const ctx = makeCity({ heights: [[5, 5, 0], [6, 5, 8]] });
  const grid = createCityGrid(ctx);
  const flat = grid.cost(1, 1);
  const steep = grid.cost(5, 5);
  assert.ok(steep > flat, `a slope (${steep}) costs more than a flat street (${flat})`);
});

test('navigation: the city grid routes a citizen around a building', () => {
  const size = 16;
  const buildings = [];
  // A wall of buildings that stops short of both edges.
  for (let z = 1; z < size - 1; z += 1) buildings.push({ x: 8, z });
  const ctx = makeCity({ size, buildings });
  const grid = createCityGrid(ctx);
  const result = findPath(grid, { x: 2, z: 8 }, { x: 13, z: 8 });
  assert.equal(result.ok, true);
  assert.ok(pathIsClear(grid, result.path), 'the citizen does not walk through the building');
});

test('navigation: the city grid reflects a building placed after it was built', () => {
  const ctx = makeCity();
  const grid = createCityGrid(ctx);
  assert.equal(grid.isBlocked(5, 5), false);
  // The player places a building.
  ctx.state.buildings.instances.set('b9', { id: 'b9', type: 'res.house', x: 5, z: 5, rot: 0, level: 1 });
  // The grid is a VIEW over the live city, not a copy of it, so it sees
  // the building immediately — no rebuild, no stale routes.
  assert.equal(grid.isBlocked(5, 5), true, 'the new building blocks');
});

// ---------------------------------------------------------------------------
// The performance budget (V7-NFR-001)
// ---------------------------------------------------------------------------

test('navigation: a search over the whole city grid is fast enough for a frame', () => {
  const size = 64;
  // A seeded scatter of obstacles. A scatter is used rather than a linear
  // pattern on purpose: a diagonal line of blocked cells is an IMPASSABLE
  // wall (no corner cutting), which would seal a region off.
  let seed = 123456789;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const blocked = new Set();
  for (let i = 0; i < 150; i += 1) {
    blocked.add(`${Math.floor(next() * size)},${Math.floor(next() * size)}`);
  }
  const grid = createGrid({ size, isBlocked: (x, z) => blocked.has(`${x},${z}`) });

  // Warm up, so the first search does not pay for the JIT.
  for (let i = 0; i < 5; i += 1) findPath(grid, { x: 1, z: 1 }, { x: 60, z: 60 });

  const samples = [];
  let succeeded = 0;
  for (let i = 0; i < 40; i += 1) {
    const from = { x: (i * 3) % size, z: (i * 5) % size };
    const to = { x: size - 1 - ((i * 2) % size), z: size - 1 - ((i * 4) % size) };
    const t0 = process.hrtime.bigint();
    const result = findPath(grid, from, to);
    const t1 = process.hrtime.bigint();
    samples.push(Number(t1 - t0) / 1e6);
    if (result.ok) succeeded += 1;
  }
  assert.ok(succeeded >= 36, `${succeeded}/40 searches found a route`);

  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length * 0.5)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  // The MEDIAN is the assertion, not the 95th percentile: this suite runs
  // in parallel with the rest of the test suite, so a single sample can be
  // stretched by another process and would make the check flaky. The real
  // 95th percentile is measured on a quiet machine by
  // `tools/profile-navigation.mjs`, and that number is the one recorded in
  // docs/v7/PERFORMANCE_REPORT.md.
  assert.ok(median < 2, `the median search was ${median.toFixed(3)} ms (budget 2 ms, p95 ${p95.toFixed(3)} ms)`);
});
