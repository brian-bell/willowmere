import { test, expect } from "@playwright/test";

const shadow = (page) =>
  page.evaluate(() => window.__willowmere.getDiagnostics().shadow);
const extent = ({ bounds: [left, right, bottom, top] }) => [
  right - left,
  top - bottom,
];

test("sun shadows fit the view in whole texels and keep eye-level detail", async ({
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
  // Out to the zoom cap.
  while (!(await page.locator("#zoom-out").isDisabled()))
    await page.locator("#zoom-out").click();
  await expect
    .poll(async () => extent(await shadow(page))[0])
    .toBeGreaterThan(width);
  const far = extent(await shadow(page));
  expect(near[0] * near[1]).toBeLessThan(width * height);
  expect(far[0] * far[1]).toBeGreaterThan(width * height);

  // First person fits a finer map to a village-sized box ahead of the eye:
  // the old whole-village texel density, on a map of any size.
  await page.locator("#view-toggle").click();
  await expect.poll(async () => (await shadow(page)).mapSize).toBe(4096);
  // The next frame fits the bounds after the map is resized.
  await expect
    .poll(async () => {
      const { bounds, reference } = await shadow(page);
      return Math.abs(extent({ bounds })[0] - reference[0]);
    })
    .toBeLessThan(1e-4);
  const eye = await shadow(page),
    [eyeWidth, eyeHeight] = extent(eye);
  expect(eyeWidth).toBeCloseTo(eye.reference[0], 4);
  expect(eyeHeight).toBeCloseTo(eye.reference[1], 4);
  // Turning moves the box in whole texels and keeps its size.
  await page.keyboard.down("ArrowLeft");
  const turn = await page.evaluate(async () => {
    const values = [];
    for (let i = 0; i < 30; i++) {
      await new Promise(requestAnimationFrame);
      values.push(window.__willowmere.getDiagnostics().shadow.bounds);
    }
    return values;
  });
  await page.keyboard.up("ArrowLeft");
  expect(new Set(turn.map((b) => b.join())).size).toBeGreaterThan(1);
  for (const [left, right, bottom, top] of turn) {
    expect(right - left).toBeCloseTo(eyeWidth, 6);
    expect(top - bottom).toBeCloseTo(eyeHeight, 6);
    const column = left / (eyeWidth / 4096),
      row = bottom / (eyeHeight / 4096);
    expect(Math.abs(column - Math.round(column))).toBeLessThan(1e-3);
    expect(Math.abs(row - Math.round(row))).toBeLessThan(1e-3);
  }
  await page.locator("#view-toggle").click();
  await expect.poll(async () => (await shadow(page)).mapSize).toBe(2048);
  expect(errors).toEqual([]);
});
