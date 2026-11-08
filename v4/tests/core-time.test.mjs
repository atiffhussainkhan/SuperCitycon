/**
 * Clock and profiler unit tests — the fixed step, delta clamping, pause and
 * the measured frame-time statistics.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createClock, createProfiler } from '../src/core/time.js';

test('the clock produces one fixed step per 1/60s of time', () => {
  const clock = createClock({ fixedStep: 1 / 60 });

  const first = clock.tick(0);
  assert.equal(first.delta, 0);
  assert.equal(first.steps, 0);

  const second = clock.tick(1000 / 60);
  assert.ok(Math.abs(second.delta - 1 / 60) < 1e-9);
  assert.equal(second.steps, 1);

  const third = clock.tick(2000 / 60);
  assert.equal(third.steps, 1);
  assert.equal(third.frame, 3);
});

test('a long frame is clamped so the world does not teleport', () => {
  const clock = createClock({ fixedStep: 1 / 60 });
  clock.tick(0);
  const stalled = clock.tick(60_000);
  assert.equal(stalled.delta, 0.25);
  assert.equal(stalled.steps, 5, 'the sub-step budget is capped');
});

test('the sub-step budget is capped and the accumulator is dropped', () => {
  const clock = createClock({ fixedStep: 1 / 60, maxSubSteps: 3 });
  clock.tick(0);
  const result = clock.tick(1000);
  assert.equal(result.steps, 3);
  const next = clock.tick(1010);
  assert.equal(next.steps, 0, 'the backlog was discarded instead of spiralling');
});

test('the alpha is the fraction of a step left over', () => {
  const clock = createClock({ fixedStep: 0.1 });
  clock.tick(0);
  const result = clock.tick(50);
  assert.equal(result.steps, 0);
  assert.ok(Math.abs(result.alpha - 0.5) < 1e-9);
});

test('a paused clock does not advance time or produce steps', () => {
  const clock = createClock({ fixedStep: 1 / 60 });
  clock.tick(0);
  clock.tick(1000 / 60);
  const elapsed = clock.elapsed;
  assert.ok(elapsed > 0);

  clock.paused = true;
  assert.equal(clock.paused, true);
  const result = clock.tick(2000 / 60);
  assert.equal(result.steps, 0);
  assert.equal(clock.elapsed, elapsed, 'elapsed time does not move while paused');
});

test('reset puts the clock back to zero', () => {
  const clock = createClock();
  clock.tick(0);
  clock.tick(100);
  clock.reset();
  assert.equal(clock.elapsed, 0);
  assert.equal(clock.frame, 0);
});

test('the profiler reports nothing before it has samples', () => {
  const profiler = createProfiler();
  const stats = profiler.stats();
  assert.equal(stats.frames, 0);
  assert.equal(stats.fps, 0);
  assert.equal(stats.medianMs, 0);
  assert.equal(stats.p95Ms, 0);
});

test('the profiler computes fps, median and p95 from the samples it took', () => {
  const profiler = createProfiler();
  const durations = [10, 20, 30, 40, 50];
  durations.forEach((ms, index) => {
    profiler.beginFrame(index * 100);
    profiler.endFrame(index * 100 + ms);
  });

  const stats = profiler.stats();
  assert.equal(stats.frames, 5);
  assert.equal(stats.medianMs, 30);
  assert.equal(stats.p95Ms, 50);
  assert.equal(stats.maxMs, 50);
  assert.equal(stats.frameMs, 30);
  assert.equal(stats.fps, 33.3, 'five 10ms-frames-worth of samples at 30ms average is 33.3fps');
});

test('the profiler keeps only the most recent samples', () => {
  const profiler = createProfiler({ sampleLimit: 3 });
  for (let i = 0; i < 5; i += 1) {
    profiler.beginFrame(i * 10);
    profiler.endFrame(i * 10 + 5);
  }
  assert.equal(profiler.samples().length, 3);
  assert.equal(profiler.stats().frames, 3);
});

test('the profiler carries the renderer counters through', () => {
  const profiler = createProfiler();
  profiler.beginFrame(0);
  profiler.endFrame(16, { drawCalls: 42, triangles: 1234, memoryMb: 8 });
  const stats = profiler.stats();
  assert.equal(stats.drawCalls, 42);
  assert.equal(stats.triangles, 1234);
  assert.equal(stats.memoryMb, 8);
});

test('reset clears the profiler samples', () => {
  const profiler = createProfiler();
  profiler.beginFrame(0);
  profiler.endFrame(16);
  profiler.reset();
  assert.equal(profiler.samples().length, 0);
});
