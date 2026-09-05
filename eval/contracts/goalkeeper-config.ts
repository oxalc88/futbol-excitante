/**
 * @module @pes/eval/contracts/goalkeeper-config
 *
 * Versioned provisional configuration for the SMALL-SIDED goalkeeper model
 * `gk-small-sided-v1`.
 *
 * Every unmeasured positional / speed / reaction value a future keeper
 * behavior implementation may reference is declared here as VERSIONED
 * PROVISIONAL configuration, carrying the owning model id + version.  None
 * of these values is a measured PES constant and none is treated as PES
 * fidelity.  The authoritative prose for these values is
 * specs/GOALKEEPER_SPEC.md.
 *
 * Values that would require a real reference measurement (which does not
 * exist in the repository) are declared BLOCKED_MISSING_REFERENCE, disclosed
 * rather than invented.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

/** Owning model id for the small-sided goalkeeper configuration. */
export const GK_MODEL_ID = "gk-small-sided-v1";

/** Owning model version for the small-sided goalkeeper configuration. */
export const GK_MODEL_VERSION = "gk-small-sided-v1";

/**
 * A versioned provisional value produced by the fictional small-sided
 * goalkeeper design model.  It is an internal product value, never a PES
 * magnitude or provider-rating mapping.
 */
export interface ProvisionalGkValue {
  /** Stable config key. */
  key: string;
  /** Declared value. SI units are used where the axis has a unit. */
  value: number | string;
  /** Units (SI). Empty string for dimensionless flags. */
  units: string;
  source: "VERSIONED_PROVISIONAL";
  /** Owning model id (always GK_MODEL_ID). */
  model_id: string;
  /** Owning model version (always GK_MODEL_VERSION). */
  version: string;
  /** Short, honest note on what this value is / is not. */
  note: string;
}

/**
 * A value the small-sided keeper model would need from a real reference
 * measurement that does not yet exist.  Never inferred from expected play.
 */
export interface BlockedGkReference {
  /** Stable config key. */
  key: string;
  source: "BLOCKED_MISSING_REFERENCE";
  /** Honest reason the reference is unavailable. */
  reason: string;
}

/**
 * Versioned provisional values for the small-sided goalkeeper model.
 *
 * These are deliberate, versioned engine design choices for a fictional
 * capability.  They are not calibrated to PES 2017 and MUST NOT be treated
 * as measured magnitudes.
 */
export const GK_PROVISIONAL_VALUES: ProvisionalGkValue[] = [
  {
    key: "goal_arc_center_x_offset",
    value: 0,
    units: "m",
    source: "VERSIONED_PROVISIONAL",
    model_id: GK_MODEL_ID,
    version: GK_MODEL_VERSION,
    note: "Longitudinal offset of the keeper's nominal arc center from the goal-line center. Fictional design value; not a PES constant.",
  },
  {
    key: "goal_arc_radius",
    value: 4.0,
    units: "m",
    source: "VERSIONED_PROVISIONAL",
    model_id: GK_MODEL_ID,
    version: GK_MODEL_VERSION,
    note: "Nominal radius of the keeper's goal-arc in front of the goal line. Fictional design value; not a measured envelope.",
  },
  {
    key: "goal_arc_lateral_max",
    value: 2.5,
    units: "m",
    source: "VERSIONED_PROVISIONAL",
    model_id: GK_MODEL_ID,
    version: GK_MODEL_VERSION,
    note: "Maximum lateral drift of the keeper from the arc center along the goal line. Fictional bound; BLOCKED quantities remain separate.",
  },
  {
    key: "keeper_reposition_speed",
    value: 2.0,
    units: "m/s",
    source: "VERSIONED_PROVISIONAL",
    model_id: GK_MODEL_ID,
    version: GK_MODEL_VERSION,
    note: "Keeper's nominal lateral repositioning speed inside the goal arc. Fictional design value.",
  },
  {
    key: "keeper_reaction_window_ticks",
    value: 12,
    units: "ticks",
    source: "VERSIONED_PROVISIONAL",
    model_id: GK_MODEL_ID,
    version: GK_MODEL_VERSION,
    note: "Declared window from shot-contact to first detectable keeper motion. Tick rate is itself provisional; do not interpret as wall-clock ms.",
  },
  {
    key: "save_claim_reach_radius",
    value: 1.2,
    units: "m",
    source: "VERSIONED_PROVISIONAL",
    model_id: GK_MODEL_ID,
    version: GK_MODEL_VERSION,
    note: "Keeper's nominal contact-reach radius used to judge a feasible save/claim. Fictional design value.",
  },
  {
    key: "distribution_release_window_ticks",
    value: 10,
    units: "ticks",
    source: "VERSIONED_PROVISIONAL",
    model_id: GK_MODEL_ID,
    version: GK_MODEL_VERSION,
    note: "Declared window a keeper may hold / release after securing the ball. Fictional design value.",
  },
  {
    key: "distribution_no_omniscience",
    value: "on",
    units: "",
    source: "VERSIONED_PROVISIONAL",
    model_id: GK_MODEL_ID,
    version: GK_MODEL_VERSION,
    note: "Flag: distribution target selection uses only the keeper's modelled information, never hidden future state.",
  },
];

/**
 * Values that need a real reference measurement which does not exist.
 * These are disclosed, not invented.  A future implementation MUST NOT
 * hard-code a guessed number for any of these.
 */
export const GK_BLOCKED_REFERENCES: BlockedGkReference[] = [
  {
    key: "reaction_latency_ref_ms",
    source: "BLOCKED_MISSING_REFERENCE",
    reason: "No controlled, qualified PES reference capture of shot-contact-to-keeper-motion latency exists in the repository.",
  },
  {
    key: "save_probability_distribution",
    source: "BLOCKED_MISSING_REFERENCE",
    reason: "No eligible ReferenceTarget for a keeper save/claim probability distribution is published; acceptance parameters remain empty.",
  },
  {
    key: "wrong_foot_reversal_curve",
    source: "BLOCKED_MISSING_REFERENCE",
    reason: "GK-WF-001 is a Class-C controlled-capture criterion; until repeatable controlled PES capture exists the correction curve stays UNKNOWN.",
  },
  {
    key: "high_cross_claim_threshold",
    source: "BLOCKED_MISSING_REFERENCE",
    reason: "Aerial claim/parry decision threshold needs controlled pose/contact reference data that is not present.",
  },
  {
    key: "parry_energy_ratio",
    source: "BLOCKED_MISSING_REFERENCE",
    reason: "Surface-conditioned rebound energy ratio needs qualified monocular/bimodal reference measurement that does not exist.",
  },
];
