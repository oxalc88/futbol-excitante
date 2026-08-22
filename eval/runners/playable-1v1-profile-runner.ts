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

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePlayable1v1, type Playable1v1Result } from "./playable-evaluator.js";
import { evaluateMutant1v1 } from "./mutant-1v1.js";
import { evaluateArchetypeComparison } from "./archetype-comparison.js";
import { PLAYABLE_1V1_PROFILE } from "../contracts/profiles.js";
import { loadRegistrySet } from "../contracts/loader.js";
import { evaluate } from "./evaluate.js";
import type { BrowserCaseResult } from "../contracts/browser-cases.js";

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
 * Executable verdict strings recognised by the eval.json resolver.
 */
type ExecutableVerdict =
  | "PASS"
  | "FAIL"
  | "NEEDS_PERCEPTUAL_REVIEW"
  | "NOT_EVALUATED"
  | "INVALID_RUN"
  | "BLOCKED_MISSING_REFERENCE";

/**
 * Read executable eval.json verdicts for the given prerequisite names.
 *
 * For each prerequisite, looks for `docs/evidence/<prereq>/eval.json`.
 * If missing, unreadable, or lacking a usable verdict field → omit the key
 * (caller defaults to BLOCKED_MISSING_REFERENCE).  If present, reads the
 * executable verdict from `milestoneVerdict` if present, else `overall`.
 *
 * Gauntlet `audit.json` PASS / `manifest.accepted` must NOT become
 * a milestone PASS under any circumstance.
 *
 * @param prereqNames - Names of entry prerequisites to resolve.
 * @param evidenceBase - Base directory for evidence dirs.  Defaults to
 *   `docs/evidence` relative to this module, but is injectable so unit
 *   tests can use temp dirs without writing into durable `docs/evidence/`.
 * @returns Map from prerequisite name → outcome.  Missing keys mean the
 *   caller should use BLOCKED_MISSING_REFERENCE.
 */
export function resolveEntryPrereqOutcomes(
  prereqNames: string[],
  evidenceBase?: string,
): Record<
  string,
  "PASS" | "FAIL" | "NEEDS_PERCEPTUAL_REVIEW" | "NOT_EVALUATED" | "INVALID_RUN" | "BLOCKED_MISSING_REFERENCE"
> {
  const base = evidenceBase ?? join(
    dirname(fileURLToPath(import.meta.url)),
    "../../docs/evidence",
  );
  const outcomes: Record<
    string,
    "PASS" | "FAIL" | "NEEDS_PERCEPTUAL_REVIEW" | "NOT_EVALUATED" | "INVALID_RUN" | "BLOCKED_MISSING_REFERENCE"
  > = {};

  const validVerdicts = new Set([
    "PASS",
    "FAIL",
    "NEEDS_PERCEPTUAL_REVIEW",
    "NOT_EVALUATED",
    "INVALID_RUN",
    "BLOCKED_MISSING_REFERENCE",
  ]);

  for (const prereq of prereqNames) {
    const dir = join(base, prereq);
    if (!existsSync(dir)) {
      console.error(
        `[profile-runner] Evidence dir not found: ${dir}`,
      );
      continue;
    }

    const evalPath = join(dir, "eval.json");

    if (!existsSync(evalPath)) {
      console.error(
        `[profile-runner] No eval.json in ${dir} — ${prereq} omitted`,
      );
      continue;
    }

    try {
      const raw = readFileSync(evalPath, "utf-8");
      const evalDoc = JSON.parse(raw) as Record<string, unknown>;

      // Prefer milestoneVerdict; fall back to overall.
      const rawVerdict =
        typeof evalDoc.milestoneVerdict === "string"
          ? evalDoc.milestoneVerdict
          : typeof evalDoc.overall === "string"
            ? evalDoc.overall
            : undefined;

      if (rawVerdict && validVerdicts.has(rawVerdict)) {
        outcomes[prereq] = rawVerdict as ExecutableVerdict;
        console.error(
          `[profile-runner] eval.json verdict for "${prereq}": ${rawVerdict}`,
        );
      } else {
        console.error(
          `[profile-runner] eval.json for "${prereq}" lacks usable verdict (milestoneVerdict/overall), omitting`,
        );
      }
    } catch (err) {
      console.error(
        `[profile-runner] Error reading eval.json for "${prereq}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return outcomes;
}

/**
 * Run the full PLAYABLE_1V1 profile evaluation and return structured result.
 */
function runProfileEvaluation(
  scenario: ScenarioDefinition,
  scenarioFile: string,
  twoPlayerScenario?: ScenarioDefinition,
  entryPrereqOutcomes?: Record<
    string,
    "PASS" | "FAIL" | "NEEDS_PERCEPTUAL_REVIEW" | "NOT_EVALUATED" | "INVALID_RUN" | "BLOCKED_MISSING_REFERENCE"
  >,
): Playable1v1ProfileResult {
  const registry = loadRegistrySet();

  // Load browser-cases.json from all evidence directories (durable browser evidence).
  let browserCases: BrowserCaseResult[] = [];
  const evidenceBase = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../docs/evidence",
  );
  const browserCaseFiles = [
    "BROWSER-CORE-EVIDENCE/browser-cases.json",
    "BROWSER-1V1-CONTROL-EVIDENCE/browser-cases.json",
  ];
  let anyLoaded = false;
  for (const relPath of browserCaseFiles) {
    const full = join(evidenceBase, relPath);
    if (existsSync(full)) {
      try {
        const raw = readFileSync(full, "utf-8");
        const parsed = JSON.parse(raw) as BrowserCaseResult[];
        browserCases = browserCases.concat(parsed);
        anyLoaded = true;
        console.error(
          `[profile-runner] Loaded ${parsed.length} browser case results from ${relPath}`,
        );
      } catch {
        console.error(
          `[profile-runner] Warning: could not parse ${relPath} — skipping`,
        );
      }
    }
  }
  if (!anyLoaded) {
    console.error(
      "[profile-runner] No browser-cases.json found — browser cases will be INVALID_RUN",
    );
  }

  const result = evaluatePlayable1v1(scenario, {
    browserCases: browserCases.length > 0 ? browserCases : undefined,
    twoPlayerScenario,
    entryPrereqOutcomes: entryPrereqOutcomes && Object.keys(entryPrereqOutcomes).length > 0
      ? entryPrereqOutcomes
      : undefined,
  });

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

  // Load the two-player scenario for BROWSER-1V1-CONTROL-001 cross-check.
  const twoPlayerPath = join(__dirname, "../scenarios/two-player-duel.v1.json");
  let twoPlayerScenario: ScenarioDefinition | undefined;
  try {
    const tpRaw = readFileSync(twoPlayerPath, "utf-8");
    twoPlayerScenario = JSON.parse(tpRaw) as ScenarioDefinition;
  } catch {
    console.error(
      "[profile-runner] Warning: two-player-duel.v1.json not found — BROWSER-1V1-CONTROL-001 cross-check may fail",
    );
  }

  // Resolve entry-prerequisite outcomes from accepted evidence.
  const entryPrereqNames = PLAYABLE_1V1_PROFILE.entry_prerequisites;
  const entryPrereqOutcomes = resolveEntryPrereqOutcomes(
    entryPrereqNames,
  );

  // Run the evaluation.
  const result = runProfileEvaluation(
    scenario,
    resolvedPath,
    twoPlayerScenario,
    entryPrereqOutcomes,
  );

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

  // Write a copy to docs/evidence/BROWSER-CORE-EVIDENCE/ (never overwrite accepted manifests).
  try {
    const evidenceDir = join(
      dirname(__dirname),
      "../../docs/evidence/BROWSER-CORE-EVIDENCE",
    );
    mkdirSync(evidenceDir, { recursive: true });
    const evalPath = join(evidenceDir, "eval.json");
    // Gate: do not overwrite if accepted manifest already exists for another objective.
    if (!existsSync(join(evidenceDir, "manifest.json"))) {
      writeFileSync(
        evalPath,
        JSON.stringify(result, null, 2),
        "utf-8",
      );
      console.error(
        `[profile-runner] Written result to ${evalPath}`,
      );
    } else {
      console.error(
        `[profile-runner] Skipped eval.json write — manifest.json already exists`,
      );
    }
  } catch {
    // Best effort — don't fail the evaluation if the directory doesn't exist.
  }

  // Exit with appropriate code.
  process.exit(result.milestoneVerdict === "PASS" ? 0 : 1);
}