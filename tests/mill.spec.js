import { test, expect } from "@playwright/test";
import { createInteriorWalker } from "../src/interior-movement.js";
import { MILL_NOTES, MILL_POINTS, MILL_SIGNS } from "../src/content/mill.js";
import { FIXTURES, MILL as K, middle, millColliders, millLayout } from "../src/mill/layout.js";
import { WHEEL_RATE, createWheel } from "../src/mill/wheel.js";

// Flood-fills the floor from the door with the room's own walker and colliders.
function walkable() {
  const layout = millLayout(),
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
// with no fitting between the visitor and the last metre of the approach.
function answeringSpots(point, { walker, spots }) {
  return spots.filter(([x, z]) => {
    const dx = point.x - x,
      dz = point.z - z,
      distance = Math.hypot(dx, dz);
    if (distance > point.range) return false;
    for (let d = 0.15; d < distance - 0.95; d += 0.15)
      if (walker.blocked(x + (dx * d) / distance, z + (dz * d) / distance, 0.02)) return false;
    return true;
  });
}

test("the way in stands clear, and every corner of the floor can be walked to", { tag: "@logic" }, () => {
  const { walker, spots } = walkable(),
    { spawn } = millLayout();
  expect(walker.blocked(spawn.x, spawn.z)).toBe(false);
  const reached = (x, z) => spots.some(([a, b]) => Math.hypot(a - x, b - z) < 0.15);
  expect(reached(middle(K.backDoor.x), K.back + 0.4), "the back door").toBe(true);
  expect(reached(-K.halfW + 0.9, middle(K.westWindow.z)), "the west window, by the wheel").toBe(true);
  expect(reached(K.halfW - 1.1, middle(K.eastWindow.z)), "the east window").toBe(true);
  expect(reached(K.trap.maxX + 0.3, K.front - 0.4), "beside the hoist").toBe(true);
  expect(reached(K.mouse.x + 0.3, K.mouse.z + 0.3), "by the mouse").toBe(true);
  // Nobody walks into the pit.
  for (const [x, z] of spots) expect(x > K.pit.maxX || z < K.pit.minZ || z > K.pit.maxZ, `${x},${z}`).toBe(true);
});

test("everything E answers at can be reached and seen from somewhere a visitor can stand", { tag: "@logic" }, () => {
  const floor = walkable();
  for (const point of MILL_POINTS) expect(answeringSpots(point, floor).length, point.id).toBeGreaterThan(0);
});

test("every point has words, and the room's signs line up", { tag: "@logic" }, () => {
  const special = { hoist: "hoistUp", sluice: "sluiceShut" };
  for (const { id, label } of MILL_POINTS) {
    expect(label, id).toBeTruthy();
    if (id === "door") continue;
    const note = MILL_NOTES[special[id] ?? id];
    expect(note?.title, id).toBeTruthy();
    expect(note.text ?? note.lines?.[0], id).toBeTruthy();
  }
  for (const id of ["stones", "pitWheel", "wheel"]) expect(MILL_NOTES[`${id}Still`]?.lines.length, id).toBeGreaterThan(0);
  expect(new Set(MILL_POINTS.map((p) => p.id)).size).toBe(MILL_POINTS.length);
  expect(MILL_SIGNS.bins).toEqual(["WHEAT", "BARLEY", "OATS"]);
});

test("the door, the windows and the wheel's axle are where they are outside", { tag: "@logic" }, () => {
  // The room is the outside's 4.4 m footprint scaled up; its openings sit on the same sides.
  const outside = (x) => x / K.scale;
  expect(middle(K.door.x)).toBe(0);
  expect(outside(middle(K.frontWindows[0].x))).toBeCloseTo(-1.32, 1);
  expect(outside(middle(K.frontWindows[1].x))).toBeCloseTo(1.32, 1);
  expect(outside(middle(K.eastWindow.z))).toBeCloseTo(0, 1);
  // The backs (src/village/rears.js): the door right of middle, the window left.
  expect(outside(middle(K.backDoor.x))).toBeCloseTo(0.95, 1);
  expect(outside(middle(K.backWindow.x))).toBeCloseTo(-0.75, 1);
  // The wheel turns half a metre in front of the house's middle, west of it.
  expect(outside(K.axle.z)).toBeCloseTo(0.5, 1);
  expect(millColliders().length).toBeGreaterThan(12);
  expect(FIXTURES.wheel.x).toBeLessThan(-K.halfW + 0.1);
});

test("the sluice runs the wheel down and the race brings it back", { tag: "@logic" }, () => {
  const wheel = createWheel();
  wheel.step(1);
  expect(wheel.turn).toBeCloseTo(WHEEL_RATE, 5);
  expect(wheel.toggleSluice()).toBe(true);
  for (let i = 0; i < 300; i++) wheel.step(0.05);
  expect(wheel.turning).toBe(false);
  const held = wheel.turn;
  wheel.step(1);
  expect(wheel.turn).toBe(held);
  expect(wheel.toggleSluice()).toBe(false);
  for (let i = 0; i < 300; i++) wheel.step(0.05);
  expect(wheel.turning).toBe(true);
  expect(wheel.drive).toBeGreaterThan(0.95);
  // Without motion the wheel holds its angle.
  const still = wheel.turn;
  wheel.step(1, false);
  expect(wheel.turn).toBe(still);
});

const inside = (page) => page.evaluate(() => window.__willowmere.getInterior());
const place = (page, pose) => page.evaluate((p) => window.__willowmere.placeInterior(p), pose);
const frame = (page) => page.evaluate(() => new Promise(requestAnimationFrame));
async function openRoom(page, url = "/?interior=mill&resolution=fixed") {
  await page.goto(url);
  await page.waitForFunction(() => window.__willowmere?.getInterior().active, null, { timeout: 120000 });
  await frame(page);
}
// Stands at (x, z), looks straight at a fixture, and presses E.
async function press(page, id, x, z) {
  const point = MILL_POINTS.find((p) => p.id === id),
    yaw = Math.atan2(x - point.x, z - point.z),
    pitch = Math.atan2(point.y - K.eye, Math.hypot(x - point.x, z - point.z));
  await place(page, { x, z, yaw, pitch });
  await frame(page);
  await expect.poll(async () => (await inside(page)).nearest).toBe(id);
  await page.keyboard.press("e");
  await frame(page);
}

test("the mill opens, its stones turn, and its fittings answer", async ({ page }) => {
  test.setTimeout(240000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openRoom(page);
  await expect(page.locator("#bakery-view")).toHaveAttribute("aria-label", "Inside Willow Mill");
  await expect(page.locator("#bakery-note span")).toHaveText("WILLOW MILL");
  expect((await inside(page)).turning).toBe(true);
  // A scoop of wheat goes in the hopper.
  const before = (await inside(page)).hopper;
  await press(page, "hopper", FIXTURES.hopper.x + 0.3, FIXTURES.hopper.z - 1.4);
  await expect(page.locator("#bakery-note span")).toHaveText("THE HOPPER");
  expect((await inside(page)).hopper).toBeGreaterThan(before);
  // The hoist takes a sack up into the loft.
  await press(page, "hoist", FIXTURES.hoist.x + 1.2, FIXTURES.hoist.z + 0.5);
  expect((await inside(page)).hoisted).toBe(true);
  // The bolter turns.
  await press(page, "bolter", FIXTURES.bolter.x - 1.3, FIXTURES.bolter.z);
  expect((await inside(page)).cranking).toBe(true);
  // The sluice stills the wheel, and the stones go quiet.
  await press(page, "sluice", FIXTURES.sluice.x + 1.2, FIXTURES.sluice.z);
  await expect(page.locator("#bakery-note span")).toHaveText("THE SLUICE");
  expect((await inside(page)).sluiceShut).toBe(true);
  await expect.poll(async () => (await inside(page)).turning, { timeout: 30000 }).toBe(false);
  await press(page, "stones", FIXTURES.stones.x + 1.4, FIXTURES.stones.z - 0.6);
  await expect(page.locator("#bakery-note p")).toHaveText(MILL_NOTES.stonesStill.lines[0]);
  // And lifting it sets everything going again.
  await press(page, "sluice", FIXTURES.sluice.x + 1.2, FIXTURES.sluice.z);
  expect((await inside(page)).sluiceShut).toBe(false);
  // Sitting in the rocking chair lets the evening come in.
  await press(page, "chair", FIXTURES.chair.x - 0.2, FIXTURES.chair.z + 1.0);
  expect((await inside(page)).night).toBe(true);
  expect(errors).toEqual([]);
});

test("the door on the green opens the mill, and the sluice stills the wheel outside", async ({ page }) => {
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
  // On the step, just in front of the mill's door (src/village/buildings.js).
  await page.evaluate(() => window.__willowmere.moveTo(17, -7 + 2.2 + 0.9, Math.PI));
  await expect(page.locator("#interaction")).toContainText("Step inside Willow Mill");
  const outside = await page.evaluate(() => window.__willowmere.getPlayer());
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__willowmere.getInterior().active, null, { timeout: 120000 });
  await expect(page).toHaveURL(/interior=mill/);
  await press(page, "sluice", FIXTURES.sluice.x + 1.2, FIXTURES.sluice.z);
  await place(page, { x: FIXTURES.door.x, z: FIXTURES.door.z - 0.75, yaw: Math.PI, pitch: 0 });
  await expect.poll(async () => (await inside(page)).nearest).toBe("door");
  await page.keyboard.press("e");
  await page.waitForFunction(() => !window.__willowmere.getInterior().active);
  await expect(page).not.toHaveURL(/interior=/);
  const back = await page.evaluate(() => window.__willowmere.getPlayer());
  expect(Math.hypot(back.x - outside.x, back.z - outside.z)).toBeLessThan(0.1);
  // Outside, the wheel runs down and stands where the sluice left it.
  const wheel = () => page.evaluate(() => window.__willowmere.getMillWheel());
  await expect.poll(async () => (await wheel()).turning, { timeout: 60000 }).toBe(false);
  for (let n = 0; n < 5; n++) await frame(page);
  const before = await wheel();
  expect(before.shut).toBe(true);
  expect(before.outside).not.toBeNull();
  for (let n = 0; n < 20; n++) await frame(page);
  const after = await wheel();
  expect(after.turn).toBe(before.turn);
  expect(after.outside).toEqual(before.outside);
  expect(errors).toEqual([]);
});

test("the mill keeps the rooms' budget, with its shadow map cached", async ({ page }) => {
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
  // The busiest views: from the door, from Amos's corner back across the
  // gearing, and from the back looking out to the front.
  for (const pose of [
    { x: 0.2, z: 4.4, yaw: 0.35, pitch: -0.08 },
    { x: 1.0, z: 0.6, yaw: 1.35, pitch: 0.05 },
    { x: -0.5, z: -3.5, yaw: 3.0, pitch: 0 },
  ]) {
    await place(page, pose);
    const samples = await sample(),
      draws = samples.map((s) => s.drawCalls).sort((a, b) => a - b);
    expect(draws[Math.floor(draws.length / 2)]).toBeLessThan(180);
    expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(0.3e6);
    expect(samples.at(-1).render.shadowAutoUpdate).toBe(false);
  }
  await page.evaluate(() => {
    const select = document.querySelector("#quality");
    select.value = "performance";
    select.dispatchEvent(new Event("change"));
  });
  await place(page, { x: 0.2, z: 4.4, yaw: 0.35, pitch: -0.08 });
  const samples = await sample(),
    draws = samples.map((s) => s.drawCalls).sort((a, b) => a - b);
  expect(draws[Math.floor(draws.length / 2)]).toBeLessThan(110);
});
