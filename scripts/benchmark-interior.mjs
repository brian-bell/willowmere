import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

// Measures the bakery interior against a running dev or preview server.
// Usage: node scripts/benchmark-interior.mjs <label> [--ablate]
const url = process.env.BENCHMARK_URL || "http://127.0.0.1:5173";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const label = process.argv[2] || "latest";
const ablate = process.argv.includes("--ablate");
if (!/^[a-zA-Z0-9_-]+$/.test(label))
  throw Error("Use a simple filename for the report label.");
const scales = (process.env.BENCHMARK_SCALES || "1,2").split(",").map(Number);
const rounds = Number(process.env.BENCHMARK_ROUNDS || 4);
// Ablations on high: undo one optimization, or change or remove one feature.
const ablations = {
  "full-res 16-sample AO": { aoScale: 1, aoSamples: 16 },
  "MSAA 2": { samples: 2 },
  "sun shadow 4096": { sunShadow: 4096 },
  "shadows every frame": { shadowRefresh: 0 },
  "pixel ratio 1": { pixelRatio: 1 },
  "no AO": { ao: false },
  "no bloom": { bloom: false },
  "no MSAA": { samples: 0 },
};
const configs = [];
for (const quality of ["high", "balanced", "performance"])
  configs.push({ name: quality, quality, tune: {} });
if (ablate)
  for (const [name, tune] of Object.entries(ablations))
    configs.push({ name: `high, ${name}`, quality: "high", tune });

// Uncapped frames expose throughput; vsync would hide anything under 16.7 ms.
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || (existsSync(chrome) ? chrome : undefined),
  args: ["--disable-frame-rate-limit", "--disable-gpu-vsync"],
});
const report = { url, browser: browser.version(), label, scales: {} };
try {
  for (const deviceScaleFactor of scales) {
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
          const interior = window.__willowmere?.getInterior();
          if (interior?.active && window.__benchmarkRecording)
            window.__benchmarkSamples.push({
              now,
              cpuMs: performance.now() - start,
              drawCalls: interior.drawCalls,
              triangles: interior.triangles,
            });
        });
    });
    await page.goto(`${url}/?interior=bakery&resolution=fixed`);
    await page.waitForFunction(
      () => window.__willowmere?.getInterior().active,
      null,
      { timeout: 30000 },
    );
    await page.waitForTimeout(2500);
    const gpuName = await page.evaluate(() => {
      const gl = document.querySelector("canvas").getContext("webgl2");
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
    });
    const raw = {};
    // Interleave rounds so drift from thermals or other GPU work spreads across configs.
    for (let round = 0; round < rounds; round++)
      for (const { name, quality, tune } of configs) {
        if (
          name.includes("pixel ratio") &&
          tune.pixelRatio >= deviceScaleFactor
        )
          continue;
        const render = await page.evaluate(
          ({ quality, tune }) => {
            const select = document.querySelector("#quality");
            select.value = quality;
            select.dispatchEvent(new Event("change"));
            // Revisions before the tuning hook can still run the presets.
            if (!window.__willowmere.tuneInterior) return {};
            return window.__willowmere.tuneInterior({
              ao: null,
              bloom: null,
              samples: null,
              sunShadow: null,
              pixelRatio: null,
              windowShadow: null,
              aoScale: null,
              aoSamples: null,
              shadowRefresh: null,
              ...tune,
              // Like the old cap, never exceed the canvas's own pixel ratio.
              pixelRatio:
                tune.pixelRatio &&
                Math.min(
                  tune.pixelRatio,
                  document.querySelector("canvas").width / innerWidth,
                ),
            });
          },
          { quality, tune },
        );
        await page.waitForTimeout(800);
        await page.evaluate(() => {
          window.__benchmarkSamples = [];
          window.__benchmarkRecording = true;
        });
        await page.waitForTimeout(2000);
        const samples = await page.evaluate(() => {
          window.__benchmarkRecording = false;
          return window.__benchmarkSamples;
        });
        raw[name] ??= { render, samples: [], frameMs: [] };
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
    for (const [name, { render, samples, frameMs }] of Object.entries(raw))
      results[name] = {
        render,
        frames: samples.length,
        frameMs: summary(frameMs),
        cpuMs: summary(samples.map((s) => s.cpuMs)),
        drawCalls: Math.round(summary(samples.map((s) => s.drawCalls)).mean),
        triangles: Math.round(summary(samples.map((s) => s.triangles)).mean),
      };
    report.scales[deviceScaleFactor] = { gpu: gpuName, results, errors };
    await page.close();
    console.log(`\nDevice scale ${deviceScaleFactor} (${gpuName})`);
    console.table(
      Object.entries(results).map(([name, r]) => ({
        config: name,
        target: r.render.width ? `${r.render.width}×${r.render.height}` : "?",
        fps: (1000 / r.frameMs.mean).toFixed(1),
        "frame mean (ms)": r.frameMs.mean.toFixed(2),
        "frame p95 (ms)": r.frameMs.p95.toFixed(2),
        "CPU mean (ms)": r.cpuMs.mean.toFixed(2),
        draws: r.drawCalls,
        triangles: r.triangles,
      })),
    );
    if (errors.length) throw Error(errors.join("\n"));
  }
  mkdirSync("output", { recursive: true });
  const path = `output/interior-${label}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`Saved ${path}`);
} finally {
  await browser.close();
}
