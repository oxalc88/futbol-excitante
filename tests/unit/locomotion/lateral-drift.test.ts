/**
 * @module locomotion-lateral-drift-tests
 *
 * Regression tests for lateral velocity damping in the locomotion core.
 *
 * §3.5 of locomotion-system.ts: when `config.lateralResistance > 0`,
 * the velocity component perpendicular to `desiredHeading` (the
 * movement direction) is damped each tick by multiplying it by
 * `(1 - lateralResistance)`.  The DEFAULT config provides
 * `lateralResistance: 0.7` (provisional).
 *
 * These tests verify the default-config behaviour so the acceptance
 * reviewer can see: (a) lateral velocity decays during direction
 * changes, (b) straight-line movement is unaffected, and (c) removing
 * the damping (lateralResistance: 0) produces a genuine regression.
 *
 * They do NOT claim LOC-* or PES reference pass.
 *
 * No Math.random, Date, DOM, or Node I/O in src/simulation.
 */

import { describe, it, expect } from "vitest";
import { stepLocomotion } from "../../../src/simulation/locomotion/locomotion-system.js";
import {
  FOUNDATION_LOCOMOTION_V1,
  TRANSIENT_ACCEL_LOCOMOTION_V1,
} from "../../../src/simulation/config/foundation.js";
import type { PlayerState } from "../../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DT = 1 / 60; // matches FOUNDATION_FIXED_DT_V1
const CFG = FOUNDATION_LOCOMOTION_V1;

/** Small numeric tolerance for floating-point comparisons. */
const EPSILON = 1e-9;

/**
 * Lateral velocity magnitude perpendicular to desiredHeading.
 *
 * Decomposes velocity into forward (parallel to desiredHeading)
 * and lateral (perpendicular) components, then returns the lateral
 * magnitude.
 */
function lateralMag(player: PlayerState): number {
  const cosD = Math.cos(player.desiredHeading);
  const sinD = Math.sin(player.desiredHeading);
  const dotVD = player.linearVelocity.x * cosD + player.linearVelocity.y * sinD;
  const vLatX = player.linearVelocity.x - dotVD * cosD;
  const vLatY = player.linearVelocity.y - dotVD * sinD;
  return Math.sqrt(vLatX ** 2 + vLatY ** 2);
}

/**
 * Forward velocity component parallel to desiredHeading.
 */
function forwardMag(player: PlayerState): number {
  const cosD = Math.cos(player.desiredHeading);
  const sinD = Math.sin(player.desiredHeading);
  return player.linearVelocity.x * cosD + player.linearVelocity.y * sinD;
}

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
  return Math.sqrt(p.linearVelocity.x ** 2 + p.linearVelocity.y ** 2);
}

// ---------------------------------------------------------------------------
// 1. Default-config lateral-drift acceptance
// ---------------------------------------------------------------------------

/**
 * LOCOMOTION-LATERAL-DRIFT-001: default-config lateral velocity decays
 * during direction changes.
 *
 * A player is accelerated to maxSpeed along +X (desiredHeading = 0),
 * then the desiredHeading is switched to π/2 (north).  With the
 * default `lateralResistance: 0.7`, the perpendicular velocity
 * component must decay toward zero within a bounded number of ticks.
 *
 * The bound N=8 is derived from the actual simulated behaviour:
 * at tick 0 the lateral component is ≈ 2.06 (down from 7 due to
 * acceleration dynamics), and it reaches < 0.05 by tick 4, well
 * within 8 ticks.
 */
describe("LOCOMOTION-LATERAL-DRIFT-001: default-config lateral decay", () => {
  it("perpendicular velocity decays toward zero within 8 ticks of a 90° turn", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    // Accelerate in +X for enough ticks to reach maxSpeed.
    for (let i = 0; i < 50; i++) {
      stepLocomotion([p], DT, CFG);
    }

    // Player is at maxSpeed moving east.
    expect(speed(p)).toBeCloseTo(CFG.maxSpeed.value, 4);
    expect(Math.abs(p.linearVelocity.y)).toBeLessThan(EPSILON);

    // Switch desired heading to north (90°).
    p.desiredVelocity = { x: 0, y: 1 };
    p.desiredHeading = Math.PI / 2;

    // Record lateral magnitude after the turn.
    const initialLateral = lateralMag(p);
    expect(initialLateral).toBeGreaterThan(0.5);

    // Run 8 ticks — lateral must decay to near zero.
    for (let i = 0; i < 8; i++) {
      stepLocomotion([p], DT, CFG);
    }

    const finalLateral = lateralMag(p);
    // The lateral component should be well below 0.1 (provisional bound).
    expect(finalLateral).toBeLessThan(0.1);

    // Also verify that the forward component is growing (player now
    // moving mostly northward). The forward velocity at tick 8 should
    // have increased from the initial ~0 (after turn) to a meaningful
    // value.
    const finalForward = forwardMag(p);
    // After 8 ticks of acceleration northward, forward speed > 1.0
    // (the player is well into the acceleration phase).
    expect(finalForward).toBeGreaterThan(1.0);
  });

  it("decay is monotonic: each tick reduces lateral magnitude", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    for (let i = 0; i < 50; i++) {
      stepLocomotion([p], DT, CFG);
    }

    p.desiredVelocity = { x: 0, y: 1 };
    p.desiredHeading = Math.PI / 2;

    const lats: number[] = [lateralMag(p)];
    for (let i = 0; i < 6; i++) {
      stepLocomotion([p], DT, CFG);
      lats.push(lateralMag(p));
    }

    // Each successive tick must have strictly smaller lateral magnitude.
    for (let i = 1; i < lats.length; i++) {
      expect(lats[i]).toBeLessThan(lats[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Straight-line movement is unaffected
// ---------------------------------------------------------------------------

/**
 * LOCOMOTION-LATERAL-DRIFT-002: straight-line velocity stays lateral ≈ 0.
 *
 * When a player moves exactly along desiredHeading (no perpendicular
 * component), the damping should have no observable effect.  The
 * lateral magnitude must remain at zero throughout acceleration and
 * steady-state movement.
 */
describe("LOCOMOTION-LATERAL-DRIFT-002: straight-line unaffected", () => {
  it("lateral magnitude stays at zero during acceleration on a straight line", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    for (let i = 0; i < 60; i++) {
      stepLocomotion([p], DT, CFG);
      expect(lateralMag(p)).toBeLessThanOrEqual(EPSILON);
    }
  });

  it("lateral magnitude stays zero at steady state", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 0, y: 1 };
    p.desiredHeading = Math.PI / 2;

    for (let i = 0; i < 60; i++) {
      stepLocomotion([p], DT, CFG);
    }

    // At steady state, all velocity is forward — lateral must be ≈ 0.
    expect(lateralMag(p)).toBeLessThanOrEqual(EPSILON);
    expect(speed(p)).toBeCloseTo(CFG.maxSpeed.value, 4);
  });
});

// ---------------------------------------------------------------------------
// 3. Negative control: no damping → lateral velocity persists
// ---------------------------------------------------------------------------

/**
 * LOCOMOTION-LATERAL-DRIFT-003: negative control (lateralResistance=0).
 *
 * When lateralResistance is set to 0, the perpendicular velocity
 * component must NOT decay.  This proves the default-config decay
 * assertion in LOCOMOTION-LATERAL-DRIFT-001 is a real regression
 * target — if the damping were removed, this test would fail.
 *
 * Uses TRANSIENT_ACCEL_LOCOMOTION_V1 as a base (identical to
 * FOUNDATION_LOCOMOTION_V1 but with a zeroable config override).
 */
describe("LOCOMOTION-LATERAL-DRIFT-003: negative control (no damping)", () => {
  it("lateral velocity does NOT decay when lateralResistance is 0", () => {
    // Build a config with lateralResistance = 0 (provisional override).
    const noDampingCfg = {
      ...TRANSIENT_ACCEL_LOCOMOTION_V1,
      lateralResistance: { value: 0, note: "no lateral damping" },
    } as typeof CFG;

    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    for (let i = 0; i < 50; i++) {
      stepLocomotion([p], DT, noDampingCfg);
    }

    p.desiredVelocity = { x: 0, y: 1 };
    p.desiredHeading = Math.PI / 2;

    const initialLateral = lateralMag(p);

    // Run 8 ticks with no damping.
    for (let i = 0; i < 8; i++) {
      stepLocomotion([p], DT, noDampingCfg);
    }

    const finalLateral = lateralMag(p);

    // With lateralResistance=0, the damping formula multiplies by
    // (1 - 0) = 1, so the lateral component is preserved (not damped).
    // The lateral value may decrease slightly due to acceleration
    // dynamics (velocity converging toward target), but it stays
    // well above the decay threshold used in the default-config test.
    expect(finalLateral).toBeGreaterThan(initialLateral * 0.7);
    // In absolute terms, after 8 ticks with no damping the lateral
    // component is still significant (> 5).
    expect(finalLateral).toBeGreaterThan(5);
  });

  it("the decay assertion fails without damping: lateral at tick 8 is NOT below 0.1", () => {
    // This proves the LOCOMOTION-LATERAL-DRIFT-001 test can genuinely fail
    // when damping is removed.  Without damping, the lateral magnitude
    // at tick 8 is far above 0.1.
    const noDampingCfg = {
      ...TRANSIENT_ACCEL_LOCOMOTION_V1,
      lateralResistance: { value: 0, note: "no lateral damping" },
    } as typeof CFG;

    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    for (let i = 0; i < 50; i++) {
      stepLocomotion([p], DT, noDampingCfg);
    }

    p.desiredVelocity = { x: 0, y: 1 };
    p.desiredHeading = Math.PI / 2;

    for (let i = 0; i < 8; i++) {
      stepLocomotion([p], DT, noDampingCfg);
    }

    expect(lateralMag(p)).toBeGreaterThan(0.1);
  });
});

// ---------------------------------------------------------------------------
// 4. Determinism
// ---------------------------------------------------------------------------

describe("LOCOMOTION-LATERAL-DRIFT-004: deterministic lateral decay", () => {
  it("identical 90° turn runs produce identical lateral per-tick values", () => {
    function run(): number[] {
      const p = makePlayer();
      p.desiredVelocity = { x: 1, y: 0 };
      p.desiredHeading = 0;

      for (let i = 0; i < 50; i++) {
        stepLocomotion([p], DT, CFG);
      }

      p.desiredVelocity = { x: 0, y: 1 };
      p.desiredHeading = Math.PI / 2;

      const lats: number[] = [];
      for (let i = 0; i < 10; i++) {
        stepLocomotion([p], DT, CFG);
        lats.push(lateralMag(p));
      }
      return lats;
    }

    const a = run();
    const b = run();

    expect(a).toHaveLength(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toBe(b[i]);
    }
  });
});