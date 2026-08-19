/**
 * @module tests/integration/throw-in
 *
 * Integration tests for throw-in set piece (MATCH-THROW-IN).
 *
 * Tests:
 *  - Full flow: ball goes out over touchline → throw-in detected → executed → playing resumes.
 *  - Throw-in detection via simulation (ball trajectory crossing touchline).
 *  - Deterministic: same trajectory → same throw-in outcome.
 *  - Throw-in from both touchlines (+y and -y).
 *  - No last-touch guard: null lastTouchRef → no throw-in phase.
 *  - Match timer frozen during throw-in phase.
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
// Fixture — minimal 2v2 scenario for throw-in integration
// ---------------------------------------------------------------------------

function makeFixture(overrides?: Partial<ScenarioDefinition>): ScenarioDefinition {
  return {
    id: "throw-in-integration-v1",
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
// 1. Ball-out-of-play triggers throw-in via simulation (upper touchline)
// ---------------------------------------------------------------------------

describe("THROW-IN-INT-001: ball-out-of-play triggers throw-in (upper touchline)", () => {
  it("ball crossing upper touchline with team-a touch triggers throw-in for team-b", () => {
    const scenario = makeFixture({
      players: [
        // team-a (defends left goal at x = -52.5)
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
        // team-b (defends right goal at x = +52.5)
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
        // Ball near upper touchline, just inside. Position it so it crosses in one step.
        position: { x: 10, y: 33.8, z: 0.11 },
        linearVelocity: { x: 0, y: 5, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
    });

    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // Set a fake touch event so resolveLastTouchTeam can find team-a as last toucher.
    const mutable = deepClone(sim.snapshot()) as {
      events: Array<{ id: string; tick: number; sequence: number; kind: string; label: string; payload: Record<string, unknown> }>;
      ball: { lastTouchRef: string | null };
    };
    const touchEvent = {
      id: "player-ball-contact-fake-upper-1",
      tick: 0,
      sequence: 999,
      kind: "player-ball-contact" as const,
      label: "Fake touch by team-a player",
      payload: { playerId: "player-1", teamId: "team-a" },
    };
    mutable.events.push(touchEvent);
    mutable.ball.lastTouchRef = "player-ball-contact-fake-upper-1";
    sim.restore(mutable);

    // Step until ball crosses touchline (should trigger throw-in).
    let foundThrowIn = false;
    for (let i = 0; i < 10; i++) {
      sim.step();
      const phase = sim.presentation().matchPhase;
      if (phase === "throw-in") {
        foundThrowIn = true;
        break;
      }
    }

    expect(foundThrowIn).toBe(true);

    // Verify throw-in is awarded to team-b (opposite of team-a who touched last).
    const snap = sim.snapshot() as { throwInAwardingTeam: string };
    expect(snap.throwInAwardingTeam).toBe("team-b");
  });
});

// ---------------------------------------------------------------------------
// 2. Throw-in from lower touchline
// ---------------------------------------------------------------------------

describe("THROW-IN-INT-002: ball-out-of-play triggers throw-in (lower touchline)", () => {
  it("ball crossing lower touchline with team-b touch triggers throw-in for team-a", () => {
    const scenario = makeFixture({
      players: [
        // team-a (attacks +x)
        {
          playerId: "player-1", teamId: "team-a",
          groundPosition: { x: 10, y: -15 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0, desiredHeading: 0,
          archetypeId: "archetype-burst-v1",
        },
        {
          playerId: "player-2", teamId: "team-a",
          groundPosition: { x: 20, y: -5 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0, desiredHeading: 0,
          archetypeId: "archetype-steady-v1",
        },
        // team-b (defends right goal at x = +52.5)
        {
          playerId: "player-3", teamId: "team-b",
          groundPosition: { x: -5, y: -20 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI, desiredHeading: Math.PI,
          archetypeId: "archetype-steady-v1",
        },
        {
          playerId: "player-4", teamId: "team-b",
          groundPosition: { x: -15, y: -10 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI, desiredHeading: Math.PI,
          archetypeId: "archetype-steady-v1",
        },
      ],
      ball: {
        // Ball near lower touchline, just inside. Position it so it crosses in one step.
        position: { x: 10, y: -33.8, z: 0.11 },
        linearVelocity: { x: 0, y: -5, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
    });

    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // Set a fake touch event for team-b.
    const mutable = deepClone(sim.snapshot()) as {
      events: Array<{ id: string; tick: number; sequence: number; kind: string; label: string; payload: Record<string, unknown> }>;
      ball: { lastTouchRef: string | null };
    };
    const touchEvent = {
      id: "player-ball-contact-fake-lower-1",
      tick: 0,
      sequence: 998,
      kind: "player-ball-contact" as const,
      label: "Fake touch by team-b player",
      payload: { playerId: "player-3", teamId: "team-b" },
    };
    mutable.events.push(touchEvent);
    mutable.ball.lastTouchRef = "player-ball-contact-fake-lower-1";
    sim.restore(mutable);

    let foundThrowIn = false;
    for (let i = 0; i < 10; i++) {
      sim.step();
      const phase = sim.presentation().matchPhase;
      if (phase === "throw-in") {
        foundThrowIn = true;
        break;
      }
    }

    expect(foundThrowIn).toBe(true);

    // Verify throw-in is awarded to team-a (opposite of team-b).
    const snap = sim.snapshot() as { throwInAwardingTeam: string };
    expect(snap.throwInAwardingTeam).toBe("team-a");
  });
});

// ---------------------------------------------------------------------------
// 3. Determinism: same trajectory → same outcome
// ---------------------------------------------------------------------------

describe("THROW-IN-INT-003: determinism", () => {
  it("same pre-throw-in state → same post-throw ball position", () => {
    const run = () => {
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
// 4. Throw-in → ball is airborne after throw
// ---------------------------------------------------------------------------

describe("THROW-IN-INT-004: ball is airborne after throw", () => {
  it("ball regime is airborne after throw-in execution (next tick integration)", () => {
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

    sim.step(); // throw-in executed (ball at z=1.5 with velocity)
    sim.step(); // ball integration integrates z upward
    sim.step(); // ball integration detects z > radius → airborne

    const snap = sim.snapshot() as { ball: { regime: string; linearVelocity: { z: number }; position: { z: number } } };
    // After throw + integration, the ball should be airborne with positive z velocity
    expect(snap.ball.regime).toBe("airborne");
    expect(snap.ball.linearVelocity.z).toBeGreaterThan(0);
    expect(snap.ball.position.z).toBeGreaterThan(1.5);
  });
});

// ---------------------------------------------------------------------------
// 5. Throw-in match timer is frozen
// ---------------------------------------------------------------------------

describe("THROW-IN-INT-005: match timer frozen during throw-in", () => {
  it("match timer does not decrement during throw-in phase", () => {
    const sim = createSimulation(createWorld({ scenario: makeFixture() }), NO_OP_OBSERVER);
    const initialTimer = (sim.snapshot() as { matchTimer: number }).matchTimer;

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

    // Step 3 times (countdown goes from 5 to 2, still in throw-in phase).
    for (let i = 0; i < 3; i++) { sim.step(); }

    const snap = sim.snapshot() as { matchTimer: number; matchPhase: MatchPhase };
    expect(snap.matchPhase).toBe("throw-in");
    expect(snap.matchTimer).toBe(initialTimer); // Timer should not have changed
  });
});

// ---------------------------------------------------------------------------
// 6. No last-touch guard: null lastTouchRef → no throw-in
// ---------------------------------------------------------------------------

describe("THROW-IN-INT-006: no last-touch guard", () => {
  it("ball going out with null lastTouchRef does NOT trigger throw-in", () => {
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

    // Phase should still be "playing" (no throw-in triggered).
    expect(sim.presentation().matchPhase).toBe("playing");
  });
});

// ---------------------------------------------------------------------------
// 7. Full flow: throw-in executed → playing resumes
// ---------------------------------------------------------------------------

describe("THROW-IN-INT-007: full flow throw-in → playing resumes", () => {
  it("countdown completes and phase returns to playing", () => {
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
    m.throwInPosition = { x: 0, y: 34 };
    m.throwInAwardingTeam = "team-b";
    m.throwInCountdown = 3;
    m.throwInTakerId = "player-3";
    m.throwInTouchlineIndex = 0;
    sim.restore(m);

    // Step through countdown.
    expect(sim.presentation().matchPhase).toBe("throw-in");
    sim.step(); // 3 → 2
    expect(sim.presentation().matchPhase).toBe("throw-in");
    sim.step(); // 2 → 1
    expect(sim.presentation().matchPhase).toBe("throw-in");
    sim.step(); // 1 → 0, throw-in executed
    expect(sim.presentation().matchPhase).toBe("playing");

    // Ball should have been thrown into play.
    const snap = sim.snapshot() as { ball: { linearVelocity: { x: number; y: number; z: number } } };
    const speed = Math.sqrt(snap.ball.linearVelocity.x ** 2 + snap.ball.linearVelocity.y ** 2);
    expect(speed).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Throw-in from both touchlines via direct state setup
// ---------------------------------------------------------------------------

describe("THROW-IN-INT-008: both touchlines via state", () => {
  it("throw-in from upper touchline (index 0) works", () => {
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
    m.throwInPosition = { x: 10, y: 34 };
    m.throwInAwardingTeam = "team-a";
    m.throwInCountdown = 1;
    m.throwInTakerId = "player-1";
    m.throwInTouchlineIndex = 0;
    sim.restore(m);

    sim.step(); // throw-in executed

    const snap = sim.snapshot() as { ball: { position: { y: number }; linearVelocity: { y: number } } };
    expect(snap.ball.position.y).toBe(34);
    // Ball should be thrown toward center (negative y from y=34)
    expect(snap.ball.linearVelocity.y).toBeLessThan(0);
  });

  it("throw-in from lower touchline (index 1) works", () => {
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
    m.throwInPosition = { x: -10, y: -34 };
    m.throwInAwardingTeam = "team-b";
    m.throwInCountdown = 1;
    m.throwInTakerId = "player-4";
    m.throwInTouchlineIndex = 1;
    sim.restore(m);

    sim.step(); // throw-in executed

    const snap = sim.snapshot() as { ball: { position: { y: number }; linearVelocity: { y: number } } };
    expect(snap.ball.position.y).toBe(-34);
    // Ball should be thrown toward center (positive y from y=-34)
    expect(snap.ball.linearVelocity.y).toBeGreaterThan(0);
  });
});
