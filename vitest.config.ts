import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default defineConfig({
  ...viteConfig,
  define: {
    // Inject process.env.WIP_* for browser mode (capture-wip reads these).
    "process.env.WIP_SECTION": JSON.stringify(process.env.WIP_SECTION || "capture"),
    "process.env.WIP_FRAMES": JSON.stringify(process.env.WIP_FRAMES || "1"),
    "process.env.WIP_FRAME_STRIDE": JSON.stringify(process.env.WIP_FRAME_STRIDE || "30"),
  },
  test: {
    projects: [
      {
        extends: true,
        name: "node",
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/browser/**/*.test.ts", "**/*.browser.test.ts"],
        },
      },
      {
        extends: true,
        name: "browser",
        test: {
          name: "browser",
          environment: "jsdom",
          browser: {
            enabled: true,
            provider: "playwright",
            instances: [{ browser: "chromium", context: {}, spec: "tests/browser/**/*.test.ts" }],
          },
          include: ["tests/browser/**/*.test.ts"],
          exclude: [],
          define: {
            process: "globalThis.process",
          },
        },
      },
    ],
  },
  resolve: viteConfig?.resolve ?? undefined,
});