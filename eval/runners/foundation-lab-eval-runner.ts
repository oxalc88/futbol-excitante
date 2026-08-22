/**
 * @module @pes/eval/runners/foundation-lab-eval-runner
 *
 * Standalone Node runner that executes evaluateFoundationLab against a
 * scenario, loads durable browser-case evidence, and persists the full
 * structured result as `docs/evidence/FOUNDATION_LAB_PASS/eval.json`.
 *
 * This script is the executable evidence producer for the
 * FOUNDATION_LAB_PASS entry prerequisite.
 *
 * Node I/O is allowed in the eval layer.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateFoundationLab } from "./foundation-promotion.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { BrowserCaseResult } from "../contracts/types.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the FOUNDATION_LAB evaluation and persist eval.json.
 *
 * @param scenarioPath - Path to the scenario JSON file.
 * @param browserCasesPath - Path to the durable browser-cases.json.
 * @param outputDir - Directory for the eval.json output.
 * @returns The FoundationLabResult.
 */
export function runAndPersist(
  scenarioPath: string,
  browserCasesPath: string,
  outputDir: string,
): ReturnType<typeof evaluateFoundationLab> {
  const raw = readFileSync(scenarioPath, "utf-8");
  const scenario = JSON.parse(raw) as ScenarioDefinition;

  // Load durable browser-case evidence.
  let browserCases: BrowserCaseResult[] = [];
  if (existsSync(browserCasesPath)) {
    const bcRaw = readFileSync(browserCasesPath, "utf-8");
    browserCases = JSON.parse(bcRaw) as BrowserCaseResult[];
    console.error(
      `[foundation-lab-runner] Loaded ${browserCases.length} browser case(s) from ${browserCasesPath}`,
    );
  } else {
    console.error(
      `[foundation-lab-runner] Warning: no browser cases at ${browserCasesPath}`,
    );
  }

  // Run the evaluation.
  const result = evaluateFoundationLab(scenario, { browserCases });

  console.error(
    `[foundation-lab-runner] milestoneVerdict: ${result.milestoneVerdict}`,
  );
  console.error(
    `[foundation-lab-runner] allHardInvariantPass: ${result.allHardInvariantPass}`,
  );
  console.error(
    `[foundation-lab-runner] commonDeterministicPass: ${result.commonDeterministicPass}`,
  );
  console.error(
    `[foundation-lab-runner] mutantCorePass: ${result.mutantCorePass}`,
  );

  // Persist the full structured result.
  mkdirSync(outputDir, { recursive: true });
  const evalPath = join(outputDir, "eval.json");
  writeFileSync(evalPath, JSON.stringify(result, null, 2), "utf-8");
  console.error(`[foundation-lab-runner] Written eval.json to ${evalPath}`);

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * CLI entry point.
 *
 * Usage:
 *   tsx eval/runners/foundation-lab-eval-runner.ts [scenario] [browser-cases] [output-dir]
 */
export function main(): ReturnType<typeof evaluateFoundationLab> {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const scenarioPath =
    process.argv[2] ??
    join(__dirname, "../scenarios/foundation-move-and-roll.v1.json");

  const browserCasesPath =
    process.argv[3] ??
    join(__dirname, "../../docs/evidence/BROWSER-CORE-EVIDENCE/browser-cases.json");

  const outputDir =
    process.argv[4] ??
    join(__dirname, "../../docs/evidence/FOUNDATION_LAB_PASS");

  console.error(`[foundation-lab-runner] Scenario: ${scenarioPath}`);
  console.error(`[foundation-lab-runner] Browser cases: ${browserCasesPath}`);
  console.error(`[foundation-lab-runner] Output dir: ${outputDir}`);

  return runAndPersist(scenarioPath, browserCasesPath, outputDir);
}

// Run if executed directly.
if (process.argv[1]?.endsWith("foundation-lab-eval-runner.ts")) {
  const result = main();
  process.exit(result.milestoneVerdict === "PASS" ? 0 : 1);
}