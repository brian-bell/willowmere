# Rendering performance

The village keeps its detailed geometry and animations while reducing the work submitted for each view.

- Character parts with the same roughness and shadow settings are baked together within each rigid joint. Colors become vertex colors. The detailed inhabitants and wildlife use 151 meshes and about 64,000 triangles. Arms, legs, ears, paws, tails, scarf, and leash anchors retain their original transforms.
- Wildflower and planted bouquets share three baked geometries and materials. Each bouquet needs three draws instead of 35, plus a shared halo for gatherable flowers. Planting does not allocate another set of petal geometry.
- Each tree retains separate bark, detail, leaf, and litter bounds. Materials, leaf geometry, textures, and wind uniforms are shared. Offscreen trees can be rejected independently in the main camera, shadows, and water reflections.
- Orthographic water reflections crop the mirrored camera to the pool's projected bounds, with a margin for displaced waves and normal distortion. Capture textures follow the visible footprint, rounded to 64-pixel increments and capped by the chosen quality. The reflection matrix and distortion scale preserve texture projection. Perspective study views retain the full mirrored view.
- The village and bakery update scene transforms once before their rendering passes. The water system respects manually updated scenes and temporarily suppresses repeated automatic updates during its own captures. The bakery's ambient occlusion pass reuses the shadows produced by its color pass.
- Water refraction reuses the main scene pass instead of rendering the scene a second time. Water surfaces draw last among opaque objects; the first one resolves the composer's multisampled color and depth into the refraction texture with a single blit. See [docs/water.md](water.md#refraction-from-the-main-pass).
- The final canvas does not request a second multisampled framebuffer or preserve its drawing buffer. The composer's multisampled scene target still supplies antialiasing. Narrow screens select balanced quality before their first frame.

## Reproduce a benchmark

Start `npm run dev`, then run `npm run benchmark -- label` in another terminal. Set `BENCHMARK_URL` if the server is on another port; for example:

```sh
BENCHMARK_URL=http://127.0.0.1:5174 npm run benchmark -- after
```

The script uses the same Chrome selection as the regression tests (`CHROME_PATH`, installed Chrome on macOS, or Playwright Chromium). It opens a fresh browser at 1600 × 1000 and device pixel ratio 1, enters the village, lets the view settle, and samples four seconds at each quality setting. It reports frame intervals, animation-callback CPU duration, draw calls, and submitted triangles, then saves the measurements in `output/performance-label.json`.

Compare revisions sequentially on the same machine. Stop other test browsers before measuring. FPS depends on GPU load, browser, thermal state, screen size, and view; CPU duration measures the callback and driver submission, not GPU execution time. Draw counts also include water simulation, reflections, refraction, shadows, and postprocessing. Moving cameras and different plants change the work visible to each pass.

## Local comparison (2026-10-29)

Sequential headless Chrome runs at 1600 × 1000, DPR 1, with a fresh save and the camera settled at spawn. The baseline was commit `d52ccce`; the after run used these optimizations. Values are means except the last column.

| Quality     | FPS before → after | CPU ms before → after | Draw calls before → after | Triangles before → after | Frame p95 ms before → after |
| ----------- | ------------------ | --------------------- | ------------------------- | ------------------------ | --------------------------- |
| High        | 26.1 → 30.3        | 37.9 → 7.6            | 2,768 → 1,034             | 3.78M → 2.70M            | 50.1 → 50.0                 |
| Balanced    | 26.2 → 44.1        | 37.9 → 6.9            | 2,753 → 986               | 3.78M → 2.61M            | 50.1 → 50.0                 |
| Performance | 41.5 → 47.7        | 23.1 → 4.6            | 2,367 → 931               | 3.32M → 2.50M            | 49.9 → 33.4                 |

High quality remains limited by rendering on this setup; lower submission cost does not guarantee 60 FPS. Re-run the benchmark on the target device, especially at higher device pixel ratios. The raw local reports are `output/performance-before.json` and `output/performance-after.json` (ignored build artifacts).

## Water refraction from the main pass (2026-10-30)

Before is `1a2624c`; after renders refraction from the main pass. Runs alternated before and after while holding the shared GPU lock, so no other benchmark or test browser was rendering: two pairs at DPR 1 with `npm run benchmark`, and three pairs at DPR 2 with a copy of the script using `deviceScaleFactor: 2` and Chrome's `--disable-frame-rate-limit --disable-gpu-vsync`. Values are medians of the per-run means.

| Quality     | DPR 1 frame ms (FPS)      | DPR 2 uncapped frame ms (FPS) | Draw calls  | Triangles     |
| ----------- | ------------------------- | ----------------------------- | ----------- | ------------- |
| High        | 35.7 → 29.7 (28.0 → 33.7) | 52.5 → 40.4 (19.1 → 24.7)     | 1,268 → 878 | 3.86M → 2.83M |
| Balanced    | 32.2 → 26.3 (31.1 → 38.0) | 32.8 → 26.8 (30.4 → 37.3)     | 1,246 → 844 | 3.85M → 2.76M |
| Performance | 25.9 → 23.4 (38.6 → 42.8) | 20.5 → 16.8 (48.9 → 59.5)     | 1,159 → 767 | 3.57M → 2.51M |

Every paired run favored the after build. DPR 1 frame intervals snap to display refresh multiples, so the uncapped DPR 2 runs show the GPU saving more directly: 12 ms per frame at high quality. Each frame submits about 390 fewer draws and 1.0–1.1M fewer triangles at the spawn view. Performance quality saves the least time because its separate capture was already at half resolution.

## Regression budgets

`tests/performance.spec.js` checks preserved character geometry and animated joints, shared flower resources, independent plant growth, and draw/geometry budgets for a village with 30 planted bouquets. Tree tests check independent culling and shared wind materials. Water tests cover small fountain capture allocations, refraction resolved from the village's main pass, and restoration of both automatic and manual scene-transform policies.

These tests assert rendering work and behavior instead of a machine-dependent FPS threshold. The village diagnostics expose `drawCalls`, `triangles`, `geometries`, and `textures`; water diagnostics include each pool's `reflectionSize`.
