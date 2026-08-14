/**
 * @module eval/runners/compare
 *
 * Compares two evaluation runs: checks condition hash match, reports
 * metric deltas, and finds earliest state-hash divergence.
 *
 * Without a versioned regression policy, reports DELTA_ONLY — never PASS.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { ComparisonResult } from "../../src/contracts/telemetry.js";
import type { EvaluationResult } from "./evaluate.js";

import { hashFnv1a64 } from "../../src/simulation/determinism/hash.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare two evaluation runs.
 *
 * Requirements:
 * - Both runs must have the same comparison-condition hash (derived from
 *   scenario id, version, seed, config version, and duration).
 * - If conditions match, reports metric deltas and earliest state-hash
 *   difference.
 * - Without a regression policy, always reports DELTA_ONLY.
 *
 * @param baseline - The baseline evaluation result.
 * @param candidate - The candidate evaluation result.
 * @returns ComparisonResult.
 */
export function compareRuns(
  baseline: EvaluationResult,
  candidate: EvaluationResult,
): ComparisonResult {
  // Compute comparison-condition hash from scenario + config + duration.
  const baselineCondition = computeConditionHash(baseline);
  const candidateCondition = computeConditionHash(candidate);

  const conditionHashMatch = baselineCondition === candidateCondition;

  if (!conditionHashMatch) {
    return {
      status: "mismatch",
      conditionHashMatch: false,
    };
  }

  // Find earliest state-hash divergence.
  let earliestDivergenceTick: number | undefined = undefined;
  let earliestDivergenceExpected: string | undefined = undefined;
  let earliestDivergenceActual: string | undefined = undefined;

  for (const [tickStr, hash] of candidate.hashes) {
    const tick = Number(tickStr);
    const expected = baseline.hashes.get(tick);
    if (expected !== undefined && expected !== hash) {
      if (earliestDivergenceTick === undefined) {
        earliestDivergenceTick = tick;
        earliestDivergenceExpected = expected;
        earliestDivergenceActual = hash;
      }
    }
  }

  // Compute metric deltas.
  const metricDeltas: ComparisonResult["metricDeltas"] = {};
  for (const key of Object.keys(baseline.metrics)) {
    const baseVal = baseline.metrics[key];
    const candVal = candidate.metrics[key];
    if (!deepEqual(baseVal, candVal)) {
      metricDeltas[key] = { expected: baseVal, actual: candVal };
    }
  }

  // Without a regression policy, always report DELTA_ONLY.
  return {
    status: "delta_only",
    earliestDivergenceTick,
    earliestDivergenceExpected,
    earliestDivergenceActual,
    metricDeltas,
    conditionHashMatch: true,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute a comparison-condition hash from scenario + config + duration.
 * This hash must be identical for runs that are meant to be compared.
 */
function computeConditionHash(result: EvaluationResult): string {
  const condition = {
    scenarioId: result.scenarioId,
    scenarioVersion: result.scenarioVersion,
    configVersion: result.scenarioConfigVersion,
    durationTicks: result.totalTicks,
    seed: result.seed,
  };
  return hashFnv1a64(JSON.stringify(condition));
}

/**
 * Simple deep equality check for JSON-serializable values.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}