/**
 * @module tests/unit/eval/SMALL-SIDED-EXIT-PREREQ-IDENTITY-binding.test.ts
 *
 * Evidence-binding test: proves that the corrected exit_prerequisite_accepted
 * identity in SMALL-SIDED-EXIT-PREREQ-IDENTITY matches the
 * SMALL_SIDED_SHAPE_PROFILE's declared exit_prerequisites, and that the
 * corrected input reduces to milestone PASS.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll } from "vitest";

import {
  SMALL_SIDED_SHAPE_PROFILE,
} from "../../../eval/contracts/profiles.js";
import { evaluateMilestonePlaytest } from "../../../gauntlet/evals/src/evaluate-state.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docs/evidence/SMALL-SIDED-EXIT-PREREQ-IDENTITY",
);

/** The situation IDs required by SMALL_SIDED_SHAPE */
const REQUIRED_SITUATIONS = [
  "PASS_RECEPTION",
  "SHOT_TO_RESULT",
  "PHYSICAL_DUEL",
  "SUPPORT_AND_PASSING_LANES",
  "SETTLED_ATTACK_VS_DEFENCE",
  "ATTACK_TO_DEFENCE_TRANSITION",
  "DEFENCE_TO_ATTACK_TRANSITION",
  "COORDINATED_PRESS",
];

/** The wrong 1v1 exit identities that must NOT appear in this objective's records */
const WRONG_1V1_EXIT_NAMES = [
  "MUTANT_1V1_PASS",
  "ARCHETYPE_BLINDED_COMPARISON",
];

/** The correct SMALL_SIDED_SHAPE exit prerequisites */
const CORRECT_EXIT_PREREQS = SMALL_SIDED_SHAPE_PROFILE.exit_prerequisites;

// ---------------------------------------------------------------------------
// 1. Profile contract identity
// ---------------------------------------------------------------------------

describe("Profile contract: SMALL_SIDED_SHAPE exit prerequisites", () => {
  it("exit_prerequisites == ['MUTANT_TEAM_PASS', 'TEAM_SHAPE_SUITE_PASS']", () => {
    expect(SMALL_SIDED_SHAPE_PROFILE.exit_prerequisites).toEqual([
      "MUTANT_TEAM_PASS",
      "TEAM_SHAPE_SUITE_PASS",
    ]);
  });

  it("entry_prerequisites == ['PLAYABLE_1V1_PASS', 'TEAM_DECISION_PROFILE']", () => {
    expect(SMALL_SIDED_SHAPE_PROFILE.entry_prerequisites).toEqual([
      "PLAYABLE_1V1_PASS",
      "TEAM_DECISION_PROFILE",
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. Corrected input.json verifies exit prereq identity
// ---------------------------------------------------------------------------

describe("Corrected input.json: exit_prerequisite_accepted matches profile", () => {
  let input: Record<string, unknown>;

  beforeAll(() => {
    input = JSON.parse(
      readFileSync(join(FIXTURE_DIR, "input.json"), "utf-8"),
    ) as Record<string, unknown>;
  });

  it("exit_prerequisite_accepted == SMALL_SIDED_SHAPE_PROFILE.exit_prerequisites", () => {
    const exitPrereqs = (input.evidence as Record<string, unknown>)
      .exit_prerequisite_accepted as string[];

    expect(exitPrereqs).toEqual(CORRECT_EXIT_PREREQS);
  });

  it("exit_prerequisite_accepted is byte-equal to profile (no drift)", () => {
    const inputExitPrereqs = (input.evidence as Record<string, unknown>)
      .exit_prerequisite_accepted as string[];

    // Deep structural equality — same length, same values, same order
    expect(inputExitPrereqs.length).toBe(CORRECT_EXIT_PREREQS.length);
    for (let i = 0; i < inputExitPrereqs.length; i++) {
      expect(inputExitPrereqs[i]).toBe(CORRECT_EXIT_PREREQS[i]);
    }
  });

  it("entry_prerequisite_accepted == SMALL_SIDED_SHAPE_PROFILE.entry_prerequisites", () => {
    const entryPrereqs = (input.evidence as Record<string, unknown>)
      .entry_prerequisite_accepted as string[];

    expect(entryPrereqs).toEqual(SMALL_SIDED_SHAPE_PROFILE.entry_prerequisites);
  });

  it("NO wrong 1v1 exit names in exit_prerequisite_accepted", () => {
    const exitPrereqs = (input.evidence as Record<string, unknown>)
      .exit_prerequisite_accepted as string[];

    for (const wrong of WRONG_1V1_EXIT_NAMES) {
      expect(
        exitPrereqs.includes(wrong),
        `exit_prerequisite_accepted must NOT contain ${wrong}`,
      ).toBe(false);
    }
  });

  it("entry_prerequisite_accepted has no wrong 1v1 names", () => {
    const entryPrereqs = (input.evidence as Record<string, unknown>)
      .entry_prerequisite_accepted as string[];

    for (const wrong of WRONG_1V1_EXIT_NAMES) {
      expect(
        entryPrereqs.includes(wrong),
        `entry_prerequisite_accepted must NOT contain ${wrong}`,
      ).toBe(false);
    }
  });

  it("all 8 situation outcomes are PASS", () => {
    const outcomes = (input as Record<string, Record<string, string>>)
      .situation_outcomes as Record<string, string>;

    for (const sit of REQUIRED_SITUATIONS) {
      expect(outcomes[sit], `${sit} outcome should be PASS`).toBe("PASS");
    }
  });

  it("prerequisites_pass and critic_verdict are correct", () => {
    expect((input as Record<string, boolean>).entry_prerequisites_pass).toBe(true);
    expect((input as Record<string, boolean>).exit_prerequisites_pass).toBe(true);
    expect((input as Record<string, string>).critic_verdict).toBe("ACCEPT");
  });

  it("remark documents the identity correction", () => {
    const remark = (input.evidence as Record<string, string>).remark as string;
    expect(remark).toContain("Identity correction");
    expect(remark).toContain("MUTANT_TEAM_PASS");
    expect(remark).toContain("TEAM_SHAPE_SUITE_PASS");
  });
});

// ---------------------------------------------------------------------------
// 3. evaluateMilestonePlaytest reduces corrected input → PASS
// ---------------------------------------------------------------------------

describe("Corrected input reducer: evaluateMilestonePlaytest → PASS", () => {
  let input: Record<string, unknown>;

  beforeAll(() => {
    input = JSON.parse(
      readFileSync(join(FIXTURE_DIR, "input.json"), "utf-8"),
    ) as Record<string, unknown>;
  });

  it("reduces to milestone_verdict PASS", () => {
    const outcome = (input as Record<string, Record<string, string>>)
      .situation_outcomes as Record<string, string>;

    const scenario = {
      id: "SMALL-SIDED-EXIT-PREREQ-IDENTITY",
      kind: "milestone_playtest_gate" as const,
      input: {
        milestone_id: "SMALL_SIDED_SHAPE",
        entry_prerequisites_pass: true,
        exit_prerequisites_pass: true,
        required_situations: REQUIRED_SITUATIONS,
        situation_outcomes: outcome,
        critic_verdict: "ACCEPT" as const,
      },
      expect: { decision: "milestone_verdict_ready" as const, milestone_verdict: "PASS" as const },
    };

    const result = evaluateMilestonePlaytest(scenario);

    expect(result.milestone_verdict).toBe("PASS");
    expect(result.decision).toBe("milestone_verdict_ready");
    expect(result.failure_class).toBeUndefined();
  });

  it("critic_verdict ACCEPT is required — FAIL with MISSING", () => {
    const outcome = (input as Record<string, Record<string, string>>)
      .situation_outcomes as Record<string, string>;

    const scenario = {
      id: "test-critic-missing",
      kind: "milestone_playtest_gate" as const,
      input: {
        milestone_id: "SMALL_SIDED_SHAPE",
        entry_prerequisites_pass: true,
        exit_prerequisites_pass: true,
        required_situations: REQUIRED_SITUATIONS,
        situation_outcomes: outcome,
        critic_verdict: "MISSING" as const,
      },
      expect: { decision: "reject_milestone_verdict" as const },
    };

    const result = evaluateMilestonePlaytest(scenario);
    expect(result.milestone_verdict).toBe("NEEDS_PERCEPTUAL_REVIEW");
    expect(result.decision).toBe("reject_milestone_verdict");
  });

  it("exit_prerequisites_pass === false → NOT_EVALUATED", () => {
    const outcome = (input as Record<string, Record<string, string>>)
      .situation_outcomes as Record<string, string>;

    const scenario = {
      id: "test-exit-false",
      kind: "milestone_playtest_gate" as const,
      input: {
        milestone_id: "SMALL_SIDED_SHAPE",
        entry_prerequisites_pass: true,
        exit_prerequisites_pass: false,
        required_situations: REQUIRED_SITUATIONS,
        situation_outcomes: outcome,
        critic_verdict: "ACCEPT" as const,
      },
      expect: { decision: "milestone_not_evaluated" as const },
    };

    const result = evaluateMilestonePlaytest(scenario);
    expect(result.milestone_verdict).toBe("NOT_EVALUATED");
    expect(result.decision).toBe("milestone_not_evaluated");
    expect(result.failure_class).toBe("milestone_playtest_incomplete");
  });
});

// ---------------------------------------------------------------------------
// 4. evaluate-output.json is consistent with the corrected input
// ---------------------------------------------------------------------------

describe("evaluate-output.json: consistent with corrected input", () => {
  let output: Record<string, unknown>;

  beforeAll(() => {
    output = JSON.parse(
      readFileSync(join(FIXTURE_DIR, "evaluate-output.json"), "utf-8"),
    ) as Record<string, unknown>;
  });

  it("milestone_verdict is PASS", () => {
    expect(output.milestone_verdict).toBe("PASS");
  });

  it("decision is milestone_verdict_ready", () => {
    expect(output.decision).toBe("milestone_verdict_ready");
  });

  it("critic_verdict is ACCEPT", () => {
    expect(output.critic_verdict).toBe("ACCEPT");
  });

  it("failure_class is null", () => {
    expect(output.failure_class).toBeNull();
  });

  it("exit_prerequisite_accepted matches SMALL_SIDED_SHAPE_PROFILE", () => {
    const exitPrereqs = (output.evidence as Record<string, unknown>)
      .exit_prerequisite_accepted as string[];

    expect(exitPrereqs).toEqual(CORRECT_EXIT_PREREQS);

    for (const wrong of WRONG_1V1_EXIT_NAMES) {
      expect(
        exitPrereqs.includes(wrong),
        `evaluate-output.json must NOT contain ${wrong} as exit prereq`,
      ).toBe(false);
    }
  });

  it("8/8 situation outcomes are PASS", () => {
    const outcomes = output.situation_outcomes as Record<string, string>;

    for (const sit of REQUIRED_SITUATIONS) {
      expect(outcomes[sit]).toBe("PASS");
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Durable playtest record under milestones/ is consistent
// ---------------------------------------------------------------------------

describe("Durable playtest record: consistent with corrected input", () => {
  let playtestsDir: string;

  beforeAll(() => {
    playtestsDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests",
    );
  });

  it("latest playtest record has corrected exit prereqs", () => {
    const files = readdirSync(playtestsDir).filter((f) => f.endsWith(".json")).sort();
    const latest = files[files.length - 1];

    const record = JSON.parse(
      readFileSync(join(playtestsDir, latest), "utf-8"),
    ) as Record<string, unknown>;

    const exitPrereqs = (record.evidence as Record<string, unknown>)
      .exit_prerequisite_accepted as string[];

    expect(exitPrereqs).toEqual(CORRECT_EXIT_PREREQS);

    for (const wrong of WRONG_1V1_EXIT_NAMES) {
      expect(
        exitPrereqs.includes(wrong),
        `Latest playtest record must NOT contain ${wrong} as exit prereq`,
      ).toBe(false);
    }
  });
});