import { test, expect } from "@playwright/test";
import * as T from "three";
import { createLife } from "../src/life.js";
import { createFlowerFactory } from "../src/flowers.js";

test("character batches retain detailed geometry and moving joints", () => {
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

test("flower instances share bounded resources and grow independently", () => {
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

test("scene antialiasing follows the drawing-buffer density", async ({
  browser,
}) => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 3);
  const settle = () =>
    page.evaluate(async () => {
      for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
      return window.__willowmere.getDiagnostics();
    });
  // High quality at retina density supersamples edges, so 2x MSAA suffices.
  expect((await settle()).sceneSamples).toBe(2);
  await page.locator("#settings").click();
  for (const [quality, samples] of [
    ["balanced", 4],
    ["performance", 4],
    ["high", 2],
  ]) {
    await page.locator("#quality").selectOption(quality);
    const diagnostics = await settle();
    expect(diagnostics.sceneSamples).toBe(samples);
    expect(diagnostics.drawCalls).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
  await page.close();
});
