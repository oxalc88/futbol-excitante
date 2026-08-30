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

// ---------------------------------------------------------------------------
// duels suite criteria (PHY-SHLD-001)
// ---------------------------------------------------------------------------

/**
 * PHY-SHLD-001-CONT — outcome follows ordered contact state.
 * Class: HARD_INVARIANT.  Oracle: player-contact-evidence.
 */
export const PHY_SHLD_001_CONT: EvaluationCriterion = {
  criterion_id: "PHY-SHLD-001-CONT",
  class: "HARD_INVARIANT",
  rule: "Outcome follows ordered contact state; no possession or position teleport and no stat-only instant winner.",
};

/**
 * PHY-SHLD-001-REF — compare displacement/speed/recovery envelope.
 * Class: MEASURED_TARGET.  No reference target → BLOCKED_MISSING_REFERENCE.
 */
export const PHY_SHLD_001_REF: EvaluationCriterion = {
  criterion_id: "PHY-SHLD-001-REF",
  class: "MEASURED_TARGET",
  rule: "Compare displacement/speed/recovery envelope when populated.",
};

/**
 * PHY-SHLD-001-REG — preserve congestion, ball independence, locomotion.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const PHY_SHLD_001_REG: EvaluationCriterion = {
  criterion_id: "PHY-SHLD-001-REG",
  class: "REGRESSION",
  rule: "Preserve congestion, ball independence, and locomotion behavior.",
};

// ---------------------------------------------------------------------------
// duels suite criteria (PHY-STR, PHY-BC, PHY-PC)
// ---------------------------------------------------------------------------

/**
 * PHY-STR-001-DESIGN — physical resistance capability design target.
 * Class: ENGINE_DESIGN_TARGET.  No CapabilityDesignProfile → NOT_EVALUATED.
 */
export const PHY_STR_001_DESIGN: EvaluationCriterion = {
  criterion_id: "PHY-STR-001-DESIGN",
  class: "ENGINE_DESIGN_TARGET",
  rule: "The selected CapabilityDesignProfile must preserve independently controllable physical-contact and body-control effects.",
};

/**
 * PHY-STR-001-CAUSAL — physical resistance causal isolation.
 * Class: UNKNOWN.  No controlled capture → NOT_EVALUATED.
 */
export const PHY_STR_001_CAUSAL: EvaluationCriterion = {
  criterion_id: "PHY-STR-001-CAUSAL",
  class: "UNKNOWN",
  rule: "Engine sensitivity diagnostic only until controlled attribute isolation exists.",
};

/**
 * PHY-STR-001-REG — physical resistance regression.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const PHY_STR_001_REG: EvaluationCriterion = {
  criterion_id: "PHY-STR-001-REG",
  class: "REGRESSION",
  rule: "Distinct capability dimensions must not collapse versus best.",
};

/**
 * PHY-BC-001-DESIGN — body-control capability design target.
 * Class: ENGINE_DESIGN_TARGET.  No CapabilityDesignProfile → NOT_EVALUATED.
 */
export const PHY_BC_001_DESIGN: EvaluationCriterion = {
  criterion_id: "PHY-BC-001-DESIGN",
  class: "ENGINE_DESIGN_TARGET",
  rule: "Increasing body control must meet the versioned disturbance/recovery direction and materiality target.",
};

/**
 * PHY-BC-001-CAUSAL — body-control causal isolation.
 * Class: UNKNOWN.  No controlled capture → NOT_EVALUATED.
 */
export const PHY_BC_001_CAUSAL: EvaluationCriterion = {
  criterion_id: "PHY-BC-001-CAUSAL",
  class: "UNKNOWN",
  rule: "No PES acceptance until controlled perturbation capture exists.",
};

/**
 * PHY-BC-001-REG — body-control regression.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const PHY_BC_001_REG: EvaluationCriterion = {
  criterion_id: "PHY-BC-001-REG",
  class: "REGRESSION",
  rule: "Report sensitivity and coupling changes versus best.",
};

/**
 * PHY-PC-001-DESIGN — physical-contact capability design target.
 * Class: ENGINE_DESIGN_TARGET.  No CapabilityDesignProfile → NOT_EVALUATED.
 */
export const PHY_PC_001_DESIGN: EvaluationCriterion = {
  criterion_id: "PHY-PC-001-DESIGN",
  class: "ENGINE_DESIGN_TARGET",
  rule: "Increasing physical-contact capability must meet the versioned resistance/outcome target.",
};

/**
 * PHY-PC-001-CAUSAL — physical-contact causal isolation.
 * Class: UNKNOWN.  No controlled capture → NOT_EVALUATED.
 */
export const PHY_PC_001_CAUSAL: EvaluationCriterion = {
  criterion_id: "PHY-PC-001-CAUSAL",
  class: "UNKNOWN",
  rule: "Never use community claim as numeric or causal acceptance target.",
};

/**
 * PHY-PC-001-REG — physical-contact regression.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const PHY_PC_001_REG: EvaluationCriterion = {
  criterion_id: "PHY-PC-001-REG",
  class: "REGRESSION",
  rule: "Sensitivity must not create unrelated speed, AI, or foul regressions.",
};

// ---------------------------------------------------------------------------
// duels suite criteria (TACK-*, INT-*)
// ---------------------------------------------------------------------------

/**
 * TACK-ST-001-CAUSAL — standing tackle causal isolation.
 * Class: UNKNOWN.  Tackles not implemented → NOT_EVALUATED.
 */
export const TACK_ST_001_CAUSAL: EvaluationCriterion = {
  criterion_id: "TACK-ST-001-CAUSAL",
  class: "UNKNOWN",
  rule: "Standing tackle causal isolation diagnostic only.",
};

/**
 * TACK-ST-001-REG — standing tackle regression.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const TACK_ST_001_REG: EvaluationCriterion = {
  criterion_id: "TACK-ST-001-REG",
  class: "REGRESSION",
  rule: "Preserve standing tackle behavior versus best.",
};

/**
 * TACK-SL-001-CAUSAL — sliding tackle causal isolation.
 * Class: UNKNOWN.  Tackles not implemented → NOT_EVALUATED.
 */
export const TACK_SL_001_CAUSAL: EvaluationCriterion = {
  criterion_id: "TACK-SL-001-CAUSAL",
  class: "UNKNOWN",
  rule: "Sliding tackle causal isolation diagnostic only.",
};

/**
 * TACK-SL-001-REG — sliding tackle regression.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const TACK_SL_001_REG: EvaluationCriterion = {
  criterion_id: "TACK-SL-001-REG",
  class: "REGRESSION",
  rule: "Preserve sliding tackle behavior versus best.",
};

/**
 * TACK-ST-001-PHASE — standing tackle ordered-phase invariant.
 * Class: HARD_INVARIANT.
 *
 * Executable through the protected `tackle-phase-evidence-standing` oracle:
 * every standing attempt must show ordered prepare → active → recover phases,
 * contact only inside the explicit active window, finite reach, a recovery
 * lock-out that blocks an instant re-tackle, and velocity-only (never
 * position-assigning) effects. A run with two or more players and no standing
 * tackle evidence FAILS — it is never silently NOT_EVALUATED.
 */
export const TACK_ST_001_PHASE: EvaluationCriterion = {
  criterion_id: "TACK-ST-001-PHASE",
  class: "HARD_INVARIANT",
  rule:
    "Standing tackles execute ordered prepare→active→recover phases with finite " +
    "reach; contact is eligible only inside the explicit active window; recovery " +
    "blocks an instant re-tackle; no entity is teleported.",
};

/**
 * TACK-SL-001-PHASE — sliding tackle ordered-phase invariant.
 * Class: HARD_INVARIANT.
 *
 * Same executable contract as TACK-ST-001-PHASE for the sliding action,
 * through the protected `tackle-phase-evidence-slide` oracle.
 */
export const TACK_SL_001_PHASE: EvaluationCriterion = {
  criterion_id: "TACK-SL-001-PHASE",
  class: "HARD_INVARIANT",
  rule:
    "Sliding tackles execute ordered prepare→active→recover phases with finite " +
    "reach; contact is eligible only inside the explicit active window; recovery " +
    "blocks an instant re-tackle; no entity is teleported.",
};

/**
 * TACK-ANG-001-CAUSAL — tackle angle causal isolation.
 * Class: UNKNOWN.  Tackles not implemented → NOT_EVALUATED.
 */
export const TACK_ANG_001_CAUSAL: EvaluationCriterion = {
  criterion_id: "TACK-ANG-001-CAUSAL",
  class: "UNKNOWN",
  rule: "Tackle angle causal isolation diagnostic only.",
};

/**
 * TACK-ANG-001-REG — tackle angle regression.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const TACK_ANG_001_REG: EvaluationCriterion = {
  criterion_id: "TACK-ANG-001-REG",
  class: "REGRESSION",
  rule: "Preserve tackle angle behavior versus best.",
};

/**
 * INT-PASS-001-CAUSAL — intercept pass causal isolation.
 * Class: UNKNOWN.  Intercepts not implemented → NOT_EVALUATED.
 */
export const INT_PASS_001_CAUSAL: EvaluationCriterion = {
  criterion_id: "INT-PASS-001-CAUSAL",
  class: "UNKNOWN",
  rule: "Intercept pass causal isolation diagnostic only.",
};

/**
 * INT-PASS-001-REG — intercept pass regression.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const INT_PASS_001_REG: EvaluationCriterion = {
  criterion_id: "INT-PASS-001-REG",
  class: "REGRESSION",
  rule: "Preserve intercept pass behavior versus best.",
};

/**
 * INT-FAST-001-CAUSAL — fast intercept causal isolation.
 * Class: UNKNOWN.  Intercepts not implemented → NOT_EVALUATED.
 */
export const INT_FAST_001_CAUSAL: EvaluationCriterion = {
  criterion_id: "INT-FAST-001-CAUSAL",
  class: "UNKNOWN",
  rule: "Fast intercept causal isolation diagnostic only.",
};

/**
 * INT-FAST-001-REG — fast intercept regression.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const INT_FAST_001_REG: EvaluationCriterion = {
  criterion_id: "INT-FAST-001-REG",
  class: "REGRESSION",
  rule: "Preserve fast intercept behavior versus best.",
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

  // duels suite criteria
  [PHY_SHLD_001_CONT.criterion_id]: PHY_SHLD_001_CONT,
  [PHY_SHLD_001_REF.criterion_id]: PHY_SHLD_001_REF,
  [PHY_SHLD_001_REG.criterion_id]: PHY_SHLD_001_REG,
  [PHY_STR_001_DESIGN.criterion_id]: PHY_STR_001_DESIGN,
  [PHY_STR_001_CAUSAL.criterion_id]: PHY_STR_001_CAUSAL,
  [PHY_STR_001_REG.criterion_id]: PHY_STR_001_REG,
  [PHY_BC_001_DESIGN.criterion_id]: PHY_BC_001_DESIGN,
  [PHY_BC_001_CAUSAL.criterion_id]: PHY_BC_001_CAUSAL,
  [PHY_BC_001_REG.criterion_id]: PHY_BC_001_REG,
  [PHY_PC_001_DESIGN.criterion_id]: PHY_PC_001_DESIGN,
  [PHY_PC_001_CAUSAL.criterion_id]: PHY_PC_001_CAUSAL,
  [PHY_PC_001_REG.criterion_id]: PHY_PC_001_REG,
  [TACK_ST_001_CAUSAL.criterion_id]: TACK_ST_001_CAUSAL,
  [TACK_ST_001_REG.criterion_id]: TACK_ST_001_REG,
  [TACK_ST_001_PHASE.criterion_id]: TACK_ST_001_PHASE,
  [TACK_SL_001_CAUSAL.criterion_id]: TACK_SL_001_CAUSAL,
  [TACK_SL_001_REG.criterion_id]: TACK_SL_001_REG,
  [TACK_SL_001_PHASE.criterion_id]: TACK_SL_001_PHASE,
  [TACK_ANG_001_CAUSAL.criterion_id]: TACK_ANG_001_CAUSAL,
  [TACK_ANG_001_REG.criterion_id]: TACK_ANG_001_REG,
  [INT_PASS_001_CAUSAL.criterion_id]: INT_PASS_001_CAUSAL,
  [INT_PASS_001_REG.criterion_id]: INT_PASS_001_REG,
  [INT_FAST_001_CAUSAL.criterion_id]: INT_FAST_001_CAUSAL,
  [INT_FAST_001_REG.criterion_id]: INT_FAST_001_REG,
};

/**
 * Get a common criterion by id.
 */
export function getCommonCriterion(id: string): EvaluationCriterion | undefined {
  return COMMON_CRITERIA[id];
}