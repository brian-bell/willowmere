# Agent guidance

Willowmere is a browser game built with Three.js and Vite. The main page is `index.html`; `water-study.html` is a second production entry point. Wrangler serves the built `dist/` directory as Cloudflare Worker assets.

## Work on branches

- Do all work on a branch. Before editing, check `git status --short --branch`. If on `main`, create or switch to a task branch first. Use the `codex/` prefix for agent-created branches.
- Preserve unrelated local changes. Do not reset, discard, or include them in a commit for the current task.
- Make focused commits on the task branch. Keep `main` for local integration and shipping.

## Develop and verify

- Install locked dependencies with `npm ci`; run the local server with `npm run dev`.
- Run `npm run build` for the production bundle. Run `npm test` for the Playwright regression suite, or `npx playwright test tests/<area>.spec.js` for a focused change. Playwright starts its own Vite server. It uses installed Chrome on macOS, `CHROME_PATH` when set, or Playwright Chromium.
- For rendering changes, inspect the result in a browser and measure before and after. `npm run benchmark -- <label>` measures the village against a separately running dev server (`--ablate` with `BENCHMARK_SCALE=2 BENCHMARK_UNCAP=1` attributes the frame's cost), and `node scripts/benchmark-interior.mjs <label> --ablate` measures the bakery. Read `docs/performance.md` first: it describes how each frame is built, where the time goes, how to measure at retina density, and a checklist for new scenery, lights, and passes. Add `?resolution=fixed` to the URL when a measurement or test needs a stable pixel ratio.
- `src/main.js` coordinates the outdoor renderer, movement, interactions, UI, and save state. `src/world.js` builds the environment and collision layout. `src/water.js` and `src/water-shaders.js` implement the shared water system; read `docs/water.md` before changing it. `src/interior.js` and `src/bakery.js` own the walkable bakery. `src/life.js`, `src/trees.js`, `src/flowers.js`, and related modules build the characters and scenery.
- Art and audio are generated in code. Keep changes compatible with the existing WebGL and browser-based test setup.

## Ship

When the task calls for shipping, integrate locally and deploy in this order:

1. Finish and verify the task branch. Commit only intended changes, and ensure the worktree is clean before switching branches.
2. Update local `main` from the remote: `git switch main`, then `git pull --ff-only origin main`.
3. Merge the task branch into local `main` with `git merge --no-ff <task-branch>`. Resolve any conflicts locally and rerun affected checks.
4. Push the merged `main` with `git push origin main`. Do not deploy if this push fails.
5. Pushing `main` triggers Cloudflare's automatic build and deployment of that revision. Do not run `npm run deploy` for routine shipping. Wait for the deployment to finish, then check the live Worker at `https://willowmere.bellbm.workers.dev/`.

`npm run deploy` (builds, then runs `wrangler deploy`) remains a manual fallback when the automatic deployment fails or is unavailable; it needs Cloudflare authentication for Wrangler. If the live Worker does not update after a push, report that `main` is pushed but the site is still on the previous deployment, then check the Cloudflare build logs or surface the error. Never deploy a task branch.
