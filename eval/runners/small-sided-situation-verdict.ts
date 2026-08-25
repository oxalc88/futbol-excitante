/**
 * @module eval/runners/small-sided-situation-verdict
 *
 * Pure verdict computation for small-sided situations.
 *
 * Extracted from small-sided-situation-evaluator.ts so that both
 * the evaluator (Node) and the scanner (browser-compatible) can
 * import it without pulling in node:fs or other Node I/O.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { SimulationEvent } from "../../src/contracts/scenario.js";
import type { SituationEvidenceRequirement } from "../contracts/situation-mapping.js";

/**
 * Compute the verdict for a situation from its events.
 *
 * Rules:
 *   - If no relevant events → NOT_EVALUATED.
 *   - If required_event_kinds are all present → PASS.
 *   - If required_event_kinds are present but indicative kinds are absent
 *     and indicative kinds are defined → FAIL.
 *   - Otherwise → PASS (required met, indicative absent is acceptable).
 */
export function computeSituationVerdict(
  situationId: string,
  relevantEvents: SimulationEvent[],
  requirement: SituationEvidenceRequirement,
): { verdict: "PASS" | "FAIL" | "NOT_EVALUATED"; reason: string } {
  if (relevantEvents.length === 0) {
    return {
      verdict: "NOT_EVALUATED",
      reason: `No relevant events for ${situationId}; cannot evaluate`,
    };
  }

  // Collect distinct event kinds from relevant events.
  const eventKinds = new Set(relevantEvents.map((e) => e.kind));

  // Check if at least one required kind is present.
  const hasRequired = requirement.required_event_kinds.some((k) => eventKinds.has(k));
  if (!hasRequired) {
    return {
      verdict: "NOT_EVALUATED",
      reason: `None of required event kinds ${requirement.required_event_kinds.join(", ")} appeared for ${situationId}`,
    };
  }

  // Required kinds present — check indicative.
  if (requirement.indicative_event_kinds.length === 0) {
    return {
      verdict: "PASS",
      reason: `Required event kinds present for ${situationId} (${[...eventKinds].join(", ")}); no indicative kinds defined`,
    };
  }

  const hasIndicative = requirement.indicative_event_kinds.some((k) => eventKinds.has(k));
  if (hasIndicative) {
    return {
      verdict: "PASS",
      reason: `Required + indicative event kinds present for ${situationId} (${[...eventKinds].join(", ")}); ${requirement.indicative_event_kinds.join(", ")} observed`,
    };
  }

  return {
    verdict: "FAIL",
    reason: `Required event kinds present for ${situationId} but no indicative kinds (${requirement.indicative_event_kinds.join(", ")}) observed; events: ${[...eventKinds].join(", ")}`,
  };
}
