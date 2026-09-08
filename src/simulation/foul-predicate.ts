/**
 * @module @pes/simulation/foul-predicate
 *
 * Single source of truth for the engine-grounded foul definition
 * (FOULS_CARDS_SPEC §5.1). Both the observation-level detection
 * (eval/runners/foul-detection.ts, FOUL-DETECTION-MACHINERY) and the in-core
 * foul consequence (FOUL-CONSEQUENCE-MACHINERY) evaluate the SAME predicate so
 * they cannot disagree about what a foul IS.
 *
 * The predicate is a READ of a fact the accepted tackle system already commits:
 * a `player-player-contact` event with `contactType` ∈ {`standing-tackle`,
 * `slide-tackle`}, `tacklePhase === "active"`, and `duelWon === false` — the
 * man-not-ball tackle contact (spec §5.1 outcome #3). It adds no collider, no
 * event, no action, and no contact rule. It never touches the ball.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { SimulationEvent } from "../contracts/scenario.js";

/**
 * The contact kinds the foul definition applies to (FOULS_CARDS_SPEC §5.1).
 * A symmetric shoulder-to-shoulder contact (`contactType === "player-player"`)
 * is NOT a foul candidate.
 */
export const FOUL_CONTACT_TYPES: ReadonlySet<string> = new Set<string>([
  "standing-tackle",
  "slide-tackle",
]);

/**
 * Whether a committed `player-player-contact` payload is the engine-grounded
 * foul candidate: a man-not-ball tackle contact. `duelWon` and `ballReachable`
 * are mutually implied by the accepted system (`duelWon = ballReachable`), but
 * both are checked here so the predicate pins exactly the spec §5.1 definition.
 */
export function isFoulCandidatePayload(payload: Record<string, unknown>): boolean {
  return (
    FOUL_CONTACT_TYPES.has(payload.contactType as string) &&
    payload.tacklePhase === "active" &&
    payload.duelWon === false &&
    payload.ballReachable === false
  );
}

/**
 * Whether a committed simulation event is the engine-grounded foul candidate.
 * Only a `player-player-contact` event can carry the foul-relevant facts the
 * accepted tackle system serializes (spec §4.2); every other event kind is
 * not a foul.
 */
export function isFoulCandidateEvent(ev: SimulationEvent): boolean {
  if (ev.kind !== "player-player-contact") return false;
  return isFoulCandidatePayload((ev.payload ?? {}) as Record<string, unknown>);
}
