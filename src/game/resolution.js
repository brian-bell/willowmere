// The adaptive resolution scaler. Every pass fills the full drawing buffer, so
// the frame rate follows pixel count. Each quality caps the pixel ratio; the
// scaler lowers it while frames run long and raises it again once they are
// short. See docs/performance.md. No three.js or DOM, so tests can feed it
// recorded frame intervals.

export const QUALITY_PIXEL_RATIO = { high: 1.25, balanced: 1.25, performance: 1 };

/**
 * Retina laptops and large monitors start on balanced; 1x screens up to about
 * 1920 × 1200, and small windows on dense screens, start on high.
 */
export function startingQuality(width, height, density) {
  return width < 760 || width * height * density ** 2 > 2.6e6 ? "balanced" : "high";
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * `setPixelRatio(ratio)` applies a ratio to the renderer and composer;
 * `resize()` refits them after a step. `density()` is the screen's device
 * pixel ratio, read whenever the ceiling is recomputed. `overrides.pixelRatio`
 * (the benchmark's tune hook) forces a ratio and stands the scaler aside.
 */
export function createResolutionScaler({
  adaptive,
  quality,
  density,
  now,
  setPixelRatio,
  resize,
  overrides = {},
}) {
  const state = {
    adaptive,
    ceiling: Math.min(density(), QUALITY_PIXEL_RATIO[quality]),
    floor: 0.75,
    step: 0.125,
    // Set by the first reset.
    pixelRatio: 0,
    samples: [],
    windowStart: 0,
    lastSample: 0,
    p95: 0,
    mean: 0,
    // Frames before this time are not sampled: startup, or after a failed descent.
    holdUntil: now + 3000,
    holdFor: 30000,
    goodWindows: 0,
    // Consecutive good one-second windows needed to step up; doubles when a
    // step up is undone straight away.
    upWindows: 5,
    lastUp: -Infinity,
    // Mean interval when the current run of step downs began.
    descentFrom: 0,
    // The village's ratio while the bakery is open.
    outdoor: 0,
  };
  function apply(ratio) {
    state.pixelRatio = ratio;
    setPixelRatio(ratio);
    state.samples.length = 0;
  }
  /** Restarts from the quality's cap, which is the scaler's ceiling. */
  function reset(quality) {
    Object.assign(state, {
      ceiling: Math.min(density(), QUALITY_PIXEL_RATIO[quality]),
      goodWindows: 0,
      upWindows: 5,
      lastUp: -Infinity,
      descentFrom: 0,
    });
    apply(overrides.pixelRatio ?? state.ceiling);
  }
  function step(direction) {
    const r = state;
    apply(clamp(r.pixelRatio + direction * r.step, Math.min(r.floor, r.ceiling), r.ceiling));
    resize();
  }
  /** Samples one frame's interval (ms) at time `now`, stepping when a window closes. */
  function update(now, interval) {
    const r = state;
    if (!r.adaptive || overrides.pixelRatio != null || now < r.holdUntil) return;
    // Start a fresh window after a hidden tab, the bakery, or a long stall.
    if (interval > 250 || now - r.lastSample > 250) {
      r.samples.length = 0;
      r.windowStart = now;
    }
    r.lastSample = now;
    r.samples.push(interval);
    if (now - r.windowStart < 1000) return;
    r.samples.sort((a, b) => a - b);
    r.p95 = r.samples[Math.floor(r.samples.length * 0.95)];
    r.mean = r.samples.reduce((a, b) => a + b, 0) / r.samples.length;
    r.samples.length = 0;
    r.windowStart = now;
    const slow = r.p95 > 20;
    if (!slow) r.descentFrom = 0;
    if (slow) {
      r.goodWindows = 0;
      // Slow again soon after stepping up: wait longer before the next try.
      if (now - r.lastUp < 10000) r.upWindows = Math.min(r.upWindows * 2, 60);
      if (r.pixelRatio > Math.min(r.floor, r.ceiling)) {
        r.descentFrom ||= r.mean;
        step(-1);
      } else if (r.descentFrom && r.mean > r.descentFrom * 0.95) {
        // Even the floor did not shorten frames, so something else sets the
        // pace (a 30 Hz cap or a busy CPU). Restore detail and retry later.
        // Single steps are not judged: vsync can hold frames at 33 ms until
        // the GPU fits within one refresh.
        r.descentFrom = 0;
        r.holdUntil = now + r.holdFor;
        r.holdFor = Math.min(r.holdFor * 2, 300000);
        apply(r.ceiling);
        resize();
      }
    } else if (r.p95 < 18) {
      if (++r.goodWindows >= r.upWindows && r.pixelRatio < r.ceiling) {
        r.goodWindows = 0;
        r.lastUp = now;
        step(1);
      }
    } else r.goodWindows = 0;
  }
  return { state, apply, reset, update };
}
