/**
 * @module nondeterminism-canary-tests
 *
 * Real nondeterminism canary: same scenario / seed / config on both sides,
 * but one side gets a corrupted hash.  The comparison must detect the
 * divergence and report earliestDivergenceTick.
 *
 * This is NOT the old "two different seeds → expect mismatch" test.
 * The old test was expected determinism.  This test injects corruption.
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

/**
 * Clone a run's hashes Map and corrupt one entry.
 */
function corruptOneHash(
  hashes: Map<number, string>,
  corruptionTick: number,
  corruptionValue: string,
): Map<number, string> {
  const cloned = new Map(hashes);
  cloned.set(corruptionTick, corruptionValue);
  return cloned;
}

/**
 * Build a modified EvaluationResult with corrupted hashes,
 * copying over all other fields from the original run.
 */
function buildCorruptedRun(
  original: EvaluationResult,
  corruptedHashes: Map<number, string>,
): EvaluationResult {
  return {
    ...original,
    hashes: corruptedHashes,
  };
}

// ---------------------------------------------------------------------------
// Real nondeterminism canary: same scenario, one corrupted hash
// ---------------------------------------------------------------------------

describe("Nondeterminism canary: same scenario, injected corruption", () => {
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
    expect(cmp.status).toBe("delta_only"); // condition hash matches (same scenario).
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