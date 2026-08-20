/**
 * @module eval/runners/team-shape-evaluator
 *
 * TEAM_SHAPE_SUITE evaluation: runs the team suite against a 3v3
 * team scenario, records per-test outcomes, and reduces
 * TEAM_SHAPE_SUITE_PASS.
 *
 * Implementation:
 *   1. Load the 3v3 team scenario fixture.
 *   2. Run the simulation to collect observations.
 *   3. For each test in the TEAM_SUITE direct_test_ids:
 *        a. Check common criteria (FINITE, REFERENCES, BOUNDS)
 *           on the observations.
 *        b. Record per-criterion outcome.
 *   4. Reduce: TEAM_SHAPE_SUITE_PASS = PASS iff all tests PASS.
 *
 * Since test bindings for team criteria do not yet exist, evaluation
 * is based on common criteria that apply universally.  This provides
 * a structural pass/fail for the suite runner while team-specific
 * criteria are deferred.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in the eval layer.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";
import type { CriterionClass, EvaluationOutcome } from "../../src/contracts/types.js";

import { evaluate } from "./evaluate.js";
// Import wire.ts to register all built-in oracles in the protected registry.
// This is a side-effect-only import; no exports are needed.
import "../oracles/wire.js";
import { executeOracle } from "../oracles/oracle-registry.js";
import { TEAM_SUITE } from "../contracts/suites.js";
import {
  COMMON_CRITERIA,
  type EvaluationCriterion,
} from "../contracts/common-criteria.js";
import { checkFiniteNumber } from "../invariants/finite.js";
import { checkEventReferences } from "../invariants/references.js";
import { checkBounds, type SafetyBounds } from "../invariants/bounds.js";
import { checkBallContinuity } from "../invariants/ball-continuity.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A test evaluation result within the team suite.
 */
export interface TeamShapeTestResult {
  /** Test ID from TEAM_SUITE.direct_test_ids. */
  test_id: string;
  /** Criterion evaluation results for this test. */
  criteria: Array<{
    criterion_id: string;
    class: CriterionClass;
    outcome: EvaluationOutcome;
    evidence: string[];
  }>;
  /** Overall test outcome. */
  overall: EvaluationOutcome;
}

/**
 * Common criterion outcomes on observations.
 */
export interface CommonCriterionCheck {
  criterionId: string;
  oracleResults: InvariantResult[];
  outcome: EvaluationOutcome;
  evidence: string[];
}

/** Outcome types for the team-shape evaluator. */
export type TeamShapeOutcome = EvaluationOutcome;

/**
 * Full TEAM_SHAPE_SUITE reduction result.
 */
export interface TeamShapeResult {
  /** Suite identifier. */
  suiteId: string;
  /** Suite version. */
  suiteVersion: string;
  /** Number of tests evaluated. */
  testCount: number;
  /** Per-test outcomes. */
  testResults: TeamShapeTestResult[];
  /** Common criterion check results on the observations. */
  commonCriteriaCheck: CommonCriterionCheck[];
  /** Whether every test passed. */
  allTestsPass: boolean;
  /** Overall TEAM_SHAPE_SUITE_PASS verdict. */
  verdict: TeamShapeOutcome;
  /** Details about the verdict. */
  details: string;
}

// ---------------------------------------------------------------------------
// Evaluation outcome type alias
// ---------------------------------------------------------------------------

// EvaluationOutcome is imported from types.ts above.

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load the 3v3 team scenario fixture.
 */
function loadTeamScenario(): Record<string, unknown> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, "../scenarios/3v3-fixture-short.v1.json");
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Check a common criterion on the observations.
 */
function checkCommonCriterion(
  criterionId: string,
  observations: TelemetryObservation[],
  safetyBounds?: SafetyBounds,
): CommonCriterionCheck {
  let oracleResults: InvariantResult[] = [];
  const evidence: string[] = [];

  if (criterionId === "COMMON-FINITE") {
    for (const obs of observations) {
      const result = checkFiniteNumber(obs);
      oracleResults.push(result);
      evidence.push(result.description);
    }
  } else if (criterionId === "COMMON-REFERENCES") {
    for (const obs of observations) {
      const result = checkEventReferences(obs);
      oracleResults.push(result);
      evidence.push(result.description);
    }
  } else if (criterionId === "COMMON-BOUNDS") {
    for (const obs of observations) {
      const boundsResult = checkBounds(obs, safetyBounds ?? {
        maxX: 52.5,
        maxY: 34,
        minZ: -0.5,
        maxZ: 20,
      });
      oracleResults.push(boundsResult);
      evidence.push(boundsResult.description);
    }
  }

  // Check ball-continuity for this criterion context.
  const ballContinuityResults = checkBallContinuity(observations, {
    fixedDt: 1 / 60,
  });
  for (const bc of ballContinuityResults) {
    oracleResults.push(bc);
    evidence.push(bc.description);
  }

  const outcome = computeCriterionOutcome(oracleResults);

  return {
    criterionId,
    oracleResults,
    outcome,
    evidence,
  };
}

/**
 * Compute outcome for a criterion based on its class and oracle results.
 */
function computeCriterionOutcome(
  oracleResults: InvariantResult[],
): EvaluationOutcome {
  const anyFail = oracleResults.some((r) => r.status === "fail");
  if (anyFail) {
    return "FAIL";
  }
  const anyNotEval = oracleResults.some((r) => r.status === "not_evaluated");
  if (anyNotEval) {
    return "NOT_EVALUATED";
  }
  const allPass = oracleResults.every((r) => r.status === "pass");
  if (allPass) {
    return "PASS";
  }
  // Mixed results without fail → NOT_EVALUATED
  return "NOT_EVALUATED";
}

/**
 * Compute the overall outcome for a test from its criterion results.
 */
function computeTestOverall(
  criteria: Array<{
    criterion_id: string;
    class: CriterionClass;
    outcome: EvaluationOutcome;
  }>,
): EvaluationOutcome {
  if (criteria.length === 0) {
    return "NOT_EVALUATED";
  }

  const outcomes = new Set(criteria.map((c) => c.outcome));

  if (outcomes.has("FAIL")) return "FAIL";
  if (outcomes.has("NOT_EVALUATED")) return "NOT_EVALUATED";
  if (outcomes.has("PASS")) return "PASS";

  return "NOT_EVALUATED";
}

// ---------------------------------------------------------------------------
// Main evaluation
// ---------------------------------------------------------------------------

/**
 * Run the TEAM_SHAPE_SUITE evaluation.
 *
 * Loads the 3v3 team scenario, runs the simulation to collect
 * observations, evaluates common criteria, and reduces to
 * TEAM_SHAPE_SUITE_PASS.
 *
 * Reduction:
 *   PASS  — all tests in the team suite pass their common criteria.
 *   FAIL  — at least one test fails a common criterion.
 *   NOT_EVALUATED — observations empty or no tests evaluated.
 *
 * @param opts - Optional overrides.
 * @returns TeamShapeResult.
 */
export function runTeamShapeEvaluator(
  opts?: {
    /** Safety bounds for bounds invariant (defaults to standard field). */
    safetyBounds?: SafetyBounds;
    /** Custom scenario data (defaults to 3v3-fixture.v1.json). */
    scenarioOverride?: Record<string, unknown>;
  },
): TeamShapeResult {
  const { safetyBounds, scenarioOverride } = opts ?? {};

  // Load the 3v3 team scenario.
  const rawScenario = scenarioOverride ?? loadTeamScenario();
  const scenario = rawScenario as unknown as Parameters<typeof evaluate>[0]["scenario"];

  // Run the simulation to collect observations.
  const evalResult = evaluate({ scenario });

  // Get the common criterion IDs from the team suite.
  // COMMON-DETERMINISTIC is excluded from single-run evaluation
  // because it requires a two-run comparison (spec convention).
  const commonCriterionIds = TEAM_SUITE.common_criterion_ids.filter(
    (id) => id !== "COMMON-DETERMINISTIC",
  );

  // Check common criteria on the observations.
  const commonCriteriaCheck: CommonCriterionCheck[] = [];
  for (const criterionId of commonCriterionIds) {
    const check = checkCommonCriterion(criterionId, evalResult.observations, safetyBounds);
    commonCriteriaCheck.push(check);
  }

  // Build per-test results.  All tests share the same common
  // criterion evaluation since there are no test-specific bindings yet.
  // COMMON-DETERMINISTIC is excluded from single-run reduction because
  // it requires a two-run comparison (spec convention).
  const testResults: TeamShapeTestResult[] = [];

  for (const testId of TEAM_SUITE.direct_test_ids) {
    // Filter out COMMON-DETERMINISTIC from single-run overall reduction.
    const evaluatableCriteria = commonCriteriaCheck
      .filter((cc) => cc.criterionId !== "COMMON-DETERMINISTIC")
      .map((cc) => ({
        criterion_id: cc.criterionId,
        class: COMMON_CRITERIA[cc.criterionId]?.class ?? "UNKNOWN",
        outcome: cc.outcome,
      }));

    const overall = computeTestOverall(evaluatableCriteria);

    testResults.push({
      test_id: testId,
      criteria: commonCriteriaCheck.map((cc) => ({
        criterion_id: cc.criterionId,
        class: COMMON_CRITERIA[cc.criterionId]?.class ?? "UNKNOWN",
        outcome: cc.outcome,
      })),
      overall,
    });
  }

  // --- Reduction ---
  const allTestsPass = testResults.every((t) => t.overall === "PASS");
  const anyFail = testResults.some((t) => t.overall === "FAIL");
  const anyNotEval = testResults.some((t) => t.overall === "NOT_EVALUATED");

  let verdict: TeamShapeOutcome;
  let details: string;

  if (evalResult.observations.length === 0) {
    verdict = "INVALID_RUN";
    details = "TEAM_SHAPE_SUITE_PASS INVALID_RUN: no observations collected";
  } else if (anyFail) {
    const failedTests = testResults
      .filter((t) => t.overall === "FAIL")
      .map((t) => t.test_id);
    verdict = "FAIL";
    details = `TEAM_SHAPE_SUITE_PASS FAIL: ${failedTests.length} test(s) failed — ${failedTests.join(", ")}`;
  } else if (!allTestsPass) {
    verdict = "NOT_EVALUATED";
    details = `TEAM_SHAPE_SUITE_PASS NOT_EVALUATED: ${testResults.length} test(s) evaluated, ${testResults.filter((t) => t.overall === "NOT_EVALUATED").length} not evaluated`;
  } else {
    verdict = "PASS";
    details = `TEAM_SHAPE_SUITE_PASS PASS: all ${TEAM_SUITE.direct_test_ids.length} tests pass common criteria`;
  }

  return {
    suiteId: TEAM_SUITE.suite_id,
    suiteVersion: TEAM_SUITE.suite_version,
    testCount: testResults.length,
    testResults,
    commonCriteriaCheck,
    allTestsPass,
    verdict,
    details,
  };
}