/**
 * @module @pes/eval/runners/foundation-promotion
 *
 * FOUNDATION_LAB milestone reducer.
 *
 * Joins the existing evaluation pieces:
 *  - evaluateFoundation  (HARD_INVARIANT suite evaluation)
 *  - compareAndEvaluateFoundation (COMMON-DETERMINISTIC two-run)
 *  - evaluateMutantCore (MUTANT_CORE detection)
 *  - Browser-case validation against headless reference hashes
 *
 * Profile reduction (GAMEPLAY_EVALUATION_SPEC §2.3):
 *  - required_suite_ids: [fast, locomotion, ball]
 *  - required_browser_case_ids: [BROWSER-CORE-RESET-001, BROWSER-CORE-STEP-001]
 *  - required_criterion_classes: [HARD_INVARIANT]
 *  - exit_prerequisites: [COMMON_DETERMINISTIC_PASS, MUTANT_CORE_PASS]
 *
 * Verdict rules:
 *  - Every required HARD_INVARIANT must be PASS.
 *  - MEASURED_TARGET / ENGINE_DESIGN_TARGET / REGRESSION / UNKNOWN /
 *    PERCEPTUAL_TARGET do NOT improve or worsen the milestone verdict.
 *  - Missing browser case → INVALID_RUN.
 *  - Dummy / non-matching browser evidence → INVALID_RUN.
 *  - Browser case passed:false with valid evidence → FAIL.
 *  - COMMON-DETERMINISTIC FAIL → FAIL.
 *  - MUTANT_CORE INVALID_RUN (skipped) → INVALID_RUN.
 *  - MUTANT_CORE executed but not all detected → FAIL.
 *  - Overall PASS only when every required item passes.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { evaluateFoundation } from "./foundation-evaluator.js";
import { compareAndEvaluateFoundation } from "./compare-foundation.js";
import { evaluateMutantCore } from "./mutant-core.js";
import { loadRegistrySet } from "../contracts/loader.js";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import type { BrowserCaseResult, EvaluationOutcome } from "../contracts/types.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Local type: mirror the result shape of evaluateFoundation without
// depending on its module-local definitions.
// ---------------------------------------------------------------------------

interface SuiteEvalResult {
  suite_id: string;
  suite_version: string;
  tests: Array<{
    test_id: string;
    scenario_id: string;
    candidate_run_manifest_hash: string;
    baseline_run_manifest_hash: string;
    comparison_condition_hash: string;
    criteria: Array<{
      criterion_id: string;
      class: string;
      outcome: string;
      target_id: string | null;
      evidence: string[];
    }>;
    overall: string;
  }>;
}

interface FoundationEvalResult {
  registry_set_id: string;
  profile: {
    milestone_id: string;
    profile_version: string;
    required_criterion_classes: string[];
    required_suite_ids: string[];
  };
  overall: EvaluationOutcome;
  suites: SuiteEvalResult[];
  browserCases: BrowserCaseResult[];
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Verdict for a single sub-evaluation component. */
interface SubComponentResult {
  /** Identifier used in reduction. */
  componentId: string;
  /** Outcome: PASS | FAIL | INVALID_RUN */
  outcome: "PASS" | "FAIL" | "INVALID_RUN" | "NOT_EVALUATED";
  /** Evidence / detail array (spec artifact paths). */
  evidence: string[];
}

/** Result of a full FOUNDATION_LAB milestone evaluation. */
export interface FoundationLabResult {
  /** Registry set ID from the suite evaluation. */
  registrySetId: string;
  /** Profile version. */
  profileVersion: string;
  /** Sub-component verdicts (ordered). */
  subComponents: SubComponentResult[];
  /** Whether every required HARD_INVARIANT passed. */
  allHardInvariantPass: boolean;
  /** Whether COMMON-DETERMINISTIC (two-run) passed. */
  commonDeterministicPass: boolean;
  /** Whether MUTANT_CORE passed. */
  mutantCorePass: boolean;
  /** Browser case results from the run. */
  browserCases: BrowserCaseResult[];
  /** The overall milestone verdict. */
  milestoneVerdict: "PASS" | "FAIL" | "INVALID_RUN";
  /** Human-readable details. */
  details: string;
}

// ---------------------------------------------------------------------------
// Verdict reduction helpers
// ---------------------------------------------------------------------------

/**
 * Compute the overall milestone verdict from the four sub-component results.
 *
 * Precedence (strongest → weakest):
 *   INVALID_RUN > FAIL > (all remaining must be PASS)
 */
function reduceMilestoneVerdict(
  subComponents: SubComponentResult[],
): { verdict: "PASS" | "FAIL" | "INVALID_RUN"; details: string } {
  const invalidRunComponents = subComponents.filter(
    (s): s is SubComponentResult => s.outcome === "INVALID_RUN",
  );
  const failComponents = subComponents.filter(
    (s): s is SubComponentResult => s.outcome === "FAIL",
  );

  // Every required sub-component must be PASS.
  // Precedence: INVALID_RUN > FAIL (strongest → weakest).
  if (invalidRunComponents.length > 0) {
    const ids = invalidRunComponents.map((c) => c.componentId).join(", ");
    return {
      verdict: "INVALID_RUN",
      details: `FOUNDATION_LAB INVALID_RUN: missing execution — ${ids}`,
    };
  }

  if (failComponents.length > 0) {
    const ids = failComponents.map((c) => c.componentId).join(", ");
    return {
      verdict: "FAIL",
      details: `FOUNDATION_LAB FAIL: ${failComponents.length} component(s) did not pass — ${ids}`,
    };
  }

  return {
    verdict: "PASS",
    details:
      "FOUNDATION_LAB PASS: all required HARD_INVARIANT criteria, browser cases, " +
      "COMMON_DETERMINISTIC, and MUTANT_CORE passed",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a scenario against the FOUNDATION_LAB milestone profile.
 *
 * Runs four sub-evaluators:
 *  1. evaluateFoundation — suite evaluation with HARD_INVARIANT criteria
 *  2. compareAndEvaluateFoundation — two-run COMMON-DETERMINISTIC check
 *  3. evaluateMutantCore — mutant detection
 *  4. Browser-case validation against headless reference hashes
 *
 * Reduces all four into a single milestone verdict.
 *
 * @param scenario — The scenario to evaluate.
 * @param opts — Evaluation options.
 * @returns FoundationLabResult with the milestone verdict.
 */
export function evaluateFoundationLab(
  scenario: ScenarioDefinition,
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
    /** Mutant-core skipMutationIds forwarded to evaluateMutantCore. */
    skipMutationIds?: string[];
  },
): FoundationLabResult {
  const { safetyBounds, browserCases, skipMutationIds } = opts ?? {};
  const registry = loadRegistrySet();
  const profile = registry.milestone_profiles["FOUNDATION_LAB"];

  // --- 1. Suite evaluation (HARD_INVARIANT criteria only) ---------------
  const suiteResult = evaluateFoundation(scenario, {
    safetyBounds,
    skipBrowserValidation: true, // browser validation handled below
  }) as FoundationEvalResult;

  const profileVersion = profile.profile_version;

  // --- 2. Browser-case validation against headless reference hashes ------
  const headless = generateHeadlessReferenceHashes(scenario);
  const browserResults = validateBrowserCases(
    browserCases,
    headless,
    profile,
  );

  // --- 3. COMMON-DETERMINISTIC (two-run comparison) ---------------------
  const compareResult = compareAndEvaluateFoundation(scenario, {
    safetyBounds,
  });

  const commonDeterministicOutcome: "PASS" | "FAIL" =
    compareResult.commonDeterministicOutcome === "PASS"
      ? "PASS"
      : "FAIL";

  const commonDeterministicComponent: SubComponentResult = {
    componentId: "COMMON-DETERMINISTIC",
    outcome: commonDeterministicOutcome,
    evidence: compareResult.commonDeterministicEvidence,
  };

  // --- 4. MUTANT_CORE evaluation -----------------------------------------
  const mutantResult = evaluateMutantCore({
    scenario,
    skipMutationIds,
  });

  const mutantCoreOutcome: "PASS" | "FAIL" | "INVALID_RUN" =
    mutantResult.verdict === "PASS"
      ? "PASS"
      : mutantResult.verdict === "INVALID_RUN"
        ? "INVALID_RUN"
        : "FAIL";

  const mutantCoreComponent: SubComponentResult = {
    componentId: "MUTANT_CORE",
    outcome: mutantCoreOutcome,
    evidence: [mutantResult.details],
  };

  // --- 5. HARD_INVARIANT reduction ----------------------------------------
  // Collect all HARD_INVARIANT criteria across required suites,
  // excluding COMMON-DETERMINISTIC (handled by the two-run check).
  const allHardInvariantCriteria: Array<{
    criterionId: string;
    outcome: string;
  }> = [];

  for (const suite of suiteResult.suites) {
    const suiteDef = registry.suite_definitions[suite.suite_id];
    if (!suiteDef) continue;

    for (const test of suite.tests) {
      for (const criterion of test.criteria) {
        // Skip COMMON-DETERMINISTIC — it's evaluated by the two-run
        // COMMON-DETERMINISTIC check and always NOT_EVALUATED in single-run.
        if (criterion.criterion_id === "COMMON-DETERMINISTIC") continue;
        if (criterion.class === "HARD_INVARIANT") {
          allHardInvariantCriteria.push({
            criterionId: criterion.criterion_id,
            outcome: criterion.outcome,
          });
        }
      }
    }
  }

  const allHardInvariantPass = allHardInvariantCriteria.every(
    (c) => c.outcome === "PASS",
  );

  // --- 6. Verdict reduction ----------------------------------------------
  const subComponents: SubComponentResult[] = [
    browserResults,
    commonDeterministicComponent,
    mutantCoreComponent,
    {
      componentId: "HARD_INVARIANT_SUITES",
      outcome: allHardInvariantPass ? "PASS" : "FAIL",
      evidence: allHardInvariantCriteria.map(
        (c) => `${c.criterionId}=${c.outcome}`,
      ),
    },
  ];

  // Include a "suite reduction" sub-component for inspection (not required).
  subComponents.push({
    componentId: "SUITES_OVERALL",
    outcome: mapToSubComponentOutcome(computeSuiteReduction(suiteResult)),
    evidence: [
      `suites=${suiteResult.suites.map((s) => s.suite_id).join(",")}`,
    ],
  });

  // The overall milestone verdict considers only the four required
  // components: browser cases, COMMON-DETERMINISTIC, MUTANT_CORE,
  // and HARD_INVARIANT suite criteria.
  const requiredComponents = subComponents.filter(
    (c) =>
      c.componentId === "BROWSER_CASES" ||
      c.componentId === "COMMON-DETERMINISTIC" ||
      c.componentId === "MUTANT_CORE" ||
      c.componentId === "HARD_INVARIANT_SUITES",
  );

  const { verdict, details } = reduceMilestoneVerdict(requiredComponents);

  return {
    registrySetId: suiteResult.registry_set_id,
    profileVersion,
    subComponents,
    allHardInvariantPass,
    commonDeterministicPass: commonDeterministicOutcome === "PASS",
    mutantCorePass: mutantCoreOutcome === "PASS",
    browserCases: browserCases ?? [],
    milestoneVerdict: verdict,
    details,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate headless reference hashes from a scenario using the simulation core.
 * Used by browser evidence cross-check.
 */
function generateHeadlessReferenceHashes(
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
 * Validate required browser cases for a profile.
 *
 * Checks:
 *  1. All case_ids are known (registered).
 *  2. All required case_ids are present in results.
 *  3. Every required case has valid evidence matching headless hashes.
 *  4. Every required case has passed === true.
 *
 * @param browserCases - Browser case results from a browser evaluation run.
 * @param headless - Headless reference hashes from the same scenario.
 * @param profile - The milestone profile to check.
 * @returns SubComponentResult with outcome INVALID_RUN or PASS.
 */
function validateBrowserCases(
  browserCases: BrowserCaseResult[] | undefined,
  headless: { initialHash: string; perTickHashes: string[] },
  profile: { required_browser_case_ids: string[] },
): SubComponentResult {
  const cases = browserCases ?? [];
  const requiredIds = profile.required_browser_case_ids;

  // Check required case_ids are present.
  const missingIds: string[] = [];
  for (const id of requiredIds) {
    if (!cases.find((r: BrowserCaseResult) => r.case_id === id)) {
      missingIds.push(id);
    }
  }

  if (missingIds.length > 0) {
    return {
      componentId: "BROWSER_CASES",
      outcome: "INVALID_RUN",
      evidence: [`Missing required browser case(s): ${missingIds.join(", ")}`],
    };
  }

  // Cross-check evidence against headless hashes.
  for (const result of cases) {
    if (
      typeof result.evidence !== "object" ||
      result.evidence === null ||
      typeof result.evidence.initialHash !== "string" ||
      result.evidence.initialHash.length === 0
    ) {
      return {
        componentId: "BROWSER_CASES",
        outcome: "INVALID_RUN",
        evidence: [
          `Missing or empty initialHash for case "${result.case_id}"`,
        ],
      };
    }

    // Cross-check initialHash against headless reference.
    if (result.evidence.initialHash !== headless.initialHash) {
      return {
        componentId: "BROWSER_CASES",
        outcome: "INVALID_RUN",
        evidence: [
          `Evidence initialHash does not match headless reference for case "${result.case_id}"`,
        ],
      };
    }

    // Cross-check perTickHashes if present.
    if (
      result.evidence.perTickHashes !== undefined &&
      result.evidence.perTickHashes.length > 0
    ) {
      if (!Array.isArray(result.evidence.perTickHashes)) {
        return {
          componentId: "BROWSER_CASES",
          outcome: "INVALID_RUN",
          evidence: [
            `perTickHashes must be an array for case "${result.case_id}"`,
          ],
        };
      }
      for (let i = 0; i < result.evidence.perTickHashes.length; i++) {
        if (
          typeof result.evidence.perTickHashes[i] !== "string" ||
          result.evidence.perTickHashes[i].length === 0
        ) {
          return {
            componentId: "BROWSER_CASES",
            outcome: "INVALID_RUN",
            evidence: [
              `Empty perTickHash entry at index ${i} for case "${result.case_id}"`,
            ],
          };
        }
        if (result.evidence.perTickHashes[i] !== headless.perTickHashes[i]) {
          return {
            componentId: "BROWSER_CASES",
            outcome: "INVALID_RUN",
            evidence: [
              `Per-tick hash mismatch at tick ${i} for case "${result.case_id}"`,
            ],
          };
        }
      }
    }

    // Evidence is valid — check pass status.
    if (!result.passed) {
      return {
        componentId: "BROWSER_CASES",
        outcome: "FAIL",
        evidence: [
          `Required browser case "${result.case_id}" has passed:false`,
        ],
      };
    }
  }

  return {
    componentId: "BROWSER_CASES",
    outcome: "PASS",
    evidence: [
      `All ${requiredIds.length} required browser case(s) validated`,
    ],
  };
}

/**
 * Compute the suite reduction outcome from evaluateFoundation result.
 * Used for inspection only (not part of required milestone components).
 * Returns an EvaluationOutcome (full spec range).
 */
function computeSuiteReduction(
  suiteResult: FoundationEvalResult,
): EvaluationOutcome {
  const testOutcomes = suiteResult.suites.flatMap((s) =>
    s.tests.map((t) => t.overall),
  );

  if (testOutcomes.includes("FAIL")) return "FAIL";
  if (testOutcomes.includes("PASS")) return "PASS";
  if (testOutcomes.includes("BLOCKED_MISSING_REFERENCE"))
    return "BLOCKED_MISSING_REFERENCE";
  if (testOutcomes.includes("NOT_EVALUATED")) return "NOT_EVALUATED";
  return "NOT_EVALUATED";
}

/**
 * Map an EvaluationOutcome to a SubComponentResult outcome.
 * BLOCKED_MISSING_REFERENCE → NOT_EVALUATED for inspection purposes.
 */
function mapToSubComponentOutcome(
  outcome: EvaluationOutcome,
): "PASS" | "FAIL" | "INVALID_RUN" | "NOT_EVALUATED" {
  if (outcome === "PASS") return "PASS";
  if (outcome === "FAIL") return "FAIL";
  if (outcome === "INVALID_RUN") return "INVALID_RUN";
  return "NOT_EVALUATED";
}