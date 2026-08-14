/**
 * @module @pes/adapters/replay/replay-codec
 *
 * Strict encode / decode for ReplayV1.
 *
 * Design:
 * - Encode produces a canonical JSON string with `schemaVersion: "replay-v1"`.
 * - Decode validates the schema version, the replay version, and that all
 *   required header fields are present and correctly typed.
 * - Unknown fields are silently preserved (forward-compatible).
 * - Unknown / incompatible simulation or schema versions FAIL rather than
 *   being silently interpreted.
 *
 * No Math.random, Date, DOM, or Node I/O in this module.
 */

import type { ReplayV1, ReplayV1Header, ReplayStateCheckpoint, ReplayCheckpoint } from "../../contracts/replay.js";
import type { InputFrame } from "../../contracts/input.js";
import type { PrngState } from "../../contracts/state.js";

// ---------------------------------------------------------------------------
// Version constants
// ---------------------------------------------------------------------------

/** Supported replay schema version. */
export const REPLAY_SCHEMA_VERSION = "replay-v1";

/** Supported replay data version. */
export const REPLAY_DATA_VERSION = "replay-data-v1";

/** Minimum simulation version the codec can decode. */
export const MIN_COMPATIBLE_SIM_VERSION = "sim-v1";

/** Minimum schema version the codec can decode. */
export const MIN_COMPATIBLE_SCHEMA_VERSION = "state-v1";

/** Minimum PRNG algorithm version the codec can decode. */
export const MIN_COMPATIBLE_PRNG_ALGO = "mulberry32-v1";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Error thrown when a replay payload is malformed or incompatible.
 */
export class ReplayCodecError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = "ReplayCodecError";
  }
}

// ---------------------------------------------------------------------------
// Helpers — strict validation
// ---------------------------------------------------------------------------

/**
 * Assert that `value` is a non-null object.
 */
function assertObject(value: unknown, context: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ReplayCodecError(
      `${context}: expected object, got ${value === null ? "null" : Array.isArray(value) ? "array" : typeof value}`,
    );
  }
  return value as Record<string, unknown>;
}

/**
 * Assert that `obj[key]` exists and is a string.
 */
function assertStringField(obj: Record<string, unknown>, key: string, context: string): string {
  const val = obj[key];
  if (typeof val !== "string") {
    throw new ReplayCodecError(
      `${context}: expected string field "${key}", got ${val === null ? "null" : typeof val}`,
    );
  }
  return val;
}

/**
 * Assert that `obj[key]` exists and is a number.
 */
function assertNumberField(obj: Record<string, unknown>, key: string, context: string): number {
  const val = obj[key];
  if (typeof val !== "number" || !Number.isFinite(val)) {
    throw new ReplayCodecError(
      `${context}: expected finite number field "${key}", got ${val === null ? "null" : typeof val}`,
    );
  }
  return val;
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

/**
 * Encode a ReplayV1 object to a JSON string.
 *
 * The output is a standard JSON string with schemaVersion embedded.
 * This is not canonical JSON — callers who need canonical encoding
 * should use encodeCanonical separately.
 *
 * @param replay - The replay to encode.
 * @returns JSON string.
 */
export function encodeReplay(replay: ReplayV1): string {
  const payload: Record<string, unknown> = {
    schemaVersion: REPLAY_SCHEMA_VERSION,
    replayVersion: REPLAY_DATA_VERSION,
    header: replay.header,
    inputs: replay.inputs,
    scheduledEvents: replay.scheduledEvents,
    hashes: replay.hashes,
    checkpoints: replay.checkpoints,
    checkpointsState: replay.checkpointsState,
  };
  return JSON.stringify(payload);
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

/**
 * Decode a JSON string back to ReplayV1, with strict validation.
 *
 * Failures include:
 * - Missing or wrong schemaVersion / replayVersion.
 * - Missing or wrong required header fields.
 * - Simulation version older than the minimum compatible version.
 * - Schema version older than the minimum compatible version.
 * - PRNG algorithm not supported.
 * - Missing required data arrays (inputs, hashes).
 *
 * @param json - The JSON string to decode.
 * @returns The decoded ReplayV1.
 * @throws ReplayCodecError on any validation failure.
 */
export function decodeReplay(json: string): ReplayV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ReplayCodecError(
      "Replay JSON parse error: " + msg,
      json.slice(0, 200),
    );
  }

  const root = assertObject(parsed, "root");

  // --- Schema version --------------------------------------------------
  const schemaVersion = assertStringField(root, "schemaVersion", "root");
  if (schemaVersion !== REPLAY_SCHEMA_VERSION) {
    throw new ReplayCodecError(
      `Incompatible schema version: expected "${REPLAY_SCHEMA_VERSION}", got "${schemaVersion}"`,
    );
  }

  const replayVersion = assertStringField(root, "replayVersion", "root");
  if (replayVersion !== REPLAY_DATA_VERSION) {
    throw new ReplayCodecError(
      `Incompatible replay data version: expected "${REPLAY_DATA_VERSION}", got "${replayVersion}"`,
    );
  }

  // --- Header ----------------------------------------------------------
  const headerObj = assertObject(root["header"], "header");

  const header: ReplayV1Header = {
    replayVersion: assertStringField(headerObj, "replayVersion", "header"),
    schemaVersion: assertStringField(headerObj, "schemaVersion", "header"),
    simulationVersion: assertStringField(headerObj, "simulationVersion", "header"),
    runtimeIdentity: assertStringField(headerObj, "runtimeIdentity", "header"),
    configVersion: assertStringField(headerObj, "configVersion", "header"),
    configHash: assertStringField(headerObj, "configHash", "header"),
    pitchRulesHash: assertStringField(headerObj, "pitchRulesHash", "header"),
    rosterCapabilityHash: assertStringField(headerObj, "rosterCapabilityHash", "header"),
    scenarioHash: assertStringField(headerObj, "scenarioHash", "header"),
    initialStateHash: assertStringField(headerObj, "initialStateHash", "header"),
    prngAlgorithmId: assertStringField(headerObj, "prngAlgorithmId", "header"),
    prngSeed: assertNumberField(headerObj, "prngSeed", "header"),
    prngState: assertObject(headerObj["prngState"], "header.prngState") as unknown as PrngState,
    recordedAt: assertStringField(headerObj, "recordedAt", "header"),
    runId: assertStringField(headerObj, "runId", "header"),
  };

  // --- Strict version compatibility check ------------------------------
  // Simulation version must be at least the minimum.
  if (compareSemver(header.simulationVersion, MIN_COMPATIBLE_SIM_VERSION) < 0) {
    throw new ReplayCodecError(
      `Simulation version "${header.simulationVersion}" is older than minimum compatible "${MIN_COMPATIBLE_SIM_VERSION}"`,
    );
  }

  // Schema version must be at least the minimum.
  if (compareSemver(header.schemaVersion, MIN_COMPATIBLE_SCHEMA_VERSION) < 0) {
    throw new ReplayCodecError(
      `Schema version "${header.schemaVersion}" is older than minimum compatible "${MIN_COMPATIBLE_SCHEMA_VERSION}"`,
    );
  }

  // PRNG algorithm must be supported.
  if (header.prngAlgorithmId !== MIN_COMPATIBLE_PRNG_ALGO) {
    throw new ReplayCodecError(
      `PRNG algorithm "${header.prngAlgorithmId}" is not supported (expected "${MIN_COMPATIBLE_PRNG_ALGO}")`,
    );
  }

  // --- Inputs ----------------------------------------------------------
  const inputsArr = root["inputs"];
  if (!Array.isArray(inputsArr)) {
    throw new ReplayCodecError("root.inputs: expected array");
  }
  const inputs: InputFrame[] = inputsArr.map((frame, i) => {
    const obj = assertObject(frame, `inputs[${i}]`);
    return {
      tick: assertNumberField(obj, "tick", `inputs[${i}]`),
      sourceId: assertStringField(obj, "sourceId", `inputs[${i}]`),
      controlSlot: assertStringField(obj, "controlSlot", `inputs[${i}]`),
      moveX: assertNumberField(obj, "moveX", `inputs[${i}]`),
      moveY: assertNumberField(obj, "moveY", `inputs[${i}]`),
      sprint: assertNumberField(obj, "sprint", `inputs[${i}]`),
      heldButtons: assertNumberField(obj, "heldButtons", `inputs[${i}]`),
      pressedButtons: assertNumberField(obj, "pressedButtons", `inputs[${i}]`),
      releasedButtons: assertNumberField(obj, "releasedButtons", `inputs[${i}]`),
    };
  });

  // --- Scheduled events -----------------------------------------------
  const schedEventsArr = root["scheduledEvents"];
  const scheduledEvents: ReplayV1["scheduledEvents"] = Array.isArray(schedEventsArr)
    ? schedEventsArr.map((entry, i) => {
        const obj = assertObject(entry, `scheduledEvents[${i}]`);
        return {
          tick: assertNumberField(obj, "tick", `scheduledEvents[${i}]`),
          events: (obj["events"] as Array<Record<string, unknown>>).map((ev, j) => {
            const evObj = assertObject(ev, `scheduledEvents[${i}].events[${j}]`);
            return {
              id: assertStringField(evObj, "id", `scheduledEvents[${i}].events[${j}]`),
              kind: assertStringField(evObj, "kind", `scheduledEvents[${i}].events[${j}]`),
              payload: assertObject(evObj, `scheduledEvents[${i}].events[${j}].payload`) as Record<string, unknown>,
            };
          }),
        };
      })
    : [];

  // --- Hashes ----------------------------------------------------------
  const hashesArr = root["hashes"];
  if (!Array.isArray(hashesArr)) {
    throw new ReplayCodecError("root.hashes: expected array");
  }
  const hashes: ReplayStateCheckpoint[] = hashesArr.map((entry, i) => {
    const obj = assertObject(entry, `hashes[${i}]`);
    return {
      tick: assertNumberField(obj, "tick", `hashes[${i}]`),
      stateHash: assertStringField(obj, "stateHash", `hashes[${i}]`),
    };
  });

  // --- Checkpoints -----------------------------------------------------
  const checkpointsArr = root["checkpoints"];
  const checkpoints: ReplayStateCheckpoint[] = Array.isArray(checkpointsArr)
    ? checkpointsArr.map((entry, i) => {
        const obj = assertObject(entry, `checkpoints[${i}]`);
        return {
          tick: assertNumberField(obj, "tick", `checkpoints[${i}]`),
          stateHash: assertStringField(obj, "stateHash", `checkpoints[${i}]`),
        };
      })
    : [];

  // --- CheckpointsState (full encoded checkpoints) --------------------
  const checkpointsStateArr = root["checkpointsState"];
  const checkpointsState: ReplayCheckpoint[] = Array.isArray(checkpointsStateArr)
    ? checkpointsStateArr.map((entry, i) => {
        const obj = assertObject(entry, `checkpointsState[${i}]`);
        return {
          tick: assertNumberField(obj, "tick", `checkpointsState[${i}]`),
          stateHash: assertStringField(obj, "stateHash", `checkpointsState[${i}]`),
          encodedState: assertStringField(obj, "encodedState", `checkpointsState[${i}]`),
        };
      })
    : [];

  return {
    header,
    inputs,
    scheduledEvents,
    hashes,
    checkpoints,
    checkpointsState,
  };
}

// ---------------------------------------------------------------------------
// Checkpoint helpers
// ---------------------------------------------------------------------------

/**
 * Encode a checkpoint snapshot to JSON for storage.
 *
 * The checkpoint includes the full WorldState (kinematics, PRNG state,
 * scheduler memory).
 *
 * @param checkpointJson - JSON string of a WorldState snapshot.
 * @returns Checkpoint envelope with metadata.
 */
export function encodeCheckpoint(checkpointJson: string): string {
  return JSON.stringify({
    schemaVersion: "checkpoint-v1",
    data: checkpointJson,
  });
}

/**
 * Decode a checkpoint snapshot to the WorldState JSON string.
 *
 * @param json - JSON string of a checkpoint envelope.
 * @returns The WorldState JSON string.
 * @throws ReplayCodecError on validation failure.
 */
export function decodeCheckpoint(json: string): string {
  const parsed = JSON.parse(json);
  const obj = assertObject(parsed, "root");
  const schemaVersion = assertStringField(obj, "schemaVersion", "root");
  if (schemaVersion !== "checkpoint-v1") {
    throw new ReplayCodecError(
      `Incompatible checkpoint version: expected "checkpoint-v1", got "${schemaVersion}"`,
    );
  }
  const data = obj["data"];
  if (typeof data !== "string") {
    throw new ReplayCodecError("checkpoint.data: expected JSON string");
  }
  return data;
}

// ---------------------------------------------------------------------------
// Minimal semver comparison (bootstrap: supports x.y.z)
// ---------------------------------------------------------------------------

/**
 * Compare two semver-like version strings.
 *
 * Supports formats like "v1", "sim-v1", "state-v0", etc.
 * Extracts the last numeric segment for comparison.
 * Returns < 0 if a < b, 0 if equal, > 0 if a > b.
 */
function compareSemver(a: string, b: string): number {
  // Extract the last numeric segment after a separator (- or .)
  const extractNum = (s: string): number => {
    const match = s.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const numA = extractNum(a);
  const numB = extractNum(b);
  if (numA < numB) return -1;
  if (numA > numB) return 1;

  // Fallback: compare the full strings lexicographically
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}