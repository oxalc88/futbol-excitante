/**
 * @module tests/unit/eval/rules-suite-state-rerun-binding.test.ts
 *
 * Evidence-binding test for RULES-SUITE-STATE-RERUN.
 *
 * Locks the honest re-published rules-suite verdict table produced by
 * re-running the registered `rules` evaluator (`evaluateSuite("rules", ...)`)
 * over all evidence streams now available:
 *
 *   - Core-owned baseline fixtures without serialization (throw-in, arc).
 *   - Gated driven streams (throw-in / goal-kick / full-match-timing / corner).
 *   - Gated browserParity designation streams (throw-in / arc / full-match).
 *
 * It pins:
 *  1. The record shape and a stable, byte-reproducible `record_sha256`.
 *  2. The complete aggregate: 23 PASS / 2 BLOCKED_MISSING_REFERENCE /
 *     0 NOT_EVALUATED / 0 FAIL.
 *  3. The 6 NOT_EVALUATED → PASS deltas vs the RULES-FACTS-DEPTH-CONFORMANCE
 *     baseline with source-stream attribution (3 anti-huddle from the
 *     designation streams, 3 corner from the corner stream).
 *  4. The anti-huddle criteria are evaluated only on the browserParity
 *     designation streams (the non-browserParity streams do not carry the
 *     browser-composition-root shape, so their anti-huddle oracle result is an
 *     artifact and is excluded).
 *  5. The 2 blocked references stay BLOCKED_MISSING_REFERENCE; the 8 invariants
 *     all PASS.
 *  6. The record is not hand-written: reproducing the driven corner run and the
 *     designation full-match run through the production runner + evaluator
 *     yields the pinned verdicts.
 *  7. No PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS
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
  "docs/evidence/RULES-SUITE-STATE-RERUN/rules-suite-state-rerun.json",
);

interface RerunRecord {
  schema_version: number;
  objective_id: string;
  suite_id: string;
  suite_version: string;
  evidence_class: string;
  lifecycle_phase_sync: string;
  record_sha256: string;
  runs: Array<{
    id: string;
    role: string;
    scenario: string;
    ticks: number;
    gated_serialization: boolean;
    browser_parity_observations: boolean;
    reproduction: string;
    verdicts: Record<string, string>;
    invariants: Record<string, string>;
    determinism: { state_hash_of_hashes: string; final_state_hash: string };
  }>;
  by_criterion: Record<string, string[]>;
  verdict_summary: Record<string, string>;
  invariant_summary: Record<string, string>;
  criterion_eligibility: {
    anti_huddle_restart_behavior: { criteria: string[]; eligible_runs: string[]; reason: string };
    all_other_criteria: { criteria: string[]; eligible_runs: string[]; reason: string };
  };
  disclosures: string[];
  verdict_deltas: {
    baseline_objective_id: string;
    baseline_record_sha256: string | null;
    baseline_counts: Record<string, number>;
    current_counts: Record<string, number>;
    changed: Array<{ criterion: string; from: string; to: string; source_streams: string[] }>;
    unchanged: Array<{ criterion: string; outcome: string }>;
    disclosure: string;
  };
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

function loadRecord(): RerunRecord {
  return readJson<RerunRecord>(
    "docs/evidence/RULES-SUITE-STATE-RERUN/rules-suite-state-rerun.json",
  );
}

const PASS_CRITERIA = [
  "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH",
  "MATCH-RESTART-NEAREST-ONLY",
  "MATCH-RESTART-REARM",
  "MATCH-CORNER-KICK-AWARD",
  "MATCH-CORNER-KICK-PLACEMENT",
  "MATCH-CORNER-KICK-TIMER-FREEZE",
  "MATCH-GOAL-KICK-AWARD",
  "MATCH-GOAL-KICK-PLACEMENT",
  "MATCH-GOAL-KICK-TIMER-FREEZE",
  "MATCH-KICKOFF-FREEZE",
  "MATCH-KICKOFF-FIRST-TOUCH",
  "MATCH-OUT-OF-PLAY-DETECT",
  "MATCH-OUT-OF-PLAY-NO-LAST-TOUCH",
  "MATCH-SCORING-GOAL-DEVENT",
  "MATCH-SCORING-GOAL-PHASE",
  "MATCH-THROW-IN-AWARD",
  "MATCH-THROW-IN-PLACEMENT",
  "MATCH-THROW-IN-SERVE",
  "MATCH-THROW-IN-TIMER-FREEZE",
  "MATCH-TIMER-DECREMENT",
  "MATCH-TIMER-HALFTIME",
  "MATCH-TIMER-FULLTIME",
  "MATCH-TIMER-FREEZE",
] as const;

const BLOCKED_CRITERIA = [
  "MATCH-CORNER-KICK-CROSS",
  "MATCH-GOAL-KICK-DISTRIBUTION",
] as const;

const UPGRADED_DELTAS: Array<[string, string[]]> = [
  ["MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH", ["designation-throwin-live", "designation-arc-live", "designation-fullmatch-live"]],
  ["MATCH-RESTART-NEAREST-ONLY", ["designation-throwin-live", "designation-arc-live", "designation-fullmatch-live"]],
  ["MATCH-RESTART-REARM", ["designation-arc-live", "designation-fullmatch-live"]],
  ["MATCH-CORNER-KICK-AWARD", ["rules-corner-live"]],
  ["MATCH-CORNER-KICK-PLACEMENT", ["rules-corner-live"]],
  ["MATCH-CORNER-KICK-TIMER-FREEZE", ["rules-corner-live"]],
] as const;

describe("RULES-SUITE-STATE-RERUN rules-suite verdict record", () => {
  it("durable record exists with the established shape", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("RULES-SUITE-STATE-RERUN");
    expect(record.suite_id).toBe("rules");
    expect(record.suite_version).toBe("suite-rules-v1");
    expect(record.evidence_class).toBe("BOOKKEEPING");
    expect(record.schema_version).toBe(1);
    expect(record.lifecycle_phase_sync).toBe("core-owned");
    expect(typeof record.record_sha256).toBe("string");
    expect(record.record_sha256.length).toBeGreaterThan(0);
    expect(record.runs.length).toBe(10);
    expect(record.claims_not_made.length).toBeGreaterThan(0);
    expect(Object.keys(record.verdict_summary).length).toBe(25);
    expect(Object.keys(record.invariant_summary).length).toBe(8);
  });

  it("record_sha256 is byte-reproducible (no wall-clock field, recomputes to the pinned value)", () => {
    const record = loadRecord();
    const copy: Record<string, unknown> = { ...record };
    delete copy.record_sha256;
    expect(sha256(JSON.stringify(copy))).toBe(record.record_sha256);
  });

  it("the complete aggregate is 23 PASS / 2 BLOCKED / 0 NOT_EVALUATED / 0 FAIL", () => {
    const record = loadRecord();
    for (const c of PASS_CRITERIA) expect(record.verdict_summary[c]).toBe("PASS");
    for (const c of BLOCKED_CRITERIA) expect(record.verdict_summary[c]).toBe("BLOCKED_MISSING_REFERENCE");
    // No NOT_EVALUATED or FAIL in the aggregate.
    const values = Object.values(record.verdict_summary);
    expect(values.filter((v) => v === "NOT_EVALUATED")).toHaveLength(0);
    expect(values.filter((v) => v === "FAIL")).toHaveLength(0);
    expect(record.verdict_deltas.current_counts).toEqual({
      PASS: 23,
      FAIL: 0,
      NOT_EVALUATED: 0,
      BLOCKED_MISSING_REFERENCE: 2,
    });
  });

  it("the 6 deltas vs the RULES-FACTS-DEPTH-CONFORMANCE baseline are NOT_EVALUATED → PASS with source-stream attribution", () => {
    const record = loadRecord();
    expect(record.verdict_deltas.baseline_objective_id).toBe("RULES-FACTS-DEPTH-CONFORMANCE");
    expect(record.verdict_deltas.baseline_counts).toEqual({
      PASS: 17,
      FAIL: 0,
      NOT_EVALUATED: 6,
      BLOCKED_MISSING_REFERENCE: 2,
    });
    expect(record.verdict_deltas.changed).toHaveLength(6);
    for (const [criterion, streams] of UPGRADED_DELTAS) {
      const delta = record.verdict_deltas.changed.find((d) => d.criterion === criterion);
      expect(delta).toBeDefined();
      expect(delta!.from).toBe("NOT_EVALUATED");
      expect(delta!.to).toBe("PASS");
      expect([...delta!.source_streams].sort()).toEqual([...streams].sort());
    }
    expect(record.verdict_deltas.unchanged).toHaveLength(19);
  });

  it("the anti-huddle criteria are evaluated only on the browserParity designation streams", () => {
    const record = loadRecord();
    const anti = record.criterion_eligibility.anti_huddle_restart_behavior;
    expect(anti.criteria.sort()).toEqual(
      ["MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH", "MATCH-RESTART-NEAREST-ONLY", "MATCH-RESTART-REARM"].sort(),
    );
    expect(anti.eligible_runs.sort()).toEqual(
      ["designation-throwin-live", "designation-arc-live", "designation-fullmatch-live"].sort(),
    );
    // Each anti-huddle by_criterion entry must only reference the designation runs.
    for (const c of anti.criteria) {
      const entries = record.by_criterion[c];
      for (const e of entries) {
        const run = e.split("=")[0];
        expect(anti.eligible_runs).toContain(run);
      }
    }
  });

  it("the 8 invariants all aggregate to PASS", () => {
    const record = loadRecord();
    for (const v of Object.values(record.invariant_summary)) {
      expect(v).toBe("PASS");
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
  });

  it(
    "record is not hand-written: reproducing the driven corner + designation full-match runs yields the pinned verdicts",
    () => {
      const corner = runHeadlessMatch({
        scenario: loadScenario("eval/scenarios/5v5-corner-driven.v1.json"),
        maxTicks: 400,
        cpuAntiHuddle: true,
        lifecyclePhaseSync: "core-owned",
        serializeRestartFacts: true,
      });
      const cornerOut = criterionOutcomes(corner.observations);
      expect(cornerOut["MATCH-CORNER-KICK-AWARD"]).toBe("PASS");
      expect(cornerOut["MATCH-CORNER-KICK-PLACEMENT"]).toBe("PASS");
      expect(cornerOut["MATCH-CORNER-KICK-TIMER-FREEZE"]).toBe("PASS");
      expect(cornerOut["MATCH-CORNER-KICK-CROSS"]).toBe("BLOCKED_MISSING_REFERENCE");

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
    },
    300_000,
  );

  it("discriminating: the corner PASS is not blanket (the goal-kick neighbour control is NOT_EVALUATED)", () => {
    const record = loadRecord();
    const cornerLive = record.runs.find((r) => r.id === "rules-corner-live");
    expect(cornerLive).toBeDefined();
    expect(cornerLive!.verdicts["MATCH-CORNER-KICK-AWARD"]).toBe("PASS");
    const neighbour = record.runs.find((r) => r.id === "rules-corner-goalkick-neighbour");
    expect(neighbour).toBeDefined();
    expect(neighbour!.verdicts["MATCH-CORNER-KICK-AWARD"]).toBe("NOT_EVALUATED");
    // The anti-huddle criteria are excluded from the non-browserParity runs.
    const designation = record.runs.find((r) => r.id === "designation-arc-live");
    expect(designation).toBeDefined();
    expect(designation!.browser_parity_observations).toBe(true);
    expect(designation!.verdicts["MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH"]).toBe("PASS");
  });
});
