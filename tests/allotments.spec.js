import { test, expect } from "@playwright/test";
import {
  ALLOTMENTS,
  FENCE_RUNS,
  allotmentColliders,
  allotmentGrass,
  allotmentPlanting,
  pathDistance,
  plotFront,
} from "../src/regions/allotments-layout.js";
import { regionColliders, regions } from "../src/regions/index.js";
import { WORLD, regionAt, terrainHeight } from "../src/world-layout.js";
import { collides, createNavigation } from "../src/game/navigation.js";
import {
  CROPS,
  FIRST_HARVEST_PETALS,
  PLOTS,
  RENT,
  basilTopic,
  plotStage,
  tendPlot,
  waterPlot,
} from "../src/game/allotments.js";
import { defaultState, loadState } from "../src/game/save.js";
import { journalEntries } from "../src/content/journal.js";

const A = ALLOTMENTS;

test("the allotments lie flat south of the kitchen garden, fenced, with paths in", { tag: "@logic" }, () => {
  // Flat ground on the fields' own grass, inside the map, beside the marsh
  // and clear of every other region's ground.
  for (let x = A.fence.minX; x <= A.fence.maxX; x += 1)
    for (let z = A.fence.minZ; z <= A.fence.maxZ; z += 1) {
      expect(terrainHeight(x, z)).toBe(0);
      expect(regionAt(x, z).name).toBe("The allotments");
      expect(regions.some((r) => r.ground && x >= r.ground.minX && x <= r.ground.maxX && z >= r.ground.minZ && z <= r.ground.maxZ)).toBe(false);
    }
  expect(A.fence.maxZ).toBeLessThan(WORLD.walk.maxZ);
  expect(A.fence.minX).toBeGreaterThan(WORLD.village.minX);
  // The main path leaves the village's garden road and runs down to the
  // shed; the cross path runs out through both side gates.
  const colliders = allotmentColliders();
  for (let z = A.path.fromZ; z <= A.path.toZ; z += 0.25) {
    expect(collides(colliders, A.path.x, z), `path ${z}`).toBe(false);
    expect(allotmentGrass(A.path.x, z)).toBe(false);
    expect(allotmentPlanting(A.path.x, z)).toBe(false);
  }
  for (let x = A.fence.minX - 0.8; x <= A.fence.maxX + 0.8; x += 0.25) {
    expect(collides(colliders, x, A.crossPath.z), `cross ${x}`).toBe(false);
    expect(pathDistance(x, A.crossPath.z)).toBeLessThan(0);
  }
  // The fence closes everywhere but its three gates.
  for (const [x1, z1, x2, z2] of FENCE_RUNS)
    for (let t = 0.05; t < 1; t += 0.1) expect(collides(colliders, x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)).toBe(true);
  // Beds block walking and grow no meadow grass; between them it grows.
  for (const plot of [...A.plots, ...A.neighbours]) {
    expect(collides(colliders, plot.x, plot.z), plot.id).toBe(true);
    expect(allotmentGrass(plot.x, plot.z)).toBe(false);
    expect(allotmentPlanting(plot.x + plot.w / 2 + 0.2, plot.z)).toBe(false);
  }
  expect(allotmentGrass(-17.5, 23)).toBe(true);
  expect(allotmentGrass(-30, 30)).toBe(true);
});

test("walkers reach every bed, Basil and the shed from the village", { tag: "@logic" }, () => {
  const colliders = allotmentColliders();
  const { findPath } = createNavigation({ walk: WORLD.walk, colliders: regionColliders() });
  const from = { x: -12, z: 14 },
    spots = {
      ...Object.fromEntries(A.plots.map((plot) => [plot.id, plotFront(plot)])),
      shed: { x: A.shed.x - 0.8, z: A.shed.z - A.shed.d / 2 - 0.6 },
      coldFrames: { x: A.coldFrames.x, z: A.coldFrames.z - 1.05 },
      compost: { x: A.compost.x, z: A.compost.z - 1.15 },
      east: { x: A.fence.maxX + 2, z: A.crossPath.z },
      west: { x: A.fence.minX - 2, z: A.crossPath.z },
    };
  for (const [id, at] of Object.entries(spots)) {
    expect(collides(colliders, at.x, at.z, 0.3), id).toBe(false);
    expect(findPath(from, at).length, id).toBeGreaterThan(3);
  }
  // Basil stands off the path, where no footing is.
  const { basil } = A.residents;
  expect(collides(colliders, basil.x, basil.z, 0.25)).toBe(false);
  expect(pathDistance(basil.x, basil.z)).toBeGreaterThan(0.2);
  // Every bed to let fronts on the cross path.
  for (const plot of A.plots) expect(Math.abs(plotFront(plot).z - A.crossPath.z)).toBeLessThan(1);
});

test("a bed is rented, sown, watered, grown and harvested into the basket", { tag: "@logic" }, () => {
  const state = defaultState(),
    start = state.coins,
    seeds = state.seeds,
    t = 1_000_000;
  expect(PLOTS.map((plot) => plot.crop).sort()).toEqual(Object.keys(CROPS).sort());
  expect(plotStage(state, "carrots", t)).toEqual({ stage: "free", growth: 0 });
  expect(basilTopic(state, t)).toMatchObject({ topic: "rent" });
  // Too few petals: nothing changes.
  state.coins = RENT - 1;
  expect(tendPlot(state, "carrots", t)).toEqual({ kind: "short", price: RENT });
  expect(state.plots).toEqual({});
  state.coins = start;
  expect(tendPlot(state, "carrots", t)).toEqual({ kind: "rented", price: RENT });
  expect(state.coins).toBe(start - RENT);
  expect(basilTopic(state, t)).toEqual({ topic: "empty", crop: "carrot" });
  // Sowing takes a seed from the pouch; an empty pouch sows nothing.
  expect(tendPlot(state, "carrots", t)).toEqual({ kind: "sown", crop: "carrot" });
  expect(state.seeds).toBe(seeds - 1);
  expect(plotStage(state, "carrots", t + 1e9).stage).toBe("sown");
  expect(basilTopic(state, t)).toEqual({ topic: "sown", crop: "carrot" });
  // It grows only once watered, by the watering can or by hand.
  expect(waterPlot(state, "carrots", t)).toBe(true);
  expect(waterPlot(state, "carrots", t)).toBe(false);
  const grow = CROPS.carrot.growMs;
  expect(plotStage(state, "carrots", t + grow / 2)).toEqual({ stage: "growing", growth: 0.5 });
  expect(tendPlot(state, "carrots", t + grow / 2)).toMatchObject({ kind: "growing", growth: 0.5 });
  expect(basilTopic(state, t + grow / 2)).toEqual({ topic: "rent", crop: "lettuce" });
  expect(plotStage(state, "carrots", t + grow).stage).toBe("ripe");
  expect(basilTopic(state, t + grow)).toEqual({ topic: "ripe", crop: "carrot" });
  // The first harvest of a crop pays a little; the bed is ready to sow again.
  expect(tendPlot(state, "carrots", t + grow)).toEqual({
    kind: "harvested",
    crop: "carrot",
    count: CROPS.carrot.yield,
    first: true,
    petals: FIRST_HARVEST_PETALS,
  });
  expect(state.basket.carrot).toBe(CROPS.carrot.yield);
  expect(state.harvested.carrot).toBe(CROPS.carrot.yield);
  expect(state.coins).toBe(start - RENT + FIRST_HARVEST_PETALS);
  expect(plotStage(state, "carrots", t + grow).stage).toBe("empty");
  tendPlot(state, "carrots", t + grow);
  tendPlot(state, "carrots", t + grow);
  expect(tendPlot(state, "carrots", t + 3 * grow)).toMatchObject({ kind: "harvested", first: false, petals: 0 });
  state.seeds = 0;
  expect(tendPlot(state, "carrots", t)).toEqual({ kind: "no-seeds" });
  // The journal counts the beds and the harvest.
  expect(journalEntries(defaultState(), "green").some(([title]) => title === "The allotments")).toBe(false);
  expect(journalEntries(defaultState(), "allotments").some(([title]) => title === "The allotments")).toBe(true);
  const entry = journalEntries(state, "green").find(([title]) => title === "The allotments");
  expect(entry[1]).toContain(`${2 * CROPS.carrot.yield} carrots`);
  // Saves from before the allotments get their state and empty crop baskets.
  const storage = () => ({
    getItem: () =>
      JSON.stringify({ quests: { mabel: true }, plants: [], coins: 9, basket: { apple: 2, pear: 0, honey: 1 } }),
  });
  expect(loadState(storage).state).toMatchObject({
    coins: 9,
    plots: {},
    basket: { apple: 2, honey: 1, carrot: 0, lettuce: 0, bean: 0, pumpkin: 0 },
  });
});

test("the allotments stream in, and a bed is rented, grown, harvested and sold", async ({ page }) => {
  test.setTimeout(1800000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // The lettuce bed is rented and was watered long enough ago to be ripe.
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
        plots: { lettuces: { rented: true, sown: 1, watered: 1 } },
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  // Standing at the carrot bed puts the allotments' jobs first in the
  // streamer's queue.
  const carrots = plotFront(A.plots[0]);
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x, z), carrots);
  const expected = ["Allotment paths", "Allotments (west)", "Allotments (east)", "Allotment to-let boards"];
  await expect
    .poll(
      async () => {
        const names = new Set(
          (await page.evaluate(() => window.__willowmere.getChunks()))
            .flatMap((chunk) => chunk.meshes)
            .map((mesh) => mesh.name),
        );
        const { basil } = await page.evaluate(() => window.__willowmere.getAllotments());
        return [...expected.filter((name) => !names.has(name)), ...(basil ? [] : ["Basil"])];
      },
      { timeout: 900000, intervals: [5000] },
    )
    .toEqual([]);
  // Only the ripe lettuces show; the other three beds carry "to let" boards.
  let allotments = await page.evaluate(() => window.__willowmere.getAllotments());
  expect(allotments.crops).toEqual({ carrots: false, lettuces: true, "runner beans": false, pumpkins: false });
  expect(allotments.boards).toBe(3);
  // At the carrot bed: rent it, sow it, water it.
  await expect(page.locator("#interaction")).toBeVisible({ timeout: 180000 });
  await expect(page.locator("#location-name")).toHaveText("The allotments");
  await expect(page.locator("#interaction span")).toHaveText(`Rent this plot · ${RENT} petals`);
  const tend = async () => {
    await page.keyboard.press("e");
    await expect(page.locator("#dialogue")).toBeVisible({ timeout: 60000 });
    await page.keyboard.press("e");
    await expect(page.locator("#dialogue")).toBeHidden({ timeout: 60000 });
  };
  await tend();
  await expect(page.locator("#interaction span")).toHaveText("Sow carrots", { timeout: 60000 });
  await tend();
  await tend();
  allotments = await page.evaluate(() => window.__willowmere.getAllotments());
  expect(allotments.coins).toBe(120 - RENT);
  expect(allotments.seeds).toBe(4);
  expect(allotments.plots.carrots.watered).toBeGreaterThan(0);
  expect(allotments.boards).toBe(2);
  await expect.poll(async () => (await page.evaluate(() => window.__willowmere.getAllotments())).crops.carrots, { timeout: 60000 }).toBe(true);
  // Harvest the lettuces from their bed's front.
  const lettuces = plotFront(A.plots[1]);
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x, z), lettuces);
  await expect(page.locator("#interaction span")).toHaveText("Harvest the lettuces", { timeout: 60000 });
  await tend();
  allotments = await page.evaluate(() => window.__willowmere.getAllotments());
  expect(allotments.basket.lettuce).toBe(CROPS.lettuce.yield);
  expect(allotments.coins).toBe(120 - RENT + FIRST_HARVEST_PETALS);
  expect(allotments.crops.lettuces).toBe(false);
  // Finn buys them at the bakery.
  await page.evaluate(() => window.__willowmere.moveTo(1.6, -3.4));
  await expect(page.locator("#interaction span")).toHaveText("Say hello to Finn", { timeout: 60000 });
  await page.keyboard.press("e");
  await expect(page.locator("#dialogue")).toBeVisible({ timeout: 60000 });
  for (let i = 0; i < 4 && (await page.locator("#dialogue").isVisible()); i++) await page.keyboard.press("e");
  await expect(page.locator("#dialogue")).toBeHidden({ timeout: 60000 });
  allotments = await page.evaluate(() => window.__willowmere.getAllotments());
  expect(allotments.basket.lettuce).toBe(0);
  expect(allotments.coins).toBe(120 - RENT + FIRST_HARVEST_PETALS + CROPS.lettuce.yield * CROPS.lettuce.price);
  await page.locator("#journal-button").click();
  await expect(page.locator("#journal-content")).toContainText("3 lettuces");
  expect(errors).toEqual([]);
});
