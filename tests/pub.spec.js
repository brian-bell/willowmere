import { test, expect } from "@playwright/test";
import { createInteriorWalker } from "../src/interior-movement.js";
import {
  GREAT_ROOM,
  LOFT,
  PUB,
  WALK,
  floorHeight,
  groundColliders,
  levelAt,
  loftColliders,
} from "../src/pub/layout.js";
import { HERON_DOOR, heronColliders } from "../src/regions/heron-layout.js";
import { marketColliders } from "../src/regions/market-layout.js";
import { WORLD } from "../src/world-layout.js";

// Flood-fills the walkable floor from the street with the study's own walker
// and colliders, crossing storeys only where the stair's flight allows it.
function walkableFromStreet() {
  const step = 0.1,
    colliders = { ground: groundColliders(), loft: loftColliders() },
    blockers = {};
  for (const level of ["ground", "loft"])
    blockers[level] = createInteriorWalker({
      bounds: WALK.bounds,
      colliders: colliders[level],
      spawn: WALK.spawn,
    });
  const key = (level, i, j) => `${level}/${i}/${j}`,
    start = ["ground", Math.round(WALK.spawn.x / step), Math.round(WALK.spawn.z / step)],
    seen = new Set([key(...start)]),
    queue = [start];
  while (queue.length) {
    const [level, i, j] = queue.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = (i + di) * step,
        z = (j + dj) * step;
      if (blockers[level].blocked(x, z)) continue;
      const next = levelAt(level, x, z),
        k = key(next, i + di, j + dj);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push([next, i + di, j + dj]);
    }
  }
  return (level, x, z, reach = 0.2) => {
    const r = Math.round(reach / step);
    for (let a = -r; a <= r; a++)
      for (let b = -r; b <= r; b++)
        if (seen.has(key(level, Math.round(x / step) + a, Math.round(z / step) + b))) return true;
    return false;
  };
}

test("a visitor can walk from the street to everywhere the inn is for", { tag: "@logic" }, () => {
  const reached = walkableFromStreet(),
    { bar, longTable, snug, booths, squareTable } = GREAT_ROOM;
  // Downstairs: the hearth rug, every seat's side and behind the bar.
  expect(reached("ground", -4.3, 0), "the hearth rug").toBe(true);
  expect(reached("ground", longTable.x, longTable.z + 1.2), "the long table").toBe(true);
  expect(reached("ground", squareTable.x + 1.0, squareTable.z), "the square table").toBe(true);
  expect(reached("ground", snug.x + 1.15, snug.z + 0.2), "the snug").toBe(true);
  for (const o of booths)
    expect(reached("ground", o.x, o.z - 1.05), `the booth at ${o.x}`).toBe(true);
  expect(reached("ground", 1, bar.maxZ + 0.6), "the bar's front").toBe(true);
  expect(reached("ground", 1, -2.7), "behind the bar").toBe(true);
  expect(reached("ground", 3.4, -4.6), "the kitchen, through the back-bar door").toBe(true);
  // Upstairs, only by the flight: the walkways, the balcony, every bed.
  expect(reached("loft", 0, 2.2), "the loft's front walkway").toBe(true);
  expect(reached("loft", 0, -2.2), "the loft's rear walkway").toBe(true);
  expect(reached("loft", 0.8, 4.7), "the balcony").toBe(true);
  for (const c of LOFT.cots) {
    const beside =
      reached("loft", c.x, c.z + LOFT.cot.width / 2 + 0.28) ||
      reached("loft", c.x, c.z - LOFT.cot.width / 2 - 0.28) ||
      reached("loft", c.x - LOFT.cot.length / 2 - 0.28, c.z);
    expect(beside, `the cot at ${c.x}, ${c.z}`).toBe(true);
  }
  for (const b of LOFT.beds)
    expect(reached("loft", b.x, b.z - LOFT.bed.width / 2 - 0.3), `the bed at ${b.x}`).toBe(true);
  // And nobody falls down the well or steps off the balcony's rail.
  expect(reached("loft", -1.3, 0, 0), "standing in the well").toBe(false);
  expect(reached("loft", 0, PUB.gallery.front + 0.5, 0), "beyond the balcony's rail").toBe(false);
});

test("the stair's flight climbs smoothly and hands over storeys halfway", { tag: "@logic" }, () => {
  const { minX, maxX, bottomZ, topZ } = PUB.stair,
    x = (minX + maxX) / 2;
  let level = "ground",
    previous = 0;
  for (let z = bottomZ + 0.3; z >= topZ - 0.3; z -= 0.05) {
    level = levelAt(level, x, z);
    const y = floorHeight(level, x, z);
    expect(y - previous).toBeLessThan(0.08);
    expect(y).toBeGreaterThanOrEqual(previous);
    previous = y;
  }
  expect(level).toBe("loft");
  expect(previous).toBeCloseTo(PUB.loft);
  // Coming down delivers you to the flags again, with no drop on the way.
  for (let z = topZ - 0.3; z <= bottomZ + 0.3; z += 0.05) {
    level = levelAt(level, x, z);
    const y = floorHeight(level, x, z);
    expect(previous - y).toBeLessThan(0.08);
    previous = y;
  }
  expect(level).toBe("ground");
  expect(previous).toBe(0);
});

test("the study opens every view and cutaway within its budget, without errors", async ({ page }) => {
  test.setTimeout(300000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/pub-study.html");
  await page.waitForFunction(() => window.__pubStudy);
  const settle = () =>
    page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const counts = {};
  for (const view of await page.locator("#view option").evaluateAll((o) => o.map((e) => e.value))) {
    await page.selectOption("#view", view);
    await settle();
    counts[view] = await page.evaluate(() => window.__pubStudy.diagnostics());
    expect(counts[view].drawCalls, view).toBeLessThan(450);
    expect(counts[view].triangles, view).toBeLessThan(1.8e6);
  }
  // Each cutaway takes real work away from the same whole-building view.
  await page.selectOption("#cutaway", "roof");
  await settle();
  const roofLifted = await page.evaluate(() => window.__pubStudy.diagnostics());
  await page.selectOption("#cutaway", "loft");
  await settle();
  const loftLifted = await page.evaluate(() => window.__pubStudy.diagnostics());
  expect(loftLifted.triangles).toBeLessThan(roofLifted.triangles);
  // The lamps are a fixed set: blue hour changes their strength, and compiles
  // nothing new. Compare the same view both ways once it has drawn.
  await page.selectOption("#view", "room");
  await settle();
  const programs = (await page.evaluate(() => window.__pubStudy.diagnostics())).programs;
  await page.click("#light");
  await settle();
  expect((await page.evaluate(() => window.__pubStudy.diagnostics())).programs).toBe(programs);
  expect(errors).toEqual([]);
});

test("walking in by the door, up the stairs and out onto the balcony", async ({ page }) => {
  test.setTimeout(300000);
  await page.goto("/pub-study.html");
  await page.waitForFunction(() => window.__pubStudy);
  await page.click("#walk");
  const at = () => page.evaluate(() => window.__pubStudy.walk.position());
  const place = (pose) => page.evaluate((p) => window.__pubStudy.walk.place(p), pose);
  // From the street through the open front door, with real key presses.
  await place({ x: 0, z: 6.2, yaw: 0, pitch: 0 });
  await page.keyboard.down("KeyW");
  await expect.poll(async () => (await at()).z, { timeout: 120000 }).toBeLessThan(3);
  await page.keyboard.up("KeyW");
  expect((await at()).level).toBe("ground");
  // Up the flight from its foot.
  const { minX, maxX, bottomZ, topZ } = PUB.stair;
  await place({ x: (minX + maxX) / 2, z: bottomZ + 0.1, yaw: 0, pitch: 0 });
  await page.keyboard.down("KeyW");
  await expect.poll(async () => (await at()).z, { timeout: 120000 }).toBeLessThan(topZ);
  await page.keyboard.up("KeyW");
  expect((await at()).level).toBe("loft");
  const eye = await page.evaluate(() => window.__pubStudy.camera.position.y);
  expect(eye).toBeCloseTo(PUB.loft + PUB.eye, 1);
  // Out through the loft's door onto the balcony.
  await place({ x: 0, z: 2.8, yaw: Math.PI, pitch: 0 });
  await page.keyboard.down("KeyW");
  await expect.poll(async () => (await at()).z, { timeout: 120000 }).toBeGreaterThan(4.6);
  await page.keyboard.up("KeyW");
  expect((await at()).z).toBeLessThan(PUB.gallery.front);
});

test("the inn's site keeps clear of the market and inside the map", { tag: "@logic" }, () => {
  const overlaps = (a, b) => {
    const half = (c) => (c.r !== undefined ? { w: c.r, d: c.r } : { w: c.w / 2, d: c.d / 2 }),
      p = half(a),
      q = half(b);
    return Math.abs(a.x - b.x) < p.w + q.w && Math.abs(a.z - b.z) < p.d + q.d;
  };
  const inn = heronColliders();
  for (const piece of inn) {
    for (const other of marketColliders())
      expect(overlaps(piece, other), `${JSON.stringify(piece)} on ${JSON.stringify(other)}`).toBe(false);
    expect(piece.x).toBeLessThan(WORLD.walk.maxX);
    expect(piece.z).toBeGreaterThan(WORLD.walk.minZ);
  }
  // The door answers on the open porch, not inside the building's footprint.
  expect(inn.some((c) => overlaps({ ...HERON_DOOR, r: 0.2 }, c))).toBe(false);
});

// Stands at the inn's door in the game, with every region streamed in.
async function atTheDoor(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({ started: true, quests: { mabel: false, flower: false, plant: false }, plants: [] }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  await page.waitForFunction(() => !window.__willowmere.getStreaming().pending, null, {
    timeout: 600000,
    polling: 1000,
  });
}

test("the inn's door opens the room, and its stairs reach the balcony", async ({ page }) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await atTheDoor(page);
  // You can walk there from the market square.
  const route = await page.evaluate(
    ([from, to]) => window.__willowmere.findPath(from, to),
    [{ x: 34.2, z: 0.5 }, HERON_DOOR],
  );
  expect(route.length).toBeGreaterThan(0);
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x, z, Math.PI), HERON_DOOR);
  await expect(page.locator("#interaction")).toContainText("Step into The Drowsy Heron");
  const outside = await page.evaluate(() => window.__willowmere.getPlayer());
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__willowmere.getInterior().active, null, { timeout: 120000 });
  await expect(page).toHaveURL(/interior=heron/);
  const inside = () => page.evaluate(() => window.__willowmere.getInterior());
  const place = (pose) => page.evaluate((p) => window.__willowmere.placeInterior(p), pose);
  expect((await inside()).level).toBe("ground");
  // A point upstairs says nothing to someone standing beneath it.
  await place({ x: -0.8, z: -2.6, yaw: Math.PI, pitch: 0 });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect((await inside()).nearest).not.toBe("cot");
  // Up the flight with the keys: the eye climbs with the floor.
  const { minX, maxX, bottomZ, topZ } = PUB.stair;
  await place({ x: (minX + maxX) / 2, z: bottomZ + 0.1, yaw: 0, pitch: 0 });
  await page.keyboard.down("w");
  await page.waitForFunction((z) => window.__willowmere.getInterior().position.z < z, topZ + 0.2, {
    timeout: 120000,
  });
  await page.keyboard.up("w");
  expect((await inside()).level).toBe("loft");
  expect((await inside()).floor).toBeGreaterThan(PUB.loft * 0.9);
  // A bed answers up here, and lying down lets the day go by.
  await place({ x: -0.8, z: -2.45, yaw: 0, pitch: -0.2 });
  await expect.poll(async () => (await inside()).nearest).toBe("cot");
  await page.keyboard.press("e");
  await expect.poll(async () => (await inside()).night).toBe(true);
  // The balcony, through the loft's door.
  await place({ x: 0, z: 2.8, yaw: Math.PI, pitch: 0 });
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.__willowmere.getInterior().position.z > 4.6, null, { timeout: 120000 });
  await page.keyboard.up("w");
  expect((await inside()).position.z).toBeLessThan(PUB.gallery.front);
  await expect.poll(async () => (await inside()).nearest).toBe("balcony");
  // Back downstairs, the front door lets you out where you came in.
  await place({ x: (minX + maxX) / 2, z: topZ - 0.1, yaw: Math.PI, pitch: 0 });
  await page.keyboard.down("w");
  await page.waitForFunction((z) => window.__willowmere.getInterior().position.z > z, bottomZ, { timeout: 120000 });
  await page.keyboard.up("w");
  expect((await inside()).level).toBe("ground");
  await place({ x: 0, z: 2.9, yaw: Math.PI, pitch: 0 });
  await expect.poll(async () => (await inside()).nearest).toBe("door");
  await page.keyboard.press("e");
  await page.waitForFunction(() => !window.__willowmere.getInterior().active);
  const back = await page.evaluate(() => window.__willowmere.getPlayer());
  expect(Math.hypot(back.x - outside.x, back.z - outside.z)).toBeLessThan(0.1);
  expect(errors).toEqual([]);
});

test("the inn keeps the regions' budget outside and the rooms' inside", async ({ page }) => {
  test.setTimeout(900000);
  await atTheDoor(page);
  const sample = (read) =>
    page.evaluate(async (expression) => {
      const values = [];
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame);
        // eslint-disable-next-line no-eval
        values.push((0, eval)(expression));
      }
      return values;
    }, read);
  const outdoors = "window.__willowmere.getDiagnostics()";
  await page.evaluate(() => window.__willowmere.moveTo(35, -8.2, Math.PI));
  let samples = await sample(outdoors);
  expect(Math.max(...samples.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(2.5e6);
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) document.querySelector("#zoom-out").click();
  });
  samples = await sample(outdoors);
  expect(Math.max(...samples.map((s) => s.drawCalls))).toBeLessThan(1000);
  expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(2.5e6);
  await page.goto("/?interior=heron&resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getInterior().active, null, { timeout: 120000 });
  samples = await sample("window.__willowmere.getInterior()");
  const draws = samples.map((s) => s.drawCalls).sort((a, b) => a - b);
  expect(draws[Math.floor(draws.length / 2)]).toBeLessThan(420);
  // Nothing that moves casts into its maps, so they stay cached.
  expect(samples.at(-1).render.shadowAutoUpdate).toBe(false);
});
