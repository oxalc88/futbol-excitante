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

/** All registered invariant definitions keyed by invariant_id. */
export const INVARIANT_DEFINITIONS: Record<string, InvariantDefinition> = {
  [INV_FINITE.invariant_id]: INV_FINITE,
  [INV_DETERMINISTIC.invariant_id]: INV_DETERMINISTIC,
  [INV_REFERENCES.invariant_id]: INV_REFERENCES,
  [INV_BOUNDS.invariant_id]: INV_BOUNDS,
  [INV_BALL_CONTINUITY.invariant_id]: INV_BALL_CONTINUITY,
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