/**
 * @module tests/unit/eval/fouls-aggregate-honesty-rerun-binding.test.ts
 *
 * Evidence-binding test for FOULS-AGGREGATE-HONESTY-RERUN.
 *
 * Locks the honest re-published aggregate verdict state produced by re-running
 * the registered `goalkeepers` and `fouls` evaluator suites over their accepted
 * streams (the RULES-SUITE-STATE-RERUN BOOKKEEPING pattern):
 *
 *   - `goalkeepers` (suite-goalkeepers-v1): the GK-*-REG canary converts the
 *     catalog `reg` key NOT_EVALUATED -> executed PASS, so the post-two-run
 *     aggregate moves from the SUITE-DETERMINISTIC-TWO-RUN baseline 9/0/2/1/1
 *     to 10/0/1/1/1.  GK-*-REF stay BLOCKED_MISSING_REFERENCE, GK-*-VIS stay
 *     NEEDS_PERCEPTUAL_REVIEW and GK-*-CAUSAL stay NOT_EVALUATED.
 *   - `fouls` (suite-fouls-v1): 3 of the 5 FOULS_CARDS_SPEC §10 criteria are
 *     registered (FOUL-DETECT, FOUL-CLEAN-TACKLE, FREE-KICK-AWARD) and all
 *     PASS on the accepted streams; CARD-ISSUED and ADVANTAGE-PLAYED stay
 *     NAMED-NOT-REGISTERED.
 *
 * It pins the record shape, the byte-reproducible `record_sha256`, the exact
 * deltas with source-stream attribution, the power-guard eligibility exclusion
 * (analogous to the RULES anti-huddle exclusion), the guard that every
 * reproduced stream is character-identical to its accepted state-hash pin, and
 * that no suite-level PASS / PROMOTION / PES / FOUNDATION_LAB_PASS claim is
 * recorded.  The decisive runs (GK canary reg=PASS; freekick-organic
 * FREE-KICK-AWARD=PASS) are reproduced through the production runner + evaluator
 * so the record is demonstrably not hand-written.
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
  "docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/fouls-aggregate-honesty-rerun.json",
);

const GK_REG_CRITERIA = [
  "GK-REA-001-REG",
  "GK-WF-001-REG",
  "GK-LEG-001-REG",
  "GK-PARRY-001-REG",
  "GK-REC-001-REG",
  "GK-HIGH-001-REG",
] as const;

interface FoulsAggregateRecord {
  schema_version: number;
  objective_id: string;
  produced_by: string;
  evidence_class: string;
  record_sha256: string;
  guard_state: {
    all_gk_streams_character_identical_to_accepted: boolean;
    all_fouls_streams_character_identical_to_accepted: boolean;
  };
  suites: {
    goalkeepers: {
      suite_id: string;
      suite_version: string;
      baseline: {
        source_record: string;
        baseline_record_sha256: string;
        verdict_counts: Record<string, number>;
        verdicts: {
          gk_behavior: Record<string, string>;
          common: Record<string, string>;
          catalog: Record<string, string>;
        };
      };
      current: {
        verdict_counts: Record<string, number>;
        verdicts: Record<string, string>;
      };
      verdict_delta: {
        changed: Array<{ criterion: string; from: string; to: string; source_streams: string[] }>;
        unchanged_count: number;
        summary: string;
      };
    };
    fouls: {
      suite_id: string;
      suite_version: string;
      registered_criteria: string[];
      named_not_registered: string[];
      per_criterion: Record<string, { verdict: string; source_streams: string[] }>;
      verdict_counts: Record<string, number>;
      power_guard_streams: string[];
    };
  };
  disclosures: string[];
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

function loadRecord(): FoulsAggregateRecord {
  return readJson<FoulsAggregateRecord>(
    "docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/fouls-aggregate-honesty-rerun.json",
  );
}

function classBucket(outcomes: string[]): string {
  if (outcomes.includes("FAIL")) return "FAIL";
  if (outcomes.includes("PASS")) return "PASS";
  if (outcomes.includes("BLOCKED_MISSING_REFERENCE")) return "BLOCKED_MISSING_REFERENCE";
  if (outcomes.includes("NEEDS_PERCEPTUAL_REVIEW")) return "NEEDS_PERCEPTUAL_REVIEW";
  return "NOT_EVALUATED";
}

function gkReg(observations: TelemetryObservation[]): string {
  const suite = evaluateSuite("goalkeepers", observations);
  const outcomes: string[] = [];
  for (const t of suite.tests) {
    for (const c of t.criteria) {
      if ((GK_REG_CRITERIA as readonly string[]).includes(c.criterion_id)) outcomes.push(c.outcome);
    }
  }
  return classBucket(outcomes);
}

function foulVerdict(observations: TelemetryObservation[], criterionId: string): string {
  const suite = evaluateSuite("fouls", observations);
  for (const t of suite.tests) {
    for (const c of t.criteria) if (c.criterion_id === criterionId) return c.outcome;
  }
  return "NOT_EVALUATED";
}

describe("FOULS-AGGREGATE-HONESTY-RERUN aggregate verdict record", () => {
  it("durable record exists with the established shape", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("FOULS-AGGREGATE-HONESTY-RERUN");
    expect(record.schema_version).toBe(1);
    expect(record.evidence_class).toBe("BOOKKEEPING");
    expect(typeof record.record_sha256).toBe("string");
    expect(record.record_sha256.length).toBeGreaterThan(0);
    expect(record.suites.goalkeepers.suite_id).toBe("goalkeepers");
    expect(record.suites.goalkeepers.suite_version).toBe("suite-goalkeepers-v1");
    expect(record.suites.fouls.suite_id).toBe("fouls");
    expect(record.suites.fouls.suite_version).toBe("suite-fouls-v1");
    expect(record.claims_not_made.length).toBeGreaterThan(0);
  });

  it("record_sha256 is byte-reproducible (no wall-clock field, recomputes to the pinned value)", () => {
    const record = loadRecord();
    const copy: Record<string, unknown> = { ...record };
    delete copy.record_sha256;
    expect(JSON.stringify(copy)).not.toMatch(/\d{4}-\d{2}-\d{2}T/); // no wall-clock field
    expect(sha256(JSON.stringify(copy))).toBe(record.record_sha256);
  });

  it("goalkeepers aggregate moves 9/0/2/1/1 -> 10/0/1/1/1 with only the catalog `reg` key changed (GK-*-REG NOT_EVALUATED -> PASS)", () => {
    const record = loadRecord();
    const gk = record.suites.goalkeepers;
    expect(gk.baseline.verdict_counts).toEqual({
      PASS: 9,
      FAIL: 0,
      NOT_EVALUATED: 2,
      BLOCKED_MISSING_REFERENCE: 1,
      NEEDS_PERCEPTUAL_REVIEW: 1,
    });
    expect(gk.current.verdict_counts).toEqual({
      PASS: 10,
      FAIL: 0,
      NOT_EVALUATED: 1,
      BLOCKED_MISSING_REFERENCE: 1,
      NEEDS_PERCEPTUAL_REVIEW: 1,
    });
    // The single delta is the GK-*-REG conversion.
    expect(gk.verdict_delta.changed).toHaveLength(1);
    const delta = gk.verdict_delta.changed[0];
    expect(delta.criterion).toBe("reg");
    expect(delta.from).toBe("NOT_EVALUATED");
    expect(delta.to).toBe("PASS");
    expect([...delta.source_streams].sort()).toEqual(
      ["gk-continuous-live", "gk-shot-fixture-live", "gk-release-fixture-live"].sort(),
    );
    expect(gk.verdict_delta.unchanged_count).toBe(12);
  });

  it("the other GK catalog keys stay: REF=BLOCKED, VIS=NEEDS_PERCEPTUAL_REVIEW, CAUSAL=NOT_EVALUATED", () => {
    const record = loadRecord();
    const v = record.suites.goalkeepers.current.verdicts;
    expect(v["ref"]).toBe("BLOCKED_MISSING_REFERENCE");
    expect(v["vis"]).toBe("NEEDS_PERCEPTUAL_REVIEW");
    expect(v["causal"]).toBe("NOT_EVALUATED");
    // The nine behavior + common keys all stay PASS.
    for (const key of [
      "GK-POSITIONING-HOLD",
      "GK-NO-FIELD-CHASE",
      "GK-SAVE-CLAIM",
      "GK-ROLE-DESIGNATION",
      "GK-DISTRIBUTION-NO-OMNISCIENCE",
      "COMMON-FINITE",
      "COMMON-DETERMINISTIC",
      "COMMON-REFERENCES",
      "COMMON-BOUNDS",
    ]) {
      expect(v[key]).toBe("PASS");
    }
  });

  it("every reproduced GK stream is character-identical to its accepted state-hash pin", () => {
    const record = loadRecord();
    expect(record.guard_state.all_gk_streams_character_identical_to_accepted).toBe(true);
    expect(record.guard_state.all_fouls_streams_character_identical_to_accepted).toBe(true);
  });

  it("fouls aggregate: 3 of the 5 §10 criteria registered, all PASS; card/advantage named-not-registered", () => {
    const record = loadRecord();
    const fouls = record.suites.fouls;
    expect([...fouls.registered_criteria].sort()).toEqual(
      ["FOUL-DETECT", "FOUL-CLEAN-TACKLE", "FREE-KICK-AWARD"].sort(),
    );
    expect([...fouls.named_not_registered].sort()).toEqual(
      ["CARD-ISSUED", "ADVANTAGE-PLAYED"].sort(),
    );
    expect(fouls.per_criterion["FOUL-DETECT"].verdict).toBe("PASS");
    expect(fouls.per_criterion["FOUL-CLEAN-TACKLE"].verdict).toBe("PASS");
    expect(fouls.per_criterion["FREE-KICK-AWARD"].verdict).toBe("PASS");
    expect(fouls.per_criterion["FREE-KICK-AWARD"].source_streams).toEqual(["freekick-organic"]);
    expect(fouls.verdict_counts).toEqual({
      PASS: 3,
      FAIL: 0,
      NOT_EVALUATED: 0,
      BLOCKED_MISSING_REFERENCE: 0,
      NEEDS_PERCEPTUAL_REVIEW: 0,
    });
    // The power-guard (no-foul free-kick) streams are excluded from the genuine
    // FREE-KICK-AWARD aggregate and listed separately.
    expect([...fouls.power_guard_streams].sort()).toEqual(
      ["freekick-antihuddle-window", "freekick-human-serve"].sort(),
    );
  });

  it("record does not claim PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS", () => {
    const record = loadRecord();
    const joined = record.claims_not_made.join("\n").toLowerCase();
    expect(joined).toContain("no suite-level pass");
    expect(joined).toContain("no promotion");
    expect(joined).toContain("no pes");
    expect(joined).toContain("no foundation_lab_pass");
    expect(joined).toContain("no invented reference");
  });

  it(
    "record is not hand-written: gk-release-fixture yields GK-*-REG PASS through the canary, and freekick-organic yields FREE-KICK-AWARD PASS",
    () => {
      // Reproduce the smallest accepted GK stream (gk-release-fixture, 300 ticks).
      const gkRelease = runHeadlessMatch({
        scenario: loadScenario("eval/scenarios/5v5-keeper-release-fixture.v1.json"),
        maxTicks: 300,
        cpuAntiHuddle: true,
        cpuDefensiveTackle: true,
        gkBehavior: true,
        browserParityObservations: true,
        lifecyclePhaseSync: "core-owned",
      });
      expect(gkReg(gkRelease.observations)).toBe("PASS");

      // Reproduce the organic foul -> free-kick consequence stream (600 ticks).
      const organic = runHeadlessMatch({
        scenario: loadScenario("eval/scenarios/3v3-press-scenario.v1.json"),
        maxTicks: 600,
        cpuAntiHuddle: false,
        lifecyclePhaseSync: "core-owned",
        cpuDefensiveTackle: true,
        detectFouls: true,
        awardFreeKicks: true,
        serializeRestartFacts: true,
      });
      expect(foulVerdict(organic.observations, "FREE-KICK-AWARD")).toBe("PASS");
    },
    300_000,
  );

  it("the fouls FREE-KICK-AWARD power-guard streams are deliberately FAIL (a free kick without a foul)", () => {
    // Reproduce the small anti-huddle freeKickWindow control (60 ticks) and
    // confirm the power guard FAILs, matching the record.
    const window = runHeadlessMatch({
      scenario: loadScenario("eval/scenarios/5v5-human-restart-throwin.v1.json"),
      maxTicks: 60,
      cpuAntiHuddle: true,
      lifecyclePhaseSync: "core-owned",
      browserParityObservations: true,
      serializeRestartFacts: true,
      freeKickWindow: { team: "team-a", takerPlayerId: "player-1", position: { x: 30, y: 10 }, countdown: 5 },
    });
    expect(foulVerdict(window.observations, "FREE-KICK-AWARD")).toBe("FAIL");
  }, 60_000);
});
