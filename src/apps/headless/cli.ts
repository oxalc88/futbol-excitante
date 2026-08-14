/**
 * @module apps/headless/cli
 *
 * CLI entry point for the headless simulation runner.
 *
 * Usage:
 *   node --import tsx apps/headless/cli.ts --scenario <path> --out <dir>
 *
 * This is a thin adapter: it parses CLI args, delegates to runHeadless(),
 * writes artifacts via writeRunArtifacts(), and exits with code 0 or 1.
 *
 * Node I/O allowed (this is a Node adapter).
 * Simulation core never reads I/O.
 *
 * No Math.random, Date, performance, DOM.
 */

import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

import type { ScenarioDefinition } from "../../contracts/scenario.js";
import type { ReplayV1 } from "../../contracts/replay.js";
import type { TickHashRecord, EventRecord } from "./artifacts.js";
import { writeRunArtifacts, createManifest } from "./artifacts.js";
import { runHeadless, type RunOptions } from "./run.js";
import { encodeCanonical } from "../../simulation/determinism/canonical.js";
import { hashFnv1a64 } from "../../simulation/determinism/hash.js";
import { verifyReplay } from "../../../eval/recording/verifier.js";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

/**
 * Parse simple CLI arguments (--key value) from the given argv.
 */
function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  const cliArgs = argv.slice(2);
  for (let i = 0; i < cliArgs.length; i++) {
    if (cliArgs[i].startsWith("--")) {
      const key = cliArgs[i].slice(2);
      const value = cliArgs[i + 1];
      if (value !== undefined && !value.startsWith("--")) {
        args[key] = value;
        i++;
      } else {
        args[key] = "";
      }
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Build RunOptions from parsed CLI arguments.
 */
function buildRunOpts(cli: Record<string, string>, scenario: ScenarioDefinition): RunOptions {
  const scenarioHash = hashFnv1a64(encodeCanonical(scenario));
  const configHash = hashFnv1a64(JSON.stringify({ id: scenario.configVersion }));
  const pitchRulesHash = hashFnv1a64(
    JSON.stringify({ pitchLength: scenario.pitchLength, pitchWidth: scenario.pitchWidth }),
  );
  const rosterCapabilityHash: string | null = null;

  return {
    scenario,
    simulationVersion: scenario.simulationVersion,
    runtimeIdentity: `node-${process.version}`,
    configVersion: scenario.configVersion,
    configHash,
    pitchRulesHash,
    rosterCapabilityHash: rosterCapabilityHash ?? "",
    scenarioHash,
    safetyBounds: scenario.safetyBounds,
    runId: `run-${Date.now()}`,
  };
}

/**
 * Test entry point for the CLI.
 *
 * Returns 0 on success, 1 on failure. Accepts an optional
 * `replayVerifier` override for injection from tests.
 */
export function runCli(argv: string[], testOpts?: { replayVerifier?: RunOptions["replayVerifier"] }): number {
  const cli = parseArgs(argv);

  const scenarioPath = cli.scenario;
  const outDir = cli.out ?? join(process.cwd(), "artifacts", `run-${Date.now()}`);

  if (!scenarioPath) {
    console.error("Usage: headless --scenario <path> [--out <dir>]");
    return 1;
  }

  // Load scenario.
  let scenario: ScenarioDefinition;
  try {
    const raw = readFileSync(resolve(scenarioPath), "utf-8");
    scenario = JSON.parse(raw) as ScenarioDefinition;
  } catch (err) {
    console.error(`Failed to load scenario: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  const runOpts = buildRunOpts(cli, scenario);
  if (testOpts?.replayVerifier) {
    runOpts.replayVerifier = testOpts.replayVerifier;
  }

  // Run the simulation.
  const result = runHeadless(runOpts);

  if (!result.success) {
    console.error(`Run failed: ${result.error}`);
    return 1;
  }

  // Build manifest with hashes.
  const manifest = createManifest({
    scenario,
    simulationVersion: result.replay.header.simulationVersion,
    runtimeIdentity: result.replay.header.runtimeIdentity,
    configVersion: scenario.configVersion,
    configHash: hashFnv1a64(JSON.stringify({ id: scenario.configVersion })),
    scenarioHash: hashFnv1a64(encodeCanonical(scenario)),
    pitchRulesHash: hashFnv1a64(
      JSON.stringify({ pitchLength: scenario.pitchLength, pitchWidth: scenario.pitchWidth }),
    ),
    rosterCapabilityHash: undefined,
  });

  // Build hashes array for artifacts.
  const hashes: TickHashRecord[] = result.hashes.map((h) => ({ tick: h.tick, hash: h.hash }));

  // Build events for artifacts.
  const events: EventRecord[] = result.events.map((e) => ({
    tick: e.tick,
    id: e.id,
    kind: e.kind,
    label: e.label,
  }));

  // Write artifacts with metrics and invariants from the run.
  const artifactsOpts = {
    outDir,
    scenario,
    observations: result.observations,
    hashes,
    events,
    metrics: result.metrics,
    invariants: result.invariants,
    finalStateHash: result.finalStateHash,
    replay: result.replay as ReplayV1,
    finalState: result.finalState,
    manifest,
  };

  writeRunArtifacts(artifactsOpts);

  // Verify replay integrity by re-running from the written replay.
  const replayPath = join(outDir, "replay.json");
  const replayRaw = readFileSync(replayPath, "utf-8");
  const replayData = JSON.parse(replayRaw) as ReplayV1;
  const verifResult = verifyReplay(replayData, scenario);
  if (!verifResult.match) {
    console.error(
      `Replay verification failed: earliest divergence at tick ${verifResult.earliestDivergenceTick ?? "N/A"}`,
    );
    return 1;
  }

  console.log(`Run complete: ${result.totalTicks} ticks, artifacts written to ${outDir}`);
  return 0;
}

/**
 * Main entry point for the headless runner CLI.
 */
export function main(): void {
  const exitCode = runCli(process.argv);
  process.exit(exitCode);
}

// Run when executed as CLI entry point (not imported by tests).
if (process.argv[1] && process.argv[1].endsWith("cli.ts")) {
  main();
}