/**
 * Capture a MULTI_TICK trajectory for CPU-TEAM-DECISION-PROFILE.
 *
 * Runs a 2v2 AI match with team-decision-wired CPU adapters for 600 ticks
 * and writes per-tick state hashes to docs/evidence/CPU-TEAM-DECISION-PROFILE/trajectory.json.
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
import { computeTeamDecision } from "../src/adapters/input-browser/team-decision-profile.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// Import the 2v2 scenario.
const scenarioModule = await import("../src/apps/browser/foundation-scenario.js");
const SCENARIO = scenarioModule.FOUNDATION_SCENARIO_2V2;

const TICKS = 600;
const objective = "CPU-TEAM-DECISION-PROFILE";

// Create simulation.
const world = createWorld({ scenario: SCENARIO });
const sim = createSimulation(world);

// Set up CPU adapters.
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

  // Compute one team decision per team.
  const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
  for (const { assignment } of entries) {
    if (!teamDecisions.has(assignment.teamId)) {
      const obs = buildCpuObservation(
        snapshot,
        assignment.teamId,
        assignment.controlledPlayerId,
      );
      teamDecisions.set(
        assignment.teamId,
        computeTeamDecision(obs, assignment.teamId),
      );
    }
  }

  const frames = entries.map(({ controlSlot, assignment, adapter }) => {
    const obs = buildCpuObservation(
      snapshot,
      assignment.teamId,
      assignment.controlledPlayerId,
    );
    obs.teamDecision = teamDecisions.get(assignment.teamId);
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
  scenario: "2v2-duel.v1",
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
