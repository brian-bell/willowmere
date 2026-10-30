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
});
