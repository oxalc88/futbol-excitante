/**
 * @module @pes/eval/contracts/observation-definitions
 *
 * ObservationDefinition registry entries.
 *
 * The two core observations needed by catalog tests:
 * - obs-per-tick-v1      : per-tick canonical state observations
 * - obs-ball-motion-v1   : ball-motion-specific observations
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { ObservationDefinition } from "./types.js";

/**
 * Per-tick canonical observation — captures full state every tick.
 * Maps to the FULL_FORENSIC observation profile.
 */
export const OBS_PER_TICK: ObservationDefinition = {
  observation_id: "obs-per-tick-v1",
  observation_version: "obs-per-tick-v1",
  source_kind: "RAW_CANONICAL",
  producer_boundary: "SIMULATION_SERIALIZER",
  schema_id: "telemetry-observation-v1",
  schema_version: "schema-tel-obs-v1",
  required_fields: [
    "tick",
    "simulationTime",
    "prngAlgorithmId",
    "stateHash",
    "prngStateHash",
    "committedTick",
    "inputs",
    "players",
    "ball",
    "events",
  ],
  cadence: "PER_TICK",
  missing_data_behavior: "INVALID_RUN",
};

/**
 * Ball-motion-specific observation — ball kinematics every tick.
 * A subset of the per-tick observation, used by ball-motion metrics.
 */
export const OBS_BALL_MOTION: ObservationDefinition = {
  observation_id: "obs-ball-motion-v1",
  observation_version: "obs-ball-motion-v1",
  source_kind: "RAW_CANONICAL",
  producer_boundary: "SIMULATION_SERIALIZER",
  schema_id: "ball-observation-v1",
  schema_version: "schema-ball-obs-v1",
  required_fields: [
    "position",
    "linearVelocity",
    "angularVelocity",
    "regime",
    "lastTouchRef",
  ],
  cadence: "PER_TICK",
  missing_data_behavior: "INVALID_RUN",
};

/**
 * Player-motion-specific observation — player kinematics every tick.
 * A subset of the per-tick observation, used by player-motion metrics.
 */
export const OBS_PLAYER_MOTION: ObservationDefinition = {
  observation_id: "obs-player-motion-v1",
  observation_version: "obs-player-motion-v1",
  source_kind: "RAW_CANONICAL",
  producer_boundary: "SIMULATION_SERIALIZER",
  schema_id: "player-observation-v1",
  schema_version: "schema-player-obs-v1",
  required_fields: [
    "groundPosition",
    "linearVelocity",
    "desiredVelocity",
    "bodyHeading",
    "desiredHeading",
  ],
  cadence: "PER_TICK",
  missing_data_behavior: "INVALID_RUN",
};

/** All registered observation definitions keyed by observation_id. */
export const OBSERVATION_DEFINITIONS: Record<string, ObservationDefinition> = {
  [OBS_PER_TICK.observation_id]: OBS_PER_TICK,
  [OBS_BALL_MOTION.observation_id]: OBS_BALL_MOTION,
  [OBS_PLAYER_MOTION.observation_id]: OBS_PLAYER_MOTION,
};

/**
 * Get an observation definition by id.
 */
export function getObservationDefinition(
  id: string,
): ObservationDefinition | undefined {
  return OBSERVATION_DEFINITIONS[id];
}