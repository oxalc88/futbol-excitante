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
 * In browser mode, node:fs writeFileSync works but other fs functions
 * may not be available. We handle this gracefully.
 *
 * For reliable disk writing, see capture-wip.node.test.ts which runs
 * the test via Playwright in node mode.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
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
    // Ensure we have a DOM for the test bridge in browser mode.
    if (typeof document === "undefined") {
      throw new Error("capture-wip.browser.test.ts requires a DOM environment (browser mode)");
    }

    // Reset the bridge (loads scenario, creates renderer).
    await bridge.reset();

    // Advance simulation slightly for visual activity.
    bridge.step(30);
    bridge.renderFrame();

    // Capture via WebGL readPixels → base64 PNG.
    const capture = await bridge.capture();

    // Assertions: screenshot has content.
    expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);

    // Scene diagnostics.
    expect(capture.sceneObjectCount).toBeGreaterThanOrEqual(5);
    expect(capture.cameraPosition.z).toBeGreaterThan(0);

    // Write to disk.  node:fs writeFileSync works in vitest browser mode.
    // In environments where writeFileSync is available but Buffer is not,
    // we decode manually via atob (browser global).
    try {
      const { writeFileSync } = await import("node:fs");
      // Try Buffer.from first.
      try {
        // @ts-expect-error — Buffer may or may not be defined in browser mode.
        writeFileSync(`docs/screenshots/${SECTION}/frame-000.png`, Buffer.from(base64Data, "base64"));
      } catch {
        // Fallback: atob + Uint8Array.
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        writeFileSync(`docs/screenshots/${SECTION}/frame-000.png`, bytes);
      }
    } catch {
      // node:fs unavailable — output base64 to stdout for node-side extraction.
      // The node-side test (capture-wip.node.test.ts) captures this.
      console.log(`[capture-wip:base64]${base64Data}`);
    }
  });
});