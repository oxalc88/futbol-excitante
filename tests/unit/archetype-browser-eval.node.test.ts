/**
 * ARCHETYPE-BROWSER-CAPTURE evaluation verification (Node-side).
 *
 * Tests that the evaluator resolves correctly given committed disk
 * artifacts. The Three.js renderer does NOT differentiate archetypes,
 * so under identical conditions the frames are identical and the
 * honest verdict is FAIL (not PASS). The HEADLESS path remains
 * NOT_EVALUATED.
 *
 * Run after the browser capture test has written artifacts:
 *   npx tsx scripts/capture-archetype-browser-artifacts.ts
 *   pnpm run test -- tests/unit/archetype-browser-eval
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";

const EVIDENCE_DIR = "docs/evidence/ARCHETYPE-BROWSER-CAPTURE";
const TICK = 5;

describe("ARCHETYPE-BROWSER-CAPTURE evaluation (committed artifacts)", () => {
  it("committed artifact files exist on disk", () => {
    const archetypes = [
      "archetype-burst",
      "archetype-steady",
      "archetype-technical",
      "archetype-power",
      "archetype-agility",
    ];
    for (const base of archetypes) {
      const tickStr = TICK.toString().padStart(3, "0");
      expect(existsSync(`${EVIDENCE_DIR}/${base}-frame-${tickStr}.png`)).toBe(true);
      expect(existsSync(`${EVIDENCE_DIR}/${base}-frame-${tickStr}.meta.json`)).toBe(true);
    }
    expect(existsSync(`${EVIDENCE_DIR}/trajectory.json`)).toBe(true);
  });

  it("evaluateArchetypeComparison({useDiskArtifacts:true}) returns FAIL (identical frames)", async () => {
    const { evaluateArchetypeComparison } = await import(
      "../../eval/runners/archetype-comparison.js"
    );
    const result = evaluateArchetypeComparison({
      tick: TICK,
      useDiskArtifacts: true,
    });

    // Committed artifacts exist, so verdict is NOT not NOT_EVALUATED.
    // The Three.js renderer does not differentiate archetypes, so all
    // frames are identical and the honest verdict is FAIL.
    expect(result.verdict).not.toBe("NOT_EVALUATED");
    expect(result.verdict).toBe("FAIL");
    expect(result.pairs.length).toBeGreaterThan(0);
    for (const pair of result.pairs) {
      expect(pair.hash_a).not.toBe("");
      expect(pair.hash_b).not.toBe("");
      expect(pair.detectable).toBe(false);
    }
  });

  it("evaluateArchetypeComparison({useDiskArtifacts:false}) returns NOT_EVALUATED", async () => {
    const { evaluateArchetypeComparison } = await import(
      "../../eval/runners/archetype-comparison.js"
    );
    const result = evaluateArchetypeComparison({
      tick: TICK,
      useDiskArtifacts: false,
    });
    expect(result.verdict).toBe("NOT_EVALUATED");
  });

  it("runArchDiff001({useDiskArtifacts:true}) returns FAIL or NEEDS_PERCEPTUAL_REVIEW", async () => {
    const { runArchDiff001 } = await import(
      "../../eval/runners/arch-diff-001-evaluator.js"
    );
    const result = runArchDiff001({
      tick: TICK,
      useDiskArtifacts: true,
    });
    // With identical frames, visual-model-diff dimension fails → FAIL or NEEDS_PERCEPTUAL_REVIEW.
    // Must NOT be a theatrical PASS.
    expect(result.verdict).not.toBe("PASS");
  });

  it("runArchDiff001({useDiskArtifacts:false}) returns NEEDS_PERCEPTUAL_REVIEW", async () => {
    const { runArchDiff001 } = await import(
      "../../eval/runners/arch-diff-001-evaluator.js"
    );
    const result = runArchDiff001({
      tick: TICK,
      useDiskArtifacts: false,
    });
    expect(result.verdict).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });
});
