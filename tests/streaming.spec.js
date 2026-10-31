import { test, expect } from "@playwright/test";

const streaming = (page) =>
  page.evaluate(() => window.__willowmere.getStreaming());

test("the open country streams in around the village after startup", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  await expect
    .poll(async () => streaming(page), { timeout: 600000 })
    .toMatchObject({ pending: 0 });
  // The route grid plus 16 grass patches, one per chunk around the village.
  expect((await streaming(page)).finished).toBe(17);
  const chunks = await page.evaluate(() => window.__willowmere.getChunks());
  const patches = chunks.flatMap((chunk) =>
    chunk.meshes
      .filter((mesh) => mesh.name.startsWith("Grass blades (open country"))
      .map((mesh) => ({ chunk: chunk.key, ...mesh })),
  );
  expect(patches).toHaveLength(16);
  for (const patch of patches) {
    const [cx, cz] = patch.chunk.split(",").map(Number);
    expect(Math.max(Math.abs(cx), Math.abs(cz)), patch.chunk).toBe(2);
    expect(patch.instances).toBeGreaterThan(500);
    // Each patch culls as a unit no larger than a rim corner.
    expect(patch.radius).toBeLessThan(18);
  }
  // Every chunk key lies on the map's 7 × 7 grid.
  for (const { key } of chunks) {
    const [cx, cz] = key.split(",").map(Number);
    expect(Math.abs(cx), key).toBeLessThanOrEqual(3);
    expect(Math.abs(cz), key).toBeLessThanOrEqual(3);
  }
  expect(errors).toEqual([]);
});

test("first person hides distant grass and draws only as far as its fog", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  await expect
    .poll(async () => (await streaming(page)).pending, { timeout: 600000 })
    .toBe(0);
  const overview = await page.evaluate(() => window.__willowmere.getDiagnostics());
  expect(overview.fog).toEqual([0, 693]);
  await page.locator("#view-toggle").click();
  await expect
    .poll(async () => (await page.evaluate(() => window.__willowmere.getDiagnostics())).far)
    .toBe(72);
  const eye = await page.evaluate(() => window.__willowmere.getDiagnostics());
  // The fog closes before the far plane, so nothing is cut off in view.
  expect(eye.fog[1]).toBeLessThan(eye.far);
  expect(eye.fog[0]).toBeGreaterThanOrEqual(25);
  await page.locator("#view-toggle").click();
  await expect
    .poll(async () => (await page.evaluate(() => window.__willowmere.getDiagnostics())).fog)
    .toEqual([0, 693]);
});

test("walking across chunk borders while the open country streams in never stalls a frame", async ({
  page,
}) => {
  // Time every animation frame from the first, noting when play began.
  await page.addInitScript(() => {
    const frames = (window.__frames = []);
    const tick = (now) => {
      frames.push([now, !!document.querySelector("#loading.loaded")]);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  // Zoom out while the patches stream in, then walk from the village green
  // west across the chunk borders at x = -8 and x = -24 into the fields.
  await page.locator("#start").click();
  for (let i = 0; i < 4; i++) await page.locator("#zoom-out").click();
  await page.waitForTimeout(2500);
  const target = await page.evaluate(() => window.__willowmere.project(-30, 3));
  await page.mouse.click(target.x, target.y);
  await expect
    .poll(async () => (await page.evaluate(() => window.__willowmere.getPlayer())).x, {
      timeout: 30000,
    })
    .toBeLessThan(-26);
  const { gaps, streaming } = await page.evaluate(() => {
    const frames = window.__frames,
      first = frames.findIndex(([, loaded]) => loaded) + 2,
      gaps = [];
    for (let i = Math.max(first, 1); i < frames.length; i++)
      gaps.push(frames[i][0] - frames[i - 1][0]);
    return { gaps, streaming: window.__willowmere.getStreaming() };
  });
  expect(streaming.pending).toBe(0);
  gaps.sort((a, b) => a - b);
  // Frame gaps only mean something where frames are fast; software WebGL
  // (as in cloud containers) takes seconds per frame.
  const typical = gaps[gaps.length >> 1];
  test.skip(typical > 20, `frames take ${Math.round(typical)} ms here, too slow to time hitches`);
  expect(gaps.at(-1)).toBeLessThan(33.4);
});
