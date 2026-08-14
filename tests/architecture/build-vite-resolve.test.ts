/**
 * BUILD-VITE-RESOLVE-001 — Build smoke test.
 *
 * Proves that the Vite entry point resolves and the bundle
 * path exists as expected by Vite's entry resolution.
 *
 * Also runs `pnpm run build` to prove the configured Rollup input
 * (`src/apps/browser/index.html`) resolves and produces an output bundle.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
// Go two levels up from tests/architecture/ to reach the repo root
const root = join(dirname(__filename), "../../");

describe("BUILD-VITE-RESOLVE-001: Vite entry resolves", () => {
  it("index.html exists under src/apps/browser/", () => {
    const htmlPath = join(root, "src/apps/browser/index.html");
    expect(existsSync(htmlPath), "index.html must exist at src/apps/browser/").toBe(true);
  });

  it("main.ts entry file exists under src/apps/browser/", () => {
    const mainPath = join(root, "src/apps/browser/main.ts");
    expect(existsSync(mainPath), "main.ts must exist at src/apps/browser/").toBe(true);
  });

  it("index.html declares the main script module", () => {
    const htmlPath = join(root, "src/apps/browser/index.html");
    const content = readFileSync(htmlPath, "utf-8");
    expect(content).toContain("<script");
    expect(content).toContain("main.ts");
    expect(content).toContain('type="module"');
  });

  it("Vite build resolves the configured entry and emits a bundle", () => {
    // Clean dist before build to ensure we're testing resolution, not stale artifacts.
    try {
      rmSync(join(root, "dist"), { recursive: true, force: true });
    } catch {
      /* ignore */
    }

    // Run the build and capture stdout/stderr.
    const output = execSync("CI=1 pnpm run build", {
      encoding: "utf-8",
      cwd: root,
      stdio: "pipe",
    });

    // Vite prints the resolved input file in its log output.
    // Assert that the configured entry path appears in the build output.
    expect(output).toContain("index.html");

    // After build, dist/ must exist and contain a JS bundle.
    const distDir = join(root, "dist");
    expect(existsSync(distDir), "dist/ must exist after build").toBe(true);

    // dist/ must contain at least one .js file (the compiled entry bundle).
    const distFiles = execSync(`find "${distDir}" -name "*.js" -type f`, {
      encoding: "utf-8",
      cwd: root,
    }).trim();
    expect(distFiles.length).toBeGreaterThan(0);
  });
});