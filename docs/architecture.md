# Code map

Where Willowmere's code lives, how the world beyond the village plugs in, and how the tests reach the game. [Rendering performance](performance.md) covers what each frame costs and the rules for new scenery; [Water](water.md) covers the water system.

## Entry points

- `index.html` loads `src/main.js`, the game. `/?interior=bakery` starts inside the bakery.
- `water-study.html` loads `src/water-study.js`, a close-up view of the village water with diagnostics. It is part of the production build.
- `tree-study.html` is a development-only page (its script is inline) for the tree models. The build leaves it out.

All art and audio are generated in code. `vite.config.js` splits Three.js into its own chunk, and each region's builder loads with `import()`, so it gets a chunk of its own.

## The outdoor game

`src/main.js` wires the outdoor game together: renderer, scene and lights, input, first person, the bakery transitions and the frame loop. Each subsystem it coordinates is a factory in `src/game/`:

| Module | Owns |
| --- | --- |
| `resolution.js` | the adaptive pixel ratio |
| `overview-camera.js` | yaw, tilt, pan, zoom and follow |
| `shadows.js` | fitting the sun's shadow to the view |
| `detail.js` | which levels of detail each zoom and distance draws, as pure thresholds |
| `navigation.js` | collision and route finding |
| `save.js` | the visit's progress in browser storage: a versioned save, merged field by field into the defaults, with migrations for changed fields |
| `hud.js` | toasts, the quest card, conversations and the journal |
| `activities.js` | quests, flowers, fishing, the orchard harvest, the market's deliveries and stalls, birdwatching at the marsh's hide, pressing the old wood's flowers |
| `market.js`, `marsh.js`, `wood.js` | the market's trade, the hide's birdwatching and the wood's flower pressing rules, as pure decisions on the save's state |
| `interactions.js` | the prompt and what E does |
| `debug-api.js` | `window.__willowmere`, which tests and benchmarks use |

Game text lives in `src/content/` (journal, landmarks, neighbours, and one file per region with residents). Keep new logic out of `main.js`: add it to the module it belongs to, or a new one, and keep pure decisions free of three.js and the DOM so `@logic` tests can run them in Node.

## The world

- `src/world-layout.js` holds the map's bounds (walk box, camera clamp, shadow extent, plantable area), the 16 × 14 m chunk grid, the named areas behind the location label, `terrainHeight(x, z)` and `chunkRandom(cx, cz)`. Read limits from here instead of hard-coding them.
- `src/world.js` puts the world together: it creates the water and the chunk grid, calls the village's builders, joins the brook's and the regions' colliders, bakes the village, and exposes `addStreamed`, `addLamps`, `animate` and `trees` to streamed regions.
- `src/village/` builds the village, one module per part: `kit.js` (the shared random stream, materials, textures and the `box`/`cyl`/`orb`/`beam`/`label` helpers), `ground.js`, `paths.js`, `brook.js` (and the bridge), `buildings.js`, `fountain.js`, `furniture.js` (benches, fences, the kitchen garden's enclosure), `lamps.js` (lamps and the fixed light pool), `plants.js` (trees, shrubs, meadow, reeds, lavender, cobbles) and `accents.js`. The builders draw from one random stream in the order `world.js` calls them, so a new `rand()` call, or a reordered builder, moves everything placed after it. Give new village features their own seeded stream, as `garden.js` does. `node scripts/world-fingerprint.mjs <out.json>` hashes the whole world without a browser; compare its output on `main` and on a branch to show a refactor changed nothing.
- `src/bake.js` holds the chunk grid's bake, which merges the village's static meshes per chunk, material and shadow role, first person's detail range, and the small detail and thin shadow casters the overview drops when zoomed far out.
- `src/streaming.js` builds everything beyond the village after the game starts, a slice of each frame at a time.
- Scenery: `src/trees.js` (branching trees, leaves, wind, levels of detail), `src/flowers.js`, `src/bushes.js`, `src/reeds.js`, `src/riverbank.js`, `src/planters.js` (pots, window boxes, beds), `src/garden.js` (the kitchen garden), `src/sky.js` (first person's sky).
- Life: `src/life.js` (the traveler, residents and wildlife), `src/cats.js`, `src/fishing.js` (the millpond's cast and bite).
- Presentation: `src/bloom.js` (quarter-resolution bloom), `src/effects.js` (gathering, planting and watering particles), `src/visibility.js` (the player's silhouette behind scenery), `src/audio.js` (synthesized ambience), `src/icons.js` and `src/style.css`.
- Water: `src/water.js` and `src/water-shaders.js`, described in [Water](water.md).
- The bakery: `src/interior.js` and `src/interior.css` (camera, input, interactions, postprocessing, pause menu, entry and exit), `src/interior-movement.js` (grounded movement and furniture collision) and `src/bakery.js` (the room, its furnishings, lighting and animation).

## Regions

Each area beyond the village (the millpond, the orchard hill, the market lane, the willow marsh, the old wood, and the open fields around them) is an entry in the registry, `src/regions/index.js`. The terrain field, the location label, the open country's grass and soil, walking and click heights, planting, colliders and streaming all loop that list, so a new region adds one line there instead of edits to the core files. The fields an entry may set are documented at the top of that file.

A region has two halves:

- **A layout module** (`*-layout.js`), loaded with the village and free of three.js. It exports the registry entry: label area, ground box, terrain height, decks, water, colliders, grass and planting masks, and `stream`. Anything whose shape matters before the meshes arrive lives here. Colliders can be a shape (`{ minX, maxX, minZ, maxZ, blocks(x, z, r) }`), which `blocked()` tests only inside its box.
- **A builder** that `stream(T, world, game)` loads with `import()` once the village is on screen. It resolves to `{ jobs, ...api }`. Each job is `{ x, z, step(deadline) }`: `step` works until `performance.now()` passes the deadline and returns nothing to be called again, or the finished objects. The rest of the object goes to the region's game logic through `activities.regionLoaded`. `game` carries `life`, for residents (`life.addResident`), and `dusk()`, how far into blue hour the day is.

Builders make their structures with the shared parts kit in `src/regions/kit.js` (painted boxes, posts, beams, rods and glass, merged into one vertex-coloured mesh plus one glass mesh) and their paths with `src/regions/lines.js`, rather than their own helpers. They register meshes with `world.addStreamed(mesh, { detail })`, animations with `world.animate(x, z, update)` and lamps with `world.addLamps`, seed their layout with `chunkRandom(cx, cz)` and seat placements on `terrainHeight(x, z)`. Trees on raised ground share the village trees' resources through `world.trees`, as `src/regions/orchard.js` shows. [Rendering performance](performance.md#checklist-for-changes) lists the rules that keep a streamed region cheap.

A region with gameplay usually also adds pure rules in `src/game/<region>.js`, its words in `src/content/<region>.js`, a benchmark viewpoint in `scripts/benchmark.mjs` and a draw budget in `tests/performance.spec.js`.

## Tests and the debug API

`npm test` runs every Playwright spec in `tests/` against a Vite server it starts on port 5174. Tests tagged `@logic` import pure modules and never open a page; `npm run test:logic` runs only those, in parallel, in seconds. `npm run typecheck` runs TypeScript over the JavaScript files that start with `// @ts-check`: the pure modules, where JSDoc types such as `SaveState` (`src/game/save.js`) and `Region` (`src/regions/index.js`) catch a misspelled field before it ships. Other files are not checked; add the line when a module is pure. CI (`.github/workflows/ci.yml`) builds, type-checks, runs the logic tier, and runs the one `@smoke` test in `tests/smoke.spec.js`, which suits software WebGL. Playwright uses `CHROME_PATH` when set, installed Chrome on macOS, or Playwright's Chromium (`npx playwright install chromium`).

Browser tests drive the game through `window.__willowmere` (`src/game/debug-api.js`). It reads state (`getState`, `getPlayer`, `getView`, `getFishing`, `getOrchard`, `getMarket`, `getMarsh`, `getWood`, `getChunks`, `getStreaming`, `getWater`, `getInterior`), moves the player (`moveTo`, `findPath`, `blocked`), reports rendering work (`getDiagnostics`), and overrides rendering for measurements (`tune`, `tuneInterior`, `setAdaptiveResolution`). `getSceneFingerprint()` hashes every object's transform, geometry, material and instances, so a refactor that must not change the world can compare it before and after, with frame-locked screenshots.

| Spec | Covers |
| --- | --- |
| `smoke` | the village loads, draws and starts without errors (CI) |
| `village` | the welcome quest, interactions, garden, journal, photo mode and saved progress |
| `journal`, `save` | the journal's entries; saving, loading, old saves and blocked storage |
| `camera`, `first-person`, `mobile` | the overview camera, first person, and the phone HUD and touch controls |
| `navigation`, `routing` | collision and route finding; click-to-walk across the map and the lantern light pool |
| `world-layout`, `chunks`, `streaming` | the map's bounds, regions and terrain; the chunk bake; streaming and first person's distance limits |
| `millpond`, `orchard`, `market`, `marsh`, `wood` | each region's layout, crossings, routes and activities |
| `cats`, `puppy`, `trees` | wildlife, Lily and Pip, and tree geometry, culling and detail levels |
| `water` | the water solver, captures, refraction and fallbacks (see [Water](water.md#verification)) |
| `interior` | the walkable bakery and its rendering settings |
| `performance`, `tune`, `resolution`, `shadows` | rendering budgets and the measurement hooks (see [Regression budgets](performance.md#regression-budgets)) |
