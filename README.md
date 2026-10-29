# Willowmere

A playable cozy village built with Three.js. The fixed orthographic camera presents a 2D play field using dimensional scenery, animated characters, lighting, shadows, and procedural materials.

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

## Deploy to Cloudflare

The `willowmere` Worker serves the production build through Cloudflare's static asset hosting. Its configuration is in `wrangler.jsonc`.

Authenticate to the Cloudflare account that owns the Worker, then build and publish:

```sh
npx wrangler login
npm run deploy
```

Deployments are made with Wrangler. GitHub pushes alone do not publish a new version. Credentials and local Wrangler state are excluded from Git.

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
| Zoom                             | Mouse wheel                       |
| Touch                            | Direction pad and Interact button |

## Your first afternoon

Meet Mabel beside the fountain. Gather three of the wildflower bouquets marked by pale rings. Select seeds and plant in an open grassy patch, then select water and give the flowers a drink. Finn can replenish your seed pouch when it gets low. On the lane east of the fountain, Lily walks her puppy Pip; wander over and say hello.

The journal records the welcome objectives. Progress, collected flowers, planted flowers, seeds, and petal currency save to this browser on this device. Browser data clearing removes this save. Different browser origins have separate saves. In private browsing, persistence may be unavailable.

Settings include afternoon / blue hour, ambient audio volume, decorative motion, visual quality, and return to the village green. Ambient wind and birds start only when sound is enabled.

## Implemented systems

- Four cottages, bakery stall and extension, working mill, river bridge, fountain, garden, fences, foliage, flowers, and props.
- Procedural surface textures, overlapping shingles, water shader, instanced leaves/grass, merged static geometry, shadow mapping, multisample rendering, and restrained bloom.
- Traveler gait and turning; four resident conversations, including Lily walking her puppy Pip; wandering cats, birds, butterflies, and drifting motes.
- Acceleration and braking, circular and rectangular collision, grid-based route finding, bridge height following, gathering, planting, watering, rewards, and local save/load.
- Responsive HUD, keyboard and touch input, reduced decorative motion, journal, time-of-day lighting, and photo mode.

## Scope and quality

This is a small complete playable prototype with a short welcome quest and free exploration. It does not contain building interiors, a full economy, a long campaign, multiplayer, or rigid-body simulation. The visual review included several screenshot iterations and comparison with official commercial game screenshots. The independent comparison preferred the commercial reference for finished visual craft. No claim of AAA parity or perfection is made.

## Source map

- `src/main.js`: renderer, camera, movement, collision, route finding, interactions, UI and save state.
- `src/world.js`: environment, procedural materials, foliage, collision layout and water animation.
- `src/trees.js`: branching tree geometry, bark and leaf materials, batched foliage, wind and canopy bounds.
- `src/life.js`: characters, gait, residents and wildlife.
- `src/audio.js`: browser-synthesized ambiance and feedback.
- `src/effects.js`: gathering, planting and watering feedback particles.
- `src/visibility.js`: player silhouettes behind foreground scenery.
- `src/icons.js` / `src/style.css`: interface art and layout.

All game art and audio are constructed in code. Three.js and other dependencies retain their respective licenses. Interface typography uses DM Sans and Lora when available, with local system fallbacks.

## Regression test

Run `npm test` to check the complete welcome quest, planting and watering, journal, photo mode, saved progress, and bridge traversal. The test uses installed Chrome on macOS; elsewhere run `npx playwright install chromium`, or set `CHROME_PATH` to your browser executable.
