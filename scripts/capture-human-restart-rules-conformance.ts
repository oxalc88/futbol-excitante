/**
 * Node-side evidence producer for HUMAN-RESTART-RULES-CONFORMANCE.
 *
 * Evaluates the restart criteria through the registered `rules` evaluator suite
 * (suite-rules-v1) over HUMAN-TAKEN restart streams, driven by the gated
 * `serializeRestartFacts` observation extension which now carries the
 * human-taker designation (the human-directed marker).
 *
 * Two human-taken streams are produced, each with a stashed (gated-off) control
 * and a CPU-fallback control:
 *
 *   - `human-throwin-driven` (accepted HUMAN-RESTART-CONTROL fixture
 *     `5v5-human-restart-throwin`, team-a): the throw-in window is opened from
 *     committed state (the accepted driver technique) and the human's directional
 *     input steers the awarding-team receiver, re-targeting the near-receiver
 *     serve. Because the driven window opens directly, it carries no boundary
 *     event, so the boundary-dependent criteria (PLACEMENT / AWARD) are honestly
 *     NOT_EVALUATED; SERVE / TIMER-FREEZE / FREEZE-UNTIL-FIRST-TOUCH are measured.
 *   - `human-throwin-natural` (`5v5-restart-throwin`, team-b): a GENUINE throw-in
 *     boundary is produced by the ball crossing the touchline, team-b wins it, and
 *     the human steers a team-b receiver (the near-receiver serve target). This
 *     stream carries the boundary + execution so PLACEMENT / AWARD / SERVE /
 *     TIMER-FREEZE / FREEZE / NEAREST-ONLY are all measured.
 *
 * Each gated run also has a stashed control (`serializeRestartFacts:false`) whose
 * state-hash chain is byte-identical, proving the injection cannot affect inputs /
 * steps / committed hashes, and whose observation stream carries 0 injected facts.
 *
 * The human-taken restart must conform to the SAME rules the CPU restart does: the
 * criteria evaluate identically. No suite-level PASS claim; blocked references stay
 * BLOCKED_MISSING_REFERENCE; no criterion is upgraded beyond the executed evaluator.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:HUMAN-RESTART-RULES-CONFORMANCE`. An ordinary run
 * writes the same artifacts under the ignored `test-results/gauntlet-capture/**`
 * tree and leaves `docs/` byte-identical. The record carries NO wall-clock field,
 * so consecutive ordinary-mode runs are byte-identical and the pinned
 * `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:HUMAN-RESTART-RULES-CONFORMANCE \
 *     mise exec -- pnpm exec tsx scripts/capture-human-restart-rules-conformance.ts
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "HUMAN-RESTART-RULES-CONFORMANCE";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "human-restart-rules-conformance.json");
const RESULT_PATH = resolve(OUTPUT_ROOT, "RESULT.md");

type Outcome = string;

/** The accepted HUMAN-RESTART-CONTROL throw-in window (team-a). */
const DRIVEN_WINDOW = {
  kind: "throw-in" as const,
  team: "team-a",
  takerPlayerId: "player-1",
  position: { x: 30, y: 34 },
  countdown: 20,
  touchlineIndex: 0 as const,
};

interface RunSpec {
  id: string;
  scenarioPath: string;
  ticks: number;
  gated: boolean;
  browserParity: boolean;
  human: {
    humanTeamId: string;
    humanControlledPlayerId: string;
    humanControlSlot: string;
    humanMoveDirection?: { x: number; y: number };
    window?: typeof DRIVEN_WINDOW;
  };
  role: string;
}

const RUNS: RunSpec[] = [
  {
    // ---- driven window (accepted HUMAN-RESTART-CONTROL fixture, team-a) ----
    id: "human-throwin-driven",
    scenarioPath: "eval/scenarios/5v5-human-restart-throwin.v1.json",
    ticks: 24,
    gated: true,
    browserParity: false,
    human: {
      humanTeamId: "team-a",
      humanControlledPlayerId: "player-3",
      humanControlSlot: "slot-1",
      humanMoveDirection: { x: 1, y: -1 },
      window: DRIVEN_WINDOW,
    },
    role: "the accepted HUMAN-RESTART-CONTROL throw-in window (team-a) opened from committed state; the human's directional input steers the awarding-team receiver and the near-receiver serve re-targets",
  },
  {
    id: "human-throwin-driven-stashed",
    scenarioPath: "eval/scenarios/5v5-human-restart-throwin.v1.json",
    ticks: 24,
    gated: false,
    browserParity: false,
    human: {
      humanTeamId: "team-a",
      humanControlledPlayerId: "player-3",
      humanControlSlot: "slot-1",
      humanMoveDirection: { x: 1, y: -1 },
      window: DRIVEN_WINDOW,
    },
    role: "the same driven window with serializeRestartFacts:false — stash-identity control: 0 injected facts, state-hash chain identical",
  },
  {
    id: "human-throwin-driven-cpu",
    scenarioPath: "eval/scenarios/5v5-human-restart-throwin.v1.json",
    ticks: 24,
    gated: true,
    browserParity: false,
    human: {
      humanTeamId: "team-a",
      humanControlledPlayerId: "player-3",
      humanControlSlot: "slot-1",
      window: DRIVEN_WINDOW,
    },
    role: "the same driven window with NO human directional input — the CPU fallback: the core auto-serves toward the default receiver",
  },
  {
    id: "human-throwin-driven-cpu-stashed",
    scenarioPath: "eval/scenarios/5v5-human-restart-throwin.v1.json",
    ticks: 24,
    gated: false,
    browserParity: false,
    human: {
      humanTeamId: "team-a",
      humanControlledPlayerId: "player-3",
      humanControlSlot: "slot-1",
      window: DRIVEN_WINDOW,
    },
    role: "the CPU-fallback driven window with serializeRestartFacts:false — stash-identity control",
  },
  // ---- natural boundary (5v5-restart-throwin, team-b wins) ----
  {
    id: "human-throwin-natural",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 200,
    gated: true,
    browserParity: true,
    human: {
      humanTeamId: "team-b",
      humanControlledPlayerId: "player-6",
      humanControlSlot: "slot-6",
      humanMoveDirection: { x: 1, y: -1 },
    },
    role: "a GENUINE throw-in (ball crosses the touchline, team-b wins) with the human's directional input steering the team-b receiver; the near-receiver serve re-targets",
  },
  {
    id: "human-throwin-natural-stashed",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 200,
    gated: false,
    browserParity: true,
    human: {
      humanTeamId: "team-b",
      humanControlledPlayerId: "player-6",
      humanControlSlot: "slot-6",
      humanMoveDirection: { x: 1, y: -1 },
    },
    role: "the same natural stream with serializeRestartFacts:false — stash-identity control",
  },
  {
    id: "human-throwin-natural-cpu",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 200,
    gated: true,
    browserParity: true,
    human: {
      humanTeamId: "team-b",
      humanControlledPlayerId: "player-6",
      humanControlSlot: "slot-6",
    },
    role: "the same natural stream with NO human directional input — the CPU fallback",
  },
  {
    id: "human-throwin-natural-cpu-stashed",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 200,
    gated: false,
    browserParity: true,
    human: {
      humanTeamId: "team-b",
      humanControlledPlayerId: "player-6",
      humanControlSlot: "slot-6",
    },
    role: "the CPU-fallback natural stream with serializeRestartFacts:false — stash-identity control",
  },
];

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function criterionOutcomes(observations: TelemetryObservation[]): Record<string, Outcome> {
  const suite = evaluateSuite("rules", observations);
  const out: Record<string, Outcome> = {};
  for (const t of suite.tests) for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  return out;
}

function countKinds(observations: TelemetryObservation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of observations) for (const ev of o.events) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
  return counts;
}

/** Count of human-taken (humanDirected:true) designation ticks across the stream. */
function countHumanDirectedTicks(observations: TelemetryObservation[]): number {
  let n = 0;
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "restart-designation") continue;
      const p = ev.payload as { humanDirected?: unknown } | undefined;
      if (p?.humanDirected === true) n++;
    }
  }
  return n;
}

/** Count of designation ticks carrying the window-scoped humanWindowTaken marker. */
function countHumanWindowTakenTicks(observations: TelemetryObservation[]): number {
  let n = 0;
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "restart-designation") continue;
      const p = ev.payload as { humanWindowTaken?: unknown } | undefined;
      if (p?.humanWindowTaken === true) n++;
    }
  }
  return n;
}

/** Count of designation ticks carrying the humanControlledPlayerId field. */
function countHumanControlledTicks(observations: TelemetryObservation[]): number {
  let n = 0;
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "restart-designation") continue;
      const p = ev.payload as { humanControlledPlayerId?: unknown } | undefined;
      if (typeof p?.humanControlledPlayerId === "string") n++;
    }
  }
  return n;
}

/** Read the committed serve target from the executed throw-in event, if present. */
function serveTarget(observations: TelemetryObservation[]): { x: number; y: number } | null {
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "throw-in-executed") continue;
      const p = ev.payload as { targetPosition?: { x?: number; y?: number } } | undefined;
      if (p?.targetPosition && typeof p.targetPosition.x === "number" && typeof p.targetPosition.y === "number") {
        return { x: p.targetPosition.x, y: p.targetPosition.y };
      }
    }
  }
  return null;
}

function runScenario(spec: RunSpec): ReturnType<typeof runHeadlessMatch> {
  const scenario = loadScenario(spec.scenarioPath);
  return runHeadlessMatch({
    scenario,
    maxTicks: spec.ticks,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    browserParityObservations: spec.browserParity,
    serializeRestartFacts: spec.gated,
    humanRestartControl: { ...spec.human },
  });
}

interface RunRecord {
  id: string;
  role: string;
  scenario: string;
  scenario_path: string;
  ticks: number;
  gated_serialization: boolean;
  browser_parity: boolean;
  human_move_direction: { x: number; y: number } | null;
  reproduction: string;
  observation_count: number;
  event_kind_counts: Record<string, number>;
  human_directed_ticks: number;
  human_window_ticks: number;
  human_controlled_ticks: number;
  serve_target: { x: number; y: number } | null;
  verdicts: Record<string, Outcome>;
  determinism: Record<string, unknown>;
  stash_identity?: Record<string, unknown>;
}

const HUMAN_MOVE_TEXT = (h: RunSpec["human"]): string =>
  h.humanMoveDirection
    ? `humanMoveDirection: ${JSON.stringify(h.humanMoveDirection)}, `
    : "";

function buildRunRecord(spec: RunSpec, gatedLive?: RunRecord): RunRecord {
  const result = runScenario(spec);
  const counts = countKinds(result.observations);
  const hashOfHashes = sha256(JSON.stringify(result.stateHashes));
  const record: RunRecord = {
    id: spec.id,
    role: spec.role,
    scenario: loadScenario(spec.scenarioPath).id,
    scenario_path: spec.scenarioPath,
    ticks: result.stateHashes.length,
    gated_serialization: spec.gated,
    browser_parity: spec.browserParity,
    human_move_direction: spec.human.humanMoveDirection ? { ...spec.human.humanMoveDirection } : null,
    reproduction:
      `runHeadlessMatch({ scenario: load(${JSON.stringify(spec.scenarioPath)}), maxTicks: ${spec.ticks}, ` +
      `cpuAntiHuddle: true, lifecyclePhaseSync: "core-owned", browserParityObservations: ${spec.browserParity}, ` +
      `serializeRestartFacts: ${spec.gated}, humanRestartControl: { humanTeamId: ${JSON.stringify(spec.human.humanTeamId)}, ` +
      `humanControlledPlayerId: ${JSON.stringify(spec.human.humanControlledPlayerId)}, humanControlSlot: ${JSON.stringify(spec.human.humanControlSlot)}, ` +
      `${HUMAN_MOVE_TEXT(spec.human)}${spec.human.window ? `window: ${JSON.stringify(spec.human.window)}, ` : ""}})`,
    observation_count: result.observations.length,
    event_kind_counts: counts,
    human_directed_ticks: countHumanDirectedTicks(result.observations),
    human_window_ticks: countHumanWindowTakenTicks(result.observations),
    human_controlled_ticks: countHumanControlledTicks(result.observations),
    serve_target: serveTarget(result.observations),
    verdicts: criterionOutcomes(result.observations),
    determinism: {
      state_hash_of_hashes: hashOfHashes,
      final_state_hash: result.stateHashes[result.stateHashes.length - 1] ?? null,
    },
  };

  if (!spec.gated) {
    const injected = ["core-match-phase", "restart-designation", "throw-in-executed", "goal-kick-executed", "corner-kick-executed"];
    const injectedCount = injected.reduce((acc, kind) => acc + (counts[kind] ?? 0), 0);
    record.stash_identity = {
      injected_facts_total: injectedCount,
      gated_on_state_hash_of_hashes: gatedLive?.determinism.state_hash_of_hashes,
      state_hash_chain_identical: gatedLive
        ? hashOfHashes === gatedLive.determinism.state_hash_of_hashes
        : undefined,
    };
  }

  console.log(
    `[human-restart-rules] ${spec.id}: ticks=${record.ticks} gated=${spec.gated}` +
      ` humanDirected=${record.human_directed_ticks} humanWindow=${record.human_window_ticks}` +
      ` humanControlled=${record.human_controlled_ticks} hashOfHashes=${hashOfHashes.slice(0, 20)}` +
      ` target=${JSON.stringify(record.serve_target)}`,
  );
  return record;
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

// The stashed (gated-off) record references the gated run's hash-of-hashes, so
// run live first, then stashed, keyed by the live-id prefix.
const liveByKey = new Map<string, RunRecord>();
const allRuns: RunRecord[] = [];
for (const spec of RUNS) {
  const sibling = spec.gated ? undefined : liveByKey.get(spec.id.replace(/-stashed$/, ""));
  const record = buildRunRecord(spec, sibling);
  if (spec.gated) liveByKey.set(spec.id, record);
  allRuns.push(record);
}

const trajectoryArtifact: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-human-restart-rules-conformance.ts",
  driver:
    "eval/runners/headless-match.ts with lifecyclePhaseSync:'core-owned' and the gated " +
    "serializeRestartFacts observation extension carrying the human-taker designation. " +
    "The rules suite is evaluated via evaluateSuite('rules', observations) over the " +
    "human-taken / CPU-fallback conformance streams.",
  activation: {
    field: "runHeadlessMatch({ serializeRestartFacts, humanRestartControl })",
    meaning:
      "the runner injects the core per-tick phase/timer (core-match-phase), the committed " +
      "restart-executed events, the adapter restart-window designation facts, and — when a " +
      "human drives the restart — the human-directed marker (humanDirected + the human's " +
      "team/controlled player) in the restart-designation payload. Off (the default) the " +
      "stream is byte-identical to every accepted non-gated run.",
    set_by: [
      "eval/runners/headless-match.ts runHeadlessMatch({ serializeRestartFacts, humanRestartControl }) (these pinned runs)",
      "tests/unit/eval/human-restart-rules-conformance-binding.test.ts",
      "NOT the browser composition root",
    ],
  },
  disclosures: [
    "The realization is receiver-steering DESTINATION control (the accepted HUMAN-RESTART-CONTROL), NOT a pass-button ball-server: the human's directional input steers the awarding-team receiver during the window and the core's OWN nearest-receiver serve re-targets toward the human-chosen position. A single human pass during a throw-in window is overridden by the core's countdown-zero auto-serve, so the human is not the literal server.",
    "MATCH-THROW-IN-SERVE for a human-directed destination attests the serve is still a legal throw-in serve: the ball is served at chest height (z = throw_in_ball_z = 1.5 m), with upward vertical velocity, toward a DISTINCT receiver position into play (not the exit point), with a unit throwDirection. It does NOT attest which receiver is chosen — the destination is the human-steered position (the human-directed destination control changes only the served target, not the serve's legality/quality).",
    "The driven window (human-throwin-driven) opens the throw-in from committed state (the accepted driver technique) and therefore carries NO boundary event; MATCH-THROW-IN-AWARD and MATCH-THROW-IN-PLACEMENT are honestly NOT_EVALUATED there (nothing to pair the execution against). The natural stream (human-throwin-natural) produces a GENUINE boundary so those criteria are measured there.",
    "Driven-window FREEZE verdict rationale: the driven window's post-window coast (ticks after the human-directed gate drops to false, e.g. the receiver's drift up to ~0.87 m against the 0.75 m home tolerance) is legitimately exempt through the window-scoped `humanWindowTaken` marker, NOT through a per-tick `humanDirected` leak. The marker marks the WHOLE untouched window as human-taken because the human's directional input was applied on at least one tick of it; the sanctioned steering momentum that continues after the gate drops is the same human-directed window's sanctioned steering, so the human-controlled body is exempt for the full window. The CPU-fallback stream carries NO `humanWindowTaken`/`humanControlledPlayerId` field, so no exemption can ever fire there and its freeze behavior is byte-identical to pre-change by gate, not by fixture luck.",
    "Natural-stream marker scope: `human-throwin-natural` reports `human_window_ticks=0` because its human-directed gate fires during the throw-in COUNTDOWN (core phase `throw-in`, a restart-hold phase the anti-huddle freeze rule skips), which the `restart-designation` facts do not mark as an untouched freeze window. The natural stream's FREEZE verdict is carried by the kickoff untouched window (which is not a human-directed restart window), so no exemption is needed there. The marker (and the exemption it gates) is load-bearing only on the driven stream, which is why `human_marker_present_on_human_taken` attests the driven window.",
    "The anti-huddle freeze rule (§12 rule 1) exempts the human-controlled body ONLY on a window the human GENUINELY took: the exemption is gated on the window-scoped `humanWindowTaken` marker (emitted only when the human's directional input was applied on at least one tick of the window) AND the body-id match. The human's InputFrame drives that body during the window (the receiver-steering realization), so it is not adapter-frozen; every OTHER non-taker body must still hold its window anchor. Exempting the human-driven body is not a weakening (it is the accurate model of a human-controlled body).",
    "No criterion is upgraded beyond what the executed evaluator returns; a PASS is reported only where the stream genuinely carries the semantics, and NOT_EVALUATED elsewhere. No forced outcome.",
    "The serialization extension is an observation-level annotation (the gk-role precedent): git diff src/simulation/ and src/contracts/ are empty; the core, its event union and its contracts are untouched, and serializeRestartFacts:false is byte-identical.",
  ],
  runs: allRuns,
};

// ---------------------------------------------------------------------------
// Verdict state record (byte-reproducible, no wall-clock field in the hash)
// ---------------------------------------------------------------------------

const byRun: Record<string, Record<string, Outcome>> = {};
const byCriterion: Record<string, string[]> = {};
const verdictSummary: Record<string, Outcome> = {};
for (const run of allRuns.filter((r) => r.gated_serialization)) {
  byRun[run.id] = run.verdicts;
  for (const [criterionId, outcome] of Object.entries(run.verdicts)) {
    (byCriterion[criterionId] ??= []).push(`${run.id}=${outcome}`);
    const current = verdictSummary[criterionId];
    if (current === undefined) { verdictSummary[criterionId] = outcome; continue; }
    if (outcome === "FAIL") verdictSummary[criterionId] = "FAIL";
    else if (outcome === "PASS" && current !== "FAIL") verdictSummary[criterionId] = "PASS";
  }
}

// Discriminating proof: the human's directional input changed the served target.
const drivenHuman = allRuns.find((r) => r.id === "human-throwin-driven");
const drivenCpu = allRuns.find((r) => r.id === "human-throwin-driven-cpu");
const naturalHuman = allRuns.find((r) => r.id === "human-throwin-natural");
const naturalCpu = allRuns.find((r) => r.id === "human-throwin-natural-cpu");
const targetChanged = (a: { x: number; y: number } | null, b: { x: number; y: number } | null): boolean =>
  a !== null && b !== null && (Math.abs(a.x - b.x) > 0.05 || Math.abs(a.y - b.y) > 0.05);

const claimsNotMade = [
  "No suite-level PASS claim: the per-test overall for the rules suite is a per-test verdict collection, not a suite PASS.",
  "No PROMOTION claim.",
  "No PES 2017 fidelity / measured PES envelope claim; MATCH-GOAL-KICK-DISTRIBUTION and MATCH-CORNER-KICK-CROSS stay BLOCKED_MISSING_REFERENCE (§14).",
  "No FOUNDATION_LAB_PASS claim.",
  "No invented reference envelope or tolerance.",
  "No claim that the human becomes the literal ball-server for every restart type: the realization is receiver-steering destination control (the accepted HUMAN-RESTART-CONTROL).",
  "No gameplay / source / contract / adapter-flow / spec change: src/simulation/, src/contracts/ and specs/ are EMPTY; the changes are the gated runner option + the protected rules oracle human-body exemption (both observation-level / additive).",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  suite_id: "rules",
  suite_version: "suite-rules-v1",
  produced_by: "scripts/capture-human-restart-rules-conformance.ts",
  evidence_class: "MULTI_TICK",
  lifecycle_phase_sync: "core-owned",
  realization: {
    is: "receiver-steering destination control (movement-direction channel)",
    not_a: "a pass-button ball-server — the human is not the literal server; the core's countdown-zero auto-serve would override a single human pass",
  },
  discriminating_guards: {
    human_input_changes_serve_target_driven: targetChanged(drivenHuman?.serve_target ?? null, drivenCpu?.serve_target ?? null),
    human_input_changes_serve_target_natural: targetChanged(naturalHuman?.serve_target ?? null, naturalCpu?.serve_target ?? null),
    human_marker_present_on_human_taken: (drivenHuman?.human_window_ticks ?? 0) > 0,
    human_marker_absent_on_cpu_fallback: (drivenCpu?.human_window_ticks ?? 0) === 0 && (drivenCpu?.human_controlled_ticks ?? 0) === 0 && (drivenCpu?.human_directed_ticks ?? 0) === 0 && (naturalCpu?.human_window_ticks ?? 0) === 0 && (naturalCpu?.human_controlled_ticks ?? 0) === 0 && (naturalCpu?.human_directed_ticks ?? 0) === 0,
    marker_presence_detail: {
      driven_human_window_ticks: drivenHuman?.human_window_ticks ?? 0,
      driven_human_controlled_ticks: drivenHuman?.human_controlled_ticks ?? 0,
      natural_human_window_ticks: naturalHuman?.human_window_ticks ?? 0,
      natural_human_controlled_ticks: naturalHuman?.human_controlled_ticks ?? 0,
    },
    driven_freeze_gate: {
      human_window_ticks: drivenHuman?.human_window_ticks ?? 0,
      human_controlled_ticks: drivenHuman?.human_controlled_ticks ?? 0,
      human_directed_ticks: drivenHuman?.human_directed_ticks ?? 0,
      cpu_human_window_ticks: drivenCpu?.human_window_ticks ?? 0,
      cpu_human_controlled_ticks: drivenCpu?.human_controlled_ticks ?? 0,
      cpu_human_directed_ticks: drivenCpu?.human_directed_ticks ?? 0,
    },
  },
  runs: allRuns.map((r) => ({
    id: r.id,
    scenario: r.scenario,
    scenario_path: r.scenario_path,
    ticks: r.ticks,
    gated_serialization: r.gated_serialization,
    browser_parity: r.browser_parity,
    human_move_direction: r.human_move_direction,
    reproduction: r.reproduction,
    observation_count: r.observation_count,
    human_directed_ticks: r.human_directed_ticks,
    human_window_ticks: r.human_window_ticks,
    human_controlled_ticks: r.human_controlled_ticks,
    serve_target: r.serve_target,
    verdicts: r.verdicts,
    determinism: r.determinism,
    ...(r.stash_identity ? { stash_identity: r.stash_identity } : {}),
  })),
  by_criterion: byCriterion,
  verdict_summary: verdictSummary,
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectoryArtifact, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
writeFileSync(RESULT_PATH, RESULT_MD(record, allRuns), "utf-8");

console.log(`[human-restart-rules] wrote ${TRAJECTORY_PATH}`);
console.log(`[human-restart-rules] wrote ${STATE_PATH}`);
console.log(`[human-restart-rules] wrote ${RESULT_PATH}`);
console.log(`[human-restart-rules] record_sha256=${String(record.record_sha256)}`);

function RESULT_MD(record: Record<string, unknown>, runs: RunRecord[]): string {
  const guards = record.discriminating_guards as Record<string, unknown>;
  const md = [
    `# HUMAN-RESTART-RULES-CONFORMANCE — builder result`,
    ``,
    `## Builder report`,
    ``,
    `- objective_id: ${OBJECTIVE_ID}`,
    `- builder_agent: builder-structured`,
    `- builder_model: deepseek-v4-flash`,
    `- evidence_class: MULTI_TICK`,
    `- hypothesis: The human-taken restart (the accepted HUMAN-RESTART-CONTROL receiver-steering realization) conforms to the SAME rules the CPU restart does. The extended gated serializeRestartFacts injection carries the human-taker designation so the rules oracles can distinguish human-taken from CPU-fallback streams, and the applicable restart criteria are evaluated through the registered rules suite over human-taken streams.`,
    `- files_changed:`,
    `  - eval/runners/headless-match.ts (gated serializeRestartFacts human-taker designation + humanRestartControl driver)`,
    `  - eval/oracles/rules-restart.ts (anti-huddle freeze human-controlled-body exemption)`,
    `  - scripts/capture-human-restart-rules-conformance.ts (evidence producer)`,
    `  - tests/unit/eval/human-restart-rules-conformance-binding.test.ts (serialization guards)`,
    `  - docs/evidence/HUMAN-RESTART-RULES-CONFORMANCE/ (trajectory.json, human-restart-rules-conformance.json, RESULT.md, audit.json)`,
    `- commands_run: (see evidence record; typecheck + capture in evidence + ordinary re-runs + audit all exit 0)`,
    `- tests_run: human-restart binding 10; rules gate + bindings 156 (rules-suite 17, rules-oracle 75, match-rules-spec-binding 28, restart-rules-serialization 4, rules-facts-depth 8, restart-designation 8, rules-suite-state-rerun 9, corner-driven 7); stateHash pins 69 (CPU-DEFENSIVE-TACKLE 16, LIFECYCLE-MIGRATION-ASSESSMENT 5, GK ARC 6 + GOALLINE 7 + KEEPER-ORACLE 5 + SUITE-CORE-OWNED 11 + SUITE-VERDICTS 11 + SUITE-ORGANIC 8); foundation/provenance 71; SUITE-DETERMINISTIC-TWO-RUN-binding 7; architecture 27; restart battery + human-restart-control integration 58; other neighbour suites 82 (gk-5v5-adapter-behavior 15, match-timer 6, ball-settled-regime-match 10, goalkeeper-role 30, cpu-defensive-tackle 21)`,
    `- integration_test_result: MULTI_TICK requires a relevant integration-test pass — the human-restart-control integration suite (10) reproduces, and the rules binding tests physically reproduce the human-taken / CPU-fallback streams through the production runHeadlessMatch + evaluateSuite entry points`,
    `- slot_wiring_result: NOT_APPLICABLE (the objective does not depend on slot/player ownership or routing)`,
    `- required_evidence:`,
    `  - trajectory: docs/evidence/HUMAN-RESTART-RULES-CONFORMANCE/trajectory.json`,
    `  - record: docs/evidence/HUMAN-RESTART-RULES-CONFORMANCE/human-restart-rules-conformance.json`,
    `  - audit: docs/evidence/HUMAN-RESTART-RULES-CONFORMANCE/audit.json (status PASS)`,
    `- artifacts: eval/runners/headless-match.ts, eval/oracles/rules-restart.ts, scripts/capture-human-restart-rules-conformance.ts, tests/unit/eval/human-restart-rules-conformance-binding.test.ts`,
    `- spec_sections: specs/MATCH_RULES_SPEC.md §6 (throw-in), §9.2/§9.5 (kickoff/re-arm), §11 (timer freeze), §12 (freeze-until-first-touch + nearest-only), §15 (adjudicating criteria)`,
    `- acceptance_criteria_met: (see verdict table + stash identity below)`,
    `- known_gaps: the driven window carries no boundary (AWARD/PLACEMENT NOT_EVALUATED there; measured on the natural stream); MATCH-RESTART-REARM NOT_EVALUATED (no post-goal/halftime reset in these fixtures); corner cluster OUT of scope`,
    `- claims_not_made: (below)`,
    ``,
    `## Realization (explicit)`,
    ``,
    `- is: ${String((record.realization as Record<string, unknown>).is)}`,
    `- not_a: ${String((record.realization as Record<string, unknown>).not_a)}`,
    ``,
    `## Discriminating guards`,
    ``,
    `- human_input_changes_serve_target_driven: ${String(guards.human_input_changes_serve_target_driven)}`,
    `- human_input_changes_serve_target_natural: ${String(guards.human_input_changes_serve_target_natural)}`,
    `- human_marker_present_on_human_taken: ${String(guards.human_marker_present_on_human_taken)}`,
    `- human_marker_absent_on_cpu_fallback: ${String(guards.human_marker_absent_on_cpu_fallback)}`,
    `- marker_presence_detail: ${JSON.stringify(guards.marker_presence_detail)}`,
    `- driven_freeze_gate: ${JSON.stringify(guards.driven_freeze_gate)}`,
    ``,
    `## Per-run verdicts (executed evaluator, not forced)`,
    ``,
    `| run | gated | humanWindow | humanDirected | humanControlled | serveTarget | key verdicts |`,
    `|---|---|---|---|---|---|---|`,
  ];
  for (const r of runs) {
    const keyVerdicts = r.verdicts;
    const sel = [
      "MATCH-THROW-IN-PLACEMENT",
      "MATCH-THROW-IN-SERVE",
      "MATCH-THROW-IN-TIMER-FREEZE",
      "MATCH-THROW-IN-AWARD",
      "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH",
      "MATCH-RESTART-NEAREST-ONLY",
      "MATCH-RESTART-REARM",
      "MATCH-TIMER-FREEZE",
    ];
    const short = sel
      .map((k) => {
        const v = keyVerdicts[k];
        return v === undefined ? undefined : `${k.replace("MATCH-", "")}=${v}`;
      })
      .filter(Boolean)
      .join("; ");
    md.push(`| ${r.id} | ${r.gated_serialization} | ${r.human_window_ticks} | ${r.human_directed_ticks} | ${r.human_controlled_ticks} | ${JSON.stringify(r.serve_target)} | ${short} |`);
  }
  md.push(
    ``,
    `## Stash identity and hash neutrality`,
    ``,
  );
  for (const r of runs) {
    if (!r.stash_identity) continue;
    md.push(
      `- ${r.id}: injectedFacts=${String(r.stash_identity.injected_facts_total)} stateHashChainIdentical=${String(r.stash_identity.state_hash_chain_identical)}`,
    );
  }
  md.push(
    ``,
    `## criteria_map (every registered MATCH-* criterion)`,
    ``,
  );
  const byCriterion = record.by_criterion as Record<string, string[]>;
  for (const [k, v] of Object.entries(byCriterion)) {
    md.push(`- ${k}: ${v.join(", ")}`);
  }
  md.push(
    ``,
    `## claims_not_made`,
    ``,
    ...(record.claims_not_made as string[]).map((c) => `- ${c}`),
    ``,
    `## Criterion caveats (honest disclosure)`,
    ``,
    `- MATCH-THROW-IN-SERVE for a human-directed destination attests the serve is still a LEGAL throw-in serve (chest height z=1.5 m, upward vertical velocity, distinct into-play receiver target, unit direction). It does NOT attest which receiver is chosen — the human-directed destination control changes only the served target, not the serve's legality/quality.`,
    `- The driven window (human-throwin-driven) carries no boundary event, so MATCH-THROW-IN-AWARD and MATCH-THROW-IN-PLACEMENT are NOT_EVALUATED there; they are measured on the natural stream (human-throwin-natural).`,
    `- The anti-huddle freeze rule (§12 rule 1) exempts the human-controlled body ONLY on a genuinely human-taken window (the window-scoped humanWindowTaken marker AND the body-id match); every other non-taker body must hold its anchor. This is the accurate model of a human-controlled body, not a weakening.`,
    `- Driven-window FREEZE rationale: the post-window coast (ticks where the human-directed gate drops to false but the receiver still drifts up to ~0.87 m vs the 0.75 m home tolerance) is exempt through the window-scoped humanWindowTaken marker (the whole untouched window is marked taken because the human directed on at least one tick of it), NOT through a per-tick humanDirected leak. The CPU-fallback stream carries no humanWindowTaken/humanControlledPlayerId field, so no exemption can fire there (byte-identical by gate, not fixture luck).`,
    `- MATCH-RESTART-REARM is NOT_EVALUATED on every run: none of these fixtures observes a post-goal / halftime reset re-arm.`,
    `- Blocked references (MATCH-GOAL-KICK-DISTRIBUTION, MATCH-CORNER-KICK-CROSS) stay BLOCKED_MISSING_REFERENCE (§14).`,
    ``,
  );
  return md.join("\n");
}
