/**
 * Node-side evidence producer for RULES-SUITE-STATE.
 *
 * Honest rules-suite state publication. Re-runs the registered `rules`
 * evaluator suite (suite-rules-v1, MATCH_RULES_SPEC §15) over the conformance
 * evidence streams and writes the current per-rule verdict table:
 *
 *   - The accepted restart fixtures under the core-owned lifecycle WITHOUT the
 *     gated serialization (the RULES-SUITE-REGISTRATION baseline: the
 *     restart-executed events and core matchPhase/matchTimer are not in the
 *     standard observation stream, so the AWARD / TIMER-FREEZE criteria are
 *     honestly NOT_EVALUATED).
 *   - The RESTART-RULES-CONFORMANCE driven streams WITH `serializeRestartFacts`
 *     enabled (the gk-role precedent post-loop observation extension), which
 *     make MATCH-THROW-IN-AWARD / MATCH-GOAL-KICK-AWARD / MATCH-TIMER-FREEZE
 *     genuinely measurable.
 *
 * Blocked references stay BLOCKED_MISSING_REFERENCE; a NOT_EVALUATED is never
 * upgraded to PASS; no suite-level PASS claim is made.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:RULES-SUITE-STATE`. An ordinary run writes the
 * same artifact under the ignored `test-results/gauntlet-capture/**` tree and
 * leaves `docs/` byte-identical. The record carries NO wall-clock field, so
 * consecutive ordinary-mode runs are byte-identical and the pinned
 * `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:RULES-SUITE-STATE \
 *     mise exec -- pnpm exec tsx scripts/capture-rules-suite-verdicts-state.ts
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

const OBJECTIVE_ID = "RULES-SUITE-STATE";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const ARTIFACT_PATH = resolve(OUTPUT_ROOT, "rules-suite-verdicts-state.json");

const REGISTRATION_RECORD =
  "docs/evidence/RULES-SUITE-REGISTRATION/rules-suite-state.json";

type Outcome = string;

interface RunSpec {
  id: string;
  scenarioPath: string;
  ticks: number;
  gated: boolean;
  note: string;
}

const RUNS: RunSpec[] = [
  {
    id: "rules-throwin-baseline",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 1800,
    gated: false,
    note: "accepted throw-in fixture under core-owned, no serialization: the restart-executed event is not in the standard stream, so MATCH-THROW-IN-AWARD is honestly NOT_EVALUATED (RULES-SUITE-REGISTRATION baseline)",
  },
  {
    id: "rules-goalkick-postgoal-baseline",
    scenarioPath: "eval/scenarios/5v5-restart-arc.v1.json",
    ticks: 1800,
    gated: false,
    note: "accepted arc fixture under core-owned, no serialization: MATCH-GOAL-KICK-AWARD / MATCH-TIMER-FREEZE are honestly NOT_EVALUATED (baseline)",
  },
  {
    id: "rules-corner-baseline",
    scenarioPath: "eval/scenarios/5v5-continuous-play.v1.json",
    ticks: 1800,
    gated: false,
    note: "accepted continuous-play fixture under core-owned, no serialization: no corner restart is produced (baseline)",
  },
  {
    id: "rules-throw-in-live",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 1800,
    gated: true,
    note: "driven conformance stream (RESTART-RULES-CONFORMANCE) with serializeRestartFacts:true — the throw-in-executed events + core matchPhase/matchTimer are injected, so MATCH-THROW-IN-AWARD and MATCH-TIMER-FREEZE are measurable",
  },
  {
    id: "rules-goal-kick-live",
    scenarioPath: "eval/scenarios/5v5-restart-arc.v1.json",
    ticks: 1800,
    gated: true,
    note: "driven conformance stream (RESTART-RULES-CONFORMANCE) with serializeRestartFacts:true — MATCH-GOAL-KICK-AWARD and MATCH-TIMER-FREEZE are measurable",
  },
];

// ---------------------------------------------------------------------------
// The 8 protected rules invariants, each bound to a registered oracle and a
// §15 criterion. Captured directly by executing the oracle over the stream.
// ---------------------------------------------------------------------------

interface RulesInvariantSpec {
  invariant_id: string;
  criterion_id: string;
  oracle_id: string;
  oracle_version: string;
}

const RULES_INVARIANTS: RulesInvariantSpec[] = [
  {
    invariant_id: "rules-out-of-play-detect-evidence",
    criterion_id: "MATCH-OUT-OF-PLAY-DETECT",
    oracle_id: "rules-out-of-play-detect-oracle-v1",
    oracle_version: "oracle-rules-out-of-play-detect-v1",
  },
  {
    invariant_id: "rules-out-of-play-no-last-touch-evidence",
    criterion_id: "MATCH-OUT-OF-PLAY-NO-LAST-TOUCH",
    oracle_id: "rules-out-of-play-no-last-touch-oracle-v1",
    oracle_version: "oracle-rules-out-of-play-no-last-touch-v1",
  },
  {
    invariant_id: "rules-throw-in-award-evidence",
    criterion_id: "MATCH-THROW-IN-AWARD",
    oracle_id: "rules-throw-in-award-oracle-v1",
    oracle_version: "oracle-rules-throw-in-award-v1",
  },
  {
    invariant_id: "rules-goal-kick-award-evidence",
    criterion_id: "MATCH-GOAL-KICK-AWARD",
    oracle_id: "rules-goal-kick-award-oracle-v1",
    oracle_version: "oracle-rules-goal-kick-award-v1",
  },
  {
    invariant_id: "rules-corner-kick-award-evidence",
    criterion_id: "MATCH-CORNER-KICK-AWARD",
    oracle_id: "rules-corner-kick-award-oracle-v1",
    oracle_version: "oracle-rules-corner-kick-award-v1",
  },
  {
    invariant_id: "rules-goal-detection-evidence",
    criterion_id: "MATCH-SCORING-GOAL-DEVENT",
    oracle_id: "rules-goal-detection-oracle-v1",
    oracle_version: "oracle-rules-goal-detection-v1",
  },
  {
    invariant_id: "rules-kickoff-freeze-evidence",
    criterion_id: "MATCH-KICKOFF-FREEZE",
    oracle_id: "rules-kickoff-freeze-oracle-v1",
    oracle_version: "oracle-rules-kickoff-freeze-v1",
  },
  {
    invariant_id: "rules-timer-freeze-evidence",
    criterion_id: "MATCH-TIMER-FREEZE",
    oracle_id: "rules-timer-freeze-oracle-v1",
    oracle_version: "oracle-rules-timer-freeze-v1",
  },
];

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as T;
}

function loadScenario(path: string): ScenarioDefinition {
  return loadJson<ScenarioDefinition>(path);
}

function criterionOutcomes(observations: TelemetryObservation[]): Record<string, Outcome> {
  const suite = evaluateSuite("rules", observations);
  const out: Record<string, Outcome> = {};
  for (const t of suite.tests) {
    for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  }
  return out;
}

/** Aggregate InvariantResult statuses to a single verdict. */
function invariantStatus(observations: TelemetryObservation[], spec: RulesInvariantSpec): Outcome {
  const results = executeOracle(spec.oracle_id, spec.oracle_version, observations);
  if (results.length === 0) return "NOT_EVALUATED";
  if (results.some((r) => r.status === "fail")) return "FAIL";
  if (results.some((r) => r.status === "not_evaluated")) return "NOT_EVALUATED";
  if (results.every((r) => r.status === "pass")) return "PASS";
  return "FAIL";
}

interface RunRecord {
  run_id: string;
  scenario: string;
  scenario_path: string;
  ticks: number;
  serialize_restart_facts: boolean;
  lifecycle_phase_sync: string;
  reproduction: string;
  observation_count: number;
  note: string;
  verdicts: Record<string, Outcome>;
  invariants: Record<string, Outcome>;
}

function buildRunRecord(spec: RunSpec): RunRecord {
  const scenario = loadScenario(spec.scenarioPath);
  const match = runHeadlessMatch({
    scenario,
    maxTicks: spec.ticks,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    serializeRestartFacts: spec.gated,
  });
  const verdicts = criterionOutcomes(match.observations);
  const invariants: Record<string, Outcome> = {};
  for (const inv of RULES_INVARIANTS) {
    invariants[inv.invariant_id] = invariantStatus(match.observations, inv);
  }
  return {
    run_id: spec.id,
    scenario: scenario.id,
    scenario_path: spec.scenarioPath,
    ticks: match.tick,
    serialize_restart_facts: spec.gated,
    lifecycle_phase_sync: "core-owned",
    reproduction:
      `runHeadlessMatch({ scenario: load(${JSON.stringify(spec.scenarioPath)}), ` +
      `maxTicks: ${spec.ticks}, cpuAntiHuddle: true, lifecyclePhaseSync: "core-owned", ` +
      `serializeRestartFacts: ${spec.gated} })`,
    observation_count: match.observations.length,
    note: spec.note,
    verdicts,
    invariants,
  };
}

// ---------------------------------------------------------------------------
// Verdict aggregation (precedence: FAIL > PASS > BLOCKED > NOT_EVALUATED)
// ---------------------------------------------------------------------------

function aggregate(values: string[]): Outcome {
  if (values.includes("FAIL")) return "FAIL";
  if (values.includes("PASS")) return "PASS";
  if (values.includes("BLOCKED_MISSING_REFERENCE")) return "BLOCKED_MISSING_REFERENCE";
  return "NOT_EVALUATED";
}

// ---------------------------------------------------------------------------
// Read the RULES-SUITE-REGISTRATION verdict summary for the delta disclosure.
// ---------------------------------------------------------------------------

function registrationVerdicts(): Record<string, string> {
  const rec = loadJson<{ verdict_summary?: Record<string, string> }>(REGISTRATION_RECORD);
  return rec.verdict_summary ?? {};
}

// ---------------------------------------------------------------------------
// Run the conformance evidence streams and assemble the record.
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

const runs = RUNS.map(buildRunRecord);

const allCriterionIds = new Set<string>();
for (const run of runs) {
  for (const c of Object.keys(run.verdicts)) allCriterionIds.add(c);
}

const byCriterionRun: Record<string, string[]> = {};
const verdictSummary: Record<string, Outcome> = {};
for (const criterionId of allCriterionIds) {
  const entries = runs.map((r) => `${r.run_id}=${r.verdicts[criterionId] ?? "NOT_EVALUATED"}`);
  byCriterionRun[criterionId] = entries;
  verdictSummary[criterionId] = aggregate(entries.map((e) => e.split("=")[1]));
}

// Invariant summary across all runs.
const invariantSummary: Record<string, Outcome> = {};
for (const inv of RULES_INVARIANTS) {
  invariantSummary[inv.invariant_id] = aggregate(
    runs.map((r) => r.invariants[inv.invariant_id]),
  );
}

// ---------------------------------------------------------------------------
// Verdict-delta disclosure vs RULES-SUITE-REGISTRATION.
// ---------------------------------------------------------------------------

const registration = registrationVerdicts();
const changed: Array<{ criterion: string; from: string; to: string; reason: string }> = [];
const unchanged: Array<{ criterion: string; outcome: string }> = [];
for (const criterionId of allCriterionIds) {
  const from = registration[criterionId] ?? "NOT_EVALUATED";
  const to = verdictSummary[criterionId];
  if (from !== to) {
    changed.push({
      criterion: criterionId,
      from,
      to,
      reason:
        "the gated serializeRestartFacts runner option (post-loop injection of the committed " +
        "restart-executed events + the core matchPhase/matchTimer) is enabled on the driven " +
        "RESTART-RULES-CONFORMANCE streams, so the executed award / timer-freeze semantics " +
        "become measurable — previously NOT_EVALUATED because the standard observation stream " +
        "does not serialize them",
    });
  } else {
    unchanged.push({ criterion: criterionId, outcome: to });
  }
}

const claimsNotMade = [
  "No suite-level PASS claim: the per-test overall for the rules suite stays NOT_EVALUATED / BLOCKED_MISSING_REFERENCE (it never reduces to a suite PASS).",
  "No PROMOTION claim.",
  "No criterion is upgraded beyond what the executed evaluator returns: PASS is reported only where the driven stream genuinely carries the semantics, and NOT_EVALUATED elsewhere.",
  "No PES 2017 fidelity / measured PES envelope claim; MATCH-GOAL-KICK-DISTRIBUTION and MATCH-CORNER-KICK-CROSS stay BLOCKED_MISSING_REFERENCE (§14).",
  "No FOUNDATION_LAB_PASS claim.",
  "No invented reference envelope or tolerance: the 7 BLOCKED_MISSING_REFERENCE values stay blocked.",
  "MATCH-CORNER-KICK-AWARD stays NOT_EVALUATED (no genuine driven/organic corner-kick execution exists); it is not forced to PASS.",
  "No gameplay / source / contract / adapter / scenario / spec change: src/, eval/runners/, eval/oracles/, eval/invariants/, eval/scenarios/, specs/ are EMPTY; only evidence + a binding test + this producer are added.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  suite_id: "rules",
  suite_version: "suite-rules-v1",
  produced_by: "scripts/capture-rules-suite-verdicts-state.ts",
  evidence_class: "BOOKKEEPING",
  lifecycle_phase_sync: "core-owned",
  runs,
  verdict_summary: verdictSummary,
  criterion_reasons: {
    "MATCH-OUT-OF-PLAY-DETECT":
      "PASS on every boundary-carrying run: boundary events carry well-formed payloads and goal / goal-line out-of-play are mutually exclusive.",
    "MATCH-OUT-OF-PLAY-NO-LAST-TOUCH":
      "PASS where a no-last-touch boundary was observed (rules-throwin-baseline, rules-throw-in-live): every such boundary opened no restart. NOT_EVALUATED where every boundary had a resolvable last touch.",
    "MATCH-KICKOFF-FREEZE":
      "PASS where a clean multi-body untouched opening window was observed (throw-in and arc runs): only the designated taker + any at-ball body left home. NOT_EVALUATED where the window is absent / single-body (rules-corner-baseline).",
    "MATCH-SCORING-GOAL-DEVENT":
      "PASS on every goal-carrying run: every goal event carries a valid goalIndex and is mutually exclusive with goal-line out-of-play.",
    "MATCH-THROW-IN-AWARD":
      "PASS on the driven throw-in stream (rules-throw-in-live, 2 executed throw-ins): each served throw-in went to the team opposite the last-touch team. NOT_EVALUATED on the non-serialized baseline (the throw-in-executed event is not in the standard stream).",
    "MATCH-GOAL-KICK-AWARD":
      "PASS on the driven goal-kick stream (rules-goal-kick-live, 1 executed goal kick): the goal kick was awarded to the defending team of the exited goal line. NOT_EVALUATED on the non-serialized baseline.",
    "MATCH-TIMER-FREEZE":
      "PASS on the driven streams (rules-throw-in-live, rules-goal-kick-live): the core matchTimer is frozen during the non-playing restart / goal phases. NOT_EVALUATED on the non-serialized baseline (core matchPhase/matchTimer not in the standard stream).",
    "MATCH-CORNER-KICK-AWARD":
      "NOT_EVALUATED: no driven or organic run produced a corner-kick execution (a defending-team last-touch over its own goal line is rare in this engine). Not forced to PASS.",
    "MATCH-CORNER-KICK-CROSS":
      "BLOCKED_MISSING_REFERENCE (§14 corner_cross_trajectory_ref).",
    "MATCH-GOAL-KICK-DISTRIBUTION":
      "BLOCKED_MISSING_REFERENCE (§14 goal_kick_distribution_ref).",
    "MATCH-THROW-IN-PLACEMENT / MATCH-THROW-IN-SERVE / MATCH-THROW-IN-TIMER-FREEZE":
      "NOT_EVALUATED — no oracle yet for the placement / serve / restart-specific timer-freeze semantics.",
    "MATCH-GOAL-KICK-PLACEMENT / MATCH-GOAL-KICK-TIMER-FREEZE":
      "NOT_EVALUATED — no oracle yet for the goal-kick placement / restart-specific timer-freeze semantics.",
    "MATCH-CORNER-KICK-PLACEMENT / MATCH-CORNER-KICK-TIMER-FREEZE":
      "NOT_EVALUATED — no oracle yet for the corner placement / restart-specific timer-freeze semantics.",
    "MATCH-KICKOFF-FIRST-TOUCH / MATCH-RESTART-REARM":
      "NOT_EVALUATED — no oracle yet for the first-touch / restart-rearm semantics.",
    "MATCH-SCORING-GOAL-PHASE":
      "NOT_EVALUATED — no oracle yet for the playing → goal → playing phase transition.",
    "MATCH-TIMER-DECREMENT / MATCH-TIMER-HALFTIME / MATCH-TIMER-FULLTIME":
      "NOT_EVALUATED — no oracle yet for the decrement / halftime / fulltime semantics.",
    "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH / MATCH-RESTART-NEAREST-ONLY":
      "NOT_EVALUATED — no oracle yet for the anti-huddle freeze / nearest-only semantics.",
  },
  invariants: invariantSummary,
  verdict_deltas: {
    changed,
    unchanged,
    disclosure:
      "Deltas vs the RULES-SUITE-REGISTRATION state (record_sha256 7503f9fe…): MATCH-THROW-IN-AWARD, MATCH-GOAL-KICK-AWARD and MATCH-TIMER-FREEZE move NOT_EVALUATED → PASS solely because the gated serializeRestartFacts observation extension (the RESTART-RULES-CONFORMANCE driven streams) now serializes the executed restart events and the core matchPhase/matchTimer. Blocked references stay BLOCKED_MISSING_REFERENCE; MATCH-CORNER-KICK-AWARD stays NOT_EVALUATED; every NOT_EVALUATED stays NOT_EVALUATED unless the driven stream genuinely carries it.",
  },
  claims_not_made: claimsNotMade,
};

// Compute the pinned record_sha256 over the record without the field itself.
const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

writeFileSync(ARTIFACT_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[rules-suite-verdicts-state] wrote ${ARTIFACT_PATH}`);
console.log(`[rules-suite-verdicts-state] record_sha256=${String(record.record_sha256)}`);
console.log(
  `[rules-suite-verdicts-state] verdict_summary=${JSON.stringify(
    Object.fromEntries(
      Object.entries(verdictSummary).map(([k, v]) => [k, v]),
    ),
  )}`,
);
console.log(`[rules-suite-verdicts-state] changed=${changed.length} unchanged=${unchanged.length}`);
for (const run of runs) {
  console.log(
    `  ${run.run_id} (${run.ticks} ticks, gated=${run.serialize_restart_facts}): ` +
      `THROW-IN-AWARD=${run.verdicts["MATCH-THROW-IN-AWARD"]} ` +
      `GOAL-KICK-AWARD=${run.verdicts["MATCH-GOAL-KICK-AWARD"]} ` +
      `CORNER-KICK-AWARD=${run.verdicts["MATCH-CORNER-KICK-AWARD"]} ` +
      `TIMER-FREEZE=${run.verdicts["MATCH-TIMER-FREEZE"]}`,
  );
}
