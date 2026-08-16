/**
 * @module tests/unit/scenario/match-set-piece
 *
 * Unit tests for match restart logic (MATCH-SET-PIECE).
 *
 * Tests:
 *  - Initial world state has matchPhase = "playing" and goalResetCountdown = 0.
 *  - goalResetCountdown is configurable via createSimulation.
 *  - Presentation includes matchPhase.
 *  - Deterministic: same initial state → same hash (matchPhase included).
 *  - Presentation matchPhase reflects current simulation state.
 *  - Custom goal reset ticks config is respected.
 *  - Goal countdown decrements and triggers reset at zero.
 *  - Positions reset correctly (ball, player velocities).
 *  - Phase transitions (playing → goal → countdown → playing, etc.).
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation, type GoalResetConfig } from "../../../src/simulation/loop/simulation.js";
import { deepClone } from "../../../src/simulation/world/clone.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";
import { hashFnv1a64 } from "../../../src/simulation/determinism/index.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { MatchPhase } from "../../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeFixture(): ScenarioDefinition {
  return {
    id: "match-set-piece-test-v1",
    version: "1.0.0",
    family: "match-set-piece",
    durationTicks: 120,
    seed: 42,
    prngAlgorithmId: "mulberry32-v1",
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    configVersion: "foundation-config-v1",
    profile: "LABORATORY",
    pitchLength: 105,
    pitchWidth: 68,
    safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
    players: [
      {
        playerId: "player-1", teamId: "team-a",
        groundPosition: { x: 0, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0, desiredHeading: 0,
        archetypeId: "archetype-burst-v1",
      },
      {
        playerId: "player-2", teamId: "team-b",
        groundPosition: { x: 40, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI, desiredHeading: Math.PI,
        archetypeId: "archetype-steady-v1",
      },
    ],
    ball: {
      position: { x: 20, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    controlAssignments: {
      "slot-1": { controlSlot: "slot-1", teamId: "team-a", controlledPlayerId: "player-1", mode: "AI_FALLBACK" },
      "slot-2": { controlSlot: "slot-2", teamId: "team-b", controlledPlayerId: "player-2", mode: "AI_FALLBACK" },
    },
    missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
    maxConsecutiveMissing: 3,
    inputProgram: {},
    scheduledEvents: {},
    observationWindows: [{ startTick: 0, endTick: 120 }],
    requestedMetrics: [],
  };
}

// ---------------------------------------------------------------------------
// 1. Initial state
// ---------------------------------------------------------------------------

describe("MATCH-SET-PIECE-001: initial state", () => {
  let sim: ReturnType<typeof createSimulation>;

  beforeEach(() => {
    const world = createWorld({ scenario: makeFixture() });
    sim = createSimulation(world, NO_OP_OBSERVER);
  });

  it("initial matchPhase is 'playing'", () => {
    expect(sim.presentation().matchPhase).toBe("playing");
  });

  it("initial goalResetCountdown is 0", () => {
    const snap = sim.snapshot() as { goalResetCountdown: number };
    expect(snap.goalResetCountdown).toBe(0);
  });

  it("initial state has both fields in world", () => {
    const world = createWorld({ scenario: makeFixture() });
    const snap = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER).snapshot();
    expect((snap as { matchPhase: string }).matchPhase).toBe("playing");
    expect((snap as { goalResetCountdown: number }).goalResetCountdown).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Custom goal reset countdown config
// ---------------------------------------------------------------------------

describe("MATCH-SET-PIECE-002: custom goal reset countdown config", () => {
  it("accepts custom goalResetTicks without error", () => {
    const world = createWorld({ scenario: makeFixture() });
    const config: GoalResetConfig = { goalResetTicks: 30 };
    const sim2 = createSimulation(world, NO_OP_OBSERVER, undefined, undefined, undefined, undefined, config);
    expect(sim2.tick).toBe(0);
  });

  it("default config works (no explicit goalResetTicks)", () => {
    const world = createWorld({ scenario: makeFixture() });
    const sim = createSimulation(world, NO_OP_OBSERVER);
    expect(sim.tick).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Presentation includes matchPhase
// ---------------------------------------------------------------------------

describe("MATCH-SET-PIECE-003: presentation includes matchPhase", () => {
  let sim: ReturnType<typeof createSimulation>;

  beforeEach(() => {
    const world = createWorld({ scenario: makeFixture() });
    sim = createSimulation(world, NO_OP_OBSERVER);
  });

  it("presentation matchPhase is 'playing' at start", () => {
    expect(sim.presentation().matchPhase).toBe("playing");
  });

  it("presentation matchPhase updates after phase change via restore", () => {
    const mutable = deepClone(sim.snapshot()) as { matchPhase: MatchPhase };
    mutable.matchPhase = "goal";
    sim.restore(mutable);
    expect(sim.presentation().matchPhase).toBe("goal");
  });

  it("all valid matchPhase values appear in presentation", () => {
    const phases: MatchPhase[] = ["playing", "goal", "halftime", "fulltime", "kickoff"];
    for (const phase of phases) {
      const world = createWorld({ scenario: makeFixture() });
      const sim2 = createSimulation(world, NO_OP_OBSERVER);
      const mutable = deepClone(sim2.snapshot()) as { matchPhase: MatchPhase };
      mutable.matchPhase = phase;
      sim2.restore(mutable);
      expect(sim2.presentation().matchPhase).toBe(phase);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Determinism: matchPhase is included in state hash
// ---------------------------------------------------------------------------

describe("MATCH-SET-PIECE-004: determinism with matchPhase", () => {
  it("same scenario produces same hashes (matchPhase included)", () => {
    const s1 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const s2 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    for (let i = 0; i < 10; i++) {
      s1.step(); s2.step();
      expect(s1.stateHash()).toBe(s2.stateHash());
    }
  });

  it("different matchPhase values produce different hashes", () => {
    const s1 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const s2 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);

    expect(s1.stateHash()).toBe(s2.stateHash());

    const m2 = deepClone(s2.snapshot()) as { matchPhase: MatchPhase; goalResetCountdown: number };
    m2.matchPhase = "goal";
    m2.goalResetCountdown = 60;
    s2.restore(m2);

    expect(s1.stateHash()).not.toBe(s2.stateHash());
  });

  it("countdown value affects hash", () => {
    const s1 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const s2 = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);

    const m1 = deepClone(s1.snapshot()) as { matchPhase: MatchPhase; goalResetCountdown: number };
    m1.matchPhase = "goal"; m1.goalResetCountdown = 60;
    s1.restore(m1);

    const m2 = deepClone(s2.snapshot()) as { matchPhase: MatchPhase; goalResetCountdown: number };
    m2.matchPhase = "goal"; m2.goalResetCountdown = 30;
    s2.restore(m2);

    expect(s1.stateHash()).not.toBe(s2.stateHash());
  });
});

// ---------------------------------------------------------------------------
// 5. Goal countdown decrement and reset at zero
// ---------------------------------------------------------------------------

describe("MATCH-SET-PIECE-005: goal countdown", () => {
  it("goal countdown decrements each tick", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const mutable = deepClone(sim.snapshot()) as { matchPhase: MatchPhase; goalResetCountdown: number };
    mutable.matchPhase = "goal";
    mutable.goalResetCountdown = 5;
    sim.restore(mutable);

    for (let i = 0; i < 5; i++) {
      sim.step();
      const snap = sim.snapshot() as { matchPhase: MatchPhase; goalResetCountdown: number };
      if (i < 4) {
        expect(snap.goalResetCountdown).toBeGreaterThan(0);
      }
    }
    expect(sim.presentation().matchPhase).toBe("playing");
  });

  it("custom countdown (10) resets after 10 ticks", () => {
    const world = createWorld({ scenario: makeFixture() });
    const config: GoalResetConfig = { goalResetTicks: 10 };
    const sim = createSimulation(world, NO_OP_OBSERVER, undefined, undefined, undefined, undefined, config);
    const mutable = deepClone(sim.snapshot()) as { matchPhase: MatchPhase; goalResetCountdown: number };
    mutable.matchPhase = "goal";
    mutable.goalResetCountdown = 10;
    sim.restore(mutable);
    for (let i = 0; i < 10; i++) { sim.step(); }
    expect(sim.presentation().matchPhase).toBe("playing");
  });

  it("short countdown (3 ticks)", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const mutable = deepClone(sim.snapshot()) as { matchPhase: MatchPhase; goalResetCountdown: number };
    mutable.matchPhase = "goal";
    mutable.goalResetCountdown = 3;
    sim.restore(mutable);
    for (let i = 0; i < 3; i++) { sim.step(); }
    expect(sim.presentation().matchPhase).toBe("playing");
  });
});

// ---------------------------------------------------------------------------
// 6. Positions reset correctly at countdown zero
// ---------------------------------------------------------------------------

describe("MATCH-SET-PIECE-006: positions reset on countdown zero", () => {
  it("ball position resets to initial after goal countdown", () => {
    const world = createWorld({ scenario: makeFixture() });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    const initBall = sim.presentation().ball;
    const initX = initBall.position.x;
    const initY = initBall.position.y;
    const initZ = initBall.position.z;

    const mutable = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase; goalResetCountdown: number;
      ball: { position: { x: number; y: number; z: number } };
    };
    mutable.matchPhase = "goal";
    mutable.goalResetCountdown = 2;
    mutable.ball.position = { x: 50, y: 10, z: 5 };
    sim.restore(mutable);

    expect(sim.snapshot().ball.position.x).toBe(50);

    sim.step(); // 2→1
    sim.step(); // 1→0, reset

    const final = sim.snapshot() as { ball: { position: { x: number; y: number; z: number } } };
    expect(final.ball.position.x).toBe(initX);
    expect(final.ball.position.y).toBe(initY);
    expect(final.ball.position.z).toBe(initZ);
  });

  it("player velocities reset to zero after goal countdown", () => {
    const world = createWorld({ scenario: makeFixture() });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    const mutable = deepClone(sim.snapshot()) as {
      players: Array<{ linearVelocity: { x: number; y: number }; desiredVelocity: { x: number; y: number } }>;
      matchPhase: MatchPhase; goalResetCountdown: number;
    };
    mutable.players[0].linearVelocity = { x: 5, y: 3 };
    mutable.players[0].desiredVelocity = { x: 5, y: 3 };
    mutable.matchPhase = "goal";
    mutable.goalResetCountdown = 2;
    sim.restore(mutable);

    sim.step(); sim.step();

    const final = sim.snapshot() as { players: Array<{ linearVelocity: { x: number; y: number }; desiredVelocity: { x: number; y: number } }> };
    expect(final.players[0].linearVelocity.x).toBe(0);
    expect(final.players[0].linearVelocity.y).toBe(0);
    expect(final.players[0].desiredVelocity.x).toBe(0);
    expect(final.players[0].desiredVelocity.y).toBe(0);
  });

  it("deterministic: same pre-goal state → same post-reset", () => {
    const run = (countdown: number) => {
      const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
      const p = deepClone(sim.snapshot()) as {
        ball: { position: { x: number; y: number; z: number } };
        players: Array<{ groundPosition: { x: number; y: number }; linearVelocity: { x: number; y: number }; desiredVelocity: { x: number; y: number } }>;
      };
      p.ball.position = { x: 50, y: 10, z: 5 };
      p.players[0].groundPosition = { x: 45, y: 5 };
      p.players[0].linearVelocity = { x: 3, y: 2 };
      p.players[0].desiredVelocity = { x: 3, y: 2 };
      p.players[1].groundPosition = { x: 40, y: -3 };
      p.players[1].linearVelocity = { x: -2, y: 1 };
      p.players[1].desiredVelocity = { x: -2, y: 1 };
      sim.restore(p);

      const pm = deepClone(sim.snapshot()) as { matchPhase: MatchPhase; goalResetCountdown: number };
      pm.matchPhase = "goal"; pm.goalResetCountdown = countdown;
      sim.restore(pm);

      for (let i = 0; i < countdown + 1; i++) { sim.step(); }
      return sim.snapshot();
    };

    const r1 = run(5); const r2 = run(5);
    const s1 = r1 as { ball: { position: { x: number; y: number; z: number } }; players: Array<{ groundPosition: { x: number; y: number } }> };
    const s2 = r2 as { ball: { position: { x: number; y: number; z: number } }; players: Array<{ groundPosition: { x: number; y: number } }> };

    expect(s1.ball.position.x).toBe(s2.ball.position.x);
    expect(s1.ball.position.y).toBe(s2.ball.position.y);
    expect(s1.ball.position.z).toBe(s2.ball.position.z);
    for (let i = 0; i < s1.players.length; i++) {
      expect(s1.players[i].groundPosition.x).toBe(s2.players[i].groundPosition.x);
      expect(s1.players[i].groundPosition.y).toBe(s2.players[i].groundPosition.y);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Phase transitions
// ---------------------------------------------------------------------------

describe("MATCH-SET-PIECE-007: phase transitions", () => {
  it("playing → goal via restore", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    expect(sim.presentation().matchPhase).toBe("playing");
    const m = deepClone(sim.snapshot()) as { matchPhase: MatchPhase };
    m.matchPhase = "goal";
    sim.restore(m);
    expect(sim.presentation().matchPhase).toBe("goal");
  });

  it("goal → playing after countdown reaches zero", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as { matchPhase: MatchPhase; goalResetCountdown: number };
    m.matchPhase = "goal"; m.goalResetCountdown = 3;
    sim.restore(m);

    expect(sim.presentation().matchPhase).toBe("goal");
    for (let i = 0; i < 3; i++) { sim.step(); }
    expect(sim.presentation().matchPhase).toBe("playing");
  });

  it("halftime and fulltime phases are valid", () => {
    for (const phase of ["halftime", "fulltime"] as MatchPhase[]) {
      const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
      const m = deepClone(sim.snapshot()) as { matchPhase: MatchPhase };
      m.matchPhase = phase;
      sim.restore(m);
      expect(sim.presentation().matchPhase).toBe(phase);
    }
  });

  it("kickoff phase is valid", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as { matchPhase: MatchPhase };
    m.matchPhase = "kickoff";
    sim.restore(m);
    expect(sim.presentation().matchPhase).toBe("kickoff");
  });
});