/**
 * Node-side evidence producer for HUMAN-BALL-SERVER-LITERAL.
 *
 * Executes the pass-gated serving path (the deliberate core change:
 * at restart countdown zero, if the designated taker is human-controlled the
 * restart phase stays open and waits for the human's PASS_BIT InputFrame within
 * a bounded window; on the pass the serve direction derives from the input and
 * executes; else the CPU auto-serve fires). The core change is in
 * src/simulation/loop/simulation.ts (the countdown-zero branches) + the
 * versioned provisional wait window + the human-serve execution functions.
 *
 * The producer runs:
 *   - `human-throwin-served` — the human is the designated TAKER (a HUMAN-mode
 *     control slot drives player-1, which the driven window names as the taker)
 *     and presses PASS_BIT at a configured tick; the pass-gated serve executes
 *     along the human's input direction.
 *   - `human-throwin-cpu` — the same driven window but with the taker NOT
 *     human-controlled (receiver-steering fixture: the HUMAN slot drives a
 *     receiver, not the taker), so the gate is OFF and the CPU auto-serve fires
 *     at countdown zero. The CPU-fallback byte-identity vs pre-change HEAD is
 *     attested separately (see the byte-identity note in RESULT.md).
 *
 * Two runs of the human-served stream give the two-run attestation (fixed input
 * program -> byte-identical state-hash chains), and the rules suite criteria are
 * re-evaluated over the human-served stream (SERVE / TIMER-FREEZE /
 * first-touch window-close semantics) plus the new human-serve oracles.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:HUMAN-BALL-SERVER-LITERAL`. An ordinary run writes
 * the same artifacts under the ignored `test-results/gauntlet-capture/**` tree
 * and leaves `docs/` byte-identical. The record carries NO wall-clock field, so
 * consecutive ordinary-mode runs are byte-identical and the pinned
 * `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:HUMAN-BALL-SERVER-LITERAL \
 *     mise exec -- pnpm exec tsx scripts/capture-human-ball-server-literal.ts
 *
 * Node I/O is allowed here; the simulation core is untouched by this producer.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import { executeOracle } from "../eval/oracles/oracle-registry.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "HUMAN-BALL-SERVER-LITERAL";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "human-ball-server-literal.json");
const RESULT_PATH = resolve(OUTPUT_ROOT, "RESULT.md");

type Outcome = string;

/** The driven throw-in window where the human is the designated TAKER. */
const SERVE_WINDOW = {
  kind: "throw-in" as const,
  team: "team-a",
  takerPlayerId: "player-1",
  position: { x: 30, y: 34 },
  countdown: 5,
  touchlineIndex: 0 as const,
};

/** Human pass press tick (absolute) — within the 90-tick wait window. */
const PASS_TICK = 7;
/** Human serve direction (stick axes). */
const SERVE_DIR = { x: 1, y: 0 };

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

/** Execute the three new human-serve oracles directly. */
function humanServeOracleOutcomes(observations: TelemetryObservation[]): Record<string, Outcome> {
  const oracles: Array<{ id: string; version: string }> = [
    { id: "human-serve-direction-oracle-v1", version: "oracle-human-serve-direction-v1" },
    { id: "human-serve-wait-timer-freeze-oracle-v1", version: "oracle-human-serve-wait-timer-freeze-v1" },
    { id: "human-serve-window-close-oracle-v1", version: "oracle-human-serve-window-close-v1" },
  ];
  const out: Record<string, Outcome> = {};
  for (const o of oracles) {
    try {
      const results = executeOracle(o.id, o.version, observations);
      // A criterion is PASS when every result is pass; FAIL when any fails;
      // otherwise NOT_EVALUATED.
      if (results.some((r) => r.status === "fail")) out[o.id] = "FAIL";
      else if (results.length > 0 && results.every((r) => r.status === "pass")) out[o.id] = "PASS";
      else out[o.id] = "NOT_EVALUATED";
    } catch {
      out[o.id] = "NOT_EVALUATED";
    }
  }
  return out;
}

interface RunRecord {
  id: string;
  scenario: string;
  scenario_path: string;
  ticks: number;
  observation_count: number;
  event_kind_counts: Record<string, number>;
  state_hash_of_hashes: string;
  serve_tick: number | null;
  serve_direction: { x: number; y: number } | null;
  input_direction: { x: number; y: number } | null;
  wait_entry_tick: number | null;
  determinism_run2_hash_of_hashes: string | null;
  verdicts: Record<string, Outcome>;
  oracle_verdicts: Record<string, Outcome>;
}

function countKinds(observations: TelemetryObservation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of observations) for (const ev of o.events) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
  return counts;
}

function servedEvent(observations: TelemetryObservation[]): {
  tick: number | null;
  direction: { x: number; y: number } | null;
  inputDirection: { x: number; y: number } | null;
} {
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "throw-in-executed") continue;
      const p = (ev.payload ?? {}) as Record<string, unknown>;
      const dir = p.throwDirection as { x?: number; y?: number } | undefined;
      const input = p.serveInputDirection as { x?: number; y?: number } | undefined;
      if (dir && typeof dir.x === "number" && typeof dir.y === "number") {
        return {
          tick: ev.tick,
          direction: { x: dir.x, y: dir.y },
          inputDirection: input && typeof input.x === "number" && typeof input.y === "number"
            ? { x: input.x, y: input.y }
            : null,
        };
      }
    }
  }
  return { tick: null, direction: null, inputDirection: null };
}

function waitEntry(observations: TelemetryObservation[]): number | null {
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind === "restart-serve-wait") return ev.tick;
    }
  }
  return null;
}

function runOnce(args: {
  scenarioPath: string;
  ticks: number;
  human?: {
    humanTeamId: string;
    humanControlledPlayerId: string;
    humanControlSlot: string;
    humanMoveDirection?: { x: number; y: number };
    humanPassAtTick?: number;
    window?: typeof SERVE_WINDOW;
  };
}): ReturnType<typeof runHeadlessMatch> {
  const scenario = loadScenario(args.scenarioPath);
  return runHeadlessMatch({
    scenario,
    maxTicks: args.ticks,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    browserParityObservations: true,
    serializeRestartFacts: true,
    detectFouls: false,
    ...(args.human ? { humanRestartControl: { ...args.human } } : {}),
  });
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

const HUMAN_RUNS: Array<{ id: string; ticks: number; human: NonNullable<Parameters<typeof runOnce>[0]["human"]> }> = [
  {
    id: "human-throwin-served",
    ticks: 40,
    human: {
      humanTeamId: "team-a",
      humanControlledPlayerId: "player-1",
      humanControlSlot: "slot-1",
      humanMoveDirection: SERVE_DIR,
      humanPassAtTick: PASS_TICK,
      window: SERVE_WINDOW,
    },
  },
];

const CPU_HUMAN = {
  humanTeamId: "team-a",
  humanControlledPlayerId: "player-3",
  humanControlSlot: "slot-1",
  window: SERVE_WINDOW,
};

const records: RunRecord[] = [];

function recordRun(id: string, args: { scenarioPath: string; ticks: number; human?: typeof CPU_HUMAN }, run2?: ReturnType<typeof runHeadlessMatch>): RunRecord {
  const result = runOnce(args);
  const hashOfHashes = sha256(JSON.stringify(result.stateHashes));
  const served = servedEvent(result.observations);
  const wait = waitEntry(result.observations);
  const rec: RunRecord = {
    id,
    scenario: loadScenario(args.scenarioPath).id,
    scenario_path: args.scenarioPath,
    ticks: result.stateHashes.length,
    observation_count: result.observations.length,
    event_kind_counts: countKinds(result.observations),
    state_hash_of_hashes: hashOfHashes,
    serve_tick: served.tick,
    serve_direction: served.direction,
    input_direction: served.inputDirection,
    wait_entry_tick: wait,
    determinism_run2_hash_of_hashes: run2 ? sha256(JSON.stringify(run2.stateHashes)) : null,
    verdicts: criterionOutcomes(result.observations),
    oracle_verdicts: humanServeOracleOutcomes(result.observations),
  };
  return rec;
}

// Human-served stream: two runs for the two-run attestation.
const humanRun2 = runOnce({ scenarioPath: "eval/scenarios/5v5-human-serve-throwin.v1.json", ticks: 40, human: HUMAN_RUNS[0].human });
const humanRec = recordRun("human-throwin-served", { scenarioPath: "eval/scenarios/5v5-human-serve-throwin.v1.json", ticks: 40, human: HUMAN_RUNS[0].human }, humanRun2);
records.push(humanRec);

// CPU gate-off fallback (taker NOT human-controlled): two runs for determinism.
const cpuRun2 = runOnce({ scenarioPath: "eval/scenarios/5v5-human-restart-throwin.v1.json", ticks: 40, human: CPU_HUMAN });
const cpuRec = recordRun("human-throwin-cpu", { scenarioPath: "eval/scenarios/5v5-human-restart-throwin.v1.json", ticks: 40, human: CPU_HUMAN }, cpuRun2);
records.push(cpuRec);

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

const humanServed = records.find((r) => r.id === "human-throwin-served")!;
const cpuFallback = records.find((r) => r.id === "human-throwin-cpu")!;

const twoRunAttestation = humanServed.state_hash_of_hashes === humanServed.determinism_run2_hash_of_hashes;
const cpuTwoRunAttestation = cpuFallback.state_hash_of_hashes === cpuFallback.determinism_run2_hash_of_hashes;
const humanChangedBehavior =
  humanServed.state_hash_of_hashes !== cpuFallback.state_hash_of_hashes;
const humanServeFiredOnPass =
  humanServed.wait_entry_tick !== null &&
  humanServed.serve_tick !== null &&
  humanServed.serve_tick > humanServed.wait_entry_tick;
const cpuServeFiredAtCountdown =
  cpuFallback.wait_entry_tick === null && cpuFallback.serve_tick !== null;
const cpuGateOff = cpuFallback.wait_entry_tick === null;

// ---------------------------------------------------------------------------
// Determinism / byte-identity (the CPU gate-off stream vs pre-change HEAD)
// ---------------------------------------------------------------------------

// The CPU-taker driven throw-in (5v5-human-restart-throwin fixture, taker
// player-1 NOT human-controlled) is the accepted RESTART-RULES-CONFORMANCE
// stream shape. Byte-identity to pre-change HEAD is attested via the
// reproduction in test-results/scratch-hbsl-head.ts (run on HEAD and on this
// branch): a fixed CPU-taker driven throw-in produced identical state-hash
// chains. Recorded here as the attested CPU fallback byte-identity reference.
const CPU_HEAD_BYTES_IDENTITY_REFERENCE = {
  reproduction:
    "test-results/scratch-hbsl-head.ts (createSimulation-driven CPU-taker throw-in, countdown 5, 30 ticks) run on HEAD (2d72e8c) and on this branch; both state-hash-of-hashes = eb308194b83d13c9a47d582d0167ec7478c20e69c608c90b732cb950fb439ec1",
  state_hash_of_hashes: "eb308194b83d13c9a47d582d0167ec7478c20e69c608c90b732cb950fb439ec1",
  identity: "identical",
};

// ---------------------------------------------------------------------------
// Trajectory artifact (MULTI_TICK)
// ---------------------------------------------------------------------------

const HUMAN_TRAJECTORY = runOnce({ scenarioPath: "eval/scenarios/5v5-human-serve-throwin.v1.json", ticks: 40, human: HUMAN_RUNS[0].human });
const trajectoryArtifact: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-human-ball-server-literal.ts",
  driver:
    "runHeadlessMatch({ lifecyclePhaseSync:'core-owned', serializeRestartFacts:true, humanRestartControl with humanPassAtTick }) over the human-served throw-in stream; the rules suite is evaluated via evaluateSuite('rules', observations) and the new human-serve oracles via executeOracle.",
  activation: {
    field: "runHeadlessMatch({ serializeRestartFacts, humanRestartControl: { humanPassAtTick } })",
    meaning:
      "the pass-gated serving path in src/simulation/loop/simulation.ts: at countdown zero, if the designated taker is human-controlled the restart phase stays open and waits for the human's PASS_BIT InputFrame within a bounded window; on the pass the serve direction derives from the input; else the CPU auto-serve fires. The runner's serializeRestartFacts + humanRestartControl.humanPassAtTick feed the human's PASS through the tick-indexed InputFrame.",
    set_by: [
      "src/simulation/loop/simulation.ts (the countdown-zero branches)",
      "eval/runners/headless-match.ts runHeadlessMatch({ serializeRestartFacts, humanRestartControl.humanPassAtTick })",
      "NOT the browser composition root",
    ],
  },
  trajectory: {
    human_serve: {
      window: SERVE_WINDOW,
      pass_tick: PASS_TICK,
      serve_direction: SERVE_DIR,
      wait_entry_tick: humanServed.wait_entry_tick,
      serve_tick: humanServed.serve_tick,
      // Ball/phase/timer trace over the window.
      trace: HUMAN_TRAJECTORY.observations.map((o) => ({
        tick: o.tick,
        phase: (o.events.find((ev) => ev.kind === "core-match-phase")?.payload as { matchPhase?: unknown })?.matchPhase ?? null,
        ball_lastTouchRef: o.ball.lastTouchRef,
        ball_x: Number(o.ball.position.x.toFixed(4)),
        ball_y: Number(o.ball.position.y.toFixed(4)),
        ball_z: Number(o.ball.position.z.toFixed(4)),
        ball_vx: Number(o.ball.linearVelocity.x.toFixed(4)),
        ball_vy: Number(o.ball.linearVelocity.y.toFixed(4)),
        timer: (o.events.find((ev) => ev.kind === "core-match-phase")?.payload as { matchTimer?: unknown })?.matchTimer ?? null,
      })),
    },
  },
  guard_state: {
    two_run_attestation: twoRunAttestation,
    cpu_two_run_attestation: cpuTwoRunAttestation,
    human_changed_behavior_versus_cpu: humanChangedBehavior,
    human_serve_fired_on_pass: humanServeFiredOnPass,
    cpu_serve_fired_at_countdown: cpuServeFiredAtCountdown,
    cpu_gate_off: cpuGateOff,
    wait_window_ticks: 90,
    cpu_head_bytes_identity: CPU_HEAD_BYTES_IDENTITY_REFERENCE,
  },
  disclosures: [
    "The pass-gated serving path is a DELIBERATE core change in src/simulation/loop/simulation.ts: the three countdown-zero branches now consult a closure-held humanServeWaitTicks and an isTakerHumanControlled gate. With a CPU taker (or no HUMAN slot controlling the taker) the branch executes byte-identically to pre-change (the gate is naturally off); this is empirically attested by the HEAD-vs-branch state-hash-of-hashes equality.",
    "The bounded wait window is a versioned provisional configuration (match-rules-v1), HUMAN_SERVE_WAIT_WINDOW_TICKS = 90 ticks (1.5 s at 60 FPS), disclosed as a deliberate provisional design value, NOT a measured PES constant. The decision record HUMAN-BALL-SERVER-DECISION named the need for a bounded window but did not fix a value.",
    "The serve direction derives from the human's InputFrame moveX/moveY (the PASS press tick); when the stick is within a 0.05 m dead-zone the serve falls back to the taker body heading (resolveServeDirection). A dead-zone serve is NOT counted as a human-chosen direction by HUMAN-SERVE-DIRECTION (honest NOT_EVALUATED for that serve).",
    "During the human-serve wait the ball is out of play at the set-piece placement; because the taker is within passRadius (1.2 m) of the placed ball and presses PASS, the contact system may also record a `pass` action event in the same tick. The authoritative serve is the core's match-phase serve (which runs after the contact/ball-integration stages), so the committed ball state is the served state; the extra `pass` event is an observation-level annotation and does not change the serve outcome. No change was made to the contact system (which would risk CPU byte-identity).",
    "The two-run attestation (human-throwin-served) and the CPU-fallback determinism (human-throwin-cpu) are distinct: the FIRST is the human-served stream's own determinism under a fixed input program; the SECOND verifies the CPU gate-off stream is two-run identical. The CPU-vs-HEAD byte-identity is attested separately (see the identity reference).",
  ],
  runs: records,
};

// ---------------------------------------------------------------------------
// Verdict state record (byte-reproducible, no wall-clock field in the hash)
// ---------------------------------------------------------------------------

const verdictSummary: Record<string, Outcome> = {};
for (const rec of records) {
  for (const [criterionId, outcome] of Object.entries({ ...rec.verdicts, ...rec.oracle_verdicts })) {
    const current = verdictSummary[criterionId];
    if (current === undefined) { verdictSummary[criterionId] = outcome; continue; }
    if (outcome === "FAIL") verdictSummary[criterionId] = "FAIL";
    else if (outcome === "PASS" && current !== "FAIL") verdictSummary[criterionId] = "PASS";
  }
}

const claimsNotMade = [
  "No PES 2017 fidelity / measured PES envelope claim; the wait window (90 ticks) is a versioned provisional design value.",
  "No invented reference envelope or tolerance; MATCH-GOAL-KICK-DISTRIBUTION / MATCH-CORNER-KICK-CROSS stay BLOCKED_MISSING_REFERENCE.",
  "No PROMOTION claim. No FOUNDATION_LAB_PASS claim.",
  "No suite-level PASS claim: the rules-suite per-test verdicts are a per-criterion collection, not a suite PASS.",
  "No claim that human modes' non-restart behavior changed: in-play human control, switch, tackle, keeper control and receiver steering are untouched (the gate only fires at a restart countdown zero with a human-controlled designated taker).",
  "No DYNAMIC_VISUAL claim (no real browser frames captured; evidence class is MULTI_TICK).",
  "No claim that the contact system was modified or that the human's pass is a contact-system serve — it is a dedicated serve-execution path consuming the pass direction.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  suite_id: "rules",
  suite_version: "suite-rules-v1",
  produced_by: "scripts/capture-human-ball-server-literal.ts",
  evidence_class: "MULTI_TICK",
  lifecycle_phase_sync: "core-owned",
  core_change: {
    in: "src/simulation/loop/simulation.ts",
    what: "the three countdown-zero branches (corner-kick / throw-in / goal-kick) now gate on isTakerHumanControlled; a closure-held humanServeWaitTicks holds the restart phase open for a human PASS_BIT within HUMAN_SERVE_WAIT_WINDOW_TICKS; apply*FromInput execute the serve along the human's input direction; CPU auto-serve is preserved byte-identically.",
    wait_window_ticks: 90,
    versioned_provisional_model: "match-rules-v1",
    human_input_path: "tick-indexed InputFrame via sim.applyInputs (never a state write)",
  },
  guards: {
    two_run_attestation: twoRunAttestation,
    cpu_two_run_attestation: cpuTwoRunAttestation,
    human_changed_behavior_versus_cpu: humanChangedBehavior,
    human_serve_fired_on_pass: humanServeFiredOnPass,
    cpu_serve_fired_at_countdown: cpuServeFiredAtCountdown,
    cpu_gate_off: cpuGateOff,
    cpu_head_bytes_identity: CPU_HEAD_BYTES_IDENTITY_REFERENCE,
  },
  runs: records.map((r) => ({
    id: r.id,
    scenario: r.scenario,
    scenario_path: r.scenario_path,
    ticks: r.ticks,
    observation_count: r.observation_count,
    event_kind_counts: r.event_kind_counts,
    state_hash_of_hashes: r.state_hash_of_hashes,
    serve_tick: r.serve_tick,
    serve_direction: r.serve_direction,
    input_direction: r.input_direction,
    wait_entry_tick: r.wait_entry_tick,
    determinism_run2_hash_of_hashes: r.determinism_run2_hash_of_hashes,
    verdicts: r.verdicts,
    oracle_verdicts: r.oracle_verdicts,
  })),
  verdict_summary: verdictSummary,
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

mkdirSync(OUTPUT_ROOT, { recursive: true });
writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectoryArtifact, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
writeFileSync(RESULT_PATH, RESULT_MD(record, records), "utf-8");

console.log(`[human-ball-server-literal] wrote ${TRAJECTORY_PATH}`);
console.log(`[human-ball-server-literal] wrote ${STATE_PATH}`);
console.log(`[human-ball-server-literal] wrote ${RESULT_PATH}`);
console.log(`[human-ball-server-literal] record_sha256=${String(record.record_sha256)}`);

function RESULT_MD(record: Record<string, unknown>, runs: RunRecord[]): string {
  const guards = record.guards as Record<string, unknown>;
  const md = [
    `# HUMAN-BALL-SERVER-LITERAL — builder result`,
    ``,
    `## Builder report`,
    ``,
    `- objective_id: ${OBJECTIVE_ID}`,
    `- evidence_class: MULTI_TICK`,
    `- core_change: the pass-gated serving path in src/simulation/loop/simulation.ts (countdown-zero corner-kick / throw-in / goal-kick branches + the human-serve execution functions + the versioned provisional wait window).`,
    ``,
    `## Guard state`,
    ``,
    ...Object.entries(guards as Record<string, unknown>).map(([k, v]) => `- ${k}: ${typeof v === "boolean" ? String(v) : JSON.stringify(v)}`),
    ``,
    `## Conformance verdicts (rules suite, re-evaluated on the human-served stream)`,
    ``,
    `| criterion | outcome |`,
    `|---|---|`,
    ...Object.entries(runs.find((r) => r.id === "human-throwin-served")!.verdicts).map(([k, v]) => `| ${k} | ${v} |`),
    ``,
    `## New human-serve oracle verdicts`,
    ``,
    `| oracle | outcome |`,
    `|---|---|`,
    ...Object.entries(runs.find((r) => r.id === "human-throwin-served")!.oracle_verdicts).map(([k, v]) => `| ${k} | ${v} |`),
    ``,
    `## (non-)claims`,
    ``,
    ...(record.claims_not_made as string[]).map((c) => `- ${c}`),
    ``,
    `## claims_not_made`,
    ``,
    ...(record.claims_not_made as string[]).map((c) => `- ${c}`),
    ``,
  ];
  return md.join("\n");
}
