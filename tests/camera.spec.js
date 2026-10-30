import { test, expect } from "@playwright/test";

const camera = (page) =>
  page.evaluate(() => window.__willowmere.getDiagnostics().camera);

test("map tilt preserves heading and zoom, clamps at both limits, and resets", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  await page.locator("#start").click();
  await expect.poll(async () => (await camera(page)).viewHeight).toBeLessThan(18.1);
  const original = await camera(page);
  await expect(page.getByRole("button", { name: "Reset tilt", exact: true })).toBeDisabled();

  // Space must activate the focused button instead of the game's interact action.
  await page.locator("#tilt-up").focus();
  await page.keyboard.press("Space");
  await expect.poll(async () => (await camera(page)).targetTilt).toBeCloseTo(original.tilt + 5);
  await expect(page.locator("#dialogue")).toBeHidden();
  for (let i = 0; i < 8; i++) await page.locator("#tilt-up").click();
  await expect(page.locator("#tilt-up")).toBeDisabled();
  await expect(page.locator("#tilt-angle")).toHaveText("75°");
  await expect.poll(async () => (await camera(page)).tilt).toBeGreaterThan(74.9);
  const overhead = await camera(page);
  expect(overhead.viewHeight).toBeCloseTo(18, 1);
  expect(Math.hypot(...overhead.offset)).toBeCloseTo(Math.hypot(...original.offset));
  expect(overhead.offset[0] / overhead.offset[2]).toBeCloseTo(27 / 44);

  for (let i = 0; i < 11; i++) await page.locator("#tilt-down").click();
  await expect(page.locator("#tilt-down")).toBeDisabled();
  await expect(page.locator("#tilt-angle")).toHaveText("20°");
  await expect.poll(async () => (await camera(page)).tilt).toBeLessThan(20.1);
  await page.locator("#tilt-reset").click();
  await expect(page.locator("#tilt-reset")).toBeDisabled();
  expect((await camera(page)).targetTilt).toBeCloseTo(original.tilt);

  await page.locator("#tilt-up").click();
  // Photo shortcut must still work while a view control has focus.
  await page.keyboard.press("p");
  await expect(page.locator(".view-controls")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator(".view-controls")).toBeVisible();
  expect(errors).toEqual([]);
});

test("pan controls move the view without moving the player and recenter independently", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  await page.locator("#start").click();
  await expect.poll(async () => (await camera(page)).viewHeight).toBeLessThan(18.02);
  await page.locator("#tilt-up").click();
  await page.waitForFunction(() => {
    const camera = window.__willowmere.getDiagnostics().camera;
    return camera.tilt === camera.targetTilt;
  });
  const original = await camera(page);
  const player = await page.evaluate(() => window.__willowmere.getPlayer());
  await expect(page.locator("#pan-reset")).toBeDisabled();
  const projectPlayer = () => page.evaluate(() => {
    const game = window.__willowmere, player = game.getPlayer();
    return game.project(player.x, player.z);
  });
  const before = await projectPlayer();
  await page.locator("#pan-right").focus();
  await page.keyboard.press("Space");
  await expect.poll(async () => (await camera(page)).pan).toEqual([3, 0]);
  expect((await projectPlayer()).x).toBeLessThan(before.x - 50);
  await page.locator("#pan-up").click();
  await expect.poll(async () => (await camera(page)).pan).toEqual([3, -3]);
  expect((await projectPlayer()).y).toBeGreaterThan(before.y + 30);
  expect(await page.evaluate(() => window.__willowmere.getPlayer())).toEqual(player);
  for (const [direction, limit] of [["right", [18, -3]], ["left", [-18, -3]], ["up", [-18, -18]], ["down", [-18, 18]]]) {
    const button = page.locator(`#pan-${direction}`);
    while (await button.isEnabled()) await button.click();
    await expect.poll(async () => (await camera(page)).pan).toEqual(limit);
  }
  await page.locator("#pan-reset").click();
  await expect.poll(async () => (await camera(page)).pan).toEqual([0, 0]);
  await expect(page.locator("#pan-reset")).toBeDisabled();
  const reset = await camera(page);
  expect(reset.tilt).toBe(original.tilt);
  expect(reset.viewHeight).toBeCloseTo(original.viewHeight, 1);

  // Ground picking uses the panned camera as well as the tilted camera.
  await page.locator("#pan-right").click();
  await page.locator("#pan-down").click();
  await expect.poll(async () => (await camera(page)).pan).toEqual([3, 3]);
  const destination = { x: -3, z: 6.5 };
  const point = await page.evaluate((p) => window.__willowmere.project(p.x, p.z), destination);
  await page.mouse.click(point.x, point.y);
  await expect.poll(async () => {
    const position = await page.evaluate(() => window.__willowmere.getPlayer());
    return Math.hypot(position.x - destination.x, position.z - destination.z);
  }, { timeout: 10000 }).toBeLessThan(0.4);
  expect(errors).toEqual([]);
});

test("tilted map supports click-to-walk and fits mobile screens", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  await page.locator("#start").click();
  // Verify ground picking at both ends of the tilt range.
  for (const [control, count, angle, destination] of [
    ["#tilt-up", 9, 75, { x: -3, z: 6.5 }],
    ["#tilt-down", 11, 20, { x: -3, z: 5 }],
  ]) {
    for (let i = 0; i < count; i++) await page.locator(control).click();
    await expect.poll(async () => (await camera(page)).tilt).toBe(angle);
    const point = await page.evaluate((p) => window.__willowmere.project(p.x, p.z), destination);
    await page.mouse.click(point.x, point.y);
    await expect.poll(async () => {
      const player = await page.evaluate(() => window.__willowmere.getPlayer());
      return Math.hypot(player.x - destination.x, player.z - destination.z);
    }, { timeout: 10000 }).toBeLessThan(0.4);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const controls = await page.locator(".view-controls").boundingBox();
  const quest = await page.locator(".quest-card").boundingBox();
  expect(controls.x).toBeGreaterThan(quest.x + quest.width);
  expect(controls.x + controls.width).toBeLessThanOrEqual(390);
  expect(controls.y).toBeGreaterThan(100);
  expect(controls.y + controls.height).toBeLessThan(700);
  await page.setViewportSize({ width: 844, height: 390 });
  const landscape = await page.locator(".view-controls").boundingBox();
  expect(landscape.y).toBeGreaterThan(80);
  expect(landscape.y + landscape.height).toBeLessThan(300);
});
