/**
 * @module tests/unit/eval/oracle-registry
 *
 * Tests for the protected oracle registry.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { describe, it, expect, beforeEach } from "vitest";

// Import wire.ts to register built-in oracles.
import "../../../eval/oracles/wire.js";

import {
  registerOracle,
  getOracle,
  executeOracle,
  type OracleEntry,
} from "../../../eval/oracles/oracle-registry.js";
import { evaluate } from "../../../eval/runners/evaluate.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a clean TelemetryObservation for testing.
 */
function buildCleanObs(tick: number): TelemetryObservation {
  return {
    tick,
    simulationTime: tick / 60,
    prngAlgorithmId: "mulberry32-v1",
    stateHash: `hash-${tick}`,
    prngStateHash: `prng-hash-${tick}`,
    observationCoreHash: `core-hash-${tick}`,
    committedTick: tick,
    inputs: [],
    players: [
      {
        playerId: "player-1",
        teamId: "team-a",
        groundPosition: { x: tick * 0.1, y: 0 },
        linearVelocity: { x: 0.5, y: 0.2 },
        desiredVelocity: { x: 0.5, y: 0.2 },
        bodyHeading: 0,
        desiredHeading: 0,
      },
    ],
    ball: {
      position: { x: tick * 0.05, y: 0, z: 0.11 },
      linearVelocity: { x: 0.3, y: 0.1, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0.5 },
      regime: "ground-roll",
      lastTouchRef: null,
    },
    events: [],
  };
}

/** Create a no-op oracle entry for testing. */
function makeTestOracle(
  oracleId: string,
  oracleVersion: string,
  fn: (obs: TelemetryObservation[]) => import("../../../src/contracts/telemetry.js").InvariantResult,
): OracleEntry {
  return { oracle_id: oracleId, oracle_version: oracleVersion, fn };
}

// ---------------------------------------------------------------------------
// Setup / teardown: ensure tests don't pollute each other
// ---------------------------------------------------------------------------

let beforeCount: number;

beforeEach(() => {
  // Track count and verify tests don't register duplicates.
  beforeCount = Object.keys(getAllOracles()).length;
});

/**
 * Read all known registered oracles via getOracle.
 */
function getAllOracles(): Record<string, import("../../../eval/oracles/oracle-registry.js").OracleEntry> {
  return {
    "finite-number@oracle-finite-v1": getOracle("finite-number", "oracle-finite-v1")!,
    "bounds@oracle-bounds-v1": getOracle("bounds", "oracle-bounds-v1")!,
    "event-references@oracle-references-v1": getOracle("event-references", "oracle-references-v1")!,
    "ball-continuity@oracle-continuity-v1": getOracle("ball-continuity", "oracle-continuity-v1")!,
    "velocity-snap@oracle-velocity-snap-v1": getOracle("velocity-snap", "oracle-velocity-snap-v1")!,
    "ball-decay@oracle-ball-decay-v1": getOracle("ball-decay", "oracle-ball-decay-v1")!,
    "ball-teleport@oracle-ball-teleport-v1": getOracle("ball-teleport", "oracle-ball-teleport-v1")!,
    "possession-evidence@oracle-possession-v1": getOracle("possession-evidence", "oracle-possession-v1")!,
    "camera-hash@oracle-camera-v1": getOracle("camera-hash", "oracle-camera-v1")!,
  };
}

// ---------------------------------------------------------------------------
// Registry: register and lookup
// ---------------------------------------------------------------------------

describe("Oracle registry: register and lookup", () => {
  it("can register and look up a test oracle", () => {
    const testOracle = makeTestOracle("test-oracle", "v1", () => ({
      id: "test",
      status: "pass",
      description: "test",
    }));

    expect(() => registerOracle(testOracle)).not.toThrow();
    const found = getOracle("test-oracle", "v1");
    expect(found).toBeDefined();
    expect(found!.oracle_id).toBe("test-oracle");
    expect(found!.oracle_version).toBe("v1");
  });

  it("getOracle returns undefined for unknown oracle", () => {
    expect(getOracle("nonexistent", "v1")).toBeUndefined();
  });

  it("getOracle returns undefined for wrong version", () => {
    const found = getOracle("finite-number", "wrong-version");
    expect(found).toBeUndefined();
  });

  it("duplicate registration throws", () => {
    const testOracle = makeTestOracle("dup-test", "v1", () => ({
      id: "test",
      status: "pass",
      description: "test",
    }));

    expect(() => registerOracle(testOracle)).not.toThrow();
    expect(() => registerOracle({ ...testOracle })).toThrow("already registered");
  });
});

// ---------------------------------------------------------------------------
// Registry: execute oracle
// ---------------------------------------------------------------------------

describe("Oracle registry: execution", () => {
  it("executes an oracle and returns results", () => {
    const testOracle = makeTestOracle("exec-test", "v1", () => ({
      id: "exec-result",
      status: "pass",
      description: "executed",
    }));

    registerOracle(testOracle);
    const results = executeOracle("exec-test", "v1", [buildCleanObs(0)]);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("pass");
    expect(results[0].id).toBe("exec-test-exec-result");
  });

  it("rejects unknown oracle_id", () => {
    expect(() => executeOracle("unknown", "v1", [])).toThrow("Unknown oracle_id");
  });

  it("rejects version mismatch", () => {
    // finite-number is registered with "oracle-finite-v1".
    expect(() => executeOracle("finite-number", "wrong-version", [])).toThrow(/version/i);
  });

  it("executes oracle with multi-result function", () => {
    const testOracle = makeTestOracle("multi-test", "v1", () => [
      { id: "r1", status: "pass", description: "first" },
      { id: "r2", status: "fail", description: "second" },
    ]);

    registerOracle(testOracle);
    const results = executeOracle("multi-test", "v1", [buildCleanObs(0)]);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("multi-test-r1");
    expect(results[1].id).toBe("multi-test-r2");
    expect(results[1].status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// Built-in oracles are registered on wire import
// ---------------------------------------------------------------------------

describe("Oracle registry: built-in oracles", () => {
  it("finite-number oracle is registered", () => {
    expect(getOracle("finite-number", "oracle-finite-v1")).toBeDefined();
  });

  it("bounds oracle is registered", () => {
    expect(getOracle("bounds", "oracle-bounds-v1")).toBeDefined();
  });

  it("event-references oracle is registered", () => {
    expect(getOracle("event-references", "oracle-references-v1")).toBeDefined();
  });

  it("ball-continuity oracle is registered", () => {
    expect(getOracle("ball-continuity", "oracle-continuity-v1")).toBeDefined();
  });

  it("velocity-snap oracle is registered", () => {
    expect(getOracle("velocity-snap", "oracle-velocity-snap-v1")).toBeDefined();
  });

  it("ball-decay oracle is registered", () => {
    expect(getOracle("ball-decay", "oracle-ball-decay-v1")).toBeDefined();
  });

  it("ball-teleport oracle is registered", () => {
    expect(getOracle("ball-teleport", "oracle-ball-teleport-v1")).toBeDefined();
  });

  it("possession-evidence oracle is registered", () => {
    expect(getOracle("possession-evidence", "oracle-possession-v1")).toBeDefined();
  });

  it("camera-hash oracle is registered", () => {
    expect(getOracle("camera-hash", "oracle-camera-v1")).toBeDefined();
  });

  it("all registered oracles have unique keys", () => {
    const keys = new Set<string>();
    const allOracles = getAllOracles();
    for (const [key, entry] of Object.entries(allOracles)) {
      const idKey = `${entry.oracle_id}@${entry.oracle_version}`;
      expect(idKey).toBe(key);
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });
});

// ---------------------------------------------------------------------------
// camera-hash: clean evaluate() observations pass
// ---------------------------------------------------------------------------

describe("Oracle: camera-hash clean evaluate observations", () => {
  it("executeCameraHash passes on clean observations from evaluate()", () => {
    // Build a minimal scenario for evaluate()
    const scenario = {
      id: "test-scenario",
      version: "1.0.0",
      family: "test",
      durationTicks: 3,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-v1",
      profile: "LABORATORY" as const,
      pitchLength: 105,
      pitchWidth: 68,
      safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
      players: [
        {
          playerId: "player-1",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 0, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "settled" as const,
        lastTouchRef: null,
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "player-1",
          mode: "HUMAN" as const,
        },
      },
      missingInputPolicy: "repeat-held-with-zero-edges",
      maxConsecutiveMissing: 3,
      inputProgram: {
        0: [{ tick: 0, sourceId: "test", controlSlot: "slot-1", moveX: 0, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
        1: [{ tick: 1, sourceId: "test", controlSlot: "slot-1", moveX: 0.5, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
        2: [{ tick: 2, sourceId: "test", controlSlot: "slot-1", moveX: 0.5, moveY: 0, sprint: 1, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
      },
      scheduledEvents: {},
      observationWindows: [{ startTick: 0, endTick: 60 }],
      requestedMetrics: [],
    };

    const result = evaluate({ scenario });
    expect(result.observations.length).toBeGreaterThan(0);

    // Execute camera-hash oracle on the clean observations.
    const oracleResults = executeOracle(
      "camera-hash",
      "oracle-camera-v1",
      result.observations,
    );

    // Every observation should pass — no core hash inconsistencies.
    for (const r of oracleResults) {
      expect(r.status).toBe("pass");
    }
  });
});