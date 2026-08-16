/**
 * @module tests/browser/3v3-match-screenshots.browser.test
 *
 * Captures DYNAMIC_VISUAL evidence screenshots for BROWSER-3V3-MATCH.
 *
 * Uses @vitest/browser/context page.screenshot() which writes PNG files
 * from the Node side (Playwright controls the browser).
 *
 * Captures 4 semantic frames: before, kickoff, play, later.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_3V3 } from "../../src/apps/browser/foundation-scenario.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";

// Absolute path — Playwright resolves relative to the test runner CWD.
const SCREENSHOT_DIR = "/home/ubuntu/projects/oxDeveloop/pes-simulator/docs/screenshots/BROWSER-3V3-MATCH";

let container: HTMLDivElement;
let bridge: TestBridge;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
});

afterEach(() => {
  try { bridge.getPresentationSession().dispose(); } catch { /* already disposed */ }
  if (container.parentElement) container.parentElement.removeChild(container);
});

describe("3v3 DYNAMIC_VISUAL screenshot evidence", () => {
  it("captures 4 semantic frames of 3v3 AI match via Playwright page", async () => {
    const { page } = await import("@vitest/browser/context");

    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();

    // Verify 6 players are present.
    const players = bridge.getSimulation().presentation().players;
    expect(players.length).toBe(6);

    // Frame 1: before — initial state (tick 0).
    bridge.renderFrame();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/frame-before.png`, type: "png" });

    // Frame 2: kickoff — after 60 ticks of CPU play.
    bridge.stepWithCpuControllers(60);
    bridge.renderFrame();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/frame-kickoff.png`, type: "png" });

    // Frame 3: play — after 180 total ticks.
    bridge.stepWithCpuControllers(120);
    bridge.renderFrame();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/frame-play.png`, type: "png" });

    // Frame 4: later — after 360 total ticks.
    bridge.stepWithCpuControllers(180);
    bridge.renderFrame();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/frame-later.png`, type: "png" });

    // Verify simulation advanced.
    expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(360);

    // Verify 6 players still present after match play.
    const finalPlayers = bridge.getSimulation().presentation().players;
    expect(finalPlayers.length).toBe(6);
  });
});
