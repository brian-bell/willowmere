import { test, expect } from "@playwright/test";
import { sampleWaterField, waterTimeStep } from "../src/water.js";

function recordErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(m.text());
  });
  return errors;
}

test("channel boundaries, obstacles and basin walls constrain the fluid", () => {
  const river = {
    size: [4.2, 42],
    depth: 0.82,
    flow: 0.44,
    obstacles: [{ x: 0.5, z: 3, radius: 0.25 }],
  };
  expect(sampleWaterField(river, 2.2, 0)[3]).toBe(0);
  expect(sampleWaterField(river, 0.5, 3)[3]).toBe(0);
  expect(sampleWaterField(river, 0, 0)[0]).toBeGreaterThan(
    sampleWaterField(river, 1.95, 0)[0],
  );
  expect(sampleWaterField(river, 0, 0)[2]).toBeGreaterThan(0);
  const basin = { size: [2.64, 2.64], radius: 1.32, hole: 0.285, depth: 0.15 };
  expect(sampleWaterField(basin, 0, 0)[3]).toBe(0);
  expect(sampleWaterField(basin, 1.4, 0)[3]).toBe(0);
  expect(sampleWaterField(basin, 0.7, 0).slice(1)).toEqual([0, 0, 1]);
  for (const [x, z] of [
    [0, 0],
    [0.5, 3],
    [0.75, 3.01],
    [2.09, 20],
  ])
    expect(sampleWaterField(river, x, z).every(Number.isFinite)).toBe(true);
  const coarse = waterTimeStep(river.size, [24, 240], river.depth);
  const fine = waterTimeStep(river.size, [64, 640], river.depth);
  expect(fine).toBeLessThan(coarse);
  expect(
    fine * Math.sqrt(9.81 * river.depth) * Math.hypot(64 / 4.2, 640 / 42),
  ).toBeLessThan(1);
});

test("GPU ripples propagate, dissipate, keep dry cells dry and restore renderer state", async ({
  page,
}) => {
  const errors = recordErrors(page);
  await page.goto("/water-study.html");
  await page.waitForFunction(() => window.__waterStudy);
  await page.locator("#pause").click();
  const result = await page.evaluate(async () => {
    const { probeWater } = await import("/tests/water-probe.js");
    return probeWater();
  });
  expect(result.rest.energy).toBe(0);
  expect(result.accepted && result.dryRejected && result.invalidRejected).toBe(
    true,
  );
  expect(result.impact.maxHeight).toBeGreaterThan(0.005);
  expect(result.propagated.activeCells).toBeGreaterThan(
    result.impact.activeCells * 2,
  );
  expect(result.settled.energy).toBeLessThan(result.impact.energy * 0.15);
  for (const sample of [result.impact, result.propagated, result.settled]) {
    expect(sample.finite).toBe(true);
    expect(sample.dryError).toBe(0);
    expect(sample.maxHeight).toBeLessThan(0.1);
    expect(sample.maxVelocity).toBeLessThan(1.5);
  }
  expect(result.restored).toBe(true);
  expect(errors).toEqual([]);
});

test("every village pool shares the model across quality, lighting and paused motion", async ({
  page,
}) => {
  const errors = recordErrors(page);
  // Refraction targets follow the drawing buffer, so keep its size fixed.
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() =>
    window.__willowmere?.getWater().bodies.every((b) => b.reflectionReady),
  );
  await page.locator("#start").click();
  await page.locator("#settings").click();
  const initial = await page.evaluate(() => window.__willowmere.getWater());
  // The village's pools come first; the millpond's stream in after startup.
  expect(initial.bodies.slice(0, 3).map((b) => b.id)).toEqual([
    "river",
    "fountain-lower",
    "fountain-upper",
  ]);
  for (const body of initial.bodies.slice(3))
    expect(["millpond", "brook-north"]).toContain(body.id);
  expect(initial.simulation).toBe("GPU RGBA16F");
  // Refraction comes from the composer's own scene pass, not a second scene render.
  expect(initial.refractionSource).toBe("main pass");
  for (const body of initial.bodies.filter((b) =>
    b.id.startsWith("fountain"),
  )) {
    expect(Math.max(...body.reflectionSize)).toBeLessThan(512);
    expect(Math.min(...body.reflectionSize)).toBeGreaterThanOrEqual(64);
  }
  await page.locator("#motion").uncheck();
  const frozen = await page.evaluate(() => window.__willowmere.getWater());
  await page.waitForTimeout(350);
  expect((await page.evaluate(() => window.__willowmere.getWater())).time).toBe(
    frozen.time,
  );
  for (const quality of ["performance", "balanced", "high"]) {
    await page.locator("#quality").selectOption(quality);
    // A quality change reallocates every pool, and a pool only captures a
    // reflection while it is in view, so the millpond's stay unready from here.
    await page.waitForFunction((q) => {
      const water = window.__willowmere.getWater();
      return (
        water.quality === q &&
        water.bodies.slice(0, 3).every((b) => b.reflectionReady)
      );
    }, quality);
    const current = await page.evaluate(() => window.__willowmere.getWater());
    expect(current.bodies.length).toBeGreaterThanOrEqual(3);
    expect(current.time).toBe(frozen.time);
    if (quality === "performance")
      expect(current.bodies[0].resolution[0]).toBeLessThan(
        initial.bodies[0].resolution[0],
      );
  }
  await page.locator("#day-select").selectOption("dusk");
  await page.locator("#motion").check();
  await page.waitForFunction(
    (time) => window.__willowmere.getWater().time > time + 0.2,
    frozen.time,
  );
  await page.setViewportSize({ width: 700, height: 950 });
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => window.__willowmere.getWater().refraction),
  ).toEqual([700, 950]);
  expect(
    await page.evaluate(() => window.__willowmere.getWater().refractionSource),
  ).toBe("main pass");
  expect(errors).toEqual([]);
});

test("study renders both camera angles and blue hour with stable live fluid fields", async ({
  page,
}) => {
  const errors = recordErrors(page);
  await page.goto("/water-study.html");
  await page.waitForFunction(
    () => window.__waterStudy?.diagnostics().frame > 8,
  );
  for (const view of ["fountain", "low", "mill", "river"]) {
    await page.locator("#view").selectOption(view);
    await page.locator("#ripple").click();
    await page.waitForTimeout(300);
  }
  await page.locator("#light").selectOption("dusk");
  await page.waitForTimeout(200);
  const samples = await page.evaluate(() =>
    ["river", "fountain-lower", "fountain-upper"].map((id) =>
      window.__waterStudy.inspect(id),
    ),
  );
  for (const sample of samples) {
    expect(sample.finite).toBe(true);
    expect(sample.maxHeight).toBeGreaterThan(0);
    expect(sample.maxHeight).toBeLessThan(0.12);
    expect(sample.dryError).toBe(0);
  }
  await page.screenshot({ path: "output/water-blue-hour.png" });
  expect(errors).toEqual([]);
});

test("water retains its optical model without float color attachments", async ({
  page,
}) => {
  const errors = recordErrors(page);
  await page.addInitScript(() => {
    const getExtension = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function (name) {
      return name === "EXT_color_buffer_float"
        ? null
        : getExtension.call(this, name);
    };
  });
  await page.goto("/water-study.html");
  await page.waitForFunction(
    () => window.__waterStudy?.diagnostics().frame > 5,
  );
  await page.locator("#view").selectOption("fountain");
  await page.locator("#quality").selectOption("performance");
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => window.__waterStudy.diagnostics());
  expect(state.simulation).toBe("analytic fallback");
  expect(state.refractionSource).toBe("scene capture");
  expect(state.steps).toBe(0);
  expect(state.time).toBeGreaterThan(0);
  expect(
    state.bodies
      .filter((b) => b.id.startsWith("fountain"))
      .every((b) => b.reflectionReady),
  ).toBe(true);
  // Three.js reports the deliberately withheld extension once; no rendering errors
  // or other warnings are expected from the analytical fallback.
  expect(
    errors.filter(
      (message) =>
        message !==
        "THREE.WebGLRenderer: EXT_color_buffer_float extension not supported.",
    ),
  ).toEqual([]);
});

test("excluded scenery stays out of captures and keeps its visibility", async ({
  page,
}) => {
  // The probe imports its own Three.js module, which warns about duplicates.
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/water-study.html");
  await page.waitForFunction(() => window.__waterStudy);
  const result = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { createWaterSystem } = await import("/src/water.js");
    const renderer = new T.WebGLRenderer();
    renderer.setSize(64, 64);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(45, 1, 0.1, 20);
    camera.position.set(0, 3, 3);
    camera.lookAt(0, 0, 0);
    const system = createWaterSystem(scene, { quality: "performance" });
    system.addBody({ id: "pool", x: 0, y: 0, z: 0, radius: 1, depth: 0.2 });
    const box = () =>
      new T.Mesh(new T.BoxGeometry(0.3, 0.3, 0.3), new T.MeshBasicMaterial());
    const kept = box(),
      excluded = box(),
      hidden = box();
    kept.position.set(-0.5, 0.5, 0);
    excluded.position.set(0.5, 0.5, 0);
    hidden.visible = false;
    const draws = new Map([
      [kept, 0],
      [excluded, 0],
    ]);
    for (const mesh of [kept, excluded, hidden]) {
      mesh.onBeforeRender = () => draws.set(mesh, (draws.get(mesh) || 0) + 1);
      scene.add(mesh);
    }
    system.excludeFromCaptures(excluded, hidden);
    system.render(renderer, camera, { dt: 1 / 60 });
    const result = {
      captures: system.diagnostics().captures,
      kept: draws.get(kept),
      excluded: draws.get(excluded),
      visible: excluded.visible && !hidden.visible,
    };
    renderer.render(scene, camera);
    result.mainPass = draws.get(excluded);
    system.dispose();
    renderer.dispose();
    return result;
  });
  // Refraction plus a first reflection draw the kept box, never the excluded one.
  expect(result.captures).toBeGreaterThan(0);
  expect(result.kept).toBeGreaterThanOrEqual(2);
  expect(result.excluded).toBe(0);
  expect(result.visible).toBe(true);
  expect(result.mainPass).toBe(1);
  expect(errors).toEqual([]);
});
