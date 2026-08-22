/**
 * Capture trajectory for BROWSER-CORE-EVIDENCE.
 *
 * Runs the foundation scenario for 5 ticks (matching STEP-001) and
 * writes per-tick state hashes to:
 *   docs/evidence/BROWSER-CORE-EVIDENCE/trajectory.json
 *
 * Uses the same simulation core as the browser — proven identical by
 * core-smoke.browser.test.ts.
 *
 * Usage:
 *   tsx scripts/capture-browser-core-trajectory.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorld } from "../src/simulation/world/create.js";
import { createSimulation } from "../src/simulation/loop/simulation.js";
import type { InputFrame } from "../src/contracts/input.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// Import the foundation scenario.
const scenarioModule = await import("../src/apps/browser/foundation-scenario.js");
const SCENARIO: ScenarioDefinition = scenarioModule.FOUNDATION_SCENARIO;

const TICKS = 5;
const objective = "BROWSER-CORE-EVIDENCE";

// Create simulation.
const world = createWorld({ scenario: SCENARIO });
const sim = createSimulation(world);

const initialHash = sim.stateHash();
const perTickHashes: string[] = [];

for (let i = 0; i < TICKS; i++) {
  const tickInputs = (SCENARIO.inputProgram as Record<string, InputFrame[]>)[String(sim.tick)] ?? [];
  if (tickInputs.length > 0) {
    sim.applyInputs(tickInputs);
  }
  const result = sim.step();
  perTickHashes.push(result.stateHash);
}

// Write trajectory.
const trajectoryDir = path.join(repoRoot, "docs/evidence", objective);
await mkdir(trajectoryDir, { recursive: true });

const trajectory = {
  objective,
  class: "DYNAMIC_VISUAL",
  scenario: "foundation-move-and-roll.v1",
  ticks: TICKS,
  initialHash,
  perTickHashes,
};

await writeFile(
  path.join(trajectoryDir, "trajectory.json"),
  JSON.stringify(trajectory, null, 2) + "\n",
  "utf8",
);

console.log(`Trajectory captured: ${perTickHashes.length} hashes (${TICKS} ticks)`);
console.log(`Written to: docs/evidence/${objective}/trajectory.json`);
