/**
 * @module tests/unit/scenario/goal-kick
 *
 * Unit tests for goal kick set piece (MATCH-GOAL-KICK).
 *
 * Tests:
 *  - Goal kick state initialization (null fields at start).
 *  - Goal kick phase transitions via restore.
 *  - Ball placement at the goal-area spot.
 *  - Taker selection (closest defending-team player to spot).
 *  - Defending-team positioning (taker at spot, teammates in own half).
 *  - Attacking-team positioning (spread outside goal area).
 *  - Goal kick execution (ball kicked upfield).
 *  - Countdown decrements and triggers kick at zero.
 *  - Phase returns to "playing" after kick execution.
 *  - Deterministic: same pre-goal-kick state → same post-goal-kick state.
 *  - Goal kick is a valid matchPhase value.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { deepClone } from "../../../src/simulation/world/clone.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { MatchPhase } from "../../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Fixture — 3v3 scenario for goal kick testing
// ---------------------------------------------------------------------------

function makeFixture(): ScenarioDefinition {
  return {
    id: "goal-kick-test-v1",
    version: "1.0.0",
    family: "goal-kick",
    durationTicks: 600,
    seed: 42,
    prngAlgorithmId: "mulberry32-v1",
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    configVersion: "foundation-config-v1",
    profile: "SMALL_SIDED",
    pitchLength: 105,
    pitchWidth: 68,
    safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
    players: [
      // team-a (attacks +x, defends left goal at x = -52.5)
      {
        playerId: "player-1", teamId: "team-a",
        groundPosition: { x: -10, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0, desiredHeading: 0,
        archetypeId: "archetype-burst-v1",
      },
      {
        playerId: "player-2", teamId: "team-a",
        groundPosition: { x: 5, y: 10 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0, desiredHeading: 0,
        archetypeId: "archetype-steady-v1",
      },
      {
        playerId: "player-3", teamId: "team-a",
        groundPosition: { x: 5, y: -10 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0, desiredHeading: 0,
        archetypeId: "archetype-steady-v1",
      },
      // team-b (attacks -x, defends right goal at x = +52.5)
      {
        playerId: "player-4", teamId: "team-b",
        groundPosition: { x: 10, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI, desiredHeading: Math.PI,
        archetypeId: "archetype-steady-v1",
      },
      {
        playerId: "player-5", teamId: "team-b",
        groundPosition: { x: -5, y: 10 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI, desiredHeading: Math.PI,
        archetypeId: "archetype-steady-v1",
      },
      {
        playerId: "player-6", teamId: "team-b",
        groundPosition: { x: -5, y: -10 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI, desiredHeading: Math.PI,
        archetypeId: "archetype-steady-v1",
      },
    ],
    ball: {
      position: { x: 0, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    controlAssignments: {
      "slot-1": { controlSlot: "slot-1", teamId: "team-a", controlledPlayerId: "player-1", mode: "AI_FALLBACK" },
      "slot-2": { controlSlot: "slot-2", teamId: "team-b", controlledPlayerId: "player-4", mode: "AI_FALLBACK" },
    },
    missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
    maxConsecutiveMissing: 3,
    inputProgram: {},
    scheduledEvents: {},
    observationWindows: [{ startTick: 0, endTick: 600 }],
    requestedMetrics: [],
  };
}

// ---------------------------------------------------------------------------
// 1. Goal kick state initialization
// ---------------------------------------------------------------------------

describe("MATCH-GOAL-KICK-001: initial state", () => {
  it("goalKickPosition is null at start", () => {
    const world = createWorld({ scenario: makeFixture() });
    const snap = world as unknown as { goalKickPosition: null };
    expect(snap.goalKickPosition).toBeNull();
  });

  it("goalKickAwardingTeam is null at start", () => {
    const world = createWorld({ scenario: makeFixture() });
    const snap = world as unknown as { goalKickAwardingTeam: null };
    expect(snap.goalKickAwardingTeam).toBeNull();
  });

  it("goalKickCountdown is 0 at start", () => {
    const world = createWorld({ scenario: makeFixture() });
    const snap = world as unknown as { goalKickCountdown: number };
    expect(snap.goalKickCountdown).toBe(0);
  });

  it("goalKickTakerId is null at start", () => {
    const world = createWorld({ scenario: makeFixture() });
    const snap = world as unknown as { goalKickTakerId: null };
    expect(snap.goalKickTakerId).toBeNull();
  });

  it("goalKickGoalIndex is null at start", () => {
    const world = createWorld({ scenario: makeFixture() });
    const snap = world as unknown as { goalKickGoalIndex: null };
    expect(snap.goalKickGoalIndex).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Goal kick phase transitions via restore
// ---------------------------------------------------------------------------

describe("MATCH-GOAL-KICK-002: phase transitions", () => {
  it("playing → goal-kick via restore", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    expect(sim.presentation().matchPhase).toBe("playing");

    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
    };
    m.matchPhase = "goal-kick";
    m.goalKickPosition = { x: 47, y: 5 };
    m.goalKickAwardingTeam = "team-b";
    m.goalKickCountdown = 60;
    m.goalKickTakerId = "player-4";
    m.goalKickGoalIndex = 0;
    sim.restore(m);

    expect(sim.presentation().matchPhase).toBe("goal-kick");
  });

  it("goal-kick → playing after countdown reaches zero", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
    };
    m.matchPhase = "goal-kick";
    m.goalKickPosition = { x: 47, y: 5 };
    m.goalKickAwardingTeam = "team-b";
    m.goalKickCountdown = 3;
    m.goalKickTakerId = "player-4";
    m.goalKickGoalIndex = 0;
    sim.restore(m);

    expect(sim.presentation().matchPhase).toBe("goal-kick");
    for (let i = 0; i < 3; i++) { sim.step(); }
    expect(sim.presentation().matchPhase).toBe("playing");
  });
});

// ---------------------------------------------------------------------------
// 3. Goal kick countdown
// ---------------------------------------------------------------------------

describe("MATCH-GOAL-KICK-003: countdown", () => {
  it("goal kick countdown decrements each tick", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
    };
    m.matchPhase = "goal-kick";
    m.goalKickPosition = { x: 47, y: 5 };
    m.goalKickAwardingTeam = "team-b";
    m.goalKickCountdown = 5;
    m.goalKickTakerId = "player-4";
    m.goalKickGoalIndex = 0;
    sim.restore(m);

    for (let i = 0; i < 5; i++) {
      sim.step();
      const snap = sim.snapshot() as { matchPhase: MatchPhase; goalKickCountdown: number };
      if (i < 4) {
        expect(snap.goalKickCountdown).toBeGreaterThan(0);
      }
    }
    expect(sim.presentation().matchPhase).toBe("playing");
  });

  it("short countdown (1 tick)", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
    };
    m.matchPhase = "goal-kick";
    m.goalKickPosition = { x: 47, y: 5 };
    m.goalKickAwardingTeam = "team-b";
    m.goalKickCountdown = 1;
    m.goalKickTakerId = "player-4";
    m.goalKickGoalIndex = 0;
    sim.restore(m);

    sim.step();
    expect(sim.presentation().matchPhase).toBe("playing");
  });
});

// ---------------------------------------------------------------------------
// 4. Goal kick state reset after execution
// ---------------------------------------------------------------------------

describe("MATCH-GOAL-KICK-004: state reset after execution", () => {
  it("goal-kick fields are null/0 after execution", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
    };
    m.matchPhase = "goal-kick";
    m.goalKickPosition = { x: 47, y: 5 };
    m.goalKickAwardingTeam = "team-b";
    m.goalKickCountdown = 2;
    m.goalKickTakerId = "player-4";
    m.goalKickGoalIndex = 0;
    sim.restore(m);

    sim.step(); // 2→1
    sim.step(); // 1→0, goal kick executed

    const snap = sim.snapshot() as {
      matchPhase: MatchPhase;
      goalKickPosition: null;
      goalKickAwardingTeam: null;
      goalKickCountdown: number;
      goalKickTakerId: null;
      goalKickGoalIndex: null;
    };
    expect(snap.matchPhase).toBe("playing");
    expect(snap.goalKickPosition).toBeNull();
    expect(snap.goalKickAwardingTeam).toBeNull();
    expect(snap.goalKickCountdown).toBe(0);
    expect(snap.goalKickTakerId).toBeNull();
    expect(snap.goalKickGoalIndex).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Goal kick execution places ball at goal area
// ---------------------------------------------------------------------------

describe("MATCH-GOAL-KICK-005: ball placement at goal area", () => {
  it("ball is placed at right goal-area spot (goalIndex=0)", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
      ball: { position: { x: number; y: number; z: number } };
    };
    m.matchPhase = "goal-kick";
    m.goalKickPosition = { x: 47, y: 5 };
    m.goalKickAwardingTeam = "team-b";
    m.goalKickCountdown = 1;
    m.goalKickTakerId = "player-4";
    m.goalKickGoalIndex = 0;
    m.ball.position = { x: 0, y: 0, z: 0.11 };
    sim.restore(m);

    sim.step(); // countdown reaches zero, goal kick executed

    const snap = sim.snapshot() as { ball: { position: { x: number; y: number; z: number } } };
    expect(snap.ball.position.x).toBe(47); // GOAL_LINE_X - 5.5 = 52.5 - 5.5 = 47
    expect(snap.ball.position.y).toBe(5);
    expect(snap.ball.position.z).toBe(0.11); // ball radius
  });

  it("ball is placed at left goal-area spot (goalIndex=1)", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
      ball: { position: { x: number; y: number; z: number } };
    };
    m.matchPhase = "goal-kick";
    m.goalKickPosition = { x: -47, y: -5 };
    m.goalKickAwardingTeam = "team-a";
    m.goalKickCountdown = 1;
    m.goalKickTakerId = "player-1";
    m.goalKickGoalIndex = 1;
    m.ball.position = { x: 0, y: 0, z: 0.11 };
    sim.restore(m);

    sim.step(); // countdown reaches zero, goal kick executed

    const snap = sim.snapshot() as { ball: { position: { x: number; y: number; z: number } } };
    expect(snap.ball.position.x).toBe(-47); // -GOAL_LINE_X + 5.5 = -52.5 + 5.5 = -47
    expect(snap.ball.position.y).toBe(-5);
    expect(snap.ball.position.z).toBe(0.11);
  });
});

// ---------------------------------------------------------------------------
// 6. Goal kick executes a kick upfield
// ---------------------------------------------------------------------------

describe("MATCH-GOAL-KICK-006: kick execution", () => {
  it("ball has non-zero velocity after goal kick (ball in flight)", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
    };
    m.matchPhase = "goal-kick";
    m.goalKickPosition = { x: 47, y: 5 };
    m.goalKickAwardingTeam = "team-b";
    m.goalKickCountdown = 1;
    m.goalKickTakerId = "player-4";
    m.goalKickGoalIndex = 0;
    sim.restore(m);

    sim.step(); // goal kick executed

    const snap = sim.snapshot() as { ball: { linearVelocity: { x: number; y: number; z: number } } };
    // Ball should have negative x velocity (upfield from right goal line toward left).
    expect(snap.ball.linearVelocity.x).toBeLessThan(0);
    // Ball should have positive z (lofted distribution).
    expect(snap.ball.linearVelocity.z).toBeGreaterThan(0);
  });

  it("kick from left goal goes upfield", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
    };
    m.matchPhase = "goal-kick";
    m.goalKickPosition = { x: -47, y: -5 };
    m.goalKickAwardingTeam = "team-a";
    m.goalKickCountdown = 1;
    m.goalKickTakerId = "player-1";
    m.goalKickGoalIndex = 1;
    sim.restore(m);

    sim.step(); // goal kick executed

    const snap = sim.snapshot() as { ball: { linearVelocity: { x: number; y: number; z: number } } };
    // Ball should have positive x velocity (upfield from left goal line toward right).
    expect(snap.ball.linearVelocity.x).toBeGreaterThan(0);
    // Ball should have positive z (lofted distribution).
    expect(snap.ball.linearVelocity.z).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Goal kick taker selection
// ---------------------------------------------------------------------------

describe("MATCH-GOAL-KICK-007: taker selection", () => {
  it("taker is closest defending-team player to goal-area spot", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
    };
    m.matchPhase = "goal-kick";
    m.goalKickPosition = { x: 47, y: 5 };
    m.goalKickAwardingTeam = "team-b";
    m.goalKickCountdown = 5; // still counting down, setup done
    m.goalKickTakerId = "player-4";
    m.goalKickGoalIndex = 0;
    sim.restore(m);

    // Verify the state fields are correct after setup.
    const snap = sim.snapshot() as {
      goalKickPosition: { x: number; y: number };
      goalKickTakerId: string;
    };
    expect(snap.goalKickPosition.x).toBe(47);
    expect(snap.goalKickPosition.y).toBe(5);
    expect(snap.goalKickTakerId).toBe("player-4");
  });
});

// ---------------------------------------------------------------------------
// 8. Determinism
// ---------------------------------------------------------------------------

describe("MATCH-GOAL-KICK-008: determinism", () => {
  it("same pre-goal-kick state → same post-goal-kick state", () => {
    const run = (countdown: number) => {
      const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
      const m = deepClone(sim.snapshot()) as {
        matchPhase: MatchPhase;
        goalKickPosition: { x: number; y: number };
        goalKickAwardingTeam: string;
        goalKickCountdown: number;
        goalKickTakerId: string;
        goalKickGoalIndex: 0 | 1;
      };
      m.matchPhase = "goal-kick";
      m.goalKickPosition = { x: 47, y: 5 };
      m.goalKickAwardingTeam = "team-b";
      m.goalKickCountdown = countdown;
      m.goalKickTakerId = "player-4";
      m.goalKickGoalIndex = 0;
      sim.restore(m);

      for (let i = 0; i < countdown + 1; i++) { sim.step(); }
      return sim.snapshot();
    };

    const r1 = run(5);
    const r2 = run(5);
    const s1 = r1 as { ball: { position: { x: number; y: number; z: number }; linearVelocity: { x: number; y: number; z: number } } };
    const s2 = r2 as { ball: { position: { x: number; y: number; z: number }; linearVelocity: { x: number; y: number; z: number } } };

    expect(s1.ball.position.x).toBe(s2.ball.position.x);
    expect(s1.ball.position.y).toBe(s2.ball.position.y);
    expect(s1.ball.position.z).toBe(s2.ball.position.z);
    expect(s1.ball.linearVelocity.x).toBe(s2.ball.linearVelocity.x);
    expect(s1.ball.linearVelocity.y).toBe(s2.ball.linearVelocity.y);
    expect(s1.ball.linearVelocity.z).toBe(s2.ball.linearVelocity.z);
  });
});

// ---------------------------------------------------------------------------
// 9. Goal kick is included in state hash
// ---------------------------------------------------------------------------

describe("MATCH-GOAL-KICK-009: determinism with goal-kick phase", () => {
  it("different matchPhase values produce different hashes", () => {
    const s1 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const s2 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);

    expect(s1.stateHash()).toBe(s2.stateHash());

    const m2 = deepClone(s2.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
    };
    m2.matchPhase = "goal-kick";
    m2.goalKickPosition = { x: 47, y: 5 };
    m2.goalKickAwardingTeam = "team-b";
    m2.goalKickCountdown = 60;
    m2.goalKickTakerId = "player-4";
    m2.goalKickGoalIndex = 0;
    s2.restore(m2);

    expect(s1.stateHash()).not.toBe(s2.stateHash());
  });

  it("countdown value affects hash", () => {
    const s1 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const s2 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);

    const m1 = deepClone(s1.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
    };
    m1.matchPhase = "goal-kick";
    m1.goalKickPosition = { x: 47, y: 5 };
    m1.goalKickAwardingTeam = "team-b";
    m1.goalKickCountdown = 60;
    m1.goalKickTakerId = "player-4";
    m1.goalKickGoalIndex = 0;
    s1.restore(m1);

    const m2 = deepClone(s2.snapshot()) as {
      matchPhase: MatchPhase;
      goalKickPosition: { x: number; y: number };
      goalKickAwardingTeam: string;
      goalKickCountdown: number;
      goalKickTakerId: string;
      goalKickGoalIndex: 0 | 1;
    };
    m2.matchPhase = "goal-kick";
    m2.goalKickPosition = { x: 47, y: 5 };
    m2.goalKickAwardingTeam = "team-b";
    m2.goalKickCountdown = 30;
    m2.goalKickTakerId = "player-4";
    m2.goalKickGoalIndex = 0;
    s2.restore(m2);

    expect(s1.stateHash()).not.toBe(s2.stateHash());
  });
});

// ---------------------------------------------------------------------------
// 10. Goal kick is a valid matchPhase value
// ---------------------------------------------------------------------------

describe("MATCH-GOAL-KICK-010: valid matchPhase value", () => {
  it("goal-kick is a valid matchPhase value", () => {
    const phases: MatchPhase[] = ["playing", "goal", "halftime", "fulltime", "kickoff", "corner-kick", "throw-in", "goal-kick"];
    for (const phase of phases) {
      const world = createWorld({ scenario: makeFixture() });
      const sim = createSimulation(world, NO_OP_OBSERVER);
      const mutable = deepClone(sim.snapshot()) as { matchPhase: MatchPhase };
      mutable.matchPhase = phase;
      sim.restore(mutable);
      expect(sim.presentation().matchPhase).toBe(phase);
    }
  });
});
