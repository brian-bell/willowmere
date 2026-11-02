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
