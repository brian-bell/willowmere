import { test, expect } from "@playwright/test";

// The one browser test CI runs: the village boots, draws and starts without
// an error. It suits software WebGL, where a frame can take seconds.
test("the village loads, draws and starts without errors", { tag: "@smoke" }, async ({
  page,
}) => {
  test.setTimeout(300000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/?resolution=fixed");
  await expect(page.locator("#loading")).toHaveClass(/loaded/, { timeout: 240000 });
  const diagnostics = await page.evaluate(() => window.__willowmere.getDiagnostics());
  expect(diagnostics.drawCalls).toBeGreaterThan(100);
  expect(diagnostics.colliders).toBeGreaterThan(50);
  await page.evaluate(() => document.querySelector("#start").click());
  await expect(page.locator("#game")).toHaveClass(/playing/);
  expect(errors).toEqual([]);
});
