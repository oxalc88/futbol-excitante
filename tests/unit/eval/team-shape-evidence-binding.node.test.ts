/**
 * @module tests/unit/eval/team-shape-evidence-binding.node.test
 *
 * Evidence-binding tests for the TEAM_SHAPE_SUITE_PASS eval.json.
 *
 * Proves that:
 *  1. eval.json exists at docs/evidence/TEAM_SHAPE_SUITE_PASS/eval.json
 *  2. Structure is valid: overall, milestoneVerdict, testResults,
 *     commonCriteriaCheck
 *  3. overall === milestoneVerdict
 *  4. Re-running runTeamShapeEvaluator produces the same verdict
 *  5. Per-test outcomes are present and all tests are accounted for
 *  6. No PES fidelity or invented reference envelope claims in outcome
 *     descriptions
 *
 * Node I/O is allowed in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runTeamShapeEvaluator } from "../../../eval/runners/team-shape-evaluator.js";
import { runTeamShapeEval } from "../../../eval/runners/team-shape-eval-runner.js";
import { TEAM_SUITE } from "../../../eval/contracts/suites.js";
import type { TeamShapeEvalResult } from "../../../eval/runners/team-shape-eval-runner.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveEvidenceDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, "../../..", "docs/evidence/TEAM_SHAPE_SUITE_PASS");
}

function readEvalJson(): TeamShapeEvalResult {
  const dir = resolveEvidenceDir();
  const path = join(dir, "eval.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as TeamShapeEvalResult;
}

// Valid outcomes accepted by the evidence contract.
const VALID_OUTCOMES = new Set([
  "PASS",
  "FAIL",
  "NOT_EVALUATED",
  "BLOCKED_MISSING_REFERENCE",
  "NEEDS_PERCEPTUAL_REVIEW",
  "INVALID_RUN",
]);

// ---------------------------------------------------------------------------
// 1. eval.json exists on disk
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS evidence binding: eval.json exists", () => {
  it("eval.json is a valid JSON file at the expected path", () => {
    const doc = readEvalJson();
    expect(doc).toBeDefined();
    expect(typeof doc).toBe("object");
  });

  it("eval.json has required top-level keys", () => {
    const doc = readEvalJson();
    expect(doc).toHaveProperty("suiteId");
    expect(doc).toHaveProperty("overall");
    expect(doc).toHaveProperty("milestoneVerdict");
    expect(doc).toHaveProperty("testResults");
    expect(doc).toHaveProperty("commonCriteriaCheck");
  });
});

// ---------------------------------------------------------------------------
// 2. Structure validation
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS evidence binding: structure", () => {
  it("suiteId is present and matches TEAM_SUITE", () => {
    const doc = readEvalJson();
    expect(doc.suiteId).toBe("team");
  });

  it("suiteVersion is a non-empty string", () => {
    const doc = readEvalJson();
    expect(typeof doc.suiteVersion).toBe("string");
    expect(doc.suiteVersion.length).toBeGreaterThan(0);
  });

  it("testCount is non-zero and matches direct_test_ids", () => {
    const doc = readEvalJson();
    expect(doc.testCount).toBeGreaterThan(0);
    expect(doc.testCount).toBe(doc.testResults.length);
  });

  it("testResults is a non-empty array", () => {
    const doc = readEvalJson();
    expect(Array.isArray(doc.testResults)).toBe(true);
    expect(doc.testResults.length).toBeGreaterThan(0);
  });

  it("commonCriteriaCheck is a non-empty array", () => {
    const doc = readEvalJson();
    expect(Array.isArray(doc.commonCriteriaCheck)).toBe(true);
    expect(doc.commonCriteriaCheck.length).toBeGreaterThan(0);
  });

  it("each test has required fields", () => {
    const doc = readEvalJson();
    for (const t of doc.testResults) {
      expect(typeof t.test_id).toBe("string");
      expect(t.test_id.length).toBeGreaterThan(0);
      expect(Array.isArray(t.criteria)).toBe(true);
      expect(t.criteria.length).toBeGreaterThan(0);
      for (const c of t.criteria) {
        expect(typeof c.criterion_id).toBe("string");
        expect(c.criterion_id.length).toBeGreaterThan(0);
        expect(VALID_OUTCOMES.has(c.outcome)).toBe(true);
        expect(typeof c.class).toBe("string");
      }
    }
  });

  it("each commonCriteriaCheck entry has required fields", () => {
    const doc = readEvalJson();
    for (const cc of doc.commonCriteriaCheck) {
      expect(typeof cc.criterionId).toBe("string");
      expect(cc.criterionId.length).toBeGreaterThan(0);
      expect(VALID_OUTCOMES.has(cc.outcome)).toBe(true);
      expect(Array.isArray(cc.oracleResults)).toBe(true);
      expect(cc.oracleResults.length).toBeGreaterThan(0);
      expect(Array.isArray(cc.evidence)).toBe(true);
      expect(cc.evidence.length).toBeGreaterThan(0);
    }
  });

  it("overall and milestoneVerdict are valid outcomes", () => {
    const doc = readEvalJson();
    expect(VALID_OUTCOMES.has(doc.overall)).toBe(true);
    expect(VALID_OUTCOMES.has(doc.milestoneVerdict)).toBe(true);
  });

  it("overall equals milestoneVerdict", () => {
    const doc = readEvalJson();
    expect(doc.overall).toBe(doc.milestoneVerdict);
  });
});

// ---------------------------------------------------------------------------
// 3. Live re-run consistency
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS evidence binding: live re-run", () => {
  it("re-running the evaluator produces the same verdict", () => {
    const persisted = readEvalJson();
    const live = runTeamShapeEval();
    expect(live.milestoneVerdict).toBe(persisted.milestoneVerdict);
    expect(live.overall).toBe(persisted.overall);
  });

  it("test outcomes match between persisted and live", () => {
    const persisted = readEvalJson();
    const live = runTeamShapeEval();

    for (let i = 0; i < persisted.testResults.length; i++) {
      expect(live.testResults[i].test_id).toBe(
        persisted.testResults[i].test_id,
      );
      expect(live.testResults[i].overall).toBe(
        persisted.testResults[i].overall,
      );
    }
  });

  it("runTeamShapeEvaluator raw result agrees on verdict", () => {
    const persisted = readEvalJson();
    const rawResult = runTeamShapeEvaluator();
    expect(rawResult.verdict).toBe(persisted.overall);
  });
});

// ---------------------------------------------------------------------------
// 4. All tests present
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS evidence binding: test coverage", () => {
  it("evaluated test IDs match TEAM_SUITE.direct_test_ids", () => {
    const doc = readEvalJson();
    const evaluatedIds = new Set(doc.testResults.map((t) => t.test_id));

    for (const testId of TEAM_SUITE.direct_test_ids) {
      expect(
        evaluatedIds.has(testId),
        `Test ${testId} from TEAM_SUITE.direct_test_ids not in eval.json`,
      ).toBe(true);
    }
  });

  it("no extra tests beyond TEAM_SUITE.direct_test_ids", () => {
    const doc = readEvalJson();
    const evaluatedIds = new Set(doc.testResults.map((t) => t.test_id));
    const definedIds = new Set(TEAM_SUITE.direct_test_ids);

    for (const testId of evaluatedIds) {
      expect(definedIds.has(testId)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Common criteria presence
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS evidence binding: common criteria", () => {
  it("checks COMMON-FINITE", () => {
    const doc = readEvalJson();
    const finiteCheck = doc.commonCriteriaCheck.find(
      (cc) => cc.criterionId === "COMMON-FINITE",
    );
    expect(finiteCheck).toBeDefined();
  });

  it("checks COMMON-REFERENCES", () => {
    const doc = readEvalJson();
    const refsCheck = doc.commonCriteriaCheck.find(
      (cc) => cc.criterionId === "COMMON-REFERENCES",
    );
    expect(refsCheck).toBeDefined();
  });

  it("checks COMMON-BOUNDS", () => {
    const doc = readEvalJson();
    const boundsCheck = doc.commonCriteriaCheck.find(
      (cc) => cc.criterionId === "COMMON-BOUNDS",
    );
    expect(boundsCheck).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. No forbidden claims
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS evidence binding: no forbidden claims", () => {
  it("no outcome description references PES fidelity", () => {
    const doc = readEvalJson();
    // Evidence lives in commonCriteriaCheck (criteria-level evidence is
    // not persisted by the runner wrapper — that is a known gap).
    for (const cc of doc.commonCriteriaCheck) {
      for (const e of cc.evidence) {
        expect(e.toLowerCase()).not.toContain("pes 2017 fidelity");
      }
    }
  });

  it("no outcome description invents reference envelopes", () => {
    const doc = readEvalJson();
    for (const cc of doc.commonCriteriaCheck) {
      for (const e of cc.evidence) {
        expect(e.toLowerCase()).not.toContain("reference envelope");
      }
    }
  });
});