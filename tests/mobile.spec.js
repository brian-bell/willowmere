import { test, expect } from "@playwright/test";

// Phones in both orientations, including a landscape browser with its toolbars showing.
const PHONES = [
  { width: 360, height: 640 },
  { width: 393, height: 660 },
  { width: 731, height: 316 },
  { width: 844, height: 390 },
];
const PANELS = [".day-card", ".top-actions", ".bottom-left", ".quest-card", ".view-controls", ".toolbar", "#interaction", "#touch-controls"];

test.use({ hasTouch: true, isMobile: true, viewport: PHONES[2] });

async function start(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  await page.locator("#start").tap();
}

// Returns pairs of visible HUD panels whose boxes overlap, and panels that leave the screen.
const clashes = (page) =>
  page.evaluate((selectors) => {
    const boxes = selectors
      .map((s) => [s, document.querySelector(s)])
      .filter(([, e]) => e.checkVisibility())
      .map(([s, e]) => [s, e.getBoundingClientRect()]);
    const found = [];
    for (const [s, r] of boxes)
      if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) found.push(`${s} off screen ${[r.left, r.top, r.right, r.bottom].map(Math.round)} in ${innerWidth}x${innerHeight}`);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [sa, a] = boxes[i], [sb, b] = boxes[j];
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1)
          found.push(`${sa} overlaps ${sb}`);
      }
    return found;
  }, PANELS);

test("phone HUD panels stay clear of each other in both views", async ({ browser }) => {
  for (const size of PHONES) {
    // A fresh mobile context per size: resizing an emulated phone keeps its old layout width.
    const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: size });
    const page = await context.newPage();
    await start(page);
    // Show the prompt with a long label, as if standing at the bakery door.
    await page.evaluate(() => {
      const prompt = document.querySelector("#interaction");
      prompt.hidden = false;
      prompt.querySelector("span").textContent = "Enter The Daily Loaf";
    });
    await expect(page.locator(".quest-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#quest-list")).toBeHidden();
    await expect(page.locator("#touch-controls")).toBeHidden();
    expect(await clashes(page), `${size.width}x${size.height} village view`).toEqual([]);
    await page.locator(".quest-toggle").tap();
    await expect(page.locator("#quest-list")).toBeVisible();
    expect(await clashes(page), `${size.width}x${size.height} quest open`).toEqual([]);
    await page.locator(".quest-toggle").tap();
    await page.locator("#view-toggle").tap();
    await expect(page.locator("#touch-controls")).toBeVisible();
    await page.evaluate(() => (document.querySelector("#interaction").hidden = false));
    expect(await clashes(page), `${size.width}x${size.height} first person`).toEqual([]);
    await page.locator("#view-toggle").tap();
    await context.close();
  }
});

test("tapping a neighbor walks over, and the conversation's button is never covered", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  // Mabel stands just west of the fountain; tap where she is drawn.
  const point = await page.evaluate(() => window.__willowmere.project(-5, 1));
  await page.touchscreen.tap(point.x, point.y - 10);
  await expect(page.locator("#dialogue")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#speaker")).toContainText("MABEL");
  const next = page.locator("#dialogue-next");
  const box = await next.boundingBox();
  const topmost = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.id,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(topmost).toBe("dialogue-next");
  await next.tap();
  await expect(page.locator("#dialogue")).toBeHidden();
  expect(await page.evaluate(() => window.__willowmere.getState().quests.mabel)).toBe(true);
  expect(errors).toEqual([]);
});

test("the interaction prompt is a button, and a tap leaves photo mode", async ({ page }) => {
  await start(page);
  // Tap the fountain to walk over and look; then tap the prompt instead of pressing E.
  const fountain = await page.evaluate(() => window.__willowmere.project(-1, 4.6));
  await page.touchscreen.tap(fountain.x, fountain.y);
  const prompt = page.locator("#interaction");
  await expect(prompt).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#dialogue")).toBeVisible({ timeout: 15000 });
  await page.locator("#dialogue-next").tap();
  await expect(page.locator("#dialogue")).toBeHidden();
  await expect(prompt).toContainText("Wishing Fountain");
  await prompt.tap();
  await expect(page.locator("#speaker")).toContainText("WISHING FOUNTAIN");
  await page.locator("#dialogue-next").tap();

  await page.locator("#photo-button").tap();
  await expect(page.locator("#game")).toHaveClass(/photo-mode/);
  await expect(page.locator("#photo-hint")).toContainText("Tap anywhere to return");
  await page.touchscreen.tap(200, 150);
  await expect(page.locator("#game")).not.toHaveClass(/photo-mode/);
  await expect(page.locator(".toolbar")).toBeVisible();
});
