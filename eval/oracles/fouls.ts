/**
 * @module eval/oracles/fouls
 *
 * Protected foul oracles (objective FOULS-SUITE-REGISTRATION and
 * FREE-KICK-SUITE-REGISTRATION), adjudicating the FOULS_CARDS_SPEC §10 criteria
 * that the accepted machinery makes answerable over committed observation
 * streams:
 *   - FOUL-DETECT          -> checkFoulDetect
 *   - FOUL-CLEAN-TACKLE    -> checkFoulCleanTackle
 *   - FREE-KICK-AWARD      -> checkFoulFreeKickAward
 *
 * Each oracle is a pure `TelemetryObservation[] → InvariantResult[]` function
 * and reads only committed, observable fields: the `foul` events emitted by the
 * observation-level detector, the `free-kick-executed` events the accepted
 * restart machinery commits, and the `player-player-contact` events the accepted
 * tackle machinery commits.  The detection predicate is exactly the spec §5.1
 * read: a `player-player-contact` with `contactType` ∈
 * {`standing-tackle`, `slide-tackle`}, `tacklePhase === "active"`, and
 * `duelWon === false` (equivalently `ballReachable === false`) is a man-not-ball
 * foul candidate; the ball stays an independent 3D entity.  FREE-KICK-AWARD
 * imports the SINGLE-SOURCE-OF-TRUTH predicate
 * (src/simulation/foul-predicate.ts) exactly as the in-core consequence does.
 *
 * CARD-ISSUED and ADVANTAGE-PLAYED remain NAMED-BUT-UNREGISTERED
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
import { isFoulCandidatePayload } from "../../src/simulation/foul-predicate.js";

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

/**
 * A `free-kick-executed` observation event as recorded by the accepted restart
 * machinery (FOUL-CONSEQUENCE-MACHINERY / MATCH_RULES_SPEC §8): the fact the
 * FREE-KICK-AWARD oracle reads.
 */
interface FreeKickEvent {
  tick: number;
  id: string;
  teamId: string | null;
  position: { x: number; y: number } | null;
}

/** Gather every `free-kick-executed` event in the window. */
function freeKickEvents(
  observations: TelemetryObservation[],
): FreeKickEvent[] {
  const out: FreeKickEvent[] = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "free-kick-executed") continue;
      const p = (ev.payload ?? {}) as Record<string, unknown>;
      out.push({
        tick: ev.tick,
        id: ev.id,
        teamId: typeof p.teamId === "string" ? p.teamId : null,
        position:
          typeof p.freeKickPosition === "object" && p.freeKickPosition !== null
            ? {
                x: Number((p.freeKickPosition as { x?: unknown }).x),
                y: Number((p.freeKickPosition as { y?: unknown }).y),
              }
            : null,
      });
    }
  }
  return out;
}

/**
 * The fouled player's planar ground position at the foul tick — the accepted
 * free-kick placement ("the contact position", FOUL-CONSEQUENCE-MACHINERY).
 * Returns null when the observation or the player cannot be resolved.
 */
function contactPositionAt(
  observations: TelemetryObservation[],
  foulTick: number,
  fouledPlayerId: string,
): { x: number; y: number } | null {
  const obs = observations.find((o) => o.tick === foulTick);
  if (!obs) return null;
  const player = obs.players.find((p) => p.playerId === fouledPlayerId);
  if (!player) return null;
  return { x: player.groundPosition.x, y: player.groundPosition.y };
}

/**
 * FREE-KICK-AWARD — the set-piece consequence of a called foul (FOULS_CARDS_SPEC
 * §10, grounded in the accepted restart machinery per §8): a real detected foul
 * yields a real free-kick restart award to the fouled team, placed at the
 * contact position.  The shared foul predicate
 * (src/simulation/foul-predicate.ts) is the single source of truth for what a
 * foul IS (the SAME function the in-core consequence evaluates), so the oracle
 * never duplicates the §5.1 definition.
 *
 * Guards, mapped to the §10 definition:
 *   - a free kick awarded with NO detected foul (the freeKickWindow anti-huddle
 *     control shape) FAILs — that is exactly what the criterion forbids: a free
 *     kick is only the consequence of a called foul;
 *   - a no-foul, no-free-kick stream is honest NOT_EVALUATED (nothing to judge);
 *   - a stream carrying a detected foul but NO observable free-kick-executed is
 *     NOT_EVALUATED, never a false PASS or FAIL: the accepted driven-duel shape
 *     commits the free kick in the CORE's persistent state, not the per-step
 *     observation array (runner serialization limit), so the oracle cannot
 *     confirm or deny the award from the observations it receives;
 *   - when both a foul and a free kick are observable, every detected foul must
 *     be matched by a free kick to the fouled team at the contact position —
 *     any mismatch (wrong team, wrong placement, or an unclaimed free kick)
 *     FAILs.
 */
export function checkFoulFreeKickAward(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const fouls = foulSourceIds(observations);
  const contactsById = new Map(
    contactEvents(observations).map((c) => [c.id, c]),
  );
  // A genuine detected foul is one whose source contact passes the SHARED
  // single-source-of-truth predicate (spec §5.1) — not a duplicated read.
  const candidates = fouls.filter((foul) => {
    const source = contactsById.get(foul.sourceEventId);
    return source ? isFoulCandidatePayload(source.payload) : false;
  });
  const freeKicks = freeKickEvents(observations);

  // Nothing to judge: no foul and no free kick (the no-foul / gate-off control).
  if (candidates.length === 0 && freeKicks.length === 0) {
    return [];
  }

  // Power guard: a free kick awarded with no detected foul.  Under the §10
  // definition a free kick is ONLY the consequence of a called foul, so this is
  // an invalid award.
  if (candidates.length === 0) {
    return [
      {
        id: "foul-free-kick-award-invalid",
        status: "fail",
        description:
          `${freeKicks.length} free-kick-executed event(s) were awarded with no detected man-not-ball foul — ` +
          `a free kick is the consequence of a called foul (FOULS_CARDS_SPEC §10), so a free kick without a foul is invalid`,
        details: { freeKickCount: freeKicks.length, fouledEventCount: candidates.length },
      },
    ];
  }

  // A detected foul with no observable free-kick-executed: the accepted driven
  // shape commits the free kick in the core's persistent state, not the
  // observation array, so the oracle cannot confirm or deny the award.  Honest
  // absence (NOT_EVALUATED via the empty-result path), never a false PASS/FAIL.
  if (freeKicks.length === 0) {
    return [];
  }

  const failures: string[] = [];
  const usedFreeKickIds = new Set<string>();
  for (const foul of candidates) {
    const p = foul.payload;
    const fouledPlayerId = p.playerIdB as string | undefined;
    const fouledTeam = p.teamIdB as string | undefined;
    const contactPosition =
      fouledPlayerId !== undefined
        ? contactPositionAt(observations, foul.tick, fouledPlayerId)
        : null;
    const fk = freeKicks.find(
      (k) =>
        !usedFreeKickIds.has(k.id) &&
        k.teamId === fouledTeam &&
        k.position !== null &&
        contactPosition !== null &&
        Math.abs(k.position!.x - contactPosition.x) <= FREE_KICK_POSITION_TOLERANCE &&
        Math.abs(k.position!.y - contactPosition.y) <= FREE_KICK_POSITION_TOLERANCE,
    );
    if (fk) {
      usedFreeKickIds.add(fk.id);
    } else {
      const contactStr = contactPosition
        ? `(${contactPosition.x.toFixed(3)}, ${contactPosition.y.toFixed(3)})`
        : "unresolvable";
      failures.push(
        `${foul.id} (${foul.tick}): no free-kick to ${fouledTeam ?? "?"} placed at the contact position ${contactStr}`,
      );
    }
  }
  const extraFreeKicks = freeKicks.filter((k) => !usedFreeKickIds.has(k.id));
  for (const k of extraFreeKicks) {
    failures.push(`${k.id} (${k.tick}): free-kick awarded with no corresponding detected foul`);
  }

  if (failures.length > 0) {
    return [
      {
        id: "foul-free-kick-award-invalid",
        status: "fail",
        description:
          `${failures.length} FOULS_CARDS_SPEC §10 FREE-KICK-AWARD violation(s): ${failures.join("; ")}`,
        details: { fouledEventCount: candidates.length, freeKickCount: freeKicks.length, failures },
      },
    ];
  }

  return [
    {
      id: "foul-free-kick-award-ok",
      status: "pass",
      description:
        `${candidates.length} detected man-not-ball foul(s) each awarded a free kick to the fouled team ` +
        `at the contact position (${freeKicks.length} free-kick-executed event(s); FOULS_CARDS_SPEC §10)`,
      details: { fouledEventCount: candidates.length, freeKickCount: freeKicks.length },
    },
  ];
}

/** Tolerance (m) for "placed at the contact position": a free kick is at the
 * fouled player's planar position at the foul tick.  Small relative to the
 * pitch (~105 m), so it still rejects a misplaced/mutated award. */
const FREE_KICK_POSITION_TOLERANCE = 0.5;
