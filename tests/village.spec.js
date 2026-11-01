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
  // Clicking a neighbor or wildflower walks over and interacts on arrival, so a
  // walk to one ends `near` metres short, clicking far enough from it on screen
  // that the click walks rather than picks, and the test presses E itself.
  async function walk(x, z, near = 0.5) {
    for (let segment = 0; segment < 20; segment++) {
      const data = await page.evaluate(
        ([x, z, near]) => {
          const game = window.__willowmere,
            p = game.getPlayer();
          if (Math.hypot(p.x - x, p.z - z) < near) return { done: true };
          const path = game.findPath(p, { x, z });
          if (!path.length) return { error: "No route", p };
          // Follow the route up to five points ahead; a walk to a neighbor or
          // flower clicks no closer to it than `near` (minus a margin).
          const route = [p, ...path.slice(0, Math.min(path.length, 6))],
            gap = (q) => Math.hypot(q.x - x, q.z - z),
            reach = near > 0.5 ? near * 0.9 : 0;
          let next = route.at(-1);
          for (let k = route.length - 1; k > 0 && gap(next) < reach; k--) {
            const a = route[k - 1],
              b = route[k];
            if (gap(a) < reach) {
              next = a;
              continue;
            }
            // Bisect the leg a→b for the point `reach` from the goal.
            let lo = 0,
              hi = 1;
            for (let n = 0; n < 20; n++) {
              const t = (lo + hi) / 2,
                q = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
              if (gap(q) >= reach) lo = t;
              else hi = t;
            }
            next = { x: a.x + (b.x - a.x) * lo, z: a.z + (b.z - a.z) * lo };
            break;
          }
          return { target: next, point: game.project(next.x, next.z) };
        },
        [x, z, near],
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
  await walk(-5, 1, 1.2);
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
    await walk(x, z, 1.5);
    await page.waitForTimeout(300);
    await page.keyboard.press("e");
    await page.waitForTimeout(200);
  }
  assert(
    (await page.evaluate(() => window.__willowmere.getState())).flowers >= 3,
    "Gathering three wildflowers updates inventory",
  );
  await walk(-1, 5.6);
  await page.waitForTimeout(300);
  assert(
    (await page.locator("#interaction span").textContent()) ===
      "Wishing Fountain",
    "Fountain offers an interaction",
  );
  await page.keyboard.press("e");
  await page.waitForTimeout(200);
  assert(
    (await page.locator("#speaker").textContent()) === "WISHING FOUNTAIN" &&
      (await page.locator("#dialogue-text").textContent()).length > 0 &&
      (await page.locator("#dialogue-next").textContent()).includes("Lovely"),
    "Fountain answers with a single line",
  );
  await page.keyboard.press("e");
  await page.waitForTimeout(200);
  assert(
    await page.locator("#dialogue").isHidden(),
    "One more press ends the fountain interaction",
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
