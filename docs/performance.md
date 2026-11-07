# Rendering performance

Willowmere is GPU bound. JavaScript, including movement, collision, route finding and character animation, takes about 4 ms per frame; the rest of the frame is rasterization, and it scales with the drawing buffer's pixel count and with how many times the scene is submitted. This document records how each frame is built, where its time goes, how to measure a change, and what to keep in mind when adding scenery, lights or passes. [Water rendering](water.md) covers the water system's own costs.

## Frame anatomy

The outdoor view, in the order `animate()` in `src/main.js` runs it each frame:

1. **Simulation and bookkeeping (JavaScript, about 4 ms).** Input, player collision against `colliders`, `life.update` for residents, cats, puppy, birds and butterflies, `world.update` for the mill, reeds and water bookkeeping, planting growth, dusk blending, `playerVisibility`, `fitShadow`, the levels of detail by zoom or distance (`src/game/detail.js`: `trees.setDetail`, `bushes.setDetail`, first person's detail range through `world.setDetailFocus`, the overview's far-zoom detail through `world.setOverviewDetail` and `trees.setGroundDetail`), a 2.5 ms slice of streaming (`streamer.update`, until the open country is built), and `updateResolution`. The scene has `matrixWorldAutoUpdate` off, so `scene.updateMatrixWorld()` runs once here and every pass reuses the transforms. Nearby-interactable scanning runs every eighth frame.
2. **Water (`world.water.render`).** The GPU shallow-water simulation steps each visible pool in small ping-pong targets (a few draws). At most one pool whose reflection is overdue re-renders the mirrored scene, cropped to the pool's bounds on screen; tree leaves and shrubs are hidden for that capture. Refraction is not rendered here: the call arms a one-shot resolve for the main pass.
3. **Shadow pass.** The sun's shadow map (2048 on high in the overview, 4096 in first person) is rendered every frame over a frustum fitted to the receivers in view, depth only, drawing only the casters whose shadow can reach the view. Ground slabs, roads and the riverbed receive only.
4. **Main pass (`RenderPass`).** The opaque scene draws into a 4x multisampled 11-11-10 float target (`src/scene-target.js`). Water surfaces have the highest `renderOrder`; the first one blits the parts of the target's color and depth those surfaces can refract from into the refraction texture, then the surfaces and transparent objects draw on top. In first person the sky (`src/sky.js`) draws after the opaque scene and before the water, pinned to the far plane, so it shades only pixels nothing else covered. The overview never sees the horizon and skips it.
5. **Bloom and output.** `SoftBloomPass` runs entirely at quarter resolution or below, and `BloomOutputPass` adds it while tone mapping to the canvas. Nothing touches the multisampled target again at full resolution.

At the default view this is roughly 700 draw calls and 2.3–2.6 million submitted triangles per frame on high quality, spread over the shadow, reflection and main passes. First person from the green submits about 260 draws and 1.1 million triangles. The bakery interior has its own chain, described under [Bakery interior](#bakery-interior).

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

This table predates the [lantern range check and the compact scene target](#cheaper-fragments-and-a-compact-scene-target-2026-11-04) and the [depth-only shadow maps and cropped reflections](#depth-only-shadow-maps-and-cropped-reflections-2026-11-05), so its absolute times are high and its proportions are out of date. Rerun it before relying on a row. The [welded geometry entry](#welded-geometry-dark-lanterns-by-day-and-coarse-shrub-shadows-2026-11-06) has each part's share as of 2026-11-06: lighting first, then foliage, multisampling, shadows and water.

What this table says about the next change:

- **Multisampling is now the largest single GPU cost.** The village keeps 4x because 2x visibly steps roof edges and dashes shingle grooves at pixel ratios of 1 and 1.25 (see the antialiasing notes below). A cheaper edge treatment that preserves those grooves would be worth more than any other single pass.
- **Foliage is next.** The remaining detailed tree leaves are about 2 ms at the default view. The coarse level already applies when zoomed out or far away; a further level for the default view, or fewer leaves per tree, is the remaining lever.
- **The frame is no longer purely fill bound.** JavaScript plus draw submission is about 4–6 ms, against 7–9 ms of total frame time uncapped. From here, GPU-only savings return less, and submission cost (about 790 draws) and per-frame JavaScript matter as much. In the uncapped runs above, the measured callback time tracks the frame interval because the driver blocks on queued GPU work, so JavaScript cost can only be read from vsync-on runs.
- **Bloom is small.** It costs almost nothing at retina. Shadows and water were listed here as small too, and were not: see [the entry below](#depth-only-shadow-maps-and-cropped-reflections-2026-11-05). The shadow section explains why a static shadow cache does not pay.

Startup is not optimized and has no regression test: from navigation to the loading screen dismissing takes 1.1–1.6 s in headless Chrome on this machine (DOM content loaded at about 0.7 s), spent generating procedural textures, building and baking the village, and uploading about 53,000 leaf instances. The open country around the village is not part of that: it streams in over the following frames (see [Streaming and distance limits](#streaming-and-distance-limits-2026-10-31)). The production bundle is about 700 KB of Three.js (180 KB gzipped) plus about 400 KB (155 KB gzipped) of game code, split into village, world, interior and water-study chunks and one chunk per streamed region.

Not yet measured: mobile GPUs, Windows integrated graphics, Safari and Firefox, and thermal throttling over long sessions. The narrow-screen path starts on balanced and relies on the resolution scaler. Measure on those devices before tightening budgets or changing the presets.

## Measuring

Measure before and after every rendering change, on an idle machine, and compare differences rather than absolute times.

- **Standard benchmark.** Start `npm run dev`, then run `npm run benchmark -- label` in another terminal. Set `BENCHMARK_URL` if the server is on another port, for example `BENCHMARK_URL=http://127.0.0.1:5174 npm run benchmark -- after`. The script uses the same Chrome selection as the regression tests (`CHROME_PATH`, installed Chrome on macOS, or Playwright Chromium). It opens a fresh browser at 1600 × 1000 and device pixel ratio 1 with `?resolution=fixed`, enters the village, lets the view settle, and samples four seconds at each quality setting. It reports frame intervals, animation-callback CPU duration, draw calls, and submitted triangles, then saves the measurements in `output/performance-label.json`.
- **Retina and uncapped runs.** The standard benchmark runs at pixel ratio 1 with vsync, so it saturates at 60 FPS and never exercises the retina caps. For a change that affects fill rate, set `BENCHMARK_SCALE=2` for a device scale factor of 2 and `BENCHMARK_UNCAP=1` to launch Chrome with `--disable-frame-rate-limit --disable-gpu-vsync`. The script keeps `?resolution=fixed`, or the scaler would step down during the run. Headless Chrome paces uncapped frames unevenly, so compare means, not p95. `BENCHMARK_ROUNDS` interleaves several passes over every configuration so drift spreads across them.
- **Interior.** `node scripts/benchmark-interior.mjs label --ablate` measures the bakery at both device scales and can undo each optimization in turn through `window.__willowmere.tuneInterior`. See [Measure the interior](#measure-the-interior).
- **Outdoor ablation.** `BENCHMARK_SCALE=2 BENCHMARK_UNCAP=1 npm run benchmark -- label --ablate` reproduces the table above. After the three presets it runs high quality with one change at a time through `window.__willowmere.tune(settings)`: `samples` (MSAA on the composer's two targets), `foliage` (tree leaf and shrub instances hidden), `leafDetail` (forces `trees.setDetail` to a level), `pixelRatio` (forced, with the scaler standing aside), `water` (skips `world.water.render`), `shadowUpdate` (freezes the sun's shadow map), `bloom`, `sky` (hides the first-person sky), then all of shadows, water and bloom off, followed by the unchanged high preset in first person and at the zoomed-out view. The standard run also measures each region's viewpoint ("high, millpond", "high, orchard", "high, market", "high, marsh", and first person at the orchard, market and marsh), and `--ablate` adds each region at height 30. Each row reports the mean and p95 frame interval, draw calls and triangles. Pass `null` for a key to restore its default; `getDiagnostics().render` reports the effective state, including the number of drawn leaves. Normal play never calls `tune`, and `tests/tune.spec.js` checks that every override toggles and restores.
- **Deterministic counters.** `window.__willowmere.getDiagnostics()` reports `drawCalls`, `triangles`, `geometries`, `textures`, the `resolution` state and the sun's `shadow` bounds. Draw calls and triangles do not depend on machine load, so quote them alongside any timing; they are what the regression tests assert.
- **Contention.** Numbers taken while another browser, test run or benchmark is rendering are inflated and noisy. Several of the dated comparisons under [Change history](#change-history) were taken that way and say so; the table above was not.
- **What does not work here.** WebGL timer queries (`EXT_disjoint_timer_query_webgl2`) return elapsed times longer than the frame because Apple's tile-based GPU overlaps passes, so they cannot isolate a pass. Updating shadows on alternate frames raises p95 frame time through uneven workload. FPS from any single machine does not transfer; re-run on the target device, especially at higher device pixel ratios.

## Checklist for changes

Each item names the mechanism in the code that a new change has to work with.

- **Static scenery.** Add plain meshes under `createWorld`; the bake (`bakeScenery` in `src/bake.js`, called at the end of `createWorld`) merges them into one draw per chunk, material and shadow role, and removes the originals. Chunks are 16 × 14 m (`WORLD.chunk` in `src/world-layout.js`; the village is the 3 × 3 around the origin), and each batch's bounds hug its chunk, so the main, shadow and reflection passes cull chunks out of view. A chunk's share of a material under 4,000 triangles (`MIN_BATCH_TRIANGLES`) joins the same material's batch in a neighbouring chunk rather than drawing alone. Plain `MeshStandardMaterial`s (no maps, no emissive, no shader hooks, opaque) that differ only in colour are baked onto one vertex-coloured material per finish, so a new colour costs no extra draw. Animated or later-modified objects must set `userData.dynamic = true` or they are frozen into the bake. Transparent materials are not merged. Give flat receivers (ground, roads, beds) `castShadow = false`; the bake honors per-mesh flags. After the bake, `createWorld` welds every non-indexed mesh geometry in the scene (`weldVertices` in `src/geometry-weld.js`), and `world.addStreamed` does the same for a streamed mesh, so making parts non-indexed to merge them costs nothing at draw time. Welded geometry is indexed: code that edits a mesh's vertices after it is built must not assume three vertices per triangle. Seat new placements on `terrainHeight(x, z)` from `src/world-layout.js`; the village is flat, and regions bring their own heights as data (the millpond's banks, the orchard hill).
- **Beyond the village.** The village builds before the loading screen lifts; everything outside it streams in afterwards, as region jobs (the contract is in [the code map](architecture.md#regions)). The streamer in `src/streaming.js` runs the job nearest the player for 2.5 ms of each frame, compiles each finished object's materials with `renderer.compileAsync` and only then adds it to the scene, so a streamed piece never stalls a frame on its first draw. Streamed pieces do not go through the static bake, so build them already merged: one mesh per chunk and material, or one instanced mesh per chunk; the parts kit in `src/regions/kit.js` does this for structures, and its `splitByChunk` splits a region's scattered instances. One mesh across a whole region has a bounding sphere that reaches into the village's views, which then draw it unseen. Register them with `world.addStreamed(mesh, { detail })` so they join their chunk, and seed new chunks with `chunkRandom(cx, cz)`, never the village's legacy random stream. Trees in a region share the village trees' resources through `world.trees`: `materials.wood` (bark), `materials.crown` (distant crowns) and `blades` (the two leaf blades). Leaves on raised ground take `materials.grounded(shake)`, whose wind counts shelter from a per-instance `groundLift` attribute (the ground's height under the tree) rather than from y = 0; register them with `world.trees.adopt()` so they follow the zoom and distance levels of detail. `src/regions/orchard.js` does both.
- **Materials.** Reuse shared materials; every distinct textured, emissive or customised material is at least one extra draw per chunk and pass. Avoid cloning materials per object. Materials with emissive color are registered with their chunk (`chunk.glow`) at bake time and collected into `glowMaterials` for the dusk glow, so a new lantern's glass needs no extra code.
- **Animation.** Register a moving object with `animate(x, z, update)` (the village's kit, or `world.animate` for a streamed region); it runs only while its chunk is inside the view or the sun's shadow frustum. Make it a function of the time or of the world's `clock` argument (which pauses with reduced motion), not of accumulated `dt`, so a paused chunk resumes in step. Use the global `animated` list only for map-wide effects such as wind.
- **Dense instanced detail.** The bake splits every instanced mesh outside the trees into per-chunk meshes, clustering sparse chunks to the same 4,000-triangle minimum. Keep `matrixAutoUpdate = false` and tight bounding spheres so each part culls as a unit. First person hides grass, blossoms, pebbles and bank tufts whose parts lie wholly beyond 30 m (`DETAIL_RANGE` in `src/bake.js`); add new small detail to `DETAIL_NAMES`, or stream it with `addStreamed(mesh, { detail: true })`. The overview zoomed out to height 30 or more (past `FAR_DETAIL_VIEW_HEIGHT`, 27, in `src/game/detail.js`) also hides the pebbles and tufts (`FAR_HIDDEN`) and the litter and moss at the trees' feet, and drops the shadows of thin casters (`FINE_CASTERS`: reeds, cattails, shrub stems and blossoms; streamed ones join through `addStreamed`) and of the people and animals; grass and blossoms stay, because their speckle is the meadow's texture from above. Name new thin casters so they match `FINE_CASTERS`, or stream them with `addStreamed(mesh, { fineShadow: true })`; `addStreamed(mesh, { far: true })` hides a streamed mesh there. Register it with `water.excludeFromCaptures()` unless it must appear in reflections. Prefer `FrontSide` with `shadowSide: DoubleSide` for thin blades. If it covers few pixels at the default view, give it a coarse level like `trees.setDetail()`.
- **People.** A new person is a look on the shared figure (see [the code map](architecture.md#the-world)), not new geometry. Give a small part the smallest shape that holds up (`bead`, 36 triangles, then `soft`, `ball`), and leave a joint out unless it moves: `walks` costs about ten more batches per pass. A new colour costs nothing, since colours bake into vertex colours. Keep a standing figure under 10,500 triangles (`tests/people.spec.js`).
- **Lights.** Each shadow-casting light renders the scene again every frame. The village has one; the bakery caches its two because they never move. Directional and spot lights' maps are depth textures read through a comparison sampler (`src/shadow-maps.js`, `src/shader-chunks.js`), so any page importing `shader-chunks.js` must call `useDepthShadowMaps(renderer)`, and only `PCFSoftShadowMap` is supported. A moving caster needs an accurate bounding sphere, since the sun's map skips a caster whose sphere, swept away from the sun, misses the view (`src/game/caster-reach.js`). A new shadow caster outdoors needs the same fitting and caching argument as `fitShadow()`, or a measured budget. Point lights are a fixed pool: every lit material is compiled for the scene's point-light count, so adding or removing one recompiles every program on the main thread. Each one is evaluated in every lit fragment within its `distance` (`src/shader-chunks.js`), so give a new one the shortest `distance` that looks right: one with none is evaluated everywhere. Add a lantern with `lamp(x, z)` in `src/world.js`, never a new `PointLight`; `placeLanterns` moves the `LANTERN_LIGHTS` pool (six, one per current lamp) to the lamps nearest the view each frame. Raise the pool only with a measured budget. Even out of reach, the pool's lights cost about 6% of the village's frame in the loop itself, so by day `lightLanterns` (`src/village/lamps.js`) gives them no intensity and a negative distance, and `src/shader-chunks.js` skips every point light in one branch when the first has a negative distance; no program recompiles at dusk. A point light outdoors outside that pool would be skipped with it.
- **Post-processing.** Do not add a full-resolution pass that reads or writes the multisampled scene target. Follow `src/bloom.js`: work at quarter resolution and composite in the output pass. A new composer's scene target takes `sceneTargetOptions` from `src/scene-target.js`; its depth does not survive the pass, and its colour has no alpha.
- **Water.** Read [docs/water.md](water.md) first. Each pool adds simulation targets and a reflection capture at the quality's interval; refraction comes from the main pass and costs a blit, not a render.
- **Resolution.** Never call `renderer.setPixelRatio` directly outdoors. Go through `QUALITY_PIXEL_RATIO`, `resetResolution` and the scaler, and keep `?resolution=fixed` working for the benchmark and tests. The bakery applies its quality's cap on entry and restores the scaler's ratio on exit.
- **Per-frame JavaScript.** No allocations, `scene.traverse`, or material changes inside `animate()`. Precompute at build time; throttle scans the way `scanNearby` runs every eighth frame.
- **Verify and record.** Run the standard benchmark and a retina run before and after, quote draw calls and triangles, update the budgets in `tests/performance.spec.js`, `tests/trees.spec.js`, `tests/shadows.spec.js` and `tests/interior.spec.js` only when the new work is intended, and add the result to [Change history](#change-history).

## Work reduction in the current build

- Character parts with the same roughness and shadow settings are baked together within each rigid joint. Colors become vertex colors. The village's inhabitants and wildlife use 149 meshes and about 73,000 triangles, and a resident from a region batches the same way. Someone who stands is five batches and a contact shadow (body, head, eyes and two arms); only the traveler and Lily keep hips, knees and elbows. Arms, legs, ears, paws, tails, scarf, and leash anchors retain their original transforms.
- Wildflower and planted bouquets share three baked geometries and materials. Each bouquet needs three draws instead of 35, plus a shared halo for gatherable flowers. Planting does not allocate another set of petal geometry.
- Doorstep pots, window boxes and the beds along house walls come from `src/planters.js`. Every leaf, petal, pot and edging stone carries a vertex color and shares one material, so all of the village's planting bakes into a single draw per pass (about 69,000 triangles for four houses, roughly 17,000 per house). It replaced about 57,000 triangles of flat-colored sphere clumps spread over several materials, and the scene now submits about 14 fewer draws per frame for about 12,000 more static triangles. Leaf normals bend toward each clump's center and colors darken toward its base, which shades a mound as one rounded plant at no runtime cost. New buildings should add a scheme to `plantings` in `src/world.js` rather than new materials.
- Each tree retains separate bark, detail, leaf, and litter bounds. Materials, leaf geometry, textures, and wind uniforms are shared. Offscreen trees can be rejected independently in the main camera, shadows, and water reflections.
- Tree leaves and shrub pockets are left out of water reflection captures, and out of the separate refraction capture used when the main pass cannot supply refraction, through `water.excludeFromCaptures()`. They still cast shadows and appear in the main view, which also supplies refraction. The pools do not resolve individual leaves, and the reflections barely change. Trunks and branches still reflect.
- Each tree's leaves are ordered so that even-numbered leaves come first. `trees.setDetail()` can draw only that half, using a broader 4-triangle diamond blade with the same fold instead of the 8-triangle detailed blade, so canopy coverage and wind motion stay similar. The village switches every tree to this coarse level above an orthographic view height of 24 (the default is 18). In first person, it switches trees whose canopy center is more than 18 m from the eye. Canopy bounds for player visibility are unchanged, and leaf culling spheres enclose both blades.
- In first person, trees whose canopy centre is more than 40 m from the eye (`CROWN_DISTANCE`, deep in the fog) draw their crown instead of their leaves: one lumpy shell per leaf cluster, merged per tree (about 1,300 triangles against about 19,000 for a village tree's coarse leaves), in a shared vertex-coloured material that casts ordinary shadows. The tree's litter and foot details hide with its leaves at that distance. The overview never uses crowns. Crowns live in their own group (`trees.crowns`), beside each tree's four batches, and are left out of water captures.
- Shrub leaves have a coarse level too: `bushes.setDetail()` swaps each chunk's leaves to a two-triangle leaf folded along the midrib (a third of the folded leaf's six), at the same levels as the trees' coarse leaves (overview above height 24, first person beyond 18 m). Every leaf still draws, so crowns keep their fullness; at height 39 this takes the shrubs from about 364,000 to 121,000 triangles per frame across the main and shadow passes.
- Shrub leaves are single-sided. Each blade turns its upper face away from its crown's center, so the side facing the viewer stays as full as before. Their material casts shadows from both faces. Shrub leaves cost less than 1 ms per frame in total, so they keep their own shadows instead of using proxy volumes, which would darken each crown's interior.
- Orthographic water reflections crop the mirrored camera to the pool's projected bounds, with a margin for displaced waves and normal distortion. Capture textures follow the visible footprint, rounded to 64-pixel increments and capped by the chosen quality. The reflection matrix and distortion scale preserve texture projection. Perspective views, first person's included, draw only the part of a full-size target that the surface's bounds cover ([water](water.md)).
- The village and bakery update scene transforms once before their rendering passes. The water system respects manually updated scenes and temporarily suppresses repeated automatic updates during its own captures. The bakery's costs are described under [Bakery interior](#bakery-interior).
- Water refraction reuses the main scene pass instead of rendering the scene a second time. Water surfaces draw last among opaque objects; the first one resolves the composer's multisampled color and depth into the refraction texture with a single blit. See [docs/water.md](water.md#refraction-from-the-main-pass).
- The sun's shadow map covers only the receivers the overview can see. See [Outdoor shadows](#outdoor-shadows).
- Shadow maps are depth textures with no colour attachment, so a frame stores half the bytes (none of a 4096 map's 64 MB of packed colour) and the depth program's fragment shader does no work. `PCFSoftShadowMap`'s sixteen fetches and unpacks per lit fragment become four bilinear fetches of a comparison sampler, placed so they weigh the same sixteen texels the same way.
- The sun's map draws a caster only if its bounding sphere, swept away from the sun to the lowest receiver, enters the view. First person's map covers a village-sized box whichever way the eye looks, so this leaves out about half of what it drew. The test uses a wedge of ground in first person and the sides and bottom of the screen in the overview, and never the top or a tilted plane, because a water reflection can see more of those.
- The final canvas does not request a second multisampled framebuffer or a depth buffer, or preserve its drawing buffer. The composer's multisampled scene target still supplies antialiasing. The starting quality and resolution policy are described under [Resolution and default quality](#resolution-and-default-quality).
- The village scene target keeps 4x MSAA at every quality. Every quality now caps the pixel ratio at 1.25 or below. At ratios of 1 and 1.25, 2x visibly steps roof edges and the fountain rims and breaks roof shingle grooves into dashes. Without MSAA, the grooves dash even at a pixel ratio of 1.75, and FXAA erases them. At a ratio of 1.75, 2x came close to 4x.
- Three evaluates every point light's BRDF in every lit fragment, although the light's window function is exactly zero past its `distance`. `src/shader-chunks.js` patches the lighting chunks to skip a light out of range, shadow included, so a lit fragment far from the lanterns no longer pays for all six.
- By day the lanterns are dark and lit fragments skip the point-light loop altogether (`lightLanterns`; see the checklist's lights). Their daytime intensity of 0.1 lit only the lamp's own hood and a hat beneath it, by a few levels.
- Merged geometry is welded (`src/geometry-weld.js`): vertices that are copies of one another, which `toNonIndexed` makes of every shared corner so parts can merge, become one indexed vertex. The village's meshes go from 1.31M to 0.54M vertices, or from 2.80M to 1.77M counting each instance, and every pass that draws them shades that many fewer. The same triangles draw from the same values.
- The sun's map draws shrubs with their two-triangle leaf whatever level the view uses (`bushes.shadowLevel`, run around each shadow update through `around` in `src/shadow-maps.js`). Every leaf still casts, so the shadow keeps its outline and density.
- The scene target (`sceneTargetOptions` in `src/scene-target.js`) is 11-11-10 float where the GPU can multisample it at the sample count needed, and otherwise RGBA16F, so each sample takes half the memory and half the resolve. `getDiagnostics().render.format` reports which. It does not resolve depth at the end of the pass, which nothing reads, and water's refraction texture takes the same colour format. `BloomOutputPass` does not swap the composer's buffers, so the second multisampled target is never allocated.
- Water resolves refraction only over the visible surfaces' bounds on screen, per body, joined where that costs no more (`src/water-bounds.js`). `diagnostics().refractionResolved` reports the share of the screen: about half at the default view, 25% from the bridge in first person, and 76% over the marsh.
- Village bloom (`src/bloom.js`) runs every pass at quarter resolution or below: a thresholded downsample, five blurred levels, and a composite. `BloomOutputPass` adds the result while tone mapping. UnrealBloomPass blended its result back into the full-resolution multisampled scene target and composited at half resolution. The strength, radius, and threshold keep their UnrealBloomPass meaning, including that pass's alpha-weighted blend. On a synthetic HDR frame at 2800 × 1750, the total added light differs by 6%. Around lights 40 pixels and larger, the radial falloff agrees within 15%. A 4-pixel point light gets a slightly softer core. Performance quality still disables bloom. The bakery interior uses the same pass.

## Resolution and default quality

The outdoor view submits the scene about three times per frame: shadows, a water reflection at a limited interval, and the multisampled main pass plus bloom. The main pass also supplies water refraction. Most passes fill the full drawing buffer, so frame time follows pixel count more than JavaScript work, which takes 4–5 ms per frame.

- **Pixel ratio caps.** High and balanced render at `min(devicePixelRatio, 1.25)`; performance renders at `min(devicePixelRatio, 1)`. High previously used 1.75, which gives a 2800 × 1750 buffer on a 1600 × 1000 retina window. The caps are defined in `QUALITY_PIXEL_RATIO` in `src/main.js`. The bakery renders at its quality's cap; see [Bakery interior](#bakery-interior).
- **Starting quality.** Screens narrower than 760 CSS pixels, or with more than 2.6 million native pixels (`innerWidth × innerHeight × devicePixelRatio²`), start on balanced. Other screens start on high. Under this rule, retina laptops and 1440p monitors start on balanced. 1x screens up to about 1920 × 1200, and small windows on dense screens, start on high. Changing the setting overrides the default for the session.
- **Dynamic resolution.** The scaler in `src/game/resolution.js` collects outdoor frame intervals in one-second windows. It starts 3 seconds after load and skips the bakery and hidden tabs. A window whose p95 exceeds 20 ms lowers the pixel ratio by 0.125, down to 0.75. Five consecutive windows with a p95 under 18 ms raise it by one step, up to the chosen quality's cap. When a window is slow within 10 seconds of a step up, the required run doubles, up to 60 windows. A single step down is not judged, because vsync can keep frames at 33 ms until the GPU fits within one refresh. If the mean frame time is no better once the floor is reached, the scaler concludes that something other than fill rate sets the pace (for example a 30 Hz cap or a busy CPU). It restores the cap and pauses for 30 seconds, doubling the pause on each later failed descent up to 5 minutes. Changing quality resets the ratio to the new cap.
- **Opting out.** Add `?resolution=fixed` to the URL, or call `window.__willowmere.setAdaptiveResolution(false)`, to keep each quality at its cap. `npm run benchmark` uses the query parameter. `getDiagnostics().resolution` reports `adaptive`, `pixelRatio`, `ceiling`, `floor`, the last window's `p95` and `mean`, `upWindows`, and `drawingBuffer`.

## Outdoor shadows

The measurements in this section predate the resolution, bloom, refraction, and foliage changes above. They used the baseline `1a2624c` and high quality at pixel ratio 1.75, and the caster counts are from before shrub leaves became single-sided and distant tree leaves became coarse.

One sun casts the village's shadows. Its direction never changes, so `fit()` in `src/game/shadows.js` reshapes only its orthographic shadow camera:

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
- **Shadow map sizes.** The sun's map is 2048 on high and 1024 on balanced and performance (formerly 4096 and 2048). The window light keeps its 1024 map. With the maps cached, size changes rendering time very little (4096 measured about 0.3 ms slower). A 4096 map takes about 64 MB of GPU memory, depth alone; a 2048 map takes a quarter of that.
- **MSAA by quality.** High keeps 4x MSAA. Balanced and performance use 2x. At a pixel ratio of 1.25, 2x makes the chair's curved back and the round window's diagonals step a little when zoomed in; otherwise the frames match.
- **Bloom.** The interior uses the village's quarter-resolution `SoftBloomPass` and `BloomOutputPass` with its own settings (strength 0.13, radius 0.4, threshold 1.3). Performance quality still disables bloom and ambient occlusion.
- **Pixel ratio.** The outdoor resolution scaler does not measure the bakery. On entry the village applies the quality's full ratio (1.25 on high and balanced, 1 on performance, never above the device ratio). On exit it restores the ratio the scaler had reached outdoors. Without this, a visit after a slow stretch outdoors stayed at whatever lower ratio the scaler had reached, as low as 0.75.

`window.__willowmere.getInterior().render` reports the composer's pixel ratio, target size, MSAA samples, the AO target width and kernel size, whether bloom is on, the sun's shadow map size, and whether the shadow maps update every frame. `window.__willowmere.tuneInterior(settings)` overrides these for measurements: `ao`, `bloom`, `samples`, `sunShadow`, `windowShadow`, `aoScale`, `aoSamples`, `pixelRatio`, and `shadowRefresh` (seconds between map refreshes; 0 renders both every frame). Pass `null` to restore a default. Normal play never calls it.

### Measure the interior

Start `npm run dev`, then run:

```sh
BENCHMARK_URL=http://127.0.0.1:5173 node scripts/benchmark-interior.mjs label --ablate
```

The script opens `/?interior=bakery&resolution=fixed` at 1600 × 1000 CSS pixels, at device scale 1 and then 2 (`BENCHMARK_SCALES` overrides this). `BENCHMARK_ROOM` picks another room (`rosewood`, `heron`, `windmill`, `post-office`, `thistledown` or `copper-kettle`), and `BENCHMARK_POSE` stands the visitor somewhere other than the door, as JSON for `placeInterior`. Chrome is launched with `--disable-frame-rate-limit --disable-gpu-vsync`, so frame intervals show throughput above 60 FPS. The view stays at the entrance, facing the counter and the room. Each configuration settles for 0.8 seconds and records 2 seconds. Four rounds (`BENCHMARK_ROUNDS`) cycle through all configurations, so drift is spread across them. It reports the mean and p95 frame interval, callback CPU time, draw calls, and triangles, and saves `output/interior-label.json`. `--ablate` adds rows on high that undo one optimization or change or remove one feature. Revisions without `tuneInterior` can still run the three presets. `BENCHMARK_ROOM` measures another room, and `BENCHMARK_POSE` stands the visitor somewhere other than the door, as JSON for `placeInterior`.

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

### Rosewood interior

Rosewood (`src/rosewood.js`) goes through the same chain and settings as the bakery. Its two shadow casters, the sun over the back garden and the spot light through the living room's front window, render once when the room opens and after a resize or quality change: the room sets `staticShadows`, so the interior never refreshes them on a timer. Everything that moves (Bark, the ball, the fish, the record, the clock's pendulum and the washing) casts no shadow into those maps, so nothing is left behind where it stood; Bark carries a soft blob shadow instead. The fire, the kitchen pendant and the bedside lamp are its three point lights, fixed for the visit, so dusk changes their intensity and compiles nothing. Bark is one merged vertex-coloured figure per moving part, sharing one material.

Counted in the cloud container (SwiftShader, 1000 × 625 CSS pixels, high): 299 draws and about 0.4M triangles at the front door looking down the hall, 196 draws and 0.29M in the living room by the aquarium, 344 draws and 0.51M from the kitchen looking out into the garden, and 91 draws by Bark's kennel. The bakery's entrance view is 285. Its exterior adds the kitchen extension and the back garden to the village: behind Rosewood at height 18, 813 draws and 2.47M triangles against `main`'s 792 and 2.50M (the meadow grass under the extension and patio is cleared). The bakery itself is unchanged by sharing its helpers (`src/interior-kit.js`): 275 draws and 1,161,370 triangles before and after at the same view.

### The post office

The post office (`src/post-office/`) goes through the same chain and settings. It is the most thickly dressed room and the cheapest to draw, because its small parts were built to be cheap: 2,512 meshes bake down to 150 and about 208,000 triangles, which the colour and occlusion passes each draw once.

- **Sharp boxes.** A rounded box with the kit's default radius is 300 triangles, and with its smallest radius 108. Letters, drawers, doors, parcels and shelves are plain 12-triangle boxes (`b` in `parts.js`). Rounded edges are kept for what the eye runs along: the counter's top, the rails and the armchair.
- **One atlas for all the lettering.** Each kit `plaque` is a 1024 px canvas and a material of its own, and so at least a draw per pass. Signs, notices, labels, stamps and postcards share one 2048 sheet instead, on planes that bake into one mesh. The map has its own 1040 × 860 sheet, since it is too large to share.
- **Moving parts merged.** The bake leaves moving groups alone, so `mergeGroup` merges each one by material first. The postcard rack alone would otherwise be about 100 draws per pass.
- **One shadow map, kept.** The sun is the only shadow caster. Everything that moves stays out of its map, so the room sets `staticShadows` and draws it once on opening and after a resize or quality change. The five pendants, the stove and the two window fills are its eight point lights, fixed for the visit, each with a short `distance`, so evening changes their intensity and compiles nothing.
- **Glass in one sheet.** Every window's pane and the door's are merged into one transparent mesh, and the jars' shells into another, because transparent meshes do not bake.

### Thistledown interior

Thistledown (`src/thistledown/room.js`) goes through the same chain and settings as the other rooms, and is the largest of them: two floors, eight furnished rooms and a garden. The sun is its only shadow caster, rendered once when the room opens and after a resize or quality change (`staticShadows`), and nothing that moves casts into it. Three things keep it cheap:

- **Rooms draw only from where they can be seen.** Each furnished room is its own merged group, and `SEEN_FROM` in `layout.js` lists which others show through its doors, hatch and stairwell. Each floor's walls hide the same way. The frame the sun's map renders, everything is shown so all of it casts: `room.update` checks `sun.shadow.needsUpdate`. A new doorway or sight line has to be added to that list, or a room pops in as you reach it.
- **Flat colours share materials.** `paintFlat` in `src/interior-kit.js` folds every flat-coloured mesh into one vertex-coloured material per finish, so its hundreds of colours bake into a handful of draws. Every small picture, label and notice is a rectangle of one 2048 px sheet (`createSheet`), and `fuse` in `parts.js` makes each moving figure a single draw.
- **The lamps are a fixed pool of seven.** The hall, back hall and landing lights stay put; the other four move between floors at the stair's halfway point, dimmed there, so neither the hour nor the floor compiles a program.

`node scripts/benchmark-interior.mjs <label>` measures it with `BENCHMARK_ROOM=thistledown`. Counted on high at 1280 × 800 CSS pixels: 398 draws and 0.45M triangles at the front door looking down the hall, its costliest view; 184 to 233 draws in the breakfast room, kitchen and sitting room; 315 on the stairs; 122 to 271 upstairs.

## Regression budgets

These tests assert rendering work and behaviour instead of a machine-dependent FPS threshold. The village diagnostics expose `drawCalls`, `triangles`, `geometries`, `textures`, and `shadow` (`mapSize` and light-space `bounds`); water diagnostics include each pool's `reflectionSize`.

- **Draw budgets.** `tests/performance.spec.js` holds the village with live water and 30 planted bouquets under 1,600 draws, 3.2M triangles and 320 geometries. With every region streamed in, it holds the green and the inside of the village's edge facing each region under the same draws and triangles: a region's scenery, water and shadows add to the village's views there, which the regions' own viewpoints never see. It holds each region's benchmark viewpoint under 1,000 draws and 2.5M triangles at height 18: the millpond's south bank (8.6, −25.8), the orchard's bench, the market square (36.5, 3.2), the marsh's boardwalk (7.8, 31.2), the old wood's clearing (−35.5, 0), the allotments' cross path (−6.5, 28.6), with every bed growing, and the stone quarry's floor (−34, 34), the last five also at height 30. It holds the village zoomed out to the cap of 39, with every region in, under 1,100 draws and 2.65M triangles, with the far detail hidden there and back at height 27. Its `@logic` tests check that character batches keep their detailed geometry and moving joints, and that flower bouquets share bounded resources and grow independently. `tests/people.spec.js` (`@logic`) holds every standing resident to six meshes wherever they come from, and each one's far copy to two meshes with no shadow, about two-fifths of the triangles and the same height.
- **Zoom detail.** `tests/detail.spec.js` (`@logic`) checks that zooming out only ever coarsens the overview, that the default view keeps its ground detail, that coarse shrub leaves keep every leaf and its outline, and that shrubs cast with their coarse leaves while the view keeps its own level.
- **Welding.** `tests/geometry-weld.spec.js` (`@logic`) checks that welding draws every triangle corner with the same values, merges only copies, remaps an existing index and leaves geometry with nothing to share alone.
- **Measurement hooks.** `tests/tune.spec.js` checks that each outdoor `tune` override takes effect in the diagnostics and the submitted work, that `null` restores every default, and that the quality presets still apply their own settings afterwards.
- **Trees.** `tests/trees.spec.js` checks independent culling, shared wind materials, and that coarse leaf detail halves the drawn leaves without changing canopy bounds. `tests/orchard.spec.js` checks that in first person trees beyond 40 m draw crowns that cast shadows while nearer ones keep their leaves, and that the overview gives every tree its leaves back.
- **Water.** `tests/water.spec.js` covers small fountain capture allocations, refraction resolved from the village's main pass over part of the screen, excluded scenery staying out of captures, first person's reflections drawing only part of their target, and restoration of both automatic and manual scene-transform policies. `tests/water-bounds.spec.js` (`@logic`) checks that a surface's bounds cover everything a camera can see of it, including a long pool running behind the eye.
- **Resolution.** `tests/resolution.spec.js` covers the starting quality on 1x and 2x screens, the pixel ratio caps, and the scaler's step down and backoff, using synthetic frame timestamps; its `@logic` tests drive `src/game/resolution.js` directly with recorded intervals.
- **Shadows.** `tests/shadows.spec.js` checks that the sun's shadow bounds keep their size and move in whole texels while the player walks, shrink when zoomed in, grow when zoomed out, and switch to the finer first-person map over a village-sized box that keeps its size and moves in whole texels while the view turns. `tests/shadow-maps.spec.js` checks with a small fixture that a directional and a spot light's depth-only maps still cast soft-edged shadows with no GL error and survive a resize and a lost context, that the game's sun map is depth only, and that first person at the spawn stays under 400 draws. `tests/caster-reach.spec.js` (`@logic`) checks which casters count as reaching the view.
- **Chunks.** `tests/chunks.spec.js` checks that the village bakes into its nine chunks with each batch near its chunk, that grass, blossoms and shrubs split per chunk, that glowing materials are registered, and that a chunk out of view and out of the sun's shadow pauses its animations and resumes when it returns.
- **Streaming.** `tests/streaming.spec.js` checks that the open country's 16 grass patches and the route grid stream in after startup, that first person's fog closes before its 72 m far plane, and that neither the streaming nor a walk from the green across two chunk borders into the fields at the zoom cap ever misses two display refreshes in a row (a gap of 45 ms or more between animation frames; a single missed refresh at 33 ms is load, not a stall). The first zoom-out after starting is left out of that timing: it has stalled for 50–70 ms once since before the map grew. The test skips itself where the median frame takes over 20 ms, as with software WebGL in cloud containers.
- **Lanterns.** `tests/routing.spec.js` checks that the lanterns keep a fixed pool of point lights, dark by day and lit at dusk, with no new shader programs at dusk, and that a lantern still lights the ground in its reach at blue hour against the same ground by day, which is what a wrong range check would break.
- **Bakery.** `tests/interior.spec.js` checks that the bakery's shadow maps stay cached, that its AO runs at half the scene target's width, the MSAA and sun-map size for each quality, and median draw budgets of under 330 on high and under 180 on performance.
- **Rosewood.** `tests/rosewood.spec.js` checks that Rosewood's shadow maps stay cached with a 2048 sun map on high, and median draws at the front door under 400 on high and under 250 on performance.
- **The post office.** `tests/post-office.spec.js` holds the views from the door, the hall's far end and the back room to a median under 360 draws and 0.6M triangles on high, with its shadow map cached, and the door's view under 220 draws on performance.
- **The Drowsy Heron.** `tests/pub.spec.js` holds each of the study's views under 450 draws and 1.8M triangles and checks that blue hour compiles no new program. In the game it holds the inn's forecourt under 1,000 draws and 2.5M triangles at the default height and zoomed out, and its room at a median under 420 draws with its shadow maps cached.
- **The old windmill.** `tests/windmill.spec.js` holds the room at a median under 120 draws and under 0.6M triangles looking up the well and out of the top window, and checks that its sun map stays cached and that evening compiles no new program.
- **Thistledown.** `tests/thistledown.spec.js` holds its front door at a median under 420 draws and 0.5M triangles on high and under 250 draws on performance, with its shadow maps cached and a 2048 sun map on high, and checks that a room out of sight stops drawing.

## Change history

Measurements recorded as each change landed, newest first, each against the `main` it was merged into. Several were taken while other benchmarks shared the GPU and say so; use them for the shape of each change and for its draw and triangle deltas, and use [Where the time goes](#where-the-time-goes-2026-10-30) for the combined baseline. Entries counted in the cloud container ran on SwiftShader, so they give draw calls and triangles but no timings.

### Stone quarry (2026-11-07)

South of the old wood and west of the allotments, in the map's south-west corner: a ridge with two lifts of bedded stone cut into it, its floor, a derrick crane, the mason's lean-to and banker, stacks of dressed blocks, a spoil heap, a stone cart, gorse, a cart track to the allotments' west gate and a footpath to the wood's south trail, and Agnes, the mason, who lends the player a hammer for fossil hunting. The layout, terrain, colliders and grass mask load with the village from `src/regions/quarry-layout.js`; seven jobs stream in from `src/regions/quarry.js` (the ground, the faces, the paths, the works, the rubble, the gorse and Agnes). Nothing there goes into the water's captures.

- **Draws.** About 29,000 triangles in ten meshes: the ground (6,000) on the fields' grass material; the faces (2,200: a backing and blocks of stone, with ivy and moss), the works (5,500) and the gorse (5,800), each one vertex-coloured mesh; the derrick's load, which sways, and the lantern's glass; and the rubble's 450 stones (9,000), one instanced mesh per chunk. `splitByChunk` (`src/regions/kit.js`) now takes `least`: a chunk with fewer instances joins the part nearest it, which saved the rubble a fourth draw for two stones. It adds no texture and no new shader program. The lantern joins the lamps' light pool through `world.addLamps`.
- **Zoom cap.** Zoomed far out the rubble hides (`far`) and the works, faces and gorse drop their shadows (`fineShadow`). The spoil heap is a mound of painted blocks in the works mesh, so it still reads as rubble there.
- **The village.** The quarry stays out of the village scatter's colliders; `node scripts/world-fingerprint.mjs` matches `main`'s scene except the open country's grass, which gains the quarry's cut-out.

Counted on an M-series Mac in headless Chrome at 1600 × 1000, high quality, `?resolution=fixed`, with the whole map streamed in, against `main` (`08accfe`). Each cell is the most over 24 frames; the brackets give the fewest, where a frame without a water reflection differs.

| View | `main` draws / triangles | Stone quarry draws / triangles |
| --- | --- | --- |
| Village spawn (−2.8, 6.2), height 18 | 882 (707) / 2.739M | 882 (707) / 2.739M |
| Village spawn, height 39 | 1,066 (796) / 2.626M | 1,069 (799) / 2.633M |
| Village's south-west corner (−21, 18), height 18 | 355 / 1.601M | 356 / 1.581M |
| Allotments' cross path (−6.5, 28.6), height 18 | 475 (453) / 1.932M | 479 (457) / 1.946M |
| Quarry floor (−34, 34), height 18 | 143 / 0.494M (empty field) | 168 / 0.551M |
| Quarry floor, height 30 | 222 (184) / 0.845M | 235 (197) / 0.906M |
| First person on the quarry floor, facing the faces | 84 / 0.273M | 97 / 0.314M |
| First person at the allotments' west gate (−24, 28.6), facing west | 63 / 0.188M | 88 / 0.245M |

`tests/performance.spec.js` holds the quarry floor under 1,000 draws and 2.5M triangles at heights 18 and 30, and the village's south-west corner (−21, 18) with the other edges. The village zoomed out to the cap keeps 17,000 triangles of room under its 2.65M. `npm run benchmark` measures the quarry as "high, quarry" and "high, quarry, first person"; `--ablate` adds it at height 30.

### The doe and fawn (2026-11-07)

Two roaming deer (`src/deer.js`, rules in `src/game/deer.js`). Each is one `SkinnedMesh`, about forty painted parts bound rigidly to fifteen bones, so in view an animal costs one draw, one sun-shadow draw and a transparent contact shadow, and out of view nothing: the doe is about 6,300 triangles and the fawn 8,800. Their bounding spheres are computed once in the rest pose and grown by a third, which holds a lowered head or a bound. They join through the streamer, so the skinned programs compile before their first draw, drop their cast shadows zoomed far out like the people and animals, and stay out of the water's captures. Their rules run every frame in well under 0.01 ms; a hop's decision tests up to sixteen candidate segments against colliders filed in 4 m cells, at most about 0.4 ms in Node. Every budget in `tests/performance.spec.js` passed on the Mac unchanged.

### Welded geometry, dark lanterns by day and coarse shrub shadows (2026-11-06)

A hunt for 25%. Each part of the frame was priced alone in one page, in alternating windows so drift cancels (−35% means the frame took 35% less time without it), on high at device scale 2 against `main` (`26bab6c`):

| Removed | Spawn | First person | Zoomed out | Market, first person |
| --- | --- | --- | --- | --- |
| All lighting (every lit material drawn unlit) | −35% | −27% | −38% | −34% |
| Foliage | −27% | −19% | −18% | −13% |
| MSAA | −20% | −17% | −19% | −16% |
| Shadow map updates | −17% | −11% | −10% | −14% |
| Water surfaces (and so their refraction copy) | −12% | | −15% | −13% |
| Pixel ratio 1.25 → 1 (36% fewer pixels) | −14% | | −15% | −10% |

Halving the sun's map's resolution saved 1%, so the shadow pass costs its casters' geometry, not its texels. A Chrome trace at the spawn had the page's main thread waiting on the GPU 63% of the time, with about 2 ms of JavaScript a frame. Three changes, none of which changes what is drawn by more than a few levels on a few pixels:

- **Welded geometry** (`src/geometry-weld.js`, called by `createWorld` after the bake and by `world.addStreamed`). Alone: −6.6% at the spawn, −5% in first person. The village's 106 non-indexed geometries go from 1.31M to 0.54M vertices, and the streamed regions' 79 from 0.84M to 0.30M; most of it is the baked scenery, the trees' bark and hollows, the kit's shared sphere, pebbles and crowns. It costs about 53 ms of the village's build in Chrome (620 → 660 ms for `createWorld` in Node) and about 31 ms spread over streaming, at most 5.3 ms for one mesh.
- **Lanterns dark by day** (`lightLanterns` in `src/village/lamps.js`, the branch in `src/shader-chunks.js`). Alone: −6.2% at the spawn, −5% in first person. Moving all six lanterns out of reach saved nothing, so the cost was the loop, not the lighting. Taking them out of the scene saved 8%, but every program recompiles each time they come or go.
- **Shrubs cast with their coarse leaves** (`bushes.shadowLevel`). About 1–2%, not measured alone.

Mean frame intervals on an Apple M5, headless Chrome, 1600 × 1000 CSS pixels at device scale 2, `?resolution=fixed`, uncapped, on the dev server. Each run took a fresh browser after a discarded warm-up, the revisions alternating over four rounds; the change is the median of the rounds' own differences. The first round, which ran `main` first, favoured the change least (−1% to −12%); the other three agreed within about 2%.

| View | Before ms | After ms | Change | Draws | Triangles |
| --- | --- | --- | --- | --- | --- |
| Village spawn, height 18, high | 7.55 | 6.58 | −12.8% | 730 → 726 | 2.49M → 2.37M |
| Village spawn, balanced | 7.35 | 6.45 | −11.5% | 703 → 698 | 2.43M → 2.31M |
| Village spawn, performance | 5.94 | 5.33 | −10.0% | 669 → 667 | 2.37M → 2.26M |
| Village spawn, first person | 4.02 | 3.67 | −8.7% | 264 → 263 | 1.10M → 1.06M |
| Village spawn, zoomed out to 39 | 9.19 | 7.95 | −12.2% | 873 → 867 | 2.29M → 2.27M |
| Millpond's bank | 5.83 | 5.07 | −12.1% | 350 → 347 | 1.64M → 1.55M |
| Orchard, first person | 7.93 | 6.97 | −12.1% | 1,016 → 1,002 | 2.66M → 2.62M |
| Market square | 3.96 | 3.51 | −11.0% | 319 → 318 | 1.17M → 1.11M |
| Market square, first person | 7.48 | 6.18 | −16.4% | 1,012 → 990 | 2.29M → 2.24M |
| Marsh boardwalk | 6.35 | 5.61 | −11.3% | 383 → 381 | 1.56M → 1.50M |
| Old wood's clearing | 5.14 | 4.47 | −12.6% | 271 → 271 | 1.66M → 1.60M |

Every comparison of pixels is frame-locked (reduced motion, seeded `Math.random` that skips three's `generateUUID`, frames of exactly 1/60 s, the canvas read in the task that drew it) at 2000 × 1250, over nine views: the spawn, height 30, the orchard, beside a lamp by day and at blue hour, the spawn at blue hour, and three in first person. Two runs of `main` matched to within one level. Against `main`, eight views differ by a mean of at most 0.04 levels of 255 with at most 0.3% of pixels more than 4 levels apart; first person among the shrubs differs on 1.5% of pixels (mean 0.14), all on shrub leaves and the speckle beneath them, and the two look the same side by side. By day the lanterns' 0.1 intensity had lit only the lamp's hood and the top of a hat beneath it.

Tried and dropped:

- **Tree leaves casting at level 1**, half of them as the broader blade: −1.7% at the spawn, but with half the leaves casting, canopies shade themselves less and read lighter and flatter.
- **The fill light folded into a spherical-harmonics light probe**: 2% slower than the light it replaced. Without the fill the frame is 3% faster, so a diffuse-only fill is the remaining option.
- **A cheaper water shader.** A trivial one saves only 1.4–3.3%; the long waves in the vertex shader and a foam hash without sines saved 0.7%. The water's cost is its passes, not its shading.
- **Leaves merged out of instancing** (−0.6%), **Lambert leaves** (−1.8%; Lambert everywhere is −7.6% but looks different), **no clipping plane in reflection captures** (no change) and **a half-resolution shadow map** (−1%).

Left to look at, by what each saved at the spawn: a four-triangle leaf blade at the default view (−4.4%), shrubs at their coarse level there (−2.1%), and temporal antialiasing in place of 4x MSAA, which a stand-in resolve pass put at −14% at the spawn and −7% in first person. Separately, the marsh's fireflies hide by day, so the marsh's reflection compiles their program with a clipping plane at the first blue hour; `tests/routing.spec.js` cannot catch that, because it reads `programs` from the lanterns' diagnostics, which have none.

### Depth-only shadow maps and cropped reflections (2026-11-05)

A second hunt for 10%. Toggling each part of the frame on and off in one page, in alternating windows so drift cancels, showed the earlier claim that shadows and water cost "around 1 ms" had gone stale as the rest of the frame got cheaper. Against `main` (`539d8da`), on high at device scale 2 at the spawn and in first person: writing the sun's map was 19% and 30% of the frame, and reading it 12% and 13%. At the market and orchard in first person the water was 20–23%, because every capture re-rendered the whole mirrored scene for a sliver of river. Three changes, none of which changes what is drawn:

- **Depth-only shadow maps** (`src/shadow-maps.js`). No colour attachment and no fragment work when writing, and four comparison fetches in place of sixteen fetches and unpacks when reading (`GET_SHADOW` in `src/shader-chunks.js`). Alone: −9.3% at the spawn, −17.5% in first person, −9.8% zoomed out. It also frees the colour target, 64 MB at 4096 and 16 MB at 2048 by arithmetic. Three r180 has no setting for this. It makes a shadow map only where a light has none and binds `map.texture`, so that is where this hooks in. Rooms never rewrite their cached maps, so they gain only from the reads.
- **Casters that can reach the view** (`src/game/caster-reach.js`, wired in `src/game/shadows.js`). Alone, measured in one page: −14.1% in first person, with 500 → 259 draws; −3.2% at the spawn; nothing measurable zoomed out or at the market in first person.
- **Reflections drawn only where the surface lies** (`limitReflection` in `src/water.js`), in first person. At the market, the river's capture drew 685 × 76 of its 768 × 768 target. Alone: about −16 to −20% at the market and orchard, from 1,364 to 936 draws at the market.

Mean frame intervals on an Apple M5, headless Chrome, 1600 × 1000 CSS pixels, `?resolution=fixed`, uncapped, on the dev server. Each run took a fresh browser, revisions alternating, after a discarded warm-up. The change is the median of the rounds' own differences: four rounds on high at scale 2, three on the others. Each view's first round on high at scale 2 favoured the change least (−3.8% at the millpond, −4.2% zoomed out, −8.6% at the spawn), as the run straight after a rest does; the other three agreed within about 3%. Draws and triangles are one frame's, the last of the window, so they shift with whether a reflection capture fell on it, which is why zoomed out shows more draws. Compare them only as a rough shape.

| View (high, device scale 2) | Before ms | After ms | Change | Draws | Triangles |
| --- | --- | --- | --- | --- | --- |
| Village spawn, height 18 | 8.97 | 7.44 | −15.5% | 826 → 735 | 2.86M → 2.57M |
| Village spawn, first person | 5.73 | 4.02 | −28.9% | 500 → 264 | 1.72M → 1.06M |
| Village spawn, zoomed out to 39 | 10.45 | 9.26 | −11.4% | 873 → 1,080 | 2.37M → 2.62M |
| Market square | 4.53 | 3.96 | −12.3% | 339 → 309 | 1.25M → 1.13M |
| Market square, first person | 9.45 | 7.50 | −19.2% | 1,399 → 1,019 | 2.92M → 2.30M |
| Orchard, first person | 10.12 | 7.96 | −20.6% | 1,405 → 898 | 3.25M → 2.53M |
| Marsh boardwalk | 7.59 | 6.37 | −14.6% | 467 → 353 | 1.92M → 1.48M |
| Old wood's clearing | 6.38 | 5.16 | −18.3% | 358 → 275 | 2.06M → 1.66M |
| Millpond's bank | 6.96 | 5.83 | −15.1% | 449 → 323 | 1.81M → 1.55M |

| Other settings at the spawn | Height 18 ms | First person ms | Zoomed out ms |
| --- | --- | --- | --- |
| Balanced, scale 2 | 8.75 → 7.45 (−14.7%) | 5.10 → 3.94 (−22.6%) | 10.38 → 9.00 (−13.3%) |
| Performance, scale 2 | 7.16 → 6.13 (−14.4%) | 4.08 → 3.19 (−21.8%) | 8.36 → 7.20 (−13.4%) |
| High, scale 1 | 7.61 → 6.59 (−13.7%) | 5.02 → 3.54 (−29.4%) | 9.14 → 8.11 (−11.2%) |

| Room, inside the door (high, scale 2) | Before ms | After ms | Change |
| --- | --- | --- | --- |
| The bakery | 8.66 | 7.51 | −13.0% |
| Rosewood | 4.64 | 4.12 | −10.9% |
| The post office | 5.66 | 5.22 | −7.7% |
| Thistledown | 4.72 | 4.41 | −6.5% |
| The Drowsy Heron | 7.78 | 7.33 | −4.8% |

Every comparison of pixels is frame-locked (seeded `Math.random`, a virtual clock, a fixed frame count, read in the task that drew it) at 2000 × 1250, over 17 still views (13 outdoors, by day and at blue hour, and four rooms) and eight in first person while turning up to 0.3 radians a frame or pitched between −0.82 and +1.35. Two runs of `main` matched exactly on all 17. On the still views the mean difference is at most 0.008 levels of 255, and no pixel differs by more than 16; every view but Rosewood stays within 10. On the first-person eight the mean is at most 0.005 and the largest difference is 6. In earlier runs a few pixels differed by up to 170, all on a resident whose idle pose was a fraction of a pixel off, since it depends on how many frames streaming took. `Math.random` has to skip three's `generateUUID` in such a comparison: one more texture otherwise shifts everything seeded after it, which looked like a broad change in the rooms' ambient occlusion and the residents' poses.

What a frame was made of afterwards, one change at a time in one page, on high at scale 2, at the spawn and in first person: tree leaves and shrubs hidden −25% and −17%, MSAA off −17% and −20%, the shadow map frozen −12% and −10%, water skipped −11% and −5% (−13% at the market in first person), and coarse leaves −11% and −5%. These windows were noisier than the earlier ones, up to about ±10 points. Foliage and multisampling are the largest again.

Tried and dropped:

- **A 16-bit depth map.** No change at the spawn or in first person (+0.1%, +0.2%), and it would cost the rooms' perspective maps precision. It would halve the map's memory.
- **Skipping the shadow lookup on surfaces facing away from the sun.** The same pixels by construction, and no measurable saving.
- **A vertex array per instanced mesh.** Instanced meshes that share a geometry share a VAO in three, which makes about 700 `vertexAttribPointer` calls a frame. Giving each its own saved 2% at the spawn and under 1% in first person, on an M5 where the frame is GPU bound. It may pay better where the driver costs more, and would need a wrapper for every instanced mesh and leaf level.

Left to look at: about 156 program lookups a frame (`getProgram`, about 0.5 ms of JavaScript), where a material is shared by plain and instanced meshes. That won't move a GPU-bound frame, but it is the largest single line in a JavaScript profile.

Not measured: anything but this M5 in Chrome, including Safari, Firefox, Windows and mobile GPUs. The reads and the culling should carry over. Doing without the colour store is a tile-based GPU's saving, so an immediate-mode GPU may gain less there. Comparison samplers and depth-only framebuffers are core WebGL 2, but only Chrome has run them here.

### Thistledown, the village's bed & breakfast (2026-11-04)

A new room, so the other rooms are untouched. Frame means on an Apple M5 at the front door, three interleaved rounds each, against Rosewood at its front door in the same session:

| | Thistledown 1x | Rosewood 1x | Thistledown 2x | Rosewood 2x |
| --- | --- | --- | --- | --- |
| High | 7.86 ms | 11.06 ms | 8.25 ms | 8.21 ms |
| Balanced | 6.72 ms | 10.70 ms | 7.35 ms | 8.79 ms |
| Performance | 5.47 ms | 8.65 ms | 4.04 ms | 10.98 ms |
| Draws, high | 398 | 318 | 398 | 318 |
| Triangles, high | 0.44M | 0.51M | 0.44M | 0.51M |

Take these as the shape rather than exact figures: these runs are noisy, and Rosewood's performance row at 2x is slower than its high row. Opening the room from the village took 2.6 to 2.7 s against 4.0 to 5.0 s for Rosewood and 2.8 to 4.2 s for the bakery, on the dev server.

Outside, the cottage gains its sign and a board at the door: two label materials and two objects in `scripts/world-fingerprint.mjs`, whose colliders, lamps and ground hashes match `main` (`c9336d8`). No random stream moved.

### People with trades of their own (2026-11-04)

Every person was one body in a different coat. Each now has their own clothes, hair, hat and something in hand, on the same chunky proportions (`src/people/`). Hair, beards and straw take their colour from a per-vertex tone, so none of it adds a texture or a material.

Most of it paid for itself. A tiny part drew a 192-triangle sphere before, so a button now costs 36 and there is room for far more parts. Regional residents were the larger saving: `batchParts` only knew the colours in use when the village was built, so anyone streaming in later with a new colour never merged, at about 23 draws per pass against the village's 10. `mat` now registers every colour, and a standing figure folds its legs and bent arms into the parts that move, which makes it six meshes for anyone. Far copies were cut from already merged geometry, so their parts could not be coarsened; they are now cut first, drop trim under 9 cm tall, and the village's Mabel, Finn and Elio get them too.

Also fixed: everyone's feet floated about 7 cm above the ground, and side hair over a brim's shadow read as a dark band across the eyes from the overview. The walk gains knees and elbows, its hips ride on the back foot's toes so the feet stay down, and residents now blink and turn their heads toward you before their shoulders follow.

Per figure: 6,900–9,700 triangles against 4,400–12,600 before, and far copies 2,400–3,100 against 2,700–3,500. Building them is no slower: in Chrome, the median of seven page loads per revision, `addResident` takes 4.4–5.6 ms against 3.1–8.1 ms before, and `createLife` 69–78 ms against 77–90 ms. `tests/streaming.spec.js`'s stall test skips itself where headless frames take over 20 ms, as they did here, so that timing stands in for it.

Mean over each view's samples, the median of four interleaved rounds, on an Apple M5 in headless Chrome at 1600 × 1000 CSS pixels, device scale 2, uncapped, against `main` (`c9336d8`).

| View (high) | Before draws / triangles | After draws / triangles |
| --- | --- | --- |
| Village spawn | 851 / 2.783M | 822 / 2.788M |
| Millpond's bank | 486 / 1.886M | 462 / 1.897M |
| Orchard, first person | 1,566 / 3.153M | 1,345 / 3.145M |
| Market square | 469 / 1.269M | 359 / 1.289M |
| Market square, first person | 1,530 / 2.803M | 1,323 / 2.802M |
| The inn's forecourt | 458 / 1.262M | 351 / 1.285M |
| Marsh boardwalk | 437 / 1.670M | 398 / 1.688M |
| Old wood's clearing | 382 / 2.052M | 347 / 2.062M |
| Allotments | 597 / 2.103M | 546 / 2.123M |
| Village spawn, zoomed out to 39 (most over 8 frames, one run) | 1,146 / 2.643M | 1,128 / 2.634M |

Frame time is not resolved. Rounds of the same pair differed by +19% to −64%, and the fourth round's before run slowed badly partway through, so these runs show neither a saving nor a cost. The median change across the views was +1.6%, inside that noise. Not measured: anything but this M5, or the interior benchmark, since no room has a person in it.

### The post office (2026-11-04)

The green door on the market lane now opens a walkable room with three spaces: the public hall, the sorting office behind the counter and a back room. How it stays cheap is under [The post office](#the-post-office). Outdoors it adds only a window in the rear wall, five boxes merged into the building's existing meshes.

Counted on an Apple M5 in headless Chrome at 1600 × 1000, high quality, `?resolution=fixed`, against `main` (`c9336d8`). Outdoors, the most over twelve frames after every region had streamed in. The most over a few frames depends on which fell on a water reflection capture, and that varies by more than this change adds, so the green comes out lower than `main`. The door's quiet frames are the clean comparison: 350 draws both ways, and 108 more triangles.

| View | `main` draws / triangles | With the room draws / triangles |
| --- | --- | --- |
| The post office's door (42.1, −3.6), height 18 | 418 / 1.186M | 424 / 1.186M |
| Market square (36.5, 3.2), height 18 | 573 / 1.548M | 579 / 1.550M |
| Village spawn, height 18 | 1,048 / 3.125M | 1,044 / 3.120M |
| Room, inside the door | | 245 / 0.400M |
| Room, along the hall from the flap | | 236 / 0.397M |
| Room, facing the stove | | 237 / 0.391M |
| Room, the sorting frame | | 183 / 0.314M |
| Room, inside the door, performance quality | | 120 / 0.200M |

Mean frame intervals uncapped at device scale 2, inside each room's door: the median of three runs of two rounds, the two rooms taking turns, because another process was using the GPU throughout. The bakery's figure on high here is well above its 9.69 ms in [the comparison below](#cheaper-fragments-and-a-compact-scene-target-2026-11-04), so read these only against each other.

| Quality | The post office ms | The bakery ms |
| --- | --- | --- |
| High | 9.23 | 15.48 |
| Balanced | 8.30 | 14.24 |
| Performance | 5.32 | 8.72 |

Building the room takes about 1 s on the main thread, against about 1.4 s for the bakery, three builds of each in one page.

### The old windmill (2026-11-04)

The windmill's door opens a walkable tower with five levels joined by four ladders. It is rendered by the same chain as the other rooms. All its static parts merge to one mesh per material (stone, timber, iron, sacking, glass, lantern glass), which with the tally's slate and the spare stone's face makes eight draws per pass however much of the tower is in view, and each moving train of the machinery is one more. Nothing that moves casts into the sun's map, which renders once. Its six lanterns are a fixed set whose strength changes with the light. Its shafts of sun and flour dust are one additive draw each, skipped by the occlusion pass. Outside, the hill's one merged mesh gains three windows, about 110 triangles and no draws.

Measured on an Apple M5 at 1600 × 1000 CSS pixels with `BENCHMARK_ROUNDS=3` and a shared dev server:

| High, device scale 2 | Frame ms | Draws | Triangles |
| --- | --- | --- | --- |
| Windmill, inside the door | 9.1 | 48 | 313k |
| Windmill, looking up the well | 10.8 | 66 | 342k |
| Bakery, inside the door, same session | 16.7 | 286 | 1.23M |

### Cheaper fragments and a compact scene target (2026-11-04)

A hunt for a 10% saving, measured one suspect at a time, found most of the cost in work that drew nothing. Draw calls and triangles are unchanged; this is all fragment and resolve work.

- **Lantern range check** (`src/shader-chunks.js`). Six lanterns reaching 4 m ran a full BRDF each in every lit fragment of the frame, and added exactly nothing to nearly all of them. The largest single saving. The rooms gain too, since their lamps have a `distance`.
- **11-11-10 scene target** (`src/scene-target.js`), with no alpha to store and half the bytes per sample to resolve, in the village and the rooms. Falls back to RGBA16F.
- **No end-of-pass depth resolve.** Three resolves a multisampled target's depth by default, and nothing read it.
- **No depth on the canvas.** Only a full-screen pass reaches it.
- **Refraction resolves the surfaces' parts of the screen** (`src/water-bounds.js`). A 1 × 1 blit saved nearly what skipping the blit did, so the cost is the resolve itself, not splitting the pass in two, and it follows the area resolved.
- **One composer target.** No time saved, but about 200 MB less GPU memory at 2000 × 1250 by arithmetic (one target at 40 bytes per pixel against two at 60), with the formats above.

Mean frame intervals on an Apple M5, headless Chrome 156, 1600 × 1000 CSS pixels, `?resolution=fixed`, uncapped, against `main` (`b9e85b5`). Each run took a fresh browser, and the revisions alternated: four rounds on high at device scale 2, three on the others. The percentage is the median of the rounds' own differences, because the machine drifted by up to about 30% between rounds (the first run after a rest ran fastest, whatever its code). Every round of every row favoured the change, by 13.7% at the least.

| View (high, device scale 2) | Before ms | After ms | Change |
| --- | --- | --- | --- |
| Village spawn, height 18 | 12.00 | 8.45 | −27.8% |
| Village spawn, first person | 8.40 | 5.62 | −31.3% |
| Village spawn, zoomed out to 39 | 14.32 | 10.32 | −26.8% |
| Market square | 6.94 | 4.62 | −33.3% |
| Market square, first person | 12.27 | 9.69 | −20.3% |
| Marsh boardwalk | 10.97 | 7.49 | −31.3% |
| Millpond's bank | 9.87 | 6.94 | −29.6% |
| Old wood's clearing | 8.78 | 6.32 | −27.7% |
| Old wood's clearing, first person | 5.63 | 4.09 | −27.3% |

| Other settings at the spawn | Height 18 ms | First person ms | Zoomed out ms |
| --- | --- | --- | --- |
| Balanced, scale 2 | 12.04 → 8.60 (−28.7%) | 7.87 → 5.17 (−34.4%) | 14.38 → 10.36 (−27.5%) |
| Performance, scale 2 | 9.36 → 7.12 (−23.3%) | 5.81 → 4.21 (−26.7%) | 11.16 → 8.33 (−25.2%) |
| High, scale 1 | 10.12 → 7.59 (−24.7%) | 6.93 → 5.06 (−27.0%) | 12.04 → 9.15 (−24.0%) |

| Room, inside the door (high, scale 2) | Before ms | After ms | Change |
| --- | --- | --- | --- |
| The bakery | 11.48 | 9.69 | −15.6% |
| Rosewood | 6.86 | 5.44 | −20.7% |
| The Drowsy Heron | 10.27 | 8.79 | −14.0% |

Each change alone, three rounds on high at scale 2, spawn and first person: the range check −16.3% and −13.8%, the 11-11-10 target −7.2% and −8.9%, no depth resolve −5.8% and −4.4%, no canvas depth −5.0% and −4.6%, and per-body refraction rectangles about −4% in the overview on top of the first three. They overlap, so they do not add up.

Every comparison of pixels below is frame-locked: seeded `Math.random`, a virtual clock, a fixed frame count, and the canvas read in the task that drew it, over 18 views (15 outdoors, by day and at blue hour, and the three rooms) at 2000 × 1250. Two runs of `main` matched exactly on all 18.

- **Everything but the 11-11-10 target.** At most 30 of the 2.5 million pixels differed in any view, by one level of 255.
- **Resolving part of the screen.** With everything else equal, the final build matches a full-frame blit exactly, with no pixel different, on all 15 outdoor views, first person included.
- **With it.** Mean difference 0.38–0.55 levels outdoors and 0.49–0.75 in the rooms. At most 0.033% of pixels (in the bakery) differ by more than 4 levels. The rooms' largest difference is 8. Outdoors the largest is 120, on a handful of isolated pixels that are specks in `main` itself (`[0, 0, 0]` in foliage, say) and look right with the new format, most likely because it clamps the negative values behind them. No banding shows at 6× contrast in the first-person sky by day and at blue hour, or at 3× on the rooms' walls and the water.

Tried and dropped:

- **Probing the shadow filter.** Six of `PCFSoftShadowMap`'s sixteen taps first, and the rest only when they disagree, saved 2.5–4%, but moved up to 0.9% of pixels by more than 4 levels, in the finest dappling under trees. A shadow's straight edge always reaches a corner of the filter's footprint, but a detail smaller than the footprint can slip between the taps. Single-tap shadows, as an upper bound, saved 11% at the spawn and 3% in first person.
- **Discarding depth** on the shadow map and reflection targets after their passes with `invalidateFramebuffer`. No measurable saving.

Not measured: anything but this M5, including Windows and mobile GPUs. The range check and the resolve savings should carry over, but an immediate-mode GPU pays differently for bandwidth, so the format's share may differ there.

### The Drowsy Heron on the map (2026-11-03)

The inn joins the map north of the market square, and its door opens a walkable room with two storeys and a balcony. Its outside is `exteriorSections` from the study's own design, built lean in `src/regions/heron.js`: flat colours merged into one vertex-coloured structure and one of trim, about 2,350 two-face tiles (four triangles each) in one instanced mesh, the village's glass, and only the brick and herringbone painted, at 1024 and 512. Nothing inside is built. One job runs a section per slice, none over about 30 ms on this machine; each merges what it made, so the last merge joins only a few long pieces.

- **Shadows.** Only the structure and the walls cast: the tiles and trim add nothing to the shadow pass, because the roof slabs and walls already throw the same shape.
- **Zoomed far out.** The trim (every part under 1.6 m across, which is most studs, all balusters, cames and plants) and the tiles hide from height 30 (`far`), leaving the walls and bare roof slabs, about 10,000 triangles. Nothing there casts a shadow.
- **The site.** It stands where the village's own views do not reach it: from the spawn, height 18 counts exactly what `main` does. A first site south of the square put its bounding sphere in that view, over the 3.2M budget, and showed the overview only its back, since the camera looks in from the south-east.
- **The room.** Rendered by the same chain as the bakery. Its sun and fire shadow maps stay cached, and its seven point lights are fixed for the visit.

`node scripts/world-fingerprint.mjs` against `main` (`154c295`) matches on the scene, animations, chunks, lamps, interactables and textures; only `colliders` and `ground` (the planting grid) differ, by the inn's own footing.

Counted on an Apple M5 in headless Chrome at 1600 × 1000, high quality, `?resolution=fixed`, the most over the frames counted, against the same revision without the inn. The first three rows include a water reflection where one fell in the sample.

| View | Before draws / triangles | With the inn draws / triangles |
| --- | --- | --- |
| Village spawn (−2.8, 6.2), height 18 | 996 / 3.119M | 996 / 3.119M |
| Village spawn, height 39 | 1,079 / 2.638M | 1,080 / 2.636M |
| Market square (36.5, 3.2), height 18 | 321 / 1.004M | 375 / 1.081M |
| Forecourt (35, −8.2), height 18 | | 444 / 1.191M |
| Room, inside the door | | 262 / 1.158M |
| Room, by the hearth | | 294 / 1.096M |
| Room, the loft | | 299 / 1.172M |

Mean frame intervals uncapped, at device scale 1 and 2 (pixel ratio 1.25): forecourt 4.8 and 6.3 ms, inside the door 5.7 and 7.0 ms, by the hearth 4.8 and 6.1 ms. `npm run benchmark` measures it as "high, heron" and "high, heron, first person"; `--ablate` adds it at height 30.

### The Drowsy Heron study (2026-11-03)

A separate page (`/pub-study.html`), so the game's frame is unchanged: the only code the two share and this touched is the rooms' occlusion pass, moved as it was from `src/interior.js` to `src/interior-ao.js`. The building merges to about 250 meshes in three parts; its roof is about 5,800 clay tiles, in two instanced meshes (the main roofs and the kitchen). Its sun and fire shadow maps render only when the cutaway changes, and its seven point lights are a fixed set, so blue hour compiles nothing. Occlusion runs only while the eye is indoors or a cutaway is up.

Apple M5, headless Chrome, 1600 × 1000 CSS pixels, uncapped, with the desktop app also on the GPU: mean frame interval over 2.5 s, at pixel ratio 1 and at device scale 2 (capped to 1.25, as the village is).

| View | Draws / triangles | Scale 1 ms | Scale 2 ms |
| --- | --- | --- | --- |
| From the street | 289 / 0.66M | 10.7 | 13.5 |
| The great room | 362 / 1.28M | 12.6 | 17.1 |
| The bar | 231 / 1.20M | 11.4 | 16.0 |
| The sleeping loft | 293 / 1.23M | 13.1 | 18.1 |

The scale 1 column was taken at a pixel ratio of 1 and is unaffected by the cap; the triangles indoors are about twice the outdoor count because the occlusion pass draws the room again.

### Allotments (2026-11-03)

The map expansion's last region. South of the kitchen garden, between the open fields and the marsh, a flat fenced square of eight raised beds on the fields' own grass (no ground box, like the market lane): a gravel path from the garden road to a potting shed, a cross path through the east and west gates, cold frames, compost bays, a water butt, a noticeboard, a wheelbarrow and a scarecrow. Four beds are the neighbours' (cabbages, sunflowers, potatoes, rhubarb); four are to let, and the player rents, sows, waters and harvests carrots, lettuces, runner beans and pumpkins there. Basil, the allotment keeper, joins by the shed through `life.addResident`. The layout, colliders and grass mask load with the village from `src/regions/allotments-layout.js`; five jobs stream in from `src/regions/allotments.js` (the paths, the west and east halves, the rentable beds' crops, and Basil). Nothing there goes into the water's captures.

- **Crops.** Each rentable bed's crop is one instanced mesh, at full size when it is added (its bounding sphere is computed then), scaled by growth afterwards, and drawn only while something grows there: `count` drops to 0 rather than toggling `visible`, which the detail system owns. The neighbours' crops are one merged mesh. Both hide zoomed far out (`far`), and every structure drops its shadow there (`fineShadow`).
- **Residents zoomed far out.** From height 30, where the detail system turns fine shadows off, each region's resident (Rowan, Hazel, Bram, Wren and Basil) draws as one merged, vertex-coloured copy of its body in its resting pose, instead of about 23 jointed batches (`farFigure` in `src/life.js`). The copy rebuilds spheres and cylinders with at most 8 segments and leaves out parts under 4 cm across, so it counts about 3,400 triangles against the figure's 5,200. The village's own people are unchanged. This took about 40 draws off the village at the cap, which Rosewood's yard had put 20 over the test's 1,100.
- **The village.** The allotments stay out of the village scatter's colliders, and the village's views gain only what they see of the region.

Counted in the cloud container (SwiftShader, so no timings) at 1200 × 750, high quality, `?resolution=fixed`, with the frame-locked probe, against `main` (`137a491`), with a fresh save (no beds rented) unless it says otherwise. Each cell is the most over the frames counted; the brackets give a frame without a water reflection where that differs.

| View | `main` draws / triangles | Allotments draws / triangles |
| --- | --- | --- |
| Village spawn (−2.8, 6.2), height 39 | 1,120 / 2.633M (904 / 2.38M) | 1,079 / 2.638M (862 / 2.38M) |
| Village spawn, height 18 | 969 / 3.10M | 996 / 3.12M |
| Village's south-west edge (−12, 18), height 18 | 647 / 2.55M | 702 / 2.58M |
| Cross path (−6.5, 28.6), height 18 | 555 / 2.20M (empty field) | 618 / 2.23M |
| Cross path, height 30 | 792 / 1.93M | 786 / 1.94M |
| Cross path, height 18, every bed growing | | 616 / 2.27M |
| First person at the east gate (−2.5, 28.6), facing in | 400 / 1.10M | 453 / 1.13M |
| First person by the carrots (−12.6, 24), facing the village | 1,285 / 2.64M | 1,315 / 2.66M |

`tests/performance.spec.js` holds the cross path under 1,000 draws and 2.5M triangles at heights 18 and 30 with every bed growing, and the village's edge facing the allotments with the other edges. `npm run benchmark` measures it as "high, allotments" and "high, allotments, first person"; `--ablate` adds it at height 30.

### Old wood (2026-11-03)

Phase 5's third region. West of the wildflower meadow, from the village's edge to the map's rim and between the orchard hill and the south-west fields, a strip of woodland on a gently rolling floor (never more than about a metre, level in the clearing and flat at the village's edge): three earth trails, 64 oaks and amber beeches (16 of them young trees between the crowns), the great oak, a mossy clearing with a fairy ring whose mushrooms glow at blue hour, a hollow log, stumps and fallen branches, ferns, toadstools, a fingerpost, soft shafts of sunlight, and patches of seven woodland flowers that the player presses into the journal. Rowan, who forages here, joins at her stump table through `life.addResident`. The wood's shape, heights, trees, colliders and grass mask load with the village from `src/regions/wood-layout.js`; fourteen jobs stream in from `src/regions/wood.js` (the floor, six stands of trees and the great oak, the logs, stumps and Rowan's table, the ferns, the mushrooms and fairy ring, the flowers, the light shafts, and Rowan).

- **Trees.** Built a limb per slice into one bark mesh, one shell mesh, one instanced leaf mesh and one distant-crown mesh per stand, each stand one level of detail. Every stand but the great oak draws the coarse blade even up close: twice a fine leaf's area for half its triangles, so half as many leaves cover a crown. A first draft with fine blades added about 1M triangles at the wood's overview. (The shells and leaves were reworked the same day; see "Old wood crowns" below.)
- **Floor and small scenery.** One 0.4 m grid with vertex-coloured moss, litter and trails, like the orchard's. Along the meadow and the fields to the north and south, the floor's moss and litter fade into the lawn over a few metres, across a border that wanders in and out (`woodFloor` in `src/regions/wood-layout.js`), and the open country's grass thins out across the same band, since scattered blades deeper in read as spikes. Ferns, flowers and toadstools only take shadows, and split into one instanced mesh per chunk (`splitByChunk` in `src/regions/kit.js`): built as one mesh each across the wood, their bounding spheres reached into the village green's view, which drew all of them without seeing any. The six tree stands stay six for the same reason: merged into two, they put the green 46,000 triangles over its 3.2M.
- **Zoom cap.** Zoomed far out (from height 30), the ferns, toadstools, flowers and light shafts hide and the logs, stumps and Rowan's table stop casting shadows, through the `far` and `fineShadow` options of `world.addStreamed`; the trees take the coarse leaves and their shells hide with the village trees' ground detail. The wood is in view from the village at the cap, where it still adds about 50 draws and 107,000 triangles, leaving that test (1,100 draws and 2.65M) about 5 draws and 25,000 triangles of room on the frames that render a reflection.
- **Light shafts.** Six open tubes along the sun's direction in one additive mesh, a small shader of their own, faded out by blue hour. The wood overview compiles 74–75 shader programs against `main`'s 72 there.
- **The village.** Every region after the orchard's stays out of the village scatter's colliders (`laterSet` in `src/world.js`), so the village's random stream is unchanged; its scene fingerprint matches `main`'s except the open country's grass, which gains the wood's notch.

Counted in the cloud container (SwiftShader, so no timings) at 1200 × 750, high quality, `?resolution=fixed`, with the frame-locked probe, against `main` (`822ef31`). The height 39 rows are frames that render a water reflection.

| View | `main` draws / triangles | Old wood draws / triangles |
| --- | --- | --- |
| Clearing (−35.5, 0), height 18 | 271 / 1.69M (empty field) | 368 / 1.93M |
| Clearing, height 30 | 449 / 1.57M | 497 / 1.67M |
| Clearing, height 39 | 749 / 1.93M | 798 / 2.04M |
| Trail by Rowan's table (−31.5, 2.5), height 18 | 353 / 1.81M | 448 / 2.06M |
| Village spawn (−2.8, 6.2), height 18 | 778 / 2.77M | 791 / 2.82M |
| Village spawn, height 39 | 1,046 / 2.52M | 1,095 / 2.62M |
| Village's west edge (−21, 2), height 18 | 592 / 2.64M | 673 / 2.87M |
| First person by Rowan's table (−30.4, 3.6), facing the clearing | 212 / 0.72M | 285 / 0.96M |
| First person on the trail from the meadow (−24.6, 5.1) | 225 / 0.75M | 327 / 0.96M |
| First person by the great oak (−35.8, −5.2) | 180 / 0.54M | 243 / 0.73M |
| First person in the clearing at blue hour | 181 / 0.65M | 240 / 0.83M |

In `tests/performance.spec.js`'s own run on an M5 (1600 × 1000, the most over six frames), the village's green counted 942 draws and 3.05M triangles against `main`'s 929 and 3.00M, the edge facing the wood 673 and 2.87M, and the north-west edge by the orchard 552 and 2.59M against 530 and 2.48M. The test holds the benchmark's wood viewpoint, the clearing (−35.5, 0), under 1,000 draws and 2.5M triangles at heights 18 and 30, and the village's edge facing the wood with the other edges. `npm run benchmark` measures it as "high, wood" and "high, wood, first person"; `--ablate` adds the wood at height 30. On the M5 at 60 fps, before the small scenery split, those measured 355 draws, 1.93M triangles and 2.0 ms; 199, 725k and 2.5 ms; and 519, 1.71M and 3.5 ms.

### Old wood crowns (2026-11-03)

The wood's crowns read as smooth balls with leaves scattered round them: each leaf cluster sat on a shell at 0.8 of its radius in 1.3 times the leaves' colour, and its 30 coarse blades stood out radially from it, so from above most showed an edge or a tip. Now, in `src/regions/wood.js`:

- **Leaves lie on the crown.** Each leaf lies over the cluster's surface like a shingle (`shingle`): face out, tip drooping roughly downhill and lifted 10–40° off the crown, so from above it shows its whole face. They cover the top and flanks down to 0.72 of the radius below the centre (the great oak's, which walkers stand under, all the way round), between 0.68 and 1.04 of the radius out.
- **A leaf-shaped blade.** The coarse blade, a rhombus, reads as a square lying face up; the wood draws a copy reshaped as a kite (`kite`), broadest a third of the way up and narrower, with the same four triangles, 10% larger.
- **Twice the leaves up close, the same zoomed out.** 60 leaves a cluster instead of 30. The leaves are ordered every fourth first, and `trees.adopt()` takes a `far` share: at the coarse level (above height 24) the wood draws a quarter of them, as many as it drew before, so heights 27 to 39, where the zoom-cap budget is tight, count exactly what `main` does.
- **Shade, not balls.** The shells sit at 0.56 of the radius in 0.6 times the leaves' colour, squat underneath (`stretch` 0.75), and `crownShells` takes a `rough` amount: broader lumps, a mottled colour, and normals turned mostly upward, so a shell takes the light evenly instead of shading round like a ball. Every other caller passes no `rough` and is unchanged.

Counted in the cloud container (SwiftShader) at 1200 × 750, high quality, `?resolution=fixed`, with a frame-locked probe, against `main` (`7ccb6f7`):

| View | `main` draws / triangles | Crowns draws / triangles |
| --- | --- | --- |
| Wood by the trail (−30, 6), height 18 | 447 / 2.08M | 447 / 2.19M |
| Same, height 10 | 286 / 1.45M | 286 / 1.55M |
| Clearing (−35.5, 0), height 24 | 534 / 2.26M | 534 / 2.37M |
| Clearing, heights 27 and 30 | 645 / 1.90M; 481 / 1.63M | the same |
| Village spawn (−3, 5), height 18 | 812 / 2.90M | 812 / 2.94M |
| Village spawn, height 39 | 877 / 2.36M | the same |
| First person by Rowan's table (−31.5, 2.5), facing the village | 1,505 / 3.01M | 1,505 / 3.08M |

Up close the wood's leaves come to about 115,000 more triangles (half of them in the shadow pass); no draws are added.

### Zoom detail (2026-11-02)

Phase 6 of the map expansion: the overview's zoom cap returns from 30 to 39. The plan feared that at height 39 the larger map would put about twice the village's content on screen. Measured, it holds less than that, because the overview's camera clamp keeps the village in the frame and the regions around it are sparser, but it still costs more than the village did: with the marsh in, `main` at 39 counts up to 1,254 draws and 3.07M triangles, against 856–1,104 draws and 2.11–2.41M triangles for the village at 39 before the map grew. Three levels of detail, chosen in `src/game/detail.js`, bring it back under that:

- **Coarse shrub leaves** above height 24, with the trees' coarse leaves (see [Work reduction](#work-reduction-in-the-current-build)): about −240,000 triangles at 39, and the same at every view from 24 to 30 that was already allowed.
- **Far detail** from height 30 (above 27): the brook's pebbles, its banks' shingle and grass tufts, and the fallen leaves, moss and hollows at every tree's foot hide (`FAR_HIDDEN` in `src/bake.js`, `trees.setGroundDetail`); the people and animals stop casting shadows and keep their soft contact shadows (`life.setCastShadows`); and the reeds, cattails and the shrubs' stems and blossoms stop casting shadows, which at 39 are lines a pixel wide (`FINE_CASTERS`). Together about −500,000 triangles and −250 draws at 39. This first started above 30, leaving the old cap's views as they were, but the full suite on an M5 showed the marsh's height 30 view over its budget once the zoom snapped there: under reduced motion the zoom used to ease, so the test had sampled on the way out. Settled at 30 with every region in, that view peaks at 1,157 draws and 2.57M triangles on `main` and with zoom detail alike, against its 1,000 and 2.5M; starting the far detail at 30 brings it to 910 draws and 2.12M. Hiding the meadow's grass blades and blossoms as well was tried and dropped: at 39 the lawn lost its speckle and looked flat, for about 190,000 triangles.
- **Nothing new to compile.** Each level hides meshes, turns off shadow casting, or swaps to a geometry the shrubs share, so zooming compiles no program.

Counted in the cloud container (SwiftShader, so no timings) at 1200 × 750, high quality, `?resolution=fixed`, frame-locked, against `main` (`7e38f0f`, with the marsh) with the cap lifted for the comparison. Counts include a water reflection on the frames that render one.

| View | `main` draws / triangles | Zoom detail draws / triangles |
| --- | --- | --- |
| Spawn, height 18 | 766 / 2.83M | 766 / 2.83M (identical pixels) |
| Spawn, height 30 | 996 / 2.80M | 738 / 2.09M |
| Spawn, height 39 | 1,079 / 3.00M | 790 / 2.27M |
| Village centre (0, −4), height 39 | 1,062 / 2.94M | 776 / 2.21M |
| Marsh boardwalk (7.8, 31.2), height 30 | 840 / 2.39M | 609 / 1.75M |
| Marsh boardwalk, height 39 | 1,241 / 3.07M | 947 / 2.32M |
| Millpond bank, height 39 | 1,254 / 3.07M | 957 / 2.30M |
| Orchard bench, height 39 | 766 / 2.51M | 523 / 1.83M |
| Market square, height 39 | 934 / 2.49M | 673 / 1.84M |
| Fields (−36, 30), height 39 | 746 / 2.32M | 520 / 1.76M |

In `tests/performance.spec.js`'s own run at 1600 × 1000 (the most over six frames, reflection frames included, with every region streamed in), the village at 39 counts 1,019 draws and 2.54M triangles: under the old village's draws at 39 and within 5% of its triangles. The test zooms the village out to the cap and checks that the far detail is hidden, that the view stays under 1,100 draws and 2.65M triangles, and that zooming back in to 27 brings every pebble and fallen leaf back; `tests/detail.spec.js` (`@logic`) checks that zooming out only ever coarsens the view, that the default view keeps its fine detail, and that the coarse shrub leaf keeps every leaf and its outline at a third of the triangles.

On the Apple M5 (`npm run benchmark -- <label> --ablate` at device scale 2, uncapped, two rounds, on mains power, one revision after another with nothing else on the GPU), the zoomed-out row at 39 measured 17.5 ms mean and 37 ms p95 with 859 draws and 2.24M triangles, against 19.2 ms, 35 ms, 1,071 and 2.91M for `main` at its cap of 30, and 20.2 ms, 36 ms, 1,148 and 2.98M for `main` with the cap lifted to 39. That run measured before the far detail moved down to 30. The machine ran every row slower that day than when the 9.3 ms row above was taken (the default view's "high" row ranged 12.5–17.5 ms across the three revisions, against 8.8 ms in October), and the first revision after a rest ran fastest whatever its code, so read the mean as no slower than `main` at its old cap rather than as a saving; the draws and triangles are the firm result. At the default height the frame's work is unchanged. In first person, shrubs beyond 18 m now take the coarse leaf as trees do, for 4–10% fewer triangles (the orchard's first-person view 3.26M → 2.96M, the market's 3.03M → 2.80M) at the same draws.

### Willow marsh (2026-11-02)

Phase 5's second region. South of the village the brook runs on under a third footbridge into a shallow mere with two reedy islands, a boardwalk on stilts across its western shallows, a little bird hide with a turf roof on the south bank, a bench, four weeping willows, a heron that wades and strikes, lily pads, loosestrife and iris, and fireflies at blue hour. Wren, who watches birds by the bench, joins through `life.addResident`. The marsh's shape, heights, decks, colliders and grass mask load with the village from `src/regions/marsh-layout.js`; eleven jobs stream in from `src/regions/marsh.js` (the ground, the water, the crossings, the hide and bench, a job of willows on each bank, the reeds, the lilies and flowers, the heron, the fireflies, and Wren).

- **Water.** One more water body, `marsh`, with its own 120 × 90 grid (see [the water notes](water.md)). Its seam with the village brook hides under the new footbridge. It reflects every second frame, like the millpond. Bodies now count as in view by their surface's flat box rather than its bounding sphere: the marsh's sphere reached past the village's south edge, so from the green it simulated and captured a reflection of the whole scene while out of sight.
- **Willows.** Each is its own job and its own wood, leaves and distant crown, so the two by the village's south edge cull apart from those across the mere. Built as instanced grounded leaves (about 2,300 a tree), with distant crowns for first person beyond 40 m. They have no shade shells inside the crowns: through a willow's thin curtains these show as dark balls.
- **Reeds.** The village's reed builder now takes its segment counts, so each of the marsh's reeds uses about half a village reed's triangles (82k for all of them), and they build twelve plants per slice. They batch in 5 m squares (the builder's `cell`), not the village's 7 m bands along the brook, so batches out of view, and their shadows, cull.
- **Fireflies.** One instanced mesh of 80 small icosahedra in an additive basic material, hidden until blue hour. The heron's body and neck are two meshes. The marsh overview compiles 71 shader programs against `main`'s 67 there.
- **The village.** The scatter still tests the colliders it always had, so the village's random stream is unchanged. Its field grass gives way where the marsh ground begins, and the brook's south piece now stops at the new footbridge.

Counted in the cloud container (SwiftShader, so no timings) at 1200 × 750, high quality, `?resolution=fixed`, with the frame-locked probe, against `main` (`db3b858`):

| View | `main` draws / triangles | Willow marsh draws / triangles |
| --- | --- | --- |
| Marsh overview from the east trail (22.9, 29.2), height 18 | 304 / 1.28M (empty field) | 413 / 1.77M |
| Marsh overview, height 30 | 369 / 1.46M | 465 / 1.97M |
| Village's south edge (10, 18), height 18 | 710 / 2.22M | 770 / 2.65M |
| First person on the boardwalk (7.1, 29.6) | 257 / 0.68M | 395 / 1.23M |
| First person by the hide (11, 34.4), facing the village | 705 / 1.67M | 829 / 2.23M |
| First person on the boardwalk at blue hour | 323 / 0.94M | 449 / 1.50M |

At the green with every region streamed in (frame-locked, the same frames), the marsh first raised the peak from 2.77M to 3.31M triangles while none of it was in view; the visibility and batching changes above bring it to 3.00M, on the frames that capture a water reflection, and the others to 2.74–2.77M. The inside of the village's south edge peaks at 2.79M, its other edges at 2.62M or less, and the marsh's benchmark viewpoint at 507 draws and 1.96M triangles.

### Market lane (2026-11-02)

Phase 5 of the map expansion. A gravel lane leaves the mill road just east of the village's bridge and runs east to the map's rim, through a market square with four stalls under striped awnings and bunting, past the Copper Kettle tea room and the post office, to a signpost, a parked cart and hedgerows where it leaves the map. A second footbridge crosses the brook south of the first, with paths to the square and to the kitchen gardens' road. The lane is flat and has no ground mesh of its own: its shape, colliders, decks and grass mask load with the village from `src/regions/market-layout.js`, and everything else streams in from `src/regions/market.js` (seven jobs: the gravel, the footbridge, the tea room, the post office, the stalls with bunting, lamps and shrubs, the lane's end, and the residents Hazel and Bram, who join through `life.addResident`).

- **Draws.** Each piece is one vertex-coloured mesh with one shared material, plus one mesh on the village's lamp glass for its windows, paper lanterns and lamps (so they glow at blue hour) and a painted sign or two. The gravel is one mesh in the village paths' material. No new shader programs.
- **Lamps.** The lane's three lamps join the fixed pool of six point lights through `world.addLamps`; the pool still moves to the lamps nearest the view.
- **The village.** The paths that reach into the village clear its grass after the scatter, and the scatter itself still tests the colliders it always had (the brook in one piece, no footbridge), so the village's random stream is unchanged. A frame-locked comparison against `main` shows identical pixels at spawn and on the orchard hill; elsewhere only the new gravel and footbridge differ.

Counted in the cloud container (SwiftShader, so no timings) at 1200 × 750, high quality, `?resolution=fixed`, against `main` (`5c01565`):

| View | `main` draws / triangles | Market lane draws / triangles |
| --- | --- | --- |
| Village overview at spawn, height 18 | 753 / 2.58M | 757 / 2.60M |
| Market square (33.5, 3), height 18 | 437 / 1.50M (empty field) | 541 / 1.56M |
| Market square, height 30 | 630 / 1.77M | 732 / 1.82M |
| First person in the square, facing west along the lane | 1,208 / 2.62M | 1,307 / 2.65M |

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

### Millpond (2026-11-01)

Phase 3 of the map expansion. The brook now runs on past the village's north edge, under a footbridge, to a stone weir; above the weir it widens into a still pond about 17 × 11 m with a fishing jetty, a boathouse, a moored boat, reeds and lilies. Everything streams in after the village from `src/regions/millpond.js` (six jobs: banks and bed, water and cascade, structures, stones, lilies, reeds), plus the fishing float. The pond's shape, its banks and bed as terrain data (about half a metre of bank, the first heights outside the flat village), its colliders and the jetty's and footbridge's decks load with the village from `src/regions/millpond-layout.js`.

- **Water.** Two new bodies instead of extending the village brook's 64 × 640 grid: the pond (112 × 78 cells of about 16 cm, closed edges, a third of the brook's reflection rate) and the 3.1 m of brook between the weir and the village (64 × 48, the village brook's cell size). `addBody` gained per-body `grid`, `segments`, `shore`, `ramp`, `openEnds` and `reflectionEvery` (see [docs/water.md](water.md#adding-another-pool)). The new surfaces use the existing water program.
- **Draws.** The banks and bed are one 25,000-triangle mesh that tints the open country's grass texture, so it meets the fields without a seam; the weir, footbridge, jetty, boathouse, boat and bench share one vertex-coloured mesh. Shore stones, lily pads and lily flowers are one instanced mesh each; the reeds use the village's reed builder.

Counted in the cloud container (SwiftShader, so no timings) at 1200 × 750, high quality, `?resolution=fixed`:

| View | Draw calls | Triangles |
| --- | --- | --- |
| Pond overview, player at (9, −25), height 18 | 744 | 2.44M |
| Pond overview, height 30 | 669 | 1.85M |

### Streaming and distance limits (2026-10-31)

Phase 2 of the map expansion: the map grows to 96 × 84 m (`WORLD.ground`), four times the village's area, with the village unchanged in the middle (`WORLD.village`) and open, empty fields around it. The walk box, camera clamp, route grid, plantable area and shadow extent follow the new rim; the overview follows the player out to it. The brook still ends at the village's edge, against a grass bank. The fields' grass top is one surface with the village cut out, so no seams cross it.

- **Streaming.** The village still builds before the loading screen lifts. After it, `src/regions/outskirts.js` loads with `import()` and hands 16 grass patches, one per chunk around the village (about 600–850 blades each, from `chunkRandom`), to the streamer in `src/streaming.js`, which builds the nearest for 2.5 ms of each frame and adds each patch once `compileAsync` reports its shaders ready, one patch per frame. Shaders compile for the composer's render target the scene is drawn into: compiled for the screen, the patches built a program they never used, in a 60–80 ms long task. The patches share the village's grass material, so no new program is compiled at all. The 139 × 117 route grid streams in the same way instead of being sampled on the first click; a click before it finishes completes it. Patches are left out of the brook's reflection captures.
- **Zoom cap.** The overview stops zooming out at height 30 instead of 39 until zoom-based detail reduction exists. (Lifted back to 39 with [zoom detail](#zoom-detail-2026-11-02).)
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

### Kitchen garden (2026-10-31)

The fenced kitchen garden moved into `src/garden.js` and gained mixed vegetables, a cutting border, a rose arch, a scarecrow and props. Plants share one vertex-coloured material and painted props another; timber reuses the village's wood, dark wood, trim and path materials, so the bake gains two batches. The garden's static geometry grew from about 6,000 to 33,000 triangles. Counts only, measured in a GPU-less container with SwiftShader at 1200 × 750, high quality, against `529e708`; frame times there are not meaningful.

| View                   | Draw calls before → after | Triangles before → after |
| ---------------------- | ------------------------- | ------------------------ |
| Default (spawn)        | 1,077 → 1,079             | 2.787M → 2.836M          |
| Garden framed, zoomed in | 515 → 517               | 1.975M → 2.025M          |

### Route grid and lantern pool (2026-10-31)

`findPath` used to re-check every collider for each cell it visited, sort its open list on every step and stop after 5,000 steps. It now samples the 65 × 53 route grid's walkability once, on the first click (about 3,400 `blocked` calls), and searches with a binary heap and no step cap. From spawn in headless Chromium: a route to the far bank at (19, −2.5) took 3.2 ms before and 0.2 ms after, (−19, −15) took 10.7 ms and 0.3 ms, and an unreachable click behind the mill took 39 ms and 1.8 ms to give up. Routes are the same length. The six lanterns' `PointLight`s became a fixed pool of six (see the checklist); draw calls, triangles and shader programs at the default view and in first person are unchanged.

### Water refraction from the main pass (2026-10-30)

Before is `1a2624c`; after renders refraction from the main pass. Both predate the resolution and bloom changes, so high quality ran at pixel ratio 1.75. Runs alternated before and after while holding the shared GPU lock, so no other benchmark or test browser was rendering: two pairs at DPR 1 with `npm run benchmark`, and three pairs at DPR 2 with a copy of the script using `deviceScaleFactor: 2` and Chrome's `--disable-frame-rate-limit --disable-gpu-vsync`. Values are medians of the per-run means.

| Quality     | DPR 1 frame ms (FPS)      | DPR 2 uncapped frame ms (FPS) | Draw calls  | Triangles     |
| ----------- | ------------------------- | ----------------------------- | ----------- | ------------- |
| High        | 35.7 → 29.7 (28.0 → 33.7) | 52.5 → 40.4 (19.1 → 24.7)     | 1,268 → 878 | 3.86M → 2.83M |
| Balanced    | 32.2 → 26.3 (31.1 → 38.0) | 32.8 → 26.8 (30.4 → 37.3)     | 1,246 → 844 | 3.85M → 2.76M |
| Performance | 25.9 → 23.4 (38.6 → 42.8) | 20.5 → 16.8 (48.9 → 59.5)     | 1,159 → 767 | 3.57M → 2.51M |

Every paired run favored the after build. DPR 1 frame intervals snap to display refresh multiples, so the uncapped DPR 2 runs show the GPU saving more directly: 12 ms per frame at high quality. Each frame submits about 390 fewer draws and 1.0–1.1M fewer triangles at the spawn view. Performance quality saves the least time because its separate capture was already at half resolution.

### Foliage comparison (2026-10-30)

These are sequential headless Chrome runs at 1600 × 1000, with frame-rate limiting and vsync disabled. Before is `1a2624c` and after is the foliage change alone, so both predate the refraction, resolution, and bloom changes. The two changes overlap: the refraction saving here came from removing foliage from a refraction capture that the main pass now supplies, so foliage exclusion now saves only its share of the reflection captures and the fallback capture. Each sampled frame ends with a one-pixel `readPixels`, so the time covers GPU completion. Values are medians of two runs at high quality. In these runs, frames on unchanged code varied by about ±1 ms.

| View                     | DPR 1 ms before → after | DPR 2 ms before → after | Triangles before → after |
| ------------------------ | ----------------------- | ----------------------- | ------------------------ |
| Default (view height 18) | 37.1 → 32.8             | 59.8 → 55.8             | 3.86M → 3.09M            |
| Zoomed in (10)           | 28.4 → 28.1             | 47.7 → 45.7             | 3.19M → 2.63M            |
| Zoomed out (39)          | 39.8 → 32.8             | 58.6 → 48.3             | 4.45M → 2.86M            |
| First person             | 25.4 → 21.7             | 39.0 → 34.9             | 2.82M → 2.08M            |

Interleaved A/B toggles in a single page measured each change's share at DPR 1, default view. Leaving foliage out of the water captures saved 3.6 ms (5.7 ms at DPR 2). Coarse leaves at maximum zoom-out saved 3.5 ms (4.6 ms at DPR 2). At the default view, the remaining detailed tree leaves cost about 3.5 ms, and all shrub leaves together cost about 0.7 ms. Absolute times include contention from other local GPU work, so compare the differences rather than the totals.

### Local comparison (2026-10-29)

Sequential headless Chrome runs at 1600 × 1000, DPR 1, with a fresh save and the camera settled at spawn. The baseline was commit `d52ccce`; the after run added the first of the reductions under [Work reduction](#work-reduction-in-the-current-build). Values are means except the last column.

| Quality     | FPS before → after | CPU ms before → after | Draw calls before → after | Triangles before → after | Frame p95 ms before → after |
| ----------- | ------------------ | --------------------- | ------------------------- | ------------------------ | --------------------------- |
| High        | 26.1 → 30.3        | 37.9 → 7.6            | 2,768 → 1,034             | 3.78M → 2.70M            | 50.1 → 50.0                 |
| Balanced    | 26.2 → 44.1        | 37.9 → 6.9            | 2,753 → 986               | 3.78M → 2.61M            | 50.1 → 50.0                 |
| Performance | 41.5 → 47.7        | 23.1 → 4.6            | 2,367 → 931               | 3.32M → 2.50M            | 49.9 → 33.4                 |

High quality remains limited by rendering on this setup; lower submission cost does not guarantee 60 FPS. Re-run the benchmark on the target device, especially at higher device pixel ratios. The raw local reports are `output/performance-before.json` and `output/performance-after.json` (ignored build artifacts).

### Resolution comparison (2026-10-29)

Headless Chrome at 1600 × 1000 CSS pixels and device pixel ratio 2, on an Apple M5. The baseline is commit `1a2624c` (high at pixel ratio 1.75); the after runs use the policy under [Resolution and default quality](#resolution-and-default-quality). Baseline and branch were served side by side and measured alternately. Other test browsers were running on the machine, so absolute values vary between rounds. The figures below come from the two quietest rounds, where CPU time per frame returned to 4–5 ms.

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
