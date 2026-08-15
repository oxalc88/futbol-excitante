/** @module @pes/contracts/state - Authoritative world state contracts. */

import type { Vec2, Vec3, Heading } from "./math.js";
import type { InputFrame } from "./input.js";
import type { SimulationEvent } from "./scenario.js";

// ---------------------------------------------------------------------------
// Player state
// ---------------------------------------------------------------------------

/**
 * Authoritative state for a single active player.
 *
 * All identifiers are stable across serialization and must not change
 * meaning across ticks. Array position is never player identity.
 */
export interface PlayerState {
  /** Stable player identifier (stable across serialization). */
  playerId: string;
  /** Stable team identifier. */
  teamId: string;
  /** Planar ground position (metres). */
  groundPosition: Vec2;
  /** Planar linear velocity (m/s). */
  linearVelocity: Vec2;
  /** Desired velocity (m/s) — what the locomotion system aims to achieve. */
  desiredVelocity: Vec2;
  /** Body forward direction in radians. */
  bodyHeading: Heading;
  /** Desired heading in radians (action/movement target). */
  desiredHeading: Heading;
  /** Fictional archetype assigned to this player (e.g. "archetype-burst-v1"). */
  archetypeId?: string;
  /** Transient acceleration override from the archetype (0 = baseline). */
  archetypeTransientAccel?: number;
  // -----------------------------------------------------------------
  // Fields present from bootstrap but not yet implemented:
  // - actionState
  // - actionTarget
  // - contactState
  // - balance/stability state
  // - disruption/recovery state
  // - stamina state
  // - current intention / steering target
  // - ball-control eligibility
  // - last relevant contact
  // -----------------------------------------------------------------
}

// ---------------------------------------------------------------------------
// Ball state
// ---------------------------------------------------------------------------

/**
 * Motion / contact regime for the ball.
 */
export type BallRegime = "ground-roll" | "airborne" | "bouncing" | "settled";

/**
 * A last-touch event reference that identifies the most recent interaction
 * with the ball. References must resolve within the event history of the
 * same world tick or an earlier committed tick.
 */
export type LastTouchRef = string;

/**
 * Authoritative state for the independent ball.
 *
 * The ball must NEVER be parented to a player. Its position, velocity,
 * and regime are fully independent of any control assignment.
 */
export interface BallState {
  /** 3D position (metres). */
  position: Vec3;
  /** 3D linear velocity (m/s). */
  linearVelocity: Vec3;
  /** 3D angular velocity (rad/s). */
  angularVelocity: Vec3;
  /** Current motion / contact regime. */
  regime: BallRegime;
  /** Reference to the most recent touch event. */
  lastTouchRef: LastTouchRef | null;
  // -----------------------------------------------------------------
  // Fields present from bootstrap but not yet implemented:
  // - solver state required for deterministic continuation
  // - contact history
  // -----------------------------------------------------------------
}

// ---------------------------------------------------------------------------
// World state
// ---------------------------------------------------------------------------

/**
 * Simulation schema version string. Identifies the version of the state
 * model / serialization format.
 */
export type SchemaVersion = string;
/** Simulation engine version. */
export type SimulationVersion = string;
/** Foundation config version / hash. */
export type ConfigVersion = string;

/**
 * PRNG state that is serializable and reproducible.
 * Exact shape depends on the algorithm (e.g. mulberry32-v1).
 */
export interface PrngState {
  algorithmId: string;
  seed: number;
  /** Implementation-specific state bytes/words. */
  state: unknown;
}

/**
 * Scheduler / input-policy memory that must be preserved across
 * snapshots and replays.
 */
export interface SchedulerMemory {
  /** ID of the missing-input policy in effect. */
  missingInputPolicyId: string | null;
  /** Maximum consecutive missing-input count for the current policy. */
  maxConsecutiveMissing: number;
  /** Current tick-indexed missing-input counters keyed by controlSlot. */
  missingInputCounters: Record<string, number>;
  /** Last held frame per controlSlot for repeat-held policy (no sourceId). */
  lastHeldFrames: Record<string, { moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number } | null>;
}

/**
 * Authoritative world state — the root of all simulation state.
 *
 * Player IDs are stable; array order is not identity. Players are
 * sorted by playerId for deterministic iteration. Exactly one ball
 * is required (unless a no-ball fixture is explicitly declared).
 */
export interface WorldState {
  /** Schema version of the state model. */
  schemaVersion: SchemaVersion;
  /** Simulation engine version. */
  simulationVersion: SimulationVersion;
  /** Version / hash of the immutable foundation config. */
  configVersion: ConfigVersion;
  /** Committed simulation tick (0-based). */
  tick: number;
  /** Rational fixed tick duration. */
  fixedDt: { numerator: number; denominator: number };
  /** PRNG algorithm ID and seed. */
  prng: PrngState;
  /** Stable players sorted by playerId (array position ≠ identity). */
  players: readonly PlayerState[];
  /** Exactly one independent ball. */
  ball: BallState;
  /** Ordered events generated in the committed tick or earlier. */
  events: readonly SimulationEvent[];
  /** Scheduler / input-policy continuation state. */
  schedulerMemory: SchedulerMemory;
  /** Control assignments keyed by slot — maps slot → player for input resolution. */
  controlAssignments: Record<string, { teamId: string; controlledPlayerId: string; mode: string }>;
  /** Arbitrary read-only metadata keyed by string. */
  meta?: Record<string, unknown>;
}