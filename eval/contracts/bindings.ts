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

export const BINDING_BALL_IND_001: TestImplementationBinding = makeTestBinding(
  "BALL-IND-001",
  ["scn-ball-ind-001-v1"],
  ["ball-speed", "ball-distance", "ball-contact"],
  ["ball-continuity", "finite-number", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES"],
);

export const BINDING_LOC_ACC_001: TestImplementationBinding = makeTestBinding(
  "LOC-ACC-001",
  ["scn-loc-acc-001-v1"],
  ["player-speed", "player-displacement"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES"],
);

export const BINDING_BALL_GND_001: TestImplementationBinding = makeTestBinding(
  "BALL-GND-001",
  ["scn-ball-gnd-001-v1"],
  ["ball-speed", "ball-distance"],
  ["finite-number", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES"],
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

export const BINDING_LOC_BALL_001: TestImplementationBinding = makeTestBinding(
  "LOC-BALL-001",
  ["scn-loc-ball-001-v1"],
  ["player-speed", "ball-speed"],
  ["ball-continuity", "finite-number", "event-references"],
  ["obs-per-tick-v1", "obs-ball-motion-v1"],
  ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
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