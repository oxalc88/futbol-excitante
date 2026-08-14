/**
 * @module @pes/simulation/config/foundation
 *
 * Immutable versioned foundation configuration.
 *
 * Every provisional number is labelled provisional. No PES 2017 calibration
 * claim is made. The engine reads configuration from this module; behaviour
 * constants are never buried in system code.
 */

// -- Fixed step ---------------------------------------------------------------

/**
 * Rational fixed tick duration: 1/60 second.
 *
 * Stored as numerator/denominator to avoid floating-point ambiguity.
 * This is a laboratory choice, not a calibrated football constant.
 */
export const FOUNDATION_FIXED_DT_V1 = {
  id: "foundation-fixed-dt-v1",
  numerator: 1,
  denominator: 60,
} as const;

/** PRNG algorithm identifier. Mulberry32 under this ID. */
export const FOUNDATION_PRNG_ALGO_V1 = {
  id: "mulberry32-v1",
} as const;

/** Canonical JSON encoding identifier. */
export const FOUNDATION_ENCODING_V1 = {
  id: "canonical-json-v1",
} as const;

/** FNV-1a 64-bit hash identifier. */
export const FOUNDATION_HASH_V1 = {
  id: "fnv1a64-v1",
} as const;

// -- Locomotion (provisional) -------------------------------------------------

/**
 * Provisional locomotion coefficients.
 *
 * Every value is provisional — hand-tuned for laboratory testing only.
 * No PES 2017 calibration claim is made.
 */
export const FOUNDATION_LOCOMOTION_V1 = {
  id: "foundation-locomotion-v1",
  label: "provisional",
  maxSpeed: { value: 7.0, unit: "m/s", note: "provisional top speed" },
  acceleration: { value: 12.0, unit: "m/s²", note: "provisional linear acceleration" },
  braking: { value: 15.0, unit: "m/s²", note: "provisional deceleration rate" },
  turnRate: { value: 4.5, unit: "rad/s", note: "provisional angular turn rate" },
  lateralResistance: { value: 0.7, note: "provisional lateral velocity damping factor [0..1]" },
  sprintMultiplier: { value: 1.2, note: "provisional sprint speed multiplier" },
  neutralBrakeThreshold: { value: 0.01, unit: "m/s", note: "provisional residual velocity below which braking stops" },
} as const;

// -- Ball physics (provisional) -----------------------------------------------

/**
 * Provisional ball physics coefficients.
 *
 * Every value is provisional. No Magnus/curve, no player contact, no possession.
 */
export const FOUNDATION_BALL_V1 = {
  id: "foundation-ball-v1",
  label: "provisional",
  gravity: { value: 9.81, unit: "m/s²", note: "provisional gravitational acceleration" },
  restitution: { value: 0.55, note: "provisional bounce coefficient [0..1]" },
  groundResistance: { value: 0.02, note: "provisional ground resistance factor (speed proportional)" },
  spinDecay: { value: 0.95, note: "provisional per-second angular velocity retention factor" },
  ballRadius: { value: 0.11, unit: "m", note: "provisional ball radius" },
  airDrag: { value: 0.001, note: "provisional air drag coefficient (speed-proportional)" },
} as const;

// -- Foundation config object -------------------------------------------------

/**
 * Immutable versioned foundation config.
 *
 * All IDs must match the individual constants above. This object is
 * not mutated after creation.
 */
export const FOUNDATION_CONFIG = {
  id: "foundation-config-v1",
  fixedDt: FOUNDATION_FIXED_DT_V1,
  prngAlgorithmId: FOUNDATION_PRNG_ALGO_V1.id,
  encodingId: FOUNDATION_ENCODING_V1.id,
  hashId: FOUNDATION_HASH_V1.id,
  locomotion: FOUNDATION_LOCOMOTION_V1,
  ball: FOUNDATION_BALL_V1,
} as const;

/** Runtime type guard: this module exports the versioned config. */
export type FoundationConfig = typeof FOUNDATION_CONFIG;

/** Backward-compatible placeholder export for BOOTSTRAP-01 smoke test. */
export const placeholder = true;