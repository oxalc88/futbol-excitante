import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createWorld } from "../src/simulation/world/create.js";
import { createSimulation } from "../src/simulation/loop/simulation.js";
import { buildCpuObservation, createCpuAdapter } from "../src/adapters/input-browser/cpu-adapter.js";
import { FOUNDATION_SCENARIO_AI_VS_AI } from "../src/apps/browser/foundation-scenario.js";

const objectiveId = process.env.WIP_SECTION ?? "ai-match";
const ticks = Number(process.env.WIP_TICKS ?? 360);
const sim = createSimulation(createWorld({ scenario: FOUNDATION_SCENARIO_AI_VS_AI }));
const entries = Object.entries(FOUNDATION_SCENARIO_AI_VS_AI.controlAssignments).map(([controlSlot, assignment]) => ({
  controlSlot,
  assignment,
  adapter: createCpuAdapter(),
}));
const samples: unknown[] = [];
let actionEdges = 0;
for (let i = 0; i < ticks; i++) {
  const before = sim.snapshot();
  const frames = entries.map(({ controlSlot, assignment, adapter }) => {
    const obs = buildCpuObservation(before, assignment.teamId, assignment.controlledPlayerId);
    const frame = adapter.sample(sim.tick, obs);
    frame.controlSlot = controlSlot;
    if (frame.pressedButtons !== 0) actionEdges++;
    return frame;
  });
  sim.applyInputs(frames);
  sim.step();
  if (i === 0 || (i + 1) % 60 === 0 || i === ticks - 1) {
    const state = sim.snapshot();
    samples.push({
      tick: sim.tick,
      players: state.players.map((p) => ({ playerId: p.playerId, x: p.groundPosition.x, y: p.groundPosition.y })),
      ball: { x: state.ball.position.x, y: state.ball.position.y, z: state.ball.position.z },
      stateHash: sim.stateHash(),
    });
  }
}
const outDir = path.join("docs", "evidence", objectiveId);
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, "trajectory.json");
await writeFile(outFile, JSON.stringify({ schemaVersion: 1, objectiveId, scenarioId: FOUNDATION_SCENARIO_AI_VS_AI.id, ticks, actionEdges, samples }, null, 2) + "\n");
console.log(outFile);
