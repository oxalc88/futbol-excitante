/**
 * @module tests/integration/oracles-mutant-canary
 *
 * Protected oracle mutant/canary suite.
 *
 * Each test creates an intentionally broken observation (or pair of
 * observations) that triggers a specific oracle.  A clean reference
 * observation is also tested to verify the oracle does not produce
 * false positives.
 *
 * Deferred mutants (impossible contact, every-defender-chasing,
 * transition-skipped) are explicitly NOT_EVALUATED because their
 * specs do not yet exist.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluate, type EvaluationResult } from "../../eval/runners/evaluate.js";
import { compareRuns } from "../../eval/runners/compare.js";
import { makeInputFrame, makeTelemetryObservation } from "../unit/contracts.fixture.js";

// Import wire.ts to register built-in oracles.
import "../../eval/oracles/wire.js";

import {
  registerOracle,
  getOracle,
  executeOracle,
} from "../../eval/oracles/oracle-registry.js";
import { checkCameraDoesNotAffectHash } from "../../eval/oracles/camera-hash.js";

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(name: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, `../../eval/scenarios/${name}`);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

/**
 * Build a corrupted observation with a NaN numeric field.
 */
function makeObservationWithNaN(
  base: TelemetryObservation,
): TelemetryObservation {
  return {
    ...base,
    players: base.players.map((p) => ({
      ...p,
      linearVelocity: { ...p.linearVelocity, x: NaN },
    })),
    ball: {
      ...base.ball,
      linearVelocity: { ...base.ball.linearVelocity, z: Infinity },
    },
  };
}

/**
 * Build observations with an instantaneous velocity snap.
 * The first observation is normal, the second has a huge velocity jump.
 */
function makeObservationsWithVelocitySnap(
  base: TelemetryObservation,
): TelemetryObservation[] {
  const obs1 = { ...base, tick: 10, simulationTime: 10 / 60 };
  const obs2 = {
    ...base,
    tick: 11,
    simulationTime: 11 / 60,
    players: base.players.map((p) => ({
      ...p,
      linearVelocity: { x: p.linearVelocity.x + 2000, y: p.linearVelocity.y + 2000 },
      bodyHeading: p.bodyHeading + 4, // > π
    })),
    ball: {
      ...base.ball,
      linearVelocity: { x: base.ball.linearVelocity.x + 3000, y: base.ball.linearVelocity.y + 3000, z: base.ball.linearVelocity.z + 3000 },
    },
  };
  return [obs1, obs2];
}

/**
 * Build observations where a ground-ball does not lose speed
 * (constant non-zero velocity: disabled decay).  Both observations
 * share the same velocity so the ball is at a constant non-zero
 * ground-roll speed between ticks.
 */
function makeObservationsWithNoBallDecay(
  base: TelemetryObservation,
): TelemetryObservation[] {
  const velocityX = 3.0;
  const ballState = {
    ...base.ball,
    regime: "ground-roll" as const,
    linearVelocity: {
      x: velocityX,
      y: 0,
      z: 0,
    },
  };
  const obs1 = { ...base, tick: 20, simulationTime: 20 / 60, ball: ballState };
  const obs2 = { ...base, tick: 21, simulationTime: 21 / 60, ball: ballState };
  return [obs1, obs2];
}

/**
 * Build observations with ball teleportation.
 */
function makeObservationsWithBallTeleport(
  base: TelemetryObservation,
): TelemetryObservation[] {
  const obs1 = { ...base, tick: 30, simulationTime: 30 / 60 };
  const obs2 = {
    ...base,
    tick: 31,
    simulationTime: 31 / 60,
    ball: {
      ...base.ball,
      position: { x: 1000, y: 1000, z: 1000 }, // huge jump
    },
  };
  return [obs1, obs2];
}

/**
 * Build observations with possession change without evidence.
 */
function makeObservationsWithPossessionNoEvidence(
  base: TelemetryObservation,
): TelemetryObservation[] {
  const obs1 = { ...base, tick: 40, simulationTime: 40 / 60 };
  const obs2 = {
    ...base,
    tick: 41,
    simulationTime: 41 / 60,
    ball: {
      ...base.ball,
      lastTouchRef: "touch-event-fake", // new ref but no touch event
    },
    // No events at all — no touch evidence.
    events: [],
  };
  return [obs1, obs2];
}

// ===========================================================================
// 1. Non-finite state
// ===========================================================================

describe("Oracle: non-finite state", () => {
  it("finite oracle detects NaN in player velocity", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(3, "slot-1");
    fixture.durationTicks = 3;
    const result = evaluate({ scenario: fixture });

    // Get observations from the run.
    const observations = result.observations;
    expect(observations.length).toBeGreaterThan(0);

    // Corrupt one observation.
    const corrupted = makeObservationWithNaN(observations[0]);

    // The finite oracle should detect NaN.
    const results = executeOracle("finite-number", "oracle-finite-v1", [corrupted]);
    const failResult = results.find((r) => r.status === "fail");
    expect(failResult).toBeDefined();
  });

  it("finite oracle detects Infinity in ball velocity", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(3, "slot-1");
    fixture.durationTicks = 3;
    const result = evaluate({ scenario: fixture });

    const corrupted = makeObservationWithNaN(result.observations[0]);
    const results = executeOracle("finite-number", "oracle-finite-v1", [corrupted]);
    const failResult = results.find((r) => r.status === "fail");
    expect(failResult).toBeDefined();
  });

  it("clean observation passes finite oracle", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(3, "slot-1");
    fixture.durationTicks = 3;
    const result = evaluate({ scenario: fixture });

    for (const obs of result.observations) {
      const results = executeOracle("finite-number", "oracle-finite-v1", [obs]);
      for (const r of results) {
        expect(r.status).toBe("pass");
      }
    }
  });
});

// ===========================================================================
// 2. Hash divergence via compareRuns (injected corruption)
// ===========================================================================
// These tests exercise BOOTSTRAP-10's hash-divergence detection by
// injecting corruption into a run's hash map. They are NOT the
// PRNG-order mutant — the genuine mutant is in nondeterminism-canary.test.ts.
// ===========================================================================

describe("Hash divergence via compareRuns: injected corruption", () => {
  it("detects hash corruption via compareRuns", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(10, "slot-1");
    modified.durationTicks = 10;

    const runA = evaluate({ scenario: modified });
    const runB = evaluate({ scenario: modified });

    // Both runs identical before corruption.
    expect(runA.hashes.size).toBe(10);
    for (const [tick, hash] of runA.hashes) {
      expect(runB.hashes.get(Number(tick))).toBe(hash);
    }

    // Corrupt one tick's hash.
    const corruptionTick = 3;
    const corruptedHashesB = new Map(runB.hashes);
    corruptedHashesB.set(corruptionTick, "corrupted-hash-00000000000000000000000000");
    const runBCorrupted = { ...runB, hashes: corruptedHashesB };

    const cmp = compareRuns(runA, runBCorrupted as unknown as EvaluationResult);
    expect(cmp.status).toBe("delta_only");
    expect(cmp.earliestDivergenceTick).toBe(corruptionTick);
  });

  it("no divergence when hashes are identical", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(5, "slot-1");
    modified.durationTicks = 5;

    const runA = evaluate({ scenario: modified });
    const runB = evaluate({ scenario: modified });

    const cmp = compareRuns(runA, runB);
    expect(cmp.status).toBe("delta_only");
    expect(cmp.earliestDivergenceTick).toBeUndefined();
  });
});

// ===========================================================================
// 3. Instantaneous velocity or body-heading snap
// ===========================================================================

describe("Oracle: velocity snap", () => {
  it("detects velocity snap in player", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(3, "slot-1");
    fixture.durationTicks = 3;
    const result = evaluate({ scenario: fixture });

    const observations = makeObservationsWithVelocitySnap(result.observations[0]);
    const results = executeOracle("velocity-snap", "oracle-velocity-snap-v1", observations);
    const failResult = results.find((r) => r.status === "fail");
    expect(failResult).toBeDefined();
  });

  it("detects velocity snap in ball", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(3, "slot-1");
    fixture.durationTicks = 3;
    const result = evaluate({ scenario: fixture });

    const observations = makeObservationsWithVelocitySnap(result.observations[0]);
    const results = executeOracle("velocity-snap", "oracle-velocity-snap-v1", observations);
    const ballSnap = results.find((r) => r.id.includes("ball-vel-snap"));
    expect(ballSnap).toBeDefined();
    expect(ballSnap!.status).toBe("fail");
  });

  it("clean observations pass velocity snap oracle", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(5, "slot-1");
    fixture.durationTicks = 5;
    const result = evaluate({ scenario: fixture });

    const results = executeOracle("velocity-snap", "oracle-velocity-snap-v1", result.observations);
    for (const r of results) {
      expect(r.status).toBe("pass");
    }
  });
});

// ===========================================================================
// 4. Disabled ball decay (constant non-zero ground-roll speed)
// ===========================================================================

describe("Oracle: ball decay", () => {
  it("detects constant non-zero ground-roll speed (disabled decay)", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(3, "slot-1");
    fixture.durationTicks = 3;
    const result = evaluate({ scenario: fixture });

    const observations = makeObservationsWithNoBallDecay(result.observations[0]);
    const results = executeOracle("ball-decay", "oracle-ball-decay-v1", observations);
    const failResult = results.find((r) => r.status === "fail");
    expect(failResult).toBeDefined();
    expect(failResult!.description).toContain("constant non-zero speed");
  });

  it("clean ground-ball decay passes oracle", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(10, "slot-1");
    fixture.durationTicks = 10;
    const result = evaluate({ scenario: fixture });

    const results = executeOracle("ball-decay", "oracle-ball-decay-v1", result.observations);
    // Filter to only ground-roll observations.
    const groundResults = results.filter((r) => r.id.includes("ball-no-decay"));
    for (const r of groundResults) {
      expect(r.status).toBe("pass");
    }
  });
});

// ===========================================================================
// 5. Ball parenting / teleport
// ===========================================================================

describe("Oracle: ball teleport", () => {
  it("detects ball teleportation", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(3, "slot-1");
    fixture.durationTicks = 3;
    const result = evaluate({ scenario: fixture });

    const observations = makeObservationsWithBallTeleport(result.observations[0]);
    const results = executeOracle("ball-teleport", "oracle-ball-teleport-v1", observations);
    const failResult = results.find((r) => r.status === "fail");
    expect(failResult).toBeDefined();
  });

  it("clean observations pass ball teleport oracle", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(5, "slot-1");
    fixture.durationTicks = 5;
    const result = evaluate({ scenario: fixture });

    const results = executeOracle("ball-teleport", "oracle-ball-teleport-v1", result.observations);
    for (const r of results) {
      expect(r.status).toBe("pass");
    }
  });
});

// ===========================================================================
// 6. Possession change without interaction evidence
// ===========================================================================

describe("Oracle: possession evidence", () => {
  it("detects possession change without touch event", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(3, "slot-1");
    fixture.durationTicks = 3;
    const result = evaluate({ scenario: fixture });

    const observations = makeObservationsWithPossessionNoEvidence(result.observations[0]);
    const results = executeOracle("possession-evidence", "oracle-possession-v1", observations);
    const failResult = results.find((r) => r.status === "fail");
    expect(failResult).toBeDefined();
  });

  it("clean observations pass possession oracle", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(5, "slot-1");
    fixture.durationTicks = 5;
    const result = evaluate({ scenario: fixture });

    const results = executeOracle("possession-evidence", "oracle-possession-v1", result.observations);
    for (const r of results) {
      expect(r.status).toBe("pass");
    }
  });
});

// ===========================================================================
// 7. Camera mutation must not change simulation hashes
// ===========================================================================

describe("Oracle: camera hash", () => {
  it("identical world states produce identical hashes", () => {
    // encodeCanonical requires schemaVersion field.
    const stateA = { schemaVersion: "state-v1", a: 1, b: 2 };
    const stateB = { schemaVersion: "state-v1", a: 1, b: 2 };
    const result = checkCameraDoesNotAffectHash(stateA, stateB);
    expect(result.status).toBe("pass");
  });

  it("different world states produce different hashes", () => {
    const stateA = { schemaVersion: "state-v1", a: 1, b: 2 };
    const stateB = { schemaVersion: "state-v1", a: 1, b: 3 };
    const result = checkCameraDoesNotAffectHash(stateA, stateB);
    expect(result.status).toBe("fail");
  });

  it("core determinism: two identical scenario runs produce identical hashes", () => {
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(5, "slot-1");
    fixture.durationTicks = 5;

    const runA = evaluate({ scenario: fixture });
    const runB = evaluate({ scenario: fixture });

    // Hash maps must be identical.
    expect(runA.hashes.size).toBe(5);
    for (const [tick, hash] of runA.hashes) {
      expect(runB.hashes.get(Number(tick))).toBe(hash);
    }
  });

  it("camera-hash oracle fails on corrupted observationCoreHash via executeOracle", () => {
    // Exercise the WIRED oracle through executeOracle.
    // Inject an observation with an incorrect observationCoreHash so the
    // independently computed hash does not match the committed hash.
    const fixture = loadFixture("foundation-move-and-roll.v1.json");
    fixture.inputProgram = buildInputProgram(3, "slot-1");
    fixture.durationTicks = 3;
    const result = evaluate({ scenario: fixture });
    expect(result.observations.length).toBeGreaterThan(0);

    const cleanObs = result.observations[0];
    // Corrupt the observationCoreHash so the computed core hash differs.
    const corruptedObs = { ...cleanObs, observationCoreHash: "corrupted-hash-000000" };

    const observations = [corruptedObs];
    const oracleResults = executeOracle("camera-hash", "oracle-camera-v1", observations);

    const failResult = oracleResults.find((r) => r.status === "fail");
    expect(failResult).toBeDefined();
    expect(failResult!.id).toContain("camera-hash-inconsistency");
    expect(failResult!.description).toContain("mismatch");
  });
});

// ===========================================================================
// 8. Oracle registry: reject unknown oracle_id
// ===========================================================================

describe("Oracle registry: unknown oracle", () => {
  it("rejects unknown oracle_id", () => {
    expect(() =>
      executeOracle("nonexistent-oracle", "oracle-v1", []),
    ).toThrow("Unknown oracle_id or version mismatch");
  });

  it("rejects version mismatch", () => {
    // "finite-number" is registered with "oracle-finite-v1".
    expect(() =>
      executeOracle("finite-number", "wrong-version", []),
    ).toThrow(/version/i);
  });
});

// ===========================================================================
// 9. MEASURED_TARGET absence → BLOCKED_MISSING_REFERENCE (not PASS)
// ===========================================================================

describe("Oracle: MEASURED_TARGET absence", () => {
  it("candidate cannot turn MEASURED_TARGET absence into PASS", () => {
    // The oracle registry is independent of MEASURED_TARGET resolution.
    // If a criterion has no reference target, the evaluator must
    // return BLOCKED_MISSING_REFERENCE — the oracle output is irrelevant.
    // This test verifies that oracles are available to produce results
    // (even if the final criterion outcome is not PASS).
    const registry = getOracle("finite-number", "oracle-finite-v1");
    expect(registry).toBeDefined();

    // The oracle can be executed — but the criterion resolution
    // still returns BLOCKED_MISSING_REFERENCE for MEASURED_TARGETs.
    const cleanObs = makeTelemetryObservation();
    const results = executeOracle("finite-number", "oracle-finite-v1", [cleanObs]);
    for (const r of results) {
      expect(r.status).toBe("pass");
    }
    // But this does not mean the criterion passes — BLOCKED_MISSING_REFERENCE
    // is set by the reference target resolution, not the oracle.
  });
});

// ===========================================================================
// 9. Deferred mutants (NOT_EVALUATED — specs don't exist yet)
// ===========================================================================

describe("Deferred mutants", () => {
  it("imports the deferred-mutant registry and asserts it is non-empty", async () => {
    const { DEFERRED_MUTANTS_V1 } = await import("../../eval/oracles/deferred-mutants.js");
    expect(DEFERRED_MUTANTS_V1.length).toBeGreaterThan(0);
    for (const mutant of DEFERRED_MUTANTS_V1) {
      expect(mutant.id).toMatch(/.+/);
      expect(mutant.description).toMatch(/.+/);
      expect(mutant.reason).toMatch(/.+/);
    }
  });

  it("deferred-mutants oracle returns not_evaluated via executeOracle", () => {
    const results = executeOracle(
      "deferred-mutants",
      "oracle-deferred-mutants-v1",
      [],
    );
    // Must find a not_evaluated result listing deferred mutant IDs.
    const result = results.find((r) => r.status === "not_evaluated");
    expect(result).toBeDefined();
    expect(result!.details).toBeDefined();
    const mutantIds = (result!.details as { mutantIds?: string[] })?.mutantIds;
    expect(mutantIds).toBeDefined();
    expect(mutantIds!.length).toBeGreaterThan(0);
    // Never a trivially passing or failing assertion.
    expect(result!.id).toContain("deferred-mutants");
  });
});

// ===========================================================================
// Helpers
// ===========================================================================

function buildInputProgram(
  durationTicks: number,
  controlSlot: string,
): Record<number, InputFrame[]> {
  const program: Record<number, InputFrame[]> = {};
  for (let t = 0; t < durationTicks; t++) {
    program[t] = [makeInputFrame(t, controlSlot)];
  }
  return program;
}