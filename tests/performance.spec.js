import { test, expect } from "@playwright/test";
import * as T from "three";
import { createLife } from "../src/life.js";
import { createFlowerFactory } from "../src/flowers.js";

test("character batches retain detailed geometry and moving joints", { tag: "@logic" }, () => {
  const scene = new T.Scene();
  const life = createLife(T, scene);
  let meshes = 0,
    triangles = 0;
  scene.traverse((object) => {
    if (!object.isMesh) return;
    for (const attribute of Object.values(object.geometry.attributes))
      expect(attribute.array.every(Number.isFinite)).toBe(true);
    // Zoomed-far copies wait hidden, and draw instead of the rest.
    if (!object.visible) return;
    meshes++;
    triangles += object.geometry.index.count / 3;
  });
  expect(meshes).toBeLessThan(165);
  // Batching reduces submissions, not the character models' detail.
  expect(triangles).toBeGreaterThan(65000);
  expect(triangles).toBeLessThan(80000);
  scene.updateMatrixWorld(true);
  const parts = [];
  life.player.traverse((object) => {
    if (object.isMesh) parts.push([object, object.matrixWorld.clone()]);
  });
  life.setPlayerMotion(3, 0);
  for (let i = 0; i < 20; i++) life.update(1 / 60, i / 60, true);
  scene.updateMatrixWorld(true);
  expect(
    parts.filter(([object, before]) => !object.matrixWorld.equals(before))
      .length,
  ).toBeGreaterThan(10);
});

test("flower instances share bounded resources and grow independently", { tag: "@logic" }, () => {
  const scene = new T.Scene();
  const makeFlower = createFlowerFactory(scene);
  const wild = makeFlower(0, 0);
  const plants = Array.from({ length: 100 }, (_, i) => makeFlower(i, 1, true));
  const geometries = new Set(),
    materials = new Set();
  scene.traverse((object) => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    materials.add(object.material);
  });
  expect(wild.children).toHaveLength(4);
  expect(plants[0].children).toHaveLength(3);
  expect(geometries.size).toBe(4);
  expect(materials.size).toBe(4);
  plants[0].scale.setScalar(1.35);
  plants[1].scale.setScalar(0.7);
  scene.remove(wild);
  scene.updateMatrixWorld(true);
  const grown = new T.Box3().setFromObject(plants[0]).getSize(new T.Vector3());
  const seedling = new T.Box3()
    .setFromObject(plants[1])
    .getSize(new T.Vector3());
  expect(grown.y / seedling.y).toBeCloseTo(1.35 / 0.7);
  expect(grown.y).toBeGreaterThan(0.7);
  for (const geometry of geometries)
    expect(geometry.attributes.position.array.every(Number.isFinite)).toBe(
      true,
    );
});

// The village's triangle cap. Its views peak at the green, about 3.0M once
// every region has streamed in (2026-11-03), on the frames that capture a
// water reflection.
const VILLAGE_TRIANGLES = 3.2e6;

test("village keeps a draw-call budget with live water and a planted garden", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: true },
        plants: Array.from({ length: 30 }, (_, i) => ({
          x: -8 + (i % 10) * 0.8,
          z: 8 + Math.floor(i / 10) * 0.8,
          watered: i % 2 === 0,
        })),
      }),
    );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 10);
  const samples = await page.evaluate(async () => {
    const values = [];
    for (let i = 0; i < 30; i++) {
      await new Promise(requestAnimationFrame);
      values.push(window.__willowmere.getDiagnostics());
    }
    return values;
  });
  // Counts are deterministic enough for CI; FPS depends on the machine/GPU.
  expect(Math.max(...samples.map((s) => s.drawCalls))).toBeLessThan(1600);
  // The village's triangle cap: looser than the regions' 2.5M (see below).
  expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(VILLAGE_TRIANGLES);
  // This includes individually culled tree geometry and shared flower meshes.
  // The former per-petal garden would allocate over 1,000 geometries here.
  expect(Math.max(...samples.map((s) => s.geometries))).toBeLessThan(320);
  expect(errors).toEqual([]);
});

test("the village's edges keep its budget with every region streamed in beside them", async ({
  page,
}) => {
  test.setTimeout(2400000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  // Software WebGL streams the whole map in slowly; a GPU takes seconds.
  await page.waitForFunction(() => !window.__willowmere.getStreaming().pending, null, {
    timeout: 1800000,
    polling: 2000,
  });
  // The green, and inside the village's edge facing each region, at the
  // default height: a region's scenery, water and shadows add to the
  // village's own here, which the regions' own viewpoints never see.
  const edges = {
    "the green, at the spawn": [-2.8, 6.2],
    "south, by the marsh": [10, 18],
    "north, by the millpond": [8, -18],
    "north-west, by the orchard": [-18, -18],
    "east, by the market lane": [21, 2],
    "west, by the old wood": [-21, 2],
    "south-west, by the allotments": [-12, 18],
    "south-west corner, by the quarry": [-21, 18],
    "south-east corner, by the school": [21, 18],
  };
  for (const [edge, [x, z]] of Object.entries(edges)) {
    await page.evaluate(([x, z]) => window.__willowmere.moveTo(x, z), [x, z]);
    const samples = await page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame);
        values.push(window.__willowmere.getDiagnostics());
      }
      return values;
    });
    expect(Math.max(...samples.map((s) => s.drawCalls)), edge).toBeLessThan(1600);
    expect(Math.max(...samples.map((s) => s.triangles)), edge).toBeLessThan(VILLAGE_TRIANGLES);
  }
  expect(errors).toEqual([]);
});

test("the millpond keeps a tighter draw budget than the village's", async ({
  page,
}) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  // The benchmark's viewpoint: the pond's south bank by the jetty, at the
  // default height, once the region has streamed in and the view arrived.
  await page.waitForFunction(() => !window.__willowmere.getStreaming().pending, null, {
    timeout: 600000,
    polling: 1000,
  });
  await page.evaluate(() => window.__willowmere.moveTo(8.6, -25.8));
  const samples = await page.evaluate(async () => {
    const values = [];
    // moveTo snaps the overview to the pond; a few frames settle the shadow
    // and the label, then every pool gets at least one reflection turn.
    for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
    for (let i = 0; i < 12; i++) {
      await new Promise(requestAnimationFrame);
      values.push(window.__willowmere.getDiagnostics());
    }
    return values;
  });
  // All three pools are in view here: the pond, the brook above the village
  // and the village's brook, each taking its turn at a reflection.
  expect(Math.max(...samples.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(2.5e6);
  expect(errors).toEqual([]);
});

test("the orchard hill keeps the same budget as the millpond", async ({ page }) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  await page.waitForFunction(() => !window.__willowmere.getStreaming().pending, null, {
    timeout: 600000,
    polling: 1000,
  });
  // The benchmark's viewpoint: the path beside the bench, at the default
  // height, with the orchard, the windmill and the hives in view.
  await page.evaluate(() => window.__willowmere.moveTo(-21, -27.6, 0.65));
  const samples = await page.evaluate(async () => {
    const values = [];
    for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
    for (let i = 0; i < 8; i++) {
      await new Promise(requestAnimationFrame);
      values.push(window.__willowmere.getDiagnostics());
    }
    return values;
  });
  expect(Math.max(...samples.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(2.5e6);
  expect(errors).toEqual([]);
});

test("the market lane keeps the same budget as the millpond", async ({ page }) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  await page.waitForFunction(() => !window.__willowmere.getStreaming().pending, null, {
    timeout: 600000,
    polling: 1000,
  });
  // The benchmark's viewpoint: the market square at the default height, with
  // the stalls, the tea room, the post office and the mill in view, then
  // zoomed out to height 30, where the village's east side joins it.
  await page.evaluate(() => window.__willowmere.moveTo(36.5, 3.2, -1.75));
  const sample = () =>
    page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame);
        values.push(window.__willowmere.getDiagnostics());
      }
      return values;
    });
  const samples = await sample();
  expect(Math.max(...samples.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(2.5e6);
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) document.querySelector("#zoom-out").click();
  });
  const far = await sample();
  expect(Math.max(...far.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...far.map((s) => s.triangles))).toBeLessThan(2.5e6);
  expect(errors).toEqual([]);
});

test("the willow marsh keeps the same budget as the millpond", async ({ page }) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  // The benchmark's viewpoint: the boardwalk at the default height, with the
  // mere, its reeds, the willows and the hide in view, then zoomed out to
  // height 30, where the village's south side joins it. Standing there first
  // streams the marsh in before the rest of the map.
  await page.evaluate(() => window.__willowmere.moveTo(7.8, 31.2, 1.2));
  await page.waitForFunction(
    () => {
      const names = new Set(
        window.__willowmere.getChunks().flatMap((chunk) => chunk.meshes.map((mesh) => mesh.name)),
      );
      return [
        "Marsh ground, banks and bed",
        "Marsh footbridge and boardwalk",
        "Marsh hide and bench",
        "Willow (west 1): leaves",
        "Willow (east 1): leaves",
        "Marsh lily pads",
        "Marsh heron",
        "Marsh fireflies",
      ].every((name) => names.has(name));
    },
    null,
    { timeout: 600000, polling: 2000 },
  );
  const sample = () =>
    page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame);
        values.push(window.__willowmere.getDiagnostics());
      }
      return values;
    });
  const samples = await sample();
  expect(Math.max(...samples.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(2.5e6);
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) document.querySelector("#zoom-out").click();
  });
  const far = await sample();
  expect(Math.max(...far.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...far.map((s) => s.triangles))).toBeLessThan(2.5e6);
  expect(errors).toEqual([]);
});

test("the old wood keeps the same budget as the marsh", async ({ page }) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  // The benchmark's viewpoint: the clearing at the default height, with the
  // trees all round it in view, then zoomed out to height 30, where the
  // meadow and the village's west side join it. Standing there first streams the
  // wood in before the rest of the map.
  await page.evaluate(() => window.__willowmere.moveTo(-35.5, 0, -2));
  await page.waitForFunction(
    () => {
      const names = new Set(
        window.__willowmere.getChunks().flatMap((chunk) => chunk.meshes.map((mesh) => mesh.name)),
      );
      return [
        "Old wood floor",
        "Old wood trees (north-west): leaves",
        "Old wood trees (middle-west): leaves",
        "Old wood trees (south-west): leaves",
        "Old wood trees (north-east): leaves",
        "Old wood trees (middle-east): leaves",
        "Old wood trees (south-east): leaves",
        "Great oak: leaves",
        "Old wood ferns",
        "Woodland flowers",
      ].every((name) => names.has(name));
    },
    null,
    { timeout: 600000, polling: 2000 },
  );
  const sample = () =>
    page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame);
        values.push(window.__willowmere.getDiagnostics());
      }
      return values;
    });
  const samples = await sample();
  expect(Math.max(...samples.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(2.5e6);
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) document.querySelector("#zoom-out").click();
  });
  const far = await sample();
  expect(Math.max(...far.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...far.map((s) => s.triangles))).toBeLessThan(2.5e6);
  expect(errors).toEqual([]);
});

test("the allotments keep the same budget as the wood", async ({ page }) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Every bed rented and growing, so each bed's crop draws.
  await page.addInitScript(() => {
    const now = Date.now(),
      growing = { rented: true, sown: now, watered: now - 60000 };
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
        plots: { carrots: growing, lettuces: growing, beans: growing, pumpkins: growing },
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  // The benchmark's viewpoint: the cross path by the east beds at the
  // default height, then zoomed out to height 30, where the village's
  // south-west and the marsh join it. Standing there first streams the
  // allotments in before the rest of the map.
  await page.evaluate(() => window.__willowmere.moveTo(-6.5, 28.6, -1.5));
  await page.waitForFunction(
    () => {
      const names = new Set(
        window.__willowmere.getChunks().flatMap((chunk) => chunk.meshes.map((mesh) => mesh.name)),
      );
      return [
        "Allotment paths",
        "Allotments (west)",
        "Allotments (east)",
        "Allotment carrots",
        "Allotment pumpkins",
      ].every((name) => names.has(name));
    },
    null,
    { timeout: 600000, polling: 2000 },
  );
  const sample = () =>
    page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame);
        values.push(window.__willowmere.getDiagnostics());
      }
      return values;
    });
  const samples = await sample();
  expect(Math.max(...samples.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(2.5e6);
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) document.querySelector("#zoom-out").click();
  });
  const far = await sample();
  expect(Math.max(...far.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...far.map((s) => s.triangles))).toBeLessThan(2.5e6);
  expect(errors).toEqual([]);
});

test("the stone quarry keeps the same budget as the wood", async ({ page }) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  // The benchmark's viewpoint: the quarry floor by the block stacks, facing
  // the faces, at the default height, then zoomed out to height 30, where
  // the old wood and the allotments join it. Standing there first streams
  // the quarry in before the rest of the map.
  await page.evaluate(() => window.__willowmere.moveTo(-34, 34, -2.3));
  await page.waitForFunction(
    () => {
      const names = new Set(
        window.__willowmere.getChunks().flatMap((chunk) => chunk.meshes.map((mesh) => mesh.name)),
      );
      return [
        "Quarry ground",
        "Quarry faces",
        "Quarry works",
        "Quarry derrick's load",
        "Quarry track",
        "Quarry rubble",
        "Quarry gorse",
      ].every((name) => names.has(name));
    },
    null,
    { timeout: 600000, polling: 2000 },
  );
  const sample = () =>
    page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame);
        values.push(window.__willowmere.getDiagnostics());
      }
      return values;
    });
  const samples = await sample();
  expect(Math.max(...samples.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(2.5e6);
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) document.querySelector("#zoom-out").click();
  });
  const far = await sample();
  expect(Math.max(...far.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...far.map((s) => s.triangles))).toBeLessThan(2.5e6);
  expect(errors).toEqual([]);
});

test("the village school keeps the same budget as the wood", async ({ page }) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  // The benchmark's viewpoint: the playground's edge by Miss Juniper, the
  // pitch and its eleven children in view, at the default height, then
  // zoomed out to height 30, where the market lane and the marsh join it.
  // Standing there first streams the school in before the rest of the map.
  await page.evaluate(() => window.__willowmere.moveTo(36.6, 27));
  await page.waitForFunction(
    () => {
      const names = window.__willowmere.getChunks().flatMap((chunk) => chunk.meshes.map((mesh) => mesh.name));
      return ["School grounds", "Schoolroom", "Schoolhouse and playground", "Schoolchildren"].every((name) =>
        names.some((n) => n.startsWith(name)),
      );
    },
    null,
    { timeout: 600000, polling: 2000 },
  );
  const sample = () =>
    page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame);
        values.push(window.__willowmere.getDiagnostics());
      }
      return values;
    });
  const samples = await sample();
  expect(Math.max(...samples.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(2.5e6);
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) document.querySelector("#zoom-out").click();
  });
  const far = await sample();
  expect(Math.max(...far.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...far.map((s) => s.triangles))).toBeLessThan(2.5e6);
  expect(errors).toEqual([]);
});

test("zoomed out to the cap, the overview drops small detail and keeps the village's budget", async ({
  page,
}) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  // Every region is in view from the cap, so let the whole map stream in,
  // drawing little meanwhile so slow (software) renderers get there too.
  await page.evaluate(() =>
    window.__willowmere.tune({ foliage: false, fields: false, water: false, shadowUpdate: false }),
  );
  await page.waitForFunction(() => !window.__willowmere.getStreaming().pending, null, {
    timeout: 600000,
    polling: 1000,
  });
  await page.evaluate(() =>
    window.__willowmere.tune({ foliage: null, fields: null, water: null, shadowUpdate: null }),
  );
  const SMALL = [
    "River pebbles",
    "Riverbank shingle and pebbles",
    "Leaves settled among the roots",
    "Tree hollows, moss and woodland details",
  ];
  const zoomTo = async (button, height) => {
    await page.evaluate((button) => {
      for (let i = 0; i < 8; i++) document.querySelector(button).click();
    }, button);
    await page.waitForFunction(
      (height) =>
        Math.abs(window.__willowmere.getDiagnostics().camera.viewHeight - height) < 0.05,
      height,
      { timeout: 600000, polling: 1000 },
    );
  };
  // Which small things show, and what the view submits, over enough frames
  // that every pool in view has taken its turn to capture a reflection: the
  // pools take turns, and the dearest one's frame is the one that counts.
  const sample = () =>
    page.evaluate(async (small) => {
      for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
      const reflections = () => window.__willowmere.getWater().bodies.map((b) => b.reflections);
      const start = reflections(),
        values = [];
      const allCaptured = () =>
        window.__willowmere
          .getWater()
          .bodies.every((body, i) => !body.inView || body.reflections > start[i]);
      while (values.length < 4 || (!allCaptured() && values.length < 60)) {
        await new Promise(requestAnimationFrame);
        values.push(window.__willowmere.getDiagnostics());
      }
      const meshes = window.__willowmere
        .getChunks()
        .flatMap((chunk) => chunk.meshes)
        .filter((mesh) => small.some((name) => mesh.name.startsWith(name)));
      return {
        drawCalls: Math.max(...values.map((s) => s.drawCalls)),
        triangles: Math.max(...values.map((s) => s.triangles)),
        everyReflection: allCaptured(),
        small: meshes.length,
        smallShown: meshes.filter((mesh) => mesh.visible).length,
      };
    }, SMALL);
  await zoomTo("#zoom-out", 39);
  const far = await sample();
  expect(far.everyReflection).toBe(true);
  expect(far.small).toBeGreaterThan(30);
  expect(far.smallShown).toBe(0);
  // The village zoomed out as far as it went before the map grew counted
  // up to 1,104 draws and 2.41M triangles. With the regions around it, this
  // view counts about 1,020 draws and 2.54M triangles with zoom detail, and
  // about 3.0M triangles without. Its dearest frame is the river's
  // reflection: 1,076 draws and 2.63M triangles until the reflections left
  // out figures, grass and the fountain's jets this far out, about 920 and
  // 2.51M since (frame-locked, in the cloud container).
  expect(far.drawCalls).toBeLessThan(1100);
  expect(far.triangles).toBeLessThan(2.65e6);
  // Back at height 27, every pebble and fallen leaf is back.
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) document.querySelector("#zoom-in").click();
  });
  await page.waitForFunction(
    () => window.__willowmere.getDiagnostics().camera.viewHeight < 27.05,
    null,
    { timeout: 600000, polling: 1000 },
  );
  await expect
    .poll(async () => (await sample()).smallShown, { timeout: 600000 })
    .toBe(far.small);
  expect(errors).toEqual([]);
});
