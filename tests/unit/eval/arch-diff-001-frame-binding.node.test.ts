/**
 * @module tests/unit/eval/arch-diff-001-frame-binding
 *
 * Tests that ARCH-DIFF-001 evaluation is wired to the versioned rubric
 * via runArchDiff001 with committed recapture artifacts, producing an
 * honest PASS/FAIL/NEEDS_PERCEPTUAL_REVIEW result instead of the prior
 * hardcoded NEEDS_PERCEPTUAL_REVIEW in validateBrowserCasesFor1v1.
 *
 * Evidence class: HEADLESS
 *
 *  1. runArchDiff001 with disk artifacts loads from recapture directory.
 *  2. With recaptured artifacts, the verdict reflects the rubric result.
 *  3. Without artifacts, the verdict is NEEDS_PERCEPTUAL_REVIEW.
 *  4. No theatrical PASS when evidence is absent.
 *  5. No PES fidelity claims.
 *  6. The evaluator is wired into evaluatePlayable1v1 (browser case path).
 *
 * Node I/O is allowed in tests.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// 1. runArchDiff001 loads from recapture directory
// ---------------------------------------------------------------------------

describe("runArchDiff001: disk artifact loading", () => {
  it("loads burst perceptual hash from recapture dir", async () => {
    const { runArchDiff001 } = await import(
      "../../../eval/runners/arch-diff-001-evaluator.js"
    );
    const result = runArchDiff001({ useDiskArtifacts: true });
    // The recaptured burst and steady frames have distinct hashes.
    // At least one dimension should have a non-zero score.
    const visualDim = result.dimensions.find(
      (d) => d.dimension_id === "visual-model-difference",
    );
    expect(visualDim).toBeDefined();
    expect(visualDim!.score).toBeGreaterThan(0);
  });

  it("state-congruence dimension has non-zero score", async () => {
    const { runArchDiff001 } = await import(
      "../../../eval/runners/arch-diff-001-evaluator.js"
    );
    const result = runArchDiff001({ useDiskArtifacts: true });
    const stateDim = result.dimensions.find(
      (d) => d.dimension_id === "state-congruence",
    );
    expect(stateDim).toBeDefined();
    expect(stateDim!.score).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. With recaptured artifacts, verdict reflects rubric evaluation
// ---------------------------------------------------------------------------

describe("runArchDiff001: honest verdict with recapture artifacts", () => {
  it("verdict is PASS when recaptured artifacts exist (burst vs steady differ)", async () => {
    const { runArchDiff001 } = await import(
      "../../../eval/runners/arch-diff-001-evaluator.js"
    );
    const result = runArchDiff001({ useDiskArtifacts: true });
    // The recaptured frames in ARCHETYPE-FULL-PAIR-RECAPTURE produce
    // distinct perceptual hashes (~93.75% diff ratio), so the honest
    // rubric verdict is PASS.
    expect(result.verdict).toBe("PASS");
    expect(result.allHardPass).toBe(true);
  });

  it("verdict is NOT NOT_EVALUATED when artifacts exist", async () => {
    const { runArchDiff001 } = await import(
      "../../../eval/runners/arch-diff-001-evaluator.js"
    );
    const result = runArchDiff001({ useDiskArtifacts: true });
    expect(result.verdict).not.toBe("NOT_EVALUATED");
  });

  it("verdict is NOT INVALID_RUN when artifacts exist", async () => {
    const { runArchDiff001 } = await import(
      "../../../eval/runners/arch-diff-001-evaluator.js"
    );
    const result = runArchDiff001({ useDiskArtifacts: true });
    expect(result.verdict).not.toBe("INVALID_RUN");
  });

  it("includes rationale referencing the archetype pair", async () => {
    const { runArchDiff001 } = await import(
      "../../../eval/runners/arch-diff-001-evaluator.js"
    );
    const result = runArchDiff001({ useDiskArtifacts: true });
    expect(result.rationale).toContain("archetype-burst-v1");
    expect(result.rationale).toContain("archetype-steady-v1");
  });
});

// ---------------------------------------------------------------------------
// 3. Without artifacts, verdict is NEEDS_PERCEPTUAL_REVIEW
// ---------------------------------------------------------------------------

describe("runArchDiff001: fallback when no artifacts", () => {
  it("verdict is NEEDS_PERCEPTUAL_REVIEW when no disk artifacts exist", async () => {
    const { runArchDiff001 } = await import(
      "../../../eval/runners/arch-diff-001-evaluator.js"
    );
    const noEvidenceResult = runArchDiff001({ useDiskArtifacts: false });
    expect(noEvidenceResult.verdict).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });
});

// ---------------------------------------------------------------------------
// 4. No theatrical PASS
// ---------------------------------------------------------------------------

describe("No theatrical PASS", () => {
  it("HEADLESS evaluation does not produce PASS", async () => {
    const { runArchDiff001 } = await import(
      "../../../eval/runners/arch-diff-001-evaluator.js"
    );
    // Without disk artifacts, the evaluator must NOT return PASS.
    const result = runArchDiff001();
    expect(result.verdict).not.toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 5. No PES fidelity claims
// ---------------------------------------------------------------------------

describe("No PES claims in validated result", () => {
  it("verdict rationale does not claim PES fidelity", async () => {
    const { runArchDiff001 } = await import(
      "../../../eval/runners/arch-diff-001-evaluator.js"
    );
    const result = runArchDiff001({ useDiskArtifacts: true });
    const pesTerms = [
      "PES fidelity",
      "PES match",
      "PES 2017",
      "FOUNDATION_LAB_PASS",
    ];
    for (const term of pesTerms) {
      expect(
        result.rationale.toLowerCase().includes(term.toLowerCase()),
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. evaluatePlayable1v1 uses the wired evaluator
// ---------------------------------------------------------------------------

describe("evaluatePlayable1v1: ARCH-DIFF-001 wired into browser case verdict", () => {
  it("ARCH-DIFF-001 browser case verdict reflects the rubric result", async () => {
    const { evaluatePlayable1v1 } = await import(
      "../../../eval/runners/playable-evaluator.js"
    );
    const { loadRegistrySet } = await import(
      "../../../eval/contracts/loader.js"
    );
    // We need a valid scenario for evaluatePlayable1v1. Use a minimal
    // scenario from the fixtures.
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const scenario = JSON.parse(
      readFileSync(
        join(__dirname, "../../../eval/scenarios/archetype-burst-steady-diff.v1.json"),
        "utf-8",
      ),
    );
    const result = evaluatePlayable1v1(scenario as any);
    const archCase = result.browserCaseVerdicts.find(
      (v) => v.case_id === "ARCH-DIFF-001",
    );
    // The wired evaluator should produce an honest verdict based on
    // the recapture artifacts, not the old hardcoded NEEDS_PERCEPTUAL_REVIEW.
    expect(archCase).toBeDefined();
    // With the recapture dir now in the search path, the verdict is PASS.
    expect(archCase!.verdict).toBe("PASS");
  });
});