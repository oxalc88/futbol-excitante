/**
 * @module @pes/eval/contracts/common-criteria
 *
 * Common criterion definitions from spec §4.1.
 *
 * Every catalog test inherits these unless the scenario declares
 * documented non-applicability.  Each criterion maps to an
 * invariant definition in invariant-definitions.ts.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { EvaluationCriterion } from "./types.js";

/**
 * COMMON-FINITE — every numeric field is finite.
 * Class: HARD_INVARIANT.
 */
export const COMMON_FINITE: EvaluationCriterion = {
  criterion_id: "COMMON-FINITE",
  class: "HARD_INVARIANT",
  rule: "No canonical numeric field is NaN or Infinity at any observed tick.",
};

/**
 * COMMON-DETERMINISTIC — two identical pinned runs produce identical hashes.
 * Class: HARD_INVARIANT.
 */
export const COMMON_DETERMINISTIC: EvaluationCriterion = {
  criterion_id: "COMMON-DETERMINISTIC",
  class: "HARD_INVARIANT",
  rule: "Two runs with the same pinned run contract have identical state hashes at every tick.",
};

/**
 * COMMON-REFERENCES — all stable IDs and event/state references resolve.
 * Class: HARD_INVARIANT.
 */
export const COMMON_REFERENCES: EvaluationCriterion = {
  criterion_id: "COMMON-REFERENCES",
  class: "HARD_INVARIANT",
  rule: "All stable IDs and event/state references resolve and ordered events remain canonically ordered.",
};

/**
 * COMMON-BOUNDS — configured hard world bounds and scenario-declared legal bounds are respected.
 * Class: HARD_INVARIANT.
 */
export const COMMON_BOUNDS: EvaluationCriterion = {
  criterion_id: "COMMON-BOUNDS",
  class: "HARD_INVARIANT",
  rule: "Configured hard world bounds and scenario-declared legal state bounds are respected.",
};

/**
 * COMMON-REGRESSION — candidate vs best preservation.
 * Class: REGRESSION.  (Not a HARD_INVARIANT — used by the regression family.)
 */
export const COMMON_REGRESSION: EvaluationCriterion = {
  criterion_id: "COMMON-REGRESSION",
  class: "REGRESSION",
  rule: "Compare all declared dependency metrics and pathologies with the immutable best run; gate only with a versioned materiality policy.",
};

/** All common criteria keyed by criterion_id. */
export const COMMON_CRITERIA: Record<string, EvaluationCriterion> = {
  [COMMON_FINITE.criterion_id]: COMMON_FINITE,
  [COMMON_DETERMINISTIC.criterion_id]: COMMON_DETERMINISTIC,
  [COMMON_REFERENCES.criterion_id]: COMMON_REFERENCES,
  [COMMON_BOUNDS.criterion_id]: COMMON_BOUNDS,
  [COMMON_REGRESSION.criterion_id]: COMMON_REGRESSION,
};

/**
 * Get a common criterion by id.
 */
export function getCommonCriterion(id: string): EvaluationCriterion | undefined {
  return COMMON_CRITERIA[id];
}