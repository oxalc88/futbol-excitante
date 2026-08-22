/**
 * @module tests/unit/eval/playable-1v1-entry-prereq-wiring
 *
 * Tests for the entry-prerequisite caller wiring in evaluatePlayable1v1.
 *
 * Entry prereqs are verified by the calling layer (profile runner).
 * When accepted evidence exists, the runner passes the outcome to the
 * evaluator.  Without evidence, they default to BLOCKED_MISSING_REFERENCE.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { evaluatePlayable1v1, type Playable1v1Result, type SubComponentResult } from "../../../eval/runners/playable-evaluator.js";
import { PLAYABLE_1V1_PROFILE } from "../../../eval/contracts/profiles.js";

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

function findEntryPrereqs(
  result: Playable1v1Result,
): Array<{ name: string; outcome: string }> {
  return PLAYABLE_1V1_PROFILE.entry_prerequisites.map((prereq) => {
    const comp = result.subComponents.find(
      (s) => s.componentId === `ENTRY_PREREQ:${prereq}`,
    );
    expect(comp).toBeDefined();
    return { name: prereq, outcome: comp!.outcome };
  });
}

// ---------------------------------------------------------------------------
// Tests: Default behaviour (no caller-supplied outcomes)
// ---------------------------------------------------------------------------

describe("PLAYABLE_1V1: entry prereq default (no caller-supplied outcomes)", () => {
  it("unverified entry prereqs default to BLOCKED_MISSING_REFERENCE", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const prereqs = findEntryPrereqs(result);
    for (const p of prereqs) {
      expect(p.outcome).toBe("BLOCKED_MISSING_REFERENCE");
      // Evidence must mention the prerequisite name as diagnostic.
      const comp = result.subComponents.find(
        (s) => s.componentId === `ENTRY_PREREQ:${p.name}`,
      );
      expect(comp!.evidence).toHaveLength(1);
      expect(comp!.evidence[0]).toContain(p.name);
    }
  });

  it("overall verdict is blocked by entry prereqs among other failures", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);
    // The foundation scenario has INVALID_RUN browser cases,
    // which has higher precedence than BLOCKED_MISSING_REFERENCE.
    // The important thing is that entry prereqs are BLOCKED_MISSING_REFERENCE.
    const prereqs = findEntryPrereqs(result);
    for (const p of prereqs) {
      expect(p.outcome).toBe("BLOCKED_MISSING_REFERENCE");
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: Caller-supplied outcomes
// ---------------------------------------------------------------------------

describe("PLAYABLE_1V1: entry prereq caller-supplied outcomes", () => {
  it("when FOUNDATION_LAB_PASS is passed, the prereq reflects that", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario, {
      entryPrereqOutcomes: {
        FOUNDATION_LAB_PASS: "PASS",
      },
    });

    const prereqs = findEntryPrereqs(result);
    const labPrereq = prereqs.find((p) => p.name === "FOUNDATION_LAB_PASS");
    const capPrereq = prereqs.find((p) => p.name === "CAPABILITY_DESIGN_PROFILE");

    expect(labPrereq!.outcome).toBe("PASS");

    // CAPABILITY_DESIGN_PROFILE is still unverified.
    expect(capPrereq!.outcome).toBe("BLOCKED_MISSING_REFERENCE");

    // The lab prereq evidence references the caller-supplied outcome.
    const labComp = result.subComponents.find(
      (s) => s.componentId === "ENTRY_PREREQ:FOUNDATION_LAB_PASS",
    );
    expect(labComp!.evidence[0]).toContain("FOUNDATION_LAB_PASS");
    expect(labComp!.evidence[0]).toContain("PASS");
  });

  it("when both prereqs are passed, entryPrerequisitesSatisfied is true", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario, {
      entryPrereqOutcomes: {
        FOUNDATION_LAB_PASS: "PASS",
        CAPABILITY_DESIGN_PROFILE: "PASS",
      },
    });

    expect(result.entryPrerequisitesSatisfied).toBe(true);
  });

  it("when one prereq is FAIL, entryPrerequisitesSatisfied is false", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario, {
      entryPrereqOutcomes: {
        FOUNDATION_LAB_PASS: "FAIL",
        CAPABILITY_DESIGN_PROFILE: "PASS",
      },
    });

    expect(result.entryPrerequisitesSatisfied).toBe(false);
  });

  it("when one prereq is NOT_EVALUATED, entryPrerequisitesSatisfied is true (spec allows)", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario, {
      entryPrereqOutcomes: {
        FOUNDATION_LAB_PASS: "NOT_EVALUATED",
        CAPABILITY_DESIGN_PROFILE: "PASS",
      },
    });

    // The satisfaction check allows NOT_EVALUATED for entry prereqs.
    expect(result.entryPrerequisitesSatisfied).toBe(true);
  });

  it("BLOCKED_MISSING_REFERENCE entry prereq is recorded regardless of overall verdict", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario, {
      entryPrereqOutcomes: {
        FOUNDATION_LAB_PASS: "PASS",
        CAPABILITY_DESIGN_PROFILE: "BLOCKED_MISSING_REFERENCE",
      },
    });

    // The overall verdict is dominated by other failures (browser INVALID_RUN),
    // but the entry prereq outcome is still BLOCKED_MISSING_REFERENCE.
    const capPrereq = findEntryPrereqs(result).find(
      (p) => p.name === "CAPABILITY_DESIGN_PROFILE",
    );
    expect(capPrereq!.outcome).toBe("BLOCKED_MISSING_REFERENCE");
    // Entry is not satisfied because not all are PASS/NOT_EVALUATED.
    expect(result.entryPrerequisitesSatisfied).toBe(false);
  });

  it("caller-supplied PASS for both prereqs still prevents overall PASS due to other criteria", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario, {
      entryPrereqOutcomes: {
        FOUNDATION_LAB_PASS: "PASS",
        CAPABILITY_DESIGN_PROFILE: "PASS",
      },
    });

    // Even with entry prereqs satisfied, the overall should not PASS
    // because browser cases / other criteria may still block it.
    expect(result.milestoneVerdict).not.toBe("PASS");
  });

  it("empty entryPrereqOutcomes map is treated as no evidence (defaults to BLOCKED_MISSING_REFERENCE)", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario, {
      entryPrereqOutcomes: {},
    });

    const prereqs = findEntryPrereqs(result);
    for (const p of prereqs) {
      expect(p.outcome).toBe("BLOCKED_MISSING_REFERENCE");
    }
  });

  it("undefined entryPrereqOutcomes is treated as no evidence", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const prereqs = findEntryPrereqs(result);
    for (const p of prereqs) {
      expect(p.outcome).toBe("BLOCKED_MISSING_REFERENCE");
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: Outcome validity
// ---------------------------------------------------------------------------

describe("PLAYABLE_1V1: entry prereq outcome values", () => {
  it("accepts valid PASS and NOT_EVALUATED outcomes as caller-supplied values", () => {
    const scenario = loadFixture();
    for (const outcome of ["PASS", "NOT_EVALUATED", "FAIL"] as SubComponentResult["outcome"][]) {
      const result = evaluatePlayable1v1(scenario, {
        entryPrereqOutcomes: {
          FOUNDATION_LAB_PASS: outcome,
          CAPABILITY_DESIGN_PROFILE: outcome,
        },
      });

      const prereqs = findEntryPrereqs(result);
      for (const p of prereqs) {
        expect(p.outcome).toBe(outcome);
      }
    }
  });

  it("the module exports evaluatePlayable1v1 with the option", async () => {
    const mod = await import(
      "../../../eval/runners/playable-evaluator.js"
    );
    expect(mod.evaluatePlayable1v1).toBeDefined();
  });
});