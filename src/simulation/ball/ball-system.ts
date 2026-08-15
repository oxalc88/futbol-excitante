/**
 * @module @pes/simulation/ball/ball-system
 *
 * Provisional independent ball integration.
 *
 * Applies gravity, air drag, swept pitch-plane impact within a tick,
 * bounce/restitution, ground resistance that cannot reverse velocity,
 * spin decay, and a Magnus-style curve force from ball spin.
 * Every ground impact emits an ordered pitch-contact
 * event with incoming and outgoing state references.
 *
 * No possession attachment, player contact, posts, complex rolling law,
 * or final collision policy. Curve coefficients are provisional and
 * versioned (FOUNDATION_BALL_V1.curveCoefficient).
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { BallState } from "../../contracts/state.js";
import type { SimulationEvent } from "../../contracts/scenario.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Snapshot of ball state just before a pitch contact.
 * Used as incoming/outgoing references in pitch-contact events.
 */
export interface BallStateSnapshot {
  position: { x: number; y: number; z: number };
  linearVelocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
  regime: BallState["regime"];
}

// ---------------------------------------------------------------------------
// Config defaults
// ---------------------------------------------------------------------------

/** Fallback config when none is provided (matches FOUNDATION_BALL_V1 shape). */
const DEFAULT_CONFIG = {
  gravity: { value: 9.81 },
  restitution: { value: 0.55 },
  groundResistance: { value: 0.02 },
  spinDecay: { value: 0.95 },
  ballRadius: { value: 0.11 },
  airDrag: { value: 0.001 },
  curveCoefficient: { value: 0.0005 },
} as const;

type BallConfig = {
  gravity: { value: number };
  restitution: { value: number };
  groundResistance: { value: number };
  spinDecay: { value: number };
  ballRadius: { value: number };
  airDrag: { value: number };
  curveCoefficient: { value: number };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Threshold below which horizontal speed is considered zero (ground roll). */
const GROUND_SETTLE_SPEED = 0.01;

/** Threshold below which vertical bounce velocity is absorbed. */
const BOUNCE_THRESHOLD = 0.05;

/** Maximum swept-test iterations per tick (safety limit). */
const MAX_SWEPT_ITERATIONS = 4;

/**
 * Compute horizontal speed from 3D linear velocity.
 */
function horizontalSpeed(vx: number, vy: number): number {
  return Math.sqrt(vx * vx + vy * vy);
}

/**
 * Apply ground resistance to horizontal velocity (cannot reverse).
 * Mutates vx, vy in place.
 */
function applyGroundResistance(
  vx: number,
  vy: number,
  resistanceFactor: number,
): { x: number; y: number } {
  const hSpd = horizontalSpeed(vx, vy);
  if (hSpd <= 1e-12) return { x: vx, y: vy };

  let newVx = vx * resistanceFactor;
  let newVy = vy * resistanceFactor;

  // Ensure resistance did not reverse velocity.
  if (horizontalSpeed(newVx, newVy) > hSpd) {
    return { x: 0, y: 0 };
  }
  return { x: newVx, y: newVy };
}

/**
 * Apply Magnus-style curve force to horizontal velocity.
 *
 * When the ball has nonzero vertical spin (angularVelocity.z) and
 * nonzero horizontal velocity, a lateral acceleration perpendicular
 * to the velocity is applied:
 *   a_curve = curveCoefficient × |v_h| × ω_z
 *
 * Zero spin or zero horizontal velocity → zero curve force.
 * Mutates vx, vy in place.
 */
function applyMagnusCurve(
  vx: number,
  vy: number,
  spinZ: number,
  curveCoeff: number,
): { x: number; y: number } {
  const hSpd = horizontalSpeed(vx, vy);
  if (hSpd <= 1e-12) return { x: vx, y: vy };
  if (Math.abs(spinZ) <= 1e-12) return { x: vx, y: vy };

  // Perpendicular direction to velocity in the horizontal plane.
  // Cross product of spin vector (0,0,ω_z) and velocity (vx,vy,0)
  // gives (ω_z * vy, -ω_z * vx) in the horizontal plane.
  // Normalized and scaled by curveCoefficient × |v_h| × |ω_z|.
  const forceMag = curveCoeff * hSpd * spinZ;
  const nx = vy / hSpd; // perpendicular x component
  const ny = -vx / hSpd; // perpendicular y component

  return {
    x: vx + forceMag * nx,
    y: vy + forceMag * ny,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Integrate the ball for one tick.
 *
 * The ball state is mutated in place. Events are returned separately
 * so the simulation loop can assign authoritative tick/sequence values.
 *
 * @param ball - Mutable ball state (mutated in place).
 * @param dt - Fixed tick duration in seconds.
 * @param config - Provisional ball coefficients (default: FOUNDATION_BALL_V1 shape).
 * @param eventCounter - Starting event sequence counter (incremented in place).
 * @param tick - Current simulation tick for event attribution.
 * @returns Pitch-contact events generated during this tick.
 */
export function stepBall(
  ball: BallState,
  dt: number,
  config: BallConfig = DEFAULT_CONFIG,
  eventCounter: { value: number },
  tick: number,
): SimulationEvent[] {
  const gravity = config.gravity.value;
  const restitution = config.restitution.value;
  const groundResistance = config.groundResistance.value;
  const spinDecay = config.spinDecay.value;
  const radius = config.ballRadius.value;
  const airDrag = config.airDrag.value;
  const resistanceFactor = 1 - groundResistance;

  const events: SimulationEvent[] = [];
  let remaining = dt;
  let iterCount = 0;

  // Loop to handle multiple bounces within a single tick.
  while (remaining > 1e-12 && iterCount < MAX_SWEPT_ITERATIONS) {
    iterCount++;

    // Determine regime from current state.
    const isGrounded = ball.position.z <= radius + 1e-9;
    if (ball.regime !== "airborne" && !isGrounded) {
      ball.regime = "airborne";
    }

    if (ball.regime === "airborne" || ball.regime === "bouncing") {
      // -- Free-flight phase -----------------------------------------------
      // Record position before integration (needed for swept test).
      const x0 = ball.position.x;
      const y0 = ball.position.y;
      const z0 = ball.position.z;

      // Apply gravity: vz -= gravity × remaining (z is up, gravity pulls down)
      ball.linearVelocity.z -= gravity * remaining;

      // Apply air drag: v *= 1 - airDrag × remaining (speed-proportional)
      const dragFactor = 1 - airDrag * remaining;
      ball.linearVelocity.x *= dragFactor;
      ball.linearVelocity.y *= dragFactor;
      ball.linearVelocity.z *= dragFactor;

      // Apply Magnus curve force (spin → lateral acceleration in flight).
      const curveResisted = applyMagnusCurve(
        ball.linearVelocity.x,
        ball.linearVelocity.y,
        ball.angularVelocity.z,
        config.curveCoefficient.value,
      );
      ball.linearVelocity.x = curveResisted.x;
      ball.linearVelocity.y = curveResisted.y;

      // Integrate position from velocity (full remaining interval).
      const vz = ball.linearVelocity.z;
      const vx = ball.linearVelocity.x;
      const vy = ball.linearVelocity.y;
      const x1 = x0 + vx * remaining;
      const y1 = y0 + vy * remaining;
      const z1 = z0 + vz * remaining;

      // -- Swept pitch-plane impact test -----------------------------------
      if (z1 <= radius) {
        // Ball crossed the ground plane. Find exact impact time.
        // z0 + vz * tImpact = radius → tImpact = (radius - z0) / vz
        let tImpact: number;
        if (vz < -1e-12) {
          tImpact = (radius - z0) / vz;
          tImpact = Math.max(0, Math.min(tImpact, remaining));
        } else {
          // Numerical drift: at or above radius but computed below.
          tImpact = 0;
        }

        // Snapshot incoming state (after free-flight acceleration, before bounce).
        const incomingState: BallStateSnapshot = {
          position: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
          linearVelocity: { x: ball.linearVelocity.x, y: ball.linearVelocity.y, z: ball.linearVelocity.z },
          angularVelocity: { x: ball.angularVelocity.x, y: ball.angularVelocity.y, z: ball.angularVelocity.z },
          regime: ball.regime,
        };

        // Reset position to the exact impact point.
        ball.position.x = x0 + vx * tImpact;
        ball.position.y = y0 + vy * tImpact;
        ball.position.z = radius;

        // -- Bounce: reverse and dampen vertical velocity ------------------
        ball.linearVelocity.z = -ball.linearVelocity.z * restitution;

        // Apply ground resistance to horizontal velocity (cannot reverse).
        const resisted = applyGroundResistance(
          ball.linearVelocity.x,
          ball.linearVelocity.y,
          resistanceFactor,
        );
        ball.linearVelocity.x = resisted.x;
        ball.linearVelocity.y = resisted.y;

        // Integrate remaining time from impact point.
        const afterBounce = remaining - tImpact;
        ball.position.x += ball.linearVelocity.x * afterBounce;
        ball.position.y += ball.linearVelocity.y * afterBounce;
        ball.position.z += ball.linearVelocity.z * afterBounce;

        // Clamp to ground radius (no penetration).
        if (ball.position.z < radius) {
          ball.position.z = radius;
        }

        // Determine regime after impact.
        if (Math.abs(ball.linearVelocity.z) > BOUNCE_THRESHOLD) {
          ball.regime = "airborne";
        } else {
          // Absorbed: settle vertical velocity.
          ball.linearVelocity.z = 0;
          ball.position.z = radius;
          ball.regime = "ground-roll";
        }

        // Angular velocity: spin decay applied per contact.
        ball.angularVelocity.x *= spinDecay;
        ball.angularVelocity.y *= spinDecay;
        ball.angularVelocity.z *= spinDecay;

        // Snapshot outgoing state (after bounce and integration).
        const outgoingState: BallStateSnapshot = {
          position: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
          linearVelocity: { x: ball.linearVelocity.x, y: ball.linearVelocity.y, z: ball.linearVelocity.z },
          angularVelocity: { x: ball.angularVelocity.x, y: ball.angularVelocity.y, z: ball.angularVelocity.z },
          regime: ball.regime,
        };

        // Emit pitch-contact event.
        eventCounter.value++;
        events.push({
          id: `ball-pitch-contact-${tick}-${eventCounter.value}`,
          tick,
          sequence: eventCounter.value,
          kind: "pitch-contact",
          label: "Ball pitch contact",
          payload: {
            incoming: incomingState,
            outgoing: outgoingState,
            contactType: "ground-impact",
          },
        });

        remaining = afterBounce;
      } else {
        // No ground contact — position is fully integrated.
        ball.position.x = x1;
        ball.position.y = y1;
        ball.position.z = z1;
        remaining = 0;
      }
    } else if (ball.regime === "ground-roll") {
      // -- Ground-roll phase -----------------------------------------------
      // Apply ground resistance: speed-proportional horizontal damping.
      // Cannot reverse velocity.
      const resisted = applyGroundResistance(
        ball.linearVelocity.x,
        ball.linearVelocity.y,
        resistanceFactor,
      );
      ball.linearVelocity.x = resisted.x;
      ball.linearVelocity.y = resisted.y;

      // Apply Magnus curve force on ground roll (much smaller effect).
      const curveGroundResisted = applyMagnusCurve(
        ball.linearVelocity.x,
        ball.linearVelocity.y,
        ball.angularVelocity.z,
        config.curveCoefficient.value,
      );
      ball.linearVelocity.x = curveGroundResisted.x;
      ball.linearVelocity.y = curveGroundResisted.y;

      // Integrate horizontal position.
      ball.position.x += ball.linearVelocity.x * remaining;
      ball.position.y += ball.linearVelocity.y * remaining;
      // Z stays at radius (on ground).
      ball.position.z = radius;

      // Spin decay.
      ball.angularVelocity.x *= spinDecay;
      ball.angularVelocity.y *= spinDecay;
      ball.angularVelocity.z *= spinDecay;

      // Check settle: if horizontal speed is negligible, settle.
      const finalSpeed = horizontalSpeed(
        ball.linearVelocity.x,
        ball.linearVelocity.y,
      );
      if (finalSpeed < GROUND_SETTLE_SPEED) {
        ball.linearVelocity.x = 0;
        ball.linearVelocity.y = 0;
        ball.linearVelocity.z = 0;
        ball.angularVelocity.x = 0;
        ball.angularVelocity.y = 0;
        ball.angularVelocity.z = 0;
        ball.regime = "settled";
      }

      remaining = 0;
    } else {
      // "settled" — no physics.
      remaining = 0;
    }
  }

  return events;
}
