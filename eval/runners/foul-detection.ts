/**
 * @module @pes/eval/runners/foul-detection
 *
 * Observation-level foul detection (FOUL-DETECTION-MACHINERY).
 *
 * Implements FOULS_CARDS_SPEC §5.1 as a READ of the accepted tackle machinery's
 * own committed contacts: a foul candidate is a `player-player-contact` event
 * with `contactType` ∈ {`standing-tackle`, `slide-tackle`},
 * `tacklePhase === "active"`, and `duelWon === false` (equivalently
 * `ballReachable === false`) — a man-not-ball tackle contact. The detector emits
 * a `foul` observation event for each such contact, carrying only the fields the
 * accepted contact event already serializes (spec §4.2 / §5.1) plus the source
 * event id for provenance.
 *
 * This is strictly post-loop and additive (the gk-role / restart-designation
 * precedent): it never affects inputs, steps, or state hashes, and it introduces
 * no new collider, event, action, or contact rule. The simulation core, its
 * event union and its contracts are untouched. No Math.random, Date, DOM, or
 * Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";

/**
 * The contact kinds the foul definition applies to (FOULS_CARDS_SPEC §5.1).
 */
export const FOUL_CONTACT_TYPES = new Set<string>(["standing-tackle", "slide-tackle"]);

/**
 * Payload of a `foul` observation event. Every field mirrors a field the
 * accepted `player-player-contact` event carries (spec §4.2), so the emitted
 * foul is a grounded read of an already-committed contact rather than a new
 * football fact. `duelWon` and `ballReachable` are always `false` because the
 * predicate (spec §5.1) requires exactly the man-not-ball case.
 */
export interface FoulEventPayload {
  playerIdA: string;
  playerIdB: string;
  teamIdA: string;
  teamIdB: string;
  contactType: "standing-tackle" | "slide-tackle";
  tacklePhase: "active";
  duelWon: false;
  ballReachable: false;
  /** Id of the source `player-player-contact` event this foul reads. */
  sourceEventId: string;
  attemptStartTick: number;
  activeWindowStartTick: number;
  activeWindowEndTick: number;
  reach: number;
  planarDistance: number;
  committedDirection: { x: number; y: number };
}

function isFoulCandidate(payload: Record<string, unknown>): boolean {
  return (
    FOUL_CONTACT_TYPES.has(payload.contactType as string) &&
    payload.tacklePhase === "active" &&
    payload.duelWon === false
  );
}

/**
 * Inject a `foul` observation event for every man-not-ball tackle contact in the
 * stream, appended to the matching-tick observation (sequence computed after the
 * observation's existing events, so it never collides with an injected event
 * from an earlier gated annotation). Returns the number of fouls detected.
 *
 * The predicate is exactly the spec §5.1 definition; it does not add a new
 * collider, event, action, or contact rule, and it never touches the ball.
 */
export function detectFoulEvents(observations: TelemetryObservation[]): number {
  let count = 0;
  for (const o of observations) {
    let maxSeq = 0;
    for (const ev of o.events) if (ev.sequence > maxSeq) maxSeq = ev.sequence;
    for (const ev of o.events) {
      if (ev.kind !== "player-player-contact") continue;
      const payload = (ev.payload ?? {}) as Record<string, unknown>;
      if (!isFoulCandidate(payload)) continue;
      const p = payload as unknown as FoulEventPayload;
      count++;
      o.events.push({
        id: `foul-${o.tick}-${maxSeq + 1}`,
        tick: o.tick,
        sequence: maxSeq + 1,
        kind: "foul",
        label:
          `Foul candidate: ${p.playerIdA} ${p.contactType} contacts ` +
          `${p.playerIdB} in active window ${p.activeWindowStartTick}–` +
          `${p.activeWindowEndTick} (man-not-ball, duelWon false)`,
        payload: {
          playerIdA: p.playerIdA,
          playerIdB: p.playerIdB,
          teamIdA: p.teamIdA,
          teamIdB: p.teamIdB,
          contactType: p.contactType,
          tacklePhase: "active",
          duelWon: false,
          ballReachable: false,
          sourceEventId: ev.id,
          attemptStartTick: p.attemptStartTick,
          activeWindowStartTick: p.activeWindowStartTick,
          activeWindowEndTick: p.activeWindowEndTick,
          reach: p.reach,
          planarDistance: p.planarDistance,
          committedDirection: p.committedDirection,
        },
      });
      maxSeq++;
    }
  }
  return count;
}

/**
 * Count the `foul` events already present in a stream (for audit / disclosure).
 */
export function countFoulEvents(observations: TelemetryObservation[]): number {
  let count = 0;
  for (const o of observations) {
    for (const ev of o.events) if (ev.kind === "foul") count++;
  }
  return count;
}
