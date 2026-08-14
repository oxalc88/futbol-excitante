/**
 * @module eval/oracles/ball-decay
 *
 * Detects disabled ball decay: a ground-ball that does not lose speed
 * between consecutive ticks.  When ground resistance is working,
 * a ground-ball's speed must decrease each tick (or remain at zero).
 *
 * This oracle looks at the ball regime and speed trajectory.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

/**
 * Check that ground-ball speed decays (decreases or stays zero)
 * between consecutive observations.  A constant non-zero speed
 * between two ground-roll ticks indicates disabled decay (ball is
 * frozen at a fixed velocity).
 *
 * @param observations - Ordered observations sorted by tick.
 * @returns InvariantResult (first observation is skipped).
 */
export function checkBallDecay(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const results: InvariantResult[] = [];

  for (let i = 1; i < observations.length; i++) {
    const prev = observations[i - 1];
    const curr = observations[i];

    // Only check when ball is in ground-roll.
    if (curr.ball.regime !== "ground-roll") continue;

    const prevSpeed = Math.sqrt(
      prev.ball.linearVelocity.x ** 2
      + prev.ball.linearVelocity.y ** 2
      + prev.ball.linearVelocity.z ** 2,
    );
    const currSpeed = Math.sqrt(
      curr.ball.linearVelocity.x ** 2
      + curr.ball.linearVelocity.y ** 2
      + curr.ball.linearVelocity.z ** 2,
    );

    // Flag if the ball is in ground-roll but:
    // 1) Speed increased beyond tolerance, OR
    // 2) Speed is constant non-zero (disabled decay).
    // Allow small numerical tolerance (1e-9).
    if (prev.ball.regime === "ground-roll") {
      if (currSpeed > prevSpeed + 1e-9) {
        results.push({
          id: `ball-no-decay-tick-${curr.tick}`,
          status: "fail",
          description: `Ball at tick ${curr.tick}: speed ${currSpeed.toFixed(6)} > prev ${prevSpeed.toFixed(6)} (ground-roll)`,
          details: {
            tick: curr.tick,
            prevSpeed,
            currSpeed,
            regime: curr.ball.regime,
          },
        });
      } else if (prevSpeed > 1e-9 && Math.abs(currSpeed - prevSpeed) <= 1e-9) {
        // Constant non-zero ground-roll speed: decay is disabled.
        results.push({
          id: `ball-no-decay-tick-${curr.tick}`,
          status: "fail",
          description: `Ball at tick ${curr.tick}: constant non-zero speed ${currSpeed.toFixed(6)} m/s (ground-roll, decay disabled)`,
          details: {
            tick: curr.tick,
            prevSpeed,
            currSpeed,
            regime: curr.ball.regime,
          },
        });
      }
    }
  }

  // No violations found — oracle ran successfully on clean data.
  if (results.length === 0) {
    results.push({
      id: "ball-decay-clean",
      status: "pass",
      description: "Ball ground-roll speed decays as expected",
    });
  }

  return results;
}