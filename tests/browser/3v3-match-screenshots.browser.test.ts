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
import { commands } from "@vitest/browser/context";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_3V3 } from "../../src/apps/browser/foundation-scenario.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";

// Capture-hygiene (0.9.2+): ordinary regression runs must not write
// docs/screenshots/**. Durable evidence is entered only through the explicit
// evidence-mode capture (WIP_SECTION=__EVIDENCE__:BROWSER-3V3-MATCH); an
// ordinary run lands under the ignored test-results/gauntlet-capture/ tree.
const OBJECTIVE_ID = "BROWSER-3V3-MATCH";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const SCREENSHOT_DIR = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;

async function assertEvidenceMutable(): Promise<void> {
  try {
    await commands.readFile(`docs/evidence/${OBJECTIVE_ID}/manifest.json`, "utf-8");
  } catch {
    return; // no manifest yet: durable capture for this candidate is allowed
  }
  throw new Error(
    `Accepted evidence is immutable: docs/evidence/${OBJECTIVE_ID}/manifest.json exists`,
  );
}

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

async function captureFrame(name: string): Promise<void> {
  const capture = await bridge.capture();
  const base64 = capture.screenshot.split(",")[1] ?? "";
  if (!base64 || base64.length < 100) {
    throw new Error(`renderer produced no PNG bytes for ${name}`);
  }
  await commands.writeFile(`${SCREENSHOT_DIR}/${name}`, base64, "base64");
}

describe("3v3 DYNAMIC_VISUAL screenshot evidence", () => {
  it("captures 4 semantic frames of 3v3 AI match via Playwright page", async () => {
    if (DURABLE_EVIDENCE) await assertEvidenceMutable();

    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();

    // Verify 6 players are present.
    const players = bridge.getSimulation().presentation().players;
    expect(players.length).toBe(6);

    // Frame 1: before — initial state (tick 0).
    bridge.renderFrame();
    await captureFrame("frame-before.png");

    // Frame 2: kickoff — after 60 ticks of CPU play.
    bridge.stepWithCpuControllers(60);
    bridge.renderFrame();
    await captureFrame("frame-kickoff.png");

    // Frame 3: play — after 180 total ticks.
    bridge.stepWithCpuControllers(120);
    bridge.renderFrame();
    await captureFrame("frame-play.png");

    // Frame 4: later — after 360 total ticks.
    bridge.stepWithCpuControllers(180);
    bridge.renderFrame();
    await captureFrame("frame-later.png");

    // Verify simulation advanced.
    expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(360);

    // Verify 6 players still present after match play.
    const finalPlayers = bridge.getSimulation().presentation().players;
    expect(finalPlayers.length).toBe(6);
  });
});
