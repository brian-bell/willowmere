import { test, expect } from "@playwright/test";
import {
  TRAILS,
  TREES,
  WOOD,
  logDistance,
  trailDistance,
  woodColliders,
  woodGrass,
  woodGround,
  woodHeight,
  woodPlanting,
} from "../src/regions/wood-layout.js";
import { regionColliders } from "../src/regions/index.js";
import { WORLD, regionAt, terrainHeight } from "../src/world-layout.js";
import { collides, createNavigation } from "../src/game/navigation.js";
import { FLOWERS, PRESS, flowerToSeek, pressFlower } from "../src/game/wood.js";
import { defaultState, loadState } from "../src/game/save.js";
import { journalEntries } from "../src/content/journal.js";

test("the wood's floor rolls gently and meets the lawn at every edge", { tag: "@logic" }, () => {
  const { minX, maxX, minZ, maxZ } = WOOD.ground;
  for (let t = 0; t <= 1; t += 0.02) {
    const x = minX + (maxX - minX) * t,
      z = minZ + (maxZ - minZ) * t;
    for (const [px, pz] of [
      [x, minZ],
      [x, maxZ],
      [minX, z],
      [maxX, z],
    ])
      expect(woodHeight(px, pz), `${px}, ${pz}`).toBe(0);
  }
  // Flat by the village's edge, so the meadow runs straight into it.
  for (let z = -21; z <= 21; z += 0.5) expect(terrainHeight(-24, z)).toBe(0);
  // Never more than about a metre high, below the orchard hill, and never
  // steep; the clearing's floor is level.
  let highest = 0,
    steepest = 0;
  for (let x = minX; x < maxX; x += 0.5)
    for (let z = minZ; z < maxZ; z += 0.5) {
      const h = woodHeight(x, z),
        dx = (woodHeight(x + 0.05, z) - woodHeight(x - 0.05, z)) / 0.1,
        dz = (woodHeight(x, z + 0.05) - woodHeight(x, z - 0.05)) / 0.1;
      expect(h).toBeGreaterThanOrEqual(0);
      highest = Math.max(highest, h);
      steepest = Math.max(steepest, Math.hypot(dx, dz));
    }
  expect(highest).toBeGreaterThan(0.5);
  expect(highest).toBeLessThan(1.4);
  expect(steepest).toBeLessThan(0.5);
  const c = WOOD.clearing;
  for (let a = 0; a < Math.PI * 2; a += 0.5)
    expect(woodHeight(c.x + Math.cos(a) * (c.r - 1.2), c.z + Math.sin(a) * (c.r - 1.2))).toBeCloseTo(
      woodHeight(c.x, c.z),
      6,
    );
  // terrainHeight evaluates the floor exactly, and the label names it.
  expect(terrainHeight(-38, 5)).toBe(woodHeight(-38, 5));
  expect(woodGround(-38, 5)).toBeCloseTo(WOOD.lawn + woodHeight(-38, 5), 6);
  expect(regionAt(c.x, c.z).name).toBe("The old wood");
});

test("trails run clear through the trees, and walkers reach every corner", { tag: "@logic" }, () => {
  const colliders = woodColliders();
  // A real wood: dozens of trees, oaks and amber beeches, none on a trail,
  // none on top of another.
  expect(TREES.length).toBeGreaterThan(40);
  expect(TREES.some((t) => t.kind === "beech") && TREES.some((t) => t.kind === "oak")).toBe(true);
  for (const tree of TREES) {
    expect(trailDistance(tree.x, tree.z), tree.id).toBeGreaterThan(tree.young ? 0.85 : 1.3);
    for (const other of TREES)
      if (other !== tree) expect(Math.hypot(tree.x - other.x, tree.z - other.z)).toBeGreaterThan(1.2);
  }
  // The trails are walkable and grassless; the first starts at the meadow.
  expect(TRAILS[0][0][0]).toBeCloseTo(WOOD.ground.maxX, 5);
  for (const [x, z] of TRAILS.flat()) {
    expect(collides(colliders, x, z), `${x}, ${z}`).toBe(false);
    expect(woodGrass(x, z)).toBe(false);
    expect(woodPlanting(x, z)).toBe(false);
  }
  // Grass grows thick by the meadow and thin under the trees.
  const share = (minX, maxX) => {
    let grows = 0,
      all = 0;
    for (let x = minX; x < maxX; x += 0.13)
      for (let z = -18; z < 18; z += 0.17) {
        if (trailDistance(x, z) < 1) continue;
        all++;
        if (woodGrass(x, z)) grows++;
      }
    return grows / all;
  };
  expect(share(-24.8, -24)).toBeGreaterThan(0.6);
  expect(share(-44, -38)).toBeLessThan(0.25);
  // The great oak, the log and Rowan's table block walking; Rowan's spot,
  // every flower patch's edge and the fairy ring can be reached.
  expect(collides(colliders, WOOD.oak.x, WOOD.oak.z)).toBe(true);
  expect(collides(colliders, WOOD.log.x, WOOD.log.z)).toBe(true);
  expect(logDistance(WOOD.log.x, WOOD.log.z)).toBe(0);
  expect(collides(colliders, WOOD.table.x, WOOD.table.z)).toBe(true);
  expect(collides(colliders, WOOD.residents.rowan.x, WOOD.residents.rowan.z, 0.2)).toBe(false);
  const { findPath } = createNavigation({ walk: WORLD.walk, colliders: regionColliders() });
  const from = { x: -20, z: 5 };
  expect(findPath(from, { x: WOOD.ring.x, z: WOOD.ring.z }).length).toBeGreaterThan(5);
  for (const [id, at] of Object.entries(WOOD.flowers)) {
    expect(at.x, id).toBeGreaterThan(WORLD.walk.minX + 1);
    // A spot within reach of the patch that walkers can get to.
    const near = [0, 1, 2, 3, 4, 5, 6, 7]
      .map((k) => ({ x: at.x + Math.cos(k * 0.785) * 1, z: at.z + Math.sin(k * 0.785) * 1 }))
      .find((p) => !collides(colliders, p.x, p.z, 0.3));
    expect(near, id).toBeTruthy();
    expect(findPath(from, near).length, id).toBeGreaterThan(5);
  }
});

test("each woodland flower presses once, some only at their hour", { tag: "@logic" }, () => {
  const state = defaultState(),
    start = state.coins;
  // The anemones close at blue hour, the honeysuckle opens only then.
  expect(pressFlower(state, "anemone", { dusk: true })).toMatchObject({ kind: "closed" });
  expect(pressFlower(state, "honeysuckle", { dusk: false })).toMatchObject({ kind: "closed" });
  expect(state.coins).toBe(start);
  expect(pressFlower(state, "bluebell", { dusk: false })).toMatchObject({
    kind: "pressed",
    petals: PRESS.firstPetals,
  });
  expect(pressFlower(state, "bluebell", { dusk: true })).toMatchObject({ kind: "again" });
  expect(state.coins).toBe(start + PRESS.firstPetals);
  // Rowan points at a flower still to press, open at this hour when she can.
  expect(flowerToSeek(state, true).when).not.toBe("day");
  expect(flowerToSeek(state, false).when).not.toBe("dusk");
  for (const flower of FLOWERS) pressFlower(state, flower.id, { dusk: flower.when === "dusk" });
  expect(Object.keys(state.pressed)).toHaveLength(FLOWERS.length);
  expect(state.coins).toBe(start + FLOWERS.length * PRESS.firstPetals);
  expect(flowerToSeek(state, false)).toBe(null);
  // Every flower has a patch in the wood.
  for (const flower of FLOWERS) expect(regionAt(WOOD.flowers[flower.id].x, WOOD.flowers[flower.id].z).id).toBe("wood");
  // The journal's entry appears in the wood, and counts the pressings.
  expect(journalEntries(defaultState(), "green").some(([title]) => title === "The old wood")).toBe(false);
  expect(journalEntries(defaultState(), "wood").some(([title]) => title === "The old wood")).toBe(true);
  const entry = journalEntries(state, "green").find(([title]) => title === "The old wood");
  expect(entry[1]).toContain(`${FLOWERS.length} of ${FLOWERS.length} woodland flowers`);
  // Saves from before the wood get its state.
  const storage = () => ({
    getItem: () => JSON.stringify({ quests: { mabel: true }, plants: [], coins: 9 }),
  });
  expect(loadState(storage).state).toMatchObject({ coins: 9, pressed: {} });
});

test("the wood streams in, and a woodland flower presses into the journal", async ({ page }) => {
  test.setTimeout(1800000);
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
  // Standing by the primroses puts the wood's jobs first in the streamer's
  // queue; the rest of the map can keep streaming in behind them.
  await page.evaluate(() => window.__willowmere.moveTo(-26.2, 6.6));
  const expected = [
    "Old wood floor",
    "Old wood trees (middle-east): leaves",
    "Great oak: distant crowns",
    "Old wood logs and stumps",
    "Old wood ferns",
    "Fairy ring",
    "Woodland flowers",
    "Old wood light shafts",
  ];
  await expect
    .poll(
      async () => {
        const names = new Set(
          (await page.evaluate(() => window.__willowmere.getChunks()))
            .flatMap((chunk) => chunk.meshes)
            .map((mesh) => mesh.name),
        );
        const { rowan } = await page.evaluate(() => window.__willowmere.getWood());
        return [...expected.filter((name) => !names.has(name)), ...(rowan ? [] : ["Rowan"])];
      },
      { timeout: 900000, intervals: [5000] },
    )
    .toEqual([]);
  // By the primroses, where the player has stood all along, a press puts
  // one in the journal.
  await expect(page.locator("#interaction")).toBeVisible({ timeout: 180000 });
  await expect(page.locator("#interaction span")).toHaveText("Press a primrose");
  await expect(page.locator("#location-name")).toHaveText("The old wood");
  await page.keyboard.press("e");
  await expect(page.locator("#dialogue")).toBeVisible({ timeout: 60000 });
  await page.keyboard.press("e");
  await expect(page.locator("#dialogue")).toBeHidden({ timeout: 60000 });
  const wood = await page.evaluate(() => window.__willowmere.getWood());
  expect(wood.pressed).toEqual({ primrose: true });
  expect(wood.coins).toBe(124);
  await page.locator("#journal-button").click();
  await expect(page.locator("#journal-content")).toContainText("1 of 7 woodland flowers");
  // The floor lifts the player over its swells.
  const lift = await page.evaluate(() => {
    window.__willowmere.moveTo(-41.5, -3);
    return window.__willowmere.getDiagnostics().position[1];
  });
  expect(lift).toBeGreaterThan(0.4);
  expect(errors).toEqual([]);
});
