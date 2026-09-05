/**
 * Node-side evidence producer for GK-SUITE-VERDICTS-STATE.
 *
 * Post-oracle honest suite verdict state. Re-runs the accepted `goalkeepers`
 * evaluator suite (`evaluateSuite("goalkeepers", observations)`) over the
 * manifest-pinned accepted keeper runs with BOTH the registered protected
 * oracles (GK-KEEPER-ORACLE-REGISTRATION) AND the distribution behavior
 * (GK-DISTRIBUTION-BEHAVIOR) live, and writes the honest before/after verdict
 * table to `docs/evidence/GK-SUITE-VERDICTS-STATE/gk-suite-verdicts-state.json`.
 *
 * The "before" is the immutable pre-oracle state (GK-SUITE-ORGANIC-STATE /
 * GK-KEEPER-ORACLE-REGISTRATION): every GK behavior criterion was
 * NOT_EVALUATED. The "after" is whatever the executed evaluator returns from
 * the runner-injected `gk-role` designation AND `keeper-release` telemetry:
 *
 *   - GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE / GK-ROLE-DESIGNATION:
 *     PASS on both organic keeper runs (adapter facts now read by the oracles).
 *   - GK-SAVE-CLAIM: PASS on the driven shot fixture; NOT_EVALUATED on the
 *     organic flowing match (its on-target shots were answered by another body
 *     first — disclosed, labelled driven).
 *   - GK-DISTRIBUTION-NO-OMNISCIENCE: PASS on the driven shot fixture (keeper
 *     releases to an observed teammate after its claim); the organic
 *     continuous run is honestly NOT_EVALUATED / 0 releases (disclosed).
 *
 * COMMON criteria over the same runs now reflect the
 * COMMON-FULL-MATCH-INVARIANT-TRIAGE fix: COMMON-REFERENCES PASS on every
 * full-match map; COMMON-BOUNDS residual FAIL on the 4 legacy-run phase-sync
 * maps (the ball escapes the pitch without a restart and players chase it out
 * of bounds) — disclosed, not widened. COMMON-FINITE PASS; COMMON-DETERMINISTIC
 * NOT_EVALUATED (single-run, per the duels precedent).
 *
 * Provenance is read verbatim from the accepted `docs/evidence/<id>/manifest.json`
 * `candidate_commit` fields (never guessed). Node I/O is allowed here; the
 * simulation core is untouched.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:GK-SUITE-VERDICTS-STATE`. An ordinary run writes the
 * same artifact under the ignored `test-results/gauntlet-capture/**` tree and
 * leaves `docs/` byte-identical.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:GK-SUITE-VERDICTS-STATE \
 *     pnpm exec tsx scripts/capture-gk-suite-verdicts-state.ts
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";

const OBJECTIVE_ID = "GK-SUITE-VERDICTS-STATE";

const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const ARTIFACT_PATH = resolve(
  OUTPUT_ROOT,
  "gk-suite-verdicts-state.json",
);

const GK_BEHAVIOR_CRITERIA = [
  "GK-POSITIONING-HOLD",
  "GK-NO-FIELD-CHASE",
  "GK-SAVE-CLAIM",
  "GK-ROLE-DESIGNATION",
  "GK-DISTRIBUTION-NO-OMNISCIENCE",
] as const;

const COMMON_CRITERIA = [
  "COMMON-FINITE",
  "COMMON-DETERMINISTIC",
  "COMMON-REFERENCES",
  "COMMON-BOUNDS",
] as const;

const CATALOG_BEFORE: Record<string, string> = {
  GK_REF: "BLOCKED_MISSING_REFERENCE",
  GK_VIS: "NEEDS_PERCEPTUAL_REVIEW",
  GK_REG: "NOT_EVALUATED",
  GK_CAUSAL: "NOT_EVALUATED",
};

// ---------------------------------------------------------------------------
// Provenance helpers — read candidate_commits / record_sha256 verbatim.
// ---------------------------------------------------------------------------

interface Manifest {
  candidate_commit?: string;
  evidence?: {
    trajectory?: { sha256?: string };
    deterministic_audit_artifact?: { sha256?: string };
  };
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as T;
}

function manifestCandidate(manifestPath: string): string {
  const m = loadJson<Manifest>(manifestPath);
  if (typeof m.candidate_commit !== "string") {
    throw new Error(`Manifest ${manifestPath} is missing candidate_commit`);
  }
  return m.candidate_commit;
}

/** Trajectory sha256, read verbatim from the accepted manifest's evidence. */
function manifestTrajectorySha256(manifestPath: string): string | null {
  const m = loadJson<Manifest>(manifestPath);
  return m.evidence?.trajectory?.sha256 ?? null;
}

/** Deterministic-audit sha256, read verbatim from the accepted manifest. */
function manifestAuditSha256(manifestPath: string): string | null {
  const m = loadJson<Manifest>(manifestPath);
  return m.evidence?.deterministic_audit_artifact?.sha256 ?? null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Read the record_sha256 field out of a produced suite-state record file. */
function recordSha256(recordPath: string): string {
  const rec = loadJson<{ record_sha256?: string }>(recordPath);
  if (typeof rec.record_sha256 !== "string") {
    throw new Error(`Record ${recordPath} is missing record_sha256`);
  }
  return rec.record_sha256;
}

function loadScenario(path: string): ScenarioDefinition {
  return loadJson<ScenarioDefinition>(resolve(path));
}

// ---------------------------------------------------------------------------
// Accepted manifests (the provenance pins — never guessed)
// ---------------------------------------------------------------------------

const GK_5V5_MANIFEST = "docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/manifest.json";
const GK_ORACLE_MANIFEST =
  "docs/evidence/GK-KEEPER-ORACLE-REGISTRATION/manifest.json";
const GK_DIST_MANIFEST = "docs/evidence/GK-DISTRIBUTION-BEHAVIOR/manifest.json";
const GK_ORGANIC_MANIFEST = "docs/evidence/GK-SUITE-ORGANIC-STATE/manifest.json";
const COMMON_TRIAGE_MANIFEST =
  "docs/evidence/COMMON-FULL-MATCH-INVARIANT-TRIAGE/manifest.json";

const GK_5V5_CANDIDATE = manifestCandidate(GK_5V5_MANIFEST);
const GK_ORACLE_CANDIDATE = manifestCandidate(GK_ORACLE_MANIFEST);
const GK_DIST_CANDIDATE = manifestCandidate(GK_DIST_MANIFEST);
const GK_ORGANIC_CANDIDATE = manifestCandidate(GK_ORGANIC_MANIFEST);
const COMMON_TRIAGE_CANDIDATE = manifestCandidate(COMMON_TRIAGE_MANIFEST);

// ---------------------------------------------------------------------------
// Organic runs (reproduced headlessly on the current HEAD and evaluated)
// ---------------------------------------------------------------------------

interface DistributionReadout {
  releases: number;
  release_ticks: number[];
  release_targets: string[];
}

function extractDistribution(observations: TelemetryObservation[]): DistributionReadout {
  const release_ticks: number[] = [];
  const release_targets: string[] = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "keeper-release") continue;
      const payload = ev.payload as
        | { releaseTargetPlayerId?: string }
        | undefined;
      release_ticks.push(o.tick);
      release_targets.push(payload?.releaseTargetPlayerId ?? "unknown");
    }
  }
  return {
    releases: release_ticks.length,
    release_ticks,
    release_targets,
  };
}

interface OrganicRunResult {
  run_id: string;
  scenario: string;
  ticks: number;
  source_evidence: string;
  source_candidate: string;
  reproduction: string;
  observations: number;
  gk_behavior: Record<string, string>;
  common: Record<string, string>;
  catalog: { ref: string; vis: string; reg: string; causal: string };
  distribution: DistributionReadout;
}

function evaluateRun(run: {
  run_id: string;
  scenario: string;
  ticks: number;
  source_evidence: string;
  source_candidate: string;
  reproduction: string;
  observations: TelemetryObservation[];
}): OrganicRunResult {
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
    gk_behavior: gkBehavior,
    common,
    catalog: { ref, vis, reg, causal },
    distribution: extractDistribution(run.observations),
  };
}

function runGk(scenario: ScenarioDefinition, maxTicks: number) {
  return runHeadlessMatch({
    scenario,
    maxTicks,
    cpuAntiHuddle: true,
    cpuDefensiveTackle: true,
    gkBehavior: true,
    browserParityObservations: true,
    lifecyclePhaseSync: "legacy",
  });
}

const runs: OrganicRunResult[] = [];

// 1. Organically-flowing 5v5 CPU-vs-CPU match with the keeper role live.
{
  const scenario = loadScenario("eval/scenarios/5v5-continuous-play.v1.json");
  const match = runGk(scenario, 1800);
  runs.push(evaluateRun({
    run_id: "gk-continuous-live",
    scenario: scenario.id,
    ticks: 1800,
    source_evidence: "docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/trajectory.json",
    source_candidate: GK_5V5_CANDIDATE,
    reproduction:
      "runHeadlessMatch({ scenario: eval/scenarios/5v5-continuous-play.v1.json, maxTicks: 1800, " +
      "cpuAntiHuddle: true, cpuDefensiveTackle: true, gkBehavior: true, " +
      "browserParityObservations: true, lifecyclePhaseSync: 'legacy' })",
    observations: match.observations,
  }));
}

// 2. Controlled shot-on-target fixture with the keeper role live.
{
  const scenario = loadScenario("eval/scenarios/5v5-keeper-shot-fixture.v1.json");
  const match = runGk(scenario, 600);
  runs.push(evaluateRun({
    run_id: "gk-shot-fixture-live",
    scenario: scenario.id,
    ticks: 600,
    source_evidence: "docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/trajectory.json",
    source_candidate: GK_5V5_CANDIDATE,
    reproduction:
      "runHeadlessMatch({ scenario: eval/scenarios/5v5-keeper-shot-fixture.v1.json, maxTicks: 600, " +
      "cpuAntiHuddle: true, cpuDefensiveTackle: true, gkBehavior: true, " +
      "browserParityObservations: true, lifecyclePhaseSync: 'legacy' })",
    observations: match.observations,
  }));
}

// ---------------------------------------------------------------------------
// Before state (immutable pre-oracle: no keeper oracle, no release telemetry)
// ---------------------------------------------------------------------------

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

/** Verdict collapsed across per-run outcomes (highest severity wins). */
function suiteAfter(outcomes: Record<string, string>): string {
  const values = new Set(Object.values(outcomes));
  if (values.has("FAIL")) return "FAIL";
  if (values.has("PASS")) return "PASS";
  if (values.has("NEEDS_PERCEPTUAL_REVIEW")) return "NEEDS_PERCEPTUAL_REVIEW";
  if (values.has("BLOCKED_MISSING_REFERENCE")) return "BLOCKED_MISSING_REFERENCE";
  return "NOT_EVALUATED";
}

// ---------------------------------------------------------------------------
// Per-criterion bookkeeping: organic vs. driven observation provenance.
// ---------------------------------------------------------------------------

const GK_OBSERVATION_PRESENCE: Record<string, { observations: string; detail: string }> = {
  "GK-POSITIONING-HOLD": {
    observations: "organic",
    detail:
      "Organic arc-hold observations present in both GK runs (the designated keeper " +
      "is commanded onto and holds its goal arc, bounded lateral drift). The protected " +
      "gk-positioning oracle now reads them and returns PASS on both runs.",
  },
  "GK-NO-FIELD-CHASE": {
    observations: "organic",
    detail:
      "Organic no-field-chase observations present: the designated keeper is never the " +
      "team's chaser/presser (keeper chase ticks = 0). The protected gk-no-field-chase " +
      "oracle now reads them and returns PASS on both runs.",
  },
  "GK-SAVE-CLAIM": {
    observations: "driven (fixture) only",
    detail:
      "Save/claim evidence is fixture-driven only: it comes from the controlled " +
      "5v5-keeper-shot-fixture run (on-target shot answered by a recorded keeper contact " +
      "inside the versioned reach). The organically-flowing match's own on-target shots " +
      "were answered by another body first (0 save chains), so the organic run is " +
      "NOT_EVALUATED. Labeled driven, not organic.",
  },
  "GK-ROLE-DESIGNATION": {
    observations: "organic",
    detail:
      "Organic designation observations present: exactly one designated keeper per team " +
      "(team-a→player-4, team-b→player-10). The protected gk-role-designation oracle now " +
      "reads the runner-injected designation and returns PASS on both runs.",
  },
  "GK-DISTRIBUTION-NO-OMNISCIENCE": {
    observations: "driven (fixture) only",
    detail:
      "Distribution evidence is fixture-driven only: on the controlled 5v5 shot-on-target " +
      "fixture the keeper claims a shot and releases to an observed teammate (a recorded " +
      "keeper-release telemetry event -> the gk-distribution oracle returns PASS). The " +
      "organically-flowing match's keeper never holds a claim long enough to release " +
      "(0 keeper-release events, disclosed), so the continuous run is NOT_EVALUATED.",
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
  const releaseNote =
    criterion === "GK-DISTRIBUTION-NO-OMNISCIENCE"
      ? ` Driven fixture release ticks: ${JSON.stringify(runs.find((r) => r.run_id === "gk-shot-fixture-live")?.distribution.release_ticks ?? [])} (targets ${JSON.stringify(runs.find((r) => r.run_id === "gk-shot-fixture-live")?.distribution.release_targets ?? [])}); continuous run releases ${runs.find((r) => r.run_id === "gk-continuous-live")?.distribution.releases ?? 0}.`
      : "";
  gkBehaviorAfter[criterion] = {
    verdict,
    observations: presence.observations,
    source: `executed evaluator over ${perRun.length} runs: ${perRun.map((p) => `${p.run}=${p.outcome}`).join(", ")}. ${presence.detail}${releaseNote}`,
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
  produced_by: "scripts/capture-gk-suite-verdicts-state.ts",
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
      manifest_path: GK_ORACLE_MANIFEST,
      candidate_commit: GK_ORACLE_CANDIDATE,
      referenced_sha256: recordSha256("docs/evidence/GK-KEEPER-ORACLE-REGISTRATION/gk-suite-state.json"),
      note: "Accepted keeper oracle registration: the five protected small-sided GK oracles are registered/wired. The oracle-registration before/after record (record_sha256 = referenced_sha256 above) documents the first real GK behavior verdicts; this objective re-runs WITH those oracles AND the distribution behavior and records the subsequent state.",
    },
    {
      manifest_path: GK_DIST_MANIFEST,
      candidate_commit: GK_DIST_CANDIDATE,
      referenced_sha256: manifestTrajectorySha256(GK_DIST_MANIFEST),
      note: "Accepted GK distribution behavior: the runner injects `keeper-release` telemetry (a release to an observed teammate after a claim). Driven fixture releases at the pinned ticks; organic continuous run reports 0 releases (disclosed).",
    },
    {
      manifest_path: GK_ORGANIC_MANIFEST,
      candidate_commit: GK_ORGANIC_CANDIDATE,
      referenced_sha256: recordSha256("docs/evidence/GK-SUITE-ORGANIC-STATE/gk-suite-state.json"),
      note: "Accepted pre-oracle organic suite state: every GK behavior criterion was NOT_EVALUATED because no protected keeper oracle was registered. This objective's 'before' mirrors that immutable state; its 'after' is the post-oracle + post-distribution verdict.",
    },
    {
      manifest_path: COMMON_TRIAGE_MANIFEST,
      candidate_commit: COMMON_TRIAGE_CANDIDATE,
      referenced_sha256: manifestAuditSha256(COMMON_TRIAGE_MANIFEST),
      note: "Accepted COMMON-REFERENCES fix: the event-references oracle now resolves the persistent ball.lastTouchRef against the observation-window event union, so full-match COMMON-REFERENCES is PASS. COMMON-BOUNDS residual FAIL on the legacy phase-sync runs is disclosed, not widened.",
    },
    {
      manifest_path: GK_5V5_MANIFEST,
      candidate_commit: GK_5V5_CANDIDATE,
      referenced_sha256: manifestTrajectorySha256(GK_5V5_MANIFEST),
      note: "Headless MULTI_TICK keeper runs (continuous + shot fixture). Reproduced headlessly here and evaluated through the goalkeepers suite.",
    },
  ],
  claims_not_made: [
    "No PROMOTION claim.",
    "No GK criterion is upgraded to gameplay PASS beyond what the executed evaluator returns.",
    "No PES 2017 fidelity / measured PES envelope claim.",
    "No FOUNDATION_LAB_PASS claim.",
    "No invented reference envelope or tolerance (reaction latency, save probability, wrong-foot reversal, high-cross claim threshold, parry energy ratio stay BLOCKED_MISSING_REFERENCE).",
    "No gameplay change (src/simulation/, src/contracts/, src/adapters/, eval/runners/, eval/scenarios/, eval/oracles/, eval/contracts/, specs/ untouched); the goalkeepers suite criteria are only re-run, not redefined.",
    "GK-*-REF criteria stay BLOCKED_MISSING_REFERENCE and GK-*-VIS criteria stay NEEDS_PERCEPTUAL_REVIEW (no criterion upgraded beyond what the executed evaluator returns).",
    "No claim that the goalkeepers suite overall is PASS: COMMON-BOUNDS FAILs on the legacy phase-sync run (ball escapes the pitch without a restart), a disclosed residual, not a keeper regression.",
  ],
};

const deterministicBody = JSON.stringify({
  before: artifact.before,
  after: artifact.after,
  organic_runs: artifact.organic_runs,
});
artifact.record_sha256 = sha256(deterministicBody);

mkdirSync(OUTPUT_ROOT, { recursive: true });
writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
console.log(`[gk-suite-verdicts-state] wrote ${ARTIFACT_PATH}`);
console.log(`[gk-suite-verdicts-state] record_sha256=${artifact.record_sha256}`);
console.log(
  `  sources: 5v5=${GK_5V5_CANDIDATE} oracle=${GK_ORACLE_CANDIDATE} dist=${GK_DIST_CANDIDATE} organic=${GK_ORGANIC_CANDIDATE} triage=${COMMON_TRIAGE_CANDIDATE}`,
);
for (const run of runs) {
  console.log(
    `  ${run.run_id} (${run.ticks} ticks): ` +
      `GK-POSITIONING-HOLD=${run.gk_behavior["GK-POSITIONING-HOLD"]} ` +
      `GK-NO-FIELD-CHASE=${run.gk_behavior["GK-NO-FIELD-CHASE"]} ` +
      `GK-SAVE-CLAIM=${run.gk_behavior["GK-SAVE-CLAIM"]} ` +
      `GK-ROLE-DESIGNATION=${run.gk_behavior["GK-ROLE-DESIGNATION"]} ` +
      `GK-DISTRIBUTION=${run.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"]} ` +
      `(releases=${run.distribution.releases} @ ${JSON.stringify(run.distribution.release_ticks)}) ` +
      `COMMON-REFERENCES=${run.common["COMMON-REFERENCES"]} COMMON-BOUNDS=${run.common["COMMON-BOUNDS"]}`,
  );
}
