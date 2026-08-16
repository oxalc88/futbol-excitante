import { describe, expect, it } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import {
  buildCpuObservation,
  createCpuAdapter,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { FOUNDATION_SCENARIO_AI_VS_AI } from "../../src/apps/browser/foundation-scenario.js";

/**
 * Regression captured from the browser AI-vs-AI viewer.
 *
 * The production browser creates one CPU adapter per control slot, but each
 * adapter must make decisions from the player actually assigned to that slot.
 * This test intentionally exercises the real AI-vs-AI scenario and the same
 * CPU observation/adapter path used by production.
 */
describe("AI-MATCH-E2E-001: CPU slot ownership and pursuit", () => {
  const assignments = FOUNDATION_SCENARIO_AI_VS_AI.controlAssignments;

  it("builds a different controlled player observation for each team", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_AI_VS_AI });
    const slot1 = assignments["slot-1"];
    const slot2 = assignments["slot-2"];

    const obsA = buildCpuObservation(
      world,
      slot1.teamId,
      slot1.controlledPlayerId,
    );
    const obsB = buildCpuObservation(
      world,
      slot2.teamId,
      slot2.controlledPlayerId,
    );

    expect(obsA.controlledPlayerId).toBe(slot1.controlledPlayerId);
    expect(obsB.controlledPlayerId).toBe(slot2.controlledPlayerId);
    expect(obsA.controlledPlayerId).not.toBe(obsB.controlledPlayerId);
  });

  it("both CPU slots initially pursue the centre ball from opposite sides", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_AI_VS_AI });
    const cpuA = createCpuAdapter();
    const cpuB = createCpuAdapter();
    const slot1 = assignments["slot-1"];
    const slot2 = assignments["slot-2"];

    const frameA = cpuA.sample(
      0,
      buildCpuObservation(world, slot1.teamId, slot1.controlledPlayerId),
    );
    const frameB = cpuB.sample(
      0,
      buildCpuObservation(world, slot2.teamId, slot2.controlledPlayerId),
    );

    expect(frameA.moveX).toBeGreaterThan(0);
    expect(frameB.moveX).toBeLessThan(0);
  });

  it("real slot-routed CPU execution reduces both players' distance to the ball", () => {
    const sim = createSimulation(
      createWorld({ scenario: FOUNDATION_SCENARIO_AI_VS_AI }),
    );
    const cpuA = createCpuAdapter();
    const cpuB = createCpuAdapter();
    const slot1 = assignments["slot-1"];
    const slot2 = assignments["slot-2"];

    const start = sim.snapshot();
    const startA = start.players.find(
      (p) => p.playerId === slot1.controlledPlayerId,
    );
    const startB = start.players.find(
      (p) => p.playerId === slot2.controlledPlayerId,
    );
    expect(startA).toBeDefined();
    expect(startB).toBeDefined();

    const distance2d = (
      p: { x: number; y: number },
      b: { x: number; y: number },
    ) => Math.hypot(b.x - p.x, b.y - p.y);

    const startDistanceA = distance2d(startA!.groundPosition, start.ball.position);
    const startDistanceB = distance2d(startB!.groundPosition, start.ball.position);

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
    const endA = end.players.find(
      (p) => p.playerId === slot1.controlledPlayerId,
    );
    const endB = end.players.find(
      (p) => p.playerId === slot2.controlledPlayerId,
    );
    expect(endA).toBeDefined();
    expect(endB).toBeDefined();

    expect(distance2d(endA!.groundPosition, end.ball.position)).toBeLessThan(
      startDistanceA,
    );
    expect(distance2d(endB!.groundPosition, end.ball.position)).toBeLessThan(
      startDistanceB,
    );
  });
});
