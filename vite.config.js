import { defineConfig } from "vite";
export default defineConfig({
  build: {
    rollupOptions: {
      input: { village: "index.html", waterStudy: "water-study.html", treeStudy: "tree-study.html" },
      output: { manualChunks: { three: ["three"] } },
    },
  },
});
