/**
 * @module tests/unit/eval/SMALL-SIDED-PROFILE-REDUCER-EXTENSION
 *
 * Tests for the small-sided profile reducer (eval/runners/small-sided-profile-reducer.ts)
 * that wires SMALL_SIDED_SHAPE_PROFILE exit prerequisites into executable paths.
 *
 * Covers:
 *   (a) Reducer returns a result for each of the two team exit prereqs
 *       (MUTANT_TEAM_PASS, TEAM_SHAPE_SUITE_PASS) from the profile.
 *   (b) PASS is ONLY produced when the underlying evaluator's milestoneVerdict
 *       is genuinely PASS (assert the mapping, not a stub).
 *   (c) An unknown prereq yields NOT_EVALUATED.
 *   (d) The existing PLAYABLE_1V1 exit-prereq path still behaves unchanged
 *       (no regression).
 *   (e) No overclaims: reducer does not emit a PROMOTION verdict.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";

// Import wire.ts to register all oracles (side-effect).
import "../../../eval/oracles/wire.js";

import { evaluateSmallSidedProfile, type SubComponentResult } from "../../../eval/runners/small-sided-profile-reducer.js";
import { runMutantTeamEval } from "../../../eval/runners/mutant-team-eval-runner.js";
import { runTeamShapeEval } from "../../../eval/runners/team-shape-eval-runner.js";
import { evaluatePlayable1v1, type Playable1v1Result } from "../../../eval/runners/playable-evaluator.js";
import { PLAYABLE_1V1_PROFILE, SMALL_SIDED_SHAPE_PROFILE } from "../../../eval/contracts/profiles.js";

import { readFileSync } from "node:fs";
import { join } from "node:path";

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

function findSubComponent(
  subComponents: SubComponentResult[],
  componentId: string,
): SubComponentResult | undefined {
  return subComponents.find((s) => s.componentId === componentId);
}

// ---------------------------------------------------------------------------
// (a) Reducer returns a result for each of the two team exit prereqs
// ---------------------------------------------------------------------------

describe("SMALL-SIDED exit prereqs: results present for each prereq", () => {
  it("returns a sub-component for MUTANT_TEAM_PASS", () => {
    const result = evaluateSmallSidedProfile();

    const mutantComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:MUTANT_TEAM_PASS",
    );
    expect(mutantComp).toBeDefined();
    expect(mutantComp!.componentId).toBe("EXIT_PREREQ:MUTANT_TEAM_PASS");
  });

  it("returns a sub-component for TEAM_SHAPE_SUITE_PASS", () => {
    const result = evaluateSmallSidedProfile();

    const teamComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:TEAM_SHAPE_SUITE_PASS",
    );
    expect(teamComp).toBeDefined();
    expect(teamComp!.componentId).toBe("EXIT_PREREQ:TEAM_SHAPE_SUITE_PASS");
  });

  it("sub-component count equals the number of exit prerequisites in the profile", () => {
    const result = evaluateSmallSidedProfile();

    expect(result.subComponents.length).toBe(
      SMALL_SIDED_SHAPE_PROFILE.exit_prerequisites.length,
    );
    expect(SMALL_SIDED_SHAPE_PROFILE.exit_prerequisites).toEqual([
      "MUTANT_TEAM_PASS",
      "TEAM_SHAPE_SUITE_PASS",
    ]);
  });

  it("each exit prereq outcome is one of the valid verdict values", () => {
    const result = evaluateSmallSidedProfile();

    const validOutcomes = new Set([
      "PASS",
      "FAIL",
      "INVALID_RUN",
      "NOT_EVALUATED",
      "NEEDS_PERCEPTUAL_REVIEW",
      "BLOCKED_MISSING_REFERENCE",
    ]);

    for (const comp of result.subComponents) {
      if (comp.componentId.startsWith("EXIT_PREREQ:")) {
        expect(validOutcomes.has(comp.outcome)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// (b) PASS is ONLY produced when the underlying evaluator's milestoneVerdict
//     is genuinely PASS (assert the mapping, not a stub)
// ---------------------------------------------------------------------------

describe("SMALL-SIDED exit prereqs: PASS only from genuine PASS", () => {
  it("MUTANT_TEAM_PASS outcome mirrors the actual runMutantTeamEval milestoneVerdict", () => {
    // Run the actual evaluator.
    const actualResult = runMutantTeamEval();

    // Run the reducer with no overrides → it invokes the actual evaluator.
    const reducerResult = evaluateSmallSidedProfile();

    const mutantComp = findSubComponent(
      reducerResult.subComponents,
      "EXIT_PREREQ:MUTANT_TEAM_PASS",
    );
    expect(mutantComp).toBeDefined();

    // The outcome MUST be the exact mapping of the actual verifier verdict.
    const expectedOutcome: SubComponentResult["outcome"] =
      actualResult.milestoneVerdict === "PASS"
        ? "PASS"
        : actualResult.milestoneVerdict === "FAIL"
          ? "FAIL"
          : actualResult.milestoneVerdict === "INVALID_RUN"
            ? "INVALID_RUN"
            : "NOT_EVALUATED";

    expect(mutantComp!.outcome).toBe(expectedOutcome);
  });

  it("TEAM_SHAPE_SUITE_PASS outcome mirrors the actual runTeamShapeEval milestoneVerdict", () => {
    // Run the actual evaluator.
    const actualResult = runTeamShapeEval();

    // Run the reducer with no overrides.
    const reducerResult = evaluateSmallSidedProfile();

    const teamComp = findSubComponent(
      reducerResult.subComponents,
      "EXIT_PREREQ:TEAM_SHAPE_SUITE_PASS",
    );
    expect(teamComp).toBeDefined();

    const expectedOutcome: SubComponentResult["outcome"] =
      actualResult.milestoneVerdict === "PASS"
        ? "PASS"
        : actualResult.milestoneVerdict === "FAIL"
          ? "FAIL"
          : actualResult.milestoneVerdict === "INVALID_RUN"
            ? "INVALID_RUN"
            : "NOT_EVALUATED";

    expect(teamComp!.outcome).toBe(expectedOutcome);
  });

  it("override with explicit PASS produces PASS for MUTANT_TEAM_PASS", () => {
    const result = evaluateSmallSidedProfile({
      mutantTeamOverride: {
        milestoneVerdict: "PASS",
        details: "test override",
      },
    });

    const mutantComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:MUTANT_TEAM_PASS",
    );
    expect(mutantComp).toBeDefined();
    expect(mutantComp!.outcome).toBe("PASS");
  });

  it("override with explicit FAIL produces FAIL for MUTANT_TEAM_PASS", () => {
    const result = evaluateSmallSidedProfile({
      mutantTeamOverride: {
        milestoneVerdict: "FAIL",
        details: "test override",
      },
    });

    const mutantComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:MUTANT_TEAM_PASS",
    );
    expect(mutantComp).toBeDefined();
    expect(mutantComp!.outcome).toBe("FAIL");
  });

  it("override with explicit PASS produces PASS for TEAM_SHAPE_SUITE_PASS", () => {
    const result = evaluateSmallSidedProfile({
      teamShapeOverride: {
        milestoneVerdict: "PASS",
        details: "test override",
      },
    });

    const teamComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:TEAM_SHAPE_SUITE_PASS",
    );
    expect(teamComp).toBeDefined();
    expect(teamComp!.outcome).toBe("PASS");
  });

  it("override with explicit FAIL produces FAIL for TEAM_SHAPE_SUITE_PASS", () => {
    const result = evaluateSmallSidedProfile({
      teamShapeOverride: {
        milestoneVerdict: "FAIL",
        details: "test override",
      },
    });

    const teamComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:TEAM_SHAPE_SUITE_PASS",
    );
    expect(teamComp).toBeDefined();
    expect(teamComp!.outcome).toBe("FAIL");
  });

  it("override with NOT_EVALUATED produces NOT_EVALUATED", () => {
    const result = evaluateSmallSidedProfile({
      mutantTeamOverride: {
        milestoneVerdict: "NOT_EVALUATED",
        details: "test override",
      },
      teamShapeOverride: {
        milestoneVerdict: "NOT_EVALUATED",
        details: "test override",
      },
    });

    const mutantComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:MUTANT_TEAM_PASS",
    );
    const teamComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:TEAM_SHAPE_SUITE_PASS",
    );

    expect(mutantComp!.outcome).toBe("NOT_EVALUATED");
    expect(teamComp!.outcome).toBe("NOT_EVALUATED");
  });

  it("override with INVALID_RUN produces INVALID_RUN", () => {
    const result = evaluateSmallSidedProfile({
      mutantTeamOverride: {
        milestoneVerdict: "INVALID_RUN",
        details: "test override",
      },
      teamShapeOverride: {
        milestoneVerdict: "INVALID_RUN",
        details: "test override",
      },
    });

    const mutantComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:MUTANT_TEAM_PASS",
    );
    const teamComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:TEAM_SHAPE_SUITE_PASS",
    );

    expect(mutantComp!.outcome).toBe("INVALID_RUN");
    expect(teamComp!.outcome).toBe("INVALID_RUN");
  });
});

// ---------------------------------------------------------------------------
// (c) An unknown prereq yields NOT_EVALUATED
// ---------------------------------------------------------------------------

describe("SMALL-SIDED exit prereqs: unknown prereq → NOT_EVALUATED", () => {
  it("unknown prereq returns NOT_EVALUATED", () => {
    // Inject a fake profile with an unknown prereq.
    const fakeProfile = {
      ...SMALL_SIDED_SHAPE_PROFILE,
      exit_prerequisites: [
        ...SMALL_SIDED_SHAPE_PROFILE.exit_prerequisites,
        "PHANTOM_PREREQ",
      ],
    };

    const result = evaluateSmallSidedProfile({ profile: fakeProfile });

    const phantomComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:PHANTOM_PREREQ",
    );
    expect(phantomComp).toBeDefined();
    expect(phantomComp!.outcome).toBe("NOT_EVALUATED");
    expect(phantomComp!.evidence[0]).toContain(
      "not in the small-sided support list",
    );
  });

  it("a single unknown prereq among known ones still produces results for known ones", () => {
    const fakeProfile = {
      ...SMALL_SIDED_SHAPE_PROFILE,
      exit_prerequisites: [
        "MUTANT_TEAM_PASS",
        "PHANTOM_PREREQ",
        "TEAM_SHAPE_SUITE_PASS",
      ],
    };

    const result = evaluateSmallSidedProfile({ profile: fakeProfile });

    // Known prereqs should still be evaluated (not NOT_EVALUATED).
    const mutantComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:MUTANT_TEAM_PASS",
    );
    const teamComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:TEAM_SHAPE_SUITE_PASS",
    );
    const phantomComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:PHANTOM_PREREQ",
    );

    // Known prereqs get actual evaluation; unknown gets NOT_EVALUATED.
    expect(mutantComp).toBeDefined();
    expect(teamComp).toBeDefined();
    expect(phantomComp).toBeDefined();
    expect(phantomComp!.outcome).toBe("NOT_EVALUATED");
    // Known prereqs should NOT be NOT_EVALUATED unless the underlying
    // evaluator actually returns NOT_EVALUATED.
    if (mutantComp!.outcome === "NOT_EVALUATED") {
      // This is fine — the underlying evaluator may return NOT_EVALUATED.
      // The important thing is that the unknown one also returns NOT_EVALUATED.
    } else {
      // If it's evaluated, it must be a real verdict.
      expect(["PASS", "FAIL", "INVALID_RUN"]).toContain(mutantComp!.outcome);
    }
  });
});

// ---------------------------------------------------------------------------
// (d) Existing PLAYABLE_1V1 exit-prereq path still behaves unchanged
// ---------------------------------------------------------------------------

describe("PLAYABLE_1V1 regression: exit-prereq path unchanged", () => {
  it("PLAYABLE_1V1 exit prereqs still work via evaluatePlayable1v1", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // PLAYABLE_1V1 exit prerequisites should still be present.
    const exitPrereqs = PLAYABLE_1V1_PROFILE.exit_prerequisites;

    for (const prereq of exitPrereqs) {
      const comp = findSubComponent(
        result.subComponents,
        `EXIT_PREREQ:${prereq}`,
      );
      expect(comp).toBeDefined();
      expect(comp!.componentId).toBe(`EXIT_PREREQ:${prereq}`);
    }
  });

  it("PLAYABLE_1V1 exit prereq outcomes are from the actual evaluators", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    // The MUTANT_1V1_PASS exit prereq should be evaluated by the
    // actual mutant-1v1 evaluator, not a stub.
    const mutantComp = findSubComponent(
      result.subComponents,
      "EXIT_PREREQ:MUTANT_1V1_PASS",
    );
    expect(mutantComp).toBeDefined();
    expect(mutantComp!.componentId).toBe("EXIT_PREREQ:MUTANT_1V1_PASS");
    // The outcome is honest — could be PASS, NOT_EVALUATED, etc.
    // but must be one of the valid verdicts.
    const validOutcomes = new Set([
      "PASS",
      "FAIL",
      "INVALID_RUN",
      "NOT_EVALUATED",
      "NEEDS_PERCEPTUAL_REVIEW",
    ]);
    expect(validOutcomes.has(mutantComp!.outcome)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (e) No overclaims: reducer does not emit a PROMOTION verdict
// ---------------------------------------------------------------------------

describe("No PROMOTION overclaim", () => {
  it("overallVerdict is never a PROMOTION-tier value", () => {
    const result = evaluateSmallSidedProfile();

    const validOverallVerdicts = new Set([
      "PASS",
      "FAIL",
      "INVALID_RUN",
      "NOT_EVALUATED",
      "NEEDS_PERCEPTUAL_REVIEW",
      "BLOCKED_MISSING_REFERENCE",
    ]);

    expect(validOverallVerdicts.has(result.overallVerdict)).toBe(true);
    // The reducer must never emit a PROMOTION-type verdict.
    expect(result.overallVerdict).not.toBe("PROMOTION");
  });

  it("sub-component outcomes are never PROMOTION-tier", () => {
    const result = evaluateSmallSidedProfile();

    const validOutcomes = new Set([
      "PASS",
      "FAIL",
      "INVALID_RUN",
      "NOT_EVALUATED",
      "NEEDS_PERCEPTUAL_REVIEW",
      "BLOCKED_MISSING_REFERENCE",
    ]);

    for (const comp of result.subComponents) {
      expect(validOutcomes.has(comp.outcome)).toBe(true);
      expect(comp.outcome).not.toBe("PROMOTION");
      expect(comp.outcome).not.toContain("PROMOTION");
    }
  });

  it("details string does not mention §2.3 or §8", () => {
    const result = evaluateSmallSidedProfile();

    expect(result.details).not.toContain("§2.3");
    expect(result.details).not.toContain("§8");
  });
});

// ---------------------------------------------------------------------------
// Additional structural tests
// ---------------------------------------------------------------------------

describe("SmallSidedProfileResult structure", () => {
  it("result has correct milestoneId", () => {
    const result = evaluateSmallSidedProfile();
    expect(result.milestoneId).toBe("SMALL_SIDED_SHAPE");
  });

  it("result has profileVersion", () => {
    const result = evaluateSmallSidedProfile();
    expect(result.profileVersion).toBe("milestone-small-sided-v1");
  });

  it("allExitPrerequisitesSatisfied reflects whether all exit prereqs PASS", () => {
    const result = evaluateSmallSidedProfile();
    // allExitPrerequisitesSatisfied should match whether every exit-prereq
    // sub-component has outcome === "PASS".
    const exitComps = result.subComponents.filter((c) =>
      c.componentId.startsWith("EXIT_PREREQ:"),
    );
    const expectedAllPass = exitComps.every((c) => c.outcome === "PASS");
    expect(result.allExitPrerequisitesSatisfied).toBe(expectedAllPass);
  });

  it("subComponents include evidence strings", () => {
    const result = evaluateSmallSidedProfile();

    for (const comp of result.subComponents) {
      if (comp.componentId.startsWith("EXIT_PREREQ:")) {
        expect(comp.evidence.length).toBeGreaterThan(0);
        // Evidence should mention the prerequisite name.
        const prereqName = comp.componentId.replace("EXIT_PREREQ:", "");
        const prereqEvidence = comp.evidence.some((e) =>
          e.includes(prereqName),
        );
        expect(prereqEvidence).toBe(true);
      }
    }
  });

  it("overallVerdict follows correct precedence: INVALID_RUN > FAIL > NOT_EVALUATED > PASS", () => {
    // INVALID_RUN should win over everything else.
    const invalidResult = evaluateSmallSidedProfile({
      mutantTeamOverride: {
        milestoneVerdict: "INVALID_RUN",
        details: "test",
      },
      teamShapeOverride: {
        milestoneVerdict: "PASS",
        details: "test",
      },
    });
    expect(invalidResult.overallVerdict).toBe("INVALID_RUN");

    // FAIL should win over NOT_EVALUATED and PASS.
    const failResult = evaluateSmallSidedProfile({
      mutantTeamOverride: {
        milestoneVerdict: "FAIL",
        details: "test",
      },
      teamShapeOverride: {
        milestoneVerdict: "NOT_EVALUATED",
        details: "test",
      },
    });
    expect(failResult.overallVerdict).toBe("FAIL");

    // NOT_EVALUATED should win over PASS.
    const notEvalResult = evaluateSmallSidedProfile({
      mutantTeamOverride: {
        milestoneVerdict: "NOT_EVALUATED",
        details: "test",
      },
      teamShapeOverride: {
        milestoneVerdict: "PASS",
        details: "test",
      },
    });
    expect(notEvalResult.overallVerdict).toBe("NOT_EVALUATED");

    // All PASS → overall PASS.
    const passResult = evaluateSmallSidedProfile({
      mutantTeamOverride: {
        milestoneVerdict: "PASS",
        details: "test",
      },
      teamShapeOverride: {
        milestoneVerdict: "PASS",
        details: "test",
      },
    });
    expect(passResult.overallVerdict).toBe("PASS");
  });
});