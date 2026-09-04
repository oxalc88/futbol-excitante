/**
 * @module nondeterminism-canary-tests
 *
 * Protected canary suite that proves the comparison infrastructure
 * detects real divergences.
 *
 * Two distinct test families:
 * 1. Hash-divergence via compareRuns — inject corruption into one run's
 *    hash map, verify compareRuns reports earliestDivergenceTick.
 *    (BOOTSTRAP-10 accepted hash-divergence detection as a bootstrap
 *     invariant — these tests exercise that existing capability.)
 * 2. Genuine PRNG-order mutant — advance / mutate the PRNG state on
 *    one run but not the other, producing real gameplay divergence.
 *
 * Ball-continuity teleport is an extra oracle canary and does NOT
 * substitute for the PRNG-order mutant.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import { evaluate, type EvaluationResult } from "../../eval/runners/evaluate.js";
import { compareRuns } from "../../eval/runners/compare.js";
import { executeOracle } from "../../eval/oracles/oracle-registry.js";
// Import wire.ts to register built-in oracles.
import "../../eval/oracles/wire.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { createWorld } from "../../src/simulation/world/create.js";
import { runHeadless } from "../../src/apps/headless/run.js";
import { makeInputFrame } from "../unit/contracts.fixture.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(name: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, `../../eval/scenarios/${name}`);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

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

function corruptOneHash(
  hashes: Map<number, string>,
  corruptionTick: number,
  corruptionValue: string,
): Map<number, string> {
  const cloned = new Map(hashes);
  cloned.set(corruptionTick, corruptionValue);
  return cloned;
}

function buildCorruptedRun(
  original: EvaluationResult,
  corruptedHashes: Map<number, string>,
): EvaluationResult {
  return {
    ...original,
    hashes: corruptedHashes,
  };
}

// ===========================================================================
// Hash-divergence via compareRuns (injected corruption)
// ===========================================================================
// These tests exercise BOOTSTRAP-10's hash-divergence detection.
// They inject arbitrary corruption into a run's hash map and verify that
// compareRuns reports the correct earliestDivergenceTick.
// They are NOT the PRNG-order mutant; the real mutant is below.
// ===========================================================================

describe("Hash divergence via compareRuns: injected corruption", () => {
  it("detects divergence when one tick's stateHash is corrupted", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(10, "slot-1");
    modified.durationTicks = 10;

    // Both runs start identical.
    const runA = evaluate({ scenario: modified });
    const runB = evaluate({ scenario: modified });

    // Confirm both runs are identical before corruption.
    expect(runA.hashes.size).toBe(10);
    for (const [tick, hash] of runA.hashes) {
      expect(runB.hashes.get(Number(tick))).toBe(hash);
    }

    // Corrupt one tick's hash on the candidate side only.
    const corruptionTick = 3;
    const corruptionValue = "corrupted-hash-value-000000000";
    const corruptedHashesB = corruptOneHash(runB.hashes, corruptionTick, corruptionValue);
    const runBCorrupted = buildCorruptedRun(runB, corruptedHashesB);

    // Compare identical baseline against corrupted candidate.
    const cmp = compareRuns(runA, runBCorrupted);
    expect(cmp.status).toBe("delta_only");
    expect(cmp.conditionHashMatch).toBe(true);
    expect(cmp.earliestDivergenceTick).toBe(corruptionTick);
    expect(cmp.earliestDivergenceExpected).toBe(runA.hashes.get(corruptionTick));
    expect(cmp.earliestDivergenceActual).toBe(corruptionValue);
  });

  it("detects corruption in earliest-hash runs", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(5, "slot-1");
    modified.durationTicks = 5;

    const runA = evaluate({ scenario: modified });
    const runB = evaluate({ scenario: modified });

    // Hashes start at tick 1 (first step commits tick 1).
    // Corrupt the earliest hash tick.
    const earliestTick = Math.min(...runB.hashes.keys());
    const corruptedHashesB = corruptOneHash(runB.hashes, earliestTick, "bad");
    const runBCorrupted = buildCorruptedRun(runB, corruptedHashesB);

    const cmp = compareRuns(runA, runBCorrupted);
    expect(cmp.earliestDivergenceTick).toBe(earliestTick);
    // Earliest divergence must match the corrupted tick.
    expect(cmp.earliestDivergenceActual).toBe("bad");
  });

  it("no divergence when hashes are truly identical", () => {
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
// Genuine PRNG-order mutant
// ===========================================================================
// Two otherwise identical runs where one has its PRNG state mutated mid-run.
// The mutant must diverge deterministically from the mutation point.
// A clean pair of identical runs must still match.
// ===========================================================================

describe("PRNG-order mutant: genuine mutation", () => {
  it("diverges when one run's PRNG state is mutated mid-run", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(10, "slot-1");
    modified.durationTicks = 10;

    const mutationTick = 2;

    // Clean run — full scenario via evaluate().
    const cleanRun = evaluate({ scenario: modified });
    expect(cleanRun.hashes.size).toBe(10);

    // Mutant run: create a fresh simulation and run with the
    // **identical** input schedule as the clean run at **every** tick,
    // using the snapshot/restore API for PRNG mutation.
    const world = createWorld({ scenario: modified });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sim = createSimulation(world, undefined as any);

    // Pre-mutation: run ticks 0..mutationTick-1 with identical inputs.
    const mutantHashes: Map<number, string> = new Map();
    for (let i = 0; i < mutationTick; i++) {
      const tickInputs = modified.inputProgram[sim.tick] ?? [];
      if (tickInputs.length > 0) {
        sim.applyInputs(tickInputs);
      }
      const result = sim.step();
      mutantHashes.set(result.tick, result.stateHash);
    }

    // Assert pre-mutation hashes match the clean run.
    for (const [tick, mutantHash] of mutantHashes) {
      expect(cleanRun.hashes.get(tick)).toBe(mutantHash);
    }

    // Mutate PRNG via the snapshot/restore API:
    // deep-clone the checkpoint, mutate prng.state in the clone, restore.
    const snapshot = sim.snapshot() as import("../../src/contracts/state.js").WorldState;
    const clone = structuredClone
      ? structuredClone(snapshot)
      : JSON.parse(JSON.stringify(snapshot)) as import("../../src/contracts/state.js").WorldState;
    clone.prng.state = (clone.prng.state as number) ^ 1;
    sim.restore(clone);

    // Continue to end with identical inputs.
    for (let i = mutationTick; i < modified.durationTicks; i++) {
      const tickInputs = modified.inputProgram[sim.tick] ?? [];
      if (tickInputs.length > 0) {
        sim.applyInputs(tickInputs);
      }
      const result = sim.step();
      mutantHashes.set(result.tick, result.stateHash);
    }

    // Divergence must appear at or after the mutation tick.
    let foundDivergence = false;
    for (const [tick, mutantHash] of mutantHashes) {
      const cleanHash = cleanRun.hashes.get(tick);
      if (cleanHash !== mutantHash) {
        foundDivergence = true;
        expect(tick).toBeGreaterThanOrEqual(3);
        break;
      }
    }
    expect(foundDivergence).toBe(true);
  });

  it("identity clone (restore without mutating prng) yields zero divergence", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(10, "slot-1");
    modified.durationTicks = 10;

    const mutationTick = 2;

    // Clean run — full scenario via evaluate().
    const cleanRun = evaluate({ scenario: modified });
    expect(cleanRun.hashes.size).toBe(10);

    // Mutant-like run: run with identical inputs, restore from
    // an identity clone (prng.state NOT mutated), continue.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const world = createWorld({ scenario: modified });
    const sim = createSimulation(world, undefined as any);

    const mutantHashes: Map<number, string> = new Map();

    // Pre-mutation ticks (identical input schedule).
    for (let i = 0; i < mutationTick; i++) {
      const tickInputs = modified.inputProgram[sim.tick] ?? [];
      if (tickInputs.length > 0) {
        sim.applyInputs(tickInputs);
      }
      const r = sim.step();
      mutantHashes.set(r.tick, r.stateHash);
    }

    // Identity clone: snapshot → deep-clone → restore (no prng.state change).
    const snapshot = sim.snapshot() as import("../../src/contracts/state.js").WorldState;
    const clone = JSON.parse(JSON.stringify(snapshot)) as import("../../src/contracts/state.js").WorldState;
    sim.restore(clone);

    // Post-mutation ticks (identical input schedule).
    for (let i = mutationTick; i < modified.durationTicks; i++) {
      const tickInputs = modified.inputProgram[sim.tick] ?? [];
      if (tickInputs.length > 0) {
        sim.applyInputs(tickInputs);
      }
      const r = sim.step();
      mutantHashes.set(r.tick, r.stateHash);
    }

    // Zero divergence across ALL ticks.
    for (const [tick, h] of cleanRun.hashes) {
      expect(mutantHashes.get(tick)).toBe(h);
    }
  });

  it("identical clean runs still match (regression guard)", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(10, "slot-1");
    modified.durationTicks = 10;

    const runA = evaluate({ scenario: modified });
    const runB = evaluate({ scenario: modified });

    // Identical runs must produce identical hashes at every tick.
    for (const [tick, hash] of runA.hashes) {
      expect(runB.hashes.get(Number(tick))).toBe(hash);
    }

    // compareRuns must find no divergence.
    const cmp = compareRuns(runA, runB);
    expect(cmp.status).toBe("delta_only");
    expect(cmp.conditionHashMatch).toBe(true);
    expect(cmp.earliestDivergenceTick).toBeUndefined();
  });
});

// ===========================================================================
// Input-schedule consistency guard
// ===========================================================================
// evaluate() must apply input frames for tick sim.tick (the headless
// convention). A prior off-by-one (inputProgram[sim.tick + 1]) silently
// dropped the tick-0 input frame and desynchronised evaluate() from every
// other runner, which the PRNG-order mutant tests then flagged. This guard
// pins the two entry points to the same per-tick hash stream so the drift
// cannot return unnoticed.
// ===========================================================================

describe("Input-schedule consistency between evaluate() and runHeadless()", () => {
  it("same input-driven scenario produces identical per-tick hashes in both runners", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(10, "slot-1");
    modified.durationTicks = 10;

    const ev = evaluate({ scenario: modified });
    const hl = runHeadless({ scenario: modified });

    const hlHashes = new Map(hl.hashes.map((h) => [h.tick, h.hash]));
    expect(ev.hashes.size).toBe(10);
    expect(hlHashes.size).toBe(10);
    for (const [tick, hash] of ev.hashes) {
      expect(hlHashes.get(tick)).toBe(hash);
    }
  });
});

// ===========================================================================
// Extra oracle canary: ball-continuity teleport detection
// ===========================================================================
// This test verifies the ball-continuity oracle catches teleportation
// via observation corruption. It does NOT substitute for the PRNG-order
// mutant above.
// ===========================================================================

describe("Oracle canary: ball-continuity teleport", () => {
  it("ball-continuity oracle detects mutated ball position", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(6, "slot-1");
    modified.durationTicks = 6;

    const run = evaluate({ scenario: modified });
    expect(run.observations.length).toBeGreaterThanOrEqual(2);

    // Clean observations should pass ball-continuity.
    const cleanResults = executeOracle(
      "ball-continuity",
      "oracle-continuity-v1",
      run.observations,
    );
    for (const r of cleanResults) {
      if (r.id.includes("ball-continuity")) {
        expect(r.status).toBe("pass");
      }
    }

    // Corrupt one observation's ball position to simulate teleportation.
    const corruptedObs = {
      ...run.observations[1],
      ball: {
        ...run.observations[1].ball,
        position: { x: 1000, y: 1000, z: 1000 },
      },
    };
    const corruptedObsList = [run.observations[0], corruptedObs];

    const mutatedResults = executeOracle(
      "ball-continuity",
      "oracle-continuity-v1",
      corruptedObsList,
    );
    // The teleportation displacement exceeds the continuity bound.
    const failResult = mutatedResults.find((r) => r.status === "fail");
    expect(failResult).toBeDefined();
  });
});