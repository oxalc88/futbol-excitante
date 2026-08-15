/**
 * @module @pes/eval/contracts/capability-design-profiles
 *
 * Versioned CapabilityDesignProfile for fictional engine axes.
 *
 * Per GAMEPLAY_EVALUATION_SPEC.md §5.6, these are internal product
 * values — NOT PES magnitudes and NOT provider-rating mappings.
 *
 * The initial capability axes are:
 * - transient acceleration    : IMPLEMENTED (runner exercises low vs high)
 * - physical contact          : IMPLEMENTED (runner exercises duel contact config)
 * - body control              : DEFERRED — engine cannot exercise
 * - shooting power            : DEFERRED — engine cannot exercise
 * - swerve                    : DEFERRED — engine cannot exercise
 *
 * LOC-ACC-002 binds to the transient acceleration axis.
 * PHY-PC-001 binds to the physical contact axis.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { CapabilityDesignProfile } from "./capability-design.js";

// ---------------------------------------------------------------------------
// Transient acceleration axis
// ---------------------------------------------------------------------------
// The engine's locomotion system supports capability-driven acceleration.
// This axis is exercised by the capability-design evaluation runner.
//
// The intended effect: earlier speed/distance gain under matched
// sustainable speed, while protecting the plateau.
//
// Internal profile values (0 = no transient bonus, 1 = maximum):
// These are product-level values, not PES attributes.

export const AXIS_TRANSIENT_ACCELERATION: Omit<
  CapabilityDesignProfile,
  "profile_id" | "policy_version" | "content_hash"
> = {
  profile_version: "capability-design-v1",
  axes: {
    "transient-acceleration": {
      axis_id: "transient-acceleration",
      label: "Transient acceleration",
      status: "IMPLEMENTED",
      scenario_ids: ["scn-loc-acc-002-v1"],
      metric_ids: ["player-speed", "player-displacement"],
      profile_value_low: { id: "transient-acceleration-low", value: 0 },
      profile_value_high: { id: "transient-acceleration-high", value: 1 },
      expected_monotonic_direction: "INCREASE",
      minimum_material_effect: {
        metric_id: "player-speed",
        value: 0.05,
      },
      protected_outputs: ["sustainable-speed-plateau"],
      max_permitted_cross_coupling: [
        {
          metric_id: "player-speed",
          threshold: 0.02,
        },
      ],
      seed_matrix_id: "seeds-family-v1",
      config_matrix_id: "config-locomotion-v1",
      estimator_id: "delta-speed-at-t10",
      estimator_version: "estimator-delta-speed-v1",
      policy_version: "policy-acceleration-v1",
    },
    "physical-contact": {
      axis_id: "physical-contact",
      label: "Physical contact",
      status: "IMPLEMENTED",
      scenario_ids: ["scn-duels-phy-shld-001-v1"],
      metric_ids: ["player-displacement"],
      profile_value_low: { id: "physical-contact-low", value: 0.1 },
      profile_value_high: { id: "physical-contact-high", value: 1.0 },
      expected_monotonic_direction: "DECREASE",
      minimum_material_effect: {
        metric_id: "player-displacement",
        value: 0.005,
      },
      protected_outputs: [
        "raw-locomotion-speed",
        "ai-aggression",
        "automatic-possession",
        "foul-policy",
      ],
      max_permitted_cross_coupling: [],
      seed_matrix_id: "seeds-family-v1",
      config_matrix_id: "config-player-contact-v1",
      estimator_id: "delta-displacement-at-t20",
      estimator_version: "estimator-delta-displacement-v1",
      policy_version: "policy-contact-v1",
    },
  },
  criterion_bindings: {
    // LOC-ACC-002 DESIGN criterion → transient acceleration axis
    "LOC-ACC-002-DESIGN": "transient-acceleration",
    // PHY-PC-001 DESIGN criterion → physical contact axis
    "PHY-PC-001-DESIGN": "physical-contact",
  },
};

// ---------------------------------------------------------------------------
// Deferred axes
// ---------------------------------------------------------------------------
// These axes are registered so the profile can enumerate the full
// capability scope, but their status is DEFERRED because the engine
// cannot yet exercise them.  They MUST never return PASS.

const DEFERRED_AXES: Record<string, Omit<CapabilityDesignProfile, "profile_id" | "policy_version" | "content_hash">["axes"][string]> = {
  "body-control": {
    axis_id: "body-control",
    label: "Body control",
    status: "DEFERRED",
    scenario_ids: [],
    metric_ids: [],
    profile_value_low: { id: "body-control-low", value: 0 },
    profile_value_high: { id: "body-control-high", value: 1 },
    expected_monotonic_direction: "DECREASE",
    minimum_material_effect: {
      metric_id: "player-heading-change",
      value: 0.01,
    },
    protected_outputs: ["contact-strength"],
    max_permitted_cross_coupling: [
      {
        metric_id: "player-displacement",
        threshold: 0.02,
      },
    ],
    seed_matrix_id: "seeds-family-v1",
    config_matrix_id: "config-default-v1",
    estimator_id: "absent",
    estimator_version: "absent",
    policy_version: "policy-body-control-v1",
  },
  "shooting-power": {
    axis_id: "shooting-power",
    label: "Shooting power",
    status: "DEFERRED",
    scenario_ids: [],
    metric_ids: [],
    profile_value_low: { id: "shooting-power-low", value: 0 },
    profile_value_high: { id: "shooting-power-high", value: 1 },
    expected_monotonic_direction: "INCREASE",
    minimum_material_effect: {
      metric_id: "ball-speed",
      value: 0.5,
    },
    protected_outputs: [
      "unrelated-accuracy",
      "preparation-timing",
    ],
    max_permitted_cross_coupling: [],
    seed_matrix_id: "seeds-family-v1",
    config_matrix_id: "config-default-v1",
    estimator_id: "absent",
    estimator_version: "absent",
    policy_version: "policy-shoot-power-v1",
  },
  "swerve": {
    axis_id: "swerve",
    label: "Swerve",
    status: "DEFERRED",
    scenario_ids: [],
    metric_ids: [],
    profile_value_low: { id: "swerve-low", value: 0 },
    profile_value_high: { id: "swerve-high", value: 1 },
    expected_monotonic_direction: "INCREASE",
    minimum_material_effect: {
      metric_id: "ball-distance",
      value: 0.1,
    },
    protected_outputs: [
      "base-ball-law",
      "straight-shot-symmetry",
    ],
    max_permitted_cross_coupling: [
      {
        metric_id: "ball-speed",
        threshold: 0.03,
      },
    ],
    seed_matrix_id: "seeds-family-v1",
    config_matrix_id: "config-default-v1",
    estimator_id: "absent",
    estimator_version: "absent",
    policy_version: "policy-swerve-v1",
  },
};

// ---------------------------------------------------------------------------
// Full profile (all axes combined)
// ---------------------------------------------------------------------------

/**
 * All axes in the capability design profile.
 */
const ALL_AXES: CapabilityDesignProfile["axes"] = {
  ...DEFERRED_AXES,
  ...AXIS_TRANSIENT_ACCELERATION.axes,
};

/**
 * The initial CapabilityDesignProfile.
 *
 * Contains:
 * - 2 IMPLEMENTED axes (transient acceleration, physical contact)
 * - 3 DEFERRED axes (body control, shooting power, swerve)
 *
 * The profile is structurally valid and can be loaded by the evaluator.
 * Evaluation outcome for ENGINE_DESIGN_TARGET criteria depends on
 * whether a runner exists to exercise the profile.
 */
export const CAPABILITY_DESIGN_PROFILE: CapabilityDesignProfile = {
  profile_id: "capability-design-v1",
  profile_version: "capability-design-v1",
  axes: ALL_AXES,
  criterion_bindings: AXIS_TRANSIENT_ACCELERATION.criterion_bindings,
  // content_hash is set by the loader
  content_hash: "",
  policy_version: "capability-policy-v1",
};