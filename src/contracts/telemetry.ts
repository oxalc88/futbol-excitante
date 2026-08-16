/**
 * @module @pes/contracts/telemetry - Telemetry observer sink contracts.
 *
 * The core writes observations through an injected observer; it never
 * writes files, console logs, or sockets directly.
 *
 * The observer must not mutate the data in a way that affects
 * authoritative state, RNG consumption, or event ordering.
 */

import type { Vec2, Vec3, Heading } from "./math.js";
import type { InputFrame } from "./input.js";
import type { BallRegime } from "./state.js";

/**
 * Observer profile ID. Determines observation density and schema.
 */
export type ObserverProfileId = "FULL_FORENSIC" | "METRIC_ONLINE" | "PERFORMANCE_MINIMAL";

/**
 * A per-tick telemetry observation emitted by the simulation core.
 *
 * The core writes these to an injected observer sink; it never writes
 * files, console logs, or sockets directly.
 *
 * The observer must not mutate the data in a way that affects
 * authoritative state, RNG consumption, or event ordering.
 */
export interface TelemetryObservation {
  /** Simulation tick this observation pertains to. */
  tick: number;
  /** Simulation time in seconds (tick * fixedDt). */
  simulationTime: number;
  /** PRNG algorithm ID and state hash (not the raw state). */
  prngAlgorithmId: string;
  /** Committed state hash for this tick (full world state). */
  stateHash: string;
  /**
   * Hash of the serializable PRNG snapshot (prngAlgorithmId + seed +
   * state fields encoded as canonical JSON). This allows the evaluator
   * to verify that the PRNG state is stable across identical runs.
   */
  prngStateHash: string;
  /** Hash of the observation-core fields (tick, prng, players, ball, events).
   * Computed by the simulation at commit time; the camera-hash oracle
   * independently recomputes over the same core fields and compares. */
  observationCoreHash: string;
  /** Committed tick (matches observation tick for committed observations). */
  committedTick: number;
  /** Ordered input frames received for this tick. */
  inputs: InputFrame[];
  /** Player observations keyed by playerId. */
  players: {
    playerId: string;
    teamId: string;
    groundPosition: Vec2;
    linearVelocity: Vec2;
    desiredVelocity: Vec2;
    bodyHeading: Heading;
    desiredHeading: Heading;
  }[];
  /** Ball observation. */
  ball: {
    position: Vec3;
    linearVelocity: Vec3;
    angularVelocity: Vec3;
    regime: BallRegime;
    lastTouchRef: string | null;
  };
  /** Ordered events emitted at this tick. */
  events: Array<{
    id: string;
    tick: number;
    sequence: number;
    kind: string;
    label: string;
    /** Typed payload — schema depends on kind. */
    payload?: Record<string, unknown>;
  }>;
}

// ---------------------------------------------------------------------------
// Bootstrap telemetry — structured output for headless evaluation
// ---------------------------------------------------------------------------

/**
 * A player observation emitted by the bootstrap telemetry pipeline.
 * Includes both desired and actual kinematics for metric computation.
 */
export interface BootstrapPlayerObservation {
  /** Player identifier. */
  playerId: string;
  /** Team identifier. */
  teamId: string;
  /** Planar ground position (metres). */
  groundPosition: Vec2;
  /** Planar linear velocity (m/s). */
  linearVelocity: Vec2;
  /** Desired velocity (m/s). */
  desiredVelocity: Vec2;
  /** Body heading (radians). */
  bodyHeading: Heading;
  /** Desired heading (radians). */
  desiredHeading: Heading;
}

/**
 * A ball observation emitted by the bootstrap telemetry pipeline.
 */
export interface BootstrapBallObservation {
  /** 3D position (metres). */
  position: Vec3;
  /** 3D linear velocity (m/s). */
  linearVelocity: Vec3;
  /** 3D angular velocity (rad/s). */
  angularVelocity: Vec3;
  /** Current motion regime. */
  regime: BallRegime;
  /** Reference to the most recent touch event. */
  lastTouchRef: string | null;
}

/**
 * A simulation event as emitted in telemetry (stripped payload).
 */
export interface TelemetryEvent {
  id: string;
  tick: number;
  sequence: number;
  kind: string;
  label: string;
}

/**
 * An observation window result containing all observations within the window.
 */
export interface ObservationWindow {
  startTick: number;
  endTick: number;
  observations: TelemetryObservation[];
}

/**
 * Output from the evaluation pipeline: metrics computed from observations.
 */
export interface EvaluationMetrics {
  /** Metrics keyed by requested metric ID. */
  [metricId: string]: unknown;
}

/**
 * An invariant check result.
 */
export interface InvariantResult {
  /** Unique invariant identifier. */
  id: string;
  /** Pass, fail, or not_evaluated (for deferred mutants whose spec does not yet exist). */
  status: "pass" | "fail" | "not_evaluated";
  /** Human-readable description of the check. */
  description: string;
  /** Optional details. */
  details?: Record<string, unknown>;
}

/**
 * A comparison result between two simulation runs.
 */
export interface ComparisonResult {
  /** Match status. */
  status: "match" | "delta_only" | "mismatch";
  /** Earliest tick where hashes diverge (undefined if match). */
  earliestDivergenceTick?: number;
  /** Earliest divergence expected hash. */
  earliestDivergenceExpected?: string;
  /** Earliest divergence actual hash. */
  earliestDivergenceActual?: string;
  /** Metric deltas keyed by metric ID. */
  metricDeltas?: Record<string, { expected: unknown; actual: unknown }>;
  /** Comparison-condition hash match. */
  conditionHashMatch: boolean;
}