/**
 * @module @pes/eval/runners/playable-1v1-profile-runner
 *
 * Standalone runner for the PLAYABLE_1V1 profile evaluation.
 *
 * Runs the existing playable-evaluator against a scenario, evaluates
 * all exit prerequisites (MUTANT_1V1_PASS, ARCHETYPE_BLINDED_COMPARISON_PASS),
 * and produces structured JSON output for the Gauntlet.
 *
 * Node I/O is allowed in the eval layer.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluatePlayable1v1, type Playable1v1Result } from "./playable-evaluator.js";
import { evaluateMutant1v1 } from "./mutant-1v1.js";
import { evaluateArchetypeComparison } from "./archetype-comparison.js";
import { PLAYABLE_1V1_PROFILE } from "../contracts/profiles.js";
import { loadRegistrySet } from "../contracts/loader.js";
import { evaluate } from "./evaluate.js";

import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A sub-component verdict in the structured result.
 */
export interface ProfileEvalComponent {
  componentId: string;
  outcome: string;
  evidence: string[];
}

/**
 * Structured evaluation result for the PLAYABLE_1V1 profile.
 */
export interface Playable1v1ProfileResult {
  /** The scenario file used. */
  scenarioFile: string;
  /** The registry set ID. */
  registrySetId: string;
  /** The profile version. */
  profileVersion: string;
  /** The milestone verdict. */
  milestoneVerdict: string;
  /** All sub-component verdicts. */
  subComponents: ProfileEvalComponent[];
  /** Whether all HARD_INVARIANT criteria passed. */
  allHardInvariantPass: boolean;
  /** ENGINE_DESIGN_TARGET evaluation result. */
  engineDesignTargetOverall: string;
  /** Entry prerequisite outcomes. */
  entryPrerequisites: Array<{ name: string; outcome: string }>;
  /** Exit prerequisite outcomes. */
  exitPrerequisites: Array<{ name: string; outcome: string; details: string }>;
  /** Browser case verdicts. */
  browserCaseVerdicts: Array<{ case_id: string; verdict: string }>;
  /** Whether entry prerequisites are satisfied. */
  entryPrerequisitesSatisfied: boolean;
  /** Whether exit prerequisites are satisfied. */
  exitPrerequisitesSatisfied: boolean;
  /** Blocked criteria (if any). */
  blockers: string[];
  /** Human-readable details. */
  details: string;
  /** Evaluation timestamp (ISO). */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Run the full PLAYABLE_1V1 profile evaluation and return structured result.
 */
function runProfileEvaluation(
  scenario: ScenarioDefinition,
  scenarioFile: string,
): Playable1v1ProfileResult {
  const registry = loadRegistrySet();
  const result = evaluatePlayable1v1(scenario);

  // Extract exit prerequisites with details.
  const exitPrereqs = PLAYABLE_1V1_PROFILE.exit_prerequisites;
  const exitPrereqDetails: Array<{ name: string; outcome: string; details: string }> = [];

  for (const prereq of exitPrereqs) {
    const subComp = result.subComponents.find(
      (s) => s.componentId === `EXIT_PREREQ:${prereq}`,
    );
    if (subComp) {
      exitPrereqDetails.push({
        name: prereq,
        outcome: subComp.outcome,
        details: subComp.evidence.join("\n"),
      });
    }
  }

  // Extract entry prerequisites.
  const entryPrereqs = PLAYABLE_1V1_PROFILE.entry_prerequisites;
  const entryPrereqDetails: Array<{ name: string; outcome: string }> = [];

  for (const prereq of entryPrereqs) {
    const subComp = result.subComponents.find(
      (s) => s.componentId === `ENTRY_PREREQ:${prereq}`,
    );
    if (subComp) {
      entryPrereqDetails.push({
        name: prereq,
        outcome: subComp.outcome,
      });
    }
  }

  // Identify blockers (non-PASS exit prereqs or HARD_INVARIANT failures).
  const blockers: string[] = [];
  for (const ep of exitPrereqDetails) {
    if (ep.outcome !== "PASS") {
      blockers.push(
        `Exit prerequisite "${ep.name}" is ${ep.outcome}`,
      );
    }
  }
  if (!result.allHardInvariantPass) {
    blockers.push("Not all HARD_INVARIANT criteria passed");
  }
  for (const bc of result.browserCaseVerdicts) {
    if (bc.verdict === "NEEDS_PERCEPTUAL_REVIEW") {
      blockers.push(`Browser case "${bc.case_id}" needs perceptual review`);
    } else if (bc.verdict === "FAIL") {
      blockers.push(`Browser case "${bc.case_id}" failed`);
    } else if (bc.verdict === "INVALID_RUN") {
      blockers.push(`Browser case "${bc.case_id}" is INVALID_RUN`);
    }
  }

  return {
    scenarioFile,
    registrySetId: result.registrySetId,
    profileVersion: result.profileVersion,
    milestoneVerdict: result.milestoneVerdict,
    subComponents: result.subComponents.map((s) => ({
      componentId: s.componentId,
      outcome: s.outcome,
      evidence: s.evidence,
    })),
    allHardInvariantPass: result.allHardInvariantPass,
    engineDesignTargetOverall: result.engineDesignTargetOverall,
    entryPrerequisites: entryPrereqDetails,
    exitPrerequisites: exitPrereqDetails,
    browserCaseVerdicts: result.browserCaseVerdicts.map((v) => ({
      case_id: v.case_id,
      verdict: v.verdict,
    })),
    entryPrerequisitesSatisfied: result.entryPrerequisitesSatisfied,
    exitPrerequisitesSatisfied: result.exitPrerequisitesSatisfied,
    blockers,
    details: result.details,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Run the PLAYABLE_1V1 profile evaluation.
 *
 * Usage:
 *   tsx eval/runners/playable-1v1-profile-runner.ts [scenario-file]
 *
 * If no scenario file is given, defaults to foundation-move-and-roll.v1.json.
 * Outputs structured JSON to stdout.
 */
export function main(scenarioPath?: string): Playable1v1ProfileResult {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const defaultPath = join(__dirname, "../scenarios/foundation-move-and-roll.v1.json");
  const resolvedPath = scenarioPath ?? defaultPath;

  console.error(`[profile-runner] Evaluating scenario: ${resolvedPath}`);

  // Load the scenario.
  const raw = readFileSync(resolvedPath, "utf-8");
  const scenario = JSON.parse(raw) as ScenarioDefinition;

  // Run the evaluation.
  const result = runProfileEvaluation(scenario, resolvedPath);

  // Also run exit prerequisites independently for cross-checking.
  console.error("[profile-runner] Running MUTANT_1V1 evaluation...");
  const mutantResult = evaluateMutant1v1();
  console.error(
    `[profile-runner] MUTANT_1V1 verdict: ${mutantResult.verdict}`,
  );

  console.error("[profile-runner] Running ARCHETYPE_BLINDED_COMPARISON evaluation...");
  const archetypeResult = evaluateArchetypeComparison({ useDiskArtifacts: true });
  console.error(
    `[profile-runner] ARCHETYPE_BLINDED_COMPARISON verdict: ${archetypeResult.verdict}`,
  );

  // Write structured output to stdout.
  console.log(JSON.stringify(result, null, 2));

  return result;
}

// Run if executed directly.
if (process.argv[1]?.endsWith("playable-1v1-profile-runner.ts")) {
  const scenarioPath = process.argv[2];
  const result = main(scenarioPath);

  // Write a copy to docs/evidence/playable-1v1-profile-evaluation/eval.json.
  try {
    const evidenceDir = join(
      dirname(__dirname),
      "../../docs/evidence/playable-1v1-profile-evaluation",
    );
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(
      join(evidenceDir, "eval.json"),
      JSON.stringify(result, null, 2),
      "utf-8",
    );
    console.error(
      `[profile-runner] Written result to ${evidenceDir}/eval.json`,
    );
  } catch {
    // Best effort — don't fail the evaluation if the directory doesn't exist.
  }

  // Exit with appropriate code.
  process.exit(result.milestoneVerdict === "PASS" ? 0 : 1);
}