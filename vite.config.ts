import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/apps/browser/index.html",
    },
  },
  resolve: {
    alias: {
      "@pes/eval": resolve(__dirname, "eval"),
    },
  },
});