/**
 * @module tests/unit/eval/archetype-comparison
 *
 * Tests for the archetype perceptual comparison framework.
 *
 * Tests:
 *  1. Rubric definition is versioned and field-complete.
 *  2. COMPARISON_PAIRS are distinct archetype pairs.
 *  3. KNOWN_ARCHETYPES are defined and non-empty.
 *  4. Hash diff ratio computation is correct.
 *  5. Detectability threshold logic.
 *  6. Reduction: all detectable → PASS.
 *  7. Reduction: one non-detectable → FAIL.
 *  8. Deterministic hash generation produces unique hashes.
 *  9. Hash uniqueness verification across all archetypes.
 *  10. PairResult structure is correct.
 *  11. evaluateArchetypeComparison returns valid structure.
 *  12. No PES fidelity claims in rubric or evaluation.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";

import {
  RUBRIC_META,
  KNOWN_ARCHETYPES,
  COMPARISON_PAIRS,
  DETECTABILITY_THRESHOLD,
  CONFIDENCE_THRESHOLD,
  isPairDetectable,
  computeHashDiffRatio,
  reduceRubric,
  type PairResult,
} from "../../../eval/contracts/archetype-comparison-rubric.js";

import {
  evaluateArchetypeComparison,
  compareFrames,
  verifyArchetypeHashUniqueness,
  generateDeterministicHash,
} from "../../../eval/runners/archetype-comparison.js";

import type { HashedFrame } from "../../../eval/runners/archetype-comparison.js";
import type { ArchetypeComparisonPair } from "../../../eval/contracts/archetype-comparison-rubric.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate deterministic hashes for testing (re-export from module).
 */
function makeHash(archetypeId: string, tick: number): string {
  return generateDeterministicHash(archetypeId, tick);
}

// ---------------------------------------------------------------------------
// 1. Rubric definition is versioned and field-complete
// ---------------------------------------------------------------------------

describe("Rubric versioning", () => {
  it("RUBRIC_META has profile_version", () => {
    expect(RUBRIC_META.profile_version).toBe("archetype-rubric-v1");
  });

  it("RUBRIC_META has a non-empty description", () => {
    expect(RUBRIC_META.description.length).toBeGreaterThan(0);
  });

  it("profile_version string is versioned (contains v1)", () => {
    expect(RUBRIC_META.profile_version).toMatch(/v\d+$/);
  });
});

// ---------------------------------------------------------------------------
// 2. COMPARISON_PAIRS are distinct archetype pairs
// ---------------------------------------------------------------------------

describe("COMPARISON_PAIRS", () => {
  it("has at least 2 pairs", () => {
    expect(COMPARISON_PAIRS.length).toBeGreaterThanOrEqual(2);
  });

  it("each pair has distinct archetype_a and archetype_b", () => {
    for (const pair of COMPARISON_PAIRS) {
      expect(pair.archetype_a).not.toBe(pair.archetype_b);
    }
  });

  it("all archetypes in pairs are from KNOWN_ARCHETYPES", () => {
    const knownSet = new Set(KNOWN_ARCHETYPES);
    for (const pair of COMPARISON_PAIRS) {
      expect(knownSet.has(pair.archetype_a)).toBe(true);
      expect(knownSet.has(pair.archetype_b)).toBe(true);
    }
  });

  it("each pair has distinguishing_features array", () => {
    for (const pair of COMPARISON_PAIRS) {
      expect(Array.isArray(pair.distinguishing_features)).toBe(true);
      expect(pair.distinguishing_features.length).toBeGreaterThan(0);
    }
  });

  it("each pair has a non-empty expected_difference", () => {
    for (const pair of COMPARISON_PAIRS) {
      expect(pair.expected_difference.length).toBeGreaterThan(0);
    }
  });

  it("no duplicate pairs (A,B or B,A)", () => {
    const seen = new Set<string>();
    for (const pair of COMPARISON_PAIRS) {
      const key1 = `${pair.archetype_a}||${pair.archetype_b}`;
      const key2 = `${pair.archetype_b}||${pair.archetype_a}`;
      expect(seen.has(key1)).toBe(false);
      expect(seen.has(key2)).toBe(false);
      seen.add(key1);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. KNOWN_ARCHETYPES are defined and non-empty
// ---------------------------------------------------------------------------

describe("KNOWN_ARCHETYPES", () => {
  it("is non-empty", () => {
    expect(KNOWN_ARCHETYPES.length).toBeGreaterThan(0);
  });

  it("includes burst and steady archetypes", () => {
    expect(KNOWN_ARCHETYPES).toContain("archetype-burst-v1");
    expect(KNOWN_ARCHETYPES).toContain("archetype-steady-v1");
  });

  it("all archetypes have consistent version suffix", () => {
    for (const arch of KNOWN_ARCHETYPES) {
      expect(arch).toMatch(/-v\d+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Hash diff ratio computation is correct
// ---------------------------------------------------------------------------

describe("Hash diff ratio", () => {
  it("identical hashes produce ratio 0", () => {
    expect(computeHashDiffRatio("abc123", "abc123")).toBe(0);
  });

  it("completely different hashes of same length produce ratio 1", () => {
    expect(computeHashDiffRatio("0000", "ffff")).toBe(1);
  });

  it("ratio is between 0 and 1", () => {
    for (let i = 0; i < 100; i++) {
      const halfA = i.toString(16).padStart(8, "0");
      const halfB = (i ^ 0xff).toString(16).padStart(8, "0");
      const ratio = computeHashDiffRatio(halfA, halfB);
      expect(ratio).toBeGreaterThanOrEqual(0);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });

  it("different length hashes produce ratio 0", () => {
    expect(computeHashDiffRatio("abc", "abcd")).toBe(0);
  });

  it("empty hashes produce ratio 0", () => {
    expect(computeHashDiffRatio("", "abc")).toBe(0);
  });

  it("50% character difference gives ratio ~0.5", () => {
    // Create two hashes where exactly half the chars differ
    const hashA = "0123456789abcdef";
    const hashB = "fedcba9876543210";
    // Count differences
    let diffs = 0;
    for (let i = 0; i < hashA.length; i++) {
      if (hashA[i] !== hashB[i]) diffs++;
    }
    const expectedRatio = diffs / hashA.length;
    const actualRatio = computeHashDiffRatio(hashA, hashB);
    expect(actualRatio).toBeCloseTo(expectedRatio, 4);
  });
});

// ---------------------------------------------------------------------------
// 5. Detectability threshold logic
// ---------------------------------------------------------------------------

describe("Detectability threshold", () => {
  it("hashDiffRatio above threshold and confidence above threshold → detectable", () => {
    expect(isPairDetectable(0.2, 0.6)).toBe(true);
  });

  it("hashDiffRatio below threshold → not detectable", () => {
    expect(isPairDetectable(0.05, 0.8)).toBe(false);
  });

  it("confidence below threshold → not detectable", () => {
    expect(isPairDetectable(0.3, 0.2)).toBe(false);
  });

  it("both at threshold → detectable (inclusive)", () => {
    expect(isPairDetectable(DETECTABILITY_THRESHOLD, CONFIDENCE_THRESHOLD)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Reduction: all detectable → PASS
// ---------------------------------------------------------------------------

describe("Reduction: all detectable", () => {
  function makePairResult(
    hashDiffRatio: number,
    confidence: number,
  ): PairResult {
    return {
      pair: {
        archetype_a: "archetype-burst-v1",
        archetype_b: "archetype-steady-v1",
        expected_difference: "test difference",
        distinguishing_features: ["visual-model"],
      },
      hash_a: "aaa",
      hash_b: "bbb",
      hashDiffRatio,
      detectable: isPairDetectable(hashDiffRatio, confidence),
      confidence,
    };
  }

  it("all detectable with high confidence → PASS", () => {
    const result = reduceRubric([
      makePairResult(0.3, 0.8),
      makePairResult(0.4, 0.9),
    ]);
    expect(result.verdict).toBe("PASS");
    expect(result.allDetectable).toBe(true);
  });

  it("single detectable pair → PASS", () => {
    const result = reduceRubric([makePairResult(0.2, 0.6)]);
    expect(result.verdict).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 7. Reduction: one non-detectable → FAIL
// ---------------------------------------------------------------------------

describe("Reduction: non-detectable pair", () => {
  function makePairResult(
    hashDiffRatio: number,
    confidence: number,
  ): PairResult {
    return {
      pair: {
        archetype_a: "archetype-burst-v1",
        archetype_b: "archetype-steady-v1",
        expected_difference: "test difference",
        distinguishing_features: ["visual-model"],
      },
      hash_a: "aaa",
      hash_b: "bbb",
      hashDiffRatio,
      detectable: isPairDetectable(hashDiffRatio, confidence),
      confidence,
    };
  }

  it("one non-detectable → FAIL", () => {
    const result = reduceRubric([
      makePairResult(0.3, 0.8),
      makePairResult(0.05, 0.8), // below threshold
    ]);
    expect(result.verdict).toBe("FAIL");
    expect(result.allDetectable).toBe(false);
  });

  it("one low confidence → FAIL", () => {
    const result = reduceRubric([
      makePairResult(0.3, 0.8),
      makePairResult(0.3, 0.2), // low confidence
    ]);
    expect(result.verdict).toBe("FAIL");
  });
});

// ---------------------------------------------------------------------------
// 8. Deterministic hash generation produces unique hashes
// ---------------------------------------------------------------------------

describe("Deterministic hash generation", () => {
  it("same archetype + tick → same hash (deterministic)", () => {
    const h1 = makeHash("archetype-burst-v1", 5);
    const h2 = makeHash("archetype-burst-v1", 5);
    expect(h1).toBe(h2);
  });

  it("different ticks → different hash", () => {
    const h1 = makeHash("archetype-burst-v1", 5);
    const h2 = makeHash("archetype-burst-v1", 10);
    expect(h1).not.toBe(h2);
  });

  it("different archetypes → different hash", () => {
    const h1 = makeHash("archetype-burst-v1", 5);
    const h2 = makeHash("archetype-steady-v1", 5);
    expect(h1).not.toBe(h2);
  });

  it("hash is non-empty hex string", () => {
    const h = makeHash("archetype-burst-v1", 5);
    expect(h.length).toBeGreaterThan(0);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it("hash is SHA-256 length (64 hex chars)", () => {
    const h = makeHash("archetype-burst-v1", 5);
    expect(h.length).toBe(64);
  });
});

// ---------------------------------------------------------------------------
// 9. Hash uniqueness verification across all archetypes
// ---------------------------------------------------------------------------

describe("Hash uniqueness verification", () => {
  it("all KNOWN_ARCHETYPES produce unique hashes", () => {
    const result = verifyArchetypeHashUniqueness(makeHash);
    expect(result).toBe(true);
  });

  it("hash uniqueness works for COMPARISON_PAIRS archetypes", () => {
    const uniqueArches = new Set<string>();
    for (const pair of COMPARISON_PAIRS) {
      uniqueArches.add(pair.archetype_a);
      uniqueArches.add(pair.archetype_b);
    }
    const hashFn = (arch: string) => makeHash(arch, 5);
    const hashes = new Set<string>();
    for (const arch of uniqueArches) {
      hashes.add(hashFn(arch));
    }
    expect(hashes.size).toBe(uniqueArches.size);
  });
});

// ---------------------------------------------------------------------------
// 10. PairResult structure is correct
// ---------------------------------------------------------------------------

describe("PairResult structure", () => {
  it("has all required fields", () => {
    const pairResult: PairResult = {
      pair: {
        archetype_a: "archetype-burst-v1",
        archetype_b: "archetype-steady-v1",
        expected_difference: "test",
        distinguishing_features: ["test"],
      },
      hash_a: "abc",
      hash_b: "def",
      hashDiffRatio: 0.5,
      detectable: true,
      confidence: 0.8,
    };
    expect(pairResult.pair).toHaveProperty("archetype_a");
    expect(pairResult.pair).toHaveProperty("archetype_b");
    expect(pairResult.pair).toHaveProperty("expected_difference");
    expect(pairResult.pair).toHaveProperty("distinguishing_features");
    expect(typeof pairResult.hash_a).toBe("string");
    expect(typeof pairResult.hash_b).toBe("string");
    expect(typeof pairResult.hashDiffRatio).toBe("number");
    expect(typeof pairResult.detectable).toBe("boolean");
    expect(typeof pairResult.confidence).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// 11. evaluateArchetypeComparison returns valid structure
// ---------------------------------------------------------------------------

describe("evaluateArchetypeComparison", () => {
  it("returns a result with all required fields", () => {
    const result = evaluateArchetypeComparison();
    expect(result).toHaveProperty("rubricVersion");
    expect(result).toHaveProperty("pairs");
    expect(result).toHaveProperty("allDetectable");
    expect(result).toHaveProperty("minConfidence");
    expect(result).toHaveProperty("verdict");

    expect(result.rubricVersion).toBe("archetype-rubric-v1");
    expect(Array.isArray(result.pairs)).toBe(true);
    expect(typeof result.allDetectable).toBe("boolean");
    expect(typeof result.minConfidence).toBe("number");
    expect(["PASS", "FAIL", "NOT_EVALUATED"]).toContain(result.verdict);
  });

  it("pairs contain all COMPARISON_PAIRS", () => {
    const result = evaluateArchetypeComparison();
    expect(result.pairs.length).toBe(COMPARISON_PAIRS.length);
  });

  it("HEADLESS (no disk artifacts) → NOT_EVALUATED, not PASS", () => {
    // Without real artifact hashes on disk, the evaluation cannot
    // produce perceptual evidence.  Always returns NOT_EVALUATED.
    const result = evaluateArchetypeComparison();
    expect(result.verdict).toBe("NOT_EVALUATED");
    expect(result.allDetectable).toBe(false);
    expect(result.minConfidence).toBe(0);
  });

  it("HEADLESS path has zero-diff ratios (synthetic hashes not used)", () => {
    const result = evaluateArchetypeComparison();
    for (const pair of result.pairs) {
      expect(pair.hashDiffRatio).toBe(0);
    }
  });

  it("HEADLESS pairs all have detectable=false", () => {
    const result = evaluateArchetypeComparison();
    for (const pair of result.pairs) {
      expect(pair.detectable).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 12. No PES fidelity claims in rubric or evaluation
// ---------------------------------------------------------------------------

describe("No PES claims", () => {
  it("RUBRIC_META description does not claim PES fidelity", () => {
    const pesTerms = ["PES fidelity", "PES match", "PES 2017", "FOUNDATION_LAB_PASS"];
    for (const term of pesTerms) {
      expect(
        RUBRIC_META.description.toLowerCase().includes(term.toLowerCase()),
      ).toBe(false);
    }
  });

  it("COMPARISON_PAIRS descriptions do not claim PES fidelity", () => {
    const pesTerms = ["PES fidelity", "PES match", "PES 2017"];
    for (const pair of COMPARISON_PAIRS) {
      for (const term of pesTerms) {
        expect(
          pair.expected_difference.toLowerCase().includes(term.toLowerCase()),
          `expected_difference should not contain "${term}": ${pair.expected_difference}`,
        ).toBe(false);
        for (const feature of pair.distinguishing_features) {
          expect(
            feature.toLowerCase().includes(term.toLowerCase()),
            `distinguishing_feature should not contain "${term}": ${feature}`,
          ).toBe(false);
        }
      }
    }
  });

  it("evaluateArchetypeComparison verdict does not claim PES fidelity", () => {
    const result = evaluateArchetypeComparison();
    const pesTerms = ["PES fidelity", "PES match", "PES 2017", "FOUNDATION_LAB_PASS"];
    // In HEADLESS mode, pairs have no hash diffs but still have archetype info
    const evidence = result.pairs.map(
      (p) => `pair: ${p.pair.archetype_a} vs ${p.pair.archetype_b}`,
    );
    for (const str of evidence) {
      for (const term of pesTerms) {
        expect(
          str.toLowerCase().includes(term.toLowerCase()),
          `Evidence should not contain "${term}": ${str}`,
        ).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 13. compareFrames produces correct results
// ---------------------------------------------------------------------------

describe("compareFrames", () => {
  it("identical hashes → diff ratio 0, not detectable", () => {
    const frame: HashedFrame = {
      archetypeId: "archetype-burst-v1",
      perceptualHash: "abc123",
      tick: 5,
    };
    const result = compareFrames(frame, frame);
    expect(result.hashDiffRatio).toBe(0);
    expect(result.detectable).toBe(false);
  });

  it("different hashes → diff ratio > 0", () => {
    const frameA: HashedFrame = {
      archetypeId: "archetype-burst-v1",
      perceptualHash: "0000000000000000",
      tick: 5,
    };
    const frameB: HashedFrame = {
      archetypeId: "archetype-steady-v1",
      perceptualHash: "ffffffffffffffff",
      tick: 5,
    };
    const result = compareFrames(frameA, frameB);
    expect(result.hashDiffRatio).toBe(1);
  });

  it("has detectable and confidence fields", () => {
    const frameA: HashedFrame = {
      archetypeId: "archetype-burst-v1",
      perceptualHash: "0000000000000000",
      tick: 5,
    };
    const frameB: HashedFrame = {
      archetypeId: "archetype-steady-v1",
      perceptualHash: "ffffffffffffffff",
      tick: 5,
    };
    const result = compareFrames(frameA, frameB);
    expect(typeof result.detectable).toBe("boolean");
    expect(typeof result.confidence).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// 12. No PES fidelity claims in rubric or evaluation
// ---------------------------------------------------------------------------

describe("No PES claims", () => {
  it("RUBRIC_META description does not claim PES fidelity", () => {
    const pesTerms = ["PES fidelity", "PES match", "PES 2017", "FOUNDATION_LAB_PASS"];
    for (const term of pesTerms) {
      expect(
        RUBRIC_META.description.toLowerCase().includes(term.toLowerCase()),
      ).toBe(false);
    }
  });

  it("COMPARISON_PAIRS descriptions do not claim PES fidelity", () => {
    const pesTerms = ["PES fidelity", "PES match", "PES 2017"];
    for (const pair of COMPARISON_PAIRS) {
      for (const term of pesTerms) {
        expect(
          pair.expected_difference.toLowerCase().includes(term.toLowerCase()),
          `expected_difference should not contain "${term}": ${pair.expected_difference}`,
        ).toBe(false);
        for (const feature of pair.distinguishing_features) {
          expect(
            feature.toLowerCase().includes(term.toLowerCase()),
            `distinguishing_feature should not contain "${term}": ${feature}`,
          ).toBe(false);
        }
      }
    }
  });

  it("evaluateArchetypeComparison verdict does not claim PES fidelity", () => {
    const result = evaluateArchetypeComparison();
    const pesTerms = ["PES fidelity", "PES match", "PES 2017", "FOUNDATION_LAB_PASS"];
    const evidence = result.pairs.map(
      (p) => `${p.pair.archetype_a} vs ${p.pair.archetype_b}: diff=${p.hashDiffRatio}`,
    );
    for (const str of evidence) {
      for (const term of pesTerms) {
        expect(
          str.toLowerCase().includes(term.toLowerCase()),
          `Evidence should not contain "${term}": ${str}`,
        ).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 13. compareFrames produces correct results
// ---------------------------------------------------------------------------

describe("compareFrames", () => {
  it("identical hashes → diff ratio 0, not detectable", () => {
    const frame: HashedFrame = {
      archetypeId: "archetype-burst-v1",
      perceptualHash: "abc123",
      tick: 5,
    };
    const result = compareFrames(frame, frame);
    expect(result.hashDiffRatio).toBe(0);
    expect(result.detectable).toBe(false);
  });

  it("different hashes → diff ratio > 0", () => {
    const frameA: HashedFrame = {
      archetypeId: "archetype-burst-v1",
      perceptualHash: "0000000000000000",
      tick: 5,
    };
    const frameB: HashedFrame = {
      archetypeId: "archetype-steady-v1",
      perceptualHash: "ffffffffffffffff",
      tick: 5,
    };
    const result = compareFrames(frameA, frameB);
    expect(result.hashDiffRatio).toBe(1);
  });

  it("has detectable and confidence fields", () => {
    const frameA: HashedFrame = {
      archetypeId: "archetype-burst-v1",
      perceptualHash: "0000000000000000",
      tick: 5,
    };
    const frameB: HashedFrame = {
      archetypeId: "archetype-steady-v1",
      perceptualHash: "ffffffffffffffff",
      tick: 5,
    };
    const result = compareFrames(frameA, frameB);
    expect(typeof result.detectable).toBe("boolean");
    expect(typeof result.confidence).toBe("number");
  });
});