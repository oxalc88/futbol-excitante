/**
 * @module eval/oracles/ball-teleport
 *
 * Detects ball parenting or teleport: ball position changing by a
 * macroscopic amount in a single tick that exceeds any physically
 * plausible speed.
 *
 * This is a stricter supplement to ball-continuity — it catches cases
 * where the ball is "parented" to a player (position jumps to the
 * player's position) or teleports arbitrarily.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

/**
 * Maximum plausible speed for ball displacement (m/s) in one tick.
 * 600 m/s is a very generous bound (≈2160 km/h).
 */
const MAX_PLAUSIBLE_SPEED = 600;

/**
 * Check for ball teleportation or parenting between consecutive ticks.
 *
 * @param observations - Ordered observations sorted by tick.
 * @returns InvariantResult (first observation is skipped).
 */
export function checkBallTeleport(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const results: InvariantResult[] = [];

  for (let i = 1; i < observations.length; i++) {
    const prev = observations[i - 1];
    const curr = observations[i];

    const dx = curr.ball.position.x - prev.ball.position.x;
    const dy = curr.ball.position.y - prev.ball.position.y;
    const dz = curr.ball.position.z - prev.ball.position.z;
    const displacement = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (displacement > MAX_PLAUSIBLE_SPEED) {
      results.push({
        id: `ball-teleport-tick-${curr.tick}`,
        status: "fail",
        description: `Ball at tick ${curr.tick}: displacement ${displacement.toFixed(4)} m (max ${MAX_PLAUSIBLE_SPEED} m)`,
        details: {
          tick: curr.tick,
          displacement,
          delta: { x: dx, y: dy, z: dz },
        },
      });
    }

    // Detect parent-like teleport: ball position matches a player's
    // position exactly (within floating-point tolerance), suggesting
    // the ball was accidentally parented.
    for (const player of curr.players) {
      const px = player.groundPosition.x - curr.ball.position.x;
      const py = player.groundPosition.y - curr.ball.position.y;
      const pz = curr.ball.position.z; // z may differ due to ball height
      if (Math.abs(px) < 0.01 && Math.abs(py) < 0.01 && pz < 0.5) {
        // Only flag if the previous tick was far from the player.
        const prevPlayer = prev.players.find(
          (p) => p.playerId === player.playerId,
        );
        if (prevPlayer) {
          const pdx = prevPlayer.groundPosition.x - prev.ball.position.x;
          const pdy = prevPlayer.groundPosition.y - prev.ball.position.y;
          const prevDist = Math.sqrt(pdx * pdx + pdy * pdy);
          // If the ball was far from the player before but now on top of them.
          if (prevDist > 2 && prev.ball.position.z > 0.01) {
            results.push({
              id: `ball-parented-tick-${curr.tick}`,
              status: "fail",
              description: `Ball at tick ${curr.tick} appears parented to player ${player.playerId} `
                + `(was ${prevDist.toFixed(2)} m away, now on top)`,
              details: {
                tick: curr.tick,
                playerId: player.playerId,
                prevDistance: prevDist,
                currDistance: Math.sqrt(px * px + py * py),
              },
            });
          }
        }
      }
    }
  }

  // No violations found — oracle ran successfully on clean data.
  if (results.length === 0) {
    results.push({
      id: "ball-teleport-clean",
      status: "pass",
      description: "No ball teleportation or parenting detected",
    });
  }

  return results;
}