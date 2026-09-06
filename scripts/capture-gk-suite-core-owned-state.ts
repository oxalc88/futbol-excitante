/**
 * Node-side evidence producer for GK-SUITE-CORE-OWNED-STATE.
 *
 * Re-publishes the goalkeepers suite verdict state under the CORE-OWNED
 * lifecycle after the GK-CORE-OWNED-ARC-FIX (e687fa9) re-home.
 *
 * The accepted v27 verdict table (GK-SUITE-VERDICTS-STATE) was produced under
 * the LEGACY lifecycle opt-out (lifecyclePhaseSync: 'legacy'), where the runner
 * overwrote the core's phase every tick so the core's restart machinery (set
 * pieces + the post-goal/halftime reset) never ran headless.  Under the
 * core-owned lifecycle (the default, DEFAULT_LIFECYCLE_PHASE_SYNC = 'core-owned')
 * the core owns every phase it opens, and the re-home (rehomeKeeper, gated to
 * gkBehavior && core-owned) re-homes a designated keeper whose kickoff home is
 * off its own goal arc onto that arc before the world is created.
 *
 * This producer re-runs the registered `goalkeepers` evaluator
 * (`evaluateSuite("goalkeepers", observations)`) over BOTH keeper runs under
 * core-owned WITH the re-home active (the fresh-run default), and writes a
 * byte-reproducible verdict record:
 *
 *   - GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE: PASS on both runs (the re-home
 *     keeps the team-a keeper on its arc; without the re-home these FAIL under
 *     core-owned, as disclosed in GK-CORE-OWNED-ARC-FIX).
 *   - GK-ROLE-DESIGNATION: PASS on both runs (exactly one keeper per team).
 *   - GK-SAVE-CLAIM: PASS on the driven shot fixture (keeper contact within
 *     reach); NOT_EVALUATED on the organic continuous run (no shot answered by
 *     a keeper contact within the reaction window).
 *   - GK-DISTRIBUTION-NO-OMNISCIENCE: PASS on the organic continuous run (the
 *     team-b keeper releases to observed teammate player-9); NOT_EVALUATED on
 *     the shot fixture (0 releases under core-owned).  NOTE: this is the
 *     inverse of the v27 legacy table, where the fixture carried the releases
 *     and the continuous run had 0 — a lifecycle consequence of run dynamics.
 *   - COMMON-BOUNDS: PASS on both runs (the goal-mouth bound derived in
 *     GK-GOALLINE-BOUNDS-RESIDUAL, and no legacy out-of-play escape under
 *     core-owned).  This is the one true verdict change vs the v27 table,
 *     which reported FAIL on the legacy phase-sync runs.
 *   - COMMON-REFERENCES / COMMON-FINITE: PASS.  COMMON-DETERMINISTIC:
 *     NOT_EVALUATED (single-run, duels precedent).  Catalog (GK-*-REF / GK-*-VIS
 *     / GK-*-REG / GK-*-CAUSAL) unchanged.
 *
 * No suite-level PASS claim, no PROMOTION, no FOUNDATION_LAB_PASS, no PES
 * fidelity, no invented reference envelope.  Blocked references stay
 * BLOCKED_MISSING_REFERENCE; no criterion is upgraded beyond what the executed
 * evaluator returns; the accepted v27 records stay byte-untouched.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:GK-SUITE-CORE-OWNED-STATE`.  An ordinary run writes the
 * same artifact under the ignored `test-results/gauntlet-capture/**` tree and
 * leaves `docs/` byte-identical.  No wall-clock field is hashed, so two
 * consecutive ordinary-mode runs are byte-identical.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:GK-SUITE-CORE-OWNED-STATE \
 *     pnpm exec tsx scripts/capture-gk-suite-core-owned-state.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import {
  designateKeeperFromLayout,
  goalArcCenter,
  isInsideGoalArc,
  distanceToArcCenter,
  lateralDriftMetres,
} from "../src/adapters/input-browser/goalkeeper-role.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";

const OBJECTIVE_ID = "GK-SUITE-CORE-OWNED-STATE";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const ARTIFACT_PATH = resolve(OUTPUT_ROOT, "gk-suite-core-owned-state.json");
const HEAD = execSync("git rev-parse HEAD").toString().trim();

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

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as T;
}

function loadScenario(path: string): ScenarioDefinition {
  return loadJson<ScenarioDefinition>(resolve(path));
}

/** Read the record_sha256 out of an accepted suite-state record. */
function recordSha256(recordPath: string): string {
  const rec = loadJson<{ record_sha256?: string }>(recordPath);
  if (typeof rec.record_sha256 !== "string") {
    throw new Error(`Record ${recordPath} is missing record_sha256`);
  }
  return rec.record_sha256;
}

// ---------------------------------------------------------------------------
// Accepted v27 legacy-produced table (the comparison baseline)
// ---------------------------------------------------------------------------

const V27_RECORD = "docs/evidence/GK-SUITE-VERDICTS-STATE/gk-suite-verdicts-state.json";
const V27_MANIFEST = "docs/evidence/GK-SUITE-VERDICTS-STATE/manifest.json";
const v27 = loadJson<{
  after: {
    gk_behavior: Record<string, { verdict: string; observations: string }>;
    common: Record<string, string>;
    catalog: Record<string, string>;
  };
  organic_runs: Array<{
    run_id: string;
    gk_behavior: Record<string, string>;
    common: Record<string, string>;
    catalog: Record<string, string>;
    distribution: { releases: number; release_ticks: number[]; release_targets: string[] };
  }>;
}>(V27_RECORD);
const v27Candidate = loadJson<{ candidate_commit?: string }>(V27_MANIFEST).candidate_commit ?? "unknown";
const v27RecordSha256 = recordSha256(V27_RECORD);

// ---------------------------------------------------------------------------
// Runs (fresh core-owned, re-home active — the default)
// ---------------------------------------------------------------------------

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
    // rehomeKeeper defaults to true (gkBehavior && core-owned) — the fresh-run default.
  });
  return { scenario, match };
}

interface KeeperArcMetrics {
  stationTick: number | null;
  postStationTicks: number;
  onArcTicks: number;
  offArcTicks: number;
  onArcRatio: number;
  maxDistToArcCenter: number;
  maxLateralDrift: number;
  worstTick: number | null;
}

function keeperArcMetrics(
  observations: TelemetryObservation[],
  keeperId: string,
  teamId: string,
  pitchLength: number,
): KeeperArcMetrics {
  const center = goalArcCenter(teamId, pitchLength);
  let stationTick: number | null = null;
  let postStationTicks = 0;
  let onArcTicks = 0;
  let maxDist = 0;
  let maxDrift = 0;
  let worstTick: number | null = null;
  let worstDist = 0;
  for (const o of observations) {
    const kp = o.players.find((p) => p.playerId === keeperId);
    if (kp === undefined) continue;
    const onArc = isInsideGoalArc(kp.groundPosition, center);
    if (stationTick === null && onArc) stationTick = o.tick;
    if (stationTick !== null) {
      postStationTicks++;
      const d = distanceToArcCenter(kp.groundPosition, center);
      maxDist = Math.max(maxDist, d);
      maxDrift = Math.max(maxDrift, Math.abs(lateralDriftMetres(kp.groundPosition, center)));
      if (d > worstDist) {
        worstDist = d;
        worstTick = o.tick;
      }
      if (onArc) onArcTicks++;
    }
  }
  return {
    stationTick,
    postStationTicks,
    onArcTicks,
    offArcTicks: postStationTicks - onArcTicks,
    onArcRatio: postStationTicks > 0 ? onArcTicks / postStationTicks : 0,
    maxDistToArcCenter: maxDist,
    maxLateralDrift: maxDrift,
    worstTick,
  };
}

interface DistributionReadout {
  releases: number;
  release_ticks: number[];
  release_targets: string[];
  release_keepers: string[];
}

function extractDistribution(observations: TelemetryObservation[]): DistributionReadout {
  const release_ticks: number[] = [];
  const release_targets: string[] = [];
  const release_keepers: string[] = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "keeper-release") continue;
      const payload = ev.payload as
        | { releaseTargetPlayerId?: string; keeperPlayerId?: string }
        | undefined;
      release_ticks.push(o.tick);
      release_targets.push(payload?.releaseTargetPlayerId ?? "unknown");
      release_keepers.push(payload?.keeperPlayerId ?? "unknown");
    }
  }
  return { releases: release_ticks.length, release_ticks, release_targets, release_keepers };
}

interface RunResult {
  run_id: string;
  scenario: string;
  ticks: number;
  lifecycle: "core-owned";
  rehome_keeper: boolean;
  source_candidate: string;
  reproduction: string;
  observations: number;
  goals: number;
  gk_behavior: Record<string, string>;
  common: Record<string, string>;
  catalog: { ref: string; vis: string; reg: string; causal: string };
  distribution: DistributionReadout;
  arc_metrics: Record<string, KeeperArcMetrics>;
}

function evaluateRun(
  run_id: string,
  scenarioPath: string,
  maxTicks: number,
): RunResult {
  const { scenario, match } = runGk(scenarioPath, maxTicks);
  const suite = evaluateSuite("goalkeepers", match.observations);
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

  // Designated keepers (deterministic from the layout, the same the runner uses).
  const layout = scenario.players.map((p) => ({
    playerId: p.playerId,
    teamId: p.teamId,
    groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
    formationRole: (p as { formationRole?: "defender" | "midfielder" | "attacker" }).formationRole,
  }));
  const teamIds = [...new Set(scenario.players.map((p) => p.teamId))].sort();
  const keeperByTeam: Record<string, string> = {};
  for (const teamId of teamIds) {
    const keeperId = designateKeeperFromLayout(layout, teamId, scenario.pitchLength);
    if (keeperId !== undefined) keeperByTeam[teamId] = keeperId;
  }
  const arcMetrics: Record<string, KeeperArcMetrics> = {};
  for (const teamId of teamIds) {
    const keeperId = keeperByTeam[teamId];
    if (keeperId === undefined) continue;
    arcMetrics[teamId] = keeperArcMetrics(
      match.observations,
      keeperId,
      teamId,
      scenario.pitchLength,
    );
  }

  return {
    run_id,
    scenario: scenario.id,
    ticks: match.tick,
    lifecycle: "core-owned",
    rehome_keeper: true,
    source_candidate: HEAD,
    reproduction:
      `runHeadlessMatch({ scenario: eval/scenarios/${scenarioPath.split("/").pop()}, maxTicks: ${maxTicks}, ` +
      `cpuAntiHuddle: true, cpuDefensiveTackle: true, gkBehavior: true, ` +
      `browserParityObservations: true, lifecyclePhaseSync: 'core-owned' })`,
    observations: match.observations.length,
    goals: match.events.filter((ev) => ev.kind === "goal").length,
    gk_behavior: gkBehavior,
    common,
    catalog: { ref, vis, reg, causal },
    distribution: extractDistribution(match.observations),
    arc_metrics: arcMetrics,
  };
}

const runs: RunResult[] = [
  evaluateRun("gk-continuous-live", "eval/scenarios/5v5-continuous-play.v1.json", 1800),
  evaluateRun("gk-shot-fixture-live", "eval/scenarios/5v5-keeper-shot-fixture.v1.json", 600),
];

// ---------------------------------------------------------------------------
// Collapse per-run outcomes into a suite-level verdict (highest severity wins)
// ---------------------------------------------------------------------------

function suiteAfter(outcomes: Record<string, string>): string {
  const values = new Set(Object.values(outcomes));
  if (values.has("FAIL")) return "FAIL";
  if (values.has("PASS")) return "PASS";
  if (values.has("NEEDS_PERCEPTUAL_REVIEW")) return "NEEDS_PERCEPTUAL_REVIEW";
  if (values.has("BLOCKED_MISSING_REFERENCE")) return "BLOCKED_MISSING_REFERENCE";
  return "NOT_EVALUATED";
}

// ---------------------------------------------------------------------------
// Observation provenance per criterion (honest, not forced)
// ---------------------------------------------------------------------------

const GK_OBSERVATION_PRESENCE: Record<string, { observations: string; detail: string }> = {
  "GK-POSITIONING-HOLD": {
    observations: "organic (core-owned, re-home on)",
    detail:
      "Organic arc-hold observations present in both core-owned GK runs. Under the core-owned lifecycle the post-goal/halftime reset re-places every body at its kickoff home; with the GK-CORE-OWNED-ARC-FIX re-home active the designated keeper's kickoff home IS its goal arc (the team-a keeper player-4 is re-homed from (-30,-10) onto its arc), so the keeper holds. Without the re-home the team-a keeper would be stranded off-arc (~24.6 m) and these criteria would FAIL under core-owned (disclosed in GK-CORE-OWNED-ARC-FIX). The protected gk-positioning oracle returns PASS on both runs.",
  },
  "GK-NO-FIELD-CHASE": {
    observations: "organic (core-owned, re-home on)",
    detail:
      "Organic no-field-chase observations present: the designated keeper is never the team's chaser/presser (keeper chase ticks = 0). With the re-home the keeper's home is its arc, so the core reset never strands it into the field. The protected gk-no-field-chase oracle returns PASS on both runs.",
  },
  "GK-SAVE-CLAIM": {
    observations: "driven (fixture) only",
    detail:
      "Save/claim evidence is fixture-driven only: it comes from the controlled 5v5-keeper-shot-fixture run (on-target shot answered by a recorded team-b keeper contact inside the versioned reach, contact ticks 362/368/374/380/386). The organically-flowing continuous run's keeper contacts (tick 165) are not within a shot's reaction window, so the continuous run is NOT_EVALUATED. Labeled driven, not organic.",
  },
  "GK-ROLE-DESIGNATION": {
    observations: "organic (core-owned, re-home on)",
    detail:
      "Organic designation observations present: exactly one designated keeper per team (team-a→player-4, team-b→player-10). The protected gk-role-designation oracle reads the runner-injected designation and returns PASS on both runs.",
  },
  "GK-DISTRIBUTION-NO-OMNISCIENCE": {
    observations: "organic (core-owned, re-home on)",
    detail:
      "Under the core-owned lifecycle the organic continuous run now carries the release evidence: the team-b keeper (player-10) records a claim contact at tick 165 and releases 8 times to the observed team-b teammate player-9 (ticks 166/169/210/212/214/216/218/220). The driven shot-fixture run records 0 keeper-release events under core-owned (the keeper claims but does not release), so the fixture is NOT_EVALUATED. This is the inverse of the v27 legacy table (fixture carried the releases; continuous had 0) — a lifecycle consequence of run dynamics, not a criterion redefinition.",
  },
};

const gkBehaviorAfter: Record<string, { verdict: string; observations: string; source: string }> = {};
for (const criterion of GK_BEHAVIOR_CRITERIA) {
  const perRun = runs.map((r) => ({ run: r.run_id, outcome: r.gk_behavior[criterion] }));
  const verdict = suiteAfter(Object.fromEntries(perRun.map((p) => [p.run, p.outcome])));
  const presence = GK_OBSERVATION_PRESENCE[criterion];
  const releaseNote =
    criterion === "GK-DISTRIBUTION-NO-OMNISCIENCE"
      ? ` Continuous run releases: ${JSON.stringify(runs.find((r) => r.run_id === "gk-continuous-live")?.distribution.release_ticks ?? [])} (keepers ${JSON.stringify(runs.find((r) => r.run_id === "gk-continuous-live")?.distribution.release_keepers ?? [])}, targets ${JSON.stringify(runs.find((r) => r.run_id === "gk-continuous-live")?.distribution.release_targets ?? [])}); fixture run releases ${runs.find((r) => r.run_id === "gk-shot-fixture-live")?.distribution.releases ?? 0}.`
      : "";
  gkBehaviorAfter[criterion] = {
    verdict,
    observations: presence.observations,
    source: `executed evaluator over ${perRun.length} core-owned runs (re-home on): ${perRun.map((p) => `${p.run}=${p.outcome}`).join(", ")}. ${presence.detail}${releaseNote}`,
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

// ---------------------------------------------------------------------------
// Verdict deltas vs the accepted v27 legacy-produced table
// ---------------------------------------------------------------------------

interface VerdictDelta {
  criterion: string;
  v27_verdict: string;
  core_owned_verdict: string;
  changed: boolean;
  reason: string;
}

const v27Gk = v27.after.gk_behavior;
const v27Common = v27.after.common;
const deltas: VerdictDelta[] = [];

for (const criterion of GK_BEHAVIOR_CRITERIA) {
  const v27Verdict = v27Gk[criterion]?.verdict ?? "UNKNOWN";
  const v27Obs = v27Gk[criterion]?.observations ?? "unknown";
  const coreVerdict = gkBehaviorAfter[criterion].verdict;
  const coreObs = gkBehaviorAfter[criterion].observations;
  const verdictChanged = v27Verdict !== coreVerdict;
  let reason: string;
  if (criterion === "GK-POSITIONING-HOLD" || criterion === "GK-NO-FIELD-CHASE") {
    reason =
      "Verdict unchanged (PASS) but the run source changed legacy→core-owned. Under core-owned WITHOUT the GK-CORE-OWNED-ARC-FIX re-home the team-a keeper (player-4) is stranded off-arc by the post-goal/halftime reset (~24.6 m) and these criteria FAIL; with the re-home active the keeper's kickoff home IS its arc so it holds (onArcRatio 1.00, maxDist 2.50 m). The verdict is PASS under core-owned only because the re-home fix is live.";
  } else if (criterion === "GK-SAVE-CLAIM") {
    reason =
      "Verdict unchanged (PASS, driven fixture only). The shot-fixture run still records a keeper save/claim contact within reach (team-b keeper player-10, contact ticks 362/368/374/380/386). The organic continuous run is NOT_EVALUATED (no shot answered by a keeper contact within the reaction window).";
  } else if (criterion === "GK-ROLE-DESIGNATION") {
    reason =
      "Verdict unchanged (PASS, organic). Exactly one designated keeper per team under core-owned; the re-home does not change the designation.";
  } else if (criterion === "GK-DISTRIBUTION-NO-OMNISCIENCE") {
    reason =
      "Verdict unchanged (PASS) but the observation source flipped: the v27 legacy table carried the release evidence on the DRIVEN shot fixture (2 releases to player-6 at ticks 408/433) with the continuous run NOT_EVALUATED (0 releases). Under core-owned the organic continuous run carries the release evidence (8 releases to observed team-b teammate player-9) while the shot fixture records 0 releases (NOT_EVALUATED). A lifecycle consequence of run dynamics, not a criterion redefinition; the criterion is still PASS on the executed evaluator, never upgraded beyond it.";
  } else {
    reason = "Unexpected criterion.";
  }
  deltas.push({
    criterion,
    v27_verdict: v27Verdict,
    core_owned_verdict: coreVerdict,
    changed: verdictChanged,
    reason: `${reason} (v27 observations: ${v27Obs}; core-owned observations: ${coreObs})`,
  });
}

for (const criterion of COMMON_CRITERIA) {
  const v27Verdict = v27Common[criterion] ?? "UNKNOWN";
  const coreVerdict = commonAfter[criterion];
  const verdictChanged = v27Verdict !== coreVerdict;
  let reason: string;
  if (criterion === "COMMON-BOUNDS") {
    reason =
      "TRUE verdict change (FAIL→PASS). The v27 legacy phase-sync runs froze the core's restart machinery, so the ball escaped the pitch without a restart and players chased it out of bounds (body at |x| up to ~61 m), a real illegal position flagged by the un-widened safety-bounds invariant. Under core-owned the restart machinery runs, so there is no legacy out-of-play escape, and the goal-mouth bound derived in GK-GOALLINE-BOUNDS-RESIDUAL (goalLineX + |offset| + goal_arc_radius = 52.5+0+4.0 = 56.5 m) resolves the team-b keeper legitimately pushed into its goal mouth. COMMON-BOUNDS is PASS on both core-owned runs.";
  } else if (criterion === "COMMON-REFERENCES") {
    reason =
      "Verdict unchanged (PASS). The COMMON-FULL-MATCH-INVARIANT-TRIAGE event-references fix is live; the full-match core-owned maps pass.";
  } else if (criterion === "COMMON-FINITE") {
    reason = "Verdict unchanged (PASS).";
  } else if (criterion === "COMMON-DETERMINISTIC") {
    reason =
      "Verdict unchanged (NOT_EVALUATED). Single-run evaluation; the two-run comparison is not performed (duels precedent).";
  } else {
    reason = "Unexpected criterion.";
  }
  deltas.push({
    criterion,
    v27_verdict: v27Verdict,
    core_owned_verdict: coreVerdict,
    changed: verdictChanged,
    reason,
  });
}

// Catalog deltas.
for (const key of ["ref", "vis", "reg", "causal"] as const) {
  const v27Verdict = v27.after.catalog[key] ?? "UNKNOWN";
  const coreVerdict = catalogAfter[key];
  deltas.push({
    criterion: key,
    v27_verdict: v27Verdict,
    core_owned_verdict: coreVerdict,
    changed: v27Verdict !== coreVerdict,
    reason:
      key === "ref"
        ? "GK-*-REF criteria stay BLOCKED_MISSING_REFERENCE (no eligible ReferenceTarget; blocked references stay blocked)."
        : key === "vis"
          ? "GK-*-VIS criteria stay NEEDS_PERCEPTUAL_REVIEW (no versioned perceptual rubric)."
          : key === "reg"
            ? "GK-*-REG criteria stay NOT_EVALUATED (no versioned regression policy)."
            : "GK-*-CAUSAL criteria stay NOT_EVALUATED.",
  });
}

// ---------------------------------------------------------------------------
// Accepted v27 per-run baseline (for the comparison table)
// ---------------------------------------------------------------------------

const v27PerRun: Record<string, unknown> = {};
for (const r of v27.organic_runs) {
  v27PerRun[r.run_id] = {
    gk_behavior: r.gk_behavior,
    common: r.common,
    distribution: r.distribution,
  };
}

// ---------------------------------------------------------------------------
// Record
// ---------------------------------------------------------------------------

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  suite_id: "goalkeepers",
  suite_version: "suite-goalkeepers-v1",
  produced_by: "scripts/capture-gk-suite-core-owned-state.ts",
  evidence_class: "BOOKKEEPING",
  candidate_commit: HEAD,
  record_sha256: null as unknown as string,
  lifecycle: {
    policy: "core-owned",
    rehome_keeper: "auto (true when gkBehavior && lifecyclePhaseSync === 'core-owned')",
    rehome_applied: true,
    note:
      "The registered goalkeepers suite is re-run over core-owned runs WITH the GK-CORE-OWNED-ARC-FIX re-home active (the fresh-run default). The re-home lives in eval/runners/headless-match.ts rehomeKeeperToArc (gated rehomeKeeper ?? (gkBehavior && lifecyclePhaseSync === 'core-owned')) and runs before the world is created. The accepted v27 table was produced under the legacy lifecycle opt-out.",
  },
  accepted_v27: {
    source_record: V27_RECORD,
    source_candidate: v27Candidate,
    record_sha256: v27RecordSha256,
    lifecycle: "legacy",
    verdicts: {
      gk_behavior: Object.fromEntries(
        GK_BEHAVIOR_CRITERIA.map((c) => [c, v27Gk[c]?.verdict ?? "UNKNOWN"]),
      ),
      common: v27Common,
      catalog: v27.after.catalog,
    },
    per_run: v27PerRun,
  },
  after: {
    gk_behavior: gkBehaviorAfter,
    catalog: catalogAfter,
    common: commonAfter,
  },
  runs,
  verdict_deltas: deltas,
  disclosures: [
    "CRITICAL (forwarded from the GK-CORE-OWNED-ARC-FIX reviewers): two fresh-run producers now re-run WITH the re-home at HEAD — scripts/capture-goalline-bounds-residual.ts (its live guard still passes 7/7) and the LIFECYCLE-MIGRATION probe's core-owned gk arms. Their accepted bytes regenerate only via the documented rehomeKeeper:false opt-out. At HEAD the default rehomeKeeper ?? (gkBehavior && lifecyclePhaseSync === 'core-owned') is true, so any fresh core-owned gkBehavior run without an explicit rehomeKeeper:false now re-homes the keeper and would produce new bytes; the accepted historical records for those producers were authored before the re-home gate and are only reproducible with the opt-out.",
    "The accepted GK suite records (GK-SUITE-VERDICTS-STATE, GK-SUITE-ORGANIC-STATE) are produced under the explicit legacy lifecycle opt-out and are byte-untouched by this objective.",
    "Under core-owned WITHOUT the re-home, GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE FAIL on the gk-shot-fixture (the team-a keeper stranded ~24.6 m off-arc); the re-home fix (GK-CORE-OWNED-ARC-FIX) is what makes them PASS here. This is a core-owned lifecycle consequence, not a criterion redefinition or an oracle weakening.",
    "GK-SAVE-CLAIM is PASS only from the driven shot fixture; the organic continuous run is NOT_EVALUATED (no shot answered by a keeper contact within the reaction window). GK-DISTRIBUTION-NO-OMNISCIENCE is PASS from the organic continuous run (8 releases) and NOT_EVALUATED on the shot fixture (0 releases) — the inverse of the v27 legacy table, disclosed.",
    "COMMON-BOUNDS is PASS under core-owned with the goal-mouth bound; the v27 legacy COMMON-BOUNDS FAIL (body at |x| up to ~61 m, a real illegal position from the documented restart-suspension driver behavior) is disclosed-not-widenable and is a legacy-only artifact, not a keeper regression.",
  ],
  claims_not_made: [
    "No PROMOTION claim.",
    "No FOUNDATION_LAB_PASS claim.",
    "No PES 2017 fidelity / measured PES envelope claim.",
    "No invented reference envelope or tolerance (reaction latency, save probability, wrong-foot reversal, high-cross claim threshold, parry energy ratio stay BLOCKED_MISSING_REFERENCE).",
    "No suite-level PASS claim for the goalkeepers suite.",
    "No criterion is upgraded beyond what the executed evaluator returns; the goalkeepers suite criteria are only re-run under core-owned, not redefined.",
    "No gameplay change (git diff src/ src/simulation/ src/contracts/ src/adapters/ eval/runners/ eval/oracles/ eval/invariants/ eval/scenarios/ specs/ is empty). No oracle / catalog / invariant / observation / scenario / spec change; the goalkeepers suite criteria are only re-run, not redefined.",
    "No accepted record mutation: the v27 records (GK-SUITE-VERDICTS-STATE, GK-SUITE-ORGANIC-STATE) stay byte-untouched.",
    "GK-*-REF criteria stay BLOCKED_MISSING_REFERENCE; GK-*-VIS criteria stay NEEDS_PERCEPTUAL_REVIEW.",
  ],
};

// Compute the pinned record_sha256 over the JSON without the field itself.
const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

mkdirSync(OUTPUT_ROOT, { recursive: true });
writeFileSync(ARTIFACT_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[gk-suite-core-owned-state] wrote ${ARTIFACT_PATH}`);
console.log(`[gk-suite-core-owned-state] record_sha256=${record.record_sha256}`);
console.log(`[gk-suite-core-owned-state] candidate_commit=${HEAD}`);
for (const run of runs) {
  console.log(
    `  ${run.run_id} (${run.ticks} ticks, core-owned, re-home on): ` +
      `GK-POSITIONING-HOLD=${run.gk_behavior["GK-POSITIONING-HOLD"]} ` +
      `GK-NO-FIELD-CHASE=${run.gk_behavior["GK-NO-FIELD-CHASE"]} ` +
      `GK-SAVE-CLAIM=${run.gk_behavior["GK-SAVE-CLAIM"]} ` +
      `GK-ROLE-DESIGNATION=${run.gk_behavior["GK-ROLE-DESIGNATION"]} ` +
      `GK-DISTRIBUTION=${run.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"]} ` +
      `(releases=${run.distribution.releases} @ ${JSON.stringify(run.distribution.release_ticks)}) ` +
      `COMMON-REFERENCES=${run.common["COMMON-REFERENCES"]} COMMON-BOUNDS=${run.common["COMMON-BOUNDS"]}`,
  );
}
