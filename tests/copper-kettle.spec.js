import { test, expect } from "@playwright/test";
import { createInteriorWalker } from "../src/interior-movement.js";
import { KETTLE_NOTES, KETTLE_POINTS, KETTLE_SIGNS, LOAF_NOTE } from "../src/content/copper-kettle.js";
import { FIXTURES, KETTLE as K, answersFrom, kettleColliders, kettleLayout, spaceAt } from "../src/copper-kettle/layout.js";
import { hazelHasLoaf } from "../src/game/market.js";
import { MARKET, marketColliders } from "../src/regions/market-layout.js";

// Flood-fills the floor from the door with the room's own walker and colliders.
function walkable() {
  const layout = kettleLayout(),
    walker = createInteriorWalker(layout),
    step = 0.1,
    seen = new Set(),
    start = [Math.round(layout.spawn.x / step), Math.round(layout.spawn.z / step)],
    queue = [start];
  seen.add(start.join());
  while (queue.length) {
    const [i, j] = queue.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${i + di},${j + dj}`;
      if (seen.has(key) || walker.blocked((i + di) * step, (j + dj) * step)) continue;
      seen.add(key);
      queue.push([i + di, j + dj]);
    }
  }
  return { walker, spots: [...seen].map((key) => key.split(",").map((n) => n * step)) };
}

// Where a point answers from: the room's scan (src/interior.js) within range,
// with no fitting between the visitor and the last metre of the approach, and
// only from the side of the partition the room allows (answersFrom).
function answeringSpots(point, { walker, spots }) {
  return spots.filter(([x, z]) => {
    if (!answersFrom(point, x, z)) return false;
    const dx = point.x - x,
      dz = point.z - z,
      distance = Math.hypot(dx, dz);
    if (distance > point.range) return false;
    for (let d = 0.15; d < distance - 0.95; d += 0.15)
      if (walker.blocked(x + (dx * d) / distance, z + (dz * d) / distance, 0.02)) return false;
    return true;
  });
}

test("the way in stands clear, and the kitchen and the counter's back can be walked to", { tag: "@logic" }, () => {
  const { walker, spots } = walkable(),
    { spawn } = kettleLayout();
  expect(walker.blocked(spawn.x, spawn.z)).toBe(false);
  for (const space of ["tea room", "counter", "kitchen"])
    expect(spots.some(([x, z]) => spaceAt(x, z) === space), space).toBe(true);
  const reached = (x, z) => spots.some(([a, b]) => Math.hypot(a - x, b - z) < 0.15);
  expect(reached((K.kitchenDoor.x[0] + K.kitchenDoor.x[1]) / 2, K.partition), "the kitchen doorway").toBe(true);
  expect(reached(-5.5, -1.4), "behind the counter, by the urn").toBe(true);
  expect(reached(-1.4, K.back + K.sinkRun.depth + 0.3), "the sink").toBe(true);
  expect(reached(4.6, -4.6), "between the range and the rack").toBe(true);
  expect(reached(-3.85, K.front - 0.3), "behind the bay table").toBe(true);
});

test("everything E answers at can be reached and seen from somewhere a visitor can stand", { tag: "@logic" }, () => {
  const floor = walkable();
  for (const point of KETTLE_POINTS) expect(answeringSpots(point, floor).length, point.id).toBeGreaterThan(0);
});

test("nothing answers through the partition, and the urn only from behind the counter", { tag: "@logic" }, () => {
  const floor = walkable();
  const spaces = (id) => new Set(answeringSpots(KETTLE_POINTS.find((p) => p.id === id), floor).map(([x, z]) => spaceAt(x, z)));
  expect([...spaces("urn")]).toEqual(["counter"]);
  for (const id of ["menu", "fire", "bell", "cat"]) expect(spaces(id).has("kitchen"), id).toBe(false);
  for (const id of ["oven", "pans", "clock", "sink", "pantry"]) expect([...spaces(id)], id).toEqual(["kitchen"]);
  expect(spaces("bell").has("tea room")).toBe(true);
});

test("every point has words, and the room's signs and stock line up", { tag: "@logic" }, () => {
  for (const { id, label } of KETTLE_POINTS) {
    expect(label, id).toBeTruthy();
    if (id === "door") continue;
    const note = id === "loaf" ? LOAF_NOTE : KETTLE_NOTES[id];
    expect(note?.title, id).toBeTruthy();
    expect(note.lines.length, id).toBeGreaterThan(0);
  }
  expect(new Set(KETTLE_POINTS.map((p) => p.id)).size).toBe(KETTLE_POINTS.length);
  expect(KETTLE_SIGNS.caddies).toContain("DO NOT");
  expect(KETTLE_SIGNS.menu.length).toBeGreaterThan(3);
});

test("Hazel's loaf is on the board only once she has had one", { tag: "@logic" }, () => {
  expect(hazelHasLoaf({ carrying: [], made: 0, rounds: 0 })).toBe(false);
  // Bram had the first loaf of the round; Hazel's is still in the bag.
  expect(hazelHasLoaf({ carrying: ["hazel"], made: 1, rounds: 0 })).toBe(false);
  expect(hazelHasLoaf({ carrying: ["bram"], made: 1, rounds: 0 })).toBe(true);
  expect(hazelHasLoaf({ carrying: ["hazel", "bram"], made: 2, rounds: 1 })).toBe(true);
});

test("the door, the bay, the east window and the stack are where they are outside", { tag: "@logic" }, () => {
  // The room is the outside's footprint scaled up; its openings sit on the same sides.
  const scale = (2 * K.halfW) / MARKET.teaRoom.w,
    outside = (x) => x / scale;
  expect((K.door.x[0] + K.door.x[1]) / 2).toBe(0);
  expect(outside((K.bay.x[0] + K.bay.x[1]) / 2)).toBeCloseTo(-1.5, 0);
  expect(outside((K.eastWindow.x[0] + K.eastWindow.x[1]) / 2)).toBeCloseTo(1.55, 0);
  expect(outside((K.chimney.minX + K.chimney.maxX) / 2)).toBeCloseTo(1.5, 0);
  expect(outside((K.rearWindow.x[0] + K.rearWindow.x[1]) / 2)).toBeCloseTo(-0.55, 0);
  // The outside's footprint is unchanged.
  expect(marketColliders()).toContainEqual({ x: MARKET.teaRoom.x, z: MARKET.teaRoom.z, w: MARKET.teaRoom.w, d: MARKET.teaRoom.d });
  expect(kettleColliders().length).toBeGreaterThan(25);
});

const inside = (page) => page.evaluate(() => window.__willowmere.getInterior());
const place = (page, pose) => page.evaluate((p) => window.__willowmere.placeInterior(p), pose);
const frame = (page) => page.evaluate(() => new Promise(requestAnimationFrame));
async function openRoom(page, url = "/?interior=copper-kettle&resolution=fixed") {
  await page.goto(url);
  await page.waitForFunction(() => window.__willowmere?.getInterior().active, null, { timeout: 120000 });
  await frame(page);
}
// Stands at (x, z), looks straight at a fixture, and presses E.
async function press(page, id, x, z) {
  const point = KETTLE_POINTS.find((p) => p.id === id),
    yaw = Math.atan2(x - point.x, z - point.z),
    pitch = Math.atan2(point.y - K.eye, Math.hypot(x - point.x, z - point.z));
  await place(page, { x, z, yaw, pitch });
  await frame(page);
  await expect.poll(async () => (await inside(page)).nearest).toBe(id);
  await page.keyboard.press("e");
  await frame(page);
}

test("the tea room opens, rings you in, and its fittings answer", async ({ page }) => {
  test.setTimeout(240000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openRoom(page);
  await expect(page.locator(".bakery-heading h1")).toHaveText("The Copper Kettle");
  await expect(page.locator("#bakery-note span")).toHaveText("A BELL OVER THE DOOR");
  // Nothing delivered yet, so no loaf on the board.
  expect((await inside(page)).loaf).toBe(false);
  // A slice of sponge comes off the cake.
  await press(page, "cake", FIXTURES.cake.x, 0.55);
  await expect(page.locator("#bakery-note span")).toHaveText("VICTORIA SPONGE");
  expect((await inside(page)).slices).toBe(7);
  // The pot pours a cup at the bay table.
  await press(page, "pour", -3.0, 2.75);
  await expect(page.locator("#bakery-note span")).toHaveText("A CUP OF TEA");
  expect((await inside(page)).cups).toBe(1);
  // Crumpet purrs.
  await press(page, "cat", -5.75, 4.4);
  expect((await inside(page)).purring).toBe(true);
  // The gramophone goes on and off.
  await press(page, "gramophone", 5.1, 1.45);
  expect((await inside(page)).playing).toBe(true);
  await page.keyboard.press("e");
  await frame(page);
  expect((await inside(page)).playing).toBe(false);
  // The urn answers from behind the counter; in the kitchen, a scone is cut.
  await press(page, "urn", FIXTURES.urn.x, -1.35);
  await expect(page.locator("#bakery-note span")).toHaveText("THE TEA URN");
  await press(page, "scones", FIXTURES.scones.x, -3.2);
  expect((await inside(page)).scones).toBe(4);
  await press(page, "oven", FIXTURES.oven.x, -4.3);
  expect((await inside(page)).ovenOpen).toBe(true);
  // Sitting by the fire lets the evening come in.
  await press(page, "sit", 1.2, 0.35);
  expect((await inside(page)).night).toBe(true);
  expect(errors).toEqual([]);
});

test("Finn's loaf is on the counter once Hazel has had it", async ({ page }) => {
  test.setTimeout(240000);
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({ started: true, quests: { mabel: false, flower: false, plant: false }, plants: [], deliveries: { carrying: ["bram"], made: 1, rounds: 0, last: 0 } }),
    );
  });
  await openRoom(page);
  expect((await inside(page)).loaf).toBe(true);
  await press(page, "loaf", -5.4, 0.5);
  await expect(page.locator("#bakery-note span")).toHaveText(LOAF_NOTE.title);
});

test("the thumbstick walks you round the tea room on a touch screen", async ({ browser }) => {
  test.setTimeout(240000);
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
  const page = await context.newPage();
  await openRoom(page, "/?interior=copper-kettle&resolution=fixed&touch=1");
  await expect(page.locator("html")).toHaveClass(/touch/);
  const before = (await inside(page)).position;
  // Hold the lower left of the screen and lean forward.
  const cdp = await context.newCDPSession(page);
  const finger = (type, x, y) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  await finger("touchStart", 120, 320);
  await finger("touchMove", 120, 270);
  for (let i = 0; i < 8; i++) await frame(page);
  await finger("touchEnd");
  const after = (await inside(page)).position;
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.05);
  // The prompt is a button to tap: the door answers when you face it.
  await place(page, { x: FIXTURES.door.x, z: FIXTURES.door.z - 0.8, yaw: Math.PI, pitch: 0 });
  await expect.poll(async () => (await inside(page)).nearest).toBe("door");
  await expect(page.locator("#bakery-interact")).toBeVisible();
  await context.close();
});

test("the door on the lane opens the room, and lets you back out where you came in", async ({ page }) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
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
  // Stands on the step, just south of the door.
  const door = { x: MARKET.teaRoom.x, z: MARKET.teaRoom.z + MARKET.teaRoom.d / 2 + 0.6 };
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x, z, Math.PI), door);
  await expect(page.locator("#interaction")).toContainText("Step into the Copper Kettle");
  const outside = await page.evaluate(() => window.__willowmere.getPlayer());
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__willowmere.getInterior().active, null, { timeout: 120000 });
  await expect(page).toHaveURL(/interior=copper-kettle/);
  await place(page, { x: FIXTURES.door.x, z: FIXTURES.door.z - 0.75, yaw: Math.PI, pitch: 0 });
  await expect.poll(async () => (await inside(page)).nearest).toBe("door");
  await page.keyboard.press("e");
  await page.waitForFunction(() => !window.__willowmere.getInterior().active);
  await expect(page).not.toHaveURL(/interior=/);
  const back = await page.evaluate(() => window.__willowmere.getPlayer());
  expect(Math.hypot(back.x - outside.x, back.z - outside.z)).toBeLessThan(0.1);
  expect(errors).toEqual([]);
});

test("the Copper Kettle keeps the rooms' budget, with its shadow map cached", async ({ page }) => {
  test.setTimeout(240000);
  await openRoom(page);
  const sample = () =>
    page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame);
        values.push(window.__willowmere.getInterior());
      }
      return values;
    });
  // The busiest views: from the door, from the fireside looking back at the
  // counter, and from the kitchen looking out through the doorway.
  for (const pose of [
    { x: 0.15, z: 3.95, yaw: 0.3, pitch: -0.08 },
    { x: 3.2, z: 0.6, yaw: 1.4, pitch: -0.1 },
    { x: -1.2, z: -5.0, yaw: Math.PI + 0.2, pitch: -0.05 },
  ]) {
    await place(page, pose);
    const samples = await sample(),
      draws = samples.map((s) => s.drawCalls).sort((a, b) => a - b);
    expect(draws[Math.floor(draws.length / 2)]).toBeLessThan(330);
    expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(0.6e6);
    expect(samples.at(-1).render.shadowAutoUpdate).toBe(false);
  }
  await page.evaluate(() => {
    const select = document.querySelector("#quality");
    select.value = "performance";
    select.dispatchEvent(new Event("change"));
  });
  await place(page, { x: 0.15, z: 3.95, yaw: 0.3, pitch: -0.08 });
  const samples = await sample(),
    draws = samples.map((s) => s.drawCalls).sort((a, b) => a - b);
  expect(draws[Math.floor(draws.length / 2)]).toBeLessThan(200);
});
