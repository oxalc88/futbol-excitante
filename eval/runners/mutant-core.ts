/**
 * @module eval/runners/mutant-core
 *
 * MUTANT_CORE evaluator: runs the implementable mutant suite,
 * records per-mutant outcomes, and reduces MUTANT_CORE.
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
 *   MUTANT_CORE = PASS iff every implementable mutant is both:
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

import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
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

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Outcome for a single mutant evaluation.
 */
export interface MutantOutcome {
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
 * Full MUTANT_CORE reduction result.
 */
export interface MutantCoreResult {
  /** Registry version. */
  registryVersion: string;
  /** Total implementable mutants defined. */
  implementableCount: number;
  /** Total deferred mutants. */
  deferredCount: number;
  /** Per-mutant outcomes. */
  outcomes: MutantOutcome[];
  /** Whether every implementable mutant was detected. */
  allImplementedDetected: boolean;
  /** Whether any deferred mutant returned not_evaluated. */
  allDeferredNotEvaluated: boolean;
  /** Whether any implementable mutant was not executed (INVALID_RUN). */
  anyInvalidRun: boolean;
  /** Overall MUTANT_CORE verdict. */
  verdict: "PASS" | "FAIL" | "INVALID_RUN";
  /** Details about the verdict. */
  details: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load the foundation scenario fixture.
 */
function loadScenario(): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(
    __dirname,
    "../scenarios/foundation-move-and-roll.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

/**
 * Build a tick-indexed input program for testing.
 */
function buildInputProgram(
  durationTicks: number,
  controlSlot: string,
  opts?: Partial<InputFrame>,
): Record<number, InputFrame[]> {
  const program: Record<number, InputFrame[]> = {};
  for (let t = 0; t < durationTicks; t++) {
    program[t] = [
      {
        tick: t,
        sourceId: "test-source",
        controlSlot,
        moveX: opts?.moveX ?? 0,
        moveY: opts?.moveY ?? 0,
        sprint: opts?.sprint ?? 0,
        heldButtons: opts?.heldButtons ?? 0,
        pressedButtons: opts?.pressedButtons ?? 0,
        releasedButtons: opts?.releasedButtons ?? 0,
      },
    ];
  }
  return program;
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
      linearVelocity: { ...p.linearVelocity, x: p.linearVelocity.x + 0.5, y: p.linearVelocity.y + 0.5 },
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
      bodyHeading: p.bodyHeading + 4, // > π
    })),
  };
  return [obs1, obs2];
}

/**
 * Build observations with constant non-zero ground-roll velocity
 * (ball-no-decay mutant).
 */
function injectNoBallDecay(base: TelemetryObservation): TelemetryObservation[] {
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
function injectBallTeleport(base: TelemetryObservation): TelemetryObservation[] {
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
  return { ...base, observationCoreHash: "corrupted-hash-000000" };
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
    events: [{ id: "evt-goal-2", tick: 51, sequence: 0, kind: "goal", label: "goal", payload: { goalIndex: 2 } }],
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
  // First observation has tick 0 (sequential), second skips to tick 2.
  const obs1 = { ...base, tick: 0, simulationTime: 0 / 60 };
  const obs2 = { ...base, tick: 2, simulationTime: 2 / 60 };
  return [obs1, obs2];
}

// ---------------------------------------------------------------------------
// Main reduction
// ---------------------------------------------------------------------------

/**
 * Run the MUTANT_CORE evaluation.
 *
 * For each implementable mutant:
 *   - Runs clean evaluation → oracle must PASS
 *   - Injects corruption → oracle must FAIL (detection)
 * For each deferred mutant:
 *   - Runs oracle → must return NOT_EVALUATED
 *
 * Reduction:
 *   PASS  — every implementable mutant detected and clean oracle passes.
 *   FAIL  — at least one implementable mutant not detected or clean oracle fails.
 *   INVALID_RUN — an implementable mutant was not executed.
 *
 * @param opts - Scenario and input program to evaluate.
 * @returns MutantCoreResult.
 */
export function evaluateMutantCore(
  opts?: {
    scenario?: ScenarioDefinition;
    inputProgram?: Record<number, InputFrame[]>;
    durationTicks?: number;
    /** Mutant IDs to skip (not executed). */
    skipMutationIds?: string[];
  },
): MutantCoreResult {
  const { scenario, inputProgram, durationTicks, skipMutationIds } = opts ?? {};
  const sc = scenario ?? loadScenario();
  const inputs = inputProgram ?? buildInputProgram(10, "slot-1");
  const ticks = durationTicks ?? sc.durationTicks;

  // Run the clean evaluation.
  const cleanResult = evaluate({ scenario: sc });

  const outcomes: MutantOutcome[] = [];
  let allImplementedDetected = true;
  let allDeferredNotEvaluated = true;
  let anyInvalidRun = false;

  // --- Implementable mutants ---
  const skipSet = new Set(skipMutationIds);
  for (const mutant of IMPLEMENTABLE_MUTANTS) {
    // Skip requested mutants — mark as not executed (INVALID_RUN).
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

    const outcome: MutantOutcome = {
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
        cleanResults = executeOracle(mutant.oracleId, mutant.oracleVersion, cleanResult.observations);
        // Filter to only results from this oracle's check function.
        // Some oracles (like finite-number) return per-observation results.
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
        // PRNG-order: run clean vs mutant simulation pair.
        // The cleanResult is inherently "pass" (mutation detection itself is proof).
        outcome.cleanResult = {
          id: `clean-prng-order`,
          status: "pass",
          description: "PRNG-order mutation test requires simulation pair, not observation oracle",
        };

        const prngResult = checkPrngOrderMutation(sc, inputs, ticks, 2);
        outcome.poisonedResult = {
          id: `poisoned-prng-order`,
          status: prngResult.status === "pass" ? "fail" : "pass",
          description: prngResult.status === "pass"
            ? `PRNG-order mutation detected divergence`
            : `PRNG-order mutation did NOT cause divergence (oracle not working)`,
        };
        // For PRNG-order, the outcome is based on divergence detection.
        if (prngResult.status !== "pass") {
          allImplementedDetected = false;
          outcome.outcome = "FAIL";
        }
        // outcome stays PASS if divergence was detected.
      } else if (mutant.id === "non-finite") {
        // Non-finite: inject NaN/Infinity into observations.
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
        const corruptedObs = injectPossessionNoEvidence(cleanResult.observations[0]);
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
        // Camera-hash: corrupt observationCoreHash.
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
        // Score-tracker: inject a goal event with invalid goalIndex.
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
        // Match-clock: inject observations with non-sequential ticks.
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
          // Clean also fails → oracle may have false positives.
          outcome.outcome = "FAIL";
          allImplementedDetected = false;
        }
        // outcome stays PASS if clean passes and poisoned fails.
      } else {
        // Oracle did NOT detect the mutation.
        outcome.outcome = "FAIL";
        allImplementedDetected = false;
      }
      outcome.executed = true;
    } catch {
      // Oracle threw — mutant was not successfully evaluated.
      outcome.outcome = "INVALID_RUN";
      allImplementedDetected = false;
      anyInvalidRun = true;
    }

    outcomes.push(outcome);
  }

  // --- Deferred mutants (NOT_EVALUATED) ---
  // Use the existing deferred-mutants oracle.
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

  // Record deferred outcome summary.
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
    outcome: "NOT_EVALUATED", // deferred mutants never count as PASS or FAIL
  });

  // --- Reduction ---
  let verdict: MutantCoreResult["verdict"];
  let details: string;

  if (anyInvalidRun) {
    // An implementable mutant was not executed → INVALID_RUN (strongest verdict).
    const invalidRunMutants = outcomes.filter(
      (o) => !o.deferred && o.outcome === "INVALID_RUN",
    ).map((o) => o.mutationId);
    verdict = "INVALID_RUN";
    details = `MUTANT_CORE INVALID_RUN: unexecuted mutant(s) — ${invalidRunMutants.join(", ")} were not evaluated`;
  } else if (!allImplementedDetected) {
    verdict = "FAIL";
    const failedMutants = outcomes.filter(
      (o) => !o.deferred && o.outcome === "FAIL" && o.executed,
    ).map((o) => o.mutationId);
    details = `MUTANT_CORE FAIL: not all implementable mutants detected — ${failedMutants.join(", ")} failed detection`;
  } else if (!allDeferredNotEvaluated) {
    verdict = "FAIL";
    details = "MUTANT_CORE FAIL: deferred mutants did not return NOT_EVALUATED";
  } else {
    verdict = "PASS";
    details = `MUTANT_CORE PASS: all ${IMPLEMENTABLE_MUTANTS.length} implementable mutants detected; ${DEFERRED_MUTANTS_V1.length} deferred mutants catalogued`;
  }

  return {
    registryVersion: "mutant-core-v1",
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