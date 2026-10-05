/**
 * @module tests/browser/capture-wip.node.test
 *
 * Node-side capture using the vitest browser test infrastructure.
 *
 * Uses Playwright programmatically to:
 * 1. Start the Vite dev server (needed for the app to load)
 * 2. Load the app in a browser context
 * 3. Wait for the test-bridge to initialize (it injects itself on window)
 * 4. Capture the canvas via WebGL readPixels (through test-bridge)
 * 5. Write the PNG to disk
 *
 * Normal test runs write only to test-results/gauntlet-capture. Durable evidence
 * requires GAUNTLET_EVIDENCE_CAPTURE=1 and refuses to overwrite accepted evidence.
 */

import type { Browser } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

let browser: Browser | null = null;
let viteServer: ViteDevServer | null = null;
let baseUrl = "http://localhost:5178";

async function startVite(): Promise<void> {
  if (viteServer) return;
  // Programmatic pinned-local Vite (the capture-fulltime-flow-closure-menu.mts
  // pattern): no npx resolution, and listen() resolves only when actually ready.
  viteServer = await createServer({
    root: join(__dirname, ".."),
    server: { port: 5178, host: "127.0.0.1", strictPort: true },
    logLevel: "error",
  });
  await viteServer.listen();
  baseUrl =
    viteServer.resolvedUrls?.local[0]?.replace(/\/$/, "") ??
    "http://127.0.0.1:5178";
}

function stopVite() {
  void viteServer?.close();
  viteServer = null;
}

describe("WIP capture: node mode", () => {
  beforeAll(async () => {
    await startVite();
    browser = await chromium.launch({ args: ["--enable-features=WebGL2", "--use-gl=swiftshader"] });
  }, 180000);

  afterAll(async () => {
    stopVite();
    if (browser) await browser.close();
  });

  it(
    "captures 2v2 scenario screenshot and writes to disk",
    async () => {
    const section = process.env.WIP_SECTION || "capture";
    const durableEvidence = process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
    const outDir = durableEvidence
      ? join("docs", "screenshots", section)
      : join("test-results", "gauntlet-capture", section);

    if (durableEvidence && existsSync(join("docs", "evidence", section, "manifest.json"))) {
      throw new Error(`Accepted evidence is immutable: ${section} already has a manifest`);
    }

    console.log(`[node] baseUrl=${baseUrl} section=${section} durable=${durableEvidence}`);

    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const page = await browser!.newPage();

    await page.goto(`${baseUrl}/`);
    await page.waitForTimeout(3000);

    try {
      const dataUrl = await page.evaluate(async () => {
        const bridge = (globalThis as any).__testBridge || (window as any).__testBridge;
        if (bridge && bridge.capture) {
          if (bridge.step) bridge.step(30);
          bridge.renderFrame();
          const cap = await bridge.capture();
          return cap.screenshot;
        }
        return null;
      });

      if (dataUrl && dataUrl.startsWith("data:image/png;base64,")) {
        const base64 = dataUrl.split(",")[1]!;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const framePath = join(outDir, "frame-000.png");
        writeFileSync(framePath, bytes);
        expect(bytes.length).toBeGreaterThan(1000);
        console.log(`[node] wrote: ${framePath} (${bytes.length} bytes)`);
        return;
      }
    } catch {
      // test-bridge not available.
    }

    console.log("[node] fallback: Playwright screenshot.");
    await page.waitForTimeout(2000);
    const screenshot = await page.screenshot({ type: "png", fullPage: false });
    const framePath = join(outDir, "frame-000.png");
    writeFileSync(framePath, screenshot);
    expect(screenshot.length).toBeGreaterThan(1000);
    console.log(`[node] fallback: ${framePath} (${screenshot.length} bytes)`);
  }, 30000);
});
