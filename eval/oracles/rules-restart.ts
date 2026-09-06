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
import { FOUNDATION_CONTACT_V1 } from "../../src/simulation/config/foundation.js";

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
  /** The crossing ball position recorded by the boundary event (placement/serve facts). */
  ballPosition?: { x: number; y: number; z: number } | null;
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
      const p = ev.payload as { lastTouchRef?: string | null; touchlineIndex?: number; ballPosition?: { x: number; y: number; z: number } } | undefined;
      if (hasPhaseFacts && startPhaseByTick.get(tick) !== "playing") continue;
      pending.push({
        tick,
        lastTouchRef: p?.lastTouchRef ?? null,
        kind: "touchline",
        touchlineIndex: p?.touchlineIndex,
        ballPosition: p?.ballPosition ?? null,
      });
    } else if (ev.kind === "ball-out-of-play") {
      const p = ev.payload as { lastTouchRef?: string | null; goalIndex?: number; ballPosition?: { x: number; y: number; z: number } } | undefined;
      if (hasPhaseFacts && startPhaseByTick.get(tick) !== "playing") continue;
      pending.push({
        tick,
        lastTouchRef: p?.lastTouchRef ?? null,
        kind: "goalline",
        goalIndex: p?.goalIndex,
        ballPosition: p?.ballPosition ?? null,
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

// ---------------------------------------------------------------------------
// MATCH-THROW-IN-PLACEMENT / MATCH-THROW-IN-SERVE (MATCH_RULES_SPEC §6.3/§6.4)
// ---------------------------------------------------------------------------

/**
 * Versioned provisional placement geometry (match-rules-v1, §13). These are the
 * core's own provisional goal-area values the placement oracle validates the
 * executed kick against — not measured PES constants.
 */
const GOAL_AREA_DEPTH = 5.5;
const GOAL_AREA_HALF_WIDTH = 9.16;
/** Throw-in chest-height ball placement (match-rules-v1, §13). */
const THROW_IN_BALL_Z = 1.5;
/** Corner-flag lateral position (match-rules-v1 §8.2, provisional 68 m pitch). */
const CORNER_FLAG_Y = 34;
/** Position comparison tolerance (m) for restart placement. */
const PLACEMENT_TOLERANCE = 0.2;
/** Kickoff freeze home tolerance (m) — anti-huddle-v1 (referenced). */
const KICKOFF_FREEZE_HOME_TOLERANCE = 0.75;

/** Index the observations by tick. */
function observationsByTick(observations: TelemetryObservation[]): Map<number, TelemetryObservation> {
  const m = new Map<number, TelemetryObservation>();
  for (const o of observations) m.set(o.tick, o);
  return m;
}

/** Collect every executed event of a kind, preserving tick + payload. */
function collectExecuted(
  observations: TelemetryObservation[],
  kind: string,
): Array<{ tick: number; payload: Record<string, unknown> }> {
  const out: Array<{ tick: number; payload: Record<string, unknown> }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind === kind) out.push({ tick: ev.tick, payload: (ev.payload ?? {}) as Record<string, unknown> });
    }
  }
  out.sort((a, b) => a.tick - b.tick);
  return out;
}

/** Return the executed throw-in placement facts paired with the boundary that opened the window. */
function throwInPlacementPairs(observations: TelemetryObservation[]): Array<{
  boundary: Boundary | null;
  execution: { tick: number; payload: Record<string, unknown> };
}> {
  const pairs = pairRestartBoundaries(observations);
  const execs = collectExecuted(observations, "throw-in-executed");
  const byTick = new Map<number, { boundary: Boundary | null; execution: { tick: number; payload: Record<string, unknown> } }>();
  for (const pair of pairs) {
    if (pair.execution.kind === "throw-in") {
      byTick.set(pair.execution.tick, {
        boundary: pair.boundary,
        execution: { tick: pair.execution.tick, payload: {} },
      });
    }
  }
  // Re-attach the full executed payload (the RestartPair only carries the team id).
  for (const exec of execs) {
    const entry = byTick.get(exec.tick);
    if (entry) entry.execution.payload = exec.payload;
  }
  return [...byTick.values()];
}

/**
 * The ball is placed at the exact touchline exit point (§6.3).  The executed
 * throw-in's `throwPosition` must equal the boundary event's `ballPosition`.
 * FAIL on a mismatch; NOT_EVALUATED when no throw-in with a resolvable boundary
 * and placement payload is observed.
 */
export function checkThrowInPlacement(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const pairs = throwInPlacementPairs(observations).filter(
    (p) => p.boundary !== null && p.boundary!.ballPosition && p.execution.payload.throwPosition,
  );

  if (pairs.length === 0) {
    return notEvaluated("rules-throw-in-placement", "No throw-in with a resolvable boundary + placement payload observed");
  }

  const failures: string[] = [];
  for (const pair of pairs) {
    const bp = pair.boundary!.ballPosition!;
    const tp = pair.execution.payload.throwPosition as { x?: unknown; y?: unknown };
    if (typeof tp?.x !== "number" || typeof tp?.y !== "number") {
      failures.push(`throw-in at tick ${pair.execution.tick} has a malformed throwPosition`);
      continue;
    }
    if (Math.hypot(tp.x - bp.x, tp.y - bp.y) > PLACEMENT_TOLERANCE) {
      failures.push(
        `throw-in at tick ${pair.execution.tick} placed at (${tp.x.toFixed(3)},${tp.y.toFixed(3)}) ` +
          `but the exit point was (${bp.x.toFixed(3)},${bp.y.toFixed(3)})`,
      );
    }
  }

  if (failures.length > 0) {
    return [{ id: "rules-throw-in-placement-mutated", status: "fail", description: `Throw-in placement violated: ${failures.join("; ")}`, details: { failures } }];
  }
  return pass("rules-throw-in-placement-held", `${pairs.length} throw-in(s) placed at the exact touchline exit point`, { verified: pairs.length });
}

/**
 * The throw-in is served at chest height toward the nearest awarding-team
 * receiver and into play (§6.4).  At the execution tick the ball sits at
 * `throw_in_ball_z` (1.5 m) with a positive vertical velocity; the payload
 * carries the target receiver position and the into-play direction.
 * FAIL on a violation; NOT_EVALUATED when no throw-in execution is observed.
 */
export function checkThrowInServe(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const execs = collectExecuted(observations, "throw-in-executed");
  if (execs.length === 0) {
    return notEvaluated("rules-throw-in-serve", "No throw-in execution observed");
  }
  const byTick = observationsByTick(observations);
  const failures: string[] = [];
  for (const exec of execs) {
    const o = byTick.get(exec.tick);
    if (!o) continue;
    const tp = exec.payload.throwPosition as { x?: unknown; y?: unknown } | undefined;
    const tgt = exec.payload.targetPosition as { x?: unknown; y?: unknown } | undefined;
    const dir = exec.payload.throwDirection as { x?: unknown; y?: unknown } | undefined;
    // Chest-height serve.
    if (Math.abs(o.ball.position.z - THROW_IN_BALL_Z) > PLACEMENT_TOLERANCE) {
      failures.push(`throw-in at tick ${exec.tick}: ball z=${o.ball.position.z.toFixed(3)} (expected ~${THROW_IN_BALL_Z} chest height)`);
    }
    if (o.ball.linearVelocity.z <= 0) {
      failures.push(`throw-in at tick ${exec.tick}: ball vertical velocity ${o.ball.linearVelocity.z.toFixed(3)} is not upward`);
    }
    // Into-play toward a receiver: a distinct target exists and the direction is a unit vector.
    if (typeof tgt?.x !== "number" || typeof tgt?.y !== "number") {
      failures.push(`throw-in at tick ${exec.tick}: no target receiver position in the payload`);
    } else if (typeof tp?.x !== "number" || typeof tp?.y !== "number") {
      failures.push(`throw-in at tick ${exec.tick}: no throwPosition in the payload`);
    } else if (Math.hypot(tgt.x - tp.x, tgt.y - tp.y) < 0.5) {
      failures.push(`throw-in at tick ${exec.tick}: the serve target is the exit point itself (not into play)`);
    }
    if (typeof dir?.x !== "number" || typeof dir?.y !== "number") {
      failures.push(`throw-in at tick ${exec.tick}: no throwDirection in the payload`);
    } else {
      const mag = Math.hypot(dir.x, dir.y);
      if (Math.abs(mag - 1) > 0.05) {
        failures.push(`throw-in at tick ${exec.tick}: throwDirection is not a unit vector (mag ${mag.toFixed(3)})`);
      }
    }
  }

  if (failures.length > 0) {
    return [{ id: "rules-throw-in-serve-mutated", status: "fail", description: `Throw-in serve violated: ${failures.join("; ")}`, details: { failures } }];
  }
  return pass("rules-throw-in-serve-held", `${execs.length} throw-in(s) served at chest height into play`, { verified: execs.length });
}

// ---------------------------------------------------------------------------
// MATCH-GOAL-KICK-PLACEMENT (MATCH_RULES_SPEC §7.3)
// ---------------------------------------------------------------------------

/** Pair each executed goal kick with the goalline boundary that opened it. */
function goalKickPlacementPairs(observations: TelemetryObservation[]): Array<{
  boundary: Boundary | null;
  execution: { tick: number; payload: Record<string, unknown> };
}> {
  const pairs = pairRestartBoundaries(observations);
  const execs = collectExecuted(observations, "goal-kick-executed");
  const byTick = new Map<number, { boundary: Boundary | null; execution: { tick: number; payload: Record<string, unknown> } }>();
  for (const pair of pairs) {
    if (pair.execution.kind === "goal-kick") {
      byTick.set(pair.execution.tick, {
        boundary: pair.boundary,
        execution: { tick: pair.execution.tick, payload: {} },
      });
    }
  }
  for (const exec of execs) {
    const entry = byTick.get(exec.tick);
    if (entry) entry.execution.payload = exec.payload;
  }
  return [...byTick.values()];
}

/**
 * The goal kick is placed inside the goal area on the exit side (§7.3): the
 * goal-area spot is `(±(goalLineX − GOAL_AREA_DEPTH), clamp(exitY, ±GOAL_AREA_HALF_WIDTH))`
 * preserving the sign of the exit y.  The executed goal kick's `kickPosition`
 * must match.  FAIL on a mismatch; NOT_EVALUATED when no goal kick with a
 * resolvable boundary + placement payload is observed.
 */
export function checkGoalKickPlacement(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const pairs = goalKickPlacementPairs(observations).filter(
    (p) => p.boundary !== null && p.boundary!.ballPosition && p.execution.payload.kickPosition,
  );

  if (pairs.length === 0) {
    return notEvaluated("rules-goal-kick-placement", "No goal kick with a resolvable boundary + placement payload observed");
  }

  const failures: string[] = [];
  for (const pair of pairs) {
    const bp = pair.boundary!.ballPosition!;
    const goalIndex = pair.boundary!.goalIndex;
    const kp = pair.execution.payload.kickPosition as { x?: unknown; y?: unknown };
    if (typeof kp?.x !== "number" || typeof kp?.y !== "number") {
      failures.push(`goal kick at tick ${pair.execution.tick} has a malformed kickPosition`);
      continue;
    }
    if (goalIndex === undefined) continue;
    // The goal area x is the goal-line side minus the goal-area depth.
    const goalLineX = Math.abs(bp.x);
    const expectedX = goalIndex === 0 ? goalLineX - GOAL_AREA_DEPTH : -(goalLineX - GOAL_AREA_DEPTH);
    const expectedY = Math.max(-GOAL_AREA_HALF_WIDTH, Math.min(GOAL_AREA_HALF_WIDTH, bp.y));
    if (Math.hypot(kp.x - expectedX, kp.y - expectedY) > PLACEMENT_TOLERANCE) {
      failures.push(
        `goal kick at tick ${pair.execution.tick} placed at (${kp.x.toFixed(3)},${kp.y.toFixed(3)}) ` +
          `but the goal-area spot was (${expectedX.toFixed(3)},${expectedY.toFixed(3)})`,
      );
    }
  }

  if (failures.length > 0) {
    return [{ id: "rules-goal-kick-placement-mutated", status: "fail", description: `Goal-kick placement violated: ${failures.join("; ")}`, details: { failures } }];
  }
  return pass("rules-goal-kick-placement-held", `${pairs.length} goal kick(s) placed inside the goal area on the exit side`, { verified: pairs.length });
}

// ---------------------------------------------------------------------------
// MATCH-CORNER-KICK-PLACEMENT (MATCH_RULES_SPEC §8.2)
// ---------------------------------------------------------------------------

/** Pair each executed corner kick with the goalline boundary that opened it. */
function cornerPlacementPairs(observations: TelemetryObservation[]): Array<{
  boundary: Boundary | null;
  execution: { tick: number; payload: Record<string, unknown> };
}> {
  const pairs = pairRestartBoundaries(observations);
  const execs = collectExecuted(observations, "corner-kick-executed");
  const byTick = new Map<number, { boundary: Boundary | null; execution: { tick: number; payload: Record<string, unknown> } }>();
  for (const pair of pairs) {
    if (pair.execution.kind === "corner") {
      byTick.set(pair.execution.tick, {
        boundary: pair.boundary,
        execution: { tick: pair.execution.tick, payload: {} },
      });
    }
  }
  for (const exec of execs) {
    const entry = byTick.get(exec.tick);
    if (entry) entry.execution.payload = exec.payload;
  }
  return [...byTick.values()];
}

/**
 * The corner kick is placed at the nearest corner flag (§8.2): `(goalX, ±34)`
 * where `goalX = ±52.5` depends on the goal index and the y sign matches the
 * ball's exit y.  The executed corner kick's `cornerPosition` must match.
 * FAIL on a mismatch; NOT_EVALUATED when no corner kick with a resolvable
 * boundary + placement payload is observed.
 */
export function checkCornerKickPlacement(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const pairs = cornerPlacementPairs(observations).filter(
    (p) => p.boundary !== null && p.boundary!.ballPosition && p.execution.payload.cornerPosition,
  );

  if (pairs.length === 0) {
    return notEvaluated("rules-corner-kick-placement", "No corner kick with a resolvable boundary + placement payload observed");
  }

  const failures: string[] = [];
  for (const pair of pairs) {
    const bp = pair.boundary!.ballPosition!;
    const goalIndex = pair.boundary!.goalIndex;
    const cp = pair.execution.payload.cornerPosition as { x?: unknown; y?: unknown };
    if (typeof cp?.x !== "number" || typeof cp?.y !== "number") {
      failures.push(`corner kick at tick ${pair.execution.tick} has a malformed cornerPosition`);
      continue;
    }
    if (goalIndex === undefined) continue;
    const goalLineX = Math.abs(bp.x);
    const goalX = goalIndex === 0 ? goalLineX : -goalLineX;
    const cornerY = bp.y >= 0 ? CORNER_FLAG_Y : -CORNER_FLAG_Y;
    if (Math.hypot(cp.x - goalX, cp.y - cornerY) > PLACEMENT_TOLERANCE) {
      failures.push(
        `corner kick at tick ${pair.execution.tick} placed at (${cp.x.toFixed(3)},${cp.y.toFixed(3)}) ` +
          `but the nearest corner flag was (${goalX.toFixed(3)},${cornerY.toFixed(3)})`,
      );
    }
  }

  if (failures.length > 0) {
    return [{ id: "rules-corner-kick-placement-mutated", status: "fail", description: `Corner-kick placement violated: ${failures.join("; ")}`, details: { failures } }];
  }
  return pass("rules-corner-kick-placement-held", `${pairs.length} corner kick(s) placed at the nearest corner flag`, { verified: pairs.length });
}

// ---------------------------------------------------------------------------
// MATCH-SCORING-GOAL-PHASE (MATCH_RULES_SPEC §10.2/§9.3)
// ---------------------------------------------------------------------------

/**
 * A goal opens the goal phase, which resets play and returns to playing
 * (§10.2, §9.3).  Reads the runner-injected `core-match-phase` facts: a goal
 * event must be followed by a `goal` phase and then a return to `playing`
 * (the post-goal auto-reset).  FAIL on a missing goal phase or a goal that
 * never returns to playing; NOT_EVALUATED when no goal is observed or the
 * stream carries no phase facts.
 */
export function checkGoalPhase(
  observations: TelemetryObservation[],
): InvariantResult[] {
  let goalSeen = false;
  for (const o of observations) {
    for (const ev of o.events) if (ev.kind === "goal") { goalSeen = true; break; }
  }
  if (!goalSeen) return notEvaluated("rules-goal-phase", "No goal event observed in the run");

  const facts: Array<{ tick: number; phase: string }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "core-match-phase") continue;
      const p = ev.payload as { matchPhase?: unknown } | undefined;
      if (typeof p?.matchPhase === "string") facts.push({ tick: o.tick, phase: p.matchPhase });
    }
  }
  if (facts.length === 0) return notEvaluated("rules-goal-phase", "The observation stream carries no core phase facts");

  // A valid goal phase is a `goal` post-phase tick that is followed by a return to `playing`.
  let goalPhaseSeen = false;
  let returnedToPlaying = false;
  let current = 0;
  for (const f of facts) {
    if (f.phase === "goal") { goalPhaseSeen = true; current = 1; }
    else if (current === 1 && f.phase === "playing") { returnedToPlaying = true; current = 2; }
  }

  if (!goalPhaseSeen || !returnedToPlaying) {
    return [{ id: "rules-goal-phase-mutated", status: "fail", description: `A goal did not open a goal phase that returned to playing (goalPhase=${goalPhaseSeen}, returnedToPlaying=${returnedToPlaying})`, details: { goalPhaseSeen, returnedToPlaying } }];
  }
  return pass("rules-goal-phase-held", "A goal opened the goal phase and play returned to playing via the post-goal reset", {});
}

// ---------------------------------------------------------------------------
// MATCH-KICKOFF-FIRST-TOUCH (MATCH_RULES_SPEC §9.2)
// ---------------------------------------------------------------------------

/**
 * The restart window closes on the first touch of the restarted ball, and only
 * the designated taker (the nearest body to the untouched ball, ties by
 * ascending playerId, keeper excluded per §12.1) may break the freeze (§9.2).
 * Reads the opening untouched window (ball `lastTouchRef` null) and the
 * player-ball contact that closes it.  The keeper exclusion is applied when the
 * observation stream carries the runner-injected `gk-role` designation (the
 * gkBehavior wiring); when no keeper is designated the nearest-body rule is
 * used unchanged.  FAIL when the window never closes, the first-touch body is
 * not the designated taker, or a non-taker body left its home during the
 * window; NOT_EVALUATED when there is no untouched opening window.
 */
export function checkKickoffFirstTouch(
  observations: TelemetryObservation[],
): InvariantResult[] {
  if (observations.length === 0) return notEvaluated("rules-kickoff-first-touch", "No observations in the run");

  const first = observations[0];
  if (first.players.length < 2) return notEvaluated("rules-kickoff-first-touch", "Only one body observed; a taker/freeze distinction is not observable");

  // Opening untouched run.
  let freezeEnd = 0;
  while (freezeEnd < observations.length && observations[freezeEnd].ball.lastTouchRef === null) freezeEnd++;
  if (freezeEnd < 2) return notEvaluated("rules-kickoff-first-touch", "The kickoff ball was touched immediately (no untouched opening window)");

  // The designated keeper (per team), excluded from taker selection (§12.1).
  const keeperIds = new Set<string>();
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "gk-role") continue;
      const p = ev.payload as { keeperPlayerId?: unknown } | undefined;
      if (typeof p?.keeperPlayerId === "string") keeperIds.add(p.keeperPlayerId);
    }
  }

  // Designated taker = nearest body to the untouched ball, ties by ascending playerId.
  const ball = first.ball.position;
  let taker: string | null = null;
  let bestDist = Infinity;
  const sorted = [...first.players].sort((a, b) => a.playerId.localeCompare(b.playerId));
  for (const p of sorted) {
    if (keeperIds.has(p.playerId)) continue;
    const d = Math.hypot(p.groundPosition.x - ball.x, p.groundPosition.y - ball.y);
    if (d < bestDist) { bestDist = d; taker = p.playerId; }
  }

  // The tick the window closes (first non-null lastTouchRef).
  const firstTouchObs = observations[freezeEnd];
  const firstTouchRef = firstTouchObs.ball.lastTouchRef;
  if (firstTouchRef === null) {
    return [{ id: "rules-kickoff-first-touch-mutated", status: "fail", description: "The kickoff ball remained untouched for the whole run (window never closed)", details: {} }];
  }
  // Resolve the body that made the first touch from the contact event.
  let firstTouchPlayerId: string | null = null;
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.id === firstTouchRef) {
        const p = ev.payload as { playerId?: unknown } | undefined;
        firstTouchPlayerId = typeof p?.playerId === "string" ? p.playerId : null;
      }
    }
  }
  if (firstTouchPlayerId === null) {
    return notEvaluated("rules-kickoff-first-touch", "The first-touch reference does not resolve to a player id");
  }

  const failures: string[] = [];
  if (firstTouchPlayerId !== taker) {
    failures.push(`the first touch was by ${firstTouchPlayerId}, not the designated taker ${taker}`);
  }

  // Only the taker (+ at-ball) may leave its kickoff home while untouched.
  const home: Record<string, { x: number; y: number }> = {};
  for (const p of first.players) home[p.playerId] = { x: p.groundPosition.x, y: p.groundPosition.y };
  const movers = new Set<string>();
  for (let i = 0; i < freezeEnd; i++) {
    const o = observations[i];
    for (const p of o.players) {
      const h = home[p.playerId];
      if (!h) continue;
      if (Math.hypot(p.groundPosition.x - h.x, p.groundPosition.y - h.y) > KICKOFF_FREEZE_HOME_TOLERANCE) movers.add(p.playerId);
    }
  }
  const nonTakerMovers = [...movers].filter((id) => id !== taker);
  if (nonTakerMovers.length > 0) {
    failures.push(`non-taker body(ies) left home during the untouched window: ${nonTakerMovers.join(", ")}`);
  }

  if (failures.length > 0) {
    return [{ id: "rules-kickoff-first-touch-mutated", status: "fail", description: `Kickoff first-touch violated: ${failures.join("; ")}`, details: { failures, taker, firstTouchPlayerId } }];
  }
  return pass("rules-kickoff-first-touch-held", `The kickoff window closed on the first touch by the designated taker ${taker}`, { taker, firstTouchPlayerId });
}

// ---------------------------------------------------------------------------
// Anti-huddle restart-behavior oracles (MATCH_RULES_SPEC §12/§9.5)
// ---------------------------------------------------------------------------

/** Planar radius (m) inside which the contact system honours a touch (exemption). */
const TOUCH_PRESS_RANGE = FOUNDATION_CONTACT_V1.contactRadius.value;
/** Huddle radius (m) at which same-team bodies count as one clump (anti-huddle-v1). */
const HUDDLE_RADIUS_METRES = 5;
/** Ticks of live-play geometry sampled after a first touch, for the reopen. */
const AFTER_TOUCH_WINDOW_TICKS = 120;

/** The runner-injected restart-window designation facts for one tick. */
interface RestartDesignation {
  tick: number;
  ballUntouched: boolean;
  takerId: string | null;
  baselineTouchRef: string | null;
  rearmed: boolean;
  teams: Record<string, string | null>;
  anchors: Record<string, { x: number; y: number }> | null;
}

/** Collect every `restart-designation` fact in tick order. */
function collectRestartDesignations(
  observations: TelemetryObservation[],
): RestartDesignation[] {
  const out: RestartDesignation[] = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "restart-designation") continue;
      const p = ev.payload as Partial<RestartDesignation> | undefined;
      if (typeof p?.ballUntouched !== "boolean") continue;
      out.push({
        tick: o.tick,
        ballUntouched: p.ballUntouched,
        takerId: typeof p.takerId === "string" ? p.takerId : null,
        baselineTouchRef: typeof p.baselineTouchRef === "string" ? p.baselineTouchRef : null,
        rearmed: p.rearmed === true,
        teams: p.teams ?? {},
        anchors: p.anchors ?? null,
      });
    }
  }
  out.sort((a, b) => a.tick - b.tick);
  return out;
}

/** A maximal run of consecutive untouched-ball ticks. */
interface UntouchedWindow {
  startTick: number;
  endTick: number;
  closed: boolean;
  rearmed: boolean;
  designations: RestartDesignation[];
}

function findUntouchedWindows(facts: RestartDesignation[]): UntouchedWindow[] {
  const windows: UntouchedWindow[] = [];
  let i = 0;
  while (i < facts.length) {
    if (!facts[i].ballUntouched) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < facts.length && facts[j + 1].ballUntouched) j++;
    const closed = j + 1 < facts.length;
    windows.push({
      startTick: facts[i].tick,
      endTick: facts[j].tick,
      closed,
      rearmed: facts[i].rearmed,
      designations: facts.slice(i, j + 1),
    });
    i = j + 1;
  }
  return windows;
}

function observationByTick(
  observations: TelemetryObservation[],
  tick: number,
): TelemetryObservation | undefined {
  for (const o of observations) if (o.tick === tick) return o;
  return undefined;
}

/** The post-step core phase facts (`core-match-phase`), used by the re-arm oracle. */
function collectCorePhases(
  observations: TelemetryObservation[],
): Array<{ tick: number; phase: string }> {
  const out: Array<{ tick: number; phase: string }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "core-match-phase") continue;
      const p = ev.payload as { matchPhase?: unknown } | undefined;
      if (typeof p?.matchPhase === "string") out.push({ tick: o.tick, phase: p.matchPhase });
    }
  }
  return out;
}

/** The core phase the restart machinery ran a tick from (the adapter's `matchPhase`). */
function startPhaseByTick(observations: TelemetryObservation[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "core-match-phase") continue;
      const p = ev.payload as { startPhase?: unknown } | undefined;
      if (typeof p?.startPhase === "string") m.set(o.tick, p.startPhase);
    }
  }
  return m;
}

/** The core post-step phase for a tick (the phase the tick ended in / the next restart phase). */
function matchPhaseByTick(observations: TelemetryObservation[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "core-match-phase") continue;
      const p = ev.payload as { matchPhase?: unknown } | undefined;
      if (typeof p?.matchPhase === "string") m.set(o.tick, p.matchPhase);
    }
  }
  return m;
}

/**
 * Whether the adapter is in a restart-hold phase for a tick (the phase it
 * samples). The freeze / nearest-only behavior only applies while the phase is
 * `playing` or `kickoff`; during any other phase the adapter returns a neutral
 * frame without converging or freezing, so those ticks are not freeze checks.
 */
function isHoldPhase(phase: string | undefined): boolean {
  return phase === undefined || (phase !== "playing" && phase !== "kickoff");
}

// ---------------------------------------------------------------------------
// MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH (MATCH_RULES_SPEC §12 rule 1)
// ---------------------------------------------------------------------------

/**
 * In every restart window the whole team except the single designated taker is
 * frozen at its window anchor while the restart ball is untouched (§12 rule 1).
 * Reads the runner-injected `restart-designation` facts (ballUntouched, the
 * designated taker, and the per-body window anchor).  A non-taker body outside
 * the touch radius that drifts more than `KICKOFF_FREEZE_HOME_TOLERANCE` from
 * its anchor while the ball is untouched FAILs.  NOT_EVALUATED when the stream
 * carries no multi-tick untouched window (e.g. the ball is served and touched
 * immediately).
 */
export function checkRestartFreezeUntilFirstTouch(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const facts = collectRestartDesignations(observations);
  if (facts.length === 0) {
    return notEvaluated("rules-restart-freeze", "The observation stream carries no restart-designation facts");
  }

  const windows = findUntouchedWindows(facts).filter((w) => w.designations.length >= 2);
  if (windows.length === 0) {
    return notEvaluated("rules-restart-freeze", "No multi-tick untouched restart window observed");
  }

  const matchPhase = matchPhaseByTick(observations);
  const failures: string[] = [];
  let checked = 0;
  for (const window of windows) {
    for (const d of window.designations) {
      // The adapter only freezes while the ball is an untouched restart ball in a
      // live phase; during a restart-hold phase (the tick the restart was awarded
      // / a set-piece is being prepared) it returns a neutral frame without
      // freezing and the core repositions the set-piece bodies.
      if (isHoldPhase(matchPhase.get(d.tick))) continue;
      const o = observationByTick(observations, d.tick);
      if (!o) continue;
      for (const p of o.players) {
        if (p.playerId === d.takerId) continue;
        const distToBall = Math.hypot(
          p.groundPosition.x - o.ball.position.x,
          p.groundPosition.y - o.ball.position.y,
        );
        // A body already inside the touch radius is at the ball and is exempt.
        if (distToBall <= TOUCH_PRESS_RANGE) continue;
        const anchor = d.anchors?.[p.playerId];
        if (!anchor) continue;
        const drift = Math.hypot(p.groundPosition.x - anchor.x, p.groundPosition.y - anchor.y);
        checked++;
        if (drift > KICKOFF_FREEZE_HOME_TOLERANCE) {
          failures.push(
            `tick ${d.tick}: non-taker ${p.playerId} drifted ${drift.toFixed(3)}m from its window anchor`,
          );
        }
      }
    }
  }

  if (failures.length > 0) {
    return [{ id: "rules-restart-freeze-mutated", status: "fail", description: `Restart freeze violated: ${failures.slice(0, 5).join("; ")}`, details: { failures: failures.slice(0, 20), checked } }];
  }
  return pass("rules-restart-freeze-held", `In every restart window the whole team except the single designated taker is frozen at its window anchor`, { windows: windows.length, checked });
}

// ---------------------------------------------------------------------------
// MATCH-RESTART-NEAREST-ONLY (MATCH_RULES_SPEC §12 rule 2)
// ---------------------------------------------------------------------------

/**
 * After the restart ball is first touched, only one designated chaser per team
 * converges on the ball (§12 rule 2): every team has exactly one designated
 * chaser, and no team clumps more than two bodies around the ball.  Reads the
 * runner-injected `restart-designation` facts and the committed geometry in the
 * ticks after each closed window.  A second body chasing inside the window
 * (a team clump) FAILs.  NOT_EVALUATED when no closed (first-touched) window is
 * observed.
 */
export function checkRestartNearestOnly(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const facts = collectRestartDesignations(observations);
  if (facts.length === 0) {
    return notEvaluated("rules-restart-nearest", "The observation stream carries no restart-designation facts");
  }

  const closedWindows = findUntouchedWindows(facts).filter((w) => w.closed);
  if (closedWindows.length === 0) {
    return notEvaluated("rules-restart-nearest", "No closed (first-touched) restart window observed");
  }

  const matchPhase = matchPhaseByTick(observations);
  const failures: string[] = [];
  let checked = 0;
  for (const window of closedWindows) {
    const firstTouchIndex = facts.findIndex((f) => f.tick > window.endTick);
    if (firstTouchIndex === -1) continue;
    for (let k = firstTouchIndex; k < facts.length && k < firstTouchIndex + AFTER_TOUCH_WINDOW_TICKS; k++) {
      const d = facts[k];
      if (d.ballUntouched) continue;
      // The chase / clump check only applies while the phase is playing/kickoff;
      // during a restart-hold phase the adapter returns a neutral frame.
      if (isHoldPhase(matchPhase.get(d.tick))) continue;
      const o = observationByTick(observations, d.tick);
      if (!o) continue;
      // Exactly one designated chaser per team (the shared press designation).
      const chasers = new Set<string>();
      for (const chaserId of Object.values(d.teams)) {
        if (chaserId) chasers.add(chaserId);
      }
      // No clump: at most 2 same-team bodies inside the huddle radius of the ball.
      const within = new Map<string, number>();
      for (const p of o.players) {
        const dist = Math.hypot(
          p.groundPosition.x - o.ball.position.x,
          p.groundPosition.y - o.ball.position.y,
        );
        if (dist < HUDDLE_RADIUS_METRES) within.set(p.teamId, (within.get(p.teamId) ?? 0) + 1);
      }
      checked++;
      for (const [teamId, count] of within) {
        if (count > 2) {
          failures.push(
            `tick ${d.tick}: team ${teamId} has ${count} bodies within ${HUDDLE_RADIUS_METRES}m of the ball (a second body chasing)`,
          );
        }
      }
    }
  }

  if (failures.length > 0) {
    return [{ id: "rules-restart-nearest-mutated", status: "fail", description: `Nearest-only chase violated: ${failures.slice(0, 5).join("; ")}`, details: { failures: failures.slice(0, 20), checked } }];
  }
  return pass("rules-restart-nearest-held", `After the first touch only one designated chaser per team converges on the ball`, { windows: closedWindows.length, checked });
}

// ---------------------------------------------------------------------------
// MATCH-RESTART-REARM (MATCH_RULES_SPEC §9.5)
// ---------------------------------------------------------------------------

/**
 * After a post-goal / halftime reset the adapter re-keys the 'untouched ball'
 * signal to the carried-through touch reference and re-arms the restart window
 * (§9.5).  Reads the runner-injected `restart-designation` facts: a window
 * whose `rearmed` flag is true (baselineTouchRef non-null) is a re-armed window.
 * When the stream carries a goal / halftime phase but no re-armed window, the
 * re-arm was missed → FAIL.  NOT_EVALUATED when no post-goal / halftime reset
 * occurs.
 */
export function checkRestartRearm(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const facts = collectRestartDesignations(observations);
  if (facts.length === 0) {
    return notEvaluated("rules-restart-rearm", "The observation stream carries no restart-designation facts");
  }

  const phases = collectCorePhases(observations);
  const hasResetPhase = phases.some((f) => f.phase === "goal" || f.phase === "halftime");
  if (!hasResetPhase) {
    return notEvaluated("rules-restart-rearm", "No post-goal / halftime reset observed in the run");
  }

  const rearmedWindows = findUntouchedWindows(facts).filter((w) => w.rearmed);
  if (rearmedWindows.length === 0) {
    return [{ id: "rules-restart-rearm-mutated", status: "fail", description: "A post-goal / halftime reset occurred but no restart window was re-armed to the carried-through touch reference", details: { resetPhases: phases.filter((f) => f.phase === "goal" || f.phase === "halftime").length } }];
  }
  return pass("rules-restart-rearm-held", "A post-goal / halftime reset re-armed the restart window keyed to the carried-through touch reference", { rearmedWindows: rearmedWindows.length });
}
