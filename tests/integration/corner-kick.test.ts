/**
 * @module tests/integration/corner-kick
 *
 * Integration tests for corner kick set piece (MATCH-CORNER-KICK).
 *
 * Tests:
 *  - Full flow: ball goes out over goal line → corner kick detected → kick executed → playing resumes.
 *  - Corner kick detection via simulation (ball trajectory crossing goal line outside posts).
 *  - Deterministic: same trajectory → same corner kick outcome.
 *  - Corner kick from both goal lines (right and left).
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
// Fixture — minimal 2v2 scenario for corner kick integration
// ---------------------------------------------------------------------------

function makeFixture(overrides?: Partial<ScenarioDefinition>): ScenarioDefinition {
  return {
    id: "corner-kick-integration-v1",
    version: "1.0.0",
    family: "corner-kick",
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
// 1. Ball-out-of-play triggers corner kick via simulation
// ---------------------------------------------------------------------------

describe("CORNER-KICK-INT-001: ball-out-of-play triggers corner kick", () => {
  it("ball traveling past right goal line outside posts triggers corner-kick phase", () => {
    // Set up scenario where team-b touched the ball and it goes out over the right goal line.
    // team-b defends the right goal, so if team-b touched it last, it's a corner kick for team-a.
    const scenario = makeFixture({
      players: [
        // team-a (attacks +x)
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
        // Position it just before the line so it crosses in one step.
        position: { x: 52.3, y: 40, z: 0.11 },
        linearVelocity: { x: 5, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
    });

    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // First, simulate a touch by team-b player to set lastTouchRef.
    // We'll manually set the lastTouchRef on the ball to simulate a prior touch.
    const preSnap = deepClone(sim.snapshot()) as {
      ball: { lastTouchRef: string | null };
    };
    // Create a fake touch event so resolveLastTouchTeam can find it.
    const mutable = deepClone(sim.snapshot()) as {
      events: Array<{ id: string; tick: number; sequence: number; kind: string; label: string; payload: Record<string, unknown> }>;
      ball: { lastTouchRef: string | null };
    };
    const touchEvent = {
      id: "player-ball-contact-fake-1",
      tick: 0,
      sequence: 999,
      kind: "player-ball-contact" as const,
      label: "Fake touch by team-b player",
      payload: { playerId: "player-3", teamId: "team-b" },
    };
    mutable.events.push(touchEvent);
    mutable.ball.lastTouchRef = "player-ball-contact-fake-1";
    sim.restore(mutable);

    // Step until ball crosses goal line (should trigger ball-out-of-play).
    let foundCornerKick = false;
    for (let i = 0; i < 10; i++) {
      const result = sim.step();
      const phase = sim.presentation().matchPhase;
      if (phase === "corner-kick") {
        foundCornerKick = true;
        break;
      }
    }

    expect(foundCornerKick).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Corner kick from left goal line
// ---------------------------------------------------------------------------

describe("CORNER-KICK-INT-002: corner kick from left goal line", () => {
  it("ball going out over left goal line with team-a touch triggers corner-kick for team-b", () => {
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
        // team-b (attacks -x)
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

    // Simulate a touch by team-a player.
    const mutable = deepClone(sim.snapshot()) as {
      events: Array<{ id: string; tick: number; sequence: number; kind: string; label: string; payload: Record<string, unknown> }>;
      ball: { lastTouchRef: string | null };
    };
    const touchEvent = {
      id: "player-ball-contact-left-1",
      tick: 0,
      sequence: 998,
      kind: "player-ball-contact" as const,
      label: "Fake touch by team-a player",
      payload: { playerId: "player-1", teamId: "team-a" },
    };
    mutable.events.push(touchEvent);
    mutable.ball.lastTouchRef = "player-ball-contact-left-1";
    sim.restore(mutable);

    let foundCornerKick = false;
    for (let i = 0; i < 10; i++) {
      const result = sim.step();
      const phase = sim.presentation().matchPhase;
      if (phase === "corner-kick") {
        foundCornerKick = true;
        break;
      }
    }

    expect(foundCornerKick).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Determinism: same trajectory → same outcome
// ---------------------------------------------------------------------------

describe("CORNER-KICK-INT-003: determinism", () => {
  it("same pre-corner state → same post-kick ball position", () => {
    const run = () => {
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
      m.cornerKickCountdown = 5;
      m.cornerKickTakerId = "player-1";
      m.cornerKickGoalIndex = 0;
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
// 4. Corner kick → ball is airborne after kick
// ---------------------------------------------------------------------------

describe("CORNER-KICK-INT-004: ball is airborne after kick", () => {
  it("ball regime is airborne after corner kick execution (next tick integration)", () => {
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
    m.cornerKickCountdown = 1;
    m.cornerKickTakerId = "player-1";
    m.cornerKickGoalIndex = 0;
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
// 5. Corner kick match timer is frozen
// ---------------------------------------------------------------------------

describe("CORNER-KICK-INT-005: match timer frozen during corner kick", () => {
  it("match timer does not decrement during corner-kick phase", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const initialTimer = (sim.snapshot() as { matchTimer: number }).matchTimer;

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
    m.cornerKickCountdown = 5;
    m.cornerKickTakerId = "player-1";
    m.cornerKickGoalIndex = 0;
    sim.restore(m);

    // Step 3 times (countdown goes from 5 to 2, still in corner-kick phase).
    for (let i = 0; i < 3; i++) { sim.step(); }

    const snap = sim.snapshot() as { matchTimer: number; matchPhase: MatchPhase };
    expect(snap.matchPhase).toBe("corner-kick");
    expect(snap.matchTimer).toBe(initialTimer); // Timer should not have changed
  });
});
