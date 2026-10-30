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
// Settings before the interior optimization, and each change reverted alone.
const legacy = (quality) => ({
  aoScale: 1,
  aoSamples: 16,
  samples: 4,
  sunShadow: { high: 4096, balanced: 2048, performance: 1024 }[quality],
  shadowRefresh: 0,
  pixelRatio: 1.5,
});
const ablations = {
  "full-res 16-sample AO": { aoScale: 1, aoSamples: 16 },
  "MSAA 4": { samples: 4 },
  "sun shadow 4096": { sunShadow: 4096 },
  "shadows every frame": { shadowRefresh: 0 },
  "pixel ratio 1.5": { pixelRatio: 1.5 },
  "no AO": { ao: false },
  "no bloom": { bloom: false },
  "no MSAA": { samples: 0 },
};
const configs = [];
for (const quality of ["high", "balanced", "performance"])
  configs.push(
    { name: quality, quality, tune: {} },
    { name: `${quality}, legacy`, quality, tune: legacy(quality) },
  );
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
      const pending = [];
      let gl, timer;
      window.__benchmarkSamples = [];
      window.__benchmarkGpu = [];
      window.requestAnimationFrame = (callback) =>
        requestFrame.call(window, (now) => {
          const interior = window.__willowmere?.getInterior();
          const recording = interior?.active && window.__benchmarkRecording;
          gl ??= document.querySelector("canvas")?.getContext("webgl2");
          timer ??= gl?.getExtension("EXT_disjoint_timer_query_webgl2");
          // GPU elapsed time for the whole frame, independent of CPU contention.
          let query;
          if (recording && timer) {
            query = gl.createQuery();
            gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
          }
          const start = performance.now();
          callback(now);
          const cpuMs = performance.now() - start;
          if (query) {
            gl.endQuery(timer.TIME_ELAPSED_EXT);
            pending.push(query);
          }
          while (
            pending.length &&
            gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)
          ) {
            const done = pending.shift();
            if (!gl.getParameter(timer.GPU_DISJOINT_EXT))
              window.__benchmarkGpu.push(
                gl.getQueryParameter(done, gl.QUERY_RESULT) / 1e6,
              );
            gl.deleteQuery(done);
          }
          if (recording)
            window.__benchmarkSamples.push({
              now,
              cpuMs,
              drawCalls: interior.drawCalls,
              triangles: interior.triangles,
            });
        });
    });
    await page.goto(`${url}/?interior=bakery`);
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
          (name.includes("legacy") && !ablate) ||
          (name.includes("pixel ratio") && tune.pixelRatio > deviceScaleFactor)
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
          window.__benchmarkGpu = [];
          window.__benchmarkRecording = true;
        });
        await page.waitForTimeout(2000);
        const { samples, gpu } = await page.evaluate(() => {
          window.__benchmarkRecording = false;
          return {
            samples: window.__benchmarkSamples,
            gpu: window.__benchmarkGpu,
          };
        });
        raw[name] ??= { render, samples: [], frameMs: [], gpu: [] };
        raw[name].samples.push(...samples);
        raw[name].frameMs.push(
          ...samples.slice(1).map((s, i) => s.now - samples[i].now),
        );
        raw[name].gpu.push(...gpu);
      }
    const summary = (values) => {
      values.sort((a, b) => a - b);
      return {
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        p10: values[Math.floor(values.length * 0.1)],
        p50: values[Math.floor(values.length * 0.5)],
        p95: values[Math.floor(values.length * 0.95)],
      };
    };
    const results = {};
    for (const [name, { render, samples, frameMs, gpu }] of Object.entries(raw))
      results[name] = {
        render,
        frames: samples.length,
        frameMs: summary(frameMs),
        cpuMs: summary(samples.map((s) => s.cpuMs)),
        gpuMs: summary(gpu),
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
        "GPU p50 (ms)": r.gpuMs.p50.toFixed(2),
        "GPU p10 (ms)": r.gpuMs.p10.toFixed(2),
        "CPU (ms)": r.cpuMs.p50.toFixed(2),
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
