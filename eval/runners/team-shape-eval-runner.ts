/**
 * @module eval/runners/team-shape-eval-runner
 *
 * Standalone Node runner that exercises the team-shape evaluator
 * (`runTeamShapeEvaluator`) against the 3v3 team scenario and
 * persists the structured result as
 * `docs/evidence/TEAM_SHAPE_SUITE_PASS/eval.json`.
 *
 * This is the executable evidence producer for the
 * SMALL_SIDED_SHAPE exit prerequisite TEAM_SHAPE_SUITE_PASS.
 *
 * Node I/O is allowed in the eval layer.
 * No Math.random, Date, DOM, or Node I/O in src/simulation or src/contracts.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runTeamShapeEvaluator } from "./team-shape-evaluator.js";
import type { TeamShapeResult } from "./team-shape-evaluator.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Persisted eval.json shape for TEAM_SHAPE_SUITE_PASS evidence.
 * Mirrors TeamShapeResult with overall and milestoneVerdict at top level.
 */
export interface TeamShapeEvalResult {
  /** Suite identifier. */
  suiteId: string;
  /** Suite version. */
  suiteVersion: string;
  /** Number of tests evaluated. */
  testCount: number;
  /** Per-test outcomes. */
  testResults: Array<{
    test_id: string;
    criteria: Array<{
      criterion_id: string;
      class: string;
      outcome: string;
      evidence: string[];
    }>;
    overall: string;
  }>;
  /** Common criterion check results on the observations. */
  commonCriteriaCheck: Array<{
    criterionId: string;
    oracleResults: Array<{
      status: string;
      description: string;
    }>;
    outcome: string;
    evidence: string[];
  }>;
  /** Whether every test passed. */
  allTestsPass: boolean;
  /** Overall verdict: mirrors verdict for backward compat. */
  overall: string;
  /** Milestone verdict – the decision gate for SMALL_SIDED_SHAPE exit. */
  milestoneVerdict: string;
  /** Verdict. */
  verdict: string;
  /** Human-readable rationale. */
  details: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the TEAM_SHAPE_SUITE evaluation and return the structured result.
 *
 * @returns TeamShapeEvalResult.
 */
export function runTeamShapeEval(): TeamShapeEvalResult {
  const raw = runTeamShapeEvaluator();

  return {
    suiteId: raw.suiteId,
    suiteVersion: raw.suiteVersion,
    testCount: raw.testCount,
    testResults: raw.testResults,
    commonCriteriaCheck: raw.commonCriteriaCheck,
    allTestsPass: raw.allTestsPass,
    overall: raw.verdict,
    milestoneVerdict: raw.verdict,
    verdict: raw.verdict,
    details: raw.details,
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
): TeamShapeEvalResult {
  const result = runTeamShapeEval();

  mkdirSync(outputDir, { recursive: true });
  const evalPath = join(outputDir, "eval.json");
  writeFileSync(evalPath, JSON.stringify(result, null, 2), "utf-8");

  console.error(`[team-shape-runner] overall: ${result.overall}`);
  console.error(`[team-shape-runner] milestoneVerdict: ${result.milestoneVerdict}`);
  console.error(`[team-shape-runner] Written eval.json to ${evalPath}`);

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * CLI entry point.
 *
 * Usage:
 *   tsx eval/runners/team-shape-eval-runner.ts [output-dir]
 */
export function main(): TeamShapeEvalResult {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const outputDir =
    process.argv[2] ??
    join(__dirname, "../../docs/evidence/TEAM_SHAPE_SUITE_PASS");

  console.error(`[team-shape-runner] Output dir: ${outputDir}`);

  return runAndPersist(outputDir);
}

// Run if executed directly.
if (process.argv[1]?.endsWith("team-shape-eval-runner.ts")) {
  const result = main();
  process.exit(result.milestoneVerdict === "PASS" ? 0 : 1);
}