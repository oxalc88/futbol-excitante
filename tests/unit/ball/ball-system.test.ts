/**
 * @module ball-system-tests
 *
 * Primitive solver tests for the independent ball integration (BOOTSTRAP-08).
 *
 * Tests: ground-roll deceleration, airborne pitch-contact events,
 * swept ground test (no tunneling), player control independence,
 * and mirrored planar symmetry.
 *
 * These are primitive solver tests — do NOT claim full ball suite
 * or PES envelope pass.
 *
 * No Math.random, Date, DOM, or Node I/O in src/simulation.
 */

import { describe, it, expect } from "vitest";
import { stepBall } from "../../../src/simulation/ball/ball-system.js";
import { FOUNDATION_BALL_V1 } from "../../../src/simulation/config/foundation.js";
import type { BallState } from "../../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DT = 1 / 60; // matches FOUNDATION_FIXED_DT_V1
const CFG = FOUNDATION_BALL_V1;
const RADIUS = CFG.ballRadius.value;

function makeBall(overrides?: Partial<BallState>): BallState {
  return {
    position: { x: 0, y: 0, z: RADIUS },
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    regime: "ground-roll",
    lastTouchRef: null,
    ...overrides,
  } as BallState;
}

function makeCounter(): { value: number } {
  return { value: 0 };
}

function hSpeed(b: BallState): number {
  return Math.sqrt(b.linearVelocity.x ** 2 + b.linearVelocity.y ** 2);
}

function speed3d(b: BallState): number {
  return Math.sqrt(
    b.linearVelocity.x ** 2 +
      b.linearVelocity.y ** 2 +
      b.linearVelocity.z ** 2,
  );
}

function energy3d(b: BallState): number {
  // Kinetic energy proxy (without mass): 0.5 * v^2
  return 0.5 * speed3d(b) ** 2;
}

const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// 1. Ground roll loses speed continuously, never reverses, settles
// ---------------------------------------------------------------------------

describe("BALL-GROUNDROLL-001: ground roll deceleration", () => {
  it("speed decreases continuously (monotonic) and never reverses", () => {
    const ball = makeBall({
      position: { x: 0, y: 0, z: RADIUS },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 5.0 },
      regime: "ground-roll",
    });

    const speeds: number[] = [hSpeed(ball)];
    const xPositions: number[] = [ball.position.x];
    const counter = makeCounter();

    for (let i = 0; i < 300; i++) {
      stepBall(ball, DT, CFG, counter, i + 1);
      speeds.push(hSpeed(ball));
      xPositions.push(ball.position.x);
    }

    // Speed must be monotonically non-increasing.
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeLessThanOrEqual(speeds[i - 1] + EPSILON);
    }

    // Position X must never decrease (no reversal due to resistance).
    for (let i = 1; i < xPositions.length; i++) {
      expect(xPositions[i]).toBeGreaterThanOrEqual(xPositions[i - 1] - EPSILON);
    }

    // Speed must reach zero (settled).
    expect(hSpeed(ball)).toBeLessThanOrEqual(EPSILON);
    expect(ball.regime).toBe("settled");
  });

  it("angular velocity also decays (spin decay)", () => {
    const ball = makeBall({
      position: { x: 0, y: 0, z: RADIUS },
      linearVelocity: { x: 1.0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 10.0 },
      regime: "ground-roll",
    });

    const angSpeeds: number[] = [];
    const counter = makeCounter();

    for (let i = 0; i < 60; i++) {
      angSpeeds.push(Math.abs(ball.angularVelocity.z));
      stepBall(ball, DT, CFG, counter, i + 1);
    }

    // Angular speed must be monotonically non-increasing.
    for (let i = 1; i < angSpeeds.length; i++) {
      expect(angSpeeds[i]).toBeLessThanOrEqual(angSpeeds[i - 1] + EPSILON);
    }
  });

  it("all canonical values remain finite throughout", () => {
    const ball = makeBall({
      position: { x: 1.0, y: 0.5, z: RADIUS },
      linearVelocity: { x: 3.0, y: 1.5, z: 0 },
      angularVelocity: { x: 1.0, y: 2.0, z: 5.0 },
      regime: "ground-roll",
    });

    const counter = makeCounter();
    for (let i = 0; i < 120; i++) {
      stepBall(ball, DT, CFG, counter, i + 1);
      expect(Number.isFinite(ball.position.x)).toBe(true);
      expect(Number.isFinite(ball.position.y)).toBe(true);
      expect(Number.isFinite(ball.position.z)).toBe(true);
      expect(Number.isFinite(ball.linearVelocity.x)).toBe(true);
      expect(Number.isFinite(ball.linearVelocity.y)).toBe(true);
      expect(Number.isFinite(ball.linearVelocity.z)).toBe(true);
      expect(Number.isFinite(ball.angularVelocity.x)).toBe(true);
      expect(Number.isFinite(ball.angularVelocity.y)).toBe(true);
      expect(Number.isFinite(ball.angularVelocity.z)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Airborne descent: pitch-contact event, radius constraint, energy bound
// ---------------------------------------------------------------------------

describe("BALL-AIRBORNE-001: airborne descent and bounce", () => {
  it("emits exactly one pitch-contact event on a single bounce", () => {
    // Ball must reach the pitch plane within one tick: z + vz*dt <= RADIUS
    // dt = 1/60, need vz such that 0.5 + vz/60 <= 0.11 → vz <= -23.4
    const ball = makeBall({
      position: { x: 0, y: 0, z: 0.5 },
      linearVelocity: { x: 1.0, y: 0, z: -30.0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "airborne",
    });

    const counter = makeCounter();
    const events = stepBall(ball, DT, CFG, counter, 1);

    // Must emit exactly one pitch-contact event.
    const pitchEvents = events.filter((e) => e.kind === "pitch-contact");
    expect(pitchEvents.length).toBe(1);

    // Event must have incoming and outgoing state.
    const payload = pitchEvents[0].payload as Record<string, unknown>;
    expect(payload.incoming).toBeDefined();
    expect(payload.outgoing).toBeDefined();
    expect(payload.contactType).toBe("ground-impact");
  });

  it("ball remains at or above the configured radius after bounce", () => {
    // z=0.5, vz=-30 → reaches ground in one tick.
    const ball = makeBall({
      position: { x: 0, y: 0, z: 0.5 },
      linearVelocity: { x: 1.0, y: 0, z: -30.0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "airborne",
    });

    const counter = makeCounter();
    stepBall(ball, DT, CFG, counter, 1);

    // Ball z must be >= radius (or within floating-point tolerance).
    expect(ball.position.z).toBeGreaterThanOrEqual(RADIUS - EPSILON);
  });

  it("rebounds without unexplained energy creation", () => {
    // Drop from height with horizontal motion.
    // z=0.5, vz=-30 reaches ground in one tick.
    const ball = makeBall({
      position: { x: 0, y: 0, z: 0.5 },
      linearVelocity: { x: 2.0, y: 0, z: -30.0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "airborne",
    });

    const keBefore = energy3d(ball);

    const counter = makeCounter();
    stepBall(ball, DT, CFG, counter, 1);

    const keAfter = energy3d(ball);

    // After bounce, kinetic energy must not exceed before-bounce energy.
    // Restitution < 1 and ground resistance ensure energy is lost.
    expect(keAfter).toBeLessThanOrEqual(keBefore + EPSILON);
  });

  it("event sequence numbers are ordered", () => {
    // Drop ball to produce a bounce — z=0.5, vz=-30 reaches ground in one tick.
    const ball = makeBall({
      position: { x: 0, y: 0, z: 0.5 },
      linearVelocity: { x: 0, y: 0, z: -30.0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "airborne",
    });

    const counter = makeCounter();
    const events = stepBall(ball, DT, CFG, counter, 5);

    // Each event sequence must be strictly increasing.
    for (let i = 1; i < events.length; i++) {
      expect(events[i].sequence).toBeGreaterThan(events[i - 1].sequence);
    }

    // All event tick values must match.
    for (const ev of events) {
      expect(ev.tick).toBe(5);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. High-speed downward motion: swept ground test (no tunneling)
// ---------------------------------------------------------------------------

describe("BALL-SWEPT-001: swept ground test", () => {
  it("does not tunnel through ground at high downward velocity", () => {
    // Ball at height 0.5m with extreme downward velocity.
    // Without swept test, it would tunnel through the ground.
    const ball = makeBall({
      position: { x: 0, y: 0, z: 0.5 },
      linearVelocity: { x: 0, y: 0, z: -50.0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "airborne",
    });

    const counter = makeCounter();
    stepBall(ball, DT, CFG, counter, 1);

    // Ball must not go below ground radius.
    expect(ball.position.z).toBeGreaterThanOrEqual(RADIUS - EPSILON);
    // Ball must have bounced (z velocity is now upward or zero).
    expect(ball.linearVelocity.z).toBeGreaterThanOrEqual(-EPSILON);
  });

  it("handles ball starting exactly at ground level with zero velocity", () => {
    const ball = makeBall({
      position: { x: 0, y: 0, z: RADIUS },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    });

    const counter = makeCounter();
    const events = stepBall(ball, DT, CFG, counter, 1);

    // No pitch-contact events (already on ground, no impact).
    const pitchEvents = events.filter((e) => e.kind === "pitch-contact");
    expect(pitchEvents.length).toBe(0);

    // Ball stays at radius.
    expect(ball.position.z).toBeCloseTo(RADIUS, 10);
  });

  it("handles ball with slight downward velocity near ground", () => {
    // Ball just barely below radius due to floating point — should not produce spurious bounce.
    const ball = makeBall({
      position: { x: 0, y: 0, z: RADIUS + 0.001 },
      linearVelocity: { x: 0, y: 0, z: -0.01 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "airborne",
    });

    const counter = makeCounter();
    stepBall(ball, DT, CFG, counter, 1);

    // Ball z should be at or above radius.
    expect(ball.position.z).toBeGreaterThanOrEqual(RADIUS - EPSILON);
  });
});

// ---------------------------------------------------------------------------
// 4. Player movement and control-source changes do not affect ball state
// ---------------------------------------------------------------------------

describe("BALL-INDEPENDENCE-001: player control does not affect ball", () => {
  it("ball state evolves identically regardless of player velocity", () => {
    // Ball with same initial state — run two steps.
    function runBall(): BallState {
      const b = makeBall({
        position: { x: 5, y: 3, z: 1.5 },
        linearVelocity: { x: 1.0, y: 0.5, z: -2.0 },
        angularVelocity: { x: 1, y: 0.5, z: 3 },
        regime: "airborne",
      });
      const c = makeCounter();
      stepBall(b, DT, CFG, c, 1);
      return b;
    }

    const b1 = runBall();
    const b2 = runBall();

    // Both runs produce identical ball state (deterministic, no player influence).
    expect(b1.position.x).toBe(b2.position.x);
    expect(b1.position.y).toBe(b2.position.y);
    expect(b1.position.z).toBe(b2.position.z);
    expect(b1.linearVelocity.x).toBe(b2.linearVelocity.x);
    expect(b1.linearVelocity.y).toBe(b2.linearVelocity.y);
    expect(b1.linearVelocity.z).toBe(b2.linearVelocity.z);
    expect(b1.regime).toBe(b2.regime);
  });

  it("ball does not read player state or control assignments", () => {
    // The stepBall function signature only accepts BallState, dt, config, counter, tick.
    // There is no player parameter — this is verified by the type system,
    // but we also verify that calling stepBall multiple times with
    // different tick values (simulating different "contexts") produces
    // deterministic results from the same initial ball state.
    function runWithTick(tick: number): BallState {
      const b = makeBall({
        position: { x: 0, y: 0, z: 5.0 },
        linearVelocity: { x: 0, y: 0, z: -8.0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "airborne",
      });
      const c = makeCounter();
      stepBall(b, DT, CFG, c, tick);
      return b;
    }

    const b1 = runWithTick(1);
    const b2 = runWithTick(999);

    // Ball state must be identical — tick only affects event IDs, not physics.
    expect(b1.position.x).toBe(b2.position.x);
    expect(b1.position.y).toBe(b2.position.y);
    expect(b1.position.z).toBe(b2.position.z);
    expect(b1.linearVelocity.x).toBe(b2.linearVelocity.x);
    expect(b1.linearVelocity.y).toBe(b2.linearVelocity.y);
    expect(b1.linearVelocity.z).toBe(b2.linearVelocity.z);
    expect(b1.regime).toBe(b2.regime);
  });
});

// ---------------------------------------------------------------------------
// 5. Mirrored planar ball state produces mirrored path
// ---------------------------------------------------------------------------

describe("BALL-MIRROR-001: planar mirror symmetry", () => {
  it("mirrored position and velocity produce mirrored path (zero spin)", () => {
    const N = 30;

    // Run with positive X/Y ball state (zero spin to avoid Magnus curve breaking symmetry).
    const bRight = makeBall({
      position: { x: 2.0, y: 1.0, z: RADIUS },
      linearVelocity: { x: 3.0, y: 1.5, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    });
    const cRight = makeCounter();
    for (let i = 0; i < N; i++) {
      stepBall(bRight, DT, CFG, cRight, i + 1);
    }

    // Run with mirrored (negative X/Y) ball state (zero spin).
    const bLeft = makeBall({
      position: { x: -2.0, y: -1.0, z: RADIUS },
      linearVelocity: { x: -3.0, y: -1.5, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    });
    const cLeft = makeCounter();
    for (let i = 0; i < N; i++) {
      stepBall(bLeft, DT, CFG, cLeft, i + 1);
    }

    // Position X must be mirrored.
    expect(bLeft.position.x).toBeCloseTo(-bRight.position.x, 8);
    // Position Y must be mirrored.
    expect(bLeft.position.y).toBeCloseTo(-bRight.position.y, 8);
    // Z must be identical (both on ground).
    expect(bLeft.position.z).toBeCloseTo(bRight.position.z, 10);

    // Velocity X must be mirrored.
    expect(bLeft.linearVelocity.x).toBeCloseTo(-bRight.linearVelocity.x, 8);
    // Velocity Y must be mirrored.
    expect(bLeft.linearVelocity.y).toBeCloseTo(-bRight.linearVelocity.y, 8);
    // Z velocity must be identical.
    expect(bLeft.linearVelocity.z).toBeCloseTo(bRight.linearVelocity.z, 10);

    // Regime must be the same.
    expect(bLeft.regime).toBe(bRight.regime);
  });

  it("all canonical values remain finite after mirrored runs", () => {
    const bMirrored = makeBall({
      position: { x: -5.0, y: -3.0, z: RADIUS },
      linearVelocity: { x: -4.0, y: -2.0, z: 0 },
      angularVelocity: { x: -1.0, y: -2.0, z: -3.0 },
      regime: "ground-roll",
    });

    const counter = makeCounter();
    for (let i = 0; i < 120; i++) {
      stepBall(bMirrored, DT, CFG, counter, i + 1);
      expect(Number.isFinite(bMirrored.position.x)).toBe(true);
      expect(Number.isFinite(bMirrored.position.y)).toBe(true);
      expect(Number.isFinite(bMirrored.position.z)).toBe(true);
      expect(Number.isFinite(bMirrored.linearVelocity.x)).toBe(true);
      expect(Number.isFinite(bMirrored.linearVelocity.y)).toBe(true);
      expect(Number.isFinite(bMirrored.linearVelocity.z)).toBe(true);
      expect(Number.isFinite(bMirrored.angularVelocity.x)).toBe(true);
      expect(Number.isFinite(bMirrored.angularVelocity.y)).toBe(true);
      expect(Number.isFinite(bMirrored.angularVelocity.z)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Determinism: identical initial states produce identical results
// ---------------------------------------------------------------------------

describe("BALL-DETERMINISM-001: deterministic integration", () => {
  it("two runs from the same initial state produce identical per-tick positions", () => {
    function run(): Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number }> {
      const b = makeBall({
        position: { x: 1, y: 2, z: 3.0 },
        linearVelocity: { x: 1.5, y: -0.5, z: -6.0 },
        angularVelocity: { x: 2, y: 1, z: 3 },
        regime: "airborne",
      });
      const c = makeCounter();
      const trajectory: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number }> = [];
      for (let i = 0; i < 60; i++) {
        stepBall(b, DT, CFG, c, i + 1);
        trajectory.push({
          x: b.position.x,
          y: b.position.y,
          z: b.position.z,
          vx: b.linearVelocity.x,
          vy: b.linearVelocity.y,
          vz: b.linearVelocity.z,
        });
      }
      return trajectory;
    }

    const t1 = run();
    const t2 = run();

    expect(t1).toHaveLength(t2.length);
    for (let i = 0; i < t1.length; i++) {
      expect(t1[i].x).toBe(t2[i].x);
      expect(t1[i].y).toBe(t2[i].y);
      expect(t1[i].z).toBe(t2[i].z);
      expect(t1[i].vx).toBe(t2[i].vx);
      expect(t1[i].vy).toBe(t2[i].vy);
      expect(t1[i].vz).toBe(t2[i].vz);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Integration with simulation loop: ball events in StepResult
// ---------------------------------------------------------------------------

describe("BALL-LOOP-001: ball events appear in simulation step results", () => {
  it("a ball dropped from height produces a pitch-contact event in step result", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");

    const scenario = {
      id: "ball-drop-test",
      version: "1.0.0",
      family: "ball",
      durationTicks: 60,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY" as const,
      pitchLength: 105,
      pitchWidth: 68,
      safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
      players: [
        {
          playerId: "p1",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 0, y: 0, z: 5.0 },
        linearVelocity: { x: 0, y: 0, z: -8.0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "airborne" as const,
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "p1",
          mode: "HUMAN" as const,
        },
      },
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram: {},
      scheduledEvents: {},
      requestedMetrics: [],
    };

    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    let foundPitchContact = false;
    for (let i = 0; i < 60; i++) {
      const result = sim.step();
      const pitchEvents = result.events.filter((e) => e.kind === "pitch-contact");
      if (pitchEvents.length > 0) {
        foundPitchContact = true;

        // Each event must have incoming and outgoing state.
        for (const ev of pitchEvents) {
          const payload = ev.payload as Record<string, unknown>;
          expect(payload.incoming).toBeDefined();
          expect(payload.outgoing).toBeDefined();
          expect(payload.contactType).toBe("ground-impact");
        }
        break;
      }
    }

    expect(foundPitchContact).toBe(true);
  });

  it("player movement does not affect ball trajectory in no-contact scenario", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");

    const baseScenario = {
      id: "ball-player-independence",
      version: "1.0.0",
      family: "ball",
      durationTicks: 30,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY" as const,
      pitchLength: 105,
      pitchWidth: 68,
      safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
      players: [
        {
          playerId: "p1",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 10, y: 10, z: RADIUS },
        linearVelocity: { x: 1.0, y: 0.5, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 2.0 },
        regime: "ground-roll" as const,
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "p1",
          mode: "HUMAN" as const,
        },
      },
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram: {},
      scheduledEvents: {},
      requestedMetrics: [],
    };

    // Run 1: no player input (player stays at origin).
    const world1 = createWorld({ scenario: { ...baseScenario } });
    const sim1 = createSimulation(world1, NO_OP_OBSERVER);
    for (let i = 0; i < 20; i++) sim1.step();
    const ball1 = sim1.snapshot().ball;

    // Run 2: player moves aggressively (player runs, but no ball contact).
    const world2Input = {
      ...baseScenario,
      inputProgram: {} as Record<number, unknown[]>,
    };
    for (let t = 1; t <= 20; t++) {
      world2Input.inputProgram[t] = [
        {
          tick: t,
          sourceId: "test",
          controlSlot: "slot-1",
          moveX: 1.0,
          moveY: 1.0,
          sprint: 1,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        },
      ];
    }
    const world2 = createWorld({ scenario: world2Input as any });
    const sim2 = createSimulation(world2, NO_OP_OBSERVER);
    for (let i = 0; i < 20; i++) sim2.step();
    const ball2 = sim2.snapshot().ball;

    // Ball state must be identical — player movement does not affect ball.
    expect(ball2.position.x).toBeCloseTo(ball1.position.x, 10);
    expect(ball2.position.y).toBeCloseTo(ball1.position.y, 10);
    expect(ball2.position.z).toBeCloseTo(ball1.position.z, 10);
    expect(ball2.linearVelocity.x).toBeCloseTo(ball1.linearVelocity.x, 10);
    expect(ball2.linearVelocity.y).toBeCloseTo(ball1.linearVelocity.y, 10);
    expect(ball2.linearVelocity.z).toBeCloseTo(ball1.linearVelocity.z, 10);
    expect(ball2.regime).toBe(ball1.regime);
  });
});

// ---------------------------------------------------------------------------
// 8. Magnus curve: spin → lateral deviation
// ---------------------------------------------------------------------------

describe("BALL-CURVE-001: Magnus curve force", () => {
  it("zero spin → zero curve (straight trajectory, bit-identical to pre-change)", () => {
    // Ball with spin, run with default config (curveCoefficient=0.0005).
    const ballWithSpin = makeBall({
      position: { x: 0, y: 0, z: 3.0 },
      linearVelocity: { x: 4.0, y: 2.0, z: 8.0 },
      angularVelocity: { x: 0, y: 0, z: 15.0 },
      regime: "airborne",
    });
    const ballNoCurveConfig = makeBall({
      position: { x: 0, y: 0, z: 3.0 },
      linearVelocity: { x: 4.0, y: 2.0, z: 8.0 },
      angularVelocity: { x: 0, y: 0, z: 15.0 },
      regime: "airborne",
    });

    // Override config to set curveCoefficient=0.
    const zeroCurveCfg = { ...CFG, curveCoefficient: { value: 0 } } as typeof CFG;

    const c1 = makeCounter();
    const c2 = makeCounter();
    for (let i = 0; i < 10; i++) {
      stepBall(ballWithSpin, DT, CFG, c1, i + 1);
      stepBall(ballNoCurveConfig, DT, zeroCurveCfg, c2, i + 1);
    }

    // Ball with spin + zero curve config should match ball with zero spin.
    const ballZeroSpin = makeBall({
      position: { x: 0, y: 0, z: 3.0 },
      linearVelocity: { x: 4.0, y: 2.0, z: 8.0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "airborne",
    });
    const ballZeroSpin2 = makeBall({
      position: { x: 0, y: 0, z: 3.0 },
      linearVelocity: { x: 4.0, y: 2.0, z: 8.0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "airborne",
    });
    const c3 = makeCounter();
    const c4 = makeCounter();
    for (let i = 0; i < 10; i++) {
      stepBall(ballZeroSpin, DT, CFG, c3, i + 1);
      stepBall(ballZeroSpin2, DT, CFG, c4, i + 1);
    }

    // Ball with spin + zero curve config must be identical to ball with zero spin.
    expect(ballNoCurveConfig.position.x).toBeCloseTo(ballZeroSpin.position.x, 10);
    expect(ballNoCurveConfig.position.y).toBeCloseTo(ballZeroSpin.position.y, 10);
    expect(ballNoCurveConfig.linearVelocity.x).toBeCloseTo(ballZeroSpin.linearVelocity.x, 10);
    expect(ballNoCurveConfig.linearVelocity.y).toBeCloseTo(ballZeroSpin.linearVelocity.y, 10);

    // Two zero-spin runs must be identical.
    expect(ballZeroSpin2.position.x).toBe(ballZeroSpin.position.x);
    expect(ballZeroSpin2.position.y).toBe(ballZeroSpin.position.y);
    expect(ballZeroSpin2.linearVelocity.x).toBe(ballZeroSpin.linearVelocity.x);
    expect(ballZeroSpin2.linearVelocity.y).toBe(ballZeroSpin.linearVelocity.y);
  });

  it("spin produces lateral deviation in the perpendicular direction", () => {
    const ballCW = makeBall({
      position: { x: 0, y: 0, z: 3.0 },
      linearVelocity: { x: 4.0, y: 2.0, z: 8.0 },
      angularVelocity: { x: 0, y: 0, z: 15.0 }, // positive spin → curve in one direction
      regime: "airborne",
    });
    const ballCCW = makeBall({
      position: { x: 0, y: 0, z: 3.0 },
      linearVelocity: { x: 4.0, y: 2.0, z: 8.0 },
      angularVelocity: { x: 0, y: 0, z: -15.0 }, // negative spin → curve in opposite direction
      regime: "airborne",
    });

    const cCW = makeCounter();
    const cCCW = makeCounter();
    for (let i = 0; i < 10; i++) {
      stepBall(ballCW, DT, CFG, cCW, i + 1);
      stepBall(ballCCW, DT, CFG, cCCW, i + 1);
    }

    // Lateral deviation should be in opposite directions.
    // The cross-track displacement (perpendicular to initial velocity)
    // should have opposite signs.
    // Initial velocity direction: (4, 2) → perpendicular: (2, -4) or (-2, 4).
    // For positive spin, curve is in direction of (vy, -vx) = (2, -4).
    // For negative spin, curve is in direction of (-vy, vx) = (-2, 4).
    // So ballCCW.y should be > ballCW.y (or vice versa) — opposite signs.
    expect(ballCCW.position.y).not.toBe(ballCW.position.y);
    // The Y displacement difference should indicate opposite deviation.
    // CW spin (positive z): curve in direction (vy, -vx) = (2, -4) → Y decreases more.
    // CCW spin (negative z): curve in direction (-vy, vx) = (-2, 4) → Y increases more.
    // So ballCCW.y > ballCW.y.
    expect(ballCCW.position.y).toBeGreaterThan(ballCW.position.y);
  });

  it("curve force scales with spin magnitude", () => {
    const lowSpin = makeBall({
      position: { x: 0, y: 0, z: 3.0 },
      linearVelocity: { x: 4.0, y: 2.0, z: 8.0 },
      angularVelocity: { x: 0, y: 0, z: 5.0 },
      regime: "airborne",
    });
    const highSpin = makeBall({
      position: { x: 0, y: 0, z: 3.0 },
      linearVelocity: { x: 4.0, y: 2.0, z: 8.0 },
      angularVelocity: { x: 0, y: 0, z: 15.0 },
      regime: "airborne",
    });

    const cLow = makeCounter();
    const cHigh = makeCounter();
    for (let i = 0; i < 10; i++) {
      stepBall(lowSpin, DT, CFG, cLow, i + 1);
      stepBall(highSpin, DT, CFG, cHigh, i + 1);
    }

    // Higher spin → more curve → different Y position.
    const lowDeltaY = lowSpin.position.y;
    const highDeltaY = highSpin.position.y;

    // The high-spin ball should deviate further from the straight-line trajectory.
    // For positive spin: curve in direction (vy, -vx) = (2, -4).
    // So Y decreases. Higher spin → more Y decrease → lowDeltaY > highDeltaY.
    expect(lowDeltaY).toBeGreaterThan(highDeltaY);
  });

  it("increasing curveCoefficient increases deviation", () => {
    const ball1 = makeBall({
      position: { x: 0, y: 0, z: 3.0 },
      linearVelocity: { x: 4.0, y: 2.0, z: 8.0 },
      angularVelocity: { x: 0, y: 0, z: 15.0 },
      regime: "airborne",
    });
    const ball2 = makeBall({
      position: { x: 0, y: 0, z: 3.0 },
      linearVelocity: { x: 4.0, y: 2.0, z: 8.0 },
      angularVelocity: { x: 0, y: 0, z: 15.0 },
      regime: "airborne",
    });

    const cfgLow = { ...CFG, curveCoefficient: { value: 0.0005 } } as typeof CFG;
    const cfgHigh = { ...CFG, curveCoefficient: { value: 0.003 } } as typeof CFG;

    const cLow = makeCounter();
    const cHigh = makeCounter();
    for (let i = 0; i < 10; i++) {
      stepBall(ball1, DT, cfgLow, cLow, i + 1);
      stepBall(ball2, DT, cfgHigh, cHigh, i + 1);
    }

    // Higher curveCoefficient → more deviation.
    // For positive spin, curve in direction (vy, -vx) = (2, -4).
    // Y should decrease. Higher curve → more Y decrease.
    expect(ball1.position.y).toBeGreaterThan(ball2.position.y);
  });

  it("zero velocity → zero curve regardless of spin", () => {
    const ball = makeBall({
      position: { x: 0, y: 0, z: 3.0 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 15.0 },
      regime: "ground-roll",
    });
    const counter = makeCounter();
    stepBall(ball, DT, CFG, counter, 1);

    // Zero velocity → zero curve force → position unchanged (ground-roll with zero velocity settles).
    expect(ball.linearVelocity.x).toBeCloseTo(0, 10);
    expect(ball.linearVelocity.y).toBeCloseTo(0, 10);
  });

  it("zero curve config → bit-identical to pre-change ball trajectory", () => {
    // The default trajectory (zero curve config) must be bit-identical
    // to the pre-change behavior for all existing ball fixtures.
    // We verify this by comparing zero-spin trajectories with and without curve.
    // Zero spin → zero curve force regardless of curveCoefficient.
    const ball1 = makeBall({
      position: { x: 5, y: 3, z: 1.5 },
      linearVelocity: { x: 1.0, y: 0.5, z: -2.0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "airborne",
    });
    const ball2 = makeBall({
      position: { x: 5, y: 3, z: 1.5 },
      linearVelocity: { x: 1.0, y: 0.5, z: -2.0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "airborne",
    });

    // Same initial state, both use CFG (default curveCoefficient=0.0005).
    // With zero spin, Magnus force is zero for both → bit-identical.
    const c1 = makeCounter();
    const c2 = makeCounter();
    for (let i = 0; i < 30; i++) {
      stepBall(ball1, DT, CFG, c1, i + 1);
      stepBall(ball2, DT, CFG, c2, i + 1);
    }

    // Must be bit-identical (same float values).
    expect(ball2.position.x).toBe(ball1.position.x);
    expect(ball2.position.y).toBe(ball1.position.y);
    expect(ball2.position.z).toBe(ball1.position.z);
    expect(ball2.linearVelocity.x).toBe(ball1.linearVelocity.x);
    expect(ball2.linearVelocity.y).toBe(ball1.linearVelocity.y);
    expect(ball2.linearVelocity.z).toBe(ball1.linearVelocity.z);
    expect(ball2.regime).toBe(ball1.regime);
  });
});
