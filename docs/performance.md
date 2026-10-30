# Rendering performance

The village keeps its detailed geometry and animations while reducing the work submitted for each view.

- Character parts with the same roughness and shadow settings are baked together within each rigid joint. Colors become vertex colors. The detailed inhabitants and wildlife use 151 meshes and about 64,000 triangles. Arms, legs, ears, paws, tails, scarf, and leash anchors retain their original transforms.
- Wildflower and planted bouquets share three baked geometries and materials. Each bouquet needs three draws instead of 35, plus a shared halo for gatherable flowers. Planting does not allocate another set of petal geometry.
- Each tree retains separate bark, detail, leaf, and litter bounds. Materials, leaf geometry, textures, and wind uniforms are shared. Offscreen trees can be rejected independently in the main camera, shadows, and water reflections.
- Orthographic water reflections crop the mirrored camera to the pool's projected bounds, with a margin for displaced waves and normal distortion. Capture textures follow the visible footprint, rounded to 64-pixel increments and capped by the chosen quality. The reflection matrix and distortion scale preserve texture projection. Perspective study views retain the full mirrored view.
- The village and bakery update scene transforms once before their rendering passes. The water system respects manually updated scenes and temporarily suppresses repeated automatic updates during its own captures. The bakery's ambient occlusion pass reuses the shadows produced by its color pass.
- The final canvas does not request a second multisampled framebuffer or preserve its drawing buffer. The composer's multisampled scene target still supplies antialiasing. The starting quality and resolution policy are described below.

## Resolution and default quality

The outdoor view submits the scene about four times per frame (shadows, water refraction, water reflection, and the multisampled main pass plus bloom). Most passes fill the full drawing buffer, so frame time follows pixel count more than JavaScript work, which takes 4–5 ms per frame.

- **Pixel ratio caps.** High and balanced render at `min(devicePixelRatio, 1.25)`; performance renders at `min(devicePixelRatio, 1)`. High previously used 1.75, which gives a 2800 × 1750 buffer on a 1600 × 1000 retina window. The caps are defined in `QUALITY_PIXEL_RATIO` in `src/main.js`. The bakery's composer takes the renderer's current ratio, capped at 1.5, so the cap applies indoors too.
- **Starting quality.** Screens narrower than 760 CSS pixels, or with more than 2.6 million native pixels (`innerWidth × innerHeight × devicePixelRatio²`), start on balanced. Other screens start on high. Under this rule, retina laptops and 1440p monitors start on balanced. 1x screens up to about 1920 × 1200, and small windows on dense screens, start on high. Changing the setting overrides the default for the session.
- **Dynamic resolution.** `updateResolution` collects outdoor frame intervals in one-second windows. It starts 3 seconds after load and skips the bakery and hidden tabs. A window whose p95 exceeds 20 ms lowers the pixel ratio by 0.125, down to 0.75. Five consecutive windows with a p95 under 18 ms raise it by one step, up to the chosen quality's cap. When a window is slow within 10 seconds of a step up, the required run doubles, up to 60 windows. A single step down is not judged, because vsync can keep frames at 33 ms until the GPU fits within one refresh. If the mean frame time is no better once the floor is reached, the scaler concludes that something other than fill rate sets the pace (for example a 30 Hz cap or a busy CPU). It restores the cap and pauses for 30 seconds, doubling the pause on each later failed descent up to 5 minutes. Changing quality resets the ratio to the new cap.
- **Opting out.** Add `?resolution=fixed` to the URL, or call `window.__willowmere.setAdaptiveResolution(false)`, to keep each quality at its cap. `npm run benchmark` uses the query parameter. `getDiagnostics().resolution` reports `adaptive`, `pixelRatio`, `ceiling`, `floor`, the last window's `p95` and `mean`, `upWindows`, and `drawingBuffer`.

## Reproduce a benchmark

Start `npm run dev`, then run `npm run benchmark -- label` in another terminal. Set `BENCHMARK_URL` if the server is on another port; for example:

```sh
BENCHMARK_URL=http://127.0.0.1:5174 npm run benchmark -- after
```

The script uses the same Chrome selection as the regression tests (`CHROME_PATH`, installed Chrome on macOS, or Playwright Chromium). It opens a fresh browser at 1600 × 1000 and device pixel ratio 1 with `?resolution=fixed`, enters the village, lets the view settle, and samples four seconds at each quality setting. It reports frame intervals, animation-callback CPU duration, draw calls, and submitted triangles, then saves the measurements in `output/performance-label.json`.

Compare revisions sequentially on the same machine. Stop other test browsers before measuring. FPS depends on GPU load, browser, thermal state, screen size, and view; CPU duration measures the callback and driver submission, not GPU execution time. Draw counts also include water simulation, reflections, refraction, shadows, and postprocessing. Moving cameras and different plants change the work visible to each pass.

## Local comparison (2026-10-29)

Sequential headless Chrome runs at 1600 × 1000, DPR 1, with a fresh save and the camera settled at spawn. The baseline was commit `d52ccce`; the after run used these optimizations. Values are means except the last column.

| Quality     | FPS before → after | CPU ms before → after | Draw calls before → after | Triangles before → after | Frame p95 ms before → after |
| ----------- | ------------------ | --------------------- | ------------------------- | ------------------------ | --------------------------- |
| High        | 26.1 → 30.3        | 37.9 → 7.6            | 2,768 → 1,034             | 3.78M → 2.70M            | 50.1 → 50.0                 |
| Balanced    | 26.2 → 44.1        | 37.9 → 6.9            | 2,753 → 986               | 3.78M → 2.61M            | 50.1 → 50.0                 |
| Performance | 41.5 → 47.7        | 23.1 → 4.6            | 2,367 → 931               | 3.32M → 2.50M            | 49.9 → 33.4                 |

High quality remains limited by rendering on this setup; lower submission cost does not guarantee 60 FPS. Re-run the benchmark on the target device, especially at higher device pixel ratios. The raw local reports are `output/performance-before.json` and `output/performance-after.json` (ignored build artifacts).

## Resolution comparison (2026-10-29)

Headless Chrome at 1600 × 1000 CSS pixels and device pixel ratio 2, on an Apple M5. The baseline is commit `1a2624c` (high at pixel ratio 1.75); the after runs use the policy above. Baseline and branch were served side by side and measured alternately. Other test browsers were running on the machine, so absolute values vary between rounds. The figures below come from the two quietest rounds, where CPU time per frame returned to 4–5 ms.

Fixed resolution (`?resolution=fixed`), Chrome launched with `--disable-frame-rate-limit --disable-gpu-vsync`, four seconds per quality:

| Quality     | Drawing buffer before → after | FPS before → after       | Frame p95 ms before → after |
| ----------- | ----------------------------- | ------------------------ | --------------------------- |
| High        | 2800 × 1750 → 2000 × 1250     | 32.5, 32.1 → 44.7, 47.6  | 63.1, 64.0 → 44.3, 50.7     |
| Balanced    | 2000 × 1250 (unchanged)       | 54.8, 54.6 → 52.1, 55.4  | 26.6, 24.5 → 26.6, 33.2     |
| Performance | 1600 × 1000 (unchanged)       | 85.2, 86.5 → 83.8, 86.3  | 26.6, 26.0 → 26.6, 26.6     |

Default settings over 20 seconds with vsync, as a retina laptop would run them: the baseline started on high at 2800 × 1750 and ran 22.9, 30.9 and 31.8 FPS (frame p95 33–67 ms). The branch starts on balanced with dynamic resolution and ran 59.1, 58.4 and 58.3 FPS (frame p95 16.7–16.8 ms). It settled between pixel ratios 0.875 and 1.125 in those runs.

With vsync disabled, headless Chrome paces frames unevenly: even performance quality at 86 FPS has a p95 of 26 ms. The scaler therefore steps to its 0.75 floor in uncapped runs (80 FPS, against 31 FPS for the baseline default). Use `?resolution=fixed` for uncapped measurements.

At device pixel ratio 1, `npm run benchmark` gives the same results before and after (high 55.7 → 57.2 FPS; balanced and performance at the 60 FPS vsync limit), because the caps only differ above a ratio of 1.25. The raw reports are `output/performance-{base,new}-*.json` (ignored build artifacts).

## Regression budgets

`tests/performance.spec.js` checks preserved character geometry and animated joints, shared flower resources, independent plant growth, and draw/geometry budgets for a village with 30 planted bouquets. Tree tests check independent culling and shared wind materials. Water tests cover small fountain capture allocations and restoration of both automatic and manual scene-transform policies. `tests/resolution.spec.js` covers the starting quality on 1x and 2x screens, the pixel ratio caps, and the scaler's step down and backoff, using synthetic frame timestamps.

These tests assert rendering work and behavior instead of a machine-dependent FPS threshold. The village diagnostics expose `drawCalls`, `triangles`, `geometries`, and `textures`; water diagnostics include each pool's `reflectionSize`.
