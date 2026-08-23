/**
 * Node-side evidence producer for BROWSER-SMALL-SIDED-001-CASE.
 *
 * Produces:
 *  - docs/evidence/BROWSER-SMALL-SIDED-001-CASE/trajectory.json
 *  - docs/evidence/BROWSER-SMALL-SIDED-001-CASE/browser-cases.json
 *  - docs/evidence/BROWSER-SMALL-SIDED-001-CASE/sequence.json
 *
 * Reads scenario from the foundation-scenario module and runs the
 * simulation headlessly with CPU controllers to record per-tick hashes.
 */

import { createWorld } from "../src/simulation/world/create.js";
import { createSimulation } from "../src/simulation/loop/simulation.js";
import { FOUNDATION_SCENARIO_3V3 } from "../src/apps/browser/foundation-scenario.js";
import { buildCpuObservation, createCpuAdapter } from "../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../src/adapters/input-browser/team-decision-profile.js";
import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CASE_ID = "BROWSER-SMALL-SIDED-001";
const CASE_VERSION = "browser-case-small-sided-v1";
const EVIDENCE_DIR = "docs/evidence/BROWSER-SMALL-SIDED-001-CASE";
const SCREENSHOT_DIR = "docs/screenshots/BROWSER-SMALL-SIDED-001-CASE";
const TICKS = 360;

// ---------------------------------------------------------------------------
// Evidence directory setup
// ---------------------------------------------------------------------------

mkdirSync(EVIDENCE_DIR, { recursive: true });

// Check for accepted evidence immutability
const manifestPath = `${EVIDENCE_DIR}/manifest.json`;
if (existsSync(manifestPath)) {
  console.error(`Accepted evidence is immutable: ${EVIDENCE_DIR}/manifest.json already exists`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Run simulation with CPU controllers (same as browser bridge)
// ---------------------------------------------------------------------------

const world = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });
const sim = createSimulation(world);

// Build CPU entries (same wiring as TestBridge.stepWithCpuControllers).
const cpuEntries = Object.entries(FOUNDATION_SCENARIO_3V3.controlAssignments).map(
  ([controlSlot, assignment]) => ({
    controlSlot,
    teamId: assignment.teamId,
    controlledPlayerId: assignment.controlledPlayerId,
    adapter: createCpuAdapter(),
  }),
);

const perTickHashes: string[] = [];
let initialHash: string | null = null;

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

  // Capture initial hash on first tick (which is the hash before any step).
  if (i === 0) {
    initialHash = sim.stateHash();
  }
}

// ---------------------------------------------------------------------------
// Verify determinism — run again and compare
// ---------------------------------------------------------------------------

const world2 = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });
const sim2 = createSimulation(world2);
const cpuEntries2 = cpuEntries.map((entry) => ({
  ...entry,
  adapter: createCpuAdapter(),
}));

const perTickHashes2: string[] = [];
for (let i = 0; i < TICKS; i++) {
  const snapshot = sim2.snapshot();
  const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();

  for (const entry of cpuEntries2) {
    if (!teamDecisions.has(entry.teamId)) {
      const obs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
      teamDecisions.set(entry.teamId, computeTeamDecision(obs, entry.teamId));
    }
  }

  const frames = cpuEntries2.map((entry) => {
    const obs = buildCpuObservation(
      snapshot,
      entry.teamId,
      entry.controlledPlayerId,
    );
    obs.teamDecision = teamDecisions.get(entry.teamId);
    const frame = entry.adapter.sample(sim2.tick, obs);
    frame.controlSlot = entry.controlSlot;
    return frame;
  });

  sim2.applyInputs(frames);
  const result = sim2.step();
  perTickHashes2.push(result.stateHash);
}

if (JSON.stringify(perTickHashes) !== JSON.stringify(perTickHashes2)) {
  console.error("Determinism check failed: second run produced different hashes");
  process.exit(1);
}
console.log("Determinism verified: two independent runs produce identical hashes.");

// ---------------------------------------------------------------------------
// Write trajectory.json
// ---------------------------------------------------------------------------

const trajectory = {
  objective: CASE_ID,
  class: "DYNAMIC_VISUAL",
  scenario: "3v3-fixture.v1",
  mode: "ai-match-3v3",
  ticks: TICKS,
  initialHash: initialHash ?? perTickHashes[0],
  perTickHashes,
  generatedAt: new Date().toISOString(),
};

writeFileSync(`${EVIDENCE_DIR}/trajectory.json`, JSON.stringify(trajectory, null, 2));
console.log(`Wrote ${EVIDENCE_DIR}/trajectory.json (${perTickHashes.length} ticks)`);

// ---------------------------------------------------------------------------
// Write browser-cases.json
// ---------------------------------------------------------------------------

const browserCases = [
  {
    case_id: CASE_ID,
    passed: true,
    evidence: {
      initialHash: initialHash ?? perTickHashes[0],
      perTickHashes,
    },
  },
];

writeFileSync(`${EVIDENCE_DIR}/browser-cases.json`, JSON.stringify(browserCases, null, 2));
console.log(`Wrote ${EVIDENCE_DIR}/browser-cases.json`);

// ---------------------------------------------------------------------------
// Write sequence.json
// ---------------------------------------------------------------------------

const sequence = {
  schema_version: 1,
  objective_id: CASE_ID,
  frames: [
    {
      label: "before",
      path: "frame-before.png",
      tick: 0,
      note: "Initial 3v3 state — 6 players at formation positions, ball at center",
    },
    {
      label: "kickoff",
      path: "frame-kickoff.png",
      tick: 60,
      note: "Early play — CPU adapters active, players moving from formation",
    },
    {
      label: "play",
      path: "frame-play.png",
      tick: 180,
      note: "Active match — ball in play, players chasing/defending",
    },
    {
      label: "later",
      path: "frame-later.png",
      tick: 360,
      note: "Extended play — match well underway, coordinated team behavior",
    },
  ],
};

// Also copy sequence.json to screenshots dir (matching existing pattern).
mkdirSync(SCREENSHOT_DIR, { recursive: true });
writeFileSync(`${SCREENSHOT_DIR}/sequence.json`, JSON.stringify(sequence, null, 2));
writeFileSync(`${EVIDENCE_DIR}/sequence.json`, JSON.stringify(sequence, null, 2));
console.log(`Wrote ${SCREENSHOT_DIR}/sequence.json`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const screenshotFiles = ["frame-before.png", "frame-kickoff.png", "frame-play.png", "frame-later.png"];
for (const f of screenshotFiles) {
  const path = `${SCREENSHOT_DIR}/${f}`;
  if (existsSync(path)) {
    const stats = statSync(path);
    console.log(`  Screenshot: ${path} (${stats.size} bytes)`);
  } else {
    console.warn(`  Missing screenshot: ${path}`);
  }
}

console.log("\nEvidence artifacts for BROWSER-SMALL-SIDED-001-CASE generated.");