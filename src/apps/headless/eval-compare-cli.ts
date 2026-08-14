/**
 * @module apps/headless/eval-compare-cli
 *
 * CLI entry point for comparing two evaluation artifact directories.
 *
 * Usage:
 *   node --import tsx src/apps/headless/eval-compare-cli.ts --baseline <dir-a> --candidate <dir-b>
 *
 * Reads manifest.json from each directory, reconstructs EvaluationResult,
 * and calls compareRuns to emit condition validation and metric deltas.
 *
 * Node I/O allowed (headless adapter layer).
 * Simulation core never reads I/O.
 *
 * No Math.random, Date, performance, DOM.
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

import type { EvaluationResult } from "../../../eval/runners/evaluate.js";
import { compareRuns } from "../../../eval/runners/compare.js";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { flags: Record<string, string>; positional: string[] } {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  let afterDashes = false;
  // argv layout under both `tsx script.ts <args>` and `node --import tsx script.ts <args>`:
  // [nodeScript, scriptPath, ...rest].  Start at index 2 to reach user args.
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--") {
      afterDashes = true;
      continue;
    }
    if (afterDashes) {
      positional.push(argv[i]);
    } else if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1];
      if (value !== undefined && !value.startsWith("--")) {
        flags[key] = value;
        i++;
      } else {
        flags[key] = "";
      }
    } else {
      positional.push(argv[i]);
    }
  }
  return { flags, positional };
}

// ---------------------------------------------------------------------------
// Artifact loading helpers
// ---------------------------------------------------------------------------

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as T;
}

/**
 * Reconstruct a minimal EvaluationResult from artifact directory contents.
 */
function loadEvaluationResult(dir: string): EvaluationResult {
  const manifest = readJsonFile<{
    comparison: { scenarioId: string; scenarioVersion: string; seed: number };
    configVersion: string;
  }>(join(dir, "manifest.json"));

  const metrics = readJsonFile<Record<string, unknown>>(join(dir, "metrics.json"));

  const hashesLines = readFileSync(join(dir, "hashes.jsonl"), "utf-8")
    .trim()
    .split("\n")
    .map((line) => {
      const { tick, hash } = JSON.parse(line);
      return [tick, hash] as [number, string];
    });

  const hashes = new Map(hashesLines);

  const invariants = readJsonFile<Array<{ id: string; status: string; description: string }>>(
    join(dir, "invariants.json"),
  ) as import("../../../src/contracts/telemetry.js").InvariantResult[];

  const finalState = readJsonFile<Record<string, unknown>>(join(dir, "final-state.json"));

  const eventsLines = readFileSync(join(dir, "events.jsonl"), "utf-8")
    .trim()
    .split("\n")
    .map((line) => {
      const { tick, id, kind, label } = JSON.parse(line);
      return { tick, id, kind, label };
    });

  // Derive totalTicks from the highest tick in hashes.
  let totalTicks = 0;
  for (const [tick] of hashes) {
    if (tick > totalTicks) totalTicks = tick;
  }

  const seed = manifest.comparison.seed;

  return {
    scenarioId: manifest.comparison.scenarioId,
    scenarioVersion: manifest.comparison.scenarioVersion,
    totalTicks,
    metrics,
    invariants,
    finalStateHash: "",
    hashes,
    events: eventsLines,
    finalState,
    seed,
    scenarioConfigVersion: manifest.configVersion,
    hasInvariantFailures: invariants.some((i) => i.status === "fail"),
    observations: [],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Test entry point for the eval-compare CLI.
 *
 * Returns 0 on success, 1 on failure.
 */
export function runCli(argv: string[]): number {
  const { flags, positional } = parseArgs(argv);

  const baselineDir = flags.baseline || positional[0];
  const candidateDir = flags.candidate || positional[1];

  if (!baselineDir || !candidateDir) {
    console.error("Usage: eval-compare [--baseline <dir-a> --candidate <dir-b>] [--] <dir-a> <dir-b>");
    return 1;
  }

  // Validate directories exist and contain required artifacts.
  const requiredFiles = ["manifest.json", "metrics.json", "hashes.jsonl", "invariants.json", "final-state.json", "events.jsonl"];
  for (const dir of [baselineDir, candidateDir]) {
    for (const file of requiredFiles) {
      const path = join(dir, file);
      if (!readFileSync(path, "utf-8")) {
        // Check existence.
        try {
          readFileSync(resolve(path), "utf-8");
        } catch {
          console.error(`Missing required artifact: ${path}`);
          return 1;
        }
      }
    }
  }

  // Load evaluation results.
  let baseline: EvaluationResult;
  let candidate: EvaluationResult;
  try {
    baseline = loadEvaluationResult(baselineDir);
  } catch (err) {
    console.error(`Failed to load baseline artifacts: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  try {
    candidate = loadEvaluationResult(candidateDir);
  } catch (err) {
    console.error(`Failed to load candidate artifacts: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  // Compare.
  const result = compareRuns(baseline, candidate);

  if (result.status === "mismatch") {
    console.error("Comparison FAILED: condition hash mismatch");
    console.error("  The two runs were not under identical conditions.");
    console.error("  Do not compare these results.");
    return 1;
  }

  // DELTA_ONLY or match — report deltas.
  console.log(`Comparison result: ${result.status}`);
  console.log(`  Condition hash match: ${result.conditionHashMatch}`);

  if (result.earliestDivergenceTick !== undefined) {
    console.log(`  Earliest divergence: tick ${result.earliestDivergenceTick}`);
    console.log(`    Expected: ${result.earliestDivergenceExpected}`);
    console.log(`    Actual:   ${result.earliestDivergenceActual}`);
  }

  if (result.metricDeltas && Object.keys(result.metricDeltas).length > 0) {
    console.log("  Metric deltas:");
    for (const [key, delta] of Object.entries(result.metricDeltas)) {
      console.log(`    ${key}: expected=${JSON.stringify(delta.expected)}, actual=${JSON.stringify(delta.actual)}`);
    }
  } else {
    console.log("  No metric deltas found.");
  }

  return 0;
}

/**
 * Main entry point for the eval-compare CLI.
 */
export function main(): void {
  const exitCode = runCli(process.argv);
  process.exit(exitCode);
}

// Run when executed as CLI entry point.
if (process.argv[1] && process.argv[1].endsWith("eval-compare-cli.ts")) {
  main();
}