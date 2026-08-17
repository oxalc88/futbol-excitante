/**
 * @module @pes/eval/contracts/suites
 *
 * Versioned evaluation suite registry materialized from
 * GAMEPLAY_EVALUATION_SPEC.md.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { SuiteDefinition } from "./types.js";

export const FAST_SUITE: SuiteDefinition = {
  suite_id: "fast",
  suite_version: "suite-fast-v1",
  direct_test_ids: ["BALL-IND-001", "LOC-ACC-001", "BALL-GND-001"],
  common_criterion_ids: ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES"],
  impact_closure: "NONE",
  prerequisite_capabilities: ["DETERMINISTIC_CORE", "HEADLESS_SCENARIOS"],
  seed_matrix_id: "seeds-smoke-v1",
  config_matrix_id: "config-default-v1",
  held_out_policy_id: null,
  browser_case_ids: [],
  resource_policy_id: "resources-fast-v1",
  outcome_reduction_profile_id: "required-hard-v1",
  expected_expansion_manifest_id: "expansion-fast-v1",
};

export const LOCOMOTION_SUITE: SuiteDefinition = {
  suite_id: "locomotion",
  suite_version: "suite-locomotion-v1",
  direct_test_ids: ["LOC-ACC-001", "LOC-ACC-002", "LOC-MAX-001", "LOC-DEC-001", "LOC-REV-001", "LOC-T45-001", "LOC-T90-001", "LOC-ORI-001", "LOC-BALL-001", "CTRL-LAT-001"],
  common_criterion_ids: ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  impact_closure: "NONE",
  prerequisite_capabilities: ["LOCOMOTION"],
  seed_matrix_id: "seeds-family-v1",
  config_matrix_id: "config-locomotion-v1",
  held_out_policy_id: null,
  browser_case_ids: [],
  resource_policy_id: "resources-family-v1",
  outcome_reduction_profile_id: "profile-selected-v1",
  expected_expansion_manifest_id: "expansion-locomotion-v1",
};

export const BALL_SUITE: SuiteDefinition = {
  suite_id: "ball",
  suite_version: "suite-ball-v1",
  direct_test_ids: ["BALL-IND-001", "BALL-GND-001", "BALL-GND-002", "BALL-BNC-001", "BALL-SPN-001", "BALL-SPN-002"],
  common_criterion_ids: ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  impact_closure: "NONE",
  prerequisite_capabilities: ["INDEPENDENT_BALL"],
  seed_matrix_id: "seeds-family-v1",
  config_matrix_id: "config-ball-v1",
  held_out_policy_id: null,
  browser_case_ids: [],
  resource_policy_id: "resources-family-v1",
  outcome_reduction_profile_id: "profile-selected-v1",
  expected_expansion_manifest_id: "expansion-ball-v1",
};

export const TOUCH_AND_ACTIONS_SUITE: SuiteDefinition = {
  suite_id: "touch_and_actions",
  suite_version: "suite-touch-actions-v1",
  direct_test_ids: [
    "TOUCH-SLOW-001", "TOUCH-FAST-001", "TOUCH-BACK-001", "TOUCH-90-001", "TOUCH-WF-001",
    "PASS-LOW-001", "PASS-ANG-001", "PASS-RUN-001", "PASS-THR-001", "PASS-LOFT-001",
    "CROSS-HI-001", "SHOT-PWR-001", "SHOT-IND-001", "SHOT-SWV-001", "HEAD-FREE-001", "CTRL-ACT-001",
  ],
  common_criterion_ids: ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  impact_closure: "NONE",
  prerequisite_capabilities: ["FIRST_TOUCH", "BASIC_ACTIONS"],
  seed_matrix_id: "seeds-family-v1",
  config_matrix_id: "config-actions-v1",
  held_out_policy_id: null,
  browser_case_ids: [],
  resource_policy_id: "resources-family-v1",
  outcome_reduction_profile_id: "profile-selected-v1",
  expected_expansion_manifest_id: "expansion-touch-actions-v1",
};

export const DUELS_SUITE: SuiteDefinition = {
  suite_id: "duels",
  suite_version: "suite-duels-v1",
  direct_test_ids: ["PHY-SHLD-001", "PHY-STR-001", "PHY-BC-001", "PHY-PC-001", "TACK-ST-001", "TACK-SL-001", "TACK-ANG-001", "INT-PASS-001", "INT-FAST-001"],
  common_criterion_ids: ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  impact_closure: "NONE",
  prerequisite_capabilities: ["PLAYER_DUELS"],
  seed_matrix_id: "seeds-family-v1",
  config_matrix_id: "config-duels-v1",
  held_out_policy_id: null,
  browser_case_ids: [],
  resource_policy_id: "resources-family-v1",
  outcome_reduction_profile_id: "profile-selected-v1",
  expected_expansion_manifest_id: "expansion-duels-v1",
};

/**
 * Team suite for the normative SMALL_SIDED_SHAPE profile.
 *
 * These IDs come from GAMEPLAY_EVALUATION_SPEC.md §7.5. Materializing the
 * suite intentionally does not fabricate bindings or PASS results. Missing
 * implementations remain NOT_EVALUATED/INVALID_RUN according to the normal
 * milestone evaluator rules.
 */
export const TEAM_SUITE: SuiteDefinition = {
  suite_id: "team",
  suite_version: "suite-team-v1",
  direct_test_ids: [
    "OFF-RUN-001",
    "OFF-SUP-001",
    "DEF-SHAPE-001",
    "DEF-SHIFT-001",
    "PRESS-001",
    "PRESS-GG-001",
    "PRESS-REC-001",
    "TRANS-AD-001",
    "TRANS-DA-001",
  ],
  common_criterion_ids: ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"],
  impact_closure: "NONE",
  prerequisite_capabilities: ["TEAM_TACTICS", "TRANSITION_PHASES", "SMALL_SIDED_CARDINALITY"],
  seed_matrix_id: "seeds-family-v1",
  config_matrix_id: "config-team-v1",
  held_out_policy_id: null,
  browser_case_ids: ["BROWSER-SMALL-SIDED-001"],
  resource_policy_id: "resources-family-v1",
  outcome_reduction_profile_id: "profile-selected-v1",
  expected_expansion_manifest_id: "expansion-team-v1",
};

/** All registered suites keyed by suite_id. */
export const SUITES: Record<string, SuiteDefinition> = {
  [FAST_SUITE.suite_id]: FAST_SUITE,
  [LOCOMOTION_SUITE.suite_id]: LOCOMOTION_SUITE,
  [BALL_SUITE.suite_id]: BALL_SUITE,
  [TOUCH_AND_ACTIONS_SUITE.suite_id]: TOUCH_AND_ACTIONS_SUITE,
  [DUELS_SUITE.suite_id]: DUELS_SUITE,
  [TEAM_SUITE.suite_id]: TEAM_SUITE,
};

export function getSuite(suiteId: string): SuiteDefinition | undefined {
  return SUITES[suiteId];
}

export const FOUNDATION_SUITES: SuiteDefinition[] = [FAST_SUITE, LOCOMOTION_SUITE, BALL_SUITE];
