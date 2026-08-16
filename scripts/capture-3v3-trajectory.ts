/**
 * Capture a MULTI_TICK trajectory for SCENARIO-3V3-FIXTURE.
 *
 * Runs a 3v3 AI match with 6 CPU adapters for 60 ticks
 * and writes per-tick state hashes to docs/evidence/SCENARIO-3V3-FIXTURE/trajectory.json.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorld } from "../src/simulation/world/create.js";
import { createSimulation } from "../src/simulation/loop/simulation.js";
import {
  buildCpuObservation,
  createCpuAdapter,
} from "../src/adapters/input-browser/cpu-adapter.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// Import the 3v3 scenario.
const scenarioModule = await import("../src/apps/browser/foundation-scenario.js");
const SCENARIO = scenarioModule.FOUNDATION_SCENARIO_3V3;

const TICKS = 60;
const objective = "SCENARIO-3V3-FIXTURE";

// Create simulation.
const world = createWorld({ scenario: SCENARIO });
const sim = createSimulation(world);

// Set up CPU adapters for all 6 slots.
const entries = Object.entries(SCENARIO.controlAssignments).map(
  ([controlSlot, assignment]) => ({
    controlSlot,
    assignment,
    adapter: createCpuAdapter(),
  }),
);

const perTickHashes: string[] = [];
const initialHash = sim.stateHash();
perTickHashes.push(initialHash);

for (let i = 0; i < TICKS; i++) {
  const snapshot = sim.snapshot();

  const frames = entries.map(({ controlSlot, assignment, adapter }) => {
    const obs = buildCpuObservation(
      snapshot,
      assignment.teamId,
      assignment.controlledPlayerId,
    );
    const frame = adapter.sample(sim.tick, obs);
    frame.controlSlot = controlSlot;
    return frame;
  });

  sim.applyInputs(frames);
  const result = sim.step();
  perTickHashes.push(result.stateHash);
}

// Write trajectory.
const trajectoryDir = path.join(repoRoot, "docs/evidence", objective);
await mkdir(trajectoryDir, { recursive: true });

const trajectory = {
  objective,
  class: "MULTI_TICK",
  scenario: "3v3-fixture.v1",
  ticks: TICKS,
  initialHash,
  perTickHashes,
  generatedAt: new Date().toISOString(),
};

await writeFile(
  path.join(trajectoryDir, "trajectory.json"),
  JSON.stringify(trajectory, null, 2) + "\n",
  "utf8",
);

console.log(`Trajectory captured: ${perTickHashes.length} hashes (${TICKS} ticks)`);
console.log(`Written to: docs/evidence/${objective}/trajectory.json`);
