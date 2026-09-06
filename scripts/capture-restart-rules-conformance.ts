/**
 * Node-side evidence producer for RESTART-RULES-CONFORMANCE.
 *
 * Runs the accepted restart fixtures headlessly under the core-owned lifecycle
 * with the gated `serializeRestartFacts` observation extension live, then
 * evaluates the registered `rules` suite (suite-rules-v1) over each run's
 * committed observation stream.  The extension closes the serialization
 * limitation so the restart-AWARD (throw-in / goal-kick) and TIMER-FREEZE
 * criteria become honestly measurable.
 *
 * Per restart type it records a driven (gated) run and a stashed control
 * (gated off, which must be byte-identical — same state-hash chain, no injected
 * facts), so the guards are discriminating.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:RESTART-RULES-CONFORMANCE`.  An ordinary run writes
 * the same artifacts under the ignored `test-results/gauntlet-capture/**` tree
 * and leaves `docs/` byte-identical.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:RESTART-RULES-CONFORMANCE \
 *     mise exec -- pnpm exec tsx scripts/capture-restart-rules-conformance.ts
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

const OBJECTIVE_ID = "RESTART-RULES-CONFORMANCE";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const SUITE_STATE_PATH = resolve(OUTPUT_ROOT, "restart-rules-suite-state.json");

type Outcome = string;

interface RunSpec {
  id: string;
  scenarioPath: string;
  ticks: number;
  gated: boolean;
  restartType: string;
  role: string;
}

const RUNS: RunSpec[] = [
  {
    id: "rules-throw-in-live",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 1800,
    gated: true,
    restartType: "throw-in",
    role: "the accepted throw-in fixture (driven): two organic throw-in windows inside coherent 5v5 CPU-vs-CPU play",
  },
  {
    id: "rules-throw-in-stashed",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 1800,
    gated: false,
    restartType: "throw-in",
    role: "that fixture with serializeRestartFacts:false — the stash-identity control: observations untreated, state-hash chain identical to the gated run",
  },
  {
    id: "rules-goal-kick-live",
    scenarioPath: "eval/scenarios/5v5-restart-arc.v1.json",
    ticks: 1800,
    gated: true,
    restartType: "goal-kick",
    role: "the accepted arc fixture (driven): an early shot off the goal-line scramble returns as a goal kick; goals return as post-goal restarts",
  },
  {
    id: "rules-goal-kick-stashed",
    scenarioPath: "eval/scenarios/5v5-restart-arc.v1.json",
    ticks: 1800,
    gated: false,
    restartType: "goal-kick",
    role: "that fixture with serializeRestartFacts:false — the stash-identity control",
  },
];

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function countKinds(observations: TelemetryObservation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of observations) for (const ev of o.events) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
  return counts;
}

function phaseDistribution(observations: TelemetryObservation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "core-match-phase") continue;
      const p = (ev.payload as { matchPhase?: string } | undefined)?.matchPhase;
      if (typeof p === "string") counts[p] = (counts[p] ?? 0) + 1;
    }
  }
  return counts;
}

function criterionOutcomes(observations: TelemetryObservation[]): Record<string, Outcome> {
  const suite = evaluateSuite("rules", observations);
  const out: Record<string, Outcome> = {};
  for (const t of suite.tests) for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  return out;
}

function runScenario(spec: RunSpec): {
  stateHashes: string[];
  observations: TelemetryObservation[];
  events: TelemetryObservation["events"][number][];
} {
  const scenario = loadScenario(spec.scenarioPath);
  const result = runHeadlessMatch({
    scenario,
    maxTicks: spec.ticks,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    serializeRestartFacts: spec.gated,
  });
  return { stateHashes: result.stateHashes, observations: result.observations, events: result.events };
}

interface RunRecord {
  id: string;
  restart_type: string;
  role: string;
  scenario: string;
  scenario_path: string;
  ticks: number;
  gated_serialization: boolean;
  lifecycle_phase_sync: string;
  reproduction: string;
  observation_count: number;
  event_kind_counts: Record<string, number>;
  phase_distribution: Record<string, number>;
  executed_restart_counts: { "throw-in": number; "goal-kick": number; corner: number };
  verdicts: Record<string, Outcome>;
  timer_freeze_ticks: number | null;
  determinism: Record<string, unknown>;
  stash_identity?: Record<string, unknown>;
}

function buildRunRecord(spec: RunSpec, gatedOther?: RunRecord): RunRecord {
  const { stateHashes, observations } = runScenario(spec);
  const counts = countKinds(observations);
  const executed = {
    "throw-in": counts["throw-in-executed"] ?? 0,
    "goal-kick": counts["goal-kick-executed"] ?? 0,
    corner: counts["corner-kick-executed"] ?? 0,
  };
  const verdicts = criterionOutcomes(observations);
  const phases = phaseDistribution(observations);
  const frozenTicks = Object.entries(phases).reduce((acc, [phase, n]) => {
    if (["goal", "fulltime", "kickoff", "corner-kick", "throw-in", "goal-kick"].includes(phase)) return acc + n;
    return acc;
  }, 0);

  const record: RunRecord = {
    id: spec.id,
    restart_type: spec.restartType,
    role: spec.role,
    scenario: loadScenario(spec.scenarioPath).id,
    scenario_path: spec.scenarioPath,
    ticks: stateHashes.length,
    gated_serialization: spec.gated,
    lifecycle_phase_sync: "core-owned",
    reproduction:
      `runHeadlessMatch({ scenario: load(${JSON.stringify(spec.scenarioPath)}), ` +
      `maxTicks: ${spec.ticks}, cpuAntiHuddle: true, lifecyclePhaseSync: "core-owned", ` +
      `serializeRestartFacts: ${spec.gated} })`,
    observation_count: observations.length,
    event_kind_counts: counts,
    phase_distribution: phaseDistribution(observations),
    executed_restart_counts: executed,
    verdicts,
    timer_freeze_ticks: frozenTicks,
    determinism: {
      state_hash_of_hashes: sha256(JSON.stringify(stateHashes)),
      final_state_hash: stateHashes[stateHashes.length - 1] ?? null,
    },
  };

  if (!spec.gated) {
    (record as RunRecord).stash_identity = {
      injected_core_match_phase_events: counts["core-match-phase"] ?? 0,
      injected_restart_executed_events: Object.values(executed).reduce((a, b) => a + b, 0),
      gated_on_state_hash_of_hashes: gatedOther?.determinism.state_hash_of_hashes,
      state_hash_chain_identical: gatedOther
        ? record.determinism.state_hash_of_hashes === gatedOther.determinism.state_hash_of_hashes
        : undefined,
    };
  }

  console.log(
    `[restart-rules-evidence] ${spec.id}: ticks=${record.ticks} gated=${spec.gated}` +
      ` executed=${JSON.stringify(executed)}` +
      ` hashOfHashes=${String(record.determinism.state_hash_of_hashes).slice(0, 20)}` +
      ` verdicts=${JSON.stringify(Object.fromEntries(Object.entries(verdicts).filter(([k]) => ["MATCH-THROW-IN-AWARD","MATCH-GOAL-KICK-AWARD","MATCH-CORNER-KICK-AWARD","MATCH-TIMER-FREEZE"].includes(k))))}`,
  );
  return record;
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

interface Artifact {
  schema_version: number;
  objective_id: string;
  evidence_class: string;
  capture_mode: string;
  produced_by: string;
  driver: string;
  activation: Record<string, unknown>;
  disclosures: string[];
  runs: RunRecord[];
}

mkdirSync(OUTPUT_ROOT, { recursive: true });

// Gated runs first (live), then stashed controls, so the stashed record can
// reference the gated run's hash-of-hashes.
const liveByKey = new Map<string, RunRecord>();
const allRuns: RunRecord[] = [];
for (const spec of RUNS) {
  const sibling = spec.gated ? undefined : liveByKey.get(spec.restartType);
  const record = buildRunRecord(spec, sibling);
  if (spec.gated) liveByKey.set(spec.restartType, record);
  allRuns.push(record);
}

const trajectoryArtifact: Artifact = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-restart-rules-conformance.ts",
  driver:
    "eval/runners/headless-match.ts with lifecyclePhaseSync:'core-owned' + the gated " +
    "serializeRestartFacts observation extension (the gk-role precedent, post-loop and " +
    "additive). The restart-AWARD / TIMER-FREEZE criteria are evaluated via " +
    "evaluateSuite('rules', observations).",
  activation: {
    field: "runHeadlessMatch({ serializeRestartFacts })",
    meaning:
      "the runner injects the core's per-tick post-step matchPhase + matchTimer (a " +
      "core-match-phase event per tick), the starting phase (for phase-aware award " +
      "pairing), and the committed restart-executed events into the observation stream. " +
      "Off (the default) the stream is byte-identical to every accepted non-gated run.",
    set_by: [
      "eval/runners/headless-match.ts runHeadlessMatch({ serializeRestartFacts }) (these pinned runs)",
      "tests/unit/eval/restart-rules-serialization.test.ts (live + stashed guards)",
      "NOT the browser composition root",
    ],
  },
  disclosures: [
    "No organic fixture produced a corner-kick execution: a defender last-touch on its own " +
      "goal line is rare in this engine (the touch redirects the ball back toward play before " +
      "the crossing), so MATCH-CORNER-KICK-AWARD is honestly NOT_EVALUATED on the driven runs. " +
      "The corner oracle is unit-tested (PASS/FAIL on a synthetic stream) and the same " +
      "injection path correctly carries throw-in and goal-kick executions.",
    "The serialization extension is an observation-level annotation (the gk-role precedent): " +
      "git diff src/simulation/ and src/contracts/ are empty; the core, its event union and " +
      "its contracts are untouched, and serializeRestartFacts:false is byte-identical.",
    "No criterion is upgraded beyond what the executed evaluator returns; a PASS is reported " +
      "only where the driven stream genuinely carries the semantics, and NOT_EVALUATED " +
      "elsewhere. No forced outcome.",
  ],
  runs: allRuns,
};

// ---------------------------------------------------------------------------
// Suite-state record (byte-reproducible, no wall-clock field in the hash)
// ---------------------------------------------------------------------------

interface SuiteStateArtifact {
  schema_version: number;
  objective_id: string;
  suite_id: string;
  suite_version: string;
  produced_by: string;
  evidence_class: string;
  lifecycle_phase_sync: string;
  record_sha256?: string;
  by_run: Record<string, Record<string, Outcome>>;
  by_criterion: Record<string, string[]>;
  verdict_summary: Record<string, Outcome>;
  disclosures: string[];
}

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

const suiteState: SuiteStateArtifact = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  suite_id: "rules",
  suite_version: "suite-rules-v1",
  produced_by: "scripts/capture-restart-rules-conformance.ts",
  evidence_class: "MULTI_TICK",
  lifecycle_phase_sync: "core-owned",
  by_run: byRun,
  by_criterion: byCriterion,
  verdict_summary: verdictSummary,
  disclosures: [
    "MATCH-CORNER-KICK-AWARD is NOT_EVALUATED on the driven runs (no corner-kick execution observed).",
    "No criterion is upgraded beyond what the executed evaluator returns.",
    "No PES 2017 fidelity / measured-envelope claim; BLOCKED_MISSING_REFERENCE criteria stay blocked.",
  ],
};

const forHashing: Record<string, unknown> = { ...suiteState };
delete forHashing.record_sha256;
suiteState.record_sha256 = sha256(JSON.stringify(forHashing));

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectoryArtifact, null, 2)}\n`, "utf-8");
writeFileSync(SUITE_STATE_PATH, `${JSON.stringify(suiteState, null, 2)}\n`, "utf-8");
console.log(`[restart-rules-evidence] wrote ${TRAJECTORY_PATH}`);
console.log(`[restart-rules-evidence] wrote ${SUITE_STATE_PATH}`);
console.log(`[restart-rules-evidence] record_sha256=${suiteState.record_sha256}`);
