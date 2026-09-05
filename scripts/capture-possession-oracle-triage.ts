/**
 * Node-side evidence producer for POSSESSION-ORACLE-REFERENCE-TRIAGE.
 *
 * Re-runs the same full-match organic observation maps the accepted
 * COMMON-FULL-MATCH-INVARIANT-TRIAGE producer used, and evaluates the
 * protected `possession-evidence` oracle (oracle-possession-v1) over each map.
 *
 * It records, per run:
 *   - `before`: the per-tick orphan-ref resolution (the pre-fix behavior), which
 *     resolved `ball.lastTouchRef` only against the current observation's own
 *     per-tick events. On a full-match map most ticks carry a persistent
 *     lastTouchRef pointing at an earlier-tick touch, so the per-tick check
 *     false-fails broadly.
 *   - `after`: the window-union resolution (the fix), which resolves
 *     lastTouchRef against the union of every event emitted across the window
 *     (and still FAILs a reference that exists nowhere in the run).
 *   - `genuinelyInvalid`: how many observations carry a lastTouchRef absent
 *     from the window event union (the genuinely-broken case the oracle MUST
 *     still catch).
 *
 * This is a FRESH capture, deliberately separate from the accepted
 * (immutability-locked) evidence. It does NOT overwrite any accepted artifact.
 *
 * Usage (each invocation reproduces the named run and writes a partial):
 *   pnpm exec tsx scripts/capture-possession-oracle-triage.ts --run <run_id>
 *
 * Shard-friendly: each run is independent and writes its own partial file
 * under docs/evidence/POSSESSION-ORACLE-REFERENCE-TRIAGE/runs/<run_id>.json.
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import { executeOracle } from "../eval/oracles/oracle-registry.js";
import { checkPossessionEvidence } from "../eval/oracles/possession.js";
import "../eval/oracles/wire.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";

const OBJECTIVE_ID = "POSSESSION-ORACLE-REFERENCE-TRIAGE";
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
    reproduce: () => runHeadlessMatch({
      scenario: loadScenario("eval/scenarios/5v5-continuous-play.v1.json"),
      maxTicks: 1800,
      cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true,
    } as never).observations,
  },
  "ball-settled-flowing": {
    spec: {
      run_id: "ball-settled-flowing",
      scenario_path: "eval/scenarios/5v5-continuous-play.v1.json",
      maxTicks: 1200,
      opts: { cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true },
    },
    reproduce: () => runHeadlessMatch({
      scenario: loadScenario("eval/scenarios/5v5-continuous-play.v1.json"),
      maxTicks: 1200,
      cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true,
    } as never).observations,
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
    reproduce: () => runHeadlessMatch({
      scenario: loadScenario("eval/scenarios/5v5-continuous-play.v1.json"),
      maxTicks: 1800,
      cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true,
      lifecyclePhaseSync: "core-owned",
    } as never).observations,
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
    reproduce: () => runHeadlessMatch({
      scenario: loadScenario("eval/scenarios/5v5-restart-throwin.v1.json"),
      maxTicks: 1800,
      cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true,
      lifecyclePhaseSync: "core-owned",
    } as never).observations,
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
    reproduce: () => runHeadlessMatch({
      scenario: loadScenario("eval/scenarios/5v5-restart-arc.v1.json"),
      maxTicks: 1800,
      cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true,
      lifecyclePhaseSync: "core-owned",
    } as never).observations,
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
    reproduce: () => runHeadlessMatch({
      scenario: loadScenario("eval/scenarios/5v5-continuous-play.v1.json"),
      maxTicks: 1800,
      cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true,
      gkBehavior: true, lifecyclePhaseSync: "legacy",
    } as never).observations,
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
    reproduce: () => runHeadlessMatch({
      scenario: loadScenario("eval/scenarios/5v5-keeper-shot-fixture.v1.json"),
      maxTicks: 600,
      cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true,
      gkBehavior: true, lifecyclePhaseSync: "legacy",
    } as never).observations,
  },
};

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

function evaluatePossession(observations: TelemetryObservation[]): {
  observations: number;
  nonNullLastTouchRef: number;
  beforeNoEvidenceFails: number;
  beforeOrphanRefFails: number;
  beforeTotalFails: number;
  afterFails: number;
  genuinelyInvalid: number;
  genuinelyInvalidRefs: string[];
} {
  // Window union of every event id across the observation map.
  const allEventIds = new Set<string>();
  for (const o of observations) {
    for (const e of o.events) allEventIds.add(e.id);
  }

  // BEFORE: per-tick fallback resolution (pre-fix behavior) — the raw
  // checkPosSessionEvidence with no window union.
  const before = checkPossessionEvidence(observations);
  const beforeFails = before.filter((r) => r.status === "fail");
  const beforeNoEvidenceFails = beforeFails.filter((r) => r.id.includes("no-evidence")).length;
  const beforeOrphanRefFails = beforeFails.filter((r) => r.id.includes("orphan-ref")).length;

  // AFTER: window-union resolution through the wired oracle (post-fix).
  const after = executeOracle("possession-evidence", "oracle-possession-v1", observations);
  const afterFails = after.filter((r) => r.status === "fail").length;

  // Genuinely invalid: lastTouchRef absent from the window event union.
  let genuinelyInvalid = 0;
  const genuinelyInvalidRefs = new Set<string>();
  let nonNullLastTouchRef = 0;
  for (const o of observations) {
    const ref = o.ball.lastTouchRef;
    if (ref === null) continue;
    nonNullLastTouchRef++;
    if (!allEventIds.has(ref)) {
      genuinelyInvalid++;
      genuinelyInvalidRefs.add(ref);
    }
  }

  return {
    observations: observations.length,
    nonNullLastTouchRef,
    beforeNoEvidenceFails,
    beforeOrphanRefFails,
    beforeTotalFails: beforeFails.length,
    afterFails,
    genuinelyInvalid,
    genuinelyInvalidRefs: [...genuinelyInvalidRefs].sort(),
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
  const poss = evaluatePossession(observations);

  const body = {
    run_id: runId,
    scenario_path: run.spec.scenario_path,
    maxTicks: run.spec.maxTicks,
    lifecyclePhaseSync: run.spec.opts.lifecyclePhaseSync ?? "legacy",
    gkBehavior: run.spec.opts.gkBehavior === true,
    observations: poss.observations,
    nonNullLastTouchRef: poss.nonNullLastTouchRef,
    before: {
      perTickResolution: {
        noEvidenceFails: poss.beforeNoEvidenceFails,
        orphanRefFails: poss.beforeOrphanRefFails,
        totalFails: poss.beforeTotalFails,
      },
    },
    after: {
      windowUnionResolution: {
        totalFails: poss.afterFails,
      },
    },
    genuinelyInvalidRefs: {
      count: poss.genuinelyInvalid,
      refs: poss.genuinelyInvalidRefs,
    },
    record_sha256: null as string | null,
  };
  body.record_sha256 = sha256(JSON.stringify({ ...body, record_sha256: null }));

  mkdirSync(RUNS_DIR, { recursive: true });
  const outPath = resolve(RUNS_DIR, `${runId}.json`);
  writeFileSync(outPath, `${JSON.stringify(body, null, 2)}\n`, "utf-8");
  console.log(`[possession-oracle-triage] wrote ${outPath}`);
  console.log(
    `  ${runId}: obs=${poss.observations} nonNull=${poss.nonNullLastTouchRef} ` +
      `BEFORE fails=${poss.beforeTotalFails} (no-evidence=${poss.beforeNoEvidenceFails}, orphan-ref=${poss.beforeOrphanRefFails}) ` +
      `AFTER fails=${poss.afterFails} genuinelyInvalid=${poss.genuinelyInvalid}`,
  );
}

main();
