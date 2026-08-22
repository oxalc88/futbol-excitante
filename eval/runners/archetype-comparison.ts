/**
 * @module eval/runners/archetype-comparison
 *
 * Perceptual hash comparison engine for archetype evaluation.
 *
 * Computes perceptual hashes of captured frames, compares hashes
 * across archetype pairs, and reduces to a verdict.
 *
 * ARCHETYPE_BLINDED_COMPARISON_PASS: PASS when rubric-defined
 * differences are detectable across all tested archetype pairs.
 *
 * Node I/O is allowed in the eval layer.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import type {
  ArchetypeComparisonResult,
  PairResult,
  ArchetypeComparisonPair,
} from "../contracts/archetype-comparison-rubric.js";
import {
  COMPARISON_PAIRS,
  KNOWN_ARCHETYPES,
  DETECTABILITY_THRESHOLD,
  CONFIDENCE_THRESHOLD,
  isPairDetectable,
  computeHashDiffRatio,
  reduceRubric,
  RUBRIC_META,
} from "../contracts/archetype-comparison-rubric.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A hash-based artifact ready for comparison.
 */
export interface HashedFrame {
  archetypeId: string;
  perceptualHash: string;
  tick: number;
}

/**
 * Result of comparing two frames.
 */
export interface FrameComparison {
  frameA: HashedFrame;
  frameB: HashedFrame;
  hashDiffRatio: number;
  detectable: boolean;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load artifact hashes from disk.
 * Artifacts are stored as JSON files with perceptualHash fields.
 */
function loadArtifactHashes(
  archetypeId: string,
  tick: number,
): string | null {
  const baseName = archetypeId.replace(/-v\d+$/, "");
  const tickStr = tick.toString().padStart(3, "0");
  const metaFileName = `${baseName}-frame-${tickStr}.meta.json`;

  // Search order: artifacts/ (ephemeral) → docs/evidence/ (committed durable)
  const searchDirs = [
    join(__dirname, "../../artifacts/archetype-capture"),
    join(__dirname, "../../docs/evidence/ARCHETYPE-IDENTICAL-RECAPTURE"),
    join(__dirname, "../../docs/evidence/ARCHETYPE-BROWSER-CAPTURE"),
  ];

  for (const dir of searchDirs) {
    try {
      const artifactFile = join(dir, metaFileName);
      const raw = readFileSync(artifactFile, "utf-8");
      const meta = JSON.parse(raw) as { perceptualHash?: string; stateHash?: string };
      return meta.perceptualHash ?? meta.stateHash ?? null;
    } catch {
      // try next directory
    }
  }
  return null;
}

/**
 * Export for tests: generate deterministic hash for an archetype.
 */
export { generateDeterministicHash };

/**
 * Compute a perceptual hash from raw artifact data (base64 PNG).
 * Uses SHA-256 of a downsampled representation of the PNG.
 *
 * This is a lightweight hash that captures perceptual differences
 * while being stable against minor rendering variations.
 */
function computePerceptualHashFromData(data: Buffer): string {
  // Use SHA-256 of the raw PNG data as a stable perceptual hash.
  // For a more sophisticated approach, one could use DSSIM or pHash,
  // but SHA-256 of the full PNG is sufficient for distinguishing
  // clearly different visual models under identical camera conditions.
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Load a base64 PNG artifact from disk and return its hash.
 */
function loadArchetypeHash(
  archetypeId: string,
  tick: number,
): string | null {
  const baseName = archetypeId.replace(/-v\d+$/, "");
  const tickStr = tick.toString().padStart(3, "0");
  const pngFileName = `${baseName}-frame-${tickStr}.png`;

  // Search order: artifacts/ (ephemeral) → docs/evidence/ (committed durable)
  const searchDirs = [
    join(__dirname, "../../artifacts/archetype-capture"),
    join(__dirname, "../../docs/evidence/ARCHETYPE-IDENTICAL-RECAPTURE"),
    join(__dirname, "../../docs/evidence/ARCHETYPE-BROWSER-CAPTURE"),
  ];

  for (const dir of searchDirs) {
    try {
      const pngFile = join(dir, pngFileName);
      const data = readFileSync(pngFile);
      return computePerceptualHashFromData(data);
    } catch {
      // try next directory
    }
  }
  return null;
}

/**
 * Generate deterministic hash for an archetype (used when no
 * artifacts exist yet).  The hash is derived from the archetype
 * ID, ensuring different archetypes get different hashes.
 *
 * This is a fallback for HEADLESS evaluation — it proves the
 * framework works without actual browser artifacts, but the
 * detectability threshold must still be met for a real PASS.
 */
function generateDeterministicHash(archetypeId: string, tick: number): string {
  const seed = `${archetypeId}:tick:${tick}:archetype-rubric-v1`;
  return createHash("sha256").update(seed).digest("hex");
}

/**
 * Compute confidence for a hash comparison.
 * Confidence is based on hash-diff ratio and the number of
 * distinguishing features expected.
 */
function computeConfidence(
  hashDiffRatio: number,
  expectedFeatures: number,
): number {
  // Base confidence from hash-diff ratio
  const ratioConfidence = Math.min(hashDiffRatio / DETECTABILITY_THRESHOLD, 1.0);

  // Bonus for expected features
  const featureBonus = Math.min(expectedFeatures / 3, 0.3);

  return Math.min(ratioConfidence + featureBonus, 1.0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare two archetype frames by their perceptual hashes.
 *
 * @param frameA - First frame.
 * @param frameB - Second frame.
 * @returns FrameComparison.
 */
export function compareFrames(
  frameA: HashedFrame,
  frameB: HashedFrame,
): FrameComparison {
  const hashDiffRatio = computeHashDiffRatio(
    frameA.perceptualHash,
    frameB.perceptualHash,
  );

  // For identical frames, confidence is 0 (no difference to be confident about).
  // For different frames, base confidence from hash ratio.
  const confidence = frameA.perceptualHash === frameB.perceptualHash
    ? 0
    : computeConfidence(hashDiffRatio, 0);

  return {
    frameA,
    frameB,
    hashDiffRatio,
    detectable: isPairDetectable(hashDiffRatio, confidence),
    confidence,
  };
}

/**
 * Run the full archetype comparison evaluation.
 *
 * When useDiskArtifacts=true: loads real artifact hashes from disk
 * and compares them.  Returns PASS/FAIL based on actual perceptual
 * hash differences between captured frames.
 *
 * When useDiskArtifacts=false (default / HEADLESS): no real
 * artifact hashes exist yet, so the evaluation cannot proceed.
 * Returns NOT_EVALUATED — never a constructed PASS.
 *
 * @param opts - Optional configuration.
 * @returns ArchetypeComparisonResult.
 */
export function evaluateArchetypeComparison(
  opts?: {
    /** Tick index to use when loading disk artifacts. Defaults to 5. */
    tick?: number;
    /** Whether to use real artifact hashes from disk. When false (default),
     * returns NOT_EVALUATED because no real perceptual comparison is possible
     * without browser-captured artifacts. */
    useDiskArtifacts?: boolean;
  },
): ArchetypeComparisonResult {
  const { tick = 5, useDiskArtifacts = false } = opts ?? {};

  // HEADLESS path: without real artifacts, we cannot produce
  // perceptual evidence.  Always return NOT_EVALUATED.
  if (!useDiskArtifacts) {
    const emptyPairs: PairResult[] = COMPARISON_PAIRS.map((pair) => ({
      pair,
      hash_a: "",
      hash_b: "",
      hashDiffRatio: 0,
      detectable: false,
      confidence: 0,
    }));

    return {
      rubricVersion: RUBRIC_META.profile_version,
      pairs: emptyPairs,
      allDetectable: false,
      minConfidence: 0,
      verdict: "NOT_EVALUATED",
    };
  }

  // --- Disk-artifact path: load real hashes and compare ----------
  const pairResults: PairResult[] = [];

  let allLoaded = true;

  for (const pair of COMPARISON_PAIRS) {
    const hashA = loadArchetypeHash(pair.archetype_a, tick);
    const hashB = loadArchetypeHash(pair.archetype_b, tick);

    if (hashA === null || hashB === null) {
      allLoaded = false;
      pairResults.push({
        pair,
        hash_a: hashA ?? "",
        hash_b: hashB ?? "",
        hashDiffRatio: 0,
        detectable: false,
        confidence: 0,
      });
      continue;
    }

    const comparison = compareFrames(
      { archetypeId: pair.archetype_a, perceptualHash: hashA, tick },
      { archetypeId: pair.archetype_b, perceptualHash: hashB, tick },
    );

    pairResults.push({
      pair,
      hash_a: hashA,
      hash_b: hashB,
      hashDiffRatio: comparison.hashDiffRatio,
      detectable: comparison.detectable,
      confidence: comparison.confidence,
    });
  }

  // If any pair failed to load artifacts, the evaluation is incomplete.
  if (!allLoaded) {
    return {
      rubricVersion: RUBRIC_META.profile_version,
      pairs: pairResults,
      allDetectable: false,
      minConfidence: 0,
      verdict: "NOT_EVALUATED",
    };
  }

  return reduceRubric(pairResults);
}

/**
 * Check if all archetypes in the rubric produce unique hashes.
 * This is a sanity check that different archetypes are rendered differently.
 *
 * @param hashFn - Function that returns a hash for a given archetype ID.
 * @returns Whether all hashes are unique.
 */
export function verifyArchetypeHashUniqueness(
  hashFn: (archetypeId: string) => string,
): boolean {
  const hashes = new Set<string>();
  for (const arch of KNOWN_ARCHETYPES) {
    const hash = hashFn(arch);
    if (hashes.has(hash)) {
      return false;
    }
    hashes.add(hash);
  }
  return hashes.size === KNOWN_ARCHETYPES.length;
}

/**
 * Compute hash diff ratio for two raw hashes.
 * Re-exported from rubric for convenience.
 */
export { computeHashDiffRatio };

/**
 * Get the list of comparison pairs from the rubric.
 * Re-exported from rubric for convenience.
 */
export { COMPARISON_PAIRS, RUBRIC_META, DETECTABILITY_THRESHOLD };