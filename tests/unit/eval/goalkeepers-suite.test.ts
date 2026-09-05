/**
 * @module tests/unit/eval/goalkeepers-suite
 *
 * Tests for the goalkeepers suite (suite-goalkeepers-v1):
 *  1. Suite is registered in SUITES.
 *  2. expandSuite includes all 6 goalkeeper catalog tests.
 *  3. evaluateSuite("goalkeepers", ...) runs and produces test results.
 *  4. Every GK-specific criterion is honestly non-PASS (not yet observable):
 *       - MEASURED_TARGET → BLOCKED_MISSING_REFERENCE
 *       - PERCEPTUAL_TARGET → NEEDS_PERCEPTUAL_REVIEW
 *       - REGRESSION → NOT_EVALUATED
 *       - UNKNOWN → NOT_EVALUATED
 *       - HARD_INVARIANT GK (no oracle) → NOT_EVALUATED
 *  5. Provisional config values carry the gk-small-sided-v1 model id + version.
 *  6. Negative control: removing / mutating a GK binding fails registry validation.
 *
 * No gameplay PASS is claimed by this suite.  No PES reference is invented.
 *
 * No Math.random, Date, performance, DOM in core; tests may read fixtures.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import { SUITES } from "../../../eval/contracts/suites.js";
import { GOALKEEPERS_SUITE } from "../../../eval/contracts/suites.js";
import { TEST_BINDINGS } from "../../../eval/contracts/bindings.js";
import { EXPANSION_MANIFESTS } from "../../../eval/contracts/policies.js";
import { evaluate } from "../../../eval/runners/evaluate.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import { loadRegistrySet, validateRegistrySet } from "../../../eval/contracts/loader.js";
import {
  GK_MODEL_ID,
  GK_MODEL_VERSION,
  GK_PROVISIONAL_VALUES,
  GK_BLOCKED_REFERENCES,
} from "../../../eval/contracts/goalkeeper-config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GK_TEST_IDS = [
  "GK-REA-001",
  "GK-WF-001",
  "GK-LEG-001",
  "GK-PARRY-001",
  "GK-REC-001",
  "GK-HIGH-001",
];

function loadFixture(): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(
    __dirname,
    "../../../eval/scenarios/foundation-move-and-roll.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

function runGoalkeepersSuite(): ReturnType<typeof evaluateSuite> {
  const scenario = loadFixture();
  const evalResult = evaluate({ scenario });
  return evaluateSuite("goalkeepers", evalResult.observations);
}

/** Build a shallow-cloned registry so negative controls don't mutate globals. */
function buildRegistry(): ReturnType<typeof loadRegistrySet> {
  const base = loadRegistrySet();
  return {
    ...base,
    suite_definitions: { ...base.suite_definitions },
    test_bindings: { ...base.test_bindings },
    scenario_definitions: { ...base.scenario_definitions },
    invariant_definitions: { ...base.invariant_definitions },
    observation_definitions: { ...base.observation_definitions },
  };
}

// ---------------------------------------------------------------------------
// 1. Suite registration
// ---------------------------------------------------------------------------

describe("goalkeepers suite registration", () => {
  it("GOALKEEPERS_SUITE is exported", () => {
    expect(GOALKEEPERS_SUITE).toBeDefined();
    expect(GOALKEEPERS_SUITE.suite_id).toBe("goalkeepers");
    expect(GOALKEEPERS_SUITE.suite_version).toBe("suite-goalkeepers-v1");
  });

  it("GOALKEEPERS_SUITE is registered in SUITES", () => {
    expect(SUITES["goalkeepers"]).toBe(GOALKEEPERS_SUITE);
  });

  it("goalkeepers suite has correct direct_test_ids", () => {
    expect(GOALKEEPERS_SUITE.direct_test_ids).toEqual(GK_TEST_IDS);
  });

  it("goalkeepers suite has COMMON criteria", () => {
    expect(GOALKEEPERS_SUITE.common_criterion_ids).toEqual([
      "COMMON-FINITE",
      "COMMON-DETERMINISTIC",
      "COMMON-REFERENCES",
      "COMMON-BOUNDS",
    ]);
  });

  it("goalkeepers suite requires GOALKEEPERS capability", () => {
    expect(GOALKEEPERS_SUITE.prerequisite_capabilities).toContain("GOALKEEPERS");
  });

  it("expansion manifest for goalkeepers exists", () => {
    const manifest = EXPANSION_MANIFESTS["expansion-goalkeepers-v1"];
    expect(manifest).toBeDefined();
    expect(manifest.suite_id).toBe("goalkeepers");
    expect(manifest.impact_closure).toBe("NONE");
    expect(manifest.direct_test_ids).toEqual(GOALKEEPERS_SUITE.direct_test_ids);
  });

  it("all goalkeepers test_ids have bindings", () => {
    for (const testId of GK_TEST_IDS) {
      expect(TEST_BINDINGS[testId]).toBeDefined(`Binding must exist for "${testId}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. evaluateSuite("goalkeepers", ...) runs
// ---------------------------------------------------------------------------

describe("evaluateSuite: goalkeepers suite execution", () => {
  it("returns a SuiteEvaluationResult with suite_id=goalkeepers", () => {
    const result = runGoalkeepersSuite();
    expect(result.suite_id).toBe("goalkeepers");
    expect(result.suite_version).toBe("suite-goalkeepers-v1");
    expect(Array.isArray(result.tests)).toBe(true);
    expect(result.tests.length).toBeGreaterThan(0);
  });

  it("includes all 6 goalkeeper test IDs", () => {
    const result = runGoalkeepersSuite();
    const testIds = result.tests.map((t) => t.test_id);
    for (const expected of GK_TEST_IDS) {
      expect(testIds).toContain(expected);
    }
  });

  it("registry validates cleanly with the goalkeepers suite present", () => {
    const registry = loadRegistrySet();
    expect(validateRegistrySet(registry)).toHaveLength(0);
    expect(registry.suite_definitions["goalkeepers"]).toBeDefined();
    expect(registry.test_bindings["GK-REA-001"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. GK criteria outcome classes are honest and non-PASS
// ---------------------------------------------------------------------------

describe("GK criteria honesty (no gameplay PASS)", () => {
  it("each goalkeeper test evaluates to a non-PASS overall outcome", () => {
    const result = runGoalkeepersSuite();
    for (const test of result.tests) {
      // Because every GK test carries at least one PERCEPTUAL_TARGET criterion,
      // the reduced outcome is NEEDS_PERCEPTUAL_REVIEW (higher precedence than
      // BLOCKED_MISSING_REFERENCE / NOT_EVALUATED). It is never PASS.
      expect(test.overall).not.toBe("PASS");
      expect(
        ["NOT_EVALUATED", "BLOCKED_MISSING_REFERENCE", "NEEDS_PERCEPTUAL_REVIEW"].includes(test.overall),
      ).toBe(true);
    }
  });

  it("no GK-specific criterion claims PASS", () => {
    const result = runGoalkeepersSuite();
    for (const test of result.tests) {
      const gkCriteria = test.criteria.filter((c) => c.criterion_id.startsWith("GK-"));
      expect(gkCriteria.length).toBeGreaterThan(0);
      for (const c of gkCriteria) {
        expect(c.outcome, `${test.test_id} ${c.criterion_id} must not PASS`).not.toBe("PASS");
      }
    }
  });

  it("MEASURED_TARGET GK criteria resolve to BLOCKED_MISSING_REFERENCE", () => {
    const result = runGoalkeepersSuite();
    const rea = result.tests.find((t) => t.test_id === "GK-REA-001");
    const refCriterion = rea!.criteria.find((c) => c.criterion_id === "GK-REA-001-REF");
    expect(refCriterion).toBeDefined();
    expect(refCriterion!.class).toBe("MEASURED_TARGET");
    expect(refCriterion!.outcome).toBe("BLOCKED_MISSING_REFERENCE");
  });

  it("PERCEPTUAL_TARGET GK criteria resolve to NEEDS_PERCEPTUAL_REVIEW", () => {
    const result = runGoalkeepersSuite();
    const rea = result.tests.find((t) => t.test_id === "GK-REA-001");
    const visCriterion = rea!.criteria.find((c) => c.criterion_id === "GK-REA-001-VIS");
    expect(visCriterion).toBeDefined();
    expect(visCriterion!.class).toBe("PERCEPTUAL_TARGET");
    expect(visCriterion!.outcome).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });

  it("REGRESSION GK criteria resolve to NOT_EVALUATED", () => {
    const result = runGoalkeepersSuite();
    const rea = result.tests.find((t) => t.test_id === "GK-REA-001");
    const regCriterion = rea!.criteria.find((c) => c.criterion_id === "GK-REA-001-REG");
    expect(regCriterion).toBeDefined();
    expect(regCriterion!.class).toBe("REGRESSION");
    expect(regCriterion!.outcome).toBe("NOT_EVALUATED");
  });

  it("UNKNOWN GK criteria resolve to NOT_EVALUATED", () => {
    const result = runGoalkeepersSuite();
    const wf = result.tests.find((t) => t.test_id === "GK-WF-001");
    const causalCriterion = wf!.criteria.find((c) => c.criterion_id === "GK-WF-001-CAUSAL");
    expect(causalCriterion).toBeDefined();
    expect(causalCriterion!.class).toBe("UNKNOWN");
    expect(causalCriterion!.outcome).toBe("NOT_EVALUATED");
  });

  it("HARD_INVARIANT GK criteria (no keeper oracle) resolve to NOT_EVALUATED", () => {
    const result = runGoalkeepersSuite();
    const rea = result.tests.find((t) => t.test_id === "GK-REA-001");
    const positioning = rea!.criteria.find((c) => c.criterion_id === "GK-POSITIONING-HOLD");
    expect(positioning).toBeDefined();
    expect(positioning!.class).toBe("HARD_INVARIANT");
    expect(positioning!.outcome).toBe("NOT_EVALUATED");
  });
});

// ---------------------------------------------------------------------------
// 4. Provisional config carries model id + version
// ---------------------------------------------------------------------------

describe("goalkeeper provisional configuration", () => {
  it("carries the gk-small-sided-v1 model id and version", () => {
    expect(GK_MODEL_ID).toBe("gk-small-sided-v1");
    expect(GK_MODEL_VERSION).toBe("gk-small-sided-v1");
    expect(GK_PROVISIONAL_VALUES.length).toBeGreaterThan(0);
  });

  it("every provisional value carries model id + version and is VERSIONED_PROVISIONAL", () => {
    for (const v of GK_PROVISIONAL_VALUES) {
      expect(v.source).toBe("VERSIONED_PROVISIONAL");
      expect(v.model_id).toBe(GK_MODEL_ID);
      expect(v.version).toBe(GK_MODEL_VERSION);
    }
  });

  it("GK config matrix references the gk-small-sided-v1 model", () => {
    const registry = loadRegistrySet();
    const config = registry.config_policies["config-goalkeepers-v1"];
    expect(config).toBeDefined();
    expect(config.config_refs["goalkeeper"]).toBe("gk-small-sided-v1");
  });

  it("blocked references are disclosed as BLOCKED_MISSING_REFERENCE, never invented", () => {
    expect(GK_BLOCKED_REFERENCES.length).toBeGreaterThan(0);
    for (const r of GK_BLOCKED_REFERENCES) {
      expect(r.source).toBe("BLOCKED_MISSING_REFERENCE");
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Negative control: mutating / removing a binding fails validation
// ---------------------------------------------------------------------------

describe("negative control: registry wiring integrity", () => {
  it("removing a GK binding fails registry validation", () => {
    const registry = buildRegistry();
    delete registry.test_bindings["GK-REA-001"];
    const errors = validateRegistrySet(registry);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes("GK-REA-001"))).toBe(true);
  });

  it("a GK binding referencing a missing invariant fails registry validation", () => {
    const registry = buildRegistry();
    // Mutate a copy of the binding so the global registry is not touched.
    const binding = { ...registry.test_bindings["GK-REA-001"] };
    binding.invariant_ids = ["finite-number", "does-not-exist-invariant"];
    registry.test_bindings["GK-REA-001"] = binding as typeof binding;
    const errors = validateRegistrySet(registry);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes("does-not-exist-invariant"))).toBe(true);
  });

  it("the team suite is still NOT registered (unchanged expectation)", () => {
    expect(SUITES["team"]).toBeUndefined();
  });
});
