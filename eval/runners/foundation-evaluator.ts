/**
 * @module @pes/eval/runners/foundation-evaluator
 *
 * Evaluates a scenario against the foundation suites (fast, locomotion, ball).
 *
 * Architecture:
 *  1. Load the registry set (contracts/loader).
 *  2. Expand the suite (impact_closure NONE → expanded_test_ids + common_criterion_ids).
 *  3. For each expanded test:
 *     a. Use the test binding to discover criterion_bindings.
 *     b. For each criterion in the binding, determine its class.
 *     c. Map the criterion to a registered oracle.
 *     d. Execute the oracle over observations.
 *     e. Record the per-criterion outcome.
 *  4. Produce CriterionEvaluationResult[] per test and overall.
 *
 * Criterion outcome rules:
 *  - HARD_INVARIANT: PASS if all oracle results pass; FAIL if any fail.
 *  - MEASURED_TARGET: BLOCKED_MISSING_REFERENCE.
 *  - REGRESSION: NOT_EVALUATED (no regression policy).
 *  - ENGINE_DESIGN_TARGET: NOT_EVALUATED (no CapabilityDesignProfile).
 *  - PERCEPTUAL_TARGET: NEEDS_PERCEPTUAL_REVIEW.
 *  - UNKNOWN: NOT_EVALUATED.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in core evaluation.
 */

import { evaluate } from "./evaluate.js";
import { loadRegistrySet } from "../contracts/loader.js";
import { COMMON_CRITERIA } from "../contracts/common-criteria.js";
import { executeOracle } from "../oracles/oracle-registry.js";

// Import wire.ts to register all built-in oracles in the protected registry.
// This is a side-effect-only import; no exports are needed.
import "../oracles/wire.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";
import type {
  CriterionClass,
  EvaluationOutcome,
  CriterionEvaluationResult as _CriterionEvaluationResult,
  TestEvaluationResult as _TestEvaluationResult,
  SuiteDefinition,
} from "../contracts/types.js";

// ---------------------------------------------------------------------------
// Local result types (spec §2.2 / §3 types aliased above)
// ---------------------------------------------------------------------------

/**
 * A criterion evaluation result. Extends the spec type with
 * the evidence kept as strings (spec: evidence: string[]).
 */
export interface CriterionEvaluationResult
  extends _CriterionEvaluationResult {
  evidence: string[];
}

/**
 * A test evaluation result.
 * For single-run evaluation, manifest hashes are "not-applicable".
 */
export interface TestEvaluationResult
  extends _TestEvaluationResult {
  // Manifest hashes from single-run evaluation are not applicable.
  // These fields are required by the spec but filled with placeholder.
  // candidate_run_manifest_hash and baseline_run_manifest_hash
  // are only meaningful in a compare operation.
}

/**
 * Result of evaluating a suite (one or more tests).
 */
export interface SuiteEvaluationResult {
  suite_id: string;
  suite_version: string;
  tests: TestEvaluationResult[];
}

/**
 * Result of evaluating all suites from the FOUNDATION_LAB milestone profile.
 */
export interface FoundationEvaluationResult {
  registry_set_id: string;
  profile: {
    milestone_id: string;
    profile_version: string;
    required_criterion_classes: string[];
    required_suite_ids: string[];
  };
  suites: SuiteEvaluationResult[];
}

// ---------------------------------------------------------------------------
// Direct criterion → oracle mapping
// ---------------------------------------------------------------------------
// Maps criterion_id to the registered oracle that checks it.

const CRITERION_TO_ORACLE: Record<
  string,
  { oracle_id: string; oracle_version: string }
> = {
  // Common criteria
  "COMMON-FINITE": { oracle_id: "finite-number", oracle_version: "oracle-finite-v1" },
  // COMMON-DETERMINISTIC: requires two runs (compare step) → NOT_EVALUATED.
  // Not registered as an oracle because it's not a single-run check.
  "COMMON-REFERENCES": {
    oracle_id: "event-references",
    oracle_version: "oracle-references-v1",
  },
  "COMMON-BOUNDS": { oracle_id: "bounds", oracle_version: "oracle-bounds-v1" },

  // BOOTSTRAP-level test criteria mapping to specific oracles.
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
  "TOUCH-SLOW-001-CONTACT": {
    oracle_id: "ball-continuity",
    oracle_version: "oracle-continuity-v1",
  },
  "LOC-BALL-001-FREE": {
    oracle_id: "ball-continuity",
    oracle_version: "oracle-continuity-v1",
  },
  "PHY-SHLD-001-CONT": {
    oracle_id: "ball-continuity",
    oracle_version: "oracle-continuity-v1",
  },
};

// ---------------------------------------------------------------------------
// Criterion → Oracle resolution
// ---------------------------------------------------------------------------

/**
 * Map a criterion_id to the registered oracle(s) that check it.
 */
function criterionToOracle(
  criterionId: string,
  class_: CriterionClass,
): Array<{ oracle_id: string; oracle_version: string }> {
  const direct = CRITERION_TO_ORACLE[criterionId];
  if (direct) {
    return [direct];
  }

  // BOOTSTRAP-level test criteria that map to known invariants.
  const bootstrapMapping: Record<string, string> = {
    "BALL-IND-001-CONT": "ball-continuity",
    "BALL-IND-001-POSS": "possession-evidence",
    "BALL-GND-001-CONTACT": "ball-continuity",
    "BALL-BNC-001-EVENT": "ball-continuity",
    "BALL-SPN-001-SYM": "ball-continuity",
    "PASS-LOW-001-IMPULSE": "ball-continuity",
    "PASS-LOFT-001-IMPULSE": "ball-continuity",
    "TOUCH-SLOW-001-CONTACT": "ball-continuity",
    "LOC-BALL-001-FREE": "ball-continuity",
    "PHY-SHLD-001-CONT": "ball-continuity",
  };

  if (class_ === "HARD_INVARIANT" && bootstrapMapping[criterionId]) {
    return [
      {
        oracle_id: bootstrapMapping[criterionId],
        oracle_version: "oracle-continuity-v1",
      },
    ];
  }

  // No known oracle mapping — return empty (will be NOT_EVALUATED).
  return [];
}

// ---------------------------------------------------------------------------
// Outcome computation
// ---------------------------------------------------------------------------

/**
 * Compute the evaluation outcome for a criterion based on its class
 * and the oracle results.
 */
function computeOutcome(
  oracleResults: InvariantResult[],
  criterionClass: CriterionClass,
): EvaluationOutcome {
  // HARD_INVARIANT: PASS if all oracle results pass, FAIL if any fail.
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

  // MEASURED_TARGET: BLOCKED_MISSING_REFERENCE.
  if (criterionClass === "MEASURED_TARGET") {
    return "BLOCKED_MISSING_REFERENCE";
  }

  // REGRESSION: NOT_EVALUATED (no versioned regression policy).
  if (criterionClass === "REGRESSION") {
    return "NOT_EVALUATED";
  }

  // ENGINE_DESIGN_TARGET: NOT_EVALUATED.
  if (criterionClass === "ENGINE_DESIGN_TARGET") {
    return "NOT_EVALUATED";
  }

  // PERCEPTUAL_TARGET: NEEDS_PERCEPTUAL_REVIEW.
  if (criterionClass === "PERCEPTUAL_TARGET") {
    return "NEEDS_PERCEPTUAL_REVIEW";
  }

  // UNKNOWN: NOT_EVALUATED.
  return "NOT_EVALUATED";
}

/**
 * Compute the overall outcome for a test from its criteria results.
 *
 * Precedence: INVALID_RUN > FAIL > NEEDS_PERCEPTUAL_REVIEW
 *            > BLOCKED_MISSING_REFERENCE > NOT_EVALUATED > PASS
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
// Main evaluation: full foundation profile
// ---------------------------------------------------------------------------

/**
 * Evaluate a scenario against all suites in the FOUNDATION_LAB profile.
 *
 * @param scenario - The scenario to evaluate (must be valid for the simulation core).
 * @param opts - Evaluation options.
 * @returns FoundationEvaluationResult with per-suite, per-test, per-criterion results.
 */
export function evaluateFoundation(
  scenario: Parameters<typeof evaluate>[0]["scenario"],
  opts?: {
    /** Safety bounds for the bounds invariant. */
    safetyBounds?: {
      maxX: number;
      maxY: number;
      minZ: number;
      maxZ: number;
    };
  },
): FoundationEvaluationResult {
  // Load the registry.
  const registry = loadRegistrySet();

  // Get the FOUNDATION_LAB profile.
  const profile = registry.milestone_profiles["FOUNDATION_LAB"];
  if (!profile) {
    throw new Error("FOUNDATION_LAB milestone profile not found in registry");
  }

  // Run the evaluation to get observations.
  const evalResult = evaluate({
    scenario,
    safetyBounds: opts?.safetyBounds,
  });

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

    // Evaluate each test in the expanded set.
    const testResults: TestEvaluationResult[] = [];

    for (const testId of expandedTests) {
      const binding = registry.test_bindings[testId];

      if (!binding) {
        // Test binding missing — INVALID_RUN.
        testResults.push({
          test_id: testId,
          scenario_id: "unknown",
          candidate_run_manifest_hash: evalResult.finalStateHash,
          baseline_run_manifest_hash: "not-applicable",
          comparison_condition_hash: "not-applicable",
          criteria: [],
          overall: "INVALID_RUN",
        });
        continue;
      }

      // Gather all criterion IDs for this test.
      const allCriterionIds = new Set([
        ...commonCriterionIds,
        ...Object.keys(binding.criterion_bindings),
      ]);

      const criteria: CriterionEvaluationResult[] = [];
      let hasInvalidRun = false;

      for (const criterionId of allCriterionIds) {
        const criterion = COMMON_CRITERIA[criterionId];
        if (!criterion) {
          // Unknown criterion — record as NOT_EVALUATED rather than silently dropping.
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
        const oracleIds = criterionToOracle(criterionId, criterion.class);
        let oracleResults: InvariantResult[] = [];
        if (oracleIds.length > 0) {
          for (const { oracle_id: oid, oracle_version: ov } of oracleIds) {
            try {
              const results_ = executeOracle(
                oid,
                ov,
                evalResult.observations,
              );
              oracleResults = oracleResults.concat(results_);
            } catch {
              // Oracle not registered.
            }
          }
        }

        const outcome = computeOutcome(oracleResults, criterion.class);

        criteria.push({
          criterion_id: criterionId,
          class: criterion.class,
          outcome,
          target_id: null,
          evidence: oracleResults.map((r) => r.description),
        });
      }

      const overall = computeOverallOutcome(criteria, hasInvalidRun);

      testResults.push({
        test_id: testId,
        scenario_id: binding.scenario_ids[0] ?? "unknown",
        candidate_run_manifest_hash: evalResult.finalStateHash,
        baseline_run_manifest_hash: "not-applicable",
        comparison_condition_hash: "not-applicable",
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
    registry_set_id: registry.registry_set_id,
    profile: {
      milestone_id: profile.milestone_id,
      profile_version: profile.profile_version,
      required_criterion_classes: profile.required_criterion_classes,
      required_suite_ids: profile.required_suite_ids,
    },
    suites: results,
  };
}

// ---------------------------------------------------------------------------
// Lower-level: evaluate a suite against observations directly.
// ---------------------------------------------------------------------------

/**
 * Evaluate a single suite's criteria on observations from a run.
 *
 * This is a lower-level API that works directly with observations
 * and a suite_id. It does NOT run the simulation.
 *
 * @param suiteId - The suite to evaluate.
 * @param observations - Telemetry observations from a run.
 * @param opts - Options.
 * @returns SuiteEvaluationResult with per-test results.
 */
export function evaluateSuite(
  suiteId: string,
  observations: TelemetryObservation[],
  opts?: {
    registry?: ReturnType<typeof loadRegistrySet>;
  },
): SuiteEvaluationResult {
  const registry = opts?.registry ?? loadRegistrySet();

  const suiteDef = registry.suite_definitions[suiteId];
  if (!suiteDef) {
    // Unknown suite — return INVALID_RUN rather than a silent empty result.
    return {
      suite_id: suiteId,
      suite_version: "unknown",
      tests: [
        {
          test_id: "_suite-invalid",
          scenario_id: "unknown",
          candidate_run_manifest_hash: "unknown",
          baseline_run_manifest_hash: "not-applicable",
          comparison_condition_hash: "not-applicable",
          criteria: [],
          overall: "INVALID_RUN",
        },
      ],
    };
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
        candidate_run_manifest_hash: "unknown",
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

    for (const criterionId of allCriterionIds) {
      const criterion = COMMON_CRITERIA[criterionId];
      if (!criterion) {
        // Unknown criterion — record as NOT_EVALUATED rather than silently dropping.
        criteria.push({
          criterion_id: criterionId,
          class: "UNKNOWN",
          outcome: "NOT_EVALUATED",
          target_id: null,
          evidence: [],
        });
        continue;
      }

      const oracleIds = criterionToOracle(criterionId, criterion.class);
      let oracleResults: InvariantResult[] = [];
      if (oracleIds.length > 0) {
        for (const { oracle_id: oid, oracle_version: ov } of oracleIds) {
          try {
            const results_ = executeOracle(oid, ov, observations);
            oracleResults = oracleResults.concat(results_);
          } catch {
            // Oracle not registered.
          }
        }
      }

      const outcome = computeOutcome(oracleResults, criterion.class);

      criteria.push({
        criterion_id: criterionId,
        class: criterion.class,
        outcome,
        target_id: null,
        evidence: oracleResults.map((r) => r.description),
      });
    }

    const overall = computeOverallOutcome(criteria, false);

    testResults.push({
      test_id: testId,
      scenario_id: binding.scenario_ids[0] ?? "unknown",
      candidate_run_manifest_hash: "unknown",
      baseline_run_manifest_hash: "not-applicable",
      comparison_condition_hash: "not-applicable",
      criteria,
      overall,
    });
  }

  return {
    suite_id: suiteId,
    suite_version: suiteDef.suite_version,
    tests: testResults,
  };
}