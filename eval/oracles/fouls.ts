/**
 * @module eval/oracles/fouls
 *
 * Protected foul oracles (objective FOULS-SUITE-REGISTRATION), adjudicating the
 * FOULS_CARDS_SPEC §10 criteria that the accepted detection machinery makes
 * answerable over committed observation streams:
 *   - FOUL-DETECT          -> checkFoulDetect
 *   - FOUL-CLEAN-TACKLE    -> checkFoulCleanTackle
 *
 * Each oracle is a pure `TelemetryObservation[] → InvariantResult[]` function
 * and reads only committed, observable fields: the `foul` events emitted by the
 * observation-level detector and the `player-player-contact` events the accepted
 * tackle machinery commits.  The detection predicate is exactly the spec §5.1
 * read: a `player-player-contact` with `contactType` ∈
 * {`standing-tackle`, `slide-tackle`}, `tacklePhase === "active"`, and
 * `duelWon === false` (equivalently `ballReachable === false`) is a man-not-ball
 * foul candidate; the ball stays an independent 3D entity.
 *
 * CARD-ISSUED, ADVANTAGE-PLAYED and FREE-KICK-AWARD remain NAMED-BUT-UNREGISTERED
 * (FOULS_CARDS_SPEC §10): no oracle, invariant, binding or criterion registration
 * accompanies them here and no verdict is reported for them.
 *
 * Where the stream genuinely cannot carry a verdict (no `foul` event was emitted
 * to judge against) the oracle returns [] so the shared computeOutcome maps it to
 * NOT_EVALUATED — honest absence semantics, never an invented PASS.  A mutated
 * (contradictory) stream — a foul carrying a non-foul field, a foul sourced from a
 * clean/shoulder contact, a non-candidate-contact foul provenance failure —
 * returns FAIL.
 *
 * No geometry or PES threshold is implied: only the accepted event payload
 * structure and the spec §5.1 / §5.2 complement are validated.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

/** The spec §5.1 contact kinds that constitute a tackle contact. */
const TACKLE_CONTACT_TYPES = new Set<string>(["standing-tackle", "slide-tackle"]);

/** The spec §5.1 fields an emitted `foul` payload must carry. */
const FOUL_STRING_FIELDS = [
  "playerIdA",
  "playerIdB",
  "teamIdA",
  "teamIdB",
  "sourceEventId",
] as const;

const FOUL_NUMBER_FIELDS = [
  "attemptStartTick",
  "activeWindowStartTick",
  "activeWindowEndTick",
  "reach",
  "planarDistance",
] as const;

/**
 * Is a `player-player-contact` payload the spec §5.1 man-not-ball foul candidate?
 * Equivalently the accepted tackle outcome #3 (see spec §4.2).
 */
function isFoulCandidate(payload: Record<string, unknown>): boolean {
  return (
    TACKLE_CONTACT_TYPES.has(payload.contactType as string) &&
    payload.tacklePhase === "active" &&
    payload.duelWon === false
  );
}

/** Gather every `foul` event in the window with its sourced contact id. */
function foulSourceIds(
  observations: TelemetryObservation[],
): Array<{ tick: number; id: string; sourceEventId: string; payload: Record<string, unknown> }> {
  const out: Array<{
    tick: number;
    id: string;
    sourceEventId: string;
    payload: Record<string, unknown>;
  }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "foul") continue;
      const payload = (ev.payload ?? {}) as Record<string, unknown>;
      out.push({
        tick: ev.tick,
        id: ev.id,
        sourceEventId: typeof payload.sourceEventId === "string" ? payload.sourceEventId : "",
        payload,
      });
    }
  }
  return out;
}

/** Gather every `player-player-contact` event in the window with its payload. */
function contactEvents(
  observations: TelemetryObservation[],
): Array<{ id: string; payload: Record<string, unknown> }> {
  const out: Array<{ id: string; payload: Record<string, unknown> }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "player-player-contact") continue;
      out.push({ id: ev.id, payload: (ev.payload ?? {}) as Record<string, unknown> });
    }
  }
  return out;
}

/**
 * FOUL-DETECT: every emitted `foul` event matches the spec §5.1 definition and is
 * a grounded read of a genuine committed man-not-ball tackle contact.
 * Returns [] (NOT_EVALUATED) when no `foul` event was emitted — absence semantics
 * for streams where no foul occurred or the detector gate was off (the stashed
 * negative control must never PASS here).
 */
export function checkFoulDetect(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const fouls = foulSourceIds(observations);
  if (fouls.length === 0) {
    return [];
  }

  const contacts = contactEvents(observations);
  const contactsById = new Map(contacts.map((c) => [c.id, c]));

  const failures: string[] = [];
  for (const foul of fouls) {
    const p = foul.payload;
    if (!TACKLE_CONTACT_TYPES.has(p.contactType as string)) {
      failures.push(`${foul.id}: contactType must be standing-tackle | slide-tackle`);
    }
    if (p.tacklePhase !== "active") {
      failures.push(`${foul.id}: tacklePhase must be active`);
    }
    if (p.duelWon !== false) {
      failures.push(`${foul.id}: duelWon must be false`);
    }
    if (p.ballReachable !== false) {
      failures.push(`${foul.id}: ballReachable must be false`);
    }
    for (const key of FOUL_STRING_FIELDS) {
      if (typeof p[key] !== "string" || (p[key] as string).length === 0) {
        failures.push(`${foul.id}: ${key} must be a non-empty string`);
      }
    }
    for (const key of FOUL_NUMBER_FIELDS) {
      if (typeof p[key] !== "number") {
        failures.push(`${foul.id}: ${key} must be a number`);
      }
    }
    // Provenance: the foul must read a genuine committed man-not-ball contact.
    const source = contactsById.get(foul.sourceEventId);
    if (!source) {
      failures.push(`${foul.id}: sourceEventId ${foul.sourceEventId} does not resolve to a committed contact`);
    } else if (!isFoulCandidate(source.payload)) {
      failures.push(`${foul.id}: source contact ${foul.sourceEventId} is not a man-not-ball foul candidate`);
    }
  }

  if (failures.length > 0) {
    return [
      {
        id: "foul-detect-invalid",
        status: "fail",
        description: `${failures.length} emitted foul event(s) violate the FOULS_CARDS_SPEC §5.1 definition: ${failures.join("; ")}`,
        details: { fouledEventCount: fouls.length, failures },
      },
    ];
  }

  return [
    {
      id: "foul-detect-ok",
      status: "pass",
      description: `${fouls.length} emitted foul event(s) match the §5.1 definition and are grounded reads of genuine man-not-ball tackle contacts`,
      details: { fouledEventCount: fouls.length },
    },
  ];
}

/**
 * FOUL-CLEAN-TACKLE: the §5.2 complement holds — a clean tackle (`duelWon === true`)
 * and a symmetric shoulder-to-shoulder contact (`contactType === "player-player"`)
 * do NOT emit a `foul` event, and every emitted foul is sourced from a genuine
 * man-not-ball contact rather than a clean/shoulder contact.
 * Returns [] (NOT_EVALUATED) when no `foul` event was emitted, so the stashed
 * negative control does not suddenly PASS.
 */
export function checkFoulCleanTackle(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const fouls = foulSourceIds(observations);
  if (fouls.length === 0) {
    return [];
  }

  const contacts = contactEvents(observations);
  const contactsById = new Map(contacts.map((c) => [c.id, c]));
  // A "clean/shoulder" contact is any player-player-contact that is NOT a
  // man-not-ball foul candidate (duelWon-true tackle, ballReachable-true tackle,
  // or a symmetric shoulder contact).
  const cleanContactIds = new Set(
    contacts.filter((c) => !isFoulCandidate(c.payload)).map((c) => c.id),
  );

  const failures: string[] = [];
  const foulSourceIdsSet = new Set(fouls.map((f) => f.sourceEventId));
  for (const cleanId of cleanContactIds) {
    if (foulSourceIdsSet.has(cleanId)) {
      failures.push(`clean/shoulder contact ${cleanId} emitted a foul`);
    }
  }
  for (const foul of fouls) {
    const source = contactsById.get(foul.sourceEventId);
    if (!source) {
      failures.push(`${foul.id}: sourceEventId ${foul.sourceEventId} does not resolve to a committed contact`);
    } else if (!isFoulCandidate(source.payload)) {
      failures.push(`${foul.id}: sourced from a clean/shoulder contact ${foul.sourceEventId}`);
    }
  }

  if (failures.length > 0) {
    return [
      {
        id: "foul-clean-tackle-invalid",
        status: "fail",
        description: `the FOULS_CARDS_SPEC §5.2 complement is violated: ${failures.length} issue(s) — ${failures.join("; ")}`,
        details: { fouledEventCount: fouls.length, cleanContactCount: cleanContactIds.size, failures },
      },
    ];
  }

  return [
    {
      id: "foul-clean-tackle-ok",
      status: "pass",
      description: `FOULS_CARDS_SPEC §5.2 complement holds: ${cleanContactIds.size} clean/shoulder contact(s) emitted no foul, and ${fouls.length} foul event(s) are sourced from genuine man-not-ball contacts`,
      details: { fouledEventCount: fouls.length, cleanContactCount: cleanContactIds.size },
    },
  ];
}
