/**
 * @module @pes/eval/runners/playable-evaluator
 *
 * Evaluates the PLAYABLE_1V1 milestone profile.
 *
 * Architecture:
 *  1. Evaluate HARD_INVARIANT suites (using evaluateFoundation for the
 *     existing suites: fast, locomotion, ball).
 *  2. COMMON-DETERMINISTIC two-run comparison via compareAndEvaluateFoundation.
 *  3. Check for missing required suites (touch_and_actions, duels).
 *  4. Evaluate ENGINE_DESIGN_TARGET via evaluateCapabilityDesign.
 *  5. Validate required browser cases.
 *     - ARCH-DIFF-001 is special: it is a PERCEPTUAL_TARGET case that
 *       returns NEEDS_PERCEPTUAL_REVIEW when evidence is missing or
 *       the case is not yet executable.  This MUST prevent an overall
 *       PLAYABLE_1V1_PASS / milestoneVerdict PASS.
 *     - BROWSER-1V1-CONTROL-001 is required; without evidence → INVALID_RUN.
 *  6. Check entry and exit prerequisites.
 *  7. Prerequisites satisfaction check.
 *  8. Reduce verdict using spec precedence:
 *     INVALID_RUN > FAIL > NEEDS_PERCEPTUAL_REVIEW
 *       > BLOCKED_MISSING_REFERENCE > NOT_EVALUATED > PASS
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type {
  BrowserCaseResult,
  EvaluationOutcome,
} from "../contracts/types.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

import { evaluateFoundation } from "./foundation-evaluator.js";
import { evaluateCapabilityDesign } from "./evaluate-capability-design.js";
import { loadRegistrySet } from "../contracts/loader.js";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import {
  PLAYABLE_1V1_PROFILE,
  getMilestoneProfile,
} from "../contracts/profiles.js";
import { BROWSER_CASES } from "../contracts/browser-cases.js";
import { evaluateMutant1v1 } from "./mutant-1v1.js";
import { evaluateArchetypeComparison } from "./archetype-comparison.js";
import { runArchDiff001 } from "./arch-diff-001-evaluator.js";
import { compareAndEvaluateFoundation } from "./compare-foundation.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Verdict for a sub-evaluation component.
 */
export interface SubComponentResult {
  componentId: string;
  outcome: "PASS" | "FAIL" | "INVALID_RUN" | "NOT_EVALUATED" | "NEEDS_PERCEPTUAL_REVIEW" | "BLOCKED_MISSING_REFERENCE";
  evidence: string[];
}

/**
 * Result of a PLAYABLE_1V1 milestone evaluation.
 */
export interface Playable1v1Result {
  registrySetId: string;
  profileVersion: string;
  /** Sub-component verdicts (ordered by evaluation order). */
  subComponents: SubComponentResult[];
  /** Whether all required HARD_INVARIANT criteria passed. */
  allHardInvariantPass: boolean;
  /** ENGINE_DESIGN_TARGET evaluation result. */
  engineDesignTargetOverall: "PASS" | "FAIL" | "NOT_EVALUATED" | "DEFERRED" | "INVALID_RUN";
  /** Browser case evaluation results. */
  browserCases: BrowserCaseResult[];
  /** Per-browser-case verdicts (including special handling for ARCH-DIFF-001). */
  browserCaseVerdicts: Array<{ case_id: string; verdict: EvaluationOutcome }>;
  /** Whether entry prerequisites are satisfied. */
  entryPrerequisitesSatisfied: boolean;
  /** Whether exit prerequisites are satisfied. */
  exitPrerequisitesSatisfied: boolean;
  /** The overall milestone verdict. */
  milestoneVerdict: "PASS" | "FAIL" | "INVALID_RUN" | "NOT_EVALUATED" | "NEEDS_PERCEPTUAL_REVIEW" | "BLOCKED_MISSING_REFERENCE";
  /** Human-readable details. */
  details: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
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
 * Validate required browser cases for the PLAYABLE_1V1 profile.
 *
 * Handles ARCH-DIFF-001 specially: it is a PERCEPTUAL_TARGET case
 * that returns NEEDS_PERCEPTUAL_REVIEW when evidence is missing or
 * the case is not yet executable.
 *
 * @param browserCases - Browser case results from a browser evaluation run.
 * @param headless - Headless reference hashes from the profile scenario.
 * @param perCaseHeadless - Optional per-case headless references (e.g. two-player
 *   hashes for BROWSER-1V1-CONTROL-001 which was captured from a different scenario).
 * @returns Verdicts per case.
 */
function validateBrowserCasesFor1v1(
  browserCases: BrowserCaseResult[],
  headless: { initialHash: string; perTickHashes: string[] },
  perCaseHeadless?: Record<string, { initialHash: string; perTickHashes: string[] }>,
): Array<{ case_id: string; verdict: EvaluationOutcome }> {
  const profile = PLAYABLE_1V1_PROFILE;
  const requiredIds = profile.required_browser_case_ids;
  const verdicts: Array<{ case_id: string; verdict: EvaluationOutcome }> = [];

  for (const caseId of requiredIds) {
    const def = BROWSER_CASES[caseId];

    // Check if this is the special ARCH-DIFF-001 case.
    if (caseId === "ARCH-DIFF-001") {
      // ARCH-DIFF-001 is a PERCEPTUAL_TARGET case evaluated via
      // the versioned rubric against committed disk artifacts.
      try {
        const archResult = runArchDiff001({ useDiskArtifacts: true });
        verdicts.push({ case_id: caseId, verdict: archResult.verdict as EvaluationOutcome });
        continue;
      } catch {
        // No artifacts found — falls through to NEEDS_PERCEPTUAL_REVIEW.
        verdicts.push({ case_id: caseId, verdict: "NEEDS_PERCEPTUAL_REVIEW" });
        continue;
      }
    }

    // For non-special required cases, use standard browser validation.
    const found = browserCases.find((r) => r.case_id === caseId);
    if (!found) {
      // Missing required case → INVALID_RUN.
      verdicts.push({ case_id: caseId, verdict: "INVALID_RUN" });
      continue;
    }

    // Check for unknown case_id.
    if (!(caseId in BROWSER_CASES)) {
      verdicts.push({ case_id: caseId, verdict: "INVALID_RUN" });
      continue;
    }

    // Cross-check evidence against headless reference.
    if (typeof found.evidence !== "object" || found.evidence === null) {
      verdicts.push({ case_id: caseId, verdict: "INVALID_RUN" });
      continue;
    }

    if (typeof found.evidence.initialHash !== "string" || found.evidence.initialHash.length === 0) {
      verdicts.push({ case_id: caseId, verdict: "INVALID_RUN" });
      continue;
    }

    // Use per-case headless reference when available (e.g. two-player scenario
    // for BROWSER-1V1-CONTROL-001), otherwise fall back to the profile scenario.
    const refHeadless = perCaseHeadless?.[caseId] ?? headless;

    if (found.evidence.initialHash !== refHeadless.initialHash) {
      verdicts.push({ case_id: caseId, verdict: "INVALID_RUN" });
      continue;
    }

    if (found.evidence.perTickHashes !== undefined && found.evidence.perTickHashes.length > 0) {
      if (!Array.isArray(found.evidence.perTickHashes)) {
        verdicts.push({ case_id: caseId, verdict: "INVALID_RUN" });
        continue;
      }
      for (let i = 0; i < found.evidence.perTickHashes.length; i++) {
        if (typeof found.evidence.perTickHashes[i] !== "string" || found.evidence.perTickHashes[i].length === 0) {
          verdicts.push({ case_id: caseId, verdict: "INVALID_RUN" });
          continue;
        }
        if (found.evidence.perTickHashes[i] !== refHeadless.perTickHashes[i]) {
          verdicts.push({ case_id: caseId, verdict: "INVALID_RUN" });
          continue;
        }
      }
      if (verdicts[verdicts.length - 1]?.case_id === caseId && verdicts[verdicts.length - 1]?.verdict === "INVALID_RUN") {
        continue;
      }
    }

    // Evidence is valid — check pass status.
    if (!found.passed) {
      verdicts.push({ case_id: caseId, verdict: "FAIL" });
      continue;
    }

    verdicts.push({ case_id: caseId, verdict: "PASS" });
  }

  return verdicts;
}

/**
 * Check for missing required suites.
 * @returns Array of sub-component results for missing suites.
 */
function checkMissingSuites(
  requiredSuiteIds: string[],
): SubComponentResult[] {
  const registry = loadRegistrySet();
  const results: SubComponentResult[] = [];

  for (const suiteId of requiredSuiteIds) {
    if (!(suiteId in registry.suite_definitions)) {
      results.push({
        componentId: `MISSING_SUITE:${suiteId}`,
        outcome: "INVALID_RUN",
        evidence: [
          `Required suite "${suiteId}" is not defined in the registry`,
        ],
      });
    }
  }

  return results;
}

/**
 * Validate exit prerequisites for PLAYABLE_1V1.
 * Returns sub-component results for each exit prerequisite.
 */
function checkExitPrerequisites(
  profile: typeof PLAYABLE_1V1_PROFILE,
): SubComponentResult[] {
  const results: SubComponentResult[] = [];

  for (const prereq of profile.exit_prerequisites) {
    if (prereq === "MUTANT_1V1_PASS") {
      // Execute the 1v1 mutant reduction to determine if the exit prerequisite
      // is satisfied.  This is an executable evaluation — it can PASS or FAIL.
      try {
        const mutantResult = evaluateMutant1v1();
        results.push({
          componentId: `EXIT_PREREQ:${prereq}`,
          outcome: mutantResult.verdict as SubComponentResult["outcome"],
          evidence: [
            `MUTANT_1V1 reduction verdict: ${mutantResult.verdict}`,
            `Implementable mutants detected: ${mutantResult.allImplementedDetected}`,
            `Deferred mutants NOT_EVALUATED: ${mutantResult.allDeferredNotEvaluated}`,
            mutantResult.details,
          ],
        });
      } catch (err) {
        results.push({
          componentId: `EXIT_PREREQ:${prereq}`,
          outcome: "INVALID_RUN",
          evidence: [
            `MUTANT_1V1 reduction threw an error: ${err instanceof Error ? err.message : String(err)}`,
          ],
        });
      }
    } else if (prereq === "ARCHETYPE_BLINDED_COMPARISON_PASS") {
      // ARCHETYPE_BLINDED_COMPARISON_PASS is a perceptual evaluation
      // that uses real browser-captured artifacts from disk.  When
      // artifacts exist, runs the rubric reduction; when they do not,
      // returns NOT_EVALUATED (no theatrical always-PASS).
      try {
        const archetypeResult = evaluateArchetypeComparison({
          useDiskArtifacts: true,
        });
        const outcome = archetypeResult.verdict as SubComponentResult["outcome"];
        results.push({
          componentId: `EXIT_PREREQ:${prereq}`,
          outcome,
          evidence: [
            `ARCHETYPE_BLINDED_COMPARISON verdict: ${archetypeResult.verdict}`,
            `All pairs detectable: ${archetypeResult.allDetectable}`,
            `Min confidence: ${archetypeResult.minConfidence}`,
            ...archetypeResult.pairs.map(
              (p) =>
                `${p.pair.archetype_a} vs ${p.pair.archetype_b}: diff=${p.hashDiffRatio.toFixed(4)} detectable=${p.detectable}`,
            ),
            archetypeResult.verdict === "NOT_EVALUATED"
              ? "Perceptual rubric evaluation: no real artifact hashes available — deferred until browser capture produces frames"
              : archetypeResult.verdict === "PASS"
                ? "Perceptual rubric: all archetype pairs are perceptually distinguishable"
                : "Perceptual rubric: some archetype pairs are not perceptually distinguishable",
          ],
        });
      } catch (err) {
        results.push({
          componentId: `EXIT_PREREQ:${prereq}`,
          outcome: "NOT_EVALUATED",
          evidence: [
            `ARCHETYPE_BLINDED_COMPARISON threw an error: ${err instanceof Error ? err.message : String(err)}`,
          ],
        });
      }
    } else {
      // Unknown exit prerequisite — treat as NOT_EVALUATED.
      results.push({
        componentId: `EXIT_PREREQ:${prereq}`,
        outcome: "NOT_EVALUATED",
        evidence: [`Exit prerequisite "${prereq}" has no evaluation path`],
      });
    }
  }

  return results;
}

/**
 * Validate entry prerequisites for PLAYABLE_1V1.
 *
 * Entry prerequisite outcomes are supplied by the caller via
 * `entryPrereqOutcomes`.  Accepted values are the standard
 * EvaluationOutcome enum.  When a name is not present in the map,
 * the outcome is BLOCKED_MISSING_REFERENCE (not NOT_EVALUATED)
 * so the caller can distinguish "known unverified" from
 * "evidence directory missing".
 *
 * @param profile — The milestone profile defining entry prerequisites.
 * @param entryPrereqOutcomes — Map from prerequisite name → outcome.
 *   Only populated when the caller has verified evidence and wants
 *   to override the default BLOCKED_MISSING_REFERENCE.
 * @returns Sub-component results for each entry prerequisite.
 */
function checkEntryPrerequisites(
  profile: typeof PLAYABLE_1V1_PROFILE,
  entryPrereqOutcomes?: Record<string, SubComponentResult["outcome"]>,
): SubComponentResult[] {
  const results: SubComponentResult[] = [];

  for (const prereq of profile.entry_prerequisites) {
    const provided = entryPrereqOutcomes?.[prereq];
    if (provided) {
      // Caller-supplied verified outcome.
      results.push({
        componentId: `ENTRY_PREREQ:${prereq}`,
        outcome: provided,
        evidence: [
          `Entry prerequisite verified by caller: ${prereq} → ${provided}`,
        ],
      });
    } else {
      // No accepted evidence for this prerequisite.
      results.push({
        componentId: `ENTRY_PREREQ:${prereq}`,
        outcome: "BLOCKED_MISSING_REFERENCE",
        evidence: [
          `Entry prerequisite "${prereq}" has no accepted evidence directory — BLOCKED_MISSING_REFERENCE`,
        ],
      });
    }
  }

  return results;
}

/**
 * Compute the overall verdict from sub-component results.
 *
 * Precedence (strongest → weakest):
 *   INVALID_RUN > FAIL > NEEDS_PERCEPTUAL_REVIEW
 *     > BLOCKED_MISSING_REFERENCE > NOT_EVALUATED > PASS
 */
function computeOverallVerdict(
  subComponents: SubComponentResult[],
): "PASS" | "FAIL" | "INVALID_RUN" | "NOT_EVALUATED" | "NEEDS_PERCEPTUAL_REVIEW" | "BLOCKED_MISSING_REFERENCE" {
  const outcomes = new Set(subComponents.map((c) => c.outcome));

  if (outcomes.has("INVALID_RUN")) return "INVALID_RUN";
  if (outcomes.has("FAIL")) return "FAIL";
  if (outcomes.has("NEEDS_PERCEPTUAL_REVIEW")) return "NEEDS_PERCEPTUAL_REVIEW";
  if (outcomes.has("BLOCKED_MISSING_REFERENCE")) return "BLOCKED_MISSING_REFERENCE";
  if (outcomes.has("NOT_EVALUATED")) return "NOT_EVALUATED";

  return "PASS";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a scenario against the PLAYABLE_1V1 milestone profile.
 *
 * Runs:
 *  1. Suite evaluation for existing required suites (fast, locomotion, ball).
 *  2. COMMON-DETERMINISTIC two-run comparison via compareAndEvaluateFoundation.
 *  3. Checks for missing required suites (touch_and_actions, duels).
 *  4. ENGINE_DESIGN_TARGET evaluation via evaluateCapabilityDesign.
 *  5. Browser case validation (including special handling for ARCH-DIFF-001).
 *  6. Entry and exit prerequisite checks.
 *  7. Prerequisites satisfaction check.
 *  8. Verdict reduction.
 *
 * @param scenario — The scenario to evaluate.
 * @param opts — Evaluation options.
 * @returns Playable1v1Result with the milestone verdict.
 */
export function evaluatePlayable1v1(
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
    /** Two-player scenario for BROWSER-1V1-CONTROL-001 cross-check.
     *  The accepted evidence was captured from the two-player scenario,
     *  so the evaluator must use its headless hashes for that case. */
    twoPlayerScenario?: ScenarioDefinition;
    /** Caller-supplied entry-prerequisite outcomes from accepted evidence.
     *  Keyed by prerequisite name (e.g. "FOUNDATION_LAB_PASS").
     *  Values are standard EvaluationOutcome strings.
     *  When absent, unverified prerequisites default to
     *  BLOCKED_MISSING_REFERENCE. */
    entryPrereqOutcomes?: Record<string, SubComponentResult["outcome"]>;
  },
): Playable1v1Result {
  const { safetyBounds, browserCases, twoPlayerScenario, entryPrereqOutcomes } =
    opts ?? {};
  const registry = loadRegistrySet();
  const profile = PLAYABLE_1V1_PROFILE;

  const subComponents: SubComponentResult[] = [];
  let hasMissingSuites = false;

  // --- 1. Suite evaluation (HARD_INVARIANT criteria) ---------------------
  const headlessRef = generateHeadlessReferenceHashes(scenario);
  const browserResults = browserCases ?? [];

  const suiteEvaluation = evaluateFoundation(scenario, {
    safetyBounds,
    skipBrowserValidation: true,
  });

  // Collect HARD_INVARIANT results from suites.
  // COMMON-DETERMINISTIC is NOT_EVALUATED in single-run suite evaluation,
  // so we add the two-run comparison result below.
  const allHardInvariantCriteria: Array<{
    criterionId: string;
    outcome: string;
  }> = [];

  for (const suite of suiteEvaluation.suites) {
    for (const test of suite.tests) {
      for (const criterion of test.criteria) {
        if (criterion.class === "HARD_INVARIANT") {
          allHardInvariantCriteria.push({
            criterionId: criterion.criterion_id,
            outcome: criterion.outcome,
          });
        }
      }
    }
  }

  // --- 2. COMMON-DETERMINISTIC (two-run comparison) ----------------------
  const compareResult = compareAndEvaluateFoundation(scenario, {
    safetyBounds,
  });
  const commonDeterministicOutcome =
    compareResult.commonDeterministicOutcome === "PASS"
      ? "PASS"
      : "FAIL";

  // Replace all single-run COMMON-DETERMINISTIC entries (NOT_EVALUATED)
  // with the resolved two-run outcome.
  for (const c of allHardInvariantCriteria) {
    if (c.criterionId === "COMMON-DETERMINISTIC") {
      c.outcome = commonDeterministicOutcome;
    }
  }

  const allHardInvariantPass = allHardInvariantCriteria.every(
    (c) => c.outcome === "PASS",
  );

  // Check if HARD_INVARIANT suites evaluated to non-PASS.
  const suiteOutcomes = suiteEvaluation.suites.flatMap((s) =>
    s.tests.map((t) => t.overall),
  );
  let suiteReduction: "PASS" | "FAIL" | "NOT_EVALUATED" | "INVALID_RUN" | "BLOCKED_MISSING_REFERENCE" = "NOT_EVALUATED";
  if (suiteOutcomes.includes("FAIL")) {
    suiteReduction = "FAIL";
  } else if (suiteOutcomes.includes("PASS")) {
    suiteReduction = "PASS";
  } else if (suiteOutcomes.includes("INVALID_RUN")) {
    suiteReduction = "INVALID_RUN";
  } else if (suiteOutcomes.includes("BLOCKED_MISSING_REFERENCE")) {
    suiteReduction = "BLOCKED_MISSING_REFERENCE";
  }

  subComponents.push({
    componentId: "HARD_INVARIANT_SUITES",
    outcome: suiteReduction,
    evidence: allHardInvariantCriteria.map(
      (c) => `${c.criterionId}=${c.outcome}`,
    ),
  });

  // Add COMMON_DETERMINISTIC as a dedicated sub-component.
  subComponents.push({
    componentId: "COMMON_DETERMINISTIC",
    outcome: commonDeterministicOutcome,
    evidence: compareResult.commonDeterministicEvidence,
  });

  // --- 3. Missing required suites ----------------------------------------
  const missingSuiteResults = checkMissingSuites(profile.required_suite_ids);
  for (const ms of missingSuiteResults) {
    subComponents.push(ms);
    hasMissingSuites = true;
  }

  // --- 4. ENGINE_DESIGN_TARGET evaluation --------------------------------
  const capDesignResult = evaluateCapabilityDesign();
  const engineDesignTargetOverall = capDesignResult.overall;

  // Add ENGINE_DESIGN_TARGET component.
  subComponents.push({
    componentId: "ENGINE_DESIGN_TARGET",
    outcome: engineDesignTargetOverall,
    evidence: capDesignResult.axes.flatMap(
      (a) =>
        a.status === "DEFERRED"
          ? [`Axis "${a.axis_id}" is DEFERRED — outcome ${a.outcome}`]
          : [
              `Axis "${a.axis_id}" (IMPLEMENTED): outcome ${a.outcome}`,
              ...a.evidence,
            ],
    ),
  });

  // --- 5. Browser case validation -----------------------------------------
  // For BROWSER-1V1-CONTROL-001, the evidence was captured from the two-player
  // scenario, not the profile scenario. Use the caller-provided scenario.
  let perCaseHeadless: Record<string, { initialHash: string; perTickHashes: string[] }> = {};
  if (twoPlayerScenario) {
    perCaseHeadless["BROWSER-1V1-CONTROL-001"] = generateHeadlessReferenceHashes(twoPlayerScenario);
  }

  const browserCaseVerdicts = validateBrowserCasesFor1v1(
    browserResults,
    headlessRef,
    perCaseHeadless,
  );

  // Convert browser verdicts to sub-components.
  for (const bv of browserCaseVerdicts) {
    subComponents.push({
      componentId: `BROWSER_CASE:${bv.case_id}`,
      outcome: bv.verdict as SubComponentResult["outcome"],
      evidence: [`Browser case "${bv.case_id}" verdict: ${bv.verdict}`],
    });
  }

  // --- 6. Entry / exit prerequisites --------------------------------------
  const entryPrereqs = checkEntryPrerequisites(profile, entryPrereqOutcomes);
  const exitPrereqs = checkExitPrerequisites(profile);
  for (const ep of entryPrereqs) {
    subComponents.push(ep);
  }
  for (const ep of exitPrereqs) {
    subComponents.push(ep);
  }

  // --- 7. Check prerequisites satisfaction -------------------------------
  // Entry: all entry prereqs must be PASS or NOT_EVALUATED (for now).
  const entrySatisfied = entryPrereqs.every(
    (p) => p.outcome === "NOT_EVALUATED" || p.outcome === "PASS",
  );

  // Exit: all exit prereqs must be PASS (not NOT_EVALUATED).
  // Since they are NOT_EVALUATED, the overall will NOT be PASS.
  const exitSatisfied = exitPrereqs.every(
    (p) => p.outcome === "PASS",
  );

  // --- 8. Compute overall verdict ----------------------------------------
  const overallVerdict = computeOverallVerdict(subComponents);

  const details =
    overallVerdict === "PASS"
      ? "PLAYABLE_1V1 PASS: all required criteria passed"
      : [
          `Overall verdict: ${overallVerdict}`,
          ...subComponents.map(
            (s) => `  ${s.componentId}: ${s.outcome}`,
          ),
        ].join("\n");

  return {
    registrySetId: registry.registry_set_id,
    profileVersion: profile.profile_version,
    subComponents,
    allHardInvariantPass,
    engineDesignTargetOverall,
    browserCases: browserResults,
    browserCaseVerdicts,
    entryPrerequisitesSatisfied: entrySatisfied,
    exitPrerequisitesSatisfied: exitSatisfied,
    milestoneVerdict: overallVerdict,
    details,
  };
}