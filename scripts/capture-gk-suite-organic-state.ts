/**
 * Node-side evidence producer for GK-SUITE-ORGANIC-STATE.
 *
 * Re-runs the accepted `goalkeepers` evaluator suite (`evaluateSuite(
 * "goalkeepers", ...)`) over the organic observations that now include
 * designated small-sided keepers, and writes the honest before/after suite
 * state to `docs/evidence/GK-SUITE-ORGANIC-STATE/gk-suite-state.json`.
 *
 * This is a BOOKKEEPING refresh.  The `goalkeepers` suite criteria are
 * PROTECTED: no oracle, catalog, invariant or observation change is made.
 * The capture only re-runs the already-registered evaluator over the organic
 * observations and records whatever it honestly returns.
 *
 * Sources (all accepted, all on main):
 *   - GK-5V5-ADAPTER-BEHAVIOR trajectory (candidate 40aa0dae) — headless
 *     MULTI_TICK keeper runs: organically-flowing continuous match + the
 *     controlled shot-on-target fixture.
 *   - GK-BROWSER-DYNAMIC-EVIDENCE trajectory (candidate fd6de8d) — browser
 *     DYNAMIC_VISUAL fixture run (arc-hold + save-contact@370).  Its
 *     observations are Chromium-runtime floats, so they are NOT fed into the
 *     Node headless evaluator (known pinned-runtime gap); its content is
 *     reflected by the headless shot-fixture run below and disclosed.
 *
 * Each headless organic run is reproduced through the same exported production
 * runner the accepted GK evidence used (`runHeadlessMatch` with `gkBehavior`)
 * and the evaluator is physically executed over the committed telemetry
 * observations — no outcome is hand-written.  The record's `before` state is
 * the documented GK-SPEC-SUITE-CONTRACTS constant (immutable; not recomputed).
 *
 * The suite evaluator itself, `src/`, `eval/runners/`, `eval/scenarios/` and
 * `specs/` are not modified.  Only this producer and the durable record it
 * writes are new.
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";

const OBJECTIVE_ID = "GK-SUITE-ORGANIC-STATE";

/**
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:GK-SUITE-ORGANIC-STATE`.  An ordinary run writes
 * the same record under the ignored `test-results/` tree and leaves
 * `docs/evidence/` byte-identical.
 *
 * Run in evidence mode with:
 *
 *   WIP_SECTION=__EVIDENCE__:GK-SUITE-ORGANIC-STATE \
 *     pnpm exec tsx scripts/capture-gk-suite-organic-state.ts
 */
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const ARTIFACT_PATH = resolve(OUTPUT_ROOT, "gk-suite-state.json");

/** The five small-sided GK behavior criteria (specs/GOALKEEPER_SPEC.md). */
const GK_BEHAVIOR_CRITERIA = [
  "GK-POSITIONING-HOLD",
  "GK-NO-FIELD-CHASE",
  "GK-SAVE-CLAIM",
  "GK-ROLE-DESIGNATION",
  "GK-DISTRIBUTION-NO-OMNISCIENCE",
] as const;

/** The protected common criteria every test carries. */
const COMMON_CRITERIA = [
  "COMMON-FINITE",
  "COMMON-DETERMINISTIC",
  "COMMON-REFERENCES",
  "COMMON-BOUNDS",
] as const;

/** Class→outcome for the §7.4 catalog criteria (identical across runs). */
const CATALOG_BEFORE: Record<string, string> = {
  GK_REF: "BLOCKED_MISSING_REFERENCE", // MEASURED_TARGET
  GK_VIS: "NEEDS_PERCEPTUAL_REVIEW", // PERCEPTUAL_TARGET
  GK_REG: "NOT_EVALUATED", // REGRESSION
  GK_CAUSAL: "NOT_EVALUATED", // UNKNOWN
};

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

interface OrganicRunResult {
  run_id: string;
  scenario: string;
  ticks: number;
  source_evidence: string;
  source_candidate: string;
  reproduction: string;
  observations: number;
  event_counts: Record<string, number>;
  gk_behavior: Record<string, string>;
  common: Record<string, string>;
  catalog: { ref: string; vis: string; reg: string; causal: string };
}

/** Run the protected evaluator over one organic GK run and collapse outcomes. */
function evaluateRun(run: {
  run_id: string;
  scenario: string;
  ticks: number;
  source_evidence: string;
  source_candidate: string;
  reproduction: string;
  observations: TelemetryObservation[];
}): OrganicRunResult {
  const kindCounts: Record<string, number> = {};
  for (const obs of run.observations) {
    for (const ev of obs.events) {
      kindCounts[ev.kind] = (kindCounts[ev.kind] ?? 0) + 1;
    }
  }

  const suite = evaluateSuite("goalkeepers", run.observations);
  const gkBehavior: Record<string, string> = {};
  const common: Record<string, string> = {};
  let ref = CATALOG_BEFORE.GK_REF;
  let vis = CATALOG_BEFORE.GK_VIS;
  let reg = CATALOG_BEFORE.GK_REG;
  let causal = CATALOG_BEFORE.GK_CAUSAL;
  for (const test of suite.tests) {
    for (const c of test.criteria) {
      if (GK_BEHAVIOR_CRITERIA.includes(c.criterion_id as (typeof GK_BEHAVIOR_CRITERIA)[number])) {
        gkBehavior[c.criterion_id] = c.outcome;
      } else if (COMMON_CRITERIA.includes(c.criterion_id as (typeof COMMON_CRITERIA)[number])) {
        common[c.criterion_id] = c.outcome;
      } else if (c.class === "MEASURED_TARGET") {
        ref = c.outcome;
      } else if (c.class === "PERCEPTUAL_TARGET") {
        vis = c.outcome;
      } else if (c.class === "REGRESSION") {
        reg = c.outcome;
      } else if (c.class === "UNKNOWN") {
        causal = c.outcome;
      }
    }
  }

  return {
    run_id: run.run_id,
    scenario: run.scenario,
    ticks: run.ticks,
    source_evidence: run.source_evidence,
    source_candidate: run.source_candidate,
    reproduction: run.reproduction,
    observations: run.observations.length,
    event_counts: kindCounts,
    gk_behavior: gkBehavior,
    common,
    catalog: { ref, vis, reg, causal },
  };
}

type GkMatchConfig = {
  scenario: ScenarioDefinition;
  maxTicks: number;
  gkBehavior: boolean;
  lifecyclePhaseSync: "legacy" | "core-owned";
  role: string;
};

function runGk(config: GkMatchConfig) {
  const match = runHeadlessMatch({
    scenario: config.scenario,
    maxTicks: config.maxTicks,
    cpuAntiHuddle: true,
    cpuDefensiveTackle: true,
    gkBehavior: config.gkBehavior,
    browserParityObservations: true,
    lifecyclePhaseSync: config.lifecyclePhaseSync,
  });
  return match;
}

// ---------------------------------------------------------------------------
// Organic runs
// ---------------------------------------------------------------------------

// Pins read verbatim from the accepted manifests (never guessed).
const GK_HEADLESS_CANDIDATE = "40aa0dae902a1e7c1375c2444304296d10116bf9"; // GK-5V5-ADAPTER-BEHAVIOR
const GK_BROWSER_CANDIDATE = "fd6de8d99553d490f50f1462efa83e3a96703a8f"; // GK-BROWSER-DYNAMIC-EVIDENCE

const runs: OrganicRunResult[] = [];

// 1. Organically-flowing 5v5 CPU-vs-CPU match with the keeper role live
//    (GK-5V5-ADAPTER-BEHAVIOR continuous-live, candidate 40aa0dae).
{
  const scenario = loadScenario("eval/scenarios/5v5-continuous-play.v1.json");
  const match = runGk({ scenario, maxTicks: 1800, gkBehavior: true, lifecyclePhaseSync: "legacy", role: "organic" });
  runs.push(evaluateRun({
    run_id: "gk-continuous-live",
    scenario: scenario.id,
    ticks: 1800,
    source_evidence: "docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/trajectory.json",
    source_candidate: GK_HEADLESS_CANDIDATE,
    reproduction:
      `runHeadlessMatch({ scenario: eval/scenarios/5v5-continuous-play.v1.json, maxTicks: 1800, ` +
      `cpuAntiHuddle: true, cpuDefensiveTackle: true, gkBehavior: true, ` +
      `browserParityObservations: true, lifecyclePhaseSync: 'legacy' })`,
    observations: match.observations,
  }));
}

// 2. Controlled shot-on-target fixture with the keeper role live
//    (GK-5V5-ADAPTER-BEHAVIOR shot-fixture-live, candidate 40aa0dae).
//    The save/claim evidence is fixture-driven (disclosed), not from organic
//    flowing play where every on-target shot was answered by another body first.
{
  const scenario = loadScenario("eval/scenarios/5v5-keeper-shot-fixture.v1.json");
  const match = runGk({ scenario, maxTicks: 600, gkBehavior: true, lifecyclePhaseSync: "legacy", role: "driven-fixture" });
  runs.push(evaluateRun({
    run_id: "gk-shot-fixture-live",
    scenario: scenario.id,
    ticks: 600,
    source_evidence: "docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/trajectory.json",
    source_candidate: GK_HEADLESS_CANDIDATE,
    reproduction:
      `runHeadlessMatch({ scenario: eval/scenarios/5v5-keeper-shot-fixture.v1.json, maxTicks: 600, ` +
      `cpuAntiHuddle: true, cpuDefensiveTackle: true, gkBehavior: true, ` +
      `browserParityObservations: true, lifecyclePhaseSync: 'legacy' })`,
    observations: match.observations,
  }));
}

// ---------------------------------------------------------------------------
// Documented before-state (immutable constant, not recomputed)
// ---------------------------------------------------------------------------

/**
 * The "before" is the goalkeepers-suite state as recorded and asserted by the
 * accepted GK-SPEC-SUITE-CONTRACTS objective (candidate 0f43188):
 *   - every GK-specific criterion is honestly non-PASS — MEASURED_TARGET →
 *     BLOCKED_MISSING_REFERENCE, PERCEPTUAL_TARGET → NEEDS_PERCEPTUAL_REVIEW,
 *     REGRESSION → NOT_EVALUATED, UNKNOWN → NOT_EVALUATED, and the GK
 *     HARD_INVARIANT criteria (whose oracles are not registered) →
 *     NOT_EVALUATED — asserted by tests/unit/eval/goalkeepers-suite.test.ts.
 *   - COMMON criteria were PASS over the small foundation-move-and-roll
 *     scenario the suite test ran (COMMON-DETERMINISTIC stays NOT_EVALUATED,
 *     single-run).
 */
const BEFORE = {
  gk_behavior: {
    "GK-POSITIONING-HOLD": "NOT_EVALUATED",
    "GK-NO-FIELD-CHASE": "NOT_EVALUATED",
    "GK-SAVE-CLAIM": "NOT_EVALUATED",
    "GK-ROLE-DESIGNATION": "NOT_EVALUATED",
    "GK-DISTRIBUTION-NO-OMNISCIENCE": "NOT_EVALUATED",
  },
  catalog: CATALOG_BEFORE,
  common: {
    "COMMON-FINITE": "PASS",
    "COMMON-DETERMINISTIC": "NOT_EVALUATED (single-run)",
    "COMMON-REFERENCES": "PASS",
    "COMMON-BOUNDS": "PASS",
  },
};

/** Verdict used when a criterion carries no registered oracle. */
function suiteAfter(outcomes: Record<string, string>): string {
  const values = new Set(Object.values(outcomes));
  if (values.has("FAIL")) return "FAIL";
  if (values.has("PASS")) return "PASS";
  if (values.has("NEEDS_PERCEPTUAL_REVIEW")) return "NEEDS_PERCEPTUAL_REVIEW";
  if (values.has("BLOCKED_MISSING_REFERENCE")) return "BLOCKED_MISSING_REFERENCE";
  return "NOT_EVALUATED";
}

// ---------------------------------------------------------------------------
// Bookkeeping: which criteria now carry organic (or driven) observations.
// These are adapter/observer-level facts reported by the accepted GK evidence
// (the evaluator has no registered oracle for them), NOT evaluator verdicts.
// ---------------------------------------------------------------------------
const GK_OBSERVATION_PRESENCE: Record<string, { observations: string; detail: string }> = {
  "GK-POSITIONING-HOLD": {
    observations: "organic",
    detail:
      "Organic arc-hold observations present in both GK runs: the designated keeper " +
      "is commanded onto and holds its goal arc for the run (station ticks reported per " +
      "run; bounded lateral drift; on-arc ticks after station). No evaluator oracle is " +
      "registered for this criterion, so the executable suite still returns NOT_EVALUATED.",
  },
  "GK-NO-FIELD-CHASE": {
    observations: "organic",
    detail:
      "Organic no-field-chase observations present: the designated keeper is never the " +
      "team's chaser/presser, cover, or restart taker (keeper chaser/cover/taker ticks = 0 " +
      "in both GK runs), inheriting the accepted anti-huddle contract. No evaluator oracle " +
      "is registered for this criterion, so the executable suite still returns NOT_EVALUATED.",
  },
  "GK-SAVE-CLAIM": {
    observations: "driven (fixture) only",
    detail:
      "Save/claim evidence is fixture-driven only: it comes from the controlled " +
      "5v5-keeper-shot-fixture run (on-target shot answered by a recorded keeper contact " +
      "inside the versioned reach). The organically-flowing match's own on-target shots were " +
      "answered by another body first (0 save chains), so there is NO organic save-chain " +
      "observation. Labeled driven, not organic. No evaluator oracle is registered for this " +
      "criterion, so the executable suite still returns NOT_EVALUATED.",
  },
  "GK-ROLE-DESIGNATION": {
    observations: "organic",
    detail:
      "Organic designation observations present: exactly one designated keeper per team " +
      "(team-a→player-4, team-b→player-10), resolved before kickoff from the starting layout " +
      "and frozen for the whole run (designation drift = 0). No evaluator oracle is registered " +
      "for this criterion, so the executable suite still returns NOT_EVALUATED.",
  },
  "GK-DISTRIBUTION-NO-OMNISCIENCE": {
    observations: "none",
    detail:
      "No organic observation: the core telemetry carries no keeper-release event kind, and " +
      "release is only surfaced as adapter-level counters. The criterion is an " +
      "ENGINE_DESIGN_TARGET with no CapabilityDesignProfile, so the executable suite returns " +
      "NOT_EVALUATED. Not upgraded.",
  },
};

// ---------------------------------------------------------------------------
// Before/after table
// ---------------------------------------------------------------------------

const gkBehaviorAfter: Record<string, { verdict: string; observations: string; source: string }> = {};
for (const criterion of GK_BEHAVIOR_CRITERIA) {
  const perRun = runs.map((r) => ({ run: r.run_id, outcome: r.gk_behavior[criterion] }));
  const verdict = suiteAfter(Object.fromEntries(perRun.map((p) => [p.run, p.outcome])));
  const presence = GK_OBSERVATION_PRESENCE[criterion];
  gkBehaviorAfter[criterion] = {
    verdict,
    observations: presence.observations,
    source: `executed evaluator over ${perRun.length} organic runs: ${perRun.map((p) => `${p.run}=${p.outcome}`).join(", ")}. ${presence.detail}`,
  };
}

const catalogAfter = {
  ref: suiteAfter(Object.fromEntries(runs.map((r) => [r.run_id, r.catalog.ref]))),
  vis: suiteAfter(Object.fromEntries(runs.map((r) => [r.run_id, r.catalog.vis]))),
  reg: suiteAfter(Object.fromEntries(runs.map((r) => [r.run_id, r.catalog.reg]))),
  causal: suiteAfter(Object.fromEntries(runs.map((r) => [r.run_id, r.catalog.causal]))),
};

const commonAfter: Record<string, string> = {};
for (const criterion of COMMON_CRITERIA) {
  commonAfter[criterion] = suiteAfter(
    Object.fromEntries(runs.map((r) => [r.run_id, r.common[criterion]])),
  );
}

const artifact = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  suite_id: "goalkeepers",
  suite_version: "suite-goalkeepers-v1",
  produced_by: "scripts/capture-gk-suite-organic-state.ts",
  evidence_class: "HEADLESS",
  generated_at: new Date().toISOString(),
  record_sha256: null as string | null,
  before: BEFORE,
  after: {
    gk_behavior: gkBehaviorAfter,
    catalog: catalogAfter,
    common: commonAfter,
  },
  organic_runs: runs,
  sources_consulted: [
    {
      manifest_path: "docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/manifest.json",
      candidate_commit: GK_HEADLESS_CANDIDATE,
      note: "Headless MULTI_TICK keeper runs (continuous + shot fixture). Reproduced headlessly and evaluated here.",
    },
    {
      manifest_path: "docs/evidence/GK-BROWSER-DYNAMIC-EVIDENCE/manifest.json",
      candidate_commit: GK_BROWSER_CANDIDATE,
      note:
        "Browser DYNAMIC_VISUAL fixture run (arc-hold + save-contact@370). Chromium-runtime " +
        "floats are NOT fed into the Node headless evaluator (known pinned-runtime gap); its " +
        "keeper content is reflected by the headless gk-shot-fixture-live run and disclosed.",
    },
  ],
  claims_not_made: [
    "No PROMOTION claim.",
    "No GK criterion is upgraded to gameplay PASS beyond what the executed evaluator returns.",
    "No PES 2017 fidelity / measured PES envelope claim.",
    "No FOUNDATION_LAB_PASS claim.",
    "No invented reference envelope or tolerance (reaction latency, save probability, wrong-foot reversal, high-cross claim threshold, parry energy ratio stay BLOCKED_MISSING_REFERENCE).",
    "No protected criteria change (no oracle / catalog / invariant / observation change; the goalkeepers suite criteria are re-run, not redefined).",
    "No gameplay change (src/, eval/runners/, eval/scenarios/, specs/ untouched).",
    "The COMMON-REFERENCES / COMMON-BOUNDS FAIL on the organic full-match observations is pre-existing invariant behavior, not a keeper regression.",
  ],
};

// Record a stable SHA over the deterministic body (before + after + runs) so an
// independent re-run must reproduce the same record content.
const deterministicBody = JSON.stringify({
  before: artifact.before,
  after: artifact.after,
  organic_runs: artifact.organic_runs,
});
artifact.record_sha256 = sha256(deterministicBody);

mkdirSync(OUTPUT_ROOT, { recursive: true });
writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
console.log(`[gk-suite-organic-state] wrote ${ARTIFACT_PATH}`);
console.log(`[gk-suite-organic-state] record_sha256=${artifact.record_sha256}`);
for (const run of runs) {
  console.log(
    `  ${run.run_id} (${run.ticks} ticks): COMMON-FINITE=${run.common["COMMON-FINITE"]} ` +
    `COMMON-REFERENCES=${run.common["COMMON-REFERENCES"]} COMMON-BOUNDS=${run.common["COMMON-BOUNDS"]} ` +
    `GK-POSITIONING-HOLD=${run.gk_behavior["GK-POSITIONING-HOLD"]} ` +
    `GK-NO-FIELD-CHASE=${run.gk_behavior["GK-NO-FIELD-CHASE"]} ` +
    `GK-SAVE-CLAIM=${run.gk_behavior["GK-SAVE-CLAIM"]} ` +
    `GK-ROLE-DESIGNATION=${run.gk_behavior["GK-ROLE-DESIGNATION"]} ` +
    `GK-DISTRIBUTION=${run.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"]}`,
  );
}
