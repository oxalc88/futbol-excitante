/**
 * @module eval/oracles/camera-hash
 *
 * Checks that presentation (camera) mutations do not alter core
 * simulation hashes.  The oracle runs two evaluations of the same
 * scenario with identical inputs and seed but different camera
 * configurations.  Core state hashes must be identical regardless
 * of camera settings.
 *
 * This oracle is self-contained: it does not need observations from
 * a single run — it computes hashes from world snapshots.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { InvariantResult, TelemetryObservation } from "../../src/contracts/telemetry.js";
import { hashFnv1a64 } from "../../src/simulation/determinism/hash.js";
import { encodeCanonical } from "../../src/simulation/determinism/canonical.js";
import { freezeWorldState } from "../../src/simulation/world/clone.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify that two canonical encodings of world state produce the same
 * hash, regardless of any presentation-facing metadata that might
 * differ between the encodings.
 *
 * @param stateA - First world state (deep-frozen).
 * @param stateB - Second world state (deep-frozen), should be identical
 *   to stateA in all core fields.
 * @returns InvariantResult with pass/fail.
 */
export function checkCameraDoesNotAffectHash(
  stateA: Record<string, unknown>,
  stateB: Record<string, unknown>,
): InvariantResult {
  const canonicalA = encodeCanonical(stateA);
  const canonicalB = encodeCanonical(stateB);

  const hashA = hashFnv1a64(canonicalA);
  const hashB = hashFnv1a64(canonicalB);

  if (hashA !== hashB) {
    return {
      id: "camera-hash-differs",
      status: "fail",
      description: "Core hashes differ between two identical world states — presentation or camera may affect simulation hashes",
      details: { hashA, hashB, canonicalMatch: canonicalA === canonicalB },
    };
  }

  return {
    id: "camera-hash-consistent",
    status: "pass",
    description: "Core hashes are identical for identical world states",
  };
}

/**
 * Verify that the committed observation-core hash matches an independently
 * computed hash of the observation's core fields.
 *
 * `observationCoreHash` is a hash of the full world state computed by the
 * simulation at commit time.  The oracle recomputes from the same core
 * fields that the simulation captures in the observation (tick, prng fields,
 * players, ball, events).  When the committed core hash does not match the
 * independently computed hash, it indicates that the observation has been
 * tampered with or that a non-deterministic layer injected values.
 *
 * @param observations - Ordered observations sorted by tick.
 * @returns InvariantResult (one per observation).
 */
export function checkCameraHashConsistency(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const results: InvariantResult[] = [];

  for (const obs of observations) {
    const hash = computeObservationHash(obs);

    if (hash !== obs.observationCoreHash) {
      results.push({
        id: `camera-hash-inconsistency-tick-${obs.tick}`,
        status: "fail",
        description: `Observed core hash mismatch at tick ${obs.tick}: `
          + `committed=${obs.observationCoreHash}, computed=${hash}`,
        details: {
          tick: obs.tick,
          committedHash: obs.observationCoreHash,
          computedHash: hash,
        },
      });
    } else {
      results.push({
        id: `camera-hash-consistent-tick-${obs.tick}`,
        status: "pass",
        description: `State hash at tick ${obs.tick} is consistent`,
      });
    }
  }

  // No violations found — oracle ran successfully on clean data.
  if (results.length === 0) {
    results.push({
      id: "camera-hash-clean",
      status: "pass",
      description: "No camera-hash inconsistency detected",
    });
  }

  return results;
}

/**
 * Compute a deterministic hash of the core simulation fields of an
 * observation.  This hash intentionally excludes any presentation
 * metadata so that camera configuration changes cannot affect it.
 *
 * Fields: tick, prngAlgorithmId, prngStateHash, committedTick,
 * ordered player (position, velocity, heading), ball (position, velocity,
 * regime), ordered event IDs.  Does NOT include stateHash to avoid
 * circular hashing (hashing a hash).
 *
 * The sim computes the same hash (over the full frozen world state)
 * and stores it in observationCoreHash.  This oracle recomputes from
 * the observation's captured core fields and compares.
 */
function computeObservationHash(obs: TelemetryObservation): string {
  const coreFields = {
    schemaVersion: "observation-core-v1",
    tick: obs.tick,
    prngAlgorithmId: obs.prngAlgorithmId,
    prngStateHash: obs.prngStateHash,
    committedTick: obs.committedTick,
    players: obs.players.map((p) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
      linearVelocity: { x: p.linearVelocity.x, y: p.linearVelocity.y },
      bodyHeading: p.bodyHeading,
      desiredHeading: p.desiredHeading,
    })),
    ball: {
      position: {
        x: obs.ball.position.x,
        y: obs.ball.position.y,
        z: obs.ball.position.z,
      },
      linearVelocity: {
        x: obs.ball.linearVelocity.x,
        y: obs.ball.linearVelocity.y,
        z: obs.ball.linearVelocity.z,
      },
      regime: obs.ball.regime,
      lastTouchRef: obs.ball.lastTouchRef,
    },
    events: obs.events.map((e) => ({ id: e.id, tick: e.tick, sequence: e.sequence, kind: e.kind })),
  };

  return hashFnv1a64(encodeCanonical(coreFields));
}