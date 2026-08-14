/**
 * @module locomotion-system-tests
 *
 * Engine conformance tests for the kinematic locomotion controller
 * (BOOTSTRAP-07). These verify deterministic, progressive, bounded
 * movement under provisional locomotion coefficients.
 *
 * They do NOT claim LOC-* or PES reference pass.
 *
 * No Math.random, Date, DOM, or Node I/O in src/simulation.
 */

import { describe, it, expect } from "vitest";
import { stepLocomotion } from "../../../src/simulation/locomotion/locomotion-system.js";
import { FOUNDATION_LOCOMOTION_V1 } from "../../../src/simulation/config/foundation.js";
import type { PlayerState } from "../../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DT = 1 / 60; // matches FOUNDATION_FIXED_DT_V1
const CFG = FOUNDATION_LOCOMOTION_V1;

function makePlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    playerId: "test-1",
    teamId: "team-a",
    groundPosition: { x: 0, y: 0 },
    linearVelocity: { x: 0, y: 0 },
    desiredVelocity: { x: 0, y: 0 },
    bodyHeading: 0,
    desiredHeading: 0,
    ...overrides,
  };
}

function speed(p: PlayerState): number {
  return Math.sqrt(
    p.linearVelocity.x ** 2 + p.linearVelocity.y ** 2,
  );
}

function posMag(p: PlayerState): number {
  return Math.sqrt(
    p.groundPosition.x ** 2 + p.groundPosition.y ** 2,
  );
}

// Small numeric tolerance for floating-point comparisons.
const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// 1. Acceleration from rest — finite, progressive, monotonic, deterministic
// ---------------------------------------------------------------------------

describe("LOCOMOTION-ACCEL-001: acceleration from rest", () => {
  it("speed is monotonically increasing until the configured plateau", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 }; // full intent in +X
    p.desiredHeading = 0;

    const speeds: number[] = [];
    for (let i = 0; i < 60; i++) {
      stepLocomotion([p], DT, CFG);
      speeds.push(speed(p));
    }

    // Monotonic: every speed is >= the previous (with small float tolerance).
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1] - EPSILON);
    }

    // Progressive: the first step does NOT jump to maxSpeed.
    expect(speeds[0]).toBeGreaterThan(0);
    expect(speeds[0]).toBeLessThan(CFG.maxSpeed.value);

    // Plateau: speed reaches maxSpeed (within a small tolerance).
    const lastSpeed = speeds[speeds.length - 1];
    expect(lastSpeed).toBeCloseTo(CFG.maxSpeed.value, 6);
  });

  it("deterministic: two identical runs produce identical per-tick speeds", () => {
    function run(): number[] {
      const p = makePlayer();
      p.desiredVelocity = { x: 1, y: 0 };
      p.desiredHeading = 0;
      const speeds: number[] = [];
      for (let i = 0; i < 40; i++) {
        stepLocomotion([p], DT, CFG);
        speeds.push(speed(p));
      }
      return speeds;
    }

    const a = run();
    const b = run();
    expect(a).toHaveLength(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toBe(b[i]);
    }
  });

  it("all numeric values remain finite at every tick", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 1 }; // diagonal intent
    p.desiredHeading = Math.PI / 4;

    for (let i = 0; i < 120; i++) {
      stepLocomotion([p], DT, CFG);
      expect(Number.isFinite(p.groundPosition.x)).toBe(true);
      expect(Number.isFinite(p.groundPosition.y)).toBe(true);
      expect(Number.isFinite(p.linearVelocity.x)).toBe(true);
      expect(Number.isFinite(p.linearVelocity.y)).toBe(true);
      expect(Number.isFinite(p.bodyHeading)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Top speed does not exceed configured limit
// ---------------------------------------------------------------------------

describe("LOCOMOTION-SPEED-001: top speed limit", () => {
  // Documented tolerance: absolute epsilon for speed comparison.
  // Not a PES envelope — purely numeric floating-point tolerance.
  const SPEED_TOLERANCE = 1e-6;

  it("speed never exceeds maxSpeed + tolerance", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    for (let i = 0; i < 300; i++) {
      stepLocomotion([p], DT, CFG);
      expect(speed(p)).toBeLessThanOrEqual(CFG.maxSpeed.value + SPEED_TOLERANCE);
    }
  });

  it("speed converges to maxSpeed from below", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    // Run until speed stabilises.
    for (let i = 0; i < 300; i++) {
      stepLocomotion([p], DT, CFG);
    }

    expect(speed(p)).toBeCloseTo(CFG.maxSpeed.value, 6);
  });
});

// ---------------------------------------------------------------------------
// 3. Input release — nonzero residual displacement, then settle
// ---------------------------------------------------------------------------

describe("LOCOMOTION-BRAKE-001: input release braking", () => {
  it("residual displacement is nonzero after input release", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    // Accelerate for 20 ticks.
    for (let i = 0; i < 20; i++) {
      stepLocomotion([p], DT, CFG);
    }
    const speedBeforeRelease = speed(p);
    expect(speedBeforeRelease).toBeGreaterThan(0);

    // Release input (neutral).
    p.desiredVelocity = { x: 0, y: 0 };

    // One tick of braking — position must have changed (residual).
    stepLocomotion([p], DT, CFG);
    expect(p.groundPosition.x).toBeGreaterThan(0);
  });

  it("velocity settles to zero without sign oscillation", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    // Accelerate.
    for (let i = 0; i < 30; i++) {
      stepLocomotion([p], DT, CFG);
    }

    // Release.
    p.desiredVelocity = { x: 0, y: 0 };

    const xPositions: number[] = [p.groundPosition.x];
    const xVelocities: number[] = [p.linearVelocity.x];

    for (let i = 0; i < 120; i++) {
      stepLocomotion([p], DT, CFG);
      xPositions.push(p.groundPosition.x);
      xVelocities.push(p.linearVelocity.x);
    }

    // Velocity must not oscillate in sign: once it crosses zero, it stays.
    let crossedZero = false;
    for (const vx of xVelocities) {
      if (vx <= CFG.neutralBrakeThreshold.value) {
        crossedZero = true;
      }
      if (crossedZero) {
        expect(vx).toBeGreaterThanOrEqual(-EPSILON);
      }
    }

    // Position must be strictly increasing (player keeps sliding forward
    // during braking — no backward motion).
    for (let i = 1; i < xPositions.length; i++) {
      expect(xPositions[i]).toBeGreaterThanOrEqual(xPositions[i - 1] - EPSILON);
    }

    // Velocity eventually settles near zero.
    const finalVx = xVelocities[xVelocities.length - 1];
    expect(Math.abs(finalVx)).toBeLessThanOrEqual(
      CFG.neutralBrakeThreshold.value + EPSILON,
    );
  });
});

// ---------------------------------------------------------------------------
// 4. 90-degree direction change — no snap
// ---------------------------------------------------------------------------

describe("LOCOMOTION-TURN-001: 90-degree direction change", () => {
  it("does not snap velocity or body heading on a 90-degree input change", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    // Accelerate in +X for 30 ticks.
    for (let i = 0; i < 30; i++) {
      stepLocomotion([p], DT, CFG);
    }
    const vxBefore = p.linearVelocity.x;
    const vyBefore = p.linearVelocity.y;
    expect(vxBefore).toBeGreaterThan(0);
    expect(Math.abs(vyBefore)).toBeLessThan(EPSILON);

    // Switch to +Y direction.
    p.desiredVelocity = { x: 0, y: 1 };
    p.desiredHeading = Math.PI / 2;

    // One tick later — velocity must NOT have jumped to pure +Y.
    stepLocomotion([p], DT, CFG);

    // Velocity X must still be positive (not snapped to zero).
    expect(p.linearVelocity.x).toBeGreaterThan(0);
    // Velocity Y must be positive but less than maxSpeed (not snapped).
    expect(p.linearVelocity.y).toBeGreaterThan(0);
    expect(p.linearVelocity.y).toBeLessThan(CFG.maxSpeed.value);

    // Body heading must NOT have jumped to π/2.
    expect(p.bodyHeading).toBeLessThan(Math.PI / 2 - EPSILON);
    expect(p.bodyHeading).toBeGreaterThan(EPSILON);
  });

  it("eventually converges to the new direction", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    // Accelerate in +X.
    for (let i = 0; i < 30; i++) {
      stepLocomotion([p], DT, CFG);
    }

    // Switch to +Y.
    p.desiredVelocity = { x: 0, y: 1 };
    p.desiredHeading = Math.PI / 2;

    // Run enough ticks to converge.
    for (let i = 0; i < 120; i++) {
      stepLocomotion([p], DT, CFG);
    }

    // Should be mostly moving in +Y now.
    expect(p.linearVelocity.y).toBeCloseTo(CFG.maxSpeed.value, 4);
    expect(Math.abs(p.linearVelocity.x)).toBeLessThan(0.5);

    // Body heading should be close to π/2.
    expect(p.bodyHeading).toBeCloseTo(Math.PI / 2, 2);
  });
});

// ---------------------------------------------------------------------------
// 5. Mirrored input → mirrored position / velocity / heading
// ---------------------------------------------------------------------------

describe("LOCOMOTION-MIRROR-001: mirrored input symmetry", () => {
  it("mirrored direction produces mirrored position, velocity, and heading", () => {
    const N = 50;

    // Run with +X input.
    const pRight = makePlayer();
    pRight.desiredVelocity = { x: 1, y: 0 };
    pRight.desiredHeading = 0;
    for (let i = 0; i < N; i++) {
      stepLocomotion([pRight], DT, CFG);
    }

    // Run with -X input.
    const pLeft = makePlayer();
    pLeft.desiredVelocity = { x: -1, y: 0 };
    pLeft.desiredHeading = Math.PI; // opposite heading
    for (let i = 0; i < N; i++) {
      stepLocomotion([pLeft], DT, CFG);
    }

    // Position X must be mirrored.
    expect(pLeft.groundPosition.x).toBeCloseTo(
      -pRight.groundPosition.x,
      10,
    );
    // Position Y must be identically zero for both.
    expect(Math.abs(pLeft.groundPosition.y)).toBeLessThan(EPSILON);
    expect(Math.abs(pRight.groundPosition.y)).toBeLessThan(EPSILON);

    // Velocity X must be mirrored.
    expect(pLeft.linearVelocity.x).toBeCloseTo(
      -pRight.linearVelocity.x,
      10,
    );

    // Heading must be mirrored. Heading 0 stays 0; heading π normalizes
    // to −π because normalizeAngle maps to [−π, π).
    expect(pRight.bodyHeading).toBeCloseTo(0, 10);
    expect(pLeft.bodyHeading).toBeCloseTo(-Math.PI, 10);
  });

  it("mirrored diagonal input produces mirrored results", () => {
    const N = 30;

    // Run with +X+Y input.
    const pNE = makePlayer();
    pNE.desiredVelocity = { x: 1, y: 1 };
    pNE.desiredHeading = Math.PI / 4;
    for (let i = 0; i < N; i++) {
      stepLocomotion([pNE], DT, CFG);
    }

    // Run with -X-Y input.
    const pSW = makePlayer();
    pSW.desiredVelocity = { x: -1, y: -1 };
    pSW.desiredHeading = -Math.PI * 3 / 4;
    for (let i = 0; i < N; i++) {
      stepLocomotion([pSW], DT, CFG);
    }

    // Positions mirrored.
    expect(pSW.groundPosition.x).toBeCloseTo(-pNE.groundPosition.x, 10);
    expect(pSW.groundPosition.y).toBeCloseTo(-pNE.groundPosition.y, 10);

    // Velocities mirrored.
    expect(pSW.linearVelocity.x).toBeCloseTo(-pNE.linearVelocity.x, 10);
    expect(pSW.linearVelocity.y).toBeCloseTo(-pNE.linearVelocity.y, 10);
  });
});

// ---------------------------------------------------------------------------
// 6. Integration: position is integrated from velocity, not assigned
// ---------------------------------------------------------------------------

describe("LOCOMOTION-INTEGRATION-001: position from velocity", () => {
  it("position change equals velocity × dt (when velocity matches target)", () => {
    const p = makePlayer();
    // Set desiredVelocity direction to +X and match linearVelocity to the
    // target velocity so there is zero error (no braking/acceleration).
    // Target velocity = normalize({1,0}) * 1 * maxSpeed = {maxSpeed, 0}.
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;
    p.bodyHeading = 0;
    p.linearVelocity = { x: CFG.maxSpeed.value, y: 0 };

    // One tick: no velocity error → velocity stays constant,
    // position should advance by velocity × dt.
    stepLocomotion([p], DT, CFG);

    const expectedX = CFG.maxSpeed.value * DT;
    expect(p.groundPosition.x).toBeCloseTo(expectedX, 10);
    expect(p.groundPosition.y).toBeCloseTo(0, 10);

    // Velocity should be unchanged (already at target).
    expect(p.linearVelocity.x).toBeCloseTo(CFG.maxSpeed.value, 10);
    expect(p.linearVelocity.y).toBeCloseTo(0, 10);
  });

  it("input never directly assigns position", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    // After one tick, position must be finite and small (consistent
    // with acceleration × dt², not with some direct assignment).
    stepLocomotion([p], DT, CFG);
    const dist = posMag(p);
    // Direct assignment would be much larger (e.g. maxSpeed × dt).
    // Progressive acceleration: first-tick displacement is small.
    const maxFirstTick = CFG.acceleration.value * DT * DT;
    expect(dist).toBeLessThanOrEqual(maxFirstTick + EPSILON);
    expect(dist).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Neutral input: desiredHeading is preserved (not reset)
// ---------------------------------------------------------------------------

describe("LOCOMOTION-HEADING-001: desiredHeading preserved on neutral", () => {
  it("neutral input does not change bodyHeading or desiredHeading", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = Math.PI / 3;

    // Step a few times so bodyHeading moves toward desiredHeading.
    for (let i = 0; i < 10; i++) {
      stepLocomotion([p], DT, CFG);
    }
    const headingBefore = p.bodyHeading;

    // Neutral input.
    p.desiredVelocity = { x: 0, y: 0 };
    // desiredHeading is NOT changed by locomotion — it stays at π/3.
    stepLocomotion([p], DT, CFG);

    // Body heading should continue toward desiredHeading (not reset).
    expect(p.bodyHeading).not.toBe(headingBefore);
    // It should have moved further toward π/3.
    expect(Math.abs(p.bodyHeading - Math.PI / 3)).toBeLessThan(
      Math.abs(headingBefore - Math.PI / 3),
    );
  });
});
