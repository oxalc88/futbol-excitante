/**
 * Capture a MULTI_TICK trajectory for MATCH-TIMER-ENFORCEMENT.
 * Runs a short 3v3 match (50 ticks per half, 60-tick halftime countdown)
 * capturing the full lifecycle: playing → halftime → playing → fulltime.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorld } from "../src/simulation/world/create.js";
import { createSimulation } from "../src/simulation/loop/simulation.js";
import { hashFnv1a64, encodeCanonical } from "../src/simulation/determinism/index.js";
import { NO_OP_OBSERVER } from "../src/simulation/telemetry/observer.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const objective = "MATCH-TIMER-ENFORCEMENT";

// Short match: 25 ticks per half, 10-tick halftime countdown.
const SCENARIO = {
  id: "match-timer-traj-v1",
  version: "1.0.0",
  family: "match-timer",
  durationTicks: 200,
  matchDurationTicks: 25,
  seed: 42,
  prngAlgorithmId: "mulberry32-v1",
  schemaVersion: "state-v1",
  simulationVersion: "sim-v1",
  configVersion: "foundation-config-v1",
  profile: "LABORATORY" as const,
  pitchLength: 105,
  pitchWidth: 68,
  safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
  players: [
    { playerId: "player-1", teamId: "team-a", groundPosition: { x: 0, y: 0 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0, archetypeId: "archetype-burst-v1" },
    { playerId: "player-2", teamId: "team-b", groundPosition: { x: 40, y: 0 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: Math.PI, desiredHeading: Math.PI, archetypeId: "archetype-steady-v1" },
  ],
  ball: { position: { x: 0, y: 0, z: 0.11 }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, regime: "ground-roll" },
  controlAssignments: {
    "slot-1": { controlSlot: "slot-1", teamId: "team-a", controlledPlayerId: "player-1", mode: "AI_FALLBACK" },
    "slot-2": { controlSlot: "slot-2", teamId: "team-b", controlledPlayerId: "player-2", mode: "AI_FALLBACK" },
  },
  missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
  maxConsecutiveMissing: 3,
  inputProgram: {},
  scheduledEvents: {},
  observationWindows: [{ startTick: 0, endTick: 200 }],
  requestedMetrics: [],
};

async function main() {
  const sim = createSimulation(createWorld({ scenario: SCENARIO }), NO_OP_OBSERVER);

  const perTickHashes: string[] = [];
  const initialHash = sim.stateHash();

  for (let i = 0; i < 120; i++) {
    sim.applyInputs([]);
    const result = sim.step();
    perTickHashes.push(result.stateHash);
  }

  const trajectory = {
    objective,
    class: "MULTI_TICK",
    scenario: "match-timer-traj-v1",
    ticks: 120,
    initialHash,
    perTickHashes,
  };

  const trajectoryDir = path.join(repoRoot, "docs/evidence", objective);
  await mkdir(trajectoryDir, { recursive: true });
  await writeFile(
    path.join(trajectoryDir, "trajectory.json"),
    JSON.stringify(trajectory, null, 2) + "\n",
  );
  console.log(`Written to: docs/evidence/${objective}/trajectory.json`);
}

main().catch(console.error);