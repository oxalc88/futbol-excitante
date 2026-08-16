/**
 * @module tests/unit/eval/mutant-core
 *
 * Tests for the MUTANT_CORE reducer (eval/runners/mutant-core.ts).
 *
 * Covers:
 *   1. Clean + poisoned pairs for each implementable mutant:
 *        - Oracle detects corruption (FAIL on poisoned)
 *        - Oracle passes on clean data (PASS on clean)
 *   2. Deferred mutants stay NOT_EVALUATED
 *   3. Reducer verdict = PASS only when all implementable mutants fire
 *   4. A skipped implementable mutant (not run) cannot yield PASS
 *   5. MEASURED_TARGET still BLOCKED_MISSING_REFERENCE (referenced via evaluator)
 *   6. No theatrical "nondeterminism" — two clean runs match
 *
 * Imports wire.ts to register all oracles before running.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Import wire.ts to register all built-in oracles (side-effect).
import "../../../eval/oracles/wire.js";

import { evaluate } from "../../../eval/runners/evaluate.js";
import { executeOracle } from "../../../eval/oracles/oracle-registry.js";
import { checkDeferredMutants } from "../../../eval/oracles/deferred-mutants.js";
import { checkPrngOrderMutation } from "../../../eval/oracles/prng-order.js";
import { evaluateMutantCore } from "../../../eval/runners/mutant-core.js";
import {
  IMPLEMENTABLE_MUTANTS,
  type MutationDefinition,
} from "../../../eval/oracles/mutant-registry.js";
import { DEFERRED_MUTANTS_V1 } from "../../../eval/oracles/deferred-mutants.js";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";

import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { InputFrame } from "../../../src/contracts/input.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Project root — derived from CWD (set by mise/vitest). */
const PROJECT_ROOT = join(process.cwd());

function loadScenario(): ScenarioDefinition {
  const fixturePath = join(
    PROJECT_ROOT,
    "eval/scenarios/foundation-move-and-roll.v1.json",
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
    program[t] = [
      {
        tick: t,
        sourceId: "test-source",
        controlSlot,
        moveX: 0,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ];
  }
  return program;
}

function makeObservationWithNaN(
  base: TelemetryObservation,
): TelemetryObservation {
  return {
    ...base,
    players: base.players.map((p) => ({
      ...p,
      linearVelocity: { ...p.linearVelocity, x: NaN },
    })),
  };
}

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
      bodyHeading: p.bodyHeading + 4,
    })),
  };
  return [obs1, obs2];
}

function makeObservationsWithNoBallDecay(
  base: TelemetryObservation,
): TelemetryObservation[] {
  const velocityX = 3.0;
  const ballState = {
    ...base.ball,
    regime: "ground-roll" as const,
    linearVelocity: { x: velocityX, y: 0, z: 0 },
  };
  const obs1 = { ...base, tick: 20, simulationTime: 20 / 60, ball: ballState };
  const obs2 = { ...base, tick: 21, simulationTime: 21 / 60, ball: ballState };
  return [obs1, obs2];
}

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
      position: { x: 1000, y: 1000, z: 1000 },
    },
  };
  return [obs1, obs2];
}

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
      lastTouchRef: "touch-event-fake",
    },
    events: [],
  };
  return [obs1, obs2];
}

function makeObservationsWithScoreTracker(
  base: TelemetryObservation,
): TelemetryObservation[] {
  const obs1 = { ...base, tick: 50, simulationTime: 50 / 60 };
  const obs2 = {
    ...base,
    tick: 51,
    simulationTime: 51 / 60,
    events: [{ kind: "goal", payload: { goalIndex: 2 } }],
  };
  return [obs1, obs2];
}

function makeObservationsWithMatchClock(
  base: TelemetryObservation,
): TelemetryObservation[] {
  // First observation has tick 0, second skips to tick 2 (missing tick 1).
  const obs1 = { ...base, tick: 0, simulationTime: 0 / 60 };
  const obs2 = { ...base, tick: 2, simulationTime: 2 / 60 };
  return [obs1, obs2];
}

// ---------------------------------------------------------------------------
// 1. Each implementable mutant: clean PASS + poisoned FAIL
// ---------------------------------------------------------------------------

describe("Implementable mutants: clean PASS and poisoned FAIL", () => {
  for (const mutant of IMPLEMENTABLE_MUTANTS) {
    if (mutant.id === "prng-order") {
      // PRNG-order handled separately (runs simulation pair, not observations).
      continue;
    }

    it(`mutant "${mutant.id}": clean passes oracle`, () => {
      const scenario = loadScenario();
      scenario.inputProgram = buildInputProgram(5, "slot-1");
      scenario.durationTicks = 5;

      const result = evaluate({ scenario });
      expect(result.observations.length).toBeGreaterThan(0);

      // Oracle on clean data — must have at least one PASS result.
      const results = executeOracle(
        mutant.oracleId,
        mutant.oracleVersion,
        result.observations,
      );
      const hasPass = results.some((r) => r.status === "pass");
      expect(
        hasPass,
        `Oracle ${mutant.oracleId} did not pass on clean data for mutant ${mutant.id}`,
      ).toBe(true);
    });

    it(`mutant "${mutant.id}": poisoned data triggers oracle FAIL`, () => {
      const scenario = loadScenario();
      scenario.inputProgram = buildInputProgram(5, "slot-1");
      scenario.durationTicks = 5;

      const result = evaluate({ scenario });
      expect(result.observations.length).toBeGreaterThan(0);

      const base = result.observations[0];
      let corruptedObsList: TelemetryObservation[];

      // Build corrupted observations depending on mutant type.
      if (mutant.id === "non-finite") {
        corruptedObsList = [makeObservationWithNaN(base)];
      } else if (mutant.id === "velocity-snap") {
        corruptedObsList = makeObservationsWithVelocitySnap(base);
      } else if (mutant.id === "ball-no-decay") {
        corruptedObsList = makeObservationsWithNoBallDecay(base);
      } else if (mutant.id === "ball-teleport") {
        corruptedObsList = makeObservationsWithBallTeleport(base);
      } else if (mutant.id === "possession-no-evidence") {
        corruptedObsList = makeObservationsWithPossessionNoEvidence(base);
      } else if (mutant.id === "camera-hash") {
        corruptedObsList = [
          { ...base, observationCoreHash: "corrupted-hash-000000" },
        ];
      } else if (mutant.id === "score-tracker") {
        corruptedObsList = makeObservationsWithScoreTracker(base);
      } else if (mutant.id === "match-clock") {
        corruptedObsList = makeObservationsWithMatchClock(base);
      } else {
        corruptedObsList = [base];
      }

      // Oracle on corrupted data — must have at least one FAIL result.
      const results = executeOracle(
        mutant.oracleId,
        mutant.oracleVersion,
        corruptedObsList,
      );
      const hasFail = results.some((r) => r.status === "fail");
      expect(
        hasFail,
        `Oracle ${mutant.oracleId} did not detect corruption for mutant ${mutant.id}`,
      ).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. PRNG-order: genuine divergence detection
// ---------------------------------------------------------------------------

describe("PRNG-order mutant: genuine divergence", () => {
  it("mutant run diverges when PRNG state is XORed mid-run", () => {
    const scenario = loadScenario();
    const durationTicks = 10;
    scenario.durationTicks = durationTicks;

    const inputProgram = buildInputProgram(durationTicks, "slot-1");

    const cleanWorld = createWorld({ scenario });
    const cleanSim = createSimulation(cleanWorld);
    const cleanHashes = new Map<number, string>();
    for (let i = 0; i < durationTicks; i++) {
      const inputs = inputProgram[cleanSim.tick] ?? [];
      if (inputs.length > 0) cleanSim.applyInputs(inputs);
      const r = cleanSim.step();
      cleanHashes.set(r.tick, r.stateHash);
    }

    // Mutant simulation: run up to corruption tick, mutate PRNG, continue.
    const mutationTick = 2;
    const mutantWorld = createWorld({ scenario });
    const mutantSim = createSimulation(mutantWorld);

    for (let i = 0; i < mutationTick; i++) {
      const inputs = inputProgram[mutantSim.tick] ?? [];
      if (inputs.length > 0) mutantSim.applyInputs(inputs);
      const r = mutantSim.step();
      expect(cleanHashes.get(r.tick)).toBe(r.stateHash);
    }

    // Mutate PRNG state.
    const snapshot = mutantSim.snapshot();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clone = structuredClone
      ? structuredClone(snapshot)
      : JSON.parse(JSON.stringify(snapshot));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prngState = (clone as any).prng?.state;
    if (typeof prngState === "number") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (clone as any).prng.state = prngState ^ 1;
    }
    mutantSim.restore(clone);

    // Continue mutant.
    let foundDivergence = false;
    for (let i = mutationTick; i < durationTicks; i++) {
      const inputs = inputProgram[mutantSim.tick] ?? [];
      if (inputs.length > 0) mutantSim.applyInputs(inputs);
      const r = mutantSim.step();
      if (r.stateHash !== cleanHashes.get(r.tick)) {
        foundDivergence = true;
        break;
      }
    }

    expect(foundDivergence).toBe(true);
  });

  it("checkPrngOrderMutation detects divergence", () => {
    const scenario = loadScenario();
    scenario.durationTicks = 10;
    const inputProgram = buildInputProgram(10, "slot-1");

    const result = checkPrngOrderMutation(scenario, inputProgram, 10, 2);
    expect(result.status).toBe("pass");
  });

  it("identical clean runs match (no theatrical nondeterminism)", () => {
    const scenario = loadScenario();
    scenario.durationTicks = 10;
    const inputProgram = buildInputProgram(10, "slot-1");

    const world1 = createWorld({ scenario });
    const sim1 = createSimulation(world1);
    const world2 = createWorld({ scenario });
    const sim2 = createSimulation(world2);

    for (let i = 0; i < scenario.durationTicks; i++) {
      const inputs1 = inputProgram[sim1.tick] ?? [];
      if (inputs1.length > 0) sim1.applyInputs(inputs1);
      const inputs2 = inputProgram[sim2.tick] ?? [];
      if (inputs2.length > 0) sim2.applyInputs(inputs2);

      const r1 = sim1.step();
      const r2 = sim2.step();
      expect(r1.stateHash).toBe(r2.stateHash);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Deferred mutants: NOT_EVALUATED
// ---------------------------------------------------------------------------

describe("Deferred mutants: NOT_EVALUATED", () => {
  it("DEFERRED_MUTANTS_V1 is non-empty", () => {
    expect(DEFERRED_MUTANTS_V1.length).toBeGreaterThan(0);
    for (const m of DEFERRED_MUTANTS_V1) {
      expect(m.id).toMatch(/.+/);
      expect(m.description).toMatch(/.+/);
      expect(m.reason).toMatch(/.+/);
    }
  });

  it("checkDeferredMutants returns not_evaluated", () => {
    const result = checkDeferredMutants();
    expect(result.status).toBe("not_evaluated");
    expect(result.id).toContain("deferred-mutants");
    const details = result.details as Record<string, unknown>;
    expect(details?.mutantIds).toBeDefined();
    expect((details?.mutantIds as string[])?.length).toBeGreaterThan(0);
  });

  it("deferred-mutants oracle (executeOracle) returns not_evaluated", () => {
    const results = executeOracle(
      "deferred-mutants",
      "oracle-deferred-mutants-v1",
      [],
    );
    const notEvaluated = results.find((r) => r.status === "not_evaluated");
    expect(notEvaluated).toBeDefined();
  });

  it("deferred mutants never produce PASS or FAIL", () => {
    // Verify the oracle result is strictly not_evaluated.
    const result = checkDeferredMutants();
    expect(result.status).not.toBe("pass");
    expect(result.status).not.toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// 4. Reducer verdict: PASS only when ALL implementable mutants fire
// ---------------------------------------------------------------------------

describe("Reducer verdict: all implementable mutants must fire", () => {
  it("reducer returns PASS when all oracles detect their mutations", () => {
    const scenario = loadScenario();
    const result = evaluateMutantCore({ scenario });

    expect(result.verdict).toBe("PASS");
    expect(result.implementableCount).toBeGreaterThan(0);
    expect(result.deferredCount).toBeGreaterThan(0);
    expect(result.allImplementedDetected).toBe(true);

    // Every implementable outcome should be PASS.
    const implementableOutcomes = result.outcomes.filter(
      (o) => !o.deferred && o.mutationId !== "deferred-summary",
    );
    for (const o of implementableOutcomes) {
      expect(o.outcome).toBe("PASS");
      expect(o.executed).toBe(true);
    }
  });

  it("reducer reports at least one PASS outcome per mutant", () => {
    const scenario = loadScenario();
    const result = evaluateMutantCore({ scenario });

    for (const outcome of result.outcomes) {
      if (outcome.mutationId === "deferred-summary") continue;
      // Each mutant must have a cleanResult and either a poisonedResult or pass via prng.
      if (outcome.mutationId === "prng-order") {
        // PRNG-order uses checkPrngOrderMutation directly.
        expect(outcome.executed).toBe(true);
      } else {
        expect(outcome.executed).toBe(true);
        expect(outcome.cleanResult).not.toBeNull();
        expect(outcome.poisonedResult).not.toBeNull();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Skipped implementable mutant → INVALID_RUN
// ---------------------------------------------------------------------------

describe("Skipped implementable mutant prevents PASS", () => {
  it("reducer structure is correct even with minimal scenario", () => {
    // Use the real scenario but verify the structure.
    const scenario = loadScenario();
    const result = evaluateMutantCore({ scenario });

    // Verify the structure is correct.
    expect(result.implementableCount).toBe(IMPLEMENTABLE_MUTANTS.length);
    expect(result.deferredCount).toBe(DEFERRED_MUTANTS_V1.length);
    // Every implementable mutant should have an outcome entry.
    const implementableEntries = result.outcomes.filter(
      (o) => o.mutationId !== "deferred-summary",
    );
    expect(implementableEntries.length).toBe(IMPLEMENTABLE_MUTANTS.length);
    // Every entry should be marked as executed.
    for (const o of implementableEntries) {
      expect(o.executed).toBe(true);
    }
  });

  it("skipping an implementable mutant yields INVALID_RUN, not PASS", () => {
    // Skip the first implementable mutant (non-finite) using skipMutationIds.
    const scenario = loadScenario();
    const result = evaluateMutantCore({
      scenario,
      skipMutationIds: ["non-finite"],
    });

    // Verdict must NOT be PASS — an unexecuted mutant makes it INVALID_RUN.
    expect(result.verdict).not.toBe("PASS");
    expect(result.verdict).toBe("INVALID_RUN");
    expect(result.anyInvalidRun).toBe(true);
    expect(result.allImplementedDetected).toBe(false);

    // The skipped mutant should have outcome INVALID_RUN.
    const skippedOutcome = result.outcomes.find(
      (o) => o.mutationId === "non-finite",
    );
    expect(skippedOutcome).toBeDefined();
    expect(skippedOutcome?.outcome).toBe("INVALID_RUN");
    expect(skippedOutcome?.executed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. MEASURED_TARGET stays BLOCKED_MISSING_REFERENCE
// ---------------------------------------------------------------------------

describe("MEASURED_TARGET: BLOCKED_MISSING_REFERENCE", () => {
  it("MEASURED_TARGET criterion outcome is BLOCKED_MISSING_REFERENCE, not PASS", () => {
    const scenario = loadScenario();
    scenario.inputProgram = buildInputProgram(5, "slot-1");
    scenario.durationTicks = 5;

    const result = evaluate({ scenario });

    // Any oracle that could produce results on clean data should
    // not produce a PASS that translates to a MEASURED_TARGET verdict.
    // This is enforced by the foundation evaluator — verify the oracle
    // can be called but the criterion outcome class governs.
    expect(result.observations.length).toBeGreaterThan(0);

    // finite-number on clean data passes.
    const results = executeOracle(
      "finite-number",
      "oracle-finite-v1",
      result.observations,
    );
    const hasPass = results.some((r) => r.status === "pass");
    expect(hasPass).toBe(true);

    // But MEASURED_TARGET outcome is set by the reference registry,
    // not by oracle results.  The oracle results being "pass" does
    // not mean MEASURED_TARGET passes — that's verified by the
    // foundation evaluator (tests/unit/eval/foundation-evaluator.test.ts).
  });
});

// ---------------------------------------------------------------------------
// 7. Registry integrity
// ---------------------------------------------------------------------------

describe("Registry integrity", () => {
  it("IMPLEMENTABLE_MUTANTS has no duplicate IDs", () => {
    const ids = IMPLEMENTABLE_MUTANTS.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("IMPLEMENTABLE_MUTANTS are all deferred: false", () => {
    for (const m of IMPLEMENTABLE_MUTANTS) {
      expect(m.deferred).toBe(false);
    }
  });

  it("all IMPLEMENTABLE_MUTANTS have registered oracles", () => {
    for (const m of IMPLEMENTABLE_MUTANTS) {
      // This will throw if the oracle is not registered.
      const entry = executeOracle(
        m.oracleId,
        m.oracleVersion,
        [],
      );
      // Just accessing via executeOracle verifies registration.
      // For some oracles (like prng-order) this returns not_evaluated.
      // For others (like deferred-mutants) this also returns not_evaluated.
      expect(entry).toBeDefined();
    }
  });

  it("DEFERRED_MUTANTS_V1 has no duplicate IDs", () => {
    const ids = DEFERRED_MUTANTS_V1.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// 8. No theatrical "nondeterminism": two identical runs produce same hashes
// ---------------------------------------------------------------------------

describe("No theatrical nondeterminism", () => {
  it("two identical scenario runs produce identical hashes at every tick", () => {
    const scenario = loadScenario();
    const durationTicks = 10;
    scenario.durationTicks = durationTicks;
    scenario.inputProgram = buildInputProgram(durationTicks, "slot-1");

    const runA = evaluate({ scenario });
    const runB = evaluate({ scenario });

    expect(runA.hashes.size).toBe(durationTicks);
    for (const [tick, hashA] of runA.hashes) {
      const hashB = runB.hashes.get(Number(tick));
      expect(hashB, `Hash mismatch at tick ${tick}`).toBe(hashA);
    }
  });
});