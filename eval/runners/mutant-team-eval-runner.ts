/**
 * @module eval/runners/mutant-team-eval-runner
 *
 * Standalone Node runner that exercises `runMutantTeam` against the
 * 3v3 team scenario and persists the structured result as
 * `docs/evidence/MUTANT_TEAM_PASS/eval.json`.
 *
 * This is the executable evidence producer for the
 * SMALL_SIDED_SHAPE exit prerequisite MUTANT_TEAM_PASS.
 *
 * Node I/O is allowed in the eval layer.
 * No Math.random, Date, DOM, or Node I/O in src/simulation or src/contracts.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runMutantTeam } from "./mutant-team.js";
import type { MutantTeamResult } from "./mutant-team.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Persisted eval.json shape for MUTANT_TEAM_PASS evidence.
 * Mirrors MutantTeamResult with overall and milestoneVerdict at top level.
 */
export interface MutantTeamEvalResult {
  registryVersion: string;
  implementableCount: number;
  deferredCount: number;
  outcomes: Array<{
    mutationId: string;
    description: string;
    deferred: boolean;
    executed: boolean;
    cleanResult: { id: string; status: string; description: string } | null;
    poisonedResult: { id: string; status: string; description: string } | null;
    outcome: "PASS" | "FAIL" | "NOT_EVALUATED" | "INVALID_RUN";
  }>;
  allImplementedDetected: boolean;
  allDeferredNotEvaluated: boolean;
  anyInvalidRun: boolean;
  /** @deprecated – use overall instead. */
  verdict: "PASS" | "FAIL" | "INVALID_RUN";
  /** @deprecated – use details below. */
  details: string;
  /** Overall verdict: mirrors verdict for backward compat. */
  overall: "PASS" | "FAIL" | "NOT_EVALUATED" | "INVALID_RUN";
  /** Milestone verdict – the decision gate for SMALL_SIDED_SHAPE exit. */
  milestoneVerdict: "PASS" | "FAIL" | "NOT_EVALUATED" | "INVALID_RUN";
  /** Human-readable rationale. */
  rationale: string;
  /** Per-mutant outcome entries for downstream audit. */
  perMutant: Array<{
    mutationId: string;
    outcome: "PASS" | "FAIL" | "NOT_EVALUATED" | "INVALID_RUN";
    executed: boolean;
    deferred: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the MUTANT_TEAM evaluation and return the structured result.
 *
 * @param opts - Optional overrides forwarded to runMutantTeam.
 * @returns MutantTeamEvalResult.
 */
export function runMutantTeamEval(
  opts?: { skipMutationIds?: string[] },
): MutantTeamEvalResult {
  const raw = runMutantTeam(opts);

  return {
    registryVersion: raw.registryVersion,
    implementableCount: raw.implementableCount,
    deferredCount: raw.deferredCount,
    outcomes: raw.outcomes as MutantTeamEvalResult["outcomes"],
    allImplementedDetected: raw.allImplementedDetected,
    allDeferredNotEvaluated: raw.allDeferredNotEvaluated,
    anyInvalidRun: raw.anyInvalidRun,
    verdict: raw.verdict,
    details: raw.details,
    overall: raw.verdict,
    milestoneVerdict: raw.verdict,
    rationale: raw.details,
    perMutant: raw.outcomes.map((o) => ({
      mutationId: o.mutationId,
      outcome: o.outcome,
      executed: o.executed,
      deferred: o.deferred,
    })),
  };
}

/**
 * Run the evaluation and persist eval.json.
 *
 * @param outputDir - Directory to write eval.json into.
 * @returns The evaluation result.
 */
export function runAndPersist(
  outputDir: string,
): MutantTeamEvalResult {
  const result = runMutantTeamEval();

  mkdirSync(outputDir, { recursive: true });
  const evalPath = join(outputDir, "eval.json");
  writeFileSync(evalPath, JSON.stringify(result, null, 2), "utf-8");

  console.error(`[mutant-team-runner] overall: ${result.overall}`);
  console.error(`[mutant-team-runner] milestoneVerdict: ${result.milestoneVerdict}`);
  console.error(`[mutant-team-runner] Written eval.json to ${evalPath}`);

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * CLI entry point.
 *
 * Usage:
 *   tsx eval/runners/mutant-team-eval-runner.ts [output-dir]
 */
export function main(): MutantTeamEvalResult {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const outputDir =
    process.argv[2] ??
    join(__dirname, "../../docs/evidence/MUTANT_TEAM_PASS");

  console.error(`[mutant-team-runner] Output dir: ${outputDir}`);

  return runAndPersist(outputDir);
}

// Run if executed directly.
if (process.argv[1]?.endsWith("mutant-team-eval-runner.ts")) {
  const result = main();
  process.exit(result.milestoneVerdict === "PASS" ? 0 : 1);
}