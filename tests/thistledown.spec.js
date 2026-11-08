import { test, expect } from "@playwright/test";
import { createInteriorWalker } from "../src/interior-movement.js";
import { THISTLEDOWN_POINTS } from "../src/content/thistledown.js";
import { COOKING_SECONDS, cookBreakfast, createBreakfast, eatBreakfast, orderBreakfast } from "../src/game/thistledown.js";
import {
  GROUND,
  INN,
  SEEN_FROM,
  UPPER,
  WALK,
  floorHeight,
  groundColliders,
  levelAt,
  upperColliders,
  zoneAt,
} from "../src/thistledown/layout.js";

// Flood-fills the floors from the front door with the room's own walker and
// colliders, crossing floors only where the stair's flight allows it.
function walkableFromDoor() {
  const step = 0.08,
    blockers = {
      ground: createInteriorWalker({ bounds: WALK.bounds, colliders: groundColliders(), spawn: WALK.spawn }),
      upper: createInteriorWalker({ bounds: WALK.bounds, colliders: upperColliders(), spawn: WALK.spawn }),
    };
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
  return (level, x, z, reach = 0.16) => {
    const r = Math.round(reach / step);
    for (let a = -r; a <= r; a++)
      for (let b = -r; b <= r; b++)
        if (seen.has(key(level, Math.round(x / step) + a, Math.round(z / step) + b))) return true;
    return false;
  };
}

test("a guest can walk from the front door to every room and everything E answers at", { tag: "@logic" }, () => {
  const reached = walkableFromDoor();
  const rooms = {
    "the hall": ["ground", 0, 2.5],
    "the passage": ["ground", -0.5, -1.8],
    "the back hall": ["ground", 0, -3.6],
    "the breakfast room": ["ground", -2.3, 3],
    "the side table": ["ground", -4, 2.5],
    "the kitchen": ["ground", -2.5, -3],
    "the sitting room": ["ground", 2.2, 3],
    "the hearth rug": ["ground", 3.5, -0.7],
    "the landing": ["upper", 0, -3.5],
    "the passage upstairs": ["upper", -0.6, 0.6],
    Goldfinch: ["upper", 0, 2.6],
    "Goldfinch's alcove": ["upper", 3.2, 0],
    Linnet: ["upper", -3, -3.4],
    "the bathroom": ["upper", 2.6, -3.5],
  };
  for (const [name, [level, x, z]] of Object.entries(rooms)) expect(reached(level, x, z), name).toBe(true);
  // And you can get close enough to each point to read its prompt.
  for (const point of THISTLEDOWN_POINTS) {
    const near = reached(point.level, point.x, point.z, point.range * 0.8);
    expect(near, point.id).toBe(true);
  }
  // Nobody ends up in the store behind the landing or past a knee wall.
  expect(reached("upper", -3, 0.4, 0), "the store behind the landing").toBe(false);
  expect(reached("upper", 4.9, 2, 0), "behind the east knee wall").toBe(false);
  // Or walks under the top of the flight downstairs.
  expect(reached("ground", 1, -1.2, 0), "under the stairs").toBe(false);
});

test("the stair's flight climbs smoothly and hands over floors halfway", { tag: "@logic" }, () => {
  const { minX, maxX, bottomZ, topZ } = INN.stair,
    x = (minX + maxX) / 2;
  let level = "ground",
    previous = 0;
  for (let z = bottomZ + 0.3; z >= topZ - 0.3; z -= 0.05) {
    level = levelAt(level, x, z);
    const y = floorHeight(level, x, z);
    expect(y - previous).toBeLessThan(0.08);
    previous = y;
  }
  expect(level).toBe("upper");
  expect(previous).toBeCloseTo(INN.loft);
  for (let z = topZ - 0.3; z <= bottomZ + 0.3; z += 0.05) {
    level = levelAt(level, x, z);
    const y = floorHeight(level, x, z);
    expect(previous - y).toBeLessThan(0.08);
    previous = y;
  }
  expect(level).toBe("ground");
  expect(previous).toBe(0);
});

test("the rooms name each other consistently and furniture stays indoors", { tag: "@logic" }, () => {
  for (const [room, seen] of Object.entries(SEEN_FROM)) {
    expect(seen).toContain(room);
    for (const other of seen) expect(SEEN_FROM[other], `${other} is a room`).toBeDefined();
  }
  expect(SEEN_FROM.hall).toContain("landing");
  expect(SEEN_FROM.landing).toContain("hall");
  for (const piece of Object.values(GROUND)) {
    expect(Math.abs(piece.x)).toBeLessThan(INN.halfW);
    expect(piece.z).toBeLessThan(INN.front);
    expect(piece.z).toBeGreaterThan(INN.back);
  }
  for (const piece of Object.values(UPPER)) {
    expect(Math.abs(piece.x)).toBeLessThan(INN.knee.x);
    expect(zoneAt("upper", piece.x, piece.z)).toBeDefined();
  }
  // Every point stands in a room the visitor can be in.
  for (const point of THISTLEDOWN_POINTS) expect(SEEN_FROM[zoneAt(point.level, point.x, point.z)], point.id).toBeDefined();
});

test("breakfast cooks, waits on the table and can be had again", { tag: "@logic" }, () => {
  const b = createBreakfast();
  expect(eatBreakfast(b)).toBe(false);
  expect(orderBreakfast(b)).toBe("ordered");
  expect(orderBreakfast(b)).toBe("cooking");
  expect(cookBreakfast(b, COOKING_SECONDS / 2)).toBe(false);
  expect(cookBreakfast(b, COOKING_SECONDS)).toBe(true);
  expect(cookBreakfast(b, 1)).toBe(false);
  expect(orderBreakfast(b)).toBe("served");
  expect(eatBreakfast(b)).toBe(true);
  expect(b.eaten).toBe(1);
  expect(eatBreakfast(b)).toBe(false);
  expect(orderBreakfast(b)).toBe("ordered");
});

// --------------------------------------------------------------- in the game

const inside = (page) => page.evaluate(() => window.__willowmere.getInterior());
async function enter(page) {
  await page.goto("/?interior=thistledown&resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getInterior().room === "thistledown", null, { timeout: 120000 });
}
// Stands the visitor at (x, z) facing (tx, tz), and waits for E to catch up.
async function stand(page, x, z, tx, tz, pitch = -0.2) {
  await page.evaluate(
    ({ x, z, yaw, pitch }) => window.__willowmere.placeInterior({ x, z, yaw, pitch }),
    { x, z, yaw: Math.atan2(x - tx, z - tz), pitch },
  );
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}
// Walks up the flight with the keys, from its foot to the landing.
async function climb(page) {
  const { minX, maxX, bottomZ, topZ } = INN.stair;
  await page.evaluate(({ x, z }) => window.__willowmere.placeInterior({ x, z, yaw: 0, pitch: 0 }), { x: (minX + maxX) / 2, z: bottomZ + 0.1 });
  await page.keyboard.down("w");
  await page.waitForFunction((z) => window.__willowmere.getInterior().position.z < z, topZ + 0.15, { timeout: 60000 });
  await page.keyboard.up("w");
}

test("the cottage is Thistledown outside, its door opens the B&B, and the door leads back", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  await page.evaluate(() => window.__willowmere.moveTo(-15, -0.1, Math.PI));
  await expect(page.locator("#interaction")).toContainText("Step into Thistledown");
  const outside = await page.evaluate(() => window.__willowmere.getPlayer());
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__willowmere.getInterior().active, null, { timeout: 120000 });
  await expect(page).toHaveURL(/interior=thistledown/);
  await expect(page.locator("#bakery-view")).toHaveAttribute("aria-label", "Inside Thistledown, the village bed and breakfast");
  await stand(page, 0, 4.1, 0, 5.2, 0);
  await expect(page.locator("#bakery-interact")).toContainText("Step out");
  await page.keyboard.press("e");
  await page.waitForFunction(() => !window.__willowmere.getInterior().active);
  await expect(page).not.toHaveURL(/interior=/);
  expect(await page.evaluate(() => window.__willowmere.getPlayer())).toEqual(outside);
  expect(errors).toEqual([]);
});

test("breakfast is rung for at the hatch, arrives on the table and can be eaten", async ({ page }) => {
  await enter(page);
  // The plate is not there to eat until it has been cooked.
  await stand(page, -2.7, 3.2, -3.5, 3.92, -0.5);
  expect((await inside(page)).nearest).not.toBe("table");
  await stand(page, -3.55, 1.0, -3.55, 0.2, -0.05);
  await expect(page.locator("#bakery-interact")).toContainText("Ring for breakfast");
  await page.keyboard.press("e");
  await expect(page.locator("#bakery-note")).toContainText("full breakfast");
  expect((await inside(page)).breakfast).toBe("cooking");
  await page.waitForFunction(() => window.__willowmere.getInterior().breakfast === "served", null, { timeout: 15000 });
  await expect(page.locator("#bakery-note")).toContainText("window table");
  await stand(page, -2.7, 3.2, -3.5, 3.92, -0.5);
  await expect(page.locator("#bakery-interact")).toContainText("Sit down to breakfast");
  await page.keyboard.press("e");
  expect((await inside(page)).eaten).toBe(1);
  await expect(page.locator("#bakery-note")).toContainText("illegal");
});

test("the stairs lead up to Goldfinch, Linnet and the bath, each behind its own door", async ({ page }) => {
  await enter(page);
  // Nothing upstairs answers while you stand beneath it.
  await stand(page, -0.5, -3.4, 0, -4.8, -0.1);
  expect((await inside(page)).nearest).not.toBe("landing-window");
  await climb(page);
  let state = await inside(page);
  expect(state.level).toBe("upper");
  expect(state.floor).toBeGreaterThan(INN.loft * 0.9);
  // The rooms draw only where they can be seen from.
  await stand(page, -0.6, -3.45, -4, -3.45, -0.1);
  expect((await inside(page)).zone).toBe("landing");
  const fromLanding = (await inside(page)).roomsDrawn;
  await stand(page, 0, 2.5, -3, 2.45, -0.3);
  expect((await inside(page)).zone).toBe("goldfinch");
  expect((await inside(page)).roomsDrawn).toBeLessThan(fromLanding);
  // A nap in Goldfinch lets the day go by, and another brings it back.
  await stand(page, -1.5, 3.1, -2.95, 2.45, -0.4);
  await expect(page.locator("#bakery-interact")).toContainText("lie down");
  await page.keyboard.press("e");
  await expect.poll(async () => (await inside(page)).night).toBe(true);
  await expect(page.locator("#bakery-light")).toHaveText("Golden afternoon");
  await expect(page.locator("#bakery-interact")).toContainText("Sleep until the morning");
  await page.keyboard.press("e");
  await expect.poll(async () => (await inside(page)).night).toBe(false);
  // The bath fills once the taps are on.
  await stand(page, 2.6, -3.5, 3.42, -2.5, -0.45);
  await expect(page.locator("#bakery-interact")).toContainText("Run the bath");
  await page.keyboard.press("e");
  await expect(page.locator("#bakery-interact")).toContainText("Turn off the taps");
  await expect.poll(async () => (await inside(page)).bath, { timeout: 8000 }).toBeGreaterThan(0.05);
  // Linnet's beds answer, and the walk back down lands on the hall's tiles.
  await stand(page, -2.6, -3.4, -2.3, -2.4, -0.5);
  await expect.poll(async () => (await inside(page)).nearest).toBe("linnet-bed");
  const { minX, maxX, bottomZ, topZ } = INN.stair;
  await page.evaluate(({ x, z }) => window.__willowmere.placeInterior({ x, z, yaw: Math.PI, pitch: 0 }), { x: (minX + maxX) / 2, z: topZ - 0.1 });
  await page.keyboard.down("w");
  await page.waitForFunction((z) => window.__willowmere.getInterior().position.z > z, bottomZ, { timeout: 60000 });
  await page.keyboard.up("w");
  state = await inside(page);
  expect(state.level).toBe("ground");
  expect(state.floor).toBe(0);
});

test("the wireless plays and the guest book turns its pages", async ({ page }) => {
  await enter(page);
  await stand(page, 4.85, -1.05, 5.02, -1.76, -0.3);
  await expect(page.locator("#bakery-interact")).toContainText("Turn on the wireless");
  await page.keyboard.press("e");
  expect((await inside(page)).music).toBe(true);
  await expect(page.locator("#bakery-interact")).toContainText("Turn off the wireless");
  await stand(page, -0.3, 1.3, -1.14, 1.32, -0.5);
  await expect(page.locator("#bakery-interact")).toContainText("guest book");
  await page.keyboard.press("e");
  const first = await page.locator("#bakery-note p").textContent();
  await page.keyboard.press("e");
  expect(await page.locator("#bakery-note p").textContent()).not.toBe(first);
});

test("Thistledown keeps its shadows cached and its draws within budget", async ({ page }) => {
  await enter(page);
  const measure = (quality) =>
    page.evaluate(async (quality) => {
      const select = document.querySelector("#quality");
      select.value = quality;
      select.dispatchEvent(new Event("change"));
      await new Promise(requestAnimationFrame);
      const samples = [];
      for (let i = 0; i < 40; i++) {
        await new Promise(requestAnimationFrame);
        samples.push(window.__willowmere.getInterior());
      }
      const draws = samples.map((s) => s.drawCalls).sort((a, b) => a - b),
        triangles = samples.map((s) => s.triangles).sort((a, b) => a - b);
      return { render: samples.at(-1).render, draws: draws[20], triangles: triangles[20] };
    }, quality);
  const high = await measure("high");
  expect(high.render).toMatchObject({ shadowAutoUpdate: false, sunShadow: 2048 });
  expect(high.draws).toBeLessThan(BUDGET.high);
  expect(high.triangles).toBeLessThan(BUDGET.triangles);
  const performance = await measure("performance");
  expect(performance.draws).toBeLessThan(BUDGET.performance);
  // The hour and the floor change only the lamps' strength and place.
  const programs = () => page.evaluate(() => window.__willowmere.getInterior());
  const before = await programs();
  await page.click("#bakery-menu");
  await page.click("#bakery-light");
  await page.click("#bakery-resume");
  await expect.poll(async () => (await inside(page)).night).toBe(true);
  expect((await programs()).render.shadowAutoUpdate).toBe(before.render.shadowAutoUpdate);
});
const BUDGET = { high: 420, performance: 250, triangles: 500000 };
