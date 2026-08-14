/**
 * @module @pes/eval/contracts/capability-design
 *
 * CapabilityDesignProfile types and registry interfaces.
 *
 * Per GAMEPLAY_EVALUATION_SPEC.md §5.6, every ENGINE_DESIGN_TARGET
 * criterion must resolve against a versioned CapabilityDesignProfile
 * that defines, for each fictional capability axis: the controlled
 * scenario/metric IDs, low and high profile values, expected monotonic
 * direction, minimum material effect, protected outputs, maximum
 * permitted cross-coupling, seed/config matrix, estimator, and policy
 * version.
 *
 * These internal thresholds are deliberate product values and MUST
 * NOT be described as PES magnitudes or provider-rating mappings.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

// ---------------------------------------------------------------------------
// Capability axis profile value
// ---------------------------------------------------------------------------

/**
 * A single capability-level configuration point.
 *
 * low  — the minimum profile value the engine can exercise.
 * high — the maximum profile value the engine can exercise.
 *
 * Names are deliberately neutral — they are product-level values,
 * not PES attribute labels.
 */
export interface CapabilityProfileValue {
  /** Stable identifier for this profile value. */
  id: string;
  /** Numeric value (0–1 scale is conventional, but not required). */
  value: number;
}

// ---------------------------------------------------------------------------
// Capability axis
// ---------------------------------------------------------------------------

/**
 * Describes one fictional capability axis registered with the engine.
 *
 * Every axis is either IMPLEMENTED (the engine can produce its effects)
 * or DEFERRED (the engine cannot yet exercise it).  DEFERRED axes
 * must NEVER be treated as PASS by the evaluator.
 */
export interface CapabilityAxis {
  /** Unique axis identifier. Must be alphanumeric + hyphens. */
  axis_id: string;
  /** Human-readable label (neutral, no PES/provider-rating language). */
  label: string;
  /** Whether the engine can currently exercise this axis. */
  status: "IMPLEMENTED" | "DEFERRED";
  /** Which scenarios control this axis (scenario_ids from scenario registry). */
  scenario_ids: string[];
  /** Which metrics measure this axis (metric_ids from metric registry). */
  metric_ids: string[];
  /** The low endpoint value the engine can produce. */
  profile_value_low: CapabilityProfileValue;
  /** The high endpoint value the engine can produce. */
  profile_value_high: CapabilityProfileValue;
  /** Expected monotonic direction when moving from low to high. */
  expected_monotonic_direction: "INCREASE" | "DECREASE" | "NONE";
  /**
   * Minimum material effect: the smallest change in the primary metric
   * that qualifies as a meaningful capability effect.
   */
  minimum_material_effect: {
    metric_id: string;
    /** Threshold value (in metric units). */
    value: number;
  };
  /**
   * Outputs that must NOT change when this axis changes.
   * Prevents unintended cross-coupling.
   */
  protected_outputs: string[];
  /**
   * Maximum permitted cross-coupling: the largest change in a protected
   * output that is tolerated when this axis moves between low and high.
   */
  max_permitted_cross_coupling: {
    metric_id: string;
    threshold: number;
  }[];
  /** Seed matrix used when exercising this axis. */
  seed_matrix_id: string;
  /** Config matrix used when exercising this axis. */
  config_matrix_id: string;
  /** Estimator used to derive the axis metric from observations. */
  estimator_id: string;
  estimator_version: string;
  /** Policy version for this axis. */
  policy_version: string;
}

// ---------------------------------------------------------------------------
// CapabilityDesignProfile
// ---------------------------------------------------------------------------

/**
 * Versioned capability design profile containing all registered axes.
 */
export interface CapabilityDesignProfile {
  /** Stable profile identifier. */
  profile_id: string;
  /** Profile version string. */
  profile_version: string;
  /** All registered capability axes keyed by axis_id. */
  axes: Record<string, CapabilityAxis>;
  /** Policy version for the entire profile. */
  policy_version: string;
  /**
   * Catalog-level criterion IDs that reference this profile.
   * Maps criterion_id → axis_id.
   */
  criterion_bindings: Record<string, string>;
  /** Profile content hash (computed by loader). */
  content_hash: string;
}

// ---------------------------------------------------------------------------
// Evaluation helpers
// ---------------------------------------------------------------------------

/**
 * Outcome of an ENGINE_DESIGN_TARGET criterion evaluation.
 */
export type DesignTargetOutcome =
  | "PASS"
  | "FAIL"
  | "NOT_EVALUATED"
  | "DEFERRED";

/**
 * Per-axis evaluation result from a CapabilityDesignProfile.
 */
export interface CapabilityAxisResult {
  axis_id: string;
  status: "IMPLEMENTED" | "DEFERRED";
  /** Engine outcome for this axis. */
  outcome: DesignTargetOutcome;
  /** Evidence strings describing the evaluation. */
  evidence: string[];
}