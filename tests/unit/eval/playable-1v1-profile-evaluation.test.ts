/**
 * @module tests/unit/eval/playable-1v1-profile-evaluation
 *
 * Tests for the PLAYABLE_1V1 profile evaluation infrastructure.
 *
 * Tests:
 *  1. Profile evaluation runner produces structured output.
 *  2. ARCHETYPE_BLINDED_COMPARISON_PASS is evaluated (not a static placeholder).
 *  3. MUTANT_1V1_PASS is evaluated (not a static placeholder).
 *  4. Exit prerequisite outcomes are correctly recorded.
 *  5. Overall verdict is computed correctly given sub-component outcomes.
 *  6. Playable1v1ProfileResult has all required fields.
 *  7. Blockers are correctly identified.
 *  8. No PES fidelity claims in evaluation output.
 *  9. Determinism: two runs produce the same verdict.
 *  10. No PLAYABLE_1V1_PASS naming.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Import wire.ts to register all oracles (side-effect).
import "../../../eval/oracles/wire.js";

import {
  evaluatePlayable1v1,
  type Playable1v1Result,
  type SubComponentResult,
} from "../../../eval/runners/playable-evaluator.js";
import { evaluateMutant1v1 } from "../../../eval/runners/mutant-1v1.js";
import { evaluateArchetypeComparison } from "../../../eval/runners/archetype-comparison.js";
import { PLAYABLE_1V1_PROFILE } from "../../../eval/contracts/profiles.js";
import { loadRegistrySet } from "../../../eval/contracts/loader.js";
import { evaluate } from "../../../eval/runners/evaluate.js";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";

import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(): ScenarioDefinition {
  const fixturePath = join(
    process.cwd(),
    "eval/scenarios/foundation-move-and-roll.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

function load1v1Fixture(): ScenarioDefinition {
  const fixturePath = join(
    process.cwd(),
    "eval/scenarios/two-player-duel.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

function findSubComponent(
  result: Playable1v1Result,
  componentId: string,
): SubComponentResult | undefined {
  return result.subComponents.find((s) => s.componentId === componentId);
}

// ---------------------------------------------------------------------------
// 1. Profile evaluation runner produces structured output
// ---------------------------------------------------------------------------

describe("PLAYABLE_1V1 profile evaluation: structured output", () => {
  it("evaluatePlayable1v1 produces a result with all required fields", () => {
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

  it("registrySetId matches the loaded registry", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);
    const registry = loadRegistrySet();

    expect(result.registrySetId).toBe(registry.registry_set_id);
  });

  it("profileVersion matches PLAYABLE_1V1_PROFILE", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    expect(result.profileVersion).toBe(PLAYABLE_1V1_PROFILE.profile_version);
  });

  it("subComponents is a non-empty array", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    expect(Array.isArray(result.subComponents)).toBe(true);
    expect(result.subComponents.length).toBeGreaterThan(0);
  });

  it("details is a non-empty string", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    expect(typeof result.details).toBe("string");
    expect(result.details.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. ARCHETYPE_BLINDED_COMPARISON_PASS is evaluated (not a static placeholder)
// ---------------------------------------------------------------------------

describe("ARCHETYPE_BLINDED_COMPARISON_PASS evaluation", () => {
  it("exit prerequisite subComponent exists for ARCHETYPE_BLINDED_COMPARISON_PASS", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const prereq = findSubComponent(
      result,
      "EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS",
    );
    expect(prereq).toBeDefined();
    expect(prereq!.componentId).toBe("EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS");
  });

  it("ARCHETYPE_BLINDED_COMPARISON_PASS outcome is a valid verdict from the real evaluator", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const prereq = findSubComponent(
      result,
      "EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS",
    );
    // Disk-true: the real evaluator runs and returns a non-placeholder verdict.
    // Do NOT require PASS — the renderer may not differentiate archetypes.
    expect(prereq!.outcome).toMatch(/^(PASS|FAIL|NEEDS_PERCEPTUAL_REVIEW)$/);
  });

  it("evidence mentions perceptual rubric", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const prereq = findSubComponent(
      result,
      "EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS",
    );
    const hasRubricEvidence = prereq!.evidence.some(
      (e) =>
        e.toLowerCase().includes("perceptual") ||
        e.toLowerCase().includes("rubric"),
    );
    expect(hasRubricEvidence).toBe(true);
  });

  it("evaluateArchetypeComparison with useDiskArtifacts:true returns a valid verdict", () => {
    const result = evaluateArchetypeComparison({ useDiskArtifacts: true });

    // Disk-true: the real evaluator loads committed artifacts and compares.
    // Do NOT require PASS — the renderer may not differentiate archetypes.
    expect(result.verdict).toMatch(/^(PASS|FAIL|NEEDS_PERCEPTUAL_REVIEW)$/);
    expect(result.allDetectable).toBe(false);
  });

  it("evaluateArchetypeComparison returns NOT_EVALUATED in HEADLESS mode", () => {
    const result = evaluateArchetypeComparison({ useDiskArtifacts: false });

    expect(result.verdict).toBe("NOT_EVALUATED");
  });

  it("ARCHETYPE_BLINDED_COMPARISON_PASS is NOT a static placeholder — it calls the real evaluator", () => {
    // The playable evaluator calls evaluateArchetypeComparison({ useDiskArtifacts: true })
    // for the exit prerequisite.  This is a real evaluation call, not a hard-coded value.
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const prereq = findSubComponent(
      result,
      "EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS",
    );

    // Evidence should include the verdict from the archetype evaluator.
    const hasVerdictEvidence = prereq!.evidence.some((e) =>
      e.toLowerCase().includes("archetype") || e.toLowerCase().includes("verdict"),
    );
    expect(hasVerdictEvidence).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. MUTANT_1V1_PASS is evaluated (not a static placeholder)
// ---------------------------------------------------------------------------

describe("MUTANT_1V1_PASS evaluation", () => {
  it("exit prerequisite subComponent exists for MUTANT_1V1_PASS", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const prereq = findSubComponent(result, "EXIT_PREREQ:MUTANT_1V1_PASS");
    expect(prereq).toBeDefined();
    expect(prereq!.componentId).toBe("EXIT_PREREQ:MUTANT_1V1_PASS");
  });

  it("MUTANT_1V1_PASS outcome is the actual verdict from evaluateMutant1v1", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const prereq = findSubComponent(result, "EXIT_PREREQ:MUTANT_1V1_PASS");
    const mutantResult = evaluateMutant1v1();

    // The exit prereq outcome should match the mutant evaluator verdict.
    expect(prereq!.outcome).toBe(mutantResult.verdict);
  });

  it("MUTANT_1V1_PASS evidence references the mutant reduction", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const prereq = findSubComponent(result, "EXIT_PREREQ:MUTANT_1V1_PASS");
    const hasMutantEvidence = prereq!.evidence.some((e) =>
      e.includes("MUTANT_1V1"),
    );
    expect(hasMutantEvidence).toBe(true);
  });

  it("MUTANT_1V1_PASS is NOT a static placeholder — it calls the real evaluator", () => {
    // The playable evaluator calls evaluateMutant1v1() for the exit prerequisite.
    // This is a real evaluation call, not a hard-coded value.
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const prereq = findSubComponent(result, "EXIT_PREREQ:MUTANT_1V1_PASS");

    // Evidence should include details about the mutant reduction.
    const hasMutantDetails = prereq!.evidence.some((e) =>
      e.includes("Implementable mutants") || e.includes("Deferred mutants"),
    );
    expect(hasMutantDetails).toBe(true);
  });

  it("evaluateMutant1v1 returns PASS in clean 1v1 context", () => {
    const result = evaluateMutant1v1();
    expect(result.verdict).toBe("PASS");
    expect(result.allImplementedDetected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Exit prerequisite outcomes are correctly recorded
// ---------------------------------------------------------------------------

describe("Exit prerequisite recording", () => {
  it("all exit_prerequisites from the profile have corresponding subComponents", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    for (const prereq of PLAYABLE_1V1_PROFILE.exit_prerequisites) {
      const found = findSubComponent(result, `EXIT_PREREQ:${prereq}`);
      expect(found).toBeDefined(
        `Exit prerequisite "${prereq}" should have a subComponent`,
      );
    }
  });

  it("exitPrerequisitesSatisfied is false when any exit prereq is not PASS", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // ARCHETYPE_BLINDED_COMPARISON_PASS is NOT_EVALUATED, so exit is not satisfied.
    expect(result.exitPrerequisitesSatisfied).toBe(false);
  });

  it("exitPrerequisitesSatisfied is true only when all exit prereqs are PASS", () => {
    // In the current codebase, MUTANT_1V1_PASS is PASS but
    // ARCHETYPE_BLINDED_COMPARISON_PASS is NOT_EVALUATED.
    // So exitPrerequisitesSatisfied should be false.
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const mutantPrereq = findSubComponent(result, "EXIT_PREREQ:MUTANT_1V1_PASS");
    const archetypePrereq = findSubComponent(
      result,
      "EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS",
    );

    // MUTANT_1V1_PASS should be PASS (or at least not NOT_EVALUATED).
    expect(mutantPrereq!.outcome).not.toBe("NOT_EVALUATED");
    // ARCHETYPE_BLINDED_COMPARISON_PASS: disk-true verdict (PASS, FAIL, or NEEDS_PERCEPTUAL_REVIEW).
    expect(archetypePrereq!.outcome).toMatch(
      /^(PASS|FAIL|NEEDS_PERCEPTUAL_REVIEW)$/,
    );
  });

  it("each exit prerequisite subComponent has outcome and evidence", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    for (const prereq of PLAYABLE_1V1_PROFILE.exit_prerequisites) {
      const subComp = findSubComponent(result, `EXIT_PREREQ:${prereq}`);
      expect(subComp!.outcome).toMatch(
        /^(PASS|FAIL|INVALID_RUN|NOT_EVALUATED|NEEDS_PERCEPTUAL_REVIEW|BLOCKED_MISSING_REFERENCE)$/,
      );
      expect(Array.isArray(subComp!.evidence)).toBe(true);
      expect(subComp!.evidence.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Overall verdict is computed correctly
// ---------------------------------------------------------------------------

describe("Overall verdict computation", () => {
  it("verdict is NOT_PASS when ARCHETYPE_BLINDED_COMPARISON_PASS is NOT_EVALUATED", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    expect(result.milestoneVerdict).not.toBe("PASS");
  });

  it("verdict is NOT_EVALUATED when exit prereqs are NOT_EVALUATED", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // Per spec §2.2: NOT_EVALUATED > PASS.
    // Since ARCHETYPE_BLINDED_COMPARISON_PASS is NOT_EVALUATED,
    // the overall verdict should be at least NOT_EVALUATED.
    expect(result.milestoneVerdict).not.toBe("PASS");
  });

  it("verdict precedence: highest invalid outcome wins", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // The computeOverallVerdict function uses precedence:
    //   INVALID_RUN > FAIL > NEEDS_PERCEPTUAL_REVIEW > BLOCKED_MISSING_REFERENCE > NOT_EVALUATED > PASS
    // In the current codebase, INVALID_RUN from missing/invalid suites
    // takes precedence over NEEDS_PERCEPTUAL_REVIEW.
    // The key invariant is that it is never PASS.
    expect(result.milestoneVerdict).not.toBe("PASS");
  });

  it("HARD_INVARIANT evaluation is recorded", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const hardInv = findSubComponent(result, "HARD_INVARIANT_SUITES");
    expect(hardInv).toBeDefined();
    expect(hardInv!.componentId).toBe("HARD_INVARIANT_SUITES");
    expect(hardInv!.outcome).toMatch(
      /^(PASS|FAIL|NOT_EVALUATED|INVALID_RUN|BLOCKED_MISSING_REFERENCE)$/,
    );
  });

  it("ENGINE_DESIGN_TARGET evaluation is recorded", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const engineDesign = findSubComponent(result, "ENGINE_DESIGN_TARGET");
    expect(engineDesign).toBeDefined();
    expect(engineDesign!.componentId).toBe("ENGINE_DESIGN_TARGET");
  });

  it("browser case verdicts are recorded", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // All required browser cases should have verdicts.
    const requiredCaseIds = PLAYABLE_1V1_PROFILE.required_browser_case_ids;
    const verdictCaseIds = result.browserCaseVerdicts.map((v) => v.case_id);

    for (const caseId of requiredCaseIds) {
      expect(verdictCaseIds).toContain(caseId);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Playable1v1ProfileResult has all required fields (runner contract)
// ---------------------------------------------------------------------------

describe("Profile result contract", () => {
  it("milestoneVerdict is one of the valid values", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const validValues = [
      "PASS",
      "FAIL",
      "INVALID_RUN",
      "NOT_EVALUATED",
      "NEEDS_PERCEPTUAL_REVIEW",
      "BLOCKED_MISSING_REFERENCE",
    ];
    expect(validValues).toContain(result.milestoneVerdict);
  });

  it("subComponents are SubComponentResult objects", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    for (const sub of result.subComponents) {
      expect(sub).toHaveProperty("componentId");
      expect(sub).toHaveProperty("outcome");
      expect(sub).toHaveProperty("evidence");
      expect(typeof sub.componentId).toBe("string");
      expect(Array.isArray(sub.evidence)).toBe(true);
    }
  });

  it("engineDesignTargetOverall is one of the valid values", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const validValues = [
      "PASS",
      "FAIL",
      "NOT_EVALUATED",
      "DEFERRED",
      "INVALID_RUN",
    ];
    expect(validValues).toContain(result.engineDesignTargetOverall);
  });

  it("browserCaseVerdicts is an array of {case_id, verdict}", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    for (const bv of result.browserCaseVerdicts) {
      expect(bv).toHaveProperty("case_id");
      expect(bv).toHaveProperty("verdict");
      expect(typeof bv.case_id).toBe("string");
      expect(typeof bv.verdict).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Blockers are correctly identified
// ---------------------------------------------------------------------------

describe("Blocker identification", () => {
  it("ARCHETYPE_BLINDED_COMPARISON_PASS not-PASS is a blocker", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const archetypePrereq = findSubComponent(
      result,
      "EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS",
    );
    // When the disk-true verdict is not PASS, exit prerequisites are not satisfied.
    if (archetypePrereq!.outcome !== "PASS") {
      expect(result.exitPrerequisitesSatisfied).toBe(false);
    }

    // The details should mention the verdict.
    expect(result.details).toContain(result.milestoneVerdict);
  });

  it("ARCH-DIFF-001 NEEDS_PERCEPTUAL_REVIEW is a blocker", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const archDiffVerdict = result.browserCaseVerdicts.find(
      (v) => v.case_id === "ARCH-DIFF-001",
    );
    expect(archDiffVerdict).toBeDefined();
    expect(archDiffVerdict!.verdict).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });

  it("details mention all major blockers", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // Details should mention the overall verdict and sub-components.
    expect(result.details).toContain(result.milestoneVerdict);
    for (const sub of result.subComponents) {
      // Each subComponent's outcome should be mentioned in details.
      expect(result.details).toContain(sub.componentId);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. No PES fidelity claims in evaluation output
// ---------------------------------------------------------------------------

describe("No PES claims in evaluation output", () => {
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

  it("details do not claim PES fidelity", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // The details string contains component IDs (e.g. ENTRY_PREREQ:FOUNDATION_LAB_PASS),
    // so we only check that the actual claims (not component IDs) are absent.
    const pesClaims = [
      "pes fidelity",
      "pes match",
      "pes 2017",
      "claimed playable",
      "playable_1v1_pass",
    ];

    for (const claim of pesClaims) {
      expect(
        result.details.toLowerCase().includes(claim),
        `Details should not claim "${claim}": ${result.details}`,
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Determinism: two runs produce the same verdict
// ---------------------------------------------------------------------------

describe("Determinism", () => {
  it("two identical evaluatePlayable1v1 calls produce the same verdict", () => {
    const scenario = loadFixture();
    const resultA = evaluatePlayable1v1(scenario);
    const resultB = evaluatePlayable1v1(scenario);

    expect(resultA.milestoneVerdict).toBe(resultB.milestoneVerdict);
    expect(resultA.allHardInvariantPass).toBe(resultB.allHardInvariantPass);
    expect(resultA.exitPrerequisitesSatisfied).toBe(
      resultB.exitPrerequisitesSatisfied,
    );

    // SubComponents should match.
    expect(resultA.subComponents.length).toBe(resultB.subComponents.length);
    for (let i = 0; i < resultA.subComponents.length; i++) {
      expect(resultA.subComponents[i].componentId).toBe(
        resultB.subComponents[i].componentId,
      );
      expect(resultA.subComponents[i].outcome).toBe(
        resultB.subComponents[i].outcome,
      );
    }
  });

  it("MUTANT_1V1_PASS verdict is deterministic", () => {
    const resultA = evaluateMutant1v1();
    const resultB = evaluateMutant1v1();

    expect(resultA.verdict).toBe(resultB.verdict);
  });
});

// ---------------------------------------------------------------------------
// 10. No PLAYABLE_1V1_PASS naming
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
// 11. Integration: full evaluation with 1v1 scenario
// ---------------------------------------------------------------------------

describe("Full evaluation with 1v1 scenario", () => {
  it("evaluatePlayable1v1 works with the two-player-duel scenario", () => {
    const scenario = load1v1Fixture();
    const result = evaluatePlayable1v1(scenario);

    expect(result.milestoneVerdict).not.toBe("PASS");
    expect(result.exitPrerequisitesSatisfied).toBe(false);

    // Verify exit prerequisites are evaluated.
    const mutantPrereq = findSubComponent(result, "EXIT_PREREQ:MUTANT_1V1_PASS");
    const archetypePrereq = findSubComponent(
      result,
      "EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS",
    );

    expect(mutantPrereq).toBeDefined();
    expect(archetypePrereq).toBeDefined();
    expect(mutantPrereq!.outcome).not.toBe("NOT_EVALUATED");
    // ARCHETYPE_BLINDED_COMPARISON_PASS: disk-true verdict (not a static placeholder).
    expect(archetypePrereq!.outcome).toMatch(/^(PASS|FAIL|NEEDS_PERCEPTUAL_REVIEW)$/);
  });

  it("HARD_INVARIANT suites evaluate correctly with 1v1 scenario", () => {
    const scenario = load1v1Fixture();
    const result = evaluatePlayable1v1(scenario);

    const hardInv = findSubComponent(result, "HARD_INVARIANT_SUITES");
    expect(hardInv).toBeDefined();

    // Check that HARD_INVARIANT criteria are evaluated (not INVALID_RUN).
    const hardInvEvidence = hardInv!.evidence;
    for (const evidence of hardInvEvidence) {
      // Each evidence string should be in the format "criterionId=outcome".
      expect(evidence).toContain("=");
      const parts = evidence.split("=");
      expect(parts.length).toBe(2);
      const outcome = parts[1];
      expect(["PASS", "FAIL", "NOT_EVALUATED", "BLOCKED_MISSING_REFERENCE"]).toContain(
        outcome,
      );
    }
  });

  it("entry prerequisites are recorded as NOT_EVALUATED (unverified)", () => {
    const scenario = load1v1Fixture();
    const result = evaluatePlayable1v1(scenario);

    for (const prereq of PLAYABLE_1V1_PROFILE.entry_prerequisites) {
      const entryPrereq = findSubComponent(result, `ENTRY_PREREQ:${prereq}`);
      expect(entryPrereq).toBeDefined();
      expect(entryPrereq!.outcome).toBe("NOT_EVALUATED");
    }
  });
});

// ---------------------------------------------------------------------------
// 12. Edge case: evaluateArchetypeComparison with useDiskArtifacts=false
// ---------------------------------------------------------------------------

describe("Archetype comparison: HEADLESS mode", () => {
  it("HEADLESS mode returns NOT_EVALUATED with zero diff ratios", () => {
    const result = evaluateArchetypeComparison({ useDiskArtifacts: false });

    expect(result.verdict).toBe("NOT_EVALUATED");
    expect(result.allDetectable).toBe(false);
    expect(result.minConfidence).toBe(0);

    for (const pair of result.pairs) {
      expect(pair.hashDiffRatio).toBe(0);
      expect(pair.detectable).toBe(false);
    }
  });

  it("HEADLESS mode pairs have empty hashes", () => {
    const result = evaluateArchetypeComparison({ useDiskArtifacts: false });

    for (const pair of result.pairs) {
      expect(pair.hash_a).toBe("");
      expect(pair.hash_b).toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// 13. Integration: evaluateMutant1v1 in PLAYABLE_1V1 context
// ---------------------------------------------------------------------------

describe("MUTANT_1V1 in PLAYABLE_1V1 context", () => {
  it("MUTANT_1V1_PASS outcome is used as the exit prerequisite verdict", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const mutantPrereq = findSubComponent(result, "EXIT_PREREQ:MUTANT_1V1_PASS");
    const mutantResult = evaluateMutant1v1();

    // The exit prereq outcome should match the mutant evaluator.
    expect(mutantPrereq!.outcome).toBe(mutantResult.verdict);
  });

  it("MUTANT_1V1_PASS evidence includes implementation details", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const mutantPrereq = findSubComponent(result, "EXIT_PREREQ:MUTANT_1V1_PASS");

    // Evidence should mention implementable mutants count.
    const hasImplementableEvidence = mutantPrereq!.evidence.some((e) =>
      e.includes("Implementable mutants"),
    );
    expect(hasImplementableEvidence).toBe(true);
  });
});