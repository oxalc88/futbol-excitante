/** @module @pes/contracts/scenario - Scenario definition and simulation event contracts. */

import type { Vec2, Vec3 } from "./math.js";
import type { InputFrame } from "./input.js";
import type { PlayerState, BallState, SchedulerMemory } from "./state.js";

// ---------------------------------------------------------------------------
// Simulation event
// ---------------------------------------------------------------------------

/**
 * A simulation event emitted during a tick.
 *
 * Events are ordered by the tuple `(tick, sequence)` where `sequence` is
 * an integer that provides a total order within the tick. Lower sequence
 * values are earlier in the ordered list.
 */
export interface SimulationEvent {
  /** Unique event identifier. */
  id: string;
  /** Simulation tick at which this event was generated. */
  tick: number;
  /** Sequence within the tick for total ordering. */
  sequence: number;
  /** Event category: scenario / pitch-contact / rule / input-rejection / invariant */
  kind:
    | "scenario-start"
    | "scenario-stop"
    | "pitch-contact"
    | "rule"
    | "input-rejection"
    | "invariant"
    | "scheduler";
  /** Human-readable label. */
  label: string;
  /** Typed payload — schema depends on kind. */
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Scenario player entry (initial setup)
// ---------------------------------------------------------------------------

/**
 * A player initial-state entry declared in a scenario definition.
 */
export interface ScenarioPlayerEntry {
  /** Stable playerId — must be unique within the scenario. */
  playerId: string;
  /** TeamId for this player. */
  teamId: string;
  /** Initial planar ground position (metres). */
  groundPosition: Vec2;
  /** Initial planar linear velocity (m/s). */
  linearVelocity: Vec2;
  /** Initial desired velocity (m/s). */
  desiredVelocity: Vec2;
  /** Initial body heading (radians). */
  bodyHeading: number;
  /** Initial desired heading (radians). */
  desiredHeading: number;
}

/**
 * An independent ball initial-state entry declared in a scenario definition.
 */
export interface ScenarioBallEntry {
  /** Initial 3D position (metres). */
  position: Vec3;
  /** Initial 3D linear velocity (m/s). */
  linearVelocity: Vec3;
  /** Initial 3D angular velocity (rad/s). */
  angularVelocity: Vec3;
  /** Initial regime. */
  regime: BallState["regime"];
}

/**
 * A control assignment entry in a scenario.
 */
export interface ScenarioControlAssignment {
  /** Stable slot identifier. */
  controlSlot: string;
  /** Team ID. */
  teamId: string;
  /** Player ID controlled by this slot. */
  controlledPlayerId: string;
  /** Control mode. */
  mode: "HUMAN" | "AI_FALLBACK";
}

// ---------------------------------------------------------------------------
// Scenario definition
// ---------------------------------------------------------------------------

/**
 * Match profile that controls cardinality validation.
 */
export type ScenarioProfile = "LABORATORY" | "SMALL_SIDED" | "REGULATION";

/**
 * A declarative, versioned scenario definition.
 *
 * All IDs within a scenario must be unique. Input frames must reference
 * declared players via their controlSlot.
 */
export interface ScenarioDefinition {
  /** Unique scenario identifier. */
  id: string;
  /** Scenario version (semantic version or hash). */
  version: string;
  /** Scenario family for grouping (e.g. "locomotion", "ball"). */
  family: string;
  /** Number of simulation ticks to run (exclusive end). */
  durationTicks: number;
  /** Seed for the PRNG. */
  seed: number;
  /** PRNG algorithm version (e.g. "mulberry32-v1"). */
  prngAlgorithmId: string;
  /** Schema version for this scenario's world state. */
  schemaVersion: string;
  /** Simulation engine version. */
  simulationVersion: string;
  /** Foundation config version / hash. */
  configVersion: string;
  /** Match profile that controls player count validation. */
  profile: ScenarioProfile;
  /** Scenario pitch dimensions (metres). Not a universal constant. */
  pitchLength: number;
  /** Pitch width (metres). */
  pitchWidth: number;
  /** Hard safety bounds for the scenario (metres from pitch centre). */
  safetyBounds: {
    maxX: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  /** Initial players, sorted by playerId. */
  players: ScenarioPlayerEntry[];
  /** Exactly one independent ball initial state. */
  ball: ScenarioBallEntry;
  /** Control assignments keyed by slot. */
  controlAssignments: Record<string, ScenarioControlAssignment>;
  /** Missing-input policy identifier. */
  missingInputPolicy: string;
  /** Maximum consecutive missing-input count before neutral fallback. */
  maxConsecutiveMissing: number;
  /** Tick-indexed input program (sparse: only non-neutral ticks need entries). */
  inputProgram: Record<number, InputFrame[]>;
  /** Scheduled scenario events (tick-indexed). */
  scheduledEvents: Record<number, SimulationEvent[]>;
  /** Observation windows for telemetry. */
  observationWindows?: Array<{ startTick: number; endTick: number }>;
  /** Requested metric IDs. */
  requestedMetrics: string[];
  /** Optional reference target IDs (may be BLOCKED_MISSING_REFERENCE). */
  referenceTargetIds?: string[];
}