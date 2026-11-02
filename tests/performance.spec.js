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
    meshes++;
    triangles += object.geometry.index.count / 3;
    for (const attribute of Object.values(object.geometry.attributes))
      expect(attribute.array.every(Number.isFinite)).toBe(true);
  });
  expect(meshes).toBeLessThan(165);
  // Batching reduces submissions, not the character models' detail.
  expect(triangles).toBeGreaterThan(60000);
  expect(triangles).toBeLessThan(70000);
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
  // This includes individually culled tree geometry and shared flower meshes.
  // The former per-petal garden would allocate over 1,000 geometries here.
  expect(Math.max(...samples.map((s) => s.geometries))).toBeLessThan(320);
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
  // mere, its reeds, the willows and the hide in view, then zoomed out to the
  // cap, where the village's south side joins it. Standing there first
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
        "Willows (west): leaves",
        "Willows (east): leaves",
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
  await page.waitForFunction(() => !window.__willowmere.getStreaming().pending, null, {
    timeout: 600000,
    polling: 1000,
  });
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
  // Which small things show, and what the view submits, over a few frames.
  const sample = () =>
    page.evaluate(async (small) => {
      for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
      const values = [];
      for (let i = 0; i < 4; i++) {
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
        small: meshes.length,
        smallShown: meshes.filter((mesh) => mesh.visible).length,
      };
    }, SMALL);
  await zoomTo("#zoom-out", 39);
  const far = await sample();
  expect(far.small).toBeGreaterThan(30);
  expect(far.smallShown).toBe(0);
  // The village zoomed out as far as it went before the map grew counted
  // up to 1,104 draws and 2.41M triangles; without zoom detail this view
  // counted 2.55M.
  expect(far.drawCalls).toBeLessThan(1000);
  expect(far.triangles).toBeLessThan(2.3e6);
  // Back at the old cap of 30, every pebble and fallen leaf is back.
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) document.querySelector("#zoom-in").click();
  });
  await page.waitForFunction(
    () => window.__willowmere.getDiagnostics().camera.viewHeight < 30.05,
    null,
    { timeout: 600000, polling: 1000 },
  );
  await expect
    .poll(async () => (await sample()).smallShown, { timeout: 600000 })
    .toBe(far.small);
  expect(errors).toEqual([]);
});
