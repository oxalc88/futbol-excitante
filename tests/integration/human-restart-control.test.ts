/**
 * @module tests/integration/human-restart-control
 *
 * HUMAN-RESTART-CONTROL discriminating guards.
 *
 * Proves three things about the human-directed-restart gate and its driver:
 *
 *  1. Gating (human-restart-control.ts): `isHumanDirectedRestartActive` is true
 *     only when the human's team won the restart AND the window is active AND
 *     the human controls a body on the awarding team; it is false when the
 *     window is inactive, when the human's team did NOT win, or when the
 *     human's controlled body is on the opposing team.
 *  2. Driver (human-restart-control.ts runner): the human's directional input
 *     during the window re-targets the core's nearest-receiver serve (the
 *     served target changes), while the CPU fallback (no human input) serves
 *     toward the default nearest receiver — the same core machinery.
 *  3. Determinism: the same config reproduces the same served target.
 *
 * No src/simulation/ change and no world-state writes outside the driver's
 * window restore (the fixture/data path the accepted restart integration tests
 * already use). No Math.random, Date, DOM, or Node I/O in the sim.
 */

import { describe, it, expect } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { deepClone } from "../../src/simulation/world/clone.js";
import { NO_OP_OBSERVER } from "../../src/simulation/telemetry/observer.js";
import type { WorldState } from "../../src/contracts/state.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import {
  describeHumanRestartWindow,
  isHumanDirectedRestartActive,
  isHumanRestartTaker,
  isHumanRestartWindowActive,
  restartAwardingTeam,
  restartTakerPlayerId,
} from "../../src/adapters/input-browser/human-restart-control.js";
import { runHumanRestartWindow } from "../../eval/runners/human-restart-control.js";
import hrScenario from "../../eval/scenarios/5v5-human-restart-throwin.v1.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function openThrowInState(state: WorldState): WorldState {
  const m = deepClone(state) as WorldState;
  m.matchPhase = "throw-in";
  m.throwInPosition = { x: 30, y: 34 };
  m.throwInAwardingTeam = "team-a";
  m.throwInCountdown = 20;
  m.throwInTakerId = "player-1";
  m.throwInTouchlineIndex = 0;
  return m;
}

const BASE_RUN = {
  scenario: hrScenario as unknown as ScenarioDefinition,
  maxTicks: 24,
  humanTeamId: "team-a",
  humanControlledPlayerId: "player-3",
  humanControlSlot: "slot-1",
  window: {
    kind: "throw-in" as const,
    team: "team-a",
    takerPlayerId: "player-1",
    position: { x: 30, y: 34 },
    countdown: 20,
    touchlineIndex: 0 as const,
  },
};

// ---------------------------------------------------------------------------
// 1. Gating predicates
// ---------------------------------------------------------------------------

describe("HUMAN-RESTART-CONTROL gate is explicit (team + taker + window)", () => {
  it("describeHumanRestartWindow reads the awarding team and taker from state", () => {
    const sim = createSimulation(createWorld({ scenario: hrScenario as unknown as ScenarioDefinition }), NO_OP_OBSERVER);
    const state = openThrowInState(sim.snapshot());
    const window = describeHumanRestartWindow(state);
    expect(window).not.toBeNull();
    expect(window?.awardingTeam).toBe("team-a");
    expect(window?.takerPlayerId).toBe("player-1");
    expect(window?.matchPhase).toBe("throw-in");
    expect(restartAwardingTeam(state)).toBe("team-a");
    expect(restartTakerPlayerId(state)).toBe("player-1");
    expect(isHumanRestartTaker(state, "player-1")).toBe(true);
    expect(isHumanRestartTaker(state, "player-3")).toBe(false);
  });

  it("gate is true for the human's team winner + window + friendly controlled body", () => {
    const sim = createSimulation(createWorld({ scenario: hrScenario as unknown as ScenarioDefinition }), NO_OP_OBSERVER);
    const state = openThrowInState(sim.snapshot());
    expect(isHumanDirectedRestartActive(state, "team-a", "player-3")).toBe(true);
    expect(isHumanDirectedRestartActive(state, "team-a", "player-1")).toBe(true);
  });

  it("gate is false when the window is inactive", () => {
    const sim = createSimulation(createWorld({ scenario: hrScenario as unknown as ScenarioDefinition }), NO_OP_OBSERVER);
    const state = sim.snapshot(); // playing
    expect(isHumanDirectedRestartActive(state, "team-a", "player-3")).toBe(false);
    expect(isHumanRestartWindowActive(state, "team-a")).toBe(false);
  });

  it("gate is false when the human's team did not win the restart", () => {
    const sim = createSimulation(createWorld({ scenario: hrScenario as unknown as ScenarioDefinition }), NO_OP_OBSERVER);
    const state = openThrowInState(sim.snapshot());
    expect(isHumanDirectedRestartActive(state, "team-b", "player-8")).toBe(false);
    expect(isHumanRestartWindowActive(state, "team-b")).toBe(false);
  });

  it("gate is false when the human's controlled body is on the opposing team", () => {
    const sim = createSimulation(createWorld({ scenario: hrScenario as unknown as ScenarioDefinition }), NO_OP_OBSERVER);
    const state = openThrowInState(sim.snapshot());
    expect(isHumanDirectedRestartActive(state, "team-a", "player-8")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Driver: human input re-targets the serve; CPU fallback is unchanged
// ---------------------------------------------------------------------------

describe("HUMAN-RESTART-CONTROL driver discriminates human vs CPU", () => {
  it("CPU fallback (no human input) serves toward the default nearest receiver", () => {
    const r = runHumanRestartWindow({ ...BASE_RUN });
    expect(r.serveTarget).not.toBeNull();
    // player-3 starts at (20,30), the nearest team-a receiver to the (30,34) exit.
    expect(r.serveTarget?.x).toBeCloseTo(20, 1);
    expect(r.serveTarget?.y).toBeCloseTo(30, 1);
    expect(r.humanGateTicks).toBeGreaterThan(0);
  });

  it("human directional input re-targets the core serve (down-right)", () => {
    const r = runHumanRestartWindow({ ...BASE_RUN, humanMoveDirection: { x: 1, y: -1 } });
    expect(r.serveTarget).not.toBeNull();
    // The human steered player-3 toward +x/-y, so the served target moved off (20,30).
    expect(r.humanGateTicks).toBeGreaterThan(0);
    expect(Math.abs((r.serveTarget?.x ?? 0) - 20)).toBeGreaterThan(0.2);
    expect(r.serveTarget?.y ?? 0).toBeLessThan(29.7);
  });

  it("human directional input re-targets the core serve (up-left)", () => {
    const r = runHumanRestartWindow({ ...BASE_RUN, humanMoveDirection: { x: -1, y: 1 } });
    expect(r.serveTarget).not.toBeNull();
    expect(Math.abs((r.serveTarget?.x ?? 0) - 20)).toBeGreaterThan(0.2);
    expect(r.serveTarget?.y ?? 0).toBeGreaterThan(29.7);
  });

  it("human and CPU serve targets differ (the discriminating guard)", () => {
    const cpu = runHumanRestartWindow({ ...BASE_RUN });
    const human = runHumanRestartWindow({ ...BASE_RUN, humanMoveDirection: { x: 1, y: -1 } });
    expect(cpu.serveTarget).not.toBeNull();
    expect(human.serveTarget).not.toBeNull();
    const dx = (human.serveTarget?.x ?? 0) - (cpu.serveTarget?.x ?? 0);
    const dy = (human.serveTarget?.y ?? 0) - (cpu.serveTarget?.y ?? 0);
    expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThan(0.25);
  });

  it("same config reproduces the same serve target (determinism)", () => {
    const a = runHumanRestartWindow({ ...BASE_RUN, humanMoveDirection: { x: 1, y: -1 } });
    const b = runHumanRestartWindow({ ...BASE_RUN, humanMoveDirection: { x: 1, y: -1 } });
    expect(a.serveTarget).toEqual(b.serveTarget);
    expect(a.serveDirection).toEqual(b.serveDirection);
    expect(a.ticks.map((t) => t.stateHash)).toEqual(b.ticks.map((t) => t.stateHash));
  });
});
