# Agent guidance

Willowmere is a browser game built with Three.js and Vite. The main page is `index.html`; `water-study.html` is a second production entry point. Wrangler serves the built `dist/` directory as Cloudflare Worker assets.

## Work on branches

- Do all work on a branch. Before editing, check `git status --short --branch`. If on `main`, create or switch to a task branch first. Use the `codex/` prefix for agent-created branches.
- Preserve unrelated local changes. Do not reset, discard, or include them in a commit for the current task.
- Make focused commits on the task branch. Keep `main` for local integration and shipping.

## Develop and verify

- Install locked dependencies with `npm ci`; run the local server with `npm run dev`.
- Run `npm run build` for the production bundle and `npm test` for the Playwright suite, or `npx playwright test tests/<area>.spec.js` for a focused change. Playwright starts its own Vite server. `npm run test:logic` runs only the tests tagged `@logic` in seconds, without a browser or server: tag a test `{ tag: "@logic" }` when it imports pure modules and never opens a page.
- CI (`.github/workflows/ci.yml`) builds and runs the logic tier and the `@smoke` test on every push. Cloudflare deploys `main` whatever CI reports, so run the checks before pushing.
- For rendering changes, inspect the result in a browser and measure before and after. Read `docs/performance.md` first: it describes how each frame is built, how to measure (`npm run benchmark -- <label>` for the village, `node scripts/benchmark-interior.mjs <label>` for the bakery), and a checklist for new scenery, lights, and passes. Add `?resolution=fixed` to the URL when a measurement or test needs a stable pixel ratio.
- A refactor that must not change the world can compare `window.__willowmere.getSceneFingerprint()` before and after, with frame-locked screenshots.

## Code conventions

`docs/architecture.md` maps the code. The rules that matter most:

- `src/main.js` only wires the outdoor game together; its subsystems are factories in `src/game/`, and game text lives in `src/content/`. Keep new logic out of `main.js`: add it to the module it belongs to, or a new one, and keep pure decisions free of three.js and the DOM so `@logic` tests can run them.
- Read the map's bounds, chunk grid, regions and terrain height from `src/world-layout.js` instead of hard-coding them.
- A region beyond the village is a `*-layout.js` module, a builder that streams in, and one line in the registry `src/regions/index.js`. Builders make structures with the shared parts kit in `src/regions/kit.js` rather than their own helpers.
- Read `docs/water.md` before changing `src/water.js` or `src/water-shaders.js`.
- Art and audio are generated in code. Keep changes compatible with the existing WebGL and browser-based test setup.

## Ship

When the task calls for shipping, integrate locally and deploy in this order:

1. Finish and verify the task branch. Commit only intended changes, and ensure the worktree is clean before switching branches.
2. Update local `main` from the remote: `git switch main`, then `git pull --ff-only origin main`.
3. Merge the task branch into local `main` with `git merge --no-ff <task-branch>`. Resolve any conflicts locally and rerun affected checks.
4. Push the merged `main` with `git push origin main`. Do not deploy if this push fails.
5. Pushing `main` triggers Cloudflare's automatic build and deployment of that revision. Do not run `npm run deploy` for routine shipping. Wait for the deployment to finish, then check the live Worker at `https://willowmere.bellbm.workers.dev/`.

`npm run deploy` (builds, then runs `wrangler deploy`) remains a manual fallback when the automatic deployment fails or is unavailable; it needs Cloudflare authentication for Wrangler. If the live Worker does not update after a push, report that `main` is pushed but the site is still on the previous deployment, then check the Cloudflare build logs or surface the error. Never deploy a task branch.
