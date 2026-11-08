import { test, expect } from "@playwright/test";
import { createInteriorWalker } from "../src/interior-movement.js";
import { LOAF_NOTE, POST_OFFICE_NOTES, POST_OFFICE_POINTS, POST_OFFICE_SIGNS } from "../src/content/post-office.js";
import {
  FIXTURES,
  MY_BOX,
  PIGEON_HOLE,
  POST_OFFICE as P,
  boxNumber,
  pigeonholeAt,
  postOfficeColliders,
  postOfficeLayout,
  spaceAt,
} from "../src/post-office/layout.js";
import { MARKET, marketColliders } from "../src/regions/market-layout.js";

// Flood-fills the floor from the door with the room's own walker and colliders.
function walkable() {
  const layout = postOfficeLayout(),
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

test("the way in stands clear, and the back room can be walked to", { tag: "@logic" }, () => {
  const { walker, spots } = walkable(),
    { spawn } = postOfficeLayout();
  expect(walker.blocked(spawn.x, spawn.z)).toBe(false);
  // A visitor reaches all three spaces, through the flap and the door behind it.
  for (const space of ["hall", "sorting", "back"])
    expect(spots.some(([, z]) => spaceAt(z) === space), space).toBe(true);
  const reached = (x, z) => spots.some(([a, b]) => Math.hypot(a - x, b - z) < 0.15);
  expect(reached((P.counter.westEnd + P.counter.eastStart) / 2, 0.5), "the flap's gap").toBe(true);
  expect(reached((P.backDoor.x[0] + P.backDoor.x[1]) / 2, P.partition), "the door to the back").toBe(true);
  // Every corner of the back room, not just the part by the door.
  expect(reached(-4.5, -5.7), "the armchair's side of the stove").toBe(true);
  expect(reached(4.6, -5.5), "the bicycle's corner").toBe(true);
});

test("everything E answers at can be reached and seen from somewhere a visitor can stand", { tag: "@logic" }, () => {
  const { walker, spots } = walkable();
  // The same test as the room's scan (src/interior.js): within range, and no
  // other fitting between the visitor and the last metre of the approach.
  const answers = (point) =>
    spots.some(([x, z]) => {
      const dx = point.x - x,
        dz = point.z - z,
        distance = Math.hypot(dx, dz);
      if (distance > point.range) return false;
      for (let d = 0.15; d < distance - 0.95; d += 0.15)
        if (walker.blocked(x + (dx * d) / distance, z + (dz * d) / distance, 0.02)) return false;
      return true;
    });
  for (const point of POST_OFFICE_POINTS) expect(answers(point), point.id).toBe(true);
});

test("the stamp and the pigeon are behind the counter, and the bell in front of it", { tag: "@logic" }, () => {
  const { walker, spots } = walkable();
  const hallOnly = (id) => {
    const point = POST_OFFICE_POINTS.find((p) => p.id === id);
    return spots
      .filter(([x, z]) => Math.hypot(point.x - x, point.z - z) <= point.range)
      .filter(([x, z]) => {
        const dx = point.x - x,
          dz = point.z - z,
          distance = Math.hypot(dx, dz);
        for (let d = 0.15; d < distance - 0.95; d += 0.15)
          if (walker.blocked(x + (dx * d) / distance, z + (dz * d) / distance, 0.02)) return false;
        return true;
      })
      .map(([, z]) => spaceAt(z));
  };
  expect(hallOnly("stamp")).toContain("sorting");
  expect(hallOnly("stamp")).not.toContain("hall");
  expect(hallOnly("pigeon")).not.toContain("hall");
  expect(hallOnly("bell")).toContain("hall");
  expect(hallOnly("stove")).toEqual(expect.arrayContaining(["back"]));
});

test("every point has words, and every sign fits the fittings it is painted for", { tag: "@logic" }, () => {
  for (const { id, label } of POST_OFFICE_POINTS) {
    expect(label, id).toBeTruthy();
    if (id === "door") continue;
    const note = id === "loaf" ? LOAF_NOTE : POST_OFFICE_NOTES[id];
    expect(note?.title, id).toBeTruthy();
    expect(note.lines.length, id).toBeGreaterThan(0);
  }
  expect(new Set(POST_OFFICE_POINTS.map((p) => p.id)).size).toBe(POST_OFFICE_POINTS.length);
  // The frame's labels are one per hole, and the pigeon's hole says so.
  expect(POST_OFFICE_SIGNS.pigeonholes).toHaveLength(P.frame.rows);
  for (const row of POST_OFFICE_SIGNS.pigeonholes) expect(row).toHaveLength(P.frame.cols);
  expect(POST_OFFICE_SIGNS.pigeonholes[PIGEON_HOLE.row][PIGEON_HOLE.col]).toBe("Second Class");
  const hole = pigeonholeAt(PIGEON_HOLE.col, PIGEON_HOLE.row);
  expect(FIXTURES.pigeon.x).toBeCloseTo(hole.x);
  // The boxes run left to right, top to bottom, from 1.
  expect(boxNumber(0, 0)).toBe(1);
  expect(boxNumber(P.boxes.cols - 1, P.boxes.rows - 1)).toBe(P.boxes.cols * P.boxes.rows);
  expect(MY_BOX).toBe(21);
});

test("the door and windows are on the same sides as outside", { tag: "@logic" }, () => {
  // East of the middle for the door, west for the big window, as market.js has them.
  expect((P.door.x[0] + P.door.x[1]) / 2).toBeGreaterThan(0);
  expect((P.bigWindow.x[0] + P.bigWindow.x[1]) / 2).toBeLessThan(0);
  // The partition carries the stack, and the outside's footprint is unchanged.
  expect(marketColliders()).toContainEqual({ x: MARKET.postOffice.x, z: MARKET.postOffice.z, w: MARKET.postOffice.w, d: MARKET.postOffice.d });
  expect(postOfficeColliders().length).toBeGreaterThan(20);
});

const inside = (page) => page.evaluate(() => window.__willowmere.getInterior());
const place = (page, pose) => page.evaluate((p) => window.__willowmere.placeInterior(p), pose);
const frame = (page) => page.evaluate(() => new Promise(requestAnimationFrame));
async function openRoom(page) {
  await page.goto("/?interior=post-office&resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getInterior().active, null, { timeout: 120000 });
  await frame(page);
}
// Stands at (x, z), looks straight at a fixture, and presses E.
async function press(page, id, x, z) {
  const point = POST_OFFICE_POINTS.find((p) => p.id === id),
    yaw = Math.atan2(x - point.x, z - point.z),
    pitch = Math.atan2(point.y - P.eye, Math.hypot(x - point.x, z - point.z));
  await place(page, { x, z, yaw, pitch });
  await expect.poll(async () => (await inside(page)).nearest).toBe(id);
  await page.keyboard.press("e");
  await frame(page);
}

test("the room opens, greets you, and its fittings answer", async ({ page }) => {
  test.setTimeout(240000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openRoom(page);
  await expect(page.locator("#bakery-view")).toHaveAttribute("aria-label", "Inside the post office");
  // Nothing has been delivered yet, so there is no loaf to look at.
  expect((await inside(page)).loaf).toBe(false);
  // The bell on its spring says you've come in.
  await expect(page.locator("#bakery-note span")).toHaveText("A BELL ON A SPRING");
  // The date stamp lands a postmark; the rack spins; your own box opens.
  await press(page, "stamp", -1.55, -0.72);
  await expect(page.locator("#bakery-note span")).toHaveText("WILLOWMERE · MARKET LANE");
  await expect.poll(async () => (await inside(page)).postmarks).toBe(1);
  // A second press, once the first has come back up, lands a second ring.
  await expect.poll(async () => {
    await page.keyboard.press("e");
    await page.waitForTimeout(700);
    return (await inside(page)).postmarks;
  }).toBeGreaterThan(1);
  await press(page, "spinner", -0.55, 2.85);
  expect((await inside(page)).spinning).toBe(true);
  await press(page, "boxes", 4.5, 2.95);
  await expect.poll(async () => (await inside(page)).boxOpen).toBe(true);
  await expect(page.locator("#bakery-note span")).toHaveText(`BOX ${MY_BOX} · ROSEWOOD`);
  // Second Class, in his hole.
  await press(page, "pigeon", FIXTURES.pigeon.x, -1.95);
  await expect(page.locator("#bakery-note span")).toHaveText("SECOND CLASS · HEAD OF AIR MAIL");
  // The wireless goes on and off.
  await press(page, "wireless", -2.55, -5.72);
  expect((await inside(page)).wireless).toBe(true);
  await page.keyboard.press("e");
  await frame(page);
  expect((await inside(page)).wireless).toBe(false);
  // The lamps come on, and the door lets you out.
  await page.evaluate(() => document.querySelector("#bakery-light").click());
  expect((await inside(page)).night).toBe(true);
  expect(errors).toEqual([]);
});

test("Finn's loaf is by the armchair once it has been delivered", async ({ page }) => {
  test.setTimeout(240000);
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({ started: true, quests: { mabel: false, flower: false, plant: false }, plants: [], deliveries: { carrying: [], made: 1, rounds: 0, last: 0 } }),
    );
  });
  await openRoom(page);
  expect((await inside(page)).loaf).toBe(true);
  await press(page, "loaf", -5.1, -5.45);
  await expect(page.locator("#bakery-note span")).toHaveText(LOAF_NOTE.title);
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
  // Stands on the step, just south of the green door.
  const door = { x: MARKET.postOffice.x + 0.7, z: MARKET.postOffice.z + MARKET.postOffice.d / 2 + 0.6 };
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x, z, Math.PI), door);
  await expect(page.locator("#interaction")).toContainText("Step into the post office");
  const outside = await page.evaluate(() => window.__willowmere.getPlayer());
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__willowmere.getInterior().active, null, { timeout: 120000 });
  await expect(page).toHaveURL(/interior=post-office/);
  await place(page, { x: FIXTURES.door.x, z: FIXTURES.door.z - 0.75, yaw: Math.PI, pitch: 0 });
  await expect.poll(async () => (await inside(page)).nearest).toBe("door");
  await page.keyboard.press("e");
  await page.waitForFunction(() => !window.__willowmere.getInterior().active);
  await expect(page).not.toHaveURL(/interior=/);
  const back = await page.evaluate(() => window.__willowmere.getPlayer());
  expect(Math.hypot(back.x - outside.x, back.z - outside.z)).toBeLessThan(0.1);
  expect(errors).toEqual([]);
});

test("the post office keeps the rooms' budget, with its shadow map cached", async ({ page }) => {
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
  // The busiest views: from the door, from the far end of the hall and from the
  // back room looking out through the door to the sorting office.
  for (const pose of [
    { x: 2.6, z: 3.95, yaw: 0.42, pitch: -0.05 },
    { x: 2.2, z: 2.6, yaw: 1.35, pitch: -0.12 },
    { x: 0.2, z: -6, yaw: Math.PI + 0.1, pitch: -0.05 },
  ]) {
    await place(page, pose);
    const samples = await sample(),
      draws = samples.map((s) => s.drawCalls).sort((a, b) => a - b);
    expect(draws[Math.floor(draws.length / 2)]).toBeLessThan(360);
    expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(0.6e6);
    expect(samples.at(-1).render.shadowAutoUpdate).toBe(false);
  }
  await page.evaluate(() => {
    const select = document.querySelector("#quality");
    select.value = "performance";
    select.dispatchEvent(new Event("change"));
  });
  await place(page, { x: 2.6, z: 3.95, yaw: 0.42, pitch: -0.05 });
  const samples = await sample(),
    draws = samples.map((s) => s.drawCalls).sort((a, b) => a - b);
  expect(draws[Math.floor(draws.length / 2)]).toBeLessThan(220);
});
