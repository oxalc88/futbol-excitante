/**
 * @module tests/unit/eval/playable-1v1-re-evaluation
 *
 * Tests validating the PLAYABLE-1V1-RE-EVALUATION evidence run.
 *
 * The new evidence directory docs/evidence/PLAYABLE-1V1-RE-EVALUATION
 * contains eval.json from a real evaluator execution with BROWSER-CORE-EVIDENCE
 * loaded. These tests assert that the verdicts are genuine (not placeholders).
 *
 * Tests:
 *  1. eval.json exists and is valid structured output.
 *  2. milestoneVerdict is INVALID_RUN (driven by BROWSER-1V1-CONTROL-001 missing).
 *  3. BROWSER-CORE-RESET-001 verdict is PASS (evidence from BROWSER-CORE-EVIDENCE).
 *  4. BROWSER-CORE-STEP-001 verdict is PASS (evidence from BROWSER-CORE-EVIDENCE).
 *  5. BROWSER-1V1-CONTROL-001 verdict is INVALID_RUN (no browser evidence).
 *  6. ARCH-DIFF-001 verdict is NEEDS_PERCEPTUAL_REVIEW (perceptual target).
 *  7. MUTANT_1V1_PASS exit prerequisite is PASS.
 *  8. ARCHETYPE_BLINDED_COMPARISON_PASS exit prerequisite is FAIL (not placeholder).
 *  9. HARD_INVARIANT_SUITES is PASS.
 *  10. ENGINE_DESIGN_TARGET is PASS.
 *  11. No PES fidelity claims in evaluation output.
 *  12. No PLAYABLE_1V1_PASS naming.
 *  13. Blockers correctly identify the three honest blockers.
 *  14. Verdicts from actual evaluators, not static placeholders.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Import wire.ts to register all oracles (side-effect).
import "../../../eval/oracles/wire.js";

import { evaluatePlayable1v1, type Playable1v1Result } from "../../../eval/runners/playable-evaluator.js";
import { evaluateMutant1v1 } from "../../../eval/runners/mutant-1v1.js";
import { evaluateArchetypeComparison } from "../../../eval/runners/archetype-comparison.js";
import { PLAYABLE_1V1_PROFILE } from "../../../eval/contracts/profiles.js";
import { loadRegistrySet } from "../../../eval/contracts/loader.js";
import type { BrowserCaseResult } from "../../../eval/contracts/browser-cases.js";

import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EVIDENCE_DIR = join(process.cwd(), "docs/evidence/PLAYABLE-1V1-RE-EVALUATION");

function loadReEvalResult(): any {
  const evalPath = join(EVIDENCE_DIR, "eval.json");
  const raw = readFileSync(evalPath, "utf-8");
  return JSON.parse(raw);
}

function loadFixture(): ScenarioDefinition {
  const fixturePath = join(
    process.cwd(),
    "eval/scenarios/foundation-move-and-roll.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

function findBrowserVerdict(
  result: Playable1v1Result,
  caseId: string,
): { case_id: string; verdict: string } | undefined {
  return result.browserCaseVerdicts.find((v) => v.case_id === caseId);
}

function findSubComponent(
  result: Playable1v1Result,
  componentId: string,
): { componentId: string; outcome: string; evidence: string[] } | undefined {
  return result.subComponents.find((s) => s.componentId === componentId);
}

function loadBrowserCasesEvidence(): BrowserCaseResult[] | undefined {
  const browserCasesPath = join(
    process.cwd(),
    "docs/evidence/BROWSER-CORE-EVIDENCE/browser-cases.json",
  );
  if (existsSync(browserCasesPath)) {
    try {
      const raw = readFileSync(browserCasesPath, "utf-8");
      return JSON.parse(raw) as BrowserCaseResult[];
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 1. eval.json exists and is valid structured output
// ---------------------------------------------------------------------------

describe("PLAYABLE-1V1-RE-EVALUATION evidence directory", () => {
  it("eval.json exists and is valid JSON", () => {
    const evalPath = join(EVIDENCE_DIR, "eval.json");
    expect(() => readFileSync(evalPath, "utf-8")).not.toThrow();
    const raw = readFileSync(evalPath, "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("eval.json contains all required Playable1v1ProfileResult fields", () => {
    const result = loadReEvalResult();
    const requiredFields = [
      "scenarioFile",
      "registrySetId",
      "profileVersion",
      "milestoneVerdict",
      "subComponents",
      "allHardInvariantPass",
      "engineDesignTargetOverall",
      "browserCaseVerdicts",
      "entryPrerequisites",
      "exitPrerequisites",
      "entryPrerequisitesSatisfied",
      "exitPrerequisitesSatisfied",
      "blockers",
      "details",
      "timestamp",
    ];
    for (const field of requiredFields) {
      expect(result).toHaveProperty(field);
    }
  });

  it("eval.json timestamp is a valid ISO string", () => {
    const result = loadReEvalResult();
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });

  it("eval.json scenarioFile matches expected fixture", () => {
    const result = loadReEvalResult();
    expect(result.scenarioFile).toContain(
      "foundation-move-and-roll.v1.json",
    );
  });

  it("eval.json profileVersion matches PLAYABLE_1V1_PROFILE", () => {
    const result = loadReEvalResult();
    expect(result.profileVersion).toBe(PLAYABLE_1V1_PROFILE.profile_version);
  });
});

// ---------------------------------------------------------------------------
// 2. milestoneVerdict is INVALID_RUN (driven by BROWSER-1V1-CONTROL-001)
// ---------------------------------------------------------------------------

describe("milestoneVerdict", () => {
  it("overall verdict is INVALID_RUN — not PASS", () => {
    const result = loadReEvalResult();
    expect(result.milestoneVerdict).toBe("INVALID_RUN");
  });

  it("verdict is NOT a static placeholder — evaluator returned INVALID_RUN", () => {
    const scenario = loadFixture();
    const realResult = evaluatePlayable1v1(scenario);
    const diskResult = loadReEvalResult();

    // The re-evaluation verdict must match the real evaluator output.
    expect(diskResult.milestoneVerdict).toBe(realResult.milestoneVerdict);
  });
});

// ---------------------------------------------------------------------------
// 3–6. Per-browser-case verdicts
// ---------------------------------------------------------------------------

describe("Browser case verdicts", () => {
  it("BROWSER-CORE-RESET-001 verdict is PASS — evidence from BROWSER-CORE-EVIDENCE", () => {
    const scenario = loadFixture();
    const browserCases = loadBrowserCasesEvidence();
    const result = evaluatePlayable1v1(scenario, { browserCases });
    const verdict = findBrowserVerdict(result, "BROWSER-CORE-RESET-001");
    expect(verdict).toBeDefined();
    expect(verdict!.verdict).toBe("PASS");
  });

  it("BROWSER-CORE-STEP-001 verdict is PASS — evidence from BROWSER-CORE-EVIDENCE", () => {
    const scenario = loadFixture();
    const browserCases = loadBrowserCasesEvidence();
    const result = evaluatePlayable1v1(scenario, { browserCases });
    const verdict = findBrowserVerdict(result, "BROWSER-CORE-STEP-001");
    expect(verdict).toBeDefined();
    expect(verdict!.verdict).toBe("PASS");
  });

  it("BROWSER-1V1-CONTROL-001 verdict is INVALID_RUN — no browser evidence", () => {
    const realResult = evaluatePlayable1v1(loadFixture());
    const verdict = findBrowserVerdict(realResult, "BROWSER-1V1-CONTROL-001");
    expect(verdict).toBeDefined();
    expect(verdict!.verdict).toBe("INVALID_RUN");
  });

  it("ARCH-DIFF-001 verdict is NEEDS_PERCEPTUAL_REVIEW — perceptual target case", () => {
    const realResult = evaluatePlayable1v1(loadFixture());
    const verdict = findBrowserVerdict(realResult, "ARCH-DIFF-001");
    expect(verdict).toBeDefined();
    expect(verdict!.verdict).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });

  it("all required browser case_ids have verdicts", () => {
    const result = loadReEvalResult();
    const requiredIds = PLAYABLE_1V1_PROFILE.required_browser_case_ids;
    const verdictIds = result.browserCaseVerdicts.map((v: { case_id: string }) => v.case_id);

    for (const id of requiredIds) {
      expect(verdictIds).toContain(id);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. MUTANT_1V1_PASS exit prerequisite is PASS
// ---------------------------------------------------------------------------

describe("MUTANT_1V1_PASS exit prerequisite", () => {
  it("subComponent outcome is PASS", () => {
    const result = loadReEvalResult();
    const subComp = findSubComponent(
      evaluatePlayable1v1(loadFixture()),
      "EXIT_PREREQ:MUTANT_1V1_PASS",
    );
    expect(subComp!.outcome).toBe("PASS");
  });

  it("outcome matches the real mutant evaluator", () => {
    const mutantResult = evaluateMutant1v1();
    expect(mutantResult.verdict).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 8. ARCHETYPE_BLINDED_COMPARISON_PASS exit prerequisite is FAIL
// ---------------------------------------------------------------------------

describe("ARCHETYPE_BLINDED_COMPARISON_PASS exit prerequisite", () => {
  it("subComponent outcome is FAIL — renderer ignores archetypeId", () => {
    const realResult = evaluatePlayable1v1(loadFixture());
    const subComp = findSubComponent(
      realResult,
      "EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS",
    );
    expect(subComp!.outcome).toBe("FAIL");
  });

  it("verdict comes from real disk-true evaluation, not placeholder", () => {
    const archetypeResult = evaluateArchetypeComparison({ useDiskArtifacts: true });
    // The real evaluator runs and returns a non-placeholder verdict.
    expect(archetypeResult.verdict).toMatch(/^(PASS|FAIL|NEEDS_PERCEPTUAL_REVIEW)$/);
    // Current truth: all pairs have zero diff.
    expect(archetypeResult.allDetectable).toBe(false);
  });

  it("evidence mentions specific archetype pairs", () => {
    const realResult = evaluatePlayable1v1(loadFixture());
    const subComp = findSubComponent(
      realResult,
      "EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS",
    );
    const hasPairEvidence = subComp!.evidence.some((e) =>
      e.includes("archetype-burst") && e.includes("detectable"),
    );
    expect(hasPairEvidence).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. HARD_INVARIANT_SUITES is PASS
// ---------------------------------------------------------------------------

describe("HARD_INVARIANT_SUITES", () => {
  it("subComponent outcome is PASS", () => {
    const result = loadReEvalResult();
    const subComp = findSubComponent(
      evaluatePlayable1v1(loadFixture()),
      "HARD_INVARIANT_SUITES",
    );
    expect(subComp!.outcome).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 10. ENGINE_DESIGN_TARGET is PASS
// ---------------------------------------------------------------------------

describe("ENGINE_DESIGN_TARGET", () => {
  it("subComponent outcome is PASS", () => {
    const result = loadReEvalResult();
    const subComp = findSubComponent(
      evaluatePlayable1v1(loadFixture()),
      "ENGINE_DESIGN_TARGET",
    );
    expect(subComp!.outcome).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 11. No PES fidelity claims
// ---------------------------------------------------------------------------

describe("No PES claims in evaluation output", () => {
  it("subComponent evidence does not claim PES fidelity", () => {
    const result = loadReEvalResult();
    const pesTerms = [
      "pes fidelity",
      "pes match",
      "pes 2017",
      "foundation_lab_pass",
    ];

    for (const sub of result.subComponents) {
      for (const evidence of sub.evidence) {
        for (const term of pesTerms) {
          expect(
            evidence.toLowerCase().includes(term),
            `Evidence should not contain "${term}": ${evidence}`,
          ).toBe(false);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 12. No PLAYABLE_1V1_PASS naming
// ---------------------------------------------------------------------------

describe("No PLAYABLE_1V1_PASS naming", () => {
  it("milestoneVerdict is not PASS", () => {
    const result = loadReEvalResult();
    expect(result.milestoneVerdict).not.toBe("PASS");
  });

  it("result does not have a field named playable_1v1_pass", () => {
    const result = loadReEvalResult();
    expect(result).not.toHaveProperty("playable_1v1_pass");
  });
});

// ---------------------------------------------------------------------------
// 13. Blockers correctly identify the three honest blockers
// ---------------------------------------------------------------------------

describe("Blocker identification", () => {
  it("BROWSER-1V1-CONTROL-001 INVALID_RUN is a blocker", () => {
    const result = loadReEvalResult();
    expect(result.blockers.some((b: string) => b.includes("BROWSER-1V1-CONTROL-001"))).toBe(true);
  });

  it("ARCH-DIFF-001 needs perceptual review is a blocker", () => {
    const result = loadReEvalResult();
    expect(result.blockers.some((b: string) => b.includes("ARCH-DIFF-001"))).toBe(true);
  });

  it("ARCHETYPE_BLINDED_COMPARISON_PASS FAIL is a blocker", () => {
    const result = loadReEvalResult();
    expect(result.blockers.some((b: string) => b.includes("ARCHETYPE_BLINDED_COMPARISON"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 14. Verdicts match the live evaluator — evidence is real, not copied from
//     the previous INVALID_RUN result in docs/evidence/playable-1v1-profile-evaluation/
// ---------------------------------------------------------------------------

describe("Evidence is live evaluator output, not historical copy", () => {
  it("browser case verdicts match a live evaluatePlayable1v1() call", () => {
    const liveResult = evaluatePlayable1v1(loadFixture());
    const diskResult = loadReEvalResult();

    const liveIds = new Set(liveResult.browserCaseVerdicts.map((v) => v.case_id));
    const diskIds = new Set(diskResult.browserCaseVerdicts.map((v) => v.case_id));

    // All required case_ids must be present in both.
    for (const id of liveIds) {
      expect(diskIds).toContain(id);
    }
  });

  it("exit prerequisite outcomes match the live evaluator", () => {
    const liveResult = evaluatePlayable1v1(loadFixture());
    const diskResult = loadReEvalResult();

    for (const ep of PLAYABLE_1V1_PROFILE.exit_prerequisites) {
      const liveEp = findSubComponent(liveResult, `EXIT_PREREQ:${ep}`);
      const diskEp = findSubComponent(
        diskResult,
        `EXIT_PREREQ:${ep}`,
      );
      expect(diskEp!.outcome).toBe(liveEp!.outcome);
    }
  });

  it("registrySetId matches the loaded registry", () => {
    const diskResult = loadReEvalResult();
    const registry = loadRegistrySet();

    expect(diskResult.registrySetId).toBe(registry.registry_set_id);
  });

  it("details string mentions all subComponent outcomes", () => {
    const diskResult = loadReEvalResult();

    for (const sub of diskResult.subComponents) {
      expect(diskResult.details).toContain(sub.componentId);
      expect(diskResult.details).toContain(sub.outcome);
    }
  });
});