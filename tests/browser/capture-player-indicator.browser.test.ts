/**
 * @module tests/browser/capture-player-indicator.browser.test
 *
 * Captures a screenshot of the controlled-player indicator (yellow ring)
 * above the human-controlled player in 2v2 human-vs-CPU mode.
 *
 * Writes the screenshot to:
 *   docs/screenshots/BROWSER-CONTROLLED-PLAYER-INDICATOR/frame-000.png
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { buildCaptureMeta } from "../../eval/capture-snapshot.js";
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
  try {
    bridge.getPresentationSession().dispose();
  } catch {
    /* already disposed */
  }
  if (container.parentElement) {
    container.parentElement.removeChild(container);
  }
});

describe("BROWSER-CONTROLLED-PLAYER-INDICATOR screenshot evidence", () => {
  it("captures frame-000.png showing the controlled-player indicator", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU);
    await bridge.reset();

    const sim = bridge.getSimulation();

    // Set up per-slot CPU adapters for AI_FALLBACK slots (2-4).
    const cpuSlots = Object.entries(FOUNDATION_SCENARIO_HUMAN_VS_CPU.controlAssignments)
      .filter(([, assignment]) => assignment.mode === "AI_FALLBACK")
      .map(([controlSlot, assignment]) => ({
        controlSlot,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId,
        adapter: createCpuAdapter(),
      }));

    // Advance simulation 60 ticks with CPU controllers so players move.
    for (let tick = 0; tick < 60; tick++) {
      const snapshot = sim.snapshot();
      const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
      for (const entry of cpuSlots) {
        if (!teamDecisions.has(entry.teamId)) {
          const teamObs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
          teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
        }
      }
      const frames: InputFrame[] = cpuSlots.map(({ adapter, controlSlot, teamId, controlledPlayerId }) => {
        const obs = buildCpuObservation(snapshot, teamId, controlledPlayerId);
        obs.teamDecision = teamDecisions.get(teamId);
        const frame = adapter.sample(sim.tick, obs);
        frame.controlSlot = controlSlot;
        return frame;
      });
      bridge.injectInputs(frames);
      sim.step();
    }

    // Render and capture.
    bridge.renderFrame();
    const capture = await bridge.capture();

    // Verify capture has content.
    expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);

    // Verify isControlled is set on exactly one player.
    const controlled = capture.presentationSnapshot.players.filter((p) => p.isControlled);
    expect(controlled.length).toBe(1);
    expect(controlled[0].playerId).toBe("player-1");

    // Verify the marker mesh is in the scene and visible.
    const scene = bridge.getScene();
    let markerVisible = false;
    scene.traverse((obj) => {
      if (obj.name === "controlled-marker" && (obj as { visible: boolean }).visible) {
        markerVisible = true;
      }
    });
    expect(markerVisible).toBe(true);

    // Write screenshot to disk — try node:fs first, fall back to console.log.
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    const outDir = "docs/screenshots/BROWSER-CONTROLLED-PLAYER-INDICATOR";
    try {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(outDir, { recursive: true });
      try {
        writeFileSync(`${outDir}/frame-000.png`, Buffer.from(base64Data, "base64"));
      } catch {
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        writeFileSync(`${outDir}/frame-000.png`, bytes);
      }
      const meta = buildCaptureMeta(capture, bridge.stateHash());
      writeFileSync(`${outDir}/frame-000.meta.json`, JSON.stringify(meta, null, 2), "utf8");
    } catch {
      // Browser mode — log for node-side extraction.
      console.log(`[indicator-screenshot:base64]${base64Data}`);
      console.log(`[indicator-screenshot:meta]${JSON.stringify(buildCaptureMeta(capture, bridge.stateHash()))}`);
    }
  });
});
