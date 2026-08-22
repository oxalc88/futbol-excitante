/**
 * @module eval/runners/arch-diff-001-evaluator
 *
 * Evaluation engine for ARCH-DIFF-001: archetype visual difference detection.
 *
 * Takes two game-state snapshots (structural frame pairs), evaluates them
 * against the ARCH-DIFF-001 rubric, and produces a PASS/FAIL/
 * NEEDS_PERCEPTUAL_REVIEW result.
 *
 * Node I/O is allowed in the eval layer.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import type {
  ArchDiff001Result,
  DimensionResult,
  ArchDiff001Rubric,
} from "../contracts/arch-diff-001-rubric.js";
import {
  ARCH_DIFF_RUBRIC_META,
  ARCH_DIFF_CRITERIA,
  buildArchDiffRubric,
  evaluateDimension,
  reduceArchDiffResult,
  DETECTABILITY_THRESHOLD,
  CONFIDENCE_THRESHOLD,
  type ArchDiffCriterion,
} from "../contracts/arch-diff-001-rubric.js";

import { computeHashDiffRatio } from "../contracts/archetype-comparison-rubric.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A snapshot of a game frame (the data needed for perceptual comparison).
 */
export interface GameFrameSnapshot {
  /** Stable identifier for the frame (e.g. scenario + tick). */
  frameId: string;
  /** Perceptual hash of the frame (hex string). */
  perceptualHash: string;
  /** Deterministic state hash of the game engine at this tick. */
  stateHash: string;
  /** Tick index of the frame. */
  tick: number;
  /** Canvas/render width (pixels). */
  width: number;
  /** Canvas/render height (pixels). */
  height: number;
  /** List of distinguishing features expected for this archetype. */
  expectedFeatures: string[];
}

/**
 * Result of comparing two game frame snapshots.
 */
export interface ArchDiffComparison {
  /** ID of frame A. */
  frameAId: string;
  /** ID of frame B. */
  frameBId: string;
  /** Whether both frames have valid structure. */
  structuralIntegrity: boolean;
  /** Perceptual hash diff ratio (0–1). */
  hashDiffRatio: number;
  /** State hash diff ratio (0–1). */
  stateDiffRatio: number;
  /** Combined confidence metric (0–1). */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Check structural integrity of two frames.
 * Both must have non-empty hashes, matching dimensions, and valid ticks.
 *
 * @param a - First frame snapshot.
 * @param b - Second frame snapshot.
 * @returns Score 1.0 if valid, 0.0 if invalid.
 */
function checkStructuralIntegrity(
  a: GameFrameSnapshot,
  b: GameFrameSnapshot,
): number {
  if (
    !a.perceptualHash ||
    !b.perceptualHash ||
    a.tick < 0 ||
    b.tick < 0
  ) {
    return 0;
  }

  // Dimensions must match (same resolution).
  if (a.width !== b.width || a.height !== b.height) {
    return 0;
  }

  // Must be different frames (same frameId would mean no difference).
  if (a.frameId === b.frameId) {
    return 0;
  }

  return 1.0;
}

/**
 * Compute state hash diff ratio from two state hashes.
 * Reuses computeHashDiffRatio from archetype-comparison-rubric.ts.
 */
function computeStateDiffRatio(
  stateHashA: string,
  stateHashB: string,
): number {
  return computeHashDiffRatio(stateHashA, stateHashB);
}

/**
 * Compute confidence for the ARCH-DIFF-001 rubric.
 *
 * Confidence is derived from:
 *  1. Hash diff ratio relative to threshold.
 *  2. Number of distinguishing features present in both frames.
 *
 * @param hashDiffRatio - Normalized hash difference (0–1).
 * @param expectedFeatures - Expected distinguishing feature count.
 * @param stateDiffRatio - State hash difference (0–1).
 * @returns Confidence score (0–1).
 */
function computeConfidence(
  hashDiffRatio: number,
  expectedFeatures: number,
  stateDiffRatio: number,
): number {
  // Base confidence from hash diff ratio relative to threshold.
  const ratioConfidence = hashDiffRatio / DETECTABILITY_THRESHOLD;
  const stateConfidence = stateDiffRatio / 0.3; // 30% state diff is strong

  // Combine ratio and state confidence, clamped.
  const baseConfidence = Math.min(
    (ratioConfidence + stateConfidence) / 2,
    1.0,
  );

  // Bonus for expected features (up to 0.2).
  const featureBonus = expectedFeatures > 0
    ? Math.min(expectedFeatures / 10, 0.2)
    : 0;

  return Math.min(baseConfidence + featureBonus, 1.0);
}

/**
 * Load artifact hashes from disk.
 * Same convention as archetype-comparison.ts: loads from
 * artifacts/archetype-capture/*.meta.json.
 * Returns both perceptualHash and stateHash (either may be null).
 */
function loadArtifactHashes(
  archetypeId: string,
  tick: number,
): { perceptualHash: string | null; stateHash: string | null } {
  try {
    const artifactDir = join(
      __dirname,
      "../../artifacts/archetype-capture",
    );
    const baseName = archetypeId.replace(/-v\d+$/, "");
    const filePath = join(
      artifactDir,
      `${baseName}-frame-${String(tick).padStart(3, "0")}.meta.json`,
    );
    const raw = readFileSync(filePath, "utf-8");
    const meta = JSON.parse(
      raw,
    ) as { perceptualHash?: string; stateHash?: string };
    return {
      perceptualHash: meta.perceptualHash ?? null,
      stateHash: meta.stateHash ?? null,
    };
  } catch {
    return { perceptualHash: null, stateHash: null };
  }
}

/**
 * Generate a deterministic state hash for testing when real state hashes
 * are not available.
 *
 * @param archetypeId - Archetype identifier.
 * @param tick - Tick index.
 * @returns SHA-256 hex string.
 */
export function generateDeterministicStateHash(
  archetypeId: string,
  tick: number,
): string {
  const seed = `${archetypeId}:tick:${tick}:arch-diff-001`;
  return createHash("sha256").update(seed).digest("hex");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare two game frame snapshots.
 *
 * Checks structural integrity, computes perceptual and state hash diff
 * ratios, and calculates a combined confidence score.
 *
 * @param frameA - First frame snapshot.
 * @param frameB - Second frame snapshot.
 * @returns ArchDiffComparison.
 */
export function compareGameFrames(
  frameA: GameFrameSnapshot,
  frameB: GameFrameSnapshot,
): ArchDiffComparison {
  const structuralIntegrity = checkStructuralIntegrity(frameA, frameB) === 1;
  const hashDiffRatio = computeHashDiffRatio(
    frameA.perceptualHash,
    frameB.perceptualHash,
  );
  const stateDiffRatio = computeStateDiffRatio(
    frameA.stateHash,
    frameB.stateHash,
  );
  const expectedFeatures = Math.min(
    frameA.expectedFeatures.length,
    frameB.expectedFeatures.length,
  );
  const confidence = computeConfidence(
    hashDiffRatio,
    expectedFeatures,
    stateDiffRatio,
  );

  return {
    frameAId: frameA.frameId,
    frameBId: frameB.frameId,
    structuralIntegrity,
    hashDiffRatio,
    stateDiffRatio,
    confidence,
  };
}

/**
 * Evaluate two game frame snapshots against the ARCH-DIFF-001 rubric.
 *
 * Produces a PASS/FAIL/NEEDS_PERCEPTUAL_REVIEW result based on the
 * criterion dimensions defined in arch-diff-001-rubric.ts.
 *
 * @param frameA - First frame snapshot.
 * @param frameB - Second frame snapshot.
 * @param rubric - Optional rubric override (defaults to canonical rubric).
 * @returns ArchDiff001Result.
 */
export function evaluateArchDiff001(
  frameA: GameFrameSnapshot,
  frameB: GameFrameSnapshot,
  rubric?: ArchDiff001Rubric,
): ArchDiff001Result {
  const canonicalRubric = rubric ?? buildArchDiffRubric(
    frameA.expectedFeatures.length > 0
      ? frameA.frameId
      : "archetype-burst-v1",
    frameB.expectedFeatures.length > 0
      ? frameB.frameId
      : "archetype-steady-v1",
  );

  const comparison = compareGameFrames(frameA, frameB);

  const stateHashMissing = !frameA.stateHash || !frameB.stateHash;
  const stateDiffRatio = stateHashMissing
    ? 0
    : computeStateDiffRatio(frameA.stateHash, frameB.stateHash);

  // Recompute confidence without relying on a potentially-fabricated state diff.
  const expectedFeatures = Math.min(
    frameA.expectedFeatures.length,
    frameB.expectedFeatures.length,
  );
  const confidence = computeConfidence(
    comparison.hashDiffRatio,
    expectedFeatures,
    stateDiffRatio,
  );

  const dimensions: DimensionResult[] = [
    evaluateDimension(
      canonicalRubric.criteria[0],
      comparison.structuralIntegrity ? 1 : 0,
      comparison.structuralIntegrity,
    ),
    evaluateDimension(
      canonicalRubric.criteria[1],
      comparison.hashDiffRatio,
      comparison.structuralIntegrity,
    ),
    evaluateDimension(
      canonicalRubric.criteria[2],
      stateDiffRatio,
      !stateHashMissing,
    ),
    evaluateDimension(
      canonicalRubric.criteria[3],
      confidence,
      comparison.structuralIntegrity,
    ),
  ];

  return reduceArchDiffResult(dimensions, canonicalRubric.pair_reference);
}

/**
 * Evaluate an ARCH-DIFF-001 pair with no real evidence.
 *
 * When perceptual comparison is not feasible (no real artifacts),
 * this returns NEEDS_PERCEPTUAL_REVIEW rather than constructing PASS.
 *
 * @param archetypeA - First archetype identifier.
 * @param archetypeB - Second archetype identifier.
 * @returns ArchDiff001Result with NEEDS_PERCEPTUAL_REVIEW.
 */
export function evaluateArchDiff001NoEvidence(
  archetypeA: string,
  archetypeB: string,
): ArchDiff001Result {
  const canonicalRubric = buildArchDiffRubric(archetypeA, archetypeB);
  const dimensions: DimensionResult[] = canonicalRubric.criteria.map(
    (c) => ({
      dimension_id: c.dimension_id,
      score: 0,
      threshold: c.pass_threshold,
      pass: false,
      severity: c.severity,
      evidenceAvailable: false,
    }),
  );

  return reduceArchDiffResult(dimensions, canonicalRubric.pair_reference);
}

/**
 * Run the full ARCH-DIFF-001 evaluation using the canonical rubric.
 *
 * When useDiskArtifacts=true: loads real artifact hashes from disk and
 * compares them. Returns PASS/FAIL based on actual perceptual hash
 * differences.
 *
 * When useDiskArtifacts=false (default / HEADLESS): returns
 * NEEDS_PERCEPTUAL_REVIEW because no real perceptual comparison is
 * possible without browser-captured artifacts.
 *
 * @param opts - Optional configuration.
 * @returns ArchDiff001Result.
 */
export function runArchDiff001(
  opts?: {
    /** Tick index for loading disk artifacts. Defaults to 5. */
    tick?: number;
    /** Whether to use real artifact hashes from disk. When false (default), returns NEEDS_PERCEPTUAL_REVIEW. */
    useDiskArtifacts?: boolean;
  },
): ArchDiff001Result {
  const { tick = 5, useDiskArtifacts = false } = opts ?? {};

  // HEADLESS path: without real artifacts, we cannot produce
  // perceptual evidence.  Always return NEEDS_PERCEPTUAL_REVIEW.
  if (!useDiskArtifacts) {
    return evaluateArchDiff001NoEvidence(
      "archetype-burst-v1",
      "archetype-steady-v1",
    );
  }

  // Disk-artifact path: load real hashes from disk.
  const { perceptualHash: hashA, stateHash: stateA } = loadArtifactHashes(
    "archetype-burst-v1",
    tick,
  );
  const { perceptualHash: hashB, stateHash: stateB } = loadArtifactHashes(
    "archetype-steady-v1",
    tick,
  );

  if (hashA === null || hashB === null) {
    return evaluateArchDiff001NoEvidence("archetype-burst-v1", "archetype-steady-v1");
  }

  // Build snapshots from disk artifacts.
  // stateHash is taken from the artifact; if absent, the
  // state-congruence dimension will have evidenceAvailable:false
  // so the verdict elevates to NEEDS_PERCEPTUAL_REVIEW rather
  // than fabricating a false PASS.
  const frameA: GameFrameSnapshot = {
    frameId: "archetype-burst-v1",
    perceptualHash: hashA,
    stateHash: stateA ?? "",
    tick,
    width: 320,
    height: 180,
    expectedFeatures: [
      "player-posture",
      "stride-pattern",
      "visual-mass-distribution",
    ],
  };
  const frameB: GameFrameSnapshot = {
    frameId: "archetype-steady-v1",
    perceptualHash: hashB,
    stateHash: stateB ?? "",
    tick,
    width: 320,
    height: 180,
    expectedFeatures: [
      "body-proportions",
      "visual-lightness",
      "model-styling",
    ],
  };

  return evaluateArchDiff001(frameA, frameB);
}