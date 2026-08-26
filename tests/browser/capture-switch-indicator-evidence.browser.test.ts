/**
 * @module tests/browser/capture-switch-indicator-evidence.browser.test
 *
 * Captures pre/post switch screenshot evidence for
 * BROWSER-SWITCH-INDICATOR-BASELINE-FIX.
 *
 * Captures:
 *  - frame-pre-switch.png: player-1 controlled, marker above player-1
 *  - frame-post-switch.png: player-2 controlled after core-native Tab switch, marker follows
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU } from "../../src/apps/browser/foundation-scenario.js";
import { createCpuAdapter, buildCpuObservation } from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { SWITCH_PLAYER_BIT } from "../../src/contracts/input.js";
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

/**
 * Run N ticks with CPU controllers for non-HUMAN slots.
 * Uses core-native SWITCH_PLAYER_BIT processing (no manual setControlledPlayer).
 */
function runWithCpu(
  br: TestBridge,
  ticks: number,
  extraFrames?: (tick: number) => InputFrame[],
): void {
  const sim = br.getSimulation();
  const cpuEntries = Object.entries(FOUNDATION_SCENARIO_HUMAN_VS_CPU.controlAssignments)
    .filter(([, assignment]) => assignment.mode !== "HUMAN")
    .map(([controlSlot, assignment]) => ({
      controlSlot,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId,
      adapter: createCpuAdapter(),
    }));

  for (let tick = 0; tick < ticks; tick++) {
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

    if (extraFrames) {
      frames.push(...extraFrames(sim.tick));
    }

    br.injectInputs(frames);
    sim.step();
  }
}

/**
 * Write a base64-encoded PNG to docs/screenshots/BROWSER-SWITCH-INDICATOR-BASELINE-FIX/.
 */
async function writeScreenshot(name: string, base64Data: string): Promise<void> {
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = "docs/screenshots/BROWSER-SWITCH-INDICATOR-BASELINE-FIX";
    fs.mkdirSync(dir, { recursive: true });
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, bytes);
    console.log(`[capture:wrote] ${filePath} (${bytes.length} bytes)`);
  } catch {
    console.log(`[capture:${name}:base64]${base64Data}`);
  }
}

describe("BROWSER-SWITCH-INDICATOR-BASELINE-FIX evidence capture", () => {
  it("captures pre-switch and post-switch screenshots with marker following", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU);
    await bridge.reset();

    const sim = bridge.getSimulation();

    // Advance 30 ticks so players are spread out.
    runWithCpu(bridge, 30);

    // Verify initial controlled player.
    expect(sim.snapshot().controlAssignments["slot-1"].controlledPlayerId).toBe("player-1");

    // Render and capture pre-switch frame.
    bridge.renderFrame();
    const preCapture = await bridge.capture();
    expect(preCapture.screenshot).toMatch(/^data:image\/png;base64,/);
    const preBase64 = preCapture.screenshot.split(",")[1] ?? "";
    expect(preBase64.length).toBeGreaterThan(100);

    // Verify marker is above player-1 before switch.
    const prePresentation = sim.presentation();
    const preControlled = prePresentation.players.filter((p) => p.isControlled);
    expect(preControlled.length).toBe(1);
    expect(preControlled[0].playerId).toBe("player-1");

    await writeScreenshot("frame-pre-switch.png", preBase64);

    // Perform core-native Tab switch (single SWITCH_PLAYER_BIT frame).
    runWithCpu(bridge, 5, (tick) => [
      {
        tick,
        sourceId: "keyboard",
        controlSlot: "slot-1",
        moveX: 0, moveY: 0, sprint: 0,
        heldButtons: 0,
        pressedButtons: SWITCH_PLAYER_BIT,
        releasedButtons: 0,
      },
    ]);

    // Verify switch happened (exactly one switch via core).
    expect(sim.snapshot().controlAssignments["slot-1"].controlledPlayerId).toBe("player-2");

    // Render and capture post-switch frame.
    bridge.renderFrame();
    const postCapture = await bridge.capture();
    expect(postCapture.screenshot).toMatch(/^data:image\/png;base64,/);
    const postBase64 = postCapture.screenshot.split(",")[1] ?? "";
    expect(postBase64.length).toBeGreaterThan(100);

    // Verify marker is above player-2 after switch.
    const postPresentation = sim.presentation();
    const postControlled = postPresentation.players.filter((p) => p.isControlled);
    expect(postControlled.length).toBe(1);
    expect(postControlled[0].playerId).toBe("player-2");

    await writeScreenshot("frame-post-switch.png", postBase64);

    // Store on window for node-side extraction.
    (window as unknown as Record<string, string>).__preSwitchScreenshot = preCapture.screenshot;
    (window as unknown as Record<string, string>).__postSwitchScreenshot = postCapture.screenshot;
  });
});
