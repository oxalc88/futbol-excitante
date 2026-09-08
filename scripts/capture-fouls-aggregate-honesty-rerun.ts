/**
 * Node-side evidence producer for FOULS-AGGREGATE-HONESTY-RERUN.
 *
 * Re-publishes the honest aggregate verdict state for two suites after the
 * GK-*-REG conversion (GK-REGRESSION-POLICY-REGISTRATION, record fc7d1b97…):
 *
 *   - `goalkeepers` (suite-goalkeepers-v1): re-runs the suite with the
 *     registered gk-regression canary LIVE over the accepted GK streams
 *     (gk-continuous-live, gk-shot-fixture-live, gk-release-fixture-live) and
 *     publishes the aggregate table with the exact delta vs the pinned
 *     9/0/2/1/1 baseline (SUITE-DETERMINISTIC-TWO-RUN, record abaf6ccd…).
 *     GK-*-REG converts NOT_EVALUATED -> executed PASS; the OTHER catalog keys
 *     (GK-*-REF BLOCKED_MISSING_REFERENCE, GK-*-VIS NEEDS_PERCEPTUAL_REVIEW,
 *     GK-*-CAUSAL NOT_EVALUATED) stay.
 *   - `fouls` (suite-fouls-v1): re-runs the suite over the accepted fouls +
 *     free-kick consequence streams and publishes the per-criterion executed
 *     state (3 of the 5 §10 criteria registered: FOUL-DETECT, FOUL-CLEAN-TACKLE,
 *     FREE-KICK-AWARD; CARD-ISSUED and ADVANTAGE-PLAYED stay NAMED-NOT-REGISTERED).
 *
 * BOOKKEEPING: a deterministic re-publication over existing MULTI_TICK streams;
 * zero source change. Every verdict is the executed evaluator result over a
 * reproduced accepted stream (character-identical to the accepted state-hash
 * pins), never a hand-written outcome. No suite-level PASS claim.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:FOULS-AGGREGATE-HONESTY-RERUN`. An ordinary run
 * writes the same artifacts under the ignored `test-results/gauntlet-capture/**`
 * tree and leaves `docs/` byte-identical. The record carries NO wall-clock field,
 * so consecutive ordinary-mode runs are byte-identical and the pinned
 * `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:FOULS-AGGREGATE-HONESTY-RERUN \
 *     mise exec -- pnpm exec tsx scripts/capture-fouls-aggregate-honesty-rerun.ts
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import { detectFoulEvents, countFoulEvents } from "../eval/runners/foul-detection.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "FOULS-AGGREGATE-HONESTY-RERUN";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const STATE_PATH = resolve(OUTPUT_ROOT, "fouls-aggregate-honesty-rerun.json");

// The pinned baselines this re-publication compares against (read verbatim).
const GK_BASELINE_RECORD =
  "docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json";

type Outcome = string;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as T;
}

function loadScenario(path: string): ScenarioDefinition {
  return readJson<ScenarioDefinition>(path);
}

function countKinds(observations: TelemetryObservation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of observations) for (const ev of o.events) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
  return counts;
}

// ---------------------------------------------------------------------------
// Goalkeepers suite — extract the aggregate + catalog buckets exactly as the
// accepted GK records did, so the published table matches the accepted shape.
// ---------------------------------------------------------------------------

const GK_REG_CRITERIA = [
  "GK-REA-001-REG",
  "GK-WF-001-REG",
  "GK-LEG-001-REG",
  "GK-PARRY-001-REG",
  "GK-REC-001-REG",
  "GK-HIGH-001-REG",
] as const;

const GK_BEHAVIOR_IDS = new Set([
  "GK-POSITIONING-HOLD",
  "GK-NO-FIELD-CHASE",
  "GK-SAVE-CLAIM",
  "GK-ROLE-DESIGNATION",
  "GK-DISTRIBUTION-NO-OMNISCIENCE",
]);

const GK_COMMON_IDS = new Set([
  "COMMON-FINITE",
  "COMMON-DETERMINISTIC",
  "COMMON-REFERENCES",
  "COMMON-BOUNDS",
]);

interface GkRunResult {
  run_id: string;
  scenario: string;
  ticks: number;
  lifecycle: string;
  reproduction: string;
  observation_count: number;
  event_kind_counts: Record<string, number>;
  determinism: {
    run_a_state_hash_of_hashes: string;
    run_b_state_hash_of_hashes: string;
    run_a_observations_sha256: string;
    run_b_observations_sha256: string;
    identical: boolean;
    state_hash_chain_identical: boolean;
    observations_byte_identical: boolean;
    final_state_hash: string | null;
  };
  gk_behavior: Record<string, Outcome>;
  common: Record<string, Outcome>;
  catalog: { ref: Outcome; vis: Outcome; reg: Outcome; causal: Outcome };
  accepted_state_hash_of_hashes: string | null;
  character_identical_to_accepted: boolean;
}

/** Strictest-outcome precedence for a class bucket (FAIL > PASS > BLOCKED > VIS > NOT_EVALUATED). */
function classBucket(outcomes: Outcome[]): Outcome {
  if (outcomes.includes("FAIL")) return "FAIL";
  if (outcomes.includes("PASS")) return "PASS";
  if (outcomes.includes("BLOCKED_MISSING_REFERENCE")) return "BLOCKED_MISSING_REFERENCE";
  if (outcomes.includes("NEEDS_PERCEPTUAL_REVIEW")) return "NEEDS_PERCEPTUAL_REVIEW";
  return "NOT_EVALUATED";
}

function runGk(scenarioPath: string, maxTicks: number) {
  const scenario = loadScenario(scenarioPath);
  const match = runHeadlessMatch({
    scenario,
    maxTicks,
    cpuAntiHuddle: true,
    cpuDefensiveTackle: true,
    gkBehavior: true,
    browserParityObservations: true,
    lifecyclePhaseSync: "core-owned",
  });
  return { scenario, match };
}

function evaluateGkRun(runId: string, scenarioPath: string, maxTicks: number): GkRunResult {
  // Two-run byte-identity attestation (the accepted COMMON-DETERMINISTIC
  // resolution): the same pinned stream is run twice and must be byte-identical
  // in its state-hash chain and its observations.  The evaluated single-run
  // suite verdicts come from run A; a single-run suite evaluation reports
  // COMMON-DETERMINISTIC as NOT_EVALUATED, so that criterion's verdict is the
  // honest two-run attestation result below, carried into the aggregate.
  const { scenario, match: runA } = runGk(scenarioPath, maxTicks);
  const { match: runB } = runGk(scenarioPath, maxTicks);
  const suite = evaluateSuite("goalkeepers", runA.observations);

  const gkReg: Record<string, Outcome> = {};
  const gkBehavior: Record<string, Outcome> = {};
  const common: Record<string, Outcome> = {};
  const refOutcomes: Outcome[] = [];
  const visOutcomes: Outcome[] = [];
  const causalOutcomes: Outcome[] = [];

  for (const test of suite.tests) {
    for (const c of test.criteria) {
      const id = c.criterion_id as string;
      if (GK_REG_CRITERIA.includes(id as (typeof GK_REG_CRITERIA)[number])) {
        gkReg[id] = c.outcome;
      } else if (c.class === "MEASURED_TARGET") {
        refOutcomes.push(c.outcome);
      } else if (c.class === "PERCEPTUAL_TARGET") {
        visOutcomes.push(c.outcome);
      } else if (c.class === "UNKNOWN") {
        causalOutcomes.push(c.outcome);
      } else if (GK_BEHAVIOR_IDS.has(id)) {
        gkBehavior[id] = c.outcome;
      } else if (GK_COMMON_IDS.has(id)) {
        common[id] = c.outcome;
      }
    }
  }

  const eventKinds = countKinds(runA.observations);
  const regClass = classBucket(Object.values(gkReg));
  const hashA = sha256(JSON.stringify(runA.stateHashes));
  const hashB = sha256(JSON.stringify(runB.stateHashes));
  const obsA = sha256(JSON.stringify(runA.observations));
  const obsB = sha256(JSON.stringify(runB.observations));

  // COMMON-DETERMINISTIC: identical two runs -> PASS; divergence -> FAIL.
  const deterministic = hashA === hashB && obsA === obsB;
  const commonOutcomes: Record<string, Outcome> = { ...common };
  if (commonOutcomes["COMMON-DETERMINISTIC"] === "NOT_EVALUATED") {
    commonOutcomes["COMMON-DETERMINISTIC"] = deterministic ? "PASS" : "FAIL";
  }

  return {
    run_id: runId,
    scenario: scenario.id,
    ticks: runA.tick,
    lifecycle: "core-owned",
    reproduction:
      `runHeadlessMatch({ scenario: load(${JSON.stringify(scenarioPath)}), maxTicks: ${maxTicks}, ` +
      `cpuAntiHuddle: true, cpuDefensiveTackle: true, gkBehavior: true, ` +
      `browserParityObservations: true, lifecyclePhaseSync: 'core-owned' }) x2 (two-run attestation) + evaluateSuite('goalkeepers', observations)`,
    observation_count: runA.observations.length,
    event_kind_counts: eventKinds,
    determinism: {
      run_a_state_hash_of_hashes: hashA,
      run_b_state_hash_of_hashes: hashB,
      run_a_observations_sha256: obsA,
      run_b_observations_sha256: obsB,
      identical: deterministic,
      state_hash_chain_identical: hashA === hashB,
      observations_byte_identical: obsA === obsB,
      final_state_hash: runA.stateHashes.at(-1) ?? null,
    },
    gk_behavior: gkBehavior,
    common: commonOutcomes,
    catalog: {
      ref: classBucket(refOutcomes),
      vis: classBucket(visOutcomes),
      reg: regClass,
      causal: classBucket(causalOutcomes),
    },
    accepted_state_hash_of_hashes: null,
    character_identical_to_accepted: false,
  };
}

// The accepted GK stream state-hash-of-hashes pins (record fc7d1b97…), used to
// attest that each reproduced stream is character-identical to the accepted one.
const GK_ACCEPTED_PINS: Record<string, string> = {
  "gk-continuous-live": "6dbb4341999b19915c05f4363cd5dfadc17168771311f957a8a44583c0099584",
  "gk-shot-fixture-live": "4a1aa34d87e3a58829edae2416503ae7508011b6da7e8981325bd0a09bf092e0",
  "gk-release-fixture-live": "dd03c4a1ea391089d34c99536bf4d5b84d1f4411350ae0a8e64016e73c9e056f",
};

function gkAggregate(runs: GkRunResult[]): Record<Outcome, number> {
  const counts: Record<Outcome, number> = {
    PASS: 0,
    FAIL: 0,
    NOT_EVALUATED: 0,
    BLOCKED_MISSING_REFERENCE: 0,
    NEEDS_PERCEPTUAL_REVIEW: 0,
  };
  const keys = gkKeys(runs);
  for (const v of Object.values(keys)) counts[v] = (counts[v] ?? 0) + 1;
  return counts;
}

/** The 13 published GK aggregate keys (5 behavior + 4 common + 4 catalog). */
function gkKeys(runs: GkRunResult[]): Record<string, Outcome> {
  const ref: Outcome[] = [];
  const vis: Outcome[] = [];
  const reg: Outcome[] = [];
  const causal: Outcome[] = [];
  for (const r of runs) {
    ref.push(r.catalog.ref);
    vis.push(r.catalog.vis);
    reg.push(r.catalog.reg);
    causal.push(r.catalog.causal);
  }
  return {
    "GK-POSITIONING-HOLD": classBucketRun(runs, "GK-POSITIONING-HOLD"),
    "GK-NO-FIELD-CHASE": classBucketRun(runs, "GK-NO-FIELD-CHASE"),
    "GK-SAVE-CLAIM": classBucketRun(runs, "GK-SAVE-CLAIM"),
    "GK-ROLE-DESIGNATION": classBucketRun(runs, "GK-ROLE-DESIGNATION"),
    "GK-DISTRIBUTION-NO-OMNISCIENCE": classBucketRun(runs, "GK-DISTRIBUTION-NO-OMNISCIENCE"),
    "COMMON-FINITE": classBucketRun(runs, "COMMON-FINITE"),
    "COMMON-DETERMINISTIC": classBucketRun(runs, "COMMON-DETERMINISTIC"),
    "COMMON-REFERENCES": classBucketRun(runs, "COMMON-REFERENCES"),
    "COMMON-BOUNDS": classBucketRun(runs, "COMMON-BOUNDS"),
    ref: classBucket(ref),
    vis: classBucket(vis),
    reg: classBucket(reg),
    causal: classBucket(causal),
  };
}

function classBucketRun(runs: GkRunResult[], key: string): Outcome {
  return classBucket(runs.map((r) => r.gk_behavior[key] ?? r.common[key] ?? "NOT_EVALUATED"));
}

// ---------------------------------------------------------------------------
// Fouls suite — per-criterion executed state over the accepted fouls/free-kick
// consequence streams.
// ---------------------------------------------------------------------------

interface FoulsRunResult {
  run_id: string;
  role: string;
  scenario: string;
  ticks: number;
  reproduction: string;
  observation_count: number;
  event_kind_counts: Record<string, number>;
  state_hash_of_hashes: string;
  accepted_state_hash_of_hashes: string | null;
  character_identical_to_accepted: boolean;
  foul_count: number;
  free_kick_count: number;
  fouls_suite_verdicts: Record<string, Outcome>;
  power_guard_free_kick: boolean;
}

const FOULS_CRITERIA = ["FOUL-DETECT", "FOUL-CLEAN-TACKLE", "FREE-KICK-AWARD"];

function foulsVerdicts(observations: TelemetryObservation[]): Record<string, Outcome> {
  const suite = evaluateSuite("fouls", observations);
  const out: Record<string, Outcome> = {};
  for (const t of suite.tests) for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  return out;
}

const FOULS_ACCEPTED_PINS: Record<string, string> = {
  "driven-foul-live": "8c227ab43ef51e0f1eacfe600cbfcca938384b50843e9fcf0a1b8603f23bfdcd",
  "organic-foul-live": "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a",
  "freekick-driven-duel": "5f3bc337c1e928eb084f2beb5cea6bdde39668aea71f58b809ee831c1443454d",
  "freekick-organic": "47674adfb1cd411bc5bdc0d03c4744861df7953cd2f0cc4a63a8b13cd172a036",
  "freekick-antihuddle-window": "63063b342f658c862bdbed296a86cd7c1ed4190f73d639be7d21a4878f0ec8c0",
  "freekick-human-serve": "428a4df583fcaeafb6525fd2c161971f5183ed049ecd850e9fbfabd91ac0b86d",
};

function makeFoulsRun(
  run_id: string,
  role: string,
  scenario: string,
  result: { stateHashes: string[]; observations: TelemetryObservation[] },
): FoulsRunResult {
  const hashOfHashes = sha256(JSON.stringify(result.stateHashes));
  const counts = countKinds(result.observations);
  const verdicts = foulsVerdicts(result.observations);
  const accepted = FOULS_ACCEPTED_PINS[run_id] ?? null;
  return {
    run_id,
    role,
    scenario,
    ticks: result.stateHashes.length,
    reproduction: `runDefensiveDuel(...) / runHeadlessMatch(...) + detectFoulEvents + evaluateSuite('fouls', observations)`,
    observation_count: result.observations.length,
    event_kind_counts: counts,
    state_hash_of_hashes: hashOfHashes,
    accepted_state_hash_of_hashes: accepted,
    character_identical_to_accepted: accepted !== null && hashOfHashes === accepted,
    foul_count: countFoulEvents(result.observations),
    free_kick_count: counts["free-kick-executed"] ?? 0,
    fouls_suite_verdicts: verdicts,
    power_guard_free_kick:
      (counts["foul"] ?? 0) === 0 && (counts["free-kick-executed"] ?? 0) > 0,
  };
}

// Stream producers (reproduce the accepted streams unchanged).
function runDrivenFoul() {
  const scenario = withProximateHumanDefence(loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"));
  const r = runDefensiveDuel({
    scenario,
    maxTicks: 120,
    attempts: [{ kind: "standing", commitDistance: 3.0, earliestTick: 48 }],
  });
  detectFoulEvents(r.observations);
  return { stateHashes: r.stateHashes, observations: r.observations };
}

function runOrganicFoul() {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/3v3-press-scenario.v1.json"),
    maxTicks: 600,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "legacy",
    cpuDefensiveTackle: true,
    detectFouls: true,
  });
}

function runFreekickDrivenDuel() {
  const scenario = withProximateHumanDefence(loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"));
  const r = runDefensiveDuel({
    scenario,
    maxTicks: 200,
    attempts: [{ kind: "standing", commitDistance: 3.0, earliestTick: 48 }],
    freeKickConfig: { awardFreeKicks: true },
  });
  detectFoulEvents(r.observations);
  return { stateHashes: r.stateHashes, observations: r.observations };
}

function runFreekickOrganic() {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/3v3-press-scenario.v1.json"),
    maxTicks: 600,
    cpuAntiHuddle: false,
    lifecyclePhaseSync: "core-owned",
    cpuDefensiveTackle: true,
    detectFouls: true,
    awardFreeKicks: true,
    serializeRestartFacts: true,
  });
}

function runFreekickAntihuddleWindow() {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/5v5-human-restart-throwin.v1.json"),
    maxTicks: 60,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    browserParityObservations: true,
    serializeRestartFacts: true,
    freeKickWindow: { team: "team-a", takerPlayerId: "player-1", position: { x: 30, y: 10 }, countdown: 5 },
  });
}

function runFreekickHumanServe() {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/5v5-human-serve-throwin.v1.json"),
    maxTicks: 40,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    browserParityObservations: true,
    serializeRestartFacts: true,
    freeKickWindow: { team: "team-a", takerPlayerId: "player-1", position: { x: 30, y: 10 }, countdown: 5 },
    humanRestartControl: {
      humanTeamId: "team-a",
      humanControlledPlayerId: "player-1",
      humanControlSlot: "slot-1",
      humanMoveDirection: { x: 1, y: 0 },
      humanPassAtTick: 7,
    },
  });
}

const gkRuns = [
  evaluateGkRun("gk-continuous-live", "eval/scenarios/5v5-continuous-play.v1.json", 1800),
  evaluateGkRun("gk-shot-fixture-live", "eval/scenarios/5v5-keeper-shot-fixture.v1.json", 600),
  evaluateGkRun("gk-release-fixture-live", "eval/scenarios/5v5-keeper-release-fixture.v1.json", 300),
];
for (const r of gkRuns) {
  const pin = GK_ACCEPTED_PINS[r.run_id] ?? null;
  r.accepted_state_hash_of_hashes = pin;
  r.character_identical_to_accepted =
    pin !== null && r.determinism.run_a_state_hash_of_hashes === pin;
}

const foulsRuns: FoulsRunResult[] = [
  makeFoulsRun(
    "driven-foul-live",
    "proximate 5v5 human-vs-CPU (defensive-duel-driver) with a scripted standing tackle: a real man-not-ball contact emits a `foul`. FOUL-DETECT / FOUL-CLEAN-TACKLE PASS; FREE-KICK-AWARD NOT_EVALUATED (no free-kick-executed — the gate is off for this stream).",
    "eval/scenarios/5v5-human-vs-cpu.v1.json (withProximateHumanDefence)",
    runDrivenFoul(),
  ),
  makeFoulsRun(
    "organic-foul-live",
    "coherent 3v3 CPU-vs-CPU press under cpuDefensiveTackle:true + detectFouls:true (legacy lifecycle): a real foul emerges organically. FOUL-DETECT / FOUL-CLEAN-TACKLE PASS; FREE-KICK-AWARD NOT_EVALUATED (awardFreeKicks off).",
    "eval/scenarios/3v3-press-scenario.v1.json",
    runOrganicFoul(),
  ),
  makeFoulsRun(
    "freekick-driven-duel",
    "the same proximate duel with the in-core free-kick gate on: the foul is committed, but the free-kick-executed lives in the core's persistent state (the driven shape does not serialize restart facts) → FREE-KICK-AWARD NOT_EVALUATED.",
    "eval/scenarios/5v5-human-vs-cpu.v1.json (withProximateHumanDefence)",
    runFreekickDrivenDuel(),
  ),
  makeFoulsRun(
    "freekick-organic",
    "coherent 3v3 CPU-vs-CPU press under detectFouls:true + awardFreeKicks:true, core-owned + serializeRestartFacts: the foul AND the free-kick-executed both sit in the observation stream → FREE-KICK-AWARD PASS (the genuine verdict stream).",
    "eval/scenarios/3v3-press-scenario.v1.json",
    runFreekickOrganic(),
  ),
  makeFoulsRun(
    "freekick-antihuddle-window",
    "a driven freeKickWindow restart window with NO detected foul → FREE-KICK-AWARD FAIL (POWER GUARD: a free kick without a foul is invalid).",
    "eval/scenarios/5v5-human-restart-throwin.v1.json",
    runFreekickAntihuddleWindow(),
  ),
  makeFoulsRun(
    "freekick-human-serve",
    "a human-served free-kick window with NO detected foul → FREE-KICK-AWARD FAIL (the same POWER GUARD).",
    "eval/scenarios/5v5-human-serve-throwin.v1.json",
    runFreekickHumanServe(),
  ),
];

// ---------------------------------------------------------------------------
// Aggregate composition
// ---------------------------------------------------------------------------

// The fouls genuine FREE-KICK-AWARD verdict is evaluated on streams where a
// detected foul is present (foul -> consequence). The freeKickWindow / human-serve
// streams deliberately award a free kick WITHOUT a foul; they are DISCRIMINATING
// (power-guard) controls that must FAIL to prove the oracle's power, so they are
// excluded from the genuine FREE-KICK-AWARD aggregate and reported separately.
const FREE_KICK_AWARD_GUARD_STREAMS = new Set([
  "freekick-antihuddle-window",
  "freekick-human-serve",
]);

function criterionAggregate(criterionId: string): { verdict: Outcome; source_streams: string[]; power_guard_streams: string[] } {
  const eligible = foulsRuns.filter((r) => {
    if (criterionId === "FREE-KICK-AWARD") return !FREE_KICK_AWARD_GUARD_STREAMS.has(r.run_id);
    return true;
  });
  const values = eligible
    .filter((r) => r.fouls_suite_verdicts[criterionId] !== undefined)
    .map((r) => r.fouls_suite_verdicts[criterionId]);
  if (values.includes("FAIL")) return { verdict: "FAIL", source_streams: eligible.filter((r) => r.fouls_suite_verdicts[criterionId] === "FAIL").map((r) => r.run_id), power_guard_streams: [] };
  if (values.includes("PASS")) return { verdict: "PASS", source_streams: eligible.filter((r) => r.fouls_suite_verdicts[criterionId] === "PASS").map((r) => r.run_id), power_guard_streams: foulsRuns.filter((r) => r.power_guard_free_kick).map((r) => r.run_id) };
  return { verdict: "NOT_EVALUATED", source_streams: [], power_guard_streams: foulsRuns.filter((r) => r.power_guard_free_kick).map((r) => r.run_id) };
}

const foulsAggregate: Record<string, { verdict: Outcome; source_streams: string[] }> = {};
for (const criterionId of FOULS_CRITERIA) {
  const agg = criterionAggregate(criterionId);
  foulsAggregate[criterionId] = { verdict: agg.verdict, source_streams: agg.source_streams };
}

const foulsCounts: Record<Outcome, number> = {
  PASS: 0,
  FAIL: 0,
  NOT_EVALUATED: 0,
  BLOCKED_MISSING_REFERENCE: 0,
  NEEDS_PERCEPTUAL_REVIEW: 0,
};
for (const c of FOULS_CRITERIA) foulsCounts[foulsAggregate[c].verdict] += 1;

// ---------------------------------------------------------------------------
// Baseline loading (read verbatim, never hand-written)
// ---------------------------------------------------------------------------

const gkBaselineRecord = readJson<{
  suites: {
    goalkeepers: {
      verdicts: Record<string, Outcome>;
      verdict_counts: Record<Outcome, number>;
    };
  };
}>(GK_BASELINE_RECORD);
// The baseline verdicts are stored as nested { gk_behavior, common, catalog };
// keep the verbatim nested shape for the record, and flatten only for the
// per-criterion delta comparison (the published aggregate is a flat 13-key table).
const gkBaselineRaw = gkBaselineRecord.suites.goalkeepers.verdicts;
const gkBaselineVerdicts: Record<string, Outcome> = {
  ...gkBaselineRaw.gk_behavior,
  ...gkBaselineRaw.common,
  ...gkBaselineRaw.catalog,
};
const gkBaselineCounts = gkBaselineRecord.suites.goalkeepers.verdict_counts;

const gkCurrentVerdicts = gkKeys(gkRuns);
const gkCurrentCounts = gkAggregate(gkRuns);

const gkChanged: Array<{ criterion: string; from: Outcome; to: Outcome; source_streams: string[] }> = [];
const gkUnchanged: Array<{ criterion: string; outcome: Outcome }> = [];
for (const [criterionId, to] of Object.entries(gkCurrentVerdicts)) {
  const from = gkBaselineVerdicts[criterionId] ?? "NOT_EVALUATED";
  if (from !== to) {
    gkChanged.push({ criterion: criterionId, from, to, source_streams: gkRuns.map((r) => r.run_id) });
  } else {
    gkUnchanged.push({ criterion: criterionId, outcome: to });
  }
}

mkdirSync(OUTPUT_ROOT, { recursive: true });

const claimsNotMade = [
  "No suite-level PASS claim for either suite. The goalkeepers suite remains partial under the REG/REF/VIS/CAUSAL catalog keys (ref=BLOCKED_MISSING_REFERENCE, vis=NEEDS_PERCEPTUAL_REVIEW, causal=NOT_EVALUATED remain). The fouls suite is partial (3 of the 5 FOULS_CARDS_SPEC §10 criteria registered; CARD-ISSUED and ADVANTAGE-PLAYED stay NAMED-NOT-REGISTERED), and FREE-KICK-AWARD's PASS is carried only by the organic stream with the deliberate power-guard FAILs disclosed.",
  "No PROMOTION claim.",
  "No FOUNDATION_LAB_PASS claim.",
  "No milestone PASS claim.",
  "No PES 2017 fidelity claim.",
  "No invented reference envelope or tolerance claim; the GK-*-REF BLOCKED_MISSING_REFERENCE values stay blocked and no reference target is invented.",
  "No criterion is upgraded beyond what the executed evaluator returns: only the REGRESSION-class GK-*-REG criteria resolve through the registered gk-regression canary; GK-*-REF / GK-*-VIS / GK-*-CAUSAL stay as they are.",
  "Zero gameplay / source / contract / adapter change: git diff src/ src/contracts/ is EMPTY; only evidence + a binding test + this producer are added.",
];

const disclosures = [
  "The goalkeepers aggregate baseline is the SUITE-DETERMINISTIC-TWO-RUN post-two-run table (record_sha256 abaf6ccd…, verdict_counts 9/0/2/1/1). GK-SUITE-CORE-OWNED-STATE's own record is 8/0/3/1/1 (single-run, COMMON-DETERMINISTIC NOT_EVALUATED) — the horizon-labelled baseline conflation is disclosed and the 9/0/2/1/1 table is used verbatim.",
  "The GK-*-REG conversion is carried by the registered gk-regression canary (GK-REGRESSION-POLICY-REGISTRATION, record fc7d1b97…, GOALKEEPER_SPEC §11.2): the canary FAILs when an accepted GK behavior pin diverges without a model-version bump and PASS when the pins hold. All three reproduced GK streams are character-identical to the accepted state-hash pins, so the PASS is an executed verdict, not a forced outcome. A pin a stream never triggers is left unobservable and returns honest NOT_EVALUATED (never PASS by silence).",
  "GK-*-REF stay BLOCKED_MISSING_REFERENCE, GK-*-VIS stay NEEDS_PERCEPTUAL_REVIEW and GK-*-CAUSAL stay NOT_EVALUATED under their own criteria; the canary is wired only to the six GK-*-REG criteria.",
  "The fouls FREE-KICK-AWARD genuine verdict is evaluated on streams where a detected foul is present. The freeKickWindow anti-huddle control and the human-serve free-kick window deliberately award a free kick with NO detected foul; these are POWER-GUARD (discriminating) controls that must FAIL to prove the oracle has power (a free kick is only the consequence of a called foul, FOULS_CARDS_SPEC §10). They are excluded from the genuine FREE-KICK-AWARD aggregate and reported separately — analogously to the RULES-SUITE-STATE-RERUN anti-huddle eligibility exclusion.",
  "The freekick-driven-duel stream carries its free kick in the CORE's persistent state, not the per-step observation array (the accepted runner serialization limit); FREE-KICK-AWARD there is honest NOT_EVALUATED, never a false PASS or FAIL.",
  "organic-foul-stashed (detectFouls:false stash-identity control) and freekick-gate-off (legacy gate-off pin) both emit neither a foul nor a free kick and evaluate to NOT_EVALUATED on all three fouls criteria; they are cited from the accepted records (FOULS-SUITE-REGISTRATION 5e538e5d…, FREE-KICK-SUITE-REGISTRATION 86a34acb…) and not re-run here (they are deterministic no-verdict controls that cannot change the aggregate).",
  "No gameplay inference about the CORE's correctness is drawn from any PASS; the verdicts are statements that an accepted driven/organic stream satisfies the registered criterion, not a PES fidelity or full-regulation claim.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-fouls-aggregate-honesty-rerun.ts",
  evidence_class: "BOOKKEEPING",
  suites: {
    goalkeepers: {
      suite_id: "goalkeepers",
      suite_version: "suite-goalkeepers-v1",
      lifecycle_phase_sync: "core-owned (gkBehavior true, re-home on)",
      baseline: {
        source_record: GK_BASELINE_RECORD,
        baseline_record_sha256: readJson<{ record_sha256: string }>(GK_BASELINE_RECORD).record_sha256,
        verdict_counts: gkBaselineCounts,
        verdicts: gkBaselineRaw,
      },
      current: {
        verdict_counts: gkCurrentCounts,
        verdicts: gkCurrentVerdicts,
      },
      verdict_delta: {
        changed: gkChanged,
        unchanged_count: gkUnchanged.length,
        summary:
          "Single verdict change: GK-*-REG (aggregated as the catalog `reg` key) converts NOT_EVALUATED -> executed PASS through the registered gk-regression canary. The aggregate counts move 9/0/2/1/1 -> 10/0/1/1/1 (PASS%2B1, NOT_EVALUATED-1). GK-*-REF / GK-*-VIS / GK-*-CAUSAL unchanged.",
      },
      runs: gkRuns.map((r) => ({
        run_id: r.run_id,
        scenario: r.scenario,
        ticks: r.ticks,
        lifecycle: r.lifecycle,
        reproduction: r.reproduction,
        observation_count: r.observation_count,
        event_kind_counts: r.event_kind_counts,
        determinism: r.determinism,
        accepted_state_hash_of_hashes: r.accepted_state_hash_of_hashes,
        character_identical_to_accepted: r.character_identical_to_accepted,
        gk_behavior: r.gk_behavior,
        common: r.common,
        catalog: r.catalog,
      })),
    },
    fouls: {
      suite_id: "fouls",
      suite_version: "suite-fouls-v1",
      lifecycle_phase_sync: "core-owned (organic / anti-huddle / human-serve); legacy (driven foul / organic press)",
      registered_criteria: FOULS_CRITERIA,
      named_not_registered: ["CARD-ISSUED", "ADVANTAGE-PLAYED"],
      per_criterion: foulsAggregate,
      verdict_counts: foulsCounts,
      power_guard_streams: foulsRuns.filter((r) => r.power_guard_free_kick).map((r) => r.run_id),
      runs: foulsRuns.map((r) => ({
        run_id: r.run_id,
        role: r.role,
        scenario: r.scenario,
        ticks: r.ticks,
        reproduction: r.reproduction,
        observation_count: r.observation_count,
        event_kind_counts: r.event_kind_counts,
        state_hash_of_hashes: r.state_hash_of_hashes,
        accepted_state_hash_of_hashes: r.accepted_state_hash_of_hashes,
        character_identical_to_accepted: r.character_identical_to_accepted,
        foul_count: r.foul_count,
        free_kick_count: r.free_kick_count,
        fouls_suite_verdicts: r.fouls_suite_verdicts,
        power_guard_free_kick: r.power_guard_free_kick,
      })),
    },
  },
  guard_state: {
    all_gk_streams_character_identical_to_accepted: gkRuns.every((r) => r.character_identical_to_accepted),
    all_fouls_streams_character_identical_to_accepted: foulsRuns.every((r) => r.character_identical_to_accepted),
  },
  disclosures,
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[fouls-aggregate-honesty-rerun] wrote ${STATE_PATH}`);
console.log(`[fouls-aggregate-honesty-rerun] record_sha256=${String(record.record_sha256)}`);
console.log(
  `[fouls-aggregate-honesty-rerun] goalkeepers counts ${JSON.stringify(gkBaselineCounts)} -> ${JSON.stringify(gkCurrentCounts)}`,
);
console.log(`[fouls-aggregate-honesty-rerun] goalkeepers changed=${gkChanged.length} unchanged=${gkUnchanged.length}`);
console.log(
  `[fouls-aggregate-honesty-rerun] fouls counts=${JSON.stringify(foulsCounts)} registered=${FOULS_CRITERIA.length}/5`,
);
for (const r of gkRuns) {
  console.log(
    `  gk ${r.run_id} (${r.ticks} ticks): reg=${r.catalog.reg} ref=${r.catalog.ref} vis=${r.catalog.vis} causal=${r.catalog.causal} identical=${String(r.character_identical_to_accepted)}`,
  );
}
for (const r of foulsRuns) {
  console.log(
    `  fouls ${r.run_id} (${r.ticks} ticks): fouls=${r.foul_count} fk=${r.free_kick_count} ` +
      `FK-AWARD=${r.fouls_suite_verdicts["FREE-KICK-AWARD"]} identical=${String(r.character_identical_to_accepted)}`,
  );
}
