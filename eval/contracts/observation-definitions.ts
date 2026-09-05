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

// ---------------------------------------------------------------------------
// goalkeepers suite observations
//
// These declare the observation requirements each goalkeeper suite criterion
// needs.  No keeper serializer produces them yet, so the corresponding
// criteria evaluate to NOT_EVALUATED (honest "not yet observable").
// ---------------------------------------------------------------------------

/**
 * GK role-designation observation — which player is the designated keeper.
 */
export const OBS_GK_ROLE: ObservationDefinition = {
  observation_id: "obs-gk-role-v1",
  observation_version: "obs-gk-role-v1",
  source_kind: "RAW_CANONICAL",
  producer_boundary: "SIMULATION_SERIALIZER",
  schema_id: "gk-role-observation-v1",
  schema_version: "schema-gk-role-obs-v1",
  required_fields: [
    "tick",
    "teamId",
    "keeperPlayerId",
    "keeperRoleFlag",
  ],
  cadence: "PER_TICK",
  missing_data_behavior: "INVALID_RUN",
};

/**
 * GK positioning observation — keeper arc position, lateral drift, and bounds.
 */
export const OBS_GK_POSITIONING: ObservationDefinition = {
  observation_id: "obs-gk-positioning-v1",
  observation_version: "obs-gk-positioning-v1",
  source_kind: "RAW_CANONICAL",
  producer_boundary: "SIMULATION_SERIALIZER",
  schema_id: "gk-positioning-observation-v1",
  schema_version: "schema-gk-positioning-obs-v1",
  required_fields: [
    "tick",
    "keeperPlayerId",
    "groundPosition",
    "arcCenter",
    "arcRadius",
    "lateralDrift",
  ],
  cadence: "PER_TICK",
  missing_data_behavior: "INVALID_RUN",
};

/**
 * GK field-chase observation — whether the keeper left the arc to chase.
 */
export const OBS_GK_CHASE: ObservationDefinition = {
  observation_id: "obs-gk-chase-v1",
  observation_version: "obs-gk-chase-v1",
  source_kind: "RAW_CANONICAL",
  producer_boundary: "SIMULATION_SERIALIZER",
  schema_id: "gk-chase-observation-v1",
  schema_version: "schema-gk-chase-obs-v1",
  required_fields: ["tick", "keeperPlayerId", "onGoalArc", "fieldChaseFlag"],
  cadence: "PER_TICK",
  missing_data_behavior: "INVALID_RUN",
};

/**
 * GK save/claim observation — shot-contact to save/claim ball-contact chain.
 */
export const OBS_GK_SAVE_CLAIM: ObservationDefinition = {
  observation_id: "obs-gk-save-claim-v1",
  observation_version: "obs-gk-save-claim-v1",
  source_kind: "RAW_CANONICAL",
  producer_boundary: "SIMULATION_SERIALIZER",
  schema_id: "gk-save-claim-observation-v1",
  schema_version: "schema-gk-save-claim-obs-v1",
  required_fields: [
    "tick",
    "keeperPlayerId",
    "shotContactTick",
    "keeperContactTick",
    "contactKind",
  ],
  cadence: "PER_EVENT",
  missing_data_behavior: "INVALID_RUN",
};

/**
 * GK distribution observation — keeper release to a teammate.
 */
export const OBS_GK_DISTRIBUTION: ObservationDefinition = {
  observation_id: "obs-gk-distribution-v1",
  observation_version: "obs-gk-distribution-v1",
  source_kind: "RAW_CANONICAL",
  producer_boundary: "SIMULATION_SERIALIZER",
  schema_id: "gk-distribution-observation-v1",
  schema_version: "schema-gk-distribution-obs-v1",
  required_fields: [
    "tick",
    "keeperPlayerId",
    "releaseTick",
    "targetPlayerId",
    "releasePassRef",
  ],
  cadence: "PER_EVENT",
  missing_data_behavior: "INVALID_RUN",
};

/** All registered observation definitions keyed by observation_id. */
export const OBSERVATION_DEFINITIONS: Record<string, ObservationDefinition> = {
  [OBS_PER_TICK.observation_id]: OBS_PER_TICK,
  [OBS_BALL_MOTION.observation_id]: OBS_BALL_MOTION,
  [OBS_PLAYER_MOTION.observation_id]: OBS_PLAYER_MOTION,
  [OBS_GK_ROLE.observation_id]: OBS_GK_ROLE,
  [OBS_GK_POSITIONING.observation_id]: OBS_GK_POSITIONING,
  [OBS_GK_CHASE.observation_id]: OBS_GK_CHASE,
  [OBS_GK_SAVE_CLAIM.observation_id]: OBS_GK_SAVE_CLAIM,
  [OBS_GK_DISTRIBUTION.observation_id]: OBS_GK_DISTRIBUTION,
};

/**
 * Get an observation definition by id.
 */
export function getObservationDefinition(
  id: string,
): ObservationDefinition | undefined {
  return OBSERVATION_DEFINITIONS[id];
}