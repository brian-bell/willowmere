import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";

// Finds the longest gaps between animation frames while the game starts,
// zooms out, and walks from the village green west into the open country,
// the same route as tests/streaming.spec.js. For each of the worst frames it
// prints what changed in that frame (shader programs, geometries, textures,
// streamed pieces, view height, position), and any long tasks the browser
// reported, so a hitch can be traced to its cause. Works against revisions
// without streaming too, to tell new hitches from old ones.
// Usage: node scripts/frame-gaps.mjs [runs]
//   BENCHMARK_URL     server (default http://127.0.0.1:5173)
const url = process.env.BENCHMARK_URL || "http://127.0.0.1:5173";
const runs = Number(process.argv[2] || 3);
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || (existsSync(chrome) ? chrome : undefined),
});
for (let run = 1; run <= runs; run++) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript(() => {
    const frames = (window.__frames = []),
      longTasks = (window.__longTasks = []);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        longTasks.push([entry.startTime, entry.duration]);
    }).observe({ type: "longtask", buffered: true });
    const tick = (now) => {
      const game = window.__willowmere;
      let info = null;
      if (game) {
        const d = game.getDiagnostics();
        info = {
          programs: d.programs,
          geometries: d.geometries,
          textures: d.textures,
          height: Math.round(d.camera.viewHeight * 10) / 10,
          x: Math.round(d.position[0] * 10) / 10,
          streamed: game.getStreaming?.().finished ?? null,
        };
      }
      frames.push([now, !!document.querySelector("#loading.loaded"), info]);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto(`${url}/?resolution=fixed`);
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  await page.locator("#start").click();
  for (let i = 0; i < 4; i++) await page.locator("#zoom-out").click();
  await page.waitForTimeout(2500);
  const target = await page.evaluate(() => window.__willowmere.project(-30, 3));
  await page.mouse.click(target.x, target.y);
  // Revisions before the map grew stop at the old edge, x = -21.
  await page
    .waitForFunction(() => window.__willowmere.getPlayer().x < -20.5, null, {
      timeout: 30000,
    })
    .catch(() => {});
  await page.waitForTimeout(1500);
  const report = await page.evaluate(() => {
    const frames = window.__frames,
      first = frames.findIndex(([, loaded]) => loaded) + 2,
      start = frames[first][0],
      gaps = [];
    for (let i = Math.max(first, 1); i < frames.length; i++) {
      const [now, , info] = frames[i],
        before = frames[i - 1][2];
      const changed = {};
      if (info && before)
        for (const key of ["programs", "geometries", "textures", "streamed"])
          if (info[key] !== before[key]) changed[key] = `${before[key]}→${info[key]}`;
      gaps.push({
        at: Math.round(now - start),
        gap: Math.round((now - frames[i - 1][0]) * 10) / 10,
        changed,
        height: info?.height,
        x: info?.x,
      });
    }
    const sorted = [...gaps].sort((a, b) => a.gap - b.gap);
    return {
      frames: gaps.length,
      median: sorted[sorted.length >> 1].gap,
      worst: sorted.slice(-5).reverse(),
      longTasks: window.__longTasks
        .filter(([t]) => t >= start)
        .map(([t, d]) => ({ at: Math.round(t - start), duration: Math.round(d) })),
      // Every frame where something was compiled, uploaded or streamed in.
      events: gaps.filter((g) => Object.keys(g.changed).length),
    };
  });
  console.log(`\nRun ${run}: ${report.frames} frames, median gap ${report.median} ms`);
  console.log("Worst gaps:", JSON.stringify(report.worst, null, 1));
  console.log("Long tasks:", JSON.stringify(report.longTasks));
  console.log("Frames with changes:", JSON.stringify(report.events));
  await page.close();
}
await browser.close();
