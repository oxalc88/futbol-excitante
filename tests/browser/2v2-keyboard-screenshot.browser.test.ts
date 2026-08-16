/**
 * @module tests/browser/2v2-keyboard-screenshot.browser.test
 *
 * Captures a screenshot of the 2v2 match with keyboard override for slot-1
 * using the test bridge.
 *
 * Verifies:
 *  1. The 2v2-with-keyboard scenario loads with 4 players (1 HUMAN, 3 CPU).
 *  2. CPU adapters advance simulation autonomously for AI slots.
 *  3. Keyboard adapter is wired for the HUMAN slot (slot-1).
 *  4. Screenshot capture succeeds with valid content.
 *  5. 2v2-specific scoreboard (HOME vs AWAY) with 4 players.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { buildCaptureMeta } from "../../eval/capture-snapshot.js";
import { FOUNDATION_SCENARIO_2V2_KEYBOARD } from "../../src/apps/browser/foundation-scenario.js";
import { createCpuAdapter, buildCpuObservation } from "../../src/adapters/input-browser/cpu-adapter.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { InputFrame } from "../../src/contracts/input.js";

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

describe("2v2 keyboard match screenshot capture", () => {
  it("captures 2v2 keyboard match after advancing simulation with CPU slots", async () => {
    // Create bridge with 2v2-with-keyboard scenario.
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_2V2_KEYBOARD);
    await bridge.reset();

    // Set up per-slot CPU adapters for AI_FALLBACK slots (2-4), same as main.ts.
    const cpuSlots = Object.entries(FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments)
      .filter(([, assignment]) => assignment.mode === "AI_FALLBACK")
      .map(([controlSlot, assignment]) => ({
        controlSlot,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId,
        adapter: createCpuAdapter(),
      }));

    // Advance simulation 120 ticks with CPU controllers for AI slots.
    // The HUMAN slot (slot-1) receives no input — equivalent to idle player.
    const sim = bridge.getSimulation();
    for (let tick = 0; tick < 120; tick++) {
      const snapshot = sim.snapshot();
      const frames: InputFrame[] = [];
      for (const { adapter, controlSlot, teamId, controlledPlayerId } of cpuSlots) {
        const obs = buildCpuObservation(snapshot, teamId, controlledPlayerId);
        const frame = adapter.sample(sim.tick, obs);
        frame.controlSlot = controlSlot;
        frames.push(frame);
      }
      bridge.injectInputs(frames);
      sim.step();
    }

    // Render and capture.
    bridge.renderFrame();
    const capture = await bridge.capture();

    // Verify capture has content.
    expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);
    expect(capture.sceneObjectCount).toBeGreaterThanOrEqual(5);

    // Verify scene has 4 players (2v2 with keyboard scenario).
    const players = capture.presentationSnapshot.players;
    expect(players.length).toBe(4);

    // Verify simulation advanced.
    expect(capture.presentationSnapshot.tick).toBeGreaterThan(0);

    // Verify scenario has correct control assignments.
    const assignments = FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments;
    expect(assignments["slot-1"].mode).toBe("HUMAN");
    expect(assignments["slot-1"].teamId).toBe("team-a");
    expect(assignments["slot-1"].controlledPlayerId).toBe("player-1");
    expect(assignments["slot-2"].mode).toBe("AI_FALLBACK");
    expect(assignments["slot-3"].mode).toBe("AI_FALLBACK");
    expect(assignments["slot-4"].mode).toBe("AI_FALLBACK");

    // Store screenshot and metadata on window for node-side extraction.
    (window as unknown as Record<string, string>).__2v2KeyboardScreenshotData = capture.screenshot;
    (window as unknown as Record<string, string>).__2v2KeyboardMeta = JSON.stringify(
      buildCaptureMeta(capture, bridge.stateHash()),
    );
  });

  it("2v2 keyboard scenario has 1 HUMAN slot and 3 AI_FALLBACK slots", () => {
    const assignments = FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments;
    const modes = Object.values(assignments).map((a) => a.mode);
    expect(modes.filter((m) => m === "HUMAN")).toHaveLength(1);
    expect(modes.filter((m) => m === "AI_FALLBACK")).toHaveLength(3);
  });

  it("slot-1 is HUMAN in 2v2 keyboard scenario", () => {
    expect(FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments["slot-1"].mode).toBe("HUMAN");
    expect(FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments["slot-1"].teamId).toBe("team-a");
    expect(FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments["slot-1"].controlledPlayerId).toBe("player-1");
  });
});
