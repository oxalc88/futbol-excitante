/** @module @pes/contracts/telemetry - Telemetry observer sink contracts. */

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
  /** Committed state hash for this tick. */
  stateHash: string;
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
  }>;
}