/** @module @pes/contracts/presentation - Immutable presentation snapshot contracts. */

import type { Vec2, Vec3, Heading } from "./math.js";
import type { BallRegime } from "./state.js";

/**
 * Immutable presentation facts for a committed tick.
 *
 * The renderer consumes only this type. It contains no mutable world
 * storage, solver internals, or authoritative simulation state.
 */
export interface PresentationSnapshot {
  /** Committed simulation tick. */
  tick: number;
  /** Simulation time in seconds. */
  simulationTime: number;
  /** Player presentation data (sorted by playerId). */
  players: PlayerPresentation[];
  /** Ball presentation data. */
  ball: BallPresentation;
  /** Ordered presentation events for this tick. */
  events: PresentationEvent[];
  /** Stable control-slot assignments visible to the renderer. */
  controlAssignments: {
    bySlot: Record<string, {
      teamId: string;
      controlledPlayerId: string | null;
    }>;
  };
}

/**
 * A single player's presentation-facing transform and state.
 */
export interface PlayerPresentation {
  /** Stable player identifier. */
  playerId: string;
  /** Team identifier. */
  teamId: string;
  /** Planar ground position (metres). */
  groundPosition: Vec2;
  /** Body heading in radians. */
  bodyHeading: Heading;
  /** Speed magnitude (m/s). */
  speed: number;
  /** Semantic locomotion phase. */
  locomotionPhase: "idle" | "running" | "sprinting" | "braking" | "turning";
  /** Whether this player is controlled by the local slot. */
  isControlled: boolean;
  /** Semantic action state (placeholder for later fields). */
  actionState: string | null;
  /** Semantic contact state (placeholder for later fields). */
  contactState: string | null;
}

/**
 * Ball presentation data.
 */
export interface BallPresentation {
  /** 3D position (metres). */
  position: Vec3;
  /** 3D linear velocity magnitude (m/s). */
  speed: number;
  /** Current motion regime. */
  regime: BallRegime;
  /** Whether the ball is near the ground plane (shadow/contact cue). */
  isGrounded: boolean;
  /** 3D angular velocity (rad/s). */
  angularVelocity: Vec3;
}

/**
 * An ordered presentation event for a committed tick.
 */
export interface PresentationEvent {
  /** Event identifier (matches SimulationEvent.id). */
  id: string;
  /** Simulation tick at which this event occurred. */
  tick: number;
  /** Event category. */
  kind: string;
  /** Human-readable label. */
  label: string;
}