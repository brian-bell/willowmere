import { test, expect } from "@playwright/test";

for (const light of ["directional", "spot"])
  test(`a ${light} light's depth-only map still casts a soft-edged shadow`, async ({ page }) => {
    // Any page on the dev server will do; the fixture brings its own renderer.
    await page.goto("/package.json");
    const result = await page.evaluate(async (light) => {
      const { renderShadow } = await import("/tests/shadow-maps-fixture.js");
      return renderShadow(light);
    }, light);
    expect(result.error).toBe(0);
    expect(result.complete).toBe(true);
    expect(result.depthOnly).toBe(true);
    expect(result.sampler).toBe(true);
    const { row } = result,
      shadowed = row[row.length >> 1],
      lit = row[4];
    // A box a quarter of the floor's width darkens the middle and not the sides.
    expect(lit).toBeGreaterThan(shadowed + 30);
    // The edge steps through values between the two rather than jumping.
    expect(row.some((value) => value > shadowed + 3 && value < lit - 3)).toBe(true);
    expect(result.resized).toBe(true);
    expect(result.errorAfterResize).toBe(0);
    // And it all comes back after a lost context, exactly as it was.
    expect(result.errorAfterRestore).toBe(0);
    expect(result.sampledAfterRestore).toBe(true);
    expect(result.rowAfterRestore).toEqual(row);
  });

test("the sun's map is depth only in the game, and first person draws only casters it can see", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere);
  await page.locator("#start").click();
  await page.waitForFunction(() => !window.__willowmere.getStreaming().pending, null, {
    timeout: 120000,
  });
  await page.locator("#camera-toggle").click();
  await page.locator("#view-toggle").click();
  const frames = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const draws = [];
          const frame = () => {
            draws.push(window.__willowmere.getDiagnostics().drawCalls);
            if (draws.length < 30) requestAnimationFrame(frame);
            else resolve(draws.sort((a, b) => a - b)[15]);
          };
          requestAnimationFrame(frame);
        }),
    );
  await page.waitForTimeout(500);
  // From the green, drawing every caster in the sun's box took about 500.
  expect(await frames()).toBeLessThan(400);
  expect((await page.evaluate(() => window.__willowmere.getDiagnostics().shadow)).depthOnly).toBe(true);
});
