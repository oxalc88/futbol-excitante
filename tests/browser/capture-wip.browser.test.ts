/**
 * @module tests/browser/capture-wip.browser.test
 *
 * Browser Mode screenshot capture for WIP evidence.
 *
 * Runs in Vitest Browser Mode (Playwright + Chromium with GPU).
 * Captures the app's render output via WebGL readPixels (same pipeline
 * as the test-bridge) and writes PNGs to docs/screenshots/<section>/.
 *
 * Usage:
 *   WIP_SECTION=<objective-id> pnpm run capture-wip
 *
 * The test captures via test-bridge and writes PNGs for the builder
 * to include as evidence. No acceptance claims — diagnostic evidence only.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 * Node I/O (writeFileSync) is allowed in the eval layer.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { saveCapture } from "../../eval/capture-snapshot.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";

// ---------------------------------------------------------------------------
// Section config
// ---------------------------------------------------------------------------

/**
 * Configuration for this capture run.
 * Builder scripts override these to target a specific section.
 */
const SECTION = process.env.WIP_SECTION || "capture";
const FRAME_COUNT = parseInt(process.env.WIP_FRAMES || "1", 10) || 1;

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let bridge: TestBridge;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
  bridge = createTestBridge(container);
});

afterEach(() => {
  try {
    bridge.getPresentationSession().dispose();
  } catch {
    /* already disposed */
  }
  if (container.parentElement) {
    container.parentElement.removeChild(container);
  }
});

// ---------------------------------------------------------------------------
// Capture WIP evidence
// ---------------------------------------------------------------------------

describe(`WIP capture: ${SECTION}`, () => {
  it("captures render output and writes to disk", async () => {
    const { writeFileSync, mkdirSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");

    const outDir = join("docs", "screenshots", SECTION);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    // Reset the bridge (loads scenario, creates renderer).
    await bridge.reset();

    // Capture each frame.
    for (let i = 0; i < FRAME_COUNT; i++) {
      // Render current state.
      bridge.renderFrame();

      // Capture via WebGL readPixels → base64 PNG, then decode to disk.
      const capture = await bridge.capture();
      const framePath = join(outDir, `frame-${i.toString().padStart(3, "0")}.png`);
      await saveCapture(capture, bridge.stateHash(), framePath);

      // Assertions: screenshot has content.
      expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);
      const base64Data = capture.screenshot.split(",")[1] ?? "";
      expect(base64Data.length).toBeGreaterThan(100);

      // Scene diagnostics.
      expect(capture.sceneObjectCount).toBeGreaterThanOrEqual(5);
      expect(capture.cameraPosition.z).toBeGreaterThan(0);
    }

    // Verify files were created.
    const firstFramePath = join(outDir, `frame-000.png`);
    const stats = (await import("node:fs")).statSync(firstFramePath);
    expect(stats.size).toBeGreaterThan(1000); // at least 1KB PNG
  });
});