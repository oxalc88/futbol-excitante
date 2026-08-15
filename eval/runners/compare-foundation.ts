/**
 * @module eval/runners/compare-foundation
 *
 * Two-run evaluation of a scenario against the FOUNDATION_LAB profile.
 *
 * Runs the same scenario twice with identical seed, inputs, and config,
 * then compares per-tick hashes using `compareRuns`.  The COMMON-DETERMINISTIC
 * criterion is set based on the comparison result.
 *
 * This is the execution path for the COMMON-DETERMINISTIC HARD_INVARIANT:
 * - Hashes match at every tick → PASS
 * - Hashes diverge at any tick → FAIL
 *
 * Single-run evaluateFoundation may still leave COMMON-DETERMINISTIC as
 * NOT_EVALUATED and excludes it from single-run overall reduction.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { evaluate, type EvaluationResult } from "./evaluate.js";
import { compareRuns } from "./compare.js";
import { loadRegistrySet } from "../contracts/loader.js";
import { COMMON_CRITERIA } from "../contracts/common-criteria.js";
import { executeOracle } from "../oracles/oracle-registry.js";
import { validateBrowserCaseResults, type BrowserCaseResult } from "../contracts/browser-cases.js";
import { hashFnv1a64 } from "../../src/simulation/determinism/hash.js";

// Import wire.ts to register all built-in oracles in the protected registry.
import "../oracles/wire.js";

// Imports for reference-hash generation (used by browser evidence cross-check).
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";
import type {
  CriterionClass,
  EvaluationOutcome,
  CriterionEvaluationResult as _CriterionEvaluationResult,
  TestEvaluationResult as _TestEvaluationResult,
} from "../contracts/types.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Local result types (same shapes as foundation-evaluator)
// ---------------------------------------------------------------------------

/**
 * A criterion evaluation result.
 */
export interface CriterionEvaluationResult
  extends _CriterionEvaluationResult {
  evidence: string[];
}

/**
 * A test evaluation result.
 */
export interface TestEvaluationResult
  extends _TestEvaluationResult {}

/**
 * Result of evaluating a suite (one or more tests).
 */
export interface SuiteEvaluationResult {
  suite_id: string;
  suite_version: string;
  tests: TestEvaluationResult[];
}

/**
 * Result of a two-run comparison evaluation.
 */
export interface CompareFoundationResult {
  /** COMMON-DETERMINISTIC outcome from the two-run comparison. */
  commonDeterministicOutcome: EvaluationOutcome;
  /** Evidence array for COMMON-DETERMINISTIC (spec artifact paths). */
  commonDeterministicEvidence: string[];
  /** Whether the two runs shared the same condition hash. */
  conditionHashMatch: boolean;
  /** Earliest divergence tick if hashes differ (undefined when match). */
  earliestDivergenceTick?: number;
  /** Single-run suite results (COMMON-DETERMINISTIC NOT_EVALUATED within). */
  suites: SuiteEvaluationResult[];
}

// ---------------------------------------------------------------------------
// Direct criterion → oracle mapping (copied from foundation-evaluator)
// ---------------------------------------------------------------------------

const CRITERION_TO_ORACLE: Record<
  string,
  { oracle_id: string; oracle_version: string }
> = {
  "COMMON-FINITE": { oracle_id: "finite-number", oracle_version: "oracle-finite-v1" },
  "COMMON-REFERENCES": {
    oracle_id: "event-references",
    oracle_version: "oracle-references-v1",
  },
  "COMMON-BOUNDS": { oracle_id: "bounds", oracle_version: "oracle-bounds-v1" },

  "BALL-IND-001-CONT": {
    oracle_id: "ball-continuity",
    oracle_version: "oracle-continuity-v1",
  },
  "BALL-IND-001-POSS": {
    oracle_id: "possession-evidence",
    oracle_version: "oracle-possession-v1",
  },
  "BALL-GND-001-CONTACT": {
    oracle_id: "ball-continuity",
    oracle_version: "oracle-continuity-v1",
  },
  "BALL-BNC-001-EVENT": {
    oracle_id: "ball-continuity",
    oracle_version: "oracle-continuity-v1",
  },
  "BALL-SPN-001-SYM": {
    oracle_id: "ball-continuity",
    oracle_version: "oracle-continuity-v1",
  },
  "PASS-LOW-001-IMPULSE": {
    oracle_id: "ball-continuity",
    oracle_version: "oracle-continuity-v1",
  },
  "PASS-LOFT-001-IMPULSE": {
    oracle_id: "ball-continuity",
    oracle_version: "oracle-continuity-v1",
  },
  // TOUCH-SLOW-001-CONTACT uses possession-evidence oracle.
  "TOUCH-SLOW-001-CONTACT": {
    oracle_id: "possession-evidence",
    oracle_version: "oracle-possession-v1",
  },
  "LOC-BALL-001-FREE": {
    oracle_id: "ball-continuity",
    oracle_version: "oracle-continuity-v1",
  },
  // Note: PASS-LOW-001-IMPULSE, PASS-LOFT-001-IMPULSE,
  // SHOT-PWR-001-IMPULSE are NOT mapped here — they require
  // contact/impulse oracles that do not yet exist.
  // These criteria will evaluate to NOT_EVALUATED.
  // PHY-SHLD-001-CONT removed — duel/shielding is out of scope.
};

// ---------------------------------------------------------------------------
// Criterion → Oracle resolution
// ---------------------------------------------------------------------------

function criterionToOracle(
  criterionId: string,
  class_: CriterionClass,
): Array<{ oracle_id: string; oracle_version: string }> {
  const direct = CRITERION_TO_ORACLE[criterionId];
  if (direct) {
    return [direct];
  }

  const bootstrapMapping: Record<string, string> = {
    "BALL-IND-001-CONT": "ball-continuity",
    "BALL-IND-001-POSS": "possession-evidence",
    "BALL-GND-001-CONTACT": "ball-continuity",
    "BALL-BNC-001-EVENT": "ball-continuity",
    "BALL-SPN-001-SYM": "ball-continuity",
    // TOUCH-SLOW-001-CONTACT uses possession-evidence oracle.
    "TOUCH-SLOW-001-CONTACT": "possession-evidence",
    "LOC-BALL-001-FREE": "ball-continuity",
  };

  if (class_ === "HARD_INVARIANT" && bootstrapMapping[criterionId]) {
    return [
      {
        oracle_id: bootstrapMapping[criterionId],
        oracle_version: "oracle-continuity-v1",
      },
    ];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Outcome computation
// ---------------------------------------------------------------------------

function computeOutcome(
  oracleResults: InvariantResult[],
  criterionClass: CriterionClass,
): EvaluationOutcome {
  if (criterionClass === "HARD_INVARIANT") {
    if (oracleResults.length === 0) {
      return "NOT_EVALUATED";
    }
    const anyFail = oracleResults.some((r) => r.status === "fail");
    if (anyFail) {
      return "FAIL";
    }
    const allPass = oracleResults.every((r) => r.status === "pass");
    if (allPass) {
      return "PASS";
    }
    return "FAIL";
  }

  if (criterionClass === "MEASURED_TARGET") {
    return "BLOCKED_MISSING_REFERENCE";
  }

  if (criterionClass === "REGRESSION") {
    return "NOT_EVALUATED";
  }

  if (criterionClass === "ENGINE_DESIGN_TARGET") {
    return "NOT_EVALUATED";
  }

  if (criterionClass === "PERCEPTUAL_TARGET") {
    return "NEEDS_PERCEPTUAL_REVIEW";
  }

  return "NOT_EVALUATED";
}

/**
 * Compute the overall outcome for a test from its criteria results.
 *
 * COMMON-DETERMINISTIC is excluded from single-run overall reduction
 * because it requires a two-run comparison.  Its outcome is still
 * recorded on the criteria list; it only does not force the overall
 * result to NOT_EVALUATED when all other criteria are PASS.
 */
function computeOverallOutcome(
  criteria: CriterionEvaluationResult[],
  hasInvalidRun: boolean,
): EvaluationOutcome {
  if (hasInvalidRun) {
    return "INVALID_RUN";
  }

  // COMMON-DETERMINISTIC requires two runs; exclude from single-run
  // per-test overall reduction so a clean run can still yield PASS.
  const evaluatable = criteria.filter(
    (c) => c.criterion_id !== "COMMON-DETERMINISTIC",
  );

  if (evaluatable.length === 0) {
    return "NOT_EVALUATED";
  }

  const outcomes = new Set(evaluatable.map((c) => c.outcome));

  if (outcomes.has("FAIL")) return "FAIL";
  if (outcomes.has("NEEDS_PERCEPTUAL_REVIEW")) return "NEEDS_PERCEPTUAL_REVIEW";
  if (outcomes.has("BLOCKED_MISSING_REFERENCE"))
    return "BLOCKED_MISSING_REFERENCE";
  if (outcomes.has("NOT_EVALUATED")) return "NOT_EVALUATED";
  if (outcomes.has("PASS")) return "PASS";

  return "NOT_EVALUATED";
}

// ---------------------------------------------------------------------------
// Main two-run evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a scenario with a two-run path: run twice with identical
 * seed/inputs/config, compare per-tick hashes, and produce a
 * CompareFoundationResult with COMMON-DETERMINISTIC outcome.
 *
 * Also runs single-run suite evaluation on run-A observations so the
 * result includes suites with non-COMMON-DETERMINISTIC criteria.
 *
 * @param scenario - The scenario to evaluate (must be valid for the simulation core).
 * @param opts - Evaluation options.
 * @returns CompareFoundationResult with COMMON-DETERMINISTIC outcome and suites.
 */
export function compareAndEvaluateFoundation(
  scenario: Parameters<typeof evaluate>[0]["scenario"],
  opts?: {
    /** Safety bounds for the bounds invariant. */
    safetyBounds?: {
      maxX: number;
      maxY: number;
      minZ: number;
      maxZ: number;
    };
    /** Browser case results from a browser evaluation run. */
    browserCases?: BrowserCaseResult[];
  },
): CompareFoundationResult {
  // --- Two-run path: evaluate twice with identical inputs ---------------

  const runA = evaluate({ scenario, safetyBounds: opts?.safetyBounds });
  const runB = evaluate({ scenario, safetyBounds: opts?.safetyBounds });

  // Compare the two runs.
  const comparison = compareRuns(runA, runB);

  let commonDeterministicOutcome: EvaluationOutcome;
  let commonDeterministicEvidence: string[];
  let earliestDivergenceTick: number | undefined;

  if (!comparison.conditionHashMatch) {
    // Condition hashes differ — runs were not intended to match.
    commonDeterministicOutcome = "FAIL";
    commonDeterministicEvidence = [
      "comparison-condition-hash-mismatch: runs A and B do not share the same scenario/config",
    ];
  } else {
    earliestDivergenceTick = comparison.earliestDivergenceTick;
    if (comparison.earliestDivergenceTick === undefined) {
      // All per-tick hashes match — COMMON-DETERMINISTIC passes.
      commonDeterministicOutcome = "PASS";
      commonDeterministicEvidence = [
        "state/hashes-run-a.jsonl",
        "state/hashes-run-b.jsonl",
        "comparison-condition-hash-match: identical seed, inputs, config",
      ];
    } else {
      // Hashes diverge at earliestDivergenceTick — COMMON-DETERMINISTIC fails.
      commonDeterministicOutcome = "FAIL";
      commonDeterministicEvidence = [
        `state/hashes-run-a.jsonl`,
        `state/hashes-run-b.jsonl`,
        `earliest-divergence-tick: ${comparison.earliestDivergenceTick}`,
        `expected-hash: ${comparison.earliestDivergenceExpected}`,
        `actual-hash: ${comparison.earliestDivergenceActual}`,
      ];
    }
  }

  // --- Single-run suite evaluation on run-A observations ----------------

  const registry = loadRegistrySet();
  const profile = registry.milestone_profiles["FOUNDATION_LAB"];
  if (!profile) {
    throw new Error("FOUNDATION_LAB milestone profile not found in registry");
  }

  // Generate headless reference hashes for browser evidence cross-check.
  const headlessRef = generateReferenceHashes(scenario);

  // Validate required browser case execution.
  const browserCaseResults: BrowserCaseResult[] = opts?.browserCases ?? [];
  const { validationErrors, validationFails } = validateBrowserCases(
    profile,
    browserCaseResults,
    headlessRef,
  );

  const results: SuiteEvaluationResult[] = [];

  for (const suiteId of profile.required_suite_ids) {
    const suiteDef = registry.suite_definitions[suiteId];
    if (!suiteDef) {
      continue;
    }

    const expansion = registry.expansion_manifests[
      suiteDef.expected_expansion_manifest_id
    ];
    const expandedTests = expansion
      ? expansion.expanded_test_ids
      : suiteDef.direct_test_ids.slice();
    const commonCriterionIds = expansion
      ? expansion.common_criterion_ids
      : suiteDef.common_criterion_ids;

    const testResults: TestEvaluationResult[] = [];

    for (const testId of expandedTests) {
      const binding = registry.test_bindings[testId];

      if (!binding) {
        testResults.push({
          test_id: testId,
          scenario_id: "unknown",
          candidate_run_manifest_hash: runA.finalStateHash,
          baseline_run_manifest_hash: "not-applicable",
          comparison_condition_hash: "not-applicable",
          criteria: [],
          overall: "INVALID_RUN",
        });
        continue;
      }

      const allCriterionIds = new Set([
        ...commonCriterionIds,
        ...Object.keys(binding.criterion_bindings),
      ]);

      const criteria: CriterionEvaluationResult[] = [];
      let hasInvalidRun = false;

      for (const criterionId of allCriterionIds) {
        const criterion = COMMON_CRITERIA[criterionId];
        if (!criterion) {
          criteria.push({
            criterion_id: criterionId,
            class: "UNKNOWN",
            outcome: "NOT_EVALUATED",
            target_id: null,
            evidence: [],
          });
          continue;
        }

        // Execute oracle on the actual observations.
        const oracleIds = criterionToOracle(
          criterionId,
          criterion.class,
        );
        let oracleResults: InvariantResult[] = [];
        if (oracleIds.length > 0) {
          for (const { oracle_id: oid, oracle_version: ov } of oracleIds) {
            try {
              const results_ = executeOracle(
                oid,
                ov,
                runA.observations,
              );
              oracleResults = oracleResults.concat(results_);
            } catch {
              // Oracle not registered.
            }
          }
        }

        // COMMON-DETERMINISTIC is resolved by the two-run comparison,
        // not by single-run oracle execution.
        if (criterionId === "COMMON-DETERMINISTIC") {
          criteria.push({
            criterion_id: criterionId,
            class: criterion.class,
            outcome: commonDeterministicOutcome,
            target_id: null,
            evidence: commonDeterministicEvidence,
          });
        } else {
          const outcome = computeOutcome(
            oracleResults,
            criterion.class,
          );

          criteria.push({
            criterion_id: criterionId,
            class: criterion.class,
            outcome,
            target_id: null,
            evidence: oracleResults.map((r) => r.description),
          });
        }
      }

      const overall = computeOverallOutcome(criteria, hasInvalidRun);

      testResults.push({
        test_id: testId,
        scenario_id: binding.scenario_ids[0] ?? "unknown",
        candidate_run_manifest_hash: runA.finalStateHash,
        baseline_run_manifest_hash: runB.finalStateHash,
        comparison_condition_hash: comparison.conditionHashMatch
          ? computeConditionHash(runA)
          : "mismatch",
        criteria,
        overall,
      });
    }

    results.push({
      suite_id: suiteId,
      suite_version: suiteDef.suite_version,
      tests: testResults,
    });
  }

  return {
    commonDeterministicOutcome,
    commonDeterministicEvidence,
    conditionHashMatch: comparison.conditionHashMatch,
    earliestDivergenceTick,
    suites: results,
  };
}

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
 * Helper to generate reference hashes from a scenario using the simulation core.
 * Used by browser evidence cross-check.
 */
function generateReferenceHashes(
  scenario: ScenarioDefinition,
): { initialHash: string; perTickHashes: string[] } {
  const world = createWorld({ scenario });
  const sim = createSimulation(world);
  const initialHash = sim.stateHash();
  const perTickHashes: string[] = [];
  for (let i = 0; i < scenario.durationTicks; i++) {
    const tickInputs = scenario.inputProgram[sim.tick] ?? [];
    if (tickInputs.length > 0) {
      sim.applyInputs(tickInputs);
    }
    const result = sim.step();
    perTickHashes.push(result.stateHash);
  }
  return { initialHash, perTickHashes };
}

/**
 * Validate a BrowserCaseResult's evidence and cross-check it against
 * headless simulation hashes.
 */
function validateBrowserEvidence(
  result: BrowserCaseResult,
  headless: { initialHash: string; perTickHashes: string[] },
): string | undefined {
  if (
    typeof result.evidence !== "object" ||
    result.evidence === null ||
    typeof result.evidence.initialHash !== "string" ||
    result.evidence.initialHash.length === 0
  ) {
    return `Missing or empty initialHash for case "${result.case_id}"`;
  }

  if (result.evidence.initialHash !== headless.initialHash) {
    return `Evidence initialHash does not match headless reference for case "${result.case_id}"`;
  }

  if (
    result.evidence.perTickHashes !== undefined &&
    result.evidence.perTickHashes.length > 0
  ) {
    if (!Array.isArray(result.evidence.perTickHashes)) {
      return `perTickHashes must be an array for case "${result.case_id}"`;
    }
    for (let i = 0; i < result.evidence.perTickHashes.length; i++) {
      if (
        typeof result.evidence.perTickHashes[i] !== "string" ||
        result.evidence.perTickHashes[i].length === 0
      ) {
        return `Empty perTickHash entry at index ${i} for case "${result.case_id}"`;
      }
      if (result.evidence.perTickHashes[i] !== headless.perTickHashes[i]) {
        return `Per-tick hash mismatch at tick ${i} for case "${result.case_id}"`;
      }
    }
  }

  return undefined;
}

/**
 * Validate required browser cases for a profile.
 */
function validateBrowserCases(
  profile: { required_browser_case_ids: string[] },
  browserCases: BrowserCaseResult[],
  headless: { initialHash: string; perTickHashes: string[] },
): { validationErrors: string[]; validationFails: string[] } {
  const validationErrors: string[] = [];
  const validationFails: string[] = [];

  const knownCaseIds = validateBrowserCaseResults(browserCases);
  validationErrors.push(...knownCaseIds);

  const requiredIds = profile.required_browser_case_ids;
  if (requiredIds.length === 0) {
    return { validationErrors, validationFails };
  }
  for (const caseId of requiredIds) {
    const found = browserCases.find((r) => r.case_id === caseId);
    if (!found) {
      validationErrors.push(`Missing required browser case "${caseId}"`);
      continue;
    }
    const evidenceError = validateBrowserEvidence(found, headless);
    if (evidenceError) {
      validationErrors.push(evidenceError);
      continue;
    }
    if (!found.passed) {
      validationFails.push(
        `Required browser case "${caseId}" has passed:false`,
      );
    }
  }
  return { validationErrors, validationFails };
}