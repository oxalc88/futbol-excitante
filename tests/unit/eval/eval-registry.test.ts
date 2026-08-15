/**
 * @module tests/unit/eval/eval-registry
 *
 * Tests for the evaluation registry loader, bindings, and policies.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";

import {
  loadRegistrySet,
  validateRegistrySet,
  resolveReference,
  type RegistrySet,
} from "../../../eval/contracts/loader.js";
import { TEST_BINDINGS, ALL_TEST_IDS } from "../../../eval/contracts/bindings.js";
import { SUITES } from "../../../eval/contracts/suites.js";
import { COMMON_CRITERIA } from "../../../eval/contracts/common-criteria.js";
import { MILESTONE_PROFILES } from "../../../eval/contracts/profiles.js";
import { CAPABILITY_MANIFESTS } from "../../../eval/contracts/capabilities.js";
import { getRegistryEntry } from "../../../eval/contracts/bootstrap-registry.js";
import type { TestImplementationBinding } from "../../../eval/contracts/types.js";

import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { makeInputFrame } from "../contracts.fixture.js";

// ---------------------------------------------------------------------------
// Helper: build a shallow-cloned registry set (isolated per test)
// ---------------------------------------------------------------------------

function buildRegistry(): RegistrySet {
  const base = loadRegistrySet();
  // Clone all registry maps so tests can mutate without side effects
  return {
    ...base,
    milestone_profiles: { ...base.milestone_profiles },
    capability_manifests: { ...base.capability_manifests },
    common_criteria: { ...base.common_criteria },
    invariant_definitions: { ...base.invariant_definitions },
    observation_definitions: { ...base.observation_definitions },
    metric_definitions: { ...base.metric_definitions },
    scenario_definitions: { ...base.scenario_definitions },
    suite_definitions: { ...base.suite_definitions },
    test_bindings: { ...base.test_bindings },
    reference_targets: { ...base.reference_targets },
    seed_policies: { ...base.seed_policies },
    config_policies: { ...base.config_policies },
    resource_policies: { ...base.resource_policies },
    outcome_reduction_policies: { ...base.outcome_reduction_policies },
    expansion_manifests: { ...base.expansion_manifests },
  };
}

// ---------------------------------------------------------------------------
// Loader: accept valid registry
// ---------------------------------------------------------------------------

describe("loader accept", () => {
  it("loadRegistrySet produces a valid registry set with real hash", () => {
    const registry = loadRegistrySet();
    expect(registry.registry_set_id).toBeDefined();
    expect(registry.content_hash).toBeDefined();
    expect(registry.registry_set_id).not.toBe("placeholder");
    expect(registry.content_hash).not.toBe("placeholder");
  });

  it("validates without errors", () => {
    const registry = loadRegistrySet();
    const errors = validateRegistrySet(registry);
    expect(errors).toHaveLength(0);
  });

  it("contains all three suites", () => {
    const registry = loadRegistrySet();
    expect(registry.suite_definitions).toHaveProperty("fast");
    expect(registry.suite_definitions).toHaveProperty("locomotion");
    expect(registry.suite_definitions).toHaveProperty("ball");
  });

  it("contains all 42 test bindings (33 original + 9 duels)", () => {
    expect(ALL_TEST_IDS).toHaveLength(42);
  });
});

// ---------------------------------------------------------------------------
// Loader: reject structural violations
// ---------------------------------------------------------------------------

describe("loader reject: structural", () => {
  it("rejects a scenario where key differs from scenario_id", () => {
    // Clone the registry, inject a bad scenario, and validate.
    const registry = buildRegistry();
    registry.scenario_definitions["wrong-key-v1"] = {
      ...registry.scenario_definitions["scn-ball-ind-001-v1"],
      scenario_id: "different-id-v1",
    };
    const errors = validateRegistrySet(registry);
    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.some((e) => e.message.includes("wrong-key-v1")),
    ).toBe(true);
  });

  it("rejects when a scenario is referenced but not registered", () => {
    const registry = buildRegistry();
    registry.test_bindings["FAKE-TEST-001"] = makeFakeBinding(
      ["scn-ball-ind-001-v1"],
      ["nonexistent-scenario-v1"],
    );
    registry.test_bindings["FAKE-TEST-001"].scenario_ids = [
      "nonexistent-scenario-v1",
    ];
    const errors = validateRegistrySet(registry);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes("nonexistent-scenario-v1"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Loader: reject unresolved references
// ---------------------------------------------------------------------------

describe("loader reject: unresolved reference", () => {
  it("rejects when a binding references a missing metric", () => {
    const registry = buildRegistry();
    registry.test_bindings["FAKE-METRIC-001"] = makeFakeBinding(
      ["scn-ball-ind-001-v1"],
      ["nonexistent-metric-v1"],
    );
    const errors = validateRegistrySet(registry);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes("nonexistent-metric-v1"))).toBe(true);
  });

  it("rejects when a binding references a missing invariant", () => {
    const registry = buildRegistry();
    registry.test_bindings["FAKE-INV-001"] = makeFakeBinding(
      ["scn-ball-ind-001-v1"],
      [],
      ["nonexistent-invariant-v1"],
    );
    const errors = validateRegistrySet(registry);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes("nonexistent-invariant-v1"))).toBe(true);
  });

  it("rejects when a binding references a missing observation", () => {
    const registry = buildRegistry();
    registry.test_bindings["FAKE-OBS-001"] = makeFakeBinding(
      ["scn-ball-ind-001-v1"],
      [],
      [],
      ["nonexistent-obs-v1"],
    );
    const errors = validateRegistrySet(registry);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes("nonexistent-obs-v1"))).toBe(true);
  });

  it("rejects when a suite references a missing test binding", () => {
    const registry = buildRegistry();
    registry.suite_definitions["fake-suite"] = {
      suite_id: "fake-suite",
      suite_version: "suite-fake-v1",
      direct_test_ids: ["nonexistent-test-v1"],
      common_criterion_ids: [],
      impact_closure: "NONE",
      prerequisite_capabilities: [],
      seed_matrix_id: "seeds-smoke-v1",
      config_matrix_id: "config-default-v1",
      held_out_policy_id: null,
      browser_case_ids: [],
      resource_policy_id: "resources-fast-v1",
      outcome_reduction_profile_id: "required-hard-v1",
      expected_expansion_manifest_id: "expansion-fast-v1",
    };
    const errors = validateRegistrySet(registry);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes("nonexistent-test-v1"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Loader: reject missing required observables on binding
// ---------------------------------------------------------------------------

describe("loader reject: missing required observable", () => {
  it("rejects a binding with no observation_ids", () => {
    const registry = buildRegistry();
    registry.test_bindings["NO-OBS-001"] = makeFakeBinding(
      ["scn-ball-ind-001-v1"],
      ["ball-speed"],
      ["finite-number"],
      [], // no observations
    );
    const errors = validateRegistrySet(registry);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes("NO-OBS-001"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Expansion: NONE impact_closure means expanded === sorted direct_test_ids
// ---------------------------------------------------------------------------

describe("expansion NONE", () => {
  it("fast suite expansion equals sorted unique direct_test_ids", () => {
    const registry = loadRegistrySet();
    const fastSuite = registry.suite_definitions["fast"];
    const key = fastSuite.expected_expansion_manifest_id;
    const expansion = registry.expansion_manifests[key];
    expect(expansion).toBeDefined();
    expect(expansion.impact_closure).toBe("NONE");
    const expected = [...new Set(fastSuite.direct_test_ids)].sort();
    expect(expansion.expanded_test_ids).toEqual(expected);
  });

  it("locomotion suite expansion equals sorted unique direct_test_ids", () => {
    const registry = loadRegistrySet();
    const locoSuite = registry.suite_definitions["locomotion"];
    const key = locoSuite.expected_expansion_manifest_id;
    const expansion = registry.expansion_manifests[key];
    expect(expansion).toBeDefined();
    expect(expansion.impact_closure).toBe("NONE");
    const expected = [...new Set(locoSuite.direct_test_ids)].sort();
    expect(expansion.expanded_test_ids).toEqual(expected);
  });

  it("ball suite expansion equals sorted unique direct_test_ids", () => {
    const registry = loadRegistrySet();
    const ballSuite = registry.suite_definitions["ball"];
    const key = ballSuite.expected_expansion_manifest_id;
    const expansion = registry.expansion_manifests[key];
    expect(expansion).toBeDefined();
    expect(expansion.impact_closure).toBe("NONE");
    const expected = [...new Set(ballSuite.direct_test_ids)].sort();
    expect(expansion.expanded_test_ids).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Hash stability
// ---------------------------------------------------------------------------

describe("hash stability", () => {
  it("content hash is stable across two loads", () => {
    const registry1 = loadRegistrySet();
    const registry2 = loadRegistrySet();
    expect(registry1.content_hash).toBe(registry2.content_hash);
    expect(registry1.registry_set_id).toBe(registry2.registry_set_id);
  });
});

// ---------------------------------------------------------------------------
// MEASURED_TARGET without ReferenceTarget → BLOCKED_MISSING_REFERENCE
// ---------------------------------------------------------------------------

describe("MEASURED_TARGET resolution", () => {
  it("resolveReference returns BLOCKED_MISSING_REFERENCE for any (test_id, criterion_id)", () => {
    const registry = loadRegistrySet();
    const result = resolveReference(
      "BALL-IND-001",
      "COMMON-FINITE",
      registry,
    );
    expect(result.kind).toBe("BLOCKED_MISSING_REFERENCE");
  });

  it("never returns RESOLVED for a missing reference target", () => {
    const registry = loadRegistrySet();
    for (const testId of ALL_TEST_IDS) {
      for (const criterionId of Object.keys(COMMON_CRITERIA)) {
        const result = resolveReference(testId, criterionId, registry);
        expect(result.kind).not.toBe("RESOLVED");
      }
    }
  });

  it("returns INVALID_RUN for unknown test_id", () => {
    const registry = loadRegistrySet();
    const result = resolveReference("NONEXISTENT-001", "COMMON-FINITE", registry);
    expect(result.kind).toBe("INVALID_RUN");
  });

  it("returns INVALID_RUN for unknown criterion_id", () => {
    const registry = loadRegistrySet();
    const result = resolveReference("BALL-IND-001", "NONEXISTENT-CRIT", registry);
    expect(result.kind).toBe("INVALID_RUN");
  });
});

// ---------------------------------------------------------------------------
// BOOTSTRAP_REGISTRY still resolves foundation-move-and-roll-v1
// ---------------------------------------------------------------------------

describe("bootstrap registry", () => {
  it("getRegistryEntry finds foundation-move-and-roll-v1", () => {
    const entry = getRegistryEntry("foundation-move-and-roll-v1");
    expect(entry).toBeDefined();
    expect(entry!.id).toBe("foundation-move-and-roll-v1");
  });

  it("getRegistryEntry returns undefined for unknown id", () => {
    const entry = getRegistryEntry("nonexistent-scenario");
    expect(entry).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// All bindings resolve their referenced IDs (via the loaded registry)
// ---------------------------------------------------------------------------

describe("binding completeness", () => {
  it("every binding scenario exists in the loaded registry", () => {
    const registry = loadRegistrySet();
    for (const [testId, binding] of Object.entries(TEST_BINDINGS)) {
      for (const sid of binding.scenario_ids) {
        expect(registry.scenario_definitions[sid]).toBeDefined();
      }
    }
  });

  it("every binding metric exists in the loaded registry", () => {
    const registry = loadRegistrySet();
    for (const [testId, binding] of Object.entries(TEST_BINDINGS)) {
      for (const mid of binding.metric_ids) {
        expect(registry.metric_definitions[mid]).toBeDefined();
      }
    }
  });

  it("every binding invariant exists in the loaded registry", () => {
    const registry = loadRegistrySet();
    for (const [testId, binding] of Object.entries(TEST_BINDINGS)) {
      for (const iid of binding.invariant_ids) {
        expect(registry.invariant_definitions[iid]).toBeDefined();
      }
    }
  });

  it("every binding observation exists in the loaded registry", () => {
    const registry = loadRegistrySet();
    for (const [testId, binding] of Object.entries(TEST_BINDINGS)) {
      for (const oid of binding.observation_ids) {
        expect(registry.observation_definitions[oid]).toBeDefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Milestone profile references
// ---------------------------------------------------------------------------

describe("milestone profile", () => {
  it("FOUNDATION_LAB profile references all three suites", () => {
    const profile = MILESTONE_PROFILES["FOUNDATION_LAB"];
    expect(profile).toBeDefined();
    expect(profile.required_suite_ids).toContain("fast");
    expect(profile.required_suite_ids).toContain("locomotion");
    expect(profile.required_suite_ids).toContain("ball");
  });

  it("capability manifest covers all required capabilities", () => {
    const manifest = CAPABILITY_MANIFESTS["foundation-lab-capabilities-v1"];
    expect(manifest.dispositions["DETERMINISTIC_CORE"]).toBe("REQUIRED");
    expect(manifest.dispositions["LOCOMOTION"]).toBe("REQUIRED");
    expect(manifest.dispositions["INDEPENDENT_BALL"]).toBe("REQUIRED");
    expect(manifest.dispositions["HEADLESS_SCENARIOS"]).toBe("REQUIRED");
    expect(manifest.dispositions["BROWSER_CORE_SMOKE"]).toBe("REQUIRED");
    expect(manifest.dispositions["EXTERNAL_RATING_AS_GAMEPLAY_VALUE"]).toBe("PROHIBITED");
  });
});

// ---------------------------------------------------------------------------
// Policy completeness (via the loaded registry)
// ---------------------------------------------------------------------------

describe("policies completeness", () => {
  it("seed policies cover all suite seed_matrix_ids", () => {
    const registry = loadRegistrySet();
    for (const suite of Object.values(SUITES)) {
      expect(registry.seed_policies[suite.seed_matrix_id]).toBeDefined();
    }
  });

  it("config policies cover all suite config_matrix_ids", () => {
    const registry = loadRegistrySet();
    for (const suite of Object.values(SUITES)) {
      expect(registry.config_policies[suite.config_matrix_id]).toBeDefined();
    }
  });

  it("resource policies cover all suite resource_policy_ids", () => {
    const registry = loadRegistrySet();
    for (const suite of Object.values(SUITES)) {
      expect(registry.resource_policies[suite.resource_policy_id]).toBeDefined();
    }
  });

  it("outcome reduction policies cover all suite outcome_reduction_profile_ids", () => {
    const registry = loadRegistrySet();
    for (const suite of Object.values(SUITES)) {
      expect(registry.outcome_reduction_policies[suite.outcome_reduction_profile_id]).toBeDefined();
    }
  });

  it("expansion manifests cover all suite expected_expansion_manifest_ids", () => {
    const registry = loadRegistrySet();
    for (const suite of Object.values(SUITES)) {
      expect(registry.expansion_manifests[suite.expected_expansion_manifest_id]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Browser case registry — loading and resolution
// ---------------------------------------------------------------------------

import {
  BROWSER_CASES,
  getBrowserCase,
  ALL_BROWSER_CASE_IDS,
  validateBrowserCaseResults,
} from "../../../eval/contracts/browser-cases.js";

describe("browser case registry", () => {
  it("contains both required browser case IDs from FOUNDATION_LAB profile", () => {
    const profile = MILESTONE_PROFILES["FOUNDATION_LAB"];
    expect(profile.required_browser_case_ids).toContain("BROWSER-CORE-RESET-001");
    expect(profile.required_browser_case_ids).toContain("BROWSER-CORE-STEP-001");
  });

  it("BROWSER-CORE-RESET-001 resolves from the registry", () => {
    const case_ = getBrowserCase("BROWSER-CORE-RESET-001");
    expect(case_).toBeDefined();
    expect(case_!.case_id).toBe("BROWSER-CORE-RESET-001");
  });

  it("BROWSER-CORE-STEP-001 resolves from the registry", () => {
    const case_ = getBrowserCase("BROWSER-CORE-STEP-001");
    expect(case_).toBeDefined();
    expect(case_!.case_id).toBe("BROWSER-CORE-STEP-001");
  });

  it("unknown case_id returns undefined", () => {
    expect(getBrowserCase("NONEXISTENT-001")).toBeUndefined();
  });

  it("ALL_BROWSER_CASE_IDS includes both cases", () => {
    expect(ALL_BROWSER_CASE_IDS).toContain("BROWSER-CORE-RESET-001");
    expect(ALL_BROWSER_CASE_IDS).toContain("BROWSER-CORE-STEP-001");
  });

  it("registry set contains browser_cases array", () => {
    const registry = loadRegistrySet();
    expect(registry.browser_cases).toBeDefined();
    expect(Array.isArray(registry.browser_cases)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Browser case validation — missing required → INVALID_RUN
// ---------------------------------------------------------------------------

import {
  evaluateFoundation,
  type FoundationEvaluationResult,
} from "../../../eval/runners/foundation-evaluator.js";
import type { BrowserCaseResult } from "../../../eval/contracts/types.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function loadFixture(): Parameters<typeof evaluateFoundation>[0]["scenario"] {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(
    __dirname,
    "../../../eval/scenarios/foundation-move-and-roll.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as Parameters<typeof evaluateFoundation>[0]["scenario"];
}

/**
 * Generate browser-case evidence from a scenario using the simulation core.
 * Uses the scenario's actual input program so evidence matches the headless ref.
 */
function generateBrowserEvidence(scenario: Parameters<typeof evaluateFoundation>[0]["scenario"]) {
  const headless = createHeadlessSim(scenario);
  const initialHash = headless.stateHash();

  // Generate perTickHashes from a simulation using the scenario's actual inputs.
  const sim2 = createHeadlessSim(scenario);
  const perTickHashes: string[] = [];
  const ticks = Math.min(5, scenario.durationTicks);
  for (let tick = 0; tick < ticks; tick++) {
    const inputs = scenario.inputProgram[sim2.tick] ?? [];
    if (inputs.length > 0) {
      sim2.applyInputs(inputs);
    }
    const result = sim2.step();
    perTickHashes.push(result.stateHash);
  }

  return { reset: { initialHash }, step: { initialHash, perTickHashes } };
}

function createHeadlessSim(scenario: Parameters<typeof evaluateFoundation>[0]["scenario"]) {
  const world = createWorld({ scenario });
  return createSimulation(world);
}

describe("browser case validation", () => {
  it("missing required browser case → INVALID_RUN overall", () => {
    const scenario = loadFixture();
    // No browser cases provided — should be INVALID_RUN.
    const result = evaluateFoundation(scenario);
    expect(result.overall).toBe("INVALID_RUN");
  });

  it("both required browser cases with evidence → PASS overall", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);
    const browserCases: BrowserCaseResult[] = [
      { case_id: "BROWSER-CORE-RESET-001", passed: true, evidence: { initialHash: evidence.reset.initialHash } },
      { case_id: "BROWSER-CORE-STEP-001", passed: true, evidence: { initialHash: evidence.step.initialHash, perTickHashes: evidence.step.perTickHashes } },
    ];
    const result = evaluateFoundation(scenario, { browserCases });
    // With browser cases provided, overall comes from suite evaluation.
    expect(result.overall).toBe("PASS");
  });

  it("browser case provided but failed → overall FAIL", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);
    const browserCases: BrowserCaseResult[] = [
      { case_id: "BROWSER-CORE-RESET-001", passed: false, error: "hash mismatch", evidence: { initialHash: evidence.reset.initialHash } },
      { case_id: "BROWSER-CORE-STEP-001", passed: true, evidence: { initialHash: evidence.step.initialHash, perTickHashes: evidence.step.perTickHashes } },
    ];
    const result = evaluateFoundation(scenario, { browserCases });
    // Evidence is valid (matches headless) but case failed → FAIL.
    expect(result.overall).toBe("FAIL");
  });

  it("missing one of two required cases → INVALID_RUN", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);
    const browserCases: BrowserCaseResult[] = [
      { case_id: "BROWSER-CORE-RESET-001", passed: true, evidence: { initialHash: evidence.reset.initialHash } },
      // BROWSER-CORE-STEP-001 is missing.
    ];
    const result = evaluateFoundation(scenario, { browserCases });
    expect(result.overall).toBe("INVALID_RUN");
  });

  it("registry.browser_cases is populated from opts", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);
    const browserCases: BrowserCaseResult[] = [
      { case_id: "BROWSER-CORE-RESET-001", passed: true, evidence: { initialHash: evidence.reset.initialHash } },
      { case_id: "BROWSER-CORE-STEP-001", passed: true, evidence: { initialHash: evidence.step.initialHash, perTickHashes: evidence.step.perTickHashes } },
    ];
    const result = evaluateFoundation(scenario, { browserCases });
    expect(result.browserCases).toEqual(browserCases);
  });

  it("validateBrowserCaseResults rejects unknown case_id", () => {
    const errors = validateBrowserCaseResults([
      { case_id: "NONEXISTENT-001", passed: true, evidence: { initialHash: "abc" } },
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("NONEXISTENT-001");
  });

  it("validateBrowserCaseResults passes for known case_ids", () => {
    const errors = validateBrowserCaseResults([
      { case_id: "BROWSER-CORE-RESET-001", passed: true, evidence: { initialHash: "abc" } },
      { case_id: "BROWSER-CORE-STEP-001", passed: false, error: "some error", evidence: { initialHash: "def" } },
    ]);
    expect(errors).toHaveLength(0);
  });

  it("dummy initialHash (not matching headless) yields INVALID_RUN", () => {
    const scenario = loadFixture();
    const browserCases: BrowserCaseResult[] = [
      { case_id: "BROWSER-CORE-RESET-001", passed: true, evidence: { initialHash: "dummy-never-produced" } },
      { case_id: "BROWSER-CORE-STEP-001", passed: true, evidence: { initialHash: "also-dummy" } },
    ];
    const result = evaluateFoundation(scenario, { browserCases });
    expect(result.overall).toBe("INVALID_RUN");
  });

  it("dummy perTickHash (not matching headless) yields INVALID_RUN", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);
    const browserCases: BrowserCaseResult[] = [
      { case_id: "BROWSER-CORE-RESET-001", passed: true, evidence: { initialHash: evidence.reset.initialHash } },
      { case_id: "BROWSER-CORE-STEP-001", passed: true, evidence: { initialHash: evidence.step.initialHash, perTickHashes: ["fake-hash"] } },
    ];
    const result = evaluateFoundation(scenario, { browserCases });
    expect(result.overall).toBe("INVALID_RUN");
  });

  it("passed:false with matching evidence yields FAIL overall", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);
    const browserCases: BrowserCaseResult[] = [
      { case_id: "BROWSER-CORE-RESET-001", passed: false, error: "hash mismatch", evidence: { initialHash: evidence.reset.initialHash } },
      { case_id: "BROWSER-CORE-STEP-001", passed: true, evidence: { initialHash: evidence.step.initialHash, perTickHashes: evidence.step.perTickHashes } },
    ];
    const result = evaluateFoundation(scenario, { browserCases });
    expect(result.overall).toBe("FAIL");
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeBinding(
  scenarioIds: string[],
  metricIds: string[],
  invariantIds: string[] = [],
  observationIds: string[] = [],
): TestImplementationBinding {
  return {
    test_id: "FAKE-TEST",
    scenario_ids: scenarioIds,
    metric_ids: metricIds,
    invariant_ids: invariantIds,
    observation_ids: observationIds,
    criterion_bindings: {},
    required_schema_versions: {},
    implementation_version: "v1",
  };
}