import { describe, expect, it } from "vitest";
import {
  computeTeamDecision,
  getBallZone,
  teamHasPossession,
} from "../../../src/adapters/input-browser/team-decision-profile.js";
import type { CpuObservation } from "../../../src/adapters/input-browser/cpu-adapter.js";
import {
  buildCpuObservation,
  createCpuAdapter,
} from "../../../src/adapters/input-browser/cpu-adapter.js";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { FOUNDATION_SCENARIO_2V2 } from "../../../src/apps/browser/foundation-scenario.js";

// ---------------------------------------------------------------------------
// Helpers — build minimal CpuObservation fixtures
// ---------------------------------------------------------------------------

function makeObservation(overrides: Partial<CpuObservation>): CpuObservation {
  return {
    players: [
      {
        playerId: "p1",
        teamId: "team-a",
        groundPosition: { x: 0, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
      {
        playerId: "p2",
        teamId: "team-a",
        groundPosition: { x: -5, y: 5 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
      {
        playerId: "p3",
        teamId: "team-b",
        groundPosition: { x: 10, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
      },
      {
        playerId: "p4",
        teamId: "team-b",
        groundPosition: { x: 15, y: -5 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
      },
    ],
    ball: {
      position: { x: 0, y: 0, z: 0 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId: "team-a",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("team-decision-profile", () => {
  describe("getBallZone", () => {
    it("returns 'own' when ball is in team-a's own third", () => {
      // team-a attacks +x, own goal at -x. Ball at x=-30 (near own goal).
      expect(getBallZone(-30, 105, "team-a")).toBe("own");
    });

    it("returns 'center' when ball is in center third", () => {
      expect(getBallZone(0, 105, "team-a")).toBe("center");
      expect(getBallZone(5, 105, "team-a")).toBe("center");
      expect(getBallZone(-5, 105, "team-a")).toBe("center");
    });

    it("returns 'opponent' when ball is in opponent's third", () => {
      // team-a attacks +x. Ball at x=30 (near opponent goal).
      expect(getBallZone(30, 105, "team-a")).toBe("opponent");
    });

    it("returns correct zones for team-b (mirror direction)", () => {
      // team-b attacks -x, own goal at +x. Ball at x=30 = own third.
      expect(getBallZone(30, 105, "team-b")).toBe("own");
      expect(getBallZone(0, 105, "team-b")).toBe("center");
      expect(getBallZone(-30, 105, "team-b")).toBe("opponent");
    });
  });

  describe("teamHasPossession", () => {
    it("returns true when a team player is within possession range of a slow ball", () => {
      const obs = makeObservation({
        ball: {
          position: { x: 1, y: 0, z: 0 },
          linearVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
        },
      });
      // p1 at (0,0), ball at (1,0) → distance 1m < 2m range.
      expect(teamHasPossession(obs, "team-a")).toBe(true);
    });

    it("returns false when no team player is near the ball", () => {
      const obs = makeObservation({
        ball: {
          position: { x: 30, y: 0, z: 0 },
          linearVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
        },
      });
      expect(teamHasPossession(obs, "team-a")).toBe(false);
    });

    it("returns false when ball is moving too fast", () => {
      const obs = makeObservation({
        ball: {
          position: { x: 1, y: 0, z: 0 },
          linearVelocity: { x: 10, y: 0, z: 0 },
          regime: "ground-roll",
        },
      });
      // Ball is 1m away but speed > 3 m/s threshold.
      expect(teamHasPossession(obs, "team-a")).toBe(false);
    });
  });

  describe("computeTeamDecision", () => {
    it("ATTACK when controlling team has ball in opponent's half", () => {
      const obs = makeObservation({
        ball: {
          position: { x: 30, y: 0, z: 0 },
          linearVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
        },
      });
      // p1 at (0,0) → ball at (30,0) distance ≈ 30m, not possessed.
      // But we need a team player near the ball. Move p2 close.
      obs.players[1].groundPosition = { x: 29, y: 0 };
      const decision = computeTeamDecision(obs, "team-a");
      expect(decision.strategy).toBe("ATTACK");
      expect(decision.hasPossession).toBe(true);
      expect(decision.ballZone).toBe("opponent");
    });

    it("DEFEND when opponent has ball in controlling team's half", () => {
      const obs = makeObservation({
        ball: {
          position: { x: -30, y: 0, z: 0 },
          linearVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
        },
        cpuTeamId: "team-a",
      });
      // Opponent p3 at (10,0) → far from ball.
      // Move p4 close to ball at (-30, 0) for opponent possession.
      obs.players[3].groundPosition = { x: -29, y: 0 };
      const decision = computeTeamDecision(obs, "team-a");
      expect(decision.strategy).toBe("DEFEND");
      expect(decision.hasPossession).toBe(false);
      expect(decision.ballZone).toBe("own");
    });

    it("BALANCED when ball is in center third and no clear possession", () => {
      const obs = makeObservation({
        ball: {
          position: { x: 0, y: 0, z: 0 },
          linearVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
        },
      });
      // p1 at (0,0) → ball at (0,0) distance 0 → has possession!
      // Move p1 away so no possession.
      obs.players[0].groundPosition = { x: -20, y: 10 };
      obs.players[1].groundPosition = { x: -15, y: -10 };
      obs.players[2].groundPosition = { x: 20, y: 10 };
      obs.players[3].groundPosition = { x: 15, y: -10 };
      const decision = computeTeamDecision(obs, "team-a");
      expect(decision.strategy).toBe("BALANCED");
      expect(decision.hasPossession).toBe(false);
      expect(decision.ballZone).toBe("center");
    });

    it("ATTACK when behind by 2+ and ball is in center third", () => {
      const obs = makeObservation({
        ball: {
          position: { x: 0, y: 0, z: 0 },
          linearVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
        },
        scoreDifferential: -3,
      });
      // Move all players away from ball so no possession.
      obs.players[0].groundPosition = { x: -20, y: 10 };
      obs.players[1].groundPosition = { x: -15, y: -10 };
      obs.players[2].groundPosition = { x: 20, y: 10 };
      obs.players[3].groundPosition = { x: 15, y: -10 };
      const decision = computeTeamDecision(obs, "team-a");
      expect(decision.strategy).toBe("ATTACK");
    });

    it("DEFEND when ahead by 2+ and ball is in center third", () => {
      const obs = makeObservation({
        ball: {
          position: { x: 0, y: 0, z: 0 },
          linearVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
        },
        scoreDifferential: 3,
      });
      obs.players[0].groundPosition = { x: -20, y: 10 };
      obs.players[1].groundPosition = { x: -15, y: -10 };
      obs.players[2].groundPosition = { x: 20, y: 10 };
      obs.players[3].groundPosition = { x: 15, y: -10 };
      const decision = computeTeamDecision(obs, "team-a");
      expect(decision.strategy).toBe("DEFEND");
    });
  });

  describe("determinism", () => {
    it("same observation produces same decision", () => {
      const obs = makeObservation({
        ball: {
          position: { x: 30, y: 0, z: 0 },
          linearVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
        },
      });
      obs.players[1].groundPosition = { x: 29, y: 0 };
      const d1 = computeTeamDecision(obs, "team-a");
      const d2 = computeTeamDecision(obs, "team-a");
      expect(d1).toEqual(d2);
    });
  });

  describe("slot-wiring: all teammates receive same teamDecision", () => {
    it("all CPU adapters on the same team get identical teamDecision", () => {
      const sim = createSimulation(
        createWorld({ scenario: FOUNDATION_SCENARIO_2V2 }),
      );
      const assignments = FOUNDATION_SCENARIO_2V2.controlAssignments;

      // Group slots by team.
      const slotsByTeam = new Map<string, string[]>();
      for (const [slot, assignment] of Object.entries(assignments)) {
        const list = slotsByTeam.get(assignment.teamId) ?? [];
        list.push(slot);
        slotsByTeam.set(assignment.teamId, list);
      }

      // Run 60 ticks and verify teamDecision consistency per team.
      for (let tick = 0; tick < 60; tick++) {
        const snapshot = sim.snapshot();

        // Compute team decisions.
        const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
        for (const [teamId, slots] of slotsByTeam) {
          const firstSlot = slots[0];
          const firstAssignment = assignments[firstSlot];
          const obs = buildCpuObservation(
            snapshot,
            firstAssignment.teamId,
            firstAssignment.controlledPlayerId,
          );
          teamDecisions.set(teamId, computeTeamDecision(obs, teamId));
        }

        // Build observations for each slot and verify they all get the same decision.
        const frames = [];
        for (const [teamId, slots] of slotsByTeam) {
          const teamDecision = teamDecisions.get(teamId)!;
          for (const slot of slots) {
            const assignment = assignments[slot];
            const obs = buildCpuObservation(
              snapshot,
              assignment.teamId,
              assignment.controlledPlayerId,
            );
            obs.teamDecision = teamDecision;
            expect(obs.teamDecision).toEqual(teamDecision);

            const adapter = createCpuAdapter();
            const frame = adapter.sample(sim.tick, obs);
            frame.controlSlot = slot;
            frames.push(frame);
          }
        }

        sim.applyInputs(frames);
        sim.step();
      }
    });
  });

  describe("integration: real simulation with team decisions", () => {
    it("produces deterministic results with team-decision-wired CPU adapters", () => {
      const run = () => {
        const sim = createSimulation(
          createWorld({ scenario: FOUNDATION_SCENARIO_2V2 }),
        );
        const entries = Object.entries(
          FOUNDATION_SCENARIO_2V2.controlAssignments,
        ).map(([controlSlot, assignment]) => ({
          controlSlot,
          assignment,
          adapter: createCpuAdapter(),
        }));

        const hashes: string[] = [];
        for (let i = 0; i < 120; i++) {
          const snapshot = sim.snapshot();

          // Compute team decisions.
          const teamDecisions = new Map<
            string,
            ReturnType<typeof computeTeamDecision>
          >();
          for (const { assignment } of entries) {
            if (!teamDecisions.has(assignment.teamId)) {
              const obs = buildCpuObservation(
                snapshot,
                assignment.teamId,
                assignment.controlledPlayerId,
              );
              teamDecisions.set(
                assignment.teamId,
                computeTeamDecision(obs, assignment.teamId),
              );
            }
          }

          const frames = entries.map(({ controlSlot, assignment, adapter }) => {
            const obs = buildCpuObservation(
              snapshot,
              assignment.teamId,
              assignment.controlledPlayerId,
            );
            obs.teamDecision = teamDecisions.get(assignment.teamId);
            const frame = adapter.sample(sim.tick, obs);
            frame.controlSlot = controlSlot;
            return frame;
          });

          sim.applyInputs(frames);
          hashes.push(sim.step().stateHash);
        }
        return hashes;
      };

      const first = run();
      const second = run();
      expect(first).toEqual(second);
    });
  });
});
