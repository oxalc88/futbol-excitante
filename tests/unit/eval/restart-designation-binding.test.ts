/**
 * @module tests/unit/eval/restart-designation-binding.test.ts
 *
 * Evidence-binding test for RESTART-DESIGNATION-FACTS-CONFORMANCE.
 *
 * Locks the honest published restart-designation-facts verdict table produced by
 * re-running the registered `rules` evaluator (`evaluateSuite("rules", ...)`)
 * over the driven conformance streams with the gated `serializeRestartFacts`
 * observation extension AND the browser observation shape
 * (`browserParityObservations: true`), which is the only wiring in which the
 * adapter actually exercises the restart freeze / nearest-only chase /
 * post-goal-halftime re-arm (RESTART-ANTI-HUDDLE-COHERENCE used the same shape).
 *
 * It pins:
 *  1. The record shape and a stable, byte-reproducible `record_sha256`.
 *  2. The 3 anti-huddle restart-behavior criteria upgraded NOT_EVALUATED → PASS
 *     (FREEZE-UNTIL-FIRST-TOUCH / NEAREST-ONLY / REARM).
 *  3. The corner cluster stays OUT of scope (NOT_EVALUATED / BLOCKED).
 *  4. The stash-identity controls: live/stashed state-hash chains are identical
 *     and the stashed stream carries 0 injected facts, so the injection provably
 *     cannot affect inputs/steps/hashes.
 *  5. The record is not hand-written: reproducing the driven arc and full-match
 *     runs through the production runner + evaluator yields the pinned
 *     anti-huddle verdicts.
 *  6. No PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS
 *     claim is recorded.
 *
 * Node I/O is allowed for scenario and artifact loading.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const STATE_PATH = join(
  projectRoot,
  "docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/restart-designation-facts-state.json",
);

interface DesignationRecord {
  schema_version: number;
  objective_id: string;
  suite_id: string;
  suite_version: string;
  evidence_class: string;
  lifecycle_phase_sync: string;
  browser_parity_observations: boolean;
  record_sha256: string;
  runs: Array<{
    id: string;
    scenario: string;
    ticks: number;
    gated_serialization: boolean;
    browser_parity_observations: boolean;
    reproduction: string;
    untouched_window_count: number;
    verdicts: Record<string, string>;
    determinism: { state_hash_of_hashes: string; final_state_hash: string };
    stash_identity?: {
      injected_facts_total: number;
      gated_on_state_hash_of_hashes?: string;
      state_hash_chain_identical?: boolean;
    };
  }>;
  by_criterion: Record<string, string[]>;
  verdict_summary: Record<string, string>;
  criterion_reasons: Record<string, string>;
  claims_not_made: string[];
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(projectRoot, relativePath), "utf-8")) as T;
}

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function criterionOutcomes(observations: TelemetryObservation[]): Record<string, string> {
  const suite = evaluateSuite("rules", observations);
  const out: Record<string, string> = {};
  for (const t of suite.tests) for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  return out;
}

function loadRecord(): DesignationRecord {
  return readJson<DesignationRecord>(
    "docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/restart-designation-facts-state.json",
  );
}

const ANTI_HUDDLE_UPGRADES = [
  "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH",
  "MATCH-RESTART-NEAREST-ONLY",
  "MATCH-RESTART-REARM",
] as const;

describe("RESTART-DESIGNATION-FACTS-CONFORMANCE restart-designation verdict record", () => {
  it("durable record exists with the established shape", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("RESTART-DESIGNATION-FACTS-CONFORMANCE");
    expect(record.suite_id).toBe("rules");
    expect(record.suite_version).toBe("suite-rules-v1");
    expect(record.evidence_class).toBe("MULTI_TICK");
    expect(record.schema_version).toBe(1);
    expect(record.lifecycle_phase_sync).toBe("core-owned");
    expect(record.browser_parity_observations).toBe(true);
    expect(typeof record.record_sha256).toBe("string");
    expect(record.record_sha256.length).toBeGreaterThan(0);
    expect(record.runs.length).toBe(6);
    expect(record.claims_not_made.length).toBeGreaterThan(0);
    expect(Object.keys(record.verdict_summary).length).toBe(25);
  });

  it("record_sha256 is byte-reproducible (no wall-clock field, recomputes to the pinned value)", () => {
    const record = loadRecord();
    const copy: Record<string, unknown> = { ...record };
    delete copy.record_sha256;
    expect(sha256(JSON.stringify(copy))).toBe(record.record_sha256);
  });

  it("the 3 anti-huddle restart-behavior criteria are upgraded NOT_EVALUATED → PASS", () => {
    const record = loadRecord();
    for (const c of ANTI_HUDDLE_UPGRADES) {
      expect(record.verdict_summary[c]).toBe("PASS");
    }
  });

  it("the corner cluster stays OUT of scope (NOT_EVALUATED / BLOCKED); blocked references stay blocked", () => {
    const record = loadRecord();
    expect(record.verdict_summary["MATCH-CORNER-KICK-AWARD"]).toBe("NOT_EVALUATED");
    expect(record.verdict_summary["MATCH-CORNER-KICK-PLACEMENT"]).toBe("NOT_EVALUATED");
    expect(record.verdict_summary["MATCH-CORNER-KICK-TIMER-FREEZE"]).toBe("NOT_EVALUATED");
    expect(record.verdict_summary["MATCH-CORNER-KICK-CROSS"]).toBe("BLOCKED_MISSING_REFERENCE");
    expect(record.verdict_summary["MATCH-GOAL-KICK-DISTRIBUTION"]).toBe("BLOCKED_MISSING_REFERENCE");
  });

  it("stash-identity: the gated and stashed runs share identical state-hash chains and carry 0 injected facts", () => {
    const record = loadRecord();
    for (const live of ["designation-throwin-live", "designation-arc-live", "designation-fullmatch-live"]) {
      const stashed = record.runs.find((r) => r.id === `${live.replace(/-live$/, "")}-stashed`);
      expect(stashed).toBeDefined();
      expect(stashed!.stash_identity?.state_hash_chain_identical).toBe(true);
      expect(stashed!.stash_identity?.injected_facts_total).toBe(0);
      const liveRec = record.runs.find((r) => r.id === live);
      expect(stashed!.stash_identity?.gated_on_state_hash_of_hashes).toBe(liveRec!.determinism.state_hash_of_hashes);
    }
  });

  it("record does not claim PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS", () => {
    const record = loadRecord();
    const joined = record.claims_not_made.join("\n").toLowerCase();
    expect(joined).toContain("no suite-level pass");
    expect(joined).toContain("no promotion");
    expect(joined).toContain("no pes");
    expect(joined).toContain("no foundation_lab_pass");
    expect(joined).toContain("no invented reference");
    expect(joined).toContain("corner cluster");
  });

  it(
    "record is not hand-written: reproducing the driven full-match browserParity run yields the pinned anti-huddle verdicts",
    () => {
      const fullMatch = runHeadlessMatch({
        scenario: loadScenario("eval/scenarios/5v5-full-match-timing.v1.json"),
        maxTicks: 800,
        cpuAntiHuddle: true,
        lifecyclePhaseSync: "core-owned",
        browserParityObservations: true,
        serializeRestartFacts: true,
      });
      const fullMatchOut = criterionOutcomes(fullMatch.observations);
      expect(fullMatchOut["MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH"]).toBe("PASS");
      expect(fullMatchOut["MATCH-RESTART-NEAREST-ONLY"]).toBe("PASS");
      expect(fullMatchOut["MATCH-RESTART-REARM"]).toBe("PASS");
      expect(fullMatchOut["MATCH-TIMER-HALFTIME"]).toBe("PASS");
      expect(fullMatchOut["MATCH-TIMER-FULLTIME"]).toBe("PASS");
    },
    120_000,
  );

  it("discriminating: the anti-huddle verdicts are not a stale NOT_EVALUATED table", () => {
    const record = loadRecord();
    for (const c of ANTI_HUDDLE_UPGRADES) {
      expect(record.verdict_summary[c]).toBe("PASS");
    }
    // The driven live runs must actually carry the designation facts.
    const arcLive = record.runs.find((r) => r.id === "designation-arc-live");
    expect(arcLive).toBeDefined();
    expect(arcLive!.gated_serialization).toBe(true);
    expect(arcLive!.untouched_window_count).toBeGreaterThan(0);
    expect(arcLive!.verdicts["MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH"]).toBe("PASS");
    expect(arcLive!.verdicts["MATCH-RESTART-NEAREST-ONLY"]).toBe("PASS");
    expect(arcLive!.verdicts["MATCH-RESTART-REARM"]).toBe("PASS");
  });
});
