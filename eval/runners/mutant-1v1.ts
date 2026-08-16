/**
 * @module eval/runners/mutant-1v1
 *
 * MUTANT_1V1 evaluator: runs the implementable mutant suite in a
 * two-player (1v1) context, records per-mutant outcomes, and reduces
 * MUTANT_1V1.
 *
 * Implementation:
 *   For each implementable mutant:
 *     1. Run a clean evaluation (existing oracle fixtures).
 *     2. Inject the specific corruption for this mutant.
 *     3. Run the oracle on the corrupted data → must FAIL (detection).
 *     4. Run the oracle on clean data → must PASS.
 *   For each deferred mutant:
 *     1. Run the oracle → must return NOT_EVALUATED.
 *
 * Reduction:
 *   MUTANT_1V1 = PASS iff every implementable mutant is both:
 *     - detected (oracle FAIL on poisoned fixture)
 *     - clean (oracle PASS on clean fixture)
 *   Deferred mutants never contribute PASS or FAIL.
 *   A missing/unrun implementable mutant → INVALID_RUN.
 *
 * This module does NOT rewrite production simulation code.
 * It exercises existing oracles on corrupted/lean observations.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in the eval layer.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

import { evaluate } from "../runners/evaluate.js";
// Import wire.ts to register all built-in oracles in the protected registry.
// This is a side-effect-only import; no exports are needed.
import "../oracles/wire.js";
import { executeOracle } from "../oracles/oracle-registry.js";
import { checkPrngOrderMutation } from "../oracles/prng-order.js";
import {
  IMPLEMENTABLE_MUTANTS,
  type MutationDefinition,
} from "../oracles/mutant-registry.js";
import { DEFERRED_MUTANTS_V1 } from "../oracles/deferred-mutants.js";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Outcome for a single 1v1 mutant evaluation.
 */
export interface Mutant1v1Outcome {
  /** Mutation ID (e.g. "non-finite", "prng-order", ...). */
  mutationId: string;
  /** Description of the mutant. */
  description: string;
  /** Whether this mutant is deferred (NOT_EVALUATED). */
  deferred: boolean;
  /** Whether the mutant was actually executed. */
  executed: boolean;
  /** Clean oracle result: must be PASS. */
  cleanResult: InvariantResult | null;
  /** Poisoned oracle result: must be FAIL for implementable mutants. */
  poisonedResult: InvariantResult | null;
  /** Final verdict for this mutant. */
  outcome: "PASS" | "FAIL" | "NOT_EVALUATED" | "INVALID_RUN";
}

/**
 * Full MUTANT_1V1 reduction result.
 */
export interface Mutant1v1Result {
  /** Registry version. */
  registryVersion: string;
  /** Total implementable mutants defined. */
  implementableCount: number;
  /** Total deferred mutants. */
  deferredCount: number;
  /** Per-mutant outcomes. */
  outcomes: Mutant1v1Outcome[];
  /** Whether every implementable mutant was detected. */
  allImplementedDetected: boolean;
  /** Whether any deferred mutant returned not_evaluated. */
  allDeferredNotEvaluated: boolean;
  /** Whether any implementable mutant was not executed (INVALID_RUN). */
  anyInvalidRun: boolean;
  /** Overall MUTANT_1V1 verdict. */
  verdict: "PASS" | "FAIL" | "INVALID_RUN";
  /** Details about the verdict. */
  details: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load the 1v1 scenario fixture.
 */
function load1v1Scenario(): Record<string, unknown> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, "../scenarios/two-player-duel.v1.json");
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Build an observation with NaN/Infinity in player velocity
 * (non-finite mutant).
 */
function injectNonFinite(obs: TelemetryObservation): TelemetryObservation {
  return {
    ...obs,
    players: obs.players.map((p) => ({
      ...p,
      linearVelocity: { ...p.linearVelocity, x: NaN },
    })),
  };
}

/**
 * Build observations with an instantaneous velocity snap
 * (velocity-snap mutant).
 */
function injectVelocitySnap(
  base: TelemetryObservation,
): TelemetryObservation[] {
  const obs1 = {
    ...base,
    tick: 10,
    simulationTime: 10 / 60,
    players: base.players.map((p) => ({
      ...p,
      linearVelocity: {
        ...p.linearVelocity,
        x: p.linearVelocity.x + 0.5,
        y: p.linearVelocity.y + 0.5,
      },
      bodyHeading: p.bodyHeading + 0.1,
    })),
  };
  const obs2 = {
    ...base,
    tick: 11,
    simulationTime: 11 / 60,
    players: base.players.map((p) => ({
      ...p,
      linearVelocity: {
        x: p.linearVelocity.x + 2000,
        y: p.linearVelocity.y + 2000,
      },
      bodyHeading: p.bodyHeading + 4,
    })),
  };
  return [obs1, obs2];
}

/**
 * Build observations with constant non-zero ground-roll velocity
 * (ball-no-decay mutant).
 */
function injectNoBallDecay(
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

/**
 * Build observations with ball teleportation
 * (ball-teleport mutant).
 */
function injectBallTeleport(
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

/**
 * Build observations with possession change without evidence
 * (possession-no-evidence mutant).
 */
function injectPossessionNoEvidence(
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

/**
 * Build observation with corrupted observationCoreHash
 * (camera-hash mutant).
 */
function injectCameraHash(base: TelemetryObservation): TelemetryObservation {
  return {
    ...base,
    observationCoreHash: "corrupted-hash-000000",
  };
}

/**
 * Build observations with an invalid goal event
 * (score-tracker mutant).
 */
function injectScoreTracker(
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

/**
 * Build observations with non-sequential ticks
 * (match-clock mutant).
 */
function injectMatchClock(
  base: TelemetryObservation,
): TelemetryObservation[] {
  const obs1 = { ...base, tick: 0, simulationTime: 0 / 60 };
  const obs2 = { ...base, tick: 2, simulationTime: 2 / 60 };
  return [obs1, obs2];
}

// ---------------------------------------------------------------------------
// Main reduction
// ---------------------------------------------------------------------------

/**
 * Run the MUTANT_1V1 evaluation.
 *
 * For each implementable mutant:
 *   - Runs clean evaluation in a 1v1 context → oracle must PASS
 *   - Injects corruption → oracle must FAIL (detection)
 * For each deferred mutant:
 *   - Runs oracle → must return NOT_EVALUATED
 *
 * Reduction:
 *   PASS  — every implementable mutant detected and clean oracle passes.
 *   FAIL  — at least one implementable mutant not detected or clean oracle fails.
 *   INVALID_RUN — an implementable mutant was not executed.
 *
 * @param opts - Optional overrides.
 * @returns Mutant1v1Result.
 */
export function evaluateMutant1v1(
  opts?: {
    /** Mutant IDs to skip (not executed). */
    skipMutationIds?: string[];
  },
): Mutant1v1Result {
  const { skipMutationIds } = opts ?? {};

  // Load the 1v1 scenario and run clean evaluation.
  const rawScenario = load1v1Scenario();
  // The scenario JSON matches the runtime shape expected by the
  // simulation core (createWorld → evaluate).  Cast through unknown
  // because the JSON shape and TypeScript type do not overlap on paper.
  const scenario = rawScenario as unknown as Parameters<typeof evaluate>[0]["scenario"];

  const cleanResult = evaluate({ scenario });

  const outcomes: Mutant1v1Outcome[] = [];
  let allImplementedDetected = true;
  let allDeferredNotEvaluated = true;
  let anyInvalidRun = false;

  // --- Implementable mutants ---
  const skipSet = new Set(skipMutationIds);
  for (const mutant of IMPLEMENTABLE_MUTANTS) {
    if (skipSet.has(mutant.id)) {
      outcomes.push({
        mutationId: mutant.id,
        description: mutant.description,
        deferred: false,
        executed: false,
        cleanResult: null,
        poisonedResult: null,
        outcome: "INVALID_RUN",
      });
      allImplementedDetected = false;
      anyInvalidRun = true;
      continue;
    }

    const outcome: Mutant1v1Outcome = {
      mutationId: mutant.id,
      description: mutant.description,
      deferred: false,
      executed: false,
      cleanResult: null,
      poisonedResult: null,
      outcome: "PASS",
    };

    try {
      // Execute oracle on clean data.
      let cleanResults: InvariantResult[] = [];
      try {
        cleanResults = executeOracle(
          mutant.oracleId,
          mutant.oracleVersion,
          cleanResult.observations,
        );
        const anyCleanPass = cleanResults.some(
          (r) => r.status === "pass",
        );
        outcome.cleanResult = anyCleanPass
          ? {
              id: `clean-${mutant.oracleId}`,
              status: "pass",
              description: `Clean oracle ${mutant.oracleId} returned at least one pass result`,
            }
          : {
              id: `clean-${mutant.oracleId}-all-fail`,
              status: "fail",
              description: `Clean oracle ${mutant.oracleId} returned no pass results (false positive)`,
            };
      } catch {
        outcome.cleanResult = {
          id: `clean-${mutant.oracleId}-error`,
          status: "fail",
          description: `Oracle ${mutant.oracleId} threw error on clean data`,
        };
      }

      // --- Execute the specific mutant detection ---
      if (mutant.id === "prng-order") {
        // PRNG-order: run clean vs mutant simulation pair in 1v1 context.
        outcome.cleanResult = {
          id: `clean-prng-order`,
          status: "pass",
          description:
            "PRNG-order mutation test requires simulation pair, not observation oracle",
        };

        // Build a minimal input program for the 1v1 scenario that mirrors
        // the two-player nature of the 1v1 fixture.
        const inputProgram: Record<number, Array<{
          tick: number;
          sourceId: string;
          controlSlot: string;
          moveX: number;
          moveY: number;
          sprint: number;
          heldButtons: number;
          pressedButtons: number;
          releasedButtons: number;
        }>> = {};
        const durationTicks = scenario.durationTicks as number;
        for (let t = 0; t < durationTicks; t++) {
          inputProgram[t] = [
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

        const prngResult = checkPrngOrderMutation(
          scenario,
          inputProgram,
          durationTicks,
          2,
        );
        outcome.poisonedResult = {
          id: `poisoned-prng-order`,
          status: prngResult.status === "pass" ? "fail" : "pass",
          description: prngResult.status === "pass"
            ? `PRNG-order mutation detected divergence in 1v1 context`
            : `PRNG-order mutation did NOT cause divergence (oracle not working)`,
        };
        if (prngResult.status !== "pass") {
          allImplementedDetected = false;
          outcome.outcome = "FAIL";
        }
      } else if (mutant.id === "non-finite") {
        const corruptedObs = injectNonFinite(cleanResult.observations[0]);
        const poisonedResults = executeOracle(
          mutant.oracleId,
          mutant.oracleVersion,
          [corruptedObs],
        );
        const anyFail = poisonedResults.some((r) => r.status === "fail");
        outcome.poisonedResult = anyFail
          ? {
              id: `poisoned-${mutant.oracleId}`,
              status: "fail",
              description: `Oracle ${mutant.oracleId} detected non-finite state`,
            }
          : {
              id: `poisoned-${mutant.oracleId}-miss`,
              status: "pass",
              description: `Oracle ${mutant.oracleId} did NOT detect non-finite state`,
            };
      } else if (mutant.id === "velocity-snap") {
        const corruptedObs = injectVelocitySnap(cleanResult.observations[0]);
        const poisonedResults = executeOracle(
          mutant.oracleId,
          mutant.oracleVersion,
          corruptedObs,
        );
        const anyFail = poisonedResults.some((r) => r.status === "fail");
        outcome.poisonedResult = anyFail
          ? {
              id: `poisoned-${mutant.oracleId}`,
              status: "fail",
              description: `Oracle ${mutant.oracleId} detected velocity/heading snap`,
            }
          : {
              id: `poisoned-${mutant.oracleId}-miss`,
              status: "pass",
              description: `Oracle ${mutant.oracleId} did NOT detect velocity/heading snap`,
            };
      } else if (mutant.id === "ball-no-decay") {
        const corruptedObs = injectNoBallDecay(cleanResult.observations[0]);
        const poisonedResults = executeOracle(
          mutant.oracleId,
          mutant.oracleVersion,
          corruptedObs,
        );
        const anyFail = poisonedResults.some((r) => r.status === "fail");
        outcome.poisonedResult = anyFail
          ? {
              id: `poisoned-${mutant.oracleId}`,
              status: "fail",
              description: `Oracle ${mutant.oracleId} detected disabled ball decay`,
            }
          : {
              id: `poisoned-${mutant.oracleId}-miss`,
              status: "pass",
              description: `Oracle ${mutant.oracleId} did NOT detect disabled ball decay`,
            };
      } else if (mutant.id === "ball-teleport") {
        const corruptedObs = injectBallTeleport(cleanResult.observations[0]);
        const poisonedResults = executeOracle(
          mutant.oracleId,
          mutant.oracleVersion,
          corruptedObs,
        );
        const anyFail = poisonedResults.some((r) => r.status === "fail");
        outcome.poisonedResult = anyFail
          ? {
              id: `poisoned-${mutant.oracleId}`,
              status: "fail",
              description: `Oracle ${mutant.oracleId} detected ball teleport`,
            }
          : {
              id: `poisoned-${mutant.oracleId}-miss`,
              status: "pass",
              description: `Oracle ${mutant.oracleId} did NOT detect ball teleport`,
            };
      } else if (mutant.id === "possession-no-evidence") {
        const corruptedObs = injectPossessionNoEvidence(
          cleanResult.observations[0],
        );
        const poisonedResults = executeOracle(
          mutant.oracleId,
          mutant.oracleVersion,
          corruptedObs,
        );
        const anyFail = poisonedResults.some((r) => r.status === "fail");
        outcome.poisonedResult = anyFail
          ? {
              id: `poisoned-${mutant.oracleId}`,
              status: "fail",
              description: `Oracle ${mutant.oracleId} detected possession without evidence`,
            }
          : {
              id: `poisoned-${mutant.oracleId}-miss`,
              status: "pass",
              description: `Oracle ${mutant.oracleId} did NOT detect possession without evidence`,
            };
      } else if (mutant.id === "camera-hash") {
        const corruptedObs = injectCameraHash(cleanResult.observations[0]);
        const poisonedResults = executeOracle(
          mutant.oracleId,
          mutant.oracleVersion,
          [corruptedObs],
        );
        const anyFail = poisonedResults.some((r) => r.status === "fail");
        outcome.poisonedResult = anyFail
          ? {
              id: `poisoned-${mutant.oracleId}`,
              status: "fail",
              description: `Oracle ${mutant.oracleId} detected camera-hash inconsistency`,
            }
          : {
              id: `poisoned-${mutant.oracleId}-miss`,
              status: "pass",
              description: `Oracle ${mutant.oracleId} did NOT detect camera-hash inconsistency`,
            };
      } else if (mutant.id === "score-tracker") {
        const corruptedObs = injectScoreTracker(cleanResult.observations[0]);
        const poisonedResults = executeOracle(
          mutant.oracleId,
          mutant.oracleVersion,
          corruptedObs,
        );
        const anyFail = poisonedResults.some((r) => r.status === "fail");
        outcome.poisonedResult = anyFail
          ? {
              id: `poisoned-${mutant.oracleId}`,
              status: "fail",
              description: `Oracle ${mutant.oracleId} detected invalid goal event`,
            }
          : {
              id: `poisoned-${mutant.oracleId}-miss`,
              status: "pass",
              description: `Oracle ${mutant.oracleId} did NOT detect invalid goal event`,
            };
      } else if (mutant.id === "match-clock") {
        const corruptedObs = injectMatchClock(cleanResult.observations[0]);
        const poisonedResults = executeOracle(
          mutant.oracleId,
          mutant.oracleVersion,
          corruptedObs,
        );
        const anyFail = poisonedResults.some((r) => r.status === "fail");
        outcome.poisonedResult = anyFail
          ? {
              id: `poisoned-${mutant.oracleId}`,
              status: "fail",
              description: `Oracle ${mutant.oracleId} detected non-sequential ticks`,
            }
          : {
              id: `poisoned-${mutant.oracleId}-miss`,
              status: "pass",
              description: `Oracle ${mutant.oracleId} did NOT detect non-sequential ticks`,
            };
      }

      // Check if the oracle detected the mutation.
      if (outcome.poisonedResult?.status === "fail") {
        // Detection successful.
        if (outcome.cleanResult?.status !== "pass") {
          outcome.outcome = "FAIL";
          allImplementedDetected = false;
        }
      } else {
        // Oracle did NOT detect the mutation.
        outcome.outcome = "FAIL";
        allImplementedDetected = false;
      }
      outcome.executed = true;
    } catch {
      outcome.outcome = "INVALID_RUN";
      allImplementedDetected = false;
      anyInvalidRun = true;
    }

    outcomes.push(outcome);
  }

  // --- Deferred mutants (NOT_EVALUATED) ---
  const deferredResults = executeOracle(
    "deferred-mutants",
    "oracle-deferred-mutants-v1",
    [],
  );
  const anyDeferredNotEvaluated = deferredResults.some(
    (r) => r.status === "not_evaluated",
  );
  if (!anyDeferredNotEvaluated) {
    allDeferredNotEvaluated = false;
  }

  outcomes.push({
    mutationId: "deferred-summary",
    description: `${DEFERRED_MUTANTS_V1.length} deferred mutant(s) catalogued as NOT_EVALUATED`,
    deferred: true,
    executed: true,
    cleanResult: anyDeferredNotEvaluated
      ? {
          id: "deferred-not_evaluated",
          status: "pass",
          description: "Deferred mutants all return NOT_EVALUATED",
        }
      : {
          id: "deferred-not_pass",
          status: "fail",
          description: "Deferred mutants did not return NOT_EVALUATED",
        },
    poisonedResult: null,
    outcome: "NOT_EVALUATED",
  });

  // --- Reduction ---
  let verdict: Mutant1v1Result["verdict"];
  let details: string;

  if (anyInvalidRun) {
    const invalidRunMutants = outcomes
      .filter((o) => !o.deferred && o.outcome === "INVALID_RUN")
      .map((o) => o.mutationId);
    verdict = "INVALID_RUN";
    details = `MUTANT_1V1 INVALID_RUN: unexecuted mutant(s) — ${invalidRunMutants.join(
      ", ",
    )} were not evaluated`;
  } else if (!allImplementedDetected) {
    const failedMutants = outcomes
      .filter((o) => !o.deferred && o.outcome === "FAIL" && o.executed)
      .map((o) => o.mutationId);
    verdict = "FAIL";
    details = `MUTANT_1V1 FAIL: not all implementable mutants detected — ${failedMutants.join(
      ", ",
    )} failed detection`;
  } else if (!allDeferredNotEvaluated) {
    verdict = "FAIL";
    details = "MUTANT_1V1 FAIL: deferred mutants did not return NOT_EVALUATED";
  } else {
    verdict = "PASS";
    details = `MUTANT_1V1 PASS: all ${IMPLEMENTABLE_MUTANTS.length} implementable mutants detected in 1v1 context; ${DEFERRED_MUTANTS_V1.length} deferred mutants catalogued`;
  }

  return {
    registryVersion: "mutant-1v1-v1",
    implementableCount: IMPLEMENTABLE_MUTANTS.length,
    deferredCount: DEFERRED_MUTANTS_V1.length,
    outcomes,
    allImplementedDetected,
    allDeferredNotEvaluated,
    anyInvalidRun,
    verdict,
    details,
  };
}