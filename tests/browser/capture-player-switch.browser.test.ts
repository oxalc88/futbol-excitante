/**
 * @module tests/browser/capture-player-switch.browser.test
 *
 * Captures screenshot evidence for BROWSER-PLAYER-SWITCH.
 *
 * Advances the human-vs-CPU match with CPU controllers, renders a frame,
 * and captures a screenshot to docs/screenshots/BROWSER-PLAYER-SWITCH/.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU } from "../../src/apps/browser/foundation-scenario.js";
import { createCpuAdapter, buildCpuObservation } from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
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
  try { bridge?.getPresentationSession().dispose(); } catch { /* already disposed */ }
  if (container.parentElement) {
    container.parentElement.removeChild(container);
  }
});

describe("BROWSER-PLAYER-SWITCH screenshot evidence", () => {
  it("captures frame-000.png showing human-vs-CPU match with player switching", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU);
    await bridge.reset();

    const sim = bridge.getSimulation();
    const cpuEntries = Object.entries(FOUNDATION_SCENARIO_HUMAN_VS_CPU.controlAssignments)
      .filter(([, assignment]) => assignment.mode !== "HUMAN")
      .map(([controlSlot, assignment]) => ({
        controlSlot,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId,
        adapter: createCpuAdapter(),
      }));

    // Advance 60 ticks (1 second of gameplay) with CPU controllers.
    for (let tick = 0; tick < 60; tick++) {
      const snapshot = sim.snapshot();
      const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
      const frames: InputFrame[] = cpuEntries.map((entry) => {
        if (!teamDecisions.has(entry.teamId)) {
          const teamObs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
          teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
        }
        const observation = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
        observation.teamDecision = teamDecisions.get(entry.teamId);
        const frame = entry.adapter.sample(sim.tick, observation);
        frame.controlSlot = entry.controlSlot;
        return frame;
      });
      bridge.injectInputs(frames);
      sim.step();
    }

    // Render the current state.
    bridge.renderFrame();
    const capture = await bridge.capture();

    // Verify capture succeeded.
    expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);
    expect(capture.sceneObjectCount).toBeGreaterThanOrEqual(5);
    expect(capture.presentationSnapshot.tick).toBeGreaterThan(0);

    // Write screenshot to docs/screenshots/BROWSER-PLAYER-SWITCH/.
    try {
      const fs = await import("node:fs");
      fs.mkdirSync("docs/screenshots/BROWSER-PLAYER-SWITCH", { recursive: true });
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      fs.writeFileSync("docs/screenshots/BROWSER-PLAYER-SWITCH/frame-000.png", bytes);
    } catch {
      // If filesystem write fails in browser mode, log the base64 data.
      console.log("[capture:BROWSER-PLAYER-SWITCH:frame-000.png:base64]" + base64Data);
    }

    // Store on window for node-side extraction.
    (window as unknown as Record<string, string>).__playerSwitchScreenshot = capture.screenshot;
  });
});
