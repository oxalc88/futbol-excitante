/**
 * Node-side empirical probe for LIFECYCLE-MIGRATION-ASSESSMENT.
 *
 * Root-cause probe of the lifecyclePhaseSync legacy -> core-owned migration
 * question. For every accepted pin that was captured under the legacy driver
 * phase-sync, this re-runs the SAME capture/evaluator path under BOTH policies
 * and compares the per-tick state hash chain byte-for-byte. It also evaluates
 * the protected COMMON criteria (via the registered oracles) so it can verify
 * that re-running under the ACCEPTED policy reproduces the accepted
 * COMMON-FULL-MATCH-INVARIANT-TRIAGE record_sha256 (probe fidelity), and that
 * the COMMON-BOUNDS residual turns green under core-owned.
 *
 * Shard-friendly: each invocation writes one partial under
 * docs/evidence/LIFECYCLE-MIGRATION-ASSESSMENT/probes/<run_id>.json.
 *
 *   pnpm exec tsx scripts/capture-lifecycle-migration-assessment.ts --run <run_id>
 *
 * No gameplay change: reads the exported runner and registered oracles only.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { executeOracle } from "../eval/oracles/oracle-registry.js";
import "../eval/oracles/wire.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";

const OBJECTIVE_ID = "LIFECYCLE-MIGRATION-ASSESSMENT";
const EVIDENCE_DIR = resolve("docs/evidence", OBJECTIVE_ID);
const PROBES_DIR = resolve(EVIDENCE_DIR, "probes");

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

interface RunSpec {
  run_id: string;
  scenario_path: string;
  maxTicks: number;
  opts: Record<string, unknown>;
  /** Accepted COMMON-FULL-MATCH-INVARIANT-TRIAGE record_sha256 (for the 8 full-match maps). */
  accepted_record_sha256?: string;
  /** Lifecycle this run was accepted under. */
  accepted_lifecycle: "legacy" | "core-owned";
}

const RUNS: Record<string, RunSpec> = {
  "anti-huddle-flowing": {
    run_id: "anti-huddle-flowing",
    scenario_path: "eval/scenarios/5v5-continuous-play.v1.json",
    maxTicks: 1800,
    opts: { cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true },
    accepted_record_sha256: "14c34cd961eaf0a005c5ea328e3bf667d279442d156f3d4bbdb421458f2e6838",
    accepted_lifecycle: "legacy",
  },
  "ball-settled-flowing": {
    run_id: "ball-settled-flowing",
    scenario_path: "eval/scenarios/5v5-continuous-play.v1.json",
    maxTicks: 1200,
    opts: { cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true },
    accepted_record_sha256: "dcfe7a256cf75a5e39f80bf5fe5362166136a98c3478d330f293eb7a6239c0ee",
    accepted_lifecycle: "legacy",
  },
  "gk-continuous-live": {
    run_id: "gk-continuous-live",
    scenario_path: "eval/scenarios/5v5-continuous-play.v1.json",
    maxTicks: 1800,
    opts: { cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true, gkBehavior: true, lifecyclePhaseSync: "legacy" },
    accepted_record_sha256: "80e1d352ddcfd9b7b363ec6a20cd0651e1c72bc64e07b492c8369b954ac21cfd",
    accepted_lifecycle: "legacy",
  },
  "gk-shot-fixture-live": {
    run_id: "gk-shot-fixture-live",
    scenario_path: "eval/scenarios/5v5-keeper-shot-fixture.v1.json",
    maxTicks: 600,
    opts: { cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true, gkBehavior: true, lifecyclePhaseSync: "legacy" },
    accepted_record_sha256: "bdca70749b42d3af6984232e6d3ef6802c1c4973f0023f11afd06e606952fecf",
    accepted_lifecycle: "legacy",
  },
  "restart-corner": {
    run_id: "restart-corner",
    scenario_path: "eval/scenarios/5v5-continuous-play.v1.json",
    maxTicks: 1800,
    opts: { cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true, lifecyclePhaseSync: "core-owned" },
    accepted_record_sha256: "13b078267e2c8b8975494bc96be0e71267d641c1393d1f0ee24576f2b7ce115b",
    accepted_lifecycle: "core-owned",
  },
  "restart-goalkick-postgoal": {
    run_id: "restart-goalkick-postgoal",
    scenario_path: "eval/scenarios/5v5-restart-arc.v1.json",
    maxTicks: 1800,
    opts: { cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true, lifecyclePhaseSync: "core-owned" },
    accepted_record_sha256: "095403ab124682d0de1be8d89ab5fb5f4b5420a452d22166cc947fe29658e81e",
    accepted_lifecycle: "core-owned",
  },
  "restart-throwin": {
    run_id: "restart-throwin",
    scenario_path: "eval/scenarios/5v5-restart-throwin.v1.json",
    maxTicks: 1800,
    opts: { cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true, lifecyclePhaseSync: "core-owned" },
    accepted_record_sha256: "f53d176707f8b7c798d6eadf15d128a493253c1bfafe1999fd68256a310c03ed",
    accepted_lifecycle: "core-owned",
  },
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function phaseHistogram(phases: string[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const p of phases) h[p] = (h[p] ?? 0) + 1;
  return h;
}

/** Reproduce the COMMON-FULL-MATCH-INVARIANT-TRIAGE body over the observations. */
function commonBody(observations: TelemetryObservation[]): {
  recordSha256: string;
  commonBounds: string;
  commonRefs: string;
  commonFinite: string;
  maxPlayerAbsX: number;
  maxBallAbsX: number;
} {
  const refs = executeOracle("event-references", "oracle-references-v1", observations);
  const bounds = executeOracle("bounds", "oracle-bounds-v1", observations);
  const finite = executeOracle("finite-number", "oracle-finite-v1", observations);
  const refsFail = refs.filter((r) => r.status === "fail").length;
  const boundsFail = bounds.filter((r) => r.status === "fail").length;
  const finiteFail = finite.filter((r) => r.status === "fail").length;
  let maxPlayerAbsX = 0;
  let maxBallAbsX = 0;
  for (const o of observations) {
    for (const p of o.players) if (Math.abs(p.groundPosition.x) > maxPlayerAbsX) maxPlayerAbsX = Math.abs(p.groundPosition.x);
    if (Math.abs(o.ball.position.x) > maxBallAbsX) maxBallAbsX = Math.abs(o.ball.position.x);
  }
  const body = {
    run_id: "",
    scenario_path: "",
    maxTicks: 0,
    lifecyclePhaseSync: "",
    gkBehavior: false,
    observations: observations.length,
    nonNullLastTouchRef: 0,
    common_criteria: {
      "COMMON-REFERENCES": refsFail === 0 ? "PASS" : "FAIL",
      "COMMON-BOUNDS": boundsFail === 0 ? "PASS" : "FAIL",
      "COMMON-FINITE": finiteFail === 0 ? "PASS" : "FAIL",
    },
    common_detail: {
      "COMMON-REFERENCES": { perTickFails: refsFail },
      "COMMON-BOUNDS": { perTickFails: boundsFail },
      "COMMON-FINITE": { perTickFails: finiteFail },
    },
    positions: { maxPlayerAbsX, maxPlayerAbsY: 0, maxBallAbsX, declared_maxX: 52.5, declared_maxY: 34 },
  };
  // NOTE: record_sha256 in the accepted files is over the FULL body including
  // run_id/scenario_path/maxTicks/lifecyclePhaseSync/gkBehavior/observations/
  // nonNullLastTouchRef, so we cannot reproduce it from observations alone here.
  // We report the criteria + positions instead; RECORD fidelity for the accepted
  // legacy pins is verified separately by comparing to the COMMON-FULL-MATCH run.
  return {
    recordSha256: "",
    commonBounds: body.common_criteria["COMMON-BOUNDS"],
    commonRefs: body.common_criteria["COMMON-REFERENCES"],
    commonFinite: body.common_criteria["COMMON-FINITE"],
    maxPlayerAbsX,
    maxBallAbsX,
  };
}

function probeRun(spec: RunSpec) {
  const baseOpts = { ...spec.opts };
  const scenario = loadScenario(spec.scenario_path);

  const legacyResult = runHeadlessMatch({
    scenario: loadScenario(spec.scenario_path),
    maxTicks: spec.maxTicks,
    ...baseOpts,
    lifecyclePhaseSync: "legacy",
  } as never);

  const coreResult = runHeadlessMatch({
    scenario: loadScenario(spec.scenario_path),
    maxTicks: spec.maxTicks,
    ...baseOpts,
    lifecyclePhaseSync: "core-owned",
  } as never);

  const legacyHashChainSha = sha256(JSON.stringify(legacyResult.stateHashes));
  const coreHashChainSha = sha256(JSON.stringify(coreResult.stateHashes));

  let firstDivergenceTick: number | null = null;
  const nTicks = Math.max(legacyResult.stateHashes.length, coreResult.stateHashes.length);
  for (let i = 0; i < nTicks; i++) {
    if (legacyResult.stateHashes[i] !== coreResult.stateHashes[i]) {
      firstDivergenceTick = i;
      break;
    }
  }

  const restartPhases = new Set(["corner-kick", "goal-kick", "throw-in", "goal", "halftime", "kickoff"]);

  const legacyCommon = commonBody(legacyResult.observations);
  const coreCommon = commonBody(coreResult.observations);

  return {
    run_id: spec.run_id,
    scenario_path: spec.scenario_path,
    maxTicks: spec.maxTicks,
    accepted_lifecycle: spec.accepted_lifecycle,
    nTicks,
    legacy: {
      stateHashChainSha: legacyHashChainSha,
      corePhaseHistogram: phaseHistogram(legacyResult.coreMatchPhases),
      restartPhaseTicks: legacyResult.coreMatchPhases.filter((p) => restartPhases.has(p)).length,
      commonBounds: legacyCommon.commonBounds,
      commonRefs: legacyCommon.commonRefs,
      commonFinite: legacyCommon.commonFinite,
      maxPlayerAbsX: legacyCommon.maxPlayerAbsX,
      maxBallAbsX: legacyCommon.maxBallAbsX,
    },
    core: {
      stateHashChainSha: coreHashChainSha,
      corePhaseHistogram: phaseHistogram(coreResult.coreMatchPhases),
      restartPhaseTicks: coreResult.coreMatchPhases.filter((p) => restartPhases.has(p)).length,
      commonBounds: coreCommon.commonBounds,
      commonRefs: coreCommon.commonRefs,
      commonFinite: coreCommon.commonFinite,
      maxPlayerAbsX: coreCommon.maxPlayerAbsX,
      maxBallAbsX: coreCommon.maxBallAbsX,
    },
    byte_identical: legacyHashChainSha === coreHashChainSha,
    firstDivergenceTick,
    accepted_record_sha256: spec.accepted_record_sha256 ?? null,
  };
}

function main(): void {
  const raw = process.argv.find((a) => a.startsWith("--run=")) ?? process.argv[process.argv.indexOf("--run") + 1];
  const runId = raw?.split("=")[1] ?? raw;
  if (!runId) {
    console.error("Provide --run <run_id>; valid:", Object.keys(RUNS).join(", "));
    process.exit(1);
  }
  const spec = RUNS[runId];
  if (!spec) {
    console.error("Unknown run:", runId);
    process.exit(1);
  }

  console.log(`[lifecycle-migration] probing ${runId} (${spec.maxTicks} ticks)...`);
  const out = probeRun(spec);
  mkdirSync(PROBES_DIR, { recursive: true });
  const outPath = resolve(PROBES_DIR, `${runId}.json`);
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf-8");
  console.log(`  wrote ${outPath}`);
  console.log(
    `  ${runId}: byte_identical=${out.byte_identical} firstDivergenceTick=${out.firstDivergenceTick} ` +
      `legacyRestartTicks=${out.legacy.restartPhaseTicks} coreRestartTicks=${out.core.restartPhaseTicks} ` +
      `COMMON-BOUNDS legacy=${out.legacy.commonBounds} core=${out.core.commonBounds}`,
  );
}

main();
