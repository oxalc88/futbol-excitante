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
import { checkBounds, goalMouthSafetyBounds } from "../invariants/bounds.js";
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
import {
  checkGkRoleDesignation,
  checkGkPositioningHold,
  checkGkNoFieldChase,
  checkGkSaveClaim,
  checkGkDistributionNoOmniscience,
} from "./gk-role.js";
import {
  checkOutOfPlayDetection,
  checkOutOfPlayNoLastTouch,
  checkThrowInAward,
  checkGoalKickAward,
  checkCornerKickAward,
  checkGoalDetection,
} from "./rules-restart.js";
import {
  checkKickoffFreeze,
  checkTimerFreeze,
} from "./rules-phase.js";
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
    // The safety bound accounts for the goal mouth: a body (e.g. a keeper on
    // its goal arc, or a chaser entering the goal) may legitimately stand
    // behind the goal line by the goal-mouth depth derived from the versioned
    // `gk-small-sided-v1` arc.  The standard 105 m pitch has a goal line at
    // 52.5 m, so maxX = 52.5 + |goal_arc_center_x_offset| + goal_arc_radius.
    fn: perObservation((obs) => checkBounds(obs, goalMouthSafetyBounds(52.5))),
  },
  {
    oracle_id: "event-references",
    oracle_version: "oracle-references-v1",
    // `ball.lastTouchRef` is a persistent reference to the most recent
    // touch event, which may have been emitted on an earlier tick. Resolve
    // it against the union of every event emitted across the observation
    // window, not just the current observation's own per-tick events.
    fn: (observations) => {
      const allEventIds = new Set(
        observations.flatMap((o) => o.events.map((e) => e.id)),
      );
      return observations.map((o) => checkEventReferences(o, allEventIds));
    },
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
    // `ball.lastTouchRef` is a persistent reference to the most recent
    // touch event, which may have been emitted on an earlier tick. Resolve
    // it against the union of every event emitted across the observation
    // window, not just the current observation's own per-tick events.
    fn: (observations) => {
      const allEventIds = new Set(
        observations.flatMap((o) => o.events.map((e) => e.id)),
      );
      return checkPossessionEvidence(observations, allEventIds);
    },
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
  // SMALL-SIDED goalkeeper behavior oracles (protected; read committed telemetry).
  {
    oracle_id: "gk-role-designation-oracle-v1",
    oracle_version: "oracle-gk-role-designation-v1",
    fn: checkGkRoleDesignation,
  },
  {
    oracle_id: "gk-positioning-oracle-v1",
    oracle_version: "oracle-gk-positioning-v1",
    fn: checkGkPositioningHold,
  },
  {
    oracle_id: "gk-no-field-chase-oracle-v1",
    oracle_version: "oracle-gk-no-field-chase-v1",
    fn: checkGkNoFieldChase,
  },
  {
    oracle_id: "gk-save-claim-oracle-v1",
    oracle_version: "oracle-gk-save-claim-v1",
    fn: checkGkSaveClaim,
  },
  {
    oracle_id: "gk-distribution-oracle-v1",
    oracle_version: "oracle-gk-distribution-v1",
    fn: checkGkDistributionNoOmniscience,
  },
  // MATCH_RULES_SPEC §15 rules oracles (protected; read committed telemetry).
  {
    oracle_id: "rules-out-of-play-detect-oracle-v1",
    oracle_version: "oracle-rules-out-of-play-detect-v1",
    fn: checkOutOfPlayDetection,
  },
  {
    oracle_id: "rules-out-of-play-no-last-touch-oracle-v1",
    oracle_version: "oracle-rules-out-of-play-no-last-touch-v1",
    fn: checkOutOfPlayNoLastTouch,
  },
  {
    oracle_id: "rules-throw-in-award-oracle-v1",
    oracle_version: "oracle-rules-throw-in-award-v1",
    fn: checkThrowInAward,
  },
  {
    oracle_id: "rules-goal-kick-award-oracle-v1",
    oracle_version: "oracle-rules-goal-kick-award-v1",
    fn: checkGoalKickAward,
  },
  {
    oracle_id: "rules-corner-kick-award-oracle-v1",
    oracle_version: "oracle-rules-corner-kick-award-v1",
    fn: checkCornerKickAward,
  },
  {
    oracle_id: "rules-goal-detection-oracle-v1",
    oracle_version: "oracle-rules-goal-detection-v1",
    fn: checkGoalDetection,
  },
  {
    oracle_id: "rules-kickoff-freeze-oracle-v1",
    oracle_version: "oracle-rules-kickoff-freeze-v1",
    fn: checkKickoffFreeze,
  },
  {
    oracle_id: "rules-timer-freeze-oracle-v1",
    oracle_version: "oracle-rules-timer-freeze-v1",
    fn: checkTimerFreeze,
  },
];

for (const entry of entries) {
  registerOracle(entry);
}