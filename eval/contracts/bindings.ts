/**
 * @module @pes/eval/contracts/bindings
 *
 * TestImplementationBinding per unique test_id across fast ∪
 * locomotion ∪ ball suites.
 *
 * Each binding resolves:
 * - scenario_ids       → scenario-definitions (SCENARIO_REGISTRY)
 * - metric_ids         → metric-definitions (METRIC_DEFINITIONS)
 * - invariant_ids      → invariant-definitions (INVARIANT_DEFINITIONS)
 * - observation_ids    → observation-definitions (OBSERVATION_DEFINITIONS)
 * - criterion_bindings → maps criterion_ids to their logical outputs
 *
 * No PES envelopes are invented.  MEASURED_TARGET criterion references
 * use metrics whose estimator_id is "absent", producing
 * BLOCKED_MISSING_REFERENCE at evaluation time.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TestImplementationBinding } from "./types.js";
import type { EvaluationCriterion } from "./types.js";

// ---------------------------------------------------------------------------
// Criterion lookup (imported from common-criteria)
// ---------------------------------------------------------------------------

import { COMMON_CRITERIA, getCommonCriterion } from "./common-criteria.js";

/**
 * Lookup a criterion by id from the common-criterion registry.
 * Returns undefined if the criterion id is not found.
 */
function findCriterion(id: string): EvaluationCriterion | undefined {
  return COMMON_CRITERIA[id];
}

// ---------------------------------------------------------------------------
// Scenario ID mappings (one primary scenario per test)
// ---------------------------------------------------------------------------

const SCENARIO_ID_MAP: Record<string, string> = {
  "BALL-IND-001": "scn-ball-ind-001-v1",
  "LOC-ACC-001": "scn-loc-acc-001-v1",
  "LOC-ACC-002": "scn-loc-acc-002-v1",
  "LOC-MAX-001": "scn-loc-max-001-v1",
  "LOC-DEC-001": "scn-loc-dec-001-v1",
  "LOC-REV-001": "scn-loc-rev-001-v1",
  "LOC-T45-001": "scn-loc-t45-001-v1",
  "LOC-T90-001": "scn-loc-t90-001-v1",
  "LOC-ORI-001": "scn-loc-ori-001-v1",
  "LOC-BALL-001": "scn-loc-ball-001-v1",
  "CTRL-LAT-001": "scn-ctrl-lat-001-v1",
  "BALL-GND-001": "scn-ball-gnd-001-v1",
  "BALL-GND-002": "scn-ball-gnd-002-v1",
  "BALL-BNC-001": "scn-ball-bnc-001-v1",
  "BALL-SPN-001": "scn-ball-spn-001-v1",
  "BALL-SPN-002": "scn-ball-spn-002-v1",
};

/**
 * Build a criterion_bindings map for a test.
 *
 * Common criteria from a suite are mapped to invariant_ids.
 * Catalog-level criterion ids (e.g. LOC-ACC-001-REF) are mapped to
 * their metric_ids for MEASURED_TARGET criteria.  Since we don't yet
 * have catalog-level criterion definitions, we create stub mappings
 * keyed by the criterion_id string.
 */
function makeCriterionBindings(
  commonCriterionIds: string[],
  invariantIds: string[],
): Record<string, string[]> {
  const bindings: Record<string, string[]> = {};
  for (const ccId of commonCriterionIds) {
    const invariantId = invariantIds[invariantIds.indexOf("finite-number")];
    bindings[ccId] = [invariantId ?? ""];
  }
  return bindings;
}

// ---------------------------------------------------------------------------
// Test binding definitions
// ---------------------------------------------------------------------------

/**
 * Create a binding entry for a catalog test.
 */
function makeTestBinding(
  testId: string,
  scenarioIds: string[],
  metricIds: string[],
  invariantIds: string[],
  observationIds: string[],
  commonCriterionIds: string[],
): TestImplementationBinding {
  const criterionBindings = makeCriterionBindings(
    commonCriterionIds,
    invariantIds,
  );
  return {
    test_id: testId,
    scenario_ids: scenarioIds,
    metric_ids: metricIds,
    invariant_ids: invariantIds,
    observation_ids: observationIds,
    criterion_bindings: criterionBindings,
    required_schema_versions: {},
    implementation_version: "binding-v1",
  };
}

// --- fast suite tests ---

// Helper to build criterion_bindings that includes common criteria + test-level criteria.
function makeTestBindingWith(
  testId: string,
  scenarioIds: string[],
  metricIds: string[],
  invariantIds: string[],
  observationIds: string[],
  commonCriterionIds: string[],
  extraCriterionBindings: Record<string, string[]> = {},
): TestImplementationBinding {
  return {
    test_id: testId,
    scenario_ids: scenarioIds,
    metric_ids: metricIds,
    invariant_ids: invariantIds,
    observation_ids: observationIds,
    criterion_bindings: {
      ...makeCriterionBindings(commonCriterionIds, invariantIds),
      ...extraCriterionBindings,
    },
    required_schema_versions: {},
    implementation_version: "binding-v1",
  };
}

export const BINDING_BALL_IND_001: TestImplementationBinding = makeTestBindingWith(
  "BALL-IND-001",
  ["scn-ball-ind-001-v1"],
  ["ball-speed", "ball-distance", "ball-contact"],
  ["ball-continuity", "finite-number", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES"],
  {
    "BALL-IND-001-CONT": ["ball-continuity"],
    "BALL-IND-001-POSS": ["possession-evidence"],
    // MEASURED_TARGET — no reference target at bootstrap → BLOCKED_MISSING_REFERENCE.
    "BALL-SPD-001-REF": ["ball-speed"],
  },
);

export const BINDING_LOC_ACC_001: TestImplementationBinding = makeTestBinding(
  "LOC-ACC-001",
  ["scn-loc-acc-001-v1"],
  ["player-speed", "player-displacement"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES"],
);

export const BINDING_BALL_GND_001: TestImplementationBinding = makeTestBindingWith(
  "BALL-GND-001",
  ["scn-ball-gnd-001-v1"],
  ["ball-speed", "ball-distance"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES"],
  {
    "BALL-GND-001-CONTACT": ["ball-continuity"],
  },
);

// --- locomotion suite tests ---

export const BINDING_LOC_ACC_002: TestImplementationBinding = makeTestBinding(
  "LOC-ACC-002",
  ["scn-loc-acc-002-v1"],
  ["player-speed", "player-displacement"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_LOC_MAX_001: TestImplementationBinding = makeTestBinding(
  "LOC-MAX-001",
  ["scn-loc-max-001-v1"],
  ["player-speed"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_LOC_DEC_001: TestImplementationBinding = makeTestBinding(
  "LOC-DEC-001",
  ["scn-loc-dec-001-v1"],
  ["player-speed", "player-displacement"],
  ["finite-number", "event-references", "bounds"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_LOC_REV_001: TestImplementationBinding = makeTestBinding(
  "LOC-REV-001",
  ["scn-loc-rev-001-v1"],
  ["player-speed"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_LOC_T45_001: TestImplementationBinding = makeTestBinding(
  "LOC-T45-001",
  ["scn-loc-t45-001-v1"],
  ["player-speed"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_LOC_T90_001: TestImplementationBinding = makeTestBinding(
  "LOC-T90-001",
  ["scn-loc-t90-001-v1"],
  ["player-speed"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_LOC_ORI_001: TestImplementationBinding = makeTestBinding(
  "LOC-ORI-001",
  ["scn-loc-ori-001-v1"],
  ["player-speed", "player-displacement"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_LOC_BALL_001: TestImplementationBinding = makeTestBindingWith(
  "LOC-BALL-001",
  ["scn-loc-ball-001-v1"],
  ["player-speed", "ball-speed"],
  ["ball-continuity", "finite-number", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "LOC-BALL-001-FREE": ["ball-continuity"],
  },
);

export const BINDING_CTRL_LAT_001: TestImplementationBinding = makeTestBinding(
  "CTRL-LAT-001",
  ["scn-ctrl-lat-001-v1"],
  ["player-speed", "player-displacement"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

// --- ball suite tests (additional not in fast) ---

export const BINDING_BALL_GND_002: TestImplementationBinding = makeTestBinding(
  "BALL-GND-002",
  ["scn-ball-gnd-002-v1"],
  ["ball-speed", "ball-distance"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_BALL_BNC_001: TestImplementationBinding = makeTestBinding(
  "BALL-BNC-001",
  ["scn-ball-bnc-001-v1"],
  ["ball-speed"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_BALL_SPN_001: TestImplementationBinding = makeTestBinding(
  "BALL-SPN-001",
  ["scn-ball-spn-001-v1"],
  ["ball-speed", "ball-distance"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_BALL_SPN_002: TestImplementationBinding = makeTestBinding(
  "BALL-SPN-002",
  ["scn-ball-spn-002-v1"],
  ["ball-speed"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

// ---------------------------------------------------------------------------
// touch_and_actions suite test bindings
// ---------------------------------------------------------------------------

// Tests with HARD_INVARIANT oracle-mapped criteria:
// TOUCH-SLOW-001-CONTACT → possession-evidence (not ball-continuity)
// PASS-LOW-001-IMPULSE → ball-continuity
// PASS-LOFT-001-IMPULSE → ball-continuity
// SHOT-PWR-001-IMPULSE → ball-continuity (oracle already maps via bootstrapMapping)

// Tests with specific criteria that have no oracle mapping yet (NOT_EVALUATED):
// HEAD-FREE-001-HEAD → head-trajectory oracle (not implemented)
// TOUCH-WF-001-WEAKFOOT → weak-foot oracle (not implemented)
// SHOT-SWV-001-CURVE → curve oracle (not implemented)
// CROSS-HI-001-TRAJECTORY → cross-trajectory oracle (not implemented)

// Reconciled mapping for TOUCH-SLOW-001-CONTACT:
// The criterion_bindings entry changed from ["ball-continuity"] to
// ["possession-evidence"] to match the CRITERION_TO_ORACLE mapping in
// foundation-evaluator.ts.  HEAD-SLOW-001-CONTACT is NOT ball-continuity
// — it requires possession evidence (touch event correlation).

export const BINDING_TOUCH_SLOW_001: TestImplementationBinding = makeTestBindingWith(
  "TOUCH-SLOW-001",
  ["scn-touch-slow-001-v1"],
  ["ball-speed", "ball-distance", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    // Reconciled: uses possession-evidence to match CRITERION_TO_ORACLE.
    "TOUCH-SLOW-001-CONTACT": ["possession-evidence"],
  },
);

export const BINDING_TOUCH_FAST_001: TestImplementationBinding = makeTestBindingWith(
  "TOUCH-FAST-001",
  ["scn-touch-fast-001-v1"],
  ["ball-speed", "ball-distance", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_TOUCH_BACK_001: TestImplementationBinding = makeTestBindingWith(
  "TOUCH-BACK-001",
  ["scn-touch-back-001-v1"],
  ["ball-speed", "ball-distance", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_TOUCH_90_001: TestImplementationBinding = makeTestBindingWith(
  "TOUCH-90-001",
  ["scn-touch-90-001-v1"],
  ["ball-speed", "ball-distance", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_TOUCH_WF_001: TestImplementationBinding = makeTestBindingWith(
  "TOUCH-WF-001",
  ["scn-touch-wf-001-v1"],
  ["ball-speed", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "TOUCH-WF-001-WEAKFOOT": ["weak-foot-trajectory"],
  },
);

export const BINDING_PASS_LOW_001: TestImplementationBinding = makeTestBindingWith(
  "PASS-LOW-001",
  ["scn-pass-low-001-v1"],
  ["ball-speed", "ball-distance", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "PASS-LOW-001-IMPULSE": ["ball-continuity"],
  },
);

export const BINDING_PASS_ANG_001: TestImplementationBinding = makeTestBindingWith(
  "PASS-ANG-001",
  ["scn-pass-ang-001-v1"],
  ["ball-speed", "ball-distance"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_PASS_RUN_001: TestImplementationBinding = makeTestBindingWith(
  "PASS-RUN-001",
  ["scn-pass-run-001-v1"],
  ["ball-speed", "ball-distance"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_PASS_THR_001: TestImplementationBinding = makeTestBindingWith(
  "PASS-THR-001",
  ["scn-pass-thr-001-v1"],
  ["ball-speed", "ball-distance", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_PASS_LOFT_001: TestImplementationBinding = makeTestBindingWith(
  "PASS-LOFT-001",
  ["scn-pass-loft-001-v1"],
  ["ball-speed", "ball-distance", "ball-height", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "PASS-LOFT-001-IMPULSE": ["ball-continuity"],
  },
);

export const BINDING_CROSS_HI_001: TestImplementationBinding = makeTestBindingWith(
  "CROSS-HI-001",
  ["scn-cross-hi-001-v1"],
  ["ball-speed", "ball-distance", "ball-height"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "CROSS-HI-001-TRAJECTORY": ["cross-trajectory"],
  },
);

export const BINDING_SHOT_PWR_001: TestImplementationBinding = makeTestBindingWith(
  "SHOT-PWR-001",
  ["scn-shot-pwr-001-v1"],
  ["ball-speed", "ball-distance", "ball-height", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "SHOT-PWR-001-IMPULSE": ["ball-continuity"],
  },
);

export const BINDING_SHOT_IND_001: TestImplementationBinding = makeTestBindingWith(
  "SHOT-IND-001",
  ["scn-shot-ind-001-v1"],
  ["ball-speed", "ball-distance", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_SHOT_SWV_001: TestImplementationBinding = makeTestBindingWith(
  "SHOT-SWV-001",
  ["scn-shot-spw-001-v1"],
  ["ball-speed", "ball-distance", "ball-height"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "SHOT-SWV-001-CURVE": ["curve-trajectory"],
  },
);

export const BINDING_HEAD_FREE_001: TestImplementationBinding = makeTestBindingWith(
  "HEAD-FREE-001",
  ["scn-head-free-001-v1"],
  ["ball-speed", "ball-height", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "HEAD-FREE-001-HEAD": ["head-trajectory"],
  },
);

export const BINDING_HEAD_DUEL_001: TestImplementationBinding = makeTestBindingWith(
  "HEAD-DUEL-001",
  ["scn-head-duel-001-v1"],
  ["ball-speed", "ball-height", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

export const BINDING_CTRL_ACT_001: TestImplementationBinding = makeTestBindingWith(
  "CTRL-ACT-001",
  ["scn-ctrl-act-001-v1"],
  ["player-speed", "player-displacement", "ball-contact"],
  ["finite-number", "ball-continuity", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
);

// ---------------------------------------------------------------------------
// duels suite test bindings
// ---------------------------------------------------------------------------

/**
 * PHY-SHLD-001 — parallel shoulder contact.
 * PHY-SHLD-001-CONT maps to player-contact-evidence oracle.
 * PHY-SHLD-001-REF (MEASURED_TARGET) and PHY-SHLD-001-REG (REGRESSION)
 * are in criterion_bindings but have no oracle → evaluated as their class.
 */
export const BINDING_DUELS_PHY_SHLD_001: TestImplementationBinding = makeTestBindingWith(
  "PHY-SHLD-001",
  ["scn-duels-phy-shld-001-v1"],
  ["player-speed", "player-displacement"],
  ["finite-number", "event-references", "player-contact-evidence"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "PHY-SHLD-001-CONT": ["player-contact-evidence"],
    // MEASURED_TARGET: no reference target → BLOCKED_MISSING_REFERENCE.
    "PHY-SHLD-001-REF": [],
    // REGRESSION: no policy → NOT_EVALUATED.
    "PHY-SHLD-001-REG": [],
  },
);

/**
 * PHY-STR-001 — physical resistance capability.
 * PHY-STR-001-DESIGN (ENGINE_DESIGN_TARGET), PHY-STR-001-CAUSAL (UNKNOWN),
 * PHY-STR-001-REG (REGRESSION) — all no oracle → NOT_EVALUATED.
 */
export const BINDING_DUELS_PHY_STR_001: TestImplementationBinding = makeTestBindingWith(
  "PHY-STR-001",
  ["scn-duels-phy-str-001-v1"],
  ["player-speed"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "PHY-STR-001-DESIGN": [],
    "PHY-STR-001-CAUSAL": [],
    "PHY-STR-001-REG": [],
  },
);

/**
 * PHY-BC-001 — body-control capability.
 * PHY-BC-001-DESIGN (ENGINE_DESIGN_TARGET), PHY-BC-001-CAUSAL (UNKNOWN),
 * PHY-BC-001-REG (REGRESSION) — all no oracle → NOT_EVALUATED.
 */
export const BINDING_DUELS_PHY_BC_001: TestImplementationBinding = makeTestBindingWith(
  "PHY-BC-001",
  ["scn-duels-phy-bc-001-v1"],
  ["player-speed"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "PHY-BC-001-DESIGN": [],
    "PHY-BC-001-CAUSAL": [],
    "PHY-BC-001-REG": [],
  },
);

/**
 * PHY-PC-001 — physical-contact capability variation.
 * PHY-PC-001-DESIGN (ENGINE_DESIGN_TARGET), PHY-PC-001-CAUSAL (UNKNOWN),
 * PHY-PC-001-REG (REGRESSION) — all no oracle → NOT_EVALUATED.
 */
export const BINDING_DUELS_PHY_PC_001: TestImplementationBinding = makeTestBindingWith(
  "PHY-PC-001",
  ["scn-duels-phy-pc-001-v1"],
  ["player-speed"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "PHY-PC-001-DESIGN": [],
    "PHY-PC-001-CAUSAL": [],
    "PHY-PC-001-REG": [],
  },
);

/**
 * TACK-ST-001 — standing tackle.
 * TACK-ST-001-PHASE is bound to the protected tackle-phase-evidence-standing
 * oracle (HARD_INVARIANT → PASS with genuine ordered-phase evidence, FAIL when
 * the action system is absent). TACK-ST-001-CAUSAL (UNKNOWN) and
 * TACK-ST-001-REG (REGRESSION) stay unbound → NOT_EVALUATED.
 */
export const BINDING_DUELS_TACK_ST_001: TestImplementationBinding = makeTestBindingWith(
  "TACK-ST-001",
  ["scn-duels-tack-st-001-v1"],
  ["player-speed"],
  ["finite-number", "event-references", "tackle-phase-evidence-standing"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "TACK-ST-001-PHASE": ["tackle-phase-evidence-standing"],
    "TACK-ST-001-CAUSAL": [],
    "TACK-ST-001-REG": [],
  },
);

/**
 * TACK-SL-001 — sliding tackle.
 * TACK-SL-001-PHASE is bound to the protected tackle-phase-evidence-slide
 * oracle (same contract as the standing tackle for the slide windows).
 * CAUSAL / REG stay unbound → NOT_EVALUATED.
 */
export const BINDING_DUELS_TACK_SL_001: TestImplementationBinding = makeTestBindingWith(
  "TACK-SL-001",
  ["scn-duels-tack-sl-001-v1"],
  ["player-speed"],
  ["finite-number", "event-references", "tackle-phase-evidence-slide"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "TACK-SL-001-PHASE": ["tackle-phase-evidence-slide"],
    "TACK-SL-001-CAUSAL": [],
    "TACK-SL-001-REG": [],
  },
);

/**
 * TACK-ANG-001 — tackle angle.
 * Tackles not implemented → UNKNOWN and REGRESSION → NOT_EVALUATED.
 */
export const BINDING_DUELS_TACK_ANG_001: TestImplementationBinding = makeTestBindingWith(
  "TACK-ANG-001",
  ["scn-duels-tack-ang-001-v1"],
  ["player-speed"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "TACK-ANG-001-CAUSAL": [],
    "TACK-ANG-001-REG": [],
  },
);

/**
 * INT-PASS-001 — intercept pass.
 * Intercepts not implemented → UNKNOWN and REGRESSION → NOT_EVALUATED.
 */
export const BINDING_DUELS_INT_PASS_001: TestImplementationBinding = makeTestBindingWith(
  "INT-PASS-001",
  ["scn-duels-int-pass-001-v1"],
  ["player-speed"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "INT-PASS-001-CAUSAL": [],
    "INT-PASS-001-REG": [],
  },
);

/**
 * INT-FAST-001 — fast intercept.
 * Intercepts not implemented → UNKNOWN and REGRESSION → NOT_EVALUATED.
 */
export const BINDING_DUELS_INT_FAST_001: TestImplementationBinding = makeTestBindingWith(
  "INT-FAST-001",
  ["scn-duels-int-fast-001-v1"],
  ["player-speed"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "INT-FAST-001-CAUSAL": [],
    "INT-FAST-001-REG": [],
  },
);

// ---------------------------------------------------------------------------
// goalkeepers suite test bindings
// ---------------------------------------------------------------------------

/**
 * GK-REA-001 — set keeper response sequence to a shot.
 * Catalog REF (MEASURED_TARGET) → BLOCKED_MISSING_REFERENCE, VIS
 * (PERCEPTUAL_TARGET) → NEEDS_PERCEPTUAL_REVIEW, REG (REGRESSION) →
 * NOT_EVALUATED.  Small-sided GK behavior criteria (POSITIONING-HOLD,
 * SAVE-CLAIM, ROLE-DESIGNATION) are bound to their (unimplemented) GK
 * invariants → NOT_EVALUATED.
 */
export const BINDING_GK_REA_001: TestImplementationBinding = makeTestBindingWith(
  "GK-REA-001",
  ["scn-gk-rea-001-v1"],
  ["player-speed", "player-displacement", "ball-speed", "ball-distance", "ball-contact"],
  ["finite-number", "event-references", "gk-positioning-evidence", "gk-save-claim-evidence", "gk-role-designation-evidence"],
  ["obs-per-tick-v1", "obs-gk-positioning-v1", "obs-gk-save-claim-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "GK-REA-001-REF": [],
    "GK-REA-001-VIS": [],
    "GK-REA-001-REG": [],
    "GK-POSITIONING-HOLD": ["gk-positioning-evidence"],
    "GK-SAVE-CLAIM": ["gk-save-claim-evidence"],
    "GK-ROLE-DESIGNATION": ["gk-role-designation-evidence"],
  },
);

/**
 * GK-WF-001 — wrong-foot correction.
 * CAUSAL (UNKNOWN) → NOT_EVALUATED, VIS → NEEDS_PERCEPTUAL_REVIEW, REG →
 * NOT_EVALUATED.  Small-sided behavior: NO-FIELD-CHASE + POSITIONING-HOLD.
 */
export const BINDING_GK_WF_001: TestImplementationBinding = makeTestBindingWith(
  "GK-WF-001",
  ["scn-gk-wf-001-v1"],
  ["player-speed", "player-displacement", "ball-speed"],
  ["finite-number", "event-references", "gk-no-field-chase-evidence", "gk-positioning-evidence"],
  ["obs-per-tick-v1", "obs-gk-chase-v1", "obs-gk-positioning-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "GK-WF-001-CAUSAL": [],
    "GK-WF-001-VIS": [],
    "GK-WF-001-REG": [],
    "GK-NO-FIELD-CHASE": ["gk-no-field-chase-evidence"],
    "GK-POSITIONING-HOLD": ["gk-positioning-evidence"],
  },
);

/**
 * GK-LEG-001 — low close shot saved by an explicit leg/foot contact.
 * CONTACT (HARD_INVARIANT) bound to the GK save/claim invariant; the
 * keeper subsystem is absent so it evaluates NOT_EVALUATED.
 */
export const BINDING_GK_LEG_001: TestImplementationBinding = makeTestBindingWith(
  "GK-LEG-001",
  ["scn-gk-leg-001-v1"],
  ["player-speed", "player-displacement", "ball-speed", "ball-distance", "ball-contact"],
  ["finite-number", "event-references", "gk-save-claim-evidence"],
  ["obs-per-tick-v1", "obs-gk-save-claim-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "GK-LEG-001-CONTACT": ["gk-save-claim-evidence"],
    "GK-LEG-001-REF": [],
    "GK-LEG-001-VIS": [],
    "GK-LEG-001-REG": [],
    "GK-SAVE-CLAIM": ["gk-save-claim-evidence"],
  },
);

/**
 * GK-PARRY-001 — parry direction/outcome by surface.
 * CONTACT bound to the GK save/claim invariant; keeper subsystem absent →
 * NOT_EVALUATED.
 */
export const BINDING_GK_PARRY_001: TestImplementationBinding = makeTestBindingWith(
  "GK-PARRY-001",
  ["scn-gk-parry-001-v1"],
  ["player-speed", "player-displacement", "ball-speed", "ball-distance", "ball-contact"],
  ["finite-number", "event-references", "gk-save-claim-evidence"],
  ["obs-per-tick-v1", "obs-gk-save-claim-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "GK-PARRY-001-CONTACT": ["gk-save-claim-evidence"],
    "GK-PARRY-001-REF": [],
    "GK-PARRY-001-VIS": [],
    "GK-PARRY-001-REG": [],
    "GK-SAVE-CLAIM": ["gk-save-claim-evidence"],
  },
);

/**
 * GK-REC-001 — recovery from a grounded save.
 * REF → BLOCKED_MISSING_REFERENCE, VIS → NEEDS_PERCEPTUAL_REVIEW, REG →
 * NOT_EVALUATED.  Small-sided: POSITIONING-HOLD + DISTRIBUTION-NO-OMNISCIENCE.
 */
export const BINDING_GK_REC_001: TestImplementationBinding = makeTestBindingWith(
  "GK-REC-001",
  ["scn-gk-rec-001-v1"],
  ["player-speed", "player-displacement", "ball-speed", "ball-distance"],
  ["finite-number", "event-references", "gk-positioning-evidence", "gk-distribution-evidence"],
  ["obs-per-tick-v1", "obs-gk-positioning-v1", "obs-gk-distribution-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "GK-REC-001-REF": [],
    "GK-REC-001-VIS": [],
    "GK-REC-001-REG": [],
    "GK-POSITIONING-HOLD": ["gk-positioning-evidence"],
    "GK-DISTRIBUTION-NO-OMNISCIENCE": ["gk-distribution-evidence"],
  },
);

/**
 * GK-HIGH-001 — take off and catch/parry a high cross.
 * REACH (HARD_INVARIANT) bound to the GK save/claim invariant; keeper
 * subsystem absent → NOT_EVALUATED.
 */
export const BINDING_GK_HIGH_001: TestImplementationBinding = makeTestBindingWith(
  "GK-HIGH-001",
  ["scn-gk-high-001-v1"],
  ["player-speed", "player-displacement", "ball-speed", "ball-distance", "ball-height", "ball-contact"],
  ["finite-number", "event-references", "gk-save-claim-evidence", "gk-positioning-evidence"],
  ["obs-per-tick-v1", "obs-gk-save-claim-v1", "obs-gk-positioning-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  {
    "GK-HIGH-001-REACH": ["gk-save-claim-evidence"],
    "GK-HIGH-001-REF": [],
    "GK-HIGH-001-VIS": [],
    "GK-HIGH-001-REG": [],
    "GK-SAVE-CLAIM": ["gk-save-claim-evidence"],
    "GK-POSITIONING-HOLD": ["gk-positioning-evidence"],
  },
);

// ---------------------------------------------------------------------------
// rules suite test bindings (MATCH_RULES_SPEC §15)
// ---------------------------------------------------------------------------

/**
 * RULES-OOP-001 — out-of-play detection + no-last-touch behaviour.
 *
 * MATCH-OUT-OF-PLAY-DETECT and MATCH-OUT-OF-PLAY-NO-LAST-TOUCH are bound to the
 * protected rules oracles.  Both share the same contract scenario stub
 * (scn-rules-lifecycle-v1).
 */
export const BINDING_RULES_OOP_001: TestImplementationBinding = makeTestBindingWith(
  "RULES-OOP-001",
  ["scn-rules-lifecycle-v1"],
  [],
  ["rules-out-of-play-detect-evidence", "rules-out-of-play-no-last-touch-evidence"],
  ["obs-per-tick-v1", "obs-rules-restart-v1"],
  [],
  {
    "MATCH-OUT-OF-PLAY-DETECT": ["rules-out-of-play-detect-evidence"],
    "MATCH-OUT-OF-PLAY-NO-LAST-TOUCH": ["rules-out-of-play-no-last-touch-evidence"],
  },
);

/**
 * RULES-THROWIN-001 — throw-in award + placement/serve/timer criteria.
 * MATCH-THROW-IN-AWARD is bound to the protected rules-throw-in-award oracle;
 * the placement / serve / timer criteria have no oracle yet → NOT_EVALUATED.
 */
export const BINDING_RULES_THROWIN_001: TestImplementationBinding = makeTestBindingWith(
  "RULES-THROWIN-001",
  ["scn-rules-lifecycle-v1"],
  [],
  ["rules-throw-in-award-evidence"],
  ["obs-per-tick-v1", "obs-rules-restart-v1"],
  [],
  {
    "MATCH-THROW-IN-AWARD": ["rules-throw-in-award-evidence"],
    "MATCH-THROW-IN-PLACEMENT": ["rules-throw-in-placement-evidence"],
    "MATCH-THROW-IN-SERVE": ["rules-throw-in-serve-evidence"],
    "MATCH-THROW-IN-TIMER-FREEZE": ["rules-throw-in-timer-freeze-evidence"],
  },
);

/**
 * RULES-GOALKICK-001 — goal-kick award + placement/distribution/timer criteria.
 * MATCH-GOAL-KICK-AWARD is bound to the rules-goal-kick-award oracle;
 * DISTRIBUTION (MEASURED_TARGET) → BLOCKED_MISSING_REFERENCE; the others have no
 * oracle yet → NOT_EVALUATED.
 */
export const BINDING_RULES_GOALKICK_001: TestImplementationBinding = makeTestBindingWith(
  "RULES-GOALKICK-001",
  ["scn-rules-lifecycle-v1"],
  [],
  ["rules-goal-kick-award-evidence"],
  ["obs-per-tick-v1", "obs-rules-restart-v1"],
  [],
  {
    "MATCH-GOAL-KICK-AWARD": ["rules-goal-kick-award-evidence"],
    "MATCH-GOAL-KICK-PLACEMENT": ["rules-goal-kick-placement-evidence"],
    "MATCH-GOAL-KICK-DISTRIBUTION": [],
    "MATCH-GOAL-KICK-TIMER-FREEZE": ["rules-goal-kick-timer-freeze-evidence"],
  },
);

/**
 * RULES-CORNERKICK-001 — corner-kick award + placement/cross/timer criteria.
 * MATCH-CORNER-KICK-AWARD is bound to the rules-corner-kick-award oracle;
 * CROSS (MEASURED_TARGET) → BLOCKED_MISSING_REFERENCE; the others have no oracle
 * yet → NOT_EVALUATED.
 */
export const BINDING_RULES_CORNERKICK_001: TestImplementationBinding = makeTestBindingWith(
  "RULES-CORNERKICK-001",
  ["scn-rules-lifecycle-v1"],
  [],
  ["rules-corner-kick-award-evidence"],
  ["obs-per-tick-v1", "obs-rules-restart-v1"],
  [],
  {
    "MATCH-CORNER-KICK-AWARD": ["rules-corner-kick-award-evidence"],
    "MATCH-CORNER-KICK-PLACEMENT": [],
    "MATCH-CORNER-KICK-CROSS": [],
    "MATCH-CORNER-KICK-TIMER-FREEZE": [],
  },
);

/**
 * RULES-KICKOFF-001 — kickoff / restart freeze + first-touch + re-arm.
 * MATCH-KICKOFF-FREEZE is bound to the rules-kickoff-freeze oracle; the others
 * have no oracle yet → NOT_EVALUATED.
 */
export const BINDING_RULES_KICKOFF_001: TestImplementationBinding = makeTestBindingWith(
  "RULES-KICKOFF-001",
  ["scn-rules-lifecycle-v1"],
  [],
  ["rules-kickoff-freeze-evidence"],
  ["obs-per-tick-v1", "obs-rules-restart-v1"],
  [],
  {
    "MATCH-KICKOFF-FREEZE": ["rules-kickoff-freeze-evidence"],
    "MATCH-KICKOFF-FIRST-TOUCH": ["rules-kickoff-first-touch-evidence"],
    "MATCH-RESTART-REARM": [],
  },
);

/**
 * RULES-SCORING-001 — goal detection + goal phase.
 * MATCH-SCORING-GOAL-DEVENT is bound to the rules-goal-detection oracle; the
 * goal-phase criterion has no oracle yet → NOT_EVALUATED.
 */
export const BINDING_RULES_SCORING_001: TestImplementationBinding = makeTestBindingWith(
  "RULES-SCORING-001",
  ["scn-rules-lifecycle-v1"],
  [],
  ["rules-goal-detection-evidence"],
  ["obs-per-tick-v1", "obs-rules-restart-v1"],
  [],
  {
    "MATCH-SCORING-GOAL-DEVENT": ["rules-goal-detection-evidence"],
    "MATCH-SCORING-GOAL-PHASE": ["rules-goal-phase-evidence"],
  },
);

/**
 * RULES-TIMING-001 — match timer criteria.
 * MATCH-TIMER-FREEZE is bound to the rules-timer-freeze oracle (which returns
 * the honest NOT_EVALUATED); the decrement / halftime / fulltime criteria have no
 * oracle yet → NOT_EVALUATED.
 */
export const BINDING_RULES_TIMING_001: TestImplementationBinding = makeTestBindingWith(
  "RULES-TIMING-001",
  ["scn-rules-lifecycle-v1"],
  [],
  ["rules-timer-freeze-evidence"],
  ["obs-per-tick-v1", "obs-rules-restart-v1"],
  [],
  {
    "MATCH-TIMER-DECREMENT": ["rules-timer-decrement-evidence"],
    "MATCH-TIMER-HALFTIME": ["rules-timer-halftime-evidence"],
    "MATCH-TIMER-FULLTIME": ["rules-timer-fulltime-evidence"],
    "MATCH-TIMER-FREEZE": ["rules-timer-freeze-evidence"],
  },
);

/**
 * RULES-ANTIHUDDLE-001 — anti-huddle interaction criteria.
 * No oracle yet → NOT_EVALUATED for both criteria.
 */
export const BINDING_RULES_ANTIHUDDLE_001: TestImplementationBinding = makeTestBindingWith(
  "RULES-ANTIHUDDLE-001",
  ["scn-rules-lifecycle-v1"],
  [],
  [],
  ["obs-per-tick-v1", "obs-rules-restart-v1"],
  [],
  {
    "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH": [],
    "MATCH-RESTART-NEAREST-ONLY": [],
  },
);

// ---------------------------------------------------------------------------
// Registry — all bindings keyed by test_id
// ---------------------------------------------------------------------------

export const TEST_BINDINGS: Record<string, TestImplementationBinding> = {
  [BINDING_BALL_IND_001.test_id]: BINDING_BALL_IND_001,
  [BINDING_LOC_ACC_001.test_id]: BINDING_LOC_ACC_001,
  [BINDING_BALL_GND_001.test_id]: BINDING_BALL_GND_001,
  [BINDING_LOC_ACC_002.test_id]: BINDING_LOC_ACC_002,
  [BINDING_LOC_MAX_001.test_id]: BINDING_LOC_MAX_001,
  [BINDING_LOC_DEC_001.test_id]: BINDING_LOC_DEC_001,
  [BINDING_LOC_REV_001.test_id]: BINDING_LOC_REV_001,
  [BINDING_LOC_T45_001.test_id]: BINDING_LOC_T45_001,
  [BINDING_LOC_T90_001.test_id]: BINDING_LOC_T90_001,
  [BINDING_LOC_ORI_001.test_id]: BINDING_LOC_ORI_001,
  [BINDING_LOC_BALL_001.test_id]: BINDING_LOC_BALL_001,
  [BINDING_CTRL_LAT_001.test_id]: BINDING_CTRL_LAT_001,
  [BINDING_BALL_GND_002.test_id]: BINDING_BALL_GND_002,
  [BINDING_BALL_BNC_001.test_id]: BINDING_BALL_BNC_001,
  [BINDING_BALL_SPN_001.test_id]: BINDING_BALL_SPN_001,
  [BINDING_BALL_SPN_002.test_id]: BINDING_BALL_SPN_002,

  // touch_and_actions suite bindings
  [BINDING_TOUCH_SLOW_001.test_id]: BINDING_TOUCH_SLOW_001,
  [BINDING_TOUCH_FAST_001.test_id]: BINDING_TOUCH_FAST_001,
  [BINDING_TOUCH_BACK_001.test_id]: BINDING_TOUCH_BACK_001,
  [BINDING_TOUCH_90_001.test_id]: BINDING_TOUCH_90_001,
  [BINDING_TOUCH_WF_001.test_id]: BINDING_TOUCH_WF_001,
  [BINDING_PASS_LOW_001.test_id]: BINDING_PASS_LOW_001,
  [BINDING_PASS_ANG_001.test_id]: BINDING_PASS_ANG_001,
  [BINDING_PASS_RUN_001.test_id]: BINDING_PASS_RUN_001,
  [BINDING_PASS_THR_001.test_id]: BINDING_PASS_THR_001,
  [BINDING_PASS_LOFT_001.test_id]: BINDING_PASS_LOFT_001,
  [BINDING_CROSS_HI_001.test_id]: BINDING_CROSS_HI_001,
  [BINDING_SHOT_PWR_001.test_id]: BINDING_SHOT_PWR_001,
  [BINDING_SHOT_IND_001.test_id]: BINDING_SHOT_IND_001,
  [BINDING_SHOT_SWV_001.test_id]: BINDING_SHOT_SWV_001,
  [BINDING_HEAD_FREE_001.test_id]: BINDING_HEAD_FREE_001,
  [BINDING_HEAD_DUEL_001.test_id]: BINDING_HEAD_DUEL_001,
  [BINDING_CTRL_ACT_001.test_id]: BINDING_CTRL_ACT_001,

  // duels suite bindings
  [BINDING_DUELS_PHY_SHLD_001.test_id]: BINDING_DUELS_PHY_SHLD_001,
  [BINDING_DUELS_PHY_STR_001.test_id]: BINDING_DUELS_PHY_STR_001,
  [BINDING_DUELS_PHY_BC_001.test_id]: BINDING_DUELS_PHY_BC_001,
  [BINDING_DUELS_PHY_PC_001.test_id]: BINDING_DUELS_PHY_PC_001,
  [BINDING_DUELS_TACK_ST_001.test_id]: BINDING_DUELS_TACK_ST_001,
  [BINDING_DUELS_TACK_SL_001.test_id]: BINDING_DUELS_TACK_SL_001,
  [BINDING_DUELS_TACK_ANG_001.test_id]: BINDING_DUELS_TACK_ANG_001,
  [BINDING_DUELS_INT_PASS_001.test_id]: BINDING_DUELS_INT_PASS_001,
  [BINDING_DUELS_INT_FAST_001.test_id]: BINDING_DUELS_INT_FAST_001,

  // goalkeepers suite bindings
  [BINDING_GK_REA_001.test_id]: BINDING_GK_REA_001,
  [BINDING_GK_WF_001.test_id]: BINDING_GK_WF_001,
  [BINDING_GK_LEG_001.test_id]: BINDING_GK_LEG_001,
  [BINDING_GK_PARRY_001.test_id]: BINDING_GK_PARRY_001,
  [BINDING_GK_REC_001.test_id]: BINDING_GK_REC_001,
  [BINDING_GK_HIGH_001.test_id]: BINDING_GK_HIGH_001,

  // rules suite bindings
  [BINDING_RULES_OOP_001.test_id]: BINDING_RULES_OOP_001,
  [BINDING_RULES_THROWIN_001.test_id]: BINDING_RULES_THROWIN_001,
  [BINDING_RULES_GOALKICK_001.test_id]: BINDING_RULES_GOALKICK_001,
  [BINDING_RULES_CORNERKICK_001.test_id]: BINDING_RULES_CORNERKICK_001,
  [BINDING_RULES_KICKOFF_001.test_id]: BINDING_RULES_KICKOFF_001,
  [BINDING_RULES_SCORING_001.test_id]: BINDING_RULES_SCORING_001,
  [BINDING_RULES_TIMING_001.test_id]: BINDING_RULES_TIMING_001,
  [BINDING_RULES_ANTIHUDDLE_001.test_id]: BINDING_RULES_ANTIHUDDLE_001,
};

/**
 * Get a test implementation binding by test_id.
 * @returns The binding or undefined if not registered.
 */
export function getTestBinding(
  testId: string,
): TestImplementationBinding | undefined {
  return TEST_BINDINGS[testId];
}

/**
 * All unique test IDs across fast ∪ locomotion ∪ ball.
 */
export const ALL_TEST_IDS: string[] = Object.keys(TEST_BINDINGS);