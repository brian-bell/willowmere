import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

// Run against a local dev or preview server, with other browser tests stopped.
const url = process.env.BENCHMARK_URL || "http://127.0.0.1:5173";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const label = process.argv[2] || "latest";
if (!/^[a-zA-Z0-9_-]+$/.test(label))
  throw Error("Use a simple filename for the report label.");
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || (existsSync(chrome) ? chrome : undefined),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
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
  await page.goto(url);
  await page.locator("#start").click();
  await page.waitForTimeout(2500);
  const results = {};
  for (const quality of ["high", "balanced", "performance"]) {
    await page.locator("#settings").click();
    await page.locator("#quality").selectOption(quality);
    await page.locator("#settings-dialog .close-modal").click();
    await page.waitForTimeout(1800);
    await page.evaluate(() => {
      window.__benchmarkSamples = [];
      window.__benchmarkRecording = true;
    });
    await page.waitForTimeout(4000);
    results[quality] = await page.evaluate(() => {
      window.__benchmarkRecording = false;
      const samples = window.__benchmarkSamples;
      const summary = (values) => {
        values.sort((a, b) => a - b);
        return {
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          p50: values[Math.floor(values.length * 0.5)],
          p95: values[Math.floor(values.length * 0.95)],
        };
      };
      return {
        frames: samples.length,
        frameMs: summary(
          samples.slice(1).map((s, i) => s.now - samples[i].now),
        ),
        cpuMs: summary(samples.map((s) => s.cpuMs)),
        drawCalls: summary(samples.map((s) => s.drawCalls)),
        triangles: summary(samples.map((s) => s.triangles)),
        geometries: Math.max(...samples.map((s) => s.geometries)),
      };
    });
  }
  mkdirSync("output", { recursive: true });
  const path = `output/performance-${label}.json`;
  writeFileSync(
    path,
    JSON.stringify(
      { url, browser: browser.version(), results, errors },
      null,
      2,
    ),
  );
  console.table(
    Object.entries(results).map(([quality, sample]) => ({
      quality,
      fps: (1000 / sample.frameMs.mean).toFixed(1),
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
