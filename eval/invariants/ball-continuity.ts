/**
 * @module eval/invariants/ball-continuity
 *
 * Ball continuity invariant: the ball must not teleport between ticks.
 * The displacement between consecutive ticks must be below a generous
 * delta (500 m/s * dt as a sanity bound).
 *
 * Bootstrap canary — detects ball teleportation that should only
 * happen in mutant test paths.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Configuration for ball continuity checks.
 */
export interface BallContinuityConfig {
  /** Maximum allowed displacement per tick (metres). Default: 10. */
  maxDisplacementPerTick?: number;
  /** Fixed dt as a float (tick duration in seconds). */
  fixedDt: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const DEFAULT_MAX_DISPLACEMENT = 10; // generous: 10 m per tick

/**
 * Check ball continuity between consecutive observations.
 *
 * @param observations - Ordered observations sorted by tick.
 * @param config - Continuity configuration.
 * @returns Array of InvariantResult, one per observation (first observation is skipped).
 */
export function checkBallContinuity(
  observations: TelemetryObservation[],
  config: BallContinuityConfig,
): InvariantResult[] {
  const results: InvariantResult[] = [];
  const maxDisp = config.maxDisplacementPerTick ?? DEFAULT_MAX_DISPLACEMENT;

  for (let i = 1; i < observations.length; i++) {
    const prev = observations[i - 1].ball;
    const curr = observations[i].ball;

    const dx = curr.position.x - prev.position.x;
    const dy = curr.position.y - prev.position.y;
    const dz = curr.position.z - prev.position.z;
    const displacement = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const ok = displacement <= maxDisp;

    results.push({
      id: `ball-continuity-tick-${observations[i].tick}`,
      status: ok ? "pass" : "fail",
      description: `Ball displacement at tick ${observations[i].tick} is ${displacement.toFixed(6)} m (max ${maxDisp} m)`,
      details: ok
        ? undefined
        : {
            tick: observations[i].tick,
            displacement,
            maxDisplacement: maxDisp,
            prevZ: prev.position.z,
            currZ: curr.position.z,
          },
    });
  }

  return results;
}