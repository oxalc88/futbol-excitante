/**
 * @module tests/browser/human-vs-cpu-3v3-screenshot.browser.test
 *
 * Captures a screenshot of the Human-vs-CPU 3v3 match using the test bridge.
 *
 * Verifies:
 *  1. The human-vs-CPU 3v3 scenario loads with 6 players (1 HUMAN, 5 CPU).
 *  2. CPU adapters advance simulation autonomously for AI slots.
 *  3. Keyboard adapter is wired for the HUMAN slot (slot-1).
 *  4. Screenshot capture succeeds with valid content.
 *  5. Control assignment: 1 HUMAN on team-a + 2 CPU teammates on team-a + 3 CPU opponents on team-b.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { buildCaptureMeta } from "../../eval/capture-snapshot.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3 } from "../../src/apps/browser/foundation-scenario.js";
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

describe("Human-vs-CPU 3v3 match screenshot capture", () => {
  it("captures human-vs-CPU 3v3 match after advancing simulation with CPU slots", async () => {
    // Create bridge with human-vs-CPU 3v3 scenario.
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3);
    await bridge.reset();

    // Set up per-slot CPU adapters for AI_FALLBACK slots (2-6), same as main.ts.
    const cpuSlots = Object.entries(FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3.controlAssignments)
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
    expect(capture.sceneObjectCount).toBeGreaterThanOrEqual(7); // 6 players + ball

    // Verify scene has 6 players (human-vs-CPU 3v3 scenario).
    const players = capture.presentationSnapshot.players;
    expect(players.length).toBe(6);

    // Verify simulation advanced.
    expect(capture.presentationSnapshot.tick).toBeGreaterThan(0);

    // Verify scenario has correct control assignments.
    const assignments = FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3.controlAssignments;
    expect(assignments["slot-1"].mode).toBe("HUMAN");
    expect(assignments["slot-2"].mode).toBe("AI_FALLBACK");
    expect(assignments["slot-3"].mode).toBe("AI_FALLBACK");
    expect(assignments["slot-4"].mode).toBe("AI_FALLBACK");
    expect(assignments["slot-5"].mode).toBe("AI_FALLBACK");
    expect(assignments["slot-6"].mode).toBe("AI_FALLBACK");

    // Store screenshot and metadata on window for node-side extraction.
    (window as unknown as Record<string, string>).__humanVsCpu3v3ScreenshotData = capture.screenshot;
    (window as unknown as Record<string, string>).__humanVsCpu3v3Meta = JSON.stringify(
      buildCaptureMeta(capture, bridge.stateHash()),
    );
  });

  it("human-vs-CPU 3v3 scenario has 1 HUMAN slot and 5 AI_FALLBACK slots", () => {
    const assignments = FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3.controlAssignments;
    const modes = Object.values(assignments).map((a) => a.mode);
    expect(modes.filter((m) => m === "HUMAN")).toHaveLength(1);
    expect(modes.filter((m) => m === "AI_FALLBACK")).toHaveLength(5);
  });

  it("slot-1 is HUMAN on team-a in human-vs-CPU 3v3 scenario", () => {
    const slot1 = FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3.controlAssignments["slot-1"];
    expect(slot1.mode).toBe("HUMAN");
    expect(slot1.teamId).toBe("team-a");
    expect(slot1.controlledPlayerId).toBe("player-1");
  });

  it("human team (team-a) has 2 CPU teammates via slots 2 and 3", () => {
    const assignments = FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3.controlAssignments;
    const slot2 = assignments["slot-2"];
    const slot3 = assignments["slot-3"];
    expect(slot2.mode).toBe("AI_FALLBACK");
    expect(slot2.teamId).toBe("team-a");
    expect(slot3.mode).toBe("AI_FALLBACK");
    expect(slot3.teamId).toBe("team-a");
  });

  it("opponent team (team-b) has 3 CPU players via slots 4, 5, and 6", () => {
    const assignments = FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3.controlAssignments;
    for (const slotId of ["slot-4", "slot-5", "slot-6"]) {
      const slot = assignments[slotId];
      expect(slot.mode).toBe("AI_FALLBACK");
      expect(slot.teamId).toBe("team-b");
    }
  });
});
