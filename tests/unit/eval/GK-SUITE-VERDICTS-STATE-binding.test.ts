/**
 * @module tests/unit/eval/GK-SUITE-VERDICTS-STATE-binding.test.ts
 *
 * Evidence-binding test for GK-SUITE-VERDICTS-STATE.
 *
 * Locks the honest post-oracle goalkeepers-suite verdict state produced by
 * re-running the accepted `goalkeepers` evaluator (`evaluateSuite(
 * "goalkeepers", ...)`) WITH both the registered protected oracles
 * (GK-KEEPER-ORACLE-REGISTRATION) AND the distribution behavior
 * (GK-DISTRIBUTION-BEHAVIOR) live:
 *
 *  1. The durable record under `docs/evidence/GK-SUITE-VERDICTS-STATE/` has
 *     the established shape and carries a stable `record_sha256`.
 *  2. The before state records the immutable pre-oracle state (every GK
 *     behavior criterion NOT_EVALUATED, catalog REF/VIS blocked/pending).
 *  3. The after state is the honest executed verdict: the three organic-driven
 *     GK behavior criteria (POSITIONING-HOLD / NO-FIELD-CHASE /
 *     ROLE-DESIGNATION) are PASS with organic observations; SAVE-CLAIM is PASS
 *     only from the driven fixture (organic run NOT_EVALUATED — disclosed);
 *     DISTRIBUTION is PASS on the driven fixture (2 releases) with the organic
 *     continuous run honestly NOT_EVALUATED / 0 releases (disclosed).
 *  4. COMMON criteria: COMMON-FINITE PASS; COMMON-DETERMINISTIC
 *     NOT_EVALUATED (single-run, duels precedent); COMMON-REFERENCES PASS (the
 *     COMMON-FULL-MATCH-INVARIANT-TRIAGE fix); COMMON-BOUNDS residual FAIL on
 *     the legacy phase-sync runs (disclosed, not widened).
 *  5. Catalog criteria: GK-*-REF stay BLOCKED_MISSING_REFERENCE and GK-*-VIS
 *     stay NEEDS_PERCEPTUAL_REVIEW — no criterion upgraded beyond what the
 *     executed evaluator returns.
 *  6. Every cited source run's `source_candidate` and every
 *     `sources_consulted.referenced_sha256` match the accepted manifest / the
 *     accepted record verbatim (cross-manifest provenance binding).
 *  7. The record is not hand-written: reproducing the driven keeper fixture run
 *     through the same runner + evaluator yields the pinned per-criterion
 *     outcomes.
 *  8. No PROMOTION / PES fidelity / FOUNDATION_LAB_PASS claim is recorded.
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

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECORD_PATH = join(
  projectRoot,
  "docs/evidence/GK-SUITE-VERDICTS-STATE/gk-suite-verdicts-state.json",
);

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(projectRoot, relativePath), "utf-8")) as T;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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
    distribution: { releases: number; release_ticks: number[]; release_targets: string[] };
  }>;
  sources_consulted: Array<{
    manifest_path: string;
    candidate_commit: string;
    referenced_sha256: string | null;
    note: string;
  }>;
  claims_not_made: string[];
}

function loadRecord(): GkRecord {
  return readJson<GkRecord>("docs/evidence/GK-SUITE-VERDICTS-STATE/gk-suite-verdicts-state.json");
}

function runReproduce(scenarioPath: string, maxTicks: number) {
  const scenario = loadScenario(scenarioPath);
  const match = runHeadlessMatch({
    scenario,
    maxTicks,
    cpuAntiHuddle: true,
    cpuDefensiveTackle: true,
    gkBehavior: true,
    browserParityObservations: true,
    lifecyclePhaseSync: "legacy",
  });
  const suite = evaluateSuite("goalkeepers", match.observations);
  const gk: Record<string, string> = {};
  const common: Record<string, string> = {};
  for (const test of suite.tests) {
    for (const c of test.criteria) {
      if (GK_BEHAVIOR.includes(c.criterion_id as (typeof GK_BEHAVIOR)[number])) {
        gk[c.criterion_id] = c.outcome;
      } else if (
        ["COMMON-FINITE", "COMMON-DETERMINISTIC", "COMMON-REFERENCES", "COMMON-BOUNDS"].includes(c.criterion_id)
      ) {
        common[c.criterion_id] = c.outcome;
      }
    }
  }
  return { gk, common };
}

describe("GK-SUITE-VERDICTS-STATE goalkeepers-suite record", () => {
  it("durable record exists with the established shape", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("GK-SUITE-VERDICTS-STATE");
    expect(record.suite_id).toBe("goalkeepers");
    expect(record.suite_version).toBe("suite-goalkeepers-v1");
    expect(record.evidence_class).toBe("HEADLESS");
    expect(record.schema_version).toBe(1);
    expect(typeof record.record_sha256).toBe("string");
    expect(record.record_sha256.length).toBeGreaterThan(0);
    expect(record.organic_runs.length).toBeGreaterThanOrEqual(2);
    expect(record.sources_consulted.length).toBeGreaterThanOrEqual(4);
    expect(record.claims_not_made.length).toBeGreaterThan(0);
    expect(Object.keys(record.after.gk_behavior).sort()).toEqual([...GK_BEHAVIOR].sort());
  });

  it("before state records every GK-specific criterion as honestly non-PASS (pre-oracle)", () => {
    const record = loadRecord();
    for (const criterion of GK_BEHAVIOR) {
      expect(record.before.gk_behavior[criterion]).toBe("NOT_EVALUATED");
    }
    expect(record.before.catalog["GK_REF"]).toBe("BLOCKED_MISSING_REFERENCE");
    expect(record.before.catalog["GK_VIS"]).toBe("NEEDS_PERCEPTUAL_REVIEW");
    expect(record.before.catalog["GK_REG"]).toBe("NOT_EVALUATED");
    expect(record.before.catalog["GK_CAUSAL"]).toBe("NOT_EVALUATED");
  });

  it("after state: five GK behavior criteria are PASS from the executed evaluator", () => {
    const record = loadRecord();
    for (const criterion of GK_BEHAVIOR) {
      expect(record.after.gk_behavior[criterion]).toBeDefined();
      expect(record.after.gk_behavior[criterion].verdict).toBe("PASS");
      expect(record.after.gk_behavior[criterion].source).toContain("executed evaluator");
    }
  });

  it("after observations bookkeeping distinguishes organic / driven correctly", () => {
    const record = loadRecord();
    expect(record.after.gk_behavior["GK-POSITIONING-HOLD"].observations).toMatch(/^organic$/);
    expect(record.after.gk_behavior["GK-NO-FIELD-CHASE"].observations).toMatch(/^organic$/);
    expect(record.after.gk_behavior["GK-ROLE-DESIGNATION"].observations).toMatch(/^organic$/);
    expect(record.after.gk_behavior["GK-SAVE-CLAIM"].observations).toMatch(/driven/);
    expect(record.after.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"].observations).toMatch(/driven/);
  });

  it("after common criteria: FINITE PASS, DETERMINISTIC NOT_EVALUATED, REFERENCES PASS, BOUNDS residual FAIL", () => {
    const record = loadRecord();
    expect(record.after.common["COMMON-FINITE"]).toBe("PASS");
    expect(record.after.common["COMMON-DETERMINISTIC"]).toBe("NOT_EVALUATED");
    expect(record.after.common["COMMON-REFERENCES"]).toBe("PASS");
    expect(record.after.common["COMMON-BOUNDS"]).toBe("FAIL");
  });

  it("after catalog: GK-*-REF stays BLOCKED_MISSING_REFERENCE, GK-*-VIS stays NEEDS_PERCEPTUAL_REVIEW", () => {
    const record = loadRecord();
    expect(record.after.catalog["ref"]).toBe("BLOCKED_MISSING_REFERENCE");
    expect(record.after.catalog["vis"]).toBe("NEEDS_PERCEPTUAL_REVIEW");
    expect(record.after.catalog["reg"]).toBe("NOT_EVALUATED");
    expect(record.after.catalog["causal"]).toBe("NOT_EVALUATED");
  });

  it("per-run distribution disclose: organic continuous 0 releases; driven fixture releases at 408/433 to player-6", () => {
    const record = loadRecord();
    const cont = record.organic_runs.find((r) => r.run_id === "gk-continuous-live");
    const fix = record.organic_runs.find((r) => r.run_id === "gk-shot-fixture-live");
    expect(cont).toBeDefined();
    expect(fix).toBeDefined();
    expect(cont!.distribution.releases).toBe(0);
    expect(cont!.distribution.release_ticks).toEqual([]);
    expect(cont!.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("NOT_EVALUATED");
    expect(fix!.distribution.releases).toBe(2);
    expect(fix!.distribution.release_ticks).toEqual([408, 433]);
    expect(fix!.distribution.release_targets).toEqual(["player-6", "player-6"]);
    expect(fix!.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("PASS");
  });

  it("every source_candidate matches the accepted manifest candidate_commit (cross-manifest binding)", () => {
    const record = loadRecord();
    for (const run of record.organic_runs) {
      const manifestPath = run.source_evidence.replace(/\/trajectory\.json$/, "/manifest.json");
      const manifest = readJson<{ candidate_commit?: string }>(manifestPath);
      expect(manifest.candidate_commit, `${run.run_id} manifest`).toBe(run.source_candidate);
    }
  });

  it("sources_consulted referenced_sha256 values match the accepted artifacts verbatim", () => {
    const record = loadRecord();
    for (const src of record.sources_consulted) {
      expect(src.candidate_commit.length).toBeGreaterThan(0);
      if (src.referenced_sha256 === null) continue;
      if (src.manifest_path.includes("GK-KEEPER-ORACLE-REGISTRATION")) {
        expect(src.referenced_sha256).toBe(
          readJson<{ record_sha256: string }>(
            "docs/evidence/GK-KEEPER-ORACLE-REGISTRATION/gk-suite-state.json",
          ).record_sha256,
        );
      } else if (src.manifest_path.includes("GK-SUITE-ORGANIC-STATE")) {
        expect(src.referenced_sha256).toBe(
          readJson<{ record_sha256: string }>(
            "docs/evidence/GK-SUITE-ORGANIC-STATE/gk-suite-state.json",
          ).record_sha256,
        );
      } else if (src.manifest_path.includes("GK-DISTRIBUTION-BEHAVIOR")) {
        const m = readJson<{ evidence?: { trajectory?: { sha256?: string } } }>(src.manifest_path);
        expect(src.referenced_sha256).toBe(m.evidence?.trajectory?.sha256);
      } else if (src.manifest_path.includes("COMMON-FULL-MATCH-INVARIANT-TRIAGE")) {
        const m = readJson<{ evidence?: { deterministic_audit_artifact?: { sha256?: string } } }>(src.manifest_path);
        expect(src.referenced_sha256).toBe(m.evidence?.deterministic_audit_artifact?.sha256);
      } else if (src.manifest_path.includes("GK-5V5-ADAPTER-BEHAVIOR")) {
        const m = readJson<{ evidence?: { trajectory?: { sha256?: string } } }>(src.manifest_path);
        expect(src.referenced_sha256).toBe(m.evidence?.trajectory?.sha256);
      }
    }
  });

  it("record does not claim PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / criterion upgrade", () => {
    const record = loadRecord();
    const joined = record.claims_not_made.join("\n").toLowerCase();
    expect(joined).toContain("no promotion");
    expect(joined).toContain("no pes");
    expect(joined).toContain("no foundation_lab_pass");
    expect(joined).toContain("no gameplay change");
    expect(joined).toContain("no gk criterion is upgraded");
    expect(joined).toContain("no invented reference");
  });

  it(
    "record is not hand-written: reproducing the driven keeper fixture yields the pinned verdicts",
    () => {
      const suite = runReproduce("eval/scenarios/5v5-keeper-shot-fixture.v1.json", 600);
      expect(suite.gk["GK-POSITIONING-HOLD"]).toBe("PASS");
      expect(suite.gk["GK-NO-FIELD-CHASE"]).toBe("PASS");
      expect(suite.gk["GK-ROLE-DESIGNATION"]).toBe("PASS");
      expect(suite.gk["GK-SAVE-CLAIM"]).toBe("PASS");
      expect(suite.gk["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("PASS");
      expect(suite.common["COMMON-FINITE"]).toBe("PASS");
      expect(suite.common["COMMON-DETERMINISTIC"]).toBe("NOT_EVALUATED");
      expect(suite.common["COMMON-REFERENCES"]).toBe("PASS");
      expect(suite.common["COMMON-BOUNDS"]).toBe("FAIL");

      const recorded = loadRecord().organic_runs.find((r) => r.run_id === "gk-shot-fixture-live");
      expect(recorded).toBeDefined();
      expect(recorded!.gk_behavior["GK-POSITIONING-HOLD"]).toBe("PASS");
      expect(recorded!.gk_behavior["GK-NO-FIELD-CHASE"]).toBe("PASS");
      expect(recorded!.gk_behavior["GK-ROLE-DESIGNATION"]).toBe("PASS");
      expect(recorded!.gk_behavior["GK-SAVE-CLAIM"]).toBe("PASS");
      expect(recorded!.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("PASS");
      expect(recorded!.common["COMMON-REFERENCES"]).toBe("PASS");
      expect(recorded!.common["COMMON-BOUNDS"]).toBe("FAIL");
    },
    120_000,
  );
});
