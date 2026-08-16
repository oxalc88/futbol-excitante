/**
 * @module eval/oracles/match
 *
 * Match-scoring oracles: score-tracker and match-clock.
 *
 * score-tracker — verifies that derived team scores match goal events.
 * match-clock   — verifies that observation ticks are sequential.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// score-tracker oracle
// ---------------------------------------------------------------------------

/**
 * Check that every "goal" event is consistent with the derived score.
 *
 * - goalIndex 0 → team-a scores
 * - goalIndex 1 → team-b scores
 * - goalIndex 2 or more → invalid goalIndex → FAIL
 *
 * Returns PASS if no goals exist (no-op is valid).
 * Returns FAIL if any goal event has an invalid goalIndex.
 */
export function checkScoreTracker(
  observations: TelemetryObservation[],
): InvariantResult {
  let teamAGoals = 0;
  let teamBGoals = 0;

  // Collect all goal events across all observations.
  for (const obs of observations) {
    for (const evt of obs.events) {
      if (evt.kind !== "goal") {
        continue;
      }

      const goalIndex = (evt.payload?.goalIndex as number) ?? -1;

      if (goalIndex === 0) {
        teamAGoals++;
      } else if (goalIndex === 1) {
        teamBGoals++;
      } else if (goalIndex < 0 || goalIndex > 1) {
        // Invalid goalIndex.
        return {
          id: `invalid-goalIndex-tick-${obs.tick}`,
          status: "fail",
          description: `Invalid goalIndex ${goalIndex} at tick ${obs.tick}`,
          details: { tick: obs.tick, goalIndex },
        };
      }
    }
  }

  // No goals or all goals have valid indices → PASS.
  return {
    id: "score-tracker-clean",
    status: "pass",
    description: `Score consistent with goal events: team-a=${teamAGoals}, team-b=${teamBGoals}`,
    details: { teamAGoals, teamBGoals },
  };
}

// ---------------------------------------------------------------------------
// match-clock oracle
// ---------------------------------------------------------------------------

/**
 * Check that observation ticks are sequential (tick[i] === tick[0] + i).
 *
 * Returns PASS if all observation[i].tick are sequential.
 * Returns FAIL on the first out-of-order tick.
 */
export function checkMatchClock(
  observations: TelemetryObservation[],
): InvariantResult {
  if (observations.length === 0) {
    return {
      id: "match-clock-clean",
      status: "pass",
      description: "No observations to check",
      details: { tickCount: 0 },
    };
  }

  const startTick = observations[0].tick;
  for (let i = 0; i < observations.length; i++) {
    if (observations[i].tick !== startTick + i) {
      return {
        id: `non-sequential-tick-tick-${observations[i].tick}`,
        status: "fail",
        description: `Expected tick ${startTick + i}, got ${observations[i].tick}`,
        details: { expected: startTick + i, actual: observations[i].tick },
      };
    }
  }

  return {
    id: "match-clock-clean",
    status: "pass",
    description: `All ${observations.length} observation ticks are sequential`,
    details: { tickCount: observations.length },
  };
}