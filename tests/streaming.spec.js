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
  // The route grid, 16 grass patches (one per chunk around the village), the
  // fishing float, the millpond's six pieces and the orchard hill's six.
  expect((await streaming(page)).finished).toBe(30);
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
    // The millpond's water and banks take part of two patches' ground, and
    // the orchard hill's path a strip of a third.
    const pond = ["0,-2", "1,-2"].includes(patch.chunk),
      path = patch.chunk === "-1,-2";
    expect(patch.instances, patch.chunk).toBeGreaterThan(pond ? 200 : path ? 400 : 500);
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
  // Switches the view, then reports after the next frame has applied it.
  const view = (toggle) =>
    page.evaluate(async (toggle) => {
      if (toggle) document.querySelector("#view-toggle").click();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const game = window.__willowmere,
        { fog, far } = game.getDiagnostics(),
        patches = game
          .getChunks()
          .flatMap((chunk) => chunk.meshes)
          .filter((mesh) => mesh.name.startsWith("Grass blades (open country"));
      return {
        fog,
        far,
        shown: patches.filter((mesh) => mesh.visible).length,
      };
    }, toggle);
  const overview = await view(false);
  expect(overview.fog).toEqual([0, 693]);
  expect(overview.shown).toBe(16);
  const eye = await view(true);
  expect(eye.far).toBe(72);
  // The fog closes before the far plane, so nothing is cut off in view.
  expect(eye.fog[1]).toBeLessThan(eye.far);
  expect(eye.fog[0]).toBeGreaterThanOrEqual(25);
  // From the village green, the patches across the map are out of range.
  expect(eye.shown).toBeGreaterThan(0);
  expect(eye.shown).toBeLessThan(16);
  const back = await view(true);
  expect(back.fog).toEqual([0, 693]);
  expect(back.shown).toBe(16);
});

test("the open country streams in, and the player walks across chunk borders, without stalling a frame", async ({
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
  // Frame gaps only mean something where frames are fast; software WebGL
  // (as in cloud containers) takes seconds per frame and could not walk there.
  const typical = await page.evaluate(() => {
    const times = window.__frames.slice(-6).map(([t]) => t),
      gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
    return gaps[gaps.length >> 1];
  });
  test.skip(typical > 20, `frames take ${Math.round(typical)} ms here, too slow to time hitches`);
  // Gaps between frames from index `from` on. A frame that misses one
  // display refresh (33 ms at 60 Hz) is load; missing two in a row is a stall.
  const gapsSince = (from) =>
    page.evaluate((from) => {
      const frames = window.__frames,
        gaps = [];
      for (let i = Math.max(from, 1); i < frames.length; i++)
        gaps.push(Math.round((frames[i][0] - frames[i - 1][0]) * 10) / 10);
      return gaps;
    }, from);
  const STALL = 45;
  // The patches stream in on the loading view, from its third frame.
  await expect
    .poll(async () => (await streaming(page)).pending, { timeout: 30000 })
    .toBe(0);
  const loaded = await page.evaluate(
    () => window.__frames.findIndex(([, loaded]) => loaded) + 2,
  );
  expect(Math.max(...(await gapsSince(loaded)))).toBeLessThan(STALL);
  // Starting and the first zoom-out stall once on their own, as they did
  // before the map grew (see docs/performance.md), so timing resumes for the
  // walk: from the village green west across the chunk borders at x = -8 and
  // x = -24 into the fields, at the zoom cap.
  await page.locator("#start").click();
  for (let i = 0; i < 4; i++) await page.locator("#zoom-out").click();
  await page.waitForTimeout(2500);
  const target = await page.evaluate(() => window.__willowmere.project(-30, 3));
  const walking = await page.evaluate(() => window.__frames.length);
  await page.mouse.click(target.x, target.y);
  await expect
    .poll(async () => (await page.evaluate(() => window.__willowmere.getPlayer())).x, {
      timeout: 30000,
    })
    .toBeLessThan(-26);
  expect(Math.max(...(await gapsSince(walking)))).toBeLessThan(STALL);
});
