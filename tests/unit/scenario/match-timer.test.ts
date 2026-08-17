/**
 * @module tests/unit/scenario/match-timer
 *
 * Unit tests for auto-enforcing match timer (MATCH-TIMER-ENFORCEMENT).
 *
 * Tests:
 *  - Initial world state has matchTimer and currentHalf.
 *  - matchTimer decrements each tick during "playing".
 *  - Phase transitions: playing → halftime, halftime → playing (second half),
 *    playing → fulltime.
 *  - Halftime countdown and reset.
 *  - No timer movement during "goal" phase.
 *  - Presentation includes matchTimer.
 *  - Determinism: same seed → same timer and phases.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { deepClone } from "../../../src/simulation/world/clone.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";
import { hashFnv1a64 } from "../../../src/simulation/determinism/index.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { MatchPhase } from "../../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal scenario with a configurable match duration.
 * Duration is kept small for fast unit tests.
 */
function makeMatchTimerFixture(
  matchDurationTicks: number = 30,
  seed: number = 42,
): ScenarioDefinition {
  return {
    id: `match-timer-${matchDurationTicks}-v1`,
    version: "1.0.0",
    family: "match-timer",
    durationTicks: matchDurationTicks * 2 + 100,
    seed,
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
      position: { x: 0, y: 0, z: 0.11 },
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
    observationWindows: [{ startTick: 0, endTick: matchDurationTicks * 2 + 100 }],
    requestedMetrics: [],
    matchDurationTicks,
  };
}

// ---------------------------------------------------------------------------
// 1. Initial state
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-001: initial state", () => {
  let sim: ReturnType<typeof createSimulation>;

  beforeEach(() => {
    const world = createWorld({ scenario: makeMatchTimerFixture(30) });
    sim = createSimulation(world, NO_OP_OBSERVER);
  });

  it("initial matchTimer equals matchDurationTicks", () => {
    const snap = sim.snapshot() as { matchTimer: number };
    expect(snap.matchTimer).toBe(30);
  });

  it("initial currentHalf is 1", () => {
    const snap = sim.snapshot() as { currentHalf: number };
    expect(snap.currentHalf).toBe(1);
  });

  it("initial matchPhase is playing", () => {
    expect(sim.presentation().matchPhase).toBe("playing");
  });

  it("presentation includes matchTimer", () => {
    const pres = sim.presentation();
    expect(pres.matchTimer).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// 2. Custom match duration
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-002: custom match duration", () => {
  it("uses custom matchDurationTicks from scenario", () => {
    const world = createWorld({ scenario: makeMatchTimerFixture(20) });
    const sim = createSimulation(world, NO_OP_OBSERVER);
    const snap = sim.snapshot() as { matchTimer: number };
    expect(snap.matchTimer).toBe(20);
  });

  it("omitted matchDurationTicks defaults to 5400", () => {
    const scenario = makeMatchTimerFixture(30);
    delete (scenario as Record<string, unknown>).matchDurationTicks;
    const world = createWorld({ scenario });
    const snap = createSimulation(world, NO_OP_OBSERVER).snapshot();
    expect((snap as { matchTimer: number }).matchTimer).toBe(5400);
  });
});

// ---------------------------------------------------------------------------
// 3. Timer decrements each tick
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-003: timer decrements each tick", () => {
  let scenario: ScenarioDefinition;

  beforeEach(() => {
    scenario = makeMatchTimerFixture(10);
  });

  it("matchTimer decrements by 1 each tick", () => {
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);
    const initial = sim.snapshot() as { matchTimer: number };
    expect(initial.matchTimer).toBe(10);

    sim.step();
    const snap1 = sim.snapshot() as { matchTimer: number };
    expect(snap1.matchTimer).toBe(9);

    sim.step();
    const snap2 = sim.snapshot() as { matchTimer: number };
    expect(snap2.matchTimer).toBe(8);
  });

  it("presentation matchTimer also decrements", () => {
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);
    expect(sim.presentation().matchTimer).toBe(10);

    for (let i = 0; i < 5; i++) {
      sim.step();
    }
    expect(sim.presentation().matchTimer).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 4. First half → halftime transition
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-004: first half ends → halftime", () => {
  it("phase transitions to halftime when matchTimer reaches zero", () => {
    const scenario = makeMatchTimerFixture(5);
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Step until matchTimer reaches 0.
    // At tick 5, matchTimer goes from 1→0, phase → halftime,
    // and matchTimer is set to the halftime countdown (60).
    for (let i = 0; i < 5; i++) {
      sim.step();
    }
    expect(sim.presentation().matchPhase).toBe("halftime");
    // matchTimer is set to the halftime countdown value when entering halftime.
    const snap = sim.snapshot() as { matchTimer: number };
    expect(snap.matchTimer).toBe(60);
  });

  it("currentHalf is still 1 at halftime", () => {
    const scenario = makeMatchTimerFixture(5);
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    for (let i = 0; i < 5; i++) {
      sim.step();
    }
    const snap = sim.snapshot() as { currentHalf: number };
    expect(snap.currentHalf).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Halftime countdown → second half
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-005: halftime countdown and restart", () => {
  it("after halftime countdown, phase returns to playing with currentHalf=2", () => {
    const scenario = makeMatchTimerFixture(5);
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Reach halftime (5 ticks).
    for (let i = 0; i < 5; i++) {
      sim.step();
    }
    expect(sim.presentation().matchPhase).toBe("halftime");
    expect((sim.snapshot() as { currentHalf: number }).currentHalf).toBe(1);

    // Halftime countdown is 60 ticks by default.
    // Step through halftime countdown.
    for (let i = 0; i < 60; i++) {
      sim.step();
    }

    // Should now be in playing phase, second half.
    expect(sim.presentation().matchPhase).toBe("playing");
    expect((sim.snapshot() as { currentHalf: number }).currentHalf).toBe(2);
  });

  it("matchTimer resets to matchDurationTicks after halftime", () => {
    const scenario = makeMatchTimerFixture(5);
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Reach halftime.
    for (let i = 0; i < 5; i++) {
      sim.step();
    }

    // Step through halftime countdown.
    for (let i = 0; i < 60; i++) {
      sim.step();
    }

    // After entering second half, matchTimer should reset.
    expect((sim.snapshot() as { matchTimer: number }).matchTimer).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 6. Second half → fulltime transition
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-006: second half ends → fulltime", () => {
  it("phase transitions to fulltime when second half matchTimer reaches zero", () => {
    const scenario = makeMatchTimerFixture(5);
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // First half: 5 ticks.
    for (let i = 0; i < 5; i++) {
      sim.step();
    }
    expect(sim.presentation().matchPhase).toBe("halftime");

    // Halftime countdown: 60 ticks.
    for (let i = 0; i < 60; i++) {
      sim.step();
    }
    expect(sim.presentation().matchPhase).toBe("playing");
    expect((sim.snapshot() as { currentHalf: number }).currentHalf).toBe(2);

    // Second half: 5 ticks.
    for (let i = 0; i < 5; i++) {
      sim.step();
    }

    // Should now be fulltime.
    expect(sim.presentation().matchPhase).toBe("fulltime");
  });
});

// ---------------------------------------------------------------------------
// 7. No timer movement during goal phase
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-007: no timer movement during goal phase", () => {
  it("matchTimer is frozen during goal countdown (before reset)", () => {
    const scenario = makeMatchTimerFixture(10);
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    const mutable = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      goalResetCountdown: number;
      matchTimer: number;
    };
    mutable.matchPhase = "goal";
    mutable.goalResetCountdown = 3;
    mutable.matchTimer = 10;
    sim.restore(mutable);

    // Step 1: countdown 3→2, phase still "goal", matchTimer frozen at 10.
    sim.step();
    expect((sim.snapshot() as { matchTimer: number }).matchTimer).toBe(10);
    expect((sim.snapshot() as { matchPhase: MatchPhase }).matchPhase).toBe("goal");

    // Step 2: countdown 2→1, phase still "goal", matchTimer still frozen.
    sim.step();
    expect((sim.snapshot() as { matchTimer: number }).matchTimer).toBe(10);
    expect((sim.snapshot() as { matchPhase: MatchPhase }).matchPhase).toBe("goal");

    // Step 3: countdown 1→0, goal countdown resets → phase becomes "playing".
    sim.step();
    // After transition back to playing, matchTimer decrements from 10→9.
    expect((sim.snapshot() as { matchPhase: MatchPhase }).matchPhase).toBe("playing");
    expect((sim.snapshot() as { matchTimer: number }).matchTimer).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// 8. No timer movement during fulltime
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-008: no timer movement during fulltime", () => {
  it("matchTimer stays zero after fulltime", () => {
    const scenario = makeMatchTimerFixture(5);
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Run through full match.
    for (let i = 0; i < 70; i++) {
      sim.step();
    }

    // Now at or past fulltime.
    expect(sim.presentation().matchPhase).toBe("fulltime");
    const snap = sim.snapshot() as { matchTimer: number };
    expect(snap.matchTimer).toBe(0);

    // Continue stepping — matchTimer should remain 0.
    for (let i = 0; i < 10; i++) {
      sim.step();
    }
    expect((sim.snapshot() as { matchTimer: number }).matchTimer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Halftime reset positions
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-009: halftime reset positions", () => {
  it("players reset to initial positions after halftime countdown", () => {
    const scenario = makeMatchTimerFixture(5);
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Record initial positions.
    const initSnapshot = sim.snapshot() as {
      ball: { position: { x: number; y: number; z: number } };
      players: Array<{ groundPosition: { x: number; y: number } }>;
    };
    const initBallX = initSnapshot.ball.position.x;
    const initBallY = initSnapshot.ball.position.y;
    const initBallZ = initSnapshot.ball.position.z;
    const initPlayerPositions = initSnapshot.players.map(
      (p) => ({ x: p.groundPosition.x, y: p.groundPosition.y }),
    );

    // Verify initial state: all positions match scenario start.
    for (let i = 0; i < initPlayerPositions.length; i++) {
      expect(initSnapshot.players[i].groundPosition.x).toBe(initPlayerPositions[i].x);
      expect(initSnapshot.players[i].groundPosition.y).toBe(initPlayerPositions[i].y);
    }

    // Move players by applying inputs that push them around.
    const allSlots = Object.keys(scenario.controlAssignments);
    for (let i = 0; i < 10; i++) {
      const frames = allSlots.map((slot, idx) => ({
        tick: sim.tick,
        sourceId: `test`,
        controlSlot: slot,
        moveX: idx % 2 === 0 ? 0.5 : -0.5,
        moveY: idx % 3 === 0 ? 0.3 : 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      }));
      sim.applyInputs(frames);
      sim.step();
    }

    // Positions should have changed.
    const movedSnapshot = sim.snapshot() as {
      ball: { position: { x: number; y: number; z: number } };
      players: Array<{ groundPosition: { x: number; y: number } }>;
    };
    let anyMoved = false;
    for (let i = 0; i < movedSnapshot.players.length; i++) {
      if (
        movedSnapshot.players[i].groundPosition.x !== initPlayerPositions[i].x ||
        movedSnapshot.players[i].groundPosition.y !== initPlayerPositions[i].y
      ) {
        anyMoved = true;
        break;
      }
    }

    // Now reach halftime and countdown.
    for (let i = 0; i < 5; i++) {
      sim.step();
    }
    for (let i = 0; i < 60; i++) {
      sim.step();
    }

    // After halftime reset, ball should be back at initial position.
    const postResetBall = sim.snapshot() as { ball: { position: { x: number; y: number; z: number } } };
    expect(postResetBall.ball.position.x).toBe(initBallX);
    expect(postResetBall.ball.position.y).toBe(initBallY);
    expect(postResetBall.ball.position.z).toBe(initBallZ);
    // Player positions should also be reset.
    const postResetPlayers = sim.snapshot() as { players: Array<{ groundPosition: { x: number; y: number } }> };
    for (let i = 0; i < postResetPlayers.players.length; i++) {
      expect(postResetPlayers.players[i].groundPosition.x).toBe(initPlayerPositions[i].x);
      expect(postResetPlayers.players[i].groundPosition.y).toBe(initPlayerPositions[i].y);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Determinism
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-010: determinism", () => {
  it("same scenario produces same timer values", () => {
    const scenarioA = makeMatchTimerFixture(15);
    const scenarioB = makeMatchTimerFixture(15);
    const simA = createSimulation(createWorld({ scenario: scenarioA }), NO_OP_OBSERVER);
    const simB = createSimulation(createWorld({ scenario: scenarioB }), NO_OP_OBSERVER);

    const N = 100;
    for (let i = 0; i < N; i++) {
      simA.step();
      simB.step();

      const snapA = simA.snapshot() as { matchTimer: number; currentHalf: number; matchPhase: MatchPhase };
      const snapB = simB.snapshot() as { matchTimer: number; currentHalf: number; matchPhase: MatchPhase };

      expect(snapA.matchTimer).toBe(snapB.matchTimer);
      expect(snapA.currentHalf).toBe(snapB.currentHalf);
      expect(snapA.matchPhase).toBe(snapB.matchPhase);
    }
  });

  it("timer values and phases are deterministic across restores", () => {
    const scenario = makeMatchTimerFixture(15);
    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // Step to a specific point.
    for (let i = 0; i < 50; i++) {
      sim1.step();
    }
    const checkpoint = sim1.snapshot();

    const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    sim2.restore(checkpoint);

    // Continue stepping from the checkpoint.
    for (let i = 0; i < 50; i++) {
      sim1.step();
      sim2.step();

      const snap1 = sim1.snapshot() as { matchTimer: number; currentHalf: number };
      const snap2 = sim2.snapshot() as { matchTimer: number; currentHalf: number };

      expect(snap1.matchTimer).toBe(snap2.matchTimer);
      expect(snap1.currentHalf).toBe(snap2.currentHalf);
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Full match lifecycle with default 5400 ticks (spot check)
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-011: full match lifecycle", () => {
  it("default scenario (5400 ticks per half) maintains timer for first half", () => {
    const scenario = makeMatchTimerFixture(5400);
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // After 1000 ticks, matchTimer should be 4400.
    for (let i = 0; i < 1000; i++) {
      sim.step();
    }
    expect((sim.snapshot() as { matchTimer: number }).matchTimer).toBe(4400);
    expect(sim.presentation().matchPhase).toBe("playing");
    expect((sim.snapshot() as { currentHalf: number }).currentHalf).toBe(1);
  });
});