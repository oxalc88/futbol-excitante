import { describe, expect, it } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import {
  assignChaseRoles,
  buildCpuObservation,
  createCpuAdapter,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { FOUNDATION_SCENARIO_AI_VS_AI } from "../../src/apps/browser/foundation-scenario.js";

describe("AI-MATCH-E2E-001: CPU slot ownership and pursuit", () => {
  const assignments = FOUNDATION_SCENARIO_AI_VS_AI.controlAssignments;
  const slot1 = assignments["slot-1"];
  const slot2 = assignments["slot-2"];

  it("builds a different controlled player observation for each slot", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_AI_VS_AI });
    const obsA = buildCpuObservation(world, slot1.teamId, slot1.controlledPlayerId);
    const obsB = buildCpuObservation(world, slot2.teamId, slot2.controlledPlayerId);

    expect(obsA.controlledPlayerId).toBe(slot1.controlledPlayerId);
    expect(obsB.controlledPlayerId).toBe(slot2.controlledPlayerId);
    expect(obsA.controlledPlayerId).not.toBe(obsB.controlledPlayerId);
  });

  it("both CPU slots pursue the ball from opposite sides once it is in play", () => {
    // Anti-huddle kickoff contract (5V5-KICKOFF-ANTI-HUDDLE): while the restart
    // ball carries no touch reference only the kick taker closes on it, so the
    // opposite-sides pursuit is asserted in the in-play window — with the shape
    // stashed both slots still charge, and with the shape over-converging the
    // untouched-window single-taker assertion below goes red.
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_AI_VS_AI });
    const untouchedA = buildCpuObservation(world, slot1.teamId, slot1.controlledPlayerId);
    const untouchedB = buildCpuObservation(world, slot2.teamId, slot2.controlledPlayerId);
    const takerId = assignChaseRoles(untouchedA, slot1.teamId).kickoffTakerId;
    expect(takerId).toBeTruthy();

    const takerFrame = createCpuAdapter().sample(
      0,
      takerId === slot1.controlledPlayerId ? untouchedA : untouchedB,
    );
    const heldFrame = createCpuAdapter().sample(
      0,
      takerId === slot1.controlledPlayerId ? untouchedB : untouchedA,
    );
    expect(Math.abs(takerFrame.moveX) + Math.abs(takerFrame.moveY)).toBeGreaterThan(0);
    expect(heldFrame.moveX).toBe(0);
    expect(heldFrame.moveY).toBe(0);

    // Ball in play: each team's own designated presser closes from its own side.
    const inPlayA = buildCpuObservation(world, slot1.teamId, slot1.controlledPlayerId);
    const inPlayB = buildCpuObservation(world, slot2.teamId, slot2.controlledPlayerId);
    inPlayA.ball.lastTouchRef = "kickoff-touch-0";
    inPlayB.ball.lastTouchRef = "kickoff-touch-0";
    const frameA = createCpuAdapter().sample(0, inPlayA);
    const frameB = createCpuAdapter().sample(0, inPlayB);

    expect(assignChaseRoles(inPlayA, slot1.teamId).chaserPlayerId).toBe(slot1.controlledPlayerId);
    expect(assignChaseRoles(inPlayB, slot2.teamId).chaserPlayerId).toBe(slot2.controlledPlayerId);
    // player-a starts behind the ball (x = -0.5), player-b ahead of it (x = 5).
    expect(frameA.moveX).toBeGreaterThan(0);
    expect(frameB.moveX).toBeLessThan(0);
  });

  it("real slot-routed CPU execution reduces both players' distance to the ball", () => {
    const sim = createSimulation(createWorld({ scenario: FOUNDATION_SCENARIO_AI_VS_AI }));
    const cpuA = createCpuAdapter();
    const cpuB = createCpuAdapter();
    const distance2d = (
      p: { x: number; y: number },
      b: { x: number; y: number },
    ) => Math.hypot(b.x - p.x, b.y - p.y);

    const start = sim.snapshot();
    const startA = start.players.find((p) => p.playerId === slot1.controlledPlayerId)!;
    const startB = start.players.find((p) => p.playerId === slot2.controlledPlayerId)!;
    const startDistanceA = distance2d(startA.groundPosition, start.ball.position);
    const startDistanceB = distance2d(startB.groundPosition, start.ball.position);

    for (let i = 0; i < 60; i++) {
      const snapshot = sim.snapshot();
      const frameA = cpuA.sample(
        sim.tick,
        buildCpuObservation(snapshot, slot1.teamId, slot1.controlledPlayerId),
      );
      const frameB = cpuB.sample(
        sim.tick,
        buildCpuObservation(snapshot, slot2.teamId, slot2.controlledPlayerId),
      );
      frameA.controlSlot = slot1.controlSlot;
      frameB.controlSlot = slot2.controlSlot;
      sim.applyInputs([frameA, frameB]);
      sim.step();
    }

    const end = sim.snapshot();
    const endA = end.players.find((p) => p.playerId === slot1.controlledPlayerId)!;
    const endB = end.players.find((p) => p.playerId === slot2.controlledPlayerId)!;

    expect(distance2d(endA.groundPosition, end.ball.position)).toBeLessThan(startDistanceA);
    expect(distance2d(endB.groundPosition, end.ball.position)).toBeLessThan(startDistanceB);
  });
});
