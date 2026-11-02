import { test, expect } from "@playwright/test";
import { createResolutionScaler, startingQuality } from "../src/game/resolution.js";

// Runs the scaler over synthetic frames. `frameTime(ratio)` gives each frame's
// interval at the current pixel ratio; returns each ratio applied and when.
function simulate(frameTime, seconds, quality = "balanced") {
  const applied = [];
  let now = 0;
  const scaler = createResolutionScaler({
    adaptive: true,
    quality,
    density: () => 2,
    now,
    setPixelRatio: (ratio) => applied.push({ ratio, at: now }),
    resize() {},
  });
  scaler.reset(quality);
  while (now < seconds * 1000) {
    const interval = frameTime(scaler.state.pixelRatio);
    now += interval;
    scaler.update(now, interval);
  }
  return { applied, state: scaler.state };
}

test("starting quality follows the screen's pixel count", { tag: "@logic" }, () => {
  expect(startingQuality(1600, 1000, 1)).toBe("high");
  expect(startingQuality(1920, 1200, 1)).toBe("high");
  expect(startingQuality(1600, 1000, 2)).toBe("balanced");
  expect(startingQuality(700, 900, 1)).toBe("balanced");
});

test("the scaler steps down while frames run long and backs off failed step ups", { tag: "@logic" }, () => {
  // 30 FPS above pixel ratio 1, 60 FPS at or below it, as if vsync held
  // frames at 33 ms until the GPU fits a 1x buffer within one refresh.
  const { applied, state } = simulate((ratio) => (ratio > 1 ? 33.4 : 16.7), 120);
  const ratios = applied.map((a) => a.ratio);
  // Nothing is sampled for the first three seconds; then one step a second.
  expect(ratios.slice(0, 3)).toEqual([1.25, 1.125, 1]);
  expect(applied[1].at).toBeGreaterThan(4000);
  expect(applied[2].at - applied[1].at).toBeLessThan(1100);
  // Each step up is undone at once, and doubles the wait before the next.
  expect(ratios.slice(3, 9)).toEqual([1.125, 1, 1.125, 1, 1.125, 1]);
  const ups = applied.filter((a, i) => i > 2 && a.ratio > 1).map((a) => a.at);
  expect(ups[1] - ups[0]).toBeGreaterThan(9000);
  expect(ups[2] - ups[1]).toBeGreaterThan(19000);
  expect(state.upWindows).toBe(60);
  expect(Math.min(...ratios)).toBe(1);
});

test("when even the floor does not help, the scaler restores detail and waits", { tag: "@logic" }, () => {
  const { applied } = simulate(() => 33.4, 80);
  const ratios = applied.map((a) => a.ratio);
  expect(ratios.slice(0, 6)).toEqual([1.25, 1.125, 1, 0.875, 0.75, 1.25]);
  // Thirty seconds' hold, then the descent repeats and the hold doubles.
  const restored = applied.filter((a, i) => i > 0 && a.ratio === 1.25);
  expect(restored.length).toBe(2);
  expect(restored[1].at - restored[0].at).toBeGreaterThan(30000 + 4000);
});

test("a stall or a hidden tab starts a fresh window", { tag: "@logic" }, () => {
  // Slow frames broken by a long gap every half second never fill a window.
  let frame = 0;
  const { applied } = simulate(() => (++frame % 15 ? 33.4 : 400), 20);
  expect(applied.map((a) => a.ratio)).toEqual([1.25]);
});

const resolution = (page) =>
  page.evaluate(() => ({
    quality: document.querySelector("#quality").value,
    ...window.__willowmere.getDiagnostics().resolution,
  }));

test.describe("dense screens", () => {
  test.use({ deviceScaleFactor: 2 });

  test("start on balanced and cap every quality's pixel ratio", async ({
    page,
  }) => {
    await page.goto("/?resolution=fixed");
    await page.waitForFunction(() => window.__willowmere?.getWater().frame > 3);
    expect(await resolution(page)).toMatchObject({
      quality: "balanced",
      adaptive: false,
      pixelRatio: 1.25,
      drawingBuffer: [2000, 1250],
    });
    for (const [quality, pixelRatio] of [
      ["high", 1.25],
      ["performance", 1],
    ]) {
      await page.locator("#settings").click();
      await page.locator("#quality").selectOption(quality);
      await page.locator("#settings-dialog .close-modal").click();
      expect(await resolution(page)).toMatchObject({ quality, pixelRatio });
    }
  });

  test("scaler steps down while frames run long and backs off failed step ups", async ({
    page,
  }) => {
    // About 600 frames; slow machines render them at low real frame rates.
    test.setTimeout(240000);
    // Report synthetic frame times: 30 FPS above pixel ratio 1, 60 FPS at or
    // below it, as if vsync held frames at 33 ms until the GPU fits a 1x
    // buffer within one refresh. The first step down alone does not help.
    await page.addInitScript(() => {
      const requestFrame = window.requestAnimationFrame;
      let now, lastReal;
      window.requestAnimationFrame = (callback) =>
        requestFrame.call(window, (real) => {
          // Several callbacks share a frame, including Playwright's polling.
          if (real !== lastReal) {
            lastReal = real;
            const ratio =
              window.__willowmere?.getDiagnostics().resolution.pixelRatio;
            now = ratio ? (now ?? real) + (ratio > 1 ? 33.4 : 16.7) : real;
          }
          callback(now);
        });
    });
    await page.goto("/");
    await page.waitForFunction(
      () => window.__willowmere?.getDiagnostics().resolution.pixelRatio === 1,
      null,
      { timeout: 100000 },
    );
    // Five good seconds allow one step up; the next slow second undoes it
    // and doubles the wait.
    await page.waitForFunction(
      () => window.__willowmere.getDiagnostics().resolution.upWindows === 10,
      null,
      { timeout: 100000 },
    );
    const state = await resolution(page);
    expect(state).toMatchObject({ quality: "balanced", adaptive: true });
    expect(state.pixelRatio).toBeGreaterThanOrEqual(1);
    expect(state.pixelRatio).toBeLessThanOrEqual(1.125);

    await page.evaluate(() => window.__willowmere.setAdaptiveResolution(false));
    expect(await resolution(page)).toMatchObject({
      adaptive: false,
      pixelRatio: 1.25,
    });
  });
});

test("1x screens start on high at native resolution", async ({ page }) => {
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 3);
  expect(await resolution(page)).toMatchObject({
    quality: "high",
    pixelRatio: 1,
    drawingBuffer: [1600, 1000],
  });
});
