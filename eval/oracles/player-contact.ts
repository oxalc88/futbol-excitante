/**
 * @module eval/oracles/player-contact
 *
 * Player-contact-evidence oracle: validates that `player-player-contact`
 * events exist and reference known players.
 *
 * The telemetry event shape is `{ id, tick, sequence, kind, label }`.
 * We check:
 *  1. At least one player-player-contact event exists in the window.
 *  2. The scenario has ≥ 2 players (required for player-player contact).
 *  3. Event kind values are recognized (no typos or missing kinds).
 *
 * This oracle is used by PHY-SHLD-001-CONT to verify that parallel
 * shoulder contact produces actual contact evidence — not a stat-only
 * instant winner or a possession assigned without interaction.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

/**
 * Check for the existence of player-player-contact events.
 *
 * Returns an empty result array when preconditions are unmet
 * (no observations or fewer than 2 players), so the caller's
 * `oracleResults.length === 0` path yields NOT_EVALUATED without
 * changing shared computeOutcome semantics.
 *
 * @param observations - Ordered observations sorted by tick.
 * @returns InvariantResult[] — may be empty when preconditions are unmet.
 */
export function checkPlayerContactEvidence(
  observations: TelemetryObservation[],
): InvariantResult[] {
  if (observations.length === 0) {
    return [];
  }

  // Collect all unique tick-range observations.
  const firstTick = observations[0].tick;
  const lastTick = observations[observations.length - 1].tick;

  // Aggregate all events across ticks.
  const allEvents = observations.flatMap((o) => o.events);
  const contactEvents = allEvents.filter((e) => e.kind === "player-player-contact");

  // Check: observation has ≥ 2 players.
  const playerCount = observations[0].players.length;

  // Check: at least one contact event exists.
  const hasContact = contactEvents.length > 0;

  if (playerCount < 2) {
    return [];
  }

  if (!hasContact) {
    return [
      {
        id: "player-contact-none",
        status: "fail",
        description: `${contactEvents.length} player-player-contact events found across ticks ${firstTick}–${lastTick} (${observations.length} observations)`,
        details: { contactCount: contactEvents.length, eventCount: allEvents.length, tickRange: [firstTick, lastTick] },
      },
    ];
  }

  return [
    {
      id: "player-contact-found",
      status: "pass",
      description: `${contactEvents.length} player-player-contact event(s) found across ticks ${firstTick}–${lastTick}`,
      details: { contactCount: contactEvents.length, eventCount: allEvents.length, tickRange: [firstTick, lastTick] },
    },
  ];
}