# Agent guidance

Willowmere is a browser game built with Three.js and Vite. The main page is `index.html`; `water-study.html` is a second production entry point. Wrangler serves the built `dist/` directory as Cloudflare Worker assets.

## Work on branches

- Do all work on a branch. Before editing, check `git status --short --branch`. If on `main`, create or switch to a task branch first. Use the `codex/` prefix for agent-created branches.
- Preserve unrelated local changes. Do not reset, discard, or include them in a commit for the current task.
- Make focused commits on the task branch. Keep `main` for local integration and shipping.

## Develop and verify

- Install locked dependencies with `npm ci`; run the local server with `npm run dev`.
- Run `npm run build` for the production bundle. Run `npm test` for the Playwright regression suite, or `npx playwright test tests/<area>.spec.js` for a focused change. Playwright starts its own Vite server. `npm run test:logic` runs only the tests tagged `@logic` in seconds, without a browser or server: tag a test `{ tag: "@logic" }` when it imports pure modules and never opens a page. CI (`.github/workflows/ci.yml`) builds and runs the logic tier and `tests/smoke.spec.js` on every push; Cloudflare still deploys `main` whatever it reports, so run the checks before pushing. It uses installed Chrome on macOS, `CHROME_PATH` when set, or Playwright Chromium.
- For rendering changes, inspect the result in a browser and measure before and after. `npm run benchmark -- <label>` measures the village against a separately running dev server (`--ablate` with `BENCHMARK_SCALE=2 BENCHMARK_UNCAP=1` attributes the frame's cost), and `node scripts/benchmark-interior.mjs <label> --ablate` measures the bakery. Read `docs/performance.md` first: it describes how each frame is built, where the time goes, how to measure at retina density, and a checklist for new scenery, lights, and passes. Add `?resolution=fixed` to the URL when a measurement or test needs a stable pixel ratio.
- `src/main.js` wires the outdoor game together: renderer, scene and lights, input, first person, the bakery transitions and the frame loop. Each subsystem it coordinates is a factory in `src/game/`: `resolution.js` (adaptive pixel ratio), `overview-camera.js` (yaw, tilt, pan, zoom, follow), `shadows.js` (fitting the sun's shadow), `navigation.js` (collision and route finding), `save.js`, `hud.js` (toasts, quest card, conversations, journal), `activities.js` (quests, flowers, fishing, orchard harvest), `interactions.js` (the prompt and what E does) and `debug-api.js` (`window.__willowmere`, which tests and benchmarks use). Game text lives in `src/content/`. Keep new logic out of `main.js`: add it to the module it belongs to, or a new one, and keep pure decisions free of three.js and the DOM so `@logic` tests can run them. `src/world.js` builds the environment and collision layout, and bakes it per chunk. `src/world-layout.js` holds the map's bounds, chunk grid, named regions and terrain height; read limits from there instead of hard-coding them. `src/water.js` and `src/water-shaders.js` implement the shared water system; read `docs/water.md` before changing it. Regions beyond the village live in `src/regions/`: each has a small `*-layout.js` (shape, heights, colliders) loaded with the village and a builder that streams in after it (the millpond, the orchard hill). The layout module exports the region's entry for the registry in `src/regions/index.js`; the terrain, label, colliders, grass, planting and streaming all loop that list, so a new region adds one line there instead of edits to the core files. `src/interior.js` and `src/bakery.js` own the walkable bakery. `src/life.js`, `src/trees.js`, `src/flowers.js`, and related modules build the characters and scenery.
- Art and audio are generated in code. Keep changes compatible with the existing WebGL and browser-based test setup.

## Ship

When the task calls for shipping, integrate locally and deploy in this order:

1. Finish and verify the task branch. Commit only intended changes, and ensure the worktree is clean before switching branches.
2. Update local `main` from the remote: `git switch main`, then `git pull --ff-only origin main`.
3. Merge the task branch into local `main` with `git merge --no-ff <task-branch>`. Resolve any conflicts locally and rerun affected checks.
4. Push the merged `main` with `git push origin main`. Do not deploy if this push fails.
5. Pushing `main` triggers Cloudflare's automatic build and deployment of that revision. Do not run `npm run deploy` for routine shipping. Wait for the deployment to finish, then check the live Worker at `https://willowmere.bellbm.workers.dev/`.

`npm run deploy` (builds, then runs `wrangler deploy`) remains a manual fallback when the automatic deployment fails or is unavailable; it needs Cloudflare authentication for Wrangler. If the live Worker does not update after a push, report that `main` is pushed but the site is still on the previous deployment, then check the Cloudflare build logs or surface the error. Never deploy a task branch.
