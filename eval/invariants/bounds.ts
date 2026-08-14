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