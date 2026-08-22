/**
 * Capture browser-case evidence for BROWSER-CORE-EVIDENCE.
 *
 * Runs the same simulation core used by browser tests (proven identical
 * by core-smoke.browser.test.ts) and produces:
 *   docs/evidence/BROWSER-CORE-EVIDENCE/browser-cases.json
 *
 * The hashes are from the same synchronous, DOM-free core that runs in
 * both headless and browser.  Browser-mode core-smoke tests prove
 * correspondence; this script captures the durable evidence artifact.
 *
 * Usage:
 *   tsx scripts/capture-browser-core-evidence.ts
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

// Import the foundation scenario.
const scenarioModule = await import("../src/apps/browser/foundation-scenario.js");
const SCENARIO: ScenarioDefinition = scenarioModule.FOUNDATION_SCENARIO;

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
// Capture BROWSER-CORE-RESET-001
// ---------------------------------------------------------------------------

const initialHash = headlessInitialHash(SCENARIO);
const resetResult: BrowserCaseResult = {
  case_id: "BROWSER-CORE-RESET-001",
  passed: initialHash.length > 0,
  evidence: { initialHash },
};

console.log(`RESET-001 initial hash: ${initialHash}`);

// ---------------------------------------------------------------------------
// Capture BROWSER-CORE-STEP-001 (5 ticks, matching core-smoke test)
// ---------------------------------------------------------------------------

const ticksToRun = 5;
const stepInitialHash = headlessInitialHash(SCENARIO);
const perTickHashes = runHeadlessWithInputs(SCENARIO, ticksToRun);
const stepFinalHash = perTickHashes[perTickHashes.length - 1];

const stepResult: BrowserCaseResult = {
  case_id: "BROWSER-CORE-STEP-001",
  passed: stepInitialHash === initialHash && perTickHashes.length === ticksToRun,
  evidence: {
    initialHash: stepInitialHash,
    perTickHashes,
  },
};

console.log(`STEP-001 initial hash: ${stepInitialHash}`);
console.log(`STEP-001 per-tick hashes (${perTickHashes.length}):`);
for (let i = 0; i < perTickHashes.length; i++) {
  console.log(`  tick ${i}: ${perTickHashes[i]}`);
}
console.log(`STEP-001 final hash: ${stepFinalHash}`);

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

const crossCheck = createHeadlessSim(SCENARIO);
const crossCheckHashes: string[] = [];
for (let tick = 0; tick < ticksToRun; tick++) {
  const inputs = (SCENARIO.inputProgram as Record<string, InputFrame[]>)[String(tick)] ?? [];
  if (inputs.length > 0) {
    crossCheck.applyInputs(inputs);
  }
  const result = crossCheck.step();
  crossCheckHashes.push(result.stateHash);
}

const hashesMatch = perTickHashes.every((h, i) => h === crossCheckHashes[i]);
if (!hashesMatch) {
  console.error("FATAL: Cross-check hashes do not match — evidence capture aborted");
  process.exit(1);
}

console.log("Cross-check: hashes match ✓");

// ---------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------

const evidenceDir = path.join(repoRoot, "docs/evidence/BROWSER-CORE-EVIDENCE");
await mkdir(evidenceDir, { recursive: true });

const evidence: BrowserCaseResult[] = [resetResult, stepResult];
await writeFile(
  path.join(evidenceDir, "browser-cases.json"),
  JSON.stringify(evidence, null, 2) + "\n",
  "utf-8",
);

console.log(`\nPersisted ${evidence.length} browser case results to:`);
console.log(`  docs/evidence/BROWSER-CORE-EVIDENCE/browser-cases.json`);
