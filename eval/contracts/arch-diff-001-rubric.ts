/**
 * @module @pes/eval/contracts/arch-diff-001-rubric
 *
 * Versioned perceptual rubric for ARCH-DIFF-001:
 * archetype visual difference detection.
 *
 * This rubric verifies that two game-state snapshots for distinct
 * archetypes produce visually distinguishable outputs under
 * otherwise identical conditions.  It is a superset of the
 * archetype-comparison-rubric hash-diff logic, adding structural
 * and state-aware criteria.
 *
 * ARCH-DIFF-001 is a PERCEPTUAL_TARGET case (browser case registry).
 * It must resolve from NEEDS_PERCEPTUAL_REVIEW to PASS when the
 * rubric detects meaningful differences for all criterion dimensions.
 *
 * The rubric is deterministic and versioned.  It does NOT make PES
 * fidelity claims — it only asserts that visually distinct archetypes
 * produce perceptibly distinguishable renderings.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Versioned metadata for this rubric.
 */
export interface ArchDiff001RubricMeta {
  profile_version: string;
  description: string;
}

/**
 * A single criterion dimension.  Each dimension must pass for the
 * overall rubric to PASS.
 */
export interface ArchDiffCriterion {
  /** Stable dimension identifier. */
  dimension_id: string;
  /** Human-readable description. */
  description: string;
  /** Minimum value required for PASS (0–1). */
  pass_threshold: number;
  /** Whether a failure produces a FAIL or a NEEDS_PERCEPTUAL_REVIEW. */
  severity: "HARD" | "SOFT";
}

/**
 * Rubric dimensions that must all pass.
 */
export interface ArchDiff001Rubric {
  /** Rubric version string. */
  version: string;
  /** Criterion dimensions. */
  criteria: readonly ArchDiffCriterion[];
  /** Reference to the archetype pairs from archetype-comparison-rubric.ts. */
  pair_reference: {
    archetype_a: string;
    archetype_b: string;
  };
}

/**
 * Per-dimension evaluation result.
 */
export interface DimensionResult {
  /** Stable dimension identifier. */
  dimension_id: string;
  /** Actual metric value (0–1). */
  score: number;
  /** Threshold for this dimension. */
  threshold: number;
  /** Whether this dimension passed. */
  pass: boolean;
  /** Severity classification. */
  severity: "HARD" | "SOFT";
  /** Whether evidence was available to measure this dimension.
   * false means the framework could not produce a measurement
   * (e.g., no artifacts, no data), which elevates the verdict
   * to NEEDS_PERCEPTUAL_REVIEW. */
  evidenceAvailable: boolean;
}

/**
 * Full ARCH-DIFF-001 evaluation result.
 */
export interface ArchDiff001Result {
  rubric_version: string;
  /** Per-dimension results. */
  dimensions: DimensionResult[];
  /** Whether all HARD dimensions pass. */
  allHardPass: boolean;
  /** Overall verdict. */
  verdict: "PASS" | "FAIL" | "NEEDS_PERCEPTUAL_REVIEW";
  /** Human-readable rationale. */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Rubric definition
// ---------------------------------------------------------------------------

/**
 * Versioned rubric metadata for ARCH-DIFF-001.
 */
export const ARCH_DIFF_RUBRIC_META: ArchDiff001RubricMeta = {
  profile_version: "arch-diff-001-rubric-v1",
  description:
    "Perceptual rubric for ARCH-DIFF-001: verifies that game-state " +
    "snapshots for visually distinct archetypes produce " +
    "perceptibly distinguishable outputs under identical conditions.",
};

/**
 * Criterion dimensions for the ARCH-DIFF-001 rubric.
 *
 * Each dimension must meet its threshold for an overall PASS.
 */
export const ARCH_DIFF_CRITERIA: readonly ArchDiffCriterion[] = [
  {
    dimension_id: "structural-integrity",
    description:
      "Both snapshots have valid structure (non-empty frames, " +
      "matching dimensions, consistent metadata).",
    pass_threshold: 1.0,
    severity: "HARD",
  },
  {
    dimension_id: "visual-model-difference",
    description:
      "Perceptual hash diff ratio exceeds the minimum threshold, " +
      "confirming the visual models differ meaningfully.",
    pass_threshold: 0.1,
    severity: "HARD",
  },
  {
    dimension_id: "state-congruence",
    description:
      "State hashes differ between snapshots, confirming that the " +
      "game engine produced different states (not just rendering noise).",
    pass_threshold: 0.05,
    severity: "HARD",
  },
  {
    dimension_id: "confidence",
    description:
      "The combined confidence metric (hash diff + feature signals) " +
      "is high enough to support the visual difference claim.",
    pass_threshold: 0.5,
    severity: "SOFT",
  },
];

/**
 * Build the canonical ARCH-DIFF-001 rubric for a given pair.
 *
 * @param archetypeA - First archetype identifier.
 * @param archetypeB - Second archetype identifier.
 * @returns ArchDiff001Rubric.
 */
export function buildArchDiffRubric(
  archetypeA: string,
  archetypeB: string,
): ArchDiff001Rubric {
  return {
    version: ARCH_DIFF_RUBRIC_META.profile_version,
    criteria: ARCH_DIFF_CRITERIA,
    pair_reference: {
      archetype_a: archetypeA,
      archetype_b: archetypeB,
    },
  };
}

// ---------------------------------------------------------------------------
// Thresholds (mirrored from archetype-comparison-rubric for consistency)
// ---------------------------------------------------------------------------

/**
 * Minimum perceptual hash-difference ratio for a pair to be
 * considered detectable.  Mirrors DETECTABILITY_THRESHOLD from
 * archetype-comparison-rubric.ts.
 */
export const DETECTABILITY_THRESHOLD = 0.1;

/**
 * Minimum confidence score required for reliable detection.
 * Mirrors CONFIDENCE_THRESHOLD from archetype-comparison-rubric.ts.
 */
export const CONFIDENCE_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Reduction logic
// ---------------------------------------------------------------------------

/**
 * Evaluate a single dimension given its score.
 *
 * @param dimension - The criterion definition.
 * @param score - Actual metric value (0–1).
 * @param evidenceAvailable - Whether evidence was available to measure.
 *   Defaults to true.
 * @returns DimensionResult.
 */
export function evaluateDimension(
  dimension: ArchDiffCriterion,
  score: number,
  evidenceAvailable: boolean = true,
): DimensionResult {
  return {
    dimension_id: dimension.dimension_id,
    score,
    threshold: dimension.pass_threshold,
    pass: score >= dimension.pass_threshold,
    severity: dimension.severity,
    evidenceAvailable,
  };
}

/**
 * Reduce dimension results to an overall verdict.
 *
 * PASS when all HARD dimensions pass AND evidence is available for all.
 * NEEDS_PERCEPTUAL_REVIEW when any dimension lacks evidence.
 * FAIL otherwise.
 *
 * @param dimensions - Pre-computed per-dimension results.
 * @returns ArchDiff001Result.
 */
export function reduceArchDiffResult(
  dimensions: DimensionResult[],
  pairReference: { archetype_a: string; archetype_b: string },
): ArchDiff001Result {
  // Check if any dimension lacks evidence (could not be measured).
  const hasMissingEvidence = dimensions.some(
    (d) => !d.evidenceAvailable,
  );

  if (hasMissingEvidence) {
    return {
      rubric_version: ARCH_DIFF_RUBRIC_META.profile_version,
      dimensions,
      allHardPass: false,
      verdict: "NEEDS_PERCEPTUAL_REVIEW",
      rationale: `Cannot evaluate ${pairReference.archetype_a} vs ${pairReference.archetype_b}: missing evidence for one or more dimensions.`,
    };
  }

  const allHardPass = dimensions
    .filter((d) => d.severity === "HARD")
    .every((d) => d.pass);

  if (allHardPass) {
    return {
      rubric_version: ARCH_DIFF_RUBRIC_META.profile_version,
      dimensions,
      allHardPass: true,
      verdict: "PASS",
      rationale: `All HARD dimensions pass for ${pairReference.archetype_a} vs ${pairReference.archetype_b}. Visual difference is detectable.`,
    };
  }

  const failedDimensions = dimensions
    .filter((d) => !d.pass)
    .map((d) => d.dimension_id);

  return {
    rubric_version: ARCH_DIFF_RUBRIC_META.profile_version,
    dimensions,
    allHardPass: false,
    verdict: "FAIL",
    rationale: `HARD dimensions failed for ${pairReference.archetype_a} vs ${pairReference.archetype_b}: ${failedDimensions.join(", ")}.`,
  };
}