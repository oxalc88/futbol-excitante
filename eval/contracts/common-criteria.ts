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

/**
 * BALL-IND-001-CONT — ball position must not teleport between ticks.
 * Class: HARD_INVARIANT.
 */
export const BALL_IND_001_CONT: EvaluationCriterion = {
  criterion_id: "BALL-IND-001-CONT",
  class: "HARD_INVARIANT",
  rule: "Ball displacement between consecutive ticks must not exceed the configured continuity bound.",
};

/**
 * BALL-IND-001-POSS — ball possession changes must be backed by touch evidence.
 * Class: HARD_INVARIANT.
 */
export const BALL_IND_001_POSS: EvaluationCriterion = {
  criterion_id: "BALL-IND-001-POSS",
  class: "HARD_INVARIANT",
  rule: "Ball lastTouchRef changes must correspond to a touch event in the current tick.",
};

/**
 * BALL-GND-001-CONTACT — ball ground contact events must be continuous.
 * Class: HARD_INVARIANT.
 */
export const BALL_GND_001_CONTACT: EvaluationCriterion = {
  criterion_id: "BALL-GND-001-CONTACT",
  class: "HARD_INVARIANT",
  rule: "Ball ground-contact state must not exhibit discontinuous transitions.",
};

/**
 * BALL-SPD-001-REF — ball speed envelope comparison against measured reference.
 * Class: MEASURED_TARGET.  (No reference target exists yet at bootstrap.)
 */
export const BALL_SPD_001_REF: EvaluationCriterion = {
  criterion_id: "BALL-SPD-001-REF",
  class: "MEASURED_TARGET",
  rule: "Ball speed trajectory must fall within the versioned reference envelope.",
};

/**
 * LOC-BALL-001-FREE — player must not make unexpected contact with the ball.
 * Class: HARD_INVARIANT.
 */
export const LOC_BALL_001_FREE: EvaluationCriterion = {
  criterion_id: "LOC-BALL-001-FREE",
  class: "HARD_INVARIANT",
  rule: "Ball position relative to player must not exhibit unexpected contact transitions.",
};

/**
 * TOUCH-SLOW-001-CONTACT — first touch is an explicit feasible contact on an independent ball, not a possession toggle.
 * Class: HARD_INVARIANT (spec §7.3).
 */
export const TOUCH_SLOW_001_CONTACT: EvaluationCriterion = {
  criterion_id: "TOUCH-SLOW-001-CONTACT",
  class: "HARD_INVARIANT",
  rule: "First touch is an explicit feasible contact on an independent ball, not a possession toggle.",
};

/**
 * PASS-LOW-001-IMPULSE — pass resolves one recorded contact/impulse; it never moves the ball toward a target after release.
 * Class: HARD_INVARIANT (spec §7.3).
 */
export const PASS_LOW_001_IMPULSE: EvaluationCriterion = {
  criterion_id: "PASS-LOW-001-IMPULSE",
  class: "HARD_INVARIANT",
  rule: "Pass resolves one recorded contact/impulse; it never moves the ball toward a target after release.",
};

/**
 * PASS-LOFT-001-IMPULSE — one canonical action contact creates the ball state; no guided arc after release.
 * Class: HARD_INVARIANT (spec §7.3).
 */
export const PASS_LOFT_001_IMPULSE: EvaluationCriterion = {
  criterion_id: "PASS-LOFT-001-IMPULSE",
  class: "HARD_INVARIANT",
  rule: "One canonical action contact creates the ball state; no guided arc after release.",
};

/**
 * SHOT-PWR-001-IMPULSE — shot is an explicit contact impulse plus spin/error, never a guided outcome.
 * Class: HARD_INVARIANT (spec §7.3).
 */
export const SHOT_PWR_001_IMPULSE: EvaluationCriterion = {
  criterion_id: "SHOT-PWR-001-IMPULSE",
  class: "HARD_INVARIANT",
  rule: "Shot is an explicit contact impulse plus spin/error, never a guided outcome.",
};

/**
 * HEAD-FREE-001-HEAD — header trajectory must follow gravity without player guidance.
 * Class: HARD_INVARIANT.  Oracle not yet implemented; see HEAD-DUEL-001 scope.
 */
export const HEAD_FREE_001_HEAD: EvaluationCriterion = {
  criterion_id: "HEAD-FREE-001-HEAD",
  class: "HARD_INVARIANT",
  rule: "Header must produce a gravity-only arc after head-ball contact.",
};

/**
 * TOUCH-WF-001-WEAKFOOT — weak-foot pass must follow correct physics, not a guided arc.
 * Class: HARD_INVARIANT.  Weak-foot oracle not yet implemented.
 */
export const TOUCH_WF_001_WEAKFOOT: EvaluationCriterion = {
  criterion_id: "TOUCH-WF-001-WEAKFOOT",
  class: "HARD_INVARIANT",
  rule: "Weak-foot pass must not be guided after contact.",
};

/**
 * SHOT-SWV-001-CURVE — shot trajectory must include spin-induced deviation from straight line.
 * Class: HARD_INVARIANT.  Curve oracle not yet implemented.
 */
export const SHOT_SWV_001_CURVE: EvaluationCriterion = {
  criterion_id: "SHOT-SWV-001-CURVE",
  class: "HARD_INVARIANT",
  rule: "Shot must exhibit spin-induced curve, not a purely ballistic trajectory.",
};

/**
 * CROSS-HI-001-TRAJECTORY — cross delivery must follow high-arcing trajectory to target area.
 * Class: HARD_INVARIANT.  Cross trajectory oracle not yet implemented.
 */
export const CROSS_HI_001_TRAJECTORY: EvaluationCriterion = {
  criterion_id: "CROSS-HI-001-TRAJECTORY",
  class: "HARD_INVARIANT",
  rule: "Cross delivery must reach target area via high arc.",
};

/** All common criteria keyed by criterion_id. */
export const COMMON_CRITERIA: Record<string, EvaluationCriterion> = {
  [COMMON_FINITE.criterion_id]: COMMON_FINITE,
  [COMMON_DETERMINISTIC.criterion_id]: COMMON_DETERMINISTIC,
  [COMMON_REFERENCES.criterion_id]: COMMON_REFERENCES,
  [COMMON_BOUNDS.criterion_id]: COMMON_BOUNDS,
  [COMMON_REGRESSION.criterion_id]: COMMON_REGRESSION,
  [BALL_IND_001_CONT.criterion_id]: BALL_IND_001_CONT,
  [BALL_IND_001_POSS.criterion_id]: BALL_IND_001_POSS,
  [BALL_GND_001_CONTACT.criterion_id]: BALL_GND_001_CONTACT,
  [BALL_SPD_001_REF.criterion_id]: BALL_SPD_001_REF,
  [LOC_BALL_001_FREE.criterion_id]: LOC_BALL_001_FREE,

  // touch_and_actions HARD_INVARIANT criteria
  [TOUCH_SLOW_001_CONTACT.criterion_id]: TOUCH_SLOW_001_CONTACT,
  [PASS_LOW_001_IMPULSE.criterion_id]: PASS_LOW_001_IMPULSE,
  [PASS_LOFT_001_IMPULSE.criterion_id]: PASS_LOFT_001_IMPULSE,
  [SHOT_PWR_001_IMPULSE.criterion_id]: SHOT_PWR_001_IMPULSE,
  // Placeholder criteria — no oracle implemented yet; yield NOT_EVALUATED.
  [HEAD_FREE_001_HEAD.criterion_id]: HEAD_FREE_001_HEAD,
  [TOUCH_WF_001_WEAKFOOT.criterion_id]: TOUCH_WF_001_WEAKFOOT,
  [SHOT_SWV_001_CURVE.criterion_id]: SHOT_SWV_001_CURVE,
  [CROSS_HI_001_TRAJECTORY.criterion_id]: CROSS_HI_001_TRAJECTORY,
  // PHY-SHLD-001-CONT removed — duel/shielding is out of scope.
};

/**
 * Get a common criterion by id.
 */
export function getCommonCriterion(id: string): EvaluationCriterion | undefined {
  return COMMON_CRITERIA[id];
}