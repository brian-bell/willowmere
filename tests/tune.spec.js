import { test, expect } from "@playwright/test";

// Reads the diagnostics after a frame has rendered with the current settings.
const diagnostics = (page) =>
  page.evaluate(async () => {
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
    return window.__willowmere.getDiagnostics();
  });
const tune = (page, settings) =>
  page.evaluate((settings) => window.__willowmere.tune(settings), settings);

test("tune toggles each outdoor override and null restores the defaults", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 10);
  // The default view draws every leaf; the loading view is zoomed out.
  await page.locator("#start").click();
  await expect
    .poll(async () => (await diagnostics(page)).camera.viewHeight)
    .toBeLessThan(18.02);
  const base = await diagnostics(page);
  expect(base.render).toMatchObject({
    pixelRatio: 1,
    width: 1600,
    height: 1000,
    samples: 4,
    bloom: true,
    shadowUpdate: true,
    water: true,
    foliage: true,
    fields: true,
    leafDetail: "auto",
    overrides: {},
  });
  expect(base.render.leaves).toBeGreaterThan(40000);

  await tune(page, { shadowUpdate: false });
  const frozen = await diagnostics(page);
  expect(frozen.render.shadowUpdate).toBe(false);
  expect(frozen.drawCalls).toBeLessThan(base.drawCalls - 100);

  await tune(page, { shadowUpdate: null, water: false });
  const still = await diagnostics(page);
  expect(still.render).toMatchObject({ shadowUpdate: true, water: false });
  expect(still.drawCalls).toBeLessThan(base.drawCalls);

  await tune(page, { water: null, bloom: false });
  expect((await diagnostics(page)).render).toMatchObject({
    water: true,
    bloom: false,
  });

  await tune(page, { bloom: null, samples: 0 });
  expect((await diagnostics(page)).render).toMatchObject({
    bloom: true,
    samples: 0,
    width: 1600,
  });

  await tune(page, { samples: null, pixelRatio: 0.5 });
  const half = await diagnostics(page);
  expect(half.render).toMatchObject({
    samples: 4,
    pixelRatio: 0.5,
    width: 800,
    height: 500,
  });
  expect(half.resolution.drawingBuffer).toEqual([800, 500]);

  await tune(page, { pixelRatio: null, foliage: false });
  const bare = await diagnostics(page);
  expect(bare.render).toMatchObject({ pixelRatio: 1, foliage: false });
  expect(bare.triangles).toBeLessThan(base.triangles * 0.8);

  await tune(page, { foliage: null, leafDetail: 1 });
  const coarse = await diagnostics(page);
  expect(coarse.render).toMatchObject({ foliage: true, leafDetail: 1 });
  expect(coarse.render.leaves).toBeLessThan(base.render.leaves * 0.55);

  // Hiding the open country removes its grass, and then its ground, from the frame.
  const fieldParts = () =>
    page.evaluate(() =>
      window.__willowmere
        .getChunks()
        .flatMap((chunk) => chunk.meshes)
        .filter((mesh) => mesh.name.startsWith("Grass blades (open country")),
    );
  await tune(page, { leafDetail: null, fields: "ground" });
  const ground = await fieldParts();
  expect(ground.length).toBeGreaterThan(0);
  expect(ground.every((mesh) => !mesh.visible)).toBe(true);
  await tune(page, { fields: false });
  const village = await diagnostics(page);
  expect(village.render).toMatchObject({ leafDetail: "auto", fields: false });
  expect((await fieldParts()).every((mesh) => !mesh.visible)).toBe(true);

  const restored = await tune(page, { fields: null });
  expect(restored).toMatchObject({
    pixelRatio: 1,
    width: 1600,
    height: 1000,
    samples: 4,
    bloom: true,
    shadowUpdate: true,
    water: true,
    foliage: true,
    fields: true,
    leafDetail: "auto",
    leaves: base.render.leaves,
    overrides: {},
  });
  const after = await diagnostics(page);
  expect(after.drawCalls).toBeGreaterThan(base.drawCalls * 0.9);
  expect(after.drawCalls).toBeLessThan(1600);

  // The quality presets keep their own defaults once nothing is overridden.
  await page.locator("#settings").click();
  await page.locator("#quality").selectOption("performance");
  await page.locator("#settings-dialog .close-modal").click();
  expect((await diagnostics(page)).render).toMatchObject({
    bloom: false,
    samples: 0,
    pixelRatio: 1,
  });
  expect(errors).toEqual([]);
});
