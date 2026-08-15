/**
 * @module tests/unit/eval/mutant-1v1
 *
 * Tests for the MUTANT_1V1 reducer (eval/runners/mutant-1v1.ts)
 * and the wired exit prerequisites in the playable evaluator.
 *
 * Covers:
 *   1. Clean 1v1 mutant evaluation → MUTANT_1V1 PASS.
 *   2. A poisoned/undetected mutant → MUTANT_1V1 FAIL (prove the path can fail).
 *   3. Skipped/unexecuted implementable mutant → INVALID_RUN.
 *   4. evaluatePlayable1v1 exit prerequisites:
 *      - MUTANT_1V1_PASS is executable (not hard-coded NOT_EVALUATED).
 *      - ARCHETYPE_BLINDED_COMPARISON_PASS stays NOT_EVALUATED.
 *      - Overall verdict is never PASS.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Import wire.ts to register all oracles (side-effect).
import "../../../eval/oracles/wire.js";

import { evaluate } from "../../../eval/runners/evaluate.js";
import { executeOracle } from "../../../eval/oracles/oracle-registry.js";
import { checkDeferredMutants } from "../../../eval/oracles/deferred-mutants.js";
import { checkPrngOrderMutation } from "../../../eval/oracles/prng-order.js";
import { evaluateMutant1v1 } from "../../../eval/runners/mutant-1v1.js";
import {
  IMPLEMENTABLE_MUTANTS,
  type MutationDefinition,
} from "../../../eval/oracles/mutant-registry.js";
import { DEFERRED_MUTANTS_V1 } from "../../../eval/oracles/deferred-mutants.js";
import { evaluatePlayable1v1 } from "../../../eval/runners/playable-evaluator.js";
import { PLAYABLE_1V1_PROFILE } from "../../../eval/contracts/profiles.js";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";

import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function load1v1Scenario(): Record<string, unknown> {
  const fixturePath = join(
    process.cwd(),
    "eval/scenarios/two-player-duel.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

function build1v1InputProgram(
  durationTicks: number,
): Record<
  number,
  {
    tick: number;
    sourceId: string;
    controlSlot: string;
    moveX: number;
    moveY: number;
    sprint: number;
    heldButtons: number;
    pressedButtons: number;
    releasedButtons: number;
  }[]
> {
  const program: Record<
    number,
    {
      tick: number;
      sourceId: string;
      controlSlot: string;
      moveX: number;
      moveY: number;
      sprint: number;
      heldButtons: number;
      pressedButtons: number;
      releasedButtons: number;
    }[]
  > = {};
  for (let t = 0; t < durationTicks; t++) {
    program[t] = [
      {
        tick: t,
        sourceId: "1v1-test",
        controlSlot: "slot-1",
        moveX: 0.5,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
      {
        tick: t,
        sourceId: "1v1-test",
        controlSlot: "slot-2",
        moveX: -0.5,
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

// ---------------------------------------------------------------------------
// 1. Clean 1v1 mutant evaluation → MUTANT_1V1 PASS
// ---------------------------------------------------------------------------

describe("MUTANT_1V1: clean evaluation → PASS", () => {
  it("reducer returns PASS when all oracles detect their mutations in 1v1 context", () => {
    const result = evaluateMutant1v1();

    expect(result.verdict).toBe("PASS");
    expect(result.implementableCount).toBeGreaterThan(0);
    expect(result.deferredCount).toBeGreaterThan(0);
    expect(result.allImplementedDetected).toBe(true);
    expect(result.allDeferredNotEvaluated).toBe(true);

    // Every implementable outcome should be PASS.
    const implementableOutcomes = result.outcomes.filter(
      (o) => !o.deferred && o.mutationId !== "deferred-summary",
    );
    for (const o of implementableOutcomes) {
      expect(o.outcome).toBe("PASS");
      expect(o.executed).toBe(true);
    }
  });

  it("result structure is correct", () => {
    const scenario = load1v1Scenario();
    const result = evaluateMutant1v1();

    expect(result.registryVersion).toBe("mutant-1v1-v1");
    expect(result.implementableCount).toBe(IMPLEMENTABLE_MUTANTS.length);
    expect(result.deferredCount).toBe(DEFERRED_MUTANTS_V1.length);

    // Every implementable mutant should have an outcome entry.
    const implementableEntries = result.outcomes.filter(
      (o) => o.mutationId !== "deferred-summary",
    );
    expect(implementableEntries.length).toBe(IMPLEMENTABLE_MUTANTS.length);
    for (const o of implementableEntries) {
      expect(o.executed).toBe(true);
    }
  });

  it("deferred-summary outcome is NOT_EVALUATED", () => {
    const result = evaluateMutant1v1();

    const deferredSummary = result.outcomes.find(
      (o) => o.mutationId === "deferred-summary",
    );
    expect(deferredSummary).toBeDefined();
    expect(deferredSummary?.outcome).toBe("NOT_EVALUATED");
    expect(deferredSummary?.deferred).toBe(true);
  });

  it("each implementable mutant has cleanResult and poisonedResult", () => {
    const result = evaluateMutant1v1();

    for (const outcome of result.outcomes) {
      if (outcome.mutationId === "deferred-summary") continue;
      if (outcome.mutationId === "prng-order") {
        // PRNG-order uses checkPrngOrderMutation directly.
        expect(outcome.executed).toBe(true);
        expect(outcome.cleanResult).not.toBeNull();
        expect(outcome.poisonedResult).not.toBeNull();
      } else {
        expect(outcome.executed).toBe(true);
        expect(outcome.cleanResult).not.toBeNull();
        expect(outcome.poisonedResult).not.toBeNull();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Per-mutant clean PASS + poisoned FAIL (1v1 context)
// ---------------------------------------------------------------------------

describe("1v1 implementable mutants: clean PASS and poisoned FAIL", () => {
  for (const mutant of IMPLEMENTABLE_MUTANTS) {
    if (mutant.id === "prng-order") {
      continue;
    }

    it(`mutant "${mutant.id}": clean passes oracle in 1v1`, () => {
      const scenario = load1v1Scenario();
      const evalResult = evaluate({
        scenario: scenario as Parameters<typeof evaluate>[0]["scenario"],
      });
      expect(evalResult.observations.length).toBeGreaterThan(0);

      const results = executeOracle(
        mutant.oracleId,
        mutant.oracleVersion,
        evalResult.observations,
      );
      const hasPass = results.some((r) => r.status === "pass");
      expect(
        hasPass,
        `Oracle ${mutant.oracleId} did not pass on clean 1v1 data for mutant ${mutant.id}`,
      ).toBe(true);
    });

    it(`mutant "${mutant.id}": poisoned data triggers oracle FAIL in 1v1`, () => {
      const scenario = load1v1Scenario();
      const evalResult = evaluate({
        scenario: scenario as Parameters<typeof evaluate>[0]["scenario"],
      });
      expect(evalResult.observations.length).toBeGreaterThan(0);

      const base = evalResult.observations[0];
      let corruptedObsList: TelemetryObservation[];

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
      } else {
        corruptedObsList = [base];
      }

      const results = executeOracle(
        mutant.oracleId,
        mutant.oracleVersion,
        corruptedObsList,
      );
      const hasFail = results.some((r) => r.status === "fail");
      expect(
        hasFail,
        `Oracle ${mutant.oracleId} did not detect corruption for mutant ${mutant.id} in 1v1 context`,
      ).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. PRNG-order: genuine divergence detection in 1v1 context
// ---------------------------------------------------------------------------

describe("1v1 PRNG-order mutant: genuine divergence", () => {
  it("mutant run diverges when PRNG state is XORed mid-run", () => {
    const scenario = load1v1Scenario();
    const scenarioObj = scenario as Parameters<typeof evaluate>[0]["scenario"];
    const durationTicks = scenarioObj.durationTicks as number;

    const inputProgram = build1v1InputProgram(durationTicks);

    // Clean run.
    const cleanWorld = createWorld({ scenario: scenarioObj });
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
    const mutantWorld = createWorld({ scenario: scenarioObj });
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

  it("checkPrngOrderMutation detects divergence in 1v1 context", () => {
    const scenario = load1v1Scenario();
    const scenarioObj = scenario as Parameters<typeof evaluate>[0]["scenario"];
    const durationTicks = scenarioObj.durationTicks as number;
    const inputProgram = build1v1InputProgram(durationTicks);

    const result = checkPrngOrderMutation(
      scenarioObj,
      inputProgram,
      durationTicks,
      2,
    );
    expect(result.status).toBe("pass");
  });
});

// ---------------------------------------------------------------------------
// 4. Skipped implementable mutant → INVALID_RUN (prove the path can fail)
// ---------------------------------------------------------------------------

describe("1v1: skipped implementable mutant → INVALID_RUN", () => {
  it("skipping an implementable mutant yields INVALID_RUN, not PASS", () => {
    const result = evaluateMutant1v1({
      skipMutationIds: ["non-finite"],
    });

    expect(result.verdict).not.toBe("PASS");
    expect(result.verdict).toBe("INVALID_RUN");
    expect(result.anyInvalidRun).toBe(true);
    expect(result.allImplementedDetected).toBe(false);

    const skippedOutcome = result.outcomes.find(
      (o) => o.mutationId === "non-finite",
    );
    expect(skippedOutcome).toBeDefined();
    expect(skippedOutcome?.outcome).toBe("INVALID_RUN");
    expect(skippedOutcome?.executed).toBe(false);
  });

  it("skipping multiple mutants still yields INVALID_RUN", () => {
    const result = evaluateMutant1v1({
      skipMutationIds: ["non-finite", "ball-teleport"],
    });

    expect(result.verdict).toBe("INVALID_RUN");
    expect(result.anyInvalidRun).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Deferred mutants: NOT_EVALUATED in 1v1 context
// ---------------------------------------------------------------------------

describe("1v1: deferred mutants stay NOT_EVALUATED", () => {
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

  it("deferred-mutants oracle returns not_evaluated", () => {
    const results = executeOracle(
      "deferred-mutants",
      "oracle-deferred-mutants-v1",
      [],
    );
    const notEvaluated = results.find((r) => r.status === "not_evaluated");
    expect(notEvaluated).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Registry integrity
// ---------------------------------------------------------------------------

describe("1v1: registry integrity", () => {
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
      // For some oracles (like prng-order) this returns not_evaluated.
      expect(() =>
        executeOracle(m.oracleId, m.oracleVersion, []),
      ).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// 7. evaluatePlayable1v1: exit prerequisites are wired correctly
// ---------------------------------------------------------------------------

describe("evaluatePlayable1v1: exit prerequisites wired correctly", () => {
  it("MUTANT_1V1_PASS is executable (not hard-coded NOT_EVALUATED)", () => {
    const scenario = load1v1Scenario();
    const result = evaluatePlayable1v1(
      scenario as Parameters<typeof evaluate>[0]["scenario"],
    );

    const mutant1v1Prereq = result.subComponents.find(
      (s) => s.componentId === "EXIT_PREREQ:MUTANT_1V1_PASS",
    );
    expect(mutant1v1Prereq).toBeDefined();
    // The outcome should be the actual verdict from the mutant evaluation,
    // not "NOT_EVALUATED" (which would indicate a static placeholder).
    expect(mutant1v1Prereq!.outcome).not.toBe("NOT_EVALUATED");
    // Evidence should reference the MUTANT_1V1 reduction.
    const hasMutantEvidence = mutant1v1Prereq!.evidence.some((e) =>
      e.includes("MUTANT_1V1"),
    );
    expect(hasMutantEvidence).toBe(true);
  });

  it("ARCHETYPE_BLINDED_COMPARISON_PASS stays NOT_EVALUATED", () => {
    const scenario = load1v1Scenario();
    const result = evaluatePlayable1v1(
      scenario as Parameters<typeof evaluate>[0]["scenario"],
    );

    const archetypePrereq = result.subComponents.find(
      (s) => s.componentId === "EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS",
    );
    expect(archetypePrereq).toBeDefined();
    expect(archetypePrereq!.outcome).toBe("NOT_EVALUATED");
    // Evidence should mention the perceptual rubric requirement.
    const hasRubricEvidence = archetypePrereq!.evidence.some((e) =>
      e.toLowerCase().includes("perceptual") ||
      e.toLowerCase().includes("rubric"),
    );
    expect(hasRubricEvidence).toBe(true);
  });

  it("overall verdict is never PASS due to ARCHETYPE_BLINDED_COMPARISON_PASS", () => {
    const scenario = load1v1Scenario();
    const result = evaluatePlayable1v1(
      scenario as Parameters<typeof evaluate>[0]["scenario"],
    );

    expect(result.milestoneVerdict).not.toBe("PASS");
  });

  it("exitPrerequisitesSatisfied is false when MUTANT_1V1 is not all PASS", () => {
    const scenario = load1v1Scenario();
    const result = evaluatePlayable1v1(
      scenario as Parameters<typeof evaluate>[0]["scenario"],
    );

    // Even if MUTANT_1V1 passes, ARCHETYPE_BLINDED_COMPARISON_PASS is NOT_EVALUATED,
    // so exitPrerequisitesSatisfied should be false.
    expect(result.exitPrerequisitesSatisfied).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. No PLAYABLE_1V1_PASS naming
// ---------------------------------------------------------------------------

describe("No PLAYABLE_1V1_PASS naming", () => {
  it("the mutant-1v1 module does not export PLAYABLE_1V1_PASS", async () => {
    const moduleExports = Object.keys(
      await import("../../../eval/runners/mutant-1v1.js"),
    );
    expect(moduleExports).not.toContain("PLAYABLE_1V1_PASS");
  });

  it("the mutant-1v1 module exports evaluateMutant1v1", async () => {
    const moduleExports = Object.keys(
      await import("../../../eval/runners/mutant-1v1.js"),
    );
    expect(moduleExports).toContain("evaluateMutant1v1");
  });
});

// ---------------------------------------------------------------------------
// 9. No PES claims
// ---------------------------------------------------------------------------

describe("No PES claims in 1v1 mutant results", () => {
  it("evaluateMutant1v1 does not claim PES fidelity", () => {
    const result = evaluateMutant1v1();

    const pesTerms = [
      "PES fidelity",
      "PES match",
      "PES 2017",
      "FOUNDATION_LAB_PASS",
      "PLAYABLE_1V1_PASS",
    ];

    for (const outcome of result.outcomes) {
      if (outcome.mutationId === "deferred-summary") continue;
      for (const evidence of [
        outcome.cleanResult?.description ?? "",
        outcome.poisonedResult?.description ?? "",
      ]) {
        for (const term of pesTerms) {
          expect(
            evidence.toLowerCase().includes(term.toLowerCase()),
            `Evidence should not contain "${term}": ${evidence}`,
          ).toBe(false);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Determinism: two identical 1v1 runs produce same verdict
// ---------------------------------------------------------------------------

describe("1v1 mutant evaluation is deterministic", () => {
  it("two identical evaluateMutant1v1 calls produce the same verdict", () => {
    const resultA = evaluateMutant1v1();
    const resultB = evaluateMutant1v1();

    expect(resultA.verdict).toBe(resultB.verdict);
    expect(resultA.implementableCount).toBe(resultB.implementableCount);

    for (let i = 0; i < resultA.outcomes.length; i++) {
      expect(resultA.outcomes[i].outcome).toBe(resultB.outcomes[i].outcome);
    }
  });
});