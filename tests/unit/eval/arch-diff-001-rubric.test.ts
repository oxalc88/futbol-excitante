/**
 * @module tests/unit/eval/arch-diff-001-rubric
 *
 * Tests for the ARCH-DIFF-001 perceptual rubric and evaluation engine.
 *
 * Tests:
 *  1. Rubric versioning and completeness.
 *  2. Criterion dimensions are well-defined.
 *  3. buildArchDiffRubric produces correct structure.
 *  4. evaluateDimension scores correctly.
 *  5. Reduction: all HARD pass → PASS.
 *  6. Reduction: one HARD fail → FAIL.
 *  7. Reduction: any score 0 → NEEDS_PERCEPTUAL_REVIEW.
 *  8. compareGameFrames structural integrity checks.
 *  9. compareGameFrames hash diff ratio computation.
 *  10. compareGameFrames confidence computation.
 *  11. evaluateArchDiff001 full pipeline.
 *  12. evaluateArchDiff001NoEvidence returns NEEDS_PERCEPTUAL_REVIEW.
 *  13. runArchDiff001 HEADLESS path returns NEEDS_PERCEPTUAL_REVIEW.
 *  14. No PES fidelity claims in rubric or evaluation.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";

import {
  ARCH_DIFF_RUBRIC_META,
  ARCH_DIFF_CRITERIA,
  buildArchDiffRubric,
  evaluateDimension,
  reduceArchDiffResult,
  DETECTABILITY_THRESHOLD,
  CONFIDENCE_THRESHOLD,
  type ArchDiffCriterion,
  type DimensionResult,
} from "../../../eval/contracts/arch-diff-001-rubric.js";

import {
  compareGameFrames,
  evaluateArchDiff001,
  evaluateArchDiff001NoEvidence,
  runArchDiff001,
  generateDeterministicStateHash,
  type GameFrameSnapshot,
  type ArchDiffComparison,
} from "../../../eval/runners/arch-diff-001-evaluator.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal GameFrameSnapshot for testing.
 */
function makeSnapshot(
  frameId: string,
  perceptualHash: string,
  stateHash: string,
  tick: number = 5,
  width: number = 320,
  height: number = 180,
  expectedFeatures: string[] = [],
): GameFrameSnapshot {
  return {
    frameId,
    perceptualHash,
    stateHash,
    tick,
    width,
    height,
    expectedFeatures,
  };
}

/**
 * Create a DimensionResult for testing reduceArchDiffResult.
 */
function makeDimensionResult(
  dimensionId: string,
  score: number,
  severity: "HARD" | "SOFT" = "HARD",
  evidenceAvailable: boolean = true,
): DimensionResult {
  const criteria = ARCH_DIFF_CRITERIA.find(
    (c) => c.dimension_id === dimensionId,
  );
  return {
    dimension_id: dimensionId,
    score,
    threshold: criteria?.pass_threshold ?? 0,
    pass: score >= (criteria?.pass_threshold ?? 0),
    severity,
    evidenceAvailable,
  };
}

// ---------------------------------------------------------------------------
// 1. Rubric versioning and completeness
// ---------------------------------------------------------------------------

describe("Rubric versioning", () => {
  it("ARCH_DIFF_RUBRIC_META has profile_version", () => {
    expect(ARCH_DIFF_RUBRIC_META.profile_version).toBe(
      "arch-diff-001-rubric-v1",
    );
  });

  it("profile_version string is versioned (contains v1)", () => {
    expect(ARCH_DIFF_RUBRIC_META.profile_version).toMatch(/v\d+$/);
  });

  it("ARCH_DIFF_RUBRIC_META has a non-empty description", () => {
    expect(ARCH_DIFF_RUBRIC_META.description.length).toBeGreaterThan(0);
  });

  it("ARCH_DIFF_CRITERIA is non-empty", () => {
    expect(ARCH_DIFF_CRITERIA.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Criterion dimensions are well-defined
// ---------------------------------------------------------------------------

describe("Criterion dimensions", () => {
  it("has structural-integrity dimension", () => {
    const dim = ARCH_DIFF_CRITERIA.find(
      (c) => c.dimension_id === "structural-integrity",
    );
    expect(dim).toBeDefined();
    expect(dim?.pass_threshold).toBe(1.0);
    expect(dim?.severity).toBe("HARD");
  });

  it("has visual-model-difference dimension", () => {
    const dim = ARCH_DIFF_CRITERIA.find(
      (c) => c.dimension_id === "visual-model-difference",
    );
    expect(dim).toBeDefined();
    expect(dim?.pass_threshold).toBe(DETECTABILITY_THRESHOLD);
    expect(dim?.severity).toBe("HARD");
  });

  it("has state-congruence dimension", () => {
    const dim = ARCH_DIFF_CRITERIA.find(
      (c) => c.dimension_id === "state-congruence",
    );
    expect(dim).toBeDefined();
    expect(dim?.pass_threshold).toBeGreaterThan(0);
    expect(dim?.severity).toBe("HARD");
  });

  it("has confidence dimension", () => {
    const dim = ARCH_DIFF_CRITERIA.find(
      (c) => c.dimension_id === "confidence",
    );
    expect(dim).toBeDefined();
    expect(dim?.pass_threshold).toBe(CONFIDENCE_THRESHOLD);
    expect(dim?.severity).toBe("SOFT");
  });

  it("each criterion has a non-empty description", () => {
    for (const c of ARCH_DIFF_CRITERIA) {
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  it("each criterion has a valid severity", () => {
    for (const c of ARCH_DIFF_CRITERIA) {
      expect(["HARD", "SOFT"]).toContain(c.severity);
    }
  });

  it("each criterion has a threshold between 0 and 1", () => {
    for (const c of ARCH_DIFF_CRITERIA) {
      expect(c.pass_threshold).toBeGreaterThanOrEqual(0);
      expect(c.pass_threshold).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. buildArchDiffRubric produces correct structure
// ---------------------------------------------------------------------------

describe("buildArchDiffRubric", () => {
  it("returns a rubric with correct version", () => {
    const rubric = buildArchDiffRubric("archetype-burst-v1", "archetype-steady-v1");
    expect(rubric.version).toBe("arch-diff-001-rubric-v1");
  });

  it("includes all criteria", () => {
    const rubric = buildArchDiffRubric("a", "b");
    expect(rubric.criteria.length).toBe(ARCH_DIFF_CRITERIA.length);
  });

  it("stores pair_reference correctly", () => {
    const rubric = buildArchDiffRubric("archetype-burst-v1", "archetype-steady-v1");
    expect(rubric.pair_reference.archetype_a).toBe("archetype-burst-v1");
    expect(rubric.pair_reference.archetype_b).toBe("archetype-steady-v1");
  });

  it("criteria match the canonical ARCH_DIFF_CRITERIA", () => {
    const rubric = buildArchDiffRubric("a", "b");
    for (let i = 0; i < rubric.criteria.length; i++) {
      expect(rubric.criteria[i].dimension_id).toBe(
        ARCH_DIFF_CRITERIA[i].dimension_id,
      );
      expect(rubric.criteria[i].pass_threshold).toBe(
        ARCH_DIFF_CRITERIA[i].pass_threshold,
      );
      expect(rubric.criteria[i].severity).toBe(ARCH_DIFF_CRITERIA[i].severity);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. evaluateDimension scores correctly
// ---------------------------------------------------------------------------

describe("evaluateDimension", () => {
  const structuralCriterion = ARCH_DIFF_CRITERIA[0];

  it("score >= threshold → pass", () => {
    const result = evaluateDimension(structuralCriterion, 1.0);
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1.0);
    expect(result.threshold).toBe(1.0);
  });

  it("score < threshold → not pass", () => {
    const result = evaluateDimension(structuralCriterion, 0.0);
    expect(result.pass).toBe(false);
  });

  it("score at threshold → pass (inclusive)", () => {
    const result = evaluateDimension(structuralCriterion, 1.0);
    expect(result.pass).toBe(true);
  });

  it("preserves severity from criterion", () => {
    const result = evaluateDimension(structuralCriterion, 0.5);
    expect(result.severity).toBe("HARD");
  });
});

// ---------------------------------------------------------------------------
// 5. Reduction: all HARD pass → PASS
// ---------------------------------------------------------------------------

describe("Reduction: all HARD pass", () => {
  it("all dimensions pass → PASS", () => {
    const dimensions = ARCH_DIFF_CRITERIA.map((c) =>
      evaluateDimension(c, c.pass_threshold),
    );
    const result = reduceArchDiffResult(
      dimensions,
      { archetype_a: "a", archetype_b: "b" },
    );
    expect(result.verdict).toBe("PASS");
    expect(result.allHardPass).toBe(true);
    expect(result.rubric_version).toBe("arch-diff-001-rubric-v1");
  });

  it("above-threshold scores → PASS", () => {
    const dimensions: DimensionResult[] = [
      {
        dimension_id: "structural-integrity",
        score: 1.0,
        threshold: 1.0,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "visual-model-difference",
        score: 0.5,
        threshold: 0.1,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "state-congruence",
        score: 0.2,
        threshold: 0.05,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "confidence",
        score: 0.8,
        threshold: 0.5,
        pass: true,
        severity: "SOFT",
        evidenceAvailable: true,
      },
    ];
    const result = reduceArchDiffResult(dimensions, {
      archetype_a: "archetype-burst-v1",
      archetype_b: "archetype-steady-v1",
    });
    expect(result.verdict).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 6. Reduction: one HARD fail → FAIL
// ---------------------------------------------------------------------------

describe("Reduction: one HARD fail", () => {
  it("structural-integrity fails → FAIL", () => {
    const dimensions: DimensionResult[] = [
      {
        dimension_id: "structural-integrity",
        score: 0,
        threshold: 1.0,
        pass: false,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "visual-model-difference",
        score: 0.5,
        threshold: 0.1,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "state-congruence",
        score: 0.2,
        threshold: 0.05,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "confidence",
        score: 0.8,
        threshold: 0.5,
        pass: true,
        severity: "SOFT",
        evidenceAvailable: true,
      },
    ];
    const result = reduceArchDiffResult(dimensions, {
      archetype_a: "a",
      archetype_b: "b",
    });
    expect(result.verdict).toBe("FAIL");
    expect(result.allHardPass).toBe(false);
  });

  it("visual-model-difference below threshold → FAIL", () => {
    const dimensions: DimensionResult[] = [
      {
        dimension_id: "structural-integrity",
        score: 1.0,
        threshold: 1.0,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "visual-model-difference",
        score: 0.05,
        threshold: 0.1,
        pass: false,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "state-congruence",
        score: 0.2,
        threshold: 0.05,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "confidence",
        score: 0.8,
        threshold: 0.5,
        pass: true,
        severity: "SOFT",
        evidenceAvailable: true,
      },
    ];
    const result = reduceArchDiffResult(dimensions, { archetype_a: "a", archetype_b: "b" });
    expect(result.verdict).toBe("FAIL");
  });

  it("rationale mentions failed dimensions", () => {
    const dimensions: DimensionResult[] = [
      {
        dimension_id: "structural-integrity",
        score: 1.0,
        threshold: 1.0,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "visual-model-difference",
        score: 0.05,
        threshold: 0.1,
        pass: false,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "state-congruence",
        score: 0.2,
        threshold: 0.05,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "confidence",
        score: 0.8,
        threshold: 0.5,
        pass: true,
        severity: "SOFT",
        evidenceAvailable: true,
      },
    ];
    const result = reduceArchDiffResult(dimensions, {
      archetype_a: "archetype-burst-v1",
      archetype_b: "archetype-steady-v1",
    });
    expect(result.rationale).toContain("visual-model-difference");
    expect(result.rationale).toContain("archetype-burst-v1");
  });
});

// ---------------------------------------------------------------------------
// 7. Reduction: evidence unavailable → NEEDS_PERCEPTUAL_REVIEW
// ---------------------------------------------------------------------------

describe("Reduction: missing evidence", () => {
  it("any dimension with evidenceAvailable=false → NEEDS_PERCEPTUAL_REVIEW", () => {
    const dimensions: DimensionResult[] = [
      {
        dimension_id: "structural-integrity",
        score: 1.0,
        threshold: 1.0,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "visual-model-difference",
        score: 0,
        threshold: 0.1,
        pass: false,
        severity: "HARD",
        evidenceAvailable: false,
      },
      {
        dimension_id: "state-congruence",
        score: 0.2,
        threshold: 0.05,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "confidence",
        score: 0.8,
        threshold: 0.5,
        pass: true,
        severity: "SOFT",
        evidenceAvailable: true,
      },
    ];
    const result = reduceArchDiffResult(dimensions, { archetype_a: "a", archetype_b: "b" });
    expect(result.verdict).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });

  it("rationale mentions missing evidence", () => {
    const dimensions: DimensionResult[] = ARCH_DIFF_CRITERIA.map((c) => ({
      dimension_id: c.dimension_id,
      score: 0,
      threshold: c.pass_threshold,
      pass: false,
      severity: c.severity,
      evidenceAvailable: false,
    }));
    const result = reduceArchDiffResult(dimensions, { archetype_a: "a", archetype_b: "b" });
    expect(result.verdict).toBe("NEEDS_PERCEPTUAL_REVIEW");
    expect(result.rationale).toContain("missing evidence");
  });

  it("score 0 with evidenceAvailable=true → valid measurement (not NEEDS_PERCEPTUAL_REVIEW)", () => {
    const dimensions: DimensionResult[] = [
      {
        dimension_id: "structural-integrity",
        score: 1.0,
        threshold: 1.0,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "visual-model-difference",
        score: 0,
        threshold: 0.1,
        pass: false,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "state-congruence",
        score: 0.2,
        threshold: 0.05,
        pass: true,
        severity: "HARD",
        evidenceAvailable: true,
      },
      {
        dimension_id: "confidence",
        score: 0.8,
        threshold: 0.5,
        pass: true,
        severity: "SOFT",
        evidenceAvailable: true,
      },
    ];
    // Score 0 is a valid measurement; verdict should be FAIL (HARD failed), not NEEDS_PERCEPTUAL_REVIEW.
    const result = reduceArchDiffResult(dimensions, { archetype_a: "a", archetype_b: "b" });
    expect(result.verdict).toBe("FAIL");
  });
});

// ---------------------------------------------------------------------------
// 8. compareGameFrames structural integrity checks
// ---------------------------------------------------------------------------

describe("compareGameFrames: structural integrity", () => {
  it("valid frames → structuralIntegrity true", () => {
    const frameA = makeSnapshot("a", "abc", "state-a");
    const frameB = makeSnapshot("b", "def", "state-b");
    const result = compareGameFrames(frameA, frameB);
    expect(result.structuralIntegrity).toBe(true);
  });

  it("same frameId → structuralIntegrity false", () => {
    const frameA = makeSnapshot("same", "abc", "state-a");
    const frameB = makeSnapshot("same", "def", "state-b");
    const result = compareGameFrames(frameA, frameB);
    expect(result.structuralIntegrity).toBe(false);
  });

  it("mismatched dimensions → structuralIntegrity false", () => {
    const frameA = makeSnapshot("a", "abc", "state-a", 5, 320, 180);
    const frameB = makeSnapshot("b", "def", "state-b", 5, 640, 360);
    const result = compareGameFrames(frameA, frameB);
    expect(result.structuralIntegrity).toBe(false);
  });

  it("empty perceptualHash → structuralIntegrity false", () => {
    const frameA = makeSnapshot("a", "", "state-a");
    const frameB = makeSnapshot("b", "def", "state-b");
    const result = compareGameFrames(frameA, frameB);
    expect(result.structuralIntegrity).toBe(false);
  });

  it("negative tick → structuralIntegrity false", () => {
    const frameA = makeSnapshot("a", "abc", "state-a", -1);
    const frameB = makeSnapshot("b", "def", "state-b", 5);
    const result = compareGameFrames(frameA, frameB);
    expect(result.structuralIntegrity).toBe(false);
  });

  it("returns all required fields", () => {
    const frameA = makeSnapshot("a", "abc", "state-a");
    const frameB = makeSnapshot("b", "def", "state-b");
    const result = compareGameFrames(frameA, frameB);
    expect(result).toHaveProperty("frameAId");
    expect(result).toHaveProperty("frameBId");
    expect(result).toHaveProperty("structuralIntegrity");
    expect(result).toHaveProperty("hashDiffRatio");
    expect(result).toHaveProperty("stateDiffRatio");
    expect(result).toHaveProperty("confidence");
  });
});

// ---------------------------------------------------------------------------
// 9. compareGameFrames hash diff ratio computation
// ---------------------------------------------------------------------------

describe("compareGameFrames: hash diff ratio", () => {
  it("identical perceptual hashes → diff ratio 0", () => {
    const frameA = makeSnapshot("a", "abc123", "state-a");
    const frameB = makeSnapshot("b", "abc123", "state-b");
    const result = compareGameFrames(frameA, frameB);
    expect(result.hashDiffRatio).toBe(0);
  });

  it("completely different hashes → diff ratio 1", () => {
    const frameA = makeSnapshot("a", "0000", "state-a");
    const frameB = makeSnapshot("b", "ffff", "state-b");
    const result = compareGameFrames(frameA, frameB);
    expect(result.hashDiffRatio).toBe(1);
  });

  it("different state hashes → stateDiffRatio > 0", () => {
    const frameA = makeSnapshot("a", "abc", "state-a");
    const frameB = makeSnapshot("b", "def", "state-b");
    const result = compareGameFrames(frameA, frameB);
    expect(result.stateDiffRatio).toBeGreaterThan(0);
  });

  it("same state hashes → stateDiffRatio 0", () => {
    const frameA = makeSnapshot("a", "abc", "state-a");
    const frameB = makeSnapshot("b", "def", "state-a");
    const result = compareGameFrames(frameA, frameB);
    expect(result.stateDiffRatio).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 10. compareGameFrames confidence computation
// ---------------------------------------------------------------------------

describe("compareGameFrames: confidence", () => {
  it("high diff ratio and features → high confidence", () => {
    const frameA = makeSnapshot("a", "0000", "state-a", 5, 320, 180, [
      "feature1",
      "feature2",
      "feature3",
    ]);
    const frameB = makeSnapshot("b", "ffff", "state-b", 5, 320, 180, [
      "feature1",
      "feature2",
      "feature3",
    ]);
    const result = compareGameFrames(frameA, frameB);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("zero diff ratio → low confidence", () => {
    const frameA = makeSnapshot("a", "abc", "state-a");
    const frameB = makeSnapshot("b", "abc", "state-b");
    const result = compareGameFrames(frameA, frameB);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("confidence is a number between 0 and 1", () => {
    const frameA = makeSnapshot("a", "0000", "state-a");
    const frameB = makeSnapshot("b", "ffff", "state-b");
    const result = compareGameFrames(frameA, frameB);
    expect(typeof result.confidence).toBe("number");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 11. evaluateArchDiff001 full pipeline
// ---------------------------------------------------------------------------

describe("evaluateArchDiff001", () => {
  it("PASS when all dimensions pass", () => {
    const frameA = makeSnapshot("burst", "0000", "state-a", 5, 320, 180, [
      "feature1",
      "feature2",
    ]);
    const frameB = makeSnapshot("steady", "ffff", "state-b", 5, 320, 180, [
      "feature1",
      "feature2",
    ]);
    const result = evaluateArchDiff001(frameA, frameB);
    expect(result.verdict).toBe("PASS");
    expect(result.allHardPass).toBe(true);
    expect(result.dimensions.length).toBe(4);
  });

  it("NEEDS_PERCEPTUAL_REVIEW when frames are identical", () => {
    const frameA = makeSnapshot("same", "abc", "state-a");
    const frameB = makeSnapshot("same", "abc", "state-a");
    const result = evaluateArchDiff001(frameA, frameB);
    expect(result.verdict).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });

  it("FAIL when perceptual hashes are identical but state differs", () => {
    const frameA = makeSnapshot("a", "abc", "state-a");
    const frameB = makeSnapshot("b", "abc", "state-b");
    const result = evaluateArchDiff001(frameA, frameB);
    // visual-model-dimension scores 0 (identical hashes) — this is a valid measurement,
    // so the verdict is FAIL (HARD dimension failed), not NEEDS_PERCEPTUAL_REVIEW.
    expect(result.dimensions[1].score).toBe(0); // visual-model-difference
    expect(result.verdict).toBe("FAIL");
  });

  it("includes rationale in result", () => {
    const frameA = makeSnapshot("burst", "0000", "state-a", 5, 320, 180, [
      "feature1",
    ]);
    const frameB = makeSnapshot("steady", "ffff", "state-b", 5, 320, 180, [
      "feature1",
    ]);
    const result = evaluateArchDiff001(frameA, frameB);
    expect(typeof result.rationale).toBe("string");
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it("uses custom rubric when provided", () => {
    const frameA = makeSnapshot("a", "0000", "state-a");
    const frameB = makeSnapshot("b", "ffff", "state-b");
    const customRubric = buildArchDiffRubric("custom-a", "custom-b");
    const result = evaluateArchDiff001(frameA, frameB, customRubric);
    expect(result.rubric_version).toBe("arch-diff-001-rubric-v1");
  });
});

// ---------------------------------------------------------------------------
// 12. evaluateArchDiff001NoEvidence returns NEEDS_PERCEPTUAL_REVIEW
// ---------------------------------------------------------------------------

describe("evaluateArchDiff001NoEvidence", () => {
  it("returns NEEDS_PERCEPTUAL_REVIEW", () => {
    const result = evaluateArchDiff001NoEvidence(
      "archetype-burst-v1",
      "archetype-steady-v1",
    );
    expect(result.verdict).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });

  it("all dimensions have score 0", () => {
    const result = evaluateArchDiff001NoEvidence("a", "b");
    for (const dim of result.dimensions) {
      expect(dim.score).toBe(0);
      expect(dim.pass).toBe(false);
    }
  });

  it("stores correct pair_reference", () => {
    const result = evaluateArchDiff001NoEvidence("archetype-burst-v1", "archetype-steady-v1");
    expect(result.rationale).toContain("archetype-burst-v1");
    expect(result.rationale).toContain("archetype-steady-v1");
  });
});

// ---------------------------------------------------------------------------
// 13. runArchDiff001 HEADLESS path returns NEEDS_PERCEPTUAL_REVIEW
// ---------------------------------------------------------------------------

describe("runArchDiff001", () => {
  it("HEADLESS (no disk artifacts) → NEEDS_PERCEPTUAL_REVIEW", () => {
    const result = runArchDiff001();
    expect(result.verdict).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });

  it("HEADLESS with explicit useDiskArtifacts=false → NEEDS_PERCEPTUAL_REVIEW", () => {
    const result = runArchDiff001({ useDiskArtifacts: false });
    expect(result.verdict).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });

  it("HEADLESS result has correct structure", () => {
    const result = runArchDiff001();
    expect(result).toHaveProperty("rubric_version");
    expect(result).toHaveProperty("dimensions");
    expect(result).toHaveProperty("allHardPass");
    expect(result).toHaveProperty("verdict");
    expect(result).toHaveProperty("rationale");
    expect(result.rubric_version).toBe("arch-diff-001-rubric-v1");
  });

  it("HEADLESS all dimensions have score 0", () => {
    const result = runArchDiff001();
    for (const dim of result.dimensions) {
      expect(dim.score).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 14. No PES fidelity claims in rubric or evaluation
// ---------------------------------------------------------------------------

describe("No PES claims", () => {
  const pesTerms = [
    "PES fidelity",
    "PES match",
    "PES 2017",
    "FOUNDATION_LAB_PASS",
  ];

  it("ARCH_DIFF_RUBRIC_META description does not claim PES fidelity", () => {
    for (const term of pesTerms) {
      expect(
        ARCH_DIFF_RUBRIC_META.description.toLowerCase().includes(
          term.toLowerCase(),
        ),
      ).toBe(false);
    }
  });

  it("ARCH_DIFF_CRITERIA descriptions do not claim PES fidelity", () => {
    for (const c of ARCH_DIFF_CRITERIA) {
      for (const term of pesTerms) {
        expect(
          c.description.toLowerCase().includes(term.toLowerCase()),
          `description should not contain "${term}": ${c.description}`,
        ).toBe(false);
      }
    }
  });

  it("evaluateArchDiff001NoEvidence rationale does not claim PES fidelity", () => {
    const result = evaluateArchDiff001NoEvidence("a", "b");
    for (const term of pesTerms) {
      expect(
        result.rationale.toLowerCase().includes(term.toLowerCase()),
      ).toBe(false);
    }
  });

  it("runArchDiff001 HEADLESS rationale does not claim PES fidelity", () => {
    const result = runArchDiff001();
    for (const term of pesTerms) {
      expect(
        result.rationale.toLowerCase().includes(term.toLowerCase()),
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 15. generateDeterministicStateHash produces unique hashes
// ---------------------------------------------------------------------------

describe("generateDeterministicStateHash", () => {
  it("same archetype + tick → same hash (deterministic)", () => {
    const h1 = generateDeterministicStateHash("archetype-burst-v1", 5);
    const h2 = generateDeterministicStateHash("archetype-burst-v1", 5);
    expect(h1).toBe(h2);
  });

  it("different ticks → different hash", () => {
    const h1 = generateDeterministicStateHash("archetype-burst-v1", 5);
    const h2 = generateDeterministicStateHash("archetype-burst-v1", 10);
    expect(h1).not.toBe(h2);
  });

  it("different archetypes → different hash", () => {
    const h1 = generateDeterministicStateHash("archetype-burst-v1", 5);
    const h2 = generateDeterministicStateHash("archetype-steady-v1", 5);
    expect(h1).not.toBe(h2);
  });

  it("hash is non-empty hex string", () => {
    const h = generateDeterministicStateHash("archetype-burst-v1", 5);
    expect(h.length).toBeGreaterThan(0);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it("hash is SHA-256 length (64 hex chars)", () => {
    const h = generateDeterministicStateHash("archetype-burst-v1", 5);
    expect(h.length).toBe(64);
  });
});