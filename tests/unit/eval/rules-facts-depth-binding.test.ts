/**
 * @module tests/unit/eval/rules-facts-depth-binding.test.ts
 *
 * Evidence-binding test for RULES-FACTS-DEPTH-CONFORMANCE.
 *
 * Locks the honest published rules-facts-depth verdict table produced by
 * re-running the registered `rules` evaluator (`evaluateSuite("rules", ...)`)
 * over the driven conformance streams with the gated `serializeRestartFacts`
 * observation extension:
 *
 *   - rules-throw-in-live / rules-goal-kick-live (1800 ticks): the throw-in /
 *     goal-kick placement + serve + phase-specific timer-freeze, the kickoff
 *     first-touch, the goal phase, and the timer decrement.
 *   - rules-full-match-live (800 ticks, short duration): the timer reaches
 *     zero in half 1 (halftime) and half 2 (fulltime).
 *
 * It pins:
 *  1. The record shape and a stable, byte-reproducible `record_sha256`.
 *  2. The key depth verdicts upgraded NOT_EVALUATED → PASS (placement / serve /
 *     timer-freeze variants / decrement / halftime / fulltime / goal phase /
 *     kickoff first-touch).
 *  3. The anti-huddle restart-behavior criteria stay NOT_EVALUATED; the corner
 *     cluster is OUT of scope (stays NOT_EVALUATED / BLOCKED).
 *  4. The stash-identity controls: live/stashed state-hash chains are
 *     identical, so the injection provably cannot affect inputs/steps/hashes.
 *  5. The record is not hand-written: reproducing the driven throw-in and
 *     full-match runs through the production runner + evaluator yields the
 *     pinned verdicts.
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
  "docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/rules-facts-depth-state.json",
);

interface DepthRecord {
  schema_version: number;
  objective_id: string;
  suite_id: string;
  suite_version: string;
  evidence_class: string;
  lifecycle_phase_sync: string;
  record_sha256: string;
  runs: Array<{
    id: string;
    scenario: string;
    ticks: number;
    gated_serialization: boolean;
    reproduction: string;
    verdicts: Record<string, string>;
    determinism: { state_hash_of_hashes: string; final_state_hash: string };
    stash_identity?: {
      injected_core_match_phase_events: number;
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

function loadRecord(): DepthRecord {
  return readJson<DepthRecord>(
    "docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/rules-facts-depth-state.json",
  );
}

const DEPTH_UPGRADES = [
  "MATCH-THROW-IN-PLACEMENT",
  "MATCH-THROW-IN-SERVE",
  "MATCH-THROW-IN-TIMER-FREEZE",
  "MATCH-GOAL-KICK-PLACEMENT",
  "MATCH-GOAL-KICK-TIMER-FREEZE",
  "MATCH-KICKOFF-FIRST-TOUCH",
  "MATCH-SCORING-GOAL-PHASE",
  "MATCH-TIMER-DECREMENT",
  "MATCH-TIMER-HALFTIME",
  "MATCH-TIMER-FULLTIME",
] as const;

const STAYS_NOT_EVALUATED = [
  "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH",
  "MATCH-RESTART-NEAREST-ONLY",
  "MATCH-RESTART-REARM",
] as const;

describe("RULES-FACTS-DEPTH-CONFORMANCE rules-facts-depth verdict record", () => {
  it("durable record exists with the established shape", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("RULES-FACTS-DEPTH-CONFORMANCE");
    expect(record.suite_id).toBe("rules");
    expect(record.suite_version).toBe("suite-rules-v1");
    expect(record.evidence_class).toBe("MULTI_TICK");
    expect(record.schema_version).toBe(1);
    expect(record.lifecycle_phase_sync).toBe("core-owned");
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

  it("the 10 depth criteria are upgraded NOT_EVALUATED → PASS", () => {
    const record = loadRecord();
    for (const c of DEPTH_UPGRADES) {
      expect(record.verdict_summary[c]).toBe("PASS");
    }
  });

  it("the anti-huddle restart-behavior criteria stay NOT_EVALUATED; the corner cluster stays OUT", () => {
    const record = loadRecord();
    for (const c of STAYS_NOT_EVALUATED) {
      expect(record.verdict_summary[c]).toBe("NOT_EVALUATED");
    }
    // Corner cluster is owned by CORNER-DRIVEN-CONFORMANCE; not claimed here.
    expect(record.verdict_summary["MATCH-CORNER-KICK-AWARD"]).toBe("NOT_EVALUATED");
    expect(record.verdict_summary["MATCH-CORNER-KICK-PLACEMENT"]).toBe("NOT_EVALUATED");
    expect(record.verdict_summary["MATCH-CORNER-KICK-TIMER-FREEZE"]).toBe("NOT_EVALUATED");
    expect(record.verdict_summary["MATCH-CORNER-KICK-CROSS"]).toBe("BLOCKED_MISSING_REFERENCE");
  });

  it("stash-identity: the gated and stashed runs share identical state-hash chains (injection is hash-neutral)", () => {
    const record = loadRecord();
    for (const live of ["rules-throw-in-live", "rules-goal-kick-live", "rules-full-match-live"]) {
      const stashed = record.runs.find((r) => r.id === `${live.replace(/-live$/, "")}-stashed`);
      expect(stashed).toBeDefined();
      expect(stashed!.stash_identity?.state_hash_chain_identical).toBe(true);
      expect(stashed!.stash_identity?.injected_core_match_phase_events).toBe(0);
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
    expect(joined).toContain("no gameplay");
    expect(joined).toContain("no invented reference");
    expect(joined).toContain("corner cluster");
  });

  it(
    "record is not hand-written: reproducing the driven throw-in + full-match runs yields the pinned verdicts",
    () => {
      const throwIn = runHeadlessMatch({
        scenario: loadScenario("eval/scenarios/5v5-restart-throwin.v1.json"),
        maxTicks: 1800,
        cpuAntiHuddle: true,
        lifecyclePhaseSync: "core-owned",
        serializeRestartFacts: true,
      });
      const throwInOut = criterionOutcomes(throwIn.observations);
      expect(throwInOut["MATCH-THROW-IN-PLACEMENT"]).toBe("PASS");
      expect(throwInOut["MATCH-THROW-IN-SERVE"]).toBe("PASS");
      expect(throwInOut["MATCH-THROW-IN-TIMER-FREEZE"]).toBe("PASS");
      expect(throwInOut["MATCH-TIMER-DECREMENT"]).toBe("PASS");
      expect(throwInOut["MATCH-SCORING-GOAL-PHASE"]).toBe("PASS");
      expect(throwInOut["MATCH-KICKOFF-FIRST-TOUCH"]).toBe("PASS");
      expect(throwInOut["MATCH-TIMER-HALFTIME"]).toBe("NOT_EVALUATED");
      expect(throwInOut["MATCH-TIMER-FULLTIME"]).toBe("NOT_EVALUATED");

      const fullMatch = runHeadlessMatch({
        scenario: loadScenario("eval/scenarios/5v5-full-match-timing.v1.json"),
        maxTicks: 800,
        cpuAntiHuddle: true,
        lifecyclePhaseSync: "core-owned",
        serializeRestartFacts: true,
      });
      const fullMatchOut = criterionOutcomes(fullMatch.observations);
      expect(fullMatchOut["MATCH-TIMER-HALFTIME"]).toBe("PASS");
      expect(fullMatchOut["MATCH-TIMER-FULLTIME"]).toBe("PASS");
      expect(fullMatchOut["MATCH-TIMER-DECREMENT"]).toBe("PASS");
    },
    180_000,
  );

  it("discriminating: a reverted depth verdict fails (the table is not a stale NOT_EVALUATED table)", () => {
    const record = loadRecord();
    const depthVerdicts = DEPTH_UPGRADES.map((c) => record.verdict_summary[c]);
    expect(depthVerdicts.every((v) => v === "PASS")).toBe(true);
    // The driven runs must actually carry the executed events and phase facts.
    const throwInLive = record.runs.find((r) => r.id === "rules-throw-in-live");
    expect(throwInLive).toBeDefined();
    expect(throwInLive!.gated_serialization).toBe(true);
    expect(throwInLive!.verdicts["MATCH-THROW-IN-PLACEMENT"]).toBe("PASS");
    expect(throwInLive!.verdicts["MATCH-THROW-IN-SERVE"]).toBe("PASS");
  });
});
