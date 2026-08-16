import { describe, expect, it } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { buildCpuObservation, createCpuAdapter } from "../../src/adapters/input-browser/cpu-adapter.js";
import { FOUNDATION_SCENARIO_AI_VS_AI } from "../../src/apps/browser/foundation-scenario.js";

describe("AI-MATCH-E2E-002: autonomous interaction", () => {
  it("uses distinct owned players and produces bounded deterministic interaction", () => {
    const run = () => {
      const sim = createSimulation(createWorld({ scenario: FOUNDATION_SCENARIO_AI_VS_AI }));
      const entries = Object.entries(FOUNDATION_SCENARIO_AI_VS_AI.controlAssignments).map(([controlSlot, assignment]) => ({
        controlSlot,
        assignment,
        adapter: createCpuAdapter(),
      }));
      const start = sim.snapshot();
      let actionEdges = 0;
      let nonZeroFrames = 0;
      for (let i = 0; i < 360; i++) {
        const snapshot = sim.snapshot();
        const frames = entries.map(({ controlSlot, assignment, adapter }) => {
          const obs = buildCpuObservation(snapshot, assignment.teamId, assignment.controlledPlayerId);
          expect(obs.controlledPlayerId).toBe(assignment.controlledPlayerId);
          const frame = adapter.sample(sim.tick, obs);
          frame.controlSlot = controlSlot;
          if (Math.hypot(frame.moveX, frame.moveY) > 0.01) nonZeroFrames++;
          if (frame.pressedButtons !== 0) actionEdges++;
          return frame;
        });
        sim.applyInputs(frames);
        sim.step();
      }
      const end = sim.snapshot();
      return { start, end, hash: sim.stateHash(), actionEdges, nonZeroFrames };
    };

    const first = run();
    const second = run();
    expect(first.hash).toBe(second.hash);
    expect(first.nonZeroFrames).toBeGreaterThan(0);
    expect(first.actionEdges).toBeGreaterThan(0);
    expect(first.end.players.every((p) => Math.abs(p.groundPosition.x) <= 52.5 && Math.abs(p.groundPosition.y) <= 34)).toBe(true);
    const ballMoved = Math.hypot(
      first.end.ball.position.x - first.start.ball.position.x,
      first.end.ball.position.y - first.start.ball.position.y,
    );
    expect(ballMoved).toBeGreaterThan(0.01);
  });
});
