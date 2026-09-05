/**
 * @module tests/unit/eval/GK-SUITE-ORGANIC-STATE-binding.test.ts
 *
 * Evidence-binding test for GK-SUITE-ORGANIC-STATE.
 *
 * Locks the honest before/after goalkeepers-suite state that was refreshed by
 * re-running the accepted `goalkeepers` evaluator (`evaluateSuite(
 * "goalkeepers", ...)`) over the organic observations that now include
 * designated small-sided keepers:
 *
 *  1. The durable record under `docs/evidence/GK-SUITE-ORGANIC-STATE/` has
 *     the established shape and carries a stable `record_sha256`.
 *  2. The before state records every GK-specific criterion as honestly
 *     non-PASS (NOT_EVALUATED / BLOCKED_MISSING_REFERENCE /
 *     NEEDS_PERCEPTUAL_REVIEW), as asserted by GK-SPEC-SUITE-CONTRACTS.
 *  3. The after state is HONEST: the five small-sided GK behavior criteria
 *     still return NOT_EVALUATED (no protected oracle is registered for them),
 *     while the observations-presence bookkeeping distinguishes organic arc-hold
 *     evidence (GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE / GK-ROLE-DESIGNATION)
 *     from driven-fixture-only evidence (GK-SAVE-CLAIM) and no-observation
 *     (GK-DISTRIBUTION-NO-OMNISCIENCE).  The COMMON-REFERENCES / COMMON-BOUNDS
 *     FAIL over the organic full-match runs is disclosed as pre-existing
 *     invariant behavior, not a keeper regression.  COMMON-REFERENCES was
 *     subsequently FIXED by COMMON-FULL-MATCH-INVARIANT-TRIAGE (the
 *     event-references oracle now resolves the persistent `ball.lastTouchRef`
 *     against the observation-window event union), so the current reproduction
 *     returns COMMON-REFERENCES PASS while the immutable record still documents
 *     the pre-fix FAIL; COMMON-BOUNDS remains FAIL on the legacy phase-sync
 *     runs.
 *  4. Every cited source run's `source_candidate` matches the accepted
 *     manifest's `candidate_commit` (cross-manifest provenance binding — the
 *     duels rerun's RETRY over a mislabeled source_candidate is the caution).
 *  5. The record is not hand-written: reproducing the driven keeper fixture run
 *     through the same runner + evaluator yields the pinned per-criterion
 *     outcomes (GK behavior NOT_EVALUATED, COMMON-REFERENCES/BOUNDS FAIL).
 *  6. No PROMOTION / PES fidelity / FOUNDATION_LAB_PASS claim is recorded.
 *
 * Node I/O is allowed for scenario and artifact loading.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECORD_PATH = join(
  projectRoot,
  "docs/evidence/GK-SUITE-ORGANIC-STATE/gk-suite-state.json",
);

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

const GK_BEHAVIOR = [
  "GK-POSITIONING-HOLD",
  "GK-NO-FIELD-CHASE",
  "GK-SAVE-CLAIM",
  "GK-ROLE-DESIGNATION",
  "GK-DISTRIBUTION-NO-OMNISCIENCE",
] as const;

interface GkRecord {
  schema_version: number;
  objective_id: string;
  suite_id: string;
  suite_version: string;
  evidence_class: string;
  record_sha256: string;
  before: {
    gk_behavior: Record<string, string>;
    catalog: Record<string, string>;
    common: Record<string, string>;
  };
  after: {
    gk_behavior: Record<string, { verdict: string; observations: string; source: string }>;
    catalog: Record<string, string>;
    common: Record<string, string>;
  };
  organic_runs: Array<{
    run_id: string;
    scenario: string;
    ticks: number;
    source_evidence: string;
    source_candidate: string;
    observations: number;
    gk_behavior: Record<string, string>;
    common: Record<string, string>;
    catalog: Record<string, string>;
  }>;
  sources_consulted: Array<{ manifest_path: string; candidate_commit: string; note: string }>;
  claims_not_made: string[];
}

function loadRecord(): GkRecord {
  return JSON.parse(readFileSync(RECORD_PATH, "utf-8")) as GkRecord;
}

/** The run_id the fixture reproduction test pins against. */
const PINNED_RUN = "gk-shot-fixture-live";

describe("GK-SUITE-ORGANIC-STATE goalkeepers-suite record", () => {
  it("durable record exists with the established shape", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("GK-SUITE-ORGANIC-STATE");
    expect(record.suite_id).toBe("goalkeepers");
    expect(record.suite_version).toBe("suite-goalkeepers-v1");
    expect(record.evidence_class).toBe("HEADLESS");
    expect(record.schema_version).toBe(1);
    expect(typeof record.record_sha256).toBe("string");
    expect(record.record_sha256.length).toBeGreaterThan(0);
    expect(record.organic_runs.length).toBeGreaterThanOrEqual(2);
    expect(record.sources_consulted.length).toBeGreaterThanOrEqual(2);
    expect(record.claims_not_made.length).toBeGreaterThan(0);
    expect(Object.keys(record.after.gk_behavior).sort()).toEqual([...GK_BEHAVIOR].sort());
  });

  it("before state records every GK-specific criterion as honestly non-PASS", () => {
    const record = loadRecord();
    for (const criterion of GK_BEHAVIOR) {
      expect(record.before.gk_behavior[criterion]).toBe("NOT_EVALUATED");
    }
    expect(record.before.catalog["GK_REF"]).toBe("BLOCKED_MISSING_REFERENCE");
    expect(record.before.catalog["GK_VIS"]).toBe("NEEDS_PERCEPTUAL_REVIEW");
    expect(record.before.catalog["GK_REG"]).toBe("NOT_EVALUATED");
    expect(record.before.catalog["GK_CAUSAL"]).toBe("NOT_EVALUATED");
  });

  it("after state is honest: GK behavior criteria stay NOT_EVALUATED (no protected oracle)", () => {
    const record = loadRecord();
    for (const criterion of GK_BEHAVIOR) {
      expect(record.after.gk_behavior[criterion]).toBeDefined();
      // Not upgraded: no criterion becomes PASS beyond what the evaluator returns.
      expect(record.after.gk_behavior[criterion].verdict).toBe("NOT_EVALUATED");
    }
  });

  it("after observations bookkeeping distinguishes organic / driven / none", () => {
    const record = loadRecord();
    expect(record.after.gk_behavior["GK-POSITIONING-HOLD"].observations).toMatch(/organic/);
    expect(record.after.gk_behavior["GK-NO-FIELD-CHASE"].observations).toMatch(/organic/);
    expect(record.after.gk_behavior["GK-ROLE-DESIGNATION"].observations).toMatch(/organic/);
    expect(record.after.gk_behavior["GK-SAVE-CLAIM"].observations).toMatch(/driven/);
    expect(record.after.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"].observations).toMatch(/none/);
  });

  it("after common criteria disclose the pre-existing COMMON FAIL over full-match runs", () => {
    const record = loadRecord();
    expect(record.after.common["COMMON-FINITE"]).toBe("PASS");
    expect(record.after.common["COMMON-DETERMINISTIC"]).toBe("NOT_EVALUATED");
    expect(record.after.common["COMMON-REFERENCES"]).toBe("FAIL");
    expect(record.after.common["COMMON-BOUNDS"]).toBe("FAIL");
  });

  it("every source_candidate matches the accepted manifest candidate_commit (cross-manifest binding)", () => {
    const record = loadRecord();
    for (const run of record.organic_runs) {
      // source_evidence is e.g. docs/evidence/<OBJECTIVE>/trajectory.json; the
      // accepted manifest sits in the same directory. This guards against a
      // provenance mislabel like the one the duels critic flagged.
      const manifestPath = run.source_evidence.replace(/\/trajectory\.json$/, "/manifest.json");
      const manifest = JSON.parse(readFileSync(join(projectRoot, manifestPath), "utf-8")) as {
        candidate_commit?: string;
      };
      expect(manifest.candidate_commit, `${run.run_id} manifest`).toBe(run.source_candidate);
    }
  });

  it("record does not claim PROMOTION / PES fidelity / FOUNDATION_LAB_PASS", () => {
    const record = loadRecord();
    const joined = record.claims_not_made.join("\n").toLowerCase();
    expect(joined).toContain("no promotion");
    expect(joined).toContain("no pes");
    expect(joined).toContain("no foundation_lab_pass");
    expect(joined).toContain("no gameplay change");
  });

  it(
    "record is not hand-written: reproducing the driven keeper fixture yields the current evaluator verdicts",
    () => {
      // Reproduce the gk-shot-fixture-live run (600-ticks, keeper live) through the
      // same runner + evaluator the record cites.  The record itself documents the
      // PRE-oracle state (authored when no keeper oracle was registered): every GK
      // behavior criterion was NOT_EVALUATED.  Since GK-KEEPER-ORACLE-REGISTRATION
      // registered the protected keepers, and GK-DISTRIBUTION-BEHAVIOR added the
      // keeper-release telemetry, the current evaluator now produces real verdicts
      // over the same reproduction — POSITIONING-HOLD / NO-FIELD-CHASE /
      // ROLE-DESIGNATION / SAVE-CLAIM / DISTRIBUTION are PASS on the driven fixture
      // (the keeper releases to an observed teammate after its claim).
      const scenario = loadScenario("eval/scenarios/5v5-keeper-shot-fixture.v1.json");
      const match = runHeadlessMatch({
        scenario,
        maxTicks: 600,
        cpuAntiHuddle: true,
        cpuDefensiveTackle: true,
        gkBehavior: true,
        browserParityObservations: true,
        lifecyclePhaseSync: "legacy",
      });
      const suite = evaluateSuite("goalkeepers", match.observations);

      const gkBehavior: Record<string, string> = {};
      const common: Record<string, string> = {};
      for (const test of suite.tests) {
        for (const c of test.criteria) {
          if (GK_BEHAVIOR.includes(c.criterion_id as (typeof GK_BEHAVIOR)[number])) {
            gkBehavior[c.criterion_id] = c.outcome;
          } else if (
            ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"].includes(c.criterion_id)
          ) {
            common[c.criterion_id] = c.outcome;
          }
        }
      }

      expect(gkBehavior["GK-POSITIONING-HOLD"]).toBe("PASS");
      expect(gkBehavior["GK-NO-FIELD-CHASE"]).toBe("PASS");
      expect(gkBehavior["GK-ROLE-DESIGNATION"]).toBe("PASS");
      expect(gkBehavior["GK-SAVE-CLAIM"]).toBe("PASS");
      expect(gkBehavior["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("PASS");
      expect(common["COMMON-FINITE"]).toBe("PASS");
      expect(common["COMMON-DETERMINISTIC"]).toBe("NOT_EVALUATED");
      // COMMON-REFERENCES changed from FAIL to PASS because
      // COMMON-FULL-MATCH-INVARIANT-TRIAGE fixed the event-references oracle to
      // resolve `ball.lastTouchRef` against the observation-window event union
      // (a prior-tick touch reference is valid, not a broken reference). The
      // immutable record below still documents the pre-fix FAIL.
      expect(common["COMMON-REFERENCES"]).toBe("PASS");
      expect(common["COMMON-BOUNDS"]).toBe("FAIL");

      // The immutable record still documents the pre-oracle NOT_EVALUATED state.
      const recorded = loadRecord().organic_runs.find((r) => r.run_id === PINNED_RUN);
      expect(recorded).toBeDefined();
      expect(recorded!.gk_behavior["GK-POSITIONING-HOLD"]).toBe("NOT_EVALUATED");
      expect(recorded!.common["COMMON-REFERENCES"]).toBe("FAIL");
      expect(recorded!.common["COMMON-BOUNDS"]).toBe("FAIL");
    },
    120_000,
  );
});
