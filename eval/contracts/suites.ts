/**
 * @module @pes/eval/contracts/suites
 *
 * Versioned SuiteDefinition records materialized from
 * GAMEPLAY_EVALUATION_SPEC.md.
 * impact_closure is NONE so expansion = direct set + common criteria,
 * not a graph walk.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { SuiteDefinition } from "./types.js";

export const FAST_SUITE: SuiteDefinition = {
  suite_id: "fast",
  suite_version: "suite-fast-v1",
  direct_test_ids: ["BALL-IND-001", "LOC-ACC-001", "BALL-GND-001"],
  common_criterion_ids: [
    "COMMON-FINITE",
    "COMMON-DETERMINISTIC",
    "COMMON-REFERENCES",
  ],
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
  direct_test_ids: [
    "LOC-ACC-001",
    "LOC-ACC-002",
    "LOC-MAX-001",
    "LOC-DEC-001",
    "LOC-REV-001",
    "LOC-T45-001",
    "LOC-T90-001",
    "LOC-ORI-001",
    "LOC-BALL-001",
    "CTRL-LAT-001",
  ],
  common_criterion_ids: [
    "COMMON-FINITE",
    "COMMON-DETERMINISTIC",
    "COMMON-REFERENCES",
    "COMMON-BOUNDS",
  ],
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
  direct_test_ids: [
    "BALL-IND-001",
    "BALL-GND-001",
    "BALL-GND-002",
    "BALL-BNC-001",
    "BALL-SPN-001",
    "BALL-SPN-002",
  ],
  common_criterion_ids: [
    "COMMON-FINITE",
    "COMMON-DETERMINISTIC",
    "COMMON-REFERENCES",
    "COMMON-BOUNDS",
  ],
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
    "TOUCH-SLOW-001",
    "TOUCH-FAST-001",
    "TOUCH-BACK-001",
    "TOUCH-90-001",
    "TOUCH-WF-001",
    "PASS-LOW-001",
    "PASS-ANG-001",
    "PASS-RUN-001",
    "PASS-THR-001",
    "PASS-LOFT-001",
    "CROSS-HI-001",
    "SHOT-PWR-001",
    "SHOT-IND-001",
    "SHOT-SWV-001",
    "HEAD-FREE-001",
    // HEAD-DUEL-001 removed — duels are out of scope for this non-duel suite.
    "CTRL-ACT-001",
  ],
  common_criterion_ids: [
    "COMMON-FINITE",
    "COMMON-DETERMINISTIC",
    "COMMON-REFERENCES",
    "COMMON-BOUNDS",
  ],
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

/**
 * Duels suite — physical contact and ball-competition criteria.
 *
 * Direct tests: PHY-SHLD-001, PHY-STR-001, PHY-BC-001, PHY-PC-001,
 *   TACK-ST-001, TACK-SL-001, TACK-ANG-001, INT-PASS-001, INT-FAST-001.
 *
 * HEAD-DUEL-001 is NOT included (headers not implemented).
 */
export const DUELS_SUITE: SuiteDefinition = {
  suite_id: "duels",
  suite_version: "suite-duels-v1",
  direct_test_ids: [
    "PHY-SHLD-001",
    "PHY-STR-001",
    "PHY-BC-001",
    "PHY-PC-001",
    "TACK-ST-001",
    "TACK-SL-001",
    "TACK-ANG-001",
    "INT-PASS-001",
    "INT-FAST-001",
  ],
  common_criterion_ids: [
    "COMMON-FINITE",
    "COMMON-DETERMINISTIC",
    "COMMON-REFERENCES",
    "COMMON-BOUNDS",
  ],
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
 * Goalkeepers suite — small-sided goalkeeper criteria.
 *
 * Direct tests are the goalkeeper catalog tests from GAMEPLAY_EVALUATION_SPEC
 * §7.4 (GK-REA-001, GK-WF-001, GK-LEG-001, GK-PARRY-001, GK-REC-001,
 * GK-HIGH-001).  Each test carries its catalog criteria plus the small-sided
 * GK behavior criteria defined in specs/GOALKEEPER_SPEC.md.  No keeper
 * behavior is implemented, so the GK-specific criteria evaluate to
 * NOT_EVALUATED (honest "not yet observable") — this suite never claims PASS
 * on gameplay.
 */
export const GOALKEEPERS_SUITE: SuiteDefinition = {
  suite_id: "goalkeepers",
  suite_version: "suite-goalkeepers-v1",
  direct_test_ids: [
    "GK-REA-001",
    "GK-WF-001",
    "GK-LEG-001",
    "GK-PARRY-001",
    "GK-REC-001",
    "GK-HIGH-001",
  ],
  common_criterion_ids: [
    "COMMON-FINITE",
    "COMMON-DETERMINISTIC",
    "COMMON-REFERENCES",
    "COMMON-BOUNDS",
  ],
  impact_closure: "NONE",
  prerequisite_capabilities: ["GOALKEEPERS"],
  seed_matrix_id: "seeds-family-v1",
  config_matrix_id: "config-goalkeepers-v1",
  held_out_policy_id: null,
  browser_case_ids: [],
  resource_policy_id: "resources-family-v1",
  outcome_reduction_profile_id: "profile-selected-v1",
  expected_expansion_manifest_id: "expansion-goalkeepers-v1",
};

/**
 * Rules suite — the MATCH_RULES_SPEC §15 adjudicating criteria.
 *
 * Direct tests are family-level rule tests (RULES-OOP-001, RULES-THROWIN-001,
 * RULES-GOALKICK-001, RULES-CORNERKICK-001, RULES-KICKOFF-001, RULES-SCORING-001,
 * RULES-TIMING-001, RULES-ANTIHUDDLE-001).  Each binds the spec-§15 criteria as
 * its criterion_bindings.  The suite has no COMMON-* criteria: the foundation
 * suites already own the shared COMMON invariants, and this suite is dedicated
 * to the match-rule semantics (the §15 criteria ARE its direct test set).
 *
 * Where a §15 criterion has a registered protected oracle the evaluator can
 * produce a real verdict; where the committed observation stream genuinely
 * cannot carry the semantics (e.g. the core matchPhase/matchTimer are not
 * serialized) the oracle returns NOT_EVALUATED and never over-claims PASS.
 */
export const RULES_SUITE: SuiteDefinition = {
  suite_id: "rules",
  suite_version: "suite-rules-v1",
  direct_test_ids: [
    "RULES-OOP-001",
    "RULES-THROWIN-001",
    "RULES-GOALKICK-001",
    "RULES-CORNERKICK-001",
    "RULES-KICKOFF-001",
    "RULES-SCORING-001",
    "RULES-TIMING-001",
    "RULES-ANTIHUDDLE-001",
  ],
  common_criterion_ids: [],
  impact_closure: "NONE",
  prerequisite_capabilities: ["MATCH_RULES"],
  seed_matrix_id: "seeds-family-v1",
  config_matrix_id: "config-rules-v1",
  held_out_policy_id: null,
  browser_case_ids: [],
  resource_policy_id: "resources-family-v1",
  outcome_reduction_profile_id: "profile-selected-v1",
  expected_expansion_manifest_id: "expansion-rules-v1",
};

/**
 * Normative declaration of the team suite required by SMALL_SIDED_SHAPE.
 *
 * This record mirrors GAMEPLAY_EVALUATION_SPEC.md §8, but it is deliberately
 * not registered in SUITES until every direct test has an executable binding.
 * Registering an unresolved suite would invalidate the executable registry and
 * falsely imply that team evaluation can already run.
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
    "TACT-COMP-001",
    "TACT-DLINE-001",
    "TACT-SUP-001",
    "TACT-TIKI-001",
    "TACT-MARK-001",
    "AI-ADAPT-001",
    "AI-ADAPT-002",
    "TRANS-AD-001",
    "TRANS-DA-001",
  ],
  common_criterion_ids: [
    "COMMON-FINITE",
    "COMMON-DETERMINISTIC",
    "COMMON-REFERENCES",
    "COMMON-BOUNDS",
  ],
  impact_closure: "NONE",
  prerequisite_capabilities: ["TEAM_TACTICS", "TRANSITION_PHASES"],
  seed_matrix_id: "seeds-team-v1",
  config_matrix_id: "config-team-v1",
  held_out_policy_id: null,
  browser_case_ids: [],
  resource_policy_id: "resources-team-v1",
  outcome_reduction_profile_id: "profile-selected-v1",
  expected_expansion_manifest_id: "expansion-team-v1",
};

/** Executable suites only; unresolved normative declarations stay out. */
export const SUITES: Record<string, SuiteDefinition> = {
  [FAST_SUITE.suite_id]: FAST_SUITE,
  [LOCOMOTION_SUITE.suite_id]: LOCOMOTION_SUITE,
  [BALL_SUITE.suite_id]: BALL_SUITE,
  [TOUCH_AND_ACTIONS_SUITE.suite_id]: TOUCH_AND_ACTIONS_SUITE,
  [DUELS_SUITE.suite_id]: DUELS_SUITE,
  [GOALKEEPERS_SUITE.suite_id]: GOALKEEPERS_SUITE,
  [RULES_SUITE.suite_id]: RULES_SUITE,
};

/**
 * Get a suite definition by suite_id.
 */
export function getSuite(suiteId: string): SuiteDefinition | undefined {
  return SUITES[suiteId];
}

/**
 * The three required foundation suites as an array.
 */
export const FOUNDATION_SUITES: SuiteDefinition[] = [
  FAST_SUITE,
  LOCOMOTION_SUITE,
  BALL_SUITE,
];