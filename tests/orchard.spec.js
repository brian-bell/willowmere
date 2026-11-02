import { test, expect } from "@playwright/test";
import {
  FRUIT_TREES,
  ORCHARD,
  PATH,
  hillHeight,
  orchardColliders,
  orchardGrass,
  orchardGround,
  pathDistance,
} from "../src/regions/orchard-layout.js";
import { WORLD, inVillage, terrainHeight } from "../src/world-layout.js";

// The same test main.js's blocked() makes for circles and boxes.
function blockedBy(colliders, x, z, r = 0.27) {
  return colliders.some((c) => {
    if (c.r !== undefined) return Math.hypot(x - c.x, z - c.z) < r + c.r;
    const dx = Math.max(Math.abs(x - c.x) - c.w / 2, 0),
      dz = Math.max(Math.abs(z - c.z) - c.d / 2, 0);
    return dx * dx + dz * dz < r * r;
  });
}

test("the hill rises from the lawn and falls back to it before the village and the rim", { tag: "@logic" }, () => {
  const { ground, summit, height, lawn } = ORCHARD;
  // Around the hill's ground mesh the slope has reached the lawn, so it meets
  // the fields' flat grass and the village without a step.
  for (let x = ground.minX; x <= ground.maxX; x += 0.25)
    for (const z of [ground.minZ, ground.maxZ]) expect(hillHeight(x, z), `${x}, ${z}`).toBe(0);
  for (let z = ground.minZ; z <= ground.maxZ; z += 0.25)
    for (const x of [ground.minX, ground.maxX]) expect(hillHeight(x, z), `${x}, ${z}`).toBe(0);
  // Nothing of the hill reaches the village or the millpond's ground.
  for (let x = -24; x <= 0; x += 0.5)
    for (let z = -21; z <= -18; z += 0.5) expect(terrainHeight(x, z)).toBe(0);
  for (let z = -42; z <= -20; z += 0.5) expect(hillHeight(0, z)).toBe(0);
  // A few metres high at the summit, with no slope steeper than about 35°
  // (the shady north side; the south side facing the village is gentler).
  expect(hillHeight(summit.x, summit.z)).toBeGreaterThan(height * 0.95);
  expect(orchardGround(summit.x, summit.z)).toBeCloseTo(lawn + hillHeight(summit.x, summit.z), 6);
  let steepest = 0;
  for (let x = ground.minX; x < ground.maxX; x += 0.5)
    for (let z = ground.minZ; z < ground.maxZ; z += 0.5) {
      const dx = (hillHeight(x + 0.05, z) - hillHeight(x - 0.05, z)) / 0.1,
        dz = (hillHeight(x, z + 0.05) - hillHeight(x, z - 0.05)) / 0.1;
      steepest = Math.max(steepest, Math.hypot(dx, dz));
    }
  expect(steepest).toBeLessThan(0.72);
  // The walk box reaches over the summit.
  expect(summit.z).toBeGreaterThan(WORLD.walk.minZ + 4);
});

test("the path climbs from the village to the windmill, clear of trees and footings", { tag: "@logic" }, () => {
  const colliders = orchardColliders();
  // It starts at the village's edge and ends at the windmill's door.
  expect(inVillage(PATH[0][0], PATH[0][1])).toBe(true);
  const [ex, ez] = PATH.at(-1);
  expect(Math.hypot(ex - ORCHARD.windmill.x, ez - ORCHARD.windmill.z)).toBeLessThan(
    ORCHARD.windmill.radius + 0.8,
  );
  // Its length is walkable, and no tree, hive or bench stands on it.
  for (const [x, z] of PATH.slice(0, -6)) {
    expect(blockedBy(colliders, x, z), `${x}, ${z}`).toBe(false);
    expect(orchardGrass(x, z)).toBe(false);
  }
  for (const tree of FRUIT_TREES) {
    expect(pathDistance(tree.x, tree.z), tree.id).toBeGreaterThan(1.8);
    // Rows leave room to walk between trees.
    for (const other of FRUIT_TREES)
      if (other !== tree)
        expect(Math.hypot(tree.x - other.x, tree.z - other.z)).toBeGreaterThan(3.2);
    expect(blockedBy(colliders, tree.x, tree.z)).toBe(true);
    // A tree can be reached from at least one side.
    expect(
      [0, 1, 2, 3].some(
        (i) =>
          !blockedBy(colliders, tree.x + Math.cos(i * 1.57) * 1, tree.z + Math.sin(i * 1.57) * 1),
      ),
    ).toBe(true);
  }
  for (const hive of ORCHARD.hives) {
    expect(blockedBy(colliders, hive.x, hive.z)).toBe(true);
    expect(blockedBy(colliders, hive.x, hive.z + 0.75)).toBe(false);
  }
  expect(blockedBy(colliders, ORCHARD.windmill.x, ORCHARD.windmill.z)).toBe(true);
  // Grass grows on the hill, but not on the path or under the windmill.
  expect(orchardGrass(-30, -35)).toBe(true);
  expect(orchardGrass(ORCHARD.windmill.x, ORCHARD.windmill.z)).toBe(false);
  expect(orchardGrass(20, 10)).toBe(true);
});

test("the orchard hill streams in, and its trees and hives give fruit and honey", async ({
  page,
}) => {
  test.setTimeout(1500000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  await expect
    .poll(async () => (await page.evaluate(() => window.__willowmere.getStreaming())).pending, {
      timeout: 900000,
    })
    .toBe(0);
  const chunks = await page.evaluate(() => window.__willowmere.getChunks());
  const meshes = chunks.flatMap((chunk) => chunk.meshes);
  const names = meshes.map((mesh) => mesh.name);
  for (const name of [
    "Orchard hill ground",
    "Apple trees' leaves",
    "Pear trees' leaves",
    "Apples",
    "Pears",
    "Orchard windmill, hives and bench",
    "Windmill sails",
    "Orchard bees",
    "Orchard clover and wildflowers",
  ])
    expect(names).toContain(name);
  // The hill's pieces join the chunks they stand in, north-west of the village.
  const ground = meshes.find((mesh) => mesh.name === "Orchard hill ground");
  expect(ground.center[0]).toBeLessThan(-8);
  expect(ground.center[2]).toBeLessThan(-21);
  // A click from the village green to the bench routes up the hill.
  const route = await page.evaluate(() =>
    window.__willowmere.findPath({ x: -2.8, z: 6.2 }, { x: -21.2, z: -28.4 }),
  );
  expect(route.length).toBeGreaterThan(20);
  // Beside an apple tree high on the slope, the player stands on the hill.
  await page.evaluate(() => document.querySelector("#start").click());
  const tree = await page.evaluate(() => {
    const t = { x: -29.8, z: -28 };
    window.__willowmere.moveTo(t.x, t.z + 1.1, Math.PI);
    return window.__willowmere.getPlayer();
  });
  const standing = await page.evaluate(() => window.__willowmere.getDiagnostics().position[1]);
  expect(standing).toBeGreaterThan(1.5);
  await expect(page.locator("#location-name")).toHaveText("The orchard hill", {
    timeout: 120000,
  });
  // E shakes the apple tree: three apples into the basket, then it rests.
  await expect(page.locator("#interaction span")).toHaveText("Shake the apple tree", {
    timeout: 120000,
  });
  await page.keyboard.press("e");
  await expect
    .poll(async () => (await page.evaluate(() => window.__willowmere.getOrchard())).basket.apple, {
      timeout: 60000,
    })
    .toBe(3);
  await page.keyboard.press("e");
  await expect(page.locator("#toast")).toContainText("Nothing more is ripe", { timeout: 60000 });
  let orchard = await page.evaluate(() => window.__willowmere.getOrchard());
  expect(orchard.basket.apple).toBe(3);
  expect(orchard.shaken).toEqual(["apple-9"]);
  // A hive gives a jar of honey.
  await page.evaluate(() => window.__willowmere.moveTo(-36.3, -31.3, Math.PI));
  await expect(page.locator("#interaction span")).toHaveText("Collect honey", {
    timeout: 120000,
  });
  await page.keyboard.press("e");
  await expect
    .poll(async () => (await page.evaluate(() => window.__willowmere.getOrchard())).basket.honey, {
      timeout: 60000,
    })
    .toBe(1);
  // The harvest survives a reload, and the shaken tree stays picked.
  await page.reload();
  await page.waitForFunction(() => window.__willowmere?.getOrchard().ready, null, {
    timeout: 600000,
  });
  orchard = await page.evaluate(() => window.__willowmere.getOrchard());
  expect(orchard.basket).toEqual({ apple: 3, pear: 0, honey: 1 });
  expect(orchard.harvested).toEqual({ apple: 3, pear: 0, honey: 1 });
  expect(tree.z).toBeCloseTo(-26.9, 1);
  expect(errors).toEqual([]);
});

test("far trees in first person draw crowns that still cast shadows", async ({ page }) => {
  test.setTimeout(900000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        viewMode: "first-person",
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  // From the bench on the hill, looking back over the village.
  await page.evaluate(() => window.__willowmere.moveTo(-21, -27.6, 0.65));
  for (let i = 0; i < 3; i++) await page.evaluate(() => new Promise(requestAnimationFrame));
  const near = await page.evaluate(() => window.__willowmere.getTrees());
  // Trees more than 40 m off show crowns instead of leaves, and the crowns
  // cast shadows; nearer ones keep their leaves.
  const far = near.filter((t) => t.distance > 40.5),
    close = near.filter((t) => t.distance < 39.5);
  expect(far.length).toBeGreaterThan(2);
  expect(close.length).toBeGreaterThan(2);
  for (const t of far) expect(t).toMatchObject({ leaves: false, crown: true, crownShadow: true });
  for (const t of close) expect(t).toMatchObject({ leaves: true, crown: false });
  // Back in the overview every tree has its leaves again.
  await page.evaluate(() => document.querySelector("#view-toggle").click());
  for (let i = 0; i < 3; i++) await page.evaluate(() => new Promise(requestAnimationFrame));
  const overview = await page.evaluate(() => window.__willowmere.getTrees());
  for (const t of overview) expect(t).toMatchObject({ leaves: true, crown: false });
});
