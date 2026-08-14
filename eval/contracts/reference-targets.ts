/**
 * @module @pes/eval/contracts/reference-targets
 *
 * ReferenceTarget registry — stubbed for all test × criterion pairs.
 *
 * At bootstrap time there are NO populated reference targets.  Every
 * MEASURED_TARGET criterion will therefore yield BLOCKED_MISSING_REFERENCE
 * at evaluation time.  This file registers the _absence_ by creating
 * zero-entry registries so that lookup returns undefined (not a missing
 * registry error).
 *
 * A future step will populate this with versioned reference envelopes.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { ReferenceTarget } from "./types.js";

/** All reference targets keyed by target_id. Empty at bootstrap. */
export const REFERENCE_TARGETS: Record<string, ReferenceTarget> = {};

/**
 * Get a reference target by target_id.
 */
export function getReferenceTarget(
  targetId: string,
): ReferenceTarget | undefined {
  return REFERENCE_TARGETS[targetId];
}

/**
 * Resolve a reference target for a given (test_id, criterion_id) pair.
 * Returns undefined at bootstrap — the evaluator interprets this as
 * BLOCKED_MISSING_REFERENCE for the applicable MEASURED_TARGET criterion.
 */
export function resolveReferenceTarget(
  _testId: string,
  _criterionId: string,
): ReferenceTarget | undefined {
  return undefined;
}