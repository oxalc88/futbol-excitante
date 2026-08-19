/**
 * @module tests/integration/goal-kick
 *
 * Integration tests for goal kick set piece (MATCH-GOAL-KICK).
 *
 * Tests:
 *  - Full flow: ball goes out over goal line with attacking-team touch → goal-kick detected → executed → playing resumes.
 *  - Goal kick detection via simulation (ball trajectory crossing goal line outside posts).
 *  - Deterministic: same trajectory → same goal kick outcome.
 *  - Goal kick from both goal lines (right and left).
 *  - No last-touch guard: null lastTouchRef → no goal kick.
 *  - Corner kick still fires when defending team last-touched (regression guard).
 *  - Goal kick does not break goal/throw-in/kickoff/halftime flows (regression guard).
 *
 * No Math.random, Date, DOM, or Node I/O in simulation-facing code.
 * Node I/O is allowed here in tests (for assertions).
 */

import { describe, it, expect } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { deepClone } from "../../src/simulation/world/clone.js";
import { NO_OP_OBSERVER } from "../../src/simulation/telemetry/observer.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { MatchPhase } from "../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Fixture — minimal 2v2 scenario for goal kick integration
// ---------------------------------------------------------------------------

function makeFixture(overrides?: Partial<ScenarioDefinition>): ScenarioDefinition {
  return {
    id: "goal-kick-integration-v1",
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
        groundPosition: { x: 30, y: 20 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0, desiredHeading: 0,
        archetypeId: "archetype-burst-v1",
      },
      {
        playerId: "player-2", teamId: "team-a",
        groundPosition: { x: 40, y: -5 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0, desiredHeading: 0,
        archetypeId: "archetype-steady-v1",
      },
      // team-b (attacks -x, defends right goal at x = +52.5)
      {
        playerId: "player-3", teamId: "team-b",
        groundPosition: { x: -10, y: 5 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI, desiredHeading: Math.PI,
        archetypeId: "archetype-steady-v1",
      },
      {
        playerId: "player-4", teamId: "team-b",
        groundPosition: { x: -20, y: -10 },
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
      "slot-2": { controlSlot: "slot-2", teamId: "team-b", controlledPlayerId: "player-3", mode: "AI_FALLBACK" },
    },
    missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
    maxConsecutiveMissing: 3,
    inputProgram: {},
    scheduledEvents: {},
    observationWindows: [{ startTick: 0, endTick: 600 }],
    requestedMetrics: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Ball-out-of-play triggers goal kick via simulation (right goal line)
// ---------------------------------------------------------------------------

describe("GOAL-KICK-INT-001: ball-out-of-play triggers goal kick (right goal line)", () => {
  it("ball traveling past right goal line outside posts with team-a touch triggers goal-kick for team-b", () => {
    const scenario = makeFixture({
      players: [
        // team-a (attacks +x, so last touch by team-a at right goal = goal kick for team-b)
        {
          playerId: "player-1", teamId: "team-a",
          groundPosition: { x: 40, y: 20 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0, desiredHeading: 0,
          archetypeId: "archetype-burst-v1",
        },
        {
          playerId: "player-2", teamId: "team-a",
          groundPosition: { x: 35, y: -5 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0, desiredHeading: 0,
          archetypeId: "archetype-steady-v1",
        },
        // team-b (defends right goal at x = +52.5)
        {
          playerId: "player-3", teamId: "team-b",
          groundPosition: { x: 45, y: 15 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI, desiredHeading: Math.PI,
          archetypeId: "archetype-steady-v1",
        },
        {
          playerId: "player-4", teamId: "team-b",
          groundPosition: { x: 30, y: -10 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI, desiredHeading: Math.PI,
          archetypeId: "archetype-steady-v1",
        },
      ],
      ball: {
        // Ball at the right goal line, outside the posts (y=40 > goalHalfWidth=3.66).
        position: { x: 52.3, y: 40, z: 0.11 },
        linearVelocity: { x: 5, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
    });

    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // Simulate a touch by team-a player (attacking team for right goal line).
    const mutable = deepClone(sim.snapshot()) as {
      events: Array<{ id: string; tick: number; sequence: number; kind: string; label: string; payload: Record<string, unknown> }>;
      ball: { lastTouchRef: string | null };
    };
    const touchEvent = {
      id: "player-ball-contact-gk-1",
      tick: 0,
      sequence: 999,
      kind: "player-ball-contact" as const,
      label: "Fake touch by team-a player",
      payload: { playerId: "player-1", teamId: "team-a" },
    };
    mutable.events.push(touchEvent);
    mutable.ball.lastTouchRef = "player-ball-contact-gk-1";
    sim.restore(mutable);

    // Step until ball crosses goal line (should trigger goal-kick).
    let foundGoalKick = false;
    for (let i = 0; i < 10; i++) {
      sim.step();
      const phase = sim.presentation().matchPhase;
      if (phase === "goal-kick") {
        foundGoalKick = true;
        break;
      }
    }

    expect(foundGoalKick).toBe(true);

    // Verify goal kick is awarded to team-b (defending team of right goal line).
    const snap = sim.snapshot() as { goalKickAwardingTeam: string; goalKickGoalIndex: 0 | 1 };
    expect(snap.goalKickAwardingTeam).toBe("team-b");
    expect(snap.goalKickGoalIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Goal kick from left goal line
// ---------------------------------------------------------------------------

describe("GOAL-KICK-INT-002: ball-out-of-play triggers goal kick (left goal line)", () => {
  it("ball going out over left goal line with team-b touch triggers goal-kick for team-a", () => {
    const scenario = makeFixture({
      players: [
        // team-a (defends left goal at x = -52.5)
        {
          playerId: "player-1", teamId: "team-a",
          groundPosition: { x: -40, y: 15 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0, desiredHeading: 0,
          archetypeId: "archetype-burst-v1",
        },
        {
          playerId: "player-2", teamId: "team-a",
          groundPosition: { x: -35, y: -10 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0, desiredHeading: 0,
          archetypeId: "archetype-steady-v1",
        },
        // team-b (attacks -x, so last touch by team-b at left goal = goal kick for team-a)
        {
          playerId: "player-3", teamId: "team-b",
          groundPosition: { x: -30, y: 20 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI, desiredHeading: Math.PI,
          archetypeId: "archetype-steady-v1",
        },
        {
          playerId: "player-4", teamId: "team-b",
          groundPosition: { x: -20, y: -5 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI, desiredHeading: Math.PI,
          archetypeId: "archetype-steady-v1",
        },
      ],
      ball: {
        // Ball just before left goal line, outside posts (y=40).
        position: { x: -52.3, y: 40, z: 0.11 },
        linearVelocity: { x: -5, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
    });

    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // Simulate a touch by team-b player (attacking team for left goal line).
    const mutable = deepClone(sim.snapshot()) as {
      events: Array<{ id: string; tick: number; sequence: number; kind: string; label: string; payload: Record<string, unknown> }>;
      ball: { lastTouchRef: string | null };
    };
    const touchEvent = {
      id: "player-ball-contact-gk-left-1",
      tick: 0,
      sequence: 998,
      kind: "player-ball-contact" as const,
      label: "Fake touch by team-b player",
      payload: { playerId: "player-3", teamId: "team-b" },
    };
    mutable.events.push(touchEvent);
    mutable.ball.lastTouchRef = "player-ball-contact-gk-left-1";
    sim.restore(mutable);

    let foundGoalKick = false;
    for (let i = 0; i < 10; i++) {
      sim.step();
      const phase = sim.presentation().matchPhase;
      if (phase === "goal-kick") {
        foundGoalKick = true;
        break;
      }
    }

    expect(foundGoalKick).toBe(true);

    const snap = sim.snapshot() as { goalKickAwardingTeam: string; goalKickGoalIndex: 0 | 1 };
    expect(snap.goalKickAwardingTeam).toBe("team-a");
    expect(snap.goalKickGoalIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Determinism: same trajectory → same outcome
// ---------------------------------------------------------------------------

describe("GOAL-KICK-INT-003: determinism", () => {
  it("same pre-goal-kick state → same post-kick ball position", () => {
    const run = () => {
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
      m.goalKickTakerId = "player-3";
      m.goalKickGoalIndex = 0;
      sim.restore(m);

      for (let i = 0; i < 6; i++) { sim.step(); }
      return sim.snapshot();
    };

    const r1 = run();
    const r2 = run();
    const s1 = r1 as { ball: { position: { x: number; y: number; z: number } } };
    const s2 = r2 as { ball: { position: { x: number; y: number; z: number } } };

    expect(s1.ball.position.x).toBe(s2.ball.position.x);
    expect(s1.ball.position.y).toBe(s2.ball.position.y);
    expect(s1.ball.position.z).toBe(s2.ball.position.z);
  });
});

// ---------------------------------------------------------------------------
// 4. Goal kick → ball is airborne after kick
// ---------------------------------------------------------------------------

describe("GOAL-KICK-INT-004: ball is airborne after kick", () => {
  it("ball regime is airborne after goal kick execution (next tick integration)", () => {
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
    m.goalKickTakerId = "player-3";
    m.goalKickGoalIndex = 0;
    sim.restore(m);

    sim.step(); // kick executed (ball at z=0.11 with lofted velocity)
    sim.step(); // ball integration integrates z upward
    sim.step(); // ball integration detects z > radius → airborne

    const snap = sim.snapshot() as { ball: { regime: string; linearVelocity: { z: number }; position: { z: number } } };
    // After kick + integration, the ball should be airborne with positive z velocity
    expect(snap.ball.regime).toBe("airborne");
    expect(snap.ball.linearVelocity.z).toBeGreaterThan(0);
    expect(snap.ball.position.z).toBeGreaterThan(0.11);
  });
});

// ---------------------------------------------------------------------------
// 5. Goal kick match timer is frozen
// ---------------------------------------------------------------------------

describe("GOAL-KICK-INT-005: match timer frozen during goal kick", () => {
  it("match timer does not decrement during goal-kick phase", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const initialTimer = (sim.snapshot() as { matchTimer: number }).matchTimer;

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
    m.goalKickTakerId = "player-3";
    m.goalKickGoalIndex = 0;
    sim.restore(m);

    // Step 3 times (countdown goes from 5 to 2, still in goal-kick phase).
    for (let i = 0; i < 3; i++) { sim.step(); }

    const snap = sim.snapshot() as { matchTimer: number; matchPhase: MatchPhase };
    expect(snap.matchPhase).toBe("goal-kick");
    expect(snap.matchTimer).toBe(initialTimer); // Timer should not have changed
  });
});

// ---------------------------------------------------------------------------
// 6. No last-touch guard: null lastTouchRef → no goal kick
// ---------------------------------------------------------------------------

describe("GOAL-KICK-INT-006: no last-touch guard", () => {
  it("ball going out with null lastTouchRef does NOT trigger goal kick", () => {
    const scenario = makeFixture({
      players: [
        {
          playerId: "player-1", teamId: "team-a",
          groundPosition: { x: 20, y: 20 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0, desiredHeading: 0,
          archetypeId: "archetype-burst-v1",
        },
        {
          playerId: "player-2", teamId: "team-a",
          groundPosition: { x: 10, y: 10 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0, desiredHeading: 0,
          archetypeId: "archetype-steady-v1",
        },
        {
          playerId: "player-3", teamId: "team-b",
          groundPosition: { x: -5, y: 15 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI, desiredHeading: Math.PI,
          archetypeId: "archetype-steady-v1",
        },
        {
          playerId: "player-4", teamId: "team-b",
          groundPosition: { x: -15, y: -5 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI, desiredHeading: Math.PI,
          archetypeId: "archetype-steady-v1",
        },
      ],
      ball: {
        position: { x: 10, y: 33.8, z: 0.11 },
        linearVelocity: { x: 0, y: 5, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
    });

    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    // Do NOT set lastTouchRef — leave it null.

    for (let i = 0; i < 10; i++) {
      sim.step();
    }

    // Phase should still be "playing" (no goal kick triggered).
    expect(sim.presentation().matchPhase).toBe("playing");
  });
});

// ---------------------------------------------------------------------------
// 7. Full flow: goal kick executed → playing resumes
// ---------------------------------------------------------------------------

describe("GOAL-KICK-INT-007: full flow goal kick → playing resumes", () => {
  it("countdown completes and phase returns to playing", () => {
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
    m.goalKickTakerId = "player-3";
    m.goalKickGoalIndex = 0;
    sim.restore(m);

    // Step through countdown.
    expect(sim.presentation().matchPhase).toBe("goal-kick");
    sim.step(); // 3 → 2
    expect(sim.presentation().matchPhase).toBe("goal-kick");
    sim.step(); // 2 → 1
    expect(sim.presentation().matchPhase).toBe("goal-kick");
    sim.step(); // 1 → 0, goal kick executed
    expect(sim.presentation().matchPhase).toBe("playing");

    // Ball should have been kicked upfield.
    const snap = sim.snapshot() as { ball: { linearVelocity: { x: number; y: number; z: number } } };
    const speed = Math.sqrt(snap.ball.linearVelocity.x ** 2 + snap.ball.linearVelocity.y ** 2);
    expect(speed).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Corner kick still fires when defending team last-touched (regression guard)
// ---------------------------------------------------------------------------

describe("GOAL-KICK-INT-008: corner kick regression", () => {
  it("ball going out over right goal line with defending-team (team-b) touch still triggers corner kick", () => {
    const scenario = makeFixture({
      players: [
        {
          playerId: "player-1", teamId: "team-a",
          groundPosition: { x: 40, y: 20 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0, desiredHeading: 0,
          archetypeId: "archetype-burst-v1",
        },
        {
          playerId: "player-2", teamId: "team-a",
          groundPosition: { x: 35, y: -5 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0, desiredHeading: 0,
          archetypeId: "archetype-steady-v1",
        },
        {
          playerId: "player-3", teamId: "team-b",
          groundPosition: { x: 45, y: 15 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI, desiredHeading: Math.PI,
          archetypeId: "archetype-steady-v1",
        },
        {
          playerId: "player-4", teamId: "team-b",
          groundPosition: { x: 30, y: -10 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI, desiredHeading: Math.PI,
          archetypeId: "archetype-steady-v1",
        },
      ],
      ball: {
        position: { x: 52.3, y: 40, z: 0.11 },
        linearVelocity: { x: 5, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
    });

    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // Simulate a touch by team-b player (defending team of right goal).
    const mutable = deepClone(sim.snapshot()) as {
      events: Array<{ id: string; tick: number; sequence: number; kind: string; label: string; payload: Record<string, unknown> }>;
      ball: { lastTouchRef: string | null };
    };
    const touchEvent = {
      id: "player-ball-contact-ck-regression-1",
      tick: 0,
      sequence: 997,
      kind: "player-ball-contact" as const,
      label: "Fake touch by team-b player (defending)",
      payload: { playerId: "player-3", teamId: "team-b" },
    };
    mutable.events.push(touchEvent);
    mutable.ball.lastTouchRef = "player-ball-contact-ck-regression-1";
    sim.restore(mutable);

    let foundCornerKick = false;
    let foundGoalKick = false;
    for (let i = 0; i < 10; i++) {
      sim.step();
      const phase = sim.presentation().matchPhase;
      if (phase === "corner-kick") foundCornerKick = true;
      if (phase === "goal-kick") foundGoalKick = true;
    }

    expect(foundCornerKick).toBe(true);
    expect(foundGoalKick).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. Goal kick does not break other phase transitions (regression guard)
// ---------------------------------------------------------------------------

describe("GOAL-KICK-INT-009: other phase flows unaffected", () => {
  it("goal phase still works after goal-kick implementation", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as { matchPhase: MatchPhase; goalResetCountdown: number };
    m.matchPhase = "goal";
    m.goalResetCountdown = 3;
    sim.restore(m);

    expect(sim.presentation().matchPhase).toBe("goal");
    for (let i = 0; i < 3; i++) { sim.step(); }
    expect(sim.presentation().matchPhase).toBe("playing");
  });

  it("halftime phase still works", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as { matchPhase: MatchPhase; matchTimer: number; currentHalf: number };
    m.matchPhase = "halftime";
    m.matchTimer = 3;
    m.currentHalf = 1;
    sim.restore(m);

    expect(sim.presentation().matchPhase).toBe("halftime");
    for (let i = 0; i < 3; i++) { sim.step(); }
    expect(sim.presentation().matchPhase).toBe("playing");
    expect((sim.snapshot() as { currentHalf: number }).currentHalf).toBe(2);
  });

  it("corner-kick phase still works", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const m = deepClone(sim.snapshot()) as {
      matchPhase: MatchPhase;
      cornerKickPosition: { x: number; y: number };
      cornerKickAttackingTeam: string;
      cornerKickCountdown: number;
      cornerKickTakerId: string;
      cornerKickGoalIndex: 0 | 1;
    };
    m.matchPhase = "corner-kick";
    m.cornerKickPosition = { x: 52.5, y: 34 };
    m.cornerKickAttackingTeam = "team-a";
    m.cornerKickCountdown = 2;
    m.cornerKickTakerId = "player-1";
    m.cornerKickGoalIndex = 0;
    sim.restore(m);

    expect(sim.presentation().matchPhase).toBe("corner-kick");
    for (let i = 0; i < 2; i++) { sim.step(); }
    expect(sim.presentation().matchPhase).toBe("playing");
  });

  it("throw-in phase still works", () => {
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

    expect(sim.presentation().matchPhase).toBe("throw-in");
    for (let i = 0; i < 2; i++) { sim.step(); }
    expect(sim.presentation().matchPhase).toBe("playing");
  });
});

// ---------------------------------------------------------------------------
// 10. Goal kick from both goal lines via direct state setup
// ---------------------------------------------------------------------------

describe("GOAL-KICK-INT-010: both goal lines via state", () => {
  it("goal kick from right goal line (index 0) distributes upfield", () => {
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
    m.goalKickTakerId = "player-3";
    m.goalKickGoalIndex = 0;
    sim.restore(m);

    sim.step(); // goal kick executed

    const snap = sim.snapshot() as { ball: { position: { x: number; y: number }; linearVelocity: { x: number } } };
    expect(snap.ball.position.x).toBe(47);
    // Ball should be kicked toward the left (negative x from x=47).
    expect(snap.ball.linearVelocity.x).toBeLessThan(0);
  });

  it("goal kick from left goal line (index 1) distributes upfield", () => {
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

    const snap = sim.snapshot() as { ball: { position: { x: number; y: number }; linearVelocity: { x: number } } };
    expect(snap.ball.position.x).toBe(-47);
    // Ball should be kicked toward the right (positive x from x=-47).
    expect(snap.ball.linearVelocity.x).toBeGreaterThan(0);
  });
});
