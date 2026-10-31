import { test, expect } from "@playwright/test";

const VILLAGE_CHUNKS = ["-1,-1", "-1,0", "-1,1", "0,-1", "0,0", "0,1", "1,-1", "1,0", "1,1"];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // A save from before planted flowers had ids.
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: true },
        plants: [
          { x: -8, z: 8, watered: true },
          { x: -7.2, z: 8, watered: false },
          { x: -6.4, z: 8, watered: false },
        ],
      }),
    );
  });
});

test("the village bakes, instances and glows per chunk", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  const chunks = await page.evaluate(() => window.__willowmere.getChunks());
  expect(chunks.map((c) => c.key).sort()).toEqual(VILLAGE_CHUNKS);
  const baked = chunks.flatMap((chunk) =>
    chunk.meshes
      .filter((m) => m.name.startsWith("Baked scenery"))
      .map((mesh) => ({ chunk, mesh })),
  );
  // Fewer batches than the 50 map-wide ones the village had before chunking:
  // small shares of a material ride along with a neighbouring chunk's batch.
  expect(baked.length).toBeGreaterThan(9);
  expect(baked.length).toBeLessThan(50);
  // Each batch stays centred within its chunk or the next one over.
  for (const { chunk, mesh } of baked) {
    const [[minX, , minZ], [maxX, , maxZ]] = chunk.bounds;
    expect(mesh.center[0], chunk.key).toBeGreaterThan(minX - 16);
    expect(mesh.center[0], chunk.key).toBeLessThan(maxX + 16);
    expect(mesh.center[2], chunk.key).toBeGreaterThan(minZ - 14);
    expect(mesh.center[2], chunk.key).toBeLessThan(maxZ + 14);
  }
  // Grass, blossoms and shrubs split into per-chunk instanced meshes.
  const meshes = chunks.flatMap((c) => c.meshes);
  for (const name of ["Grass blades", "Meadow blossoms", "Folded shrub leaves"]) {
    const parts = meshes.filter((m) => m.name.startsWith(name));
    expect(parts.length, name).toBeGreaterThan(1);
    expect(parts.every((m) => m.instances > 0), name).toBe(true);
  }
  // Lamp glass and lit windows still brighten at blue hour.
  expect(await page.evaluate(() => window.__willowmere.getGlowMaterials())).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("chunks out of view and out of the sun's shadow pause their animations", async ({
  page,
}) => {
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  const animating = () =>
    page.evaluate(() =>
      window.__willowmere
        .getChunks()
        .filter((c) => c.animating)
        .map((c) => c.key),
    );
  const millChunk = "1,0";
  expect(await animating()).toContain(millChunk);
  // Zoomed in and panned to the far west, the mill wheel and its chimney
  // smoke are outside both the view and the shadow map's box.
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) document.querySelector("#zoom-in").click();
  });
  await page.waitForFunction(
    () => window.__willowmere.getDiagnostics().camera.viewHeight < 10.5,
    null,
    { timeout: 600000, polling: 500 },
  );
  await page.evaluate(() => {
    for (let i = 0; i < 6; i++) document.querySelector("#pan-left").click();
  });
  await page.waitForFunction(
    (key) => !window.__willowmere.getChunks().find((c) => c.key === key).animating,
    millChunk,
    { timeout: 120000 },
  );
  // Chunks on screen keep animating.
  expect(await animating()).toContain("-1,0");
  await page.evaluate(() => document.querySelector("#pan-reset").click());
  await page.waitForFunction(
    (key) => window.__willowmere.getChunks().find((c) => c.key === key).animating,
    millChunk,
    { timeout: 120000 },
  );
});

test("planted flowers keep ids across saves", async ({ page }) => {
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere);
  const before = await page.evaluate(() => window.__willowmere.getState().plants);
  expect(before.map((p) => p.id)).toEqual([0, 1, 2]);
  expect(before[0]).toMatchObject({ x: -8, z: 8, watered: true });
  // Startup saves the view mode, which writes the ids; a reload keeps them.
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("willowmere.save.v1")).plants,
  );
  expect(saved.map((p) => p.id)).toEqual([0, 1, 2]);
  await page.reload();
  await page.waitForFunction(() => window.__willowmere);
  const after = await page.evaluate(() => window.__willowmere.getState().plants);
  expect(after.map((p) => p.id)).toEqual([0, 1, 2]);
});
