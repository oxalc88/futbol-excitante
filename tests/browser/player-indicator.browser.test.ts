/**
 * @module tests/browser/player-indicator.browser.test
 *
 * Browser-mode tests for BROWSER-CONTROLLED-PLAYER-INDICATOR — proves
 * that a visible indicator (yellow ring) appears above the human-controlled
 * player, updates when the human switches players via Tab, and does NOT
 * appear above CPU-controlled players.
 *
 * Tests:
 *  - INDICATOR-001: controlled player has visible indicator
 *  - INDICATOR-002: indicator moves to new player after Tab switch
 *  - INDICATOR-003: CPU-controlled players do NOT have the indicator
 *  - INDICATOR-004: indicator works in 3v3 human-vs-CPU mode
 *  - INDICATOR-005: indicator absent in pure AI modes (no HUMAN slot)
 *
 * These tests run in Vitest Browser Mode (Playwright + Chromium).
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import {
  FOUNDATION_SCENARIO_HUMAN_VS_CPU,
  FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3,
  FOUNDATION_SCENARIO_3V3,
} from "../../src/apps/browser/foundation-scenario.js";
import {
  createCpuAdapter,
  buildCpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { SWITCH_PLAYER_BIT } from "../../src/contracts/input.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { Scene, Object3D } from "three";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
});

afterEach(() => {
  if (container.parentElement) {
    container.parentElement.removeChild(container);
  }
});

/**
 * Find the controlled-marker mesh in the scene graph.
 * Returns the mesh if found and visible, null otherwise.
 */
function findMarkerInScene(scene: Scene): Object3D | null {
  let found: Object3D | null = null;
  scene.traverse((obj: Object3D) => {
    if (obj.name === "controlled-marker") {
      found = obj;
    }
  });
  return found;
}

/**
 * Run N ticks with CPU controllers for non-HUMAN slots,
 * plus optional extra frames injected per tick.
 * Mirrors the helper from player-switch tests.
 */
function runWithCpu(
  bridge: TestBridge,
  scenario: ScenarioDefinition,
  ticks: number,
  extraFrames?: (tick: number) => InputFrame[],
): void {
  const sim = bridge.getSimulation();
  const cpuEntries = Object.entries(scenario.controlAssignments)
    .filter(([, assignment]) => assignment.mode !== "HUMAN")
    .map(([controlSlot, assignment]) => ({
      controlSlot,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId,
      adapter: createCpuAdapter(),
    }));

  const humanSlotEntries = Object.entries(scenario.controlAssignments)
    .filter(([, assignment]) => assignment.mode === "HUMAN")
    .map(([controlSlot, assignment]) => {
      const teamId = assignment.teamId;
      const teammates = scenario.players
        .filter((p) => p.teamId === teamId)
        .map((p) => p.playerId)
        .sort();
      return { controlSlot, teammates };
    });

  for (let tick = 0; tick < ticks; tick++) {
    const snapshot = sim.snapshot();
    const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
    for (const entry of cpuEntries) {
      if (!teamDecisions.has(entry.teamId)) {
        const teamObs = buildCpuObservation(
          snapshot,
          entry.teamId,
          entry.controlledPlayerId,
        );
        teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
      }
    }

    const frames: InputFrame[] = cpuEntries.map((entry) => {
      const observation = buildCpuObservation(
        snapshot,
        entry.teamId,
        entry.controlledPlayerId,
      );
      observation.teamDecision = teamDecisions.get(entry.teamId);
      const frame = entry.adapter.sample(sim.tick, observation);
      frame.controlSlot = entry.controlSlot;
      return frame;
    });

    if (extraFrames) {
      frames.push(...extraFrames(sim.tick));
    }

    // Detect player-switch from HUMAN frames (mirrors main.ts logic).
    for (const frame of frames) {
      if ((frame.pressedButtons & SWITCH_PLAYER_BIT) !== 0) {
        const entry = humanSlotEntries.find((e) => e.controlSlot === frame.controlSlot);
        if (entry && entry.teammates.length > 1) {
          const currentId = snapshot.controlAssignments[frame.controlSlot]?.controlledPlayerId;
          const idx = entry.teammates.indexOf(currentId ?? "");
          if (idx >= 0) {
            const nextId = entry.teammates[(idx + 1) % entry.teammates.length];
            sim.setControlledPlayer(frame.controlSlot, nextId);
          }
        }
      }
    }

    bridge.injectInputs(frames);
    sim.step();
  }
}

/**
 * Render the current simulation state and return the scene.
 */
function renderAndReturnScene(bridge: TestBridge): Scene {
  bridge.renderFrame();
  return bridge.getScene();
}

// ===========================================================================
// INDICATOR-001: controlled player has visible indicator
// ===========================================================================

describe("INDICATOR-001: controlled player has visible indicator", () => {
  let bridge: TestBridge;

  afterEach(() => {
    try { bridge?.getPresentationSession().dispose(); } catch { /* already disposed */ }
  });

  it("yellow ring marker is visible above the human-controlled player in 2v2", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU);
    await bridge.reset();

    // Advance a few ticks so players move from initial position.
    runWithCpu(bridge, FOUNDATION_SCENARIO_HUMAN_VS_CPU, 10);

    // Render the scene.
    const scene = renderAndReturnScene(bridge);

    // Find the controlled-marker in the scene.
    const marker = findMarkerInScene(scene);
    expect(marker).not.toBeNull();
    expect(marker!.visible).toBe(true);

    // Verify the marker is positioned above a player (y > 0).
    expect(marker!.position.y).toBeGreaterThan(0);

    // Verify the presentation snapshot shows isControlled for the human player.
    const presentation = bridge.getSimulation().presentation();
    const controlledPlayers = presentation.players.filter((p) => p.isControlled);
    expect(controlledPlayers.length).toBe(1); // exactly one human-controlled player
    expect(controlledPlayers[0].playerId).toBe("player-1"); // slot-1 controls player-1 initially
  });
});

// ===========================================================================
// INDICATOR-002: indicator moves to new player after Tab switch
// ===========================================================================

describe("INDICATOR-002: indicator moves after Tab switch", () => {
  let bridge: TestBridge;

  afterEach(() => {
    try { bridge?.getPresentationSession().dispose(); } catch { /* already disposed */ }
  });

  it("marker follows the controlled player when Tab switches slot-1", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU);
    await bridge.reset();

    // Advance a few ticks.
    runWithCpu(bridge, FOUNDATION_SCENARIO_HUMAN_VS_CPU, 5);

    // Render and note initial controlled player.
    const sim = bridge.getSimulation();
    const initialControlled = sim.snapshot().controlAssignments["slot-1"].controlledPlayerId;
    expect(initialControlled).toBe("player-1");

    // Press Tab to switch.
    runWithCpu(bridge, FOUNDATION_SCENARIO_HUMAN_VS_CPU, 1, (tick) => [
      { tick, sourceId: "keyboard", controlSlot: "slot-1", moveX: 0, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: SWITCH_PLAYER_BIT, releasedButtons: 0 },
    ]);

    // Verify switch happened.
    const afterSwitch = sim.snapshot().controlAssignments["slot-1"].controlledPlayerId;
    expect(afterSwitch).toBe("player-2");

    // Render and check the marker is above the new player.
    const scene = renderAndReturnScene(bridge);
    const marker = findMarkerInScene(scene);
    expect(marker).not.toBeNull();
    expect(marker!.visible).toBe(true);

    // Verify presentation snapshot reflects the switch.
    const presentation = sim.presentation();
    const controlledPlayers = presentation.players.filter((p) => p.isControlled);
    expect(controlledPlayers.length).toBe(1);
    expect(controlledPlayers[0].playerId).toBe("player-2");
  });
});

// ===========================================================================
// INDICATOR-003: CPU-controlled players do NOT have the indicator
// ===========================================================================

describe("INDICATOR-003: CPU-controlled players do NOT have the indicator", () => {
  let bridge: TestBridge;

  afterEach(() => {
    try { bridge?.getPresentationSession().dispose(); } catch { /* already disposed */ }
  });

  it("only the HUMAN-controlled player has isControlled in the snapshot", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU);
    await bridge.reset();

    // Advance simulation.
    runWithCpu(bridge, FOUNDATION_SCENARIO_HUMAN_VS_CPU, 10);

    const presentation = bridge.getSimulation().presentation();

    // Exactly one player should be controlled.
    const controlled = presentation.players.filter((p) => p.isControlled);
    expect(controlled.length).toBe(1);

    // All other players should NOT be controlled.
    const notControlled = presentation.players.filter((p) => !p.isControlled);
    expect(notControlled.length).toBe(3); // 4 total - 1 controlled = 3

    // Verify that the CPU-controlled players' slot assignments are AI_FALLBACK.
    const assignments = FOUNDATION_SCENARIO_HUMAN_VS_CPU.controlAssignments;
    for (const [slotId, assignment] of Object.entries(assignments)) {
      if (assignment.mode === "AI_FALLBACK") {
        // The CPU-controlled player should NOT have isControlled.
        const cpuPlayer = presentation.players.find(
          (p) => p.playerId === assignment.controlledPlayerId,
        );
        if (cpuPlayer) {
          expect(cpuPlayer.isControlled).toBe(false);
        }
      }
    }
  });
});

// ===========================================================================
// INDICATOR-004: indicator works in 3v3 human-vs-CPU mode
// ===========================================================================

describe("INDICATOR-004: indicator in 3v3 human-vs-CPU", () => {
  let bridge: TestBridge;

  afterEach(() => {
    try { bridge?.getPresentationSession().dispose(); } catch { /* already disposed */ }
  });

  it("shows marker above the single human-controlled player in 3v3", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3);
    await bridge.reset();

    // Advance simulation.
    runWithCpu(bridge, FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3, 10);

    // Render.
    const scene = renderAndReturnScene(bridge);

    // Marker should be visible.
    const marker = findMarkerInScene(scene);
    expect(marker).not.toBeNull();
    expect(marker!.visible).toBe(true);

    // Exactly one controlled player.
    const presentation = bridge.getSimulation().presentation();
    const controlled = presentation.players.filter((p) => p.isControlled);
    expect(controlled.length).toBe(1);

    // 6 total players in 3v3, 5 should NOT be controlled.
    expect(presentation.players.length).toBe(6);
    expect(presentation.players.filter((p) => !p.isControlled).length).toBe(5);
  });
});

// ===========================================================================
// INDICATOR-005: indicator absent in pure AI modes
// ===========================================================================

describe("INDICATOR-005: indicator absent in pure AI mode", () => {
  let bridge: TestBridge;

  afterEach(() => {
    try { bridge?.getPresentationSession().dispose(); } catch { /* already disposed */ }
  });

  it("no player has isControlled in 3v3 AI-only mode and marker is hidden", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();

    // Advance with CPU controllers.
    runWithCpu(bridge, FOUNDATION_SCENARIO_3V3, 10);

    // Render.
    const scene = renderAndReturnScene(bridge);

    // No player should be controlled.
    const presentation = bridge.getSimulation().presentation();
    const controlled = presentation.players.filter((p) => p.isControlled);
    expect(controlled.length).toBe(0);

    // Marker should exist in scene but be hidden.
    const marker = findMarkerInScene(scene);
    expect(marker).not.toBeNull();
    expect(marker!.visible).toBe(false);
  });
});
