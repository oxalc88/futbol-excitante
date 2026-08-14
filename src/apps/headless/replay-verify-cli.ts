/**
 * @module apps/headless/replay-verify-cli
 *
 * CLI entry point for verifying a replay.json artifact.
 *
 * Usage:
 *   node --import tsx src/apps/headless/replay-verify-cli.ts --replay <path>
 *
 * Node I/O allowed (headless adapter layer).
 * Simulation core never reads I/O.
 *
 * No Math.random, Date, performance, DOM.
 */

import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

import type { ReplayV1 } from "../../contracts/replay.js";
import type { ScenarioDefinition } from "../../contracts/scenario.js";
import { verifyReplay } from "../../../eval/recording/verifier.js";

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
// Main
// ---------------------------------------------------------------------------

/**
 * Test entry point for the replay-verify CLI.
 *
 * Returns 0 on success, 1 on failure.
 */
export function runCli(argv: string[]): number {
  const { flags, positional } = parseArgs(argv);

  const replayPath = flags.replay || positional[0];

  if (!replayPath) {
    console.error("Usage: replay-verify [--replay <path>] [--] <path>");
    return 1;
  }

  // Load replay.
  let replay: ReplayV1;
  try {
    const raw = readFileSync(resolve(replayPath), "utf-8");
    replay = JSON.parse(raw) as ReplayV1;
  } catch (err) {
    console.error(`Failed to load replay: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  // Load scenario from the same directory as the replay artifact.
  const replayDir = join(replayPath, "..");
  const scenarioPath = join(replayDir, "scenario.json");
  let scenario: ScenarioDefinition;
  try {
    const raw = readFileSync(resolve(scenarioPath), "utf-8");
    scenario = JSON.parse(raw) as ScenarioDefinition;
  } catch (err) {
    console.error(
      `Failed to load scenario (required for replay verification): ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }

  // Verify replay.
  const result = verifyReplay(replay, scenario);

  if (!result.match) {
    console.error(
      `Replay verification FAILED: earliest divergence at tick ${result.earliestDivergenceTick ?? "N/A"}`,
    );
    if (result.earliestDivergenceExpected) {
      console.error(`  Expected: ${result.earliestDivergenceExpected}`);
      console.error(`  Actual:   ${result.earliestDivergenceActual}`);
    }
    if (result.earliestDivergenceStateSlice) {
      console.error(`  State slice: ${result.earliestDivergenceStateSlice}`);
    }
    return 1;
  }

  console.log(`Replay verification PASSED: ${result.ticksChecked} ticks checked, initial hash match: ${result.initialHashMatch}`);
  return 0;
}

/**
 * Main entry point for the replay-verify CLI.
 */
export function main(): void {
  const exitCode = runCli(process.argv);
  process.exit(exitCode);
}

// Run when executed as CLI entry point.
if (process.argv[1] && process.argv[1].endsWith("replay-verify-cli.ts")) {
  main();
}