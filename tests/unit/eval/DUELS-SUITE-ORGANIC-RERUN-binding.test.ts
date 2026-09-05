/**
 * @module tests/unit/eval/DUELS-SUITE-ORGANIC-RERUN-binding.test.ts
 *
 * Evidence-binding test for DUELS-SUITE-ORGANIC-RERUN.
 *
 * Locks the honest before/after duels-suite state that was refreshed by
 * re-running the accepted duels evaluator (`evaluateSuite("duels", ...)`)
 * against the now-organic observations:
 *
 *  1. The durable record under `docs/evidence/DUELS-SUITE-ORGANIC-RERUN/`
 *     has the established shape (schema_version, suite_id, before/after,
 *     per-run scoped outcomes) and carries a stable `record_sha256`.
 *  2. The before state records the duel criteria as measured only on driven
 *     fixtures and PHYSICAL_DUEL as `insufficient_context`.
 *  3. The after state measures the scoped criteria (TACK-ST-001-PHASE,
 *     TACK-SL-001-PHASE, PHY-SHLD-001-CONT) as PASS on organic observations,
 *     and PHYSICAL_DUEL as `present`.
 *  4. The record is not hand-written: reproducing the human-driven duel run
 *     (the accepted HUMAN-DEFENSIVE-DUEL-CONTROL configuration) through the
 *     evaluator produces the same scoped outcomes the record pins for that run.
 *  5. No PROMOTION / PES fidelity / FOUNDATION_LAB_PASS claim is recorded.
 *
 * Node I/O is allowed for scenario and artifact loading.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runDefensiveDuel } from "../../../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../../../eval/scenarios/proximate-5v5.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECORD_PATH = join(
  projectRoot,
  "docs/evidence/DUELS-SUITE-ORGANIC-RERUN/duels-suite-state.json",
);

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

interface DuelsRecord {
  schema_version: number;
  objective_id: string;
  suite_id: string;
  suite_version: string;
  evidence_class: string;
  record_sha256: string;
  before: {
    scoped_criteria: Record<string, string>;
    situation: Record<string, string>;
    common_criteria: Record<string, string>;
  };
  after: {
    scoped_criteria: Record<string, { verdict: string; source: string }>;
    situation: Record<string, { verdict: string; source: string }>;
    common_criteria: Record<string, string>;
  };
  organic_runs: Array<{
    run_id: string;
    scenario: string;
    ticks: number;
    source_evidence: string;
    source_candidate: string;
    observations: number;
    scoped_criteria: Record<string, string>;
    common_criteria: Record<string, string>;
    phys_duel: { present: boolean; player_contacts: number; input_rejections: number };
  }>;
  claims_not_made: string[];
}

function loadRecord(): DuelsRecord {
  return JSON.parse(readFileSync(RECORD_PATH, "utf-8")) as DuelsRecord;
}

const SCOPED = ["TACK-ST-001-PHASE", "TACK-SL-001-PHASE", "PHY-SHLD-001-CONT"];

describe("DUELS-SUITE-ORGANIC-RERUN duels-suite record", () => {
  it("durable record exists with the established shape", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("DUELS-SUITE-ORGANIC-RERUN");
    expect(record.suite_id).toBe("duels");
    expect(record.suite_version).toBe("suite-duels-v1");
    expect(record.evidence_class).toBe("HEADLESS");
    expect(record.schema_version).toBe(1);
    expect(typeof record.record_sha256).toBe("string");
    expect(record.record_sha256.length).toBeGreaterThan(0);
    expect(record.organic_runs.length).toBeGreaterThanOrEqual(6);
    expect(record.claims_not_made.length).toBeGreaterThan(0);
  });

  it("before state records driven-fixture-only measurement and PHYSICAL_DUEL insufficient_context", () => {
    const record = loadRecord();
    expect(record.before.scoped_criteria["TACK-ST-001-PHASE"]).toMatch(/PASS/);
    expect(record.before.scoped_criteria["TACK-SL-001-PHASE"]).toMatch(/PASS/);
    expect(record.before.scoped_criteria["PHY-SHLD-001-CONT"]).toMatch(/PASS/);
    expect(record.before.situation["PHYSICAL_DUEL"]).toContain("insufficient_context");
  });

  it("after state measures the scoped criteria PASS on organic observations", () => {
    const record = loadRecord();
    for (const criterion of SCOPED) {
      expect(record.after.scoped_criteria[criterion]).toBeDefined();
      expect(record.after.scoped_criteria[criterion].verdict).toBe("PASS");
      expect(record.after.scoped_criteria[criterion].source).toContain("organic observations");
    }
  });

  it("after state records PHYSICAL_DUEL as present on organic observations", () => {
    const record = loadRecord();
    expect(record.after.situation["PHYSICAL_DUEL"].verdict).toBe("present");
    expect(record.after.situation["PHYSICAL_DUEL"].source).toContain("input-rejection");
  });

  it("every organic run pins the same scoped outcomes (TACK-ST/SL, PHY-SHLD PASS)", () => {
    const record = loadRecord();
    for (const run of record.organic_runs) {
      expect(run.scoped_criteria["TACK-ST-001-PHASE"]).toBe("PASS");
      expect(run.scoped_criteria["TACK-SL-001-PHASE"]).toBe("PASS");
      expect(run.scoped_criteria["PHY-SHLD-001-CONT"]).toBe("PASS");
      expect(run.phys_duel.present).toBe(true);
      expect(run.phys_duel.input_rejections).toBeGreaterThan(0);
      expect(run.phys_duel.player_contacts).toBeGreaterThan(0);
    }
  });

  it("every source_candidate matches the accepted manifest candidate_commit", () => {
    const record = loadRecord();
    for (const run of record.organic_runs) {
      // source_evidence is e.g. docs/evidence/<OBJECTIVE>/trajectory.json; the
      // accepted manifest sits in the same directory. This guards against a
      // provenance mislabel like the one the critic flagged (d56ccad).
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
    expect(joined).toContain("no pes fidelity");
    expect(joined).toContain("no foundation_lab_pass");
    expect(joined).toContain("no gameplay change");
  });

  it("the record is not hand-written: reproducing the human duel yields the pinned scoped outcomes", () => {
    // Fast, deterministic reproduction of the accepted HUMAN-DEFENSIVE-DUEL-CONTROL
    // run (120 ticks) through the same driver + evaluator the record cites.
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
    const suite = evaluateSuite("duels", duel.observations);

    const outcomes: Record<string, string> = {};
    for (const test of suite.tests) {
      for (const c of test.criteria) {
        if (SCOPED.includes(c.criterion_id)) outcomes[c.criterion_id] = c.outcome;
      }
    }
    expect(outcomes["TACK-ST-001-PHASE"]).toBe("PASS");
    expect(outcomes["TACK-SL-001-PHASE"]).toBe("PASS");
    expect(outcomes["PHY-SHLD-001-CONT"]).toBe("PASS");

    const recorded = loadRecord().organic_runs.find((r) => r.run_id === "human-duel");
    expect(recorded).toBeDefined();
    expect(recorded!.scoped_criteria["TACK-ST-001-PHASE"]).toBe("PASS");
    expect(recorded!.scoped_criteria["TACK-SL-001-PHASE"]).toBe("PASS");
    expect(recorded!.scoped_criteria["PHY-SHLD-001-CONT"]).toBe("PASS");
  });
});
