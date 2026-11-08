/**
 * V4 — Clock and profiler.
 *
 * The clock gives the runtime a fixed simulation step (so physics is
 * deterministic and reproducible) while the renderer runs as fast as it can.
 * The profiler records the frame-time distribution and the renderer's own
 * counters, and keeps a bounded history so the HUD can show real numbers.
 */

export function createClock({ fixedStep = 1 / 60, maxSubSteps = 5 } = {}) {
  let last = null;
  let accumulator = 0;
  let elapsed = 0;
  let frame = 0;
  let paused = false;

  return {
    fixedStep,
    maxSubSteps,
    get elapsed() { return elapsed; },
    get frame() { return frame; },
    get paused() { return paused; },
    set paused(v) { paused = !!v; accumulator = 0; last = null; },

    /**
     * Advance the clock.
     * @returns {{delta:number, alpha:number, steps:number, frame:number}}
     */
    tick(now = performance.now()) {
      if (last === null) last = now;
      const raw = (now - last) / 1000;
      last = now;
      const delta = Math.min(raw, 0.25); // a stalled tab must not teleport the world
      frame += 1;
      if (!paused) {
        accumulator += delta;
        elapsed += delta;
      }
      let steps = 0;
      while (accumulator >= fixedStep && steps < maxSubSteps) {
        accumulator -= fixedStep;
        steps += 1;
      }
      if (steps === maxSubSteps) accumulator = 0; // give up on catching up
      return { delta, alpha: accumulator / fixedStep, steps, frame };
    },

    reset() { last = null; accumulator = 0; elapsed = 0; frame = 0; },
  };
}

/**
 * Frame-time profiler with a bounded ring buffer.
 *
 * `stats()` returns measured values only — never a modelled or target figure.
 */
export function createProfiler({ sampleLimit = 240 } = {}) {
  const samples = [];
  let frameStart = 0;
  let lastRender = null;

  const profiler = {
    beginFrame(now = performance.now()) { frameStart = now; },

    endFrame(now = performance.now(), rendererStats = null) {
      const ms = now - frameStart;
      samples.push(ms);
      if (samples.length > sampleLimit) samples.shift();
      lastRender = rendererStats;
      return ms;
    },

    /** Measured statistics over the retained samples. */
    stats() {
      if (!samples.length) {
        return { frames: 0, fps: 0, frameMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, drawCalls: 0, triangles: 0, memoryMb: 0 };
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      const total = samples.reduce((a, b) => a + b, 0);
      const fps = total > 0 ? (samples.length / (total / 1000)) : 0;
      return {
        frames: samples.length,
        fps: Number(fps.toFixed(1)),
        frameMs: Number((samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(2)),
        medianMs: Number(median.toFixed(2)),
        p95Ms: Number(p95.toFixed(2)),
        maxMs: Number(sorted[sorted.length - 1].toFixed(2)),
        drawCalls: lastRender?.drawCalls ?? 0,
        triangles: lastRender?.triangles ?? 0,
        memoryMb: lastRender?.memoryMb ?? 0,
      };
    },

    samples() { return [...samples]; },
    reset() { samples.length = 0; lastRender = null; },
  };
  return profiler;
}
