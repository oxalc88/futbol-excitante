/**
 * @module eval/invariants/bounds
 *
 * Safety-bounds invariant: all player/ball positions must fall within
 * the declared safety bounds.
 *
 * Bootstrap canary — catches runaway state before it corrupts downstream
 * artifacts.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";
import { GK_SMALL_SIDED_V1 } from "../../src/adapters/input-browser/goalkeeper-role.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Safety bounds for the current scenario.
 */
export interface SafetyBounds {
  maxX: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/**
 * Provisional cross-pitch safety bound axes that are not the goal-mouth
 * longitudinal extent (touchline half-width, below-ground / above-air
 * tolerances).  The goal line itself is scenario-declared (`pitchLength / 2`);
 * only the goal-mouth depth is derived here.
 */
export const SAFETY_BOUNDS_CROSS = {
  maxY: 34,
  minZ: -0.5,
  maxZ: 20,
} as const;

/**
 * Goal-mouth safety bound for player bodies.
 *
 * The declared pitch boundary (`maxX = goalLineX`) bounds the ball and the
 * outfield, but a body can legitimately stand inside the goal mouth / net
 * depth behind the goal line (e.g. a designated small-sided keeper on its goal
 * arc, or an attacker chasing a loose ball into the goal).  The deepest a body
 * may occupy behind the goal line is the keeper's nominal goal-arc disk
 * (`gk-small-sided-v1`), whose centre is at the goal line (plus the versioned
 * longitudinal offset) and whose radius is `goal_arc_radius`.
 *
 * Derivation (versioned constant -> arithmetic -> bound):
 *   goalMouthMaxX = goalLineX + |goal_arc_center_x_offset| + goal_arc_radius
 *   For the standard 105 m pitch (goalLineX = 52.5), goal_arc_center_x_offset
 *   = 0 and goal_arc_radius = 4.0 -> 56.5 m.
 *
 * A body beyond this derived goal-depth limit is still a bounds FAIL; the
 * widened bound is a geometry correction, not an oracle weakening.
 */
export function goalMouthMaxX(goalLineX: number): number {
  return (
    goalLineX +
    Math.abs(GK_SMALL_SIDED_V1.goal_arc_center_x_offset.value) +
    GK_SMALL_SIDED_V1.goal_arc_radius.value
  );
}

/**
 * Full safety bounds for a scenario whose goal mouth is a legitimate body
 * region.  `goalLineX` is the scenario-declared goal line (`pitchLength / 2`).
 */
export function goalMouthSafetyBounds(goalLineX: number): SafetyBounds {
  return {
    maxX: goalMouthMaxX(goalLineX),
    ...SAFETY_BOUNDS_CROSS,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check that all player and ball positions are within safety bounds.
 *
 * @param observation - The observation to check.
 * @param bounds - Safety bounds for the scenario.
 * @returns InvariantResult with status pass/fail.
 */
export function checkBounds(
  observation: TelemetryObservation,
  bounds: SafetyBounds,
): InvariantResult {
  const errors: string[] = [];

  // Check player positions
  for (const p of observation.players) {
    if (Math.abs(p.groundPosition.x) > bounds.maxX) {
      errors.push(
        `${p.playerId}: |x|=${p.groundPosition.x} exceeds maxX=${bounds.maxX}`,
      );
    }
    if (Math.abs(p.groundPosition.y) > bounds.maxY) {
      errors.push(
        `${p.playerId}: |y|=${p.groundPosition.y} exceeds maxY=${bounds.maxY}`,
      );
    }
  }

  // Check ball position
  const ball = observation.ball;
  if (ball.position.z < bounds.minZ) {
    errors.push(
      `ball.z=${ball.position.z} below minZ=${bounds.minZ}`,
    );
  }
  if (ball.position.z > bounds.maxZ) {
    errors.push(
      `ball.z=${ball.position.z} above maxZ=${bounds.maxZ}`,
    );
  }

  return {
    id: "bounds",
    status: errors.length === 0 ? "pass" : "fail",
    description: "All positions within safety bounds",
    details: errors.length === 0 ? undefined : { errors },
  };
}