# Rendering performance

Willowmere is GPU bound. JavaScript, including movement, collision, route finding and character animation, takes about 4 ms per frame; the rest of the frame is rasterization, and it scales with the drawing buffer's pixel count and with how many times the scene is submitted. This document records how each frame is built, where its time goes, how to measure a change, and what to keep in mind when adding scenery, lights or passes. [Water rendering](water.md) covers the water system's own costs.

## Frame anatomy

The outdoor view, in the order `animate()` in `src/main.js` runs it each frame:

1. **Simulation and bookkeeping (JavaScript, about 4 ms).** Input, player collision against `colliders`, `life.update` for residents, cats, puppy, birds and butterflies, `world.update` for the mill, reeds and water bookkeeping, planting growth, dusk blending, `playerVisibility`, `fitShadow`, `trees.setDetail` by zoom or distance, first person's detail range (`world.setDetailFocus`), a 2.5 ms slice of streaming (`streamer.update`, until the open country is built), and `updateResolution`. The scene has `matrixWorldAutoUpdate` off, so `scene.updateMatrixWorld()` runs once here and every pass reuses the transforms. Nearby-interactable scanning runs every eighth frame.
2. **Water (`world.water.render`).** The GPU shallow-water simulation steps each visible pool in small ping-pong targets (a few draws). At most one pool whose reflection is overdue re-renders the mirrored scene into a cropped reflection target; tree leaves and shrubs are hidden for that capture. Refraction is not rendered here: the call arms a one-shot resolve for the main pass.
3. **Shadow pass.** The sun's shadow map (2048 on high in the overview, 4096 in first person) is rendered every frame over a frustum fitted to the receivers in view. Ground slabs, roads and the riverbed receive only.
4. **Main pass (`RenderPass`).** The opaque scene draws into a 4x multisampled half-float target. Water surfaces have the highest `renderOrder`; the first one blits the target's color and depth into the refraction texture, then the surfaces and transparent objects draw on top. In first person the sky (`src/sky.js`) draws after the opaque scene and before the water, pinned to the far plane, so it shades only pixels nothing else covered. The overview never sees the horizon and skips it.
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

`BENCHMARK_SCALE=2 BENCHMARK_UNCAP=1 npm run benchmark -- label --ablate` repeats this table through the permanent `window.__willowmere.tune` hook (see [Measuring](#measuring)). A rerun later the same day, two interleaved rounds per row with the desktop browser and the Claude app also drawing on the GPU, reproduced every row's ordering and saving within 0.8 ms, inside the ±1 ms run-to-run noise seen on unchanged code, so the table stands. Every absolute time, the baseline included, was 1–1.6 ms higher in that rerun (9.7 ms at DPR 2, 8.7 ms at DPR 1), which is the cost of the other GPU work rather than of the hook: with no overrides set it adds nothing to the frame. The foliage row there hid both tree leaves and shrubs. Forcing the coarse leaf level at the default view, a row the original run did not have, saved 0.8 ms at DPR 2 and 1.1 ms at DPR 1.

The same method on the previous `main` (`1a2624c`), measured earlier the same day, gave 22.1 ms at DPR 2 (high rendered at pixel ratio 1.75, a 2800 × 1750 buffer) and 12.5 ms at DPR 1. Part of the DPR 2 gain is the pixel-ratio cap; the rest is the single scene submission for refraction, the quarter-resolution bloom, the fitted shadow map and the foliage changes. Balanced measured 8.6 ms and performance 6.5 ms at DPR 2.

With vsync on and dynamic resolution enabled, as a retina laptop runs it, all three presets hold 60 FPS at the default view with a frame p95 of 16.7–16.8 ms, and the animation callback takes 3.8–4.0 ms.

What this table says about the next change:

- **Multisampling is now the largest single GPU cost.** The village keeps 4x because 2x visibly steps roof edges and dashes shingle grooves at pixel ratios of 1 and 1.25 (see the antialiasing notes below). A cheaper edge treatment that preserves those grooves would be worth more than any other single pass.
- **Foliage is next.** The remaining detailed tree leaves are about 2 ms at the default view. The coarse level already applies when zoomed out or far away; a further level for the default view, or fewer leaves per tree, is the remaining lever.
- **The frame is no longer purely fill bound.** JavaScript plus draw submission is about 4–6 ms, against 7–9 ms of total frame time uncapped. From here, GPU-only savings return less, and submission cost (about 790 draws) and per-frame JavaScript matter as much. In the uncapped runs above, the measured callback time tracks the frame interval because the driver blocks on queued GPU work, so JavaScript cost can only be read from vsync-on runs.
- **Bloom, shadows and water are small.** Each is around 1 ms at retina. They have been reduced as far as their current designs allow; the shadow section explains why a static shadow cache does not pay.

Startup is not optimized and has no regression test: from navigation to the loading screen dismissing takes 1.1–1.6 s in headless Chrome on this machine (DOM content loaded at about 0.7 s), spent generating procedural textures, building and baking the village, and uploading about 53,000 leaf instances. The open country around the village is not part of that: it streams in over the following frames (see [Streaming and distance limits](#streaming-and-distance-limits-2026-10-31)). The production bundle is about 540 KB of Three.js (139 KB gzipped) plus about 230 KB (85 KB gzipped) of game code split into village, world, interior and water-study chunks.

Not yet measured: mobile GPUs, Windows integrated graphics, Safari and Firefox, and thermal throttling over long sessions. The narrow-screen path starts on balanced and relies on the resolution scaler. Measure on those devices before tightening budgets or changing the presets.

## Measuring

Measure before and after every rendering change, on an idle machine, and compare differences rather than absolute times.

- **Standard benchmark.** Start `npm run dev`, then run `npm run benchmark -- label` in another terminal. Set `BENCHMARK_URL` if the server is on another port, for example `BENCHMARK_URL=http://127.0.0.1:5174 npm run benchmark -- after`. The script uses the same Chrome selection as the regression tests (`CHROME_PATH`, installed Chrome on macOS, or Playwright Chromium). It opens a fresh browser at 1600 × 1000 and device pixel ratio 1 with `?resolution=fixed`, enters the village, lets the view settle, and samples four seconds at each quality setting. It reports frame intervals, animation-callback CPU duration, draw calls, and submitted triangles, then saves the measurements in `output/performance-label.json`.
- **Retina and uncapped runs.** The standard benchmark runs at pixel ratio 1 with vsync, so it saturates at 60 FPS and never exercises the retina caps. For a change that affects fill rate, set `BENCHMARK_SCALE=2` for a device scale factor of 2 and `BENCHMARK_UNCAP=1` to launch Chrome with `--disable-frame-rate-limit --disable-gpu-vsync`. The script keeps `?resolution=fixed`, or the scaler would step down during the run. Headless Chrome paces uncapped frames unevenly, so compare means, not p95. `BENCHMARK_ROUNDS` interleaves several passes over every configuration so drift spreads across them.
- **Interior.** `node scripts/benchmark-interior.mjs label --ablate` measures the bakery at both device scales and can undo each optimization in turn through `window.__willowmere.tuneInterior`. See [Measure the interior](#measure-the-interior).
- **Outdoor ablation.** `BENCHMARK_SCALE=2 BENCHMARK_UNCAP=1 npm run benchmark -- label --ablate` reproduces the table above. After the three presets it runs high quality with one change at a time through `window.__willowmere.tune(settings)`: `samples` (MSAA on the composer's two targets), `foliage` (tree leaf and shrub instances hidden), `leafDetail` (forces `trees.setDetail` to a level), `pixelRatio` (forced, with the scaler standing aside), `water` (skips `world.water.render`), `shadowUpdate` (freezes the sun's shadow map), `bloom`, `sky` (hides the first-person sky), then all of shadows, water and bloom off, followed by the unchanged high preset in first person and at the zoomed-out view. Each row reports the mean and p95 frame interval, draw calls and triangles. Pass `null` for a key to restore its default; `getDiagnostics().render` reports the effective state, including the number of drawn leaves. Normal play never calls `tune`, and `tests/tune.spec.js` checks that every override toggles and restores.
- **Deterministic counters.** `window.__willowmere.getDiagnostics()` reports `drawCalls`, `triangles`, `geometries`, `textures`, the `resolution` state and the sun's `shadow` bounds. Draw calls and triangles do not depend on machine load, so quote them alongside any timing; they are what the regression tests assert.
- **Contention.** Numbers taken while another browser, test run or benchmark is rendering are inflated and noisy. Several of the dated comparisons under [Change history](#change-history) were taken that way and say so; the table above was not.
- **What does not work here.** WebGL timer queries (`EXT_disjoint_timer_query_webgl2`) return elapsed times longer than the frame because Apple's tile-based GPU overlaps passes, so they cannot isolate a pass. Updating shadows on alternate frames raises p95 frame time through uneven workload. FPS from any single machine does not transfer; re-run on the target device, especially at higher device pixel ratios.

## Checklist for changes

Each item names the mechanism in the code that a new change has to work with.

- **Static scenery.** Add plain meshes under `createWorld`; the bake at the end of `src/world.js` merges them into one draw per chunk, material and shadow role, and removes the originals. Chunks are 16 × 14 m (`WORLD.chunk` in `src/world-layout.js`; the village is the 3 × 3 around the origin), and each batch's bounds hug its chunk, so the main, shadow and reflection passes cull chunks out of view. A chunk's share of a material under 4,000 triangles (`MIN_BATCH_TRIANGLES`) joins the same material's batch in a neighbouring chunk rather than drawing alone. Plain `MeshStandardMaterial`s (no maps, no emissive, no shader hooks, opaque) that differ only in colour are baked onto one vertex-coloured material per finish, so a new colour costs no extra draw. Animated or later-modified objects must set `userData.dynamic = true` or they are frozen into the bake. Transparent materials are not merged. Give flat receivers (ground, roads, beds) `castShadow = false`; the bake honors per-mesh flags. Seat new placements on `terrainHeight(x, z)` from `src/world-layout.js`; the village is flat, and regions bring their own heights as data (the millpond's banks, the orchard hill).
- **Beyond the village.** The village builds before the loading screen lifts; everything outside it streams in afterwards. A region is a module under `src/regions/` loaded with `import()` (see `src/regions/outskirts.js`) that returns jobs for the streamer in `src/streaming.js`: `{ x, z, step(deadline) }`, where `step` works until `performance.now()` passes the deadline and returns nothing to be called again, or the finished objects. The streamer runs the job nearest the player for 2.5 ms of each frame, compiles each finished object's materials with `renderer.compileAsync` and only then adds it to the scene, so a streamed piece never stalls a frame on its first draw. Register streamed meshes with `world.addStreamed(mesh, { detail })` so they join their chunk. New chunks seed their layout with `chunkRandom(cx, cz)`, never the village's legacy stream, and seat placements on `terrainHeight(x, z)`. The streamed pieces do not go through the static bake, so build them already merged: one mesh per chunk and material, or one instanced mesh per chunk. A region whose shape matters before its meshes arrive (terrain, colliders, ground height, its label) keeps that in a small module loaded with the village, as `src/regions/millpond-layout.js` does; its colliders can be a shape (`{ minX, maxX, minZ, maxZ, blocks(x, z, r) }`), which `blocked()` tests only inside its box. Register a streamed piece's animation with `world.animate(x, z, update)`. Trees in a region share the village trees' resources through `world.trees`: `materials.wood` (bark), `materials.crown` (distant crowns) and `blades` (the two leaf blades). Leaves on raised ground take `materials.grounded(shake)`, a leaf material whose wind counts its shelter from a per-instance `groundLift` attribute (the ground's height under the tree) rather than from y = 0; register the foliage with `world.trees.adopt()` so it follows the zoom and distance levels of detail like the village's trees. `src/regions/orchard.js` does both.
- **Materials.** Reuse shared materials; every distinct textured, emissive or customised material is at least one extra draw per chunk and pass. Avoid cloning materials per object. Materials with emissive color are registered with their chunk (`chunk.glow`) at bake time and collected into `glowMaterials` for the dusk glow, so a new lantern's glass needs no extra code.
- **Animation.** Register a moving object with `animate(x, z, update)` in `src/world.js`; it runs only while its chunk is inside the view or the sun's shadow frustum. Make it a function of the time or of the world's `clock` argument (which pauses with reduced motion), not of accumulated `dt`, so a paused chunk resumes in step. Use the global `animated` list only for map-wide effects such as wind.
- **Dense instanced detail.** The bake splits every instanced mesh outside the trees into per-chunk meshes, clustering sparse chunks to the same 4,000-triangle minimum. Keep `matrixAutoUpdate = false` and tight bounding spheres so each part culls as a unit. First person hides grass, blossoms and pebbles whose parts lie wholly beyond 30 m (`DETAIL_RANGE` in `src/world.js`); add new small detail to `DETAIL_NAMES`, or stream it with `addStreamed(mesh, { detail: true })`. Register it with `water.excludeFromCaptures()` unless it must appear in reflections. Prefer `FrontSide` with `shadowSide: DoubleSide` for thin blades. If it covers few pixels at the default view, give it a coarse level like `trees.setDetail()`.
- **Lights.** Each shadow-casting light renders the whole scene again every frame. The village has one; the bakery caches its two because they never move. A new shadow caster outdoors needs the same fitting and caching argument as `fitShadow()`, or a measured budget. Point lights are a fixed pool: every lit material is compiled for the scene's point-light count, so adding or removing one recompiles every program on the main thread, and each one is evaluated in every lit fragment. Add a lantern with `lamp(x, z)` in `src/world.js`, never a new `PointLight`; `placeLanterns` moves the `LANTERN_LIGHTS` pool (six, one per current lamp) to the lamps nearest the view each frame. Raise the pool only with a measured budget.
- **Post-processing.** Do not add a full-resolution pass that reads or writes the multisampled scene target. Follow `src/bloom.js`: work at quarter resolution and composite in the output pass.
- **Water.** Read [docs/water.md](water.md) first. Each pool adds simulation targets and a reflection capture at the quality's interval; refraction comes from the main pass and costs a blit, not a render.
- **Resolution.** Never call `renderer.setPixelRatio` directly outdoors. Go through `QUALITY_PIXEL_RATIO`, `resetResolution` and the scaler, and keep `?resolution=fixed` working for the benchmark and tests. The bakery applies its quality's cap on entry and restores the scaler's ratio on exit.
- **Per-frame JavaScript.** No allocations, `scene.traverse`, or material changes inside `animate()`. Precompute at build time; throttle scans the way `scanNearby` runs every eighth frame.
- **Verify and record.** Run the standard benchmark and a retina run before and after, quote draw calls and triangles, update the budgets in `tests/performance.spec.js`, `tests/trees.spec.js`, `tests/shadows.spec.js` and `tests/interior.spec.js` only when the new work is intended, and add the result to this document.

## Work reduction in the current build

- Character parts with the same roughness and shadow settings are baked together within each rigid joint. Colors become vertex colors. The detailed inhabitants and wildlife use 151 meshes and about 64,000 triangles. Arms, legs, ears, paws, tails, scarf, and leash anchors retain their original transforms.
- Wildflower and planted bouquets share three baked geometries and materials. Each bouquet needs three draws instead of 35, plus a shared halo for gatherable flowers. Planting does not allocate another set of petal geometry.
- Doorstep pots, window boxes and the beds along house walls come from `src/planters.js`. Every leaf, petal, pot and edging stone carries a vertex color and shares one material, so all of the village's planting bakes into a single draw per pass (about 69,000 triangles for four houses, roughly 17,000 per house). It replaced about 57,000 triangles of flat-colored sphere clumps spread over several materials, and the scene now submits about 14 fewer draws per frame for about 12,000 more static triangles. Leaf normals bend toward each clump's center and colors darken toward its base, which shades a mound as one rounded plant at no runtime cost. New buildings should add a scheme to `plantings` in `src/world.js` rather than new materials.
- Each tree retains separate bark, detail, leaf, and litter bounds. Materials, leaf geometry, textures, and wind uniforms are shared. Offscreen trees can be rejected independently in the main camera, shadows, and water reflections.
- Tree leaves and shrub pockets are left out of water reflection captures, and out of the separate refraction capture used when the main pass cannot supply refraction, through `water.excludeFromCaptures()`. They still cast shadows and appear in the main view, which also supplies refraction. The pools do not resolve individual leaves, and the reflections barely change. Trunks and branches still reflect.
- Each tree's leaves are ordered so that even-numbered leaves come first. `trees.setDetail()` can draw only that half, using a broader 4-triangle diamond blade with the same fold instead of the 8-triangle detailed blade, so canopy coverage and wind motion stay similar. The village switches every tree to this coarse level above an orthographic view height of 24 (the default is 18). In first person, it switches trees whose canopy center is more than 18 m from the eye. Canopy bounds for player visibility are unchanged, and leaf culling spheres enclose both blades.
- In first person, trees whose canopy centre is more than 40 m from the eye (`CROWN_DISTANCE`, deep in the fog) draw their crown instead of their leaves: one lumpy shell per leaf cluster, merged per tree (about 1,300 triangles against about 19,000 for a village tree's coarse leaves), in a shared vertex-coloured material that casts ordinary shadows. The tree's litter and foot details hide with its leaves at that distance. The overview never uses crowns. Crowns live in their own group (`trees.crowns`), beside each tree's four batches, and are left out of water captures.
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

- **Fit to the view.** Each frame traces the overview camera's four corner rays from the soil rim (y −1.4) up to the tallest canopy (9.5 m) above the highest ground in the view's footprint (`terrainMaxIn` in `src/world-layout.js`, from 4 × 4 m tile maxima), so the orchard hill raises the ceiling only for views that include it. It projects those eight points into light space and adds a one-unit margin. Light-space x follows the screen's right edge for the current yaw step, so the visible footprint fills the map instead of a rotated box. The roll changes once per yaw click, not during the rotation animation.
- **Stable edges.** Each axis takes one of 17 sizes, from 0.32 of the village's light-space extent (`WORLD.shadowReference`, the original island's receivers) to about twice it, about 12% apart; a view wider than that takes the whole map. The sizes refer to the village, not the map, so growing the map changes no texel. It grows immediately and shrinks only when the view is 4% inside the next smaller size. The start of each axis snaps to whole texels. Following the player and panning therefore move the map by whole texels without changing its size, and edges do not shimmer. Shadows update every frame; updating on alternate frames was measured earlier to raise p95 frame time.
- **Map sizes.** The overview uses 2048 (high), 1536 (balanced), and 1024 (performance). First person keeps the earlier 4096, 2048, and 1024 over a village-sized box of ground (49.2 × 42 m) centred 10 m ahead of the eye and raised to the ground under it, which is the whole village from its middle and the same texel density as before on a map of any size. Turning and walking move that box in whole texels without changing its size; the fog hides the ground beyond it. With 2048 over the fitted view, a bench's shadow at eye level was visibly blurrier than the 4096 baseline. Switching views reallocates the map once. `PCFSoftShadowMap` ignores `shadow.radius` for directional lights, so the unused setting was removed.
- **Casters.** Ground slabs, roads, and the riverbed only receive shadows. Three.js renders the back faces of front-sided materials into shadow maps, so the slabs' undersides filled the entire map every frame. Roads and the 47,040-triangle riverbed face the sun and were culled after vertex work. The static bake now groups meshes by material and shadow flags instead of forcing every batch to cast. Grass blades, pebbles, and stepping stones already did not cast.

Texel size in world centimetres (light-space x × y). Before, the map was 4096 over a fixed 70 × 64 box: 1.7 × 1.6 at every zoom.

| View                            | Shadow area (world units) | Texel (cm) |
| ------------------------------- | ------------------------- | ---------- |
| Overview zoomed in (height 10)  | 26 × 35                   | 1.3 × 1.7  |
| Overview default (height 18)    | 41 × 50                   | 2.0 × 2.4  |
| Overview zoomed out (height 39) | 58 × 62                   | 2.9 × 3.0  |
| First person                    | 58 × 62                   | 1.4 × 1.5  |

The overview's zoom-out now stops at height 30 (see [Streaming and distance limits](#streaming-and-distance-limits-2026-10-31)); the height 39 row is kept for comparison with the measurements above.

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

`tests/performance.spec.js` checks preserved character geometry and animated joints, shared flower resources, independent plant growth, and draw/geometry budgets for a village with 30 planted bouquets. `tests/tune.spec.js` checks that each outdoor `tune` override takes effect in the diagnostics and the submitted work, that `null` restores every default, and that the quality presets still apply their own settings afterwards. Tree tests check independent culling, shared wind materials, and that coarse leaf detail halves the drawn leaves without changing canopy bounds. Water tests cover small fountain capture allocations, refraction resolved from the village's main pass, excluded scenery staying out of captures, and restoration of both automatic and manual scene-transform policies. `tests/resolution.spec.js` covers the starting quality on 1x and 2x screens, the pixel ratio caps, and the scaler's step down and backoff, using synthetic frame timestamps.

`tests/interior.spec.js` checks that the bakery's shadow maps stay cached, that its AO runs at half the scene target's width, the MSAA and sun-map size for each quality, and median draw budgets of under 330 on high and under 180 on performance.

`tests/shadows.spec.js` checks that the sun's shadow bounds keep their size and move in whole texels while the player walks, shrink when zoomed in, grow when zoomed out, and switch to the finer first-person map over a village-sized box that keeps its size and moves in whole texels while the view turns.

`tests/streaming.spec.js` checks that the open country's 16 grass patches and the route grid stream in after startup into the map's chunks, that first person's fog closes before its 72 m far plane and the overview's fog returns on switching back, and that neither the streaming nor a walk from the green across two chunk borders into the fields at the zoom cap ever misses two display refreshes in a row (a gap of 45 ms or more between animation frames; a single missed refresh at 33 ms is load, not a stall). The first zoom-out after starting is left out of that timing: it has stalled for 50–70 ms once since before the map grew, also on `main`. The last test skips itself where the median frame takes over 20 ms, as with software WebGL in cloud containers.

`tests/chunks.spec.js` checks that the village bakes into its nine chunks with each batch near its chunk, that grass, blossoms and shrubs split per chunk, that glowing materials are registered, that a chunk out of view and out of the sun's shadow pauses its animations and resumes when it returns, and that planted flowers from an old save get ids that survive a reload. `tests/world-layout.spec.js` checks that the map is four times the village's area with the village in the middle, that the walk box, camera clamp and shadow extent keep their margins at the new rim, that the region table names every village spot as the old label did and the rest as the open fields, that chunk seeds do not depend on build order, and that the terrain is flat in the village and rises only at the millpond and the orchard hill.

`tests/millpond.spec.js` checks that the pond's banks always stand above its water's edge and fall back to the lawn at the edge of its ground, that the pond and its brook block walking except along the jetty and footbridge, that the pond's water body follows its shoreline, that a cast waits for a bite which a timely press lands, and that the millpond streams in with its two water bodies and grids, routes from the village green to the jetty's end, and casts a line there.

`tests/orchard.spec.js` checks that the orchard hill meets the lawn at the edge of its ground, before the village and the millpond, with no slope steeper than about 35°; that its path runs from the village's edge to the windmill's door clear of every tree, hive and bench, with each tree reachable; that the hill streams in, routes from the village green to the bench, carries the player on its slope, and that shaking a tree and opening a hive fill the basket and survive a reload; and that in first person trees beyond 40 m draw crowns that cast shadows while nearer ones keep their leaves, and the overview gives every tree its leaves back.

`tests/routing.spec.js` checks that a click on the far bank of the brook routes over the bridge and walks there, that clicks in the water or off the map return no route, that the open country and the once-sealed pocket south of the mill route, and that the lanterns keep a fixed pool of point lights with no new shader programs at dusk.

These tests assert rendering work and behavior instead of a machine-dependent FPS threshold. The village diagnostics expose `drawCalls`, `triangles`, `geometries`, `textures`, and `shadow` (`mapSize` and light-space `bounds`); water diagnostics include each pool's `reflectionSize`.
## Change history

Per-change measurements, each against the previous `main` (`1a2624c`) at the time, in the order the changes landed. Several were taken while other benchmarks shared the GPU and say so; use them for the shape of each change and for its draw and triangle deltas, and use [Where the time goes](#where-the-time-goes-2026-10-30) for the current combined baseline.

### Orchard hill (2026-11-01)

Phase 4 of the map expansion. A hill about 3.6 m high rises north-west of the village (`src/regions/orchard-layout.js`: its height, path, trees, hives, colliders and grass mask load with the village); its slopes reach the lawn again before the village, the millpond's ground and the map's rim. A path climbs from the cottage lane to a stone windmill on the summit, past a bench that looks back over the village. Ten apple and six pear trees stand on the south and east slopes, three beehives on the west. Everything streams in after the village from `src/regions/orchard.js` (six jobs: the hill's ground, each kind's trees, the windmill with hives and bench, the bees, the clover and wildflowers).

- **Draws.** The hill's ground is one 11,000-triangle mesh that tints the open country's grass texture, warmer up the slope and turned toward or away from the sun so its shape reads from above. Each kind of tree is five meshes: bark, the shade inside the crowns (castShadow off), leaves (one instanced mesh in the village's blade, about 9,200 apple and 4,800 pear leaves), the distant crowns (first person only) and fruit. The windmill, hives, bench and gateposts share one vertex-coloured mesh; the sails, bees and flowers are one draw each.
- **Wind on the hill.** The village's wind shader counts each leaf's shelter from y = 0, which on the hill would let every leaf sway fully. Orchard leaves use `trees.materials.grounded()`, the same shader with a per-instance `groundLift`; the same uniform lets a shaken tree's leaves tremble. These are the orchard's only new programs (leaf and leaf depth).
- **Distant crowns.** In first person, any tree, village or orchard, whose canopy centre is more than 40 m away draws its crown shells instead of leaves (see [Work reduction](#work-reduction-in-the-current-build)). From the bench looking over the village, that takes draws below `main`'s at the same spot despite the orchard in view.
- **Shadows.** The overview's shadow ceiling now counts only the ground under the view, so the hill does not coarsen shadows elsewhere; the reference box keeps the flat village's 9.5 m ceiling, and first person's box rises with the ground under the eye. Chunk bounds include their tallest ground.
- **Camera.** The overview's target rises with the ground under the player, so the player stays framed on the hill.

Counted in the cloud container (SwiftShader, so no timings) at 1200 × 750, high quality, `?resolution=fixed`, against `main` (`46d7f90`):

| View | `main` draws / triangles | Orchard draws / triangles |
| --- | --- | --- |
| Village overview at spawn, height 18 | 739 / 2.52M | 728 / 2.50M |
| First person at spawn, facing the hill | 724 / 2.24M | 754 / 2.46M |
| Orchard overview by the bench (−21, −27.6), height 18 | 392 / 1.77M (empty field) | 349 / 2.00M |
| Orchard overview, height 30 | | 568 / 2.11M |
| First person by the bench, facing the village | 1,217 / 2.61M | 1,189 / 2.91M |

`tests/performance.spec.js` holds the benchmark's orchard viewpoint (by the bench, height 18) under 1,000 draws and 2.5M triangles, as for the millpond. `npm run benchmark` measures it as "high, orchard" and "high, orchard, first person"; `--ablate` adds the orchard at height 30.

### Millpond (2026-11-01)

Phase 3 of the map expansion. The brook now runs on past the village's north edge, under a footbridge, to a stone weir; above the weir it widens into a still pond about 17 × 11 m with a fishing jetty, a boathouse, a moored boat, reeds and lilies. Everything streams in after the village from `src/regions/millpond.js` (six jobs: banks and bed, water and cascade, structures, stones, lilies, reeds), plus the fishing float. The pond's shape, its banks and bed as terrain data (about half a metre of bank, the first heights outside the flat village), its colliders and the jetty's and footbridge's decks load with the village from `src/regions/millpond-layout.js`.

- **Water.** Two new bodies instead of extending the village brook's 64 × 640 grid: the pond (112 × 78 cells of about 16 cm, closed edges, a third of the brook's reflection rate) and the 3.1 m of brook between the weir and the village (64 × 48, the village brook's cell size). `addBody` gained per-body `grid`, `segments`, `shore`, `ramp`, `openEnds` and `reflectionEvery` (see [docs/water.md](water.md#adding-another-pool)). The new surfaces use the existing water program.
- **Draws.** The banks and bed are one 25,000-triangle mesh that tints the open country's grass texture, so it meets the fields without a seam; the weir, footbridge, jetty, boathouse, boat and bench share one vertex-coloured mesh. Shore stones, lily pads and lily flowers are one instanced mesh each; the reeds use the village's reed builder.

Counted in the cloud container (SwiftShader, so no timings) at 1200 × 750, high quality, `?resolution=fixed`:

| View | Draw calls | Triangles |
| --- | --- | --- |
| Pond overview, player at (9, −25), height 18 | 744 | 2.44M |
| Pond overview, height 30 | 669 | 1.85M |

`tests/performance.spec.js` holds the benchmark's millpond viewpoint (the south bank at (8.6, −25.8), height 18) under 1,000 draws and 2.5M triangles, tighter than the village's 1,600. `npm run benchmark` measures it as "high, millpond"; `--ablate` adds the pond at height 30 and with water skipped.

### Streaming and distance limits (2026-10-31)

Phase 2 of the map expansion: the map grows to 96 × 84 m (`WORLD.ground`), four times the village's area, with the village unchanged in the middle (`WORLD.village`) and open, empty fields around it. The walk box, camera clamp, route grid, plantable area and shadow extent follow the new rim; the overview follows the player out to it. The brook still ends at the village's edge, against a grass bank. The fields' grass top is one surface with the village cut out, so no seams cross it.

- **Streaming.** The village still builds before the loading screen lifts. After it, `src/regions/outskirts.js` loads with `import()` and hands 16 grass patches, one per chunk around the village (about 600–850 blades each, from `chunkRandom`), to the streamer in `src/streaming.js`, which builds the nearest for 2.5 ms of each frame and adds each patch once `compileAsync` reports its shaders ready, one patch per frame. Shaders compile for the composer's render target the scene is drawn into: compiled for the screen, the patches built a program they never used, in a 60–80 ms long task. The patches share the village's grass material, so no new program is compiled at all. The 139 × 117 route grid streams in the same way instead of being sampled on the first click; a click before it finishes completes it. Patches are left out of the brook's reflection captures.
- **Zoom cap.** The overview stops zooming out at height 30 instead of 39 until zoom-based detail reduction exists.
- **First-person distance.** The fog is now linear: near 0 and far 693 m in the overview, whose quadratic onset matches the old exponential haze (density 0.0025) within half a percent over the overview's depths, and 30–70 m in first person, whose far plane drops from 160 to 72 m. Below the horizon the sky turns to the fog's colour, so the meadow fades into it without an edge. Grass, blossoms and pebbles whose parts lie wholly beyond 30 m are hidden in first person.
- **Shadows.** Sizes are fractions of the village's light-space extent rather than the map's, from 0.32 to about twice it, so no texel changed. First person fits its 4096 map to a village-sized box 10 m ahead of the eye instead of the whole map.

Counted in the cloud container (SwiftShader, so no timings) at 1600 × 1000, high quality, `?resolution=fixed`, against `main` at `b0319de`. Ranges are over five consecutive frames.

| View | Draw calls before → after | Triangles before → after |
| --- | --- | --- |
| Default overview at spawn (height 18) | 714–866 → 738–890 | 2.43–2.64M → 2.46–2.66M |
| Zoomed out as far as allowed (39 → 30) | 856–1,104 → 876–1,115 | 2.11–2.41M → 2.14–2.43M |
| First person at spawn | 742–745 → 758–761 | 1.87M → 1.88M |
| First person on the bridge, facing east | 967–970 → 985–988 | 2.29–2.31M → 2.30–2.32M |
| First person at the village's west edge, facing east | 1,136–1,140 → 1,154–1,158 | 2.56–2.57M → 2.56–2.57M |
| Fields at (−36, −30), height 18 | (no ground there before) → 208 | → 1.09M |
| Fields at (−36, −30), height 30 | → 455 | → 1.49M |
| First person in the fields at (−44, 3), facing the village | 1,243 (160 m far plane) → 1,170 | 2.59M → 2.32M |
| First person in the fields at (−30, 3), facing west | 294 → 212 | 0.85M → 0.68M |

Views of the village gain 1–3% draws and up to 1% triangles, all from the fields now drawn where the view used to show the void past the soil rim; screenshots of the default and first-person views differ from `main` only there. Views of the empty fields cost a quarter to a half of a village view. Shader programs rose by one (63 → 64 in the overview) and geometries by eight. The overview's fog change leaves village pixels within 8 levels of `main`.

### Chunked world groundwork (2026-10-31)

Groundwork for the larger map, with no new content. `src/world-layout.js` now holds the world's bounds (walk box, camera clamp, shadow extent, plantable area), the 16 × 14 m chunk grid, the region table behind the location label, and a flat one-sample-per-metre terrain field that residents, animals, flowers, effects, contact shadows, trees, shrubs, grass and the click-to-move ray all read. The static bake groups by chunk, material and shadow role, gives plain coloured materials one shared vertex-coloured material per finish, and folds batches under 4,000 triangles into a neighbouring chunk's; that took the village from 50 map-wide batches to 26 chunk batches. The 11 instanced meshes of grass, blossoms, cobbles, pebbles, riverbank detail and shrubs became 33 per-chunk meshes, so the village has 71 static scenery objects instead of 73, each culled on its own. Planted flowers are keyed by id, glowing materials are registered per chunk, and animations other than wind, reeds and dust run only for chunks inside the view or the sun's shadow frustum. The shadow camera's near and far planes now span the world's receivers along the light (about 11.7 to 59.2 m instead of 1 to 85 m), with the depth bias held at the same 1.26 cm.

Counted in the cloud container (SwiftShader, so no timings) at 1600 × 1000, high quality, `?resolution=fixed`, against `main` at `34bfea7`. Ranges are over five consecutive frames, because the reflection capture alternates between pools.

| View | Draw calls before → after | Triangles before → after |
| --- | --- | --- |
| Default overview at spawn (height 18) | 737–900 → 708–863 | 2.57–2.70M → 2.39–2.60M |
| Zoomed out (height 39) | 882–1,131 → 855–1,103 | 2.23–2.44M → 2.11–2.41M |
| Overview at the mill (17, 1) | 649–896 → 622–866 | 2.27–2.47M → 2.04–2.35M |
| First person at spawn | 669–686 → 629–646 | 2.07–2.08M → 1.83M |
| First person on the bridge | 512 → 499 | 2.00M → 1.68M |

Shader programs fell from 64–67 to 62–65 and geometries from 302–335 to 278–311. Screenshots at each view match `main`; at most 0.19% of pixels differ by more than 8 levels, all on characters caught at another point of their idle animation. `createWorld` took a median of 1,805 ms before and 1,679 ms after over five fresh loads each in the container, so startup is unchanged within its noise.



`findPath` used to re-check every collider for each cell it visited, sort its open list on every step and stop after 5,000 steps. It now samples the 65 × 53 route grid's walkability once, on the first click (about 3,400 `blocked` calls), and searches with a binary heap and no step cap. From spawn in headless Chromium: a route to the far bank at (19, −2.5) took 3.2 ms before and 0.2 ms after, (−19, −15) took 10.7 ms and 0.3 ms, and an unreachable click behind the mill took 39 ms and 1.8 ms to give up. Routes are the same length. The six lanterns' `PointLight`s became a fixed pool of six (see the checklist); draw calls, triangles and shader programs at the default view and in first person are unchanged.

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

### Kitchen garden (2026-10-31)

The fenced kitchen garden moved into `src/garden.js` and gained mixed vegetables, a cutting border, a rose arch, a scarecrow and props. Plants share one vertex-coloured material and painted props another; timber reuses the village's wood, dark wood, trim and path materials, so the bake gains two batches. The garden's static geometry grew from about 6,000 to 33,000 triangles. Counts only, measured in a GPU-less container with SwiftShader at 1200 × 750, high quality, against `529e708`; frame times there are not meaningful.

| View                   | Draw calls before → after | Triangles before → after |
| ---------------------- | ------------------------- | ------------------------ |
| Default (spawn)        | 1,077 → 1,079             | 2.787M → 2.836M          |
| Garden framed, zoomed in | 515 → 517               | 1.975M → 2.025M          |
