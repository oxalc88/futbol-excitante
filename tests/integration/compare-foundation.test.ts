/**
 * @module tests/integration/compare-foundation
 *
 * Tests for the two-run COMMON-DETERMINISTIC evaluation path.
 *
 * Test families:
 * 1. Two identical clean runs → COMMON-DETERMINISTIC PASS
 * 2. PRNG-order mutant → COMMON-DETERMINISTIC FAIL
 * 3. MEASURED_TARGET still BLOCKED_MISSING_REFERENCE on suites
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
import type { WorldState } from "../../src/contracts/state.js";

import { evaluate } from "../../eval/runners/evaluate.js";
import { compareAndEvaluateFoundation } from "../../eval/runners/compare-foundation.js";
import { compareRuns } from "../../eval/runners/compare.js";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { loadRegistrySet } from "../../eval/contracts/loader.js";
import { makeInputFrame } from "../unit/contracts.fixture.js";
import "../../eval/oracles/wire.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(
    __dirname,
    "../../eval/scenarios/foundation-move-and-roll.v1.json",
  );
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

// ===========================================================================
// 1. Two identical clean runs → COMMON-DETERMINISTIC PASS
// ===========================================================================

describe("COMMON-DETERMINISTIC: two identical clean runs → PASS", () => {
  it("compareAndEvaluateFoundation returns PASS for two identical runs", () => {
    const scenario = loadFixture();
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(10, "slot-1");
    modified.durationTicks = 10;

    const result = compareAndEvaluateFoundation(modified);

    // COMMON-DETERMINISTIC must be PASS.
    expect(result.commonDeterministicOutcome).toBe("PASS");
    expect(result.conditionHashMatch).toBe(true);
    expect(result.earliestDivergenceTick).toBeUndefined();

    // Evidence must reference both runs.
    expect(result.commonDeterministicEvidence).toContain("state/hashes-run-a.jsonl");
    expect(result.commonDeterministicEvidence).toContain("state/hashes-run-b.jsonl");

    // Suites must still be present.
    expect(result.suites.length).toBeGreaterThan(0);
  });

  it("compareRuns also finds no divergence between two identical evaluate results", () => {
    const scenario = loadFixture();
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(8, "slot-1");
    modified.durationTicks = 8;

    const runA = evaluate({ scenario: modified });
    const runB = evaluate({ scenario: modified });

    // verify all per-tick hashes match
    for (const [tick, hash] of runA.hashes) {
      expect(runB.hashes.get(Number(tick))).toBe(hash);
    }

    const comparison = compareRuns(runA, runB);
    expect(comparison.status).toBe("delta_only");
    expect(comparison.conditionHashMatch).toBe(true);
    expect(comparison.earliestDivergenceTick).toBeUndefined();
  });

  it("hashes match at every tick from 1 to durationTicks", () => {
    const scenario = loadFixture();
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(15, "slot-1");
    modified.durationTicks = 15;

    const runA = evaluate({ scenario: modified });
    const runB = evaluate({ scenario: modified });

    expect(runA.hashes.size).toBe(15);
    expect(runB.hashes.size).toBe(15);

    for (const [tick, hash] of runA.hashes) {
      expect(runB.hashes.get(Number(tick))).toBe(hash);
    }
  });

  it("compareAndEvaluateFoundation overall suites are not invalidated by PASS", () => {
    const scenario = loadFixture();
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(10, "slot-1");
    modified.durationTicks = 10;

    const result = compareAndEvaluateFoundation(modified);

    // Each suite must have tests with criteria.
    for (const suite of result.suites) {
      expect(suite.tests.length).toBeGreaterThan(0);
      for (const test of suite.tests) {
        // At least some criteria should be evaluated.
        const evaluated = test.criteria.filter(
          (c) => c.outcome !== "NOT_EVALUATED",
        );
        expect(evaluated.length).toBeGreaterThan(0);
      }
    }
  });
});

// ===========================================================================
// 2. PRNG-order mutant → COMMON-DETERMINISTIC FAIL
// ===========================================================================

describe("COMMON-DETERMINISTIC: PRNG-order mutant → FAIL", () => {
  it("diverges when one run's PRNG state is mutated mid-run", () => {
    const scenario = loadFixture();
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(10, "slot-1");
    modified.durationTicks = 10;

    // Clean run via evaluate().
    const cleanRun = evaluate({ scenario: modified });
    expect(cleanRun.hashes.size).toBe(10);

    // Mutant run: use the same scenario, same inputs, but mutate PRNG mid-run.
    const mutationTick = 2;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const world = createWorld({ scenario: modified });
    const sim = createSimulation(world, undefined as any);

    const mutantHashes: Map<number, string> = new Map();

    // Pre-mutation ticks with identical inputs.
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

    // Mutate PRNG via snapshot/restore: clone → xor prng.state → restore.
    const snapshot = sim.snapshot() as WorldState;
    const clone = JSON.parse(JSON.stringify(snapshot)) as WorldState;
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

    // Compare clean run vs mutant run.
    const comparison = compareRuns(cleanRun, {
      ...cleanRun,
      hashes: mutantHashes,
    });

    // Divergence must exist.
    expect(comparison.earliestDivergenceTick).toBeDefined();
    expect(comparison.earliestDivergenceTick).toBeGreaterThanOrEqual(3);

    // The mutant hashes should differ at or after the mutation point.
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

  it("identity clone (no PRNG mutation) yields zero divergence", () => {
    const scenario = loadFixture();
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(10, "slot-1");
    modified.durationTicks = 10;

    const cleanRun = evaluate({ scenario: modified });

    // Identity-clone mutant: run with same inputs, restore from a
    // non-mutated clone, continue — should produce zero divergence.
    const mutationTick = 2;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const world = createWorld({ scenario: modified });
    const sim = createSimulation(world, undefined as any);

    const mutantHashes: Map<number, string> = new Map();

    for (let i = 0; i < mutationTick; i++) {
      const tickInputs = modified.inputProgram[sim.tick] ?? [];
      if (tickInputs.length > 0) {
        sim.applyInputs(tickInputs);
      }
      const r = sim.step();
      mutantHashes.set(r.tick, r.stateHash);
    }

    // Identity clone: deep-clone → restore (no prng.state change).
    const snapshot = sim.snapshot() as WorldState;
    const clone = JSON.parse(JSON.stringify(snapshot)) as WorldState;
    sim.restore(clone);

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

  it("PRNG mutation on the first tick causes divergence at tick 1", () => {
    const scenario = loadFixture();
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(5, "slot-1");
    modified.durationTicks = 5;

    // Clean run.
    const cleanRun = evaluate({ scenario: modified });

    // Mutant run: mutate PRNG at creation (before any step).
    const mutantWorld = createWorld({ scenario: modified });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mutantSim = createSimulation(mutantWorld, undefined as any);
    const mutSnapshot = mutantSim.snapshot() as WorldState;
    const mutClone = JSON.parse(JSON.stringify(mutSnapshot)) as WorldState;
    mutClone.prng.state = (mutClone.prng.state as number) ^ 0xdeadbeef;
    mutantSim.restore(mutClone);

    const mutantHashes = new Map<number, string>();
    for (let i = 0; i < modified.durationTicks; i++) {
      const tickInputs = modified.inputProgram[mutantSim.tick] ?? [];
      if (tickInputs.length > 0) {
        mutantSim.applyInputs(tickInputs);
      }
      const r = mutantSim.step();
      mutantHashes.set(r.tick, r.stateHash);
    }

    const comparison = compareRuns(cleanRun, {
      ...cleanRun,
      hashes: mutantHashes,
    });

    // Divergence should appear at tick 1 (first tick after PRNG draw).
    expect(comparison.earliestDivergenceTick).toBe(1);
  });
});

// ===========================================================================
// 3. MEASURED_TARGET still BLOCKED_MISSING_REFERENCE
// ===========================================================================

describe("COMMON-DETERMINISTIC: MEASURED_TARGET remains BLOCKED_MISSING_REFERENCE", () => {
  it("suites from compareAndEvaluateFoundation still show BLOCKED_MISSING_REFERENCE for MEASURED_TARGET criteria", () => {
    const scenario = loadFixture();
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(10, "slot-1");
    modified.durationTicks = 10;

    const result = compareAndEvaluateFoundation(modified);

    // BALL-SPD-001-REF is a MEASURED_TARGET criterion in BALL-IND-001.
    const fastSuite = result.suites.find((s) => s.suite_id === "fast");
    expect(fastSuite).toBeDefined();

    const ballInd = fastSuite!.tests.find((t) => t.test_id === "BALL-IND-001");
    expect(ballInd).toBeDefined();

    const measuredCriterion = ballInd!.criteria.find(
      (c) => c.criterion_id === "BALL-SPD-001-REF",
    );
    expect(measuredCriterion).toBeDefined();
    expect(measuredCriterion!.class).toBe("MEASURED_TARGET");
    expect(measuredCriterion!.outcome).toBe("BLOCKED_MISSING_REFERENCE");
  });
});