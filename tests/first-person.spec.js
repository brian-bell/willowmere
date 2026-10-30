import { test, expect } from "@playwright/test";

const view = (page) => page.evaluate(() => window.__willowmere.getView());
const position = (page) => page.evaluate(() => window.__willowmere.getPlayer());

async function start(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  await page.locator("#start").click();
  await page.locator("#view-toggle").click();
}

async function drag(page, dx, dy = 0) {
  await page.mouse.move(800, 500);
  await page.mouse.down();
  await page.mouse.move(800 + dx, 500 + dy, { steps: 8 });
  await page.mouse.up();
}

async function hold(page, key, duration) {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
  await page.waitForTimeout(400);
}

test("first person looks, walks, collides, interacts and returns to village view", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  await expect(page.locator("#view-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#zoom-in")).toBeHidden();
  const before = await view(page);
  expect(before.camera).toBe("PerspectiveCamera");
  expect(before.playerVisible).toBe(false);
  const ground = await page.evaluate(
    () => window.__willowmere.getDiagnostics().position[1],
  );
  expect(before.position[1]).toBeCloseTo(ground + 1.65);

  await drag(page, 100, 50);
  const looked = await view(page);
  expect(looked.yaw).toBeCloseTo(before.yaw - 0.35);
  expect(looked.pitch).toBeCloseTo(before.pitch - 0.175);
  const p = await position(page);
  await hold(page, "w", 450);
  const walked = await position(page);
  const forward = { x: -Math.sin(looked.yaw), z: -Math.cos(looked.yaw) };
  expect(
    (walked.x - p.x) * forward.x + (walked.z - p.z) * forward.z,
  ).toBeGreaterThan(0.7);
  expect(
    Math.abs((walked.x - p.x) * forward.z - (walked.z - p.z) * forward.x),
  ).toBeLessThan(0.1);
  const still = await position(page);
  await hold(page, "ArrowLeft", 300);
  expect((await view(page)).yaw).toBeGreaterThan(looked.yaw + 0.2);
  expect(await position(page)).toEqual(still);
  await hold(page, "PageUp", 200);
  expect((await view(page)).pitch).toBeGreaterThan(looked.pitch + 0.1);

  // Planting follows the view direction even when strafing last turned the avatar.
  await hold(page, "d", 250);
  const plantingPosition = await position(page);
  const plantingView = await view(page);
  await page.keyboard.press("3");
  await page.keyboard.press("e");
  const plant = await page.evaluate(() =>
    window.__willowmere.getState().plants.at(-1),
  );
  expect(plant.x).toBeCloseTo(
    plantingPosition.x - Math.sin(plantingView.yaw) * 0.8,
    1,
  );
  expect(plant.z).toBeCloseTo(
    plantingPosition.z - Math.cos(plantingView.yaw) * 0.8,
    1,
  );
  await page.keyboard.press("4");
  await page.keyboard.press("e");
  expect(
    await page.evaluate(
      () => window.__willowmere.getState().plants.at(-1).watered,
    ),
  ).toBe(true);

  // Reset to the spawn, face the fountain and walk into its collision boundary.
  await page.locator("#settings").click();
  await page.locator("#reset-position").click();
  const spawn = await position(page);
  const yaw = Math.atan2(spawn.x, spawn.z);
  await drag(page, ((await view(page)).yaw - yaw) / 0.0035);
  await hold(page, "w", 2500);
  const stopped = await position(page);
  expect(Math.hypot(stopped.x, stopped.z)).toBeGreaterThan(1.6);
  expect(
    await page.evaluate(
      ({ x, z }) => window.__willowmere.blocked(x, z),
      stopped,
    ),
  ).toBe(false);
  await expect(page.locator("#interaction")).toBeVisible();
  await page.keyboard.press("1");
  await page.keyboard.press("e");
  await expect(page.locator("#dialogue")).toBeVisible();
  await page.keyboard.press("Escape");

  const savedPosition = await position(page);
  await page.keyboard.press("v");
  expect((await view(page)).camera).toBe("OrthographicCamera");
  expect((await view(page)).playerVisible).toBe(true);
  expect(await position(page)).toEqual(savedPosition);
  await expect(page.locator("#zoom-in")).toBeVisible();
  expect(errors).toEqual([]);
});

test("free look, menus, photo, reload and bakery visits preserve a usable camera", async ({
  page,
}) => {
  await start(page);
  await page.locator("#free-look").click();
  await page.waitForFunction(() => window.__willowmere.getView().pointerLocked);
  const yaw = (await view(page)).yaw;
  await page.mouse.move(850, 500);
  await page.mouse.move(950, 500);
  expect((await view(page)).yaw).not.toBe(yaw);
  await page.keyboard.press("j");
  await expect(page.locator("#journal")).toBeVisible();
  await page.waitForFunction(
    () => !window.__willowmere.getView().pointerLocked,
  );
  await page.locator("#journal .close-modal").click();
  await page.keyboard.press("p");
  await expect(page.locator("#view-help")).toBeHidden();
  await expect(page.locator("#photo-hint")).toContainText("Drag to look");
  await page.keyboard.press("Escape");
  const village = await position(page);
  const villageView = await view(page);
  await page.locator("#visit-bakery").click();
  await page.waitForFunction(() => window.__willowmere.getInterior().active);
  await page.locator("#bakery-menu").click();
  await page.locator("#bakery-exit").click();
  await page.waitForFunction(() => !window.__willowmere.getInterior().active);
  expect(await position(page)).toEqual(village);
  expect((await view(page)).mode).toBe("first-person");
  expect((await view(page)).yaw).toBe(villageView.yaw);
  await expect(page.locator("#scene")).toHaveAttribute(
    "aria-label",
    /First-person village/,
  );
  await page.reload();
  await page.waitForFunction(
    () => window.__willowmere?.getView().mode === "first-person",
  );
  await expect(page.locator("#view-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("v");
  await page.reload();
  await page.waitForFunction(
    () => window.__willowmere?.getView().mode === "overview",
  );
});

test("touch walking and looking work at eye level with reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await start(page);
  const before = await position(page);
  const button = page.getByRole("button", {
    name: "Walk forward",
    exact: true,
  });
  const box = await button.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await button.dispatchEvent("pointerdown", { pointerId: 1 });
  await page.waitForTimeout(450);
  await button.dispatchEvent("pointerup", { pointerId: 1 });
  await page.waitForTimeout(400);
  const after = await position(page);
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(
    0.7,
  );
  const initial = await view(page);
  await page.mouse.move(280, 350);
  await page.mouse.down();
  await page.mouse.move(190, 390, { steps: 8 });
  await page.mouse.up();
  expect((await view(page)).yaw).toBeGreaterThan(initial.yaw + 0.2);
  expect((await view(page)).pitch).toBeLessThan(initial.pitch - 0.1);
  await expect(page.locator("#view-toggle")).toBeInViewport();
  await context.close();
});
