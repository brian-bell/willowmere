# Rendering performance

Willowmere is GPU bound. JavaScript, including movement, collision, route finding and character animation, takes about 4 ms per frame; the rest of the frame is rasterization, and it scales with the drawing buffer's pixel count and with how many times the scene is submitted. This document records how each frame is built, where its time goes, how to measure a change, and what to keep in mind when adding scenery, lights or passes. [Water rendering](water.md) covers the water system's own costs.

## Frame anatomy

The outdoor view, in the order `animate()` in `src/main.js` runs it each frame:

1. **Simulation and bookkeeping (JavaScript, about 4 ms).** Input, player collision against `colliders`, `life.update` for residents, cats, puppy, birds and butterflies, `world.update` for the mill, reeds and water bookkeeping, planting growth, dusk blending, `playerVisibility`, `fitShadow`, `trees.setDetail` by zoom or distance, and `updateResolution`. The scene has `matrixWorldAutoUpdate` off, so `scene.updateMatrixWorld()` runs once here and every pass reuses the transforms. Nearby-interactable scanning runs every eighth frame.
2. **Water (`world.water.render`).** The GPU shallow-water simulation steps each visible pool in small ping-pong targets (a few draws). At most one pool whose reflection is overdue re-renders the mirrored scene into a cropped reflection target; tree leaves and shrubs are hidden for that capture. Refraction is not rendered here: the call arms a one-shot resolve for the main pass.
3. **Shadow pass.** The sun's shadow map (2048 on high in the overview, 4096 in first person) is rendered every frame over a frustum fitted to the receivers in view. Ground slabs, roads and the riverbed receive only.
4. **Main pass (`RenderPass`).** The opaque scene draws into a 4x multisampled half-float target. Water surfaces have the highest `renderOrder`; the first one blits the target's color and depth into the refraction texture, then the surfaces and transparent objects draw on top.
5. **Bloom and output.** `SoftBloomPass` runs entirely at quarter resolution or below, and `BloomOutputPass` adds it while tone mapping to the canvas. Nothing touches the multisampled target again at full resolution.

At the default view this is roughly 790 draw calls and 2.3 million submitted triangles per frame on high quality, spread over the shadow, reflection and main passes. First person submits about 400 draws and 1.6 million triangles. The bakery interior has its own chain, described under [Bakery interior](#bakery-interior).

## Where the time goes (2026-10-30)

Measured on the merged `main` at `08aca42` on an Apple M5 in headless Chrome 156, 1600 × 1000 CSS pixels, `?resolution=fixed`, with `--disable-frame-rate-limit --disable-gpu-vsync` so throughput above 60 FPS is visible, and with no other browser or benchmark using the GPU. Each row changes one thing from the high preset at the default spawn view and records three seconds. Values are mean frame intervals in milliseconds; the saving in parentheses is against the baseline row.

| High quality, one change at a time | DPR 2 (2000 × 1250) ms | DPR 1 (1600 × 1000) ms |
| ---------------------------------- | ---------------------- | ---------------------- |
| Baseline                           | 8.8                    | 7.1                    |
| MSAA off (4x → none)               | 6.3 (−2.5)             | 5.4 (−1.7)             |
| Tree leaf instances hidden         | 6.7 (−2.1)             | 5.3 (−1.8)             |
| All instanced meshes hidden        | 6.2 (−2.6)             | 4.9 (−2.2)             |
| Pixel ratio forced to 1            | 7.0 (−1.8)             | same as baseline       |
| Water simulation and reflection skipped | 7.6 (−1.2)        | 6.3 (−0.8)             |
| Shadow map frozen                  | 7.8 (−1.0)             | 6.4 (−0.7)             |
| Bloom off                          | 8.8 (0)                | 7.0 (−0.1)             |
| Shadows, water and bloom all off   | 6.9 (−1.9)             | 5.8 (−1.3)             |
| First-person view                  | 5.4                    | 4.4                    |
| Overview zoomed out (height 39)    | 9.3                    | 8.0                    |

The same method on the previous `main` (`1a2624c`), measured earlier the same day, gave 22.1 ms at DPR 2 (high rendered at pixel ratio 1.75, a 2800 × 1750 buffer) and 12.5 ms at DPR 1. Part of the DPR 2 gain is the pixel-ratio cap; the rest is the single scene submission for refraction, the quarter-resolution bloom, the fitted shadow map and the foliage changes. Balanced measured 8.6 ms and performance 6.5 ms at DPR 2.

With vsync on and dynamic resolution enabled, as a retina laptop runs it, all three presets hold 60 FPS at the default view with a frame p95 of 16.7–16.8 ms, and the animation callback takes 3.8–4.0 ms.

What this table says about the next change:

- **Multisampling is now the largest single GPU cost.** The village keeps 4x because 2x visibly steps roof edges and dashes shingle grooves at pixel ratios of 1 and 1.25 (see the antialiasing notes below). A cheaper edge treatment that preserves those grooves would be worth more than any other single pass.
- **Foliage is next.** The remaining detailed tree leaves are about 2 ms at the default view. The coarse level already applies when zoomed out or far away; a further level for the default view, or fewer leaves per tree, is the remaining lever.
- **The frame is no longer purely fill bound.** JavaScript plus draw submission is about 4–6 ms, against 7–9 ms of total frame time uncapped. From here, GPU-only savings return less, and submission cost (about 790 draws) and per-frame JavaScript matter as much. In the uncapped runs above, the measured callback time tracks the frame interval because the driver blocks on queued GPU work, so JavaScript cost can only be read from vsync-on runs.
- **Bloom, shadows and water are small.** Each is around 1 ms at retina. They have been reduced as far as their current designs allow; the shadow section explains why a static shadow cache does not pay.

Startup is not optimized and has no regression test: from navigation to the loading screen dismissing takes 1.1–1.6 s in headless Chrome on this machine (DOM content loaded at about 0.7 s), spent generating procedural textures, building and baking the village, and uploading about 53,000 leaf instances. The production bundle is about 540 KB of Three.js (139 KB gzipped) plus about 230 KB (85 KB gzipped) of game code split into village, world, interior and water-study chunks.

Not yet measured: mobile GPUs, Windows integrated graphics, Safari and Firefox, and thermal throttling over long sessions. The narrow-screen path starts on balanced and relies on the resolution scaler. Measure on those devices before tightening budgets or changing the presets.

## Measuring

Measure before and after every rendering change, on an idle machine, and compare differences rather than absolute times.

- **Standard benchmark.** Start `npm run dev`, then run `npm run benchmark -- label` in another terminal. Set `BENCHMARK_URL` if the server is on another port, for example `BENCHMARK_URL=http://127.0.0.1:5174 npm run benchmark -- after`. The script uses the same Chrome selection as the regression tests (`CHROME_PATH`, installed Chrome on macOS, or Playwright Chromium). It opens a fresh browser at 1600 × 1000 and device pixel ratio 1 with `?resolution=fixed`, enters the village, lets the view settle, and samples four seconds at each quality setting. It reports frame intervals, animation-callback CPU duration, draw calls, and submitted triangles, then saves the measurements in `output/performance-label.json`.
- **Retina and uncapped runs.** The standard benchmark runs at pixel ratio 1 with vsync, so it saturates at 60 FPS and never exercises the retina caps. For a change that affects fill rate, copy `scripts/benchmark.mjs` to a scratch file, set `deviceScaleFactor: 2`, and launch Chrome with `--disable-frame-rate-limit --disable-gpu-vsync`. Keep `?resolution=fixed`, or the scaler will step down during the run. Headless Chrome paces uncapped frames unevenly, so compare means, not p95.
- **Interior.** `node scripts/benchmark-interior.mjs label --ablate` measures the bakery at both device scales and can undo each optimization in turn through `window.__willowmere.tuneInterior`. See [Measure the interior](#measure-the-interior).
- **Outdoor ablation.** There is no outdoor equivalent of `tuneInterior` yet. The table above was produced with a temporary export of `renderer`, `composer`, `bloom`, `sun`, `scene` and `world` from `src/main.js` onto `window.__willowmere`, toggled from a Playwright script between three-second samples. Adding a permanent `tune()` for the village would make that repeatable.
- **Deterministic counters.** `window.__willowmere.getDiagnostics()` reports `drawCalls`, `triangles`, `geometries`, `textures`, the `resolution` state and the sun's `shadow` bounds. Draw calls and triangles do not depend on machine load, so quote them alongside any timing; they are what the regression tests assert.
- **Contention.** Numbers taken while another browser, test run or benchmark is rendering are inflated and noisy. Several of the dated comparisons under [Change history](#change-history) were taken that way and say so; the table above was not.
- **What does not work here.** WebGL timer queries (`EXT_disjoint_timer_query_webgl2`) return elapsed times longer than the frame because Apple's tile-based GPU overlaps passes, so they cannot isolate a pass. Updating shadows on alternate frames raises p95 frame time through uneven workload. FPS from any single machine does not transfer; re-run on the target device, especially at higher device pixel ratios.

## Checklist for changes

Each item names the mechanism in the code that a new change has to work with.

- **Static scenery.** Add plain meshes under `createWorld`; the bake at the end of `src/world.js` merges them into one draw per material and shadow role, and removes the originals. Animated or later-modified objects must set `userData.dynamic = true` or they are frozen into the bake. Transparent materials and instanced meshes are not merged. Give flat receivers (ground, roads, beds) `castShadow = false`; the bake honors per-mesh flags.
- **Materials.** Reuse shared materials; every distinct material is at least one extra draw per pass. Avoid cloning materials per object. Materials with emissive color are collected into `glowMaterials` at startup for the dusk glow, so new lanterns need no extra code.
- **Dense instanced detail.** Keep `matrixAutoUpdate = false` and tight bounding spheres so each instanced mesh culls as a unit. Register it with `water.excludeFromCaptures()` unless it must appear in reflections. Prefer `FrontSide` with `shadowSide: DoubleSide` for thin blades. If it covers few pixels at the default view, give it a coarse level like `trees.setDetail()`.
- **Lights.** Each shadow-casting light renders the whole scene again every frame. The village has one; the bakery caches its two because they never move. A new shadow caster outdoors needs the same fitting and caching argument as `fitShadow()`, or a measured budget.
- **Post-processing.** Do not add a full-resolution pass that reads or writes the multisampled scene target. Follow `src/bloom.js`: work at quarter resolution and composite in the output pass.
- **Water.** Read [docs/water.md](water.md) first. Each pool adds simulation targets and a reflection capture at the quality's interval; refraction comes from the main pass and costs a blit, not a render.
- **Resolution.** Never call `renderer.setPixelRatio` directly outdoors. Go through `QUALITY_PIXEL_RATIO`, `resetResolution` and the scaler, and keep `?resolution=fixed` working for the benchmark and tests. The bakery applies its quality's cap on entry and restores the scaler's ratio on exit.
- **Per-frame JavaScript.** No allocations, `scene.traverse`, or material changes inside `animate()`. Precompute at build time; throttle scans the way `scanNearby` runs every eighth frame.
- **Verify and record.** Run the standard benchmark and a retina run before and after, quote draw calls and triangles, update the budgets in `tests/performance.spec.js`, `tests/trees.spec.js`, `tests/shadows.spec.js` and `tests/interior.spec.js` only when the new work is intended, and add the result to this document.

## Work reduction in the current build

- Character parts with the same roughness and shadow settings are baked together within each rigid joint. Colors become vertex colors. The detailed inhabitants and wildlife use 151 meshes and about 64,000 triangles. Arms, legs, ears, paws, tails, scarf, and leash anchors retain their original transforms.
- Wildflower and planted bouquets share three baked geometries and materials. Each bouquet needs three draws instead of 35, plus a shared halo for gatherable flowers. Planting does not allocate another set of petal geometry.
- Each tree retains separate bark, detail, leaf, and litter bounds. Materials, leaf geometry, textures, and wind uniforms are shared. Offscreen trees can be rejected independently in the main camera, shadows, and water reflections.
- Tree leaves and shrub pockets are left out of water reflection captures, and out of the separate refraction capture used when the main pass cannot supply refraction, through `water.excludeFromCaptures()`. They still cast shadows and appear in the main view, which also supplies refraction. The pools do not resolve individual leaves, and the reflections barely change. Trunks and branches still reflect.
- Each tree's leaves are ordered so that even-numbered leaves come first. `trees.setDetail()` can draw only that half, using a broader 4-triangle diamond blade with the same fold instead of the 8-triangle detailed blade, so canopy coverage and wind motion stay similar. The village switches every tree to this coarse level above an orthographic view height of 24 (the default is 18). In first person, it switches trees whose canopy center is more than 18 m from the eye. Canopy bounds for player visibility are unchanged, and leaf culling spheres enclose both blades.
- Shrub leaves are single-sided. Each blade turns its upper face away from its crown's center, so the side facing the viewer stays as full as before. Their material casts shadows from both faces. Shrub leaves cost less than 1 ms per frame in total, so they keep their own shadows instead of using proxy volumes, which would darken each crown's interior.
- Orthographic water reflections crop the mirrored camera to the pool's projected bounds, with a margin for displaced waves and normal distortion. Capture textures follow the visible footprint, rounded to 64-pixel increments and capped by the chosen quality. The reflection matrix and distortion scale preserve texture projection. Perspective study views retain the full mirrored view.
- The village and bakery update scene transforms once before their rendering passes. The water system respects manually updated scenes and temporarily suppresses repeated automatic updates during its own captures. The bakery's costs are described under [Bakery interior](#bakery-interior).
- Water refraction reuses the main scene pass instead of rendering the scene a second time. Water surfaces draw last among opaque objects; the first one resolves the composer's multisampled color and depth into the refraction texture with a single blit. See [docs/water.md](water.md#refraction-from-the-main-pass).
- The sun's shadow map covers only the receivers the overview can see. See [Outdoor shadows](#outdoor-shadows).
- The final canvas does not request a second multisampled framebuffer or preserve its drawing buffer. The composer's multisampled scene target still supplies antialiasing. The starting quality and resolution policy are described under [Resolution and default quality](#resolution-and-default-quality).
- The village scene target keeps 4x MSAA at every quality. Every quality now caps the pixel ratio at 1.25 or below. At ratios of 1 and 1.25, 2x visibly steps roof edges and the fountain rims and breaks roof shingle grooves into dashes. Without MSAA, the grooves dash even at a pixel ratio of 1.75, and FXAA erases them. At a ratio of 1.75, 2x came close to 4x.
- Village bloom (`src/bloom.js`) runs every pass at quarter resolution or below: a thresholded downsample, five blurred levels, and a composite. `BloomOutputPass` adds the result while tone mapping. UnrealBloomPass blended its result back into the full-resolution multisampled scene target and composited at half resolution. The strength, radius, and threshold keep their UnrealBloomPass meaning, including that pass's alpha-weighted blend. On a synthetic HDR frame at 2800 × 1750, the total added light differs by 6%. Around lights 40 pixels and larger, the radial falloff agrees within 15%. A 4-pixel point light gets a slightly softer core. Performance quality still disables bloom. The bakery interior uses the same pass.

## Resolution and default quality

The outdoor view submits the scene about three times per frame: shadows, a water reflection at a limited interval, and the multisampled main pass plus bloom. The main pass also supplies water refraction. Most passes fill the full drawing buffer, so frame time follows pixel count more than JavaScript work, which takes 4–5 ms per frame.

- **Pixel ratio caps.** High and balanced render at `min(devicePixelRatio, 1.25)`; performance renders at `min(devicePixelRatio, 1)`. High previously used 1.75, which gives a 2800 × 1750 buffer on a 1600 × 1000 retina window. The caps are defined in `QUALITY_PIXEL_RATIO` in `src/main.js`. The bakery renders at its quality's cap; see [Bakery interior](#bakery-interior).
- **Starting quality.** Screens narrower than 760 CSS pixels, or with more than 2.6 million native pixels (`innerWidth × innerHeight × devicePixelRatio²`), start on balanced. Other screens start on high. Under this rule, retina laptops and 1440p monitors start on balanced. 1x screens up to about 1920 × 1200, and small windows on dense screens, start on high. Changing the setting overrides the default for the session.
- **Dynamic resolution.** `updateResolution` collects outdoor frame intervals in one-second windows. It starts 3 seconds after load and skips the bakery and hidden tabs. A window whose p95 exceeds 20 ms lowers the pixel ratio by 0.125, down to 0.75. Five consecutive windows with a p95 under 18 ms raise it by one step, up to the chosen quality's cap. When a window is slow within 10 seconds of a step up, the required run doubles, up to 60 windows. A single step down is not judged, because vsync can keep frames at 33 ms until the GPU fits within one refresh. If the mean frame time is no better once the floor is reached, the scaler concludes that something other than fill rate sets the pace (for example a 30 Hz cap or a busy CPU). It restores the cap and pauses for 30 seconds, doubling the pause on each later failed descent up to 5 minutes. Changing quality resets the ratio to the new cap.
- **Opting out.** Add `?resolution=fixed` to the URL, or call `window.__willowmere.setAdaptiveResolution(false)`, to keep each quality at its cap. `npm run benchmark` uses the query parameter. `getDiagnostics().resolution` reports `adaptive`, `pixelRatio`, `ceiling`, `floor`, the last window's `p95` and `mean`, `upWindows`, and `drawingBuffer`.

## Outdoor shadows

The measurements in this section predate the resolution, bloom, refraction, and foliage changes above. They used the baseline `1a2624c` and high quality at pixel ratio 1.75, and the caster counts are from before shrub leaves became single-sided and distant tree leaves became coarse.

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

## Bakery interior

The walkable bakery (`src/bakery.js`, `src/interior.js`) shares the village's renderer and its quality setting. Its static props are merged by material, but one render of the room is still about 135 draws and 600,000 triangles, so each extra scene render is expensive. Before these changes, every frame rendered the room four times: the sun's shadow map, the window light's shadow map, the multisampled color pass, and the normal and depth pass for ambient occlusion. That is 460 draws and 2.30 million triangles per frame. Postprocessing then ran 16-sample SSAO at full resolution and UnrealBloomPass.

- **Cached shadow maps.** The sun and the window spot light never move, and nearly everything they light is static. Their shadow maps have `autoUpdate` off. The interior renders both maps on entry, after any resize or quality change, and when reduced motion is turned on or off. While motion is on, it refreshes one map every 0.125 seconds, alternating, so each map follows the sleeping cat and the star mobile four times a second. Both move slowly enough that this is not visible. With reduced motion they are still, so neither map renders again. A frame now renders the room about twice: 285 draws and 1.23 million triangles on high and balanced.
- **Half-resolution ambient occlusion.** `InteriorAO` renders its normal and depth pass, its 12-sample SSAO, and its blur at half the scene target's width and height. The result is upsampled when it is blended. The occlusion radius is a few centimeters and the result is blurred, so contact shadows under the chairs, table, bench and counter keep their shape.
- **Shadow map sizes.** The sun's map is 2048 on high and 1024 on balanced and performance (formerly 4096 and 2048). The window light keeps its 1024 map. With the maps cached, size changes rendering time very little (4096 measured about 0.3 ms slower). A 4096 map takes about 128 MB of GPU memory, as RGBA color plus a depth buffer; a 2048 map takes a quarter of that.
- **MSAA by quality.** High keeps 4x MSAA. Balanced and performance use 2x. At a pixel ratio of 1.25, 2x makes the chair's curved back and the round window's diagonals step a little when zoomed in; otherwise the frames match.
- **Bloom.** The interior uses the village's quarter-resolution `SoftBloomPass` and `BloomOutputPass` with its own settings (strength 0.13, radius 0.4, threshold 1.3). Performance quality still disables bloom and ambient occlusion.
- **Pixel ratio.** The outdoor resolution scaler does not measure the bakery. On entry the village applies the quality's full ratio (1.25 on high and balanced, 1 on performance, never above the device ratio). On exit it restores the ratio the scaler had reached outdoors. Without this, a visit after a slow stretch outdoors stayed at whatever lower ratio the scaler had reached, as low as 0.75.

`window.__willowmere.getInterior().render` reports the composer's pixel ratio, target size, MSAA samples, the AO target width and kernel size, whether bloom is on, the sun's shadow map size, and whether the shadow maps update every frame. `window.__willowmere.tuneInterior(settings)` overrides these for measurements: `ao`, `bloom`, `samples`, `sunShadow`, `windowShadow`, `aoScale`, `aoSamples`, `pixelRatio`, and `shadowRefresh` (seconds between map refreshes; 0 renders both every frame). Pass `null` to restore a default. Normal play never calls it.

### Measure the interior

Start `npm run dev`, then run:

```sh
BENCHMARK_URL=http://127.0.0.1:5173 node scripts/benchmark-interior.mjs label --ablate
```

The script opens `/?interior=bakery&resolution=fixed` at 1600 × 1000 CSS pixels, at device scale 1 and then 2 (`BENCHMARK_SCALES` overrides this). Chrome is launched with `--disable-frame-rate-limit --disable-gpu-vsync`, so frame intervals show throughput above 60 FPS. The view stays at the entrance, facing the counter and the room. Each configuration settles for 0.8 seconds and records 2 seconds. Four rounds (`BENCHMARK_ROUNDS`) cycle through all configurations, so drift is spread across them. It reports the mean and p95 frame interval, callback CPU time, draw calls, and triangles, and saves `output/interior-label.json`. `--ablate` adds rows on high that undo one optimization or change or remove one feature. Revisions without `tuneInterior` can still run the three presets.

The callback CPU time tracks the frame interval because the driver blocks on the queued GPU work, so it does not measure JavaScript cost. Headless Chrome paces uncapped frames unevenly, so p95 values are high even for fast configurations; compare means. GPU timer queries (`EXT_disjoint_timer_query_webgl2`) are available on ANGLE Metal, but they returned elapsed times longer than the frame interval, so the script does not use them.

### Interior comparison (2026-10-30)

Apple M5, headless Chrome 156. The baseline is `origin/main` at `8226960`; the after runs are this branch merged with it. Both were served side by side and run alternately three times, with no other test browsers. The machine's speed drifted between pairs, and both revisions slowed together. The table gives the range of mean frame intervals over the three pairs. The before drawing buffer was already 2000 × 1250 at scale 2 on high and balanced, because the village caps the pixel ratio at 1.25.

| Quality     | Scale | Draws / triangles before → after | Frame ms before → after |
| ----------- | ----- | -------------------------------- | ----------------------- |
| High        | 1     | 460 / 2.30M → 285 / 1.23M        | 16.7–21.3 → 14.5–15.3   |
| Balanced    | 1     | 460 / 2.30M → 284 / 1.22M        | 16.3–20.5 → 13.0–13.3   |
| Performance | 1     | 323 / 1.72M → 146 / 0.63M        | 11.0–13.4 → 9.9–10.2    |
| High        | 2     | 460 / 2.30M → 288 / 1.24M        | 25.3–28.6 → 18.9–20.0   |
| Balanced    | 2     | 460 / 2.30M → 286 / 1.23M        | 25.1–26.9 → 16.7–17.4   |
| Performance | 2     | 323 / 1.72M → 146 / 0.63M        | 13.0–14.1 → 9.9–10.6    |

Within each pair, frame time fell 13–33% on high, 20–38% on balanced and 9–28% on performance. The smallest reductions came from the first pair at scale 1, run while the machine was quieter. Performance quality has no AO or bloom, so only the shadow cache applies to it.

Ablations on high at scale 2 (2000 × 1250, one run, 18.9 ms with all changes):

| Change from the new defaults | Frame ms | Difference |
| ---------------------------- | -------- | ---------- |
| Full-resolution 16-sample AO | 21.8     | +2.9       |
| Both shadow maps every frame | 20.8     | +1.9       |
| Sun shadow map 4096          | 19.2     | +0.3       |
| 2x MSAA                      | 16.8     | −2.2       |
| Bloom off                    | 17.9     | −1.0       |
| AO off                       | 15.3     | −3.7       |
| MSAA off                     | 13.7     | −5.2       |
| Pixel ratio 1 (1600 × 1000)  | 14.6     | −4.3       |

At scale 1 (1600 × 1000, 14.5 ms), full-resolution AO added 1.9 ms, per-frame shadows 2.6 ms, and the 4096 sun map 0.3 ms. 2x MSAA saved 1.5 ms, turning AO off 2.5 ms, and turning MSAA off 3.6 ms.

What remains on high is mostly the multisampled color pass at 2000 × 1250 and the AO normal pass. That pass renders the full 600,000-triangle room again, even at half resolution. Baking occlusion into the merged furniture's vertex colors would remove it. That would require a ray-cast bake over about 600,000 vertices when the bakery opens, or a stored asset, and it would lose the occlusion on the cat and the mobile.

Screenshots at device scale 2 with reduced motion compare the counter, the oven corner and the display case in front of the arched window, in the golden afternoon and after hours. Before and after match within a mean absolute difference of 1.5–2.2 levels out of 255. Under 1.5% of pixels differ by more than 16 levels, mostly along edges where the 2x MSAA used on balanced resolves differently. The warm oven glow, the window's light on the floor, and the soft contact shadows under the furniture are unchanged.

## Regression budgets

`tests/performance.spec.js` checks preserved character geometry and animated joints, shared flower resources, independent plant growth, and draw/geometry budgets for a village with 30 planted bouquets. Tree tests check independent culling, shared wind materials, and that coarse leaf detail halves the drawn leaves without changing canopy bounds. Water tests cover small fountain capture allocations, refraction resolved from the village's main pass, excluded scenery staying out of captures, and restoration of both automatic and manual scene-transform policies. `tests/resolution.spec.js` covers the starting quality on 1x and 2x screens, the pixel ratio caps, and the scaler's step down and backoff, using synthetic frame timestamps.

`tests/interior.spec.js` checks that the bakery's shadow maps stay cached, that its AO runs at half the scene target's width, the MSAA and sun-map size for each quality, and median draw budgets of under 330 on high and under 180 on performance.

`tests/shadows.spec.js` checks that the sun's shadow bounds keep their size and move in whole texels while the player walks, shrink when zoomed in, grow when zoomed out, and switch to the finer first-person map and back.

These tests assert rendering work and behavior instead of a machine-dependent FPS threshold. The village diagnostics expose `drawCalls`, `triangles`, `geometries`, `textures`, and `shadow` (`mapSize` and light-space `bounds`); water diagnostics include each pool's `reflectionSize`.
## Change history

Per-change measurements, each against the previous `main` (`1a2624c`) at the time, in the order the changes landed. Several were taken while other benchmarks shared the GPU and say so; use them for the shape of each change and for its draw and triangle deltas, and use [Where the time goes](#where-the-time-goes-2026-10-30) for the current combined baseline.

### Local comparison (2026-10-29)

Sequential headless Chrome runs at 1600 × 1000, DPR 1, with a fresh save and the camera settled at spawn. The baseline was commit `d52ccce`; the after run used these optimizations. Values are means except the last column.

| Quality     | FPS before → after | CPU ms before → after | Draw calls before → after | Triangles before → after | Frame p95 ms before → after |
| ----------- | ------------------ | --------------------- | ------------------------- | ------------------------ | --------------------------- |
| High        | 26.1 → 30.3        | 37.9 → 7.6            | 2,768 → 1,034             | 3.78M → 2.70M            | 50.1 → 50.0                 |
| Balanced    | 26.2 → 44.1        | 37.9 → 6.9            | 2,753 → 986               | 3.78M → 2.61M            | 50.1 → 50.0                 |
| Performance | 41.5 → 47.7        | 23.1 → 4.6            | 2,367 → 931               | 3.32M → 2.50M            | 49.9 → 33.4                 |

High quality remains limited by rendering on this setup; lower submission cost does not guarantee 60 FPS. Re-run the benchmark on the target device, especially at higher device pixel ratios. The raw local reports are `output/performance-before.json` and `output/performance-after.json` (ignored build artifacts).

### Resolution comparison (2026-10-29)

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

### Antialiasing and bloom comparison (2026-10-29)

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

### Water refraction from the main pass (2026-10-30)

Before is `1a2624c`; after renders refraction from the main pass. Both predate the resolution and bloom changes above, so high quality ran at pixel ratio 1.75. Runs alternated before and after while holding the shared GPU lock, so no other benchmark or test browser was rendering: two pairs at DPR 1 with `npm run benchmark`, and three pairs at DPR 2 with a copy of the script using `deviceScaleFactor: 2` and Chrome's `--disable-frame-rate-limit --disable-gpu-vsync`. Values are medians of the per-run means.

| Quality     | DPR 1 frame ms (FPS)      | DPR 2 uncapped frame ms (FPS) | Draw calls  | Triangles     |
| ----------- | ------------------------- | ----------------------------- | ----------- | ------------- |
| High        | 35.7 → 29.7 (28.0 → 33.7) | 52.5 → 40.4 (19.1 → 24.7)     | 1,268 → 878 | 3.86M → 2.83M |
| Balanced    | 32.2 → 26.3 (31.1 → 38.0) | 32.8 → 26.8 (30.4 → 37.3)     | 1,246 → 844 | 3.85M → 2.76M |
| Performance | 25.9 → 23.4 (38.6 → 42.8) | 20.5 → 16.8 (48.9 → 59.5)     | 1,159 → 767 | 3.57M → 2.51M |

Every paired run favored the after build. DPR 1 frame intervals snap to display refresh multiples, so the uncapped DPR 2 runs show the GPU saving more directly: 12 ms per frame at high quality. Each frame submits about 390 fewer draws and 1.0–1.1M fewer triangles at the spawn view. Performance quality saves the least time because its separate capture was already at half resolution.

### Foliage comparison (2026-10-30)

These are sequential headless Chrome runs at 1600 × 1000, with frame-rate limiting and vsync disabled. Before is `1a2624c` and after is the foliage change alone, so both predate the refraction, resolution, and bloom changes above. The two changes overlap: the refraction saving here came from removing foliage from a refraction capture that the main pass now supplies, so foliage exclusion now saves only its share of the reflection captures and the fallback capture. Each sampled frame ends with a one-pixel `readPixels`, so the time covers GPU completion. Values are medians of two runs at high quality. In these runs, frames on unchanged code varied by about ±1 ms.

| View                     | DPR 1 ms before → after | DPR 2 ms before → after | Triangles before → after |
| ------------------------ | ----------------------- | ----------------------- | ------------------------ |
| Default (view height 18) | 37.1 → 32.8             | 59.8 → 55.8             | 3.86M → 3.09M            |
| Zoomed in (10)           | 28.4 → 28.1             | 47.7 → 45.7             | 3.19M → 2.63M            |
| Zoomed out (39)          | 39.8 → 32.8             | 58.6 → 48.3             | 4.45M → 2.86M            |
| First person             | 25.4 → 21.7             | 39.0 → 34.9             | 2.82M → 2.08M            |

Interleaved A/B toggles in a single page measured each change's share at DPR 1, default view. Leaving foliage out of the water captures saved 3.6 ms (5.7 ms at DPR 2). Coarse leaves at maximum zoom-out saved 3.5 ms (4.6 ms at DPR 2). At the default view, the remaining detailed tree leaves cost about 3.5 ms, and all shrub leaves together cost about 0.7 ms. Absolute times include contention from other local GPU work, so compare the differences rather than the totals.
