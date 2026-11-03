import { test, expect } from "@playwright/test";
import { regions, allowsGrass } from "../src/regions/index.js";
import { patchBounds, GRASS_DENSITY } from "../src/regions/outskirts.js";

// How many blades the open country's patch at (cx, cz) should hold: its
// scatter, times the share of its ground where the regions let grass grow,
// sampled every 25 cm. Returns the expected count and its standard deviation.
function expectedBlades(cx, cz) {
  const b = patchBounds(cx, cz),
    scattered = Math.round((b.maxX - b.minX) * (b.maxZ - b.minZ) * GRASS_DENSITY),
    step = 0.25;
  let open = 0,
    samples = 0;
  for (let x = b.minX + step / 2; x < b.maxX; x += step)
    for (let z = b.minZ + step / 2; z < b.maxZ; z += step) {
      samples++;
      if (allowsGrass(x, z)) open++;
    }
  const share = open / samples;
  return { blades: scattered * share, spread: Math.sqrt(scattered * share * (1 - share)) };
}

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
  // Every region in the registry with a builder loaded and queued its pieces,
  // and every piece finished: theirs, plus the route grid and the fishing
  // float that the game queues itself.
  const done = await streaming(page);
  expect(Object.keys(done.regions).sort()).toEqual(
    regions.filter((region) => region.stream).map((region) => region.id).sort(),
  );
  for (const [id, jobs] of Object.entries(done.regions))
    expect(jobs, id).toBeGreaterThan(0);
  expect(done.finished).toBe(
    2 + Object.values(done.regions).reduce((sum, jobs) => sum + jobs, 0),
  );
  // The open country's 16 grass patches, one per chunk around the village.
  expect(done.regions.fields).toBe(16);
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
    // Each patch grows grass wherever the regions allow it, and only there:
    // the millpond's water, the orchard's path, the market's gravel and the
    // marsh's mere take their share of it. Blades scatter at random, so the
    // count may stray from the expected one by up to four standard deviations.
    const { blades, spread } = expectedBlades(cx, cz);
    expect(patch.instances, patch.chunk).toBeGreaterThan(0);
    expect(Math.abs(patch.instances - blades), patch.chunk).toBeLessThanOrEqual(
      4 * spread + 2,
    );
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
  // x = -24 into the fields, zoomed out to the cap.
  await page.locator("#start").click();
  while (!(await page.locator("#zoom-out").isDisabled()))
    await page.locator("#zoom-out").click();
  await page.waitForTimeout(2500);
  // Zoomed out this far, x = -30 is drawn at the screen's left, where the
  // quest card can cover it: aim at the first spot along it the canvas shows.
  const target = await page.evaluate(() =>
    [3, 6, 9, 12, 0, -3]
      .map((z) => window.__willowmere.project(-30, z))
      .find(({ x, y }) => document.elementFromPoint(x, y)?.id === "scene"),
  );
  expect(target).toBeDefined();
  const walking = await page.evaluate(() => window.__frames.length);
  // DEBUG (temporary): what the click meets.
  const probe = () =>
    page.evaluate((target) => {
      const w = window.__willowmere,
        player = w.getPlayer(),
        ground = w.project(-30, target.z);
      return {
        player,
        target,
        ground,
        under: document.elementFromPoint(target.x, target.y)?.id,
        path: w.findPath(player, { x: -30, z: target.z }).length,
        blocked: w.blocked(-30, target.z),
        dialogs: [...document.querySelectorAll("dialog[open]")].map((d) => d.id),
        streaming: w.getStreaming(),
        view: w.getDiagnostics().camera,
        wood: w.getWood(),
      };
    }, target);
  console.log("DEBUG before", JSON.stringify(await probe()));
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(1500);
  console.log("DEBUG after", JSON.stringify(await probe()));
  await expect
    .poll(async () => (await page.evaluate(() => window.__willowmere.getPlayer())).x, {
      timeout: 30000,
    })
    .toBeLessThan(-26);
  expect(Math.max(...(await gapsSince(walking)))).toBeLessThan(STALL);
});
