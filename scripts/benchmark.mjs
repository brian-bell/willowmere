import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

// Measures the village against a running dev or preview server, with other
// browser tests stopped.
// Usage: node scripts/benchmark.mjs <label> [--ablate]
//   BENCHMARK_URL     server (default http://127.0.0.1:5173)
//   BENCHMARK_SCALE   device scale factor (default 1)
//   BENCHMARK_UNCAP=1 launch Chrome without the frame-rate limit and vsync
//   BENCHMARK_ROUNDS  passes over every configuration (default 1)
const url = process.env.BENCHMARK_URL || "http://127.0.0.1:5173";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const label = process.argv[2] || "latest";
const ablate = process.argv.includes("--ablate");
if (!/^[a-zA-Z0-9_-]+$/.test(label))
  throw Error("Use a simple filename for the report label.");
const deviceScaleFactor = Number(process.env.BENCHMARK_SCALE || 1);
const uncapped = process.env.BENCHMARK_UNCAP === "1";
const rounds = Number(process.env.BENCHMARK_ROUNDS || 1);
// Ablations on high at the default view: each removes or freezes one part of
// the frame through window.__willowmere.tune, then the view itself changes.
const ablations = {
  "MSAA off": { samples: 0 },
  "foliage hidden": { foliage: false },
  "coarse leaves": { leafDetail: 1 },
  "pixel ratio 1": { pixelRatio: 1 },
  "water skipped": { water: false },
  "shadow map frozen": { shadowUpdate: false },
  "bloom off": { bloom: false },
  "open country hidden": { fields: false },
  "open-country grass hidden": { fields: "ground" },
  "shadows, water and bloom off": {
    shadowUpdate: false,
    water: false,
    bloom: false,
  },
};
const configs = [];
for (const quality of ["high", "balanced", "performance"])
  configs.push({ name: quality, quality, tune: {}, view: "default" });
// The millpond from its bank, at the default height (phase 3's gate), and the
// orchard hill from beside its bench, at the default height and at eye level
// looking back over the village (phase 4's gate).
configs.push(
  { name: "high, millpond", quality: "high", tune: {}, view: "millpond" },
  { name: "high, orchard", quality: "high", tune: {}, view: "orchard" },
  { name: "high, orchard, first person", quality: "high", tune: {}, view: "orchard-first-person" },
);
if (ablate) {
  for (const [name, tune] of Object.entries(ablations))
    // Forcing a ratio the screen already has measures nothing.
    if (!(tune.pixelRatio >= deviceScaleFactor))
      configs.push({
        name: `high, ${name}`,
        quality: "high",
        tune,
        view: "default",
      });
  for (const view of ["first-person", "zoomed-out"])
    configs.push({
      name: `high, ${view.replace("-", " ")}`,
      quality: "high",
      tune: {},
      view,
    });
  // Height 30 on every revision (the zoom cap since the map grew; four zoom
  // steps from the default), with and without the open country.
  configs.push(
    { name: "high, millpond, height 30", quality: "high", tune: {}, view: "millpond-30" },
    { name: "high, millpond, water skipped", quality: "high", tune: { water: false }, view: "millpond" },
    { name: "high, orchard, height 30", quality: "high", tune: {}, view: "orchard-30" },
    { name: "high, height 30", quality: "high", tune: {}, view: "height-30" },
    {
      name: "high, height 30, open-country grass hidden",
      quality: "high",
      tune: { fields: "ground" },
      view: "height-30",
    },
    {
      name: "high, height 30, open country hidden",
      quality: "high",
      tune: { fields: false },
      view: "height-30",
    },
  );
}

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || (existsSync(chrome) ? chrome : undefined),
  // Uncapped frames expose throughput; vsync would hide anything under 16.7 ms.
  args: uncapped ? ["--disable-frame-rate-limit", "--disable-gpu-vsync"] : [],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame;
    window.__benchmarkSamples = [];
    window.requestAnimationFrame = (callback) =>
      requestFrame.call(window, (now) => {
        const start = performance.now();
        callback(now);
        if (window.__willowmere && window.__benchmarkRecording) {
          window.__benchmarkSamples.push({
            now,
            cpuMs: performance.now() - start,
            ...window.__willowmere.getDiagnostics(),
          });
        }
      });
  });
  // Fixed resolution keeps each quality at its own pixel ratio.
  await page.goto(new URL("/?resolution=fixed", url).href);
  await page.locator("#start").click();
  await page.waitForTimeout(2500);
  const gpu = await page.evaluate(() => {
    const gl = document.querySelector("canvas").getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
  });
  // Where each view stands: the millpond views on its south bank, by the
  // jetty, the orchard views on the hill's path by the bench, facing the
  // village, the rest at the spawn on the village green.
  const MILLPOND = { x: 8.6, z: -25.8 },
    ORCHARD = { x: -21, z: -27.6, heading: 0.65 },
    SPAWN = { x: -2.8, z: 6.2 };
  let at = SPAWN;
  const setView = async (view) => {
    const place = view.startsWith("millpond")
      ? MILLPOND
      : view.startsWith("orchard")
        ? ORCHARD
        : SPAWN;
    // Revisions without the hook stay at the spawn.
    if (place !== at && (await page.evaluate(() => !!window.__willowmere.moveTo))) {
      await page.evaluate(
        ({ x, z, heading }) => window.__willowmere.moveTo(x, z, heading),
        place,
      );
      at = place;
      // Let the overview follow the player there, and the region stream in.
      await page.waitForFunction(() => !window.__willowmere.getStreaming().pending);
      await page.waitForTimeout(3500);
    }
    const mode = () => page.evaluate(() => window.__willowmere.getView().mode);
    const wantFirstPerson = view.endsWith("first-person");
    if (((await mode()) === "first-person") !== wantFirstPerson)
      await page.locator("#view-toggle").click();
    if (wantFirstPerson) return;
    if (view === "zoomed-out")
      while (!(await page.locator("#zoom-out").isDisabled()))
        await page.locator("#zoom-out").click();
    else if (!(await page.locator("#zoom-reset").isDisabled()))
      await page.locator("#zoom-reset").click();
    if (view.endsWith("-30"))
      for (let i = 0; i < 4; i++) await page.locator("#zoom-out").click();
    // The overview eases to its height; sample once it has arrived.
    await page.waitForFunction(
      () => {
        const camera = window.__willowmere.getDiagnostics().camera;
        return Math.abs(camera.viewHeight - camera.targetViewHeight) < 0.01;
      },
      null,
      { timeout: 10000 },
    );
  };
  const raw = {};
  // Interleave rounds so drift from thermals spreads across configurations.
  for (let round = 0; round < rounds; round++)
    for (const { name, quality, tune, view } of configs) {
      await page.locator("#settings").click();
      await page.locator("#quality").selectOption(quality);
      await page.locator("#settings-dialog .close-modal").click();
      // Revisions before the tuning hook can still run the presets.
      const render = await page.evaluate((tune) => {
        if (!window.__willowmere.tune) return null;
        return window.__willowmere.tune({
          shadowUpdate: null,
          water: null,
          bloom: null,
          samples: null,
          pixelRatio: null,
          foliage: null,
          leafDetail: null,
          fields: null,
          ...tune,
        });
      }, tune);
      if (ablate && !render)
        throw Error("This revision has no window.__willowmere.tune.");
      await setView(view);
      await page.waitForTimeout(1800);
      await page.evaluate(() => {
        window.__benchmarkSamples = [];
        window.__benchmarkRecording = true;
      });
      await page.waitForTimeout(4000);
      const samples = await page.evaluate(() => {
        window.__benchmarkRecording = false;
        return window.__benchmarkSamples;
      });
      raw[name] ??= { quality, view, tune, render, samples: [], frameMs: [] };
      raw[name].samples.push(...samples);
      raw[name].frameMs.push(
        ...samples.slice(1).map((s, i) => s.now - samples[i].now),
      );
    }
  const summary = (values) => {
    values.sort((a, b) => a - b);
    return {
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
    };
  };
  const results = {};
  for (const [name, row] of Object.entries(raw))
    results[name] = {
      quality: row.quality,
      view: row.view,
      tune: row.tune,
      render: row.render,
      frames: row.samples.length,
      frameMs: summary(row.frameMs),
      cpuMs: summary(row.samples.map((s) => s.cpuMs)),
      drawCalls: summary(row.samples.map((s) => s.drawCalls)),
      triangles: summary(row.samples.map((s) => s.triangles)),
      geometries: Math.max(...row.samples.map((s) => s.geometries)),
    };
  mkdirSync("output", { recursive: true });
  const path = `output/performance-${label}.json`;
  writeFileSync(
    path,
    JSON.stringify(
      {
        url,
        browser: browser.version(),
        gpu,
        deviceScaleFactor,
        uncapped,
        rounds,
        results,
        errors,
      },
      null,
      2,
    ),
  );
  const pacing = uncapped ? "uncapped" : "vsync";
  console.log(`Device scale ${deviceScaleFactor}, ${pacing} (${gpu})`);
  console.table(
    Object.entries(results).map(([config, sample]) => ({
      config,
      buffer: sample.render
        ? `${sample.render.width}×${sample.render.height}`
        : "?",
      fps: (1000 / sample.frameMs.mean).toFixed(1),
      "frame mean (ms)": sample.frameMs.mean.toFixed(2),
      "frame p95 (ms)": sample.frameMs.p95.toFixed(1),
      "CPU mean (ms)": sample.cpuMs.mean.toFixed(1),
      "draw calls": Math.round(sample.drawCalls.mean),
      triangles: Math.round(sample.triangles.mean),
    })),
  );
  console.log(`Saved ${path}`);
  if (errors.length) throw Error(errors.join("\n"));
} finally {
  await browser.close();
}
