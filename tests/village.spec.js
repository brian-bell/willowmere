import { test } from "@playwright/test";
test("welcome quest, interaction, garden, journal, photo mode and persistence", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  await page.locator("#start").click();
  await page.waitForTimeout(2500);
  const assert = (v, msg) => {
    if (!v) throw Error(msg);
    console.log("PASS: " + msg);
  };
  async function walk(x, z) {
    for (let segment = 0; segment < 20; segment++) {
      const data = await page.evaluate(
        ([x, z]) => {
          const game = window.__willowmere,
            p = game.getPlayer();
          if (Math.hypot(p.x - x, p.z - z) < 0.5) return { done: true };
          const path = game.findPath(p, { x, z });
          if (!path.length) return { error: "No route", p };
          const next = path[Math.min(path.length - 1, 5)];
          return { target: next, point: game.project(next.x, next.z) };
        },
        [x, z],
      );
      if (data.done) return;
      if (data.error) throw Error(JSON.stringify(data));
      await page.mouse.click(data.point.x, data.point.y);
      await page.waitForFunction(
        ([x, z]) => {
          let p = window.__willowmere.getPlayer();
          return Math.hypot(p.x - x, p.z - z) < 0.4;
        },
        [data.target.x, data.target.z],
        { timeout: 15000 },
      );
      await page.waitForTimeout(120);
    }
    throw Error("Too many route segments");
  }
  await walk(-5, 1);
  await page.keyboard.press("e");
  await page.waitForTimeout(200);
  assert(
    await page.locator("#dialogue").isVisible(),
    "Mabel conversation opens",
  );
  assert(
    [
      "Every flower has its own little way of saying hello.",
      "The bluebells by the brook are happiest after rain.",
      "Take your time, dear. Beautiful things are rarely in a hurry.",
    ].includes(await page.locator("#dialogue-text").textContent()),
    "Mabel says one of her phrases",
  );
  await page.locator("#dialogue-next").click();
  assert(
    await page.locator("#dialogue").isHidden(),
    "Resident conversation ends after one phrase",
  );
  await page.waitForTimeout(200);
  assert(
    (await page.evaluate(() => window.__willowmere.getState())).quests.mabel,
    "Greeting completes welcome objective",
  );
  for (const [x, z] of [
    [-4, 7],
    [-9, 2],
    [-2, -3],
  ]) {
    await walk(x, z);
    await page.waitForTimeout(300);
    await page.keyboard.press("e");
    await page.waitForTimeout(200);
  }
  assert(
    (await page.evaluate(() => window.__willowmere.getState())).flowers >= 3,
    "Gathering three wildflowers updates inventory",
  );
  await walk(3, 9);
  await page.keyboard.press("3");
  await page.keyboard.press("e");
  await page.waitForTimeout(300);
  assert(
    (await page.evaluate(() => window.__willowmere.getState())).quests.plant,
    "Planting completes welcome objective",
  );
  await page.keyboard.press("4");
  await page.keyboard.press("e");
  await page.waitForTimeout(300);
  assert(
    (await page.evaluate(() => window.__willowmere.getState())).plants[0]
      .watered,
    "Watering grows planted flowers",
  );
  await page.locator("#journal-button").click();
  assert(await page.locator("#journal").isVisible(), "Journal opens");
  await page.locator("#journal .close-modal").click();
  await page.locator("#settings").click();
  await page.locator("#day-select").selectOption("dusk");
  await page.locator("#settings-dialog .close-modal").click();
  await page.waitForTimeout(2000);
  await page.keyboard.press("p");
  assert(
    await page.locator("#photo-hint").isVisible(),
    "Photo mode hides interface",
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await page.waitForTimeout(2000);
  const state = await page.evaluate(() => window.__willowmere.getState());
  assert(
    state.quests.mabel &&
      state.quests.flower &&
      state.quests.plant &&
      state.plants[0].watered,
    "Quest and garden persist after reload",
  );
  await walk(12, 3);
  assert(
    (await page.evaluate(() => window.__willowmere.getDiagnostics()))
      .position[1] > 0.4,
    "Traveler follows raised bridge deck",
  );
  await walk(16, 3);
  assert(
    (await page.evaluate(() => window.__willowmere.getPlayer())).x > 15,
    "Route crosses river using the bridge",
  );
  assert(errors.length === 0, "No JavaScript runtime errors");
});
