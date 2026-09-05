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
 *  - HARD_INVARIANT: FAIL if any oracle result fails.
 *    PASS if all oracle results pass (and no fails).
 *    NOT_EVALUATED only when all results are not_evaluated (or empty).
 *    NOT_EVALUATED never masks a FAIL — check anyFail first.
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
import { validateBrowserCaseResults, type BrowserCaseResult } from "../contracts/browser-cases.js";

// Import wire.ts to register all built-in oracles in the protected registry.
// This is a side-effect-only import; no exports are needed.
import "../oracles/wire.js";

// Imports for reference-hash generation (used by browser evidence cross-check).
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
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
  /** Overall evaluation outcome — INVALID_RUN when required execution paths are missing. */
  overall: EvaluationOutcome;
  suites: SuiteEvaluationResult[];
  /** Browser case results from a browser evaluation run (may be empty). */
  browserCases: BrowserCaseResult[];
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
  // TOUCH-SLOW-001-CONTACT uses possession-evidence oracle:
  // lastTouchRef changes must be backed by touch event evidence,
  // not just ball continuity.
  "TOUCH-SLOW-001-CONTACT": {
    oracle_id: "possession-evidence",
    oracle_version: "oracle-possession-v1",
  },
  "LOC-BALL-001-FREE": {
    oracle_id: "ball-continuity",
    oracle_version: "oracle-continuity-v1",
  },
  // Note: PASS-LOW-001-IMPULSE, PASS-LOFT-001-IMPULSE,
  // SHOT-PWR-001-IMPULSE are NOT mapped to any oracle.
  // They require contact/impulse oracles that do not yet exist.
  // These criteria will evaluate to NOT_EVALUATED.
  // PHY-SHLD-001-CONT uses player-contact-evidence: validates that
  // player-player-contact events exist and are well-formed.
  "PHY-SHLD-001-CONT": {
    oracle_id: "player-contact-evidence",
    oracle_version: "oracle-player-contact-v1",
  },
  // TACK-*-PHASE use the protected tackle-phase-evidence oracles: ordered
  // prepare→active→recover phases, active-window-only finite-reach contact,
  // recovery lock-out and velocity-only (no teleport) effects. With ≥2 players
  // and no tackle evidence they FAIL rather than staying NOT_EVALUATED, so a
  // stashed tackle action system turns the duels suite red.
  "TACK-ST-001-PHASE": {
    oracle_id: "tackle-phase-evidence-standing",
    oracle_version: "oracle-tackle-phase-v1",
  },
  "TACK-SL-001-PHASE": {
    oracle_id: "tackle-phase-evidence-slide",
    oracle_version: "oracle-tackle-phase-v1",
  },
  // SMALL-SIDED goalkeeper behavior criteria (GK-KEEPER-ORACLE-REGISTRATION):
  // the five GK behavior criteria bind to their protected keeper oracles so the
  // goalkeepers suite produces real verdicts.  Additive; no existing entry is
  // changed and the duels/foundation criteria keep their existing bindings.
  "GK-POSITIONING-HOLD": {
    oracle_id: "gk-positioning-oracle-v1",
    oracle_version: "oracle-gk-positioning-v1",
  },
  "GK-NO-FIELD-CHASE": {
    oracle_id: "gk-no-field-chase-oracle-v1",
    oracle_version: "oracle-gk-no-field-chase-v1",
  },
  "GK-SAVE-CLAIM": {
    oracle_id: "gk-save-claim-oracle-v1",
    oracle_version: "oracle-gk-save-claim-v1",
  },
  "GK-ROLE-DESIGNATION": {
    oracle_id: "gk-role-designation-oracle-v1",
    oracle_version: "oracle-gk-role-designation-v1",
  },
  "GK-DISTRIBUTION-NO-OMNISCIENCE": {
    oracle_id: "gk-distribution-oracle-v1",
    oracle_version: "oracle-gk-distribution-v1",
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
  // This is a fallback for criteria not registered in CRITERION_TO_ORACLE.
  // PASS-LOW-001-IMPULSE, PASS-LOFT-001-IMPULSE, SHOT-PWR-001-IMPULSE
  // are NOT mapped — they require contact/impulse oracles that do not exist.
  const bootstrapMapping: Record<string, string> = {
    "BALL-IND-001-CONT": "ball-continuity",
    "BALL-IND-001-POSS": "possession-evidence",
    "BALL-GND-001-CONTACT": "ball-continuity",
    "BALL-BNC-001-EVENT": "ball-continuity",
    "BALL-SPN-001-SYM": "ball-continuity",
    "TOUCH-SLOW-001-CONTACT": "possession-evidence",
    "LOC-BALL-001-FREE": "ball-continuity",
    // Note: TOUCH-SLOW-001-CONTACT is also registered in CRITERION_TO_ORACLE
    // above; this bootstrapMapping entry is a fallback for criteria not yet
    // mapped in CRITERION_TO_ORACLE.  It uses "possession-evidence" to match
    // the criterion_bindings mapping in bindings.ts.
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
  // HARD_INVARIANT: FAIL if any oracle result fails.
  // PASS if all results pass.
  // NOT_EVALUATED only when all results are not_evaluated (or empty).
  // NOT_EVALUATED must never mask a FAIL — check anyFail first.
  if (criterionClass === "HARD_INVARIANT") {
    if (oracleResults.length === 0) {
      return "NOT_EVALUATED";
    }
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
 * Generate reference hashes from a scenario using the simulation core.
 * Returns the initial state hash (before any steps) and per-tick hashes.
 * This is the headless reference used to cross-check browser evidence.
 */
function generateReferenceHashes(
  scenario: Parameters<typeof evaluate>[0]["scenario"],
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
 *
 * Evidence is valid when:
 *  - initialHash is a non-empty string.
 *  - perTickHashes (when present) is an array of non-empty strings.
 *  - initialHash matches the headless reference initialHash.
 *  - Each perTickHash matches the corresponding headless per-tick hash.
 *
 * Dummy strings like "dummy-never-produced" will fail cross-check and
 * return an error — bare passed:true without matching evidence is INVALID_RUN.
 *
 * @param result - Browser case result to validate.
 * @param headless - Headless reference hashes from the same scenario.
 * @returns An error string if invalid, or undefined if valid.
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

  // Cross-check initialHash against headless reference.
  if (result.evidence.initialHash !== headless.initialHash) {
    return `Evidence initialHash does not match headless reference for case "${result.case_id}"`;
  }

  if (result.evidence.perTickHashes !== undefined && result.evidence.perTickHashes.length > 0) {
    if (!Array.isArray(result.evidence.perTickHashes)) {
      return `perTickHashes must be an array for case "${result.case_id}"`;
    }
    for (let i = 0; i < result.evidence.perTickHashes.length; i++) {
      if (typeof result.evidence.perTickHashes[i] !== "string" || result.evidence.perTickHashes[i].length === 0) {
        return `Empty perTickHash entry at index ${i} for case "${result.case_id}"`;
      }
      // Cross-check each per-tick hash against the headless reference.
      // perTickHashes are only valid when generated from the same
      // input program as the headless run (e.g., same scenario + same inputs).
      if (result.evidence.perTickHashes[i] !== headless.perTickHashes[i]) {
        return `Per-tick hash mismatch at tick ${i} for case "${result.case_id}"`;
      }
    }
  }

  return undefined;
}

/**
 * Validate required browser cases for a profile.
 *
 * Checks:
 *  1. All case_ids are known (registered).
 *  2. All required case_ids are present in results.
 *  3. Every required case has valid evidence matching headless hashes.
 *  4. Every required case has passed === true.
 *
 * Returns separate arrays:
 *  - validationErrors: evidence issues → INVALID_RUN overall.
 *  - validationFails: evidence valid but case failed → FAIL overall.
 *
 * @param profile - The milestone profile to check.
 * @param browserCases - Browser case results from a browser evaluation run.
 * @param headless - Headless reference hashes from the same scenario.
 * @returns { validationErrors, validationFails } — error arrays.
 */
function validateBrowserCases(
  profile: { required_browser_case_ids: string[] },
  browserCases: BrowserCaseResult[],
  headless: { initialHash: string; perTickHashes: string[] },
): { validationErrors: string[]; validationFails: string[] } {
  const validationErrors: string[] = [];
  const validationFails: string[] = [];

  // 1. Reject unknown case_ids.
  const knownCaseIds = validateBrowserCaseResults(browserCases);
  validationErrors.push(...knownCaseIds);

  // 2–4. Check required cases.
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
    // Cross-check evidence against headless reference.
    const evidenceError = validateBrowserEvidence(found, headless);
    if (evidenceError) {
      validationErrors.push(evidenceError);
      continue;
    }
    // Evidence is valid — check pass status.
    if (!found.passed) {
      validationFails.push(
        `Required browser case "${caseId}" has passed:false`,
      );
    }
  }
  return { validationErrors, validationFails };
}

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
    /** Browser case results from a browser evaluation run. */
    browserCases?: BrowserCaseResult[];
    /** Skip browser-case validation (evaluates suites only; caller handles browser). */
    skipBrowserValidation?: boolean;
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

  // Generate headless reference hashes for browser evidence cross-check.
  const headlessRef = generateReferenceHashes(scenario);

  // Validate required browser case execution.
  const browserCaseResults: BrowserCaseResult[] = opts?.browserCases ?? [];
  let validationErrors: string[] = [];
  let validationFails: string[] = [];

  // When skipBrowserValidation is true, skip browser validation so the
  // caller (e.g. foundation-lab promotion layer) can handle it independently.
  if (!opts?.skipBrowserValidation) {
    const { validationErrors: ve, validationFails: vf } = validateBrowserCases(
      profile,
      browserCaseResults,
      headlessRef,
    );
    validationErrors = ve;
    validationFails = vf;
  }
  const browserInvalid = validationErrors.length > 0;

  // If browser is a required execution path and required browser cases
  // were not executed or validated (evidence issues), the overall result
  // is INVALID_RUN.  Evidence-valid but passed:false cases produce FAIL.
  // When skipBrowserValidation is true, let suites determine overall.
  let overallOutcome: EvaluationOutcome | undefined = !opts?.skipBrowserValidation
    && browserInvalid
    ? "INVALID_RUN"
    : undefined;

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

  // When browser cases are valid, compute overall from suite test outcomes.
  if (overallOutcome === undefined) {
    // Evidence-valid but passed:false on a required case → FAIL.
    if (validationFails.length > 0) {
      overallOutcome = "FAIL";
    } else {
      // Collect all per-test overall outcomes across suites.
      const testOutcomes = results.flatMap((s) => s.tests.map((t) => t.overall));
      if (testOutcomes.includes("FAIL")) {
        overallOutcome = "FAIL";
      } else if (testOutcomes.includes("PASS")) {
        overallOutcome = "PASS";
      } else if (testOutcomes.includes("BLOCKED_MISSING_REFERENCE")) {
        overallOutcome = "BLOCKED_MISSING_REFERENCE";
      } else if (testOutcomes.includes("NOT_EVALUATED")) {
        overallOutcome = "NOT_EVALUATED";
      } else {
        overallOutcome = "NOT_EVALUATED";
      }
    }
  }

  return {
    registry_set_id: registry.registry_set_id,
    profile: {
      milestone_id: profile.milestone_id,
      profile_version: profile.profile_version,
      required_criterion_classes: profile.required_criterion_classes,
      required_suite_ids: profile.required_suite_ids,
    },
    overall: overallOutcome,
    suites: results,
    browserCases: browserCaseResults,
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