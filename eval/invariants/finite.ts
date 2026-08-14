/**
 * @module eval/invariants/finite
 *
 * Finite-number invariant: every numeric field in the observation must be
 * finite (not NaN or ±Infinity).
 *
 * This is a bootstrap canary — it validates the same property the core
 * checks in validateInvariants(), but as an external evaluator check.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check that all numeric values in a telemetry observation are finite.
 *
 * @param observation - The observation to check.
 * @returns InvariantResult with status pass/fail.
 */
export function checkFiniteNumber(
  observation: TelemetryObservation,
): InvariantResult {
  const errors: string[] = [];

  // Check player values
  for (const p of observation.players) {
    if (!Number.isFinite(p.groundPosition.x)) {
      errors.push(`${p.playerId}.groundPosition.x not finite`);
    }
    if (!Number.isFinite(p.groundPosition.y)) {
      errors.push(`${p.playerId}.groundPosition.y not finite`);
    }
    if (!Number.isFinite(p.linearVelocity.x)) {
      errors.push(`${p.playerId}.linearVelocity.x not finite`);
    }
    if (!Number.isFinite(p.linearVelocity.y)) {
      errors.push(`${p.playerId}.linearVelocity.y not finite`);
    }
    if (!Number.isFinite(p.desiredVelocity.x)) {
      errors.push(`${p.playerId}.desiredVelocity.x not finite`);
    }
    if (!Number.isFinite(p.desiredVelocity.y)) {
      errors.push(`${p.playerId}.desiredVelocity.y not finite`);
    }
    if (!Number.isFinite(p.bodyHeading)) {
      errors.push(`${p.playerId}.bodyHeading not finite`);
    }
    if (!Number.isFinite(p.desiredHeading)) {
      errors.push(`${p.playerId}.desiredHeading not finite`);
    }
  }

  // Check ball values
  const ball = observation.ball;
  if (!Number.isFinite(ball.position.x)) {
    errors.push("ball.position.x not finite");
  }
  if (!Number.isFinite(ball.position.y)) {
    errors.push("ball.position.y not finite");
  }
  if (!Number.isFinite(ball.position.z)) {
    errors.push("ball.position.z not finite");
  }
  if (!Number.isFinite(ball.linearVelocity.x)) {
    errors.push("ball.linearVelocity.x not finite");
  }
  if (!Number.isFinite(ball.linearVelocity.y)) {
    errors.push("ball.linearVelocity.y not finite");
  }
  if (!Number.isFinite(ball.linearVelocity.z)) {
    errors.push("ball.linearVelocity.z not finite");
  }
  if (!Number.isFinite(ball.angularVelocity.x)) {
    errors.push("ball.angularVelocity.x not finite");
  }
  if (!Number.isFinite(ball.angularVelocity.y)) {
    errors.push("ball.angularVelocity.y not finite");
  }
  if (!Number.isFinite(ball.angularVelocity.z)) {
    errors.push("ball.angularVelocity.z not finite");
  }

  // Check observation-level numerics
  if (!Number.isFinite(observation.tick)) {
    errors.push("observation.tick not finite");
  }
  if (!Number.isFinite(observation.simulationTime)) {
    errors.push("observation.simulationTime not finite");
  }
  if (!Number.isFinite(observation.committedTick)) {
    errors.push("observation.committedTick not finite");
  }

  return {
    id: "finite-number",
    status: errors.length === 0 ? "pass" : "fail",
    description: "All numeric values are finite (not NaN or ±Infinity)",
    details: errors.length === 0 ? undefined : { errors },
  };
}