/**
 * @module @pes/eval/contracts/archetype-comparison-rubric
 *
 * Versioned perceptual rubric for archetype comparison.
 *
 * Defines archetype types (as rendered in the game), the pairs to compare,
 * and what visual/behavioral differences must be detectable per pair.
 *
 * The rubric is deterministic and versioned.  It does NOT make PES fidelity
 * claims — it only asserts that visually distinct archetypes produce
 * perceptibly distinguishable renderings.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A pair of archetype IDs to compare perceptually.
 */
export interface ArchetypeComparisonPair {
  /** First archetype identifier (e.g. "archetype-burst-v1"). */
  archetype_a: string;
  /** Second archetype identifier (e.g. "archetype-steady-v1"). */
  archetype_b: string;
  /** One-line description of the expected perceptual difference. */
  expected_difference: string;
  /**
   * What visual features distinguish the pair.  Used by the
   * hash-comparison engine to determine whether differences are
   * detectable.  At minimum, the perceptual hash difference ratio
   * must be above the threshold for this pair.
   */
  distinguishing_features: string[];
}

/**
 * Rubric-level metadata.
 */
export interface ArchetypeRubricMeta {
  profile_version: string;
  description: string;
}

/**
 * A single-per-pair evaluation result.
 */
export interface PairResult {
  pair: ArchetypeComparisonPair;
  /** Hash of archetype A frame. */
  hash_a: string;
  /** Hash of archetype B frame. */
  hash_b: string;
  /** Normalized hash-difference ratio (0–1). */
  hashDiffRatio: number;
  /** Whether the perceptual difference is detectable for this pair. */
  detectable: boolean;
  /** Confidence score (0–1) for the detectability verdict. */
  confidence: number;
}

/**
 * Full rubric evaluation result.
 */
export interface ArchetypeComparisonResult {
  rubricVersion: string;
  pairs: PairResult[];
  /** Whether all pairs are detectable. */
  allDetectable: boolean;
  /** Minimum confidence across all pairs. */
  minConfidence: number;
  /** Overall verdict: PASS when all pairs detectable. */
  verdict: "PASS" | "FAIL" | "NOT_EVALUATED";
}

// ---------------------------------------------------------------------------
// Rubric definition
// ---------------------------------------------------------------------------

/**
 * Versioned rubric metadata.
 */
export const RUBRIC_META: ArchetypeRubricMeta = {
  profile_version: "archetype-rubric-v1",
  description:
    "Perceptual rubric for blinded archetype comparison: every listed pair " +
    "must produce perceptibly different rendered frames under identical " +
    "camera and input conditions.",
};

/**
 * Known archetype IDs (as they appear in scenario fixtures).
 */
export const KNOWN_ARCHETYPES: ReadonlyArray<string> = [
  "archetype-burst-v1",
  "archetype-steady-v1",
  "archetype-technical-v1",
  "archetype-power-v1",
  "archetype-agility-v1",
];

/**
 * Archetype pairs that must be perceptually distinguishable.
 *
 * Each pair is expected to have a detectable visual difference.
 * The rubric defines these as the minimal set of comparisons
 * needed to verify that the rendering engine renders different
 * archetype visual models distinctly.
 */
export const COMPARISON_PAIRS: readonly ArchetypeComparisonPair[] = [
  {
    archetype_a: "archetype-burst-v1",
    archetype_b: "archetype-steady-v1",
    expected_difference:
      "Burst archetype uses aggressive posture and sharp stride " +
      "vs. steady archetype uses balanced, moderate posture.",
    distinguishing_features: [
      "player-posture",
      "stride-pattern",
      "visual-mass-distribution",
    ],
  },
  {
    archetype_a: "archetype-technical-v1",
    archetype_b: "archetype-power-v1",
    expected_difference:
      "Technical archetype uses leaner visual model vs. power " +
      "archetype uses heavier, broader model.",
    distinguishing_features: [
      "body-proportions",
      "visual-mass",
      "model-styling",
    ],
  },
  {
    archetype_a: "archetype-agility-v1",
    archetype_b: "archetype-steady-v1",
    expected_difference:
      "Agility archetype uses narrower, lighter visual model " +
      "vs. steady archetype uses balanced proportions.",
    distinguishing_features: [
      "body-proportions",
      "visual-lightness",
      "model-styling",
    ],
  },
  {
    archetype_a: "archetype-burst-v1",
    archetype_b: "archetype-technical-v1",
    expected_difference:
      "Burst archetype aggressive posture vs. technical archetype " +
      "leaner, control-oriented model.",
    distinguishing_features: [
      "player-posture",
      "body-proportions",
      "model-styling",
    ],
  },
];

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * Minimum perceptual hash-difference ratio for a pair to be
 * considered detectable.  A ratio of 0 means identical frames,
 * 1 means completely different.
 *
 * Value is chosen conservatively: visual models for different
 * archetypes should produce at least a 10% hash difference under
 * identical camera and input conditions.
 */
export const DETECTABILITY_THRESHOLD = 0.1;

/**
 * Minimum confidence score required for a pair to be considered
 * reliably detectable.
 */
export const CONFIDENCE_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Reduction logic
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a pair is detectable given its hash diff ratio
 * and confidence.
 */
export function isPairDetectable(
  hashDiffRatio: number,
  confidence: number,
): boolean {
  return hashDiffRatio >= DETECTABILITY_THRESHOLD && confidence >= CONFIDENCE_THRESHOLD;
}

/**
 * Compute the normalized hash-difference ratio between two hex hashes.
 * Both hashes must be the same length and use the same encoding.
 */
export function computeHashDiffRatio(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length || hashA.length === 0) {
    return 0;
  }

  let differentChars = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) {
      differentChars++;
    }
  }

  return differentChars / hashA.length;
}

/**
 * Run the full rubric evaluation.
 *
 * @param pairResults — Pre-computed per-pair results (hashes, ratios, confidences).
 * @returns ArchetypeComparisonResult.
 */
export function reduceRubric(
  pairResults: PairResult[],
): ArchetypeComparisonResult {
  const allDetectable = pairResults.every(
    (pr) => pr.detectable,
  );
  const minConfidence = Math.min(...pairResults.map((pr) => pr.confidence));
  const verdict: ArchetypeComparisonResult["verdict"] =
    allDetectable && minConfidence >= CONFIDENCE_THRESHOLD
      ? "PASS"
      : allDetectable
        ? "NOT_EVALUATED"
        : "FAIL";

  return {
    rubricVersion: RUBRIC_META.profile_version,
    pairs: pairResults,
    allDetectable,
    minConfidence,
    verdict,
  };
}