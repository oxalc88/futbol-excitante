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
  it("builds a different controlled player observation for each team", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_AI_VS_AI });

    const obsA = buildCpuObservation(world, "team-a");
    const obsB = buildCpuObservation(world, "team-b");

    expect(obsA.controlledPlayerId).toBe("player-a");
    expect(obsB.controlledPlayerId).toBe("player-b");
    expect(obsA.controlledPlayerId).not.toBe(obsB.controlledPlayerId);
  });

  it("both CPU slots initially pursue the centre ball from opposite sides", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_AI_VS_AI });
    const cpuA = createCpuAdapter();
    const cpuB = createCpuAdapter();

    const frameA = cpuA.sample(0, buildCpuObservation(world, "team-a"));
    const frameB = cpuB.sample(0, buildCpuObservation(world, "team-b"));

    // player-a starts at x=-5 and should move toward +x to reach the ball.
    expect(frameA.moveX).toBeGreaterThan(0);
    // player-b starts at x=+5 and should move toward -x to reach the ball.
    expect(frameB.moveX).toBeLessThan(0);
  });

  it("real slot-routed CPU execution reduces both players' distance to the ball", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_AI_VS_AI });
    const sim = createSimulation(world);
    const cpuA = createCpuAdapter();
    const cpuB = createCpuAdapter();

    const start = sim.snapshot();
    const startBall = start.ball.position;
    const startA = start.players.find((p) => p.playerId === "player-a");
    const startB = start.players.find((p) => p.playerId === "player-b");
    expect(startA).toBeDefined();
    expect(startB).toBeDefined();

    const distance2d = (
      p: { x: number; y: number },
      b: { x: number; y: number },
    ) => Math.hypot(b.x - p.x, b.y - p.y);

    const startDistanceA = distance2d(startA!.groundPosition, startBall);
    const startDistanceB = distance2d(startB!.groundPosition, startBall);

    for (let i = 0; i < 60; i++) {
      const snapshot = sim.snapshot();
      const frameA = cpuA.sample(sim.tick, buildCpuObservation(snapshot, "team-a"));
      const frameB = cpuB.sample(sim.tick, buildCpuObservation(snapshot, "team-b"));
      frameA.controlSlot = "slot-1";
      frameB.controlSlot = "slot-2";
      sim.applyInputs([frameA, frameB]);
      sim.step();
    }

    const end = sim.snapshot();
    const endA = end.players.find((p) => p.playerId === "player-a");
    const endB = end.players.find((p) => p.playerId === "player-b");
    expect(endA).toBeDefined();
    expect(endB).toBeDefined();

    const endDistanceA = distance2d(endA!.groundPosition, end.ball.position);
    const endDistanceB = distance2d(endB!.groundPosition, end.ball.position);

    expect(endDistanceA).toBeLessThan(startDistanceA);
    expect(endDistanceB).toBeLessThan(startDistanceB);
  });
});
