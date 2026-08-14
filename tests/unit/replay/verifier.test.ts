/**
 * @module eval/recording/verifier-tests
 *
 * Tests for the replay verifier (BOOTSTRAP-09).
 *
 * Tests:
 * - verifyReplay with matching inputs reports match=true.
 * - verifyReplay with changed initial state reports earliest divergence.
 * - Verifier reports initialHashMatch when initial state matches.
 *
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { verifyReplay } from "../../../eval/recording/verifier.js";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";
import { encodeReplay } from "../../../src/adapters/replay/replay-codec.js";
import { createRecorder } from "../../../eval/recording/recorder.js";
import { makeInputFrame } from "../../unit/contracts.fixture.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

function loadFixture(name: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, `../../../eval/scenarios/${name}`);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

// ---------------------------------------------------------------------------
// 1. Matching replay → match=true
// ---------------------------------------------------------------------------

describe("VERIFIER-001: matching replay reports match=true", () => {
  it("replay with identical inputs produces match=true", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const duration = 8;

    // Run and record.
    const initialWorld = createWorld({ scenario });
    const recorder = createRecorder(
      {
        simulationVersion: "sim-v1",
        runtimeIdentity: "test",
        configVersion: initialWorld.configVersion,
        configHash: "config-hash",
        pitchRulesHash: "pitch-hash",
        rosterCapabilityHash: "roster-hash",
        scenarioHash: "scenario-hash",
        prngAlgorithmId: initialWorld.prng.algorithmId,
        prngSeed: initialWorld.prng.seed,
        runId: "test-run",
        hashCadence: 1,
        checkpointCadence: 0,
      },
      initialWorld,
    );

    const sim = createSimulation(initialWorld, NO_OP_OBSERVER);
    for (let t = 0; t < duration; t++) {
      sim.applyInputs([makeInputFrame(t, "slot-1", { moveX: 0.1 * (t + 1) })]);
      const result = sim.step();
      recorder.recordInput([makeInputFrame(t, "slot-1", { moveX: 0.1 * (t + 1) })]);
      recorder.recordHash(result.tick, result.stateHash);
    }

    const replay = recorder.build();

    // Verify.
    const result = verifyReplay(replay, scenario, NO_OP_OBSERVER);

    expect(result.match).toBe(true);
    expect(result.earliestDivergenceTick).toBeUndefined();
    expect(result.ticksChecked).toBe(duration);
    expect(result.initialHashMatch).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Changed config → earliest divergence
// ---------------------------------------------------------------------------

describe("VERIFIER-002: changed config reports earliest divergence", () => {
  it("different ball position causes earliest divergence at first tick", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const duration = 8;

    // Run and record with default scenario.
    const initialWorld = createWorld({ scenario });
    const recorder = createRecorder(
      {
        simulationVersion: "sim-v1",
        runtimeIdentity: "test",
        configVersion: initialWorld.configVersion,
        configHash: "config-hash",
        pitchRulesHash: "pitch-hash",
        rosterCapabilityHash: "roster-hash",
        scenarioHash: "scenario-hash",
        prngAlgorithmId: initialWorld.prng.algorithmId,
        prngSeed: initialWorld.prng.seed,
        runId: "test-run",
        hashCadence: 1,
        checkpointCadence: 0,
      },
      initialWorld,
    );

    const sim = createSimulation(initialWorld, NO_OP_OBSERVER);
    const inputProgram: Record<number, number> = {};
    for (let t = 0; t < duration; t++) {
      const moveX = 0.1 * (t + 1);
      inputProgram[t] = moveX;
      sim.applyInputs([makeInputFrame(t, "slot-1", { moveX })]);
      const result = sim.step();
      recorder.recordInput([makeInputFrame(t, "slot-1", { moveX })]);
      recorder.recordHash(result.tick, result.stateHash);
    }

    const replay = recorder.build();

    // Verify with a modified scenario (different ball Z).
    const modifiedScenario = JSON.parse(
      JSON.stringify(scenario),
    ) as ScenarioDefinition;
    (modifiedScenario.ball as any).position.z = 0.5;

    const result = verifyReplay(replay, modifiedScenario, NO_OP_OBSERVER);

    expect(result.match).toBe(false);
    expect(result.earliestDivergenceTick).toBeDefined();
    expect(result.earliestDivergenceExpected).toBeDefined();
    expect(result.earliestDivergenceActual).toBeDefined();
    expect(result.earliestDivergenceStateSlice).toBeDefined();
  });
});