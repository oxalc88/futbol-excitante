import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SMALL_SIDED_SHAPE_PROFILE } from "../../eval/contracts/profiles.js";
import { TEAM_SUITE } from "../../eval/contracts/suites.js";
import { BROWSER_CASE_SMALL_SIDED_001 } from "../../eval/contracts/browser-cases.js";
import { evaluateMilestonePlaytest, evaluateScenario } from "../../gauntlet/evals/src/evaluate-state.js";
import type { DynamicSequenceGateScenario, MilestonePlaytestGateScenario, RemoteDurabilityGateScenario } from "../../gauntlet/evals/contracts/scenario.js";

const repoRoot = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8")) as T;
}

describe("Gauntlet 0.9 milestone contracts", () => {
  it("materializes the normative SMALL_SIDED_SHAPE profile", () => {
    expect(SMALL_SIDED_SHAPE_PROFILE.profile_version).toBe("milestone-small-sided-v1");
    expect(SMALL_SIDED_SHAPE_PROFILE.required_capabilities).toEqual(expect.arrayContaining([
      "TEAM_TACTICS",
      "TRANSITION_PHASES",
      "SMALL_SIDED_CARDINALITY",
    ]));
    expect(SMALL_SIDED_SHAPE_PROFILE.required_suite_ids).toContain("team");
    expect(SMALL_SIDED_SHAPE_PROFILE.required_browser_case_ids).toContain("BROWSER-SMALL-SIDED-001");
    expect(SMALL_SIDED_SHAPE_PROFILE.entry_prerequisites).toEqual(["PLAYABLE_1V1_PASS", "TEAM_DECISION_PROFILE"]);
    expect(SMALL_SIDED_SHAPE_PROFILE.exit_prerequisites).toEqual(["MUTANT_TEAM_PASS", "TEAM_SHAPE_SUITE_PASS"]);
  });

  it("materializes the team suite from documented team/transition cases", () => {
    expect(TEAM_SUITE.prerequisite_capabilities).toEqual(["TEAM_TACTICS", "TRANSITION_PHASES", "SMALL_SIDED_CARDINALITY"]);
    expect(TEAM_SUITE.direct_test_ids).toEqual(expect.arrayContaining([
      "OFF-SUP-001",
      "DEF-SHAPE-001",
      "PRESS-001",
      "TRANS-AD-001",
      "TRANS-DA-001",
    ]));
  });

  it("registers existing 3v3 browser execution without claiming milestone quality", () => {
    expect(BROWSER_CASE_SMALL_SIDED_001.test_source).toBe("tests/browser/3v3-match.browser.test.ts");
    expect(BROWSER_CASE_SMALL_SIDED_001.acceptance_criteria).toContain("does not by itself prove");
  });

  it("keeps gameplay situation IDs unique and playtest references resolvable", () => {
    const registry = readJson<{ situations: Array<{ situation_id: string }> }>("gauntlet/gameplay-situations.json");
    const plan = readJson<{ required_situations: string[]; status: string }>("gauntlet/playtests/SMALL_SIDED_SHAPE.json");
    const ids = registry.situations.map((s) => s.situation_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const required of plan.required_situations) expect(ids).toContain(required);
    expect(plan.status).toBe("PLAN_ONLY");
  });

  it("does not turn partial gameplay situation coverage into milestone PASS", () => {
    const scenario: MilestonePlaytestGateScenario = {
      id: "test-partial",
      kind: "milestone_playtest_gate",
      input: {
        milestone_id: "SMALL_SIDED_SHAPE",
        entry_prerequisites_pass: true,
        exit_prerequisites_pass: true,
        required_situations: ["PASS_RECEPTION", "ATTACK_TO_DEFENCE_TRANSITION"],
        situation_outcomes: { PASS_RECEPTION: "PASS" },
        critic_verdict: "ACCEPT",
      },
      expect: { decision: "runtime" },
    };
    expect(evaluateMilestonePlaytest(scenario)).toMatchObject({
      milestone_verdict: "NOT_EVALUATED",
      failure_class: "milestone_playtest_incomplete",
    });
  });

  it("requires critic ACCEPT even when every situation passes", () => {
    const scenario: MilestonePlaytestGateScenario = {
      id: "test-no-critic",
      kind: "milestone_playtest_gate",
      input: {
        milestone_id: "SMALL_SIDED_SHAPE",
        entry_prerequisites_pass: true,
        exit_prerequisites_pass: true,
        required_situations: ["PASS_RECEPTION"],
        situation_outcomes: { PASS_RECEPTION: "PASS" },
        critic_verdict: "MISSING",
      },
      expect: { decision: "runtime" },
    };
    expect(evaluateMilestonePlaytest(scenario)).toMatchObject({
      decision: "reject_milestone_verdict",
      failure_class: "critic_bypassed",
    });
  });

  it("requires DYNAMIC_VISUAL for temporal browser-visible claims", () => {
    const scenario: DynamicSequenceGateScenario = {
      id: "test-class",
      kind: "dynamic_sequence_gate",
      input: {
        evidence_class: "MULTI_TICK",
        temporal_and_visual: true,
        frame_count: 0,
        sequence_manifest_exists: false,
        labels_complete: false,
      },
      expect: { decision: "runtime" },
    };
    expect(evaluateScenario(scenario)).toMatchObject({ decision: "reject_evidence_class", failure_class: "evidence_class_too_weak" });
  });

  it("requires event-centered frames when an event claim says they are required", () => {
    const scenario: DynamicSequenceGateScenario = {
      id: "test-event",
      kind: "dynamic_sequence_gate",
      input: {
        evidence_class: "DYNAMIC_VISUAL",
        temporal_and_visual: true,
        frame_count: 4,
        sequence_manifest_exists: true,
        labels_complete: true,
        event_centered_required: true,
        event_centered: false,
      },
      expect: { decision: "runtime" },
    };
    expect(evaluateScenario(scenario)).toMatchObject({ decision: "reject_acceptance", failure_class: "event_evidence_not_centered" });
  });

  it("blocks continuation while a finalized acceptance is still local-only", () => {
    const scenario: RemoteDurabilityGateScenario = {
      id: "test-remote",
      kind: "remote_durability_gate",
      input: {
        acceptance_finalized: true,
        remote_contains_acceptance: false,
        horizon_exhausted: false,
        next_objective: "NEXT",
      },
      expect: { decision: "runtime" },
    };
    expect(evaluateScenario(scenario)).toMatchObject({ decision: "publish_before_continue", failure_class: "remote_durability_missing" });
  });
});
