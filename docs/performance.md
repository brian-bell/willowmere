# Rendering performance

The village keeps its detailed geometry and animations while reducing the work submitted for each view.

- Character parts with the same roughness and shadow settings are baked together within each rigid joint. Colors become vertex colors. The detailed inhabitants and wildlife use 151 meshes and about 64,000 triangles. Arms, legs, ears, paws, tails, scarf, and leash anchors retain their original transforms.
- Wildflower and planted bouquets share three baked geometries and materials. Each bouquet needs three draws instead of 35, plus a shared halo for gatherable flowers. Planting does not allocate another set of petal geometry.
- Each tree retains separate bark, detail, leaf, and litter bounds. Materials, leaf geometry, textures, and wind uniforms are shared. Offscreen trees can be rejected independently in the main camera, shadows, and water reflections.
- Orthographic water reflections crop the mirrored camera to the pool's projected bounds, with a margin for displaced waves and normal distortion. Capture textures follow the visible footprint, rounded to 64-pixel increments and capped by the chosen quality. The reflection matrix and distortion scale preserve texture projection. Perspective study views retain the full mirrored view.
- The village and bakery update scene transforms once before their rendering passes. The water system respects manually updated scenes and temporarily suppresses repeated automatic updates during its own captures. The bakery's ambient occlusion pass reuses the shadows produced by its color pass.
- Water refraction reuses the main scene pass instead of rendering the scene a second time. Water surfaces draw last among opaque objects; the first one resolves the composer's multisampled color and depth into the refraction texture with a single blit. See [docs/water.md](water.md#refraction-from-the-main-pass).
- The final canvas does not request a second multisampled framebuffer or preserve its drawing buffer. The composer's multisampled scene target still supplies antialiasing. The starting quality and resolution policy are described below.
- The village scene target keeps 4x MSAA at every quality. Every quality now caps the pixel ratio at 1.25 or below. At ratios of 1 and 1.25, 2x visibly steps roof edges and the fountain rims and breaks roof shingle grooves into dashes. Without MSAA, the grooves dash even at a pixel ratio of 1.75, and FXAA erases them. At a ratio of 1.75, 2x came close to 4x.
- Village bloom (`src/bloom.js`) runs every pass at quarter resolution or below: a thresholded downsample, five blurred levels, and a composite. `BloomOutputPass` adds the result while tone mapping. UnrealBloomPass blended its result back into the full-resolution multisampled scene target and composited at half resolution. The strength, radius, and threshold keep their UnrealBloomPass meaning, including that pass's alpha-weighted blend. On a synthetic HDR frame at 2800 × 1750, the total added light differs by 6%. Around lights 40 pixels and larger, the radial falloff agrees within 15%. A 4-pixel point light gets a slightly softer core. Performance quality still disables bloom. The bakery interior keeps UnrealBloomPass.

## Resolution and default quality

The outdoor view submits the scene about three times per frame: shadows, a water reflection at a limited interval, and the multisampled main pass plus bloom. The main pass also supplies water refraction. Most passes fill the full drawing buffer, so frame time follows pixel count more than JavaScript work, which takes 4–5 ms per frame.

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

## Antialiasing and bloom comparison (2026-10-29)

Headless Chrome at 1600 × 1000 CSS pixels and device pixel ratio 2, launched with `--disable-frame-rate-limit --disable-gpu-vsync`. Runs alternated between `1a2624c` and the bloom change, twice each. These runs predate the 1.25 pixel-ratio cap. The high row also used 2x MSAA at a pixel ratio of 1.75, a change later dropped because no quality reaches that ratio now. The balanced row isolates the bloom change at the 2000 × 1250 buffer that high and balanced now use. Other sessions were rendering on the same GPU, so absolute times are inflated and noisy. The table gives the range of the two mean frame intervals.

| Quality (buffer)          | Frame ms before → after | MSAA before → after |
| ------------------------- | ----------------------- | ------------------- |
| High (2800 × 1750)        | 50.7–57.8 → 34.5–37.3   | 4x → 2x             |
| Balanced (2000 × 1250)    | 29.0–33.8 → 22.3–25.3   | 4x → 4x             |
| Performance (1600 × 1000) | 23.2–24.6 → 29.6–31.0   | 4x → 4x, no bloom   |

Performance quality runs the same passes as before, plus one bloom-texture lookup in the output pass from a 1 × 1 texture. Its slower result is most likely contention, but this run cannot confirm that. The standard DPR 1 benchmark (`npm run benchmark`) was within noise: 39.3/32.0/32.0 FPS before and 36.8/33.0/29.8 after.

Postprocessing alone, on a nearly empty 2800 × 1750 frame, measured with WebGL timer queries. Values are the median and 25th-percentile GPU ms per frame:

| Pipeline                   | Bloom on   | Bloom off |
| -------------------------- | ---------- | --------- |
| UnrealBloomPass, 4x MSAA   | 23.3 (12.4) | 6.0 (3.0) |
| Quarter-res bloom, 4x MSAA | 15.3 (7.7)  | —         |
| Quarter-res bloom, 2x MSAA | 9.0 (2.9)   | 3.8 (1.8) |

Repeat both comparisons on an idle machine before relying on the absolute values.

## Water refraction from the main pass (2026-10-30)

Before is `1a2624c`; after renders refraction from the main pass. Both predate the resolution and bloom changes above, so high quality ran at pixel ratio 1.75. Runs alternated before and after while holding the shared GPU lock, so no other benchmark or test browser was rendering: two pairs at DPR 1 with `npm run benchmark`, and three pairs at DPR 2 with a copy of the script using `deviceScaleFactor: 2` and Chrome's `--disable-frame-rate-limit --disable-gpu-vsync`. Values are medians of the per-run means.

| Quality     | DPR 1 frame ms (FPS)      | DPR 2 uncapped frame ms (FPS) | Draw calls  | Triangles     |
| ----------- | ------------------------- | ----------------------------- | ----------- | ------------- |
| High        | 35.7 → 29.7 (28.0 → 33.7) | 52.5 → 40.4 (19.1 → 24.7)     | 1,268 → 878 | 3.86M → 2.83M |
| Balanced    | 32.2 → 26.3 (31.1 → 38.0) | 32.8 → 26.8 (30.4 → 37.3)     | 1,246 → 844 | 3.85M → 2.76M |
| Performance | 25.9 → 23.4 (38.6 → 42.8) | 20.5 → 16.8 (48.9 → 59.5)     | 1,159 → 767 | 3.57M → 2.51M |

Every paired run favored the after build. DPR 1 frame intervals snap to display refresh multiples, so the uncapped DPR 2 runs show the GPU saving more directly: 12 ms per frame at high quality. Each frame submits about 390 fewer draws and 1.0–1.1M fewer triangles at the spawn view. Performance quality saves the least time because its separate capture was already at half resolution.

## Regression budgets

`tests/performance.spec.js` checks preserved character geometry and animated joints, shared flower resources, independent plant growth, and draw/geometry budgets for a village with 30 planted bouquets. Tree tests check independent culling and shared wind materials. Water tests cover small fountain capture allocations, refraction resolved from the village's main pass, and restoration of both automatic and manual scene-transform policies. `tests/resolution.spec.js` covers the starting quality on 1x and 2x screens, the pixel ratio caps, and the scaler's step down and backoff, using synthetic frame timestamps.

These tests assert rendering work and behavior instead of a machine-dependent FPS threshold. The village diagnostics expose `drawCalls`, `triangles`, `geometries`, and `textures`; water diagnostics include each pool's `reflectionSize`.
