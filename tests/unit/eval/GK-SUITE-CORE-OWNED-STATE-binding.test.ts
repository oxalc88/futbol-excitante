/**
 * @module tests/unit/eval/GK-SUITE-CORE-OWNED-STATE-binding.test.ts
 *
 * Evidence-binding test for GK-SUITE-CORE-OWNED-STATE.
 *
 * Locks the honest goalkeepers-suite verdict state re-published under the
 * CORE-OWNED lifecycle with the GK-CORE-OWNED-ARC-FIX re-home active (the
 * fresh-run default).  The accepted v27 table was legacy-produced; this record
 * is the core-owned counterpart and is DISCRIMINATING: the one true verdict
 * change (COMMON-BOUNDS FAIL→PASS) and the distribution observation-source flip
 * (driven fixture → organic continuous) must be pinned exactly, so a changed
 * verdict fails the test.
 *
 *  1. The durable record under `docs/evidence/GK-SUITE-CORE-OWNED-STATE/` has
 *     the established shape and carries a stable `record_sha256` (byte-
 *     reproducible, no wall-clock field in the hashed content).
 *  2. The lifecycle is core-owned, re-home on (the fresh-run default).
 *  3. The after state is the honest executed verdict: GK-POSITIONING-HOLD /
 *     GK-NO-FIELD-CHASE / GK-ROLE-DESIGNATION PASS (organic, core-owned,
 *     re-home on); GK-SAVE-CLAIM PASS (driven fixture only); GK-DISTRIBUTION-
 *     NO-OMNISCIENCE PASS (organic continuous now, NOT the fixture).
 *  4. COMMON criteria: COMMON-FINITE PASS; COMMON-DETERMINISTIC
 *     NOT_EVALUATED (single-run); COMMON-REFERENCES PASS; COMMON-BOUNDS PASS —
 *     the TRUE verdict change vs the v27 legacy FAIL.
 *  5. The accepted v27 record is byte-untouched (record_sha256 pinned).
 *  6. The verdict_deltas list the COMMON-BOUNDS change and the distribution
 *     source flip explicitly.
 *  7. Catalog criteria: GK-*-REF stay BLOCKED_MISSING_REFERENCE and GK-*-VIS
 *     stay NEEDS_PERCEPTUAL_REVIEW — no criterion upgraded beyond what the
 *     executed evaluator returns.
 *  8. The record is not hand-written: reproducing the two keeper runs through
 *     the same runner + evaluator under core-owned yields the pinned per-run
 *     outcomes.
 *  9. No PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS
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

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECORD_PATH = join(
  projectRoot,
  "docs/evidence/GK-SUITE-CORE-OWNED-STATE/gk-suite-core-owned-state.json",
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
  candidate_commit: string;
  record_sha256: string;
  lifecycle: {
    policy: string;
    rehome_keeper: string;
    rehome_applied: boolean;
    note: string;
  };
  accepted_v27: {
    source_record: string;
    source_candidate: string;
    record_sha256: string;
    lifecycle: string;
    verdicts: {
      gk_behavior: Record<string, string>;
      common: Record<string, string>;
      catalog: Record<string, string>;
    };
    per_run: Record<string, unknown>;
  };
  after: {
    gk_behavior: Record<string, { verdict: string; observations: string; source: string }>;
    catalog: Record<string, string>;
    common: Record<string, string>;
  };
  runs: Array<{
    run_id: string;
    lifecycle: string;
    rehome_keeper: boolean;
    source_candidate: string;
    observations: number;
    goals: number;
    gk_behavior: Record<string, string>;
    common: Record<string, string>;
    catalog: Record<string, string>;
    distribution: { releases: number; release_ticks: number[]; release_targets: string[]; release_keepers: string[] };
  }>;
  verdict_deltas: Array<{
    criterion: string;
    v27_verdict: string;
    core_owned_verdict: string;
    changed: boolean;
    reason: string;
  }>;
  disclosures: string[];
  claims_not_made: string[];
}

function loadRecord(): GkRecord {
  return readJson<GkRecord>(
    "docs/evidence/GK-SUITE-CORE-OWNED-STATE/gk-suite-core-owned-state.json",
  );
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
    lifecyclePhaseSync: "core-owned",
    // re-home defaults to true (gkBehavior && core-owned) — the fresh-run default.
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
  let releases = 0;
  const release_ticks: number[] = [];
  const release_targets: string[] = [];
  for (const o of match.observations) {
    for (const ev of o.events) {
      if (ev.kind !== "keeper-release") continue;
      releases++;
      release_ticks.push(o.tick);
      release_targets.push(
        (ev.payload as { releaseTargetPlayerId?: string } | undefined)?.releaseTargetPlayerId ?? "unknown",
      );
    }
  }
  return { gk, common, releases, release_ticks, release_targets };
}

describe("GK-SUITE-CORE-OWNED-STATE goalkeepers-suite record", () => {
  it("durable record exists with the established shape", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("GK-SUITE-CORE-OWNED-STATE");
    expect(record.suite_id).toBe("goalkeepers");
    expect(record.suite_version).toBe("suite-goalkeepers-v1");
    expect(record.evidence_class).toBe("BOOKKEEPING");
    expect(record.schema_version).toBe(1);
    expect(typeof record.record_sha256).toBe("string");
    expect(record.record_sha256.length).toBeGreaterThan(0);
    expect(record.candidate_commit.length).toBe(40);
    expect(record.runs.length).toBe(2);
    expect(record.verdict_deltas.length).toBeGreaterThanOrEqual(12);
    expect(record.disclosures.length).toBeGreaterThan(0);
    expect(record.claims_not_made.length).toBeGreaterThan(0);
    expect(Object.keys(record.after.gk_behavior).sort()).toEqual([...GK_BEHAVIOR].sort());
  });

  it("lifecycle is core-owned with the re-home active (fresh-run default)", () => {
    const record = loadRecord();
    expect(record.lifecycle.policy).toBe("core-owned");
    expect(record.lifecycle.rehome_applied).toBe(true);
    for (const run of record.runs) {
      expect(run.lifecycle).toBe("core-owned");
      expect(run.rehome_keeper).toBe(true);
    }
  });

  it("accepted v27 baseline is pinned and byte-untouched", () => {
    const record = loadRecord();
    expect(record.accepted_v27.lifecycle).toBe("legacy");
    expect(record.accepted_v27.record_sha256).toBe(
      readJson<{ record_sha256: string }>(
        "docs/evidence/GK-SUITE-VERDICTS-STATE/gk-suite-verdicts-state.json",
      ).record_sha256,
    );
    // The v27 record_sha256 is the accepted value — no accepted record mutation.
    expect(record.accepted_v27.record_sha256).toBe("222b5f61983d30d693af71c0be23f60de6fc3751fce6d75e34732011e3f5c6de");
  });

  it("after state: all five GK behavior criteria are PASS from the executed evaluator", () => {
    const record = loadRecord();
    for (const criterion of GK_BEHAVIOR) {
      expect(record.after.gk_behavior[criterion]).toBeDefined();
      expect(record.after.gk_behavior[criterion].verdict).toBe("PASS");
      expect(record.after.gk_behavior[criterion].source).toContain("executed evaluator");
    }
  });

  it("after observations bookkeeping: core-owned / re-home and the distribution source flip", () => {
    const record = loadRecord();
    expect(record.after.gk_behavior["GK-POSITIONING-HOLD"].observations).toMatch(/core-owned/);
    expect(record.after.gk_behavior["GK-NO-FIELD-CHASE"].observations).toMatch(/core-owned/);
    expect(record.after.gk_behavior["GK-ROLE-DESIGNATION"].observations).toMatch(/core-owned/);
    expect(record.after.gk_behavior["GK-SAVE-CLAIM"].observations).toMatch(/driven/);
    // The distribution evidence flipped from the driven fixture to the organic
    // continuous run — this is the discriminating observation-source change.
    expect(record.after.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"].observations).toMatch(/organic/);
    expect(record.after.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"].observations).not.toMatch(/driven/);
  });

  it("after common criteria: the one true verdict change is COMMON-BOUNDS FAIL→PASS", () => {
    const record = loadRecord();
    expect(record.after.common["COMMON-FINITE"]).toBe("PASS");
    expect(record.after.common["COMMON-DETERMINISTIC"]).toBe("NOT_EVALUATED");
    expect(record.after.common["COMMON-REFERENCES"]).toBe("PASS");
    // DISCRIMINATING: the v27 legacy table reported COMMON-BOUNDS FAIL; the
    // core-owned run (restart machinery live + goal-mouth bound) is PASS.
    expect(record.after.common["COMMON-BOUNDS"]).toBe("PASS");
  });

  it("after catalog: GK-*-REF stays BLOCKED_MISSING_REFERENCE, GK-*-VIS stays NEEDS_PERCEPTUAL_REVIEW", () => {
    const record = loadRecord();
    expect(record.after.catalog["ref"]).toBe("BLOCKED_MISSING_REFERENCE");
    expect(record.after.catalog["vis"]).toBe("NEEDS_PERCEPTUAL_REVIEW");
    expect(record.after.catalog["reg"]).toBe("NOT_EVALUATED");
    expect(record.after.catalog["causal"]).toBe("NOT_EVALUATED");
  });

  it("verdict_deltas pin the COMMON-BOUNDS change and the distribution source flip", () => {
    const record = loadRecord();
    const bounds = record.verdict_deltas.find((d) => d.criterion === "COMMON-BOUNDS");
    expect(bounds).toBeDefined();
    expect(bounds!.v27_verdict).toBe("FAIL");
    expect(bounds!.core_owned_verdict).toBe("PASS");
    expect(bounds!.changed).toBe(true);

    const dist = record.verdict_deltas.find((d) => d.criterion === "GK-DISTRIBUTION-NO-OMNISCIENCE");
    expect(dist).toBeDefined();
    expect(dist!.v27_verdict).toBe("PASS");
    expect(dist!.core_owned_verdict).toBe("PASS");
    expect(dist!.changed).toBe(false);
    expect(dist!.reason).toMatch(/source flipped/);
  });

  it("per-run verdicts: continuous carries distribution (8 releases), fixture carries save-claim", () => {
    const record = loadRecord();
    const cont = record.runs.find((r) => r.run_id === "gk-continuous-live");
    const fix = record.runs.find((r) => r.run_id === "gk-shot-fixture-live");
    expect(cont).toBeDefined();
    expect(fix).toBeDefined();
    // Continuous: distribution PASS (8 releases to observed teammate), save-claim NOT_EVALUATED.
    expect(cont!.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("PASS");
    expect(cont!.distribution.releases).toBe(8);
    expect(cont!.distribution.release_targets).toEqual([
      "player-9", "player-9", "player-9", "player-9",
      "player-9", "player-9", "player-9", "player-9",
    ]);
    expect(cont!.gk_behavior["GK-SAVE-CLAIM"]).toBe("NOT_EVALUATED");
    // Fixture: save-claim PASS, distribution NOT_EVALUATED (0 releases).
    expect(fix!.gk_behavior["GK-SAVE-CLAIM"]).toBe("PASS");
    expect(fix!.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("NOT_EVALUATED");
    expect(fix!.distribution.releases).toBe(0);
    expect(cont!.gk_behavior["GK-POSITIONING-HOLD"]).toBe("PASS");
    expect(cont!.gk_behavior["GK-NO-FIELD-CHASE"]).toBe("PASS");
    expect(cont!.gk_behavior["GK-ROLE-DESIGNATION"]).toBe("PASS");
  });

  it("record does not claim PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS", () => {
    const record = loadRecord();
    const joined = record.claims_not_made.join("\n").toLowerCase();
    expect(joined).toContain("no promotion");
    expect(joined).toContain("no pes");
    expect(joined).toContain("no foundation_lab_pass");
    expect(joined).toContain("no suite-level pass");
    expect(joined).toContain("no gameplay change");
    expect(joined).toContain("no accepted record mutation");
  });

  it(
    "record is not hand-written: reproducing the two keeper runs under core-owned yields the pinned verdicts",
    () => {
      const cont = runReproduce("eval/scenarios/5v5-continuous-play.v1.json", 1800);
      expect(cont.gk["GK-POSITIONING-HOLD"]).toBe("PASS");
      expect(cont.gk["GK-NO-FIELD-CHASE"]).toBe("PASS");
      expect(cont.gk["GK-ROLE-DESIGNATION"]).toBe("PASS");
      expect(cont.gk["GK-SAVE-CLAIM"]).toBe("NOT_EVALUATED");
      expect(cont.gk["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("PASS");
      expect(cont.common["COMMON-FINITE"]).toBe("PASS");
      expect(cont.common["COMMON-DETERMINISTIC"]).toBe("NOT_EVALUATED");
      expect(cont.common["COMMON-REFERENCES"]).toBe("PASS");
      expect(cont.common["COMMON-BOUNDS"]).toBe("PASS");
      expect(cont.releases).toBe(8);

      const fix = runReproduce("eval/scenarios/5v5-keeper-shot-fixture.v1.json", 600);
      expect(fix.gk["GK-POSITIONING-HOLD"]).toBe("PASS");
      expect(fix.gk["GK-NO-FIELD-CHASE"]).toBe("PASS");
      expect(fix.gk["GK-ROLE-DESIGNATION"]).toBe("PASS");
      expect(fix.gk["GK-SAVE-CLAIM"]).toBe("PASS");
      expect(fix.gk["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("NOT_EVALUATED");
      expect(fix.common["COMMON-BOUNDS"]).toBe("PASS");
      expect(fix.releases).toBe(0);

      const recorded = loadRecord().runs;
      expect(recorded.find((r) => r.run_id === "gk-continuous-live")!.gk_behavior["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("PASS");
      expect(recorded.find((r) => r.run_id === "gk-shot-fixture-live")!.gk_behavior["GK-SAVE-CLAIM"]).toBe("PASS");
    },
    180_000,
  );
});
