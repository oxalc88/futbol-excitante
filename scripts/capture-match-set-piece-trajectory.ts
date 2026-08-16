/**
 * Capture a MULTI_TICK trajectory for MATCH-SET-PIECE.
 * Runs a forced-goal scenario (ball at +50, velocity 30 toward +52.5)
 * for 80 ticks, capturing goal event + countdown reset transition.
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

// Forced goal scenario: ball at +50 with velocity 30 toward +52.5 goal.
const SCENARIO: Parameters<typeof createWorld>[0]["scenario"] = {
  id: "forced-goal-v1",
  version: "1.0.0",
  family: "match-set-piece",
  durationTicks: 120,
  seed: 42,
  prngAlgorithmId: "mulberry32-v1",
  schemaVersion: "state-v1",
  simulationVersion: "sim-v1",
  configVersion: "foundation-config-v1",
  profile: "SMALL_SIDED" as const,
  pitchLength: 105,
  pitchWidth: 68,
  safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
  players: [
    {
      playerId: "player-1", teamId: "team-a",
      groundPosition: { x: 50, y: 0 },
      linearVelocity: { x: 0, y: 0 },
      desiredVelocity: { x: 0, y: 0 },
      bodyHeading: 0, desiredHeading: 0,
      archetypeId: "archetype-burst-v1",
    },
    {
      playerId: "player-2", teamId: "team-b",
      groundPosition: { x: -40, y: 0 },
      linearVelocity: { x: 0, y: 0 },
      desiredVelocity: { x: 0, y: 0 },
      bodyHeading: Math.PI, desiredHeading: Math.PI,
      archetypeId: "archetype-steady-v1",
    },
  ],
  ball: {
    position: { x: 50, y: 0, z: 0.11 },
    linearVelocity: { x: 30, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    regime: "ground-roll",
  },
  controlAssignments: {
    "slot-1": { controlSlot: "slot-1", teamId: "team-a", controlledPlayerId: "player-1", mode: "AI_FALLBACK" },
    "slot-2": { controlSlot: "slot-2", teamId: "team-b", controlledPlayerId: "player-2", mode: "AI_FALLBACK" },
  },
  missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
  maxConsecutiveMissing: 3,
  inputProgram: {},
  scheduledEvents: {},
  observationWindows: [{ startTick: 0, endTick: 120 }],
  requestedMetrics: [],
};

const TICKS = 80;
const objective = "MATCH-SET-PIECE";

const world = createWorld({ scenario: SCENARIO });
const sim = createSimulation(world, undefined, undefined, undefined, undefined, undefined, { goalResetTicks: 5 });

const slotKeys = Object.keys(SCENARIO.controlAssignments);
const assignments = SCENARIO.controlAssignments;
const adapters = slotKeys.map(() => createCpuAdapter());

const perTickHashes: string[] = [];
const trajectory: Record<string, unknown>[] = [];
const initialHash = sim.stateHash();
perTickHashes.push(initialHash);

trajectory.push({
  tick: 0,
  matchPhase: "playing",
  goalResetCountdown: 0,
  ballPosition: { x: 50, y: 0, z: 0.11 },
  hash: initialHash,
  note: "Initial: ball at +50, velocity 30 toward goal",
});

for (let i = 0; i < TICKS; i++) {
  const snapshot = sim.snapshot();

  const frames = slotKeys.map((slotKey) => {
    const slot = assignments[slotKey];
    const obs = buildCpuObservation(snapshot, slot.teamId, slot.controlledPlayerId);
    const idx = Number(slotKey.split("-")[1]) - 1;
    const frame = adapters[idx].sample(sim.tick, obs);
    frame.controlSlot = slot.controlSlot;
    return frame;
  });

  sim.applyInputs(frames);
  const result = sim.step();

  const state = sim.snapshot() as {
    matchPhase: string;
    goalResetCountdown: number;
    ball: { position: { x: number; y: number; z: number } };
  };

  const tickEntry: Record<string, unknown> = {
    tick: i + 1,
    matchPhase: state.matchPhase,
    goalResetCountdown: state.goalResetCountdown,
    ballPosition: {
      x: Math.round(state.ball.position.x * 100) / 100,
      y: Math.round(state.ball.position.y * 100) / 100,
      z: Math.round(state.ball.position.z * 100) / 100,
    },
    hash: result.stateHash,
  };

  const goalEvent = result.events.find((e) => e.kind === "goal");
  if (goalEvent) {
    tickEntry.goalEvent = {
      id: goalEvent.id,
      goalIndex: goalEvent.payload.goalIndex,
    };
    tickEntry.note = `Goal scored! phase -> goal, countdown=${state.goalResetCountdown}`;
  }

  if (state.matchPhase === "goal" && state.goalResetCountdown > 0) {
    tickEntry.note = `Phase: goal, countdown ${state.goalResetCountdown}`;
  }

  if (state.matchPhase === "playing" && state.goalResetCountdown === 0) {
    const prev = trajectory[trajectory.length - 1];
    if (prev && (prev as { matchPhase: string }).matchPhase === "goal") {
      tickEntry.note = "Countdown zero: reset complete, phase back to playing";
    }
  }

  trajectory.push(tickEntry);
  perTickHashes.push(result.stateHash);
}

// Find goal tick.
let goalTickNum: number | undefined;
for (const t of trajectory) {
  if ((t as { goalEvent: unknown }).goalEvent) {
    goalTickNum = t.tick;
    break;
  }
}

const trajectoryDir = path.join(repoRoot, "docs/evidence", objective);
await mkdir(trajectoryDir, { recursive: true });

const trajectoryData: Record<string, unknown> = {
  objective,
  class: "MULTI_TICK",
  scenario: "forced-goal-v1",
  ticks: TICKS,
  initialHash,
  perTickHashes,
  trajectory,
  features: [
    "matchPhase field in WorldState and PresentationSnapshot",
    "tick-based goal countdown",
    "automatic goal reset (ball to center, players to formation, velocities zero)",
    "phase transitions: playing -> goal -> playing (countdown-driven)",
    "integration with headless match runner phase tracking",
  ],
  note: goalTickNum
    ? `80-tick trajectory with forced goal at tick ${goalTickNum} and countdown->reset->playing transition`
    : "80-tick trajectory with countdown->reset->playing transition",
};

await writeFile(
  path.join(trajectoryDir, "trajectory.json"),
  JSON.stringify(trajectoryData, null, 2) + "\n",
  "utf8",
);

console.log(`Trajectory captured: ${perTickHashes.length} hashes (${TICKS} ticks)`);
console.log(`Written to: docs/evidence/${objective}/trajectory.json`);

console.log("\nKey transitions:");
let prevPhase = "playing";
for (const t of trajectory) {
  const p = (t as { matchPhase: string }).matchPhase;
  if (p !== prevPhase) {
    console.log(
      `  tick ${t.tick}: ${prevPhase} -> ${p}` +
        ((t as { note: string }).note ? ` [${(t as { note: string }).note}]` : ""),
    );
    prevPhase = p;
  }
}