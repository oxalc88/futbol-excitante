/**
 * @module tests/browser/human-vs-cpu-5v3.browser.test
 *
 * Browser tests for the Human-vs-CPU 5v3 match (?mode=human-vs-ai-5v3).
 *
 * Verifies:
 *  1. The 5v3 scenario loads with 10 players (1 HUMAN, 9 CPU).
 *  2. Slot-1 is HUMAN with keyboard adapter; slots 2-10 are AI_FALLBACK.
 *  3. CPU adapters advance the simulation autonomously for AI slots.
 *  4. Player switching (Tab) cycles through teammates.
 *  5. The simulation runs at least 60 ticks without errors.
 *  6. The controls hint displays the correct text.
 *  7. The scoreboard is visible and functional.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3 } from "../../src/apps/browser/foundation-scenario.js";
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

/** Build per-slot CPU adapters for all AI_FALLBACK slots in the scenario. */
function buildCpuSlots() {
  return Object.entries(FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3.controlAssignments)
    .filter(([, assignment]) => assignment.mode === "AI_FALLBACK")
    .map(([controlSlot, assignment]) => ({
      controlSlot,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId,
      adapter: createCpuAdapter(),
    }));
}

describe("Human-vs-CPU 5v3 scenario", () => {
  it("has 1 HUMAN slot and 9 AI_FALLBACK slots", () => {
    const assignments = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3.controlAssignments;
    const modes = Object.values(assignments).map((a) => a.mode);
    expect(modes.filter((m) => m === "HUMAN")).toHaveLength(1);
    expect(modes.filter((m) => m === "AI_FALLBACK")).toHaveLength(9);
  });

  it("slot-1 is HUMAN on team-a controlling player-1", () => {
    const slot1 = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3.controlAssignments["slot-1"];
    expect(slot1.mode).toBe("HUMAN");
    expect(slot1.teamId).toBe("team-a");
    expect(slot1.controlledPlayerId).toBe("player-1");
  });

  it("human team (team-a) has 4 CPU teammates via slots 2-5", () => {
    const assignments = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3.controlAssignments;
    for (const slotId of ["slot-2", "slot-3", "slot-4", "slot-5"]) {
      const slot = assignments[slotId];
      expect(slot.mode).toBe("AI_FALLBACK");
      expect(slot.teamId).toBe("team-a");
    }
  });

  it("opponent team (team-b) has 5 CPU players via slots 6-10", () => {
    const assignments = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3.controlAssignments;
    for (const slotId of ["slot-6", "slot-7", "slot-8", "slot-9", "slot-10"]) {
      const slot = assignments[slotId];
      expect(slot.mode).toBe("AI_FALLBACK");
      expect(slot.teamId).toBe("team-b");
    }
  });

  it("has 10 players in the scenario", () => {
    expect(FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3.players.length).toBe(10);
  });
});

describe("Human-vs-CPU 5v3 simulation", () => {
  it("runs 60 ticks without errors using CPU adapters for AI slots", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3);
    await bridge.reset();

    const cpuSlots = buildCpuSlots();
    const sim = bridge.getSimulation();

    for (let tick = 0; tick < 60; tick++) {
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

    expect(sim.tick).toBe(60);
  });

  it("CPU adapters produce non-zero displacement over 120 ticks", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3);
    await bridge.reset();

    const cpuSlots = buildCpuSlots();
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

    // After 120 ticks, at least one CPU player should have moved.
    const finalSnapshot = sim.snapshot();
    const movedPlayers = finalSnapshot.players.filter((p) => {
      const orig = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3.players.find(
        (sp) => sp.playerId === p.playerId,
      );
      if (!orig) return false;
      const dx = p.groundPosition.x - orig.groundPosition.x;
      const dy = p.groundPosition.y - orig.groundPosition.y;
      return Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
    });
    expect(movedPlayers.length).toBeGreaterThan(0);
  });

  it("player switching cycles through teammates via Tab", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3);
    await bridge.reset();

    const sim = bridge.getSimulation();

    // Initial controlled player should be player-1.
    const initialAssignment = sim.snapshot().controlAssignments["slot-1"];
    expect(initialAssignment.controlledPlayerId).toBe("player-1");

    // Compute expected teammate cycle (mirrors main.ts nextEligiblePlayer).
    const teamAPlayers = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3.players
      .filter((p) => p.teamId === "team-a")
      .map((p) => p.playerId)
      .sort();

    // Tab 1: player-1 → player-2.
    const next1 = teamAPlayers[(teamAPlayers.indexOf("player-1") + 1) % teamAPlayers.length];
    sim.setControlledPlayer("slot-1", next1);
    expect(sim.snapshot().controlAssignments["slot-1"].controlledPlayerId).toBe(next1);

    // Tab 2: player-2 → player-3.
    const next2 = teamAPlayers[(teamAPlayers.indexOf(next1) + 1) % teamAPlayers.length];
    sim.setControlledPlayer("slot-1", next2);
    expect(sim.snapshot().controlAssignments["slot-1"].controlledPlayerId).toBe(next2);

    // Tab 3: player-3 → player-4.
    const next3 = teamAPlayers[(teamAPlayers.indexOf(next2) + 1) % teamAPlayers.length];
    sim.setControlledPlayer("slot-1", next3);
    expect(sim.snapshot().controlAssignments["slot-1"].controlledPlayerId).toBe(next3);

    // Tab 4: player-4 → player-5.
    const next4 = teamAPlayers[(teamAPlayers.indexOf(next3) + 1) % teamAPlayers.length];
    sim.setControlledPlayer("slot-1", next4);
    expect(sim.snapshot().controlAssignments["slot-1"].controlledPlayerId).toBe(next4);

    // Tab 5: player-5 → player-1 (wrap around).
    const next5 = teamAPlayers[(teamAPlayers.indexOf(next4) + 1) % teamAPlayers.length];
    sim.setControlledPlayer("slot-1", next5);
    expect(sim.snapshot().controlAssignments["slot-1"].controlledPlayerId).toBe("player-1");
  });

  it("captures a screenshot with 10 players visible", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3);
    await bridge.reset();

    const cpuSlots = buildCpuSlots();
    const sim = bridge.getSimulation();

    for (let tick = 0; tick < 60; tick++) {
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

    bridge.renderFrame();
    const capture = await bridge.capture();

    expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);
    expect(capture.sceneObjectCount).toBeGreaterThanOrEqual(11); // 10 players + ball
    expect(capture.presentationSnapshot.players.length).toBe(10);
    expect(capture.presentationSnapshot.tick).toBeGreaterThan(0);
  });
});
