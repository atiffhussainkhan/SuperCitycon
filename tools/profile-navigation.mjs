#!/usr/bin/env node
/**
 * tools/profile-navigation.mjs — the V7 navigation benchmark.
 *
 * Run it ALONE, on a quiet machine:
 *   node tools/profile-navigation.mjs
 *
 * The unit suite runs in parallel with everything else, so a timing
 * assertion inside it measures the scheduler as much as the code. This
 * script measures the real numbers: the median, the 95th percentile and the
 * worst case, over the real 64 x 64 city grid with a realistic obstacle
 * scatter.
 *
 * The numbers it prints are the ones recorded in
 * `docs/v7/PERFORMANCE_REPORT.md`.
 */
import { createGrid, findPath } from '../game/src/core/navigation.js';

const SIZE = 64;

/**
 * A seeded scatter of obstacles — the same generator the unit test uses.
 */
function scatter(count, seed) {
  let s = seed;
  const next = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const blocked = new Set();
  for (let i = 0; i < count; i += 1) {
    blocked.add(`${Math.floor(next() * SIZE)},${Math.floor(next() * SIZE)}`);
  }
  return blocked;
}

/**
 * Run `runs` searches and report the distribution.
 */
function measure(label, grid, runs = 200) {
  // Warm up.
  for (let i = 0; i < 10; i += 1) findPath(grid, { x: 1, z: 1 }, { x: 60, z: 60 });

  const samples = [];
  let succeeded = 0;
  let visited = 0;
  for (let i = 0; i < runs; i += 1) {
    const from = { x: (i * 3) % SIZE, z: (i * 5) % SIZE };
    const to = { x: SIZE - 1 - ((i * 2) % SIZE), z: SIZE - 1 - ((i * 4) % SIZE) };
    const t0 = process.hrtime.bigint();
    const result = findPath(grid, from, to);
    const t1 = process.hrtime.bigint();
    samples.push(Number(t1 - t0) / 1e6);
    visited += result.visited;
    if (result.ok) succeeded += 1;
  }
  samples.sort((a, b) => a - b);
  const at = (q) => samples[Math.min(samples.length - 1, Math.floor(samples.length * q))];
  const out = {
    label,
    runs,
    succeeded,
    median: at(0.5),
    p95: at(0.95),
    worst: samples[samples.length - 1],
    averageVisited: visited / runs,
  };
  console.log(
    `${label.padEnd(22)} median ${out.median.toFixed(3)} ms   p95 ${out.p95.toFixed(3)} ms   `
    + `worst ${out.worst.toFixed(3)} ms   routes ${succeeded}/${runs}   `
    + `avg cells visited ${out.averageVisited.toFixed(0)}`,
  );
  return out;
}

const empty = createGrid({ size: SIZE });
// The scatter is built ONCE. Rebuilding it inside the callback would
// measure the allocation of a Set, not the pathfinder.
const lightBlocked = scatter(150, 123456789);
const heavyBlocked = scatter(400, 987654321);
const light = createGrid({ size: SIZE, isBlocked: (x, z) => lightBlocked.has(`${x},${z}`) });
const heavy = createGrid({ size: SIZE, isBlocked: (x, z) => heavyBlocked.has(`${x},${z}`) });

const results = [
  measure('open ground', empty),
  measure('150 obstacles', light),
  measure('400 obstacles', heavy),
];

const budget = 2;
const worst = Math.max(...results.map((r) => r.p95));
console.log('');
console.log(`budget: ${budget} ms (95th percentile)`);
console.log(`worst measured 95th percentile: ${worst.toFixed(3)} ms`);
console.log(worst < budget ? 'PASS — the budget holds' : 'FAIL — the budget is exceeded');

process.exit(worst < budget ? 0 : 1);
