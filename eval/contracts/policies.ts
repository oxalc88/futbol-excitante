/**
 * @module @pes/eval/contracts/policies
 *
 * Versioned policy stubs for every policy ID referenced by the
 * three foundation-lab suites (fast, locomotion, ball).
 *
 * These are structural placeholders — no PES constants or calibrated
 * parameters.  A future step will populate them with versioned data
 * tied to controlled-capture evidence.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { SuiteDefinition } from "./types.js";

// ---------------------------------------------------------------------------
// Seed-matrix policy (spec §3)
// ---------------------------------------------------------------------------

export interface SeedMatrixPolicy {
  policy_id: string;
  policy_version: string;
  kind: "FIXED" | "MATRIX";
  seeds: number[];
  scenario_ids: string[];
  description: string;
}

// ---------------------------------------------------------------------------
// Config-matrix policy (spec §3)
// ---------------------------------------------------------------------------

export interface ConfigMatrixPolicy {
  policy_id: string;
  policy_version: string;
  config_refs: Record<string, string>;
  description: string;
}

// ---------------------------------------------------------------------------
// Resource policy (spec §3)
// ---------------------------------------------------------------------------

export interface ResourcePolicy {
  policy_id: string;
  policy_version: string;
  tier: "FAST" | "TARGETED" | "DEEP" | "PROMOTION";
  max_concurrent: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Outcome-reduction policy (spec §3)
// ---------------------------------------------------------------------------

export interface OutcomeReductionPolicy {
  policy_id: string;
  policy_version: string;
  required_outcome: "PASS";
  treat_unknown_as: "EXCLUDE" | "INCLUDE_FAIL";
  description: string;
}

// ---------------------------------------------------------------------------
// Expansion manifest (spec §3)
// ---------------------------------------------------------------------------

export interface ExpansionManifest {
  /** Registry key / policy id for this expansion manifest. */
  policy_id: string;
  suite_id: string;
  suite_version: string;
  direct_test_ids: string[];
  expanded_test_ids: string[];
  common_criterion_ids: string[];
  impact_closure: "NONE" | "REACHABLE_FIXED_POINT";
  catalog_version: string;
  registry_set_id: string;
  content_hash: string;
}

// ---------------------------------------------------------------------------
// Seed-matrix policies (referenced by suite seed_matrix_id)
// ---------------------------------------------------------------------------

export const SEED_SMOKE_V1: SeedMatrixPolicy = {
  policy_id: "seeds-smoke-v1",
  policy_version: "seed-matrix-smoke-v1",
  kind: "FIXED",
  seeds: [42],
  scenario_ids: [],
  description: "Single-seed smoke policy for fast-suite validation.",
};

export const SEED_FAMILY_V1: SeedMatrixPolicy = {
  policy_id: "seeds-family-v1",
  policy_version: "seed-matrix-family-v1",
  kind: "FIXED",
  seeds: [42, 137, 256],
  scenario_ids: [],
  description: "Three-seed family policy for locomotion and ball suites.",
};

// ---------------------------------------------------------------------------
// Config-matrix policies (referenced by suite config_matrix_id)
// ---------------------------------------------------------------------------

export const CONFIG_DEFAULT_V1: ConfigMatrixPolicy = {
  policy_id: "config-default-v1",
  policy_version: "config-matrix-default-v1",
  config_refs: {
    foundation: "foundation-locomotion-v1",
  },
  description: "Default config for fast-suite runs.",
};

export const CONFIG_LOCOMOTION_V1: ConfigMatrixPolicy = {
  policy_id: "config-locomotion-v1",
  policy_version: "config-matrix-locomotion-v1",
  config_refs: {
    foundation: "foundation-locomotion-v1",
  },
  description: "Locomotion-suite config.",
};

export const CONFIG_BALL_V1: ConfigMatrixPolicy = {
  policy_id: "config-ball-v1",
  policy_version: "config-matrix-ball-v1",
  config_refs: {
    foundation: "foundation-locomotion-v1",
  },
  description: "Ball-suite config.",
};

export const CONFIG_ACTIONS_V1: ConfigMatrixPolicy = {
  policy_id: "config-actions-v1",
  policy_version: "config-matrix-actions-v1",
  config_refs: {
    foundation: "foundation-locomotion-v1",
  },
  description: "Touch-and-actions-suite config.",
};

// ---------------------------------------------------------------------------
// Resource policies (referenced by suite resource_policy_id)
// ---------------------------------------------------------------------------

export const RESOURCES_FAST_V1: ResourcePolicy = {
  policy_id: "resources-fast-v1",
  policy_version: "resource-policy-fast-v1",
  tier: "FAST",
  max_concurrent: 1,
  description: "Lightweight resource policy for the fast suite.",
};

export const RESOURCES_FAMILY_V1: ResourcePolicy = {
  policy_id: "resources-family-v1",
  policy_version: "resource-policy-family-v1",
  tier: "FAST",
  max_concurrent: 2,
  description: "Resource policy for locomotion and ball suites.",
};

// ---------------------------------------------------------------------------
// Outcome-reduction policies (referenced by suite outcome_reduction_profile_id)
// ---------------------------------------------------------------------------

export const REQUIRED_HARD_V1: OutcomeReductionPolicy = {
  policy_id: "required-hard-v1",
  policy_version: "outcome-reduction-required-hard-v1",
  required_outcome: "PASS",
  treat_unknown_as: "EXCLUDE",
  description:
    "Fast-suite reduction: only HARD_INVARIANT required outcomes count.",
};

export const PROFILE_SELECTED_V1: OutcomeReductionPolicy = {
  policy_id: "profile-selected-v1",
  policy_version: "outcome-reduction-profile-selected-v1",
  required_outcome: "PASS",
  treat_unknown_as: "EXCLUDE",
  description:
    "Locomotion/ball reduction: per-milestone-profile rules.",
};

// ---------------------------------------------------------------------------
// Expansion manifests (referenced by suite expected_expansion_manifest_id)
// ---------------------------------------------------------------------------

/**
 * Build an expansion manifest stub.
 *
 * With impact_closure === "NONE", expanded_test_ids === unique sorted
 * direct_test_ids of the suite.
 */
function makeExpansionManifest(
  suite: SuiteDefinition,
  policyId: string,
  registrySetId: string,
  contentHash: string,
): ExpansionManifest {
  const unique = [...new Set(suite.direct_test_ids)].sort();
  return {
    policy_id: policyId,
    suite_id: suite.suite_id,
    suite_version: suite.suite_version,
    direct_test_ids: suite.direct_test_ids,
    expanded_test_ids: unique,
    common_criterion_ids: suite.common_criterion_ids,
    impact_closure: suite.impact_closure,
    catalog_version: "gameplay-evaluation-v2",
    registry_set_id: registrySetId,
    content_hash: contentHash,
  };
}

/**
 * Expansion stubs — populated with a placeholder registry-set ID and
 * hash.  The loader will replace these with real values after
 * canonical encoding.
 */
export const EXPANSION_FAST_V1: ExpansionManifest = {
  policy_id: "expansion-fast-v1",
  suite_id: "fast",
  suite_version: "suite-fast-v1",
  direct_test_ids: ["BALL-IND-001", "LOC-ACC-001", "BALL-GND-001"],
  expanded_test_ids: ["BALL-GND-001", "BALL-IND-001", "LOC-ACC-001"],
  common_criterion_ids: [
    "COMMON-FINITE",
    "COMMON-DETERMINISTIC",
    "COMMON-REFERENCES",
  ],
  impact_closure: "NONE",
  catalog_version: "gameplay-evaluation-v2",
  registry_set_id: "placeholder",
  content_hash: "placeholder",
};

export const EXPANSION_LOCOMOTION_V1: ExpansionManifest = {
  policy_id: "expansion-locomotion-v1",
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
  expanded_test_ids: [
    "CTRL-LAT-001",
    "LOC-ACC-001",
    "LOC-ACC-002",
    "LOC-BALL-001",
    "LOC-DEC-001",
    "LOC-MAX-001",
    "LOC-ORI-001",
    "LOC-REV-001",
    "LOC-T45-001",
    "LOC-T90-001",
  ],
  common_criterion_ids: [
    "COMMON-FINITE",
    "COMMON-DETERMINISTIC",
    "COMMON-REFERENCES",
    "COMMON-BOUNDS",
  ],
  impact_closure: "NONE",
  catalog_version: "gameplay-evaluation-v2",
  registry_set_id: "placeholder",
  content_hash: "placeholder",
};

export const EXPANSION_BALL_V1: ExpansionManifest = {
  policy_id: "expansion-ball-v1",
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
  expanded_test_ids: [
    "BALL-BNC-001",
    "BALL-GND-001",
    "BALL-GND-002",
    "BALL-IND-001",
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
  catalog_version: "gameplay-evaluation-v2",
  registry_set_id: "placeholder",
  content_hash: "placeholder",
};

export const EXPANSION_TOUCH_ACTIONS_V1: ExpansionManifest = {
  policy_id: "expansion-touch-actions-v1",
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
  expanded_test_ids: [
    "CROSS-HI-001",
    "CTRL-ACT-001",
    "HEAD-FREE-001",
    "PASS-ANG-001",
    "PASS-LOW-001",
    "PASS-LOFT-001",
    "PASS-RUN-001",
    "PASS-THR-001",
    "SHOT-IND-001",
    "SHOT-PWR-001",
    "SHOT-SWV-001",
    "TOUCH-90-001",
    "TOUCH-BACK-001",
    "TOUCH-FAST-001",
    "TOUCH-SLOW-001",
    "TOUCH-WF-001",
  ],
  common_criterion_ids: [
    "COMMON-FINITE",
    "COMMON-DETERMINISTIC",
    "COMMON-REFERENCES",
    "COMMON-BOUNDS",
  ],
  impact_closure: "NONE",
  catalog_version: "gameplay-evaluation-v2",
  registry_set_id: "placeholder",
  content_hash: "placeholder",
};

// ---------------------------------------------------------------------------
// Policy registries
// ---------------------------------------------------------------------------

/** Seed-matrix policies keyed by policy_id. */
export const SEED_POLICIES: Record<string, SeedMatrixPolicy> = {
  [SEED_SMOKE_V1.policy_id]: SEED_SMOKE_V1,
  [SEED_FAMILY_V1.policy_id]: SEED_FAMILY_V1,
};

/** Config-matrix policies keyed by policy_id. */
export const CONFIG_POLICIES: Record<string, ConfigMatrixPolicy> = {
  [CONFIG_DEFAULT_V1.policy_id]: CONFIG_DEFAULT_V1,
  [CONFIG_LOCOMOTION_V1.policy_id]: CONFIG_LOCOMOTION_V1,
  [CONFIG_BALL_V1.policy_id]: CONFIG_BALL_V1,
  [CONFIG_ACTIONS_V1.policy_id]: CONFIG_ACTIONS_V1,
};

/** Resource policies keyed by policy_id. */
export const RESOURCE_POLICIES: Record<string, ResourcePolicy> = {
  [RESOURCES_FAST_V1.policy_id]: RESOURCES_FAST_V1,
  [RESOURCES_FAMILY_V1.policy_id]: RESOURCES_FAMILY_V1,
};

/** Outcome-reduction policies keyed by policy_id. */
export const OUTCOME_REDUCTION_POLICIES: Record<
  string,
  OutcomeReductionPolicy
> = {
  [REQUIRED_HARD_V1.policy_id]: REQUIRED_HARD_V1,
  [PROFILE_SELECTED_V1.policy_id]: PROFILE_SELECTED_V1,
};

/** Expansion manifests keyed by their registry policy_id (the
 * `expected_expansion_manifest_id` used by suites). */
export const EXPANSION_MANIFESTS: Record<string, ExpansionManifest> = {
  "expansion-fast-v1": EXPANSION_FAST_V1,
  "expansion-locomotion-v1": EXPANSION_LOCOMOTION_V1,
  "expansion-ball-v1": EXPANSION_BALL_V1,
  "expansion-touch-actions-v1": EXPANSION_TOUCH_ACTIONS_V1,
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getSeedPolicy(id: string): SeedMatrixPolicy | undefined {
  return SEED_POLICIES[id];
}

export function getConfigPolicy(id: string): ConfigMatrixPolicy | undefined {
  return CONFIG_POLICIES[id];
}

export function getResourcePolicy(id: string): ResourcePolicy | undefined {
  return RESOURCE_POLICIES[id];
}

export function getOutcomeReductionPolicy(
  id: string,
): OutcomeReductionPolicy | undefined {
  return OUTCOME_REDUCTION_POLICIES[id];
}

export function getExpansionManifest(
  suiteId: string,
): ExpansionManifest | undefined {
  return EXPANSION_MANIFESTS[suiteId];
}