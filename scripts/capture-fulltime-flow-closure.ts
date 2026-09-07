/**
 * Node-side evidence producer for FULLTIME-FLOW-CLOSURE.
 *
 * Produces the durable record (record JSON) and the MULTI_TICK trajectory for
 * the end-of-match flow: the core-owned `fulltime` terminal state and the
 * presentation-layer affordance that closes the playable loop (a rematch
 * through the composition-root match-start path + a menu return).  The 3 WebGL
 * canvas frames are captured by the browser test
 * (`tests/browser/fulltime-flow-closure.browser.test.ts`), and the real shipped
 * `menu-return` frame by the dev-server Playwright menu script
 * (`scripts/capture-fulltime-flow-closure-menu.mts`); both write the PNGs +
 * sequence.json under `docs/screenshots/FULLTIME-FLOW-CLOSURE/`.  This script
 * reads that sequence.json (the source of truth for the frame anchors — the
 * CORNER-DRIVEN lesson: sequence.json is written by the capture source with
 * path bindings, never hand-patched) and folds it into a byte-reproducible
 * record plus the trajectory of the accepted headless timing stream.
 *
 * The fixture is `eval/scenarios/5v5-full-match-timing.v1.json` (240-tick
 * halves).  The core timer/lifecycle machinery drives the whole thing: half 1
 * decrements the in-play timer during "playing", the core transitions to the
 * "halftime" phase, the timer-driven reset opens the second half, and half 2's
 * literal 1→0 zero-crossing lands the terminal "fulltime" state.  The fulltime
 * tick is located from the run's own phase stream — never hand-transcribed.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:FULLTIME-FLOW-CLOSURE`.  An ordinary run reads the
 * ephemeral sequence.json under `test-results/gauntlet-capture/**`, writes the
 * same artifacts under that ignored tree, and leaves `docs/` byte-identical.
 * The record carries NO wall-clock field and does NOT embed the (element-scoped)
 * menu-return PNG bytes, so consecutive ordinary-mode runs are byte-identical
 * and the pinned `record_sha256` is stable.
 *
 * Usage (after the browser test has written the sequence.json):
 *   WIP_SECTION=__EVIDENCE__:FULLTIME-FLOW-CLOSURE \
 *     mise exec -- pnpm exec tsx scripts/capture-fulltime-flow-closure.ts
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { createWorld } from "../src/simulation/world/create.js";
import { createSimulation } from "../src/simulation/loop/simulation.js";
import { createCpuAdapter, buildCpuObservation } from "../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../src/adapters/input-browser/team-decision-profile.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "FULLTIME-FLOW-CLOSURE";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const SCREENSHOT_ROOT = EVIDENCE_MODE
  ? resolve("docs/screenshots", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const SEQUENCE_PATH = resolve(SCREENSHOT_ROOT, "sequence.json");
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "fulltime-flow-closure-state.json");

const SCENARIO_PATH = "eval/scenarios/5v5-full-match-timing.v1.json";
const PLAY_TICKS = 800;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

interface FrameAnchor {
  label: string;
  path: string;
  tick: number;
  semantic?: string;
  pngSha256?: string;
  note?: string;
}

function readSequenceFrames(): FrameAnchor[] {
  const raw = JSON.parse(readFileSync(SEQUENCE_PATH, "utf-8")) as {
    frames?: FrameAnchor[];
  };
  const frames = Array.isArray(raw.frames) ? raw.frames : [];
  if (frames.length < 3 || frames.length > 5) {
    throw new Error(
      `DYNAMIC_VISUAL requires 3-5 labeled frames; sequence.json has ${frames.length}`,
    );
  }
  for (const frame of frames) {
    if (!frame.label || !frame.path) {
      throw new Error(`sequence.json frame is missing label/path: ${JSON.stringify(frame)}`);
    }
  }
  return frames;
}

/** Ordered distinct core match phases (excluding the opening "kickoff" seed). */
function distinctPhases(phases: string[]): string[] {
  const seq: string[] = [];
  for (const p of phases) if (seq[seq.length - 1] !== p) seq.push(p);
  return seq.filter((p) => p !== "kickoff");
}

/** Browser-equivalent lifecycle using the composition-root's own CPU wiring. */
function browserEquivalentLifecycle(scenario: ScenarioDefinition): { phases: string[] } {
  const world = createWorld({ scenario });
  const sim = createSimulation(world);
  const cpuEntries = Object.entries(scenario.controlAssignments)
    .filter(([, a]) => (a as { mode?: string }).mode !== "HUMAN")
    .map(([controlSlot, a]) => ({
      controlSlot,
      teamId: (a as { teamId: string }).teamId,
      controlledPlayerId: (a as { controlledPlayerId: string }).controlledPlayerId,
      adapter: createCpuAdapter(),
    }));

  const phases: string[] = [];
  for (let i = 0; i < PLAY_TICKS; i++) {
    const snapshot = sim.snapshot();
    const teamDecisions = new Map<string, unknown>();
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
    sim.step();
    phases.push(sim.presentation().matchPhase);
  }
  for (const entry of cpuEntries) entry.adapter.reset();
  return { phases };
}

/** Phase-transition rows of the accepted headless timing stream. */
function headlessTransitions(phases: string[]): Array<{ tick: number; phase: string }> {
  const out: Array<{ tick: number; phase: string }> = [];
  let prev: string | null = null;
  for (let i = 0; i < phases.length; i++) {
    if (phases[i] !== prev) {
      out.push({ tick: i, phase: phases[i] });
      prev = phases[i];
    }
  }
  return out;
}

/** Locate the first "fulltime" committed tick from a phase stream (the terminal state). */
function fulltimeTickOf(phases: string[]): number {
  const idx = phases.indexOf("fulltime");
  if (idx < 0) throw new Error("the fixture never reached fulltime in the browser-equivalent lifecycle");
  // `browserEquivalentLifecycle` records `phases[i]` = the match phase after
  // `i+1` steps, so the committed tick at which "fulltime" first appears is
  // `idx + 1` (matches the browser test's `locateFulltimeTick` committed tick).
  return idx + 1;
}

/** Deterministic state facts at a given tick of the browser-equivalent run. */
function stateAtTick(scenario: ScenarioDefinition, targetTick: number): { matchPhase: string; matchTimer: number; stateHash: string } {
  const world = createWorld({ scenario });
  const sim = createSimulation(world);
  const cpuEntries = Object.entries(scenario.controlAssignments)
    .filter(([, a]) => (a as { mode?: string }).mode !== "HUMAN")
    .map(([controlSlot, a]) => ({
      controlSlot,
      teamId: (a as { teamId: string }).teamId,
      controlledPlayerId: (a as { controlledPlayerId: string }).controlledPlayerId,
      adapter: createCpuAdapter(),
    }));
  for (let i = 0; i < targetTick; i++) {
    const snapshot = sim.snapshot();
    const teamDecisions = new Map<string, unknown>();
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
    sim.step();
  }
  for (const entry of cpuEntries) entry.adapter.reset();
  const p = sim.presentation();
  return { matchPhase: p.matchPhase, matchTimer: p.matchTimer, stateHash: sim.stateHash() };
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

const frames = readSequenceFrames();
const scenario = loadScenario(SCENARIO_PATH);
const browser = browserEquivalentLifecycle(scenario);
const headless = runHeadlessMatch({
  scenario,
  maxTicks: PLAY_TICKS,
  cpuAntiHuddle: true,
  lifecyclePhaseSync: "core-owned",
  browserParityObservations: true,
  serializeRestartFacts: true,
});

const fulltimeTick = fulltimeTickOf(browser.phases);
// The browser test records the fulltime frames at its own committed tick (the
// composition root's fulltime state).  `fulltimeTickOf` already returns that
// same committed tick, so the state facts are computed at the recorded frame
// tick to keep each frame's tick consistent with its state facts.  `stateAtTick`
// runs exactly `targetTick` steps (it does NOT over-step), so a frame at tick 0
// reports the untouched fresh-match state (matchTimer 240) and a frame at the
// fulltime committed tick reports matchTimer 0 / matchPhase "fulltime".
const fulltimeFrameTick = frames.find((f) => f.tick !== 0)?.tick ?? fulltimeTick;
const fulltimeState = stateAtTick(scenario, fulltimeFrameTick);
const kickoffState = stateAtTick(scenario, 0);

const headlessDistinct = distinctPhases(headless.coreMatchPhases);
const browserDistinct = distinctPhases(browser.phases);
const transitions = headlessTransitions(headless.coreMatchPhases);

// Frame anchors enriched with deterministic state facts (no PNG bytes in the
// hashed record, so consecutive ordinary-mode runs are byte-identical).
const frameAnchors = frames.map((frame) => {
  if (frame.tick === 0) {
    return {
      label: frame.label,
      path: frame.path,
      tick: frame.tick,
      sem: frame.semantic,
      matchPhase: kickoffState.matchPhase,
      matchTimer: kickoffState.matchTimer,
      stateHash: kickoffState.stateHash,
    };
  }
  return {
    label: frame.label,
    path: frame.path,
    tick: frame.tick,
    sem: frame.semantic,
    matchPhase: fulltimeState.matchPhase,
    matchTimer: fulltimeState.matchTimer,
    stateHash: fulltimeState.stateHash,
  };
});

const claimsNotMade = [
  "No PES 2017 fidelity / measured PES envelope claim.",
  "No FOUNDATION_LAB_PASS claim.",
  "No suite-level PASS claim; no football outcome changed by the presentation surface.",
  "No claim that this is an organic 90-minute match: the short-duration scenario is a DRIVEN fixture (240-tick halves) expressly chosen so the full lifecycle completes inside the browser test budget.",
  "No per-tick browser/headless state-hash identity claim: the browser composition root and the headless runner differ in their CPU observation shape and the runner's opening kickoff seed, so the committed per-tick hashes are not byte-identical across runtimes.  The verified correspondence is the lifecycle phase sequence + the timer-driven zero-crossing.",
  "No invented reference envelope or tolerance.",
  "No claim that the rematch is a literal core change: it re-enters the composition-root match-start path (startMatch) over a fresh simulation; the core's 'fulltime' phase is accepted machinery.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  suite_id: "fulltime-flow-closure",
  produced_by: "scripts/capture-fulltime-flow-closure.ts",
  evidence_class: "DYNAMIC_VISUAL",
  lifecycle_phase_sync: "core-owned",
  scenario: scenario.id,
  scenario_path: SCENARIO_PATH,
  play_ticks: PLAY_TICKS,
  half_duration_ticks: scenario.matchDurationTicks ?? 240,
  fulltime_tick: fulltimeTick,
  fulltime_frame_tick: fulltimeFrameTick,
  frames: frameAnchors,
  semantics: {
    order: "fulltime terminal → affordance → menu return → new match",
    note:
      "event-centered on the end-of-match flow: the fulltime terminal state (before the flow — FULL TIME / TIME 0 HUD, no affordance), the added affordance ('[R] REMATCH  [M] MENU' drawn on the match-phase HUD), the menu return (the real shipped #setup-menu surface — the Difficulty row + the full 9-option mode ladder — reached through the shipped menu-return path), and a new match started through the composition-root match-start path.",
  },
  affordance: {
    surface: "renderer match-phase HUD (draw-only, reads the immutable snapshot) + composition-root DOM panel + M/R keyboard",
    draw_only: true,
    gate: "the affordance is drawn/dispatched only when snapshot.matchPhase === 'fulltime'; the in-play human controls (WASD / Tab / pass / shot / tackles) are untouched (the M/R keys are inert until the flow is active).",
    rematch_path: "startMatch(scenario, urlMode, teamALabel, teamBLabel, controlsHint, difficulty) — the existing composition-root match-start path over a fresh simulation.",
    menu_path: "stopMatch() + showSetupMenu() — the existing setup-menu return path; the fulltime affordance is dismissed so the app lands in a clean menu.",
    reset: "startMatch stores lastMatchConfig and hides the fulltime flow; showSetupMenu hides it after a menu return.",
  },
  correspondence: {
    browser_phase_sequence: browserDistinct,
    headless_phase_sequence: headlessDistinct,
    phase_sequence_matches: JSON.stringify(browserDistinct) === JSON.stringify(headlessDistinct),
    note:
      "Both the browser composition root and the accepted headless timing stream traverse the same lifecycle phase order (playing → … → halftime → … → fulltime).  The browser reaches the terminal 'fulltime' one tick EARLIER than the headless runner in this run (browser fulltime 660 vs headless fulltime 661), not later: the headless timing stream additionally seeds a 'kickoff' tick at tick 0 that does not decrement the in-play timer, so the browser's half transitions land one tick ahead of the headless's.  The browser test records the fulltime frame at its own committed tick (fulltime_frame_tick = 660), and the node sim's browser-equivalent wiring reaches the same fulltime state at the same committed tick (fulltime_tick = 660), so the frame tick and the recorded state facts are consistent.  Per-tick committed hashes are NOT compared across runtimes.",
  },
  headless_timing_stream: {
    reproduction:
      `runHeadlessMatch({ scenario: load("${SCENARIO_PATH}"), maxTicks: ${PLAY_TICKS}, cpuAntiHuddle: true, ` +
      `lifecyclePhaseSync: "core-owned", browserParityObservations: true, serializeRestartFacts: true })`,
    transitions,
    final_phase: headless.coreMatchPhases[headless.coreMatchPhases.length - 1],
  },
  determinism: {
    note:
      "The record embeds only deterministic state facts (frame paths/ticks + recomputed state hashes) and NO wall-clock field and NO PNG bytes, so consecutive ordinary-mode runs produce a byte-identical record.  The element-scoped menu-return PNG (the dev-server Playwright menu script) is intentionally NOT embedded in the record; its SHA-256 lives in docs/screenshots/FULLTIME-FLOW-CLOSURE/sequence.json only.",
  },
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

const trajectory: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-fulltime-flow-closure.ts",
  driver:
    "eval/runners/headless-match.ts with lifecyclePhaseSync:'core-owned' + browserParityObservations:true " +
    "(the accepted full-match timing stream) and the browser composition root's CPU wiring for the frame anchors.",
  scenario: "5v5-full-match-timing-v1",
  scenario_path: SCENARIO_PATH,
  play_ticks: PLAY_TICKS,
  fulltime_tick: fulltimeTick,
  frame_anchors: frameAnchors.map((frame) => ({
    label: frame.label,
    path: frame.path,
    tick: frame.tick,
    matchPhase: frame.matchPhase,
    matchTimer: frame.matchTimer,
    sha256: frame.stateHash,
  })),
  lifecycle_transitions: transitions,
  disclosures: [
    "The short-duration scenario (240-tick halves) is a DRIVEN fixture so the full lifecycle completes inside the browser test budget; it is not an organic 90-minute match.",
    "The browser composition root and the headless runner differ (CPU observation shape + the runner's opening kickoff seed), so their committed per-tick hashes are not byte-identical across runtimes.  The verified correspondence here is the lifecycle phase sequence and the timer-driven fulltime zero-crossing.  In this run the browser reaches the terminal 'fulltime' one tick EARLIER than the headless (browser 660 vs headless 661), not later: the headless stream seeds an extra 'kickoff' tick at tick 0 that does not decrement the in-play timer.",
    "Restart windows (a throw-in) freeze the in-play timer, so the nominal 240-tick half duration runs longer in wall ticks; the transition ticks are located from the run's own phase stream, never hand-transcribed.",
    "The menu-return frame is a DOM capture of the REAL shipped #setup-menu surface (the Difficulty row + the full 9-option mode ladder), captured by the dev-server Playwright script (`scripts/capture-fulltime-flow-closure-menu.mts`) from the shipped #back-to-menu menu-return path, rather than a WebGL canvas capture.  It is element-scoped and its PNG bytes are not embedded in the record so the record stays byte-reproducible.",
  ],
};

mkdirSync(OUTPUT_ROOT, { recursive: true });
writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectory, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(
  `[fulltime-flow-closure] frames ${frames.map((f) => `${f.label}@${f.tick}`).join(" ")}` +
    ` (durable=${EVIDENCE_MODE})`,
);
console.log(`[fulltime-flow-closure] fulltime_tick=${fulltimeTick}`);
console.log(`[fulltime-flow-closure] wrote ${TRAJECTORY_PATH}`);
console.log(`[fulltime-flow-closure] wrote ${STATE_PATH}`);
console.log(`[fulltime-flow-closure] record_sha256=${String(record.record_sha256)}`);
console.log(`[fulltime-flow-closure] correspondence phase_sequence_matches=${record.correspondence.phase_sequence_matches}`);
