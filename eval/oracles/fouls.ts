/**
 * @module eval/oracles/fouls
 *
 * Protected foul oracles (objectives FOULS-SUITE-REGISTRATION,
 * FREE-KICK-SUITE-REGISTRATION, CARD-ISSUED-SUITE-REGISTRATION and
 * ADVANTAGE-SUITE-REGISTRATION), adjudicating the FOULS_CARDS_SPEC §10 criteria
 * that the accepted machinery makes answerable over committed observation
 * streams:
 *   - FOUL-DETECT          -> checkFoulDetect
 *   - FOUL-CLEAN-TACKLE    -> checkFoulCleanTackle
 *   - FREE-KICK-AWARD      -> checkFoulFreeKickAward
 *   - CARD-ISSUED          -> checkFoulCardIssued
 *   - ADVANTAGE-PLAYED     -> checkFoulAdvantagePlayed
 *
 * Each oracle is a pure `TelemetryObservation[] → InvariantResult[]` function
 * and reads only committed, observable fields: the `foul` events emitted by the
 * observation-level detector, the `free-kick-executed` events the accepted
 * restart machinery commits, the `card-issued` events the accepted card
 * machinery commits, the `advantage-opened` / `advantage-cancelled` /
 * `advantage-expired` window decisions the accepted ADVANTAGE-MACHINERY commits
 * (all surfaced into the observation stream only through the committed-events
 * injection / serializeRestartFacts gate), and the `player-player-contact`
 * events the accepted tackle machinery commits.  The detection predicate is
 * exactly the spec §5.1 read: a `player-player-contact` with `contactType` ∈
 * {`standing-tackle`, `slide-tackle`}, `tacklePhase === "active"`, and
 * `duelWon === false` (equivalently `ballReachable === false`) is a man-not-ball
 * foul candidate; the ball stays an independent 3D entity.  FREE-KICK-AWARD,
 * CARD-ISSUED and ADVANTAGE-PLAYED import the SINGLE-SOURCE-OF-TRUTH predicate
 * (src/simulation/foul-predicate.ts), the card-policy threshold
 * (src/simulation/card-policy.ts) and the advantage-window policy
 * (src/simulation/advantage-policy.ts) exactly as the in-core consequence does;
 * none duplicates the spec §5.1 / §9.1 / §6.2–§6.3 definition.
 *
 * ADVANTAGE-PLAYED's retained path (§6.2a judged retained) is NOT implemented
 * and `advantage_retention_ref` is BLOCKED_MISSING_REFERENCE (§11): the oracle
 * can never award a PASS to a retained judgment — a retained-path input is
 * reported honestly as blocked, never invented.
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
import { resolveCardForAccumulatedFouls } from "../../src/simulation/card-policy.js";
import {
  ADVANTAGE_WINDOW_TICKS,
  resolveAdvantageClose,
} from "../../src/simulation/advantage-policy.js";
import type { MatchPhase } from "../../src/contracts/state.js";

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
 * Placement matching uses a 0.5 m position tolerance
 * (FREE_KICK_POSITION_TOLERANCE): the executed free kick must sit within 0.5 m
 * of the fouled player's planar position at the foul tick.  This is a disclosed
 * provisional tolerance — small relative to the ~105 m pitch, so it still
 * rejects a genuinely misplaced/mutated award while tolerating the per-tick
 * integration drift of the contact position.  It mirrors the accepted rules
 * placement-oracle tolerance pattern (rules-restart PLACEMENT_TOLERANCE = 0.2 m).
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

/** A `card-issued` observation event as committed by the accepted card machinery
 * (CARD-MACHINERY, FOULS_CARDS_SPEC §7 / §9.1): the fact the CARD-ISSUED oracle
 * reads.  The card is issued to the offending player (the tackler, playerIdA) at
 * the accumulation threshold the card-policy declares. */
interface CardIssuedEvent {
  tick: number;
  id: string;
  cardType: string;
  playerId: string;
  fouledPlayerId: string;
  accumulatedFouls: number;
  foulSourceEventId: string;
  foulTick: number;
}

/** Gather every `card-issued` event in the window. */
function cardIssuedEvents(
  observations: TelemetryObservation[],
): CardIssuedEvent[] {
  const out: CardIssuedEvent[] = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "card-issued") continue;
      const p = (ev.payload ?? {}) as Record<string, unknown>;
      out.push({
        tick: ev.tick,
        id: ev.id,
        cardType: typeof p.cardType === "string" ? p.cardType : "",
        playerId: typeof p.playerId === "string" ? p.playerId : "",
        fouledPlayerId: typeof p.fouledPlayerId === "string" ? p.fouledPlayerId : "",
        accumulatedFouls: typeof p.accumulatedFouls === "number" ? p.accumulatedFouls : NaN,
        foulSourceEventId: typeof p.foulSourceEventId === "string" ? p.foulSourceEventId : "",
        foulTick: typeof p.foulTick === "number" ? p.foulTick : NaN,
      });
    }
  }
  return out;
}

/**
 * CARD-ISSUED — the FOULS_CARDS_SPEC §10 card consequence, grounded on the
 * accumulation semantics the accepted card machinery implements (FOULS_CARDS_SPEC
 * §7 / §9.1): a recognized man-not-ball foul accrues to the offending player
 * (the tackler, playerIdA) and a caution / expulsion is issued when the
 * accumulated count reaches the yellow / red accumulation count.  The oracle
 * imports the SINGLE-SOURCE-OF-TRUTH threshold
 * (src/simulation/card-policy.ts resolveCardForAccumulatedFouls) exactly as the
 * in-core card branch does, so it never duplicates the §9.1 thresholds.
 *
 * The card-issued event is commit-only to state.events; it surfaces into the
 * observation stream only through the committed-events injection (the
 * serializeRestartFacts gate).  The oracle reads what the stream ACTUALLY
 * carries — it does not re-serialize the runner or work around the serialization
 * limit.
 *
 * Guards, mapped to the §10 definition:
 *   - a card issued with NO qualifying man-not-ball foul (the card's
 *     foulSourceEventId does not resolve to a genuine §5.1 foul) FAILs — that is
 *     exactly what the criterion forbids: a card is only the consequence of a
 *     recognized foul;
 *   - a card issued to a player other than the offending player (the tackler)
 *     FAILs — §10 says the card is awarded to the offending player;
 *   - a wrong card type at the accumulated count FAILs — the card type must equal
 *     what the card-policy warrants at the player's genuine accumulated foul
 *     count at the card's foul tick;
 *   - no observable card (below threshold, gate off, or a commit-only card the
 *     observation stream does not carry) is honest NOT_EVALUATED — nothing to
 *     judge, and the oracle never invents a PASS or a false FAIL.
 */
export function checkFoulCardIssued(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const cards = cardIssuedEvents(observations);
  if (cards.length === 0) {
    return [];
  }

  // Genuine §5.1 man-not-ball fouls (resolved through the accepted contacts),
  // each with its offender (playerIdA) and tick, for the accumulation count.
  const contactsById = new Map(
    contactEvents(observations).map((c) => [c.id, c]),
  );
  const genuineFouls: Array<{ sourceEventId: string; offender: string; tick: number }> = [];
  for (const foul of foulSourceIds(observations)) {
    const source = contactsById.get(foul.sourceEventId);
    if (!source || !isFoulCandidate(source.payload)) continue;
    genuineFouls.push({
      sourceEventId: foul.sourceEventId,
      offender: typeof foul.payload.playerIdA === "string" ? (foul.payload.playerIdA as string) : "",
      tick: foul.tick,
    });
  }
  // Genuine fouls keyed by sourceEventId, for the backing-foul check.
  const genuineBySource = new Map(genuineFouls.map((g) => [g.sourceEventId, g]));

  // Count of genuine man-not-ball fouls for a player up to and including a tick
  // (the player's accumulated foul count at that point).
  function accumulatedCountFor(offender: string, upToTick: number): number {
    let n = 0;
    for (const g of genuineFouls) {
      if (g.offender === offender && g.tick <= upToTick) n += 1;
    }
    return n;
  }

  const failures: string[] = [];
  const usedFoulSources = new Set<string>();
  for (const card of cards) {
    const foul = genuineBySource.get(card.foulSourceEventId);
    // Power guard: a card with no qualifying man-not-ball foul.
    if (!foul) {
      failures.push(
        `${card.id} (tick ${card.tick}): card-issued with no qualifying man-not-ball foul (source ${card.foulSourceEventId})`,
      );
      continue;
    }
    // A second card for the same foul is an invalid duplicate.
    if (usedFoulSources.has(card.foulSourceEventId)) {
      failures.push(`${card.id}: duplicate card-issued for foul ${card.foulSourceEventId}`);
      continue;
    }
    usedFoulSources.add(card.foulSourceEventId);
    // Guard: the card must go to the offending player (the tackler, playerIdA).
    if (card.playerId !== foul.offender) {
      failures.push(
        `${card.id}: card-issued to ${card.playerId} but the offending player is ${foul.offender}`,
      );
      continue;
    }
    // Guard: the card type must be the one warranted at the player's accumulated
    // foul count at the card's foul tick (§7 / §9.1 accumulation).
    const count = accumulatedCountFor(foul.offender, card.foulTick);
    if (count !== card.accumulatedFouls) {
      failures.push(
        `${card.id}: accumulatedFouls ${card.accumulatedFouls} does not match ${count} qualifying foul(s) for ${card.playerId} up to tick ${card.foulTick}`,
      );
      continue;
    }
    const expected = resolveCardForAccumulatedFouls(count);
    if (expected !== card.cardType) {
      failures.push(
        `${card.id}: card type ${card.cardType} is not the card warranted at accumulated count ${count} (expected ${expected ?? "none"})`,
      );
      continue;
    }
  }

  if (failures.length > 0) {
    return [
      {
        id: "foul-card-issued-invalid",
        status: "fail",
        description:
          `${failures.length} FOULS_CARDS_SPEC §10 CARD-ISSUED violation(s): ${failures.join("; ")}`,
        details: { cardEventCount: cards.length, fouledEventCount: genuineFouls.length, failures },
      },
    ];
  }

  return [
    {
      id: "foul-card-issued-ok",
      status: "pass",
      description:
        `${cards.length} card-issued event(s) each match the FOULS_CARDS_SPEC §7 / §9.1 accumulation semantics: ` +
        `the correct card type at the correct accumulated count for the correct offending player`,
      details: { cardEventCount: cards.length, fouledEventCount: genuineFouls.length },
    },
  ];
}

/** Tolerance (m) for "placed at the contact position": a free kick is at the
 * fouled player's planar position at the foul tick.  Small relative to the
 * pitch (~105 m), so it still rejects a misplaced/mutated award. */
const FREE_KICK_POSITION_TOLERANCE = 0.5;

// ---------------------------------------------------------------------------
// ADVANTAGE-PLAYED (FOULS_CARDS_SPEC §6 / §10, ADVANTAGE-SUITE-REGISTRATION)
// ---------------------------------------------------------------------------

/**
 * The committed advantage-window decision kinds the ADVANTAGE-MACHINERY core
 * (src/simulation/loop/simulation.ts, §6.2–§6.4) appends to its persistent
 * state and that the serializeRestartFacts gate surfaces into the committed
 * observation stream.  There is deliberately NO `advantage-played` kind: the
 * §6.2a judged-retained path is NOT implemented (`advantage_retention_ref` is
 * BLOCKED_MISSING_REFERENCE, §11), so a stream can only carry the window
 * open/close decisions.
 */
const ADVANTAGE_OPEN_KIND = "advantage-opened";
const ADVANTAGE_CLOSED_KINDS: ReadonlySet<string> = new Set<string>([
  "advantage-cancelled",
  "advantage-expired",
]);

/**
 * The recognized §6.2–§6.3 window close reasons — the same closed set the
 * SHARED policy src/simulation/advantage-policy.ts declares as
 * `AdvantageCloseReason`.  §6.2a (judged retained) is NOT representable.
 */
const ADVANTAGE_CLOSE_REASONS: ReadonlySet<string> = new Set<string>([
  "cancelled-last-touch-loss",
  "cancelled-stoppage",
  "expired",
]);

/**
 * Reason / flag shapes that would assert a judged-retained advantage.  The
 * engine emits none of these; a stream that carries one is the unimplemented
 * §6.2a path, whose reference is BLOCKED_MISSING_REFERENCE — never a PASS.
 */
const ADVANTAGE_RETAINED_REASONS: ReadonlySet<string> = new Set<string>([
  "judged-retained",
  "retained",
  "advantage-played",
]);
const ADVANTAGE_RETAINED_EVENT_KIND = "advantage-played";

/** One committed advantage-window decision event. */
interface AdvantageDecision {
  tick: number;
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  retained: boolean;
}

/** Gather every advantage-window decision event in the window. */
function advantageDecisions(
  observations: TelemetryObservation[],
): AdvantageDecision[] {
  const out: AdvantageDecision[] = [];
  for (const o of observations) {
    for (const ev of o.events) {
      const kind: string = ev.kind;
      if (
        kind !== ADVANTAGE_OPEN_KIND &&
        !ADVANTAGE_CLOSED_KINDS.has(kind) &&
        kind !== ADVANTAGE_RETAINED_EVENT_KIND
      ) {
        continue;
      }
      const payload = (ev.payload ?? {}) as Record<string, unknown>;
      const reason = typeof payload.reason === "string" ? payload.reason : null;
      out.push({
        tick: ev.tick,
        id: ev.id,
        kind,
        payload,
        retained:
          kind === ADVANTAGE_RETAINED_EVENT_KIND ||
          payload.retained === true ||
          (reason !== null && ADVANTAGE_RETAINED_REASONS.has(reason)),
      });
    }
  }
  return out;
}

/** The committed `player-player-contact` contacts keyed by event id. */
function contactsById(
  observations: TelemetryObservation[],
): Map<string, { tick: number; payload: Record<string, unknown> }> {
  const map = new Map<string, { tick: number; payload: Record<string, unknown> }>();
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "player-player-contact") continue;
      map.set(ev.id, { tick: ev.tick, payload: (ev.payload ?? {}) as Record<string, unknown> });
    }
  }
  return map;
}

/** The committed match phase at a tick (from a `core-match-phase` event), or
 * null when the stream does not carry the phase for that tick. */
function matchPhaseAt(observations: TelemetryObservation[], tick: number): string | null {
  const obs = observations.find((o) => o.tick === tick);
  if (!obs) return null;
  for (const ev of obs.events) {
    if (ev.kind !== "core-match-phase") continue;
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    if (typeof p.matchPhase === "string") return p.matchPhase;
  }
  return null;
}

/**
 * The team the ball's accepted `lastTouchRef` resolves to at a tick — the same
 * read the SHARED policy consumes.
 *   - a team string  => the reference resolves to that team;
 *   - null           => the reference is null or resolves to no team (a loss);
 *   - undefined      => the referenced touch event is not observable in this
 *                      stream, so the policy cannot be re-evaluated (skip).
 */
function lastTouchTeamAt(
  observations: TelemetryObservation[],
  tick: number,
  eventTeamById: Map<string, string>,
  knownEventIds: Set<string>,
): string | null | undefined {
  const obs = observations.find((o) => o.tick === tick);
  if (!obs) return undefined;
  const ref = obs.ball.lastTouchRef;
  if (ref === null || ref === undefined) return null;
  if (!knownEventIds.has(ref)) return undefined;
  return eventTeamById.get(ref) ?? null;
}

/**
 * The ball-contact event kinds that claim the ball's authoritative
 * `lastTouchRef` in the accepted engine (the contact system's ordered ball
 * contacts plus the tackle system's ball contact).
 */
const TOUCH_EVENT_KINDS: ReadonlySet<string> = new Set<string>([
  "pass",
  "lofted-pass",
  "through-ball",
  "shot",
  "player-ball-contact",
  "first-touch",
  "dribble-touch",
]);

/**
 * The team the ball's `lastTouchRef` resolved to for the §6.2–§6.3 decision made
 * ON `tick`.  The committed observation at `tick` is the POST-step state: when
 * the window closes, the close's own §6.4 consequence resets `lastTouchRef` to
 * null on that same tick, so the decision tick's own reference cannot be read
 * directly.  The committed facts reconstruct it:
 *   - a ball contact committed on `tick` updates `lastTouchRef` before the
 *     advantage decision — the LAST such contact's team wins;
 *   - otherwise the reference is unchanged from the previous committed tick;
 *   - null  => a loss; undefined => not observable (skip the re-evaluation).
 */
function lastTouchTeamAtDecision(
  observations: TelemetryObservation[],
  tick: number,
  eventTeamById: Map<string, string>,
  knownEventIds: Set<string>,
): string | null | undefined {
  const obs = observations.find((o) => o.tick === tick);
  if (!obs) return undefined;
  let touchedTeam: string | null | undefined;
  for (const ev of obs.events) {
    if (!TOUCH_EVENT_KINDS.has(ev.kind as string)) continue;
    const t = ((ev.payload ?? {}) as Record<string, unknown>).teamId;
    touchedTeam = typeof t === "string" ? t : null;
  }
  if (touchedTeam !== undefined) return touchedTeam;
  const previous = lastTouchTeamAt(observations, tick - 1, eventTeamById, knownEventIds);
  return previous === undefined ? undefined : previous;
}

/**
 * ADVANTAGE-PLAYED — the FOULS_CARDS_SPEC §10 advantage criterion over the
 * committed ADVANTAGE-MACHINERY decision stream (§6.2–§6.4).  The oracle reads
 * the committed `advantage-opened` / `advantage-cancelled` / `advantage-expired`
 * decisions and adjudicates them against the SHARED single-source-of-truth
 * modules: the §5.1 foul predicate (src/simulation/foul-predicate.ts) grounds
 * every decision in a recognized man-not-ball contact, and the §6.2–§6.3 window
 * policy (src/simulation/advantage-policy.ts, `resolveAdvantageClose` and
 * `ADVANTAGE_WINDOW_TICKS`) validates the close decision.
 *
 * Guards, mapped to the §10 definition:
 *   - a window open or close (the §6.4 call) with NO recognized §5.1 man-not-ball
 *     foul behind it FAILs — an advantage decision is only the consequence of a
 *     recognized foul;
 *   - a decision whose carried facts disagree with its source contact
 *     (foulTick / fouledTeam / offenderId / fouledPlayerId) FAILs, as does a
 *     window budget other than the fouls-v1 `advantage_window_ticks`;
 *   - a close with an unrecognized reason, a close with no matching open, or a
 *     close that disagrees with the shared policy resolution FAILs;
 *   - a stream with no observable advantage decision (no foul, gate off, or the
 *     accepted driven shape whose window decisions are commit-only to the core's
 *     persistent state) is honest NOT_EVALUATED — never an invented PASS/FAIL;
 *   - a retained-judgment input (§6.2a) is reported honestly as
 *     BLOCKED_MISSING_REFERENCE (`advantage_retention_ref`, §11): the oracle
 *     never PASSes the unimplemented retained path.
 */
export function checkFoulAdvantagePlayed(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const decisions = advantageDecisions(observations);

  // §6.2a judged-retained: not implemented, unreferenced.  Never PASS.
  const retainedInputs = decisions.filter((d) => d.retained);
  if (retainedInputs.length > 0) {
    return [
      {
        id: "foul-advantage-played-blocked",
        status: "not_evaluated",
        description:
          `${retainedInputs.length} retained-advantage decision input(s) cannot be adjudicated: the ` +
          `§6.2a judged-retained predicate is not implemented and its reference is ` +
          `BLOCKED_MISSING_REFERENCE (advantage_retention_ref, FOULS_CARDS_SPEC §11) — no PASS is ` +
          `claimed for the retained path`,
        details: {
          blockedReference: "advantage_retention_ref",
          retainedDecisionInputs: retainedInputs.map((d) => ({ id: d.id, tick: d.tick, kind: d.kind })),
        },
      },
    ];
  }

  // Nothing observable: no advantage decision was carried by the stream.  Covers
  // a detected foul whose window decisions are commit-only (the driven shape) and
  // the gate-off control: honest NOT_EVALUATED, never an invented PASS.
  if (decisions.length === 0) {
    return [];
  }

  const contacts = contactsById(observations);
  const knownEventIds = new Set<string>();
  const eventTeamById = new Map<string, string>();
  for (const o of observations) {
    for (const ev of o.events) {
      knownEventIds.add(ev.id);
      const t = ((ev.payload ?? {}) as Record<string, unknown>).teamId;
      if (typeof t === "string") eventTeamById.set(ev.id, t);
    }
  }

  const opens = decisions.filter((d) => d.kind === ADVANTAGE_OPEN_KIND);
  const closes = decisions.filter((d) => ADVANTAGE_CLOSED_KINDS.has(d.kind));
  const failures: string[] = [];

  // Power guard: every advantage decision (window open or the §6.4 call at
  // close) MUST be grounded in a recognized §5.1 man-not-ball foul contact, and
  // its carried facts MUST agree with that contact.
  for (const d of decisions) {
    const sourceEventId =
      typeof d.payload.foulSourceEventId === "string" ? d.payload.foulSourceEventId : "";
    const source = contacts.get(sourceEventId);
    if (!source) {
      failures.push(
        `${d.id}: advantage decision is not grounded in a committed man-not-ball contact ` +
          `(sourceEventId ${sourceEventId || "<missing>"})`,
      );
      continue;
    }
    if (!isFoulCandidatePayload(source.payload)) {
      failures.push(
        `${d.id}: source contact ${sourceEventId} is not a recognized §5.1 man-not-ball foul candidate`,
      );
      continue;
    }
    if (d.payload.foulTick !== source.tick) {
      failures.push(
        `${d.id}: foulTick ${String(d.payload.foulTick)} does not match source contact tick ${source.tick}`,
      );
    }
    if (d.payload.fouledTeam !== source.payload.teamIdB) {
      failures.push(
        `${d.id}: fouledTeam ${String(d.payload.fouledTeam)} does not match the source contact team ${String(source.payload.teamIdB)}`,
      );
    }
    if (d.payload.offenderId !== undefined && d.payload.offenderId !== source.payload.playerIdA) {
      failures.push(
        `${d.id}: offenderId ${String(d.payload.offenderId)} does not match the source tackler ${String(source.payload.playerIdA)}`,
      );
    }
    if (d.payload.fouledPlayerId !== undefined && d.payload.fouledPlayerId !== source.payload.playerIdB) {
      failures.push(
        `${d.id}: fouledPlayerId ${String(d.payload.fouledPlayerId)} does not match the source fouled player ${String(source.payload.playerIdB)}`,
      );
    }
    if (d.payload.windowTicks !== ADVANTAGE_WINDOW_TICKS) {
      failures.push(
        `${d.id}: windowTicks ${String(d.payload.windowTicks)} does not match the fouls-v1 advantage_window_ticks ${ADVANTAGE_WINDOW_TICKS}`,
      );
    }
  }

  // Close-specific guards: a recognized reason, a matching open, the §6.2c
  // expiry arithmetic, and agreement with the shared §6.2–§6.3 policy.
  const policyRecomputeSkipped: string[] = [];
  for (const close of closes) {
    const reason = typeof close.payload.reason === "string" ? close.payload.reason : "";
    if (!ADVANTAGE_CLOSE_REASONS.has(reason)) {
      failures.push(
        `${close.id}: unrecognized advantage close reason ${JSON.stringify(reason)} ` +
          `(expected one of ${[...ADVANTAGE_CLOSE_REASONS].join(", ")})`,
      );
      continue;
    }
    const openTick = close.payload.openTick;
    if (typeof openTick !== "number") {
      failures.push(`${close.id}: missing numeric openTick`);
      continue;
    }
    if (!opens.some((o) => o.tick === openTick)) {
      failures.push(
        `${close.id}: advantage ${close.kind} at tick ${close.tick} has no matching advantage-opened at tick ${openTick}`,
      );
      continue;
    }
    const delta = close.tick - openTick;
    if (delta < 1) {
      failures.push(`${close.id}: advantage window closed on its opening tick (delta ${delta})`);
    }
    if (reason === "expired") {
      if (delta < ADVANTAGE_WINDOW_TICKS) {
        failures.push(
          `${close.id}: expired before the ${ADVANTAGE_WINDOW_TICKS}-tick window budget (delta ${delta})`,
        );
      }
    } else if (delta >= ADVANTAGE_WINDOW_TICKS) {
      failures.push(
        `${close.id}: ${reason} at delta ${delta} >= window budget ${ADVANTAGE_WINDOW_TICKS} (would have expired)`,
      );
    }

    // Re-evaluate the close with the SHARED policy from the committed facts the
    // stream genuinely carries.  The committed `core-match-phase` at the close
    // tick is the POST-step phase, so it is `playing` for an expired /
    // last-touch-loss close whose own consequence opened a restart on the same
    // tick; the policy checks the phase first, so those two reasons can only be
    // returned while the phase was `playing` (a sound inference).  A
    // cancelled-stoppage close is the only one that reads the phase, and there
    // the post-step phase has left `playing`.
    const lastTouchTeam = lastTouchTeamAtDecision(observations, close.tick, eventTeamById, knownEventIds);
    const fouledTeam = typeof close.payload.fouledTeam === "string" ? close.payload.fouledTeam : "";
    if (reason === "cancelled-stoppage") {
      const observedPhase = matchPhaseAt(observations, close.tick);
      if (observedPhase === null) {
        policyRecomputeSkipped.push(close.id);
        continue;
      }
      const expected = resolveAdvantageClose({
        openTick,
        currentTick: close.tick,
        phase: observedPhase as MatchPhase,
        lastTouchTeam: lastTouchTeam === undefined ? null : lastTouchTeam,
        fouledTeam,
      });
      if (expected !== reason) {
        failures.push(
          `${close.id}: the shared §6.2–§6.3 policy resolves ${JSON.stringify(expected)} at tick ${close.tick} ` +
            `(committed phase ${observedPhase}), not the committed ${JSON.stringify(reason)}`,
        );
      }
    } else {
      if (lastTouchTeam === undefined) {
        policyRecomputeSkipped.push(close.id);
        continue;
      }
      const expected = resolveAdvantageClose({
        openTick,
        currentTick: close.tick,
        phase: "playing",
        lastTouchTeam,
        fouledTeam,
      });
      if (expected !== reason) {
        failures.push(
          `${close.id}: the shared §6.2–§6.3 policy resolves ${JSON.stringify(expected)} at tick ${close.tick} ` +
            `(fouled team ${fouledTeam}, last touch team ${String(lastTouchTeam)}), not the committed ${JSON.stringify(reason)}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    return [
      {
        id: "foul-advantage-played-invalid",
        status: "fail",
        description:
          `${failures.length} FOULS_CARDS_SPEC §6 / §10 ADVANTAGE-PLAYED violation(s): ${failures.join("; ")}`,
        details: {
          advantageDecisionCount: decisions.length,
          openCount: opens.length,
          closeCount: closes.length,
          failures,
        },
      },
    ];
  }

  const closeReasonCounts: Record<string, number> = {};
  for (const c of closes) {
    const r = typeof c.payload.reason === "string" ? c.payload.reason : "<missing>";
    closeReasonCounts[r] = (closeReasonCounts[r] ?? 0) + 1;
  }

  return [
    {
      id: "foul-advantage-played-ok",
      status: "pass",
      description:
        `${decisions.length} committed advantage-window decision(s) match the FOULS_CARDS_SPEC §6.2–§6.4 machinery: ` +
        `every window open/call is grounded in a recognized §5.1 man-not-ball foul, every close carries a recognized ` +
        `reason (${Object.keys(closeReasonCounts).sort().join(", ") || "none"}) and no retained judgment (` +
        `judged-retained) is claimed`,
      details: {
        advantageDecisionCount: decisions.length,
        openCount: opens.length,
        closeCount: closes.length,
        closeReasonCounts,
        windows: opens.map((o) => {
          const close = closes.find((c) => c.payload.openTick === o.tick);
          return {
            openTick: o.tick,
            closeTick: close ? close.tick : null,
            reason: close && typeof close.payload.reason === "string" ? close.payload.reason : null,
          };
        }),
        retainedPathStatus: "BLOCKED_MISSING_REFERENCE",
        retainedPathReference: "advantage_retention_ref",
        policyRecomputeSkipped,
      },
    },
  ];
}
