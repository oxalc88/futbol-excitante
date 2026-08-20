/**
 * @module tests/unit/eval/team-shape
 *
 * Tests for the TEAM_SHAPE_SUITE_PASS reducer (eval/runners/team-shape-evaluator.ts).
 *
 * Covers:
 *   1. Clean 3v3 run → TEAM_SHAPE_SUITE_PASS PASS.
 *   2. Result structure and test count.
 *   3. All 19 team tests evaluated.
 *   4. Common criteria checks are present.
 *   5. Determinism: two identical calls produce the same verdict.
 *   6. Module exports.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";

// Import wire.ts to register all oracles (side-effect).
import "../../../eval/oracles/wire.js";

import { runTeamShapeEvaluator } from "../../../eval/runners/team-shape-evaluator.js";
import { TEAM_SUITE } from "../../../eval/contracts/suites.js";
import {
  COMMON_CRITERIA,
} from "../../../eval/contracts/common-criteria.js";

// ---------------------------------------------------------------------------
// 1. Clean 3v3 run → TEAM_SHAPE_SUITE_PASS PASS
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS: clean evaluation → PASS", () => {
  it("reducer returns PASS for clean 3v3 evaluation", () => {
    const result = runTeamShapeEvaluator();

    expect(result.verdict).toBe("PASS");
    expect(result.allTestsPass).toBe(true);
    expect(result.suiteId).toBe("team");
    expect(result.suiteVersion).toBe(TEAM_SUITE.suite_version);
  }, 30000);

  it("details mention all tests passing", () => {
    const result = runTeamShapeEvaluator();

    expect(result.details).toContain("PASS");
    expect(result.details).toContain("tests pass");
  }, 30000);
});

// ---------------------------------------------------------------------------
// 2. Result structure
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS: result structure", () => {
  it("has correct suite metadata", () => {
    const result = runTeamShapeEvaluator();

    expect(result.suiteId).toBe("team");
    expect(result.suiteVersion).toBe(TEAM_SUITE.suite_version);
    expect(result.testCount).toBe(TEAM_SUITE.direct_test_ids.length);
    expect(result.testResults.length).toBe(TEAM_SUITE.direct_test_ids.length);
  }, 30000);

  it("has common criterion check results", () => {
    const result = runTeamShapeEvaluator();

    expect(result.commonCriteriaCheck.length).toBeGreaterThan(0);
    for (const cc of result.commonCriteriaCheck) {
      expect(cc.criterionId).toMatch(/.+/);
      expect(cc.oracleResults.length).toBeGreaterThan(0);
      expect(cc.evidence.length).toBeGreaterThan(0);
    }
  }, 30000);

  it("every test has criteria and an overall outcome", () => {
    const result = runTeamShapeEvaluator();

    for (const test of result.testResults) {
      expect(test.test_id).toMatch(/.+/);
      expect(test.criteria.length).toBeGreaterThan(0);
      expect(["PASS", "FAIL", "NOT_EVALUATED", "INVALID_RUN"]).toContain(test.overall);
    }
  }, 30000);
});

// ---------------------------------------------------------------------------
// 3. All 19 team tests are present and evaluated
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS: all tests present", () => {
  it("evaluates every direct_test_id from TEAM_SUITE", () => {
    const result = runTeamShapeEvaluator();
    const evaluatedTestIds = new Set(result.testResults.map((t) => t.test_id));

    for (const testId of TEAM_SUITE.direct_test_ids) {
      expect(
        evaluatedTestIds.has(testId),
        `Test ${testId} from TEAM_SUITE.direct_test_ids was not evaluated`,
      ).toBe(true);
    }
  }, 30000);

  it("no extra tests beyond TEAM_SUITE.direct_test_ids", () => {
    const result = runTeamShapeEvaluator();
    const evaluatedTestIds = new Set(result.testResults.map((t) => t.test_id));
    const definedTestIds = new Set(TEAM_SUITE.direct_test_ids);

    for (const testId of evaluatedTestIds) {
      expect(
        definedTestIds.has(testId),
        `Unexpected test ${testId} not in TEAM_SUITE.direct_test_ids`,
      ).toBe(true);
    }
    expect(evaluatedTestIds.size).toBe(definedTestIds.size);
  }, 30000);

  it("every test's overall is PASS for clean 3v3", () => {
    const result = runTeamShapeEvaluator();

    for (const test of result.testResults) {
      expect(
        test.overall,
        `Test ${test.test_id} should PASS on clean 3v3 data`,
      ).toBe("PASS");
    }
  }, 30000);
});

// ---------------------------------------------------------------------------
// 4. Common criteria checks are correct
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS: common criteria", () => {
  it("checks COMMON-FINITE", () => {
    const result = runTeamShapeEvaluator();
    const finiteCheck = result.commonCriteriaCheck.find(
      (cc) => cc.criterionId === "COMMON-FINITE",
    );
    expect(finiteCheck).toBeDefined();
    expect(finiteCheck?.outcome).toBe("PASS");
  }, 30000);

  it("checks COMMON-REFERENCES", () => {
    const result = runTeamShapeEvaluator();
    const referencesCheck = result.commonCriteriaCheck.find(
      (cc) => cc.criterionId === "COMMON-REFERENCES",
    );
    expect(referencesCheck).toBeDefined();
    expect(referencesCheck?.outcome).toBe("PASS");
  }, 30000);

  it("checks COMMON-BOUNDS", () => {
    const result = runTeamShapeEvaluator();
    const boundsCheck = result.commonCriteriaCheck.find(
      (cc) => cc.criterionId === "COMMON-BOUNDS",
    );
    expect(boundsCheck).toBeDefined();
    expect(boundsCheck?.outcome).toBe("PASS");
  }, 30000);

  it("each criterion has oracle results and evidence", () => {
    const result = runTeamShapeEvaluator();

    for (const cc of result.commonCriteriaCheck) {
      expect(cc.oracleResults.length).toBeGreaterThan(0);
      expect(cc.evidence.length).toBeGreaterThan(0);
      for (const evidence of cc.evidence) {
        expect(evidence).toMatch(/.+/);
      }
    }
  }, 30000);
});

// ---------------------------------------------------------------------------
// 5. Determinism: two identical calls produce the same verdict
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS: determinism", () => {
  it("two identical runTeamShapeEvaluator calls produce the same verdict", () => {
    const resultA = runTeamShapeEvaluator();
    const resultB = runTeamShapeEvaluator();

    expect(resultA.verdict).toBe(resultB.verdict);
    expect(resultA.allTestsPass).toBe(resultB.allTestsPass);
    expect(resultA.testCount).toBe(resultB.testCount);

    for (let i = 0; i < resultA.testResults.length; i++) {
      expect(resultA.testResults[i].overall).toBe(resultB.testResults[i].overall);
    }
  }, 60000);

  it("common criteria check results are identical across runs", () => {
    const resultA = runTeamShapeEvaluator();
    const resultB = runTeamShapeEvaluator();

    expect(resultA.commonCriteriaCheck.length).toBe(resultB.commonCriteriaCheck.length);
    for (let i = 0; i < resultA.commonCriteriaCheck.length; i++) {
      expect(resultA.commonCriteriaCheck[i].outcome).toBe(
        resultB.commonCriteriaCheck[i].outcome,
      );
    }
  }, 60000);
});

// ---------------------------------------------------------------------------
// 6. Module exports
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS: module exports", () => {
  it("the team-shape-evaluator module exports runTeamShapeEvaluator", async () => {
    const moduleExports = Object.keys(
      await import("../../../eval/runners/team-shape-evaluator.js"),
    );
    expect(moduleExports).toContain("runTeamShapeEvaluator");
  });

  it("the team-shape-evaluator module exports type definitions", async () => {
    // Type exports are compile-time only, but we verify the module
    // structure is correct.
    const moduleExports = Object.keys(
      await import("../../../eval/runners/team-shape-evaluator.js"),
    );
    expect(moduleExports).toContain("runTeamShapeEvaluator");
  });
});

// ---------------------------------------------------------------------------
// 7. Suite reference integrity
// ---------------------------------------------------------------------------

describe("TEAM_SHAPE_SUITE_PASS: suite reference integrity", () => {
  it("TEAM_SUITE.direct_test_ids matches the test count", () => {
    const result = runTeamShapeEvaluator();
    expect(result.testCount).toBe(TEAM_SUITE.direct_test_ids.length);
    expect(TEAM_SUITE.direct_test_ids.length).toBe(16);
  }, 30000);

  it("TEAM_SUITE common_criterion_ids includes expected criteria", () => {
    expect(TEAM_SUITE.common_criterion_ids).toContain("COMMON-FINITE");
    expect(TEAM_SUITE.common_criterion_ids).toContain("COMMON-DETERMINISTIC");
    expect(TEAM_SUITE.common_criterion_ids).toContain("COMMON-REFERENCES");
    expect(TEAM_SUITE.common_criterion_ids).toContain("COMMON-BOUNDS");
  });

  it("common criteria from evaluator match registry", () => {
    const result = runTeamShapeEvaluator();

    for (const cc of result.commonCriteriaCheck) {
      const criterion = COMMON_CRITERIA[cc.criterionId];
      expect(criterion).toBeDefined();
      expect(criterion?.class).toBe("HARD_INVARIANT");
    }
  }, 30000);
});