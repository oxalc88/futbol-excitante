/**
 * Node-side evidence producer for DUELS-SUITE-ORGANIC-RERUN.
 *
 * Re-runs the accepted duels evaluator suite (`evaluateSuite("duels", ...)`)
 * against the now-organic observations and writes the honest before/after
 * suite state to `docs/evidence/DUELS-SUITE-ORGANIC-RERUN/duels-suite-state.json`.
 *
 * Sources (all accepted, all on main):
 *   - 5V5-KICKOFF-ANTI-HUDDLE flowing run (candidate 47bb0db)
 *   - HUMAN-DEFENSIVE-DUEL-CONTROL human-driven duel (candidate d56ccad)
 *   - RESTART-ANTI-HUDDLE-COHERENCE live runs (candidate 210b27c)
 *   - BALL-SETTLED-REGIME-FIX flowing run (candidate 455f4ec)
 *
 * Each run is reproduced headlessly through its established runner (the same
 * exported production functions the browser composition root uses) and the
 * evaluator is physically run over the committed telemetry observations —
 * no outcome is hand-written.
 *
 * The suite evaluator itself, `src/`, `eval/scenarios/`, `specs/` and
 * `eval/runners/` are not modified. Only this producer and the durable record
 * it writes are new.
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import { filterEventsForSituation } from "../eval/contracts/situation-mapping.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";

const OBJECTIVE_ID = "DUELS-SUITE-ORGANIC-RERUN";
const EVIDENCE_DIR = resolve("docs/evidence", OBJECTIVE_ID);
const ARTIFACT_PATH = resolve(EVIDENCE_DIR, "duels-suite-state.json");

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** The duels criteria scoped by this refresh (TACK-*-PHASE + PHY-SHLD-001-CONT). */
const SCOPED_CRITERIA = [
  "TACK-ST-001-PHASE",
  "TACK-SL-001-PHASE",
  "PHY-SHLD-001-CONT",
];

/** The common/protected criteria the suite always carries. */
const COMMON_CRITERIA = [
  "COMMON-FINITE",
  "COMMON-DETERMINISTIC",
  "COMMON-REFERENCES",
  "COMMON-BOUNDS",
];

interface OrganicRunResult {
  run_id: string;
  scenario: string;
  ticks: number;
  source_evidence: string;
  source_candidate: string;
  reproduction: string;
  observations: number;
  event_counts: Record<string, number>;
  scoped_criteria: Record<string, string>;
  common_criteria: Record<string, string>;
  phys_duel: {
    present: boolean;
    player_contacts: number;
    input_rejections: number;
  };
}

function evaluateRun(run: {
  run_id: string;
  scenario: string;
  ticks: number;
  source_evidence: string;
  source_candidate: string;
  reproduction: string;
  observations: TelemetryObservation[];
  events: Array<{ kind: string; payload?: Record<string, unknown> }>;
}): OrganicRunResult {
  const kindCounts: Record<string, number> = {};
  for (const obs of run.observations) {
    for (const ev of obs.events) {
      kindCounts[ev.kind] = (kindCounts[ev.kind] ?? 0) + 1;
    }
  }

  const suite = evaluateSuite("duels", run.observations);
  const scopedCriteria: Record<string, string> = {};
  const commonCriteria: Record<string, string> = {};
  for (const test of suite.tests) {
    for (const c of test.criteria) {
      if (COMMON_CRITERIA.includes(c.criterion_id)) {
        commonCriteria[c.criterion_id] = c.outcome;
      } else if (SCOPED_CRITERIA.includes(c.criterion_id)) {
        scopedCriteria[c.criterion_id] = c.outcome;
      }
    }
  }

  const playerContacts = run.events.filter((e) => e.kind === "player-player-contact").length;
  const inputRejections = run.events.filter((e) => e.kind === "input-rejection").length;

  return {
    run_id: run.run_id,
    scenario: run.scenario,
    ticks: run.ticks,
    source_evidence: run.source_evidence,
    source_candidate: run.source_candidate,
    reproduction: run.reproduction,
    observations: run.observations.length,
    event_counts: kindCounts,
    scoped_criteria: scopedCriteria,
    common_criteria: commonCriteria,
    phys_duel: {
      present: inputRejections > 0 && playerContacts > 0,
      player_contacts: playerContacts,
      input_rejections: inputRejections,
    },
  };
}

const runs: OrganicRunResult[] = [];

// 1. Anti-huddle flowing run (5V5-KICKOFF-ANTI-HUDDLE, candidate 47bb0db).
{
  const scenario = loadScenario("eval/scenarios/5v5-continuous-play.v1.json");
  const match = runHeadlessMatch({
    scenario,
    maxTicks: 1800,
    cpuAntiHuddle: true,
    cpuDefensiveTackle: true,
    browserParityObservations: true,
  });
  runs.push(evaluateRun({
    run_id: "anti-huddle-flowing",
    scenario: scenario.id,
    ticks: 1800,
    source_evidence: "docs/evidence/5V5-KICKOFF-ANTI-HUDDLE/trajectory.json",
    source_candidate: "47bb0db",
    reproduction:
      `runHeadlessMatch({ scenario: 5v5-continuous-play.v1.json, maxTicks: 1800, ` +
      `cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true })`,
    observations: match.observations,
    events: match.events as never,
  }));
}

// 2. Human-driven duel run (HUMAN-DEFENSIVE-DUEL-CONTROL, candidate d56ccad).
{
  const base = loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json");
  const scenario = withProximateHumanDefence(base);
  const duel = runDefensiveDuel({
    scenario,
    maxTicks: 120,
    cpuAntiHuddle: false,
    attempts: [
      { kind: "standing", commitDistance: 3.0, earliestTick: 30, lockoutFollowUpTicks: 3 },
      { kind: "slide", commitDistance: 4.0, earliestTick: 80 },
    ],
  });
  runs.push(evaluateRun({
    run_id: "human-duel",
    scenario: scenario.id,
    ticks: 120,
    source_evidence: "docs/evidence/HUMAN-DEFENSIVE-DUEL-CONTROL/trajectory.json",
    source_candidate: "dc40fd2",
    reproduction:
      `runDefensiveDuel({ scenario: withProximateHumanDefence(5v5-human-vs-cpu.v1.json), ` +
      `maxTicks: 120, cpuAntiHuddle: false, attempts: [standing(3.0,30,+3), slide(4.0,80)] })`,
    observations: duel.observations,
    events: duel.events as never,
  }));
}

// 3. Restart live runs (RESTART-ANTI-HUDDLE-COHERENCE, candidate 210b27c).
{
  const specs = [
    { run_id: "restart-corner", scenarioPath: "eval/scenarios/5v5-continuous-play.v1.json" },
    { run_id: "restart-throwin", scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json" },
    { run_id: "restart-goalkick-postgoal", scenarioPath: "eval/scenarios/5v5-restart-arc.v1.json" },
  ];
  for (const spec of specs) {
    const scenario = loadScenario(spec.scenarioPath);
    const match = runHeadlessMatch({
      scenario,
      maxTicks: 1800,
      cpuAntiHuddle: true,
      cpuDefensiveTackle: true,
      browserParityObservations: true,
      lifecyclePhaseSync: "core-owned",
    });
    runs.push(evaluateRun({
      run_id: spec.run_id,
      scenario: scenario.id,
      ticks: 1800,
      source_evidence: "docs/evidence/RESTART-ANTI-HUDDLE-COHERENCE/trajectory.json",
      source_candidate: "210b27c",
      reproduction:
        `runHeadlessMatch({ scenario: ${spec.scenarioPath}, maxTicks: 1800, ` +
        `cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true, ` +
        `lifecyclePhaseSync: 'core-owned' })`,
      observations: match.observations,
      events: match.events as never,
    }));
  }
}

// 4. Ball-settled flowing run (BALL-SETTLED-REGIME-FIX, candidate 455f4ec).
{
  const scenario = loadScenario("eval/scenarios/5v5-continuous-play.v1.json");
  const match = runHeadlessMatch({
    scenario,
    maxTicks: 1200,
    cpuAntiHuddle: true,
    cpuDefensiveTackle: true,
    browserParityObservations: true,
  });
  runs.push(evaluateRun({
    run_id: "ball-settled-flowing",
    scenario: scenario.id,
    ticks: 1200,
    source_evidence: "docs/evidence/BALL-SETTLED-REGIME-FIX/trajectory.json",
    source_candidate: "455f4ec",
    reproduction:
      `runHeadlessMatch({ scenario: 5v5-continuous-play.v1.json, maxTicks: 1200, ` +
      `cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true })`,
    observations: match.observations,
    events: match.events as never,
  }));
}

// ---------------------------------------------------------------------------
// Before/after table
// ---------------------------------------------------------------------------

/**
 * The "before" is the duels-suite state as recorded by the previously
 * accepted evidence. It is a documented constant (immutable), not recomputed:
 *   - duels-suite.test.ts pins TACK-ST/SL-001-PHASE PASS on the driven
 *     standing/slide fixtures and PHY-SHLD-001-CONT PASS on the two-player
 *     overlap scenario; PHY-STR/BC/PC and TACK-ANG/INT criteria stay
 *     NOT_EVALUATED (no oracle).
 *   - CPU-DEFENSIVE-TACKLE / SMALL-SIDED-ORGANIC-DUEL-CLOSURE record
 *     PHYSICAL_DUEL as insufficient_context (no input-rejection in CPU runs).
 */
const BEFORE = {
  scoped_criteria: {
    "TACK-ST-001-PHASE": "PASS (driven standing-tackle fixture only)",
    "TACK-SL-001-PHASE": "PASS (driven slide-tackle fixture only)",
    "PHY-SHLD-001-CONT": "PASS (driven two-player overlap scenario only)",
  },
  situation: {
    "PHYSICAL_DUEL": "insufficient_context (required player-player-contact produced; indicative input-rejection = 0 in all CPU-vs-CPU runs)",
  },
  common_criteria: {
    "COMMON-FINITE": "PASS",
    "COMMON-DETERMINISTIC": "NOT_EVALUATED (single-run)",
    "COMMON-REFERENCES": "FAIL on full-match observations (lastTouchRef points to a prior-tick event not present in the per-tick observation)",
    "COMMON-BOUNDS": "FAIL where ball-out-of-play; PASS otherwise",
  },
};

/** Collapse the per-run scoped outcomes to the suite-wide "after" verdict. */
function suiteAfter(outcome: Record<string, string>): string {
  const values = new Set(Object.values(outcome));
  if (values.has("FAIL")) return "FAIL";
  if (values.has("PASS")) return "PASS";
  if (values.has("NOT_EVALUATED")) return "NOT_EVALUATED";
  return "NOT_EVALUATED";
}

const scopedAfter: Record<string, { verdict: string; source: string }> = {};
for (const criterion of SCOPED_CRITERIA) {
  const perRun = runs.map((r) => ({ run: r.run_id, outcome: r.scoped_criteria[criterion] }));
  const verdict = suiteAfter(Object.fromEntries(perRun.map((p) => [p.run, p.outcome])));
  scopedAfter[criterion] = {
    verdict,
    source: `organic observations across ${perRun.length} runs: ${perRun.map((p) => `${p.run}=${p.outcome}`).join(", ")}`,
  };
}

const physDuelPresent = runs.every((r) => r.phys_duel.present);
const physDuelAfter = {
  verdict: physDuelPresent ? "present" : "insufficient_context",
  source: runs.map((r) => `${r.run_id}: ${r.phys_duel.input_rejections} input-rejection + ${r.phys_duel.player_contacts} player-player-contact`).join("; "),
};

const artifact = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  suite_id: "duels",
  suite_version: "suite-duels-v1",
  produced_by: "scripts/capture-duels-suite-organic-rerun.ts",
  evidence_class: "HEADLESS",
  generated_at: new Date().toISOString(),
  record_sha256: null as string | null,
  before: BEFORE,
  after: {
    scoped_criteria: scopedAfter,
    situation: { PHYSICAL_DUEL: physDuelAfter },
    common_criteria: {
      "COMMON-FINITE": suiteAfter(Object.fromEntries(runs.map((r) => [r.run_id, r.common_criteria["COMMON-FINITE"]]))),
      "COMMON-DETERMINISTIC": suiteAfter(Object.fromEntries(runs.map((r) => [r.run_id, r.common_criteria["COMMON-DETERMINISTIC"]]))),
      "COMMON-REFERENCES": suiteAfter(Object.fromEntries(runs.map((r) => [r.run_id, r.common_criteria["COMMON-REFERENCES"]]))),
      "COMMON-BOUNDS": suiteAfter(Object.fromEntries(runs.map((r) => [r.run_id, r.common_criteria["COMMON-BOUNDS"]]))),
    },
  },
  organic_runs: runs,
  claims_not_made: [
    "No PROMOTION claim.",
    "No PES fidelity / measured PES 2017 envelope claim.",
    "No FOUNDATION_LAB_PASS claim.",
    "No invented rubric, envelope or tolerance.",
    "No protected criteria change (COMMON invariants and their behavior are unchanged; they FAIL on full-match observations exactly as the invariant always has).",
    "No gameplay change (src/, eval/scenarios/, specs/, eval/runners/ untouched).",
  ],
};

// Record a stable SHA over the deterministic body (before + runs), so an
// independent re-run must reproduce the same record content.
const deterministicBody = JSON.stringify({
  before: artifact.before,
  after: artifact.after,
  organic_runs: artifact.organic_runs,
});
artifact.record_sha256 = sha256(deterministicBody);

mkdirSync(EVIDENCE_DIR, { recursive: true });
writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
console.log(`[duels-suite-organic-rerun] wrote ${ARTIFACT_PATH}`);
console.log(`[duels-suite-organic-rerun] record_sha256=${artifact.record_sha256}`);
for (const run of runs) {
  console.log(
    `  ${run.run_id}: TACK-ST=${run.scoped_criteria["TACK-ST-001-PHASE"]} ` +
    `TACK-SL=${run.scoped_criteria["TACK-SL-001-PHASE"]} ` +
    `PHY-SHLD=${run.scoped_criteria["PHY-SHLD-001-CONT"]} ` +
    `PHYS_DUEL=${run.phys_duel.present ? "present" : "insufficient_context"} ` +
    `(input-rej=${run.phys_duel.input_rejections}, contacts=${run.phys_duel.player_contacts})`,
  );
}
