import { test, expect } from "@playwright/test";

const BRIDGE = { minX: 9.1, maxX: 14.9, minZ: 1.25, maxZ: 4.75 };

test("click-to-move routes across the brook to the far bank", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere);
  await page.locator("#start").click();

  const route = await page.evaluate(() => {
    const game = window.__willowmere;
    return game.findPath(game.getPlayer(), { x: 19, z: -2.5 });
  });
  expect(route.length).toBeGreaterThan(0);
  expect(route.at(-1)).toEqual({ x: 19, z: -2.5 });
  expect(
    route.some(
      (p) =>
        p.x > BRIDGE.minX &&
        p.x < BRIDGE.maxX &&
        p.z > BRIDGE.minZ &&
        p.z < BRIDGE.maxZ,
    ),
  ).toBe(true);
  const blocked = await page.evaluate(
    (route) => route.filter((p) => window.__willowmere.blocked(p.x, p.z, 0.3)),
    route,
  );
  expect(blocked).toEqual([]);
  for (let i = 1; i < route.length - 1; i++)
    expect(
      Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z),
    ).toBeLessThan(0.93);

  // Click a far-bank spot that is on screen and walk there.
  const goal = await page.evaluate(() => {
    const game = window.__willowmere;
    for (let z = 6; z >= -10; z -= 1)
      for (let x = 19; x >= 16; x -= 1) {
        const s = game.project(x, z);
        if (
          !game.blocked(x, z, 0.6) &&
          s.x > 80 &&
          s.x < innerWidth - 80 &&
          s.y > 80 &&
          s.y < innerHeight - 80
        )
          return { x, z, screen: s };
      }
    return null;
  });
  expect(goal).not.toBeNull();
  await page.mouse.click(goal.screen.x, goal.screen.y);
  await page.waitForFunction(
    ({ x, z }) => {
      const p = window.__willowmere.getPlayer();
      return Math.hypot(p.x - x, p.z - z) < 0.6;
    },
    goal,
    { timeout: 30000 },
  );
  expect(errors).toEqual([]);
});

test("unreachable and blocked clicks return no route", async ({ page }) => {
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere);
  const routes = await page.evaluate(() => {
    const game = window.__willowmere,
      from = game.getPlayer();
    return {
      // Mid-brook and beyond the map's rim.
      water: game.findPath(from, { x: 12, z: -8 }).length,
      outside: game.findPath(from, { x: 60, z: 0 }).length,
    };
  });
  expect(routes).toEqual({ water: 0, outside: 0 });
});

test("the open country and the pocket south of the mill are reachable", async ({ page }) => {
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere);
  const routes = await page.evaluate(() => {
    const game = window.__willowmere,
      from = game.getPlayer();
    return [
      [30, 0],
      [-40, -35],
      [40, 35],
      // Sealed by the mill, its shrubs and the old walk box's edge until the
      // map grew.
      [20, -12],
    ].map(([x, z]) => game.findPath(from, { x, z }).length);
  });
  for (const length of routes) expect(length).toBeGreaterThan(1);
});

test("lamps share a fixed pool of point lights", async ({ page }) => {
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere);
  await page.locator("#start").click();
  const lanterns = () =>
    page.evaluate(() => window.__willowmere.getDiagnostics().lanterns);
  const before = await lanterns();
  expect(before.pointLights).toBe(before.pool);
  // While the village has no more lamps than the pool, every lamp is lit.
  expect(before.lamps).toBeLessThanOrEqual(before.pool);
  for (const lamp of before.lampPositions)
    expect(
      before.lit.some(
        (p) =>
          Math.hypot(p[0] - lamp[0], p[1] - lamp[1], p[2] - lamp[2]) < 1e-3,
      ),
    ).toBe(true);

  await page.evaluate(() => {
    const select = document.querySelector("#day-select");
    select.value = "dusk";
    select.dispatchEvent(new Event("change"));
  });
  await page.keyboard.down("d");
  await page.waitForTimeout(1500);
  await page.keyboard.up("d");
  const after = await lanterns();
  expect(after.pointLights).toBe(before.pool);
  expect(after.programs).toBe(before.programs);
});
