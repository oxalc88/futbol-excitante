/**
 * Capture a MULTI_TICK trajectory for CPU-DEFENSIVE-IMPROVEMENT.
 *
 * Runs a 3v3 AI match with team-decision wiring and defensive
 * sub-modes, capturing per-tick state hashes and defensive
 * behavior snapshots.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorld } from "../src/simulation/world/create.js";
import { createSimulation } from "../src/simulation/loop/simulation.js";
import {
  buildCpuObservation,
  computeTeamDecision,
  createCpuAdapter,
} from "../src/adapters/input-browser/cpu-adapter.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// Import the 3v3 scenario.
const scenarioModule = await import("../src/apps/browser/foundation-scenario.js");
const SCENARIO = scenarioModule.FOUNDATION_SCENARIO_3V3;

const TICKS = 100;
const objective = "CPU-DEFENSIVE-IMPROVEMENT";

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

// Group slots by team for shared team-decision wiring.
const slotsByTeam = new Map<string, typeof entries>();
for (const entry of entries) {
  const list = slotsByTeam.get(entry.assignment.teamId) ?? [];
  list.push(entry);
  slotsByTeam.set(entry.assignment.teamId, list);
}

const perTickHashes: string[] = [];
const defensiveSnapshots: Array<{
  tick: number;
  teamDecisions: Record<string, {
    strategy: string;
    defensiveSubMode: string;
    ballZone: string;
    nearestToBallDistance: number;
  }>;
}> = [];

for (let i = 0; i < TICKS; i++) {
  const snapshot = sim.snapshot();

  // Compute team decisions.
  const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
  for (const [teamId, teamEntries] of slotsByTeam) {
    const firstEntry = teamEntries[0];
    const obs = buildCpuObservation(
      snapshot,
      firstEntry.assignment.teamId,
      firstEntry.assignment.controlledPlayerId,
    );
    teamDecisions.set(teamId, computeTeamDecision(obs, teamId));
  }

  // Capture defensive snapshot.
  const tdSnapshot: Record<string, {
    strategy: string;
    defensiveSubMode: string;
    ballZone: string;
    nearestToBallDistance: number;
  }> = {};
  for (const [teamId, td] of teamDecisions) {
    tdSnapshot[teamId] = {
      strategy: td.strategy,
      defensiveSubMode: td.defensiveSubMode,
      ballZone: td.ballZone,
      nearestToBallDistance: Math.round(td.nearestToBallDistance * 100) / 100,
    };
  }
  defensiveSnapshots.push({
    tick: i + 1,
    teamDecisions: tdSnapshot,
  });

  // Build frames with team decisions wired in.
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
  scenario: "3v3-fixture.v1",
  ticks: TICKS,
  initialHash: perTickHashes[0],
  perTickHashes,
  defensiveSnapshots,
  generatedAt: new Date().toISOString(),
};

await writeFile(
  path.join(trajectoryDir, "trajectory.json"),
  JSON.stringify(trajectory, null, 2) + "\n",
  "utf8",
);

console.log(`Trajectory captured: ${perTickHashes.length} hashes (${TICKS} ticks)`);
console.log(`Written to: docs/evidence/${objective}/trajectory.json`);
