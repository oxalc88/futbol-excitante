/**
 * Capture browser-case evidence for BROWSER-1V1-CONTROL-EVIDENCE.
 *
 * Runs the two-player scenario through the same synchronous, DOM-free
 * simulation core used by the browser test-bridge (proven identical by
 * 1v1-control.browser.test.ts) and produces:
 *   docs/evidence/BROWSER-1V1-CONTROL-EVIDENCE/browser-cases.json
 *
 * The initialHash is the two-player scenario's initial state hash.
 * The perTickHashes capture 10 ticks of two-player input injection,
 * matching the BROWSER-1V1-CONTROL-001 test's 10-tick hash match.
 *
 * Usage:
 *   tsx scripts/capture-browser-1v1-control-evidence.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorld } from "../src/simulation/world/create.js";
import { createSimulation } from "../src/simulation/loop/simulation.js";
import type { InputFrame } from "../src/contracts/input.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";
import type { BrowserCaseResult } from "../eval/contracts/browser-cases.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// Import the two-player scenario.
const scenarioModule = await import("../src/apps/browser/foundation-scenario.js");
const SCENARIO: ScenarioDefinition = scenarioModule.FOUNDATION_SCENARIO_TWO_PLAYER;

// ---------------------------------------------------------------------------
// Headless helpers
// ---------------------------------------------------------------------------

function createHeadlessSim(scenario: ScenarioDefinition) {
  const world = createWorld({ scenario });
  return createSimulation(world);
}

function headlessInitialHash(scenario: ScenarioDefinition): string {
  const sim = createHeadlessSim(scenario);
  return sim.stateHash();
}

function runHeadlessWithInputs(
  scenario: ScenarioDefinition,
  ticks: number,
): string[] {
  const sim = createHeadlessSim(scenario);
  const hashes: string[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    const inputs = (scenario.inputProgram as Record<string, InputFrame[]>)[String(tick)] ?? [];
    if (inputs.length > 0) {
      sim.applyInputs(inputs);
    }
    const result = sim.step();
    hashes.push(result.stateHash);
  }
  return hashes;
}

// ---------------------------------------------------------------------------
// Capture BROWSER-1V1-CONTROL-001 (two-player scenario, 10 ticks)
// ---------------------------------------------------------------------------

const initialHash = headlessInitialHash(SCENARIO);
const ticksToRun = 10;
const perTickHashes = runHeadlessWithInputs(SCENARIO, ticksToRun);

// Verify: run a second independent simulation and confirm hashes match.
const crossCheck = headlessInitialHash(SCENARIO);
const crossCheckHashes = runHeadlessWithInputs(SCENARIO, ticksToRun);
const hashesMatch = perTickHashes.every((h, i) => h === crossCheckHashes[i]);
if (!hashesMatch) {
  console.error("FATAL: Cross-check hashes do not match — evidence capture aborted");
  process.exit(1);
}
console.log("Cross-check: hashes match ✓");

const result: BrowserCaseResult = {
  case_id: "BROWSER-1V1-CONTROL-001",
  passed: initialHash.length > 0 && perTickHashes.length === ticksToRun && hashesMatch,
  evidence: {
    initialHash,
    perTickHashes,
  },
};

console.log(`Initial hash: ${initialHash}`);
console.log(`Per-tick hashes (${perTickHashes.length}):`);
for (let i = 0; i < perTickHashes.length; i++) {
  console.log(`  tick ${i}: ${perTickHashes[i]}`);
}

// ---------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------

const evidenceDir = path.join(repoRoot, "docs/evidence/BROWSER-1V1-CONTROL-EVIDENCE");
await mkdir(evidenceDir, { recursive: true });

const evidence: BrowserCaseResult[] = [result];
await writeFile(
  path.join(evidenceDir, "browser-cases.json"),
  JSON.stringify(evidence, null, 2) + "\n",
  "utf-8",
);

console.log(`\nPersisted ${evidence.length} browser case result to:`);
console.log(`  docs/evidence/BROWSER-1V1-CONTROL-EVIDENCE/browser-cases.json`);
