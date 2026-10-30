# Rendering performance

The village keeps its detailed geometry and animations while reducing the work submitted for each view.

- Character parts with the same roughness and shadow settings are baked together within each rigid joint. Colors become vertex colors. The detailed inhabitants and wildlife use 151 meshes and about 64,000 triangles. Arms, legs, ears, paws, tails, scarf, and leash anchors retain their original transforms.
- Wildflower and planted bouquets share three baked geometries and materials. Each bouquet needs three draws instead of 35, plus a shared halo for gatherable flowers. Planting does not allocate another set of petal geometry.
- Each tree retains separate bark, detail, leaf, and litter bounds. Materials, leaf geometry, textures, and wind uniforms are shared. Offscreen trees can be rejected independently in the main camera, shadows, and water reflections.
- Orthographic water reflections crop the mirrored camera to the pool's projected bounds, with a margin for displaced waves and normal distortion. Capture textures follow the visible footprint, rounded to 64-pixel increments and capped by the chosen quality. The reflection matrix and distortion scale preserve texture projection. Perspective study views retain the full mirrored view.
- The village and bakery update scene transforms once before their rendering passes. The water system respects manually updated scenes and temporarily suppresses repeated automatic updates during its own captures. The bakery's ambient occlusion pass reuses the shadows produced by its color pass.
- The sun's shadow map covers only the receivers the overview can see. See [Outdoor shadows](#outdoor-shadows).
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

## Outdoor shadows

One sun casts the village's shadows. Its direction never changes, so `fitShadow()` in `src/main.js` reshapes only its orthographic shadow camera:

- **Fit to the view.** Each frame traces the overview camera's four corner rays from the soil rim (y −1.4) up to the tallest canopy (y 9.5). It projects those eight points into light space and adds a one-unit margin. Light-space x follows the screen's right edge for the current yaw step, so the visible footprint fills the map instead of a rotated box. The roll changes once per yaw click, not during the rotation animation.
- **Stable edges.** Each axis takes one of 11 sizes, from 0.32 of the village's light-space extent to all of it, about 12% apart. It grows immediately and shrinks only when the view is 4% inside the next smaller size. The start of each axis snaps to whole texels. Following the player and panning therefore move the map by whole texels without changing its size, and edges do not shimmer. Shadows update every frame; updating on alternate frames was measured earlier to raise p95 frame time.
- **Map sizes.** The overview uses 2048 (high), 1536 (balanced), and 1024 (performance). First person sees across the whole village up close, so it keeps the earlier 4096, 2048, and 1024 over the whole village. With 2048 over the fitted view, a bench's shadow at eye level was visibly blurrier than the 4096 baseline. Switching views reallocates the map once. `PCFSoftShadowMap` ignores `shadow.radius` for directional lights, so the unused setting was removed.
- **Casters.** Ground slabs, roads, and the riverbed only receive shadows. Three.js renders the back faces of front-sided materials into shadow maps, so the slabs' undersides filled the entire map every frame. Roads and the 47,040-triangle riverbed face the sun and were culled after vertex work. The static bake now groups meshes by material and shadow flags instead of forcing every batch to cast. Grass blades, pebbles, and stepping stones already did not cast.

Texel size in world centimetres (light-space x × y). Before, the map was 4096 over a fixed 70 × 64 box: 1.7 × 1.6 at every zoom.

| View                            | Shadow area (world units) | Texel (cm) |
| ------------------------------- | ------------------------- | ---------- |
| Overview zoomed in (height 10)  | 26 × 35                   | 1.3 × 1.7  |
| Overview default (height 18)    | 41 × 50                   | 2.0 × 2.4  |
| Overview zoomed out (height 39) | 58 × 62                   | 2.9 × 3.0  |
| First person                    | 58 × 62                   | 1.4 × 1.5  |

Screenshots at 1600 × 1000 compared cottage eaves, fence pickets, dappled tree shadows on the lawn, characters, the bridge and riverbanks, yaw 135°, and tilt 75°. The views were taken in the golden afternoon and blue hour, at default, zoomed-in, and zoomed-out heights, and in first person. They match the 4096 baseline. At 2.5× magnification the default view's fence shadows are marginally softer.

Measured on an Apple M5 in headless Chrome at device scale factor 2, high quality, with `--disable-frame-rate-limit --disable-gpu-vsync`. Each page alternated 0.9-second windows with the shadow map updating and frozen, 10 times each, so the difference isolates the shadow pass from drift between runs. Four rounds per revision:

| Revision          | Shadow pass cost per frame, ms (rounds)  | Mean |
| ----------------- | ---------------------------------------- | ---- |
| Before (`1a2624c`) | 1.47, 1.88, 1.62, 1.98                   | 1.74 |
| After             | 0.56, 1.30, 0.93, 1.28                   | 1.02 |

Whole-frame benchmarks could not resolve this difference. Over three interleaved runs per revision at device scale factor 2, uncapped, mean frame time varied by up to 9 ms between runs of the same revision. Median frame p95 was 85.0 → 85.2 ms (high), 44.4 → 43.9 ms (balanced), and 30.2 → 30.8 ms (performance). The stock `npm run benchmark` at device pixel ratio 1 ran at the 30 FPS cap for both revisions. It showed 3.86M → 3.77M submitted triangles and 1,267 → 1,262 draw calls at high quality. WebGL timer queries around the shadow pass reported about 10 ms on this GPU because Apple's tile-based renderer overlaps passes. They are not usable for this measurement.

Further caster trimming has little left to gain:

- Shrub leaves (182,250 triangles) must cast. Without them, bushes lose their contact shadow and self-shading and look pasted onto the lawn.
- Shrub blossoms and stems (41,400 triangles) changed only 64 pixels in a zoomed view when they stopped casting.
- Disabling all tree-leaf or all shrub casters changed frame time by less than run-to-run noise.

### Static shadow cache: investigated, not implemented

A cache would render static casters once and composite moving casters (characters, cats, wind-blown leaves and reeds, the mill wheel, planted flowers) each frame. In Three.js r180 this needs three things:

- A second render target for the static map.
- A full-screen copy that restores both the packed RGBA depth and the depth buffer (`gl_FragDepth` from the unpacked value).
- A shadow pass for the moving casters without the clear that `WebGLShadowMap.render()` always performs. That means suppressing `renderer.clear()` around the call, plus toggling `castShadow` on the static meshes every frame.

It does not pay off here:

- The fitted frustum moves whenever the overview follows the player, which invalidates the cache. Re-rendering it on those frames would bring back the uneven per-frame workload that alternate-frame updates caused.
- Only about 513,000 of 1,058,000 caster triangles are static (baked buildings, shrubs, tree bark, rocks). The 422,000 triangles of wind-animated tree leaves must render every frame.
- The whole shadow pass now costs about 1 ms. A cache could save at most part of that, minus the full-map copy.

A fixed whole-village frustum would keep a cache valid but would give up the fitted texel density above.

The shadow fit is approximate in one place. Water reflections can show casters just beyond the screen's top edge. Beyond the one-unit margin, their reflected surfaces have no sun shadow.

## Regression budgets

`tests/performance.spec.js` checks preserved character geometry and animated joints, shared flower resources, independent plant growth, and draw/geometry budgets for a village with 30 planted bouquets. Tree tests check independent culling and shared wind materials. Water tests cover small fountain capture allocations and restoration of both automatic and manual scene-transform policies.

`tests/shadows.spec.js` checks that the sun's shadow bounds keep their size and move in whole texels while the player walks, shrink when zoomed in, grow when zoomed out, and switch to the finer first-person map and back.

These tests assert rendering work and behavior instead of a machine-dependent FPS threshold. The village diagnostics expose `drawCalls`, `triangles`, `geometries`, `textures`, and `shadow` (`mapSize` and light-space `bounds`); water diagnostics include each pool's `reflectionSize`.
