import { defineConfig } from "@playwright/test";
// The fast tier: tests tagged @logic import pure modules and never open a
// browser, so no dev server starts and they run in parallel in seconds.
// `npm test` still runs them with the rest of the suite.
export default defineConfig({
  testDir: "./tests",
  grep: /@logic/,
  fullyParallel: true,
});
