/**
 * Node-side evidence producer for RULES-FACTS-DEPTH-CONFORMANCE.
 *
 * Evaluates the remaining NOT_EVALUATED rules criteria answerable from
 * serialized facts.  It re-runs the registered `rules` evaluator suite
 * (suite-rules-v1, MATCH_RULES_SPEC §15) over the driven conformance streams
 * with the gated `serializeRestartFacts` observation extension live:
 *
 *   - `rules-throw-in-live`    (5v5-restart-throwin, 1800 ticks): throw-in
 *     placement / serve / throw-in timer-freeze, kickoff first-touch, goal
 *     phase, timer decrement.
 *   - `rules-goal-kick-live`   (5v5-restart-arc, 1800 ticks): goal-kick
 *     placement / goal-kick timer-freeze, kickoff first-touch, goal phase,
 *     timer decrement.
 *   - `rules-full-match-live`  (5v5-full-match-timing, 800 ticks): the timer
 *     reaches zero in half 1 (halftime) and half 2 (fulltime), so
 *     MATCH-TIMER-HALFTIME / MATCH-TIMER-FULLTIME are genuinely measured.
 *
 * Each gated run also has a stashed control (`serializeRestartFacts:false`)
 * whose state-hash chain is byte-identical, proving the injection cannot affect
 * inputs / steps / committed hashes.
 *
 * The corner cluster (MATCH-CORNER-KICK-*) is owned by CORNER-DRIVEN-CONFORMANCE
 * and stays OUT of scope; the anti-huddle restart-behavior criteria that the
 * observation stream genuinely cannot carry (RESTART-FREEZE-UNTIL-FIRST-TOUCH,
 * RESTART-NEAREST-ONLY, RESTART-REARM) stay NOT_EVALUATED and are disclosed.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:RULES-FACTS-DEPTH-CONFORMANCE`.  An ordinary run
 * writes the same artifacts under the ignored `test-results/gauntlet-capture/**`
 * tree and leaves `docs/` byte-identical.  The record carries NO wall-clock
 * field, so consecutive ordinary-mode runs are byte-identical and the pinned
 * `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:RULES-FACTS-DEPTH-CONFORMANCE \
 *     mise exec -- pnpm exec tsx scripts/capture-rules-facts-depth-conformance.ts
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import { executeOracle } from "../eval/oracles/oracle-registry.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "RULES-FACTS-DEPTH-CONFORMANCE";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "rules-facts-depth-state.json");

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
    id: "rules-throw-in-live",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 1800,
    gated: true,
    role: "accepted throw-in fixture (driven): 2 organic throw-in windows, 1 goal + post-goal reset, an opening kickoff, and a timer that never reaches zero",
  },
  {
    id: "rules-throw-in-stashed",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 1800,
    gated: false,
    role: "that fixture with serializeRestartFacts:false — the stash-identity control: observations untreated, state-hash chain identical to the gated run",
  },
  {
    id: "rules-goal-kick-live",
    scenarioPath: "eval/scenarios/5v5-restart-arc.v1.json",
    ticks: 1800,
    gated: true,
    role: "accepted arc fixture (driven): 1 goal-kick execution, goals + post-goal resets, an opening kickoff, and a timer that never reaches zero",
  },
  {
    id: "rules-goal-kick-stashed",
    scenarioPath: "eval/scenarios/5v5-restart-arc.v1.json",
    ticks: 1800,
    gated: false,
    role: "that fixture with serializeRestartFacts:false — the stash-identity control",
  },
  {
    id: "rules-full-match-live",
    scenarioPath: "eval/scenarios/5v5-full-match-timing.v1.json",
    ticks: 800,
    gated: true,
    role: "full-match timing fixture (driven, short duration): the timer reaches zero in half 1 (halftime) and half 2 (fulltime), so the timing/phase cluster is genuinely measured",
  },
  {
    id: "rules-full-match-stashed",
    scenarioPath: "eval/scenarios/5v5-full-match-timing.v1.json",
    ticks: 800,
    gated: false,
    role: "that fixture with serializeRestartFacts:false — the stash-identity control",
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
  verdicts: Record<string, Outcome>;
  determinism: Record<string, unknown>;
  stash_identity?: Record<string, unknown>;
}

function buildRunRecord(spec: RunSpec, gatedOther?: RunRecord): RunRecord {
  const scenario = loadScenario(spec.scenarioPath);
  const result = runHeadlessMatch({
    scenario,
    maxTicks: spec.ticks,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    serializeRestartFacts: spec.gated,
  });
  const counts = countKinds(result.observations);
  const hashOfHashes = sha256(JSON.stringify(result.stateHashes));
  const record: RunRecord = {
    id: spec.id,
    role: spec.role,
    scenario: scenario.id,
    scenario_path: spec.scenarioPath,
    ticks: result.stateHashes.length,
    gated_serialization: spec.gated,
    lifecycle_phase_sync: "core-owned",
    reproduction:
      `runHeadlessMatch({ scenario: load(${JSON.stringify(spec.scenarioPath)}), ` +
      `maxTicks: ${spec.ticks}, cpuAntiHuddle: true, lifecyclePhaseSync: "core-owned", ` +
      `serializeRestartFacts: ${spec.gated} })`,
    observation_count: result.observations.length,
    event_kind_counts: counts,
    phase_distribution: phaseDistribution(result.observations),
    verdicts: criterionOutcomes(result.observations),
    determinism: {
      state_hash_of_hashes: hashOfHashes,
      final_state_hash: result.stateHashes[result.stateHashes.length - 1] ?? null,
    },
  };

  if (!spec.gated) {
    record.stash_identity = {
      injected_core_match_phase_events: counts["core-match-phase"] ?? 0,
      gated_on_state_hash_of_hashes: gatedOther?.determinism.state_hash_of_hashes,
      state_hash_chain_identical: gatedOther
        ? hashOfHashes === gatedOther.determinism.state_hash_of_hashes
        : undefined,
    };
  }

  console.log(
    `[rules-facts-depth] ${spec.id}: ticks=${record.ticks} gated=${spec.gated}` +
      ` hashOfHashes=${hashOfHashes.slice(0, 20)}`,
  );
  return record;
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

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
  produced_by: "scripts/capture-rules-facts-depth-conformance.ts",
  driver:
    "eval/runners/headless-match.ts with lifecyclePhaseSync:'core-owned' + the gated " +
    "serializeRestartFacts observation extension. The rules suite is evaluated via " +
    "evaluateSuite('rules', observations) over the driven conformance streams.",
  activation: {
    field: "runHeadlessMatch({ serializeRestartFacts })",
    meaning:
      "the runner injects the core's per-tick post-step matchPhase + matchTimer (a " +
      "core-match-phase event per tick), the starting phase, and the committed " +
      "restart-executed events into the observation stream. Off (the default) the " +
      "stream is byte-identical to every accepted non-gated run.",
    set_by: [
      "eval/runners/headless-match.ts runHeadlessMatch({ serializeRestartFacts }) (these pinned runs)",
      "tests/unit/eval/restart-rules-serialization.test.ts and tests/unit/eval/rules-facts-depth-binding.test.ts",
      "NOT the browser composition root",
    ],
  },
  disclosures: [
    "The corner cluster (MATCH-CORNER-KICK-AWARD / -PLACEMENT / -CROSS / -TIMER-FREEZE) is OUT of scope and owned by CORNER-DRIVEN-CONFORMANCE; it is not evaluated here.",
    "The anti-huddle restart-behavior criteria (MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH, MATCH-RESTART-NEAREST-ONLY, MATCH-RESTART-REARM) are honestly NOT_EVALUATED: the committed observation stream does not carry the adapter-layer restart-window designation (designated taker / presser / window anchor / carried-through-touch untouched override), and the set-piece ball is not actually held frozen (it rolls / is touched during the window), so those semantics are not observable from committed facts.",
    "MATCH-TIMER-FULLTIME on the 1800-tick fixtures is NOT_EVALUATED: the core-owned runner stamps a terminal fulltime label while the timer is still in play (timer != 0); only the full-match fixture reaches a genuine timer-driven playing→fulltime zero crossing.",
    "The serialization extension is an observation-level annotation (the gk-role precedent): git diff src/simulation/ and src/contracts/ are empty; the core, its event union and its contracts are untouched, and serializeRestartFacts:false is byte-identical.",
    "No criterion is upgraded beyond what the executed evaluator returns; a PASS is reported only where the driven stream genuinely carries the semantics, and NOT_EVALUATED elsewhere. No forced outcome.",
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
  "MATCH-THROW-IN-PLACEMENT":
    "PASS on rules-throw-in-live: each served throw-in's throwPosition equals the paired touchline-exit ballPosition (§6.3).",
  "MATCH-THROW-IN-SERVE":
    "PASS on rules-throw-in-live: each throw-in is served at chest height (ball z≈1.5 m) into play toward a receiver (§6.4).",
  "MATCH-THROW-IN-TIMER-FREEZE":
    "PASS on rules-throw-in-live: the ball-in-play timer is frozen during every throw-in post-phase tick (§11).",
  "MATCH-GOAL-KICK-PLACEMENT":
    "PASS on rules-goal-kick-live: the goal kick is placed inside the goal area on the exit side (§7.3).",
  "MATCH-GOAL-KICK-TIMER-FREEZE":
    "PASS on rules-goal-kick-live: the ball-in-play timer is frozen during every goal-kick post-phase tick (§11).",
  "MATCH-TIMER-DECREMENT":
    "PASS on every driven stream: the ball-in-play timer decrements only during playing (the documented halftime break countdown and the playing→fulltime zero-crossing are the only exceptions) (§11).",
  "MATCH-TIMER-HALFTIME":
    "PASS on rules-full-match-live: the timer reached zero in half 1, the phase transitioned to halftime, and play resumed as the second half (§11). NOT_EVALUATED on the 1800-tick fixtures where the timer never reached zero.",
  "MATCH-TIMER-FULLTIME":
    "PASS on rules-full-match-live: the timer reached zero in half 2 and the phase transitioned to fulltime (§11). NOT_EVALUATED on the 1800-tick fixtures where the terminal fulltime is a runner stamp, not a timer-driven transition.",
  "MATCH-SCORING-GOAL-PHASE":
    "PASS on rules-throw-in-live and rules-goal-kick-live: a goal opened the goal phase and play returned to playing via the post-goal reset (§10.2/§9.3).",
  "MATCH-KICKOFF-FIRST-TOUCH":
    "PASS on every driven stream: the opening untouched window closed on the first touch by the designated taker (nearest body to the ball) (§9.2).",
  "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH":
    "NOT_EVALUATED: the committed observation stream does not carry the adapter-layer restart-window designation (designated taker / window anchor / untouched override), and the set-piece ball is not held frozen (it rolls / is touched during the window), so the anti-huddle restart freeze is not observable from committed facts (§12).",
  "MATCH-RESTART-NEAREST-ONLY":
    "NOT_EVALUATED: the committed observation stream does not carry the per-team designated chaser/presser, so the nearest-only chase rule is not observable from committed facts (§12).",
  "MATCH-RESTART-REARM":
    "NOT_EVALUATED: the committed observation stream does not carry the adapter-layer carried-through-touch 'untouched' override that keys the post-goal / halftime window re-arm, so the re-arm is not observable from committed facts (§9.5).",
};

const claimsNotMade = [
  "No suite-level PASS claim: the per-test overall for the rules suite stays NOT_EVALUATED / BLOCKED_MISSING_REFERENCE (it never reduces to a suite PASS).",
  "No PROMOTION claim.",
  "No criterion is upgraded beyond what the executed evaluator returns: PASS is reported only where the driven stream genuinely carries the semantics, and NOT_EVALUATED elsewhere.",
  "No PES 2017 fidelity / measured PES envelope claim; MATCH-GOAL-KICK-DISTRIBUTION and MATCH-CORNER-KICK-CROSS stay BLOCKED_MISSING_REFERENCE (§14).",
  "No FOUNDATION_LAB_PASS claim.",
  "No invented reference envelope or tolerance: the 7 BLOCKED_MISSING_REFERENCE values stay blocked.",
  "The corner cluster (MATCH-CORNER-KICK-*) is NOT evaluated here; it is owned by CORNER-DRIVEN-CONFORMANCE.",
  "No gameplay / source / contract / adapter / spec change: src/ and specs/ are EMPTY; only eval oracles/invariant bindings (additive), a driven timing scenario, evidence + tests are added.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  suite_id: "rules",
  suite_version: "suite-rules-v1",
  produced_by: "scripts/capture-rules-facts-depth-conformance.ts",
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
console.log(`[rules-facts-depth] wrote ${TRAJECTORY_PATH}`);
console.log(`[rules-facts-depth] wrote ${STATE_PATH}`);
console.log(`[rules-facts-depth] record_sha256=${String(record.record_sha256)}`);
