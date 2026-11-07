import { test, expect } from "@playwright/test";

// Phones in both orientations, including a landscape browser with its toolbars showing.
const PHONES = [
  { width: 360, height: 640 },
  { width: 393, height: 660 },
  { width: 731, height: 316 },
  { width: 844, height: 390 },
];
const PANELS = [".day-card", ".top-actions", ".bottom-left", ".quest-card", ".view-controls", ".toolbar", "#interaction", ".thumbstick"];

test.use({ hasTouch: true, isMobile: true, viewport: PHONES[2] });

async function start(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  await page.locator("#start").tap();
  // Starting zooms in to the default height, in one frame when motion is
  // reduced; taps aimed by projecting a point need the view to be there.
  await page.waitForFunction(() => window.__willowmere.getDiagnostics().camera.viewHeight === 18);
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
    await expect(page.locator("html")).toHaveClass(/touch/);
    await expect(page.locator(".quest-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#quest-list")).toBeHidden();
    await expect(page.locator(".thumbstick")).toBeHidden();
    expect(await clashes(page), `${size.width}x${size.height} village view`).toEqual([]);
    await page.locator(".quest-toggle").tap();
    await expect(page.locator("#quest-list")).toBeVisible();
    expect(await clashes(page), `${size.width}x${size.height} quest open`).toEqual([]);
    await page.locator(".quest-toggle").tap();
    await page.locator("#view-toggle").tap();
    await expect(page.locator(".thumbstick")).toBeVisible();
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

// Fingers on the screen through the DevTools protocol, which, unlike
// page.touchscreen, can put down more than one at a time.
async function fingers(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })),
    });
  return {
    /** Moves fingers from `from` to `to` (lists of [x, y]) in `steps`, then lifts them unless `hold`. */
    async drag(from, to, { steps = 8, hold = false } = {}) {
      await send("touchStart", from);
      for (let i = 1; i <= steps; i++)
        await send(
          "touchMove",
          from.map(([x, y], f) => [x + ((to[f][0] - x) * i) / steps, y + ((to[f][1] - y) * i) / steps]),
        );
      if (!hold) await send("touchEnd", []);
    },
    lift: () => send("touchEnd", []),
  };
}
const view = (page) => page.evaluate(() => window.__willowmere.getDiagnostics().camera);

test("touch gestures move the village view: drag pans, pinch zooms, twist turns, two fingers tilt", async ({ page }) => {
  await start(page);
  const { width, height } = page.viewportSize(),
    cx = width / 2,
    cy = height / 2;
  const touch = await fingers(page);
  // The camera panel gives way to gestures.
  await expect(page.locator(".zoom-controls")).toBeHidden();
  await expect(page.locator("#camera-more")).toBeHidden();
  await expect(page.locator("#view-reset")).toBeHidden();

  // The map follows a dragging finger: right and down moves the view left and up.
  const standing = await page.evaluate(() => window.__willowmere.getPlayer());
  await touch.drag([[cx, cy]], [[cx + 60, cy + 40]]);
  let camera = await view(page);
  expect(camera.targetPan[0]).toBeLessThan(-0.5);
  expect(camera.targetPan[1]).toBeLessThan(-0.5);
  expect(camera.targetViewHeight).toBe(18);
  // A drag is not a tap: the player stays put.
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__willowmere.getPlayer())).toEqual(standing);
  await expect(page.locator("#view-reset")).toBeVisible();

  // Spreading two fingers to 1.5 times apart zooms in by as much, without turning.
  await touch.drag([[cx - 40, cy], [cx + 40, cy]], [[cx - 60, cy], [cx + 60, cy]]);
  camera = await view(page);
  expect(camera.targetViewHeight).toBeCloseTo(12, 0);
  expect(camera.targetYaw).toBe(0);

  // Twisting clockwise turns the view.
  const a = (40 * Math.PI) / 180;
  await touch.drag(
    [[cx - 60, cy], [cx + 60, cy]],
    [[cx - 60 * Math.cos(a), cy - 60 * Math.sin(a)], [cx + 60 * Math.cos(a), cy + 60 * Math.sin(a)]],
  );
  camera = await view(page);
  expect(camera.targetYaw).toBeGreaterThan(15);
  expect(camera.targetYaw).toBeLessThan(45);

  // Two fingers sliding up together tilt the view toward the ground, and only tilt it.
  const zoomed = camera.targetViewHeight;
  await touch.drag([[cx - 50, cy], [cx + 50, cy]], [[cx - 50, cy - 80], [cx + 50, cy - 80]]);
  camera = await view(page);
  expect(camera.targetTilt).toBeLessThan(30);
  expect(camera.targetViewHeight).toBe(zoomed);

  // One button puts it all back.
  await page.locator("#view-reset").tap();
  camera = await view(page);
  expect(camera.targetViewHeight).toBe(18);
  expect(camera.targetYaw).toBe(0);
  expect(camera.targetPan).toEqual([0, 0]);
  await expect(page.locator("#view-reset")).toBeHidden();
});

test("in first person a thumbstick walks and a drag elsewhere looks around", async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__willowmere.moveTo(-2.8, 6.2));
  await page.locator("#view-toggle").tap();
  const { width, height } = page.viewportSize();
  const stick = page.locator(".thumbstick");
  await expect(stick).toBeVisible();
  const touch = await fingers(page);
  const before = await page.evaluate(() => ({ ...window.__willowmere.getPlayer(), yaw: window.__willowmere.getView().yaw }));
  // The left thumb lands low on the left and leans forward to the rim, and holds.
  const sx = 90,
    sy = height - 120;
  await touch.drag([[sx, sy]], [[sx, sy - 70]], { hold: true });
  await expect(stick).toHaveClass(/held/);
  await page.waitForTimeout(800);
  // A second finger on the right turns the head while the thumb keeps walking.
  await touch.drag([[sx, sy - 70], [width - 80, height / 2]], [[sx, sy - 70], [width - 180, height / 2]], { hold: true });
  await touch.lift();
  await expect(stick).not.toHaveClass(/held/);
  const after = await page.evaluate(() => ({ ...window.__willowmere.getPlayer(), yaw: window.__willowmere.getView().yaw }));
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(1);
  // Dragging left turns to the left, as a mouse drag does.
  expect(after.yaw).toBeGreaterThan(before.yaw + 0.2);
  await page.locator("#view-toggle").tap();
});

test("touch mode is for touch screens; ?touch=0 keeps the mouse controls", async ({ browser }) => {
  // This file's test.use makes contexts touch phones; a desktop says otherwise.
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });
  const page = await desktop.newPage();
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  await expect(page.locator("html")).not.toHaveClass(/touch/);
  await expect(page.locator("#intro .desktop-only")).toBeVisible();
  await expect(page.locator("#intro .touch-only")).toBeHidden();
  await desktop.close();

  const tablet = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const ipad = await tablet.newPage();
  await ipad.goto("/?touch=0");
  await ipad.waitForFunction(() => window.__willowmere);
  await expect(ipad.locator("html")).not.toHaveClass(/touch/);
  await ipad.goto("/");
  await ipad.waitForFunction(() => window.__willowmere);
  await expect(ipad.locator("html")).toHaveClass(/touch/);
  await expect(ipad.locator("#controls-mode")).toHaveValue("auto");
  await tablet.close();
});
