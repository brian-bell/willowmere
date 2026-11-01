import { test, expect } from "@playwright/test";

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

test.describe("a device that cannot keep up at any resolution", () => {
  test.use({ deviceScaleFactor: 2 });

  test("holds every other refresh at full detail instead", async ({ page }) => {
    test.setTimeout(240000);
    // Every frame reports 33 ms, whatever the pixel ratio: the floor does
    // not help, so frames should be held to every other refresh, where 33 ms
    // fits, at the quality's full ratio.
    await page.addInitScript(() => {
      const requestFrame = window.requestAnimationFrame;
      let now, lastReal;
      window.requestAnimationFrame = (callback) =>
        requestFrame.call(window, (real) => {
          if (real !== lastReal) {
            lastReal = real;
            now = window.__willowmere ? (now ?? real) + 33.4 : real;
          }
          callback(now);
        });
    });
    await page.goto("/");
    await page.waitForFunction(
      () => window.__willowmere?.getDiagnostics().resolution.halfRate,
      null,
      { timeout: 200000 },
    );
    expect(await resolution(page)).toMatchObject({
      quality: "balanced",
      halfRate: true,
      pixelRatio: 1.25,
    });
    // Changing quality starts again at every refresh.
    await page.locator("#settings").click();
    await page.locator("#quality").selectOption("high");
    await page.locator("#settings-dialog .close-modal").click();
    expect(await resolution(page)).toMatchObject({ halfRate: false });
  });
});

test.describe("touch-only devices", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 820, height: 1048 },
    deviceScaleFactor: 2,
  });

  test("start on performance without multisampling", async ({ page }) => {
    await page.goto("/?resolution=fixed");
    await page.waitForFunction(() => window.__willowmere?.getWater().frame > 3);
    const state = await page.evaluate(() => ({
      quality: document.querySelector("#quality").value,
      render: window.__willowmere.getDiagnostics().render,
    }));
    expect(state.quality).toBe("performance");
    expect(state.render).toMatchObject({
      pixelRatio: 1,
      samples: 0,
      bloom: false,
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
