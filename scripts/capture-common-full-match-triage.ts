/**
 * Node-side evidence producer for COMMON-FULL-MATCH-INVARIANT-TRIAGE.
 *
 * Re-runs the SAME full-match organic observations that the DUELS-SUITE-
 * ORGANIC-RERUN and GK-SUITE-ORGANIC-STATE producers used, and evaluates the
 * protected COMMON criteria (COMMON-REFERENCES, COMMON-BOUNDS, COMMON-FINITE)
 * through the registered oracle registry. It records, per run, the per-tick
 * oracle fail counts so the before/after of the COMMON-REFERENCES prior-tick
 * lastTouchRef fix is faithfully shown on real full-match observation maps.
 *
 * This is a FRESH capture, deliberately separate from the accepted
 * (immutability-locked) duels/gk suite records. It does NOT overwrite any
 * accepted evidence.
 *
 * Usage (each invocation reproduces the named run and writes a partial):
 *   pnpm exec tsx scripts/capture-common-full-match-triage.ts --run <run_id>
 *
 * Shard-friendly: each run is independent and writes its own partial file
 * under docs/evidence/COMMON-FULL-MATCH-INVARIANT-TRIAGE/runs/<run_id>.json.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import { executeOracle } from "../eval/oracles/oracle-registry.js";
import "../eval/oracles/wire.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";

const OBJECTIVE_ID = "COMMON-FULL-MATCH-INVARIANT-TRIAGE";
const EVIDENCE_DIR = resolve("docs/evidence", OBJECTIVE_ID);
const RUNS_DIR = resolve(EVIDENCE_DIR, "runs");

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

interface RunSpec {
  run_id: string;
  scenario_path: string;
  maxTicks: number;
  opts: Record<string, unknown>;
}

const RUNS: Record<string, { spec: RunSpec; reproduce: () => TelemetryObservation[] }> = {
  "anti-huddle-flowing": {
    spec: {
      run_id: "anti-huddle-flowing",
      scenario_path: "eval/scenarios/5v5-continuous-play.v1.json",
      maxTicks: 1800,
      opts: { cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true },
    },
    reproduce: null as never,
  },
  "ball-settled-flowing": {
    spec: {
      run_id: "ball-settled-flowing",
      scenario_path: "eval/scenarios/5v5-continuous-play.v1.json",
      maxTicks: 1200,
      opts: { cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true },
    },
    reproduce: null as never,
  },
  "restart-corner": {
    spec: {
      run_id: "restart-corner",
      scenario_path: "eval/scenarios/5v5-continuous-play.v1.json",
      maxTicks: 1800,
      opts: {
        cpuAntiHuddle: true,
        cpuDefensiveTackle: true,
        browserParityObservations: true,
        lifecyclePhaseSync: "core-owned",
      },
    },
    reproduce: null as never,
  },
  "restart-throwin": {
    spec: {
      run_id: "restart-throwin",
      scenario_path: "eval/scenarios/5v5-restart-throwin.v1.json",
      maxTicks: 1800,
      opts: {
        cpuAntiHuddle: true,
        cpuDefensiveTackle: true,
        browserParityObservations: true,
        lifecyclePhaseSync: "core-owned",
      },
    },
    reproduce: null as never,
  },
  "restart-goalkick-postgoal": {
    spec: {
      run_id: "restart-goalkick-postgoal",
      scenario_path: "eval/scenarios/5v5-restart-arc.v1.json",
      maxTicks: 1800,
      opts: {
        cpuAntiHuddle: true,
        cpuDefensiveTackle: true,
        browserParityObservations: true,
        lifecyclePhaseSync: "core-owned",
      },
    },
    reproduce: null as never,
  },
  "gk-continuous-live": {
    spec: {
      run_id: "gk-continuous-live",
      scenario_path: "eval/scenarios/5v5-continuous-play.v1.json",
      maxTicks: 1800,
      opts: {
        cpuAntiHuddle: true,
        cpuDefensiveTackle: true,
        browserParityObservations: true,
        gkBehavior: true,
        lifecyclePhaseSync: "legacy",
      },
    },
    reproduce: null as never,
  },
  "gk-shot-fixture-live": {
    spec: {
      run_id: "gk-shot-fixture-live",
      scenario_path: "eval/scenarios/5v5-keeper-shot-fixture.v1.json",
      maxTicks: 600,
      opts: {
        cpuAntiHuddle: true,
        cpuDefensiveTackle: true,
        browserParityObservations: true,
        gkBehavior: true,
        lifecyclePhaseSync: "legacy",
      },
    },
    reproduce: null as never,
  },
};

// Resolve the reproduce() closure for each run lazily.
for (const id of Object.keys(RUNS)) {
  const spec = RUNS[id].spec;
  RUNS[id].reproduce = () => runHeadlessMatch({
    scenario: loadScenario(spec.scenario_path),
    maxTicks: spec.maxTicks,
    ...spec.opts,
  } as never).observations;
}

// The human-duel run uses the defensive-duel driver, not runHeadlessMatch.
RUNS["human-duel"] = {
  spec: {
    run_id: "human-duel",
    scenario_path: "eval/scenarios/5v5-human-vs-cpu.v1.json",
    maxTicks: 120,
    opts: {
      cpuAntiHuddle: false,
      attempts: [
        { kind: "standing", commitDistance: 3.0, earliestTick: 30, lockoutFollowUpTicks: 3 },
        { kind: "slide", commitDistance: 4.0, earliestTick: 80 },
      ],
    },
  },
  reproduce: () => {
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
    return duel.observations;
  },
};

function evaluateCommon(observations: TelemetryObservation[]): {
  refsFail: number;
  boundsFail: number;
  finiteFail: number;
  observations: number;
  nonNullLastTouchRef: number;
  passRefs: boolean;
  passBounds: boolean;
  passFinite: boolean;
  maxPlayerAbsX: number;
  maxPlayerAbsY: number;
  maxBallAbsX: number;
} {
  const refs = executeOracle("event-references", "oracle-references-v1", observations);
  const bounds = executeOracle("bounds", "oracle-bounds-v1", observations);
  const finite = executeOracle("finite-number", "oracle-finite-v1", observations);

  let nonNullLastTouchRef = 0;
  let maxPlayerAbsX = 0;
  let maxPlayerAbsY = 0;
  let maxBallAbsX = 0;
  for (const o of observations) {
    if (o.ball.lastTouchRef !== null) nonNullLastTouchRef++;
    for (const p of o.players) {
      if (Math.abs(p.groundPosition.x) > maxPlayerAbsX) maxPlayerAbsX = Math.abs(p.groundPosition.x);
      if (Math.abs(p.groundPosition.y) > maxPlayerAbsY) maxPlayerAbsY = Math.abs(p.groundPosition.y);
    }
    if (Math.abs(o.ball.position.x) > maxBallAbsX) maxBallAbsX = Math.abs(o.ball.position.x);
  }

  const refsFail = refs.filter((r) => r.status === "fail").length;
  const boundsFail = bounds.filter((r) => r.status === "fail").length;
  const finiteFail = finite.filter((r) => r.status === "fail").length;

  return {
    refsFail,
    boundsFail,
    finiteFail,
    observations: observations.length,
    nonNullLastTouchRef,
    passRefs: refsFail === 0,
    passBounds: boundsFail === 0,
    passFinite: finiteFail === 0,
    maxPlayerAbsX,
    maxPlayerAbsY,
    maxBallAbsX,
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function main(): void {
  const eq = process.argv.find((a) => a.startsWith("--run="));
  const rawRunId = eq ? eq.split("=")[1] : process.argv[(process.argv.indexOf("--run") + 1)];
  const runId = rawRunId;
  if (!runId || !RUNS[runId]) {
    console.error("Provide --run <run_id>; valid:", Object.keys(RUNS).join(", "));
    process.exit(1);
  }

  const run = RUNS[runId];
  const observations = run.reproduce();
  const common = evaluateCommon(observations);

  const body = {
    run_id: runId,
    scenario_path: run.spec.scenario_path,
    maxTicks: run.spec.maxTicks,
    lifecyclePhaseSync: run.spec.opts.lifecyclePhaseSync ?? "legacy",
    gkBehavior: run.spec.opts.gkBehavior === true,
    observations: common.observations,
    nonNullLastTouchRef: common.nonNullLastTouchRef,
    common_criteria: {
      "COMMON-REFERENCES": common.passRefs ? "PASS" : "FAIL",
      "COMMON-BOUNDS": common.passBounds ? "PASS" : "FAIL",
      "COMMON-FINITE": common.passFinite ? "PASS" : "FAIL",
    },
    common_detail: {
      "COMMON-REFERENCES": { perTickFails: common.refsFail },
      "COMMON-BOUNDS": { perTickFails: common.boundsFail },
      "COMMON-FINITE": { perTickFails: common.finiteFail },
    },
    positions: {
      maxPlayerAbsX: common.maxPlayerAbsX,
      maxPlayerAbsY: common.maxPlayerAbsY,
      maxBallAbsX: common.maxBallAbsX,
      declared_maxX: 52.5,
      declared_maxY: 34,
    },
    record_sha256: null as string | null,
  };
  // SHA over the deterministic body (excluding the sha field itself).
  body.record_sha256 = sha256(JSON.stringify({ ...body, record_sha256: null }));

  mkdirSync(RUNS_DIR, { recursive: true });
  const outPath = resolve(RUNS_DIR, `${runId}.json`);
  writeFileSync(outPath, `${JSON.stringify(body, null, 2)}\n`, "utf-8");
  console.log(`[common-full-match-triage] wrote ${outPath}`);
  console.log(
    `  ${runId}: COMMON-REFERENCES=${body.common_criteria["COMMON-REFERENCES"]} ` +
      `(refsFail=${common.refsFail}) COMMON-BOUNDS=${body.common_criteria["COMMON-BOUNDS"]} ` +
      `(boundsFail=${common.boundsFail}) FINITE=${body.common_criteria["COMMON-FINITE"]}`,
  );
}

main();
