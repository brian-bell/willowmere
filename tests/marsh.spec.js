import { test, expect } from "@playwright/test";
import {
  MARSH,
  TRAILS,
  footbridgeDeck,
  hideDoor,
  marshColliders,
  marshDeck,
  marshGrass,
  marshGround,
  marshShore,
  marshWater,
  shorePoint,
} from "../src/regions/marsh-layout.js";
import { brookEdge } from "../src/regions/millpond-layout.js";
import { regionColliders } from "../src/regions/index.js";
import { WORLD, regionAt } from "../src/world-layout.js";
import { collides, createNavigation } from "../src/game/navigation.js";
import { BIRDS, WATCH, birdToSeek, watchBirds } from "../src/game/marsh.js";
import { defaultState, loadState } from "../src/game/save.js";

test("the brook runs on into the mere, whose banks hide its water's edge", { tag: "@logic" }, () => {
  // Where it leaves the village, the brook keeps the village brook's shape.
  for (const x of [9.5, 10.5, 12, 13.5, 14.5])
    expect(marshShore(x, 21.2)).toBeCloseTo(brookEdge(21.2) - Math.abs(x - 12), 5);
  expect(marshWater(12, 23)).toBe(MARSH.surface);
  expect(marshWater(MARSH.centre.x, MARSH.centre.z)).toBe(MARSH.surface);
  expect(marshWater(12, 20.9)).toBe(null);
  for (const island of MARSH.islands) expect(marshWater(island.x, island.z)).toBe(null);
  // Round the mere, the bank rises above the water just inside its edge.
  for (let angle = -Math.PI; angle < Math.PI; angle += 0.2) {
    const [x, z] = shorePoint(angle, 0);
    if (z < 26) continue;
    expect(marshGround(x, z), `${angle}`).toBeGreaterThan(MARSH.surface);
    // A metre and a half out (clear of the islands), the bed lies well under it.
    const [wx, wz] = shorePoint(angle, 1.5);
    if (marshShore(wx, wz) > 1.2) expect(marshGround(wx, wz)).toBeLessThan(MARSH.surface - 0.1);
  }
  // Its ground meets the lawn at every edge.
  const { minX, maxX, minZ, maxZ } = MARSH.ground;
  for (let t = 0; t <= 1; t += 0.05) {
    expect(marshGround(minX + (maxX - minX) * t, maxZ)).toBeCloseTo(MARSH.lawn, 5);
    expect(marshGround(minX, minZ + (maxZ - minZ) * t)).toBeCloseTo(MARSH.lawn, 5);
    expect(marshGround(maxX, minZ + (maxZ - minZ) * t)).toBeCloseTo(MARSH.lawn, 5);
  }
  for (const x of [minX, 5, 20, maxX]) expect(marshGround(x, minZ)).toBeCloseTo(MARSH.lawn, 2);
  expect(regionAt(MARSH.hide.x, MARSH.hide.z).name).toBe("The willow marsh");
});

test("the water blocks walking, except the boardwalk and the footbridge", { tag: "@logic" }, () => {
  const colliders = marshColliders();
  // Open water and the brook's channel are closed to walkers.
  expect(collides(colliders, MARSH.centre.x, MARSH.centre.z)).toBe(true);
  expect(collides(colliders, 12, 23.5)).toBe(true);
  // The boardwalk carries them across the shallows, raised above the water.
  const { points, deck } = MARSH.boardwalk;
  for (let i = 0; i < points.length - 1; i++)
    for (let t = 0; t <= 1; t += 0.1) {
      const x = points[i][0] + (points[i + 1][0] - points[i][0]) * t,
        z = points[i][1] + (points[i + 1][1] - points[i][1]) * t;
      expect(collides(colliders, x, z), `${x}, ${z}`).toBe(false);
      expect(marshDeck(x, z)).toBeGreaterThan(marshGround(x, z));
    }
  expect(marshDeck(7.1, 29.6)).toBeCloseTo(deck, 5);
  // Its ends ramp down to the ground, without a step.
  const [sx, sz] = points[0];
  expect(marshDeck(sx, sz) - (marshGround(sx, sz) + 0.05)).toBeCloseTo(0, 5);
  // The footbridge's deck is humped, its rails keep walkers on it.
  const f = MARSH.footbridge,
    middle = (f.minZ + f.maxZ) / 2;
  expect(marshDeck(12, middle)).toBeCloseTo(footbridgeDeck(12), 5);
  expect(footbridgeDeck(12)).toBeGreaterThan(footbridgeDeck(f.minX) + 0.15);
  expect(collides(colliders, 12, middle)).toBe(false);
  expect(collides(colliders, 12, f.minZ)).toBe(true);
  expect(collides(colliders, 12, f.maxZ)).toBe(true);
  // The trails are clear and grassless; the hide's door, the bench and
  // Wren's spot can be reached.
  for (const [x, z] of TRAILS.flat()) {
    expect(collides(colliders, x, z), `${x}, ${z}`).toBe(false);
    expect(marshGrass(x, z)).toBe(false);
  }
  const door = hideDoor();
  expect(collides(colliders, door.x, door.z)).toBe(false);
  expect(door.z).toBeLessThan(WORLD.walk.maxZ - 0.3);
  expect(collides(colliders, MARSH.hide.x, MARSH.hide.z)).toBe(true);
  expect(collides(colliders, MARSH.residents.wren.x, MARSH.residents.wren.z, 0.2)).toBe(false);
  // Grass grows on the wet meadow, not in the water or under the hide.
  expect(marshGrass(2, 38)).toBe(true);
  expect(marshGrass(MARSH.centre.x, MARSH.centre.z)).toBe(false);
  expect(marshGrass(MARSH.hide.x, MARSH.hide.z)).toBe(false);
  // Walkers route from the village over the footbridge, round the trails to
  // the hide, and out along the boardwalk.
  const { findPath } = createNavigation({ walk: WORLD.walk, colliders: regionColliders() });
  expect(findPath({ x: 8.4, z: 19 }, door).length).toBeGreaterThan(10);
  expect(findPath({ x: 15.6, z: 19 }, { x: 8, z: 31.6 }).length).toBeGreaterThan(10);
  expect(findPath({ x: 3.6, z: 25.5 }, { x: 10.6, z: 33.8 }).length).toBeGreaterThan(5);
});

test("the hide shows a bird at a time, some only at blue hour", { tag: "@logic" }, () => {
  const state = defaultState(),
    start = state.coins,
    rolls = (values) => {
      let i = 0;
      return () => values[i++ % values.length];
    };
  // An unseen bird is the likelier sighting, and the first of each pays.
  let result = watchBirds(state, { dusk: false, now: 1000, roll: rolls([0.1, 0]) });
  expect(result).toMatchObject({ kind: "seen", bird: BIRDS[0], first: true, petals: WATCH.firstPetals });
  expect(state.birds).toEqual({ [BIRDS[0].id]: 1 });
  expect(state.coins).toBe(start + WATCH.firstPetals);
  // The reeds settle before the next.
  expect(watchBirds(state, { dusk: false, now: 1000 + WATCH.restMs - 1, roll: Math.random })).toEqual({
    kind: "quiet",
  });
  // Afternoon birds keep to the afternoon, blue hour's to blue hour.
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const now = 2000 + (i + 1) * WATCH.restMs,
      dusk = i % 2 === 1,
      watch = watchBirds(state, { dusk, now, roll: Math.random });
    expect(watch.kind).toBe("seen");
    expect(watch.bird.when === "any" || (watch.bird.when === "dusk") === dusk).toBe(true);
    seen.add(watch.bird.id);
  }
  expect(seen.size).toBe(BIRDS.length);
  expect(state.coins).toBe(start + BIRDS.length * WATCH.firstPetals);
  // Wren points at a bird still to see, about at this hour when she can.
  const fresh = defaultState();
  expect(birdToSeek(fresh, true).when).not.toBe("day");
  expect(birdToSeek(fresh, false).when).not.toBe("dusk");
  for (const bird of BIRDS) if (bird.when !== "dusk") fresh.birds[bird.id] = 1;
  expect(birdToSeek(fresh, false).when).toBe("dusk");
  expect(birdToSeek(state, false)).toBe(null);
  // Saves from before the marsh get its state.
  const storage = () => ({
    getItem: () => JSON.stringify({ quests: { mabel: true }, plants: [], coins: 9 }),
  });
  const { state: loaded } = loadState(storage);
  expect(loaded).toMatchObject({ coins: 9, birds: {}, watched: 0 });
});

test("the marsh streams in, and its hide shows the player a bird", async ({ page }) => {
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
  await expect
    .poll(async () => (await page.evaluate(() => window.__willowmere.getStreaming())).pending, {
      timeout: 900000,
    })
    .toBe(0);
  const names = (await page.evaluate(() => window.__willowmere.getChunks()))
    .flatMap((chunk) => chunk.meshes)
    .map((mesh) => mesh.name);
  for (const name of [
    "Marsh ground, banks and bed",
    "Marsh footbridge and boardwalk",
    "Marsh hide and bench",
    "Willows (west): leaves",
    "Willows (east): distant crowns",
    "Marsh lily pads",
    "Marsh heron",
    "Marsh fireflies",
  ])
    expect(names).toContain(name);
  const water = await page.evaluate(() => window.__willowmere.getWater());
  expect(JSON.stringify(water)).toContain("marsh");
  let marsh = await page.evaluate(() => window.__willowmere.getMarsh());
  expect(marsh).toMatchObject({ wren: true, heron: true, birds: {} });
  // The boardwalk's deck lifts the player over the water.
  const deck = await page.evaluate(() => {
    window.__willowmere.moveTo(7.1, 29.6);
    return window.__willowmere.getDiagnostics().position[1];
  });
  expect(deck).toBeGreaterThan(0.3);
  // At the hide's door, a watch shows a bird and writes it in the journal.
  await page.evaluate(() => window.__willowmere.moveTo(13.5, 37));
  await expect(page.locator("#interaction span")).toHaveText("Watch for birds", { timeout: 180000 });
  await expect(page.locator("#location-name")).toHaveText("The willow marsh");
  await page.keyboard.press("e");
  await expect(page.locator("#dialogue")).toBeVisible({ timeout: 60000 });
  await page.keyboard.press("e");
  await page.keyboard.press("e");
  await expect(page.locator("#dialogue")).toBeHidden({ timeout: 60000 });
  marsh = await page.evaluate(() => window.__willowmere.getMarsh());
  expect(Object.keys(marsh.birds)).toHaveLength(1);
  expect(marsh.coins).toBe(125);
  await page.locator("#journal-button").click();
  await expect(page.locator("#journal-content")).toContainText("1 of 7 marsh birds");
  expect(errors).toEqual([]);
});
