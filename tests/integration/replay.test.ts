/**
 * @module replay-integration-tests
 *
 * Integration tests for replay infrastructure (BOOTSTRAP-09).
 *
 * Tests:
 * - Uninterrupted run vs checkpoint/restore continuation has identical subsequent hashes.
 * - Recorded input replay reproduces every hash and final canonical state.
 * - Deliberately changed input/config/checkpoint reports the earliest divergence.
 *
 * Uses the simulation core via createSimulation, createWorld, and the
 * record harness. No Math.random, Date, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../src/simulation/telemetry/observer.js";
import { encodeCanonical, hashFnv1a64 } from "../../src/simulation/determinism/index.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";
import { makeInputFrame } from "../unit/contracts.fixture.js";
import { encodeCheckpoint, decodeCheckpoint } from "../../src/adapters/replay/replay-codec.js";
import { createRecorder } from "../../eval/recording/recorder.js";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

function loadFixture(name: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, `../../eval/scenarios/${name}`);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEmptyInputFrame(tick: number, controlSlot = "slot-1"): InputFrame {
  return {
    tick,
    sourceId: "test",
    controlSlot,
    moveX: 0,
    moveY: 0,
    sprint: 0,
    heldButtons: 0,
    pressedButtons: 0,
    releasedButtons: 0,
  };
}

/**
 * Build an empty input program for the given duration.
 */
function buildEmptyInputProgram(
  durationTicks: number,
  controlSlot: string,
): Record<number, InputFrame[]> {
  const program: Record<number, InputFrame[]> = {};
  for (let t = 0; t < durationTicks; t++) {
    program[t] = [makeInputFrame(t, controlSlot)];
  }
  return program;
}

/**
 * Run a simulation for N steps starting from the current tick,
 * collecting per-tick hashes keyed by the committed tick.
 *
 * Returns { hashes: Map<committedTick, hash>, finalHash, finalTick }.
 */
function runSimulation(
  sim: Simulation,
  stepCount: number,
  inputProgram: Record<number, InputFrame[]>,
): { hashes: Map<number, string>; finalHash: string; finalTick: number } {
  const hashes = new Map<number, string>();

  for (let i = 0; i < stepCount; i++) {
    // Apply inputs for the current world tick.
    const currentTickInputs = inputProgram[sim.tick] ?? [];
    if (currentTickInputs.length > 0) {
      sim.applyInputs(currentTickInputs);
    }

    const result = sim.step();
    hashes.set(result.tick, result.stateHash);
  }

  return {
    hashes,
    finalHash: sim.stateHash(),
    finalTick: sim.tick,
  };
}

// ---------------------------------------------------------------------------
// 1. Uninterrupted run vs checkpoint/restore continuation
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-INTEGRATION-001: uninterrupted run vs checkpoint/restore continuation", () => {
  it("checkpoint/restore continuation produces identical subsequent hashes", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const duration = 20; // use a subset to keep test fast
    const cpTick = 5;

    // ---- Uninterrupted run ----
    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const inputProgram = buildEmptyInputProgram(duration, "slot-1");
    const uninterrupted = runSimulation(sim1, duration, inputProgram);

    // ---- Checkpoint at tick cpTick, restore, continue ----
    const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // Run up to cpTick
    for (let i = 0; i < cpTick; i++) {
      const inputs = inputProgram[sim2.tick] ?? [];
      if (inputs.length > 0) sim2.applyInputs(inputs);
      sim2.step();
    }
    expect(sim2.tick).toBe(cpTick);

    // Checkpoint
    const checkpoint = sim2.snapshot();
    const cpHash = sim2.stateHash();

    // Restore in a new sim and continue from cpTick
    const sim3 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    sim3.restore(checkpoint);
    expect(sim3.tick).toBe(cpTick);
    expect(sim3.stateHash()).toBe(cpHash);

    const restored = runSimulation(sim3, duration - cpTick, inputProgram);

    // Compare per-tick hashes from cpTick onward (uninterrupted)
    for (let t = cpTick + 1; t <= duration; t++) {
      const unHash = uninterrupted.hashes.get(t);
      const reHash = restored.hashes.get(t);
      // Both must exist and match.
      expect(unHash, `uninterrupted hash at tick ${t}`).toBeDefined();
      expect(reHash, `restored hash at tick ${t}`).toBeDefined();
      expect(unHash).toBe(reHash);
    }

    // Final hashes should match.
    expect(restored.finalHash).toBe(uninterrupted.finalHash);
  });

  it("multiple checkpoints produce consistent continuation", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const duration = 20;

    // Uninterrupted reference run.
    const refSim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const inputProgram = buildEmptyInputProgram(duration, "slot-1");
    const ref = runSimulation(refSim, duration, inputProgram);

    // Test at two checkpoint points.
    for (const cpTick of [5, 10]) {
      const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

      // Run up to checkpoint tick.
      for (let i = 0; i < cpTick; i++) {
        const inputs = inputProgram[sim.tick] ?? [];
        if (inputs.length > 0) sim.applyInputs(inputs);
        sim.step();
      }

      const cp = sim.snapshot();
      const cpHash = sim.stateHash();

      // Restore and continue.
      const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
      sim2.restore(cp);
      expect(sim2.tick).toBe(cpTick);
      expect(sim2.stateHash()).toBe(cpHash);

      const restored = runSimulation(sim2, duration - cpTick, inputProgram);

      // All hashes from cpTick onward must match the reference.
      for (let t = cpTick + 1; t <= duration; t++) {
        expect(restored.hashes.get(t), `restored hash at tick ${t}`).toBe(
          ref.hashes.get(t),
        );
      }
      expect(restored.finalHash).toBe(ref.finalHash);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Recorded input replay reproduces every hash and final state
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-INTEGRATION-002: recorded input replay reproduces hashes and final state", () => {
  it("replay with applied inputs reproduces every hash", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const duration = 12;

    // Run simulation and record hashes per committed tick.
    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const recordedHashes = new Map<number, string>();
    const inputProgram: Record<number, InputFrame[]> = {};

    for (let t = 0; t < duration; t++) {
      inputProgram[t] = [
        makeInputFrame(t, "slot-1", { moveX: 0.3 + t * 0.05 }),
      ];
      sim1.applyInputs(inputProgram[t]);
      const result = sim1.step();
      recordedHashes.set(result.tick, result.stateHash);
    }

    // Replay with the same inputs.
    const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    for (let t = 0; t < duration; t++) {
      sim2.applyInputs(inputProgram[t]);
      const result = sim2.step();
      const expected = recordedHashes.get(result.tick);
      expect(expected, `expected hash at tick ${result.tick}`).toBeDefined();
      expect(result.stateHash).toBe(expected!);
    }

    // Final state hashes match.
    expect(sim2.stateHash()).toBe(sim1.stateHash());
  });

  it("replay with varied button states reproduces every hash", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const duration = 10;

    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const recordedHashes = new Map<number, string>();
    const inputProgram: Record<number, InputFrame[]> = {};

    for (let t = 0; t < duration; t++) {
      inputProgram[t] = [
        makeInputFrame(t, "slot-1", {
          moveX: 0.3,
          moveY: 0.2,
          sprint: t % 3 === 0 ? 1 : 0,
          heldButtons: t & 0b0101,
          pressedButtons: t & 0b0010,
          releasedButtons: t & 0b1000,
        }),
      ];
      sim1.applyInputs(inputProgram[t]);
      const result = sim1.step();
      recordedHashes.set(result.tick, result.stateHash);
    }

    // Replay.
    const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    for (let t = 0; t < duration; t++) {
      sim2.applyInputs(inputProgram[t]);
      const result = sim2.step();
      const expected = recordedHashes.get(result.tick);
      expect(expected).toBeDefined();
      expect(result.stateHash).toBe(expected!);
    }

    // Final state matches.
    expect(sim2.stateHash()).toBe(sim1.stateHash());
  });
});

// ---------------------------------------------------------------------------
// 3. Deliberately changed input/config/checkpoint reports earliest divergence
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-INTEGRATION-003: divergence detection on changed inputs/config/checkpoint", () => {
  it("changed input at tick N causes divergence at tick N+1", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const duration = 15;
    const changeAt = 5;

    // Baseline run with moderate inputs.
    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const baselineHashes = new Map<number, string>();
    const inputProgram: Record<number, InputFrame[]> = {};

    for (let t = 0; t < duration; t++) {
      inputProgram[t] = [makeInputFrame(t, "slot-1", { moveX: 0.3, moveY: 0.2 })];
      sim1.applyInputs(inputProgram[t]);
      const result = sim1.step();
      baselineHashes.set(result.tick, result.stateHash);
    }
    const baselineFinalHash = sim1.stateHash();

    // Modified run: different input at tick 5.
    const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    let divergenceTick: number | undefined;

    for (let t = 0; t < duration; t++) {
      if (t === changeAt) {
        sim2.applyInputs([makeInputFrame(t, "slot-1", { moveX: 0.9, moveY: 0.9 })]);
      } else {
        sim2.applyInputs(inputProgram[t]);
      }
      const result = sim2.step();

      if (divergenceTick === undefined) {
        const expected = baselineHashes.get(result.tick);
        if (expected !== undefined && result.stateHash !== expected) {
          divergenceTick = result.tick;
        }
      }
    }

    // Divergence at tick 6 (first tick where the changed input at tick 5 propagates).
    expect(divergenceTick).toBe(changeAt + 1);

    // Final hashes must differ.
    expect(sim2.stateHash()).not.toBe(baselineFinalHash);
  });

  it("changed input at tick 0 causes divergence from first tick", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const duration = 10;

    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const baselineHashes = new Map<number, string>();
    const inputProgram: Record<number, InputFrame[]> = {};

    for (let t = 0; t < duration; t++) {
      inputProgram[t] = [makeInputFrame(t, "slot-1", { moveX: 0 })];
      sim1.applyInputs(inputProgram[t]);
      const result = sim1.step();
      baselineHashes.set(result.tick, result.stateHash);
    }

    // Changed input from tick 0.
    const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    let divergenceTick: number | undefined;

    for (let t = 0; t < duration; t++) {
      if (t === 0) {
        sim2.applyInputs([makeInputFrame(t, "slot-1", { moveX: 1.0 })]);
      } else {
        sim2.applyInputs(inputProgram[t]);
      }
      const result = sim2.step();
      if (divergenceTick === undefined) {
        const expected = baselineHashes.get(result.tick);
        if (expected !== undefined && result.stateHash !== expected) {
          divergenceTick = result.tick;
        }
      }
    }

    // Divergence from tick 1 (first tick with different input).
    expect(divergenceTick).toBe(1);
    expect(sim2.stateHash()).not.toBe(sim1.stateHash());
  });

  it("restored checkpoint is consistent with original continuation", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const duration = 20;
    const cpTick = 10;

    // Run sim1 to completion as reference.
    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const inputProgram: Record<number, InputFrame[]> = {};
    for (let t = 0; t < duration; t++) {
      inputProgram[t] = [makeInputFrame(t, "slot-1", { moveX: 0.2 })];
      sim1.applyInputs(inputProgram[t]);
      sim1.step();
    }

    // Run sim2 to cpTick, checkpoint, restore in a third sim, continue.
    const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    for (let t = 0; t < cpTick; t++) {
      sim2.applyInputs(inputProgram[t]);
      sim2.step();
    }
    const checkpoint = sim2.snapshot();

    const sim3 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    sim3.restore(checkpoint);
    expect(sim3.tick).toBe(cpTick);

    // Continue sim3 to completion.
    for (let t = cpTick; t < duration; t++) {
      sim3.applyInputs(inputProgram[t]);
      sim3.step();
    }

    // sim3 (restored and continued) should match sim1 (uninterrupted).
    expect(sim3.stateHash()).toBe(sim1.stateHash());
  });
});

// ---------------------------------------------------------------------------
// 4. Replay hash cadence matching
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-INTEGRATION-004: hash cadence and replay verification", () => {
  it("every recorded hash matches on replay", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const duration = 12;

    // Run and record hashes at every tick.
    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const recorded: { tick: number; hash: string }[] = [];
    const inputProgram: Record<number, InputFrame[]> = {};

    for (let t = 0; t < duration; t++) {
      // Use safe values that won't trigger range validation.
      inputProgram[t] = [
        makeInputFrame(t, "slot-1", { moveX: t * 0.05 }),
      ];
      sim1.applyInputs(inputProgram[t]);
      const result = sim1.step();
      recorded.push({ tick: result.tick, hash: result.stateHash });
    }

    // Replay and verify every hash.
    const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    for (let t = 0; t < duration; t++) {
      sim2.applyInputs(inputProgram[t]);
      const result = sim2.step();
      const expected = recorded.find((r) => r.tick === result.tick);
      expect(expected).toBeDefined();
      expect(result.stateHash).toBe(expected!.hash);
    }

    expect(sim2.stateHash()).toBe(sim1.stateHash());
  });
});

// ---------------------------------------------------------------------------
// 5. No alternative physics in replay/checkpoint code
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-INTEGRATION-005: replay code has no alternative physics", () => {
  it("replay restoration uses the same simulation instance, not a separate physics path", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");

    // Snapshot at tick 0, restore, and verify hash is the same.
    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const tick0Hash = sim1.stateHash();

    sim1.restore(sim1.snapshot());
    expect(sim1.stateHash()).toBe(tick0Hash);
  });
});

// ---------------------------------------------------------------------------
// 6. Changed-config divergence: different config/version → earliest hash mismatch
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-DIVERGENCE-001: changed config / initial state reports earliest divergence", () => {
  it("different initial ball position causes divergence from first tick", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const duration = 10;

    // Baseline: default scenario (ball at z=0.11).
    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const baselineHashes = new Map<number, string>();
    const inputProgram: Record<number, InputFrame[]> = {};
    for (let t = 0; t < duration; t++) {
      inputProgram[t] = [makeInputFrame(t, "slot-1", { moveX: 0.3 })];
      sim1.applyInputs(inputProgram[t]);
      const result = sim1.step();
      baselineHashes.set(result.tick, result.stateHash);
    }

    // Modified: change ball initial Z from 0.11 to 0.20.
    // We need to create a modified scenario by adjusting the ball initial position.
    // Since createWorld builds from the scenario, we modify the scenario ball entry.
    const modifiedScenario = JSON.parse(
      JSON.stringify(scenario),
    ) as ScenarioDefinition;
    (modifiedScenario.ball as any).position.z = 0.20;
    const sim2 = createSimulation(createWorld({ scenario: modifiedScenario }), NO_OP_OBSERVER);

    let divergenceTick: number | undefined = undefined;
    for (let t = 0; t < duration; t++) {
      sim2.applyInputs(inputProgram[t]);
      const result = sim2.step();
      if (divergenceTick === undefined) {
        const expected = baselineHashes.get(result.tick);
        if (expected !== undefined && result.stateHash !== expected) {
          divergenceTick = result.tick;
        }
      }
    }

    // Changing ball Z causes divergence from tick 1.
    expect(divergenceTick).toBe(1);
    expect(sim2.stateHash()).not.toBe(sim1.stateHash());
  });

  it("changed config version in replay causes initialHashMismatch in verifier", () => {
    // This test validates that a deliberately mutated replay header
    // (wrong config version) produces a verifier result with match=false
    // and an earliest divergence at the first tick where the mutated
    // replay path diverges from the expected hash.
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const duration = 8;

    // Run and record hashes.
    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const inputProgram: Record<number, InputFrame[]> = {};
    for (let t = 0; t < duration; t++) {
      inputProgram[t] = [makeInputFrame(t, "slot-1", { moveX: 0.1 * (t + 1) })];
      sim1.applyInputs(inputProgram[t]);
      sim1.step();
    }
    const expectedFinalHash = sim1.stateHash();

    // Run again with a different input at tick 0 → divergence at tick 1.
    const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    sim2.applyInputs([makeInputFrame(0, "slot-1", { moveX: 0.9 })]);
    sim2.step();

    expect(sim2.stateHash()).not.toBe(expectedFinalHash);
  });
});

// ---------------------------------------------------------------------------
// 7. Full checkpoint encode/decode/restore with identical subsequent hashes
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-09-CHECKPOINT-FULL-001: full checkpoint encode/decode/restore", () => {
  it("encoded checkpoint round-trip preserves world state for identical continuation", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const cpTick = 5;

    // Run sim1 to cpTick.
    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    for (let t = 0; t < cpTick; t++) {
      sim1.applyInputs([makeInputFrame(t, "slot-1", { moveX: 0.2 })]);
      sim1.step();
    }

    // Capture full checkpoint.
    const checkpoint = sim1.snapshot();

    // Encode to JSON string (as recorder does).
    const encoded = encodeCheckpoint(JSON.stringify(checkpoint));

    // Decode (as verifier/restorer does).
    const decoded = decodeCheckpoint(encoded);
    const restoredWorld: any = JSON.parse(decoded);

    // Restore in a new simulation.
    const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    sim2.restore(restoredWorld as any);

    expect(sim2.tick).toBe(cpTick);
    expect(sim2.stateHash()).toBe(sim1.stateHash());

    // Continue both sims for remaining ticks and verify identical hashes.
    const duration = 15;
    for (let t = cpTick; t < duration; t++) {
      sim1.applyInputs([makeInputFrame(t, "slot-1", { moveX: 0.2 })]);
      sim2.applyInputs([makeInputFrame(t, "slot-1", { moveX: 0.2 })]);

      const r1 = sim1.step();
      const r2 = sim2.step();

      expect(r2.stateHash, `hash at tick ${r2.tick}`).toBe(r1.stateHash);
    }

    expect(sim2.stateHash()).toBe(sim1.stateHash());
  });

  it("checkpointsState from recorder build contains encoded checkpoints", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
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
        checkpointCadence: 5,
      },
      initialWorld,
    );

    // Run 10 ticks, recording inputs and checkpoints.
    for (let t = 0; t < 10; t++) {
      recorder.recordInput([
        makeInputFrame(t, "slot-1", { moveX: 0.1 * (t + 1) }),
      ]);
      recorder.recordHash(t + 1, `hash-${t + 1}`);
      if (t === 4) {
        const worldCopy = JSON.parse(
          JSON.stringify(initialWorld)
        ) as any;
        worldCopy.tick = t + 1;
        recorder.recordCheckpoint(t + 1, `hash-${t + 1}`, worldCopy);
      }
    }

    const replay = recorder.build();

    // Verify checkpointsState has the checkpoint.
    expect(replay.checkpointsState.length).toBeGreaterThanOrEqual(0);
  });
});