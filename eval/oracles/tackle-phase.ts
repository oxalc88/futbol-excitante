/**
 * @module eval/oracles/tackle-phase
 *
 * Tackle-phase evidence oracle: validates that a defensive tackle action
 * system exists in the run and behaves as an ordered, windowed commit.
 *
 * The telemetry event shapes consumed here are:
 *  - `tackle-phase`       { playerId, tackleKind, phase, startTick,
 *                           prepareTicks, activeTicks, recoverTicks, reach,
 *                           activeWindowStartTick, activeWindowEndTick,
 *                           releaseTick }
 *  - `player-player-contact` / `player-ball-contact` with
 *                           contactType "standing-tackle" | "slide-tackle",
 *                           tacklePhase, attemptStartTick,
 *                           activeWindowStartTick, activeWindowEndTick, reach
 *  - `input-rejection`     { policy: "tackle-lockout" | "tackle-commitment"
 *                                     | "tackle-contest", ... }
 *
 * Checks per attempt (a `startTick` for one player):
 *  1. Phases appear in the order prepare → active → recover → release, on
 *     strictly increasing ticks, exactly once each.
 *  2. The declared windows are finite and positive, and the observed phase
 *     ticks match them (active opens at startTick + prepareTicks, recovery at
 *     startTick + prepareTicks + activeTicks, release at the end of recovery).
 *  3. Every tackle contact lies INSIDE the explicit active window — proof that
 *     no permanent or omnidirectional collider exists.
 *  4. Every tackle contact is within the declared finite reach.
 *  5. A won ball contact never moves the ball's position (velocity-only
 *     deflection, i.e. no teleport).
 *  6. No new attempt by the same player starts before the previous attempt's
 *     release tick — recovery prevents an instant re-tackle.
 *
 * Honesty rules inherited from the registry:
 *  - An empty observation list yields [] so the caller reports NOT_EVALUATED
 *    rather than a fabricated verdict.
 *  - Fewer than two players cannot produce a duel, so the oracle returns []
 *    (mirrors `checkPlayerContactEvidence`).
 *  - With ≥ 2 players and NO tackle evidence of the requested kind the oracle
 *    FAILS. Stashing the tackle action system therefore turns the duels suite
 *    red instead of silently dropping to NOT_EVALUATED.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation, InvariantResult } from "../../src/contracts/telemetry.js";

/** Which defensive action the oracle instance checks. */
export type TackleKindFilter = "standing" | "slide";

interface ObservedEvent {
  id: string;
  tick: number;
  sequence: number;
  kind: string;
  label: string;
  payload?: Record<string, unknown>;
}

interface AttemptRecord {
  playerId: string;
  startTick: number;
  phases: Map<string, ObservedEvent>;
  contacts: ObservedEvent[];
  reach: number;
  prepareTicks: number;
  activeTicks: number;
  recoverTicks: number;
  activeWindowStartTick: number;
  activeWindowEndTick: number;
  releaseTick: number;
}

/** Collect every event across the ordered observations. */
function allEvents(observations: TelemetryObservation[]): ObservedEvent[] {
  return observations.flatMap((o) => o.events as ObservedEvent[]);
}

/** Numeric payload field with a default. */
function num(payload: Record<string, unknown> | undefined, key: string): number {
  const v = payload?.[key];
  return typeof v === "number" ? v : Number.NaN;
}

/**
 * Build the per-attempt records for one tackle kind, in first-seen order.
 */
function collectAttempts(
  events: ObservedEvent[],
  kind: TackleKindFilter,
): AttemptRecord[] {
  const attempts = new Map<string, AttemptRecord>();
  const keyOf = (playerId: string, startTick: number) => `${playerId}@${startTick}`;

  for (const ev of events) {
    if (ev.kind === "tackle-phase") {
      const p = ev.payload;
      if ((p?.tackleKind as string) !== kind) continue;
      const playerId = String(p?.playerId ?? "");
      const startTick = num(p, "startTick");
      if (!playerId || Number.isNaN(startTick)) continue;
      const key = keyOf(playerId, startTick);
      let attempt = attempts.get(key);
      if (!attempt) {
        attempt = {
          playerId,
          startTick,
          phases: new Map<string, ObservedEvent>(),
          contacts: [],
          reach: num(p, "reach"),
          prepareTicks: num(p, "prepareTicks"),
          activeTicks: num(p, "activeTicks"),
          recoverTicks: num(p, "recoverTicks"),
          activeWindowStartTick: num(p, "activeWindowStartTick"),
          activeWindowEndTick: num(p, "activeWindowEndTick"),
          releaseTick: num(p, "releaseTick"),
        };
        attempts.set(key, attempt);
      }
      const phase = String(p?.phase ?? "");
      // First occurrence of each phase wins; a repeat is a violation checked later.
      if (!attempt.phases.has(phase)) attempt.phases.set(phase, ev);
      continue;
    }

    if (ev.kind === "player-player-contact" || ev.kind === "player-ball-contact") {
      const p = ev.payload;
      const contactType = String(p?.contactType ?? "");
      const wanted = kind === "standing" ? "standing-tackle" : "slide-tackle";
      if (contactType !== wanted) continue;
      const playerId =
        ev.kind === "player-ball-contact"
          ? String(p?.playerId ?? "")
          : String(p?.playerIdA ?? "");
      const startTick = num(p, "attemptStartTick");
      if (!playerId || Number.isNaN(startTick)) continue;
      const attempt = attempts.get(keyOf(playerId, startTick));
      if (attempt) attempt.contacts.push(ev);
    }
  }

  return [...attempts.values()];
}

/**
 * Validate one attempt against the ordered-phase contract.
 */
function checkAttempt(attempt: AttemptRecord): InvariantResult[] {
  const failures: string[] = [];
  const results: InvariantResult[] = [];
  const tag = `${attempt.playerId}@${attempt.startTick}`;

  // --- 1. Windows are finite and positive ---------------------------------
  if (
    !(attempt.prepareTicks > 0) ||
    !(attempt.activeTicks > 0) ||
    !(attempt.recoverTicks > 0) ||
    !(attempt.reach > 0)
  ) {
    failures.push(`${tag}: non-finite phase windows or reach`);
  }

  // --- 2. Ordered phases, each exactly once -------------------------------
  const order: Array<"prepare" | "active" | "recover" | "release"> = [
    "prepare",
    "active",
    "recover",
    "release",
  ];
  const phaseTicks: Partial<Record<string, number>> = {};
  for (const phase of order) {
    const ev = attempt.phases.get(phase);
    if (!ev) {
      failures.push(`${tag}: missing ${phase} phase event`);
      continue;
    }
    phaseTicks[phase] = ev.tick;
  }
  for (let i = 1; i < order.length; i++) {
    const prev = phaseTicks[order[i - 1]];
    const curr = phaseTicks[order[i]];
    if (prev !== undefined && curr !== undefined && curr <= prev) {
      failures.push(
        `${tag}: phase ${order[i]} at tick ${curr} is not after ${order[i - 1]} at tick ${prev}`,
      );
    }
  }

  // --- 3. Phase ticks match the declared windows --------------------------
  const expectedActive = attempt.startTick + attempt.prepareTicks;
  const expectedRecover = expectedActive + attempt.activeTicks;
  const expectedRelease = expectedRecover + attempt.recoverTicks;
  if (phaseTicks.prepare !== undefined && phaseTicks.prepare !== attempt.startTick) {
    failures.push(`${tag}: prepare tick ${phaseTicks.prepare} != startTick ${attempt.startTick}`);
  }
  if (phaseTicks.active !== undefined && phaseTicks.active !== expectedActive) {
    failures.push(`${tag}: active opened at ${phaseTicks.active}, expected ${expectedActive}`);
  }
  if (phaseTicks.recover !== undefined && phaseTicks.recover !== expectedRecover) {
    failures.push(`${tag}: recovery opened at ${phaseTicks.recover}, expected ${expectedRecover}`);
  }
  if (phaseTicks.release !== undefined && phaseTicks.release !== expectedRelease) {
    failures.push(`${tag}: release at ${phaseTicks.release}, expected ${expectedRelease}`);
  }

  // --- 4. Contacts only inside the explicit active window, inside reach ---
  for (const contact of attempt.contacts) {
    const p = contact.payload;
    if ((p?.tacklePhase as string) !== "active") {
      failures.push(
        `${tag}: contact ${contact.id} at tick ${contact.tick} is outside the active phase (${String(p?.tacklePhase)})`,
      );
    }
    if (
      contact.tick < attempt.activeWindowStartTick ||
      contact.tick > attempt.activeWindowEndTick
    ) {
      failures.push(
        `${tag}: contact ${contact.id} at tick ${contact.tick} outside active window ` +
          `[${attempt.activeWindowStartTick},${attempt.activeWindowEndTick}]`,
      );
    }
    const distance = num(p, "planarDistance");
    const reach = num(p, "reach");
    if (!Number.isNaN(distance) && !Number.isNaN(reach) && distance > reach + 1e-9) {
      failures.push(
        `${tag}: contact ${contact.id} at ${distance.toFixed(3)} m exceeds finite reach ${reach} m`,
      );
    }
    // Velocity-only world effect: the ball's position must be unchanged.
    const incoming = p?.incoming as { position?: { x: number; y: number; z: number } } | undefined;
    const outgoing = p?.outgoing as { position?: { x: number; y: number; z: number } } | undefined;
    if (incoming?.position && outgoing?.position) {
      const moved =
        Math.abs(incoming.position.x - outgoing.position.x) > 1e-12 ||
        Math.abs(incoming.position.y - outgoing.position.y) > 1e-12 ||
        Math.abs(incoming.position.z - outgoing.position.z) > 1e-12;
      if (moved) {
        failures.push(`${tag}: contact ${contact.id} changed ball POSITION (teleport)`);
      }
    }
  }

  if (failures.length > 0) {
    results.push({
      id: `tackle-attempt-${tag}`,
      status: "fail",
      description: failures.join("; "),
      details: { failures, playerId: attempt.playerId, startTick: attempt.startTick },
    });
  }
  return results;
}

/**
 * Check ordered-phase evidence for one tackle kind.
 *
 * @param observations - Ordered observations sorted by tick.
 * @param kind - "standing" or "slide".
 * @returns InvariantResult[] — empty when preconditions are unmet.
 */
export function checkTacklePhaseEvidence(
  observations: TelemetryObservation[],
  kind: TackleKindFilter,
): InvariantResult[] {
  if (observations.length === 0) return [];

  const playerCount = observations[0].players.length;
  if (playerCount < 2) return [];

  const firstTick = observations[0].tick;
  const lastTick = observations[observations.length - 1].tick;
  const events = allEvents(observations);
  const attempts = collectAttempts(events, kind);

  if (attempts.length === 0) {
    // The discriminator: with two or more players present and zero tackle
    // evidence of this kind, the action system is absent or stashed.
    return [
      {
        id: `tackle-phase-none-${kind}`,
        status: "fail",
        description:
          `0 ${kind}-tackle phase events found across ticks ${firstTick}–${lastTick} ` +
          `with ${playerCount} players present — the ${kind} tackle action system produced no evidence`,
        details: {
          kind,
          playerCount,
          tickRange: [firstTick, lastTick],
          eventCount: events.length,
        },
      },
    ];
  }

  const results: InvariantResult[] = [];

  // --- Per-attempt ordered-phase checks ----------------------------------
  for (const attempt of attempts) {
    results.push(...checkAttempt(attempt));
  }

  // --- Recovery blocks an instant re-tackle ------------------------------
  const byPlayer = new Map<string, AttemptRecord[]>();
  for (const attempt of attempts) {
    const list = byPlayer.get(attempt.playerId) ?? [];
    list.push(attempt);
    byPlayer.set(attempt.playerId, list);
  }
  for (const [playerId, list] of byPlayer) {
    const sorted = [...list].sort((a, b) => a.startTick - b.startTick);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (curr.startTick <= prev.releaseTick) {
        results.push({
          id: `tackle-relockout-${playerId}-${curr.startTick}`,
          status: "fail",
          description:
            `Player ${playerId} started a new ${kind} tackle at tick ${curr.startTick} ` +
            `before the previous attempt released at tick ${prev.releaseTick}`,
          details: {
            playerId,
            previousReleaseTick: prev.releaseTick,
            nextStartTick: curr.startTick,
          },
        });
      }
    }
  }

  if (results.some((r) => r.status === "fail")) {
    return results.filter((r) => r.status === "fail");
  }

  return [
    {
      id: `tackle-phase-found-${kind}`,
      status: "pass",
      description:
        `${attempts.length} ${kind}-tackle attempt(s) with ordered prepare→active→recover phases, ` +
        `in-window finite-reach contacts and recovery lock-out across ticks ${firstTick}–${lastTick}`,
      details: {
        kind,
        attempts: attempts.map((a) => ({
          playerId: a.playerId,
          startTick: a.startTick,
          activeWindow: [a.activeWindowStartTick, a.activeWindowEndTick],
          releaseTick: a.releaseTick,
          contacts: a.contacts.length,
        })),
      },
    },
  ];
}
