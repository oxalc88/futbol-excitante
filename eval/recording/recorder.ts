/**
 * @module eval/recording/recorder
 *
 * Records a simulation run into a ReplayV1 structure.
 *
 * Usage:
 *  1. Create a recorder with initial state.
 *  2. Feed input frames and hash snapshots per tick.
 *  3. Call build() to produce a ReplayV1.
 *
 * Node I/O is allowed in this module (eval/adapters layer).
 * The simulation core itself never reads the wall clock or I/O.
 */

import type { InputFrame } from "../../src/contracts/input.js";
import type { PrngState, WorldState, SchedulerMemory } from "../../src/contracts/state.js";
import type { ReplayV1, ReplayStateCheckpoint, ReplayCheckpoint } from "../../src/contracts/replay.js";
import type { SimulationEvent } from "../../src/contracts/scenario.js";
import { encodeCanonical } from "../../src/simulation/determinism/canonical.js";
import { hashFnv1a64 } from "../../src/simulation/determinism/hash.js";
import { encodeCheckpoint } from "../../src/adapters/replay/replay-codec.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Options for creating a recorder.
 */
export interface RecorderOptions {
  /** Simulation version string. */
  simulationVersion: string;
  /** Runtime identity string. */
  runtimeIdentity: string;
  /** Config version string. */
  configVersion: string;
  /** Config hash string. */
  configHash: string;
  /** Pitch/rules config hash. */
  pitchRulesHash: string;
  /** Roster/capability config hash. */
  rosterCapabilityHash: string;
  /** Full scenario hash. */
  scenarioHash: string;
  /** PRNG algorithm ID. */
  prngAlgorithmId: string;
  /** PRNG seed. */
  prngSeed: number;
  /** Run identifier (provenance). */
  runId: string;
  /**
   * Hash cadence: emit a hash state checkpoint every N ticks.
   * Set to 0 to disable periodic hashing. Defaults to 1 (every tick).
   */
  hashCadence?: number;
  /**
   * Checkpoint cadence: emit a full checkpoint every N ticks.
   * Set to 0 to disable periodic checkpoints. Defaults to 0 (disabled).
   */
  checkpointCadence?: number;
}

/**
 * A recorded checkpoint envelope — full state snapshot.
 */
export interface RecordedCheckpoint {
  tick: number;
  hash: string;
  /** Full WorldState JSON string. */
  state: string;
}

// ---------------------------------------------------------------------------
// Recorder state
// ---------------------------------------------------------------------------

interface RecorderInternal {
  header: {
    simulationVersion: string;
    runtimeIdentity: string;
    configVersion: string;
    configHash: string;
    pitchRulesHash: string;
    rosterCapabilityHash: string;
    scenarioHash: string;
    initialStateHash: string;
    prngAlgorithmId: string;
    prngSeed: number;
    prngState: PrngState;
    runId: string;
    recordedAt: string;
  };
  initialSnapshot: string;
  inputs: InputFrame[];
  scheduledEvents: Array<{ tick: number; events: { id: string; kind: string; payload: Record<string, unknown> }[] }>;
  hashes: ReplayStateCheckpoint[];
  checkpoints: RecordedCheckpoint[];
  schemaVersion: string;
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Create a new replay recorder.
 *
 * @param opts - Recorder options.
 * @param initialWorldState - The initial WorldState (will be JSON-serialized).
 * @returns A recorder instance.
 */
export function createRecorder(
  opts: RecorderOptions,
  initialWorldState: WorldState,
): {
  recordInput: (frames: InputFrame[]) => void;
  recordHash: (tick: number, hash: string) => void;
  recordCheckpoint: (tick: number, hash: string, worldState: WorldState) => void;
  recordScheduledEvents: (tick: number, events: SimulationEvent[]) => void;
  build: () => ReplayV1;
  state: RecorderInternal;
} {
  // Serialize initial state for hash computation.
  const initialStateJson = JSON.stringify(initialWorldState);
  let initialStateHash = "";

  try {
    const parsed = JSON.parse(initialStateJson);
    initialStateHash = hashFnv1a64(encodeCanonical(parsed));
  } catch {
    // If initial state can't be canonicalized, fall back to config hash.
    initialStateHash = opts.configHash;
  }

  const internal: RecorderInternal = {
    header: {
      simulationVersion: opts.simulationVersion,
      runtimeIdentity: opts.runtimeIdentity,
      configVersion: opts.configVersion,
      configHash: opts.configHash,
      pitchRulesHash: opts.pitchRulesHash,
      rosterCapabilityHash: opts.rosterCapabilityHash,
      scenarioHash: opts.scenarioHash,
      initialStateHash,
      prngAlgorithmId: opts.prngAlgorithmId,
      prngSeed: opts.prngSeed,
      prngState: initialWorldState.prng,
      runId: opts.runId,
      recordedAt: new Date().toISOString(),
    },
    initialSnapshot: initialStateJson,
    inputs: [],
    scheduledEvents: [],
    hashes: [],
    checkpoints: [],
    schemaVersion: initialWorldState.schemaVersion,
  };

  return {
    /**
     * Record input frames for a tick.
     *
     * SourceId is preserved as provenance — it does not affect
     * gameplay reconstruction (hashes ignore sourceId).
     */
    recordInput(frames: InputFrame[]): void {
      for (const frame of frames) {
        internal.inputs.push({ ...frame });
      }
    },

    /**
     * Record a state hash checkpoint.
     */
    recordHash(tick: number, hash: string): void {
      internal.hashes.push({ tick, stateHash: hash });
    },

    /**
     * Record a full state checkpoint.
     */
    recordCheckpoint(tick: number, hash: string, worldState: WorldState): void {
      internal.checkpoints.push({
        tick,
        hash,
        state: JSON.stringify(worldState),
      });
    },

    /**
     * Record scheduled scenario events for a tick.
     */
    recordScheduledEvents(tick: number, events: SimulationEvent[]): void {
      for (const ev of events) {
        const existing = internal.scheduledEvents.find((e) => e.tick === tick);
        if (existing) {
          existing.events.push({
            id: ev.id,
            kind: ev.kind,
            payload: { ...ev.payload },
          });
        } else {
          internal.scheduledEvents.push({
            tick,
            events: [
              {
                id: ev.id,
                kind: ev.kind,
                payload: { ...ev.payload },
              },
            ],
          });
        }
      }
    },

    /**
     * Build the final ReplayV1 object.
     */
    build(): ReplayV1 {
      return {
        header: {
          replayVersion: "replay-v1",
          ...internal.header,
          schemaVersion: internal.schemaVersion,
        },
        inputs: internal.inputs,
        scheduledEvents: internal.scheduledEvents,
        hashes: internal.hashes,
        checkpoints: internal.checkpoints.map((cp) => ({ tick: cp.tick, stateHash: cp.hash })),
        checkpointsState: internal.checkpoints.map((cp) => ({
          tick: cp.tick,
          stateHash: cp.hash,
          encodedState: encodeCheckpoint(cp.state),
        })),
      };
    },

    get state(): RecorderInternal {
      return internal;
    },
  };
}