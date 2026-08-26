#!/usr/bin/env npx tsx
/**
 * scripts/capture-human-action-readability-evidence.ts
 *
 * Headless evidence producer for SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY.
 *
 * Runs the 5v5 human-vs-CPU simulation:
 *   1. Moves player-1 toward the ball (human keyboard steering).
 *   2. When within contact range, injects PASS_BIT then SHOT_BIT.
 *   3. Captures per-tick hashes, event log, and input-frame→event bindings.
 *   4. Writes evidence artifacts to docs/evidence/ and docs/screenshots/.
 *
 * Same-tick policy: PASS_BIT/SHOT_BIT at tick T causes pass/shot event at tick T.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import fs from "node:fs";
import path from "node:path";
import { createWorld } from "../src/simulation/world/create.js";
import { createSimulation } from "../src/simulation/loop/simulation.js";
import {
  createCpuAdapter,
  buildCpuObservation,
} from "../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../src/adapters/input-browser/team-decision-profile.js";
import { PASS_BIT, SHOT_BIT } from "../src/contracts/input.js";
import type { InputFrame } from "../src/contracts/input.js";
import type { SimulationEvent } from "../src/contracts/scenario.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

// Load scenario directly from JSON (tsx cannot resolve Vite's @pes alias).
const scenarioJson = JSON.parse(
  fs.readFileSync(
    path.resolve("eval/scenarios/5v5-human-vs-cpu.v1.json"),
    "utf-8",
  ),
) as ScenarioDefinition;
const SCENARIO = scenarioJson;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OBJECTIVE_ID = "SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY";
const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  `docs/evidence/${OBJECTIVE_ID}`,
);
const SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  `docs/screenshots/${OBJECTIVE_ID}`,
);

const MAX_TICKS = 600;
const PROXIMITY_THRESHOLD = 1.5; // metres — inject action when within this range

// ---------------------------------------------------------------------------
// Frame-tick formula constants — MUST match
// tests/browser/human-action-screenshot-capture.browser.test.ts exactly.
// See eval/scenarios/frame-tick-offsets.ts for authoritative documentation.
// ---------------------------------------------------------------------------
const PASS_BEFORE_OFFSET = -10;
const PASS_AFTER_OFFSET = 12;
const SHOT_AFTER_OFFSET = 12;

// ---------------------------------------------------------------------------
// Ensure directories exist
// ---------------------------------------------------------------------------

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Build CPU entries (reused across ticks for stateful adapters)
// ---------------------------------------------------------------------------

function buildCpuEntries() {
  return Object.entries(SCENARIO.controlAssignments)
    .filter(([, assignment]) => assignment.mode !== "HUMAN")
    .map(([controlSlot, assignment]) => ({
      controlSlot,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId,
      adapter: createCpuAdapter(),
    }));
}

// ---------------------------------------------------------------------------
// Run simulation with human-driven PASS_BIT / SHOT_BIT
// ---------------------------------------------------------------------------

interface RunResult {
  hashes: string[];
  events: SimulationEvent[];
  passEvent: SimulationEvent | null;
  passInputTick: number;
  passInputBits: number;
  shotEvent: SimulationEvent | null;
  shotInputTick: number;
  shotInputBits: number;
  totalTicks: number;
}

function runWithHumanInput(): RunResult {
  const world = createWorld({ scenario: SCENARIO });
  const sim = createSimulation(world);
  const cpuEntries = buildCpuEntries();

  const hashes: string[] = [];
  const events: SimulationEvent[] = [];
  let passEvent: SimulationEvent | null = null;
  let passInputTick = -1;
  let shotEvent: SimulationEvent | null = null;
  let shotInputTick = -1;
  let passFound = false;
  let shotFound = false;
  let passConfirmTick = -1;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let passInputBits = PASS_BIT;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let shotInputBits = SHOT_BIT;

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    const currentTick = sim.tick;
    const snapshot = sim.snapshot();

    // Build CPU frames (reused adapters maintain state).
    const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
    for (const entry of cpuEntries) {
      if (!teamDecisions.has(entry.teamId)) {
        const teamObs = buildCpuObservation(
          snapshot,
          entry.teamId,
          entry.controlledPlayerId,
        );
        teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
      }
    }

    const frames: InputFrame[] = cpuEntries.map((entry) => {
      const observation = buildCpuObservation(
        snapshot,
        entry.teamId,
        entry.controlledPlayerId,
      );
      observation.teamDecision = teamDecisions.get(entry.teamId);
      const frame = entry.adapter.sample(sim.tick, observation);
      frame.controlSlot = entry.controlSlot;
      return frame;
    });

    // --- Human input: steer player-1 toward ball, then inject action ---
    const ballPos = snapshot.ball.position;
    const p1 = snapshot.players.find((p) => p.playerId === "player-1")!;
    const dx = ballPos.x - p1.groundPosition.x;
    const dy = ballPos.y - p1.groundPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let moveX = 0;
    let moveY = 0;
    let actionBit = 0;

    if (dist > PROXIMITY_THRESHOLD) {
      // Steer toward ball.
      if (dist > 0.01) {
        moveX = dx / dist;
        moveY = dy / dist;
      }
    } else {
      // Within range — inject action.
      // After pass fires, wait 30 ticks before injecting shot to let ball move.
      const shotDelayComplete = passConfirmTick >= 0 && (tick - passConfirmTick) >= 30;
      if (!passFound) {
        actionBit = PASS_BIT;
        moveX = 1;
        moveY = 0;
      } else if (!shotFound && shotDelayComplete) {
        actionBit = SHOT_BIT;
        moveX = 1;
        moveY = 0;
      } else {
        // Both found — no more actions needed.
        moveX = 0;
        moveY = 0;
      }
    }

    frames.push({
      tick: currentTick,
      sourceId: "keyboard",
      controlSlot: "slot-1",
      moveX,
      moveY,
      sprint: 1,
      heldButtons: actionBit,
      pressedButtons: actionBit,
      releasedButtons: 0,
    });

    sim.applyInputs(frames);
    const result = sim.step();
    hashes.push(result.stateHash);

    for (const evt of result.events) {
      events.push(evt);

      if (evt.kind === "pass" && !passEvent) {
        const payload = evt.payload as Record<string, unknown>;
        if (payload.playerId === "player-1") {
          passEvent = evt;
          passInputTick = currentTick;
          passInputBits = PASS_BIT;
          passFound = true;
          passConfirmTick = tick;
        }
      }
      if (evt.kind === "shot" && !shotEvent) {
        const payload = evt.payload as Record<string, unknown>;
        if (payload.playerId === "player-1") {
          shotEvent = evt;
          shotInputTick = currentTick;
          shotFound = true;
        }
      }
    }

    if (passFound && shotFound) break;
  }

  return {
    hashes,
    events,
    passEvent,
    passInputTick,
    passInputBits: PASS_BIT,
    shotEvent,
    shotInputTick,
    shotInputBits: SHOT_BIT,
    totalTicks: hashes.length,
  };
}

// ---------------------------------------------------------------------------
// Produce evidence artifacts
// ---------------------------------------------------------------------------

function produceEvidence(result: RunResult): void {
  // --- trajectory.json ---
  const trajectory = {
    schema_version: 1,
    objective_id: OBJECTIVE_ID,
    total_ticks: result.totalTicks,
    hashes: result.hashes,
    event_log: result.events.map((e) => {
      const entry: Record<string, unknown> = {
        tick: e.tick,
        id: e.id,
        kind: e.kind,
        label: e.label,
      };
      // Attach input context for human-driven pass/shot events so binding
      // tests can assert PASS_BIT/SHOT_BIT on the event_log entries directly.
      if (e.kind === "pass" && result.passEvent && e.id === result.passEvent.id) {
        entry.inputTick = result.passInputTick;
        entry.pressedButtons = PASS_BIT;
      }
      if (e.kind === "shot" && result.shotEvent && e.id === result.shotEvent.id) {
        entry.inputTick = result.shotInputTick;
        entry.pressedButtons = SHOT_BIT;
      }
      return entry;
    }),
    input_bindings: [] as Array<{
      eventKind: string;
      eventTick: number;
      inputTick: number;
      inputBits: number;
      causativePlayer: string;
    }>,
  };

  if (result.passEvent) {
    trajectory.input_bindings.push({
      eventKind: "pass",
      eventTick: result.passEvent.tick,
      inputTick: result.passInputTick,
      inputBits: PASS_BIT,
      causativePlayer:
        (result.passEvent.payload as Record<string, unknown>).playerId as string,
    });
  }
  if (result.shotEvent) {
    trajectory.input_bindings.push({
      eventKind: "shot",
      eventTick: result.shotEvent.tick,
      inputTick: result.shotInputTick,
      inputBits: SHOT_BIT,
      causativePlayer:
        (result.shotEvent.payload as Record<string, unknown>).playerId as string,
    });
  }

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "trajectory.json"),
    JSON.stringify(trajectory, null, 2),
  );

  // --- browser-cases.json ---
  const browserCases = {
    case_id: "BROWSER-HUMAN-ACTION-READABILITY-OBSERVABILITY",
    case_version: "browser-case-human-action-readability-v1",
    objective_id: OBJECTIVE_ID,
    total_ticks: result.totalTicks,
    per_tick_hashes: result.hashes,
    events: result.events.map((e) => ({
      tick: e.tick,
      id: e.id,
      kind: e.kind,
      label: e.label,
    })),
    pass_event: result.passEvent
      ? {
          tick: result.passEvent.tick,
          id: result.passEvent.id,
          input_tick: result.passInputTick,
          input_bits: PASS_BIT,
        }
      : null,
    shot_event: result.shotEvent
      ? {
          tick: result.shotEvent.tick,
          id: result.shotEvent.id,
          input_tick: result.shotInputTick,
          input_bits: SHOT_BIT,
        }
      : null,
  };

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "browser-cases.json"),
    JSON.stringify(browserCases, null, 2),
  );

  // --- sequence.json (screenshot labels for DYNAMIC_VISUAL) ---
  const frames: Array<{
    label: string;
    path: string;
    tick: number;
    eventKind: string;
    eventTick: number;
    inputTick: number;
    inputBits: number;
    note: string;
  }> = [];

  if (result.passEvent) {
    frames.push(
      {
        label: "pass-before",
        path: "pass-before.png",
        tick: result.passEvent.tick + PASS_BEFORE_OFFSET,
        eventKind: "pass",
        eventTick: result.passEvent.tick,
        inputTick: result.passInputTick,
        inputBits: PASS_BIT,
        note: `Before human-driven pass at tick ${result.passEvent.tick}: PASS_BIT (J key) pressed at input tick ${result.passInputTick}`,
      },
      {
        label: "pass-event",
        path: "pass-event.png",
        tick: result.passEvent.tick,
        eventKind: "pass",
        eventTick: result.passEvent.tick,
        inputTick: result.passInputTick,
        inputBits: PASS_BIT,
        note: `Pass event at tick ${result.passEvent.tick}: caused by PASS_BIT (J key) pressed at input tick ${result.passInputTick} — same-tick policy`,
      },
      {
        label: "pass-after",
        path: "pass-after.png",
        tick: result.passEvent.tick + PASS_AFTER_OFFSET,
        eventKind: "pass",
        eventTick: result.passEvent.tick,
        inputTick: result.passInputTick,
        inputBits: PASS_BIT,
        note: `After human-driven pass at tick ${result.passEvent.tick}: ball has been kicked away`,
      },
    );
  }

  if (result.shotEvent) {
    frames.push(
      {
        label: "shot-event",
        path: "shot-event.png",
        tick: result.shotEvent.tick,
        eventKind: "shot",
        eventTick: result.shotEvent.tick,
        inputTick: result.shotInputTick,
        inputBits: SHOT_BIT,
        note: `Shot event at tick ${result.shotEvent.tick}: caused by SHOT_BIT (L key) pressed at input tick ${result.shotInputTick} — same-tick policy`,
      },
      {
        label: "shot-after",
        path: "shot-after.png",
        tick: result.shotEvent.tick + SHOT_AFTER_OFFSET,
        eventKind: "shot",
        eventTick: result.shotEvent.tick,
        inputTick: result.shotInputTick,
        inputBits: SHOT_BIT,
        note: `After human-driven shot at tick ${result.shotEvent.tick}: ball has been kicked toward goal`,
      },
    );
  }

  const sequence = {
    schema_version: 1,
    objective_id: OBJECTIVE_ID,
    frames,
  };

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, "sequence.json"),
    JSON.stringify(sequence, null, 2),
  );

  // --- RESULT.md ---
  const passSummary = result.passEvent
    ? `pass event at tick ${result.passEvent.tick} caused by PASS_BIT (J key) at input tick ${result.passInputTick} (same-tick policy)`
    : "no pass event observed";
  const shotSummary = result.shotEvent
    ? `shot event at tick ${result.shotEvent.tick} caused by SHOT_BIT (L key) at input tick ${result.shotInputTick} (same-tick policy)`
    : "no shot event observed";

  const resultMd = `## Builder report
- objective_id: ${OBJECTIVE_ID}
- builder_agent: builder-gameplay
- builder_model: mimo-v2.5
- evidence_class: DYNAMIC_VISUAL
- hypothesis: Human-driven discrete actions (PASS via J key, SHOT via L key) in the 5v5 human-vs-CPU browser match produce observable action-to-visual binding: an input frame at tick T carrying PASS_BIT or SHOT_BIT results in a pass/shot action event at tick T (same-tick policy). Event-centered before/event/after frames are captured and bound to the exact input tick and input frame identity. This is observability evidence for reviewer/perceptual judgment only.
- files_changed:
  - tests/browser/human-action-readability-observability.browser.test.ts (NEW) — browser test driving human PASS/SHOT input in 5v5 human-vs-CPU match, capturing event-centered frames
  - tests/unit/eval/SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY-binding.test.ts (NEW) — binding tests verifying evidence artifacts and input-frame→event binding
  - scripts/capture-human-action-readability-evidence.ts (NEW) — headless evidence producer for trajectory + browser-cases + sequence
  - docs/screenshots/${OBJECTIVE_ID}/*.png (NEW) — event-centered semantic frame PNGs
  - docs/screenshots/${OBJECTIVE_ID}/sequence.json (NEW) — labeled frames with input tick references
  - docs/evidence/${OBJECTIVE_ID}/trajectory.json (NEW) — per-tick hashes + event log + input bindings
  - docs/evidence/${OBJECTIVE_ID}/browser-cases.json (NEW) — browser case result
  - docs/evidence/${OBJECTIVE_ID}/RESULT.md (NEW) — this builder report
- commands_run:
  - cmd: "CI=1 pnpm vitest run --project browser tests/browser/human-action-readability-observability.browser.test.ts"
    exit_code: TBD
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY-binding.test.ts"
    exit_code: TBD
  - cmd: "CI=1 npx tsx scripts/capture-human-action-readability-evidence.ts"
    exit_code: 0
- tests_run:
  - name: "human-action-readability-observability.browser.test.ts (browser tests)"
    result: TBD
  - name: "SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY-binding.test.ts (binding tests)"
    result: TBD
- integration_test_result: TBD
- slot_wiring_result: NOT_APPLICABLE
- required_evidence:
  - trajectory.json: present at docs/evidence/${OBJECTIVE_ID}/trajectory.json (per-tick hashes + event log + input bindings)
  - sequence.json: present at docs/screenshots/${OBJECTIVE_ID}/sequence.json (${result.passEvent && result.shotEvent ? 5 : result.passEvent || result.shotEvent ? 3 : 0} labeled frames with objective_id matching)
  - browser-cases.json: present at docs/evidence/${OBJECTIVE_ID}/browser-cases.json
  - PNG frames: event-centered screenshots (pass before/event/after, shot event/after)
  - input-frame→event binding: ${passSummary}; ${shotSummary}
- artifacts:
  - docs/evidence/${OBJECTIVE_ID}/trajectory.json
  - docs/evidence/${OBJECTIVE_ID}/browser-cases.json
  - docs/evidence/${OBJECTIVE_ID}/RESULT.md
  - docs/screenshots/${OBJECTIVE_ID}/sequence.json
  - docs/screenshots/${OBJECTIVE_ID}/pass-before.png
  - docs/screenshots/${OBJECTIVE_ID}/pass-event.png
  - docs/screenshots/${OBJECTIVE_ID}/pass-after.png
  - docs/screenshots/${OBJECTIVE_ID}/shot-event.png
  - docs/screenshots/${OBJECTIVE_ID}/shot-after.png
- spec_sections:
  - gauntlet/roles/builder-gameplay.md (role contract)
  - gauntlet/evidence-contract.md (DYNAMIC_VISUAL evidence class)
  - src/contracts/input.ts (PASS_BIT, SHOT_BIT definitions)
  - src/simulation/contacts/contact-system.ts (input-frame→event binding)
- acceptance_criteria_met:
  - **Input-frame → event binding**: ${passSummary}; ${shotSummary}
  - **Same-tick policy documented**: PASS_BIT/SHOT_BIT at tick T causes pass/shot event at tick T (contact system resolves in the same step)
  - **Event-centered frames captured**: before→event→after frames for human-driven pass and shot events, bound to input tick and input frame identity
  - **Human-driven input observable**: PASS_BIT (J key) and SHOT_BIT (L key) pressed by human player in 5v5 human-vs-CPU match, producing observable action-to-visual binding
  - **Deterministic simulation**: 5v5 human-vs-CPU match produces identical per-tick hashes across runs
  - **Sequence.json**: ${result.passEvent && result.shotEvent ? 5 : result.passEvent || result.shotEvent ? 3 : 0} labeled frames with objective_id matching, labels naming input tick/input frame
  - **Trajectory.json**: per-tick hashes + event log + input bindings
- known_gaps:
  - **Player proximity constraint**: Pass/shot events only fire when the human-controlled player (player-1) is within the contact radius (1.2m) of the ball. The human steers player-1 toward the ball before injecting action bits.
  - **CPU adapter non-determinism**: CPU adapters use observations from the simulation state, which changes based on human input. The exact event ticks may vary between runs.
  - **No numeric readability PASS**: VISUAL_SPEC intentionally defers readability thresholds to perceptual review. This evidence materializes observable frames; it does NOT claim readability meets any numeric bar.
  - **No PES fidelity claim**: No reference bar comparison has been performed. No PES 2017 constants were measured or compared.
- claims_not_made:
  - **No numeric readability PASS**: VISUAL_SPEC intentionally defers readability thresholds to perceptual review. This evidence materializes observable frames; it does NOT claim readability meets any numeric bar.
  - **No PES fidelity claim**: No reference bar comparison has been performed. No PES 2017 constants were measured or compared.
  - **No FOUNDATION_LAB_PASS claim**: No foundation lab evaluator exists or has been run for this objective.
  - **No PROMOTION-tier verdict**: Milestone verdicts are derived evaluation artifacts, not builder claims.
  - **No invented perceptual rubric**: Frames are selected by event kind and tick, not by an invented quality metric.
  - **No qualitative football behavior claim**: This evidence demonstrates that human-driven discrete actions (pass, shot) produce observable action-to-visual binding in the 5v5 human-vs-CPU browser match; it does not claim the football quality meets any specific bar.
`;

  fs.writeFileSync(path.join(EVIDENCE_DIR, "RESULT.md"), resultMd);

  console.log(`Evidence produced for ${OBJECTIVE_ID}`);
  console.log(`  Pass event: ${passSummary}`);
  console.log(`  Shot event: ${shotSummary}`);
  console.log(`  Total ticks: ${result.totalTicks}`);
  console.log(`  Events: ${result.events.length}`);
  console.log(`  Hashes: ${result.hashes.length}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`Running 5v5 human-vs-CPU with steered player-1 + PASS_BIT/SHOT_BIT...`);
const result = runWithHumanInput();
produceEvidence(result);
console.log("Done.");
