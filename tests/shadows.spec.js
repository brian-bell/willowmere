import { test, expect } from "@playwright/test";

const shadow = (page) =>
  page.evaluate(() => window.__willowmere.getDiagnostics().shadow);
const extent = ({ bounds: [left, right, bottom, top] }) => [
  right - left,
  top - bottom,
];

test("sun shadows fit the overview in whole texels and keep eye-level detail", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  await page.locator("#start").click();
  await expect
    .poll(async () =>
      page.evaluate(() => window.__willowmere.getDiagnostics().camera.viewHeight),
    )
    .toBeLessThan(18.02);
  const overview = await shadow(page);
  expect(overview.mapSize).toBe(2048);

  // Walking moves the bounds only by whole texels and keeps their size.
  await page.locator("#scene").focus();
  await page.keyboard.down("d");
  const walk = await page.evaluate(async () => {
    const values = [];
    for (let i = 0; i < 40; i++) {
      await new Promise(requestAnimationFrame);
      values.push(window.__willowmere.getDiagnostics().shadow.bounds);
    }
    return values;
  });
  await page.keyboard.up("d");
  const [width, height] = extent(overview);
  for (const [left, right, bottom, top] of walk) {
    expect(right - left).toBeCloseTo(width, 6);
    expect(top - bottom).toBeCloseTo(height, 6);
    const column = left / (width / overview.mapSize),
      row = bottom / (height / overview.mapSize);
    expect(Math.abs(column - Math.round(column))).toBeLessThan(1e-3);
    expect(Math.abs(row - Math.round(row))).toBeLessThan(1e-3);
  }

  // Zooming in spends the same texels on a smaller area; zooming out widens it.
  for (let i = 0; i < 3; i++) await page.locator("#zoom-in").click();
  await expect
    .poll(async () => extent(await shadow(page))[0])
    .toBeLessThan(width * 0.8);
  const near = extent(await shadow(page));
  for (let i = 0; i < 10; i++) await page.locator("#zoom-out").click();
  await expect
    .poll(async () => extent(await shadow(page))[0])
    .toBeGreaterThan(width);
  const far = extent(await shadow(page));
  expect(near[0] * near[1]).toBeLessThan(width * height);
  expect(far[0] * far[1]).toBeGreaterThan(width * height);

  // First person sees across the whole village up close, so it keeps a finer map.
  await page.locator("#view-toggle").click();
  await expect.poll(async () => (await shadow(page)).mapSize).toBe(4096);
  expect(extent(await shadow(page))).toEqual(far);
  await page.locator("#view-toggle").click();
  await expect.poll(async () => (await shadow(page)).mapSize).toBe(2048);
  expect(errors).toEqual([]);
});
