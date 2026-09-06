/**
 * @module @pes/eval/contracts/invariant-definitions
 *
 * InvariantDefinition registry entries.
 *
 * Maps common criterion IDs to existing bootstrap invariants:
 * - COMMON-FINITE        → finite-number (eval/invariants/finite.ts)
 * - COMMON-DETERMINISTIC → determinism (oracle: protected evaluator)
 * - COMMON-REFERENCES    → event-references (eval/invariants/references.ts)
 * - COMMON-BOUNDS        → bounds (eval/invariants/bounds.ts)
 *
 * Also registers BALL-CONTINUITY as a test-bound invariant.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { InvariantDefinition } from "./types.js";

export const INV_FINITE: InvariantDefinition = {
  invariant_id: "finite-number",
  invariant_version: "invariant-finite-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  oracle_id: "protected-evaluator-v1",
  oracle_version: "oracle-protected-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_DETERMINISTIC: InvariantDefinition = {
  invariant_id: "deterministic",
  invariant_version: "invariant-deterministic-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  oracle_id: "protected-evaluator-v1",
  oracle_version: "oracle-protected-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_REFERENCES: InvariantDefinition = {
  invariant_id: "event-references",
  invariant_version: "invariant-references-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  oracle_id: "protected-evaluator-v1",
  oracle_version: "oracle-protected-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_BOUNDS: InvariantDefinition = {
  invariant_id: "bounds",
  invariant_version: "invariant-bounds-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  oracle_id: "protected-evaluator-v1",
  oracle_version: "oracle-protected-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_BALL_CONTINUITY: InvariantDefinition = {
  invariant_id: "ball-continuity",
  invariant_version: "invariant-ball-continuity-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  oracle_id: "protected-evaluator-v1",
  oracle_version: "oracle-protected-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * Player-contact-evidence invariant: checks that player-player-contact
 * events exist and reference known players. Used by duels suite.
 */
export const INV_PLAYER_CONTACT: InvariantDefinition = {
  invariant_id: "player-contact-evidence",
  invariant_version: "invariant-player-contact-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  oracle_id: "protected-evaluator-v1",
  oracle_version: "oracle-protected-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * Standing tackle ordered-phase invariant: checks that standing tackle
 * attempts produce ordered prepare→active→recover phases with finite reach,
 * active-window-only contact, recovery lock-out, and velocity-only effects.
 * FAIL when ≥2 players present but no standing tackle evidence.
 */
export const INV_TACKLE_PHASE_STANDING: InvariantDefinition = {
  invariant_id: "tackle-phase-evidence-standing",
  invariant_version: "invariant-tackle-phase-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  oracle_id: "protected-evaluator-v1",
  oracle_version: "oracle-protected-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * Sliding tackle ordered-phase invariant: same contract as standing for
 * the sliding action kind.
 */
export const INV_TACKLE_PHASE_SLIDE: InvariantDefinition = {
  invariant_id: "tackle-phase-evidence-slide",
  invariant_version: "invariant-tackle-phase-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  oracle_id: "protected-evaluator-v1",
  oracle_version: "oracle-protected-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

// ---------------------------------------------------------------------------
// goalkeepers suite invariants
//
// Each invariant is declared here as contract data and bound to a registered
// protected keeper oracle (eval/oracles/gk-role.ts, wired in
// eval/oracles/wire.ts and mapped in eval/runners/foundation-evaluator.ts).
// A criterion still yields NOT_EVALUATED when the observation stream is not a
// two-team keeper match (no keeper designation observable) — honest "not yet
// observable" rather than claiming PASS on gameplay.
// ---------------------------------------------------------------------------

/**
 * GK role-designation evidence: exactly one designated keeper per team.
 * Bound to the protected gk-role-designation oracle.
 */
export const INV_GK_ROLE_DESIGNATION: InvariantDefinition = {
  invariant_id: "gk-role-designation-evidence",
  invariant_version: "invariant-gk-role-designation-v1",
  input_observation_ids: ["obs-gk-role-v1"],
  oracle_id: "gk-role-designation-oracle-v1",
  oracle_version: "oracle-gk-role-designation-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * GK positioning evidence: keeper holds the goal arc with bounded drift.
 * Bound to the protected gk-positioning oracle.
 */
export const INV_GK_POSITIONING: InvariantDefinition = {
  invariant_id: "gk-positioning-evidence",
  invariant_version: "invariant-gk-positioning-v1",
  input_observation_ids: ["obs-gk-positioning-v1"],
  oracle_id: "gk-positioning-oracle-v1",
  oracle_version: "oracle-gk-positioning-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * GK no-field-chase evidence: keeper never chases the ball into the field.
 * Bound to the protected gk-no-field-chase oracle.
 */
export const INV_GK_NO_FIELD_CHASE: InvariantDefinition = {
  invariant_id: "gk-no-field-chase-evidence",
  invariant_version: "invariant-gk-no-field-chase-v1",
  input_observation_ids: ["obs-gk-chase-v1"],
  oracle_id: "gk-no-field-chase-oracle-v1",
  oracle_version: "oracle-gk-no-field-chase-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * GK save/claim evidence: keeper claim is an explicit recorded ball contact.
 * Bound to the protected gk-save-claim oracle.
 */
export const INV_GK_SAVE_CLAIM: InvariantDefinition = {
  invariant_id: "gk-save-claim-evidence",
  invariant_version: "invariant-gk-save-claim-v1",
  input_observation_ids: ["obs-gk-save-claim-v1"],
  oracle_id: "gk-save-claim-oracle-v1",
  oracle_version: "oracle-gk-save-claim-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * GK distribution evidence: keeper release is a normal pass with no omniscience.
 * Bound to the protected gk-distribution oracle (which returns NOT_EVALUATED
 * while no keeper-release observation event kind exists in the committed
 * telemetry).
 */
export const INV_GK_DISTRIBUTION: InvariantDefinition = {
  invariant_id: "gk-distribution-evidence",
  invariant_version: "invariant-gk-distribution-v1",
  input_observation_ids: ["obs-gk-distribution-v1"],
  oracle_id: "gk-distribution-oracle-v1",
  oracle_version: "oracle-gk-distribution-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

// ---------------------------------------------------------------------------
// rules suite invariants
//
// Each invariant is bound to a registered protected rules oracle
// (eval/oracles/rules-restart.ts / rules-phase.ts, wired in eval/oracles/wire.ts
// and mapped in eval/runners/foundation-evaluator.ts).  A criterion still
// yields NOT_EVALUATED when the committed observation stream cannot carry the
// semantics (honest "not yet observable"), never an invented PASS.
// ---------------------------------------------------------------------------

/**
 * Out-of-play detection evidence: a boundary crossing emits exactly one correct
 * event and goal / goal-line out-of-play are mutually exclusive.
 * Bound to the protected rules-out-of-play-detect oracle.
 */
export const INV_RULES_OUT_OF_PLAY_DETECT: InvariantDefinition = {
  invariant_id: "rules-out-of-play-detect-evidence",
  invariant_version: "invariant-rules-out-of-play-detect-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-out-of-play-detect-oracle-v1",
  oracle_version: "oracle-rules-out-of-play-detect-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * Out-of-play no-last-touch evidence: a boundary with null / unresolvable
 * lastTouchRef opens no restart.  Bound to the protected
 * rules-out-of-play-no-last-touch oracle.
 */
export const INV_RULES_OUT_OF_PLAY_NO_LAST_TOUCH: InvariantDefinition = {
  invariant_id: "rules-out-of-play-no-last-touch-evidence",
  invariant_version: "invariant-rules-out-of-play-no-last-touch-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-out-of-play-no-last-touch-oracle-v1",
  oracle_version: "oracle-rules-out-of-play-no-last-touch-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * Throw-in award evidence: the served throw-in goes to the team opposite the
 * last-touch team.  Bound to the protected rules-throw-in-award oracle.
 */
export const INV_RULES_THROW_IN_AWARD: InvariantDefinition = {
  invariant_id: "rules-throw-in-award-evidence",
  invariant_version: "invariant-rules-throw-in-award-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-throw-in-award-oracle-v1",
  oracle_version: "oracle-rules-throw-in-award-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * Goal-kick award evidence: a goal kick is awarded to the defending team of the
 * exited goal line.  Bound to the protected rules-goal-kick-award oracle.
 */
export const INV_RULES_GOAL_KICK_AWARD: InvariantDefinition = {
  invariant_id: "rules-goal-kick-award-evidence",
  invariant_version: "invariant-rules-goal-kick-award-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-goal-kick-award-oracle-v1",
  oracle_version: "oracle-rules-goal-kick-award-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * Corner-kick award evidence: a corner kick is awarded to the attacking team
 * when the last touch is the defending team.  Bound to the protected
 * rules-corner-kick-award oracle.
 */
export const INV_RULES_CORNER_KICK_AWARD: InvariantDefinition = {
  invariant_id: "rules-corner-kick-award-evidence",
  invariant_version: "invariant-rules-corner-kick-award-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-corner-kick-award-oracle-v1",
  oracle_version: "oracle-rules-corner-kick-award-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * Goal-detection evidence: a goal event carries a valid goalIndex and is
 * mutually exclusive with goal-line out-of-play.  Bound to the protected
 * rules-goal-detection oracle.
 */
export const INV_RULES_GOAL_DETECTION: InvariantDefinition = {
  invariant_id: "rules-goal-detection-evidence",
  invariant_version: "invariant-rules-goal-detection-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-goal-detection-oracle-v1",
  oracle_version: "oracle-rules-goal-detection-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * Kickoff-freeze evidence: while the kickoff restart ball is untouched every
 * non-taker body is held at its kickoff home.  Bound to the protected
 * rules-kickoff-freeze oracle.
 */
export const INV_RULES_KICKOFF_FREEZE: InvariantDefinition = {
  invariant_id: "rules-kickoff-freeze-evidence",
  invariant_version: "invariant-rules-kickoff-freeze-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-kickoff-freeze-oracle-v1",
  oracle_version: "oracle-rules-kickoff-freeze-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * Timer-freeze evidence: bound to the protected rules-timer-freeze oracle, which
 * returns the honest NOT_EVALUATED because the committed observation stream does
 * not carry the core matchPhase / matchTimer (the timer-decrement contract is
 * core-owned and not serialized).  It never over-claims a timer-freeze PASS.
 */
export const INV_RULES_TIMER_FREEZE: InvariantDefinition = {
  invariant_id: "rules-timer-freeze-evidence",
  invariant_version: "invariant-rules-timer-freeze-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-timer-freeze-oracle-v1",
  oracle_version: "oracle-rules-timer-freeze-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/**
 * Rules depth invariants (RULES-FACTS-DEPTH-CONFORMANCE): per-restart
 * placement / serve / phase-specific timer-freeze, the timer decrement /
 * halftime / fulltime transitions, the goal phase, and the kickoff
 * first-touch window.  Each is bound to a registered protected rules oracle.
 */
export const INV_RULES_THROW_IN_PLACEMENT: InvariantDefinition = {
  invariant_id: "rules-throw-in-placement-evidence",
  invariant_version: "invariant-rules-throw-in-placement-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-throw-in-placement-oracle-v1",
  oracle_version: "oracle-rules-throw-in-placement-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_RULES_THROW_IN_SERVE: InvariantDefinition = {
  invariant_id: "rules-throw-in-serve-evidence",
  invariant_version: "invariant-rules-throw-in-serve-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-throw-in-serve-oracle-v1",
  oracle_version: "oracle-rules-throw-in-serve-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_RULES_GOAL_KICK_PLACEMENT: InvariantDefinition = {
  invariant_id: "rules-goal-kick-placement-evidence",
  invariant_version: "invariant-rules-goal-kick-placement-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-goal-kick-placement-oracle-v1",
  oracle_version: "oracle-rules-goal-kick-placement-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_RULES_GOAL_PHASE: InvariantDefinition = {
  invariant_id: "rules-goal-phase-evidence",
  invariant_version: "invariant-rules-goal-phase-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-goal-phase-oracle-v1",
  oracle_version: "oracle-rules-goal-phase-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_RULES_KICKOFF_FIRST_TOUCH: InvariantDefinition = {
  invariant_id: "rules-kickoff-first-touch-evidence",
  invariant_version: "invariant-rules-kickoff-first-touch-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-kickoff-first-touch-oracle-v1",
  oracle_version: "oracle-rules-kickoff-first-touch-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_RULES_THROW_IN_TIMER_FREEZE: InvariantDefinition = {
  invariant_id: "rules-throw-in-timer-freeze-evidence",
  invariant_version: "invariant-rules-throw-in-timer-freeze-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-throw-in-timer-freeze-oracle-v1",
  oracle_version: "oracle-rules-throw-in-timer-freeze-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_RULES_GOAL_KICK_TIMER_FREEZE: InvariantDefinition = {
  invariant_id: "rules-goal-kick-timer-freeze-evidence",
  invariant_version: "invariant-rules-goal-kick-timer-freeze-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-goal-kick-timer-freeze-oracle-v1",
  oracle_version: "oracle-rules-goal-kick-timer-freeze-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_RULES_TIMER_DECREMENT: InvariantDefinition = {
  invariant_id: "rules-timer-decrement-evidence",
  invariant_version: "invariant-rules-timer-decrement-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-timer-decrement-oracle-v1",
  oracle_version: "oracle-rules-timer-decrement-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_RULES_TIMER_HALFTIME: InvariantDefinition = {
  invariant_id: "rules-timer-halftime-evidence",
  invariant_version: "invariant-rules-timer-halftime-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-timer-halftime-oracle-v1",
  oracle_version: "oracle-rules-timer-halftime-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

export const INV_RULES_TIMER_FULLTIME: InvariantDefinition = {
  invariant_id: "rules-timer-fulltime-evidence",
  invariant_version: "invariant-rules-timer-fulltime-v1",
  input_observation_ids: ["obs-rules-restart-v1"],
  oracle_id: "rules-timer-fulltime-oracle-v1",
  oracle_version: "oracle-rules-timer-fulltime-v1",
  owner: "PROTECTED_EVALUATOR",
  invalid_data_behavior: "INVALID_RUN",
  output_schema_id: "invariant-result-v1",
  output_schema_version: "schema-invariant-result-v1",
};

/** All registered invariant definitions keyed by invariant_id. */
export const INVARIANT_DEFINITIONS: Record<string, InvariantDefinition> = {
  [INV_FINITE.invariant_id]: INV_FINITE,
  [INV_DETERMINISTIC.invariant_id]: INV_DETERMINISTIC,
  [INV_REFERENCES.invariant_id]: INV_REFERENCES,
  [INV_BOUNDS.invariant_id]: INV_BOUNDS,
  [INV_BALL_CONTINUITY.invariant_id]: INV_BALL_CONTINUITY,
  [INV_PLAYER_CONTACT.invariant_id]: INV_PLAYER_CONTACT,
  [INV_TACKLE_PHASE_STANDING.invariant_id]: INV_TACKLE_PHASE_STANDING,
  [INV_TACKLE_PHASE_SLIDE.invariant_id]: INV_TACKLE_PHASE_SLIDE,
  [INV_GK_ROLE_DESIGNATION.invariant_id]: INV_GK_ROLE_DESIGNATION,
  [INV_GK_POSITIONING.invariant_id]: INV_GK_POSITIONING,
  [INV_GK_NO_FIELD_CHASE.invariant_id]: INV_GK_NO_FIELD_CHASE,
  [INV_GK_SAVE_CLAIM.invariant_id]: INV_GK_SAVE_CLAIM,
  [INV_GK_DISTRIBUTION.invariant_id]: INV_GK_DISTRIBUTION,
  [INV_RULES_OUT_OF_PLAY_DETECT.invariant_id]: INV_RULES_OUT_OF_PLAY_DETECT,
  [INV_RULES_OUT_OF_PLAY_NO_LAST_TOUCH.invariant_id]: INV_RULES_OUT_OF_PLAY_NO_LAST_TOUCH,
  [INV_RULES_THROW_IN_AWARD.invariant_id]: INV_RULES_THROW_IN_AWARD,
  [INV_RULES_GOAL_KICK_AWARD.invariant_id]: INV_RULES_GOAL_KICK_AWARD,
  [INV_RULES_CORNER_KICK_AWARD.invariant_id]: INV_RULES_CORNER_KICK_AWARD,
  [INV_RULES_GOAL_DETECTION.invariant_id]: INV_RULES_GOAL_DETECTION,
  [INV_RULES_KICKOFF_FREEZE.invariant_id]: INV_RULES_KICKOFF_FREEZE,
  [INV_RULES_TIMER_FREEZE.invariant_id]: INV_RULES_TIMER_FREEZE,
  [INV_RULES_THROW_IN_PLACEMENT.invariant_id]: INV_RULES_THROW_IN_PLACEMENT,
  [INV_RULES_THROW_IN_SERVE.invariant_id]: INV_RULES_THROW_IN_SERVE,
  [INV_RULES_GOAL_KICK_PLACEMENT.invariant_id]: INV_RULES_GOAL_KICK_PLACEMENT,
  [INV_RULES_GOAL_PHASE.invariant_id]: INV_RULES_GOAL_PHASE,
  [INV_RULES_KICKOFF_FIRST_TOUCH.invariant_id]: INV_RULES_KICKOFF_FIRST_TOUCH,
  [INV_RULES_THROW_IN_TIMER_FREEZE.invariant_id]: INV_RULES_THROW_IN_TIMER_FREEZE,
  [INV_RULES_GOAL_KICK_TIMER_FREEZE.invariant_id]: INV_RULES_GOAL_KICK_TIMER_FREEZE,
  [INV_RULES_TIMER_DECREMENT.invariant_id]: INV_RULES_TIMER_DECREMENT,
  [INV_RULES_TIMER_HALFTIME.invariant_id]: INV_RULES_TIMER_HALFTIME,
  [INV_RULES_TIMER_FULLTIME.invariant_id]: INV_RULES_TIMER_FULLTIME,
};

/**
 * Common-criterion → invariant_id mapping.
 * Every common criterion in the catalog must resolve to one of these.
 */
export const COMMON_CRITERION_TO_INVARIANT: Record<string, string> = {
  "COMMON-FINITE": INV_FINITE.invariant_id,
  "COMMON-DETERMINISTIC": INV_DETERMINISTIC.invariant_id,
  "COMMON-REFERENCES": INV_REFERENCES.invariant_id,
  "COMMON-BOUNDS": INV_BOUNDS.invariant_id,
};

/**
 * Get an invariant definition by id.
 */
export function getInvariantDefinition(
  id: string,
): InvariantDefinition | undefined {
  return INVARIANT_DEFINITIONS[id];
}