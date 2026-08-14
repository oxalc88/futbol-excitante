/** @module @pes/contracts/replay - Replay encode/decode contracts. */

import type { InputFrame } from "./input.js";
import type { ScenarioDefinition } from "./scenario.js";
import type { PrngState } from "./state.js";

/**
 * Replay schema version.
 */
export type ReplaySchemaVersion = string;

/**
 * Replay v1 header — identifies the provenance and reconstruction basis
 * of a recorded simulation run.
 */
export interface ReplayV1Header {
  /** Replay schema version (e.g. "replay-v1"). */
  replayVersion: ReplaySchemaVersion;
  /** Replay schema version (alias for clarity). */
  schemaVersion: ReplaySchemaVersion;
  /** Simulation build/engine version. */
  simulationVersion: string;
  /** Runtime / toolchain identity (e.g. "node-v24.18.0"). */
  runtimeIdentity: string;
  /** Foundation config version / hash. */
  configVersion: string;
  /** Foundation config hash. */
  configHash: string;
  /** Pitch/rules config hash. */
  pitchRulesHash: string;
  /** Roster/capability config hash. */
  rosterCapabilityHash: string;
  /** Full scenario hash. */
  scenarioHash: string;
  /** Initial canonical state hash (tick 0). */
  initialStateHash: string;
  /** PRNG algorithm version. */
  prngAlgorithmId: string;
  /** PRNG seed. */
  prngSeed: number;
  /** PRNG initial state for restoration. */
  prngState: PrngState;
  /** ISO timestamp of the recording (provenance, not deterministic). */
  recordedAt: string;
  /** Run identifier (provenance). */
  runId: string;
}

/**
 * A periodic state snapshot for hash comparison.
 */
export interface ReplayStateCheckpoint {
  /** Tick of the snapshot. */
  tick: number;
  /** Canonical state hash at this tick. */
  stateHash: string;
}

/**
 * Replay v1 — full recorded run data.
 */
export interface ReplayV1 {
  /** Header with provenance. */
  header: ReplayV1Header;
  /** Timeline of tick-indexed input frames. */
  inputs: InputFrame[];
  /** Ordered deterministic scheduled events. */
  scheduledEvents: Array<{ tick: number; events: { id: string; kind: string; payload: Record<string, unknown> }[] }>;
  /** Periodic canonical state hashes (one per fixed-step cadence or as configured). */
  hashes: ReplayStateCheckpoint[];
  /** Optional full checkpoints (state snapshots) for seeking / recovery. */
  checkpoints: Array<ReplayStateCheckpoint>;
  /** Full checkpoint data: encoded WorldState snapshots keyed by tick for restore. */
  checkpointsState: ReplayCheckpoint[];
}

/**
 * A full checkpoint payload — encoded WorldState for restore.
 *
 * The `encodedState` field contains the output of `encodeCheckpoint()`
 * (a checkpoint-v1 envelope with the full WorldState JSON).
 */
export interface ReplayCheckpoint {
  /** Tick at which this checkpoint was captured. */
  tick: number;
  /** Canonical state hash at this tick. */
  stateHash: string;
  /** Checkpoint envelope (checkpoint-v1 JSON) for full restore. */
  encodedState: string;
}