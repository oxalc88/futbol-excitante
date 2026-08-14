/**
 * @module @pes/simulation/locomotion/locomotion-system
 *
 * Minimal football-specific kinematic locomotion controller.
 *
 * Reads desiredVelocity / desiredHeading that were set by input resolution,
 * then converges actual linearVelocity / bodyHeading under configurable
 * acceleration, braking, max-speed, and angular-rate limits.
 *
 * Position is integrated from velocity. Input NEVER assigns position.
 * Velocity is NEVER replaced by `input × maxSpeed`.
 *
 * No ball, contact, stamina, action, rating, or animation coupling.
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { PlayerState } from "../../contracts/state.js";
import { FOUNDATION_LOCOMOTION_V1 } from "../config/foundation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAU = 2 * Math.PI;

/** Normalize an angle to [-π, π). */
function normalizeAngle(angle: number): number {
  // Use modular arithmetic for a single-pass normalization.
  let a = angle;
  if (a >= Math.PI) {
    a -= TAU * Math.floor((a + Math.PI) / TAU);
  } else if (a < -Math.PI) {
    a += TAU * Math.floor((Math.PI - a) / TAU);
  }
  return a;
}

/** Euclidean magnitude of a 2D vector. */
function mag(v: { x: number; y: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/** Return a unit vector in the same direction, or zero if magnitude is 0. */
function unit(v: { x: number; y: number }): { x: number; y: number } {
  const m = mag(v);
  if (m === 0) return { x: 0, y: 0 };
  return { x: v.x / m, y: v.y / m };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Advance one locomotion tick for every player in the list.
 *
 * Behaviour:
 *  1. The desiredVelocity direction on each player is interpreted as the
 *     movement intent. Its magnitude (capped at 1) scales the effective
 *     maximum speed.  This is NOT `input × maxSpeed` — the actual
 *     velocity converges toward the target under acceleration / braking
 *     limits, so the response is non-instantaneous.
 *  2. bodyHeading converges toward desiredHeading under the configured
 *     angular turn rate.  Movement direction, body heading, and desired
 *     heading remain distinct fields.
 *  3. Position is integrated as `groundPosition += linearVelocity × dt`.
 *
 * All coefficient values come from the versioned config parameter.
 * Unmeasured values are labelled provisional.
 *
 * @param players - Mutable player array (players are mutated in place).
 * @param dt - Fixed tick duration in seconds (rational from config).
 * @param config - Locomotion coefficient set (default: FOUNDATION_LOCOMOTION_V1).
 */
export function stepLocomotion(
  players: readonly PlayerState[],
  dt: number,
  config: typeof FOUNDATION_LOCOMOTION_V1 = FOUNDATION_LOCOMOTION_V1,
): void {
  const maxSpeed = config.maxSpeed.value;
  const accel = config.acceleration.value;
  const brake = config.braking.value;
  const turnRate = config.turnRate.value;

  for (const player of players) {
    // -- 1. Compute target velocity from desiredVelocity direction --------

    const inputMag = mag(player.desiredVelocity);
    // Clamp input magnitude to [0, 1] — the raw input axes are each in
    // [-1, 1], so magnitude can reach √2.  We treat anything ≥ 1 as full
    // intent.
    const speedFraction = inputMag >= 1 ? 1 : inputMag;
    const targetSpeed = speedFraction * maxSpeed;
    const targetDir = unit(player.desiredVelocity);
    const targetVelocity = {
      x: targetDir.x * targetSpeed,
      y: targetDir.y * targetSpeed,
    };

    // -- 2. Converge linearVelocity toward targetVelocity ----------------

    const errX = targetVelocity.x - player.linearVelocity.x;
    const errY = targetVelocity.y - player.linearVelocity.y;
    const errMag = Math.sqrt(errX * errX + errY * errY);

    if (errMag > 0) {
      // Choose acceleration or braking limit based on whether we are
      // gaining or losing speed along the error direction.
      const currentSpeed = mag(player.linearVelocity);
      const maxDelta = targetSpeed >= currentSpeed ? accel * dt : brake * dt;

      if (errMag <= maxDelta) {
        // Error is small enough to close in one tick.
        player.linearVelocity.x = targetVelocity.x;
        player.linearVelocity.y = targetVelocity.y;
      } else {
        // Step toward the target at the clamped rate.
        const scale = maxDelta / errMag;
        player.linearVelocity.x += errX * scale;
        player.linearVelocity.y += errY * scale;
      }
    }

    // Hard clamp speed to the configured maximum.
    const speed = mag(player.linearVelocity);
    if (speed > maxSpeed) {
      const s = maxSpeed / speed;
      player.linearVelocity.x *= s;
      player.linearVelocity.y *= s;
    }

    // -- 3. Converge bodyHeading toward desiredHeading -------------------

    let angleDiff = normalizeAngle(player.desiredHeading - player.bodyHeading);
    const maxTurn = turnRate * dt;

    if (Math.abs(angleDiff) <= maxTurn) {
      player.bodyHeading = player.desiredHeading;
    } else {
      player.bodyHeading += (angleDiff > 0 ? 1 : -1) * maxTurn;
    }
    player.bodyHeading = normalizeAngle(player.bodyHeading);

    // -- 4. Integrate position from velocity -----------------------------

    player.groundPosition.x += player.linearVelocity.x * dt;
    player.groundPosition.y += player.linearVelocity.y * dt;
  }
}
