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
// Each invariant is declared here as contract data.  No keeper oracle is
// registered yet, so the corresponding criteria evaluate to NOT_EVALUATED
// (honest "not yet observable") rather than claiming PASS on gameplay.
// ---------------------------------------------------------------------------

/**
 * GK role-designation evidence: exactly one designated keeper per team.
 * oracle_id is not registered → criterion yields NOT_EVALUATED.
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
 * oracle_id is not registered → criterion yields NOT_EVALUATED.
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
 * oracle_id is not registered → criterion yields NOT_EVALUATED.
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
 * oracle_id is not registered → criterion yields NOT_EVALUATED.
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
 * oracle_id is not registered → criterion yields NOT_EVALUATED.
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