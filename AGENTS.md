# Agent guidance

Willowmere is a browser game built with Three.js and Vite. The main page is `index.html`; `water-study.html` is a second production entry point. Wrangler serves the built `dist/` directory as Cloudflare Worker assets.

## Work on branches

- Do all work on a branch. Before editing, check `git status --short --branch`. If on `main`, create or switch to a task branch first. Use the `codex/` prefix for agent-created branches.
- Preserve unrelated local changes. Do not reset, discard, or include them in a commit for the current task.
- Make focused commits on the task branch. Keep `main` for local integration and shipping.

## Develop and verify

- Install locked dependencies with `npm ci`; run the local server with `npm run dev`.
- Run `npm run build` for the production bundle. Run `npm test` for the Playwright regression suite, or `npx playwright test tests/<area>.spec.js` for a focused change. Playwright starts its own Vite server. It uses installed Chrome on macOS, `CHROME_PATH` when set, or Playwright Chromium.
- For rendering changes, inspect the result in a browser. `npm run benchmark -- <label>` measures performance against a separately running dev server; see `docs/performance.md`.
- `src/main.js` coordinates the outdoor renderer, movement, interactions, UI, and save state. `src/world.js` builds the environment and collision layout. `src/water.js` and `src/water-shaders.js` implement the shared water system; read `docs/water.md` before changing it. `src/interior.js` and `src/bakery.js` own the walkable bakery. `src/life.js`, `src/trees.js`, `src/flowers.js`, and related modules build the characters and scenery.
- Art and audio are generated in code. Keep changes compatible with the existing WebGL and browser-based test setup.

## Ship

When the task calls for shipping, integrate locally and deploy in this order:

1. Finish and verify the task branch. Commit only intended changes, and ensure the worktree is clean before switching branches.
2. Update local `main` from the remote: `git switch main`, then `git pull --ff-only origin main`.
3. Merge the task branch into local `main` with `git merge --no-ff <task-branch>`. Resolve any conflicts locally and rerun affected checks.
4. Push the merged `main` with `git push origin main`. Do not deploy if this push fails.
5. Deploy that merged revision to Cloudflare with `npm run deploy` (builds, then runs `wrangler deploy`). Check the live Worker at `https://willowmere.bellbm.workers.dev/` after deployment.

Cloudflare authentication must be available to Wrangler. A GitHub push alone does not publish the site. If deployment fails after the push, report that `main` is pushed but the live Worker is still on the previous deployment, then retry or surface the error. Do not deploy a task branch directly.
