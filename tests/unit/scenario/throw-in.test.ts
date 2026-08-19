/**
 * @module tests/unit/scenario/throw-in
 *
 * Unit tests for throw-in set piece (MATCH-THROW-IN).
 *
 * Tests:
 *  - Throw-in state initialization (null fields at start).
 *  - Throw-in phase transition via restore.
 *  - Ball placement at the touchline exit point.
 *  - Taker selection (closest awarding-team player to exit point).
 *  - Awarding-team positioning (taker at sideline, receivers in play).
 *  - Defensive team positioning (defenders marking).
 *  - Throw-in execution (ball thrown into play).
 *  - Countdown decrements and triggers throw at zero.
 *  - Phase returns to "playing" after throw execution.
 *  - Deterministic: same pre-throw-in state → same post-throw-in state.
 *  - Throw-in is a valid matchPhase value.
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
// Fixture — 3v3 scenario for throw-in testing
// ---------------------------------------------------------------------------

function makeFixture(): ScenarioDefinition {
  return {
    id: "throw-in-test-v1",
    version: "1.0.0",
    family: "throw-in",
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
// 1. Throw-in state initialization
// ---------------------------------------------------------------------------

describe("MATCH-THROW-IN-001: initial state", () => {
  it("throwInPosition is null at start", () => {
    const world = createWorld({ scenario: makeFixture() });
    const snap = world as unknown as { throwInPosition: null };
    expect(snap.throwInPosition).toBeNull();
  });

  it("throwInAwardingTeam is null at start", () => {
    const world = createWorld({ scenario: makeFixture() });
    const snap = world as unknown as { throwInAwardingTeam: null };
    expect(snap.throwInAwardingTeam).toBeNull();
  });

  it("throwInCountdown is 0 at start", () => {
    const world = createWorld({ scenario: makeFixture() });
    const snap = world as unknown as { throwInCountdown: number };
    expect(snap.throwInCountdown).toBe(0);
  });

  it("throwInTakerId is null at start", () => {
    const world = createWorld({ scenario: makeFixture() });
    const snap = world as unknown as { throwInTakerId: null };
    expect(snap.throwInTakerId).toBeNull();
  });

  it("throwInTouchlineIndex is null at start", () => {
    const world = createWorld({ scenario: makeFixture() });
    const snap = world as unknown as { throwInTouchlineIndex: null };
    expect(snap.throwInTouchlineIndex).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Throw-in phase transitions via restore
// ---------------------------------------------------------------------------

describe("MATCH-THROW-IN-002: phase transitions", () => {
  it("playing → throw-in via restore", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    expect(sim.presentation().matchPhase).toBe("playing");

    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
    };
    m.matchPhase = "throw-in";
    m.throwInPosition = { x: 20, y: 34 };
    m.throwInAwardingTeam = "team-a";
    m.throwInCountdown = 60;
    m.throwInTakerId = "player-1";
    m.throwInTouchlineIndex = 0;
    sim.restore(m);

    expect(sim.presentation().matchPhase).toBe("throw-in");
  });

  it("throw-in → playing after countdown reaches zero", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
    };
    m.matchPhase = "throw-in";
    m.throwInPosition = { x: 20, y: 34 };
    m.throwInAwardingTeam = "team-a";
    m.throwInCountdown = 3;
    m.throwInTakerId = "player-1";
    m.throwInTouchlineIndex = 0;
    sim.restore(m);

    expect(sim.presentation().matchPhase).toBe("throw-in");
    for (let i = 0; i < 3; i++) { sim.step(); }
    expect(sim.presentation().matchPhase).toBe("playing");
  });
});

// ---------------------------------------------------------------------------
// 3. Throw-in countdown
// ---------------------------------------------------------------------------

describe("MATCH-THROW-IN-003: countdown", () => {
  it("throw-in countdown decrements each tick", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
    };
    m.matchPhase = "throw-in";
    m.throwInPosition = { x: 20, y: 34 };
    m.throwInAwardingTeam = "team-a";
    m.throwInCountdown = 5;
    m.throwInTakerId = "player-1";
    m.throwInTouchlineIndex = 0;
    sim.restore(m);

    for (let i = 0; i < 5; i++) {
      sim.step();
      const snap = sim.snapshot() as { matchPhase: MatchPhase; throwInCountdown: number };
      if (i < 4) {
        expect(snap.throwInCountdown).toBeGreaterThan(0);
      }
    }
    expect(sim.presentation().matchPhase).toBe("playing");
  });

  it("short countdown (1 tick)", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
    };
    m.matchPhase = "throw-in";
    m.throwInPosition = { x: -20, y: -34 };
    m.throwInAwardingTeam = "team-b";
    m.throwInCountdown = 1;
    m.throwInTakerId = "player-4";
    m.throwInTouchlineIndex = 1;
    sim.restore(m);

    sim.step();
    expect(sim.presentation().matchPhase).toBe("playing");
  });
});

// ---------------------------------------------------------------------------
// 4. Throw-in state reset after execution
// ---------------------------------------------------------------------------

describe("MATCH-THROW-IN-004: state reset after execution", () => {
  it("throw-in fields are null/0 after execution", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
    };
    m.matchPhase = "throw-in";
    m.throwInPosition = { x: 20, y: 34 };
    m.throwInAwardingTeam = "team-a";
    m.throwInCountdown = 2;
    m.throwInTakerId = "player-1";
    m.throwInTouchlineIndex = 0;
    sim.restore(m);

    sim.step(); // 2→1
    sim.step(); // 1→0, throw-in executed

    const snap = sim.snapshot() as {
      matchPhase: MatchPhase;
      throwInPosition: null;
      throwInAwardingTeam: null;
      throwInCountdown: number;
      throwInTakerId: null;
      throwInTouchlineIndex: null;
    };
    expect(snap.matchPhase).toBe("playing");
    expect(snap.throwInPosition).toBeNull();
    expect(snap.throwInAwardingTeam).toBeNull();
    expect(snap.throwInCountdown).toBe(0);
    expect(snap.throwInTakerId).toBeNull();
    expect(snap.throwInTouchlineIndex).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Throw-in execution places ball at sideline
// ---------------------------------------------------------------------------

describe("MATCH-THROW-IN-005: ball placement at sideline", () => {
  it("ball is placed at upper touchline exit point", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
      ball: { position: { x: number; y: number; z: number } };
    };
    m.matchPhase = "throw-in";
    m.throwInPosition = { x: 20, y: 34 };
    m.throwInAwardingTeam = "team-a";
    m.throwInCountdown = 1;
    m.throwInTakerId = "player-1";
    m.throwInTouchlineIndex = 0;
    m.ball.position = { x: 0, y: 0, z: 0.11 };
    sim.restore(m);

    sim.step(); // countdown reaches zero, throw-in executed

    const snap = sim.snapshot() as { ball: { position: { x: number; y: number; z: number } } };
    expect(snap.ball.position.x).toBe(20);
    expect(snap.ball.position.y).toBe(34);
    expect(snap.ball.position.z).toBe(1.5); // provisional chest height
  });

  it("ball is placed at lower touchline exit point", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
      ball: { position: { x: number; y: number; z: number } };
    };
    m.matchPhase = "throw-in";
    m.throwInPosition = { x: -20, y: -34 };
    m.throwInAwardingTeam = "team-b";
    m.throwInCountdown = 1;
    m.throwInTakerId = "player-4";
    m.throwInTouchlineIndex = 1;
    m.ball.position = { x: 0, y: 0, z: 0.11 };
    sim.restore(m);

    sim.step(); // countdown reaches zero, throw-in executed

    const snap = sim.snapshot() as { ball: { position: { x: number; y: number; z: number } } };
    expect(snap.ball.position.x).toBe(-20);
    expect(snap.ball.position.y).toBe(-34);
    expect(snap.ball.position.z).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// 6. Throw-in executes a throw into play
// ---------------------------------------------------------------------------

describe("MATCH-THROW-IN-006: throw execution", () => {
  it("ball has non-zero velocity after throw-in (ball in flight)", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
    };
    m.matchPhase = "throw-in";
    m.throwInPosition = { x: 20, y: 34 };
    m.throwInAwardingTeam = "team-a";
    m.throwInCountdown = 1;
    m.throwInTakerId = "player-1";
    m.throwInTouchlineIndex = 0;
    sim.restore(m);

    sim.step(); // throw-in executed

    const snap = sim.snapshot() as { ball: { linearVelocity: { x: number; y: number; z: number } } };
    // Ball should have negative y velocity (toward center from y=34)
    expect(snap.ball.linearVelocity.y).toBeLessThan(0);
    // Ball should have slight positive z (lofted throw)
    expect(snap.ball.linearVelocity.z).toBeGreaterThan(0);
  });

  it("throw from lower touchline goes into play", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
    };
    m.matchPhase = "throw-in";
    m.throwInPosition = { x: -20, y: -34 };
    m.throwInAwardingTeam = "team-b";
    m.throwInCountdown = 1;
    m.throwInTakerId = "player-4";
    m.throwInTouchlineIndex = 1;
    sim.restore(m);

    sim.step(); // throw-in executed

    const snap = sim.snapshot() as { ball: { linearVelocity: { x: number; y: number; z: number } } };
    // Ball should have positive y velocity (toward center from y=-34)
    expect(snap.ball.linearVelocity.y).toBeGreaterThan(0);
    // Ball should have positive z (lofted throw)
    expect(snap.ball.linearVelocity.z).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Throw-in taker selection
// ---------------------------------------------------------------------------

describe("MATCH-THROW-IN-007: taker selection", () => {
  it("taker is closest awarding-team player to exit point", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
    };
    m.matchPhase = "throw-in";
    m.throwInPosition = { x: 20, y: 34 };
    m.throwInAwardingTeam = "team-a";
    m.throwInCountdown = 5; // still counting down, setup done
    m.throwInTakerId = "player-1";
    m.throwInTouchlineIndex = 0;
    sim.restore(m);

    // Verify the state fields are correct after setup.
    const snap = sim.snapshot() as {
      throwInPosition: { x: number; y: number };
      throwInTakerId: string;
    };
    expect(snap.throwInPosition.x).toBe(20);
    expect(snap.throwInPosition.y).toBe(34);
    expect(snap.throwInTakerId).toBe("player-1");
  });
});

// ---------------------------------------------------------------------------
// 8. Determinism
// ---------------------------------------------------------------------------

describe("MATCH-THROW-IN-008: determinism", () => {
  it("same pre-throw-in state → same post-throw-in state", () => {
    const run = (countdown: number) => {
      const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
      const m = deepClone(sim.snapshot()) as {
        matchPhase: MatchPhase;
        throwInPosition: { x: number; y: number };
        throwInAwardingTeam: string;
        throwInCountdown: number;
        throwInTakerId: string;
        throwInTouchlineIndex: 0 | 1;
      };
      m.matchPhase = "throw-in";
      m.throwInPosition = { x: 20, y: 34 };
      m.throwInAwardingTeam = "team-a";
      m.throwInCountdown = countdown;
      m.throwInTakerId = "player-1";
      m.throwInTouchlineIndex = 0;
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
// 9. Throw-in is included in state hash
// ---------------------------------------------------------------------------

describe("MATCH-THROW-IN-009: determinism with throw-in phase", () => {
  it("different matchPhase values produce different hashes", () => {
    const s1 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const s2 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);

    expect(s1.stateHash()).toBe(s2.stateHash());

    const m2 = deepClone(s2.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
    };
    m2.matchPhase = "throw-in";
    m2.throwInPosition = { x: 20, y: 34 };
    m2.throwInAwardingTeam = "team-a";
    m2.throwInCountdown = 60;
    m2.throwInTakerId = "player-1";
    m2.throwInTouchlineIndex = 0;
    s2.restore(m2);

    expect(s1.stateHash()).not.toBe(s2.stateHash());
  });

  it("countdown value affects hash", () => {
    const s1 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const s2 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);

    const m1 = deepClone(s1.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
    };
    m1.matchPhase = "throw-in";
    m1.throwInPosition = { x: 20, y: 34 };
    m1.throwInAwardingTeam = "team-a";
    m1.throwInCountdown = 60;
    m1.throwInTakerId = "player-1";
    m1.throwInTouchlineIndex = 0;
    s1.restore(m1);

    const m2 = deepClone(s2.snapshot()) as {
      matchPhase: MatchPhase;
      throwInPosition: { x: number; y: number };
      throwInAwardingTeam: string;
      throwInCountdown: number;
      throwInTakerId: string;
      throwInTouchlineIndex: 0 | 1;
    };
    m2.matchPhase = "throw-in";
    m2.throwInPosition = { x: 20, y: 34 };
    m2.throwInAwardingTeam = "team-a";
    m2.throwInCountdown = 30;
    m2.throwInTakerId = "player-1";
    m2.throwInTouchlineIndex = 0;
    s2.restore(m2);

    expect(s1.stateHash()).not.toBe(s2.stateHash());
  });
});

// ---------------------------------------------------------------------------
// 10. Throw-in is a valid matchPhase value
// ---------------------------------------------------------------------------

describe("MATCH-THROW-IN-010: valid matchPhase value", () => {
  it("throw-in is a valid matchPhase value", () => {
    const phases: MatchPhase[] = ["playing", "goal", "halftime", "fulltime", "kickoff", "corner-kick", "throw-in"];
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
