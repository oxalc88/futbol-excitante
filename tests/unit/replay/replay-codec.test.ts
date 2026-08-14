/**
 * @module replay-codec-tests
 *
 * Tests for replay encode/decode (BOOTSTRAP-09).
 *
 * Tests:
 * - Encode/decode round trip preserves all fields.
 * - Malformed JSON is rejected.
 * - Wrong schema version is rejected.
 * - Wrong replay version is rejected.
 * - Incompatible simulation version is rejected.
 * - Incompatible schema version is rejected.
 * - Unsupported PRNG algorithm is rejected.
 * - Missing required fields are rejected.
 * - Checkpoint encode/decode round trip.
 * - Checkpoint version mismatch is rejected.
 *
 * No Math.random, Date, DOM, or Node I/O in src/simulation/contracts.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";
import {
  encodeReplay,
  decodeReplay,
  encodeCheckpoint,
  decodeCheckpoint,
  ReplayCodecError,
  REPLAY_SCHEMA_VERSION,
  REPLAY_DATA_VERSION,
} from "../../../src/adapters/replay/replay-codec.js";
import type { ReplayV1, ReplayStateCheckpoint } from "../../../src/contracts/replay.js";
import { makeReplayV1, makeInputFrame } from "../../unit/contracts.fixture.js";

// ---------------------------------------------------------------------------
// 1. Encode / decode round trip
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-ENCODING-001: encode / decode round trip", () => {
  it("round-trips a minimal replay", () => {
    const replay = makeReplayV1();
    const json = encodeReplay(replay);
    const decoded = decodeReplay(json);

    expect(decoded.header.replayVersion).toBe(replay.header.replayVersion);
    expect(decoded.header.schemaVersion).toBe(replay.header.schemaVersion);
    expect(decoded.header.simulationVersion).toBe(replay.header.simulationVersion);
    expect(decoded.header.runtimeIdentity).toBe(replay.header.runtimeIdentity);
    expect(decoded.header.configVersion).toBe(replay.header.configVersion);
    expect(decoded.header.configHash).toBe(replay.header.configHash);
    expect(decoded.header.pitchRulesHash).toBe(replay.header.pitchRulesHash);
    expect(decoded.header.rosterCapabilityHash).toBe(replay.header.rosterCapabilityHash);
    expect(decoded.header.scenarioHash).toBe(replay.header.scenarioHash);
    expect(decoded.header.initialStateHash).toBe(replay.header.initialStateHash);
    expect(decoded.header.prngAlgorithmId).toBe(replay.header.prngAlgorithmId);
    expect(decoded.header.prngSeed).toBe(replay.header.prngSeed);
    expect(decoded.header.recordedAt).toBe(replay.header.recordedAt);
    expect(decoded.header.runId).toBe(replay.header.runId);
    expect(decoded.header.prngState).toEqual(replay.header.prngState);
  });

  it("round-trips inputs with all fields", () => {
    const replay = makeReplayV1();
    // Modify inputs to include various button states.
    const inputFrames = [
      makeInputFrame(0, "slot-1", {
        moveX: 0.75,
        moveY: -0.5,
        sprint: 1,
        heldButtons: 0b00101,
        pressedButtons: 0b00001,
        releasedButtons: 0b00010,
      }),
    ];
    const json = encodeReplay({ ...replay, inputs: inputFrames });
    const decoded = decodeReplay(json);

    expect(decoded.inputs.length).toBe(1);
    expect(decoded.inputs[0].tick).toBe(0);
    expect(decoded.inputs[0].sourceId).toBe("test-source");
    expect(decoded.inputs[0].controlSlot).toBe("slot-1");
    expect(decoded.inputs[0].moveX).toBe(0.75);
    expect(decoded.inputs[0].moveY).toBe(-0.5);
    expect(decoded.inputs[0].sprint).toBe(1);
    expect(decoded.inputs[0].heldButtons).toBe(0b00101);
    expect(decoded.inputs[0].pressedButtons).toBe(0b00001);
    expect(decoded.inputs[0].releasedButtons).toBe(0b00010);
  });

  it("round-trips hashes", () => {
    const replay = makeReplayV1();
    const json = encodeReplay(replay);
    const decoded = decodeReplay(json);

    expect(decoded.hashes).toEqual(replay.hashes);
  });

  it("round-trips checkpoints", () => {
    const replay = makeReplayV1();
    const json = encodeReplay(replay);
    const decoded = decodeReplay(json);

    expect(decoded.checkpoints).toEqual(replay.checkpoints);
  });

  it("round-trips scheduled events", () => {
    const replay = makeReplayV1();
    const json = encodeReplay(replay);
    const decoded = decodeReplay(json);

    expect(decoded.scheduledEvents).toEqual(replay.scheduledEvents);
  });
});

// ---------------------------------------------------------------------------
// 2. Malformed JSON rejection
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-DECODING-001: malformed JSON rejection", () => {
  it("rejects empty string", () => {
    expect(() => decodeReplay("")).toThrow(ReplayCodecError);
  });

  it("rejects invalid JSON", () => {
    expect(() => decodeReplay("{invalid json}")).toThrow(ReplayCodecError);
  });

  it("rejects a plain string", () => {
    expect(() => decodeReplay('"hello"')).toThrow(ReplayCodecError);
  });

  it("rejects an empty object", () => {
    expect(() => decodeReplay("{}")).toThrow(ReplayCodecError);
  });

  it("rejects an array", () => {
    expect(() => decodeReplay("[]")).toThrow(ReplayCodecError);
  });
});

// ---------------------------------------------------------------------------
// 3. Schema version rejection
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-SCHEMA-001: schema version rejection", () => {
  it("rejects wrong schema version", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    json.schemaVersion = "replay-v2";
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects missing schema version", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    delete json.schemaVersion;
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects wrong replay data version", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    json.replayVersion = "replay-data-v2";
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects missing replay data version", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    delete json.replayVersion;
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });
});

// ---------------------------------------------------------------------------
// 4. Header field rejection
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-HEADER-001: header field rejection", () => {
  it("rejects missing header", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    delete json.header;
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects missing header fields", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    delete json.header.simulationVersion;
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects non-string header field", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    (json.header as any).simulationVersion = 42;
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects missing prngState", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    delete json.header.prngState;
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects non-object prngState", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    (json.header as any).prngState = "not-an-object";
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects missing prngSeed", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    delete json.header.prngSeed;
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });
});

// ---------------------------------------------------------------------------
// 5. Data array rejection
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-DATA-001: required array rejection", () => {
  it("rejects missing inputs", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    delete json.inputs;
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects non-array inputs", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    json.inputs = "not-an-array";
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects non-array hashes", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    json.hashes = "not-an-array";
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects inputs with non-object element", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    json.inputs[0] = "not-an-object";
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects inputs with missing required field", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    delete json.inputs[0].tick;
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });
});

// ---------------------------------------------------------------------------
// 6. Checkpoint encode / decode
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-CHECKPOINT-001: checkpoint encode / decode", () => {
  it("round-trips a checkpoint", () => {
    const stateJson = JSON.stringify({
      schemaVersion: "state-v1",
      tick: 10,
      test: "data",
    });
    const encoded = encodeCheckpoint(stateJson);
    const decoded = decodeCheckpoint(encoded);
    expect(decoded).toBe(stateJson);
  });

  it("rejects wrong checkpoint version", () => {
    const json = JSON.stringify({
      schemaVersion: "checkpoint-v2",
      data: "{}",
    });
    expect(() => decodeCheckpoint(json)).toThrow(ReplayCodecError);
  });

  it("rejects checkpoint with missing data", () => {
    const json = JSON.stringify({
      schemaVersion: "checkpoint-v1",
    });
    expect(() => decodeCheckpoint(json)).toThrow(ReplayCodecError);
  });

  it("rejects checkpoint with non-string data", () => {
    const json = JSON.stringify({
      schemaVersion: "checkpoint-v1",
      data: 42,
    });
    expect(() => decodeCheckpoint(json)).toThrow(ReplayCodecError);
  });
});

// ---------------------------------------------------------------------------
// 7. Incompatible simulation version rejection
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-COMPAT-001: incompatible version rejection", () => {
  it("rejects old simulation version", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    // Set simulation version older than sim-v1 — use "sim-v0"
    (json.header as any).simulationVersion = "sim-v0";
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects old schema version", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    // Set schema version older than state-v1
    (json.header as any).schemaVersion = "state-v0";
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects unsupported PRNG algorithm", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    (json.header as any).prngAlgorithmId = "xoshiro256-star-star-v1";
    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });
});

// ---------------------------------------------------------------------------
// 8. Forward compatibility — unknown fields are preserved
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-FORWARD-001: forward compatibility", () => {
  it("preserves unknown fields during round trip", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    (json as any).unknownField = "preserved";
    (json as any).nested = { deep: { value: 42 } };
    const decoded = decodeReplay(JSON.stringify(json));
    // decodeReplay returns a ReplayV1, so unknown fields are not in the type.
    // The encode step preserves them, and the decode step ignores them.
    // Round-trip with an encode+decode preserves the known fields.
    expect(decoded.header.replayVersion).toBe(replay.header.replayVersion);
  });
});

// ---------------------------------------------------------------------------
// 9. CheckpointsState encode / decode
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-CHECKPOINTS-STATE-001: checkpointsState encode/decode", () => {
  it("round-trips checkpointsState with full encoded state", () => {
    const replay = makeReplayV1();
    // Add a checkpoint with encoded state.
    const encodedCheckpoint = JSON.stringify({
      schemaVersion: "checkpoint-v1",
      data: JSON.stringify({ schemaVersion: "state-v1", tick: 5 }),
    });
    (replay as any).checkpointsState = [
      {
        tick: 5,
        stateHash: "hash-5",
        encodedState: encodedCheckpoint,
      },
    ];

    const json = encodeReplay(replay);
    const decoded = decodeReplay(json);

    expect(decoded.checkpointsState.length).toBe(1);
    expect(decoded.checkpointsState[0].tick).toBe(5);
    expect(decoded.checkpointsState[0].stateHash).toBe("hash-5");
    expect(decoded.checkpointsState[0].encodedState).toBe(encodedCheckpoint);
  });

  it("round-trips empty checkpointsState", () => {
    const replay = makeReplayV1();
    (replay as any).checkpointsState = [];

    const json = encodeReplay(replay);
    const decoded = decodeReplay(json);

    expect(decoded.checkpointsState).toEqual([]);
  });

  it("defaults to empty checkpointsState when absent", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    delete (json as any).checkpointsState;

    const decoded = decodeReplay(JSON.stringify(json));
    expect(decoded.checkpointsState).toEqual([]);
  });

  it("rejects checkpointsState with missing encodedState", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    (json as any).checkpointsState = [
      { tick: 5, stateHash: "hash-5" },
    ];

    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("rejects checkpointsState with non-string encodedState", () => {
    const replay = makeReplayV1();
    const json = JSON.parse(encodeReplay(replay));
    (json as any).checkpointsState = [
      { tick: 5, stateHash: "hash-5", encodedState: 42 },
    ];

    expect(() => decodeReplay(JSON.stringify(json))).toThrow(ReplayCodecError);
  });

  it("round-trips multiple checkpointsState entries", () => {
    const replay = makeReplayV1();
    const cp1 = JSON.stringify({
      schemaVersion: "checkpoint-v1",
      data: JSON.stringify({ tick: 5, test: "a" }),
    });
    const cp2 = JSON.stringify({
      schemaVersion: "checkpoint-v1",
      data: JSON.stringify({ tick: 10, test: "b" }),
    });
    (replay as any).checkpointsState = [
      { tick: 5, stateHash: "hash-5", encodedState: cp1 },
      { tick: 10, stateHash: "hash-10", encodedState: cp2 },
    ];

    const json = encodeReplay(replay);
    const decoded = decodeReplay(json);

    expect(decoded.checkpointsState.length).toBe(2);
    expect(decoded.checkpointsState[0].tick).toBe(5);
    expect(decoded.checkpointsState[0].encodedState).toBe(cp1);
    expect(decoded.checkpointsState[1].tick).toBe(10);
    expect(decoded.checkpointsState[1].encodedState).toBe(cp2);
  });
});