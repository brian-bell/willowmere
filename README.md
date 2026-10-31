# Willowmere

A playable cozy village built with Three.js. Explore from the orthographic village view or switch to first person to walk among the dimensional scenery, animated characters, lighting, shadows, and procedural materials.

## Play

Play the deployed game at **[willowmere.bellbm.workers.dev](https://willowmere.bellbm.workers.dev)**.

For local development, clone this repository and install its locked dependencies. Use Node.js 22.12+ and a browser with WebGL 2 support.

```sh
git clone https://github.com/brian-bell/willowmere.git
cd willowmere
npm ci
npm run dev
```

Open the local address printed by Vite. Build a production web version with `npm run build`. The result is in `dist/`.

During development, open `/tree-study.html` to inspect the broadleaf, amber, and weeping willow models. Drag to orbit, scroll to examine the bark and roots, and switch the lighting or pause the breeze.

Open `/water-study.html` to examine the river, millrace, and fountain at close range. Orbit, switch lighting and quality, or tap the water to create ripples. All three village pools share the GPU shallow-water and optical model described in [Water rendering](docs/water.md).

## Deploy to Cloudflare

The `willowmere` Worker serves the production build through Cloudflare's static asset hosting. Its configuration is in `wrangler.jsonc`.

Pushing to `main` on GitHub triggers Cloudflare's automatic build and deployment, so merging to `main` is the release. Check the live site after the deployment finishes.

To publish manually, for example when the automatic deployment is unavailable, authenticate to the Cloudflare account that owns the Worker, then build and publish:

```sh
npx wrangler login
npm run deploy
```

Credentials and local Wrangler state are excluded from Git.

## Controls

| Action                           | Control                           |
| -------------------------------- | --------------------------------- |
| Walk                             | WASD or arrow keys                |
| Run                              | Shift while walking               |
| Walk to a spot                   | Click a clear path or lawn        |
| Interact / continue conversation | E or Space                        |
| Explore / gather / plant / water | 1 / 2 / 3 / 4                     |
| Journal                          | J                                 |
| Photo mode                       | P; Escape to return               |
| Switch village / first-person view | V or the camera view button     |
| Look around in first person      | Drag; Free look captures the mouse; Escape releases it |
| First-person keyboard navigation | WASD walk / strafe; ↑ / ↓ walk; ← / → turn; Page Up / Down look vertically |
| Zoom / reset zoom                | Mouse wheel or view buttons        |
| Touch                            | Direction pad and Interact button |

## Your first afternoon

Meet Mabel beside the fountain. Gather three of the wildflower bouquets marked by pale rings. Select seeds and plant in an open grassy patch, then select water and give the flowers a drink. Finn can replenish your seed pouch when it gets low. On the lane east of the fountain, Lily walks her puppy Pip; wander over and say hello.

The journal records the welcome objectives. Progress, collected flowers, planted flowers, seeds, and petal currency save to this browser on this device. Browser data clearing removes this save. Different browser origins have separate saves. In private browsing, persistence may be unavailable.

Settings include afternoon / blue hour, ambient audio volume, decorative motion, visual quality, and return to the village green. Ambient wind and birds start only when sound is enabled.

Press **V** or choose **First person** beside the zoom controls to see the village at the traveler’s eye level. Walking follows the direction you are looking, with the same collisions, raised bridge, tools, and interactions. Drag the scene to look around on desktop or touch screens, or choose **Free look** to capture the mouse. **Escape** releases it for using the interface. Switch back with **V** or **Village view**. The camera preference saves with your visit and is restored when you leave the bakery.

## Inside The Daily Loaf

Walk up to the bakery on cottage lane and press **E**, or use **The bakery** button, to step inside Finn’s bakery in first person. You arrive just inside the entrance of a complete room, with four walls, a timber ceiling, and furniture you can walk around. You can also open `/?interior=bakery` directly.

Use **WASD** to walk and strafe, **Shift** to walk faster, and drag to look around. **Free look** captures the mouse; **Escape** releases it. For keyboard-only navigation, **↑ / ↓** walk, **← / →** turn, and **Page Up / Page Down** look up and down. Touch screens have a directional pad and drag-to-look controls.

Look toward nearby objects and press **E** to interact: greet Crumb the flour spirit, pet Cinnamon, warm your hands by the oven, admire the pastries, pause for tea, or ring the counter bell. To leave, approach the entrance, face the door, and press **E**. Your village position and progress are preserved.

**Escape** opens or closes the pause menu when the mouse is free. The menu includes **After hours** lighting, **Photo**, and a return-to-village option. **P** toggles photo mode while keeping the grounded walking controls. The interior loads on first entry and reuses the scene on later visits. It supports reduced decorative motion, narrow screens, and the village’s quality settings.

## Implemented systems

- Four cottages, bakery stall and extension, working mill, river bridge, fountain, garden, fences, foliage, flowers, and props.
- Procedural surface textures, overlapping shingles, water shader, instanced leaves/grass, merged static geometry, shadow mapping, multisample rendering, and restrained bloom.
- Traveler gait and turning; four resident conversations, including Lily walking her puppy Pip; tabby cats that walk, sniff, groom, and nap; birds, butterflies, and drifting motes.
- Acceleration and braking, circular and rectangular collision, grid-based route finding, bridge height following, gathering, planting, watering, rewards, and local save/load.
- Responsive HUD, keyboard and touch input, reduced decorative motion, journal, time-of-day lighting, and photo mode.
- A complete bakery interior with first-person movement, furniture collision, nearby interactions, mouse and touch look, afternoon / after-hours lighting, ambient occlusion, reflections, and an animated hearth.

## Scope and quality

This is a small playable prototype with a short welcome quest, free village exploration, and one walkable bakery interior. Other buildings do not yet have interiors. There is no full economy, long campaign, multiplayer, or rigid-body simulation.

## Source map

- `src/main.js`: renderer, camera, movement, collision, route finding, interactions, UI and save state.
- `src/world.js`: environment, procedural materials, foliage, collision layout and water placement.
- `src/water.js` / `src/water-shaders.js`: shared shallow-water simulation, waves, reflections, refraction, foam, and fountain jets.
- `src/water-study.js`: interactive close-up water study and diagnostics.
- `src/trees.js`: branching tree geometry, bark and leaf materials, batched foliage, wind and canopy bounds.
- `src/bakery.js`: procedural bakery architecture, materials, furnishings, pastries, lighting, and animation.
- `src/interior.js` / `src/interior.css`: first-person camera, input, interactions, postprocessing, pause menu, and entry / exit lifecycle.
- `src/interior-movement.js`: grounded movement, circle and rotated-box collision, and sliding along furniture.
- `src/life.js`: characters, gait, residents and wildlife.
- `src/audio.js`: browser-synthesized ambiance and feedback.
- `src/effects.js`: gathering, planting and watering feedback particles.
- `src/flowers.js`: shared, batched wildflower and garden geometry.
- `src/visibility.js`: player silhouettes behind foreground scenery.
- `src/icons.js` / `src/style.css`: interface art and layout.

All game art and audio are constructed in code. Three.js and other dependencies retain their respective licenses. Interface typography uses DM Sans and Lora when available, with local system fallbacks.

## Regression test

Run `npm test` to check the complete welcome quest, planting and watering, journal, photo mode, saved progress, and bridge traversal. The test uses installed Chrome on macOS; elsewhere run `npx playwright install chromium`, or set `CHROME_PATH` to your browser executable.

The interior tests also cover walking to the bakery door, traversing the room, furniture collision, interacting with Crumb and Cinnamon, leaving through the entrance, mouse capture, pause and photo modes, preserved village state, repeat visits, and touch controls with reduced motion.

For repeatable frame-time and rendering-work measurements, run `npm run benchmark` for the village or `node scripts/benchmark-interior.mjs` for the bakery with the local dev server running. See [Rendering performance](docs/performance.md) for how a frame is built, where its time goes, the measurement method, and the regression budgets.
