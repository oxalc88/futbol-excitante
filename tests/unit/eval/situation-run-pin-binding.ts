/**
 * @module tests/unit/eval/situation-run-pin-binding
 *
 * Shared digest helpers for the SMALL-SIDED-SITUATIONS evidence bindings.
 *
 * Every binding in this family proves that a live situation-evaluator run
 * reproduces an accepted durable artifact byte-for-byte. BALL-SETTLED-REGIME-FIX
 * (`ball-settled-regime-v2`) legitimately moved the per-tick trajectory of each
 * fixture whose ball receives an impulse while its regime is "settled" — before
 * the fix such a ball carried a touch impulse and never moved — so a binding now
 * pins two digests per situation:
 *
 *   accepted — the immutable durable artifact under docs/evidence, kept as the
 *              before-state and asserted never to have been rewritten;
 *   live     — the run reproduced from the current tree, re-captured after the
 *              fix (see each binding file's provenance comment and git history).
 *
 * The accepted verdict and the relevant-event set must still reproduce from the
 * live run; a drift there is a real regression, not pin drift.
 */

import { createHash } from "node:crypto";

/** Accepted (before-state) and live (post-fix) digests of one artifact. */
export interface SituationPin {
  accepted: string;
  live: string;
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Core content of a situation artifact: the durable batch-5 artifacts carry an
 * extra `source_fixture` provenance field that a live evaluator run does not
 * synthesise, so bindings compare everything else.
 */
export function artifactCore(text: string): string {
  const { source_fixture: _dropped, ...rest } = JSON.parse(text) as Record<string, unknown>;
  return JSON.stringify(rest);
}

/** Digest of an artifact's bytes (`coreOnly` drops the source_fixture field). */
export function digestArtifact(text: string, coreOnly = false): string {
  return sha256Hex(coreOnly ? artifactCore(text) : text);
}

/** Digest of the ordered per-tick trajectory hash chain inside an artifact. */
export function digestTrajectoryChain(text: string): string {
  const parsed = JSON.parse(text) as { trajectory?: Array<{ hash: string }> };
  return sha256Hex((parsed.trajectory ?? []).map((entry) => entry.hash).join("|"));
}
