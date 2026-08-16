/**
 * Capture a MULTI_TICK trajectory for CPU-3V3-TEAMPLAY.
 *
 * Runs a 3v3 AI match with 6 CPU adapters, capturing per-tick
 * state hashes, formation positions, and CPU input frames.
 *
 * Evidence class: MULTI_TICK
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

const TICKS = 120;
const objective = "CPU-3V3-TEAMPLAY";

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
const formationSnapshots: Array<{
  tick: number;
  players: Array<{
    playerId: string;
    teamId: string;
    role?: string;
    position: { x: number; y: number };
    formationPosition?: { x: number; y: number };
  }>;
  teamDecisions: Array<{
    teamId: string;
    strategy: string;
    nearestToBallPlayerId: string | undefined;
  }>;
}> = [];
const inputSnapshots: Array<{
  tick: number;
  inputs: Array<{
    controlSlot: string;
    playerId: string;
    moveX: number;
    moveY: number;
    sprint: number;
    pressedButtons: number;
    heldButtons: number;
  }>;
}> = [];

// Capture initial state.
formationSnapshots.push({
  tick: 0,
  players: sim.snapshot().players.map((p) => ({
    playerId: p.playerId,
    teamId: p.teamId,
    position: { ...p.groundPosition },
    formationPosition: undefined,
  })),
  teamDecisions: [],
});

for (let i = 0; i < TICKS; i++) {
  const snapshot = sim.snapshot();

  // Compute team decisions for both teams.
  const teamDecisions = ["team-a", "team-b"].map((teamId) => {
    // Build observation for team-a to compute team decision.
    const obs = buildCpuObservation(snapshot, teamId);
    const decision = computeTeamDecision(obs, teamId);
    return {
      teamId,
      strategy: decision.strategy,
      nearestToBallPlayerId: decision.nearestToBallPlayerId,
    };
  });

  // Build observations and capture formation positions.
  const obsMap = entries.map(({ controlSlot, assignment, adapter }) => {
    const obs = buildCpuObservation(
      snapshot,
      assignment.teamId,
      assignment.controlledPlayerId,
    );
    // Inject the shared team decision.
    const teamDecision = teamDecisions.find((td) => td.teamId === assignment.teamId);
    if (teamDecision) {
      obs.teamDecision = {
        strategy: teamDecision.strategy,
        nearestToBallPlayerId: teamDecision.nearestToBallPlayerId,
        nearestToBallDistance: 0,
        hasPossession: false,
        ballZone: "center",
      };
    }
    return { controlSlot, obs, adapter };
  });

  // Capture formation positions at each tick.
  formationSnapshots.push({
    tick: i + 1,
    players: entries.map(({ assignment, adapter }) => {
      const obs = buildCpuObservation(
        snapshot,
        assignment.teamId,
        assignment.controlledPlayerId,
      );
      return {
        playerId: assignment.controlledPlayerId,
        teamId: assignment.teamId,
        role: obs.players.find((p) => p.playerId === assignment.controlledPlayerId)
          ?.formationRole,
        position: { ...snapshot.players.find((p) => p.playerId === assignment.controlledPlayerId)
          ?.groundPosition ?? { x: 0, y: 0 } },
        formationPosition: obs.formationPosition,
      };
    }),
    teamDecisions,
  });

  // Generate input frames.
  const inputFrames = obsMap.map(({ controlSlot, obs, adapter }) => {
    const frame = adapter.sample(sim.tick, obs);
    frame.controlSlot = controlSlot;
    return {
      controlSlot,
      playerId: obs.controlledPlayerId ?? "unknown",
      moveX: frame.moveX,
      moveY: frame.moveY,
      sprint: frame.sprint,
      pressedButtons: frame.pressedButtons,
      heldButtons: frame.heldButtons,
    };
  });

  inputSnapshots.push({
    tick: i + 1,
    inputs: inputFrames,
  });

  const frames = obsMap.map(({ controlSlot, obs, adapter }) => {
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
  formationSnapshots,
  inputSnapshots,
  generatedAt: new Date().toISOString(),
};

await writeFile(
  path.join(trajectoryDir, "trajectory.json"),
  JSON.stringify(trajectory, null, 2) + "\n",
  "utf8",
);

console.log(`Trajectory captured: ${perTickHashes.length} hashes (${TICKS} ticks)`);
console.log(`Written to: docs/evidence/${objective}/trajectory.json`);