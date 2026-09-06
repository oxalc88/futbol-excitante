/**
 * @module tests/unit/eval/RULES-SUITE-STATE-binding.test.ts
 *
 * Evidence-binding test for RULES-SUITE-STATE.
 *
 * Locks the honest published rules-suite verdict table produced by re-running
 * the registered `rules` evaluator (`evaluateSuite("rules", ...)`) over the
 * conformance evidence streams:
 *
 *   - The accepted restart fixtures under the core-owned lifecycle WITHOUT the
 *     gated serialization (RULES-SUITE-REGISTRATION baseline): the
 *     restart-executed events and core matchPhase/matchTimer are not in the
 *     standard stream, so the AWARD / TIMER-FREEZE criteria are NOT_EVALUATED.
 *   - The RESTART-RULES-CONFORMANCE driven streams WITH `serializeRestartFacts`
 *     enabled, which make MATCH-THROW-IN-AWARD / MATCH-GOAL-KICK-AWARD /
 *     MATCH-TIMER-FREEZE genuinely measurable.
 *
 * It pins:
 *  1. The record shape and a stable, byte-reproducible `record_sha256`
 *     (recomputed over the record minus the `record_sha256` field — the record
 *     carries no wall-clock field).
 *  2. The key verdicts: THROW-IN-AWARD / GOAL-KICK-AWARD / TIMER-FREEZE = PASS
 *     (driven streams); CORNER-KICK-AWARD = NOT_EVALUATED (no corner execution);
 *     CORNER-KICK-CROSS / GOAL-KICK-DISTRIBUTION = BLOCKED_MISSING_REFERENCE.
 *  3. The 8 protected rules invariants (7 PASS, corner-kick-award
 *     NOT_EVALUATED).
 *  4. The verdict deltas vs RULES-SUITE-REGISTRATION (exactly the three AWARD /
 *     TIMER-FREEZE upgrades; blocked references stay blocked).
 *  5. Discriminating: a changed verdict that reverts (e.g. MATCH-THROW-IN-AWARD
 *     back to NOT_EVALUATED) fails the test.
 *  6. The record is not hand-written: reproducing the driven throw-in run
 *     through the production runner + evaluator yields the pinned verdicts.
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
const RECORD_PATH = join(
  projectRoot,
  "docs/evidence/RULES-SUITE-STATE/rules-suite-verdicts-state.json",
);

const RULES_INVARIANT_IDS = [
  "rules-out-of-play-detect-evidence",
  "rules-out-of-play-no-last-touch-evidence",
  "rules-throw-in-award-evidence",
  "rules-goal-kick-award-evidence",
  "rules-corner-kick-award-evidence",
  "rules-goal-detection-evidence",
  "rules-kickoff-freeze-evidence",
  "rules-timer-freeze-evidence",
] as const;

const KEY_CRITERIA = [
  "MATCH-THROW-IN-AWARD",
  "MATCH-GOAL-KICK-AWARD",
  "MATCH-CORNER-KICK-AWARD",
  "MATCH-TIMER-FREEZE",
  "MATCH-CORNER-KICK-CROSS",
  "MATCH-GOAL-KICK-DISTRIBUTION",
  "MATCH-KICKOFF-FREEZE",
  "MATCH-SCORING-GOAL-DEVENT",
  "MATCH-OUT-OF-PLAY-DETECT",
  "MATCH-OUT-OF-PLAY-NO-LAST-TOUCH",
] as const;

interface RulesRecord {
  schema_version: number;
  objective_id: string;
  suite_id: string;
  suite_version: string;
  evidence_class: string;
  lifecycle_phase_sync: string;
  record_sha256: string;
  runs: Array<{
    run_id: string;
    scenario: string;
    ticks: number;
    serialize_restart_facts: boolean;
    reproduction: string;
    verdicts: Record<string, string>;
    invariants: Record<string, string>;
  }>;
  verdict_summary: Record<string, string>;
  criterion_reasons: Record<string, string>;
  invariants: Record<string, string>;
  verdict_deltas: {
    changed: Array<{ criterion: string; from: string; to: string; reason: string }>;
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

function loadRecord(): RulesRecord {
  return readJson<RulesRecord>(
    "docs/evidence/RULES-SUITE-STATE/rules-suite-verdicts-state.json",
  );
}

function criterionOutcomes(observations: TelemetryObservation[]): Record<string, string> {
  const suite = evaluateSuite("rules", observations);
  const out: Record<string, string> = {};
  for (const t of suite.tests) {
    for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  }
  return out;
}

function runDrivenThrowIn() {
  const scenario = loadScenario("eval/scenarios/5v5-restart-throwin.v1.json");
  const match = runHeadlessMatch({
    scenario,
    maxTicks: 1800,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    serializeRestartFacts: true,
  });
  return criterionOutcomes(match.observations);
}

describe("RULES-SUITE-STATE rules-suite verdict record", () => {
  it("durable record exists with the established shape", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("RULES-SUITE-STATE");
    expect(record.suite_id).toBe("rules");
    expect(record.suite_version).toBe("suite-rules-v1");
    expect(record.evidence_class).toBe("BOOKKEEPING");
    expect(record.schema_version).toBe(1);
    expect(record.lifecycle_phase_sync).toBe("core-owned");
    expect(typeof record.record_sha256).toBe("string");
    expect(record.record_sha256.length).toBeGreaterThan(0);
    expect(record.runs.length).toBe(5);
    expect(record.claims_not_made.length).toBeGreaterThan(0);
    // All 25 MATCH-* criteria are present in the verdict summary.
    expect(Object.keys(record.verdict_summary).length).toBe(25);
    expect(Object.keys(record.invariants).length).toBe(8);
  });

  it("record_sha256 is byte-reproducible (no wall-clock field, recomputes to the pinned value)", () => {
    const record = loadRecord();
    const copy: Record<string, unknown> = { ...record };
    delete copy.record_sha256;
    expect(sha256(JSON.stringify(copy))).toBe(record.record_sha256);
  });

  it("key verdicts: AWARD + TIMER-FREEZE are PASS on the driven streams", () => {
    const record = loadRecord();
    expect(record.verdict_summary["MATCH-THROW-IN-AWARD"]).toBe("PASS");
    expect(record.verdict_summary["MATCH-GOAL-KICK-AWARD"]).toBe("PASS");
    expect(record.verdict_summary["MATCH-TIMER-FREEZE"]).toBe("PASS");
  });

  it("key verdicts: blocked references stay BLOCKED, corner stays NOT_EVALUATED", () => {
    const record = loadRecord();
    expect(record.verdict_summary["MATCH-CORNER-KICK-CROSS"]).toBe("BLOCKED_MISSING_REFERENCE");
    expect(record.verdict_summary["MATCH-GOAL-KICK-DISTRIBUTION"]).toBe("BLOCKED_MISSING_REFERENCE");
    expect(record.verdict_summary["MATCH-CORNER-KICK-AWARD"]).toBe("NOT_EVALUATED");
  });

  it("key verdicts: the baseline semantics stay PASS / NOT_EVALUATED exactly", () => {
    const record = loadRecord();
    expect(record.verdict_summary["MATCH-KICKOFF-FREEZE"]).toBe("PASS");
    expect(record.verdict_summary["MATCH-SCORING-GOAL-DEVENT"]).toBe("PASS");
    expect(record.verdict_summary["MATCH-OUT-OF-PLAY-DETECT"]).toBe("PASS");
    expect(record.verdict_summary["MATCH-OUT-OF-PLAY-NO-LAST-TOUCH"]).toBe("PASS");
    expect(record.verdict_summary["MATCH-THROW-IN-PLACEMENT"]).toBe("NOT_EVALUATED");
    expect(record.verdict_summary["MATCH-THROW-IN-SERVE"]).toBe("NOT_EVALUATED");
    expect(record.verdict_summary["MATCH-THROW-IN-TIMER-FREEZE"]).toBe("NOT_EVALUATED");
    expect(record.verdict_summary["MATCH-GOAL-KICK-PLACEMENT"]).toBe("NOT_EVALUATED");
    expect(record.verdict_summary["MATCH-GOAL-KICK-TIMER-FREEZE"]).toBe("NOT_EVALUATED");
    expect(record.verdict_summary["MATCH-TIMER-DECREMENT"]).toBe("NOT_EVALUATED");
  });

  it("8 protected rules invariants: 7 PASS, corner-kick-award NOT_EVALUATED", () => {
    const record = loadRecord();
    for (const inv of RULES_INVARIANT_IDS) {
      expect(record.invariants[inv]).toBeDefined();
    }
    expect(record.invariants["rules-out-of-play-detect-evidence"]).toBe("PASS");
    expect(record.invariants["rules-out-of-play-no-last-touch-evidence"]).toBe("PASS");
    expect(record.invariants["rules-throw-in-award-evidence"]).toBe("PASS");
    expect(record.invariants["rules-goal-kick-award-evidence"]).toBe("PASS");
    expect(record.invariants["rules-goal-detection-evidence"]).toBe("PASS");
    expect(record.invariants["rules-kickoff-freeze-evidence"]).toBe("PASS");
    expect(record.invariants["rules-timer-freeze-evidence"]).toBe("PASS");
    expect(record.invariants["rules-corner-kick-award-evidence"]).toBe("NOT_EVALUATED");
  });

  it("verdict deltas vs RULES-SUITE-REGISTRATION: exactly the 3 AWARD / TIMER-FREEZE upgrades", () => {
    const record = loadRecord();
    const changed = record.verdict_deltas.changed;
    expect(changed.length).toBe(3);
    const byCriterion = Object.fromEntries(changed.map((d) => [d.criterion, d]));
    expect(byCriterion["MATCH-THROW-IN-AWARD"]).toMatchObject({ from: "NOT_EVALUATED", to: "PASS" });
    expect(byCriterion["MATCH-GOAL-KICK-AWARD"]).toMatchObject({ from: "NOT_EVALUATED", to: "PASS" });
    expect(byCriterion["MATCH-TIMER-FREEZE"]).toMatchObject({ from: "NOT_EVALUATED", to: "PASS" });
    for (const d of changed) {
      expect(d.reason).toContain("serializeRestartFacts");
    }
    // Blocked references and corner stay unchanged (NOT_EVALUATED / BLOCKED).
    const unchangedOutcomes = Object.fromEntries(
      record.verdict_deltas.unchanged.map((u) => [u.criterion, u.outcome]),
    );
    expect(unchangedOutcomes["MATCH-CORNER-KICK-CROSS"]).toBe("BLOCKED_MISSING_REFERENCE");
    expect(unchangedOutcomes["MATCH-GOAL-KICK-DISTRIBUTION"]).toBe("BLOCKED_MISSING_REFERENCE");
    expect(unchangedOutcomes["MATCH-CORNER-KICK-AWARD"]).toBe("NOT_EVALUATED");
    expect(unchangedOutcomes["MATCH-KICKOFF-FREEZE"]).toBe("PASS");
  });

  it("discriminating: a reverted AWARD verdict fails (the record is not a stale NOT_EVALUATED table)", () => {
    const record = loadRecord();
    // If the published table still reported the pre-serialization NOT_EVALUATED
    // for the award criteria, this would be the state we must NOT pin.
    const awardVerdicts = [
      record.verdict_summary["MATCH-THROW-IN-AWARD"],
      record.verdict_summary["MATCH-GOAL-KICK-AWARD"],
      record.verdict_summary["MATCH-TIMER-FREEZE"],
    ];
    expect(awardVerdicts.every((v) => v === "PASS")).toBe(true);
    // The driven runs must actually carry the executed events.
    const throwInLive = record.runs.find((r) => r.run_id === "rules-throw-in-live");
    const goalKickLive = record.runs.find((r) => r.run_id === "rules-goal-kick-live");
    expect(throwInLive).toBeDefined();
    expect(goalKickLive).toBeDefined();
    expect(throwInLive!.serialize_restart_facts).toBe(true);
    expect(throwInLive!.verdicts["MATCH-THROW-IN-AWARD"]).toBe("PASS");
    expect(throwInLive!.verdicts["MATCH-TIMER-FREEZE"]).toBe("PASS");
    expect(goalKickLive!.serialize_restart_facts).toBe(true);
    expect(goalKickLive!.verdicts["MATCH-GOAL-KICK-AWARD"]).toBe("PASS");
    expect(goalKickLive!.verdicts["MATCH-TIMER-FREEZE"]).toBe("PASS");
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
    "record is not hand-written: reproducing the driven throw-in run yields the pinned verdicts",
    () => {
      const verdicts = runDrivenThrowIn();
      expect(verdicts["MATCH-THROW-IN-AWARD"]).toBe("PASS");
      expect(verdicts["MATCH-TIMER-FREEZE"]).toBe("PASS");
      expect(verdicts["MATCH-GOAL-KICK-AWARD"]).toBe("NOT_EVALUATED");
      expect(verdicts["MATCH-CORNER-KICK-AWARD"]).toBe("NOT_EVALUATED");
      expect(verdicts["MATCH-CORNER-KICK-CROSS"]).toBe("BLOCKED_MISSING_REFERENCE");
      expect(verdicts["MATCH-GOAL-KICK-DISTRIBUTION"]).toBe("BLOCKED_MISSING_REFERENCE");

      const recorded = loadRecord().runs.find((r) => r.run_id === "rules-throw-in-live");
      expect(recorded).toBeDefined();
      expect(recorded!.verdicts["MATCH-THROW-IN-AWARD"]).toBe("PASS");
      expect(recorded!.verdicts["MATCH-TIMER-FREEZE"]).toBe("PASS");
      expect(recorded!.invariants["rules-throw-in-award-evidence"]).toBe("PASS");
    },
    120_000,
  );
});
