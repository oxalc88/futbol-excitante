/**
 * @module eval/oracles/possession
 *
 * Detects possession changes that occur without interaction evidence.
 * The ball's `lastTouchRef` should only change when a touch event is
 * present in the current tick's event list.
 *
 * If the ball's lastTouchRef changes but no touch event exists in the
 * current tick, this is likely a possession without interaction (mutant).
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

/**
 * Check that possession changes (lastTouchRef changes) are backed by
 * interaction evidence (a touch event in the current tick).
 *
 * @param observations - Ordered observations sorted by tick.
 * @returns InvariantResult (first observation is skipped).
 */
export function checkPossessionEvidence(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const results: InvariantResult[] = [];

  for (let i = 1; i < observations.length; i++) {
    const prev = observations[i - 1];
    const curr = observations[i];

    // If lastTouchRef changed, there should be a touch event.
    if (prev.ball.lastTouchRef !== curr.ball.lastTouchRef) {
      // Build set of event IDs for this tick.
      const eventIds = new Set(curr.events.map((e) => e.id));

      // Check for touch events in this tick.
      const hasTouchEvent = curr.events.some(
        (e) => e.kind === "touch" || e.kind === "ball-touch" || e.kind === "player-ball-contact" || e.kind === "pass" || e.kind === "shot",
      );

      if (!hasTouchEvent && curr.ball.lastTouchRef !== null) {
        // lastTouchRef changed without evidence.
        results.push({
          id: `possession-no-evidence-tick-${curr.tick}`,
          status: "fail",
          description: `Ball lastTouchRef changed at tick ${curr.tick} from ${prev.ball.lastTouchRef} to ${curr.ball.lastTouchRef} without touch event evidence`,
          details: {
            tick: curr.tick,
            prevRef: prev.ball.lastTouchRef,
            currRef: curr.ball.lastTouchRef,
            hasTouchEvent,
            eventCount: eventIds.size,
          },
        });
      }
    }

    // Also check: if lastTouchRef is non-null, it must resolve to an event.
    if (curr.ball.lastTouchRef !== null) {
      const eventIds = new Set(curr.events.map((e) => e.id));
      if (!eventIds.has(curr.ball.lastTouchRef)) {
        results.push({
          id: `possession-orphan-ref-tick-${curr.tick}`,
          status: "fail",
          description: `Ball lastTouchRef at tick ${curr.tick} (${curr.ball.lastTouchRef}) does not resolve to any event`,
          details: { tick: curr.tick, lastTouchRef: curr.ball.lastTouchRef, eventCount: eventIds.size },
        });
      }
    }
  }

  // No violations found — the oracle ran and found nothing wrong.
  // Return a single pass so computeOutcome yields PASS rather than
  // NOT_EVALUATED (empty results would otherwise be treated as
  // "no oracle ran").
  if (results.length === 0) {
    results.push({
      id: "possession-clean",
      status: "pass",
      description: "Ball lastTouchRef changes are backed by touch event evidence throughout run",
    });
  }

  return results;
}