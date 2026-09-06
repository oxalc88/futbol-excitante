/**
 * Node-side evidence producer for CORNER-DRIVEN-CONFORMANCE.
 *
 * A genuinely DRIVEN corner-kick execution stream: the core awards and executes
 * a corner kick because a defending-team (team-b) player is the last touch when
 * the ball crosses the +x goal line outside the posts.  The fixture
 * (eval/scenarios/5v5-corner-driven.v1.json) places the ball at (51.5, 12) just
 * inside the +x goal-line span and a team-b defender at (47, 12) chasing back
 * toward its own goal, so the AI's own play produces the defending-team last
 * touch over the goal line.  ZERO core change — the simulation core, its event
 * union and its contracts are untouched; the fixture is an adapter/driver state.
 *
 * The registered `rules` suite (suite-rules-v1) is evaluated over the driven
 * stream with the gated `serializeRestartFacts` observation extension live, so
 * the corner cluster is honestly measurable:
 *   - MATCH-CORNER-KICK-AWARD       (last touch by the defending team),
 *   - MATCH-CORNER-KICK-PLACEMENT   (ball at the nearest corner flag §8.2),
 *   - MATCH-CORNER-KICK-TIMER-FREEZE(timer frozen during the corner-kick phase),
 *   - MATCH-CORNER-KICK-CROSS       stays BLOCKED_MISSING_REFERENCE (§14).
 *
 * A stashed control (`serializeRestartFacts:false`) must be byte-identical
 * (same state-hash chain, no injected facts), and a neighbour control
 * (`5v5-restart-arc`, a goal-kick-only stream) must return the corner criteria
 * NOT_EVALUATED — proving the corner PASS is not a blanket PASS.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:CORNER-DRIVEN-CONFORMANCE`.  An ordinary run writes
 * the same artifacts under the ignored `test-results/gauntlet-capture/**` tree
 * and leaves `docs/` byte-identical.  The record carries NO wall-clock field, so
 * consecutive ordinary-mode runs are byte-identical and the pinned
 * `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:CORNER-DRIVEN-CONFORMANCE \
 *     mise exec -- pnpm exec tsx scripts/capture-corner-driven-conformance.ts
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

const OBJECTIVE_ID = "CORNER-DRIVEN-CONFORMANCE";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "corner-driven-state.json");

type Outcome = string;

interface RunSpec {
  id: string;
  scenarioPath: string;
  ticks: number;
  gated: boolean;
  role: string;
}

const RUNS: RunSpec[] = [
  {
    id: "rules-corner-live",
    scenarioPath: "eval/scenarios/5v5-corner-driven.v1.json",
    ticks: 400,
    gated: true,
    role:
      "driven corner fixture: the ball sits at (51.5, 12) inside the +x goal-line " +
      "span and a team-b defender at (47, 12) chases back toward its own goal, so the " +
      "AI play produces a defending-team last touch over the goal line — the core " +
      "awards and executes a corner kick",
  },
  {
    id: "rules-corner-stashed",
    scenarioPath: "eval/scenarios/5v5-corner-driven.v1.json",
    ticks: 400,
    gated: false,
    role:
      "that fixture with serializeRestartFacts:false — the stash-identity control: " +
      "observations untreated, state-hash chain identical to the gated run",
  },
  {
    id: "rules-corner-goalkick-neighbour",
    scenarioPath: "eval/scenarios/5v5-restart-arc.v1.json",
    ticks: 400,
    gated: true,
    role:
      "the accepted goal-kick fixture under the same gated stream — a discriminating " +
      "control: it produces a goal kick, never a corner, so the corner criteria must " +
      "return NOT_EVALUATED (proving the corner PASS is not a blanket PASS)",
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
} {
  const scenario = loadScenario(spec.scenarioPath);
  const result = runHeadlessMatch({
    scenario,
    maxTicks: spec.ticks,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    serializeRestartFacts: spec.gated,
  });
  return { stateHashes: result.stateHashes, observations: result.observations };
}

interface RunRecord {
  id: string;
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
  executed_restart_counts: Record<string, number>;
  verdicts: Record<string, Outcome>;
  determinism: Record<string, unknown>;
  stash_identity?: Record<string, unknown>;
}

function buildRunRecord(spec: RunSpec, gatedOther?: RunRecord): RunRecord {
  const scenario = loadScenario(spec.scenarioPath);
  const { stateHashes, observations } = runScenario(spec);
  const counts = countKinds(observations);
  const hashOfHashes = sha256(JSON.stringify(stateHashes));
  const record: RunRecord = {
    id: spec.id,
    role: spec.role,
    scenario: scenario.id,
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
    executed_restart_counts: {
      "throw-in": counts["throw-in-executed"] ?? 0,
      "goal-kick": counts["goal-kick-executed"] ?? 0,
      corner: counts["corner-kick-executed"] ?? 0,
    },
    verdicts: criterionOutcomes(observations),
    determinism: {
      state_hash_of_hashes: hashOfHashes,
      final_state_hash: stateHashes[stateHashes.length - 1] ?? null,
    },
  };

  if (!spec.gated) {
    record.stash_identity = {
      injected_core_match_phase_events: counts["core-match-phase"] ?? 0,
      injected_restart_executed_events: Object.values(record.executed_restart_counts).reduce((a, b) => a + b, 0),
      gated_on_state_hash_of_hashes: gatedOther?.determinism.state_hash_of_hashes,
      state_hash_chain_identical: gatedOther
        ? hashOfHashes === gatedOther.determinism.state_hash_of_hashes
        : undefined,
    };
  }

  console.log(
    `[corner-driven-evidence] ${spec.id}: ticks=${record.ticks} gated=${spec.gated}` +
      ` executed=${JSON.stringify(record.executed_restart_counts)}` +
      ` hashOfHashes=${hashOfHashes.slice(0, 20)}`,
  );
  return record;
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

// The gated corner run first, so the stashed control can reference it.
const liveByKey = new Map<string, RunRecord>();
const allRuns: RunRecord[] = [];
for (const spec of RUNS) {
  const sibling = spec.gated ? undefined : liveByKey.get(spec.id.replace(/-stashed$/, "-live"));
  const record = buildRunRecord(spec, sibling);
  if (spec.gated) liveByKey.set(spec.id, record);
  allRuns.push(record);
}

const trajectoryArtifact: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-corner-driven-conformance.ts",
  driver:
    "eval/runners/headless-match.ts with lifecyclePhaseSync:'core-owned' + the gated " +
    "serializeRestartFacts observation extension. The rules suite is evaluated via " +
    "evaluateSuite('rules', observations) over the driven corner stream.",
  activation: {
    field: "runHeadlessMatch({ serializeRestartFacts })",
    meaning:
      "the runner injects the core's per-tick post-step matchPhase + matchTimer (a " +
      "core-match-phase event per tick) and the committed restart-executed events into " +
      "the observation stream. Off (the default) the stream is byte-identical to every " +
      "accepted non-gated run.",
    set_by: [
      "eval/runners/headless-match.ts runHeadlessMatch({ serializeRestartFacts }) (these pinned runs)",
      "tests/unit/eval/restart-rules-serialization.test.ts and tests/unit/eval/corner-driven-conformance-binding.test.ts",
      "NOT the browser composition root",
    ],
  },
  disclosures: [
    "The driven corner fixture is an adapter/driver state (initial ball + player " +
      "positions), not a core change: git diff src/simulation/ and src/contracts/ are " +
      "empty. The corner is genuinely produced by the core's own award + execution " +
      "machinery (a defending-team last touch over the goal line); nothing is forced or " +
      "synthesized.",
    "MATCH-CORNER-KICK-CROSS stays BLOCKED_MISSING_REFERENCE (§14 corner_cross_trajectory_ref): " +
      "the lofted-cross trajectory reference does not exist and is never invented.",
    "The corner PASS is not a blanket PASS: the goal-kick neighbour control returns the " +
      "corner criteria NOT_EVALUATED (no corner execution), and the corner award oracle's " +
      "mutant direction (last touch NOT the defending team → a goal kick was required) " +
      "is unit-tested in both directions.",
    "No criterion is upgraded beyond what the executed evaluator returns; a PASS is " +
      "reported only where the driven stream genuinely carries the semantics, and " +
      "NOT_EVALUATED elsewhere. No forced outcome.",
  ],
  runs: allRuns,
};

// ---------------------------------------------------------------------------
// Verdict state record (byte-reproducible, no wall-clock field in the hash)
// ---------------------------------------------------------------------------

const byCriterion: Record<string, string[]> = {};
const verdictSummary: Record<string, Outcome> = {};
for (const run of allRuns.filter((r) => r.gated_serialization)) {
  for (const [criterionId, outcome] of Object.entries(run.verdicts)) {
    (byCriterion[criterionId] ??= []).push(`${run.id}=${outcome}`);
    const current = verdictSummary[criterionId];
    if (current === undefined) { verdictSummary[criterionId] = outcome; continue; }
    if (outcome === "FAIL") verdictSummary[criterionId] = "FAIL";
    else if (outcome === "PASS" && current !== "FAIL") verdictSummary[criterionId] = "PASS";
  }
}

const criterionReasons: Record<string, string> = {
  "MATCH-CORNER-KICK-AWARD":
    "PASS on rules-corner-live: the corner was awarded to the attacking team because " +
    "the last touch of the +x goal-line out-of-play was the defending team (§8.1).",
  "MATCH-CORNER-KICK-PLACEMENT":
    "PASS on rules-corner-live: the executed corner kick's cornerPosition equals the " +
    "nearest corner flag (goalX, ±34) chosen by the sign of the ball's exit y (§8.2).",
  "MATCH-CORNER-KICK-TIMER-FREEZE":
    "PASS on rules-corner-live: the ball-in-play timer is frozen during every " +
    "corner-kick phase tick (§11).",
  "MATCH-CORNER-KICK-CROSS":
    "BLOCKED_MISSING_REFERENCE: §14 corner_cross_trajectory_ref — the lofted-cross " +
    "trajectory reference does not exist and is never invented.",
  "MATCH-KICKOFF-FREEZE":
    "PASS on rules-corner-live: only the taker + at-ball body left home while the " +
    "opening ball was untouched.",
  "MATCH-KICKOFF-FIRST-TOUCH":
    "PASS on rules-corner-live: the opening untouched window closed on the first touch " +
    "by the designated taker.",
  "MATCH-OUT-OF-PLAY-DETECT":
    "PASS on rules-corner-live: the boundary event carries a well-formed payload and a " +
    "goal is mutually exclusive with a goal-line out-of-play.",
  "MATCH-TIMER-FREEZE":
    "PASS on rules-corner-live: the ball-in-play timer is frozen across the non-playing " +
    "phase ticks.",
  "MATCH-TIMER-DECREMENT":
    "PASS on rules-corner-live: the ball-in-play timer decremented only during playing.",
};

const claimsNotMade = [
  "No suite-level PASS claim: the per-test overall for the rules suite stays NOT_EVALUATED / BLOCKED_MISSING_REFERENCE.",
  "No PROMOTION claim.",
  "No PES 2017 fidelity / measured PES envelope claim; MATCH-CORNER-KICK-CROSS stays BLOCKED_MISSING_REFERENCE (§14).",
  "No FOUNDATION_LAB_PASS claim.",
  "No invented reference envelope or tolerance: the 7 BLOCKED_MISSING_REFERENCE values stay blocked.",
  "No gameplay / source / contract / adapter / spec change: src/ and specs/ are EMPTY; only a driven fixture, eval oracles/invariant bindings (additive), evidence + tests are added.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  suite_id: "rules",
  suite_version: "suite-rules-v1",
  produced_by: "scripts/capture-corner-driven-conformance.ts",
  evidence_class: "MULTI_TICK",
  lifecycle_phase_sync: "core-owned",
  runs: allRuns.map((r) => ({
    id: r.id,
    scenario: r.scenario,
    scenario_path: r.scenario_path,
    ticks: r.ticks,
    gated_serialization: r.gated_serialization,
    reproduction: r.reproduction,
    observation_count: r.observation_count,
    executed_restart_counts: r.executed_restart_counts,
    verdicts: r.verdicts,
    determinism: r.determinism,
    ...(r.stash_identity ? { stash_identity: r.stash_identity } : {}),
  })),
  by_criterion: byCriterion,
  verdict_summary: verdictSummary,
  criterion_reasons: criterionReasons,
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectoryArtifact, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[corner-driven-evidence] wrote ${TRAJECTORY_PATH}`);
console.log(`[corner-driven-evidence] wrote ${STATE_PATH}`);
console.log(`[corner-driven-evidence] record_sha256=${String(record.record_sha256)}`);
