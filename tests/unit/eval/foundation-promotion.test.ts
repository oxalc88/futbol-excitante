/**
 * @module tests/unit/eval/foundation-promotion
 *
 * Tests for the FOUNDATION_LAB milestone reducer
 * (eval/runners/foundation-promotion.ts).
 *
 * Tests:
 *  1. Happy path — valid browser evidence → milestoneVerdict PASS
 *  2. Missing browser case → INVALID_RUN
 *  3. Dummy browser hash → INVALID_RUN
 *  4. skipMutationIds → INVALID_RUN (cannot PASS)
 *  5. MEASURED_TARGET BLOCKED_MISSING_REFERENCE does not prevent PASS
 *  6. No FOUNDATION_LAB_PASS command name / function name
 *  7. Browser case passed:false → FAIL
 *  8. Two-run COMMON-DETERMINISTIC PASS is verified
 *  9. Structure has required fields
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Import wire.ts to register all oracles before running.
import "../../../eval/oracles/wire.js";

import { evaluateFoundationLab } from "../../../eval/runners/foundation-promotion.js";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import type { ScenarioDefinition, InputFrame } from "../../../src/contracts/index.js";
import type { BrowserCaseResult } from "../../../eval/contracts/types.js";

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

function buildInputProgram(
  durationTicks: number,
  controlSlot: string,
): Record<number, InputFrame[]> {
  const program: Record<number, InputFrame[]> = {};
  for (let t = 0; t < durationTicks; t++) {
    program[t] = [
      {
        tick: t,
        sourceId: "test-source",
        controlSlot,
        moveX: 0,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ];
  }
  return program;
}

/**
 * Generate browser-case evidence from a scenario using the simulation core.
 * Uses the scenario's actual input program so evidence matches the headless ref.
 */
function generateBrowserEvidence(
  scenario: ScenarioDefinition,
): { reset: { initialHash: string }; step: { initialHash: string; perTickHashes: string[] } } {
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

  return {
    reset: { initialHash },
    step: { initialHash, perTickHashes },
  };
}

function createHeadlessSim(scenario: ScenarioDefinition) {
  const world = createWorld({ scenario });
  return createSimulation(world);
}

// ---------------------------------------------------------------------------
// 1. Happy path — valid browser evidence → PASS
// ---------------------------------------------------------------------------

describe("Happy path: valid browser evidence → PASS", () => {
  it("milestoneVerdict is PASS with valid browser evidence", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);

    const browserCases: BrowserCaseResult[] = [
      {
        case_id: "BROWSER-CORE-RESET-001",
        passed: true,
        evidence: { initialHash: evidence.reset.initialHash },
      },
      {
        case_id: "BROWSER-CORE-STEP-001",
        passed: true,
        evidence: { initialHash: evidence.step.initialHash, perTickHashes: evidence.step.perTickHashes },
      },
    ];

    const result = evaluateFoundationLab(scenario, { browserCases });

    expect(result.milestoneVerdict).toBe("PASS");
    expect(result.allHardInvariantPass).toBe(true);
    expect(result.commonDeterministicPass).toBe(true);
    expect(result.mutantCorePass).toBe(true);
  });

  it("subComponents includes all required components", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);

    const browserCases: BrowserCaseResult[] = [
      {
        case_id: "BROWSER-CORE-RESET-001",
        passed: true,
        evidence: { initialHash: evidence.reset.initialHash },
      },
      {
        case_id: "BROWSER-CORE-STEP-001",
        passed: true,
        evidence: { initialHash: evidence.step.initialHash, perTickHashes: evidence.step.perTickHashes },
      },
    ];

    const result = evaluateFoundationLab(scenario, { browserCases });

    const componentIds = result.subComponents.map((s) => s.componentId);
    expect(componentIds).toContain("BROWSER_CASES");
    expect(componentIds).toContain("COMMON-DETERMINISTIC");
    expect(componentIds).toContain("MUTANT_CORE");
    expect(componentIds).toContain("HARD_INVARIANT_SUITES");
  });

  it("registrySetId and profileVersion are set", () => {
    const scenario = loadFixture();
    const result = evaluateFoundationLab(scenario);

    expect(result.registrySetId).toBeDefined();
    expect(result.registrySetId).not.toBe("placeholder");
    expect(result.profileVersion).toBe("milestone-foundation-v1");
  });
});

// ---------------------------------------------------------------------------
// 2. Missing browser case → INVALID_RUN
// ---------------------------------------------------------------------------

describe("Missing browser case → INVALID_RUN", () => {
  it("no browser cases at all → INVALID_RUN", () => {
    const scenario = loadFixture();
    const result = evaluateFoundationLab(scenario);

    expect(result.milestoneVerdict).toBe("INVALID_RUN");
  });

  it("missing one of two required browser cases → INVALID_RUN", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);

    const browserCases: BrowserCaseResult[] = [
      {
        case_id: "BROWSER-CORE-RESET-001",
        passed: true,
        evidence: { initialHash: evidence.reset.initialHash },
      },
      // BROWSER-CORE-STEP-001 is missing.
    ];

    const result = evaluateFoundationLab(scenario, { browserCases });

    expect(result.milestoneVerdict).toBe("INVALID_RUN");
  });
});

// ---------------------------------------------------------------------------
// 3. Dummy browser hash → INVALID_RUN
// ---------------------------------------------------------------------------

describe("Dummy browser hash → INVALID_RUN", () => {
  it("dummy initialHash (not matching headless) → INVALID_RUN", () => {
    const scenario = loadFixture();

    const browserCases: BrowserCaseResult[] = [
      {
        case_id: "BROWSER-CORE-RESET-001",
        passed: true,
        evidence: { initialHash: "dummy-never-produced" },
      },
      {
        case_id: "BROWSER-CORE-STEP-001",
        passed: true,
        evidence: { initialHash: "also-dummy" },
      },
    ];

    const result = evaluateFoundationLab(scenario, { browserCases });

    expect(result.milestoneVerdict).toBe("INVALID_RUN");
  });

  it("dummy perTickHash (not matching headless) → INVALID_RUN", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);

    const browserCases: BrowserCaseResult[] = [
      {
        case_id: "BROWSER-CORE-RESET-001",
        passed: true,
        evidence: { initialHash: evidence.reset.initialHash },
      },
      {
        case_id: "BROWSER-CORE-STEP-001",
        passed: true,
        evidence: { initialHash: evidence.step.initialHash, perTickHashes: ["fake-hash"] },
      },
    ];

    const result = evaluateFoundationLab(scenario, { browserCases });

    expect(result.milestoneVerdict).toBe("INVALID_RUN");
  });
});

// ---------------------------------------------------------------------------
// 4. skipMutationIds → INVALID_RUN (cannot PASS)
// ---------------------------------------------------------------------------

describe("skipMutationIds → INVALID_RUN", () => {
  it("skipping an implementable mutant yields INVALID_RUN milestone", () => {
    const scenario = loadFixture();

    const result = evaluateFoundationLab(scenario, {
      skipMutationIds: ["non-finite"],
    });

    // MUTANT_CORE becomes INVALID_RUN because an implementable mutant
    // was skipped, which makes the overall milestone INVALID_RUN.
    expect(result.mutantCorePass).toBe(false);
    expect(result.milestoneVerdict).not.toBe("PASS");
    expect(result.milestoneVerdict).toBe("INVALID_RUN");
  });
});

// ---------------------------------------------------------------------------
// 5. MEASURED_TARGET BLOCKED_MISSING_REFERENCE does not prevent PASS
// ---------------------------------------------------------------------------

describe("MEASURED_TARGET BLOCKED_MISSING_REFERENCE", () => {
  it("BLOCKED_MISSING_REFERENCE criteria do not prevent milestone PASS", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);

    const browserCases: BrowserCaseResult[] = [
      {
        case_id: "BROWSER-CORE-RESET-001",
        passed: true,
        evidence: { initialHash: evidence.reset.initialHash },
      },
      {
        case_id: "BROWSER-CORE-STEP-001",
        passed: true,
        evidence: { initialHash: evidence.step.initialHash, perTickHashes: evidence.step.perTickHashes },
      },
    ];

    const result = evaluateFoundationLab(scenario, { browserCases });

    // MEASURED_TARGET criteria in the suites return BLOCKED_MISSING_REFERENCE
    // but the milestone should still PASS because only HARD_INVARIANT matters.
    expect(result.milestoneVerdict).toBe("PASS");

    // Verify HARD_INVARIANT criteria all pass.
    expect(result.allHardInvariantPass).toBe(true);

    // The suites overall may be PASS or have mixed criteria, but the
    // milestone reducer correctly ignores non-HARD_INVARIANT outcomes.
    const hardInvComponents = result.subComponents.filter(
      (s) => s.componentId === "HARD_INVARIANT_SUITES",
    );
    expect(hardInvComponents.length).toBe(1);
    expect(hardInvComponents[0].outcome).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 6. No FOUNDATION_LAB_PASS function/command name
// ---------------------------------------------------------------------------

describe("No FOUNDATION_LAB_PASS naming", () => {
  it("the module does not export a function named FOUNDATION_LAB_PASS", async () => {
    // Dynamically check that no named export is FOUNDATION_LAB_PASS.
    const moduleExports = Object.keys(
      await import("../../../eval/runners/foundation-promotion.js"),
    );
    expect(moduleExports).not.toContain("FOUNDATION_LAB_PASS");
  });

  it("the module exports evaluateFoundationLab", async () => {
    const moduleExports = Object.keys(
      await import("../../../eval/runners/foundation-promotion.js"),
    );
    expect(moduleExports).toContain("evaluateFoundationLab");
  });

  it("the result does not have a field named foundation_lab_pass", () => {
    const scenario = loadFixture();
    const result = evaluateFoundationLab(scenario);
    // Verify the result structure does not include FOUNDATION_LAB_PASS naming.
    expect(result).not.toHaveProperty("foundation_lab_pass");
    expect(result).toHaveProperty("milestoneVerdict");
  });
});

// ---------------------------------------------------------------------------
// 7. Browser case passed:false → FAIL
// ---------------------------------------------------------------------------

describe("Browser case passed:false → FAIL", () => {
  it("browser case with valid evidence but passed:false → FAIL", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);

    const browserCases: BrowserCaseResult[] = [
      {
        case_id: "BROWSER-CORE-RESET-001",
        passed: false,
        error: "hash mismatch",
        evidence: { initialHash: evidence.reset.initialHash },
      },
      {
        case_id: "BROWSER-CORE-STEP-001",
        passed: true,
        evidence: { initialHash: evidence.step.initialHash, perTickHashes: evidence.step.perTickHashes },
      },
    ];

    const result = evaluateFoundationLab(scenario, { browserCases });

    expect(result.milestoneVerdict).toBe("FAIL");
  });
});

// ---------------------------------------------------------------------------
// 8. COMMON-DETERMINISTIC PASS is verified
// ---------------------------------------------------------------------------

describe("COMMON-DETERMINISTIC verification", () => {
  it("two identical runs produce COMMON-DETERMINISTIC PASS", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);

    const browserCases: BrowserCaseResult[] = [
      {
        case_id: "BROWSER-CORE-RESET-001",
        passed: true,
        evidence: { initialHash: evidence.reset.initialHash },
      },
      {
        case_id: "BROWSER-CORE-STEP-001",
        passed: true,
        evidence: { initialHash: evidence.step.initialHash, perTickHashes: evidence.step.perTickHashes },
      },
    ];

    const result = evaluateFoundationLab(scenario, { browserCases });

    expect(result.commonDeterministicPass).toBe(true);

    const comp = result.subComponents.find(
      (s) => s.componentId === "COMMON-DETERMINISTIC",
    );
    expect(comp).toBeDefined();
    expect(comp!.outcome).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 10. INVALID_RUN takes priority over FAIL
// ---------------------------------------------------------------------------

describe("INVALID_RUN takes priority over FAIL", () => {
  it("FAIL component (passed:false with valid hashes) + INVALID_RUN component (skipMutationIds) → INVALID_RUN", () => {
    const scenario = loadFixture();
    const evidence = generateBrowserEvidence(scenario);

    // Browser case has valid evidence but passed:false → FAIL component.
    const browserCases: BrowserCaseResult[] = [
      {
        case_id: "BROWSER-CORE-RESET-001",
        passed: false,
        evidence: { initialHash: evidence.reset.initialHash },
      },
      {
        case_id: "BROWSER-CORE-STEP-001",
        passed: true,
        evidence: { initialHash: evidence.step.initialHash, perTickHashes: evidence.step.perTickHashes },
      },
    ];

    // skipMutationIds causes MUTANT_CORE → INVALID_RUN component.
    const result = evaluateFoundationLab(scenario, { browserCases, skipMutationIds: ["non-finite"] });

    // Both FAIL and INVALID_RUN components exist, but verdict must be INVALID_RUN.
    const failComponents = result.subComponents.filter(
      (s) => s.outcome === "FAIL",
    );
    const invalidRunComponents = result.subComponents.filter(
      (s) => s.outcome === "INVALID_RUN",
    );
    expect(failComponents.length).toBeGreaterThan(0);
    expect(invalidRunComponents.length).toBeGreaterThan(0);

    // INVALID_RUN has higher precedence than FAIL per spec §2.2.
    expect(result.milestoneVerdict).toBe("INVALID_RUN");
    expect(result.milestoneVerdict).not.toBe("FAIL");
  });
});

// ---------------------------------------------------------------------------
// 9. Result structure
// ---------------------------------------------------------------------------

describe("Result structure", () => {
  it("has all required fields", () => {
    const scenario = loadFixture();
    const result = evaluateFoundationLab(scenario);

    expect(result).toHaveProperty("registrySetId");
    expect(result).toHaveProperty("profileVersion");
    expect(result).toHaveProperty("subComponents");
    expect(result).toHaveProperty("allHardInvariantPass");
    expect(result).toHaveProperty("commonDeterministicPass");
    expect(result).toHaveProperty("mutantCorePass");
    expect(result).toHaveProperty("browserCases");
    expect(result).toHaveProperty("milestoneVerdict");
    expect(result).toHaveProperty("details");
  });

  it("subComponents are SubComponentResult objects", () => {
    const scenario = loadFixture();
    const result = evaluateFoundationLab(scenario);

    for (const sub of result.subComponents) {
      expect(sub).toHaveProperty("componentId");
      expect(sub).toHaveProperty("outcome");
      expect(sub).toHaveProperty("evidence");
      expect(typeof sub.componentId).toBe("string");
      expect(sub.outcome).toMatch(/^(PASS|FAIL|INVALID_RUN|NOT_EVALUATED)$/);
      expect(Array.isArray(sub.evidence)).toBe(true);
    }
  });

  it("milestoneVerdict is one of the three valid values", () => {
    const scenario = loadFixture();

    // Without browser cases: INVALID_RUN
    const noBrowser = evaluateFoundationLab(scenario);
    expect(["PASS", "FAIL", "INVALID_RUN"]).toContain(noBrowser.milestoneVerdict);

    // With dummy browser cases: INVALID_RUN (bad evidence)
    const dummy = evaluateFoundationLab(scenario, {
      browserCases: [
        {
          case_id: "BROWSER-CORE-RESET-001",
          passed: true,
          evidence: { initialHash: "dummy" },
        },
        {
          case_id: "BROWSER-CORE-STEP-001",
          passed: true,
          evidence: { initialHash: "dummy2" },
        },
      ],
    });
    expect(["PASS", "FAIL", "INVALID_RUN"]).toContain(dummy.milestoneVerdict);
  });

  it("details is a non-empty string", () => {
    const scenario = loadFixture();
    const result = evaluateFoundationLab(scenario);
    expect(typeof result.details).toBe("string");
    expect(result.details.length).toBeGreaterThan(0);
  });

  it("browserCases in result matches input or is empty array", () => {
    const scenario = loadFixture();

    // No browser cases provided.
    const result1 = evaluateFoundationLab(scenario);
    expect(result1.browserCases).toEqual([]);

    // Browser cases provided.
    const evidence = generateBrowserEvidence(scenario);
    const browserCases: BrowserCaseResult[] = [
      {
        case_id: "BROWSER-CORE-RESET-001",
        passed: true,
        evidence: { initialHash: evidence.reset.initialHash },
      },
      {
        case_id: "BROWSER-CORE-STEP-001",
        passed: true,
        evidence: { initialHash: evidence.step.initialHash, perTickHashes: evidence.step.perTickHashes },
      },
    ];

    const result2 = evaluateFoundationLab(scenario, { browserCases });
    expect(result2.browserCases).toEqual(browserCases);
  });
});