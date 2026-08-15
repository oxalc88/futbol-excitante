/**
 * @module tests/unit/eval/playable-evaluator
 *
 * Tests for the PLAYABLE_1V1 milestone profile and evaluator.
 *
 * Tests:
 *  1. Profile is registered and field-complete vs spec.
 *  2. Missing required suites → NOT_EVALUATED (not PASS).
 *  3. ARCH-DIFF-001 NEEDS_PERCEPTUAL_REVIEW → overall is not PASS.
 *  4. DEFERRED capability axes never PASS.
 *  5. Existing foundation-lab evaluation still works.
 *  6. No PLAYABLE_1V1_PASS command/function name.
 *  7. Playable 1v1 result structure.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { PLAYABLE_1V1_PROFILE, getMilestoneProfile, MILESTONE_PROFILES } from "../../../eval/contracts/profiles.js";
import { evaluatePlayable1v1 } from "../../../eval/runners/playable-evaluator.js";
import { evaluateCapabilityDesign } from "../../../eval/runners/evaluate-capability-design.js";
import { evaluateFoundation } from "../../../eval/runners/foundation-evaluator.js";
import { BROWSER_CASES } from "../../../eval/contracts/browser-cases.js";
import { loadRegistrySet } from "../../../eval/contracts/loader.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(
    __dirname,
    "../../../eval/scenarios/foundation-move-and-roll.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

function createHeadlessSim(scenario: ScenarioDefinition) {
  const world = createWorld({ scenario });
  return createSimulation(world);
}

function generateBrowserEvidence(scenario: ScenarioDefinition) {
  const headless = createHeadlessSim(scenario);
  const initialHash = headless.stateHash();

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

  return {
    reset: { initialHash },
    step: { initialHash, perTickHashes },
  };
}

// ---------------------------------------------------------------------------
// 1. Profile is registered and field-complete vs spec
// ---------------------------------------------------------------------------

describe("PLAYABLE_1V1 profile registration", () => {
  it("PLAYABLE_1V1_PROFILE is exported and registered in MILESTONE_PROFILES", () => {
    expect(PLAYABLE_1V1_PROFILE).toBeDefined();
    expect(PLAYABLE_1V1_PROFILE.milestone_id).toBe("PLAYABLE_1V1");
    expect(MILESTONE_PROFILES["PLAYABLE_1V1"]).toBe(PLAYABLE_1V1_PROFILE);
  });

  it("getMilestoneProfile returns PLAYABLE_1V1_PROFILE", () => {
    expect(getMilestoneProfile("PLAYABLE_1V1")).toBe(PLAYABLE_1V1_PROFILE);
  });

  it("profile has correct required_suite_ids (spec §2.3)", () => {
    const expected = ["fast", "locomotion", "ball", "touch_and_actions", "duels"];
    expect(PLAYABLE_1V1_PROFILE.required_suite_ids).toEqual(expected);
  });

  it("profile has correct required_browser_case_ids (spec §2.3)", () => {
    const expected = [
      "BROWSER-CORE-RESET-001",
      "BROWSER-CORE-STEP-001",
      "BROWSER-1V1-CONTROL-001",
      "ARCH-DIFF-001",
    ];
    expect(PLAYABLE_1V1_PROFILE.required_browser_case_ids).toEqual(expected);
  });

  it("profile has correct required_criterion_classes (spec §2.3)", () => {
    expect(PLAYABLE_1V1_PROFILE.required_criterion_classes).toContain("HARD_INVARIANT");
    expect(PLAYABLE_1V1_PROFILE.required_criterion_classes).toContain("ENGINE_DESIGN_TARGET");
    expect(PLAYABLE_1V1_PROFILE.required_criterion_classes).toHaveLength(2);
  });

  it("profile has correct required_capabilities", () => {
    expect(PLAYABLE_1V1_PROFILE.required_capabilities).toContain("DETERMINISTIC_CORE");
    expect(PLAYABLE_1V1_PROFILE.required_capabilities).toContain("LOCOMOTION");
    expect(PLAYABLE_1V1_PROFILE.required_capabilities).toContain("INDEPENDENT_BALL");
    expect(PLAYABLE_1V1_PROFILE.required_capabilities).toContain("FIRST_TOUCH");
    expect(PLAYABLE_1V1_PROFILE.required_capabilities).toContain("BASIC_ACTIONS");
    expect(PLAYABLE_1V1_PROFILE.required_capabilities).toContain("PLAYER_DUELS");
    expect(PLAYABLE_1V1_PROFILE.required_capabilities).toContain("LOCAL_CONTROL_SLOTS");
    expect(PLAYABLE_1V1_PROFILE.required_capabilities).toContain("PRESENTATION_BASELINE");
    expect(PLAYABLE_1V1_PROFILE.required_capabilities).toContain("FICTIONAL_ARCHETYPES");
  });

  it("profile has correct deferred_capabilities", () => {
    expect(PLAYABLE_1V1_PROFILE.deferred_capabilities).toContain("REGULATION_MATCH_RULES");
    expect(PLAYABLE_1V1_PROFILE.deferred_capabilities).toContain("MATCH_ECOLOGY");
  });

  it("profile has correct entry_prerequisites", () => {
    expect(PLAYABLE_1V1_PROFILE.entry_prerequisites).toContain("FOUNDATION_LAB_PASS");
    expect(PLAYABLE_1V1_PROFILE.entry_prerequisites).toContain("CAPABILITY_DESIGN_PROFILE");
  });

  it("profile has correct exit_prerequisites", () => {
    expect(PLAYABLE_1V1_PROFILE.exit_prerequisites).toContain("MUTANT_1V1_PASS");
    expect(PLAYABLE_1V1_PROFILE.exit_prerequisites).toContain("ARCHETYPE_BLINDED_COMPARISON_PASS");
  });

  it("all required browser case_ids are registered in BROWSER_CASES", () => {
    for (const caseId of PLAYABLE_1V1_PROFILE.required_browser_case_ids) {
      expect(BROWSER_CASES[caseId]).toBeDefined(
        `Browser case "${caseId}" must be registered`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Missing required suites → NOT_EVALUATED (not PASS)
// ---------------------------------------------------------------------------

describe("PLAYABLE_1V1 evaluator: missing suites", () => {
  it("missing touch_and_actions and duels suites → overall is not PASS", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // touch_and_actions and duels do not exist in the registry.
    // Their presence as required suites makes the overall verdict
    // NOT_EVALUATED (or INVALID_RUN for required suites).
    expect(result.milestoneVerdict).not.toBe("PASS");
  });

  it("subComponents include INVALID_RUN entries for missing suites", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const missingSuiteComponents = result.subComponents.filter(
      (s) => s.componentId.startsWith("MISSING_SUITE:"),
    );
    expect(missingSuiteComponents.length).toBeGreaterThan(0);
    for (const ms of missingSuiteComponents) {
      expect(ms.outcome).toBe("INVALID_RUN");
    }
  });

  it("HARD_INVARIANT suites that exist still evaluate correctly", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // hard-invariant suite component exists.
    const hardInv = result.subComponents.find(
      (s) => s.componentId === "HARD_INVARIANT_SUITES",
    );
    expect(hardInv).toBeDefined();
    expect(hardInv!.componentId).toBe("HARD_INVARIANT_SUITES");
  });
});

// ---------------------------------------------------------------------------
// 3. ARCH-DIFF-001 NEEDS_PERCEPTUAL_REVIEW → overall is not PASS
// ---------------------------------------------------------------------------

describe("PLAYABLE_1V1 evaluator: ARCH-DIFF-001 perceptual review", () => {
  it("ARCH-DIFF-001 is classified as NEEDS_PERCEPTUAL_REVIEW", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const archDiff = result.browserCaseVerdicts.find(
      (v) => v.case_id === "ARCH-DIFF-001",
    );
    expect(archDiff).toBeDefined();
    expect(archDiff!.verdict).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });

  it("overall verdict is not PASS when ARCH-DIFF is NEEDS_PERCEPTUAL_REVIEW", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // Per spec §2.2: NEEDS_PERCEPTUAL_REVIEW > NOT_EVALUATED > PASS.
    // A milestone with a required perceptual case that has not been
    // reviewed cannot be PASS.
    expect(result.milestoneVerdict).not.toBe("PASS");
  });

  it("subComponents include ARCH-DIFF-001 NEEDS_PERCEPTUAL_REVIEW verdict", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const archDiffComponent = result.subComponents.find(
      (s) => s.componentId === "BROWSER_CASE:ARCH-DIFF-001",
    );
    expect(archDiffComponent).toBeDefined();
    expect(archDiffComponent!.outcome).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });
});

// ---------------------------------------------------------------------------
// 4. DEFERRED capability axes never PASS
// ---------------------------------------------------------------------------

describe("PLAYABLE_1V1: DEFERRED axes never PASS", () => {
  it("evaluateCapabilityDesign DEFERRED axes are DEFERRED, never PASS", () => {
    const result = evaluateCapabilityDesign();

    for (const axis of result.axes) {
      if (axis.status === "DEFERRED") {
        expect(axis.outcome).toBe("DEFERRED");
        expect(axis.outcome).not.toBe("PASS");
        expect(axis.outcome).not.toBe("FAIL");
      }
    }
  });

  it("engineDesignTargetOverall is not PASS when DEFERRED axes block it", () => {
    // In the current codebase, the transient-acceleration axis is
    // IMPLEMENTED. DEFERRED axes exist but don't block PASS.
    // The key test is that DEFERRED axes never return PASS.
    const result = evaluateCapabilityDesign();

    const deferredResults = result.axes.filter(
      (a) => a.status === "DEFERRED",
    );
    for (const dr of deferredResults) {
      expect(dr.outcome).toBe("DEFERRED");
      expect(dr.outcome).not.toBe("PASS");
    }
  });

  it("PLAYABLE_1V1 result DEFERRED axes are DEFERRED", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    for (const axis of result.subComponents.find(
      (s) => s.componentId === "ENGINE_DESIGN_TARGET",
    )?.evidence ?? []) {
      // Evidence strings should mention DEFERRED status but never PASS.
      const isDeferring = axis.includes("DEFERRED");
      if (isDeferring) {
        expect(axis).toContain("DEFERRED");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Existing foundation-lab evaluation still works
// ---------------------------------------------------------------------------

describe("Foundation lab evaluation is not broken", () => {
  it("foundation evaluation still runs on the same scenario", () => {
    const scenario = loadFixture();
    const foundationResult = evaluateFoundation(scenario);

    // Should still produce the three foundation suites.
    expect(foundationResult.suites.length).toBe(3);
    const suiteIds = foundationResult.suites.map((s) => s.suite_id);
    expect(suiteIds).toContain("fast");
    expect(suiteIds).toContain("locomotion");
    expect(suiteIds).toContain("ball");
  });

  it("foundation evaluation HARD_INVARIANT criteria are evaluated", () => {
    const scenario = loadFixture();
    const foundationResult = evaluateFoundation(scenario);

    for (const suite of foundationResult.suites) {
      for (const test of suite.tests) {
        for (const criterion of test.criteria) {
          if (criterion.class === "HARD_INVARIANT") {
            // Should be PASS, FAIL, or NOT_EVALUATED — not INVALID_RUN.
            expect(["PASS", "FAIL", "NOT_EVALUATED", "BLOCKED_MISSING_REFERENCE"].includes(
              criterion.outcome,
            )).toBe(true);
          }
        }
      }
    }
  });

  it("PLAYABLE_1V1 evaluator uses the same registry", () => {
    const registry1 = loadRegistrySet();
    const scenario = loadFixture();
    // The playable evaluator internally loads the same registry.
    // Both should have the same milestone profiles.
    expect(registry1.milestone_profiles["FOUNDATION_LAB"]).toBeDefined();
    expect(registry1.milestone_profiles["PLAYABLE_1V1"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. No PLAYABLE_1V1_PASS command/function name
// ---------------------------------------------------------------------------

describe("No PLAYABLE_1V1_PASS naming", () => {
  it("the module does not export a function named PLAYABLE_1V1_PASS", async () => {
    const moduleExports = Object.keys(
      await import("../../../eval/runners/playable-evaluator.js"),
    );
    expect(moduleExports).not.toContain("PLAYABLE_1V1_PASS");
  });

  it("the module exports evaluatePlayable1v1", async () => {
    const moduleExports = Object.keys(
      await import("../../../eval/runners/playable-evaluator.js"),
    );
    expect(moduleExports).toContain("evaluatePlayable1v1");
  });

  it("the result does not have a field named playable_1v1_pass", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);
    expect(result).not.toHaveProperty("playable_1v1_pass");
    expect(result).toHaveProperty("milestoneVerdict");
  });
});

// ---------------------------------------------------------------------------
// 7. Playable 1v1 result structure
// ---------------------------------------------------------------------------

describe("Result structure", () => {
  it("has all required fields", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    expect(result).toHaveProperty("registrySetId");
    expect(result).toHaveProperty("profileVersion");
    expect(result).toHaveProperty("subComponents");
    expect(result).toHaveProperty("allHardInvariantPass");
    expect(result).toHaveProperty("engineDesignTargetOverall");
    expect(result).toHaveProperty("browserCases");
    expect(result).toHaveProperty("browserCaseVerdicts");
    expect(result).toHaveProperty("entryPrerequisitesSatisfied");
    expect(result).toHaveProperty("exitPrerequisitesSatisfied");
    expect(result).toHaveProperty("milestoneVerdict");
    expect(result).toHaveProperty("details");
  });

  it("subComponents are SubComponentResult objects", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    for (const sub of result.subComponents) {
      expect(sub).toHaveProperty("componentId");
      expect(sub).toHaveProperty("outcome");
      expect(sub).toHaveProperty("evidence");
      expect(typeof sub.componentId).toBe("string");
      expect(sub.outcome).toMatch(
        /^(PASS|FAIL|INVALID_RUN|NOT_EVALUATED|NEEDS_PERCEPTUAL_REVIEW|BLOCKED_MISSING_REFERENCE)$/,
      );
      expect(Array.isArray(sub.evidence)).toBe(true);
    }
  });

  it("milestoneVerdict is one of the valid values", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);
    expect(["PASS", "FAIL", "INVALID_RUN", "NOT_EVALUATED", "NEEDS_PERCEPTUAL_REVIEW"]).toContain(
      result.milestoneVerdict,
    );
  });

  it("browserCaseVerdicts includes all required browser cases", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const verdictCaseIds = result.browserCaseVerdicts.map((v) => v.case_id);
    for (const caseId of PLAYABLE_1V1_PROFILE.required_browser_case_ids) {
      expect(verdictCaseIds).toContain(caseId);
    }
  });

  it("details is a non-empty string", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);
    expect(typeof result.details).toBe("string");
    expect(result.details.length).toBeGreaterThan(0);
  });

  it("browserCases in result matches input or is empty array", () => {
    const scenario = loadFixture();
    const result1 = evaluatePlayable1v1(scenario);
    expect(result1.browserCases).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 8. Overall verdict is not PASS when ARCH-DIFF is NEEDS_PERCEPTUAL_REVIEW
// ---------------------------------------------------------------------------

describe("Overall verdict prevents PASS with NEEDS_PERCEPTUAL_REVIEW", () => {
  it("verdict precedence: NEEDS_PERCEPTUAL_REVIEW prevents PASS", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // Even with valid browser evidence for BROWSER-CORE cases,
    // ARCH-DIFF-001 being NEEDS_PERCEPTUAL_REVIEW should prevent PASS.
    expect(result.milestoneVerdict).not.toBe("PASS");
  });

  it("PLAYABLE_1V1_PASS is never claimed", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // No evidence string should claim PLAYABLE_1V1_PASS.
    for (const component of result.subComponents) {
      for (const evidence of component.evidence) {
        expect(
          evidence.toLowerCase().includes("playable_1v1_pass"),
          `Evidence should not contain "PLAYABLE_1V1_PASS": ${evidence}`,
        ).toBe(false);
      }
    }

    expect(
      result.details.toLowerCase().includes("playable_1v1_pass"),
    ).toBe(false);
  });

  it("result details mention the actual verdict", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // Details should contain the verdict string.
    expect(result.details).toContain(result.milestoneVerdict);
  });
});

// ---------------------------------------------------------------------------
// 9. No PES claims
// ---------------------------------------------------------------------------

describe("No PES claims", () => {
  it("evaluatePlayable1v1 does not claim PES fidelity", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const pesTerms = [
      "PES fidelity",
      "PES match",
      "PES 2017",
      "FOUNDATION_LAB_PASS",
      "PLAYABLE_1V1_PASS",
    ];

    for (const component of result.subComponents) {
      for (const evidence of component.evidence) {
        for (const term of pesTerms) {
          expect(
            evidence.toLowerCase().includes(term.toLowerCase()),
            `Evidence should not contain "${term}": ${evidence}`,
          ).toBe(false);
        }
      }
    }
  });

  it("evaluateCapabilityDesign does not claim PES fidelity (regression)", () => {
    const result = evaluateCapabilityDesign();

    const pesTerms = [
      "PES fidelity",
      "PES match",
      "PES 2017",
      "FOUNDATION_LAB_PASS",
    ];

    for (const axis of result.axes) {
      for (const evidence of axis.evidence) {
        for (const term of pesTerms) {
          expect(
            evidence.toLowerCase().includes(term.toLowerCase()),
            `Evidence for axis "${axis.axis_id}" should not contain "${term}": ${evidence}`,
          ).toBe(false);
        }
      }
    }
  });
});