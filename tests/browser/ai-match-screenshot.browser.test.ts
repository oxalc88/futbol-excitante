/**
 * @module tests/browser/ai-match-screenshot.browser.test
 *
 * Captures a screenshot of the AI-vs-AI match using the test bridge.
 *
 * Writes the screenshot data to window.__aiMatchScreenshotData for
 * extraction by a node-side helper script.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { buildCaptureMeta } from "../../eval/capture-snapshot.js";
import { FOUNDATION_SCENARIO_AI_VS_AI } from "../../src/apps/browser/foundation-scenario.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";

let container: HTMLDivElement;
let bridge: TestBridge;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
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

describe("AI-vs-AI match screenshot capture", () => {
  it("captures AI-vs-AI match after advancing simulation", async () => {
    // Create bridge with AI-vs-AI scenario.
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_AI_VS_AI);
    await bridge.reset();

    // Advance simulation 120 ticks (2 seconds at 60 Hz) to show activity.
    bridge.stepWithCpuControllers(120);

    // Render and capture.
    bridge.renderFrame();
    const capture = await bridge.capture();

    // Verify capture has content.
    expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);
    expect(capture.sceneObjectCount).toBeGreaterThanOrEqual(5);

    // Verify scene has players (AI-vs-AI scenario has 2 players).
    const players = capture.presentationSnapshot.players;
    expect(players.length).toBe(2);

    // Verify simulation advanced.
    expect(capture.presentationSnapshot.tick).toBeGreaterThan(0);

    // Store screenshot and metadata on window for node-side extraction.
    (window as unknown as Record<string, string>).__aiMatchScreenshotData = capture.screenshot;
    (window as unknown as Record<string, string>).__aiMatchMeta = JSON.stringify(
      buildCaptureMeta(capture, bridge.stateHash()),
    );
  });
});
