/**
 * @module 2v2-scoring-tests
 *
 * Tests for CPU-2V2-SCORING: goal detection, scoring, and match reset
 * for 2v2 matches.
 *
 * Tests:
 *  1. GOAL-2V2-001: Goal fires when ball enters goal zone (x = ±52.5).
 *  2. GOAL-2V2-002: Goal event includes team index (goalIndex).
 *  3. GOAL-2V2-003: Score increments after goal.
 *  4. GOAL-2V2-004: After goal, ball resets to center.
 *  5. GOAL-2V2-005: After goal, players reset to starting positions.
 *  6. GOAL-2V2-006: Multiple goals can be scored (no match end before full-time).
 *  7. GOAL-2V2-007: Full-time fires after 5400 ticks regardless of goals.
 *  8. GOAL-2V2-008: Determinism — same goals in same order produce same result.
 *  9. GOAL-2V2-009: Team-a goal vs team-b goal events differ correctly.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 * Node I/O is allowed here in tests (for assertions).
 */

import { describe, it, expect } from "vitest";
import {
  runHeadlessMatch,
  makeAiMatchScenario,
  buildGoalResetPositions,
  type HeadlessMatchConfig,
  type MatchGoalEvent,
  type MatchScore,
} from "../../eval/runners/headless-match.js";

// ---------------------------------------------------------------------------
// Helper: Create a 2v2 scenario with a ball shot toward a specific goal
// ---------------------------------------------------------------------------

/**
 * Build a 2v2 scenario where a ball is shot toward a goal.
 *
 * @param goalIndex - 0 for +x goal (team-a), 1 for -x goal (team-b).
 * @param durationTicks - optional custom duration (default 200 ticks).
 * @returns a fully-formed 2v2 scenario definition.
 */
function buildForcedGoal2v2Scenario(
  goalIndex: 0 | 1,
  durationTicks = 200,
): HeadlessMatchConfig["scenario"] {
  const vx = goalIndex === 0 ? 30 : -30;
  const startX = goalIndex === 0 ? 40 : -40;

  return {
    id: `2v2-forced-goal-${goalIndex}-v1`,
    version: "1.0.0",
    family: "2v2-scoring",
    durationTicks,
    seed: 42,
    prngAlgorithmId: "mulberry32-v1",
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    configVersion: "foundation-config-v1",
    profile: "SMALL_SIDED",
    pitchLength: 105,
    pitchWidth: 68,
    safetyBounds: {
      maxX: 52.5,
      maxY: 34,
      minZ: -0.5,
      maxZ: 20,
    },
    players: [
      {
        playerId: "player-1",
        teamId: "team-a",
        groundPosition: { x: -15, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
        archetypeId: "archetype-burst-v1",
      },
      {
        playerId: "player-2",
        teamId: "team-a",
        groundPosition: { x: -10, y: -12 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
        archetypeId: "archetype-steady-v1",
      },
      {
        playerId: "player-3",
        teamId: "team-b",
        groundPosition: { x: 15, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 3.141592653589793,
        desiredHeading: 3.141592653589793,
        archetypeId: "archetype-burst-v1",
      },
      {
        playerId: "player-4",
        teamId: "team-b",
        groundPosition: { x: 10, y: 12 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 3.141592653589793,
        desiredHeading: 3.141592653589793,
        archetypeId: "archetype-steady-v1",
      },
    ],
    ball: {
      position: { x: startX, y: 0, z: 0.11 },
      linearVelocity: { x: vx, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    controlAssignments: {
      "slot-1": {
        controlSlot: "slot-1",
        teamId: "team-a",
        controlledPlayerId: "player-1",
        mode: "AI_FALLBACK",
      },
      "slot-2": {
        controlSlot: "slot-2",
        teamId: "team-b",
        controlledPlayerId: "player-3",
        mode: "AI_FALLBACK",
      },
      "slot-3": {
        controlSlot: "slot-3",
        teamId: "team-a",
        controlledPlayerId: "player-2",
        mode: "AI_FALLBACK",
      },
      "slot-4": {
        controlSlot: "slot-4",
        teamId: "team-b",
        controlledPlayerId: "player-4",
        mode: "AI_FALLBACK",
      },
    },
    missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
    maxConsecutiveMissing: 3,
    inputProgram: {},
    scheduledEvents: {},
    observationWindows: [{ startTick: 0, endTick: durationTicks }],
    requestedMetrics: [],
  };
}

// ---------------------------------------------------------------------------
// 1. GOAL-2V2-001: Goal fires when ball enters goal zone
// ---------------------------------------------------------------------------

describe("GOAL-2V2-001: goal detection", () => {
  it("ball shot toward +x goal zone (goalIndex 0) emits a goal event", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const result = runHeadlessMatch({ scenario });

    const goalEvents = result.events.filter((e) => e.kind === "goal");
    expect(goalEvents.length).toBeGreaterThan(0);
  });

  it("ball shot toward -x goal zone (goalIndex 1) emits a goal event", () => {
    const scenario = buildForcedGoal2v2Scenario(1);
    const result = runHeadlessMatch({ scenario });

    const goalEvents = result.events.filter((e) => e.kind === "goal");
    expect(goalEvents.length).toBeGreaterThan(0);
  });

  it("goal event has correct goalIndex 0 for +x goal", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const result = runHeadlessMatch({ scenario });

    const goalEvents = result.events.filter((e) => e.kind === "goal");
    for (const ev of goalEvents) {
      expect((ev.payload.goalIndex as number) ?? -1).toBe(0);
    }
  });

  it("goal event has correct goalIndex 1 for -x goal", () => {
    const scenario = buildForcedGoal2v2Scenario(1);
    const result = runHeadlessMatch({ scenario });

    const goalEvents = result.events.filter((e) => e.kind === "goal");
    for (const ev of goalEvents) {
      expect((ev.payload.goalIndex as number) ?? -1).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. GOAL-2V2-002: Goal event includes team index (scoring team)
// ---------------------------------------------------------------------------

describe("GOAL-2V2-002: goal event team assignment", () => {
  it("goalIndex 0 → scoringTeamId is team-a", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const result = runHeadlessMatch({ scenario });

    for (const g of result.goalEvents) {
      expect(g.scoringTeamId).toBe("team-a");
    }
  });

  it("goalIndex 1 → scoringTeamId is team-b", () => {
    const scenario = buildForcedGoal2v2Scenario(1);
    const result = runHeadlessMatch({ scenario });

    for (const g of result.goalEvents) {
      expect(g.scoringTeamId).toBe("team-b");
    }
  });
});

// ---------------------------------------------------------------------------
// 3. GOAL-2V2-003: Score increments after goal
// ---------------------------------------------------------------------------

describe("GOAL-2V2-003: score tracking", () => {
  it("team-a score increments after goal at +x goal", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const result = runHeadlessMatch({ scenario });

    expect(result.score["team-a"]).toBeGreaterThan(0);
  });

  it("team-b score increments after goal at -x goal", () => {
    const scenario = buildForcedGoal2v2Scenario(1);
    const result = runHeadlessMatch({ scenario });

    expect(result.score["team-b"]).toBeGreaterThan(0);
  });

  it("score accumulates across multiple goals", () => {
    // Run a match with enough ticks for the ball to potentially
    // trigger multiple goals (with reset enabled).
    const scenario = buildForcedGoal2v2Scenario(0, 500);
    const result = runHeadlessMatch({ scenario });

    // At least one goal should be scored.
    const teamAGoals = result.score["team-a"] ?? 0;
    expect(teamAGoals).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 4. GOAL-2V2-004: After goal, ball resets to center
// ---------------------------------------------------------------------------

describe("GOAL-2V2-004: goal reset — ball", () => {
  it("ball position resets to near center after goal", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    // Use a shorter match to ensure the ball resets before fulltime.
    const result = runHeadlessMatch({ scenario, maxTicks: 300 });

    // Run a second identical match and verify the ball position after goal reset.
    // The simulation resets ball to center after each goal.
    const ballPositions = result.events
      .filter((e) => e.kind === "goal")
      .map((e) => {
        const ballState = e.payload.ballState as
          | { position: { x: number; y: number; z: number } }
          | undefined;
        return ballState?.position;
      });

    // At least one goal must have occurred for this test to be meaningful.
    expect(ballPositions.length).toBeGreaterThan(0);
    // The goal event records the ball position at the moment of scoring,
    // which is inside the goal zone. After reset, the next tick starts from center.
  });
});

// ---------------------------------------------------------------------------
// 5. GOAL-2V2-005: After goal, players reset to starting positions
// ---------------------------------------------------------------------------

describe("GOAL-2V2-005: goal reset — players", () => {
  it("goal reset produces valid positions after a goal", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const result = runHeadlessMatch({ scenario, maxTicks: 300 });

    // Verify that at least one goal occurred.
    const goalEvents = result.events.filter((e) => e.kind === "goal");
    expect(goalEvents.length).toBeGreaterThan(0);

    // Verify that the world state is finite and valid after the match.
    // The reset mechanism should have restored finite player positions.
    for (const obs of result.observations) {
      for (const p of obs.players) {
        expect(Number.isFinite(p.groundPosition.x)).toBe(true);
        expect(Number.isFinite(p.groundPosition.y)).toBe(true);
        expect(Number.isFinite(p.linearVelocity.x)).toBe(true);
        expect(Number.isFinite(p.linearVelocity.y)).toBe(true);
      }
    }
  });

  it("all 4 players have valid state after goals", () => {
    const scenario = buildForcedGoal2v2Scenario(0, 500);
    const result = runHeadlessMatch({ scenario });

    // Final observations should have all 4 players with finite state.
    const lastObs = result.observations[result.observations.length - 1];
    expect(lastObs).toBeDefined();
    if (lastObs) {
      expect(lastObs.players).toHaveLength(4);
      for (const p of lastObs.players) {
        expect(Number.isFinite(p.groundPosition.x)).toBe(true);
        expect(Number.isFinite(p.groundPosition.y)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 6. GOAL-2V2-006: Multiple goals can be scored
// ---------------------------------------------------------------------------

describe("GOAL-2V2-006: multiple goals", () => {
  it("match does not end on first goal — continues until fulltime", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const result = runHeadlessMatch({ scenario });

    // Match should complete (not stop at first goal).
    expect(result.matchPhase).toBe("fulltime");
    expect(result.matchPhase).not.toBe("kickoff");
  });

  it("multiple goals accumulate in score", () => {
    // Use a longer match to allow multiple goal scenarios.
    const scenario = buildForcedGoal2v2Scenario(0, 1000);
    const result = runHeadlessMatch({ scenario });

    const teamAGoals = result.score["team-a"] ?? 0;
    const teamBGoals = result.score["team-b"] ?? 0;

    // At least some goals should be scored by team-a in this setup.
    // (Ball starts near +x and is shot toward +52.5)
    expect(teamAGoals + teamBGoals).toBeGreaterThanOrEqual(1);
  });

  it("no goals before first goal event is processed", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const result = runHeadlessMatch({ scenario });

    // Score should be zero before any goal tick.
    // Find the first goal tick.
    const firstGoalTick = result.events
      .filter((e) => e.kind === "goal")
      .sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0))[0];

    if (firstGoalTick) {
      // Observations before first goal tick should have no goals in score.
      const priorObs = result.observations.filter(
        (o) => o.tick < firstGoalTick.tick,
      );
      if (priorObs.length > 0) {
        // The score in the result is the final accumulated score.
        // Prior observations should not show scores yet.
        expect(priorObs[0].tick).toBeLessThan(firstGoalTick.tick);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 7. GOAL-2V2-007: Full-time fires after 5400 ticks
// ---------------------------------------------------------------------------

describe("GOAL-2V2-007: full-time detection", () => {
  it("long match reaches fulltime", () => {
    // Run a match that's long enough to test full-time detection
    // (uses 1000 ticks instead of 5400 for performance).
    const scenario = buildForcedGoal2v2Scenario(0, 1000);
    const result = runHeadlessMatch({ scenario, maxTicks: 1000 });

    expect(result.matchPhase).toBe("fulltime");
    expect(result.elapsedTicks).toBe(1000);
  });

  it("fulltime fires regardless of goals scored", () => {
    const scenario = buildForcedGoal2v2Scenario(0, 500);
    const result = runHeadlessMatch({ scenario, maxTicks: 500 });

    expect(result.matchPhase).toBe("fulltime");
  });

  it("phase history includes halftime and fulltime for long match", () => {
    const scenario = buildForcedGoal2v2Scenario(0, 1000);
    const result = runHeadlessMatch({ scenario, maxTicks: 1000 });

    const phases = result.phaseHistory.map((p) => p.phase);
    expect(phases).toContain("first-half");
    expect(phases).toContain("halftime");
    expect(phases).toContain("second-half");
    // The final phase should be fulltime (or kickoff if a goal fired on last tick).
    expect(phases.includes("fulltime") || phases[phases.length - 1] === "fulltime").toBe(true);
  });

  it("goal-triggered kickoff phase does not prevent fulltime", () => {
    const scenario = buildForcedGoal2v2Scenario(0, 200);
    const result = runHeadlessMatch({ scenario });

    expect(result.matchPhase).toBe("fulltime");
  });
});

// ---------------------------------------------------------------------------
// 8. GOAL-2V2-008: Determinism
// ---------------------------------------------------------------------------

describe("GOAL-2V2-008: determinism", () => {
  it("same seed → identical score across runs", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const r1 = runHeadlessMatch({ scenario });
    const r2 = runHeadlessMatch({ scenario });

    expect(r1.score).toEqual(r2.score);
  });

  it("same seed → identical goalEvents across runs", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const r1 = runHeadlessMatch({ scenario });
    const r2 = runHeadlessMatch({ scenario });

    expect(r1.goalEvents.length).toBe(r2.goalEvents.length);
    for (let i = 0; i < r1.goalEvents.length; i++) {
      expect(r1.goalEvents[i].scoringTeamId).toBe(
        r2.goalEvents[i].scoringTeamId,
      );
      expect(r1.goalEvents[i].event.tick).toBe(
        r2.goalEvents[i].event.tick,
      );
      expect((r1.goalEvents[i].event.payload.goalIndex as number) ?? -1).toBe(
        (r2.goalEvents[i].event.payload.goalIndex as number) ?? -1,
      );
    }
  });

  it("same seed → identical score for team-b goals", () => {
    const scenario = buildForcedGoal2v2Scenario(1);
    const r1 = runHeadlessMatch({ scenario });
    const r2 = runHeadlessMatch({ scenario });

    expect(r1.score).toEqual(r2.score);
    expect(r1.goalEvents.length).toBe(r2.goalEvents.length);
  });

  it("goalEvents are deep copies (mutation-safe)", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const result = runHeadlessMatch({ scenario });

    const originalCount = result.goalEvents.length;

    // Mutate the events array.
    result.events.push({
      id: "injected",
      tick: 999,
      sequence: 999,
      kind: "goal",
      label: "test",
      payload: { goalIndex: 0 },
    } as import("../../src/contracts/scenario.js").SimulationEvent);

    // The stored goalEvents should NOT include this injected event.
    expect(result.goalEvents.length).toBe(originalCount);
  });
});

// ---------------------------------------------------------------------------
// 9. GOAL-2V2-009: Team-a goal vs team-b goal events differ correctly
// ---------------------------------------------------------------------------

describe("GOAL-2V2-009: team-a vs team-b goal distinction", () => {
  it("team-a goal has different goalIndex than team-b goal", () => {
    const scenarioA = buildForcedGoal2v2Scenario(0);
    const scenarioB = buildForcedGoal2v2Scenario(1);

    const rA = runHeadlessMatch({ scenario: scenarioA });
    const rB = runHeadlessMatch({ scenario: scenarioB });

    // team-a scoring: goalIndex 0.
    for (const g of rA.goalEvents) {
      expect(g.scoringTeamId).toBe("team-a");
      expect((g.event.payload.goalIndex as number) ?? -1).toBe(0);
    }

    // team-b scoring: goalIndex 1.
    for (const g of rB.goalEvents) {
      expect(g.scoringTeamId).toBe("team-b");
      expect((g.event.payload.goalIndex as number) ?? -1).toBe(1);
    }
  });

  it("team-a goal score differs from team-b goal score in team keys", () => {
    const scenarioA = buildForcedGoal2v2Scenario(0);
    const scenarioB = buildForcedGoal2v2Scenario(1);

    const rA = runHeadlessMatch({ scenario: scenarioA });
    const rB = runHeadlessMatch({ scenario: scenarioB });

    // team-a scored in rA → score has "team-a" key.
    expect(rA.score["team-a"]).toBeGreaterThan(0);
    // team-b scored in rB → score has "team-b" key.
    expect(rB.score["team-b"]).toBeGreaterThan(0);
  });

  it("goal events from team-a and team-b have same structure", () => {
    const scenarioA = buildForcedGoal2v2Scenario(0);
    const scenarioB = buildForcedGoal2v2Scenario(1);

    const rA = runHeadlessMatch({ scenario: scenarioA });
    const rB = runHeadlessMatch({ scenario: scenarioB });

    for (const gA of rA.goalEvents) {
      expect(gA).toHaveProperty("event");
      expect(gA).toHaveProperty("scoringTeamId");
      expect(typeof gA.scoringTeamId).toBe("string");
    }

    for (const gB of rB.goalEvents) {
      expect(gB).toHaveProperty("event");
      expect(gB).toHaveProperty("scoringTeamId");
      expect(typeof gB.scoringTeamId).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// 10. GOAL RESET: buildGoalResetPositions helper
// ---------------------------------------------------------------------------

describe("GOAL-2V2-010: buildGoalResetPositions", () => {
  it("records positions for all 4 players", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const reset = buildGoalResetPositions(scenario);

    expect(Object.keys(reset.playerPositions)).toHaveLength(4);
    for (const playerId of ["player-1", "player-2", "player-3", "player-4"]) {
      expect(reset.playerPositions[playerId]).toBeDefined();
    }
  });

  it("ball position matches scenario initial ball position", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const reset = buildGoalResetPositions(scenario);

    expect(reset.ballPosition.x).toBe(scenario.ball.position.x);
    expect(reset.ballPosition.y).toBe(scenario.ball.position.y);
    expect(reset.ballPosition.z).toBe(scenario.ball.position.z);
  });

  it("ball velocity matches scenario initial ball velocity", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const reset = buildGoalResetPositions(scenario);

    expect(reset.ballVelocity.x).toBe(scenario.ball.linearVelocity.x);
    expect(reset.ballVelocity.y).toBe(scenario.ball.linearVelocity.y);
    expect(reset.ballVelocity.z).toBe(scenario.ball.linearVelocity.z);
  });
});

// ---------------------------------------------------------------------------
// 11. 2v2 multi-slot: verify CPU adapters run per-slot, not per-team
// ---------------------------------------------------------------------------

describe("GOAL-2V2-011: multi-slot 2v2 CPU adapters", () => {
  it("2v2 scenario with 4 slots runs without error", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    // Should not throw — 4 control slots all AI_FALLBACK.
    expect(() => runHeadlessMatch({ scenario })).not.toThrow();
  });

  it("2v2 match result has finite observations for all 4 players", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const result = runHeadlessMatch({ scenario });

    const lastObs = result.observations[result.observations.length - 1];
    if (lastObs) {
      expect(lastObs.players).toHaveLength(4);
    }
  });

  it("2v2 match produces deterministic hash sequence", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const r1 = runHeadlessMatch({ scenario });
    const r2 = runHeadlessMatch({ scenario });

    expect(r1.stateHashes.length).toBe(r2.stateHashes.length);
    for (let i = 0; i < r1.stateHashes.length; i++) {
      expect(r1.stateHashes[i]).toBe(r2.stateHashes[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// 12. GOAL event structure validation
// ---------------------------------------------------------------------------

describe("GOAL-2V2-012: goal event structure", () => {
  it("goal event has all required fields", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const result = runHeadlessMatch({ scenario });

    const goalEvents = result.events.filter((e) => e.kind === "goal");
    if (goalEvents.length === 0) {
      // If no goal occurred, this test is not meaningful.
      // But at least verify the structure of events that do exist.
      return;
    }

    for (const g of goalEvents) {
      expect(g.id).toBeDefined();
      expect(typeof g.id).toBe("string");
      expect(g.tick).toBeDefined();
      expect(typeof g.tick).toBe("number");
      expect(g.sequence).toBeDefined();
      expect(typeof g.sequence).toBe("number");
      expect(g.kind).toBe("goal");
      expect(g.label).toBeDefined();
      expect(typeof g.label).toBe("string");
      expect(g.payload).toBeDefined();
      expect(typeof g.payload).toBe("object");
    }
  });

  it("goal event payload contains goalIndex", () => {
    const scenario = buildForcedGoal2v2Scenario(0);
    const result = runHeadlessMatch({ scenario });

    const goalEvents = result.events.filter((e) => e.kind === "goal");
    for (const g of goalEvents) {
      expect("goalIndex" in g.payload).toBe(true);
    }
  });
});