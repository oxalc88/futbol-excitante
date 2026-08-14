/**
 * @module eval/metrics/player-motion
 *
 * Deterministic player motion metrics derived from telemetry observations.
 *
 * Metrics:
 * - `player-speed`: series of scalar speed values per player per tick
 * - `player-displacement`: series of planar displacement magnitudes per player
 * - `player-heading-change`: series of heading deltas per player per tick
 *
 * Observations only — no calibrated acceptance thresholds.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { BootstrapPlayerObservation } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A player metric value for a single tick.
 */
export interface PlayerMetricPoint {
  tick: number;
  playerId: string;
  teamId: string;
  speed: number;
  displacement: number;
  headingChange: number;
}

/**
 * Aggregated player metrics over a set of observations.
 */
export interface PlayerMotionMetrics {
  points: PlayerMetricPoint[];
  series: {
    /** Speed series: { tick, playerId, value } */
    speed: Array<{ tick: number; playerId: string; value: number }>;
    /** Displacement series: { tick, playerId, value } */
    displacement: Array<{ tick: number; playerId: string; value: number }>;
    /** Heading change series: { tick, playerId, value } */
    headingChange: Array<{ tick: number; playerId: string; value: number }>;
  };
}

// ---------------------------------------------------------------------------
// Metrics computation
// ---------------------------------------------------------------------------

/**
 * Compute player motion metrics from a sequence of telemetry observations.
 *
 * @param observations - Ordered observations sorted by tick.
 * @returns PlayerMotionMetrics.
 */
export function computePlayerMotionMetrics(
  observations: TelemetryObservation[],
): PlayerMotionMetrics {
  const points: PlayerMetricPoint[] = [];
  const speedSeries: PlayerMotionMetrics["series"]["speed"] = [];
  const displacementSeries: PlayerMotionMetrics["series"]["displacement"] = [];
  const headingChangeSeries: PlayerMotionMetrics["series"]["headingChange"] = [];

  // Track previous position/heading per player for delta computation.
  type PrevState = {
    groundPosition: { x: number; y: number };
    bodyHeading: number;
  };
  const prevByPlayer = new Map<string, PrevState>();

  for (const obs of observations) {
    for (const p of obs.players) {
      const speed = Math.sqrt(
        p.linearVelocity.x * p.linearVelocity.x +
          p.linearVelocity.y * p.linearVelocity.y,
      );

      let displacement = 0;
      let headingChange = 0;
      const prev = prevByPlayer.get(p.playerId);
      if (prev) {
        const dx = p.groundPosition.x - prev.groundPosition.x;
        const dy = p.groundPosition.y - prev.groundPosition.y;
        displacement = Math.sqrt(dx * dx + dy * dy);

        headingChange = p.bodyHeading - prev.bodyHeading;
        // Normalize to [-π, π]
        while (headingChange > Math.PI) headingChange -= 2 * Math.PI;
        while (headingChange < -Math.PI) headingChange += 2 * Math.PI;
      }

      points.push({
        tick: obs.tick,
        playerId: p.playerId,
        teamId: p.teamId,
        speed,
        displacement,
        headingChange,
      });

      speedSeries.push({ tick: obs.tick, playerId: p.playerId, value: speed });
      displacementSeries.push({ tick: obs.tick, playerId: p.playerId, value: displacement });
      headingChangeSeries.push({ tick: obs.tick, playerId: p.playerId, value: headingChange });

      prevByPlayer.set(p.playerId, {
        groundPosition: { ...p.groundPosition },
        bodyHeading: p.bodyHeading,
      });
    }
  }

  return {
    points,
    series: { speed: speedSeries, displacement: displacementSeries, headingChange: headingChangeSeries },
  };
}