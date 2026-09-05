/**
 * @module eval/invariants/references
 *
 * ID-reference invariant: all event references in an observation must
 * resolve to existing event IDs within the same observation's event set.
 *
 * Bootstrap canary — detects broken ID references that could indicate
 * state corruption or replay issues.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check that all event references resolve within the observation.
 *
 * Validates:
 * - ball.lastTouchRef resolves to a known event id in the observation
 *   window. `lastTouchRef` is a persistent reference to the most recent
 *   touch event, which may have been emitted on an earlier tick, so it is
 *   resolved against `knownEventIds` (the union of every event emitted
 *   across the observation window) when provided, and fall back to the
 *   observation's own per-tick events otherwise.
 * - All event sequence numbers are unique within the observation.
 *
 * @param observation - The observation to check.
 * @param knownEventIds - Optional union of every event id in the window.
 * @returns InvariantResult with status pass/fail.
 */
export function checkEventReferences(
  observation: TelemetryObservation,
  knownEventIds?: Set<string>,
): InvariantResult {
  const errors: string[] = [];

  // Build set of event IDs this reference is allowed to resolve against.
  // `lastTouchRef` is cumulative, so default to the observation's own
  // per-tick events (single-observation callers) or the caller-provided
  // window union when one is supplied.
  const eventIds = knownEventIds ?? new Set(observation.events.map((e) => e.id));

  // Check ball lastTouchRef
  if (observation.ball.lastTouchRef !== null) {
    if (!eventIds.has(observation.ball.lastTouchRef)) {
      errors.push(
        `ball.lastTouchRef "${observation.ball.lastTouchRef}" not found in events`,
      );
    }
  }

  // Check sequence uniqueness
  const sequences = new Map<number, string>(); // sequence → eventId
  for (const e of observation.events) {
    if (sequences.has(e.sequence)) {
      errors.push(
        `duplicate sequence ${e.sequence}: "${sequences.get(e.sequence)}" and "${e.id}"`,
      );
    }
    sequences.set(e.sequence, e.id);
  }

  return {
    id: "event-references",
    status: errors.length === 0 ? "pass" : "fail",
    description:
      "All event references resolve; no duplicate sequence numbers",
    details: errors.length === 0 ? undefined : { errors },
  };
}