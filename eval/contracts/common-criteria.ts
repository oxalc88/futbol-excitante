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

// ---------------------------------------------------------------------------
// goalkeepers suite criteria — GAMEPLAY_EVALUATION_SPEC §7.4
// ---------------------------------------------------------------------------

/**
 * GK-REA-001-REF — compare apparent keeper response sequence to a shot.
 * Class: MEASURED_TARGET.  No reference target → BLOCKED_MISSING_REFERENCE.
 */
export const GK_REA_001_REF: EvaluationCriterion = {
  criterion_id: "GK-REA-001-REF",
  class: "MEASURED_TARGET",
  rule: "Compare apparent response sequence; never label it pure AI reaction time without perception evidence.",
};

/**
 * GK-REA-001-VIS — keeper pose/action transition plausibility.
 * Class: PERCEPTUAL_TARGET.  No versioned rubric → NEEDS_PERCEPTUAL_REVIEW.
 */
export const GK_REA_001_VIS: EvaluationCriterion = {
  criterion_id: "GK-REA-001-VIS",
  class: "PERCEPTUAL_TARGET",
  rule: "Keeper pose/action transition and contact plausibility require a versioned browser rubric.",
};

/**
 * GK-REA-001-REG — preserve wrong-foot, leg-save, and recovery behavior.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const GK_REA_001_REG: EvaluationCriterion = {
  criterion_id: "GK-REA-001-REG",
  class: "REGRESSION",
  rule: "Preserve wrong-foot, leg-save, and recovery behavior.",
};

/**
 * GK-WF-001-CAUSAL — wrong-foot correction curve.
 * Class: UNKNOWN.  No controlled capture → NOT_EVALUATED.
 */
export const GK_WF_001_CAUSAL: EvaluationCriterion = {
  criterion_id: "GK-WF-001-CAUSAL",
  class: "UNKNOWN",
  rule: "No PES correction threshold/curve until controlled capture.",
};

/**
 * GK-WF-001-VIS — weight-shift/reversal plausibility check.
 * Class: PERCEPTUAL_TARGET.  No rubric → NEEDS_PERCEPTUAL_REVIEW.
 */
export const GK_WF_001_VIS: EvaluationCriterion = {
  criterion_id: "GK-WF-001-VIS",
  class: "PERCEPTUAL_TARGET",
  rule: "Browser diagnostic checks weight-shift/reversal plausibility; no pass gate until rubric validation.",
};

/**
 * GK-WF-001-REG — preserve ordinary reaction and reach.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const GK_WF_001_REG: EvaluationCriterion = {
  criterion_id: "GK-WF-001-REG",
  class: "REGRESSION",
  rule: "Preserve ordinary reaction and reach.",
};

/**
 * GK-LEG-001-CONTACT — save outcome requires an ordered feasible contact event.
 * Class: HARD_INVARIANT.  Keeper subsystem not implemented → NOT_EVALUATED.
 */
export const GK_LEG_001_CONTACT: EvaluationCriterion = {
  criterion_id: "GK-LEG-001-CONTACT",
  class: "HARD_INVARIANT",
  rule: "Save outcome requires an ordered feasible leg/foot contact event and continuous rebound.",
};

/**
 * GK-LEG-001-REF — compare contact/rebound observables.
 * Class: MEASURED_TARGET → BLOCKED_MISSING_REFERENCE.
 */
export const GK_LEG_001_REF: EvaluationCriterion = {
  criterion_id: "GK-LEG-001-REF",
  class: "MEASURED_TARGET",
  rule: "Compare contact/rebound observables when a reference target exists.",
};

/**
 * GK-LEG-001-VIS — rendered limb and ball contact agree with event.
 * Class: PERCEPTUAL_TARGET.  No rubric → NEEDS_PERCEPTUAL_REVIEW.
 */
export const GK_LEG_001_VIS: EvaluationCriterion = {
  criterion_id: "GK-LEG-001-VIS",
  class: "PERCEPTUAL_TARGET",
  rule: "Rendered limb and ball contact agree with the canonical event; rubric required.",
};

/**
 * GK-LEG-001-REG — preserve reaction, parry, and recovery.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const GK_LEG_001_REG: EvaluationCriterion = {
  criterion_id: "GK-LEG-001-REG",
  class: "REGRESSION",
  rule: "Preserve reaction, parry, and recovery.",
};

/**
 * GK-PARRY-001-CONTACT — parry is an explicit surface contact.
 * Class: HARD_INVARIANT.  Keeper subsystem not implemented → NOT_EVALUATED.
 */
export const GK_PARRY_001_CONTACT: EvaluationCriterion = {
  criterion_id: "GK-PARRY-001-CONTACT",
  class: "HARD_INVARIANT",
  rule: "Parry is an explicit surface contact; outgoing state and any skill correction are inspectable.",
};

/**
 * GK-PARRY-001-REF — surface-conditioned rebound comparison.
 * Class: MEASURED_TARGET → BLOCKED_MISSING_REFERENCE.
 */
export const GK_PARRY_001_REF: EvaluationCriterion = {
  criterion_id: "GK-PARRY-001-REF",
  class: "MEASURED_TARGET",
  rule: "Compare surface-conditioned rebound observables with uncertainty when populated.",
};

/**
 * GK-PARRY-001-VIS — contacted surface and rebound continuity.
 * Class: PERCEPTUAL_TARGET.  No rubric → NEEDS_PERCEPTUAL_REVIEW.
 */
export const GK_PARRY_001_VIS: EvaluationCriterion = {
  criterion_id: "GK-PARRY-001-VIS",
  class: "PERCEPTUAL_TARGET",
  rule: "Browser frame strip validates contacted surface and rebound continuity.",
};

/**
 * GK-PARRY-001-REG — preserve ball continuity and keeper recovery.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const GK_PARRY_001_REG: EvaluationCriterion = {
  criterion_id: "GK-PARRY-001-REG",
  class: "REGRESSION",
  rule: "Preserve ball continuity and keeper recovery.",
};

/**
 * GK-REC-001-REF — phase-timing comparison.
 * Class: MEASURED_TARGET → BLOCKED_MISSING_REFERENCE.
 */
export const GK_REC_001_REF: EvaluationCriterion = {
  criterion_id: "GK-REC-001-REF",
  class: "MEASURED_TARGET",
  rule: "Compare phase timing distributions under equivalent observable initial states.",
};

/**
 * GK-REC-001-VIS — grounded/recovery transition plausibility.
 * Class: PERCEPTUAL_TARGET.  No rubric → NEEDS_PERCEPTUAL_REVIEW.
 */
export const GK_REC_001_VIS: EvaluationCriterion = {
  criterion_id: "GK-REC-001-VIS",
  class: "PERCEPTUAL_TARGET",
  rule: "Rendered grounded/recovery transition and second contact require rubric review.",
};

/**
 * GK-REC-001-REG — preserve first-save contact/rebound behavior.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const GK_REC_001_REG: EvaluationCriterion = {
  criterion_id: "GK-REC-001-REG",
  class: "REGRESSION",
  rule: "Preserve first-save contact/rebound behavior.",
};

/**
 * GK-HIGH-001-REACH — claim/parry requires a feasible recorded reach/contact.
 * Class: HARD_INVARIANT.  Keeper subsystem not implemented → NOT_EVALUATED.
 */
export const GK_HIGH_001_REACH: EvaluationCriterion = {
  criterion_id: "GK-HIGH-001-REACH",
  class: "HARD_INVARIANT",
  rule: "Claim/parry requires a feasible recorded reach/contact; catch state never teleports the ball.",
};

/**
 * GK-HIGH-001-REF — timing/contact/outcome distribution.
 * Class: MEASURED_TARGET → BLOCKED_MISSING_REFERENCE.
 */
export const GK_HIGH_001_REF: EvaluationCriterion = {
  criterion_id: "GK-HIGH-001-REF",
  class: "MEASURED_TARGET",
  rule: "Compare timing/contact/outcome distribution with stated aerial uncertainty.",
};

/**
 * GK-HIGH-001-VIS — aerial pose/contact/congestion continuity.
 * Class: PERCEPTUAL_TARGET.  No rubric → NEEDS_PERCEPTUAL_REVIEW.
 */
export const GK_HIGH_001_VIS: EvaluationCriterion = {
  criterion_id: "GK-HIGH-001-VIS",
  class: "PERCEPTUAL_TARGET",
  rule: "Browser review validates aerial pose, contact, and congestion continuity.",
};

/**
 * GK-HIGH-001-REG — preserve crosses, headers, and keeper ground actions.
 * Class: REGRESSION.  No policy → NOT_EVALUATED.
 */
export const GK_HIGH_001_REG: EvaluationCriterion = {
  criterion_id: "GK-HIGH-001-REG",
  class: "REGRESSION",
  rule: "Preserve crosses, headers, and keeper ground actions.",
};

// ---------------------------------------------------------------------------
// goalkeepers suite criteria — small-sided GK behavior (specs/GOALKEEPER_SPEC.md)
// ---------------------------------------------------------------------------

/**
 * GK-ROLE-DESIGNATION — exactly one designated keeper per team in small-sided play.
 * Class: HARD_INVARIANT.  Keeper role not implemented → NOT_EVALUATED.
 */
export const GK_ROLE_DESIGNATION: EvaluationCriterion = {
  criterion_id: "GK-ROLE-DESIGNATION",
  class: "HARD_INVARIANT",
  rule:
    "In a small-sided match exactly one player per team is the designated keeper; the " +
    "keeper role is distinct from outfield roles and must not be substituted by an outfield body.",
};

/**
 * GK-POSITIONING-HOLD — keeper holds its goal arc with bounded lateral drift.
 * Class: HARD_INVARIANT.  No keeper positioning oracle → NOT_EVALUATED.
 */
export const GK_POSITIONING_HOLD: EvaluationCriterion = {
  criterion_id: "GK-POSITIONING-HOLD",
  class: "HARD_INVARIANT",
  rule:
    "The designated keeper remains on the configured goal arc and within the versioned " +
    "bounded lateral drift; it never leaves the arc to chase into the field.",
};

/**
 * GK-NO-FIELD-CHASE — keeper never joins the field chase (anti-huddle contract inherited).
 * Class: HARD_INVARIANT.  No keeper chase oracle → NOT_EVALUATED.
 */
export const GK_NO_FIELD_CHASE: EvaluationCriterion = {
  criterion_id: "GK-NO-FIELD-CHASE",
  class: "HARD_INVARIANT",
  rule:
    "The designated keeper never chases the ball into the field beyond its goal arc; " +
    "this inherits the accepted small-sided anti-huddle contract.",
};

/**
 * GK-SAVE-CLAIM — a keeper save/claim is an explicit recorded contact on the ball.
 * Class: HARD_INVARIANT.  No keeper contact oracle → NOT_EVALUATED.
 */
export const GK_SAVE_CLAIM: EvaluationCriterion = {
  criterion_id: "GK-SAVE-CLAIM",
  class: "HARD_INVARIANT",
  rule:
    "A keeper save/claim on a shot on target is an explicit recorded contact on the " +
    "independent ball; the ball is never parented or teleported into keeper possession.",
};

/**
 * GK-DISTRIBUTION-NO-OMNISCIENCE — keeper release uses only modelled information.
 * Class: ENGINE_DESIGN_TARGET.  No CapabilityDesignProfile → NOT_EVALUATED.
 */
export const GK_DISTRIBUTION_NO_OMNISCIENCE: EvaluationCriterion = {
  criterion_id: "GK-DISTRIBUTION-NO-OMNISCIENCE",
  class: "ENGINE_DESIGN_TARGET",
  rule:
    "A keeper release may reach a teammate through normal pass semantics and is not " +
    "guided by omniscient target selection beyond the keeper's modelled information.",
};

// ---------------------------------------------------------------------------
// rules suite criteria — MATCH_RULES_SPEC §15
// ---------------------------------------------------------------------------

/**
 * MATCH-OUT-OF-PLAY-DETECT — the swept-line boundary test emits the correct
 * `goal` / `ball-out-of-play` / `ball-touchline-out-of-play` event.
 * Class: HARD_INVARIANT.  Oracle: rules-out-of-play-detect-oracle-v1.
 */
export const MATCH_OUT_OF_PLAY_DETECT: EvaluationCriterion = {
  criterion_id: "MATCH-OUT-OF-PLAY-DETECT",
  class: "HARD_INVARIANT",
  rule:
    "A boundary crossing produces exactly one of goal / ball-out-of-play / " +
    "ball-touchline-out-of-play with the correct boundary payload; goal and " +
    "goal-line out-of-play are mutually exclusive.",
};

/**
 * MATCH-OUT-OF-PLAY-NO-LAST-TOUCH — null / unresolvable lastTouchRef → no restart.
 * Class: HARD_INVARIANT.  Oracle: rules-out-of-play-no-last-touch-oracle-v1.
 */
export const MATCH_OUT_OF_PLAY_NO_LAST_TOUCH: EvaluationCriterion = {
  criterion_id: "MATCH-OUT-OF-PLAY-NO-LAST-TOUCH",
  class: "HARD_INVARIANT",
  rule:
    "A boundary crossing whose lastTouchRef is null (or does not resolve to a " +
    "team) opens no restart phase; play continues as playing.",
};

/**
 * MATCH-THROW-IN-AWARD — throw-in awarded to the opposite of the last-touch team.
 * Class: HARD_INVARIANT.  Oracle: rules-throw-in-award-oracle-v1.
 */
export const MATCH_THROW_IN_AWARD: EvaluationCriterion = {
  criterion_id: "MATCH-THROW-IN-AWARD",
  class: "HARD_INVARIANT",
  rule:
    "A throw-in is awarded to the team opposite whoever last touched the ball; " +
    "the executed throw-in's team matches that award.",
};

/**
 * MATCH-THROW-IN-PLACEMENT — ball placed at the touchline exit point.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_THROW_IN_PLACEMENT: EvaluationCriterion = {
  criterion_id: "MATCH-THROW-IN-PLACEMENT",
  class: "HARD_INVARIANT",
  rule:
    "The throw-in serve is placed at the exact touchline exit point where the " +
    "ball left play.",
};

/**
 * MATCH-THROW-IN-SERVE — chest-height throw into play toward the receiver.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED (serve physics reference
 * is BLOCKED_MISSING_REFERENCE per §14).
 */
export const MATCH_THROW_IN_SERVE: EvaluationCriterion = {
  criterion_id: "MATCH-THROW-IN-SERVE",
  class: "HARD_INVARIANT",
  rule:
    "The throw-in is served at chest height toward the nearest awarding-team " +
    "receiver and into play.",
};

/**
 * MATCH-THROW-IN-TIMER-FREEZE — timer frozen during the throw-in phase.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_THROW_IN_TIMER_FREEZE: EvaluationCriterion = {
  criterion_id: "MATCH-THROW-IN-TIMER-FREEZE",
  class: "HARD_INVARIANT",
  rule: "The match timer is frozen during the throw-in phase.",
};

/**
 * MATCH-GOAL-KICK-AWARD — goal kick to the defending team of the exited goal line.
 * Class: HARD_INVARIANT.  Oracle: rules-goal-kick-award-oracle-v1.
 */
export const MATCH_GOAL_KICK_AWARD: EvaluationCriterion = {
  criterion_id: "MATCH-GOAL-KICK-AWARD",
  class: "HARD_INVARIANT",
  rule:
    "When the last-touch team is not the defending team of the exited goal " +
    "line, a goal kick is awarded to the defending team.",
};

/**
 * MATCH-GOAL-KICK-PLACEMENT — ball placed inside the goal area on the exit side.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_GOAL_KICK_PLACEMENT: EvaluationCriterion = {
  criterion_id: "MATCH-GOAL-KICK-PLACEMENT",
  class: "HARD_INVARIANT",
  rule:
    "The goal kick is placed inside the goal area (x = ±(52.5−5.5), y clamped " +
    "to the goal-area half-width, preserving the exit y sign).",
};

/**
 * MATCH-GOAL-KICK-DISTRIBUTION — upfield distribution to the nearest receiver.
 * Class: MEASURED_TARGET → BLOCKED_MISSING_REFERENCE (§14 goal_kick_distribution_ref).
 */
export const MATCH_GOAL_KICK_DISTRIBUTION: EvaluationCriterion = {
  criterion_id: "MATCH-GOAL-KICK-DISTRIBUTION",
  class: "MEASURED_TARGET",
  rule: "Upfield distribution to the nearest receiver; reference is blocked (§14).",
};

/**
 * MATCH-GOAL-KICK-TIMER-FREEZE — timer frozen during the goal-kick phase.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_GOAL_KICK_TIMER_FREEZE: EvaluationCriterion = {
  criterion_id: "MATCH-GOAL-KICK-TIMER-FREEZE",
  class: "HARD_INVARIANT",
  rule: "The match timer is frozen during the goal-kick phase.",
};

/**
 * MATCH-CORNER-KICK-AWARD — corner kick when the last touch is the defending team.
 * Class: HARD_INVARIANT.  Oracle: rules-corner-kick-award-oracle-v1.
 */
export const MATCH_CORNER_KICK_AWARD: EvaluationCriterion = {
  criterion_id: "MATCH-CORNER-KICK-AWARD",
  class: "HARD_INVARIANT",
  rule:
    "When the last-touch team is the defending team of the exited goal line, a " +
    "corner kick is awarded to the attacking team.",
};

/**
 * MATCH-CORNER-KICK-PLACEMENT — ball placed at the nearest corner flag.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_CORNER_KICK_PLACEMENT: EvaluationCriterion = {
  criterion_id: "MATCH-CORNER-KICK-PLACEMENT",
  class: "HARD_INVARIANT",
  rule:
    "The corner kick is placed at the nearest corner flag (goalX, ±34) chosen by " +
    "the sign of the ball's exit y.",
};

/**
 * MATCH-CORNER-KICK-CROSS — lofted cross into the penalty area.
 * Class: MEASURED_TARGET → BLOCKED_MISSING_REFERENCE (§14 corner_cross_trajectory_ref).
 */
export const MATCH_CORNER_KICK_CROSS: EvaluationCriterion = {
  criterion_id: "MATCH-CORNER-KICK-CROSS",
  class: "MEASURED_TARGET",
  rule: "Lofted cross into the penalty area; reference is blocked (§14).",
};

/**
 * MATCH-CORNER-KICK-TIMER-FREEZE — timer frozen during the corner-kick phase.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_CORNER_KICK_TIMER_FREEZE: EvaluationCriterion = {
  criterion_id: "MATCH-CORNER-KICK-TIMER-FREEZE",
  class: "HARD_INVARIANT",
  rule: "The match timer is frozen during the corner-kick phase.",
};

/**
 * MATCH-KICKOFF-FREEZE — while the kickoff ball is untouched every non-taker is
 * held at its window anchor.
 * Class: HARD_INVARIANT.  Oracle: rules-kickoff-freeze-oracle-v1.
 */
export const MATCH_KICKOFF_FREEZE: EvaluationCriterion = {
  criterion_id: "MATCH-KICKOFF-FREEZE",
  class: "HARD_INVARIANT",
  rule:
    "While the kickoff / post-goal / halftime restart ball is untouched, every " +
    "non-taker body is held at its window anchor; only the designated taker " +
    "closes distance.",
};

/**
 * MATCH-KICKOFF-FIRST-TOUCH — the restart window closes on the first touch.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_KICKOFF_FIRST_TOUCH: EvaluationCriterion = {
  criterion_id: "MATCH-KICKOFF-FIRST-TOUCH",
  class: "HARD_INVARIANT",
  rule:
    "The restart window closes when the restarted ball is first touched; only the " +
    "taker may break the freeze.",
};

/**
 * MATCH-RESTART-REARM — post-goal / halftime reset re-arms the restart window.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_RESTART_REARM: EvaluationCriterion = {
  criterion_id: "MATCH-RESTART-REARM",
  class: "HARD_INVARIANT",
  rule:
    "A post-goal / halftime reset re-arms the restart window keyed to the " +
    "carried-through touch reference.",
};

/**
 * MATCH-SCORING-GOAL-DEVENT — a goal event fires exactly on the goal-mouth crossing.
 * Class: HARD_INVARIANT.  Oracle: rules-goal-detection-oracle-v1.
 */
export const MATCH_SCORING_GOAL_DEVENT: EvaluationCriterion = {
  criterion_id: "MATCH-SCORING-GOAL-DEVENT",
  class: "HARD_INVARIANT",
  rule:
    "A goal event fires when the swept segment crosses the goal line between the " +
    "posts and under the crossbar; the event carries a valid goalIndex.",
};

/**
 * MATCH-SCORING-GOAL-PHASE — playing → goal → playing with a post-goal reset.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_SCORING_GOAL_PHASE: EvaluationCriterion = {
  criterion_id: "MATCH-SCORING-GOAL-PHASE",
  class: "HARD_INVARIANT",
  rule:
    "A goal opens the goal phase, which resets play and returns to playing.",
};

/**
 * MATCH-TIMER-DECREMENT — the match timer decrements only during playing.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_TIMER_DECREMENT: EvaluationCriterion = {
  criterion_id: "MATCH-TIMER-DECREMENT",
  class: "HARD_INVARIANT",
  rule: "The match timer decrements only while the match phase is playing.",
};

/**
 * MATCH-TIMER-HALFTIME — playing → halftime → second-half transition.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_TIMER_HALFTIME: EvaluationCriterion = {
  criterion_id: "MATCH-TIMER-HALFTIME",
  class: "HARD_INVARIANT",
  rule:
    "When the timer reaches zero in half 1 the phase transitions to halftime and " +
    "then to the second half.",
};

/**
 * MATCH-TIMER-FULLTIME — fulltime transition when the timer reaches zero in half 2.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_TIMER_FULLTIME: EvaluationCriterion = {
  criterion_id: "MATCH-TIMER-FULLTIME",
  class: "HARD_INVARIANT",
  rule: "When the timer reaches zero in half 2 the phase transitions to fulltime.",
};

/**
 * MATCH-TIMER-FREEZE — the match timer is frozen during goal / halftime / fulltime
 * / set-piece phases.
 * Class: HARD_INVARIANT.  Oracle: rules-timer-freeze-oracle-v1 (which returns the
 * honest NOT_EVALUATED because the committed observation stream does not carry the
 * core matchPhase / matchTimer — see the oracle).
 */
export const MATCH_TIMER_FREEZE: EvaluationCriterion = {
  criterion_id: "MATCH-TIMER-FREEZE",
  class: "HARD_INVARIANT",
  rule:
    "The match timer is frozen during goal, halftime, fulltime and each set-piece " +
    "phase (the decrement is gated on playing).",
};

/**
 * MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH — every non-taker frozen at its anchor
 * in every restart window while the restart ball is untouched.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_RESTART_FREEZE_UNTIL_FIRST_TOUCH: EvaluationCriterion = {
  criterion_id: "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH",
  class: "HARD_INVARIANT",
  rule:
    "In every restart window the whole team except the single designated taker " +
    "is frozen at its window anchor while the restart ball is untouched.",
};

/**
 * MATCH-RESTART-NEAREST-ONLY — after the first touch only one chaser per team
 * converges on the ball.
 * Class: HARD_INVARIANT.  No oracle yet → NOT_EVALUATED.
 */
export const MATCH_RESTART_NEAREST_ONLY: EvaluationCriterion = {
  criterion_id: "MATCH-RESTART-NEAREST-ONLY",
  class: "HARD_INVARIANT",
  rule:
    "After the restart ball is first touched, exactly one designated chaser per " +
    "team converges on the ball.",
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

  // goalkeepers suite criteria — GAMEPLAY_EVALUATION_SPEC §7.4
  [GK_REA_001_REF.criterion_id]: GK_REA_001_REF,
  [GK_REA_001_VIS.criterion_id]: GK_REA_001_VIS,
  [GK_REA_001_REG.criterion_id]: GK_REA_001_REG,
  [GK_WF_001_CAUSAL.criterion_id]: GK_WF_001_CAUSAL,
  [GK_WF_001_VIS.criterion_id]: GK_WF_001_VIS,
  [GK_WF_001_REG.criterion_id]: GK_WF_001_REG,
  [GK_LEG_001_CONTACT.criterion_id]: GK_LEG_001_CONTACT,
  [GK_LEG_001_REF.criterion_id]: GK_LEG_001_REF,
  [GK_LEG_001_VIS.criterion_id]: GK_LEG_001_VIS,
  [GK_LEG_001_REG.criterion_id]: GK_LEG_001_REG,
  [GK_PARRY_001_CONTACT.criterion_id]: GK_PARRY_001_CONTACT,
  [GK_PARRY_001_REF.criterion_id]: GK_PARRY_001_REF,
  [GK_PARRY_001_VIS.criterion_id]: GK_PARRY_001_VIS,
  [GK_PARRY_001_REG.criterion_id]: GK_PARRY_001_REG,
  [GK_REC_001_REF.criterion_id]: GK_REC_001_REF,
  [GK_REC_001_VIS.criterion_id]: GK_REC_001_VIS,
  [GK_REC_001_REG.criterion_id]: GK_REC_001_REG,
  [GK_HIGH_001_REACH.criterion_id]: GK_HIGH_001_REACH,
  [GK_HIGH_001_REF.criterion_id]: GK_HIGH_001_REF,
  [GK_HIGH_001_VIS.criterion_id]: GK_HIGH_001_VIS,
  [GK_HIGH_001_REG.criterion_id]: GK_HIGH_001_REG,

  // goalkeepers suite criteria — small-sided GK behavior
  [GK_ROLE_DESIGNATION.criterion_id]: GK_ROLE_DESIGNATION,
  [GK_POSITIONING_HOLD.criterion_id]: GK_POSITIONING_HOLD,
  [GK_NO_FIELD_CHASE.criterion_id]: GK_NO_FIELD_CHASE,
  [GK_SAVE_CLAIM.criterion_id]: GK_SAVE_CLAIM,
  [GK_DISTRIBUTION_NO_OMNISCIENCE.criterion_id]: GK_DISTRIBUTION_NO_OMNISCIENCE,

  // rules suite criteria — MATCH_RULES_SPEC §15
  [MATCH_OUT_OF_PLAY_DETECT.criterion_id]: MATCH_OUT_OF_PLAY_DETECT,
  [MATCH_OUT_OF_PLAY_NO_LAST_TOUCH.criterion_id]: MATCH_OUT_OF_PLAY_NO_LAST_TOUCH,
  [MATCH_THROW_IN_AWARD.criterion_id]: MATCH_THROW_IN_AWARD,
  [MATCH_THROW_IN_PLACEMENT.criterion_id]: MATCH_THROW_IN_PLACEMENT,
  [MATCH_THROW_IN_SERVE.criterion_id]: MATCH_THROW_IN_SERVE,
  [MATCH_THROW_IN_TIMER_FREEZE.criterion_id]: MATCH_THROW_IN_TIMER_FREEZE,
  [MATCH_GOAL_KICK_AWARD.criterion_id]: MATCH_GOAL_KICK_AWARD,
  [MATCH_GOAL_KICK_PLACEMENT.criterion_id]: MATCH_GOAL_KICK_PLACEMENT,
  [MATCH_GOAL_KICK_DISTRIBUTION.criterion_id]: MATCH_GOAL_KICK_DISTRIBUTION,
  [MATCH_GOAL_KICK_TIMER_FREEZE.criterion_id]: MATCH_GOAL_KICK_TIMER_FREEZE,
  [MATCH_CORNER_KICK_AWARD.criterion_id]: MATCH_CORNER_KICK_AWARD,
  [MATCH_CORNER_KICK_PLACEMENT.criterion_id]: MATCH_CORNER_KICK_PLACEMENT,
  [MATCH_CORNER_KICK_CROSS.criterion_id]: MATCH_CORNER_KICK_CROSS,
  [MATCH_CORNER_KICK_TIMER_FREEZE.criterion_id]: MATCH_CORNER_KICK_TIMER_FREEZE,
  [MATCH_KICKOFF_FREEZE.criterion_id]: MATCH_KICKOFF_FREEZE,
  [MATCH_KICKOFF_FIRST_TOUCH.criterion_id]: MATCH_KICKOFF_FIRST_TOUCH,
  [MATCH_RESTART_REARM.criterion_id]: MATCH_RESTART_REARM,
  [MATCH_SCORING_GOAL_DEVENT.criterion_id]: MATCH_SCORING_GOAL_DEVENT,
  [MATCH_SCORING_GOAL_PHASE.criterion_id]: MATCH_SCORING_GOAL_PHASE,
  [MATCH_TIMER_DECREMENT.criterion_id]: MATCH_TIMER_DECREMENT,
  [MATCH_TIMER_HALFTIME.criterion_id]: MATCH_TIMER_HALFTIME,
  [MATCH_TIMER_FULLTIME.criterion_id]: MATCH_TIMER_FULLTIME,
  [MATCH_TIMER_FREEZE.criterion_id]: MATCH_TIMER_FREEZE,
  [MATCH_RESTART_FREEZE_UNTIL_FIRST_TOUCH.criterion_id]: MATCH_RESTART_FREEZE_UNTIL_FIRST_TOUCH,
  [MATCH_RESTART_NEAREST_ONLY.criterion_id]: MATCH_RESTART_NEAREST_ONLY,
};

/**
 * Get a common criterion by id.
 */
export function getCommonCriterion(id: string): EvaluationCriterion | undefined {
  return COMMON_CRITERIA[id];
}