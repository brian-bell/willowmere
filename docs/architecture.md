# Code map

Where Willowmere's code lives, how the world beyond the village plugs in, and how the tests reach the game. [Rendering performance](performance.md) covers what each frame costs and the rules for new scenery; [Water](water.md) covers the water system.

## Entry points

- `index.html` loads `src/main.js`, the game. `/?interior=bakery` starts inside the bakery, `/?interior=rosewood` inside Rosewood, your cottage, `/?interior=heron` inside The Drowsy Heron, `/?interior=windmill` at the foot of the old windmill, `/?interior=post-office` inside the post office, `/?interior=thistledown` inside Thistledown, the village's bed & breakfast.
- `water-study.html` loads `src/water-study.js`, a close-up view of the village water with diagnostics. It is part of the production build.
- `tree-study.html` is a close-up page (its script is inline) for the tree models. It is part of the production build.
- `pub-study.html` loads `src/pub-study.js`, the design study for The Drowsy Heron, the inn on the market square. It is part of the production build. See [The Drowsy Heron](#the-drowsy-heron).
- The settings dialog lists the studies: a button into the bakery interior and links to the three study pages.

All art and audio are generated in code. `vite.config.js` splits Three.js into its own chunk, and each region's builder loads with `import()`, so it gets a chunk of its own.

## The outdoor game

`src/main.js` wires the outdoor game together: renderer, scene and lights, input, first person, the transitions into the walkable rooms and the frame loop. Each subsystem it coordinates is a factory in `src/game/`:

| Module | Owns |
| --- | --- |
| `resolution.js` | the adaptive pixel ratio |
| `overview-camera.js` | yaw, tilt, pan, zoom and follow |
| `shadows.js` | fitting the sun's shadow to the view |
| `detail.js` | which levels of detail each zoom and distance draws, as pure thresholds |
| `navigation.js` | collision and route finding |
| `save.js` | the visit's progress in browser storage: a versioned save, merged field by field into the defaults, with migrations for changed fields |
| `hud.js` | toasts, the quest card, conversations and the journal |
| `activities.js` | quests, flowers, fishing, the orchard harvest, the market's deliveries and stalls, birdwatching at the marsh's hide, pressing the old wood's flowers, the allotment beds |
| `market.js`, `marsh.js`, `wood.js`, `allotments.js` | the market's trade, the hide's birdwatching, the wood's flower pressing and the allotment beds' renting, sowing, growing and harvesting rules, as pure decisions on the save's state |
| `rosewood.js` | Rosewood's treasures (what Bark digs up), the jigsaw, and the footstep trail Bark follows, as pure decisions |
| `interactions.js` | the prompt and what E does |
| `debug-api.js` | `window.__willowmere`, which tests and benchmarks use |

Game text lives in `src/content/` (journal, landmarks, neighbours, and one file per region with residents). Keep new logic out of `main.js`: add it to the module it belongs to, or a new one, and keep pure decisions free of three.js and the DOM so `@logic` tests can run them in Node.

## The world

- `src/world-layout.js` holds the map's bounds (walk box, camera clamp, shadow extent, plantable area), the 16 × 14 m chunk grid, the named areas behind the location label, `terrainHeight(x, z)` and `chunkRandom(cx, cz)`. Read limits from here instead of hard-coding them.
- `src/world.js` puts the world together: it creates the water and the chunk grid, calls the village's builders, joins the brook's and the regions' colliders, bakes the village, and exposes `addStreamed`, `addLamps`, `animate` and `trees` to streamed regions.
- `src/village/` builds the village, one module per part: `kit.js` (the shared random stream, materials, textures and the `box`/`cyl`/`orb`/`beam`/`label` helpers), `ground.js`, `paths.js`, `brook.js` (and the bridge), `buildings.js`, `fountain.js`, `furniture.js` (benches, fences, the kitchen garden's enclosure), `lamps.js` (lamps and the fixed light pool), `plants.js` (trees, shrubs, meadow, reeds, lavender, cobbles), `accents.js` and `rosewood-yard.js` (Rosewood's kitchen extension and back garden, which draws no random numbers). The builders draw from one random stream in the order `world.js` calls them, so a new `rand()` call, or a reordered builder, moves everything placed after it. Give new village features their own seeded stream, as `garden.js` does. `node scripts/world-fingerprint.mjs <out.json>` hashes the whole world without a browser; compare its output on `main` and on a branch to show a refactor changed nothing.
- `src/bake.js` holds the chunk grid's bake, which merges the village's static meshes per chunk, material and shadow role, first person's detail range, and the small detail and thin shadow casters the overview drops when zoomed far out.
- `src/streaming.js` builds everything beyond the village after the game starts, a slice of each frame at a time.
- Scenery: `src/trees.js` (branching trees, leaves, wind, levels of detail), `src/flowers.js`, `src/bushes.js`, `src/reeds.js`, `src/riverbank.js`, `src/planters.js` (pots, window boxes, beds), `src/garden.js` (the kitchen garden), `src/sky.js` (first person's sky).
- Life: `src/life.js` (the traveler, residents and wildlife), `src/people/` (how a person is built), `src/cats.js`, `src/fishing.js` (the millpond's cast and bite).
- People: a resident's definition (in `src/life.js`, or `src/content/` for those who stream in with a region) carries a look: `garment`, `hat`, `hairStyle`, `apron`, `carry` and so on, and an unknown name throws. `src/people/index.js` assembles a figure and animates it, `clothes.js` covers neck to boots, `heads.js` faces, hair and hats, `props.js` what is held or worn, `kit.js` the verbs they build with, and `shapes.js` the shared shapes. Clothes are laid over a body's profile (`panel`), so they follow its curve. Only `walks` keeps hips, knees and elbows; everyone else's fold into the parts that move, so a standing figure is five batches and a contact shadow. A shape's `tone` attribute paints pleats, combed hair and plaited straw into the vertex colours when the batches merge, for no draw or texture.
- Presentation: `src/bloom.js` (quarter-resolution bloom), `src/scene-target.js` (the format of the target a scene draws into), `src/shadow-maps.js` (depth-only shadow maps, which `shader-chunks.js` reads), `src/shader-chunks.js` (cheaper versions of Three's lighting and shadow chunks, imported by each entry point), `src/effects.js` (gathering, planting and watering particles), `src/visibility.js` (the player's silhouette behind scenery), `src/audio.js` (synthesized ambience), `src/icons.js` and `src/style.css`.
- Water: `src/water.js`, `src/water-shaders.js` and `src/water-bounds.js` (the parts of the screen refraction resolves), described in [Water](water.md).
- The walkable rooms: `src/interior.js` and `src/interior.css` (camera, input, interactions, postprocessing, pause menu, entry and exit, shared by every room), `src/interior-movement.js` (grounded movement, furniture collision and keeping to a ladder), `src/interior-ao.js` (the rooms' contact occlusion, which the pub's study also uses), `src/interior-kit.js` (the rooms' seeded random stream, materials, primitives, `paintFlat`, which folds flat colours into a few vertex-coloured materials, and the bake that merges a dressed room by material), and one builder per room: `src/bakery.js` (The Daily Loaf), `src/rosewood.js` (your cottage: hall, living room, bedroom, kitchen and back garden, and Bark), `src/pub/room.js` (The Drowsy Heron), `src/windmill/room.js` (the old windmill), `src/post-office/room.js` (the post office) and `src/thistledown/room.js` (the B&B). A room returns its scene, shadowing lights, walkable layout, the points E answers at, and `update`; it may add `interact(point)` for activities, `takeNote()` for things that happen on their own, `staticShadows` when nothing that moves casts a shadow, and `diagnostics()`. A new room is a builder plus one line in `ROOMS` in `src/interior.js` and in `INTERIOR_NAMES` in `src/main.js`; its words go in `src/content/<room>.js`.

## Regions

Each area beyond the village (the millpond, the orchard hill, the inn, the market lane, the willow marsh, the old wood, the allotments, and the open fields around them) is an entry in the registry, `src/regions/index.js`. The terrain field, the location label, the open country's grass and soil, walking and click heights, planting, colliders and streaming all loop that list, so a new region adds one line there instead of edits to the core files. The fields an entry may set are documented at the top of that file.

A region has two halves:

- **A layout module** (`*-layout.js`), loaded with the village and free of three.js. It exports the registry entry: label area, ground box, terrain height, decks, water, colliders, grass and planting masks, and `stream`. Anything whose shape matters before the meshes arrive lives here. Colliders can be a shape (`{ minX, maxX, minZ, maxZ, blocks(x, z, r) }`), which `blocked()` tests only inside its box.
- **A builder** that `stream(T, world, game)` loads with `import()` once the village is on screen. It resolves to `{ jobs, ...api }`. Each job is `{ x, z, step(deadline) }`: `step` works until `performance.now()` passes the deadline and returns nothing to be called again, or the finished objects. The rest of the object goes to the region's game logic through `activities.regionLoaded`. `game` carries `life`, for residents (`life.addResident`), and `dusk()`, how far into blue hour the day is.

Builders make their structures with the shared parts kit in `src/regions/kit.js` (painted boxes, posts, beams, rods and glass, merged into one vertex-coloured mesh plus one glass mesh) and their paths with `src/regions/lines.js`, rather than their own helpers. They register meshes with `world.addStreamed(mesh, { detail })`, animations with `world.animate(x, z, update)` and lamps with `world.addLamps`, seed their layout with `chunkRandom(cx, cz)` and seat placements on `terrainHeight(x, z)`. Trees on raised ground share the village trees' resources through `world.trees`, as `src/regions/orchard.js` shows. [Rendering performance](performance.md#checklist-for-changes) lists the rules that keep a streamed region cheap.

A region with gameplay usually also adds pure rules in `src/game/<region>.js`, its words in `src/content/<region>.js`, a benchmark viewpoint in `scripts/benchmark.mjs` and a draw budget in `tests/performance.spec.js`.

## The Drowsy Heron

The inn is designed once, as one continuous building inside and out, in `src/pub/`, and that design appears three ways: whole in its study, as a walkable room, and as a lean outside on the map.

- `layout.js` is the design on paper, with no three.js: dimensions, walls and their openings, every table and bed, the stair, the storeys' colliders and the walk's floor heights. The builders, the study's walk and the plan drawing all read it, so a table moved here moves everywhere. Set out from it, the plan is an E: a central range between two gabled wings, with the gallery (the front balcony) in the gap.
- `parts.js` paints the materials to known sizes in metres and holds the shared parts: hewn timbers, walls pierced by openings, leaded lights, twisted chimney shafts. `createStorey` wraps the rooms' kit (`src/interior-kit.js`) for each of the building's three parts.
- `exterior.js` builds the shell, the roof and the yard, `great-room.js` the ground floor, `loft.js` the sleeping loft and the roof's frame, and `props.js` the furniture they share. `index.js` assembles them into `ground`, `upper` and `roof` groups, which is what lets the study lift the roof and the loft away. `setting.js` is the sky, sun and lamps that the study and the room share.
- `plan.js` draws the measured plans as SVG from `layout.js`.
- `src/pub-study.js` is the page: views and their notes from `src/content/pub.js`, cutaways, the time of day, and walking with the interior walker (`src/interior-movement.js`), swapping colliders as the stair changes storey.

The roof's pitches are chosen so its planes meet exactly: the wings' slopes run through the main slope, and the line where they cross is the valley. The wings' upper rooms have flat ceilings, so nothing of that junction shows indoors.

On the map it is a region like any other. `src/regions/heron-layout.js` sets the design down north of the market square, at 0.82 scale among its neighbours, facing south as every building does so the overview's camera sees its front. `src/regions/heron.js` runs the same `exteriorSections` from `exterior.js` with lean parts and flat colours, a section per slice of the streamer, so the outside cannot drift from the design. Nothing inside is built there; its door (E) opens the room.

The room is `src/pub/room.js`, one line in `ROOMS` like the others, with one addition to the room contract that any room may use: `eyeAt(walker)` says how high the eye stands, since the stair runs between storeys. The room swaps the walker's colliders as it climbs, and its points answer only on their own storey. It adds no save state: resting in a bed only changes the light of the visit.

## The old windmill

The windmill's door on the orchard hill opens a tower you can climb. Its middle is open from the flags to the cap, with the mill's machinery standing in it, and platforms wind up the wall in the direction of increasing bearing: along a crescent, up a ladder laid against the wall, and onto the start of the next crescent. In order they are the meal floor (the ground, where the flour comes down), the stone floor (with a gangway to a round deck holding the two pairs of stones), the bin floor, the landing with the window seat and the owl, and the dust floor under the cap, where the brake lever and the top windows are.

- `src/windmill/layout.js` is the design on paper, with no three.js: the tower's size (the outside's shape at 2.33 scale, so its proportions follow `ORCHARD.windmill`), floors, ladders, furniture and windows, plus the level rules below. Places are a bearing and a radius from the tower's axis, measured from the door. The outside (`src/regions/orchard.js`) reads its windows from here too, so a window seen from the path is one you can look out of.
- `parts.js` paints the materials and holds the batch the builders add parts to: every part of one material merged into one mesh, tinted by vertex colour, with UVs in metres and the grain along a timber's length.
- `tower.js` builds what stays still, `machinery.js` the moving trains (each wheel's speed follows from its radius and its neighbour's, with nothing that moves casting a shadow), and `setting.js` the sky, sun, shafts of light, flour dust and lanterns. The hill and fruit trees seen from the windows are the real ones from `orchard-layout.js` at the tower's scale, and past them is a painted panorama whose horizon stays at the eye.
- `room.js` is the room itself, one line in `ROOMS` like the others. It adds no save state.

A level is a floor or a ladder. `levelAt` moves a walker onto a ladder when it walks in between the rails from a floor that ladder touches, and off when it walks out past either end, so walking past a foot does not pick you up. `collidersFor` gives the shape for a level: a floor's boards and furniture, or a ladder's narrow lane. `railAt` gives the line a walker keeps to on a ladder, which the walker takes as the layout's `rail(x, z)`: the walking keys then go along the ladder, up it when you face up it and down it when you face down it, at a pace where one footstep's walking is one rung, and turning to look around does not stop you climbing. Any room may use `rail`, and the collider shape `{ blocks(x, z, clearance) }`. Rooms with more than one level may also add `place(pose)`, which lets a test or benchmark stand the walker on a level with `placeInterior({ level, ... })`.

Moving the walker along a curved wall or a turned box needed one general change: when neither axis alone is free, it now slides along the surface by the part of the push that goes that way, and walking straight at a surface still stops dead.

## The post office

The room behind the green door on the market lane, built in `src/post-office/`. Its plan is pure data, as the inn's is, so `@logic` tests walk the same floor the builders dress.

- `layout.js` is the plan, with no three.js: the three spaces (public hall, sorting office, back room), every opening, where each fitting stands and the colliders round it. `FIXTURES` gives the point each thing answers at, read by the builders and by the words in `src/content/post-office.js`, so the two cannot drift. Its door and big window are on the same sides as outside, and the chimney breast is under the roof's stack.
- `parts.js` adds to the rooms' kit what a room of many small parts needs: sharp boxes at 12 triangles, rods between points, boxes textured in metres so a wall's pieces line up, and `mergeGroup`, which merges a moving group's parts, since the room's bake leaves moving things alone.
- `surfaces.js` paints the repeating surfaces and colours, and a shared 2048 atlas that holds every sign, notice, label, stamp and postcard, so a hundred pieces of lettering cost one material. Pieces are collected first and packed tallest first when it is painted. `district-map.js` draws the framed map from the regions' own layouts, so a lane that moves on the map moves on the wall too.
- `shell.js` builds the fabric, with real openings that the sun comes through, and the painted views out of each window. `counter.js`, `sorting.js`, `hall.js` and `back-room.js` dress one space each and return what moves. `room.js` puts them together with the lamps and the sun, and answers E.

It adds no save state. `state` is read once on entering, to put Bram's loaf on his side table once you have delivered one. Everything that moves stays out of the bake and the shadow map, so its one sun map is drawn on opening and kept.

## Thistledown

The village's bed & breakfast, kept by Dot Pennyfeather, who is always just out of sight. Outside it is the cottage at (−15, −3), signed in `src/village/buildings.js`. Inside it is a two-floor house in `src/thistledown/`, set out in metres with the eye at 1.62 m, as in The Drowsy Heron.

- `layout.js` is the house on paper, with no three.js: each floor's walls and their doors and windows, where the big furniture stands, the stair, the floors' colliders and floor heights, which room a point is in (`zoneAt`), and what can be seen from each room (`SEEN_FROM`). The builders and the walker both read it.
- `materials.js` paints the wallpapers, floors and fabrics, and holds the sheet: one texture for every small picture, label and notice in the house, so a hundred of them are one material. `parts.js` is the furniture and tableware, bound to one room by `createParts`; a room is written in floor coordinates, and `fuse` merges a moving group into a single draw.
- `shell.js` builds what every room shares: walls with their finishes, doors, windows and curtains, floors, the roof's slopes and the stair. `ground-floor.js` dresses the hall, breakfast room, kitchen and sitting room; `upper-floor.js` the landing, Goldfinch, Linnet and the bathroom; `outside.js` is what the windows look out on.
- `room.js` puts them together and answers the room contract, including `eyeAt`: the walker's colliders swap as it climbs and points answer only in their own room, so nothing is reached through a wall or ceiling. Its words are in `src/content/thistledown.js`, and breakfast at the hatch is pure rules in `src/game/thistledown.js`. It adds no save state: a breakfast or a nap lasts only for the visit.

## Tests and the debug API

`npm test` runs every Playwright spec in `tests/` against a Vite server it starts on port 5174. Tests tagged `@logic` import pure modules and never open a page; `npm run test:logic` runs only those, in parallel, in seconds. `npm run typecheck` runs TypeScript over the JavaScript files that start with `// @ts-check`: the pure modules, where JSDoc types such as `SaveState` (`src/game/save.js`) and `Region` (`src/regions/index.js`) catch a misspelled field before it ships. Other files are not checked; add the line when a module is pure. CI (`.github/workflows/ci.yml`) builds, type-checks, runs the logic tier, and runs the one `@smoke` test in `tests/smoke.spec.js`, which suits software WebGL. Playwright uses `CHROME_PATH` when set, installed Chrome on macOS, or Playwright's Chromium (`npx playwright install chromium`).

Browser tests drive the game through `window.__willowmere` (`src/game/debug-api.js`). It reads state (`getState`, `getPlayer`, `getView`, `getFishing`, `getOrchard`, `getMarket`, `getMarsh`, `getWood`, `getAllotments`, `getChunks`, `getStreaming`, `getWater`, `getInterior`), moves the player (`moveTo`, `findPath`, `blocked`, and `placeInterior` indoors), reports rendering work (`getDiagnostics`), and overrides rendering for measurements (`tune`, `tuneInterior`, `setAdaptiveResolution`). `getSceneFingerprint()` hashes every object's transform, geometry, material and instances, so a refactor that must not change the world can compare it before and after, with frame-locked screenshots.

| Spec | Covers |
| --- | --- |
| `smoke` | the village loads, draws and starts without errors (CI) |
| `village` | the welcome quest, interactions, garden, journal, photo mode and saved progress |
| `journal`, `save` | the journal's entries; saving, loading, old saves and blocked storage |
| `camera`, `first-person`, `mobile` | the overview camera, first person, and the phone HUD and touch controls |
| `navigation`, `routing` | collision and route finding; click-to-walk across the map and the lantern light pool |
| `world-layout`, `chunks`, `streaming` | the map's bounds, regions and terrain; the chunk bake; streaming and first person's distance limits |
| `millpond`, `orchard`, `market`, `marsh`, `wood`, `allotments` | each region's layout, crossings, routes and activities |
| `cats`, `puppy`, `trees` | wildlife, Lily and Pip, and tree geometry, culling and detail levels |
| `people` | that residents batch tightly wherever they come from, feet stay on the ground standing and walking, and each resident's far copy keeps their shape |
| `water` | the water solver, captures, refraction and fallbacks (see [Water](water.md#verification)) |
| `interior` | the walkable bakery and its rendering settings |
| `rosewood` | Rosewood's rules (logic), its front door, rooms, Bark's following, fetch, dig and the other activities, and its draw budget |
| `post-office` | the post office: that every fitting can be walked to and answers from where a visitor can stand, its words and signs (logic), its door on the lane, its activities, the loaf and its draw budget |
| `pub` | The Drowsy Heron: that every room and bed can be walked to, the stair's climb and the site's footprint (logic), the study's views, cutaways, draw budget and walk, and the door, stairs, balcony and draw budget of the room in the game |
| `windmill` | the old windmill: climbing every ladder up and down, reaching every floor and everything E answers to, staying out of the well, headroom and the windows' match with the outside (logic), and the door, the keys up all four ladders, the brake, the window seat and its draw budget in the game |
| `thistledown` | The B&B: that every room and point can be walked to, the stair's climb and breakfast's rules (logic), its front door, stairs, rooms and activities, and its draw budget |
| `performance`, `tune`, `resolution`, `shadows` | rendering budgets and the measurement hooks (see [Regression budgets](performance.md#regression-budgets)) |
