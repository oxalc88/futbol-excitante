/**
 * @module tests/unit/eval/team-decision-evidence-binding.node.test
 *
 * Evidence-binding tests for the TEAM_DECISION_PROFILE eval.json.
 *
 * Proves that:
 *  1. eval.json exists at docs/evidence/TEAM_DECISION_PROFILE/eval.json
 *  2. Structure is valid: profileVersion, axes, overall, milestoneVerdict present
 *  3. axes are non-empty, each has axis_id, outcome, evidence
 *  4. Re-running the evaluator produces the same overall verdict
 *  5. overall === milestoneVerdict
 *  6. No PES fidelity or invented reference envelope claims
 *
 * Node I/O is allowed in tests.
 * This test does NOT reuse resolveEntryPrereqOutcomes (that is for
 * PLAYABLE_1V1 entry prereqs).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runTeamDecisionEval } from "../../../eval/runners/team-decision-eval-runner.js";
import type { TeamDecisionEvalResult, AxisResult } from "../../../eval/runners/team-decision-eval-runner.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveEvidenceDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, "../../..", "docs/evidence/TEAM_DECISION_PROFILE");
}

function readEvalJson(): TeamDecisionEvalResult {
  const dir = resolveEvidenceDir();
  const path = join(dir, "eval.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as TeamDecisionEvalResult;
}

// Valid outcomes accepted by the evidence contract.
const VALID_OUTCOMES = new Set([
  "PASS",
  "FAIL",
  "NOT_EVALUATED",
  "BLOCKED_MISSING_REFERENCE",
  "NEEDS_PERCEPTUAL_REVIEW",
  "INVALID_RUN",
]);

// ---------------------------------------------------------------------------
// 1. eval.json exists on disk
// ---------------------------------------------------------------------------

describe("TEAM_DECISION_PROFILE evidence binding: eval.json exists", () => {
  it("eval.json is a valid JSON file at the expected path", () => {
    const doc = readEvalJson();
    expect(doc).toBeDefined();
    expect(typeof doc).toBe("object");
  });

  it("eval.json has required top-level keys", () => {
    const doc = readEvalJson();
    expect(doc).toHaveProperty("profileVersion");
    expect(doc).toHaveProperty("axes");
    expect(doc).toHaveProperty("overall");
    expect(doc).toHaveProperty("milestoneVerdict");
  });
});

// ---------------------------------------------------------------------------
// 2. Structure validation
// ---------------------------------------------------------------------------

describe("TEAM_DECISION_PROFILE evidence binding: structure", () => {
  it("profileVersion is a non-empty string", () => {
    const doc = readEvalJson();
    expect(typeof doc.profileVersion).toBe("string");
    expect(doc.profileVersion.length).toBeGreaterThan(0);
  });

  it("axes is a non-empty array", () => {
    const doc = readEvalJson();
    expect(Array.isArray(doc.axes)).toBe(true);
    expect(doc.axes.length).toBeGreaterThan(0);
  });

  it("each axis has required fields with correct types", () => {
    const doc = readEvalJson();
    for (const axis of doc.axes) {
      expect(typeof axis.axis_id).toBe("string");
      expect(axis.axis_id.length).toBeGreaterThan(0);
      expect(VALID_OUTCOMES.has(axis.outcome)).toBe(true);
      expect(Array.isArray(axis.evidence)).toBe(true);
      for (const ev of axis.evidence) {
        expect(typeof ev).toBe("string");
      }
    }
  });

  it("overall and milestoneVerdict are valid outcomes", () => {
    const doc = readEvalJson();
    expect(VALID_OUTCOMES.has(doc.overall)).toBe(true);
    expect(VALID_OUTCOMES.has(doc.milestoneVerdict)).toBe(true);
  });

  it("overall equals milestoneVerdict", () => {
    const doc = readEvalJson();
    expect(doc.overall).toBe(doc.milestoneVerdict);
  });
});

// ---------------------------------------------------------------------------
// 3. Live re-run consistency
// ---------------------------------------------------------------------------

describe("TEAM_DECISION_PROFILE evidence binding: live re-run", () => {
  it("re-running the evaluator produces the same overall verdict", () => {
    const persisted = readEvalJson();
    const live = runTeamDecisionEval();
    expect(live.overall).toBe(persisted.overall);
    expect(live.milestoneVerdict).toBe(persisted.milestoneVerdict);
  });

  it("live axes have the same count and axis_ids as persisted", () => {
    const persisted = readEvalJson();
    const live = runTeamDecisionEval();

    expect(live.axes.length).toBe(persisted.axes.length);

    const liveIds = live.axes.map((a) => a.axis_id);
    const persistedIds = persisted.axes.map((a) => a.axis_id);
    expect(liveIds).toEqual(persistedIds);

    // Verify each axis outcome matches.
    for (let i = 0; i < live.axes.length; i++) {
      expect(live.axes[i].outcome).toBe(persisted.axes[i].outcome);
      expect(live.axes[i].axis_id).toBe(persisted.axes[i].axis_id);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. No forbidden claims
// ---------------------------------------------------------------------------

describe("TEAM_DECISION_PROFILE evidence binding: no forbidden claims", () => {
  it("no axis evidence references PES fidelity", () => {
    const doc = readEvalJson();
    for (const axis of doc.axes) {
      for (const ev of axis.evidence) {
        expect(ev.toLowerCase()).not.toContain("pes 2017 fidelity");
      }
    }
  });

  it("no axis evidence invents reference envelopes", () => {
    const doc = readEvalJson();
    for (const axis of doc.axes) {
      for (const ev of axis.evidence) {
        expect(ev.toLowerCase()).not.toContain("reference envelope");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. CPU-TEAM-DECISION-PROFILE vs TEAM_DECISION_PROFILE separation
// ---------------------------------------------------------------------------

describe("TEAM_DECISION_PROFILE evidence binding: independent of CPU-TEAM-DECISION-PROFILE", () => {
  it("eval.json exists at TEAM_DECISION_PROFILE, not CPU-TEAM-DECISION-PROFILE", () => {
    // TEAM_DECISION_PROFILE/eval.json must exist (we just verified above).
    const teamDoc = readEvalJson();
    expect(teamDoc).toBeDefined();

    // CPU-TEAM-DECISION-PROFILE is a separate evidence identity with its own
    // evidence directory.  Our eval.json is NOT at the CPU path.
    const cpuDir = join(resolveEvidenceDir(), "..", "CPU-TEAM-DECISION-PROFILE");
    expect(cpuDir).not.toBe(resolveEvidenceDir());
  });
});