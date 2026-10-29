import { test, expect } from "@playwright/test";
import { createInteriorWalker } from "../src/interior-movement.js";

async function face(page, x, z) {
  const state = await page.evaluate(() => window.__willowmere.getInterior());
  const desired = Math.atan2(state.position.x - x, state.position.z - z);
  let remaining = Math.atan2(
    Math.sin(desired - state.yaw),
    Math.cos(desired - state.yaw),
  );
  const viewport = page.viewportSize();
  while (Math.abs(remaining) > 0.001) {
    const turn = Math.max(-0.7, Math.min(0.7, remaining));
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      viewport.width / 2 - turn / 0.0035,
      viewport.height / 2,
      { steps: 4 },
    );
    await page.mouse.up();
    remaining -= turn;
  }
}
async function walk(page, x, z) {
  await face(page, x, z);
  await page.keyboard.down("w");
  try {
    await page.waitForFunction(
      ({ x, z }) => {
        const p = window.__willowmere.getInterior().position;
        return Math.hypot(p.x - x, p.z - z) < 0.23;
      },
      { x, z },
      { timeout: 8000 },
    );
  } finally {
    await page.keyboard.up("w");
  }
  await page.waitForTimeout(170);
}

// Collision verification uses large steps and a rotated obstacle to catch
// tunneling, and an actual route around the table to catch sticky sliding.
test("visitor stays grounded and can slide around furniture without tunneling", () => {
  const walker = createInteriorWalker({
    bounds: { minX: -6, maxX: 6, minZ: -6, maxZ: 6 },
    spawn: { x: 0, z: 4, yaw: 0 },
    colliders: [{ x: 0, z: 0, w: 3, d: 2, rotation: 0.2 }],
  });
  for (let i = 0; i < 12; i++) walker.update(0.25, 1, 0, true);
  expect(walker.position.z).toBeGreaterThan(1.2);
  expect(walker.blocked(walker.position.x, walker.position.z)).toBe(false);
  for (let i = 0; i < 4; i++) walker.update(0.25, 0, 1);
  for (let i = 0; i < 12; i++) walker.update(0.25, 1, 0);
  expect(walker.position.z).toBeLessThan(-2);
  for (let i = 0; i < 40; i++) walker.update(0.25, 1, 0, true);
  expect(walker.position.z).toBeGreaterThanOrEqual(-5.76);
  walker.look(0, 100);
  expect(walker.pitch).toBeLessThan(Math.PI / 2);
  walker.reset();
  expect(walker.position).toEqual({ x: 0, z: 4 });
});

test("walk inside, collide with the workbench, meet residents, and leave through the door", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  const before = await page.evaluate(() => ({
    position: window.__willowmere.getPlayer(),
    state: window.__willowmere.getState(),
  }));
  await page.getByRole("button", { name: "The bakery", exact: true }).click();
  await page.waitForFunction(() => window.__willowmere.getInterior().active);
  await expect(page).toHaveURL(/interior=bakery/);
  expect(
    (await page.evaluate(() => window.__willowmere.getInterior())).mode,
  ).toBe("first-person");
  await expect(page.locator(".bakery-views")).toHaveCount(0);
  await walk(page, 1.4, 3.3);
  await walk(page, -0.6, 2.0);
  await face(page, -0.6, -4);
  await page.keyboard.down("w");
  await page.waitForTimeout(1600);
  await page.keyboard.up("w");
  const stopped = await page.evaluate(
    () => window.__willowmere.getInterior().position,
  );
  expect(stopped.z).toBeGreaterThan(1.16);
  expect(stopped.z).toBeLessThan(1.45);
  expect(await page.evaluate(() => window.__willowmere.getPlayer())).toEqual(
    before.position,
  );
  await walk(page, -0.6, 2.2);
  await walk(page, -3, 1.9);
  await face(page, -2.9, 0.5);
  await expect(page.locator("#bakery-interact")).toContainText("Crumb");
  await page.keyboard.press("e");
  await expect(page.locator("#bakery-note")).toContainText("patient folds");
  await walk(page, -4.9, 1.0);
  await face(page, -6.5, 0.45);
  await expect(page.locator("#bakery-interact")).toContainText("Cinnamon");
  await page.keyboard.press("e");
  await expect(page.locator("#bakery-note")).toContainText("sleepy eye");
  await walk(page, -3, 1.9);
  await walk(page, -1, 3.0);
  await walk(page, 4.8, 4.65);
  await face(page, 4.8, 5.45);
  await expect(page.locator("#bakery-interact")).toContainText("Step out");
  await page.keyboard.press("e");
  await page.waitForFunction(() => !window.__willowmere.getInterior().active);
  await expect(page).not.toHaveURL(/interior=/);
  expect(await page.evaluate(() => window.__willowmere.getPlayer())).toEqual(
    before.position,
  );
  const after = await page.evaluate(() => window.__willowmere.getState());
  expect({ ...after, started: before.state.started }).toEqual(before.state);
  expect(errors).toEqual([]);
});

test("pause, photo, free look and returning visits do not leave stuck movement", async ({
  page,
}) => {
  await page.goto("/?interior=bakery");
  await page.waitForFunction(() => window.__willowmere?.getInterior().active);
  const entry = await page.evaluate(
    () => window.__willowmere.getInterior().position,
  );
  await page.keyboard.down("w");
  await page.waitForTimeout(350);
  await page.keyboard.press("Escape");
  await page.keyboard.up("w");
  await expect(page.locator("#bakery-pause")).toBeVisible();
  const paused = await page.evaluate(
    () => window.__willowmere.getInterior().position,
  );
  expect(Math.hypot(paused.x - entry.x, paused.z - entry.z)).toBeGreaterThan(
    0.3,
  );
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => window.__willowmere.getInterior().position),
  ).toEqual(paused);
  await page.getByRole("button", { name: "After hours", exact: true }).click();
  expect(
    await page.evaluate(() => window.__willowmere.getInterior().night),
  ).toBe(true);
  await page.getByRole("button", { name: "Photo", exact: false }).click();
  await expect(page.locator("#bakery-pause")).toBeHidden();
  await expect(page.locator(".bakery-photo-return")).toBeVisible();
  await expect(page.locator(".bakery-heading")).toBeHidden();
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(() => window.__willowmere.getInterior().active),
  ).toBe(true);
  const yaw = await page.evaluate(() => window.__willowmere.getInterior().yaw);
  await page.locator("#bakery-look").click();
  await page.waitForFunction(
    () => window.__willowmere.getInterior().pointerLocked,
  );
  await page.mouse.move(850, 500);
  await page.mouse.move(950, 500);
  expect(
    await page.evaluate(() => window.__willowmere.getInterior().yaw),
  ).not.toBe(yaw);
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => !window.__willowmere.getInterior().pointerLocked,
  );
  await page.getByRole("button", { name: "Pause bakery visit" }).click();
  await page
    .getByRole("button", { name: "Return to the village", exact: true })
    .click();
  await page.getByRole("button", { name: "The bakery", exact: true }).click();
  await expect(page.locator("#bakery-view")).toBeVisible();
  expect(
    await page.evaluate(() => window.__willowmere.getInterior().position),
  ).toEqual(entry);
  await page.waitForTimeout(150);
  expect(
    await page.evaluate(() => window.__willowmere.getInterior().position),
  ).toEqual(entry);
  expect(await page.locator("#bakery-view").count()).toBe(1);
});

test("bakery door in the village enters the room at walking height", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  await page.locator("#start").click();
  for (let segment = 0; segment < 20; segment++) {
    const next = await page.evaluate(() => {
      const game = window.__willowmere,
        p = game.getPlayer();
      if (Math.hypot(p.x - 1.2, p.z + 5.2) < 0.45) return null;
      const route = game.findPath(p, { x: 1.2, z: -5.2 });
      if (!route.length) throw Error("Bakery door has no walking route");
      const step = route[Math.min(4, route.length - 1)];
      return { step, screen: game.project(step.x, step.z) };
    });
    if (!next) break;
    await page.mouse.click(next.screen.x, next.screen.y);
    await page.waitForFunction(({ x, z }) => {
      const p = window.__willowmere.getPlayer();
      return Math.hypot(p.x - x, p.z - z) < 0.4;
    }, next.step);
    await page.waitForTimeout(160);
  }
  await expect(page.locator("#interaction")).toContainText(
    "Enter The Daily Loaf",
  );
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__willowmere.getInterior().active);
  await face(page, 4.8, 5.45);
  await page.keyboard.press("e");
  await page.waitForFunction(() => !window.__willowmere.getInterior().active);
  const p = await page.evaluate(() => window.__willowmere.getPlayer());
  expect(Math.hypot(p.x - 1.2, p.z + 5.2)).toBeLessThan(0.5);
});

test("touch walking and drag look work with reduced motion on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?interior=bakery");
  await page.waitForFunction(() => window.__willowmere?.getInterior().active);
  const before = await page.evaluate(() => window.__willowmere.getInterior());
  const button = page.getByRole("button", {
    name: "Walk forward",
    exact: true,
  });
  const box = await button.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  const after = await page.evaluate(() => window.__willowmere.getInterior());
  expect(
    Math.hypot(
      after.position.x - before.position.x,
      after.position.z - before.position.z,
    ),
  ).toBeGreaterThan(0.7);
  await page.mouse.move(280, 350);
  await page.mouse.down();
  await page.mouse.move(190, 390, { steps: 8 });
  await page.mouse.up();
  const looked = await page.evaluate(() => window.__willowmere.getInterior());
  expect(looked.yaw).toBeGreaterThan(after.yaw + 0.2);
  expect(looked.pitch).toBeLessThan(after.pitch - 0.1);
  await page.getByRole("button", { name: "Pause bakery visit" }).click();
  await page
    .getByRole("button", { name: "Return to the village", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.__willowmere.getInterior().active),
  ).toBe(false);
});
