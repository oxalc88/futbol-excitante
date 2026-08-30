/**
 * @module eval/oracles/wire
 *
 * Registers all existing invariants and new oracles into the
 * protected oracle registry.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { registerOracle } from "./oracle-registry.js";
import { checkFiniteNumber } from "../invariants/finite.js";
import { checkBounds } from "../invariants/bounds.js";
import { checkEventReferences } from "../invariants/references.js";
import { checkBallContinuity } from "../invariants/ball-continuity.js";
import type { BallContinuityConfig } from "../invariants/ball-continuity.js";
import { checkVelocitySnap } from "./velocity-snap.js";
import { checkBallDecay } from "./ball-decay.js";
import { checkBallTeleport } from "./ball-teleport.js";
import { checkPossessionEvidence } from "./possession.js";
import { checkCameraHashConsistency } from "./camera-hash.js";
import { checkDeferredMutants } from "./deferred-mutants.js";
import { checkPrngOrderOracle } from "./prng-order.js";
import { checkPlayerContactEvidence } from "./player-contact.js";
import { checkTacklePhaseEvidence } from "./tackle-phase.js";
import { checkScoreTracker } from "./match.js";
import { checkMatchClock } from "./match.js";
import type { OracleEntry } from "./oracle-registry.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Wrapper: per-observation invariants → observation-array API
// ---------------------------------------------------------------------------

function perObservation(fn: (obs: TelemetryObservation) => import("../../src/contracts/telemetry.js").InvariantResult): (obs: TelemetryObservation[]) => import("../../src/contracts/telemetry.js").InvariantResult[] {
  return (observations) => observations.map((o) => fn(o));
}

// ---------------------------------------------------------------------------
// Register oracles
// ---------------------------------------------------------------------------

const entries: OracleEntry[] = [
  // Existing invariants wired as oracles.
  {
    oracle_id: "finite-number",
    oracle_version: "oracle-finite-v1",
    fn: perObservation(checkFiniteNumber),
  },
  {
    oracle_id: "bounds",
    oracle_version: "oracle-bounds-v1",
    fn: perObservation((obs) => checkBounds(obs, { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 })),
  },
  {
    oracle_id: "event-references",
    oracle_version: "oracle-references-v1",
    fn: perObservation(checkEventReferences),
  },
  {
    oracle_id: "ball-continuity",
    oracle_version: "oracle-continuity-v1",
    fn: (observations) => checkBallContinuity(observations, { fixedDt: 1 / 60 }),
  },
  // New mutant-detecting oracles.
  {
    oracle_id: "velocity-snap",
    oracle_version: "oracle-velocity-snap-v1",
    fn: checkVelocitySnap,
  },
  {
    oracle_id: "ball-decay",
    oracle_version: "oracle-ball-decay-v1",
    fn: checkBallDecay,
  },
  {
    oracle_id: "ball-teleport",
    oracle_version: "oracle-ball-teleport-v1",
    fn: checkBallTeleport,
  },
  {
    oracle_id: "possession-evidence",
    oracle_version: "oracle-possession-v1",
    fn: checkPossessionEvidence,
  },
  {
    oracle_id: "camera-hash",
    oracle_version: "oracle-camera-v1",
    fn: checkCameraHashConsistency,
  },
  {
    oracle_id: "deferred-mutants",
    oracle_version: "oracle-deferred-mutants-v1",
    fn: () => [checkDeferredMutants()],
  },
  {
    oracle_id: "prng-order",
    oracle_version: "oracle-prng-order-v1",
    fn: checkPrngOrderOracle,
  },
  {
    oracle_id: "player-contact-evidence",
    oracle_version: "oracle-player-contact-v1",
    fn: checkPlayerContactEvidence,
  },
  // Tackle ordered-phase evidence (protected, per action kind).
  {
    oracle_id: "tackle-phase-evidence-standing",
    oracle_version: "oracle-tackle-phase-v1",
    fn: (observations) => checkTacklePhaseEvidence(observations, "standing"),
  },
  {
    oracle_id: "tackle-phase-evidence-slide",
    oracle_version: "oracle-tackle-phase-v1",
    fn: (observations) => checkTacklePhaseEvidence(observations, "slide"),
  },
  // Match-scoring oracles.
  {
    oracle_id: "score-tracker",
    oracle_version: "oracle-score-tracker-v1",
    fn: checkScoreTracker,
  },
  {
    oracle_id: "match-clock",
    oracle_version: "oracle-match-clock-v1",
    fn: checkMatchClock,
  },
];

for (const entry of entries) {
  registerOracle(entry);
}