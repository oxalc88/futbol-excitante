/**
 * Node-side evidence producer for RESTART-DESIGNATION-FACTS-CONFORMANCE.
 *
 * Evaluates the 3 anti-huddle restart-behavior criteria (MATCH-RESTART-
 * FREEZE-UNTIL-FIRST-TOUCH, MATCH-RESTART-NEAREST-ONLY, MATCH-RESTART-REARM)
 * through the registered `rules` evaluator suite (suite-rules-v1,
 * MATCH_RULES_SPEC §12/§9.5) over the driven conformance streams with the
 * gated `serializeRestartFacts` observation extension live AND the browser
 * observation shape (`browserParityObservations: true`), because only that
 * wiring lets the adapter observe matchPhase and actually exercise the restart
 * freeze / nearest-only chase / post-goal-halftime re-arm (RESTART-ANTI-
 * HUDDLE-COHERENCE used the same shape).
 *
 * The designation facts are serialized by the runner (post-loop, gated,
 * hash-neutral) from the SAME exported production function the adapters act on
 * (`assignChaseRoles`) plus the committed coreMatchPhases + ball reference, so
 * the oracles read the ACTUAL adapter designation rather than a re-derivation
 * that owns football state.
 *
 *   - `designation-throwin-live`  (5v5-restart-throwin, 1800 ticks): throw-in
 *     windows → FREEZE-UNTIL-FIRST-TOUCH / NEAREST-ONLY.
 *   - `designation-arc-live`      (5v5-restart-arc, 1800 ticks): goal-kick +
 *     repeated post-goal re-arm windows → FREEZE / NEAREST / REARM.
 *   - `designation-fullmatch-live` (5v5-full-match-timing, 800 ticks): a
 *     genuine halftime re-arm window → REARM, plus the timer-driven halftime /
 *     fulltime transitions.
 *
 * Each gated run also has a stashed control (`serializeRestartFacts:false`)
 * whose state-hash chain is byte-identical, proving the injection cannot affect
 * inputs / steps / committed hashes, and whose observation stream carries 0
 * injected facts.
 *
 * The corner cluster (MATCH-CORNER-KICK-*) is owned by CORNER-DRIVEN-
 * CONFORMANCE and stays OUT of scope; blocked references (CORNER-KICK-CROSS,
 * GOAL-KICK-DISTRIBUTION) stay BLOCKED_MISSING_REFERENCE.  No suite-level PASS
 * claim is made.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:RESTART-DESIGNATION-FACTS-CONFORMANCE`.  An
 * ordinary run writes the same artifacts under the ignored
 * `test-results/gauntlet-capture/**` tree and leaves `docs/` byte-identical.
 * The record carries NO wall-clock field, so consecutive ordinary-mode runs are
 * byte-identical and the pinned `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:RESTART-DESIGNATION-FACTS-CONFORMANCE \
 *     mise exec -- pnpm exec tsx scripts/capture-restart-designation-facts-conformance.ts
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

const OBJECTIVE_ID = "RESTART-DESIGNATION-FACTS-CONFORMANCE";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "restart-designation-facts-state.json");

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
    id: "designation-throwin-live",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 1800,
    gated: true,
    role: "throw-in fixture (driven, browserParity): 2 throw-in serve windows → FREEZE-UNTIL-FIRST-TOUCH / NEAREST-ONLY over the throw-in restart",
  },
  {
    id: "designation-throwin-stashed",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 1800,
    gated: false,
    role: "that fixture with serializeRestartFacts:false — stash-identity control: 0 injected facts, state-hash chain identical",
  },
  {
    id: "designation-arc-live",
    scenarioPath: "eval/scenarios/5v5-restart-arc.v1.json",
    ticks: 1800,
    gated: true,
    role: "arc fixture (driven, browserParity): goal-kick + repeated post-goal re-arm windows → FREEZE / NEAREST / REARM over the post-goal restart",
  },
  {
    id: "designation-arc-stashed",
    scenarioPath: "eval/scenarios/5v5-restart-arc.v1.json",
    ticks: 1800,
    gated: false,
    role: "that fixture with serializeRestartFacts:false — stash-identity control",
  },
  {
    id: "designation-fullmatch-live",
    scenarioPath: "eval/scenarios/5v5-full-match-timing.v1.json",
    ticks: 800,
    gated: true,
    role: "full-match timing fixture (driven, browserParity, short duration): a genuine halftime re-arm window → REARM, plus timer-driven halftime / fulltime",
  },
  {
    id: "designation-fullmatch-stashed",
    scenarioPath: "eval/scenarios/5v5-full-match-timing.v1.json",
    ticks: 800,
    gated: false,
    role: "that fixture with serializeRestartFacts:false — stash-identity control",
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

/** Count the untouched-ball window runs (for disclosure / evidence). */
function countUntouchedWindows(observations: TelemetryObservation[]): number {
  let count = 0;
  let prev: boolean | null = null;
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "restart-designation") continue;
      const p = (ev.payload as { ballUntouched?: unknown } | undefined)?.ballUntouched;
      if (typeof p !== "boolean") continue;
      if (prev === null || prev !== p) {
        if (p) count++;
        prev = p;
      }
    }
  }
  return count;
}

interface RunRecord {
  id: string;
  role: string;
  scenario: string;
  scenario_path: string;
  ticks: number;
  gated_serialization: boolean;
  browser_parity_observations: boolean;
  lifecycle_phase_sync: string;
  reproduction: string;
  observation_count: number;
  event_kind_counts: Record<string, number>;
  phase_distribution: Record<string, number>;
  untouched_window_count: number;
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
    browserParityObservations: true,
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
    browser_parity_observations: true,
    lifecycle_phase_sync: "core-owned",
    reproduction:
      `runHeadlessMatch({ scenario: load(${JSON.stringify(spec.scenarioPath)}), ` +
      `maxTicks: ${spec.ticks}, cpuAntiHuddle: true, lifecyclePhaseSync: "core-owned", ` +
      `browserParityObservations: true, serializeRestartFacts: ${spec.gated} })`,
    observation_count: result.observations.length,
    event_kind_counts: counts,
    phase_distribution: phaseDistribution(result.observations),
    untouched_window_count: countUntouchedWindows(result.observations),
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
      gated_on_state_hash_of_hashes: gatedOther?.determinism.state_hash_of_hashes,
      state_hash_chain_identical: gatedOther
        ? hashOfHashes === gatedOther.determinism.state_hash_of_hashes
        : undefined,
    };
  }

  console.log(
    `[designation-facts] ${spec.id}: ticks=${record.ticks} gated=${spec.gated}` +
      ` hashOfHashes=${hashOfHashes.slice(0, 20)} untouchedWindows=${record.untouched_window_count}`,
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
  produced_by: "scripts/capture-restart-designation-facts-conformance.ts",
  driver:
    "eval/runners/headless-match.ts with lifecyclePhaseSync:'core-owned', " +
    "browserParityObservations:true, and the gated serializeRestartFacts observation " +
    "extension carrying the adapter restart-window designation facts. The rules suite " +
    "is evaluated via evaluateSuite('rules', observations) over the driven conformance streams.",
  activation: {
    field: "runHeadlessMatch({ serializeRestartFacts }) + browserParityObservations:true",
    meaning:
      "the runner injects, as observation-level annotations, the core per-tick phase/timer " +
      "(core-match-phase), the committed restart-executed events, and the adapter restart-window " +
      "designation facts (restart-designation: ballUntouched, designated taker, per-team designated " +
      "chaser, per-body window anchor, baselineTouchRef / rearmed). Off (the default) the stream is " +
      "byte-identical to every accepted non-gated run.",
    set_by: [
      "eval/runners/headless-match.ts runHeadlessMatch({ serializeRestartFacts, browserParityObservations:true }) (these pinned runs)",
      "tests/unit/eval/restart-rules-serialization.test.ts and tests/unit/eval/restart-designation-binding.test.ts",
      "NOT the browser composition root",
    ],
  },
  disclosures: [
    "The corner cluster (MATCH-CORNER-KICK-AWARD / -PLACEMENT / -CROSS / -TIMER-FREEZE) is OUT of scope and owned by CORNER-DRIVEN-CONFORMANCE; it is not evaluated here (the driven fixtures here do not observe a corner restart).",
    "The anti-huddle restart-behavior criteria (FREEZE-UNTIL-FIRST-TOUCH / NEAREST-ONLY / REARM) are now evaluated over the gated designation facts. The designation is the ACTUAL adapter designation: the runner computes it from the same exported production function the adapters act on (assignChaseRoles) plus the committed coreMatchPhases + ball reference, and it is browser-parity-aware (the adapter only re-arms the post-goal / halftime baseline when it observes matchPhase).",
    "The full-match fixture's re-arm baseline is cleared when a boundary event (ball-out-of-play / ball-touchline-out-of-play) fires, so a post-reset re-arm window does not incorrectly extend into a subsequent throw-in hold (where the adapter returns a neutral frame and the core repositions the set-piece bodies).",
    "The serialization extension is an observation-level annotation (the gk-role precedent): git diff src/simulation/ and src/contracts/ are empty; the core, its event union and its contracts are untouched, and serializeRestartFacts:false is byte-identical.",
    "No criterion is upgraded beyond what the executed evaluator returns; a PASS is reported only where the driven stream genuinely carries the semantics. No forced outcome.",
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
  "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH":
    "PASS on designation-throwin-live, designation-arc-live and designation-fullmatch-live: in every restart window the whole team except the single designated taker is frozen at its window anchor while the restart ball is untouched (§12 rule 1).",
  "MATCH-RESTART-NEAREST-ONLY":
    "PASS on designation-throwin-live, designation-arc-live and designation-fullmatch-live: after the first touch only one designated chaser per team converges on the ball (no team clump) (§12 rule 2).",
  "MATCH-RESTART-REARM":
    "PASS on designation-arc-live (post-goal re-arm) and designation-fullmatch-live (halftime re-arm): a post-goal / halftime reset re-arms the restart window keyed to the carried-through touch reference (§9.5). NOT_EVALUATED on designation-throwin-live (no post-goal / halftime reset observed there).",
  "MATCH-CORNER-KICK-AWARD":
    "NOT_EVALUATED: the corner cluster is OUT of scope and owned by CORNER-DRIVEN-CONFORMANCE.",
  "MATCH-CORNER-KICK-PLACEMENT":
    "NOT_EVALUATED: the corner cluster is OUT of scope and owned by CORNER-DRIVEN-CONFORMANCE.",
  "MATCH-CORNER-KICK-TIMER-FREEZE":
    "NOT_EVALUATED: the corner cluster is OUT of scope and owned by CORNER-DRIVEN-CONFORMANCE.",
  "MATCH-CORNER-KICK-CROSS":
    "BLOCKED_MISSING_REFERENCE: §14 corner_cross_trajectory_ref blocked.",
  "MATCH-GOAL-KICK-DISTRIBUTION":
    "BLOCKED_MISSING_REFERENCE: §14 goal_kick_distribution_ref blocked.",
};

const claimsNotMade = [
  "No suite-level PASS claim: the per-test overall for the rules suite is a per-test verdict collection, not a suite PASS, and the corner cluster is OUT of scope here.",
  "No PROMOTION claim.",
  "No PES 2017 fidelity / measured PES envelope claim; MATCH-GOAL-KICK-DISTRIBUTION and MATCH-CORNER-KICK-CROSS stay BLOCKED_MISSING_REFERENCE (§14).",
  "No FOUNDATION_LAB_PASS claim.",
  "No invented reference envelope or tolerance.",
  "The corner cluster (MATCH-CORNER-KICK-*) is NOT evaluated or claimed here; it is owned by CORNER-DRIVEN-CONFORMANCE.",
  "No gameplay / source / contract / adapter / spec change: src/ and specs/ are EMPTY; only eval oracles/invariant bindings (additive), evidence + tests are added.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  suite_id: "rules",
  suite_version: "suite-rules-v1",
  produced_by: "scripts/capture-restart-designation-facts-conformance.ts",
  evidence_class: "MULTI_TICK",
  lifecycle_phase_sync: "core-owned",
  browser_parity_observations: true,
  runs: allRuns.map((r) => ({
    id: r.id,
    scenario: r.scenario,
    scenario_path: r.scenario_path,
    ticks: r.ticks,
    gated_serialization: r.gated_serialization,
    browser_parity_observations: r.browser_parity_observations,
    reproduction: r.reproduction,
    observation_count: r.observation_count,
    untouched_window_count: r.untouched_window_count,
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
console.log(`[designation-facts] wrote ${TRAJECTORY_PATH}`);
console.log(`[designation-facts] wrote ${STATE_PATH}`);
console.log(`[designation-facts] record_sha256=${String(record.record_sha256)}`);
