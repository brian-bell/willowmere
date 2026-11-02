import { test, expect } from "@playwright/test";
import * as T from "three";
import {
  MILLPOND,
  millpondColliders,
  millpondDeck,
  millpondGrass,
  millpondGround,
  millpondWater,
  pondShore,
} from "../src/regions/millpond-layout.js";
import { createFishing, FISH } from "../src/fishing.js";
import { sampleWaterField } from "../src/water.js";

// The same test main.js's blocked() makes for a shaped collider.
function blockedBy(colliders, x, z, r = 0.27) {
  return colliders.some((c) => {
    if (c.r !== undefined) return Math.hypot(x - c.x, z - c.z) < r + c.r;
    if (c.w !== undefined) {
      const dx = Math.max(Math.abs(x - c.x) - c.w / 2, 0),
        dz = Math.max(Math.abs(z - c.z) - c.d / 2, 0);
      return dx * dx + dz * dz < r * r;
    }
    return (
      x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r && c.blocks(x, z, r)
    );
  });
}

test("the pond's banks hide its water's edge and meet the lawn level", { tag: "@logic" }, () => {
  const { ground, surface, lawn } = MILLPOND;
  // Around the ground mesh's rim the bank has fallen back to the lawn.
  for (let x = ground.minX; x <= ground.maxX; x += 0.5)
    for (const z of [ground.minZ, ground.maxZ])
      // The brook's channel and banks cross the south edge into the village.
      if (z === ground.minZ || Math.abs(x - MILLPOND.brookX) > 3.2)
        expect(millpondGround(x, z), `${x}, ${z}`).toBeCloseTo(lawn, 2);
  for (let z = ground.minZ; z <= ground.maxZ - 1.5; z += 0.5)
    for (const x of [ground.minX, ground.maxX])
      expect(millpondGround(x, z), `${x}, ${z}`).toBeCloseTo(lawn, 2);
  // Wherever the pond's water ends, the bank stands above its surface, so the
  // water's edge is always tucked under the bank.
  for (let x = ground.minX; x <= ground.maxX; x += 0.25)
    for (let z = ground.minZ; z < MILLPOND.weir.crest; z += 0.25) {
      const s = pondShore(x, z);
      if (s > -0.05 && s < 0.2)
        expect(millpondGround(x, z), `${x}, ${z}`).toBeGreaterThan(surface);
      if (s > 1) expect(millpondGround(x, z)).toBeLessThan(surface - 0.15);
    }
  // The pond is a few metres across and reaches its full depth.
  expect(pondShore(MILLPOND.centre.x, MILLPOND.centre.z)).toBeGreaterThan(4);
  expect(millpondGround(MILLPOND.centre.x, MILLPOND.centre.z)).toBeCloseTo(
    surface - MILLPOND.depth - 0.02,
    2,
  );
});

test("the pond and its brook block walking, except the jetty and footbridge", { tag: "@logic" }, () => {
  const colliders = millpondColliders(),
    { jetty, footbridge } = MILLPOND;
  // Open water, the outlet above the weir, the weir and the brook below it.
  for (const [x, z] of [
    [12.5, -31.2],
    [18, -31],
    [12, -26],
    [12, -24.3],
    [12, -23],
    [12, -22],
  ])
    expect(blockedBy(colliders, x, z), `${x}, ${z}`).toBe(true);
  // The jetty's deck, end to end, and the footbridge's.
  for (let z = jetty.maxZ - 0.3; z > jetty.minZ + 0.2; z -= 0.4)
    expect(blockedBy(colliders, jetty.x, z), `jetty ${z}`).toBe(false);
  for (let x = footbridge.minX; x <= footbridge.maxX; x += 0.4)
    expect(blockedBy(colliders, x, -21), `footbridge ${x}`).toBe(false);
  // Stepping off the jetty's side is blocked.
  expect(blockedBy(colliders, jetty.x + jetty.halfWidth + 0.3, -29)).toBe(true);
  // The banks and lawn around the pond are open.
  for (const [x, z] of [
    [12.5, -37.5],
    [2, -31],
    [23, -31],
    [17.6, -25.5],
    [6, -25],
  ])
    expect(blockedBy(colliders, x, z), `${x}, ${z}`).toBe(false);
  // Decks carry the player above the water.
  expect(millpondDeck(jetty.x, -29)).toBe(jetty.deck);
  expect(millpondDeck(12, -21)).toBeGreaterThan(MILLPOND.brookSurface + 0.2);
  expect(millpondDeck(2, -31)).toBeNull();
  expect(millpondWater(12.5, -31)).toBe(MILLPOND.surface);
  expect(millpondWater(12, -22.5)).toBe(MILLPOND.brookSurface);
  expect(millpondWater(2, -31)).toBeNull();
  // Grass keeps off the water, the banks' waterline and the structures.
  expect(millpondGrass(12.5, -31)).toBe(false);
  expect(millpondGrass(jetty.x, -26.4)).toBe(false);
  expect(millpondGrass(2, -31)).toBe(true);
  expect(millpondGrass(-20, 10)).toBe(true);
});

test("the pond's water body follows its shoreline", { tag: "@logic" }, () => {
  const config = {
    size: [18, 12],
    depth: MILLPOND.depth,
    ramp: 2.2,
    shore: (x, z) => pondShore(x + 12.5, z - 30.5),
  };
  const [centreDepth, , , wet] = sampleWaterField(config, 0, -0.7);
  expect(wet).toBe(1);
  expect(centreDepth).toBeCloseTo(MILLPOND.depth, 2);
  // Dry beyond the shore, wet just inside it.
  expect(sampleWaterField(config, -8.9, -0.7)[3]).toBe(0);
  expect(sampleWaterField(config, -6, 5.9)[3]).toBe(0);
  expect(sampleWaterField(config, -7, -0.7)[3]).toBe(1);
});

test("a cast waits for a bite, which a timely press lands", { tag: "@logic" }, () => {
  const ripples = [];
  const water = { disturb: (...args) => ripples.push(args) };
  let roll = 0.5;
  const fishing = createFishing(T, {
    water,
    body: "millpond",
    surface: MILLPOND.surface,
    random: () => roll,
  });
  const rod = new T.Vector3(7, 1.8, -30);
  expect(fishing.active).toBe(false);
  // Pressing too soon ends the cast.
  fishing.cast(7, -32.6);
  expect(fishing.group.visible).toBe(true);
  expect(ripples.at(-1).slice(0, 3)).toEqual(["millpond", 7, -32.6]);
  fishing.update(1, 1, rod);
  expect(fishing.press()).toEqual({ kind: "early" });
  expect(fishing.active).toBe(false);
  expect(fishing.group.visible).toBe(false);
  // A bite comes within 6.5 seconds and lasts about one.
  fishing.cast(7, -32.6);
  let t = 0;
  while (fishing.phase === "waiting" && t < 7) fishing.update(0.1, (t += 0.1), rod);
  expect(fishing.phase).toBe("bite");
  expect(t).toBeGreaterThanOrEqual(2.5);
  roll = 0.99;
  const caught = fishing.press();
  expect(caught.kind).toBe("catch");
  // The rarest fish comes from the top of the roll.
  expect(caught.fish.id).toBe(FISH.at(-1).id);
  // An unanswered bite slips away.
  roll = 0;
  fishing.cast(7, -32.6);
  let missed = null;
  for (let i = 0; i < 100 && !missed; i++) missed = fishing.update(0.1, i / 10, rod);
  expect(missed).toEqual({ kind: "miss" });
  expect(fishing.active).toBe(false);
});

test("the millpond streams in with its two water bodies and fishing jetty", async ({
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
    .poll(async () => (await page.evaluate(() => window.__willowmere.getStreaming())).pending, {
      timeout: 600000,
    })
    .toBe(0);
  const bodies = await page.evaluate(() =>
    Object.fromEntries(window.__willowmere.getWater().bodies.map((b) => [b.id, b])),
  );
  // The village's brook keeps its own grid; the pond and the brook above the
  // village get grids sized to them.
  expect(bodies.river.resolution).toEqual([64, 640]);
  expect(bodies["millpond"].resolution).toEqual([112, 78]);
  expect(bodies["brook-north"].resolution).toEqual([64, 48]);
  expect(bodies["millpond"].surface).toBeCloseTo(0.42);
  const chunks = await page.evaluate(() => window.__willowmere.getChunks());
  const names = chunks.flatMap((chunk) => chunk.meshes.map((mesh) => mesh.name));
  for (const name of [
    "Millpond banks and bed",
    "Millpond weir cascade",
    "Millpond weir, footbridge, jetty and boathouse",
    "Millpond shore stones",
    "Millpond lily pads",
  ])
    expect(names).toContain(name);
  // A click from the village green to the jetty's end routes over the
  // footbridge and along the bank.
  const route = await page.evaluate(() =>
    window.__willowmere.findPath({ x: -2.8, z: 6.2 }, { x: 7, z: -29.8 }),
  );
  expect(route.length).toBeGreaterThan(20);
  expect(route.at(-1).z).toBeLessThan(-29);
  // Standing on the jetty, the label names the pond and E casts a line. The
  // label and prompts wait until the title card is dismissed.
  await page.locator("#start").click();
  await page.evaluate(() => window.__willowmere.moveTo(7, -29.8));
  await expect(page.locator("#location-name")).toHaveText("The millpond", {
    timeout: 60000,
  });
  await page.keyboard.press("e");
  await expect
    .poll(async () => (await page.evaluate(() => window.__willowmere.getFishing())).phase, {
      timeout: 60000,
    })
    .not.toBe("idle");
  expect(errors).toEqual([]);
});
