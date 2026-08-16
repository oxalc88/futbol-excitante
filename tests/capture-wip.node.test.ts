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
 * Usage: WIP_SECTION=SCENARIO-2V2-FIXTURE npx vitest run tests/browser/capture-wip.node.test.ts --project node
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { spawn } from "node:child_process";

let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
let vite: ReturnType<typeof spawn> | null = null;
let port: number | null = null;
let viteStarted = false;

function startVite(): Promise<void> {
  if (viteStarted && vite) return Promise.resolve();
  if (viteStarted) return Promise.resolve();

  return new Promise((resolve, reject) => {
    vite = spawn(
      "npx",
      ["vite", "--port", "0", "--host"],
      {
        cwd: join(__dirname, "..", ".."),
        stdio: "pipe",
        env: { ...process.env, CI: "1" },
      }
    );

    let ready = false;
    const handler = (data: Buffer) => {
      const str = data.toString();
      const match = str.match(/:\s+http:\/\/.*?:?(\d+)\//);
      if (match) {
        port = parseInt(match[1], 10);
        ready = true;
        viteStarted = true;
        vite.stderr?.removeListener("data", handler);
        resolve();
      }
    };
    vite.stdout?.on("data", handler);
    vite.stderr?.on("data", handler);
    vite.on("error", (e) => { viteStarted = false; reject(e); });

    // Timeout after 60s.
    setTimeout(() => {
      if (!ready) {
        vite?.kill("SIGTERM");
        viteStarted = false;
        reject(new Error("vite timeout"));
      }
    }, 60000);
  });
}

function stopVite() {
  viteStarted = false;
  vite?.kill("SIGTERM");
  vite = null;
}

describe("WIP capture: node mode", () => {
  beforeAll(async () => {
    await startVite();
    browser = await chromium.launch({ args: ["--enable-features=WebGL2", "--use-gl=swiftshader"] });
  }, 60000);

  afterAll(async () => {
    stopVite();
    if (browser) await browser.close();
  });

  it(
    "captures 2v2 scenario screenshot and writes to disk",
    async () => {
    const section = process.env.WIP_SECTION || "capture";
    const outDir = join("docs", "screenshots", section);

    console.log(`[node] port=${port} section=${section}`);

    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const page = await browser!.newPage();

    // Navigate to the app's dev server.
    await page.goto(`http://localhost:${port}/`);
    await page.waitForTimeout(3000);

    // Try to capture via test-bridge (injected by test-bridge into window).
    try {
      const dataUrl = await page.evaluate(async () => {
        // The test-bridge is available after the app loads.
        // It exposes capture() on the instance.
        const bridge = (globalThis as any).__testBridge || (window as any).__testBridge;
        if (bridge && bridge.capture) {
          if (bridge.step) bridge.step(30);
          bridge.renderFrame();
          const cap = await bridge.capture();
          return cap.screenshot; // base64 PNG data URL
        }
        return null;
      });

      if (dataUrl && dataUrl.startsWith("data:image/png;base64,")) {
        const base64 = dataUrl.split(",")[1]!;
        // Decode using atob (browser global).
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

    // Fallback: Playwright page screenshot.
    console.log("[node] fallback: Playwright screenshot.");
    await page.waitForTimeout(2000);
    const screenshot = await page.screenshot({ type: "png", fullPage: false });
    const framePath = join(outDir, "frame-000.png");
    writeFileSync(framePath, screenshot);
    expect(screenshot.length).toBeGreaterThan(1000);
    console.log(`[node] fallback: ${framePath} (${screenshot.length} bytes)`);
  }, 30000);
});