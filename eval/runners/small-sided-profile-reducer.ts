/**
 * @module eval/runners/small-sided-profile-reducer
 *
 * Evaluates exit prerequisites for the SMALL_SIDED_SHAPE milestone profile.
 *
 * Architecture (mirrors the existing PLAYABLE_1V1 exit-prereq pattern in
 * playable-evaluator.ts):
 *   1. For each exit_prerequisite in SMALL_SIDED_SHAPE_PROFILE.exit_prerequisites:
 *      - MUTANT_TEAM_PASS → runMutantTeamEval() → map milestoneVerdict
 *      - TEAM_SHAPE_SUITE_PASS → runTeamShapeEval() → map milestoneVerdict
 *   2. Unknown/unsupported prereqs → NOT_EVALUATED (no theatrical always-PASS).
 *
 * This module does NOT claim §2.3/§8 PROMOTION-tier reduction.
 * It only wires exit-prereq executability / audit-only honesty.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in the eval/tooling layer.
 */

import {
  runMutantTeamEval,
  type MutantTeamEvalResult,
} from "./mutant-team-eval-runner.js";
import {
  runTeamShapeEval,
  type TeamShapeEvalResult,
} from "./team-shape-eval-runner.js";
import {
  SMALL_SIDED_SHAPE_PROFILE,
  type MilestoneProfile,
} from "../contracts/profiles.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Verdict for a sub-evaluation component (same shape as playable-evaluator.ts).
 */
export interface SubComponentResult {
  componentId: string;
  outcome:
    | "PASS"
    | "FAIL"
    | "INVALID_RUN"
    | "NOT_EVALUATED"
    | "NEEDS_PERCEPTUAL_REVIEW"
    | "BLOCKED_MISSING_REFERENCE";
  evidence: string[];
}

/**
 * Result of a SMALL_SIDED_SHAPE exit-prerequisite evaluation.
 */
export interface SmallSidedProfileResult {
  /** Milestone profile ID. */
  milestoneId: string;
  /** Profile version. */
  profileVersion: string;
  /** Sub-component verdicts (ordered by evaluation order). */
  subComponents: SubComponentResult[];
  /** Whether all exit prerequisites are satisfied (all PASS). */
  allExitPrerequisitesSatisfied: boolean;
  /** The overall exit-prereq verdict. */
  overallVerdict:
    | "PASS"
    | "FAIL"
    | "INVALID_RUN"
    | "NOT_EVALUATED"
    | "NEEDS_PERCEPTUAL_REVIEW"
    | "BLOCKED_MISSING_REFERENCE";
  /** Human-readable details. */
  details: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map an underlying evaluator's milestoneVerdict to an exit-prereq outcome.
 *
 * The verdict is honest: it can PASS, FAIL, NOT_EVALUATED, or INVALID_RUN.
 * Never force a PASS for an unverified prerequisite.
 *
 * @param milestoneVerdict — The verdict from the underlying eval runner.
 * @returns The corresponding SubComponentResult outcome.
 */
function mapMilestoneVerdictToOutcome(
  milestoneVerdict: string,
): SubComponentResult["outcome"] {
  switch (milestoneVerdict) {
    case "PASS":
      return "PASS";
    case "FAIL":
      return "FAIL";
    case "NOT_EVALUATED":
      return "NOT_EVALUATED";
    case "INVALID_RUN":
      return "INVALID_RUN";
    default:
      return "NOT_EVALUATED";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate exit prerequisites for the SMALL_SIDED_SHAPE milestone profile.
 *
 * For each exit_prerequisite defined in SMALL_SIDED_SHAPE_PROFILE.exit_prerequisites,
 * this function runs the corresponding executable evaluator and maps its
 * milestone verdict to an honest outcome.
 *
 * Supported prerequisites:
 *   - MUTANT_TEAM_PASS       → runMutantTeamEval() → maps milestoneVerdict
 *   - TEAM_SHAPE_SUITE_PASS  → runTeamShapeEval()  → maps milestoneVerdict
 *
 * Unsupported/unknown prerequisites: NOT_EVALUATED with honest reason.
 *
 * This is NOT a §2.3/§8 PROMOTION-tier verdict. It only wires exit-prereq
 * executability / audit-only honesty.
 *
 * @param opts — Optional overrides (for testing).
 * @returns SmallSidedProfileResult with exit-prereq sub-component verdicts.
 */
export function evaluateSmallSidedProfile(
  opts?: {
    /** Override for the profile (defaults to SMALL_SIDED_SHAPE_PROFILE). */
    profile?: MilestoneProfile;
    /**
     * Override the team-shape eval result (for testing NOT_EVALUATED/FAIL paths).
     * When absent, the actual team-shape evaluator is invoked.
     */
    teamShapeOverride?: {
      milestoneVerdict: TeamShapeEvalResult["milestoneVerdict"];
      details: string;
    };
    /**
     * Override the mutant-team eval result (for testing NOT_EVALUATED/FAIL paths).
     * When absent, the actual mutant-team evaluator is invoked.
     */
    mutantTeamOverride?: {
      milestoneVerdict: MutantTeamEvalResult["milestoneVerdict"];
      details: string;
    };
  },
): SmallSidedProfileResult {
  const {
    profile = SMALL_SIDED_SHAPE_PROFILE,
    teamShapeOverride,
    mutantTeamOverride,
  } = opts ?? {};

  const subComponents: SubComponentResult[] = [];

  for (const prereq of profile.exit_prerequisites) {
    try {
      if (prereq === "MUTANT_TEAM_PASS") {
        // Execute the mutant team evaluation to determine if the exit
        // prerequisite is satisfied. This is an executable evaluation —
        // it can PASS, FAIL, NOT_EVALUATED, or INVALID_RUN.
        const mutantTeamResult: MutantTeamEvalResult = mutantTeamOverride
          ? {
              registryVersion: "mutant-team-v1",
              implementableCount: 0,
              deferredCount: 0,
              outcomes: [],
              allImplementedDetected: false,
              allDeferredNotEvaluated: false,
              anyInvalidRun: false,
              verdict: mutantTeamOverride.milestoneVerdict as MutantTeamEvalResult["verdict"],
              details: mutantTeamOverride.details,
              overall: mutantTeamOverride.milestoneVerdict,
              milestoneVerdict: mutantTeamOverride.milestoneVerdict,
              rationale: mutantTeamOverride.details,
              perMutant: [],
            }
          : runMutantTeamEval();

        const outcome = mapMilestoneVerdictToOutcome(mutantTeamResult.milestoneVerdict);

        subComponents.push({
          componentId: `EXIT_PREREQ:${prereq}`,
          outcome,
          evidence: [
            `MUTANT_TEAM_PASS reduction verdict: ${mutantTeamResult.milestoneVerdict}`,
            `Implementable mutants detected: ${mutantTeamResult.allImplementedDetected}`,
            `Deferred mutants NOT_EVALUATED: ${mutantTeamResult.allDeferredNotEvaluated}`,
            mutantTeamResult.details,
          ],
        });
      } else if (prereq === "TEAM_SHAPE_SUITE_PASS") {
        // TEAM_SHAPE_SUITE_PASS is an executable evaluation that runs the
        // team-shape evaluator against the 3v3 scenario. It can PASS, FAIL,
        // NOT_EVALUATED, or INVALID_RUN — never theatrical always-PASS.
        const teamShapeResult: TeamShapeEvalResult = teamShapeOverride
          ? {
              suiteId: "team",
              suiteVersion: "team-v1",
              testCount: 0,
              testResults: [],
              commonCriteriaCheck: [],
              allTestsPass: false,
              overall: teamShapeOverride.milestoneVerdict,
              milestoneVerdict: teamShapeOverride.milestoneVerdict,
              verdict: teamShapeOverride.milestoneVerdict,
              details: teamShapeOverride.details,
            }
          : runTeamShapeEval();

        const outcome = mapMilestoneVerdictToOutcome(teamShapeResult.milestoneVerdict);

        subComponents.push({
          componentId: `EXIT_PREREQ:${prereq}`,
          outcome,
          evidence: [
            `TEAM_SHAPE_SUITE_PASS verdict: ${teamShapeResult.milestoneVerdict}`,
            `All tests pass: ${teamShapeResult.allTestsPass}`,
            teamShapeResult.details,
          ],
        });
      } else {
        // Unknown exit prerequisite — treat as NOT_EVALUATED with honest reason.
        // Do NOT invent a PASS.
        subComponents.push({
          componentId: `EXIT_PREREQ:${prereq}`,
          outcome: "NOT_EVALUATED",
          evidence: [
            `Exit prerequisite "${prereq}" is not in the small-sided support list — NOT_EVALUATED`,
          ],
        });
      }
    } catch (err) {
      subComponents.push({
        componentId: `EXIT_PREREQ:${prereq}`,
        outcome: "INVALID_RUN",
        evidence: [
          `Exit prerequisite "${prereq}" evaluation threw: ${err instanceof Error ? err.message : String(err)}`,
        ],
      });
    }
  }

  // Compute overall verdict using the same precedence as playable-evaluator.ts.
  // Precedence (strongest → weakest):
  //   INVALID_RUN > FAIL > NEEDS_PERCEPTUAL_REVIEW
  //     > BLOCKED_MISSING_REFERENCE > NOT_EVALUATED > PASS
  let overallVerdict: SmallSidedProfileResult["overallVerdict"] = "PASS";
  const outcomes = new Set(subComponents.map((c) => c.outcome));

  if (outcomes.has("INVALID_RUN")) overallVerdict = "INVALID_RUN";
  else if (outcomes.has("FAIL")) overallVerdict = "FAIL";
  else if (outcomes.has("NEEDS_PERCEPTUAL_REVIEW"))
    overallVerdict = "NEEDS_PERCEPTUAL_REVIEW";
  else if (outcomes.has("BLOCKED_MISSING_REFERENCE"))
    overallVerdict = "BLOCKED_MISSING_REFERENCE";
  else if (outcomes.has("NOT_EVALUATED")) overallVerdict = "NOT_EVALUATED";

  const allPass = subComponents.every((c) => c.outcome === "PASS");

  return {
    milestoneId: profile.milestone_id,
    profileVersion: profile.profile_version,
    subComponents,
    allExitPrerequisitesSatisfied: allPass,
    overallVerdict,
    details: `SMALL_SIDED_SHAPE exit-prereq evaluation: ${subComponents.length} prerequisite(s) checked, overall: ${overallVerdict}`,
  };
}