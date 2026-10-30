# Willowmere water

Every outdoor pool is registered with `createWaterSystem` in `src/water.js`: the river, the lower wishing-fountain basin, and its upper basin. They share one solver and optical shader, with separate dimensions, depth, absorption, current, wave amplitude, and boundaries. Fountain jets are owned by the same system and inject impacts into the basin they land in.

Open `/water-study.html` for a close view of the actual village water. Choose the river, fountain, millrace, bank, or village view; orbit and zoom; compare afternoon and blue hour; pause; and click the water to inject ripples. This page is included in the production build.

## Fluid model

The GPU stores height perturbation, two face velocities, and foam in a pair of RGBA16F render targets per body. Each step runs a momentum pass followed by a continuity pass. Pressure gradients accelerate the face velocities; depth-weighted flux divergence updates height. Semi-Lagrangian backtracing transports perturbations and foam along the imposed river current and local velocity. Neighbouring cells share face fluxes. Dry cells and the fountain's central stone columns impose closed boundaries. The river ends use damping zones.

Timesteps are subdivided according to the two-dimensional gravity-wave CFL bound for each body's depth and cell dimensions. Frame deltas are capped at 50 ms to avoid catch-up spirals after a stall. Local velocity, height, and foam have finite safety bounds. Impacts use a positive centre and negative surround to avoid steadily adding water. Momentum and foam decay over time. The field is inspected only on an explicit diagnostic request; animation performs no CPU readback.

This is a linearized shallow-water simulation around a prescribed steady current, intended for small real-time village waterways. It is not a full 3D Navier–Stokes solver, a conservative flood model, an ocean FFT, or a simulation of breaking waves. Semi-Lagrangian transport, damping, and safety clamps introduce numerical dissipation. River obstacle deflection and wake circulation are prescribed approximations; impact ripples evolve in the solver.

## Surface and light

- Seven directional gravity waves use physical dispersion, augmented by short capillary detail. Height displaces the tessellated surface; analytical derivatives and the simulated height gradient produce normals.
- Two-phase flow mapping carries fine surface detail along the local current without accumulating texture stretching. Pixel derivatives fade detail that would alias at a distance.
- Planar scene reflections use the same camera type as the caller, including the village's orthographic camera. Clipping excludes geometry below each water plane. Each body owns its reflection matrix and cached texture.
- A shared linear scene-color and depth texture supplies refraction. In the village it is resolved from the main scene pass rather than rendered separately (see [Refraction from the main pass](#refraction-from-the-main-pass)). World positions reconstructed from depth determine optical path length. Foreground samples are rejected to keep banks and bridge rails from bleeding into the water.
- Beer–Lambert absorption creates depth-dependent color. Schlick Fresnel uses water's 1.333 index of refraction, and GGX sunlight uses normal derivatives to reduce sparkling aliasing. The material receives the village's shadows and fog and follows its lighting changes.
- Animated procedural caustics approximate light concentration on submerged surfaces. They are not photon-traced caustics. Advected foam accumulates at impacts and compression, with sparse contact foam along the depth field's edges.

The river has a recessed bed, sloping banks, submerged pebbles, and partially submerged stones with darker, smoother wet edges. Its bathymetry and obstacle mask come from the same field used by the simulation. The fountain has enclosed stone walls and lower floors, so refraction sees real submerged geometry. Ballistic jets and instanced droplets terminate at each basin's water level. Lily pads move with the dominant surface wave.

## Quality and lifecycle

| Setting     | River grid | Each basin grid | Reflection cap | Capture refraction scale | Reflection interval |
| ----------- | ---------- | --------------- | -------------- | ------------------------ | ------------------- |
| High        | 64 × 640   | 96 × 96         | 768²           | 100%                     | at least 1/24 s     |
| Balanced    | 48 × 480   | 64 × 64         | 512²           | 75%                      | at least 1/15 s     |
| Performance | 24 × 240   | 32 × 32         | 256²           | 50%                      | at least 1/8 s      |

The refraction scale applies only to the separate scene capture used by the study. Refraction resolved from the village's main pass always matches that pass's resolution, because a multisample resolve cannot scale; its cost is a copy, not a render.

Orthographic village captures crop the mirrored view to each pool’s projected bounds, including a guard band for waves and distortion. Targets follow that footprint in 64-pixel increments up to the reflection cap; the projected texture coordinates and distortion scale follow the crop. Perspective study captures use the full mirrored view.

After initial captures, at most one body's reflection updates per frame; visible bodies take turns. Refraction updates once per frame. Bodies outside the camera frustum suspend simulation, and stale offscreen impulses are discarded. The frame restores the caller's render target, viewport, scissor, clipping, clear color, tone mapping, shadow-update policy, scene-transform update policy, and XR state. Reflection and refraction captures reuse existing shadows.

Turning off decorative motion freezes fluid time and jet motion while allowing camera and lighting changes. Quality changes recreate bounded simulation resources and reset ripples. The bakery runs in its own scene, suspending the outdoor water update. GPUs without `EXT_color_buffer_float` retain the optical and analytical wave model using byte color captures, with numerical ripple simulation disabled. `dispose()` releases all water-owned targets, textures, geometries, and materials.

The new river dressing uses a separate random sequence and preserves the existing village layout after the retired ripple strips.

## Refraction from the main pass

The water shader needs the opaque scene behind each surface: its linear color and depth. Rendering the scene a second time for this doubled the village's geometry work, so the village shares its main pass instead:

1. `src/main.js` passes the composer's scene target (`composer.readBuffer`, which `RenderPass` draws into) as `target` to `water.render`. Water arms a one-shot resolve for that target and camera, and skips its own scene capture.
2. Each surface has a very high `renderOrder`, so Three.js draws the surfaces after every other opaque object in the same `renderer.render` call.
3. The first surface's `onBeforeRender` blits the target's color and depth (the 4× multisampled renderbuffers) into the water's single-sample `sceneTarget` and its depth texture. The surfaces then draw into the multisampled target, sampling the resolved copy, followed by the scene's transparent objects.

The opaque scene is rasterized once. Transparent objects (jets, droplets, the player's see-through silhouette) are not in the refraction texture; they draw over the water, and none sit below a surface. `diagnostics().refractionSource` is `"main pass"` after a frame that resolved this way.

The shared path needs `EXT_color_buffer_float`, a single RGBA color attachment, a depth buffer without stencil, and no `WEBGL_multisampled_render_to_texture` multisampling (reading such a target would end its multisampling). Otherwise, and whenever no `target` is passed, water renders the scene into `sceneTarget` itself at the quality's refraction scale and reports `"scene capture"`. The water study renders straight to the canvas, so it uses the capture.

## Adding another pool

Call `water.addBody` during world creation with a unique `id`, centre (`x`, `y`, `z`), `depth`, and either `size: [width, length]` or `radius`. Optional settings include a central `hole`, obstacle circles in local coordinates, `flow`, `amplitude`, RGB absorption coefficients, scattering color, and roughness. Build the bed below the given surface height and enclose the edges. Register an impact using `addSource`, or use `addJet` with its start and landing point. Call `disturb(id, worldX, worldZ, strength, radius)` for a discrete interaction.

The world already calls `water.update(dt)`. Immediately before the main scene render, call `water.render(renderer, camera, { dt, dusk, sun, target })`, where `target` is the render target the main pass will draw into with the same camera. Omit `target` when the main pass renders to the canvas. If the caller disables `scene.matrixWorldAutoUpdate`, it must update scene transforms before calling `water.render`; otherwise water updates them before its captures. Surfaces are tagged as dynamic to exclude them from world static-geometry batching. Pass dense scenery that the captures barely resolve, such as individual leaves, to `water.excludeFromCaptures(...objects)`. Each listed object is hidden during reflection captures and the separate refraction capture, then its own visibility is restored. It still casts shadows and appears in the main render, including refraction resolved from the main pass.

## Verification

`npx playwright test tests/water.spec.js` checks boundary constraints and CFL scaling, a real GPU impulse's propagation and decay, dry-cell isolation, renderer-state restoration, every registered village pool, quality changes, paused motion, resize, perspective views, blue-hour rendering, and the float-buffer fallback. `npm test` also exercises the existing village, bridge, trees, puppy, and bakery flows.

The study exposes `window.__waterStudy.diagnostics()` and `inspect(id)` for explicit numerical checks. The village exposes `window.__willowmere.getWater()` without reading back the GPU.

## References

The real-time approach draws on NVIDIA's [Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models), [Fast Fluid Dynamics Simulation on the GPU](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu), and [Generic Refraction Simulation](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-19-generic-refraction-simulation). The installed Three.js water implementation provides the reference for camera mirroring and renderer-state management; this implementation also handles orthographic cameras and multiple independent water levels.
