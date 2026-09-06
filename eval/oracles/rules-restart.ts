/**
 * @module eval/oracles/rules-restart
 *
 * Protected match-rule oracles (objective RULES-SUITE-REGISTRATION),
 * adjudicating the MATCH_RULES_SPEC §15 restart / out-of-play / scoring
 * criteria over committed observation streams:
 *   - MATCH-OUT-OF-PLAY-DETECT            -> checkOutOfPlayDetection
 *   - MATCH-OUT-OF-PLAY-NO-LAST-TOUCH     -> checkOutOfPlayNoLastTouch
 *   - MATCH-THROW-IN-AWARD                -> checkThrowInAward
 *   - MATCH-GOAL-KICK-AWARD               -> checkGoalKickAward
 *   - MATCH-CORNER-KICK-AWARD             -> checkCornerKickAward
 *   - MATCH-SCORING-GOAL-DEVENT           -> checkGoalDetection
 *
 * Each oracle is a pure `TelemetryObservation[] → InvariantResult[]` function
 * and reads only committed, observable fields: the boundary / restart /
 * goal events, the players, and the ball's authoritative `lastTouchRef`.  The
 * restart award semantics are read straight from the event stream (the
 * `ball-out-of-play` / `ball-touchline-out-of-play` payloads carry the
 * lastTouchRef, which resolves to a team through the recorded contact events).
 * Where the observation stream genuinely cannot carry a verdict the oracle
 * returns NOT_EVALUATED; a mutated (contradictory) stream returns FAIL.
 *
 * No geometry threshold is implied: the checks validate payload structure
 * (goalIndex / touchlineIndex membership in {0,1}, ballPosition presence) and
 * team relationships resolved from contact events, not goal-line or pitch
 * geometry.  No PES 2017 value is used.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Shared helpers (pure)
// ---------------------------------------------------------------------------

/**
 * Resolve the team that last touched the ball from a boundary event's
 * lastTouchRef.  The reference points to a recorded contact event (which
 * carries `teamId`); it may have been emitted on an earlier tick, so it is
 * resolved against the union of every event across the observation window.
 * Returns null when the reference is null or does not resolve to a team.
 */
function resolveLastTouchTeam(
  observations: TelemetryObservation[],
  lastTouchRef: string | null | undefined,
): string | null {
  if (!lastTouchRef) return null;
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.id !== lastTouchRef) continue;
      const payload = ev.payload as { teamId?: string } | undefined;
      return payload?.teamId ?? null;
    }
  }
  return null;
}

/** Everything in the observation window in crude tick order (boundaries + executions). */
interface Boundary {
  tick: number;
  lastTouchRef: string | null;
  kind: "touchline" | "goalline";
  goalIndex?: number;
  touchlineIndex?: number;
}

interface Execution {
  tick: number;
  kind: "throw-in" | "goal-kick" | "corner";
  teamId: string | null;
}

interface RestartPair {
  boundary: Boundary | null;
  execution: Execution;
}

/** Collect every boundary / execution event in tick order. */
function collectRestartEvents(
  observations: TelemetryObservation[],
): Array<{ tick: number; sequence: number; ev: { kind: string; payload?: Record<string, unknown> } }> {
  const out: Array<{ tick: number; sequence: number; ev: { kind: string; payload?: Record<string, unknown> } }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (
        ev.kind === "ball-out-of-play" ||
        ev.kind === "ball-touchline-out-of-play" ||
        ev.kind === "throw-in-executed" ||
        ev.kind === "goal-kick-executed" ||
        ev.kind === "corner-kick-executed"
      ) {
        out.push({ tick: ev.tick, sequence: ev.sequence, ev: ev as unknown as { kind: string; payload?: Record<string, unknown> } });
      }
    }
  }
  out.sort((a, b) => (a.tick - b.tick) || (a.sequence - b.sequence));
  return out;
}

/**
 * RESTART-RULES-CONFORMANCE: when the observation stream carries the runner's
 * per-tick `core-match-phase` facts, return the STARTING core phase per tick.
 * The restart machinery opens a single window only from a "playing" phase, so a
 * boundary emitted on a tick whose starting phase is not "playing" was ignored
 * by the core (an already-open restart window) and must not be paired with an
 * execution — otherwise an organic late extra boundary would be mis-attributed
 * as the award source. When the stream carries no phase facts (synthetic unit
 * streams, non-gated real runs) the pairing falls back to the original
 * last-boundary-of-kind rule.
 */
function restingPhaseByTick(
  observations: TelemetryObservation[],
): { hasPhaseFacts: boolean; startPhaseByTick: Map<number, string> } {
  const startPhaseByTick = new Map<number, string>();
  let hasPhaseFacts = false;
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "core-match-phase") continue;
      const payload = ev.payload as { startPhase?: unknown } | undefined;
      if (typeof payload?.startPhase !== "string") continue;
      hasPhaseFacts = true;
      startPhaseByTick.set(o.tick, payload.startPhase);
    }
  }
  return { hasPhaseFacts, startPhaseByTick };
}

/**
 * Pair every boundary (goal line / touchline) with the restart execution the
 * core issued in response, in the order the core runs one window at a time.
 * A boundary whose last touch could not be resolved opens no restart and so is
 * left unpaired (correct behaviour); an execution with no pending boundary is
 * recorded as an orphan (boundary null).
 */
function pairRestartBoundaries(observations: TelemetryObservation[]): RestartPair[] {
  const { hasPhaseFacts, startPhaseByTick } = restingPhaseByTick(observations);
  const pending: Boundary[] = [];
  const pairs: RestartPair[] = [];

  for (const { tick, ev } of collectRestartEvents(observations)) {
    if (ev.kind === "ball-touchline-out-of-play") {
      const p = ev.payload as { lastTouchRef?: string | null; touchlineIndex?: number } | undefined;
      if (hasPhaseFacts && startPhaseByTick.get(tick) !== "playing") continue;
      pending.push({
        tick,
        lastTouchRef: p?.lastTouchRef ?? null,
        kind: "touchline",
        touchlineIndex: p?.touchlineIndex,
      });
    } else if (ev.kind === "ball-out-of-play") {
      const p = ev.payload as { lastTouchRef?: string | null; goalIndex?: number } | undefined;
      if (hasPhaseFacts && startPhaseByTick.get(tick) !== "playing") continue;
      pending.push({
        tick,
        lastTouchRef: p?.lastTouchRef ?? null,
        kind: "goalline",
        goalIndex: p?.goalIndex,
      });
    } else if (ev.kind === "throw-in-executed") {
      const teamId = (ev.payload as { teamId?: string } | undefined)?.teamId ?? null;
      const idx = lastIndexOfKind(pending, "touchline");
      if (idx >= 0) pairs.push({ boundary: pending.splice(idx, 1)[0], execution: { tick, kind: "throw-in", teamId } });
      else pairs.push({ boundary: null, execution: { tick, kind: "throw-in", teamId } });
    } else if (ev.kind === "goal-kick-executed" || ev.kind === "corner-kick-executed") {
      const teamId = (ev.payload as { teamId?: string } | undefined)?.teamId ?? null;
      const kind = ev.kind === "goal-kick-executed" ? "goal-kick" : "corner";
      const idx = lastIndexOfKind(pending, "goalline");
      if (idx >= 0) pairs.push({ boundary: pending.splice(idx, 1)[0], execution: { tick, kind, teamId } });
      else pairs.push({ boundary: null, execution: { tick, kind, teamId } });
    }
  }

  return pairs;
}

function lastIndexOfKind(boundaries: Boundary[], kind: Boundary["kind"]): number {
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (boundaries[i].kind === kind) return i;
  }
  return -1;
}

/** A NOT_EVALUATED result for a criterion with nothing to observe. */
function notEvaluated(id: string, description: string): InvariantResult[] {
  return [{ id, status: "not_evaluated", description, details: {} }];
}

/** A single PASS result. */
function pass(id: string, description: string, details?: Record<string, unknown>): InvariantResult[] {
  return [{ id, status: "pass", description, details }];
}

// ---------------------------------------------------------------------------
// MATCH-OUT-OF-PLAY-DETECT
// ---------------------------------------------------------------------------

/**
 * A boundary crossing emits exactly one correct event (goal / ball-out-of-play /
 * ball-touchline-out-of-play) with a well-formed payload, and a goal and a
 * goal-line out-of-play are mutually exclusive (§5.1).  FAIL on a malformed
 * boundary payload or on a tick that emits both a goal and an out-of-play.
 */
export function checkOutOfPlayDetection(
  observations: TelemetryObservation[],
): InvariantResult[] {
  let boundarySeen = false;
  const failures: string[] = [];

  for (const o of observations) {
    let goalThisTick = false;
    let oopThisTick = false;
    for (const ev of o.events) {
      if (ev.kind === "goal") {
        goalThisTick = true;
        boundarySeen = true;
      } else if (ev.kind === "ball-out-of-play") {
        oopThisTick = true;
        boundarySeen = true;
        const p = ev.payload as { goalIndex?: unknown; ballPosition?: unknown } | undefined;
        if (typeof p?.goalIndex !== "number" || (p.goalIndex !== 0 && p.goalIndex !== 1)) {
          failures.push(`ball-out-of-play at tick ${o.tick} has invalid goalIndex`);
        }
        if (!p?.ballPosition) {
          failures.push(`ball-out-of-play at tick ${o.tick} has no ballPosition`);
        }
      } else if (ev.kind === "ball-touchline-out-of-play") {
        boundarySeen = true;
        const p = ev.payload as { touchlineIndex?: unknown; ballPosition?: unknown } | undefined;
        if (typeof p?.touchlineIndex !== "number" || (p.touchlineIndex !== 0 && p.touchlineIndex !== 1)) {
          failures.push(`ball-touchline-out-of-play at tick ${o.tick} has invalid touchlineIndex`);
        }
        if (!p?.ballPosition) {
          failures.push(`ball-touchline-out-of-play at tick ${o.tick} has no ballPosition`);
        }
      }
    }
    if (goalThisTick && oopThisTick) {
      failures.push(`tick ${o.tick} emits both a goal and a goal-line out-of-play (mutual exclusivity violated)`);
    }
  }

  if (!boundarySeen) return notEvaluated("rules-oop-detect", "No boundary (goal / out-of-play) event observed in the run");

  if (failures.length > 0) {
    return [
      {
        id: "rules-oop-detect-mutated",
        status: "fail",
        description: `Out-of-play detection contract violated: ${failures.join("; ")}`,
        details: { failures },
      },
    ];
  }

  return pass("rules-oop-detect-held", "Boundary events carry well-formed payloads and are mutually exclusive");
}

// ---------------------------------------------------------------------------
// MATCH-OUT-OF-PLAY-NO-LAST-TOUCH
// ---------------------------------------------------------------------------

/**
 * A boundary with a null / unresolvable lastTouchRef opens no restart (§5.3).
 * FAIL when such a boundary is nonetheless followed by a restart execution (the
 * core must not have issued one); PASS when every no-last-touch boundary was
 * correctly ignored.
 */
export function checkOutOfPlayNoLastTouch(
  observations: TelemetryObservation[],
): InvariantResult[] {
  let boundarySeen = false;
  let nullTouchBoundaryCount = 0;
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind === "ball-out-of-play" || ev.kind === "ball-touchline-out-of-play") {
        boundarySeen = true;
        const lastTouch = (ev.payload as { lastTouchRef?: string | null } | undefined)?.lastTouchRef ?? null;
        if (resolveLastTouchTeam(observations, lastTouch) === null) nullTouchBoundaryCount++;
      }
    }
  }

  if (!boundarySeen) {
    return notEvaluated("rules-no-last-touch", "No boundary event observed; no no-last-touch case to adjudicate");
  }
  if (nullTouchBoundaryCount === 0) {
    return notEvaluated(
      "rules-no-last-touch",
      "Every boundary had a resolvable last-touch team; no no-last-touch case to adjudicate",
    );
  }

  const pairs = pairRestartBoundaries(observations);
  const nullTouchPaired = pairs.filter((p) => {
    if (p.boundary === null) return false;
    return resolveLastTouchTeam(observations, p.boundary.lastTouchRef) === null;
  });

  if (nullTouchPaired.length > 0) {
    return [
      {
        id: "rules-no-last-touch-mutated",
        status: "fail",
        description: `A boundary with no resolvable last-touch team opened a restart (${nullTouchPaired.length} case(s))`,
        details: { nullTouchPaired: nullTouchPaired.length },
      },
    ];
  }

  return pass(
    "rules-no-last-touch-held",
    `Every no-last-touch boundary (${nullTouchBoundaryCount}) correctly opened no restart`,
    { nullTouchBoundaryCount },
  );
}

// ---------------------------------------------------------------------------
// MATCH-THROW-IN-AWARD
// ---------------------------------------------------------------------------

/**
 * A throw-in is awarded to the team opposite whoever last touched the ball
 * (§6.2).  The executed throw-in's team must match that award.
 */
export function checkThrowInAward(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const pairs = pairRestartBoundaries(observations);
  const throwInPairs = pairs.filter(
    (p) => p.execution.kind === "throw-in" && p.boundary !== null,
  );

  if (throwInPairs.length === 0) {
    return notEvaluated("rules-throw-in-award", "No completed throw-in with a resolvable boundary in the run");
  }

  const failures: string[] = [];
  let verified = 0;
  for (const pair of throwInPairs) {
    const lastTeam = resolveLastTouchTeam(observations, pair.boundary!.lastTouchRef);
    if (lastTeam === null) continue;
    const expected = lastTeam === "team-a" ? "team-b" : "team-a";
    verified++;
    const actual = pair.execution.teamId;
    if (actual !== expected) {
      failures.push(
        `throw-in expected for ${expected} (opposite of last-touch ${lastTeam}) but executed for ${actual}`,
      );
    }
  }

  if (failures.length > 0) {
    return [
      {
        id: "rules-throw-in-award-mutated",
        status: "fail",
        description: `Throw-in award violated: ${failures.join("; ")}`,
        details: { failures },
      },
    ];
  }

  if (verified === 0) {
    return notEvaluated("rules-throw-in-award", "Throw-in boundaries observed but no last-touch team was resolvable");
  }

  return pass("rules-throw-in-award-held", `${verified} throw-in(s) awarded to the OPPOSITE last-touch team`, { verified });
}

// ---------------------------------------------------------------------------
// MATCH-GOAL-KICK-AWARD
// ---------------------------------------------------------------------------

/**
 * A goal kick is awarded to the defending team of the exited goal line when the
 * last touch was NOT the defending team (§7.2).  Corner kicks are exempt here
 * (adjudicated by MATCH-CORNER-KICK-AWARD); only goal-kick executions are
 * checked, and only for goalline boundaries.
 */
export function checkGoalKickAward(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const pairs = pairRestartBoundaries(observations);
  const goalKickPairs = pairs.filter(
    (p) => p.execution.kind === "goal-kick" && p.boundary !== null && p.boundary.goalIndex !== undefined,
  );

  if (goalKickPairs.length === 0) {
    return notEvaluated("rules-goal-kick-award", "No completed goal kick with a resolvable boundary in the run");
  }

  const failures: string[] = [];
  let verified = 0;
  for (const pair of goalKickPairs) {
    const boundary = pair.boundary!;
    const lastTeam = resolveLastTouchTeam(observations, boundary.lastTouchRef);
    if (lastTeam === null) continue;
    const defendingTeam = boundary.goalIndex === 0 ? "team-b" : "team-a";
    if (lastTeam === defendingTeam) {
      failures.push(
        `goalIndex ${boundary.goalIndex} last touch ${lastTeam} is the defending team (${defendingTeam}) — a corner kick was required, not a goal kick`,
      );
      verified++;
      continue;
    }
    verified++;
    if (pair.execution.teamId !== defendingTeam) {
      failures.push(
        `goal kick expected for defending team ${defendingTeam} but executed for ${pair.execution.teamId}`,
      );
    }
  }

  if (failures.length > 0) {
    return [
      {
        id: "rules-goal-kick-award-mutated",
        status: "fail",
        description: `Goal-kick award violated: ${failures.join("; ")}`,
        details: { failures },
      },
    ];
  }

  if (verified === 0) {
    return notEvaluated("rules-goal-kick-award", "Goal-kick boundaries observed but no last-touch team was resolvable");
  }

  return pass("rules-goal-kick-award-held", `${verified} goal kick(s) awarded to the defending team`, { verified });
}

// ---------------------------------------------------------------------------
// MATCH-CORNER-KICK-AWARD
// ---------------------------------------------------------------------------

/**
 * A corner kick is awarded to the attacking team when the last touch is the
 * defending team of the exited goal line (§8.1).  Only corner executions are
 * checked.
 */
export function checkCornerKickAward(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const pairs = pairRestartBoundaries(observations);
  const cornerPairs = pairs.filter(
    (p) => p.execution.kind === "corner" && p.boundary !== null && p.boundary.goalIndex !== undefined,
  );

  if (cornerPairs.length === 0) {
    return notEvaluated("rules-corner-kick-award", "No completed corner kick with a resolvable boundary in the run");
  }

  const failures: string[] = [];
  let verified = 0;
  for (const pair of cornerPairs) {
    const boundary = pair.boundary!;
    const lastTeam = resolveLastTouchTeam(observations, boundary.lastTouchRef);
    if (lastTeam === null) continue;
    const defendingTeam = boundary.goalIndex === 0 ? "team-b" : "team-a";
    const attackingTeam = boundary.goalIndex === 0 ? "team-a" : "team-b";
    verified++;
    if (lastTeam !== defendingTeam) {
      failures.push(
        `goalIndex ${boundary.goalIndex} last touch ${lastTeam} is NOT the defending team (${defendingTeam}) — a goal kick was required, not a corner kick`,
      );
      continue;
    }
    if (pair.execution.teamId !== attackingTeam) {
      failures.push(
        `corner kick expected for attacking team ${attackingTeam} but executed for ${pair.execution.teamId}`,
      );
    }
  }

  if (failures.length > 0) {
    return [
      {
        id: "rules-corner-kick-award-mutated",
        status: "fail",
        description: `Corner-kick award violated: ${failures.join("; ")}`,
        details: { failures },
      },
    ];
  }

  if (verified === 0) {
    return notEvaluated("rules-corner-kick-award", "Corner-kick boundaries observed but no last-touch team was resolvable");
  }

  return pass("rules-corner-kick-award-held", `${verified} corner kick(s) awarded to the attacking team`, { verified });
}

// ---------------------------------------------------------------------------
// MATCH-SCORING-GOAL-DEVENT
// ---------------------------------------------------------------------------

/**
 * A goal event carries a valid goalIndex (0 = right / +x, 1 = left / -x) and is
 * mutually exclusive with a goal-line out-of-play on the same tick (§5.1, §10.1).
 * FAIL on an invalid goalIndex or a same-tick goal + out-of-play.
 */
export function checkGoalDetection(
  observations: TelemetryObservation[],
): InvariantResult[] {
  let goalSeen = false;
  const failures: string[] = [];
  for (const o of observations) {
    let goalThisTick = false;
    let oopThisTick = false;
    for (const ev of o.events) {
      if (ev.kind === "goal") {
        goalSeen = true;
        goalThisTick = true;
        const gi = (ev.payload as { goalIndex?: unknown } | undefined)?.goalIndex;
        if (typeof gi !== "number" || (gi !== 0 && gi !== 1)) {
          failures.push(`goal at tick ${o.tick} has invalid goalIndex`);
        }
      } else if (ev.kind === "ball-out-of-play") {
        oopThisTick = true;
      }
    }
    if (goalThisTick && oopThisTick) {
      failures.push(`tick ${o.tick} emits both a goal and a goal-line out-of-play`);
    }
  }

  if (!goalSeen) return notEvaluated("rules-goal-detection", "No goal event observed in the run");

  if (failures.length > 0) {
    return [
      {
        id: "rules-goal-detection-mutated",
        status: "fail",
        description: `Goal-detection contract violated: ${failures.join("; ")}`,
        details: { failures },
      },
    ];
  }

  return pass("rules-goal-detection-held", "Goal event(s) carry a valid goalIndex and are mutually exclusive with out-of-play");
}
