/**
 * @module apps/headless/artifacts
 *
 * Artifact writing for headless simulation runs.
 *
 * Writes the structured output files required by the bootstrap evaluation
 * pipeline. Generated artifacts remain git-ignored (under artifacts/*).
 *
 * Node I/O allowed in this module (headless adapter layer).
 * Simulation core itself never reads I/O.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ScenarioDefinition } from "../../contracts/scenario.js";
import type { TelemetryObservation } from "../../contracts/telemetry.js";
import type { ReplayV1 } from "../../contracts/replay.js";
import type { WorldState } from "../../contracts/state.js";

import { encodeCanonical } from "../../simulation/determinism/canonical.js";
import { hashFnv1a64 } from "../../simulation/determinism/hash.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Manifest describing a headless run.
 */
export interface RunManifest {
  /** Schema version of the manifest. */
  schemaVersion: "manifest-v1";
  /** Build/engine version. */
  simulationVersion: string;
  /** Runtime identity. */
  runtimeIdentity: string;
  /** Foundation config version / hash. */
  configVersion: string;
  /** Foundation config hash. */
  configHash: string;
  /** Deterministic comparison conditions. */
  comparison: {
    scenarioId: string;
    scenarioVersion: string;
    seed: number;
    prngAlgorithmId: string;
    durationTicks: number;
    profile: string;
    /** Hash of the scenario definition (canonical JSON + hash). */
    scenarioHash: string | null;
    /** Hash of the pitch/rules config. Null if not yet computed. */
    pitchRulesHash: string | null;
    /** Hash of the roster/capability config. Null if not yet computed. */
    rosterCapabilityHash: string | null;
  };
  /** Schema version of the telemetry data. */
  telemetrySchemaVersion: string;
  /** Schema version of the serialization. */
  serializationSchemaVersion: string;
  /** PRNG algorithm ID and seed. */
  prng: {
    algorithmId: string;
    seed: number;
  };
  /** Hash of the observation profile. */
  observationProfileHash: string;
}

/**
 * Minimal tick/hash record for artifact writing.
 */
export interface TickHashRecord {
  tick: number;
  hash: string;
}

/**
 * Minimal event record for artifact writing.
 */
export interface EventRecord {
  tick: number;
  id: string;
  kind: string;
  label: string;
}

/**
 * Options for writing run artifacts.
 */
export interface WriteArtifactsOptions {
  /** Output directory path. */
  outDir: string;
  /** Scenario definition used for this run. */
  scenario: ScenarioDefinition;
  /** Telemetry observations collected during the run. */
  observations: TelemetryObservation[];
  /** Per-tick state hashes. */
  hashes: TickHashRecord[];
  /** Events emitted during the run. */
  events: EventRecord[];
  /** Computed metrics (arbitrary JSON-serializable). */
  metrics: Record<string, unknown>;
  /** Invariant check results. */
  invariants: Array<{ id: string; status: string; description: string; details?: Record<string, unknown> }>;
  /** Final state hash. */
  finalStateHash: string;
  /** Replay structure for reconstruction. */
  replay: ReplayV1;
  /** Final world state (JSON-serializable). */
  finalState: Record<string, unknown>;
  /** Manifest to write. */
  manifest: RunManifest;
}

// ---------------------------------------------------------------------------
// Artifact writing
// ---------------------------------------------------------------------------

/**
 * Compute a hash of the observation profile (set of observation fields).
 */
function computeObservationProfileHash(): string {
  const profile = {
    schemaVersion: "obs-profile-v1",
    schema: "telemetry-observation-v1",
    fields: [
      "tick", "simulationTime", "prngAlgorithmId", "stateHash",
      "prngStateHash", "committedTick", "inputs", "players", "ball", "events",
    ],
  };
  return hashFnv1a64(JSON.stringify(profile));
}

/**
 * Write all artifact files for a headless run.
 *
 * Creates: manifest.json, inputs.jsonl, hashes.jsonl, telemetry.jsonl,
 * events.jsonl, metrics.json, invariants.json, final-state.json, replay.json
 *
 * @param opts - Artifact writing options.
 */
export function writeRunArtifacts(opts: WriteArtifactsOptions): void {
  const {
    outDir,
    scenario,
    observations,
    hashes,
    events,
    metrics,
    invariants,
    replay,
    finalState,
    manifest,
  } = opts;

  // Ensure output directory exists.
  mkdirSync(outDir, { recursive: true });

  // 1. manifest.json
  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  // 2. inputs.jsonl — one InputFrame per line.
  {
    const inputLines: string[] = [];
    for (const obs of observations) {
      for (const frame of obs.inputs) {
        inputLines.push(JSON.stringify(frame));
      }
    }
    writeFileSync(join(outDir, "inputs.jsonl"), inputLines.join("\n") + "\n");
  }

  // 3. hashes.jsonl — one state hash per line.
  {
    const hashLines: string[] = hashes.map((h) => JSON.stringify(h));
    writeFileSync(join(outDir, "hashes.jsonl"), hashLines.join("\n") + "\n");
  }

  // 4. telemetry.jsonl — one TelemetryObservation per line.
  {
    const lines: string[] = observations.map((obs) => JSON.stringify(obs));
    writeFileSync(join(outDir, "telemetry.jsonl"), lines.join("\n") + "\n");
  }

  // 5. events.jsonl — one event per line.
  {
    const lines: string[] = events.map((ev) => JSON.stringify(ev));
    writeFileSync(join(outDir, "events.jsonl"), lines.join("\n") + "\n");
  }

  // 6. metrics.json
  writeFileSync(
    join(outDir, "metrics.json"),
    JSON.stringify(metrics, null, 2),
  );

  // 7. invariants.json
  writeFileSync(
    join(outDir, "invariants.json"),
    JSON.stringify(invariants, null, 2),
  );

  // 8. final-state.json
  writeFileSync(
    join(outDir, "final-state.json"),
    JSON.stringify(finalState, null, 2),
  );

  // 9. replay.json
  writeFileSync(
    join(outDir, "replay.json"),
    JSON.stringify(replay, null, 2),
  );
}

/**
 * Create a manifest for the given scenario and options.
 */
export function createManifest(opts: {
  scenario: ScenarioDefinition;
  simulationVersion: string;
  runtimeIdentity: string;
  configVersion: string;
  configHash: string;
  scenarioHash?: string;
  pitchRulesHash?: string;
  rosterCapabilityHash?: string;
}): RunManifest {
  return {
    schemaVersion: "manifest-v1",
    simulationVersion: opts.simulationVersion,
    runtimeIdentity: opts.runtimeIdentity,
    configVersion: opts.configVersion,
    configHash: opts.configHash,
    comparison: {
      scenarioId: opts.scenario.id,
      scenarioVersion: opts.scenario.version,
      seed: opts.scenario.seed,
      prngAlgorithmId: opts.scenario.prngAlgorithmId,
      durationTicks: opts.scenario.durationTicks,
      profile: opts.scenario.profile,
      scenarioHash: opts.scenarioHash ?? null,
      pitchRulesHash: opts.pitchRulesHash ?? null,
      rosterCapabilityHash: opts.rosterCapabilityHash ?? null,
    },
    telemetrySchemaVersion: "telemetry-v1",
    serializationSchemaVersion: "canonical-json-v1",
    prng: {
      algorithmId: opts.scenario.prngAlgorithmId,
      seed: opts.scenario.seed,
    },
    observationProfileHash: computeObservationProfileHash(),
  };
}