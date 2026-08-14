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
 * - ball.lastTouchRef resolves to an event id in observation.events
 * - All event sequence numbers are unique within the observation
 *
 * @param observation - The observation to check.
 * @returns InvariantResult with status pass/fail.
 */
export function checkEventReferences(
  observation: TelemetryObservation,
): InvariantResult {
  const errors: string[] = [];

  // Build set of event IDs in this observation
  const eventIds = new Set(observation.events.map((e) => e.id));

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