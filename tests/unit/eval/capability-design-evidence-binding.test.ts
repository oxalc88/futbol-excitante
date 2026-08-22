/**
 * @module tests/unit/eval/capability-design-evidence-binding
 *
 * Evidence-binding tests for the CAPABILITY_DESIGN_PROFILE eval.json.
 *
 * Proves that:
 *  1. eval.json exists at docs/evidence/CAPABILITY_DESIGN_PROFILE/eval.json
 *  2. overall and milestoneVerdict match a live evaluateCapabilityDesign() call
 *  3. axes array is present and non-empty
 *  4. profileVersion is a non-empty string
 *  5. No FOUNDATION_LAB_PASS or PES fidelity claims in the result
 *
 * Node I/O is allowed in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateCapabilityDesign,
  type CapabilityDesignEvaluationResult,
} from "../../../eval/runners/evaluate-capability-design.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveEvidenceDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // tests/unit/eval → tests/unit → tests → repo-root → docs/evidence/...
  return join(__dirname, "../../..", "docs/evidence/CAPABILITY_DESIGN_PROFILE");
}

function readEvalJson(): Record<string, unknown> {
  const dir = resolveEvidenceDir();
  const path = join(dir, "eval.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// 1. eval.json exists on disk
// ---------------------------------------------------------------------------

describe("Evidence binding: eval.json exists", () => {
  it("eval.json is a valid JSON file at the expected path", () => {
    const doc = readEvalJson();
    expect(doc).toBeDefined();
    expect(typeof doc).toBe("object");
  });
});

// ---------------------------------------------------------------------------
// 2. overall / milestoneVerdict match a live call
// ---------------------------------------------------------------------------

describe("Evidence binding: overall and milestoneVerdict match live call", () => {
  it("eval.json overall matches a fresh evaluateCapabilityDesign() call", () => {
    const diskDoc = readEvalJson();
    const liveResult = evaluateCapabilityDesign();

    expect(diskDoc.overall).toBe(liveResult.overall);
  });

  it("eval.json milestoneVerdict matches overall", () => {
    const diskDoc = readEvalJson();
    expect(diskDoc.milestoneVerdict).toBe(diskDoc.overall);
  });

  it("eval.json overall is a valid verdict string", () => {
    const diskDoc = readEvalJson();
    const validVerdicts = new Set([
      "PASS",
      "FAIL",
      "NOT_EVALUATED",
      "INVALID_RUN",
      "NEEDS_PERCEPTUAL_REVIEW",
    ]);
    expect(validVerdicts.has(diskDoc.overall as string)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. axes array is present and non-empty
// ---------------------------------------------------------------------------

describe("Evidence binding: axes", () => {
  it("eval.json has an axes array with entries", () => {
    const diskDoc = readEvalJson();
    expect(Array.isArray(diskDoc.axes)).toBe(true);
    expect((diskDoc.axes as unknown[]).length).toBeGreaterThan(0);
  });

  it("each axis has required fields: axis_id, status, outcome, evidence", () => {
    const diskDoc = readEvalJson();
    const axes = diskDoc.axes as Array<Record<string, unknown>>;
    for (const axis of axes) {
      expect(axis.axis_id).toBeDefined();
      expect(typeof axis.axis_id).toBe("string");
      expect(axis.status).toBeDefined();
      expect(axis.outcome).toBeDefined();
      expect(Array.isArray(axis.evidence)).toBe(true);
    }
  });

  it("all axes are IMPLEMENTED (no DEFERRED in the evidence)", () => {
    const diskDoc = readEvalJson();
    const axes = diskDoc.axes as Array<Record<string, unknown>>;
    for (const axis of axes) {
      expect(axis.status).not.toBe("DEFERRED");
    }
  });

  it("transient-acceleration axis is PASS", () => {
    const diskDoc = readEvalJson();
    const axes = diskDoc.axes as Array<Record<string, unknown>>;
    const transAxis = axes.find((a) => a.axis_id === "transient-acceleration");
    expect(transAxis).toBeDefined();
    expect(transAxis!.outcome).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 4. profileVersion is non-empty
// ---------------------------------------------------------------------------

describe("Evidence binding: profileVersion", () => {
  it("eval.json has a non-empty profileVersion string", () => {
    const diskDoc = readEvalJson();
    expect(typeof diskDoc.profileVersion).toBe("string");
    expect((diskDoc.profileVersion as string).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. No forbidden claims in the result
// ---------------------------------------------------------------------------

describe("Evidence binding: no forbidden claims", () => {
  it("eval.json does not claim FOUNDATION_LAB_PASS", () => {
    const diskDoc = readEvalJson();
    const jsonStr = JSON.stringify(diskDoc);
    expect(jsonStr).not.toContain("FOUNDATION_LAB_PASS");
  });

  it("eval.json does not claim PES fidelity", () => {
    const diskDoc = readEvalJson();
    const jsonStr = JSON.stringify(diskDoc);
    expect(jsonStr).not.toContain("PES fidelity");
  });

  it("eval.json does not claim PLAYABLE_1V1_PASS", () => {
    const diskDoc = readEvalJson();
    const jsonStr = JSON.stringify(diskDoc);
    expect(jsonStr).not.toContain("PLAYABLE_1V1_PASS");
  });
});

// ---------------------------------------------------------------------------
// 6. Determinism: two live calls produce identical overall
// ---------------------------------------------------------------------------

describe("Evidence binding: determinism", () => {
  it("two live evaluateCapabilityDesign() calls produce the same overall", () => {
    const r1 = evaluateCapabilityDesign();
    const r2 = evaluateCapabilityDesign();
    expect(r1.overall).toBe(r2.overall);
  });

  it("eval.json overall matches both live calls", () => {
    const diskDoc = readEvalJson();
    const r1 = evaluateCapabilityDesign();
    const r2 = evaluateCapabilityDesign();
    expect(r1.overall).toBe(diskDoc.overall);
    expect(r2.overall).toBe(diskDoc.overall);
  });
});