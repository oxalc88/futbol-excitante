/**
 * @module @pes/eval/runners/capability-design-eval-runner
 *
 * Standalone Node runner that executes evaluateCapabilityDesign against the
 * default versioned profile and persists the full structured result as
 * `docs/evidence/CAPABILITY_DESIGN_PROFILE/eval.json`.
 *
 * This script is the executable evidence producer for the
 * CAPABILITY_DESIGN_PROFILE entry prerequisite.
 *
 * Node I/O is allowed in the eval layer.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateCapabilityDesign } from "./evaluate-capability-design.js";
import type { CapabilityDesignEvaluationResult } from "./evaluate-capability-design.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the capability design evaluation and persist eval.json.
 *
 * @param outputDir - Directory for the eval.json output.
 * @param profileOverride - Optional profile JSON string to use instead of the default.
 * @returns The CapabilityDesignEvaluationResult.
 */
export function runAndPersist(
  outputDir: string,
  profileOverride?: string,
): CapabilityDesignEvaluationResult {
  // Load profile override if provided.
  let profile: CapabilityDesignEvaluationResult | undefined = undefined;
  if (profileOverride) {
    const parsed = JSON.parse(profileOverride) as CapabilityDesignEvaluationResult;
    profile = parsed;
  }

  // Run the evaluation (defaults to versioned profile).
  const result = evaluateCapabilityDesign({ profile });

  // Add milestoneVerdict equal to overall for the entry-prereq resolver.
  const output = {
    ...result,
    milestoneVerdict: result.overall,
  };

  console.error(
    `[capability-design-runner] overall: ${result.overall}`,
  );
  console.error(
    `[capability-design-runner] milestoneVerdict: ${output.milestoneVerdict}`,
  );
  console.error(
    `[capability-design-runner] profileVersion: ${result.profileVersion}`,
  );
  console.error(
    `[capability-design-runner] axes: ${result.axes.length}`,
  );
  for (const axis of result.axes) {
    console.error(
      `  [capability-design-runner] axis ${axis.axis_id}: ${axis.outcome} (${axis.status})`,
    );
  }

  // Persist the full structured result.
  mkdirSync(outputDir, { recursive: true });
  const evalPath = join(outputDir, "eval.json");
  writeFileSync(evalPath, JSON.stringify(output, null, 2), "utf-8");
  console.error(
    `[capability-design-runner] Written eval.json to ${evalPath}`,
  );

  return output;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * CLI entry point.
 *
 * Usage:
 *   tsx eval/runners/capability-design-eval-runner.ts [output-dir] [profile-json]
 */
export function main(): ReturnType<typeof runAndPersist> {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const outputDir =
    process.argv[2] ??
    join(__dirname, "../../docs/evidence/CAPABILITY_DESIGN_PROFILE");

  const profileOverride = process.argv[3];

  console.error(
    `[capability-design-runner] Output dir: ${outputDir}`,
  );

  return runAndPersist(outputDir, profileOverride);
}

// Run if executed directly.
if (process.argv[1]?.endsWith("capability-design-eval-runner.ts")) {
  const result = main();
  process.exit(result.overall === "PASS" ? 0 : 1);
}