# Rendering performance

The village keeps its detailed geometry and animations while reducing the work submitted for each view.

- Character parts with the same roughness and shadow settings are baked together within each rigid joint. Colors become vertex colors. The detailed inhabitants and wildlife use 151 meshes and about 64,000 triangles. Arms, legs, ears, paws, tails, scarf, and leash anchors retain their original transforms.
- Wildflower and planted bouquets share three baked geometries and materials. Each bouquet needs three draws instead of 35, plus a shared halo for gatherable flowers. Planting does not allocate another set of petal geometry.
- Each tree retains separate bark, detail, leaf, and litter bounds. Materials, leaf geometry, textures, and wind uniforms are shared. Offscreen trees can be rejected independently in the main camera, shadows, and water reflections.
- Tree leaves and shrub pockets are left out of water refraction and reflection captures through `water.excludeFromCaptures()`. They still cast shadows and appear in the main view. The pools do not resolve individual leaves, and the captures barely change. Trunks and branches still reflect.
- Each tree's leaves are ordered so that even-numbered leaves come first. `trees.setDetail()` can draw only that half, using a broader 4-triangle diamond blade with the same fold instead of the 8-triangle detailed blade, so canopy coverage and wind motion stay similar. The village switches every tree to this coarse level above an orthographic view height of 24 (the default is 18). In first person, it switches trees whose canopy center is more than 18 m from the eye. Canopy bounds for player visibility are unchanged, and leaf culling spheres enclose both blades.
- Shrub leaves are single-sided. Each blade turns its upper face away from its crown's center, so the side facing the viewer stays as full as before. Their material casts shadows from both faces. Shrub leaves cost less than 1 ms per frame in total, so they keep their own shadows instead of using proxy volumes, which would darken each crown's interior.
- Orthographic water reflections crop the mirrored camera to the pool's projected bounds, with a margin for displaced waves and normal distortion. Capture textures follow the visible footprint, rounded to 64-pixel increments and capped by the chosen quality. The reflection matrix and distortion scale preserve texture projection. Perspective study views retain the full mirrored view.
- The village and bakery update scene transforms once before their rendering passes. The water system respects manually updated scenes and temporarily suppresses repeated automatic updates during its own captures. The bakery's ambient occlusion pass reuses the shadows produced by its color pass.
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

## Foliage comparison (2026-10-30)

These are sequential headless Chrome runs at 1600 × 1000, with frame-rate limiting and vsync disabled. Before is `1a2624c` and after is this branch. Each sampled frame ends with a one-pixel `readPixels`, so the time covers GPU completion. Values are medians of two runs at high quality. In these runs, frames on unchanged code varied by about ±1 ms.

| View                     | DPR 1 ms before → after | DPR 2 ms before → after | Triangles before → after |
| ------------------------ | ----------------------- | ----------------------- | ------------------------ |
| Default (view height 18) | 37.1 → 32.8             | 59.8 → 55.8             | 3.86M → 3.09M            |
| Zoomed in (10)           | 28.4 → 28.1             | 47.7 → 45.7             | 3.19M → 2.63M            |
| Zoomed out (39)          | 39.8 → 32.8             | 58.6 → 48.3             | 4.45M → 2.86M            |
| First person             | 25.4 → 21.7             | 39.0 → 34.9             | 2.82M → 2.08M            |

Interleaved A/B toggles in a single page measured each change's share at DPR 1, default view. Leaving foliage out of the water captures saved 3.6 ms (5.7 ms at DPR 2). Coarse leaves at maximum zoom-out saved 3.5 ms (4.6 ms at DPR 2). At the default view, the remaining detailed tree leaves cost about 3.5 ms, and all shrub leaves together cost about 0.7 ms. Absolute times include contention from other local GPU work, so compare the differences rather than the totals.

## Regression budgets

`tests/performance.spec.js` checks preserved character geometry and animated joints, shared flower resources, independent plant growth, and draw/geometry budgets for a village with 30 planted bouquets. Tree tests check independent culling, shared wind materials, and that coarse leaf detail halves the drawn leaves without changing canopy bounds. A water test checks that excluded scenery stays out of captures and keeps its visibility. Water tests cover small fountain capture allocations and restoration of both automatic and manual scene-transform policies.

These tests assert rendering work and behavior instead of a machine-dependent FPS threshold. The village diagnostics expose `drawCalls`, `triangles`, `geometries`, and `textures`; water diagnostics include each pool's `reflectionSize`.
