/**
 * Capture a DYNAMIC_VISUAL trajectory for BROWSER-3V3-MATCH.
 *
 * Runs a 3v3 AI match with 6 CPU adapters and team decision profiles for
 * 60 ticks and writes per-tick state hashes to docs/evidence/BROWSER-3V3-MATCH/trajectory.json.
 *
 * This mirrors the headless wiring used by the browser test bridge
 * (stepWithCpuControllers) so browser and headless hashes match.
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

// Import the 3v3 scenario.
const scenarioModule = await import("../src/apps/browser/foundation-scenario.js");
const SCENARIO = scenarioModule.FOUNDATION_SCENARIO_3V3;

const TICKS = 60;
const objective = "BROWSER-3V3-MATCH";

// Create simulation.
const world = createWorld({ scenario: SCENARIO });
const sim = createSimulation(world);

// Set up CPU adapters for all 6 slots — same wiring as browser test bridge.
const entries = Object.entries(SCENARIO.controlAssignments).map(
  ([controlSlot, assignment]) => ({
    controlSlot,
    teamId: assignment.teamId,
    controlledPlayerId: assignment.controlledPlayerId,
    adapter: createCpuAdapter(),
  }),
);

const perTickHashes: string[] = [];
const initialHash = sim.stateHash();
perTickHashes.push(initialHash);

for (let i = 0; i < TICKS; i++) {
  const snapshot = sim.snapshot();

  // Compute one team decision per team from any observation on that team.
  const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
  for (const entry of entries) {
    if (!teamDecisions.has(entry.teamId)) {
      const obs = buildCpuObservation(
        snapshot,
        entry.teamId,
        entry.controlledPlayerId,
      );
      teamDecisions.set(entry.teamId, computeTeamDecision(obs, entry.teamId));
    }
  }

  const frames = entries.map((entry) => {
    const obs = buildCpuObservation(
      snapshot,
      entry.teamId,
      entry.controlledPlayerId,
    );
    obs.teamDecision = teamDecisions.get(entry.teamId);
    const frame = entry.adapter.sample(sim.tick, obs);
    frame.controlSlot = entry.controlSlot;
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
  class: "DYNAMIC_VISUAL",
  scenario: "3v3-fixture.v1",
  mode: "ai-match-3v3",
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
