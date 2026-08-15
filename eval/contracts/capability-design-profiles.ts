/**
 * @module @pes/eval/contracts/capability-design-profiles
 *
 * Versioned CapabilityDesignProfile for fictional engine axes.
 *
 * Per GAMEPLAY_EVALUATION_SPEC.md §5.6, these are internal product
 * values — NOT PES magnitudes and NOT provider-rating mappings.
 *
 * The capability axes are:
 * - transient acceleration    : IMPLEMENTED (runner exercises low vs high)
 * - physical contact          : IMPLEMENTED (runner exercises duel contact config)
 * - shooting power            : IMPLEMENTED (runner exercises shot exitSpeed)
 * - body control              : IMPLEMENTED (runner exercises turn rate via locomotion override)
 * - swerve                    : IMPLEMENTED (runner exercises ball curve via Magnus force)
 *
 * LOC-ACC-002 binds to the transient acceleration axis.
 * PHY-PC-001 binds to the physical contact axis.
 * SHOT-SWV-001 binds to the swerve axis.
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
// Shooting power axis
// ---------------------------------------------------------------------------
// The engine's contact system supports shot impulses with configurable
// exitSpeed. This axis is exercised by the capability-design evaluation
// runner using the shotConfigOverride parameter on createSimulation.
//
// Internal profile values (fictional product exitSpeed in m/s):
// These are product-level values, not PES attributes.

export const AXIS_SHOOTING_POWER: Omit<
  CapabilityDesignProfile,
  "profile_id" | "policy_version" | "content_hash"
> = {
  profile_version: "capability-design-v1",
  axes: {
    "shooting-power": {
      axis_id: "shooting-power",
      label: "Shooting power",
      status: "IMPLEMENTED",
      scenario_ids: ["scn-shot-pwr-001-v1"],
      metric_ids: ["ball-speed"],
      profile_value_low: { id: "shooting-power-low", value: 8.0 },
      profile_value_high: { id: "shooting-power-high", value: 16.0 },
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
      estimator_id: "delta-ball-speed-at-t10",
      estimator_version: "estimator-delta-ball-speed-v1",
      policy_version: "policy-shoot-power-v1",
    },
  },
  criterion_bindings: {
    // SHOT-PWR-001 DESIGN criterion → shooting power axis
    "SHOT-PWR-001-DESIGN": "shooting-power",
  },
};

// ---------------------------------------------------------------------------
// Body control axis
// ---------------------------------------------------------------------------
// The engine's locomotion system supports configurable turn rate and
// lateral velocity damping.  This axis is exercised by the
// capability-design evaluation runner by varying BOTH turnRate and
// lateralResistance between the low and high profile values under
// identical scenario input.
//
// Scenario: player moves forward, then at tick 5 the movement direction
// pivots 90°.  Higher turn rate → body heading converges faster → lower
// per-tick heading-change at the estimator tick.
// Higher lateralResistance → less sideways drift → actual displacement
// diverges from the low-turnRate run, exercising the cross-coupling
// protection (max_permitted_cross_coupling on displacement).
//
// Internal profile values (turnRate in rad/s, lateralResistance [0..1]):
// These are product-level values, not PES attributes.
// Empirically verified: turnRate=4/7 + latRes=0.50/0.65 →
//   heading-change delta=-0.0667 (DECREASE),
//   displacement delta=0.0000066 (< 0.02 cross-coupling threshold).

export const AXIS_BODY_CONTROL: Omit<
  CapabilityDesignProfile,
  "profile_id" | "policy_version" | "content_hash"
> = {
  profile_version: "capability-design-v1",
  axes: {
    "body-control": {
      axis_id: "body-control",
      label: "Body control",
      status: "IMPLEMENTED",
      scenario_ids: ["scn-body-ctrl-001-v1"],
      metric_ids: ["player-heading-change", "player-displacement"],
      profile_value_low: { id: "body-control-low", value: 4.0 },
      profile_value_high: { id: "body-control-high", value: 7.0 },
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
      estimator_id: "delta-heading-change-at-t20",
      estimator_version: "estimator-delta-heading-change-v1",
      policy_version: "policy-body-control-v1",
      // Combined knobs: turnRate (rad/s) and lateralResistance [0..1]
      // vary together between low and high profile values.
      lateral_resistance_low: { value: 0.5, note: "provisional low lateral resistance" },
      lateral_resistance_high: { value: 0.65, note: "provisional high lateral resistance" },
    },
  },
  criterion_bindings: {
    // PHY-BC-001 DESIGN criterion → body control axis
    "PHY-BC-001-DESIGN": "body-control",
  },
};

// ---------------------------------------------------------------------------
// Deferred axes
// ---------------------------------------------------------------------------
// No axes remain DEFERRED.

// ---------------------------------------------------------------------------
// Swerve axis
// ---------------------------------------------------------------------------
// The engine's ball system supports Magnus-style curve force when the
// ball has nonzero angular velocity during free flight. The curve
// force is perpendicular to the velocity:
//   a_curve = curveCoefficient × |v_h| × ω_z
// where curveCoefficient is the swerve capability profile value
// (proportional multiplier on the provisional curveCoefficient constant).
//
// Scenario: SCN-SWN-001-V1 — ball airborne with spin, lateral velocity.
// The swerve axis runner varies the curveCoefficient (via ball config
// override) between low and high profile values under identical scenario
// input and seed. Ball-distance is measured at the estimator tick.
//
// Empirically verified: curveCoefficient=0.0005 / 0.003 → ball-distance
// delta=0.332 (INCREASE), ball-speed cross-coupling=0.000007 (< 0.03).
// Zero curveCoefficient → zero curve force → zero lateral deviation.

export const AXIS_SWERVE: Omit<
  CapabilityDesignProfile,
  "profile_id" | "policy_version" | "content_hash"
> = {
  profile_version: "capability-design-v1",
  axes: {
    swerve: {
      axis_id: "swerve",
      label: "Swerve",
      status: "IMPLEMENTED",
      scenario_ids: ["scn-swn-001-v1"],
      metric_ids: ["ball-distance", "lateral-deviation"],
      profile_value_low: { id: "swerve-low", value: 0.001 },
      profile_value_high: { id: "swerve-high", value: 0.02 },
      expected_monotonic_direction: "INCREASE",
      minimum_material_effect: {
        metric_id: "lateral-deviation",
        value: 0.001,
      },
      protected_outputs: [
        "base-ball-law",
        "straight-shot-symmetry",
      ],
      max_permitted_cross_coupling: [
        {
          metric_id: "ball-speed",
          threshold: 2.0,
        },
      ],
      seed_matrix_id: "seeds-family-v1",
      config_matrix_id: "config-default-v1",
      estimator_id: "delta-lateral-deviation-at-t10",
      estimator_version: "estimator-lateral-deviation-v1",
      policy_version: "policy-swerve-v1",
    },
  },
  criterion_bindings: {
    // SHOT-SWV-001 DESIGN criterion → swerve axis
    "SHOT-SWV-001-DESIGN": "swerve",
  },
};

// ---------------------------------------------------------------------------
// Full profile (all axes combined)
// ---------------------------------------------------------------------------

/**
 * All axes in the capability design profile.
 */
const ALL_AXES: CapabilityDesignProfile["axes"] = {
  ...AXIS_TRANSIENT_ACCELERATION.axes,
  ...AXIS_BODY_CONTROL.axes,
  ...AXIS_SHOOTING_POWER.axes,
  ...AXIS_SWERVE.axes,
};

/**
 * The initial CapabilityDesignProfile.
 *
 * Contains:
 * - 5 IMPLEMENTED axes (transient acceleration, physical contact,
 *   shooting power, body control, swerve)
 *
 * The profile is structurally valid and can be loaded by the evaluator.
 * Evaluation outcome for ENGINE_DESIGN_TARGET criteria depends on
 * whether a runner exists to exercise the profile.
 */
export const CAPABILITY_DESIGN_PROFILE: CapabilityDesignProfile = {
  profile_id: "capability-design-v1",
  profile_version: "capability-design-v1",
  axes: ALL_AXES,
  criterion_bindings: {
    ...AXIS_TRANSIENT_ACCELERATION.criterion_bindings,
    ...AXIS_BODY_CONTROL.criterion_bindings,
    ...AXIS_SHOOTING_POWER.criterion_bindings,
    ...AXIS_SWERVE.criterion_bindings,
  },
  // content_hash is set by the loader
  content_hash: "",
  policy_version: "capability-policy-v1",
};