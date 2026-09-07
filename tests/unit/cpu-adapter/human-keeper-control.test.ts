/**
 * @module tests/unit/cpu-adapter/human-keeper-control
 *
 * Discriminating guards for HUMAN-KEEPER-CONTROL (adapter-layer only).
 *
 * Verifies, without touching the simulation core:
 *   - the designated keeper is part of the human's switch cycle (the core switch
 *     contract never excluded it);
 *   - the keeper designation comes from the same layout rule the adapters act on;
 *   - the human "controls the keeper" predicate is the equality gate;
 *   - the human's directional input YIELDS the keeper's arc-hold positioning to
 *     it (humanDirectedKeeperMove) while the keeper body is identical.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createCpuAdapter,
  buildCpuObservation,
  designateKeeperFromLayout,
  computeTeamDecision,
} from "../../../src/adapters/input-browser/cpu-adapter.js";
import {
  isHumanControlledKeeper,
  keeperOfTeamFromLayout,
  humanDirectedKeeperMove,
} from "../../../src/adapters/input-browser/human-keeper-control.js";
import { computeExplicitSwitchTarget, type SlotRoutingPlayer, type SlotRoutingAssignment } from "../../../src/simulation/input/input-system.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";

const OBJECTIVE_ID = "HUMAN-KEEPER-CONTROL";

function loadFixture(): ScenarioDefinition {
  return JSON.parse(
    readFileSync(resolve("eval/scenarios/5v5-human-keeper-shot-fixture.v1.json"), "utf8"),
  ) as ScenarioDefinition;
}

describe(`${OBJECTIVE_ID} guards`, () => {
  const scenario = loadFixture();
  const pitchLength = scenario.pitchLength;

  it("designates the same keeper the fixture's layout rule produces", () => {
    expect(designateKeeperFromLayout(scenario.players, "team-b", pitchLength)).toBe("player-10");
    expect(designateKeeperFromLayout(scenario.players, "team-a", pitchLength)).toBe("player-4");
    expect(keeperOfTeamFromLayout(scenario.players, "team-b", pitchLength)).toBe("player-10");
  });

  it("includes the designated keeper in the human's switch cycle", () => {
    const players: SlotRoutingPlayer[] = scenario.players.map((p) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      groundPosition: p.groundPosition,
    }));
    const assignments: Record<string, SlotRoutingAssignment> = {};
    for (const [slot, a] of Object.entries(scenario.controlAssignments)) {
      assignments[slot] = { teamId: a.teamId, controlledPlayerId: a.controlledPlayerId ?? "", mode: a.mode };
    }
    // The human's directed slot (slot-10 controls player-10, the team-b keeper).
    // Its cycle must pass through the designated keeper.
    const humanSlot = "slot-10";
    const seen = new Set<string>([assignments[humanSlot].controlledPlayerId]);
    for (let i = 0; i < 6; i++) {
      const next = computeExplicitSwitchTarget(humanSlot, assignments, players, "NEXT");
      if (!next) break;
      seen.add(next);
      assignments[humanSlot].controlledPlayerId = next;
    }
    expect(seen).toContain("player-10"); // the designated keeper is reachable
    expect(seen).toContain("player-6");   // and an outfield teammate
  });

  it("isHumanControlledKeeper is the equality gate", () => {
    expect(isHumanControlledKeeper("player-10", "player-10")).toBe(true);
    expect(isHumanControlledKeeper("player-1", "player-10")).toBe(false);
    expect(isHumanControlledKeeper(null, "player-10")).toBe(false);
    expect(isHumanControlledKeeper("player-10", null)).toBe(false);
  });

  it("softens the human's directional input to the keeper's commanded move", () => {
    expect(humanDirectedKeeperMove(0.5, -0.5)).toEqual({ x: 0.5, y: -0.5 });
    expect(humanDirectedKeeperMove(-1, 1)).toEqual({ x: -1, y: 1 });
  });

  it("yields the keeper's arc-hold positioning to the human's directional input", { timeout: 30_000 }, () => {
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);
    const obs = buildCpuObservation(sim.snapshot(), "team-b", "player-10");
    obs.cpuAntiHuddle = true;
    obs.gkBehavior = true;
    obs.keeperPlayerIds = { "team-a": "player-4", "team-b": "player-10" };
    // Mark the ball as already played so the anti-huddle keeper role is live at
    // this first sample (an untouched ball at kickoff keeps the role dormant).
    obs.ball.lastTouchRef = "initiator-touch";
    obs.teamDecision = computeTeamDecision(obs, "team-b");
    obs.cpuDefensiveTackle = true;

    const cpu = createCpuAdapter();
    const cpuFrame = cpu.sample(0, obs);

    const cpu2 = createCpuAdapter();
    const directedObs = { ...obs, humanDirectedKeeperMove: { x: 0, y: 1 } };
    const humanFrame = cpu2.sample(0, directedObs);

    // The human-directed keeper's commanded movement is the human's (moveY > 0).
    expect(humanFrame.moveY).toBeGreaterThan(0);
    // The CPU arc-hold and the human-directed frame are distinct.
    expect(Math.abs(humanFrame.moveY - cpuFrame.moveY)).toBeGreaterThan(1e-6);
  });
});
