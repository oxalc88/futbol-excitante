import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default defineConfig({
  ...viteConfig,
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
          browser: {
            enabled: true,
            provider: "playwright",
            instances: [{ browser: "chromium", context: {}, spec: "tests/browser/**/*.test.ts" }],
          },
          include: ["tests/browser/**/*.test.ts"],
          exclude: [],
        },
      },
    ],
  },
  resolve: viteConfig?.resolve ?? undefined,
});