/**
 * @module eval/metrics/ball-motion
 *
 * Deterministic ball motion metrics derived from telemetry observations.
 *
 * Metrics:
 * - `ball-speed`: series of scalar ball speed values per tick
 * - `ball-distance`: cumulative planar distance travelled
 * - `ball-height`: Z coordinate series
 * - `ball-contact`: contact event count per tick
 *
 * Observations only — no calibrated acceptance thresholds.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single ball metric point for one tick.
 */
export interface BallMetricPoint {
  tick: number;
  speed: number;
  distance: number;
  height: number;
  contactCount: number;
}

/**
 * Aggregated ball motion metrics.
 */
export interface BallMotionMetrics {
  points: BallMetricPoint[];
  series: {
    speed: Array<{ tick: number; value: number }>;
    distance: Array<{ tick: number; value: number }>;
    height: Array<{ tick: number; value: number }>;
    contactCount: Array<{ tick: number; value: number }>;
  };
  totalDistance: number;
}

// ---------------------------------------------------------------------------
// Metrics computation
// ---------------------------------------------------------------------------

/**
 * Compute ball motion metrics from a sequence of telemetry observations.
 *
 * @param observations - Ordered observations sorted by tick.
 * @returns BallMotionMetrics.
 */
export function computeBallMotionMetrics(
  observations: TelemetryObservation[],
): BallMotionMetrics {
  const points: BallMetricPoint[] = [];
  const speedSeries: BallMotionMetrics["series"]["speed"] = [];
  const distanceSeries: BallMotionMetrics["series"]["distance"] = [];
  const heightSeries: BallMotionMetrics["series"]["height"] = [];
  const contactSeries: BallMotionMetrics["series"]["contactCount"] = [];

  let cumulativeDistance = 0;
  let prevX = 0;
  let prevY = 0;
  let firstTick = true;

  for (const obs of observations) {
    const ball = obs.ball;
    const speed = Math.sqrt(
      ball.linearVelocity.x ** 2 +
        ball.linearVelocity.y ** 2 +
        ball.linearVelocity.z ** 2,
    );

    let deltaDistance = 0;
    if (!firstTick) {
      const dx = ball.position.x - prevX;
      const dy = ball.position.y - prevY;
      deltaDistance = Math.sqrt(dx * dx + dy * dy);
    }
    cumulativeDistance += deltaDistance;

    const contactCount = obs.events.filter(
      (e) => e.kind === "pitch-contact" || e.kind === "rule",
    ).length;

    points.push({
      tick: obs.tick,
      speed,
      distance: cumulativeDistance,
      height: ball.position.z,
      contactCount,
    });

    speedSeries.push({ tick: obs.tick, value: speed });
    distanceSeries.push({ tick: obs.tick, value: cumulativeDistance });
    heightSeries.push({ tick: obs.tick, value: ball.position.z });
    contactSeries.push({ tick: obs.tick, value: contactCount });

    prevX = ball.position.x;
    prevY = ball.position.y;
    firstTick = false;
  }

  return {
    points,
    series: {
      speed: speedSeries,
      distance: distanceSeries,
      height: heightSeries,
      contactCount: contactSeries,
    },
    totalDistance: cumulativeDistance,
  };
}