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
  /**
   * Transient acceleration coefficient [0..1].
   * 0 = no early-speed bonus (pure baseline acceleration).
   * 1 = maximum early-speed bonus (explosive initial acceleration).
   * Only affects early-phase acceleration; sustainable-speed plateau is unchanged.
   */
  transientAcceleration: { value: 0, note: "provisional transient acceleration coefficient [0..1]" },
} as const;

/**
 * Transient-acceleration locomotion config.
 *
 * Identical to FOUNDATION_LOCOMOTION_V1 but with a default
 * transientAcceleration of 0.0 — the neutral baseline for the
 * capability-design evaluator to compare high vs low values.
 */
export const TRANSIENT_ACCEL_LOCOMOTION_V1 = {
  id: "foundation-locomotion-v1",
  label: "provisional",
  maxSpeed: { value: 7.0, unit: "m/s", note: "provisional top speed" },
  acceleration: { value: 12.0, unit: "m/s²", note: "provisional linear acceleration" },
  braking: { value: 15.0, unit: "m/s²", note: "provisional deceleration rate" },
  turnRate: { value: 4.5, unit: "rad/s", note: "provisional angular turn rate" },
  lateralResistance: { value: 0.7, note: "provisional lateral velocity damping factor [0..1]" },
  sprintMultiplier: { value: 1.2, note: "provisional sprint speed multiplier" },
  neutralBrakeThreshold: { value: 0.01, unit: "m/s", note: "provisional residual velocity below which braking stops" },
  transientAcceleration: { value: 0, note: "provisional transient acceleration coefficient [0..1]" },
} as const;

// -- Ball physics (provisional) -----------------------------------------------

/**
 * Provisional ball physics coefficients.
 *
 * Every value is provisional. No Magnus/curve magnitude claim (curve is
 * driven by a spin-dependent Magnus force in ball-system.ts).
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
  /**
   * Magnus-style curve coefficient (provisional).
   *
   * During free flight the ball's horizontal spin (angularVelocity.z)
   * generates a lateral acceleration perpendicular to the velocity:
   *   a_curve = curveCoefficient × |v_h| × ω_z
   * Zero angular velocity → zero curve force → zero deviation.
   *
   * Fictional product value — NOT a PES 2017 calibration claim.
   */
  curveCoefficient: { value: 0.0005, note: "provisional Magnus curve coefficient (ball physics)" },
} as const;

// -- Player-ball contact (provisional) ----------------------------------------

/**
 * Provisional player-ball contact / first-touch coefficients.
 *
 * Every value is provisional — hand-tuned for laboratory testing only.
 * No PES 2017 calibration claim is made.
 *
 * The contact system uses proximity + an explicit input bit to resolve
 * first-touch events. Ball velocity is modified by an impulse model;
 * position is never teleported.
 */
export const FOUNDATION_CONTACT_V1 = {
  id: "foundation-contact-v1",
  label: "provisional",
  /** Proximity radius (metres) at which a first-touch is geometrically possible. */
  contactRadius: { value: 1.2, unit: "m", note: "provisional contact proximity radius" },
  /** Maximum horizontal speed the ball can have on contact and still be controlled. */
  maxApproachSpeed: { value: 30.0, unit: "m/s", note: "provisional max controllable approach speed" },
  /** Impulse fraction: what fraction of the approach speed is applied as redirection. */
  impulseFraction: { value: 0.8, note: "provisional outgoing velocity fraction of incoming speed" },
  /** Vertical damping: fraction of z-velocity retained on a ground-level first-touch. */
  verticalDamping: { value: 0.2, note: "provisional z-velocity retention on ground touch" },
  /** Default outgoing horizontal speed when the ball is nearly stopped. */
  defaultExitSpeed: { value: 3.0, unit: "m/s", note: "provisional exit speed for near-stationary ball" },
} as const;

// -- Pass coefficients (provisional) ------------------------------------------

/**
 * Provisional pass coefficients.
 *
 * Every value is provisional — hand-tuned for laboratory testing only.
 * No PES 2017 calibration claim is made.
 *
 * A pass applies an impulse along the player's body heading. The ball
 * remains an independent 3D entity; position is never teleported.
 */
export const FOUNDATION_PASS_V1 = {
  id: "foundation-pass-v1",
  label: "provisional",
  /** Proximity radius (metres) at which a pass is geometrically possible. */
  passRadius: { value: 1.2, unit: "m", note: "provisional pass proximity radius" },
  /** Exit speed (m/s) applied to the ball along body heading. */
  exitSpeed: { value: 8.0, unit: "m/s", note: "provisional pass exit speed" },
  /** Vertical launch component: fraction of exitSpeed projected upward. */
  verticalComponent: { value: 0.05, note: "provisional upward velocity fraction" },
} as const;

// -- Lofted pass coefficients (provisional) -----------------------------------

/**
 * Provisional lofted/chip pass coefficients.
 *
 * Every value is provisional — hand-tuned for laboratory testing only.
 * No PES 2017 calibration claim is made.
 *
 * A lofted pass applies a pass impulse with a higher vertical component
 * for a chip/through-ball trajectory. The ball remains an independent
 * 3D entity; position is never teleported.
 */
export const FOUNDATION_LOFTED_PASS_V1 = {
  id: "foundation-lofted-pass-v1",
  label: "provisional",
  /** Proximity radius (metres) at which a lofted pass is geometrically possible. */
  passRadius: { value: 1.2, unit: "m", note: "provisional lofted pass proximity radius" },
  /** Exit speed (m/s) applied to the ball along the pass direction. */
  exitSpeed: { value: 7.5, unit: "m/s", note: "provisional lofted pass exit speed" },
  /** Vertical launch component: fraction of exitSpeed projected upward. Higher than standard pass. */
  verticalComponent: { value: 0.25, note: "provisional upward velocity fraction for lofted trajectory" },
} as const;

// -- Shot coefficients (provisional) -----------------------------------------

/**
 * Provisional shot coefficients.
 *
 * Every value is provisional — hand-tuned for laboratory testing only.
 * No PES 2017 calibration claim is made.
 *
 * A shot applies a stronger lofted impulse along the player's body
 * heading. The ball remains an independent 3D entity; position is
 * never teleported.
 */
export const FOUNDATION_SHOT_V1 = {
  id: "foundation-shot-v1",
  label: "provisional",
  /** Proximity radius (metres) at which a shot is geometrically possible. */
  shotRadius: { value: 1.2, unit: "m", note: "provisional shot proximity radius" },
  /** Exit speed (m/s) applied to the ball along body heading. */
  exitSpeed: { value: 12.0, unit: "m/s", note: "provisional shot exit speed" },
  /** Vertical launch component: fraction of exitSpeed projected upward for loft. */
  verticalComponent: { value: 0.15, note: "provisional upward velocity fraction for loft" },
} as const;

// -- Second-touch / dribble state (provisional) -------------------------------

/**
 * Provisional second-touch / dribble state coefficients.
 *
 * Every value is provisional — hand-tuned for laboratory testing only.
 * No PES 2017 calibration claim is made.
 *
 * After a first-touch contact, the player enters a "dribble" state where
 * the ball stays within range, velocity is dampened to match player
 * movement, and the player can perform turn/drag/feint actions. The
 * ball remains an independent 3D entity; position is never teleported.
 */
export const FOUNDATION_SECOND_TOUCH_V1 = {
  id: "foundation-second-touch-v1",
  label: "provisional",
  /** Proximity radius (metres) within which the ball stays during active dribble. */
  dribbleRange: { value: 1.5, unit: "m", note: "provisional dribble proximity range" },
  /** Maximum ball speed factor relative to player speed during dribble [0..1]. */
  ballSpeedFactor: { value: 0.8, note: "provisional fraction of player speed applied to ball during dribble" },
  /** Minimum ticks between turn actions during dribble. */
  turnCooldownTicks: { value: 4, unit: "ticks", note: "provisional minimum ticks between turn actions" },
  /** Maximum consecutive ticks of active dribble before ball becomes loose. */
  maxDribbleTicks: { value: 120, unit: "ticks", note: "provisional max dribble duration before loose ball" },
  /** Tick after first-touch before second-touch/turn actions are allowed. */
  secondTouchDelay: { value: 2, unit: "ticks", note: "provisional ticks after first touch before turn actions" },
} as const;

// -- Close-control / dribble-touch (provisional) ------------------------------

/**
 * Provisional close-control / dribble-touch coefficients.
 *
 * Every value is provisional — hand-tuned for laboratory testing only.
 * No PES 2017 calibration claim is made.
 *
 * Close control is the repeated feasibility of micro-contacts while a
 * player moves with FIRST_TOUCH held and is within range.  The ball
 * remains an independent 3D entity; only its velocity is modified.
 * Position is never teleported.  Ownership is never assigned.
 */
export const FOUNDATION_CLOSE_CONTROL_V1 = {
  id: "foundation-close-control-v1",
  label: "provisional",
  /** Proximity radius (metres) within which dribble-touches are possible. */
  dribbleRadius: { value: 1.2, unit: "m", note: "provisional dribble proximity radius" },
  /** Multiplier of player speed applied as outgoing ball horizontal speed. */
  pushAheadFraction: { value: 0.7, note: "provisional fraction of player speed transferred to ball" },
  /** Minimum ticks between successive dribble-touches per player. */
  cooldownTicks: { value: 6, unit: "ticks", note: "provisional minimum ticks between dribble-touches" },
  /** Minimum player speed (m/s) required for movement-direction dribble. */
  minPlayerSpeed: { value: 0.3, unit: "m/s", note: "provisional minimum player speed for direction-based dribble" },
} as const;

// -- Defensive tackle actions (provisional) -----------------------------------

/**
 * Provisional standing / sliding tackle coefficients.
 *
 * Every value is provisional — hand-tuned for laboratory testing only.
 * No PES 2017 calibration claim is made, and no measured reference envelope
 * exists for these numbers (`BLOCKED_MISSING_REFERENCE` for any PES target).
 *
 * A tackle is an ordered commit: prepare → active → recover. Contact with the
 * ball or an opposing player is geometrically eligible ONLY inside the
 * explicit active window declared here, and only within `standingReach` /
 * `slideReach`. There is no permanent or omnidirectional tackle collider. The
 * recovery window both restricts movement (recovery cost) and blocks an
 * instant re-tackle. Nothing here assigns a position: the ball stays an
 * independent 3D entity and bodies keep integrating through velocity.
 */
export const FOUNDATION_TACKLE_V1 = {
  id: "foundation-tackle-v1",
  label: "provisional",
  /** Planar reach (metres) of a standing tackle during its active window. */
  standingReach: { value: 1.6, unit: "m", note: "provisional standing tackle reach" },
  /** Planar reach (metres) of a sliding tackle during its active window. */
  slideReach: { value: 2.8, unit: "m", note: "provisional sliding tackle reach" },
  /** Ticks between the input tick and the opening of the standing active window. */
  standingPrepareTicks: { value: 2, unit: "ticks", note: "provisional standing prepare window" },
  /** Ticks the standing tackle's contact-eligible active window stays open. */
  standingActiveTicks: { value: 4, unit: "ticks", note: "provisional standing active window" },
  /** Ticks of restricted movement after the standing active window closes. */
  standingRecoverTicks: { value: 12, unit: "ticks", note: "provisional standing recovery window" },
  /** Ticks between the input tick and the opening of the sliding active window. */
  slidePrepareTicks: { value: 3, unit: "ticks", note: "provisional slide prepare window" },
  /** Ticks the sliding tackle's contact-eligible active window stays open. */
  slideActiveTicks: { value: 9, unit: "ticks", note: "provisional slide active window" },
  /** Ticks of restricted movement after the sliding active window closes. */
  slideRecoverTicks: { value: 26, unit: "ticks", note: "provisional slide recovery window" },
  /** Fraction of max speed available while preparing a tackle (commitment). */
  prepareSpeedFactor: { value: 0.55, note: "provisional speed cap factor during prepare [0..1]" },
  /** Fraction of max speed available during the active window. */
  activeSpeedFactor: { value: 0.8, note: "provisional speed cap factor during active window [0..1]" },
  /** Fraction of max speed available during recovery — the recovery cost. */
  recoverySpeedFactor: { value: 0.25, note: "provisional speed cap factor during recovery [0..1]" },
  /** Forward body speed (m/s) the sliding lunge sustains during its active window. */
  slideLungeSpeed: { value: 5.0, unit: "m/s", note: "provisional slide lunge speed" },
  /** Horizontal speed (m/s) given to the ball when an active-window tackle wins it. */
  ballDeflectionSpeed: { value: 7.5, unit: "m/s", note: "provisional tackle ball deflection speed" },
  /** Vertical component applied to a tackled ball as a fraction of deflection speed. */
  ballDeflectionLift: { value: 0.06, note: "provisional upward fraction on tackle deflection" },
  /** Speed (m/s) pushed into the dispossessed carrier along the contact normal. */
  carrierImpulseSpeed: { value: 1.4, unit: "m/s", note: "provisional duel separation impulse" },
  /**
   * Minimum dot product between the committed tackle direction and the
   * direction to the target for contact to be geometrically eligible.
   * `0` is a forward hemisphere (±90° half-angle) around the direction the
   * body committed to at the input tick — never an omnidirectional collider.
   */
  contactConeMinCos: { value: 0, note: "provisional forward contact cone cosine" },
} as const;

/** Tackle configuration type. */
export type TackleConfig = typeof FOUNDATION_TACKLE_V1;

/**
 * Provisional CPU defensive-tackle decision coefficients.
 *
 * Every value is provisional — hand-tuned for laboratory testing only.
 * No PES 2017 calibration claim is made and no measured reference envelope
 * exists for these numbers (`BLOCKED_MISSING_REFERENCE` for any PES target).
 *
 * These are decision thresholds for a CPU defender reading its own
 * observation: how long the geometry must hold before the CPU is allowed to
 * react, how much slack inside the action's reach a commit still needs, and
 * when an opponent is close enough to the ball for the challenge to be a duel
 * rather than a lunge at loose leather. The action geometry itself — reach,
 * phase windows, forward contact cone, slide lunge speed — is never duplicated
 * here: the decision reads `FOUNDATION_TACKLE_V1`, the same versioned
 * declaration the tackle system executes, so a CPU can only ever commit to
 * what its own body can actually do.
 */
export const FOUNDATION_CPU_TACKLE_V1 = {
  id: "foundation-cpu-tackle-v1",
  label: "provisional",
  /**
   * Consecutive ticks the commit geometry must stay satisfied before a CPU is
   * allowed to press a tackle bit. Provisional perception/reaction latency:
   * without it a CPU would act on the exact tick the geometry first appears.
   */
  reactionTicks: { value: 3, unit: "ticks", note: "provisional CPU defensive reaction latency" },
  /**
   * Metres of slack kept inside the action's declared reach when predicting the
   * target position, so a commit is never balanced on the reach boundary.
   */
  commitMargin: { value: 0.3, unit: "m", note: "provisional in-reach safety margin" },
  /**
   * Planar distance (metres) within which the nearest opposing player counts as
   * the ball's carrier for a contested challenge. Provisional; matches the
   * order of the observation-level possession radius, not a measured value.
   */
  carrierContestDistance: { value: 2.5, unit: "m", note: "provisional ball-carrier contest radius" },
  /**
   * Whether a CPU may commit the long-recovery slide anywhere, or only as a
   * last resort inside its own third. Provisional risk gate: the slide costs
   * `slideRecoverTicks` of capped movement, so committing it in the opponent's
   * third would open the return lane for no defensive benefit.
   */
  slideOwnThirdOnly: { value: true, note: "provisional risk gate on the long slide recovery" },
  /**
   * Speed (m/s) at which the defender→ball gap must be growing before a CPU
   * trades the cheap standing challenge for the long-recovery slide. If the
   * gap is not opening, running on and standing-tackling later is the
   * temporally justified choice, so the slide stays a stretch for a carrier
   * that is getting away.
   */
  slideEscapeSpeed: {
    value: 0.5,
    unit: "m/s",
    note: "provisional gap-opening rate that justifies the slide commitment",
  },
  /**
   * Roles allowed to commit a defensive tackle. Provisional team-role policy:
   * attackers stay forward and are not given the defensive commit.
   */
  committingRoles: {
    value: ["defender", "midfielder"] as ReadonlyArray<"defender" | "midfielder">,
    note: "provisional role gate for defensive tackle commitment",
  },
  /**
   * Body speed (m/s) below which a stationary defender orients its commit from
   * `bodyHeading` instead of its velocity direction. Provisional epsilon.
   */
  orientationSpeedEpsilon: { value: 0.1, unit: "m/s", note: "provisional still-orientation threshold" },
} as const;

/** CPU defensive-tackle configuration type. */
export type CpuTackleConfig = typeof FOUNDATION_CPU_TACKLE_V1;

// -- Player-player contact (provisional) --------------------------------------

/**
 * Provisional player-player contact / duel coefficients.
 *
 * Every value is provisional — hand-tuned for laboratory testing only.
 * No PES 2017 calibration claim is made.
 *
 * The resolver uses simple planar collision geometry with a symmetric
 * separation model. Both players receive equal correction; there is
 * no "higher stat wins" mechanism. Position and velocity are corrected
 * continuously — no teleporting past the configured maximum per tick.
 *
 * §12.4 of TECHNICAL_SPEC: "Normal players use simple planar collision
 * geometry and a deterministic custom resolver."
 */
export const FOUNDATION_PLAYER_CONTACT_V1 = {
  id: "foundation-player-contact-v1",
  label: "provisional",
  /** Planar radius (metres) of each player's collision disc. */
  playerRadius: { value: 0.25, unit: "m", note: "provisional planar collision radius" },
  /** Maximum positional correction (metres) applied per tick per player. */
  maxCorrectionPerTick: { value: 0.15, unit: "m", note: "provisional max separation displacement per tick" },
  /** Positional separation stiffness (fraction of overlap to correct). */
  separationStiffness: { value: 0.5, note: "provisional fraction of overlap to resolve per tick [0..1]" },
  /** Velocity damping factor along the contact normal [0..1]. */
  velocityDampingNormal: { value: 0.3, note: "provisional velocity damping along contact normal" },
  /** Velocity damping factor perpendicular to the contact normal [0..1]. */
  velocityDampingTangent: { value: 0.0, note: "provisional velocity damping along tangent (0 = no friction)" },
  /** Minimum planar distance to avoid numerical instability on coincident centres. */
  minSeparationEpsilon: { value: 0.001, unit: "m", note: "provisional epsilon for coincident-centre fallback axis" },
} as const;

// -- Goal geometry (provisional) ----------------------------------------------

/**
 * Provisional goal geometry.
 *
 * Every value is provisional — standard football dimensions labelled
 * provisional. No PES 2017 calibration claim is made.
 */
export const FOUNDATION_GOAL_V1 = {
  id: "foundation-goal-v1",
  label: "provisional",
  postRadius: { value: 0.05, unit: "m", note: "provisional goal post radius" },
  crossbarRadius: { value: 0.05, unit: "m", note: "provisional crossbar radius" },
  goalWidth: { value: 7.32, unit: "m", note: "standard goal width between posts" },
  goalHeight: { value: 2.44, unit: "m", note: "standard goal height from ground to crossbar" },
} as const;

/** Goal configuration type. */
export type GoalConfig = typeof FOUNDATION_GOAL_V1;

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
  contact: FOUNDATION_CONTACT_V1,
  pass: FOUNDATION_PASS_V1,
  loftedPass: FOUNDATION_LOFTED_PASS_V1,
  shot: FOUNDATION_SHOT_V1,
  closeControl: FOUNDATION_CLOSE_CONTROL_V1,
  secondTouch: FOUNDATION_SECOND_TOUCH_V1,
  playerContact: FOUNDATION_PLAYER_CONTACT_V1,
  goal: FOUNDATION_GOAL_V1,
} as const;

/** Runtime type guard: this module exports the versioned config. */
export type FoundationConfig = typeof FOUNDATION_CONFIG;

/** Backward-compatible placeholder export for BOOTSTRAP-01 smoke test. */
export const placeholder = true;

// ---------------------------------------------------------------------------
// Fictional archetypes (provisional)
// ---------------------------------------------------------------------------

/**
 * Versioned fictional archetypes applied per-player.
 *
 * These are engine-design targets (NOT PES player names or provider ratings).
 * Every coefficient is provisional and versioned so changes are auditable.
 */

export interface ArchetypeDefinition {
  /** Stable archetype identifier (e.g. "archetype-burst-v1"). */
  id: string;
  /** Human-readable label (e.g. "provisional"). */
  label: string;
  /** Transient acceleration coefficient [0..1]. 0 = no bonus (steady), 1 = maximum early-speed bonus. */
  transientAcceleration: { value: number; note: string };
  /** Optional sprint multiplier override (undefined = use locomotion config default). */
  sprintMultiplier?: { value: number; note: string };
}

/**
 * Burst archetype — higher transient acceleration for explosive early speed.
 *
 * Fictional product name, not a PES player name or rating.
 */
export const ARCHETYPE_BURST_V1: ArchetypeDefinition = {
  id: "archetype-burst-v1",
  label: "provisional",
  transientAcceleration: { value: 1.0, note: "provisional max early-speed bonus — no PES calibration" },
} as const;

/**
 * Steady archetype — baseline locomotion, no transient acceleration bonus.
 *
 * This is the default so existing one-player scenarios stay identical.
 */
export const ARCHETYPE_STEADY_V1: ArchetypeDefinition = {
  id: "archetype-steady-v1",
  label: "provisional",
  transientAcceleration: { value: 0, note: "provisional zero bonus — baseline locomotion" },
} as const;

/** Map of all registered archetype definitions by id. */
export const ARCHETYPE_REGISTRY: Record<string, ArchetypeDefinition> = {
  [ARCHETYPE_BURST_V1.id]: ARCHETYPE_BURST_V1,
  [ARCHETYPE_STEADY_V1.id]: ARCHETYPE_STEADY_V1,
};