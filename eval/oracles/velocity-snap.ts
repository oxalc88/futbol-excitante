/**
 * @module eval/oracles/velocity-snap
 *
 * Detects instantaneous velocity or body-heading snap between
 * consecutive ticks.  A "snap" is a change that exceeds a generous
 * physical bound and indicates state corruption rather than valid
 * simulation.
 *
 * Thresholds are generous but finite: a player must not accelerate
 * by more than 1000 m/s in a single tick (dt=1/60 s → 60000 m/s²),
 * nor rotate body heading by more than π radians in a single tick.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

// Generous bounds: >1000 m/s² change in velocity or >π rad heading change.
const MAX_VELOCITY_CHANGE_MAG = 1000;
const MAX_HEADING_CHANGE = Math.PI;

/**
 * Check for instantaneous velocity or body-heading snap between
 * consecutive observations.
 *
 * @param observations - Ordered observations sorted by tick.
 * @returns InvariantResult (first observation is skipped).
 */
export function checkVelocitySnap(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const results: InvariantResult[] = [];

  for (let i = 1; i < observations.length; i++) {
    const prev = observations[i - 1];
    const curr = observations[i];

    for (const player of curr.players) {
      const prevPlayer = prev.players.find(
        (p) => p.playerId === player.playerId,
      );
      if (!prevPlayer) continue;

      // Check velocity snap.
      const dvx = player.linearVelocity.x - prevPlayer.linearVelocity.x;
      const dvy = player.linearVelocity.y - prevPlayer.linearVelocity.y;
      const deltaV = Math.sqrt(dvx * dvx + dvy * dvy);

      // Check heading snap.
      let dH = player.bodyHeading - prevPlayer.bodyHeading;
      // Normalise to [-π, π].
      while (dH > Math.PI) dH -= 2 * Math.PI;
      while (dH < -Math.PI) dH += 2 * Math.PI;
      const absH = Math.abs(dH);

      if (deltaV > MAX_VELOCITY_CHANGE_MAG || absH > MAX_HEADING_CHANGE) {
        results.push({
          id: `vel-snap-tick-${curr.tick}`,
          status: "fail",
          description: `Player ${player.playerId} at tick ${curr.tick}: `
            + `|Δv|=${deltaV.toFixed(4)} m/s (max ${MAX_VELOCITY_CHANGE_MAG}), `
            + `|ΔH|=${absH.toFixed(4)} rad (max π)`,
          details: {
            tick: curr.tick,
            playerId: player.playerId,
            deltaVelocity: deltaV,
            deltaHeading: absH,
          },
        });
      }
    }

    // Also check ball velocity snap.
    const ballDvx = curr.ball.linearVelocity.x - prev.ball.linearVelocity.x;
    const ballDvy = curr.ball.linearVelocity.y - prev.ball.linearVelocity.y;
    const ballDvz = curr.ball.linearVelocity.z - prev.ball.linearVelocity.z;
    const ballDeltaV = Math.sqrt(
      ballDvx * ballDvx + ballDvy * ballDvy + ballDvz * ballDvz,
    );

    if (ballDeltaV > MAX_VELOCITY_CHANGE_MAG) {
      results.push({
        id: `ball-vel-snap-tick-${curr.tick}`,
        status: "fail",
        description: `Ball at tick ${curr.tick}: Δv=${ballDeltaV.toFixed(4)} m/s (max ${MAX_VELOCITY_CHANGE_MAG})`,
        details: { tick: curr.tick, deltaVelocity: ballDeltaV },
      });
    }
  }

  // No violations found — oracle ran successfully on clean data.
  if (results.length === 0) {
    results.push({
      id: "velocity-snap-clean",
      status: "pass",
      description: "No instantaneous velocity or heading snap detected",
    });
  }

  return results;
}