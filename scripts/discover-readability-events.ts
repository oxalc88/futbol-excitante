/**
 * Headless event discovery for SMALL-SIDED-VISUAL-READABILITY-EVIDENCE.
 *
 * Runs the 3v3 simulation with CPU controllers, records events per tick,
 * and outputs which ticks to capture for each of the 8 readability dimensions.
 *
 * Usage: npx tsx scripts/discover-readability-events.ts
 */
import { createWorld } from "../src/simulation/world/create.js";
import { createSimulation } from "../src/simulation/loop/simulation.js";
import { FOUNDATION_SCENARIO_3V3 } from "../src/apps/browser/foundation-scenario.js";
import { buildCpuObservation, createCpuAdapter } from "../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../src/adapters/input-browser/team-decision-profile.js";
import { writeFileSync } from "node:fs";

const TICKS = 720;

const world = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });
const sim = createSimulation(world);

const cpuEntries = Object.entries(FOUNDATION_SCENARIO_3V3.controlAssignments).map(
  ([controlSlot, assignment]) => ({
    controlSlot,
    teamId: assignment.teamId,
    controlledPlayerId: assignment.controlledPlayerId,
    adapter: createCpuAdapter(),
  }),
);

// Collect ALL events per tick
const allEvents: Array<{ tick: number; kind: string; label: string; payload: Record<string, unknown> }> = [];
const perTickHashes: string[] = [];

for (let i = 0; i < TICKS; i++) {
  const snapshot = sim.snapshot();
  const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();

  for (const entry of cpuEntries) {
    if (!teamDecisions.has(entry.teamId)) {
      const obs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
      teamDecisions.set(entry.teamId, computeTeamDecision(obs, entry.teamId));
    }
  }

  const frames = cpuEntries.map((entry) => {
    const obs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
    obs.teamDecision = teamDecisions.get(entry.teamId);
    const frame = entry.adapter.sample(sim.tick, obs);
    frame.controlSlot = entry.controlSlot;
    return frame;
  });

  sim.applyInputs(frames);
  const result = sim.step();
  perTickHashes.push(result.stateHash);

  for (const ev of result.events) {
    allEvents.push({ tick: ev.tick, kind: ev.kind, label: ev.label, payload: ev.payload as Record<string, unknown> });
  }
}

// Summary of event kinds found
const kinds: Record<string, number[]> = {};
for (const ev of allEvents) {
  if (!kinds[ev.kind]) kinds[ev.kind] = [];
  kinds[ev.kind].push(ev.tick);
}

console.log("=== Event kind counts ===");
for (const [k, ticks] of Object.entries(kinds)) {
  console.log(`  ${k}: ${ticks.length} events (first 10: ${ticks.slice(0, 10).join(", ")}${ticks.length > 10 ? "..." : ""})`);
}

// Map the 8 dimensions to suitable events/ticks
const ppcEvents = kinds["player-player-contact"] ?? [];
const pbcEvents = kinds["player-ball-contact"] ?? [];
const shotEvents = kinds["shot"] ?? [];
const passEvents = kinds["pass"] ?? [];
const secondTouchEvents = kinds["second-touch"] ?? [];

const tickMap: Record<string, { before: number; event: number; after: number; eventKind: string; note: string }> = {};

// 1. ball_readability_under_congestion → player-player-contact with nearby ball
if (ppcEvents.length > 0) {
  let bestTick = ppcEvents[0];
  for (const t of ppcEvents) {
    const nearby = pbcEvents.find(pb => Math.abs(pb - t) < 10);
    if (nearby !== undefined) { bestTick = t; break; }
  }
  tickMap["ball_readability_under_congestion"] = {
    before: Math.max(0, bestTick - 12),
    event: bestTick,
    after: Math.min(TICKS - 1, bestTick + 15),
    eventKind: "player-player-contact (congested ball area)",
    note: "Ball visibility among multiple converging players"
  };
}

// 2. team_classification → settled play at tick 120
tickMap["team_classification"] = {
  before: 105, event: 120, after: 135,
  eventKind: "settled play",
  note: "Two distinct team colors visible across the pitch"
};

// 3. facing_orientation → player movement change
{
  const t = ppcEvents.length > 2 ? ppcEvents[2] : (passEvents.length > 2 ? passEvents[2] : 200);
  tickMap["facing_orientation"] = {
    before: Math.max(0, t - 10), event: t, after: Math.min(TICKS - 1, t + 12),
    eventKind: "player movement change",
    note: "Player body headings visible, showing orientation toward ball/goal"
  };
}

// 4. action_recognition → shot or pass sequence
if (shotEvents.length > 0) {
  const t = shotEvents[0];
  tickMap["action_recognition"] = {
    before: Math.max(0, t - 15), event: t, after: Math.min(TICKS - 1, t + 20),
    eventKind: "shot",
    note: "Shot action identifiable from player posture and ball trajectory"
  };
} else if (passEvents.length > 2) {
  const t = passEvents[2];
  tickMap["action_recognition"] = {
    before: Math.max(0, t - 12), event: t, after: Math.min(TICKS - 1, t + 15),
    eventKind: "pass",
    note: "Passing action identifiable from player posture and ball trajectory"
  };
}

// 5. contact_comprehension → player-player-contact
if (ppcEvents.length > 0) {
  const t = ppcEvents[0];
  tickMap["contact_comprehension"] = {
    before: Math.max(0, t - 10), event: t, after: Math.min(TICKS - 1, t + 15),
    eventKind: "player-player-contact",
    note: "Two opposing players in physical contact, kits overlapping"
  };
}

// 6. team_shape_readability → settled defensive block at tick 240
tickMap["team_shape_readability"] = {
  before: 228, event: 240, after: 252,
  eventKind: "settled play",
  note: "Defensive team shape visible with 3 players in formation"
};

// 7. camera_readability → active ball movement
{
  const t = passEvents.length > 3 ? passEvents[3] : (passEvents.length > 0 ? passEvents[passEvents.length - 1] : 300);
  tickMap["camera_readability"] = {
    before: Math.max(0, t - 10), event: t, after: Math.min(TICKS - 1, t + 10),
    eventKind: "pass",
    note: "Camera tracks the ball during active play, showing full pitch context"
  };
}

// 8. silhouette_stability → steady movement at tick 420
tickMap["silhouette_stability"] = {
  before: 408, event: 420, after: 432,
  eventKind: "continuous play",
  note: "Player silhouettes remain stable and readable during ongoing movement"
};

console.log("\n=== Tick Map ===");
console.log(JSON.stringify(tickMap, null, 2));
console.log(`\nPer-tick hashes: ${perTickHashes.length} ticks`);

// Write tick map and event data
writeFileSync("docs/evidence/SMALL-SIDED-VISUAL-READABILITY-EVIDENCE/tick-map.json",
  JSON.stringify({ tickMap, perTickHashes }, null, 2));
console.log("Wrote docs/evidence/SMALL-SIDED-VISUAL-READABILITY-EVIDENCE/tick-map.json");
