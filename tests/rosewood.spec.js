import { test, expect } from "@playwright/test";
import { defaultState } from "../src/game/save.js";
import { DIG, PUZZLE_PIECES, TREASURES, createTrail, dig, placePiece } from "../src/game/rosewood.js";

test("Bark digs up each treasure once, pays for it, then finds his bone", { tag: "@logic" }, () => {
  const state = defaultState();
  const coins = state.coins;
  for (const [i, treasure] of TREASURES.entries()) {
    expect(dig(state)).toEqual({ kind: "found", treasure, petals: DIG.petals });
    expect(state.rosewood.treasures).toHaveLength(i + 1);
  }
  expect(state.coins).toBe(coins + TREASURES.length * DIG.petals);
  expect(dig(state)).toEqual({ kind: "bone" });
  expect(state.coins).toBe(coins + TREASURES.length * DIG.petals);
});

test("the jigsaw fills piece by piece, finishes, and starts over", { tag: "@logic" }, () => {
  const state = defaultState();
  expect(placePiece(state)).toEqual({ kind: "placed", placed: 1, left: PUZZLE_PIECES - 1 });
  for (let i = 2; i < PUZZLE_PIECES; i++) placePiece(state);
  expect(placePiece(state)).toEqual({ kind: "done" });
  expect(state.rosewood.puzzle).toBe(PUZZLE_PIECES);
  expect(placePiece(state)).toEqual({ kind: "restart" });
  expect(state.rosewood.puzzle).toBe(0);
});

// Bark follows the visitor's own footsteps, so he turns corners where they
// did instead of cutting through the wall between.
test("Bark keeps to the visitor's trail through a doorway and stops short of them", { tag: "@logic" }, () => {
  const trail = createTrail(0.2);
  const dog = { x: 0, z: 4 };
  trail.reset(dog, { x: 0, z: 4 });
  // Down the hall, then left through a doorway at z = 1.
  const path = [];
  for (let z = 4; z >= 1; z -= 0.05) path.push({ x: 0, z });
  for (let x = 0; x >= -3; x -= 0.05) path.push({ x, z: 1 });
  for (const p of path) {
    trail.record(p.x, p.z);
    trail.follow(dog, 0.06, 1.5);
    // Never off the L: on the hall's line, or on the doorway's.
    const onHall = Math.abs(dog.x) < 0.15 && dog.z >= 1 - 0.15;
    const onDoor = Math.abs(dog.z - 1) < 0.15 && dog.x <= 0.15;
    expect(onHall || onDoor).toBe(true);
  }
  for (let i = 0; i < 200; i++) trail.follow(dog, 0.06, 1.5);
  expect(trail.remaining(dog)).toBeCloseTo(1.5, 1);
  expect(dog.z).toBeCloseTo(1, 2);
  expect(dog.x).toBeCloseTo(-1.5, 1);
});

test("old saves gain Rosewood's progress", { tag: "@logic" }, () => {
  const state = defaultState();
  expect(state.rosewood).toEqual({ treasures: [], puzzle: 0, fetches: 0 });
});

// --------------------------------------------------------------- in the game

async function enter(page) {
  await page.goto("/?interior=rosewood&resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getInterior().room === "rosewood");
}
// Stands the visitor at (x, z) facing (tx, tz), like the bakery tests' face().
async function stand(page, x, z, tx, tz, pitch = -0.2) {
  await page.evaluate(
    ({ x, z, yaw, pitch }) => window.__willowmere.placeInterior({ x, z, yaw, pitch }),
    { x, z, yaw: Math.atan2(x - tx, z - tz), pitch },
  );
  await page.waitForTimeout(200);
}
async function walk(page, x, z) {
  const state = await page.evaluate(() => window.__willowmere.getInterior());
  await stand(page, state.position.x, state.position.z, x, z, -0.05);
  await page.keyboard.down("w");
  try {
    await page.waitForFunction(
      ({ x, z }) => {
        const p = window.__willowmere.getInterior().position;
        return Math.hypot(p.x - x, p.z - z) < 0.25;
      },
      { x, z },
      { timeout: 10000 },
    );
  } finally {
    await page.keyboard.up("w");
  }
}

test("Rosewood's front door opens your cottage, Bark greets you, and the door leads back out", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  await page.evaluate(() => window.__willowmere.moveTo(-7, -2.6, Math.PI));
  await expect(page.locator("#interaction")).toContainText("Step inside Rosewood");
  const outside = await page.evaluate(() => window.__willowmere.getPlayer());
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__willowmere.getInterior().active);
  await expect(page).toHaveURL(/interior=rosewood/);
  await expect(page.locator(".bakery-heading h1")).toHaveText("Rosewood");
  await expect(page.locator("#bakery-note")).toContainText("Bark");
  await stand(page, 0, 5.1, 0, 6.2, 0);
  await expect(page.locator("#bakery-interact")).toContainText("Step out");
  await page.keyboard.press("e");
  await page.waitForFunction(() => !window.__willowmere.getInterior().active);
  await expect(page).not.toHaveURL(/interior=/);
  expect(await page.evaluate(() => window.__willowmere.getPlayer())).toEqual(outside);
  expect(errors).toEqual([]);
});

test("the hall leads to the living room, bedroom, kitchen and garden, and Bark follows", async ({ page }) => {
  await enter(page);
  await walk(page, 0, 3.9);
  await walk(page, -2.2, 3.9);
  await walk(page, 0, 3.9);
  await walk(page, 0, 1.1);
  await walk(page, 2.4, 1.1);
  await walk(page, 0, 1.1);
  await walk(page, 0, -1.6);
  await walk(page, 3.8, -4.2);
  await walk(page, 3.8, -7.2);
  await page.waitForFunction(() => window.__willowmere.getInterior().bark.z < -4.5, null, { timeout: 15000 });
});

test("fetch, dig, feed the fish, fit a piece and nap", async ({ page }) => {
  await enter(page);
  const state = () => page.evaluate(() => window.__willowmere.getState());
  const before = await state();
  // Pick up the ball and throw it down the lawn; Bark brings it back.
  await stand(page, -3.2, -7.2, -3.2, -8.6, -0.5);
  await expect(page.locator("#bakery-interact")).toContainText("ball");
  await page.keyboard.press("e");
  expect((await page.evaluate(() => window.__willowmere.getInterior())).holding).toBe(true);
  await stand(page, 3.0, -6.4, 3.0, -10, -0.1);
  await expect(page.locator("#bakery-interact")).toContainText("Throw");
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__willowmere.getInterior().bark.mode !== "follow");
  await page.waitForFunction(() => window.__willowmere.getState().rosewood.fetches === 1, null, { timeout: 20000 });
  expect((await page.evaluate(() => window.__willowmere.getInterior())).holding).toBe(true);
  // Bark digs up his first treasure for the shelf.
  await stand(page, -1.4, -7.6, -1.4, -9.4, -0.5);
  await expect(page.locator("#bakery-interact")).toContainText("dig");
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__willowmere.getState().rosewood.treasures.length === 1, null, { timeout: 20000 });
  await expect(page.locator("#bakery-note")).toContainText("brass button");
  expect((await state()).coins).toBe(before.coins + 3);
  // The fish, the jigsaw and a nap.
  await stand(page, -2.45, 3.6, -2.45, 5.5, -0.3);
  await expect(page.locator("#bakery-interact")).toContainText("Feed the fish");
  await page.keyboard.press("e");
  expect((await page.evaluate(() => window.__willowmere.getInterior())).feeding).toBe(true);
  await stand(page, -3.95, 3.2, -3.95, 1.45, -0.6);
  await expect(page.locator("#bakery-interact")).toContainText("jigsaw");
  await page.keyboard.press("e");
  expect((await state()).rosewood.puzzle).toBe(1);
  await stand(page, 4.6, 1.5, 4.9, 2.9, -0.5);
  await expect(page.locator("#bakery-interact")).toContainText("nap");
  await page.keyboard.press("e");
  expect((await page.evaluate(() => window.__willowmere.getInterior())).night).toBe(true);
  await expect(page.locator("#bakery-light")).toHaveText("Golden afternoon");
});

test("Rosewood keeps its shadows cached and its draws within budget", async ({ page }) => {
  await enter(page);
  const measure = (quality) =>
    page.evaluate(async (quality) => {
      const select = document.querySelector("#quality");
      select.value = quality;
      select.dispatchEvent(new Event("change"));
      const draws = [];
      for (let i = 0; i < 40; i++) {
        await new Promise(requestAnimationFrame);
        draws.push(window.__willowmere.getInterior().drawCalls);
      }
      draws.sort((a, b) => a - b);
      return { render: window.__willowmere.getInterior().render, draws: draws[20] };
    }, quality);
  const high = await measure("high");
  expect(high.render).toMatchObject({ shadowAutoUpdate: false, sunShadow: 2048 });
  expect(high.draws).toBeLessThan(BUDGET.high);
  const performance = await measure("performance");
  expect(performance.draws).toBeLessThan(BUDGET.performance);
});
const BUDGET = { high: 400, performance: 250 };
